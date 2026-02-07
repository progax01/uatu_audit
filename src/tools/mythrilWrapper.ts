/**
 * Mythril Wrapper
 *
 * Wrapper for ConsenSys Mythril symbolic execution tool.
 * https://github.com/ConsenSys/mythril
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import type { ToolRunnerConfig, ToolRunnerResult, StepFinding } from '../sops/definitions/types';
import { normalizeFilePath, parseJsonOutput } from './index';
import { runToolInDocker, checkDockerAvailable, checkDockerImageExists } from './dockerRunner.js';
import { ECOSYSTEM_DOCKER_IMAGES } from '../config/docker.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

interface MythrilIssue {
  address: number;
  code: string;
  contract: string;
  description: string;
  filename: string;
  function: string;
  lineno: number;
  max_gas_used: number;
  min_gas_used: number;
  severity: 'High' | 'Medium' | 'Low' | 'Informational';
  sourceMap: string;
  swc_id: string;
  title: string;
  tx_sequence?: string;
}

interface MythrilOutput {
  error?: string;
  issues?: MythrilIssue[];
  success: boolean;
}

// ============================================================================
// Severity Mapping
// ============================================================================

const MYTHRIL_SEVERITY_MAP: Record<string, StepFinding['severity']> = {
  'High': 'high',
  'Medium': 'medium',
  'Low': 'low',
  'Informational': 'info',
};

// SWC IDs to descriptions
// https://swcregistry.io/
const SWC_DESCRIPTIONS: Record<string, string> = {
  'SWC-100': 'Function Default Visibility',
  'SWC-101': 'Integer Overflow and Underflow',
  'SWC-102': 'Outdated Compiler Version',
  'SWC-103': 'Floating Pragma',
  'SWC-104': 'Unchecked Call Return Value',
  'SWC-105': 'Unprotected Ether Withdrawal',
  'SWC-106': 'Unprotected SELFDESTRUCT Instruction',
  'SWC-107': 'Reentrancy',
  'SWC-108': 'State Variable Default Visibility',
  'SWC-109': 'Uninitialized Storage Pointer',
  'SWC-110': 'Assert Violation',
  'SWC-111': 'Use of Deprecated Solidity Functions',
  'SWC-112': 'Delegatecall to Untrusted Callee',
  'SWC-113': 'DoS with Failed Call',
  'SWC-114': 'Transaction Order Dependence',
  'SWC-115': 'Authorization through tx.origin',
  'SWC-116': 'Block values as a proxy for time',
  'SWC-117': 'Signature Malleability',
  'SWC-118': 'Incorrect Constructor Name',
  'SWC-119': 'Shadowing State Variables',
  'SWC-120': 'Weak Sources of Randomness',
  'SWC-121': 'Missing Protection against Signature Replay',
  'SWC-122': 'Lack of Proper Signature Verification',
  'SWC-123': 'Requirement Violation',
  'SWC-124': 'Write to Arbitrary Storage Location',
  'SWC-125': 'Incorrect Inheritance Order',
  'SWC-126': 'Insufficient Gas Griefing',
  'SWC-127': 'Arbitrary Jump with Function Type Variable',
  'SWC-128': 'DoS With Block Gas Limit',
  'SWC-129': 'Typographical Error',
  'SWC-130': 'Right-To-Left-Override control character (U+202E)',
  'SWC-131': 'Presence of unused variables',
  'SWC-132': 'Unexpected Ether balance',
  'SWC-133': 'Hash Collisions With Multiple Variable Length Arguments',
  'SWC-134': 'Message call with hardcoded gas amount',
  'SWC-135': 'Code With No Effects',
  'SWC-136': 'Unencrypted Private Data On-Chain',
};

// ============================================================================
// Runner
// ============================================================================

/**
 * Check if Mythril is available natively
 */
async function checkMythrilNative(): Promise<boolean> {
  try {
    await execAsync('mythril version', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run Mythril on a project
 */
export async function runMythril(config: ToolRunnerConfig): Promise<ToolRunnerResult> {
  const startTime = Date.now();

  // Check if native Mythril is available
  const nativeAvailable = await checkMythrilNative();

  if (!nativeAvailable) {
    // Try Docker fallback
    const dockerAvailable = await checkDockerAvailable();
    const imageExists = dockerAvailable ? await checkDockerImageExists(ECOSYSTEM_DOCKER_IMAGES.solidity) : false;

    if (!imageExists) {
      return {
        success: false,
        findings: [],
        error: 'Mythril not available. Please install Mythril locally or build the Docker image:\n' +
               'Native: pip install mythril\n' +
               'Docker: docker build -f docker/solidity.Dockerfile -t uatu-audit-solidity:latest .',
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  // Find main contract files
  const contractFiles = await findSolidityFiles(config.projectPath);

  if (contractFiles.length === 0) {
    return {
      success: false,
      findings: [],
      error: 'No Solidity files found',
      executionTimeMs: Date.now() - startTime,
    };
  }

  // Mythril analyzes one contract at a time, so we'll analyze the main contracts
  // (files in src/ directory, not test files)
  const mainContracts = contractFiles
    .filter((f) => !f.includes('/test/') && !f.includes('.t.sol'))
    .slice(0, 5); // Limit to 5 files to avoid timeout

  if (mainContracts.length === 0) {
    return {
      success: true,
      findings: [],
      executionTimeMs: Date.now() - startTime,
    };
  }

  const allFindings: StepFinding[] = [];
  let lastError: string | undefined;

  for (const contractFile of mainContracts) {
    const result = nativeAvailable
      ? await runMythrilOnFile(contractFile, config)
      : await runMythrilOnFileDocker(contractFile, config);

    if (result.success) {
      allFindings.push(...result.findings);
    } else {
      lastError = result.error;
    }

    // Report progress
    const progress = Math.round(
      ((mainContracts.indexOf(contractFile) + 1) / mainContracts.length) * 100
    );
    config.onProgress?.(progress, `Analyzing ${path.basename(contractFile)}...`);
  }

  return {
    success: allFindings.length > 0 || !lastError,
    findings: allFindings,
    error: allFindings.length === 0 ? lastError : undefined,
    executionTimeMs: Date.now() - startTime,
  };
}

/**
 * Run Mythril on a single file
 */
async function runMythrilOnFile(
  filePath: string,
  config: ToolRunnerConfig
): Promise<ToolRunnerResult> {
  const startTime = Date.now();

  const args = [
    'analyze',
    filePath,
    '-o', 'json',
    '--execution-timeout', '60', // 60 seconds per file
    '--max-depth', '22',
  ];

  // Add solc remappings if foundry.toml exists
  const foundryToml = path.join(config.projectPath, 'foundry.toml');
  if (await fs.pathExists(foundryToml)) {
    args.push('--solc-json', foundryToml);
  }

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn('mythril', args, {
      cwd: config.projectPath,
      timeout: config.timeout || 120000, // 2 minutes per file
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

      if (parsed) {
        const findings = parseMythrilOutput(parsed, config.projectPath);

        resolve({
          success: true,
          findings,
          stdout,
          stderr,
          exitCode: code || 0,
          executionTimeMs,
        });
      } else {
        resolve({
          success: code === 0,
          findings: [],
          error: stderr || 'No issues found or analysis failed',
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
 * Run Mythril on a single file via Docker
 */
async function runMythrilOnFileDocker(
  filePath: string,
  config: ToolRunnerConfig
): Promise<ToolRunnerResult> {
  const startTime = Date.now();

  // Get relative path from project root
  const relativePath = path.relative(config.projectPath, filePath);

  const args = [
    'analyze',
    relativePath,
    '-o', 'json',
    '--execution-timeout', '60',
    '--max-depth', '22',
  ];

  try {
    const result = await runToolInDocker({
      ecosystem: 'solidity',
      sourcePath: config.projectPath,
      outputPath: '/tmp/uatu-output',
      tool: 'mythril',
      args,
      timeout: config.timeout || 120000,
      memoryLimit: '4g',
      cpuLimit: '2.0',
    });

    const parsed = parseJsonOutput(result.stdout);

    if (parsed) {
      const findings = parseMythrilOutput(parsed, config.projectPath);

      return {
        success: true,
        findings,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        executionTimeMs: result.executionTime,
      };
    } else {
      return {
        success: result.exitCode === 0,
        findings: [],
        error: result.stderr || 'No issues found or analysis failed',
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        executionTimeMs: result.executionTime,
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
// Parser
// ============================================================================

/**
 * Parse Mythril JSON output into findings
 */
export function parseMythrilOutput(output: any, projectPath: string): StepFinding[] {
  const findings: StepFinding[] = [];

  if (!output?.issues) {
    return findings;
  }

  const issues = output.issues as MythrilIssue[];

  for (const issue of issues) {
    const finding: StepFinding = {
      stepId: 'run-mythril',
      tool: 'mythril',
      findingId: `mythril-${issue.swc_id}-${issue.lineno || 'unknown'}`,
      severity: MYTHRIL_SEVERITY_MAP[issue.severity] || 'medium',
      title: issue.title || getSWCTitle(issue.swc_id),
      description: issue.description || '',
      confidence: issue.severity === 'High' ? 0.9 : issue.severity === 'Medium' ? 0.7 : 0.5,
      rawOutput: {
        swc_id: issue.swc_id,
        title: issue.title,
        severity: issue.severity,
        contract: issue.contract,
        function: issue.function,
        description: issue.description,
      },
    };

    // Add location
    if (issue.filename || issue.lineno) {
      finding.location = {
        file: normalizeFilePath(issue.filename || '', projectPath),
        line: issue.lineno,
      };
    }

    // Generate recommendation based on SWC ID
    finding.recommendation = generateMythrilRecommendation(issue.swc_id, issue);

    findings.push(finding);
  }

  return findings;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Find all Solidity files in a project
 */
async function findSolidityFiles(projectPath: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip common non-source directories
          if (!['node_modules', 'lib', 'cache', 'out', 'artifacts'].includes(entry.name)) {
            await walk(fullPath);
          }
        } else if (entry.name.endsWith('.sol')) {
          files.push(fullPath);
        }
      }
    } catch {
      // Ignore errors
    }
  }

  await walk(projectPath);
  return files;
}

/**
 * Get SWC title from ID
 */
function getSWCTitle(swcId: string): string {
  return SWC_DESCRIPTIONS[swcId] || `Security Issue ${swcId}`;
}

/**
 * Generate recommendation based on SWC ID
 */
function generateMythrilRecommendation(swcId: string, issue: MythrilIssue): string {
  const recommendations: Record<string, string> = {
    'SWC-101': 'Use SafeMath or Solidity 0.8.x which has built-in overflow checks.',
    'SWC-104': 'Always check the return value of low-level calls and handle failures.',
    'SWC-105': 'Add proper access control (onlyOwner) to withdrawal functions.',
    'SWC-106': 'Protect SELFDESTRUCT with strong access control or remove it entirely.',
    'SWC-107': 'Apply the checks-effects-interactions pattern. Use ReentrancyGuard.',
    'SWC-110': 'Review the assert condition. Use require() for input validation instead.',
    'SWC-112': 'Avoid delegatecall to untrusted contracts. Use explicit contract addresses.',
    'SWC-113': 'Use the pull-over-push pattern to avoid DoS from failed calls.',
    'SWC-114': 'Use commit-reveal schemes or accept the risk of front-running.',
    'SWC-115': 'Use msg.sender instead of tx.origin for authentication.',
    'SWC-116': 'Use block.timestamp only for long time periods. Consider Chainlink oracles.',
    'SWC-120': 'Use Chainlink VRF or another secure randomness source.',
    'SWC-124': 'Validate array indices and storage slot calculations.',
    'SWC-128': 'Limit loop iterations or use pagination patterns.',
    'SWC-132': 'Avoid relying on this.balance for critical logic.',
  };

  return recommendations[swcId] ||
    `Review the ${getSWCTitle(swcId)} issue and apply appropriate security measures.`;
}

/**
 * Get category for SWC ID
 */
export function getMythrilCategory(swcId: string): string {
  const categories: Record<string, string[]> = {
    'arithmetic': ['SWC-101', 'SWC-129'],
    'reentrancy': ['SWC-107'],
    'access-control': ['SWC-100', 'SWC-105', 'SWC-106', 'SWC-108', 'SWC-115'],
    'dos': ['SWC-113', 'SWC-126', 'SWC-128'],
    'randomness': ['SWC-116', 'SWC-120'],
    'signature': ['SWC-117', 'SWC-121', 'SWC-122'],
    'low-level': ['SWC-104', 'SWC-112', 'SWC-127'],
  };

  for (const [category, ids] of Object.entries(categories)) {
    if (ids.includes(swcId)) {
      return category;
    }
  }

  return 'other';
}
