import type { Express, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { atomicWriteJsonFile } from './atomicFileStore';
import {
  authenticateSessionRequest,
  appendAuditEntry,
  getClientIp,
  getSecurityStaffDirectory,
  getSecurityTelemetrySnapshot,
  redactSensitiveText,
  verifyStepUpMfaForRequest,
  type AuthenticatedRequestContext
} from './securityModule';
import {
  getMaintenanceTelemetrySnapshot,
  runAllServiceHealthChecks
} from './maintenanceModule';
import type { DjassaAppId } from '../src/types/maintenance';
import type {
  AnomalySeverity,
  AnomalyStatus,
  AppSurveillanceCard,
  DetectedAnomalyRecord,
  RuntimeResourceSnapshot,
  ServiceSurveillanceRecord,
  SurveillancePermissionKey,
  SurveillanceSettings,
  SurveillanceStaffPermissionRow,
  SystemGlobalState,
  SystemIncidentHistoryEntry,
  SystemSurveillanceOverviewResponse,
  TechnicalAlertRecord,
  TechnicalLogEntry
} from '../src/types/systemSurveillance';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const SURVEILLANCE_DB_FILE = path.join(DATA_DIR, 'surveillance_db.json');

export const ALL_SURVEILLANCE_PERMISSIONS: SurveillancePermissionKey[] = [
  'viewSurveillance',
  'runManualChecks',
  'manageAnomalies',
  'modifySurveillanceSettings'
];

interface SurveillanceDatabase {
  anomalies: DetectedAnomalyRecord[];
  alerts: TechnicalAlertRecord[];
  incidents: SystemIncidentHistoryEntry[];
  settings: SurveillanceSettings;
  staffPermissions: Record<string, Record<SurveillancePermissionKey, boolean>>;
  lastCheckAt: string | null;
  checkHistory: Array<{
    id: string;
    at: string;
    triggeredBy: string;
    mode: 'auto' | 'manual';
    globalState: SystemGlobalState;
    avgMs: number | null;
  }>;
}

function buildDefaultSettings(): SurveillanceSettings {
  return {
    autoCheckEnabled: true,
    checkIntervalSeconds: 180,
    latencyWarnMs: 1200,
    latencyCriticalMs: 3000,
    errorSpikeThreshold: 5,
    memoryWarnPercent: 88,
    authFailureSpikeThreshold: 8,
    notifyOnCritical: true,
    notifyOnWarning: true,
    maxLogsRetention: 400,
    updatedAt: new Date().toISOString(),
    updatedBy: 'Système'
  };
}

function defaultPermissionsForRole(role: string): Record<SurveillancePermissionKey, boolean> {
  if (role === 'super_admin') {
    return {
      viewSurveillance: true,
      runManualChecks: true,
      manageAnomalies: true,
      modifySurveillanceSettings: true
    };
  }
  if (role === 'security_agent' || role === 'admin') {
    return {
      viewSurveillance: true,
      runManualChecks: true,
      manageAnomalies: role === 'admin',
      modifySurveillanceSettings: false
    };
  }
  return {
    viewSurveillance: false,
    runManualChecks: false,
    manageAnomalies: false,
    modifySurveillanceSettings: false
  };
}

function buildDefaultDb(): SurveillanceDatabase {
  return {
    anomalies: [],
    alerts: [],
    incidents: [],
    settings: buildDefaultSettings(),
    staffPermissions: {},
    lastCheckAt: null,
    checkHistory: []
  };
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadDb(): SurveillanceDatabase {
  ensureDataDir();
  if (!fs.existsSync(SURVEILLANCE_DB_FILE)) {
    const seeded = buildDefaultDb();
    try {
      fs.writeFileSync(SURVEILLANCE_DB_FILE, JSON.stringify(seeded, null, 2));
    } catch {
      // fallback in memory
    }
    return seeded;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(SURVEILLANCE_DB_FILE, 'utf8')) as Partial<SurveillanceDatabase>;
    return {
      anomalies: Array.isArray(parsed.anomalies) ? parsed.anomalies : [],
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
      incidents: Array.isArray(parsed.incidents) ? parsed.incidents : [],
      settings: { ...buildDefaultSettings(), ...(parsed.settings || {}) },
      staffPermissions: parsed.staffPermissions || {},
      lastCheckAt: parsed.lastCheckAt || null,
      checkHistory: Array.isArray(parsed.checkHistory) ? parsed.checkHistory : []
    };
  } catch {
    return buildDefaultDb();
  }
}

const survDb: SurveillanceDatabase = loadDb();

function persistSurvDb() {
  if (!atomicWriteJsonFile(SURVEILLANCE_DB_FILE, survDb, { context: 'SurveillanceModule' })) {
    console.error('[SurveillanceModule] Failed to persist surveillance_db.json');
  }
}

function strictRedact(input: string): string {
  if (!input) return '';
  return redactSensitiveText(String(input))
    .replace(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\b/g, '[JWT_REDACTED]')
    .replace(/(RODIUMAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|R2_SECRET_ACCESS_KEY|GENIUSPAY_API_KEY|GENIUSPAY_WEBHOOK_SECRET|FCM_SERVER_KEY|GOOGLE_MAPS_API_KEY|DJASSA_SECURITY_SECRET|password|mot_de_passe|otp|code_pin)\s*[:=]\s*([^\s&;,}]+)/gi, '$1=[REDACTED]')
    .slice(0, 900);
}

function getEffectivePermissionsForStaff(staffId: string, role: string): Record<SurveillancePermissionKey, boolean> {
  if (role === 'super_admin') return defaultPermissionsForRole('super_admin');
  if (role === 'other_agent') return defaultPermissionsForRole('other_agent');
  const stored = survDb.staffPermissions[staffId];
  const base = defaultPermissionsForRole(role);
  if (!stored) return base;
  return {
    viewSurveillance: typeof stored.viewSurveillance === 'boolean' ? stored.viewSurveillance : base.viewSurveillance,
    runManualChecks: typeof stored.runManualChecks === 'boolean' ? stored.runManualChecks : base.runManualChecks,
    manageAnomalies: typeof stored.manageAnomalies === 'boolean' ? stored.manageAnomalies : base.manageAnomalies,
    modifySurveillanceSettings:
      typeof stored.modifySurveillanceSettings === 'boolean'
        ? stored.modifySurveillanceSettings
        : base.modifySurveillanceSettings
  };
}

function buildPermissionsDirectory(): SurveillanceStaffPermissionRow[] {
  return getSecurityStaffDirectory().map((s) => ({
    staffId: s.id,
    name: s.name,
    email: s.email,
    role: s.role,
    active: s.active,
    permissions: getEffectivePermissionsForStaff(s.id, s.role)
  }));
}

function collectRuntimeResources(): RuntimeResourceSnapshot {
  const mem = process.memoryUsage();
  const totalSys = os.totalmem();
  const freeSys = os.freemem();
  const usedPercent = totalSys > 0 ? Math.round(((totalSys - freeSys) / totalSys) * 1000) / 10 : 0;
  return {
    collectedAt: new Date().toISOString(),
    rssMb: Math.round((mem.rss / (1024 * 1024)) * 10) / 10,
    heapUsedMb: Math.round((mem.heapUsed / (1024 * 1024)) * 10) / 10,
    heapTotalMb: Math.round((mem.heapTotal / (1024 * 1024)) * 10) / 10,
    systemMemUsedPercent: usedPercent,
    systemMemTotalMb: Math.round(totalSys / (1024 * 1024)),
    cpuCount: os.cpus().length || 1,
    loadAvg1m: Math.round((os.loadavg()[0] || 0) * 100) / 100,
    uptimeSeconds: Math.round(process.uptime()),
    nodeVersion: process.version
  };
}

function recordSurveillanceAudit(
  req: Request | null,
  authCtx: AuthenticatedRequestContext | null,
  payload: {
    actionType: string;
    action: string;
    target: string;
    entityType: string;
    entityId?: string;
    result: 'reussi' | 'echoue' | 'bloque';
    severity: 'information' | 'faible' | 'moyen' | 'eleve' | 'critique';
    beforeValue?: string | null;
    afterValue?: string | null;
    details: string;
    dedupKey?: string;
  }
) {
  const actor = authCtx?.staff;
  appendAuditEntry({
    actorId: actor?.id || 'system-surveillance',
    actorName: actor?.name || 'Surveillance Technique Système',
    actorAccountLabel: actor?.email || 'surveillance@djassa.ci',
    actorRole: actor?.role || 'system',
    space: 'admin',
    category: 'system_config',
    actionType: payload.actionType,
    action: payload.action,
    target: payload.target,
    targetType: 'system',
    entityType: payload.entityType,
    entityId: payload.entityId,
    result: payload.result,
    severity: payload.severity,
    device: authCtx?.session?.device || 'Server',
    os: authCtx?.session?.os || 'Linux',
    browser: authCtx?.session?.browser || 'Node.js',
    sessionId: authCtx?.session?.sessionId,
    beforeValue: payload.beforeValue || undefined,
    afterValue: payload.afterValue || undefined,
    details: strictRedact(payload.details),
    ipAddress: req ? getClientIp(req) : '127.0.0.1',
    dedupKey: payload.dedupKey
  });
}

function upsertAnomalyAndAlert(
  params: {
    serviceId: string;
    serviceName: string;
    appId: DjassaAppId | 'all';
    category: DetectedAnomalyRecord['category'];
    severity: AnomalySeverity;
    title: string;
    description: string;
    technicalCause: string | null;
    incidentType: SystemIncidentHistoryEntry['type'];
  },
  req?: Request | null
) {
  const nowIso = new Date().toISOString();
  const dedupKey = `anomaly:${params.serviceId}:${params.category}`;

  // Look for an active (non-resolved) anomaly with same service + category
  const existing = survDb.anomalies.find(
    (a) =>
      a.serviceId === params.serviceId &&
      a.category === params.category &&
      a.status !== 'resolue'
  );

  if (existing) {
    const prevSeverity = existing.severity;
    existing.updatedAt = nowIso;
    existing.occurrenceCount += 1;
    existing.description = strictRedact(params.description);
    existing.technicalCause = params.technicalCause ? strictRedact(params.technicalCause) : existing.technicalCause;
    if (params.severity === 'critique' && prevSeverity !== 'critique') {
      existing.severity = 'critique';
    }

    // Update deduplicated alert without spamming notifications
    const alert = survDb.alerts.find((al) => al.dedupKey === dedupKey && al.status !== 'resolue');
    if (alert) {
      alert.updatedAt = nowIso;
      alert.occurrenceCount += 1;
      alert.severity = existing.severity;
      alert.description = existing.description;
      if (params.severity === 'critique' && prevSeverity !== 'critique' && survDb.settings.notifyOnCritical) {
        recordSurveillanceAudit(req || null, null, {
          actionType: 'surveillance_anomaly_critical',
          action: `Anomalie passée en CRITIQUE : ${params.title}`,
          target: params.serviceName,
          entityType: 'system_anomaly',
          entityId: existing.id,
          result: 'echoue',
          severity: 'critique',
          details: `${params.description} (Occurrences : ${existing.occurrenceCount})`,
          dedupKey: `crit:${dedupKey}:${nowIso.slice(0, 13)}`
        });
      }
    }
    return;
  }

  const anomalyId = `anom-${crypto.randomUUID().slice(0, 10)}`;
  const alertId = `talrt-${crypto.randomUUID().slice(0, 10)}`;
  const incidentId = `sinc-${crypto.randomUUID().slice(0, 10)}`;

  const newAlert: TechnicalAlertRecord = {
    id: alertId,
    dedupKey,
    createdAt: nowIso,
    updatedAt: nowIso,
    severity: params.severity,
    serviceId: params.serviceId,
    serviceName: params.serviceName,
    appId: params.appId,
    title: params.title,
    description: strictRedact(params.description),
    status: 'ouverte',
    occurrenceCount: 1,
    acknowledgedBy: null,
    acknowledgedAt: null,
    linkedAnomalyId: anomalyId
  };

  const newAnomaly: DetectedAnomalyRecord = {
    id: anomalyId,
    detectedAt: nowIso,
    updatedAt: nowIso,
    appId: params.appId,
    serviceId: params.serviceId,
    serviceName: params.serviceName,
    severity: params.severity,
    category: params.category,
    title: params.title,
    description: strictRedact(params.description),
    technicalCause: params.technicalCause ? strictRedact(params.technicalCause) : null,
    status: 'nouvelle',
    assignedToId: null,
    assignedToName: null,
    linkedAlertId: alertId,
    occurrenceCount: 1,
    history: [
      {
        id: `ah-${crypto.randomUUID().slice(0, 8)}`,
        at: nowIso,
        actorId: 'system-surveillance',
        actorName: 'Détecteur automatique',
        action: 'Anomalie détectée lors du contrôle technique',
        statusAfter: 'nouvelle',
        comment: strictRedact(params.description)
      }
    ]
  };

  const newIncident: SystemIncidentHistoryEntry = {
    id: incidentId,
    at: nowIso,
    resolvedAt: null,
    serviceId: params.serviceId,
    serviceName: params.serviceName,
    appId: params.appId,
    type: params.incidentType,
    severity: params.severity,
    title: params.title,
    details: strictRedact(params.description),
    status: 'ouvert',
    durationSeconds: null
  };

  survDb.anomalies.unshift(newAnomaly);
  survDb.alerts.unshift(newAlert);
  survDb.incidents.unshift(newIncident);

  if (survDb.anomalies.length > 250) survDb.anomalies = survDb.anomalies.slice(0, 250);
  if (survDb.alerts.length > 250) survDb.alerts = survDb.alerts.slice(0, 250);
  if (survDb.incidents.length > 300) survDb.incidents = survDb.incidents.slice(0, 300);

  // Dispatch deduplicated notification via Security Notification Center
  if (
    (params.severity === 'critique' && survDb.settings.notifyOnCritical) ||
    (params.severity === 'avertissement' && survDb.settings.notifyOnWarning)
  ) {
    recordSurveillanceAudit(req || null, null, {
      actionType: params.severity === 'critique' ? 'surveillance_anomaly_critical' : 'surveillance_anomaly_warning',
      action: `${params.severity === 'critique' ? 'Alerte critique' : 'Avertissement'} système : ${params.title}`,
      target: params.serviceName,
      entityType: 'system_anomaly',
      entityId: anomalyId,
      result: params.severity === 'critique' ? 'echoue' : 'reussi',
      severity: params.severity === 'critique' ? 'critique' : 'eleve',
      details: strictRedact(params.description),
      dedupKey: `${dedupKey}:${nowIso.slice(0, 13)}`
    });
  }
}

function autoResolveIfHealthy(serviceId: string, category: DetectedAnomalyRecord['category']) {
  const nowIso = new Date().toISOString();
  const active = survDb.anomalies.filter(
    (a) => a.serviceId === serviceId && a.category === category && (a.status === 'nouvelle' || a.status === 'non_resolue')
  );
  for (const a of active) {
    a.status = 'resolue';
    a.updatedAt = nowIso;
    a.history.unshift({
      id: `ah-${crypto.randomUUID().slice(0, 8)}`,
      at: nowIso,
      actorId: 'system-surveillance',
      actorName: 'Contrôle automatique',
      action: 'Rétablissement confirmé par les sondes techniques',
      statusAfter: 'resolue',
      comment: `Le service ${a.serviceName} répond normalement.`
    });
    if (a.linkedAlertId) {
      const al = survDb.alerts.find((x) => x.id === a.linkedAlertId);
      if (al && al.status !== 'resolue') {
        al.status = 'resolue';
        al.updatedAt = nowIso;
      }
    }
    const openInc = survDb.incidents.find(
      (inc) => inc.serviceId === serviceId && inc.status === 'ouvert'
    );
    if (openInc) {
      openInc.status = 'resolu';
      openInc.resolvedAt = nowIso;
      openInc.durationSeconds = Math.max(
        1,
        Math.round((new Date(nowIso).getTime() - new Date(openInc.at).getTime()) / 1000)
      );
      survDb.incidents.unshift({
        id: `sinc-${crypto.randomUUID().slice(0, 10)}`,
        at: nowIso,
        resolvedAt: nowIso,
        serviceId: a.serviceId,
        serviceName: a.serviceName,
        appId: a.appId,
        type: 'reprise',
        severity: 'information',
        title: `Reprise confirmée : ${a.serviceName}`,
        details: `Service redevenu opérationnel après ${openInc.durationSeconds}s d'interruption/dégradation.`,
        status: 'resolu',
        durationSeconds: openInc.durationSeconds
      });
    }
  }
}

function evaluateRealTelemetryAndDetectAnomalies(
  resources: RuntimeResourceSnapshot,
  req?: Request | null
) {
  const maintSnap = getMaintenanceTelemetrySnapshot();
  const secSnap = getSecurityTelemetrySnapshot();
  const s = survDb.settings;

  // 1. Evaluate probed services
  for (const svc of maintSnap.services) {
    const appId: DjassaAppId | 'all' = svc.id.startsWith('frontend_')
      ? (svc.id.replace('frontend_', '') as DjassaAppId)
      : 'all';

    if (svc.status === 'indisponible') {
      const cat: DetectedAnomalyRecord['category'] =
        svc.id === 'backend_api'
          ? 'api_unreachable'
          : svc.id === 'database_json' || svc.id === 'supabase_db'
          ? 'db_unavailable'
          : svc.id === 'geniuspay_payments'
          ? 'payment_failure'
          : svc.id === 'push_notifications'
          ? 'notification_failure'
          : svc.id === 'cloudflare_r2'
          ? 'storage_upload'
          : svc.id === 'google_maps'
          ? 'geolocation'
          : svc.id === 'orders_deliveries_sync'
          ? 'orders_sync'
          : 'api_unreachable';

      upsertAnomalyAndAlert(
        {
          serviceId: svc.id,
          serviceName: svc.name,
          appId,
          category: cat,
          severity: 'critique',
          title: `Indisponibilité : ${svc.name}`,
          description: svc.lastError || `Le contrôle technique a détecté que ${svc.name} est indisponible.`,
          technicalCause: svc.lastError,
          incidentType: svc.id === 'geniuspay_payments' ? 'paiement' : svc.id === 'orders_deliveries_sync' ? 'sync' : 'panne'
        },
        req
      );
    } else if (svc.status === 'degrade') {
      upsertAnomalyAndAlert(
        {
          serviceId: svc.id,
          serviceName: svc.name,
          appId,
          category: 'high_latency',
          severity: 'avertissement',
          title: `Performance dégradée : ${svc.name}`,
          description: svc.lastError || `${svc.name} fonctionne en mode dégradé.`,
          technicalCause: svc.lastError,
          incidentType: 'degradation'
        },
        req
      );
    } else if (svc.status === 'operationnel') {
      autoResolveIfHealthy(svc.id, 'api_unreachable');
      autoResolveIfHealthy(svc.id, 'db_unavailable');
      autoResolveIfHealthy(svc.id, 'payment_failure');
      autoResolveIfHealthy(svc.id, 'orders_sync');
      autoResolveIfHealthy(svc.id, 'notification_failure');
      autoResolveIfHealthy(svc.id, 'storage_upload');
      autoResolveIfHealthy(svc.id, 'geolocation');
      autoResolveIfHealthy(svc.id, 'high_latency');
    }

    // Abnormal latency check even if HTTP returned 200
    if (svc.responseTimeMs !== null && svc.responseTimeMs >= s.latencyWarnMs) {
      const isCrit = svc.responseTimeMs >= s.latencyCriticalMs;
      upsertAnomalyAndAlert(
        {
          serviceId: svc.id,
          serviceName: svc.name,
          appId,
          category: 'high_latency',
          severity: isCrit ? 'critique' : 'avertissement',
          title: `Latence anormale sur ${svc.name} (${svc.responseTimeMs} ms)`,
          description: `Temps de réponse mesuré à ${svc.responseTimeMs} ms (seuil alerte : ${s.latencyWarnMs} ms).`,
          technicalCause: `HTTP latency=${svc.responseTimeMs}ms`,
          incidentType: 'latence'
        },
        req
      );
    }
  }

  // 2. Recent technical errors spike check (last 2h)
  const twoHoursAgo = Date.now() - 2 * 3600_000;
  const openRecentErrors = maintSnap.errors.filter(
    (e) => e.status !== 'resolue' && e.status !== 'ignoree' && new Date(e.timestamp).getTime() >= twoHoursAgo
  );
  if (openRecentErrors.length >= s.errorSpikeThreshold) {
    upsertAnomalyAndAlert(
      {
        serviceId: 'backend_api',
        serviceName: 'Backend & API Express',
        appId: 'all',
        category: 'error_spike',
        severity: openRecentErrors.some((e) => e.severity === 'critique') ? 'critique' : 'avertissement',
        title: `Pic d’erreurs techniques (${openRecentErrors.length} erreurs ouvertes)`,
        description: `${openRecentErrors.length} erreurs techniques récentes non résolues dépassent le seuil configuré (${s.errorSpikeThreshold}).`,
        technicalCause: openRecentErrors[0]?.description || null,
        incidentType: 'erreur_api'
      },
      req
    );
  } else if (openRecentErrors.length === 0) {
    autoResolveIfHealthy('backend_api', 'error_spike');
  }

  // 3. Recent failed deployment check (last 24h)
  const dayAgo = Date.now() - 86400_000;
  const failedDeploy = maintSnap.deployments.find(
    (d) => d.status === 'echec' && new Date(d.startedAt).getTime() >= dayAgo
  );
  if (failedDeploy) {
    upsertAnomalyAndAlert(
      {
        serviceId: `frontend_${failedDeploy.appId}`,
        serviceName: failedDeploy.appName,
        appId: failedDeploy.appId,
        category: 'deployment_failure',
        severity: 'critique',
        title: `Échec de déploiement récent : ${failedDeploy.appName} v${failedDeploy.version}`,
        description: failedDeploy.result || `Le déploiement ${failedDeploy.id} a échoué.`,
        technicalCause: failedDeploy.errorsEncountered[0] || null,
        incidentType: 'degradation'
      },
      req
    );
  }

  // 4. Auth failures spike from real security logs
  if (secSnap.recentFailedLogins >= s.authFailureSpikeThreshold || secSnap.openIntrusions > 0) {
    upsertAnomalyAndAlert(
      {
        serviceId: 'auth_engine',
        serviceName: 'Authentification & Sessions HMAC',
        appId: 'all',
        category: 'auth_failures',
        severity: secSnap.openIntrusions > 0 ? 'critique' : 'avertissement',
        title: `Anomalie d’authentification (${secSnap.recentFailedLogins} échecs 24h)`,
        description: `${secSnap.recentFailedLogins} tentatives échouées sur 24h et ${secSnap.openIntrusions} intrusion(s) ouverte(s).`,
        technicalCause: `FailedLogins24h=${secSnap.recentFailedLogins}, OpenIntrusions=${secSnap.openIntrusions}`,
        incidentType: 'connexion'
      },
      req
    );
  } else {
    autoResolveIfHealthy('auth_engine', 'auth_failures');
  }

  // 5. Resource overload check (real Node RSS / system RAM)
  if (resources.systemMemUsedPercent >= s.memoryWarnPercent) {
    upsertAnomalyAndAlert(
      {
        serviceId: 'backend_api',
        serviceName: 'Ressources Serveur Node.js',
        appId: 'all',
        category: 'resource_overload',
        severity: resources.systemMemUsedPercent >= 95 ? 'critique' : 'avertissement',
        title: `Utilisation mémoire élevée (${resources.systemMemUsedPercent}%)`,
        description: `Mémoire système à ${resources.systemMemUsedPercent}% (Process RSS : ${resources.rssMb} Mo).`,
        technicalCause: `RAM=${resources.systemMemUsedPercent}%, Heap=${resources.heapUsedMb}/${resources.heapTotalMb}MB`,
        incidentType: 'degradation'
      },
      req
    );
  } else {
    autoResolveIfHealthy('backend_api', 'resource_overload');
  }

  persistSurvDb();
}

function buildCombinedTechnicalLogs(filters?: {
  appId?: string;
  serviceId?: string;
  severity?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
}): TechnicalLogEntry[] {
  const maintSnap = getMaintenanceTelemetrySnapshot();
  const secSnap = getSecurityTelemetrySnapshot();
  const logs: TechnicalLogEntry[] = [];

  for (const err of maintSnap.errors) {
    logs.push({
      id: `log-err-${err.id}`,
      timestamp: err.timestamp,
      appId: err.appId,
      serviceId: err.serviceId,
      serviceName: err.serviceName,
      severity:
        err.severity === 'critique'
          ? 'critique'
          : err.severity === 'eleve' || err.severity === 'moyen'
          ? 'avertissement'
          : 'information',
      status: err.status === 'resolue' ? 'ok' : err.severity === 'critique' ? 'critique' : 'erreur',
      source: 'runtime_error',
      message: strictRedact(err.description),
      redactedDetails: strictRedact(err.redactedLog || err.description)
    });
  }

  for (const chk of survDb.checkHistory.slice(0, 40)) {
    logs.push({
      id: `log-chk-${chk.id}`,
      timestamp: chk.at,
      appId: 'all',
      serviceId: 'backend_api',
      serviceName: 'Contrôle santé système',
      severity: chk.globalState === 'en_panne' ? 'critique' : chk.globalState === 'degrade' ? 'avertissement' : 'information',
      status: chk.globalState === 'en_panne' ? 'critique' : chk.globalState === 'degrade' ? 'degrade' : 'ok',
      source: 'health_probe',
      message: `Vérification ${chk.mode === 'manual' ? 'manuelle' : 'automatique'} par ${chk.triggeredBy} → ${chk.globalState}`,
      redactedDetails: `Temps moyen mesuré : ${chk.avgMs !== null ? `${chk.avgMs} ms` : 'N/A'}`
    });
  }

  for (const audit of secSnap.auditLogs.slice(0, 80)) {
    if (
      audit.category === 'system_config' ||
      audit.category === 'security' ||
      audit.result !== 'reussi'
    ) {
      logs.push({
        id: `log-aud-${audit.id}`,
        timestamp: audit.timestamp,
        appId: 'admin',
        serviceId: audit.category === 'security' ? 'auth_engine' : 'backend_api',
        serviceName: audit.target || 'Plateforme DJASSA',
        severity:
          audit.severity === 'critique'
            ? 'critique'
            : audit.severity === 'eleve' || audit.severity === 'moyen'
            ? 'avertissement'
            : 'information',
        status: audit.result === 'reussi' ? 'ok' : audit.severity === 'critique' ? 'critique' : 'erreur',
        source: audit.category === 'security' ? 'security_auth' : 'deployment',
        message: strictRedact(audit.action),
        redactedDetails: strictRedact(audit.details || `${audit.actorName} (${audit.result})`)
      });
    }
  }

  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  let filtered = logs;
  if (filters?.appId && filters.appId !== 'all_filter') {
    filtered = filtered.filter((l) => l.appId === filters.appId);
  }
  if (filters?.serviceId && filters.serviceId !== 'all') {
    filtered = filtered.filter((l) => l.serviceId === filters.serviceId);
  }
  if (filters?.severity && filters.severity !== 'all') {
    filtered = filtered.filter((l) => l.severity === filters.severity);
  }
  if (filters?.status && filters.status !== 'all') {
    filtered = filtered.filter((l) => l.status === filters.status);
  }
  if (filters?.dateFrom) {
    const fromMs = new Date(filters.dateFrom).getTime();
    if (!Number.isNaN(fromMs)) filtered = filtered.filter((l) => new Date(l.timestamp).getTime() >= fromMs);
  }
  if (filters?.dateTo) {
    const toMs = new Date(filters.dateTo).getTime() + 86400_000;
    if (!Number.isNaN(toMs)) filtered = filtered.filter((l) => new Date(l.timestamp).getTime() <= toMs);
  }
  if (filters?.q) {
    const q = filters.q.toLowerCase();
    filtered = filtered.filter(
      (l) =>
        l.message.toLowerCase().includes(q) ||
        l.serviceName.toLowerCase().includes(q) ||
        l.redactedDetails.toLowerCase().includes(q)
    );
  }

  return filtered.slice(0, survDb.settings.maxLogsRetention);
}

function buildOverviewResponse(authCtx: AuthenticatedRequestContext): SystemSurveillanceOverviewResponse {
  const actor = authCtx.staff!;
  const maintSnap = getMaintenanceTelemetrySnapshot();
  const resources = collectRuntimeResources();

  const serviceRecords: ServiceSurveillanceRecord[] = maintSnap.services.map((svc) => {
    const errCount = maintSnap.errors.filter(
      (e) => e.serviceId === svc.id && e.status !== 'resolue' && e.status !== 'ignoree'
    ).length;
    const lastOutage = svc.incidentHistory.find((h) => h.newStatus === 'indisponible')?.at || null;
    return {
      id: svc.id,
      name: svc.name,
      category: svc.category,
      status: svc.status,
      configured: svc.configured,
      availabilityPercent: svc.lastCheckedAt ? svc.uptimePercent : null,
      responseTimeMs: svc.lastCheckedAt ? svc.responseTimeMs : null,
      lastCheckedAt: svc.lastCheckedAt,
      errorCount: errCount,
      errorMessage: svc.lastError ? strictRedact(svc.lastError) : null,
      lastKnownOutageAt: lastOutage,
      configHint: svc.configHint
    };
  });

  // Independent 3 Apps monitoring
  const appIds: DjassaAppId[] = ['client', 'seller', 'admin'];
  const apps: AppSurveillanceCard[] = appIds.map((appId) => {
    const info = maintSnap.apps[appId];
    const frontendSvc = serviceRecords.find((s) => s.id === `frontend_${appId}`);
    const appErrors = maintSnap.errors.filter(
      (e) => e.appId === appId && e.status !== 'resolue' && e.status !== 'ignoree'
    );
    const appAnomaly = survDb.anomalies.find(
      (a) => a.appId === appId && a.status !== 'resolue'
    );

    let appState: AppSurveillanceCard['status'] = 'non_verifie';
    if (frontendSvc) {
      if (frontendSvc.status === 'maintenance') appState = 'maintenance';
      else if (frontendSvc.status === 'indisponible') appState = 'en_panne';
      else if (frontendSvc.status === 'degrade') appState = 'degrade';
      else if (frontendSvc.status === 'operationnel') appState = 'operationnel';
      else appState = 'non_verifie';
    }

    return {
      appId,
      name: info.name,
      shortName: info.shortName,
      status: appState,
      availabilityPercent: frontendSvc?.availabilityPercent ?? null,
      responseTimeMs: frontendSvc?.responseTimeMs ?? null,
      errorCount: appErrors.length,
      lastCheckedAt: frontendSvc?.lastCheckedAt ?? null,
      deployedVersion: info.currentVersion || null,
      buildNumber: info.buildNumber || null,
      environment: info.environment,
      lastAnomalyDetected: appAnomaly ? appAnomaly.title : appErrors[0]?.description || null
    };
  });

  // Calculate strict honest KPIs (never invent uptime for unverified services)
  const checkedConfiguredServices = serviceRecords.filter(
    (s) => s.lastCheckedAt !== null && s.status !== 'non_verifie'
  );
  const operationalCount = serviceRecords.filter((s) => s.status === 'operationnel').length;
  const degradedCount = serviceRecords.filter((s) => s.status === 'degrade').length;
  const unavailableCount = serviceRecords.filter((s) => s.status === 'indisponible').length;
  const unverifiedCount = serviceRecords.filter((s) => s.status === 'non_verifie').length;

  const uptimeVals = checkedConfiguredServices
    .map((s) => s.availabilityPercent)
    .filter((v): v is number => typeof v === 'number');
  const globalAvailabilityPercent =
    uptimeVals.length > 0
      ? Math.round((uptimeVals.reduce((a, b) => a + b, 0) / uptimeVals.length) * 10) / 10
      : null;

  const responseVals = checkedConfiguredServices
    .map((s) => s.responseTimeMs)
    .filter((v): v is number => typeof v === 'number');
  const averageResponseTimeMs =
    responseVals.length > 0
      ? Math.round(responseVals.reduce((a, b) => a + b, 0) / responseVals.length)
      : null;

  const recentErrorsCount = maintSnap.errors.filter(
    (e) => e.status !== 'resolue' && e.status !== 'ignoree'
  ).length;

  // Determine overall system state honestly: core unavailability => en_panne; non-core unavailability or degradation => degrade; no checks => non_verifie
  const coreDown = serviceRecords.some(
    (s) => (s.id === 'backend_api' || s.id === 'database_json' || s.id === 'auth_engine') && s.status === 'indisponible'
  );
  let globalState: SystemGlobalState = 'non_verifie';
  if (checkedConfiguredServices.length === 0) {
    globalState = 'non_verifie';
  } else if (coreDown || unavailableCount >= 2) {
    globalState = 'en_panne';
  } else if (unavailableCount > 0 || degradedCount > 0) {
    globalState = 'degrade';
  } else {
    globalState = 'operationnel';
  }

  return {
    success: true,
    serverTime: new Date().toISOString(),
    kpis: {
      globalState,
      globalAvailabilityPercent,
      operationalServicesCount: operationalCount,
      degradedServicesCount: degradedCount,
      unavailableServicesCount: unavailableCount,
      unverifiedServicesCount: unverifiedCount,
      recentErrorsCount,
      averageResponseTimeMs,
      lastSystemCheckAt: survDb.lastCheckAt || maintSnap.lastProbeAt,
      openAnomaliesCount: survDb.anomalies.filter((a) => a.status !== 'resolue').length,
      openAlertsCount: survDb.alerts.filter((a) => a.status === 'ouverte').length
    },
    apps,
    services: serviceRecords,
    anomalies: survDb.anomalies.slice(0, 120),
    alerts: survDb.alerts.slice(0, 100),
    logs: buildCombinedTechnicalLogs().slice(0, 120),
    incidents: survDb.incidents.slice(0, 150),
    resources,
    settings: survDb.settings,
    myPermissions: getEffectivePermissionsForStaff(actor.id, actor.role),
    permissionsDirectory: buildPermissionsDirectory(),
    myRole: actor.role
  };
}

async function performFullRealCheck(triggeredBy: string, mode: 'auto' | 'manual', req?: Request | null) {
  await runAllServiceHealthChecks(req);
  const resources = collectRuntimeResources();
  evaluateRealTelemetryAndDetectAnomalies(resources, req);

  const maintSnap = getMaintenanceTelemetrySnapshot();
  const checked = maintSnap.services.filter((s) => s.lastCheckedAt && s.status !== 'non_verifie');
  const times = checked.map((s) => s.responseTimeMs).filter((x): x is number => typeof x === 'number');
  const avgMs = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;

  const coreDown = maintSnap.services.some(
    (s) => (s.id === 'backend_api' || s.id === 'database_json') && s.status === 'indisponible'
  );
  const anyIssue = maintSnap.services.some((s) => s.status === 'degrade' || s.status === 'indisponible');
  const globalState: SystemGlobalState = coreDown ? 'en_panne' : anyIssue ? 'degrade' : 'operationnel';

  const nowIso = new Date().toISOString();
  survDb.lastCheckAt = nowIso;
  survDb.checkHistory.unshift({
    id: crypto.randomUUID().slice(0, 8),
    at: nowIso,
    triggeredBy,
    mode,
    globalState,
    avgMs
  });
  if (survDb.checkHistory.length > 80) {
    survDb.checkHistory = survDb.checkHistory.slice(0, 80);
  }
  persistSurvDb();
}

function requireSurveillanceAccess(
  perm?: SurveillancePermissionKey,
  options?: { requireSuperAdmin?: boolean; requireStepUpMfa?: boolean }
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const staff = authCtx.staff;
    if (!staff || !staff.active || staff.role === 'other_agent') {
      return res.status(403).json({
        success: false,
        error: 'ACCESS_DENIED',
        message: 'Accès réservé au personnel administrateur autorisé.'
      });
    }
    if (options?.requireSuperAdmin && staff.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'SUPER_ADMIN_REQUIRED',
        message: 'Opération réservée au Super Administrateur.'
      });
    }
    if (perm) {
      const effective = getEffectivePermissionsForStaff(staff.id, staff.role);
      if (!effective[perm]) {
        return res.status(403).json({
          success: false,
          error: 'PERMISSION_DENIED',
          message: `Permission requise : ${perm}.`
        });
      }
    }
    if (options?.requireStepUpMfa) {
      const mfaCheck = verifyStepUpMfaForRequest(req, authCtx, true);
      if (!mfaCheck.ok) {
        return res.status(mfaCheck.status).json({
          success: false,
          error: mfaCheck.error,
          message: mfaCheck.message
        });
      }
    }
    (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx = authCtx;
    next();
  };
}

let schedulerStarted = false;

export function installSystemSurveillanceRoutes(app: Express) {
  if (!schedulerStarted) {
    schedulerStarted = true;
    // Initial honest probe 4 seconds after server starts (non-blocking)
    setTimeout(() => {
      void performFullRealCheck('Sonde initiale serveur', 'auto', null).catch(() => {});
    }, 4000);

    // Recurring lightweight health check obeying configured frequency (min 60s)
    setInterval(() => {
      if (!survDb.settings.autoCheckEnabled) return;
      const lastMs = survDb.lastCheckAt ? new Date(survDb.lastCheckAt).getTime() : 0;
      const intervalMs = Math.max(60, survDb.settings.checkIntervalSeconds) * 1000;
      if (Date.now() - lastMs >= intervalMs) {
        void performFullRealCheck('Planificateur automatique', 'auto', null).catch(() => {});
      }
    }, 30_000);
  }

  app.get(
    '/api/surveillance/overview',
    requireSurveillanceAccess('viewSurveillance'),
    async (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
      if (req.query.probe === '1') {
        const eff = getEffectivePermissionsForStaff(authCtx.staff!.id, authCtx.staff!.role);
        if (eff.runManualChecks) {
          await performFullRealCheck(authCtx.staff!.name, 'manual', req);
        }
      } else {
        evaluateRealTelemetryAndDetectAnomalies(collectRuntimeResources(), req);
      }
      res.json(buildOverviewResponse(authCtx));
    }
  );

  app.post(
    '/api/surveillance/check',
    requireSurveillanceAccess('runManualChecks'),
    async (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
      const actor = authCtx.staff!;
      await performFullRealCheck(actor.name, 'manual', req);

      recordSurveillanceAudit(req, authCtx, {
        actionType: 'surveillance_manual_check',
        action: 'Vérification complète de disponibilité technique exécutée',
        target: 'Plateforme DJASSA',
        entityType: 'system_health',
        result: 'reussi',
        severity: 'information',
        details: `Contrôle en direct déclenché par ${actor.name}`
      });

      res.json(buildOverviewResponse(authCtx));
    }
  );

  app.patch(
    '/api/surveillance/anomalies/:id',
    requireSurveillanceAccess('manageAnomalies'),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
      const actor = authCtx.staff!;
      const anomaly = survDb.anomalies.find((a) => a.id === req.params.id);
      if (!anomaly) {
        return res.status(404).json({ success: false, error: 'Anomalie introuvable.' });
      }

      const nextStatus = req.body?.status as AnomalyStatus | undefined;
      const comment = strictRedact(String(req.body?.comment || '').trim());
      const nowIso = new Date().toISOString();
      const prevStatus = anomaly.status;

      if (nextStatus && ['nouvelle', 'en_cours', 'resolue', 'non_resolue'].includes(nextStatus)) {
        anomaly.status = nextStatus;
      }
      if (req.body?.takeOwnership || anomaly.status === 'en_cours') {
        anomaly.assignedToId = actor.id;
        anomaly.assignedToName = actor.name;
      }
      anomaly.updatedAt = nowIso;
      anomaly.history.unshift({
        id: `ah-${crypto.randomUUID().slice(0, 8)}`,
        at: nowIso,
        actorId: actor.id,
        actorName: actor.name,
        action: nextStatus ? `Statut modifié : ${prevStatus} → ${anomaly.status}` : 'Commentaire d’intervention ajouté',
        statusAfter: anomaly.status,
        comment: comment || `Intervention enregistrée par ${actor.name}`
      });

      if (anomaly.status === 'resolue' && anomaly.linkedAlertId) {
        const alert = survDb.alerts.find((al) => al.id === anomaly.linkedAlertId);
        if (alert) {
          alert.status = 'resolue';
          alert.updatedAt = nowIso;
        }
        const openInc = survDb.incidents.find(
          (inc) => inc.serviceId === anomaly.serviceId && inc.status === 'ouvert'
        );
        if (openInc) {
          openInc.status = 'resolu';
          openInc.resolvedAt = nowIso;
          openInc.durationSeconds = Math.max(
            1,
            Math.round((new Date(nowIso).getTime() - new Date(openInc.at).getTime()) / 1000)
          );
        }
      }

      persistSurvDb();

      recordSurveillanceAudit(req, authCtx, {
        actionType: 'surveillance_anomaly_updated',
        action: `Anomalie ${anomaly.id} mise à jour (${anomaly.status})`,
        target: anomaly.serviceName,
        entityType: 'system_anomaly',
        entityId: anomaly.id,
        result: 'reussi',
        severity: 'moyen',
        beforeValue: prevStatus,
        afterValue: anomaly.status,
        details: comment || anomaly.title
      });

      res.json({ success: true, anomaly });
    }
  );

  app.post(
    '/api/surveillance/alerts/:id/ack',
    requireSurveillanceAccess('manageAnomalies'),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
      const actor = authCtx.staff!;
      const alert = survDb.alerts.find((al) => al.id === req.params.id);
      if (!alert) {
        return res.status(404).json({ success: false, error: 'Alerte technique introuvable.' });
      }
      const nowIso = new Date().toISOString();
      alert.status = 'acquittee';
      alert.acknowledgedBy = actor.name;
      alert.acknowledgedAt = nowIso;
      alert.updatedAt = nowIso;
      persistSurvDb();

      recordSurveillanceAudit(req, authCtx, {
        actionType: 'surveillance_alert_acked',
        action: `Alerte technique acquittée : ${alert.title}`,
        target: alert.serviceName,
        entityType: 'system_alert',
        entityId: alert.id,
        result: 'reussi',
        severity: 'information',
        details: `Acquittée par ${actor.name}`
      });

      res.json({ success: true, alert });
    }
  );

  app.get(
    '/api/surveillance/logs',
    requireSurveillanceAccess('viewSurveillance'),
    (req: Request, res: Response) => {
      const logs = buildCombinedTechnicalLogs({
        appId: req.query.appId as string | undefined,
        serviceId: req.query.serviceId as string | undefined,
        severity: req.query.severity as string | undefined,
        status: req.query.status as string | undefined,
        dateFrom: req.query.dateFrom as string | undefined,
        dateTo: req.query.dateTo as string | undefined,
        q: req.query.q as string | undefined
      });
      res.json({ success: true, logs });
    }
  );

  app.patch(
    '/api/surveillance/settings',
    requireSurveillanceAccess('modifySurveillanceSettings', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
      const actor = authCtx.staff!;
      const body = req.body || {};
      const prev = JSON.stringify(survDb.settings);

      if (typeof body.autoCheckEnabled === 'boolean') survDb.settings.autoCheckEnabled = body.autoCheckEnabled;
      if (typeof body.checkIntervalSeconds === 'number') {
        survDb.settings.checkIntervalSeconds = Math.max(60, Math.min(3600, body.checkIntervalSeconds));
      }
      if (typeof body.latencyWarnMs === 'number') {
        survDb.settings.latencyWarnMs = Math.max(300, Math.min(10000, body.latencyWarnMs));
      }
      if (typeof body.latencyCriticalMs === 'number') {
        survDb.settings.latencyCriticalMs = Math.max(survDb.settings.latencyWarnMs + 200, Math.min(15000, body.latencyCriticalMs));
      }
      if (typeof body.errorSpikeThreshold === 'number') {
        survDb.settings.errorSpikeThreshold = Math.max(2, Math.min(100, body.errorSpikeThreshold));
      }
      if (typeof body.memoryWarnPercent === 'number') {
        survDb.settings.memoryWarnPercent = Math.max(60, Math.min(98, body.memoryWarnPercent));
      }
      if (typeof body.authFailureSpikeThreshold === 'number') {
        survDb.settings.authFailureSpikeThreshold = Math.max(3, Math.min(200, body.authFailureSpikeThreshold));
      }
      if (typeof body.notifyOnCritical === 'boolean') survDb.settings.notifyOnCritical = body.notifyOnCritical;
      if (typeof body.notifyOnWarning === 'boolean') survDb.settings.notifyOnWarning = body.notifyOnWarning;
      if (typeof body.maxLogsRetention === 'number') {
        survDb.settings.maxLogsRetention = Math.max(100, Math.min(1000, body.maxLogsRetention));
      }

      survDb.settings.updatedAt = new Date().toISOString();
      survDb.settings.updatedBy = actor.name;
      persistSurvDb();

      recordSurveillanceAudit(req, authCtx, {
        actionType: 'surveillance_settings_updated',
        action: 'Paramètres de surveillance technique mis à jour',
        target: 'surveillance_db.json',
        entityType: 'surveillance_settings',
        result: 'reussi',
        severity: 'moyen',
        beforeValue: prev,
        afterValue: JSON.stringify(survDb.settings),
        details: `Paramètres modifiés par ${actor.name}`
      });

      res.json({ success: true, settings: survDb.settings });
    }
  );

  app.patch(
    '/api/surveillance/permissions/:staffId',
    requireSurveillanceAccess(undefined, { requireSuperAdmin: true, requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
      const actor = authCtx.staff!;
      const targetId = req.params.staffId;
      const targetMember = getSecurityStaffDirectory().find((s) => s.id === targetId);

      if (!targetMember) {
        return res.status(404).json({ success: false, error: 'Collaborateur introuvable.' });
      }
      if (targetMember.role === 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'SUPER_ADMIN_IMMUTABLE',
          message: 'Les privilèges du Super Administrateur sont immuables.'
        });
      }
      if (targetMember.role === 'other_agent') {
        return res.status(403).json({
          success: false,
          error: 'NON_ADMIN_AGENT',
          message: 'Un agent non-administrateur ne peut pas accéder à la surveillance technique.'
        });
      }

      const incoming = req.body?.permissions || {};
      const current = getEffectivePermissionsForStaff(targetId, targetMember.role);
      const nextPerms = { ...current };
      for (const k of ALL_SURVEILLANCE_PERMISSIONS) {
        if (typeof incoming[k] === 'boolean') {
          nextPerms[k] = incoming[k];
        }
      }

      survDb.staffPermissions[targetId] = nextPerms;
      persistSurvDb();

      recordSurveillanceAudit(req, authCtx, {
        actionType: 'surveillance_permissions_updated',
        action: `Droits Surveillance Technique modifiés pour ${targetMember.name}`,
        target: `${targetMember.name} (${targetMember.email})`,
        entityType: 'staff_permissions',
        entityId: targetId,
        result: 'reussi',
        severity: 'eleve',
        beforeValue: JSON.stringify(current),
        afterValue: JSON.stringify(nextPerms),
        details: `Droits mis à jour par Super Admin ${actor.name}`
      });

      res.json({
        success: true,
        permissionsDirectory: buildPermissionsDirectory()
      });
    }
  );
}
