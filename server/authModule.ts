import type { Express, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { databaseHealth, query, withTransaction } from './database';
import { atomicWriteJsonFile } from './atomicFileStore';
import {
  appendAuditEntry,
  authenticateSessionRequest,
  createAlertIfEnabled,
  createVerifiedStaffSessionInSecurityDb,
  getActiveSuspension,
  getApproxLocation,
  getClientIp,
  mapRoleToAccountType,
  mapRoleToSpaceRole,
  parseUserAgent,
  persistSecurityDb,
  recordFailedAdminLoginInSecurityDb,
  requireSecurityPermission,
  securityDb,
  signSessionToken,
  type PlatformSpaceRole,
  type SecurityActiveSession
} from './securityModule';
import {
  getClientProfileOverlay,
  isUsernameTaken,
  setClientProfileOverlay
} from './clientModule';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const AUTH_USERS_FILE = path.join(DATA_DIR, 'auth_users.json');

export interface AuthUserRecord {
  id: string;
  pgUuid: string;
  email: string;
  name: string;
  phone: string;
  role: PlatformSpaceRole;
  tenantId: string;
  sellerId?: string;
  driverId?: string;
  companyId?: string;
  companyName?: string;
  kycVerified: boolean;
  status: 'active' | 'pending' | 'suspended' | 'closed';
  passwordHash: string;
  passwordSalt: string;
  failedAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

export type PublicAuthUser = Omit<AuthUserRecord, 'passwordHash' | 'passwordSalt'>;

function deterministicUuid(seed: string): string {
  const hex = crypto.createHash('sha256').update(`djassa-uuid:${seed}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function hashPasswordScrypt(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return { hash: derived.toString('hex'), salt };
}

export function verifyPasswordScrypt(password: string, expectedHash: string, salt: string): boolean {
  try {
    if (!password || !expectedHash || !salt) return false;
    const actual = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    const expected = Buffer.from(expectedHash, 'hex');
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function toPublicAuthUser(u: AuthUserRecord): PublicAuthUser {
  const { passwordHash: _h, passwordSalt: _s, ...pub } = u;
  return pub;
}

interface AuthUsersStore {
  users: AuthUserRecord[];
  reauthStamps: Record<string, number>;
}

let authStore: AuthUsersStore = {
  users: [],
  reauthStamps: {}
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function persistAuthStore() {
  if (!atomicWriteJsonFile(AUTH_USERS_FILE, authStore, { context: 'AuthModule' })) {
    console.error('[AuthModule] Failed to persist auth store');
  }
}

function seedDefaultUsersIfNeeded() {
  // Demo accounts are useful for local previews only. Never create accounts
  // with predictable passwords in a production process.
  if (process.env.NODE_ENV === 'production') return;

  const now = new Date().toISOString();
  const seeds: Array<{
    id: string;
    email: string;
    name: string;
    phone: string;
    role: PlatformSpaceRole;
    tenantId: string;
    sellerId?: string;
    driverId?: string;
    companyId?: string;
    companyName?: string;
    kycVerified: boolean;
    password: string;
  }> = [
    {
      id: 'client-demo-1',
      email: 'client@djassa.ci',
      name: 'Koffi Mariam',
      phone: '+225 07 08 09 10 11',
      role: 'client',
      tenantId: 'client-demo-1',
      kycVerified: true,
      password: process.env.DJASSA_SEED_CLIENT_PASSWORD || 'Client123'
    },
    {
      id: 'seller-1',
      email: 'vendeur@djassa.ci',
      name: 'Boutique Adjamé Wax',
      phone: '+225 05 44 22 11 00',
      role: 'seller',
      tenantId: 'seller-1',
      sellerId: 'seller-1',
      kycVerified: true,
      password: process.env.DJASSA_SEED_SELLER_PASSWORD || 'Vendeur123'
    },
    {
      id: 'sec-super-admin',
      email: 'admin@djassa.ci',
      name: 'Kouassi Yves',
      phone: '+225 07 00 00 00 01',
      role: 'admin',
      tenantId: 'sec-super-admin',
      kycVerified: true,
      password: process.env.DJASSA_SEED_ADMIN_PASSWORD || 'Admin123'
    }
  ];

  let modified = false;
  for (const s of seeds) {
    const existing = authStore.users.find((u) => u.email.toLowerCase() === s.email.toLowerCase());
    if (!existing) {
      const { hash, salt } = hashPasswordScrypt(s.password);
      authStore.users.push({
        id: s.id,
        pgUuid: deterministicUuid(s.id),
        email: s.email.toLowerCase(),
        name: s.name,
        phone: s.phone,
        role: s.role,
        tenantId: s.tenantId,
        ...(s.sellerId ? { sellerId: s.sellerId } : {}),
        ...(s.driverId ? { driverId: s.driverId } : {}),
        ...(s.companyId ? { companyId: s.companyId } : {}),
        ...(s.companyName ? { companyName: s.companyName } : {}),
        kycVerified: s.kycVerified,
        status: 'active',
        passwordHash: hash,
        passwordSalt: salt,
        failedAttempts: 0,
        lockedUntil: null,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: null
      });
      modified = true;
    }
  }
  if (modified) persistAuthStore();
}

function loadAuthStore() {
  ensureDataDir();
  if (fs.existsSync(AUTH_USERS_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(AUTH_USERS_FILE, 'utf8'));
      authStore = {
        users: Array.isArray(parsed?.users) ? parsed.users : [],
        reauthStamps: parsed?.reauthStamps && typeof parsed.reauthStamps === 'object' ? parsed.reauthStamps : {}
      };
      // The bundled JSON store may contain preview/test identities from an
      // earlier export. Keep these reserved identities out of production
      // authentication even if the data file is accidentally deployed.
      if (process.env.NODE_ENV === 'production') {
        const reservedDemoIds = new Set([
          'client-demo-1',
          'seller-1',
          'sec-super-admin'
        ]);
        authStore.users = authStore.users.filter((user) =>
          !reservedDemoIds.has(user.id) &&
          !user.email.toLowerCase().endsWith('@djassa-test.ci')
        );
      }
    } catch (err) {
      console.error('[AuthModule] Failed to parse auth_users.json:', err);
    }
  }
  seedDefaultUsersIfNeeded();
}

loadAuthStore();

async function syncUserToPostgres(user: AuthUserRecord): Promise<void> {
  try {
    const health = await databaseHealth();
    if (!health.connected) return;
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO djassa_users (id, email, phone, display_name, status, updated_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (id) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           phone = EXCLUDED.phone,
           status = EXCLUDED.status,
           updated_at = now()`,
        [user.pgUuid, user.email.toLowerCase(), user.phone || null, user.name, user.status]
      );
      await client.query(
        `INSERT INTO djassa_credentials (user_id, password_hash, failed_attempts, locked_until)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           failed_attempts = EXCLUDED.failed_attempts,
           locked_until = EXCLUDED.locked_until`,
        [user.pgUuid, `scrypt:${user.passwordSalt}:${user.passwordHash}`, user.failedAttempts, user.lockedUntil]
      );
      await client.query(
        `INSERT INTO djassa_memberships (user_id, role, tenant_id, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, role, tenant_id) DO UPDATE SET status = EXCLUDED.status`,
        [
          user.pgUuid,
          user.role,
          deterministicUuid(user.tenantId),
          user.status === 'suspended' ? 'suspended' : user.status === 'closed' ? 'revoked' : 'active'
        ]
      );
    });
  } catch (err) {
    console.warn('[AuthModule] PostgreSQL user sync skipped/failed:', (err as Error).message);
  }
}

async function syncSessionToPostgres(params: {
  pgUserId: string;
  role: PlatformSpaceRole;
  token: string;
  deviceLabel: string;
  ipAddress: string;
  expiresAtIso: string;
}): Promise<void> {
  try {
    const health = await databaseHealth();
    if (!health.connected) return;
    const tokenHash = crypto.createHash('sha256').update(params.token).digest('hex');
    await withTransaction(async (client) => {
      // Bind the session to the exact active space membership. This keeps the
      // selected DJASSA space explicit instead of relying on a client-side role.
      const membership = await client.query<{ id: string }>(
        `SELECT id FROM djassa_memberships
         WHERE user_id = $1 AND role = $2 AND status = 'active'
         ORDER BY created_at ASC LIMIT 1`,
        [params.pgUserId, params.role]
      );
      await client.query(
        `INSERT INTO djassa_sessions (user_id, membership_id, token_hash, device_label, ip_address, expires_at)
         VALUES ($1, $2, $3, $4, $5::inet, $6::timestamptz)
         ON CONFLICT (token_hash) DO NOTHING`,
        [params.pgUserId, membership.rows[0]?.id || null, tokenHash, params.deviceLabel, params.ipAddress, params.expiresAtIso]
      );
    });
  } catch (err) {
    console.warn('[AuthModule] PostgreSQL session sync warning:', (err as Error).message);
  }
}

export function getAuthUserByIdOrEmail(idOrEmail: string): AuthUserRecord | undefined {
  const needle = String(idOrEmail || '').trim().toLowerCase();
  if (!needle) return undefined;
  return authStore.users.find(
    (u) =>
      u.id.toLowerCase() === needle ||
      u.email.toLowerCase() === needle ||
      (u.sellerId && u.sellerId.toLowerCase() === needle) ||
      (u.driverId && u.driverId.toLowerCase() === needle)
  );
}

export function listAuthUsersPublic(): PublicAuthUser[] {
  return authStore.users.map(toPublicAuthUser);
}

export function isSessionRecentlyReauthenticated(sessionId: string, maxAgeMs = 15 * 60_000): boolean {
  const stamp = authStore.reauthStamps[sessionId];
  return typeof stamp === 'number' && Date.now() - stamp <= maxAgeMs;
}

export function updateAuthUserStatus(idOrEmail: string, status: AuthUserRecord['status']): PublicAuthUser | null {
  const user = getAuthUserByIdOrEmail(idOrEmail);
  if (!user) return null;
  user.status = status;
  user.updatedAt = new Date().toISOString();
  persistAuthStore();
  void syncUserToPostgres(user);
  return toPublicAuthUser(user);
}

export function installAuthRoutes(app: Express) {
  // --------------------------------------------------------------------------
  // POST /api/auth/register — Inscription réelle avec hachage scrypt
  // --------------------------------------------------------------------------
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      const { name, email, password, phone = '', role = 'client', companyName } = req.body || {};
      const emailNorm = String(email || '').trim().toLowerCase();
      const nameClean = String(name || '').trim();
      const passStr = String(password || '');
      const phoneClean = String(phone || '').trim();

      if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
        return res.status(400).json({ success: false, error: 'INVALID_EMAIL', message: 'Adresse e-mail invalide.' });
      }
      if (!nameClean || nameClean.length < 2) {
        return res.status(400).json({ success: false, error: 'INVALID_NAME', message: 'Nom complet requis (min 2 caractères).' });
      }
      if (passStr.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'WEAK_PASSWORD',
          message: 'Le mot de passe doit contenir au moins 8 caractères.'
        });
      }

      const requestedRole = String(role || 'client').trim().toLowerCase();
      if (requestedRole === 'admin' || requestedRole === 'super_admin') {
        createAlertIfEnabled({
          title: 'Tentative d’auto-inscription administrateur bloquée',
          description: `L’adresse ${emailNorm} a tenté de s’inscrire avec le rôle "${requestedRole}".`,
          severity: 'critique',
          category: 'role',
          targetUserOrResource: emailNorm,
          sourceIp: ip,
          recommendedAction: 'Vérifier l’IP source et bloquer si nécessaire.'
        });
        return res.status(403).json({
          success: false,
          error: 'ADMIN_REGISTRATION_FORBIDDEN',
          message: 'Impossible de créer un compte administrateur via l’inscription publique.'
        });
      }

      const allowedRoles: PlatformSpaceRole[] = ['client', 'seller'];
      if (!allowedRoles.includes(requestedRole as PlatformSpaceRole)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_ACCOUNT_ROLE',
          message: 'Type de compte invalide. Seuls les espaces Client et Vendeur sont disponibles sur DJASSA.'
        });
      }
      const spaceRole = requestedRole as PlatformSpaceRole;

      const exists = authStore.users.find((u) => u.email.toLowerCase() === emailNorm);
      if (exists) {
        return res.status(409).json({
          success: false,
          error: 'EMAIL_ALREADY_REGISTERED',
          message: 'Un compte existe déjà avec cette adresse e-mail.'
        });
      }

      const uid = `${spaceRole}-${crypto.randomUUID().slice(0, 12)}`;
      const { hash, salt } = hashPasswordScrypt(passStr);
      const nowIso = new Date().toISOString();

      const newUser: AuthUserRecord = {
        id: uid,
        pgUuid: deterministicUuid(uid),
        email: emailNorm,
        name: nameClean,
        phone: phoneClean,
        role: spaceRole,
        tenantId: uid,
        ...(spaceRole === 'seller' ? { sellerId: uid } : {}),
        kycVerified: spaceRole === 'client',
        status: 'active',
        passwordHash: hash,
        passwordSalt: salt,
        failedAttempts: 0,
        lockedUntil: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: nowIso
      };

      authStore.users.push(newUser);
      persistAuthStore();
      await syncUserToPostgres(newUser);

      const sid = `sess-${crypto.randomUUID()}`;
      const ua = parseUserAgent(req.header('user-agent') || '');
      const location = getApproxLocation(req, ip);
      const now = Date.now();
      const ttlMs = Math.max(15, securityDb.settings.sessionTtlMinutes || 480) * 60_000;

      const sessionObj: SecurityActiveSession = {
        id: `ses-${crypto.randomUUID()}`,
        sessionId: sid,
        userId: newUser.id,
        userName: newUser.name,
        userEmail: newUser.email,
        accountType: mapRoleToAccountType(newUser.role),
        spaceRole: newUser.role,
        tenantId: newUser.tenantId,
        device: ua.device,
        browser: ua.browser,
        os: ua.os,
        location,
        ipAddress: ip,
        startedAt: nowIso,
        lastActivityAt: nowIso,
        expiresAt: new Date(now + ttlMs).toISOString(),
        durationSeconds: 0,
        status: 'active',
        isNewDevice: false
      };

      securityDb.sessions.unshift(sessionObj);
      const token = signSessionToken({
        sid,
        uid: newUser.id,
        email: newUser.email,
        name: newUser.name,
        spaceRole: newUser.role,
        tenantId: newUser.tenantId,
        iat: now,
        exp: now + ttlMs
      });

      appendAuditEntry({
        actorId: newUser.id,
        actorName: newUser.name,
        actorAccountLabel: newUser.email,
        actorRole: newUser.role,
        space: newUser.role,
        category: 'auth',
        actionType: 'user_registered',
        action: `Inscription nouveau compte (${newUser.role})`,
        target: newUser.email,
        targetType: 'account',
        entityType: 'user',
        entityId: newUser.id,
        result: 'reussi',
        severity: 'information',
        device: ua.device,
        os: ua.os,
        browser: ua.browser,
        sessionId: sid,
        beforeValue: null,
        afterValue: `${newUser.role} (${newUser.email})`,
        details: 'Mot de passe haché côté serveur via scrypt',
        ipAddress: ip
      });
      persistSecurityDb();

      void syncSessionToPostgres({
        pgUserId: newUser.pgUuid,
        role: newUser.role,
        token,
        deviceLabel: `${ua.device} (${ua.browser})`,
        ipAddress: ip,
        expiresAtIso: sessionObj.expiresAt
      });

      return res.status(201).json({
        success: true,
        token,
        user: toPublicAuthUser(newUser),
        session: sessionObj
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  // --------------------------------------------------------------------------
  // POST /api/auth/login — Authentification réelle par mot de passe scrypt
  // --------------------------------------------------------------------------
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      const ua = parseUserAgent(req.header('user-agent') || '');
      const location = getApproxLocation(req, ip);
      const { email, password } = req.body || {};
      const emailNorm = String(email || '').trim().toLowerCase();
      const passStr = String(password || '');

      if (!emailNorm || !passStr) {
        return res.status(400).json({
          success: false,
          error: 'CREDENTIALS_REQUIRED',
          message: 'Adresse e-mail et mot de passe requis.'
        });
      }

      const user = authStore.users.find((u) => u.email.toLowerCase() === emailNorm);
      if (!user) {
        securityDb.loginLogs.unshift({
          id: `lgn-${crypto.randomUUID()}`,
          accountId: emailNorm,
          accountName: emailNorm,
          accountEmail: emailNorm,
          accountType: 'client',
          ipAddress: ip,
          device: ua.device,
          browser: ua.browser,
          os: ua.os,
          location,
          timestamp: new Date().toISOString(),
          status: 'echec',
          reason: 'Compte introuvable'
        });
        persistSecurityDb();
        return res.status(401).json({
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: 'Adresse e-mail ou mot de passe incorrect.'
        });
      }

      // Check lock / suspension BEFORE verifying password
      if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
        const waitSec = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 1000);
        return res.status(429).json({
          success: false,
          error: 'ACCOUNT_TEMPORARILY_LOCKED',
          retryAfterSeconds: waitSec,
          message: `Trop de tentatives échouées. Réessayez dans ${waitSec} secondes.`
        });
      }

      if ((user.role as string) === 'driver' || (user.role as string) === 'company') {
        return res.status(403).json({
          success: false,
          error: 'SPACE_DECOMMISSIONED',
          message: 'Les espaces Livreur et Entreprise de livraison ont été supprimés de DJASSA.'
        });
      }

      if (user.status === 'closed') {
        return res.status(403).json({
          success: false,
          error: 'ACCOUNT_CLOSED',
          message: 'Ce compte a été désactivé ou supprimé.'
        });
      }

      const activeSuspension = getActiveSuspension(user.email) || getActiveSuspension(user.id);
      if (user.status === 'suspended' || activeSuspension) {
        const reason = activeSuspension?.reason || 'Compte suspendu par l’administration';
        appendAuditEntry({
          actorId: user.id,
          actorName: user.name,
          actorAccountLabel: user.email,
          actorRole: user.role,
          space: user.role,
          category: 'auth',
          actionType: 'login_blocked_suspended',
          action: 'Connexion refusée (compte suspendu)',
          target: user.email,
          targetType: 'session',
          result: 'bloque',
          severity: 'eleve',
          beforeValue: 'Suspendu',
          afterValue: 'Refusé',
          details: reason,
          ipAddress: ip
        });
        return res.status(403).json({
          success: false,
          error: 'ACCOUNT_SUSPENDED',
          message: `Ce compte est suspendu : ${reason}`
        });
      }

      const validPassword = verifyPasswordScrypt(passStr, user.passwordHash, user.passwordSalt);
      if (!validPassword) {
        user.failedAttempts = (user.failedAttempts || 0) + 1;
        const maxAttempts = securityDb.settings.maxLoginAttempts || 5;
        if (user.failedAttempts >= maxAttempts) {
          const blockMs = Math.max(1, securityDb.settings.tempBlockMinutes || 15) * 60_000;
          user.lockedUntil = new Date(Date.now() + blockMs).toISOString();
          createAlertIfEnabled({
            title: 'Blocage temporaire après tentatives répétées',
            description: `${user.failedAttempts} échecs consécutifs sur ${user.email}.`,
            severity: user.role === 'admin' ? 'critique' : 'eleve',
            category: 'auth',
            targetUserOrResource: user.email,
            sourceIp: ip,
            recommendedAction: 'Surveiller l’adresse IP source.'
          });
        }
        persistAuthStore();

        if (user.role === 'admin') {
          recordFailedAdminLoginInSecurityDb(req, {
            accountId: user.id,
            accountName: user.name,
            accountEmail: user.email,
            reason: 'Mot de passe administrateur incorrect'
          });
        } else {
          securityDb.loginLogs.unshift({
            id: `lgn-${crypto.randomUUID()}`,
            accountId: user.id,
            accountName: user.name,
            accountEmail: user.email,
            accountType: mapRoleToAccountType(user.role),
            ipAddress: ip,
            device: ua.device,
            browser: ua.browser,
            os: ua.os,
            location,
            timestamp: new Date().toISOString(),
            status: user.failedAttempts >= 3 ? 'suspect' : 'echec',
            reason: 'Mot de passe incorrect'
          });
          persistSecurityDb();
        }

        return res.status(401).json({
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: 'Adresse e-mail ou mot de passe incorrect.'
        });
      }

      // Reset failed attempt counters on success
      user.failedAttempts = 0;
      user.lockedUntil = null;
      const nowIso = new Date().toISOString();
      user.lastLoginAt = nowIso;
      user.updatedAt = nowIso;
      persistAuthStore();
      void syncUserToPostgres(user);

      // Admin login uses securityDb.staff registry and verified staff session creator
      if (user.role === 'admin') {
        const staffMember =
          securityDb.staff.find((s) => s.email.toLowerCase() === user.email.toLowerCase() && s.active) ||
          (user.email === 'admin@djassa.ci' ? securityDb.staff.find((s) => s.id === 'sec-super-admin') : undefined);
        if (!staffMember) {
          return res.status(403).json({
            success: false,
            error: 'ADMIN_NOT_REGISTERED',
            message: 'Compte administrateur inactif ou non inscrit dans le répertoire sécurité.'
          });
        }
        const created = createVerifiedStaffSessionInSecurityDb(req, staffMember);
        authStore.reauthStamps[created.session.sessionId] = Date.now();
        persistAuthStore();
        void syncSessionToPostgres({
          pgUserId: user.pgUuid,
          role: user.role,
          token: created.token,
          deviceLabel: `${ua.device} (${ua.browser})`,
          ipAddress: ip,
          expiresAtIso: created.session.expiresAt
        });
        return res.json({
          success: true,
          token: created.token,
          user: toPublicAuthUser(user),
          session: created.session,
          staff: staffMember,
          unusualDevice: created.isNewDevice
        });
      }

      // Standard space user session (Client / Seller / Driver / Company)
      const sid = `sess-${crypto.randomUUID()}`;
      const now = Date.now();
      const ttlMs = Math.max(15, securityDb.settings.sessionTtlMinutes || 480) * 60_000;
      const previousSuccesses = securityDb.loginLogs.filter(
        (l) => l.accountEmail.toLowerCase() === user.email.toLowerCase() && l.status === 'reussite'
      );
      const isNewDevice =
        securityDb.settings.detectUnusualDevices &&
        previousSuccesses.length > 0 &&
        !previousSuccesses.some((l) => l.device === ua.device && l.os === ua.os && l.browser === ua.browser);

      const sessionObj: SecurityActiveSession = {
        id: `ses-${crypto.randomUUID()}`,
        sessionId: sid,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        accountType: mapRoleToAccountType(user.role),
        spaceRole: user.role,
        tenantId: user.tenantId,
        device: ua.device,
        browser: ua.browser,
        os: ua.os,
        location,
        ipAddress: ip,
        startedAt: nowIso,
        lastActivityAt: nowIso,
        expiresAt: new Date(now + ttlMs).toISOString(),
        durationSeconds: 0,
        status: isNewDevice ? 'suspect' : 'active',
        isNewDevice
      };

      securityDb.sessions.unshift(sessionObj);
      if (securityDb.sessions.length > 400) securityDb.sessions = securityDb.sessions.slice(0, 400);

      securityDb.loginLogs.unshift({
        id: `lgn-${crypto.randomUUID()}`,
        accountId: user.id,
        accountName: user.name,
        accountEmail: user.email,
        accountType: mapRoleToAccountType(user.role),
        ipAddress: ip,
        device: ua.device,
        browser: ua.browser,
        os: ua.os,
        location,
        timestamp: nowIso,
        status: isNewDevice ? 'suspect' : 'reussite',
        isNewDevice,
        reason: isNewDevice ? 'Nouvel appareil/navigateur détecté' : 'Authentification réussie'
      });
      if (securityDb.loginLogs.length > 1000) securityDb.loginLogs = securityDb.loginLogs.slice(0, 1000);

      const token = signSessionToken({
        sid,
        uid: user.id,
        email: user.email,
        name: user.name,
        spaceRole: user.role,
        tenantId: user.tenantId,
        iat: now,
        exp: now + ttlMs
      });

      authStore.reauthStamps[sid] = now;
      persistAuthStore();

      appendAuditEntry({
        actorId: user.id,
        actorName: user.name,
        actorAccountLabel: user.email,
        actorRole: user.role,
        space: user.role,
        category: 'auth',
        actionType: 'user_login_success',
        action: `Connexion vérifiée (${user.role})`,
        target: user.email,
        targetType: 'session',
        entityType: 'session',
        entityId: sid,
        result: 'reussi',
        severity: isNewDevice ? 'moyen' : 'information',
        device: ua.device,
        os: ua.os,
        browser: ua.browser,
        sessionId: sid,
        beforeValue: null,
        afterValue: `Session active (${user.role})`,
        details: isNewDevice ? 'Nouvel appareil détecté' : 'Connexion standard par mot de passe scrypt',
        ipAddress: ip
      });
      persistSecurityDb();

      void syncSessionToPostgres({
        pgUserId: user.pgUuid,
        role: user.role,
        token,
        deviceLabel: `${ua.device} (${ua.browser})`,
        ipAddress: ip,
        expiresAtIso: sessionObj.expiresAt
      });

      return res.json({
        success: true,
        token,
        user: toPublicAuthUser(user),
        session: sessionObj,
        staff: null,
        unusualDevice: isNewDevice
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  // --------------------------------------------------------------------------
  // GET /api/auth/me — Vérité serveur sur la session courante
  // --------------------------------------------------------------------------
  app.get('/api/auth/me', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const user = getAuthUserByIdOrEmail(authCtx.token.uid) || getAuthUserByIdOrEmail(authCtx.token.email);
    if (!user) {
      // Staff member created dynamically in teamModule
      if (authCtx.staff) {
        return res.json({
          success: true,
          user: {
            id: authCtx.staff.id,
            pgUuid: deterministicUuid(authCtx.staff.id),
            email: authCtx.staff.email,
            name: authCtx.staff.name,
            phone: '',
            role: 'admin',
            tenantId: authCtx.staff.id,
            kycVerified: true,
            status: authCtx.staff.active ? 'active' : 'suspended',
            failedAttempts: 0,
            lockedUntil: null,
            createdAt: authCtx.staff.createdAt,
            updatedAt: authCtx.staff.createdAt,
            lastLoginAt: authCtx.session.startedAt
          },
          session: authCtx.session,
          staff: authCtx.staff
        });
      }
      return res.status(401).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'Compte associé à la session introuvable.'
      });
    }

    return res.json({
      success: true,
      user: toPublicAuthUser(user),
      session: authCtx.session,
      staff: authCtx.staff
    });
  });

  // --------------------------------------------------------------------------
  // POST /api/auth/logout — Révocation explicite côté serveur
  // --------------------------------------------------------------------------
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    authCtx.session.status = 'revoked';
    authCtx.session.revokedBy = authCtx.token.email;
    authCtx.session.revokedAt = new Date().toISOString();
    delete authStore.reauthStamps[authCtx.session.sessionId];
    persistAuthStore();
    persistSecurityDb();

    return res.json({ success: true, message: 'Session révoquée côté serveur.' });
  });

  // --------------------------------------------------------------------------
  // POST /api/auth/reauth — Ré-authentification par mot de passe pour opérations sensibles
  // --------------------------------------------------------------------------
  app.post('/api/auth/reauth', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const { password } = req.body || {};
    const passStr = String(password || '');
    if (!passStr) {
      return res.status(400).json({ success: false, error: 'PASSWORD_REQUIRED', message: 'Mot de passe requis.' });
    }

    const user = getAuthUserByIdOrEmail(authCtx.token.uid) || getAuthUserByIdOrEmail(authCtx.token.email);
    if (!user || !verifyPasswordScrypt(passStr, user.passwordHash, user.passwordSalt)) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_REAUTH_PASSWORD',
        message: 'Mot de passe de confirmation incorrect.'
      });
    }

    authStore.reauthStamps[authCtx.session.sessionId] = Date.now();
    if (authCtx.session.status === 'reauth_required') {
      authCtx.session.status = 'active';
      persistSecurityDb();
    }
    persistAuthStore();

    return res.json({ success: true, reauthenticatedAt: new Date().toISOString() });
  });

  // --------------------------------------------------------------------------
  // Admin User Directory & Status Management
  // --------------------------------------------------------------------------
  app.get('/api/auth/users', requireSecurityPermission('viewDashboard'), (_req: Request, res: Response) => {
    res.json({ success: true, users: listAuthUsersPublic() });
  });

  app.patch(
    '/api/auth/users/:userId/status',
    requireSecurityPermission('executeProtectionActions'),
    (req: Request, res: Response) => {
      const { status } = req.body || {};
      if (!['active', 'pending', 'suspended', 'closed'].includes(status)) {
        return res.status(400).json({ success: false, error: 'INVALID_STATUS' });
      }
      const updated = updateAuthUserStatus(req.params.userId, status);
      if (!updated) {
        return res.status(404).json({ success: false, error: 'USER_NOT_FOUND' });
      }
      if (status === 'suspended' || status === 'closed') {
        const nowIso = new Date().toISOString();
        securityDb.sessions.forEach((s) => {
          if (s.userId === updated.id || s.userEmail.toLowerCase() === updated.email.toLowerCase()) {
            s.status = 'revoked';
            s.revokedBy = 'Administrateur Sécurité';
            s.revokedAt = nowIso;
          }
        });
        persistSecurityDb();
      }
      return res.json({ success: true, user: updated });
    }
  );

  // --------------------------------------------------------------------------
  // PUT /api/auth/profile — Mise à jour profil + vérification unicité @username
  // --------------------------------------------------------------------------
  app.put('/api/auth/profile', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const user = getAuthUserByIdOrEmail(authCtx.token.uid) || getAuthUserByIdOrEmail(authCtx.token.email);
    if (!user) {
      return res.status(404).json({ success: false, error: 'USER_NOT_FOUND', message: 'Utilisateur introuvable.' });
    }

    const { name, phone, username, bio, avatar, location, commune, quartier, details } = req.body || {};
    if (typeof username === 'string' && username.trim()) {
      const cleanUsername = username.trim().replace(/^@+/, '');
      if (cleanUsername.length < 3 || !/^[a-zA-Z0-9._-]+$/.test(cleanUsername)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_USERNAME',
          message: 'Le nom d’utilisateur doit contenir au moins 3 caractères alphanumériques (._-).'
        });
      }
      if (isUsernameTaken(cleanUsername, user.id)) {
        return res.status(409).json({
          success: false,
          error: 'USERNAME_ALREADY_TAKEN',
          message: `Le nom d'utilisateur @${cleanUsername} est déjà utilisé.`
        });
      }
    }

    if (typeof name === 'string' && name.trim().length >= 2) {
      user.name = name.trim().slice(0, 100);
    }
    if (typeof phone === 'string') {
      user.phone = phone.trim().slice(0, 40);
    }
    user.updatedAt = new Date().toISOString();
    persistAuthStore();
    void syncUserToPostgres(user);

    const overlay = setClientProfileOverlay(user.id, {
      ...(typeof username === 'string' && username.trim() ? { username: username.trim().replace(/^@+/, '') } : {}),
      ...(typeof bio === 'string' ? { bio: bio.slice(0, 500) } : {}),
      ...(typeof avatar === 'string' ? { avatar: avatar.slice(0, 2_500_000) } : {}),
      ...(typeof location === 'string' ? { location: location.slice(0, 120) } : {}),
      ...(typeof commune === 'string' ? { commune: commune.slice(0, 80) } : {}),
      ...(typeof quartier === 'string' ? { quartier: quartier.slice(0, 80) } : {}),
      ...(typeof details === 'string' ? { details: details.slice(0, 250) } : {})
    });

    return res.json({
      success: true,
      user: toPublicAuthUser(user),
      profile: overlay
    });
  });

  // --------------------------------------------------------------------------
  // POST /api/auth/change-password — Changement réel du mot de passe (scrypt)
  // --------------------------------------------------------------------------
  app.post('/api/auth/change-password', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const user = getAuthUserByIdOrEmail(authCtx.token.uid) || getAuthUserByIdOrEmail(authCtx.token.email);
    if (!user) {
      return res.status(404).json({ success: false, error: 'USER_NOT_FOUND', message: 'Utilisateur introuvable.' });
    }

    const { currentPassword, newPassword } = req.body || {};
    if (!verifyPasswordScrypt(String(currentPassword || ''), user.passwordHash, user.passwordSalt)) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CURRENT_PASSWORD',
        message: 'Le mot de passe actuel est incorrect.'
      });
    }

    const nextPass = String(newPassword || '');
    if (nextPass.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'WEAK_PASSWORD',
        message: 'Le nouveau mot de passe doit contenir au moins 8 caractères.'
      });
    }

    const { hash, salt } = hashPasswordScrypt(nextPass);
    user.passwordHash = hash;
    user.passwordSalt = salt;
    user.updatedAt = new Date().toISOString();
    persistAuthStore();
    void syncUserToPostgres(user);

    appendAuditEntry({
      actorId: user.id,
      actorName: user.name,
      actorAccountLabel: user.email,
      actorRole: user.role,
      space: user.role,
      category: 'auth',
      actionType: 'password_changed',
      action: 'Mot de passe modifié par l’utilisateur',
      target: user.email,
      targetType: 'account',
      result: 'reussi',
      severity: 'moyen',
      beforeValue: null,
      afterValue: 'Nouveau hash scrypt',
      details: 'Changement de mot de passe vérifié côté serveur',
      ipAddress: getClientIp(req)
    });
    persistSecurityDb();

    return res.json({ success: true, message: 'Mot de passe mis à jour avec succès.' });
  });

  // --------------------------------------------------------------------------
  // POST /api/auth/account-status — Désactivation / suppression réelle du compte
  // --------------------------------------------------------------------------
  app.post('/api/auth/account-status', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const user = getAuthUserByIdOrEmail(authCtx.token.uid) || getAuthUserByIdOrEmail(authCtx.token.email);
    if (!user) {
      return res.status(404).json({ success: false, error: 'USER_NOT_FOUND' });
    }

    const { action, password } = req.body || {};
    if (action !== 'deactivate' && action !== 'delete') {
      return res.status(400).json({ success: false, error: 'INVALID_ACTION' });
    }
    if (!verifyPasswordScrypt(String(password || ''), user.passwordHash, user.passwordSalt)) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_PASSWORD',
        message: 'Mot de passe de confirmation incorrect.'
      });
    }

    user.status = 'closed';
    user.updatedAt = new Date().toISOString();
    persistAuthStore();
    void syncUserToPostgres(user);

    const nowIso = new Date().toISOString();
    securityDb.sessions.forEach((s) => {
      if (s.userId === user.id || s.userEmail.toLowerCase() === user.email.toLowerCase()) {
        s.status = 'revoked';
        s.revokedBy = user.email;
        s.revokedAt = nowIso;
      }
    });
    delete authStore.reauthStamps[authCtx.session.sessionId];
    persistAuthStore();
    persistSecurityDb();

    return res.json({
      success: true,
      status: user.status,
      message: action === 'delete' ? 'Compte supprimé et sessions révoquées.' : 'Compte désactivé et sessions révoquées.'
    });
  });

  // --------------------------------------------------------------------------
  // POST /api/auth/sessions/revoke-mine & revoke-others
  // --------------------------------------------------------------------------
  app.post('/api/auth/sessions/revoke-mine', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const targetSessionId = String(req.body?.sessionId || '').trim();
    const target = securityDb.sessions.find(
      (s) =>
        s.sessionId === targetSessionId &&
        (s.userId === authCtx.token.uid || s.userEmail.toLowerCase() === authCtx.token.email.toLowerCase())
    );
    if (!target) {
      return res.status(404).json({ success: false, error: 'SESSION_NOT_FOUND' });
    }
    target.status = 'revoked';
    target.revokedBy = authCtx.token.email;
    target.revokedAt = new Date().toISOString();
    persistSecurityDb();

    return res.json({ success: true, revokedSessionId: targetSessionId });
  });

  app.post('/api/auth/sessions/revoke-others', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const nowIso = new Date().toISOString();
    let count = 0;
    securityDb.sessions.forEach((s) => {
      const isMine =
        s.userId === authCtx.token.uid || s.userEmail.toLowerCase() === authCtx.token.email.toLowerCase();
      if (isMine && s.sessionId !== authCtx.session.sessionId && s.status !== 'revoked') {
        s.status = 'revoked';
        s.revokedBy = authCtx.token.email;
        s.revokedAt = nowIso;
        count += 1;
      }
    });
    persistSecurityDb();

    return res.json({ success: true, revokedCount: count });
  });

  app.get('/api/auth/sessions', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const mine = securityDb.sessions
      .filter((s) => s.userId === authCtx.token.uid || s.userEmail.toLowerCase() === authCtx.token.email.toLowerCase())
      .map((s) => ({
        sessionId: s.sessionId,
        device: s.device,
        browser: s.browser,
        os: s.os,
        ipAddress: s.ipAddress,
        status: s.status,
        startedAt: s.startedAt,
        lastActivityAt: s.lastActivityAt,
        expiresAt: s.expiresAt,
        current: s.sessionId === authCtx.session.sessionId
      }));
    return res.json({ success: true, currentSessionId: authCtx.session.sessionId, sessions: mine });
  });

  app.post('/api/auth/sessions/rotate', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const ttlMs = Math.max(15, securityDb.settings.sessionTtlMinutes || 480) * 60_000;
    const newSid = `sess-${crypto.randomUUID()}`;
    const prevStamp = authStore.reauthStamps[authCtx.session.sessionId];

    // Backup old status for rollback if disk persistence fails
    const prevStatus = authCtx.session.status;
    authCtx.session.status = 'revoked';
    authCtx.session.revokedBy = authCtx.token.email;
    authCtx.session.revokedAt = nowIso;

    const rotatedSession: SecurityActiveSession = {
      ...authCtx.session,
      id: `ses-${crypto.randomUUID()}`,
      sessionId: newSid,
      startedAt: nowIso,
      lastActivityAt: nowIso,
      expiresAt: new Date(now + ttlMs).toISOString(),
      durationSeconds: 0,
      status: 'active',
      revokedBy: undefined,
      revokedAt: undefined
    };
    securityDb.sessions.unshift(rotatedSession);

    if (!persistSecurityDb()) {
      securityDb.sessions = securityDb.sessions.filter((s) => s.sessionId !== newSid);
      authCtx.session.status = prevStatus;
      authCtx.session.revokedBy = undefined;
      authCtx.session.revokedAt = undefined;
      return res.status(503).json({ success: false, error: 'SESSION_PERSISTENCE_FAILED' });
    }

    if (prevStamp) authStore.reauthStamps[newSid] = prevStamp;
    delete authStore.reauthStamps[authCtx.session.sessionId];
    persistAuthStore();

    const newToken = signSessionToken({
      sid: newSid,
      uid: authCtx.token.uid,
      email: authCtx.token.email,
      name: authCtx.token.name,
      spaceRole: authCtx.token.spaceRole,
      tenantId: authCtx.token.tenantId,
      ...(authCtx.token.staffId ? { staffId: authCtx.token.staffId } : {}),
      ...(authCtx.token.secRole ? { secRole: authCtx.token.secRole } : {}),
      iat: now,
      exp: now + ttlMs
    });

    return res.json({ success: true, token: newToken, session: rotatedSession });
  });
}
