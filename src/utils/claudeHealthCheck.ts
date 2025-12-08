import { spawn } from 'node:child_process';
import { logger } from './logger.js';

const log = logger.child({ module: 'claude-health-check' });

export interface ClaudeHealthStatus {
  available: boolean;
  authenticated: boolean;
  version?: string;
  error?: string;
}

/**
 * Check if Claude CLI is available and authenticated
 */
export async function checkClaudeCliHealth(): Promise<ClaudeHealthStatus> {
  // Step 1: Check if claude command exists
  try {
    const versionResult = await checkClaudeVersion();

    if (!versionResult.success) {
      return {
        available: false,
        authenticated: false,
        error: 'Claude CLI not found in PATH or failed to execute'
      };
    }

    log.debug('Claude CLI version check passed', { version: versionResult.version });

    // Step 2: Check authentication
    const authResult = await checkClaudeAuth();

    if (!authResult.success) {
      return {
        available: true,
        authenticated: false,
        version: versionResult.version,
        error: authResult.error
      };
    }

    log.info('Claude CLI health check passed', { version: versionResult.version });
    return {
      available: true,
      authenticated: true,
      version: versionResult.version
    };

  } catch (err: any) {
    log.error('Claude CLI health check failed', { error: err.message });
    return {
      available: false,
      authenticated: false,
      error: `Health check error: ${err.message}`
    };
  }
}

/**
 * Check Claude CLI version (verifies it's installed)
 */
async function checkClaudeVersion(): Promise<{ success: boolean; version?: string }> {
  return new Promise((resolve) => {
    const proc = spawn('claude', ['--version'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Close stdin immediately - Claude CLI doesn't need input
    proc.stdin?.end();

    let output = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        const version = output.trim() || stderr.trim();
        resolve({ success: true, version });
      } else {
        resolve({ success: false });
      }
    });

    proc.on('error', () => {
      resolve({ success: false });
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      try {
        proc.kill('SIGTERM');
      } catch {}
      resolve({ success: false });
    }, 5000);
  });
}

/**
 * Check Claude CLI authentication
 */
async function checkClaudeAuth(): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const proc = spawn('claude', ['--print', 'test'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Close stdin immediately - Claude CLI doesn't need input
    proc.stdin?.end();

    let output = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      const combinedOutput = output + stderr;

      if (code === 0) {
        resolve({ success: true });
      } else {
        // Parse error message
        if (combinedOutput.includes('Invalid API key') ||
            combinedOutput.includes('/login')) {
          resolve({
            success: false,
            error: 'Claude CLI not authenticated. Run: claude /login'
          });
        } else if (combinedOutput.includes('Permission denied')) {
          resolve({
            success: false,
            error: 'Permission denied. Check ~/.claude/.credentials.json permissions (chmod 644)'
          });
        } else {
          resolve({
            success: false,
            error: `Authentication check failed (exit code ${code}): ${combinedOutput.slice(0, 200)}`
          });
        }
      }
    });

    proc.on('error', (err) => {
      resolve({
        success: false,
        error: `Failed to spawn claude: ${err.message}`
      });
    });

    // Timeout after 30 seconds (Claude CLI can take 15-20s to respond)
    setTimeout(() => {
      try {
        proc.kill('SIGTERM');
      } catch {}
      resolve({
        success: false,
        error: 'Authentication check timed out after 30 seconds'
      });
    }, 30000);
  });
}

/**
 * Ensure Claude CLI is ready before starting audit
 * Throws descriptive error if not ready
 */
export async function ensureClaudeReady(): Promise<void> {
  log.info('Running Claude CLI health check...');
  const health = await checkClaudeCliHealth();

  if (!health.available) {
    throw new Error(
      `❌ Claude CLI is not available: ${health.error}\n\n` +
      'Fix options:\n' +
      '  1. Install Claude CLI: https://github.com/anthropics/claude-cli\n' +
      '  2. Verify it\'s in PATH: which claude'
    );
  }

  if (!health.authenticated) {
    throw new Error(
      `❌ Claude CLI is not authenticated: ${health.error}\n\n` +
      'Fix options:\n' +
      '  1. Run "claude /login" to authenticate\n' +
      '  2. Set ANTHROPIC_API_KEY environment variable\n' +
      '  3. Check ~/.claude/.credentials.json permissions:\n' +
      '     chmod 644 ~/.claude/.credentials.json'
    );
  }

  log.info('Claude CLI is ready', {
    version: health.version,
    available: health.available,
    authenticated: health.authenticated
  });
}
