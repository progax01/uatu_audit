/**
 * Deterministic Step Executors
 *
 * Non-AI step executors that perform deterministic analysis.
 * These steps have consistent, reproducible outputs.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import type {
  StepDefinition,
  StepContext,
  StepResult,
  DeterministicStepConfig,
  StepFinding,
} from '../../definitions/types';
import { logger } from '../../../utils/logger';

const log = logger.child({ module: 'deterministic-steps' });

// ============================================================================
// Main Executor
// ============================================================================

/**
 * Execute a deterministic step
 */
export async function executeDeterministicStep(
  step: StepDefinition,
  config: DeterministicStepConfig,
  context: StepContext
): Promise<StepResult> {
  const executor = DETERMINISTIC_EXECUTORS[config.function];

  if (!executor) {
    return {
      success: false,
      error: `Unknown deterministic function: ${config.function}`,
      findings: [],
    };
  }

  return executor(step, config, context);
}

// ============================================================================
// Step Executor Type
// ============================================================================

type DeterministicExecutor = (
  step: StepDefinition,
  config: DeterministicStepConfig,
  context: StepContext
) => Promise<StepResult>;

// ============================================================================
// Framework Detection
// ============================================================================

const detectFramework: DeterministicExecutor = async (step, config, context) => {
  const projectPath = context.projectPath;

  await context.onProgress?.(10, 'Checking project structure...');

  const checks = await Promise.all([
    fs.pathExists(path.join(projectPath, 'foundry.toml')),
    fs.pathExists(path.join(projectPath, 'hardhat.config.js')),
    fs.pathExists(path.join(projectPath, 'hardhat.config.ts')),
    fs.pathExists(path.join(projectPath, 'truffle-config.js')),
    fs.pathExists(path.join(projectPath, 'Anchor.toml')),
    fs.pathExists(path.join(projectPath, 'Move.toml')),
    fs.pathExists(path.join(projectPath, 'Cargo.toml')),
  ]);

  await context.onProgress?.(50, 'Identifying framework...');

  let framework = 'unknown';
  let language = 'unknown';

  if (checks[0]) {
    framework = 'foundry';
    language = 'solidity';
  } else if (checks[1] || checks[2]) {
    framework = 'hardhat';
    language = 'solidity';
  } else if (checks[3]) {
    framework = 'truffle';
    language = 'solidity';
  } else if (checks[4]) {
    framework = 'anchor';
    language = 'rust';
  } else if (checks[5]) {
    framework = 'move';
    language = 'move';
  } else if (checks[6]) {
    // Could be plain Rust or Solana without Anchor
    framework = 'cargo';
    language = 'rust';
  }

  await context.onProgress?.(100, `Detected: ${framework}`);

  log.info('Framework detected', { projectPath, framework, language });

  return {
    success: true,
    findings: [],
    data: {
      // Provide SOP-expected keys
      framework,
      frameworkVersion: null,
      frameworkConfig: null,
      // Keep legacy keys for backward compatibility
      detectedFramework: framework,
      detectedLanguage: language,
    },
  };
};

// ============================================================================
// Project Structure Validation
// ============================================================================

const validateStructure: DeterministicExecutor = async (step, config, context) => {
  const projectPath = context.projectPath;
  const findings: StepFinding[] = [];

  await context.onProgress?.(10, 'Scanning project structure...');

  // Check for common directories
  const commonDirs = ['src', 'contracts', 'lib', 'test', 'tests', 'script', 'scripts'];
  const existingDirs: string[] = [];

  for (const dir of commonDirs) {
    if (await fs.pathExists(path.join(projectPath, dir))) {
      existingDirs.push(dir);
    }
  }

  await context.onProgress?.(50, 'Validating structure...');

  // Check for source files
  const sourcePatterns = ['**/*.sol', '**/*.rs', '**/*.move'];
  let hasSourceFiles = false;

  for (const dir of existingDirs) {
    const fullPath = path.join(projectPath, dir);
    if (await hasFilesWithExtension(fullPath, ['.sol', '.rs', '.move'])) {
      hasSourceFiles = true;
      break;
    }
  }

  if (!hasSourceFiles) {
    // Check root level
    hasSourceFiles = await hasFilesWithExtension(projectPath, ['.sol', '.rs', '.move']);
  }

  if (!hasSourceFiles) {
    findings.push({
      stepId: step.id,
      findingId: 'no-source-files',
      severity: 'critical',
      title: 'No Source Files Found',
      description: 'No Solidity, Rust, or Move source files were found in the project.',
      confidence: 1,
    });
  }

  await context.onProgress?.(100, 'Structure validated');

  // Determine specific directories for SOP compatibility
  const srcDir = existingDirs.find(d => d === 'src' || d === 'contracts') || 'src';
  const testDir = existingDirs.find(d => d === 'test' || d === 'tests') || 'test';
  const libDir = existingDirs.find(d => d === 'lib' || d === 'node_modules') || 'lib';

  return {
    success: hasSourceFiles,
    findings,
    data: {
      // Provide SOP-expected keys
      projectStructure: {
        directories: existingDirs,
        hasSourceFiles,
      },
      srcDir,
      testDir,
      libDir,
      // Legacy keys for backward compatibility
      projectValid: hasSourceFiles,
      sourceDirectories: existingDirs,
    },
    error: !hasSourceFiles ? 'No source files found in project' : undefined,
  };
};

// ============================================================================
// Foundry Config Parser
// ============================================================================

const parseFoundryConfig: DeterministicExecutor = async (step, config, context) => {
  const configPath = path.join(context.projectPath, 'foundry.toml');

  await context.onProgress?.(10, 'Reading foundry.toml...');

  if (!(await fs.pathExists(configPath))) {
    return {
      success: true,
      findings: [],
      data: {
        foundryConfig: null,
        solcVersion: null,
      },
    };
  }

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    await context.onProgress?.(50, 'Parsing configuration...');

    // Simple TOML parsing for key values
    const foundryConfig: Record<string, any> = {};

    // Extract src directory
    const srcMatch = content.match(/src\s*=\s*["']([^"']+)["']/);
    foundryConfig.src = srcMatch ? srcMatch[1] : 'src';

    // Extract test directory
    const testMatch = content.match(/test\s*=\s*["']([^"']+)["']/);
    foundryConfig.test = testMatch ? testMatch[1] : 'test';

    // Extract out directory
    const outMatch = content.match(/out\s*=\s*["']([^"']+)["']/);
    foundryConfig.out = outMatch ? outMatch[1] : 'out';

    // Extract solc version
    const solcMatch = content.match(/solc\s*=\s*["']([^"']+)["']/);
    foundryConfig.solcVersion = solcMatch ? solcMatch[1] : null;

    // Extract optimizer settings
    const optimizerMatch = content.match(/optimizer\s*=\s*(true|false)/);
    foundryConfig.optimizer = optimizerMatch ? optimizerMatch[1] === 'true' : false;

    const runsMatch = content.match(/optimizer_runs\s*=\s*(\d+)/);
    foundryConfig.optimizerRuns = runsMatch ? parseInt(runsMatch[1], 10) : 200;

    // Extract remappings
    const remappingsMatch = content.match(/remappings\s*=\s*\[([\s\S]*?)\]/);
    if (remappingsMatch) {
      const remappingsStr = remappingsMatch[1];
      foundryConfig.remappings = remappingsStr
        .split(',')
        .map((r) => r.trim().replace(/["']/g, ''))
        .filter((r) => r.length > 0);
    }

    await context.onProgress?.(100, 'Configuration parsed');

    return {
      success: true,
      findings: [],
      data: {
        foundryConfig,
        // Provide solcVersion as top-level key for SOP compatibility
        solcVersion: foundryConfig.solcVersion,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      findings: [],
      error: `Failed to parse foundry.toml: ${error.message}`,
    };
  }
};

// ============================================================================
// Hardhat Config Parser
// ============================================================================

const parseHardhatConfig: DeterministicExecutor = async (step, config, context) => {
  await context.onProgress?.(10, 'Looking for Hardhat config...');

  // Check for both JS and TS config files
  const configFiles = ['hardhat.config.js', 'hardhat.config.ts'];
  let configPath: string | null = null;

  for (const file of configFiles) {
    const fullPath = path.join(context.projectPath, file);
    if (await fs.pathExists(fullPath)) {
      configPath = fullPath;
      break;
    }
  }

  if (!configPath) {
    // No config found, return defaults
    return {
      success: true,
      findings: [],
      data: {
        hardhatConfig: {
          paths: {
            sources: './contracts',
            tests: './test',
            cache: './cache',
            artifacts: './artifacts',
          },
        },
        solcVersion: null,
        networks: [],
      },
    };
  }

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    await context.onProgress?.(50, 'Parsing configuration...');

    const hardhatConfig: Record<string, any> = {
      paths: {},
    };

    // Extract solc version (looks for solidity: { version: "0.8.0" })
    const solcMatch = content.match(/version:\s*["']([^"']+)["']/);
    const solcVersion = solcMatch ? solcMatch[1] : null;

    // Extract paths
    const pathsMatch = content.match(/paths:\s*\{([^}]+)\}/);
    if (pathsMatch) {
      const pathsStr = pathsMatch[1];

      const sourcesMatch = pathsStr.match(/sources:\s*["']([^"']+)["']/);
      hardhatConfig.paths.sources = sourcesMatch ? sourcesMatch[1] : './contracts';

      const testsMatch = pathsStr.match(/tests:\s*["']([^"']+)["']/);
      hardhatConfig.paths.tests = testsMatch ? testsMatch[1] : './test';

      const cacheMatch = pathsStr.match(/cache:\s*["']([^"']+)["']/);
      hardhatConfig.paths.cache = cacheMatch ? cacheMatch[1] : './cache';

      const artifactsMatch = pathsStr.match(/artifacts:\s*["']([^"']+)["']/);
      hardhatConfig.paths.artifacts = artifactsMatch ? artifactsMatch[1] : './artifacts';
    } else {
      // Default paths
      hardhatConfig.paths = {
        sources: './contracts',
        tests: './test',
        cache: './cache',
        artifacts: './artifacts',
      };
    }

    // Extract network names (simplified - just look for network definitions)
    const networkMatches = content.match(/(\w+):\s*\{[^}]*url:/g);
    const networks = networkMatches
      ? networkMatches.map((m) => {
          const match = m.match(/(\w+):/);
          return match ? match[1] : null;
        }).filter(Boolean)
      : [];

    await context.onProgress?.(100, 'Configuration parsed');

    return {
      success: true,
      findings: [],
      data: {
        hardhatConfig,
        solcVersion,
        networks,
      },
    };
  } catch (error: any) {
    // If parsing fails, return defaults but with success=true since config is optional
    return {
      success: true,
      findings: [],
      data: {
        hardhatConfig: {
          paths: {
            sources: './contracts',
            tests: './test',
            cache: './cache',
            artifacts: './artifacts',
          },
        },
        solcVersion: null,
        networks: [],
      },
      error: `Could not fully parse config: ${error.message}`,
    };
  }
};

// ============================================================================
// Contract Enumeration
// ============================================================================

const enumerateContracts: DeterministicExecutor = async (step, config, context) => {
  const projectPath = context.projectPath;
  const foundryConfig = context.data.foundryConfig;

  await context.onProgress?.(10, 'Scanning for contracts...');

  // Determine source directory
  const srcDir = foundryConfig?.src || 'src';
  const contractsDir = path.join(projectPath, srcDir);

  const contracts: Array<{
    path: string;
    name: string;
    size: number;
    isTest: boolean;
    isInterface: boolean;
    isLibrary: boolean;
  }> = [];

  // Also check 'contracts' directory if src doesn't exist
  const dirsToScan = [srcDir, 'contracts'].filter(
    async (dir) => await fs.pathExists(path.join(projectPath, dir))
  );

  await context.onProgress?.(30, 'Reading contract files...');

  for (const dir of [srcDir, 'contracts']) {
    const fullPath = path.join(projectPath, dir);
    if (await fs.pathExists(fullPath)) {
      await scanForContracts(fullPath, contracts, projectPath);
    }
  }

  await context.onProgress?.(70, 'Analyzing contract types...');

  // Categorize contracts
  for (const contract of contracts) {
    const content = await fs.readFile(path.join(projectPath, contract.path), 'utf-8');

    contract.isTest = contract.path.includes('.t.sol') || /contract\s+\w+Test\s/.test(content);
    contract.isInterface = /interface\s+\w+\s*\{/.test(content);
    contract.isLibrary = /library\s+\w+\s*\{/.test(content);
  }

  const mainContracts = contracts.filter(
    (c) => !c.isTest && !c.isInterface && !c.isLibrary
  );

  await context.onProgress?.(100, `Found ${mainContracts.length} contracts`);

  const testContracts = contracts.filter((c) => c.isTest);
  const libraryContracts = contracts.filter((c) => c.isLibrary);

  log.info('Contracts enumerated', {
    total: contracts.length,
    main: mainContracts.length,
    tests: testContracts.length,
    interfaces: contracts.filter((c) => c.isInterface).length,
    libraries: libraryContracts.length,
  });

  return {
    success: true,
    findings: [],
    data: {
      // Provide keys matching SOP definition
      contractFiles: contracts,
      mainContracts,
      testContracts,
      libraryContracts,
      // Keep legacy keys for backward compatibility
      contracts,
      contractCount: mainContracts.length,
      testsExist: testContracts.length > 0,
      testFileCount: testContracts.length,
    },
  };
};

// ============================================================================
// SLOC Counter
// ============================================================================

const countSloc: DeterministicExecutor = async (step, config, context) => {
  const contracts = context.data.contracts || [];

  await context.onProgress?.(10, 'Counting lines of code...');

  let totalLines = 0;
  let codeLines = 0;
  let commentLines = 0;
  let blankLines = 0;

  for (let i = 0; i < contracts.length; i++) {
    const contract = contracts[i];
    const fullPath = path.join(context.projectPath, contract.path);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      totalLines += lines.length;

      let inMultilineComment = false;

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.length === 0) {
          blankLines++;
        } else if (inMultilineComment) {
          commentLines++;
          if (trimmed.includes('*/')) {
            inMultilineComment = false;
          }
        } else if (trimmed.startsWith('/*')) {
          commentLines++;
          if (!trimmed.includes('*/')) {
            inMultilineComment = true;
          }
        } else if (trimmed.startsWith('//')) {
          commentLines++;
        } else {
          codeLines++;
        }
      }
    } catch {
      // Skip files that can't be read
    }

    // Report progress
    const pct = Math.round(((i + 1) / contracts.length) * 80) + 10;
    await context.onProgress?.(pct, 'Counting...');
  }

  await context.onProgress?.(100, `${codeLines} lines of code`);

  return {
    success: true,
    findings: [],
    data: {
      sloc: {
        total: totalLines,
        code: codeLines,
        comment: commentLines,
        blank: blankLines,
      },
    },
  };
};

// ============================================================================
// Solc Version Check
// ============================================================================

const checkSolcVersion: DeterministicExecutor = async (step, config, context) => {
  const contracts = context.data.contracts || [];
  const findings: StepFinding[] = [];

  await context.onProgress?.(10, 'Checking pragma statements...');

  const versionRegex = /pragma\s+solidity\s+([^;]+);/g;
  const versions = new Set<string>();

  for (const contract of contracts) {
    const fullPath = path.join(context.projectPath, contract.path);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      let match;

      while ((match = versionRegex.exec(content)) !== null) {
        versions.add(match[1].trim());
      }
    } catch {
      // Skip files that can't be read
    }
  }

  await context.onProgress?.(60, 'Analyzing versions...');

  // Check for version issues
  for (const version of versions) {
    // Check for floating pragma
    if (version.startsWith('^') || version.includes('>=') || version.includes('<')) {
      findings.push({
        stepId: step.id,
        findingId: `floating-pragma-${version}`,
        severity: 'low',
        title: 'Floating Pragma',
        description: `Floating pragma version "${version}" found. Consider using a fixed version for production.`,
        confidence: 0.9,
        recommendation: 'Lock the pragma to a specific Solidity version for consistent compilation.',
      });
    }

    // Check for outdated version
    const versionNumber = version.replace(/[^0-9.]/g, '').split('.').map(Number);
    if (versionNumber[1] && versionNumber[1] < 8) {
      findings.push({
        stepId: step.id,
        findingId: `outdated-version-${version}`,
        severity: 'medium',
        title: 'Outdated Solidity Version',
        description: `Solidity version "${version}" is outdated. Versions < 0.8.0 lack built-in overflow protection.`,
        confidence: 1,
        recommendation: 'Upgrade to Solidity 0.8.x or later for built-in overflow/underflow protection.',
      });
    }
  }

  await context.onProgress?.(100, `Found ${versions.size} version(s)`);

  return {
    success: true,
    findings,
    data: {
      solcVersions: Array.from(versions),
    },
  };
};

// ============================================================================
// Compilation Parser
// ============================================================================

const parseCompilation: DeterministicExecutor = async (step, config, context) => {
  // This step processes the compilation output from forge build
  // The actual build is done by the tool step 'run-forge-build'

  await context.onProgress?.(50, 'Analyzing compilation results...');

  const buildResult = context.data.forgeBuildResult;
  const findings: StepFinding[] = [];

  if (!buildResult) {
    return {
      success: true,
      findings: [],
      data: {
        compilationSuccess: false,
      },
    };
  }

  // Check for compilation warnings in the build output
  if (buildResult.warnings) {
    for (const warning of buildResult.warnings) {
      findings.push({
        stepId: step.id,
        findingId: `compilation-warning-${findings.length}`,
        severity: 'low',
        title: 'Compilation Warning',
        description: warning,
        confidence: 1,
      });
    }
  }

  await context.onProgress?.(100, 'Compilation analyzed');

  return {
    success: true,
    findings,
    data: {
      compilationSuccess: buildResult.success,
      compilationWarnings: buildResult.warnings || [],
    },
  };
};

// ============================================================================
// AST Generation
// ============================================================================

const generateAst: DeterministicExecutor = async (step, config, context) => {
  // Read compiled AST from forge build output
  const outDir = context.data.foundryConfig?.out || 'out';
  const astPath = path.join(context.projectPath, outDir);

  await context.onProgress?.(10, 'Reading AST files...');

  const astData: Record<string, any> = {};

  if (await fs.pathExists(astPath)) {
    try {
      const entries = await fs.readdir(astPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.json')) {
          const filePath = path.join(astPath, entry.name);
          const content = await fs.readFile(filePath, 'utf-8');

          try {
            const parsed = JSON.parse(content);
            if (parsed.ast) {
              astData[entry.name.replace('.json', '')] = parsed.ast;
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } catch (error) {
      log.warn('Failed to read AST files', { error });
    }
  }

  await context.onProgress?.(100, `Parsed ${Object.keys(astData).length} ASTs`);

  return {
    success: true,
    findings: [],
    data: {
      // Provide SOP-expected keys
      ast: astData,  // Main field expected by downstream steps
      astNodes: Object.keys(astData),  // List of AST node names
      // Keep legacy keys for backward compatibility
      astData,
      astAvailable: Object.keys(astData).length > 0,
    },
  };
};

// ============================================================================
// Inheritance Mapping
// ============================================================================

const mapInheritance: DeterministicExecutor = async (step, config, context) => {
  const contracts = context.data.contracts || [];

  await context.onProgress?.(10, 'Analyzing inheritance...');

  const inheritanceMap: Record<string, string[]> = {};
  const inheritanceRegex = /contract\s+(\w+)\s+is\s+([^{]+)/g;

  for (const contract of contracts) {
    const fullPath = path.join(context.projectPath, contract.path);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      let match;

      while ((match = inheritanceRegex.exec(content)) !== null) {
        const contractName = match[1];
        const parents = match[2]
          .split(',')
          .map((p) => p.trim().split('(')[0].trim())
          .filter((p) => p.length > 0);

        inheritanceMap[contractName] = parents;
      }
    } catch {
      // Skip files that can't be read
    }
  }

  await context.onProgress?.(100, 'Inheritance mapped');

  return {
    success: true,
    findings: [],
    data: {
      inheritanceMap,
    },
  };
};

// ============================================================================
// Import Analysis
// ============================================================================

const analyzeImports: DeterministicExecutor = async (step, config, context) => {
  const contracts = context.data.contracts || [];
  const findings: StepFinding[] = [];

  await context.onProgress?.(10, 'Analyzing imports...');

  const importMap: Record<string, string[]> = {};
  const importRegex = /import\s+(?:{[^}]+}\s+from\s+)?["']([^"']+)["']/g;

  const externalDeps = new Set<string>();
  const localImports = new Set<string>();

  for (const contract of contracts) {
    const fullPath = path.join(context.projectPath, contract.path);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const imports: string[] = [];
      let match;

      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        imports.push(importPath);

        if (importPath.startsWith('@') || importPath.startsWith('lib/')) {
          externalDeps.add(importPath.split('/').slice(0, 2).join('/'));
        } else {
          localImports.add(importPath);
        }
      }

      importMap[contract.path] = imports;
    } catch {
      // Skip files that can't be read
    }
  }

  // Check for known dependencies
  const knownDeps: Record<string, string> = {
    '@openzeppelin': 'OpenZeppelin Contracts',
    'solmate': 'Solmate',
    '@chainlink': 'Chainlink',
    '@uniswap': 'Uniswap',
    'forge-std': 'Forge Standard Library',
  };

  const identifiedDeps: string[] = [];
  for (const dep of externalDeps) {
    for (const [key, name] of Object.entries(knownDeps)) {
      if (dep.includes(key)) {
        identifiedDeps.push(name);
      }
    }
  }

  await context.onProgress?.(100, 'Imports analyzed');

  return {
    success: true,
    findings,
    data: {
      importMap,
      externalDependencies: Array.from(externalDeps),
      identifiedDependencies: identifiedDeps,
    },
  };
};

// ============================================================================
// Interface Detection
// ============================================================================

const detectInterfaces: DeterministicExecutor = async (step, config, context) => {
  const contracts = context.data.contracts || [];

  await context.onProgress?.(10, 'Detecting interfaces...');

  const implementedInterfaces: Record<string, string[]> = {};

  // Known ERC interfaces
  const ercInterfaces = [
    'IERC20',
    'IERC721',
    'IERC1155',
    'IERC2981',
    'IERC165',
    'IERC4626',
  ];

  const inheritanceMap = (context.data.inheritanceMap || {}) as Record<string, string[]>;

  for (const [contract, parents] of Object.entries(inheritanceMap)) {
    const interfaces = (parents || []).filter(
      (p: string) => p.startsWith('I') || ercInterfaces.some((e) => p.includes(e))
    );

    if (interfaces.length > 0) {
      implementedInterfaces[contract] = interfaces;
    }
  }

  await context.onProgress?.(100, 'Interfaces detected');

  return {
    success: true,
    findings: [],
    data: {
      implementedInterfaces,
    },
  };
};

// ============================================================================
// Function Signature Extraction
// ============================================================================

const extractSignatures: DeterministicExecutor = async (step, config, context) => {
  const contracts = context.data.mainContracts || [];

  await context.onProgress?.(10, 'Extracting function signatures...');

  const signatures: Record<string, Array<{
    name: string;
    visibility: string;
    stateMutability: string;
    params: string;
    returns: string;
    modifiers: string[];
  }>> = {};

  const funcRegex = /function\s+(\w+)\s*\(([^)]*)\)\s*(public|external|internal|private)?\s*(view|pure|payable)?\s*(virtual|override)*\s*(?:returns\s*\(([^)]*)\))?/g;

  for (const contract of contracts) {
    const fullPath = path.join(context.projectPath, contract.path);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const contractFuncs: typeof signatures[string] = [];
      let match;

      while ((match = funcRegex.exec(content)) !== null) {
        contractFuncs.push({
          name: match[1],
          params: match[2] || '',
          visibility: match[3] || 'public',
          stateMutability: match[4] || '',
          returns: match[6] || '',
          modifiers: [],
        });
      }

      signatures[contract.name || contract.path] = contractFuncs;
    } catch {
      // Skip files that can't be read
    }
  }

  await context.onProgress?.(100, 'Signatures extracted');

  return {
    success: true,
    findings: [],
    data: {
      functionSignatures: signatures,
    },
  };
};

// ============================================================================
// External Call Identification
// ============================================================================

const identifyExternalCalls: DeterministicExecutor = async (step, config, context) => {
  const contracts = context.data.mainContracts || [];
  const findings: StepFinding[] = [];

  await context.onProgress?.(10, 'Identifying external calls...');

  const externalCalls: Array<{
    file: string;
    line: number;
    type: string;
    target: string;
  }> = [];

  // Patterns for external calls
  const patterns = [
    { regex: /\.call\{?\s*(?:value|gas)?/g, type: 'low-level-call' },
    { regex: /\.delegatecall\(/g, type: 'delegatecall' },
    { regex: /\.staticcall\(/g, type: 'staticcall' },
    { regex: /\.transfer\(/g, type: 'transfer' },
    { regex: /\.send\(/g, type: 'send' },
  ];

  for (const contract of contracts) {
    const fullPath = path.join(context.projectPath, contract.path);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        for (const pattern of patterns) {
          if (pattern.regex.test(line)) {
            externalCalls.push({
              file: contract.path,
              line: i + 1,
              type: pattern.type,
              target: line.trim(),
            });

            // Reset regex
            pattern.regex.lastIndex = 0;
          }
        }
      }
    } catch {
      // Skip files that can't be read
    }
  }

  // Generate findings for risky patterns
  for (const call of externalCalls) {
    if (call.type === 'delegatecall') {
      findings.push({
        stepId: step.id,
        findingId: `delegatecall-${call.file}-${call.line}`,
        severity: 'medium',
        title: 'Delegatecall Usage',
        description: 'Delegatecall found. Ensure the target is trusted as it executes in the caller\'s context.',
        confidence: 0.7,
        location: { file: call.file, line: call.line },
        recommendation: 'Validate delegatecall targets and consider using explicit contract references.',
      });
    }
  }

  await context.onProgress?.(100, `Found ${externalCalls.length} external calls`);

  return {
    success: true,
    findings,
    data: {
      externalCalls,
    },
  };
};

// ============================================================================
// Test Existence Check
// ============================================================================

const checkTestsExist: DeterministicExecutor = async (step, config, context) => {
  const projectPath = context.projectPath;

  await context.onProgress?.(10, 'Checking for tests...');

  const testDirs = ['test', 'tests'];
  let testsExist = false;
  let testFiles: string[] = [];

  for (const dir of testDirs) {
    const fullPath = path.join(projectPath, dir);
    if (await fs.pathExists(fullPath)) {
      testsExist = true;

      // Find test files
      await scanForFiles(fullPath, testFiles, ['.t.sol', '.test.js', '.test.ts', '_test.go']);
    }
  }

  // Also check for .t.sol files in src
  const contracts = context.data.contracts || [];
  const testContracts = contracts.filter((c: any) => c.isTest);

  await context.onProgress?.(100, testsExist ? 'Tests found' : 'No tests');

  return {
    success: true,
    findings: testsExist ? [] : [{
      stepId: step.id,
      findingId: 'no-tests',
      severity: 'medium',
      title: 'No Tests Found',
      description: 'No test files were found in the project. Testing is critical for smart contract security.',
      confidence: 0.9,
      recommendation: 'Add comprehensive tests using Foundry\'s testing framework.',
    }],
    data: {
      testsExist,
      testFileCount: testFiles.length + testContracts.length,
    },
  };
};

// ============================================================================
// Finding Merge
// ============================================================================

const mergeToolFindings: DeterministicExecutor = async (step, config, context) => {
  await context.onProgress?.(10, 'Collecting findings...');

  // Collect findings from all tool steps
  const allFindings: StepFinding[] = [];

  const toolKeys = [
    'slitherFindings',
    'mythrilFindings',
    'semgrepFindings',
    'forgeTestFindings',
  ];

  for (const key of toolKeys) {
    const findings = context.data[key];
    if (Array.isArray(findings)) {
      allFindings.push(...findings);
    }
  }

  await context.onProgress?.(50, `Merged ${allFindings.length} findings`);

  // Group by severity
  const bySeverity = {
    critical: allFindings.filter((f) => f.severity === 'critical'),
    high: allFindings.filter((f) => f.severity === 'high'),
    medium: allFindings.filter((f) => f.severity === 'medium'),
    low: allFindings.filter((f) => f.severity === 'low'),
    info: allFindings.filter((f) => f.severity === 'info'),
  };

  await context.onProgress?.(100, 'Findings merged');

  return {
    success: true,
    findings: [],
    data: {
      mergedFindings: allFindings,
      findingsBySeverity: bySeverity,
      totalFindings: allFindings.length,
    },
  };
};

// ============================================================================
// Deduplication
// ============================================================================

const deduplicateFindings: DeterministicExecutor = async (step, config, context) => {
  const mergedFindings = context.data.mergedFindings || [];
  const aiFindings = context.data.aiFindings || [];

  await context.onProgress?.(10, 'Deduplicating findings...');

  const allFindings = [...mergedFindings, ...aiFindings];
  const seen = new Map<string, StepFinding>();

  for (const finding of allFindings) {
    // Create dedup key based on location and title
    const key = `${finding.location?.file || ''}:${finding.location?.line || ''}:${finding.title}`;

    if (!seen.has(key)) {
      seen.set(key, finding);
    } else {
      // Keep the one with higher confidence or more details
      const existing = seen.get(key)!;
      if ((finding.confidence || 0) > (existing.confidence || 0)) {
        seen.set(key, finding);
      }
    }
  }

  const deduplicated = Array.from(seen.values());

  await context.onProgress?.(100, `${deduplicated.length} unique findings`);

  return {
    success: true,
    findings: [],
    data: {
      deduplicatedFindings: deduplicated,
      duplicatesRemoved: allFindings.length - deduplicated.length,
    },
  };
};

// ============================================================================
// Severity Calculation
// ============================================================================

const calculateSeverity: DeterministicExecutor = async (step, config, context) => {
  const findings = context.data.deduplicatedFindings || [];

  await context.onProgress?.(50, 'Calculating severity...');

  // Apply severity adjustments based on context
  for (const finding of findings) {
    // Boost severity if in critical contract
    const mainContracts = context.data.mainContracts || [];
    if (finding.location?.file) {
      const isMainContract = mainContracts.some(
        (c: any) => finding.location?.file?.includes(c.path)
      );

      if (isMainContract && finding.severity === 'medium') {
        // Potential upgrade for main contracts
        finding.severityNotes = 'Located in main contract';
      }
    }
  }

  await context.onProgress?.(100, 'Severity calculated');

  return {
    success: true,
    findings: [],
    data: {
      // Provide SOP-expected key
      severityRankedFindings: findings,
      // Keep legacy key for backward compatibility
      finalFindings: findings,
    },
  };
};

// ============================================================================
// Score Calculation
// ============================================================================

const calculateScore: DeterministicExecutor = async (step, config, context) => {
  const findings = context.data.finalFindings || [];

  await context.onProgress?.(30, 'Computing audit score...');

  // Weight by severity
  const weights = {
    critical: 25,
    high: 15,
    medium: 5,
    low: 2,
    info: 0,
  };

  let deductions = 0;
  for (const finding of findings) {
    deductions += weights[finding.severity as keyof typeof weights] || 0;
  }

  // Cap deductions at 100
  const score = Math.max(0, 100 - Math.min(deductions, 100));

  // Grade
  let grade: string;
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';

  await context.onProgress?.(100, `Score: ${score}/100 (${grade})`);

  return {
    success: true,
    findings: [],
    data: {
      auditScore: score,
      auditGrade: grade,
      scoreBreakdown: {
        critical: findings.filter((f: any) => f.severity === 'critical').length,
        high: findings.filter((f: any) => f.severity === 'high').length,
        medium: findings.filter((f: any) => f.severity === 'medium').length,
        low: findings.filter((f: any) => f.severity === 'low').length,
        info: findings.filter((f: any) => f.severity === 'info').length,
      },
    },
  };
};

// ============================================================================
// Report Generation
// ============================================================================

const generateReport: DeterministicExecutor = async (step, config, context) => {
  await context.onProgress?.(10, 'Generating report...');

  const report = {
    generatedAt: new Date().toISOString(),
    projectPath: context.projectPath,
    framework: context.data.detectedFramework,
    language: context.data.detectedLanguage,
    summary: {
      contractCount: context.data.contractCount || 0,
      sloc: context.data.sloc,
      score: context.data.auditScore,
      grade: context.data.auditGrade,
      totalFindings: (context.data.finalFindings || []).length,
    },
    dependencies: context.data.identifiedDependencies || [],
    findings: context.data.finalFindings || [],
    toolsUsed: context.availableTools,
  };

  await context.onProgress?.(100, 'Report generated');

  return {
    success: true,
    findings: [],
    data: {
      auditReport: report,
    },
  };
};

// ============================================================================
// Parse Tool Output Steps
// ============================================================================

const parseSlitherOutput: DeterministicExecutor = async (step, config, context) => {
  // Slither parsing is done in the tool wrapper, this step just extracts data
  await context.onProgress?.(50, 'Processing Slither results...');

  const slitherResult = context.data.slitherResult;
  const findings = slitherResult?.findings || [];

  await context.onProgress?.(100, `${findings.length} Slither findings`);

  return {
    success: true,
    findings: [],
    data: {
      slitherFindings: findings,
    },
  };
};

const parseMythrilOutput: DeterministicExecutor = async (step, config, context) => {
  await context.onProgress?.(50, 'Processing Mythril results...');

  const mythrilResult = context.data.mythrilResult;
  const findings = mythrilResult?.findings || [];

  await context.onProgress?.(100, `${findings.length} Mythril findings`);

  return {
    success: true,
    findings: [],
    data: {
      mythrilFindings: findings,
    },
  };
};

const parseSemgrepOutput: DeterministicExecutor = async (step, config, context) => {
  await context.onProgress?.(50, 'Processing Semgrep results...');

  const semgrepResult = context.data.semgrepResult;
  const findings = semgrepResult?.findings || [];

  await context.onProgress?.(100, `${findings.length} Semgrep findings`);

  return {
    success: true,
    findings: [],
    data: {
      semgrepFindings: findings,
    },
  };
};

const parseTestResults: DeterministicExecutor = async (step, config, context) => {
  await context.onProgress?.(50, 'Processing test results...');

  const testResult = context.data.forgeTestResult;
  const findings = testResult?.findings || [];

  await context.onProgress?.(100, `${findings.length} test findings`);

  return {
    success: true,
    findings: [],
    data: {
      forgeTestFindings: findings,
      testsPassed: testResult?.success || false,
    },
  };
};

// ============================================================================
// Executor Registry
// ============================================================================

const DETERMINISTIC_EXECUTORS: Record<string, DeterministicExecutor> = {
  'detectFramework': detectFramework,
  'validateStructure': validateStructure,
  'validateProjectStructure': validateStructure,  // Alias for SOP compatibility
  'parseFoundryConfig': parseFoundryConfig,
  'parseHardhatConfig': parseHardhatConfig,
  'enumerateContracts': enumerateContracts,
  'countSloc': countSloc,
  'checkSolcVersion': checkSolcVersion,
  'parseCompilation': parseCompilation,
  'generateAst': generateAst,
  'mapInheritance': mapInheritance,
  'analyzeImports': analyzeImports,
  'detectInterfaces': detectInterfaces,
  'extractSignatures': extractSignatures,
  'identifyExternalCalls': identifyExternalCalls,
  'checkTestsExist': checkTestsExist,
  'parseSlitherOutput': parseSlitherOutput,
  'parseMythrilOutput': parseMythrilOutput,
  'parseSemgrepOutput': parseSemgrepOutput,
  'parseTestResults': parseTestResults,
  'mergeToolFindings': mergeToolFindings,
  'deduplicateFindings': deduplicateFindings,
  'calculateSeverity': calculateSeverity,
  'calculateScore': calculateScore,
  'generateReport': generateReport,
};

// ============================================================================
// Helpers
// ============================================================================

async function hasFilesWithExtension(dir: string, extensions: string[]): Promise<boolean> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile()) {
        for (const ext of extensions) {
          if (entry.name.endsWith(ext)) {
            return true;
          }
        }
      } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const found = await hasFilesWithExtension(path.join(dir, entry.name), extensions);
        if (found) return true;
      }
    }
  } catch {
    // Ignore errors
  }

  return false;
}

async function scanForContracts(
  dir: string,
  contracts: Array<{ path: string; name: string; size: number; isTest: boolean; isInterface: boolean; isLibrary: boolean }>,
  projectPath: string
): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        await scanForContracts(fullPath, contracts, projectPath);
      } else if (entry.isFile() && entry.name.endsWith('.sol')) {
        const stats = await fs.stat(fullPath);
        contracts.push({
          path: path.relative(projectPath, fullPath),
          name: entry.name.replace('.sol', ''),
          size: stats.size,
          isTest: false,
          isInterface: false,
          isLibrary: false,
        });
      }
    }
  } catch {
    // Ignore errors
  }
}

async function scanForFiles(
  dir: string,
  files: string[],
  extensions: string[]
): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        await scanForFiles(fullPath, files, extensions);
      } else if (entry.isFile()) {
        for (const ext of extensions) {
          if (entry.name.endsWith(ext)) {
            files.push(fullPath);
            break;
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }
}
