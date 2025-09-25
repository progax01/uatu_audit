import path from "node:path";
import fs from "fs-extra";
import { SOP, SOPInputs, SOPResult } from "../types.js";
import { step, ProgressHook } from "../utils/stepHelper.js";
import { ClaudeAIProvider } from "../services/ai/claudeProvider.js";
import { createLiveLogger } from "../services/liveLogger.js";
import { suggestTestsWithAnthropic } from "../services/ai/anthropicProvider.js";
import { TestPlanGenerator } from "../services/testPlanGenerator.js";
import { SkeletonGenerator } from "../services/skeletonGenerator.js";
import { DEFAULT_TEST_STYLES } from "../services/testStyles.js";

export const testgenSOP: SOP = {
  name: "testgen",
  version: "1.1.0",
  prerequisites: ["bootstrap", "inventory", "analysis"],
  async validateInputs(i) { return !!i.projectPath; },
  async execute(i: SOPInputs, onProgress?: ProgressHook): Promise<SOPResult> {
    const started_at = new Date().toISOString(); 
    const errors: string[] = [];
    const runPath = path.join(i.runsPath as string, i.timestamp as string);
    const liveLogger = createLiveLogger(runPath, 'cli');
    const ai_tests_path = path.join(i.projectPath as string, ".uatu", "ai_tests");
    await fs.ensureDir(ai_tests_path);

    liveLogger.info('Testgen SOP starting', { ai: !!i.ai });

    await step(onProgress, { phase: "testgen", step: "coverage-gaps", pct: 25 });
    
    // Load project structure from bootstrap
    const projectStructure = await fs.readJson(path.join(i.contextPath as string, "project-structure.json")).catch(() => null);
    
    // Get test styles from inputs or use defaults
    const testStyles = (i.testStyles as string[]) || DEFAULT_TEST_STYLES;
    liveLogger.info('Test styles enabled', { testStyles });
    
    await step(onProgress, { phase: "testgen", step: "load-analysis", pct: 35 });
    
    // Load inventory and analysis for plan generation
    const inv = await fs.readJson(path.join(i.projectPath as string, "runs", (i.timestamp as string) ?? "", "inventory.json")).catch(() => null as any);
    const analysis = await fs.readJson(path.join(i.projectPath as string, "runs", (i.timestamp as string) ?? "", "analysis.json")).catch(() => null as any);
    
    // Generate test plans for enabled styles
    const testPlans = [];
    const generatedFiles: string[] = [];
    
    if (testStyles.includes("behavioral")) {
      liveLogger.info('Generating behavioral test plan');
      const behavioralPlan = TestPlanGenerator.generateBehavioralPlan(inv);
      testPlans.push(behavioralPlan);
      
      // Write behavioral plan JSON
      await fs.writeJson(path.join(runPath, "testplan.behavioral.json"), behavioralPlan, { spaces: 2 });
      
      // Generate code skeletons
      const foundryFiles = await SkeletonGenerator.writeFoundrySkeletons(behavioralPlan, ai_tests_path);
      const hardhatFiles = await SkeletonGenerator.writeHardhatSkeletons(behavioralPlan, ai_tests_path);
      const anchorFiles = await SkeletonGenerator.writeAnchorSkeletons(behavioralPlan, ai_tests_path);
      
      generatedFiles.push(...foundryFiles, ...hardhatFiles, ...anchorFiles);
      liveLogger.info('Behavioral skeletons generated', { count: foundryFiles.length + hardhatFiles.length + anchorFiles.length });
    }
    
    if (testStyles.includes("stride")) {
      liveLogger.info('Generating STRIDE test plan');
      const stridePlan = TestPlanGenerator.generateStridePlan(inv, analysis);
      testPlans.push(stridePlan);
      
      // Write STRIDE plan JSON
      await fs.writeJson(path.join(runPath, "testplan.stride.json"), stridePlan, { spaces: 2 });
      
      // Generate code skeletons  
      const foundryFiles = await SkeletonGenerator.writeFoundrySkeletons(stridePlan, ai_tests_path);
      const hardhatFiles = await SkeletonGenerator.writeHardhatSkeletons(stridePlan, ai_tests_path);
      const anchorFiles = await SkeletonGenerator.writeAnchorSkeletons(stridePlan, ai_tests_path);
      
      generatedFiles.push(...foundryFiles, ...hardhatFiles, ...anchorFiles);
      liveLogger.info('STRIDE skeletons generated', { count: foundryFiles.length + hardhatFiles.length + anchorFiles.length });
    }
    
    // Calculate coverage metrics
    const coverage = TestPlanGenerator.calculateCoverage(testPlans, inv);
    await fs.writeJson(path.join(runPath, "testplan.metrics.json"), { coverage }, { spaces: 2 });
    
    liveLogger.info('Test plan metrics calculated', { coverage });
    
    // Legacy plan files for backward compatibility
    const plans: Array<{ file: string; content: string }> = [];
    for (const plan of testPlans) {
      const planContent = `# ${plan.style.toUpperCase()} Test Plan\n\nGenerated: ${plan.metadata.generated}\nTargets: ${plan.metadata.totalTargets}\nTest Cases: ${plan.metadata.totalCases}\n\n${JSON.stringify(plan.matrix.slice(0, 3), null, 2)}\n\n... (${plan.metadata.totalTargets} total targets)`;
      plans.push({ file: `${plan.style}.plan.json`, content: planContent });
    }
    
    for (const p of plans) await fs.writeFile(path.join(ai_tests_path, p.file), p.content, "utf8");

    await step(onProgress, { phase: "testgen", step: "integration-scenarios", pct: 80 });

    // Enhanced AI test generation with Claude CLI
    if ((i as any).ai && projectStructure) {
      await step(onProgress, { phase: "testgen", step: "ai-generation", pct: 90 });
      
      try {
        liveLogger.info('Generating AI tests with Claude CLI');
        
        const claudeProvider = new ClaudeAIProvider(runPath, true); // Auto-accept mode
        
        const aiRequest = {
          projectPath: i.projectPath as string,
          runPath,
          contractFiles: projectStructure.mainContracts || [],
          existingTests: projectStructure.testFiles || [],
          projectStructure,
          securityFocus: true,
          testTypes: ['unit', 'integration'] as ('unit' | 'integration' | 'fuzz' | 'invariant')[]
        };
        
        const aiResult = await claudeProvider.generateTests(aiRequest);
        
        if (aiResult.success) {
          liveLogger.info('AI test generation completed', {
            testsGenerated: aiResult.testsGenerated.length,
            claudeInteractions: aiResult.claudeInteractions
          });
          
          // Add AI test plans
          plans.push({
            file: "ai-enhanced.plan.txt",
            content: `# AI-Generated Test Plan\n\n${aiResult.recommendations.join('\n- ')}`
          });
          
          // Copy generated test files to the test plan directory
          for (const testFile of aiResult.testFiles) {
            const fileName = path.basename(testFile);
            const content = await fs.readFile(testFile, 'utf8');
            plans.push({ file: `ai-${fileName}`, content });
          }
        } else {
          errors.push(...aiResult.errors);
        }
        
        await claudeProvider.close();
        
      } catch (err: any) {
        liveLogger.error('AI test generation failed', { error: String(err) });
        errors.push(`AI test generation failed: ${err?.message || err}`);
        
        // Fallback to basic AI suggestions
        try {
          const ctx = await fs.readFile(path.join(i.contextPath as string, "tree.txt")).catch(() => Buffer.from(""))
            .then(b => b.toString());
          const prompt = `Given this repository tree and inventory JSON, propose JSON {files:[{path,tests[]}]} with concise, high-signal tests.\n` +
            ctx.slice(0, 16000) + "\nINVENTORY:\n" + JSON.stringify(inv ?? {}, null, 2).slice(0, 16000);
          const ideas = await suggestTestsWithAnthropic(prompt).catch(e => { errors.push(String(e)); return { files: [] as any[] }; });
          for (const f of ideas.files) {
            const fn = (f.path || "generated").replace(/[^\w.-]/g, "_") + ".ai.plan.txt";
            const body = `# AI Suggestions for ${f.path}\n${(f.tests||[]).map((t: string) => `- [ ] ${t}`).join("\n")}\n`;
            await fs.writeFile(path.join(ai_tests_path, fn), body, "utf8");
          }
        } catch (fallbackErr: any) {
          errors.push(`Fallback AI generation also failed: ${fallbackErr?.message || fallbackErr}`);
        }
      }
    }

    await step(onProgress, { phase: "testgen", step: "testgen-complete", pct: 100 });
    
    liveLogger.info('Testgen SOP completed', { 
      plansGenerated: plans.length, 
      aiEnabled: !!(i as any).ai,
      errors: errors.length 
    });
    
    const outputs = { 
      plans: plans.map(p => p.file),
      allPlans: plans,
      testPlans,
      testStyles,
      generatedFiles,
      coverage,
      ai_enhanced: !!(i as any).ai && errors.length === 0,
      criticalTestAreas: projectStructure?.testCoverage?.missingTestAreas || [],
      securityFocus: projectStructure?.securityConcerns || []
    };
    
    return { ok: errors.length === 0, outputs, errors, started_at, completed_at: new Date().toISOString(), version: this.version };
  },
  async verifyOutputs(r) { return !!(r.outputs && (r.outputs as any).coverageGaps); }
};
