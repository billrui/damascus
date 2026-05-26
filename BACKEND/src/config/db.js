import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  min:              env.DB_POOL_MIN,
  max:              env.DB_POOL_MAX,
  idleTimeoutMillis:   30_000,
  connectionTimeoutMillis: 5_000,
});

// Verify connection on startup
pool.on('connect', () => {
  if (env.NODE_ENV === 'development') {
    console.log('🐘  PostgreSQL client connected');
  }
});

pool.on('error', (err) => {
  console.error('❌  Unexpected PostgreSQL error:', err.message);
});

/**
 * Run a single query. Throws on error.
 * Usage: await db.query('SELECT * FROM users WHERE id=$1', [id])
 */
export const db = {
  query: (text, params) => pool.query(text, params),

  /**
   * Run multiple queries inside a single transaction.
   * Automatically rolls back on any error.
   *
   * Usage:
   *   await db.transaction(async (client) => {
   *     await client.query('INSERT INTO sales ...');
   *     await client.query('UPDATE batches ...');
   *   });
   */
  transaction: async (fn) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};
