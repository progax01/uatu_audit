import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { auditJobs, auditResults } from '../src/db/schema';

async function deleteAudit() {
  const jobId = process.argv[2];

  if (!jobId) {
    console.error('Usage: npx tsx scripts/delete-audit.ts <job-id>');
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

    console.log('Found audit job:');
    console.log('  ID:', job.id);
    console.log('  Contract:', job.contractName);
    console.log('  Network:', job.contractNetwork);
    console.log('  Status:', job.status);

    // Delete audit results first (foreign key constraint)
    const deletedResults = await db.delete(auditResults)
      .where(eq(auditResults.jobId, jobId))
      .returning();
    console.log(`\nDeleted ${deletedResults.length} audit result(s)`);

    // Delete the job
    const deletedJobs = await db.delete(auditJobs)
      .where(eq(auditJobs.id, jobId))
      .returning();
    console.log(`Deleted ${deletedJobs.length} audit job(s)`);

    console.log('\nAudit deleted successfully!');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

deleteAudit();
