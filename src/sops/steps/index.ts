/**
 * Step Executors
 *
 * Main entry point for executing SOP steps.
 * Routes steps to appropriate executors based on type.
 */

import type {
  StepDefinition,
  StepContext,
  StepResult,
  DeterministicStepConfig,
  ToolStepConfig,
  AIPromptStepConfig,
  InteractiveStepConfig,
  CompositeStepConfig,
} from '../definitions/types';
import { executeDeterministicStep } from './deterministic';
import { executeToolStep } from './tools';
import { executeAIPromptStep } from './ai';
import { executeInteractiveStep } from './interactive';
import { logger } from '../../utils/logger';

const log = logger.child({ module: 'step-executor' });

// ============================================================================
// Main Executor
// ============================================================================

/**
 * Execute a single step based on its executor type
 */
export async function executeStep(
  step: StepDefinition,
  context: StepContext
): Promise<StepResult> {
  log.debug('Executing step', {
    stepId: step.id,
    executor: step.executor,
    aiAssisted: step.aiAssisted,
  });

  const startTime = Date.now();

  try {
    let result: StepResult;

    // Handle both 'executorConfig' and 'config' field names (backward compatibility)
    const config = step.executorConfig || (step as any).config;

    if (!config) {
      throw new Error(`Step ${step.id} missing executorConfig/config`);
    }

    switch (step.executor) {
      case 'deterministic':
        result = await executeDeterministicStep(
          step,
          config as DeterministicStepConfig,
          context
        );
        break;

      case 'tool':
        result = await executeToolStep(
          step,
          config as ToolStepConfig,
          context
        );
        break;

      case 'ai-prompt':
        result = await executeAIPromptStep(
          step,
          config as AIPromptStepConfig,
          context
        );
        break;

      case 'interactive':
        result = await executeInteractiveStep(
          step,
          config as InteractiveStepConfig,
          context
        );
        break;

      case 'composite':
        result = await executeCompositeStep(
          step,
          config as CompositeStepConfig,
          context
        );
        break;

      default:
        throw new Error(`Unknown executor type: ${step.executor}`);
    }

    const durationMs = Date.now() - startTime;

    log.debug('Step completed', {
      stepId: step.id,
      success: result.success,
      durationMs,
      findingsCount: result.findings?.length || 0,
    });

    return result;
  } catch (error: any) {
    const durationMs = Date.now() - startTime;

    log.error('Step failed', {
      stepId: step.id,
      error: error.message,
      durationMs,
    });

    return {
      success: false,
      error: error.message,
      findings: [],
    };
  }
}

// ============================================================================
// Composite Step Executor
// ============================================================================

/**
 * Execute a composite step that runs multiple sub-steps
 */
async function executeCompositeStep(
  step: StepDefinition,
  config: CompositeStepConfig,
  context: StepContext
): Promise<StepResult> {
  const allFindings: StepResult['findings'] = [];
  const allData: Record<string, any> = {};

  // Execute sub-steps in order
  for (let i = 0; i < config.subSteps.length; i++) {
    const subStepId = config.subSteps[i];

    // Find sub-step definition
    const subStep = context.sop.steps.find((s) => s.id === subStepId);
    if (!subStep) {
      log.warn('Sub-step not found', { parentStepId: step.id, subStepId });
      continue;
    }

    // Report progress
    const pct = Math.round(((i + 1) / config.subSteps.length) * 100);
    await context.onProgress?.(pct, `Executing ${subStep.name}...`);

    // Execute sub-step
    const result = await executeStep(subStep, {
      ...context,
      data: { ...context.data, ...allData },
    });

    if (!result.success && subStep.required) {
      return {
        success: false,
        error: `Sub-step ${subStepId} failed: ${result.error}`,
        findings: allFindings,
        data: allData,
      };
    }

    // Collect findings and data
    if (result.findings) {
      allFindings.push(...result.findings);
    }
    if (result.data) {
      Object.assign(allData, result.data);
    }
  }

  return {
    success: true,
    findings: allFindings,
    data: allData,
  };
}

// ============================================================================
// Exports
// ============================================================================

export { executeDeterministicStep } from './deterministic';
export { executeToolStep } from './tools';
export { executeAIPromptStep } from './ai';
export { executeInteractiveStep } from './interactive';
