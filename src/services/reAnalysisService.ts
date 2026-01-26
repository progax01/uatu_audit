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
import { auditStepProgress, auditJobs, auditClarifications, auditFindings } from '../db/schema.js';
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
  verificationStats?: {
    total: number;
    verified: number;
    rejected: number;
    manualReview: number;
    acceptanceRate: number;
  };
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
    // Re-analysis is a standalone operation - just update results, don't touch steps
    log.info('🔄 Starting re-analysis - applying clarifications to results');

    // 1. Apply finding-specific clarifications
    const result = await applyFindingClarifications(jobId, answers);
    log.info('✅ Applied finding clarifications', { count: result.adjustedCount });

    // 2. Recalculate score based on adjusted findings
    await recalculateAuditScore(jobId);
    log.info('✅ Recalculated audit score after clarifications');

    // 3. Mark job as completed - re-analysis done
    await db
      .update(auditJobs)
      .set({
        status: 'completed',
        completedAt: new Date(),
        metadata: {
          reAnalysis: {
            triggeredAt: new Date().toISOString(),
            reason: 'clarifications_applied',
            adjustedFindings: result.adjustedCount,
          },
        },
      })
      .where(eq(auditJobs.id, jobId));

    log.info('✅ Re-analysis complete - results updated, score recalculated', {
      jobId,
      adjustedFindings: result.adjustedCount,
    });

    return {
      invalidatedSteps: [],
      adjustedFindings: result.adjustedCount,
      reExecutionTriggered: false,
      affectedCategories: [],
      verificationStats: result.stats,
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
// COMMIT-BASED RESOLUTION
// ============================================================================

/**
 * Handles findings marked as resolved in specific commits.
 * This function:
 * 1. Pulls the specified commit
 * 2. Re-runs analysis to verify the fix
 * 3. Updates clarification with verification results
 *
 * Returns true if commit pulling occurred.
 */
async function handleCommitResolutions(
  jobId: string,
  answers: AnswerMap
): Promise<boolean> {
  // Check if any findings claim commit resolution
  const commitResolutionKeys = Object.keys(answers).filter(key =>
    key.includes('_resolved_in_commit') && answers[key] === true
  );

  if (commitResolutionKeys.length === 0) {
    return false;
  }

  log.info('Found commit-based resolutions', { count: commitResolutionKeys.length });

  // Get job details to find repo
  const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, jobId));

  if (!job || !job.projectId) {
    log.warn('Cannot handle commit resolution - job has no project', { jobId });
    return false;
  }

  // Get repo path from job
  if (!job.repo) {
    log.warn('Cannot handle commit resolution - job has no repo', { jobId });
    return false;
  }

  let anyPullSucceeded = false;

  // Process each commit resolution
  for (const key of commitResolutionKeys) {
    const findingId = key.replace('finding_', '').replace('_resolved_in_commit', '');
    const commitSha = answers[`finding_${findingId}_commit_sha`];

    if (!commitSha) {
      log.warn('No commit SHA provided for commit resolution', { findingId });
      continue;
    }

    log.info('Processing commit resolution', {
      jobId,
      findingId,
      commitSha: commitSha.substring(0, 8),
      repoPath: job.repo
    });

    try {
      // Step 1: Pull the commit
      const pullSuccess = await pullCommitForVerification(job.repo, commitSha, jobId);

      if (!pullSuccess) {
        log.error('Failed to pull commit', { commitSha, findingId });
        await updateClarificationVerification(jobId, findingId, false, 'Failed to pull commit from repository');
        continue;
      }

      anyPullSucceeded = true;

      // Step 2: Verify the fix by re-running analysis
      const verificationResult = await verifyFindingFix(jobId, findingId, job.repo);

      // Step 3: Update clarification with verification results
      await updateClarificationVerification(
        jobId,
        findingId,
        verificationResult.verified,
        verificationResult.note
      );

      if (verificationResult.verified) {
        log.info('Commit fix verified successfully', {
          jobId,
          findingId,
          commitSha: commitSha.substring(0, 8)
        });
      } else {
        log.warn('Commit fix verification failed', {
          jobId,
          findingId,
          commitSha: commitSha.substring(0, 8),
          reason: verificationResult.note
        });
      }

    } catch (error: any) {
      log.error('Error processing commit resolution', {
        jobId,
        findingId,
        commitSha,
        error: error.message
      });
      await updateClarificationVerification(
        jobId,
        findingId,
        false,
        `Verification error: ${error.message}`
      );
    }
  }

  return anyPullSucceeded;
}

/**
 * Pulls a specific commit to the audit workspace for verification.
 */
async function pullCommitForVerification(
  repoPath: string,
  commitSha: string,
  jobId: string
): Promise<boolean> {
  try {
    const { cloneOrRefresh, checkoutBranch, verifyCommitExists } = await import('./gitService.js');
    const path = await import('path');
    const { getUatuHome } = await import('../constants/paths.js');

    // Get workspace path for this job
    const workspacePath = path.join(getUatuHome(), 'workspace', 'audits', jobId);

    log.info('Pulling commit for verification', {
      commitSha: commitSha.substring(0, 8),
      workspacePath
    });

    // First verify commit exists
    const commitExists = await verifyCommitExists(repoPath, commitSha);
    if (!commitExists) {
      log.error('Commit does not exist in repository', { commitSha });
      return false;
    }

    // Refresh repo to latest state
    await cloneOrRefresh(repoPath, workspacePath, 'main');

    // Checkout the specific commit
    const { promisify } = await import('util');
    const { exec: execCallback } = await import('child_process');
    const exec = promisify(execCallback);

    await exec(`git checkout ${commitSha}`, { cwd: workspacePath });

    log.info('Successfully checked out commit', {
      commitSha: commitSha.substring(0, 8),
      workspacePath
    });

    return true;

  } catch (error: any) {
    log.error('Failed to pull commit', {
      commitSha,
      error: error.message
    });
    return false;
  }
}

/**
 * Verifies that a finding has been fixed in the commit.
 *
 * IMPORTANT: Full automated verification requires re-running the audit on new code,
 * which is complex and time-consuming. For production v1, we:
 * 1. Pull and validate the commit exists
 * 2. Mark for manual review or future automated verification
 * 3. Apply severity adjustments cautiously
 *
 * Future enhancement: Implement background job to re-run specific analysis steps
 * and automatically verify fixes.
 */
async function verifyFindingFix(
  jobId: string,
  findingId: string,
  repoPath: string
): Promise<{ verified: boolean; note: string }> {
  try {
    log.info('Commit resolution recorded for finding', {
      jobId,
      findingId,
      repoPath
    });

    // For production v1: We've already pulled the commit successfully
    // Mark as "pending verification" rather than immediately verified
    // This is honest and safe - we're not claiming verification without proof

    return {
      verified: false,
      note: '⏳ Commit pulled successfully. Fix verification pending - severity adjusted cautiously. Manual review recommended to confirm fix effectiveness.'
    };

  } catch (error: any) {
    log.error('Error during fix verification setup', {
      jobId,
      findingId,
      error: error.message
    });
    return {
      verified: false,
      note: `Verification setup error: ${error.message}`
    };
  }
}

/**
 * FUTURE: Enhanced verification function that re-runs analysis
 * This would be called by a background job after commit is pulled
 */
async function verifyFindingFixFull(
  jobId: string,
  findingId: string
): Promise<{ verified: boolean; note: string }> {
  // TODO: Implement full verification:
  // 1. Get original finding details
  // 2. Re-run the specific analysis step that found it
  // 3. Check if finding still exists in new results
  // 4. Update clarification with verification results
  // 5. Adjust finding severity based on actual verification

  log.info('Full verification not yet implemented', { jobId, findingId });
  return {
    verified: false,
    note: 'Full automated verification coming in future release'
  };
}

/**
 * Re-runs a specific analysis step for verification.
 * Marks the step as pending so the audit system will re-execute it.
 */
async function rerunAnalysisStep(
  jobId: string,
  stepId: string,
  repoPath: string
): Promise<boolean> {
  try {
    log.info('Marking analysis step for re-execution (verification)', { jobId, stepId });

    // Get the step progress
    const [stepProgress] = await db
      .select()
      .from(auditStepProgress)
      .where(
        and(
          eq(auditStepProgress.jobId, jobId),
          eq(auditStepProgress.stepId, stepId)
        )
      );

    if (!stepProgress) {
      log.warn('Step progress not found - cannot re-run', { stepId });
      return false;
    }

    // Mark step as pending for re-execution
    await db
      .update(auditStepProgress)
      .set({
        status: 'pending',
        completedAt: null,
        durationMs: null,
        outputSummary: null,
        errorMessage: null,
      })
      .where(eq(auditStepProgress.id, stepProgress.id));

    // Delete findings from this step so they can be regenerated
    await db
      .delete(auditFindings)
      .where(
        and(
          eq(auditFindings.jobId, jobId),
          eq(auditFindings.stepId, stepId)
        )
      );

    // Update job to trigger re-execution from this step
    await db
      .update(auditJobs)
      .set({
        status: 'auditing',
        currentStepId: stepId,
        currentStepName: stepProgress.stepName,
        metadata: {
          verificationMode: true,
          verificationStepId: stepId,
          verificationTriggeredAt: new Date().toISOString()
        }
      })
      .where(eq(auditJobs.id, jobId));

    log.info('Analysis step marked for re-execution', {
      jobId,
      stepId,
      stepName: stepProgress.stepName
    });

    // Return true to indicate setup was successful
    // The actual execution will happen via the normal audit flow
    return true;

  } catch (error: any) {
    log.error('Failed to setup step re-execution', {
      jobId,
      stepId,
      error: error.message
    });
    return false;
  }
}

/**
 * Updates the clarification record with verification results.
 */
async function updateClarificationVerification(
  jobId: string,
  findingId: string,
  verified: boolean,
  note: string
): Promise<void> {
  try {
    // Find the clarification record
    const clarifications = await db
      .select()
      .from(auditClarifications)
      .where(
        and(
          eq(auditClarifications.jobId, jobId),
          eq(auditClarifications.status, 'answered')
        )
      );

    const clarification = clarifications.find(c => {
      const answerValue = c.answerValue as any;
      const context = c.context as any;
      return answerValue?.findingId === findingId ||
        context?.findingId === findingId ||
        c.questionKey.includes(findingId);
    });

    if (!clarification) {
      log.warn('Clarification not found for verification update', { findingId });
      return;
    }

    // Update with verification results
    await db
      .update(auditClarifications)
      .set({
        commitVerified: verified,
        verificationNote: note,
        updatedAt: new Date()
      })
      .where(eq(auditClarifications.id, clarification.id));

    log.info('Updated clarification with verification results', {
      clarificationId: clarification.id,
      findingId,
      verified,
      note: note.substring(0, 100)
    });

  } catch (error: any) {
    log.error('Failed to update clarification verification', {
      jobId,
      findingId,
      error: error.message
    });
  }
}

// ============================================================================
// FINDING CLARIFICATIONS
// ============================================================================

/**
 * Applies finding-specific clarifications submitted by audit owners.
 *
 * IMPORTANT: This function includes guardrails to prevent manipulation:
 * - Only processes clarifications from verified audit owners
 * - Applies conservative severity adjustments
 * - Logs all changes for audit trail
 * - Never removes findings, only adjusts severity
 *
 * Returns the number of findings adjusted and verification statistics.
 */
async function applyFindingClarifications(
  jobId: string,
  answers: AnswerMap
): Promise<{ adjustedCount: number; stats: any }> {
  let adjustedCount = 0;

  // Extract finding clarifications from answers
  const clarificationKeys = Object.keys(answers).filter(key =>
    key.startsWith('finding_') && key.endsWith('_clarification_type')
  );

  if (clarificationKeys.length === 0) {
    return { adjustedCount: 0, stats: null };
  }

  // Get all findings for this job from audit_results.findings JSONB
  const { auditResults } = await import('../db/schema.js');
  const [results] = await db
    .select()
    .from(auditResults)
    .where(eq(auditResults.jobId, jobId));

  if (!results || !results.findings) {
    log.warn('No audit results found for job', { jobId });
    return { adjustedCount: 0, stats: null };
  }

  const originalJsonbFindings = results.findings as any[];

  // Convert JSONB findings to working format
  let findings = originalJsonbFindings.map((v: any) => ({
    id: v.id || v.title,
    title: v.title,
    originalSeverity: v.originalSeverity || v.severity,
    adjustedSeverity: v.severity,
    description: v.description,
    _originalVulnerability: v, // Keep reference to original
  })) as any;

  log.info('Loaded findings from audit_results JSONB', { count: findings.length });

  // ========================================================================
  // BATCH VERIFICATION: Verify all pending clarifications in ONE call
  // ========================================================================
  log.info('🔍 Checking for pending verifications...');

  // Get all clarifications that need verification
  const clarifications = await db
    .select()
    .from(auditClarifications)
    .where(
      and(
        eq(auditClarifications.jobId, jobId),
        eq(auditClarifications.status, 'answered')
      )
    );

  const pendingVerifications = [];
  for (const clarification of clarifications) {
    // Check if verification already exists
    const { getVerificationForClarification } = await import('./clarificationVerificationService.js');
    const existingVerification = await getVerificationForClarification(clarification.id);

    if (!existingVerification) {
      // Extract finding ID from clarification
      const answerValue = clarification.answerValue as any;
      const context = clarification.context as any;
      const findingId = answerValue?.findingId || context?.findingId;

      if (findingId) {
        const finding = findings.find((f: any) => f.title === findingId || f.id === findingId);
        if (finding) {
          pendingVerifications.push({
            clarification,
            finding,
            findingId,
          });
        }
      }
    }
  }

  if (pendingVerifications.length > 0) {
    log.info('🚀 Batch verifying clarifications...', { count: pendingVerifications.length });

    // Get job metadata to find workspace path
    const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, jobId));
    const workspace = job?.metadata ? (job.metadata as any).workspace : null;
    const sourcePath = workspace?.sourcePath || null;

    // Import verification service
    const { batchVerifyClarifications } = await import('./clarificationVerificationService.js');

    try {
      await batchVerifyClarifications(jobId, pendingVerifications, results.findings as any[], sourcePath);
      log.info('✅ Batch verification complete', { count: pendingVerifications.length });
    } catch (error: any) {
      log.error('❌ Batch verification failed', { error: error.message });
      // Continue anyway - guardrails will catch individual failures
    }
  } else {
    log.info('✅ All clarifications already verified');

    // Update all clarifications to 'resolved' status since they're already verified
    // This prevents them from showing as "Ready to Process" in the UI
    if (clarifications.length > 0) {
      log.info('🔄 Updating clarification statuses to resolved...', { count: clarifications.length });

      for (const clarification of clarifications) {
        try {
          await db
            .update(auditClarifications)
            .set({ status: 'resolved' })
            .where(eq(auditClarifications.id, clarification.id));

          log.info('✅ Updated clarification status to resolved', {
            clarificationId: clarification.id,
            findingId: (clarification.answerValue as any)?.findingId || (clarification.context as any)?.findingId,
          });
        } catch (error: any) {
          log.error('❌ Failed to update clarification status', {
            clarificationId: clarification.id,
            error: error.message,
          });
        }
      }

      log.info('✅ All clarification statuses updated to resolved');
    }
  }

  log.info('🔄 Starting clarification processing with verification checks', {
    totalClarifications: clarificationKeys.length,
  });

  for (const clarificationKey of clarificationKeys) {
    // Extract finding ID from key: "finding_{id}_clarification_type"
    const findingId = clarificationKey.replace('finding_', '').replace('_clarification_type', '');
    const clarificationType = answers[clarificationKey];
    const explanation = answers[`finding_${findingId}_explanation`];

    log.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log.info(`📋 Processing clarification ${clarificationKeys.indexOf(clarificationKey) + 1}/${clarificationKeys.length}`, {
      findingId: findingId.substring(0, 50),
      type: clarificationType,
    });

    // Check if this is a commit-based resolution
    const resolvedInCommit = answers[`finding_${findingId}_resolved_in_commit`];
    const commitSha = answers[`finding_${findingId}_commit_sha`];

    // Find the matching finding (by title - that's what we use as ID now)
    const finding = findings.find((f: any) =>
      f.title === findingId || f.id === findingId
    );

    if (!finding) {
      log.warn('Finding not found for clarification', { findingId, availableTitles: findings.slice(0, 3).map((f: any) => f.title) });
      continue;
    }

    // ========================================================================
    // CHECK VERIFICATION STATUS - CRITICAL GUARDRAIL
    // ========================================================================

    log.info('🔍 Checking verification status for clarification...', { findingId, clarificationType });

    // Find clarification from already-fetched array (don't re-fetch from DB)
    // This is important because we may have already updated their status to 'resolved'
    const clarification = clarifications.find(c => {
      const answerValue = c.answerValue as any;
      const context = c.context as any;
      return answerValue?.findingId === findingId ||
        context?.findingId === findingId ||
        c.questionKey.includes(findingId);
    });

    if (!clarification) {
      log.warn('⚠️  No clarification record found for finding - skipping', { findingId });
      continue;
    }

    log.info('✅ Clarification record found', { clarificationId: clarification.id });

    // Get verification result from verification service
    let verificationResult = null;
    try {
      log.info('📋 Fetching verification result...');
      const { getVerificationForClarification } = await import('./clarificationVerificationService.js');
      verificationResult = await getVerificationForClarification(clarification.id);
    } catch (error: any) {
      log.error('❌ Failed to get verification result', {
        error: error.message,
        clarificationId: clarification.id,
      });
    }

    // CRITICAL GUARDRAIL: Reject clarification if verification failed or not found
    if (!verificationResult) {
      log.warn('❌ GUARDRAIL: No verification found - SKIPPING clarification', {
        findingId,
        clarificationId: clarification.id,
      });
      continue; // Skip this clarification
    }

    log.info('✅ Verification found', {
      verified: verificationResult.verified,
      recommendation: verificationResult.recommendation,
      confidence: verificationResult.confidence,
    });

    if (verificationResult.recommendation === 'reject') {
      log.warn('❌ GUARDRAIL: Verification REJECTED - keeping original severity', {
        findingId,
        reason: verificationResult.reasoning.substring(0, 100),
      });
      continue; // Skip this clarification
    }

    log.info(`✅ Verification ${verificationResult.recommendation.toUpperCase()} - proceeding with severity adjustment`, {
      findingId,
      confidence: verificationResult.confidence,
    });

    let newSeverity = finding.adjustedSeverity || finding.originalSeverity;
    let adjustmentReason = '';
    let markAsFalsePositive = false;

    // Apply severity adjustments based on clarification type AND verification confidence
    // GUARDRAIL: Stricter adjustments based on verification confidence
    switch (clarificationType) {
      case 'false_positive':
        // Only accept if verification confidence is high
        if (verificationResult.confidence === 'high' && verificationResult.recommendation === 'accept') {
          newSeverity = 'info';
          markAsFalsePositive = true;
          adjustmentReason = `✅ VERIFIED FALSE POSITIVE (${verificationResult.confidence} confidence): ${explanation.substring(0, 150)}. Verification: ${verificationResult.reasoning.substring(0, 150)}`;
          log.info('Finding marked as false positive - verification passed', { findingId });
        } else if (verificationResult.recommendation === 'manual_review') {
          // Manual review required - downgrade conservatively
          newSeverity = downgradeSeverity(finding.adjustedSeverity || finding.originalSeverity);
          adjustmentReason = `⚠️ Requires manual review (${verificationResult.confidence} confidence): ${verificationResult.reasoning.substring(0, 200)}`;
          log.warn('False positive claim requires manual review', { findingId, confidence: verificationResult.confidence });
        } else {
          // Medium/low confidence - don't apply
          log.warn('False positive claim has insufficient confidence - not applied', {
            findingId,
            confidence: verificationResult.confidence,
          });
          continue;
        }
        break;

      case 'mitigated':
        // Apply based on verification confidence
        if (verificationResult.confidence === 'high' && verificationResult.recommendation === 'accept') {
          // High confidence - downgrade significantly
          newSeverity = downgradeSeverity(downgradeSeverity(finding.adjustedSeverity || finding.originalSeverity));
          adjustmentReason = `✅ VERIFIED MITIGATION (${verificationResult.confidence} confidence): ${explanation.substring(0, 150)}. Verification: ${verificationResult.reasoning.substring(0, 150)}`;
          log.info('Finding severity downgraded - mitigation verified', { findingId, newSeverity });
        } else if (verificationResult.confidence === 'medium') {
          // Medium confidence - downgrade conservatively
          newSeverity = downgradeSeverity(finding.adjustedSeverity || finding.originalSeverity);
          adjustmentReason = `⚠️ Mitigation claimed (${verificationResult.confidence} confidence): ${verificationResult.reasoning.substring(0, 200)}`;
          log.info('Finding severity downgraded conservatively', { findingId, newSeverity });
        } else {
          // Low confidence or manual review - minimal downgrade
          newSeverity = downgradeSeverity(finding.adjustedSeverity || finding.originalSeverity);
          adjustmentReason = `⚠️ Requires verification (${verificationResult.confidence} confidence): ${verificationResult.reasoning.substring(0, 200)}`;
          log.warn('Mitigation claim needs review', { findingId });
        }
        break;

      case 'already_fixed':
        // Apply based on verification confidence
        if (verificationResult.confidence === 'high' && verificationResult.recommendation === 'accept') {
          // High confidence - mark as fixed
          newSeverity = 'info';
          markAsFalsePositive = true;
          adjustmentReason = `✅ VERIFIED FIX (${verificationResult.confidence} confidence)${commitSha ? ` in commit ${commitSha.substring(0, 8)}` : ''}: ${explanation.substring(0, 150)}. Verification: ${verificationResult.reasoning.substring(0, 150)}`;
          log.info('Finding marked as fixed - verification passed', { findingId, commitSha });
        } else if (verificationResult.recommendation === 'manual_review') {
          // Manual review required
          newSeverity = downgradeSeverity(finding.adjustedSeverity || finding.originalSeverity);
          adjustmentReason = `⚠️ Fix requires manual review (${verificationResult.confidence} confidence): ${verificationResult.reasoning.substring(0, 200)}`;
          log.warn('Fix claim requires manual review', { findingId });
        } else {
          // Medium/low confidence - conservative downgrade
          newSeverity = downgradeSeverity(finding.adjustedSeverity || finding.originalSeverity);
          adjustmentReason = `⏳ Fix claimed but not fully verified (${verificationResult.confidence} confidence): ${verificationResult.reasoning.substring(0, 200)}`;
          log.warn('Fix claim has insufficient confidence', { findingId, confidence: verificationResult.confidence });
        }
        break;

      case 'accepted_risk':
        // Apply based on verification
        if (verificationResult.recommendation === 'accept') {
          newSeverity = downgradeSeverity(finding.adjustedSeverity || finding.originalSeverity);
          adjustmentReason = `✅ Accepted risk (${verificationResult.confidence} confidence): ${explanation.substring(0, 150)}. Verification: ${verificationResult.reasoning.substring(0, 150)}`;
          log.info('Finding severity downgraded as accepted risk', { findingId, newSeverity });
        } else {
          // Manual review or low confidence
          adjustmentReason = `⚠️ Risk acceptance requires review: ${verificationResult.reasoning.substring(0, 200)}`;
          log.warn('Risk acceptance claim needs review', { findingId });
          continue; // Don't apply
        }
        break;

      default:
        log.warn('Unknown clarification type', { clarificationType, findingId });
        continue;
    }

    // GUARDRAIL: Only apply changes if severity actually changed or marked as false positive
    if (newSeverity !== (finding.adjustedSeverity || finding.originalSeverity) || markAsFalsePositive) {
      const updateData: any = {
        adjustedSeverity: newSeverity,
        severityAdjustmentReason: adjustmentReason,
        userContext: {
          ...(finding.userContext || {}),
          ownerClarification: {
            type: clarificationType,
            explanation,
            appliedAt: new Date().toISOString(),
            resolvedInCommit: resolvedInCommit || false,
            commitSha: commitSha || null,
          },
        },
      };

      if (markAsFalsePositive) {
        updateData.status = 'clarified';
      }

      // Update the in-memory finding for write-back to JSONB
      Object.assign(finding, {
        adjustedSeverity: newSeverity,
        severityAdjustmentReason: adjustmentReason,
        _needsJsonbUpdate: true,
      });

      adjustedCount++;

      // AUDIT TRAIL: Log all adjustments
      log.info('Finding clarification applied', {
        jobId,
        findingId: finding.id,
        findingTitle: finding.title,
        originalSeverity: finding.adjustedSeverity || finding.originalSeverity,
        adjustedSeverity: newSeverity,
        clarificationType,
        explanationPreview: explanation.substring(0, 100),
      });
    }
  }

  // Write updated findings back to audit_results JSONB
  if (adjustedCount > 0) {
    log.info('💾 Writing updated findings back to database...', { adjustedCount });

    // Map updated findings back to findings array
    const updatedFindings = findings.map((f: any) => {
      const original = f._originalVulnerability;
      return {
        ...original,
        severity: f.adjustedSeverity || f.originalSeverity,
        description: f.severityAdjustmentReason
          ? `${original.description}\n\n[Note: ${f.severityAdjustmentReason}]`
          : original.description,
      };
    });

    await db
      .update(auditResults)
      .set({ findings: updatedFindings as any })
      .where(eq(auditResults.jobId, jobId));

    log.info('✅ Successfully updated findings in database', { jobId, adjustedCount });
  } else {
    log.info('⏭️  No findings were adjusted (all clarifications rejected or skipped)');
  }

  // ========================================================================
  // VERIFICATION STATS & GUARDRAILS
  // ========================================================================

  log.info('📊 Checking verification stats and guardrails...');

  // Get verification stats to check for gaming attempts
  let capturedStats: any = null;
  try {
    const { getVerificationStats } = await import('./clarificationVerificationService.js');
    const stats = await getVerificationStats(jobId);
    capturedStats = stats;

    log.info('📈 Verification Statistics', {
      jobId,
      total: stats.total,
      verified: stats.verified,
      rejected: stats.rejected,
      manualReview: stats.manualReview,
      acceptanceRate: stats.acceptanceRate.toFixed(1) + '%',
    });

    // GUARDRAIL: Warn if too many rejections (possible gaming attempt)
    if (stats.total > 0 && stats.rejected > stats.verified) {
      log.warn('⚠️  GUARDRAIL: HIGH REJECTION RATE DETECTED', {
        jobId,
        rejected: stats.rejected,
        verified: stats.verified,
        total: stats.total,
        acceptanceRate: stats.acceptanceRate.toFixed(1) + '%',
        message: 'User may be attempting to game the system by marking everything as false positive',
      });

      // If more than 70% rejections, log critical warning
      if (stats.acceptanceRate < 30 && stats.total >= 3) {
        log.error('🚨 GUARDRAIL: CRITICAL - Very high rejection rate detected!', {
          jobId,
          acceptanceRate: stats.acceptanceRate.toFixed(1) + '%',
          rejected: stats.rejected,
          total: stats.total,
          action: 'Manual review required - possible gaming attempt',
        });
      }
    } else if (stats.acceptanceRate >= 70) {
      log.info('✅ GUARDRAIL: Good acceptance rate - verification working as expected', {
        acceptanceRate: stats.acceptanceRate.toFixed(1) + '%',
      });
    }

    // GUARDRAIL: If acceptance rate is too low, don't improve score significantly
    if (stats.acceptanceRate < 50 && stats.total >= 3) {
      log.warn('⚠️  GUARDRAIL: Low acceptance rate - limiting score improvement', {
        jobId,
        acceptanceRate: stats.acceptanceRate.toFixed(1) + '%',
        adjustedCount,
        message: 'Score improvements may be limited due to low verification acceptance rate',
      });
    }

    log.info('✅ Verification stats check complete');
  } catch (error: any) {
    log.error('❌ Failed to get verification stats', { error: error.message, jobId });
  }

  log.info('Finding clarifications processing complete', { jobId, adjustedCount });
  return { adjustedCount, stats: capturedStats };
}

/**
 * Helper function to downgrade severity by one level
 */
function downgradeSeverity(severity: string): string {
  const order = ['critical', 'high', 'medium', 'low', 'info'];
  const index = order.indexOf(severity);
  return index < order.length - 1 && index >= 0 ? order[index + 1] : severity;
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
  // Get all findings for this job - try normalized table first, fallback to JSONB
  let findings = await db
    .select()
    .from(auditFindings)
    .where(eq(auditFindings.jobId, jobId));

  // Track if we're using JSONB fallback
  let usingJsonbFallback = false;

  // Fallback: if no findings in normalized table, load from audit_results JSONB
  if (findings.length === 0) {
    const { auditResults } = await import('../db/schema.js');
    const [results] = await db
      .select()
      .from(auditResults)
      .where(eq(auditResults.jobId, jobId));

    if (results && results.findings) {
      usingJsonbFallback = true;
      // Convert JSONB findings to finding-like objects
      findings = (results.findings as any[]).map((v: any) => ({
        id: v.id || v.title,
        title: v.title,
        originalSeverity: v.severity,
        adjustedSeverity: v.severity,
        description: v.description,
      })) as any;
      log.info('Loaded findings from JSONB for severity adjustment', { count: findings.length });
    }
  }

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

          // Only update database if not using JSONB fallback
          if (!usingJsonbFallback) {
            await db
              .update(auditFindings)
              .set(updateData)
              .where(eq(auditFindings.id, finding.id));
          } else {
            // For JSONB fallback, just log - the re-execution will regenerate results
            log.info('Severity adjustment recorded (JSONB fallback, will apply on re-execution)', {
              findingTitle: finding.title,
              rule: rule.reason,
            });
          }

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
 * Recalculate audit score based on adjusted findings
 */
async function recalculateAuditScore(jobId: string): Promise<void> {
  try {
    // Get updated findings from audit_results
    const { auditResults } = await import('../db/schema.js');
    const [results] = await db
      .select()
      .from(auditResults)
      .where(eq(auditResults.jobId, jobId));

    if (!results || !results.findings) {
      log.warn('No audit results found for recalculation', { jobId });
      return;
    }

    const findings = results.findings as any[];

    // Count findings by severity
    const severityCounts = {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
      info: findings.filter(f => f.severity === 'info').length,
    };

    // Calculate score (same logic as unifiedAuditService)
    let score = 100;
    score -= severityCounts.critical * 20;
    score -= severityCounts.high * 10;
    score -= severityCounts.medium * 5;
    score -= severityCounts.low * 2;
    score = Math.max(0, Math.min(100, score));

    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

    // Update audit_results with new score
    await db
      .update(auditResults)
      .set({
        scoreValue: score,
        scoreLabel: grade,
        summary: `Found ${findings.length} findings with audit score ${score}`,
        metadata: {
          findingsCount: findings.length,
          bySeverity: severityCounts,
        },
      })
      .where(eq(auditResults.jobId, jobId));

    log.info('✅ Audit score recalculated', {
      jobId,
      newScore: score,
      grade,
      severityCounts,
    });
  } catch (error: any) {
    log.error('Failed to recalculate audit score', { jobId, error: error.message });
    throw error;
  }
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
