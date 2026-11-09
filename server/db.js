import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: Number(process.env.DB_POOL_MAX || 10),
});

pool.on('error', (err) => {
  console.error('Unexpected idle database client error', err);
});

export function query(text, params) {
  return pool.query(text, params);
}

const RETRYABLE = new Set(['40P01', '40001']); // deadlock, serialization failure

/**
 * Runs fn(client) inside a transaction; rolls back and rethrows on error.
 * Two concurrent inserts of overlapping intervals can deadlock inside the exclusion-constraint
 * check; Postgres aborts one of them, and retrying it then yields a clean 23P01 conflict.
 */
export async function withTransaction(fn, { retries = 3 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await runTransaction(fn);
    } catch (err) {
      if (!RETRYABLE.has(err.code) || attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, 5 + Math.random() * 20 * (attempt + 1)));
    }
  }
}

async function runTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
