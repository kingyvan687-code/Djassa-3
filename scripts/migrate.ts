import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, '..', 'server', 'migrations');
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL manquant. Configure la base PostgreSQL avant la migration.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10_000,
  ...(process.env.DATABASE_SSL === 'true'
    ? { ssl: { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' } }
    : {})
});

const MIGRATION_LOCK_ID = 'DJASSA_SCHEMA_MIGRATIONS_V1';

async function main() {
  const client = await pool.connect();
  let lockAcquired = false;
  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [MIGRATION_LOCK_ID]);
    lockAcquired = true;

    await client.query(`
      CREATE TABLE IF NOT EXISTS djassa_schema_migrations (
        version TEXT PRIMARY KEY,
        checksum_sha256 TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const files = fs.readdirSync(migrationsDir)
      .filter((name) => /^\d{3}_[a-z0-9_-]+\.sql$/i.test(name))
      .sort();

    if (files.length === 0) {
      console.log('Aucune migration SQL trouvée.');
      return;
    }

    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      const existing = await client.query<{ checksum_sha256: string }>(
        'SELECT checksum_sha256 FROM djassa_schema_migrations WHERE version = $1',
        [file]
      );

      if (existing.rowCount) {
        if (existing.rows[0].checksum_sha256 !== checksum) {
          throw new Error(`CHECKSUM_MISMATCH: ${file} a été modifiée après son application. Crée une nouvelle migration au lieu de modifier celle-ci.`);
        }
        console.log(`Déjà appliquée : ${file}`);
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO djassa_schema_migrations (version, checksum_sha256) VALUES ($1, $2)',
          [file, checksum]
        );
        await client.query('COMMIT');
        console.log(`Migration appliquée : ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    console.log(`Migrations terminées : ${files.length} fichier(s) vérifié(s).`);
  } finally {
    if (lockAcquired) {
      try { await client.query('SELECT pg_advisory_unlock(hashtext($1))', [MIGRATION_LOCK_ID]); }
      catch { /* la connexion sera fermée */ }
    }
    client.release();
  }
}

try {
  await main();
} catch (error) {
  console.error('Échec migration DJASSA:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
