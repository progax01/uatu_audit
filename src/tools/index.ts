/**
 * Tool Registry
 *
 * Central registry for all external security analysis tools.
 * Handles availability checks, Docker fallbacks, and tool execution.
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import type {
  ToolRegistryEntry,
  ToolRunnerConfig,
  ToolRunnerResult,
  StepFinding,
} from '../sops/definitions/types';

const execAsync = promisify(exec);

// ============================================================================
// Tool Registry
// ============================================================================

export interface Tool {
  name: string;
  displayName: string;
  checkCommand: string;
  dockerImage?: string;
  defaultTimeout: number;
  runner: (config: ToolRunnerConfig) => Promise<ToolRunnerResult>;
  parser: (output: any, projectPath: string) => StepFinding[];
}

// Import individual tool runners
import { runSlither, parseSlitherOutput } from './slitherWrapper.js';
import { runMythril, parseMythrilOutput } from './mythrilWrapper.js';
import { runFoundry, parseFoundryOutput, runFoundryTest, parseFoundryTestOutput } from './foundryWrapper.js';
import { runSemgrep, parseSemgrepOutput } from './semgrepWrapper.js';
import { runAnchor, runAnchorTest, runCargoClippy, runCargoAudit, runSoteria } from './anchorWrapper.js';
import { runAptos, runAptosTest, runAptosProver, runSui, runSuiTest, runHardhat, runHardhatTest, runCargoContract } from './moveWrapper.js';

// Re-export normalized finding type
export interface NormalizedFinding {
  tool: string;
  ruleId: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  location?: {
    file: string;
    line?: number;
    column?: number;
  };
  recommendation?: string;
}

/**
 * Registry of all available tools
 */
export const TOOL_REGISTRY: Record<string, Tool> = {
  slither: {
    name: 'slither',
    displayName: 'Slither Static Analyzer',
    checkCommand: 'slither --version',
    dockerImage: 'trailofbits/slither',
    defaultTimeout: 180000, // 3 minutes
    runner: runSlither,
    parser: parseSlitherOutput,
  },
  mythril: {
    name: 'mythril',
    displayName: 'Mythril Symbolic Execution',
    checkCommand: 'myth version',
    dockerImage: 'mythril/myth',
    defaultTimeout: 600000, // 10 minutes
    runner: runMythril,
    parser: parseMythrilOutput,
  },
  forge: {
    name: 'forge',
    displayName: 'Foundry Forge',
    checkCommand: 'forge --version',
    defaultTimeout: 300000, // 5 minutes
    runner: runFoundry,
    parser: parseFoundryOutput,
  },
  'forge-test': {
    name: 'forge-test',
    displayName: 'Foundry Forge Test',
    checkCommand: 'forge --version',
    defaultTimeout: 300000, // 5 minutes
    runner: runFoundryTest,
    parser: parseFoundryTestOutput,
  },
  semgrep: {
    name: 'semgrep',
    displayName: 'Semgrep Pattern Scanner',
    checkCommand: 'semgrep --version',
    defaultTimeout: 120000, // 2 minutes
    runner: runSemgrep,
    parser: parseSemgrepOutput,
  },
  tokei: {
    name: 'tokei',
    displayName: 'Tokei SLOC Counter',
    checkCommand: 'tokei --version',
    defaultTimeout: 30000, // 30 seconds
    runner: async (config) => ({
      success: true,
      findings: [],
      executionTimeMs: 0,
    }),
    parser: () => [],
  },

  // Hardhat tools
  hardhat: {
    name: 'hardhat',
    displayName: 'Hardhat',
    checkCommand: 'npx hardhat --version',
    defaultTimeout: 180000, // 3 minutes
    runner: runHardhat,
    parser: () => [],
  },
  'hardhat-test': {
    name: 'hardhat-test',
    displayName: 'Hardhat Test',
    checkCommand: 'npx hardhat --version',
    defaultTimeout: 300000, // 5 minutes
    runner: runHardhatTest,
    parser: () => [],
  },

  // Anchor/Solana tools
  anchor: {
    name: 'anchor',
    displayName: 'Anchor Framework',
    checkCommand: 'anchor --version',
    defaultTimeout: 300000, // 5 minutes
    runner: runAnchor,
    parser: () => [],
  },
  'anchor-test': {
    name: 'anchor-test',
    displayName: 'Anchor Test',
    checkCommand: 'anchor --version',
    defaultTimeout: 300000, // 5 minutes
    runner: runAnchorTest,
    parser: () => [],
  },
  'cargo-clippy': {
    name: 'cargo-clippy',
    displayName: 'Cargo Clippy',
    checkCommand: 'cargo clippy --version',
    defaultTimeout: 120000, // 2 minutes
    runner: runCargoClippy,
    parser: () => [],
  },
  'cargo-audit': {
    name: 'cargo-audit',
    displayName: 'Cargo Audit',
    checkCommand: 'cargo audit --version',
    defaultTimeout: 60000, // 1 minute
    runner: runCargoAudit,
    parser: () => [],
  },
  soteria: {
    name: 'soteria',
    displayName: 'Soteria Scanner',
    checkCommand: 'soteria --version',
    defaultTimeout: 180000, // 3 minutes
    runner: runSoteria,
    parser: () => [],
  },

  // Aptos Move tools
  aptos: {
    name: 'aptos',
    displayName: 'Aptos CLI',
    checkCommand: 'aptos --version',
    defaultTimeout: 180000, // 3 minutes
    runner: runAptos,
    parser: () => [],
  },
  'aptos-test': {
    name: 'aptos-test',
    displayName: 'Aptos Move Test',
    checkCommand: 'aptos --version',
    defaultTimeout: 300000, // 5 minutes
    runner: runAptosTest,
    parser: () => [],
  },
  'aptos-prover': {
    name: 'aptos-prover',
    displayName: 'Aptos Move Prover',
    checkCommand: 'aptos --version',
    defaultTimeout: 600000, // 10 minutes
    runner: runAptosProver,
    parser: () => [],
  },

  // Sui Move tools
  sui: {
    name: 'sui',
    displayName: 'Sui CLI',
    checkCommand: 'sui --version',
    defaultTimeout: 180000, // 3 minutes
    runner: runSui,
    parser: () => [],
  },
  'sui-test': {
    name: 'sui-test',
    displayName: 'Sui Move Test',
    checkCommand: 'sui --version',
    defaultTimeout: 300000, // 5 minutes
    runner: runSuiTest,
    parser: () => [],
  },

  // ink!/Substrate tools
  'cargo-contract': {
    name: 'cargo-contract',
    displayName: 'Cargo Contract',
    checkCommand: 'cargo contract --version',
    defaultTimeout: 300000, // 5 minutes
    runner: runCargoContract,
    parser: () => [],
  },
};

// ============================================================================
// Tool Availability Checking
// ============================================================================

export interface ToolAvailability {
  name: string;
  available: boolean;
  version?: string;
  error?: string;
  checkTimeMs: number;
}

/**
 * Check if a single tool is available (native or Docker)
 */
export async function checkToolAvailable(toolName: string): Promise<ToolAvailability> {
  const tool = TOOL_REGISTRY[toolName];
  const startTime = Date.now();

  if (!tool) {
    return {
      name: toolName,
      available: false,
      error: `Unknown tool: ${toolName}`,
      checkTimeMs: Date.now() - startTime,
    };
  }

  // First try native check
  try {
    const { stdout } = await execAsync(tool.checkCommand, { timeout: 10000 });
    const version = extractVersion(stdout);

    return {
      name: toolName,
      available: true,
      version,
      checkTimeMs: Date.now() - startTime,
    };
  } catch (error: any) {
    // Native check failed, try Docker fallback
    if (tool.dockerImage || toolName === 'slither' || toolName === 'mythril' || toolName === 'semgrep' ||
        toolName === 'forge' || toolName === 'forge-test' || toolName === 'hardhat' || toolName === 'hardhat-test' ||
        toolName === 'anchor' || toolName === 'anchor-test' || toolName === 'cargo-audit' ||
        toolName === 'soteria' || toolName === 'aptos' || toolName === 'sui') {

      // Check if Docker is available and our images exist
      try {
        await execAsync('docker --version', { timeout: 5000 });

        // Map tool to Docker image
        const dockerImage = getDockerImageForTool(toolName);

        if (dockerImage) {
          // Check if image exists
          try {
            await execAsync(`docker image inspect ${dockerImage}`, { timeout: 5000 });
            return {
              name: toolName,
              available: true,
              version: `docker:${dockerImage}`,
              checkTimeMs: Date.now() - startTime,
            };
          } catch {
            // Docker image doesn't exist
          }
        }
      } catch {
        // Docker not available
      }
    }

    return {
      name: toolName,
      available: false,
      error: error.message || 'Command failed',
      checkTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Get Docker image for a tool
 */
function getDockerImageForTool(toolName: string): string | null {
  // Solidity tools
  if (['slither', 'mythril', 'forge', 'forge-test', 'semgrep', 'hardhat', 'hardhat-test'].includes(toolName)) {
    return 'uatu-audit-solidity:latest';
  }

  // Rust/Solana tools
  if (['anchor', 'anchor-test', 'cargo-clippy', 'cargo-audit', 'cargo-geiger', 'soteria'].includes(toolName)) {
    return 'uatu-audit-rust:latest';
  }

  // Move tools
  if (['aptos', 'aptos-test', 'aptos-prover', 'sui', 'sui-test'].includes(toolName)) {
    return 'uatu-audit-move:latest';
  }

  // Substrate tools
  if (['cargo-contract'].includes(toolName)) {
    return 'uatu-audit-substrate:latest';
  }

  return null;
}

/**
 * Check availability of all registered tools
 */
export async function checkAllToolsAvailable(): Promise<ToolAvailability[]> {
  const toolNames = Object.keys(TOOL_REGISTRY);
  const results = await Promise.all(toolNames.map(checkToolAvailable));
  return results;
}

/**
 * Check availability of specific tools
 */
export async function checkToolsAvailable(toolNames: string[]): Promise<ToolAvailability[]> {
  const results = await Promise.all(toolNames.map(checkToolAvailable));
  return results;
}

/**
 * Get list of available tool names
 */
export async function getAvailableToolNames(): Promise<string[]> {
  const results = await checkAllToolsAvailable();
  return results.filter((r) => r.available).map((r) => r.name);
}

// ============================================================================
// Tool Execution
// ============================================================================

/**
 * Run a tool by name
 */
export async function runTool(
  toolName: string,
  config: ToolRunnerConfig
): Promise<ToolRunnerResult> {
  const tool = TOOL_REGISTRY[toolName];

  if (!tool) {
    return {
      success: false,
      findings: [],
      error: `Unknown tool: ${toolName}`,
      executionTimeMs: 0,
    };
  }

  // Check if tool is available
  const availability = await checkToolAvailable(toolName);

  if (!availability.available) {
    // Try Docker fallback if configured
    if (tool.dockerImage && config.dockerFallback !== false) {
      return runToolViaDocker(tool, config);
    }

    return {
      success: false,
      findings: [],
      error: `Tool not available: ${toolName}. ${availability.error}`,
      executionTimeMs: availability.checkTimeMs,
    };
  }

  // Run the tool
  const timeout = config.timeout || tool.defaultTimeout;
  const startTime = Date.now();

  try {
    const result = await Promise.race([
      tool.runner({ ...config, timeout }),
      createTimeout(timeout),
    ]);

    return {
      ...result,
      toolVersion: availability.version,
    };
  } catch (error: any) {
    return {
      success: false,
      findings: [],
      error: error.message || 'Tool execution failed',
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Run a tool via Docker as fallback
 */
async function runToolViaDocker(
  tool: Tool,
  config: ToolRunnerConfig
): Promise<ToolRunnerResult> {
  if (!tool.dockerImage) {
    return {
      success: false,
      findings: [],
      error: 'No Docker image configured for this tool',
      executionTimeMs: 0,
    };
  }

  const startTime = Date.now();

  try {
    // Check if Docker is available
    await execAsync('docker --version', { timeout: 5000 });
  } catch {
    return {
      success: false,
      findings: [],
      error: 'Docker not available for fallback',
      executionTimeMs: Date.now() - startTime,
    };
  }

  // Build Docker command
  const dockerArgs = [
    'run',
    '--rm',
    '-v',
    `${config.projectPath}:/src`,
    '-w',
    '/src',
    tool.dockerImage,
  ];

  // Add tool-specific args based on the tool
  if (tool.name === 'slither') {
    dockerArgs.push('.', '--json', '-');
  } else if (tool.name === 'mythril') {
    dockerArgs.push('analyze', '.', '-o', 'json');
  }

  return new Promise((resolve) => {
    const timeout = config.timeout || tool.defaultTimeout;
    let stdout = '';
    let stderr = '';

    const proc = spawn('docker', dockerArgs, {
      cwd: config.projectPath,
      timeout,
    });

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const executionTimeMs = Date.now() - startTime;

      if (code === 0 || stdout.trim()) {
        try {
          const findings = tool.parser(stdout, config.projectPath);
          resolve({
            success: true,
            findings,
            stdout,
            stderr,
            exitCode: code || 0,
            executionTimeMs,
            toolVersion: `docker:${tool.dockerImage}`,
          });
        } catch (parseError: any) {
          resolve({
            success: false,
            findings: [],
            error: `Failed to parse output: ${parseError.message}`,
            stdout,
            stderr,
            exitCode: code || 0,
            executionTimeMs,
          });
        }
      } else {
        resolve({
          success: false,
          findings: [],
          error: stderr || 'Docker execution failed',
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

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract version number from command output
 */
function extractVersion(output: string): string | undefined {
  // Common version patterns
  const patterns = [
    /(\d+\.\d+\.\d+)/,           // 1.2.3
    /v(\d+\.\d+\.\d+)/,          // v1.2.3
    /version\s+(\d+\.\d+\.\d+)/i, // version 1.2.3
  ];

  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return undefined;
}

/**
 * Create a timeout promise
 */
function createTimeout(ms: number): Promise<ToolRunnerResult> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Tool execution timed out after ${ms}ms`));
    }, ms);
  });
}

/**
 * Parse command output as JSON safely
 */
export function parseJsonOutput(output: string): any | null {
  try {
    // Try to find JSON in the output (may have other text before/after)
    const jsonMatch = output.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(output);
  } catch {
    return null;
  }
}

/**
 * Normalize file path for findings
 */
export function normalizeFilePath(filePath: string, projectPath: string): string {
  if (filePath.startsWith(projectPath)) {
    return filePath.slice(projectPath.length).replace(/^\//, '');
  }
  return filePath;
}
