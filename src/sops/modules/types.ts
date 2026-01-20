/**
 * SOP Module System Types
 *
 * Defines the architecture for modular, contract-type-specific audit steps.
 * Modules are dynamically loaded based on detected contract patterns.
 */

import type { StepDefinition } from '../definitions/types.js';

export interface SOPModule {
  id: string;
  name: string;
  description: string;

  /**
   * Predicate function to determine if this module should be activated
   * @param context - Current execution context with detected patterns
   * @returns true if module should be loaded
   */
  applicableWhen: (context: any) => boolean;

  /**
   * Priority determines insertion order when multiple modules apply
   * Higher priority = inserted earlier in SOP
   */
  priority: number;

  /**
   * Additional audit steps specific to this contract pattern
   */
  additionalSteps: StepDefinition[];

  /**
   * Optional: Modify existing steps (e.g., adjust thresholds)
   */
  stepModifications?: StepModification[];

  /**
   * Optional: Required data keys this module needs
   */
  requiredData?: string[];
}

export interface StepModification {
  stepId: string;
  modification: 'skip' | 'replace' | 'augment';
  newConfig?: any;
  reason?: string;
}

export interface ModuleRegistry {
  modules: SOPModule[];

  /**
   * Get all applicable modules for current context
   */
  getApplicableModules: (context: any) => SOPModule[];

  /**
   * Register a new module
   */
  register: (module: SOPModule) => void;

  /**
   * Merge module steps into base SOP
   */
  mergeSOP: (baseSOP: any, modules: SOPModule[]) => any;
}

export interface ModuleExecutionContext {
  projectPath: string;
  contractPatterns: any;
  detectedFramework: string;
  stepData: Map<string, any>;
  userAnswers?: any;
}
