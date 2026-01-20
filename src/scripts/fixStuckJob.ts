#!/usr/bin/env node
/**
 * Fix Stuck Job Script
 *
 * Marks a stuck job as failed and implements checks for detecting stuck jobs
 */

import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { auditJobs } from '../db/schema';

const STUCK_JOB_ID = '526713fa-e4d3-4295-8e12-c93defd3d117';

async function fixStuckJob() {
  const db = getDb();

  console.log(`\n🔍 Checking stuck job: ${STUCK_JOB_ID}\n`);

  // Get current job state
  const [job] = await db
    .select()
    .from(auditJobs)
    .where(eq(auditJobs.id, STUCK_JOB_ID))
    .limit(1);

  if (!job) {
    console.error('❌ Job not found in database');
    process.exit(1);
  }

  console.log('Current job state:');
  console.log('  Status:', job.status);
  console.log('  Progress:', `${job.progressPct}%`);
  console.log('  Current step:', job.currentStepName || 'N/A');
  console.log('  Started at:', job.startedAt || 'NULL (red flag!)');
  console.log('  Created at:', job.createdAt);
  console.log('  Steps completed:', `${job.stepsCompleted || 0}/${job.stepsTotal || 0}`);

  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
    console.log('\n✅ Job is already in terminal state:', job.status);
    process.exit(0);
  }

  // Calculate how long it's been since creation
  const createdTime = new Date(job.createdAt).getTime();
  const now = Date.now();
  const hoursStuck = ((now - createdTime) / (1000 * 60 * 60)).toFixed(1);

  console.log(`\n⚠️  Job has been stuck for ${hoursStuck} hours`);
  console.log('⚠️  No active process found (verified by user)');
  console.log('⚠️  Marking job as failed...\n');

  // Mark job as failed
  await db
    .update(auditJobs)
    .set({
      status: 'failed',
      errorMessage: `Job stuck at "${job.currentStepName || 'unknown step'}" - no active process detected. Possible causes: Docker container died, Slither hung, or Claude session terminated unexpectedly.`,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(auditJobs.id, STUCK_JOB_ID));

  console.log('✅ Job marked as failed');
  console.log('✅ Error message set with diagnostic info');
  console.log('✅ Completed timestamp set');

  // Verify the update
  const [updatedJob] = await db
    .select()
    .from(auditJobs)
    .where(eq(auditJobs.id, STUCK_JOB_ID))
    .limit(1);

  console.log('\nUpdated job state:');
  console.log('  Status:', updatedJob.status);
  console.log('  Error:', updatedJob.errorMessage?.substring(0, 100) + '...');
  console.log('  Completed at:', updatedJob.completedAt);

  console.log('\n✅ Done! Job has been marked as failed.\n');
}

// Run the fix
fixStuckJob().catch((error) => {
  console.error('❌ Error fixing stuck job:', error);
  process.exit(1);
});
