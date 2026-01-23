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
        testSkipReason: 'Compilation output not available.',
      },
    };
  }

  // Check for compilation warnings in the build output
  // Filter to only include security-relevant warnings, exclude noise
  if (buildResult.warnings) {
    const meaningfulWarnings = buildResult.warnings.filter((warning: string) => {
      const lowerWarning = warning.toLowerCase();

      // Exclude common noise warnings
      const noisePatterns = [
        'spdx license',
        'unused local variable',
        'unused function parameter',
        'unused return value',
        'contract code size',
        'shadowed declaration',
        'unreachable code',
        'this contract has a payable fallback',
        'function state mutability can be restricted',
        'unary negation overflow',
        'this declaration has the same name',
        'different number of components',
      ];

      // If warning contains any noise pattern, skip it
      if (noisePatterns.some(pattern => lowerWarning.includes(pattern))) {
        return false;
      }

      // Include security-relevant warnings
      const securityPatterns = [
        'reentrancy',
        'overflow',
        'underflow',
        'unchecked',
        'delegatecall',
        'selfdestruct',
        'suicide',
        'tx.origin',
        'block.timestamp',
        'now',
        'deprecated',
      ];

      return securityPatterns.some(pattern => lowerWarning.includes(pattern));
    });

    for (const warning of meaningfulWarnings) {
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

  // Add test skip reason if compilation failed
  let testSkipReason: string | undefined;
  if (!buildResult.success) {
    testSkipReason = 'Compilation failed. Fix compilation errors to run tests.';
  }

  return {
    success: true,
    findings,
    data: {
      compilationSuccess: buildResult.success,
      compilationWarnings: buildResult.warnings || [],
      testSkipReason, // NEW: Track why tests can't run if compilation failed
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

  // Generate skip reason if tests don't exist
  let testSkipReason: string | undefined;
  if (!testsExist) {
    testSkipReason = 'No test files found. Add tests in test/ or tests/ directory.';
  }

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
      testSkipReason, // NEW: Track why tests can't run
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
    tenthManAnalyses: context.data.tenthManAnalyses || [],
    severityAdjustments: context.data.severityAdjustments || [],
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
  await context.onProgress?.(10, 'Processing test results...');

  // Support both forge and hardhat
  const forgeResult = context.data.forgeTestResult;
  const hardhatResult = context.data.hardhatTestResult;
  const rawTestOutput = context.data.testOutput || '';

  if (!forgeResult && !hardhatResult && !rawTestOutput) {
    log.warn('No test results available to parse');
    return {
      success: true,
      findings: [],
      data: {
        testsPassed: false,
        testsExecuted: false,
      },
    };
  }

  await context.onProgress?.(50, 'Parsing test output...');

  try {
    // Import test result parser
    const { parseTestOutput } = await import('../../../services/testResultParser.js');

    // Determine framework
    const framework = forgeResult ? 'foundry' : 'hardhat';

    // Parse structured output
    const parsed = parseTestOutput(
      rawTestOutput || forgeResult?.stdout || hardhatResult?.stdout || '',
      framework
    );

    const testResults = {
      framework,
      totalTests: parsed?.testCases?.length || 0,
      passed: parsed?.testCases?.filter((t: any) => t.status === 'passed').length || 0,
      failed: parsed?.testCases?.filter((t: any) => t.status === 'failed').length || 0,
      skipped: parsed?.testCases?.filter((t: any) => t.status === 'skipped').length || 0,
      duration: parsed?.stats?.duration || 0,
      testCases: parsed?.testCases || [],
    };

    log.info('Test results parsed', {
      framework,
      totalTests: testResults.totalTests,
      passed: testResults.passed,
      failed: testResults.failed,
    });

    await context.onProgress?.(100, 'Test parsing complete');

    return {
      success: true,
      findings: forgeResult?.findings || [],
      data: {
        forgeTestFindings: forgeResult?.findings || [],
        testsPassed: testResults.failed === 0 && testResults.totalTests > 0,
        testsExecuted: testResults.totalTests > 0,
        testResults,  // ADD STRUCTURED RESULTS
        parsedTests: parsed,  // ADD FULL PARSED DATA
      },
    };
  } catch (error: any) {
    log.error('Failed to parse test results', { error: error.message });
    return {
      success: true,  // Don't fail audit on parsing error
      findings: forgeResult?.findings || [],
      data: {
        forgeTestFindings: forgeResult?.findings || [],
        testsPassed: forgeResult?.success || false,
        testsExecuted: true,
        parseError: error.message,
      },
    };
  }
};

const parseCoverageResults: DeterministicExecutor = async (step, config, context) => {
  await context.onProgress?.(10, 'Parsing coverage report...');

  const coverageReport = context.data.coverageReport;

  if (!coverageReport) {
    log.warn('No coverage report available to parse');
    return {
      success: true,
      findings: [],
      data: {
        coverageAvailable: false,
        coverageSummary: null,
      },
    };
  }

  await context.onProgress?.(50, 'Extracting coverage metrics...');

  try {
    // Parse coverage JSON (hardhat coverage format)
    const coverage = typeof coverageReport === 'string'
      ? JSON.parse(coverageReport)
      : coverageReport;

    const summary = {
      statements: {
        total: 0,
        covered: 0,
        pct: 0
      },
      branches: {
        total: 0,
        covered: 0,
        pct: 0
      },
      functions: {
        total: 0,
        covered: 0,
        pct: 0
      },
      lines: {
        total: 0,
        covered: 0,
        pct: 0
      }
    };

    // Extract metrics from coverage report
    Object.values(coverage).forEach((file: any) => {
      if (file.s) summary.statements.total += Object.keys(file.s).length;
      if (file.b) summary.branches.total += Object.keys(file.b).length;
      if (file.f) summary.functions.total += Object.keys(file.f).length;
      if (file.l) summary.lines.total += Object.keys(file.l).length;

      Object.values(file.s || {}).forEach((hits: any) => {
        if (hits > 0) summary.statements.covered++;
      });
      Object.values(file.b || {}).forEach((branch: any) => {
        if (Array.isArray(branch) && branch.some(b => b > 0)) summary.branches.covered++;
      });
      Object.values(file.f || {}).forEach((hits: any) => {
        if (hits > 0) summary.functions.covered++;
      });
      Object.values(file.l || {}).forEach((hits: any) => {
        if (hits > 0) summary.lines.covered++;
      });
    });

    // Calculate percentages
    summary.statements.pct = summary.statements.total > 0
      ? (summary.statements.covered / summary.statements.total) * 100
      : 0;
    summary.branches.pct = summary.branches.total > 0
      ? (summary.branches.covered / summary.branches.total) * 100
      : 0;
    summary.functions.pct = summary.functions.total > 0
      ? (summary.functions.covered / summary.functions.total) * 100
      : 0;
    summary.lines.pct = summary.lines.total > 0
      ? (summary.lines.covered / summary.lines.total) * 100
      : 0;

    log.info('Coverage summary calculated', summary);

    await context.onProgress?.(100, 'Coverage parsing complete');

    return {
      success: true,
      findings: [],
      data: {
        coverageAvailable: true,
        coverageSummary: summary,
        parsedCoverage: coverage,
      },
    };
  } catch (error: any) {
    log.error('Failed to parse coverage report', { error: error.message });
    return {
      success: true,  // Don't fail audit on coverage parsing error
      findings: [],
      data: {
        coverageAvailable: false,
        coverageSummary: null,
        coverageParseError: error.message,
      },
    };
  }
};

// ============================================================================
// 10th Man Analysis - Devil's Advocate Severity Validation
// ============================================================================

const perform10thManAnalysis: DeterministicExecutor = async (step, config, context) => {
  await context.onProgress?.(10, 'Performing 10th man analysis...');

  // Get all findings from context
  const allFindings = context.data.findings || [];
  const mergedFindings = context.data.mergedFindings || [];
  const findings = mergedFindings.length > 0 ? mergedFindings : allFindings;

  if (!findings || findings.length === 0) {
    log.warn('No findings available for 10th man analysis');
    return {
      success: true,
      findings: [],
      data: {
        tenthManAnalyses: [],
        severityAdjustments: [],
      },
    };
  }

  await context.onProgress?.(30, 'Challenging critical/high findings...');

  try {
    // Import the 10th man analysis service
    const { analyze10thManForFindings } = await import('../../../services/tenthManAnalysis.js');

    // Detect contract type from context
    const contractType = context.data.contractType || context.data.category || 'generic';

    // Perform 10th man analysis on all critical/high findings
    const analyses = await analyze10thManForFindings(findings, contractType);

    await context.onProgress?.(70, 'Validating severity ratings...');

    // Track severity adjustments
    const severityAdjustments: Array<{
      findingId: string;
      originalSeverity: string;
      adjustedSeverity: string;
      reason: string;
      confidence: string;
    }> = [];

    // Apply severity adjustments to findings
    for (const analysis of analyses) {
      if (analysis.severityChallenge.shouldDowngrade || analysis.severityChallenge.shouldUpgrade) {
        severityAdjustments.push({
          findingId: analysis.findingId,
          originalSeverity: analysis.severityChallenge.originalSeverity,
          adjustedSeverity: analysis.finalVerdict.agreedSeverity,
          reason: analysis.finalVerdict.reasoning,
          confidence: analysis.severityChallenge.confidence,
        });

        // Find and update the finding
        const finding = findings.find((f: any) => f.id === analysis.findingId);
        if (finding) {
          finding.originalSeverity = finding.severity;
          finding.severity = analysis.finalVerdict.agreedSeverity;
          finding.severityAdjustmentReason = analysis.finalVerdict.reasoning;
          finding.tenthManAnalysis = analysis;

          log.info('10th man adjusted severity', {
            findingId: finding.id,
            from: analysis.severityChallenge.originalSeverity,
            to: analysis.finalVerdict.agreedSeverity,
            confidence: analysis.severityChallenge.confidence,
          });
        }
      }
    }

    await context.onProgress?.(100, '10th man analysis complete');

    log.info('10th man analysis completed', {
      totalFindings: findings.length,
      analysesPerformed: analyses.length,
      adjustmentsMade: severityAdjustments.length,
    });

    return {
      success: true,
      findings: [],  // Don't add new findings, just modify existing ones
      data: {
        tenthManAnalyses: analyses,
        severityAdjustments,
        adjustedFindings: findings,  // Return modified findings
      },
    };
  } catch (error: any) {
    log.error('Failed to perform 10th man analysis', { error: error.message });
    return {
      success: true,  // Don't fail audit on 10th man analysis error
      findings: [],
      data: {
        tenthManAnalyses: [],
        severityAdjustments: [],
        tenthManError: error.message,
      },
    };
  }
};

// ============================================================================
// Contract Type Classification
// ============================================================================

const classifyContractType: DeterministicExecutor = async (step, config, context) => {
  await context.onProgress?.(10, 'Classifying contract type...');

  try {
    // Import the contract type detector service
    const { detectContractType } = await import('../../../services/contractTypeDetector.js');

    // Run contract type detection
    const classification = await detectContractType(context.projectPath);

    await context.onProgress?.(100, `Detected: ${classification.category}`);

    log.info('Contract classified', {
      category: classification.category,
      confidence: classification.confidence,
    });

    return {
      success: true,
      findings: [],
      data: {
        contractClassification: classification,
        contractCategory: classification.category,
        detectedInterfaces: classification.interfaces,
        detectedPatterns: classification.patterns,
      },
    };
  } catch (error: any) {
    log.warn('Contract classification failed', { error: error.message });

    return {
      success: true,  // Don't fail the audit if classification fails
      findings: [],
      data: {
        contractCategory: 'generic',
        detectedInterfaces: [],
        detectedPatterns: [],
      },
      error: `Classification failed: ${error.message}`,
    };
  }
};

// ============================================================================
// Simple Interface Detection (Regex-based, no compilation)
// ============================================================================

const detectInterfacesSimple: DeterministicExecutor = async (step, config, context) => {
  const contracts = context.data.contractFiles || [];

  await context.onProgress?.(10, 'Detecting interfaces (regex)...');

  const detectedInterfaces = new Set<string>();

  // Known ERC interfaces to detect
  const knownInterfaces = [
    'IERC20',
    'IERC721',
    'IERC1155',
    'IERC2981',
    'IERC165',
    'IERC4626',
    'IERC777',
    'IERC1155MetadataURI',
    'IERC721Metadata',
    'IERC721Enumerable',
    'Ownable',
    'Pausable',
    'AccessControl',
    'ReentrancyGuard',
  ];

  // Regex patterns to detect interfaces
  const interfaceRegex = new RegExp(`(${knownInterfaces.join('|')})`, 'gi');
  const inheritanceRegex = /contract\s+\w+\s+is\s+([^{]+)/g;
  const importRegex = /import\s+.*["']([^"']*\/)?(I[A-Z]\w+)["']/g;

  for (const contract of contracts) {
    const fullPath = path.join(context.projectPath, contract.path);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');

      // Check inheritance
      let match;
      while ((match = inheritanceRegex.exec(content)) !== null) {
        const parents = match[1].split(',').map((p) => p.trim().split('(')[0].trim());
        parents.forEach((parent) => {
          if (knownInterfaces.includes(parent)) {
            detectedInterfaces.add(parent);
          }
        });
      }

      // Check imports for interface names
      while ((match = importRegex.exec(content)) !== null) {
        const interfaceName = match[2];
        if (knownInterfaces.includes(interfaceName)) {
          detectedInterfaces.add(interfaceName);
        }
      }

      // Direct pattern matching
      const matches = content.match(interfaceRegex);
      if (matches) {
        matches.forEach((m) => detectedInterfaces.add(m));
      }
    } catch {
      // Skip files that can't be read
    }
  }

  await context.onProgress?.(100, `Found ${detectedInterfaces.size} interfaces`);

  return {
    success: true,
    findings: [],
    data: {
      detectedInterfacesSimple: Array.from(detectedInterfaces),
    },
  };
};

// ============================================================================
// Simple Function Signature Extraction (Regex-based, no compilation)
// ============================================================================

const extractFunctionSignaturesRegex: DeterministicExecutor = async (step, config, context) => {
  const contracts = context.data.contractFiles || context.data.mainContracts || [];

  await context.onProgress?.(10, 'Extracting function signatures (regex)...');

  const signatures: Record<string, Array<{
    name: string;
    visibility: string;
    stateMutability: string;
  }>> = {};

  // Simplified function regex (less precise than AST but works without compilation)
  const funcRegex = /function\s+(\w+)\s*\([^)]*\)\s*(public|external|internal|private)?\s*(view|pure|payable)?/g;

  for (const contract of contracts) {
    const fullPath = path.join(context.projectPath, contract.path);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const contractFuncs: typeof signatures[string] = [];
      let match;

      while ((match = funcRegex.exec(content)) !== null) {
        contractFuncs.push({
          name: match[1],
          visibility: match[2] || 'public',
          stateMutability: match[3] || '',
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
      functionSignaturesRegex: signatures,
    },
  };
};

// ============================================================================
// User Flow Analysis
// ============================================================================

const analyzeUserFlows: DeterministicExecutor = async (step, config, context) => {
  const projectPath = context.projectPath;
  const findings: StepFinding[] = [];

  await context.onProgress?.(10, 'Analyzing user interaction flows...');

  try {
    // Import the user flow analyzer
    const { analyzeUserFlows: analyzeFlows, summarizeFlowAnalysis } = await import('../../../services/userFlowAnalyzer.js');

    await context.onProgress?.(30, 'Parsing Solidity contracts...');

    // Analyze user flows
    const analysis = await analyzeFlows(projectPath);

    await context.onProgress?.(70, 'Tracing execution paths...');

    // Generate summary
    const summary = summarizeFlowAnalysis(analysis);

    await context.onProgress?.(90, 'Identifying risks...');

    // Create findings for high-risk flows
    for (const flow of analysis.flows) {
      if (flow.risks.length > 0) {
        findings.push({
          stepId: step.id,
          findingId: `flow-${flow.id}-risk`,
          title: `High-risk user flow: ${flow.name}`,
          description: `${flow.description}\n\nRisks:\n${flow.risks.map(r => `- ${r}`).join('\n')}`,
          severity: 'medium',
          location: {
            file: 'contract',
            line: undefined,
            column: undefined,
          },
          recommendation: 'Review this user interaction flow for potential security issues.',
        });
      }
    }

    await context.onProgress?.(100, 'User flow analysis complete');

    log.info('User flow analysis complete', {
      flows: analysis.flows.length,
      entryPoints: analysis.entryPoints.length,
      privilegedPaths: analysis.privilegedPaths.size,
      findings: findings.length,
    });

    return {
      success: true,
      findings,
      data: {
        flowCount: analysis.flows.length,
        entryPointCount: analysis.entryPoints.length,
        privilegedPathCount: analysis.privilegedPaths.size,
        flows: analysis.flows,
        entryPoints: analysis.entryPoints,
        privilegedPaths: Object.fromEntries(analysis.privilegedPaths),
        summary,
      },
    };
  } catch (error: any) {
    log.error('User flow analysis failed', { error: error.message });
    return {
      success: false,
      error: `User flow analysis failed: ${error.message}`,
      findings: [],
    };
  }
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
  'parseCoverageResults': parseCoverageResults,
  'perform10thManAnalysis': perform10thManAnalysis,
  'mergeToolFindings': mergeToolFindings,
  'deduplicateFindings': deduplicateFindings,
  'calculateSeverity': calculateSeverity,
  'calculateScore': calculateScore,
  'generateReport': generateReport,
  // New step executors for three-tier depths
  'classifyContractType': classifyContractType,
  'detectInterfacesSimple': detectInterfacesSimple,
  'extractFunctionSignaturesRegex': extractFunctionSignaturesRegex,
  // User flow analysis
  'analyzeUserFlows': analyzeUserFlows,
  'generateUserFlowDiagrams': async (step, config, context) => {
    const srcDir = context.data.srcDir;

    if (!srcDir) {
      return {
        success: false,
        output: { error: 'srcDir not available' },
        findings: [],
      };
    }

    await context.onProgress?.(10, 'Analyzing user flows...');

    try {
      const { analyzeUserFlowsWithDiagrams } = await import('../../../services/userFlowAnalyzer.js');

      const { analysis, diagrams } = await analyzeUserFlowsWithDiagrams(srcDir);

      await context.onProgress?.(90, `Generated ${diagrams.length} flow diagrams`);

      return {
        success: true,
        data: {
          userFlows: analysis.flows,
          userFlowDiagrams: diagrams,
        },
        findings: [],
      };
    } catch (error: any) {
      return {
        success: false,
        output: { error: error.message },
        findings: [],
      };
    }
  },
  // Testing - import from testing module
  'generate-tests': async (step, config, context) => {
    const { executeTestingStep } = await import('../testing/index.js');
    return executeTestingStep(step, config, context);
  },
  'execute-tests': async (step, config, context) => {
    const generatedTests = context.data.generatedTests || [];
    const testsPath = context.data.testsPath;

    if (!generatedTests.length || !testsPath) {
      return {
        success: true,
        output: { message: 'No tests to execute' },
        findings: [],
      };
    }

    await context.onProgress?.(10, `Executing ${generatedTests.length} tests...`);

    try {
      const testResults: any[] = [];
      const framework = generatedTests[0].framework;

      if (framework === 'foundry') {
        const { runFoundryTest } = await import('../../../tools/foundryWrapper.js');
        const path = await import('path');

        for (let i = 0; i < generatedTests.length; i++) {
          const test = generatedTests[i];
          const progress = 10 + (i / generatedTests.length) * 80;
          await context.onProgress?.(progress, `Running test ${i + 1}/${generatedTests.length}...`);

          try {
            const testFilePath = path.join(testsPath, test.testFileName);
            const result = await runFoundryTest({
              projectPath: context.projectPath,
              args: ['--match-path', testFilePath, '-vv'],
              timeout: 120000,
            });

            testResults.push({
              findingId: test.findingId,
              testFileName: test.testFileName,
              success: result.success,
              output: result.stdout || '',
              error: result.error,
              vulnerabilityConfirmed: !result.success, // Test FAIL = vuln exists
            });
          } catch (error: any) {
            testResults.push({
              findingId: test.findingId,
              testFileName: test.testFileName,
              success: false,
              error: error.message,
              vulnerabilityConfirmed: true,
            });
          }
        }
      }

      const summary = {
        total: testResults.length,
        passed: testResults.filter(r => r.success).length,
        failed: testResults.filter(r => !r.success).length,
      };

      return {
        success: true,
        output: { summary },
        data: {
          testResults,
          testExecutionSummary: summary,
        },
        findings: [],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        findings: [],
      };
    }
  },
  'bindTestResultsToFindings': async (step, config, context) => {
    const findings = context.data.deduplicatedFindings || [];
    const testResults = context.data.testResults || [];

    if (!testResults.length) {
      return {
        success: true,
        data: { enrichedFindings: findings },
        findings: [],
      };
    }

    await context.onProgress?.(50, 'Binding test results to findings...');

    const testResultMap = new Map();
    for (const result of testResults) {
      testResultMap.set(result.findingId, result);
    }

    const enrichedFindings = findings.map((finding: any) => {
      const testResult = testResultMap.get(finding.id || finding.findingId);
      if (!testResult) return finding;

      return {
        ...finding,
        testProof: {
          testExecuted: true,
          testPassed: testResult.success,
          testFileName: testResult.testFileName,
          testOutput: testResult.output,
          vulnerabilityConfirmed: testResult.vulnerabilityConfirmed,
        },
        // Adjust confidence based on test results
        confidence: testResult.vulnerabilityConfirmed ? 1.0 : (finding.confidence || 0.7) * 0.5,
      };
    });

    return {
      success: true,
      data: { enrichedFindings },
      findings: [],
    };
  },
  'publish-to-github': async (step, config, context) => {
    const { executeTestingStep } = await import('../testing/index.js');
    return executeTestingStep(step, config, context);
  },
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
