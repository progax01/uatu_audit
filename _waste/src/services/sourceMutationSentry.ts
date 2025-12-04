/**
 * Source Mutation Sentry
 * Fast tree hashing to detect source code mutations during execution
 */
import crypto from "node:crypto";
import fs from "fs-extra";
import path from "node:path";
import { logger } from "../utils/logger.js";

const log = logger.child({ module: 'sourceMutationSentry' });

export interface TreeHashResult {
  hash: string;
  fileCount: number;
  totalSize: number;
  timestamp: number;
}

export interface MutationCheckResult {
  mutationDetected: boolean;
  beforeHash: string;
  afterHash: string;
  details: string;
}

/**
 * Generate a fast hash of the source tree
 * Only includes source/contract files, skips build artifacts and dependencies
 */
export async function generateTreeHash(rootPath: string): Promise<TreeHashResult> {
  const entries: string[] = [];
  let fileCount = 0;
  let totalSize = 0;
  
  const startTime = Date.now();
  
  try {
    await walkSourceTree(rootPath, (filePath, stats) => {
      const relativePath = path.relative(rootPath, filePath);
      // Include: filename, size, and mtime for fast change detection
      entries.push(`${relativePath}:${stats.size}:${Math.floor(stats.mtimeMs)}`);
      fileCount++;
      totalSize += stats.size;
    });
    
    // Sort for deterministic hashing
    entries.sort();
    
    const hash = crypto
      .createHash("sha256")
      .update(entries.join("\n"))
      .digest("hex");
    
    const duration = Date.now() - startTime;
    log.debug('Tree hash generated', { 
      hash: hash.substring(0, 12) + '...', 
      fileCount, 
      totalSize, 
      duration 
    });
    
    return {
      hash,
      fileCount,
      totalSize,
      timestamp: Date.now()
    };
    
  } catch (error) {
    log.error('Failed to generate tree hash', { error: String(error), rootPath });
    throw error;
  }
}

/**
 * Walk only source code directories, skip build artifacts and dependencies
 */
async function walkSourceTree(
  dirPath: string, 
  onFile: (filePath: string, stats: fs.Stats) => void,
  currentDepth = 0,
  maxDepth = 10
): Promise<void> {
  if (currentDepth > maxDepth) {
    log.warn('Max depth reached during tree walk', { dirPath, currentDepth });
    return;
  }
  
  try {
    const items = await fs.readdir(dirPath);
    
    for (const item of items) {
      // Skip common non-source directories
      if (shouldSkipDirectory(item)) {
        continue;
      }
      
      const itemPath = path.join(dirPath, item);
      let stats: fs.Stats;
      
      try {
        stats = await fs.stat(itemPath);
      } catch (error) {
        // Skip if we can't stat (broken symlinks, etc.)
        continue;
      }
      
      if (stats.isDirectory()) {
        await walkSourceTree(itemPath, onFile, currentDepth + 1, maxDepth);
      } else if (stats.isFile() && shouldIncludeFile(item)) {
        onFile(itemPath, stats);
      }
    }
  } catch (error) {
    log.debug('Error walking directory (non-critical)', { error, dirPath });
  }
}

/**
 * Check if directory should be skipped during tree walk
 */
function shouldSkipDirectory(dirName: string): boolean {
  const skipDirs = [
    // Build outputs
    'node_modules', 'dist', 'build', 'out', 'target', 'artifacts', 'cache',
    // Version control
    '.git', '.svn', '.hg',
    // IDE/Editor
    '.vscode', '.idea', '.vs',
    // UatuAudit specific
    '.uatu', 'runs',
    // Coverage
    'coverage', '.nyc_output',
    // Logs
    'logs', '.log',
    // OS
    '.DS_Store', 'Thumbs.db',
    // Package managers
    '.npm', '.yarn', '.pnpm'
  ];
  
  return skipDirs.includes(dirName) || dirName.startsWith('.');
}

/**
 * Check if file should be included in tree hash
 */
function shouldIncludeFile(fileName: string): boolean {
  // Include source code files
  const sourceExtensions = [
    '.sol', '.vy', // Smart contracts
    '.ts', '.js', '.tsx', '.jsx', // TypeScript/JavaScript
    '.rs', // Rust
    '.py', // Python
    '.toml', '.json', '.yaml', '.yml', // Config files
    '.md', '.txt', // Documentation
    '.env.example', // Environment templates
  ];
  
  // Include specific important files
  const importantFiles = [
    'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    'Cargo.toml', 'Cargo.lock',
    'foundry.toml', 'hardhat.config.js', 'hardhat.config.ts',
    'Anchor.toml', 'soroban.toml',
    'tsconfig.json', 'jsconfig.json',
    '.gitignore', '.gitattributes',
    'README.md', 'LICENSE'
  ];
  
  if (importantFiles.includes(fileName)) {
    return true;
  }
  
  return sourceExtensions.some(ext => fileName.endsWith(ext));
}

/**
 * Check for source mutations between two points in time
 */
export async function checkForMutations(
  projectPath: string,
  beforeHash: TreeHashResult
): Promise<MutationCheckResult> {
  log.debug('Checking for source mutations', { 
    projectPath, 
    beforeHash: beforeHash.hash.substring(0, 12) + '...' 
  });
  
  try {
    const afterHash = await generateTreeHash(projectPath);
    
    const mutationDetected = beforeHash.hash !== afterHash.hash;
    
    let details = '';
    if (mutationDetected) {
      details = `File count: ${beforeHash.fileCount} → ${afterHash.fileCount}, ` +
                `Total size: ${beforeHash.totalSize} → ${afterHash.totalSize}`;
      
      log.warn('SOURCE MUTATION DETECTED', {
        beforeHash: beforeHash.hash.substring(0, 12) + '...',
        afterHash: afterHash.hash.substring(0, 12) + '...',
        details
      });
    } else {
      log.debug('No source mutations detected');
    }
    
    return {
      mutationDetected,
      beforeHash: beforeHash.hash,
      afterHash: afterHash.hash,
      details
    };
    
  } catch (error) {
    log.error('Failed to check for mutations', { error: String(error) });
    return {
      mutationDetected: false, // Assume no mutation if check fails
      beforeHash: beforeHash.hash,
      afterHash: 'error',
      details: `Mutation check failed: ${error}`
    };
  }
}

/**
 * Create a baseline hash before execution
 */
export async function createMutationBaseline(projectPath: string): Promise<TreeHashResult> {
  log.debug('Creating source mutation baseline', { projectPath });
  return await generateTreeHash(projectPath);
}

/**
 * Verify source integrity after execution and log any mutations
 */
export async function verifySourceIntegrity(
  projectPath: string,
  baseline: TreeHashResult,
  onMutation?: (result: MutationCheckResult) => Promise<void>
): Promise<boolean> {
  const result = await checkForMutations(projectPath, baseline);
  
  if (result.mutationDetected && onMutation) {
    await onMutation(result);
  }
  
  return !result.mutationDetected;
}
