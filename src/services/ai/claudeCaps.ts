/**
 * Claude CLI Capability Cache
 * Prevents re-probing Claude CLI capabilities on every run
 */
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "../../utils/logger.js";

const execAsync = promisify(exec);
const log = logger.child({ module: 'claudeCaps' });

export interface ClaudeCapabilities {
  available: boolean;
  stdin: boolean;
  inputFile: boolean;
  print: boolean;
  sandboxMode: boolean;
  autoAccept: boolean;
  version?: string;
  lastProbed: string;
}

// Global cache (per daemon instance)
let caps: ClaudeCapabilities | null = null;

/**
 * Get Claude CLI capabilities with caching
 * Probes once per daemon session, then returns cached result
 */
export async function getClaudeCaps(): Promise<ClaudeCapabilities> {
  if (caps) {
    return caps;
  }

  log.info('Probing Claude CLI capabilities (first time this session)');
  
  const defaultCaps: ClaudeCapabilities = {
    available: false,
    stdin: true, // assume stdin works as fallback
    inputFile: false,
    print: false,
    sandboxMode: false,
    autoAccept: false,
    lastProbed: new Date().toISOString()
  };

  try {
    const claudePath = process.env.CLAUDE_CLI_PATH || 'claude';
    
    // Probe with --help (fast and safe)
    const { stdout: helpOutput } = await execAsync(`${claudePath} --help`, { 
      timeout: 10000,
      env: process.env 
    });
    
    caps = {
      available: true,
      stdin: true, // stdin piping is universal
      inputFile: /--input-file/.test(helpOutput),
      print: /--print/.test(helpOutput),
      sandboxMode: /--permission-mode/.test(helpOutput),
      autoAccept: /--auto-accept/.test(helpOutput),
      lastProbed: new Date().toISOString()
    };

    // Try to get version (non-critical)
    try {
      const { stdout: versionOutput } = await execAsync(`${claudePath} --version`, { 
        timeout: 5000 
      });
      caps.version = versionOutput.trim();
    } catch (versionError) {
      log.debug('Could not get Claude version', { error: versionError });
    }

    log.info('Claude CLI capabilities detected', {
      available: caps.available,
      print: caps.print,
      sandboxMode: caps.sandboxMode,
      version: caps.version
    });

  } catch (error) {
    log.warn('Claude CLI not available or has issues', { 
      error: String(error),
      path: process.env.CLAUDE_CLI_PATH || 'claude (default)'
    });
    
    caps = {
      ...defaultCaps,
      available: false
    };
  }

  return caps;
}

/**
 * Get cached capabilities without re-probing
 * Returns null if not yet probed
 */
export function getCachedClaudeCaps(): ClaudeCapabilities | null {
  return caps;
}

/**
 * Clear cache (useful for testing or when Claude CLI is updated)
 */
export function clearClaudeCapCache(): void {
  caps = null;
  log.debug('Claude capabilities cache cleared');
}

/**
 * Check if Claude CLI supports the features we need for sandbox operations
 */
export async function isClaudeSandboxReady(): Promise<boolean> {
  const capabilities = await getClaudeCaps();
  return capabilities.available && capabilities.print && capabilities.sandboxMode;
}

/**
 * Get the best Claude CLI invocation strategy based on capabilities
 */
export async function getClaudeStrategy(): Promise<'stdin' | 'input-file' | 'unavailable'> {
  const capabilities = await getClaudeCaps();
  
  if (!capabilities.available) {
    return 'unavailable';
  }
  
  // Prefer stdin (most compatible) over --input-file
  if (capabilities.stdin) {
    return 'stdin';
  }
  
  if (capabilities.inputFile) {
    return 'input-file';
  }
  
  return 'stdin'; // fallback to stdin even if not explicitly detected
}
