import path from "node:path";
import fs from "fs-extra";
import { SOP, SOPInputs, SOPResult } from "../types.js";
import { step, ProgressHook } from "../utils/stepHelper.js";
import { exec as _exec } from "node:child_process";
import { promisify } from "node:util";
import { loadConfig } from "../services/configService.js";
import { logger } from "../utils/logger.js";
import { recordExecuteTimeout } from "../services/metrics.js";
import { SandboxProvisioner, ToolchainInfo } from "../services/sandboxProvisioner.js";
import { InsightGenerator } from "../services/insightGenerator.js";
import { runCmdLogged } from "../services/cmdLog.js";
import { writeAutoInsights } from "../services/insightAutoWriter.js";
import { checkSourceMutation, createSourceSentinel, removeSourceSentinel, shouldEnableHardhatCoverage } from "../services/safetyGuards.js";
import { createMutationBaseline, verifySourceIntegrity } from "../services/sourceMutationSentry.js";
import { getClaudeCaps, isClaudeSandboxReady } from "../services/ai/claudeCaps.js";

const execp = promisify(_exec);
const log = logger.child({ sop: 'executeEnhanced' });

export const executeEnhancedSOP: SOP = {
  name: "executeEnhanced",
  version: "2.0.0",
  prerequisites: ["bootstrap", "inventory", "analysis", "testgen"],
  
  async validateInputs(i) { 
    return !!i.projectPath && !!i.runsPath; 
  },
  
  async verifyOutputs(outputs) {
    return !!(outputs && outputs.outputs && 
      (outputs.outputs as any).sandboxPath && 
      (outputs.outputs as any).executionResults);
  },
  
  async execute(i: SOPInputs, onProgress?: ProgressHook): Promise<SOPResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const timestamp = (i.timestamp as string) ?? new Date().toISOString().replace(/[:.]/g, "-");
    const runPath = path.join(i.runsPath as string, timestamp);
    
    log.info('Enhanced Execute SOP starting', { 
      projectPath: i.projectPath,
      runPath,
      timestamp
    });

    // Initialize services
    const defaultProgress: ProgressHook = async () => {};
    const sandboxProvisioner = new SandboxProvisioner(runPath, onProgress || defaultProgress);
    const insightGenerator = new InsightGenerator(runPath);
    
    let sandboxPath: string;
    let toolchain: ToolchainInfo;
    let executionResults = {
      sandboxProvisioned: false,
      dependenciesInstalled: false,
      compilationSucceeded: false,
      testsExecuted: false,
      coverageCollected: false
    };

    try {
      // Create source mutation baseline (fast tree hash)
      const mutationBaseline = await createMutationBaseline(i.projectPath as string);
      
      // Create source mutation sentinel (traditional approach)
      await createSourceSentinel(i.projectPath as string);
      
      // SOP-10: Sandbox Provision
      onProgress?.({ phase: "execute", step: "sandbox-provision", pct: 10 });
      sandboxPath = await sandboxProvisioner.provision(i.projectPath as string, parseInt(timestamp.replace(/-/g, '')));
      
      const manifest = await fs.readJson(path.join(sandboxPath, 'manifest.json'));
      toolchain = manifest.toolchain;
      executionResults.sandboxProvisioned = true;
      
      log.info("Sandbox provisioned successfully", { 
        sandboxPath, 
        framework: toolchain.detectedFramework 
      });

      // SOP-20: Dependencies Materialization
      if (toolchain.hasNode || toolchain.hasHardhat) {
        onProgress?.({ phase: "execute", step: "deps-install", pct: 30 });
        await installNodeDependencies(sandboxPath, insightGenerator);
        executionResults.dependenciesInstalled = true;
      }

      // SOP-30: Compile
      onProgress?.({ phase: "execute", step: "compile", pct: 50 });
      const compileSuccess = await compileProject(sandboxPath, toolchain, insightGenerator);
      executionResults.compilationSucceeded = compileSuccess;

      // SOP-40: Test Execution
      onProgress?.({ phase: "execute", step: "run-tests", pct: 70 });
      const testResults = await runTests(sandboxPath, toolchain, insightGenerator);
      executionResults.testsExecuted = testResults.executed;

      // SOP-70: Coverage Harvest (best effort)
      onProgress?.({ phase: "execute", step: "coverage", pct: 85 });
      const coverage = await harvestCoverage(sandboxPath, toolchain, insightGenerator, i);
      executionResults.coverageCollected = coverage.collected;

      // Check for source mutations using fast tree hash (SOP compliance check)
      const integrityCheck = await verifySourceIntegrity(
        i.projectPath as string, 
        mutationBaseline!,
        async (mutationResult) => {
          // Auto-generate insight for mutation detection
          await writeAutoInsights(runPath, {
            cmd: 'mutation-check',
            exitCode: null,
            stdout: '',
            stderr: 'Source tree changed during run',
            toolchain,
            repo: { projectPath: i.projectPath as string, sandboxPath }
          });
          
          await insightGenerator.addInsight({
            area: 'Security',
            summary: 'Source code mutation detected during execution',
            evidence: { 
              additionalContext: mutationResult,
              logExcerpt: `Hash changed: ${mutationResult.beforeHash.substring(0, 12)}... → ${mutationResult.afterHash.substring(0, 12)}...`
            },
            rootCause: 'SOP violation: execution modified source repository',
            suggestedRemediation: {
              preferred: 'Review execution logs and ensure SOPs maintain read-only source policy'
            },
            priority: 'Critical'
          });
        }
      );
      
      if (!integrityCheck) {
        log.error('SOURCE MUTATION DETECTED - SOP VIOLATION');
      }

      // Generate final insights
      await insightGenerator.writeInsightsToFile();
      
      onProgress?.({ phase: "execute", step: "complete", pct: 100 });

      return {
        success: errors.length === 0,
        error: errors.length > 0 ? errors.join('; ') : undefined,
        duration: Date.now() - startTime,
        outputs: {
          sandboxPath,
          toolchain: toolchain.detectedFramework,
          executionResults,
          insights: insightGenerator.getInsights(),
          coverage: coverage.data
        }
      };

    } catch (error) {
      log.error('Enhanced Execute SOP failed', { error: String(error) });
      
      await insightGenerator.addInsight({
        area: 'Build',
        summary: 'Critical execution failure',
        evidence: { 
          logExcerpt: String(error),
          additionalContext: { executionResults }
        },
        rootCause: 'Unexpected error during sandbox execution',
        suggestedRemediation: {
          preferred: 'Check logs for specific failure points and system resources'
        },
        priority: 'Critical'
      });

      await insightGenerator.writeInsightsToFile();

      return {
        success: false,
        error: String(error),
        duration: Date.now() - startTime,
        outputs: {
          executionResults,
          insights: insightGenerator.getInsights()
        }
      };
    } finally {
      // Remove source mutation sentinel
      try {
        await removeSourceSentinel(i.projectPath as string);
      } catch (sentinelError) {
        log.warn('Failed to remove source sentinel', { error: sentinelError });
      }

      // Cleanup sandbox if configured
      if (process.env.UATU_CLEANUP_SANDBOX === 'true') {
        try {
          if (sandboxPath!) {
            await fs.remove(sandboxPath);
            log.info('Sandbox cleaned up', { sandboxPath });
          }
        } catch (cleanupError) {
          log.warn('Failed to cleanup sandbox', { error: cleanupError });
        }
      }
    }
  }
};

async function installNodeDependencies(sandboxPath: string, insights: InsightGenerator): Promise<void> {
  log.info('Installing Node dependencies', { sandboxPath });

  const hasPackageLock = await fs.pathExists(path.join(sandboxPath, 'package-lock.json'));
  const hasYarnLock = await fs.pathExists(path.join(sandboxPath, 'yarn.lock'));
  const hasPnpmLock = await fs.pathExists(path.join(sandboxPath, 'pnpm-lock.yaml'));

  let installCmd: string;
  if (hasPnpmLock) {
    installCmd = 'pnpm install --frozen-lockfile';
  } else if (hasYarnLock) {
    installCmd = 'yarn install --frozen-lockfile';
  } else if (hasPackageLock) {
    installCmd = 'npm ci --silent --no-progress';
  } else {
    installCmd = 'npm install --silent --no-progress';
  }

  try {
    await retryOperation(async () => {
      const output = await runCmdLogged(sandboxPath, 'bash', ['-c', installCmd]);
      log.info('Dependencies installed successfully');
      return output;
    }, 1); // 1 retry for network issues
  } catch (error: any) {
    log.error('Dependency installation failed', { error: String(error) });
    
    // Generate auto-insights from error patterns
    await writeAutoInsights(path.dirname(sandboxPath), {
      cmd: installCmd,
      exitCode: error.code || 1,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || String(error),
      toolchain: { hasNode: true }
    });
    
    await insights.addDependencyFailure(installCmd, error.code || 1, error.message || String(error), 'node');
  }
}

async function compileProject(sandboxPath: string, toolchain: ToolchainInfo, insights: InsightGenerator): Promise<boolean> {
  log.info('Compiling project', { framework: toolchain.detectedFramework });

  try {
    if (toolchain.hasFoundry) {
      await runCmdLogged(sandboxPath, 'forge', ['build']);
      log.info('Foundry compilation successful');
    } else if (toolchain.hasHardhat) {
      await runCmdLogged(sandboxPath, 'npx', ['hardhat', 'compile']);
      log.info('Hardhat compilation successful');
    } else if (toolchain.hasAnchor) {
      await runCmdLogged(sandboxPath, 'anchor', ['build']);
      log.info('Anchor compilation successful');
    } else if (toolchain.hasSoroban) {
      await runCmdLogged(sandboxPath, 'soroban', ['contract', 'build']);
      log.info('Soroban compilation successful');
    } else {
      log.info('No compilation needed - no smart contract framework detected');
      return true;
    }
    return true;
  } catch (error: any) {
    log.error('Compilation failed', { error: String(error) });
    const framework = toolchain.detectedFramework || 'unknown';
    
    // Generate auto-insights from compilation errors
    await writeAutoInsights(path.dirname(sandboxPath), {
      cmd: `${framework} compile`,
      exitCode: error.code || 1,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || String(error),
      toolchain
    });
    
    await insights.addCompileFailure(
      `${framework} compile`,
      error.code || 1,
      error.stderr || error.message || String(error),
      framework
    );
    return false;
  }
}

async function runTests(sandboxPath: string, toolchain: ToolchainInfo, insights: InsightGenerator): Promise<{ executed: boolean, results?: any }> {
  log.info('Running tests', { framework: toolchain.detectedFramework });

  try {
    let testOutput: string;
    
    if (toolchain.hasFoundry) {
      testOutput = await runCmdLogged(sandboxPath, 'forge', ['test', '-vvv']);
    } else if (toolchain.hasHardhat) {
      testOutput = await runCmdLogged(sandboxPath, 'npx', ['hardhat', 'test']);
    } else if (toolchain.hasAnchor) {
      testOutput = await runCmdLogged(sandboxPath, 'anchor', ['test']);
    } else if (toolchain.hasSoroban) {
      testOutput = await runCmdLogged(sandboxPath, 'soroban', ['contract', 'test']);
    } else if (toolchain.hasNode) {
      testOutput = await runCmdLogged(sandboxPath, 'npm', ['test', '--silent']);
    } else {
      log.info('No tests to run - no test framework detected');
      return { executed: false };
    }

    log.info('Tests executed successfully');
    return { executed: true, results: { output: testOutput } };
  } catch (error: any) {
    log.error('Test execution failed', { error: String(error) });
    const framework = toolchain.detectedFramework || 'unknown';
    
    // Generate auto-insights from test failures
    await writeAutoInsights(path.dirname(sandboxPath), {
      cmd: `${framework} test`,
      exitCode: error.code || 1,
      stdout: error.stdout || '',
      stderr: error.stderr || error.message || String(error),
      toolchain
    });
    
    await insights.addTestFailure(
      `${framework} test`,
      error.code || 1,
      error.stderr || error.message || String(error),
      framework
    );
    return { executed: false };
  }
}

async function harvestCoverage(sandboxPath: string, toolchain: ToolchainInfo, insights: InsightGenerator, inputs: SOPInputs): Promise<{ collected: boolean, data?: any }> {
  log.info('Harvesting coverage', { framework: toolchain.detectedFramework });

  try {
    let coverageData: any = {};

    if (toolchain.hasFoundry) {
      try {
        await runCmdLogged(sandboxPath, 'forge', ['coverage']);
        const coverageFile = path.join(sandboxPath, 'coverage.txt');
        if (await fs.pathExists(coverageFile)) {
          const coverageText = await fs.readFile(coverageFile, 'utf8');
          coverageData.foundry = coverageText;
        }
      } catch (coverageError) {
        log.debug('Foundry coverage failed (non-critical)', { error: coverageError });
      }
    }

    if (toolchain.hasHardhat && shouldEnableHardhatCoverage() && !isFeatureDisabled(inputs, 'coverage')) {
      try {
        // Use safe extglob approach for coverage
        await runCmdLogged(sandboxPath, 'bash', [
          '-lc', 
          'shopt -s extglob; npx hardhat coverage --testfiles "test/!(excludeDir)/**/*.ts"'
        ]);
        
        const coverageSummaryPath = path.join(sandboxPath, 'coverage', 'coverage-summary.json');
        if (await fs.pathExists(coverageSummaryPath)) {
          coverageData.hardhat = await fs.readJson(coverageSummaryPath);
        }
      } catch (coverageError: any) {
        log.debug('Hardhat coverage failed (non-critical)', { error: coverageError });
        
        // Generate auto-insights for coverage failures
        await writeAutoInsights(path.dirname(sandboxPath), {
          cmd: 'npx hardhat coverage',
          exitCode: coverageError.code || 1,
          stdout: coverageError.stdout || '',
          stderr: coverageError.stderr || coverageError.message || String(coverageError),
          toolchain
        });
        
        await insights.addCoverageIssue('Hardhat coverage collection failed', { error: String(coverageError) });
      }
    } else if (toolchain.hasHardhat && !shouldEnableHardhatCoverage()) {
      log.info('Hardhat coverage disabled via UATU_HARDHAT_COVERAGE=0');
    } else if (toolchain.hasHardhat && isFeatureDisabled(inputs, 'coverage')) {
      log.info('Hardhat coverage disabled for this run');
      await insights.addCoverageIssue('Coverage disabled for this execution', { reason: 'per-run configuration' });
    }

    const hasCoverage = Object.keys(coverageData).length > 0;
    if (hasCoverage) {
      // Normalize coverage data
      const normalizedCoverage = normalizeCoverage(coverageData);
      await fs.writeJson(path.join(sandboxPath, '..', 'coverage.norm.json'), normalizedCoverage, { spaces: 2 });
      log.info('Coverage data collected and normalized');
    } else {
      await insights.addCoverageIssue('No coverage data collected', { toolchain: toolchain.detectedFramework });
    }

    return { collected: hasCoverage, data: coverageData };
  } catch (error) {
    log.error('Coverage harvest failed', { error: String(error) });
    await insights.addCoverageIssue('Coverage harvest failed', { error: String(error) });
    return { collected: false };
  }
}

function normalizeCoverage(coverageData: any): any {
  const normalized = {
    statements: { pct: 0, covered: 0, total: 0 },
    branches: { pct: 0, covered: 0, total: 0 },
    functions: { pct: 0, covered: 0, total: 0 },
    lines: { pct: 0, covered: 0, total: 0 }
  };

  if (coverageData.hardhat?.total) {
    const total = coverageData.hardhat.total;
    normalized.statements = total.statements || normalized.statements;
    normalized.branches = total.branches || normalized.branches;
    normalized.functions = total.functions || normalized.functions;
    normalized.lines = total.lines || normalized.lines;
  }

  if (coverageData.foundry && typeof coverageData.foundry === 'string') {
    // Parse Foundry coverage text format
    const match = coverageData.foundry.match(/(\d+\.?\d*)%/);
    if (match) {
      const pct = parseFloat(match[1]);
      normalized.statements.pct = pct;
      normalized.lines.pct = pct;
    }
  }

  return normalized;
}

function isFeatureDisabled(inputs: SOPInputs, feature: string): boolean {
  // Check if specific feature is disabled for this run
  const options = inputs.options as any;
  if (options && typeof options === 'object') {
    return options[feature] === false;
  }
  return false;
}

async function retryOperation<T>(operation: () => Promise<T>, maxRetries: number): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        const delay = Math.min(30000, 1000 * Math.pow(2, attempt)); // Exponential backoff, max 30s
        log.warn(`Operation failed, retrying in ${delay}ms`, { 
          attempt: attempt + 1, 
          maxRetries, 
          error: String(error) 
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
