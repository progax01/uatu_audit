import Anthropic from "@anthropic-ai/sdk";
import path from "node:path";
import fs from "fs-extra";
import { z } from "zod";
import { logger } from "../../utils/logger.js";
import { writeAutoInsights } from "../insightAutoWriter.js";

const log = logger.child({ service: 'ai-refiner' });

// Strict schema for refined test outputs
const RefineOutput = z.object({
  success: z.boolean().default(true),
  replacements: z.array(z.object({
    path: z.string().min(3).max(180), // e.g., "hardhat/ai/Contract.spec.ts"
    language: z.enum(["solidity", "typescript", "javascript", "rust"]),
    content: z.string().min(1).max(200_000), // full-file replacement
    description: z.string().optional(),
    type: z.enum(["test", "spec", "fixture"]).default("test")
  })).max(parseInt(process.env.UATU_AI_REFINE_MAX_FILES || "8", 10)),
  summary: z.string().optional(),
  improvements: z.array(z.string()).optional()
});

export type RefineResult = z.infer<typeof RefineOutput>;

export interface AiFailure {
  file: string;
  name: string;
  message: string;
  stack?: string;
  toolchain: 'hardhat' | 'foundry' | 'jest' | 'anchor' | 'unknown';
}

function sanitizeText(text = "", maxBytes = 65_536, sandboxAbs?: string): string {
  let s = text;
  
  // Remove sensitive paths
  if (sandboxAbs) {
    const safe = sandboxAbs.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s.replace(new RegExp(safe, "g"), "<SANDBOX>");
  }
  
  // Remove common noise patterns
  s = s.replace(/\x1b\[[0-9;]*m/g, ''); // ANSI colors
  s = s.replace(/at .+\(.+:\d+:\d+\)/g, ''); // Stack traces
  s = s.replace(/\s{3,}/g, ' '); // Collapse whitespace
  s = s.replace(/\n{3,}/g, '\n\n'); // Collapse newlines
  
  // Cap to max bytes
  const buf = Buffer.from(s, "utf8");
  return buf.length <= maxBytes ? s : buf.subarray(0, maxBytes).toString("utf8") + "...[truncated]";
}

/**
 * Enhanced Anthropic API provider with strict JSON mode and chunked prompts
 */
export class AnthropicRefiner {
  private client: Anthropic;
  private model: string;
  private timeout: number;
  private maxLogBytes: number;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required for AI refinement");
    }

    this.client = new Anthropic({ apiKey });
    this.model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20240620";
    this.timeout = parseInt(process.env.UATU_AI_REFINE_TIMEOUT_MS || "180000", 10);
    this.maxLogBytes = parseInt(process.env.UATU_AI_REFINE_MAX_LOG_BYTES || "65536", 10);
  }

  /**
   * Refine AI tests based on failure analysis with chunked, structured prompts
   */
  async refineTests(params: {
    runPath: string;
    projectPath: string;
    sandbox: string;
    repoTree: string;
    inventory: any;
    analysis: any;
    failures: AiFailure[];
  }): Promise<{ count: number; outDir: string; summary: string }> {
    const { runPath, projectPath, sandbox, repoTree, inventory, analysis, failures } = params;
    
    log.info("Starting AI test refinement", {
      failuresCount: failures.length,
      model: this.model,
      timeout: this.timeout
    });

    // Group failures by toolchain for focused refinement
    const groupedFailures = this.groupFailuresByToolchain(failures);
    const allReplacements: RefineResult['replacements'] = [];
    
    // Process each toolchain separately for better context
    for (const [toolchain, toolchainFailures] of Object.entries(groupedFailures)) {
      if (toolchainFailures.length === 0) continue;
      
      try {
        const result = await this.refineForToolchain({
          toolchain: toolchain as any,
          failures: toolchainFailures,
          repoTree: this.trimRepoTree(repoTree),
          inventory: this.trimInventory(inventory),
          analysis: this.trimAnalysis(analysis),
          runPath,
          sandbox
        });
        
        allReplacements.push(...result.replacements);
      } catch (error) {
        log.error(`Failed to refine ${toolchain} tests`, { error: String(error) });
        
        await writeAutoInsights(runPath, {
          cmd: `ai-refine-${toolchain}`,
          exitCode: null,
          stderr: `Failed to refine ${toolchain} tests: ${error}`,
          toolchain: { [toolchain === 'hardhat' ? 'hasHardhat' : 'hasFoundry']: true }
        });
      }
    }

    // Write refined tests to safe location
    const outDir = await this.writeRefinedTests(projectPath, allReplacements);
    
    // Save refinement metadata
    await fs.writeJson(path.join(runPath, "ai_refine.json"), {
      provider: "anthropic-api",
      model: this.model,
      elapsedMs: Date.now(),
      files: allReplacements.map(r => r.path),
      improvements: allReplacements.map(r => r.description).filter(Boolean),
      toolchains: Object.keys(groupedFailures)
    }, { spaces: 2 });

    const summary = `Refined ${allReplacements.length} test files across ${Object.keys(groupedFailures).length} toolchains`;
    
    log.info("AI test refinement completed", {
      filesRefined: allReplacements.length,
      toolchains: Object.keys(groupedFailures),
      outputDir: outDir
    });

    return {
      count: allReplacements.length,
      outDir,
      summary
    };
  }

  private groupFailuresByToolchain(failures: AiFailure[]): Record<string, AiFailure[]> {
    const groups: Record<string, AiFailure[]> = {
      hardhat: [],
      foundry: [],
      jest: [],
      anchor: []
    };

    for (const failure of failures) {
      if (groups[failure.toolchain]) {
        groups[failure.toolchain].push(failure);
      } else {
        groups.unknown = groups.unknown || [];
        groups.unknown.push(failure);
      }
    }

    return groups;
  }

  private async refineForToolchain(params: {
    toolchain: string;
    failures: AiFailure[];
    repoTree: string;
    inventory: any;
    analysis: any;
    runPath: string;
    sandbox: string;
  }): Promise<RefineResult> {
    const { toolchain, failures, repoTree, inventory, analysis, runPath, sandbox } = params;
    
    // Create focused, toolchain-specific prompt
    const prompt = this.buildRefinementPrompt({
      toolchain,
      failures: failures.slice(0, 16), // Limit to prevent token overflow
      repoTree,
      inventory,
      analysis
    });

    const startTime = Date.now();
    
    try {
      // Use Anthropic SDK with explicit JSON request
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4000,
        temperature: 0.1, // Low temperature for consistent code generation
        system: this.getSystemPrompt(toolchain),
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });

      const responseText = response.content
        .filter((c): c is Anthropic.TextBlock => c.type === 'text')
        .map(c => c.text)
        .join('\n');

      // Parse with multiple strategies for robustness
      const parsed = await this.parseRefinementResponse(responseText, runPath);
      
      log.info(`${toolchain} refinement completed`, {
        elapsedMs: Date.now() - startTime,
        replacements: parsed.replacements.length,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      });

      return parsed;

    } catch (error) {
      log.error(`Anthropic API call failed for ${toolchain}`, { error: String(error) });
      throw error;
    }
  }

  private getSystemPrompt(toolchain: string): string {
    const commonInstructions = [
      "You are a senior smart contract security auditor and test engineer.",
      "Your task is to fix and improve failing AI-generated tests.",
      "CRITICAL: Respond with ONLY valid JSON matching the exact schema shown in the user prompt.",
      "Never modify source code - only create test files in designated test directories.",
      "Make tests compile, pass, and provide meaningful security coverage."
    ];

    const toolchainSpecific = {
      hardhat: [
        "Generate TypeScript test files using Hardhat framework.",
        "Use ethers.js v6 syntax, Chai assertions, and proper async/await patterns.",
        "Include proper imports: ethers, hardhat, chai expect.",
        "Focus on access control, state transitions, and edge cases."
      ],
      foundry: [
        "Generate Solidity test files using Foundry framework.",
        "Use forge-std/Test.sol, vm cheats, and assertEq/assertRevert patterns.",
        "Include proper imports: forge-std/Test.sol, relevant contracts.",
        "Focus on fuzzing, invariants, and gas optimization tests."
      ],
      jest: [
        "Generate TypeScript/JavaScript test files using Jest framework.",
        "Use Jest syntax with describe/it blocks and proper expect assertions.",
        "Include proper imports and setup for the testing environment.",
        "Focus on unit tests and integration scenarios."
      ],
      anchor: [
        "Generate TypeScript test files using Anchor framework.",
        "Use @coral-xyz/anchor, web3.js, and Solana test patterns.",
        "Include proper program initialization and account management.",
        "Focus on instruction testing and account validation."
      ]
    };

    return [
      ...commonInstructions,
      ...(toolchainSpecific[toolchain as keyof typeof toolchainSpecific] || toolchainSpecific.hardhat)
    ].join(" ");
  }

  private buildRefinementPrompt(params: {
    toolchain: string;
    failures: AiFailure[];
    repoTree: string;
    inventory: any;
    analysis: any;
  }): string {
    const { toolchain, failures, repoTree, inventory, analysis } = params;

    // Sanitize failures for prompt
    const sanitizedFailures = failures.map(f => ({
      file: f.file,
      name: f.name,
      message: sanitizeText(f.message, this.maxLogBytes)
    }));

    return `# Test Refinement Request: ${toolchain.toUpperCase()}

## Project Context (Trimmed)
**Repository Structure:**
${repoTree}

**Contract Inventory:**
${JSON.stringify(this.trimInventory(inventory), null, 2)}

**Analysis Summary:**
${JSON.stringify(this.trimAnalysis(analysis), null, 2)}

## Test Failures to Fix
${JSON.stringify(sanitizedFailures, null, 2)}

## Request
Fix the failing ${toolchain} tests by generating complete, working replacements.

**Requirements:**
- Create compilable, executable test files
- Fix import issues, syntax errors, and missing dependencies
- Add proper setup/teardown and test structure
- Include meaningful assertions and edge cases
- Keep files focused and under 150 lines each

**Path Convention:**
- Hardhat: \`hardhat/ai/ContractName.spec.ts\`
- Foundry: \`foundry/ai/ContractName.t.sol\`
- Jest: \`jest/ai/ContractName.test.ts\`
- Anchor: \`anchor/ai/ProgramName.test.ts\`

**Response Format (CRITICAL - EXACT JSON ONLY):**
\`\`\`json
{
  "success": true,
  "replacements": [
    {
      "path": "hardhat/ai/Example.spec.ts",
      "language": "typescript",
      "content": "import { expect } from \\"chai\\";\\nimport { ethers } from \\"hardhat\\";\\n\\ndescribe(\\"Example Tests\\", function() {\\n  it(\\"should work\\", async function() {\\n    expect(true).to.be.true;\\n  });\\n});",
      "description": "Fixed import and assertion issues",
      "type": "test"
    }
  ],
  "summary": "Fixed compilation and runtime errors in test files"
}
\`\`\`

Generate 1-3 focused, high-quality test files that address the main failure patterns.`;
  }

  private async parseRefinementResponse(response: string, runPath: string): Promise<RefineResult> {
    // Strategy 1: Look for JSON code blocks
    let jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    
    if (!jsonMatch) {
      // Strategy 2: Look for any JSON-like structure
      jsonMatch = response.match(/\{[\s\S]*"replacements"[\s\S]*\]/);
    }

    if (!jsonMatch) {
      // Strategy 3: Try to extract from any braces
      const start = response.indexOf('{');
      const end = response.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        jsonMatch = [response.substring(start, end + 1)];
      }
    }

    if (!jsonMatch) {
      throw new Error("No JSON structure found in Anthropic response");
    }

    let jsonText = Array.isArray(jsonMatch) ? jsonMatch[1] || jsonMatch[0] : jsonMatch;
    
    // Clean up common JSON issues
    jsonText = jsonText
      .replace(/,\s*}/g, '}')  // Remove trailing commas
      .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .trim();

    try {
      const parsed = JSON.parse(jsonText);
      const validated = RefineOutput.parse(parsed);
      return validated;
    } catch (parseError) {
      // Save debug info
      await fs.writeFile(
        path.join(runPath, 'ai_refine_debug.txt'), 
        `Original Response:\n${response}\n\nExtracted JSON:\n${jsonText}\n\nError: ${parseError}`,
        'utf8'
      );
      
      log.error("Failed to parse refinement response", { 
        error: String(parseError),
        responseLength: response.length,
        debugFile: path.join(runPath, 'ai_refine_debug.txt')
      });
      
      throw new Error(`Failed to parse Anthropic response: ${parseError}`);
    }
  }

  private async writeRefinedTests(projectPath: string, replacements: RefineResult['replacements']): Promise<string> {
    const outDir = path.join(projectPath, ".uatu", "ai_tests_refined");
    await fs.ensureDir(outDir);

    for (const replacement of replacements) {
      try {
        const destPath = path.join(outDir, replacement.path);
        
        // Security: ensure path is within our directory
        if (!destPath.startsWith(outDir)) {
          log.warn("Skipping replacement with invalid path", { path: replacement.path });
          continue;
        }

        // Validate file extension
        const ext = path.extname(destPath).toLowerCase();
        const validExtensions = ['.ts', '.tsx', '.js', '.jsx', '.sol', '.rs'];
        if (!validExtensions.includes(ext)) {
          log.warn("Skipping replacement with invalid extension", { path: replacement.path, ext });
          continue;
        }

        // Ensure directory exists
        await fs.ensureDir(path.dirname(destPath));
        
        // Write file with size limit
        const content = replacement.content.slice(0, 200_000); // 200KB max
        await fs.writeFile(destPath, content, 'utf8');
        
        log.debug("Wrote refined test file", { 
          path: replacement.path, 
          language: replacement.language,
          size: content.length 
        });
        
      } catch (error) {
        log.error("Failed to write refined test file", { 
          path: replacement.path,
          error: String(error) 
        });
      }
    }

    return outDir;
  }

  private trimRepoTree(tree: string): string {
    // Keep only essential structure, remove deep nesting
    const lines = tree.split('\n').slice(0, 50); // First 50 lines
    return lines.join('\n');
  }

  private trimInventory(inventory: any): any {
    if (!inventory || typeof inventory !== 'object') return {};
    
    return {
      solidity: Object.fromEntries(
        Object.entries(inventory.solidity || {}).slice(0, 10)
      ),
      totalContracts: Object.keys(inventory.solidity || {}).length,
      ecosystems: inventory.ecosystems || []
    };
  }

  private trimAnalysis(analysis: any): any {
    if (!analysis || typeof analysis !== 'object') return {};
    
    return {
      securityFindings: (analysis.securityFindings || []).slice(0, 5),
      totalFindings: (analysis.securityFindings || []).length,
      riskLevel: analysis.riskLevel || 'unknown',
      summary: analysis.summary || ''
    };
  }
}

/**
 * Factory function for creating refiner instance
 */
export async function createAiRefiner(): Promise<AnthropicRefiner> {
  return new AnthropicRefiner();
}

/**
 * Main refinement function for external use
 */
export async function refineAiTestsWithAnthropic(params: {
  runPath: string;
  projectPath: string;
  sandbox: string;
  repoTree: string;
  inventory: any;
  analysis: any;
  failures: AiFailure[];
}): Promise<{ count: number; outDir: string; summary: string }> {
  const refiner = await createAiRefiner();
  return refiner.refineTests(params);
}
