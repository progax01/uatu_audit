/**
 * Clean Corrupted Audit
 *
 * Removes all clarifications, verifications, and results for a specific audit
 * that has corrupted data (0 findings but clarifications exist).
 *
 * Usage:
 *   npx tsx src/db/clean-corrupted-audit.ts <jobId>
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import {
  auditJobs,
  auditClarifications,
  clarificationVerifications,
  auditResults,
  auditStepProgress,
  auditSopExecution
} from './schema.js';

const jobId = process.argv[2];

if (!jobId) {
  console.error('❌ Usage: npx tsx src/db/clean-corrupted-audit.ts <jobId>');
  process.exit(1);
}

async function cleanCorruptedAudit() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('azure.com') ? { rejectUnauthorized: false } : undefined,
  });

  const db = drizzle(pool);

  console.log('🧹 Cleaning corrupted audit:', jobId);
  console.log('');

  // Check if job exists
  const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, jobId));

  if (!job) {
    console.error('❌ Audit not found:', jobId);
    await pool.end();
    process.exit(1);
  }

  console.log('📋 Current state:');
  console.log('  Status:', job.status);
  console.log('  Created:', job.createdAt);
  console.log('');

  // Delete clarifications
  const deletedClarifications = await db
    .delete(auditClarifications)
    .where(eq(auditClarifications.jobId, jobId))
    .returning();

  console.log('✅ Deleted clarifications:', deletedClarifications.length);

  // Delete verification records
  const deletedVerifications = await db
    .delete(clarificationVerifications)
    .where(eq(clarificationVerifications.jobId, jobId))
    .returning();

  console.log('✅ Deleted verifications:', deletedVerifications.length);

  // Delete audit results
  const deletedResults = await db
    .delete(auditResults)
    .where(eq(auditResults.jobId, jobId))
    .returning();

  console.log('✅ Deleted audit results:', deletedResults.length);

  // Delete step progress
  const deletedProgress = await db
    .delete(auditStepProgress)
    .where(eq(auditStepProgress.jobId, jobId))
    .returning();

  console.log('✅ Deleted step progress records:', deletedProgress.length);

  // Delete SOP execution
  const deletedExecution = await db
    .delete(auditSopExecution)
    .where(eq(auditSopExecution.jobId, jobId))
    .returning();

  console.log('✅ Deleted SOP execution records:', deletedExecution.length);

  // Reset job to failed state so user can start fresh
  await db
    .update(auditJobs)
    .set({
      status: 'failed',
      errorMessage: 'Cleaned corrupted audit - ready for fresh run',
      currentStepId: null,
    })
    .where(eq(auditJobs.id, jobId));

  console.log('✅ Reset job to failed state');
  console.log('');
  console.log('🎉 Audit cleaned successfully!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Go to your projects page');
  console.log('  2. Start a fresh audit (NOT retry)');
  console.log('  3. Let it complete fully');
  console.log('  4. Then submit clarifications if needed');

  await pool.end();
  process.exit(0);
}

cleanCorruptedAudit().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
