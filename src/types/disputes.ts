export type DisputeWorkspaceSection =
  | 'dashboard'
  | 'all'
  | 'urgent'
  | 'pending'
  | 'investigating'
  | 'awaiting_evidence'
  | 'mediation'
  | 'refunds'
  | 'resolved'
  | 'archives'
  | 'settings';

export type DisputeCategoryKey =
  | 'commande_non_recue'
  | 'produit_manquant'
  | 'produit_incorrect'
  | 'produit_endommage_defectueux'
  | 'paiement_non_confirme'
  | 'paiement_debite_plusieurs_fois'
  | 'remboursement_non_recu'
  | 'probleme_livraison'
  | 'retard_livraison'
  | 'colis_perdu'
  | 'comportement_vendeur'
  | 'comportement_livreur'
  | 'probleme_entreprise_livraison'
  | 'suspicion_fraude'
  | 'usurpation_identite'
  | 'probleme_compte_acces'
  | 'autre_reclamation';

export type DisputeStatus =
  | 'nouvelle'
  | 'en_attente_traitement'
  | 'en_cours_investigation'
  | 'en_attente_justificatifs'
  | 'en_mediation'
  | 'resolue'
  | 'rejetee'
  | 'cloturee';

export type DisputePriority = 'faible' | 'normal' | 'urgent';

export type DisputeActorRoleType = 'client' | 'seller' | 'driver' | 'company' | 'admin';

export type DisputePermissionKey =
  | 'viewDisputes'
  | 'viewAssignedOnly'
  | 'triageAndAssign'
  | 'investigateAndMediate'
  | 'requestRefundOrRelease'
  | 'approveFinancialDisputeOp'
  | 'applySanction'
  | 'closeOrReopenDispute'
  | 'manageDisputeSettings'
  | 'viewFullActorContacts';

export interface DisputeActorProfile {
  roleType: DisputeActorRoleType;
  accountId: string;
  name: string;
  avatar?: string;
  phoneMasked?: string;
  phoneFull?: string;
  emailMasked?: string;
  emailFull?: string;
  accountStatus: 'active' | 'suspended' | 'pending_verification' | 'unknown';
  pastDisputesCount: number;
  pastUrgentCount?: number;
  companyName?: string;
  vehicleInfo?: string;
  commune?: string;
}

export interface DisputeOrderItemSnapshot {
  productId: string;
  productTitle: string;
  productImage?: string;
  quantity: number;
  unitPriceFcfa: number;
  totalFcfa: number;
  sellerId?: string;
  sellerName?: string;
}

export interface DisputeOrderSnapshot {
  orderId?: string;
  orderNumber: string;
  items: DisputeOrderItemSnapshot[];
  subtotalFcfa: number;
  deliveryFeeFcfa: number;
  discountFcfa: number;
  totalFcfa: number;
  paymentMethod: string;
  transactionRef?: string;
  paymentStatus: string;
  preparationStatus: string;
  deliveryStatus: string;
  deliveryMode?: string;
  createdAt?: string;
  trackingHistory: {
    status: string;
    label: string;
    time: string;
    description?: string;
  }[];
  gpsInfo?: {
    lat?: number;
    lng?: number;
    commune?: string;
    quartier?: string;
    details?: string;
    recordedAt?: string;
  };
}

export type DisputeEvidenceKind =
  | 'photo'
  | 'video'
  | 'screenshot'
  | 'conversation'
  | 'payment_receipt'
  | 'invoice'
  | 'client_signature'
  | 'seller_signature'
  | 'delivery_handover_proof'
  | 'gps_trace'
  | 'document';

export interface DisputeEvidenceItem {
  id: string;
  kind: DisputeEvidenceKind;
  title: string;
  description?: string;
  urlOrData?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  sha256: string;
  addedAt: string;
  addedById: string;
  addedByName: string;
  addedByRole: DisputeActorRoleType | 'system';
  immutableOriginal: true;
  flaggedDuplicateInDisputeIds?: string[];
}

export interface DisputeTimelineEntry {
  id: string;
  kind:
    | 'initial_claim'
    | 'actor_message'
    | 'admin_to_actor'
    | 'evidence_request'
    | 'evidence_submitted'
    | 'internal_note'
    | 'status_change'
    | 'assignment_change'
    | 'mediation_event'
    | 'financial_event'
    | 'sanction_event'
    | 'decision';
  visibility: 'actors_and_admin' | 'admin_only';
  at: string;
  authorId: string;
  authorName: string;
  authorRole: DisputeActorRoleType | 'system';
  targetActorRole?: DisputeActorRoleType | 'all_actors';
  title: string;
  message: string;
  beforeStatus?: DisputeStatus;
  afterStatus?: DisputeStatus;
  metadata?: Record<string, string | number | boolean | null>;
}

export type DisputeFinancialBlockStatus =
  | 'non_bloque'
  | 'bloque_registre_interne'
  | 'bloque_externe_non_disponible'
  | 'libere'
  | 'rembourse_partiel'
  | 'rembourse_total';

export type DisputeRefundStatus =
  | 'aucun'
  | 'en_attente_double_validation'
  | 'en_attente_confirmation_prestataire'
  | 'confirme'
  | 'rejete'
  | 'echoue';

export interface DisputeFinancialTransaction {
  id: string;
  type: 'blocage_fonds' | 'liberation_fonds' | 'remboursement' | 'ajustement_commission';
  amountFcfa: number;
  channel: string;
  providerConfigured: boolean;
  providerStatus: 'confirme_registre_interne' | 'confirme_prestataire' | 'en_attente_confirmation_prestataire' | 'bloque_prestataire_non_configure' | 'rejete';
  reference: string;
  initiatedById: string;
  initiatedByName: string;
  approvedById?: string;
  approvedByName?: string;
  createdAt: string;
  confirmedAt?: string;
  proofNote?: string;
  proofRef?: string;
}

export interface DisputeFinancialApprovalRequest {
  id: string;
  disputeId: string;
  disputeCode: string;
  actionType: 'remboursement' | 'liberation_fonds';
  amountFcfa: number;
  channel: string;
  targetAccountId: string;
  targetAccountName: string;
  externalProviderReference?: string;
  reason: string;
  requestedById: string;
  requestedByName: string;
  requestedAt: string;
  status: 'en_attente_double_validation' | 'approuvee' | 'rejetee' | 'annulee';
  decidedById?: string;
  decidedByName?: string;
  decidedAt?: string;
  executionMessage?: string;
}

export interface DisputeAbuseIndicator {
  id: string;
  code:
    | 'REPETITIVE_CLAIMS'
    | 'DUPLICATE_PROOF_HASH'
    | 'MULTIPLE_REFUND_ATTEMPTS'
    | 'MULTIPLE_DISPUTES_SAME_ORDER'
    | 'ABNORMAL_CLAIM_RATIO'
    | 'EVIDENCE_TAMPER_ATTEMPT'
    | 'LINKED_ACCOUNTS_SUSPECT'
    | 'IDENTITY_IMPERSONATION'
    | 'POTENTIAL_COLLUSION';
  severity: 'faible' | 'moyen' | 'eleve' | 'critique';
  label: string;
  detail: string;
  automaticSignalOnly: true;
  detectedAt: string;
}

export interface DisputeMediationInfo {
  active: boolean;
  startedAt?: string;
  moderatorId?: string;
  moderatorName?: string;
  proposedSettlement?: string;
  deadlineAt?: string;
  clientAccepted?: boolean;
  sellerAccepted?: boolean;
  outcome?: 'en_cours' | 'accord_trouve' | 'echec_arbitrage_admin';
  outcomeNote?: string;
}

export interface DisputeSanctionRecord {
  id: string;
  targetAccountId: string;
  targetName: string;
  targetRole: DisputeActorRoleType;
  sanctionType: 'avertissement' | 'blocage_retraits' | 'restriction_commandes' | 'suspension_temporaire' | 'suspension_permanente';
  reason: string;
  appliedById: string;
  appliedByName: string;
  appliedAt: string;
  durationDays?: number;
  activeBlockApplied: boolean;
}

export interface DisputeNotificationItem {
  id: string;
  disputeId: string;
  disputeCode: string;
  eventType:
    | 'new_dispute'
    | 'assigned_agent'
    | 'evidence_received'
    | 'new_message'
    | 'evidence_requested'
    | 'urgent_dispute'
    | 'sla_overdue'
    | 'admin_decision'
    | 'refund_confirmed'
    | 'funds_released'
    | 'dispute_closed';
  title: string;
  body: string;
  audience: 'admins' | 'agent' | 'client' | 'seller' | 'driver' | 'company' | 'all_involved';
  recipientAccountId?: string;
  createdAt: string;
  readByActorIds: string[];
}

export interface DisputeRecord {
  id: string;
  code: string;
  sourceKey?: string;
  category: DisputeCategoryKey;
  subject: string;
  description: string;
  orderNumber: string;
  orderId?: string;
  declarant: DisputeActorProfile;
  accusedActor: DisputeActorProfile;
  actors: {
    client?: DisputeActorProfile;
    seller?: DisputeActorProfile;
    driver?: DisputeActorProfile;
    company?: DisputeActorProfile;
  };
  orderSnapshot: DisputeOrderSnapshot;
  amountFcfa: number;
  priority: DisputePriority;
  status: DisputeStatus;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  createdAt: string;
  updatedAt: string;
  slaDeadlineAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  archived: boolean;
  decisionSummary?: string;
  rejectionReason?: string;
  evidence: DisputeEvidenceItem[];
  timeline: DisputeTimelineEntry[];
  mediation: DisputeMediationInfo;
  financial: {
    disputedAmountFcfa: number;
    blockedAmountFcfa: number;
    amountToRefundFcfa: number;
    refundedAmountFcfa: number;
    deliveryFeeFcfa: number;
    commissionFcfa: number;
    financialManagerId?: string;
    financialManagerName?: string;
    blockStatus: DisputeFinancialBlockStatus;
    refundStatus: DisputeRefundStatus;
    refundReference?: string;
    refundDate?: string;
    refundProof?: string;
    transactions: DisputeFinancialTransaction[];
  };
  sanctions: DisputeSanctionRecord[];
  abuseIndicators: DisputeAbuseIndicator[];
}

export interface DisputeDashboardKpis {
  totalDisputes: number;
  newDisputes: number;
  pendingDisputes: number;
  inProgressDisputes: number;
  urgentDisputes: number;
  resolvedDisputes: number;
  rejectedDisputes: number;
  pendingRefundsCount: number;
  totalFinancialDisputeFcfa: number;
  averageResolutionHours: number;
  overdueCount: number;
  abuseFlaggedCount: number;
}

export interface DisputeProviderCapability {
  id: string;
  name: string;
  configured: boolean;
  supportsDirectBlock: boolean;
  supportsDirectRefund: boolean;
  statusDetail: string;
}

export interface DisputeCategoryConfig {
  key: DisputeCategoryKey;
  label: string;
  enabled: boolean;
  defaultPriority: DisputePriority;
  slaHours: number;
}

export interface DisputeModuleSettings {
  categories: DisputeCategoryConfig[];
  slaHoursByPriority: Record<DisputePriority, number>;
  autoAssignMode: 'manuel' | 'equilibre_charge';
  autoEscalationOnSlaBreach: boolean;
  requireDualValidationForRefundOverFcfa: number;
  requireProofBeforeClose: boolean;
  preventCloseWithPendingRefund: boolean;
  allowReopenWithinDays: number;
  evidenceRetentionDays: number;
  mediationMaxHours: number;
  antiFraudThresholds: {
    maxClaimsPerUser30d: number;
    flagDuplicateProofHash: boolean;
    flagMultipleDisputesSameOrder: boolean;
    abnormalClaimRatioPercent: number;
  };
  notificationsEnabled: Record<DisputeNotificationItem['eventType'], boolean>;
}

export interface DisputeStaffPermissionRow {
  staffId: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  permissions: Record<DisputePermissionKey, boolean>;
}

export interface DisputeOverviewResponse {
  success: boolean;
  generatedAt: string;
  actor: {
    staffId: string;
    name: string;
    role: string;
    permissions: Record<DisputePermissionKey, boolean>;
  };
  kpis: DisputeDashboardKpis;
  providerCapabilities: DisputeProviderCapability[];
  disputes: DisputeRecord[];
  approvalRequests: DisputeFinancialApprovalRequest[];
  notifications: DisputeNotificationItem[];
  settings: DisputeModuleSettings;
  staffPermissions: DisputeStaffPermissionRow[];
  auditTrail: {
    id: string;
    at: string;
    actorName: string;
    action: string;
    target: string;
    severity: string;
    details: string;
  }[];
}
