import type { SecurityRole } from './security';

export type PrivacyUserSpace = 'client' | 'seller' | 'driver' | 'company' | 'admin';

export type PrivacyDataCategoryGroup = 'personal' | 'commercial' | 'financial' | 'technical';

export type PrivacyRequestType =
  | 'acces_copie'
  | 'rectification'
  | 'suppression_anonymisation'
  | 'retrait_consentement'
  | 'information_traitement';

export type PrivacyRequestStatus =
  | 'nouvelle'
  | 'en_verification'
  | 'en_traitement'
  | 'en_attente_infos'
  | 'traitee'
  | 'refusee';

export type PrivacyIncidentSeverity = 'faible' | 'moyen' | 'eleve' | 'critique';
export type PrivacyIncidentStatus = 'ouvert' | 'investigation' | 'contenu' | 'resolu';

export type PrivacyPolicyDocType =
  | 'politique_confidentialite'
  | 'cgu'
  | 'politique_cookies'
  | 'politique_conservation'
  | 'procedure_incidents'
  | 'registre_traitements';

export type PrivacyPolicyStatus = 'brouillon' | 'publie' | 'archive';

export type PrivacyPermissionKey =
  | 'viewPersonalData'
  | 'viewKycDocuments'
  | 'viewFinancialData'
  | 'viewOrderData'
  | 'viewTechnicalLogs'
  | 'viewOtherAdminsData'
  | 'processPrivacyRequests'
  | 'exportUserData'
  | 'bulkExport'
  | 'managePrivacyIncidents'
  | 'managePolicies';

export interface PrivacyControlAuditItem {
  id: string;
  label: string;
  status: 'actif' | 'partiel' | 'non_configure' | 'a_valider_juridique';
  details: string;
  category: 'technique' | 'organisationnel' | 'reglementaire_ci';
}

export interface MaskedUserDataInventoryRecord {
  id: string;
  userId: string;
  space: PrivacyUserSpace;
  spaceLabel: string;
  displayLabel: string;
  accountStatus: string;
  anonymized: boolean;
  createdAt: string;
  hasLegalRetentionLock: boolean;
  legalLockReason: string | null;
  personalMasked: {
    fullName: string;
    email: string;
    phone: string;
    deliveryAddress: string;
    avatarPresent: boolean;
  };
  commercialMasked: {
    shopOrCompanyName: string | null;
    kycStatus: string;
    kycDocSummary: string;
    ordersCount: number;
    deliveriesCount: number;
  };
  financialMasked: {
    walletSummary: string;
    confirmedTransactionsCount: number;
    payoutTargetMasked: string | null;
    commissionsSummary: string;
  };
  technicalSummary: {
    activeSessionsCount: number;
    lastDevice: string;
    lastIpMasked: string;
    lastLoginAt: string | null;
    auditActionsCount: number;
  };
}

export interface RevealedPrivacyRecordPayload {
  recordId: string;
  revealedAt: string;
  expiresAt: string;
  revealedBy: string;
  personal?: {
    fullName: string;
    email: string;
    phone: string;
    deliveryAddress: string;
  };
  commercial?: {
    shopOrCompanyName: string | null;
    kycDocSummary: string;
    ordersCount: number;
  };
  financial?: {
    walletBalanceFcfa: number;
    confirmedTransactionsCount: number;
    payoutTarget: string | null;
  };
  technical?: {
    lastIp: string;
    lastDevice: string;
    activeSessionIds: string[];
  };
}

export interface UserConsentHistoryEntry {
  id: string;
  at: string;
  consentType: 'cgu' | 'politique_confidentialite' | 'marketing_commercial' | 'notifications_push';
  action: 'accepte' | 'refuse' | 'retire' | 'mis_a_jour';
  documentVersion: string;
  actor: string;
  channel: string;
}

export interface UserConsentRecord {
  id: string;
  userId: string;
  userLabel: string;
  space: PrivacyUserSpace;
  cguAccepted: boolean;
  cguVersion: string;
  cguAcceptedAt: string | null;
  privacyAccepted: boolean;
  privacyVersion: string;
  privacyAcceptedAt: string | null;
  marketingOptIn: boolean;
  marketingUpdatedAt: string | null;
  notificationsOptIn: boolean;
  notificationsUpdatedAt: string | null;
  mandatoryLegalBasisNote: string;
  history: UserConsentHistoryEntry[];
}

export interface PrivacyRequestActionEntry {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  action: string;
  statusAfter: PrivacyRequestStatus;
  comment: string;
}

export interface PrivacyRequestRecord {
  id: string;
  userId: string;
  userLabel: string;
  userEmailMasked: string;
  space: PrivacyUserSpace;
  type: PrivacyRequestType;
  identityVerified: boolean;
  receivedAt: string;
  updatedAt: string;
  dueDate: string;
  status: PrivacyRequestStatus;
  responsibleAdminId: string | null;
  responsibleAdminName: string | null;
  resolvedAt: string | null;
  justificationOrReason: string;
  legalHoldDetected: boolean;
  legalHoldDetails: string | null;
  anonymizationApplied: boolean;
  exportId: string | null;
  history: PrivacyRequestActionEntry[];
}

export interface DataRetentionRuleRecord {
  id: string;
  categoryKey:
    | 'users'
    | 'admin_docs'
    | 'orders'
    | 'payments'
    | 'withdrawals'
    | 'disputes'
    | 'activity_logs'
    | 'technical_logs'
    | 'sessions_devices';
  label: string;
  purpose: string;
  legalReferenceCi: string;
  retentionDays: number;
  allowDeletionAfterExpiry: boolean;
  anonymizeInsteadOfDelete: boolean;
  legalHoldProtection: boolean;
  activeRecordsCount: number;
  oldestRecordDate: string | null;
  nextScheduledPurgeAt: string | null;
  status: 'actif' | 'gele_litige' | 'revision_requise';
  extendedRetentionNote: string;
  updatedAt: string;
  updatedBy: string;
}

export interface PrivacyExportRecord {
  id: string;
  createdAt: string;
  expiresAt: string;
  requestedById: string;
  requestedByName: string;
  scope: 'single_user' | 'bulk_filtered';
  targetUserId: string | null;
  targetUserLabel: string;
  format: 'json' | 'csv';
  justification: string;
  status: 'disponible' | 'expire' | 'telecharge' | 'bloque';
  downloadCount: number;
  downloadToken?: string;
}

export interface PrivacyIncidentRecord {
  id: string;
  detectedAt: string;
  updatedAt: string;
  type:
    | 'acces_non_autorise'
    | 'export_inhabituel'
    | 'exposition_document'
    | 'fuite_donnees'
    | 'erreur_permission'
    | 'consultation_anormale'
    | 'appareil_perdu_vole';
  affectedCategories: PrivacyDataCategoryGroup[];
  potentiallyAffectedUsersCount: number;
  severity: PrivacyIncidentSeverity;
  origin: string;
  measuresTaken: string;
  responsibleId: string | null;
  responsibleName: string | null;
  status: PrivacyIncidentStatus;
  artciAssessment: {
    requiresArtciNotification: boolean;
    requiresUserNotification: boolean;
    adminValidatedNotification: boolean;
    validatedBy: string | null;
    validatedAt: string | null;
    assessmentNotes: string;
  };
}

export interface PrivacyPolicyDocumentRecord {
  id: string;
  docType: PrivacyPolicyDocType;
  title: string;
  currentVersion: string;
  publishedAt: string | null;
  effectiveAt: string | null;
  validatedBy: string | null;
  status: PrivacyPolicyStatus;
  requiresReconsentOnPublish: boolean;
  summary: string;
  contentPreview: string;
  history: Array<{
    version: string;
    publishedAt: string;
    validatedBy: string;
    notes: string;
  }>;
}

export interface PrivacyAuditReportEntry {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  actionType: string;
  action: string;
  target: string;
  result: 'reussi' | 'bloque' | 'refuse';
  details: string;
}

export interface PrivacySettings {
  exportLinkTtlMinutes: number;
  requireMfaForSensitiveReveal: boolean;
  requireMfaForExport: boolean;
  requireIdentityCheckForDsar: boolean;
  maskSensitiveDataByDefault: boolean;
  dsarSlaDays: number;
  legalFrameworkLabel: string;
  dpoContactEmail: string;
  updatedAt: string;
  updatedBy: string;
}

export interface PrivacyStaffPermissionRow {
  staffId: string;
  name: string;
  email: string;
  role: SecurityRole;
  active: boolean;
  permissions: Record<PrivacyPermissionKey, boolean>;
}

export interface PrivacyOverviewResponse {
  success: boolean;
  serverTime: string;
  kpis: {
    overallStatus: 'conforme_partiel' | 'action_requise' | 'vigilance_critique';
    overallStatusLabel: string;
    activeAccountsCount: number;
    requestsTotal: number;
    requestsPending: number;
    requestsProcessed: number;
    privacyIncidentsOpen: number;
    retentionCategoriesCount: number;
    lastComplianceCheckAt: string;
  };
  controlAudit: PrivacyControlAuditItem[];
  inventory: MaskedUserDataInventoryRecord[];
  consents: UserConsentRecord[];
  requests: PrivacyRequestRecord[];
  retentionRules: DataRetentionRuleRecord[];
  exports: PrivacyExportRecord[];
  incidents: PrivacyIncidentRecord[];
  policies: PrivacyPolicyDocumentRecord[];
  auditHistory: PrivacyAuditReportEntry[];
  settings: PrivacySettings;
  myPermissions: Record<PrivacyPermissionKey, boolean>;
  permissionsDirectory: PrivacyStaffPermissionRow[];
  myRole: SecurityRole;
}
