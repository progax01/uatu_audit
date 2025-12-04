/**
 * Safety Guards for UatuAudit SOPs
 * Implements validation checks and safeguards for production execution
 */
import fs from "fs-extra";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { logger } from "../utils/logger.js";

const execAsync = promisify(exec);
const log = logger.child({ module: 'safetyGuards' });

export interface ClaudeCapabilities {
  available: boolean;
  supportsStdin: boolean;
  supportsInputFile: boolean;
  supportsAutoAccept: boolean;
  supportsSandboxMode: boolean;
  supportsPrint: boolean;
  version?: string;
  error?: string;
  lastChecked: string;
}

export interface SourceMutationResult {
  mutationDetected: boolean;
  changedFiles: string[];
  details?: string;
}

// Global cache for Claude capabilities (per daemon instance)
let claudeCapabilitiesCache: ClaudeCapabilities | null = null;

/**
 * Probe Claude CLI capabilities on daemon boot and cache results
 */
export async function probeClaudeCapabilities(): Promise<ClaudeCapabilities> {
  if (claudeCapabilitiesCache && 
      Date.now() - new Date(claudeCapabilitiesCache.lastChecked).getTime() < 5 * 60 * 1000) {
    // Return cached result if less than 5 minutes old
    return claudeCapabilitiesCache;
  }

  log.info('Probing Claude CLI capabilities');
  
  const capabilities: ClaudeCapabilities = {
    available: false,
    supportsStdin: false,
    supportsInputFile: false,
    supportsAutoAccept: false,
    supportsSandboxMode: false,
    supportsPrint: false,
    lastChecked: new Date().toISOString()
  };

  try {
    const claudePath = process.env.CLAUDE_CLI_PATH || 'claude';
    
    // Try to get help output
    const { stdout } = await execAsync(`${claudePath} --help`, { timeout: 10000 });
    
    capabilities.available = true;
    capabilities.supportsStdin = stdout.includes('stdin') || stdout.includes('pipe');
    capabilities.supportsInputFile = stdout.includes('--input-file');
    capabilities.supportsAutoAccept = stdout.includes('--auto-accept');
    capabilities.supportsSandboxMode = stdout.includes('--permission-mode');
    capabilities.supportsPrint = stdout.includes('--print');

    // Try to get version
    try {
      const { stdout: versionOut } = await execAsync(`${claudePath} --version`, { timeout: 5000 });
      capabilities.version = versionOut.trim();
    } catch (versionError) {
      log.debug('Could not get Claude version', { error: versionError });
    }

    log.info('Claude CLI capabilities probed successfully', {
      available: capabilities.available,
      supportsPrint: capabilities.supportsPrint,
      supportsSandboxMode: capabilities.supportsSandboxMode,
      version: capabilities.version
    });

  } catch (error) {
    capabilities.error = String(error);
    log.warn('Claude CLI not available or has issues', { error: String(error) });
  }

  // Cache the result
  claudeCapabilitiesCache = capabilities;
  return capabilities;
}

/**
 * Get cached Claude capabilities (call probeClaudeCapabilities first)
 */
export function getCachedClaudeCapabilities(): ClaudeCapabilities | null {
  return claudeCapabilitiesCache;
}

/**
 * Check if source repository has been mutated during execution
 */
export async function checkSourceMutation(
  projectPath: string, 
  baselineTimestamp?: number
): Promise<SourceMutationResult> {
  log.debug('Checking for source mutations', { projectPath });

  const result: SourceMutationResult = {
    mutationDetected: false,
    changedFiles: []
  };

  try {
    // Method 1: Check file modification times if baseline provided
    if (baselineTimestamp) {
      const changedFiles = await findFilesModifiedAfter(projectPath, baselineTimestamp);
      if (changedFiles.length > 0) {
        result.mutationDetected = true;
        result.changedFiles = changedFiles;
        result.details = `${changedFiles.length} files modified after baseline timestamp`;
      }
    }

    // Method 2: Check git status if available (more reliable)
    try {
      const { stdout: gitStatus } = await execAsync('git status --porcelain', { 
        cwd: projectPath,
        timeout: 5000 
      });
      
      if (gitStatus.trim()) {
        const gitChangedFiles = gitStatus.trim().split('\n')
          .map(line => line.substring(3)) // Remove git status prefix
          .filter(file => file && !file.startsWith('.uatu/')); // Ignore .uatu directory
        
        if (gitChangedFiles.length > 0) {
          result.mutationDetected = true;
          result.changedFiles = [...new Set([...result.changedFiles, ...gitChangedFiles])];
          result.details = `Git detected ${gitChangedFiles.length} modified files`;
        }
      }
    } catch (gitError) {
      log.debug('Git status check failed (not a git repo or git unavailable)', { error: gitError });
    }

    // Method 3: Check for sentinel file if we created one
    const sentinelPath = path.join(projectPath, '.uatu-sentinel');
    if (await fs.pathExists(sentinelPath)) {
      const sentinelExists = await fs.pathExists(sentinelPath);
      if (!sentinelExists) {
        result.mutationDetected = true;
        result.details = 'Sentinel file was removed or modified';
      }
    }

    if (result.mutationDetected) {
      log.error('SOURCE MUTATION DETECTED', {
        projectPath,
        changedFiles: result.changedFiles,
        details: result.details
      });
    }

  } catch (error) {
    log.warn('Error checking source mutations', { error: String(error) });
    result.details = `Error during mutation check: ${error}`;
  }

  return result;
}

/**
 * Create a sentinel file to detect source mutations
 */
export async function createSourceSentinel(projectPath: string): Promise<void> {
  const sentinelPath = path.join(projectPath, '.uatu-sentinel');
  const content = `UatuAudit Sentinel File - DO NOT MODIFY
Created: ${new Date().toISOString()}
Purpose: Detect source code mutations during audit execution
If this file is missing or modified, source mutation has occurred.
`;
  
  try {
    await fs.writeFile(sentinelPath, content);
    log.debug('Created source sentinel file', { path: sentinelPath });
  } catch (error) {
    log.warn('Failed to create source sentinel file', { error, path: sentinelPath });
  }
}

/**
 * Remove sentinel file after execution
 */
export async function removeSourceSentinel(projectPath: string): Promise<void> {
  const sentinelPath = path.join(projectPath, '.uatu-sentinel');
  
  try {
    if (await fs.pathExists(sentinelPath)) {
      await fs.remove(sentinelPath);
      log.debug('Removed source sentinel file', { path: sentinelPath });
    }
  } catch (error) {
    log.warn('Failed to remove source sentinel file', { error, path: sentinelPath });
  }
}

/**
 * Find files modified after a given timestamp
 */
async function findFilesModifiedAfter(dirPath: string, timestamp: number): Promise<string[]> {
  const changedFiles: string[] = [];
  
  async function walkDir(currentPath: string, relativePath = ''): Promise<void> {
    try {
      const items = await fs.readdir(currentPath);
      
      for (const item of items) {
        // Skip common directories that shouldn't be checked
        if (['.git', 'node_modules', '.uatu', 'runs', 'coverage', 'dist', 'build'].includes(item)) {
          continue;
        }
        
        const itemPath = path.join(currentPath, item);
        const itemRelativePath = path.join(relativePath, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          await walkDir(itemPath, itemRelativePath);
        } else if (stats.isFile()) {
          if (stats.mtimeMs > timestamp) {
            changedFiles.push(itemRelativePath);
          }
        }
      }
    } catch (error) {
      log.debug('Error walking directory for mutation check', { error, path: currentPath });
    }
  }
  
  await walkDir(dirPath);
  return changedFiles;
}

/**
 * Validate that critical environment variables are set
 */
export function validateEnvironment(): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check for critical paths
  const uatuHome = process.env.UATU_HOME;
  if (!uatuHome) {
    issues.push('UATU_HOME environment variable not set');
  }
  
  // Validate timeout values
  const executeTimeout = process.env.UATU_EXECUTE_TIMEOUT_MS;
  if (executeTimeout && (isNaN(Number(executeTimeout)) || Number(executeTimeout) < 60000)) {
    issues.push('UATU_EXECUTE_TIMEOUT_MS must be a number >= 60000');
  }
  
  const claudeTimeout = process.env.CLAUDE_TIMEOUT_MS;
  if (claudeTimeout && (isNaN(Number(claudeTimeout)) || Number(claudeTimeout) < 30000)) {
    issues.push('CLAUDE_TIMEOUT_MS must be a number >= 30000');
  }
  
  // Check concurrency setting
  const concurrency = process.env.UATU_CONCURRENCY;
  if (concurrency && (isNaN(Number(concurrency)) || Number(concurrency) < 1 || Number(concurrency) > 10)) {
    issues.push('UATU_CONCURRENCY must be a number between 1 and 10');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Initialize safety guards on daemon startup
 */
export async function initializeSafetyGuards(): Promise<void> {
  log.info('Initializing safety guards');
  
  // Validate environment
  const envValidation = validateEnvironment();
  if (!envValidation.valid) {
    log.warn('Environment validation issues', { issues: envValidation.issues });
  }
  
  // Probe Claude capabilities
  await probeClaudeCapabilities();
  
  log.info('Safety guards initialized');
}

/**
 * Check if Hardhat coverage should be enabled
 */
export function shouldEnableHardhatCoverage(): boolean {
  return process.env.UATU_HARDHAT_COVERAGE !== "0";
}

/**
 * Mutual exclusion helper for preventing concurrent operations
 */
export class MutexLock {
  private locks = new Map<string, Promise<void>>();
  
  async acquire(key: string): Promise<() => void> {
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }
    
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    
    this.locks.set(key, lockPromise);
    
    return () => {
      this.locks.delete(key);
      releaseLock();
    };
  }
}

// Global mutex for queue operations
export const queueMutex = new MutexLock();
