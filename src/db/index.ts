import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { logger } from '../utils/logger';

const log = logger.child({ module: 'database' });

// Database connection URL from environment
const DATABASE_URL = process.env.DATABASE_URL || '';

let pool: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;

// Get or create the database pool
function getPool(): Pool {
  if (!pool) {
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('azure.com') ? { rejectUnauthorized: false } : undefined,
      max: 20,
      idleTimeoutMillis: 60000, // 60 seconds (increased for long-running audits)
      connectionTimeoutMillis: 10000,
      keepAlive: true, // Keep connections alive to prevent timeouts
      keepAliveInitialDelayMillis: 10000,
    });

    // Critical: Add error handler to prevent server crashes
    pool.on('error', (err: Error, client) => {
      log.error('Unexpected database pool error', {
        error: err.message,
        code: (err as any).code,
        stack: err.stack,
      });
      // Don't crash the server - just log the error
      // The pool will handle removing the bad connection
    });

    // Log pool events for debugging
    pool.on('connect', (client) => {
      log.debug('New database client connected', {
        totalCount: pool?.totalCount,
        idleCount: pool?.idleCount,
        waitingCount: pool?.waitingCount,
      });
    });

    pool.on('remove', (client) => {
      log.debug('Database client removed from pool', {
        totalCount: pool?.totalCount,
        idleCount: pool?.idleCount,
        waitingCount: pool?.waitingCount,
      });
    });

    log.info('Database pool created', {
      maxConnections: 20,
      idleTimeoutMs: 60000,
    });
  }
  return pool;
}

// Get or create Drizzle instance with schema
export function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }
  return dbInstance;
}

// Export for convenience (lazy initialization)
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_, prop) {
    return (getDb() as any)[prop];
  },
});

// Health check function
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const p = getPool();
    const result = await p.query('SELECT 1 as connected');
    return result.rows[0]?.connected === 1;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    dbInstance = null;
  }
}
