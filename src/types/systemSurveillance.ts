import type { SecurityRole } from './security';
import type { DjassaAppId, ServiceHealthStatus } from './maintenance';

export type SystemGlobalState = 'operationnel' | 'degrade' | 'en_panne' | 'non_verifie';

export type AnomalySeverity = 'information' | 'avertissement' | 'critique';
export type AnomalyStatus = 'nouvelle' | 'en_cours' | 'resolue' | 'non_resolue';

export type SurveillancePermissionKey =
  | 'viewSurveillance'
  | 'runManualChecks'
  | 'manageAnomalies'
  | 'modifySurveillanceSettings';

export interface AppSurveillanceCard {
  appId: DjassaAppId;
  name: string;
  shortName: string;
  status: SystemGlobalState | 'maintenance';
  availabilityPercent: number | null;
  responseTimeMs: number | null;
  errorCount: number;
  lastCheckedAt: string | null;
  deployedVersion: string | null;
  buildNumber: string | null;
  environment: string;
  lastAnomalyDetected: string | null;
}

export interface ServiceSurveillanceRecord {
  id: string;
  name: string;
  category: string;
  status: ServiceHealthStatus;
  configured: boolean;
  availabilityPercent: number | null;
  responseTimeMs: number | null;
  lastCheckedAt: string | null;
  errorCount: number;
  errorMessage: string | null;
  lastKnownOutageAt: string | null;
  configHint: string;
}

export interface AnomalyInterventionEntry {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  action: string;
  statusAfter: AnomalyStatus;
  comment: string;
}

export interface DetectedAnomalyRecord {
  id: string;
  detectedAt: string;
  updatedAt: string;
  appId: DjassaAppId | 'all';
  serviceId: string;
  serviceName: string;
  severity: AnomalySeverity;
  category:
    | 'error_spike'
    | 'high_latency'
    | 'api_unreachable'
    | 'db_unavailable'
    | 'auth_failures'
    | 'payment_failure'
    | 'notification_failure'
    | 'storage_upload'
    | 'orders_sync'
    | 'geolocation'
    | 'deployment_failure'
    | 'resource_overload'
    | 'unconfigured_provider';
  title: string;
  description: string;
  technicalCause: string | null;
  status: AnomalyStatus;
  assignedToId: string | null;
  assignedToName: string | null;
  linkedAlertId: string | null;
  occurrenceCount: number;
  history: AnomalyInterventionEntry[];
}

export interface TechnicalAlertRecord {
  id: string;
  dedupKey: string;
  createdAt: string;
  updatedAt: string;
  severity: AnomalySeverity;
  serviceId: string;
  serviceName: string;
  appId: DjassaAppId | 'all';
  title: string;
  description: string;
  status: 'ouverte' | 'acquittee' | 'resolue';
  occurrenceCount: number;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  linkedAnomalyId: string | null;
}

export interface TechnicalLogEntry {
  id: string;
  timestamp: string;
  appId: DjassaAppId | 'all';
  serviceId: string;
  serviceName: string;
  severity: AnomalySeverity;
  status: 'ok' | 'degrade' | 'erreur' | 'critique';
  source: 'health_probe' | 'runtime_error' | 'security_auth' | 'deployment' | 'resource_monitor';
  message: string;
  redactedDetails: string;
}

export interface SystemIncidentHistoryEntry {
  id: string;
  at: string;
  resolvedAt: string | null;
  serviceId: string;
  serviceName: string;
  appId: DjassaAppId | 'all';
  type: 'panne' | 'latence' | 'erreur_api' | 'connexion' | 'degradation' | 'paiement' | 'sync' | 'reprise' | 'controle_sante';
  severity: AnomalySeverity;
  title: string;
  details: string;
  status: 'ouvert' | 'resolu';
  durationSeconds: number | null;
}

export interface RuntimeResourceSnapshot {
  collectedAt: string;
  rssMb: number;
  heapUsedMb: number;
  heapTotalMb: number;
  systemMemUsedPercent: number;
  systemMemTotalMb: number;
  cpuCount: number;
  loadAvg1m: number;
  uptimeSeconds: number;
  nodeVersion: string;
}

export interface SurveillanceSettings {
  autoCheckEnabled: boolean;
  checkIntervalSeconds: number;
  latencyWarnMs: number;
  latencyCriticalMs: number;
  errorSpikeThreshold: number;
  memoryWarnPercent: number;
  authFailureSpikeThreshold: number;
  notifyOnCritical: boolean;
  notifyOnWarning: boolean;
  maxLogsRetention: number;
  updatedAt: string;
  updatedBy: string;
}

export interface SurveillanceStaffPermissionRow {
  staffId: string;
  name: string;
  email: string;
  role: SecurityRole;
  active: boolean;
  permissions: Record<SurveillancePermissionKey, boolean>;
}

export interface SystemSurveillanceOverviewResponse {
  success: boolean;
  serverTime: string;
  kpis: {
    globalState: SystemGlobalState;
    globalAvailabilityPercent: number | null;
    operationalServicesCount: number;
    degradedServicesCount: number;
    unavailableServicesCount: number;
    unverifiedServicesCount: number;
    recentErrorsCount: number;
    averageResponseTimeMs: number | null;
    lastSystemCheckAt: string | null;
    openAnomaliesCount: number;
    openAlertsCount: number;
  };
  apps: AppSurveillanceCard[];
  services: ServiceSurveillanceRecord[];
  anomalies: DetectedAnomalyRecord[];
  alerts: TechnicalAlertRecord[];
  logs: TechnicalLogEntry[];
  incidents: SystemIncidentHistoryEntry[];
  resources: RuntimeResourceSnapshot;
  settings: SurveillanceSettings;
  myPermissions: Record<SurveillancePermissionKey, boolean>;
  permissionsDirectory: SurveillanceStaffPermissionRow[];
  myRole: SecurityRole;
}
