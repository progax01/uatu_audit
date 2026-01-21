/**
 * Interactive Step Executors
 *
 * Step executors that require user interaction during Deep scans.
 * These steps block execution until the user provides input.
 */

import type {
  StepDefinition,
  StepContext,
  StepResult,
  InteractiveStepConfig,
} from '../../definitions/types.js';
import { logger } from '../../../utils/logger.js';

const log = logger.child({ module: 'interactive-steps' });

// ============================================================================
// Main Executor
// ============================================================================

/**
 * Execute an interactive step
 */
export async function executeInteractiveStep(
  step: StepDefinition,
  config: InteractiveStepConfig,
  context: StepContext
): Promise<StepResult> {
  const executor = INTERACTIVE_EXECUTORS[config.function];

  if (!executor) {
    return {
      success: false,
      error: `Unknown interactive function: ${config.function}`,
      findings: [],
    };
  }

  return executor(step, config, context);
}

// ============================================================================
// Step Executor Type
// ============================================================================

type InteractiveExecutor = (
  step: StepDefinition,
  config: InteractiveStepConfig,
  context: StepContext
) => Promise<StepResult>;

// ============================================================================
// Show Pre-Audit Questionnaire
// ============================================================================

const showPreAuditQuestionnaire: InteractiveExecutor = async (step, config, context) => {
  await context.onProgress?.(10, 'Preparing questionnaire...');

  const contractCategory = context.data.contractCategory || 'generic';
  const jobId = context.job.id;

  log.info('Showing pre-audit questionnaire', {
    jobId,
    category: contractCategory,
  });

  // The questionnaire is shown via the frontend UI
  // This step just signals that the questionnaire should be displayed
  // The actual questionnaire URL: /audit/:jobId/questionnaire

  await context.onProgress?.(50, 'Waiting for user to access questionnaire...');

  // In a real implementation, this would wait for the user to navigate to the questionnaire page
  // For now, we just signal success - the orchestrator will handle the blocking

  await context.onProgress?.(100, 'Questionnaire ready');

  return {
    success: true,
    findings: [],
    data: {
      questionnaireShown: true,
      questionnaireUrl: `/audit/${jobId}/questionnaire`,
      contractCategory,
    },
  };
};

// ============================================================================
// Wait for Questionnaire Answers
// ============================================================================

const waitForQuestionnaireAnswers: InteractiveExecutor = async (step, config, context) => {
  await context.onProgress?.(10, 'Waiting for questionnaire answers...');

  const jobId = context.job.id;

  log.info('Waiting for questionnaire answers', { jobId });

  // Poll the database for questionnaire answers
  // This is a blocking operation until the user submits answers
  const { getAuditClarificationAnswers } = await import('../../../repositories/auditJobRepository.js');
  const fs = await import('fs-extra');
  const path = await import('path');

  const pollInterval = 5000; // 5 seconds
  const timeout = config.timeout || 604800000; // 7 days (matches workspace lifetime) - effectively infinite
  const startTime = Date.now();
  let lastStepDataUpdate = Date.now();

  while (Date.now() - startTime < timeout) {
    // Check if answers have been submitted
    const answers = await getAuditClarificationAnswers(jobId, 'pre_audit');

    if (answers && answers.length > 0) {
      await context.onProgress?.(100, 'Answers received');

      log.info('Questionnaire answers received', {
        jobId,
        answerCount: answers.length,
      });

      // Convert answers to a usable format
      const answerMap: Record<string, any> = {};
      for (const answer of answers) {
        try {
          const parsed = typeof answer.answerValue === 'string'
            ? JSON.parse(answer.answerValue)
            : answer.answerValue;
          answerMap[parsed.questionKey || answer.questionText] = parsed.value;
        } catch {
          answerMap[answer.questionText] = answer.answerValue;
        }
      }

      return {
        success: true,
        findings: [],
        data: {
          preAuditAnswers: answerMap,
          userContext: answerMap,
        },
      };
    }

    // Every 5 minutes, touch the stepData.json file to prevent stuck job detection
    const now = Date.now();
    if (now - lastStepDataUpdate >= 5 * 60 * 1000) {
      try {
        const stepDataPath = path.join(context.projectPath, '.uatu', 'stepData.json');
        if (await fs.pathExists(stepDataPath)) {
          // Update file modification time by touching it
          const stepData = await fs.readJson(stepDataPath);
          stepData.lastActivity = new Date().toISOString();
          stepData.waitingForUserInput = true;
          stepData.currentStep = 'wait-for-questionnaire-answers';
          await fs.writeJson(stepDataPath, stepData, { spaces: 2 });
          lastStepDataUpdate = now;
          log.debug('Updated stepData.json during questionnaire wait', { jobId });
        }
      } catch (err: any) {
        log.warn('Failed to update stepData during questionnaire wait', {
          jobId,
          error: err.message
        });
      }
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    await context.onProgress?.(
      50, // Fixed at 50% since we're paused waiting for input
      `Waiting for questionnaire answers (${timeStr})...`
    );
  }

  // Timeout reached
  log.warn('Questionnaire answer timeout', { jobId, timeout });

  return {
    success: false,
    findings: [],
    error: 'Timeout waiting for questionnaire answers',
    data: {
      preAuditAnswers: {},
      userContext: {},
    },
  };
};

// ============================================================================
// Wait for Clarification Answers
// ============================================================================

const waitForClarificationAnswers: InteractiveExecutor = async (step, config, context) => {
  await context.onProgress?.(10, 'Waiting for clarification answers...');

  const jobId = context.job.id;
  const clarificationRequests = context.data.clarificationRequests || [];

  if (clarificationRequests.length === 0) {
    // No clarifications requested, skip
    return {
      success: true,
      findings: [],
      data: {
        clarificationAnswers: {},
      },
    };
  }

  log.info('Waiting for clarification answers', {
    jobId,
    requestCount: clarificationRequests.length,
  });

  // Poll the database for clarification answers
  const { getAuditClarificationAnswers } = await import('../../../repositories/auditJobRepository.js');
  const fs = await import('fs-extra');
  const path = await import('path');

  const pollInterval = 5000; // 5 seconds
  const timeout = config.timeout || 1800000; // 30 minutes default
  const startTime = Date.now();
  let lastStepDataUpdate = Date.now();

  while (Date.now() - startTime < timeout) {
    // Check if answers have been submitted
    const answers = await getAuditClarificationAnswers(jobId, 'post_audit');

    if (answers && answers.length >= clarificationRequests.length) {
      await context.onProgress?.(100, 'Answers received');

      log.info('Clarification answers received', {
        jobId,
        answerCount: answers.length,
      });

      // Convert answers to a usable format
      const answerMap: Record<string, any> = {};
      for (const answer of answers) {
        try {
          const parsed = typeof answer.answerValue === 'string'
            ? JSON.parse(answer.answerValue)
            : answer.answerValue;
          answerMap[parsed.questionKey || answer.questionText] = parsed.value;
        } catch {
          answerMap[answer.questionText] = answer.answerValue;
        }
      }

      return {
        success: true,
        findings: [],
        data: {
          clarificationAnswers: answerMap,
        },
      };
    }

    // Every 5 minutes, touch the stepData.json file to prevent stuck job detection
    const now = Date.now();
    if (now - lastStepDataUpdate >= 5 * 60 * 1000) {
      try {
        const stepDataPath = path.join(context.projectPath, '.uatu', 'stepData.json');
        if (await fs.pathExists(stepDataPath)) {
          // Update file modification time by touching it
          const stepData = await fs.readJson(stepDataPath);
          stepData.lastActivity = new Date().toISOString();
          stepData.waitingForUserInput = true;
          stepData.currentStep = 'wait-for-clarification-answers';
          await fs.writeJson(stepDataPath, stepData, { spaces: 2 });
          lastStepDataUpdate = now;
          log.debug('Updated stepData.json during clarification wait', { jobId });
        }
      } catch (err: any) {
        log.warn('Failed to update stepData during clarification wait', {
          jobId,
          error: err.message
        });
      }
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    await context.onProgress?.(
      Math.min(90, (elapsed / (timeout / 1000)) * 90),
      `Waiting for answers (${elapsed}s)...`
    );
  }

  // Timeout reached - continue with partial answers
  log.warn('Clarification answer timeout, continuing with partial answers', { jobId, timeout });

  const answers = await getAuditClarificationAnswers(jobId, 'post_audit');
  const answerMap: Record<string, any> = {};

  if (answers) {
    for (const answer of answers) {
      try {
        const parsed = typeof answer.answerValue === 'string'
          ? JSON.parse(answer.answerValue)
          : answer.answerValue;
        answerMap[parsed.questionKey || answer.questionText] = parsed.value;
      } catch {
        answerMap[answer.questionText] = answer.answerValue;
      }
    }
  }

  return {
    success: true, // Don't fail the audit if user doesn't answer all clarifications
    findings: [],
    data: {
      clarificationAnswers: answerMap,
    },
  };
};

// ============================================================================
// User Finding Validation
// ============================================================================

const userFindingValidation: InteractiveExecutor = async (step, config, context) => {
  await context.onProgress?.(10, 'Requesting finding validation...');

  const jobId = context.job.id;
  const findings = context.data.deduplicatedFindings || [];

  log.info('Requesting user finding validation', {
    jobId,
    findingCount: findings.length,
  });

  // In Deep scans, users can review findings and adjust severity
  // This is optional (blocking=false), so we don't wait indefinitely

  // For now, we'll just return without validation
  // A full implementation would show a UI for validating findings

  await context.onProgress?.(100, 'Validation skipped');

  return {
    success: true,
    findings: [],
    data: {
      validatedByUser: false,
      severityAdjustments: {},
    },
  };
};

// ============================================================================
// Executor Registry
// ============================================================================

const INTERACTIVE_EXECUTORS: Record<string, InteractiveExecutor> = {
  'showPreAuditQuestionnaire': showPreAuditQuestionnaire,
  'waitForQuestionnaireAnswers': waitForQuestionnaireAnswers,
  'waitForClarificationAnswers': waitForClarificationAnswers,
  'userFindingValidation': userFindingValidation,
};
