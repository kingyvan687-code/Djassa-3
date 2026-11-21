export type RefundWorkspaceSection =
  | 'dashboard'
  | 'all'
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'compensations'
  | 'partial'
  | 'full'
  | 'financial_history'
  | 'settings';

export type RefundType =
  | 'complet'
  | 'partiel'
  | 'apres_annulation'
  | 'apres_litige'
  | 'exceptionnel';

export type RefundStatus =
  | 'nouvelle_demande'
  | 'en_attente_validation'
  | 'en_verification'
  | 'approuvee'
  | 'en_cours_traitement'
  | 'effectuee'
  | 'partiellement_effectuee'
  | 'echouee'
  | 'refusee'
  | 'annulee';

export type CompensationStatus =
  | 'nouvelle_demande'
  | 'en_verification'
  | 'en_attente_validation'
  | 'approuvee'
  | 'en_cours_versement'
  | 'versee'
  | 'echouee'
  | 'refusee'
  | 'annulee';

export type CompensationBeneficiaryRole = 'client' | 'seller' | 'driver' | 'company';

export type CompensationReasonKey =
  | 'colis_perdu'
  | 'produit_endommage_transport'
  | 'erreur_livraison'
  | 'prejudice_commercial'
  | 'incident_technique'
  | 'decision_mediation'
  | 'autre_incident_justifie';

export type CompensationFundingSource =
  | 'caisse_djassa_garantie'
  | 'imputation_vendeur'
  | 'imputation_livreur'
  | 'imputation_entreprise'
  | 'fonds_mediation';

export type PaymentProviderChannelId =
  | 'internal_ledger'
  | 'wave'
  | 'orange_money'
  | 'mtn_momo'
  | 'card'
  | 'bank_transfer';

export type RefundOriginType =
  | 'reclamation_litige'
  | 'annulation_commande'
  | 'paiement_echoue_ou_double'
  | 'initiative_admin'
  | 'incident_livraison';

export type RefundPermissionKey =
  | 'viewRefunds'
  | 'createRefundOrCompRequest'
  | 'verifyAndRequestEvidence'
  | 'approveRefundStandard'
  | 'superAdminFinalValidate'
  | 'executeProviderTransfer'
  | 'manageCompensations'
  | 'cancelOrRetryOperation'
  | 'viewImmutableFinancialJournal'
  | 'manageRefundSettings';

export interface RefundActorInfo {
  accountId: string;
  roleType: CompensationBeneficiaryRole | 'admin';
  name: string;
  avatar?: string;
  phoneMasked?: string;
  phoneFull?: string;
  emailMasked?: string;
  emailFull?: string;
  commune?: string;
  accountStatus?: 'active' | 'pending_verification' | 'suspended';
  payoutTargetMasked?: string;
  titularityVerified?: boolean;
}

export interface RefundOrderItemBreakdown {
  productId: string;
  productTitle: string;
  productImage?: string;
  orderedQuantity: number;
  refundQuantity: number;
  unitPriceFcfa: number;
  lineTotalFcfa: number;
  refundableLineFcfa: number;
  selectedForRefund: boolean;
  sellerId?: string;
  sellerName?: string;
}

export interface RefundCommissionBreakdown {
  sellerCommissionChargedFcfa: number;
  driverCommissionChargedFcfa: number;
  platformServiceFeeFcfa: number;
  paymentProviderFeeFcfa: number;
  sellerCommissionReversedFcfa: number;
  driverCommissionReversedFcfa: number;
  serviceFeeReversedFcfa: number;
  providerFeeRefundable: boolean;
  commissionAlreadyReversedOnce: boolean;
  lastCommissionAdjustmentAt?: string;
  commissionAdjustmentRef?: string;
}

export interface RefundFinancialBreakdown {
  productsSubtotalFcfa: number;
  deliveryFeeFcfa: number;
  serviceFeeFcfa: number;
  discountFcfa: number;
  initialPaidFcfa: number;
  sellerNetBeforeRefundFcfa: number;
  deliveryActorShareFcfa: number;
  disputedAmountFcfa: number;
  authorizedMaxRefundFcfa: number;
  requestedAmountFcfa: number;
  customAdjustedAmountFcfa?: number;
  alreadyRefundedFcfa: number;
  remainingToRefundFcfa: number;
  refundableDeliveryFeeFcfa: number;
  nonRefundableFeesFcfa: number;
  commissions: RefundCommissionBreakdown;
}

export interface RefundEvidenceItem {
  id: string;
  title: string;
  kind: 'photo' | 'receipt' | 'order_proof' | 'provider_slip' | 'document';
  urlOrData?: string;
  sha256: string;
  addedAt: string;
  addedById: string;
  addedByName: string;
  immutable: true;
}

export interface RefundWorkflowStep {
  stepNumber: number; // 1..10
  key: string;
  label: string;
  status: 'pending' | 'done' | 'blocked' | 'skipped';
  completedAt?: string;
  actorName?: string;
  note?: string;
}

export interface RefundDecisionLogItem {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  fromStatus?: RefundStatus;
  toStatus?: RefundStatus;
  note: string;
}

export interface RefundProviderAttempt {
  id: string;
  attemptNumber: number;
  channel: PaymentProviderChannelId;
  amountFcfa: number;
  providerConfigured: boolean;
  providerResponseStatus:
    | 'confirmed_internal_ledger'
    | 'confirmed_external_provider'
    | 'pending_provider_confirmation'
    | 'failed_provider_error'
    | 'failed_not_configured';
  providerReference: string;
  requestedById: string;
  requestedByName: string;
  at: string;
  confirmedAt?: string;
  errorMessage?: string;
  receiptProof?: string;
}

export interface RefundSuspiciousSignal {
  id: string;
  code:
    | 'POSSIBLE_DUPLICATE_REFUND'
    | 'OVER_PAID_AMOUNT_ATTEMPT'
    | 'REPEATED_CANCELLATIONS_OR_REFUNDS'
    | 'BENEFICIARY_MISMATCH'
    | 'FREQUENT_FAILED_RETRIES';
  severity: 'moyen' | 'eleve' | 'critique';
  label: string;
  detail: string;
  detectedAt: string;
}

export interface RefundRecord {
  id: string;
  code: string; // e.g. RBT-20261115-XXXX
  idempotencyKey?: string;
  origin: RefundOriginType;
  linkedDisputeId?: string;
  linkedDisputeCode?: string;
  orderId?: string;
  orderNumber: string;
  initialTransactionRef: string;
  initialPaymentMethod: string;
  refundType: RefundType;
  reasonCategory: string;
  reasonDetail: string;
  status: RefundStatus;
  createdAt: string;
  updatedAt: string;
  dueAt: string; // SLA deadline
  completedAt?: string | null;
  archived: boolean;
  assignedAgentId?: string | null;
  assignedAgentName?: string | null;
  validatedByAgentId?: string | null;
  validatedByAgentName?: string | null;
  validatedByAgentAt?: string | null;
  requiresSuperAdminValidation: boolean;
  superAdminValidatedById?: string | null;
  superAdminValidatedByName?: string | null;
  superAdminValidatedAt?: string | null;
  rejectionReason?: string;
  cancellationReason?: string;
  targetChannel: PaymentProviderChannelId;
  beneficiaryPayoutAccount: string;
  beneficiaryTitularityChecked: boolean;
  actors: {
    client: RefundActorInfo;
    seller?: RefundActorInfo;
    driver?: RefundActorInfo;
    company?: RefundActorInfo;
    agent?: RefundActorInfo;
  };
  items: RefundOrderItemBreakdown[];
  financial: RefundFinancialBreakdown;
  evidence: RefundEvidenceItem[];
  steps: RefundWorkflowStep[];
  decisions: RefundDecisionLogItem[];
  providerAttempts: RefundProviderAttempt[];
  suspiciousSignals: RefundSuspiciousSignal[];
}

export interface CompensationRecord {
  id: string;
  code: string; // IND-20261115-XXXXXX
  idempotencyKey?: string;
  beneficiaryRole: CompensationBeneficiaryRole;
  beneficiary: RefundActorInfo;
  beneficiaryPayoutAccount: string;
  titularityVerified: boolean;
  reason: CompensationReasonKey;
  incidentDescription: string;
  orderId?: string;
  orderNumber?: string;
  linkedDisputeId?: string;
  linkedDisputeCode?: string;
  fundingSource: CompensationFundingSource;
  requestedAmountFcfa: number;
  approvedAmountFcfa: number;
  paidAmountFcfa: number;
  targetChannel: PaymentProviderChannelId;
  status: CompensationStatus;
  requiresSuperAdminValidation: boolean;
  createdById: string;
  createdByName: string;
  validatedById?: string;
  validatedByName?: string;
  superAdminValidatedById?: string;
  superAdminValidatedByName?: string;
  decisionDate?: string;
  paidDate?: string;
  payoutReference?: string;
  payoutProof?: string;
  rejectionReason?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
  decisions: Array<{
    id: string;
    at: string;
    actorId: string;
    actorName: string;
    action: string;
    note: string;
  }>;
  evidence: RefundEvidenceItem[];
}

export interface RefundFinancialJournalEntry {
  id: string;
  at: string;
  entryType:
    | 'refund_executed'
    | 'refund_partial_executed'
    | 'refund_failed'
    | 'compensation_paid'
    | 'compensation_failed'
    | 'commission_reversed'
    | 'provider_retry'
    | 'operation_approved'
    | 'operation_rejected'
    | 'operation_cancelled';
  entityType: 'refund' | 'compensation' | 'commission';
  entityId: string;
  entityCode: string;
  orderNumber?: string;
  beneficiaryName: string;
  beneficiaryRole: CompensationBeneficiaryRole;
  amountFcfa: number;
  commissionDeltaFcfa: number;
  channel: PaymentProviderChannelId;
  providerReference: string;
  actorId: string;
  actorName: string;
  immutableChecksum: string;
  note: string;
}

export interface RefundNotificationItem {
  id: string;
  entityType: 'refund' | 'compensation';
  entityId: string;
  entityCode: string;
  eventType:
    | 'request_created'
    | 'evidence_requested'
    | 'approved'
    | 'rejected'
    | 'processing_started'
    | 'operation_failed'
    | 'refund_confirmed'
    | 'compensation_confirmed';
  recipientRole: 'client' | 'seller' | 'driver' | 'company' | 'admin';
  recipientName: string;
  title: string;
  body: string;
  createdAt: string;
  readByAdminIds: string[];
}

export interface RefundProviderStatusInfo {
  id: PaymentProviderChannelId;
  name: string;
  configured: boolean;
  supportsAutomaticRefund: boolean;
  supportsAutomaticPayout: boolean;
  modeLabel: string;
  statusDetail: string;
}

export interface RefundSettingsChangeLog {
  id: string;
  at: string;
  actorId: string;
  actorName: string;
  summary: string;
  beforeJson: string;
  afterJson: string;
}

export interface RefundModuleSettings {
  dualValidationThresholdFcfa: number; // Super Admin validation required above this amount
  maxSingleRefundFcfa: number;
  maxCompensationFcfa: number;
  slaProcessingHours: number;
  maxRetriesPerOperation: number;
  enabledRefundTypes: Record<RefundType, boolean>;
  enabledCompensationReasons: Record<CompensationReasonKey, boolean>;
  eligibilityRules: {
    requireVerifiedInitialTransaction: boolean;
    requireProofOverFcfa: number;
    maxOrderAgeDays: number;
    refundDeliveryFeeOnFullCancellation: boolean;
    refundDeliveryFeeOnDispute: boolean;
    requireTitularityCheckBeforePayout: boolean;
    blockDuplicateRefundsStrictly: boolean;
  };
  commissionRules: {
    reverseSellerCommissionOnFullRefund: boolean;
    reverseDriverCommissionOnUndeliveredCancellation: boolean;
    reversePlatformServiceFeeOnFullRefund: boolean;
    refundProviderFeesToClient: boolean;
    preventDoubleCommissionReversal: boolean;
  };
  notificationsEnabled: Record<RefundNotificationItem['eventType'], boolean>;
  settingsChangeHistory: RefundSettingsChangeLog[];
}

export interface RefundStaffPermissionRow {
  staffId: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  permissions: Record<RefundPermissionKey, boolean>;
}

export interface RefundDashboardKpis {
  totalRefunds: number;
  pendingRefunds: number;
  inProgressRefunds: number;
  completedRefunds: number;
  failedRefunds: number;
  totalCompensations: number;
  totalRefundedAmountFcfa: number;
  totalCompensationsPaidFcfa: number;
  pendingAmountFcfa: number;
  monthRefundedAmountFcfa: number;
  totalCommissionsReversedFcfa: number;
  suspiciousAlertsCount: number;
}

export interface RefundOverviewResponse {
  success: boolean;
  generatedAt: string;
  actor: {
    staffId: string;
    name: string;
    role: string;
    permissions: Record<RefundPermissionKey, boolean>;
  };
  kpis: RefundDashboardKpis;
  providers: RefundProviderStatusInfo[];
  refunds: RefundRecord[];
  compensations: CompensationRecord[];
  journal: RefundFinancialJournalEntry[];
  notifications: RefundNotificationItem[];
  settings: RefundModuleSettings;
  staffPermissions: RefundStaffPermissionRow[];
}
