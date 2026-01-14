/**
 * Semgrep Wrapper
 *
 * Wrapper for Semgrep pattern-based static analysis tool.
 * https://github.com/returntocorp/semgrep
 */

import { spawn } from 'child_process';
import type { ToolRunnerConfig, ToolRunnerResult, StepFinding } from '../sops/definitions/types';
import { normalizeFilePath, parseJsonOutput } from './index';

// ============================================================================
// Types
// ============================================================================

interface SemgrepResult {
  check_id: string;
  path: string;
  start: {
    line: number;
    col: number;
    offset: number;
  };
  end: {
    line: number;
    col: number;
    offset: number;
  };
  extra: {
    message: string;
    severity: 'ERROR' | 'WARNING' | 'INFO';
    metadata?: {
      category?: string;
      confidence?: string;
      cwe?: string[];
      impact?: string;
      likelihood?: string;
      owasp?: string[];
      references?: string[];
      technology?: string[];
    };
    fix?: string;
    lines?: string;
  };
}

interface SemgrepOutput {
  errors?: any[];
  results?: SemgrepResult[];
  paths?: {
    scanned: string[];
  };
  version?: string;
}

// ============================================================================
// Severity Mapping
// ============================================================================

const SEMGREP_SEVERITY_MAP: Record<string, StepFinding['severity']> = {
  'ERROR': 'high',
  'WARNING': 'medium',
  'INFO': 'low',
};

// Smart contract specific rulesets
const SMART_CONTRACT_CONFIGS = [
  'p/smart-contracts',
  'p/solidity',
];

// ============================================================================
// Runner
// ============================================================================

/**
 * Run Semgrep on a project
 */
export async function runSemgrep(config: ToolRunnerConfig): Promise<ToolRunnerResult> {
  const startTime = Date.now();

  const args = [
    '--json',
    '--config', 'p/smart-contracts',
    '--config', 'auto',
    '--no-git-ignore', // Include all files
    '.',
  ];

  // Add additional args
  if (config.args?.length) {
    args.push(...config.args);
  }

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn('semgrep', args, {
      cwd: config.projectPath,
      timeout: config.timeout || 120000, // 2 minutes
      env: {
        ...process.env,
        ...config.env,
        // Disable telemetry
        SEMGREP_SEND_METRICS: 'off',
      },
    });

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      // Progress updates
      if (stderr.includes('running')) {
        config.onProgress?.(50, 'Running pattern matching...');
      }
    });

    proc.on('close', (code) => {
      const executionTimeMs = Date.now() - startTime;
      const parsed = parseJsonOutput(stdout);

      if (parsed) {
        const findings = parseSemgrepOutput(parsed, config.projectPath);

        resolve({
          success: true,
          findings,
          stdout,
          stderr,
          exitCode: code || 0,
          executionTimeMs,
          toolVersion: parsed.version,
        });
      } else {
        resolve({
          success: code === 0,
          findings: [],
          error: code !== 0 ? (stderr || 'Semgrep analysis failed') : undefined,
          stdout,
          stderr,
          exitCode: code || 0,
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
// Parser
// ============================================================================

/**
 * Parse Semgrep JSON output into findings
 */
export function parseSemgrepOutput(output: any, projectPath: string): StepFinding[] {
  const findings: StepFinding[] = [];

  if (!output?.results) {
    return findings;
  }

  const results = output.results as SemgrepResult[];

  for (const result of results) {
    const metadata = result.extra.metadata || {};

    const finding: StepFinding = {
      stepId: 'run-semgrep',
      tool: 'semgrep',
      findingId: `semgrep-${result.check_id}-${result.start.line}`,
      severity: mapSemgrepSeverity(result.extra.severity, metadata),
      title: formatRuleTitle(result.check_id),
      description: result.extra.message,
      confidence: mapConfidence(metadata.confidence),
      rawOutput: result,
    };

    // Add location
    finding.location = {
      file: normalizeFilePath(result.path, projectPath),
      line: result.start.line,
      column: result.start.col,
    };

    // Add recommendation
    if (result.extra.fix) {
      finding.recommendation = `Suggested fix: ${result.extra.fix}`;
    } else {
      finding.recommendation = generateSemgrepRecommendation(result.check_id, metadata);
    }

    findings.push(finding);
  }

  return findings;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Map Semgrep severity considering metadata
 */
function mapSemgrepSeverity(
  severity: string,
  metadata: SemgrepResult['extra']['metadata']
): StepFinding['severity'] {
  // Use impact from metadata if available
  if (metadata?.impact) {
    const impact = metadata.impact.toLowerCase();
    if (impact === 'high' || impact === 'critical') return 'high';
    if (impact === 'medium') return 'medium';
    if (impact === 'low') return 'low';
  }

  return SEMGREP_SEVERITY_MAP[severity] || 'medium';
}

/**
 * Map confidence string to number
 */
function mapConfidence(confidence?: string): number {
  if (!confidence) return 0.7;

  const conf = confidence.toLowerCase();
  if (conf === 'high') return 0.9;
  if (conf === 'medium') return 0.7;
  if (conf === 'low') return 0.4;

  return 0.7;
}

/**
 * Format rule ID into readable title
 */
function formatRuleTitle(checkId: string): string {
  // Extract the rule name from the full ID
  // e.g., "solidity.security.reentrancy" -> "Reentrancy"
  const parts = checkId.split('.');
  const ruleName = parts[parts.length - 1];

  // Convert to title case and expand common abbreviations
  return ruleName
    .split(/[-_]/)
    .map((word) => {
      // Handle common abbreviations
      const abbrevs: Record<string, string> = {
        'dos': 'DoS',
        'sql': 'SQL',
        'xss': 'XSS',
        'csrf': 'CSRF',
        'ssrf': 'SSRF',
        'xxe': 'XXE',
        'rce': 'RCE',
        'lfi': 'LFI',
        'ssti': 'SSTI',
      };

      if (abbrevs[word.toLowerCase()]) {
        return abbrevs[word.toLowerCase()];
      }

      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Generate recommendation based on rule ID and metadata
 */
function generateSemgrepRecommendation(
  checkId: string,
  metadata: SemgrepResult['extra']['metadata']
): string {
  // Check for references first
  if (metadata?.references?.length) {
    return `Review the following references for remediation guidance: ${metadata.references.slice(0, 2).join(', ')}`;
  }

  // Common pattern-based recommendations
  const patterns: Record<string, string> = {
    'reentrancy': 'Apply the checks-effects-interactions pattern. Use ReentrancyGuard from OpenZeppelin.',
    'overflow': 'Use SafeMath or Solidity 0.8.x which has built-in overflow checks.',
    'underflow': 'Use SafeMath or Solidity 0.8.x which has built-in underflow checks.',
    'access-control': 'Implement proper access control using OpenZeppelin Access Control or Ownable.',
    'tx-origin': 'Use msg.sender instead of tx.origin for authentication.',
    'delegatecall': 'Avoid delegatecall to untrusted contracts. Validate target addresses.',
    'selfdestruct': 'Protect selfdestruct with proper access control or remove it entirely.',
    'timestamp': 'Avoid using block.timestamp for critical logic. Use Chainlink oracles for time.',
    'randomness': 'Use Chainlink VRF for secure randomness instead of block variables.',
    'unchecked': 'Check return values of external calls and handle failures appropriately.',
    'assembly': 'Review assembly code carefully for memory safety and correctness.',
    'storage': 'Ensure storage pointers are properly initialized before use.',
  };

  const lowerCheckId = checkId.toLowerCase();

  for (const [pattern, recommendation] of Object.entries(patterns)) {
    if (lowerCheckId.includes(pattern)) {
      return recommendation;
    }
  }

  // Default recommendation
  return 'Review the flagged code and apply appropriate security best practices.';
}

/**
 * Get category from check ID
 */
export function getSemgrepCategory(checkId: string): string {
  const lowerCheckId = checkId.toLowerCase();

  const categories: Record<string, string[]> = {
    'reentrancy': ['reentrancy', 'reentrant'],
    'access-control': ['access', 'auth', 'permission', 'role', 'owner'],
    'arithmetic': ['overflow', 'underflow', 'division'],
    'injection': ['injection', 'sql', 'command', 'xss'],
    'configuration': ['config', 'pragma', 'version'],
    'gas': ['gas', 'loop', 'optimization'],
    'cryptography': ['crypto', 'random', 'signature', 'hash'],
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some((kw) => lowerCheckId.includes(kw))) {
      return category;
    }
  }

  return 'other';
}

/**
 * Filter out noisy or irrelevant rules
 */
export function shouldIncludeRule(checkId: string, severity: string): boolean {
  // Exclude certain rules that are too noisy
  const excludedRules = new Set([
    'generic.secrets.gitleaks',
    'generic.ci.security.audit',
  ]);

  if (excludedRules.has(checkId)) {
    return false;
  }

  // For INFO level, only include security-relevant rules
  if (severity === 'INFO') {
    const securityKeywords = ['security', 'vuln', 'attack', 'inject', 'exploit'];
    return securityKeywords.some((kw) => checkId.toLowerCase().includes(kw));
  }

  return true;
}
