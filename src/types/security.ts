export type SecurityRole = 'super_admin' | 'admin' | 'security_agent' | 'other_agent';

export type PlatformSpaceRole = 'client' | 'seller' | 'driver' | 'company' | 'admin';

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

export type SecurityPeriodFilter = 'today' | '7d' | '30d' | 'custom';

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

export type SecurityAccountType =
  | 'client'
  | 'vendeur'
  | 'livreur'
  | 'entreprise de livraison'
  | 'administrateur'
  | 'agent';

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

export type IntrusionSeverity = 'modere' | 'eleve' | 'critique';
export type IntrusionStatus = 'detecte' | 'en_cours' | 'bloque' | 'resolu';

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
  severity: IntrusionSeverity;
  status: IntrusionStatus;
  details: string;
  detectedBy: 'express_middleware' | 'auth_guard' | 'session_guard' | 'rbac_guard' | 'finance_guard';
}

export type CyberAttackType =
  | 'brute_force'
  | 'ddos_http_flood'
  | 'sql_injection'
  | 'xss'
  | 'anomalous_api'
  | 'bot_scanner'
  | 'malicious_upload'
  | 'waf_event';

export interface SecurityCyberAttackEvent {
  id: string;
  attackType: CyberAttackType;
  attackLabel: string;
  targetEndpoint: string;
  sourceIp: string;
  userAgent: string;
  timestamp: string;
  severity: IntrusionSeverity;
  blocked: boolean;
  actionTaken: string;
  sourceLayer: 'express_app_waf' | 'cloudflare_waf_webhook';
  redactedSnippet?: string;
}

export type AlertSeverityLevel = 'information' | 'faible' | 'moyen' | 'eleve' | 'critique';

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

export type SensitiveOperationType = 'withdrawals' | 'profile_changes' | 'role_changes' | 'api_writes';

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
  type: 'compromised_account' | 'account_suspension' | 'operation_block' | 'forced_reset' | 'financial_hold';
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
  spaceRole: 'client' | 'seller' | 'driver' | 'company';
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

export type ActivitySpace = PlatformSpaceRole | 'system';

export type ActivityCategory =
  | 'auth'
  | 'accounts'
  | 'security'
  | 'orders'
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

export interface ProtectedAuditEntry {
  id: string;
  seq: number;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorAccountLabel?: string;
  actorRole: SecurityRole | PlatformSpaceRole | 'system';
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

export interface ActivityLogQueryParams {
  q?: string;
  actor?: string;
  role?: string;
  space?: string;
  actionType?: string;
  category?: string;
  severity?: string;
  result?: string;
  ip?: string;
  refId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface ActivityLogPageResponse {
  success: boolean;
  logs: ProtectedAuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  kpis: {
    activitiesToday: number;
    loginsCount: number;
    adminActionsCount: number;
    suspiciousActivitiesCount: number;
    criticalEventsCount: number;
  };
  integrity: {
    valid: boolean;
    totalEntries: number;
    brokenAtSeq?: number;
    lastHash: string;
  };
  retention: {
    retentionDays: number;
    storedEntries: number;
    lastBackupAt?: string | null;
  };
}

export interface ActivityDetailResponse {
  success: boolean;
  entry: ProtectedAuditEntry;
  beforeEvents: ProtectedAuditEntry[];
  afterEvents: ProtectedAuditEntry[];
  relatedByActor: ProtectedAuditEntry[];
  relatedByEntity: ProtectedAuditEntry[];
}

export interface ActorSummaryInfo {
  identifier: string;
  name: string;
  accountLabel: string;
  role: string;
  space: string;
  totalEvents: number;
  failedOrBlockedEvents: number;
  criticalEvents: number;
  lastSeen: string | null;
  lastIp: string | null;
  lastDevice: string | null;
  lastOs: string | null;
  lastBrowser: string | null;
  isSuspended: boolean;
  suspensionReason?: string | null;
  serverBalanceFcfa: number | null;
}

export interface SecurityDashboardSummary {
  period: SecurityPeriodFilter;
  from: string;
  to: string;
  kpis: {
    totalLogins: number;
    successfulLogins: number;
    failedLogins: number;
    suspiciousLogins: number;
    detectedIncidents: number;
    blockedAttacks: number;
    activeSessions: number;
    temporarilySuspendedAccounts: number;
    suspiciousWithdrawals: number;
    openSecurityIncidents: number;
  };
  unresolvedAlertsCount: {
    critique: number;
    eleve: number;
    moyen: number;
    faible: number;
    information: number;
    total: number;
  };
  activeBlockedIpsCount: number;
  spacesProtected: Array<{
    space: PlatformSpaceRole;
    label: string;
    activeSessionsCount: number;
    suspendedCount: number;
    isolationEnforced: boolean;
  }>;
  protectionsStatus: {
    expressAppWaf: 'active';
    rateLimiting: 'active' | 'disabled';
    bruteForceGuard: 'active';
    hmacSessionTokens: 'active';
    tenantRbacIsolation: 'active';
    serverFinanceLedger: 'active';
    sqlXssInspection: 'active' | 'partial' | 'disabled';
    cloudflareWaf: 'connected' | 'not_connected';
  };
  logIntegrity: {
    valid: boolean;
    totalEntries: number;
    lastHash: string;
  };
}

// ============================================================================
// CENTRALIZED ADMIN NOTIFICATIONS & ALERTS
// ============================================================================

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
  isRead: boolean;
  archived: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
  dedupKey: string;
  duplicateCount: number;
  linkedAlertId?: string;
  deliveries: AdminNotificationDeliveryAttempt[];
  history: AdminNotificationHistoryItem[];
}

export type AdminNotificationChannelPreference = {
  interne: boolean;
  push: boolean;
  email: boolean;
};

export type AdminNotificationPreferences = Record<
  AdminNotificationCategory,
  AdminNotificationChannelPreference
>;

export interface NotificationChannelsStatus {
  interne: {
    configured: boolean;
    activeConnections: number;
    mode: string;
  };
  push: {
    serviceWorkerScript: boolean;
    externalRelayConfigured: boolean;
    relayType: string;
    subscriptionsCount: number;
    message: string;
  };
  email: {
    configured: boolean;
    provider: string;
    message: string;
  };
}

export interface AdminNotificationQueryParams {
  q?: string;
  category?: AdminNotificationCategory | 'all';
  priority?: AdminNotificationPriority | 'all';
  space?: ActivitySpace | 'all';
  status?: AdminNotificationStatus | 'pending' | 'all';
  unreadOnly?: boolean;
  archived?: 'false' | 'true' | 'all';
  page?: number;
  limit?: number;
}

export interface AdminNotificationPageResponse {
  success: boolean;
  notifications: AdminNotificationRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  kpis: {
    totalToday: number;
    unreadCount: number;
    criticalCount: number;
    pendingCount: number;
  };
  staffAssignees: Array<{
    id: string;
    name: string;
    role: SecurityRole;
    active: boolean;
  }>;
}

export interface AdminNotificationDetailResponse {
  success: boolean;
  notification: AdminNotificationRecord;
  sourceAuditEntry?: ProtectedAuditEntry | null;
  linkedAlert?: SecurityAlert | null;
}

