import { Pool, type PoolConfig, type QueryResultRow } from 'pg';

/**
 * Central PostgreSQL connection for DJASSA.
 * No fallback to localStorage or JSON is performed here: if DATABASE_URL is
 * missing, the database is explicitly reported as unconfigured.
 */
let pool: Pool | null = null;

function getConnectionString(): string {
  return (process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '').trim();
}

function getPool(): Pool {
  if (pool) return pool;
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error('DATABASE_NOT_CONFIGURED');
  }
  const config: PoolConfig = {
    connectionString,
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ...(process.env.DATABASE_SSL === 'true'
      ? { ssl: { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' } }
      : {})
  };
  pool = new Pool(config);
  pool.on('error', (error) => {
    console.error('[DJASSA DB] Unexpected PostgreSQL pool error:', error.message);
  });
  return pool;
}

export async function query<T extends QueryResultRow = Record<string, unknown>>(
  sql: string,
  values: unknown[] = []
): Promise<T[]> {
  const result = await getPool().query<T>(sql, values);
  return result.rows;
}

export async function withTransaction<T>(work: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function databaseHealth(): Promise<{ configured: boolean; connected: boolean }> {
  if (!getConnectionString()) return { configured: false, connected: false };
  try {
    await getPool().query('SELECT 1');
    return { configured: true, connected: true };
  } catch {
    return { configured: true, connected: false };
  }
}
