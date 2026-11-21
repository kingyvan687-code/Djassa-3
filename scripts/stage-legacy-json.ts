import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Pool } from 'pg';

const ROOT = path.resolve(process.cwd());
const DATA_DIR = path.resolve(ROOT, 'server', 'data');
const APPLY = process.argv.includes('--stage');
const ALLOWED = new Set([
  'auth_users.json', 'client_state.json', 'commerce_db.json', 'db.json',
  'credits_billing.json', 'privacy_db.json', 'fraud_db.json', 'maintenance_db.json',
  'surveillance_db.json', 'security_db.json', 'backups_db.json'
]);

type Entry = { collectionPath: string; key: string; payload: unknown };
function sha(value: string | Buffer) { return crypto.createHash('sha256').update(value).digest('hex'); }
function flatten(value: unknown, collectionPath = '$'): Entry[] {
  if (Array.isArray(value)) return value.map((payload, i) => ({ collectionPath, key: String(i), payload }));
  if (value && typeof value === 'object') {
    const entries: Entry[] = [];
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (Array.isArray(child)) entries.push(...flatten(child, `${collectionPath}.${key}`));
      else if (child && typeof child === 'object') entries.push(...flatten(child, `${collectionPath}.${key}`));
      else entries.push({ collectionPath, key, payload: { [key]: child } });
    }
    return entries;
  }
  return [{ collectionPath, key: '0', payload: value }];
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) {
    console.log(`Aucun dossier ${path.relative(ROOT, DATA_DIR)} trouvé. Aucune donnée n'a été modifiée.`);
    return;
  }
  const files = fs.readdirSync(DATA_DIR).filter((name) => ALLOWED.has(name)).sort();
  const plans: Array<{ name: string; hash: string; entries: Entry[] }> = [];
  for (const name of files) {
    const full = path.resolve(DATA_DIR, name);
    if (!full.startsWith(`${DATA_DIR}${path.sep}`)) throw new Error('INVALID_SOURCE_PATH');
    const raw = fs.readFileSync(full);
    let parsed: unknown;
    try { parsed = JSON.parse(raw.toString('utf8')); }
    catch { console.error(`JSON invalide ignoré: ${name}`); continue; }
    plans.push({ name, hash: sha(raw), entries: flatten(parsed) });
  }
  console.log(`Mode: ${APPLY ? 'STAGING PostgreSQL' : 'APERÇU SANS ÉCRITURE'}`);
  for (const p of plans) console.log(`${p.name}: sha256=${p.hash} | enregistrements candidats=${p.entries.length}`);
  if (!APPLY) {
    console.log('Aucune écriture effectuée. Relancer avec --stage après sauvegarde et validation de DATABASE_URL.');
    return;
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL manquant');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000,
    ...(process.env.DATABASE_SSL === 'true' ? { ssl: { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' } } : {}) });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const plan of plans) {
      const batch = await client.query<{ id: string; status: string }>(
        `INSERT INTO djassa_legacy_import_batches(source_name, source_sha256, source_record_count, status)
         VALUES ($1,$2,$3,'running') ON CONFLICT(source_name,source_sha256)
         DO UPDATE SET source_name=EXCLUDED.source_name RETURNING id,status`,
        [plan.name, plan.hash, plan.entries.length]);
      const batchId = batch.rows[0].id;
      if (batch.rows[0].status === 'committed') continue;
      for (const entry of plan.entries) {
        const payload = JSON.stringify(entry.payload);
        await client.query(
          `INSERT INTO djassa_legacy_import_records(batch_id,collection_path,record_key,payload,payload_sha256)
           VALUES ($1,$2,$3,$4::jsonb,$5) ON CONFLICT(batch_id,collection_path,record_key)
           DO UPDATE SET payload=EXCLUDED.payload,payload_sha256=EXCLUDED.payload_sha256`,
          [batchId, entry.collectionPath, entry.key, payload, sha(payload)]);
      }
      await client.query(
        `UPDATE djassa_legacy_import_batches SET imported_record_count=$2,
         reconciliation=jsonb_build_object('mode','lossless-staging-only','collections',$3::jsonb),
         status='validated', completed_at=now() WHERE id=$1`,
        [batchId, plan.entries.length, JSON.stringify(plan.entries.reduce<Record<string, number>>((a, e) => (a[e.collectionPath] = (a[e.collectionPath] || 0) + 1, a), {}))]);
    }
    await client.query('COMMIT');
    console.log('Staging terminé. Les données restent isolées des tables métier; aucune bascule applicative effectuée.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); await pool.end(); }
}
main().catch((error) => { console.error('Échec staging:', error instanceof Error ? error.message : 'erreur inconnue'); process.exitCode = 1; });
