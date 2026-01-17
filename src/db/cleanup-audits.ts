/**
 * Audit Cleanup Script
 *
 * Cleans up failed/stuck audits and their temporary directories.
 * Options:
 * - Delete all failed audits
 * - Mark stuck "running" audits as failed
 * - Clean up orphaned temp directories
 * - Keep only latest successful audit per commit SHA
 *
 * Usage:
 *   npx tsx src/db/cleanup-audits.ts --failed          # Delete failed audits
 *   npx tsx src/db/cleanup-audits.ts --stuck           # Mark stuck running audits as failed
 *   npx tsx src/db/cleanup-audits.ts --duplicates      # Keep only latest per commit
 *   npx tsx src/db/cleanup-audits.ts --temp            # Clean orphaned temp dirs
 *   npx tsx src/db/cleanup-audits.ts --all             # Do all of the above
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, inArray, and, or, isNull } from 'drizzle-orm';
import { auditJobs, auditResults, auditStepProgress, auditSopExecution } from './schema.js';
import fs from 'fs-extra';
import path from 'path';

const args = process.argv.slice(2);
const options = {
  failed: args.includes('--failed') || args.includes('--all'),
  stuck: args.includes('--stuck') || args.includes('--all'),
  duplicates: args.includes('--duplicates') || args.includes('--all'),
  temp: args.includes('--temp') || args.includes('--all'),
  dryRun: args.includes('--dry-run'),
};

async function cleanupAudits() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('🧹 Audit Cleanup Tool\n');

  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('azure.com') ? { rejectUnauthorized: false } : undefined,
  });

  const db = drizzle(pool);

  let totalDeleted = 0;
  let totalMarkedFailed = 0;
  let tempDirsRemoved = 0;

  // ============================================================================
  // 1. Mark stuck "running" audits as failed
  // ============================================================================
  if (options.stuck) {
    console.log('🔍 Checking for stuck "running" audits...');

    const stuckThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
    const stuckAudits = await db
      .select()
      .from(auditJobs)
      .where(
        and(
          eq(auditJobs.status, 'running'),
          // @ts-ignore - updatedAt might not be in type but exists in DB
          or(
            isNull(auditJobs.updatedAt),
            // SQL: updatedAt < stuckThreshold
          )
        )
      );

    // Filter stuck audits by checking updatedAt
    const reallyStuck = stuckAudits.filter((audit) => {
      if (!audit.updatedAt) return true;
      const updatedAt = new Date(audit.updatedAt);
      return updatedAt < stuckThreshold;
    });

    console.log(`  Found ${reallyStuck.length} stuck audits (no updates in 2+ hours)`);

    if (reallyStuck.length > 0 && !options.dryRun) {
      for (const audit of reallyStuck) {
        await db
          .update(auditJobs)
          .set({
            status: 'failed',
            errorMessage: 'Audit timed out - no updates in over 2 hours',
            updatedAt: new Date(),
          })
          .where(eq(auditJobs.id, audit.id));

        console.log(`  ✓ Marked audit ${audit.id.substring(0, 8)} as failed`);
        totalMarkedFailed++;
      }
    }
  }

  // ============================================================================
  // 2. Delete failed audits and their data
  // ============================================================================
  if (options.failed) {
    console.log('\n🔍 Checking for failed audits...');

    const failedAudits = await db
      .select()
      .from(auditJobs)
      .where(eq(auditJobs.status, 'failed'));

    console.log(`  Found ${failedAudits.length} failed audits`);

    if (failedAudits.length > 0) {
      const auditIds = failedAudits.map((a) => a.id);

      if (!options.dryRun) {
        // Delete related data (cascade should handle this, but let's be explicit)
        await db.delete(auditResults).where(inArray(auditResults.jobId, auditIds));
        await db.delete(auditStepProgress).where(inArray(auditStepProgress.jobId, auditIds));
        await db.delete(auditSopExecution).where(inArray(auditSopExecution.jobId, auditIds));
        await db.delete(auditJobs).where(inArray(auditJobs.id, auditIds));

        console.log(`  ✓ Deleted ${failedAudits.length} failed audits from database`);
        totalDeleted += failedAudits.length;

        // Delete temp directories
        for (const audit of failedAudits) {
          if (audit.projectPath) {
            const tempDir = path.dirname(audit.projectPath); // /tmp/audits/{id}
            if (await fs.pathExists(tempDir)) {
              await fs.remove(tempDir);
              console.log(`  ✓ Removed temp directory: ${path.basename(tempDir)}`);
              tempDirsRemoved++;
            }
          }
        }
      }
    }
  }

  // ============================================================================
  // 3. Keep only latest successful audit per commit SHA
  // ============================================================================
  if (options.duplicates) {
    console.log('\n🔍 Checking for duplicate audits (same repo/branch/commit)...');

    const allAudits = await db.select().from(auditJobs);

    // Group by repo + branch + commitSha
    const groups = new Map<string, typeof allAudits>();

    for (const audit of allAudits) {
      if (!audit.repo) continue;

      const key = `${audit.repo}:${audit.branch || 'main'}:${audit.commitSha || 'unknown'}`;
      const existing = groups.get(key) || [];
      existing.push(audit);
      groups.set(key, existing);
    }

    // Find duplicates
    let duplicateCount = 0;
    const toDelete: string[] = [];

    for (const [key, audits] of groups.entries()) {
      if (audits.length <= 1) continue;

      // Sort by createdAt descending (newest first)
      audits.sort((a, b) => {
        const aDate = new Date(a.createdAt).getTime();
        const bDate = new Date(b.createdAt).getTime();
        return bDate - aDate;
      });

      // Keep first (newest), delete rest
      const [keep, ...deleteList] = audits;

      console.log(`\n  Group: ${key.substring(0, 60)}...`);
      console.log(`    Keep: ${keep.id.substring(0, 8)} (${keep.status}) - ${keep.createdAt}`);

      for (const audit of deleteList) {
        console.log(`    Delete: ${audit.id.substring(0, 8)} (${audit.status}) - ${audit.createdAt}`);
        toDelete.push(audit.id);
        duplicateCount++;
      }
    }

    if (toDelete.length > 0 && !options.dryRun) {
      // Delete related data
      await db.delete(auditResults).where(inArray(auditResults.jobId, toDelete));
      await db.delete(auditStepProgress).where(inArray(auditStepProgress.jobId, toDelete));
      await db.delete(auditSopExecution).where(inArray(auditSopExecution.jobId, toDelete));

      // Get audits to clean temp dirs
      const auditsToDelete = await db.select().from(auditJobs).where(inArray(auditJobs.id, toDelete));

      await db.delete(auditJobs).where(inArray(auditJobs.id, toDelete));

      console.log(`\n  ✓ Deleted ${duplicateCount} duplicate audits`);
      totalDeleted += duplicateCount;

      // Delete temp directories
      for (const audit of auditsToDelete) {
        if (audit.projectPath) {
          const tempDir = path.dirname(audit.projectPath);
          if (await fs.pathExists(tempDir)) {
            await fs.remove(tempDir);
            console.log(`  ✓ Removed temp directory: ${path.basename(tempDir)}`);
            tempDirsRemoved++;
          }
        }
      }
    }
  }

  // ============================================================================
  // 4. Clean orphaned temp directories
  // ============================================================================
  if (options.temp) {
    console.log('\n🔍 Checking for orphaned temp directories...');

    const tempBase = '/tmp/audits';
    if (await fs.pathExists(tempBase)) {
      const dirs = await fs.readdir(tempBase);
      const allAudits = await db.select({ id: auditJobs.id }).from(auditJobs);
      const validIds = new Set(allAudits.map((a) => a.id));

      let orphanCount = 0;

      for (const dir of dirs) {
        if (!dir.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          continue; // Not a UUID directory
        }

        if (!validIds.has(dir)) {
          console.log(`  Orphaned: ${dir}`);
          orphanCount++;

          if (!options.dryRun) {
            await fs.remove(path.join(tempBase, dir));
            console.log(`  ✓ Removed orphaned directory: ${dir}`);
            tempDirsRemoved++;
          }
        }
      }

      if (orphanCount === 0) {
        console.log('  No orphaned directories found');
      }
    }
  }

  await pool.end();

  console.log('\n✅ Cleanup complete!');
  console.log(`   Audits deleted: ${totalDeleted}`);
  console.log(`   Audits marked failed: ${totalMarkedFailed}`);
  console.log(`   Temp directories removed: ${tempDirsRemoved}`);

  if (options.dryRun) {
    console.log('\n💡 This was a dry run. Run without --dry-run to actually delete.');
  }

  process.exit(0);
}

// Show help if no options
if (!options.failed && !options.stuck && !options.duplicates && !options.temp) {
  console.log('Usage:');
  console.log('  npx tsx src/db/cleanup-audits.ts [options]');
  console.log('');
  console.log('Options:');
  console.log('  --failed       Delete all failed audits');
  console.log('  --stuck        Mark stuck "running" audits as failed');
  console.log('  --duplicates   Keep only latest audit per commit SHA');
  console.log('  --temp         Clean orphaned temp directories');
  console.log('  --all          Do all of the above');
  console.log('  --dry-run      Show what would be deleted without deleting');
  console.log('');
  console.log('Examples:');
  console.log('  npx tsx src/db/cleanup-audits.ts --all --dry-run');
  console.log('  npx tsx src/db/cleanup-audits.ts --failed --temp');
  process.exit(0);
}

cleanupAudits().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
