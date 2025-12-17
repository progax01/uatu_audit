import path from "node:path";
import fs from "fs-extra";
import fg from "fast-glob";

export interface ContextWriterOptions {
  projectPath: string;
  contextPath: string;
  selectedFiles?: string[];
  testStyles: ("behavioral" | "stride" | "owasp")[];
  repo: string;
  branch: string;
}

/**
 * Writes context/files_structure.md
 * Contains: project tree, contract sources, existing tests, dependencies
 */
export async function writeFilesStructure(options: ContextWriterOptions): Promise<string> {
  const { projectPath, contextPath, repo, branch } = options;

  // Build directory tree
  const tree = await buildDirectoryTree(projectPath);

  // Find and read contract files
  const solidityFiles = await fg(["**/*.sol", "!**/node_modules/**", "!**/.git/**", "!**/.uatu/**", "!**/runs/**"], { cwd: projectPath });
  const rustFiles = await fg(["**/*.rs", "!**/target/**", "!**/.git/**", "!**/node_modules/**", "!**/runs/**"], { cwd: projectPath });

  // Read contract sources
  const contractSources: { path: string; content: string }[] = [];

  for (const file of solidityFiles) {
    const content = await fs.readFile(path.join(projectPath, file), "utf8");
    contractSources.push({ path: file, content });
  }

  for (const file of rustFiles) {
    // Only include Anchor/Soroban program files
    const content = await fs.readFile(path.join(projectPath, file), "utf8");
    if (content.includes("#[program]") || content.includes("#[contractimpl]") || content.includes("declare_id!")) {
      contractSources.push({ path: file, content });
    }
  }

  // Find existing tests
  const testFiles = await fg([
    "**/*.test.{js,ts,tsx}",
    "**/*.spec.{js,ts,tsx}",
    "**/*.t.sol",
    "**/test/**/*.{js,ts}",
    "**/tests/**/*.rs",
    "!**/node_modules/**",
    "!**/.git/**"
  ], { cwd: projectPath });

  // Read package.json for dependencies
  const packageJsonPath = path.join(projectPath, "package.json");
  let dependencies: Record<string, string> = {};
  let devDependencies: Record<string, string> = {};

  if (await fs.pathExists(packageJsonPath)) {
    const pkg = await fs.readJson(packageJsonPath);
    dependencies = pkg.dependencies || {};
    devDependencies = pkg.devDependencies || {};
  }

  // Detect framework
  const framework = detectFramework(dependencies, devDependencies, solidityFiles, rustFiles);

  // Build markdown content
  const md = `# Project Structure

## Repository Info
- **Repo**: ${repo}
- **Branch**: ${branch}
- **Analyzed at**: ${new Date().toISOString()}
- **Framework**: ${framework.primary}
${framework.secondary ? `- **Secondary**: ${framework.secondary}` : ""}

## Directory Tree
\`\`\`
${tree}
\`\`\`

## Contract Sources

${contractSources.map(({ path: p, content }) => `### ${p}
\`\`\`${p.endsWith(".sol") ? "solidity" : "rust"}
${content}
\`\`\`
`).join("\n")}

## Existing Tests
${testFiles.length > 0 ? testFiles.map(f => `- ${f}`).join("\n") : "- No existing tests found"}

## Dependencies
${Object.entries({ ...dependencies, ...devDependencies })
  .filter(([k]) => isRelevantDep(k))
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n") || "- No relevant dependencies"}

## Framework Configuration
- **Solidity Files**: ${solidityFiles.length}
- **Rust Program Files**: ${contractSources.filter(c => c.path.endsWith(".rs")).length}
- **Test Files**: ${testFiles.length}
`;

  const outputPath = path.join(contextPath, "files_structure.md");
  await fs.ensureDir(contextPath);
  await fs.writeFile(outputPath, md, "utf8");

  return outputPath;
}

/**
 * Writes context/test_requirements.md
 * Contains: selected files, test styles, OWASP categories, framework info
 */
export async function writeTestRequirements(options: ContextWriterOptions): Promise<string> {
  const { projectPath, contextPath, selectedFiles, testStyles } = options;

  // If no files selected, auto-detect main contracts
  let filesToAudit = selectedFiles || [];

  if (filesToAudit.length === 0) {
    const solidityFiles = await fg(["**/*.sol", "!**/node_modules/**", "!**/.git/**", "!**/test/**", "!**/mock/**"], { cwd: projectPath });
    const rustFiles = await fg(["**/programs/**/*.rs", "**/src/**/*.rs", "!**/target/**"], { cwd: projectPath });
    filesToAudit = [...solidityFiles, ...rustFiles].slice(0, 20); // Limit to 20 files
  }

  // Detect framework for test generation
  const packageJsonPath = path.join(projectPath, "package.json");
  let framework = "hardhat";

  if (await fs.pathExists(packageJsonPath)) {
    const pkg = await fs.readJson(packageJsonPath);
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (allDeps.foundry || await fs.pathExists(path.join(projectPath, "foundry.toml"))) {
      framework = "foundry";
    } else if (allDeps["@project-serum/anchor"]) {
      framework = "anchor";
    }
  }

  // Detect Solidity version
  let solidityVersion = "0.8.19";
  const firstSolFile = filesToAudit.find(f => f.endsWith(".sol"));
  if (firstSolFile) {
    const content = await fs.readFile(path.join(projectPath, firstSolFile), "utf8").catch(() => "");
    const versionMatch = content.match(/pragma solidity\s+[\^~>=]*(\d+\.\d+\.\d+)/);
    if (versionMatch) {
      solidityVersion = versionMatch[1];
    }
  }

  const md = `# Test Requirements

## Selected Files for Audit
${filesToAudit.map((f, i) => `${i + 1}. ${f}`).join("\n")}

## Test Styles Requested
- [${testStyles.includes("behavioral") ? "x" : " "}] Behavioral (function-level unit tests)
- [${testStyles.includes("stride") ? "x" : " "}] STRIDE (threat modeling tests)
- [${testStyles.includes("owasp") ? "x" : " "}] OWASP Smart Contract Top 10

${testStyles.includes("owasp") ? `## OWASP Categories to Test
1. **SC01: Reentrancy** - External calls before state updates
2. **SC02: Access Control** - Missing/improper authorization
3. **SC03: Integer Overflow/Underflow** - Arithmetic vulnerabilities
4. **SC04: Unchecked Return Values** - Ignored call results
5. **SC05: Denial of Service** - Gas limits, unbounded loops
6. **SC06: Bad Randomness** - Predictable random values
7. **SC07: Front-Running** - Transaction ordering attacks
8. **SC08: Time Manipulation** - Block timestamp dependencies
9. **SC09: Short Address Attack** - Input validation
10. **SC10: Unknown Unknowns** - Invariant/fuzz testing
` : ""}

## Framework Detection
- **Primary Framework**: ${framework}
- **Solidity Version**: ${solidityVersion}
- **Test Framework**: ${framework === "foundry" ? "Forge" : framework === "anchor" ? "Anchor Test" : "Mocha/Chai"}

## Test Generation Instructions
- Generate tests compatible with ${framework} framework
- Use ${framework === "foundry" ? "Forge test syntax (contract Test is Test)" : "describe/it syntax with ethers.js"}
- Include setup/deployment in beforeEach or setUp()
- Each test should have clear assertions
- Focus on security vulnerabilities first
- Include edge cases and boundary conditions

## Output Format
- **Behavioral tests**: \`test/{ContractName}.behavioral.test.${framework === "foundry" ? "sol" : "ts"}\`
- **STRIDE tests**: \`test/{ContractName}.stride.test.${framework === "foundry" ? "sol" : "ts"}\`
- **OWASP tests**: \`test/owasp/{Category}.test.${framework === "foundry" ? "sol" : "ts"}\`
`;

  const outputPath = path.join(contextPath, "test_requirements.md");
  await fs.ensureDir(contextPath);
  await fs.writeFile(outputPath, md, "utf8");

  return outputPath;
}

/**
 * Writes context/milestones.md (initial empty state)
 */
export async function writeMilestones(contextPath: string, status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "FAILED" = "NOT_STARTED"): Promise<string> {
  const md = `# Audit Milestones

## Status: ${status}

## Completed Steps
- [ ] Read project structure
- [ ] Analyze contracts for vulnerabilities
- [ ] Generate behavioral tests
- [ ] Generate STRIDE tests
- [ ] Generate OWASP tests
- [ ] Calculate security score
- [ ] Write results.json

## Current Progress
Not started

## Resume Point
Start from beginning

## Log
- ${new Date().toISOString()}: Milestones initialized
`;

  const outputPath = path.join(contextPath, "milestones.md");
  await fs.ensureDir(contextPath);
  await fs.writeFile(outputPath, md, "utf8");

  return outputPath;
}

/**
 * Initializes empty results.json with repo, branch, and commit info
 */
export async function initResultsJson(contextPath: string, repo?: string, branch?: string, commitHash?: string): Promise<string> {
  const results = {
    metadata: {
      repo: repo || "",
      branch: branch || "",
      commit: commitHash || "",
      status: "pending",
      timestamp: new Date().toISOString()
    },
    analysis: {
      contracts_analyzed: 0,
      total_findings: 0,
      findings: []
    },
    tests_generated: {
      behavioral: { count: 0, files: [] },
      stride: { count: 0, files: [] },
      owasp: { count: 0, files: [] }
    },
    score: {
      value: 0,
      grade: "F",
      breakdown: {}
    },
    recommendations: []
  };

  const outputPath = path.join(contextPath, "results.json");
  await fs.ensureDir(contextPath);
  await fs.writeJson(outputPath, results, { spaces: 2 });

  return outputPath;
}

// Helper functions

async function buildDirectoryTree(projectPath: string, maxDepth: number = 4): Promise<string> {
  const files = await fg(["**/*", "!**/node_modules/**", "!**/.git/**", "!**/target/**", "!**/.uatu/**", "!**/runs/**"], {
    cwd: projectPath,
    onlyFiles: false,
    deep: maxDepth,
    markDirectories: true
  });

  // Build tree structure
  const tree: string[] = [];
  const sortedFiles = files.sort();

  for (const file of sortedFiles.slice(0, 100)) { // Limit to 100 entries
    const depth = file.split("/").length - 1;
    const indent = "  ".repeat(depth);
    const name = file.split("/").pop() || file;
    const isDir = file.endsWith("/");
    tree.push(`${indent}${isDir ? "├── " : "├── "}${name}`);
  }

  return tree.join("\n") || "(empty project)";
}

function detectFramework(
  deps: Record<string, string>,
  devDeps: Record<string, string>,
  solidityFiles: string[],
  rustFiles: string[]
): { primary: string; secondary?: string } {
  const allDeps = { ...deps, ...devDeps };

  if (allDeps.hardhat || allDeps["@nomicfoundation/hardhat-toolbox"]) {
    return { primary: "Hardhat", secondary: solidityFiles.length > 0 ? "Solidity" : undefined };
  }
  if (allDeps["@project-serum/anchor"] || allDeps["@coral-xyz/anchor"]) {
    return { primary: "Anchor", secondary: "Solana" };
  }
  if (allDeps["soroban-sdk"]) {
    return { primary: "Soroban", secondary: "Stellar" };
  }
  if (solidityFiles.length > 0) {
    return { primary: "Foundry/Solidity" };
  }
  if (rustFiles.length > 0) {
    return { primary: "Rust" };
  }
  return { primary: "Unknown" };
}

function isRelevantDep(name: string): boolean {
  const relevant = [
    "hardhat", "@nomicfoundation", "@openzeppelin", "ethers", "web3",
    "foundry", "forge", "solidity", "anchor", "soroban",
    "chai", "mocha", "jest", "typescript"
  ];
  return relevant.some(r => name.toLowerCase().includes(r));
}
