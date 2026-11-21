import type { SecurityRole } from './security';

export type BackupStatus =
  | 'protegee'
  | 'en_cours'
  | 'reussie'
  | 'echouee'
  | 'incomplete'
  | 'a_verifier';

export type BackupType =
  | 'complete'
  | 'incrementale'
  | 'automatique'
  | 'manuelle'
  | 'avant_operation_sensible';

export type BackupSpaceKey = 'client' | 'seller' | 'driver' | 'company' | 'admin';

export type BackupDataDomainKey =
  | 'accounts_profiles'
  | 'shops_products'
  | 'orders'
  | 'messages_discussions'
  | 'deliveries'
  | 'companies_drivers'
  | 'wallets'
  | 'transactions_commissions'
  | 'withdrawals_refunds'
  | 'business_settings'
  | 'activity_history'
  | 'documents_pod_media';

export type BackupDestinationType =
  | 'serveur_local_chiffre'
  | 'copie_independante_froid'
  | 'cloudflare_r2_replication';

export type BackupPermissionKey =
  | 'viewBackups'
  | 'runManualBackup'
  | 'manageSchedules'
  | 'downloadBackup'
  | 'runRestoreTest'
  | 'restoreToTestEnv'
  | 'restoreToProduction'
  | 'deleteBackup'
  | 'manageRetentionRules'
  | 'approveDualControlRestore';

export type IntegrityResult = 'valide' | 'corrompue' | 'non_verifiee';

export interface BackupSpaceSummary {
  space: BackupSpaceKey;
  label: string;
  accountsCount: number;
  entitiesCount: number;
  included: boolean;
}

export interface BackupMediaCheckSummary {
  totalReferencedFiles: number;
  verifiedLocalFiles: number;
  externalRemoteUrls: number;
  missingOrBrokenCount: number;
  totalBytes: number;
  r2Configured: boolean;
  r2StatusDetail: string;
  categories: Array<{
    key: string;
    label: string;
    count: number;
    verifiedCount: number;
    missingCount: number;
  }>;
  missingSamples: string[];
}

export interface BackupRecord {
  id: string;
  createdAt: string;
  completedAt: string | null;
  type: BackupType;
  triggerMode: 'manuelle' | 'planifiee' | 'pre_operation';
  status: BackupStatus;
  integrityResult: IntegrityResult;
  schemaVersion: string;
  appVersionSnapshot: string;
  baseBackupId: string | null;
  spacesCovered: BackupSpaceKey[];
  domainsCovered: BackupDataDomainKey[];
  domainHashes: Record<string, string>;
  spaceStats: BackupSpaceSummary[];
  recordsCount: number;
  rawBytes: number;
  storedBytes: number;
  encrypted: boolean;
  encryptionAlgorithm: string;
  checksumSha256: string;
  destination: BackupDestinationType;
  localFileExists: boolean;
  independentCopyExists: boolean;
  durationMs: number;
  triggeredById: string;
  triggeredByName: string;
  note: string;
  failureReason: string | null;
  protectedAgainstDeletion: boolean;
  legalHold: boolean;
  legalHoldReason: string | null;
  verifiedRestorable: boolean;
  lastRestoreTestAt: string | null;
  lastRestoreTestResult: 'reussi' | 'echoue' | 'non_teste';
  mediaSummary: BackupMediaCheckSummary;
  accessHistory: Array<{
    id: string;
    at: string;
    actorId: string;
    actorName: string;
    action: 'consultation_detail' | 'telechargement' | 'verification_integrite' | 'test_restauration' | 'restauration_test' | 'restauration_prod' | 'gel_legal';
  }>;
}

export interface BackupScheduleRule {
  id: string;
  name: string;
  frequency: 'quotidienne' | 'hebdomadaire' | 'mensuelle';
  enabled: boolean;
  backupType: 'complete' | 'incrementale';
  executionTimeHHMM: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timezone: string;
  spacesCovered: BackupSpaceKey[];
  domainsCovered: BackupDataDomainKey[];
  destination: BackupDestinationType;
  retainCount: number;
  lastRunAt: string | null;
  lastRunStatus: 'reussie' | 'echouee' | 'jamais';
  nextRunAt: string;
}

export interface BackupRestoreTestReport {
  id: string;
  backupId: string;
  executedAt: string;
  executedById: string;
  executedByName: string;
  isolatedTarget: string;
  durationMs: number;
  result: 'reussi' | 'echoue';
  checks: {
    archiveReadableAndDecrypted: boolean;
    checksumMatched: boolean;
    schemaCompatible: boolean;
    relationalConsistencyOk: boolean;
    financialLedgerConsistent: boolean;
    mediaReferencesVerified: boolean;
    appCompatibilityOk: boolean;
  };
  errorsDetected: string[];
  summary: string;
}

export interface BackupRestoreOperationRequest {
  id: string;
  backupId: string;
  backupCreatedAt: string;
  targetEnv: 'test_env' | 'production';
  restoreMode: 'complete' | 'perimetre' | 'metier' | 'medias';
  spacesSelected: BackupSpaceKey[];
  domainsSelected: BackupDataDomainKey[];
  requestedById: string;
  requestedByName: string;
  requestedAt: string;
  reason: string;
  status:
    | 'en_attente_double_validation'
    | 'executee'
    | 'echouee'
    | 'rejetee'
    | 'annulee';
  requiresDualValidation: boolean;
  secondApproverId?: string | null;
  secondApproverName?: string | null;
  decidedAt?: string | null;
  preRestoreSafetyBackupId?: string | null;
  postRestoreHealthOk?: boolean;
  executionSummary?: string | null;
}

export interface BackupIncidentPlaybook {
  id: string;
  code: string;
  title: string;
  severity: 'eleve' | 'critique';
  description: string;
  recommendedBackupType: string;
  autoDestructiveRestoreAllowed: boolean;
  steps: string[];
}

export interface BackupRetentionSettings {
  keepDailyCount: number;
  keepWeeklyCount: number;
  keepMonthlyCount: number;
  retentionDays: number;
  maxStorageCapacityMb: number;
  warningThresholdPercent: number;
  defaultDestination: BackupDestinationType;
  encryptSensitiveBackups: boolean;
  replicateIndependentCopy: boolean;
  autoPruneExpired: boolean;
  requireDualValidationForProdRestore: boolean;
}

export interface BackupProviderCapabilities {
  backendStorage: {
    provider: string;
    configured: boolean;
    realDirectory: string;
    independentCopyDirectory: string;
    capabilities: string;
    limits: string;
  };
  supabase: {
    provider: string;
    configured: boolean;
    capabilities: string;
    limits: string;
  };
  cloudflareR2: {
    provider: string;
    configured: boolean;
    capabilities: string;
    limits: string;
  };
  encryption: {
    algorithm: string;
    keyManagedOutsideBackups: boolean;
    keyLocationNote: string;
  };
}

export interface BackupDashboardKpis {
  overallStatus: BackupStatus;
  protectionStateLabel: string;
  lastSuccessfulBackupAt: string | null;
  nextScheduledBackupAt: string | null;
  availableBackupsCount: number;
  failedBackupsCount: number;
  totalBackedUpBytes: number;
  storageUsedBytes: number;
  storageLimitBytes: number;
  storageUsagePercent: number;
  lastRestoreTestAt: string | null;
  lastRestoreTestResult: 'reussi' | 'echoue' | 'non_teste';
  untestedBackupsCount: number;
  activeJobRunning: boolean;
}

export interface BackupStaffPermissionRow {
  staffId: string;
  name: string;
  email: string;
  role: SecurityRole;
  title: string;
  active: boolean;
  mfaEnabled: boolean;
  permissions: Record<BackupPermissionKey, boolean>;
}

export interface BackupOverviewResponse {
  success: boolean;
  generatedAt: string;
  schemaVersion: string;
  actor: {
    staffId: string;
    name: string;
    role: SecurityRole;
    permissions: Record<BackupPermissionKey, boolean>;
  };
  dualControlAvailableAdminsCount: number;
  kpis: BackupDashboardKpis;
  providerCapabilities: BackupProviderCapabilities;
  latestMediaCheck: BackupMediaCheckSummary;
  backups: BackupRecord[];
  schedules: BackupScheduleRule[];
  restoreTests: BackupRestoreTestReport[];
  restoreRequests: BackupRestoreOperationRequest[];
  playbooks: BackupIncidentPlaybook[];
  retentionSettings: BackupRetentionSettings;
  staffPermissions: BackupStaffPermissionRow[];
}
