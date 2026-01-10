import path from "node:path";
import fs from "fs-extra";
import { SOP, SOPInputs, SOPResult } from "../types.js";
import { step, ProgressHook } from "../utils/stepHelper.js";
import { analyzeProjectStructure, generateProjectSummary } from "../services/projectAnalyzer.js";
import { createLiveLogger } from "../services/liveLogger.js";
import { EcosystemDetector } from "../services/ecosystemDetector.js";
import { analyzeStructure } from "./structureAnalyzer.js";
import { inspectDependencies } from "./dependencyInspector.js";

export const bootstrapSOP: SOP = {
  name: "bootstrap",
  version: "1.0.1",
  prerequisites: [],
  async validateInputs(i) { return !!(i.projectPath && i.contextPath); },
  async execute(i: SOPInputs, onProgress?: ProgressHook): Promise<SOPResult> {
    const started_at = new Date().toISOString();
    const errors: string[] = [];
    const runPath = path.join(i.runsPath as string, i.timestamp as string);
    const liveLogger = createLiveLogger(runPath, 'cli');

    liveLogger.info('Bootstrap SOP starting', { projectPath: i.projectPath });

    await step(onProgress, { phase: "m1_context", step: "project-detection", pct: 10 });

    // Smart ecosystem detection
    liveLogger.info('Detecting project ecosystems...');
    const ecosystemDetection = await EcosystemDetector.detectEcosystems(i.projectPath as string);

    // Shell-based structure analysis (fast, deterministic)
    liveLogger.info('Running shell-based structure analysis...');
    const shellStructure = await analyzeStructure(i.projectPath as string);

    // Dependency inspection
    liveLogger.info('Inspecting dependencies...');
    const dependencyReport = await inspectDependencies(i.projectPath as string);

    // Comprehensive project structure analysis (FS-based, detailed)
    liveLogger.info('Analyzing project structure...');
    const projectStructure = await analyzeProjectStructure(i.projectPath as string);

    await step(onProgress, { phase: "m1_context", step: "dependency-fingerprint", pct: 25 });

    // Generate project summary
    const projectSummary = await generateProjectSummary(projectStructure);
    liveLogger.info('Project analysis completed', {
      detectedEcosystems: ecosystemDetection.primary,
      secondaryEcosystems: ecosystemDetection.secondary,
      recommendation: ecosystemDetection.recommendation,
      totalFiles: projectStructure.totalFiles,
      hasTests: projectStructure.testCoverage.hasTests,
      shellFileCount: shellStructure.fileCount,
      importEdges: shellStructure.importGraph.length,
      knownDeps: dependencyReport.summary.known,
      unknownDeps: dependencyReport.summary.unknown
    });

    await step(onProgress, { phase: "m1_context", step: "context-built", pct: 40 });

    // Ensure context and SOP directories exist
    await fs.ensureDir(i.contextPath as string);
    await fs.ensureDir(path.join(i.projectPath as string, ".uatu", "sop"));

    // Write comprehensive analysis to context
    await fs.writeJson(path.join(i.contextPath as string, "project-structure.json"), projectStructure);
    await fs.writeJson(path.join(i.contextPath as string, "ecosystem-detection.json"), ecosystemDetection);
    await fs.writeJson(path.join(i.contextPath as string, "shell-structure.json"), shellStructure);
    await fs.writeJson(path.join(i.contextPath as string, "dependency-report.json"), dependencyReport);
    await fs.writeFile(path.join(i.contextPath as string, "project-summary.md"), projectSummary);

    // Enhanced fingerprint combining both detection methods
    const fingerprint = {
      ecosystems: ecosystemDetection.primary.length > 0 ? ecosystemDetection.primary : projectStructure.ecosystems,
      detectedEcosystems: ecosystemDetection.primary,
      secondaryEcosystems: ecosystemDetection.secondary,
      recommendation: ecosystemDetection.recommendation,
      totalFiles: projectStructure.totalFiles,
      hasTests: projectStructure.testCoverage.hasTests,
      securityConcerns: projectStructure.securityConcerns.length,
      confidence: ecosystemDetection.signatures.reduce((sum, s) => sum + s.confidence, 0) / ecosystemDetection.signatures.length || 0,
      // Shell-based additions
      importGraphSize: shellStructure.importGraph.length,
      entryPoints: shellStructure.entryPoints,
      shellEcosystem: shellStructure.ecosystem,
      // Dependency additions
      knownDeps: dependencyReport.summary.known,
      unknownDeps: dependencyReport.summary.unknown,
      securityLibs: dependencyReport.securityLibraries.map(d => d.name),
    };
    await fs.writeJson(path.join(i.contextPath as string, "fingerprint.json"), fingerprint);
    await fs.writeFile(path.join(i.projectPath as string, ".uatu", "sop", "done.marker"), "bootstrap\n");

    await step(onProgress, { phase: "m1_context", step: "ready-marked", pct: 50 });

    liveLogger.info('Bootstrap SOP completed successfully');

    const outputs = {
      ready: ecosystemDetection.primary.length > 0 || projectStructure.ecosystems.length > 0,
      fingerprint,
      projectStructure,
      ecosystemDetection,
      shellStructure,
      dependencyReport,
      projectSummary,
      criticalFiles: projectStructure.criticalPaths.length,
      recommendedTests: projectStructure.testCoverage.missingTestAreas
    };

    return {
      ok: errors.length === 0,
      outputs,
      errors,
      started_at,
      completed_at: new Date().toISOString(),
      version: this.version
    };
  },
  async verifyOutputs(r) { return !!(r.outputs && (r.outputs as any).fingerprint); }
};
