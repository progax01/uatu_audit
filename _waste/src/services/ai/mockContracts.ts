import fs from "fs-extra";
import path from "node:path";
import { logger } from "../../utils/logger.js";

const log = logger.child({ service: 'mock-contracts' });

/**
 * Copy mock test contracts to sandbox contracts directory
 * These contracts are used for AI-generated tests when real contracts don't exist
 */
export async function copyMockContractsToSandbox(sandbox: string): Promise<{
  copied: number;
  contracts: string[];
}> {
  // Use relative path from dist directory (src/services/ai -> dist/services/ai)
  const mockContractsDir = path.resolve(process.cwd(), "src/templates/test-contracts");
  const sandboxContractsDir = path.join(sandbox, "contracts", "test");

  try {
    // Ensure target directory exists
    await fs.ensureDir(sandboxContractsDir);

    // Check if mock contracts directory exists
    if (!(await fs.pathExists(mockContractsDir))) {
      log.warn("Mock contracts directory not found", { path: mockContractsDir });
      return { copied: 0, contracts: [] };
    }

    // Copy all mock contracts
    const files = await fs.readdir(mockContractsDir);
    const solFiles = files.filter(f => f.endsWith('.sol'));

    let copied = 0;
    const contracts: string[] = [];

    for (const file of solFiles) {
      const sourcePath = path.join(mockContractsDir, file);
      const destPath = path.join(sandboxContractsDir, file);

      await fs.copy(sourcePath, destPath, { overwrite: true });
      copied++;

      // Extract contract name (remove .sol extension)
      const contractName = file.replace('.sol', '');
      contracts.push(contractName);
    }

    log.info("Mock contracts copied to sandbox", {
      copied,
      contracts,
      destination: sandboxContractsDir
    });

    return { copied, contracts };

  } catch (error) {
    log.error("Failed to copy mock contracts", {
      error: String(error),
      mockContractsDir,
      sandboxContractsDir
    });

    return { copied: 0, contracts: [] };
  }
}

/**
 * Get list of available mock contracts
 */
export async function getAvailableMockContracts(): Promise<string[]> {
  const mockContractsDir = path.resolve(process.cwd(), "src/templates/test-contracts");

  try {
    if (!(await fs.pathExists(mockContractsDir))) {
      return [];
    }

    const files = await fs.readdir(mockContractsDir);
    return files
      .filter(f => f.endsWith('.sol'))
      .map(f => f.replace('.sol', ''));

  } catch (error) {
    log.error("Failed to get mock contracts list", { error: String(error) });
    return [];
  }
}
