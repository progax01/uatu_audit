/**
 * Anchor CLI Wrapper
 *
 * Wrapper for Anchor framework commands (build, test, etc.)
 */

import { spawn } from 'child_process';
import type { ToolRunnerConfig, ToolRunnerResult, StepFinding } from '../sops/definitions/types.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'anchor-wrapper' });

/**
 * Run Anchor build command
 */
export async function runAnchor(config: ToolRunnerConfig): Promise<ToolRunnerResult> {
  const {
    projectPath,
    args = [],
    timeout = 300000,
    onProgress,
    command = 'build',
  } = config;

  log.info('Running Anchor', { projectPath, command, args });

  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const proc = spawn('anchor', [command, ...args], {
      cwd: projectPath,
      shell: true,
      env: { ...process.env },
    });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, timeout);

    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;

      if (chunk.includes('Compiling')) {
        onProgress?.(30, 'Compiling programs...');
      } else if (chunk.includes('Finished')) {
        onProgress?.(90, 'Build finishing...');
      }
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      const executionTimeMs = Date.now() - startTime;

      if (timedOut) {
        resolve({
          success: false,
          findings: [],
          executionTimeMs,
          error: 'Timeout',
        });
        return;
      }

      const findings = parseAnchorOutput(stdout, stderr);

      resolve({
        success: code === 0,
        findings,
        stdout,
        stderr,
        exitCode: code || 0,
        executionTimeMs,
      });
    });

    proc.on('error', (error) => {
      clearTimeout(timeoutId);
      log.error('Anchor process error', { error: error.message });
      resolve({
        success: false,
        findings: [],
        executionTimeMs: Date.now() - startTime,
        error: error.message,
      });
    });
  });
}

/**
 * Run Anchor test command
 */
export async function runAnchorTest(config: ToolRunnerConfig): Promise<ToolRunnerResult> {
  return runAnchor({
    ...config,
    command: 'test',
    args: config.args || ['--skip-local-validator'],
  });
}

/**
 * Run Cargo Clippy for Rust/Anchor projects
 */
export async function runCargoClippy(config: ToolRunnerConfig): Promise<ToolRunnerResult> {
  const {
    projectPath,
    args = ['--', '-W', 'clippy::all', '--message-format=json'],
    timeout = 120000,
    onProgress,
  } = config;

  log.info('Running Cargo Clippy', { projectPath });

  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const proc = spawn('cargo', ['clippy', ...args], {
      cwd: projectPath,
      shell: true,
      env: { ...process.env },
    });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, timeout);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;

      if (chunk.includes('Checking')) {
        onProgress?.(50, 'Checking code...');
      }
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      const executionTimeMs = Date.now() - startTime;

      if (timedOut) {
        resolve({
          success: false,
          findings: [],
          executionTimeMs,
          error: 'Timeout',
        });
        return;
      }

      const findings = parseClippyOutput(stdout);

      resolve({
        success: code === 0 || findings.every(f => f.severity !== 'critical' && f.severity !== 'high'),
        findings,
        stdout,
        stderr,
        exitCode: code || 0,
        executionTimeMs,
      });
    });

    proc.on('error', (error) => {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        findings: [],
        executionTimeMs: Date.now() - startTime,
        error: error.message,
      });
    });
  });
}

/**
 * Run Cargo Audit for dependency vulnerabilities
 */
export async function runCargoAudit(config: ToolRunnerConfig): Promise<ToolRunnerResult> {
  const {
    projectPath,
    args = ['--json'],
    timeout = 60000,
  } = config;

  log.info('Running Cargo Audit', { projectPath });

  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const proc = spawn('cargo', ['audit', ...args], {
      cwd: projectPath,
      shell: true,
      env: { ...process.env },
    });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, timeout);

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      const executionTimeMs = Date.now() - startTime;

      if (timedOut) {
        resolve({
          success: false,
          findings: [],
          executionTimeMs,
          error: 'Timeout',
        });
        return;
      }

      const findings = parseCargoAuditOutput(stdout);

      resolve({
        success: code === 0,
        findings,
        stdout,
        stderr,
        exitCode: code || 0,
        executionTimeMs,
      });
    });

    proc.on('error', (error) => {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        findings: [],
        executionTimeMs: Date.now() - startTime,
        error: error.message,
      });
    });
  });
}

/**
 * Run Soteria scanner for Solana programs
 */
export async function runSoteria(config: ToolRunnerConfig): Promise<ToolRunnerResult> {
  const {
    projectPath,
    args = ['-analyzeAll'],
    timeout = 180000,
    onProgress,
  } = config;

  log.info('Running Soteria', { projectPath });

  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const proc = spawn('soteria', args, {
      cwd: projectPath,
      shell: true,
      env: { ...process.env },
    });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, timeout);

    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;

      if (chunk.includes('Analyzing')) {
        onProgress?.(50, 'Analyzing programs...');
      }
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      const executionTimeMs = Date.now() - startTime;

      if (timedOut) {
        resolve({
          success: false,
          findings: [],
          executionTimeMs,
          error: 'Timeout',
        });
        return;
      }

      const findings = parseSoteriaOutput(stdout);

      resolve({
        success: code === 0,
        findings,
        stdout,
        stderr,
        exitCode: code || 0,
        executionTimeMs,
      });
    });

    proc.on('error', (error) => {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        findings: [],
        executionTimeMs: Date.now() - startTime,
        error: error.message,
      });
    });
  });
}

// ============================================================================
// Output Parsers
// ============================================================================

function parseAnchorOutput(stdout: string, stderr: string): StepFinding[] {
  const findings: StepFinding[] = [];
  const combined = stdout + stderr;

  const warningPattern = /warning(?:\[([^\]]+)\])?: (.+?)(?:\n\s*--> ([^:]+):(\d+):(\d+))?/g;
  const errorPattern = /error(?:\[([^\]]+)\])?: (.+?)(?:\n\s*--> ([^:]+):(\d+):(\d+))?/g;

  let match;
  while ((match = warningPattern.exec(combined)) !== null) {
    findings.push({
      stepId: 'anchor-build',
      tool: 'anchor',
      findingId: `anchor-warn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      severity: 'low',
      title: 'Compiler Warning',
      description: match[2],
      location: match[3] ? {
        file: match[3],
        line: parseInt(match[4] || '0', 10),
      } : undefined,
    });
  }

  while ((match = errorPattern.exec(combined)) !== null) {
    findings.push({
      stepId: 'anchor-build',
      tool: 'anchor',
      findingId: `anchor-err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      severity: 'high',
      title: 'Compiler Error',
      description: match[2],
      location: match[3] ? {
        file: match[3],
        line: parseInt(match[4] || '0', 10),
      } : undefined,
    });
  }

  return findings;
}

function parseClippyOutput(stdout: string): StepFinding[] {
  const findings: StepFinding[] = [];
  const lines = stdout.split('\n').filter(line => line.trim());

  for (const line of lines) {
    try {
      const msg = JSON.parse(line);

      if (msg.reason === 'compiler-message' && msg.message) {
        const m = msg.message;

        if (m.level === 'warning' || m.level === 'error') {
          const span = m.spans?.[0];

          findings.push({
            stepId: 'cargo-clippy',
            tool: 'clippy',
            findingId: `clippy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            severity: m.level === 'error' ? 'high' : 'low',
            title: m.code?.code || 'Clippy Warning',
            description: m.message,
            location: span ? {
              file: span.file_name,
              line: span.line_start,
            } : undefined,
            recommendation: m.children?.find((c: any) => c.level === 'help')?.message,
          });
        }
      }
    } catch {
      // Skip non-JSON lines
    }
  }

  return findings;
}

function parseCargoAuditOutput(stdout: string): StepFinding[] {
  const findings: StepFinding[] = [];

  try {
    const result = JSON.parse(stdout);

    if (result.vulnerabilities?.list) {
      for (const vuln of result.vulnerabilities.list) {
        findings.push({
          stepId: 'cargo-audit',
          tool: 'cargo-audit',
          findingId: vuln.advisory?.id || `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          severity: mapRustSecSeverity(vuln.advisory?.severity),
          title: vuln.advisory?.title || 'Vulnerable Dependency',
          description: `${vuln.package?.name}@${vuln.package?.version}: ${vuln.advisory?.description || ''}`,
          recommendation: vuln.advisory?.url ? `See ${vuln.advisory.url}` : undefined,
        });
      }
    }
  } catch {
    // Parse failed
  }

  return findings;
}

function parseSoteriaOutput(stdout: string): StepFinding[] {
  const findings: StepFinding[] = [];

  const patterns = [
    { regex: /\[HIGH\]\s*(.+?):\s*(.+)/g, severity: 'high' as const },
    { regex: /\[MEDIUM\]\s*(.+?):\s*(.+)/g, severity: 'medium' as const },
    { regex: /\[LOW\]\s*(.+?):\s*(.+)/g, severity: 'low' as const },
    { regex: /\[INFO\]\s*(.+?):\s*(.+)/g, severity: 'info' as const },
  ];

  for (const { regex, severity } of patterns) {
    let match;
    while ((match = regex.exec(stdout)) !== null) {
      findings.push({
        stepId: 'soteria',
        tool: 'soteria',
        findingId: `soteria-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        severity,
        title: match[1],
        description: match[2],
      });
    }
  }

  return findings;
}

function mapRustSecSeverity(severity?: string): StepFinding['severity'] {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'medium':
    case 'moderate':
      return 'medium';
    case 'low':
      return 'low';
    default:
      return 'medium';
  }
}
