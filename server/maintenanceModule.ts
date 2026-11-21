import type { Express, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { atomicWriteJsonFile } from './atomicFileStore';
import {
  authenticateSessionRequest,
  appendAuditEntry,
  getClientIp,
  getNotificationChannelsStatusPayload,
  getSecurityRuntimeSummary,
  getSecurityStaffDirectory,
  redactSensitiveText,
  sanitizePayload,
  verifyStepUpMfaForRequest,
  type AuthenticatedRequestContext
} from './securityModule';
import { getGeniusPayConfig } from './geniusPayService';
import { probeRodiumAiHealth, getRodiumAiConfig } from './rodiumAiService';
import { getGoogleMapsConfig } from './googleMapsService';
import { getR2StorageConfig, probeR2Endpoint } from './r2StorageService';
import { probeSupabaseHealth, getSupabaseServerConfig } from './supabaseService';
import { getFcmConfig } from './fcmService';
import type {
  AppEnvironment,
  AppOperationalStatus,
  AppVersionRecord,
  DeploymentChannel,
  DeploymentRecord,
  DeploymentStepLog,
  DjassaAppId,
  DjassaAppInfo,
  InfrastructureReadinessReport,
  MaintenancePermissionKey,
  MaintenanceScope,
  MaintenanceStaffPermissionRow,
  MaintenanceWindowRecord,
  RollbackPreflightResult,
  ServiceHealthRecord,
  ServiceHealthStatus,
  TechnicalErrorRecord,
  TechnicalErrorSeverity,
  TechnicalErrorStatus,
  TechnicalErrorType,
  TechnicalMaintenanceSettings,
  VersionPublicationStatus
} from '../src/types/maintenance';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const MAINTENANCE_DB_FILE = path.join(DATA_DIR, 'maintenance_db.json');

const ALL_APP_IDS: DjassaAppId[] = ['client', 'seller', 'admin'];

const APP_CATALOG: Record<DjassaAppId, { name: string; shortName: string; description: string; entryRoute: string }> = {
  client: {
    name: 'DJASSA Client',
    shortName: 'Client',
    description: 'Marketplace acheteur, découverte vidéo/photo, commandes et suivi client',
    entryRoute: '/'
  },
  seller: {
    name: 'DJASSA Vendeur',
    shortName: 'Vendeur',
    description: 'Espace boutique marchand, catalogue, stocks, ventes, livraisons vendeur et portefeuille',
    entryRoute: '/?space=seller'
  },
  admin: {
    name: 'DJASSA Administrateur',
    shortName: 'Admin',
    description: 'Supervision plateforme, sécurité SOC, KYC, finance, commissions, maintenance et versions',
    entryRoute: '/?space=admin'
  }
};

export const ALL_MAINTENANCE_PERMISSIONS: MaintenancePermissionKey[] = [
  'viewVersions',
  'viewTechnicalErrors',
  'scheduleMaintenance',
  'toggleMaintenance',
  'prepareDeployment',
  'validateDeployment',
  'executeRollback',
  'modifyTechnicalSettings'
];

interface MaintenanceDatabase {
  apps: Record<DjassaAppId, DjassaAppInfo>;
  versions: AppVersionRecord[];
  deployments: DeploymentRecord[];
  maintenances: MaintenanceWindowRecord[];
  services: ServiceHealthRecord[];
  errors: TechnicalErrorRecord[];
  staffPermissions: Record<string, Record<MaintenancePermissionKey, boolean>>;
  settings: TechnicalMaintenanceSettings;
  lastProbeAt: string | null;
}

function readPackageMetadata(): { version: string; name: string } {
  try {
    const pkgPath = path.join(ROOT_DIR, 'package.json');
    const raw = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return {
      version: typeof raw.version === 'string' && raw.version.trim() ? raw.version.trim() : '1.0.0',
      name: typeof raw.name === 'string' ? raw.name : 'djassa-app'
    };
  } catch {
    return { version: '1.0.0', name: 'djassa-app' };
  }
}

function detectRuntimeEnvironment(): AppEnvironment {
  const env = (process.env.NODE_ENV || 'development').toLowerCase();
  if (env === 'production') return 'production';
  if (env === 'test' || env === 'staging') return 'test';
  return 'development';
}

function detectBuildNumber(version: string): string {
  if (process.env.BUILD_NUMBER && process.env.BUILD_NUMBER.trim()) {
    return process.env.BUILD_NUMBER.trim();
  }
  if (process.env.CF_PAGES_COMMIT_SHA) {
    return `cf-${process.env.CF_PAGES_COMMIT_SHA.slice(0, 7)}`;
  }
  return `local-${version}-rt`;
}

function redactMaintenanceText(raw: string): string {
  if (!raw) return '';
  const base = redactSensitiveText(String(raw));
  return base
    .replace(/\b(eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*)\b/g, '[JWT_REDACTED]')
    .replace(/\b(cf_[A-Za-z0-9_-]{8,}|v1\.0-[A-Za-z0-9_-]{8,})\b/g, '[CF_TOKEN_REDACTED]')
    .replace(/(RODIUMAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|R2_SECRET_ACCESS_KEY|R2_ACCESS_KEY_ID|GENIUSPAY_API_KEY|GENIUSPAY_WEBHOOK_SECRET|CLOUDFLARE_API_TOKEN|FCM_SERVER_KEY|GOOGLE_MAPS_API_KEY|DJASSA_SECURITY_SECRET|password|mot_de_passe|otp|code_pin)\s*[:=]\s*([^\s&;,}]+)/gi, '$1=[REDACTED]')
    .slice(0, 1200);
}

function createInitialServices(): ServiceHealthRecord[] {
  const defs: Array<Pick<ServiceHealthRecord, 'id' | 'name' | 'category' | 'configHint'>> = [
    { id: 'frontend_client', name: 'Frontend DJASSA Client', category: 'frontend', configHint: 'SPA Vite/React servie sur / (espace client)' },
    { id: 'frontend_seller', name: 'Frontend DJASSA Vendeur', category: 'frontend', configHint: 'Espace vendeur React chargé via App.tsx' },
    { id: 'frontend_admin', name: 'Frontend DJASSA Administrateur', category: 'frontend', configHint: 'Console administration React chargée via App.tsx' },
    { id: 'backend_api', name: 'Backend & API Express (Cloud Run)', category: 'core', configHint: 'Serveur Express + endpoints /api/* hébergés sur Google Cloud Run' },
    { id: 'database_json', name: 'Base de données (Persistance JSON serveur)', category: 'core', configHint: 'Fichiers atomiques dans /server/data/*.json' },
    { id: 'auth_engine', name: 'Authentification & Sessions HMAC', category: 'core', configHint: 'Jeton signé HMAC SHA-256 + MFA step-up' },
    { id: 'cloudflare_r2', name: 'Stockage Cloudflare R2', category: 'storage', configHint: 'Requiert R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET' },
    { id: 'supabase_db', name: 'Supabase (PostgreSQL & Auth)', category: 'core', configHint: 'Requiert SUPABASE_DB_URL / SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY' },
    { id: 'geniuspay_payments', name: 'Paiements GeniusPay', category: 'payment', configHint: 'Requiert GENIUSPAY_API_KEY et GENIUSPAY_WEBHOOK_SECRET' },
    { id: 'google_maps', name: 'Google Maps Platform', category: 'maps', configHint: 'Requiert GOOGLE_MAPS_API_KEY ou VITE_GOOGLE_MAPS_API_KEY' },
    { id: 'rodiumai_providers', name: 'Fournisseur API IA RodiumAI', category: 'ai', configHint: 'MiniMax M3.1 Flash, Qwen Image 2.1 Turbo, MiniMax H3 Max Turbo, MiniMax H3 (RODIUMAI_API_KEY)' },
    { id: 'push_notifications', name: 'Notifications push FCM & Temps réel', category: 'messaging', configHint: 'WebSocket interne + Service Worker (/public/sw.js) + Firebase Cloud Messaging (FCM)' },
    { id: 'messaging_service', name: 'Services de messagerie', category: 'messaging', configHint: 'Collections discussions /api/conversations & WebSocket temps réel' },
    { id: 'orders_deliveries_sync', name: 'Synchronisation commandes & paiements', category: 'core', configHint: 'Endpoints /api/capabilities et /api/commerce/bootstrap (contrôle lecture seule)' }
  ];

  return defs.map((d) => ({
    ...d,
    status: 'non_verifie',
    configured: false,
    lastCheckedAt: null,
    responseTimeMs: null,
    uptimePercent: null,
    totalChecks: 0,
    successfulChecks: 0,
    lastError: null,
    incidentHistory: []
  }));
}

function buildDefaultDb(): MaintenanceDatabase {
  const pkg = readPackageMetadata();
  const env = detectRuntimeEnvironment();
  const buildNum = detectBuildNumber(pkg.version);
  const nowIso = new Date().toISOString();

  const apps = {} as Record<DjassaAppId, DjassaAppInfo>;
  const versions: AppVersionRecord[] = [];

  for (const appId of ALL_APP_IDS) {
    const meta = APP_CATALOG[appId];
    const verId = `ver-${appId}-${pkg.version.replace(/[^a-zA-Z0-9]/g, '_')}`;
    apps[appId] = {
      appId,
      name: meta.name,
      shortName: meta.shortName,
      description: meta.description,
      currentVersion: pkg.version,
      buildNumber: buildNum,
      environment: env,
      lastDeployedAt: null,
      status: 'operationnel',
      lastUpdateSummary: `Version initiale runtime v${pkg.version} (package.json)`,
      lastDeploymentResult: 'aucun',
      lastDeploymentId: null,
      activeVersionId: verId,
      entryRoute: meta.entryRoute
    };

    versions.push({
      id: verId,
      appId,
      version: pkg.version,
      previousVersion: null,
      buildNumber: buildNum,
      releaseDate: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: 'Système DJASSA (package.json)',
      description: `Version runtime de base détectée au démarrage serveur pour ${meta.name}.`,
      bugFixes: [],
      newFeatures: ['Socle applicatif actif'],
      securityImprovements: ['Middleware sécurité HMAC & journal d’audit actif'],
      compatibility: {
        apiVersion: 'v1',
        dbSchemaVersion: 'json-store-v1',
        services: ['backend_api', 'database_json', 'auth_engine'],
        notes: 'Compatible avec la structure JSON serveur actuelle.'
      },
      migrationVersion: 'm1_initial',
      rollbackEligible: false,
      status: 'deployee',
      targetEnv: env
    });
  }

  return {
    apps,
    versions,
    deployments: [],
    maintenances: [],
    services: createInitialServices(),
    errors: [],
    staffPermissions: {},
    settings: {
      autoCheckEnabled: true,
      autoCheckIntervalSeconds: 120,
      postDeployVerificationTimeoutMs: 5000,
      progressiveRolloutSupportedForManifest: true,
      notifySuperAdminOnOutage: true,
      notifySuperAdminOnCriticalError: true,
      maxErrorRetentionCount: 500,
      currentDbSchemaVersion: 'json-store-v1',
      currentApiVersion: 'v1',
      updatedAt: nowIso,
      updatedBy: 'Système DJASSA'
    },
    lastProbeAt: null
  };
}

let db: MaintenanceDatabase = buildDefaultDb();

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function persistDb() {
  if (!atomicWriteJsonFile(MAINTENANCE_DB_FILE, db, { context: 'MaintenanceModule' })) {
    console.error('[MaintenanceModule] Failed to persist maintenance_db.json');
  }
}

function loadDb() {
  ensureDataDir();
  if (fs.existsSync(MAINTENANCE_DB_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(MAINTENANCE_DB_FILE, 'utf8'));
      const defaults = buildDefaultDb();
      const mergedApps = { ...defaults.apps };
      for (const appId of ALL_APP_IDS) {
        if (parsed.apps?.[appId]) {
          mergedApps[appId] = { ...defaults.apps[appId], ...parsed.apps[appId] };
        }
      }
      const rawServices = Array.isArray(parsed.services) && parsed.services.length > 0 ? parsed.services : defaults.services;
      const normalizedServices = defaults.services.map((def) => {
        const legacyIdMap: Record<string, string[]> = {
          supabase_db: ['supabase_db', 'firebase_service'],
          geniuspay_payments: ['geniuspay_payments', 'pawapay_payments'],
          rodiumai_providers: ['rodiumai_providers', 'ai_providers']
        };
        const candidates = legacyIdMap[def.id] || [def.id];
        const found = rawServices.find((s: ServiceHealthRecord) => candidates.includes(s.id));
        if (!found) return def;
        return {
          ...def,
          ...found,
          id: def.id,
          name: def.name,
          configHint: def.configHint
        };
      });
      db = {
        apps: mergedApps,
        versions: Array.isArray(parsed.versions) && parsed.versions.length > 0 ? parsed.versions : defaults.versions,
        deployments: Array.isArray(parsed.deployments) ? parsed.deployments : [],
        maintenances: Array.isArray(parsed.maintenances) ? parsed.maintenances : [],
        services: normalizedServices,
        errors: Array.isArray(parsed.errors) ? parsed.errors : [],
        staffPermissions:
          parsed.staffPermissions && typeof parsed.staffPermissions === 'object' ? parsed.staffPermissions : {},
        settings: { ...defaults.settings, ...(parsed.settings || {}) },
        lastProbeAt: typeof parsed.lastProbeAt === 'string' ? parsed.lastProbeAt : null
      };
      return;
    } catch (err) {
      console.error('[MaintenanceModule] Corrupted maintenance_db.json, resetting defaults:', err);
    }
  }
  persistDb();
}

loadDb();

function getDefaultMaintenancePermissionsForRole(role: string): Record<MaintenancePermissionKey, boolean> {
  if (role === 'super_admin') {
    return {
      viewVersions: true,
      viewTechnicalErrors: true,
      scheduleMaintenance: true,
      toggleMaintenance: true,
      prepareDeployment: true,
      validateDeployment: true,
      executeRollback: true,
      modifyTechnicalSettings: true
    };
  }
  if (role === 'admin' || role === 'security_agent') {
    return {
      viewVersions: true,
      viewTechnicalErrors: true,
      scheduleMaintenance: false,
      toggleMaintenance: false,
      prepareDeployment: false,
      validateDeployment: false,
      executeRollback: false,
      modifyTechnicalSettings: false
    };
  }
  return {
    viewVersions: false,
    viewTechnicalErrors: false,
    scheduleMaintenance: false,
    toggleMaintenance: false,
    prepareDeployment: false,
    validateDeployment: false,
    executeRollback: false,
    modifyTechnicalSettings: false
  };
}

function getEffectivePermissionsForStaff(staffId: string, role: string): Record<MaintenancePermissionKey, boolean> {
  const defaults = getDefaultMaintenancePermissionsForRole(role);
  if (role === 'super_admin') return defaults;
  if (role === 'other_agent') return getDefaultMaintenancePermissionsForRole('other_agent');
  const saved = db.staffPermissions[staffId];
  if (!saved) return defaults;
  const merged = { ...defaults };
  for (const key of ALL_MAINTENANCE_PERMISSIONS) {
    if (typeof saved[key] === 'boolean') {
      merged[key] = saved[key];
    }
  }
  return merged;
}

function buildPermissionsDirectory(): MaintenanceStaffPermissionRow[] {
  return getSecurityStaffDirectory().map((s) => ({
    staffId: s.id,
    name: s.name,
    email: s.email,
    role: s.role,
    title: s.title,
    active: s.active,
    mfaEnabled: s.mfaEnabled,
    permissions: getEffectivePermissionsForStaff(s.id, s.role)
  }));
}

function requireMaintenanceAccess(
  requiredPermission?: MaintenancePermissionKey,
  options?: { requireSuperAdmin?: boolean; requireStepUpMfa?: boolean }
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const actor = authCtx.staff;
    const ip = getClientIp(req);

    if (!actor || authCtx.token.spaceRole !== 'admin') {
      appendAuditEntry({
        actorId: authCtx.token.uid,
        actorName: authCtx.token.name,
        actorAccountLabel: authCtx.token.email,
        actorRole: authCtx.token.spaceRole,
        space: authCtx.token.spaceRole,
        category: 'security',
        actionType: 'unauthorized_maintenance_access',
        action: 'Tentative d’accès non autorisé au module Maintenance & versions',
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
        afterValue: 'Refusé (HTTP 403)',
        details: `Rôle "${authCtx.token.spaceRole}" bloqué sur ${req.originalUrl}`,
        ipAddress: ip
      });
      return res.status(403).json({
        success: false,
        error: 'ADMIN_ROLE_REQUIRED',
        message: 'Accès refusé : compte administrateur requis pour la maintenance et les versions.'
      });
    }

    if (options?.requireSuperAdmin && actor.role !== 'super_admin') {
      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'security',
        actionType: 'super_admin_only_maintenance_blocked',
        action: 'Action réservée au Super Administrateur refusée',
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
        afterValue: 'Refusé (Super Admin requis)',
        details: `${actor.email} (${actor.role}) a tenté une opération réservée au Super Administrateur`,
        ipAddress: ip
      });
      return res.status(403).json({
        success: false,
        error: 'SUPER_ADMIN_REQUIRED',
        message: 'Opération réservée au Super Administrateur DJASSA.'
      });
    }

    const perms = getEffectivePermissionsForStaff(actor.id, actor.role);
    if (requiredPermission && !perms[requiredPermission]) {
      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'security',
        actionType: 'maintenance_permission_denied',
        action: `Permission Maintenance refusée (${requiredPermission})`,
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
        afterValue: `Refusé (${requiredPermission} manquant)`,
        details: `${actor.name} ne dispose pas de la permission "${requiredPermission}"`,
        ipAddress: ip
      });
      return res.status(403).json({
        success: false,
        error: 'MAINTENANCE_PERMISSION_DENIED',
        message: `Accès refusé : permission "${requiredPermission}" non accordée à votre compte.`
      });
    }

    if (options?.requireStepUpMfa) {
      const mfaCheck = verifyStepUpMfaForRequest(req, authCtx, false);
      if (!mfaCheck.ok) {
        return res.status(mfaCheck.status).json({
          success: false,
          error: mfaCheck.error,
          message: mfaCheck.message
        });
      }
    }

    (req as Request & { authCtx?: AuthenticatedRequestContext; maintenancePerms?: Record<MaintenancePermissionKey, boolean> }).authCtx = authCtx;
    (req as Request & { maintenancePerms?: Record<MaintenancePermissionKey, boolean> }).maintenancePerms = perms;
    next();
  };
}

function recordMaintenanceAudit(
  req: Request | null,
  authCtx: AuthenticatedRequestContext | null,
  params: {
    actionType: string;
    action: string;
    target: string;
    entityType: string;
    entityId?: string;
    result?: 'reussi' | 'echoue' | 'refuse' | 'bloque';
    severity: 'information' | 'faible' | 'moyen' | 'eleve' | 'critique';
    beforeValue?: string | null;
    afterValue?: string | null;
    details: string;
    dedupKey?: string;
  }
) {
  const actor = authCtx?.staff;
  const ip = req ? getClientIp(req) : '127.0.0.1';
  appendAuditEntry({
    actorId: actor?.id || authCtx?.token.uid || 'system-maintenance',
    actorName: actor?.name || authCtx?.token.name || 'Moteur Maintenance DJASSA',
    actorAccountLabel: actor?.email || authCtx?.token.email || 'system@djassa.ci',
    actorRole: actor?.role || authCtx?.token.spaceRole || 'system',
    space: 'admin',
    category: 'system_config',
    actionType: params.actionType,
    action: redactMaintenanceText(params.action),
    target: redactMaintenanceText(params.target),
    targetType: 'system',
    entityType: params.entityType,
    entityId: params.entityId,
    result: params.result || 'reussi',
    severity: params.severity,
    device: authCtx?.session.device || 'Serveur DJASSA',
    os: authCtx?.session.os || 'Linux',
    browser: authCtx?.session.browser || 'Console Maintenance',
    sessionId: authCtx?.session.sessionId,
    beforeValue: params.beforeValue ?? null,
    afterValue: params.afterValue ?? null,
    details: redactMaintenanceText(params.details),
    ipAddress: ip,
    dedupKey: params.dedupKey
  });
}

export function recordTechnicalError(params: {
  appId?: DjassaAppId | 'all';
  serviceId: string;
  serviceName: string;
  errorType: TechnicalErrorType;
  severity: TechnicalErrorSeverity;
  description: string;
  rawLog?: string;
  source: TechnicalErrorRecord['source'];
  req?: Request | null;
}): TechnicalErrorRecord {
  const cleanDesc = redactMaintenanceText(params.description);
  const cleanLog = redactMaintenanceText(params.rawLog || params.description);
  const nowIso = new Date().toISOString();

  // Deduplicate identical open error within 5 minutes
  const existing = db.errors.find(
    (e) =>
      e.status !== 'resolue' &&
      e.status !== 'ignoree' &&
      e.serviceId === params.serviceId &&
      e.errorType === params.errorType &&
      e.description === cleanDesc &&
      Date.now() - new Date(e.lastOccurrenceAt).getTime() < 5 * 60_000
  );

  if (existing) {
    existing.occurrenceCount += 1;
    existing.lastOccurrenceAt = nowIso;
    existing.redactedLog = cleanLog;
    persistDb();
    return existing;
  }

  const record: TechnicalErrorRecord = {
    id: `err-${crypto.randomUUID().slice(0, 10)}`,
    appId: params.appId || 'all',
    serviceId: params.serviceId,
    serviceName: params.serviceName,
    timestamp: nowIso,
    lastOccurrenceAt: nowIso,
    errorType: params.errorType,
    severity: params.severity,
    description: cleanDesc,
    redactedLog: cleanLog,
    status: 'nouvelle',
    occurrenceCount: 1,
    source: params.source,
    resolvedBy: null,
    resolvedAt: null,
    resolutionNote: null
  };

  db.errors.unshift(record);
  const cap = Math.max(50, Number(db.settings.maxErrorRetentionCount) || 500);
  if (db.errors.length > cap) {
    db.errors = db.errors.slice(0, cap);
  }
  persistDb();

  if (params.severity === 'critique' && db.settings.notifySuperAdminOnCriticalError) {
    recordMaintenanceAudit(params.req || null, null, {
      actionType: 'technical_error_critical',
      action: `Erreur technique critique : ${params.serviceName}`,
      target: `${params.appId || 'all'} • ${params.serviceId}`,
      entityType: 'technical_error',
      entityId: record.id,
      result: 'echoue',
      severity: 'critique',
      details: cleanDesc,
      dedupKey: `crit_err:${record.serviceId}:${record.errorType}:${cleanDesc.slice(0, 60)}`
    });
  }

  return record;
}

// Reconcile scheduled/active maintenance windows against current server clock
function reconcileMaintenanceWindows(): boolean {
  const now = Date.now();
  let changed = false;

  for (const win of db.maintenances) {
    const startMs = new Date(win.startAt).getTime();
    const endMs = win.endAt ? new Date(win.endAt).getTime() : NaN;

    if (win.status === 'programmee' && !Number.isNaN(startMs) && startMs <= now) {
      if (!Number.isNaN(endMs) && endMs <= now) {
        win.status = 'terminee';
        win.actualEndedAt = new Date(endMs).toISOString();
        changed = true;
      } else {
        win.status = 'active';
        changed = true;
        recordMaintenanceAudit(null, null, {
          actionType: 'maintenance_started',
          action:
            win.scope === 'globale'
              ? 'Maintenance globale DJASSA démarrée (planification)'
              : `Maintenance démarrée (${win.appIds.join(', ')})`,
          target: win.scope === 'globale' ? 'Plateforme DJASSA' : win.appIds.join(', '),
          entityType: 'maintenance_window',
          entityId: win.id,
          result: 'reussi',
          severity: 'eleve',
          details: win.customMessage,
          dedupKey: `maint_start:${win.id}`
        });
      }
    } else if (win.status === 'active' && !Number.isNaN(endMs) && endMs <= now) {
      win.status = 'terminee';
      win.actualEndedAt = new Date().toISOString();
      win.endedByName = win.endedByName || 'Expiration automatique programmée';
      changed = true;
      recordMaintenanceAudit(null, null, {
        actionType: 'maintenance_ended',
        action:
          win.scope === 'globale'
            ? 'Maintenance globale DJASSA terminée'
            : `Maintenance terminée (${win.appIds.join(', ')})`,
        target: win.scope === 'globale' ? 'Plateforme DJASSA' : win.appIds.join(', '),
        entityType: 'maintenance_window',
        entityId: win.id,
        result: 'reussi',
        severity: 'information',
        details: 'Fenêtre de maintenance arrivée à échéance.',
        dedupKey: `maint_end:${win.id}`
      });
    }
  }

  // Recompute app statuses cleanly based on active maintenances + latest frontend/backend probes
  const globalActive = db.maintenances.find((m) => m.status === 'active' && m.scope === 'globale');
  const backendSvc = db.services.find((s) => s.id === 'backend_api');

  for (const appId of ALL_APP_IDS) {
    const appInfo = db.apps[appId];
    const individualActive = db.maintenances.find(
      (m) => m.status === 'active' && m.scope === 'individuelle' && m.appIds.includes(appId)
    );
    const frontendSvc = db.services.find((s) => s.id === `frontend_${appId}`);

    let nextStatus: AppOperationalStatus = 'operationnel';
    // Admin console stays operational even during global maintenance so admins can operate & intervene
    if (individualActive || (globalActive && appId !== 'admin')) {
      nextStatus = 'maintenance';
    } else if (backendSvc?.status === 'indisponible' || frontendSvc?.status === 'indisponible') {
      nextStatus = 'indisponible';
    } else if (backendSvc?.status === 'degrade' || frontendSvc?.status === 'degrade') {
      nextStatus = 'degrade';
    }

    if (appInfo.status !== nextStatus) {
      appInfo.status = nextStatus;
      changed = true;
    }
  }

  if (changed) persistDb();
  return changed;
}

async function timedFetch(url: string, options: RequestInit = {}, timeoutMs = 2500): Promise<{ ok: boolean; status: number; ms: number; error?: string }> {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status, ms: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      ms: Date.now() - started,
      error: (err as Error)?.message || 'Timeout / Erreur réseau'
    };
  }
}

function updateServiceProbeResult(
  serviceId: string,
  outcome: {
    status: ServiceHealthStatus;
    configured: boolean;
    responseTimeMs: number | null;
    lastError: string | null;
  },
  req?: Request | null
) {
  const svc = db.services.find((s) => s.id === serviceId);
  if (!svc) return;

  const prevStatus = svc.status;
  const nowIso = new Date().toISOString();
  svc.configured = outcome.configured;
  svc.lastCheckedAt = nowIso;
  svc.responseTimeMs = outcome.responseTimeMs;
  svc.lastError = outcome.lastError ? redactMaintenanceText(outcome.lastError) : null;

  if (outcome.status !== 'non_verifie' && outcome.status !== 'maintenance') {
    svc.totalChecks += 1;
    if (outcome.status === 'operationnel' || outcome.status === 'degrade') {
      svc.successfulChecks += 1;
    }
    svc.uptimePercent = svc.totalChecks > 0 ? Math.round((svc.successfulChecks / svc.totalChecks) * 1000) / 10 : null;
  }

  if (prevStatus !== outcome.status && prevStatus !== 'non_verifie') {
    svc.incidentHistory.unshift({
      id: `sinc-${crypto.randomUUID().slice(0, 8)}`,
      at: nowIso,
      previousStatus: prevStatus,
      newStatus: outcome.status,
      message: svc.lastError || `Transition ${prevStatus} → ${outcome.status}`
    });
    if (svc.incidentHistory.length > 30) {
      svc.incidentHistory = svc.incidentHistory.slice(0, 30);
    }
  }

  svc.status = outcome.status;

  if (outcome.status === 'indisponible' && prevStatus !== 'indisponible') {
    recordTechnicalError({
      appId: serviceId.startsWith('frontend_') ? (serviceId.replace('frontend_', '') as DjassaAppId) : 'all',
      serviceId: svc.id,
      serviceName: svc.name,
      errorType: 'external_service',
      severity: 'critique',
      description: `Panne détectée sur ${svc.name} : ${svc.lastError || 'Service indisponible'}`,
      rawLog: `Service=${svc.id} prev=${prevStatus} next=${outcome.status} error=${svc.lastError || 'n/a'}`,
      source: 'health_probe',
      req
    });

    if (db.settings.notifySuperAdminOnOutage) {
      recordMaintenanceAudit(req || null, null, {
        actionType: 'service_outage',
        action: `Panne de service détectée : ${svc.name}`,
        target: svc.id,
        entityType: 'service_health',
        entityId: svc.id,
        result: 'echoue',
        severity: 'critique',
        beforeValue: prevStatus,
        afterValue: outcome.status,
        details: svc.lastError || `Le service ${svc.name} ne répond plus.`,
        dedupKey: `outage:${svc.id}:${new Date().toISOString().slice(0, 13)}`
      });
    }
  }
}

export async function runAllServiceHealthChecks(req?: Request | null): Promise<ServiceHealthRecord[]> {
  reconcileMaintenanceWindows();
  const port = Number(process.env.PORT || 3000);
  const baseUrl = `http://127.0.0.1:${port}`;
  const nowIso = new Date().toISOString();

  // 1. Backend & API probe
  const apiProbe = await timedFetch(`${baseUrl}/api/health`);
  updateServiceProbeResult(
    'backend_api',
    {
      status: apiProbe.ok ? (apiProbe.ms > 1200 ? 'degrade' : 'operationnel') : 'indisponible',
      configured: true,
      responseTimeMs: apiProbe.ms,
      lastError: apiProbe.ok ? null : apiProbe.error || `HTTP ${apiProbe.status}`
    },
    req
  );

  // 2. 3 App Frontends (real HTTP check on root HTML + verify workspace TSX components exist)
  const appComponentMap: Record<DjassaAppId, string> = {
    client: path.join(ROOT_DIR, 'src', 'App.tsx'),
    seller: path.join(ROOT_DIR, 'src', 'components', 'seller-app', 'SellerApp.tsx'),
    admin: path.join(ROOT_DIR, 'src', 'components', 'admin-app', 'AdminApp.tsx')
  };
  const rootHtmlProbe = await timedFetch(`${baseUrl}/`);
  const globalMaint = db.maintenances.find((m) => m.status === 'active' && m.scope === 'globale');

  for (const appId of ALL_APP_IDS) {
    const entryExists = fs.existsSync(appComponentMap[appId]);
    const indivMaint = db.maintenances.find(
      (m) => m.status === 'active' && m.scope === 'individuelle' && m.appIds.includes(appId)
    );
    const inMaintenance = Boolean(indivMaint || (globalMaint && appId !== 'admin'));

    let status: ServiceHealthStatus = 'operationnel';
    let lastError: string | null = null;
    if (inMaintenance) {
      status = 'maintenance';
    } else if (!entryExists) {
      status = 'indisponible';
      lastError = `Point d'entrée manquant pour ${APP_CATALOG[appId].name}`;
    } else if (!rootHtmlProbe.ok) {
      status = 'indisponible';
      lastError = rootHtmlProbe.error || `Frontend HTTP ${rootHtmlProbe.status}`;
    } else if (rootHtmlProbe.ms > (detectRuntimeEnvironment() === 'production' ? 1800 : 3500)) {
      status = 'degrade';
      lastError = `Latence frontend élevée (${rootHtmlProbe.ms} ms)`;
    }

    updateServiceProbeResult(
      `frontend_${appId}`,
      {
        status,
        configured: entryExists,
        responseTimeMs: rootHtmlProbe.ms,
        lastError
      },
      req
    );
  }

  // 3. Database / JSON Storage probe (real read & parse latency test)
  const dbStart = Date.now();
  try {
    ensureDataDir();
    const filesToVerify = ['security_db.json', 'credits_billing.json', 'maintenance_db.json'];
    let verifiedCount = 0;
    for (const f of filesToVerify) {
      const fullPath = path.join(DATA_DIR, f);
      if (fs.existsSync(fullPath)) {
        JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        verifiedCount++;
      }
    }
    const dbMs = Date.now() - dbStart;
    updateServiceProbeResult(
      'database_json',
      {
        status: verifiedCount >= 1 ? (dbMs > 800 ? 'degrade' : 'operationnel') : 'degrade',
        configured: true,
        responseTimeMs: dbMs,
        lastError: verifiedCount === 0 ? 'Aucun fichier de persistance trouvé' : null
      },
      req
    );
  } catch (err) {
    updateServiceProbeResult(
      'database_json',
      {
        status: 'indisponible',
        configured: true,
        responseTimeMs: Date.now() - dbStart,
        lastError: (err as Error)?.message || 'Erreur lecture JSON'
      },
      req
    );
  }

  // 4. Auth Engine
  const authStart = Date.now();
  const secSummary = getSecurityRuntimeSummary();
  updateServiceProbeResult(
    'auth_engine',
    {
      status: secSummary.hmacConfigured ? 'operationnel' : 'degrade',
      configured: secSummary.hmacConfigured,
      responseTimeMs: Date.now() - authStart,
      lastError: secSummary.hmacConfigured ? null : 'Clé HMAC non initialisée'
    },
    req
  );

  // 5. Cloudflare R2 (honest env check; if configured probe endpoint HEAD)
  const r2Configured = Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
  );
  if (!r2Configured) {
    updateServiceProbeResult(
      'cloudflare_r2',
      {
        status: 'non_verifie',
        configured: false,
        responseTimeMs: null,
        lastError: 'Non configuré : variables R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_BUCKET absentes'
      },
      req
    );
  } else {
    const r2Probe = await probeR2Endpoint();
    updateServiceProbeResult(
      'cloudflare_r2',
      {
        status: r2Probe.status > 0 ? 'operationnel' : 'indisponible',
        configured: true,
        responseTimeMs: r2Probe.ms,
        lastError: r2Probe.status > 0 ? null : r2Probe.error || 'Endpoint R2 injoignable'
      },
      req
    );
  }

  // 6. Supabase (PostgreSQL & Auth)
  const sbStart = Date.now();
  const sbProbe = await probeSupabaseHealth();
  if (!sbProbe.configured) {
    updateServiceProbeResult(
      'supabase_db',
      {
        status: 'non_verifie',
        configured: false,
        responseTimeMs: null,
        lastError: 'Non configuré : variables SUPABASE_DB_URL / SUPABASE_URL absentes'
      },
      req
    );
  } else {
    updateServiceProbeResult(
      'supabase_db',
      {
        status: sbProbe.connected || sbProbe.apiConfigured ? 'operationnel' : 'degrade',
        configured: true,
        responseTimeMs: Date.now() - sbStart,
        lastError: sbProbe.connected || sbProbe.apiConfigured ? null : 'Connexion PostgreSQL Supabase indisponible'
      },
      req
    );
  }

  // 7. Paiements GeniusPay
  const gpCfg = getGeniusPayConfig();
  if (!gpCfg.configured) {
    updateServiceProbeResult(
      'geniuspay_payments',
      {
        status: 'non_verifie',
        configured: false,
        responseTimeMs: null,
        lastError: 'Non configuré : clé GENIUSPAY_API_KEY absente de l’environnement serveur'
      },
      req
    );
  } else {
    const gpProbe = await timedFetch(`${gpCfg.baseUrl}/health`, { method: 'GET' }, 2500);
    updateServiceProbeResult(
      'geniuspay_payments',
      {
        status: gpProbe.ok ? 'operationnel' : gpProbe.status > 0 ? 'degrade' : 'indisponible',
        configured: true,
        responseTimeMs: gpProbe.ms,
        lastError: gpProbe.ok ? null : gpProbe.error || `HTTP ${gpProbe.status}`
      },
      req
    );
  }

  // 8. Google Maps Platform
  const mapsCfg = getGoogleMapsConfig();
  if (!mapsCfg.configured) {
    updateServiceProbeResult(
      'google_maps',
      {
        status: 'non_verifie',
        configured: false,
        responseTimeMs: null,
        lastError: 'Non configuré : GOOGLE_MAPS_API_KEY / VITE_GOOGLE_MAPS_API_KEY absent'
      },
      req
    );
  } else {
    const mapsProbe = await timedFetch('https://maps.googleapis.com/maps/api/js', { method: 'HEAD' }, 2500);
    updateServiceProbeResult(
      'google_maps',
      {
        status: mapsProbe.status > 0 && mapsProbe.status < 500 ? 'operationnel' : 'degrade',
        configured: true,
        responseTimeMs: mapsProbe.ms,
        lastError: mapsProbe.status > 0 && mapsProbe.status < 500 ? null : mapsProbe.error || `HTTP ${mapsProbe.status}`
      },
      req
    );
  }

  // 9. RodiumAI (MiniMax M3.1 Flash, Qwen Image 2.1 Turbo, MiniMax H3 Max Turbo, MiniMax H3)
  const aiProbe = await probeRodiumAiHealth();
  if (!aiProbe.configured) {
    updateServiceProbeResult(
      'rodiumai_providers',
      {
        status: 'non_verifie',
        configured: false,
        responseTimeMs: null,
        lastError: 'Non configuré : RODIUMAI_API_KEY absente sur le serveur'
      },
      req
    );
  } else {
    updateServiceProbeResult(
      'rodiumai_providers',
      {
        status: aiProbe.ok ? 'operationnel' : aiProbe.status === 401 || aiProbe.status === 403 ? 'indisponible' : 'degrade',
        configured: true,
        responseTimeMs: aiProbe.ms,
        lastError: aiProbe.error
      },
      req
    );
  }

  // 10. Push notifications (FCM + Service Worker + WebSocket)
  const pushStatus = getNotificationChannelsStatusPayload();
  const pushOk = pushStatus.interne.configured && pushStatus.push.serviceWorkerScript;
  updateServiceProbeResult(
    'push_notifications',
    {
      status: pushOk ? 'operationnel' : 'degrade',
      configured: pushOk,
      responseTimeMs: 4,
      lastError: pushStatus.push.externalRelayConfigured
        ? null
        : 'Relais Firebase Cloud Messaging (FCM) non configuré (temps réel WebSocket & SW navigateur actifs)'
    },
    req
  );

  // 11. Messaging service (conversations route check)
  const msgProbe = await timedFetch(`${baseUrl}/api/conversations`);
  updateServiceProbeResult(
    'messaging_service',
    {
      status: msgProbe.ok ? 'operationnel' : 'degrade',
      configured: true,
      responseTimeMs: msgProbe.ms,
      lastError: msgProbe.ok ? null : msgProbe.error || `HTTP ${msgProbe.status}`
    },
    req
  );

  // 12. Orders synchronization (strictly read-only GET, NEVER creates test orders)
  const capProbe = await timedFetch(`${baseUrl}/api/capabilities`);
  const prodProbe = await timedFetch(`${baseUrl}/api/commerce/products`);
  const syncOk = capProbe.ok && prodProbe.ok;
  updateServiceProbeResult(
    'orders_deliveries_sync',
    {
      status: syncOk ? (prodProbe.ms > 1200 ? 'degrade' : 'operationnel') : 'indisponible',
      configured: true,
      responseTimeMs: Math.round((capProbe.ms + prodProbe.ms) / 2),
      lastError: syncOk ? null : prodProbe.error || capProbe.error || `HTTP ${prodProbe.status}`
    },
    req
  );

  db.lastProbeAt = nowIso;
  reconcileMaintenanceWindows();
  persistDb();
  return db.services;
}

function buildInfrastructureReadinessReport(): InfrastructureReadinessReport {
  const push = getNotificationChannelsStatusPayload();
  const hasRodium = getRodiumAiConfig().configured;
  const hasR2 = getR2StorageConfig().configured;
  const sbCfg = getSupabaseServerConfig();
  const hasSupabase = sbCfg.dbConfigured || sbCfg.apiConfigured;
  const hasGeniusPay = getGeniusPayConfig().configured;
  const hasMaps = getGoogleMapsConfig().configured;
  const hasFcm = getFcmConfig().configured;
  const hasCfDeploy = Boolean(process.env.CLOUDFLARE_DEPLOY_HOOK || (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID));
  const hasCloudRunDeploy = Boolean(process.env.CLOUD_RUN_DEPLOY_HOOK || process.env.CLOUD_RUN_SERVICE_URL);

  return {
    operationalNow: [
      {
        title: 'Registre réel des 5 applications & manifeste des versions',
        details: 'Version runtime lue depuis package.json, cycle complet En préparation → En test → Prête à publier → Déployée, notes de version et compatibilité.'
      },
      {
        title: 'Mode maintenance individuel & global avec compte à rebours',
        details: 'Blocage effectif côté client des espaces en maintenance tout en préservant l’accès Admin, la sécurité, la journalisation et les routes critiques.'
      },
      {
        title: 'Sondes de santé réelles & journalisation d’erreurs masquée',
        details: 'Vérification HTTP en direct (/api/health, frontends, messagerie), intégrité JSON /server/data et masquage strict de tout secret/jeton.'
      },
      {
        title: 'Rollback sécurisé & RBAC 8 permissions + MFA',
        details: 'Contrôles de compatibilité API/BD pré-rollback, vérification post-restauration, piste d’audit chaînée SHA-256 et notifications temps réel.'
      }
    ],
    requiresExternalConfig: [
      {
        service: 'Stockage Cloudflare R2',
        configured: hasR2,
        missingKeys: hasR2 ? [] : ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'],
        note: hasR2 ? 'Identifiants détectés.' : 'Non vérifié tant que les clés R2 ne sont pas définies.'
      },
      {
        service: 'Supabase (PostgreSQL & Auth)',
        configured: hasSupabase,
        missingKeys: hasSupabase ? [] : ['SUPABASE_DB_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
        note: hasSupabase ? 'Configuration détectée.' : 'Non configuré sur cet environnement.'
      },
      {
        service: 'Paiements GeniusPay',
        configured: hasGeniusPay,
        missingKeys: hasGeniusPay ? [] : ['GENIUSPAY_API_KEY', 'GENIUSPAY_WEBHOOK_SECRET'],
        note: hasGeniusPay ? 'Clé API présente.' : 'Statut honnête "non vérifié" sans clé serveur.'
      },
      {
        service: 'Google Maps Platform',
        configured: hasMaps,
        missingKeys: hasMaps ? [] : ['GOOGLE_MAPS_API_KEY'],
        note: hasMaps ? 'Clé détectée.' : 'Clé absente de l’environnement.'
      },
      {
        service: 'Fournisseur API IA (RodiumAI)',
        configured: hasRodium,
        missingKeys: hasRodium ? [] : ['RODIUMAI_API_KEY'],
        note: hasRodium
          ? 'RodiumAI actif (MiniMax M3.1 Flash, Qwen Image 2.1 Turbo, MiniMax H3 Max Turbo, MiniMax H3).'
          : 'Clé RODIUMAI_API_KEY manquante.'
      },
      {
        service: 'Notifications Push FCM',
        configured: hasFcm || push.push.externalRelayConfigured,
        missingKeys: hasFcm ? [] : ['FCM_PROJECT_ID', 'FCM_SERVER_KEY'],
        note: 'WebSocket temps réel et Service Worker local actifs.'
      }
    ],
    remainingIntegrations: [
      {
        title: 'Hooks CI/CD Cloudflare Pages / Google Cloud Run',
        details: hasCfDeploy || hasCloudRunDeploy
          ? 'Webhook de déploiement configuré pour déclenchement externe.'
          : 'Définir CLOUDFLARE_DEPLOY_HOOK ou CLOUD_RUN_DEPLOY_HOOK pour déclencher des déploiements distants. Sans ces clés, seul le canal local_runtime_manifest est autorisé ; les déploiements externes échouent explicitement.'
      }
    ]
  };
}

function getActivePublicMaintenanceStatus() {
  reconcileMaintenanceWindows();
  const globalMaint = db.maintenances.find((m) => m.status === 'active' && m.scope === 'globale') || null;
  const appMaintenances = {} as Record<DjassaAppId, MaintenanceWindowRecord | null>;
  const appVersions = {} as Record<DjassaAppId, { version: string; buildNumber: string; environment: AppEnvironment }>;

  for (const appId of ALL_APP_IDS) {
    appMaintenances[appId] =
      db.maintenances.find(
        (m) => m.status === 'active' && m.scope === 'individuelle' && m.appIds.includes(appId)
      ) || null;
    const info = db.apps[appId];
    appVersions[appId] = {
      version: info.currentVersion,
      buildNumber: info.buildNumber,
      environment: info.environment
    };
  }

  return {
    success: true,
    serverTime: new Date().toISOString(),
    globalMaintenance: globalMaint,
    appMaintenances,
    appVersions
  };
}

function buildRollbackPreflight(appId: DjassaAppId, requestedVersionId?: string): RollbackPreflightResult {
  const appInfo = db.apps[appId];
  const candidateVersions = db.versions
    .filter(
      (v) =>
        v.appId === appId &&
        v.id !== appInfo.activeVersionId &&
        (v.status === 'deployee' || v.status === 'prete_a_publier' || v.rollbackEligible)
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const targetVersion = requestedVersionId
    ? db.versions.find((v) => v.id === requestedVersionId && v.appId === appId) || null
    : candidateVersions[0] || null;

  const checks: RollbackPreflightResult['checks'] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!targetVersion) {
    checks.push({
      id: 'prev_version_exists',
      label: 'Existence d’une version précédente restaurable',
      passed: false,
      blocking: true,
      details: `Aucune version antérieure éligible disponible pour ${appInfo.name}.`
    });
    blockers.push(`Aucune version antérieure disponible pour ${appInfo.name}.`);
  } else {
    checks.push({
      id: 'prev_version_exists',
      label: 'Existence d’une version précédente restaurable',
      passed: true,
      blocking: true,
      details: `Version cible identifiée : v${targetVersion.version} (${targetVersion.buildNumber})`
    });

    const isSame = targetVersion.id === appInfo.activeVersionId;
    checks.push({
      id: 'distinct_version',
      label: 'Version distincte de la version active',
      passed: !isSame,
      blocking: true,
      details: isSame
        ? 'La version cible est déjà celle actuellement déployée.'
        : `Passage de v${appInfo.currentVersion} vers v${targetVersion.version}.`
    });
    if (isSame) blockers.push('La version sélectionnée est déjà active.');

    const eligibleFlag = targetVersion.rollbackEligible !== false;
    checks.push({
      id: 'rollback_eligible_flag',
      label: 'Éligibilité technique de la version au retour arrière',
      passed: eligibleFlag,
      blocking: true,
      details: eligibleFlag
        ? 'Version marquée compatible avec un retour arrière sécurisé.'
        : 'Version marquée non réversible (changement de structure incompatible).'
    });
    if (!eligibleFlag) blockers.push('Cette version est marquée non réversible.');

    const apiCompatible = targetVersion.compatibility.apiVersion === db.settings.currentApiVersion;
    checks.push({
      id: 'api_compatibility',
      label: 'Compatibilité API backend',
      passed: apiCompatible,
      blocking: true,
      details: apiCompatible
        ? `API compatible (${targetVersion.compatibility.apiVersion})`
        : `Incompatibilité API : cible=${targetVersion.compatibility.apiVersion}, serveur=${db.settings.currentApiVersion}`
    });
    if (!apiCompatible) blockers.push('Incompatibilité de contrat API détectée.');

    const dbCompatible = targetVersion.compatibility.dbSchemaVersion === db.settings.currentDbSchemaVersion;
    checks.push({
      id: 'db_compatibility',
      label: 'Compatibilité base de données & migrations exécutées',
      passed: dbCompatible,
      blocking: true,
      details: dbCompatible
        ? `Schéma compatible (${targetVersion.compatibility.dbSchemaVersion}, migration ${targetVersion.migrationVersion})`
        : `Schéma DB incompatible (${targetVersion.compatibility.dbSchemaVersion} vs ${db.settings.currentDbSchemaVersion})`
    });
    if (!dbCompatible) blockers.push('Les migrations de base de données actuelles empêchent ce rollback.');

    const hasActiveDep = db.deployments.some(
      (d) => d.appId === appId && ['en_cours', 'deploiement_progressif', 'verification'].includes(d.status)
    );
    checks.push({
      id: 'no_inflight_deploy',
      label: 'Absence de déploiement en cours sur cette application',
      passed: !hasActiveDep,
      blocking: true,
      details: hasActiveDep ? 'Un déploiement est actuellement en cours.' : 'Aucun déploiement concurrent.'
    });
    if (hasActiveDep) blockers.push('Annulez ou attendez la fin du déploiement en cours avant rollback.');

    if (appInfo.environment === 'production') {
      warnings.push('Environnement PRODUCTION : confirmation renforcée et vérification post-restauration obligatoires.');
    }
  }

  const securityRuntime = getSecurityRuntimeSummary();
  return {
    eligible: blockers.length === 0 && Boolean(targetVersion),
    requiresMfa: Boolean(securityRuntime.requireTwoFactorAdmins && securityRuntime.requireTwoFactorSensitiveActions),
    appId,
    currentVersion: appInfo.currentVersion,
    targetVersion,
    checks,
    blockers,
    warnings
  };
}

export function installMaintenanceRoutes(app: Express) {
  // Periodic real health check + maintenance schedule check
  const intervalMs = Math.max(60_000, (db.settings.autoCheckIntervalSeconds || 120) * 1000);
  setTimeout(() => {
    void runAllServiceHealthChecks(null).catch(() => {});
  }, 3500).unref();
  setInterval(() => {
    reconcileMaintenanceWindows();
    if (db.settings.autoCheckEnabled) {
      void runAllServiceHealthChecks(null).catch(() => {});
    }
  }, intervalMs).unref();

  // --------------------------------------------------------------------------
  // PUBLIC READ-ONLY ROUTES (Maintenance banner/gate & Client error ingestion)
  // Never exposes secrets, staff directory, internal server config, or logs.
  // --------------------------------------------------------------------------
  app.get('/api/maintenance/public-status', (_req: Request, res: Response) => {
    res.json(getActivePublicMaintenanceStatus());
  });

  const errorReportIpBuckets = new Map<string, number[]>();

  app.post('/api/maintenance/errors/report', (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      const nowMs = Date.now();
      const recent = (errorReportIpBuckets.get(ip) || []).filter((ts) => nowMs - ts < 60_000);
      if (recent.length >= 25) {
        return res.status(429).json({
          success: false,
          error: 'ERROR_REPORT_RATE_LIMITED',
          message: 'Trop de rapports d’erreurs depuis cette adresse.'
        });
      }
      recent.push(nowMs);
      errorReportIpBuckets.set(ip, recent);

      const body = sanitizePayload(req.body || {}) as Record<string, unknown>;
      const rawAppId = String(body.appId || 'client');
      const appId: DjassaAppId | 'all' = ALL_APP_IDS.includes(rawAppId as DjassaAppId)
        ? (rawAppId as DjassaAppId)
        : 'all';
      const errorTypeRaw = String(body.errorType || 'frontend');
      const validTypes: TechnicalErrorType[] = [
        'frontend',
        'backend',
        'api',
        'database',
        'network',
        'deployment',
        'sync',
        'external_service'
      ];
      const errorType: TechnicalErrorType = validTypes.includes(errorTypeRaw as TechnicalErrorType)
        ? (errorTypeRaw as TechnicalErrorType)
        : 'frontend';
      const sevRaw = String(body.severity || 'moyen');
      const validSevs: TechnicalErrorSeverity[] = ['information', 'faible', 'moyen', 'eleve', 'critique'];
      const severity: TechnicalErrorSeverity = validSevs.includes(sevRaw as TechnicalErrorSeverity)
        ? (sevRaw as TechnicalErrorSeverity)
        : 'moyen';

      const description = String(body.description || body.message || 'Erreur technique signalée')
        .trim()
        .slice(0, 500);
      if (!description) {
        return res.status(400).json({ success: false, error: 'Description manquante' });
      }

      const record = recordTechnicalError({
        appId,
        serviceId: String(body.serviceId || (appId === 'all' ? 'backend_api' : `frontend_${appId}`)).slice(0, 80),
        serviceName: String(body.serviceName || (appId === 'all' ? 'Plateforme DJASSA' : APP_CATALOG[appId].name)).slice(0, 120),
        errorType,
        severity,
        description,
        rawLog: String(body.rawLog || body.stack || description).slice(0, 2000),
        source: errorType === 'frontend' ? 'frontend_runtime' : 'express_backend',
        req
      });

      res.json({ success: true, errorId: record.id });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error)?.message || 'Erreur interne' });
    }
  });

  // --------------------------------------------------------------------------
  // 1. OVERVIEW (All 9 sections bootstrap)
  // --------------------------------------------------------------------------
  app.get('/api/maintenance/overview', requireMaintenanceAccess(), async (req: Request, res: Response) => {
    const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
    const actor = authCtx.staff!;
    const perms = getEffectivePermissionsForStaff(actor.id, actor.role);

    if (req.query.probe === '1' || !db.lastProbeAt) {
      await runAllServiceHealthChecks(req);
    } else {
      reconcileMaintenanceWindows();
    }

    const activeMaintenances = db.maintenances.filter((m) => m.status === 'active');
    const scheduledMaintenances = db.maintenances.filter((m) => m.status === 'programmee');
    const maintenanceHistory = db.maintenances.filter(
      (m) => m.status === 'terminee' || m.status === 'annulee'
    );

    const memMb = Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;

    res.json({
      success: true,
      actor: {
        id: actor.id,
        name: actor.name,
        email: actor.email,
        role: actor.role,
        permissions: perms
      },
      apps: ALL_APP_IDS.map((id) => db.apps[id]),
      versions: perms.viewVersions ? db.versions : [],
      deployments: perms.viewVersions ? db.deployments : [],
      activeMaintenances,
      scheduledMaintenances,
      maintenanceHistory,
      services: db.services,
      errors: perms.viewTechnicalErrors ? db.errors : [],
      settings: db.settings,
      permissionsDirectory: buildPermissionsDirectory(),
      readiness: buildInfrastructureReadinessReport(),
      runtimeMeta: {
        nodeVersion: process.version,
        uptimeSeconds: Math.floor(process.uptime()),
        memoryRssMb: memMb,
        environment: detectRuntimeEnvironment(),
        lastProbeAt: db.lastProbeAt
      }
    });
  });

  // --------------------------------------------------------------------------
  // 2. APPLICATIONS & VERSIONS MANAGEMENT
  // --------------------------------------------------------------------------
  app.post(
    '/api/maintenance/versions',
    requireMaintenanceAccess('prepareDeployment'),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
      const actor = authCtx.staff!;
      const body = sanitizePayload(req.body || {}) as Record<string, unknown>;
      const appId = String(body.appId || '') as DjassaAppId;
      if (!ALL_APP_IDS.includes(appId)) {
        return res.status(400).json({ success: false, error: 'Application DJASSA invalide' });
      }

      const versionStr = String(body.version || '').trim();
      if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/.test(versionStr)) {
        return res.status(400).json({
          success: false,
          error: 'Format de version invalide (semver attendu, ex: 1.1.0)'
        });
      }

      const appInfo = db.apps[appId];
      if (db.versions.some((v) => v.appId === appId && v.version === versionStr && v.status !== 'annulee')) {
        return res.status(409).json({
          success: false,
          error: `La version v${versionStr} existe déjà pour ${appInfo.name}.`
        });
      }

      const targetEnv = (['development', 'test', 'production'].includes(String(body.targetEnv))
        ? String(body.targetEnv)
        : appInfo.environment) as AppEnvironment;
      const nowIso = new Date().toISOString();
      const buildNumber =
        String(body.buildNumber || '').trim() || `b-${versionStr.replace(/\./g, '')}-${Date.now().toString().slice(-4)}`;

      const toList = (val: unknown): string[] =>
        Array.isArray(val)
          ? val.map((x) => redactMaintenanceText(String(x).trim())).filter(Boolean)
          : typeof val === 'string'
          ? val
              .split('\n')
              .map((x) => redactMaintenanceText(x.trim()))
              .filter(Boolean)
          : [];

      const created: AppVersionRecord = {
        id: `ver-${appId}-${crypto.randomUUID().slice(0, 8)}`,
        appId,
        version: versionStr,
        previousVersion: appInfo.currentVersion,
        buildNumber,
        releaseDate: null,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: `${actor.name} (${actor.email})`,
        description: redactMaintenanceText(String(body.description || 'Mise à jour applicative DJASSA')),
        bugFixes: toList(body.bugFixes),
        newFeatures: toList(body.newFeatures),
        securityImprovements: toList(body.securityImprovements),
        compatibility: {
          apiVersion: String(body.apiVersion || db.settings.currentApiVersion),
          dbSchemaVersion: String(body.dbSchemaVersion || db.settings.currentDbSchemaVersion),
          services: Array.isArray(body.services)
            ? body.services.map((s) => String(s))
            : ['backend_api', 'database_json', 'auth_engine'],
          notes: redactMaintenanceText(String(body.compatibilityNotes || 'Compatible infrastructure actuelle'))
        },
        migrationVersion: String(body.migrationVersion || 'm1_initial'),
        rollbackEligible: body.rollbackEligible !== false,
        status: 'en_preparation',
        targetEnv
      };

      db.versions.unshift(created);
      persistDb();

      recordMaintenanceAudit(req, authCtx, {
        actionType: 'version_available',
        action: `Nouvelle version préparée : ${appInfo.name} v${created.version}`,
        target: `${appInfo.name} (${created.version})`,
        entityType: 'app_version',
        entityId: created.id,
        severity: 'information',
        afterValue: `v${created.version} (${created.status})`,
        details: created.description
      });

      res.json({ success: true, version: created });
    }
  );

  app.patch(
    '/api/maintenance/versions/:versionId/status',
    requireMaintenanceAccess('prepareDeployment'),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
      const actor = authCtx.staff!;
      const ver = db.versions.find((v) => v.id === req.params.versionId);
      if (!ver) return res.status(404).json({ success: false, error: 'Version introuvable' });

      const nextStatus = String(req.body?.status || '') as VersionPublicationStatus;
      const allowed: VersionPublicationStatus[] = ['en_preparation', 'en_test', 'prete_a_publier', 'annulee'];
      if (!allowed.includes(nextStatus)) {
        return res.status(400).json({
          success: false,
          error: 'Transition manuelle autorisée uniquement vers : en_preparation, en_test, prete_a_publier ou annulee (le statut déployée exige un déploiement vérifié).'
        });
      }

      const perms = getEffectivePermissionsForStaff(actor.id, actor.role);
      if (nextStatus === 'prete_a_publier' && !perms.validateDeployment && actor.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'VALIDATION_PERMISSION_REQUIRED',
          message: 'La permission "validateDeployment" est requise pour marquer une version prête à publier.'
        });
      }

      const prevStatus = ver.status;
      ver.status = nextStatus;
      ver.updatedAt = new Date().toISOString();
      persistDb();

      recordMaintenanceAudit(req, authCtx, {
        actionType: nextStatus === 'prete_a_publier' ? 'version_available' : 'version_status_updated',
        action: `Statut version ${db.apps[ver.appId].name} v${ver.version} → ${nextStatus}`,
        target: `${db.apps[ver.appId].name} v${ver.version}`,
        entityType: 'app_version',
        entityId: ver.id,
        severity: nextStatus === 'annulee' ? 'moyen' : 'information',
        beforeValue: prevStatus,
        afterValue: nextStatus,
        details: `Statut mis à jour par ${actor.name}`
      });

      res.json({ success: true, version: ver });
    }
  );

  // --------------------------------------------------------------------------
  // 3. DEPLOYMENT PIPELINE (Prepare -> Validate -> Execute & Real Post-Verify -> Cancel)
  // --------------------------------------------------------------------------
  app.post(
    '/api/maintenance/deployments/prepare',
    requireMaintenanceAccess('prepareDeployment'),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
      const actor = authCtx.staff!;
      const body = req.body || {};
      const version = db.versions.find((v) => v.id === body.versionId);
      if (!version) return res.status(404).json({ success: false, error: 'Version cible introuvable' });

      if (version.status === 'annulee') {
        return res.status(400).json({ success: false, error: 'Impossible de déployer une version annulée.' });
      }

      const targetEnv = (['development', 'test', 'production'].includes(String(body.targetEnv))
        ? String(body.targetEnv)
        : version.targetEnv) as AppEnvironment;
      const rolloutMode = body.rolloutMode === 'progressif' ? 'progressif' : 'standard';
      const deployChannel: DeploymentChannel = ['local_runtime_manifest', 'cloudflare_pages_hook', 'cloud_run_deploy_hook'].includes(
        String(body.deployChannel)
      )
        ? (String(body.deployChannel) as DeploymentChannel)
        : 'local_runtime_manifest';

      const appInfo = db.apps[version.appId];
      const nowIso = new Date().toISOString();

      const deployment: DeploymentRecord = {
        id: `dep-${crypto.randomUUID().slice(0, 10)}`,
        appId: version.appId,
        appName: appInfo.name,
        versionId: version.id,
        version: version.version,
        previousVersion: appInfo.currentVersion,
        buildNumber: version.buildNumber,
        startedAt: nowIso,
        completedAt: null,
        targetEnv,
        authorId: actor.id,
        authorName: actor.name,
        authorEmail: actor.email,
        status: 'en_attente_validation',
        rolloutMode,
        rolloutPercent: rolloutMode === 'progressif' ? 0 : 100,
        deployChannel,
        durationMs: null,
        result: 'En attente de validation avant publication',
        errorsEncountered: [],
        steps: [
          {
            id: `stp-${crypto.randomUUID().slice(0, 6)}`,
            label: 'Préparation du déploiement',
            status: 'passed',
            at: nowIso,
            details: `Paquet préparé pour ${appInfo.name} v${version.version} (${targetEnv}, canal ${deployChannel})`
          },
          {
            id: `stp-${crypto.randomUUID().slice(0, 6)}`,
            label: 'Validation avant publication',
            status: 'pending',
            at: nowIso,
            details: 'En attente d’approbation explicite (validateDeployment).'
          }
        ],
        preValidatedBy: null,
        preValidatedAt: null,
        postVerifiedAt: null,
        postVerificationPassed: false,
        postVerificationSummary: null,
        isRollback: false
      };

      db.deployments.unshift(deployment);
      persistDb();

      recordMaintenanceAudit(req, authCtx, {
        actionType: 'deployment_prepared',
        action: `Déploiement préparé : ${appInfo.name} v${version.version}`,
        target: `${appInfo.name} (${targetEnv})`,
        entityType: 'deployment',
        entityId: deployment.id,
        severity: 'moyen',
        afterValue: deployment.status,
        details: `Canal: ${deployChannel} • Mode: ${rolloutMode} • En attente de validation`
      });

      res.json({ success: true, deployment });
    }
  );

  app.post(
    '/api/maintenance/deployments/:id/validate',
    requireMaintenanceAccess('validateDeployment', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
      const actor = authCtx.staff!;
      const dep = db.deployments.find((d) => d.id === req.params.id);
      if (!dep) return res.status(404).json({ success: false, error: 'Déploiement introuvable' });
      if (dep.status !== 'en_attente_validation' && dep.status !== 'en_preparation') {
        return res.status(400).json({ success: false, error: `Validation impossible dans l'état "${dep.status}".` });
      }

      const ver = db.versions.find((v) => v.id === dep.versionId);
      const compatibilityOk =
        Boolean(ver) &&
        ver!.compatibility.apiVersion === db.settings.currentApiVersion &&
        ver!.compatibility.dbSchemaVersion === db.settings.currentDbSchemaVersion;

      const nowIso = new Date().toISOString();
      if (!compatibilityOk) {
        dep.status = 'echec';
        dep.completedAt = nowIso;
        dep.result = 'Validation bloquée : incompatibilité API/Schéma DB';
        dep.errorsEncountered.push('Incompatibilité détectée avec la version API ou schéma serveur actuel.');
        dep.steps.push({
          id: `stp-${crypto.randomUUID().slice(0, 6)}`,
          label: 'Validation avant publication',
          status: 'failed',
          at: nowIso,
          details: dep.result
        });
        persistDb();
        return res.status(422).json({ success: false, error: dep.result, deployment: dep });
      }

      dep.preValidatedBy = `${actor.name} (${actor.email})`;
      dep.preValidatedAt = nowIso;
      dep.status = 'en_cours';
      dep.result = 'Validé avant publication — prêt pour exécution & vérification';
      dep.steps.push({
        id: `stp-${crypto.randomUUID().slice(0, 6)}`,
        label: 'Validation avant publication',
        status: 'passed',
        at: nowIso,
        details: `Validé par ${actor.name} (compatibilité API/DB vérifiée).`
      });
      if (ver && ver.status !== 'deployee') {
        ver.status = 'prete_a_publier';
        ver.updatedAt = nowIso;
      }
      persistDb();

      recordMaintenanceAudit(req, authCtx, {
        actionType: 'deployment_validated',
        action: `Validation avant publication : ${dep.appName} v${dep.version}`,
        target: dep.id,
        entityType: 'deployment',
        entityId: dep.id,
        severity: 'moyen',
        afterValue: 'validé',
        details: `Pré-validation confirmée par ${actor.name}`
      });

      res.json({ success: true, deployment: dep });
    }
  );

  app.post(
    '/api/maintenance/deployments/:id/execute',
    requireMaintenanceAccess('validateDeployment', { requireStepUpMfa: true }),
    async (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
      const actor = authCtx.staff!;
      const dep = db.deployments.find((d) => d.id === req.params.id);
      if (!dep) return res.status(404).json({ success: false, error: 'Déploiement introuvable' });

      if (!dep.preValidatedAt || (dep.status !== 'en_cours' && dep.status !== 'deploiement_progressif')) {
        return res.status(400).json({
          success: false,
          error: 'Ce déploiement doit être validé avant publication avant d’être exécuté.'
        });
      }

      // Only Super Admin can publish directly to production
      if (dep.targetEnv === 'production' && actor.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'SUPER_ADMIN_REQUIRED_FOR_PRODUCTION',
          message: 'Seul le Super Administrateur peut exécuter une publication en production.'
        });
      }

      const startMs = Date.now();
      const nowIso = new Date().toISOString();
      const ver = db.versions.find((v) => v.id === dep.versionId);

      recordMaintenanceAudit(req, authCtx, {
        actionType: 'deployment_started',
        action: `Déploiement démarré : ${dep.appName} v${dep.version} (${dep.targetEnv})`,
        target: dep.appName,
        entityType: 'deployment',
        entityId: dep.id,
        severity: 'moyen',
        afterValue: dep.rolloutMode,
        details: `Exécution lancée sur canal ${dep.deployChannel} par ${actor.name}`
      });

      // HONEST EXECUTION CHECKS (NO FAKE DEPLOYMENT SUCCESS!)
      if (dep.deployChannel === 'cloudflare_pages_hook') {
        const cfHook = (process.env.CLOUDFLARE_DEPLOY_HOOK || '').trim();
        if (!cfHook) {
          const errMsg =
            'Échec réel : aucun webhook CLOUDFLARE_DEPLOY_HOOK configuré côté serveur pour déclencher le build Cloudflare Pages.';
          dep.status = 'echec';
          dep.completedAt = new Date().toISOString();
          dep.durationMs = Date.now() - startMs;
          dep.result = errMsg;
          dep.errorsEncountered.push(errMsg);
          dep.steps.push({
            id: `stp-${crypto.randomUUID().slice(0, 6)}`,
            label: 'Déclenchement Cloudflare Pages',
            status: 'failed',
            at: dep.completedAt,
            details: errMsg
          });
          if (ver) ver.status = 'echec';
          db.apps[dep.appId].lastDeploymentResult = 'echec';
          db.apps[dep.appId].lastDeploymentId = dep.id;
          persistDb();
          recordTechnicalError({
            appId: dep.appId,
            serviceId: 'cloudflare_r2',
            serviceName: 'Cloudflare Pages Deploy',
            errorType: 'deployment',
            severity: 'critique',
            description: errMsg,
            rawLog: `Deployment=${dep.id} app=${dep.appId} channel=cloudflare_pages_hook missing CLOUDFLARE_DEPLOY_HOOK`,
            source: 'deployment',
            req
          });
          recordMaintenanceAudit(req, authCtx, {
            actionType: 'deployment_failed',
            action: `Échec déploiement Cloudflare : ${dep.appName} v${dep.version}`,
            target: dep.id,
            entityType: 'deployment',
            entityId: dep.id,
            result: 'echoue',
            severity: 'critique',
            details: errMsg
          });
          return res.status(424).json({ success: false, error: errMsg, deployment: dep });
        }

        const hookRes = await timedFetch(cfHook, { method: 'POST' }, 8000);
        if (!hookRes.ok) {
          const errMsg = `Échec réel Cloudflare Deploy Hook : ${hookRes.error || `HTTP ${hookRes.status}`}`;
          dep.status = 'echec';
          dep.completedAt = new Date().toISOString();
          dep.durationMs = Date.now() - startMs;
          dep.result = errMsg;
          dep.errorsEncountered.push(errMsg);
          dep.steps.push({
            id: `stp-${crypto.randomUUID().slice(0, 6)}`,
            label: 'Déclenchement Cloudflare Pages',
            status: 'failed',
            at: dep.completedAt,
            details: errMsg
          });
          if (ver) ver.status = 'echec';
          db.apps[dep.appId].lastDeploymentResult = 'echec';
          persistDb();
          recordMaintenanceAudit(req, authCtx, {
            actionType: 'deployment_failed',
            action: `Échec déploiement Cloudflare : ${dep.appName} v${dep.version}`,
            target: dep.id,
            entityType: 'deployment',
            entityId: dep.id,
            result: 'echoue',
            severity: 'critique',
            details: errMsg
          });
          return res.status(502).json({ success: false, error: errMsg, deployment: dep });
        }
      }

      if (dep.deployChannel === 'cloud_run_deploy_hook') {
        const crHook = (process.env.CLOUD_RUN_DEPLOY_HOOK || '').trim();
        if (!crHook) {
          const errMsg =
            'Échec réel : aucun webhook CLOUD_RUN_DEPLOY_HOOK configuré côté serveur pour Google Cloud Run.';
          dep.status = 'echec';
          dep.completedAt = new Date().toISOString();
          dep.durationMs = Date.now() - startMs;
          dep.result = errMsg;
          dep.errorsEncountered.push(errMsg);
          dep.steps.push({
            id: `stp-${crypto.randomUUID().slice(0, 6)}`,
            label: 'Déclenchement Google Cloud Run',
            status: 'failed',
            at: dep.completedAt,
            details: errMsg
          });
          if (ver) ver.status = 'echec';
          db.apps[dep.appId].lastDeploymentResult = 'echec';
          persistDb();
          recordTechnicalError({
            appId: dep.appId,
            serviceId: 'backend_api',
            serviceName: 'Google Cloud Run Deploy',
            errorType: 'deployment',
            severity: 'critique',
            description: errMsg,
            rawLog: `Deployment=${dep.id} app=${dep.appId} channel=cloud_run_deploy_hook missing CLOUD_RUN_DEPLOY_HOOK`,
            source: 'deployment',
            req
          });
          recordMaintenanceAudit(req, authCtx, {
            actionType: 'deployment_failed',
            action: `Échec déploiement Cloud Run : ${dep.appName} v${dep.version}`,
            target: dep.id,
            entityType: 'deployment',
            entityId: dep.id,
            result: 'echoue',
            severity: 'critique',
            details: errMsg
          });
          return res.status(424).json({ success: false, error: errMsg, deployment: dep });
        }
        const crRes = await timedFetch(crHook, { method: 'POST' }, 8000);
        if (!crRes.ok) {
          const errMsg = `Échec réel Google Cloud Run Deploy Hook : ${crRes.error || `HTTP ${crRes.status}`}`;
          dep.status = 'echec';
          dep.completedAt = new Date().toISOString();
          dep.durationMs = Date.now() - startMs;
          dep.result = errMsg;
          dep.errorsEncountered.push(errMsg);
          if (ver) ver.status = 'echec';
          db.apps[dep.appId].lastDeploymentResult = 'echec';
          persistDb();
          return res.status(502).json({ success: false, error: errMsg, deployment: dep });
        }
      }

      // Progressive rollout stage handling for local_runtime_manifest
      if (dep.rolloutMode === 'progressif' && dep.rolloutPercent < 100 && req.body?.advanceStage !== 'full') {
        const nextPct = dep.rolloutPercent === 0 ? 25 : dep.rolloutPercent === 25 ? 50 : 100;
        if (nextPct < 100) {
          dep.status = 'deploiement_progressif';
          dep.rolloutPercent = nextPct;
          dep.result = `Déploiement progressif actif sur manifeste runtime (${nextPct}% — vérification intermédiaire requise avant 100%)`;
          dep.steps.push({
            id: `stp-${crypto.randomUUID().slice(0, 6)}`,
            label: `Palier progressif ${nextPct}%`,
            status: 'passed',
            at: nowIso,
            details: `Activation partielle (${nextPct}%) sur le manifeste runtime local.`
          });
          persistDb();
          return res.json({ success: true, deployment: dep, progressiveStage: nextPct });
        }
        dep.rolloutPercent = 100;
      }

      // Step: Post-deploy verification MUST actually run before declaring success!
      dep.status = 'verification';
      dep.steps.push({
        id: `stp-${crypto.randomUUID().slice(0, 6)}`,
        label: 'Vérification post-déploiement en cours',
        status: 'running',
        at: new Date().toISOString(),
        details: 'Exécution des sondes réelles /api/health, frontend et intégrité manifeste.'
      });

      const servicesAfter = await runAllServiceHealthChecks(req);
      const apiService = servicesAfter.find((s) => s.id === 'backend_api');
      const frontendService = servicesAfter.find((s) => s.id === `frontend_${dep.appId}`);
      const dbService = servicesAfter.find((s) => s.id === 'database_json');

      const postChecksOk =
        apiService?.status === 'operationnel' &&
        (frontendService?.status === 'operationnel' || frontendService?.status === 'maintenance') &&
        dbService?.status === 'operationnel';

      const completedIso = new Date().toISOString();
      dep.completedAt = completedIso;
      dep.durationMs = Date.now() - startMs;
      dep.postVerifiedAt = completedIso;
      dep.postVerificationPassed = Boolean(postChecksOk);

      if (!postChecksOk) {
        const reason = `Échec vérification post-déploiement : API=${apiService?.status}, Frontend=${frontendService?.status}, DB=${dbService?.status}`;
        dep.status = 'echec';
        dep.result = reason;
        dep.postVerificationSummary = reason;
        dep.errorsEncountered.push(reason);
        dep.steps.push({
          id: `stp-${crypto.randomUUID().slice(0, 6)}`,
          label: 'Vérification post-déploiement',
          status: 'failed',
          at: completedIso,
          details: reason
        });
        if (ver) ver.status = 'echec';
        db.apps[dep.appId].lastDeploymentResult = 'echec';
        persistDb();
        recordMaintenanceAudit(req, authCtx, {
          actionType: 'deployment_failed',
          action: `Vérification post-déploiement échouée : ${dep.appName} v${dep.version}`,
          target: dep.id,
          entityType: 'deployment',
          entityId: dep.id,
          result: 'echoue',
          severity: 'critique',
          details: reason
        });
        return res.status(500).json({ success: false, error: reason, deployment: dep });
      }

      // Passed real post-deploy verification -> Update app runtime manifest
      dep.status = 'deployee';
      dep.rolloutPercent = 100;
      dep.postVerificationSummary = `Vérification réelle réussie : API (${apiService?.responseTimeMs}ms), Frontend (${frontendService?.responseTimeMs}ms), DB (${dbService?.responseTimeMs}ms)`;
      dep.result =
        dep.deployChannel === 'local_runtime_manifest'
          ? `Manifeste runtime local mis à jour et vérifié avec succès (${dep.targetEnv})`
          : `Déploiement ${dep.deployChannel} déclenché et vérifié avec succès`;
      dep.steps.push({
        id: `stp-${crypto.randomUUID().slice(0, 6)}`,
        label: 'Vérification post-déploiement',
        status: 'passed',
        at: completedIso,
        details: dep.postVerificationSummary
      });

      const appInfo = db.apps[dep.appId];
      const prevAppVer = appInfo.currentVersion;
      appInfo.currentVersion = dep.version;
      appInfo.buildNumber = dep.buildNumber;
      appInfo.environment = dep.targetEnv;
      appInfo.lastDeployedAt = completedIso;
      appInfo.lastDeploymentResult = 'reussi';
      appInfo.lastDeploymentId = dep.id;
      appInfo.activeVersionId = dep.versionId;
      appInfo.lastUpdateSummary = ver?.description || dep.result;

      if (ver) {
        ver.status = 'deployee';
        ver.releaseDate = completedIso;
        ver.updatedAt = completedIso;
      }

      persistDb();

      recordMaintenanceAudit(req, authCtx, {
        actionType: 'deployment_succeeded',
        action: `Déploiement vérifié et réussi : ${dep.appName} v${dep.version}`,
        target: `${dep.appName} (${dep.targetEnv})`,
        entityType: 'deployment',
        entityId: dep.id,
        severity: 'information',
        beforeValue: `v${prevAppVer}`,
        afterValue: `v${dep.version}`,
        details: dep.postVerificationSummary
      });

      res.json({ success: true, deployment: dep, app: appInfo });
    }
  );

  app.post(
    '/api/maintenance/deployments/:id/cancel',
    requireMaintenanceAccess('prepareDeployment'),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
      const actor = authCtx.staff!;
      const dep = db.deployments.find((d) => d.id === req.params.id);
      if (!dep) return res.status(404).json({ success: false, error: 'Déploiement introuvable' });
      if (['deployee', 'echec', 'annulee'].includes(dep.status)) {
        return res.status(400).json({
          success: false,
          error: `Impossible d'annuler un déploiement déjà terminé (${dep.status}).`
        });
      }

      const nowIso = new Date().toISOString();
      dep.status = 'annulee';
      dep.completedAt = nowIso;
      dep.durationMs = Math.max(0, Date.now() - new Date(dep.startedAt).getTime());
      dep.result = `Déploiement annulé par ${actor.name}`;
      dep.steps.push({
        id: `stp-${crypto.randomUUID().slice(0, 6)}`,
        label: 'Annulation du déploiement',
        status: 'failed',
        at: nowIso,
        details: String(req.body?.reason || `Annulé manuellement par ${actor.name}`)
      });
      db.apps[dep.appId].lastDeploymentResult = 'annule';
      db.apps[dep.appId].lastDeploymentId = dep.id;
      persistDb();

      recordMaintenanceAudit(req, authCtx, {
        actionType: 'deployment_cancelled',
        action: `Déploiement annulé : ${dep.appName} v${dep.version}`,
        target: dep.id,
        entityType: 'deployment',
        entityId: dep.id,
        severity: 'moyen',
        afterValue: 'annulee',
        details: dep.result
      });

      res.json({ success: true, deployment: dep });
    }
  );

  // --------------------------------------------------------------------------
  // 4. MAINTENANCE MODE (Individual & Global, Activate/Deactivate/Schedule)
  // --------------------------------------------------------------------------
  app.post('/api/maintenance/windows', requireMaintenanceAccess(), (req: Request, res: Response) => {
    const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
    const actor = authCtx.staff!;
    const perms = getEffectivePermissionsForStaff(actor.id, actor.role);

    const body = req.body || {};
    const scope: MaintenanceScope = body.scope === 'globale' ? 'globale' : 'individuelle';
    const activateNow = body.activateNow !== false;

    // Permission checks:
    // - Super Admin manages global maintenance
    // - Other admins require explicit toggleMaintenance / scheduleMaintenance for individual
    if (scope === 'globale' && actor.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'SUPER_ADMIN_REQUIRED',
        message: 'Seul le Super Administrateur peut activer ou programmer une maintenance globale.'
      });
    }
    if (activateNow && !perms.toggleMaintenance) {
      return res.status(403).json({
        success: false,
        error: 'MAINTENANCE_PERMISSION_DENIED',
        message: 'Permission "toggleMaintenance" requise pour activer une maintenance.'
      });
    }
    if (!activateNow && !perms.scheduleMaintenance) {
      return res.status(403).json({
        success: false,
        error: 'MAINTENANCE_PERMISSION_DENIED',
        message: 'Permission "scheduleMaintenance" requise pour programmer une maintenance.'
      });
    }

    const appIds: DjassaAppId[] =
      scope === 'globale'
        ? ['client', 'seller']
        : (Array.isArray(body.appIds) ? body.appIds : [body.appId]).filter((id): id is DjassaAppId =>
            ALL_APP_IDS.includes(id as DjassaAppId)
          );

    if (appIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Sélectionnez au moins une application DJASSA concernée.'
      });
    }

    const nowMs = Date.now();
    const startAt = activateNow
      ? new Date(nowMs).toISOString()
      : new Date(String(body.startAt || nowMs + 5 * 60_000)).toISOString();
    const durationMin = body.estimatedDurationMinutes ? Math.max(1, Number(body.estimatedDurationMinutes)) : 30;
    const endAt = body.endAt
      ? new Date(String(body.endAt)).toISOString()
      : new Date(new Date(startAt).getTime() + durationMin * 60_000).toISOString();

    const customMessage = redactMaintenanceText(
      String(
        body.customMessage ||
          'Maintenance technique en cours sur DJASSA. Nos équipes rétablissent le service très rapidement.'
      ).trim()
    );
    const reason = redactMaintenanceText(String(body.reason || 'Intervention technique planifiée').trim());

    const win: MaintenanceWindowRecord = {
      id: `mnt-${crypto.randomUUID().slice(0, 10)}`,
      scope,
      appIds,
      status: activateNow || new Date(startAt).getTime() <= nowMs ? 'active' : 'programmee',
      startAt,
      endAt,
      actualEndedAt: null,
      estimatedDurationMinutes: durationMin,
      customMessage,
      allowAuthorizedAdmins: true,
      exemptCriticalServices: true,
      createdById: actor.id,
      createdByName: actor.name,
      createdAt: new Date().toISOString(),
      endedByName: null,
      reason
    };

    db.maintenances.unshift(win);
    reconcileMaintenanceWindows();
    persistDb();

    const isNow = win.status === 'active';
    recordMaintenanceAudit(req, authCtx, {
      actionType: isNow ? 'maintenance_started' : 'maintenance_scheduled',
      action: isNow
        ? scope === 'globale'
          ? 'Maintenance globale DJASSA activée'
          : `Maintenance activée sur ${appIds.join(', ')}`
        : scope === 'globale'
        ? 'Maintenance globale DJASSA programmée'
        : `Maintenance programmée sur ${appIds.join(', ')}`,
      target: scope === 'globale' ? 'Plateforme DJASSA (Client, Vendeur, Livreur, Entreprise)' : appIds.join(', '),
      entityType: 'maintenance_window',
      entityId: win.id,
      severity: isNow ? 'eleve' : 'moyen',
      afterValue: `${win.status} (${durationMin} min)`,
      details: `${customMessage} — Motif : ${reason}`
    });

    res.json({ success: true, maintenance: win });
  });

  app.post(
    '/api/maintenance/windows/:id/stop',
    requireMaintenanceAccess('toggleMaintenance'),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
      const actor = authCtx.staff!;
      const win = db.maintenances.find((m) => m.id === req.params.id);
      if (!win) return res.status(404).json({ success: false, error: 'Fenêtre de maintenance introuvable' });

      if (win.scope === 'globale' && actor.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'SUPER_ADMIN_REQUIRED',
          message: 'Seul le Super Administrateur peut arrêter une maintenance globale.'
        });
      }

      const wasScheduled = win.status === 'programmee';
      win.status = wasScheduled ? 'annulee' : 'terminee';
      win.actualEndedAt = new Date().toISOString();
      win.endedByName = actor.name;
      reconcileMaintenanceWindows();
      persistDb();

      recordMaintenanceAudit(req, authCtx, {
        actionType: 'maintenance_ended',
        action: wasScheduled
          ? `Maintenance programmée annulée (${win.scope})`
          : `Maintenance désactivée (${win.scope === 'globale' ? 'globale' : win.appIds.join(', ')})`,
        target: win.id,
        entityType: 'maintenance_window',
        entityId: win.id,
        severity: 'information',
        beforeValue: wasScheduled ? 'programmee' : 'active',
        afterValue: win.status,
        details: `Clôturée par ${actor.name}`
      });

      res.json({ success: true, maintenance: win });
    }
  );

  // --------------------------------------------------------------------------
  // 5. SERVICES HEALTH PROBES
  // --------------------------------------------------------------------------
  app.post('/api/maintenance/services/check', requireMaintenanceAccess(), async (req: Request, res: Response) => {
    const services = await runAllServiceHealthChecks(req);
    res.json({
      success: true,
      services,
      lastProbeAt: db.lastProbeAt,
      readiness: buildInfrastructureReadinessReport()
    });
  });

  // --------------------------------------------------------------------------
  // 6. TECHNICAL ERRORS & REDACTED LOGS
  // --------------------------------------------------------------------------
  app.patch(
    '/api/maintenance/errors/:id/status',
    requireMaintenanceAccess('viewTechnicalErrors'),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
      const actor = authCtx.staff!;
      const errRec = db.errors.find((e) => e.id === req.params.id);
      if (!errRec) return res.status(404).json({ success: false, error: 'Erreur technique introuvable' });

      const nextStatus = String(req.body?.status || '') as TechnicalErrorStatus;
      if (!['nouvelle', 'en_cours', 'resolue', 'ignoree'].includes(nextStatus)) {
        return res.status(400).json({ success: false, error: 'Statut invalide' });
      }

      const prev = errRec.status;
      errRec.status = nextStatus;
      if (nextStatus === 'resolue' || nextStatus === 'ignoree') {
        errRec.resolvedBy = actor.name;
        errRec.resolvedAt = new Date().toISOString();
        errRec.resolutionNote = redactMaintenanceText(String(req.body?.note || 'Traitée depuis la console admin'));
      }
      persistDb();

      recordMaintenanceAudit(req, authCtx, {
        actionType: 'technical_error_updated',
        action: `Erreur technique #${errRec.id} → ${nextStatus}`,
        target: `${errRec.serviceName} (${errRec.errorType})`,
        entityType: 'technical_error',
        entityId: errRec.id,
        severity: 'faible',
        beforeValue: prev,
        afterValue: nextStatus,
        details: errRec.resolutionNote || errRec.description
      });

      res.json({ success: true, errorRecord: errRec });
    }
  );

  // --------------------------------------------------------------------------
  // 7. SAFE ROLLBACK MECHANISM (Preflight + Reinforced Execution + Post-Check)
  // --------------------------------------------------------------------------
  app.post(
    '/api/maintenance/rollbacks/preflight',
    requireMaintenanceAccess('executeRollback'),
    (req: Request, res: Response) => {
      const appId = String(req.body?.appId || '') as DjassaAppId;
      if (!ALL_APP_IDS.includes(appId)) {
        return res.status(400).json({ success: false, error: 'Application invalide' });
      }
      const result = buildRollbackPreflight(appId, req.body?.targetVersionId ? String(req.body.targetVersionId) : undefined);
      res.json({ success: true, preflight: result });
    }
  );

  app.post(
    '/api/maintenance/rollbacks/execute',
    requireMaintenanceAccess('executeRollback', { requireStepUpMfa: true }),
    async (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
      const actor = authCtx.staff!;
      const body = req.body || {};
      const appId = String(body.appId || '') as DjassaAppId;
      if (!ALL_APP_IDS.includes(appId)) {
        return res.status(400).json({ success: false, error: 'Application invalide' });
      }

      const confirmPhrase = String(body.confirmPhrase || '').trim().toUpperCase();
      if (confirmPhrase !== 'CONFIRMER ROLLBACK') {
        return res.status(400).json({
          success: false,
          error: 'CONFIRMATION_REQUIRED',
          message: 'Confirmation renforcée requise : saisissez exactement "CONFIRMER ROLLBACK".'
        });
      }

      const reason = redactMaintenanceText(String(body.reason || '').trim());
      if (!reason || reason.length < 5) {
        return res.status(400).json({
          success: false,
          error: 'Motif d’audit obligatoire pour effectuer un rollback.'
        });
      }

      const preflight = buildRollbackPreflight(appId, body.targetVersionId ? String(body.targetVersionId) : undefined);
      if (!preflight.eligible || !preflight.targetVersion) {
        return res.status(422).json({
          success: false,
          error: 'ROLLBACK_BLOCKED',
          message: preflight.blockers[0] || 'Rollback bloqué par les contrôles de compatibilité.',
          preflight
        });
      }

      const appInfo = db.apps[appId];
      const prevVersion = appInfo.currentVersion;
      const targetVer = preflight.targetVersion;
      const startMs = Date.now();
      const nowIso = new Date().toISOString();

      const steps: DeploymentStepLog[] = [
        {
          id: `stp-${crypto.randomUUID().slice(0, 6)}`,
          label: 'Contrôles de compatibilité pré-rollback',
          status: 'passed',
          at: nowIso,
          details: `Version cible v${targetVer.version} compatible (API ${targetVer.compatibility.apiVersion}, DB ${targetVer.compatibility.dbSchemaVersion}).`
        }
      ];

      appInfo.currentVersion = targetVer.version;
      appInfo.buildNumber = targetVer.buildNumber;
      appInfo.activeVersionId = targetVer.id;
      appInfo.lastDeployedAt = nowIso;
      appInfo.lastUpdateSummary = `Rollback vers v${targetVer.version} — ${reason}`;

      // Run real post-restore health verification
      const servicesAfter = await runAllServiceHealthChecks(req);
      const apiSvc = servicesAfter.find((s) => s.id === 'backend_api');
      const frontendSvc = servicesAfter.find((s) => s.id === `frontend_${appId}`);
      const dbSvc = servicesAfter.find((s) => s.id === 'database_json');
      const postOk =
        apiSvc?.status === 'operationnel' &&
        (frontendSvc?.status === 'operationnel' || frontendSvc?.status === 'maintenance') &&
        dbSvc?.status === 'operationnel';

      const doneIso = new Date().toISOString();
      steps.push({
        id: `stp-${crypto.randomUUID().slice(0, 6)}`,
        label: 'Restauration du manifeste & vérification post-restauration',
        status: postOk ? 'passed' : 'failed',
        at: doneIso,
        details: postOk
          ? `Santé vérifiée après restauration : API (${apiSvc?.responseTimeMs}ms), DB (${dbSvc?.responseTimeMs}ms)`
          : `Anomalie détectée après restauration (API=${apiSvc?.status}, Frontend=${frontendSvc?.status})`
      });

      const depRecord: DeploymentRecord = {
        id: `rbk-${crypto.randomUUID().slice(0, 10)}`,
        appId,
        appName: appInfo.name,
        versionId: targetVer.id,
        version: targetVer.version,
        previousVersion: prevVersion,
        buildNumber: targetVer.buildNumber,
        startedAt: nowIso,
        completedAt: doneIso,
        targetEnv: appInfo.environment,
        authorId: actor.id,
        authorName: actor.name,
        authorEmail: actor.email,
        status: postOk ? 'deployee' : 'echec',
        rolloutMode: 'standard',
        rolloutPercent: 100,
        deployChannel: 'local_runtime_manifest',
        durationMs: Date.now() - startMs,
        result: postOk
          ? `Rollback effectué et vérifié : v${prevVersion} → v${targetVer.version}`
          : `Rollback restauré mais vérification santé en échec`,
        errorsEncountered: postOk ? [] : ['Vérification post-restauration partielle'],
        steps,
        preValidatedBy: actor.name,
        preValidatedAt: nowIso,
        postVerifiedAt: doneIso,
        postVerificationPassed: Boolean(postOk),
        postVerificationSummary: steps[1].details,
        rollbackOfDeploymentId: appInfo.lastDeploymentId,
        isRollback: true
      };

      appInfo.lastDeploymentId = depRecord.id;
      appInfo.lastDeploymentResult = postOk ? 'reussi' : 'echec';
      db.deployments.unshift(depRecord);
      persistDb();

      recordMaintenanceAudit(req, authCtx, {
        actionType: 'rollback_executed',
        action: `Rollback exécuté sur ${appInfo.name} : v${prevVersion} → v${targetVer.version}`,
        target: `${appInfo.name} (${appInfo.environment})`,
        entityType: 'rollback',
        entityId: depRecord.id,
        result: postOk ? 'reussi' : 'echoue',
        severity: 'eleve',
        beforeValue: `v${prevVersion}`,
        afterValue: `v${targetVer.version}`,
        details: `Motif : ${reason} • ${steps[1].details}`
      });

      res.json({ success: postOk, deployment: depRecord, app: appInfo });
    }
  );

  // --------------------------------------------------------------------------
  // 8. TECHNICAL SETTINGS & GRANULAR PERMISSIONS (8 permissions)
  // --------------------------------------------------------------------------
  app.patch(
    '/api/maintenance/settings',
    requireMaintenanceAccess('modifyTechnicalSettings', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
      const actor = authCtx.staff!;
      const body = req.body || {};

      const prev = JSON.stringify(db.settings);
      if (typeof body.autoCheckEnabled === 'boolean') db.settings.autoCheckEnabled = body.autoCheckEnabled;
      if (typeof body.autoCheckIntervalSeconds === 'number') {
        db.settings.autoCheckIntervalSeconds = Math.max(30, Math.min(3600, body.autoCheckIntervalSeconds));
      }
      if (typeof body.postDeployVerificationTimeoutMs === 'number') {
        db.settings.postDeployVerificationTimeoutMs = Math.max(1500, Math.min(30000, body.postDeployVerificationTimeoutMs));
      }
      if (typeof body.progressiveRolloutSupportedForManifest === 'boolean') {
        db.settings.progressiveRolloutSupportedForManifest = body.progressiveRolloutSupportedForManifest;
      }
      if (typeof body.notifySuperAdminOnOutage === 'boolean') {
        db.settings.notifySuperAdminOnOutage = body.notifySuperAdminOnOutage;
      }
      if (typeof body.notifySuperAdminOnCriticalError === 'boolean') {
        db.settings.notifySuperAdminOnCriticalError = body.notifySuperAdminOnCriticalError;
      }
      if (typeof body.maxErrorRetentionCount === 'number') {
        db.settings.maxErrorRetentionCount = Math.max(50, Math.min(5000, body.maxErrorRetentionCount));
      }

      db.settings.updatedAt = new Date().toISOString();
      db.settings.updatedBy = actor.name;
      persistDb();

      recordMaintenanceAudit(req, authCtx, {
        actionType: 'maintenance_settings_updated',
        action: 'Paramètres techniques Maintenance & Versions modifiés',
        target: 'maintenance_db.json',
        entityType: 'technical_settings',
        severity: 'moyen',
        beforeValue: prev,
        afterValue: JSON.stringify(db.settings),
        details: `Paramètres techniques mis à jour par ${actor.name}`
      });

      res.json({ success: true, settings: db.settings });
    }
  );

  app.patch(
    '/api/maintenance/permissions/:staffId',
    requireMaintenanceAccess(undefined, { requireSuperAdmin: true, requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
      const actor = authCtx.staff!;
      const targetId = req.params.staffId;
      const targetMember = getSecurityStaffDirectory().find((s) => s.id === targetId);
      if (!targetMember) {
        return res.status(404).json({ success: false, error: 'Collaborateur introuvable' });
      }
      if (targetMember.role === 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'SUPER_ADMIN_IMMUTABLE',
          message: 'Les privilèges du Super Administrateur sont totaux et immuables.'
        });
      }
      if (targetMember.role === 'other_agent') {
        return res.status(403).json({
          success: false,
          error: 'NON_ADMIN_AGENT',
          message: 'Un agent non-administrateur ne peut pas recevoir de permissions maintenance.'
        });
      }

      const incoming = req.body?.permissions || {};
      const current = getEffectivePermissionsForStaff(targetId, targetMember.role);
      const nextPerms = { ...current };
      for (const k of ALL_MAINTENANCE_PERMISSIONS) {
        if (typeof incoming[k] === 'boolean') {
          nextPerms[k] = incoming[k];
        }
      }

      db.staffPermissions[targetId] = nextPerms;
      persistDb();

      recordMaintenanceAudit(req, authCtx, {
        actionType: 'maintenance_permissions_updated',
        action: `Permissions Maintenance mises à jour pour ${targetMember.name}`,
        target: `${targetMember.name} (${targetMember.email})`,
        entityType: 'staff_permissions',
        entityId: targetId,
        severity: 'eleve',
        beforeValue: JSON.stringify(current),
        afterValue: JSON.stringify(nextPerms),
        details: `Permissions Maintenance & Versions modifiées par Super Admin ${actor.name}`
      });

      res.json({
        success: true,
        permissionsDirectory: buildPermissionsDirectory()
      });
    }
  );
}

export function getMaintenanceTelemetrySnapshot() {
  reconcileMaintenanceWindows();
  const hasSyncService = db.services.some((s) => s.id === 'orders_deliveries_sync');
  if (!hasSyncService) {
    db.services.push({
      id: 'orders_deliveries_sync',
      name: 'Livraisons & synchronisation commandes',
      category: 'core',
      configHint: 'Endpoints /api/orders, /api/deliveries et /api/capabilities (contrôle lecture seule)',
      status: 'non_verifie',
      configured: true,
      lastCheckedAt: null,
      responseTimeMs: null,
      uptimePercent: null,
      totalChecks: 0,
      successfulChecks: 0,
      lastError: null,
      incidentHistory: []
    });
  }
  return {
    apps: db.apps,
    services: db.services,
    deployments: db.deployments.slice(0, 60),
    maintenances: db.maintenances.slice(0, 40),
    errors: db.errors.slice(0, 120),
    lastProbeAt: db.lastProbeAt,
    settings: db.settings
  };
}

