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
  await context.onProgress?.(10, 'Checking for questionnaire answers...');

  const jobId = context.job.id;

  log.info('Checking for questionnaire answers - NON-BLOCKING mode', { jobId });

  // Check once if answers have been submitted (non-blocking)
  const { getAuditClarificationAnswers } = await import('../../../repositories/auditJobRepository.js');
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

  // No answers yet - continue with best effort (non-blocking)
  log.info('No questionnaire answers yet - continuing with best effort analysis', { jobId });
  await context.onProgress?.(100, 'Continuing with best effort analysis...');

  return {
    success: true,
    findings: [],
    data: {
      preAuditAnswers: {},
      userContext: {},
      skippedQuestionnaire: true,
    },
  };
};

// ============================================================================
// Wait for Clarification Answers
// ============================================================================

const waitForClarificationAnswers: InteractiveExecutor = async (step, config, context) => {
  await context.onProgress?.(10, 'Checking for clarification answers...');

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

  log.info('Checking for clarification answers - NON-BLOCKING mode', {
    jobId,
    requestCount: clarificationRequests.length,
  });

  // Check once if answers have been submitted (non-blocking)
  const { getAuditClarificationAnswers } = await import('../../../repositories/auditJobRepository.js');
  const answers = await getAuditClarificationAnswers(jobId, 'post_audit');

  const answerMap: Record<string, any> = {};

  if (answers && answers.length > 0) {
    log.info('Clarification answers received', {
      jobId,
      answerCount: answers.length,
    });

    // Convert answers to a usable format
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
  } else {
    log.info('No clarification answers yet - continuing with best effort analysis', { jobId });
  }

  await context.onProgress?.(100, 'Continuing with available context...');

  return {
    success: true, // Don't fail the audit if user doesn't answer clarifications
    findings: [],
    data: {
      clarificationAnswers: answerMap,
      skippedClarifications: answers?.length === 0,
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
