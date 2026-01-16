/**
 * Slither Wrapper
 *
 * Wrapper for Trail of Bits Slither static analysis tool.
 * https://github.com/crytic/slither
 */

import { spawn } from 'child_process';
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

interface SlitherDetector {
  check: string;
  impact: 'High' | 'Medium' | 'Low' | 'Informational';
  confidence: 'High' | 'Medium' | 'Low';
  description: string;
  elements: SlitherElement[];
  first_markdown_element?: string;
  markdown?: string;
}

interface SlitherElement {
  type: string;
  name: string;
  source_mapping?: {
    filename_relative: string;
    filename_absolute?: string;
    lines: number[];
    starting_column?: number;
    ending_column?: number;
  };
  type_specific_fields?: {
    parent?: {
      type: string;
      name: string;
    };
  };
}

interface SlitherOutput {
  success: boolean;
  error?: string;
  results?: {
    detectors?: SlitherDetector[];
    printers?: any[];
  };
}

// ============================================================================
// Severity Mapping
// ============================================================================

const SLITHER_SEVERITY_MAP: Record<string, StepFinding['severity']> = {
  'High': 'high',
  'Medium': 'medium',
  'Low': 'low',
  'Informational': 'info',
};

// Detectors to exclude (too noisy or not security-relevant)
const EXCLUDED_DETECTORS = new Set([
  'naming-convention',
  'solc-version',
  'pragma',
  'too-many-digits',
  'assembly',
  'low-level-calls', // Often intentional
]);

// ============================================================================
// Runner
// ============================================================================

/**
 * Check if Slither is available natively
 */
async function checkSlitherNative(): Promise<boolean> {
  try {
    await execAsync('slither --version', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run Slither on a project
 */
export async function runSlither(config: ToolRunnerConfig): Promise<ToolRunnerResult> {
  const startTime = Date.now();

  // Check if native Slither is available
  const nativeAvailable = await checkSlitherNative();

  if (nativeAvailable) {
    // Use native Slither
    return runSlitherNative(config, startTime);
  } else {
    // Try Docker fallback
    const dockerAvailable = await checkDockerAvailable();
    const imageExists = dockerAvailable ? await checkDockerImageExists(ECOSYSTEM_DOCKER_IMAGES.solidity) : false;

    if (imageExists) {
      return runSlitherDocker(config, startTime);
    } else {
      return {
        success: false,
        findings: [],
        error: 'Slither not available. Please install Slither locally or build the Docker image:\n' +
               'Native: pip install slither-analyzer\n' +
               'Docker: docker build -f docker/solidity.Dockerfile -t uatu-audit-solidity:latest .',
        executionTimeMs: Date.now() - startTime,
      };
    }
  }
}

/**
 * Run Slither natively
 */
async function runSlitherNative(config: ToolRunnerConfig, startTime: number): Promise<ToolRunnerResult> {
  // Use args from SOP config, or use defaults
  const args = config.args?.length ? [...config.args] : [
    '.',
    '--json', '-',
    '--exclude', 'naming-convention,solc-version,pragma',
  ];

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn('slither', args, {
      cwd: config.projectPath,
      timeout: config.timeout || 180000,
      env: {
        ...process.env,
        ...config.env,
      },
    });

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      // Report progress if callback provided
      if (config.onProgress && stdout.length > 0) {
        config.onProgress(50, 'Analyzing contracts...');
      }
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const executionTimeMs = Date.now() - startTime;

      // Slither returns non-zero even on success with findings
      // Check if we got valid JSON output
      const parsed = parseJsonOutput(stdout);

      if (parsed) {
        const findings = parseSlitherOutput(parsed, config.projectPath);

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
          success: false,
          findings: [],
          error: stderr || 'Failed to parse Slither output',
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
 * Run Slither via Docker
 */
async function runSlitherDocker(config: ToolRunnerConfig, startTime: number): Promise<ToolRunnerResult> {
  // Use args from SOP config, or use defaults
  const args = config.args?.length ? [...config.args] : [
    '.',
    '--json', '-',
    '--exclude', 'naming-convention,solc-version,pragma',
  ];

  config.onProgress?.(30, 'Running Slither in Docker...');

  try {
    const result = await runToolInDocker({
      ecosystem: 'solidity',
      sourcePath: config.projectPath,
      outputPath: '/tmp/uatu-output',
      tool: 'slither',
      args,
      timeout: config.timeout || 180000,
      memoryLimit: '4g',
      cpuLimit: '2.0',
    });

    config.onProgress?.(90, 'Parsing results...');

    const parsed = parseJsonOutput(result.stdout);

    if (parsed) {
      const findings = parseSlitherOutput(parsed, config.projectPath);

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
        success: false,
        findings: [],
        error: result.stderr || 'Failed to parse Slither output',
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
 * Parse Slither JSON output into findings
 */
export function parseSlitherOutput(output: any, projectPath: string): StepFinding[] {
  const findings: StepFinding[] = [];

  if (!output?.results?.detectors) {
    return findings;
  }

  const detectors = output.results.detectors as SlitherDetector[];

  for (const detector of detectors) {
    // Skip excluded detectors
    if (EXCLUDED_DETECTORS.has(detector.check)) {
      continue;
    }

    // Extract location from first element
    const firstElement = detector.elements?.[0];
    const sourceMapping = firstElement?.source_mapping;

    const finding: StepFinding = {
      stepId: 'run-slither',
      tool: 'slither',
      findingId: `slither-${detector.check}-${sourceMapping?.lines?.[0] || 'unknown'}`,
      severity: SLITHER_SEVERITY_MAP[detector.impact] || 'info',
      title: formatDetectorTitle(detector.check),
      description: detector.description || detector.markdown || '',
      confidence: detector.confidence === 'High' ? 1 : detector.confidence === 'Medium' ? 0.7 : 0.4,
      rawOutput: {
        id: detector.check,
        check: detector.check,
        impact: detector.impact,
        confidence: detector.confidence,
        description: detector.description,
        markdown: detector.markdown,
        first_markdown_element: detector.first_markdown_element,
      },
    };

    // Add location if available
    if (sourceMapping) {
      finding.location = {
        file: normalizeFilePath(sourceMapping.filename_relative || sourceMapping.filename_absolute || '', projectPath),
        line: sourceMapping.lines?.[0],
        column: sourceMapping.starting_column,
      };
    }

    // Generate recommendation based on detector type
    finding.recommendation = generateRecommendation(detector.check, detector);

    findings.push(finding);
  }

  return findings;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format detector check name into readable title
 */
function formatDetectorTitle(check: string): string {
  // Convert kebab-case to Title Case
  const title = check
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Add common prefixes
  const prefixes: Record<string, string> = {
    'reentrancy': 'Reentrancy Vulnerability: ',
    'uninitialized': 'Uninitialized Variable: ',
    'unused': 'Unused: ',
    'shadowing': 'Variable Shadowing: ',
    'unchecked': 'Unchecked: ',
    'arbitrary': 'Arbitrary: ',
    'locked': 'Locked: ',
  };

  for (const [key, prefix] of Object.entries(prefixes)) {
    if (check.includes(key)) {
      return prefix + title.replace(prefix.trim(), '').trim();
    }
  }

  return title;
}

/**
 * Generate recommendation based on detector type
 */
function generateRecommendation(check: string, detector: SlitherDetector): string {
  const recommendations: Record<string, string> = {
    'reentrancy-eth': 'Apply the checks-effects-interactions pattern. Use ReentrancyGuard from OpenZeppelin or ensure state changes happen before external calls.',
    'reentrancy-no-eth': 'Apply the checks-effects-interactions pattern. Ensure all state changes occur before any external calls.',
    'reentrancy-benign': 'While not directly exploitable, consider applying checks-effects-interactions pattern for defense in depth.',
    'uninitialized-state': 'Initialize the state variable in the constructor or at declaration.',
    'uninitialized-local': 'Initialize the local variable before use.',
    'shadowing-state': 'Rename the variable to avoid shadowing the state variable.',
    'shadowing-local': 'Rename the local variable to avoid confusion.',
    'unchecked-transfer': 'Use SafeERC20 from OpenZeppelin to safely handle token transfers.',
    'unchecked-lowlevel': 'Check the return value of low-level calls and handle failures appropriately.',
    'arbitrary-send-eth': 'Validate the destination address and consider using a withdrawal pattern.',
    'arbitrary-send-erc20': 'Validate the token recipient and consider using a withdrawal pattern.',
    'locked-ether': 'Add a withdraw function to allow the contract owner to retrieve locked ETH.',
    'suicidal': 'Remove or protect the selfdestruct/suicide call with proper access control.',
    'controlled-delegatecall': 'Avoid using delegatecall with user-controlled data. Use explicit contract addresses.',
    'tx-origin': 'Use msg.sender instead of tx.origin for authentication.',
    'incorrect-equality': 'Use greater-than or less-than comparisons instead of strict equality for balance checks.',
    'weak-prng': 'Use Chainlink VRF or another secure randomness source instead of block variables.',
  };

  return recommendations[check] ||
    `Review the ${formatDetectorTitle(check)} issue and apply appropriate fixes based on the context.`;
}

/**
 * Get detector category
 */
export function getSlitherDetectorCategory(check: string): string {
  const categories: Record<string, string[]> = {
    'reentrancy': ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
    'access-control': ['unprotected-upgrade', 'suicidal', 'protected-vars', 'arbitrary-send-eth'],
    'arithmetic': ['divide-before-multiply', 'incorrect-equality'],
    'low-level': ['unchecked-lowlevel', 'controlled-delegatecall', 'assembly'],
    'state': ['uninitialized-state', 'uninitialized-local', 'shadowing-state'],
    'erc': ['unchecked-transfer', 'erc20-interface', 'arbitrary-send-erc20'],
  };

  for (const [category, detectors] of Object.entries(categories)) {
    if (detectors.includes(check)) {
      return category;
    }
  }

  return 'other';
}
