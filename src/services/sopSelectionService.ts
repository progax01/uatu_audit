/**
 * SOP Selection Service
 *
 * Automatically selects the appropriate SOP based on detected framework,
 * language, and audit configuration.
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import type { SOPDefinition, Framework, Language, AuditDepth } from '../sops/definitions/types';
import { loadSOPForFramework, loadSOP, getAllAvailableSOPs } from '../sops/definitions';
import { logger } from '../utils/logger';

const log = logger.child({ module: 'sop-selection' });

// ============================================================================
// Types
// ============================================================================

export interface EcosystemDetectionResult {
  framework: Framework;
  language: Language;
  confidence: number;
  indicators: string[];
  suggestedSOP: string;
}

export interface SOPSelectionCriteria {
  projectPath: string;
  preferredDepth?: AuditDepth;
  forceFramework?: Framework;
  forceSOP?: string;
}

export interface SOPSelectionResult {
  sop: SOPDefinition;
  detection: EcosystemDetectionResult;
  availableDepths: AuditDepth[];
  recommendedDepth: AuditDepth;
}

// ============================================================================
// Framework Detection
// ============================================================================

/**
 * Detect the blockchain ecosystem and framework for a project
 */
export async function detectEcosystem(projectPath: string): Promise<EcosystemDetectionResult> {
  log.debug('Detecting ecosystem', { projectPath });

  const indicators: string[] = [];
  let confidence = 0;

  // Check for framework config files
  const configChecks = await Promise.all([
    checkFileExists(projectPath, 'foundry.toml'),
    checkFileExists(projectPath, 'hardhat.config.js'),
    checkFileExists(projectPath, 'hardhat.config.ts'),
    checkFileExists(projectPath, 'truffle-config.js'),
    checkFileExists(projectPath, 'brownie-config.yaml'),
    checkFileExists(projectPath, 'Anchor.toml'),
    checkFileExists(projectPath, 'Move.toml'),
    checkFileExists(projectPath, 'Aptos.toml'),
    checkFileExists(projectPath, 'sui.config'),
    checkFileExists(projectPath, 'Cargo.toml'),
    checkFileExists(projectPath, 'package.json'),
    checkFileExists(projectPath, 'requirements.txt'),
    checkFileExists(projectPath, 'pyproject.toml'),
  ]);

  const [
    hasFoundry,
    hasHardhatJs,
    hasHardhatTs,
    hasTruffle,
    hasBrownie,
    hasAnchor,
    hasMove,
    hasAptos,
    hasSui,
    hasCargo,
    hasPackageJson,
    hasRequirementsTxt,
    hasPyProject,
  ] = configChecks;

  // Determine framework and language
  let framework: Framework = 'unknown';
  let language: Language = 'unknown';
  let suggestedSOP = 'base-solidity';

  // Solidity frameworks
  if (hasFoundry) {
    framework = 'foundry';
    language = 'solidity';
    suggestedSOP = 'solidity-foundry';
    confidence = 0.95;
    indicators.push('foundry.toml found');
  } else if (hasHardhatJs || hasHardhatTs) {
    framework = 'hardhat';
    language = 'solidity';
    suggestedSOP = 'solidity-hardhat';
    confidence = 0.95;
    indicators.push('hardhat.config.{js,ts} found');
  } else if (hasTruffle) {
    framework = 'truffle';
    language = 'solidity';
    suggestedSOP = 'solidity-truffle';
    confidence = 0.9;
    indicators.push('truffle-config.js found');
  } else if (hasBrownie) {
    framework = 'brownie';
    language = 'solidity';
    suggestedSOP = 'solidity-brownie';
    confidence = 0.9;
    indicators.push('brownie-config.yaml found');
  }
  // Solana/Rust frameworks
  else if (hasAnchor) {
    framework = 'anchor';
    language = 'rust';
    suggestedSOP = 'anchor-solana';
    confidence = 0.95;
    indicators.push('Anchor.toml found');
  }
  // Move frameworks
  else if (hasAptos || (hasMove && await checkMoveForAptos(projectPath))) {
    framework = 'aptos-move';
    language = 'move';
    suggestedSOP = 'move-aptos';
    confidence = 0.9;
    indicators.push('Move.toml found (Aptos)');
  } else if (hasSui || (hasMove && await checkMoveForSui(projectPath))) {
    framework = 'sui-move';
    language = 'move';
    suggestedSOP = 'move-sui';
    confidence = 0.9;
    indicators.push('Move.toml found (Sui)');
  } else if (hasMove) {
    framework = 'move';
    language = 'move';
    suggestedSOP = 'move-generic';
    confidence = 0.8;
    indicators.push('Move.toml found');
  }
  // Plain Cargo (could be Solana without Anchor or backend service)
  else if (hasCargo) {
    const cargoResult = await analyzeCargoProject(projectPath);
    framework = cargoResult.framework;
    language = 'rust';
    suggestedSOP = cargoResult.suggestedSOP;
    confidence = cargoResult.confidence;
    indicators.push(...cargoResult.indicators);
  }
  // Node.js backend
  else if (hasPackageJson) {
    const nodeResult = await analyzeNodeJSProject(projectPath);
    framework = nodeResult.framework;
    language = nodeResult.language;
    suggestedSOP = nodeResult.suggestedSOP;
    confidence = nodeResult.confidence;
    indicators.push(...nodeResult.indicators);
  }
  // Python backend
  else if (hasRequirementsTxt || hasPyProject) {
    const pythonResult = await analyzePythonProject(projectPath);
    framework = pythonResult.framework;
    language = 'python';
    suggestedSOP = pythonResult.suggestedSOP;
    confidence = pythonResult.confidence;
    indicators.push(...pythonResult.indicators);
  }

  // If no config found, check for source files
  if (framework === 'unknown') {
    const sourceResult = await detectFromSourceFiles(projectPath);
    framework = sourceResult.framework;
    language = sourceResult.language;
    suggestedSOP = sourceResult.suggestedSOP;
    confidence = sourceResult.confidence;
    indicators.push(...sourceResult.indicators);
  }

  log.info('Ecosystem detected', {
    projectPath,
    framework,
    language,
    confidence,
    indicators,
  });

  return {
    framework,
    language,
    confidence,
    indicators,
    suggestedSOP,
  };
}

// ============================================================================
// SOP Selection
// ============================================================================

/**
 * Select the appropriate SOP for a project
 */
export async function selectSOP(criteria: SOPSelectionCriteria): Promise<SOPSelectionResult> {
  log.debug('Selecting SOP', { criteria });

  // If forced SOP specified, load it directly
  if (criteria.forceSOP) {
    const sop = await loadSOP(criteria.forceSOP);
    if (!sop) {
      throw new Error(`Forced SOP not found: ${criteria.forceSOP}`);
    }
    return {
      sop,
      detection: {
        framework: sop.framework,
        language: sop.language,
        confidence: 1,
        indicators: ['Forced SOP selection'],
        suggestedSOP: criteria.forceSOP,
      },
      availableDepths: ['quick', 'standard', 'deep'],
      recommendedDepth: criteria.preferredDepth || 'standard',
    };
  }

  // Detect ecosystem
  const detection = criteria.forceFramework
    ? await getDetectionForFramework(criteria.forceFramework)
    : await detectEcosystem(criteria.projectPath);

  // Load the appropriate SOP
  let sop: SOPDefinition;
  try {
    sop = await loadSOPForFramework(detection.framework);
  } catch (error) {
    log.warn('Failed to load specific SOP, falling back to base', {
      framework: detection.framework,
      error,
    });
    const fallbackSop = await loadSOP('base-solidity');
    if (!fallbackSop) {
      throw new Error('Failed to load fallback SOP');
    }
    sop = fallbackSop;
  }

  // Determine available depths
  const availableDepths: AuditDepth[] = ['quick', 'standard', 'deep'].filter(
    (depth) => sop.depths[depth as AuditDepth]
  ) as AuditDepth[];

  // Recommend depth based on project size
  const recommendedDepth = await recommendDepth(
    criteria.projectPath,
    detection,
    criteria.preferredDepth
  );

  log.info('SOP selected', {
    sopId: sop.id,
    framework: detection.framework,
    recommendedDepth,
  });

  return {
    sop,
    detection,
    availableDepths,
    recommendedDepth,
  };
}

// ============================================================================
// Helpers
// ============================================================================

async function checkFileExists(projectPath: string, filename: string): Promise<boolean> {
  return fs.pathExists(path.join(projectPath, filename));
}

async function checkMoveForAptos(projectPath: string): Promise<boolean> {
  const moveToml = path.join(projectPath, 'Move.toml');
  try {
    const content = await fs.readFile(moveToml, 'utf-8');
    return content.includes('AptosFramework') || content.includes('aptos_framework');
  } catch {
    return false;
  }
}

async function checkMoveForSui(projectPath: string): Promise<boolean> {
  const moveToml = path.join(projectPath, 'Move.toml');
  try {
    const content = await fs.readFile(moveToml, 'utf-8');
    return content.includes('Sui') || content.includes('sui_framework');
  } catch {
    return false;
  }
}

async function analyzeCargoProject(projectPath: string): Promise<{
  framework: Framework;
  suggestedSOP: string;
  confidence: number;
  indicators: string[];
}> {
  const cargoToml = path.join(projectPath, 'Cargo.toml');
  const indicators: string[] = ['Cargo.toml found'];

  try {
    const content = await fs.readFile(cargoToml, 'utf-8');

    // Check for Solana/Anchor dependencies
    if (content.includes('anchor-lang') || content.includes('anchor_lang')) {
      return {
        framework: 'anchor',
        suggestedSOP: 'anchor-solana',
        confidence: 0.9,
        indicators: [...indicators, 'anchor-lang dependency found'],
      };
    }

    if (content.includes('solana-program') || content.includes('solana_program')) {
      return {
        framework: 'solana-native',
        suggestedSOP: 'solana-native',
        confidence: 0.85,
        indicators: [...indicators, 'solana-program dependency found'],
      };
    }

    // Check for ink! (Substrate)
    if (content.includes('ink_lang') || content.includes('ink!')) {
      return {
        framework: 'ink',
        suggestedSOP: 'ink-substrate',
        confidence: 0.85,
        indicators: [...indicators, 'ink! dependency found'],
      };
    }
  } catch {
    // Ignore read errors
  }

  return {
    framework: 'cargo',
    suggestedSOP: 'rust-generic',
    confidence: 0.5,
    indicators,
  };
}

async function detectFromSourceFiles(projectPath: string): Promise<{
  framework: Framework;
  language: Language;
  suggestedSOP: string;
  confidence: number;
  indicators: string[];
}> {
  const indicators: string[] = [];

  // Check for .sol files
  const hasSolidity = await hasFilesWithExtension(projectPath, ['.sol']);
  if (hasSolidity) {
    indicators.push('.sol files found');

    // Check if it looks like Foundry by directory structure
    const hasLib = await fs.pathExists(path.join(projectPath, 'lib'));
    const hasSrc = await fs.pathExists(path.join(projectPath, 'src'));

    if (hasLib && hasSrc) {
      return {
        framework: 'foundry',
        language: 'solidity',
        suggestedSOP: 'solidity-foundry',
        confidence: 0.7,
        indicators: [...indicators, 'Foundry-like structure (lib/, src/)'],
      };
    }

    // Check for Hardhat structure
    const hasContracts = await fs.pathExists(path.join(projectPath, 'contracts'));
    const hasScripts = await fs.pathExists(path.join(projectPath, 'scripts'));

    if (hasContracts && hasScripts) {
      return {
        framework: 'hardhat',
        language: 'solidity',
        suggestedSOP: 'solidity-hardhat',
        confidence: 0.6,
        indicators: [...indicators, 'Hardhat-like structure (contracts/, scripts/)'],
      };
    }

    return {
      framework: 'unknown',
      language: 'solidity',
      suggestedSOP: 'base-solidity',
      confidence: 0.5,
      indicators,
    };
  }

  // Check for .rs files
  const hasRust = await hasFilesWithExtension(projectPath, ['.rs']);
  if (hasRust) {
    return {
      framework: 'cargo',
      language: 'rust',
      suggestedSOP: 'rust-generic',
      confidence: 0.4,
      indicators: ['.rs files found'],
    };
  }

  // Check for .move files
  const hasMove = await hasFilesWithExtension(projectPath, ['.move']);
  if (hasMove) {
    return {
      framework: 'move',
      language: 'move',
      suggestedSOP: 'move-generic',
      confidence: 0.4,
      indicators: ['.move files found'],
    };
  }

  return {
    framework: 'unknown',
    language: 'unknown',
    suggestedSOP: 'base-solidity',
    confidence: 0.1,
    indicators: ['No recognized source files found'],
  };
}

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
      } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const found = await hasFilesWithExtension(path.join(dir, entry.name), extensions);
        if (found) return true;
      }
    }
  } catch {
    // Ignore errors
  }

  return false;
}

/**
 * Analyze Node.js project to determine specific framework
 */
async function analyzeNodeJSProject(projectPath: string): Promise<{
  framework: Framework;
  language: Language;
  suggestedSOP: string;
  confidence: number;
  indicators: string[];
}> {
  const packageJsonPath = path.join(projectPath, 'package.json');
  const indicators: string[] = ['package.json found'];

  try {
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Check for TypeScript
    const isTypeScript = !!dependencies.typescript;
    const language: Language = isTypeScript ? 'typescript' : 'javascript';

    // Check for specific frameworks
    if (dependencies.express) {
      return {
        framework: 'express',
        language,
        suggestedSOP: 'backend-nodejs',
        confidence: 0.95,
        indicators: [...indicators, 'Express framework detected']
      };
    }

    if (dependencies.fastify) {
      return {
        framework: 'fastify',
        language,
        suggestedSOP: 'backend-nodejs',
        confidence: 0.95,
        indicators: [...indicators, 'Fastify framework detected']
      };
    }

    if (dependencies['@nestjs/core']) {
      return {
        framework: 'nestjs',
        language,
        suggestedSOP: 'backend-nodejs',
        confidence: 0.95,
        indicators: [...indicators, 'NestJS framework detected']
      };
    }

    // Check for React (frontend)
    if (dependencies.react) {
      return {
        framework: 'react',
        language,
        suggestedSOP: 'frontend-react',
        confidence: 0.95,
        indicators: [...indicators, 'React framework detected']
      };
    }

    // Generic Node.js
    return {
      framework: 'nodejs',
      language,
      suggestedSOP: 'backend-nodejs',
      confidence: 0.7,
      indicators
    };
  } catch {
    return {
      framework: 'nodejs',
      language: 'javascript',
      suggestedSOP: 'backend-nodejs',
      confidence: 0.5,
      indicators
    };
  }
}

/**
 * Analyze Python project to determine specific framework
 */
async function analyzePythonProject(projectPath: string): Promise<{
  framework: Framework;
  language: Language;
  suggestedSOP: string;
  confidence: number;
  indicators: string[];
}> {
  const indicators: string[] = [];

  // Check for requirements.txt
  const requirementsPath = path.join(projectPath, 'requirements.txt');
  if (await fs.pathExists(requirementsPath)) {
    try {
      const content = await fs.readFile(requirementsPath, 'utf-8');
      indicators.push('requirements.txt found');

      if (content.includes('Flask')) {
        return {
          framework: 'flask',
          language: 'python',
          suggestedSOP: 'backend-python',
          confidence: 0.95,
          indicators: [...indicators, 'Flask framework detected']
        };
      }

      if (content.includes('Django')) {
        return {
          framework: 'django',
          language: 'python',
          suggestedSOP: 'backend-python',
          confidence: 0.95,
          indicators: [...indicators, 'Django framework detected']
        };
      }
    } catch {
      // Continue
    }
  }

  // Check for pyproject.toml
  const pyprojectPath = path.join(projectPath, 'pyproject.toml');
  if (await fs.pathExists(pyprojectPath)) {
    indicators.push('pyproject.toml found');
  }

  return {
    framework: 'python',
    language: 'python',
    suggestedSOP: 'backend-python',
    confidence: 0.7,
    indicators
  };
}

async function getDetectionForFramework(framework: Framework): Promise<EcosystemDetectionResult> {
  const frameworkMap: Record<Framework, { language: Language; suggestedSOP: string }> = {
    'foundry': { language: 'solidity', suggestedSOP: 'solidity-foundry' },
    'hardhat': { language: 'solidity', suggestedSOP: 'solidity-hardhat' },
    'truffle': { language: 'solidity', suggestedSOP: 'solidity-truffle' },
    'brownie': { language: 'solidity', suggestedSOP: 'solidity-brownie' },
    'anchor': { language: 'rust', suggestedSOP: 'anchor-solana' },
    'solana-native': { language: 'rust', suggestedSOP: 'solana-native' },
    'aptos-move': { language: 'move', suggestedSOP: 'move-aptos' },
    'sui-move': { language: 'move', suggestedSOP: 'move-sui' },
    'move': { language: 'move', suggestedSOP: 'move-generic' },
    'ink': { language: 'rust', suggestedSOP: 'ink-substrate' },
    'cargo': { language: 'rust', suggestedSOP: 'rust-generic' },
    'cargo-backend': { language: 'rust', suggestedSOP: 'rust-backend' },
    'nodejs': { language: 'typescript', suggestedSOP: 'backend-nodejs' },
    'express': { language: 'typescript', suggestedSOP: 'backend-nodejs' },
    'fastify': { language: 'typescript', suggestedSOP: 'backend-nodejs' },
    'nestjs': { language: 'typescript', suggestedSOP: 'backend-nodejs' },
    'react': { language: 'typescript', suggestedSOP: 'frontend-react' },
    'python': { language: 'python', suggestedSOP: 'backend-python' },
    'flask': { language: 'python', suggestedSOP: 'backend-python' },
    'django': { language: 'python', suggestedSOP: 'backend-python' },
    'generic': { language: 'solidity', suggestedSOP: 'base-solidity' },
    'unknown': { language: 'unknown', suggestedSOP: 'base-solidity' },
  };

  const config = frameworkMap[framework];

  return {
    framework,
    language: config.language,
    confidence: 1,
    indicators: ['Forced framework selection'],
    suggestedSOP: config.suggestedSOP,
  };
}

async function recommendDepth(
  projectPath: string,
  detection: EcosystemDetectionResult,
  preferred?: AuditDepth
): Promise<AuditDepth> {
  // If user specified a preference, use it
  if (preferred) {
    return preferred;
  }

  // Estimate project size
  let fileCount = 0;
  let totalSize = 0;

  try {
    const extensions = detection.language === 'solidity' ? ['.sol'] :
                       detection.language === 'rust' ? ['.rs'] :
                       detection.language === 'move' ? ['.move'] : ['.sol'];

    await countFiles(projectPath, extensions, (size) => {
      fileCount++;
      totalSize += size;
    });
  } catch {
    // Default to standard if can't estimate
    return 'standard';
  }

  // Small projects: quick
  if (fileCount <= 5 || totalSize < 50000) {
    return 'quick';
  }

  // Large projects: deep
  if (fileCount > 20 || totalSize > 500000) {
    return 'deep';
  }

  // Medium projects: standard
  return 'standard';
}

async function countFiles(
  dir: string,
  extensions: string[],
  onFile: (size: number) => void
): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'lib') {
        await countFiles(fullPath, extensions, onFile);
      } else if (entry.isFile()) {
        for (const ext of extensions) {
          if (entry.name.endsWith(ext)) {
            const stats = await fs.stat(fullPath);
            onFile(stats.size);
            break;
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }
}
