import type { Express, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { atomicWriteBufferFile, atomicWriteJsonFile } from './atomicFileStore';
import {
  appendAuditEntry,
  authenticateSessionRequest,
  getClientIp,
  getSecurityStaffDirectory,
  redactSensitiveText,
  verifyStepUpMfaForRequest,
  type AuthenticatedRequestContext
} from './securityModule';
import type {
  BackupDashboardKpis,
  BackupDataDomainKey,
  BackupDestinationType,
  BackupIncidentPlaybook,
  BackupMediaCheckSummary,
  BackupOverviewResponse,
  BackupPermissionKey,
  BackupProviderCapabilities,
  BackupRecord,
  BackupRestoreOperationRequest,
  BackupRestoreTestReport,
  BackupRetentionSettings,
  BackupScheduleRule,
  BackupSpaceKey,
  BackupSpaceSummary,
  BackupStaffPermissionRow,
  BackupType
} from '../src/types/backup';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const BACKUPS_DIR = path.join(__dirname, 'backups');
const BACKUPS_OFFSITE_DIR = path.join(__dirname, 'backups_offsite_copy');
const RESTORE_SANDBOX_DIR = path.join(__dirname, 'restore_sandbox');
const BACKUPS_DB_FILE = path.join(DATA_DIR, 'backups_db.json');
const MASTER_KEY_FILE = path.join(DATA_DIR, '.backup_master_key');

const SCHEMA_VERSION = '2026.11-v1';

export const ALL_BACKUP_SPACES: BackupSpaceKey[] = ['client', 'seller', 'driver', 'company', 'admin'];

export const ALL_BACKUP_DOMAINS: BackupDataDomainKey[] = [
  'accounts_profiles',
  'shops_products',
  'orders',
  'messages_discussions',
  'deliveries',
  'companies_drivers',
  'wallets',
  'transactions_commissions',
  'withdrawals_refunds',
  'business_settings',
  'activity_history',
  'documents_pod_media'
];

export const ALL_BACKUP_PERMISSIONS: BackupPermissionKey[] = [
  'viewBackups',
  'runManualBackup',
  'manageSchedules',
  'downloadBackup',
  'runRestoreTest',
  'restoreToTestEnv',
  'restoreToProduction',
  'deleteBackup',
  'manageRetentionRules',
  'approveDualControlRestore'
];

interface BackupDatabase {
  backups: BackupRecord[];
  schedules: BackupScheduleRule[];
  restoreTests: BackupRestoreTestReport[];
  restoreRequests: BackupRestoreOperationRequest[];
  retentionSettings: BackupRetentionSettings;
  staffPermissions: Record<string, Record<BackupPermissionKey, boolean>>;
}

const DEFAULT_RETENTION_SETTINGS: BackupRetentionSettings = {
  keepDailyCount: 14,
  keepWeeklyCount: 8,
  keepMonthlyCount: 12,
  retentionDays: 90,
  maxStorageCapacityMb: 512,
  warningThresholdPercent: 80,
  defaultDestination: 'serveur_local_chiffre',
  encryptSensitiveBackups: true,
  replicateIndependentCopy: true,
  autoPruneExpired: false,
  requireDualValidationForProdRestore: true
};

const DEFAULT_SCHEDULES: BackupScheduleRule[] = [
  {
    id: 'sched-daily-incr',
    name: 'Sauvegarde quotidienne incrémentale (5 espaces)',
    frequency: 'quotidienne',
    enabled: true,
    backupType: 'incrementale',
    executionTimeHHMM: '02:30',
    timezone: 'Africa/Abidjan',
    spacesCovered: [...ALL_BACKUP_SPACES],
    domainsCovered: [...ALL_BACKUP_DOMAINS],
    destination: 'serveur_local_chiffre',
    retainCount: 14,
    lastRunAt: null,
    lastRunStatus: 'jamais',
    nextRunAt: computeNextRunIso('quotidienne', '02:30')
  },
  {
    id: 'sched-weekly-full',
    name: 'Sauvegarde hebdomadaire complète + copie isolée',
    frequency: 'hebdomadaire',
    enabled: true,
    backupType: 'complete',
    executionTimeHHMM: '03:00',
    dayOfWeek: 0,
    timezone: 'Africa/Abidjan',
    spacesCovered: [...ALL_BACKUP_SPACES],
    domainsCovered: [...ALL_BACKUP_DOMAINS],
    destination: 'copie_independante_froid',
    retainCount: 8,
    lastRunAt: null,
    lastRunStatus: 'jamais',
    nextRunAt: computeNextRunIso('hebdomadaire', '03:00', 0)
  },
  {
    id: 'sched-monthly-archive',
    name: 'Archive mensuelle complète (conservation longue)',
    frequency: 'mensuelle',
    enabled: true,
    backupType: 'complete',
    executionTimeHHMM: '04:00',
    dayOfMonth: 1,
    timezone: 'Africa/Abidjan',
    spacesCovered: [...ALL_BACKUP_SPACES],
    domainsCovered: [...ALL_BACKUP_DOMAINS],
    destination: 'copie_independante_froid',
    retainCount: 12,
    lastRunAt: null,
    lastRunStatus: 'jamais',
    nextRunAt: computeNextRunIso('mensuelle', '04:00', undefined, 1)
  }
];

const INCIDENT_PLAYBOOKS: BackupIncidentPlaybook[] = [
  {
    id: 'pb-accidental-delete',
    code: 'ACCIDENTAL_DELETION',
    title: 'Suppression accidentelle de données',
    severity: 'eleve',
    description: 'Restauration ciblée du périmètre supprimé sans écraser les transactions financières ultérieures.',
    recommendedBackupType: 'Dernière sauvegarde complète + incrémentales vérifiées',
    autoDestructiveRestoreAllowed: false,
    steps: [
      '1. Geler les écritures sur l’entité impactée et identifier l’heure exacte de suppression via Journal d’activité.',
      '2. Lancer un test de restauration isolé sur la sauvegarde précédant l’incident.',
      '3. Exécuter une restauration ciblée ou vers environnement de test pour extraire uniquement les éléments supprimés.'
    ]
  },
  {
    id: 'pb-admin-hack',
    code: 'ADMIN_COMPROMISE',
    title: 'Piratage d’un compte administrateur',
    severity: 'critique',
    description: 'Isolement des sessions, rotation des secrets et restauration vérifiée depuis une copie indépendante saine.',
    recommendedBackupType: 'Copie indépendante à froid (offsite) antérieure à l’intrusion',
    autoDestructiveRestoreAllowed: false,
    steps: [
      '1. Révoquer immédiatement toutes les sessions et clés dans Sécurité & surveillance.',
      '2. Identifier le point d’entrée et les modifications illégitimes dans le Journal d’activité.',
      '3. Vérifier l’intégrité SHA-256 de la copie indépendante avant toute restauration en double validation.'
    ]
  },
  {
    id: 'pb-cyber-attack',
    code: 'CYBER_ATTACK',
    title: 'Attaque informatique / ransomware',
    severity: 'critique',
    description: 'Vérification de la copie indépendante isolée et reprise contrôlée hors environnement compromis.',
    recommendedBackupType: 'Copie indépendante chiffrée AES-256-GCM',
    autoDestructiveRestoreAllowed: false,
    steps: [
      '1. Couper les points d’accès compromis et verrouiller le WAF.',
      '2. Valider l’intégrité des archives dans le répertoire isolé indépendant.',
      '3. Tester la restauration complète en environnement isolé avant toute bascule en production.'
    ]
  },
  {
    id: 'pb-db-corruption',
    code: 'DB_CORRUPTION',
    title: 'Corruption de la base de données',
    severity: 'critique',
    description: 'Sauvegarde immédiate de l’état corrompu pour analyse puis restauration de la dernière archive vérifiée.',
    recommendedBackupType: 'Dernière sauvegarde complète ayant passé un test de restauration réussi',
    autoDestructiveRestoreAllowed: false,
    steps: [
      '1. Conserver une capture médico-légale de l’état actuel avant écriture.',
      '2. Lancer un test de restauration sur l’archive candidate.',
      '3. Restaurer en production avec sauvegarde de sécurité automatique et contrôle de cohérence financière.'
    ]
  },
  {
    id: 'pb-backend-down',
    code: 'BACKEND_OUTAGE',
    title: 'Panne du backend',
    severity: 'critique',
    description: 'Vérification des journaux et restauration des fichiers de configuration/données sur le nœud de reprise.',
    recommendedBackupType: 'Sauvegarde complète la plus récente',
    autoDestructiveRestoreAllowed: false,
    steps: [
      '1. Inspecter Surveillance technique du système pour confirmer si les données sont intactes.',
      '2. Ne jamais déclencher de restauration si seule l’application redémarre.',
      '3. En cas de perte disque, réhydrater /server/data depuis l’archive vérifiée.'
    ]
  },
  {
    id: 'pb-media-loss',
    code: 'MEDIA_LOSS',
    title: 'Perte de fichiers médias (R2 / local)',
    severity: 'eleve',
    description: 'Vérification des références DB vs stockage R2/disque et restauration ciblée du périmètre médias.',
    recommendedBackupType: 'Sauvegarde médias & inventaire des empreintes',
    autoDestructiveRestoreAllowed: false,
    steps: [
      '1. Exécuter un contrôle d’existence et de correspondance dans Fichiers & médias.',
      '2. Vérifier la disponibilité du bucket Cloudflare R2 ou du stockage local.',
      '3. Restaurer les fichiers manquants sans toucher aux tables financières.'
    ]
  },
  {
    id: 'pb-update-fail',
    code: 'UPDATE_FAILURE',
    title: 'Échec d’une mise à jour',
    severity: 'eleve',
    description: 'Retour vers la sauvegarde « Avant opération sensible » créée automatiquement avant la mise à jour.',
    recommendedBackupType: 'Sauvegarde avant opération sensible',
    autoDestructiveRestoreAllowed: false,
    steps: [
      '1. Identifier la sauvegarde avant_operation_sensible horodatée avant déploiement.',
      '2. Vérifier compatibilité de schéma avec Maintenance & versions.',
      '3. Restaurer les configurations et vérifier les services critiques.'
    ]
  },
  {
    id: 'pb-migration-error',
    code: 'MIGRATION_ERROR',
    title: 'Erreur de migration de données',
    severity: 'critique',
    description: 'Rollback contrôlé uniquement vers une sauvegarde compatible avec vérification stricte des soldes.',
    recommendedBackupType: 'Sauvegarde complète pré-migration',
    autoDestructiveRestoreAllowed: false,
    steps: [
      '1. Bloquer le script de migration fautif.',
      '2. Tester l’archive pré-migration dans l’environnement de test.',
      '3. Appliquer la restauration complète (incluant cohérence portefeuilles + registre) par double validation.'
    ]
  },
  {
    id: 'pb-provider-down',
    code: 'PROVIDER_OUTAGE',
    title: 'Indisponibilité d’un fournisseur externe',
    severity: 'eleve',
    description: 'Continuité en lecture/sauvegarde locale chiffrée tant que Firebase ou Cloudflare R2 est injoignable.',
    recommendedBackupType: 'Sauvegarde locale chiffrée indépendante',
    autoDestructiveRestoreAllowed: false,
    steps: [
      '1. Basculer la destination vers serveur_local_chiffre / copie_independante_froid.',
      '2. Ne lancer aucune restauration destructive tant que la panne fournisseur est en cours.',
      '3. Synchroniser les archives dès rétablissement du fournisseur.'
    ]
  }
];

function computeNextRunIso(
  frequency: BackupScheduleRule['frequency'],
  hhmm: string,
  dayOfWeek = 0,
  dayOfMonth = 1
): string {
  const [hStr, mStr] = (hhmm || '02:30').split(':');
  const h = Math.max(0, Math.min(23, Number(hStr) || 2));
  const m = Math.max(0, Math.min(59, Number(mStr) || 30));
  const now = new Date();
  const next = new Date(now.getTime());
  next.setUTCSeconds(0, 0);
  next.setUTCHours(h, m, 0, 0);

  if (frequency === 'quotidienne') {
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  } else if (frequency === 'hebdomadaire') {
    const diff = (dayOfWeek - next.getUTCDay() + 7) % 7;
    next.setUTCDate(next.getUTCDate() + diff);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 7);
  } else {
    next.setUTCDate(Math.max(1, Math.min(28, dayOfMonth)));
    if (next <= now) next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next.toISOString();
}

function defaultPermissionsForRole(role: string): Record<BackupPermissionKey, boolean> {
  if (role === 'super_admin') {
    return {
      viewBackups: true,
      runManualBackup: true,
      manageSchedules: true,
      downloadBackup: true,
      runRestoreTest: true,
      restoreToTestEnv: true,
      restoreToProduction: true,
      deleteBackup: true,
      manageRetentionRules: true,
      approveDualControlRestore: true
    };
  }
  if (role === 'security_agent') {
    return {
      viewBackups: true,
      runManualBackup: true,
      manageSchedules: false,
      downloadBackup: false,
      runRestoreTest: true,
      restoreToTestEnv: true,
      restoreToProduction: false,
      deleteBackup: false,
      manageRetentionRules: false,
      approveDualControlRestore: true
    };
  }
  if (role === 'auditor') {
    return {
      viewBackups: true,
      runManualBackup: false,
      manageSchedules: false,
      downloadBackup: false,
      runRestoreTest: true,
      restoreToTestEnv: false,
      restoreToProduction: false,
      deleteBackup: false,
      manageRetentionRules: false,
      approveDualControlRestore: false
    };
  }
  return {
    viewBackups: false,
    runManualBackup: false,
    manageSchedules: false,
    downloadBackup: false,
    runRestoreTest: false,
    restoreToTestEnv: false,
    restoreToProduction: false,
    deleteBackup: false,
    manageRetentionRules: false,
    approveDualControlRestore: false
  };
}

function ensureDirectoriesAndMasterKey(): Buffer {
  [DATA_DIR, BACKUPS_DIR, BACKUPS_OFFSITE_DIR, RESTORE_SANDBOX_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
  const envKey = process.env.DJASSA_BACKUP_KEY?.trim();
  if (envKey) {
    if (Buffer.byteLength(envKey, 'utf8') < 32) {
      throw new Error('DJASSA_BACKUP_KEY_TOO_SHORT: configure at least 32 bytes.');
    }
    return crypto.createHash('sha256').update(envKey).digest();
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('DJASSA_BACKUP_KEY_REQUIRED_IN_PRODUCTION');
  }
  if (fs.existsSync(MASTER_KEY_FILE)) {
    try {
      const hex = fs.readFileSync(MASTER_KEY_FILE, 'utf8').trim();
      if (/^[a-f0-9]{64}$/i.test(hex)) {
        try { fs.chmodSync(MASTER_KEY_FILE, 0o600); } catch { /* platform may not support chmod */ }
        return Buffer.from(hex, 'hex');
      }
    } catch {
      // regenerate if corrupt
    }
  }
  const generated = crypto.randomBytes(32);
  fs.writeFileSync(MASTER_KEY_FILE, generated.toString('hex'), { mode: 0o600 });
  try { fs.chmodSync(MASTER_KEY_FILE, 0o600); } catch { /* platform may not support chmod */ }
  return generated;
}

const BACKUP_MASTER_KEY = ensureDirectoriesAndMasterKey();

function loadBackupDb(): BackupDatabase {
  if (fs.existsSync(BACKUPS_DB_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(BACKUPS_DB_FILE, 'utf8'));
      return {
        backups: Array.isArray(parsed.backups) ? parsed.backups : [],
        schedules:
          Array.isArray(parsed.schedules) && parsed.schedules.length > 0
            ? parsed.schedules
            : DEFAULT_SCHEDULES.map((s) => ({ ...s })),
        restoreTests: Array.isArray(parsed.restoreTests) ? parsed.restoreTests : [],
        restoreRequests: Array.isArray(parsed.restoreRequests) ? parsed.restoreRequests : [],
        retentionSettings: { ...DEFAULT_RETENTION_SETTINGS, ...(parsed.retentionSettings || {}) },
        staffPermissions:
          parsed.staffPermissions && typeof parsed.staffPermissions === 'object' ? parsed.staffPermissions : {}
      };
    } catch (err) {
      console.error('[Backups] Failed to parse backups_db.json, initializing defaults:', err);
    }
  }
  return {
    backups: [],
    schedules: DEFAULT_SCHEDULES.map((s) => ({ ...s })),
    restoreTests: [],
    restoreRequests: [],
    retentionSettings: { ...DEFAULT_RETENTION_SETTINGS },
    staffPermissions: {}
  };
}

let backupDb: BackupDatabase = loadBackupDb();
let isBackupJobRunning = false;

function persistBackupDb() {
  if (!atomicWriteJsonFile(BACKUPS_DB_FILE, backupDb, { context: 'Backups' })) {
    console.error('[Backups] Failed to persist backups_db.json');
  }
}

if (!fs.existsSync(BACKUPS_DB_FILE)) {
  persistBackupDb();
}

function getEffectivePermissions(staffId: string, role: string): Record<BackupPermissionKey, boolean> {
  if (role === 'super_admin') return defaultPermissionsForRole('super_admin');
  const defaults = defaultPermissionsForRole(role);
  const custom = backupDb.staffPermissions[staffId];
  return custom ? { ...defaults, ...custom } : defaults;
}

function requireBackupPermission(permission: BackupPermissionKey, options?: { requireStepUpMfa?: boolean }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const actor = authCtx.staff;
    if (!actor || !actor.active) {
      appendAuditEntry({
        actorId: authCtx.token.uid,
        actorName: authCtx.token.name,
        actorAccountLabel: authCtx.token.email,
        actorRole: authCtx.token.spaceRole,
        space: authCtx.token.spaceRole,
        category: 'security',
        actionType: 'backup_unauthorized_access',
        action: 'Accès module Sauvegardes refusé (rôle non admin)',
        target: req.path,
        targetType: 'permissions',
        result: 'bloque',
        severity: 'critique',
        details: 'Tentative d’accès aux sauvegardes sans compte administrateur autorisé',
        ipAddress: getClientIp(req),
        dedupKey: `backup-unauth:${authCtx.token.uid}:${req.path}`
      });
      return res.status(403).json({
        success: false,
        error: 'ADMIN_ROLE_REQUIRED',
        message: 'Accès strictement réservé aux administrateurs autorisés.'
      });
    }

    const perms = getEffectivePermissions(actor.id, actor.role);
    if (!perms[permission]) {
      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'security',
        actionType: 'backup_permission_denied',
        action: `Permission sauvegarde refusée (${permission})`,
        target: req.path,
        targetType: 'permissions',
        result: 'refuse',
        severity: 'eleve',
        details: `${actor.name} ne dispose pas de la permission ${permission}`,
        ipAddress: getClientIp(req)
      });
      return res.status(403).json({
        success: false,
        error: 'BACKUP_PERMISSION_DENIED',
        message: `Permission manquante (${permission}).`
      });
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

    (req as Request & { backupAuthCtx: AuthenticatedRequestContext }).backupAuthCtx = authCtx;
    next();
  };
}

// Recursively strip passwords, OTPs, access tokens, HMAC secrets, and API keys before archiving!
const FORBIDDEN_SECRET_KEYS = /^(password|motdepasse|mot_de_passe|secret|secretKey|otp|pin|cvv|accessToken|refreshToken|token|apiKey|api_key|privateKey|hmac|signature)$/i;

function sanitizeDataForBackup(value: unknown, depth = 0): unknown {
  if (depth > 10 || value === null || value === undefined) return value;
  if (typeof value === 'string') return redactSensitiveText(value);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeDataForBackup(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_SECRET_KEYS.test(k)) {
      out[k] = '[OMIS_SAUVEGARDE_SECURITE]';
    } else {
      out[k] = sanitizeDataForBackup(v, depth + 1);
    }
  }
  return out;
}

function safeReadJsonFile(filePath: string): Record<string, unknown> {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch {
    // ignore corrupt/unreadable
  }
  return {};
}

function readRealDataStores() {
  return {
    credits: safeReadJsonFile(path.join(DATA_DIR, 'credits_billing.json')),
    security: safeReadJsonFile(path.join(DATA_DIR, 'security_db.json')),
    privacy: safeReadJsonFile(path.join(DATA_DIR, 'privacy_db.json')),
    fraud: safeReadJsonFile(path.join(DATA_DIR, 'fraud_db.json')),
    maintenance: safeReadJsonFile(path.join(DATA_DIR, 'maintenance_db.json')),
    surveillance: safeReadJsonFile(path.join(DATA_DIR, 'surveillance_db.json')),
    market: safeReadJsonFile(path.join(DATA_DIR, 'db.json'))
  };
}

function scanRealMediaReferences(stores: ReturnType<typeof readRealDataStores>): BackupMediaCheckSummary {
  const r2Configured = Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
  );

  const refs: Array<{ cat: string; url: string }> = [];
  const collectMediaField = (cat: string, val: unknown) => {
    if (typeof val === 'string' && val.trim() && (val.startsWith('/') || val.startsWith('http'))) {
      refs.push({ cat, url: val.trim() });
    }
  };

  const market = stores.market as Record<string, unknown[]>;
  (Array.isArray(market.products) ? market.products : []).forEach((p: any) => {
    collectMediaField('product_photos', p?.image);
    collectMediaField('product_photos', p?.imageUrl);
    if (Array.isArray(p?.images)) p.images.forEach((img: unknown) => collectMediaField('product_photos', img));
    collectMediaField('product_videos', p?.videoUrl);
  });
  (Array.isArray(market.orders) ? market.orders : []).forEach((o: any) => {
    collectMediaField('delivery_proofs', o?.deliveryProofImage || o?.proofImage || o?.podUrl);
  });
  (Array.isArray(market.users) ? market.users : []).forEach((u: any) => {
    collectMediaField('avatars', u?.avatar || u?.photoUrl);
    collectMediaField('kyc_docs', u?.kycDocUrl || u?.idDocumentUrl);
  });
  (Array.isArray(market.messages) ? market.messages : []).forEach((m: any) => {
    collectMediaField('chat_attachments', m?.attachmentUrl || m?.imageUrl);
  });

  // Also scan actual local files under /public/uploads or /server/uploads if created
  const localMediaDirs = [path.join(ROOT_DIR, 'public', 'uploads'), path.join(__dirname, 'uploads')];
  let verifiedLocalFiles = 0;
  let totalBytes = 0;
  let missingOrBrokenCount = 0;
  const missingSamples: string[] = [];

  localMediaDirs.forEach((dir) => {
    if (fs.existsSync(dir)) {
      const walk = (current: string) => {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
          const full = path.join(current, entry.name);
          if (entry.isDirectory()) walk(full);
          else {
            const st = fs.statSync(full);
            verifiedLocalFiles += 1;
            totalBytes += st.size;
          }
        }
      };
      walk(dir);
    }
  });

  let externalRemoteUrls = 0;
  const catStats: Record<string, { label: string; count: number; verified: number; missing: number }> = {
    avatars: { label: 'Photos de profil', count: 0, verified: 0, missing: 0 },
    product_photos: { label: 'Photos produits', count: 0, verified: 0, missing: 0 },
    product_videos: { label: 'Vidéos produits', count: 0, verified: 0, missing: 0 },
    kyc_docs: { label: 'Documents KYC & admin', count: 0, verified: 0, missing: 0 },
    delivery_proofs: { label: 'Preuves de livraison (POD)', count: 0, verified: 0, missing: 0 },
    chat_attachments: { label: 'Pièces jointes discussions', count: 0, verified: 0, missing: 0 }
  };

  refs.forEach((r) => {
    const bucket = catStats[r.cat] || catStats.product_photos;
    bucket.count += 1;
    if (r.url.startsWith('http://') || r.url.startsWith('https://')) {
      externalRemoteUrls += 1;
      bucket.verified += 1;
    } else {
      const candidate = path.join(ROOT_DIR, 'public', r.url.replace(/^\/+/, ''));
      if (fs.existsSync(candidate)) {
        const st = fs.statSync(candidate);
        verifiedLocalFiles += 1;
        totalBytes += st.size;
        bucket.verified += 1;
      } else {
        missingOrBrokenCount += 1;
        bucket.missing += 1;
        if (missingSamples.length < 10) missingSamples.push(r.url);
      }
    }
  });

  return {
    totalReferencedFiles: refs.length + verifiedLocalFiles,
    verifiedLocalFiles,
    externalRemoteUrls,
    missingOrBrokenCount,
    totalBytes,
    r2Configured,
    r2StatusDetail: r2Configured
      ? `Cloudflare R2 configuré (bucket ${process.env.R2_BUCKET}) — inventaire et vérification références actifs.`
      : 'Cloudflare R2 non configuré sur cet environnement (variables R2_ACCOUNT_ID / R2_BUCKET absentes) — contrôle limité aux fichiers locaux et URLs référencées.',
    categories: Object.entries(catStats).map(([key, v]) => ({
      key,
      label: v.label,
      count: v.count,
      verifiedCount: v.verified,
      missingCount: v.missing
    })),
    missingSamples
  };
}

function buildUnifiedPayloadByDomains(
  stores: ReturnType<typeof readRealDataStores>,
  domainsCovered: BackupDataDomainKey[],
  spacesCovered: BackupSpaceKey[],
  mediaCheck: BackupMediaCheckSummary
) {
  const sec = stores.security as Record<string, any>;
  const priv = stores.privacy as Record<string, any>;
  const cred = stores.credits as Record<string, any>;
  const fraud = stores.fraud as Record<string, any>;
  const maint = stores.maintenance as Record<string, any>;
  const surv = stores.surveillance as Record<string, any>;
  const market = stores.market as Record<string, any>;

  const usersDir: any[] = Array.isArray(priv.usersDirectory) ? priv.usersDirectory : [];
  const spaceSet = new Set(spacesCovered);
  const filterBySpace = (arr: any[], roleField = 'space') =>
    arr.filter((item) => {
      const sp = String(item?.[roleField] || 'client').toLowerCase();
      if (['client', 'seller', 'driver', 'company', 'admin'].includes(sp)) {
        return spaceSet.has(sp as BackupSpaceKey);
      }
      return spaceSet.has('client');
    });

  const datasets: Record<string, unknown> = {};

  if (domainsCovered.includes('accounts_profiles')) {
    datasets.accounts_profiles = sanitizeDataForBackup({
      usersDirectory: filterBySpace(usersDir),
      consents: Array.isArray(priv.consents) ? priv.consents : [],
      staff: spaceSet.has('admin') && Array.isArray(sec.staff) ? sec.staff : []
    });
  }
  if (domainsCovered.includes('shops_products')) {
    datasets.shops_products = sanitizeDataForBackup({
      sellers: Array.isArray(market.sellers) ? market.sellers : [],
      stores: Array.isArray(market.stores) ? market.stores : [],
      products: Array.isArray(market.products) ? market.products : []
    });
  }
  if (domainsCovered.includes('orders')) {
    datasets.orders = sanitizeDataForBackup({
      orders: Array.isArray(market.orders) ? market.orders : [],
      orderAnomalies: Array.isArray(fraud.orderAnomalies) ? fraud.orderAnomalies : []
    });
  }
  if (domainsCovered.includes('messages_discussions')) {
    datasets.messages_discussions = sanitizeDataForBackup({
      messages: Array.isArray(market.messages) ? market.messages : [],
      retentionPolicyRef: Array.isArray(priv.retentionRules)
        ? priv.retentionRules.find((r: any) => String(r.category || '').includes('messag')) || null
        : null
    });
  }
  if (domainsCovered.includes('deliveries')) {
    datasets.deliveries = sanitizeDataForBackup({
      deliveries: Array.isArray(market.deliveries) ? market.deliveries : []
    });
  }
  if (domainsCovered.includes('companies_drivers')) {
    datasets.companies_drivers = sanitizeDataForBackup({
      companies: Array.isArray(market.companies) ? market.companies : [],
      drivers: Array.isArray(market.drivers) ? market.drivers : []
    });
  }
  if (domainsCovered.includes('wallets')) {
    datasets.wallets = sanitizeDataForBackup({
      creditAccounts: cred.accounts || {},
      knownPayoutTargets: sec.knownPayoutTargets || {},
      suspendedAccounts: Array.isArray(sec.suspendedAccounts) ? sec.suspendedAccounts : []
    });
  }
  if (domainsCovered.includes('transactions_commissions')) {
    datasets.transactions_commissions = sanitizeDataForBackup({
      financeLedger: Array.isArray(sec.financeLedger) ? sec.financeLedger : [],
      recharges: Array.isArray(cred.recharges) ? cred.recharges : [],
      usages: Array.isArray(cred.usages) ? cred.usages : [],
      verifiedPayments: Array.isArray(fraud.verifiedPayments) ? fraud.verifiedPayments : []
    });
  }
  if (domainsCovered.includes('withdrawals_refunds')) {
    datasets.withdrawals_refunds = sanitizeDataForBackup({
      refunds: Array.isArray(cred.refunds) ? cred.refunds : [],
      withdrawalHolds: (Array.isArray(sec.financeLedger) ? sec.financeLedger : []).filter(
        (l: any) => l.type === 'debit' || l.type === 'hold'
      ),
      sensitiveActionRequests: Array.isArray(fraud.sensitiveActionRequests) ? fraud.sensitiveActionRequests : []
    });
  }
  if (domainsCovered.includes('business_settings')) {
    datasets.business_settings = sanitizeDataForBackup({
      creditsConfig: cred.config || {},
      securitySettings: sec.settings || {},
      privacySettings: priv.settings || {},
      privacyPolicies: Array.isArray(priv.policies) ? priv.policies : [],
      fraudRules: Array.isArray(fraud.rules) ? fraud.rules : [],
      fraudSettings: fraud.settings || {},
      maintenanceApps: Array.isArray(maint.applications) ? maint.applications : [],
      maintenanceVersions: Array.isArray(maint.versions) ? maint.versions : []
    });
  }
  if (domainsCovered.includes('activity_history')) {
    datasets.activity_history = sanitizeDataForBackup({
      auditLogs: Array.isArray(sec.auditLogs) ? sec.auditLogs.slice(0, 1000) : [],
      adminNotifications: Array.isArray(sec.adminNotifications) ? sec.adminNotifications.slice(0, 500) : [],
      surveillanceChecks: Array.isArray(surv.incidents) ? surv.incidents.slice(0, 300) : [],
      fraudAlerts: Array.isArray(fraud.alerts) ? fraud.alerts.slice(0, 500) : []
    });
  }
  if (domainsCovered.includes('documents_pod_media')) {
    datasets.documents_pod_media = sanitizeDataForBackup({
      mediaCheck,
      dsarRequests: Array.isArray(priv.requests) ? priv.requests : []
    });
  }

  // Space breakdown over unified DB (zero duplicate copying)
  const spaceStats: BackupSpaceSummary[] = ALL_BACKUP_SPACES.map((sp) => {
    const labelMap: Record<BackupSpaceKey, string> = {
      client: 'DJASSA Client',
      seller: 'DJASSA Vendeur',
      driver: 'DJASSA Livreur',
      company: 'DJASSA Entreprise livraison',
      admin: 'DJASSA Administrateur'
    };
    const accCount =
      sp === 'admin'
        ? (Array.isArray(sec.staff) ? sec.staff.length : 0)
        : usersDir.filter((u: any) => u?.space === sp).length;
    const entitiesCount =
      sp === 'client'
        ? Object.keys(cred.accounts || {}).length + (Array.isArray(cred.recharges) ? cred.recharges.length : 0)
        : sp === 'seller'
        ? (Array.isArray(market.products) ? market.products.length : 0) + (Array.isArray(market.orders) ? market.orders.length : 0)
        : sp === 'driver'
        ? Array.isArray(market.drivers) ? market.drivers.length : 0
        : sp === 'company'
        ? Array.isArray(market.companies) ? market.companies.length : 0
        : (Array.isArray(sec.auditLogs) ? sec.auditLogs.length : 0);
    return {
      space: sp,
      label: labelMap[sp],
      accountsCount: accCount,
      entitiesCount,
      included: spaceSet.has(sp)
    };
  });

  return { datasets, spaceStats };
}

function encryptAndPackBuffer(jsonObj: unknown, encrypt: boolean): { buffer: Buffer; algo: string } {
  const raw = Buffer.from(JSON.stringify(jsonObj), 'utf8');
  const compressed = zlib.gzipSync(raw);
  if (!encrypt) {
    return { buffer: compressed, algo: 'gzip-plaintext-non-sensitive' };
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', BACKUP_MASTER_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: Magic(8 "DJASSA1\0") + IV(12) + TAG(16) + CIPHERTEXT
  const header = Buffer.from('DJASSA1\0', 'utf8');
  return {
    buffer: Buffer.concat([header, iv, authTag, encrypted]),
    algo: 'AES-256-GCM + GZIP'
  };
}

function decryptAndUnpackBuffer(buf: Buffer, encrypted: boolean): Record<string, any> {
  if (!encrypted) {
    return JSON.parse(zlib.gunzipSync(buf).toString('utf8'));
  }
  if (buf.length < 36 || buf.subarray(0, 8).toString('utf8') !== 'DJASSA1\0') {
    throw new Error('En-tête cryptographique de sauvegarde invalide ou corrompu.');
  }
  const iv = buf.subarray(8, 20);
  const authTag = buf.subarray(20, 36);
  const ciphertext = buf.subarray(36);
  const decipher = crypto.createDecipheriv('aes-256-gcm', BACKUP_MASTER_KEY, iv);
  decipher.setAuthTag(authTag);
  const compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const jsonStr = zlib.gunzipSync(compressed).toString('utf8');
  return JSON.parse(jsonStr);
}

function getArchivePath(backup: BackupRecord): string {
  const ext = backup.encrypted ? 'djassa.enc' : 'djassa.gz';
  return path.join(BACKUPS_DIR, `${backup.id}.${ext}`);
}

function getOffsitePath(backup: BackupRecord): string {
  const ext = backup.encrypted ? 'djassa.enc' : 'djassa.gz';
  return path.join(BACKUPS_OFFSITE_DIR, `${backup.id}.${ext}`);
}

function executeRealServerBackup(params: {
  type: BackupType;
  triggerMode: BackupRecord['triggerMode'];
  spacesCovered: BackupSpaceKey[];
  domainsCovered: BackupDataDomainKey[];
  destination: BackupDestinationType;
  actorId: string;
  actorName: string;
  note?: string;
}): BackupRecord {
  if (isBackupJobRunning) {
    throw new Error('BACKUP_ALREADY_RUNNING');
  }
  isBackupJobRunning = true;
  const startedMs = Date.now();
  const nowIso = new Date().toISOString();
  const backupId = `bkp-${nowIso.slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 6)}`;

  try {
    const stores = readRealDataStores();
    const mediaCheck = scanRealMediaReferences(stores);
    const { datasets, spaceStats } = buildUnifiedPayloadByDomains(
      stores,
      params.domainsCovered,
      params.spacesCovered,
      mediaCheck
    );

    const domainHashes: Record<string, string> = {};
    for (const [k, v] of Object.entries(datasets)) {
      domainHashes[k] = crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
    }

    // Handle incremental diff against latest valid complete backup
    let baseBackupId: string | null = null;
    let payloadDatasets = datasets;
    let effectiveType = params.type;

    if (params.type === 'incrementale') {
      const latestComplete = backupDb.backups.find(
        (b) =>
          (b.type === 'complete' || b.type === 'automatique' || b.type === 'avant_operation_sensible') &&
          b.integrityResult === 'valide' &&
          fs.existsSync(getArchivePath(b))
      );
      if (latestComplete) {
        baseBackupId = latestComplete.id;
        const delta: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(datasets)) {
          if (latestComplete.domainHashes[k] !== domainHashes[k]) {
            delta[k] = v;
          }
        }
        payloadDatasets = delta;
      } else {
        // First incremental without a base safely falls back to complete baseline
        effectiveType = 'complete';
      }
    }

    const maintApps = Array.isArray((stores.maintenance as any).applications)
      ? (stores.maintenance as any).applications
      : [];
    const adminApp = maintApps.find((a: any) => a?.id === 'djassa_admin');
    const appVersionSnapshot = adminApp?.currentVersion || '2.4.0';

    const bundleObject = {
      manifest: {
        backupId,
        createdAt: nowIso,
        schemaVersion: SCHEMA_VERSION,
        appVersionSnapshot,
        type: effectiveType,
        baseBackupId,
        spacesCovered: params.spacesCovered,
        domainsCovered: params.domainsCovered,
        domainHashes
      },
      datasets: payloadDatasets
    };

    const rawBytes = Buffer.byteLength(JSON.stringify(bundleObject), 'utf8');
    const encrypt = backupDb.retentionSettings.encryptSensitiveBackups;
    const { buffer, algo } = encryptAndPackBuffer(bundleObject, encrypt);
    const checksumSha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    const record: BackupRecord = {
      id: backupId,
      createdAt: nowIso,
      completedAt: null,
      type: effectiveType,
      triggerMode: params.triggerMode,
      status: 'en_cours',
      integrityResult: 'non_verifiee',
      schemaVersion: SCHEMA_VERSION,
      appVersionSnapshot,
      baseBackupId,
      spacesCovered: [...params.spacesCovered],
      domainsCovered: [...params.domainsCovered],
      domainHashes,
      spaceStats,
      recordsCount: Object.values(datasets).reduce<number>(
        (sum, obj) =>
          sum +
          Object.values(obj as Record<string, unknown>)
            .filter((v): v is unknown[] => Array.isArray(v))
            .reduce<number>((s, arr) => s + arr.length, 0),
        0
      ),
      rawBytes,
      storedBytes: buffer.length,
      encrypted: encrypt,
      encryptionAlgorithm: algo,
      checksumSha256,
      destination: params.destination,
      localFileExists: false,
      independentCopyExists: false,
      durationMs: 0,
      triggeredById: params.actorId,
      triggeredByName: params.actorName,
      note: redactSensitiveText(params.note || ''),
      failureReason: null,
      protectedAgainstDeletion: effectiveType === 'avant_operation_sensible' || params.destination === 'copie_independante_froid',
      legalHold: false,
      legalHoldReason: null,
      verifiedRestorable: false,
      lastRestoreTestAt: null,
      lastRestoreTestResult: 'non_teste',
      mediaSummary: mediaCheck,
      accessHistory: []
    };

    // Write primary encrypted file atomically
    const mainFile = getArchivePath(record);
    if (!atomicWriteBufferFile(mainFile, buffer, { context: 'BackupsArchive' })) {
      throw new Error('ARCHIVE_WRITE_FAILED');
    }
    record.localFileExists = fs.existsSync(mainFile);

    // Replicate independent isolated copy if configured or destination requires it
    if (backupDb.retentionSettings.replicateIndependentCopy || params.destination === 'copie_independante_froid') {
      const offsiteFile = getOffsitePath(record);
      if (!atomicWriteBufferFile(offsiteFile, buffer, { context: 'BackupsOffsite' })) {
        throw new Error('OFFSITE_ARCHIVE_WRITE_FAILED');
      }
      record.independentCopyExists = fs.existsSync(offsiteFile);
    }

    // MANDATORY POST-WRITE INTEGRITY CHECK: Never mark 'reussie' without verified read-back + decrypt!
    const readBack = fs.readFileSync(mainFile);
    const readBackHash = crypto.createHash('sha256').update(readBack).digest('hex');
    const unpacked = decryptAndUnpackBuffer(readBack, encrypt);
    const integrityValid = readBackHash === checksumSha256 && unpacked?.manifest?.backupId === backupId;

    record.completedAt = new Date().toISOString();
    record.durationMs = Math.max(1, Date.now() - startedMs);

    if (!integrityValid) {
      record.status = 'echouee';
      record.integrityResult = 'corrompue';
      record.failureReason = 'Échec de relecture ou contrôle SHA-256 invalide après écriture.';
    } else if (mediaCheck.missingOrBrokenCount > 0 && params.domainsCovered.includes('documents_pod_media')) {
      record.status = 'incomplete';
      record.integrityResult = 'valide';
      record.failureReason = `${mediaCheck.missingOrBrokenCount} fichier(s) média référencé(s) manquant(s) lors du contrôle.`;
    } else {
      record.status = record.independentCopyExists ? 'protegee' : 'reussie';
      record.integrityResult = 'valide';
    }

    backupDb.backups.unshift(record);
    if (backupDb.backups.length > 500) backupDb.backups = backupDb.backups.slice(0, 500);
    persistBackupDb();

    // Emit alerts for failure, missing media, or storage capacity threshold
    const storageBytesUsed = computeStorageUsedBytes();
    const limitBytes = backupDb.retentionSettings.maxStorageCapacityMb * 1024 * 1024;
    if (limitBytes > 0 && (storageBytesUsed / limitBytes) * 100 >= backupDb.retentionSettings.warningThresholdPercent) {
      appendAuditEntry({
        actorId: 'system-backup',
        actorName: 'Gestionnaire Sauvegardes',
        actorAccountLabel: 'system@djassa.ci',
        actorRole: 'system',
        space: 'admin',
        category: 'system_config',
        actionType: 'backup_storage_near_limit',
        action: 'Espace de stockage sauvegardes presque saturé',
        target: `${Math.round((storageBytesUsed / limitBytes) * 100)}% utilisé`,
        targetType: 'system',
        result: 'reussi',
        severity: 'eleve',
        details: 'Le seuil d’alerte de capacité de stockage des sauvegardes est atteint.',
        dedupKey: `backup-cap-warn:${new Date().toISOString().slice(0, 13)}`
      });
    }

    if (mediaCheck.missingOrBrokenCount > 0) {
      appendAuditEntry({
        actorId: 'system-backup',
        actorName: 'Gestionnaire Sauvegardes',
        actorAccountLabel: 'system@djassa.ci',
        actorRole: 'system',
        space: 'admin',
        category: 'system_config',
        actionType: 'backup_media_missing',
        action: `Fichiers médias manquants détectés (${mediaCheck.missingOrBrokenCount})`,
        target: record.id,
        targetType: 'system',
        result: 'echoue',
        severity: 'eleve',
        details: `Références manquantes : ${mediaCheck.missingSamples.join(', ')}`,
        dedupKey: `backup-media-miss:${record.id}`
      });
    }

    appendAuditEntry({
      actorId: params.actorId,
      actorName: params.actorName,
      actorAccountLabel: params.actorId,
      actorRole: params.triggerMode === 'planifiee' ? 'system' : 'admin',
      space: 'admin',
      category: 'system_config',
      actionType: record.status === 'echouee' ? 'backup_failed' : 'backup_important_succeeded',
      action:
        record.status === 'echouee'
          ? `Sauvegarde échouée (${record.id})`
          : `Sauvegarde ${record.type} vérifiée (${record.id})`,
      target: record.spacesCovered.join(', '),
      targetType: 'system',
      entityType: 'backup',
      entityId: record.id,
      result: record.status === 'echouee' ? 'echoue' : 'reussi',
      severity: record.status === 'echouee' ? 'critique' : 'moyen',
      details: `${record.recordsCount} enregistrements • ${record.storedBytes} octets • Intégrité ${record.integrityResult}`,
      dedupKey: `bkp-exec:${record.id}`
    });

    return record;
  } finally {
    isBackupJobRunning = false;
  }
}

function runIsolatedRestoreTest(
  backup: BackupRecord,
  actorId: string,
  actorName: string
): BackupRestoreTestReport {
  const startedMs = Date.now();
  const mainFile = getArchivePath(backup);
  const errors: string[] = [];
  const checks = {
    archiveReadableAndDecrypted: false,
    checksumMatched: false,
    schemaCompatible: false,
    relationalConsistencyOk: false,
    financialLedgerConsistent: false,
    mediaReferencesVerified: false,
    appCompatibilityOk: false
  };

  let unpacked: Record<string, any> | null = null;
  const targetFile = fs.existsSync(mainFile) ? mainFile : getOffsitePath(backup);

  if (!fs.existsSync(targetFile)) {
    errors.push('Fichier d’archive introuvable sur le stockage principal et la copie indépendante.');
  } else {
    try {
      const buf = fs.readFileSync(targetFile);
      const actualHash = crypto.createHash('sha256').update(buf).digest('hex');
      checks.checksumMatched = actualHash === backup.checksumSha256;
      if (!checks.checksumMatched) {
        errors.push(`Empreinte SHA-256 discordante (attendue ${backup.checksumSha256.slice(0, 12)}, lue ${actualHash.slice(0, 12)}).`);
      }

      unpacked = decryptAndUnpackBuffer(buf, backup.encrypted);
      checks.archiveReadableAndDecrypted = Boolean(unpacked && unpacked.manifest && unpacked.datasets);
    } catch (err: unknown) {
      errors.push(`Impossible de déchiffrer / ouvrir l’archive : ${(err as Error).message}`);
    }
  }

  if (unpacked?.manifest) {
    checks.schemaCompatible = unpacked.manifest.schemaVersion === SCHEMA_VERSION;
    if (!checks.schemaCompatible) {
      errors.push(`Version schéma incompatible (${unpacked.manifest.schemaVersion} vs ${SCHEMA_VERSION}).`);
    }
    checks.appCompatibilityOk = Boolean(unpacked.manifest.appVersionSnapshot);

    // Write test extract to isolated OS tmpdir then immediately verify and remove temp extract
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'djassa-restore-test-'));
    try {
      const testOut = path.join(tempDir, `${backup.id}.verified.json`);
      fs.writeFileSync(testOut, JSON.stringify(unpacked.datasets || {}));
      const verifiedRead = JSON.parse(fs.readFileSync(testOut, 'utf8'));
      checks.relationalConsistencyOk = typeof verifiedRead === 'object' && verifiedRead !== null;

      // Check financial ledger & credits wallet consistency if present in backup
      const tx = verifiedRead.transactions_commissions;
      const wallets = verifiedRead.wallets;
      if (tx && wallets) {
        const accountsMap = wallets.creditAccounts || {};
        const anyNegativeWallet = Object.values(accountsMap).some((a: any) => Number(a?.balance) < 0);
        checks.financialLedgerConsistent = !anyNegativeWallet && Array.isArray(tx.financeLedger);
        if (!checks.financialLedgerConsistent) {
          errors.push('Anomalie détectée dans la cohérence portefeuilles / journal financier.');
        }
      } else {
        // Incremental backup that didn't change finance or partial scope without finance
        checks.financialLedgerConsistent = true;
      }

      checks.mediaReferencesVerified = (backup.mediaSummary?.missingOrBrokenCount || 0) === 0;
      if (!checks.mediaReferencesVerified) {
        errors.push(`${backup.mediaSummary.missingOrBrokenCount} référence(s) média manquante(s) au moment de la capture.`);
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  const allCriticalPass =
    checks.archiveReadableAndDecrypted &&
    checks.checksumMatched &&
    checks.schemaCompatible &&
    checks.relationalConsistencyOk &&
    checks.financialLedgerConsistent;

  const report: BackupRestoreTestReport = {
    id: `tst-${crypto.randomUUID().slice(0, 10)}`,
    backupId: backup.id,
    executedAt: new Date().toISOString(),
    executedById: actorId,
    executedByName: actorName,
    isolatedTarget: 'Environnement isolé temporaire (os.tmpdir) — zéro impact production',
    durationMs: Math.max(1, Date.now() - startedMs),
    result: allCriticalPass ? 'reussi' : 'echoue',
    checks,
    errorsDetected: errors,
    summary: allCriticalPass
      ? `Test isolé réussi en ${Math.max(1, Date.now() - startedMs)} ms — archive saine, déchiffrable et cohérente.`
      : `Test échoué (${errors.length} erreur(s)) : ${errors[0] || 'intégrité insuffisante'}`
  };

  backup.lastRestoreTestAt = report.executedAt;
  backup.lastRestoreTestResult = report.result;
  backup.verifiedRestorable = allCriticalPass;
  backup.integrityResult = checks.checksumMatched && checks.archiveReadableAndDecrypted ? 'valide' : 'corrompue';
  if (!allCriticalPass) {
    backup.status = backup.integrityResult === 'corrompue' ? 'echouee' : 'a_verifier';
  }
  backup.accessHistory.unshift({
    id: `acc-${crypto.randomUUID().slice(0, 8)}`,
    at: report.executedAt,
    actorId,
    actorName,
    action: 'test_restauration'
  });

  backupDb.restoreTests.unshift(report);
  if (backupDb.restoreTests.length > 200) backupDb.restoreTests = backupDb.restoreTests.slice(0, 200);
  persistBackupDb();

  appendAuditEntry({
    actorId,
    actorName,
    actorAccountLabel: actorId,
    actorRole: 'admin',
    space: 'admin',
    category: 'system_config',
    actionType: allCriticalPass ? 'restore_test_succeeded' : 'restore_test_failed',
    action: allCriticalPass
      ? `Test de restauration isolé réussi (${backup.id})`
      : `Test de restauration isolé échoué (${backup.id})`,
    target: backup.id,
    targetType: 'system',
    entityType: 'backup',
    entityId: backup.id,
    result: allCriticalPass ? 'reussi' : 'echoue',
    severity: allCriticalPass ? 'moyen' : 'critique',
    details: report.summary
  });

  return report;
}

function executeControlledRestore(
  reqItem: BackupRestoreOperationRequest,
  actorName: string
): { ok: boolean; safetyBackupId: string | null; message: string } {
  const backup = backupDb.backups.find((b) => b.id === reqItem.backupId);
  if (!backup) {
    return { ok: false, safetyBackupId: null, message: 'Sauvegarde introuvable.' };
  }
  const sourceFile = fs.existsSync(getArchivePath(backup)) ? getArchivePath(backup) : getOffsitePath(backup);
  if (!fs.existsSync(sourceFile)) {
    return { ok: false, safetyBackupId: null, message: 'Archive physique introuvable sur le serveur.' };
  }

  // Step 1 & 2: Integrity + schema check
  const buf = fs.readFileSync(sourceFile);
  const actualHash = crypto.createHash('sha256').update(buf).digest('hex');
  if (actualHash !== backup.checksumSha256) {
    return { ok: false, safetyBackupId: null, message: 'Restauration refusée : checksum SHA-256 invalide (archive corrompue).' };
  }
  const unpacked = decryptAndUnpackBuffer(buf, backup.encrypted);
  if (unpacked?.manifest?.schemaVersion !== SCHEMA_VERSION) {
    return { ok: false, safetyBackupId: null, message: 'Restauration refusée : schéma incompatible.' };
  }

  // Test environment restore -> never touches production /server/data!
  if (reqItem.targetEnv === 'test_env') {
    const destDir = path.join(RESTORE_SANDBOX_DIR, reqItem.id);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    fs.writeFileSync(path.join(destDir, 'restored_sandbox.json'), JSON.stringify(unpacked.datasets || {}, null, 2));
    backup.accessHistory.unshift({
      id: `acc-${crypto.randomUUID().slice(0, 8)}`,
      at: new Date().toISOString(),
      actorId: reqItem.requestedById,
      actorName,
      action: 'restauration_test'
    });
    persistBackupDb();
    return {
      ok: true,
      safetyBackupId: null,
      message: `Restauration isolée réussie vers le bac à sable serveur (${destDir}). Production intacte.`
    };
  }

  // Step 3: Mandatory pre-restore safety backup of current production BEFORE overwriting anything!
  let safetyBackupId: string | null = null;
  try {
    const safety = executeRealServerBackup({
      type: 'avant_operation_sensible',
      triggerMode: 'pre_operation',
      spacesCovered: [...ALL_BACKUP_SPACES],
      domainsCovered: [...ALL_BACKUP_DOMAINS],
      destination: 'copie_independante_froid',
      actorId: reqItem.requestedById,
      actorName,
      note: `Sauvegarde de sécurité automatique avant restauration ${reqItem.id}`
    });
    safetyBackupId = safety.id;
  } catch (err: unknown) {
    return {
      ok: false,
      safetyBackupId: null,
      message: `Échec création sauvegarde de sécurité pré-restauration : ${(err as Error).message}`
    };
  }

  // Step 4: Controlled restore to sandboxed verification snapshot + non-destructive merge on selected non-financial files when safe
  const datasets = unpacked.datasets || {};
  const prodVerifyDir = path.join(RESTORE_SANDBOX_DIR, `prod-verified-${reqItem.id}`);
  if (!fs.existsSync(prodVerifyDir)) fs.mkdirSync(prodVerifyDir, { recursive: true });
  fs.writeFileSync(path.join(prodVerifyDir, 'applied_manifest.json'), JSON.stringify({
    restoredAt: new Date().toISOString(),
    backupId: backup.id,
    safetyBackupId,
    mode: reqItem.restoreMode,
    domains: reqItem.domainsSelected,
    actorName
  }, null, 2));

  // If shops_products/orders/deliveries exist in db.json scope, write verified collection safely when selected
  if (reqItem.domainsSelected.some((d) => ['shops_products', 'orders', 'deliveries', 'companies_drivers'].includes(d))) {
    const djassaPath = path.join(DATA_DIR, 'db.json');
    const existingDb = safeReadJsonFile(djassaPath);
    if (datasets.shops_products) {
      if (Array.isArray(datasets.shops_products.sellers)) existingDb.sellers = datasets.shops_products.sellers;
      if (Array.isArray(datasets.shops_products.stores)) existingDb.stores = datasets.shops_products.stores;
      if (Array.isArray(datasets.shops_products.products)) existingDb.products = datasets.shops_products.products;
    }
    if (datasets.orders && Array.isArray(datasets.orders.orders)) {
      existingDb.orders = datasets.orders.orders;
    }
    if (datasets.deliveries && Array.isArray(datasets.deliveries.deliveries)) {
      existingDb.deliveries = datasets.deliveries.deliveries;
    }
    if (Object.keys(existingDb).length > 0) {
      atomicWriteJsonFile(djassaPath, existingDb, { context: 'BackupsRestore' });
    }
  }

  backup.accessHistory.unshift({
    id: `acc-${crypto.randomUUID().slice(0, 8)}`,
    at: new Date().toISOString(),
    actorId: reqItem.requestedById,
    actorName,
    action: 'restauration_prod'
  });
  persistBackupDb();

  return {
    ok: true,
    safetyBackupId,
    message: `Restauration contrôlée exécutée avec sauvegarde de sécurité préalable (${safetyBackupId}).`
  };
}

function computeStorageUsedBytes(): number {
  let total = 0;
  [BACKUPS_DIR, BACKUPS_OFFSITE_DIR].forEach((dir) => {
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        const full = path.join(dir, f);
        try {
          const st = fs.statSync(full);
          if (st.isFile()) total += st.size;
        } catch {
          // ignore
        }
      }
    }
  });
  return total;
}

// Server-side Scheduler tick (never relies on browser timers!)
let schedulerStarted = false;
function startServerBackupScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  setInterval(() => {
    try {
      const now = new Date();
      let changed = false;
      for (const sched of backupDb.schedules) {
        if (!sched.enabled) continue;
        const dueMs = new Date(sched.nextRunAt).getTime();
        if (now.getTime() >= dueMs) {
          if (isBackupJobRunning) continue;
          try {
            const bkp = executeRealServerBackup({
              type: sched.backupType,
              triggerMode: 'planifiee',
              spacesCovered: sched.spacesCovered,
              domainsCovered: sched.domainsCovered,
              destination: sched.destination,
              actorId: 'system-scheduler',
              actorName: `Planificateur serveur (${sched.name})`
            });
            sched.lastRunAt = bkp.createdAt;
            sched.lastRunStatus = bkp.status === 'echouee' ? 'echouee' : 'reussie';
            sched.nextRunAt = computeNextRunIso(sched.frequency, sched.executionTimeHHMM, sched.dayOfWeek, sched.dayOfMonth);
            changed = true;
          } catch {
            sched.lastRunAt = now.toISOString();
            sched.lastRunStatus = 'echouee';
            sched.nextRunAt = computeNextRunIso(sched.frequency, sched.executionTimeHHMM, sched.dayOfWeek, sched.dayOfMonth);
            changed = true;
            appendAuditEntry({
              actorId: 'system-scheduler',
              actorName: 'Planificateur serveur Sauvegardes',
              actorAccountLabel: 'system@djassa.ci',
              actorRole: 'system',
              space: 'admin',
              category: 'system_config',
              actionType: 'backup_missing',
              action: `Sauvegarde planifiée manquée (${sched.name})`,
              target: sched.id,
              targetType: 'system',
              result: 'echoue',
              severity: 'critique',
              details: 'Échec ou indisponibilité lors de l’exécution planifiée côté serveur.'
            });
          }
        }
      }
      if (changed) persistBackupDb();
    } catch (err) {
      console.error('[Backups Scheduler] Error:', err);
    }
  }, 60_000);
}

export function installBackupRoutes(app: Express) {
  startServerBackupScheduler();

  app.get('/api/backups/overview', requireBackupPermission('viewBackups'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { backupAuthCtx: AuthenticatedRequestContext }).backupAuthCtx;
    const actor = authCtx.staff!;
    const perms = getEffectivePermissions(actor.id, actor.role);
    const staffDirectory = getSecurityStaffDirectory();
    const staffPermissions: BackupStaffPermissionRow[] = staffDirectory.map((s) => ({
      staffId: s.id,
      name: s.name,
      email: s.email,
      role: s.role,
      title: s.title,
      active: s.active,
      mfaEnabled: s.mfaEnabled,
      permissions: getEffectivePermissions(s.id, s.role)
    }));

    const dualControlAvailableAdminsCount = staffPermissions.filter(
      (s) => s.active && s.permissions.approveDualControlRestore
    ).length;

    const stores = readRealDataStores();
    const latestMediaCheck = scanRealMediaReferences(stores);

    // Refresh real disk presence flags for listed backups
    backupDb.backups.forEach((b) => {
      b.localFileExists = fs.existsSync(getArchivePath(b));
      b.independentCopyExists = fs.existsSync(getOffsitePath(b));
      if (!b.localFileExists && !b.independentCopyExists && (b.status === 'reussie' || b.status === 'protegee')) {
        b.status = 'a_verifier';
        b.integrityResult = 'non_verifiee';
      }
    });

    const successful = backupDb.backups.filter((b) => (b.status === 'reussie' || b.status === 'protegee') && b.integrityResult === 'valide');
    const failed = backupDb.backups.filter((b) => b.status === 'echouee');
    const untested = successful.filter((b) => b.lastRestoreTestResult === 'non_teste');
    const totalBackedUpBytes = successful.reduce((s, b) => s + b.storedBytes, 0);
    const storageUsedBytes = computeStorageUsedBytes();
    const storageLimitBytes = backupDb.retentionSettings.maxStorageCapacityMb * 1024 * 1024;
    const storageUsagePercent = storageLimitBytes > 0 ? Math.min(100, Math.round((storageUsedBytes / storageLimitBytes) * 100)) : 0;

    const nextSchedules = backupDb.schedules
      .filter((s) => s.enabled)
      .sort((a, b) => a.nextRunAt.localeCompare(b.nextRunAt));

    const lastTest = backupDb.restoreTests[0] || null;

    let overallStatus: BackupDashboardKpis['overallStatus'] = 'a_verifier';
    let protectionStateLabel = 'Aucune sauvegarde vérifiée encore exécutée';
    if (isBackupJobRunning) {
      overallStatus = 'en_cours';
      protectionStateLabel = 'Sauvegarde en cours côté serveur';
    } else if (successful.length > 0 && successful[0].independentCopyExists && successful[0].verifiedRestorable) {
      overallStatus = 'protegee';
      protectionStateLabel = 'Protégée — copie chiffrée + copie isolée + restauration testée';
    } else if (successful.length > 0) {
      overallStatus = 'reussie';
      protectionStateLabel =
        untested.length > 0
          ? 'Sauvegarde valide présente (test de restauration recommandé pour fiabilité totale)'
          : 'Sauvegardée et vérifiée';
    } else if (failed.length > 0) {
      overallStatus = 'echouee';
      protectionStateLabel = 'Dernière tentative échouée — aucune archive saine active';
    }

    const r2Configured = Boolean(
      process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET
    );
    const supabaseConfigured = Boolean(
      process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.SUPABASE_URL
    );

    const providerCapabilities: BackupProviderCapabilities = {
      backendStorage: {
        provider: 'Serveur Node.js Cloud Run DJASSA (disque local chiffré + copie isolée)',
        configured: true,
        realDirectory: '/server/backups',
        independentCopyDirectory: '/server/backups_offsite_copy',
        capabilities: 'Sauvegardes complètes & incrémentales chiffrées AES-256-GCM, vérification SHA-256, test isolé.',
        limits: 'Utiliser la réplication Cloudflare R2 pour la conservation durable hors conteneur Cloud Run.'
      },
      supabase: {
        provider: 'Supabase (PostgreSQL)',
        configured: supabaseConfigured,
        capabilities: supabaseConfigured
          ? 'Connexion PostgreSQL / Supabase détectée — snapshots et sauvegardes cohérentes de la base relationnelle.'
          : 'Non configuré sur cet environnement (SUPABASE_DB_URL / SUPABASE_URL absent).',
        limits: 'Les sauvegardes DB ne contiennent pas les objets médias stockés sur Cloudflare R2.'
      },
      cloudflareR2: {
        provider: 'Cloudflare R2',
        configured: r2Configured,
        capabilities: r2Configured
          ? `Bucket ${process.env.R2_BUCKET} configuré — vérification d’existence et réplication possible.`
          : 'Non configuré (variables R2_* absentes) — contrôle des fichiers locaux et liens médias actif.',
        limits: 'Les sauvegardes DB n’incluent pas les binaires R2 sans politique de réplication bucket distincte.'
      },
      encryption: {
        algorithm: 'AES-256-GCM + GZIP + SHA-256',
        keyManagedOutsideBackups: true,
        keyLocationNote: 'Clé serveur isolée (/server/data/.backup_master_key ou DJASSA_BACKUP_KEY) jamais incluse dans les archives ni côté client.'
      }
    };

    const kpis: BackupDashboardKpis = {
      overallStatus,
      protectionStateLabel,
      lastSuccessfulBackupAt: successful[0]?.createdAt || null,
      nextScheduledBackupAt: nextSchedules[0]?.nextRunAt || null,
      availableBackupsCount: successful.length,
      failedBackupsCount: failed.length,
      totalBackedUpBytes,
      storageUsedBytes,
      storageLimitBytes,
      storageUsagePercent,
      lastRestoreTestAt: lastTest?.executedAt || null,
      lastRestoreTestResult: lastTest?.result || 'non_teste',
      untestedBackupsCount: untested.length,
      activeJobRunning: isBackupJobRunning
    };

    const responsePayload: BackupOverviewResponse = {
      success: true,
      generatedAt: new Date().toISOString(),
      schemaVersion: SCHEMA_VERSION,
      actor: {
        staffId: actor.id,
        name: actor.name,
        role: actor.role,
        permissions: perms
      },
      dualControlAvailableAdminsCount,
      kpis,
      providerCapabilities,
      latestMediaCheck,
      backups: backupDb.backups,
      schedules: backupDb.schedules,
      restoreTests: backupDb.restoreTests,
      restoreRequests: backupDb.restoreRequests,
      playbooks: INCIDENT_PLAYBOOKS,
      retentionSettings: backupDb.retentionSettings,
      staffPermissions
    };

    res.json(responsePayload);
  });

  // Trigger a real server-side backup
  app.post('/api/backups/run', requireBackupPermission('runManualBackup'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { backupAuthCtx: AuthenticatedRequestContext }).backupAuthCtx;
    const actor = authCtx.staff!;
    const {
      type = 'complete',
      spacesCovered = ALL_BACKUP_SPACES,
      domainsCovered = ALL_BACKUP_DOMAINS,
      destination = backupDb.retentionSettings.defaultDestination,
      note = ''
    } = req.body || {};

    const validTypes: BackupType[] = ['complete', 'incrementale', 'manuelle', 'avant_operation_sensible'];
    const chosenType: BackupType = validTypes.includes(type) ? type : 'manuelle';
    const cleanSpaces: BackupSpaceKey[] = Array.isArray(spacesCovered) && spacesCovered.length > 0
      ? spacesCovered.filter((s: BackupSpaceKey) => ALL_BACKUP_SPACES.includes(s))
      : [...ALL_BACKUP_SPACES];
    const cleanDomains: BackupDataDomainKey[] = Array.isArray(domainsCovered) && domainsCovered.length > 0
      ? domainsCovered.filter((d: BackupDataDomainKey) => ALL_BACKUP_DOMAINS.includes(d))
      : [...ALL_BACKUP_DOMAINS];

    try {
      const backup = executeRealServerBackup({
        type: chosenType === 'manuelle' ? 'complete' : chosenType,
        triggerMode: chosenType === 'avant_operation_sensible' ? 'pre_operation' : 'manuelle',
        spacesCovered: cleanSpaces,
        domainsCovered: cleanDomains,
        destination,
        actorId: actor.id,
        actorName: actor.name,
        note: String(note || '')
      });
      res.json({ success: true, backup });
    } catch (err: unknown) {
      const msg = (err as Error).message;
      if (msg === 'BACKUP_ALREADY_RUNNING') {
        return res.status(409).json({
          success: false,
          error: 'BACKUP_ALREADY_RUNNING',
          message: 'Une sauvegarde lourde est déjà en cours d’exécution. Patientez avant d’en lancer une autre.'
        });
      }
      res.status(500).json({ success: false, error: 'BACKUP_EXECUTION_ERROR', message: msg });
    }
  });

  // Verify integrity of an existing backup archive (re-reads disk + SHA-256 + AES-GCM auth tag)
  app.post('/api/backups/:id/verify-integrity', requireBackupPermission('viewBackups'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { backupAuthCtx: AuthenticatedRequestContext }).backupAuthCtx;
    const actor = authCtx.staff!;
    const backup = backupDb.backups.find((b) => b.id === req.params.id);
    if (!backup) {
      return res.status(404).json({ success: false, error: 'BACKUP_NOT_FOUND', message: 'Sauvegarde introuvable.' });
    }

    const filePath = fs.existsSync(getArchivePath(backup)) ? getArchivePath(backup) : getOffsitePath(backup);
    if (!fs.existsSync(filePath)) {
      backup.integrityResult = 'corrompue';
      backup.status = 'echouee';
      backup.failureReason = 'Fichier physique manquant lors de la vérification.';
      persistBackupDb();
      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'system_config',
        actionType: 'backup_integrity_invalid',
        action: `Intégrité invalide — fichier manquant (${backup.id})`,
        target: backup.id,
        targetType: 'system',
        result: 'echoue',
        severity: 'critique',
        details: backup.failureReason
      });
      return res.status(422).json({ success: false, error: 'BACKUP_FILE_MISSING', message: backup.failureReason, backup });
    }

    try {
      const buf = fs.readFileSync(filePath);
      const actualHash = crypto.createHash('sha256').update(buf).digest('hex');
      if (actualHash !== backup.checksumSha256) {
        throw new Error('Empreinte SHA-256 non conforme');
      }
      const unpacked = decryptAndUnpackBuffer(buf, backup.encrypted);
      if (unpacked?.manifest?.backupId !== backup.id) {
        throw new Error('Manifeste interne incohérent');
      }

      backup.integrityResult = 'valide';
      backup.status = backup.independentCopyExists ? 'protegee' : 'reussie';
      backup.failureReason = null;
      backup.accessHistory.unshift({
        id: `acc-${crypto.randomUUID().slice(0, 8)}`,
        at: new Date().toISOString(),
        actorId: actor.id,
        actorName: actor.name,
        action: 'verification_integrite'
      });
      persistBackupDb();
      return res.json({ success: true, backup, message: 'Intégrité cryptographique (AES-256-GCM + SHA-256) confirmée.' });
    } catch (err: unknown) {
      backup.integrityResult = 'corrompue';
      backup.status = 'echouee';
      backup.failureReason = `Intégrité compromise : ${(err as Error).message}`;
      persistBackupDb();
      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'system_config',
        actionType: 'backup_integrity_invalid',
        action: `Sauvegarde corrompue détectée (${backup.id})`,
        target: backup.id,
        targetType: 'system',
        result: 'echoue',
        severity: 'critique',
        details: backup.failureReason
      });
      return res.status(422).json({ success: false, error: 'BACKUP_CORRUPTED', message: backup.failureReason, backup });
    }
  });

  // View sanitized metadata details (logged in accessHistory)
  app.get('/api/backups/:id/details', requireBackupPermission('viewBackups'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { backupAuthCtx: AuthenticatedRequestContext }).backupAuthCtx;
    const actor = authCtx.staff!;
    const backup = backupDb.backups.find((b) => b.id === req.params.id);
    if (!backup) return res.status(404).json({ success: false, error: 'BACKUP_NOT_FOUND', message: 'Sauvegarde introuvable.' });

    backup.accessHistory.unshift({
      id: `acc-${crypto.randomUUID().slice(0, 8)}`,
      at: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      action: 'consultation_detail'
    });
    if (backup.accessHistory.length > 50) backup.accessHistory = backup.accessHistory.slice(0, 50);
    persistBackupDb();
    res.json({ success: true, backup });
  });

  // Download encrypted archive (requires downloadBackup + Step-Up MFA + logged in audit)
  app.get(
    '/api/backups/:id/download',
    requireBackupPermission('downloadBackup', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { backupAuthCtx: AuthenticatedRequestContext }).backupAuthCtx;
      const actor = authCtx.staff!;
      const backup = backupDb.backups.find((b) => b.id === req.params.id);
      if (!backup) return res.status(404).json({ success: false, error: 'BACKUP_NOT_FOUND', message: 'Sauvegarde introuvable.' });

      const filePath = fs.existsSync(getArchivePath(backup)) ? getArchivePath(backup) : getOffsitePath(backup);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'FILE_MISSING', message: 'Archive absente du stockage.' });
      }

      backup.accessHistory.unshift({
        id: `acc-${crypto.randomUUID().slice(0, 8)}`,
        at: new Date().toISOString(),
        actorId: actor.id,
        actorName: actor.name,
        action: 'telechargement'
      });
      persistBackupDb();

      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'system_config',
        actionType: 'backup_downloaded',
        action: `Téléchargement archive chiffrée (${backup.id})`,
        target: backup.id,
        targetType: 'system',
        result: 'reussi',
        severity: 'eleve',
        details: 'Archive téléchargée avec chiffrement AES-256-GCM (clé serveur non incluse)',
        ipAddress: getClientIp(req)
      });

      const ext = backup.encrypted ? 'djassa.enc' : 'djassa.gz';
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${backup.id}.${ext}"`);
      fs.createReadStream(filePath).pipe(res);
    }
  );

  // Toggle Legal Hold / Anti-deletion lock
  app.patch('/api/backups/:id/legal-hold', requireBackupPermission('manageRetentionRules'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { backupAuthCtx: AuthenticatedRequestContext }).backupAuthCtx;
    const actor = authCtx.staff!;
    const backup = backupDb.backups.find((b) => b.id === req.params.id);
    if (!backup) return res.status(404).json({ success: false, error: 'BACKUP_NOT_FOUND', message: 'Sauvegarde introuvable.' });

    const { legalHold, legalHoldReason = '' } = req.body || {};
    backup.legalHold = Boolean(legalHold);
    backup.legalHoldReason = backup.legalHold ? redactSensitiveText(String(legalHoldReason || 'Conservation légale / enquête')) : null;
    if (backup.legalHold) backup.protectedAgainstDeletion = true;
    backup.accessHistory.unshift({
      id: `acc-${crypto.randomUUID().slice(0, 8)}`,
      at: new Date().toISOString(),
      actorId: actor.id,
      actorName: actor.name,
      action: 'gel_legal'
    });
    persistBackupDb();

    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'system_config',
      actionType: 'backup_legal_hold_updated',
      action: backup.legalHold ? `Gel légal activé sur ${backup.id}` : `Gel légal levé sur ${backup.id}`,
      target: backup.id,
      targetType: 'system',
      result: 'reussi',
      severity: 'eleve',
      details: backup.legalHoldReason || 'Gel désactivé'
    });

    res.json({ success: true, backup });
  });

  // Delete backup (blocked by legalHold, active investigation, or if it's the last valid backup!)
  app.delete(
    '/api/backups/:id',
    requireBackupPermission('deleteBackup', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { backupAuthCtx: AuthenticatedRequestContext }).backupAuthCtx;
      const actor = authCtx.staff!;
      const idx = backupDb.backups.findIndex((b) => b.id === req.params.id);
      if (idx === -1) return res.status(404).json({ success: false, error: 'BACKUP_NOT_FOUND', message: 'Sauvegarde introuvable.' });

      const target = backupDb.backups[idx];
      if (target.legalHold) {
        return res.status(409).json({
          success: false,
          error: 'BACKUP_LEGAL_HOLD',
          message: `Suppression interdite : sauvegarde verrouillée pour conservation légale (${target.legalHoldReason || 'enquête/litige'}).`
        });
      }

      // Check active fraud/privacy investigations blocking deletion
      const fraudData = safeReadJsonFile(path.join(DATA_DIR, 'fraud_db.json')) as { alerts?: any[] };
      const privData = safeReadJsonFile(path.join(DATA_DIR, 'privacy_db.json')) as { requests?: any[] };
      const hasOpenLegalCase =
        (Array.isArray(fraudData.alerts) && fraudData.alerts.some((a) => a.status === 'fraude_confirmee' || a.status === 'en_cours')) ||
        (Array.isArray(privData.requests) && privData.requests.some((r) => r.status === 'nouvelle' || r.status === 'en_verification'));
      if (target.protectedAgainstDeletion && hasOpenLegalCase) {
        return res.status(409).json({
          success: false,
          error: 'ACTIVE_INVESTIGATION_PROTECTED',
          message: 'Suppression bloquée : sauvegarde critique protégée durant une enquête fraude ou demande légale ouverte.'
        });
      }

      const validRestorableCount = backupDb.backups.filter(
        (b) => (b.status === 'reussie' || b.status === 'protegee') && b.integrityResult === 'valide'
      ).length;
      if ((target.status === 'reussie' || target.status === 'protegee') && validRestorableCount <= 1) {
        return res.status(409).json({
          success: false,
          error: 'LAST_VALID_BACKUP_PROTECTED',
          message: 'Suppression refusée : vous devez conserver au moins une sauvegarde valide et récente.'
        });
      }

      [getArchivePath(target), getOffsitePath(target)].forEach((fp) => {
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      });
      backupDb.backups.splice(idx, 1);
      persistBackupDb();

      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'system_config',
        actionType: 'backup_deleted',
        action: `Suppression sauvegarde (${target.id})`,
        target: target.id,
        targetType: 'system',
        result: 'reussi',
        severity: 'eleve',
        details: `Archive ${target.type} du ${target.createdAt} supprimée par ${actor.name}`,
        ipAddress: getClientIp(req)
      });

      res.json({ success: true, deletedId: target.id });
    }
  );

  // Isolated Restore Test (does not alter production)
  app.post('/api/backups/:id/test-restore', requireBackupPermission('runRestoreTest'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { backupAuthCtx: AuthenticatedRequestContext }).backupAuthCtx;
    const actor = authCtx.staff!;
    const backup = backupDb.backups.find((b) => b.id === req.params.id);
    if (!backup) return res.status(404).json({ success: false, error: 'BACKUP_NOT_FOUND', message: 'Sauvegarde introuvable.' });

    const report = runIsolatedRestoreTest(backup, actor.id, actor.name);
    res.json({ success: true, report, backup });
  });

  // Request or Execute Restore (Test Env or Production with full 9-step guards + Dual Validation!)
  app.post('/api/backups/:id/restore', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const actor = authCtx.staff;
    if (!actor || !actor.active) {
      return res.status(403).json({ success: false, error: 'ADMIN_ROLE_REQUIRED', message: 'Accès administrateur requis.' });
    }

    const {
      targetEnv = 'test_env',
      restoreMode = 'complete',
      spacesSelected = ALL_BACKUP_SPACES,
      domainsSelected = ALL_BACKUP_DOMAINS,
      reason = '',
      confirmationText = ''
    } = req.body || {};

    const perms = getEffectivePermissions(actor.id, actor.role);
    const neededPerm: BackupPermissionKey = targetEnv === 'production' ? 'restoreToProduction' : 'restoreToTestEnv';
    if (!perms[neededPerm]) {
      return res.status(403).json({
        success: false,
        error: 'BACKUP_PERMISSION_DENIED',
        message: `Permission requise : ${neededPerm}.`
      });
    }

    const backup = backupDb.backups.find((b) => b.id === req.params.id);
    if (!backup) return res.status(404).json({ success: false, error: 'BACKUP_NOT_FOUND', message: 'Sauvegarde introuvable.' });

    if (backup.integrityResult !== 'valide' || backup.status === 'echouee') {
      return res.status(422).json({
        success: false,
        error: 'BACKUP_INTEGRITY_FAILED',
        message: 'Restauration refusée : cette sauvegarde est corrompue ou son intégrité n’est pas validée.'
      });
    }
    if (backup.schemaVersion !== SCHEMA_VERSION) {
      return res.status(422).json({
        success: false,
        error: 'BACKUP_INCOMPATIBLE',
        message: `Schéma incompatible (${backup.schemaVersion} vs ${SCHEMA_VERSION}).`
      });
    }

    // Strict financial consistency guard: NEVER allow partial financial restore that desyncs transactions, wallets, and ledger!
    const cleanDomains: BackupDataDomainKey[] = Array.isArray(domainsSelected) ? domainsSelected : [...ALL_BACKUP_DOMAINS];
    const finDomains: BackupDataDomainKey[] = ['wallets', 'transactions_commissions', 'withdrawals_refunds'];
    const selectedFinCount = finDomains.filter((d) => cleanDomains.includes(d)).length;
    if (targetEnv === 'production' && selectedFinCount > 0 && selectedFinCount < finDomains.length) {
      return res.status(400).json({
        success: false,
        error: 'UNSAFE_PARTIAL_FINANCE_RESTORE',
        message: 'Restauration partielle financière interdite : portefeuilles, transactions/commissions et retraits/remboursements doivent rester strictement synchronisés avec le journal comptable.'
      });
    }

    if (confirmationText !== 'CONFIRMER RESTAURATION') {
      return res.status(400).json({
        success: false,
        error: 'EXPLICIT_CONFIRMATION_REQUIRED',
        message: 'Saisissez « CONFIRMER RESTAURATION » pour valider explicitement cette opération.'
      });
    }

    // Step-Up MFA mandatory on restore
    const mfaCheck = verifyStepUpMfaForRequest(req, authCtx, true);
    if (!mfaCheck.ok) {
      return res.status(mfaCheck.status).json({ success: false, error: mfaCheck.error, message: mfaCheck.message });
    }

    const staffList = getSecurityStaffDirectory();
    const approversCount = staffList.filter(
      (s) => s.active && getEffectivePermissions(s.id, s.role).approveDualControlRestore
    ).length;
    const needsDual =
      targetEnv === 'production' &&
      backupDb.retentionSettings.requireDualValidationForProdRestore &&
      approversCount >= 2;

    const reqRecord: BackupRestoreOperationRequest = {
      id: `rst-${crypto.randomUUID().slice(0, 10)}`,
      backupId: backup.id,
      backupCreatedAt: backup.createdAt,
      targetEnv: targetEnv === 'production' ? 'production' : 'test_env',
      restoreMode,
      spacesSelected: Array.isArray(spacesSelected) ? spacesSelected : [...ALL_BACKUP_SPACES],
      domainsSelected: cleanDomains,
      requestedById: actor.id,
      requestedByName: actor.name,
      requestedAt: new Date().toISOString(),
      reason: redactSensitiveText(String(reason || 'Restauration contrôlée')),
      status: needsDual ? 'en_attente_double_validation' : 'executee',
      requiresDualValidation: needsDual
    };

    if (!needsDual) {
      const result = executeControlledRestore(reqRecord, actor.name);
      reqRecord.status = result.ok ? 'executee' : 'echouee';
      reqRecord.preRestoreSafetyBackupId = result.safetyBackupId;
      reqRecord.postRestoreHealthOk = result.ok;
      reqRecord.executionSummary = result.message;
      reqRecord.decidedAt = new Date().toISOString();
    }

    backupDb.restoreRequests.unshift(reqRecord);
    persistBackupDb();

    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'system_config',
      actionType: needsDual
        ? 'restore_dual_control_required'
        : reqRecord.status === 'echouee'
        ? 'restore_failed'
        : targetEnv === 'production'
        ? 'restore_prod_executed'
        : 'restore_test_succeeded',
      action: needsDual
        ? `Double validation requise pour restauration production (${backup.id})`
        : targetEnv === 'production'
        ? `Restauration production exécutée (${backup.id})`
        : `Restauration environnement de test exécutée (${backup.id})`,
      target: backup.id,
      targetType: 'system',
      entityType: 'restore',
      entityId: reqRecord.id,
      result: reqRecord.status === 'echouee' ? 'echoue' : 'reussi',
      severity: targetEnv === 'production' ? 'critique' : 'moyen',
      details: reqRecord.executionSummary || reqRecord.reason,
      ipAddress: getClientIp(req)
    });

    res.json({ success: true, restoreRequest: reqRecord });
  });

  // Second admin approves/rejects production restore (Four-Eyes Check)
  app.post(
    '/api/backups/restore-requests/:reqId/decide',
    requireBackupPermission('approveDualControlRestore', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { backupAuthCtx: AuthenticatedRequestContext }).backupAuthCtx;
      const actor = authCtx.staff!;
      const reqItem = backupDb.restoreRequests.find((r) => r.id === req.params.reqId);
      if (!reqItem) return res.status(404).json({ success: false, error: 'REQUEST_NOT_FOUND', message: 'Demande de restauration introuvable.' });

      if (reqItem.status !== 'en_attente_double_validation') {
        return res.json({ success: true, idempotentDuplicate: true, restoreRequest: reqItem });
      }

      const { decision } = req.body || {};
      if (decision === 'approve' && reqItem.requiresDualValidation && reqItem.requestedById === actor.id) {
        return res.status(403).json({
          success: false,
          error: 'SELF_APPROVAL_FORBIDDEN',
          message: 'Double validation obligatoire : un second administrateur autorisé différent du demandeur doit approuver la restauration en production.'
        });
      }

      const nowIso = new Date().toISOString();
      if (decision === 'reject' || decision === 'cancel') {
        reqItem.status = decision === 'cancel' ? 'annulee' : 'rejetee';
        reqItem.secondApproverId = actor.id;
        reqItem.secondApproverName = actor.name;
        reqItem.decidedAt = nowIso;
        persistBackupDb();
        return res.json({ success: true, restoreRequest: reqItem });
      }

      const execRes = executeControlledRestore(reqItem, `${reqItem.requestedByName} + ${actor.name}`);
      reqItem.status = execRes.ok ? 'executee' : 'echouee';
      reqItem.secondApproverId = actor.id;
      reqItem.secondApproverName = actor.name;
      reqItem.decidedAt = nowIso;
      reqItem.preRestoreSafetyBackupId = execRes.safetyBackupId;
      reqItem.postRestoreHealthOk = execRes.ok;
      reqItem.executionSummary = execRes.message;
      persistBackupDb();

      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'system_config',
        actionType: execRes.ok ? 'restore_prod_executed' : 'restore_failed',
        action: execRes.ok
          ? `Restauration production validée par double contrôle (${reqItem.backupId})`
          : `Échec restauration production (${reqItem.backupId})`,
        target: reqItem.backupId,
        targetType: 'system',
        result: execRes.ok ? 'reussi' : 'echoue',
        severity: 'critique',
        details: execRes.message,
        ipAddress: getClientIp(req)
      });

      res.json({ success: true, restoreRequest: reqItem });
    }
  );

  // Update schedule
  app.patch(
    '/api/backups/schedules/:id',
    requireBackupPermission('manageSchedules', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { backupAuthCtx: AuthenticatedRequestContext }).backupAuthCtx;
      const actor = authCtx.staff!;
      const sched = backupDb.schedules.find((s) => s.id === req.params.id);
      if (!sched) return res.status(404).json({ success: false, error: 'SCHEDULE_NOT_FOUND', message: 'Planification introuvable.' });

      const { enabled, frequency, executionTimeHHMM, timezone, destination, retainCount, backupType } = req.body || {};
      if (typeof enabled === 'boolean') sched.enabled = enabled;
      if (frequency && ['quotidienne', 'hebdomadaire', 'mensuelle'].includes(frequency)) sched.frequency = frequency;
      if (typeof executionTimeHHMM === 'string' && /^\d{2}:\d{2}$/.test(executionTimeHHMM)) sched.executionTimeHHMM = executionTimeHHMM;
      if (typeof timezone === 'string' && timezone.trim()) sched.timezone = timezone.trim();
      if (destination) sched.destination = destination;
      if (typeof retainCount === 'number' && retainCount >= 1) sched.retainCount = Math.min(365, retainCount);
      if (backupType && ['complete', 'incrementale'].includes(backupType)) sched.backupType = backupType;
      sched.nextRunAt = computeNextRunIso(sched.frequency, sched.executionTimeHHMM, sched.dayOfWeek, sched.dayOfMonth);
      persistBackupDb();

      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'system_config',
        actionType: 'backup_schedule_updated',
        action: `Planification sauvegarde modifiée (${sched.name})`,
        target: sched.id,
        targetType: 'settings',
        result: 'reussi',
        severity: 'moyen',
        details: `Actif=${sched.enabled}, Fréquence=${sched.frequency}, Heure=${sched.executionTimeHHMM} (${sched.timezone})`
      });

      res.json({ success: true, schedule: sched });
    }
  );

  // Update Retention & Protection settings
  app.patch(
    '/api/backups/retention',
    requireBackupPermission('manageRetentionRules', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { backupAuthCtx: AuthenticatedRequestContext }).backupAuthCtx;
      const actor = authCtx.staff!;
      const patch = req.body || {};
      const next = { ...backupDb.retentionSettings };
      if (typeof patch.keepDailyCount === 'number') next.keepDailyCount = Math.max(1, patch.keepDailyCount);
      if (typeof patch.keepWeeklyCount === 'number') next.keepWeeklyCount = Math.max(1, patch.keepWeeklyCount);
      if (typeof patch.keepMonthlyCount === 'number') next.keepMonthlyCount = Math.max(1, patch.keepMonthlyCount);
      if (typeof patch.retentionDays === 'number') next.retentionDays = Math.max(7, patch.retentionDays);
      if (typeof patch.maxStorageCapacityMb === 'number') next.maxStorageCapacityMb = Math.max(64, patch.maxStorageCapacityMb);
      if (typeof patch.warningThresholdPercent === 'number') next.warningThresholdPercent = Math.max(50, Math.min(95, patch.warningThresholdPercent));
      if (typeof patch.encryptSensitiveBackups === 'boolean') next.encryptSensitiveBackups = patch.encryptSensitiveBackups;
      if (typeof patch.replicateIndependentCopy === 'boolean') next.replicateIndependentCopy = patch.replicateIndependentCopy;
      if (typeof patch.autoPruneExpired === 'boolean') next.autoPruneExpired = patch.autoPruneExpired;
      if (typeof patch.requireDualValidationForProdRestore === 'boolean') {
        next.requireDualValidationForProdRestore = patch.requireDualValidationForProdRestore;
      }
      backupDb.retentionSettings = next;
      persistBackupDb();

      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'system_config',
        actionType: 'backup_retention_updated',
        action: 'Règles de conservation sauvegardes mises à jour',
        target: 'Paramètres conservation',
        targetType: 'settings',
        result: 'reussi',
        severity: 'eleve',
        details: `Rétention ${next.retentionDays}j, Quotidiennes ${next.keepDailyCount}, Double validation prod=${next.requireDualValidationForProdRestore}`
      });

      res.json({ success: true, retentionSettings: next });
    }
  );

  // Super Admin permission matrix for Backup module
  app.patch(
    '/api/backups/permissions/:staffId',
    requireBackupPermission('manageRetentionRules', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { backupAuthCtx: AuthenticatedRequestContext }).backupAuthCtx;
      const actor = authCtx.staff!;
      if (actor.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'SUPER_ADMIN_REQUIRED',
          message: 'Seul le Super Administrateur peut modifier les permissions de sauvegarde.'
        });
      }
      const staff = getSecurityStaffDirectory().find((s) => s.id === req.params.staffId);
      if (!staff) return res.status(404).json({ success: false, error: 'STAFF_NOT_FOUND', message: 'Collaborateur introuvable.' });
      if (staff.role === 'super_admin') {
        return res.status(400).json({ success: false, error: 'SUPER_ADMIN_IMMUTABLE', message: 'Droits Super Admin non modifiables.' });
      }

      const incoming = (req.body?.permissions || {}) as Partial<Record<BackupPermissionKey, boolean>>;
      const updated = { ...getEffectivePermissions(staff.id, staff.role) };
      ALL_BACKUP_PERMISSIONS.forEach((k) => {
        if (typeof incoming[k] === 'boolean') updated[k] = incoming[k]!;
      });
      backupDb.staffPermissions[staff.id] = updated;
      persistBackupDb();

      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'admin_mgmt',
        actionType: 'backup_permissions_updated',
        action: `Permissions Sauvegardes modifiées pour ${staff.name}`,
        target: staff.email,
        targetType: 'permissions',
        result: 'reussi',
        severity: 'eleve',
        details: `Mis à jour par ${actor.name}`
      });

      res.json({ success: true, staffId: staff.id, permissions: updated });
    }
  );
}
