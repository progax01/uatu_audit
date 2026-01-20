import { db } from '../db/index.js';
import { auditResults, auditJobs, auditClarifications } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { calculateWeightedScore, adjustSeverityForDisclosure } from './scoringService.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'rescoreService' });

/**
 * Re-score audit results based on disclosed information from clarifications
 * This applies severity adjustments for admin controls that were transparently disclosed
 */
export async function rescoreWithDisclosure(jobId: string): Promise<void> {
  log.info('Starting re-score with disclosure', { jobId });

  try {
    // Get audit results
    const [result] = await db
      .select()
      .from(auditResults)
      .where(eq(auditResults.jobId, jobId));

    if (!result) {
      log.warn('No audit results found for re-scoring', { jobId });
      return;
    }

    // Get all clarifications (both pre-audit and post-audit)
    const allClarifications = await db
      .select()
      .from(auditClarifications)
      .where(eq(auditClarifications.jobId, jobId));

    // Extract disclosed admin privileges from pre-audit questionnaire
    const preAuditAnswers = allClarifications.filter(c => c.phase === 'pre_audit' && c.status === 'answered');
    const disclosedAdminPrivileges: string[] = [];

    for (const clarification of preAuditAnswers) {
      if (clarification.answerValue) {
        // Handle different answer formats
        if (Array.isArray(clarification.answerValue)) {
          disclosedAdminPrivileges.push(...clarification.answerValue);
        } else if (typeof clarification.answerValue === 'object' && 'value' in clarification.answerValue) {
          const value = (clarification.answerValue as any).value;
          if (Array.isArray(value)) {
            disclosedAdminPrivileges.push(...value);
          } else if (typeof value === 'string') {
            disclosedAdminPrivileges.push(value);
          }
        } else if (typeof clarification.answerValue === 'string') {
          disclosedAdminPrivileges.push(clarification.answerValue);
        }
      }
    }

    log.info('Extracted disclosed admin privileges', {
      jobId,
      privilegeCount: disclosedAdminPrivileges.length,
      privileges: disclosedAdminPrivileges
    });

    // Get post-audit triage answers for additional context
    const triageAnswers = allClarifications.filter(c => c.phase === 'post_audit' && c.status === 'answered');

    log.info('Loaded triage answers', {
      jobId,
      triageCount: triageAnswers.length
    });

    // Parse findings from result
    const originalFindings = Array.isArray(result.findings) ? result.findings : [];

    if (originalFindings.length === 0) {
      log.warn('No findings to re-score', { jobId });
      return;
    }

    // Apply disclosure adjustments to findings
    const adjustedFindings = originalFindings.map(finding =>
      adjustSeverityForDisclosure(finding, disclosedAdminPrivileges)
    );

    // Count how many findings were adjusted
    const adjustedCount = adjustedFindings.filter((f, i) =>
      f.severity !== originalFindings[i].severity
    ).length;

    log.info('Applied disclosure adjustments to findings', {
      jobId,
      totalFindings: originalFindings.length,
      adjustedFindings: adjustedCount,
      disclosedPrivileges: disclosedAdminPrivileges.length
    });

    // Recalculate score with disclosure awareness
    const newScore = calculateWeightedScore(
      adjustedFindings,
      null, // liability map (not used here)
      0.2, // external weight factor
      disclosedAdminPrivileges
    );

    log.info('Recalculated score', {
      jobId,
      oldScore: result.scoreValue,
      newScore: newScore.value,
      oldGrade: result.scoreLabel,
      newGrade: newScore.grade
    });

    // Prepare metadata
    const updatedMetadata = {
      ...(result.metadata || {}),
      rescored: true,
      rescoredAt: new Date().toISOString(),
      disclosedPrivileges: disclosedAdminPrivileges.length,
      adjustedFindings: adjustedCount,
      originalScore: result.scoreValue,
      originalGrade: result.scoreLabel,
      triageAnswers: triageAnswers.length
    };

    // Update audit results with adjusted findings and new score
    await db.update(auditResults)
      .set({
        findings: adjustedFindings as any,
        scoreValue: newScore.value,
        scoreLabel: newScore.grade,
        metadata: updatedMetadata
      })
      .where(eq(auditResults.jobId, jobId));

    log.info('Re-scoring completed successfully', {
      jobId,
      scoreChange: newScore.value - (result.scoreValue || 0),
      gradeChange: `${result.scoreLabel} → ${newScore.grade}`
    });

  } catch (error) {
    log.error('Failed to re-score audit with disclosure', { jobId, error });
    throw error;
  }
}
