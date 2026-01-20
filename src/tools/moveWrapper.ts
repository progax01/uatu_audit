/**
 * Move CLI Wrappers (Aptos & Sui)
 *
 * Wrapper for Move framework commands for Aptos and Sui blockchains
 * Also includes Hardhat and cargo-contract wrappers
 */

import { spawn } from 'child_process';
import type { ToolRunnerConfig, ToolRunnerResult, StepFinding } from '../sops/definitions/types.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'move-wrapper' });

// ============================================================================
// Aptos Move
// ============================================================================

/**
 * Run Aptos Move compile
 */
export async function runAptos(config: ToolRunnerConfig): Promise<ToolRunnerResult> {
  const {
    projectPath,
    args = [],
    timeout = 180000,
    onProgress,
    command = 'move compile',
  } = config;

  log.info('Running Aptos', { projectPath, command, args });

  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Split command if it contains spaces (e.g., "move compile")
    const cmdParts = command.split(' ');
    const subCmds = cmdParts;

    const proc = spawn('aptos', [...subCmds, ...args], {
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
        onProgress?.(30, 'Compiling Move modules...');
      } else if (chunk.includes('Success')) {
        onProgress?.(90, 'Compilation successful');
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

      const findings = parseMoveCompileOutput(stdout, stderr, 'aptos');

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
      log.error('Aptos process error', { error: error.message });
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
 * Run Aptos Move test
 */
export async function runAptosTest(config: ToolRunnerConfig): Promise<ToolRunnerResult> {
  return runAptos({
    ...config,
    command: 'move test',
    args: config.args || [],
  });
}

/**
 * Run Aptos Move Prover
 */
export async function runAptosProver(config: ToolRunnerConfig): Promise<ToolRunnerResult> {
  const {
    projectPath,
    args = [],
    timeout = 300000,
    onProgress,
  } = config;

  log.info('Running Aptos Move Prover', { projectPath, args });

  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const proc = spawn('aptos', ['move', 'prove', ...args], {
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

      if (chunk.includes('proving')) {
        onProgress?.(50, 'Proving specifications...');
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

      const findings = parseProverOutput(stdout, stderr);

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
// Sui Move
// ============================================================================

/**
 * Run Sui Move build
 */
export async function runSui(config: ToolRunnerConfig): Promise<ToolRunnerResult> {
  const {
    projectPath,
    args = [],
    timeout = 180000,
    onProgress,
    command = 'move build',
  } = config;

  log.info('Running Sui', { projectPath, command, args });

  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Split command if it contains spaces
    const cmdParts = command.split(' ');
    const subCmds = cmdParts;

    const proc = spawn('sui', [...subCmds, ...args], {
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

      if (chunk.includes('Compiling') || chunk.includes('Building')) {
        onProgress?.(30, 'Building Sui modules...');
      } else if (chunk.includes('Successfully') || chunk.includes('Built')) {
        onProgress?.(90, 'Build successful');
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

      const findings = parseMoveCompileOutput(stdout, stderr, 'sui');

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
      log.error('Sui process error', { error: error.message });
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
 * Run Sui Move test
 */
export async function runSuiTest(config: ToolRunnerConfig): Promise<ToolRunnerResult> {
  return runSui({
    ...config,
    command: 'move test',
    args: config.args || [],
  });
}

// ============================================================================
// Hardhat
// ============================================================================

/**
 * Run Hardhat compile
 */
export async function runHardhat(config: ToolRunnerConfig): Promise<ToolRunnerResult> {
  const {
    projectPath,
    args = ['--force'],
    timeout = 180000,
    onProgress,
    command = 'compile',
  } = config;

  log.info('Running Hardhat', { projectPath, command, args });

  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const proc = spawn('npx', ['hardhat', command, ...args], {
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
        onProgress?.(30, 'Compiling contracts...');
      } else if (chunk.includes('Compilation finished')) {
        onProgress?.(90, 'Compilation successful');
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

      const findings = parseHardhatOutput(stdout, stderr);

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
      log.error('Hardhat process error', { error: error.message });
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
 * Run Hardhat test
 */
export async function runHardhatTest(config: ToolRunnerConfig): Promise<ToolRunnerResult> {
  return runHardhat({
    ...config,
    command: 'test',
    args: config.args || [],
  });
}

// ============================================================================
// ink! / Cargo Contract
// ============================================================================

/**
 * Run cargo-contract build
 */
export async function runCargoContract(config: ToolRunnerConfig): Promise<ToolRunnerResult> {
  const {
    projectPath,
    args = ['--release'],
    timeout = 300000,
    onProgress,
    command = 'build',
  } = config;

  log.info('Running cargo-contract', { projectPath, command, args });

  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const proc = spawn('cargo', ['contract', command, ...args], {
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
        onProgress?.(30, 'Compiling contract...');
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

      const findings = parseCargoContractOutput(stdout, stderr);

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
      log.error('cargo-contract process error', { error: error.message });
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

function parseMoveCompileOutput(stdout: string, stderr: string, tool: string): StepFinding[] {
  const findings: StepFinding[] = [];
  const combined = stdout + stderr;

  // Parse Move compiler errors
  const errorPattern = /error\[([^\]]+)\]:\s*(.+?)(?:\s*┌─\s*([^:]+):(\d+):(\d+))?/gs;
  const warningPattern = /warning\[([^\]]+)\]:\s*(.+?)(?:\s*┌─\s*([^:]+):(\d+):(\d+))?/gs;

  let match;
  while ((match = errorPattern.exec(combined)) !== null) {
    findings.push({
      stepId: `${tool}-compile`,
      tool,
      findingId: `${tool}-err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      severity: 'high',
      title: `Move Error: ${match[1]}`,
      description: match[2].trim(),
      location: match[3] ? {
        file: match[3],
        line: parseInt(match[4] || '0', 10),
        column: parseInt(match[5] || '0', 10),
      } : undefined,
    });
  }

  while ((match = warningPattern.exec(combined)) !== null) {
    findings.push({
      stepId: `${tool}-compile`,
      tool,
      findingId: `${tool}-warn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      severity: 'low',
      title: `Move Warning: ${match[1]}`,
      description: match[2].trim(),
      location: match[3] ? {
        file: match[3],
        line: parseInt(match[4] || '0', 10),
        column: parseInt(match[5] || '0', 10),
      } : undefined,
    });
  }

  return findings;
}

function parseProverOutput(stdout: string, stderr: string): StepFinding[] {
  const findings: StepFinding[] = [];
  const combined = stdout + stderr;

  // Parse prover errors
  const errorPattern = /error:\s*(.+?)(?:\s*at\s*([^:]+):(\d+))?/g;
  const abortPattern = /abort\s*(\d+)\s*at\s*([^:]+):(\d+)/g;

  let match;
  while ((match = errorPattern.exec(combined)) !== null) {
    findings.push({
      stepId: 'move-prover',
      tool: 'move-prover',
      findingId: `prover-err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      severity: 'high',
      title: 'Specification Violation',
      description: match[1].trim(),
      location: match[2] ? {
        file: match[2],
        line: parseInt(match[3] || '0', 10),
      } : undefined,
    });
  }

  while ((match = abortPattern.exec(combined)) !== null) {
    findings.push({
      stepId: 'move-prover',
      tool: 'move-prover',
      findingId: `prover-abort-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      severity: 'medium',
      title: 'Potential Abort',
      description: `Function may abort with code ${match[1]}`,
      location: {
        file: match[2],
        line: parseInt(match[3], 10),
      },
    });
  }

  return findings;
}

function parseHardhatOutput(stdout: string, stderr: string): StepFinding[] {
  const findings: StepFinding[] = [];
  const combined = stdout + stderr;

  // Parse Solidity warnings
  const warningPattern = /Warning:\s*(.+?)(?:\s*-->\s*([^:]+):(\d+):(\d+))?/g;
  const errorPattern = /Error:\s*(.+?)(?:\s*-->\s*([^:]+):(\d+):(\d+))?/g;

  let match;
  while ((match = warningPattern.exec(combined)) !== null) {
    const description = match[1].trim();

    // Filter out broken/malformed warnings
    // Skip if description is empty, single character, or not meaningful
    if (!description || description.length < 3 || /^[^a-zA-Z]*$/.test(description)) {
      continue;
    }

    // Filter out noise warnings (same as compiler warning filter)
    const lowerDesc = description.toLowerCase();
    const noisePatterns = [
      'spdx license',
      'unused local variable',
      'unused function parameter',
      'unused return value',
      'contract code size',
      'shadowed declaration',
      'function state mutability can be restricted',
    ];

    if (noisePatterns.some(pattern => lowerDesc.includes(pattern))) {
      continue;
    }

    findings.push({
      stepId: 'hardhat-compile',
      tool: 'hardhat',
      findingId: `hardhat-warn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      severity: 'low',
      title: 'Compiler Warning',
      description,
      location: match[2] ? {
        file: match[2],
        line: parseInt(match[3] || '0', 10),
        column: parseInt(match[4] || '0', 10),
      } : undefined,
    });
  }

  while ((match = errorPattern.exec(combined)) !== null) {
    const description = match[1].trim();

    // Filter out broken/malformed errors
    if (!description || description.length < 3 || /^[^a-zA-Z]*$/.test(description)) {
      continue;
    }

    findings.push({
      stepId: 'hardhat-compile',
      tool: 'hardhat',
      findingId: `hardhat-err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      severity: 'high',
      title: 'Compiler Error',
      description,
      location: match[2] ? {
        file: match[2],
        line: parseInt(match[3] || '0', 10),
        column: parseInt(match[4] || '0', 10),
      } : undefined,
    });
  }

  return findings;
}

function parseCargoContractOutput(stdout: string, stderr: string): StepFinding[] {
  const findings: StepFinding[] = [];
  const combined = stdout + stderr;

  // Parse Rust warnings/errors
  const warningPattern = /warning(?:\[([^\]]+)\])?: (.+?)(?:\n\s*--> ([^:]+):(\d+):(\d+))?/g;
  const errorPattern = /error(?:\[([^\]]+)\])?: (.+?)(?:\n\s*--> ([^:]+):(\d+):(\d+))?/g;

  let match;
  while ((match = warningPattern.exec(combined)) !== null) {
    findings.push({
      stepId: 'cargo-contract-build',
      tool: 'cargo-contract',
      findingId: `cargo-contract-warn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      severity: 'low',
      title: 'Compiler Warning',
      description: match[2],
      location: match[3] ? {
        file: match[3],
        line: parseInt(match[4] || '0', 10),
        column: parseInt(match[5] || '0', 10),
      } : undefined,
    });
  }

  while ((match = errorPattern.exec(combined)) !== null) {
    findings.push({
      stepId: 'cargo-contract-build',
      tool: 'cargo-contract',
      findingId: `cargo-contract-err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      severity: 'high',
      title: 'Compiler Error',
      description: match[2],
      location: match[3] ? {
        file: match[3],
        line: parseInt(match[4] || '0', 10),
        column: parseInt(match[5] || '0', 10),
      } : undefined,
    });
  }

  return findings;
}
