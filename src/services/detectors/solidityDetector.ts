import fg from "fast-glob";
import path from "node:path";
import fs from "fs-extra";

export async function listSolidityContracts(cwd: string): Promise<string[]> {
  return fg([
    "**/*.sol",
    "!**/node_modules/**",
    "!**/.git/**",
    "!**/.uatu/**",
    "!**/lib/**",
    "!**/cache/**",
    "!**/artifacts/**",
    "!**/out/**"
  ], { cwd });
}

export async function hasFoundryProject(cwd: string): Promise<boolean> {
  return fs.pathExists(path.join(cwd, "foundry.toml"));
}

export async function hasHardhatProject(cwd: string): Promise<boolean> {
  const hasConfig = await fs.pathExists(path.join(cwd, "hardhat.config.ts")) || 
                   await fs.pathExists(path.join(cwd, "hardhat.config.js"));
  const hasPackageJson = await fs.pathExists(path.join(cwd, "package.json"));
  return hasConfig && hasPackageJson;
}

/**
 * Extract function signatures from Solidity files (simple regex)
 */
export async function extractSolidityFunctions(absFile: string): Promise<string[]> {
  const content = await fs.readFile(absFile, "utf8");
  const functionRegex = /\b(public|external)\s+(?:payable\s+)?(?:view\s+|pure\s+)?function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)/g;
  
  const functions: string[] = [];
  let match;
  while ((match = functionRegex.exec(content)) !== null) {
    const [, visibility, name, params] = match;
    functions.push(`${name}(${params || ""}) ${visibility}`);
  }
  
  return functions;
}
