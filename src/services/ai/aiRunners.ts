import fg from "fast-glob";
import path from "node:path";
import fs from "fs-extra";
import { logger } from "../../utils/logger.js";
import { runCmdLogged } from "../cmdLog.js";
import { writeAutoInsights } from "../insightAutoWriter.js";
import { runNodeInContainer, runFoundryInContainer } from "../dockerSandboxRunner.js";
import { getAiTestPatterns } from "./aiCopy.js";

const log = logger.child({ service: 'ai-runners' });

export interface AiTestRunResult {
  ran: boolean;
  ok: boolean;
  count?: number;
  toolchain: string;
  executionMode: 'docker' | 'local';
  elapsedMs?: number;
}

/**
 * Run AI tests for Hardhat toolchain
 */
export async function runAiHardhatPass(
  runPath: string, 
  sandbox: string, 
  passLabel: "pass1" | "pass2", 
  useDocker: boolean = false
): Promise<AiTestRunResult> {
  const startTime = Date.now();
  const patterns = getAiTestPatterns('hardhat');
  const files = await fg(patterns, { cwd: sandbox });
  
  if (files.length === 0) {
    return { ran: false, ok: true, toolchain: 'hardhat', executionMode: useDocker ? 'docker' : 'local' };
  }

  log.info(`Running Hardhat AI tests (${passLabel})`, {
    fileCount: files.length,
    executionMode: useDocker ? 'docker' : 'local'
  });

  try {
    if (useDocker) {
      const testFileArgs = files.map(f => `"${f}"`).join(' ');
      const testCommand = `npx hardhat test ${testFileArgs}`;
      await runNodeInContainer(runPath, sandbox, [testCommand]);
    } else {
      const testArgs = ['hardhat', 'test', ...files];
      await runCmdLogged(runPath, 'npx', testArgs, { cwd: sandbox });
    }

    log.info(`Hardhat AI tests (${passLabel}) completed successfully`, {
      fileCount: files.length,
      elapsedMs: Date.now() - startTime
    });

    return { 
      ran: true, 
      ok: true, 
      count: files.length, 
      toolchain: 'hardhat',
      executionMode: useDocker ? 'docker' : 'local',
      elapsedMs: Date.now() - startTime
    };

  } catch (error: any) {
    log.warn(`Hardhat AI tests (${passLabel}) failed`, {
      fileCount: files.length,
      error: String(error),
      elapsedMs: Date.now() - startTime
    });

    await writeAutoInsights(runPath, {
      cmd: `hardhat test (ai ${passLabel})`,
      exitCode: error?.exitCode ?? null,
      stdout: error?.stdout ?? "",
      stderr: error?.stderr ?? String(error),
      toolchain: { hasHardhat: true }
    });

    return { 
      ran: true, 
      ok: false, 
      count: files.length, 
      toolchain: 'hardhat',
      executionMode: useDocker ? 'docker' : 'local',
      elapsedMs: Date.now() - startTime
    };
  }
}

/**
 * Run AI tests for Foundry toolchain
 */
export async function runAiFoundryPass(
  runPath: string,
  sandbox: string,
  passLabel: "pass1" | "pass2",
  useDocker: boolean = false
): Promise<AiTestRunResult> {
  const startTime = Date.now();
  const patterns = getAiTestPatterns('foundry');
  const files = await fg(patterns, { cwd: sandbox });

  if (files.length === 0) {
    return { ran: false, ok: true, toolchain: 'foundry', executionMode: useDocker ? 'docker' : 'local' };
  }

  log.info(`Running Foundry AI tests (${passLabel})`, {
    fileCount: files.length,
    executionMode: useDocker ? 'docker' : 'local'
  });

  try {
    const forgeCmd = `forge test -vvv --match-path 'test/ai/**/*.t.sol'`;

    if (useDocker) {
      await runFoundryInContainer(runPath, sandbox, [forgeCmd]);
    } else {
      await runCmdLogged(runPath, 'bash', ['-lc', forgeCmd], { cwd: sandbox });
    }

    log.info(`Foundry AI tests (${passLabel}) completed successfully`, {
      fileCount: files.length,
      elapsedMs: Date.now() - startTime
    });

    return {
      ran: true,
      ok: true,
      count: files.length,
      toolchain: 'foundry',
      executionMode: useDocker ? 'docker' : 'local',
      elapsedMs: Date.now() - startTime
    };

  } catch (error: any) {
    log.warn(`Foundry AI tests (${passLabel}) failed`, {
      fileCount: files.length,
      error: String(error),
      elapsedMs: Date.now() - startTime
    });

    await writeAutoInsights(runPath, {
      cmd: `forge test (ai ${passLabel})`,
      exitCode: error?.exitCode ?? null,
      stdout: error?.stdout ?? "",
      stderr: error?.stderr ?? String(error),
      toolchain: { hasFoundry: true }
    });

    return {
      ran: true,
      ok: false,
      count: files.length,
      toolchain: 'foundry',
      executionMode: useDocker ? 'docker' : 'local',
      elapsedMs: Date.now() - startTime
    };
  }
}

/**
 * Run AI tests for Jest toolchain
 */
export async function runAiJestPass(
  runPath: string,
  sandbox: string,
  passLabel: "pass1" | "pass2",
  useDocker: boolean = false
): Promise<AiTestRunResult> {
  const startTime = Date.now();
  
  // Check if Jest is available
  const hasJest = await detectJest(sandbox);
  if (!hasJest) {
    return { ran: false, ok: true, toolchain: 'jest', executionMode: useDocker ? 'docker' : 'local' };
  }

  const patterns = getAiTestPatterns('jest');
  const files = await fg(patterns, { cwd: sandbox });

  if (files.length === 0) {
    return { ran: false, ok: true, toolchain: 'jest', executionMode: useDocker ? 'docker' : 'local' };
  }

  log.info(`Running Jest AI tests (${passLabel})`, {
    fileCount: files.length,
    executionMode: useDocker ? 'docker' : 'local'
  });

  try {
    const testFileArgs = files.map(f => `"${f}"`).join(' ');
    const jestCmd = `npx jest --runInBand ${testFileArgs}`;

    if (useDocker) {
      await runNodeInContainer(runPath, sandbox, [jestCmd]);
    } else {
      await runCmdLogged(runPath, 'bash', ['-lc', jestCmd], { cwd: sandbox });
    }

    log.info(`Jest AI tests (${passLabel}) completed successfully`, {
      fileCount: files.length,
      elapsedMs: Date.now() - startTime
    });

    return {
      ran: true,
      ok: true,
      count: files.length,
      toolchain: 'jest',
      executionMode: useDocker ? 'docker' : 'local',
      elapsedMs: Date.now() - startTime
    };

  } catch (error: any) {
    log.warn(`Jest AI tests (${passLabel}) failed`, {
      fileCount: files.length,
      error: String(error),
      elapsedMs: Date.now() - startTime
    });

    await writeAutoInsights(runPath, {
      cmd: `jest (ai ${passLabel})`,
      exitCode: error?.exitCode ?? null,
      stdout: error?.stdout ?? "",
      stderr: error?.stderr ?? String(error),
      toolchain: { hasNode: true }
    });

    return {
      ran: true,
      ok: false,
      count: files.length,
      toolchain: 'jest',
      executionMode: useDocker ? 'docker' : 'local',
      elapsedMs: Date.now() - startTime
    };
  }
}

/**
 * Run AI tests for Anchor toolchain
 */
export async function runAiAnchorPass(
  runPath: string,
  sandbox: string,
  passLabel: "pass1" | "pass2",
  useDocker: boolean = false
): Promise<AiTestRunResult> {
  const startTime = Date.now();
  const patterns = getAiTestPatterns('anchor');
  const files = await fg(patterns, { cwd: sandbox });

  if (files.length === 0) {
    return { ran: false, ok: true, toolchain: 'anchor', executionMode: useDocker ? 'docker' : 'local' };
  }

  log.info(`Running Anchor AI tests (${passLabel})`, {
    fileCount: files.length,
    executionMode: useDocker ? 'docker' : 'local'
  });

  try {
    // Note: Anchor typically runs all tests in the workspace
    // We can't easily isolate AI tests like with other frameworks
    const anchorCmd = 'anchor test';

    if (useDocker) {
      // Would need custom Anchor Docker image
      await runCmdLogged(runPath, 'bash', ['-lc', anchorCmd], { cwd: sandbox });
    } else {
      await runCmdLogged(runPath, 'bash', ['-lc', anchorCmd], { cwd: sandbox });
    }

    log.info(`Anchor AI tests (${passLabel}) completed successfully`, {
      fileCount: files.length,
      elapsedMs: Date.now() - startTime
    });

    return {
      ran: true,
      ok: true,
      count: files.length,
      toolchain: 'anchor',
      executionMode: useDocker ? 'docker' : 'local',
      elapsedMs: Date.now() - startTime
    };

  } catch (error: any) {
    log.warn(`Anchor AI tests (${passLabel}) failed`, {
      fileCount: files.length,
      error: String(error),
      elapsedMs: Date.now() - startTime
    });

    await writeAutoInsights(runPath, {
      cmd: `anchor test (ai ${passLabel})`,
      exitCode: error?.exitCode ?? null,
      stdout: error?.stdout ?? "",
      stderr: error?.stderr ?? String(error),
      toolchain: { hasAnchor: true }
    });

    return {
      ran: true,
      ok: false,
      count: files.length,
      toolchain: 'anchor',
      executionMode: useDocker ? 'docker' : 'local',
      elapsedMs: Date.now() - startTime
    };
  }
}

/**
 * Run AI tests for all detected toolchains
 */
export async function runAllAiTestPasses(
  runPath: string,
  sandbox: string,
  passLabel: "pass1" | "pass2",
  useDocker: boolean = false,
  toolchainOrder: string[] = ['hardhat', 'foundry', 'jest', 'anchor']
): Promise<AiTestRunResult[]> {
  const results: AiTestRunResult[] = [];

  log.info(`Running AI tests for all toolchains (${passLabel})`, {
    toolchainOrder,
    executionMode: useDocker ? 'docker' : 'local'
  });

  for (const toolchain of toolchainOrder) {
    try {
      let result: AiTestRunResult;

      switch (toolchain) {
        case 'hardhat':
          result = await runAiHardhatPass(runPath, sandbox, passLabel, useDocker);
          break;
        case 'foundry':
          result = await runAiFoundryPass(runPath, sandbox, passLabel, useDocker);
          break;
        case 'jest':
          result = await runAiJestPass(runPath, sandbox, passLabel, useDocker);
          break;
        case 'anchor':
          result = await runAiAnchorPass(runPath, sandbox, passLabel, useDocker);
          break;
        default:
          log.warn(`Unknown toolchain: ${toolchain}`);
          continue;
      }

      results.push(result);

      if (result.ran) {
        log.info(`AI tests completed for ${toolchain}`, {
          passLabel,
          success: result.ok,
          fileCount: result.count,
          elapsedMs: result.elapsedMs
        });
      }

    } catch (error) {
      log.error(`Failed to run AI tests for ${toolchain}`, {
        passLabel,
        error: String(error)
      });

      results.push({
        ran: false,
        ok: false,
        toolchain,
        executionMode: useDocker ? 'docker' : 'local'
      });
    }
  }

  const ranCount = results.filter(r => r.ran).length;
  const successCount = results.filter(r => r.ran && r.ok).length;

  log.info(`AI test pass (${passLabel}) summary`, {
    toolchainsRan: ranCount,
    successful: successCount,
    failed: ranCount - successCount,
    totalResults: results.length
  });

  return results;
}

/**
 * Helper to detect if Jest is available in the project
 */
async function detectJest(sandbox: string): Promise<boolean> {
  try {
    const packageJsonPath = path.join(sandbox, "package.json");
    if (!await fs.pathExists(packageJsonPath)) {
      return false;
    }

    const packageJson = await fs.readJson(packageJsonPath);
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    // Check for Jest in dependencies or test script
    return !!(
      allDeps?.jest ||
      allDeps?.['@jest/core'] ||
      (packageJson.scripts?.test && /jest/.test(packageJson.scripts.test))
    );
  } catch (error) {
    log.debug("Failed to detect Jest", { error: String(error) });
    return false;
  }
}
