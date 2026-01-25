/**
 * Setup Verification Tables
 * Run this to create the verification system tables
 */

import 'dotenv/config';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

async function setupVerification() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('🔗 Connecting to database...\n');

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('azure.com') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    // Read the migration file
    const migrationPath = path.resolve(process.cwd(), 'drizzle/migrations/0003_verification_system.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📜 Running verification system migration...\n');

    // Execute the migration
    await pool.query(sql);

    console.log('✅ Verification system setup complete!\n');

    // Verify tables were created
    const result = await pool.query(`
      SELECT table_name,
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
        AND table_name IN ('clarification_faqs', 'clarification_verifications')
      ORDER BY table_name;
    `);

    console.log('📊 Created tables:');
    console.table(result.rows);

    // Show enums
    const enums = await pool.query(`
      SELECT t.typname as enum_name, e.enumlabel as value
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname IN ('clarification_faq_category', 'verification_recommendation')
      ORDER BY t.typname, e.enumsortorder;
    `);

    console.log('\n📋 Created enums:');
    const grouped = enums.rows.reduce((acc: any, row: any) => {
      if (!acc[row.enum_name]) acc[row.enum_name] = [];
      acc[row.enum_name].push(row.value);
      return acc;
    }, {});
    console.log(JSON.stringify(grouped, null, 2));

    console.log('\n✨ Next steps:');
    console.log('1. Implement verification service: src/services/clarificationVerificationService.ts');
    console.log('2. Update clarification submission to call verification');
    console.log('3. Update re-analysis logic to check verification status');
    console.log('4. Add UI for verification status\n');

  } catch (error: any) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupVerification();
