import 'dotenv/config';
import { Pool } from 'pg';

async function checkTables() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('azure.com') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('🔍 Checking verification tables in database...\n');

    // Check if tables exist
    const tablesQuery = `
      SELECT table_name,
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
        AND table_name IN ('clarification_faqs', 'clarification_verifications', 'audit_clarifications')
      ORDER BY table_name;
    `;

    const tablesResult = await pool.query(tablesQuery);

    console.log('📊 Tables Found:');
    console.table(tablesResult.rows);
    console.log('');

    // Check clarification_verifications columns
    console.log('📋 clarification_verifications columns:');
    const verColsQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'clarification_verifications'
      ORDER BY ordinal_position;
    `;
    const verColsResult = await pool.query(verColsQuery);
    console.table(verColsResult.rows);
    console.log('');

    // Check clarification_faqs columns
    console.log('📋 clarification_faqs columns:');
    const faqColsQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'clarification_faqs'
      ORDER BY ordinal_position;
    `;
    const faqColsResult = await pool.query(faqColsQuery);
    console.table(faqColsResult.rows);
    console.log('');

    // Check enums
    console.log('📋 Enums:');
    const enumsQuery = `
      SELECT t.typname as enum_name,
             array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname IN ('clarification_faq_category', 'verification_recommendation')
      GROUP BY t.typname;
    `;
    const enumsResult = await pool.query(enumsQuery);
    enumsResult.rows.forEach(row => {
      console.log(`  ${row.enum_name}:`, row.values);
    });
    console.log('');

    // Check foreign keys
    console.log('📋 Foreign Keys:');
    const fkQuery = `
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN ('clarification_faqs', 'clarification_verifications')
      ORDER BY tc.table_name, kcu.column_name;
    `;
    const fkResult = await pool.query(fkQuery);
    console.table(fkResult.rows);

    console.log('\n✅ Database verification complete!');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkTables();
