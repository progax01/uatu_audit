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

// Simple mutex for ensuring only one Claude CLI runs at a time
// This prevents queue buildup and ensures proper session management
let cliLock: Promise<void> = Promise.resolve();
let activeExecutions = 0;
const MAX_CONCURRENT = parseInt(process.env.CLAUDE_CONCURRENT_LIMIT || '1', 10);
const pendingQueue: Array<() => void> = [];

function acquireLock(): Promise<void> {
  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (activeExecutions < MAX_CONCURRENT) {
        activeExecutions++;
        log.debug('Acquired CLI lock', { activeExecutions, queueLength: pendingQueue.length });
        resolve();
      } else {
        log.debug('Queued for CLI lock', { activeExecutions, queueLength: pendingQueue.length + 1 });
        pendingQueue.push(tryAcquire);
      }
    };
    tryAcquire();
  });
}

function releaseLock(): void {
  activeExecutions--;
  log.debug('Released CLI lock', { activeExecutions, queueLength: pendingQueue.length });
  if (pendingQueue.length > 0) {
    const next = pendingQueue.shift();
    if (next) next();
  }
}

// Export for monitoring
export function getQueueStatus(): { active: number; pending: number; maxConcurrent: number } {
  return { active: activeExecutions, pending: pendingQueue.length, maxConcurrent: MAX_CONCURRENT };
}

export interface SimpleClaudeOptions {
  timeout?: number;
  model?: string;
  cwd?: string;
  sessionId?: string;  // Resume from existing session
  continueSession?: boolean;  // Use --continue flag for same directory
}

export interface StreamingClaudeOptions extends SimpleClaudeOptions {
  onProgress?: (phase: string, pct: number, message: string) => void;
  onLog?: (line: string) => void;
}

export interface SimpleClaudeResponse {
  success: boolean;
  output?: string;
  error?: string;
  executionTime?: number;
  sessionId?: string;  // Claude CLI session ID for resumption
}

// Progress marker regex: [UATU_STATUS:PHASE:PERCENTAGE:MESSAGE]
const PROGRESS_MARKER_REGEX = /\[UATU_STATUS:([A-Z_]+):(\d+):([^\]]+)\]/g;

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
    model = 'claude-opus-4-5-20251101',
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

/**
 * Execute Claude CLI with streaming progress callbacks
 * Parses [UATU_STATUS:PHASE:PCT:MESSAGE] markers from output
 * Uses a queue to ensure only MAX_CONCURRENT CLI processes run at once
 */
export async function executeStreamingClaude(
  prompt: string,
  options: StreamingClaudeOptions = {}
): Promise<SimpleClaudeResponse> {
  // Acquire lock to ensure sequential processing
  await acquireLock();

  const startTime = Date.now();
  const {
    timeout = 600000, // 10 minutes - complex contracts can take a while
    model = 'claude-opus-4-5-20251101',
    cwd = process.cwd(),
    onProgress,
    onLog,
    sessionId,
    continueSession
  } = options;

  const claudePath = findClaudePath();
  log.info('Executing Claude CLI (streaming mode)', {
    claudePath,
    model,
    promptLength: prompt.length,
    sessionId: sessionId ? sessionId.slice(0, 8) + '...' : undefined,
    continueSession
  });

  // Write prompt to temp file
  const tempDir = mkdtempSync(join(tmpdir(), 'claude-quick-'));
  const promptFile = join(tempDir, 'prompt.txt');
  writeFileSync(promptFile, prompt, 'utf8');

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let pendingText = ''; // Buffer for incomplete lines

    // Build command args
    const args = [
      '--print',
      '--output-format', 'json',
      '--model', model
    ];

    // Add session resumption if provided
    if (sessionId) {
      args.push('--resume', sessionId);
    } else if (continueSession) {
      args.push('--continue');
    }

    log.info('Spawning Claude process (streaming)', {
      command: claudePath,
      args: args.join(' '),
      promptFile
    });

    const homeDir = process.env.HOME || `/Users/${process.env.USER || 'user'}`;

    const proc = spawn('/bin/bash', ['-c', `cat "${promptFile}" | "${claudePath}" ${args.join(' ')}`], {
      cwd,
      env: {
        ...process.env,
        HOME: homeDir,
        USER: process.env.USER || 'user',
        PATH: `${homeDir}/.nvm/versions/node/v24.12.0/bin:${process.env.PATH || '/usr/bin:/bin'}`,
        XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || `${homeDir}/.config`,
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Activity-based timeout
    let timeoutId = setTimeout(() => {
      timedOut = true;
      log.warn('Execution timeout - no activity', { timeout });
      proc.kill('SIGTERM');
      setTimeout(() => proc.kill('SIGKILL'), 5000);
    }, timeout);

    let dataChunksReceived = 0;

    // Heartbeat interval - sends keep-alive signals even when Claude is "thinking"
    // This prevents the SSE connection from timing out on the client side
    const heartbeatInterval = setInterval(() => {
      if (onProgress) {
        try {
          onProgress('HEARTBEAT', -1, 'Processing...');
        } catch (err) {
          log.warn('Heartbeat callback error', { error: err });
        }
      }
    }, 10000); // Every 10 seconds

    proc.stdout?.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      dataChunksReceived++;

      // Reset timeout on activity
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        timedOut = true;
        log.warn('Execution timeout - no activity after data', { timeout, dataChunksReceived });
        proc.kill('SIGTERM');
        setTimeout(() => proc.kill('SIGKILL'), 5000);
      }, timeout);

      // Process chunk for progress markers
      pendingText += chunk;

      // Parse progress markers from the accumulated text
      let match;
      while ((match = PROGRESS_MARKER_REGEX.exec(pendingText)) !== null) {
        const [, phase, pctStr, message] = match;
        const pct = parseInt(pctStr, 10);

        log.debug('Progress marker found', { phase, pct, message });

        if (onProgress) {
          try {
            onProgress(phase, pct, message);
          } catch (err) {
            log.warn('Progress callback error', { error: err });
          }
        }
      }

      // Reset regex lastIndex after processing
      PROGRESS_MARKER_REGEX.lastIndex = 0;

      // Send raw log lines (split by newline)
      const lines = pendingText.split('\n');
      // Keep the last incomplete line in buffer (might contain partial progress marker)
      pendingText = lines.pop() || '';

      if (onLog) {
        for (const line of lines) {
          if (line.trim()) {
            try {
              onLog(line);
            } catch (err) {
              log.warn('Log callback error', { error: err });
            }
          }
        }
      }
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
        log.warn('Execution timed out', { timeout, dataChunksReceived });
        resolve({
          success: false,
          error: `Timeout after ${timeout}ms of inactivity`,
          executionTime
        });
        return;
      }

      log.info('Claude execution complete (streaming)', {
        exitCode: code,
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
        executionTime,
        stdoutPreview: stdout.slice(0, 500)
      });

      // Parse output - remove progress markers before JSON parsing
      if (stdout) {
        try {
          const jsonResponse = JSON.parse(stdout.trim());
          // Extract session_id for potential resumption
          const returnedSessionId = jsonResponse.session_id;

          if (jsonResponse.is_error) {
            log.error('Claude returned error', { error: jsonResponse.result, sessionId: returnedSessionId });
            resolve({
              success: false,
              error: jsonResponse.result || 'Claude returned error',
              executionTime,
              sessionId: returnedSessionId  // Return session even on error for retry
            });
          } else {
            // Remove progress markers from the result
            let cleanResult = jsonResponse.result || '';
            cleanResult = cleanResult.replace(/\[UATU_STATUS:[^\]]+\]\n?/g, '');

            log.info('Claude session info', {
              sessionId: returnedSessionId,
              numTurns: jsonResponse.num_turns,
              totalCostUsd: jsonResponse.total_cost_usd
            });

            resolve({
              success: true,
              output: cleanResult,
              executionTime,
              sessionId: returnedSessionId  // Return session for continuation
            });
          }
        } catch (parseErr) {
          log.warn('Could not parse Claude output as JSON', {
            parseError: parseErr,
            stdout: stdout.slice(0, 1000),
            exitCode: code
          });
          if (code === 0) {
            // Clean progress markers from raw output
            let cleanOutput = stdout.trim();
            cleanOutput = cleanOutput.replace(/\[UATU_STATUS:[^\]]+\]\n?/g, '');

            resolve({
              success: true,
              output: cleanOutput,
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
      clearInterval(heartbeatInterval); // Clear heartbeat on cleanup
      releaseLock();  // Release the queue lock
      try {
        unlinkSync(promptFile);
        rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  });
}
