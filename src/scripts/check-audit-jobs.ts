import 'dotenv/config';
import { db } from '../db/index.js';
import { auditJobs, auditResults } from '../db/schema.js';
import { desc, eq } from 'drizzle-orm';

async function checkAuditJobs() {
  try {
    console.log('🔍 Checking for recent audit jobs...\n');

    const jobs = await db
      .select({
        id: auditJobs.id,
        projectId: auditJobs.projectId,
        status: auditJobs.status,
        createdAt: auditJobs.createdAt,
      })
      .from(auditJobs)
      .orderBy(desc(auditJobs.createdAt))
      .limit(5);

    if (jobs.length === 0) {
      console.log('❌ No audit jobs found in database');
      console.log('\n💡 Suggestion: Run an audit first, then test the verification system');
      process.exit(0);
    }

    console.log(`✅ Found ${jobs.length} audit jobs:\n`);

    for (const job of jobs) {
      console.log(`Job ID: ${job.id}`);
      console.log(`  Status: ${job.status}`);
      console.log(`  Created: ${job.createdAt}`);

      // Check if job has findings
      const results = await db
        .select()
        .from(auditResults)
        .where(eq(auditResults.jobId, job.id))
        .limit(1);

      if (results.length > 0 && results[0].findings) {
        const findings = results[0].findings as any[];
        console.log(`  Findings: ${findings.length}`);

        const criticalHigh = findings.filter(f =>
          f.severity === 'critical' || f.severity === 'high'
        ).length;
        console.log(`  Critical/High: ${criticalHigh}`);
      }
      console.log('');
    }

    // Check for completed jobs with findings
    const completedJobs = jobs.filter(j => j.status === 'completed');
    if (completedJobs.length > 0) {
      console.log(`\n✅ ${completedJobs.length} completed job(s) available for testing`);
      console.log(`\n💡 Use job ID: ${completedJobs[0].id} for testing`);
    } else {
      console.log('\n⚠️  No completed jobs found. Test with an in-progress or pending job.');
    }

  } catch (error: any) {
    console.error('Error checking audit jobs:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

checkAuditJobs();
