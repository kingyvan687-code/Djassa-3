import type { SecurityRole } from './security';

export type DjassaAppId = 'client' | 'seller' | 'admin';

export type AppEnvironment = 'development' | 'test' | 'production';

export type AppOperationalStatus = 'operationnel' | 'maintenance' | 'degrade' | 'indisponible';

export type VersionPublicationStatus =
  | 'en_preparation'
  | 'en_test'
  | 'prete_a_publier'
  | 'deployee'
  | 'echec'
  | 'annulee';

export type DeploymentStatus =
  | 'en_preparation'
  | 'en_attente_validation'
  | 'en_cours'
  | 'deploiement_progressif'
  | 'verification'
  | 'deployee'
  | 'echec'
  | 'annulee';

export type DeploymentChannel =
  | 'local_runtime_manifest'
  | 'cloudflare_pages_hook'
  | 'cloud_run_deploy_hook';

export type MaintenanceScope = 'individuelle' | 'globale';

export type MaintenanceWindowStatus = 'programmee' | 'active' | 'terminee' | 'annulee';

export type ServiceHealthStatus =
  | 'operationnel'
  | 'degrade'
  | 'indisponible'
  | 'maintenance'
  | 'non_verifie';

export type TechnicalErrorType =
  | 'frontend'
  | 'backend'
  | 'api'
  | 'database'
  | 'network'
  | 'deployment'
  | 'sync'
  | 'external_service';

export type TechnicalErrorSeverity = 'information' | 'faible' | 'moyen' | 'eleve' | 'critique';

export type TechnicalErrorStatus = 'nouvelle' | 'en_cours' | 'resolue' | 'ignoree';

export type MaintenancePermissionKey =
  | 'viewVersions'
  | 'viewTechnicalErrors'
  | 'scheduleMaintenance'
  | 'toggleMaintenance'
  | 'prepareDeployment'
  | 'validateDeployment'
  | 'executeRollback'
  | 'modifyTechnicalSettings';

export interface DjassaAppInfo {
  appId: DjassaAppId;
  name: string;
  shortName: string;
  description: string;
  currentVersion: string;
  buildNumber: string;
  environment: AppEnvironment;
  lastDeployedAt: string | null;
  status: AppOperationalStatus;
  lastUpdateSummary: string;
  lastDeploymentResult: 'reussi' | 'echec' | 'annule' | 'aucun';
  lastDeploymentId: string | null;
  activeVersionId: string | null;
  entryRoute: string;
}

export interface AppVersionRecord {
  id: string;
  appId: DjassaAppId;
  version: string;
  previousVersion: string | null;
  buildNumber: string;
  releaseDate: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  description: string;
  bugFixes: string[];
  newFeatures: string[];
  securityImprovements: string[];
  compatibility: {
    apiVersion: string;
    dbSchemaVersion: string;
    services: string[];
    notes: string;
  };
  migrationVersion: string;
  rollbackEligible: boolean;
  status: VersionPublicationStatus;
  targetEnv: AppEnvironment;
}

export interface DeploymentStepLog {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  at: string;
  details: string;
}

export interface DeploymentRecord {
  id: string;
  appId: DjassaAppId;
  appName: string;
  versionId: string;
  version: string;
  previousVersion: string | null;
  buildNumber: string;
  startedAt: string;
  completedAt: string | null;
  targetEnv: AppEnvironment;
  authorId: string;
  authorName: string;
  authorEmail: string;
  status: DeploymentStatus;
  rolloutMode: 'standard' | 'progressif';
  rolloutPercent: number;
  deployChannel: DeploymentChannel;
  durationMs: number | null;
  result: string;
  errorsEncountered: string[];
  steps: DeploymentStepLog[];
  preValidatedBy: string | null;
  preValidatedAt: string | null;
  postVerifiedAt: string | null;
  postVerificationPassed: boolean;
  postVerificationSummary: string | null;
  rollbackOfDeploymentId?: string | null;
  isRollback?: boolean;
}

export interface MaintenanceWindowRecord {
  id: string;
  scope: MaintenanceScope;
  appIds: DjassaAppId[];
  status: MaintenanceWindowStatus;
  startAt: string;
  endAt: string | null;
  actualEndedAt: string | null;
  estimatedDurationMinutes: number | null;
  customMessage: string;
  allowAuthorizedAdmins: boolean;
  exemptCriticalServices: boolean;
  createdById: string;
  createdByName: string;
  createdAt: string;
  endedByName?: string | null;
  reason: string;
}

export interface ServiceIncidentEntry {
  id: string;
  at: string;
  previousStatus: ServiceHealthStatus;
  newStatus: ServiceHealthStatus;
  message: string;
}

export interface ServiceHealthRecord {
  id: string;
  name: string;
  category: 'frontend' | 'core' | 'storage' | 'payment' | 'maps' | 'ai' | 'messaging';
  status: ServiceHealthStatus;
  configured: boolean;
  lastCheckedAt: string | null;
  responseTimeMs: number | null;
  uptimePercent: number | null;
  totalChecks: number;
  successfulChecks: number;
  lastError: string | null;
  configHint: string;
  incidentHistory: ServiceIncidentEntry[];
}

export interface TechnicalErrorRecord {
  id: string;
  appId: DjassaAppId | 'all';
  serviceId: string;
  serviceName: string;
  timestamp: string;
  lastOccurrenceAt: string;
  errorType: TechnicalErrorType;
  severity: TechnicalErrorSeverity;
  description: string;
  redactedLog: string;
  status: TechnicalErrorStatus;
  occurrenceCount: number;
  source: 'frontend_runtime' | 'express_backend' | 'health_probe' | 'deployment' | 'rollback' | 'external_provider';
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
}

export interface RollbackCheckItem {
  id: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  details: string;
}

export interface RollbackPreflightResult {
  eligible: boolean;
  requiresMfa: boolean;
  appId: DjassaAppId;
  currentVersion: string;
  targetVersion: AppVersionRecord | null;
  checks: RollbackCheckItem[];
  blockers: string[];
  warnings: string[];
}

export interface MaintenanceStaffPermissionRow {
  staffId: string;
  name: string;
  email: string;
  role: SecurityRole;
  title: string;
  active: boolean;
  mfaEnabled: boolean;
  permissions: Record<MaintenancePermissionKey, boolean>;
}

export interface TechnicalMaintenanceSettings {
  autoCheckEnabled: boolean;
  autoCheckIntervalSeconds: number;
  postDeployVerificationTimeoutMs: number;
  progressiveRolloutSupportedForManifest: boolean;
  notifySuperAdminOnOutage: boolean;
  notifySuperAdminOnCriticalError: boolean;
  maxErrorRetentionCount: number;
  currentDbSchemaVersion: string;
  currentApiVersion: string;
  updatedAt: string;
  updatedBy: string;
}

export interface InfrastructureReadinessReport {
  operationalNow: Array<{ title: string; details: string }>;
  requiresExternalConfig: Array<{ service: string; configured: boolean; missingKeys: string[]; note: string }>;
  remainingIntegrations: Array<{ title: string; details: string }>;
}

export interface MaintenanceOverviewResponse {
  success: boolean;
  actor: {
    id: string;
    name: string;
    email: string;
    role: SecurityRole;
    permissions: Record<MaintenancePermissionKey, boolean>;
  };
  apps: DjassaAppInfo[];
  versions: AppVersionRecord[];
  deployments: DeploymentRecord[];
  activeMaintenances: MaintenanceWindowRecord[];
  scheduledMaintenances: MaintenanceWindowRecord[];
  maintenanceHistory: MaintenanceWindowRecord[];
  services: ServiceHealthRecord[];
  errors: TechnicalErrorRecord[];
  settings: TechnicalMaintenanceSettings;
  permissionsDirectory: MaintenanceStaffPermissionRow[];
  readiness: InfrastructureReadinessReport;
  runtimeMeta: {
    nodeVersion: string;
    uptimeSeconds: number;
    memoryRssMb: number;
    environment: AppEnvironment;
    lastProbeAt: string | null;
  };
}

export interface PublicMaintenanceStatusResponse {
  success: boolean;
  serverTime: string;
  globalMaintenance: MaintenanceWindowRecord | null;
  appMaintenances: Record<DjassaAppId, MaintenanceWindowRecord | null>;
  appVersions: Record<DjassaAppId, { version: string; buildNumber: string; environment: AppEnvironment }>;
}
