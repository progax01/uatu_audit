/**
 * Database Queue Worker
 *
 * Processes pending audits from the database (audit_jobs table).
 * Unlike the old JSON file queue worker, this processes the unified audit system jobs.
 */

import { eq, and, or, isNull, sql } from 'drizzle-orm';
import { db } from '../db';
import { auditJobs, type JobStatus } from '../db/schema';
import { logger } from '../utils/logger';
import { UnifiedAuditService } from '../services/unifiedAuditService';

const log = logger.child({ module: 'database-worker' });

/**
 * Start database queue worker
 * Continuously polls for pending database jobs and processes them
 */
export async function startDatabaseWorker(workerId: number) {
  const workerLog = log.child({ workerId });
  workerLog.info('Database worker started');

  while (true) {
    try {
      // Claim next pending job (atomic update to prevent race conditions)
      const job = await claimNextDatabaseJob();

      if (!job) {
        // No jobs available, wait before polling again
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      workerLog.info('Processing database audit job', {
        jobId: job.id,
        depth: job.auditDepth,
        framework: job.detectedFramework,
      });

      try {
        // Resume/continue the audit using UnifiedAuditService
        const service = UnifiedAuditService.getInstance();

        // The orchestrator will handle the rest - it's already designed to
        // work with existing jobs that have source code and SOP assigned
        await service.resumeAudit(job.id);

        workerLog.info('Database audit job completed', { jobId: job.id });
      } catch (error: any) {
        workerLog.error('Database audit job failed', {
          jobId: job.id,
          error: error.message,
          stack: error.stack,
        });

        // Mark job as failed
        await db
          .update(auditJobs)
          .set({
            status: 'failed',
            errorMessage: error.message,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(auditJobs.id, job.id));
      }
    } catch (error: any) {
      workerLog.error('Worker error', {
        error: error.message,
        stack: error.stack,
      });
      // Wait before retrying to avoid tight error loop
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

/**
 * Claim next pending job from database (atomic operation)
 */
async function claimNextDatabaseJob() {
  try {
    // First, check for stuck pending jobs without initialization (orphaned during startup)
    const orphanedJobs = await db
      .select()
      .from(auditJobs)
      .where(
        and(
          eq(auditJobs.status, 'pending'),
          or(
            isNull(auditJobs.projectPath),
            isNull(auditJobs.sopId)
          ),
          // Created more than 5 minutes ago
          sql`${auditJobs.createdAt} < NOW() - INTERVAL '5 minutes'`
        )
      )
      .limit(1);

    // Mark orphaned jobs as failed
    if (orphanedJobs.length > 0) {
      const orphan = orphanedJobs[0];
      log.warn('Found orphaned pending job without initialization', {
        jobId: orphan.id,
        createdAt: orphan.createdAt,
      });

      await db
        .update(auditJobs)
        .set({
          status: 'failed',
          errorMessage: 'Audit initialization incomplete. Please retry the audit.',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(auditJobs.id, orphan.id));
    }

    // Find and claim pending job that's ready to resume
    const [job] = await db
      .update(auditJobs)
      .set({
        status: 'running',
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(auditJobs.status, 'pending'),
          // Only pick up jobs that have source acquired and SOP assigned
          sql`${auditJobs.projectPath} IS NOT NULL`,
          sql`${auditJobs.sopId} IS NOT NULL`
        )
      )
      // Pick oldest pending job first (FIFO)
      .returning();

    return job || null;
  } catch (error: any) {
    log.error('Failed to claim database job', {
      error: error.message,
      stack: error.stack,
    });
    return null;
  }
}

/**
 * On startup, recover pending jobs that need processing
 */
export async function recoverPendingDatabaseJobs() {
  try {
    // Find all jobs that were running when server crashed
    const runningJobs = await db
      .select()
      .from(auditJobs)
      .where(
        and(
          eq(auditJobs.status, 'running'),
          // Only recover jobs that have started initialization (have source + SOP)
          sql`${auditJobs.projectPath} IS NOT NULL`,
          sql`${auditJobs.sopId} IS NOT NULL`
        )
      );

    if (runningJobs.length > 0) {
      log.info(`Found ${runningJobs.length} running jobs from previous session`);

      // Reset them to pending so workers can pick them up
      for (const job of runningJobs) {
        await db
          .update(auditJobs)
          .set({
            status: 'pending',
            updatedAt: new Date(),
          })
          .where(eq(auditJobs.id, job.id));

        log.info('Reset running job to pending for recovery', {
          jobId: job.id,
          currentStep: job.currentStepName,
          progress: job.progressPct,
        });
      }
    }

    // Also check for truly pending jobs (never started)
    const pendingJobs = await db
      .select()
      .from(auditJobs)
      .where(
        and(
          eq(auditJobs.status, 'pending'),
          sql`${auditJobs.projectPath} IS NOT NULL`,
          sql`${auditJobs.sopId} IS NOT NULL`
        )
      );

    const totalToRecover = runningJobs.length + pendingJobs.length;
    if (totalToRecover > 0) {
      log.info(`Queue recovery complete`, {
        runningRecovered: runningJobs.length,
        pendingFound: pendingJobs.length,
        totalReady: totalToRecover,
      });
    } else {
      log.info('No pending database jobs to recover');
    }

    return {
      runningRecovered: runningJobs.length,
      pendingFound: pendingJobs.length,
      totalReady: totalToRecover,
    };
  } catch (error: any) {
    log.error('Failed to recover pending database jobs', {
      error: error.message,
      stack: error.stack,
    });
    return {
      runningRecovered: 0,
      pendingFound: 0,
      totalReady: 0,
    };
  }
}
