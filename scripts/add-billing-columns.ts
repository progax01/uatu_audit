/**
 * Migration script to add billing-related columns and tables
 * Run with: npx tsx scripts/add-billing-columns.ts
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    console.log('Starting billing migration...\n');

    // Add purchase status enum
    console.log('1. Creating purchase_status enum...');
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE purchase_status AS ENUM ('pending', 'confirming', 'completed', 'failed', 'refunded');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('   ✓ purchase_status enum created\n');

    // Add purchase tier enum
    console.log('2. Creating purchase_tier enum...');
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE purchase_tier AS ENUM ('starter', 'pro', 'enterprise');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('   ✓ purchase_tier enum created\n');

    // Add SLOC and AI columns to users table
    console.log('3. Adding SLOC and AI columns to users table...');

    const columnsToAdd = [
      { name: 'sloc_balance', type: 'BIGINT NOT NULL DEFAULT 200' },
      { name: 'sloc_used', type: 'BIGINT NOT NULL DEFAULT 0' },
      { name: 'ai_calls_balance', type: 'SMALLINT NOT NULL DEFAULT 3' },
      { name: 'ai_calls_used', type: 'SMALLINT NOT NULL DEFAULT 0' },
      { name: 'monthly_quota_reset_at', type: 'TIMESTAMPTZ' },
    ];

    for (const col of columnsToAdd) {
      try {
        await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
        console.log(`   ✓ Added column: ${col.name}`);
      } catch (err: any) {
        if (err.code === '42701') {
          console.log(`   - Column ${col.name} already exists`);
        } else {
          throw err;
        }
      }
    }
    console.log('');

    // Create neuron_purchases table
    console.log('4. Creating neuron_purchases table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS neuron_purchases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tx_hash VARCHAR(100) UNIQUE NOT NULL,
        chain_id SMALLINT NOT NULL,
        from_address VARCHAR(128) NOT NULL,
        tier purchase_tier NOT NULL,
        amount_usdt BIGINT NOT NULL,
        neurons_awarded BIGINT NOT NULL,
        sloc_awarded BIGINT NOT NULL,
        ai_calls_awarded SMALLINT NOT NULL,
        status purchase_status NOT NULL DEFAULT 'pending',
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        confirmed_at TIMESTAMPTZ
      )
    `);
    console.log('   ✓ neuron_purchases table created\n');

    // Create indexes
    console.log('5. Creating indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS neuron_purchases_user_id_idx ON neuron_purchases(user_id)',
      'CREATE UNIQUE INDEX IF NOT EXISTS neuron_purchases_tx_hash_idx ON neuron_purchases(tx_hash)',
      'CREATE INDEX IF NOT EXISTS neuron_purchases_status_idx ON neuron_purchases(status)',
      'CREATE INDEX IF NOT EXISTS neuron_purchases_created_at_idx ON neuron_purchases(created_at)',
    ];

    for (const idx of indexes) {
      await client.query(idx);
    }
    console.log('   ✓ Indexes created\n');

    console.log('✅ Migration completed successfully!');

  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
