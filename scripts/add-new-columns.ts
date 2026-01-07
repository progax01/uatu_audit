import 'dotenv/config';
import { Pool } from 'pg';

async function addNewColumns() {
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

  try {
    // Add wallet_type enum if not exists
    console.log('Adding wallet_type enum...');
    await pool.query(`
      DO $$ BEGIN
        CREATE TYPE wallet_type AS ENUM ('ethereum', 'solana', 'cosmos', 'sui', 'aptos');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Add new columns to users table
    console.log('Adding new columns to users table...');
    const userColumns = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(128) UNIQUE`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_type wallet_type`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_nonce VARCHAR(64)`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS company VARCHAR(255)`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS website VARCHAR(500)`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS twitter_handle VARCHAR(100)`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`,
      // Make github_id nullable for wallet-only users
      `ALTER TABLE users ALTER COLUMN github_id DROP NOT NULL`,
      `ALTER TABLE users ALTER COLUMN github_login DROP NOT NULL`,
    ];

    for (const sql of userColumns) {
      try {
        await pool.query(sql);
        console.log('  ✓', sql.substring(0, 60) + '...');
      } catch (err: any) {
        if (err.code !== '42701') { // 42701 = duplicate_column
          console.error('  ✗', sql.substring(0, 60), err.message);
        }
      }
    }

    // Add new columns to sessions table
    console.log('Adding new columns to sessions table...');
    const sessionColumns = [
      `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS auth_method VARCHAR(20) DEFAULT 'github' NOT NULL`,
      `ALTER TABLE sessions ALTER COLUMN github_token_encrypted DROP NOT NULL`,
      `ALTER TABLE sessions ALTER COLUMN github_token_iv DROP NOT NULL`,
    ];

    for (const sql of sessionColumns) {
      try {
        await pool.query(sql);
        console.log('  ✓', sql.substring(0, 60) + '...');
      } catch (err: any) {
        console.error('  ✗', sql.substring(0, 60), err.message);
      }
    }

    // Add new columns to projects table
    console.log('Adding new columns to projects table...');
    const projectColumns = [
      `ALTER TABLE projects ADD COLUMN IF NOT EXISTS logo_url TEXT`,
      `ALTER TABLE projects ADD COLUMN IF NOT EXISTS website_url VARCHAR(500)`,
      `ALTER TABLE projects ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7)`,
      `ALTER TABLE projects ADD COLUMN IF NOT EXISTS contract_address VARCHAR(128)`,
      `ALTER TABLE projects ADD COLUMN IF NOT EXISTS chain_id VARCHAR(50)`,
      `ALTER TABLE projects ADD COLUMN IF NOT EXISTS docs_url VARCHAR(500)`,
      `ALTER TABLE projects ADD COLUMN IF NOT EXISTS github_url VARCHAR(500)`,
      `ALTER TABLE projects ADD COLUMN IF NOT EXISTS twitter_url VARCHAR(500)`,
      `ALTER TABLE projects ADD COLUMN IF NOT EXISTS discord_url VARCHAR(500)`,
      `ALTER TABLE projects ADD COLUMN IF NOT EXISTS report_config JSONB DEFAULT '{}'`,
    ];

    for (const sql of projectColumns) {
      try {
        await pool.query(sql);
        console.log('  ✓', sql.substring(0, 60) + '...');
      } catch (err: any) {
        console.error('  ✗', sql.substring(0, 60), err.message);
      }
    }

    // Create index on wallet_address
    console.log('Creating indexes...');
    try {
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_wallet_address_idx ON users (wallet_address)`);
      console.log('  ✓ Created users_wallet_address_idx');
    } catch (err: any) {
      console.error('  ✗ users_wallet_address_idx', err.message);
    }

    console.log('\n✅ Schema update complete!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

addNewColumns();
