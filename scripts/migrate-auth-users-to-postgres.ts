import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Pool } from 'pg';

type LegacyUser = {
  id: string; pgUuid?: string; email: string; name: string; phone?: string; role: string;
  tenantId: string; status: string; passwordHash: string; passwordSalt: string;
  failedAttempts?: number; lockedUntil?: string | null; createdAt?: string; updatedAt?: string;
};
const APPLY = process.argv.includes('--apply');
const SOURCE = path.resolve(process.env.DJASSA_AUTH_SOURCE || 'server/data/auth_users.json');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES = new Set(['client', 'seller', 'driver', 'company', 'admin']);
const STATUSES = new Set(['active', 'pending', 'suspended', 'closed']);
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
function stableUuid(seed: string) {
  const h = sha(`djassa-uuid:${seed}`);
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
function fail(message: string): never { throw new Error(message); }
function loadUsers(): LegacyUser[] {
  if (!fs.existsSync(SOURCE)) fail(`Fichier source introuvable: ${SOURCE}`);
  const parsed = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  if (!Array.isArray(parsed?.users)) fail('Format invalide: propriété users[] absente.');
  const users = parsed.users as LegacyUser[];
  const emails = new Set<string>();
  const ids = new Set<string>();
  for (const [i, u] of users.entries()) {
    const email = String(u.email || '').trim().toLowerCase();
    const id = String(u.id || '').trim();
    if (!id || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(`Utilisateur #${i}: identifiant ou email invalide.`);
    if (emails.has(email)) fail(`Email dupliqué dans le fichier: ${email}`);
    if (ids.has(id)) fail(`Identifiant dupliqué dans le fichier: ${id}`);
    emails.add(email); ids.add(id);
    if (!ROLES.has(u.role)) fail(`Rôle invalide pour ${email}: ${u.role}`);
    if (!STATUSES.has(u.status)) fail(`Statut invalide pour ${email}: ${u.status}`);
    if (!u.tenantId || !u.passwordHash || !u.passwordSalt) fail(`Données obligatoires manquantes pour ${email}.`);
    if (!/^[a-f0-9]{128}$/i.test(u.passwordHash)) fail(`Hash scrypt inattendu pour ${email}; import refusé.`);
    if (!/^[a-f0-9]{32}$/i.test(u.passwordSalt)) fail(`Sel scrypt inattendu pour ${email}; import refusé.`);
  }
  return users;
}
async function main() {
  if (APPLY && process.env.DJASSA_CONFIRM_AUTH_IMPORT !== 'YES') fail('Pour appliquer, définir DJASSA_CONFIRM_AUTH_IMPORT=YES après sauvegarde vérifiée.');
  if (!process.env.DATABASE_URL) fail('DATABASE_URL manquant.');
  const users = loadUsers();
  const fileHash = sha(fs.readFileSync(SOURCE, 'utf8'));
  console.log(`Mode: ${APPLY ? 'IMPORT TRANSACTIONNEL' : 'APERÇU SANS ÉCRITURE'}`);
  console.log(`Source: ${SOURCE}`);
  console.log(`SHA-256: ${fileHash}`);
  console.log(`Comptes validés: ${users.length}`);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000,
    ...(process.env.DATABASE_SSL === 'true' ? { ssl: { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' } } : {}) });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const collisions: string[] = [];
    for (const u of users) {
      const id = u.pgUuid && UUID_RE.test(u.pgUuid) ? u.pgUuid : stableUuid(u.id);
      const tenant = stableUuid(u.tenantId);
      const email = u.email.trim().toLowerCase();
      const phone = String(u.phone || '').trim() || null;
      const found = await client.query<{ id: string; email: string; phone: string | null }>(
        `SELECT id::text, email, phone FROM djassa_users
         WHERE lower(email)=lower($1) OR id=$2::uuid OR ($3::text IS NOT NULL AND phone=$3)
         FOR UPDATE`, [email, id, phone]);
      for (const row of found.rows) {
        if (row.id !== id || row.email.toLowerCase() !== email || (phone && row.phone && row.phone !== phone))
          collisions.push(`${email}: collision PostgreSQL (id=${row.id}, email=${row.email})`);
      }
      if (APPLY && collisions.length === 0) {
        await client.query(
          `INSERT INTO djassa_users(id,email,phone,display_name,status,created_at,updated_at)
           VALUES($1::uuid,$2,$3,$4,$5,COALESCE($6::timestamptz,now()),COALESCE($7::timestamptz,now()))
           ON CONFLICT(id) DO UPDATE SET phone=EXCLUDED.phone, display_name=EXCLUDED.display_name,
             status=EXCLUDED.status, updated_at=now()`,
          [id,email,phone,u.name,u.status,u.createdAt || null,u.updatedAt || null]);
        await client.query(
          `INSERT INTO djassa_credentials(user_id,password_hash,failed_attempts,locked_until)
           VALUES($1::uuid,$2,$3,$4::timestamptz)
           ON CONFLICT(user_id) DO UPDATE SET password_hash=EXCLUDED.password_hash,
             failed_attempts=EXCLUDED.failed_attempts,locked_until=EXCLUDED.locked_until`,
          [id,`scrypt:${u.passwordSalt}:${u.passwordHash}`,Math.max(0,Number(u.failedAttempts || 0)),u.lockedUntil || null]);
        await client.query(
          `INSERT INTO djassa_memberships(user_id,role,tenant_id,status,activated_at,revoked_at)
           VALUES($1::uuid,$2,$3::uuid,$4,CASE WHEN $4='active' THEN now() ELSE NULL END,
             CASE WHEN $4='revoked' THEN now() ELSE NULL END)
           ON CONFLICT(user_id,role,tenant_id) DO UPDATE SET status=EXCLUDED.status,updated_at=now()`,
          [id,u.role,tenant,u.status === 'suspended' ? 'suspended' : u.status === 'closed' ? 'revoked' : u.status]);
      }
    }
    if (collisions.length) {
      await client.query('ROLLBACK');
      console.error('Conflits détectés; aucune donnée importée:');
      collisions.forEach((c) => console.error(`- ${c}`));
      process.exitCode = 2;
      return;
    }
    if (APPLY) {
      await client.query(`INSERT INTO djassa_audit_events(action,resource_type,resource_id,result,metadata)
        VALUES('legacy_auth_import','auth_users_file',$1,'success',$2::jsonb)`,
        [fileHash,JSON.stringify({source:path.basename(SOURCE),count:users.length,sha256:fileHash})]);
      await client.query('COMMIT');
      console.log('Import des comptes terminé. Aucun token ou session historique n’a été importé.');
    } else {
      await client.query('ROLLBACK');
      console.log('Aucun changement effectué. Relancer avec --apply et DJASSA_CONFIRM_AUTH_IMPORT=YES après sauvegarde.');
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); await pool.end(); }
}
main().catch((e) => { console.error('Import refusé:', e instanceof Error ? e.message : 'erreur inconnue'); process.exitCode = 1; });
