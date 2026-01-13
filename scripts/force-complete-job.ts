import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { auditJobs } from '../src/db/schema';

async function forceCompleteJob() {
  const jobId = process.argv[2];

  if (!jobId) {
    console.error('Usage: npx tsx scripts/force-complete-job.ts <job-id>');
    process.exit(1);
  }

  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('Connecting to database...');

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('azure.com') ? { rejectUnauthorized: false } : undefined,
  });

  const db = drizzle(pool);

  try {
    // Get current job state
    const [job] = await db.select().from(auditJobs).where(eq(auditJobs.id, jobId)).limit(1);

    if (!job) {
      console.error('Job not found:', jobId);
      process.exit(1);
    }

    console.log('Current job state:');
    console.log('  ID:', job.id);
    console.log('  Status:', job.status);
    console.log('  Progress:', job.progressPct + '%');
    console.log('  CompletedAt:', job.completedAt);
    console.log('  ContractName:', job.contractName);

    // Force complete the job
    const [updated] = await db.update(auditJobs)
      .set({
        status: 'completed',
        progressPct: 100,
        progressMessage: 'Scan complete (force-completed)',
        completedAt: job.completedAt || new Date(),
      })
      .where(eq(auditJobs.id, jobId))
      .returning();

    console.log('\nJob force-completed successfully:');
    console.log('  Status:', updated.status);
    console.log('  Progress:', updated.progressPct + '%');
    console.log('  CompletedAt:', updated.completedAt);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

forceCompleteJob();
