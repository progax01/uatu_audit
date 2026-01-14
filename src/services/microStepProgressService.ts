/**
 * Micro-Step Progress Service
 *
 * Database service for tracking granular audit progress.
 * Provides real-time step-level progress updates.
 */

import { eq, and, desc, asc } from 'drizzle-orm';
import { db } from '../db';
import {
  auditJobs,
  auditStepProgress,
  auditSopExecution,
  toolExecutionLogs,
} from '../db/schema';
import type { StepDefinition, AuditDepth, StepStatus } from '../sops/definitions/types';
import { logger } from '../utils/logger';

const log = logger.child({ module: 'micro-step-progress' });

// ============================================================================
// Types
// ============================================================================

export interface StepProgressRecord {
  id: string;
  jobId: string;
  stepId: string;
  stepName: string;
  stepCategory: string;
  status: StepStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  internalPct: number;
  internalMessage: string | null;
  outputSummary: any;
  errorMessage: string | null;
  orderIndex: number;
  retryCount: number;
}

export interface SOPExecutionRecord {
  id: string;
  jobId: string;
  sopId: string;
  sopVersion: string;
  auditDepth: string;
  detectedFramework: string | null;
  detectedLanguage: string | null;
  totalSteps: number;
  completedSteps: number;
  availableTools: string[];
  estimatedDurationMinutes: number | null;
  actualDurationMinutes: number | null;
}

export interface ProgressSummary {
  jobId: string;
  status: string;
  overallPct: number;
  currentStep: {
    id: string;
    name: string;
    pct: number;
    message: string;
  } | null;
  steps: Array<{
    id: string;
    name: string;
    status: StepStatus;
    durationMs: number | null;
    pct: number;
    message: string | null;
  }>;
  completedSteps: number;
  totalSteps: number;
  elapsedSeconds: number;
  estimatedRemainingSeconds: number | null;
}

// ============================================================================
// Service Class
// ============================================================================

export class MicroStepProgressService {
  private jobId: string;
  private startTime: number;

  constructor(jobId: string) {
    this.jobId = jobId;
    this.startTime = Date.now();
  }

  /**
   * Initialize step progress records for a job
   */
  async initializeSteps(
    jobId: string,
    steps: StepDefinition[],
    sopId: string,
    sopVersion: string,
    auditDepth: AuditDepth,
    availableTools: string[]
  ): Promise<void> {
    log.debug('Initializing step progress', {
      jobId,
      stepCount: steps.length,
      sopId,
    });

    // Create SOP execution record
    await db.insert(auditSopExecution).values({
      id: crypto.randomUUID(),
      jobId,
      sopId,
      sopVersion,
      auditDepth,
      totalSteps: steps.length,
      completedSteps: 0,
      availableTools,
    });

    // Create step progress records
    const stepRecords = steps.map((step, index) => ({
      id: crypto.randomUUID(),
      jobId,
      stepId: step.id,
      stepName: step.name,
      stepCategory: getStepCategory(step),
      status: 'pending' as const,
      orderIndex: index,
      internalPct: 0,
      retryCount: 0,
    }));

    await db.insert(auditStepProgress).values(stepRecords);

    // Update job with SOP info
    await db
      .update(auditJobs)
      .set({
        sopId,
        sopVersion,
        auditDepth,
        stepsTotal: steps.length,
        stepsCompleted: 0,
      })
      .where(eq(auditJobs.id, jobId));

    log.info('Step progress initialized', {
      jobId,
      stepCount: steps.length,
    });
  }

  /**
   * Update step status
   */
  async updateStepStatus(
    jobId: string,
    stepId: string,
    status: StepStatus,
    durationMs?: number,
    errorMessage?: string
  ): Promise<void> {
    const updates: Record<string, any> = {
      status,
    };

    if (status === 'running') {
      updates.startedAt = new Date();
    }

    if (status === 'completed' || status === 'failed') {
      updates.completedAt = new Date();
      if (durationMs !== undefined) {
        updates.durationMs = durationMs;
      }
    }

    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }

    await db
      .update(auditStepProgress)
      .set(updates)
      .where(
        and(
          eq(auditStepProgress.jobId, jobId),
          eq(auditStepProgress.stepId, stepId)
        )
      );

    // Update current step on job if running
    if (status === 'running') {
      const [stepRecord] = await db.select()
        .from(auditStepProgress)
        .where(and(
          eq(auditStepProgress.jobId, jobId),
          eq(auditStepProgress.stepId, stepId)
        ));

      await db
        .update(auditJobs)
        .set({
          currentStepId: stepId,
          currentStepName: stepRecord?.stepName,
        })
        .where(eq(auditJobs.id, jobId));
    }

    // Update completed count if completed
    if (status === 'completed') {
      const [sopExec] = await db.select()
        .from(auditSopExecution)
        .where(eq(auditSopExecution.jobId, jobId));

      if (sopExec) {
        await db
          .update(auditSopExecution)
          .set({
            completedSteps: (sopExec.completedSteps || 0) + 1,
          })
          .where(eq(auditSopExecution.jobId, jobId));

        await db
          .update(auditJobs)
          .set({
            stepsCompleted: (sopExec.completedSteps || 0) + 1,
          })
          .where(eq(auditJobs.id, jobId));
      }
    }

    log.debug('Step status updated', { jobId, stepId, status });
  }

  /**
   * Update step internal progress
   */
  async updateStepProgress(
    jobId: string,
    stepId: string,
    pct: number,
    message?: string
  ): Promise<void> {
    const updates: Record<string, any> = {
      internalPct: Math.min(100, Math.max(0, Math.round(pct))),
    };

    if (message) {
      updates.internalMessage = message;
    }

    await db
      .update(auditStepProgress)
      .set(updates)
      .where(
        and(
          eq(auditStepProgress.jobId, jobId),
          eq(auditStepProgress.stepId, stepId)
        )
      );
  }

  /**
   * Update overall job progress
   */
  async updateOverallProgress(jobId: string, pct: number): Promise<void> {
    await db
      .update(auditJobs)
      .set({
        progressPct: Math.min(100, Math.max(0, Math.round(pct))),
      })
      .where(eq(auditJobs.id, jobId));
  }

  /**
   * Increment retry count for a step
   */
  async incrementRetry(jobId: string, stepId: string): Promise<void> {
    const [stepRecord] = await db.select()
      .from(auditStepProgress)
      .where(and(
        eq(auditStepProgress.jobId, jobId),
        eq(auditStepProgress.stepId, stepId)
      ));

    if (stepRecord) {
      await db
        .update(auditStepProgress)
        .set({
          retryCount: (stepRecord.retryCount || 0) + 1,
        })
        .where(eq(auditStepProgress.id, stepRecord.id));
    }
  }

  /**
   * Log tool execution details
   */
  async logToolExecution(
    stepProgressId: string,
    toolName: string,
    details: {
      toolVersion?: string;
      command?: string;
      exitCode?: number;
      stdout?: string;
      stderr?: string;
      findingsCount?: number;
      executionTimeMs?: number;
    }
  ): Promise<void> {
    await db.insert(toolExecutionLogs).values({
      id: crypto.randomUUID(),
      stepProgressId,
      toolName,
      toolVersion: details.toolVersion,
      command: details.command,
      exitCode: details.exitCode,
      stdout: details.stdout,
      stderr: details.stderr,
      findingsCount: details.findingsCount,
      executionTimeMs: details.executionTimeMs,
    });
  }

  /**
   * Update SOP execution metadata
   */
  async updateSOPExecution(
    jobId: string,
    updates: Partial<{
      detectedFramework: string;
      detectedLanguage: string;
      estimatedDurationMinutes: number;
      actualDurationMinutes: number;
    }>
  ): Promise<void> {
    await db
      .update(auditSopExecution)
      .set(updates)
      .where(eq(auditSopExecution.jobId, jobId));

    // Also update job if framework detected
    if (updates.detectedFramework) {
      await db
        .update(auditJobs)
        .set({
          detectedFramework: updates.detectedFramework,
        })
        .where(eq(auditJobs.id, jobId));
    }
  }

  /**
   * Get full progress summary for a job
   */
  async getProgressSummary(jobId: string): Promise<ProgressSummary | null> {
    const [job] = await db.select()
      .from(auditJobs)
      .where(eq(auditJobs.id, jobId));

    if (!job) {
      return null;
    }

    const steps = await db.select()
      .from(auditStepProgress)
      .where(eq(auditStepProgress.jobId, jobId))
      .orderBy(asc(auditStepProgress.orderIndex));

    const [sopExec] = await db.select()
      .from(auditSopExecution)
      .where(eq(auditSopExecution.jobId, jobId));

    // Find current running step
    const runningStep = steps.find((s: typeof steps[number]) => s.status === 'running');

    // Calculate elapsed time
    const startTime = job.createdAt ? new Date(job.createdAt).getTime() : Date.now();
    const elapsedMs = Date.now() - startTime;

    // Estimate remaining time
    let estimatedRemainingSeconds: number | null = null;
    const completedSteps = steps.filter((s: typeof steps[number]) => s.status === 'completed').length;

    if (completedSteps > 0 && sopExec) {
      const avgTimePerStep = elapsedMs / completedSteps;
      const remainingSteps = (sopExec.totalSteps || 0) - completedSteps;
      estimatedRemainingSeconds = Math.round((avgTimePerStep * remainingSteps) / 1000);
    }

    return {
      jobId,
      status: job.status || 'unknown',
      overallPct: job.progressPct || 0,
      currentStep: runningStep
        ? {
            id: runningStep.stepId,
            name: runningStep.stepName,
            pct: runningStep.internalPct || 0,
            message: runningStep.internalMessage || '',
          }
        : null,
      steps: steps.map((s: typeof steps[number]) => ({
        id: s.stepId,
        name: s.stepName,
        status: s.status as StepStatus,
        durationMs: s.durationMs ? Number(s.durationMs) : null,
        pct: s.status === 'completed' ? 100 : s.internalPct || 0,
        message: s.internalMessage,
      })),
      completedSteps,
      totalSteps: sopExec?.totalSteps || steps.length,
      elapsedSeconds: Math.round(elapsedMs / 1000),
      estimatedRemainingSeconds,
    };
  }

  /**
   * Get step progress for a specific step
   */
  async getStepProgress(jobId: string, stepId: string): Promise<StepProgressRecord | null> {
    const [record] = await db.select()
      .from(auditStepProgress)
      .where(and(
        eq(auditStepProgress.jobId, jobId),
        eq(auditStepProgress.stepId, stepId)
      ));

    if (!record) {
      return null;
    }

    return {
      id: record.id,
      jobId: record.jobId,
      stepId: record.stepId,
      stepName: record.stepName,
      stepCategory: record.stepCategory,
      status: record.status as StepStatus,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      durationMs: record.durationMs ? Number(record.durationMs) : null,
      internalPct: record.internalPct || 0,
      internalMessage: record.internalMessage,
      outputSummary: record.outputSummary,
      errorMessage: record.errorMessage,
      orderIndex: record.orderIndex,
      retryCount: record.retryCount || 0,
    };
  }

  /**
   * Mark job as complete
   */
  async markJobComplete(
    jobId: string,
    success: boolean,
    results?: {
      score?: number;
      findingsCount?: number;
      error?: string;
    }
  ): Promise<void> {
    const [sopExec] = await db.select()
      .from(auditSopExecution)
      .where(eq(auditSopExecution.jobId, jobId));

    const [job] = await db.select()
      .from(auditJobs)
      .where(eq(auditJobs.id, jobId));

    // Calculate actual duration
    const startTime = job?.createdAt ? new Date(job.createdAt).getTime() : Date.now();
    const actualDurationMinutes = Math.round((Date.now() - startTime) / 60000);

    // Update SOP execution
    if (sopExec) {
      await db
        .update(auditSopExecution)
        .set({
          actualDurationMinutes,
        })
        .where(eq(auditSopExecution.jobId, jobId));
    }

    // Update job
    await db
      .update(auditJobs)
      .set({
        status: success ? 'completed' : 'failed',
        progressPct: success ? 100 : job?.progressPct || 0,
        currentStepId: null,
        currentStepName: null,
        updatedAt: new Date(),
      })
      .where(eq(auditJobs.id, jobId));

    log.info('Job marked complete', {
      jobId,
      success,
      actualDurationMinutes,
      ...results,
    });
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getStepCategory(step: StepDefinition): string {
  // Categorize based on executor type and name patterns
  if (step.executor === 'tool') {
    return 'tool-analysis';
  }

  if (step.executor === 'ai-prompt') {
    return 'ai-analysis';
  }

  const id = step.id.toLowerCase();

  if (id.includes('detect') || id.includes('validate') || id.includes('enumerate')) {
    return 'initialization';
  }

  if (id.includes('parse') || id.includes('build') || id.includes('compile')) {
    return 'compilation';
  }

  if (id.includes('analyze') || id.includes('check') || id.includes('identify')) {
    return 'analysis';
  }

  if (id.includes('merge') || id.includes('deduplicate') || id.includes('calculate')) {
    return 'post-processing';
  }

  if (id.includes('report') || id.includes('generate')) {
    return 'reporting';
  }

  return 'other';
}

// ============================================================================
// Static Methods
// ============================================================================

/**
 * Create service instance for a job
 */
export function createProgressService(jobId: string): MicroStepProgressService {
  return new MicroStepProgressService(jobId);
}

/**
 * Get progress summary without service instance
 */
export async function getJobProgress(jobId: string): Promise<ProgressSummary | null> {
  const service = new MicroStepProgressService(jobId);
  return service.getProgressSummary(jobId);
}
