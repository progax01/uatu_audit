/**
 * SOP Module Registry
 *
 * Central registry for all specialized audit modules.
 * Handles module discovery, activation, and SOP merging.
 */

import type { SOPModule, ModuleRegistry } from './types.js';
import type { SOPDefinition, StepDefinition } from '../definitions/types.js';
import { logger } from '../../utils/logger.js';
import { defiVaultModule } from './defi-vault.module.js';
import { tokenSecurityModule } from './token-security.module.js';

const log = logger.child({ service: 'module-registry' });

// ============================================================================
// REGISTRY IMPLEMENTATION
// ============================================================================

class SOPModuleRegistry implements ModuleRegistry {
  public modules: SOPModule[] = [];

  constructor() {
    // Register built-in modules
    this.register(defiVaultModule);
    this.register(tokenSecurityModule);

    log.info('Module registry initialized', {
      modulesCount: this.modules.length,
      modules: this.modules.map(m => m.id),
    });
  }

  /**
   * Register a new module
   */
  register(module: SOPModule): void {
    // Check for duplicate IDs
    if (this.modules.some(m => m.id === module.id)) {
      log.warn('Module already registered, skipping', { moduleId: module.id });
      return;
    }

    this.modules.push(module);
    log.info('Module registered', {
      id: module.id,
      name: module.name,
      priority: module.priority,
      stepsCount: module.additionalSteps.length,
    });
  }

  /**
   * Get all applicable modules for current context
   */
  getApplicableModules(context: any): SOPModule[] {
    const applicable: SOPModule[] = [];

    for (const module of this.modules) {
      try {
        if (module.applicableWhen(context)) {
          applicable.push(module);
          log.info('Module activated', {
            id: module.id,
            name: module.name,
            reason: this.getActivationReason(module, context),
          });
        }
      } catch (error: any) {
        log.error('Error checking module applicability', {
          moduleId: module.id,
          error: error.message,
        });
      }
    }

    // Sort by priority (higher priority first)
    applicable.sort((a, b) => b.priority - a.priority);

    log.info('Applicable modules determined', {
      count: applicable.length,
      modules: applicable.map(m => ({ id: m.id, priority: m.priority })),
    });

    return applicable;
  }

  /**
   * Merge module steps into base SOP
   */
  mergeSOP(baseSOP: SOPDefinition, modules: SOPModule[]): SOPDefinition {
    if (modules.length === 0) {
      log.info('No modules to merge, using base SOP');
      return baseSOP;
    }

    log.info('Merging SOP with modules', {
      baseSOP: baseSOP.id,
      baseStepsCount: baseSOP.steps.length,
      modulesCount: modules.length,
    });

    const mergedSteps: StepDefinition[] = [...baseSOP.steps];

    // Find insertion point (after pattern detection step)
    const patternDetectionIndex = mergedSteps.findIndex(
      step => step.id === 'detect-contract-patterns' || step.id === 'parse-solidity-ast'
    );

    const insertionIndex = patternDetectionIndex >= 0 ? patternDetectionIndex + 1 : mergedSteps.length;

    // Collect all additional steps from modules (sorted by priority)
    const additionalSteps: StepDefinition[] = [];

    for (const module of modules) {
      // Apply step modifications if any
      if (module.stepModifications) {
        this.applyStepModifications(mergedSteps, module.stepModifications);
      }

      // Add module steps
      additionalSteps.push(...module.additionalSteps);

      log.info('Module steps prepared', {
        moduleId: module.id,
        stepsAdded: module.additionalSteps.length,
      });
    }

    // Insert additional steps at insertion point
    mergedSteps.splice(insertionIndex, 0, ...additionalSteps);

    // Update dependencies if needed
    this.updateDependencies(mergedSteps);

    const mergedSOP: SOPDefinition = {
      ...baseSOP,
      id: `${baseSOP.id}-enhanced`,
      name: `${baseSOP.name} (Enhanced)`,
      description: `${baseSOP.description} - Enhanced with ${modules.length} specialized module(s)`,
      steps: mergedSteps,
    };

    log.info('SOP merge complete', {
      originalSteps: baseSOP.steps.length,
      mergedSteps: mergedSOP.steps.length,
      addedSteps: mergedSOP.steps.length - baseSOP.steps.length,
    });

    return mergedSOP;
  }

  /**
   * Apply step modifications (skip, replace, augment)
   */
  private applyStepModifications(steps: StepDefinition[], modifications: any[]): void {
    for (const mod of modifications) {
      const stepIndex = steps.findIndex(s => s.id === mod.stepId);

      if (stepIndex < 0) {
        log.warn('Step not found for modification', { stepId: mod.stepId });
        continue;
      }

      if (mod.modification === 'skip') {
        steps.splice(stepIndex, 1);
        log.info('Step skipped', { stepId: mod.stepId, reason: mod.reason });
      } else if (mod.modification === 'replace') {
        steps[stepIndex] = { ...steps[stepIndex], ...mod.newConfig };
        log.info('Step replaced', { stepId: mod.stepId });
      } else if (mod.modification === 'augment') {
        steps[stepIndex] = { ...steps[stepIndex], executorConfig: { ...steps[stepIndex].executorConfig, ...mod.newConfig } };
        log.info('Step augmented', { stepId: mod.stepId });
      }
    }
  }

  /**
   * Update step dependencies after merging
   */
  private updateDependencies(steps: StepDefinition[]): void {
    // Ensure all dependsOn references exist
    const stepIds = new Set(steps.map(s => s.id));

    for (const step of steps) {
      if (step.dependsOn) {
        const invalidDeps = step.dependsOn.filter((dep: string) => !stepIds.has(dep));
        if (invalidDeps.length > 0) {
          log.warn('Invalid dependencies detected', {
            stepId: step.id,
            invalidDeps,
          });
          // Remove invalid dependencies
          step.dependsOn = step.dependsOn.filter((dep: string) => stepIds.has(dep));
        }
      }
    }
  }

  /**
   * Get human-readable activation reason
   */
  private getActivationReason(module: SOPModule, context: any): string {
    const patterns = context.data?.contractPatterns;

    if (module.id === 'defi-vault-checks' && patterns?.vault?.isVault) {
      return `DeFi vault detected (${patterns.vault.vaultType})`;
    }

    if (module.id === 'token-security-checks' && patterns?.token?.isToken) {
      return `Token contract detected (${patterns.token.standard})`;
    }

    return 'Criteria met';
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const moduleRegistry = new SOPModuleRegistry();

// ============================================================================
// EXPORTS
// ============================================================================

export { SOPModuleRegistry };
export type { SOPModule, ModuleRegistry };
