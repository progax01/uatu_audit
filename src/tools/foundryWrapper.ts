/**
 * Foundry Wrapper
 *
 * Wrapper for Foundry (forge) build and test tools.
 * https://github.com/foundry-rs/foundry
 */

import { spawn } from 'child_process';
import type { ToolRunnerConfig, ToolRunnerResult, StepFinding } from '../sops/definitions/types';
import { normalizeFilePath, parseJsonOutput } from './index';
import { runToolInDocker, checkDockerAvailable, checkDockerImageExists } from './dockerRunner.js';
import { ECOSYSTEM_DOCKER_IMAGES } from '../config/docker.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);
const log = logger.child({ service: 'foundry-wrapper' });

// ============================================================================
// Types
// ============================================================================

interface ForgeCompilationResult {
  errors?: ForgeError[];
  warnings?: ForgeWarning[];
  sources?: Record<string, ForgeSource>;
}

interface ForgeError {
  component: string;
  errorCode: string;
  formattedMessage: string;
  message: string;
  severity: 'error' | 'warning';
  sourceLocation?: {
    file: string;
    start: number;
    end: number;
  };
  type: string;
}

interface ForgeWarning extends ForgeError {
  severity: 'warning';
}

interface ForgeSource {
  id: number;
  ast: any;
}

interface ForgeTestResult {
  [contractName: string]: {
    [testName: string]: {
      status: 'Success' | 'Failure' | 'Skipped';
      reason?: string;
      counterexample?: any;
      logs?: string[];
      traces?: any[];
      gas?: number;
    };
  };
}

// ============================================================================
// Build Runner
// ============================================================================

/**
 * Check if Forge is available natively
 */
async function checkForgeNative(): Promise<boolean> {
  try {
    await execAsync('forge --version', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run forge build
 */
export async function runFoundry(config: ToolRunnerConfig): Promise<ToolRunnerResult> {
  const startTime = Date.now();

  // Check if native Forge is available
  const nativeAvailable = await checkForgeNative();

  if (nativeAvailable) {
    // Use native Forge
    return runFoundryNative(config, startTime);
  } else {
    // Try Docker fallback
    const dockerAvailable = await checkDockerAvailable();
    const imageExists = dockerAvailable ? await checkDockerImageExists(ECOSYSTEM_DOCKER_IMAGES.solidity) : false;

    if (imageExists) {
      return runFoundryDocker(config, startTime);
    } else {
      return {
        success: false,
        findings: [],
        error: 'Forge not available. Please install Foundry locally or build the Docker image:\n' +
               'Native: curl -L https://foundry.paradigm.xyz | bash && foundryup\n' +
               'Docker: docker build -f docker/solidity.Dockerfile -t uatu-audit-solidity:latest .',
        executionTimeMs: Date.now() - startTime,
      };
    }
  }
}

/**
 * Run forge build natively
 */
async function runFoundryNative(config: ToolRunnerConfig, startTime: number): Promise<ToolRunnerResult> {
  // Use provided args or default to build --force
  const args = config.args?.length ? [...config.args] : ['build', '--force'];

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn('forge', args, {
      cwd: config.projectPath,
      timeout: config.timeout || 300000, // 5 minutes
      env: {
        ...process.env,
        ...config.env,
      },
    });

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      // Progress based on output
      if (stdout.includes('Compiling')) {
        config.onProgress?.(30, 'Compiling contracts...');
      } else if (stdout.includes('Compiled')) {
        config.onProgress?.(80, 'Compilation complete');
      }
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const executionTimeMs = Date.now() - startTime;

      if (code === 0) {
        const findings = parseFoundryOutput({ stdout, stderr }, config.projectPath);

        resolve({
          success: true,
          findings,
          stdout,
          stderr,
          exitCode: 0,
          executionTimeMs,
        });
      } else {
        // Parse compilation errors
        const findings = parseFoundryOutput({ stdout, stderr, failed: true }, config.projectPath);

        resolve({
          success: false,
          findings,
          error: stderr || 'Compilation failed',
          stdout,
          stderr,
          exitCode: code || 1,
          executionTimeMs,
        });
      }
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        findings: [],
        error: err.message,
        executionTimeMs: Date.now() - startTime,
      });
    });
  });
}

/**
 * Run forge build via Docker
 */
async function runFoundryDocker(config: ToolRunnerConfig, startTime: number): Promise<ToolRunnerResult> {
  // Use provided args or default to build --force
  const args = config.args?.length ? [...config.args] : ['build', '--force'];

  config.onProgress?.(30, 'Running Forge in Docker...');

  try {
    const result = await runToolInDocker({
      ecosystem: 'solidity',
      sourcePath: config.projectPath,
      outputPath: '/tmp/uatu-output',
      tool: 'forge',
      args,
      timeout: config.timeout || 300000,
      memoryLimit: '4g',
      cpuLimit: '2.0',
    });

    config.onProgress?.(90, 'Parsing results...');

    const executionTimeMs = Date.now() - startTime;

    if (result.exitCode === 0) {
      const findings = parseFoundryOutput({ stdout: result.stdout, stderr: result.stderr }, config.projectPath);

      return {
        success: true,
        findings,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
        executionTimeMs,
      };
    } else {
      const findings = parseFoundryOutput({ stdout: result.stdout, stderr: result.stderr, failed: true }, config.projectPath);

      return {
        success: false,
        findings,
        error: result.stderr || 'Compilation failed',
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        executionTimeMs,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      findings: [],
      error: error.message,
      executionTimeMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Test Runner
// ============================================================================

/**
 * Run forge test
 */
export async function runFoundryTest(config: ToolRunnerConfig): Promise<ToolRunnerResult> {
  const startTime = Date.now();

  const args = ['test', '--json'];

  // Add verbosity for more details
  args.push('-vv');

  // Add additional args
  if (config.args?.length) {
    args.push(...config.args);
  }

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn('forge', args, {
      cwd: config.projectPath,
      timeout: config.timeout || 300000, // 5 minutes
      env: {
        ...process.env,
        ...config.env,
      },
    });

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const executionTimeMs = Date.now() - startTime;
      const parsed = parseJsonOutput(stdout);

      // Parse test results using the new structured parser
      let testResults: any = null;
      try {
        const { parseTestOutput } = require('../services/testResultParser.js');
        testResults = parseTestOutput(stdout + '\n' + stderr, 'foundry');
      } catch (err: any) {
        log.warn('Failed to parse test results with structured parser', { error: err.message });
      }

      if (parsed) {
        const findings = parseFoundryTestOutput(parsed, config.projectPath);

        resolve({
          success: code === 0,
          findings,
          stdout,
          stderr,
          exitCode: code || 0,
          executionTimeMs,
          metadata: {
            testResults, // Include structured test results
          },
        });
      } else {
        resolve({
          success: code === 0,
          findings: [],
          error: code !== 0 ? (stderr || 'Tests failed') : undefined,
          stdout,
          stderr,
          exitCode: code || 0,
          executionTimeMs,
          metadata: {
            testResults,
          },
        });
      }
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        findings: [],
        error: err.message,
        executionTimeMs: Date.now() - startTime,
      });
    });
  });
}

// ============================================================================
// Parsers
// ============================================================================

/**
 * Parse forge build output
 */
export function parseFoundryOutput(
  output: { stdout: string; stderr: string; failed?: boolean },
  projectPath: string
): StepFinding[] {
  const findings: StepFinding[] = [];

  // Parse compilation warnings from stderr
  const warningRegex = /Warning[^:]*:\s*(.+?)(?=\n\s*-->|\n\n|$)/gs;
  const locationRegex = /-->\s*([^:]+):(\d+):(\d+)/;

  let match;
  while ((match = warningRegex.exec(output.stderr)) !== null) {
    const message = match[1].trim();
    const locationMatch = output.stderr.slice(match.index).match(locationRegex);

    const finding: StepFinding = {
      stepId: 'run-forge-build',
      tool: 'forge',
      findingId: `forge-warning-${findings.length}`,
      severity: 'low',
      title: 'Compilation Warning',
      description: message,
      confidence: 1,
    };

    if (locationMatch) {
      finding.location = {
        file: normalizeFilePath(locationMatch[1], projectPath),
        line: parseInt(locationMatch[2], 10),
        column: parseInt(locationMatch[3], 10),
      };
    }

    // Categorize common warnings
    if (message.includes('unused')) {
      finding.title = 'Unused Variable/Function';
      finding.recommendation = 'Remove unused code to improve readability and reduce gas costs.';
    } else if (message.includes('shadowing') || message.includes('shadows')) {
      finding.title = 'Variable Shadowing';
      finding.severity = 'medium';
      finding.recommendation = 'Rename the variable to avoid shadowing.';
    } else if (message.includes('visibility')) {
      finding.title = 'Missing Visibility Specifier';
      finding.severity = 'medium';
      finding.recommendation = 'Explicitly specify function visibility (public, external, internal, private).';
    }

    findings.push(finding);
  }

  // Parse compilation errors if failed
  if (output.failed) {
    const errorRegex = /Error[^:]*:\s*(.+?)(?=\n\s*-->|\n\n|$)/gs;

    while ((match = errorRegex.exec(output.stderr)) !== null) {
      const message = match[1].trim();
      const locationMatch = output.stderr.slice(match.index).match(locationRegex);

      const finding: StepFinding = {
        stepId: 'run-forge-build',
        tool: 'forge',
        findingId: `forge-error-${findings.length}`,
        severity: 'critical',
        title: 'Compilation Error',
        description: message,
        confidence: 1,
        recommendation: 'Fix the compilation error before proceeding with the audit.',
      };

      if (locationMatch) {
        finding.location = {
          file: normalizeFilePath(locationMatch[1], projectPath),
          line: parseInt(locationMatch[2], 10),
          column: parseInt(locationMatch[3], 10),
        };
      }

      findings.push(finding);
    }
  }

  return findings;
}

/**
 * Parse forge test output
 */
export function parseFoundryTestOutput(output: any, projectPath: string): StepFinding[] {
  const findings: StepFinding[] = [];

  if (!output || typeof output !== 'object') {
    return findings;
  }

  // Iterate through test results
  for (const [contractPath, tests] of Object.entries(output)) {
    if (typeof tests !== 'object' || !tests) continue;

    for (const [testName, result] of Object.entries(tests as Record<string, any>)) {
      if (result?.status === 'Failure') {
        const finding: StepFinding = {
          stepId: 'run-forge-test',
          tool: 'forge-test',
          findingId: `forge-test-${contractPath}-${testName}`,
          severity: 'medium',
          title: `Failed Test: ${testName}`,
          description: result.reason || 'Test failed without explicit reason',
          confidence: 1,
          rawOutput: {
            testName,
            status: result.status,
            reason: result.reason,
            counterexample: result.counterexample,
            gasUsed: result.gasUsed,
          },
        };

        // Extract file from contract path
        finding.location = {
          file: normalizeFilePath(contractPath.split(':')[0] || contractPath, projectPath),
        };

        // Generate recommendation based on failure type
        if (result.reason?.includes('revert')) {
          finding.recommendation = 'Review the test to ensure expected reverts are properly handled with vm.expectRevert().';
        } else if (result.reason?.includes('assertion')) {
          finding.recommendation = 'Check the assertion conditions in the test and verify the contract behavior.';
        } else if (result.counterexample) {
          finding.severity = 'high';
          finding.title = `Fuzzing Failure: ${testName}`;
          finding.description = `Fuzz test found counterexample: ${JSON.stringify(result.counterexample)}`;
          finding.recommendation = 'Investigate the counterexample to find potential edge cases or vulnerabilities.';
        } else {
          finding.recommendation = 'Debug the failing test to understand the root cause.';
        }

        findings.push(finding);
      }
    }
  }

  return findings;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get test statistics from forge test output
 */
export function getTestStats(output: any): {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
} {
  const stats = { total: 0, passed: 0, failed: 0, skipped: 0 };

  if (!output || typeof output !== 'object') {
    return stats;
  }

  for (const tests of Object.values(output)) {
    if (typeof tests !== 'object' || !tests) continue;

    for (const result of Object.values(tests as Record<string, any>)) {
      stats.total++;
      if (result?.status === 'Success') stats.passed++;
      else if (result?.status === 'Failure') stats.failed++;
      else if (result?.status === 'Skipped') stats.skipped++;
    }
  }

  return stats;
}

/**
 * Check if project has tests
 */
export async function hasTests(projectPath: string): Promise<boolean> {
  const { spawn } = await import('child_process');

  return new Promise((resolve) => {
    const proc = spawn('find', [projectPath, '-name', '*.t.sol', '-type', 'f'], {
      timeout: 10000,
    });

    let stdout = '';
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.on('close', () => {
      resolve(stdout.trim().length > 0);
    });

    proc.on('error', () => {
      resolve(false);
    });
  });
}
