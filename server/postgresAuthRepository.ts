import crypto from 'node:crypto';
import { query, withTransaction } from './database';

export type PgAuthRole = 'client' | 'seller' | 'admin';
export type PgAccountStatus = 'pending' | 'active' | 'suspended' | 'closed';

export interface PgAuthIdentity {
  id: string;
  email: string;
  phone: string | null;
  displayName: string;
  userStatus: PgAccountStatus;
  membershipId: string;
  role: PgAuthRole;
  tenantId: string | null;
  membershipStatus: 'pending' | 'active' | 'suspended' | 'revoked';
  passwordHash: string;
  failedAttempts: number;
  lockedUntil: Date | null;
}

export interface PgSessionIdentity {
  userId: string;
  email: string;
  displayName: string;
  role: PgAuthRole;
  tenantId: string | null;
  membershipId: string;
  sessionId: string;
}

const scrypt = (password: string, salt: string) =>
  crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });

export function makePgPasswordHash(password: string): string {
  if (typeof password !== 'string' || password.length < 8) throw new Error('WEAK_PASSWORD');
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt:${salt}:${scrypt(password, salt).toString('hex')}`;
}

export function verifyPgPassword(password: string, encoded: string): boolean {
  try {
    const [scheme, salt, hash] = String(encoded || '').split(':');
    if (scheme !== 'scrypt' || !/^[a-f0-9]{32}$/i.test(salt || '') || !/^[a-f0-9]{128}$/i.test(hash || '')) return false;
    const actual = scrypt(password, salt);
    const expected = Buffer.from(hash, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch { return false; }
}

export async function findPgIdentityByEmail(email: string, role?: PgAuthRole): Promise<PgAuthIdentity | null> {
  const rows = await query<PgAuthIdentity>(
    `SELECT u.id::text, u.email, u.phone, u.display_name AS "displayName", u.status AS "userStatus",
            m.id::text AS "membershipId", m.role, m.tenant_id::text AS "tenantId",
            m.status AS "membershipStatus", c.password_hash AS "passwordHash",
            c.failed_attempts AS "failedAttempts", c.locked_until AS "lockedUntil"
       FROM djassa_users u
       JOIN djassa_credentials c ON c.user_id = u.id
       JOIN djassa_memberships m ON m.user_id = u.id
      WHERE lower(u.email) = lower($1) AND ($2::text IS NULL OR m.role = $2)
      ORDER BY CASE WHEN m.status = 'active' THEN 0 ELSE 1 END, m.created_at ASC
      LIMIT 1`, [email.trim().toLowerCase(), role || null]
  );
  return rows[0] || null;
}

export async function createPgIdentity(input: {
  email: string; phone?: string; displayName: string; role: Exclude<PgAuthRole, 'admin'>;
  tenantId: string; password: string; status?: PgAccountStatus;
}): Promise<{ userId: string; membershipId: string }> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('INVALID_EMAIL');
  if (input.displayName.trim().length < 2) throw new Error('INVALID_NAME');
  const encoded = makePgPasswordHash(input.password);
  return withTransaction(async (client) => {
    const user = await client.query<{ id: string }>(
      `INSERT INTO djassa_users(email, phone, display_name, status)
       VALUES($1,$2,$3,$4) RETURNING id::text`,
      [email, input.phone?.trim() || null, input.displayName.trim(), input.status || 'active']
    );
    const userId = user.rows[0].id;
    await client.query(
      `INSERT INTO djassa_credentials(user_id,password_hash) VALUES($1::uuid,$2)`, [userId, encoded]
    );
    const membership = await client.query<{ id: string }>(
      `INSERT INTO djassa_memberships(user_id,role,tenant_id,status,activated_at)
       VALUES($1::uuid,$2,$3::uuid,$4,CASE WHEN $4='active' THEN now() ELSE NULL END)
       RETURNING id::text`,
      [userId, input.role, input.tenantId, input.status === 'pending' ? 'pending' : input.status === 'suspended' ? 'suspended' : input.status === 'closed' ? 'revoked' : 'active']
    );
    return { userId, membershipId: membership.rows[0].id };
  });
}

export async function recordPgLoginFailure(userId: string, maxAttempts = 5, lockMinutes = 15): Promise<{ lockedUntil: Date | null }> {
  return withTransaction(async (client) => {
    const result = await client.query<{ failed_attempts: number; locked_until: Date | null }>(
      `UPDATE djassa_credentials
          SET failed_attempts = failed_attempts + 1,
              locked_until = CASE WHEN failed_attempts + 1 >= $2
                THEN now() + ($3::text || ' minutes')::interval ELSE locked_until END
        WHERE user_id = $1::uuid
        RETURNING failed_attempts, locked_until`, [userId, maxAttempts, lockMinutes]
    );
    if (!result.rows[0]) throw new Error('CREDENTIAL_NOT_FOUND');
    return { lockedUntil: result.rows[0].locked_until };
  });
}

export async function resetPgLoginFailures(userId: string): Promise<void> {
  await query(`UPDATE djassa_credentials SET failed_attempts=0, locked_until=NULL WHERE user_id=$1::uuid`, [userId]);
}

export async function createPgSession(input: {
  userId: string; membershipId: string; token: string; deviceLabel?: string; ipAddress?: string; expiresAt: Date;
}): Promise<string> {
  const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex');
  const rows = await query<{ id: string }>(
    `INSERT INTO djassa_sessions(user_id,membership_id,token_hash,device_label,ip_address,expires_at)
     SELECT m.user_id,m.id,$3,$4,$5::inet,$6::timestamptz
       FROM djassa_memberships m JOIN djassa_users u ON u.id=m.user_id
      WHERE m.id=$2::uuid AND m.user_id=$1::uuid AND m.status='active' AND u.status='active'
     RETURNING id::text`,
    [input.userId, input.membershipId, tokenHash, input.deviceLabel || null, input.ipAddress || null, input.expiresAt.toISOString()]
  );
  if (!rows[0]) throw new Error('ACTIVE_MEMBERSHIP_REQUIRED');
  return rows[0].id;
}

export async function resolvePgSession(token: string): Promise<PgSessionIdentity | null> {
  if (!token) return null;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const rows = await query<PgSessionIdentity>(
    `SELECT u.id::text AS "userId",u.email,u.display_name AS "displayName",m.role,
            m.tenant_id::text AS "tenantId",m.id::text AS "membershipId",s.id::text AS "sessionId"
       FROM djassa_sessions s
       JOIN djassa_users u ON u.id=s.user_id
       JOIN djassa_memberships m ON m.id=s.membership_id AND m.user_id=u.id
      WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now()
        AND u.status='active' AND m.status='active'
      LIMIT 1`, [tokenHash]
  );
  return rows[0] || null;
}

export async function revokePgSession(token: string, reason = 'logout'): Promise<boolean> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const rows = await query<{ id: string }>(
    `UPDATE djassa_sessions SET revoked_at=now(), revoked_reason=$2
      WHERE token_hash=$1 AND revoked_at IS NULL RETURNING id::text`, [tokenHash, reason.slice(0, 120)]
  );
  return rows.length > 0;
}

export async function touchPgSessionLastSeen(sessionId: string): Promise<void> {
  await query(
    `UPDATE djassa_sessions SET last_seen_at = now() WHERE id = $1::uuid AND revoked_at IS NULL`,
    [sessionId]
  );
}

export async function listPgUserSessions(userId: string): Promise<Array<{
  id: string;
  deviceLabel: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
  revokedReason: string | null;
  createdAt: Date;
}>> {
  return query(
    `SELECT id::text, device_label AS "deviceLabel", ip_address::text AS "ipAddress",
            expires_at AS "expiresAt", last_seen_at AS "lastSeenAt",
            revoked_at AS "revokedAt", revoked_reason AS "revokedReason",
            created_at AS "createdAt"
       FROM djassa_sessions
      WHERE user_id = $1::uuid
      ORDER BY created_at DESC
      LIMIT 50`,
    [userId]
  );
}

export async function revokePgSessionById(userId: string, sessionId: string, reason = 'user_revoked'): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE djassa_sessions
        SET revoked_at = now(), revoked_reason = $3
      WHERE id = $2::uuid AND user_id = $1::uuid AND revoked_at IS NULL
      RETURNING id::text`,
    [userId, sessionId, reason.slice(0, 120)]
  );
  return rows.length > 0;
}

export async function revokeOtherPgSessions(userId: string, currentToken: string, reason = 'revoke_others'): Promise<number> {
  const currentHash = crypto.createHash('sha256').update(currentToken).digest('hex');
  const rows = await query<{ id: string }>(
    `UPDATE djassa_sessions
        SET revoked_at = now(), revoked_reason = $3
      WHERE user_id = $1::uuid AND token_hash <> $2 AND revoked_at IS NULL
      RETURNING id::text`,
    [userId, currentHash, reason.slice(0, 120)]
  );
  return rows.length;
}

export async function rotatePgSession(input: {
  oldToken: string;
  newToken: string;
  userId: string;
  membershipId: string;
  deviceLabel?: string;
  ipAddress?: string;
  expiresAt: Date;
}): Promise<string> {
  const oldHash = crypto.createHash('sha256').update(input.oldToken).digest('hex');
  const newHash = crypto.createHash('sha256').update(input.newToken).digest('hex');
  return withTransaction(async (client) => {
    const rev = await client.query<{ id: string }>(
      `UPDATE djassa_sessions
          SET revoked_at = now(), revoked_reason = 'rotated'
        WHERE token_hash = $1 AND user_id = $2::uuid AND revoked_at IS NULL AND expires_at > now()
        RETURNING id::text`,
      [oldHash, input.userId]
    );
    if (!rev.rows[0]) {
      throw new Error('SESSION_ROTATION_INVALID');
    }
    const ins = await client.query<{ id: string }>(
      `INSERT INTO djassa_sessions(user_id, membership_id, token_hash, device_label, ip_address, expires_at)
       VALUES($1::uuid, $2::uuid, $3, $4, $5::inet, $6::timestamptz)
       RETURNING id::text`,
      [
        input.userId,
        input.membershipId,
        newHash,
        input.deviceLabel || null,
        input.ipAddress || null,
        input.expiresAt.toISOString()
      ]
    );
    return ins.rows[0].id;
  });
}

export async function updatePgUserPassword(userId: string, newPassword: string): Promise<void> {
  const encoded = makePgPasswordHash(newPassword);
  await query(
    `UPDATE djassa_credentials
        SET password_hash = $2, password_changed_at = now(), failed_attempts = 0, locked_until = NULL
      WHERE user_id = $1::uuid`,
    [userId, encoded]
  );
}

export async function updatePgUserProfile(input: {
  userId: string;
  displayName?: string;
  phone?: string;
  metadataPatch?: Record<string, unknown>;
}): Promise<{ id: string; email: string; displayName: string; phone: string | null; status: PgAccountStatus }> {
  return withTransaction(async (client) => {
    const rows = await client.query<{
      id: string;
      email: string;
      displayName: string;
      phone: string | null;
      status: PgAccountStatus;
    }>(
      `UPDATE djassa_users
          SET display_name = COALESCE(NULLIF($2, ''), display_name),
              phone = COALESCE($3, phone),
              updated_at = now()
        WHERE id = $1::uuid
        RETURNING id::text, email, display_name AS "displayName", phone, status`,
      [input.userId, input.displayName?.trim() || null, input.phone !== undefined ? input.phone.trim() || null : null]
    );
    if (!rows.rows[0]) throw new Error('USER_NOT_FOUND');

    if (input.metadataPatch && Object.keys(input.metadataPatch).length > 0) {
      await client.query(
        `INSERT INTO djassa_user_profiles(user_id, role, metadata, updated_at)
         SELECT $1::uuid::text, COALESCE((SELECT role FROM djassa_memberships WHERE user_id = $1::uuid LIMIT 1), 'client'), $2::jsonb, now()
         ON CONFLICT (user_id) DO UPDATE
           SET metadata = COALESCE(djassa_user_profiles.metadata, '{}'::jsonb) || $2::jsonb,
               updated_at = now()`,
        [input.userId, JSON.stringify(input.metadataPatch)]
      );
    }
    return rows.rows[0];
  });
}

export async function updatePgAccountStatus(
  userId: string,
  status: PgAccountStatus,
  reason = 'account_status_updated'
): Promise<boolean> {
  return withTransaction(async (client) => {
    const res = await client.query<{ id: string }>(
      `UPDATE djassa_users SET status = $2, updated_at = now() WHERE id = $1::uuid RETURNING id::text`,
      [userId, status]
    );
    if (!res.rows[0]) return false;
    if (status === 'suspended' || status === 'closed') {
      const mStatus = status === 'closed' ? 'revoked' : 'suspended';
      await client.query(
        `UPDATE djassa_memberships SET status = $2, updated_at = now() WHERE user_id = $1::uuid`,
        [userId, mStatus]
      );
      await client.query(
        `UPDATE djassa_sessions SET revoked_at = now(), revoked_reason = $2 WHERE user_id = $1::uuid AND revoked_at IS NULL`,
        [userId, reason.slice(0, 120)]
      );
    } else if (status === 'active') {
      await client.query(
        `UPDATE djassa_memberships SET status = 'active', activated_at = COALESCE(activated_at, now()), updated_at = now() WHERE user_id = $1::uuid`,
        [userId]
      );
    }
    return true;
  });
}

export async function listPgUsersPublic(): Promise<Array<{
  id: string;
  email: string;
  name: string;
  phone: string;
  role: PgAuthRole;
  tenantId: string;
  status: PgAccountStatus;
  createdAt: string;
  updatedAt: string;
}>> {
  return query(
    `SELECT u.id::text AS id,
            u.email,
            u.display_name AS name,
            COALESCE(u.phone, '') AS phone,
            m.role,
            COALESCE(m.tenant_id::text, u.id::text) AS "tenantId",
            u.status,
            u.created_at::text AS "createdAt",
            u.updated_at::text AS "updatedAt"
       FROM djassa_users u
       JOIN djassa_memberships m ON m.user_id = u.id
      ORDER BY u.created_at DESC
      LIMIT 500`
  );
}

