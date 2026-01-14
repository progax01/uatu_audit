/**
 * Tool Step Executors
 *
 * Executes steps that run external security tools.
 * Wraps tool runners with step context and progress tracking.
 */

import type {
  StepDefinition,
  StepContext,
  StepResult,
  ToolStepConfig,
} from '../../definitions/types';
import { runTool, checkToolAvailable } from '../../../tools';
import { logger } from '../../../utils/logger';

const log = logger.child({ module: 'tool-steps' });

// ============================================================================
// Main Executor
// ============================================================================

/**
 * Execute a tool step
 */
export async function executeToolStep(
  step: StepDefinition,
  config: ToolStepConfig,
  context: StepContext
): Promise<StepResult> {
  const toolName = config.tool;

  log.debug('Executing tool step', {
    stepId: step.id,
    tool: toolName,
  });

  // Check tool availability
  const availability = await checkToolAvailable(toolName);

  if (!availability.available) {
    if (step.required) {
      return {
        success: false,
        error: `Required tool not available: ${toolName}`,
        findings: [],
      };
    }

    log.info('Optional tool not available, skipping', { toolName });
    return {
      success: true,
      findings: [],
      data: {
        [`${toolName}Skipped`]: true,
      },
    };
  }

  await context.onProgress?.(5, `Starting ${toolName}...`);

  // Build tool arguments
  const args: string[] = [];

  // Add configured arguments
  if (config.args) {
    for (const arg of config.args) {
      // Replace template variables
      const processedArg = arg
        .replace('{{projectPath}}', context.projectPath)
        .replace('{{jobId}}', context.job.id);
      args.push(processedArg);
    }
  }

  // Run the tool
  const result = await runTool(toolName, {
    projectPath: context.projectPath,
    args,
    timeout: step.timeoutSeconds * 1000,
    env: config.env,
    onProgress: async (pct, message) => {
      // Scale progress from 5-95%
      const scaledPct = Math.round(5 + (pct * 0.9));
      await context.onProgress?.(scaledPct, message);
    },
  });

  await context.onProgress?.(100, `${toolName} complete`);

  // Transform result
  return {
    success: result.success,
    findings: result.findings || [],
    error: result.error,
    data: {
      [`${toolName}Result`]: {
        success: result.success,
        findings: result.findings,
        executionTimeMs: result.executionTimeMs,
        toolVersion: result.toolVersion,
        exitCode: result.exitCode,
      },
    },
  };
}

// ============================================================================
// Tool-Specific Executors
// ============================================================================

/**
 * Execute Forge build step
 */
export async function executeForgeBuilld(
  step: StepDefinition,
  config: ToolStepConfig,
  context: StepContext
): Promise<StepResult> {
  const result = await executeToolStep(step, { ...config, tool: 'forge' }, context);

  // Extract build-specific data
  if (result.success && result.data?.forgeResult) {
    result.data.forgeBuildResult = {
      success: result.data.forgeResult.success,
      warnings: [], // Would be extracted from stderr
    };
  }

  return result;
}

/**
 * Execute Forge test step
 */
export async function executeForgeTest(
  step: StepDefinition,
  config: ToolStepConfig,
  context: StepContext
): Promise<StepResult> {
  const result = await executeToolStep(step, { ...config, tool: 'forge-test' }, context);

  // Extract test-specific data
  if (result.data?.['forge-testResult']) {
    result.data.forgeTestResult = result.data['forge-testResult'];
    delete result.data['forge-testResult'];
  }

  return result;
}

/**
 * Execute Slither step
 */
export async function executeSlither(
  step: StepDefinition,
  config: ToolStepConfig,
  context: StepContext
): Promise<StepResult> {
  return executeToolStep(step, { ...config, tool: 'slither' }, context);
}

/**
 * Execute Mythril step
 */
export async function executeMythril(
  step: StepDefinition,
  config: ToolStepConfig,
  context: StepContext
): Promise<StepResult> {
  return executeToolStep(step, { ...config, tool: 'mythril' }, context);
}

/**
 * Execute Semgrep step
 */
export async function executeSemgrep(
  step: StepDefinition,
  config: ToolStepConfig,
  context: StepContext
): Promise<StepResult> {
  return executeToolStep(step, { ...config, tool: 'semgrep' }, context);
}
