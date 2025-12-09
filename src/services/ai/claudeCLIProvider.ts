import * as pty from 'node-pty';
import stripAnsi from 'strip-ansi';
import { execSync } from 'child_process';
import { logger } from '../../utils/logger';

const log = logger.child({ service: 'claude-cli-provider' });

// Configuration
const DEFAULT_TIMEOUT = parseInt(process.env.CLAUDE_CLI_TIMEOUT || '300000', 10); // Default 5 minutes, configurable via env
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_CONCURRENT_LIMIT = 5;
const DEFAULT_COLS = 140;
const DEFAULT_ROWS = 40;
const MAX_PROMPT_LENGTH = 300000; // Increased to 300K to support milestone framework with full context
const GRACEFUL_SHUTDOWN_DELAY = 5000;

// Active process tracking
const activeSessions = new Map<string, pty.IPty>();
const sessionsByJobId = new Map<number, string>(); // jobId -> sessionId for cancellation
let activeCount = 0;
const queuedRequests: Array<() => void> = [];

// Types
export interface CLIOptions {
  timeout?: number;
  cwd?: string;
  maxRetries?: number;
  flags?: string[];
  cols?: number;
  rows?: number;
  model?: string;
  jobId?: number; // For process cancellation tracking
}

export interface CLIResponse {
  success: boolean;
  output?: string;
  error?: string;
  errorType?: 'TIMEOUT' | 'CLI_NOT_FOUND' | 'EXECUTION_ERROR' | 'INVALID_INPUT' | 'PROCESS_ERROR';
  exitCode?: number;
  stderr?: string;
  executionTime?: number;
  attempts?: number;
}

// Error types
export class CLIError extends Error {
  constructor(
    message: string,
    public type: CLIResponse['errorType'],
    public exitCode?: number,
    public stderr?: string
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

/**
 * Get Claude CLI path dynamically
 */
function getCLIPath(): string {
  // If CLAUDE_CLI_PATH is explicitly set, use it (but validate)
  if (process.env.CLAUDE_CLI_PATH) {
    try {
      execSync(`test -f "${process.env.CLAUDE_CLI_PATH}"`, { stdio: 'pipe' });
      return process.env.CLAUDE_CLI_PATH;
    } catch (error) {
      log.warn(`CLAUDE_CLI_PATH set to ${process.env.CLAUDE_CLI_PATH} but file not found, falling back to auto-detect`);
    }
  }

  // Try to find claude in PATH
  try {
    const command = process.platform === 'win32' ? 'where claude' : 'which claude';
    const path = execSync(command, { stdio: 'pipe', encoding: 'utf8' }).trim();
    if (path) {
      log.debug(`Claude CLI found at: ${path}`);
      return path;
    }
  } catch (error) {
    // Not in PATH
  }

  // Last resort: just return 'claude' and let it fail if not found
  return 'claude';
}

/**
 * Check if Claude CLI is available
 */
export function checkCLIAvailable(): boolean {
  try {
    const cliPath = getCLIPath();

    // If it's just 'claude', use which/where to check
    if (cliPath === 'claude') {
      const command = process.platform === 'win32' ? 'where claude' : 'which claude';
      execSync(command, { stdio: 'pipe' });
      return true;
    }

    // If it's a full path, check if file exists
    execSync(`test -f "${cliPath}"`, { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Validate prompt
 */
function validatePrompt(prompt: string): void {
  if (!prompt || prompt.trim().length === 0) {
    throw new CLIError('Prompt cannot be empty', 'INVALID_INPUT');
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new CLIError(
      `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters`,
      'INVALID_INPUT'
    );
  }

  // Check for null bytes
  if (prompt.includes('\0')) {
    throw new CLIError('Prompt contains invalid null bytes', 'INVALID_INPUT');
  }
}

/**
 * Sanitize output
 */
function sanitizeOutput(output: string): string {
  // Strip ANSI codes
  let cleaned = stripAnsi(output);

  // Remove common CLI artifacts
  cleaned = cleaned.replace(/^[\s\n]+/, ''); // Leading whitespace
  cleaned = cleaned.replace(/[\s\n]+$/, ''); // Trailing whitespace

  // Remove progress indicators (e.g., "Loading...", "Processing...")
  cleaned = cleaned.replace(/^(Loading|Processing|Thinking)\.{3}\s*/gim, '');

  return cleaned;
}

/**
 * Sleep utility for retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse exit code to error type
 */
function parseExitCode(exitCode: number): CLIResponse['errorType'] {
  switch (exitCode) {
    case 127:
      return 'CLI_NOT_FOUND';
    case 130:
      return 'PROCESS_ERROR'; // User interrupted
    case 1:
    case 2:
    default:
      return 'EXECUTION_ERROR';
  }
}

/**
 * Kill process gracefully
 */
async function killProcessGracefully(ptySession: pty.IPty, sessionId: string): Promise<void> {
  try {
    // Try SIGTERM first
    ptySession.kill('SIGTERM');

    // Wait for graceful shutdown
    await sleep(GRACEFUL_SHUTDOWN_DELAY);

    // Force kill if still alive
    try {
      ptySession.kill('SIGKILL');
    } catch (error) {
      // Process already dead, ignore
    }

    activeSessions.delete(sessionId);
  } catch (error) {
    log.warn(`Failed to kill process ${sessionId}: ${error}`);
  }
}

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  return `claude-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Execute Claude CLI with a single prompt
 */
async function executeClaudeOnce(
  prompt: string,
  options: CLIOptions = {}
): Promise<string> {
  const {
    timeout = parseInt(process.env.CLAUDE_CLI_TIMEOUT || String(DEFAULT_TIMEOUT)),
    cwd = process.cwd(),
    cols = DEFAULT_COLS,
    rows = DEFAULT_ROWS,
    flags = [],
    model
  } = options;

  const sessionId = generateSessionId();
  const startTime = Date.now();

  // Build CLI arguments
  // Note: --dangerously-skip-permissions cannot be used with root privileges
  // Use --permission-mode instead (passed via flags parameter)
  const args = ['--print'];

  // Add model flag if specified
  if (model) {
    args.push('--model', model);
  }

  // Add custom flags
  args.push(...flags);

  // Add prompt
  args.push(prompt);

  log.info(`[${sessionId}] === STARTING CLAUDE CLI EXECUTION ===`);
  log.info(`[${sessionId}] CLI Path: ${getCLIPath()}`);
  log.info(`[${sessionId}] Working Directory: ${cwd}`);
  log.info(`[${sessionId}] Timeout: ${timeout}ms (${Math.round(timeout/1000)}s)`);
  log.info(`[${sessionId}] Prompt Length: ${prompt.length} chars`);
  log.info(`[${sessionId}] Model: ${model || 'default'}`);
  log.info(`[${sessionId}] Flags: ${flags.join(' ')}`);
  log.debug(`[${sessionId}] Executing Claude CLI: ${getCLIPath()} ${args.slice(0, 2).join(' ')} [prompt]`);

  return new Promise<string>((resolve, reject) => {
    let output = '';
    let timeoutId: NodeJS.Timeout;
    let ptySession: pty.IPty;
    let lastProgressLog = Date.now();
    let dataChunksReceived = 0;

    // Setup timeout
    timeoutId = setTimeout(async () => {
      const elapsed = Date.now() - startTime;
      log.warn(`[${sessionId}] === EXECUTION TIMEOUT ===`);
      log.warn(`[${sessionId}] Timeout after: ${timeout}ms (${Math.round(timeout/1000)}s)`);
      log.warn(`[${sessionId}] Elapsed time: ${elapsed}ms (${Math.round(elapsed/1000)}s)`);
      log.warn(`[${sessionId}] Data chunks received: ${dataChunksReceived}`);
      log.warn(`[${sessionId}] Output length so far: ${output.length} chars`);
      log.warn(`[${sessionId}] Last output preview: ${output.slice(-200)}`);
      if (ptySession) {
        await killProcessGracefully(ptySession, sessionId);
      }
      reject(new CLIError(
        `Claude CLI execution timed out after ${timeout}ms`,
        'TIMEOUT'
      ));
    }, timeout);

    try {
      // Spawn PTY process
      log.info(`[${sessionId}] Spawning PTY process...`);
      log.debug(`[${sessionId}] Environment HOME: ${process.env.HOME}`);
      log.debug(`[${sessionId}] Environment USER: ${process.env.USER}`);

      // Ensure HOME is set correctly for Claude CLI to find credentials
      const env = {
        ...process.env,
        HOME: process.env.HOME || '/home/uatu',
        USER: process.env.USER || 'uatu'
      };

      ptySession = pty.spawn(getCLIPath(), args, {
        name: 'dumb',
        cols,
        rows,
        cwd,
        env
      });
      log.info(`[${sessionId}] PTY process spawned successfully`);

      // Track session
      activeSessions.set(sessionId, ptySession);

      // Track jobId for cancellation
      if (options.jobId) {
        sessionsByJobId.set(options.jobId, sessionId);
        log.info(`[${sessionId}] Tracked jobId ${options.jobId} for cancellation`);
      }

      // Collect output with progress tracking and activity-based timeout reset
      ptySession.onData((data: string) => {
        output += data;
        dataChunksReceived++;

        // Reset timeout on each data chunk received - this is the key fix!
        // As long as Claude is actively generating output, we won't timeout
        clearTimeout(timeoutId);
        timeoutId = setTimeout(async () => {
          const elapsed = Date.now() - startTime;
          log.warn(`[${sessionId}] === EXECUTION TIMEOUT (NO ACTIVITY) ===`);
          log.warn(`[${sessionId}] Timeout after: ${timeout}ms of inactivity`);
          log.warn(`[${sessionId}] Total elapsed time: ${elapsed}ms (${Math.round(elapsed/1000)}s)`);
          log.warn(`[${sessionId}] Data chunks received: ${dataChunksReceived}`);
          log.warn(`[${sessionId}] Output length so far: ${output.length} chars`);
          log.warn(`[${sessionId}] Last output preview: ${output.slice(-200)}`);
          if (ptySession) {
            await killProcessGracefully(ptySession, sessionId);
          }
          reject(new CLIError(
            `Claude CLI execution timed out after ${timeout}ms of inactivity`,
            'TIMEOUT'
          ));
        }, timeout);

        // Log progress every 10 seconds
        const now = Date.now();
        if (now - lastProgressLog >= 10000) {
          const elapsed = now - startTime;
          log.info(`[${sessionId}] === PROGRESS UPDATE ===`);
          log.info(`[${sessionId}] Elapsed: ${Math.round(elapsed/1000)}s`);
          log.info(`[${sessionId}] Data chunks: ${dataChunksReceived}`);
          log.info(`[${sessionId}] Output size: ${output.length} chars`);
          log.info(`[${sessionId}] Recent output: ${stripAnsi(data.slice(-150))}`);
          lastProgressLog = now;
        }
      });

      // Handle exit
      ptySession.onExit(({ exitCode, signal }) => {
        clearTimeout(timeoutId);
        activeSessions.delete(sessionId);

        const executionTime = Date.now() - startTime;

        log.info(`[${sessionId}] === EXECUTION COMPLETE ===`);
        log.info(`[${sessionId}] Exit Code: ${exitCode}${signal ? ` (Signal: ${signal})` : ''}`);
        log.info(`[${sessionId}] Total Time: ${executionTime}ms (${Math.round(executionTime/1000)}s)`);
        log.info(`[${sessionId}] Data Chunks: ${dataChunksReceived}`);
        log.info(`[${sessionId}] Raw Output Length: ${output.length} chars`);

        if (exitCode === 0) {
          const cleanOutput = sanitizeOutput(output);
          log.info(`[${sessionId}] Clean Output Length: ${cleanOutput.length} chars`);

          if (!cleanOutput || cleanOutput.length === 0) {
            log.warn(`[${sessionId}] Empty output received after sanitization`);
            reject(new CLIError('No output received from Claude CLI', 'EXECUTION_ERROR', exitCode));
            return;
          }

          log.info(`[${sessionId}] === SUCCESS ===`);
          log.info(`[${sessionId}] Output preview (first 200 chars): ${cleanOutput.substring(0, 200)}`);
          resolve(cleanOutput);
        } else {
          const errorType = parseExitCode(exitCode);
          const errorMsg = `Claude CLI exited with code ${exitCode}${signal ? ` (signal: ${signal})` : ''}`;

          log.error(`[${sessionId}] === EXECUTION FAILED ===`);
          log.error(`[${sessionId}] Error Type: ${errorType}`);
          log.error(`[${sessionId}] ${errorMsg}`);
          if (output) {
            log.error(`[${sessionId}] Output (first 500 chars): ${output.substring(0, 500)}`);
            log.error(`[${sessionId}] Output (last 500 chars): ${output.slice(-500)}`);
          }

          reject(new CLIError(errorMsg, errorType, exitCode, output));
        }
      });

    } catch (error: any) {
      clearTimeout(timeoutId);
      activeSessions.delete(sessionId);

      log.error(`[${sessionId}] Spawn error: ${error.message}`);
      reject(new CLIError(
        `Failed to spawn Claude CLI: ${error.message}`,
        'PROCESS_ERROR'
      ));
    }
  });
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: CLIError): boolean {
  // Don't retry these
  if (error.type === 'CLI_NOT_FOUND') return false;
  if (error.type === 'INVALID_INPUT') return false;
  if (error.exitCode === 130) return false; // User interrupted

  // Retry timeouts and execution errors
  return error.type === 'TIMEOUT' || error.type === 'EXECUTION_ERROR' || error.type === 'PROCESS_ERROR';
}

/**
 * Execute Claude CLI with retry logic
 */
async function executeWithRetry(
  prompt: string,
  options: CLIOptions = {}
): Promise<string> {
  const maxRetries = options.maxRetries ?? parseInt(process.env.CLAUDE_MAX_RETRIES || String(DEFAULT_MAX_RETRIES));
  let lastError: CLIError | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log.debug(`Attempt ${attempt}/${maxRetries}`);
      const result = await executeClaudeOnce(prompt, options);
      return result;
    } catch (error: any) {
      lastError = error instanceof CLIError ? error : new CLIError(error.message, 'EXECUTION_ERROR');

      // Check if we should retry
      if (attempt < maxRetries && isRetryableError(lastError)) {
        const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff: 1s, 2s, 4s
        log.warn(`Attempt ${attempt} failed: ${lastError.message}. Retrying in ${delay}ms...`);
        await sleep(delay);
      } else {
        break;
      }
    }
  }

  // All retries failed
  throw lastError;
}

/**
 * Process queued requests
 */
function processQueue(): void {
  const concurrentLimit = parseInt(process.env.CLAUDE_CONCURRENT_LIMIT || String(DEFAULT_CONCURRENT_LIMIT));

  while (activeCount < concurrentLimit && queuedRequests.length > 0) {
    const next = queuedRequests.shift();
    if (next) {
      activeCount++;
      next();
    }
  }
}

/**
 * Main execution function with concurrency control
 */
export async function executeClaude(
  prompt: string,
  options: CLIOptions = {}
): Promise<string> {
  // Pre-execution validation
  if (!checkCLIAvailable()) {
    throw new CLIError(
      'Claude CLI not found. Please install Claude CLI: https://github.com/anthropics/claude-cli',
      'CLI_NOT_FOUND'
    );
  }

  validatePrompt(prompt);

  // Concurrency control
  const concurrentLimit = parseInt(process.env.CLAUDE_CONCURRENT_LIMIT || String(DEFAULT_CONCURRENT_LIMIT));

  if (activeCount >= concurrentLimit) {
    log.debug(`Concurrent limit reached (${activeCount}/${concurrentLimit}), queueing request`);

    return new Promise((resolve, reject) => {
      queuedRequests.push(async () => {
        try {
          const result = await executeWithRetry(prompt, options);
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          activeCount--;
          processQueue();
        }
      });
    });
  }

  // Execute immediately
  activeCount++;
  try {
    const result = await executeWithRetry(prompt, options);
    return result;
  } finally {
    activeCount--;
    processQueue();
  }
}

/**
 * Cancel a specific session by ID
 */
export async function cancelSession(sessionId: string): Promise<boolean> {
  const session = activeSessions.get(sessionId);
  if (session) {
    await killProcessGracefully(session, sessionId);
    return true;
  }
  return false;
}

/**
 * Kill a specific Claude CLI session by jobId
 * Returns true if session was found and killed, false otherwise
 */
export function killSessionByJobId(jobId: number): boolean {
  const sessionId = sessionsByJobId.get(jobId);
  if (!sessionId) {
    log.warn(`No active session found for jobId ${jobId}`);
    return false;
  }

  const ptySession = activeSessions.get(sessionId);
  if (!ptySession) {
    log.warn(`Session ${sessionId} not found in active sessions`);
    sessionsByJobId.delete(jobId);
    return false;
  }

  log.info(`Killing Claude CLI session ${sessionId} for jobId ${jobId}`);

  try {
    // Send SIGTERM for graceful shutdown
    ptySession.kill('SIGTERM');

    // Give it 2 seconds then force kill if still alive
    setTimeout(() => {
      if (activeSessions.has(sessionId)) {
        log.warn(`Session ${sessionId} did not terminate, sending SIGKILL`);
        try {
          ptySession.kill('SIGKILL');
        } catch (err) {
          log.error(`Failed to SIGKILL session ${sessionId}:`, err);
        }
      }
    }, 2000);

    // Clean up mappings
    activeSessions.delete(sessionId);
    sessionsByJobId.delete(jobId);
    activeCount = Math.max(0, activeCount - 1);

    log.info(`Successfully killed session ${sessionId} for jobId ${jobId}`);
    return true;
  } catch (err) {
    log.error(`Error killing session ${sessionId} for jobId ${jobId}:`, err);
    // Clean up mappings even on error
    activeSessions.delete(sessionId);
    sessionsByJobId.delete(jobId);
    activeCount = Math.max(0, activeCount - 1);
    return false;
  }
}

/**
 * Cancel all active sessions
 */
export async function cancelAllSessions(): Promise<void> {
  log.info(`Cancelling ${activeSessions.size} active sessions`);

  const promises = Array.from(activeSessions.entries()).map(([id, session]) =>
    killProcessGracefully(session, id)
  );

  await Promise.all(promises);
  activeSessions.clear();
  sessionsByJobId.clear();
}

/**
 * Get active session count
 */
export function getActiveSessionCount(): number {
  return activeSessions.size;
}

/**
 * Get queued request count
 */
export function getQueuedRequestCount(): number {
  return queuedRequests.length;
}

// Cleanup on process exit
process.on('SIGINT', async () => {
  await cancelAllSessions();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cancelAllSessions();
  process.exit(0);
});
