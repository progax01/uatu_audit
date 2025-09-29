import path from "node:path";
import fs from "fs-extra";
import fg from "fast-glob";
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
import { runPreflightChecks } from "../services/preflightChecker.js";
import { enforceNodeLTS } from "../services/nodeVersionEnforcer.js";
import { isDockerAvailable, runNodeInContainer, runFoundryInContainer, ensureDockerImage } from "../services/dockerSandboxRunner.js";
import { executeNodeInDocker } from "../services/dockerSandbox.js";
import { copyAiTestsToSandbox, cleanupAiTestsFromSandbox } from "../services/ai/aiCopy.js";
import { runAllAiTestPasses, type AiTestRunResult } from "../services/ai/aiRunners.js";
import { collectAllAiFailures } from "../services/ai/failureCollectors.js";
import { refineAiTestsWithAnthropic } from "../services/ai/aiRefiner.js";
import { isAnyAIProviderAvailable } from "../services/ai/aiProviderSelector.js";

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

      // SOP-15: Preflight Checks & Environment Setup
      onProgress?.({ phase: "execute", step: "preflight-checks", pct: 15 });
      const preflightResults = await runPreflightChecks(sandboxPath, toolchain, runPath);
      
      // Log preflight summary
      log.info("Preflight checks completed", {
        overall: preflightResults.overall,
        nodeVersion: preflightResults.summary.nodeVersion,
        dockerAvailable: preflightResults.summary.dockerAvailable,
        networkTestsFound: preflightResults.summary.networkTestsFound,
        coverageWillRun: preflightResults.summary.coverageWillRun,
        estimatedRuntime: preflightResults.summary.estimatedRuntime
      });

      // Check if Docker should be used
      const useDocker = process.env.UATU_USE_DOCKER === '1' && preflightResults.summary.dockerAvailable;
      const executionMode = useDocker ? 'docker' : 'local';
      
      log.info(`Execution mode selected: ${executionMode}`, {
        dockerAvailable: preflightResults.summary.dockerAvailable,
        nodeVersion: preflightResults.summary.nodeVersion,
        toolchain: toolchain.detectedFramework,
        UATU_USE_DOCKER: process.env.UATU_USE_DOCKER,
        UATU_SANDBOX: process.env.UATU_SANDBOX,
        useDockerCalculation: `${process.env.UATU_USE_DOCKER} === '1' && ${preflightResults.summary.dockerAvailable} = ${useDocker}`
      });

      // If using Docker, ensure required images are available
      if (useDocker) {
        onProgress?.({ phase: "execute", step: "docker-setup", pct: 20 });
        
        if (toolchain.hasFoundry) {
          await ensureDockerImage('ghcr.io/foundry-rs/foundry:latest');
        } else {
          await ensureDockerImage('node:20-bullseye');
        }
      }

      // Enforce Node LTS if using local execution and needed
      if (!useDocker && (toolchain.hasNode || toolchain.hasHardhat)) {
        onProgress?.({ phase: "execute", step: "node-setup", pct: 25 });
        const nodeResult = await enforceNodeLTS(runPath, sandboxPath);
        
        if (!nodeResult.success) {
          log.warn("Could not enforce Node LTS", {
            currentVersion: nodeResult.version,
            method: nodeResult.method,
            error: nodeResult.error
          });
        }
      }

      // SOP-20: Dependencies Materialization
      if (toolchain.hasNode || toolchain.hasHardhat) {
        onProgress?.({ phase: "execute", step: "deps-install", pct: 30 });
        await installNodeDependencies(sandboxPath, insightGenerator, useDocker);
        executionResults.dependenciesInstalled = true;
      }

      // SOP-30: Compile
      onProgress?.({ phase: "execute", step: "compile", pct: 50 });
      const compileSuccess = await compileProject(sandboxPath, toolchain, insightGenerator);
      executionResults.compilationSucceeded = compileSuccess;

      // SOP-35: AI Test Execution (2-pass refinement)
      onProgress?.({ phase: "execute", step: "ai-tests", pct: 65 });
      const aiTestResults = await runAiTestPipeline(i.projectPath as string, runPath, sandboxPath, toolchain, insightGenerator, useDocker);
      (executionResults as any).aiTestsExecuted = aiTestResults.executed;
      (executionResults as any).aiTestsPass1 = aiTestResults.pass1Results;
      (executionResults as any).aiTestsPass2 = aiTestResults.pass2Results;
      (executionResults as any).aiRefinementApplied = aiTestResults.refinementApplied;

      // SOP-40: Test Execution (User Tests) - Optional based on AI-only mode
      const aiTestsOnly = process.env.UATU_RUN_AI_TESTS_ONLY === "1";
      if (!aiTestsOnly) {
        onProgress?.({ phase: "execute", step: "run-tests", pct: 75 });
        const testResults = await runTests(sandboxPath, toolchain, insightGenerator, runPath, useDocker);
        executionResults.testsExecuted = testResults.executed;
      } else {
        log.info('Skipping user tests - AI tests only mode enabled');
        executionResults.testsExecuted = false;
        (executionResults as any).aiTestsOnlyMode = true;
      }

      // SOP-70: Coverage Harvest (best effort) - Skip in AI-only mode for speed
      let coverage: { collected: boolean; data?: any } = { collected: false, data: null };
      if (!aiTestsOnly && process.env.UATU_HARDHAT_COVERAGE !== "0") {
        onProgress?.({ phase: "execute", step: "coverage", pct: 85 });
        coverage = await harvestCoverage(sandboxPath, toolchain, insightGenerator, i);
        executionResults.coverageCollected = coverage.collected;
      } else {
        log.info(aiTestsOnly ? 'Skipping coverage - AI tests only mode' : 'Skipping coverage - disabled');
        executionResults.coverageCollected = false;
        (executionResults as any).coverageSkipped = true;
      }

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

async function installNodeDependencies(sandboxPath: string, insights: InsightGenerator, useDocker: boolean = false): Promise<void> {
  log.info('Installing Node dependencies', { sandboxPath, useDocker });

  if (useDocker) {
    // Use Docker for dependency installation
    try {
      const dockerResult = await executeNodeInDocker("install", sandboxPath);
      log.info('Dependencies installed successfully in Docker', {
        stdout: dockerResult.stdout.substring(0, 200),
        stderr: dockerResult.stderr ? dockerResult.stderr.substring(0, 200) : 'none'
      });
      return;
    } catch (dockerError: any) {
      log.error('Docker dependency installation failed', { error: String(dockerError) });
      await insights.addDependencyFailure('docker install', dockerError.code || 1, dockerError.message || String(dockerError), 'docker');
      throw dockerError;
    }
  }

  // Local installation (fallback or when Docker not enabled)
  log.info('Using local dependency installation', { useDocker: false });

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
      // Force direct hardhat binary usage - no npx fallback
      await runCmdLogged(sandboxPath, './node_modules/.bin/hardhat', ['compile']);
      log.info('Hardhat compilation successful (direct binary)');
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

async function runTests(
  sandboxPath: string, 
  toolchain: ToolchainInfo, 
  insights: InsightGenerator, 
  runPath: string, 
  useDocker: boolean = false
): Promise<{ executed: boolean, results?: any }> {
  log.info('Running tests', { 
    framework: toolchain.detectedFramework, 
    executionMode: useDocker ? 'docker' : 'local' 
  });

  try {
    let testOutput: string;
    
    if (toolchain.hasFoundry) {
      if (useDocker) {
        testOutput = await runFoundryInContainer(runPath, sandboxPath, ['forge test -vvv']);
      } else {
        testOutput = await runCmdLogged(sandboxPath, 'forge', ['test', '-vvv']);
      }
    } else if (toolchain.hasHardhat) {
      // Force explicit file lists to prevent any network test execution
      const includeNetwork = process.env.UATU_INCLUDE_NETWORK_TESTS === "1";
      const userGlobs = includeNetwork
        ? ["test/**/*.ts", "test/**/*.tsx", "test/**/*.js"]
        : [
            "test/**/*.ts",
            "test/**/*.tsx", 
            "test/**/*.js",
            "!test/lineaSepolia/**",
            "!test/mainnet/**",
            "!test/testnet/**",
            "!test/integration/**"
          ];

      const userList = await fg(userGlobs, { cwd: sandboxPath });
      
      if (userList.length > 0) {
        const cmd = `npx hardhat test ${userList.map(f => JSON.stringify(f)).join(" ")}`;
        if (useDocker) {
          testOutput = await runNodeInContainer(runPath, sandboxPath, [cmd]);
        } else {
          testOutput = await runCmdLogged(runPath, 'bash', ['-lc', cmd], { cwd: sandboxPath });
        }
      } else {
        log.info('No test files found after filtering');
        testOutput = 'No tests to run';
      }
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
        await runHardhatCoverage(path.dirname(sandboxPath), sandboxPath, coverageData);
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

async function getNodeMajor(cwd: string): Promise<number> {
  try {
    const out = await runCmdLogged("", "node", ["-p", "process.versions.node.split('.')[0]"], { cwd });
    return parseInt(String(out).trim(), 10);
  } catch { 
    return NaN; 
  }
}

async function runHardhatCoverage(runPath: string, sandbox: string, coverageData: any): Promise<void> {
  const major = await getNodeMajor(sandbox);

  // Gate: skip on Node >= 22
  if (!Number.isFinite(major) || major >= 22) {
    await writeAutoInsights(runPath, {
      cmd: "hardhat coverage",
      exitCode: null,
      stdout: "",
      stderr: `Skipping coverage: Node ${major} unsupported by Hardhat`,
      toolchain: { hasHardhat: true }
    });
    await fs.writeJson(path.join(runPath, 'coverage.norm.json'), { reason: 'unsupported_node', node: major }, { spaces: 2 });
    return;
  }

  // Explicit list (no extglob) and exclude network suites
  const files = await fg([
    "test/**/*.ts", "test/**/*.tsx", "test/**/*.js",
    "!test/lineaSepolia/**", "!test/mainnet/**", "!test/testnet/**", "!test/integration/**"
  ], { cwd: sandbox });

  if (files.length === 0) {
    log.info('No test files found for coverage');
    return;
  }

  const heap = process.env.UATU_NODE_HEAP_MB || "6144";
  const args = ["hardhat", "coverage", ...files.flatMap(f => ["--testfiles", f])];
  const cmd = `export NODE_OPTIONS="--max-old-space-size=${heap}"; npx ${args.map(a => JSON.stringify(a)).join(" ")}`;

  try {
    if (process.env.UATU_USE_DOCKER === '1') {
      await runNodeInContainer(runPath, sandbox, [cmd]);
    } else {
      await runCmdLogged(runPath, "bash", ["-lc", cmd], { cwd: sandbox });
    }

    // Check for coverage results
    const coverageSummaryPath = path.join(sandbox, 'coverage', 'coverage-summary.json');
    if (await fs.pathExists(coverageSummaryPath)) {
      coverageData.hardhat = await fs.readJson(coverageSummaryPath);
    }
  } catch (e: any) {
    await writeAutoInsights(runPath, {
      cmd: "hardhat coverage",
      exitCode: e?.exitCode ?? null,
      stdout: e?.stdout ?? "",
      stderr: e?.stderr ?? String(e),
      toolchain: { hasHardhat: true }
    });
  }
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

/**
 * SOP-35: AI Test Pipeline - 2-pass refinement system
 * 1. Copy AI tests to sandbox
 * 2. Pass 1: Run AI tests, collect failures
 * 3. Refine: Send failures to Anthropic API for fixes
 * 4. Pass 2: Run refined AI tests
 */
async function runAiTestPipeline(
  projectPath: string,
  runPath: string,
  sandboxPath: string,
  toolchain: ToolchainInfo,
  insights: InsightGenerator,
  useDocker: boolean
): Promise<{
  executed: boolean;
  pass1Results: AiTestRunResult[];
  pass2Results: AiTestRunResult[];
  refinementApplied: boolean;
}> {
  const result = {
    executed: false,
    pass1Results: [] as AiTestRunResult[],
    pass2Results: [] as AiTestRunResult[],
    refinementApplied: false
  };

  try {
    // Check if AI tests are available and provider is configured
    const hasAiProvider = await isAnyAIProviderAvailable();
    if (!hasAiProvider && process.env.UATU_AI_REFINE === "1") {
      log.info('AI refinement requested but no provider available');
      await insights.addInsight({
        area: 'Build',
        summary: 'AI refinement requested but no provider configured',
        priority: 'Medium',
        evidence: { additionalContext: { context: 'UATU_AI_REFINE=1 but no provider available' } },
        rootCause: 'UATU_AI_REFINE=1 set but no AI provider configured',
        suggestedRemediation: {
          preferred: 'Configure ANTHROPIC_API_KEY environment variable',
          alternatives: ['Set UATU_AI_REFINE=0 to disable refinement']
        }
      });
      return result;
    }

    // Check if we should run AI tests only
    const aiTestsOnly = process.env.UATU_RUN_AI_TESTS_ONLY === "1";
    if (aiTestsOnly) {
      log.info('Running in AI tests only mode');
    }

    // Copy AI tests to sandbox
    const copyResult = await copyAiTestsToSandbox(projectPath, sandboxPath);
    if (copyResult.copied === 0) {
      log.info('No AI tests found to execute');
      return result;
    }

    log.info('AI tests copied to sandbox', {
      filesCopied: copyResult.copied,
      toolchains: copyResult.toolchains,
      useDocker
    });

    // Determine toolchain order
    const toolchainOrder = (process.env.UATU_AI_TOOL_ORDER || 'hardhat,foundry,jest')
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    // Pass 1: Run AI tests
    log.info('Starting AI test pass 1');
    result.pass1Results = await runAllAiTestPasses(runPath, sandboxPath, "pass1", useDocker, toolchainOrder);
    
    const pass1RanCount = result.pass1Results.filter(r => r.ran).length;
    const pass1SuccessCount = result.pass1Results.filter(r => r.ran && r.ok).length;
    
    log.info('AI test pass 1 completed', {
      toolchainsRan: pass1RanCount,
      successful: pass1SuccessCount,
      failed: pass1RanCount - pass1SuccessCount
    });

    // Check if refinement is enabled and we have failures
    const shouldRefine = process.env.UATU_AI_REFINE === "1" && hasAiProvider;
    const hasFailures = result.pass1Results.some(r => r.ran && !r.ok);

    if (shouldRefine && hasFailures) {
      log.info('Starting AI test refinement');
      
      try {
        // Collect failures from pass 1
        const failures = await collectAllAiFailures(runPath, sandboxPath);
        
        if (failures.length > 0) {
          log.info(`Collected ${failures.length} AI test failures for refinement`);
          
          // Load context for refinement
          const repoTree = await fs.readFile(path.join(runPath, "../..", "context", "tree.txt"), "utf8").catch(() => "");
          const inventory = await fs.readJson(path.join(runPath, "inventory.json")).catch(() => ({}));
          const analysis = await fs.readJson(path.join(runPath, "analysis.json")).catch(() => ({}));

          // Refine with Anthropic API
          const refinementResult = await refineAiTestsWithAnthropic({
            runPath,
            projectPath,
            sandbox: sandboxPath,
            repoTree,
            inventory,
            analysis,
            failures
          });

          result.refinementApplied = refinementResult.count > 0;
          
          log.info('AI test refinement completed', {
            filesRefined: refinementResult.count,
            summary: refinementResult.summary
          });

          if (result.refinementApplied) {
            // Copy refined tests back to sandbox
            await copyAiTestsToSandbox(projectPath, sandboxPath);
            
            // Pass 2: Run refined AI tests
            log.info('Starting AI test pass 2 with refined tests');
            result.pass2Results = await runAllAiTestPasses(runPath, sandboxPath, "pass2", useDocker, toolchainOrder);
            
            const pass2RanCount = result.pass2Results.filter(r => r.ran).length;
            const pass2SuccessCount = result.pass2Results.filter(r => r.ran && r.ok).length;
            
            log.info('AI test pass 2 completed', {
              toolchainsRan: pass2RanCount,
              successful: pass2SuccessCount,
              failed: pass2RanCount - pass2SuccessCount,
              improvement: pass2SuccessCount - pass1SuccessCount
            });
          }
        } else {
          log.info('No failures collected for refinement');
        }
        
      } catch (refinementError: any) {
        log.error('AI test refinement failed', { error: String(refinementError) });
        
        await writeAutoInsights(runPath, {
          cmd: 'ai-test-refinement',
          exitCode: 1,
          stderr: String(refinementError),
          toolchain
        });
        
        await insights.addInsight({
          area: 'Build',
          summary: `AI test refinement failed: ${refinementError.message}`,
          priority: 'Medium',
          evidence: { additionalContext: { error: String(refinementError) } },
          rootCause: 'AI test refinement API call or processing failed',
          suggestedRemediation: {
            preferred: 'Check ANTHROPIC_API_KEY and network connectivity',
            alternatives: ['Review refinement logs for details', 'Try disabling with UATU_AI_REFINE=0']
          }
        });
      }
    } else if (!shouldRefine) {
      log.info('AI test refinement disabled (UATU_AI_REFINE=0 or no provider)');
    } else {
      log.info('No AI test failures to refine');
    }

    result.executed = true;
    
    // Generate summary insights
    const totalTests = result.pass1Results.reduce((sum, r) => sum + (r.count || 0), 0);
    const totalPass2Tests = result.pass2Results.reduce((sum, r) => sum + (r.count || 0), 0);
    
    if (totalTests > 0) {
      await insights.addInsight({
        area: 'Tests',
        summary: result.refinementApplied 
          ? `AI tests executed with refinement: Pass 1 (${totalTests} tests), Pass 2 (${totalPass2Tests} tests)`
          : `AI tests executed: ${totalTests} tests, no refinement needed`,
        priority: 'Low',
        evidence: { 
          additionalContext: {
            pass1Tests: totalTests, 
            pass2Tests: totalPass2Tests, 
            refinementApplied: result.refinementApplied 
          }
        },
        rootCause: 'AI test execution completed successfully',
        suggestedRemediation: {
          preferred: 'Review AI test results and consider expanding test coverage'
        }
      });
    }

    return result;

  } catch (error: any) {
    log.error('AI test pipeline failed', { error: String(error) });
    
    await writeAutoInsights(runPath, {
      cmd: 'ai-test-pipeline',
      exitCode: 1,
      stderr: String(error),
      toolchain
    });
    
    await insights.addInsight({
      area: 'Tests',
      summary: `AI test pipeline failed: ${error.message}`,
      priority: 'High',
      evidence: { additionalContext: { error: String(error) } },
      rootCause: 'AI test pipeline encountered an unexpected error',
      suggestedRemediation: {
        preferred: 'Check AI provider configuration and logs',
        alternatives: ['Review detailed error logs', 'Try disabling AI tests temporarily with UATU_AI_REFINE=0']
      }
    });
    return result;
  } finally {
    // Optional: Clean up AI tests from sandbox if not debugging
    if (process.env.UATU_CLEANUP_AI_TESTS === "1") {
      await cleanupAiTestsFromSandbox(sandboxPath);
    }
  }
}
