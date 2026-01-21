/**
 * Re-Analysis Service
 *
 * Handles intelligent re-analysis after user answers clarification questions.
 * This service:
 * 1. Identifies steps that depend on user-provided answers
 * 2. Invalidates those steps and their downstream dependencies
 * 3. Applies severity adjustments based on contextual answers
 * 4. Triggers re-execution of affected analysis steps
 */

import { db } from '../db/index.js';
import { auditStepProgress, auditFindings, auditJobs, auditClarifications } from '../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

const log = logger.child({ service: 'reAnalysisService' });

// ============================================================================
// TYPES
// ============================================================================

export interface AuditFinding {
  id: string;
  jobId: string;
  title?: string;
  description?: string;
  adjustedSeverity?: string;
  originalSeverity?: string;
  severityAdjustmentReason?: string;
  isFalsePositive: boolean;
  category?: string;
  vulnerabilityType?: string;
  filePath?: string;
  lineStart?: number;
  functionName?: string;
  stepId?: string;
}

export interface AnswerMap {
  [questionKey: string]: any;
}

export interface ReAnalysisResult {
  invalidatedSteps: string[];
  adjustedFindings: number;
  reExecutionTriggered: boolean;
  affectedCategories: string[];
}

export interface StepDependencyMap {
  stepId: string;
  dependsOnAnswers: string[];
  category: string;
}

// ============================================================================
// STEP DEPENDENCY MAPPINGS
// ============================================================================

/**
 * Maps which SOP steps depend on which questionnaire answer keys.
 * This is the core configuration that determines what gets re-analyzed.
 */
const STEP_ANSWER_DEPENDENCIES: StepDependencyMap[] = [
  // Admin and Access Control
  {
    stepId: 'ai-admin-functions',
    dependsOnAnswers: [
      'admin_functions',
      'upgrade_pattern',
      'proxy_type',
      'pausable_functions',
    ],
    category: 'access-control',
  },
  {
    stepId: 'ai-access-control',
    dependsOnAnswers: [
      'admin_functions',
      'role_based_access',
      'multisig_required',
      'timelock_present',
    ],
    category: 'access-control',
  },

  // Oracle and Price Feeds
  {
    stepId: 'ai-oracle',
    dependsOnAnswers: [
      'defi_oracle_provider',
      'defi_price_feeds',
      'defi_twap_used',
      'oracle_fallback',
    ],
    category: 'oracle',
  },

  // Reentrancy
  {
    stepId: 'ai-reentrancy',
    dependsOnAnswers: [
      'reentrancy_guard',
      'external_calls',
      'checks_effects_interactions',
    ],
    category: 'reentrancy',
  },

  // Business Logic
  {
    stepId: 'ai-business-logic',
    dependsOnAnswers: [
      'core_functionality',
      'expected_behavior',
      'edge_cases',
      'known_limitations',
    ],
    category: 'business-logic',
  },

  // DeFi-specific
  {
    stepId: 'ai-validate-findings',
    dependsOnAnswers: [
      'defi_flash_loan_protection',
      'defi_slippage_protection',
      'defi_liquidity_checks',
      'defi_amm_type',
    ],
    category: 'defi',
  },

  // Severity calculation depends on ALL answers
  {
    stepId: 'calculate-severity',
    dependsOnAnswers: ['*'], // Wildcard - depends on all answers
    category: 'synthesis',
  },
];

// ============================================================================
// SEVERITY ADJUSTMENT RULES
// ============================================================================

interface SeverityAdjustmentRule {
  condition: (finding: AuditFinding, answers: AnswerMap) => boolean;
  adjustment: 'upgrade' | 'downgrade' | 'mark-false-positive';
  reason: string;
}

const SEVERITY_ADJUSTMENT_RULES: SeverityAdjustmentRule[] = [
  // Flash loan protection confirmed
  {
    condition: (finding, answers) =>
      answers['defi_flash_loan_protection'] === 'yes' &&
      ((finding.description?.toLowerCase() || '').includes('flash loan') ||
        (finding.title?.toLowerCase() || '').includes('flash loan')),
    adjustment: 'downgrade',
    reason: 'User confirmed flash loan protection is implemented',
  },

  // No reentrancy guard but claims protection
  {
    condition: (finding, answers) =>
      answers['reentrancy_guard'] === 'yes' &&
      finding.vulnerabilityType === 'reentrancy',
    adjustment: 'mark-false-positive',
    reason: 'User confirmed reentrancy guard is present',
  },

  // Oracle without fallback mechanism
  {
    condition: (finding, answers) =>
      answers['oracle_fallback'] === 'no' &&
      answers['defi_oracle_provider'] &&
      ((finding.description?.toLowerCase() || '').includes('oracle') ||
        (finding.description?.toLowerCase() || '').includes('price feed')),
    adjustment: 'upgrade',
    reason: 'No oracle fallback mechanism - increased risk',
  },

  // No multisig for critical functions
  {
    condition: (finding, answers) =>
      answers['multisig_required'] === 'no' &&
      answers['admin_functions']?.length > 0 &&
      finding.category === 'access-control',
    adjustment: 'upgrade',
    reason: 'Critical admin functions lack multisig protection',
  },

  // Timelock present reduces urgency
  {
    condition: (finding, answers) =>
      answers['timelock_present'] === 'yes' &&
      finding.category === 'access-control' &&
      (finding.adjustedSeverity || finding.originalSeverity) === 'high',
    adjustment: 'downgrade',
    reason: 'Timelock mechanism provides additional safety buffer',
  },

  // No slippage protection in AMM
  {
    condition: (finding, answers) =>
      answers['defi_slippage_protection'] === 'no' &&
      answers['defi_amm_type'] &&
      (finding.description?.toLowerCase() || '').includes('slippage'),
    adjustment: 'upgrade',
    reason: 'AMM lacks slippage protection - user funds at risk',
  },
];

// ============================================================================
// MAIN RE-ANALYSIS FUNCTION
// ============================================================================

/**
 * Triggers re-analysis of audit steps based on newly provided answers.
 * This is the entry point called when users submit questionnaire answers.
 */
export async function triggerReAnalysis(
  jobId: string,
  answers: AnswerMap
): Promise<ReAnalysisResult> {
  log.info('Starting re-analysis', { jobId, answerCount: Object.keys(answers).length });

  try {
    // 1. Identify which steps depend on these answers
    const dependentSteps = await identifyDependentSteps(jobId, answers);
    log.info('Identified dependent steps', { count: dependentSteps.length, steps: dependentSteps });

    if (dependentSteps.length === 0) {
      log.info('No steps depend on these answers - skipping re-analysis');
      return {
        invalidatedSteps: [],
        adjustedFindings: 0,
        reExecutionTriggered: false,
        affectedCategories: [],
      };
    }

    // 2. Get all downstream dependencies
    const allAffectedSteps = await getDownstreamDependencies(jobId, dependentSteps);
    log.info('Found downstream dependencies', { total: allAffectedSteps.length });

    // 3. Apply severity adjustments based on user context
    const adjustedCount = await applySeverityAdjustments(jobId, answers);
    log.info('Applied severity adjustments', { count: adjustedCount });

    // 4. Invalidate affected steps
    await invalidateSteps(jobId, allAffectedSteps);
    log.info('Invalidated steps for re-execution', { count: allAffectedSteps.length });

    // 5. Update job status to trigger re-execution
    const affectedCategories = [...new Set(
      dependentSteps
        .map(stepId => STEP_ANSWER_DEPENDENCIES.find(d => d.stepId === stepId)?.category)
        .filter(Boolean) as string[]
    )];

    await updateJobForReExecution(jobId, allAffectedSteps[0], affectedCategories);

    return {
      invalidatedSteps: allAffectedSteps,
      adjustedFindings: adjustedCount,
      reExecutionTriggered: true,
      affectedCategories,
    };
  } catch (error) {
    log.error('Re-analysis failed', { jobId, error });
    throw error;
  }
}

// ============================================================================
// STEP DEPENDENCY RESOLUTION
// ============================================================================

/**
 * Identifies which steps directly depend on the provided answers.
 */
async function identifyDependentSteps(
  jobId: string,
  answers: AnswerMap
): Promise<string[]> {
  const answerKeys = Object.keys(answers);
  const dependentSteps: string[] = [];

  for (const dep of STEP_ANSWER_DEPENDENCIES) {
    // Check if step depends on any of the provided answers
    const hasWildcard = dep.dependsOnAnswers.includes('*');
    const hasMatchingAnswer = dep.dependsOnAnswers.some(key => answerKeys.includes(key));

    if (hasWildcard || hasMatchingAnswer) {
      // Verify this step exists in the job's step progress
      const [stepProgress] = await db
        .select()
        .from(auditStepProgress)
        .where(
          and(
            eq(auditStepProgress.jobId, jobId),
            eq(auditStepProgress.stepId, dep.stepId)
          )
        );

      if (stepProgress) {
        dependentSteps.push(dep.stepId);
      }
    }
  }

  return dependentSteps;
}

/**
 * Gets all downstream steps that depend on the given steps.
 * Uses the SOP dependency graph to find transitive dependencies.
 */
async function getDownstreamDependencies(
  jobId: string,
  initialSteps: string[]
): Promise<string[]> {
  // Get job to find its SOP
  const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, jobId));

  if (!job?.sopId) {
    return initialSteps;
  }

  // Load SOP definition
  const { loadSOP } = await import('../sops/definitions/index.js');
  const sop = await loadSOP(job.sopId);

  if (!sop) {
    return initialSteps;
  }

  // Build dependency graph
  const allSteps = new Set<string>(initialSteps);
  const queue = [...initialSteps];

  while (queue.length > 0) {
    const currentStep = queue.shift()!;

    // Find steps that depend on currentStep
    for (const step of sop.steps) {
      if (step.dependsOn?.includes(currentStep) && !allSteps.has(step.id)) {
        allSteps.add(step.id);
        queue.push(step.id);
      }
    }
  }

  // Sort by order index to re-execute in correct sequence
  const sortedSteps = await sortStepsByOrder(jobId, Array.from(allSteps));

  return sortedSteps;
}

/**
 * Sorts steps by their orderIndex to ensure correct re-execution sequence.
 */
async function sortStepsByOrder(jobId: string, stepIds: string[]): Promise<string[]> {
  const steps = await db
    .select()
    .from(auditStepProgress)
    .where(
      and(
        eq(auditStepProgress.jobId, jobId),
        inArray(auditStepProgress.stepId, stepIds)
      )
    );

  return steps
    .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
    .map(s => s.stepId);
}

// ============================================================================
// SEVERITY ADJUSTMENT
// ============================================================================

/**
 * Applies severity adjustments to findings based on user-provided context.
 * Returns the number of findings adjusted.
 */
async function applySeverityAdjustments(
  jobId: string,
  answers: AnswerMap
): Promise<number> {
  // Get all findings for this job
  const findings = await db
    .select()
    .from(auditFindings)
    .where(eq(auditFindings.jobId, jobId));

  let adjustedCount = 0;

  for (const finding of findings) {
    let wasAdjusted = false;

    // Apply all matching rules
    for (const rule of SEVERITY_ADJUSTMENT_RULES) {
      try {
        if (rule.condition(finding as any, answers)) {
          const adjustedFinding = applyAdjustment(finding as any, rule);

          // Update in database
          const updateData: any = {
            adjustedSeverity: adjustedFinding.adjustedSeverity,
            severityAdjustmentReason: adjustedFinding.severityAdjustmentReason,
          };

          if (adjustedFinding.isFalsePositive) {
            updateData.status = 'false_positive';
          }

          await db
            .update(auditFindings)
            .set(updateData)
            .where(eq(auditFindings.id, finding.id));

          wasAdjusted = true;
          log.info('Applied severity adjustment', {
            findingId: finding.id,
            rule: rule.reason,
            adjustment: rule.adjustment,
          });
        }
      } catch (error) {
        log.error('Failed to apply severity rule', { findingId: finding.id, error });
      }
    }

    if (wasAdjusted) {
      adjustedCount++;
    }
  }

  return adjustedCount;
}

/**
 * Applies a single adjustment rule to a finding.
 */
function applyAdjustment(
  finding: AuditFinding,
  rule: SeverityAdjustmentRule
): AuditFinding {
  const adjusted = { ...finding };

  switch (rule.adjustment) {
    case 'upgrade':
      adjusted.adjustedSeverity = upgradeSeverity(finding.originalSeverity || 'info');
      adjusted.severityAdjustmentReason = rule.reason;
      break;

    case 'downgrade':
      adjusted.adjustedSeverity = downgradeSeverity(finding.originalSeverity || 'info');
      adjusted.severityAdjustmentReason = rule.reason;
      break;

    case 'mark-false-positive':
      adjusted.isFalsePositive = true;
      adjusted.severityAdjustmentReason = rule.reason;
      adjusted.adjustedSeverity = 'info';
      break;
  }

  return adjusted;
}

/**
 * Upgrades severity by one level.
 */
function upgradeSeverity(severity: string): string {
  const levels = ['info', 'low', 'medium', 'high', 'critical'];
  const currentIndex = levels.indexOf(severity);

  if (currentIndex === -1 || currentIndex === levels.length - 1) {
    return severity;
  }

  return levels[currentIndex + 1];
}

/**
 * Downgrades severity by one level.
 */
function downgradeSeverity(severity: string): string {
  const levels = ['info', 'low', 'medium', 'high', 'critical'];
  const currentIndex = levels.indexOf(severity);

  if (currentIndex <= 0) {
    return 'info';
  }

  return levels[currentIndex - 1];
}

// ============================================================================
// STEP INVALIDATION
// ============================================================================

/**
 * Marks steps as 'pending' for re-execution and clears their cached results.
 */
async function invalidateSteps(jobId: string, stepIds: string[]): Promise<void> {
  if (stepIds.length === 0) {
    return;
  }

  // Mark steps as pending
  await db
    .update(auditStepProgress)
    .set({
      status: 'pending',
      completedAt: null,
      durationMs: null,
      outputSummary: null,
      errorMessage: null,
    })
    .where(
      and(
        eq(auditStepProgress.jobId, jobId),
        inArray(auditStepProgress.stepId, stepIds)
      )
    );

  // Clear findings from invalidated steps
  await db
    .delete(auditFindings)
    .where(
      and(
        eq(auditFindings.jobId, jobId),
        inArray(auditFindings.stepId, stepIds)
      )
    );

  log.info('Invalidated steps', { jobId, count: stepIds.length });
}

// ============================================================================
// JOB STATUS UPDATE
// ============================================================================

/**
 * Updates job status to trigger re-execution from the first invalidated step.
 */
async function updateJobForReExecution(
  jobId: string,
  firstInvalidatedStep: string,
  affectedCategories: string[]
): Promise<void> {
  // Get step info
  const [step] = await db
    .select()
    .from(auditStepProgress)
    .where(
      and(
        eq(auditStepProgress.jobId, jobId),
        eq(auditStepProgress.stepId, firstInvalidatedStep)
      )
    );

  if (!step) {
    throw new Error(`Step ${firstInvalidatedStep} not found`);
  }

  // Update job to resume from this step
  await db
    .update(auditJobs)
    .set({
      status: 'auditing',
      currentStepId: firstInvalidatedStep,
      currentStepName: step.stepName,
      metadata: {
        reAnalysis: {
          triggeredAt: new Date().toISOString(),
          affectedCategories,
          reason: 'user_answers_provided',
        },
      },
    })
    .where(eq(auditJobs.id, jobId));

  log.info('Updated job for re-execution', {
    jobId,
    resumeFromStep: firstInvalidatedStep,
    categories: affectedCategories,
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Gets all pending clarifications for a job (used by resume flow).
 */
export async function getPendingClarifications(jobId: string) {
  return await db
    .select()
    .from(auditClarifications)
    .where(
      and(
        eq(auditClarifications.jobId, jobId),
        eq(auditClarifications.status, 'pending')
      )
    );
}

/**
 * Gets all answered clarifications for a job (used to build answer map).
 */
export async function getAnsweredClarifications(jobId: string): Promise<AnswerMap> {
  const clarifications = await db
    .select()
    .from(auditClarifications)
    .where(
      and(
        eq(auditClarifications.jobId, jobId),
        eq(auditClarifications.status, 'answered')
      )
    );

  const answerMap: AnswerMap = {};

  for (const clarification of clarifications) {
    const answer = clarification.answerValue as any;
    if (answer && typeof answer === 'object' && 'value' in answer) {
      answerMap[clarification.questionKey] = answer.value;
    }
  }

  return answerMap;
}

/**
 * Checks if a job has pending questions that need answers before continuing.
 */
export async function hasPendingQuestions(jobId: string): Promise<boolean> {
  const pending = await getPendingClarifications(jobId);
  return pending.length > 0;
}
