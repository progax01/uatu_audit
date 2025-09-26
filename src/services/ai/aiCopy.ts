import fs from "fs-extra";
import path from "node:path";
import { logger } from "../../utils/logger.js";

const log = logger.child({ service: 'ai-copy' });

/**
 * Copy AI-generated tests to sandbox for execution
 */
export async function copyAiTestsToSandbox(projectPath: string, sandbox: string): Promise<{
  copied: number;
  toolchains: string[];
}> {
  const aiTestsDir = path.join(projectPath, ".uatu", "ai_tests");
  const aiRefinedDir = path.join(projectPath, ".uatu", "ai_tests_refined");
  const sandboxTestDir = path.join(sandbox, "test", "ai");
  
  let totalCopied = 0;
  const toolchains: string[] = [];

  // Ensure target directory exists
  await fs.ensureDir(sandboxTestDir);

  try {
    // First, copy original AI tests if they exist
    if (await fs.pathExists(aiTestsDir)) {
      await fs.copy(aiTestsDir, sandboxTestDir, { overwrite: true });
      
      // Count files and detect toolchains
      const originalFiles = await countFilesRecursively(aiTestsDir);
      totalCopied += originalFiles;
      
      log.debug(`Copied ${originalFiles} original AI test files to sandbox`);
    }

    // Then overlay refined tests if they exist
    if (await fs.pathExists(aiRefinedDir)) {
      await fs.copy(aiRefinedDir, sandboxTestDir, { overwrite: true });
      
      // Count refined files
      const refinedFiles = await countFilesRecursively(aiRefinedDir);
      
      log.debug(`Overlaid ${refinedFiles} refined AI test files to sandbox`);
      
      // Detect toolchains from directory structure
      const toolchainDirs = await fs.readdir(aiRefinedDir).catch(() => []);
      for (const dir of toolchainDirs) {
        const dirStat = await fs.stat(path.join(aiRefinedDir, dir)).catch(() => null);
        if (dirStat?.isDirectory()) {
          toolchains.push(dir);
        }
      }
    }

    // Detect toolchains from original tests too
    if (await fs.pathExists(aiTestsDir)) {
      const originalToolchains = await fs.readdir(aiTestsDir).catch(() => []);
      for (const dir of originalToolchains) {
        const dirStat = await fs.stat(path.join(aiTestsDir, dir)).catch(() => null);
        if (dirStat?.isDirectory() && !toolchains.includes(dir)) {
          toolchains.push(dir);
        }
      }
    }

    log.info("AI tests copied to sandbox", {
      totalFiles: totalCopied,
      toolchains,
      sandboxPath: sandboxTestDir
    });

    return {
      copied: totalCopied,
      toolchains
    };

  } catch (error) {
    log.error("Failed to copy AI tests to sandbox", { 
      error: String(error),
      aiTestsDir,
      aiRefinedDir,
      sandboxTestDir
    });
    
    return {
      copied: 0,
      toolchains: []
    };
  }
}

/**
 * Count files recursively in a directory
 */
async function countFilesRecursively(dir: string): Promise<number> {
  try {
    const items = await fs.readdir(dir);
    let count = 0;
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory()) {
        count += await countFilesRecursively(itemPath);
      } else if (stat.isFile()) {
        count++;
      }
    }
    
    return count;
  } catch (error) {
    return 0;
  }
}

/**
 * Get AI test file patterns for a specific toolchain
 */
export function getAiTestPatterns(toolchain: string): string[] {
  const patterns = {
    hardhat: ["test/ai/**/*.ts", "test/ai/**/*.tsx", "test/ai/**/*.js"],
    foundry: ["test/ai/**/*.t.sol", "test/ai/**/*.sol"],
    jest: ["test/ai/**/*.test.ts", "test/ai/**/*.test.js", "test/ai/**/*.spec.ts", "test/ai/**/*.spec.js"],
    anchor: ["test/ai/**/*.ts", "test/ai/**/*.tsx"],
    node: ["test/ai/**/*.test.ts", "test/ai/**/*.test.js"]
  };

  return patterns[toolchain as keyof typeof patterns] || patterns.hardhat;
}

/**
 * Clean up AI test files from sandbox after execution
 */
export async function cleanupAiTestsFromSandbox(sandbox: string): Promise<void> {
  const aiTestDir = path.join(sandbox, "test", "ai");
  
  try {
    if (await fs.pathExists(aiTestDir)) {
      await fs.remove(aiTestDir);
      log.debug("Cleaned up AI tests from sandbox", { path: aiTestDir });
    }
  } catch (error) {
    log.warn("Failed to cleanup AI tests from sandbox", { 
      error: String(error),
      path: aiTestDir
    });
  }
}
