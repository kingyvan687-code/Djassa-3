import type { Express, NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { atomicWriteJsonFile } from './atomicFileStore';
import {
  appendAuditEntry,
  authenticateSessionRequest,
  getSecurityStaffDirectory,
  recordVerifiedFinancialOperationInSecurityLedger,
  redactSensitiveText,
  verifyStepUpMfaForRequest,
  type AuthenticatedRequestContext
} from './securityModule';
import { getDisputesSnapshotForRefunds, syncRefundConfirmationIntoDispute } from './disputesModule';
import { getGeniusPayConfig, initiateGeniusPayPayout, initiateGeniusPayRefund } from './geniusPayService';
import type {
  CompensationBeneficiaryRole,
  CompensationFundingSource,
  CompensationReasonKey,
  CompensationRecord,
  CompensationStatus,
  PaymentProviderChannelId,
  RefundActorInfo,
  RefundDashboardKpis,
  RefundEvidenceItem,
  RefundFinancialBreakdown,
  RefundFinancialJournalEntry,
  RefundModuleSettings,
  RefundNotificationItem,
  RefundOrderItemBreakdown,
  RefundOriginType,
  RefundOverviewResponse,
  RefundPermissionKey,
  RefundProviderAttempt,
  RefundProviderStatusInfo,
  RefundRecord,
  RefundStaffPermissionRow,
  RefundStatus,
  RefundSuspiciousSignal,
  RefundType,
  RefundWorkflowStep
} from '../src/types/refunds';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const REFUNDS_DB_FILE = path.join(DATA_DIR, 'refunds_db.json');

export const ALL_REFUND_PERMISSIONS: RefundPermissionKey[] = [
  'viewRefunds',
  'createRefundOrCompRequest',
  'verifyAndRequestEvidence',
  'approveRefundStandard',
  'superAdminFinalValidate',
  'executeProviderTransfer',
  'manageCompensations',
  'cancelOrRetryOperation',
  'viewImmutableFinancialJournal',
  'manageRefundSettings'
];

const DEFAULT_REFUND_SETTINGS: RefundModuleSettings = {
  dualValidationThresholdFcfa: 10000,
  maxSingleRefundFcfa: 500000,
  maxCompensationFcfa: 250000,
  slaProcessingHours: 48,
  maxRetriesPerOperation: 3,
  enabledRefundTypes: {
    complet: true,
    partiel: true,
    apres_annulation: true,
    apres_litige: true,
    exceptionnel: true
  },
  enabledCompensationReasons: {
    colis_perdu: true,
    produit_endommage_transport: true,
    erreur_livraison: true,
    prejudice_commercial: true,
    incident_technique: true,
    decision_mediation: true,
    autre_incident_justifie: true
  },
  eligibilityRules: {
    requireVerifiedInitialTransaction: true,
    requireProofOverFcfa: 15000,
    maxOrderAgeDays: 30,
    refundDeliveryFeeOnFullCancellation: true,
    refundDeliveryFeeOnDispute: true,
    requireTitularityCheckBeforePayout: true,
    blockDuplicateRefundsStrictly: true
  },
  commissionRules: {
    reverseSellerCommissionOnFullRefund: true,
    reverseDriverCommissionOnUndeliveredCancellation: true,
    reversePlatformServiceFeeOnFullRefund: true,
    refundProviderFeesToClient: false,
    preventDoubleCommissionReversal: true
  },
  notificationsEnabled: {
    request_created: true,
    evidence_requested: true,
    approved: true,
    rejected: true,
    processing_started: true,
    operation_failed: true,
    refund_confirmed: true,
    compensation_confirmed: true
  },
  settingsChangeHistory: []
};

interface RefundsDatabase {
  refunds: RefundRecord[];
  compensations: CompensationRecord[];
  journal: RefundFinancialJournalEntry[];
  notifications: RefundNotificationItem[];
  settings: RefundModuleSettings;
  staffPermissions: Record<string, Record<RefundPermissionKey, boolean>>;
  processedIdempotencyKeys: Record<string, { at: string; resourceId: string }>;
}

function defaultPermissionsForRole(role: string): Record<RefundPermissionKey, boolean> {
  if (role === 'super_admin') {
    return {
      viewRefunds: true,
      createRefundOrCompRequest: true,
      verifyAndRequestEvidence: true,
      approveRefundStandard: true,
      superAdminFinalValidate: true,
      executeProviderTransfer: true,
      manageCompensations: true,
      cancelOrRetryOperation: true,
      viewImmutableFinancialJournal: true,
      manageRefundSettings: true
    };
  }
  if (role === 'admin') {
    return {
      viewRefunds: true,
      createRefundOrCompRequest: true,
      verifyAndRequestEvidence: true,
      approveRefundStandard: true,
      superAdminFinalValidate: false,
      executeProviderTransfer: true,
      manageCompensations: true,
      cancelOrRetryOperation: true,
      viewImmutableFinancialJournal: true,
      manageRefundSettings: false
    };
  }
  if (role === 'security_agent') {
    return {
      viewRefunds: true,
      createRefundOrCompRequest: false,
      verifyAndRequestEvidence: true,
      approveRefundStandard: false,
      superAdminFinalValidate: true,
      executeProviderTransfer: false,
      manageCompensations: false,
      cancelOrRetryOperation: false,
      viewImmutableFinancialJournal: true,
      manageRefundSettings: false
    };
  }
  return {
    viewRefunds: true,
    createRefundOrCompRequest: false,
    verifyAndRequestEvidence: false,
    approveRefundStandard: false,
    superAdminFinalValidate: false,
    executeProviderTransfer: false,
    manageCompensations: false,
    cancelOrRetryOperation: false,
    viewImmutableFinancialJournal: true,
    manageRefundSettings: false
  };
}

function getEffectivePermissions(staffId: string, role: string): Record<RefundPermissionKey, boolean> {
  if (role === 'super_admin') return defaultPermissionsForRole('super_admin');
  const defaults = defaultPermissionsForRole(role);
  const custom = refundsDb.staffPermissions[staffId];
  if (!custom) return defaults;
  return { ...defaults, ...custom };
}

function loadRefundsDb(): RefundsDatabase {
  if (fs.existsSync(REFUNDS_DB_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(REFUNDS_DB_FILE, 'utf8'));
      return {
        refunds: Array.isArray(raw.refunds) ? raw.refunds : [],
        compensations: Array.isArray(raw.compensations) ? raw.compensations : [],
        journal: Array.isArray(raw.journal) ? raw.journal : [],
        notifications: Array.isArray(raw.notifications) ? raw.notifications : [],
        settings: {
          ...DEFAULT_REFUND_SETTINGS,
          ...(raw.settings || {}),
          enabledRefundTypes: {
            ...DEFAULT_REFUND_SETTINGS.enabledRefundTypes,
            ...(raw.settings?.enabledRefundTypes || {})
          },
          enabledCompensationReasons: {
            ...DEFAULT_REFUND_SETTINGS.enabledCompensationReasons,
            ...(raw.settings?.enabledCompensationReasons || {})
          },
          eligibilityRules: {
            ...DEFAULT_REFUND_SETTINGS.eligibilityRules,
            ...(raw.settings?.eligibilityRules || {})
          },
          commissionRules: {
            ...DEFAULT_REFUND_SETTINGS.commissionRules,
            ...(raw.settings?.commissionRules || {})
          },
          notificationsEnabled: {
            ...DEFAULT_REFUND_SETTINGS.notificationsEnabled,
            ...(raw.settings?.notificationsEnabled || {})
          },
          settingsChangeHistory: Array.isArray(raw.settings?.settingsChangeHistory)
            ? raw.settings.settingsChangeHistory
            : []
        },
        staffPermissions: raw.staffPermissions && typeof raw.staffPermissions === 'object' ? raw.staffPermissions : {},
        processedIdempotencyKeys:
          raw.processedIdempotencyKeys && typeof raw.processedIdempotencyKeys === 'object'
            ? raw.processedIdempotencyKeys
            : {}
      };
    } catch (err) {
      console.error('[Refunds] Failed to parse refunds_db.json, initializing fresh DB:', err);
    }
  }
  return {
    refunds: [],
    compensations: [],
    journal: [],
    notifications: [],
    settings: JSON.parse(JSON.stringify(DEFAULT_REFUND_SETTINGS)),
    staffPermissions: {},
    processedIdempotencyKeys: {}
  };
}

let refundsDb: RefundsDatabase = loadRefundsDb();

function persistRefundsDb() {
  if (!atomicWriteJsonFile(REFUNDS_DB_FILE, refundsDb, { context: 'Refunds' })) {
    console.error('[Refunds] Failed to persist refunds_db.json');
  }
}

if (!fs.existsSync(REFUNDS_DB_FILE)) {
  persistRefundsDb();
}

function getProviderStatuses(): RefundProviderStatusInfo[] {
  const gpConfigured = getGeniusPayConfig().configured;

  return [
    {
      id: 'internal_ledger',
      name: 'Portefeuille & Registre Interne DJASSA',
      configured: true,
      supportsAutomaticRefund: true,
      supportsAutomaticPayout: true,
      modeLabel: 'Serveur actif (Temps réel)',
      statusDetail: 'Exécution atomique sur le registre serveur DJASSA avec idempotence et journal immuable.'
    },
    {
      id: 'wave',
      name: 'Wave Côte d’Ivoire (via GeniusPay)',
      configured: gpConfigured,
      supportsAutomaticRefund: gpConfigured,
      supportsAutomaticPayout: gpConfigured,
      modeLabel: gpConfigured ? 'GeniusPay API Connectée' : 'Traitement manuel contrôlé',
      statusDetail: gpConfigured
        ? 'Connecté via GeniusPay (GENIUSPAY_API_KEY) : initiation API active, confirmation par webhook.'
        : 'GENIUSPAY_API_KEY absent : passe en « En cours de traitement » jusqu’à saisie du reçu vérifié.'
    },
    {
      id: 'orange_money',
      name: 'Orange Money CI (via GeniusPay)',
      configured: gpConfigured,
      supportsAutomaticRefund: gpConfigured,
      supportsAutomaticPayout: gpConfigured,
      modeLabel: gpConfigured ? 'GeniusPay API Connectée' : 'Traitement manuel contrôlé',
      statusDetail: gpConfigured
        ? 'Connecté via GeniusPay (GENIUSPAY_API_KEY) : initiation API active, confirmation par webhook.'
        : 'GENIUSPAY_API_KEY absent : exige validation manuelle avec référence Orange Money.'
    },
    {
      id: 'mtn_momo',
      name: 'MTN Mobile Money (via GeniusPay)',
      configured: gpConfigured,
      supportsAutomaticRefund: gpConfigured,
      supportsAutomaticPayout: gpConfigured,
      modeLabel: gpConfigured ? 'GeniusPay API Connectée' : 'Traitement manuel contrôlé',
      statusDetail: gpConfigured
        ? 'Connecté via GeniusPay (GENIUSPAY_API_KEY) : initiation API active, confirmation par webhook.'
        : 'GENIUSPAY_API_KEY absent : exige validation manuelle avec preuve MTN MoMo.'
    },
    {
      id: 'card',
      name: 'Carte Bancaire (via GeniusPay)',
      configured: gpConfigured,
      supportsAutomaticRefund: gpConfigured,
      supportsAutomaticPayout: gpConfigured,
      modeLabel: gpConfigured ? 'GeniusPay API Connectée' : 'Traitement manuel contrôlé',
      statusDetail: gpConfigured
        ? 'Passerelle GeniusPay Carte active.'
        : 'GENIUSPAY_API_KEY absent : confirmation manuelle de reçu bancaire requise.'
    },
    {
      id: 'bank_transfer',
      name: 'Virement Bancaire / Chèque certifié',
      configured: false,
      supportsAutomaticRefund: false,
      supportsAutomaticPayout: false,
      modeLabel: 'Traitement manuel contrôlé',
      statusDetail: 'Virement bancaire hors-ligne : confirmation manuelle avec référence SWIFT/RIB obligatoire.'
    }
  ];
}

function normalizeChannel(raw?: string): PaymentProviderChannelId {
  const v = String(raw || '').toLowerCase();
  if (v.includes('wave')) return 'wave';
  if (v.includes('orange') || v === 'om') return 'orange_money';
  if (v.includes('mtn') || v.includes('momo')) return 'mtn_momo';
  if (v.includes('card') || v.includes('carte') || v.includes('visa') || v.includes('geniuspay')) return 'card';
  if (v.includes('bank') || v.includes('virement')) return 'bank_transfer';
  return 'internal_ledger';
}

function maskContact(val?: string): string | undefined {
  if (!val) return undefined;
  const s = String(val).trim();
  if (!s) return undefined;
  if (s.includes('@')) {
    const [u, d] = s.split('@');
    return `${u.slice(0, 2)}***@${d}`;
  }
  const digits = s.replace(/\s+/g, '');
  if (digits.length >= 6) {
    return `${digits.slice(0, 4)} •••• ${digits.slice(-2)}`;
  }
  return s;
}

function makeCode(prefix: 'RBT' | 'IND'): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rnd = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${ymd}-${rnd}`;
}

function sha256Of(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function appendJournalEntry(params: Omit<RefundFinancialJournalEntry, 'id' | 'at' | 'immutableChecksum'>): RefundFinancialJournalEntry {
  const nowIso = new Date().toISOString();
  const id = `rfj-${crypto.randomUUID().slice(0, 10)}`;
  const checksumSeed = `${id}|${nowIso}|${params.entryType}|${params.entityId}|${params.amountFcfa}|${params.commissionDeltaFcfa}|${params.providerReference}`;
  const entry: RefundFinancialJournalEntry = {
    ...params,
    id,
    at: nowIso,
    immutableChecksum: sha256Of(checksumSeed),
    note: redactSensitiveText(params.note)
  };
  refundsDb.journal.unshift(entry);
  if (refundsDb.journal.length > 1000) refundsDb.journal = refundsDb.journal.slice(0, 1000);
  return entry;
}

function pushRefundNotification(params: {
  entityType: 'refund' | 'compensation';
  entityId: string;
  entityCode: string;
  eventType: RefundNotificationItem['eventType'];
  recipientRole: RefundNotificationItem['recipientRole'];
  recipientName: string;
  title: string;
  body: string;
}) {
  if (!refundsDb.settings.notificationsEnabled[params.eventType]) return;
  const notif: RefundNotificationItem = {
    id: `rfn-${crypto.randomUUID().slice(0, 10)}`,
    entityType: params.entityType,
    entityId: params.entityId,
    entityCode: params.entityCode,
    eventType: params.eventType,
    recipientRole: params.recipientRole,
    recipientName: params.recipientName,
    title: params.title,
    body: redactSensitiveText(params.body),
    createdAt: new Date().toISOString(),
    readByAdminIds: []
  };
  refundsDb.notifications.unshift(notif);
  if (refundsDb.notifications.length > 400) refundsDb.notifications = refundsDb.notifications.slice(0, 400);
}

function buildInitialWorkflowSteps(params: {
  createdAt: string;
  actorName: string;
  requiresSuperAdminValidation: boolean;
  verified?: boolean;
}): RefundWorkflowStep[] {
  const v = Boolean(params.verified);
  return [
    { stepNumber: 1, key: 'created', label: '1. Création de la demande', status: 'done', completedAt: params.createdAt, actorName: params.actorName },
    { stepNumber: 2, key: 'verify_order', label: '2. Vérification commande & transaction', status: v ? 'done' : 'pending', completedAt: v ? params.createdAt : undefined },
    { stepNumber: 3, key: 'verify_evidence', label: '3. Vérification des justificatifs', status: 'pending' },
    { stepNumber: 4, key: 'calculate_amount', label: '4. Calcul du montant autorisé', status: 'done', completedAt: params.createdAt, actorName: params.actorName },
    { stepNumber: 5, key: 'agent_validation', label: '5. Validation par agent habilité', status: 'pending' },
    {
      stepNumber: 6,
      key: 'super_admin_validation',
      label: '6. Double validation Super Administrateur',
      status: params.requiresSuperAdminValidation ? 'pending' : 'skipped',
      note: params.requiresSuperAdminValidation ? 'Requis par seuil configuré' : 'Non requis (montant sous seuil)'
    },
    { stepNumber: 7, key: 'provider_execution', label: '7. Exécution via prestataire de paiement', status: 'pending' },
    { stepNumber: 8, key: 'result_confirmation', label: '8. Confirmation du résultat', status: 'pending' },
    { stepNumber: 9, key: 'beneficiary_notification', label: '9. Notification au bénéficiaire', status: 'pending' },
    { stepNumber: 10, key: 'archived', label: '10. Archivage du dossier', status: 'pending' }
  ];
}

function markStep(steps: RefundWorkflowStep[], stepNumber: number, status: RefundWorkflowStep['status'], actorName?: string, note?: string) {
  const s = steps.find((st) => st.stepNumber === stepNumber);
  if (!s) return;
  s.status = status;
  if (status === 'done') s.completedAt = new Date().toISOString();
  if (actorName) s.actorName = actorName;
  if (note) s.note = note;
}

function computeFinancialBreakdown(params: {
  items: RefundOrderItemBreakdown[];
  deliveryFeeFcfa: number;
  discountFcfa: number;
  initialPaidFcfa: number;
  disputedAmountFcfa?: number;
  requestedAmountFcfa?: number;
  customAdjustedAmountFcfa?: number;
  refundType: RefundType;
  alreadyRefundedFcfa?: number;
  hasDriver?: boolean;
  existingCommissionState?: Partial<RefundFinancialBreakdown['commissions']>;
}): RefundFinancialBreakdown {
  const settings = refundsDb.settings;
  const productsSubtotalFcfa = params.items.reduce((s, it) => s + it.lineTotalFcfa, 0);
  const serviceFeeFcfa = Math.round(productsSubtotalFcfa * 0.065); // 6.5% DJASSA client service fee (online payments)
  const sellerCommissionChargedFcfa = params.items.length > 0 ? 150 : 0; // 150 FCFA fixed DJASSA commission
  const driverCommissionChargedFcfa = 0; // Livreur & entreprise supprimés
  const paymentProviderFeeFcfa = params.initialPaidFcfa > 0 ? Math.round(params.initialPaidFcfa * 0.045) + 100 : 0; // 4.5% + 100 F

  const deliveryRefundAllowed =
    (params.refundType === 'complet' || params.refundType === 'apres_annulation')
      ? settings.eligibilityRules.refundDeliveryFeeOnFullCancellation
      : params.refundType === 'apres_litige'
      ? settings.eligibilityRules.refundDeliveryFeeOnDispute
      : false;

  const refundableDeliveryFeeFcfa = deliveryRefundAllowed ? params.deliveryFeeFcfa : 0;
  const nonRefundableDeliveryFee = params.deliveryFeeFcfa - refundableDeliveryFeeFcfa;
  const nonRefundableProviderFee = settings.commissionRules.refundProviderFeesToClient ? 0 : 0; // Client receives net paid product+eligible delivery

  const selectedItemsTotal = params.items
    .filter((i) => i.selectedForRefund && i.refundQuantity > 0)
    .reduce((s, i) => s + i.refundableLineFcfa, 0);

  const rawMaxAllowed =
    params.refundType === 'partiel'
      ? Math.min(params.initialPaidFcfa, (selectedItemsTotal > 0 ? selectedItemsTotal : productsSubtotalFcfa) + refundableDeliveryFeeFcfa)
      : Math.min(params.initialPaidFcfa, Math.max(0, productsSubtotalFcfa - params.discountFcfa) + refundableDeliveryFeeFcfa);

  const authorizedMaxRefundFcfa = Math.min(settings.maxSingleRefundFcfa, Math.max(0, Math.round(rawMaxAllowed)));

  let requestedAmountFcfa =
    typeof params.customAdjustedAmountFcfa === 'number' && params.customAdjustedAmountFcfa > 0
      ? Math.min(authorizedMaxRefundFcfa, Math.round(params.customAdjustedAmountFcfa))
      : typeof params.requestedAmountFcfa === 'number' && params.requestedAmountFcfa > 0
      ? Math.min(authorizedMaxRefundFcfa, Math.round(params.requestedAmountFcfa))
      : authorizedMaxRefundFcfa;

  if (requestedAmountFcfa <= 0 && params.initialPaidFcfa > 0) {
    requestedAmountFcfa = Math.min(authorizedMaxRefundFcfa, params.initialPaidFcfa);
  }

  const alreadyRefundedFcfa = Math.max(0, Math.round(params.alreadyRefundedFcfa || 0));
  const remainingToRefundFcfa = Math.max(0, requestedAmountFcfa - alreadyRefundedFcfa);

  const sellerNetBeforeRefundFcfa = Math.max(0, productsSubtotalFcfa - params.discountFcfa - sellerCommissionChargedFcfa);
  const deliveryActorShareFcfa = Math.max(0, params.deliveryFeeFcfa - driverCommissionChargedFcfa);

  return {
    productsSubtotalFcfa,
    deliveryFeeFcfa: params.deliveryFeeFcfa,
    serviceFeeFcfa,
    discountFcfa: params.discountFcfa,
    initialPaidFcfa: params.initialPaidFcfa,
    sellerNetBeforeRefundFcfa,
    deliveryActorShareFcfa,
    disputedAmountFcfa: Math.round(params.disputedAmountFcfa || requestedAmountFcfa),
    authorizedMaxRefundFcfa,
    requestedAmountFcfa,
    customAdjustedAmountFcfa: params.customAdjustedAmountFcfa,
    alreadyRefundedFcfa,
    remainingToRefundFcfa,
    refundableDeliveryFeeFcfa,
    nonRefundableFeesFcfa: nonRefundableDeliveryFee + nonRefundableProviderFee,
    commissions: {
      sellerCommissionChargedFcfa,
      driverCommissionChargedFcfa,
      platformServiceFeeFcfa: serviceFeeFcfa,
      paymentProviderFeeFcfa,
      sellerCommissionReversedFcfa: params.existingCommissionState?.sellerCommissionReversedFcfa || 0,
      driverCommissionReversedFcfa: params.existingCommissionState?.driverCommissionReversedFcfa || 0,
      serviceFeeReversedFcfa: params.existingCommissionState?.serviceFeeReversedFcfa || 0,
      providerFeeRefundable: settings.commissionRules.refundProviderFeesToClient,
      commissionAlreadyReversedOnce: Boolean(params.existingCommissionState?.commissionAlreadyReversedOnce),
      lastCommissionAdjustmentAt: params.existingCommissionState?.lastCommissionAdjustmentAt,
      commissionAdjustmentRef: params.existingCommissionState?.commissionAdjustmentRef
    }
  };
}

function evaluateSuspiciousSignals(record: RefundRecord): RefundSuspiciousSignal[] {
  const signals: RefundSuspiciousSignal[] = [];
  const nowIso = new Date().toISOString();

  // 1. Possible duplicate refund on same order or transaction ref
  const otherForSameOrder = refundsDb.refunds.filter(
    (r) =>
      r.id !== record.id &&
      r.status !== 'refusee' &&
      r.status !== 'annulee' &&
      (r.orderNumber === record.orderNumber ||
        (record.initialTransactionRef && r.initialTransactionRef === record.initialTransactionRef && record.initialTransactionRef !== 'N/A'))
  );
  if (otherForSameOrder.length > 0) {
    signals.push({
      id: `sig-dup-${record.id}`,
      code: 'POSSIBLE_DUPLICATE_REFUND',
      severity: 'critique',
      label: 'Risque de remboursement en double',
      detail: `${otherForSameOrder.length} autre(s) dossier(s) actif(s)/exécuté(s) sur la commande ${record.orderNumber} (${otherForSameOrder.map((o) => o.code).join(', ')}).`,
      detectedAt: nowIso
    });
  }

  // 2. Over-paid amount attempt
  if (
    record.financial.requestedAmountFcfa > record.financial.initialPaidFcfa ||
    record.financial.alreadyRefundedFcfa + record.financial.remainingToRefundFcfa > record.financial.initialPaidFcfa
  ) {
    signals.push({
      id: `sig-over-${record.id}`,
      code: 'OVER_PAID_AMOUNT_ATTEMPT',
      severity: 'critique',
      label: 'Montant supérieur au paiement initial',
      detail: `Demandé ${record.financial.requestedAmountFcfa} FCFA vs payé ${record.financial.initialPaidFcfa} FCFA.`,
      detectedAt: nowIso
    });
  }

  // 3. Repeated claims/refunds by client in last 30 days
  const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
  const clientRefunds30d = refundsDb.refunds.filter(
    (r) =>
      r.actors.client.accountId === record.actors.client.accountId &&
      new Date(r.createdAt).getTime() >= thirtyDaysAgo
  );
  if (clientRefunds30d.length >= 3) {
    signals.push({
      id: `sig-rep-${record.id}`,
      code: 'REPEATED_CANCELLATIONS_OR_REFUNDS',
      severity: 'eleve',
      label: 'Fréquence élevée de remboursements',
      detail: `${clientRefunds30d.length} demandes de remboursement sur les 30 derniers jours pour ${record.actors.client.name}.`,
      detectedAt: nowIso
    });
  }

  // 4. Beneficiary titularity not checked
  if (!record.beneficiaryTitularityChecked) {
    signals.push({
      id: `sig-tit-${record.id}`,
      code: 'BENEFICIARY_MISMATCH',
      severity: 'moyen',
      label: 'Titularité bénéficiaire à vérifier',
      detail: 'Vérifiez que le compte Mobile Money / bancaire correspond exactement au titulaire autorisé.',
      detectedAt: nowIso
    });
  }

  // 5. Frequent failed retries
  const failedAttempts = record.providerAttempts.filter(
    (a) => a.providerResponseStatus === 'failed_provider_error' || a.providerResponseStatus === 'failed_not_configured'
  );
  if (failedAttempts.length >= 2) {
    signals.push({
      id: `sig-fail-${record.id}`,
      code: 'FREQUENT_FAILED_RETRIES',
      severity: 'eleve',
      label: 'Échecs répétés prestataire',
      detail: `${failedAttempts.length} tentatives de versement échouées sur ce dossier.`,
      detectedAt: nowIso
    });
  }

  return signals;
}

function buildOrderItemsFromAnyOrder(order: any): RefundOrderItemBreakdown[] {
  const rawItems = Array.isArray(order?.items) ? order.items : [];
  if (rawItems.length === 0) {
    const fallbackTotal = Number(order?.subtotal || order?.total || 0);
    return [
      {
        productId: 'item-1',
        productTitle: `Articles commande #${order?.orderNumber || 'DJASSA'}`,
        orderedQuantity: 1,
        refundQuantity: 1,
        unitPriceFcfa: fallbackTotal,
        lineTotalFcfa: fallbackTotal,
        refundableLineFcfa: fallbackTotal,
        selectedForRefund: true
      }
    ];
  }
  return rawItems.map((it: any, idx: number) => {
    const qty = Math.max(1, Number(it.quantity || 1));
    const unit = Math.max(0, Number(it.price ?? it.unitPriceFcfa ?? 0));
    const lineTotal = unit * qty;
    return {
      productId: String(it.productId || `item-${idx + 1}`),
      productTitle: String(it.productTitle || 'Article DJASSA'),
      productImage: it.productImage,
      orderedQuantity: qty,
      refundQuantity: qty,
      unitPriceFcfa: unit,
      lineTotalFcfa: lineTotal,
      refundableLineFcfa: lineTotal,
      selectedForRefund: true,
      sellerId: it.sellerId,
      sellerName: it.sellerName
    };
  });
}

function syncFromOrdersAndDisputes(payload?: { orders?: any[]; sellers?: any[]; drivers?: any[] }): {
  importedRefunds: number;
  importedIds: string[];
} {
  let importedRefunds = 0;
  const importedIds: string[] = [];
  const nowIso = new Date().toISOString();

  // 1. Sync from real disputes in disputes_db.json
  const disputes = getDisputesSnapshotForRefunds();
  for (const d of disputes) {
    const hasRefundActivity =
      d.financial.refundStatus !== 'aucun' ||
      d.financial.refundedAmountFcfa > 0 ||
      d.financial.amountToRefundFcfa > 0 ||
      d.category === 'remboursement_non_recu' ||
      d.category === 'paiement_debite_plusieurs_fois';
    if (!hasRefundActivity) continue;

    const alreadyExists = refundsDb.refunds.some(
      (r) => r.linkedDisputeId === d.id || r.linkedDisputeCode === d.code
    );
    if (alreadyExists) continue;

    const items = buildOrderItemsFromAnyOrder(d.orderSnapshot);
    const channel = normalizeChannel(d.orderSnapshot?.paymentMethod || d.financial.transactions[0]?.channel);
    const initialPaid = Math.max(d.orderSnapshot?.totalFcfa || d.amountFcfa, d.financial.disputedAmountFcfa || d.amountFcfa);
    const alreadyRefunded = Math.max(0, d.financial.refundedAmountFcfa || 0);
    const requested = Math.max(
      alreadyRefunded,
      d.financial.amountToRefundFcfa || d.financial.disputedAmountFcfa || d.amountFcfa
    );
    const refundType: RefundType =
      d.category === 'paiement_debite_plusieurs_fois'
        ? 'exceptionnel'
        : requested < initialPaid
        ? 'partiel'
        : 'apres_litige';

    const status: RefundStatus =
      d.financial.refundStatus === 'confirme'
        ? alreadyRefunded < initialPaid
          ? 'partiellement_effectuee'
          : 'effectuee'
        : d.financial.refundStatus === 'echoue'
        ? 'echouee'
        : d.financial.refundStatus === 'rejete'
        ? 'refusee'
        : d.financial.refundStatus === 'en_attente_confirmation_prestataire'
        ? 'en_cours_traitement'
        : d.financial.refundStatus === 'en_attente_double_validation'
        ? 'en_attente_validation'
        : 'nouvelle_demande';

    const financial = computeFinancialBreakdown({
      items,
      deliveryFeeFcfa: d.orderSnapshot?.deliveryFeeFcfa || 0,
      discountFcfa: d.orderSnapshot?.discountFcfa || 0,
      initialPaidFcfa: initialPaid,
      disputedAmountFcfa: d.financial.disputedAmountFcfa || d.amountFcfa,
      requestedAmountFcfa: requested,
      refundType,
      alreadyRefundedFcfa: alreadyRefunded,
      hasDriver: Boolean(d.actors.driver)
    });

    const needsDual = requested > refundsDb.settings.dualValidationThresholdFcfa;
    const steps = buildInitialWorkflowSteps({
      createdAt: d.createdAt || nowIso,
      actorName: d.assignedAgentName || 'Synchronisation Litiges',
      requiresSuperAdminValidation: needsDual,
      verified: true
    });
    if (status === 'effectuee' || status === 'partiellement_effectuee') {
      [2, 3, 4, 5, 7, 8, 9].forEach((sn) => markStep(steps, sn, 'done', d.financial.financialManagerName || 'Admin'));
      if (needsDual) markStep(steps, 6, 'done', d.financial.financialManagerName || 'Super Admin');
    }

    const clientPhone = d.actors.client?.phoneFull || d.actors.client?.phoneMasked || '+225 07 00 00 00 00';
    const rec: RefundRecord = {
      id: `rbt-${crypto.randomUUID().slice(0, 10)}`,
      code: makeCode('RBT'),
      origin: 'reclamation_litige',
      linkedDisputeId: d.id,
      linkedDisputeCode: d.code,
      orderId: d.orderSnapshot?.orderId,
      orderNumber: d.orderNumber,
      initialTransactionRef: d.orderSnapshot?.transactionRef || `TX-${d.orderNumber}`,
      initialPaymentMethod: d.orderSnapshot?.paymentMethod || 'Wave',
      refundType,
      reasonCategory: d.category,
      reasonDetail: d.subject || d.description,
      status,
      createdAt: d.createdAt || nowIso,
      updatedAt: nowIso,
      dueAt: new Date(Date.now() + refundsDb.settings.slaProcessingHours * 3_600_000).toISOString(),
      completedAt: status === 'effectuee' || status === 'partiellement_effectuee' ? d.financial.refundDate || nowIso : null,
      archived: false,
      assignedAgentId: d.assignedAgentId || null,
      assignedAgentName: d.assignedAgentName || null,
      requiresSuperAdminValidation: needsDual,
      targetChannel: channel,
      beneficiaryPayoutAccount: maskContact(clientPhone) || d.actors.client.name,
      beneficiaryTitularityChecked: true,
      actors: {
        client: {
          accountId: d.actors.client.accountId,
          roleType: 'client',
          name: d.actors.client.name,
          avatar: d.actors.client.avatar,
          phoneMasked: maskContact(clientPhone),
          phoneFull: d.actors.client.phoneFull,
          emailMasked: d.actors.client.emailMasked,
          emailFull: d.actors.client.emailFull,
          commune: d.actors.client.commune,
          accountStatus: 'active',
          payoutTargetMasked: maskContact(clientPhone),
          titularityVerified: true
        },
        seller: d.actors.seller
          ? {
              accountId: d.actors.seller.accountId,
              roleType: 'seller',
              name: d.actors.seller.name,
              avatar: d.actors.seller.avatar,
              phoneMasked: d.actors.seller.phoneMasked,
              commune: d.actors.seller.commune,
              accountStatus: 'active'
            }
          : undefined,
        driver: d.actors.driver
          ? {
              accountId: d.actors.driver.accountId,
              roleType: 'driver',
              name: d.actors.driver.name,
              avatar: d.actors.driver.avatar,
              phoneMasked: d.actors.driver.phoneMasked,
              commune: d.actors.driver.commune,
              accountStatus: 'active'
            }
          : undefined,
        company: d.actors.company
          ? {
              accountId: d.actors.company.accountId,
              roleType: 'company',
              name: d.actors.company.name,
              avatar: d.actors.company.avatar,
              phoneMasked: d.actors.company.phoneMasked,
              accountStatus: 'active'
            }
          : undefined
      },
      items,
      financial,
      evidence: (d.evidence || []).map((ev) => ({
        id: ev.id,
        title: ev.title,
        kind: 'order_proof',
        urlOrData: ev.urlOrData,
        sha256: ev.sha256,
        addedAt: ev.addedAt,
        addedById: ev.addedById,
        addedByName: ev.addedByName,
        immutable: true
      })),
      steps,
      decisions: [
        {
          id: `dec-${crypto.randomUUID().slice(0, 8)}`,
          at: nowIso,
          actorId: 'system-sync',
          actorName: 'Synchronisation Litiges DJASSA',
          actorRole: 'system',
          action: 'Importé depuis Réclamations & litiges',
          toStatus: status,
          note: `Dossier lié au litige ${d.code} (${d.subject})`
        }
      ],
      providerAttempts: [],
      suspiciousSignals: []
    };
    rec.suspiciousSignals = evaluateSuspiciousSignals(rec);
    refundsDb.refunds.unshift(rec);
    importedRefunds++;
    importedIds.push(rec.id);
  }

  // 2. Sync from cancelled / damaged / returned orders with paymentStatus === 'paid'
  const orders = Array.isArray(payload?.orders) ? payload!.orders : [];
  const sellers = Array.isArray(payload?.sellers) ? payload!.sellers : [];
  for (const order of orders) {
    const isIncidentOrder =
      order.status === 'cancelled' ||
      order.status === 'damaged' ||
      order.status === 'returned' ||
      Boolean(order.incident);
    if (!isIncidentOrder) continue;
    if (order.paymentStatus !== 'paid') continue;

    const alreadyExists = refundsDb.refunds.some((r) => r.orderNumber === order.orderNumber);
    if (alreadyExists) continue;

    const items = buildOrderItemsFromAnyOrder(order);
    const firstSellerId = items[0]?.sellerId;
    const sellerObj = sellers.find((s: any) => s.id === firstSellerId);
    const channel = normalizeChannel(order.paymentMethod);
    const compStatus = order.incident?.compensationStatus;
    const isAlreadyRefunded = compStatus === 'refunded';
    const isApproved = compStatus === 'approved';
    const refundType: RefundType =
      order.status === 'cancelled'
        ? 'apres_annulation'
        : order.status === 'damaged' || order.status === 'returned'
        ? 'apres_litige'
        : 'complet';
    const origin: RefundOriginType =
      order.status === 'cancelled'
        ? 'annulation_commande'
        : order.status === 'damaged' || order.status === 'returned'
        ? 'incident_livraison'
        : 'reclamation_litige';

    const requestedAmount = Number(order.incident?.compensationAmount || order.total || 0) || Number(order.total || 0);
    const financial = computeFinancialBreakdown({
      items,
      deliveryFeeFcfa: Number(order.deliveryFee || 0),
      discountFcfa: Number(order.discount || 0),
      initialPaidFcfa: Number(order.total || 0),
      disputedAmountFcfa: requestedAmount,
      requestedAmountFcfa: requestedAmount,
      refundType,
      alreadyRefundedFcfa: isAlreadyRefunded ? requestedAmount : 0,
      hasDriver: Boolean(order.driver)
    });

    if (isAlreadyRefunded) {
      financial.commissions.sellerCommissionReversedFcfa = financial.commissions.sellerCommissionChargedFcfa;
      financial.commissions.serviceFeeReversedFcfa = financial.commissions.platformServiceFeeFcfa;
      financial.commissions.commissionAlreadyReversedOnce = true;
      financial.commissions.lastCommissionAdjustmentAt = order.incident?.reportedAt || nowIso;
      financial.commissions.commissionAdjustmentRef = `COM-REV-${order.orderNumber}`;
    }

    const status: RefundStatus = isAlreadyRefunded
      ? 'effectuee'
      : isApproved
      ? 'approuvee'
      : 'nouvelle_demande';

    const needsDual = requestedAmount > refundsDb.settings.dualValidationThresholdFcfa;
    const steps = buildInitialWorkflowSteps({
      createdAt: order.incident?.reportedAt || order.createdAt || nowIso,
      actorName: 'Synchronisation Commandes',
      requiresSuperAdminValidation: needsDual,
      verified: isAlreadyRefunded || isApproved
    });
    if (isAlreadyRefunded) {
      [2, 3, 4, 5, 7, 8, 9].forEach((sn) => markStep(steps, sn, 'done', 'Système DJASSA'));
      if (needsDual) markStep(steps, 6, 'done', 'Super Administrateur');
    } else if (isApproved) {
      [2, 3, 4, 5].forEach((sn) => markStep(steps, sn, 'done', 'Agent Supervision'));
    }

    const clientPhone = order.deliveryAddress?.phone || '+225 07 00 00 00 00';
    const clientName = order.deliveryAddress?.recipientName || 'Client DJASSA';
    const rec: RefundRecord = {
      id: `rbt-${crypto.randomUUID().slice(0, 10)}`,
      code: makeCode('RBT'),
      origin,
      orderId: order.id,
      orderNumber: order.orderNumber,
      initialTransactionRef: `PAY-${order.orderNumber}`,
      initialPaymentMethod: order.paymentMethod || 'wave',
      refundType,
      reasonCategory: order.incident?.type || order.status,
      reasonDetail: order.incident?.reason || `Commande ${order.orderNumber} (${order.status})`,
      status,
      createdAt: order.incident?.reportedAt || order.createdAt || nowIso,
      updatedAt: nowIso,
      dueAt: new Date(Date.now() + refundsDb.settings.slaProcessingHours * 3_600_000).toISOString(),
      completedAt: isAlreadyRefunded ? order.incident?.reportedAt || nowIso : null,
      archived: false,
      requiresSuperAdminValidation: needsDual,
      targetChannel: channel,
      beneficiaryPayoutAccount: maskContact(clientPhone) || clientName,
      beneficiaryTitularityChecked: true,
      actors: {
        client: {
          accountId: `client-${order.id}`,
          roleType: 'client',
          name: clientName,
          avatar: order.clientAvatar,
          phoneMasked: maskContact(clientPhone),
          phoneFull: clientPhone,
          commune: order.deliveryAddress?.commune,
          accountStatus: 'active',
          payoutTargetMasked: maskContact(clientPhone),
          titularityVerified: true
        },
        seller: firstSellerId
          ? {
              accountId: firstSellerId,
              roleType: 'seller',
              name: items[0]?.sellerName || sellerObj?.name || 'Boutique partenaire',
              avatar: order.sellerAvatar || sellerObj?.avatar,
              phoneMasked: sellerObj?.phone ? maskContact(sellerObj.phone) : undefined,
              commune: sellerObj?.location,
              accountStatus: 'active'
            }
          : undefined,
        driver: order.driver
          ? {
              accountId: order.driver.id,
              roleType: 'driver',
              name: order.driver.name,
              avatar: order.driver.avatar,
              phoneMasked: maskContact(order.driver.phone),
              commune: order.driver.currentLocation,
              accountStatus: 'active'
            }
          : undefined,
        company: order.deliveryCompanyName
          ? {
              accountId: order.deliveryCompanyId || `comp-${order.id}`,
              roleType: 'company',
              name: order.deliveryCompanyName,
              accountStatus: 'active'
            }
          : undefined
      },
      items,
      financial,
      evidence: order.incident?.photoProof
        ? [
            {
              id: `ev-${crypto.randomUUID().slice(0, 8)}`,
              title: `Preuve incident #${order.orderNumber}`,
              kind: 'photo',
              urlOrData: order.incident.photoProof,
              sha256: sha256Of(order.incident.photoProof),
              addedAt: order.incident.reportedAt || nowIso,
              addedById: order.incident.reportedBy || 'system',
              addedByName: order.incident.reportedBy || 'Système',
              immutable: true
            }
          ]
        : [],
      steps,
      decisions: [
        {
          id: `dec-${crypto.randomUUID().slice(0, 8)}`,
          at: nowIso,
          actorId: 'system-sync',
          actorName: 'Synchronisation Commandes DJASSA',
          actorRole: 'system',
          action: 'Importé depuis le flux commandes réelles',
          toStatus: status,
          note: order.incident?.reason || `Commande ${order.orderNumber}`
        }
      ],
      providerAttempts: isAlreadyRefunded
        ? [
            {
              id: `att-${crypto.randomUUID().slice(0, 8)}`,
              attemptNumber: 1,
              channel,
              amountFcfa: requestedAmount,
              providerConfigured: true,
              providerResponseStatus: 'confirmed_internal_ledger',
              providerReference: `RBT-INIT-${order.orderNumber}`,
              requestedById: 'system-sync',
              requestedByName: 'Synchronisation Commandes',
              at: order.incident?.reportedAt || nowIso,
              confirmedAt: order.incident?.reportedAt || nowIso,
              receiptProof: 'Synchronisé depuis commande déjà remboursée'
            }
          ]
        : [],
      suspiciousSignals: []
    };
    rec.suspiciousSignals = evaluateSuspiciousSignals(rec);
    refundsDb.refunds.unshift(rec);

    if (isAlreadyRefunded) {
      appendJournalEntry({
        entryType: 'refund_executed',
        entityType: 'refund',
        entityId: rec.id,
        entityCode: rec.code,
        orderNumber: rec.orderNumber,
        beneficiaryName: clientName,
        beneficiaryRole: 'client',
        amountFcfa: requestedAmount,
        commissionDeltaFcfa: -(financial.commissions.sellerCommissionReversedFcfa + financial.commissions.serviceFeeReversedFcfa),
        channel,
        providerReference: `RBT-INIT-${order.orderNumber}`,
        actorId: 'system-sync',
        actorName: 'Synchronisation Commandes',
        note: `Remboursement historique commande #${order.orderNumber}`
      });
    }

    importedRefunds++;
    importedIds.push(rec.id);
  }

  if (importedRefunds > 0) {
    persistRefundsDb();
  }
  return { importedRefunds, importedIds };
}

function computeDashboardKpis(): RefundDashboardKpis {
  const now = new Date();
  const startOfMonthMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const totalRefunds = refundsDb.refunds.length;
  const pendingStatuses: RefundStatus[] = ['nouvelle_demande', 'en_attente_validation', 'en_verification', 'approuvee'];
  const pendingRefunds = refundsDb.refunds.filter((r) => pendingStatuses.includes(r.status)).length;
  const inProgressRefunds = refundsDb.refunds.filter((r) => r.status === 'en_cours_traitement').length;
  const completedRefunds = refundsDb.refunds.filter(
    (r) => r.status === 'effectuee' || r.status === 'partiellement_effectuee'
  ).length;
  const failedRefunds = refundsDb.refunds.filter((r) => r.status === 'echouee').length;

  const totalCompensations = refundsDb.compensations.length;
  const totalRefundedAmountFcfa = refundsDb.refunds.reduce((sum, r) => sum + (r.financial.alreadyRefundedFcfa || 0), 0);
  const totalCompensationsPaidFcfa = refundsDb.compensations.reduce((sum, c) => sum + (c.paidAmountFcfa || 0), 0);

  const pendingAmountFcfa = refundsDb.refunds
    .filter((r) => pendingStatuses.includes(r.status) || r.status === 'en_cours_traitement')
    .reduce((sum, r) => sum + (r.financial.remainingToRefundFcfa || 0), 0);

  const monthRefundedAmountFcfa = refundsDb.refunds
    .filter((r) => {
      const refDate = r.completedAt || r.updatedAt;
      return (
        (r.status === 'effectuee' || r.status === 'partiellement_effectuee') &&
        new Date(refDate).getTime() >= startOfMonthMs
      );
    })
    .reduce((sum, r) => sum + (r.financial.alreadyRefundedFcfa || 0), 0);

  const totalCommissionsReversedFcfa = refundsDb.refunds.reduce(
    (sum, r) =>
      sum +
      (r.financial.commissions.sellerCommissionReversedFcfa || 0) +
      (r.financial.commissions.driverCommissionReversedFcfa || 0) +
      (r.financial.commissions.serviceFeeReversedFcfa || 0),
    0
  );

  const suspiciousAlertsCount = refundsDb.refunds.reduce((sum, r) => sum + r.suspiciousSignals.length, 0);

  return {
    totalRefunds,
    pendingRefunds,
    inProgressRefunds,
    completedRefunds,
    failedRefunds,
    totalCompensations,
    totalRefundedAmountFcfa,
    totalCompensationsPaidFcfa,
    pendingAmountFcfa,
    monthRefundedAmountFcfa,
    totalCommissionsReversedFcfa,
    suspiciousAlertsCount
  };
}

function buildStaffPermissionsRows(): RefundStaffPermissionRow[] {
  return getSecurityStaffDirectory().map((s) => ({
    staffId: s.id,
    name: s.name,
    email: s.email,
    role: s.role,
    active: s.active,
    permissions: getEffectivePermissions(s.id, s.role)
  }));
}

function requireRefundPermission(
  permKey: RefundPermissionKey,
  options?: { requireStepUpMfa?: boolean }
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const staff = authCtx.staff;
    if (!staff || !staff.active) {
      appendAuditEntry({
        actorId: authCtx.token.uid,
        actorName: authCtx.token.name,
        actorAccountLabel: authCtx.token.email,
        actorRole: authCtx.token.spaceRole,
        space: authCtx.token.spaceRole,
        category: 'security',
        actionType: 'refund_unauthorized_access',
        action: 'Accès module Remboursements & indemnisations refusé',
        target: req.path,
        targetType: 'permissions',
        result: 'refuse',
        severity: 'eleve',
        details: 'Compte non habilité au module Remboursements & indemnisations'
      });
      return res.status(403).json({
        success: false,
        error: 'ADMIN_ROLE_REQUIRED',
        message: 'Accès réservé aux agents administratifs autorisés.'
      });
    }

    const perms = getEffectivePermissions(staff.id, staff.role);
    if (!perms[permKey]) {
      appendAuditEntry({
        actorId: staff.id,
        actorName: staff.name,
        actorAccountLabel: staff.email,
        actorRole: staff.role,
        space: 'admin',
        category: 'security',
        actionType: 'refund_permission_denied',
        action: `Accès refusé (${permKey})`,
        target: req.path,
        targetType: 'permissions',
        result: 'refuse',
        severity: 'moyen',
        details: `Tentative d'accès sans permission ${permKey}`
      });
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN_REFUND_PERMISSION',
        message: `Permission « ${permKey} » requise pour cette opération financière.`
      });
    }

    if (options?.requireStepUpMfa) {
      const mfaCheck = verifyStepUpMfaForRequest(req, authCtx, true);
      if (!mfaCheck.ok) {
        return res.status(mfaCheck.status).json({
          success: false,
          error: mfaCheck.error,
          message: mfaCheck.message || 'Validation MFA renforcée requise pour cette opération financière.'
        });
      }
    }

    (req as Request & { refundAuthCtx: AuthenticatedRequestContext }).refundAuthCtx = authCtx;
    next();
  };
}

export function installRefundsRoutes(app: Express) {
  // 1. Overview (KPIs, Providers, Refunds, Compensations, Journal, Notifications, Settings, Permissions)
  app.get('/api/refunds/overview', requireRefundPermission('viewRefunds'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { refundAuthCtx: AuthenticatedRequestContext }).refundAuthCtx;
    const actor = authCtx.staff!;
    const perms = getEffectivePermissions(actor.id, actor.role);

    syncFromOrdersAndDisputes();

    const payload: RefundOverviewResponse = {
      success: true,
      generatedAt: new Date().toISOString(),
      actor: {
        staffId: actor.id,
        name: actor.name,
        role: actor.role,
        permissions: perms
      },
      kpis: computeDashboardKpis(),
      providers: getProviderStatuses(),
      refunds: refundsDb.refunds,
      compensations: refundsDb.compensations,
      journal: perms.viewImmutableFinancialJournal ? refundsDb.journal : [],
      notifications: refundsDb.notifications,
      settings: refundsDb.settings,
      staffPermissions: buildStaffPermissionsRows()
    };

    res.json(payload);
  });

  // 2. Sync real orders & disputes into Refunds module
  app.post('/api/refunds/sync', requireRefundPermission('viewRefunds'), (req: Request, res: Response) => {
    const { orders = [], sellers = [] } = req.body || {};
    const result = syncFromOrdersAndDisputes({ orders, sellers });
    res.json({ success: true, ...result });
  });

  // 3. Create a new Refund Request (Full, Partial, Cancellation, Dispute, Exceptional)
  app.post('/api/refunds', requireRefundPermission('createRefundOrCompRequest'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { refundAuthCtx: AuthenticatedRequestContext }).refundAuthCtx;
    const actor = authCtx.staff!;
    const idempotencyKey = String(req.headers['x-idempotency-key'] || '').trim();

    if (idempotencyKey && refundsDb.processedIdempotencyKeys[idempotencyKey]) {
      const existing = refundsDb.refunds.find(
        (r) => r.id === refundsDb.processedIdempotencyKeys[idempotencyKey].resourceId
      );
      if (existing) {
        return res.json({ success: true, idempotentDuplicate: true, refund: existing });
      }
    }

    const body = req.body || {};
    const refundType = (body.refundType || 'complet') as RefundType;
    if (!refundsDb.settings.enabledRefundTypes[refundType]) {
      return res.status(400).json({
        success: false,
        error: 'REFUND_TYPE_DISABLED',
        message: `Le type de remboursement « ${refundType} » est désactivé dans les paramètres administratifs.`
      });
    }

    const orderNumber = String(body.orderNumber || '').trim();
    if (!orderNumber) {
      return res.status(400).json({ success: false, error: 'ORDER_REQUIRED', message: 'Référence commande obligatoire.' });
    }

    const reasonCategory = String(body.reasonCategory || '').trim() || refundType;
    const reasonDetail = String(body.reasonDetail || '').trim();
    if (!reasonDetail || reasonDetail.length < 4) {
      return res.status(400).json({ success: false, error: 'REASON_REQUIRED', message: 'Motif détaillé obligatoire (min. 4 caractères).' });
    }

    const order = body.order || null;
    const deliveryFeeFcfa = Math.max(0, Number(body.deliveryFeeFcfa ?? order?.deliveryFee ?? 0));
    const discountFcfa = Math.max(0, Number(body.discountFcfa ?? order?.discount ?? 0));
    const rawItems: RefundOrderItemBreakdown[] = Array.isArray(body.items) && body.items.length > 0
      ? body.items.map((it: any, idx: number) => {
          const orderedQty = Math.max(1, Number(it.orderedQuantity || 1));
          const refundQty = Math.max(0, Math.min(orderedQty, Number(it.refundQuantity ?? orderedQty)));
          const unitPrice = Math.max(0, Number(it.unitPriceFcfa || 0));
          const selected = it.selectedForRefund !== false && refundQty > 0;
          return {
            productId: String(it.productId || `item-${idx + 1}`),
            productTitle: String(it.productTitle || 'Article DJASSA'),
            productImage: it.productImage,
            orderedQuantity: orderedQty,
            refundQuantity: refundQty,
            unitPriceFcfa: unitPrice,
            lineTotalFcfa: unitPrice * orderedQty,
            refundableLineFcfa: selected ? unitPrice * refundQty : 0,
            selectedForRefund: selected,
            sellerId: it.sellerId,
            sellerName: it.sellerName
          };
        })
      : buildOrderItemsFromAnyOrder(
          order || {
            orderNumber,
            subtotal: Math.max(0, Number(body.initialPaidFcfa || 0) - deliveryFeeFcfa + discountFcfa)
          }
        );
    const initialPaidFcfa = Math.max(
      0,
      Number(body.initialPaidFcfa ?? order?.total ?? rawItems.reduce((s, i) => s + i.lineTotalFcfa, 0) + deliveryFeeFcfa - discountFcfa)
    );

    if (initialPaidFcfa <= 0) {
      return res.status(400).json({
        success: false,
        error: 'NO_PAID_AMOUNT',
        message: 'Le montant initial payé doit être supérieur à 0 FCFA.'
      });
    }

    // Strict duplicate check before creation
    const activeForOrder = refundsDb.refunds.filter(
      (r) => r.orderNumber === orderNumber && r.status !== 'refusee' && r.status !== 'annulee'
    );
    const totalAlreadyRequestedOnOrder = activeForOrder.reduce((s, r) => s + r.financial.requestedAmountFcfa, 0);

    const customAdjustedAmountFcfa =
      typeof body.customAdjustedAmountFcfa === 'number' && body.customAdjustedAmountFcfa > 0
        ? Math.round(body.customAdjustedAmountFcfa)
        : undefined;

    const financial = computeFinancialBreakdown({
      items: rawItems,
      deliveryFeeFcfa,
      discountFcfa,
      initialPaidFcfa,
      disputedAmountFcfa: Number(body.disputedAmountFcfa || 0) || undefined,
      requestedAmountFcfa: Number(body.requestedAmountFcfa || 0) || undefined,
      customAdjustedAmountFcfa,
      refundType,
      hasDriver: Boolean(body.driver || order?.driver)
    });

    if (financial.requestedAmountFcfa <= 0) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_AMOUNT',
        message: 'Le montant calculé à rembourser doit être supérieur à 0 FCFA.'
      });
    }

    if (
      refundsDb.settings.eligibilityRules.blockDuplicateRefundsStrictly &&
      totalAlreadyRequestedOnOrder + financial.requestedAmountFcfa > initialPaidFcfa
    ) {
      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'payments',
        actionType: 'refund_duplicate_blocked',
        action: `Tentative de double remboursement bloquée (#${orderNumber})`,
        target: orderNumber,
        targetType: 'finance',
        result: 'bloque',
        severity: 'critique',
        details: `Cumul demandé (${totalAlreadyRequestedOnOrder + financial.requestedAmountFcfa} FCFA) > initial payé (${initialPaidFcfa} FCFA).`
      });
      return res.status(409).json({
        success: false,
        error: 'DUPLICATE_REFUND_BLOCKED',
        message: `Blocage anti-doublon : ${totalAlreadyRequestedOnOrder.toLocaleString('fr-FR')} FCFA déjà en cours/remboursé sur #${orderNumber} (sur ${initialPaidFcfa.toLocaleString('fr-FR')} FCFA payés).`
      });
    }

    const nowIso = new Date().toISOString();
    const targetChannel = normalizeChannel(body.targetChannel || order?.paymentMethod);
    const clientName = String(body.clientName || order?.deliveryAddress?.recipientName || 'Client DJASSA').trim();
    const clientPhone = String(body.clientPhone || order?.deliveryAddress?.phone || '+225 07 00 00 00 00').trim();
    const payoutAccount = String(body.beneficiaryPayoutAccount || clientPhone).trim();
    const needsDual = financial.requestedAmountFcfa > refundsDb.settings.dualValidationThresholdFcfa;

    const clientActor: RefundActorInfo = {
      accountId: String(body.clientId || `client-${order?.id || orderNumber}`),
      roleType: 'client',
      name: clientName,
      avatar: body.clientAvatar || order?.clientAvatar,
      phoneMasked: maskContact(clientPhone),
      phoneFull: clientPhone,
      commune: body.clientCommune || order?.deliveryAddress?.commune,
      accountStatus: 'active',
      payoutTargetMasked: maskContact(payoutAccount),
      titularityVerified: Boolean(body.beneficiaryTitularityChecked ?? true)
    };

    const sellerInfo = body.seller || (rawItems[0]?.sellerId ? { accountId: rawItems[0].sellerId, name: rawItems[0].sellerName } : null);
    const sellerActor: RefundActorInfo | undefined = sellerInfo
      ? {
          accountId: String(sellerInfo.accountId || sellerInfo.id || 'seller-1'),
          roleType: 'seller',
          name: String(sellerInfo.name || 'Boutique vendeur'),
          avatar: sellerInfo.avatar || order?.sellerAvatar,
          phoneMasked: sellerInfo.phone ? maskContact(sellerInfo.phone) : undefined,
          commune: sellerInfo.commune || sellerInfo.location,
          accountStatus: 'active'
        }
      : undefined;

    const driverActor: RefundActorInfo | undefined = undefined;
    const companyActor: RefundActorInfo | undefined = undefined;

    const initialEvidence: RefundEvidenceItem[] = Array.isArray(body.evidence)
      ? body.evidence.map((ev: any) => ({
          id: `rev-${crypto.randomUUID().slice(0, 8)}`,
          title: String(ev.title || 'Justificatif demande'),
          kind: ev.kind || 'document',
          urlOrData: ev.urlOrData,
          sha256: sha256Of(String(ev.urlOrData || ev.title || nowIso)),
          addedAt: nowIso,
          addedById: actor.id,
          addedByName: actor.name,
          immutable: true
        }))
      : [];

    const rec: RefundRecord = {
      id: `rbt-${crypto.randomUUID().slice(0, 10)}`,
      code: makeCode('RBT'),
      idempotencyKey: idempotencyKey || undefined,
      origin: (body.origin || 'initiative_admin') as RefundOriginType,
      linkedDisputeId: body.linkedDisputeId,
      linkedDisputeCode: body.linkedDisputeCode,
      orderId: order?.id || body.orderId,
      orderNumber,
      initialTransactionRef: String(body.initialTransactionRef || `PAY-${orderNumber}`).trim(),
      initialPaymentMethod: String(body.initialPaymentMethod || order?.paymentMethod || 'Wave'),
      refundType,
      reasonCategory,
      reasonDetail: redactSensitiveText(reasonDetail),
      status: 'nouvelle_demande',
      createdAt: nowIso,
      updatedAt: nowIso,
      dueAt: new Date(Date.now() + refundsDb.settings.slaProcessingHours * 3_600_000).toISOString(),
      completedAt: null,
      archived: false,
      assignedAgentId: actor.id,
      assignedAgentName: actor.name,
      requiresSuperAdminValidation: needsDual,
      targetChannel,
      beneficiaryPayoutAccount: maskContact(payoutAccount) || clientName,
      beneficiaryTitularityChecked: Boolean(body.beneficiaryTitularityChecked ?? true),
      actors: {
        client: clientActor,
        seller: sellerActor,
        driver: driverActor,
        company: companyActor,
        agent: {
          accountId: actor.id,
          roleType: 'admin',
          name: actor.name,
          emailMasked: maskContact(actor.email),
          accountStatus: 'active'
        }
      },
      items: rawItems,
      financial,
      evidence: initialEvidence,
      steps: buildInitialWorkflowSteps({
        createdAt: nowIso,
        actorName: actor.name,
        requiresSuperAdminValidation: needsDual,
        verified: false
      }),
      decisions: [
        {
          id: `dec-${crypto.randomUUID().slice(0, 8)}`,
          at: nowIso,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          action: 'Création de la demande de remboursement',
          toStatus: 'nouvelle_demande',
          note: `${refundType.toUpperCase()} • ${financial.requestedAmountFcfa.toLocaleString('fr-FR')} FCFA (${reasonDetail})`
        }
      ],
      providerAttempts: [],
      suspiciousSignals: []
    };

    rec.suspiciousSignals = evaluateSuspiciousSignals(rec);
    refundsDb.refunds.unshift(rec);
    if (idempotencyKey) {
      refundsDb.processedIdempotencyKeys[idempotencyKey] = { at: nowIso, resourceId: rec.id };
    }

    pushRefundNotification({
      entityType: 'refund',
      entityId: rec.id,
      entityCode: rec.code,
      eventType: 'request_created',
      recipientRole: 'client',
      recipientName: clientName,
      title: `Demande de remboursement enregistrée (${rec.code})`,
      body: `Dossier créé sur commande #${orderNumber} pour ${financial.requestedAmountFcfa.toLocaleString('fr-FR')} FCFA.`
    });

    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'payments',
      actionType: 'refund_request_created',
      action: `Création dossier remboursement ${rec.code}`,
      target: `#${orderNumber} • ${clientName}`,
      targetType: 'finance',
      result: 'reussi',
      severity: rec.suspiciousSignals.length > 0 ? 'eleve' : 'moyen',
      details: `${refundType} — ${financial.requestedAmountFcfa.toLocaleString('fr-FR')} FCFA via ${targetChannel}`
    });

    persistRefundsDb();
    res.json({ success: true, refund: rec });
  });

  // 4. Verify transaction, titularity, evidence (Steps 2 & 3)
  app.post('/api/refunds/:id/verify', requireRefundPermission('verifyAndRequestEvidence'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { refundAuthCtx: AuthenticatedRequestContext }).refundAuthCtx;
    const actor = authCtx.staff!;
    const rec = refundsDb.refunds.find((r) => r.id === req.params.id);
    if (!rec) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });

    const {
      verifyTransaction = true,
      verifyTitularity = true,
      evidenceTitle,
      evidenceUrl,
      note = 'Vérification commande, transaction et titularité effectuée.'
    } = req.body || {};

    const nowIso = new Date().toISOString();
    if (verifyTitularity) {
      rec.beneficiaryTitularityChecked = true;
      rec.actors.client.titularityVerified = true;
    }
    if (evidenceTitle && String(evidenceTitle).trim()) {
      rec.evidence.push({
        id: `rev-${crypto.randomUUID().slice(0, 8)}`,
        title: String(evidenceTitle).trim(),
        kind: 'receipt',
        urlOrData: evidenceUrl ? String(evidenceUrl).trim() : undefined,
        sha256: sha256Of(`${evidenceTitle}:${evidenceUrl || nowIso}`),
        addedAt: nowIso,
        addedById: actor.id,
        addedByName: actor.name,
        immutable: true
      });
    }

    const prevStatus = rec.status;
    if (rec.status === 'nouvelle_demande' || rec.status === 'en_attente_validation') {
      rec.status = 'en_verification';
    }
    if (verifyTransaction) markStep(rec.steps, 2, 'done', actor.name, 'Transaction initiale vérifiée');
    if (rec.evidence.length > 0 || !refundsDb.settings.eligibilityRules.requireProofOverFcfa || rec.financial.requestedAmountFcfa <= refundsDb.settings.eligibilityRules.requireProofOverFcfa) {
      markStep(rec.steps, 3, 'done', actor.name, 'Justificatifs vérifiés');
    }
    rec.updatedAt = nowIso;
    rec.decisions.unshift({
      id: `dec-${crypto.randomUUID().slice(0, 8)}`,
      at: nowIso,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'Vérification dossier & pièces',
      fromStatus: prevStatus,
      toStatus: rec.status,
      note: redactSensitiveText(note)
    });
    rec.suspiciousSignals = evaluateSuspiciousSignals(rec);
    persistRefundsDb();

    res.json({ success: true, refund: rec });
  });

  // 5. Request justifications (notifies recipient)
  app.post('/api/refunds/:id/request-evidence', requireRefundPermission('verifyAndRequestEvidence'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { refundAuthCtx: AuthenticatedRequestContext }).refundAuthCtx;
    const actor = authCtx.staff!;
    const rec = refundsDb.refunds.find((r) => r.id === req.params.id);
    if (!rec) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });

    const { message = 'Veuillez fournir le reçu ou la photo du colis pour poursuivre le traitement.', targetRole = 'client' } = req.body || {};
    const nowIso = new Date().toISOString();
    const prevStatus = rec.status;
    rec.status = 'en_verification';
    rec.updatedAt = nowIso;
    rec.decisions.unshift({
      id: `dec-${crypto.randomUUID().slice(0, 8)}`,
      at: nowIso,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: `Demande de justificatifs (${targetRole})`,
      fromStatus: prevStatus,
      toStatus: rec.status,
      note: redactSensitiveText(message)
    });

    const targetActorName =
      targetRole === 'seller'
        ? rec.actors.seller?.name || 'Vendeur'
        : targetRole === 'driver'
        ? rec.actors.driver?.name || 'Livreur'
        : rec.actors.client.name;

    pushRefundNotification({
      entityType: 'refund',
      entityId: rec.id,
      entityCode: rec.code,
      eventType: 'evidence_requested',
      recipientRole: targetRole,
      recipientName: targetActorName,
      title: `Justificatifs requis — ${rec.code}`,
      body: message
    });
    persistRefundsDb();
    res.json({ success: true, refund: rec });
  });

  // 6. Put on hold
  app.post('/api/refunds/:id/hold', requireRefundPermission('verifyAndRequestEvidence'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { refundAuthCtx: AuthenticatedRequestContext }).refundAuthCtx;
    const actor = authCtx.staff!;
    const rec = refundsDb.refunds.find((r) => r.id === req.params.id);
    if (!rec) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });

    const { note = 'Dossier mis en attente pour vérification complémentaire.' } = req.body || {};
    const nowIso = new Date().toISOString();
    const prevStatus = rec.status;
    rec.status = 'en_attente_validation';
    rec.updatedAt = nowIso;
    rec.decisions.unshift({
      id: `dec-${crypto.randomUUID().slice(0, 8)}`,
      at: nowIso,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'Mise en attente du dossier',
      fromStatus: prevStatus,
      toStatus: rec.status,
      note: redactSensitiveText(note)
    });
    persistRefundsDb();
    res.json({ success: true, refund: rec });
  });

  // 7. Standard Agent Approval (Step 5)
  app.post(
    '/api/refunds/:id/approve',
    requireRefundPermission('approveRefundStandard', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { refundAuthCtx: AuthenticatedRequestContext }).refundAuthCtx;
      const actor = authCtx.staff!;
      const rec = refundsDb.refunds.find((r) => r.id === req.params.id);
      if (!rec) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });

      if (rec.status === 'effectuee' || rec.status === 'refusee' || rec.status === 'annulee') {
        return res.status(400).json({ success: false, error: 'INVALID_STATE', message: 'Ce dossier ne peut plus être approuvé.' });
      }

      if (
        refundsDb.settings.eligibilityRules.requireProofOverFcfa > 0 &&
        rec.financial.requestedAmountFcfa > refundsDb.settings.eligibilityRules.requireProofOverFcfa &&
        rec.evidence.length === 0
      ) {
        return res.status(400).json({
          success: false,
          error: 'PROOF_REQUIRED',
          message: `Un justificatif est obligatoire pour tout remboursement supérieur à ${refundsDb.settings.eligibilityRules.requireProofOverFcfa.toLocaleString('fr-FR')} FCFA.`
        });
      }

      const { note = 'Approuvé par agent habilité après vérification des règles DJASSA.' } = req.body || {};
      const nowIso = new Date().toISOString();
      const prevStatus = rec.status;

      rec.validatedByAgentId = actor.id;
      rec.validatedByAgentName = actor.name;
      rec.validatedByAgentAt = nowIso;
      markStep(rec.steps, 2, 'done', actor.name);
      markStep(rec.steps, 3, 'done', actor.name);
      markStep(rec.steps, 5, 'done', actor.name, note);

      if (rec.requiresSuperAdminValidation && !rec.superAdminValidatedById) {
        rec.status = 'en_attente_validation';
      } else {
        rec.status = 'approuvee';
      }

      rec.updatedAt = nowIso;
      rec.decisions.unshift({
        id: `dec-${crypto.randomUUID().slice(0, 8)}`,
        at: nowIso,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: rec.requiresSuperAdminValidation
          ? 'Validation Agent (attente double validation Super Admin)'
          : 'Approbation du remboursement',
        fromStatus: prevStatus,
        toStatus: rec.status,
        note: redactSensitiveText(note)
      });

      appendJournalEntry({
        entryType: 'operation_approved',
        entityType: 'refund',
        entityId: rec.id,
        entityCode: rec.code,
        orderNumber: rec.orderNumber,
        beneficiaryName: rec.actors.client.name,
        beneficiaryRole: 'client',
        amountFcfa: rec.financial.remainingToRefundFcfa,
        commissionDeltaFcfa: 0,
        channel: rec.targetChannel,
        providerReference: `APR-${rec.code}`,
        actorId: actor.id,
        actorName: actor.name,
        note: rec.requiresSuperAdminValidation ? 'Validation Niveau 1 (Agent)' : 'Approbation finale prête pour exécution'
      });

      pushRefundNotification({
        entityType: 'refund',
        entityId: rec.id,
        entityCode: rec.code,
        eventType: 'approved',
        recipientRole: 'client',
        recipientName: rec.actors.client.name,
        title: `Remboursement approuvé (${rec.code})`,
        body: rec.requiresSuperAdminValidation
          ? `Votre remboursement de ${rec.financial.requestedAmountFcfa.toLocaleString('fr-FR')} FCFA a reçu la validation agent et passe en validation Super Admin.`
          : `Votre remboursement de ${rec.financial.requestedAmountFcfa.toLocaleString('fr-FR')} FCFA est approuvé et prêt pour versement.`
      });

      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'payments',
        actionType: 'refund_approved_agent',
        action: `Validation agent remboursement ${rec.code}`,
        target: `${rec.orderNumber} (${rec.financial.requestedAmountFcfa} FCFA)`,
        targetType: 'finance',
        result: 'reussi',
        severity: 'eleve',
        details: note
      });

      persistRefundsDb();
      res.json({ success: true, refund: rec });
    }
  );

  // 8. Super Admin Double Validation (Step 6)
  app.post(
    '/api/refunds/:id/super-validate',
    requireRefundPermission('superAdminFinalValidate', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { refundAuthCtx: AuthenticatedRequestContext }).refundAuthCtx;
      const actor = authCtx.staff!;
      const rec = refundsDb.refunds.find((r) => r.id === req.params.id);
      if (!rec) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });

      const activeSuperControllers = getSecurityStaffDirectory().filter(
        (s) => s.active && getEffectivePermissions(s.id, s.role).superAdminFinalValidate
      );
      if (rec.validatedByAgentId === actor.id && activeSuperControllers.length > 1) {
        return res.status(403).json({
          success: false,
          error: 'FOUR_EYES_VIOLATION',
          message: 'Double validation stricte : un second responsable habilité différent du premier validateur doit confirmer.'
        });
      }

      const { note = 'Double validation Super Administrateur confirmée.' } = req.body || {};
      const nowIso = new Date().toISOString();
      const prevStatus = rec.status;
      rec.superAdminValidatedById = actor.id;
      rec.superAdminValidatedByName = actor.name;
      rec.superAdminValidatedAt = nowIso;
      rec.status = 'approuvee';
      markStep(rec.steps, 5, 'done', rec.validatedByAgentName || actor.name);
      markStep(rec.steps, 6, 'done', actor.name, note);
      rec.updatedAt = nowIso;
      rec.decisions.unshift({
        id: `dec-${crypto.randomUUID().slice(0, 8)}`,
        at: nowIso,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'Double validation Super Administrateur',
        fromStatus: prevStatus,
        toStatus: 'approuvee',
        note: redactSensitiveText(note)
      });

      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'payments',
        actionType: 'refund_super_validated',
        action: `Double validation Super Admin ${rec.code}`,
        target: `${rec.orderNumber} (${rec.financial.requestedAmountFcfa} FCFA)`,
        targetType: 'finance',
        result: 'reussi',
        severity: 'eleve',
        details: note
      });

      persistRefundsDb();
      res.json({ success: true, refund: rec });
    }
  );

  // 9. Reject with mandatory reason
  app.post(
    '/api/refunds/:id/reject',
    requireRefundPermission('approveRefundStandard', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { refundAuthCtx: AuthenticatedRequestContext }).refundAuthCtx;
      const actor = authCtx.staff!;
      const rec = refundsDb.refunds.find((r) => r.id === req.params.id);
      if (!rec) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });

      if (rec.status === 'effectuee') {
        return res.status(400).json({ success: false, error: 'ALREADY_EXECUTED', message: 'Impossible de refuser un remboursement déjà exécuté.' });
      }

      const reason = String(req.body?.reason || '').trim();
      if (reason.length < 5) {
        return res.status(400).json({ success: false, error: 'REASON_REQUIRED', message: 'Un motif de refus motivé (min. 5 caractères) est obligatoire.' });
      }

      const nowIso = new Date().toISOString();
      const prevStatus = rec.status;
      rec.status = 'refusee';
      rec.rejectionReason = redactSensitiveText(reason);
      rec.updatedAt = nowIso;
      rec.decisions.unshift({
        id: `dec-${crypto.randomUUID().slice(0, 8)}`,
        at: nowIso,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'Refus du remboursement',
        fromStatus: prevStatus,
        toStatus: 'refusee',
        note: rec.rejectionReason
      });

      appendJournalEntry({
        entryType: 'operation_rejected',
        entityType: 'refund',
        entityId: rec.id,
        entityCode: rec.code,
        orderNumber: rec.orderNumber,
        beneficiaryName: rec.actors.client.name,
        beneficiaryRole: 'client',
        amountFcfa: 0,
        commissionDeltaFcfa: 0,
        channel: rec.targetChannel,
        providerReference: `REJ-${rec.code}`,
        actorId: actor.id,
        actorName: actor.name,
        note: rec.rejectionReason
      });

      pushRefundNotification({
        entityType: 'refund',
        entityId: rec.id,
        entityCode: rec.code,
        eventType: 'rejected',
        recipientRole: 'client',
        recipientName: rec.actors.client.name,
        title: `Demande refusée (${rec.code})`,
        body: `Motif : ${rec.rejectionReason}`
      });

      persistRefundsDb();
      res.json({ success: true, refund: rec });
    }
  );

  // 10. Cancel before execution
  app.post('/api/refunds/:id/cancel', requireRefundPermission('cancelOrRetryOperation'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { refundAuthCtx: AuthenticatedRequestContext }).refundAuthCtx;
    const actor = authCtx.staff!;
    const rec = refundsDb.refunds.find((r) => r.id === req.params.id);
    if (!rec) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });

    if (rec.status === 'effectuee' || rec.status === 'partiellement_effectuee') {
      return res.status(400).json({ success: false, error: 'CANNOT_CANCEL_EXECUTED', message: 'Impossible d’annuler un remboursement déjà versé.' });
    }

    const reason = String(req.body?.reason || 'Annulé avant exécution par l’administration').trim();
    const nowIso = new Date().toISOString();
    const prevStatus = rec.status;
    rec.status = 'annulee';
    rec.cancellationReason = redactSensitiveText(reason);
    rec.updatedAt = nowIso;
    rec.decisions.unshift({
      id: `dec-${crypto.randomUUID().slice(0, 8)}`,
      at: nowIso,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'Annulation avant exécution',
      fromStatus: prevStatus,
      toStatus: 'annulee',
      note: rec.cancellationReason
    });

    appendJournalEntry({
      entryType: 'operation_cancelled',
      entityType: 'refund',
      entityId: rec.id,
      entityCode: rec.code,
      orderNumber: rec.orderNumber,
      beneficiaryName: rec.actors.client.name,
      beneficiaryRole: 'client',
      amountFcfa: 0,
      commissionDeltaFcfa: 0,
      channel: rec.targetChannel,
      providerReference: `CAN-${rec.code}`,
      actorId: actor.id,
      actorName: actor.name,
      note: rec.cancellationReason
    });

    persistRefundsDb();
    res.json({ success: true, refund: rec });
  });

  // 11. Execute via Payment Provider or Internal Ledger (Steps 7, 8, 9 + Commission adjustments)
  app.post(
    '/api/refunds/:id/execute',
    requireRefundPermission('executeProviderTransfer', { requireStepUpMfa: true }),
    async (req: Request, res: Response) => {
      const authCtx = (req as Request & { refundAuthCtx: AuthenticatedRequestContext }).refundAuthCtx;
      const actor = authCtx.staff!;
      const rec = refundsDb.refunds.find((r) => r.id === req.params.id);
      if (!rec) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });

      if (rec.status === 'effectuee') {
        return res.status(409).json({
          success: false,
          error: 'ALREADY_REFUNDED',
          message: 'Blocage anti-doublon : ce remboursement a déjà été intégralement exécuté.'
        });
      }

      if (rec.requiresSuperAdminValidation && !rec.superAdminValidatedById) {
        return res.status(403).json({
          success: false,
          error: 'SUPER_ADMIN_VALIDATION_REQUIRED',
          message: `Montant > ${refundsDb.settings.dualValidationThresholdFcfa.toLocaleString('fr-FR')} FCFA : validation Super Administrateur requise avant exécution.`
        });
      }

      if (rec.status !== 'approuvee' && rec.status !== 'echouee') {
        return res.status(400).json({
          success: false,
          error: 'APPROVAL_REQUIRED',
          message: 'Le dossier doit être approuvé avant l’exécution du paiement.'
        });
      }

      if (refundsDb.settings.eligibilityRules.requireTitularityCheckBeforePayout && !rec.beneficiaryTitularityChecked) {
        return res.status(400).json({
          success: false,
          error: 'TITULARITY_NOT_VERIFIED',
          message: 'Vérifiez d’abord la titularité du compte bénéficiaire (étape Vérification).'
        });
      }

      const idempotencyKey = String(req.headers['x-idempotency-key'] || '').trim();
      if (idempotencyKey && refundsDb.processedIdempotencyKeys[idempotencyKey]) {
        return res.json({ success: true, idempotent: true, refund: rec });
      }
      const channel = normalizeChannel(req.body?.channel || rec.targetChannel);
      rec.targetChannel = channel;
      const amountToExecute = Math.min(
        rec.financial.remainingToRefundFcfa,
        Math.max(1, Math.round(Number(req.body?.amountFcfa || rec.financial.remainingToRefundFcfa)))
      );

      if (amountToExecute <= 0) {
        return res.status(400).json({ success: false, error: 'NOTHING_TO_REFUND', message: 'Solde restant à rembourser nul.' });
      }

      const simulateFailure = Boolean(req.body?.simulateFailure);
      const nowIso = new Date().toISOString();
      const attemptNum = rec.providerAttempts.length + 1;
      const providerInfo = getProviderStatuses().find((p) => p.id === channel);

      pushRefundNotification({
        entityType: 'refund',
        entityId: rec.id,
        entityCode: rec.code,
        eventType: 'processing_started',
        recipientRole: 'client',
        recipientName: rec.actors.client.name,
        title: `Traitement de remboursement démarré (${rec.code})`,
        body: `Exécution de ${amountToExecute.toLocaleString('fr-FR')} FCFA via ${providerInfo?.name || channel}.`
      });

      // Simulated or real provider failure
      if (simulateFailure) {
        const failRef = `ERR-${channel.toUpperCase()}-${Date.now().toString().slice(-5)}`;
        rec.status = 'echouee';
        rec.updatedAt = nowIso;
        rec.providerAttempts.unshift({
          id: `att-${crypto.randomUUID().slice(0, 8)}`,
          attemptNumber: attemptNum,
          channel,
          amountFcfa: amountToExecute,
          providerConfigured: Boolean(providerInfo?.configured),
          providerResponseStatus: 'failed_provider_error',
          providerReference: failRef,
          requestedById: actor.id,
          requestedByName: actor.name,
          at: nowIso,
          errorMessage: 'Le prestataire a retourné un refus / expiration temporaire du transfert.'
        });
        markStep(rec.steps, 7, 'blocked', actor.name, `Échec prestataire (${failRef})`);
        rec.decisions.unshift({
          id: `dec-${crypto.randomUUID().slice(0, 8)}`,
          at: nowIso,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          action: 'Échec exécution prestataire',
          fromStatus: 'en_cours_traitement',
          toStatus: 'echouee',
          note: `Réf ${failRef} — Relance possible.`
        });
        appendJournalEntry({
          entryType: 'refund_failed',
          entityType: 'refund',
          entityId: rec.id,
          entityCode: rec.code,
          orderNumber: rec.orderNumber,
          beneficiaryName: rec.actors.client.name,
          beneficiaryRole: 'client',
          amountFcfa: amountToExecute,
          commissionDeltaFcfa: 0,
          channel,
          providerReference: failRef,
          actorId: actor.id,
          actorName: actor.name,
          note: 'Échec signalé par le prestataire'
        });
        pushRefundNotification({
          entityType: 'refund',
          entityId: rec.id,
          entityCode: rec.code,
          eventType: 'operation_failed',
          recipientRole: 'admin',
          recipientName: actor.name,
          title: `Échec remboursement ${rec.code}`,
          body: `Le versement de ${amountToExecute.toLocaleString('fr-FR')} FCFA via ${channel} a échoué (${failRef}).`
        });
        if (rec.linkedDisputeId || rec.linkedDisputeCode) {
          syncRefundConfirmationIntoDispute({
            disputeId: rec.linkedDisputeId,
            disputeCode: rec.linkedDisputeCode,
            amountFcfa: amountToExecute,
            refundReference: failRef,
            actorId: actor.id,
            actorName: actor.name,
            status: 'failed',
            channel
          });
        }
        rec.suspiciousSignals = evaluateSuspiciousSignals(rec);
        persistRefundsDb();
        return res.status(502).json({
          success: false,
          error: 'PROVIDER_FAILED',
          message: `Échec prestataire (${failRef}) : statut passé à « Échouée ». Vous pouvez relancer l’opération.`,
          refund: rec
        });
      }

      // External Mobile Money & Card via GeniusPay when configured (never claim completion until webhook confirms!)
      const gpCfg = getGeniusPayConfig();
      const isGeniusPayChannel =
        channel === 'wave' || channel === 'orange_money' || channel === 'mtn_momo' || channel === 'card';
      if (isGeniusPayChannel && gpCfg.configured) {
        const gpRefundRef = `rfnd-${crypto.randomUUID()}`;
        const depositId = typeof req.body?.depositId === 'string' ? req.body.depositId.trim() : '';
        const recipientPhone = String(req.body?.recipientPhone || rec.beneficiaryPayoutAccount || rec.actors.client.phoneMasked || '').trim();
        const gpRes = depositId
          ? await initiateGeniusPayRefund({
              refundId: gpRefundRef,
              depositId,
              amountFcfa: amountToExecute
            })
          : await initiateGeniusPayPayout({
              payoutId: gpRefundRef,
              amountFcfa: amountToExecute,
              provider: channel,
              recipientPhone,
              statementDescription: `RBT ${rec.code}`.slice(0, 22)
            });

        if (!gpRes.ok && gpRes.status === 'failed') {
          rec.status = 'echouee';
          rec.updatedAt = nowIso;
          rec.providerAttempts.unshift({
            id: `att-${crypto.randomUUID().slice(0, 8)}`,
            attemptNumber: attemptNum,
            channel,
            amountFcfa: amountToExecute,
            providerConfigured: true,
            providerResponseStatus: 'failed_provider_error',
            providerReference: gpRefundRef,
            requestedById: actor.id,
            requestedByName: actor.name,
            at: nowIso,
            errorMessage: gpRes.message || gpRes.error || 'Refus GeniusPay'
          });
          markStep(rec.steps, 7, 'blocked', actor.name, `Échec GeniusPay (${gpRes.error || gpRefundRef})`);
          persistRefundsDb();
          return res.status(502).json({
            success: false,
            error: 'GENIUSPAY_REFUND_REJECTED',
            message: gpRes.message || 'Le remboursement GeniusPay a été rejeté.',
            refund: rec
          });
        }

        if (gpRes.status !== 'confirmed') {
          rec.status = 'en_cours_traitement';
          rec.updatedAt = nowIso;
          rec.providerAttempts.unshift({
            id: `att-${crypto.randomUUID().slice(0, 8)}`,
            attemptNumber: attemptNum,
            channel,
            amountFcfa: amountToExecute,
            providerConfigured: true,
            providerResponseStatus: 'pending_provider_confirmation',
            providerReference: gpRes.refundId || gpRes.payoutId || gpRefundRef,
            requestedById: actor.id,
            requestedByName: actor.name,
            at: nowIso,
            receiptProof: gpRes.ok
              ? `Initiation GeniusPay acceptée (${gpRes.status}) — en attente de webhook`
              : `En attente de confirmation GeniusPay (${gpRes.error || 'pending'})`
          });
          markStep(rec.steps, 7, 'done', actor.name, `Transmis à GeniusPay (${gpRefundRef})`);
          rec.decisions.unshift({
            id: `dec-${crypto.randomUUID().slice(0, 8)}`,
            at: nowIso,
            actorId: actor.id,
            actorName: actor.name,
            actorRole: actor.role,
            action: `Transfert GeniusPay initié (${channel})`,
            fromStatus: 'approuvee',
            toStatus: 'en_cours_traitement',
            note: `Réf ${gpRefundRef} — Confirmation finale attendue par webhook GeniusPay.`
          });
          if (idempotencyKey) {
            refundsDb.processedIdempotencyKeys[idempotencyKey] = { at: nowIso, resourceId: rec.id };
          }
          persistRefundsDb();
          return res.status(202).json({
            success: true,
            awaitingProviderConfirmation: true,
            providerReference: gpRefundRef,
            message: `Transfert GeniusPay initié (${gpRefundRef}). Le statut passera à « Effectuée » dès réception du webhook confirmé.`,
            refund: rec
          });
        }
      }

      // External provider WITHOUT API key: MUST NOT pretend completed!
      if (channel !== 'internal_ledger' && (!providerInfo || !providerInfo.supportsAutomaticRefund)) {
        const pendingRef = `PEND-${channel.toUpperCase()}-${rec.code.slice(-6)}-${attemptNum}`;
        rec.status = 'en_cours_traitement';
        rec.updatedAt = nowIso;
        rec.providerAttempts.unshift({
          id: `att-${crypto.randomUUID().slice(0, 8)}`,
          attemptNumber: attemptNum,
          channel,
          amountFcfa: amountToExecute,
          providerConfigured: false,
          providerResponseStatus: 'pending_provider_confirmation',
          providerReference: pendingRef,
          requestedById: actor.id,
          requestedByName: actor.name,
          at: nowIso,
          receiptProof: `En attente de confirmation réelle ${providerInfo?.name || channel}`
        });
        markStep(rec.steps, 7, 'done', actor.name, `Transmis pour traitement manuel contrôlé (${pendingRef})`);
        rec.decisions.unshift({
          id: `dec-${crypto.randomUUID().slice(0, 8)}`,
          at: nowIso,
          actorId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          action: `Mise en traitement (${providerInfo?.name || channel})`,
          fromStatus: 'approuvee',
          toStatus: 'en_cours_traitement',
          note: `API ${channel} non connectée en direct : confirmation de reçu prestataire requise avant marquage « Effectuée ».`
        });
        persistRefundsDb();
        return res.json({
          success: true,
          awaitingProviderConfirmation: true,
          message: `Dossier passé « En cours de traitement » (${pendingRef}). Fournissez la référence du reçu ${providerInfo?.name || channel} pour confirmer définitivement.`,
          refund: rec
        });
      }

      // Configured automatic provider (confirmed synchronously) OR internal_ledger -> execute atomically on server ledger!
      const execRef = `${channel === 'internal_ledger' ? 'RBT-LED' : `RBT-${channel.toUpperCase()}`}-${rec.code.slice(-6)}-${attemptNum}`;
      const ledgerRes = recordVerifiedFinancialOperationInSecurityLedger({
        reference: execRef,
        accountId: rec.actors.client.accountId,
        accountName: rec.actors.client.name,
        accountEmail: rec.actors.client.emailFull || rec.actors.client.emailMasked,
        spaceRole: 'client',
        type: 'credit',
        amountFcfa: amountToExecute,
        channel: providerInfo?.name || channel,
        payoutTargetMasked: rec.beneficiaryPayoutAccount,
        actorName: actor.name,
        note: `Remboursement ${rec.code} (Commande #${rec.orderNumber})`
      });

      rec.financial.alreadyRefundedFcfa += amountToExecute;
      rec.financial.remainingToRefundFcfa = Math.max(0, rec.financial.requestedAmountFcfa - rec.financial.alreadyRefundedFcfa);
      const isFullDone = rec.financial.remainingToRefundFcfa === 0 && rec.financial.alreadyRefundedFcfa >= rec.financial.authorizedMaxRefundFcfa;
      rec.status = isFullDone ? 'effectuee' : 'partiellement_effectuee';
      rec.completedAt = nowIso;
      rec.updatedAt = nowIso;

      // Commissions adjustment (with anti-double-reversal guard)
      let commissionReversedTotal = 0;
      if (!rec.financial.commissions.commissionAlreadyReversedOnce || !refundsDb.settings.commissionRules.preventDoubleCommissionReversal) {
        const revSeller =
          refundsDb.settings.commissionRules.reverseSellerCommissionOnFullRefund && isFullDone
            ? rec.financial.commissions.sellerCommissionChargedFcfa
            : 0;
        const revDriver = 0;
        const revService =
          refundsDb.settings.commissionRules.reversePlatformServiceFeeOnFullRefund && isFullDone
            ? rec.financial.commissions.platformServiceFeeFcfa
            : 0;
        commissionReversedTotal = revSeller + revService;
        if (commissionReversedTotal > 0) {
          const commRef = `COM-${rec.code.slice(-6)}-${attemptNum}`;
          rec.financial.commissions.sellerCommissionReversedFcfa = revSeller;
          rec.financial.commissions.driverCommissionReversedFcfa = 0;
          rec.financial.commissions.serviceFeeReversedFcfa = revService;
          rec.financial.commissions.commissionAlreadyReversedOnce = true;
          rec.financial.commissions.lastCommissionAdjustmentAt = nowIso;
          rec.financial.commissions.commissionAdjustmentRef = commRef;

          appendJournalEntry({
            entryType: 'commission_reversed',
            entityType: 'commission',
            entityId: rec.id,
            entityCode: rec.code,
            orderNumber: rec.orderNumber,
            beneficiaryName: 'Plateforme DJASSA (Ajustement Commission)',
            beneficiaryRole: 'seller',
            amountFcfa: 0,
            commissionDeltaFcfa: -commissionReversedTotal,
            channel: 'internal_ledger',
            providerReference: commRef,
            actorId: actor.id,
            actorName: actor.name,
            note: `Reprise commissions (Commission DJASSA: ${revSeller} F, Frais client: ${revService} F)`
          });
        }
      }

      rec.providerAttempts.unshift({
        id: `att-${crypto.randomUUID().slice(0, 8)}`,
        attemptNumber: attemptNum,
        channel,
        amountFcfa: amountToExecute,
        providerConfigured: true,
        providerResponseStatus: channel === 'internal_ledger' ? 'confirmed_internal_ledger' : 'confirmed_external_provider',
        providerReference: execRef,
        requestedById: actor.id,
        requestedByName: actor.name,
        at: nowIso,
        confirmedAt: nowIso,
        receiptProof: `Écriture immuable #${ledgerRes.entryId}`
      });

      markStep(rec.steps, 7, 'done', actor.name, `Exécuté via ${providerInfo?.name || channel}`);
      markStep(rec.steps, 8, 'done', actor.name, `Confirmé (${execRef})`);
      markStep(rec.steps, 9, 'done', 'Système DJASSA', 'Notification transmise au client');

      rec.decisions.unshift({
        id: `dec-${crypto.randomUUID().slice(0, 8)}`,
        at: nowIso,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: `Remboursement exécuté (${amountToExecute.toLocaleString('fr-FR')} FCFA)`,
        fromStatus: 'approuvee',
        toStatus: rec.status,
        note: `Réf ${execRef} • Registre ${ledgerRes.entryId}`
      });

      appendJournalEntry({
        entryType: rec.status === 'effectuee' ? 'refund_executed' : 'refund_partial_executed',
        entityType: 'refund',
        entityId: rec.id,
        entityCode: rec.code,
        orderNumber: rec.orderNumber,
        beneficiaryName: rec.actors.client.name,
        beneficiaryRole: 'client',
        amountFcfa: amountToExecute,
        commissionDeltaFcfa: -commissionReversedTotal,
        channel,
        providerReference: execRef,
        actorId: actor.id,
        actorName: actor.name,
        note: `Remboursement ${rec.status} sur commande #${rec.orderNumber}`
      });

      pushRefundNotification({
        entityType: 'refund',
        entityId: rec.id,
        entityCode: rec.code,
        eventType: 'refund_confirmed',
        recipientRole: 'client',
        recipientName: rec.actors.client.name,
        title: `Remboursement confirmé (${amountToExecute.toLocaleString('fr-FR')} FCFA)`,
        body: `Réf ${execRef} • Commande #${rec.orderNumber}.`
      });

      if (rec.linkedDisputeId || rec.linkedDisputeCode) {
        syncRefundConfirmationIntoDispute({
          disputeId: rec.linkedDisputeId,
          disputeCode: rec.linkedDisputeCode,
          amountFcfa: amountToExecute,
          refundReference: execRef,
          actorId: actor.id,
          actorName: actor.name,
          status: 'confirmed',
          channel
        });
      }

      if (idempotencyKey) {
        refundsDb.processedIdempotencyKeys[idempotencyKey] = { at: nowIso, resourceId: rec.id };
      }
      persistRefundsDb();
      res.json({ success: true, refund: rec });
    }
  );

  // 12. Confirm Pending External Provider Refund (with verified external receipt ref)
  app.post(
    '/api/refunds/:id/confirm-provider',
    requireRefundPermission('executeProviderTransfer', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { refundAuthCtx: AuthenticatedRequestContext }).refundAuthCtx;
      const actor = authCtx.staff!;
      const rec = refundsDb.refunds.find((r) => r.id === req.params.id);
      if (!rec) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });

      if (rec.status !== 'en_cours_traitement') {
        return res.status(400).json({ success: false, error: 'NOT_IN_PROGRESS', message: 'Ce dossier n’est pas en attente de confirmation prestataire.' });
      }

      const providerReference = String(req.body?.providerReference || '').trim();
      if (providerReference.length < 4) {
        return res.status(400).json({ success: false, error: 'RECEIPT_REF_REQUIRED', message: 'Référence prestataire vérifiée obligatoire (min. 4 caractères).' });
      }

      const nowIso = new Date().toISOString();
      const pendingAttempt = rec.providerAttempts.find((a) => a.providerResponseStatus === 'pending_provider_confirmation');
      const amount = pendingAttempt?.amountFcfa || rec.financial.remainingToRefundFcfa;

      recordVerifiedFinancialOperationInSecurityLedger({
        reference: providerReference,
        accountId: rec.actors.client.accountId,
        accountName: rec.actors.client.name,
        spaceRole: 'client',
        type: 'credit',
        amountFcfa: amount,
        channel: rec.targetChannel,
        payoutTargetMasked: rec.beneficiaryPayoutAccount,
        actorName: actor.name,
        note: `Confirmation manuelle contrôlée ${rec.targetChannel} (${rec.code})`
      });

      if (pendingAttempt) {
        pendingAttempt.providerResponseStatus = 'confirmed_external_provider';
        pendingAttempt.providerReference = providerReference;
        pendingAttempt.confirmedAt = nowIso;
        pendingAttempt.receiptProof = String(req.body?.proofNote || `Reçu vérifié : ${providerReference}`);
      }

      rec.financial.alreadyRefundedFcfa += amount;
      rec.financial.remainingToRefundFcfa = Math.max(0, rec.financial.requestedAmountFcfa - rec.financial.alreadyRefundedFcfa);
      rec.status =
        rec.financial.remainingToRefundFcfa === 0 && rec.financial.alreadyRefundedFcfa >= rec.financial.authorizedMaxRefundFcfa
          ? 'effectuee'
          : 'partiellement_effectuee';
      rec.completedAt = nowIso;
      rec.updatedAt = nowIso;

      markStep(rec.steps, 8, 'done', actor.name, `Reçu confirmé (${providerReference})`);
      markStep(rec.steps, 9, 'done', 'Système DJASSA', 'Client notifié');

      rec.decisions.unshift({
        id: `dec-${crypto.randomUUID().slice(0, 8)}`,
        at: nowIso,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'Confirmation prestataire externe',
        fromStatus: 'en_cours_traitement',
        toStatus: rec.status,
        note: `Réf prestataire ${providerReference} validée.`
      });

      appendJournalEntry({
        entryType: rec.status === 'effectuee' ? 'refund_executed' : 'refund_partial_executed',
        entityType: 'refund',
        entityId: rec.id,
        entityCode: rec.code,
        orderNumber: rec.orderNumber,
        beneficiaryName: rec.actors.client.name,
        beneficiaryRole: 'client',
        amountFcfa: amount,
        commissionDeltaFcfa: 0,
        channel: rec.targetChannel,
        providerReference,
        actorId: actor.id,
        actorName: actor.name,
        note: `Preuve externe confirmée (${providerReference})`
      });

      pushRefundNotification({
        entityType: 'refund',
        entityId: rec.id,
        entityCode: rec.code,
        eventType: 'refund_confirmed',
        recipientRole: 'client',
        recipientName: rec.actors.client.name,
        title: `Remboursement confirmé (${rec.code})`,
        body: `Versement de ${amount.toLocaleString('fr-FR')} FCFA confirmé (${providerReference}).`
      });

      if (rec.linkedDisputeId || rec.linkedDisputeCode) {
        syncRefundConfirmationIntoDispute({
          disputeId: rec.linkedDisputeId,
          disputeCode: rec.linkedDisputeCode,
          amountFcfa: amount,
          refundReference: providerReference,
          actorId: actor.id,
          actorName: actor.name,
          status: 'confirmed',
          channel: rec.targetChannel
        });
      }

      persistRefundsDb();
      res.json({ success: true, refund: rec });
    }
  );

  // 13. Mark processing operation as failed
  app.post('/api/refunds/:id/mark-failed', requireRefundPermission('cancelOrRetryOperation'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { refundAuthCtx: AuthenticatedRequestContext }).refundAuthCtx;
    const actor = authCtx.staff!;
    const rec = refundsDb.refunds.find((r) => r.id === req.params.id);
    if (!rec) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });

    const errorMessage = String(req.body?.errorMessage || 'Rejet signalé par le prestataire lors du rapprochement').trim();
    const nowIso = new Date().toISOString();
    const pendingAttempt = rec.providerAttempts.find((a) => a.providerResponseStatus === 'pending_provider_confirmation');
    if (pendingAttempt) {
      pendingAttempt.providerResponseStatus = 'failed_provider_error';
      pendingAttempt.errorMessage = errorMessage;
    } else {
      rec.providerAttempts.unshift({
        id: `att-${crypto.randomUUID().slice(0, 8)}`,
        attemptNumber: rec.providerAttempts.length + 1,
        channel: rec.targetChannel,
        amountFcfa: rec.financial.remainingToRefundFcfa,
        providerConfigured: false,
        providerResponseStatus: 'failed_provider_error',
        providerReference: `ERR-${rec.code.slice(-6)}`,
        requestedById: actor.id,
        requestedByName: actor.name,
        at: nowIso,
        errorMessage
      });
    }

    const prevStatus = rec.status;
    rec.status = 'echouee';
    rec.updatedAt = nowIso;
    markStep(rec.steps, 7, 'blocked', actor.name, errorMessage);
    rec.decisions.unshift({
      id: `dec-${crypto.randomUUID().slice(0, 8)}`,
      at: nowIso,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'Opération marquée en échec',
      fromStatus: prevStatus,
      toStatus: 'echouee',
      note: errorMessage
    });

    pushRefundNotification({
      entityType: 'refund',
      entityId: rec.id,
      entityCode: rec.code,
      eventType: 'operation_failed',
      recipientRole: 'admin',
      recipientName: actor.name,
      title: `Remboursement échoué (${rec.code})`,
      body: errorMessage
    });
    rec.suspiciousSignals = evaluateSuspiciousSignals(rec);
    persistRefundsDb();
    res.json({ success: true, refund: rec });
  });

  // 14. Retry a failed refund operation
  app.post(
    '/api/refunds/:id/retry',
    requireRefundPermission('cancelOrRetryOperation', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { refundAuthCtx: AuthenticatedRequestContext }).refundAuthCtx;
      const actor = authCtx.staff!;
      const rec = refundsDb.refunds.find((r) => r.id === req.params.id);
      if (!rec) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });

      if (rec.status !== 'echouee') {
        return res.status(400).json({ success: false, error: 'NOT_FAILED', message: 'Seule une opération en échec peut être relancée.' });
      }

      if (rec.providerAttempts.length >= refundsDb.settings.maxRetriesPerOperation + 1) {
        return res.status(400).json({
          success: false,
          error: 'MAX_RETRIES_REACHED',
          message: `Nombre maximal de relances (${refundsDb.settings.maxRetriesPerOperation}) atteint pour ce dossier.`
        });
      }

      const nowIso = new Date().toISOString();
      if (req.body?.channel) rec.targetChannel = normalizeChannel(req.body.channel);
      rec.status = 'approuvee';
      rec.updatedAt = nowIso;
      markStep(rec.steps, 7, 'pending', actor.name, 'Relance autorisée');
      rec.decisions.unshift({
        id: `dec-${crypto.randomUUID().slice(0, 8)}`,
        at: nowIso,
        actorId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        action: 'Relance préparée après échec',
        fromStatus: 'echouee',
        toStatus: 'approuvee',
        note: `Canal cible : ${rec.targetChannel}`
      });

      appendJournalEntry({
        entryType: 'provider_retry',
        entityType: 'refund',
        entityId: rec.id,
        entityCode: rec.code,
        orderNumber: rec.orderNumber,
        beneficiaryName: rec.actors.client.name,
        beneficiaryRole: 'client',
        amountFcfa: rec.financial.remainingToRefundFcfa,
        commissionDeltaFcfa: 0,
        channel: rec.targetChannel,
        providerReference: `RETRY-${rec.code.slice(-6)}-${rec.providerAttempts.length}`,
        actorId: actor.id,
        actorName: actor.name,
        note: 'Opération remise en file d’exécution'
      });

      persistRefundsDb();
      res.json({ success: true, refund: rec });
    }
  );

  // 15. Archive dossier (Step 10)
  app.post('/api/refunds/:id/archive', requireRefundPermission('viewRefunds'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { refundAuthCtx: AuthenticatedRequestContext }).refundAuthCtx;
    const actor = authCtx.staff!;
    const rec = refundsDb.refunds.find((r) => r.id === req.params.id);
    if (!rec) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });

    rec.archived = true;
    rec.updatedAt = new Date().toISOString();
    markStep(rec.steps, 10, 'done', actor.name, 'Dossier archivé');
    persistRefundsDb();
    res.json({ success: true, refund: rec });
  });

  // =========================================================================
  // COMPENSATIONS (INDEMNISATIONS) — Distinct from refunds!
  // =========================================================================
  app.post('/api/refunds/compensations', requireRefundPermission('manageCompensations'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { refundAuthCtx: AuthenticatedRequestContext }).refundAuthCtx;
    const actor = authCtx.staff!;
    const body = req.body || {};

    const beneficiaryRole = (body.beneficiaryRole || 'client') as CompensationBeneficiaryRole;
    const reason = (body.reason || 'colis_perdu') as CompensationReasonKey;
    if (!refundsDb.settings.enabledCompensationReasons[reason]) {
      return res.status(400).json({ success: false, error: 'REASON_DISABLED', message: 'Ce motif d’indemnisation est désactivé.' });
    }

    const beneficiaryName = String(body.beneficiaryName || '').trim();
    const incidentDescription = String(body.incidentDescription || '').trim();
    const requestedAmountFcfa = Math.round(Number(body.requestedAmountFcfa || 0));

    if (!beneficiaryName || incidentDescription.length < 5 || requestedAmountFcfa <= 0) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_COMPENSATION',
        message: 'Bénéficiaire, description de l’incident (min. 5 car.) et montant > 0 FCFA obligatoires.'
      });
    }

    if (requestedAmountFcfa > refundsDb.settings.maxCompensationFcfa) {
      return res.status(400).json({
        success: false,
        error: 'EXCEEDS_MAX_COMPENSATION',
        message: `Montant supérieur au plafond d’indemnisation configuré (${refundsDb.settings.maxCompensationFcfa.toLocaleString('fr-FR')} FCFA).`
      });
    }

    const nowIso = new Date().toISOString();
    const needsDual = requestedAmountFcfa > refundsDb.settings.dualValidationThresholdFcfa;
    const targetChannel = normalizeChannel(body.targetChannel || 'internal_ledger');
    const payoutAccount = String(body.beneficiaryPayoutAccount || body.beneficiaryPhone || '+225 07 00 00 00 00').trim();

    const comp: CompensationRecord = {
      id: `ind-${crypto.randomUUID().slice(0, 10)}`,
      code: makeCode('IND'),
      beneficiaryRole,
      beneficiary: {
        accountId: String(body.beneficiaryId || `${beneficiaryRole}-${Date.now()}`),
        roleType: beneficiaryRole,
        name: beneficiaryName,
        phoneMasked: maskContact(payoutAccount),
        phoneFull: body.beneficiaryPhone,
        commune: body.commune,
        accountStatus: 'active',
        payoutTargetMasked: maskContact(payoutAccount),
        titularityVerified: true
      },
      beneficiaryPayoutAccount: maskContact(payoutAccount) || beneficiaryName,
      titularityVerified: true,
      reason,
      incidentDescription: redactSensitiveText(incidentDescription),
      orderId: body.orderId,
      orderNumber: body.orderNumber ? String(body.orderNumber).trim() : undefined,
      linkedDisputeId: body.linkedDisputeId,
      linkedDisputeCode: body.linkedDisputeCode,
      fundingSource: (body.fundingSource || 'caisse_djassa_garantie') as CompensationFundingSource,
      requestedAmountFcfa,
      approvedAmountFcfa: 0,
      paidAmountFcfa: 0,
      targetChannel,
      status: 'nouvelle_demande',
      requiresSuperAdminValidation: needsDual,
      createdById: actor.id,
      createdByName: actor.name,
      createdAt: nowIso,
      updatedAt: nowIso,
      decisions: [
        {
          id: `cdec-${crypto.randomUUID().slice(0, 8)}`,
          at: nowIso,
          actorId: actor.id,
          actorName: actor.name,
          action: 'Création dossier indemnisation',
          note: `${beneficiaryRole.toUpperCase()} • ${requestedAmountFcfa.toLocaleString('fr-FR')} FCFA (${reason})`
        }
      ],
      evidence: []
    };

    refundsDb.compensations.unshift(comp);
    pushRefundNotification({
      entityType: 'compensation',
      entityId: comp.id,
      entityCode: comp.code,
      eventType: 'request_created',
      recipientRole: beneficiaryRole,
      recipientName: beneficiaryName,
      title: `Dossier d’indemnisation ouvert (${comp.code})`,
      body: `Indemnisation demandée pour ${beneficiaryName} (${requestedAmountFcfa.toLocaleString('fr-FR')} FCFA).`
    });
    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'payments',
      actionType: 'compensation_created',
      action: `Création indemnisation ${comp.code}`,
      target: `${beneficiaryName} (${beneficiaryRole})`,
      targetType: 'finance',
      result: 'reussi',
      severity: 'moyen',
      details: `${requestedAmountFcfa.toLocaleString('fr-FR')} FCFA • ${reason}`
    });

    persistRefundsDb();
    res.json({ success: true, compensation: comp });
  });

  app.post(
    '/api/refunds/compensations/:compId/action',
    requireRefundPermission('manageCompensations', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { refundAuthCtx: AuthenticatedRequestContext }).refundAuthCtx;
      const actor = authCtx.staff!;
      const perms = getEffectivePermissions(actor.id, actor.role);
      const comp = refundsDb.compensations.find((c) => c.id === req.params.compId);
      if (!comp) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Indemnisation introuvable.' });

      const { action, approvedAmountFcfa, reason = '', providerReference = '', channel, simulateFailure = false } = req.body || {};
      const nowIso = new Date().toISOString();

      if (action === 'verify') {
        comp.status = 'en_verification';
        comp.decisions.unshift({ id: `cdec-${crypto.randomUUID().slice(0, 8)}`, at: nowIso, actorId: actor.id, actorName: actor.name, action: 'Vérification incident', note: reason || 'Préjudice vérifié.' });
      } else if (action === 'hold') {
        comp.status = 'en_attente_validation';
        comp.decisions.unshift({ id: `cdec-${crypto.randomUUID().slice(0, 8)}`, at: nowIso, actorId: actor.id, actorName: actor.name, action: 'Mise en attente', note: reason || 'En attente de validation.' });
      } else if (action === 'approve') {
        const finalApproved = Math.min(refundsDb.settings.maxCompensationFcfa, Math.max(1, Math.round(Number(approvedAmountFcfa || comp.requestedAmountFcfa))));
        comp.approvedAmountFcfa = finalApproved;
        comp.validatedById = actor.id;
        comp.validatedByName = actor.name;
        comp.decisionDate = nowIso;
        comp.status = comp.requiresSuperAdminValidation && !comp.superAdminValidatedById ? 'en_attente_validation' : 'approuvee';
        comp.decisions.unshift({ id: `cdec-${crypto.randomUUID().slice(0, 8)}`, at: nowIso, actorId: actor.id, actorName: actor.name, action: 'Approbation indemnisation', note: `${finalApproved.toLocaleString('fr-FR')} FCFA • ${reason || 'Validé'}` });
        pushRefundNotification({
          entityType: 'compensation',
          entityId: comp.id,
          entityCode: comp.code,
          eventType: 'approved',
          recipientRole: comp.beneficiaryRole,
          recipientName: comp.beneficiary.name,
          title: `Indemnisation approuvée (${comp.code})`,
          body: `Montant approuvé : ${finalApproved.toLocaleString('fr-FR')} FCFA.`
        });
      } else if (action === 'super_validate') {
        if (!perms.superAdminFinalValidate) {
          return res.status(403).json({ success: false, error: 'SUPER_ADMIN_REQUIRED', message: 'Validation Super Administrateur requise.' });
        }
        comp.superAdminValidatedById = actor.id;
        comp.superAdminValidatedByName = actor.name;
        if (!comp.approvedAmountFcfa) comp.approvedAmountFcfa = comp.requestedAmountFcfa;
        comp.decisionDate = nowIso;
        comp.status = 'approuvee';
        comp.decisions.unshift({ id: `cdec-${crypto.randomUUID().slice(0, 8)}`, at: nowIso, actorId: actor.id, actorName: actor.name, action: 'Double validation Super Admin', note: reason || 'Validé pour versement.' });
      } else if (action === 'reject') {
        if (String(reason).trim().length < 5) {
          return res.status(400).json({ success: false, error: 'REASON_REQUIRED', message: 'Motif de refus obligatoire (min. 5 caractères).' });
        }
        comp.status = 'refusee';
        comp.rejectionReason = redactSensitiveText(reason);
        comp.decisionDate = nowIso;
        comp.decisions.unshift({ id: `cdec-${crypto.randomUUID().slice(0, 8)}`, at: nowIso, actorId: actor.id, actorName: actor.name, action: 'Refus indemnisation', note: comp.rejectionReason });
        pushRefundNotification({
          entityType: 'compensation',
          entityId: comp.id,
          entityCode: comp.code,
          eventType: 'rejected',
          recipientRole: comp.beneficiaryRole,
          recipientName: comp.beneficiary.name,
          title: `Indemnisation refusée (${comp.code})`,
          body: comp.rejectionReason
        });
      } else if (action === 'cancel') {
        if (comp.status === 'versee') {
          return res.status(400).json({ success: false, error: 'ALREADY_PAID', message: 'Indemnisation déjà versée.' });
        }
        comp.status = 'annulee';
        comp.decisions.unshift({ id: `cdec-${crypto.randomUUID().slice(0, 8)}`, at: nowIso, actorId: actor.id, actorName: actor.name, action: 'Annulation', note: reason || 'Annulée avant versement.' });
      } else if (action === 'retry') {
        comp.status = 'approuvee';
        comp.failureReason = undefined;
        comp.decisions.unshift({ id: `cdec-${crypto.randomUUID().slice(0, 8)}`, at: nowIso, actorId: actor.id, actorName: actor.name, action: 'Relance autorisée', note: 'Prête pour nouvelle tentative de versement.' });
      } else if (action === 'execute') {
        if (comp.status === 'versee') {
          return res.status(409).json({ success: false, error: 'ALREADY_PAID', message: 'Indemnisation déjà versée (anti-doublon).' });
        }
        if (comp.requiresSuperAdminValidation && !comp.superAdminValidatedById) {
          return res.status(403).json({ success: false, error: 'SUPER_ADMIN_VALIDATION_REQUIRED', message: 'Double validation Super Admin requise avant versement.' });
        }
        const targetChan = normalizeChannel(channel || comp.targetChannel);
        comp.targetChannel = targetChan;
        const amountToPay = comp.approvedAmountFcfa || comp.requestedAmountFcfa;
        const prov = getProviderStatuses().find((p) => p.id === targetChan);

        if (simulateFailure) {
          comp.status = 'echouee';
          comp.failureReason = 'Échec temporaire retourné par le prestataire';
          comp.decisions.unshift({ id: `cdec-${crypto.randomUUID().slice(0, 8)}`, at: nowIso, actorId: actor.id, actorName: actor.name, action: 'Échec versement', note: comp.failureReason });
          appendJournalEntry({
            entryType: 'compensation_failed',
            entityType: 'compensation',
            entityId: comp.id,
            entityCode: comp.code,
            orderNumber: comp.orderNumber,
            beneficiaryName: comp.beneficiary.name,
            beneficiaryRole: comp.beneficiaryRole,
            amountFcfa: amountToPay,
            commissionDeltaFcfa: 0,
            channel: targetChan,
            providerReference: `ERR-${comp.code.slice(-6)}`,
            actorId: actor.id,
            actorName: actor.name,
            note: comp.failureReason
          });
          persistRefundsDb();
          return res.status(502).json({ success: false, error: 'PROVIDER_FAILED', message: comp.failureReason, compensation: comp });
        }

        if (targetChan !== 'internal_ledger' && (!prov || !prov.supportsAutomaticPayout)) {
          comp.status = 'en_cours_versement';
          comp.payoutReference = `PEND-${comp.code.slice(-6)}`;
          comp.decisions.unshift({ id: `cdec-${crypto.randomUUID().slice(0, 8)}`, at: nowIso, actorId: actor.id, actorName: actor.name, action: `Versement en cours (${targetChan})`, note: 'Confirmation de reçu prestataire requise.' });
          persistRefundsDb();
          return res.json({ success: true, awaitingProviderConfirmation: true, compensation: comp });
        }

        const payoutRef = `IND-PAY-${comp.code.slice(-6)}`;
        recordVerifiedFinancialOperationInSecurityLedger({
          reference: payoutRef,
          accountId: comp.beneficiary.accountId,
          accountName: comp.beneficiary.name,
          spaceRole: comp.beneficiaryRole === 'seller' ? 'seller' : 'client',
          type: 'credit',
          amountFcfa: amountToPay,
          channel: prov?.name || targetChan,
          payoutTargetMasked: comp.beneficiaryPayoutAccount,
          actorName: actor.name,
          note: `Indemnisation ${comp.code} (${comp.reason}) • Source: ${comp.fundingSource}`
        });

        comp.paidAmountFcfa = amountToPay;
        comp.paidDate = nowIso;
        comp.payoutReference = payoutRef;
        comp.payoutProof = `Registre serveur DJASSA (${payoutRef})`;
        comp.status = 'versee';
        comp.decisions.unshift({ id: `cdec-${crypto.randomUUID().slice(0, 8)}`, at: nowIso, actorId: actor.id, actorName: actor.name, action: `Indemnisation versée (${amountToPay.toLocaleString('fr-FR')} FCFA)`, note: `Réf ${payoutRef}` });

        appendJournalEntry({
          entryType: 'compensation_paid',
          entityType: 'compensation',
          entityId: comp.id,
          entityCode: comp.code,
          orderNumber: comp.orderNumber,
          beneficiaryName: comp.beneficiary.name,
          beneficiaryRole: comp.beneficiaryRole,
          amountFcfa: amountToPay,
          commissionDeltaFcfa: 0,
          channel: targetChan,
          providerReference: payoutRef,
          actorId: actor.id,
          actorName: actor.name,
          note: `Indemnisation ${comp.reason} (${comp.fundingSource})`
        });

        pushRefundNotification({
          entityType: 'compensation',
          entityId: comp.id,
          entityCode: comp.code,
          eventType: 'compensation_confirmed',
          recipientRole: comp.beneficiaryRole,
          recipientName: comp.beneficiary.name,
          title: `Indemnisation versée (${amountToPay.toLocaleString('fr-FR')} FCFA)`,
          body: `Réf ${payoutRef} • Motif : ${comp.reason}.`
        });
      } else if (action === 'confirm_provider') {
        if (String(providerReference).trim().length < 4) {
          return res.status(400).json({ success: false, error: 'RECEIPT_REF_REQUIRED', message: 'Référence de preuve prestataire obligatoire.' });
        }
        const amountToPay = comp.approvedAmountFcfa || comp.requestedAmountFcfa;
        recordVerifiedFinancialOperationInSecurityLedger({
          reference: String(providerReference).trim(),
          accountId: comp.beneficiary.accountId,
          accountName: comp.beneficiary.name,
          spaceRole: comp.beneficiaryRole === 'seller' ? 'seller' : 'client',
          type: 'credit',
          amountFcfa: amountToPay,
          channel: comp.targetChannel,
          payoutTargetMasked: comp.beneficiaryPayoutAccount,
          actorName: actor.name,
          note: `Indemnisation externe confirmée ${comp.code}`
        });
        comp.paidAmountFcfa = amountToPay;
        comp.paidDate = nowIso;
        comp.payoutReference = String(providerReference).trim();
        comp.payoutProof = `Preuve externe vérifiée : ${comp.payoutReference}`;
        comp.status = 'versee';
        comp.decisions.unshift({ id: `cdec-${crypto.randomUUID().slice(0, 8)}`, at: nowIso, actorId: actor.id, actorName: actor.name, action: 'Versement externe confirmé', note: `Réf ${comp.payoutReference}` });
        appendJournalEntry({
          entryType: 'compensation_paid',
          entityType: 'compensation',
          entityId: comp.id,
          entityCode: comp.code,
          orderNumber: comp.orderNumber,
          beneficiaryName: comp.beneficiary.name,
          beneficiaryRole: comp.beneficiaryRole,
          amountFcfa: amountToPay,
          commissionDeltaFcfa: 0,
          channel: comp.targetChannel,
          providerReference: comp.payoutReference,
          actorId: actor.id,
          actorName: actor.name,
          note: `Indemnisation confirmée (${comp.fundingSource})`
        });
        pushRefundNotification({
          entityType: 'compensation',
          entityId: comp.id,
          entityCode: comp.code,
          eventType: 'compensation_confirmed',
          recipientRole: comp.beneficiaryRole,
          recipientName: comp.beneficiary.name,
          title: `Indemnisation confirmée (${comp.code})`,
          body: `Versement de ${amountToPay.toLocaleString('fr-FR')} FCFA confirmé (${comp.payoutReference}).`
        });
      } else {
        return res.status(400).json({ success: false, error: 'UNKNOWN_ACTION', message: 'Action inconnue.' });
      }

      comp.updatedAt = nowIso;
      persistRefundsDb();
      res.json({ success: true, compensation: comp });
    }
  );

  // Protect immutable financial journal against deletion/modification
  app.delete('/api/refunds/journal/:entryId', requireRefundPermission('viewRefunds'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { refundAuthCtx: AuthenticatedRequestContext }).refundAuthCtx;
    const actor = authCtx.staff!;
    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'security',
      actionType: 'refund_journal_tamper_blocked',
      action: `Tentative de suppression écriture journal financier bloquée (${req.params.entryId})`,
      target: req.params.entryId,
      targetType: 'finance',
      result: 'bloque',
      severity: 'critique',
      details: 'Le journal financier des remboursements et indemnisations est strictement immuable.'
    });
    res.status(403).json({
      success: false,
      error: 'IMMUTABLE_JOURNAL',
      message: 'Opération interdite : le journal financier est immuable et protégé contre toute modification.'
    });
  });

  // Mark notification read
  app.post('/api/refunds/notifications/:notifId/read', requireRefundPermission('viewRefunds'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { refundAuthCtx: AuthenticatedRequestContext }).refundAuthCtx;
    const actor = authCtx.staff!;
    const n = refundsDb.notifications.find((x) => x.id === req.params.notifId);
    if (n && !n.readByAdminIds.includes(actor.id)) {
      n.readByAdminIds.push(actor.id);
      persistRefundsDb();
    }
    res.json({ success: true });
  });

  // Update settings (with full change history!)
  app.patch(
    '/api/refunds/settings',
    requireRefundPermission('manageRefundSettings', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { refundAuthCtx: AuthenticatedRequestContext }).refundAuthCtx;
      const actor = authCtx.staff!;
      const patch = req.body || {};

      const beforeSnapshot = JSON.stringify({
        dualValidationThresholdFcfa: refundsDb.settings.dualValidationThresholdFcfa,
        maxSingleRefundFcfa: refundsDb.settings.maxSingleRefundFcfa,
        maxCompensationFcfa: refundsDb.settings.maxCompensationFcfa,
        slaProcessingHours: refundsDb.settings.slaProcessingHours,
        commissionRules: refundsDb.settings.commissionRules,
        eligibilityRules: refundsDb.settings.eligibilityRules
      });

      const next: RefundModuleSettings = {
        ...refundsDb.settings,
        dualValidationThresholdFcfa:
          typeof patch.dualValidationThresholdFcfa === 'number'
            ? Math.max(0, patch.dualValidationThresholdFcfa)
            : refundsDb.settings.dualValidationThresholdFcfa,
        maxSingleRefundFcfa:
          typeof patch.maxSingleRefundFcfa === 'number'
            ? Math.max(1000, patch.maxSingleRefundFcfa)
            : refundsDb.settings.maxSingleRefundFcfa,
        maxCompensationFcfa:
          typeof patch.maxCompensationFcfa === 'number'
            ? Math.max(1000, patch.maxCompensationFcfa)
            : refundsDb.settings.maxCompensationFcfa,
        slaProcessingHours:
          typeof patch.slaProcessingHours === 'number'
            ? Math.max(1, Math.min(720, patch.slaProcessingHours))
            : refundsDb.settings.slaProcessingHours,
        maxRetriesPerOperation:
          typeof patch.maxRetriesPerOperation === 'number'
            ? Math.max(1, Math.min(10, patch.maxRetriesPerOperation))
            : refundsDb.settings.maxRetriesPerOperation,
        enabledRefundTypes: {
          ...refundsDb.settings.enabledRefundTypes,
          ...(patch.enabledRefundTypes || {})
        },
        enabledCompensationReasons: {
          ...refundsDb.settings.enabledCompensationReasons,
          ...(patch.enabledCompensationReasons || {})
        },
        eligibilityRules: {
          ...refundsDb.settings.eligibilityRules,
          ...(patch.eligibilityRules || {})
        },
        commissionRules: {
          ...refundsDb.settings.commissionRules,
          ...(patch.commissionRules || {})
        },
        notificationsEnabled: {
          ...refundsDb.settings.notificationsEnabled,
          ...(patch.notificationsEnabled || {})
        },
        settingsChangeHistory: [...refundsDb.settings.settingsChangeHistory]
      };

      const afterSnapshot = JSON.stringify({
        dualValidationThresholdFcfa: next.dualValidationThresholdFcfa,
        maxSingleRefundFcfa: next.maxSingleRefundFcfa,
        maxCompensationFcfa: next.maxCompensationFcfa,
        slaProcessingHours: next.slaProcessingHours,
        commissionRules: next.commissionRules,
        eligibilityRules: next.eligibilityRules
      });

      next.settingsChangeHistory.unshift({
        id: `rset-${crypto.randomUUID().slice(0, 8)}`,
        at: new Date().toISOString(),
        actorId: actor.id,
        actorName: actor.name,
        summary: `Seuil double val.=${next.dualValidationThresholdFcfa} F • Plafond=${next.maxSingleRefundFcfa} F • Délai=${next.slaProcessingHours}h`,
        beforeJson: beforeSnapshot,
        afterJson: afterSnapshot
      });
      next.settingsChangeHistory = next.settingsChangeHistory.slice(0, 50);

      refundsDb.settings = next;
      persistRefundsDb();

      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'system_config',
        actionType: 'refund_settings_updated',
        action: 'Paramètres Remboursements & indemnisations mis à jour',
        target: 'Paramètres remboursements',
        targetType: 'settings',
        result: 'reussi',
        severity: 'eleve',
        details: next.settingsChangeHistory[0].summary
      });

      res.json({ success: true, settings: next });
    }
  );

  // Update agent permissions (Super Admin only)
  app.patch(
    '/api/refunds/permissions/:staffId',
    requireRefundPermission('manageRefundSettings', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { refundAuthCtx: AuthenticatedRequestContext }).refundAuthCtx;
      const actor = authCtx.staff!;
      if (actor.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'SUPER_ADMIN_REQUIRED',
          message: 'Seul le Super Administrateur peut modifier les droits d’accès remboursements.'
        });
      }

      const staffTarget = getSecurityStaffDirectory().find((s) => s.id === req.params.staffId);
      if (!staffTarget) return res.status(404).json({ success: false, error: 'STAFF_NOT_FOUND', message: 'Agent introuvable.' });
      if (staffTarget.role === 'super_admin') {
        return res.status(400).json({ success: false, error: 'SUPER_ADMIN_IMMUTABLE', message: 'Les droits Super Admin sont non modifiables.' });
      }

      const incoming = (req.body?.permissions || {}) as Partial<Record<RefundPermissionKey, boolean>>;
      const updated = { ...getEffectivePermissions(staffTarget.id, staffTarget.role) };
      ALL_REFUND_PERMISSIONS.forEach((k) => {
        if (typeof incoming[k] === 'boolean') updated[k] = incoming[k]!;
      });
      refundsDb.staffPermissions[staffTarget.id] = updated;
      persistRefundsDb();

      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'admin_mgmt',
        actionType: 'refund_permissions_updated',
        action: `Droits Remboursements modifiés pour ${staffTarget.name}`,
        target: staffTarget.email,
        targetType: 'permissions',
        result: 'reussi',
        severity: 'eleve',
        details: `Mise à jour par ${actor.name}`
      });

      res.json({ success: true, staffId: staffTarget.id, permissions: updated });
    }
  );
}

export function applyGeniusPayRefundWebhookEvent(input: {
  providerReference: string;
  status: 'confirmed' | 'failed';
  providerStatus?: string;
  failureReason?: string;
}): {
  found: boolean;
  idempotent?: boolean;
  refund?: RefundRecord;
} {
  const ref = String(input.providerReference || '').trim();
  if (!ref) return { found: false };
  const rec = refundsDb.refunds.find((r) =>
    r.providerAttempts.some((a) => a.providerReference === ref)
  );
  if (!rec) return { found: false };

  const attempt = rec.providerAttempts.find((a) => a.providerReference === ref);
  if (rec.status === 'effectuee' && attempt?.providerResponseStatus === 'confirmed_external_provider') {
    return { found: true, idempotent: true, refund: rec };
  }

  const nowIso = new Date().toISOString();
  const amount = attempt?.amountFcfa || rec.financial.remainingToRefundFcfa;

  if (input.status === 'confirmed') {
    if (rec.status !== 'en_cours_traitement' && rec.status !== 'partiellement_effectuee') {
      return { found: true, idempotent: true, refund: rec };
    }
    recordVerifiedFinancialOperationInSecurityLedger({
      reference: ref,
      accountId: rec.actors.client.accountId,
      accountName: rec.actors.client.name,
      spaceRole: 'client',
      type: 'credit',
      amountFcfa: amount,
      channel: rec.targetChannel,
      payoutTargetMasked: rec.beneficiaryPayoutAccount,
      actorName: 'Webhook GeniusPay',
      note: `Confirmation webhook GeniusPay ${rec.targetChannel} (${rec.code})`
    });
    if (attempt) {
      attempt.providerResponseStatus = 'confirmed_external_provider';
      attempt.confirmedAt = nowIso;
      attempt.receiptProof = `Webhook GeniusPay confirmé (${input.providerStatus || 'COMPLETED'})`;
    }
    rec.financial.alreadyRefundedFcfa += amount;
    rec.financial.remainingToRefundFcfa = Math.max(
      0,
      rec.financial.requestedAmountFcfa - rec.financial.alreadyRefundedFcfa
    );
    rec.status =
      rec.financial.remainingToRefundFcfa === 0 &&
      rec.financial.alreadyRefundedFcfa >= rec.financial.authorizedMaxRefundFcfa
        ? 'effectuee'
        : 'partiellement_effectuee';
    rec.completedAt = nowIso;
    rec.updatedAt = nowIso;

    markStep(rec.steps, 8, 'done', 'Webhook GeniusPay', `Confirmé (${ref})`);
    markStep(rec.steps, 9, 'done', 'Système DJASSA', 'Client notifié');
    rec.decisions.unshift({
      id: `dec-${crypto.randomUUID().slice(0, 8)}`,
      at: nowIso,
      actorId: 'geniuspay-webhook',
      actorName: 'Webhook GeniusPay',
      actorRole: 'super_admin',
      action: 'Confirmation automatique webhook GeniusPay',
      fromStatus: 'en_cours_traitement',
      toStatus: rec.status,
      note: `Réf ${ref} confirmée (${input.providerStatus || 'COMPLETED'}).`
    });
    appendJournalEntry({
      entryType: rec.status === 'effectuee' ? 'refund_executed' : 'refund_partial_executed',
      entityType: 'refund',
      entityId: rec.id,
      entityCode: rec.code,
      orderNumber: rec.orderNumber,
      beneficiaryName: rec.actors.client.name,
      beneficiaryRole: 'client',
      amountFcfa: amount,
      commissionDeltaFcfa: 0,
      channel: rec.targetChannel,
      providerReference: ref,
      actorId: 'geniuspay-webhook',
      actorName: 'Webhook GeniusPay',
      note: `Webhook GeniusPay confirmé (${ref})`
    });
    pushRefundNotification({
      entityType: 'refund',
      entityId: rec.id,
      entityCode: rec.code,
      eventType: 'refund_confirmed',
      recipientRole: 'client',
      recipientName: rec.actors.client.name,
      title: `Remboursement confirmé (${rec.code})`,
      body: `Versement de ${amount.toLocaleString('fr-FR')} FCFA confirmé (${ref}).`
    });
    if (rec.linkedDisputeId || rec.linkedDisputeCode) {
      syncRefundConfirmationIntoDispute({
        disputeId: rec.linkedDisputeId,
        disputeCode: rec.linkedDisputeCode,
        amountFcfa: amount,
        refundReference: ref,
        actorId: 'geniuspay-webhook',
        actorName: 'Webhook GeniusPay',
        status: 'confirmed',
        channel: rec.targetChannel
      });
    }
    persistRefundsDb();
    return { found: true, refund: rec };
  }

  // Failed webhook
  if (attempt) {
    attempt.providerResponseStatus = 'failed_provider_error';
    attempt.errorMessage = input.failureReason || `Échec webhook GeniusPay (${input.providerStatus || 'FAILED'})`;
  }
  const prevStatus = rec.status;
  rec.status = 'echouee';
  rec.updatedAt = nowIso;
  markStep(rec.steps, 7, 'blocked', 'Webhook GeniusPay', attempt?.errorMessage || 'Échec GeniusPay');
  rec.decisions.unshift({
    id: `dec-${crypto.randomUUID().slice(0, 8)}`,
    at: nowIso,
    actorId: 'geniuspay-webhook',
    actorName: 'Webhook GeniusPay',
    actorRole: 'super_admin',
    action: 'Échec webhook GeniusPay',
    fromStatus: prevStatus,
    toStatus: 'echouee',
    note: attempt?.errorMessage || `Réf ${ref} rejetée.`
  });
  appendJournalEntry({
    entryType: 'refund_failed',
    entityType: 'refund',
    entityId: rec.id,
    entityCode: rec.code,
    orderNumber: rec.orderNumber,
    beneficiaryName: rec.actors.client.name,
    beneficiaryRole: 'client',
    amountFcfa: amount,
    commissionDeltaFcfa: 0,
    channel: rec.targetChannel,
    providerReference: ref,
    actorId: 'geniuspay-webhook',
    actorName: 'Webhook GeniusPay',
    note: attempt?.errorMessage || `Échec GeniusPay (${ref})`
  });
  rec.suspiciousSignals = evaluateSuspiciousSignals(rec);
  persistRefundsDb();
  return { found: true, refund: rec };
}

