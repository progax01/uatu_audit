/**
 * SOP Definition Loader and Registry
 *
 * Loads and manages SOP definitions from JSON files
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import type {
  SOPDefinition,
  Framework,
  AuditDepth,
  StepDefinition,
} from './types';

// Re-export all types
export * from './types';

// Cache loaded SOPs
const sopCache: Map<string, SOPDefinition> = new Map();

// SOP file mapping
const SOP_FILES: Partial<Record<Framework, string>> = {
  foundry: 'solidity-foundry.sop.json',
  hardhat: 'solidity-hardhat.sop.json',
  truffle: 'solidity-truffle.sop.json',
  brownie: 'solidity-brownie.sop.json',
  anchor: 'anchor-solana.sop.json',
  'solana-native': 'solana-native.sop.json',
  'aptos-move': 'move-aptos.sop.json',
  'sui-move': 'move-sui.sop.json',
  move: 'move-generic.sop.json',
  ink: 'ink-substrate.sop.json',
  cargo: 'rust-generic.sop.json',
  // Backend/Frontend SOPs
  nodejs: 'backend-nodejs.sop.json',
  express: 'backend-nodejs.sop.json',
  fastify: 'backend-nodejs.sop.json',
  nestjs: 'backend-nodejs.sop.json',
  react: 'frontend-react.sop.json',
  'cargo-backend': 'rust-backend.sop.json',
  python: 'backend-python.sop.json',
  flask: 'backend-python.sop.json',
  django: 'backend-python.sop.json',
  generic: 'base-solidity.sop.json',
  unknown: 'base-solidity.sop.json',
};

// Fallback chain for missing SOPs
const FALLBACK_CHAIN: Partial<Record<Framework, Framework>> = {
  foundry: 'generic',
  hardhat: 'generic',
  truffle: 'generic',
  brownie: 'generic',
  anchor: 'generic',
  'solana-native': 'anchor',
  'aptos-move': 'generic',
  'sui-move': 'generic',
  move: 'generic',
  ink: 'generic',
  cargo: 'generic',
  generic: 'generic',
  unknown: 'generic',
};

/**
 * Get the directory containing SOP definition files
 */
function getSOPDirectory(): string {
  return path.join(__dirname);
}

/**
 * Load a single SOP definition from file
 */
export async function loadSOP(sopId: string): Promise<SOPDefinition | null> {
  // Check cache first
  if (sopCache.has(sopId)) {
    return sopCache.get(sopId)!;
  }

  const sopDir = getSOPDirectory();
  const fileName = `${sopId}.sop.json`;
  const filePath = path.join(sopDir, fileName);

  try {
    if (await fs.pathExists(filePath)) {
      const sop = await fs.readJson(filePath);
      sopCache.set(sopId, sop);
      return sop;
    }
  } catch (error) {
    console.error(`Failed to load SOP ${sopId}:`, error);
  }

  return null;
}

/**
 * Load SOP for a specific framework
 */
export async function loadSOPForFramework(
  framework: Framework
): Promise<SOPDefinition> {
  const fileName = SOP_FILES[framework];

  if (!fileName) {
    // Use fallback
    return loadSOPForFramework(FALLBACK_CHAIN[framework] || 'generic');
  }

  const sopId = fileName.replace('.sop.json', '');
  const sop = await loadSOP(sopId);

  if (sop) {
    return sop;
  }

  // Try fallback
  const fallback = FALLBACK_CHAIN[framework];
  if (fallback && fallback !== framework) {
    console.warn(`SOP for ${framework} not found, using fallback: ${fallback}`);
    return loadSOPForFramework(fallback);
  }

  throw new Error(`No SOP found for framework: ${framework}`);
}

/**
 * Load all available SOPs
 */
export async function loadAllSOPs(): Promise<SOPDefinition[]> {
  const sopDir = getSOPDirectory();
  const files = await fs.readdir(sopDir);
  const sopFiles = files.filter((f) => f.endsWith('.sop.json'));

  const sops: SOPDefinition[] = [];

  for (const file of sopFiles) {
    try {
      const sop = await fs.readJson(path.join(sopDir, file));
      sops.push(sop);
      sopCache.set(sop.id, sop);
    } catch (error) {
      console.error(`Failed to load SOP from ${file}:`, error);
    }
  }

  return sops;
}

/**
 * Get enabled steps for a specific depth
 */
export function getEnabledSteps(
  sop: SOPDefinition,
  depth: AuditDepth
): StepDefinition[] {
  const depthConfig = sop.depths[depth];

  if (!depthConfig) {
    throw new Error(`Invalid depth: ${depth}`);
  }

  const { enabledSteps } = depthConfig;

  // "*" means all steps
  if (enabledSteps.length === 1 && enabledSteps[0] === '*') {
    return sop.steps;
  }

  // Filter to enabled steps
  return sop.steps.filter((step) => enabledSteps.includes(step.id));
}

/**
 * Build execution order based on dependencies
 */
export function buildExecutionOrder(
  steps: StepDefinition[]
): StepDefinition[][] {
  const layers: StepDefinition[][] = [];
  const remaining = new Set(steps.map((s) => s.id));
  const completed = new Set<string>();

  while (remaining.size > 0) {
    const layer: StepDefinition[] = [];

    for (const step of steps) {
      if (!remaining.has(step.id)) continue;

      // Check if all dependencies are satisfied
      const depsOk = step.dependsOn.every(
        (dep) => completed.has(dep) || !remaining.has(dep)
      );

      if (depsOk) {
        layer.push(step);
      }
    }

    if (layer.length === 0 && remaining.size > 0) {
      // Circular dependency - add remaining steps as final layer
      console.warn('Circular dependency detected, adding remaining steps');
      const remainingSteps = steps.filter((s) => remaining.has(s.id));
      layers.push(remainingSteps);
      break;
    }

    for (const step of layer) {
      remaining.delete(step.id);
      completed.add(step.id);
    }

    layers.push(layer);
  }

  return layers;
}

/**
 * Calculate total progress weight for steps
 */
export function calculateTotalWeight(steps: StepDefinition[]): number {
  return steps.reduce((sum, step) => sum + step.progressWeight, 0);
}

/**
 * Estimate total duration for steps (in seconds)
 */
export function estimateTotalDuration(steps: StepDefinition[]): number {
  return steps.reduce((sum, step) => sum + step.estimatedDurationSeconds, 0);
}

/**
 * Get step by ID
 */
export function getStepById(
  sop: SOPDefinition,
  stepId: string
): StepDefinition | undefined {
  return sop.steps.find((s) => s.id === stepId);
}

/**
 * Validate SOP definition
 */
export function validateSOP(sop: SOPDefinition): string[] {
  const errors: string[] = [];

  // Check required fields
  if (!sop.id) errors.push('Missing SOP id');
  if (!sop.version) errors.push('Missing SOP version');
  if (!sop.steps || sop.steps.length === 0) errors.push('No steps defined');

  // Check step dependencies exist
  const stepIds = new Set(sop.steps.map((s) => s.id));
  for (const step of sop.steps) {
    for (const dep of step.dependsOn) {
      if (!stepIds.has(dep)) {
        errors.push(`Step ${step.id} depends on non-existent step: ${dep}`);
      }
    }
  }

  // Check enabled steps in depth configs exist
  for (const [depth, config] of Object.entries(sop.depths)) {
    if (config.enabledSteps[0] !== '*') {
      for (const stepId of config.enabledSteps) {
        if (!stepIds.has(stepId)) {
          errors.push(`Depth ${depth} references non-existent step: ${stepId}`);
        }
      }
    }
  }

  return errors;
}

/**
 * Clear the SOP cache (useful for testing)
 */
export function clearSOPCache(): void {
  sopCache.clear();
}

/**
 * Get all available SOPs (synchronous from cache)
 * Must call loadAllSOPs() first to populate cache
 */
export function getAllAvailableSOPs(): SOPDefinition[] {
  return Array.from(sopCache.values());
}

/**
 * Get names of all available tools
 */
export function getAvailableToolNames(): string[] {
  // Collect all tools from cached SOPs
  const tools = new Set<string>();

  for (const sop of sopCache.values()) {
    for (const tool of sop.requiredTools) {
      tools.add(tool.name);
    }
    for (const tool of sop.optionalTools) {
      tools.add(tool.name);
    }
  }

  return Array.from(tools);
}
