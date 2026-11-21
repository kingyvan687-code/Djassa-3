import type { Express, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import {
  createPgIdentity,
  findPgIdentityByEmail,
  recordPgLoginFailure,
  resetPgLoginFailures,
  createPgSession,
  resolvePgSession,
  revokePgSession,
  verifyPgPassword,
  listPgUserSessions,
  revokePgSessionById,
  revokeOtherPgSessions,
  rotatePgSession,
  updatePgUserPassword,
  updatePgUserProfile,
  updatePgAccountStatus,
  listPgUsersPublic,
  touchPgSessionLastSeen,
  type PgAuthRole
} from './postgresAuthRepository';
import { databaseHealth, query } from './database';
import {
  extractBearerToken,
  getClientIp,
  mapRoleToAccountType,
  persistSecurityDb,
  requireSecurityPermission,
  securityDb,
  signSessionToken,
  verifySignedToken,
  type SecurityActiveSession
} from './securityModule';

const ENABLED = () => process.env.DJASSA_AUTH_BACKEND === 'postgres';
const PUBLIC_ROLES: PgAuthRole[] = ['client', 'seller'];
const ALL_ROLES: PgAuthRole[] = ['client', 'seller', 'admin'];
const roleLabel: Record<PgAuthRole, string> = {
  client: 'client', seller: 'vendeur', admin: 'administrateur'
};

function parseRequestAgent(raw: string) {
  const ua = raw.toLowerCase();
  const device = /android|iphone|ipad|mobile/.test(ua) ? 'Mobile' : 'Ordinateur';
  const browser = ua.includes('edg/') ? 'Edge' : ua.includes('chrome/') ? 'Chrome' : ua.includes('firefox/') ? 'Firefox' : ua.includes('safari/') ? 'Safari' : 'Inconnu';
  const os = ua.includes('android') ? 'Android' : ua.includes('iphone') || ua.includes('ipad') ? 'iOS' : ua.includes('windows') ? 'Windows' : ua.includes('mac os') ? 'macOS' : ua.includes('linux') ? 'Linux' : 'Inconnu';
  return { device, browser, os };
}

function tokenFromRequest(req: Request): string {
  const header = req.header('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function publicUser(identity: NonNullable<Awaited<ReturnType<typeof findPgIdentityByEmail>>>) {
  return {
    id: identity.id,
    pgUuid: identity.id,
    email: identity.email,
    name: identity.displayName,
    phone: identity.phone || '',
    role: identity.role,
    tenantId: identity.tenantId || identity.id,
    kycVerified: false,
    status: identity.userStatus,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };
}

function mirrorSession(req: Request, input: {
  sid: string; userId: string; email: string; name: string; role: PgAuthRole;
  tenantId: string; expiresAt: Date;
}) {
  const ip = getClientIp(req);
  const ua = parseRequestAgent(req.header('user-agent') || '');
  const existing = securityDb.sessions.find((s) => s.sessionId === input.sid);
  const session: SecurityActiveSession = existing || {
    id: `pg-ses-${input.sid}`,
    sessionId: input.sid,
    userId: input.userId,
    userName: input.name,
    userEmail: input.email,
    accountType: mapRoleToAccountType(input.role),
    spaceRole: input.role,
    tenantId: input.tenantId,
    device: ua.device,
    browser: ua.browser,
    os: ua.os,
    location: null,
    ipAddress: ip,
    startedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    expiresAt: input.expiresAt.toISOString(),
    durationSeconds: 0,
    status: 'active',
    isNewDevice: false
  };
  if (!existing) securityDb.sessions.unshift(session);
  else {
    session.status = 'active';
    session.lastActivityAt = new Date().toISOString();
  }
  if (securityDb.sessions.length > 500) securityDb.sessions.length = 500;
  persistSecurityDb();
  return session;
}

async function recordEvent(input: {
  email: string; event: 'register'|'login_success'|'login_failure'|'logout'|'session_revoked'|'login_locked';
  role?: string; userId?: string; ip: string; userAgent: string; metadata?: Record<string, unknown>;
}) {
  await query(
    `INSERT INTO djassa_auth_events(user_id,email_snapshot,event_type,role_snapshot,ip_address,user_agent,metadata)
     VALUES($1::uuid,$2,$3,$4,$5::inet,$6,$7::jsonb)`,
    [input.userId || null, input.email, input.event, input.role || null, input.ip, input.userAgent.slice(0, 300), JSON.stringify(input.metadata || {})]
  );
}

/**
 * Transitional PostgreSQL authentication routes. Enable only after migrations and
 * legacy-account import have been verified. The session bridge below hydrates the
 * existing synchronous authorization layer from a live PostgreSQL session.
 */
export function installPostgresAuthRoutes(app: Express) {
  app.use('/api', async (req: Request, res: Response, next: NextFunction) => {
    if (!ENABLED()) return next();
    const raw = tokenFromRequest(req);
    if (!raw) return next(); // Public endpoints and legacy unauthenticated telemetry.
    const token = verifySignedToken(raw);
    if (!token) return next();
    try {
      const pgSession = await resolvePgSession(raw);
      if (!pgSession) {
        // Keep separately managed admin staff sessions on their dedicated legacy flow;
        // regular space sessions must exist in PostgreSQL once the backend is switched.
        if (token.staffId) return next();
        return res.status(401).json({ success: false, error: 'SESSION_NOT_IN_POSTGRES', message: 'Veuillez vous reconnecter.' });
      }
      if (pgSession.userId !== token.uid || pgSession.email.toLowerCase() !== token.email.toLowerCase() || pgSession.role !== token.spaceRole) {
        return res.status(401).json({ success: false, error: 'SESSION_INTEGRITY_FAILED' });
      }
      void touchPgSessionLastSeen(pgSession.sessionId).catch(() => {});
      mirrorSession(req, {
        sid: token.sid,
        userId: pgSession.userId,
        email: pgSession.email,
        name: pgSession.displayName,
        role: pgSession.role,
        tenantId: pgSession.tenantId || pgSession.userId,
        expiresAt: new Date(token.exp)
      });
      return next();
    } catch (error) {
      console.error('[DJASSA PostgreSQL auth bridge]', error instanceof Error ? error.message : 'unknown error');
      return res.status(503).json({ success: false, error: 'AUTH_DATABASE_UNAVAILABLE', message: 'Service d’authentification temporairement indisponible.' });
    }
  });

  app.post('/api/auth/register', async (req, res, next) => {
    if (!ENABLED()) return next();
    try {
      const health = await databaseHealth();
      if (!health.connected) return res.status(503).json({ success: false, error: 'DATABASE_UNAVAILABLE' });
      const { name, email, password, phone = '', role = 'client' } = req.body || {};
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const normalizedName = String(name || '').trim();
      const normalizedRole = String(role || 'client').trim().toLowerCase() as Exclude<PgAuthRole, 'admin'>;
      const pass = String(password || '');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return res.status(400).json({ success: false, error: 'INVALID_EMAIL' });
      if (normalizedName.length < 2) return res.status(400).json({ success: false, error: 'INVALID_NAME' });
      if (pass.length < 8) return res.status(400).json({ success: false, error: 'WEAK_PASSWORD' });
      if (!PUBLIC_ROLES.includes(normalizedRole)) return res.status(403).json({ success: false, error: 'INVALID_ACCOUNT_ROLE' });
      const ip = getClientIp(req);
      const tenantId = crypto.randomUUID();
      const created = await createPgIdentity({
        email: normalizedEmail, phone: String(phone || ''), displayName: normalizedName,
        role: normalizedRole, tenantId, password: pass, status: 'active'
      });
      const identity = await findPgIdentityByEmail(normalizedEmail, normalizedRole);
      if (!identity) throw new Error('IDENTITY_CREATE_VERIFY_FAILED');
      const now = Date.now();
      const ttlMs = Math.max(15, Number(securityDb.settings.sessionTtlMinutes || 480)) * 60_000;
      const sid = `pg-${crypto.randomUUID()}`;
      const token = signSessionToken({ sid, uid: created.userId, email: identity.email, name: identity.displayName,
        spaceRole: identity.role, tenantId: identity.tenantId || tenantId, iat: now, exp: now + ttlMs });
      const expiresAt = new Date(now + ttlMs);
      await createPgSession({ userId: created.userId, membershipId: created.membershipId, token,
        deviceLabel: req.header('user-agent') || 'unknown', ipAddress: ip, expiresAt });
      const session = mirrorSession(req, { sid, userId: created.userId, email: identity.email, name: identity.displayName,
        role: identity.role, tenantId: identity.tenantId || tenantId, expiresAt });
      await recordEvent({ email: identity.email, event: 'register', role: identity.role, userId: created.userId,
        ip, userAgent: req.header('user-agent') || '' });
      return res.status(201).json({ success: true, token, user: publicUser(identity), session, staff: null });
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === '23505') return res.status(409).json({ success: false, error: 'EMAIL_ALREADY_REGISTERED' });
      if ((error as Error).message === 'WEAK_PASSWORD') return res.status(400).json({ success: false, error: 'WEAK_PASSWORD' });
      console.error('[DJASSA PostgreSQL register]', error instanceof Error ? error.message : 'unknown error');
      return res.status(500).json({ success: false, error: 'REGISTRATION_FAILED' });
    }
  });

  app.post('/api/auth/login', async (req, res, next) => {
    if (!ENABLED()) return next();
    try {
      const health = await databaseHealth();
      if (!health.connected) return res.status(503).json({ success: false, error: 'DATABASE_UNAVAILABLE' });
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const requestedRole = req.body?.role ? String(req.body.role).trim().toLowerCase() as PgAuthRole : undefined;
      if (!email || !password) return res.status(400).json({ success: false, error: 'CREDENTIALS_REQUIRED' });
      if (requestedRole && !ALL_ROLES.includes(requestedRole)) return res.status(400).json({ success: false, error: 'INVALID_ACCOUNT_ROLE' });
      const identity = await findPgIdentityByEmail(email, requestedRole);
      const ip = getClientIp(req);
      const userAgent = req.header('user-agent') || '';
      if (identity?.lockedUntil && identity.lockedUntil.getTime() > Date.now()) {
        return res.status(429).json({ success: false, error: 'ACCOUNT_TEMPORARILY_LOCKED', retryAfterSeconds: Math.ceil((identity.lockedUntil.getTime() - Date.now()) / 1000) });
      }
      if (!identity || !verifyPgPassword(password, identity.passwordHash)) {
        if (identity) {
          const lock = await recordPgLoginFailure(identity.id);
          await recordEvent({ email, event: lock.lockedUntil ? 'login_locked' : 'login_failure', role: identity.role,
            userId: identity.id, ip, userAgent });
        } else {
          await recordEvent({ email, event: 'login_failure', ip, userAgent });
        }
        return res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS', message: 'Adresse e-mail ou mot de passe incorrect.' });
      }
      if (identity.userStatus !== 'active' || identity.membershipStatus !== 'active') {
        return res.status(403).json({ success: false, error: identity.userStatus === 'suspended' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_NOT_ACTIVE' });
      }
      await resetPgLoginFailures(identity.id);
      const now = Date.now();
      const ttlMs = Math.max(15, Number(securityDb.settings.sessionTtlMinutes || 480)) * 60_000;
      const sid = `pg-${crypto.randomUUID()}`;
      const tenantId = identity.tenantId || identity.id;
      const token = signSessionToken({ sid, uid: identity.id, email: identity.email, name: identity.displayName,
        spaceRole: identity.role, tenantId, iat: now, exp: now + ttlMs });
      const expiresAt = new Date(now + ttlMs);
      await createPgSession({ userId: identity.id, membershipId: identity.membershipId, token,
        deviceLabel: userAgent, ipAddress: ip, expiresAt });
      const session = mirrorSession(req, { sid, userId: identity.id, email: identity.email, name: identity.displayName,
        role: identity.role, tenantId, expiresAt });
      await recordEvent({ email: identity.email, event: 'login_success', role: identity.role, userId: identity.id, ip, userAgent });
      return res.json({ success: true, token, user: publicUser(identity), session, staff: null, unusualDevice: false });
    } catch (error) {
      console.error('[DJASSA PostgreSQL login]', error instanceof Error ? error.message : 'unknown error');
      return res.status(503).json({ success: false, error: 'AUTHENTICATION_UNAVAILABLE' });
    }
  });

  app.get('/api/auth/me', async (req, res, next) => {
    if (!ENABLED()) return next();
    const raw = tokenFromRequest(req);
    const token = extractBearerToken(req);
    if (token?.staffId) return next();
    if (!raw || !token) return res.status(401).json({ success: false, error: 'TOKEN_REQUIRED' });
    try {
      const session = await resolvePgSession(raw);
      if (!session) return res.status(401).json({ success: false, error: 'SESSION_REVOKED' });
      if (session.userId !== token.uid || session.email.toLowerCase() !== token.email.toLowerCase() || session.role !== token.spaceRole) {
        return res.status(401).json({ success: false, error: 'SESSION_INTEGRITY_FAILED' });
      }
      const identity = await findPgIdentityByEmail(session.email, session.role);
      if (!identity || identity.id !== session.userId) return res.status(401).json({ success: false, error: 'USER_NOT_FOUND' });
      return res.json({ success: true, user: publicUser(identity), session: securityDb.sessions.find((s) => s.sessionId === token.sid) || null, staff: null });
    } catch {
      return res.status(503).json({ success: false, error: 'AUTH_DATABASE_UNAVAILABLE' });
    }
  });

  app.post('/api/auth/logout', async (req, res, next) => {
    if (!ENABLED()) return next();
    const raw = tokenFromRequest(req);
    const token = extractBearerToken(req);
    if (token?.staffId) return next();
    if (!raw || !token) return res.status(401).json({ success: false, error: 'TOKEN_REQUIRED' });
    try {
      const revoked = await revokePgSession(raw, 'logout');
      const cached = securityDb.sessions.find((s) => s.sessionId === token.sid);
      if (cached) { cached.status = 'revoked'; cached.revokedAt = new Date().toISOString(); cached.revokedBy = token.email; }
      persistSecurityDb();
      await recordEvent({ email: token.email, event: 'logout', role: token.spaceRole, userId: token.uid,
        ip: getClientIp(req), userAgent: req.header('user-agent') || '' });
      return res.json({ success: true, revoked, message: 'Session révoquée.' });
    } catch {
      return res.status(503).json({ success: false, error: 'AUTH_DATABASE_UNAVAILABLE' });
    }
  });

  app.post('/api/auth/reauth', async (req, res, next) => {
    if (!ENABLED()) return next();
    const raw = tokenFromRequest(req);
    const token = extractBearerToken(req);
    if (token?.staffId) return next();
    if (!raw || !token) return res.status(401).json({ success: false, error: 'TOKEN_REQUIRED' });
    try {
      const session = await resolvePgSession(raw);
      if (!session) return res.status(401).json({ success: false, error: 'SESSION_REVOKED' });
      if (session.userId !== token.uid || session.email.toLowerCase() !== token.email.toLowerCase() || session.role !== token.spaceRole) {
        return res.status(401).json({ success: false, error: 'SESSION_INTEGRITY_FAILED' });
      }
      const identity = await findPgIdentityByEmail(session.email, session.role);
      if (!identity || !verifyPgPassword(String(req.body?.password || ''), identity.passwordHash)) {
        return res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS' });
      }
      return res.json({ success: true, reauthenticated: true, reauthenticatedAt: new Date().toISOString() });
    } catch {
      return res.status(503).json({ success: false, error: 'AUTH_DATABASE_UNAVAILABLE' });
    }
  });

  app.put('/api/auth/profile', async (req, res, next) => {
    if (!ENABLED()) return next();
    const raw = tokenFromRequest(req);
    const token = extractBearerToken(req);
    if (token?.staffId) return next();
    if (!raw || !token) return res.status(401).json({ success: false, error: 'TOKEN_REQUIRED' });
    try {
      const session = await resolvePgSession(raw);
      if (!session || session.userId !== token.uid) return res.status(401).json({ success: false, error: 'SESSION_REVOKED' });
      const { name, phone, username, bio, avatar, location, commune, quartier, details } = req.body || {};
      const updated = await updatePgUserProfile({
        userId: session.userId,
        displayName: typeof name === 'string' ? name : undefined,
        phone: typeof phone === 'string' ? phone : undefined,
        metadataPatch: {
          ...(typeof username === 'string' && username.trim() ? { username: username.trim().replace(/^@+/, '') } : {}),
          ...(typeof bio === 'string' ? { bio: bio.slice(0, 500) } : {}),
          ...(typeof avatar === 'string' ? { avatar: avatar.slice(0, 2_500_000) } : {}),
          ...(typeof location === 'string' ? { location: location.slice(0, 120) } : {}),
          ...(typeof commune === 'string' ? { commune: commune.slice(0, 80) } : {}),
          ...(typeof quartier === 'string' ? { quartier: quartier.slice(0, 80) } : {}),
          ...(typeof details === 'string' ? { details: details.slice(0, 250) } : {})
        }
      });
      return res.json({ success: true, user: updated });
    } catch {
      return res.status(503).json({ success: false, error: 'PROFILE_UPDATE_FAILED' });
    }
  });

  app.post('/api/auth/change-password', async (req, res, next) => {
    if (!ENABLED()) return next();
    const raw = tokenFromRequest(req);
    const token = extractBearerToken(req);
    if (token?.staffId) return next();
    if (!raw || !token) return res.status(401).json({ success: false, error: 'TOKEN_REQUIRED' });
    try {
      const session = await resolvePgSession(raw);
      if (!session || session.userId !== token.uid) return res.status(401).json({ success: false, error: 'SESSION_REVOKED' });
      const identity = await findPgIdentityByEmail(session.email, session.role);
      const { currentPassword, newPassword } = req.body || {};
      if (!identity || !verifyPgPassword(String(currentPassword || ''), identity.passwordHash)) {
        return res.status(401).json({ success: false, error: 'INVALID_CURRENT_PASSWORD' });
      }
      await updatePgUserPassword(identity.id, String(newPassword || ''));
      await revokeOtherPgSessions(identity.id, raw, 'password_changed');
      return res.json({ success: true, message: 'Mot de passe mis à jour avec succès.' });
    } catch (err) {
      if ((err as Error).message === 'WEAK_PASSWORD') {
        return res.status(400).json({ success: false, error: 'WEAK_PASSWORD' });
      }
      return res.status(503).json({ success: false, error: 'PASSWORD_UPDATE_FAILED' });
    }
  });

  app.post('/api/auth/account-status', async (req, res, next) => {
    if (!ENABLED()) return next();
    const raw = tokenFromRequest(req);
    const token = extractBearerToken(req);
    if (token?.staffId) return next();
    if (!raw || !token) return res.status(401).json({ success: false, error: 'TOKEN_REQUIRED' });
    try {
      const session = await resolvePgSession(raw);
      if (!session || session.userId !== token.uid) return res.status(401).json({ success: false, error: 'SESSION_REVOKED' });
      const identity = await findPgIdentityByEmail(session.email, session.role);
      const { action, password } = req.body || {};
      if (action !== 'deactivate' && action !== 'delete') return res.status(400).json({ success: false, error: 'INVALID_ACTION' });
      if (!identity || !verifyPgPassword(String(password || ''), identity.passwordHash)) {
        return res.status(401).json({ success: false, error: 'INVALID_PASSWORD' });
      }
      await updatePgAccountStatus(identity.id, 'closed', `user_${action}`);
      return res.json({ success: true, status: 'closed' });
    } catch {
      return res.status(503).json({ success: false, error: 'ACCOUNT_STATUS_FAILED' });
    }
  });

  app.get('/api/auth/sessions', async (req, res, next) => {
    if (!ENABLED()) return next();
    const raw = tokenFromRequest(req);
    const token = extractBearerToken(req);
    if (token?.staffId) return next();
    if (!raw || !token) return res.status(401).json({ success: false, error: 'TOKEN_REQUIRED' });
    try {
      const session = await resolvePgSession(raw);
      if (!session || session.userId !== token.uid) return res.status(401).json({ success: false, error: 'SESSION_REVOKED' });
      const sessions = await listPgUserSessions(session.userId);
      return res.json({ success: true, currentSessionId: session.sessionId, sessions });
    } catch {
      return res.status(503).json({ success: false, error: 'AUTH_DATABASE_UNAVAILABLE' });
    }
  });

  app.post('/api/auth/sessions/rotate', async (req, res, next) => {
    if (!ENABLED()) return next();
    const raw = tokenFromRequest(req);
    const token = extractBearerToken(req);
    if (token?.staffId) return next();
    if (!raw || !token) return res.status(401).json({ success: false, error: 'TOKEN_REQUIRED' });
    try {
      const session = await resolvePgSession(raw);
      if (!session || session.userId !== token.uid) return res.status(401).json({ success: false, error: 'SESSION_REVOKED' });
      const now = Date.now();
      const ttlMs = Math.max(15, Number(securityDb.settings.sessionTtlMinutes || 480)) * 60_000;
      const newSid = `pg-${crypto.randomUUID()}`;
      const newToken = signSessionToken({
        sid: newSid,
        uid: session.userId,
        email: session.email,
        name: session.displayName,
        spaceRole: session.role,
        tenantId: session.tenantId || session.userId,
        iat: now,
        exp: now + ttlMs
      });
      const expiresAt = new Date(now + ttlMs);
      await rotatePgSession({
        oldToken: raw,
        newToken,
        userId: session.userId,
        membershipId: session.membershipId,
        deviceLabel: req.header('user-agent') || 'unknown',
        ipAddress: getClientIp(req),
        expiresAt
      });
      const mirrored = mirrorSession(req, {
        sid: newSid,
        userId: session.userId,
        email: session.email,
        name: session.displayName,
        role: session.role,
        tenantId: session.tenantId || session.userId,
        expiresAt
      });
      return res.json({ success: true, token: newToken, session: mirrored });
    } catch {
      return res.status(401).json({ success: false, error: 'SESSION_ROTATION_FAILED' });
    }
  });

  app.post('/api/auth/sessions/revoke-mine', async (req, res, next) => {
    if (!ENABLED()) return next();
    const raw = tokenFromRequest(req);
    const token = extractBearerToken(req);
    if (token?.staffId) return next();
    if (!raw || !token) return res.status(401).json({ success: false, error: 'TOKEN_REQUIRED' });
    try {
      const session = await resolvePgSession(raw);
      if (!session || session.userId !== token.uid) return res.status(401).json({ success: false, error: 'SESSION_REVOKED' });
      const targetId = String(req.body?.sessionId || '').trim();
      const ok = await revokePgSessionById(session.userId, targetId, 'user_revoked');
      if (!ok) return res.status(404).json({ success: false, error: 'SESSION_NOT_FOUND' });
      return res.json({ success: true, revokedSessionId: targetId });
    } catch {
      return res.status(503).json({ success: false, error: 'AUTH_DATABASE_UNAVAILABLE' });
    }
  });

  app.post('/api/auth/sessions/revoke-others', async (req, res, next) => {
    if (!ENABLED()) return next();
    const raw = tokenFromRequest(req);
    const token = extractBearerToken(req);
    if (token?.staffId) return next();
    if (!raw || !token) return res.status(401).json({ success: false, error: 'TOKEN_REQUIRED' });
    try {
      const session = await resolvePgSession(raw);
      if (!session || session.userId !== token.uid) return res.status(401).json({ success: false, error: 'SESSION_REVOKED' });
      const revokedCount = await revokeOtherPgSessions(session.userId, raw);
      return res.json({ success: true, revokedCount });
    } catch {
      return res.status(503).json({ success: false, error: 'AUTH_DATABASE_UNAVAILABLE' });
    }
  });

  app.get('/api/auth/users', requireSecurityPermission('viewDashboard'), async (_req, res, next) => {
    if (!ENABLED()) return next();
    try {
      const users = await listPgUsersPublic();
      return res.json({ success: true, users });
    } catch {
      return res.status(503).json({ success: false, error: 'AUTH_DATABASE_UNAVAILABLE' });
    }
  });

  app.patch('/api/auth/users/:userId/status', requireSecurityPermission('executeProtectionActions'), async (req, res, next) => {
    if (!ENABLED()) return next();
    const status = req.body?.status;
    if (!['active', 'pending', 'suspended', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, error: 'INVALID_STATUS' });
    }
    try {
      const updated = await updatePgAccountStatus(req.params.userId, status, 'admin_status_update');
      if (!updated) return res.status(404).json({ success: false, error: 'USER_NOT_FOUND' });
      return res.json({ success: true, userId: req.params.userId, status });
    } catch {
      return res.status(503).json({ success: false, error: 'AUTH_DATABASE_UNAVAILABLE' });
    }
  });
}
