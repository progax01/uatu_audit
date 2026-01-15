/**
 * Database Reset Script
 *
 * Clears all audit-related data to allow fresh scans with new data structures.
 * Preserves: users, sessions, organizations, xp rules, tier thresholds
 * Clears: all audit jobs, results, reports, conversations, etc.
 *
 * Usage: npm run db:reset
 */

// Load environment variables from .env file
import 'dotenv/config';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

async function resetAuditData() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    console.error('   Make sure you have a .env file with DATABASE_URL set');
    process.exit(1);
  }

  console.log('🔗 Connecting to database...');

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('azure.com') ? { rejectUnauthorized: false } : undefined,
  });

  const db = drizzle(pool);

  console.log('🗑️  Starting database reset for audit data...\n');

  // Tables to clear (in snake_case as they appear in DB)
  // Order matters due to foreign key constraints
  const tablesToClear = [
    // AI Conversation data
    'ai_context_snapshots',
    'ai_conversation_history',

    // Audit findings and references
    'audit_cross_references',
    'audit_findings',
    'audit_user_answers',
    'audit_prompts',
    'audit_known_addresses',
    'audit_linked_projects',
    'audit_sessions',

    // Tool execution and SOP
    'tool_execution_logs',
    'audit_step_progress',
    'audit_sop_execution',

    // Clarifications
    'audit_clarifications',

    // Pre-audit questionnaire
    'preaudit_answers',
    'preaudit_questionnaires',
    // Note: preaudit_questions are templates, keep them

    // Audit reports and results
    'audit_reports',
    'audit_results',

    // Public showcase
    'public_audit_showcase',

    // Main audit jobs
    'audit_jobs',

    // Audit trail (optional - comment out to preserve audit history)
    'audit_trail',

    // Notifications
    'notifications',
  ];

  let cleared = 0;
  let skipped = 0;
  let errors = 0;

  for (const tableName of tablesToClear) {
    try {
      // Use TRUNCATE for faster deletion with CASCADE for foreign keys
      await db.execute(sql.raw(`TRUNCATE TABLE "${tableName}" CASCADE`));
      console.log(`  ✓ Cleared: ${tableName}`);
      cleared++;
    } catch (error: any) {
      // Table might not exist yet (migration not run)
      if (error.code === '42P01') {
        console.log(`  ⚠ Skipped (table not found): ${tableName}`);
        skipped++;
      } else {
        console.error(`  ✗ Error clearing ${tableName}:`, error.message);
        errors++;
      }
    }
  }

  // Also clear the file-based job queue
  try {
    const fsExtra = await import('fs-extra');
    const path = await import('path');
    const { getUatuHome } = await import('../constants/paths.js');

    const queuePath = path.join(getUatuHome(), 'queue', 'jobs.json');
    if (await fsExtra.default.pathExists(queuePath)) {
      await fsExtra.default.writeJson(queuePath, { nextId: 1, jobs: [] }, { spaces: 2 });
      console.log(`  ✓ Cleared: file-based job queue`);
      cleared++;
    }
  } catch (error: any) {
    console.log(`  ⚠ Could not clear file queue: ${error.message}`);
  }

  // Close the pool
  await pool.end();

  console.log(`\n✅ Database reset complete!`);
  console.log(`   Cleared: ${cleared} tables/queues`);
  if (skipped > 0) {
    console.log(`   Skipped: ${skipped} (not found)`);
  }
  if (errors > 0) {
    console.log(`   Errors: ${errors}`);
  }

  console.log(`\n📝 Preserved tables:`);
  console.log(`   - users (accounts)`);
  console.log(`   - sessions (auth tokens)`);
  console.log(`   - organizations`);
  console.log(`   - projects & components`);
  console.log(`   - xp_rules, tier_thresholds (gamification config)`);
  console.log(`   - preaudit_questions (question templates)`);

  process.exit(errors > 0 ? 1 : 0);
}

// Run if called directly
resetAuditData().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
