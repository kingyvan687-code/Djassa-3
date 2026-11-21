import type { Express, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { atomicWriteJsonFile } from './atomicFileStore';
import {
  appendAuditEntry,
  applyVerifiedLedgerAction,
  authenticateSessionRequest,
  getClientIp,
  getFinanceFraudTelemetrySnapshot,
  getSecurityStaffDirectory,
  redactSensitiveText,
  verifyStepUpMfaForRequest,
  type AuthenticatedRequestContext
} from './securityModule';
import type {
  FraudAccountWatchRecord,
  FraudActorSpace,
  FraudAlertRecord,
  FraudAlertStatus,
  FraudDashboardKpis,
  FraudDetectionRule,
  FraudDomainCategory,
  FraudEvidenceItem,
  FraudLinkedAccountsCluster,
  FraudOrderAnomalyRecord,
  FraudOverviewResponse,
  FraudPaymentRecord,
  FraudPermissionKey,
  FraudRiskCriterionBreakdown,
  FraudRiskLevel,
  FraudSensitiveActionRequest,
  FraudSettings,
  FraudStaffPermissionRow,
  FraudWalletConsistencyRecord,
  FraudWithdrawalRecord,
  SensitiveFinanceActionType
} from '../src/types/fraud';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const FRAUD_DB_FILE = path.join(DATA_DIR, 'fraud_db.json');
const CREDITS_DB_FILE = path.join(DATA_DIR, 'credits_billing.json');
const DJASSA_DB_FILE = path.join(DATA_DIR, 'db.json');

export const ALL_FRAUD_PERMISSIONS: FraudPermissionKey[] = [
  'viewFraudDashboard',
  'viewSensitiveFraudDetails',
  'manageInvestigations',
  'requestSensitiveFinanceAction',
  'approveDualControlAction',
  'manageFraudRules',
  'manageAccountWatch'
];

interface FraudDatabase {
  alerts: FraudAlertRecord[];
  verifiedPayments: FraudPaymentRecord[];
  orderAnomalies: FraudOrderAnomalyRecord[];
  accountWatchOverrides: Record<
    string,
    {
      watchStatus: FraudAccountWatchRecord['watchStatus'];
      watchReason: string;
      updatedBy: string;
      updatedAt: string;
    }
  >;
  linkedClusterDecisions: Record<
    string,
    {
      verificationStatus: FraudLinkedAccountsCluster['verificationStatus'];
      note: string;
      updatedBy: string;
      updatedAt: string;
    }
  >;
  sensitiveActionRequests: FraudSensitiveActionRequest[];
  rules: FraudDetectionRule[];
  settings: FraudSettings;
  staffPermissions: Record<string, Record<FraudPermissionKey, boolean>>;
  processedIdempotencyKeys: Record<string, { at: string; summary: string }>;
}

const DEFAULT_SETTINGS: FraudSettings = {
  dualValidationRequired: true,
  autoHoldCriticalOps: true,
  autoHoldHighOps: true,
  maskSensitiveFinancialCoords: true,
  notifyOnMediumRisk: true,
  highRiskScoreThreshold: 50,
  criticalRiskScoreThreshold: 75,
  suspiciousWithdrawalAmountFcfa: 150000,
  withdrawalBurstMaxIn10Min: 3,
  failedPaymentBurstMaxIn30Min: 4
};

const DEFAULT_RULES: FraudDetectionRule[] = [
  {
    id: 'rule-pay-mismatch',
    code: 'PAY_AMOUNT_MISMATCH',
    domain: 'paiement',
    name: 'Écart montant payé vs attendu',
    description: 'Détecte toute différence entre le montant attendu côté serveur et le montant confirmé par le fournisseur.',
    enabled: true,
    weight: 35,
    thresholdValue: 1,
    thresholdUnit: 'FCFA d’écart',
    autoAction: 'bloquer_operation_cible',
    requiresDualControlToEdit: true
  },
  {
    id: 'rule-pay-reused-ref',
    code: 'PAY_REUSED_REFERENCE',
    domain: 'paiement',
    name: 'Réutilisation référence transaction',
    description: 'Signale toute référence de paiement déjà utilisée sur une autre commande ou un autre portefeuille.',
    enabled: true,
    weight: 35,
    thresholdValue: 1,
    thresholdUnit: 'réutilisation',
    autoAction: 'bloquer_operation_cible',
    requiresDualControlToEdit: true
  },
  {
    id: 'rule-pay-unreliable-proof',
    code: 'PAY_UNRELIABLE_CLIENT_CLAIM',
    domain: 'paiement',
    name: 'Preuve / confirmation client non fiable',
    description: 'Rejette tout paiement déclaré réussi côté navigateur ou capture d’écran sans confirmation fiable côté serveur.',
    enabled: true,
    weight: 30,
    thresholdValue: 1,
    thresholdUnit: 'signal',
    autoAction: 'bloquer_operation_cible',
    requiresDualControlToEdit: true
  },
  {
    id: 'rule-pay-failed-burst',
    code: 'PAY_REPEATED_FAILURES',
    domain: 'paiement',
    name: 'Échecs de paiement répétés',
    description: 'Repère les séries rapides de tentatives de paiement échouées sur un même compte ou carte/Mobile Money.',
    enabled: true,
    weight: 18,
    thresholdValue: 4,
    thresholdUnit: 'échecs / 30 min',
    autoAction: 'alerter',
    requiresDualControlToEdit: false
  },
  {
    id: 'rule-wd-payout-change',
    code: 'WD_PAYOUT_TARGET_CHANGED',
    domain: 'retrait',
    name: 'Changement coordonnée juste avant retrait',
    description: 'Surveille les retraits vers un numéro Wave/Orange/RIB différent des coordonnées précédemment vérifiées.',
    enabled: true,
    weight: 28,
    thresholdValue: 1,
    thresholdUnit: 'nouveau bénéficiaire',
    autoAction: 'bloquer_operation_cible',
    requiresDualControlToEdit: true
  },
  {
    id: 'rule-wd-burst',
    code: 'WD_RAPID_BURST',
    domain: 'retrait',
    name: 'Rafale de demandes de retrait',
    description: 'Détecte plusieurs demandes de retrait rapprochées ou fractionnées visant à contourner les plafonds.',
    enabled: true,
    weight: 25,
    thresholdValue: 3,
    thresholdUnit: 'demandes / 10 min',
    autoAction: 'bloquer_operation_cible',
    requiresDualControlToEdit: true
  },
  {
    id: 'rule-wd-over-balance',
    code: 'WD_EXCEEDS_LEDGER',
    domain: 'retrait',
    name: 'Retrait supérieur au solde serveur',
    description: 'Bloque immédiatement toute tentative de retrait dépassant le solde calculé sur le registre comptable.',
    enabled: true,
    weight: 35,
    thresholdValue: 1,
    thresholdUnit: 'FCFA excédent',
    autoAction: 'bloquer_operation_cible',
    requiresDualControlToEdit: true
  },
  {
    id: 'rule-wallet-tamper',
    code: 'WALLET_DIRECT_TAMPER_OR_GAP',
    domain: 'portefeuille',
    name: 'Incohérence registre / altération solde',
    description: 'Détecte toute modification directe de solde hors registre immuable, double écriture ou écart comptable.',
    enabled: true,
    weight: 40,
    thresholdValue: 1,
    thresholdUnit: 'anomalie',
    autoAction: 'bloquer_operation_cible',
    requiresDualControlToEdit: true
  },
  {
    id: 'rule-order-pod-reuse',
    code: 'ORDER_REUSED_OR_MISSING_POD',
    domain: 'commande',
    name: 'Preuve livraison réutilisée ou absente',
    description: 'Signale une confirmation de livraison sans preuve POD attendue ou avec preuve identique à une autre commande.',
    enabled: true,
    weight: 26,
    thresholdValue: 1,
    thresholdUnit: 'anomalie POD',
    autoAction: 'alerter',
    requiresDualControlToEdit: false
  },
  {
    id: 'rule-order-post-edit',
    code: 'ORDER_POST_PAYMENT_MODIFICATION',
    domain: 'commande',
    name: 'Modification commande / annulation post-paiement',
    description: 'Détecte les modifications de montant après paiement, remboursements injustifiés ou annulations répétées.',
    enabled: true,
    weight: 28,
    thresholdValue: 1,
    thresholdUnit: 'occurrence',
    autoAction: 'bloquer_operation_cible',
    requiresDualControlToEdit: true
  },
  {
    id: 'rule-linked-shared-payout',
    code: 'LINKED_SHARED_PAYOUT_OR_DEVICE',
    domain: 'comptes_lies',
    name: 'Indices de comptes liés (RIB / IP / appareil)',
    description: 'Regroupe les comptes partageant la même coordonnée de retrait ou signature technique comme indices à vérifier.',
    enabled: true,
    weight: 22,
    thresholdValue: 2,
    thresholdUnit: 'comptes distincts',
    autoAction: 'alerter',
    requiresDualControlToEdit: false
  }
];

function defaultPermissionsForRole(role: string): Record<FraudPermissionKey, boolean> {
  if (role === 'super_admin') {
    return {
      viewFraudDashboard: true,
      viewSensitiveFraudDetails: true,
      manageInvestigations: true,
      requestSensitiveFinanceAction: true,
      approveDualControlAction: true,
      manageFraudRules: true,
      manageAccountWatch: true
    };
  }
  if (role === 'security_agent') {
    return {
      viewFraudDashboard: true,
      viewSensitiveFraudDetails: true,
      manageInvestigations: true,
      requestSensitiveFinanceAction: true,
      approveDualControlAction: true,
      manageFraudRules: false,
      manageAccountWatch: true
    };
  }
  if (role === 'auditor') {
    return {
      viewFraudDashboard: true,
      viewSensitiveFraudDetails: false,
      manageInvestigations: false,
      requestSensitiveFinanceAction: false,
      approveDualControlAction: false,
      manageFraudRules: false,
      manageAccountWatch: false
    };
  }
  return {
    viewFraudDashboard: false,
    viewSensitiveFraudDetails: false,
    manageInvestigations: false,
    requestSensitiveFinanceAction: false,
    approveDualControlAction: false,
    manageFraudRules: false,
    manageAccountWatch: false
  };
}

function scrubSecrets(text: string): string {
  if (!text) return '';
  return redactSensitiveText(
    text
      .replace(/(mot\s*de\s*passe|password|otp|code\s*secret|secret_key|private_key|api_key|access_token|refresh_token)\s*[:=]\s*([^\s,;\]]+)/gi, '$1=[NON_ENREGISTRE]')
      .replace(/\b\d{4,6}\b(?=\s*(?:otp|code\s*sms|pin))/gi, '[OTP_OMIS]')
  );
}

function maskEmailOrId(raw: string): string {
  const clean = String(raw || '').trim();
  if (!clean) return 'Compte inconnu';
  if (clean.includes('@')) {
    const [local, domain] = clean.split('@');
    return `${local.slice(0, Math.min(2, local.length))}***@${domain}`;
  }
  if (clean.length <= 6) return `${clean.slice(0, 2)}***`;
  return `${clean.slice(0, 4)}***${clean.slice(-3)}`;
}

function maskFinancialCoord(raw?: string | null): string | null {
  if (!raw) return null;
  const clean = String(raw).trim();
  if (!clean) return null;
  if (clean.includes('****')) return clean;
  if (clean.length <= 5) return '***';
  return `${clean.slice(0, 3)}****${clean.slice(-3)}`;
}

function sha256Short(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

function loadFraudDb(): FraudDatabase {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(FRAUD_DB_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(FRAUD_DB_FILE, 'utf8'));
      return {
        alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
        verifiedPayments: Array.isArray(parsed.verifiedPayments) ? parsed.verifiedPayments : [],
        orderAnomalies: Array.isArray(parsed.orderAnomalies) ? parsed.orderAnomalies : [],
        accountWatchOverrides:
          parsed.accountWatchOverrides && typeof parsed.accountWatchOverrides === 'object' ? parsed.accountWatchOverrides : {},
        linkedClusterDecisions:
          parsed.linkedClusterDecisions && typeof parsed.linkedClusterDecisions === 'object' ? parsed.linkedClusterDecisions : {},
        sensitiveActionRequests: Array.isArray(parsed.sensitiveActionRequests) ? parsed.sensitiveActionRequests : [],
        rules: Array.isArray(parsed.rules) && parsed.rules.length > 0 ? parsed.rules : DEFAULT_RULES.map((r) => ({ ...r })),
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        staffPermissions:
          parsed.staffPermissions && typeof parsed.staffPermissions === 'object' ? parsed.staffPermissions : {},
        processedIdempotencyKeys:
          parsed.processedIdempotencyKeys && typeof parsed.processedIdempotencyKeys === 'object'
            ? parsed.processedIdempotencyKeys
            : {}
      };
    } catch (err) {
      console.error('[Fraud] Failed to parse fraud_db.json, initializing defaults:', err);
    }
  }
  return {
    alerts: [],
    verifiedPayments: [],
    orderAnomalies: [],
    accountWatchOverrides: {},
    linkedClusterDecisions: {},
    sensitiveActionRequests: [],
    rules: DEFAULT_RULES.map((r) => ({ ...r })),
    settings: { ...DEFAULT_SETTINGS },
    staffPermissions: {},
    processedIdempotencyKeys: {}
  };
}

let fraudDb: FraudDatabase = loadFraudDb();

function persistFraudDb() {
  if (!atomicWriteJsonFile(FRAUD_DB_FILE, fraudDb, { context: 'Fraud' })) {
    console.error('[Fraud] Failed to persist fraud_db.json');
  }
}

if (!fs.existsSync(FRAUD_DB_FILE)) {
  persistFraudDb();
}

function getEffectivePermissionsForStaff(staffId: string, role: string): Record<FraudPermissionKey, boolean> {
  if (role === 'super_admin') {
    return defaultPermissionsForRole('super_admin');
  }
  const defaults = defaultPermissionsForRole(role);
  const custom = fraudDb.staffPermissions[staffId];
  if (!custom) return defaults;
  return { ...defaults, ...custom };
}

function requireFraudPermission(
  permission: FraudPermissionKey,
  options?: { requireStepUpMfa?: boolean }
) {
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
        actionType: 'fraud_unauthorized_admin_access',
        action: 'Accès module anti-fraude refusé (rôle non admin)',
        target: req.path,
        targetType: 'permissions',
        result: 'bloque',
        severity: 'critique',
        device: authCtx.session.device,
        os: authCtx.session.os,
        browser: authCtx.session.browser,
        sessionId: authCtx.session.sessionId,
        details: 'Tentative d’accès au centre anti-fraude sans compte staff actif',
        ipAddress: getClientIp(req),
        dedupKey: `fraud-unauth:${authCtx.token.uid}:${req.path}`
      });
      return res.status(403).json({
        success: false,
        error: 'ADMIN_ROLE_REQUIRED',
        message: 'Accès réservé aux administrateurs et analystes autorisés.'
      });
    }

    const perms = getEffectivePermissionsForStaff(actor.id, actor.role);
    if (!perms[permission]) {
      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'security',
        actionType: 'fraud_permission_denied',
        action: `Permission anti-fraude refusée (${permission})`,
        target: req.path,
        targetType: 'permissions',
        result: 'refuse',
        severity: 'eleve',
        device: authCtx.session.device,
        os: authCtx.session.os,
        browser: authCtx.session.browser,
        sessionId: authCtx.session.sessionId,
        details: `${actor.name} ne dispose pas de la permission ${permission}`,
        ipAddress: getClientIp(req),
        dedupKey: `fraud-perm-denied:${actor.id}:${permission}`
      });
      return res.status(403).json({
        success: false,
        error: 'FRAUD_PERMISSION_DENIED',
        message: `Permission anti-fraude manquante (${permission}).`
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

    (req as Request & { fraudAuthCtx: AuthenticatedRequestContext }).fraudAuthCtx = authCtx;
    next();
  };
}

function scoreToRiskLevel(score: number, settings: FraudSettings = fraudDb.settings): FraudRiskLevel {
  if (score >= settings.criticalRiskScoreThreshold) return 'critique';
  if (score >= settings.highRiskScoreThreshold) return 'eleve';
  if (score >= 25) return 'moyen';
  return 'faible';
}

function getSpaceLabel(space: FraudActorSpace): string {
  switch (space) {
    case 'client':
      return 'Client';
    case 'seller':
      return 'Vendeur';
    case 'driver':
      return 'Livreur';
    case 'company':
      return 'Entreprise livraison';
    case 'admin':
      return 'Admin / Agent';
  }
}

function inferSpaceRole(raw?: string | null): FraudActorSpace {
  const s = (raw || '').toLowerCase();
  if (s === 'seller' || s === 'vendeur') return 'seller';
  if (s === 'driver' || s === 'livreur') return 'driver';
  if (s === 'company' || s === 'entreprise') return 'company';
  if (s === 'admin' || s === 'super_admin' || s === 'security_agent' || s === 'auditor') return 'admin';
  return 'client';
}

function readCreditsJson(): {
  config: { creditValueFcfa: number; minRechargeFcfa: number };
  accounts: Record<string, { balance: number; updatedAt: string }>;
  recharges: Array<{
    id: string;
    userId: string;
    amountFcfa: number;
    credits: number;
    paymentMethod: string;
    phoneNumber?: string;
    status: string;
    createdAt: string;
  }>;
  usages: Array<{
    id: string;
    idempotencyKey?: string;
    userId: string;
    serviceType: string;
    credits: number;
    amountChargedFcfa: number;
    status: string;
    createdAt: string;
  }>;
  refunds: Array<{
    id: string;
    originalUsageId: string;
    userId: string;
    credits: number;
    amountFcfa: number;
    reason: string;
    createdAt: string;
  }>;
  processedKeys: Record<string, unknown>;
} {
  try {
    if (fs.existsSync(CREDITS_DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CREDITS_DB_FILE, 'utf8'));
      return {
        config: parsed.config || { creditValueFcfa: 10, minRechargeFcfa: 3500 },
        accounts: parsed.accounts || {},
        recharges: Array.isArray(parsed.recharges) ? parsed.recharges : [],
        usages: Array.isArray(parsed.usages) ? parsed.usages : [],
        refunds: Array.isArray(parsed.refunds) ? parsed.refunds : [],
        processedKeys: parsed.processedKeys || {}
      };
    }
  } catch (err) {
    console.warn('[Fraud] Failed to read credits_billing.json:', err);
  }
  return {
    config: { creditValueFcfa: 10, minRechargeFcfa: 3500 },
    accounts: {},
    recharges: [],
    usages: [],
    refunds: [],
    processedKeys: {}
  };
}

function readOrdersAndDeliveriesJson(): {
  orders: Array<Record<string, unknown>>;
  deliveries: Array<Record<string, unknown>>;
} {
  try {
    if (fs.existsSync(DJASSA_DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DJASSA_DB_FILE, 'utf8'));
      return {
        orders: Array.isArray(parsed.orders) ? parsed.orders : [],
        deliveries: Array.isArray(parsed.deliveries) ? parsed.deliveries : []
      };
    }
  } catch {
    // ignore missing or malformed db.json
  }
  return { orders: [], deliveries: [] };
}

function buildEvidenceItem(params: {
  source: FraudEvidenceItem['source'];
  transactionRef?: string;
  orderId?: string;
  expectedAmountFcfa?: number;
  confirmedAmountFcfa?: number;
  providerResponseStatus?: string;
  summary: string;
}): FraudEvidenceItem {
  const ts = new Date().toISOString();
  const cleanSummary = scrubSecrets(params.summary);
  const hash = sha256Short(
    `${ts}|${params.source}|${params.transactionRef || ''}|${params.orderId || ''}|${cleanSummary}`
  );
  return {
    id: `ev-${crypto.randomUUID().slice(0, 10)}`,
    timestamp: ts,
    source: params.source,
    transactionRef: params.transactionRef,
    orderId: params.orderId,
    expectedAmountFcfa: params.expectedAmountFcfa,
    confirmedAmountFcfa: params.confirmedAmountFcfa,
    providerResponseStatus: params.providerResponseStatus,
    summary: cleanSummary,
    immutableHash: hash
  };
}

function ensureSystemAlert(params: {
  dedupKey: string;
  domain: FraudDomainCategory;
  ruleCode: string;
  title: string;
  description: string;
  accountId: string;
  accountLabelMasked: string;
  space: FraudActorSpace;
  amountFcfa: number;
  heldAmountFcfa?: number;
  riskScore: number;
  scoreBreakdown: FraudRiskCriterionBreakdown[];
  reasons: string[];
  linkedOrderId?: string | null;
  linkedTransactionRef?: string | null;
  appliedProtection: FraudAlertRecord['appliedProtection'];
  recommendedProtection: string;
  evidence?: FraudEvidenceItem;
  actionTypeForNotif: string;
}): { alert: FraudAlertRecord; created: boolean } {
  const existing = fraudDb.alerts.find((a) => a.ruleCode === params.ruleCode && (
    (params.linkedTransactionRef && a.linkedTransactionRef === params.linkedTransactionRef) ||
    (params.linkedOrderId && a.linkedOrderId === params.linkedOrderId) ||
    a.evidences.some((e) => e.immutableHash === params.dedupKey)
  ));
  if (existing) {
    return { alert: existing, created: false };
  }

  const nowIso = new Date().toISOString();
  const clampedScore = Math.max(0, Math.min(100, Math.round(params.riskScore)));
  const riskLevel = scoreToRiskLevel(clampedScore);
  const evidenceItem =
    params.evidence ||
    buildEvidenceItem({
      source: 'signal_technique',
      transactionRef: params.linkedTransactionRef || undefined,
      orderId: params.linkedOrderId || undefined,
      expectedAmountFcfa: params.amountFcfa,
      summary: `${params.title} — ${params.reasons.join(' ; ')}`
    });
  // Store deterministic dedup marker on immutableHash only if non-colliding
  const alert: FraudAlertRecord = {
    id: `frd-${crypto.randomUUID().slice(0, 10)}`,
    createdAt: nowIso,
    updatedAt: nowIso,
    domain: params.domain,
    ruleCode: params.ruleCode,
    title: scrubSecrets(params.title),
    description: scrubSecrets(params.description),
    accountId: params.accountId,
    accountLabelMasked: params.accountLabelMasked,
    space: params.space,
    amountFcfa: Math.max(0, Math.round(params.amountFcfa)),
    confirmedLossFcfa: 0,
    heldAmountFcfa: Math.max(0, Math.round(params.heldAmountFcfa || 0)),
    riskScore: clampedScore,
    riskLevel,
    scoreBreakdown: params.scoreBreakdown,
    reasons: params.reasons.map((r) => scrubSecrets(r)),
    status: 'nouvelle',
    isConfirmedFraud: false,
    requiresJustificatifs: riskLevel === 'eleve' || riskLevel === 'critique',
    assignedToId: null,
    assignedToName: null,
    linkedOrderId: params.linkedOrderId || null,
    linkedTransactionRef: params.linkedTransactionRef || null,
    recommendedProtection: params.recommendedProtection,
    appliedProtection: params.appliedProtection,
    notes: [],
    evidences: [
      {
        ...evidenceItem,
        immutableHash: params.dedupKey
      }
    ]
  };

  fraudDb.alerts.unshift(alert);
  if (fraudDb.alerts.length > 2000) {
    fraudDb.alerts = fraudDb.alerts.slice(0, 2000);
  }
  persistFraudDb();

  if (riskLevel !== 'faible' || fraudDb.settings.notifyOnMediumRisk) {
    const auditCategory =
      params.domain === 'retrait' || params.domain === 'portefeuille'
        ? 'wallets'
        : params.domain === 'paiement'
        ? 'payments'
        : params.domain === 'commande'
        ? 'orders'
        : 'security';

    const auditSpace: 'client' | 'seller' | 'admin' | 'system' =
      params.space === 'client' || params.space === 'seller' || params.space === 'admin'
        ? params.space
        : 'system';

    appendAuditEntry({
      actorId: 'system-fraud-engine',
      actorName: 'Moteur Anti-Fraude DJASSA',
      actorAccountLabel: params.accountLabelMasked,
      actorRole: 'system',
      space: auditSpace,
      category: auditCategory,
      actionType: params.actionTypeForNotif,
      action: `${alert.title} [${riskLevel.toUpperCase()} • ${clampedScore}/100]`,
      target: params.accountLabelMasked,
      targetType: 'finance',
      entityType: 'fraud_alert',
      entityId: alert.id,
      result: params.appliedProtection === 'blocage_operation_cible' || params.appliedProtection === 'suspension_operation' ? 'bloque' : 'reussi',
      severity: riskLevel === 'critique' ? 'critique' : riskLevel === 'eleve' ? 'eleve' : 'moyen',
      details: scrubSecrets(`${alert.reasons.join(' | ')} (Suspicion à vérifier — ne vaut pas fraude confirmée)`),
      dedupKey: params.dedupKey
    });
  }

  return { alert, created: true };
}

function buildLiveAnalytics(canViewSensitive: boolean) {
  const telemetry = getFinanceFraudTelemetrySnapshot();
  const credits = readCreditsJson();
  const market = readOrdersAndDeliveriesJson();
  const maskIfNeeded = (val: string) => (canViewSensitive ? val : maskEmailOrId(val));
  const maskCoord = (val?: string | null) =>
    canViewSensitive && !fraudDb.settings.maskSensitiveFinancialCoords ? val || null : maskFinancialCoord(val);

  // 1. Analyze Withdrawals & Payout Targets from real financeLedger
  const payoutTargetOwners = new Map<string, Set<string>>();
  Object.entries(telemetry.knownPayoutTargets).forEach(([accId, targets]) => {
    targets.forEach((t) => {
      const normalized = t.trim().toLowerCase();
      if (!normalized) return;
      if (!payoutTargetOwners.has(normalized)) payoutTargetOwners.set(normalized, new Set());
      payoutTargetOwners.get(normalized)!.add(accId);
    });
  });

  const ledgerByAccount = new Map<string, typeof telemetry.financeLedger>();
  telemetry.financeLedger.forEach((e) => {
    if (!ledgerByAccount.has(e.accountId)) ledgerByAccount.set(e.accountId, []);
    ledgerByAccount.get(e.accountId)!.push(e);
  });

  const suspiciousWithdrawals: FraudWithdrawalRecord[] = [];
  const withdrawals = telemetry.financeLedger.filter((e) => e.type === 'debit' || e.type === 'hold');

  withdrawals.forEach((w) => {
    const reasons = [...(w.suspicionReasons || [])];
    const targetNorm = (w.payoutTarget || '').trim().toLowerCase();
    const sharedOwnersCount = targetNorm ? payoutTargetOwners.get(targetNorm)?.size || 1 : 1;
    if (sharedOwnersCount > 1 && !reasons.some((r) => r.includes('partagé'))) {
      reasons.push(`Coordonnée de retrait présente sur ${sharedOwnersCount} comptes distincts (indice à vérifier)`);
    }

    const accountEntries = ledgerByAccount.get(w.accountId) || [];
    const balanceAtScan = accountEntries.reduce((sum, item) => {
      if (item.type === 'credit' && item.status === 'valide') return sum + item.amountFcfa;
      if (item.type === 'debit' && item.status !== 'rejete') return sum - item.amountFcfa;
      if (item.type === 'hold' && (item.status === 'en_attente_verification' || item.status === 'bloque_securite')) {
        return sum - item.amountFcfa;
      }
      return sum;
    }, 0);

    const payoutChangedRecently = reasons.some((r) => r.toLowerCase().includes('changement'));
    const isNewDevice = reasons.some((r) => r.toLowerCase().includes('nouvel appareil'));
    const isBurst = reasons.some((r) => r.toLowerCase().includes('répétées'));
    const isOverThreshold = w.amountFcfa > fraudDb.settings.suspiciousWithdrawalAmountFcfa;

    let riskScore = 0;
    const breakdown: FraudRiskCriterionBreakdown[] = [];
    if (payoutChangedRecently) {
      riskScore += 28;
      breakdown.push({ key: 'payout_change', label: 'Modification coordonnée', score: 28, maxScore: 30, reason: 'Nouveau bénéficiaire avant retrait' });
    }
    if (isBurst) {
      riskScore += 25;
      breakdown.push({ key: 'wd_burst', label: 'Rafale retraits', score: 25, maxScore: 30, reason: 'Plusieurs retraits rapprochés' });
    }
    if (isOverThreshold) {
      riskScore += 18;
      breakdown.push({ key: 'amount', label: 'Montant élevé', score: 18, maxScore: 25, reason: `> ${fraudDb.settings.suspiciousWithdrawalAmountFcfa.toLocaleString('fr-FR')} FCFA` });
    }
    if (isNewDevice) {
      riskScore += 18;
      breakdown.push({ key: 'device', label: 'Nouvel appareil', score: 18, maxScore: 20, reason: 'Session sur appareil non habituel' });
    }
    if (sharedOwnersCount > 1) {
      riskScore += 22;
      breakdown.push({ key: 'shared_target', label: 'Coordonnée partagée', score: 22, maxScore: 25, reason: `${sharedOwnersCount} comptes liés` });
    }
    if (w.status === 'en_attente_verification' || w.status === 'bloque_securite') {
      riskScore = Math.max(riskScore, 52);
    }

    const clamped = Math.min(100, riskScore);
    const riskLevel = scoreToRiskLevel(clamped);

    suspiciousWithdrawals.push({
      id: w.id,
      ledgerId: w.id,
      reference: w.reference,
      accountId: w.accountId,
      accountLabelMasked: maskIfNeeded(w.accountEmail || w.accountName || w.accountId),
      space: inferSpaceRole(w.spaceRole),
      amountFcfa: w.amountFcfa,
      serverBalanceAtEventFcfa: Math.max(0, balanceAtScan),
      channel: w.channel,
      payoutTargetMasked: maskCoord(w.payoutTarget || null),
      payoutTargetChangedRecently: payoutChangedRecently,
      sharedPayoutAccountsCount: sharedOwnersCount,
      isNewDevice,
      status: w.status,
      riskScore: clamped,
      riskLevel,
      suspicionReasons: reasons,
      createdAt: w.createdAt,
      reviewedBy: w.reviewedBy || null,
      reviewedAt: w.reviewedAt || null,
      reviewNote: w.reviewNote || null
    });

    if (clamped >= 45 && w.status === 'en_attente_verification') {
      ensureSystemAlert({
        dedupKey: `wd-hold:${w.id}`,
        domain: 'retrait',
        ruleCode: payoutChangedRecently ? 'WD_PAYOUT_TARGET_CHANGED' : 'WD_RAPID_BURST',
        title: `Retrait suspect mis en attente (${w.reference})`,
        description: `Opération ciblée de ${w.amountFcfa.toLocaleString('fr-FR')} FCFA via ${w.channel} soumise à contrôle sans geler le reste du portefeuille.`,
        accountId: w.accountId,
        accountLabelMasked: maskEmailOrId(w.accountEmail || w.accountId),
        space: inferSpaceRole(w.spaceRole),
        amountFcfa: w.amountFcfa,
        heldAmountFcfa: w.amountFcfa,
        riskScore: clamped,
        scoreBreakdown: breakdown,
        reasons: reasons.length > 0 ? reasons : ['Contrôle de sécurité déclenché sur le retrait'],
        linkedTransactionRef: w.reference,
        appliedProtection: 'blocage_operation_cible',
        recommendedProtection: 'Vérifier les pièces justificatives et valider via double contrôle admin avant déblocage.',
        actionTypeForNotif: 'fraud_withdrawal_suspect'
      });
    }
  });

  // 2. Analyze Real Payments (verifiedPayments + credits_billing.json recharges)
  const seenPaymentRefs = new Map<string, string[]>();
  fraudDb.verifiedPayments.forEach((p) => {
    const key = (p.transactionRef || '').trim().toUpperCase();
    if (!key) return;
    if (!seenPaymentRefs.has(key)) seenPaymentRefs.set(key, []);
    seenPaymentRefs.get(key)!.push(p.id);
  });
  credits.recharges.forEach((r) => {
    const key = (r.id || '').trim().toUpperCase();
    if (!key) return;
    if (!seenPaymentRefs.has(key)) seenPaymentRefs.set(key, []);
    seenPaymentRefs.get(key)!.push(r.id);
  });

  const allPayments: FraudPaymentRecord[] = [...fraudDb.verifiedPayments];
  credits.recharges.forEach((r) => {
    if (allPayments.some((p) => p.transactionRef === r.id)) return;
    const expected = r.credits * (credits.config.creditValueFcfa || 10);
    const mismatch = Math.abs(r.amountFcfa - expected) > 1;
    const flags: string[] = [];
    let score = 0;
    if (mismatch) {
      flags.push(`Écart montant payé (${r.amountFcfa} FCFA) vs valeur crédits (${expected} FCFA)`);
      score += 40;
    }
    if (r.status !== 'confirmed') {
      flags.push(`Statut fournisseur non confirmé (${r.status})`);
      score += 30;
    }
    allPayments.push({
      id: r.id,
      transactionRef: r.id,
      orderId: null,
      accountId: r.userId,
      accountLabelMasked: maskIfNeeded(r.userId),
      space: 'client',
      channel: r.paymentMethod,
      expectedAmountFcfa: expected,
      paidAmountFcfa: r.amountFcfa,
      providerStatus: mismatch ? 'incoherence_detectee' : 'confirme_serveur',
      providerDetail: `Recharge crédits serveur (${r.paymentMethod})`,
      status: mismatch ? 'suspect' : 'valide',
      riskScore: score,
      riskLevel: scoreToRiskLevel(score),
      anomalyFlags: flags,
      createdAt: r.createdAt
    });
  });

  // 3. Analyze Wallets Consistency (credits_billing + securityDb.financeLedger + financial_tampering intrusions)
  const walletAccountIds = new Set<string>();
  Object.keys(credits.accounts).forEach((id) => walletAccountIds.add(id));
  telemetry.financeLedger.forEach((e) => walletAccountIds.add(e.accountId));

  const walletConsistencies: FraudWalletConsistencyRecord[] = [];
  walletAccountIds.forEach((accId) => {
    const entries = telemetry.financeLedger.filter((e) => e.accountId === accId);
    const ledgerBal = entries.reduce((sum, item) => {
      if (item.type === 'credit' && item.status === 'valide') return sum + item.amountFcfa;
      if (item.type === 'debit' && item.status !== 'rejete') return sum - item.amountFcfa;
      if (item.type === 'hold' && (item.status === 'en_attente_verification' || item.status === 'bloque_securite')) {
        return sum - item.amountFcfa;
      }
      return sum;
    }, 0);
    const pendingHoldsFcfa = entries
      .filter((e) => e.type === 'hold' && (e.status === 'en_attente_verification' || e.status === 'bloque_securite'))
      .reduce((s, e) => s + e.amountFcfa, 0);

    const creditAcc = credits.accounts[accId];
    const creditsWalletFcfa = creditAcc ? creditAcc.balance * (credits.config.creditValueFcfa || 10) : null;
    const expectedCreditsFromBilling = creditAcc
      ? credits.recharges.filter((r) => r.userId === accId && r.status === 'confirmed').reduce((s, r) => s + r.credits, 0) -
        credits.usages.filter((u) => u.userId === accId && u.status === 'success').reduce((s, u) => s + u.credits, 0)
      : null;

    const directEditAttempts = telemetry.intrusions.filter(
      (i) => i.threatType === 'financial_tampering' && i.targetAccountOrResource.toLowerCase() === accId.toLowerCase()
    );
    const refCounts = new Map<string, number>();
    entries.forEach((e) => {
      refCounts.set(e.reference, (refCounts.get(e.reference) || 0) + 1);
    });
    const duplicateRefCount = Array.from(refCounts.values()).filter((c) => c > 1).length;

    const anomalyReasons: string[] = [];
    if (ledgerBal < 0) {
      anomalyReasons.push(`Solde négatif anormal calculé sur registre (${ledgerBal.toLocaleString('fr-FR')} FCFA)`);
    }
    if (directEditAttempts.length > 0) {
      anomalyReasons.push(`${directEditAttempts.length} tentative(s) bloquée(s) de modification directe de solde`);
    }
    if (duplicateRefCount > 0) {
      anomalyReasons.push(`${duplicateRefCount} référence(s) en doublon détectée(s) dans le registre`);
    }
    // Note: seed baseline credits (350 or 450 initial credits) in credits_billing are expected if no recharges existed
    if (creditAcc && creditAcc.balance < 0) {
      anomalyReasons.push('Solde crédits négatif anormal');
    }

    const consistencyStatus: FraudWalletConsistencyRecord['consistencyStatus'] =
      ledgerBal < 0 || directEditAttempts.length > 0 || duplicateRefCount > 0
        ? 'anomalie_critique'
        : anomalyReasons.length > 0
        ? 'ecart_detecte'
        : 'coherent';

    const sample = entries[0];
    walletConsistencies.push({
      accountId: accId,
      accountLabelMasked: maskIfNeeded(sample?.accountEmail || accId),
      space: inferSpaceRole(sample?.spaceRole || (creditAcc ? 'client' : 'seller')),
      ledgerBalanceFcfa: ledgerBal,
      creditsWalletFcfa,
      pendingHoldsFcfa,
      creditsCount: entries.filter((e) => e.type === 'credit').length,
      debitsCount: entries.filter((e) => e.type === 'debit' || e.type === 'hold').length,
      directEditAttemptsCount: directEditAttempts.length,
      duplicateRefCount,
      consistencyStatus,
      anomalyReasons,
      lastUpdatedAt: sample?.createdAt || creditAcc?.updatedAt || null
    });

    if (directEditAttempts.length > 0) {
      const latestTamper = directEditAttempts[0];
      ensureSystemAlert({
        dedupKey: `wallet-tamper:${latestTamper.id}`,
        domain: 'portefeuille',
        ruleCode: 'WALLET_DIRECT_TAMPER_OR_GAP',
        title: `Tentative d’altération directe de portefeuille (${maskEmailOrId(accId)})`,
        description: `Tentative bloquée de contournement du registre comptable serveur sur le compte ${maskEmailOrId(accId)}.`,
        accountId: accId,
        accountLabelMasked: maskEmailOrId(accId),
        space: inferSpaceRole(sample?.spaceRole),
        amountFcfa: 0,
        riskScore: 88,
        scoreBreakdown: [
          { key: 'tamper', label: 'Altération registre', score: 45, maxScore: 50, reason: latestTamper.threatLabel },
          { key: 'history', label: 'Incident critique', score: 43, maxScore: 50, reason: `${directEditAttempts.length} tentative(s) détectée(s)` }
        ],
        reasons: anomalyReasons,
        appliedProtection: 'suspension_operation',
        recommendedProtection: 'Auditer le journal comptable et exiger une double validation pour toute opération sensible.',
        actionTypeForNotif: 'fraud_wallet_tamper'
      });
    }

    void expectedCreditsFromBilling;
  });

  // 4. Analyze Order & Delivery Fraud from real db.json + submitted order anomalies
  const orderAnomalies: FraudOrderAnomalyRecord[] = [...fraudDb.orderAnomalies];
  const podHashesSeen = new Map<string, string>();
  market.orders.forEach((o) => {
    const orderId = String(o.id || '');
    if (!orderId || orderAnomalies.some((oa) => oa.orderId === orderId)) return;
    const deliveryProof = String(o.deliveryProofImage || o.proofImage || o.podUrl || '');
    const deliveryStatus = String(o.deliveryStatus || o.status || 'en_cours');
    const paymentStatus = String(o.paymentStatus || 'inconnu');
    const amountFcfa = Number(o.totalFcfa || o.total || 0);
    const anomalies: string[] = [];
    let score = 0;

    if (deliveryProof) {
      const hash = sha256Short(deliveryProof);
      const firstOrder = podHashesSeen.get(hash);
      if (firstOrder && firstOrder !== orderId) {
        anomalies.push(`Justificatif identique déjà associé à la commande ${firstOrder}`);
        score += 45;
      } else {
        podHashesSeen.set(hash, orderId);
      }
    }

    if (anomalies.length > 0) {
      orderAnomalies.push({
        id: `ord-anm-${orderId}`,
        orderId,
        transactionRef: o.paymentRef ? String(o.paymentRef) : null,
        buyerMasked: maskIfNeeded(String(o.clientId || o.buyerName || 'client')),
        sellerMasked: maskIfNeeded(String(o.sellerId || o.sellerName || 'vendeur')),
        driverOrCompanyMasked: null,
        amountFcfa,
        expectedAmountFcfa: amountFcfa,
        paymentStatus,
        deliveryStatus,
        hasDeliveryProof: Boolean(deliveryProof),
        reusedProofDetected: anomalies.some((a) => a.includes('identique')),
        postPaymentModified: false,
        commissionFcfa: Number(o.commissionFcfa || 0),
        riskScore: Math.min(100, score),
        riskLevel: scoreToRiskLevel(score),
        anomalyTypes: anomalies,
        status: 'a_verifier',
        createdAt: String(o.createdAt || new Date().toISOString())
      });
    }
  });

  // 5. Analyze Linked Accounts Clusters (purely analytical indices, NEVER auto-accusing)
  const linkedClusters: FraudLinkedAccountsCluster[] = [];
  payoutTargetOwners.forEach((ownersSet, targetNorm) => {
    if (ownersSet.size >= 2) {
      const owners = Array.from(ownersSet);
      const clusterId = `lnk-pay-${sha256Short(targetNorm)}`;
      const override = fraudDb.linkedClusterDecisions[clusterId];
      linkedClusters.push({
        id: clusterId,
        clusterType: 'coordonnee_retrait_partagee',
        signalSummary: `${owners.length} comptes partagent la même coordonnée de retrait enregistrée.`,
        sharedIndicatorMasked: maskFinancialCoord(targetNorm) || '***',
        accounts: owners.map((id) => {
          const entry = ledgerByAccount.get(id)?.[0];
          const watch = fraudDb.accountWatchOverrides[id]?.watchStatus || 'surveillance_renforcee';
          return {
            accountId: id,
            accountLabelMasked: maskIfNeeded(entry?.accountEmail || id),
            space: inferSpaceRole(entry?.spaceRole),
            watchStatus: watch
          };
        }),
        riskScore: Math.min(100, 35 + owners.length * 15),
        riskLevel: scoreToRiskLevel(35 + owners.length * 15),
        verificationStatus: override?.verificationStatus || 'indice_a_verifier',
        disclaimer: 'Indice technique/financier à vérifier par l’équipe — aucune conclusion automatique de fraude.',
        detectedAt: new Date().toISOString()
      });
    }
  });

  // Shared IP across distinct userIds in active/recent sessions (excluding localhost loopback if only local dev unless multiple non-admin accounts)
  const ipToUsers = new Map<string, Set<string>>();
  telemetry.sessions.forEach((s) => {
    if (!s.ipAddress || s.ipAddress === '127.0.0.1' || s.ipAddress === '::1') return;
    if (!ipToUsers.has(s.ipAddress)) ipToUsers.set(s.ipAddress, new Set());
    ipToUsers.get(s.ipAddress)!.add(s.userEmail || s.userId);
  });
  ipToUsers.forEach((usersSet, ipAddr) => {
    if (usersSet.size >= 2) {
      const owners = Array.from(usersSet);
      const clusterId = `lnk-ip-${sha256Short(ipAddr)}`;
      const override = fraudDb.linkedClusterDecisions[clusterId];
      linkedClusters.push({
        id: clusterId,
        clusterType: 'signature_technique_commune',
        signalSummary: `${owners.length} comptes distincts ont opéré depuis la même adresse réseau.`,
        sharedIndicatorMasked: maskFinancialCoord(ipAddr) || 'IP ***',
        accounts: owners.map((email) => {
          const ses = telemetry.sessions.find((s) => s.userEmail === email || s.userId === email);
          return {
            accountId: ses?.userId || email,
            accountLabelMasked: maskIfNeeded(email),
            space: inferSpaceRole(ses?.spaceRole || ses?.accountType),
            watchStatus: fraudDb.accountWatchOverrides[ses?.userId || email]?.watchStatus || 'normal'
          };
        }),
        riskScore: Math.min(100, 28 + owners.length * 12),
        riskLevel: scoreToRiskLevel(28 + owners.length * 12),
        verificationStatus: override?.verificationStatus || 'indice_a_verifier',
        disclaimer: 'Partage réseau/appareil constaté (peut être familial/boutique) — vérification humaine requise.',
        detectedAt: new Date().toISOString()
      });
    }
  });

  // 6. Build 5-Space Accounts Under Watch Directory
  const accountsMap = new Map<string, FraudAccountWatchRecord>();
  const touchAccount = (id: string, emailOrName: string, space: FraudActorSpace) => {
    if (!accountsMap.has(id)) {
      const override = fraudDb.accountWatchOverrides[id];
      const payoutTargets = telemetry.knownPayoutTargets[id] || [];
      accountsMap.set(id, {
        accountId: id,
        accountLabelMasked: maskIfNeeded(emailOrName || id),
        space,
        spaceLabel: getSpaceLabel(space),
        watchStatus: override?.watchStatus || 'normal',
        operationsCount: 0,
        paymentsCount: 0,
        withdrawalsCount: 0,
        payoutTargetChangesCount: Math.max(0, payoutTargets.length - 1),
        payoutTargetMasked: payoutTargets.length > 0 ? maskCoord(payoutTargets[payoutTargets.length - 1]) : null,
        alertsCount: 0,
        maxRiskScore: 0,
        lastActivityAt: null,
        walletBalanceFcfa: 0,
        watchReason: override?.watchReason || null
      });
    }
    return accountsMap.get(id)!;
  };

  telemetry.sessions.forEach((s) => {
    const rec = touchAccount(s.userId, s.userEmail || s.userName, inferSpaceRole(s.spaceRole || s.accountType));
    if (!rec.lastActivityAt || s.lastActivityAt > rec.lastActivityAt) rec.lastActivityAt = s.lastActivityAt;
  });

  walletConsistencies.forEach((w) => {
    const rec = touchAccount(w.accountId, w.accountLabelMasked, w.space);
    rec.walletBalanceFcfa = w.creditsWalletFcfa ?? w.ledgerBalanceFcfa;
    rec.operationsCount += w.creditsCount + w.debitsCount;
    if (w.consistencyStatus === 'anomalie_critique') {
      rec.maxRiskScore = Math.max(rec.maxRiskScore, 85);
      if (rec.watchStatus === 'normal') rec.watchStatus = 'surveillance_renforcee';
    }
  });

  allPayments.forEach((p) => {
    const rec = touchAccount(p.accountId, p.accountLabelMasked, p.space);
    rec.paymentsCount += 1;
    rec.operationsCount += 1;
    rec.maxRiskScore = Math.max(rec.maxRiskScore, p.riskScore);
    if (!rec.lastActivityAt || p.createdAt > rec.lastActivityAt) rec.lastActivityAt = p.createdAt;
  });

  suspiciousWithdrawals.forEach((w) => {
    const rec = touchAccount(w.accountId, w.accountLabelMasked, w.space);
    rec.withdrawalsCount += 1;
    rec.operationsCount += 1;
    rec.maxRiskScore = Math.max(rec.maxRiskScore, w.riskScore);
    if (w.payoutTargetChangedRecently) rec.payoutTargetChangesCount += 1;
    if (w.status === 'en_attente_verification' && rec.watchStatus === 'normal') {
      rec.watchStatus = 'verification_requise';
    }
  });

  fraudDb.alerts.forEach((a) => {
    const rec = touchAccount(a.accountId, a.accountLabelMasked, a.space);
    rec.alertsCount += 1;
    rec.maxRiskScore = Math.max(rec.maxRiskScore, a.riskScore);
    if ((a.riskLevel === 'eleve' || a.riskLevel === 'critique') && a.status !== 'suspicion_ecartee' && a.status !== 'cloturee') {
      if (rec.watchStatus === 'normal') rec.watchStatus = 'surveillance_renforcee';
    }
  });

  const accountsWatch = Array.from(accountsMap.values()).sort((a, b) => b.maxRiskScore - a.maxRiskScore || b.alertsCount - a.alertsCount);

  // 7. Compute Dashboard KPIs from REAL records only
  const suspiciousPayments = allPayments.filter((p) => p.status !== 'valide' || p.riskScore >= 25);
  const flaggedWithdrawals = suspiciousWithdrawals.filter((w) => w.status !== 'valide' || w.riskScore >= 25);
  const blockedOperations = suspiciousWithdrawals.filter(
    (w) => w.status === 'en_attente_verification' || w.status === 'bloque_securite'
  );

  const openOrActiveAlerts = fraudDb.alerts.filter(
    (a) => a.status !== 'cloturee' && a.status !== 'suspicion_ecartee'
  );
  const confirmedFraudAlerts = fraudDb.alerts.filter((a) => a.isConfirmedFraud || a.status === 'fraude_confirmee');
  const pendingAlerts = fraudDb.alerts.filter(
    (a) => a.status === 'nouvelle' || a.status === 'en_cours' || a.status === 'en_attente_justificatifs'
  );

  const byRiskLevel: Record<FraudRiskLevel, number> = { faible: 0, moyen: 0, eleve: 0, critique: 0 };
  fraudDb.alerts.forEach((a) => {
    byRiskLevel[a.riskLevel] = (byRiskLevel[a.riskLevel] || 0) + 1;
  });

  const kpis: FraudDashboardKpis = {
    monitoredTransactionsCount: allPayments.length + suspiciousWithdrawals.length,
    suspiciousOperationsCount:
      suspiciousPayments.length +
      flaggedWithdrawals.length +
      orderAnomalies.length +
      walletConsistencies.filter((w) => w.consistencyStatus !== 'coherent').length,
    confirmedFraudsCount: confirmedFraudAlerts.length,
    pendingAlertsCount: pendingAlerts.length,
    totalSuspiciousAmountFcfa:
      suspiciousPayments.reduce((s, p) => s + p.paidAmountFcfa, 0) +
      flaggedWithdrawals.reduce((s, w) => s + w.amountFcfa, 0) +
      openOrActiveAlerts
        .filter((a) => a.domain === 'commande')
        .reduce((s, a) => s + a.amountFcfa, 0),
    confirmedFinancialLossFcfa: confirmedFraudAlerts.reduce((s, a) => s + (a.confirmedLossFcfa || a.amountFcfa), 0),
    temporarilyBlockedAmountFcfa: blockedOperations.reduce((s, b) => s + b.amountFcfa, 0),
    accountsUnderWatchCount: accountsWatch.filter((acc) => acc.watchStatus !== 'normal').length,
    lastDetectionAt: fraudDb.alerts[0]?.createdAt || flaggedWithdrawals[0]?.createdAt || null,
    byRiskLevel,
    pendingDualValidationsCount: fraudDb.sensitiveActionRequests.filter(
      (r) => r.status === 'en_attente_second_valideur'
    ).length
  };

  return {
    kpis,
    accountsWatch,
    suspiciousPayments: allPayments,
    suspiciousWithdrawals,
    walletConsistencies,
    orderAnomalies,
    linkedClusters,
    blockedOperations
  };
}

export function installFraudRoutes(app: Express) {
  app.get('/api/fraud/overview', requireFraudPermission('viewFraudDashboard'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { fraudAuthCtx: AuthenticatedRequestContext }).fraudAuthCtx;
    const actor = authCtx.staff!;
    const perms = getEffectivePermissionsForStaff(actor.id, actor.role);
    const analytics = buildLiveAnalytics(perms.viewSensitiveFraudDetails);
    const staffDirectory = getSecurityStaffDirectory();

    const staffPermissions: FraudStaffPermissionRow[] = staffDirectory.map((s) => ({
      staffId: s.id,
      name: s.name,
      email: s.email,
      role: s.role,
      title: s.title,
      active: s.active,
      mfaEnabled: s.mfaEnabled,
      permissions: getEffectivePermissionsForStaff(s.id, s.role)
    }));

    const dualControlAvailableAdminsCount = staffPermissions.filter(
      (s) => s.active && s.permissions.approveDualControlAction
    ).length;

    const payload: FraudOverviewResponse = {
      success: true,
      generatedAt: new Date().toISOString(),
      actor: {
        staffId: actor.id,
        name: actor.name,
        role: actor.role,
        permissions: perms
      },
      providerIntegration: {
        geniusPayConfigured: Boolean(process.env.GENIUSPAY_API_KEY),
        externalVerificationMode: process.env.GENIUSPAY_API_KEY
          ? 'API GeniusPay configurée (vérification directe serveur)'
          : 'Clé API GeniusPay externe absente — vérifications externes marquées non_verifie_externe (aucune confirmation inventée)',
        dualControlAvailableAdminsCount
      },
      kpis: analytics.kpis,
      accountsWatch: analytics.accountsWatch,
      suspiciousPayments: analytics.suspiciousPayments,
      suspiciousWithdrawals: analytics.suspiciousWithdrawals,
      walletConsistencies: analytics.walletConsistencies,
      orderAnomalies: analytics.orderAnomalies,
      linkedClusters: analytics.linkedClusters,
      alerts: fraudDb.alerts.map((a) => ({
        ...a,
        accountLabelMasked: perms.viewSensitiveFraudDetails ? a.accountLabelMasked : maskEmailOrId(a.accountId)
      })),
      blockedOperations: analytics.blockedOperations,
      sensitiveActionRequests: fraudDb.sensitiveActionRequests,
      historyAlerts: fraudDb.alerts.filter(
        (a) =>
          a.status === 'fraude_confirmee' ||
          a.status === 'suspicion_ecartee' ||
          a.status === 'cloturee' ||
          a.status === 'transmise_decision'
      ),
      rules: fraudDb.rules,
      settings: fraudDb.settings,
      staffPermissions
    };

    res.json(payload);
  });

  // Server-side idempotent payment verification & fraud check
  app.post('/api/fraud/payments/verify', requireFraudPermission('manageInvestigations'), async (req: Request, res: Response) => {
    const authCtx = (req as Request & { fraudAuthCtx: AuthenticatedRequestContext }).fraudAuthCtx;
    const actor = authCtx.staff!;
    const {
      transactionRef,
      orderId,
      accountId,
      space = 'client',
      channel = 'wave',
      expectedAmountFcfa,
      paidAmountFcfa,
      clientClaimedSuccess = false,
      screenshotOnly = false,
      failedAttemptsRecent = 0,
      idempotencyKey
    } = req.body || {};

    const cleanRef = String(transactionRef || '').trim();
    if (!cleanRef) {
      return res.status(400).json({ success: false, error: 'REFERENCE_REQUIRED', message: 'Référence de transaction requise.' });
    }

    const idemKey = String(idempotencyKey || req.header('x-idempotency-key') || '').trim();
    if (idemKey && fraudDb.processedIdempotencyKeys[idemKey]) {
      const existingPayment = fraudDb.verifiedPayments.find((p) => p.idempotencyKey === idemKey);
      if (existingPayment) {
        return res.json({ success: true, idempotentDuplicate: true, payment: existingPayment });
      }
    }

    const expected = Number(expectedAmountFcfa);
    const paid = Number(paidAmountFcfa);
    const cleanAccountId = String(accountId || 'client-inconnu').trim();
    const cleanOrderId = orderId ? String(orderId).trim() : null;
    const credits = readCreditsJson();
    const market = readOrdersAndDeliveriesJson();

    const anomalyFlags: string[] = [];
    const breakdown: FraudRiskCriterionBreakdown[] = [];
    let riskScore = 0;

    // 1. Check duplicate reference across verifiedPayments and credits_billing.json
    const refAlreadyInFraud = fraudDb.verifiedPayments.some(
      (p) => p.transactionRef.toUpperCase() === cleanRef.toUpperCase()
    );
    const refAlreadyInCredits = credits.recharges.some((r) => r.id.toUpperCase() === cleanRef.toUpperCase());
    if (refAlreadyInFraud || refAlreadyInCredits) {
      anomalyFlags.push(`Référence ${cleanRef} déjà utilisée sur une autre opération (réutilisation bloquée)`);
      riskScore += 35;
      breakdown.push({ key: 'reused_ref', label: 'Référence dupliquée', score: 35, maxScore: 35, reason: 'Transaction déjà enregistrée' });
    }

    // 2. Duplicate payment on same order
    if (cleanOrderId && fraudDb.verifiedPayments.some((p) => p.orderId === cleanOrderId && p.status === 'valide')) {
      anomalyFlags.push(`Double paiement détecté sur la commande ${cleanOrderId}`);
      riskScore += 30;
      breakdown.push({ key: 'dup_order', label: 'Double paiement commande', score: 30, maxScore: 35, reason: `Commande ${cleanOrderId} déjà payée` });
    }

    // 3. Order existence check (when local orders collection is populated)
    if (cleanOrderId && market.orders.length > 0 && !market.orders.some((o) => String(o.id) === cleanOrderId)) {
      anomalyFlags.push(`Paiement soumis pour une commande inexistante (${cleanOrderId})`);
      riskScore += 30;
      breakdown.push({ key: 'missing_order', label: 'Commande inexistante', score: 30, maxScore: 30, reason: cleanOrderId });
    }

    // 4. Expected vs paid amount mismatch
    if (Number.isFinite(expected) && Number.isFinite(paid) && Math.abs(expected - paid) > 1) {
      anomalyFlags.push(`Incohérence de montant : payé ${paid.toLocaleString('fr-FR')} FCFA vs attendu ${expected.toLocaleString('fr-FR')} FCFA`);
      riskScore += 35;
      breakdown.push({ key: 'mismatch', label: 'Écart montant', score: 35, maxScore: 35, reason: `${paid} vs ${expected} FCFA` });
    }

    // 5. Repeated failed payments
    const failures = Number(failedAttemptsRecent) || 0;
    if (failures >= fraudDb.settings.failedPaymentBurstMaxIn30Min) {
      anomalyFlags.push(`${failures} tentatives échouées récentes avant soumission`);
      riskScore += 18;
      breakdown.push({ key: 'failures', label: 'Échecs répétés', score: 18, maxScore: 25, reason: `${failures} échecs` });
    }

    // 6. Never trust browser-only success claim or screenshot alone — verify provider truthfully via GeniusPay
    let providerStatus: FraudPaymentRecord['providerStatus'] = 'non_verifie_externe';
    let providerDetail = 'Vérification fournisseur externe impossible : GENIUSPAY_API_KEY non configurée sur le serveur.';

    if (screenshotOnly || (clientClaimedSuccess && !process.env.GENIUSPAY_API_KEY)) {
      anomalyFlags.push('Preuve navigateur ou capture d’écran non suffisante sans confirmation directe du fournisseur');
      riskScore += 32;
      providerStatus = 'preuve_non_fiable';
      providerDetail = 'Rejet préventif : aucune confirmation directe du fournisseur ou du registre serveur.';
      breakdown.push({ key: 'unreliable_proof', label: 'Preuve non fiable', score: 32, maxScore: 35, reason: 'Preuve client seule refusée' });
    } else if (process.env.GENIUSPAY_API_KEY) {
      try {
        const gpBase = (process.env.GENIUSPAY_BASE_URL || 'https://api.geniuspay.ci/v1').trim().replace(/\/+$/, '');
        const resp = await fetch(`${gpBase}/payments/${encodeURIComponent(cleanRef)}`, {
          headers: { Authorization: `Bearer ${process.env.GENIUSPAY_API_KEY}` },
          signal: AbortSignal.timeout(8000)
        });
        if (resp.ok) {
          const data = (await resp.json()) as { status?: string };
          const st = String(data?.status || '').toUpperCase();
          if (st === 'COMPLETED' || st === 'CONFIRMED' || st === 'PAID' || st === 'SUCCEEDED' || st === 'SUCCESS') {
            providerStatus = 'confirme_serveur';
            providerDetail = 'Confirmé directement via API GeniusPay.';
          } else {
            providerStatus = 'echec_fournisseur';
            providerDetail = `Statut GeniusPay : ${data?.status || 'INCONNU'}`;
            anomalyFlags.push(`Fournisseur indique statut ${data?.status || 'INCONNU'}`);
            riskScore += 35;
          }
        } else {
          providerStatus = 'echec_fournisseur';
          providerDetail = `Réponse API GeniusPay HTTP ${resp.status}`;
          anomalyFlags.push(`Vérification fournisseur refusée (HTTP ${resp.status})`);
          riskScore += 25;
        }
      } catch {
        providerStatus = 'non_verifie_externe';
        providerDetail = 'Erreur réseau lors de la vérification GeniusPay.';
      }
    }

    if (anomalyFlags.some((f) => f.includes('Incohérence'))) {
      providerStatus = 'incoherence_detectee';
    }

    const clampedScore = Math.min(100, riskScore);
    const riskLevel = scoreToRiskLevel(clampedScore);
    const paymentStatus: FraudPaymentRecord['status'] =
      riskLevel === 'critique' ? 'bloque' : anomalyFlags.length > 0 ? 'suspect' : providerStatus === 'confirme_serveur' ? 'valide' : 'suspect';

    const paymentRecord: FraudPaymentRecord = {
      id: `paychk-${crypto.randomUUID().slice(0, 10)}`,
      transactionRef: cleanRef,
      orderId: cleanOrderId,
      accountId: cleanAccountId,
      accountLabelMasked: maskEmailOrId(cleanAccountId),
      space: inferSpaceRole(space),
      channel: String(channel),
      expectedAmountFcfa: Number.isFinite(expected) ? expected : 0,
      paidAmountFcfa: Number.isFinite(paid) ? paid : 0,
      providerStatus,
      providerDetail,
      status: paymentStatus,
      riskScore: clampedScore,
      riskLevel,
      anomalyFlags,
      createdAt: new Date().toISOString(),
      idempotencyKey: idemKey || undefined
    };

    fraudDb.verifiedPayments.unshift(paymentRecord);
    if (idemKey) {
      fraudDb.processedIdempotencyKeys[idemKey] = {
        at: paymentRecord.createdAt,
        summary: `Vérification paiement ${cleanRef}`
      };
    }
    persistFraudDb();

    let createdAlert: FraudAlertRecord | null = null;
    if (anomalyFlags.length > 0) {
      const { alert } = ensureSystemAlert({
        dedupKey: `pay-verify:${cleanRef}:${paymentRecord.id}`,
        domain: 'paiement',
        ruleCode: anomalyFlags.some((f) => f.includes('montant')) ? 'PAY_AMOUNT_MISMATCH' : 'PAY_UNRELIABLE_CLIENT_CLAIM',
        title: `Paiement suspect détecté (${cleanRef})`,
        description: `Contrôle serveur sur ${cleanRef} : ${anomalyFlags.join(' ; ')}`,
        accountId: cleanAccountId,
        accountLabelMasked: maskEmailOrId(cleanAccountId),
        space: inferSpaceRole(space),
        amountFcfa: Number.isFinite(paid) ? paid : expected || 0,
        heldAmountFcfa: paymentStatus === 'bloque' ? (Number.isFinite(paid) ? paid : expected || 0) : 0,
        riskScore: clampedScore,
        scoreBreakdown: breakdown,
        reasons: anomalyFlags,
        linkedOrderId: cleanOrderId,
        linkedTransactionRef: cleanRef,
        appliedProtection: paymentStatus === 'bloque' ? 'blocage_operation_cible' : 'verification_supplementaire',
        recommendedProtection: 'Ne pas créditer ni expédier avant confirmation serveur vérifiée.',
        evidence: buildEvidenceItem({
          source: 'fournisseur_paiement',
          transactionRef: cleanRef,
          orderId: cleanOrderId || undefined,
          expectedAmountFcfa: Number.isFinite(expected) ? expected : undefined,
          confirmedAmountFcfa: Number.isFinite(paid) ? paid : undefined,
          providerResponseStatus: `${providerStatus} (${providerDetail})`,
          summary: `Contrôle déclenché par ${actor.name} : ${anomalyFlags.join(' | ')}`
        }),
        actionTypeForNotif: 'fraud_payment_mismatch'
      });
      createdAlert = alert;
    }

    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'payments',
      actionType: anomalyFlags.length > 0 ? 'fraud_payment_mismatch' : 'fraud_payment_verified',
      action: anomalyFlags.length > 0 ? `Anomalie paiement signalée (${cleanRef})` : `Contrôle paiement effectué (${cleanRef})`,
      target: maskEmailOrId(cleanAccountId),
      targetType: 'finance',
      entityType: 'payment',
      entityId: cleanRef,
      result: paymentStatus === 'bloque' ? 'bloque' : 'reussi',
      severity: riskLevel === 'critique' ? 'critique' : anomalyFlags.length > 0 ? 'eleve' : 'information',
      details: scrubSecrets(anomalyFlags.length > 0 ? anomalyFlags.join(' ; ') : providerDetail),
      ipAddress: getClientIp(req),
      dedupKey: `pay-audit:${cleanRef}:${paymentRecord.id}`
    });

    res.json({
      success: true,
      payment: paymentRecord,
      alert: createdAlert
    });
  });

  // Server-side order / delivery / commission fraud analysis
  app.post('/api/fraud/orders/verify', requireFraudPermission('manageInvestigations'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { fraudAuthCtx: AuthenticatedRequestContext }).fraudAuthCtx;
    const actor = authCtx.staff!;
    const {
      orderId,
      transactionRef,
      buyerId = 'client',
      sellerId = 'vendeur',
      driverOrCompanyId = null,
      amountFcfa,
      expectedAmountFcfa,
      commissionFcfa = 0,
      paymentStatus = 'inconnu',
      deliveryStatus = 'en_cours',
      hasDeliveryProof = true,
      deliveryProofHash,
      postPaymentModified = false,
      unjustifiedRefund = false,
      repeatedPostPaymentCancel = false
    } = req.body || {};

    const cleanOrderId = String(orderId || '').trim();
    if (!cleanOrderId) {
      return res.status(400).json({ success: false, error: 'ORDER_ID_REQUIRED', message: 'Identifiant de commande requis.' });
    }

    const amt = Number(amountFcfa) || 0;
    const exp = expectedAmountFcfa !== undefined ? Number(expectedAmountFcfa) : amt;
    const comm = Number(commissionFcfa) || 0;
    const anomalyTypes: string[] = [];
    const breakdown: FraudRiskCriterionBreakdown[] = [];
    let score = 0;

    let reusedProofDetected = false;
    if (deliveryProofHash) {
      const prior = fraudDb.orderAnomalies.find(
        (o) => o.orderId !== cleanOrderId && o.id.includes(String(deliveryProofHash).slice(0, 8))
      );
      if (prior) {
        reusedProofDetected = true;
        anomalyTypes.push(`Preuve de livraison réutilisée (déjà vue sur ${prior.orderId})`);
        score += 35;
        breakdown.push({ key: 'pod_reuse', label: 'Preuve POD réutilisée', score: 35, maxScore: 35, reason: prior.orderId });
      }
    }

    if (!hasDeliveryProof && String(deliveryStatus).toLowerCase().includes('livr')) {
      anomalyTypes.push('Livraison marquée effectuée sans preuve POD attendue');
      score += 30;
      breakdown.push({ key: 'missing_pod', label: 'POD absente', score: 30, maxScore: 30, reason: 'Preuve manquante' });
    }
    if (postPaymentModified || Math.abs(amt - exp) > 1) {
      anomalyTypes.push(`Modification suspecte du montant après paiement (${amt} vs ${exp} FCFA)`);
      score += 30;
      breakdown.push({ key: 'post_edit', label: 'Édition post-paiement', score: 30, maxScore: 30, reason: `${amt} vs ${exp} FCFA` });
    }
    if (unjustifiedRefund) {
      anomalyTypes.push('Demande ou exécution de remboursement sans justification valide');
      score += 25;
      breakdown.push({ key: 'refund', label: 'Remboursement suspect', score: 25, maxScore: 25, reason: 'Motif insuffisant' });
    }
    if (repeatedPostPaymentCancel) {
      anomalyTypes.push('Annulations répétées après paiement (suspicion schéma fictif / commission)');
      score += 28;
      breakdown.push({ key: 'cancel_loop', label: 'Annulations répétées', score: 28, maxScore: 30, reason: 'Schéma répétitif' });
    }
    if (amt > 0 && comm > amt * 0.45) {
      anomalyTypes.push(`Anomalie de commission anormalement élevée (${comm.toLocaleString('fr-FR')} FCFA sur ${amt.toLocaleString('fr-FR')} FCFA)`);
      score += 22;
      breakdown.push({ key: 'commission', label: 'Commission anormale', score: 22, maxScore: 25, reason: `${comm} FCFA` });
    }

    const clamped = Math.min(100, score);
    const riskLevel = scoreToRiskLevel(clamped);
    const record: FraudOrderAnomalyRecord = {
      id: `ord-${deliveryProofHash ? String(deliveryProofHash).slice(0, 8) + '-' : ''}${crypto.randomUUID().slice(0, 8)}`,
      orderId: cleanOrderId,
      transactionRef: transactionRef ? String(transactionRef) : null,
      buyerMasked: maskEmailOrId(String(buyerId)),
      sellerMasked: maskEmailOrId(String(sellerId)),
      driverOrCompanyMasked: driverOrCompanyId ? maskEmailOrId(String(driverOrCompanyId)) : null,
      amountFcfa: amt,
      expectedAmountFcfa: exp,
      paymentStatus: String(paymentStatus),
      deliveryStatus: String(deliveryStatus),
      hasDeliveryProof: Boolean(hasDeliveryProof),
      reusedProofDetected,
      postPaymentModified: Boolean(postPaymentModified || Math.abs(amt - exp) > 1),
      commissionFcfa: comm,
      riskScore: clamped,
      riskLevel,
      anomalyTypes,
      status: anomalyTypes.length > 0 ? 'a_verifier' : 'ecarte',
      createdAt: new Date().toISOString()
    };

    fraudDb.orderAnomalies.unshift(record);
    persistFraudDb();

    let createdAlert: FraudAlertRecord | null = null;
    if (anomalyTypes.length > 0) {
      const { alert } = ensureSystemAlert({
        dedupKey: `order-anm:${cleanOrderId}:${record.id}`,
        domain: 'commande',
        ruleCode: reusedProofDetected || !hasDeliveryProof ? 'ORDER_REUSED_OR_MISSING_POD' : 'ORDER_POST_PAYMENT_MODIFICATION',
        title: `Anomalie financière sur commande ${cleanOrderId}`,
        description: `Liée à commande ${cleanOrderId}${transactionRef ? ` / réf ${transactionRef}` : ''} : ${anomalyTypes.join(' ; ')}`,
        accountId: String(sellerId || buyerId),
        accountLabelMasked: maskEmailOrId(String(sellerId || buyerId)),
        space: 'seller',
        amountFcfa: amt,
        heldAmountFcfa: 0,
        riskScore: clamped,
        scoreBreakdown: breakdown,
        reasons: anomalyTypes,
        linkedOrderId: cleanOrderId,
        linkedTransactionRef: transactionRef ? String(transactionRef) : null,
        appliedProtection: clamped >= 75 ? 'verification_supplementaire' : 'surveillance_renforcee',
        recommendedProtection: 'Croiser le justificatif, la confirmation paiement et l’historique vendeur avant sanction.',
        evidence: buildEvidenceItem({
          source: 'controle_commande',
          orderId: cleanOrderId,
          transactionRef: transactionRef ? String(transactionRef) : undefined,
          expectedAmountFcfa: exp,
          confirmedAmountFcfa: amt,
          summary: `Contrôle commande par ${actor.name} : ${anomalyTypes.join(' | ')}`
        }),
        actionTypeForNotif: 'fraud_order_anomaly'
      });
      createdAlert = alert;
    }

    res.json({ success: true, orderAnomaly: record, alert: createdAlert });
  });

  // Update Investigation / Alert Dossier (status, notes, agent assignment, request justificatifs, close)
  app.patch('/api/fraud/alerts/:id', requireFraudPermission('manageInvestigations'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { fraudAuthCtx: AuthenticatedRequestContext }).fraudAuthCtx;
    const actor = authCtx.staff!;
    const alert = fraudDb.alerts.find((a) => a.id === req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, error: 'ALERT_NOT_FOUND', message: 'Alerte anti-fraude introuvable.' });
    }

    const {
      status,
      note,
      assignedToId,
      justificatifRequestNote,
      evidenceSummary,
      confirmedLossFcfa,
      closureReason
    } = req.body || {};

    const allowedStatuses: FraudAlertStatus[] = [
      'nouvelle',
      'en_cours',
      'en_attente_justificatifs',
      'suspicion_ecartee',
      'fraude_confirmee',
      'transmise_decision',
      'cloturee'
    ];
    const nowIso = new Date().toISOString();

    if (assignedToId !== undefined) {
      const targetStaff = getSecurityStaffDirectory().find((s) => s.id === assignedToId);
      alert.assignedToId = targetStaff ? targetStaff.id : null;
      alert.assignedToName = targetStaff ? targetStaff.name : null;
      alert.notes.unshift({
        id: `fn-${crypto.randomUUID().slice(0, 8)}`,
        at: nowIso,
        authorId: actor.id,
        authorName: actor.name,
        type: 'changement_statut',
        content: targetStaff ? `Dossier assigné à ${targetStaff.name}` : 'Assignation retirée'
      });
    }

    if (justificatifRequestNote) {
      const cleanReq = scrubSecrets(String(justificatifRequestNote));
      alert.requiresJustificatifs = true;
      alert.justificatifRequestNote = cleanReq;
      alert.status = 'en_attente_justificatifs';
      alert.notes.unshift({
        id: `fn-${crypto.randomUUID().slice(0, 8)}`,
        at: nowIso,
        authorId: actor.id,
        authorName: actor.name,
        type: 'demande_justificatif',
        content: `Demande de justificatifs : ${cleanReq}`
      });
    }

    if (evidenceSummary) {
      const cleanEv = scrubSecrets(String(evidenceSummary));
      const ev = buildEvidenceItem({
        source: 'piece_justificative',
        transactionRef: alert.linkedTransactionRef || undefined,
        orderId: alert.linkedOrderId || undefined,
        summary: `${actor.name} : ${cleanEv}`
      });
      alert.evidences.unshift(ev);
      alert.notes.unshift({
        id: `fn-${crypto.randomUUID().slice(0, 8)}`,
        at: nowIso,
        authorId: actor.id,
        authorName: actor.name,
        type: 'preuve_ajoutee',
        content: `Preuve ajoutée (hash ${ev.immutableHash}) : ${cleanEv}`
      });
    }

    if (note) {
      const cleanNote = scrubSecrets(String(note));
      alert.notes.unshift({
        id: `fn-${crypto.randomUUID().slice(0, 8)}`,
        at: nowIso,
        authorId: actor.id,
        authorName: actor.name,
        type: 'note',
        content: cleanNote
      });
    }

    if (status && allowedStatuses.includes(status)) {
      if (status === 'cloturee' && !closureReason && !note) {
        return res.status(400).json({
          success: false,
          error: 'CLOSURE_REASON_REQUIRED',
          message: 'Un motif explicite est obligatoire pour clôturer un dossier de fraude.'
        });
      }
      const prevStatus = alert.status;
      alert.status = status;
      if (status === 'fraude_confirmee') {
        alert.isConfirmedFraud = true;
        alert.confirmedLossFcfa = Number.isFinite(Number(confirmedLossFcfa))
          ? Math.max(0, Number(confirmedLossFcfa))
          : alert.amountFcfa;
      } else if (status === 'suspicion_ecartee') {
        alert.isConfirmedFraud = false;
        alert.confirmedLossFcfa = 0;
        alert.heldAmountFcfa = 0;
      }
      if (status === 'cloturee') {
        alert.closedAt = nowIso;
        alert.closedBy = actor.name;
        alert.closureReason = scrubSecrets(String(closureReason || note));
      }
      alert.notes.unshift({
        id: `fn-${crypto.randomUUID().slice(0, 8)}`,
        at: nowIso,
        authorId: actor.id,
        authorName: actor.name,
        type: status === 'fraude_confirmee' || status === 'suspicion_ecartee' ? 'decision_finale' : 'changement_statut',
        content: `Statut : ${prevStatus} -> ${status}${closureReason ? ` (${scrubSecrets(String(closureReason))})` : ''}`
      });
    }

    alert.updatedAt = nowIso;
    persistFraudDb();

    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'security',
      actionType: alert.status === 'fraude_confirmee' ? 'fraud_confirmed' : 'fraud_investigation_updated',
      action:
        alert.status === 'fraude_confirmee'
          ? `Fraude financière confirmée (${alert.id})`
          : `Dossier anti-fraude mis à jour (${alert.status})`,
      target: alert.accountLabelMasked,
      targetType: 'finance',
      entityType: 'fraud_alert',
      entityId: alert.id,
      result: 'reussi',
      severity: alert.status === 'fraude_confirmee' ? 'critique' : 'moyen',
      details: scrubSecrets(`${alert.title} — statut ${alert.status}`),
      ipAddress: getClientIp(req),
      dedupKey: `fraud-inv:${alert.id}:${alert.status}:${nowIso.slice(0, 16)}`
    });

    res.json({ success: true, alert });
  });

  // Update account watch status (proportional watch, never freezing whole wallet arbitrarily without review)
  app.patch('/api/fraud/accounts/:accountId/watch', requireFraudPermission('manageAccountWatch'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { fraudAuthCtx: AuthenticatedRequestContext }).fraudAuthCtx;
    const actor = authCtx.staff!;
    const accountId = req.params.accountId;
    const { watchStatus, watchReason } = req.body || {};
    const valid: FraudAccountWatchRecord['watchStatus'][] = [
      'normal',
      'surveillance_renforcee',
      'verification_requise',
      'operations_restreintes'
    ];
    if (!valid.includes(watchStatus)) {
      return res.status(400).json({ success: false, error: 'INVALID_WATCH_STATUS', message: 'Statut de surveillance invalide.' });
    }
    const cleanReason = scrubSecrets(String(watchReason || 'Mise à jour manuelle du niveau de surveillance'));
    fraudDb.accountWatchOverrides[accountId] = {
      watchStatus,
      watchReason: cleanReason,
      updatedBy: actor.name,
      updatedAt: new Date().toISOString()
    };
    persistFraudDb();

    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'security',
      actionType: 'fraud_account_watch_updated',
      action: `Surveillance compte mise à jour (${watchStatus})`,
      target: maskEmailOrId(accountId),
      targetType: 'account',
      entityType: 'account',
      entityId: accountId,
      result: 'reussi',
      severity: watchStatus === 'operations_restreintes' ? 'eleve' : 'moyen',
      details: cleanReason,
      ipAddress: getClientIp(req)
    });

    res.json({ success: true, accountId, watchStatus, watchReason: cleanReason });
  });

  // Update Linked Cluster verification decision (never auto-concludes)
  app.patch('/api/fraud/linked-clusters/:clusterId', requireFraudPermission('manageInvestigations'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { fraudAuthCtx: AuthenticatedRequestContext }).fraudAuthCtx;
    const actor = authCtx.staff!;
    const { verificationStatus, note } = req.body || {};
    const allowed: FraudLinkedAccountsCluster['verificationStatus'][] = [
      'indice_a_verifier',
      'en_analyse',
      'justifie_legitime',
      'collusion_confirmee'
    ];
    if (!allowed.includes(verificationStatus)) {
      return res.status(400).json({ success: false, error: 'INVALID_STATUS', message: 'Statut cluster invalide.' });
    }
    fraudDb.linkedClusterDecisions[req.params.clusterId] = {
      verificationStatus,
      note: scrubSecrets(String(note || '')),
      updatedBy: actor.name,
      updatedAt: new Date().toISOString()
    };
    persistFraudDb();
    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'security',
      actionType: 'fraud_linked_accounts',
      action: `Décision comptes liés (${verificationStatus})`,
      target: req.params.clusterId,
      targetType: 'account',
      result: 'reussi',
      severity: verificationStatus === 'collusion_confirmee' ? 'critique' : 'moyen',
      details: scrubSecrets(String(note || verificationStatus)),
      ipAddress: getClientIp(req)
    });
    res.json({ success: true, clusterId: req.params.clusterId, verificationStatus });
  });

  // --------------------------------------------------------------------------
  // DUAL VALIDATION (FOUR-EYES CHECK) FOR SENSITIVE FINANCIAL ACTIONS
  // --------------------------------------------------------------------------
  app.post(
    '/api/fraud/sensitive-actions',
    requireFraudPermission('requestSensitiveFinanceAction', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { fraudAuthCtx: AuthenticatedRequestContext }).fraudAuthCtx;
      const actor = authCtx.staff!;
      const {
        actionType,
        targetId,
        accountId,
        amountFcfa = 0,
        reason,
        payloadSummary,
        payoutTarget,
        idempotencyKey
      } = req.body || {};

      const actionLabels: Record<SensitiveFinanceActionType, string> = {
        release_critical_operation: 'Libérer une opération critique bloquée',
        manual_balance_adjustment: 'Effectuer un ajustement manuel de solde',
        exceptional_refund: 'Valider un remboursement exceptionnel',
        modify_financial_coordinates: 'Modifier des coordonnées financières sensibles',
        cancel_confirmed_transaction: 'Annuler une transaction confirmée',
        unlock_suspended_wallet: 'Débloquer un portefeuille ou une opération suspendue',
        modify_critical_fraud_rules: 'Modifier les règles critiques anti-fraude'
      };

      if (!actionLabels[actionType as SensitiveFinanceActionType]) {
        return res.status(400).json({ success: false, error: 'INVALID_ACTION_TYPE', message: 'Type d’action sensible invalide.' });
      }
      const cleanReason = scrubSecrets(String(reason || '').trim());
      if (cleanReason.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'REASON_REQUIRED',
          message: 'Un motif détaillé (min 6 caractères) est obligatoire pour toute action financière sensible.'
        });
      }

      const idemKey = String(idempotencyKey || `sa-${actionType}-${targetId || accountId}-${Math.round(Number(amountFcfa) || 0)}-${Date.now()}`);
      const existingSame = fraudDb.sensitiveActionRequests.find((r) => r.idempotencyKey === idemKey);
      if (existingSame) {
        return res.json({ success: true, idempotentDuplicate: true, request: existingSame });
      }

      const staffList = getSecurityStaffDirectory();
      const approversCount = staffList.filter(
        (s) => s.active && getEffectivePermissionsForStaff(s.id, s.role).approveDualControlAction
      ).length;
      const needsDual = fraudDb.settings.dualValidationRequired && approversCount >= 2;

      const cleanTargetAccount = String(accountId || targetId || 'compte-inconnu');
      const maskedCoord = payoutTarget ? maskFinancialCoord(String(payoutTarget)) || undefined : undefined;
      const summaryClean = scrubSecrets(
        String(payloadSummary || (maskedCoord ? `Coordonnée cible ${maskedCoord}` : cleanReason))
      );

      const reqRecord: FraudSensitiveActionRequest = {
        id: `dual-${crypto.randomUUID().slice(0, 10)}`,
        actionType: actionType as SensitiveFinanceActionType,
        actionLabel: actionLabels[actionType as SensitiveFinanceActionType],
        targetId: String(targetId || cleanTargetAccount),
        targetAccountId: cleanTargetAccount,
        targetAccountMasked: maskEmailOrId(cleanTargetAccount),
        amountFcfa: Math.max(0, Math.round(Number(amountFcfa) || 0)),
        reason: cleanReason,
        payloadSummary: maskedCoord ? `${summaryClean} [${maskedCoord}]` : summaryClean,
        requestedById: actor.id,
        requestedByName: actor.name,
        requestedAt: new Date().toISOString(),
        status: needsDual ? 'en_attente_second_valideur' : 'approuvee_executee',
        requiresDualValidation: needsDual,
        secondApproverId: null,
        secondApproverName: null,
        decidedAt: null,
        decisionNote: null,
        executedAt: null,
        executionResult: null,
        idempotencyKey: idemKey
      };

      // If single-admin fallback only when < 2 admins exist or dual disabled, execute immediately; otherwise WAIT for second admin!
      if (!needsDual) {
        const execResult = executeApprovedSensitiveAction(reqRecord, actor.name, maskedCoord);
        if (!execResult.ok) {
          return res.status(400).json({ success: false, error: 'EXECUTION_FAILED', message: execResult.message });
        }
        reqRecord.executedAt = new Date().toISOString();
        reqRecord.executionResult = execResult.message;
      }

      fraudDb.sensitiveActionRequests.unshift(reqRecord);
      persistFraudDb();

      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'wallets',
        actionType: needsDual ? 'fraud_dual_control_required' : 'fraud_sensitive_action_executed',
        action: needsDual
          ? `Double validation requise : ${reqRecord.actionLabel}`
          : `Action financière sensible exécutée : ${reqRecord.actionLabel}`,
        target: reqRecord.targetAccountMasked,
        targetType: 'finance',
        entityType: 'sensitive_action',
        entityId: reqRecord.id,
        result: 'reussi',
        severity: 'eleve',
        details: scrubSecrets(`${cleanReason}${reqRecord.amountFcfa ? ` • ${reqRecord.amountFcfa.toLocaleString('fr-FR')} FCFA` : ''}`),
        ipAddress: getClientIp(req),
        dedupKey: `dual-req:${reqRecord.id}`
      });

      res.json({ success: true, request: reqRecord });
    }
  );

  app.post(
    '/api/fraud/sensitive-actions/:id/decide',
    requireFraudPermission('approveDualControlAction', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { fraudAuthCtx: AuthenticatedRequestContext }).fraudAuthCtx;
      const actor = authCtx.staff!;
      const reqItem = fraudDb.sensitiveActionRequests.find((r) => r.id === req.params.id);
      if (!reqItem) {
        return res.status(404).json({ success: false, error: 'REQUEST_NOT_FOUND', message: 'Demande de validation introuvable.' });
      }
      if (reqItem.status !== 'en_attente_second_valideur') {
        return res.json({ success: true, idempotentDuplicate: true, request: reqItem });
      }

      const { decision, note } = req.body || {};
      if (decision !== 'approve' && decision !== 'reject' && decision !== 'cancel') {
        return res.status(400).json({ success: false, error: 'INVALID_DECISION', message: 'Décision invalide (approve, reject ou cancel).' });
      }

      // HARD SERVER GUARD: Principle of four-eyes (double control) — requester CANNOT approve their own request!
      if (decision === 'approve' && reqItem.requiresDualValidation && reqItem.requestedById === actor.id) {
        appendAuditEntry({
          actorId: actor.id,
          actorName: actor.name,
          actorAccountLabel: actor.email,
          actorRole: actor.role,
          space: 'admin',
          category: 'security',
          actionType: 'fraud_self_approval_blocked',
          action: 'Auto-validation bloquée sur action financière sensible',
          target: reqItem.id,
          targetType: 'permissions',
          result: 'bloque',
          severity: 'critique',
          details: `${actor.name} a tenté de valider lui-même sa demande ${reqItem.actionLabel}`,
          ipAddress: getClientIp(req),
          dedupKey: `self-approve:${reqItem.id}:${actor.id}`
        });
        return res.status(403).json({
          success: false,
          error: 'SELF_APPROVAL_FORBIDDEN',
          message: 'Double validation requise : un second administrateur autorisé différent du demandeur doit approuver cette opération.'
        });
      }

      const nowIso = new Date().toISOString();
      const cleanNote = scrubSecrets(String(note || (decision === 'approve' ? 'Approuvé après contre-vérification' : 'Rejeté lors du double contrôle')));

      if (decision === 'reject' || decision === 'cancel') {
        reqItem.status = decision === 'cancel' ? 'annulee' : 'rejetee';
        reqItem.secondApproverId = actor.id;
        reqItem.secondApproverName = actor.name;
        reqItem.decidedAt = nowIso;
        reqItem.decisionNote = cleanNote;
        persistFraudDb();

        appendAuditEntry({
          actorId: actor.id,
          actorName: actor.name,
          actorAccountLabel: actor.email,
          actorRole: actor.role,
          space: 'admin',
          category: 'wallets',
          actionType: 'fraud_dual_control_rejected',
          action: `Action financière ${decision === 'cancel' ? 'annulée' : 'rejetée'} en double contrôle`,
          target: reqItem.targetAccountMasked,
          targetType: 'finance',
          entityType: 'sensitive_action',
          entityId: reqItem.id,
          result: 'reussi',
          severity: 'moyen',
          details: `${reqItem.actionLabel} — ${cleanNote}`,
          ipAddress: getClientIp(req)
        });
        return res.json({ success: true, request: reqItem });
      }

      // Execute verified action atomically
      const coordMatch = reqItem.payloadSummary.match(/\[(.*?)\]$/);
      const maskedCoord = coordMatch ? coordMatch[1] : undefined;
      const execResult = executeApprovedSensitiveAction(reqItem, `${reqItem.requestedByName} + ${actor.name}`, maskedCoord);
      if (!execResult.ok) {
        return res.status(400).json({ success: false, error: 'EXECUTION_FAILED', message: execResult.message });
      }

      reqItem.status = 'approuvee_executee';
      reqItem.secondApproverId = actor.id;
      reqItem.secondApproverName = actor.name;
      reqItem.decidedAt = nowIso;
      reqItem.decisionNote = cleanNote;
      reqItem.executedAt = nowIso;
      reqItem.executionResult = execResult.message;
      persistFraudDb();

      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'wallets',
        actionType: 'fraud_dual_control_approved',
        action: `Double validation confirmée : ${reqItem.actionLabel}`,
        target: reqItem.targetAccountMasked,
        targetType: 'finance',
        entityType: 'sensitive_action',
        entityId: reqItem.id,
        result: 'reussi',
        severity: 'eleve',
        details: `${execResult.message} (Demandeur: ${reqItem.requestedByName}, Valideur: ${actor.name})`,
        ipAddress: getClientIp(req)
      });

      res.json({ success: true, request: reqItem });
    }
  );

  // Update fraud detection rule (Step-Up MFA required)
  app.patch(
    '/api/fraud/rules/:id',
    requireFraudPermission('manageFraudRules', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { fraudAuthCtx: AuthenticatedRequestContext }).fraudAuthCtx;
      const actor = authCtx.staff!;
      const rule = fraudDb.rules.find((r) => r.id === req.params.id);
      if (!rule) {
        return res.status(404).json({ success: false, error: 'RULE_NOT_FOUND', message: 'Règle introuvable.' });
      }

      const { enabled, weight, thresholdValue, autoAction } = req.body || {};
      if (typeof enabled === 'boolean') rule.enabled = enabled;
      if (typeof weight === 'number' && Number.isFinite(weight)) rule.weight = Math.max(0, Math.min(100, Math.round(weight)));
      if (typeof thresholdValue === 'number' && Number.isFinite(thresholdValue)) rule.thresholdValue = Math.max(1, thresholdValue);
      if (autoAction && ['journaliser', 'alerter', 'bloquer_operation_cible'].includes(autoAction)) {
        rule.autoAction = autoAction;
      }

      persistFraudDb();
      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'system_config',
        actionType: 'fraud_rule_updated',
        action: `Règle anti-fraude modifiée (${rule.code})`,
        target: rule.name,
        targetType: 'settings',
        result: 'reussi',
        severity: rule.requiresDualControlToEdit ? 'eleve' : 'moyen',
        details: `Actif=${rule.enabled}, Poids=${rule.weight}, Seuil=${rule.thresholdValue}, Action=${rule.autoAction}`,
        ipAddress: getClientIp(req)
      });

      res.json({ success: true, rule });
    }
  );

  // Update fraud settings (Step-Up MFA required)
  app.patch(
    '/api/fraud/settings',
    requireFraudPermission('manageFraudRules', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { fraudAuthCtx: AuthenticatedRequestContext }).fraudAuthCtx;
      const actor = authCtx.staff!;
      const patch = req.body || {};
      const nextSettings: FraudSettings = { ...fraudDb.settings };

      if (typeof patch.dualValidationRequired === 'boolean') nextSettings.dualValidationRequired = patch.dualValidationRequired;
      if (typeof patch.autoHoldCriticalOps === 'boolean') nextSettings.autoHoldCriticalOps = patch.autoHoldCriticalOps;
      if (typeof patch.autoHoldHighOps === 'boolean') nextSettings.autoHoldHighOps = patch.autoHoldHighOps;
      if (typeof patch.maskSensitiveFinancialCoords === 'boolean') nextSettings.maskSensitiveFinancialCoords = patch.maskSensitiveFinancialCoords;
      if (typeof patch.notifyOnMediumRisk === 'boolean') nextSettings.notifyOnMediumRisk = patch.notifyOnMediumRisk;
      if (typeof patch.highRiskScoreThreshold === 'number') nextSettings.highRiskScoreThreshold = Math.max(25, Math.min(89, patch.highRiskScoreThreshold));
      if (typeof patch.criticalRiskScoreThreshold === 'number') nextSettings.criticalRiskScoreThreshold = Math.max(50, Math.min(99, patch.criticalRiskScoreThreshold));
      if (typeof patch.suspiciousWithdrawalAmountFcfa === 'number') nextSettings.suspiciousWithdrawalAmountFcfa = Math.max(5000, patch.suspiciousWithdrawalAmountFcfa);
      if (typeof patch.withdrawalBurstMaxIn10Min === 'number') nextSettings.withdrawalBurstMaxIn10Min = Math.max(2, patch.withdrawalBurstMaxIn10Min);
      if (typeof patch.failedPaymentBurstMaxIn30Min === 'number') nextSettings.failedPaymentBurstMaxIn30Min = Math.max(2, patch.failedPaymentBurstMaxIn30Min);

      fraudDb.settings = nextSettings;
      persistFraudDb();

      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'system_config',
        actionType: 'fraud_settings_updated',
        action: 'Paramètres anti-fraude mis à jour',
        target: 'Moteur Anti-Fraude',
        targetType: 'settings',
        result: 'reussi',
        severity: 'eleve',
        details: `Double validation=${nextSettings.dualValidationRequired}, Seuil critique=${nextSettings.criticalRiskScoreThreshold}`,
        ipAddress: getClientIp(req)
      });

      res.json({ success: true, settings: nextSettings });
    }
  );

  // Super Admin permission matrix for Fraud module
  app.patch(
    '/api/fraud/permissions/:staffId',
    requireFraudPermission('manageFraudRules', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { fraudAuthCtx: AuthenticatedRequestContext }).fraudAuthCtx;
      const actor = authCtx.staff!;
      if (actor.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'SUPER_ADMIN_REQUIRED',
          message: 'Seul le Super Administrateur peut modifier les permissions anti-fraude.'
        });
      }
      const targetStaff = getSecurityStaffDirectory().find((s) => s.id === req.params.staffId);
      if (!targetStaff) {
        return res.status(404).json({ success: false, error: 'STAFF_NOT_FOUND', message: 'Collaborateur introuvable.' });
      }
      if (targetStaff.role === 'super_admin') {
        return res.status(400).json({ success: false, error: 'SUPER_ADMIN_IMMUTABLE', message: 'Les droits du Super Administrateur restent complets.' });
      }

      const incoming = (req.body?.permissions || {}) as Partial<Record<FraudPermissionKey, boolean>>;
      const current = getEffectivePermissionsForStaff(targetStaff.id, targetStaff.role);
      const updated = { ...current };
      ALL_FRAUD_PERMISSIONS.forEach((k) => {
        if (typeof incoming[k] === 'boolean') updated[k] = incoming[k]!;
      });
      fraudDb.staffPermissions[targetStaff.id] = updated;
      persistFraudDb();

      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'admin_mgmt',
        actionType: 'fraud_permissions_updated',
        action: `Permissions anti-fraude modifiées pour ${targetStaff.name}`,
        target: targetStaff.email,
        targetType: 'permissions',
        result: 'reussi',
        severity: 'eleve',
        details: `Permissions mises à jour par ${actor.name}`,
        ipAddress: getClientIp(req)
      });

      res.json({ success: true, staffId: targetStaff.id, permissions: updated });
    }
  );
}

function executeApprovedSensitiveAction(
  reqItem: FraudSensitiveActionRequest,
  actorsSummary: string,
  maskedCoord?: string
): { ok: boolean; message: string } {
  switch (reqItem.actionType) {
    case 'release_critical_operation':
      return applyVerifiedLedgerAction({
        mode: 'release_hold_approve',
        targetId: reqItem.targetId,
        accountId: reqItem.targetAccountId,
        amountFcfa: reqItem.amountFcfa,
        actorName: actorsSummary,
        reason: reqItem.reason,
        reference: `DUAL-${reqItem.id}`
      });
    case 'manual_balance_adjustment': {
      const isDebit = reqItem.payloadSummary.toLowerCase().includes('débit') || reqItem.payloadSummary.toLowerCase().includes('debit');
      return applyVerifiedLedgerAction({
        mode: isDebit ? 'manual_debit' : 'manual_credit',
        targetId: reqItem.targetId,
        accountId: reqItem.targetAccountId,
        amountFcfa: reqItem.amountFcfa,
        actorName: actorsSummary,
        reason: reqItem.reason,
        reference: `ADJ-${reqItem.id}`
      });
    }
    case 'exceptional_refund':
      return applyVerifiedLedgerAction({
        mode: 'exceptional_refund',
        targetId: reqItem.targetId,
        accountId: reqItem.targetAccountId,
        amountFcfa: reqItem.amountFcfa,
        actorName: actorsSummary,
        reason: reqItem.reason,
        reference: `REF-${reqItem.id}`
      });
    case 'cancel_confirmed_transaction':
      return applyVerifiedLedgerAction({
        mode: 'cancel_transaction',
        targetId: reqItem.targetId,
        accountId: reqItem.targetAccountId,
        amountFcfa: reqItem.amountFcfa,
        actorName: actorsSummary,
        reason: reqItem.reason,
        reference: `CAN-${reqItem.id}`
      });
    case 'modify_financial_coordinates':
      return applyVerifiedLedgerAction({
        mode: 'update_payout_target',
        targetId: reqItem.targetId,
        accountId: reqItem.targetAccountId,
        amountFcfa: 0,
        actorName: actorsSummary,
        reason: reqItem.reason,
        reference: `COORD-${reqItem.id}`,
        payoutTargetMasked: maskedCoord || reqItem.payloadSummary
      });
    case 'unlock_suspended_wallet':
      return applyVerifiedLedgerAction({
        mode: 'unlock_wallet_ops',
        targetId: reqItem.targetId,
        accountId: reqItem.targetAccountId,
        amountFcfa: 0,
        actorName: actorsSummary,
        reason: reqItem.reason,
        reference: `UNL-${reqItem.id}`
      });
    case 'modify_critical_fraud_rules':
      return { ok: true, message: 'Modification des règles critiques approuvée par double contrôle.' };
    default:
      return { ok: false, message: 'Action inconnue.' };
  }
}
