/**
 * Stuck Job Detector
 *
 * Detects and recovers jobs that are stuck in "running" state but have no active process.
 *
 * A job is considered stuck ONLY if:
 * 1. Status is "running" but startedAt is NULL for > 5 minutes (initialization failure)
 * 2. Status is "running" but step data hasn't been updated in > 10 minutes (process crashed/hung)
 *
 * We check step data file modification time to detect active processes.
 * This is more reliable than grepping for process IDs which don't contain job IDs.
 *
 * IMPORTANT: Stuck jobs are reset to "pending" for recovery, NOT marked as failed.
 * This allows them to be resumed from their last step using existing workspace data.
 */

import { eq, and, lt, isNull, inArray, sql } from 'drizzle-orm';
import { stat } from 'fs/promises';
import path from 'path';
import { getDb } from '../db';
import { auditJobs, type JobStatus } from '../db/schema';
import { logger } from '../utils/logger';

const log = logger.child({ service: 'stuck-job-detector' });

interface StuckJobDetectionResult {
  jobId: string;
  reason: string;
  stuckDuration: number; // minutes
  currentStep?: string;
  progressPct: number;
  canRecover: boolean; // Whether job can be resumed from step data
}

/**
 * Check if an audit process is actively working by checking step data file modification time
 * This is more reliable than grepping for process IDs which don't contain job IDs
 */
async function isProcessActivelyWorking(projectPath: string, jobId: string): Promise<{
  isActive: boolean;
  lastActivityMinutesAgo: number;
  stepDataExists: boolean;
}> {
  try {
    const stepDataPath = path.join(projectPath, '.uatu', 'stepData.json');
    const stats = await stat(stepDataPath);

    const now = Date.now();
    const lastModified = stats.mtimeMs;
    const minutesAgo = Math.floor((now - lastModified) / 60000);

    // If step data was modified in last 10 minutes, assume process is actively working
    const isActive = minutesAgo < 10;

    log.debug(`Step data check for job ${jobId}`, {
      stepDataPath,
      lastModified: new Date(lastModified).toISOString(),
      minutesAgo,
      isActive
    });

    return {
      isActive,
      lastActivityMinutesAgo: minutesAgo,
      stepDataExists: true
    };
  } catch (error: any) {
    // Step data file doesn't exist or can't be accessed
    log.debug(`No step data found for job ${jobId}`, {
      projectPath,
      error: error.message
    });

    return {
      isActive: false,
      lastActivityMinutesAgo: 999,
      stepDataExists: false
    };
  }
}

/**
 * Detect all stuck jobs in the database by checking step data activity
 */
export async function detectStuckJobs(): Promise<StuckJobDetectionResult[]> {
  const db = getDb();
  const now = new Date();
  const stuckJobs: StuckJobDetectionResult[] = [];

  // Find all jobs that claim to be running
  const runningJobs = await db
    .select()
    .from(auditJobs)
    .where(
      inArray(auditJobs.status, ['running', 'queued', 'cloning', 'analyzing', 'auditing', 'generating'] as JobStatus[])
    );

  log.info(`Checking ${runningJobs.length} potentially running jobs for stuck state`);

  for (const job of runningJobs) {
    // Check 1: Status is "running" but startedAt is NULL (initialization failure)
    if (!job.startedAt) {
      const createdTime = new Date(job.createdAt).getTime();
      const stuckMinutes = Math.floor((now.getTime() - createdTime) / 60000);

      // If created more than 5 minutes ago and still no startedAt, it's stuck
      if (stuckMinutes > 5) {
        stuckJobs.push({
          jobId: job.id,
          reason: 'Initialization failure - startedAt is NULL after 5 minutes',
          stuckDuration: stuckMinutes,
          currentStep: job.currentStepName || undefined,
          progressPct: job.progressPct,
          canRecover: false, // Can't recover if initialization failed
        });
        continue;
      }
    }

    // Check 2: Verify process is actively working by checking step data
    if (job.startedAt && job.projectPath) {
      // IMPORTANT: Skip stuck detection for jobs waiting for user input
      // These steps can wait for hours/days without step data updates
      const waitingForUserSteps = [
        'wait-for-questionnaire-answers',
        'wait-for-clarification-answers',
        'interactive-review',
        'manual-approval'
      ];

      const isWaitingForUser = job.currentStepName && waitingForUserSteps.some(
        stepName => job.currentStepName?.toLowerCase().includes(stepName.toLowerCase())
      );

      if (isWaitingForUser) {
        log.debug(`Job ${job.id} is waiting for user input - skipping stuck detection`, {
          currentStep: job.currentStepName,
          progress: job.progressPct
        });
        continue;
      }

      const activity = await isProcessActivelyWorking(job.projectPath, job.id);

      if (!activity.isActive) {
        // Process is not actively working
        const startedTime = new Date(job.startedAt).getTime();
        const totalRuntime = Math.floor((now.getTime() - startedTime) / 60000);

        // Only consider it stuck if it's been inactive for a while AND has been running long enough
        // This prevents false positives for jobs that just started
        if (activity.lastActivityMinutesAgo >= 10 && totalRuntime >= 5) {
          stuckJobs.push({
            jobId: job.id,
            reason: `No activity for ${activity.lastActivityMinutesAgo} minutes (process crashed or hung)`,
            stuckDuration: activity.lastActivityMinutesAgo,
            currentStep: job.currentStepName || undefined,
            progressPct: job.progressPct,
            canRecover: activity.stepDataExists, // Can recover if step data exists
          });

          log.warn(`Job ${job.id} appears stuck - no step data activity`, {
            currentStep: job.currentStepName,
            progress: job.progressPct,
            lastActivityMinutesAgo: activity.lastActivityMinutesAgo,
            totalRuntime
          });
        } else {
          log.debug(`Job ${job.id} inactive but recently started - giving it more time`, {
            currentStep: job.currentStepName,
            totalRuntime,
            lastActivityMinutesAgo: activity.lastActivityMinutesAgo
          });
        }
      } else {
        log.debug(`Job ${job.id} is actively working`, {
          currentStep: job.currentStepName,
          progress: job.progressPct,
          lastActivityMinutesAgo: activity.lastActivityMinutesAgo
        });
      }
    }
  }

  if (stuckJobs.length > 0) {
    log.warn(`Found ${stuckJobs.length} stuck jobs (no active processes)`, {
      stuckJobs: stuckJobs.map(j => ({
        jobId: j.jobId,
        reason: j.reason,
        canRecover: j.canRecover
      }))
    });
  } else {
    log.info('No stuck jobs detected - all running jobs are actively working');
  }

  return stuckJobs;
}

/**
 * Recover a stuck job by resetting to pending (for resumption) or marking as failed
 *
 * If the job has step data, it's reset to "pending" so the database worker can resume it.
 * If the job can't be recovered, it's marked as "failed" with diagnostic info.
 */
export async function recoverStuckJob(
  jobId: string,
  reason: string,
  canRecover: boolean,
  currentStep?: string
): Promise<void> {
  const db = getDb();

  if (canRecover) {
    // Reset to pending so database worker can resume from step data
    await db
      .update(auditJobs)
      .set({
        status: 'pending',
        updatedAt: new Date(),
        // Keep errorMessage cleared so it doesn't confuse the UI
        errorMessage: null,
      })
      .where(eq(auditJobs.id, jobId));

    log.info(`Reset stuck job ${jobId} to pending for recovery`, {
      reason,
      currentStep,
      message: 'Job will be resumed from last step by database worker'
    });
  } else {
    // Can't recover - mark as failed with user-friendly message
    const errorMessage = currentStep
      ? `Audit incomplete. Last step: ${currentStep}. Please retry the audit.`
      : `Audit initialization incomplete. Please retry the audit.`;

    await db
      .update(auditJobs)
      .set({
        status: 'failed',
        errorMessage,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(auditJobs.id, jobId));

    log.warn(`Marked job ${jobId} as failed (cannot recover)`, { reason, currentStep });
  }
}

/**
 * Detect and recover all stuck jobs
 * This should be run periodically by the daemon (e.g., every 5 minutes)
 *
 * Jobs with step data are reset to "pending" for automatic recovery.
 * Jobs without step data (initialization failures) are marked as "failed".
 */
export async function detectAndRecoverStuckJobs(): Promise<{
  detected: number;
  recovered: number;
  resetToPending: number;
  markedFailed: number;
}> {
  const stuckJobs = await detectStuckJobs();

  if (stuckJobs.length === 0) {
    return { detected: 0, recovered: 0, resetToPending: 0, markedFailed: 0 };
  }

  log.warn(`Found ${stuckJobs.length} stuck jobs - attempting recovery`);

  let recovered = 0;
  let resetToPending = 0;
  let markedFailed = 0;

  for (const stuck of stuckJobs) {
    try {
      await recoverStuckJob(stuck.jobId, stuck.reason, stuck.canRecover, stuck.currentStep);
      recovered++;

      if (stuck.canRecover) {
        resetToPending++;
      } else {
        markedFailed++;
      }
    } catch (error) {
      log.error(`Failed to recover stuck job ${stuck.jobId}`, { error });
    }
  }

  log.info(`Stuck job recovery complete`, {
    detected: stuckJobs.length,
    recovered,
    resetToPending,
    markedFailed,
    message: `${resetToPending} jobs reset to pending for automatic resume, ${markedFailed} jobs marked as failed`
  });

  return { detected: stuckJobs.length, recovered, resetToPending, markedFailed };
}

/**
 * Get human-readable time duration
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minutes`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

/**
 * Check if a specific job is stuck
 */
export async function isJobStuck(jobId: string): Promise<boolean> {
  const stuckJobs = await detectStuckJobs();
  return stuckJobs.some((j) => j.jobId === jobId);
}
