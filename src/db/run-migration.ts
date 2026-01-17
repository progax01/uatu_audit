/**
 * Database Migration Runner
 *
 * Runs SQL migrations against the database.
 */

import 'dotenv/config';
import { Pool } from 'pg';
import * as fs from 'fs-extra';
import * as path from 'path';

async function runMigration(migrationFile: string) {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log(`🔄 Running migration: ${path.basename(migrationFile)}`);

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('azure.com') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const sql = await fs.readFile(migrationFile, 'utf-8');

    await pool.query(sql);

    console.log('✅ Migration completed successfully!');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error('Details:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Get migration file from command line args
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: npx tsx src/db/run-migration.ts <migration-file.sql>');
  process.exit(1);
}

runMigration(migrationFile).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
