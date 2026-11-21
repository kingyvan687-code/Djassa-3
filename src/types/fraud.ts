import type { SecurityRole } from './security';

export type FraudRiskLevel = 'faible' | 'moyen' | 'eleve' | 'critique';

export type FraudActorSpace = 'client' | 'seller' | 'driver' | 'company' | 'admin';

export type FraudAlertStatus =
  | 'nouvelle'
  | 'en_cours'
  | 'en_attente_justificatifs'
  | 'suspicion_ecartee'
  | 'fraude_confirmee'
  | 'transmise_decision'
  | 'cloturee';

export type FraudDomainCategory =
  | 'paiement'
  | 'retrait'
  | 'portefeuille'
  | 'commande'
  | 'comptes_lies'
  | 'securite_financiere';

export type FraudPermissionKey =
  | 'viewFraudDashboard'
  | 'viewSensitiveFraudDetails'
  | 'manageInvestigations'
  | 'requestSensitiveFinanceAction'
  | 'approveDualControlAction'
  | 'manageFraudRules'
  | 'manageAccountWatch';

export type SensitiveFinanceActionType =
  | 'release_critical_operation'
  | 'manual_balance_adjustment'
  | 'exceptional_refund'
  | 'modify_financial_coordinates'
  | 'cancel_confirmed_transaction'
  | 'unlock_suspended_wallet'
  | 'modify_critical_fraud_rules';

export interface FraudRiskCriterionBreakdown {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  reason: string;
}

export interface FraudEvidenceItem {
  id: string;
  timestamp: string;
  source: 'ledger_serveur' | 'fournisseur_paiement' | 'controle_commande' | 'signal_technique' | 'action_admin' | 'piece_justificative';
  transactionRef?: string;
  orderId?: string;
  expectedAmountFcfa?: number;
  confirmedAmountFcfa?: number;
  providerResponseStatus?: string;
  summary: string;
  immutableHash: string;
}

export interface FraudInvestigationNote {
  id: string;
  at: string;
  authorId: string;
  authorName: string;
  type: 'note' | 'demande_justificatif' | 'preuve_ajoutee' | 'changement_statut' | 'decision_finale';
  content: string;
}

export interface FraudAlertRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  domain: FraudDomainCategory;
  ruleCode: string;
  title: string;
  description: string;
  accountId: string;
  accountLabelMasked: string;
  space: FraudActorSpace;
  amountFcfa: number;
  confirmedLossFcfa: number;
  heldAmountFcfa: number;
  riskScore: number;
  riskLevel: FraudRiskLevel;
  scoreBreakdown: FraudRiskCriterionBreakdown[];
  reasons: string[];
  status: FraudAlertStatus;
  isConfirmedFraud: boolean;
  requiresJustificatifs: boolean;
  justificatifRequestNote?: string | null;
  assignedToId?: string | null;
  assignedToName?: string | null;
  linkedOrderId?: string | null;
  linkedTransactionRef?: string | null;
  recommendedProtection: string;
  appliedProtection: 'aucune' | 'surveillance_renforcee' | 'verification_supplementaire' | 'blocage_operation_cible' | 'suspension_operation';
  notes: FraudInvestigationNote[];
  evidences: FraudEvidenceItem[];
  closedAt?: string | null;
  closedBy?: string | null;
  closureReason?: string | null;
}

export interface FraudAccountWatchRecord {
  accountId: string;
  accountLabelMasked: string;
  space: FraudActorSpace;
  spaceLabel: string;
  watchStatus: 'normal' | 'surveillance_renforcee' | 'verification_requise' | 'operations_restreintes';
  operationsCount: number;
  paymentsCount: number;
  withdrawalsCount: number;
  payoutTargetChangesCount: number;
  payoutTargetMasked: string | null;
  alertsCount: number;
  maxRiskScore: number;
  lastActivityAt: string | null;
  walletBalanceFcfa: number;
  watchReason?: string | null;
}

export interface FraudPaymentRecord {
  id: string;
  transactionRef: string;
  orderId: string | null;
  accountId: string;
  accountLabelMasked: string;
  space: FraudActorSpace;
  channel: string;
  expectedAmountFcfa: number;
  paidAmountFcfa: number;
  providerStatus: 'confirme_serveur' | 'non_verifie_externe' | 'echec_fournisseur' | 'incoherence_detectee' | 'preuve_non_fiable';
  providerDetail: string;
  status: 'valide' | 'suspect' | 'bloque' | 'rejete';
  riskScore: number;
  riskLevel: FraudRiskLevel;
  anomalyFlags: string[];
  createdAt: string;
  idempotencyKey?: string;
}

export interface FraudWithdrawalRecord {
  id: string;
  ledgerId: string;
  reference: string;
  accountId: string;
  accountLabelMasked: string;
  space: FraudActorSpace;
  amountFcfa: number;
  serverBalanceAtEventFcfa: number;
  channel: string;
  payoutTargetMasked: string | null;
  payoutTargetChangedRecently: boolean;
  sharedPayoutAccountsCount: number;
  isNewDevice: boolean;
  status: 'valide' | 'en_attente_verification' | 'bloque_securite' | 'rejete';
  riskScore: number;
  riskLevel: FraudRiskLevel;
  suspicionReasons: string[];
  createdAt: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
}

export interface FraudWalletConsistencyRecord {
  accountId: string;
  accountLabelMasked: string;
  space: FraudActorSpace;
  ledgerBalanceFcfa: number;
  creditsWalletFcfa: number | null;
  pendingHoldsFcfa: number;
  creditsCount: number;
  debitsCount: number;
  directEditAttemptsCount: number;
  duplicateRefCount: number;
  consistencyStatus: 'coherent' | 'ecart_detecte' | 'anomalie_critique';
  anomalyReasons: string[];
  lastUpdatedAt: string | null;
}

export interface FraudOrderAnomalyRecord {
  id: string;
  orderId: string;
  transactionRef: string | null;
  buyerMasked: string;
  sellerMasked: string;
  driverOrCompanyMasked: string | null;
  amountFcfa: number;
  expectedAmountFcfa: number | null;
  paymentStatus: string;
  deliveryStatus: string;
  hasDeliveryProof: boolean;
  reusedProofDetected: boolean;
  postPaymentModified: boolean;
  commissionFcfa: number;
  riskScore: number;
  riskLevel: FraudRiskLevel;
  anomalyTypes: string[];
  status: 'a_verifier' | 'bloque' | 'ecarte' | 'confirme';
  createdAt: string;
}

export interface FraudLinkedAccountsCluster {
  id: string;
  clusterType: 'coordonnee_retrait_partagee' | 'signature_technique_commune' | 'flux_repetitifs' | 'creation_sequentielle_coordonnee';
  signalSummary: string;
  sharedIndicatorMasked: string;
  accounts: Array<{
    accountId: string;
    accountLabelMasked: string;
    space: FraudActorSpace;
    watchStatus: string;
  }>;
  riskScore: number;
  riskLevel: FraudRiskLevel;
  verificationStatus: 'indice_a_verifier' | 'en_analyse' | 'justifie_legitime' | 'collusion_confirmee';
  disclaimer: string;
  detectedAt: string;
}

export interface FraudSensitiveActionRequest {
  id: string;
  actionType: SensitiveFinanceActionType;
  actionLabel: string;
  targetId: string;
  targetAccountId: string;
  targetAccountMasked: string;
  amountFcfa: number;
  reason: string;
  payloadSummary: string;
  requestedById: string;
  requestedByName: string;
  requestedAt: string;
  status: 'en_attente_second_valideur' | 'approuvee_executee' | 'rejetee' | 'annulee';
  requiresDualValidation: boolean;
  secondApproverId?: string | null;
  secondApproverName?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  executedAt?: string | null;
  executionResult?: string | null;
  idempotencyKey: string;
}

export interface FraudDetectionRule {
  id: string;
  code: string;
  domain: FraudDomainCategory;
  name: string;
  description: string;
  enabled: boolean;
  weight: number;
  thresholdValue: number;
  thresholdUnit: string;
  autoAction: 'journaliser' | 'alerter' | 'bloquer_operation_cible';
  requiresDualControlToEdit: boolean;
}

export interface FraudSettings {
  dualValidationRequired: boolean;
  autoHoldCriticalOps: boolean;
  autoHoldHighOps: boolean;
  maskSensitiveFinancialCoords: boolean;
  notifyOnMediumRisk: boolean;
  highRiskScoreThreshold: number;
  criticalRiskScoreThreshold: number;
  suspiciousWithdrawalAmountFcfa: number;
  withdrawalBurstMaxIn10Min: number;
  failedPaymentBurstMaxIn30Min: number;
}

export interface FraudStaffPermissionRow {
  staffId: string;
  name: string;
  email: string;
  role: SecurityRole;
  title: string;
  active: boolean;
  mfaEnabled: boolean;
  permissions: Record<FraudPermissionKey, boolean>;
}

export interface FraudDashboardKpis {
  monitoredTransactionsCount: number;
  suspiciousOperationsCount: number;
  confirmedFraudsCount: number;
  pendingAlertsCount: number;
  totalSuspiciousAmountFcfa: number;
  confirmedFinancialLossFcfa: number;
  temporarilyBlockedAmountFcfa: number;
  accountsUnderWatchCount: number;
  lastDetectionAt: string | null;
  byRiskLevel: Record<FraudRiskLevel, number>;
  pendingDualValidationsCount: number;
}

export interface FraudOverviewResponse {
  success: boolean;
  generatedAt: string;
  actor: {
    staffId: string;
    name: string;
    role: SecurityRole;
    permissions: Record<FraudPermissionKey, boolean>;
  };
  providerIntegration: {
    geniusPayConfigured: boolean;
    externalVerificationMode: string;
    dualControlAvailableAdminsCount: number;
  };
  kpis: FraudDashboardKpis;
  accountsWatch: FraudAccountWatchRecord[];
  suspiciousPayments: FraudPaymentRecord[];
  suspiciousWithdrawals: FraudWithdrawalRecord[];
  walletConsistencies: FraudWalletConsistencyRecord[];
  orderAnomalies: FraudOrderAnomalyRecord[];
  linkedClusters: FraudLinkedAccountsCluster[];
  alerts: FraudAlertRecord[];
  blockedOperations: FraudWithdrawalRecord[];
  sensitiveActionRequests: FraudSensitiveActionRequest[];
  historyAlerts: FraudAlertRecord[];
  rules: FraudDetectionRule[];
  settings: FraudSettings;
  staffPermissions: FraudStaffPermissionRow[];
}
