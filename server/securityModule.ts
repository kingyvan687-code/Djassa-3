import type { Express, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { validateSafeOutboundUrl } from './urlSafety';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const SECURITY_DB_FILE = path.join(DATA_DIR, 'security_db.json');
const SECRET_KEY_FILE = path.join(DATA_DIR, '.sec_hmac_key');

export type SecurityRole = 'super_admin' | 'admin' | 'security_agent' | 'other_agent';
export type PlatformSpaceRole = 'client' | 'seller' | 'admin';
export type ActivitySpace = PlatformSpaceRole | 'system';

export type ActivityCategory =
  | 'auth'
  | 'accounts'
  | 'security'
  | 'orders'
  | 'order_disputes'
  | 'privacy'
  | 'payments'
  | 'wallets'
  | 'deliveries'
  | 'products'
  | 'messaging'
  | 'admin_mgmt'
  | 'system_config'
  | 'api';

export type ActivityResultStatus = 'reussi' | 'echoue' | 'refuse' | 'bloque';

export interface FinancialTraceDetails {
  operationType: string;
  transactionId: string;
  initiatorName: string;
  initiatorId?: string;
  beneficiaryAccount: string;
  amountFcfa: number;
  feesFcfa?: number;
  commissionFcfa?: number;
  previousBalanceFcfa?: number | null;
  newBalanceFcfa?: number | null;
  status: string;
  timestamp: string;
  validationResult: string;
  channel?: string;
}

export type SecurityPermissionKey =
  | 'viewDashboard'
  | 'viewLoginLogs'
  | 'viewIntrusions'
  | 'viewCyberattacks'
  | 'manageAlerts'
  | 'executeProtectionActions'
  | 'manageSessions'
  | 'modifySettings'
  | 'managePermissions'
  | 'manageFinanceProtection'
  | 'manageIncidents';

export type SecurityAccountType =
  | 'client'
  | 'vendeur'
  | 'livreur'
  | 'entreprise de livraison'
  | 'administrateur'
  | 'agent';

export type AlertSeverityLevel = 'information' | 'faible' | 'moyen' | 'eleve' | 'critique';
export type SensitiveOperationType = 'withdrawals' | 'profile_changes' | 'role_changes' | 'api_writes' | 'orders' | 'login';

export interface SecurityStaffMember {
  id: string;
  name: string;
  email: string;
  role: SecurityRole;
  title: string;
  active: boolean;
  mfaEnabled: boolean;
  permissions: Record<SecurityPermissionKey, boolean>;
  createdAt: string;
}

export interface SecurityLoginLog {
  id: string;
  accountId: string;
  accountName: string;
  accountEmail: string;
  accountType: SecurityAccountType;
  ipAddress: string;
  device: string;
  browser: string;
  os: string;
  location: string | null;
  timestamp: string;
  status: 'reussite' | 'echec' | 'suspect';
  isNewDevice?: boolean;
  reason?: string;
}

export interface SecurityIntrusionEvent {
  id: string;
  threatType:
    | 'repeated_failed_passwords'
    | 'admin_account_attempt'
    | 'forbidden_resource_access'
    | 'privilege_escalation'
    | 'unusual_device'
    | 'anomalous_activity'
    | 'authorization_bypass'
    | 'cross_tenant_access'
    | 'compromised_credential'
    | 'phishing_attempt'
    | 'financial_tampering';
  threatLabel: string;
  targetAccountOrResource: string;
  sourceIp: string;
  timestamp: string;
  severity: 'modere' | 'eleve' | 'critique';
  status: 'detecte' | 'en_cours' | 'bloque' | 'resolu';
  details: string;
  detectedBy: 'express_middleware' | 'auth_guard' | 'session_guard' | 'rbac_guard' | 'finance_guard';
}

export interface SecurityCyberAttackEvent {
  id: string;
  attackType:
    | 'brute_force'
    | 'ddos_http_flood'
    | 'sql_injection'
    | 'xss'
    | 'anomalous_api'
    | 'bot_scanner'
    | 'malicious_upload'
    | 'waf_event';
  attackLabel: string;
  targetEndpoint: string;
  sourceIp: string;
  userAgent: string;
  timestamp: string;
  severity: 'modere' | 'eleve' | 'critique';
  blocked: boolean;
  actionTaken: string;
  sourceLayer: 'express_app_waf' | 'cloudflare_waf_webhook';
  redactedSnippet?: string;
}

export interface SecurityAlert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverityLevel;
  category?:
    | 'device'
    | 'auth'
    | 'profile'
    | 'role'
    | 'api_access'
    | 'finance'
    | 'admin_security'
    | 'session';
  timestamp: string;
  targetUserOrResource: string;
  sourceIp: string;
  status: 'nouvelle' | 'en_examen' | 'resolue';
  recommendedAction: string;
  examinedBy?: string;
  examinedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  notifiedSuperAdmin: boolean;
}

export interface SecurityActiveSession {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  accountType: SecurityAccountType;
  spaceRole?: PlatformSpaceRole;
  tenantId?: string;
  device: string;
  browser: string;
  os: string;
  location?: string | null;
  ipAddress: string;
  startedAt: string;
  lastActivityAt: string;
  expiresAt?: string;
  durationSeconds: number;
  status: 'active' | 'expired' | 'suspect' | 'reauth_required' | 'revoked';
  isNewDevice?: boolean;
  revokedBy?: string;
  revokedAt?: string;
}

export interface SecurityBlockedIp {
  id: string;
  ipAddress: string;
  reason: string;
  blockedBy: string;
  blockedAt: string;
  expiresAt: string | null;
  active: boolean;
  unblockedBy?: string;
  unblockedAt?: string;
}

export interface SecuritySuspendedAccount {
  accountId: string;
  accountName: string;
  accountEmail: string;
  accountType: SecurityAccountType;
  reason: string;
  suspendedBy: string;
  suspendedAt: string;
  expiresAt: string | null;
  active: boolean;
  compromisedFlag?: boolean;
  forcePasswordReset?: boolean;
  blockedOperations?: SensitiveOperationType[];
  reactivatedBy?: string;
  reactivatedAt?: string;
  incidentNotes?: Array<{ at: string; actor: string; note: string }>;
}

export interface SecurityIncidentRecord {
  id: string;
  accountId: string;
  accountName: string;
  accountEmail: string;
  accountType: SecurityAccountType;
  type: 'compromised_account' | 'account_suspension' | 'operation_block' | 'forced_reset' | 'financial_hold' | 'dispute_warning';
  status: 'ouvert' | 'en_verification' | 'resolu';
  severity: AlertSeverityLevel;
  summary: string;
  blockedOperations: SensitiveOperationType[];
  createdBy: string;
  createdAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
  timeline: Array<{ at: string; actor: string; action: string; details: string }>;
}

export interface FinanceLedgerEntry {
  id: string;
  accountId: string;
  accountEmail: string;
  accountName: string;
  spaceRole: 'client' | 'seller';
  type: 'credit' | 'debit' | 'hold' | 'release';
  amountFcfa: number;
  commissionFcfa?: number;
  channel: string;
  payoutTarget?: string;
  reference: string;
  status: 'valide' | 'en_attente_verification' | 'bloque_securite' | 'rejete';
  suspicionReasons?: string[];
  device?: string;
  ipAddress?: string;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface SecuritySettings {
  maxLoginAttempts: number;
  tempBlockMinutes: number;
  progressiveDelaySeconds: number;
  rateLimitPerMinute: number;
  sessionTtlMinutes: number;
  requireTwoFactorAdmins: boolean;
  requireTwoFactorSensitiveActions: boolean;
  requireReauthBeforeWithdrawals: boolean;
  maxAutoWithdrawalFcfa: number;
  alertsEnabled: boolean;
  notifySuperAdminOnCritical: boolean;
  logRetentionDays: number;
  detectSqlInjection: boolean;
  detectXss: boolean;
  detectBotScanners: boolean;
  detectUnusualDevices: boolean;
  detectMaliciousUploads: boolean;
  autoBlockOnCriticalAttack: boolean;
  cloudflareWafConnected: boolean;
  cloudflareZoneId: string;
  updatedAt: string;
  updatedBy: string;
}

export interface ProtectedAuditEntry {
  id: string;
  seq: number;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorAccountLabel?: string;
  actorRole:
    | SecurityRole
    | PlatformSpaceRole
    | 'general_admin'
    | 'finance_admin'
    | 'orders_admin'
    | 'disputes_admin'
    | 'users_admin'
    | 'security_admin'
    | 'tech_admin'
    | 'system';
  space?: ActivitySpace;
  category?: ActivityCategory;
  actionType?: string;
  action: string;
  target: string;
  targetType:
    | 'ip'
    | 'account'
    | 'session'
    | 'alert'
    | 'settings'
    | 'permissions'
    | 'finance'
    | 'incident'
    | 'system'
    | 'order'
    | 'delivery'
    | 'product'
    | 'store'
    | 'message'
    | 'privacy'
    | 'api';
  entityType?: string;
  entityId?: string;
  result?: 'succes' | 'bloque' | 'echec' | ActivityResultStatus;
  severity?: AlertSeverityLevel;
  device?: string;
  os?: string;
  browser?: string;
  sessionId?: string;
  requestId?: string;
  reason?: string;
  beforeValue: string | null;
  afterValue: string | null;
  details: string;
  ipAddress: string;
  financialTrace?: FinancialTraceDetails;
  prevHash: string;
  entryHash: string;
}

export type AdminNotificationCategory =
  | 'securite'
  | 'comptes'
  | 'commandes'
  | 'paiements'
  | 'retraits'
  | 'livraisons'
  | 'vendeurs'
  | 'livreurs'
  | 'entreprises'
  | 'equipe_admin'
  | 'api'
  | 'infrastructure'
  | 'publicite';

export type AdminNotificationPriority = 'critique' | 'eleve' | 'moyen' | 'information';
export type AdminNotificationStatus = 'nouvelle' | 'en_cours' | 'resolue' | 'escaladee';
export type AdminNotificationChannel = 'interne' | 'push' | 'email';
export type AdminNotificationChannelDeliveryStatus =
  | 'sent'
  | 'failed'
  | 'retrying'
  | 'not_configured'
  | 'skipped_pref';

export interface AdminNotificationDeliveryAttempt {
  id: string;
  channel: AdminNotificationChannel;
  status: AdminNotificationChannelDeliveryStatus;
  attemptedAt: string;
  attemptCount: number;
  details: string;
}

export interface AdminNotificationHistoryItem {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  action: string;
  statusAfter?: AdminNotificationStatus;
  comment?: string;
}

export interface AdminNotificationRecord {
  id: string;
  title: string;
  description: string;
  category: AdminNotificationCategory;
  priority: AdminNotificationPriority;
  timestamp: string;
  createdAt: string;
  lastOccurrenceAt: string;
  targetUser: string;
  targetUserId?: string;
  space: ActivitySpace;
  sourceEventId: string;
  sourceActionType?: string;
  entityType?: string;
  entityId?: string;
  sourceIp?: string;
  status: AdminNotificationStatus;
  assignedToId?: string | null;
  assignedToName?: string | null;
  escalatedToSuperAdmin?: boolean;
  escalatedAt?: string | null;
  readByAdminIds: string[];
  archived: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
  dedupKey: string;
  duplicateCount: number;
  linkedAlertId?: string;
  deliveries: AdminNotificationDeliveryAttempt[];
  history: AdminNotificationHistoryItem[];
}

export type AdminNotificationPreferences = Record<
  AdminNotificationCategory,
  { interne: boolean; push: boolean; email: boolean }
>;

export interface PushSubscriptionRecord {
  id: string;
  staffId: string;
  endpoint: string;
  userAgent: string;
  createdAt: string;
  updatedAt: string;
}

interface SecurityDatabase {
  settings: SecuritySettings;
  staff: SecurityStaffMember[];
  loginLogs: SecurityLoginLog[];
  intrusions: SecurityIntrusionEvent[];
  cyberAttacks: SecurityCyberAttackEvent[];
  alerts: SecurityAlert[];
  sessions: SecurityActiveSession[];
  blockedIps: SecurityBlockedIp[];
  suspendedAccounts: SecuritySuspendedAccount[];
  incidents: SecurityIncidentRecord[];
  financeLedger: FinanceLedgerEntry[];
  knownPayoutTargets: Record<string, string[]>;
  auditLogs: ProtectedAuditEntry[];
  adminNotifications: AdminNotificationRecord[];
  notificationPreferences: Record<string, AdminNotificationPreferences>;
  pushSubscriptions: PushSubscriptionRecord[];
  lastActivityBackupAt?: string | null;
}

export interface VerifiedTokenPayload {
  sid: string;
  uid: string;
  email: string;
  name: string;
  spaceRole: PlatformSpaceRole;
  tenantId: string;
  staffId?: string;
  secRole?: SecurityRole;
  iat: number;
  exp: number;
}

const DEFAULT_STAFF: SecurityStaffMember[] = [
  {
    id: 'sec-super-admin',
    name: 'Kouassi Yves (Super Admin)',
    email: 'admin@djassa.ci',
    role: 'super_admin',
    title: 'Super Administrateur DJASSA',
    active: true,
    mfaEnabled: true,
    permissions: {
      viewDashboard: true,
      viewLoginLogs: true,
      viewIntrusions: true,
      viewCyberattacks: true,
      manageAlerts: true,
      executeProtectionActions: true,
      manageSessions: true,
      modifySettings: true,
      managePermissions: true,
      manageFinanceProtection: true,
      manageIncidents: true
    },
    createdAt: new Date().toISOString()
  },
  {
    id: 'sec-admin-ops',
    name: 'Awa Traoré (Admin Opérations)',
    email: 'awa.traore@djassa.ci',
    role: 'admin',
    title: 'Administratrice Opérations & KYC',
    active: true,
    mfaEnabled: true,
    permissions: {
      viewDashboard: true,
      viewLoginLogs: true,
      viewIntrusions: true,
      viewCyberattacks: false,
      manageAlerts: true,
      executeProtectionActions: false,
      manageSessions: true,
      modifySettings: false,
      managePermissions: false,
      manageFinanceProtection: true,
      manageIncidents: false
    },
    createdAt: new Date().toISOString()
  },
  {
    id: 'sec-agent-soc',
    name: 'Bamba Issouf (Agent Sécurité)',
    email: 'bamba.sec@djassa.ci',
    role: 'security_agent',
    title: 'Agent Surveillance & SOC',
    active: true,
    mfaEnabled: true,
    permissions: {
      viewDashboard: true,
      viewLoginLogs: true,
      viewIntrusions: true,
      viewCyberattacks: true,
      manageAlerts: true,
      executeProtectionActions: true,
      manageSessions: true,
      modifySettings: false,
      managePermissions: false,
      manageFinanceProtection: true,
      manageIncidents: true
    },
    createdAt: new Date().toISOString()
  },
  {
    id: 'sec-other-support',
    name: 'Mamadou Diabaté (Agent Support)',
    email: 'mamadou.d@djassa.ci',
    role: 'other_agent',
    title: 'Agent Support & Litiges (Sans accès sécurité)',
    active: true,
    mfaEnabled: false,
    permissions: {
      viewDashboard: false,
      viewLoginLogs: false,
      viewIntrusions: false,
      viewCyberattacks: false,
      manageAlerts: false,
      executeProtectionActions: false,
      manageSessions: false,
      modifySettings: false,
      managePermissions: false,
      manageFinanceProtection: false,
      manageIncidents: false
    },
    createdAt: new Date().toISOString()
  }
];

const DEFAULT_SETTINGS: SecuritySettings = {
  maxLoginAttempts: 5,
  tempBlockMinutes: 15,
  progressiveDelaySeconds: 3,
  rateLimitPerMinute: 120,
  sessionTtlMinutes: 480,
  requireTwoFactorAdmins: true,
  requireTwoFactorSensitiveActions: true,
  requireReauthBeforeWithdrawals: false,
  maxAutoWithdrawalFcfa: 150000,
  alertsEnabled: true,
  notifySuperAdminOnCritical: true,
  logRetentionDays: 180,
  detectSqlInjection: true,
  detectXss: true,
  detectBotScanners: true,
  detectUnusualDevices: true,
  detectMaliciousUploads: true,
  autoBlockOnCriticalAttack: true,
  cloudflareWafConnected: false,
  cloudflareZoneId: '',
  updatedAt: new Date().toISOString(),
  updatedBy: 'Système DJASSA'
};

export let securityDb: SecurityDatabase = {
  settings: { ...DEFAULT_SETTINGS },
  staff: [...DEFAULT_STAFF],
  loginLogs: [],
  intrusions: [],
  cyberAttacks: [],
  alerts: [],
  sessions: [],
  blockedIps: [],
  suspendedAccounts: [],
  incidents: [],
  financeLedger: [],
  knownPayoutTargets: {},
  auditLogs: [],
  adminNotifications: [],
  notificationPreferences: {},
  pushSubscriptions: [],
  lastActivityBackupAt: null
};

const ipRequestBuckets = new Map<string, number[]>();
let lastIpBucketCleanupAt = 0;
const failedLoginTracker = new Map<string, { count: number; lastAttempt: number; cooldownUntil: number; blockedUntil: number | null }>();
const FAILED_LOGIN_TRACKER_MAX_ENTRIES = 20_000;
const FAILED_LOGIN_TRACKER_TTL_MS = 24 * 60 * 60 * 1000;
let lastFailedLoginTrackerCleanupAt = 0;

/** Keep the in-memory brute-force tracker bounded under distributed traffic. */
function pruneFailedLoginTracker(now = Date.now()) {
  if (now - lastFailedLoginTrackerCleanupAt < 5 * 60_000 && failedLoginTracker.size < FAILED_LOGIN_TRACKER_MAX_ENTRIES) return;
  lastFailedLoginTrackerCleanupAt = now;
  for (const [key, entry] of failedLoginTracker) {
    if (now - entry.lastAttempt > FAILED_LOGIN_TRACKER_TTL_MS) failedLoginTracker.delete(key);
  }
  while (failedLoginTracker.size >= FAILED_LOGIN_TRACKER_MAX_ENTRIES) {
    const oldestKey = failedLoginTracker.keys().next().value;
    if (oldestKey === undefined) break;
    failedLoginTracker.delete(oldestKey);
  }
}
const recentWithdrawalsTracker = new Map<string, number[]>();
const pendingMfaChallenges = new Map<string, { code: string; expiresAt: number; actorId: string }>();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getOrCreateHmacSecret(): string {
  const configured = process.env.DJASSA_SECURITY_SECRET?.trim();
  if (configured) {
    if (Buffer.byteLength(configured, 'utf8') < 32) {
      throw new Error('DJASSA_SECURITY_SECRET_TOO_SHORT: configure at least 32 bytes.');
    }
    return configured;
  }
  // Production must fail closed; provision this secret through the host's secret manager.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DJASSA_SECURITY_SECRET_REQUIRED_IN_PRODUCTION');
  }
  ensureDataDir();
  if (fs.existsSync(SECRET_KEY_FILE)) {
    const existing = fs.readFileSync(SECRET_KEY_FILE, 'utf8').trim();
    if (Buffer.byteLength(existing, 'utf8') >= 32) {
      try { fs.chmodSync(SECRET_KEY_FILE, 0o600); } catch { /* platform may not support chmod */ }
      return existing;
    }
  }
  const generated = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(SECRET_KEY_FILE, generated, { mode: 0o600 });
  try { fs.chmodSync(SECRET_KEY_FILE, 0o600); } catch { /* platform may not support chmod */ }
  return generated;
}

export const HMAC_SECRET = getOrCreateHmacSecret();

export function signSessionToken(payload: VerifiedTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', HMAC_SECRET).update(encoded).digest('base64url');
  return `djassa-sec-v1.${encoded}.${sig}`;
}

export function verifySignedToken(rawToken: string): VerifiedTokenPayload | null {
  try {
    const parts = rawToken.split('.');
    if (parts.length !== 3 || parts[0] !== 'djassa-sec-v1') return null;
    const [, encoded, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', HMAC_SECRET).update(encoded).digest('base64url');
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as VerifiedTokenPayload;
    const validRoles: PlatformSpaceRole[] = ['client', 'seller', 'admin'];
    if (
      !parsed ||
      typeof parsed.sid !== 'string' || !parsed.sid ||
      typeof parsed.uid !== 'string' || !parsed.uid ||
      typeof parsed.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.email) ||
      typeof parsed.name !== 'string' ||
      !validRoles.includes(parsed.spaceRole) ||
      typeof parsed.tenantId !== 'string' || !parsed.tenantId ||
      !Number.isFinite(parsed.iat) ||
      !Number.isFinite(parsed.exp) || parsed.exp <= Date.now() || parsed.exp <= parsed.iat
    ) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function persistSecurityDb(): boolean {
  // A unique temporary file prevents overlapping writes from sharing the same
  // staging path. fsync makes the staged contents durable before replacement.
  const tmpFile = `${SECURITY_DB_FILE}.${process.pid}.${crypto.randomUUID()}.tmp`;
  let fd: number | null = null;
  try {
    ensureDataDir();
    const serialized = JSON.stringify(securityDb, null, 2);
    fd = fs.openSync(tmpFile, 'wx', 0o600);
    fs.writeFileSync(fd, serialized, { encoding: 'utf8' });
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(tmpFile, SECURITY_DB_FILE);
    // Explicit chmod also tightens permissions when replacing an older file.
    fs.chmodSync(SECURITY_DB_FILE, 0o600);
    return true;
  } catch (err) {
    console.error('[SecurityModule] Failed to persist security DB:', err);
    if (fd !== null) {
      try { fs.closeSync(fd); } catch (closeErr) {
        console.error('[SecurityModule] Failed to close temporary security DB:', closeErr);
      }
    }
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch (cleanupErr) {
      console.error('[SecurityModule] Failed to clean temporary security DB:', cleanupErr);
    }
    return false;
  }
}

function normalizeStaffPermissions(member: SecurityStaffMember): SecurityStaffMember {
  const defaultPerms = DEFAULT_STAFF.find((d) => d.id === member.id)?.permissions || {
    viewDashboard: false,
    viewLoginLogs: false,
    viewIntrusions: false,
    viewCyberattacks: false,
    manageAlerts: false,
    executeProtectionActions: false,
    manageSessions: false,
    modifySettings: false,
    managePermissions: false,
    manageFinanceProtection: false,
    manageIncidents: false
  };
  return {
    ...member,
    mfaEnabled: typeof member.mfaEnabled === 'boolean' ? member.mfaEnabled : member.role !== 'other_agent',
    permissions: {
      ...defaultPerms,
      ...(member.permissions || {})
    }
  };
}

function loadSecurityDb() {
  ensureDataDir();
  if (fs.existsSync(SECURITY_DB_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(SECURITY_DB_FILE, 'utf8'));
      const rawStaff = Array.isArray(parsed.staff) && parsed.staff.length > 0 ? parsed.staff : DEFAULT_STAFF;
      securityDb = {
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        staff: rawStaff.map(normalizeStaffPermissions),
        loginLogs: Array.isArray(parsed.loginLogs) ? parsed.loginLogs : [],
        intrusions: Array.isArray(parsed.intrusions) ? parsed.intrusions : [],
        cyberAttacks: Array.isArray(parsed.cyberAttacks) ? parsed.cyberAttacks : [],
        alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        blockedIps: Array.isArray(parsed.blockedIps) ? parsed.blockedIps : [],
        suspendedAccounts: Array.isArray(parsed.suspendedAccounts) ? parsed.suspendedAccounts : [],
        incidents: Array.isArray(parsed.incidents) ? parsed.incidents : [],
        financeLedger: Array.isArray(parsed.financeLedger) ? parsed.financeLedger : [],
        knownPayoutTargets:
          parsed.knownPayoutTargets && typeof parsed.knownPayoutTargets === 'object'
            ? parsed.knownPayoutTargets
            : {},
        auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
        adminNotifications: Array.isArray(parsed.adminNotifications) ? parsed.adminNotifications : [],
        notificationPreferences:
          parsed.notificationPreferences && typeof parsed.notificationPreferences === 'object'
            ? parsed.notificationPreferences
            : {},
        pushSubscriptions: Array.isArray(parsed.pushSubscriptions) ? parsed.pushSubscriptions : [],
        lastActivityBackupAt: typeof parsed.lastActivityBackupAt === 'string' ? parsed.lastActivityBackupAt : null
      };
      return;
    } catch (err) {
      console.error('[SecurityModule] Corrupted security DB, initializing clean store:', err);
    }
  }
  persistSecurityDb();
}

loadSecurityDb();

const SENSITIVE_KEY_PATTERN = /(password|motdepasse|pass|secret|token|apikey|api_key|authorization|cookie|otp|pin|cvv|rib|iban)/i;

function redactSensitiveText(input: string): string {
  if (!input) return '';
  return input
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/djassa-sec-v1\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, 'djassa-sec-v1.[REDACTED]')
    .replace(/\b(AIza[0-9A-Za-z\-_]{10,})\b/g, 'AIza...[REDACTED]')
    .replace(/\b(sk-[0-9A-Za-z\-_]{10,})\b/g, 'sk-...[REDACTED]')
    .replace(/\b(pk_(?:live|test)_[0-9A-Za-z\-_]{8,})\b/gi, 'pk_...[REDACTED]')
    .replace(/\b(rk_[0-9A-Za-z\-_]{8,})\b/gi, 'rk_...[REDACTED]')
    .replace(/(password|motdepasse|mot_de_passe|token|apiKey|api_key|secret|authorization|otp|pin|cvv)\s*[:=]\s*([^\s&;,}]+)/gi, '$1=[REDACTED]')
    .replace(/\b(rib|iban|carte|card)\s*[:=]?\s*([A-Z0-9\s\-]{8,30})/gi, '$1: [MASKED]')
    .replace(/\b([A-Z]{2}\d{2}[A-Z0-9]{10,30})\b/g, '[IBAN_MASKED]')
    .slice(0, 480);
}

function sanitizePayload(obj: unknown, depth = 0): unknown {
  if (depth > 4) return '[TRUNCATED]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return redactSensitiveText(obj);
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.slice(0, 20).map((item) => sanitizePayload(item, depth + 1));
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      clean[key] = '[REDACTED]';
    } else {
      clean[key] = sanitizePayload(val, depth + 1);
    }
  }
  return clean;
}

export function getClientIp(req: Request): string {
  // Forwarded headers are client-controlled unless a trusted reverse proxy
  // overwrites them. Never trust them by default: spoofed IPs can bypass
  // rate limits, IP blocks and audit attribution.
  const trustProxyHeaders = process.env.DJASSA_TRUST_PROXY_HEADERS === 'true';
  if (trustProxyHeaders) {
    const cfIp = req.headers['cf-connecting-ip'];
    if (typeof cfIp === 'string' && cfIp.trim()) {
      return cfIp.trim();
    }
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) {
      // The trusted proxy must overwrite (not append to) this header.
      return xff.split(',')[0].trim();
    }
  }
  const raw = req.socket?.remoteAddress || req.ip || '127.0.0.1';
  return raw.startsWith('::ffff:') ? raw.slice(7) : raw;
}

export function getApproxLocation(req: Request, ip: string): string | null {
  const cfCountry = req.headers['cf-ipcountry'];
  const cfCity = req.headers['cf-ipcity'];
  if (typeof cfCity === 'string' && typeof cfCountry === 'string') {
    return `${cfCity}, ${cfCountry}`;
  }
  if (typeof cfCountry === 'string' && cfCountry !== 'XX') {
    return cfCountry;
  }
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) {
    return 'Réseau local / privé';
  }
  return null;
}

function parseUserAgent(uaRaw: string | undefined): { device: string; browser: string; os: string } {
  const ua = uaRaw || 'Navigateur inconnu';
  let os = 'Système inconnu';
  if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Navigateur Web';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Google Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/curl|python-requests|Postman|sqlmap|nikto|nmap/i.test(ua)) browser = 'Client CLI / Script';

  let device = 'Ordinateur';
  if (/Mobile|Android.*Mobile|iPhone/i.test(ua)) device = 'Smartphone Mobile';
  else if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) device = 'Tablette';
  else if (/curl|python|bot|scanner|sqlmap|nikto/i.test(ua)) device = 'Automate / Client API';

  return { device, browser, os };
}

function normalizeActivityResult(raw?: string): ActivityResultStatus {
  if (!raw || raw === 'succes' || raw === 'reussi') return 'reussi';
  if (raw === 'bloque') return 'bloque';
  if (raw === 'refuse') return 'refuse';
  if (raw === 'echec' || raw === 'echoue') return 'echoue';
  return 'reussi';
}

function inferActivitySpace(actorRole: string): ActivitySpace {
  if (actorRole === 'super_admin' || actorRole === 'admin' || actorRole === 'security_agent' || actorRole === 'other_agent') {
    return 'admin';
  }
  if (actorRole === 'seller' || actorRole === 'client' || actorRole === 'system') {
    return actorRole;
  }
  return 'client';
}

function inferActivityCategory(params: {
  category?: ActivityCategory;
  targetType: ProtectedAuditEntry['targetType'];
  action: string;
}): ActivityCategory {
  if (params.category) return params.category;
  const a = params.action.toLowerCase();
  if (params.targetType === 'api' || a.includes('api') || a.includes('rodium') || a.includes('fournisseur') || a.includes('webhook')) return 'api';
  if (params.targetType === 'session' || a.includes('connexion') || a.includes('déconnexion') || a.includes('mot de passe') || a.includes('authentification')) return 'auth';
  if (params.targetType === 'ip' || params.targetType === 'alert' || params.targetType === 'incident' || a.includes('intrusion') || a.includes('suspect') || a.includes('attaqu') || a.includes('falsification')) return 'security';
  if (params.targetType === 'permissions' || a.includes('permission') || a.includes('rôle') || a.includes('collaborateur') || a.includes('admin')) return 'admin_mgmt';
  if (params.targetType === 'settings' || params.targetType === 'system' || a.includes('paramètre') || a.includes('sauvegarde') || a.includes('configuration')) return 'system_config';
  if (params.targetType === 'order' || a.includes('commande')) return 'orders';
  if (params.targetType === 'delivery' || a.includes('livraison') || a.includes('livreur') || a.includes('colis') || a.includes('flotte')) return 'deliveries';
  if (params.targetType === 'product' || params.targetType === 'store' || a.includes('produit') || a.includes('boutique') || a.includes('prix') || a.includes('stock')) return 'products';
  if (params.targetType === 'message' || a.includes('message') || a.includes('réclamation') || a.includes('signalement')) return 'messaging';
  if (params.targetType === 'finance') {
    if (a.includes('retrait') || a.includes('portefeuille') || a.includes('solde') || a.includes('coordonnées financières')) return 'wallets';
    return 'payments';
  }
  if (params.targetType === 'account') {
    if (a.includes('suspend') || a.includes('réactiv')) return 'security';
    return 'accounts';
  }
  return 'system_config';
}

function inferActivitySeverity(params: {
  severity?: AlertSeverityLevel;
  result?: string;
  action: string;
  category: ActivityCategory;
}): AlertSeverityLevel {
  if (params.severity) return params.severity;
  const res = normalizeActivityResult(params.result);
  const a = params.action.toLowerCase();
  if (a.includes('critique') || a.includes('super admin') || a.includes('falsification') || a.includes('compromis') || a.includes('force brute') || a.includes('escalade')) {
    return 'critique';
  }
  if (res === 'bloque' || res === 'refuse') return 'eleve';
  if (res === 'echoue') return 'moyen';
  if (params.category === 'security' || params.category === 'admin_mgmt' || params.category === 'wallets') return 'moyen';
  if (params.category === 'system_config' || params.category === 'api' || params.category === 'payments') return 'faible';
  return 'information';
}

function computeEntryHash(entry: Omit<ProtectedAuditEntry, 'entryHash'>): string {
  const payloadObj: Record<string, unknown> = {
    id: entry.id,
    seq: entry.seq,
    timestamp: entry.timestamp,
    actorId: entry.actorId,
    actorName: entry.actorName,
    actorRole: entry.actorRole,
    action: entry.action,
    target: entry.target,
    targetType: entry.targetType,
    result: entry.result,
    device: entry.device,
    reason: entry.reason,
    beforeValue: entry.beforeValue,
    afterValue: entry.afterValue,
    details: entry.details,
    ipAddress: entry.ipAddress,
    prevHash: entry.prevHash
  };
  if (entry.actorAccountLabel !== undefined) payloadObj.actorAccountLabel = entry.actorAccountLabel;
  if (entry.space !== undefined) payloadObj.space = entry.space;
  if (entry.category !== undefined) payloadObj.category = entry.category;
  if (entry.actionType !== undefined) payloadObj.actionType = entry.actionType;
  if (entry.entityType !== undefined) payloadObj.entityType = entry.entityType;
  if (entry.entityId !== undefined) payloadObj.entityId = entry.entityId;
  if (entry.severity !== undefined) payloadObj.severity = entry.severity;
  if (entry.os !== undefined) payloadObj.os = entry.os;
  if (entry.browser !== undefined) payloadObj.browser = entry.browser;
  if (entry.sessionId !== undefined) payloadObj.sessionId = entry.sessionId;
  if (entry.requestId !== undefined) payloadObj.requestId = entry.requestId;
  if (entry.financialTrace !== undefined) payloadObj.financialTrace = entry.financialTrace;
  return crypto.createHash('sha256').update(JSON.stringify(payloadObj)).digest('hex');
}

export interface AppendAuditParams {
  actorId: string;
  actorName: string;
  actorAccountLabel?: string;
  actorRole: ProtectedAuditEntry['actorRole'];
  space?: ActivitySpace;
  category?: ActivityCategory;
  actionType?: string;
  action: string;
  target: string;
  targetType: ProtectedAuditEntry['targetType'];
  entityType?: string;
  entityId?: string;
  result?: 'succes' | 'bloque' | 'echec' | ActivityResultStatus;
  severity?: AlertSeverityLevel;
  device?: string;
  os?: string;
  browser?: string;
  sessionId?: string;
  requestId?: string;
  reason?: string;
  beforeValue?: string | null;
  afterValue?: string | null;
  details: string;
  ipAddress?: string;
  financialTrace?: FinancialTraceDetails;
  dedupKey?: string;
}

export function appendAuditEntry(params: AppendAuditParams): ProtectedAuditEntry {
  const latest = securityDb.auditLogs[0];
  const prevHash = latest ? latest.entryHash : 'GENESIS_00000000000000000000000000000000';
  const seq = latest ? latest.seq + 1 : 1;
  const resolvedCategory = inferActivityCategory({
    category: params.category,
    targetType: params.targetType,
    action: params.action
  });
  const resolvedResult = normalizeActivityResult(params.result);
  const resolvedSeverity = inferActivitySeverity({
    severity: params.severity,
    result: resolvedResult,
    action: params.action,
    category: resolvedCategory
  });
  const resolvedSpace = params.space || inferActivitySpace(params.actorRole);
  const resolvedActionType =
    params.actionType ||
    params.action
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 64);

  const cleanFinancialTrace: FinancialTraceDetails | undefined = params.financialTrace
    ? {
        ...params.financialTrace,
        initiatorName: redactSensitiveText(params.financialTrace.initiatorName),
        beneficiaryAccount: redactSensitiveText(params.financialTrace.beneficiaryAccount),
        validationResult: redactSensitiveText(params.financialTrace.validationResult),
        status: redactSensitiveText(params.financialTrace.status)
      }
    : undefined;

  const base: Omit<ProtectedAuditEntry, 'entryHash'> = {
    id: `aud-${crypto.randomUUID()}`,
    seq,
    timestamp: new Date().toISOString(),
    actorId: params.actorId,
    actorName: redactSensitiveText(params.actorName),
    ...(params.actorAccountLabel ? { actorAccountLabel: redactSensitiveText(params.actorAccountLabel) } : {}),
    actorRole: params.actorRole,
    space: resolvedSpace,
    category: resolvedCategory,
    actionType: resolvedActionType,
    action: redactSensitiveText(params.action),
    target: redactSensitiveText(params.target),
    targetType: params.targetType,
    entityType: params.entityType || params.targetType,
    ...(params.entityId ? { entityId: redactSensitiveText(params.entityId) } : {}),
    result: resolvedResult,
    severity: resolvedSeverity,
    device: params.device || 'Console Web',
    ...(params.os ? { os: params.os } : {}),
    ...(params.browser ? { browser: params.browser } : {}),
    ...(params.sessionId ? { sessionId: params.sessionId } : {}),
    requestId: params.requestId || `req-${crypto.randomUUID().slice(0, 12)}`,
    reason: params.reason ? redactSensitiveText(params.reason) : undefined,
    beforeValue: params.beforeValue ? redactSensitiveText(params.beforeValue) : null,
    afterValue: params.afterValue ? redactSensitiveText(params.afterValue) : null,
    details: redactSensitiveText(params.details),
    ipAddress: params.ipAddress || '127.0.0.1',
    ...(cleanFinancialTrace ? { financialTrace: cleanFinancialTrace } : {}),
    prevHash
  };
  const entry: ProtectedAuditEntry = {
    ...base,
    entryHash: computeEntryHash(base)
  };
  securityDb.auditLogs.unshift(entry);
  if (securityDb.auditLogs.length > 10000) {
    securityDb.auditLogs = securityDb.auditLogs.slice(0, 10000);
  }
  emitAdminNotificationFromAudit(entry, params.dedupKey);
  persistSecurityDb();
  return entry;
}

// ============================================================================
// CENTRALIZED ADMIN NOTIFICATIONS ENGINE, RULE MAPPER, IDEMPOTENCY & CHANNELS
// ============================================================================

const ALL_NOTIFICATION_CATEGORIES: AdminNotificationCategory[] = [
  'securite',
  'comptes',
  'commandes',
  'paiements',
  'retraits',
  'livraisons',
  'vendeurs',
  'livreurs',
  'entreprises',
  'equipe_admin',
  'api',
  'infrastructure',
  'publicite'
];

interface AdminNotificationStreamHub {
  broadcast: (payload: Record<string, unknown>) => void;
  getConnectionCount: () => number;
}

let notificationStreamHub: AdminNotificationStreamHub | null = null;
const notificationIdempotencyCache = new Map<string, { notificationId: string; expiresAt: number }>();

export function registerAdminNotificationStreamHub(hub: AdminNotificationStreamHub) {
  notificationStreamHub = hub;
}

export function authenticateAdminWebSocket(
  rawUrl: string,
  headers: Record<string, string | string[] | undefined>
):
  | { ok: true; staff: SecurityStaffMember; session: SecurityActiveSession; token: VerifiedTokenPayload }
  | { ok: false; code: number; reason: string } {
  try {
    const parsedUrl = new URL(rawUrl || '/', 'http://localhost');
    const queryToken = parsedUrl.searchParams.get('token');
    const authHeader = typeof headers['authorization'] === 'string' ? headers['authorization'] : '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const rawToken = (queryToken || bearer || '').trim();
    if (!rawToken) {
      return { ok: false, code: 4001, reason: 'AUTH_TOKEN_REQUIRED' };
    }
    const token = verifySignedToken(rawToken);
    if (!token) {
      return { ok: false, code: 4001, reason: 'INVALID_SESSION_TOKEN' };
    }
    const session = securityDb.sessions.find((s) => s.sessionId === token.sid);
    if (!session || session.status === 'revoked' || session.status === 'expired') {
      return { ok: false, code: 4001, reason: 'SESSION_REVOKED' };
    }
    if (token.spaceRole !== 'admin') {
      return { ok: false, code: 4003, reason: 'ADMIN_ROLE_REQUIRED' };
    }
    const staff = token.staffId
      ? securityDb.staff.find((s) => s.id === token.staffId && s.active) || null
      : securityDb.staff.find((s) => s.email.toLowerCase() === token.email.toLowerCase() && s.active) || null;
    if (!staff || !hasSecurityPermission(staff, 'manageAlerts')) {
      return { ok: false, code: 4003, reason: 'PERMISSION_MANAGE_ALERTS_REQUIRED' };
    }
    return { ok: true, staff, session, token };
  } catch {
    return { ok: false, code: 4001, reason: 'WEBSOCKET_AUTH_FAILED' };
  }
}

function getDefaultPreferencesForStaff(staff?: SecurityStaffMember | null): AdminNotificationPreferences {
  const isSuper = staff?.role === 'super_admin';
  const base = {} as AdminNotificationPreferences;
  for (const cat of ALL_NOTIFICATION_CATEGORIES) {
    base[cat] = {
      interne: true,
      push: cat === 'securite' || cat === 'retraits' || cat === 'paiements' || cat === 'api' || cat === 'commandes' || isSuper,
      email: cat === 'securite' || cat === 'retraits' || cat === 'api'
    };
  }
  return base;
}

function getEffectivePreferencesForStaff(staffId: string): AdminNotificationPreferences {
  const staff = securityDb.staff.find((s) => s.id === staffId) || null;
  const defaults = getDefaultPreferencesForStaff(staff);
  const saved = securityDb.notificationPreferences[staffId];
  if (!saved) return defaults;
  const merged = {} as AdminNotificationPreferences;
  for (const cat of ALL_NOTIFICATION_CATEGORIES) {
    merged[cat] = {
      interne: saved[cat]?.interne ?? defaults[cat].interne,
      push: saved[cat]?.push ?? defaults[cat].push,
      email: saved[cat]?.email ?? defaults[cat].email
    };
  }
  // Ordinary admins can never turn off critical security alerts
  if (staff && staff.role !== 'super_admin') {
    merged.securite.interne = true;
    merged.securite.push = true;
    merged.securite.email = true;
  }
  return merged;
}

function resolveNotificationRuleFromAudit(entry: ProtectedAuditEntry): {
  category: AdminNotificationCategory;
  priority: AdminNotificationPriority;
  title: string;
  description: string;
} | null {
  const actionType = (entry.actionType || '').toLowerCase();
  const actionLower = (entry.action || '').toLowerCase();
  const detailsLower = (entry.details || '').toLowerCase();
  const space = entry.space || inferActivitySpace(String(entry.actorRole));
  const sev = entry.severity || 'information';
  const res = normalizeActivityResult(entry.result);

  // Avoid infinite feedback loop when admins manage notifications themselves
  if (actionType.startsWith('notification_')) {
    return null;
  }

  let category: AdminNotificationCategory = 'infrastructure';

  // 1. Security & Surveillance
  if (
    entry.category === 'security' ||
    actionType.includes('unusual_device') ||
    actionType.includes('new_device') ||
    actionType.includes('brute_force') ||
    actionType.includes('login_failed') ||
    actionType.includes('login_blocked') ||
    actionType.includes('hijack') ||
    actionType.includes('escalation') ||
    actionType.includes('unauthorized') ||
    actionType.includes('tamper') ||
    actionType.includes('password_changed') ||
    actionType.includes('email_changed') ||
    actionType.includes('phone_changed') ||
    actionType.includes('payout_target_changed') ||
    actionType.includes('withdrawal_account_changed') ||
    actionType.includes('compromised') ||
    actionType.includes('financial_tamper') ||
    actionType.includes('sqli') ||
    actionType.includes('xss') ||
    actionType.includes('phishing') ||
    actionLower.includes('nouvel appareil') ||
    actionLower.includes('escalade') ||
    actionLower.includes('session suspect') ||
    actionLower.includes('mot de passe') ||
    actionLower.includes('coordonnées de retrait') ||
    actionLower.includes('compromis') ||
    (entry.category === 'auth' && (res === 'bloque' || res === 'refuse' || res === 'echoue' || sev === 'eleve' || sev === 'critique'))
  ) {
    category = 'securite';
  }
  // 2. API Providers
  else if (
    entry.category === 'api' ||
    actionType.startsWith('api_') ||
    actionLower.includes('solde api') ||
    actionLower.includes('plafond api') ||
    actionLower.includes('recharge api') ||
    actionLower.includes('fournisseur api')
  ) {
    category = 'api';
  }
  // 3. Advertising & Promotions
  else if (
    actionType.includes('boost') ||
    actionType.includes('campaign') ||
    actionType.includes('promo') ||
    actionLower.includes('publicit') ||
    actionLower.includes('campagne') ||
    actionLower.includes('boost') ||
    actionLower.includes('code promo')
  ) {
    category = 'publicite';
  }
  // 4. Withdrawals & Wallets
  else if (
    entry.category === 'wallets' ||
    actionType.includes('withdrawal') ||
    actionType.includes('retrait') ||
    actionType.includes('reconciliation') ||
    actionLower.includes('retrait') ||
    actionLower.includes('portefeuille') ||
    actionLower.includes('rapprochement')
  ) {
    category = 'retraits';
  }
  // 5. Payments & Refunds
  else if (
    entry.category === 'payments' ||
    actionType.includes('refund') ||
    actionType.includes('compensation') ||
    actionType.includes('payment') ||
    actionType.includes('recharge') ||
    actionLower.includes('remboursement') ||
    actionLower.includes('indemnisation') ||
    actionLower.includes('paiement')
  ) {
    category = 'paiements';
  }
  // 6. Orders
  else if (
    entry.category === 'orders' ||
    actionType.includes('order') ||
    actionType.includes('dispute') ||
    actionType.includes('litige') ||
    actionLower.includes('commande') ||
    actionLower.includes('litige')
  ) {
    category = 'commandes';
  }
  // 7. Delivery Companies (lifecycle, fleet, tariffs, delays, onboarding - archival)
  else if (
    actionType.startsWith('company_') ||
    actionLower.includes('entreprise de livraison') ||
    (String(space) === 'company' &&
      !actionType.includes('delivery') &&
      !actionType.includes('parcel') &&
      !actionType.includes('colis') &&
      !actionType.includes('order'))
  ) {
    category = 'entreprises';
  }
  // 8. Drivers (onboarding, online/offline, suspension, driver management - archival)
  else if (
    actionType.includes('driver_onboarding') ||
    actionType.includes('driver_suspended') ||
    actionType.includes('driver_added') ||
    actionType.includes('driver_removed') ||
    actionType.includes('driver_status') ||
    (String(space) === 'driver' &&
      !actionType.includes('delivery') &&
      !actionType.includes('parcel') &&
      !actionType.includes('colis') &&
      !actionLower.includes('livraison ') &&
      !actionLower.includes('colis'))
  ) {
    category = 'livreurs';
  }
  // 9. Deliveries (parcels, pickups, failures, late deliveries, POD)
  else if (
    entry.category === 'deliveries' ||
    actionType.includes('delivery') ||
    actionType.includes('parcel') ||
    actionType.includes('colis') ||
    actionLower.includes('livraison') ||
    actionLower.includes('colis')
  ) {
    category = 'livraisons';
  }
  // 10. Admin Team
  else if (entry.category === 'admin_mgmt' || actionType.includes('admin_collaborator') || actionType.includes('staff_')) {
    category = 'equipe_admin';
  }
  // 11. Infrastructure & System
  else if (entry.category === 'system_config' || space === 'system') {
    category = 'infrastructure';
  }
  // 12. Vendors
  else if (entry.category === 'products' || space === 'seller') {
    category = 'vendeurs';
  }
  // 13. Accounts & Client
  else if (entry.category === 'accounts' || entry.category === 'messaging' || space === 'client' || entry.category === 'auth') {
    category = actionLower.includes('litige') || actionLower.includes('signalement') ? 'securite' : 'comptes';
    if (actionLower.includes('signalement')) category = 'securite';
  }

  // Server-enforced priority rules
  let priority: AdminNotificationPriority = 'information';
  if (
    sev === 'critique' ||
    res === 'bloque' ||
    actionType.includes('escalation') ||
    actionType.includes('tamper') ||
    actionType.includes('compromised') ||
    actionType.includes('financial_tamper') ||
    actionType.includes('unauthorized_admin') ||
    actionType.includes('session_hijack') ||
    actionType.includes('api_recharge_failed') ||
    actionType.includes('reconciliation_gap') ||
    actionType.includes('suspicious_transaction') ||
    actionType.includes('withdrawal_failed') ||
    actionType === 'deployment_failed' ||
    actionType === 'service_outage' ||
    actionType === 'technical_error_critical' ||
    actionType === 'surveillance_anomaly_critical' ||
    actionType === 'privacy_incident_critical' ||
    actionType === 'privacy_bulk_export_blocked' ||
    actionType === 'fraud_confirmed' ||
    actionType === 'fraud_critical_hold' ||
    actionType === 'fraud_wallet_tamper' ||
    actionType === 'fraud_self_approval_blocked' ||
    actionType === 'backup_failed' ||
    actionType === 'backup_missing' ||
    actionType === 'backup_integrity_invalid' ||
    actionType === 'restore_failed' ||
    actionType === 'restore_test_failed' ||
    actionType === 'restore_prod_executed' ||
    actionType === 'dispute_urgent_alert' ||
    actionType === 'dispute_sla_overdue' ||
    actionType === 'refund_module_failed' ||
    actionType === 'compensation_failed' ||
    actionType === 'refund_module_suspicious_alert' ||
    detailsLower.includes('escalade de privilèges')
  ) {
    priority = 'critique';
  } else if (
    sev === 'eleve' ||
    res === 'refuse' ||
    actionType.includes('unusual_device') ||
    actionType.includes('new_device') ||
    actionType.includes('brute_force') ||
    actionType.includes('login_failed') ||
    actionType.includes('password_changed') ||
    actionType.includes('payout_target_changed') ||
    actionType.includes('withdrawal_account_changed') ||
    actionType.includes('api_low_balance') ||
    actionType.includes('api_cap_reached') ||
    actionType.includes('delivery_failed') ||
    actionType.includes('delivery_late') ||
    actionType.includes('order_incident') ||
    actionType.includes('dispute') ||
    actionType.includes('suspicious') ||
    actionType.includes('admin_order_refund') ||
    actionType === 'maintenance_started' ||
    actionType === 'rollback_executed' ||
    actionType === 'surveillance_anomaly_warning' ||
    actionType === 'privacy_incident_warning' ||
    actionType === 'privacy_dsar_created' ||
    actionType === 'fraud_dual_control_required' ||
    actionType === 'fraud_payment_mismatch' ||
    actionType === 'fraud_withdrawal_suspect' ||
    actionType === 'fraud_linked_accounts' ||
    actionType === 'fraud_order_anomaly' ||
    actionType === 'backup_storage_near_limit' ||
    actionType === 'backup_media_missing' ||
    actionType === 'backup_deleted' ||
    actionType === 'restore_dual_control_required' ||
    actionType === 'dispute_created' ||
    actionType === 'dispute_refund_confirmed' ||
    actionType === 'dispute_funds_released' ||
    actionType === 'dispute_decision_made' ||
    actionType === 'dispute_sanction_applied' ||
    actionType === 'refund_module_confirmed' ||
    actionType === 'compensation_confirmed' ||
    actionType === 'refund_module_dual_required' ||
    actionType === 'refund_module_approved' ||
    actionType === 'refund_module_rejected'
  ) {
    priority = 'eleve';
  } else if (
    sev === 'moyen' ||
    res === 'echoue' ||
    category === 'retraits' ||
    category === 'equipe_admin' ||
    actionType.includes('order_cancelled') ||
    actionType.includes('driver_suspended') ||
    actionType.includes('email_changed') ||
    actionType.includes('phone_changed') ||
    actionType === 'deployment_started' ||
    actionType === 'maintenance_scheduled' ||
    actionType === 'privacy_policy_published' ||
    actionType === 'backup_important_succeeded' ||
    actionType === 'restore_test_succeeded' ||
    actionType === 'dispute_assigned' ||
    actionType === 'dispute_evidence_added' ||
    actionType === 'dispute_evidence_requested' ||
    actionType === 'dispute_message_received' ||
    actionType === 'dispute_closed'
  ) {
    priority = 'moyen';
  } else {
    priority = 'information';
  }

  const title = entry.action;
  const description = entry.details || `${entry.action} — ${entry.target}`;
  return { category, priority, title, description };
}

function buildSanitizedPushSummary(notif: AdminNotificationRecord): {
  title: string;
  body: string;
  category: AdminNotificationCategory;
  priority: AdminNotificationPriority;
  notificationId: string;
} {
  // ZERO PII (no emails, phones, names, IBAN, tokens or secret keys) in browser push / webhook payloads
  const categoryLabels: Record<AdminNotificationCategory, string> = {
    securite: 'Sécurité',
    comptes: 'Comptes',
    commandes: 'Commandes',
    paiements: 'Paiements',
    retraits: 'Retraits',
    livraisons: 'Livraisons',
    vendeurs: 'Vendeurs',
    livreurs: 'Livreurs',
    entreprises: 'Entreprises',
    equipe_admin: 'Équipe Admin',
    api: 'Fournisseurs API',
    infrastructure: 'Système',
    publicite: 'Publicité'
  };
  const prioPrefix = notif.priority === 'critique' ? '[CRITIQUE]' : notif.priority === 'eleve' ? '[ÉLEVÉ]' : '[INFO]';
  return {
    title: `DJASSA Admin ${prioPrefix} • ${categoryLabels[notif.category] || notif.category}`,
    body: `Nouvelle alerte ${categoryLabels[notif.category]} (${notif.id}). Ouvrez le centre d’administration pour consulter les détails.`,
    category: notif.category,
    priority: notif.priority,
    notificationId: notif.id
  };
}

function getNotificationChannelsStatusPayload() {
  const emailUrl = (process.env.EMAIL_WEBHOOK_URL || '').trim();
  const emailProvider = emailUrl ? 'webhook' : 'none';
  const emailConfigured = Boolean(emailUrl);
  const fcmServerKey = (process.env.FCM_SERVER_KEY || '').trim();
  const pushWebhookUrl = (process.env.PUSH_WEBHOOK_URL || '').trim();
  const pushRelayConfigured = Boolean(fcmServerKey || pushWebhookUrl);
  const swExists = fs.existsSync(path.join(__dirname, '..', 'public', 'sw.js'));
  const activeWs = notificationStreamHub ? notificationStreamHub.getConnectionCount() : 0;

  return {
    interne: {
      configured: true,
      activeConnections: activeWs,
      mode: 'WebSocket temps réel (/api/admin/notifications/stream)'
    },
    push: {
      serviceWorkerScript: swExists,
      externalRelayConfigured: pushRelayConfigured,
      relayType: fcmServerKey ? 'fcm' : pushWebhookUrl ? 'webhook' : 'browser_local_only',
      subscriptionsCount: securityDb.pushSubscriptions.length,
      message: pushRelayConfigured
        ? 'Relais Firebase Cloud Messaging (FCM) actif (charge utile sans PII).'
        : 'Relais serveur FCM non configuré (FCM_PROJECT_ID / FCM_SERVER_KEY requis) ; notifications navigateur locales actives via Service Worker.'
    },
    email: {
      configured: emailConfigured,
      provider: emailProvider,
      message: emailConfigured
        ? `Canal e-mail critique actif (${emailProvider}).`
        : 'Relais e-mail non configuré (notifications assurées via WebSocket interne & FCM).'
    }
  };
}

async function dispatchExternalChannelWithRetry(
  notificationId: string,
  channel: 'push' | 'email',
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>
) {
  const urlCheck = validateSafeOutboundUrl(url);
  if (!urlCheck.safe) {
    const notif = securityDb.adminNotifications.find((n) => n.id === notificationId);
    const existing = notif?.deliveries.find((d) => d.channel === channel);
    if (existing) {
      existing.status = 'failed';
      existing.attemptCount = 1;
      existing.attemptedAt = new Date().toISOString();
      existing.details = `Bloqué par protection SSRF : ${urlCheck.reason}`;
      persistSecurityDb();
    }
    return;
  }
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(urlCheck.url!.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8_000)
      });
      const notif = securityDb.adminNotifications.find((n) => n.id === notificationId);
      if (!notif) return;
      const existing = notif.deliveries.find((d) => d.channel === channel);
      if (response.ok) {
        if (existing) {
          existing.status = 'sent';
          existing.attemptCount = attempt;
          existing.attemptedAt = new Date().toISOString();
          existing.details = `Délivré au fournisseur (HTTP ${response.status}) à la tentative ${attempt}`;
        }
        persistSecurityDb();
        notificationStreamHub?.broadcast({ type: 'notification:updated', notification: notif });
        return;
      }
      if (existing) {
        existing.status = attempt < maxAttempts ? 'retrying' : 'failed';
        existing.attemptCount = attempt;
        existing.attemptedAt = new Date().toISOString();
        existing.details = `HTTP ${response.status} (tentative ${attempt}/${maxAttempts})`;
      }
      persistSecurityDb();
    } catch (err: unknown) {
      const notif = securityDb.adminNotifications.find((n) => n.id === notificationId);
      if (!notif) return;
      const existing = notif.deliveries.find((d) => d.channel === channel);
      if (existing) {
        existing.status = attempt < maxAttempts ? 'retrying' : 'failed';
        existing.attemptCount = attempt;
        existing.attemptedAt = new Date().toISOString();
        existing.details = `${(err as Error).message || 'Erreur réseau'} (tentative ${attempt}/${maxAttempts})`;
      }
      persistSecurityDb();
    }
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
}

function dispatchNotificationChannels(notif: AdminNotificationRecord) {
  const nowIso = new Date().toISOString();
  const activeAdmins = securityDb.staff.filter((s) => s.active && hasSecurityPermission(s, 'manageAlerts'));
  const allowInterne =
    notif.priority === 'critique' ||
    activeAdmins.some((s) => getEffectivePreferencesForStaff(s.id)[notif.category]?.interne);
  const allowPush =
    notif.priority === 'critique' ||
    activeAdmins.some((s) => getEffectivePreferencesForStaff(s.id)[notif.category]?.push);
  const allowEmail =
    notif.priority === 'critique' &&
    activeAdmins.some((s) => getEffectivePreferencesForStaff(s.id)[notif.category]?.email);

  const deliveries: AdminNotificationDeliveryAttempt[] = [];
  const wsCount = notificationStreamHub ? notificationStreamHub.getConnectionCount() : 0;

  deliveries.push({
    id: `dlv-${crypto.randomUUID().slice(0, 8)}`,
    channel: 'interne',
    status: allowInterne ? 'sent' : 'skipped_pref',
    attemptedAt: nowIso,
    attemptCount: 1,
    details: allowInterne
      ? `Diffusée en temps réel (${wsCount} session(s) admin connectée(s))`
      : 'Désactivée selon les préférences pour cette catégorie non critique'
  });

  const pushUrl = process.env.PUSH_WEBHOOK_URL || (process.env.FCM_SERVER_KEY ? 'https://fcm.googleapis.com/fcm/send' : '');
  if (!allowPush) {
    deliveries.push({
      id: `dlv-${crypto.randomUUID().slice(0, 8)}`,
      channel: 'push',
      status: 'skipped_pref',
      attemptedAt: nowIso,
      attemptCount: 0,
      details: 'Canal Push désactivé pour cette catégorie non critique'
    });
  } else if (!pushUrl) {
    deliveries.push({
      id: `dlv-${crypto.randomUUID().slice(0, 8)}`,
      channel: 'push',
      status: 'not_configured',
      attemptedAt: nowIso,
      attemptCount: 0,
      details: 'Relais serveur FCM/VAPID non configuré ; notification locale SW gérée côté navigateur si autorisée.'
    });
  } else {
    deliveries.push({
      id: `dlv-${crypto.randomUUID().slice(0, 8)}`,
      channel: 'push',
      status: 'retrying',
      attemptedAt: nowIso,
      attemptCount: 1,
      details: 'Envoi vers relais Push serveur (charge utile sans PII)...'
    });
    const sanitized = buildSanitizedPushSummary(notif);
    const pushHeaders: Record<string, string> = process.env.FCM_SERVER_KEY
      ? { Authorization: `key=${process.env.FCM_SERVER_KEY}` }
      : {};
    void dispatchExternalChannelWithRetry(notif.id, 'push', pushUrl, pushHeaders, sanitized);
  }

  const emailUrl = (process.env.EMAIL_WEBHOOK_URL || '').trim();
  if (notif.priority !== 'critique' || !allowEmail) {
    deliveries.push({
      id: `dlv-${crypto.randomUUID().slice(0, 8)}`,
      channel: 'email',
      status: 'skipped_pref',
      attemptedAt: nowIso,
      attemptCount: 0,
      details:
        notif.priority !== 'critique'
          ? 'Canal e-mail réservé aux événements critiques'
          : 'E-mail désactivé par préférences'
    });
  } else if (!emailUrl) {
    deliveries.push({
      id: `dlv-${crypto.randomUUID().slice(0, 8)}`,
      channel: 'email',
      status: 'not_configured',
      attemptedAt: nowIso,
      attemptCount: 0,
      details: 'Non configuré sur le serveur (alertes routées via FCM et centre interne).'
    });
  } else {
    deliveries.push({
      id: `dlv-${crypto.randomUUID().slice(0, 8)}`,
      channel: 'email',
      status: 'retrying',
      attemptedAt: nowIso,
      attemptCount: 1,
      details: 'Dispatch alerte critique en cours...'
    });
    const adminEmails = activeAdmins.map((a) => a.email);
    const emailPayload = {
      notificationId: notif.id,
      to: adminEmails,
      title: notif.title,
      category: notif.category,
      priority: notif.priority,
      space: notif.space,
      createdAt: notif.createdAt,
      description: notif.description
    };
    void dispatchExternalChannelWithRetry(notif.id, 'email', emailUrl, {}, emailPayload);
  }

  notif.deliveries = deliveries;
}

function emitAdminNotificationFromAudit(entry: ProtectedAuditEntry, dedupKeyOverride?: string): AdminNotificationRecord | null {
  const rule = resolveNotificationRuleFromAudit(entry);
  if (!rule) return null;

  const nowMs = Date.now();
  const baseEntity = entry.entityId || entry.target || entry.actorId;
  const semanticKey = `${rule.category}:${rule.priority}:${entry.space || 'system'}:${entry.actionType || 'act'}:${baseEntity}`;
  const dedupKey = dedupKeyOverride ? `idem:${dedupKeyOverride}` : semanticKey;

  // Cleanup expired idempotency entries
  for (const [k, v] of notificationIdempotencyCache.entries()) {
    if (v.expiresAt <= nowMs) notificationIdempotencyCache.delete(k);
  }

  // Exact explicit idempotency key never duplicates even across restarts (search persisted)
  if (dedupKeyOverride) {
    const existingExact = securityDb.adminNotifications.find((n) => n.dedupKey === dedupKey);
    if (existingExact) {
      existingExact.duplicateCount = (existingExact.duplicateCount || 1) + 1;
      existingExact.lastOccurrenceAt = entry.timestamp;
      existingExact.timestamp = entry.timestamp;
      existingExact.history.unshift({
        id: `nh-${crypto.randomUUID().slice(0, 8)}`,
        at: entry.timestamp,
        actorId: 'system',
        actorName: 'Système idempotence',
        action: `Événement dédupliqué (occurrence #${existingExact.duplicateCount})`
      });
      notificationStreamHub?.broadcast({ type: 'notification:updated', notification: existingExact });
      return existingExact;
    }
  } else {
    // Merge noisy identical spikes within a 2-minute window when same open notification exists
    const recentCached = notificationIdempotencyCache.get(dedupKey);
    const windowMs = 2 * 60_000;
    const recentMatch =
      (recentCached && securityDb.adminNotifications.find((n) => n.id === recentCached.notificationId)) ||
      securityDb.adminNotifications.find(
        (n) =>
          n.dedupKey === dedupKey &&
          n.status !== 'resolue' &&
          nowMs - new Date(n.lastOccurrenceAt).getTime() <= windowMs
      );
    if (recentMatch && (entry.actionType?.includes('failed') || entry.actionType?.includes('blocked') || entry.actionType?.includes('flood') || entry.actionType?.includes('balance'))) {
      recentMatch.duplicateCount = (recentMatch.duplicateCount || 1) + 1;
      recentMatch.lastOccurrenceAt = entry.timestamp;
      recentMatch.timestamp = entry.timestamp;
      notificationStreamHub?.broadcast({ type: 'notification:updated', notification: recentMatch });
      return recentMatch;
    }
  }

  const linkedAlert = securityDb.alerts.find(
    (a) =>
      Math.abs(new Date(a.timestamp).getTime() - nowMs) <= 3000 &&
      (a.targetUserOrResource === entry.target || a.targetUserOrResource === entry.actorAccountLabel)
  );

  const notif: AdminNotificationRecord = {
    id: `ntf-${crypto.randomUUID().slice(0, 12)}`,
    title: redactSensitiveText(rule.title),
    description: redactSensitiveText(rule.description),
    category: rule.category,
    priority: rule.priority,
    timestamp: entry.timestamp,
    createdAt: entry.timestamp,
    lastOccurrenceAt: entry.timestamp,
    targetUser: redactSensitiveText(entry.actorAccountLabel || entry.actorName || entry.target),
    targetUserId: entry.actorId,
    space: entry.space || 'system',
    sourceEventId: entry.id,
    sourceActionType: entry.actionType,
    entityType: entry.entityType || entry.targetType,
    entityId: entry.entityId,
    sourceIp: entry.ipAddress,
    status: 'nouvelle',
    assignedToId: null,
    assignedToName: null,
    escalatedToSuperAdmin: rule.priority === 'critique',
    escalatedAt: rule.priority === 'critique' ? entry.timestamp : null,
    readByAdminIds: [],
    archived: false,
    archivedAt: null,
    archivedBy: null,
    dedupKey,
    duplicateCount: 1,
    linkedAlertId: linkedAlert?.id,
    deliveries: [],
    history: [
      {
        id: `nh-${crypto.randomUUID().slice(0, 8)}`,
        at: entry.timestamp,
        actorId: 'system',
        actorName: 'Moteur de règles DJASSA',
        action: `Notification générée (${rule.priority.toUpperCase()} • ${rule.category})`,
        statusAfter: 'nouvelle'
      }
    ]
  };

  dispatchNotificationChannels(notif);
  securityDb.adminNotifications.unshift(notif);
  if (securityDb.adminNotifications.length > 5000) {
    securityDb.adminNotifications = securityDb.adminNotifications.slice(0, 5000);
  }
  notificationIdempotencyCache.set(dedupKey, { notificationId: notif.id, expiresAt: nowMs + 10 * 60_000 });
  notificationStreamHub?.broadcast({ type: 'notification:created', notification: notif });
  return notif;
}

export function recordPlatformActivity(req: Request | null, params: Omit<AppendAuditParams, 'ipAddress' | 'os' | 'browser'> & { ipAddress?: string; os?: string; browser?: string }): ProtectedAuditEntry {
  const ip = params.ipAddress || (req ? getClientIp(req) : '127.0.0.1');
  const ua = req ? parseUserAgent(req.header('user-agent')) : { device: 'Serveur DJASSA', browser: 'API Backend', os: 'Linux' };
  return appendAuditEntry({
    ...params,
    ipAddress: ip,
    device: params.device || ua.device,
    os: params.os || ua.os,
    browser: params.browser || ua.browser
  });
}

function verifyAuditChainIntegrity(): { valid: boolean; totalEntries: number; brokenAtSeq?: number; lastHash: string } {
  if (securityDb.auditLogs.length === 0) {
    return { valid: true, totalEntries: 0, lastHash: 'GENESIS' };
  }
  const chronological = [...securityDb.auditLogs].reverse();
  let expectedPrevHash = chronological[0].seq === 1 ? 'GENESIS_00000000000000000000000000000000' : chronological[0].prevHash;
  for (const item of chronological) {
    const { entryHash, ...rest } = item;
    const recomputed = computeEntryHash(rest);
    if (item.prevHash !== expectedPrevHash || recomputed !== entryHash) {
      return {
        valid: false,
        totalEntries: securityDb.auditLogs.length,
        brokenAtSeq: item.seq,
        lastHash: securityDb.auditLogs[0].entryHash
      };
    }
    expectedPrevHash = entryHash;
  }
  return {
    valid: true,
    totalEntries: securityDb.auditLogs.length,
    lastHash: securityDb.auditLogs[0].entryHash
  };
}

function maskPayoutTarget(raw?: string | null): string {
  const s = String(raw || '').trim();
  if (!s) return 'Compte principal vérifié';
  if (s.length <= 4) return '****';
  return `***${s.slice(-4)}`;
}

function enforceLogRetention() {
  const days = Math.max(7, Number(securityDb.settings.logRetentionDays) || 180);
  const cutoffMs = Date.now() - days * 86_400_000;
  const expired = securityDb.auditLogs.filter((e) => {
    const t = new Date(e.timestamp).getTime();
    return !Number.isNaN(t) && t < cutoffMs;
  });
  const expiredNotifs = securityDb.adminNotifications.filter((n) => {
    const t = new Date(n.createdAt).getTime();
    return !Number.isNaN(t) && t < cutoffMs && (n.status === 'resolue' || n.archived);
  });
  if (expired.length === 0 && expiredNotifs.length === 0) return;

  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveName = `archive_retention_${stamp}.json`;
    const archivePath = path.join(BACKUPS_DIR, archiveName);
    const payload = JSON.stringify(
      {
        archivedAt: new Date().toISOString(),
        retentionDays: days,
        archivedCount: expired.length,
        archivedNotificationsCount: expiredNotifs.length,
        entries: expired,
        notifications: expiredNotifs
      },
      null,
      2
    );
    const checksum = crypto.createHash('sha256').update(payload).digest('hex');
    fs.writeFileSync(archivePath, payload, 'utf8');
    fs.writeFileSync(`${archivePath}.sha256`, `${checksum}  ${archiveName}\n`, 'utf8');

    if (expired.length > 0) {
      securityDb.auditLogs = securityDb.auditLogs.filter((e) => {
        const t = new Date(e.timestamp).getTime();
        return Number.isNaN(t) || t >= cutoffMs;
      });
      securityDb.lastActivityBackupAt = new Date().toISOString();
    }
    if (expiredNotifs.length > 0) {
      const archivedIds = new Set(expiredNotifs.map((n) => n.id));
      securityDb.adminNotifications = securityDb.adminNotifications.filter((n) => !archivedIds.has(n.id));
    }
    persistSecurityDb();
  } catch (err) {
    console.error('[SecurityModule] Retention archival error:', err);
  }
}

export function createAlertIfEnabled(params: {
  title: string;
  description: string;
  severity: AlertSeverityLevel;
  category?: SecurityAlert['category'];
  targetUserOrResource: string;
  sourceIp: string;
  recommendedAction: string;
}) {
  if (!securityDb.settings.alertsEnabled) return null;
  const nowIso = new Date().toISOString();
  const alert: SecurityAlert = {
    id: `alr-${crypto.randomUUID()}`,
    title: params.title,
    description: redactSensitiveText(params.description),
    severity: params.severity,
    category: params.category || 'auth',
    timestamp: nowIso,
    targetUserOrResource: params.targetUserOrResource,
    sourceIp: params.sourceIp,
    status: 'nouvelle',
    recommendedAction: params.recommendedAction,
    notifiedSuperAdmin: params.severity === 'critique' && securityDb.settings.notifySuperAdminOnCritical
  };
  securityDb.alerts.unshift(alert);
  if (securityDb.alerts.length > 1000) {
    securityDb.alerts = securityDb.alerts.slice(0, 1000);
  }

  // Ensure alerts emitted without an adjacent audit log also appear in Centralized Notifications
  const nowMs = Date.now();
  const mappedCategory: AdminNotificationCategory =
    params.category === 'finance' ? 'retraits' : params.category === 'api_access' ? 'api' : 'securite';
  const mappedPriority: AdminNotificationPriority =
    params.severity === 'critique'
      ? 'critique'
      : params.severity === 'eleve'
      ? 'eleve'
      : params.severity === 'moyen'
      ? 'moyen'
      : 'information';
  const targetClean = redactSensitiveText(params.targetUserOrResource);
  const existingRecent = securityDb.adminNotifications.find(
    (n) =>
      Math.abs(new Date(n.createdAt).getTime() - nowMs) <= 2500 &&
      (n.targetUser === targetClean || n.sourceIp === params.sourceIp) &&
      n.category === mappedCategory
  );
  if (existingRecent) {
    existingRecent.linkedAlertId = alert.id;
  } else {
    const dedupKey = `alr:${mappedCategory}:${targetClean}:${params.title}`;
    const notif: AdminNotificationRecord = {
      id: `ntf-${crypto.randomUUID().slice(0, 12)}`,
      title: redactSensitiveText(params.title),
      description: redactSensitiveText(params.description),
      category: mappedCategory,
      priority: mappedPriority,
      timestamp: nowIso,
      createdAt: nowIso,
      lastOccurrenceAt: nowIso,
      targetUser: targetClean,
      space: params.category === 'admin_security' || params.category === 'role' ? 'admin' : 'system',
      sourceEventId: alert.id,
      sourceIp: params.sourceIp,
      status: 'nouvelle',
      assignedToId: null,
      assignedToName: null,
      escalatedToSuperAdmin: mappedPriority === 'critique',
      escalatedAt: mappedPriority === 'critique' ? nowIso : null,
      readByAdminIds: [],
      archived: false,
      archivedAt: null,
      archivedBy: null,
      dedupKey,
      duplicateCount: 1,
      linkedAlertId: alert.id,
      deliveries: [],
      history: [
        {
          id: `nh-${crypto.randomUUID().slice(0, 8)}`,
          at: nowIso,
          actorId: 'system',
          actorName: 'Garde sécurité DJASSA',
          action: `Alerte sécurité générée (${mappedPriority.toUpperCase()})`,
          statusAfter: 'nouvelle'
        }
      ]
    };
    dispatchNotificationChannels(notif);
    securityDb.adminNotifications.unshift(notif);
    if (securityDb.adminNotifications.length > 5000) {
      securityDb.adminNotifications = securityDb.adminNotifications.slice(0, 5000);
    }
    notificationStreamHub?.broadcast({ type: 'notification:created', notification: notif });
  }

  return alert;
}

function isIpCurrentlyBlocked(ip: string): SecurityBlockedIp | undefined {
  const now = Date.now();
  return securityDb.blockedIps.find((entry) => {
    if (!entry.active || entry.ipAddress !== ip) return false;
    if (entry.expiresAt && new Date(entry.expiresAt).getTime() <= now) {
      entry.active = false;
      return false;
    }
    return true;
  });
}

export function getActiveSuspension(accountIdOrEmail: string): SecuritySuspendedAccount | undefined {
  const now = Date.now();
  const normalized = accountIdOrEmail.toLowerCase();
  return securityDb.suspendedAccounts.find((entry) => {
    if (!entry.active) return false;
    const match =
      entry.accountId.toLowerCase() === normalized ||
      entry.accountEmail.toLowerCase() === normalized;
    if (!match) return false;
    if (entry.expiresAt && new Date(entry.expiresAt).getTime() <= now) {
      entry.active = false;
      return false;
    }
    return true;
  });
}

function hasBlockedOperation(accountIdOrEmail: string, op: SensitiveOperationType): boolean {
  const normalized = accountIdOrEmail.toLowerCase();
  return securityDb.suspendedAccounts.some((entry) => {
    const match =
      entry.accountId.toLowerCase() === normalized ||
      entry.accountEmail.toLowerCase() === normalized;
    if (!match) return false;
    if (entry.active) return true;
    return Boolean(entry.blockedOperations?.includes(op));
  });
}

export function extractBearerToken(req: Request): VerifiedTokenPayload | null {
  const auth = req.header('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const raw = auth.slice(7).trim();
  return verifySignedToken(raw);
}

export interface AuthenticatedRequestContext {
  token: VerifiedTokenPayload;
  session: SecurityActiveSession;
  staff: SecurityStaffMember | null;
}

export function authenticateSessionRequest(req: Request, res: Response): AuthenticatedRequestContext | null {
  const ip = getClientIp(req);
  const token = extractBearerToken(req);
  if (!token) {
    securityDb.intrusions.unshift({
      id: `int-${crypto.randomUUID()}`,
      threatType: 'authorization_bypass',
      threatLabel: 'Accès API sans jeton de session signé',
      targetAccountOrResource: req.originalUrl,
      sourceIp: ip,
      timestamp: new Date().toISOString(),
      severity: 'eleve',
      status: 'bloque',
      details: `Requête protégée sans Bearer HMAC (${req.method} ${req.originalUrl})`,
      detectedBy: 'rbac_guard'
    });
    createAlertIfEnabled({
      title: 'Accès API non authentifié bloqué',
      description: `Tentative d’appel sans jeton valide vers ${req.originalUrl}.`,
      severity: 'eleve',
      category: 'api_access',
      targetUserOrResource: req.originalUrl,
      sourceIp: ip,
      recommendedAction: 'Vérifier l’origine de la requête.'
    });
    persistSecurityDb();
    res.status(401).json({
      success: false,
      error: 'TOKEN_REQUIRED',
      message: 'Jeton de session authentifié requis.'
    });
    return null;
  }

  const session = securityDb.sessions.find((s) => s.sessionId === token.sid);
  if (!session || session.status === 'revoked' || session.status === 'expired') {
    securityDb.intrusions.unshift({
      id: `int-${crypto.randomUUID()}`,
      threatType: 'authorization_bypass',
      threatLabel: 'Utilisation d’un jeton de session révoqué ou expiré',
      targetAccountOrResource: `${token.email} -> ${req.originalUrl}`,
      sourceIp: ip,
      timestamp: new Date().toISOString(),
      severity: 'critique',
      status: 'bloque',
      details: `Jeton ${session?.status || 'inconnu'} rejeté sur ${req.originalUrl}`,
      detectedBy: 'session_guard'
    });
    createAlertIfEnabled({
      title: 'Tentative d’utilisation d’une session révoquée',
      description: `Un jeton révoqué/expiré pour ${token.email} a tenté d’appeler ${req.originalUrl}.`,
      severity: 'critique',
      category: 'session',
      targetUserOrResource: token.email,
      sourceIp: ip,
      recommendedAction: 'Bloquer l’IP source et vérifier le compte.'
    });
    persistSecurityDb();
    res.status(401).json({
      success: false,
      error: 'SESSION_REVOKED',
      message: 'Session révoquée ou expirée : accès refusé.'
    });
    return null;
  }

  // Bind signed token claims to the server-side session record.
  const sessionEmail = String(session.userEmail || '').trim().toLowerCase();
  const tokenEmail = String(token.email || '').trim().toLowerCase();
  if (
    String(session.userId || '') !== String(token.uid || '') ||
    !sessionEmail || sessionEmail !== tokenEmail ||
    session.spaceRole !== token.spaceRole ||
    String(session.tenantId || '') !== String(token.tenantId || '')
  ) {
    session.status = 'revoked';
    session.revokedAt = new Date().toISOString();
    session.revokedBy = 'system:session-integrity-guard';
    securityDb.intrusions.unshift({
      id: `int-${crypto.randomUUID()}`,
      threatType: 'authorization_bypass',
      threatLabel: 'Incohérence entre jeton et session serveur',
      targetAccountOrResource: `${token.email || 'unknown'} -> ${req.originalUrl}`,
      sourceIp: ip,
      timestamp: new Date().toISOString(),
      severity: 'critique',
      status: 'bloque',
      details: 'Les identifiants, le rôle ou le tenant du jeton ne correspondent pas à la session serveur.',
      detectedBy: 'session_guard'
    });
    persistSecurityDb();
    res.status(401).json({
      success: false,
      error: 'SESSION_INTEGRITY_FAILED',
      message: 'Session invalide. Veuillez vous reconnecter.'
    });
    return null;
  }

  // Enforce TTL expiration
  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
    session.status = 'expired';
    persistSecurityDb();
    res.status(401).json({
      success: false,
      error: 'SESSION_EXPIRED',
      message: 'Session expirée. Veuillez vous reconnecter.'
    });
    return null;
  }

  // Enforce suspension
  const suspension = getActiveSuspension(token.email) || getActiveSuspension(token.uid);
  if (suspension) {
    res.status(403).json({
      success: false,
      error: 'ACCOUNT_SUSPENDED',
      message: `Compte suspendu par mesure de sécurité : ${suspension.reason}`
    });
    return null;
  }

  // Detect forged privilege header mismatch
  const claimedRole = req.header('x-claimed-role');
  if (claimedRole && claimedRole !== token.spaceRole && claimedRole !== token.secRole) {
    securityDb.intrusions.unshift({
      id: `int-${crypto.randomUUID()}`,
      threatType: 'privilege_escalation',
      threatLabel: "Tentative d'escalade de privilèges détectée",
      targetAccountOrResource: `${token.email} -> ${req.originalUrl}`,
      sourceIp: ip,
      timestamp: new Date().toISOString(),
      severity: 'critique',
      status: 'bloque',
      details: `Revendication de rôle "${claimedRole}" refusée (rôle vérifié: ${token.secRole || token.spaceRole})`,
      detectedBy: 'rbac_guard'
    });
    createAlertIfEnabled({
      title: 'Tentative d’escalade de privilèges bloquée',
      description: `${token.email} a tenté de se faire passer pour "${claimedRole}".`,
      severity: 'critique',
      category: 'role',
      targetUserOrResource: token.email,
      sourceIp: ip,
      recommendedAction: 'Révoquer immédiatement les sessions du compte.'
    });
    persistSecurityDb();
    res.status(403).json({
      success: false,
      error: 'PRIVILEGE_ESCALATION_BLOCKED',
      message: 'Escalade de privilèges détectée et bloquée.'
    });
    return null;
  }

  const staff = token.staffId
    ? securityDb.staff.find((s) => s.id === token.staffId && s.active) || null
    : token.spaceRole === 'admin'
    ? securityDb.staff.find((s) => s.email.toLowerCase() === token.email.toLowerCase() && s.active) || null
    : null;

  return { token, session, staff };
}

function hasSecurityPermission(actor: SecurityStaffMember | null, permission: SecurityPermissionKey): boolean {
  if (!actor || !actor.active) return false;
  if (getActiveSuspension(actor.id) || getActiveSuspension(actor.email)) return false;
  if (actor.role === 'super_admin') return true;
  if (actor.role === 'other_agent') return false;
  return Boolean(actor.permissions?.[permission]);
}

export function requireSecurityPermission(permission: SecurityPermissionKey, options?: { requireStepUpMfa?: boolean }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const ip = getClientIp(req);
    const actor = authCtx.staff;

    if (!actor || authCtx.token.spaceRole !== 'admin') {
      securityDb.intrusions.unshift({
        id: `int-${crypto.randomUUID()}`,
        threatType: 'forbidden_resource_access',
        threatLabel: 'Tentative d’accès non-admin au module Sécurité',
        targetAccountOrResource: `${authCtx.token.email} -> ${req.originalUrl}`,
        sourceIp: ip,
        timestamp: new Date().toISOString(),
        severity: 'critique',
        status: 'bloque',
        details: `Le rôle ${authCtx.token.spaceRole} a tenté d'accéder à ${req.originalUrl}`,
        detectedBy: 'rbac_guard'
      });
      createAlertIfEnabled({
        title: 'Accès non autorisé à une route d’administration sécurité',
        description: `${authCtx.token.email} (${authCtx.token.spaceRole}) bloqué sur ${req.originalUrl}.`,
        severity: 'critique',
        category: 'admin_security',
        targetUserOrResource: authCtx.token.email,
        sourceIp: ip,
        recommendedAction: 'Révoquer la session si l’action est malveillante.'
      });
      appendAuditEntry({
        actorId: authCtx.token.uid,
        actorName: authCtx.token.name,
        actorAccountLabel: authCtx.token.email,
        actorRole: authCtx.token.spaceRole,
        space: authCtx.token.spaceRole,
        category: 'security',
        actionType: 'unauthorized_admin_access',
        action: 'Tentative d’accès non autorisé aux fonctions admin',
        target: req.originalUrl,
        targetType: 'system',
        entityType: 'endpoint',
        entityId: req.originalUrl,
        result: 'refuse',
        severity: 'critique',
        device: authCtx.session.device,
        os: authCtx.session.os,
        browser: authCtx.session.browser,
        sessionId: authCtx.session.sessionId,
        beforeValue: null,
        afterValue: 'Accès refusé (HTTP 403)',
        details: `Le rôle ${authCtx.token.spaceRole} a tenté d'accéder à ${req.originalUrl}`,
        ipAddress: ip
      });
      return res.status(403).json({
        success: false,
        error: 'ADMIN_ROLE_REQUIRED',
        message: 'Accès refusé : privilèges administrateur sécurité requis.'
      });
    }

    if (!hasSecurityPermission(actor, permission)) {
      securityDb.intrusions.unshift({
        id: `int-${crypto.randomUUID()}`,
        threatType: 'forbidden_resource_access',
        threatLabel: 'Permission de sécurité insuffisante',
        targetAccountOrResource: `${actor.email} -> ${req.originalUrl}`,
        sourceIp: ip,
        timestamp: new Date().toISOString(),
        severity: 'eleve',
        status: 'bloque',
        details: `Permission "${permission}" refusée pour ${actor.name} (${actor.role})`,
        detectedBy: 'rbac_guard'
      });
      createAlertIfEnabled({
        title: 'Accès interdit à une fonction de sécurité',
        description: `${actor.name} (${actor.role}) n’a pas la permission "${permission}".`,
        severity: 'eleve',
        category: 'admin_security',
        targetUserOrResource: actor.email,
        sourceIp: ip,
        recommendedAction: 'Vérifier la matrice des permissions.'
      });
      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'security',
        actionType: 'permission_denied',
        action: `Permission refusée (${permission})`,
        target: req.originalUrl,
        targetType: 'permissions',
        entityType: 'endpoint',
        entityId: req.originalUrl,
        result: 'refuse',
        severity: 'eleve',
        device: authCtx.session.device,
        os: authCtx.session.os,
        browser: authCtx.session.browser,
        sessionId: authCtx.session.sessionId,
        beforeValue: actor.role,
        afterValue: `Refusé (${permission} manquant)`,
        details: `Permission "${permission}" refusée pour ${actor.name} (${actor.role})`,
        ipAddress: ip
      });
      return res.status(403).json({
        success: false,
        error: 'PERMISSION_DENIED',
        message: `Accès refusé : permission "${permission}" requise.`
      });
    }

    if (
      options?.requireStepUpMfa &&
      securityDb.settings.requireTwoFactorAdmins &&
      securityDb.settings.requireTwoFactorSensitiveActions
    ) {
      const mfaCode = req.header('x-security-stepup-code') || '';
      const challenge = pendingMfaChallenges.get(authCtx.session.sessionId);
      const validChallenge =
        challenge &&
        challenge.actorId === actor.id &&
        challenge.expiresAt > Date.now() &&
        challenge.code === mfaCode.trim();
      if (!validChallenge) {
        return res.status(428).json({
          success: false,
          error: 'MFA_STEPUP_REQUIRED',
          message: 'Vérification multifacteur (MFA) requise pour cette opération administrative sensible.'
        });
      }
      pendingMfaChallenges.delete(authCtx.session.sessionId);
    }

    (req as Request & { securityActor?: SecurityStaffMember; authCtx?: AuthenticatedRequestContext }).securityActor = actor;
    (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx = authCtx;
    next();
  };
}

// ============================================================================
// REAL EXPRESS SECURITY INSPECTION & PROTECTION MIDDLEWARE
// ============================================================================
const SQLI_PATTERNS = [
  /(\bunion\b\s+\bselect\b)/i,
  /(\bdrop\b\s+\b(table|database)\b)/i,
  /(['"]\s*or\s+['"]?\d+['"]?\s*=\s*['"]?\d+)/i,
  /(--\s|;\s*select\b|;\s*delete\b|;\s*insert\b|xp_cmdshell)/i
];
const XSS_PATTERNS = [
  /<script\b[^>]*>/i,
  /javascript\s*:/i,
  /on(error|load|click|mouseover)\s*=/i,
  /<iframe\b[^>]*>/i
];
const SCANNER_UA_PATTERN = /(sqlmap|nikto|nmap|acunetix|masscan|dirbuster|gobuster|wfuzz)/i;
const TRAVERSAL_PATTERN = /(\.\.\/|\.\.\\|\/\.env|wp-admin|wp-login\.php|phpmyadmin)/i;
const DANGEROUS_EXT_PATTERN = /\.(exe|bat|cmd|sh|php|phtml|jsp|asp|aspx|dll|vbs)(\?|$)/i;
const PHISHING_PATTERN = /(login-djassa|djassa-verify|free-wave-bonus|bit\.ly\/.*password|verify-otp-urgent)/i;

function serializeForInspection(req: Request): string {
  const parts: string[] = [req.originalUrl || ''];
  if (req.query && Object.keys(req.query).length > 0) {
    parts.push(JSON.stringify(req.query));
  }
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    const inspectable = { ...req.body } as Record<string, unknown>;
    if (typeof inspectable.audio === 'string' && inspectable.audio.length > 512) {
      inspectable.audio = '[BINARY_AUDIO_STREAM]';
    }
    parts.push(JSON.stringify(inspectable));
  }
  return parts.join(' ');
}

export function installSecurityMiddleware(app: Express) {
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const ua = req.header('user-agent') || '';
    const now = Date.now();
    const targetEndpoint = `${req.method} ${req.originalUrl}`;

    // If a Bearer token is explicitly provided on ANY /api/* call, reject immediately if revoked
    const rawAuth = req.header('authorization');
    if (rawAuth && rawAuth.startsWith('Bearer ')) {
      const parsedToken = verifySignedToken(rawAuth.slice(7).trim());
      if (parsedToken) {
        const sess = securityDb.sessions.find((s) => s.sessionId === parsedToken.sid);
        if (!sess || sess.status === 'revoked' || sess.status === 'expired') {
          return res.status(401).json({
            success: false,
            error: 'SESSION_REVOKED',
            message: 'Jeton de session révoqué ou expiré.'
          });
        }
      }
    }

    const blocked = isIpCurrentlyBlocked(ip);
    if (blocked && !req.originalUrl.startsWith('/api/security/actions/unblock-ip')) {
      return res.status(403).json({
        success: false,
        error: 'IP_BLOCKED',
        message: `Votre adresse IP (${ip}) est bloquée par la politique de sécurité DJASSA : ${blocked.reason}`
      });
    }

    // 1. Sliding-window rate limiter with bounded in-memory state.
    // Keep at most limit + 1 timestamps per IP: once blocked, additional
    // requests must not grow the bucket until older timestamps expire.
    const limit = Math.max(10, Number(securityDb.settings.rateLimitPerMinute) || 120);
    const bucket = (ipRequestBuckets.get(ip) || []).filter((ts) => now - ts < 60_000);
    if (bucket.length <= limit) bucket.push(now);
    ipRequestBuckets.set(ip, bucket);

    // Opportunistically remove inactive IPs once per minute so this Map does
    // not retain entries forever when many one-off source IPs hit the API.
    if (now - lastIpBucketCleanupAt >= 60_000) {
      lastIpBucketCleanupAt = now;
      for (const [bucketIp, timestamps] of ipRequestBuckets) {
        const activeTimestamps = timestamps.filter((ts) => now - ts < 60_000);
        if (activeTimestamps.length === 0) ipRequestBuckets.delete(bucketIp);
        else if (activeTimestamps.length !== timestamps.length) ipRequestBuckets.set(bucketIp, activeTimestamps);
      }
    }

    if (bucket.length > limit) {
      securityDb.cyberAttacks.unshift({
        id: `atk-${crypto.randomUUID()}`,
        attackType: 'ddos_http_flood',
        attackLabel: 'Dépassement de débit / Flood HTTP (Rate Limit)',
        targetEndpoint,
        sourceIp: ip,
        userAgent: ua.slice(0, 180),
        timestamp: new Date().toISOString(),
        severity: 'eleve',
        blocked: true,
        actionTaken: `HTTP 429 (${bucket.length} req/min > limite ${limit})`,
        sourceLayer: 'express_app_waf'
      });
      createAlertIfEnabled({
        title: 'Seuil de requêtes API dépassé (Rate Limit)',
        description: `L'IP ${ip} a émis ${bucket.length} requêtes en 60s sur ${targetEndpoint}.`,
        severity: 'eleve',
        category: 'api_access',
        targetUserOrResource: targetEndpoint,
        sourceIp: ip,
        recommendedAction: 'Surveiller ou bloquer temporairement cette IP.'
      });
      const uaParsed = parseUserAgent(ua);
      appendAuditEntry({
        actorId: ip,
        actorName: `IP ${ip}`,
        actorRole: 'system',
        space: 'system',
        category: 'security',
        actionType: 'rate_limit_exceeded',
        action: 'Dépassement de débit HTTP bloqué (Rate Limit)',
        target: targetEndpoint,
        targetType: 'system',
        result: 'bloque',
        severity: 'eleve',
        device: uaParsed.device,
        os: uaParsed.os,
        browser: uaParsed.browser,
        beforeValue: `${limit} req/min max`,
        afterValue: `${bucket.length} req/min (HTTP 429)`,
        details: `Rate limit dépassé par ${ip} sur ${targetEndpoint}`,
        ipAddress: ip
      });
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Trop de requêtes détectées. Veuillez patienter avant de réessayer.'
      });
    }

    // 2. Bot / vulnerability scanner detection
    if (securityDb.settings.detectBotScanners && SCANNER_UA_PATTERN.test(ua)) {
      securityDb.cyberAttacks.unshift({
        id: `atk-${crypto.randomUUID()}`,
        attackType: 'bot_scanner',
        attackLabel: 'Activité de bot / scanner de vulnérabilités',
        targetEndpoint,
        sourceIp: ip,
        userAgent: ua.slice(0, 180),
        timestamp: new Date().toISOString(),
        severity: 'critique',
        blocked: true,
        actionTaken: 'Requête bloquée (User-Agent scanner détecté)',
        sourceLayer: 'express_app_waf'
      });
      createAlertIfEnabled({
        title: 'Scanner automatisé détecté et bloqué',
        description: `User-Agent suspect (${ua.slice(0, 80)}) bloqué sur ${targetEndpoint}.`,
        severity: 'critique',
        category: 'api_access',
        targetUserOrResource: targetEndpoint,
        sourceIp: ip,
        recommendedAction: "Bloquer l'adresse IP."
      });
      appendAuditEntry({
        actorId: ip,
        actorName: `Scanner (${ip})`,
        actorRole: 'system',
        space: 'system',
        category: 'security',
        actionType: 'bot_scanner_blocked',
        action: 'Activité de scanner automatisé bloquée',
        target: targetEndpoint,
        targetType: 'system',
        result: 'bloque',
        severity: 'critique',
        device: 'Automate / Client API',
        beforeValue: null,
        afterValue: 'Bloqué (HTTP 403)',
        details: `User-Agent scanner détecté : ${ua.slice(0, 80)}`,
        ipAddress: ip
      });
      return res.status(403).json({
        success: false,
        error: 'BOT_SCANNER_BLOCKED',
        message: 'Activité automatisée non autorisée détectée.'
      });
    }

    // 3. Path traversal / probing
    if (TRAVERSAL_PATTERN.test(req.originalUrl || '')) {
      securityDb.intrusions.unshift({
        id: `int-${crypto.randomUUID()}`,
        threatType: 'forbidden_resource_access',
        threatLabel: 'Sonde de chemin sensible / Path Traversal',
        targetAccountOrResource: targetEndpoint,
        sourceIp: ip,
        timestamp: new Date().toISOString(),
        severity: 'eleve',
        status: 'bloque',
        details: `Tentative d'accès à un chemin interdit : ${redactSensitiveText(req.originalUrl)}`,
        detectedBy: 'express_middleware'
      });
      createAlertIfEnabled({
        title: 'Tentative de scan de fichiers sensibles',
        description: `Sonde détectée sur ${redactSensitiveText(req.originalUrl)} depuis ${ip}.`,
        severity: 'eleve',
        category: 'api_access',
        targetUserOrResource: targetEndpoint,
        sourceIp: ip,
        recommendedAction: "Bloquer l'IP si les tentatives persistent."
      });
      appendAuditEntry({
        actorId: ip,
        actorName: `IP ${ip}`,
        actorRole: 'system',
        space: 'system',
        category: 'security',
        actionType: 'path_traversal_blocked',
        action: 'Sonde de chemin sensible bloquée',
        target: targetEndpoint,
        targetType: 'system',
        result: 'bloque',
        severity: 'eleve',
        beforeValue: null,
        afterValue: 'Bloqué (HTTP 403)',
        details: `Tentative Path Traversal : ${redactSensitiveText(req.originalUrl)}`,
        ipAddress: ip
      });
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN_PATH',
        message: 'Ressource interdite.'
      });
    }

    // 4. Malicious file upload check
    if (securityDb.settings.detectMaliciousUploads && req.body && typeof req.body === 'object') {
      const bodyStr = JSON.stringify(sanitizePayload(req.body));
      const filenameCandidate =
        (req.body as Record<string, unknown>).fileName ||
        (req.body as Record<string, unknown>).filename ||
        (req.body as Record<string, unknown>).name;
      if (
        (typeof filenameCandidate === 'string' && DANGEROUS_EXT_PATTERN.test(filenameCandidate)) ||
        /data:application\/(x-msdownload|x-sh|x-php)/i.test(bodyStr)
      ) {
        securityDb.cyberAttacks.unshift({
          id: `atk-${crypto.randomUUID()}`,
          attackType: 'malicious_upload',
          attackLabel: 'Envoi de fichier potentiellement malveillant',
          targetEndpoint,
          sourceIp: ip,
          userAgent: ua.slice(0, 180),
          timestamp: new Date().toISOString(),
          severity: 'critique',
          blocked: true,
          actionTaken: 'Upload rejeté (type de fichier exécutable/script interdit)',
          sourceLayer: 'express_app_waf',
          redactedSnippet: typeof filenameCandidate === 'string' ? filenameCandidate : undefined
        });
        createAlertIfEnabled({
          title: 'Tentative d’envoi de fichier dangereux bloquée',
          description: `Fichier exécutable/script rejeté sur ${targetEndpoint}.`,
          severity: 'critique',
          category: 'api_access',
          targetUserOrResource: targetEndpoint,
          sourceIp: ip,
          recommendedAction: 'Examiner le compte émetteur.'
        });
        appendAuditEntry({
          actorId: ip,
          actorName: `IP ${ip}`,
          actorRole: 'system',
          space: 'system',
          category: 'security',
          actionType: 'malicious_upload_blocked',
          action: 'Envoi de fichier dangereux bloqué',
          target: targetEndpoint,
          targetType: 'system',
          result: 'bloque',
          severity: 'critique',
          beforeValue: null,
          afterValue: 'Fichier rejeté (HTTP 400)',
          details: `Fichier interdit détecté sur ${targetEndpoint}`,
          ipAddress: ip
        });
        return res.status(400).json({
          success: false,
          error: 'MALICIOUS_FILE_REJECTED',
          message: 'Type de fichier refusé par la politique de sécurité.'
        });
      }
    }

    const inspected = serializeForInspection(req);

    // 5. Phishing link inspection
    if (PHISHING_PATTERN.test(inspected)) {
      securityDb.intrusions.unshift({
        id: `int-${crypto.randomUUID()}`,
        threatType: 'phishing_attempt',
        threatLabel: 'Tentative de lien phishing détectée',
        targetAccountOrResource: targetEndpoint,
        sourceIp: ip,
        timestamp: new Date().toISOString(),
        severity: 'critique',
        status: 'bloque',
        details: `Signature de domaine ou lien frauduleux interceptée dans la requête`,
        detectedBy: 'express_middleware'
      });
      createAlertIfEnabled({
        title: 'Lien phishing bloqué',
        description: `Contenu évoquant un hameçonnage DJASSA bloqué sur ${targetEndpoint}.`,
        severity: 'critique',
        category: 'api_access',
        targetUserOrResource: targetEndpoint,
        sourceIp: ip,
        recommendedAction: 'Suspendre le compte émetteur et alerter les utilisateurs.'
      });
      appendAuditEntry({
        actorId: ip,
        actorName: `IP ${ip}`,
        actorRole: 'system',
        space: 'system',
        category: 'security',
        actionType: 'phishing_blocked',
        action: 'Lien phishing intercepté et bloqué',
        target: targetEndpoint,
        targetType: 'system',
        result: 'bloque',
        severity: 'critique',
        beforeValue: null,
        afterValue: 'Bloqué (HTTP 403)',
        details: `Signature de domaine frauduleux bloquée sur ${targetEndpoint}`,
        ipAddress: ip
      });
      return res.status(403).json({
        success: false,
        error: 'PHISHING_PATTERN_BLOCKED',
        message: 'Lien suspect bloqué par la protection anti-phishing DJASSA.'
      });
    }

    // 6. SQL Injection inspection
    if (securityDb.settings.detectSqlInjection && SQLI_PATTERNS.some((rx) => rx.test(inspected))) {
      securityDb.cyberAttacks.unshift({
        id: `atk-${crypto.randomUUID()}`,
        attackType: 'sql_injection',
        attackLabel: 'Tentative d’injection SQL (SQLi)',
        targetEndpoint,
        sourceIp: ip,
        userAgent: ua.slice(0, 180),
        timestamp: new Date().toISOString(),
        severity: 'critique',
        blocked: true,
        actionTaken: 'Requête rejetée (HTTP 403)',
        sourceLayer: 'express_app_waf',
        redactedSnippet: redactSensitiveText(inspected)
      });
      createAlertIfEnabled({
        title: 'Attaque par injection SQL bloquée',
        description: `Signature SQLi interceptée sur ${targetEndpoint} depuis ${ip}.`,
        severity: 'critique',
        category: 'api_access',
        targetUserOrResource: targetEndpoint,
        sourceIp: ip,
        recommendedAction: "Bloquer l'IP source."
      });
      appendAuditEntry({
        actorId: ip,
        actorName: `IP ${ip}`,
        actorRole: 'system',
        space: 'system',
        category: 'security',
        actionType: 'sqli_blocked',
        action: 'Tentative d’injection SQL bloquée (WAF)',
        target: targetEndpoint,
        targetType: 'system',
        result: 'bloque',
        severity: 'critique',
        beforeValue: null,
        afterValue: 'Bloqué (HTTP 403)',
        details: `Signature SQLi interceptée sur ${targetEndpoint}`,
        ipAddress: ip
      });
      return res.status(403).json({
        success: false,
        error: 'SQLI_PATTERN_BLOCKED',
        message: 'Requête bloquée par le pare-feu applicatif (signature SQL suspecte).'
      });
    }

    // 7. XSS inspection
    if (securityDb.settings.detectXss && XSS_PATTERNS.some((rx) => rx.test(inspected))) {
      securityDb.cyberAttacks.unshift({
        id: `atk-${crypto.randomUUID()}`,
        attackType: 'xss',
        attackLabel: 'Tentative d’injection de script (XSS)',
        targetEndpoint,
        sourceIp: ip,
        userAgent: ua.slice(0, 180),
        timestamp: new Date().toISOString(),
        severity: 'eleve',
        blocked: true,
        actionTaken: 'Requête rejetée (HTTP 403)',
        sourceLayer: 'express_app_waf',
        redactedSnippet: redactSensitiveText(inspected)
      });
      createAlertIfEnabled({
        title: 'Tentative XSS bloquée',
        description: `Balise ou gestionnaire JavaScript suspect intercepté sur ${targetEndpoint}.`,
        severity: 'eleve',
        category: 'api_access',
        targetUserOrResource: targetEndpoint,
        sourceIp: ip,
        recommendedAction: 'Vérifier la source de la requête.'
      });
      appendAuditEntry({
        actorId: ip,
        actorName: `IP ${ip}`,
        actorRole: 'system',
        space: 'system',
        category: 'security',
        actionType: 'xss_blocked',
        action: 'Tentative d’injection de script XSS bloquée (WAF)',
        target: targetEndpoint,
        targetType: 'system',
        result: 'bloque',
        severity: 'eleve',
        beforeValue: null,
        afterValue: 'Bloqué (HTTP 403)',
        details: `Signature XSS interceptée sur ${targetEndpoint}`,
        ipAddress: ip
      });
      return res.status(403).json({
        success: false,
        error: 'XSS_PATTERN_BLOCKED',
        message: 'Requête bloquée par le pare-feu applicatif (contenu script interdit).'
      });
    }

    next();
  });
}

// ============================================================================
// SECURITY & MULTI-SPACE PROTECTION ROUTES
// ============================================================================
function filterByDateRange<T extends { timestamp: string }>(
  items: T[],
  period: string,
  fromParam?: string,
  toParam?: string
): { filtered: T[]; from: string; to: string } {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (period === '7d') {
    start = new Date(now.getTime() - 7 * 86_400_000);
  } else if (period === '30d') {
    start = new Date(now.getTime() - 30 * 86_400_000);
  } else if (period === 'custom' && fromParam) {
    const parsedStart = new Date(fromParam);
    if (!Number.isNaN(parsedStart.getTime())) start = parsedStart;
    if (toParam) {
      const parsedEnd = new Date(toParam);
      if (!Number.isNaN(parsedEnd.getTime())) {
        parsedEnd.setHours(23, 59, 59, 999);
        end = parsedEnd;
      }
    }
  } else {
    start = new Date(now.getTime() - 30 * 86_400_000);
  }

  const startMs = start.getTime();
  const endMs = end.getTime();
  const filtered = items.filter((item) => {
    const t = new Date(item.timestamp).getTime();
    return !Number.isNaN(t) && t >= startMs && t <= endMs;
  });

  return { filtered, from: start.toISOString(), to: end.toISOString() };
}

export function mapRoleToAccountType(role: string | null | undefined): SecurityAccountType {
  switch (role) {
    case 'seller':
      return 'vendeur';
    case 'admin':
      return 'administrateur';
    case 'agent':
      return 'agent';
    default:
      return 'client';
  }
}

export function mapRoleToSpaceRole(role: string | null | undefined): PlatformSpaceRole {
  if (role === 'super_admin') return 'admin';
  if (role === 'seller' || role === 'admin') {
    return role;
  }
  return 'client';
}

export function computeServerLedgerBalance(accountId: string): number {
  let balance = 0;
  for (const entry of securityDb.financeLedger) {
    if (entry.accountId !== accountId) continue;
    if (entry.type === 'credit' && entry.status === 'valide') balance += entry.amountFcfa;
    if ((entry.type === 'debit' || entry.type === 'hold') && (entry.status === 'valide' || entry.status === 'en_attente_verification')) {
      balance -= entry.amountFcfa;
    }
    if (entry.type === 'release' && entry.status === 'valide') balance += entry.amountFcfa;
  }
  return Math.max(0, balance);
}

export function installSecurityRoutes(app: Express) {
  enforceLogRetention();
  setInterval(() => enforceLogRetention(), 6 * 60 * 60_000).unref();
  // --------------------------------------------------------------------------
  // 1. SERVER-SIGNED SESSION ISSUANCE, LOGIN TELEMETRY & HEARTBEAT
  // --------------------------------------------------------------------------
  app.post('/api/security/auth/issue-session', (req: Request, res: Response) => {
    // Sécurité stricte : aucune session ne peut être émise sans authentification préalable
    // par mot de passe (/api/auth/login ou /api/team/auth/login) ou sans jeton Super Admin actif.
    const existingAuth = authenticateSessionRequest(req, res);
    if (!existingAuth) return;

    const ip = getClientIp(req);
    const { accountId, accountName, accountEmail, role, tenantId } = req.body || {};
    const emailNorm = String(accountEmail || existingAuth.token.email || '').trim().toLowerCase();
    const isSuperAdmin = existingAuth.staff?.role === 'super_admin' && existingAuth.token.spaceRole === 'admin';
    const isSameIdentity =
      emailNorm === existingAuth.token.email.toLowerCase() &&
      (!role || mapRoleToSpaceRole(role) === existingAuth.token.spaceRole);

    if (!isSuperAdmin && !isSameIdentity) {
      appendAuditEntry({
        actorId: existingAuth.token.uid,
        actorName: existingAuth.token.name,
        actorAccountLabel: existingAuth.token.email,
        actorRole: existingAuth.token.spaceRole,
        space: existingAuth.token.spaceRole,
        category: 'security',
        actionType: 'session_impersonation_blocked',
        action: 'Tentative d’émission de session pour un autre rôle/compte bloquée',
        target: emailNorm || String(accountId || 'unknown'),
        targetType: 'session',
        result: 'bloque',
        severity: 'critique',
        beforeValue: existingAuth.token.spaceRole,
        afterValue: `Refusé (${String(role || emailNorm)})`,
        details: 'Utilisez /api/auth/login avec mot de passe vérifié.',
        ipAddress: ip
      });
      return res.status(403).json({
        success: false,
        error: 'AUTH_PASSWORD_REQUIRED',
        message: 'Utilisez /api/auth/login avec votre mot de passe pour changer de compte ou de rôle.'
      });
    }

    const spaceRole = isSuperAdmin && role ? mapRoleToSpaceRole(role) : existingAuth.token.spaceRole;
    let staffMember: SecurityStaffMember | undefined;
    if (spaceRole === 'admin') {
      staffMember = securityDb.staff.find((s) => s.email.toLowerCase() === emailNorm && s.active);
      if (!staffMember) {
        return res.status(403).json({
          success: false,
          error: 'ADMIN_NOT_REGISTERED',
          message: 'Compte administrateur non inscrit dans le répertoire de sécurité.'
        });
      }
    }

    // Never accept a caller-supplied session identifier: rotate to a fresh, unpredictable ID to prevent session fixation.
    const sid = `sess-${crypto.randomUUID()}`;
    const ua = req.header('user-agent') || '';
    const { device, browser, os } = parseUserAgent(ua);
    const location = getApproxLocation(req, ip);
    const now = Date.now();
    const ttlMs = Math.max(15, securityDb.settings.sessionTtlMinutes || 480) * 60_000;
    const resolvedTenantId = String(tenantId || existingAuth.token.tenantId || existingAuth.token.uid);

    const sessionObj: SecurityActiveSession = {
      ...existingAuth.session,
      id: existingAuth.session.id || `ses-${crypto.randomUUID()}`,
      sessionId: sid,
      userId: String(isSuperAdmin && accountId ? accountId : existingAuth.token.uid),
      userName: String(isSuperAdmin && accountName ? accountName : existingAuth.token.name),
      userEmail: emailNorm,
      accountType: mapRoleToAccountType(spaceRole),
      spaceRole,
      tenantId: resolvedTenantId,
      device,
      browser,
      os,
      location,
      ipAddress: ip,
      lastActivityAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
      status: existingAuth.session.status === 'reauth_required' ? 'reauth_required' : 'active'
    };

    // Revoke the authenticated session before registering its replacement.
    // A stolen token from the previous session will therefore stop working.
    const previousSession = securityDb.sessions.find((s) => s.sessionId === existingAuth.session.sessionId);
    const previousSessionState = previousSession ? { ...previousSession } : null;
    if (previousSession) {
      previousSession.status = 'revoked';
      previousSession.revokedAt = new Date(now).toISOString();
      previousSession.revokedBy = 'system:session-rotation';
    }
    securityDb.sessions.unshift(sessionObj);

    if (!persistSecurityDb()) {
      securityDb.sessions = securityDb.sessions.filter((s) => s !== sessionObj);
      if (previousSession && previousSessionState) Object.assign(previousSession, previousSessionState);
      return res.status(503).json({
        success: false,
        error: 'SESSION_PERSISTENCE_FAILED',
        message: 'Impossible d’enregistrer la session de manière sécurisée. Veuillez réessayer.'
      });
    }

    const token = signSessionToken({
      sid,
      uid: sessionObj.userId,
      email: emailNorm,
      name: sessionObj.userName,
      spaceRole,
      tenantId: resolvedTenantId,
      staffId: staffMember?.id,
      secRole: staffMember?.role,
      iat: now,
      exp: now + ttlMs
    });

    return res.json({
      success: true,
      token,
      session: sessionObj,
      staff: staffMember || null
    });
  });

  // Super Admin only: issue a verified RBAC evaluation token for an existing staff member
  app.post('/api/security/auth/switch-test-role', requireSecurityPermission('managePermissions'), (req: Request, res: Response) => {
    const caller = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const callerCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
    const ip = getClientIp(req);
    const ua = parseUserAgent(req.header('user-agent'));
    if (caller.role !== 'super_admin') {
      appendAuditEntry({
        actorId: caller.id,
        actorName: caller.name,
        actorAccountLabel: caller.email,
        actorRole: caller.role,
        space: 'admin',
        category: 'security',
        actionType: 'rbac_test_role_switch_denied',
        action: 'Changement de profil RBAC refusé',
        target: String(req.body?.staffId || 'inconnu'),
        targetType: 'permissions',
        entityType: 'staff',
        entityId: String(req.body?.staffId || ''),
        result: 'refuse',
        severity: 'critique',
        device: callerCtx?.session.device || ua.device,
        os: callerCtx?.session.os || ua.os,
        browser: callerCtx?.session.browser || ua.browser,
        sessionId: callerCtx?.session.sessionId,
        beforeValue: caller.role,
        afterValue: 'Refusé (Super Admin requis)',
        details: `${caller.email} (${caller.role}) a tenté d'activer le profil ${String(req.body?.staffId || 'inconnu')}`,
        ipAddress: ip
      });
      return res.status(403).json({
        success: false,
        error: 'SUPER_ADMIN_ONLY',
        message: 'Seul le Super Administrateur peut changer de profil d’évaluation RBAC.'
      });
    }
    const { staffId } = req.body || {};
    const target = securityDb.staff.find((s) => s.id === staffId && s.active);
    if (!target) {
      return res.status(404).json({ success: false, error: 'Collaborateur introuvable' });
    }
    const now = Date.now();
    const sid = `sess-rbac-${target.id}-${now}`;
    const { device, browser, os } = ua;
    const ttlMs = 3600_000;

    securityDb.sessions.unshift({
      id: `ses-${crypto.randomUUID()}`,
      sessionId: sid,
      userId: target.id,
      userName: target.name,
      userEmail: target.email,
      accountType: target.role === 'other_agent' || target.role === 'security_agent' ? 'agent' : 'administrateur',
      spaceRole: 'admin',
      tenantId: target.id,
      device,
      browser,
      os,
      location: getApproxLocation(req, ip),
      ipAddress: ip,
      startedAt: new Date(now).toISOString(),
      lastActivityAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
      durationSeconds: 0,
      status: 'active'
    });

    const token = signSessionToken({
      sid,
      uid: target.id,
      email: target.email,
      name: target.name,
      spaceRole: 'admin',
      tenantId: target.id,
      staffId: target.id,
      secRole: target.role,
      iat: now,
      exp: now + ttlMs
    });

    appendAuditEntry({
      actorId: caller.id,
      actorName: caller.name,
      actorAccountLabel: caller.email,
      actorRole: caller.role,
      space: 'admin',
      category: 'admin_mgmt',
      actionType: 'rbac_test_role_switched',
      action: `Bascule de session RBAC vers ${target.name}`,
      target: `${target.name} (${target.email})`,
      targetType: 'permissions',
      entityType: 'staff',
      entityId: target.id,
      result: 'reussi',
      severity: 'moyen',
      device,
      os,
      browser,
      sessionId: callerCtx?.session.sessionId || sid,
      beforeValue: caller.role,
      afterValue: `${target.role} (${target.id})`,
      details: `Session d’évaluation RBAC émise par Super Admin pour ${target.email}`,
      ipAddress: ip
    });
    return res.json({ success: true, token, actor: target });
  });

  app.post('/api/security/telemetry/login', (req: Request, res: Response) => {
    try {
      const bearerToken = extractBearerToken(req);
      if (!bearerToken) {
        return res.status(401).json({
          success: false,
          error: 'AUTH_REQUIRED',
          message: 'Authentification requise pour enregistrer la télémétrie.'
        });
      }
      const ip = getClientIp(req);
      const { success, reason, sessionId, isWeakCredential } = req.body || {};

      const emailNorm = bearerToken.email.trim().toLowerCase();
      const accountId = bearerToken.uid;
      const accountName = bearerToken.name;
      const role = bearerToken.spaceRole;

      const ua = req.header('user-agent') || '';
      const { device, browser, os } = parseUserAgent(ua);
      const location = getApproxLocation(req, ip);
      const accountType = mapRoleToAccountType(role);

      // Enforce account suspension
      const suspended = getActiveSuspension(emailNorm) || (accountId ? getActiveSuspension(String(accountId)) : undefined);
      if (suspended) {
        securityDb.loginLogs.unshift({
          id: `lgn-${crypto.randomUUID()}`,
          accountId: String(accountId || emailNorm),
          accountName: String(accountName || emailNorm),
          accountEmail: emailNorm,
          accountType,
          ipAddress: ip,
          device,
          browser,
          os,
          location,
          timestamp: new Date().toISOString(),
          status: 'echec',
          reason: `Compte suspendu (${suspended.reason})`
        });
        appendAuditEntry({
          actorId: String(accountId || emailNorm),
          actorName: String(accountName || emailNorm),
          actorAccountLabel: emailNorm,
          actorRole: mapRoleToSpaceRole(role),
          space: mapRoleToSpaceRole(role),
          category: 'auth',
          actionType: 'login_suspended',
          action: 'Connexion refusée (compte suspendu)',
          target: emailNorm,
          targetType: 'session',
          result: 'bloque',
          severity: 'eleve',
          device,
          os,
          browser,
          beforeValue: 'Suspendu',
          afterValue: 'Accès bloqué',
          details: `Motif : ${suspended.reason}`,
          ipAddress: ip
        });
        return res.status(403).json({
          success: false,
          blocked: true,
          reason: `Compte temporairement suspendu : ${suspended.reason}`
        });
      }

      const now = Date.now();
      pruneFailedLoginTracker(now);
      const trackerKey = `${ip}::${emailNorm}`;
      const tracker = failedLoginTracker.get(trackerKey);

      // Enforce temporary lockout
      if (tracker?.blockedUntil && tracker.blockedUntil > now) {
        const remainingMin = Math.max(1, Math.ceil((tracker.blockedUntil - now) / 60_000));
        securityDb.loginLogs.unshift({
          id: `lgn-${crypto.randomUUID()}`,
          accountId: String(accountId || emailNorm),
          accountName: String(accountName || emailNorm),
          accountEmail: emailNorm,
          accountType,
          ipAddress: ip,
          device,
          browser,
          os,
          location,
          timestamp: new Date().toISOString(),
          status: 'suspect',
          reason: `Tentative pendant blocage temporaire (${remainingMin} min restantes)`
        });
        appendAuditEntry({
          actorId: String(accountId || emailNorm),
          actorName: String(accountName || emailNorm),
          actorAccountLabel: emailNorm,
          actorRole: mapRoleToSpaceRole(role),
          space: mapRoleToSpaceRole(role),
          category: 'security',
          actionType: 'login_during_lockout',
          action: 'Tentative de connexion pendant blocage temporaire',
          target: emailNorm,
          targetType: 'session',
          result: 'bloque',
          severity: 'eleve',
          device,
          os,
          browser,
          beforeValue: null,
          afterValue: `Bloqué (${remainingMin} min restantes)`,
          details: `Tentative interceptée pendant verrouillage temporaire depuis ${ip}`,
          ipAddress: ip
        });
        return res.status(429).json({
          success: false,
          blocked: true,
          reason: `Trop de tentatives échouées. Compte/IP temporairement bloqué (${remainingMin} min).`
        });
      }

      // Enforce progressive delay cooldown
      if (!success && tracker?.cooldownUntil && tracker.cooldownUntil > now) {
        const waitSec = Math.max(1, Math.ceil((tracker.cooldownUntil - now) / 1000));
        return res.status(429).json({
          success: false,
          blocked: false,
          delayed: true,
          retryAfterSeconds: waitSec,
          reason: `Délai progressif de sécurité : veuillez patienter ${waitSec}s avant une nouvelle tentative.`
        });
      }

      if (!success) {
        const nextCount = (tracker?.count || 0) + 1;
        const maxAttempts = Math.max(2, securityDb.settings.maxLoginAttempts || 5);
        const blockMs = Math.max(1, securityDb.settings.tempBlockMinutes || 15) * 60_000;
        const delayBase = Math.max(1, securityDb.settings.progressiveDelaySeconds || 3);
        const progressiveMs = nextCount >= 2 ? delayBase * nextCount * 1000 : 0;
        const shouldBlock = nextCount >= maxAttempts;

        // Refresh insertion order so the least-recently-used key is evicted first.
        failedLoginTracker.delete(trackerKey);
        pruneFailedLoginTracker(now);
        failedLoginTracker.set(trackerKey, {
          count: nextCount,
          lastAttempt: now,
          cooldownUntil: now + progressiveMs,
          blockedUntil: shouldBlock ? now + blockMs : null
        });

        const isAdminTarget = accountType === 'administrateur' || emailNorm.includes('admin');
        const logStatus: SecurityLoginLog['status'] = shouldBlock || isAdminTarget ? 'suspect' : 'echec';

        securityDb.loginLogs.unshift({
          id: `lgn-${crypto.randomUUID()}`,
          accountId: String(accountId || emailNorm),
          accountName: String(accountName || emailNorm),
          accountEmail: emailNorm,
          accountType,
          ipAddress: ip,
          device,
          browser,
          os,
          location,
          timestamp: new Date().toISOString(),
          status: logStatus,
          reason: redactSensitiveText(String(reason || 'Identifiants invalides'))
        });

        if (isAdminTarget) {
          securityDb.intrusions.unshift({
            id: `int-${crypto.randomUUID()}`,
            threatType: 'admin_account_attempt',
            threatLabel: 'Tentative d’accès à un compte administrateur',
            targetAccountOrResource: emailNorm,
            sourceIp: ip,
            timestamp: new Date().toISOString(),
            severity: 'critique',
            status: shouldBlock ? 'bloque' : 'detecte',
            details: `Échec sur compte admin (${nextCount}/${maxAttempts}) depuis ${browser} / ${os}`,
            detectedBy: 'auth_guard'
          });
          createAlertIfEnabled({
            title: 'Tentative d’accès à un compte administrateur',
            description: `Échec d'authentification sur ${emailNorm} depuis ${ip} (${device}, ${browser}).`,
            severity: 'critique',
            category: 'admin_security',
            targetUserOrResource: emailNorm,
            sourceIp: ip,
            recommendedAction: "Vérifier l'origine et bloquer l'IP si non reconnue."
          });
        } else if (nextCount >= 3 && !shouldBlock) {
          createAlertIfEnabled({
            title: 'Multiples échecs de connexion',
            description: `${nextCount} échecs consécutifs sur ${emailNorm} depuis ${ip}. Délai progressif activé.`,
            severity: 'moyen',
            category: 'auth',
            targetUserOrResource: emailNorm,
            sourceIp: ip,
            recommendedAction: 'Surveiller les tentatives suivantes.'
          });
        }

        if (shouldBlock) {
          securityDb.intrusions.unshift({
            id: `int-${crypto.randomUUID()}`,
            threatType: 'repeated_failed_passwords',
            threatLabel: 'Tentatives répétées de mots de passe incorrects',
            targetAccountOrResource: emailNorm,
            sourceIp: ip,
            timestamp: new Date().toISOString(),
            severity: 'critique',
            status: 'bloque',
            details: `${nextCount} échecs consécutifs — blocage temporaire de ${securityDb.settings.tempBlockMinutes} min activé`,
            detectedBy: 'auth_guard'
          });
          securityDb.cyberAttacks.unshift({
            id: `atk-${crypto.randomUUID()}`,
            attackType: 'brute_force',
            attackLabel: 'Attaque par force brute sur authentification',
            targetEndpoint: 'POST /auth/login',
            sourceIp: ip,
            userAgent: ua.slice(0, 180),
            timestamp: new Date().toISOString(),
            severity: 'critique',
            blocked: true,
            actionTaken: `Blocage temporaire ${securityDb.settings.tempBlockMinutes} min après ${nextCount} échecs`,
            sourceLayer: 'express_app_waf'
          });
          createAlertIfEnabled({
            title: 'Force brute détectée et bloquée',
            description: `${nextCount} tentatives échouées sur ${emailNorm} depuis ${ip}.`,
            severity: 'critique',
            category: 'auth',
            targetUserOrResource: emailNorm,
            sourceIp: ip,
            recommendedAction: 'Confirmer le blocage IP ou forcer la réinitialisation du mot de passe.'
          });
        }

        appendAuditEntry({
          actorId: String(accountId || emailNorm),
          actorName: String(accountName || emailNorm),
          actorAccountLabel: emailNorm,
          actorRole: mapRoleToSpaceRole(role),
          space: mapRoleToSpaceRole(role),
          category: shouldBlock ? 'security' : 'auth',
          actionType: shouldBlock ? 'login_bruteforce_blocked' : 'login_failed',
          action: shouldBlock
            ? 'Échecs répétés — blocage force brute activé'
            : isAdminTarget
            ? 'Échec de connexion sur compte administrateur'
            : 'Échec de connexion utilisateur',
          target: emailNorm,
          targetType: 'session',
          result: shouldBlock ? 'bloque' : 'echoue',
          severity: isAdminTarget || shouldBlock ? 'critique' : nextCount >= 3 ? 'eleve' : 'moyen',
          device,
          os,
          browser,
          reason: String(reason || 'Identifiants invalides'),
          beforeValue: null,
          afterValue: shouldBlock ? `Verrouillé (${securityDb.settings.tempBlockMinutes} min)` : `Échec (${nextCount}/${maxAttempts})`,
          details: `${reason || 'Identifiants invalides'} — ${device} (${browser} / ${os})`,
          ipAddress: ip
        });
        return res.json({
          success: true,
          blocked: shouldBlock,
          attempts: nextCount,
          maxAttempts,
          retryAfterSeconds: progressiveMs > 0 ? Math.ceil(progressiveMs / 1000) : 0,
          reason: shouldBlock
            ? `Seuil de ${maxAttempts} tentatives atteint : accès bloqué pendant ${securityDb.settings.tempBlockMinutes} minutes.`
            : undefined
        });
      }

      // Login succeeded
      failedLoginTracker.delete(trackerKey);

      const previousSuccesses = securityDb.loginLogs.filter(
        (l) => l.accountEmail === emailNorm && l.status === 'reussite'
      );
      const isNewDevice =
        securityDb.settings.detectUnusualDevices &&
        previousSuccesses.length > 0 &&
        !previousSuccesses.some((l) => l.device === device && l.os === os && l.browser === browser);

      securityDb.loginLogs.unshift({
        id: `lgn-${crypto.randomUUID()}`,
        accountId: String(accountId || emailNorm),
        accountName: String(accountName || emailNorm),
        accountEmail: emailNorm,
        accountType,
        ipAddress: ip,
        device,
        browser,
        os,
        location,
        timestamp: new Date().toISOString(),
        status: isNewDevice ? 'suspect' : 'reussite',
        isNewDevice,
        reason: isNewDevice ? 'Nouvel appareil / navigateur détecté' : 'Authentification validée'
      });

      if (isWeakCredential) {
        securityDb.intrusions.unshift({
          id: `int-${crypto.randomUUID()}`,
          threatType: 'compromised_credential',
          threatLabel: 'Mot de passe faible ou exposé dans des fuites connues',
          targetAccountOrResource: emailNorm,
          sourceIp: ip,
          timestamp: new Date().toISOString(),
          severity: 'eleve',
          status: 'detecte',
          details: `Mot de passe correspondant à un motif fréquent/compromis détecté lors de la connexion`,
          detectedBy: 'auth_guard'
        });
        createAlertIfEnabled({
          title: 'Identifiant potentiellement compromis détecté',
          description: `Le compte ${emailNorm} utilise un mot de passe faible ou connu.`,
          severity: 'eleve',
          category: 'auth',
          targetUserOrResource: emailNorm,
          sourceIp: ip,
          recommendedAction: 'Forcer le renouvellement du mot de passe et activer la 2FA.'
        });
      }

      if (isNewDevice) {
        securityDb.intrusions.unshift({
          id: `int-${crypto.randomUUID()}`,
          threatType: 'unusual_device',
          threatLabel: 'Connexion depuis un nouvel appareil inhabituel',
          targetAccountOrResource: emailNorm,
          sourceIp: ip,
          timestamp: new Date().toISOString(),
          severity: accountType === 'administrateur' ? 'critique' : 'modere',
          status: 'detecte',
          details: `Nouveau terminal : ${device} (${browser} / ${os})`,
          detectedBy: 'auth_guard'
        });
        createAlertIfEnabled({
          title: 'Connexion depuis un nouvel appareil',
          description: `${emailNorm} s’est connecté depuis ${device} (${browser}, ${os}) via ${ip}.`,
          severity: accountType === 'administrateur' ? 'critique' : 'moyen',
          category: 'device',
          targetUserOrResource: emailNorm,
          sourceIp: ip,
          recommendedAction: "Alerter l'utilisateur et révoquer la session si non reconnue."
        });
      } else if (accountType === 'administrateur') {
        createAlertIfEnabled({
          title: 'Connexion administrateur enregistrée',
          description: `Accès administrateur validé pour ${emailNorm} depuis ${device} (${ip}).`,
          severity: 'information',
          category: 'admin_security',
          targetUserOrResource: emailNorm,
          sourceIp: ip,
          recommendedAction: 'Aucune action requise si cette session est la vôtre.'
        });
      }

      if (sessionId) {
        if (bearerToken.sid === String(sessionId)) {
          const nowIso = new Date().toISOString();
          const ttlMs = Math.max(15, securityDb.settings.sessionTtlMinutes || 480) * 60_000;
          const existingIdx = securityDb.sessions.findIndex((s) => s.sessionId === sessionId);
          if (existingIdx >= 0) {
            securityDb.sessions[existingIdx].lastActivityAt = nowIso;
            securityDb.sessions[existingIdx].ipAddress = ip;
            securityDb.sessions[existingIdx].location = location;
            if (isNewDevice) {
              securityDb.sessions[existingIdx].status = 'suspect';
              securityDb.sessions[existingIdx].isNewDevice = true;
            }
          } else {
            const sessionObj: SecurityActiveSession = {
              id: `ses-${crypto.randomUUID()}`,
              sessionId: String(sessionId),
              userId: bearerToken.uid,
              userName: bearerToken.name,
              userEmail: bearerToken.email.toLowerCase(),
              accountType: mapRoleToAccountType(bearerToken.spaceRole),
              spaceRole: bearerToken.spaceRole,
              tenantId: bearerToken.tenantId,
              device,
              browser,
              os,
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
          }
        }
      }

      appendAuditEntry({
        actorId: String(accountId || emailNorm),
        actorName: String(accountName || emailNorm),
        actorAccountLabel: emailNorm,
        actorRole: mapRoleToSpaceRole(role),
        space: mapRoleToSpaceRole(role),
        category: 'auth',
        actionType: isNewDevice ? 'login_new_device' : 'login_success',
        action: isNewDevice
          ? 'Connexion réussie depuis un nouvel appareil'
          : `Connexion réussie (${accountType})`,
        target: emailNorm,
        targetType: 'session',
        entityType: 'session',
        entityId: sessionId ? String(sessionId) : undefined,
        result: 'reussi',
        severity: isNewDevice
          ? accountType === 'administrateur'
            ? 'critique'
            : 'moyen'
          : accountType === 'administrateur'
          ? 'faible'
          : 'information',
        device,
        os,
        browser,
        sessionId: sessionId ? String(sessionId) : undefined,
        beforeValue: null,
        afterValue: isNewDevice ? `Session suspecte (${device})` : `Session active (${device})`,
        details: `Authentification ${accountType} sur ${device} (${browser} / ${os})${location ? ` — ${location}` : ''}`,
        ipAddress: ip
      });
      return res.json({ success: true, blocked: false, unusualDevice: isNewDevice });
    } catch (err: unknown) {
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  app.post('/api/security/sessions/heartbeat', (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      const bearerToken = extractBearerToken(req);
      const { sessionId, userId, userName, userEmail, role } = req.body || {};
      const effectiveSessionId = bearerToken?.sid || String(sessionId || '');
      const effectiveEmail = String(userEmail || bearerToken?.email || '').trim().toLowerCase();
      if (!effectiveSessionId || !effectiveEmail) {
        return res.status(400).json({ success: false, error: 'sessionId et userEmail requis' });
      }
      const ua = req.header('user-agent') || '';
      const { device, browser, os } = parseUserAgent(ua);
      const location = getApproxLocation(req, ip);
      const now = Date.now();
      const nowIso = new Date(now).toISOString();

      const suspended =
        getActiveSuspension(effectiveEmail) ||
        (userId ? getActiveSuspension(String(userId)) : undefined) ||
        (bearerToken?.uid ? getActiveSuspension(bearerToken.uid) : undefined);
      if (suspended) {
        return res.json({
          success: true,
          status: 'suspended',
          forcePasswordReset: Boolean(suspended.forcePasswordReset),
          reason: suspended.reason
        });
      }

      const existing = securityDb.sessions.find((s) => s.sessionId === effectiveSessionId);
      if (existing) {
        if (bearerToken && bearerToken.sid !== existing.sessionId) {
          return res.status(403).json({ success: false, status: 'revoked', error: 'SESSION_MISMATCH' });
        }
        if (existing.status === 'revoked') {
          return res.json({ success: true, status: 'revoked', reason: 'Session révoquée par la sécurité DJASSA.' });
        }
        if (existing.status === 'reauth_required') {
          return res.json({
            success: true,
            status: 'reauth_required',
            reason: 'Nouvelle authentification exigée par un administrateur.'
          });
        }
        if (existing.expiresAt && new Date(existing.expiresAt).getTime() <= now) {
          existing.status = 'expired';
          persistSecurityDb();
          return res.json({ success: true, status: 'expired', reason: 'Session expirée.' });
        }
        existing.lastActivityAt = nowIso;
        existing.ipAddress = ip;
        existing.location = location;
        existing.durationSeconds = Math.max(0, Math.floor((now - new Date(existing.startedAt).getTime()) / 1000));
        persistSecurityDb();
        return res.json({ success: true, status: existing.status, session: existing });
      }

      // Sécurité : heartbeat ne doit jamais fabriquer une nouvelle session active (notamment admin) sans jeton signé valide
      if (!bearerToken) {
        return res.status(401).json({
          success: false,
          status: 'revoked',
          error: 'SESSION_NOT_FOUND',
          reason: 'Session inconnue ou expirée. Veuillez vous authentifier.'
        });
      }

      const ttlMs = Math.max(15, securityDb.settings.sessionTtlMinutes || 480) * 60_000;
      const restored: SecurityActiveSession = {
        id: `ses-${crypto.randomUUID()}`,
        sessionId: bearerToken.sid,
        userId: bearerToken.uid,
        userName: bearerToken.name,
        userEmail: bearerToken.email.toLowerCase(),
        accountType: mapRoleToAccountType(bearerToken.spaceRole),
        spaceRole: bearerToken.spaceRole,
        tenantId: bearerToken.tenantId,
        device,
        browser,
        os,
        location,
        ipAddress: ip,
        startedAt: nowIso,
        lastActivityAt: nowIso,
        expiresAt: new Date(now + ttlMs).toISOString(),
        durationSeconds: 0,
        status: 'active'
      };
      securityDb.sessions.unshift(restored);
      if (securityDb.sessions.length > 400) securityDb.sessions = securityDb.sessions.slice(0, 400);
      persistSecurityDb();
      return res.json({ success: true, status: 'active', session: restored });
    } catch (err: unknown) {
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  app.post('/api/security/sessions/logout', (req: Request, res: Response) => {
    const { sessionId } = req.body || {};
    const ip = getClientIp(req);
    const { device, browser, os } = parseUserAgent(req.header('user-agent'));
    if (sessionId) {
      const existing = securityDb.sessions.find((s) => s.sessionId === sessionId && s.status !== 'revoked');
      if (existing) {
        existing.status = 'revoked';
        existing.revokedBy = 'Déconnexion utilisateur';
        existing.revokedAt = new Date().toISOString();
        appendAuditEntry({
          actorId: existing.userId,
          actorName: existing.userName,
          actorAccountLabel: existing.userEmail,
          actorRole: existing.spaceRole || 'client',
          space: existing.spaceRole || 'client',
          category: 'auth',
          actionType: 'logout',
          action: 'Déconnexion du compte',
          target: existing.userEmail,
          targetType: 'session',
          entityType: 'session',
          entityId: existing.sessionId,
          result: 'reussi',
          severity: 'information',
          device: existing.device || device,
          os: existing.os || os,
          browser: existing.browser || browser,
          sessionId: existing.sessionId,
          beforeValue: 'Session active',
          afterValue: 'Session déconnectée',
          details: `Déconnexion utilisateur sur ${existing.device || device}`,
          ipAddress: ip
        });
      }
    }
    res.json({ success: true });
  });

  // Profile / security-sensitive events hook (email change, phone change, password change)
  app.post('/api/security/events/profile-change', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const ip = getClientIp(req);
    const { changeType, targetEmail, details } = req.body || {};

    if (hasBlockedOperation(authCtx.token.email, 'profile_changes')) {
      return res.status(403).json({
        success: false,
        error: 'OPERATION_BLOCKED_BY_SECURITY',
        message: 'La modification des informations personnelles est temporairement bloquée par la sécurité.'
      });
    }

    const titles: Record<string, { title: string; sev: AlertSeverityLevel }> = {
      password: { title: 'Changement de mot de passe', sev: 'moyen' },
      email: { title: 'Changement d’adresse e-mail', sev: 'eleve' },
      phone: { title: 'Changement de numéro de téléphone', sev: 'eleve' }
    };
    const meta = titles[String(changeType)] || { title: 'Modification de profil sensible', sev: 'faible' as AlertSeverityLevel };

    createAlertIfEnabled({
      title: meta.title,
      description: `${authCtx.token.email} : ${redactSensitiveText(String(details || meta.title))}`,
      severity: meta.sev,
      category: 'profile',
      targetUserOrResource: String(targetEmail || authCtx.token.email),
      sourceIp: ip,
      recommendedAction: 'Vérifier que cette modification émane bien du titulaire légitime.'
    });
    appendAuditEntry({
      actorId: authCtx.token.uid,
      actorName: authCtx.token.name,
      actorAccountLabel: authCtx.token.email,
      actorRole: authCtx.token.secRole || authCtx.token.spaceRole,
      space: authCtx.token.spaceRole,
      category: changeType === 'password' ? 'auth' : 'accounts',
      actionType: `profile_change_${String(changeType || 'profile')}`,
      action: meta.title,
      target: String(targetEmail || authCtx.token.email),
      targetType: 'account',
      entityType: 'account',
      entityId: authCtx.token.uid,
      result: 'reussi',
      severity: meta.sev,
      device: authCtx.session.device,
      os: authCtx.session.os,
      browser: authCtx.session.browser,
      sessionId: authCtx.session.sessionId,
      beforeValue: null,
      afterValue: redactSensitiveText(String(details || 'Mis à jour')),
      details: `${meta.title} effectué`,
      ipAddress: ip
    });

    return res.json({ success: true });
  });

  // Cloudflare WAF webhook
  app.post('/api/security/waf/webhook', (req: Request, res: Response) => {
    if (!securityDb.settings.cloudflareWafConnected) {
      return res.status(503).json({
        success: false,
        error: 'WAF_NOT_CONNECTED',
        message: 'Connecteur Cloudflare WAF non activé.'
      });
    }
    const { action, ruleName, clientIp, path: targetPath, userAgent } = req.body || {};
    const event: SecurityCyberAttackEvent = {
      id: `atk-${crypto.randomUUID()}`,
      attackType: 'waf_event',
      attackLabel: `Événement WAF externe : ${String(ruleName || 'Règle Cloudflare')}`,
      targetEndpoint: String(targetPath || '/'),
      sourceIp: String(clientIp || getClientIp(req)),
      userAgent: String(userAgent || 'Cloudflare-Edge'),
      timestamp: new Date().toISOString(),
      severity: 'eleve',
      blocked: action === 'block' || action === 'managed_challenge',
      actionTaken: String(action || 'block'),
      sourceLayer: 'cloudflare_waf_webhook'
    };
    securityDb.cyberAttacks.unshift(event);
    createAlertIfEnabled({
      title: 'Événement WAF Cloudflare reçu',
      description: `Règle "${ruleName || 'WAF'}" déclenchée contre ${event.sourceIp}.`,
      severity: 'eleve',
      category: 'api_access',
      targetUserOrResource: event.targetEndpoint,
      sourceIp: event.sourceIp,
      recommendedAction: 'Consulter le journal WAF.'
    });
    persistSecurityDb();
    res.json({ success: true, eventId: event.id });
  });

  // --------------------------------------------------------------------------
  // 2. STEP-UP MFA CHALLENGE FOR SENSITIVE ADMIN OPERATIONS
  // --------------------------------------------------------------------------
  app.post('/api/security/mfa/challenge', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    if (!authCtx.staff || authCtx.token.spaceRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Réservé aux administrateurs' });
    }
    const code = String(crypto.randomInt(100000, 999999));
    pendingMfaChallenges.set(authCtx.session.sessionId, {
      code,
      expiresAt: Date.now() + 5 * 60_000,
      actorId: authCtx.staff.id
    });
    // Return code to the authenticated admin MFA dialog (in production with SMS/TOTP gateway, this dispatches via SMS/Authenticator)
    return res.json({
      success: true,
      expiresInSeconds: 300,
      verificationCodePreview: code,
      deliveryNote: 'Code MFA généré côté serveur (valable 5 min pour cette session admin).'
    });
  });

  // --------------------------------------------------------------------------
  // 3. RBAC & TENANT ISOLATION ACROSS ALL 5 SPACES (Server-Verified)
  // --------------------------------------------------------------------------
  app.get('/api/spaces/client/:clientId/account', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const ip = getClientIp(req);
    const { clientId } = req.params;
    const isAdminAllowed = authCtx.token.spaceRole === 'admin' && hasSecurityPermission(authCtx.staff, 'viewDashboard');
    const isOwnClient = authCtx.token.spaceRole === 'client' && authCtx.token.tenantId === clientId;

    if (!isOwnClient && !isAdminAllowed) {
      securityDb.intrusions.unshift({
        id: `int-${crypto.randomUUID()}`,
        threatType: 'cross_tenant_access',
        threatLabel: 'Tentative d’accès direct au compte d’un autre Client',
        targetAccountOrResource: `client:${clientId}`,
        sourceIp: ip,
        timestamp: new Date().toISOString(),
        severity: 'critique',
        status: 'bloque',
        details: `${authCtx.token.email} (${authCtx.token.spaceRole}:${authCtx.token.tenantId}) a tenté d'accéder à client:${clientId}`,
        detectedBy: 'rbac_guard'
      });
      createAlertIfEnabled({
        title: 'Accès inter-client bloqué',
        description: `${authCtx.token.email} a tenté de consulter le compte du client ${clientId}.`,
        severity: 'critique',
        category: 'api_access',
        targetUserOrResource: `client:${clientId}`,
        sourceIp: ip,
        recommendedAction: 'Inspecter la session et suspendre si usurpation.'
      });
      appendAuditEntry({
        actorId: authCtx.token.uid,
        actorName: authCtx.token.name,
        actorAccountLabel: authCtx.token.email,
        actorRole: authCtx.token.secRole || authCtx.token.spaceRole,
        space: authCtx.token.spaceRole,
        category: 'security',
        actionType: 'cross_tenant_client_blocked',
        action: 'Accès inter-client bloqué',
        target: `client:${clientId}`,
        targetType: 'account',
        entityType: 'client',
        entityId: clientId,
        result: 'bloque',
        severity: 'critique',
        device: authCtx.session.device,
        os: authCtx.session.os,
        browser: authCtx.session.browser,
        sessionId: authCtx.session.sessionId,
        beforeValue: `Espace ${authCtx.token.spaceRole}`,
        afterValue: 'Accès refusé (HTTP 403)',
        details: `${authCtx.token.email} a tenté d’accéder au compte client ${clientId}`,
        ipAddress: ip
      });
      return res.status(403).json({
        success: false,
        error: 'CROSS_TENANT_ACCESS_DENIED',
        message: 'Accès refusé : vous ne pouvez consulter que votre propre compte client.'
      });
    }
    return res.json({ success: true, clientId, authorizedScope: 'own_account' });
  });

  app.get('/api/spaces/seller/:sellerId/wallet', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const ip = getClientIp(req);
    const { sellerId } = req.params;
    const isAdminAllowed = authCtx.token.spaceRole === 'admin' && hasSecurityPermission(authCtx.staff, 'manageFinanceProtection');
    const isOwnSeller = authCtx.token.spaceRole === 'seller' && authCtx.token.tenantId === sellerId;

    if (!isOwnSeller && !isAdminAllowed) {
      securityDb.intrusions.unshift({
        id: `int-${crypto.randomUUID()}`,
        threatType: 'cross_tenant_access',
        threatLabel: 'Tentative d’accès au portefeuille d’un autre Vendeur',
        targetAccountOrResource: `seller:${sellerId}/wallet`,
        sourceIp: ip,
        timestamp: new Date().toISOString(),
        severity: 'critique',
        status: 'bloque',
        details: `${authCtx.token.email} (${authCtx.token.spaceRole}:${authCtx.token.tenantId}) bloqué sur portefeuille ${sellerId}`,
        detectedBy: 'finance_guard'
      });
      createAlertIfEnabled({
        title: 'Tentative d’accès à un portefeuille vendeur tiers',
        description: `${authCtx.token.email} a tenté de consulter le portefeuille de ${sellerId}.`,
        severity: 'critique',
        category: 'finance',
        targetUserOrResource: `seller:${sellerId}`,
        sourceIp: ip,
        recommendedAction: 'Bloquer l’opération et vérifier le compte.'
      });
      appendAuditEntry({
        actorId: authCtx.token.uid,
        actorName: authCtx.token.name,
        actorAccountLabel: authCtx.token.email,
        actorRole: authCtx.token.secRole || authCtx.token.spaceRole,
        space: authCtx.token.spaceRole,
        category: 'security',
        actionType: 'cross_tenant_seller_wallet_blocked',
        action: 'Accès portefeuille vendeur tiers bloqué',
        target: `seller:${sellerId}/wallet`,
        targetType: 'finance',
        entityType: 'wallet',
        entityId: sellerId,
        result: 'bloque',
        severity: 'critique',
        device: authCtx.session.device,
        os: authCtx.session.os,
        browser: authCtx.session.browser,
        sessionId: authCtx.session.sessionId,
        beforeValue: `Espace ${authCtx.token.spaceRole}`,
        afterValue: 'Accès refusé (HTTP 403)',
        details: `${authCtx.token.email} bloqué sur le portefeuille vendeur ${sellerId}`,
        ipAddress: ip
      });
      return res.status(403).json({
        success: false,
        error: 'SELLER_WALLET_ISOLATION_DENIED',
        message: 'Accès refusé : un vendeur ne peut pas consulter le portefeuille d’un autre vendeur.'
      });
    }

    const balanceFcfa = computeServerLedgerBalance(sellerId);
    const entries = securityDb.financeLedger.filter((e) => e.accountId === sellerId);
    return res.json({ success: true, sellerId, serverCalculatedBalanceFcfa: balanceFcfa, entries });
  });

  app.all('/api/spaces/driver/*', (_req: Request, res: Response) => {
    return res.status(410).json({
      success: false,
      error: 'SPACE_DECOMMISSIONED',
      message: 'L’espace Livreur a été supprimé de DJASSA.'
    });
  });

  app.all('/api/spaces/company/*', (_req: Request, res: Response) => {
    return res.status(410).json({
      success: false,
      error: 'SPACE_DECOMMISSIONED',
      message: 'L’espace Entreprise de livraison a été supprimé de DJASSA.'
    });
  });

  app.patch('/api/spaces/account/role', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const ip = getClientIp(req);
    const { targetRole } = req.body || {};

    securityDb.intrusions.unshift({
      id: `int-${crypto.randomUUID()}`,
      threatType: 'privilege_escalation',
      threatLabel: 'Tentative de modification de son propre rôle',
      targetAccountOrResource: `${authCtx.token.email} -> ${String(targetRole || 'admin')}`,
      sourceIp: ip,
      timestamp: new Date().toISOString(),
      severity: 'critique',
      status: 'bloque',
      details: `${authCtx.token.email} (${authCtx.token.spaceRole}) a tenté d'auto-modifier son rôle vers ${String(targetRole)}`,
      detectedBy: 'rbac_guard'
    });
    createAlertIfEnabled({
      title: 'Tentative de changement de rôle bloquée',
      description: `${authCtx.token.email} a tenté de modifier son rôle vers "${String(targetRole)}".`,
      severity: 'critique',
      category: 'role',
      targetUserOrResource: authCtx.token.email,
      sourceIp: ip,
      recommendedAction: 'Suspendre le compte et auditer les accès.'
    });
    appendAuditEntry({
      actorId: authCtx.token.uid,
      actorName: authCtx.token.name,
      actorAccountLabel: authCtx.token.email,
      actorRole: authCtx.token.spaceRole,
      space: authCtx.token.spaceRole,
      category: 'security',
      actionType: 'self_role_escalation_blocked',
      action: 'Auto-modification de rôle bloquée',
      target: authCtx.token.email,
      targetType: 'account',
      entityType: 'account',
      entityId: authCtx.token.uid,
      result: 'bloque',
      severity: 'critique',
      device: authCtx.session.device,
      os: authCtx.session.os,
      browser: authCtx.session.browser,
      sessionId: authCtx.session.sessionId,
      beforeValue: authCtx.token.spaceRole,
      afterValue: 'inchangé (bloqué)',
      details: `Tentative vers ${String(targetRole)} rejetée par le serveur`,
      ipAddress: ip
    });

    return res.status(403).json({
      success: false,
      error: 'SELF_ROLE_MODIFICATION_FORBIDDEN',
      message: 'Accès refusé : aucun utilisateur ne peut modifier son propre rôle.'
    });
  });

  // --------------------------------------------------------------------------
  // 4. FINANCIAL LEDGER & WITHDRAWAL PROTECTION
  // --------------------------------------------------------------------------
  app.get('/api/finance/ledger', requireSecurityPermission('manageFinanceProtection'), (_req: Request, res: Response) => {
    const balances: Record<string, number> = {};
    const accountIds = new Set(securityDb.financeLedger.map((e) => e.accountId));
    accountIds.forEach((id) => {
      balances[id] = computeServerLedgerBalance(id);
    });
    res.json({
      success: true,
      entries: securityDb.financeLedger.slice(0, 300),
      calculatedBalances: balances,
      knownPayoutTargets: securityDb.knownPayoutTargets
    });
  });

  // Explicit endpoint blocking any unauthorized attempt to overwrite a balance directly
  app.post('/api/finance/direct-balance-edit', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const ip = getClientIp(req);

    securityDb.intrusions.unshift({
      id: `int-${crypto.randomUUID()}`,
      threatType: 'financial_tampering',
      threatLabel: 'Tentative de modification directe de solde',
      targetAccountOrResource: String(req.body?.accountId || authCtx.token.uid),
      sourceIp: ip,
      timestamp: new Date().toISOString(),
      severity: 'critique',
      status: 'bloque',
      details: `${authCtx.token.email} a tenté de forcer un solde directement hors registre des transactions`,
      detectedBy: 'finance_guard'
    });
    createAlertIfEnabled({
      title: 'Tentative de modification directe de solde bloquée',
      description: `${authCtx.token.email} a tenté de modifier un solde sans passer par le registre des transactions.`,
      severity: 'critique',
      category: 'finance',
      targetUserOrResource: authCtx.token.email,
      sourceIp: ip,
      recommendedAction: 'Révoquer immédiatement la session et suspendre le compte.'
    });
    appendAuditEntry({
      actorId: authCtx.token.uid,
      actorName: authCtx.token.name,
      actorAccountLabel: authCtx.token.email,
      actorRole: authCtx.token.secRole || authCtx.token.spaceRole,
      space: authCtx.token.spaceRole,
      category: 'security',
      actionType: 'direct_balance_edit_blocked',
      action: 'Modification directe de solde bloquée',
      target: String(req.body?.accountId || authCtx.token.email),
      targetType: 'finance',
      entityType: 'wallet',
      entityId: String(req.body?.accountId || authCtx.token.uid),
      result: 'bloque',
      severity: 'critique',
      device: authCtx.session.device,
      os: authCtx.session.os,
      browser: authCtx.session.browser,
      sessionId: authCtx.session.sessionId,
      beforeValue: null,
      afterValue: 'rejeté (registre immuable)',
      details: 'Les soldes sont calculés exclusivement depuis le registre des transactions',
      ipAddress: ip
    });

    return res.status(403).json({
      success: false,
      error: 'DIRECT_BALANCE_EDIT_FORBIDDEN',
      message: 'Opération interdite : les soldes sont calculés uniquement côté serveur à partir du registre des transactions.'
    });
  });

  app.post('/api/finance/withdraw', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const ip = getClientIp(req);
    const {
      accountId,
      amountFcfa,
      channel,
      payoutTarget,
      declaredBalanceFcfa,
      reauthConfirmed
    } = req.body || {};

    const targetId = String(accountId || authCtx.token.tenantId);

    // Ownership check
    if (authCtx.token.spaceRole !== 'admin' && targetId !== authCtx.token.tenantId && targetId !== authCtx.token.uid) {
      securityDb.intrusions.unshift({
        id: `int-${crypto.randomUUID()}`,
        threatType: 'financial_tampering',
        threatLabel: 'Tentative de retrait sur le compte d’un tiers',
        targetAccountOrResource: `${targetId}`,
        sourceIp: ip,
        timestamp: new Date().toISOString(),
        severity: 'critique',
        status: 'bloque',
        details: `${authCtx.token.email} a tenté d'initier un retrait sur le compte ${targetId}`,
        detectedBy: 'finance_guard'
      });
      createAlertIfEnabled({
        title: 'Retrait non autorisé sur compte tiers bloqué',
        description: `${authCtx.token.email} a tenté de retirer depuis ${targetId}.`,
        severity: 'critique',
        category: 'finance',
        targetUserOrResource: targetId,
        sourceIp: ip,
        recommendedAction: 'Suspendre le compte et vérifier les accès.'
      });
      appendAuditEntry({
        actorId: authCtx.token.uid,
        actorName: authCtx.token.name,
        actorAccountLabel: authCtx.token.email,
        actorRole: authCtx.token.secRole || authCtx.token.spaceRole,
        space: authCtx.token.spaceRole,
        category: 'security',
        actionType: 'withdrawal_ownership_denied',
        action: 'Retrait sur compte tiers bloqué',
        target: targetId,
        targetType: 'finance',
        entityType: 'wallet',
        entityId: targetId,
        result: 'bloque',
        severity: 'critique',
        device: authCtx.session.device,
        os: authCtx.session.os,
        browser: authCtx.session.browser,
        sessionId: authCtx.session.sessionId,
        beforeValue: `Demande ${Number(amountFcfa) || 0} FCFA`,
        afterValue: 'Bloqué (propriété non vérifiée)',
        details: `${authCtx.token.email} a tenté d’initier un retrait sur le compte tiers ${targetId}`,
        ipAddress: ip
      });
      return res.status(403).json({
        success: false,
        error: 'WITHDRAWAL_OWNERSHIP_DENIED',
        message: 'Accès refusé : vous ne pouvez retirer que depuis votre propre compte.'
      });
    }

    // Check suspension or blocked financial operations
    if (hasBlockedOperation(authCtx.token.email, 'withdrawals') || hasBlockedOperation(targetId, 'withdrawals')) {
      appendAuditEntry({
        actorId: authCtx.token.uid,
        actorName: authCtx.token.name,
        actorAccountLabel: authCtx.token.email,
        actorRole: authCtx.token.spaceRole,
        space: authCtx.token.spaceRole,
        category: 'wallets',
        actionType: 'withdrawal_blocked_suspension',
        action: 'Retrait bloqué (suspension sécurité)',
        target: `${targetId} (${Number(amountFcfa) || 0} FCFA)`,
        targetType: 'finance',
        entityType: 'wallet',
        entityId: targetId,
        result: 'bloque',
        severity: 'eleve',
        device: authCtx.session.device,
        os: authCtx.session.os,
        browser: authCtx.session.browser,
        sessionId: authCtx.session.sessionId,
        beforeValue: null,
        afterValue: 'bloqué',
        details: 'Retrait rejeté suite à une suspension ou restriction de sécurité active',
        ipAddress: ip
      });
      return res.status(403).json({
        success: false,
        error: 'WITHDRAWAL_SUSPENDED',
        message: 'Retrait refusé : ce compte ou ses opérations financières sont temporairement suspendus par la sécurité.'
      });
    }

    const amount = Number(amountFcfa);
    if (!Number.isFinite(amount) || amount < 500) {
      appendAuditEntry({
        actorId: authCtx.token.uid,
        actorName: authCtx.token.name,
        actorAccountLabel: authCtx.token.email,
        actorRole: authCtx.token.spaceRole,
        space: authCtx.token.spaceRole,
        category: 'wallets',
        actionType: 'withdrawal_invalid_amount',
        action: 'Demande de retrait échouée (montant invalide)',
        target: targetId,
        targetType: 'finance',
        entityType: 'wallet',
        entityId: targetId,
        result: 'echoue',
        severity: 'faible',
        device: authCtx.session.device,
        os: authCtx.session.os,
        browser: authCtx.session.browser,
        sessionId: authCtx.session.sessionId,
        beforeValue: null,
        afterValue: `${Number.isFinite(amount) ? amount : 0} FCFA`,
        details: 'Montant de retrait inférieur au minimum autorisé (500 FCFA)',
        ipAddress: ip
      });
      return res.status(400).json({ success: false, error: 'Montant de retrait invalide (min 500 FCFA).' });
    }

    // Sécurité financière stricte : ne JAMAIS initialiser un solde à partir de declaredBalanceFcfa du client.
    const serverBalance = computeServerLedgerBalance(targetId);
    if (amount > serverBalance) {
      appendAuditEntry({
        actorId: authCtx.token.uid,
        actorName: authCtx.token.name,
        actorAccountLabel: authCtx.token.email,
        actorRole: authCtx.token.spaceRole,
        space: authCtx.token.spaceRole,
        category: 'wallets',
        actionType: 'withdrawal_insufficient_balance',
        action: 'Retrait refusé (solde serveur insuffisant)',
        target: `${targetId} (${amount.toLocaleString('fr-FR')} FCFA)`,
        targetType: 'finance',
        entityType: 'wallet',
        entityId: targetId,
        result: 'refuse',
        severity: 'moyen',
        device: authCtx.session.device,
        os: authCtx.session.os,
        browser: authCtx.session.browser,
        sessionId: authCtx.session.sessionId,
        beforeValue: `${serverBalance} FCFA`,
        afterValue: `${serverBalance} FCFA (inchangé)`,
        details: `Tentative de retrait de ${amount} FCFA alors que le solde serveur est de ${serverBalance} FCFA`,
        ipAddress: ip,
        financialTrace: {
          operationType: 'Retrait refusé (solde insuffisant)',
          transactionId: `REJ-${Date.now().toString().slice(-6)}`,
          initiatorName: authCtx.token.name,
          initiatorId: authCtx.token.uid,
          beneficiaryAccount: `${channel || 'Wave CI'} (${maskPayoutTarget(payoutTarget)})`,
          amountFcfa: amount,
          feesFcfa: 0,
          previousBalanceFcfa: serverBalance,
          newBalanceFcfa: serverBalance,
          status: 'refuse',
          timestamp: new Date().toISOString(),
          validationResult: 'Rejeté — Solde serveur insuffisant',
          channel: String(channel || 'Wave CI')
        }
      });
      return res.status(400).json({
        success: false,
        error: 'INSUFFICIENT_SERVER_BALANCE',
        message: `Solde serveur insuffisant (${serverBalance.toLocaleString('fr-FR')} FCFA disponibles).`
      });
    }

    if (securityDb.settings.requireReauthBeforeWithdrawals && !reauthConfirmed) {
      appendAuditEntry({
        actorId: authCtx.token.uid,
        actorName: authCtx.token.name,
        actorAccountLabel: authCtx.token.email,
        actorRole: authCtx.token.spaceRole,
        space: authCtx.token.spaceRole,
        category: 'wallets',
        actionType: 'withdrawal_reauth_required',
        action: 'Retrait suspendu (ré-authentification requise)',
        target: `${targetId} (${amount.toLocaleString('fr-FR')} FCFA)`,
        targetType: 'finance',
        entityType: 'wallet',
        entityId: targetId,
        result: 'refuse',
        severity: 'moyen',
        device: authCtx.session.device,
        os: authCtx.session.os,
        browser: authCtx.session.browser,
        sessionId: authCtx.session.sessionId,
        beforeValue: `${serverBalance} FCFA`,
        afterValue: 'En attente de ré-authentification',
        details: `Confirmation MFA/ré-authentification requise avant retrait de ${amount} FCFA`,
        ipAddress: ip
      });
      return res.status(428).json({
        success: false,
        error: 'REAUTH_REQUIRED',
        message: 'Une nouvelle authentification est requise avant tout retrait.'
      });
    }

    const suspicionReasons: string[] = [];
    const targetPayoutClean = String(payoutTarget || '').trim();
    const knownTargets = securityDb.knownPayoutTargets[targetId] || [];
    if (targetPayoutClean && knownTargets.length > 0 && !knownTargets.includes(targetPayoutClean)) {
      suspicionReasons.push(`Changement suspect du numéro/RIB de retrait (${maskPayoutTarget(targetPayoutClean)})`);
    }
    if (targetPayoutClean && knownTargets.length === 0) {
      securityDb.knownPayoutTargets[targetId] = [targetPayoutClean];
    }

    const now = Date.now();
    const recentList = (recentWithdrawalsTracker.get(targetId) || []).filter((ts) => now - ts < 10 * 60_000);
    recentList.push(now);
    recentWithdrawalsTracker.set(targetId, recentList);
    if (recentList.length >= 3) {
      suspicionReasons.push(`Tentatives répétées de retrait (${recentList.length} demandes en 10 min)`);
    }

    if (amount > (securityDb.settings.maxAutoWithdrawalFcfa || 150000)) {
      suspicionReasons.push(`Montant élevé inhabituel (> ${(securityDb.settings.maxAutoWithdrawalFcfa || 150000).toLocaleString('fr-FR')} FCFA)`);
    }

    if (authCtx.session.isNewDevice) {
      suspicionReasons.push('Demande de retrait effectuée depuis un nouvel appareil');
    }

    const isSuspicious = suspicionReasons.length > 0;
    const entry: FinanceLedgerEntry = {
      id: `led-${crypto.randomUUID()}`,
      accountId: targetId,
      accountEmail: authCtx.token.email,
      accountName: authCtx.token.name,
      spaceRole: authCtx.token.spaceRole === 'admin' ? 'seller' : authCtx.token.spaceRole,
      type: isSuspicious ? 'hold' : 'debit',
      amountFcfa: amount,
      channel: String(channel || 'Wave CI'),
      payoutTarget: targetPayoutClean ? maskPayoutTarget(targetPayoutClean) : undefined,
      reference: `WD-${Math.floor(100000 + Math.random() * 900000)}`,
      status: isSuspicious ? 'en_attente_verification' : 'valide',
      suspicionReasons: isSuspicious ? suspicionReasons : undefined,
      device: `${authCtx.session.device} (${authCtx.session.browser})`,
      ipAddress: ip,
      createdAt: new Date().toISOString()
    };

    securityDb.financeLedger.unshift(entry);

    if (isSuspicious) {
      createAlertIfEnabled({
        title: 'Tentative de retrait suspecte mise en attente',
        description: `${authCtx.token.email} — ${amount.toLocaleString('fr-FR')} FCFA vers ${maskPayoutTarget(targetPayoutClean) || channel}. Motifs : ${suspicionReasons.join(' ; ')}`,
        severity: recentList.length >= 3 ? 'critique' : 'eleve',
        category: 'finance',
        targetUserOrResource: authCtx.token.email,
        sourceIp: ip,
        recommendedAction: 'Vérifier les preuves financières et contacter le titulaire avant libération.'
      });
    }

    const newBalance = computeServerLedgerBalance(targetId);
    appendAuditEntry({
      actorId: authCtx.token.uid,
      actorName: authCtx.token.name,
      actorAccountLabel: authCtx.token.email,
      actorRole: authCtx.token.spaceRole,
      space: authCtx.token.spaceRole,
      category: 'wallets',
      actionType: isSuspicious ? 'withdrawal_held_security' : 'withdrawal_validated_server',
      action: isSuspicious ? 'Retrait placé en vérification sécurité' : 'Retrait validé côté serveur',
      target: `${authCtx.token.email} • ${amount.toLocaleString('fr-FR')} FCFA`,
      targetType: 'finance',
      entityType: 'transaction',
      entityId: entry.reference,
      result: isSuspicious ? 'bloque' : 'reussi',
      severity: isSuspicious ? 'eleve' : 'moyen',
      device: authCtx.session.device,
      os: authCtx.session.os,
      browser: authCtx.session.browser,
      sessionId: authCtx.session.sessionId,
      beforeValue: `${serverBalance} FCFA`,
      afterValue: `${newBalance} FCFA`,
      details: isSuspicious ? suspicionReasons.join(' | ') : `Canal ${entry.channel} (${entry.reference})`,
      ipAddress: ip,
      financialTrace: {
        operationType: isSuspicious ? 'Retrait mis en attente (vérification)' : 'Retrait validé serveur',
        transactionId: entry.reference,
        initiatorName: authCtx.token.name,
        initiatorId: authCtx.token.uid,
        beneficiaryAccount: `${entry.channel} (${maskPayoutTarget(targetPayoutClean)})`,
        amountFcfa: amount,
        feesFcfa: 0,
        previousBalanceFcfa: serverBalance,
        newBalanceFcfa: newBalance,
        status: entry.status,
        timestamp: entry.createdAt,
        validationResult: isSuspicious ? `Bloqué préventivement : ${suspicionReasons[0]}` : 'Validé côté serveur',
        channel: entry.channel
      }
    });

    return res.json({
      success: true,
      heldForVerification: isSuspicious,
      suspicionReasons,
      entry,
      newBalanceFcfa: newBalance,
      message: isSuspicious
        ? `Opération suspendue temporairement pour vérification de sécurité (${suspicionReasons[0]}). Preuves conservées.`
        : `Retrait de ${amount.toLocaleString('fr-FR')} FCFA validé côté serveur.`
    });
  });

  app.post(
    '/api/finance/suspicious/:id/review',
    requireSecurityPermission('manageFinanceProtection', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
      const actorCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
      const ua = parseUserAgent(req.header('user-agent'));
      const entry = securityDb.financeLedger.find((e) => e.id === req.params.id);
      if (!entry) {
        return res.status(404).json({ success: false, error: 'Opération financière introuvable' });
      }
      const { decision, note } = req.body || {};
      if (decision !== 'approve' && decision !== 'reject') {
        return res.status(400).json({ success: false, error: 'Décision invalide (approve ou reject)' });
      }
      const prevStatus = entry.status;
      const prevBal = computeServerLedgerBalance(entry.accountId);
      entry.status = decision === 'approve' ? 'valide' : 'rejete';
      if (decision === 'approve') entry.type = 'debit';
      entry.reviewedBy = actor.name;
      entry.reviewedAt = new Date().toISOString();
      entry.reviewNote = redactSensitiveText(String(note || (decision === 'approve' ? 'Approuvé après vérification' : 'Rejeté pour fraude suspectée')));

      if (decision === 'approve' && entry.payoutTarget) {
        const list = securityDb.knownPayoutTargets[entry.accountId] || [];
        if (!list.includes(entry.payoutTarget)) {
          securityDb.knownPayoutTargets[entry.accountId] = [...list, entry.payoutTarget];
        }
      }

      const nextBal = computeServerLedgerBalance(entry.accountId);
      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'wallets',
        actionType: decision === 'approve' ? 'admin_withdrawal_approved' : 'admin_withdrawal_rejected',
        action: decision === 'approve' ? 'Approbation retrait suspect après contrôle' : 'Rejet définitif retrait suspect',
        target: `${entry.accountEmail} • ${entry.amountFcfa.toLocaleString('fr-FR')} FCFA`,
        targetType: 'finance',
        entityType: 'transaction',
        entityId: entry.reference,
        result: 'reussi',
        severity: decision === 'approve' ? 'eleve' : 'critique',
        device: actorCtx?.session.device || ua.device,
        os: actorCtx?.session.os || ua.os,
        browser: actorCtx?.session.browser || ua.browser,
        sessionId: actorCtx?.session.sessionId,
        reason: entry.reviewNote,
        beforeValue: prevStatus,
        afterValue: entry.status,
        details: entry.reviewNote || '',
        ipAddress: getClientIp(req),
        financialTrace: {
          operationType: decision === 'approve' ? 'Validation manuelle retrait' : 'Rejet retrait suspect',
          transactionId: entry.reference,
          initiatorName: actor.name,
          initiatorId: actor.id,
          beneficiaryAccount: `${entry.accountName} (${entry.channel})`,
          amountFcfa: entry.amountFcfa,
          feesFcfa: 0,
          previousBalanceFcfa: prevBal,
          newBalanceFcfa: nextBal,
          status: entry.status,
          timestamp: entry.reviewedAt,
          validationResult: decision === 'approve' ? 'Approuvé par sécurité' : 'Rejeté & fonds recrédités',
          channel: entry.channel
        }
      });

      res.json({ success: true, entry });
    }
  );

  // --------------------------------------------------------------------------
  // 5. AUTHENTICATED IDENTITY DIRECTORY
  // --------------------------------------------------------------------------
  app.get('/api/security/me', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const actor = authCtx.staff;
    if (!actor || authCtx.token.spaceRole !== 'admin') {
      return res.status(403).json({
        success: false,
        authorized: false,
        message: 'Accès réservé aux administrateurs et agents de sécurité accrédités.'
      });
    }
    const hasAnyPermission =
      actor.role === 'super_admin' ||
      (actor.role !== 'other_agent' && Object.values(actor.permissions).some(Boolean));
    return res.json({
      success: true,
      authorized: hasAnyPermission,
      actor,
      staffDirectory: actor.role === 'super_admin' || actor.permissions.managePermissions ? securityDb.staff : []
    });
  });

  // --------------------------------------------------------------------------
  // 6. DASHBOARD KPIs
  // --------------------------------------------------------------------------
  app.get('/api/security/dashboard', requireSecurityPermission('viewDashboard'), (req: Request, res: Response) => {
    const period = String(req.query.period || '7d');
    const fromParam = typeof req.query.from === 'string' ? req.query.from : undefined;
    const toParam = typeof req.query.to === 'string' ? req.query.to : undefined;

    const { filtered: loginsInPeriod, from, to } = filterByDateRange(securityDb.loginLogs, period, fromParam, toParam);
    const { filtered: intrusionsInPeriod } = filterByDateRange(securityDb.intrusions, period, fromParam, toParam);
    const { filtered: attacksInPeriod } = filterByDateRange(securityDb.cyberAttacks, period, fromParam, toParam);

    const activeSessions = securityDb.sessions.filter((s) => s.status === 'active' || s.status === 'suspect').length;
    const now = Date.now();
    const suspendedCount = securityDb.suspendedAccounts.filter(
      (s) => s.active && (!s.expiresAt || new Date(s.expiresAt).getTime() > now)
    ).length;
    const activeBlockedIpsCount = securityDb.blockedIps.filter(
      (b) => b.active && (!b.expiresAt || new Date(b.expiresAt).getTime() > now)
    ).length;
    const suspiciousWithdrawals = securityDb.financeLedger.filter(
      (f) => f.status === 'en_attente_verification' || f.status === 'bloque_securite'
    ).length;
    const openSecurityIncidents = securityDb.incidents.filter((i) => i.status !== 'resolu').length;

    const unresolvedAlerts = securityDb.alerts.filter((a) => a.status !== 'resolue');
    const integrity = verifyAuditChainIntegrity();

    const spaces: Array<{ space: PlatformSpaceRole; label: string; accountType: SecurityAccountType }> = [
      { space: 'client', label: 'Client', accountType: 'client' },
      { space: 'seller', label: 'Vendeur', accountType: 'vendeur' },
      { space: 'admin', label: 'Administrateur', accountType: 'administrateur' }
    ];

    const spacesProtected = spaces.map((sp) => ({
      space: sp.space,
      label: sp.label,
      activeSessionsCount: securityDb.sessions.filter(
        (s) => (s.status === 'active' || s.status === 'suspect') && (s.spaceRole === sp.space || s.accountType === sp.accountType)
      ).length,
      suspendedCount: securityDb.suspendedAccounts.filter(
        (s) => s.active && s.accountType === sp.accountType
      ).length,
      isolationEnforced: true
    }));

    res.json({
      success: true,
      period,
      from,
      to,
      kpis: {
        totalLogins: loginsInPeriod.length,
        successfulLogins: loginsInPeriod.filter((l) => l.status === 'reussite').length,
        failedLogins: loginsInPeriod.filter((l) => l.status === 'echec').length,
        suspiciousLogins: loginsInPeriod.filter((l) => l.status === 'suspect').length,
        detectedIncidents: intrusionsInPeriod.length,
        blockedAttacks: attacksInPeriod.filter((a) => a.blocked).length,
        activeSessions,
        temporarilySuspendedAccounts: suspendedCount,
        suspiciousWithdrawals,
        openSecurityIncidents
      },
      unresolvedAlertsCount: {
        critique: unresolvedAlerts.filter((a) => a.severity === 'critique').length,
        eleve: unresolvedAlerts.filter((a) => a.severity === 'eleve').length,
        moyen: unresolvedAlerts.filter((a) => a.severity === 'moyen').length,
        faible: unresolvedAlerts.filter((a) => a.severity === 'faible').length,
        information: unresolvedAlerts.filter((a) => a.severity === 'information').length,
        total: unresolvedAlerts.length
      },
      activeBlockedIpsCount,
      spacesProtected,
      protectionsStatus: {
        expressAppWaf: 'active',
        rateLimiting: securityDb.settings.rateLimitPerMinute > 0 ? 'active' : 'disabled',
        bruteForceGuard: 'active',
        hmacSessionTokens: 'active',
        tenantRbacIsolation: 'active',
        serverFinanceLedger: 'active',
        sqlXssInspection:
          securityDb.settings.detectSqlInjection && securityDb.settings.detectXss
            ? 'active'
            : securityDb.settings.detectSqlInjection || securityDb.settings.detectXss
            ? 'partial'
            : 'disabled',
        cloudflareWaf: securityDb.settings.cloudflareWafConnected ? 'connected' : 'not_connected'
      },
      logIntegrity: {
        valid: integrity.valid,
        totalEntries: integrity.totalEntries,
        lastHash: integrity.lastHash
      }
    });
  });

  // --------------------------------------------------------------------------
  // 7. LOGIN JOURNAL, INTRUSIONS, CYBERATTACKS, 5-LEVEL ALERTS
  // --------------------------------------------------------------------------
  app.get('/api/security/logins', requireSecurityPermission('viewLoginLogs'), (req: Request, res: Response) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const accountType = String(req.query.accountType || 'all');
    const status = String(req.query.status || 'all');
    const period = String(req.query.period || '30d');

    const { filtered: inPeriod } = filterByDateRange(
      securityDb.loginLogs,
      period,
      typeof req.query.from === 'string' ? req.query.from : undefined,
      typeof req.query.to === 'string' ? req.query.to : undefined
    );

    const result = inPeriod.filter((item) => {
      if (accountType !== 'all' && item.accountType !== accountType) return false;
      if (status !== 'all' && item.status !== status) return false;
      if (q) {
        const hay = `${item.accountName} ${item.accountId} ${item.accountEmail} ${item.ipAddress} ${item.device} ${item.browser} ${item.os}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    res.json({ success: true, total: result.length, logs: result.slice(0, 200) });
  });

  app.get('/api/security/intrusions', requireSecurityPermission('viewIntrusions'), (req: Request, res: Response) => {
    const severity = String(req.query.severity || 'all');
    const status = String(req.query.status || 'all');
    const result = securityDb.intrusions.filter((item) => {
      if (severity !== 'all' && item.severity !== severity) return false;
      if (status !== 'all' && item.status !== status) return false;
      return true;
    });
    res.json({ success: true, total: result.length, intrusions: result.slice(0, 200) });
  });

  app.get('/api/security/cyberattacks', requireSecurityPermission('viewCyberattacks'), (req: Request, res: Response) => {
    const attackType = String(req.query.attackType || 'all');
    const result = securityDb.cyberAttacks.filter((item) => {
      if (attackType !== 'all' && item.attackType !== attackType) return false;
      return true;
    });
    res.json({
      success: true,
      total: result.length,
      cloudflareWafConnected: securityDb.settings.cloudflareWafConnected,
      cyberAttacks: result.slice(0, 200)
    });
  });

  app.get('/api/security/alerts', requireSecurityPermission('manageAlerts'), (req: Request, res: Response) => {
    const severity = String(req.query.severity || 'all');
    const status = String(req.query.status || 'all');
    const result = securityDb.alerts.filter((a) => {
      if (severity !== 'all' && a.severity !== severity) return false;
      if (status !== 'all' && a.status !== status) return false;
      return true;
    });
    res.json({ success: true, total: result.length, alerts: result.slice(0, 250) });
  });

  app.post('/api/security/alerts/:id/status', requireSecurityPermission('manageAlerts'), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const alert = securityDb.alerts.find((a) => a.id === req.params.id);
    if (!alert) return res.status(404).json({ success: false, error: 'Alerte introuvable' });

    const { status, note } = req.body || {};
    if (!['en_examen', 'resolue'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Statut invalide' });
    }

    const oldStatus = alert.status;
    alert.status = status;
    const nowIso = new Date().toISOString();
    if (status === 'en_examen') {
      alert.examinedBy = actor.name;
      alert.examinedAt = nowIso;
    } else if (status === 'resolue') {
      alert.resolvedBy = actor.name;
      alert.resolvedAt = nowIso;
      alert.resolutionNote = note ? redactSensitiveText(String(note)) : 'Examinée et résolue';
    }

    const actorCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
    const ua = parseUserAgent(req.header('user-agent'));
    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'security',
      actionType: status === 'en_examen' ? 'alert_examined' : 'alert_resolved',
      action: status === 'en_examen' ? "Prise en examen d'alerte" : "Résolution d'alerte sécurité",
      target: alert.title,
      targetType: 'alert',
      entityType: 'alert',
      entityId: alert.id,
      result: 'reussi',
      severity: 'moyen',
      device: actorCtx?.session.device || ua.device,
      os: actorCtx?.session.os || ua.os,
      browser: actorCtx?.session.browser || ua.browser,
      sessionId: actorCtx?.session.sessionId,
      reason: alert.resolutionNote,
      beforeValue: oldStatus,
      afterValue: status,
      details: alert.resolutionNote || `Alerte ${alert.id} passée à ${status}`,
      ipAddress: getClientIp(req)
    });

    res.json({ success: true, alert });
  });

  // --------------------------------------------------------------------------
  // 8. SESSIONS, PROTECTION ACTIONS & INCIDENT MANAGEMENT
  // --------------------------------------------------------------------------
  app.get('/api/security/sessions', requireSecurityPermission('manageSessions'), (_req: Request, res: Response) => {
    const now = Date.now();
    const sessions = securityDb.sessions.map((s) => ({
      ...s,
      durationSeconds:
        s.status === 'active' || s.status === 'suspect'
          ? Math.max(0, Math.floor((now - new Date(s.startedAt).getTime()) / 1000))
          : s.durationSeconds
    }));
    res.json({
      success: true,
      sessions,
      blockedIps: securityDb.blockedIps,
      suspendedAccounts: securityDb.suspendedAccounts
    });
  });

  app.post('/api/security/actions/block-ip', requireSecurityPermission('executeProtectionActions'), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const { ipAddress, reason, durationMinutes } = req.body || {};
    const ip = String(ipAddress || '').trim();
    if (!ip) return res.status(400).json({ success: false, error: 'Adresse IP requise' });

    const existing = securityDb.blockedIps.find((b) => b.ipAddress === ip && b.active);
    if (existing) return res.json({ success: true, blockedIp: existing, message: 'IP déjà bloquée.' });

    const expiresAt =
      durationMinutes && Number(durationMinutes) > 0
        ? new Date(Date.now() + Number(durationMinutes) * 60_000).toISOString()
        : null;
    const entry: SecurityBlockedIp = {
      id: `bip-${crypto.randomUUID()}`,
      ipAddress: ip,
      reason: redactSensitiveText(String(reason || 'Action manuelle administrateur')),
      blockedBy: actor.name,
      blockedAt: new Date().toISOString(),
      expiresAt,
      active: true
    };
    securityDb.blockedIps.unshift(entry);
    const blockUa = parseUserAgent(req.header('user-agent'));
    const blockCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'security',
      actionType: 'admin_block_ip',
      action: 'Blocage adresse IP',
      target: ip,
      targetType: 'ip',
      entityType: 'ip_address',
      entityId: ip,
      result: 'reussi',
      severity: 'eleve',
      device: blockCtx?.session.device || blockUa.device,
      os: blockCtx?.session.os || blockUa.os,
      browser: blockCtx?.session.browser || blockUa.browser,
      sessionId: blockCtx?.session.sessionId,
      reason: entry.reason,
      beforeValue: 'autorisée',
      afterValue: expiresAt ? `bloquée jusqu’à ${expiresAt}` : 'bloquée (permanent)',
      details: entry.reason,
      ipAddress: getClientIp(req)
    });
    res.json({ success: true, blockedIp: entry });
  });

  app.post('/api/security/actions/unblock-ip', requireSecurityPermission('executeProtectionActions'), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const { ipAddress } = req.body || {};
    const ip = String(ipAddress || '').trim();
    const entry = securityDb.blockedIps.find((b) => b.ipAddress === ip && b.active);
    if (!entry) return res.status(404).json({ success: false, error: 'Blocage IP introuvable' });

    entry.active = false;
    entry.unblockedBy = actor.name;
    entry.unblockedAt = new Date().toISOString();
    const unblockUa = parseUserAgent(req.header('user-agent'));
    const unblockCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'security',
      actionType: 'admin_unblock_ip',
      action: 'Déblocage adresse IP',
      target: ip,
      targetType: 'ip',
      entityType: 'ip_address',
      entityId: ip,
      result: 'reussi',
      severity: 'moyen',
      device: unblockCtx?.session.device || unblockUa.device,
      os: unblockCtx?.session.os || unblockUa.os,
      browser: unblockCtx?.session.browser || unblockUa.browser,
      sessionId: unblockCtx?.session.sessionId,
      beforeValue: 'bloquée',
      afterValue: 'autorisée',
      details: `Déblocage manuel par ${actor.name}`,
      ipAddress: getClientIp(req)
    });
    res.json({ success: true, blockedIp: entry });
  });

  app.post('/api/security/actions/suspend-account', requireSecurityPermission('executeProtectionActions'), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const { accountId, accountName, accountEmail, accountType, reason, durationMinutes } = req.body || {};
    if (!accountEmail && !accountId) {
      return res.status(400).json({ success: false, error: 'Identifiant ou email requis' });
    }
    const emailNorm = String(accountEmail || accountId).toLowerCase();
    const existing = securityDb.suspendedAccounts.find(
      (s) => s.active && (s.accountEmail === emailNorm || s.accountId === String(accountId))
    );
    if (existing) return res.json({ success: true, suspendedAccount: existing });

    const expiresAt =
      durationMinutes && Number(durationMinutes) > 0
        ? new Date(Date.now() + Number(durationMinutes) * 60_000).toISOString()
        : null;
    const record: SecuritySuspendedAccount = {
      accountId: String(accountId || emailNorm),
      accountName: String(accountName || emailNorm),
      accountEmail: emailNorm,
      accountType: accountType || 'client',
      reason: redactSensitiveText(String(reason || 'Suspension préventive de sécurité')),
      suspendedBy: actor.name,
      suspendedAt: new Date().toISOString(),
      expiresAt,
      active: true,
      blockedOperations: ['withdrawals', 'profile_changes', 'role_changes']
    };
    securityDb.suspendedAccounts.unshift(record);
    securityDb.sessions.forEach((s) => {
      if ((s.status === 'active' || s.status === 'suspect') && (s.userEmail === emailNorm || s.userId === record.accountId)) {
        s.status = 'revoked';
        s.revokedBy = actor.name;
        s.revokedAt = new Date().toISOString();
      }
    });
    securityDb.incidents.unshift({
      id: `inc-${crypto.randomUUID()}`,
      accountId: record.accountId,
      accountName: record.accountName,
      accountEmail: record.accountEmail,
      accountType: record.accountType,
      type: 'account_suspension',
      status: 'ouvert',
      severity: 'eleve',
      summary: record.reason,
      blockedOperations: record.blockedOperations || ['withdrawals'],
      createdBy: actor.name,
      createdAt: new Date().toISOString(),
      timeline: [{ at: new Date().toISOString(), actor: actor.name, action: 'Compte suspendu', details: record.reason }]
    });

    const suspUa = parseUserAgent(req.header('user-agent'));
    const suspCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'security',
      actionType: 'admin_suspend_account',
      action: 'Suspension temporaire de compte',
      target: `${record.accountName} (${record.accountEmail})`,
      targetType: 'account',
      entityType: 'account',
      entityId: record.accountId,
      result: 'reussi',
      severity: 'eleve',
      device: suspCtx?.session.device || suspUa.device,
      os: suspCtx?.session.os || suspUa.os,
      browser: suspCtx?.session.browser || suspUa.browser,
      sessionId: suspCtx?.session.sessionId,
      reason: record.reason,
      beforeValue: 'actif',
      afterValue: 'suspendu',
      details: record.reason,
      ipAddress: getClientIp(req)
    });
    res.json({ success: true, suspendedAccount: record });
  });

  app.post('/api/security/actions/reactivate-account', requireSecurityPermission('executeProtectionActions'), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const { accountId, accountEmail, note } = req.body || {};
    const targetKey = String(accountEmail || accountId || '').toLowerCase();
    const record = securityDb.suspendedAccounts.find(
      (s) => s.active && (s.accountEmail === targetKey || s.accountId.toLowerCase() === targetKey)
    );
    if (!record) return res.status(404).json({ success: false, error: 'Suspension active introuvable' });

    record.active = false;
    record.blockedOperations = [];
    record.reactivatedBy = actor.name;
    record.reactivatedAt = new Date().toISOString();

    securityDb.incidents.forEach((inc) => {
      if ((inc.accountEmail === record.accountEmail || inc.accountId === record.accountId) && inc.status !== 'resolu') {
        inc.status = 'resolu';
        inc.resolvedBy = actor.name;
        inc.resolvedAt = new Date().toISOString();
        inc.timeline.push({
          at: new Date().toISOString(),
          actor: actor.name,
          action: 'Compte réactivé après vérification',
          details: redactSensitiveText(String(note || 'Identité et sécurité vérifiées'))
        });
      }
    });

    const reactUa = parseUserAgent(req.header('user-agent'));
    const reactCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'security',
      actionType: 'admin_reactivate_account',
      action: 'Réactivation de compte',
      target: `${record.accountName} (${record.accountEmail})`,
      targetType: 'account',
      entityType: 'account',
      entityId: record.accountId,
      result: 'reussi',
      severity: 'moyen',
      device: reactCtx?.session.device || reactUa.device,
      os: reactCtx?.session.os || reactUa.os,
      browser: reactCtx?.session.browser || reactUa.browser,
      sessionId: reactCtx?.session.sessionId,
      reason: note ? redactSensitiveText(String(note)) : 'Vérification effectuée',
      beforeValue: 'suspendu',
      afterValue: 'actif',
      details: `Compte réactivé par ${actor.name}`,
      ipAddress: getClientIp(req)
    });
    res.json({ success: true, suspendedAccount: record });
  });

  app.post('/api/security/actions/revoke-session', requireSecurityPermission('manageSessions'), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const { sessionId, reason } = req.body || {};
    const session = securityDb.sessions.find((s) => s.sessionId === sessionId || s.id === sessionId);
    if (!session) return res.status(404).json({ success: false, error: 'Session introuvable' });

    const prev = session.status;
    session.status = 'revoked';
    session.revokedBy = actor.name;
    session.revokedAt = new Date().toISOString();

    createAlertIfEnabled({
      title: 'Session révoquée par la sécurité',
      description: `Session de ${session.userEmail} (${session.device} - ${session.ipAddress}) révoquée par ${actor.name}.`,
      severity: 'information',
      category: 'session',
      targetUserOrResource: session.userEmail,
      sourceIp: session.ipAddress,
      recommendedAction: 'Aucune action supplémentaire requise.'
    });

    const revUa = parseUserAgent(req.header('user-agent'));
    const revCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'security',
      actionType: 'admin_revoke_session',
      action: "Déconnexion forcée d'un appareil",
      target: `${session.userEmail} (${session.device} - ${session.ipAddress})`,
      targetType: 'session',
      entityType: 'session',
      entityId: session.sessionId,
      result: 'reussi',
      severity: 'moyen',
      device: revCtx?.session.device || revUa.device,
      os: revCtx?.session.os || revUa.os,
      browser: revCtx?.session.browser || revUa.browser,
      sessionId: revCtx?.session.sessionId,
      reason: redactSensitiveText(String(reason || 'Révocation manuelle')),
      beforeValue: prev,
      afterValue: 'revoked',
      details: redactSensitiveText(String(reason || 'Révocation manuelle de session suspecte')),
      ipAddress: getClientIp(req)
    });
    res.json({ success: true, session });
  });

  app.post('/api/security/actions/revoke-user-sessions', requireSecurityPermission('executeProtectionActions'), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const { userEmail, userId, reason } = req.body || {};
    const key = String(userEmail || userId || '').toLowerCase();
    let count = 0;
    securityDb.sessions.forEach((s) => {
      if (s.status !== 'revoked' && (s.userEmail.toLowerCase() === key || s.userId.toLowerCase() === key)) {
        s.status = 'revoked';
        s.revokedBy = actor.name;
        s.revokedAt = new Date().toISOString();
        count += 1;
      }
    });
    const revAllUa = parseUserAgent(req.header('user-agent'));
    const revAllCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'security',
      actionType: 'admin_revoke_all_user_sessions',
      action: "Révocation de toutes les sessions d'un utilisateur",
      target: key,
      targetType: 'session',
      entityType: 'account',
      entityId: key,
      result: 'reussi',
      severity: 'eleve',
      device: revAllCtx?.session.device || revAllUa.device,
      os: revAllCtx?.session.os || revAllUa.os,
      browser: revAllCtx?.session.browser || revAllUa.browser,
      sessionId: revAllCtx?.session.sessionId,
      reason: redactSensitiveText(String(reason || 'Révocation globale')),
      beforeValue: `${count} session(s) active(s)`,
      afterValue: '0 active (toutes révoquées)',
      details: redactSensitiveText(String(reason || 'Révocation globale des sessions')),
      ipAddress: getClientIp(req)
    });
    res.json({ success: true, revokedCount: count });
  });

  app.post('/api/security/actions/require-reauth', requireSecurityPermission('executeProtectionActions'), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const { userEmail, userId, reason } = req.body || {};
    const key = String(userEmail || userId || '').toLowerCase();
    let count = 0;
    securityDb.sessions.forEach((s) => {
      if ((s.status === 'active' || s.status === 'suspect') && (s.userEmail.toLowerCase() === key || s.userId.toLowerCase() === key)) {
        s.status = 'reauth_required';
        count += 1;
      }
    });
    const reauthUa = parseUserAgent(req.header('user-agent'));
    const reauthCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'security',
      actionType: 'admin_require_reauth',
      action: 'Exigence de nouvelle authentification',
      target: key,
      targetType: 'account',
      entityType: 'account',
      entityId: key,
      result: 'reussi',
      severity: 'moyen',
      device: reauthCtx?.session.device || reauthUa.device,
      os: reauthCtx?.session.os || reauthUa.os,
      browser: reauthCtx?.session.browser || reauthUa.browser,
      sessionId: reauthCtx?.session.sessionId,
      reason: redactSensitiveText(String(reason || 'Contrôle identité')),
      beforeValue: 'session valide',
      afterValue: 'reauth_required',
      details: redactSensitiveText(String(reason || `Ré-authentification imposée sur ${count} session(s)`)),
      ipAddress: getClientIp(req)
    });
    res.json({ success: true, updatedCount: count });
  });

  // Incident Management (Section 10)
  app.get('/api/security/incidents', requireSecurityPermission('manageIncidents'), (_req: Request, res: Response) => {
    res.json({ success: true, incidents: securityDb.incidents.slice(0, 200) });
  });

  app.post('/api/security/incidents/compromised', requireSecurityPermission('manageIncidents'), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const { accountId, accountName, accountEmail, accountType, summary, blockedOperations, forcePasswordReset } = req.body || {};
    const emailNorm = String(accountEmail || accountId || '').trim().toLowerCase();
    if (!emailNorm) return res.status(400).json({ success: false, error: 'Email ou ID compte requis' });

    const ops: SensitiveOperationType[] = Array.isArray(blockedOperations) && blockedOperations.length > 0
      ? blockedOperations
      : ['withdrawals', 'profile_changes', 'role_changes'];

    const incident: SecurityIncidentRecord = {
      id: `inc-${crypto.randomUUID()}`,
      accountId: String(accountId || emailNorm),
      accountName: String(accountName || emailNorm),
      accountEmail: emailNorm,
      accountType: accountType || 'client',
      type: 'compromised_account',
      status: 'ouvert',
      severity: 'critique',
      summary: redactSensitiveText(String(summary || 'Compte signalé potentiellement compromis')),
      blockedOperations: ops,
      createdBy: actor.name,
      createdAt: new Date().toISOString(),
      timeline: [
        {
          at: new Date().toISOString(),
          actor: actor.name,
          action: 'Signalement compte compromis',
          details: `Opérations bloquées : ${ops.join(', ')}${forcePasswordReset ? ' • Réinitialisation mot de passe forcée' : ''}`
        }
      ]
    };
    securityDb.incidents.unshift(incident);

    // Record protection without deleting account/history
    const existingSusp = securityDb.suspendedAccounts.find((s) => s.accountEmail === emailNorm && s.active);
    if (existingSusp) {
      existingSusp.compromisedFlag = true;
      existingSusp.forcePasswordReset = Boolean(forcePasswordReset);
      existingSusp.blockedOperations = ops;
    } else {
      securityDb.suspendedAccounts.unshift({
        accountId: incident.accountId,
        accountName: incident.accountName,
        accountEmail: emailNorm,
        accountType: incident.accountType,
        reason: incident.summary,
        suspendedBy: actor.name,
        suspendedAt: new Date().toISOString(),
        expiresAt: null,
        active: true,
        compromisedFlag: true,
        forcePasswordReset: Boolean(forcePasswordReset),
        blockedOperations: ops
      });
    }

    // Revoke all sessions of the compromised account immediately
    securityDb.sessions.forEach((s) => {
      if (s.status !== 'revoked' && (s.userEmail === emailNorm || s.userId === incident.accountId)) {
        s.status = 'revoked';
        s.revokedBy = actor.name;
        s.revokedAt = new Date().toISOString();
      }
    });

    createAlertIfEnabled({
      title: 'Compte signalé compromis — Mesures conservatoires activées',
      description: `${incident.accountName} (${emailNorm}) isolé : sessions révoquées et opérations sensibles bloquées sans suppression des données.`,
      severity: 'critique',
      category: 'auth',
      targetUserOrResource: emailNorm,
      sourceIp: getClientIp(req),
      recommendedAction: 'Vérifier avec le titulaire et forcer la réinitialisation du mot de passe.'
    });

    const compUa = parseUserAgent(req.header('user-agent'));
    const compCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'security',
      actionType: 'incident_compromised_account',
      action: 'Signalement compte compromis',
      target: `${incident.accountName} (${emailNorm})`,
      targetType: 'incident',
      entityType: 'incident',
      entityId: incident.id,
      result: 'reussi',
      severity: 'critique',
      device: compCtx?.session.device || compUa.device,
      os: compCtx?.session.os || compUa.os,
      browser: compCtx?.session.browser || compUa.browser,
      sessionId: compCtx?.session.sessionId,
      reason: incident.summary,
      beforeValue: 'normal',
      afterValue: `compromis (${ops.join(', ')})`,
      details: incident.summary,
      ipAddress: getClientIp(req)
    });

    res.json({ success: true, incident });
  });

  app.post('/api/security/incidents/force-password-reset', requireSecurityPermission('manageIncidents'), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const { accountId, accountEmail, reason } = req.body || {};
    const emailNorm = String(accountEmail || accountId || '').toLowerCase();
    if (!emailNorm) return res.status(400).json({ success: false, error: 'Compte requis' });

    const existingSusp = securityDb.suspendedAccounts.find((s) => s.accountEmail === emailNorm && s.active);
    if (existingSusp) {
      existingSusp.forcePasswordReset = true;
    }

    securityDb.sessions.forEach((s) => {
      if (s.status === 'active' && (s.userEmail === emailNorm || s.userId === String(accountId))) {
        s.status = 'reauth_required';
      }
    });

    const incident: SecurityIncidentRecord = {
      id: `inc-${crypto.randomUUID()}`,
      accountId: String(accountId || emailNorm),
      accountName: emailNorm,
      accountEmail: emailNorm,
      accountType: 'client',
      type: 'forced_reset',
      status: 'en_verification',
      severity: 'eleve',
      summary: redactSensitiveText(String(reason || 'Réinitialisation sécurisée du mot de passe imposée')),
      blockedOperations: ['withdrawals'],
      createdBy: actor.name,
      createdAt: new Date().toISOString(),
      timeline: [{ at: new Date().toISOString(), actor: actor.name, action: 'Réinitialisation forcée', details: String(reason || 'Contrôle sécurité') }]
    };
    securityDb.incidents.unshift(incident);

    const rstUa = parseUserAgent(req.header('user-agent'));
    const rstCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'security',
      actionType: 'incident_force_password_reset',
      action: 'Réinitialisation sécurisée mot de passe forcée',
      target: emailNorm,
      targetType: 'incident',
      entityType: 'incident',
      entityId: incident.id,
      result: 'reussi',
      severity: 'eleve',
      device: rstCtx?.session.device || rstUa.device,
      os: rstCtx?.session.os || rstUa.os,
      browser: rstCtx?.session.browser || rstUa.browser,
      sessionId: rstCtx?.session.sessionId,
      reason: incident.summary,
      beforeValue: 'normal',
      afterValue: 'réinitialisation requise',
      details: incident.summary,
      ipAddress: getClientIp(req)
    });

    res.json({ success: true, incident });
  });

  // --------------------------------------------------------------------------
  // 9. SECURITY SETTINGS (With Step-up MFA)
  // --------------------------------------------------------------------------
  app.get('/api/security/settings', requireSecurityPermission('viewDashboard'), (_req: Request, res: Response) => {
    res.json({ success: true, settings: securityDb.settings });
  });

  app.patch('/api/security/settings', requireSecurityPermission('modifySettings', { requireStepUpMfa: true }), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const setUa = parseUserAgent(req.header('user-agent'));
    const setCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
    const patch = req.body || {};
    const prevSnapshot = JSON.stringify(securityDb.settings);

    const allowedNumeric: Array<keyof SecuritySettings> = [
      'maxLoginAttempts',
      'tempBlockMinutes',
      'progressiveDelaySeconds',
      'rateLimitPerMinute',
      'sessionTtlMinutes',
      'maxAutoWithdrawalFcfa',
      'logRetentionDays'
    ];
    const allowedBoolean: Array<keyof SecuritySettings> = [
      'requireTwoFactorAdmins',
      'requireTwoFactorSensitiveActions',
      'requireReauthBeforeWithdrawals',
      'alertsEnabled',
      'notifySuperAdminOnCritical',
      'detectSqlInjection',
      'detectXss',
      'detectBotScanners',
      'detectUnusualDevices',
      'detectMaliciousUploads',
      'autoBlockOnCriticalAttack',
      'cloudflareWafConnected'
    ];

    const updated = { ...securityDb.settings };
    for (const k of allowedNumeric) {
      if (patch[k] !== undefined && Number.isFinite(Number(patch[k])) && Number(patch[k]) >= 1) {
        (updated as Record<string, unknown>)[k] = Number(patch[k]);
      }
    }
    for (const k of allowedBoolean) {
      if (typeof patch[k] === 'boolean') {
        (updated as Record<string, unknown>)[k] = patch[k];
      }
    }
    if (typeof patch.cloudflareZoneId === 'string') {
      updated.cloudflareZoneId = patch.cloudflareZoneId.trim().slice(0, 64);
    }
    updated.updatedAt = new Date().toISOString();
    updated.updatedBy = actor.name;

    securityDb.settings = updated;
    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'security',
      actionType: 'security_settings_updated',
      action: 'Modification des paramètres de sécurité',
      target: 'Politique de sécurité DJASSA',
      targetType: 'settings',
      entityType: 'security_policy',
      entityId: 'global-security-settings',
      result: 'reussi',
      severity: 'eleve',
      device: setCtx?.session.device || setUa.device,
      os: setCtx?.session.os || setUa.os,
      browser: setCtx?.session.browser || setUa.browser,
      sessionId: setCtx?.session.sessionId,
      beforeValue: prevSnapshot,
      afterValue: JSON.stringify(updated),
      details: `Paramètres de sécurité modifiés par ${actor.name}`,
      ipAddress: getClientIp(req)
    });

    res.json({ success: true, settings: securityDb.settings });
  });

  // --------------------------------------------------------------------------
  // 10. ADMIN CREATION GUARD & RBAC PERMISSIONS (Anti-SuperAdmin Elevation)
  // --------------------------------------------------------------------------
  app.get('/api/security/permissions', requireSecurityPermission('managePermissions'), (_req: Request, res: Response) => {
    res.json({ success: true, staff: securityDb.staff });
  });

  app.post('/api/security/staff', requireSecurityPermission('managePermissions', { requireStepUpMfa: true }), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const staffUa = parseUserAgent(req.header('user-agent'));
    const staffCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
    const ip = getClientIp(req);
    const { name, email, role, title } = req.body || {};

    if (actor.role !== 'super_admin' || role === 'super_admin') {
      securityDb.intrusions.unshift({
        id: `int-${crypto.randomUUID()}`,
        threatType: 'privilege_escalation',
        threatLabel: 'Tentative de création frauduleuse de compte Administrateur / Super Admin',
        targetAccountOrResource: String(email || 'inconnu'),
        sourceIp: ip,
        timestamp: new Date().toISOString(),
        severity: 'critique',
        status: 'bloque',
        details: `${actor.email} (${actor.role}) a tenté de créer un compte "${String(role)}"`,
        detectedBy: 'rbac_guard'
      });
      createAlertIfEnabled({
        title: 'Création frauduleuse de compte administrateur bloquée',
        description: `${actor.name} a tenté de créer un compte "${String(role)}".`,
        severity: 'critique',
        category: 'admin_security',
        targetUserOrResource: String(email || actor.email),
        sourceIp: ip,
        recommendedAction: 'Auditer le compte administrateur.'
      });
      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'security',
        actionType: 'unauthorized_admin_creation_blocked',
        action: 'Création non autorisée de compte admin bloquée',
        target: String(email || 'inconnu'),
        targetType: 'permissions',
        entityType: 'staff',
        entityId: String(email || 'unknown'),
        result: 'bloque',
        severity: 'critique',
        device: staffCtx?.session.device || staffUa.device,
        os: staffCtx?.session.os || staffUa.os,
        browser: staffCtx?.session.browser || staffUa.browser,
        sessionId: staffCtx?.session.sessionId,
        beforeValue: actor.role,
        afterValue: `Refusé (${String(role)})`,
        details: `${actor.email} (${actor.role}) a tenté de créer un compte "${String(role)}"`,
        ipAddress: ip
      });
      return res.status(403).json({
        success: false,
        error: 'UNAUTHORIZED_ADMIN_CREATION',
        message: 'Seul le Super Administrateur peut créer un collaborateur (et aucun nouveau Super Administrateur ne peut être créé ici).'
      });
    }

    const emailNorm = String(email || '').trim().toLowerCase();
    if (!name || !emailNorm) {
      return res.status(400).json({ success: false, error: 'Nom et email requis' });
    }
    if (securityDb.staff.some((s) => s.email.toLowerCase() === emailNorm)) {
      return res.status(409).json({ success: false, error: 'Collaborateur déjà enregistré' });
    }

    const validRole: SecurityRole = role === 'admin' || role === 'security_agent' ? role : 'other_agent';
    const created: SecurityStaffMember = {
      id: `sec-staff-${Date.now()}`,
      name: redactSensitiveText(String(name)),
      email: emailNorm,
      role: validRole,
      title: redactSensitiveText(String(title || 'Collaborateur DJASSA')),
      active: true,
      mfaEnabled: validRole !== 'other_agent',
      permissions: {
        viewDashboard: validRole !== 'other_agent',
        viewLoginLogs: validRole !== 'other_agent',
        viewIntrusions: validRole === 'security_agent',
        viewCyberattacks: validRole === 'security_agent',
        manageAlerts: validRole !== 'other_agent',
        executeProtectionActions: validRole === 'security_agent',
        manageSessions: validRole !== 'other_agent',
        modifySettings: false,
        managePermissions: false,
        manageFinanceProtection: validRole === 'admin' || validRole === 'security_agent',
        manageIncidents: validRole === 'security_agent'
      },
      createdAt: new Date().toISOString()
    };

    securityDb.staff.push(created);
    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'admin_mgmt',
      actionType: 'admin_staff_created',
      action: 'Création de collaborateur encadrée',
      target: `${created.name} (${created.email})`,
      targetType: 'permissions',
      entityType: 'staff',
      entityId: created.id,
      result: 'reussi',
      severity: 'eleve',
      device: staffCtx?.session.device || staffUa.device,
      os: staffCtx?.session.os || staffUa.os,
      browser: staffCtx?.session.browser || staffUa.browser,
      sessionId: staffCtx?.session.sessionId,
      beforeValue: null,
      afterValue: created.role,
      details: `Collaborateur ajouté par Super Admin`,
      ipAddress: ip
    });

    return res.json({ success: true, member: created });
  });

  app.patch('/api/security/permissions/:staffId', requireSecurityPermission('managePermissions', { requireStepUpMfa: true }), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const permUa = parseUserAgent(req.header('user-agent'));
    const permCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
    const ip = getClientIp(req);
    const member = securityDb.staff.find((s) => s.id === req.params.staffId);
    if (!member) return res.status(404).json({ success: false, error: 'Collaborateur introuvable' });

    const { role, active, permissions } = req.body || {};

    // Prevent modifying Super Admin or elevating anyone to Super Admin
    if (member.role === 'super_admin' || role === 'super_admin') {
      securityDb.intrusions.unshift({
        id: `int-${crypto.randomUUID()}`,
        threatType: 'privilege_escalation',
        threatLabel: 'Tentative de modification non autorisée du rôle Super Administrateur',
        targetAccountOrResource: member.email,
        sourceIp: ip,
        timestamp: new Date().toISOString(),
        severity: 'critique',
        status: 'bloque',
        details: `${actor.email} a tenté de modifier ou attribuer le rôle super_admin`,
        detectedBy: 'rbac_guard'
      });
      createAlertIfEnabled({
        title: 'Tentative d’altération du rôle Super Administrateur',
        description: `${actor.name} bloqué lors d’une modification sur ${member.email}.`,
        severity: 'critique',
        category: 'admin_security',
        targetUserOrResource: member.email,
        sourceIp: ip,
        recommendedAction: 'Vérifier immédiatement les journaux d’audit.'
      });
      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'security',
        actionType: 'super_admin_alteration_blocked',
        action: 'Altération du rôle Super Administrateur bloquée',
        target: `${member.name} (${member.email})`,
        targetType: 'permissions',
        entityType: 'staff',
        entityId: member.id,
        result: 'bloque',
        severity: 'critique',
        device: permCtx?.session.device || permUa.device,
        os: permCtx?.session.os || permUa.os,
        browser: permCtx?.session.browser || permUa.browser,
        sessionId: permCtx?.session.sessionId,
        beforeValue: member.role,
        afterValue: 'inchangé (bloqué)',
        details: `${actor.email} a tenté de modifier ou attribuer le rôle super_admin`,
        ipAddress: ip
      });
      return res.status(403).json({
        success: false,
        error: 'SUPER_ADMIN_IMMUTABLE',
        message: 'Le statut Super Administrateur est immuable et ne peut être ni altéré ni attribué.'
      });
    }

    // Ordinary admin cannot self-grant extra permissions
    if (actor.id === member.id && actor.role !== 'super_admin') {
      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'security',
        actionType: 'self_permission_elevation_blocked',
        action: 'Auto-élévation de permissions refusée',
        target: `${member.name} (${member.email})`,
        targetType: 'permissions',
        entityType: 'staff',
        entityId: member.id,
        result: 'refuse',
        severity: 'critique',
        device: permCtx?.session.device || permUa.device,
        os: permCtx?.session.os || permUa.os,
        browser: permCtx?.session.browser || permUa.browser,
        sessionId: permCtx?.session.sessionId,
        beforeValue: member.role,
        afterValue: 'inchangé (refusé)',
        details: `${actor.email} a tenté de modifier ses propres permissions`,
        ipAddress: ip
      });
      return res.status(403).json({
        success: false,
        error: 'SELF_PERMISSION_ELEVATION_FORBIDDEN',
        message: 'Un administrateur ne peut pas modifier ses propres permissions.'
      });
    }

    const prev = JSON.stringify({ role: member.role, active: member.active, permissions: member.permissions });
    if (typeof active === 'boolean') member.active = active;
    if (role && ['admin', 'security_agent', 'other_agent'].includes(role)) {
      member.role = role;
      if (role === 'other_agent') {
        (Object.keys(member.permissions) as SecurityPermissionKey[]).forEach((k) => {
          member.permissions[k] = false;
        });
      }
    }
    if (permissions && typeof permissions === 'object') {
      for (const key of Object.keys(member.permissions) as SecurityPermissionKey[]) {
        if (typeof permissions[key] === 'boolean') {
          member.permissions[key] = member.role === 'other_agent' ? false : permissions[key];
        }
      }
    }

    createAlertIfEnabled({
      title: 'Modification des permissions administratives',
      description: `Permissions de ${member.name} mises à jour par ${actor.name}.`,
      severity: 'moyen',
      category: 'admin_security',
      targetUserOrResource: member.email,
      sourceIp: ip,
      recommendedAction: 'Confirmer que le changement correspond au périmètre autorisé.'
    });

    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'admin_mgmt',
      actionType: 'admin_permissions_updated',
      action: 'Mise à jour des permissions de sécurité',
      target: `${member.name} (${member.email})`,
      targetType: 'permissions',
      entityType: 'staff',
      entityId: member.id,
      result: 'reussi',
      severity: 'eleve',
      device: permCtx?.session.device || permUa.device,
      os: permCtx?.session.os || permUa.os,
      browser: permCtx?.session.browser || permUa.browser,
      sessionId: permCtx?.session.sessionId,
      beforeValue: prev,
      afterValue: JSON.stringify({ role: member.role, active: member.active, permissions: member.permissions }),
      details: `Matrice RBAC modifiée par ${actor.name}`,
      ipAddress: ip
    });

    res.json({ success: true, member });
  });

  // --------------------------------------------------------------------------
  // 11. PROTECTED APPEND-ONLY AUDIT & CENTRALIZED ACTIVITY LOG
  // --------------------------------------------------------------------------
  app.get('/api/security/audit-logs', requireSecurityPermission('viewDashboard'), (_req: Request, res: Response) => {
    const integrity = verifyAuditChainIntegrity();
    res.json({
      success: true,
      integrity,
      logs: securityDb.auditLogs.slice(0, 300)
    });
  });

  // Helper to apply full centralized Activity Log filtering
  function filterActivityEntries(query: Record<string, unknown>): ProtectedAuditEntry[] {
    const q = String(query.q || '').trim().toLowerCase();
    const actor = String(query.actor || '').trim().toLowerCase();
    const role = String(query.role || '').trim().toLowerCase();
    const space = String(query.space || '').trim().toLowerCase();
    const actionType = String(query.actionType || '').trim().toLowerCase();
    const category = String(query.category || '').trim().toLowerCase();
    const severity = String(query.severity || '').trim().toLowerCase();
    const result = String(query.result || '').trim().toLowerCase();
    const ip = String(query.ip || '').trim().toLowerCase();
    const refId = String(query.refId || '').trim().toLowerCase();
    const from = String(query.from || '').trim();
    const to = String(query.to || '').trim();

    const fromMs = from ? new Date(from).getTime() : NaN;
    let toMs = NaN;
    if (to) {
      const endDate = new Date(to);
      if (!Number.isNaN(endDate.getTime())) {
        if (to.length <= 10) endDate.setHours(23, 59, 59, 999);
        toMs = endDate.getTime();
      }
    }

    return securityDb.auditLogs.filter((entry) => {
      if (!Number.isNaN(fromMs) || !Number.isNaN(toMs)) {
        const ts = new Date(entry.timestamp).getTime();
        if (!Number.isNaN(fromMs) && ts < fromMs) return false;
        if (!Number.isNaN(toMs) && ts > toMs) return false;
      }

      const entrySpace = (entry.space || inferActivitySpace(String(entry.actorRole))).toLowerCase();
      const entryCat = (entry.category || inferActivityCategory({ targetType: entry.targetType, action: entry.action })).toLowerCase();
      const entrySev = (entry.severity || 'information').toLowerCase();
      const entryRes = normalizeActivityResult(entry.result);

      if (space && space !== 'all' && entrySpace !== space) return false;
      if (role && role !== 'all' && String(entry.actorRole).toLowerCase() !== role) return false;
      if (category && category !== 'all' && entryCat !== category) return false;
      if (severity && severity !== 'all' && entrySev !== severity) return false;
      if (result && result !== 'all' && entryRes !== result) return false;
      if (ip && !entry.ipAddress.toLowerCase().includes(ip)) return false;

      if (actionType && actionType !== 'all') {
        const at = (entry.actionType || '').toLowerCase();
        const act = entry.action.toLowerCase();
        if (!at.includes(actionType) && !act.includes(actionType)) return false;
      }

      if (actor) {
        const matchActor =
          entry.actorName.toLowerCase().includes(actor) ||
          entry.actorId.toLowerCase().includes(actor) ||
          (entry.actorAccountLabel || '').toLowerCase().includes(actor);
        if (!matchActor) return false;
      }

      if (refId) {
        const matchRef =
          entry.id.toLowerCase().includes(refId) ||
          (entry.entityId || '').toLowerCase().includes(refId) ||
          entry.target.toLowerCase().includes(refId) ||
          (entry.financialTrace?.transactionId || '').toLowerCase().includes(refId) ||
          entry.details.toLowerCase().includes(refId);
        if (!matchRef) return false;
      }

      if (q) {
        const hay = [
          entry.id,
          entry.actorId,
          entry.actorName,
          entry.actorAccountLabel || '',
          entry.actorRole,
          entrySpace,
          entryCat,
          entry.action,
          entry.actionType || '',
          entry.target,
          entry.entityType || '',
          entry.entityId || '',
          entry.details,
          entry.ipAddress,
          entry.device || '',
          entry.os || '',
          entry.browser || '',
          entry.beforeValue || '',
          entry.afterValue || '',
          entry.financialTrace?.transactionId || '',
          entry.financialTrace?.beneficiaryAccount || ''
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }

  // Server-backed centralized Activity Log ingestion endpoint
  // Enforces verified identity when Bearer token is present so actors cannot spoof roles or user IDs.
  app.post('/api/activity/log', (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      const { device, browser, os } = parseUserAgent(req.header('user-agent'));
      const rawAuth = req.header('authorization');
      const hasBearer = Boolean(rawAuth && rawAuth.startsWith('Bearer '));
      let tokenPayload: VerifiedTokenPayload | null = null;
      let activeSession: SecurityActiveSession | undefined;

      if (hasBearer) {
        tokenPayload = verifySignedToken(rawAuth!.slice(7).trim());
        if (!tokenPayload) {
          return res.status(401).json({
            success: false,
            error: 'INVALID_SESSION_TOKEN',
            message: 'Jeton de session invalide ou expiré.'
          });
        }
        activeSession = securityDb.sessions.find((s) => s.sessionId === tokenPayload!.sid);
        if (!activeSession || activeSession.status === 'revoked' || activeSession.status === 'expired') {
          return res.status(401).json({
            success: false,
            error: 'SESSION_REVOKED',
            message: 'Session révoquée ou expirée.'
          });
        }
      }

      const body = (req.body || {}) as Record<string, unknown>;
      const requestedCategory = String(body.category || '') as ActivityCategory;
      const validCategories: ActivityCategory[] = [
        'auth',
        'accounts',
        'security',
        'orders',
        'payments',
        'wallets',
        'deliveries',
        'products',
        'messaging',
        'admin_mgmt',
        'system_config',
        'api'
      ];
      const category: ActivityCategory = validCategories.includes(requestedCategory)
        ? requestedCategory
        : 'system_config';

      // Unauthenticated requests are strictly limited to auth pre-login / client signup telemetry
      const isAllowedPreSessionSignup = category === 'accounts' && body.actionType === 'client_signup';
      if (!tokenPayload && category !== 'auth' && !isAllowedPreSessionSignup) {
        return res.status(401).json({
          success: false,
          error: 'AUTH_REQUIRED_FOR_ACTIVITY',
          message: 'Authentification requise pour journaliser cette catégorie d’activité.'
        });
      }

      const allowedSpaceHint = mapRoleToSpaceRole(typeof body.space === 'string' ? body.space : undefined);
      const actorId = tokenPayload
        ? tokenPayload.uid
        : String(body.actorId || body.actorAccountLabel || ip);
      const actorName = tokenPayload
        ? tokenPayload.name
        : String(body.actorName || 'Visiteur / Nouveau compte');
      const actorAccountLabel = tokenPayload
        ? tokenPayload.email
        : typeof body.actorAccountLabel === 'string'
        ? body.actorAccountLabel
        : undefined;
      const actorRole: ProtectedAuditEntry['actorRole'] = tokenPayload
        ? tokenPayload.secRole || tokenPayload.spaceRole
        : allowedSpaceHint === 'admin'
        ? 'client'
        : allowedSpaceHint;
      const space: ActivitySpace = tokenPayload
        ? tokenPayload.spaceRole
        : allowedSpaceHint === 'admin'
        ? 'client'
        : allowedSpaceHint;

      // Prevent non-admins from injecting admin_mgmt or system_config events
      if (tokenPayload && tokenPayload.spaceRole !== 'admin' && (category === 'admin_mgmt' || category === 'system_config')) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN_ACTIVITY_CATEGORY',
          message: 'Catégorie réservée aux opérations administrateur.'
        });
      }

      const action = String(body.action || '').trim();
      const target = String(body.target || actorAccountLabel || actorId).trim();
      if (!action) {
        return res.status(400).json({ success: false, error: 'Le champ action est requis.' });
      }

      const validTargetTypes: ProtectedAuditEntry['targetType'][] = [
        'ip',
        'account',
        'session',
        'alert',
        'settings',
        'permissions',
        'finance',
        'incident',
        'system',
        'order',
        'delivery',
        'product',
        'store',
        'message',
        'api'
      ];
      const rawTargetType = String(body.targetType || 'system') as ProtectedAuditEntry['targetType'];
      const targetType: ProtectedAuditEntry['targetType'] = validTargetTypes.includes(rawTargetType)
        ? rawTargetType
        : 'system';

      const validSeverities: AlertSeverityLevel[] = ['information', 'faible', 'moyen', 'eleve', 'critique'];
      const severity = validSeverities.includes(String(body.severity) as AlertSeverityLevel)
        ? (String(body.severity) as AlertSeverityLevel)
        : undefined;

      const financialRaw =
        body.financialTrace && typeof body.financialTrace === 'object'
          ? (body.financialTrace as Record<string, unknown>)
          : null;
      const financialTrace: FinancialTraceDetails | undefined = financialRaw
        ? {
            operationType: String(financialRaw.operationType || action),
            transactionId: String(financialRaw.transactionId || `TX-${Date.now()}`),
            initiatorName: tokenPayload ? tokenPayload.name : String(financialRaw.initiatorName || actorName),
            initiatorId: tokenPayload ? tokenPayload.uid : String(financialRaw.initiatorId || actorId),
            beneficiaryAccount: String(financialRaw.beneficiaryAccount || target),
            amountFcfa: Number(financialRaw.amountFcfa) || 0,
            feesFcfa: financialRaw.feesFcfa !== undefined ? Number(financialRaw.feesFcfa) : undefined,
            commissionFcfa: financialRaw.commissionFcfa !== undefined ? Number(financialRaw.commissionFcfa) : undefined,
            previousBalanceFcfa:
              financialRaw.previousBalanceFcfa !== undefined && financialRaw.previousBalanceFcfa !== null
                ? Number(financialRaw.previousBalanceFcfa)
                : null,
            newBalanceFcfa:
              financialRaw.newBalanceFcfa !== undefined && financialRaw.newBalanceFcfa !== null
                ? Number(financialRaw.newBalanceFcfa)
                : null,
            status: String(financialRaw.status || 'valide'),
            timestamp: String(financialRaw.timestamp || new Date().toISOString()),
            validationResult: String(financialRaw.validationResult || 'Validé'),
            channel: typeof financialRaw.channel === 'string' ? financialRaw.channel : undefined
          }
        : undefined;

      const idempotencyHeader = req.header('x-idempotency-key');
      const dedupKey =
        typeof body.dedupKey === 'string' && body.dedupKey.trim()
          ? body.dedupKey.trim()
          : typeof idempotencyHeader === 'string' && idempotencyHeader.trim()
          ? idempotencyHeader.trim()
          : undefined;

      const entry = appendAuditEntry({
        actorId,
        actorName,
        actorAccountLabel,
        actorRole,
        space,
        category,
        actionType: typeof body.actionType === 'string' ? body.actionType : undefined,
        action,
        target,
        targetType,
        entityType: typeof body.entityType === 'string' ? body.entityType : targetType,
        entityId: typeof body.entityId === 'string' ? body.entityId : undefined,
        result: typeof body.result === 'string' ? (body.result as ActivityResultStatus) : 'reussi',
        severity,
        device: activeSession?.device || device,
        os: activeSession?.os || os,
        browser: activeSession?.browser || browser,
        sessionId: tokenPayload?.sid,
        reason: typeof body.reason === 'string' ? body.reason : undefined,
        beforeValue: typeof body.beforeValue === 'string' ? body.beforeValue : null,
        afterValue: typeof body.afterValue === 'string' ? body.afterValue : null,
        details: String(body.details || action),
        ipAddress: ip,
        financialTrace,
        dedupKey
      });

      return res.json({ success: true, entry });
    } catch (err: unknown) {
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  app.get('/api/activity/logs', requireSecurityPermission('viewDashboard'), (req: Request, res: Response) => {
    const filtered = filterActivityEntries(req.query as Record<string, unknown>);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(5, Number(req.query.limit) || 25));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const startIdx = (safePage - 1) * pageSize;
    const logs = filtered.slice(startIdx, startIdx + pageSize);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayMs = startOfToday.getTime();

    const allLogs = securityDb.auditLogs;
    const activitiesToday = allLogs.filter((e) => new Date(e.timestamp).getTime() >= startOfTodayMs).length;
    const loginsCount = allLogs.filter((e) => (e.category || inferActivityCategory({ targetType: e.targetType, action: e.action })) === 'auth').length;
    const adminActionsCount = allLogs.filter((e) => {
      const sp = e.space || inferActivitySpace(String(e.actorRole));
      const cat = e.category || inferActivityCategory({ targetType: e.targetType, action: e.action });
      return sp === 'admin' || cat === 'admin_mgmt' || cat === 'system_config';
    }).length;
    const suspiciousActivitiesCount = allLogs.filter((e) => {
      const r = normalizeActivityResult(e.result);
      const sev = e.severity || 'information';
      return r === 'bloque' || r === 'refuse' || sev === 'eleve' || sev === 'critique' || e.action.toLowerCase().includes('suspect');
    }).length;
    const criticalEventsCount = allLogs.filter((e) => e.severity === 'critique').length;

    const integrity = verifyAuditChainIntegrity();
    res.json({
      success: true,
      logs,
      total,
      page: safePage,
      pageSize,
      totalPages,
      kpis: {
        activitiesToday,
        loginsCount,
        adminActionsCount,
        suspiciousActivitiesCount,
        criticalEventsCount
      },
      integrity,
      retention: {
        retentionDays: securityDb.settings.logRetentionDays || 180,
        storedEntries: allLogs.length,
        lastBackupAt: securityDb.lastActivityBackupAt || null
      }
    });
  });

  app.get('/api/activity/logs/:id', requireSecurityPermission('viewDashboard'), (req: Request, res: Response) => {
    const idx = securityDb.auditLogs.findIndex((e) => e.id === req.params.id);
    if (idx < 0) {
      return res.status(404).json({ success: false, error: 'Événement introuvable dans le journal d’activité.' });
    }
    const entry = securityDb.auditLogs[idx];
    // securityDb.auditLogs is newest-first: afterEvents are indices < idx, beforeEvents are indices > idx
    const afterEvents = securityDb.auditLogs.slice(Math.max(0, idx - 4), idx).reverse();
    const beforeEvents = securityDb.auditLogs.slice(idx + 1, idx + 5).reverse();

    const relatedByActor = securityDb.auditLogs
      .filter(
        (e) =>
          e.id !== entry.id &&
          (e.actorId === entry.actorId ||
            (entry.actorAccountLabel && e.actorAccountLabel === entry.actorAccountLabel))
      )
      .slice(0, 12);

    const entityKey = (entry.entityId || entry.target || '').toLowerCase();
    const relatedByEntity = entityKey
      ? securityDb.auditLogs
          .filter(
            (e) =>
              e.id !== entry.id &&
              ((e.entityId && e.entityId.toLowerCase() === entityKey) ||
                e.target.toLowerCase().includes(entityKey))
          )
          .slice(0, 12)
      : [];

    return res.json({
      success: true,
      entry,
      beforeEvents,
      afterEvents,
      relatedByActor,
      relatedByEntity
    });
  });

  app.post('/api/activity/export', requireSecurityPermission('viewDashboard'), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const ip = getClientIp(req);
    const { device, browser, os } = parseUserAgent(req.header('user-agent'));
    const { format = 'csv', filters = {} } = (req.body || {}) as { format?: 'csv' | 'pdf'; filters?: Record<string, unknown> };
    const safeFormat = format === 'pdf' ? 'pdf' : 'csv';
    const matched = filterActivityEntries(filters).slice(0, 1000);
    const nowStamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `djassa_journal_activite_${nowStamp}.${safeFormat}`;

    // Log the export operation itself inside the immutable journal!
    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'admin_mgmt',
      actionType: `activity_export_${safeFormat}`,
      action: `Export ${safeFormat.toUpperCase()} du journal d’activité`,
      target: filename,
      targetType: 'system',
      entityType: 'export',
      entityId: filename,
      result: 'reussi',
      severity: 'moyen',
      device,
      os,
      browser,
      beforeValue: `${matched.length} événement(s) filtré(s)`,
      afterValue: `Fichier ${safeFormat.toUpperCase()} généré`,
      details: `Export ${safeFormat.toUpperCase()} demandé par ${actor.name} (${actor.email}) — ${matched.length} lignes`,
      ipAddress: ip
    });

    if (safeFormat === 'csv') {
      const headers = [
        'ID',
        'Seq',
        'Horodatage',
        'Acteur',
        'Compte',
        'Role',
        'Espace',
        'Categorie',
        'Action',
        'Cible',
        'Entite_ID',
        'Resultat',
        'Gravite',
        'IP',
        'Appareil',
        'OS',
        'Navigateur',
        'ID_Session',
        'ID_Requete',
        'ID_Transaction',
        'Montant_FCFA',
        'Statut_Financier',
        'Avant',
        'Apres',
        'Details',
        'Hash_SHA256'
      ];
      const csvEscape = (v: unknown) => {
        const s = String(v ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""');
        return `"${s}"`;
      };
      const lines = [headers.join(';')];
      for (const e of matched) {
        lines.push(
          [
            e.id,
            e.seq,
            e.timestamp,
            e.actorName,
            e.actorAccountLabel || e.actorId,
            e.actorRole,
            e.space || inferActivitySpace(String(e.actorRole)),
            e.category || inferActivityCategory({ targetType: e.targetType, action: e.action }),
            e.action,
            e.target,
            e.entityId || '',
            normalizeActivityResult(e.result),
            e.severity || 'information',
            e.ipAddress,
            e.device || '',
            e.os || '',
            e.browser || '',
            e.sessionId || '',
            e.requestId || '',
            e.financialTrace?.transactionId || '',
            e.financialTrace?.amountFcfa ?? '',
            e.financialTrace?.status || '',
            e.beforeValue || '',
            e.afterValue || '',
            e.details,
            e.entryHash
          ]
            .map(csvEscape)
            .join(';')
        );
      }
      return res.json({
        success: true,
        format: 'csv',
        filename,
        exportedCount: matched.length,
        csvContent: '\uFEFF' + lines.join('\n')
      });
    }

    return res.json({
      success: true,
      format: 'pdf',
      filename,
      exportedCount: matched.length,
      generatedAt: new Date().toISOString(),
      generatedBy: `${actor.name} (${actor.email})`,
      integrity: verifyAuditChainIntegrity(),
      rows: matched
    });
  });

  app.post('/api/activity/backup', requireSecurityPermission('viewDashboard'), (req: Request, res: Response) => {
    try {
      const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
      const ip = getClientIp(req);
      const { device, browser, os } = parseUserAgent(req.header('user-agent'));
      if (!fs.existsSync(BACKUPS_DIR)) {
        fs.mkdirSync(BACKUPS_DIR, { recursive: true });
      }
      const nowIso = new Date().toISOString();
      const stamp = nowIso.replace(/[:.]/g, '-');
      const backupFileName = `activity_backup_${stamp}.json`;
      const backupPath = path.join(BACKUPS_DIR, backupFileName);
      const integrity = verifyAuditChainIntegrity();
      const payload = JSON.stringify(
        {
          createdAt: nowIso,
          createdBy: actor.email,
          integrity,
          totalEntries: securityDb.auditLogs.length,
          entries: securityDb.auditLogs
        },
        null,
        2
      );
      const checksum = crypto.createHash('sha256').update(payload).digest('hex');
      fs.writeFileSync(backupPath, payload, 'utf8');
      fs.writeFileSync(`${backupPath}.sha256`, `${checksum}  ${backupFileName}\n`, 'utf8');

      securityDb.lastActivityBackupAt = nowIso;
      const auditEntry = appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'system_config',
        actionType: 'activity_log_backup',
        action: 'Sauvegarde certifiée du journal d’activité',
        target: backupFileName,
        targetType: 'system',
        entityType: 'backup',
        entityId: backupFileName,
        result: 'reussi',
        severity: 'information',
        device,
        os,
        browser,
        beforeValue: `${securityDb.auditLogs.length} événements`,
        afterValue: `SHA-256: ${checksum.slice(0, 16)}...`,
        details: `Archive immuable créée (${securityDb.auditLogs.length} entrées) par ${actor.name}`,
        ipAddress: ip
      });

      return res.json({
        success: true,
        backupFileName,
        checksum,
        createdAt: nowIso,
        totalEntries: securityDb.auditLogs.length,
        auditEntry
      });
    } catch (err: unknown) {
      return res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  // Explicit tamper-protection blocker if anyone tries PUT/PATCH/DELETE on audit or activity logs
  const blockAuditTampering = (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const token = extractBearerToken(req);
    const { device, browser, os } = parseUserAgent(req.header('user-agent'));
    securityDb.intrusions.unshift({
      id: `int-${crypto.randomUUID()}`,
      threatType: 'authorization_bypass',
      threatLabel: "Tentative de falsification ou suppression du journal d'activité",
      targetAccountOrResource: req.originalUrl,
      sourceIp: ip,
      timestamp: new Date().toISOString(),
      severity: 'critique',
      status: 'bloque',
      details: `${token?.email || 'Anonyme'} a tenté un ${req.method} sur le journal immuable`,
      detectedBy: 'rbac_guard'
    });
    createAlertIfEnabled({
      title: 'Tentative d’altération du journal d’activité bloquée',
      description: `Requête ${req.method} bloquée sur ${req.originalUrl}.`,
      severity: 'critique',
      category: 'admin_security',
      targetUserOrResource: token?.email || ip,
      sourceIp: ip,
      recommendedAction: 'Révoquer les accès du compte émetteur.'
    });
    appendAuditEntry({
      actorId: token?.uid || ip,
      actorName: token?.name || `IP ${ip}`,
      actorAccountLabel: token?.email,
      actorRole: token?.secRole || token?.spaceRole || 'system',
      space: token?.spaceRole || 'system',
      category: 'security',
      actionType: 'audit_tampering_attempt',
      action: `Tentative d'altération (${req.method}) du journal bloquée`,
      target: req.originalUrl,
      targetType: 'system',
      result: 'bloque',
      severity: 'critique',
      device,
      os,
      browser,
      sessionId: token?.sid,
      beforeValue: 'Journal immuable',
      afterValue: `Requête ${req.method} rejetée (HTTP 403)`,
      details: `${token?.email || 'Anonyme'} a tenté un ${req.method} sur ${req.originalUrl}`,
      ipAddress: ip
    });
    res.status(403).json({
      success: false,
      error: 'AUDIT_LOG_IMMUTABLE',
      message: "Accès refusé : le journal d'activité est strictement inaltérable et ne peut être ni modifié ni supprimé."
    });
  };
  app.delete('/api/security/audit-logs', blockAuditTampering);
  app.delete('/api/security/audit-logs/:id', blockAuditTampering);
  app.patch('/api/security/audit-logs/:id', blockAuditTampering);
  app.put('/api/security/audit-logs/:id', blockAuditTampering);
  app.delete('/api/activity/logs', blockAuditTampering);
  app.delete('/api/activity/logs/:id', blockAuditTampering);
  app.patch('/api/activity/logs/:id', blockAuditTampering);
  app.put('/api/activity/logs/:id', blockAuditTampering);
  app.delete('/api/activity/log', blockAuditTampering);
  app.patch('/api/activity/log', blockAuditTampering);
  app.put('/api/activity/log', blockAuditTampering);

  app.get('/api/security/target-history', requireSecurityPermission('viewDashboard'), (req: Request, res: Response) => {
    const rawTarget = String(req.query.target || '').trim();
    const target = rawTarget.toLowerCase();
    if (!target) {
      return res.json({
        success: true,
        actorSummary: null,
        logins: [],
        intrusions: [],
        alerts: [],
        audit: [],
        incidents: [],
        finance: []
      });
    }

    const logins = securityDb.loginLogs
      .filter(
        (l) =>
          l.accountEmail.toLowerCase().includes(target) ||
          l.ipAddress === target ||
          l.accountName.toLowerCase().includes(target) ||
          (l.accountId || '').toLowerCase() === target
      )
      .slice(0, 50);

    const intrusions = securityDb.intrusions
      .filter((i) => i.targetAccountOrResource.toLowerCase().includes(target) || i.sourceIp === target)
      .slice(0, 50);

    const alerts = securityDb.alerts
      .filter((a) => a.targetUserOrResource.toLowerCase().includes(target) || a.sourceIp === target)
      .slice(0, 50);

    const incidents = securityDb.incidents
      .filter(
        (inc) =>
          inc.accountEmail.toLowerCase().includes(target) ||
          inc.accountName.toLowerCase().includes(target) ||
          inc.accountId.toLowerCase() === target
      )
      .slice(0, 50);

    const finance = securityDb.financeLedger
      .filter(
        (f) =>
          f.accountEmail.toLowerCase().includes(target) ||
          f.accountId.toLowerCase() === target ||
          f.accountName.toLowerCase().includes(target)
      )
      .slice(0, 50);

    const matchingAudit = securityDb.auditLogs.filter(
      (a) =>
        a.target.toLowerCase().includes(target) ||
        a.ipAddress === target ||
        (a.actorAccountLabel || '').toLowerCase().includes(target) ||
        a.actorId.toLowerCase() === target ||
        a.actorName.toLowerCase().includes(target)
    );

    const matchingActorAudit = securityDb.auditLogs.filter(
      (a) =>
        (a.actorAccountLabel || '').toLowerCase() === target ||
        a.actorId.toLowerCase() === target ||
        (a.actorAccountLabel || '').toLowerCase().includes(target) ||
        a.actorName.toLowerCase().includes(target)
    );
    const primaryAuditPool = matchingActorAudit.length > 0 ? matchingActorAudit : matchingAudit;
    const latestAudit = primaryAuditPool[0];
    const latestLogin = logins[0];
    const staffMatch = securityDb.staff.find(
      (s) => s.email.toLowerCase() === target || s.id.toLowerCase() === target
    );
    const resolvedAccountId =
      latestAudit?.actorId || staffMatch?.id || latestLogin?.accountId || finance[0]?.accountId || rawTarget;
    const resolvedAccountLabel =
      latestAudit?.actorAccountLabel || staffMatch?.email || latestLogin?.accountEmail || finance[0]?.accountEmail || rawTarget;
    const activeSuspension =
      getActiveSuspension(resolvedAccountId) || getActiveSuspension(resolvedAccountLabel) || getActiveSuspension(target);

    const hasFinanceEntries = securityDb.financeLedger.some(
      (f) =>
        f.accountId.toLowerCase() === resolvedAccountId.toLowerCase() ||
        f.accountEmail.toLowerCase() === resolvedAccountLabel.toLowerCase()
    );
    const balanceAccountId =
      finance[0]?.accountId || resolvedAccountId;

    const actorSummary =
      primaryAuditPool.length > 0 || logins.length > 0 || staffMatch || activeSuspension || finance.length > 0
        ? {
            identifier: resolvedAccountId,
            name: latestAudit?.actorName || staffMatch?.name || latestLogin?.accountName || finance[0]?.accountName || rawTarget,
            accountLabel: resolvedAccountLabel,
            role: latestAudit?.actorRole || staffMatch?.role || latestLogin?.accountType || finance[0]?.spaceRole || 'client',
            space: latestAudit?.space || (staffMatch ? 'admin' : finance[0]?.spaceRole || 'system'),
            totalEvents: primaryAuditPool.length,
            failedOrBlockedEvents: primaryAuditPool.filter((e) => {
              const r = e.result;
              return r === 'echoue' || r === 'refuse' || r === 'bloque' || r === 'echec';
            }).length,
            criticalEvents: primaryAuditPool.filter((e) => e.severity === 'critique' || e.severity === 'eleve').length,
            lastSeen: latestAudit?.timestamp || latestLogin?.timestamp || null,
            lastIp: latestAudit?.ipAddress || latestLogin?.ipAddress || null,
            lastDevice: latestAudit?.device || latestLogin?.device || null,
            lastOs: latestAudit?.os || latestLogin?.os || null,
            lastBrowser: latestAudit?.browser || latestLogin?.browser || null,
            isSuspended: Boolean(activeSuspension),
            suspensionReason: activeSuspension?.reason || null,
            serverBalanceFcfa: hasFinanceEntries ? computeServerLedgerBalance(balanceAccountId) : null
          }
        : null;

    res.json({
      success: true,
      actorSummary,
      logins,
      intrusions,
      alerts,
      incidents,
      finance,
      audit: matchingAudit.slice(0, 50)
    });
  });

  // --------------------------------------------------------------------------
  // 10. CENTRALIZED ADMIN NOTIFICATIONS & ALERTS CENTER
  // --------------------------------------------------------------------------

  function serializeNotificationForActor(n: AdminNotificationRecord, actorId: string) {
    return {
      ...n,
      isRead: Array.isArray(n.readByAdminIds) && n.readByAdminIds.includes(actorId)
    };
  }

  app.get('/api/admin/notifications/channels-status', requireSecurityPermission('manageAlerts'), (_req: Request, res: Response) => {
    res.json({
      success: true,
      channels: getNotificationChannelsStatusPayload()
    });
  });

  app.get('/api/admin/notifications/preferences', requireSecurityPermission('manageAlerts'), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    res.json({
      success: true,
      staffId: actor.id,
      role: actor.role,
      criticalSecurityLocked: actor.role !== 'super_admin',
      preferences: getEffectivePreferencesForStaff(actor.id)
    });
  });

  app.put('/api/admin/notifications/preferences', requireSecurityPermission('manageAlerts'), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const incoming = (req.body?.preferences || req.body || {}) as Partial<AdminNotificationPreferences>;

    // Server enforcement: ordinary admins cannot disable critical security notifications
    if (actor.role !== 'super_admin' && incoming.securite) {
      if (
        incoming.securite.interne === false ||
        incoming.securite.push === false ||
        incoming.securite.email === false
      ) {
        return res.status(403).json({
          success: false,
          error: 'CRITICAL_SECURITY_NOTIFS_LOCKED',
          message: 'Les notifications critiques de sécurité ne peuvent pas être désactivées par un administrateur ordinaire.'
        });
      }
    }

    const current = getEffectivePreferencesForStaff(actor.id);
    const updated = { ...current } as AdminNotificationPreferences;
    for (const cat of ALL_NOTIFICATION_CATEGORIES) {
      if (incoming[cat] && typeof incoming[cat] === 'object') {
        updated[cat] = {
          interne: typeof incoming[cat]!.interne === 'boolean' ? incoming[cat]!.interne : current[cat].interne,
          push: typeof incoming[cat]!.push === 'boolean' ? incoming[cat]!.push : current[cat].push,
          email: typeof incoming[cat]!.email === 'boolean' ? incoming[cat]!.email : current[cat].email
        };
      }
    }
    if (actor.role !== 'super_admin') {
      updated.securite = { interne: true, push: true, email: true };
    }

    securityDb.notificationPreferences[actor.id] = updated;
    const actorCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
    const ua = parseUserAgent(req.header('user-agent'));
    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'system_config',
      actionType: 'notification_preferences_updated',
      action: 'Mise à jour préférences notifications admin',
      target: actor.email,
      targetType: 'settings',
      entityType: 'notification_preferences',
      entityId: actor.id,
      result: 'reussi',
      severity: 'information',
      device: actorCtx?.session.device || ua.device,
      os: actorCtx?.session.os || ua.os,
      browser: actorCtx?.session.browser || ua.browser,
      sessionId: actorCtx?.session.sessionId,
      beforeValue: JSON.stringify(current.securite),
      afterValue: JSON.stringify(updated.securite),
      details: `Préférences notifications enregistrées pour ${actor.name}`,
      ipAddress: getClientIp(req)
    });
    persistSecurityDb();
    notificationStreamHub?.broadcast({ type: 'notification:prefs_updated', actorId: actor.id });

    return res.json({
      success: true,
      staffId: actor.id,
      role: actor.role,
      criticalSecurityLocked: actor.role !== 'super_admin',
      preferences: updated
    });
  });

  app.post('/api/admin/notifications/push-subscribe', requireSecurityPermission('manageAlerts'), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const endpoint = redactSensitiveText(String(req.body?.endpoint || `browser-local://${actor.id}`));
    const nowIso = new Date().toISOString();
    const ua = String(req.header('user-agent') || 'Navigateur Admin').slice(0, 180);
    const existing = securityDb.pushSubscriptions.find(
      (s) => s.staffId === actor.id && s.endpoint === endpoint
    );
    if (existing) {
      existing.updatedAt = nowIso;
      existing.userAgent = ua;
    } else {
      securityDb.pushSubscriptions.unshift({
        id: `psub-${crypto.randomUUID().slice(0, 10)}`,
        staffId: actor.id,
        endpoint,
        userAgent: ua,
        createdAt: nowIso,
        updatedAt: nowIso
      });
    }
    persistSecurityDb();
    res.json({
      success: true,
      subscriptionsCount: securityDb.pushSubscriptions.length,
      channels: getNotificationChannelsStatusPayload()
    });
  });

  app.get('/api/admin/notifications', requireSecurityPermission('manageAlerts'), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const q = String(req.query.q || '').trim().toLowerCase();
    const category = String(req.query.category || 'all');
    const priority = String(req.query.priority || 'all');
    const space = String(req.query.space || 'all');
    const status = String(req.query.status || 'all');
    const unreadOnly = String(req.query.unreadOnly || 'false') === 'true';
    const archivedMode = String(req.query.archived || 'false'); // 'false' | 'true' | 'all'
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(5, Number(req.query.limit) || 25));

    const allWithRead = securityDb.adminNotifications.map((n) => serializeNotificationForActor(n, actor.id));

    const filtered = allWithRead.filter((n) => {
      if (archivedMode === 'false' && n.archived) return false;
      if (archivedMode === 'true' && !n.archived) return false;
      if (category !== 'all' && n.category !== category) return false;
      if (priority !== 'all' && n.priority !== priority) return false;
      if (space !== 'all' && n.space !== space) return false;
      if (status === 'pending') {
        if (n.status !== 'nouvelle' && n.status !== 'en_cours' && n.status !== 'escaladee') return false;
      } else if (status !== 'all' && n.status !== status) {
        return false;
      }
      if (unreadOnly && n.isRead) return false;
      if (q) {
        const hay = [
          n.id,
          n.title,
          n.description,
          n.targetUser,
          n.targetUserId || '',
          n.sourceEventId,
          n.entityId || '',
          n.assignedToName || '',
          n.sourceIp || ''
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;
    const notifications = filtered.slice(start, start + limit);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayMs = startOfToday.getTime();

    const activePool = allWithRead.filter((n) => !n.archived);
    const totalToday = allWithRead.filter((n) => new Date(n.createdAt).getTime() >= startOfTodayMs).length;
    const unreadCount = activePool.filter((n) => !n.isRead).length;
    const criticalCount = activePool.filter((n) => n.priority === 'critique' && n.status !== 'resolue').length;
    const pendingCount = activePool.filter((n) => n.status === 'nouvelle' || n.status === 'en_cours' || n.status === 'escaladee').length;

    const staffAssignees = securityDb.staff
      .filter((s) => s.active && hasSecurityPermission(s, 'manageAlerts'))
      .map((s) => ({ id: s.id, name: s.name, role: s.role, active: s.active }));

    res.json({
      success: true,
      notifications,
      total,
      page: safePage,
      pageSize: limit,
      totalPages,
      kpis: {
        totalToday,
        unreadCount,
        criticalCount,
        pendingCount
      },
      staffAssignees
    });
  });

  app.post('/api/admin/notifications/read-all', requireSecurityPermission('manageAlerts'), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    let markedCount = 0;
    for (const n of securityDb.adminNotifications) {
      if (!n.archived && !n.readByAdminIds.includes(actor.id)) {
        n.readByAdminIds.push(actor.id);
        markedCount++;
      }
    }
    const actorCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
    const ua = parseUserAgent(req.header('user-agent'));
    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'admin_mgmt',
      actionType: 'notification_read_all',
      action: 'Marquage de toutes les notifications comme lues',
      target: `${markedCount} notification(s)`,
      targetType: 'alert',
      result: 'reussi',
      severity: 'information',
      device: actorCtx?.session.device || ua.device,
      os: actorCtx?.session.os || ua.os,
      browser: actorCtx?.session.browser || ua.browser,
      sessionId: actorCtx?.session.sessionId,
      beforeValue: `${markedCount} non lue(s)`,
      afterValue: 'Toutes lues',
      details: `${markedCount} notifications marquées comme lues par ${actor.name} (aucun événement d’origine supprimé)`,
      ipAddress: getClientIp(req)
    });
    persistSecurityDb();
    notificationStreamHub?.broadcast({ type: 'notification:read_all', actorId: actor.id });
    res.json({ success: true, markedCount });
  });

  app.get('/api/admin/notifications/:id', requireSecurityPermission('manageAlerts'), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const notif = securityDb.adminNotifications.find((n) => n.id === req.params.id);
    if (!notif) {
      return res.status(404).json({ success: false, error: 'Notification introuvable.' });
    }
    const sourceAuditEntry = securityDb.auditLogs.find((e) => e.id === notif.sourceEventId) || null;
    const linkedAlert = notif.linkedAlertId ? securityDb.alerts.find((a) => a.id === notif.linkedAlertId) || null : null;
    res.json({
      success: true,
      notification: serializeNotificationForActor(notif, actor.id),
      sourceAuditEntry,
      linkedAlert
    });
  });

  app.patch('/api/admin/notifications/:id/read', requireSecurityPermission('manageAlerts'), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const notif = securityDb.adminNotifications.find((n) => n.id === req.params.id);
    if (!notif) {
      return res.status(404).json({ success: false, error: 'Notification introuvable.' });
    }
    const read = req.body?.read !== false;
    if (read) {
      if (!notif.readByAdminIds.includes(actor.id)) {
        notif.readByAdminIds.push(actor.id);
      }
    } else {
      notif.readByAdminIds = notif.readByAdminIds.filter((id) => id !== actor.id);
    }
    persistSecurityDb();
    const serialized = serializeNotificationForActor(notif, actor.id);
    notificationStreamHub?.broadcast({ type: 'notification:updated', notification: serialized, actorId: actor.id });
    res.json({ success: true, notification: serialized });
  });

  app.patch('/api/admin/notifications/:id/archive', requireSecurityPermission('manageAlerts'), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const notif = securityDb.adminNotifications.find((n) => n.id === req.params.id);
    if (!notif) {
      return res.status(404).json({ success: false, error: 'Notification introuvable.' });
    }
    const archived = req.body?.archived !== false;
    const nowIso = new Date().toISOString();
    notif.archived = archived;
    notif.archivedAt = archived ? nowIso : null;
    notif.archivedBy = archived ? actor.name : null;
    notif.history.unshift({
      id: `nh-${crypto.randomUUID().slice(0, 8)}`,
      at: nowIso,
      actorId: actor.id,
      actorName: actor.name,
      action: archived ? 'Notification archivée (événement d’origine conservé)' : 'Notification désarchivée'
    });
    const actorCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
    const ua = parseUserAgent(req.header('user-agent'));
    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'admin_mgmt',
      actionType: archived ? 'notification_archived' : 'notification_unarchived',
      action: archived ? 'Archivage notification admin' : 'Désarchivage notification admin',
      target: notif.id,
      targetType: 'alert',
      entityType: 'notification',
      entityId: notif.id,
      result: 'reussi',
      severity: 'information',
      device: actorCtx?.session.device || ua.device,
      os: actorCtx?.session.os || ua.os,
      browser: actorCtx?.session.browser || ua.browser,
      sessionId: actorCtx?.session.sessionId,
      beforeValue: archived ? 'Active' : 'Archivée',
      afterValue: archived ? 'Archivée' : 'Active',
      details: `Événement source ${notif.sourceEventId} conservé intact`,
      ipAddress: getClientIp(req)
    });
    persistSecurityDb();
    const serialized = serializeNotificationForActor(notif, actor.id);
    notificationStreamHub?.broadcast({ type: 'notification:updated', notification: serialized, actorId: actor.id });
    res.json({ success: true, notification: serialized });
  });

  app.patch('/api/admin/notifications/:id/assign', requireSecurityPermission('manageAlerts'), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const notif = securityDb.adminNotifications.find((n) => n.id === req.params.id);
    if (!notif) {
      return res.status(404).json({ success: false, error: 'Notification introuvable.' });
    }
    const assigneeId = String(req.body?.assigneeId || '').trim();
    const assignee = assigneeId
      ? securityDb.staff.find((s) => s.id === assigneeId && s.active && hasSecurityPermission(s, 'manageAlerts'))
      : null;
    if (assigneeId && !assignee) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ASSIGNEE',
        message: 'L’administrateur cible doit être actif et autorisé à traiter les alertes.'
      });
    }
    const prevAssignee = notif.assignedToName || 'Non affectée';
    const nowIso = new Date().toISOString();
    notif.assignedToId = assignee ? assignee.id : null;
    notif.assignedToName = assignee ? assignee.name : null;
    if (assignee && notif.status === 'nouvelle') {
      notif.status = 'en_cours';
    }
    notif.history.unshift({
      id: `nh-${crypto.randomUUID().slice(0, 8)}`,
      at: nowIso,
      actorId: actor.id,
      actorName: actor.name,
      action: assignee ? `Affectée à ${assignee.name}` : 'Affectation retirée',
      statusAfter: notif.status
    });
    const actorCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
    const ua = parseUserAgent(req.header('user-agent'));
    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'admin_mgmt',
      actionType: 'notification_assigned',
      action: 'Affectation notification à un administrateur',
      target: notif.id,
      targetType: 'alert',
      entityType: 'notification',
      entityId: notif.id,
      result: 'reussi',
      severity: 'information',
      device: actorCtx?.session.device || ua.device,
      os: actorCtx?.session.os || ua.os,
      browser: actorCtx?.session.browser || ua.browser,
      sessionId: actorCtx?.session.sessionId,
      beforeValue: prevAssignee,
      afterValue: notif.assignedToName || 'Non affectée',
      details: `${notif.title} affectée à ${notif.assignedToName || 'aucun'}`,
      ipAddress: getClientIp(req)
    });
    persistSecurityDb();
    const serialized = serializeNotificationForActor(notif, actor.id);
    notificationStreamHub?.broadcast({ type: 'notification:updated', notification: serialized, actorId: actor.id });
    res.json({ success: true, notification: serialized });
  });

  app.patch('/api/admin/notifications/:id/status', requireSecurityPermission('manageAlerts'), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const notif = securityDb.adminNotifications.find((n) => n.id === req.params.id);
    if (!notif) {
      return res.status(404).json({ success: false, error: 'Notification introuvable.' });
    }
    const { status, comment } = (req.body || {}) as { status?: AdminNotificationStatus; comment?: string };
    const cleanComment = comment ? redactSensitiveText(String(comment).trim()) : '';
    const prevStatus = notif.status;
    const nowIso = new Date().toISOString();

    if (status && ['nouvelle', 'en_cours', 'resolue', 'escaladee'].includes(status)) {
      notif.status = status;
    }
    if (!notif.readByAdminIds.includes(actor.id)) {
      notif.readByAdminIds.push(actor.id);
    }

    const actionLabel =
      status === 'resolue'
        ? 'Alerte marquée résolue'
        : status === 'en_cours'
        ? 'Passage en cours de traitement'
        : cleanComment
        ? 'Commentaire interne ajouté'
        : `Statut mis à jour (${notif.status})`;

    notif.history.unshift({
      id: `nh-${crypto.randomUUID().slice(0, 8)}`,
      at: nowIso,
      actorId: actor.id,
      actorName: actor.name,
      action: actionLabel,
      statusAfter: notif.status,
      ...(cleanComment ? { comment: cleanComment } : {})
    });

    // Keep linked SecurityAlert synchronized
    if (notif.linkedAlertId) {
      const linked = securityDb.alerts.find((a) => a.id === notif.linkedAlertId);
      if (linked) {
        if (notif.status === 'en_cours' || notif.status === 'escaladee') {
          linked.status = 'en_examen';
          linked.examinedBy = actor.name;
          linked.examinedAt = nowIso;
        } else if (notif.status === 'resolue') {
          linked.status = 'resolue';
          linked.resolvedBy = actor.name;
          linked.resolvedAt = nowIso;
          linked.resolutionNote = cleanComment || 'Résolue via Centre de Notifications';
        }
      }
    }

    const actorCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
    const ua = parseUserAgent(req.header('user-agent'));
    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'admin_mgmt',
      actionType: 'notification_status_updated',
      action: actionLabel,
      target: notif.id,
      targetType: 'alert',
      entityType: 'notification',
      entityId: notif.id,
      result: 'reussi',
      severity: 'information',
      device: actorCtx?.session.device || ua.device,
      os: actorCtx?.session.os || ua.os,
      browser: actorCtx?.session.browser || ua.browser,
      sessionId: actorCtx?.session.sessionId,
      beforeValue: prevStatus,
      afterValue: notif.status,
      details: cleanComment || `${notif.title} (${prevStatus} -> ${notif.status})`,
      ipAddress: getClientIp(req)
    });

    persistSecurityDb();
    const serialized = serializeNotificationForActor(notif, actor.id);
    notificationStreamHub?.broadcast({ type: 'notification:updated', notification: serialized, actorId: actor.id });
    res.json({ success: true, notification: serialized });
  });

  app.post('/api/admin/notifications/:id/escalate', requireSecurityPermission('manageAlerts'), (req: Request, res: Response) => {
    const actor = (req as Request & { securityActor: SecurityStaffMember }).securityActor;
    const notif = securityDb.adminNotifications.find((n) => n.id === req.params.id);
    if (!notif) {
      return res.status(404).json({ success: false, error: 'Notification introuvable.' });
    }
    const reason = redactSensitiveText(String(req.body?.reason || 'Escalade manuelle vers Super Administrateur').trim());
    const nowIso = new Date().toISOString();
    const prevPriority = notif.priority;
    const superAdmin = securityDb.staff.find((s) => s.role === 'super_admin' && s.active);

    notif.status = 'escaladee';
    notif.priority = 'critique';
    notif.escalatedToSuperAdmin = true;
    notif.escalatedAt = nowIso;
    if (superAdmin) {
      notif.assignedToId = superAdmin.id;
      notif.assignedToName = superAdmin.name;
    }
    notif.history.unshift({
      id: `nh-${crypto.randomUUID().slice(0, 8)}`,
      at: nowIso,
      actorId: actor.id,
      actorName: actor.name,
      action: 'Escaladée vers le Super Administrateur',
      statusAfter: 'escaladee',
      comment: reason
    });

    dispatchNotificationChannels(notif);

    const actorCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
    const ua = parseUserAgent(req.header('user-agent'));
    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'admin_mgmt',
      actionType: 'notification_escalated',
      action: 'Escalade d’alerte vers le Super Administrateur',
      target: notif.id,
      targetType: 'alert',
      entityType: 'notification',
      entityId: notif.id,
      result: 'reussi',
      severity: 'eleve',
      device: actorCtx?.session.device || ua.device,
      os: actorCtx?.session.os || ua.os,
      browser: actorCtx?.session.browser || ua.browser,
      sessionId: actorCtx?.session.sessionId,
      beforeValue: prevPriority,
      afterValue: 'critique (escaladee)',
      details: `${notif.title} — Motif : ${reason}`,
      ipAddress: getClientIp(req)
    });

    persistSecurityDb();
    const serialized = serializeNotificationForActor(notif, actor.id);
    notificationStreamHub?.broadcast({ type: 'notification:updated', notification: serialized, actorId: actor.id });
    res.json({ success: true, notification: serialized });
  });
}

export {
  redactSensitiveText,
  sanitizePayload,
  getNotificationChannelsStatusPayload
};

export function verifyStepUpMfaForRequest(
  req: Request,
  authCtx: AuthenticatedRequestContext,
  forceRequire = false
): { ok: boolean; status: number; error: string; message: string } {
  const mustCheck =
    forceRequire ||
    (securityDb.settings.requireTwoFactorAdmins && securityDb.settings.requireTwoFactorSensitiveActions);
  if (!mustCheck) return { ok: true, status: 200, error: '', message: '' };
  const actor = authCtx.staff;
  if (!actor) {
    return {
      ok: false,
      status: 403,
      error: 'ADMIN_ROLE_REQUIRED',
      message: 'Compte administrateur requis pour la vérification MFA.'
    };
  }
  const mfaCode = (req.header('x-security-stepup-code') || '').trim();
  const challenge = pendingMfaChallenges.get(authCtx.session.sessionId);
  const validChallenge =
    Boolean(challenge) &&
    challenge!.actorId === actor.id &&
    challenge!.expiresAt > Date.now() &&
    challenge!.code === mfaCode;
  if (!validChallenge) {
    return {
      ok: false,
      status: 428,
      error: 'MFA_STEPUP_REQUIRED',
      message: 'Vérification multifacteur (MFA) requise pour cette opération critique.'
    };
  }
  pendingMfaChallenges.delete(authCtx.session.sessionId);
  return { ok: true, status: 200, error: '', message: '' };
}

export function getSecurityStaffDirectory() {
  return securityDb.staff.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    role: s.role,
    title: s.title,
    active: s.active,
    mfaEnabled: s.mfaEnabled
  }));
}

export function getSecurityRuntimeSummary() {
  const activeSessions = securityDb.sessions.filter((s) => s.status === 'active').length;
  const activeBlockedIps = securityDb.blockedIps.filter((b) => b.active).length;
  return {
    hmacConfigured: Boolean(HMAC_SECRET && HMAC_SECRET.length >= 32),
    activeSessions,
    activeBlockedIps,
    requireTwoFactorAdmins: securityDb.settings.requireTwoFactorAdmins,
    requireTwoFactorSensitiveActions: securityDb.settings.requireTwoFactorSensitiveActions
  };
}

export function getSecurityTelemetrySnapshot() {
  const now24h = Date.now() - 86400_000;
  const recentFailedLogins = securityDb.loginLogs.filter(
    (l) => l.status !== 'reussite' && new Date(l.timestamp).getTime() >= now24h
  ).length;
  const openIntrusions = securityDb.intrusions.filter((i) => i.status !== 'resolu').length;
  const activeCyberAttacks = securityDb.cyberAttacks.filter((c) => !c.blocked).length;
  const unreadNotifications = securityDb.adminNotifications.filter((n) => n.status === 'nouvelle').length;

  return {
    sessions: securityDb.sessions.slice(0, 100).map((s) => ({
      sessionId: s.sessionId,
      userId: s.userId,
      accountName: s.userName,
      accountEmail: s.userEmail,
      accountRole: s.accountType,
      space: s.spaceRole || s.accountType,
      device: s.device,
      os: s.os,
      browser: s.browser,
      ipAddress: s.ipAddress,
      location: s.location,
      createdAt: s.startedAt,
      lastSeenAt: s.lastActivityAt,
      expiresAt: s.expiresAt,
      status: s.status
    })),
    loginLogs: securityDb.loginLogs.slice(0, 120),
    financeLedger: securityDb.financeLedger.slice(0, 150),
    suspendedAccounts: securityDb.suspendedAccounts,
    blockedIps: securityDb.blockedIps.filter((b) => b.active),
    recentFailedLogins,
    openIntrusions,
    activeCyberAttacks,
    unreadNotifications,
    settings: securityDb.settings,
    auditLogs: securityDb.auditLogs.slice(0, 200).map((a) => ({
      ...a,
      details: redactSensitiveText(a.details || ''),
      beforeValue: a.beforeValue ? redactSensitiveText(a.beforeValue) : undefined,
      afterValue: a.afterValue ? redactSensitiveText(a.afterValue) : undefined
    }))
  };
}

export function getAdminNotificationsSnapshot(limit = 40) {
  return securityDb.adminNotifications.slice(0, limit).map((n) => ({
    id: n.id,
    createdAt: n.createdAt,
    category: n.category,
    priority: n.priority,
    status: n.status,
    title: redactSensitiveText(n.title),
    description: redactSensitiveText(n.description),
    target: n.targetUser,
    dedupKey: n.dedupKey,
    occurrenceCount: n.duplicateCount
  }));
}

export function getFinanceFraudTelemetrySnapshot() {
  return {
    financeLedger: [...securityDb.financeLedger],
    knownPayoutTargets: { ...securityDb.knownPayoutTargets },
    intrusions: [...securityDb.intrusions],
    sessions: [...securityDb.sessions],
    loginLogs: [...securityDb.loginLogs],
    suspendedAccounts: [...securityDb.suspendedAccounts],
    auditLogs: [...securityDb.auditLogs.slice(0, 400)],
    settings: { ...securityDb.settings }
  };
}

export function applyVerifiedLedgerAction(params: {
  mode:
    | 'release_hold_approve'
    | 'reject_hold'
    | 'manual_credit'
    | 'manual_debit'
    | 'exceptional_refund'
    | 'cancel_transaction'
    | 'update_payout_target'
    | 'unlock_wallet_ops';
  targetId: string;
  accountId: string;
  amountFcfa: number;
  actorName: string;
  reason: string;
  reference: string;
  payoutTargetMasked?: string;
}): { ok: boolean; message: string; previousBalanceFcfa: number; newBalanceFcfa: number } {
  const prevBal = computeServerLedgerBalance(params.accountId);
  const nowIso = new Date().toISOString();

  if (params.mode === 'release_hold_approve' || params.mode === 'reject_hold') {
    const entry = securityDb.financeLedger.find((e) => e.id === params.targetId || e.reference === params.targetId);
    if (!entry) {
      return { ok: false, message: 'Opération financière introuvable dans le registre serveur.', previousBalanceFcfa: prevBal, newBalanceFcfa: prevBal };
    }
    if (entry.status === 'valide' && params.mode === 'release_hold_approve') {
      return { ok: true, message: 'Opération déjà validée (idempotence préservée).', previousBalanceFcfa: prevBal, newBalanceFcfa: prevBal };
    }
    if (entry.status === 'rejete' && params.mode === 'reject_hold') {
      return { ok: true, message: 'Opération déjà rejetée (idempotence préservée).', previousBalanceFcfa: prevBal, newBalanceFcfa: prevBal };
    }
    entry.status = params.mode === 'release_hold_approve' ? 'valide' : 'rejete';
    if (params.mode === 'release_hold_approve') {
      entry.type = 'debit';
      if (entry.payoutTarget) {
        const list = securityDb.knownPayoutTargets[entry.accountId] || [];
        if (!list.includes(entry.payoutTarget)) {
          securityDb.knownPayoutTargets[entry.accountId] = [...list, entry.payoutTarget];
        }
      }
    }
    entry.reviewedBy = params.actorName;
    entry.reviewedAt = nowIso;
    entry.reviewNote = redactSensitiveText(params.reason);
    persistSecurityDb();
    return {
      ok: true,
      message: params.mode === 'release_hold_approve' ? 'Opération libérée et enregistrée au registre immuable.' : 'Opération rejetée et fonds protégés.',
      previousBalanceFcfa: prevBal,
      newBalanceFcfa: computeServerLedgerBalance(params.accountId)
    };
  }

  if (params.mode === 'cancel_transaction') {
    const existing = securityDb.financeLedger.find((e) => e.id === params.targetId || e.reference === params.targetId);
    if (existing) {
      if (existing.status === 'rejete') {
        return { ok: true, message: 'Transaction déjà annulée (idempotence).', previousBalanceFcfa: prevBal, newBalanceFcfa: prevBal };
      }
      existing.status = 'rejete';
      existing.reviewedBy = params.actorName;
      existing.reviewedAt = nowIso;
      existing.reviewNote = redactSensitiveText(`Annulation double contrôle : ${params.reason}`);
      persistSecurityDb();
    }
    return {
      ok: true,
      message: 'Transaction annulée avec écriture d’audit.',
      previousBalanceFcfa: prevBal,
      newBalanceFcfa: computeServerLedgerBalance(params.accountId)
    };
  }

  if (params.mode === 'update_payout_target') {
    const clean = redactSensitiveText(params.payoutTargetMasked || '');
    if (clean) {
      const list = securityDb.knownPayoutTargets[params.accountId] || [];
      if (!list.includes(clean)) {
        securityDb.knownPayoutTargets[params.accountId] = [...list, clean];
      }
      persistSecurityDb();
    }
    return {
      ok: true,
      message: 'Coordonnée financière vérifiée enregistrée après double validation.',
      previousBalanceFcfa: prevBal,
      newBalanceFcfa: prevBal
    };
  }

  if (params.mode === 'unlock_wallet_ops') {
    securityDb.suspendedAccounts.forEach((s) => {
      if (s.accountId.toLowerCase() === params.accountId.toLowerCase() || s.accountEmail.toLowerCase() === params.accountId.toLowerCase()) {
        s.active = false;
        s.blockedOperations = [];
      }
    });
    persistSecurityDb();
    return {
      ok: true,
      message: 'Restrictions financières levées après double validation.',
      previousBalanceFcfa: prevBal,
      newBalanceFcfa: computeServerLedgerBalance(params.accountId)
    };
  }

  // manual_credit, manual_debit, exceptional_refund — ALWAYS writes an immutable ledger entry (idempotent by reference)
  const alreadyWritten = securityDb.financeLedger.find((e) => e.reference === params.reference);
  if (alreadyWritten) {
    return { ok: true, message: 'Écriture comptable déjà appliquée (idempotence).', previousBalanceFcfa: prevBal, newBalanceFcfa: computeServerLedgerBalance(params.accountId) };
  }

  const ledgerType = params.mode === 'manual_debit' ? 'debit' : 'credit';
  if (ledgerType === 'debit' && params.amountFcfa > prevBal) {
    return {
      ok: false,
      message: `Ajustement débit refusé : montant (${params.amountFcfa} FCFA) supérieur au solde serveur (${prevBal} FCFA).`,
      previousBalanceFcfa: prevBal,
      newBalanceFcfa: prevBal
    };
  }

  securityDb.financeLedger.unshift({
    id: `led-dual-${crypto.randomUUID()}`,
    accountId: params.accountId,
    accountEmail: params.accountId,
    accountName: params.accountId,
    spaceRole: 'seller',
    type: ledgerType,
    amountFcfa: Math.max(0, Math.round(params.amountFcfa)),
    channel: params.mode === 'exceptional_refund' ? 'Remboursement exceptionnel (Double Validation)' : 'Ajustement comptable (Double Validation)',
    reference: params.reference,
    status: 'valide',
    reviewedBy: params.actorName,
    reviewedAt: nowIso,
    reviewNote: redactSensitiveText(params.reason),
    createdAt: nowIso
  });
  persistSecurityDb();
  const nextBal = computeServerLedgerBalance(params.accountId);
  return {
    ok: true,
    message: 'Écriture comptable immuable ajoutée après double validation.',
    previousBalanceFcfa: prevBal,
    newBalanceFcfa: nextBal
  };
}

export function applyVerifiedDisputeSanction(params: {
  accountId: string;
  accountName: string;
  accountEmail?: string;
  accountType: PlatformSpaceRole;
  sanctionType: 'avertissement' | 'blocage_retraits' | 'restriction_commandes' | 'suspension_temporaire' | 'suspension_permanente';
  reason: string;
  actorName: string;
  durationDays?: number;
}): { ok: boolean; message: string; activeBlockApplied: boolean } {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const emailNorm = String(params.accountEmail || params.accountId).trim().toLowerCase();

  if (params.sanctionType === 'avertissement') {
    securityDb.incidents.unshift({
      id: `inc-disp-${crypto.randomUUID().slice(0, 8)}`,
      accountId: params.accountId,
      accountName: params.accountName,
      accountEmail: emailNorm,
      accountType: mapRoleToAccountType(params.accountType),
      type: 'dispute_warning',
      status: 'resolu',
      severity: 'moyen',
      summary: `Avertissement officiel litige : ${redactSensitiveText(params.reason)}`,
      blockedOperations: [],
      createdBy: params.actorName,
      createdAt: nowIso,
      timeline: [{ at: nowIso, actor: params.actorName, action: 'Avertissement consigné', details: params.reason }]
    });
    persistSecurityDb();
    return { ok: true, message: 'Avertissement officiel enregistré au dossier sécurité du compte.', activeBlockApplied: false };
  }

  const blockedOps: SensitiveOperationType[] =
    params.sanctionType === 'blocage_retraits'
      ? ['withdrawals']
      : params.sanctionType === 'restriction_commandes'
      ? ['orders', 'withdrawals']
      : ['login', 'orders', 'withdrawals'];

  const expiresAt =
    params.sanctionType === 'suspension_permanente'
      ? null
      : new Date(now + Math.max(1, params.durationDays || 7) * 86_400_000).toISOString();

  securityDb.suspendedAccounts.unshift({
    accountId: params.accountId,
    accountName: params.accountName,
    accountEmail: emailNorm,
    accountType: mapRoleToAccountType(params.accountType),
    reason: redactSensitiveText(`Sanction litige DJASSA : ${params.reason}`),
    suspendedBy: params.actorName,
    suspendedAt: nowIso,
    expiresAt,
    active: true,
    compromisedFlag: false,
    forcePasswordReset: false,
    blockedOperations: blockedOps
  });

  if (params.sanctionType === 'suspension_temporaire' || params.sanctionType === 'suspension_permanente') {
    securityDb.sessions.forEach((s) => {
      if ((s.status === 'active' || s.status === 'suspect') && (s.userEmail === emailNorm || s.userId === params.accountId)) {
        s.status = 'revoked';
        s.revokedBy = params.actorName;
        s.revokedAt = nowIso;
      }
    });
  }

  persistSecurityDb();
  return {
    ok: true,
    message: `Sanction appliquée (${blockedOps.join(', ')}).`,
    activeBlockApplied: true
  };
}

export function recordVerifiedFinancialOperationInSecurityLedger(params: {
  reference: string;
  accountId: string;
  accountName: string;
  accountEmail?: string;
  spaceRole: 'client' | 'seller';
  type: 'credit' | 'debit';
  amountFcfa: number;
  commissionFcfa?: number;
  channel: string;
  payoutTargetMasked?: string;
  actorName: string;
  note: string;
}): { ok: boolean; duplicate: boolean; entryId: string; previousBalanceFcfa: number; newBalanceFcfa: number } {
  const prevBal = computeServerLedgerBalance(params.accountId);
  const existing = securityDb.financeLedger.find((e) => e.reference === params.reference);
  if (existing) {
    return {
      ok: true,
      duplicate: true,
      entryId: existing.id,
      previousBalanceFcfa: prevBal,
      newBalanceFcfa: prevBal
    };
  }
  const nowIso = new Date().toISOString();
  const entry: FinanceLedgerEntry = {
    id: `led-rbt-${crypto.randomUUID().slice(0, 10)}`,
    accountId: params.accountId,
    accountEmail: redactSensitiveText(params.accountEmail || params.accountId),
    accountName: params.accountName,
    spaceRole: params.spaceRole,
    type: params.type,
    amountFcfa: Math.max(0, Math.round(params.amountFcfa)),
    commissionFcfa: typeof params.commissionFcfa === 'number' ? Math.round(params.commissionFcfa) : undefined,
    channel: params.channel,
    payoutTarget: params.payoutTargetMasked ? redactSensitiveText(params.payoutTargetMasked) : undefined,
    reference: params.reference,
    status: 'valide',
    reviewedBy: params.actorName,
    reviewedAt: nowIso,
    reviewNote: redactSensitiveText(params.note),
    createdAt: nowIso
  };
  securityDb.financeLedger.unshift(entry);
  persistSecurityDb();
  const nextBal = computeServerLedgerBalance(params.accountId);
  return {
    ok: true,
    duplicate: false,
    entryId: entry.id,
    previousBalanceFcfa: prevBal,
    newBalanceFcfa: nextBal
  };
}

export function syncStaffMemberInSecurityDb(staffInput: {
  id: string;
  name: string;
  email: string;
  role: SecurityRole;
  title: string;
  active: boolean;
  mfaEnabled: boolean;
  permissions?: Partial<Record<SecurityPermissionKey, boolean>>;
  createdAt?: string;
}): SecurityStaffMember {
  const emailNorm = staffInput.email.trim().toLowerCase();
  const existingIdx = securityDb.staff.findIndex(
    (s) => s.id === staffInput.id || s.email.toLowerCase() === emailNorm
  );
  const existing = existingIdx >= 0 ? securityDb.staff[existingIdx] : undefined;
  const basePerms: Record<SecurityPermissionKey, boolean> = existing?.permissions || {
    viewDashboard: staffInput.role === 'super_admin' || staffInput.role === 'admin' || staffInput.role === 'security_agent',
    viewLoginLogs: staffInput.role === 'super_admin' || staffInput.role === 'admin' || staffInput.role === 'security_agent',
    viewIntrusions: staffInput.role === 'super_admin' || staffInput.role === 'security_agent',
    viewCyberattacks: staffInput.role === 'super_admin' || staffInput.role === 'security_agent',
    manageAlerts: staffInput.role === 'super_admin' || staffInput.role === 'admin' || staffInput.role === 'security_agent',
    executeProtectionActions: staffInput.role === 'super_admin' || staffInput.role === 'security_agent',
    manageSessions: staffInput.role === 'super_admin' || staffInput.role === 'security_agent',
    modifySettings: staffInput.role === 'super_admin',
    managePermissions: staffInput.role === 'super_admin',
    manageFinanceProtection: staffInput.role === 'super_admin' || staffInput.role === 'admin',
    manageIncidents: staffInput.role === 'super_admin' || staffInput.role === 'security_agent'
  };

  const merged: SecurityStaffMember = normalizeStaffPermissions({
    id: existing?.id || staffInput.id,
    name: staffInput.name,
    email: emailNorm,
    role: existing?.id === 'sec-super-admin' ? 'super_admin' : staffInput.role,
    title: staffInput.title,
    active: existing?.id === 'sec-super-admin' ? true : staffInput.active,
    mfaEnabled: existing?.id === 'sec-super-admin' ? true : staffInput.mfaEnabled,
    permissions: {
      ...basePerms,
      ...(staffInput.permissions || {})
    },
    createdAt: existing?.createdAt || staffInput.createdAt || new Date().toISOString()
  });

  if (existingIdx >= 0) {
    securityDb.staff[existingIdx] = merged;
  } else {
    securityDb.staff.push(merged);
  }
  persistSecurityDb();
  return merged;
}

export function revokeSessionsForStaffInSecurityDb(
  staffId: string,
  email: string,
  actorName: string,
  reason: string
): number {
  const emailNorm = email.trim().toLowerCase();
  const nowIso = new Date().toISOString();
  let revokedCount = 0;
  securityDb.sessions.forEach((s) => {
    const matches = s.userId === staffId || s.userEmail.toLowerCase() === emailNorm || s.tenantId === staffId;
    if (matches && s.status !== 'revoked' && s.status !== 'expired') {
      s.status = 'revoked';
      s.revokedBy = `${actorName} (${reason})`;
      s.revokedAt = nowIso;
      revokedCount += 1;
    }
  });
  if (revokedCount > 0) {
    persistSecurityDb();
  }
  return revokedCount;
}

export function setStaffActiveStateInSecurityDb(
  staffId: string,
  active: boolean,
  actorName: string,
  reason = 'Changement de statut administrateur'
): { updated: boolean; revokedSessions: number } {
  const member = securityDb.staff.find((s) => s.id === staffId);
  if (!member) return { updated: false, revokedSessions: 0 };
  if (member.role === 'super_admin' && !active) {
    return { updated: false, revokedSessions: 0 };
  }
  member.active = active;
  let revokedSessions = 0;
  if (!active) {
    revokedSessions = revokeSessionsForStaffInSecurityDb(member.id, member.email, actorName, reason);
  } else {
    securityDb.suspendedAccounts.forEach((s) => {
      if (s.accountId === member.id || s.accountEmail.toLowerCase() === member.email.toLowerCase()) {
        s.active = false;
      }
    });
  }
  persistSecurityDb();
  return { updated: true, revokedSessions };
}

export function createVerifiedStaffSessionInSecurityDb(
  req: Request,
  staffMember: SecurityStaffMember
): {
  token: string;
  session: SecurityActiveSession;
  loginLog: SecurityLoginLog;
  isNewDevice: boolean;
} {
  const ip = getClientIp(req);
  const uaRaw = req.header('user-agent') || '';
  const { device, browser, os } = parseUserAgent(uaRaw);
  const location = getApproxLocation(req, ip);
  const emailNorm = staffMember.email.trim().toLowerCase();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const ttlMs = Math.max(15, securityDb.settings.sessionTtlMinutes || 480) * 60_000;
  const sid = `sess-adm-${crypto.randomUUID()}`;

  const previousSuccesses = securityDb.loginLogs.filter(
    (l) => l.accountEmail.toLowerCase() === emailNorm && l.status === 'reussite'
  );
  const isNewDevice =
    securityDb.settings.detectUnusualDevices &&
    previousSuccesses.length > 0 &&
    !previousSuccesses.some((l) => l.device === device && l.os === os && l.browser === browser);

  const sessionObj: SecurityActiveSession = {
    id: `ses-${crypto.randomUUID()}`,
    sessionId: sid,
    userId: staffMember.id,
    userName: staffMember.name,
    userEmail: emailNorm,
    accountType: 'administrateur',
    spaceRole: 'admin',
    tenantId: staffMember.id,
    device,
    browser,
    os,
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
  if (securityDb.sessions.length > 400) {
    securityDb.sessions = securityDb.sessions.slice(0, 400);
  }

  const loginLog: SecurityLoginLog = {
    id: `lgn-${crypto.randomUUID()}`,
    accountId: staffMember.id,
    accountName: staffMember.name,
    accountEmail: emailNorm,
    accountType: 'administrateur',
    ipAddress: ip,
    device,
    browser,
    os,
    location,
    timestamp: nowIso,
    status: isNewDevice ? 'suspect' : 'reussite',
    isNewDevice,
    reason: isNewDevice ? 'Connexion admin depuis un nouvel appareil/navigateur' : 'Authentification administrateur vérifiée'
  };

  securityDb.loginLogs.unshift(loginLog);
  if (securityDb.loginLogs.length > 1000) {
    securityDb.loginLogs = securityDb.loginLogs.slice(0, 1000);
  }

  const token = signSessionToken({
    sid,
    uid: staffMember.id,
    email: emailNorm,
    name: staffMember.name,
    spaceRole: 'admin',
    tenantId: staffMember.id,
    staffId: staffMember.id,
    secRole: staffMember.role,
    iat: now,
    exp: now + ttlMs
  });

  persistSecurityDb();
  return { token, session: sessionObj, loginLog, isNewDevice };
}

export function recordFailedAdminLoginInSecurityDb(
  req: Request,
  params: {
    accountId: string;
    accountName: string;
    accountEmail: string;
    reason: string;
    isSuspect?: boolean;
  }
): SecurityLoginLog {
  const ip = getClientIp(req);
  const { device, browser, os } = parseUserAgent(req.header('user-agent') || '');
  const location = getApproxLocation(req, ip);
  const nowIso = new Date().toISOString();
  const log: SecurityLoginLog = {
    id: `lgn-${crypto.randomUUID()}`,
    accountId: params.accountId,
    accountName: params.accountName,
    accountEmail: params.accountEmail.toLowerCase(),
    accountType: 'administrateur',
    ipAddress: ip,
    device,
    browser,
    os,
    location,
    timestamp: nowIso,
    status: params.isSuspect ? 'suspect' : 'echec',
    reason: params.reason
  };
  securityDb.loginLogs.unshift(log);
  if (securityDb.loginLogs.length > 1000) {
    securityDb.loginLogs = securityDb.loginLogs.slice(0, 1000);
  }
  persistSecurityDb();
  return log;
}

export function getAdminTeamSecurityTelemetry(adminStaffIds: string[], adminEmails: string[]) {
  const idSet = new Set(adminStaffIds.map((id) => id.toLowerCase()));
  const emailSet = new Set(adminEmails.map((e) => e.toLowerCase()));

  const sessions = securityDb.sessions.filter(
    (s) =>
      s.spaceRole === 'admin' &&
      (idSet.has(s.userId.toLowerCase()) || emailSet.has(s.userEmail.toLowerCase()))
  );

  const loginLogs = securityDb.loginLogs.filter(
    (l) =>
      l.accountType === 'administrateur' &&
      (idSet.has(l.accountId.toLowerCase()) || emailSet.has(l.accountEmail.toLowerCase()))
  );

  const auditLogs = securityDb.auditLogs.filter(
    (a) =>
      a.space === 'admin' &&
      (idSet.has((a.actorId || '').toLowerCase()) ||
        emailSet.has((a.actorAccountLabel || '').toLowerCase()))
  );

  return { sessions, loginLogs, auditLogs };
}

export { parseUserAgent };
