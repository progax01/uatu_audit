/**
 * Simple Claude CLI Executor
 *
 * Uses child_process instead of node-pty for better compatibility.
 * Designed for one-shot quick scans without PTY overhead.
 */

import { spawn, execSync } from 'child_process';
import { writeFileSync, unlinkSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { logger } from '../../utils/logger.js';

const log = logger.child({ service: 'simple-claude' });

export interface SimpleClaudeOptions {
  timeout?: number;
  model?: string;
  cwd?: string;
}

export interface SimpleClaudeResponse {
  success: boolean;
  output?: string;
  error?: string;
  executionTime?: number;
}

/**
 * Find Claude CLI path
 */
function findClaudePath(): string {
  // Check env var first
  if (process.env.CLAUDE_CLI_PATH) {
    try {
      execSync(`test -f "${process.env.CLAUDE_CLI_PATH}"`, { stdio: 'pipe' });
      return process.env.CLAUDE_CLI_PATH;
    } catch {}
  }

  // Try which command
  try {
    const path = execSync('which claude', { stdio: 'pipe', encoding: 'utf8' }).trim();
    if (path) return path;
  } catch {}

  // Check common locations
  const homeDir = process.env.HOME || `/Users/${process.env.USER || 'user'}`;
  const paths = [
    `${homeDir}/.nvm/versions/node/v24.12.0/bin/claude`,
    `${homeDir}/.nvm/versions/node/v22.0.0/bin/claude`,
    `${homeDir}/.nvm/versions/node/v20.0.0/bin/claude`,
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
  ];

  for (const p of paths) {
    try {
      execSync(`test -f "${p}"`, { stdio: 'pipe' });
      return p;
    } catch {}
  }

  return 'claude';
}

/**
 * Check if Claude CLI is available
 */
export function isClaudeAvailable(): boolean {
  try {
    const claudePath = findClaudePath();
    if (claudePath === 'claude') {
      execSync('which claude', { stdio: 'pipe' });
    } else {
      execSync(`test -f "${claudePath}"`, { stdio: 'pipe' });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute Claude CLI with a prompt
 */
export async function executeSimpleClaude(
  prompt: string,
  options: SimpleClaudeOptions = {}
): Promise<SimpleClaudeResponse> {
  const startTime = Date.now();
  const {
    timeout = 180000,
    model = 'claude-sonnet-4-20250514',
    cwd = process.cwd()
  } = options;

  const claudePath = findClaudePath();
  log.info('Executing Claude CLI (simple mode)', { claudePath, model, promptLength: prompt.length });

  // Write prompt to temp file
  const tempDir = mkdtempSync(join(tmpdir(), 'claude-quick-'));
  const promptFile = join(tempDir, 'prompt.txt');
  writeFileSync(promptFile, prompt, 'utf8');

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    // Build command args (no --dangerously-skip-permissions to use normal auth)
    const args = [
      '--print',
      '--output-format', 'json',
      '--model', model
    ];

    log.info('Spawning Claude process', {
      command: claudePath,
      args: args.join(' '),
      promptFile
    });

    // Spawn process with shell to handle piping
    // Pass full environment to ensure Claude CLI auth works (uses OAuth token from setup-token)
    const homeDir = process.env.HOME || `/Users/${process.env.USER || 'user'}`;

    const proc = spawn('/bin/bash', ['-c', `cat "${promptFile}" | "${claudePath}" ${args.join(' ')}`], {
      cwd,
      env: {
        ...process.env,
        HOME: homeDir,
        USER: process.env.USER || 'user',
        PATH: `${homeDir}/.nvm/versions/node/v24.12.0/bin:${process.env.PATH || '/usr/bin:/bin'}`,
        // Ensure Claude CLI can find its config
        XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || `${homeDir}/.config`,
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Set activity-based timeout (resets on each data chunk received)
    let timeoutId = setTimeout(() => {
      timedOut = true;
      log.warn('Execution timeout - no activity', { timeout });
      proc.kill('SIGTERM');
      setTimeout(() => proc.kill('SIGKILL'), 5000);
    }, timeout);

    let dataChunksReceived = 0;

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
      dataChunksReceived++;

      // Reset timeout on activity - as long as Claude is generating, we won't timeout
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        timedOut = true;
        log.warn('Execution timeout - no activity after data received', {
          timeout,
          dataChunksReceived,
          stdoutLength: stdout.length
        });
        proc.kill('SIGTERM');
        setTimeout(() => proc.kill('SIGKILL'), 5000);
      }, timeout);
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutId);
      cleanup();
      log.error('Process error', { error: err.message });
      resolve({
        success: false,
        error: `Process error: ${err.message}`,
        executionTime: Date.now() - startTime
      });
    });

    proc.on('close', (code) => {
      clearTimeout(timeoutId);
      cleanup();
      const executionTime = Date.now() - startTime;

      if (timedOut) {
        log.warn('Execution timed out (no activity)', { timeout, dataChunksReceived });
        resolve({
          success: false,
          error: `Timeout after ${timeout}ms of inactivity (received ${dataChunksReceived} data chunks)`,
          executionTime
        });
        return;
      }

      log.info('Claude execution complete', {
        exitCode: code,
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
        executionTime,
        stdoutPreview: stdout.slice(0, 500),
        stderrPreview: stderr.slice(0, 500)
      });

      // Try to parse output even on non-zero exit (Claude CLI returns exit 1 with JSON errors)
      if (stdout) {
        // Parse JSON response
        try {
          const jsonResponse = JSON.parse(stdout.trim());
          if (jsonResponse.is_error) {
            log.error('Claude returned error in response', { error: jsonResponse.result });
            resolve({
              success: false,
              error: jsonResponse.result || 'Claude returned error',
              executionTime
            });
          } else {
            resolve({
              success: true,
              output: jsonResponse.result,
              executionTime
            });
          }
        } catch (parseErr) {
          // Not JSON - check exit code
          log.warn('Could not parse Claude output as JSON', {
            parseError: parseErr,
            stdout: stdout.slice(0, 1000),
            exitCode: code
          });
          if (code === 0) {
            resolve({
              success: true,
              output: stdout.trim(),
              executionTime
            });
          } else {
            resolve({
              success: false,
              error: stdout.trim() || `Exit code ${code}`,
              executionTime
            });
          }
        }
      } else {
        resolve({
          success: false,
          error: stderr || `Exit code ${code}`,
          executionTime
        });
      }
    });

    function cleanup() {
      try {
        unlinkSync(promptFile);
        rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  });
}
