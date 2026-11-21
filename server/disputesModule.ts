import type { Express, NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { atomicWriteJsonFile } from './atomicFileStore';
import {
  appendAuditEntry,
  applyVerifiedDisputeSanction,
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
  DisputeAbuseIndicator,
  DisputeActorProfile,
  DisputeActorRoleType,
  DisputeCategoryConfig,
  DisputeCategoryKey,
  DisputeDashboardKpis,
  DisputeEvidenceItem,
  DisputeEvidenceKind,
  DisputeFinancialApprovalRequest,
  DisputeModuleSettings,
  DisputeNotificationItem,
  DisputeOrderSnapshot,
  DisputeOverviewResponse,
  DisputePermissionKey,
  DisputePriority,
  DisputeProviderCapability,
  DisputeRecord,
  DisputeStaffPermissionRow,
  DisputeStatus
} from '../src/types/disputes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DISPUTES_DB_FILE = path.join(DATA_DIR, 'disputes_db.json');
const FRAUD_DB_FILE = path.join(DATA_DIR, 'fraud_db.json');

export const ALL_DISPUTE_PERMISSIONS: DisputePermissionKey[] = [
  'viewDisputes',
  'viewAssignedOnly',
  'triageAndAssign',
  'investigateAndMediate',
  'requestRefundOrRelease',
  'approveFinancialDisputeOp',
  'applySanction',
  'closeOrReopenDispute',
  'manageDisputeSettings',
  'viewFullActorContacts'
];

export const DEFAULT_CATEGORIES: DisputeCategoryConfig[] = [
  { key: 'commande_non_recue', label: '1. Commande non reçue', enabled: true, defaultPriority: 'urgent', slaHours: 24 },
  { key: 'produit_manquant', label: '2. Produit manquant', enabled: true, defaultPriority: 'normal', slaHours: 36 },
  { key: 'produit_incorrect', label: '3. Produit incorrect', enabled: true, defaultPriority: 'normal', slaHours: 48 },
  { key: 'produit_endommage_defectueux', label: '4. Produit endommagé ou défectueux', enabled: true, defaultPriority: 'urgent', slaHours: 24 },
  { key: 'paiement_non_confirme', label: '5. Paiement non confirmé', enabled: true, defaultPriority: 'urgent', slaHours: 12 },
  { key: 'paiement_debite_plusieurs_fois', label: '6. Paiement débité plusieurs fois', enabled: true, defaultPriority: 'urgent', slaHours: 12 },
  { key: 'remboursement_non_recu', label: '7. Remboursement non reçu', enabled: true, defaultPriority: 'urgent', slaHours: 24 },
  { key: 'probleme_livraison', label: '8. Problème de livraison', enabled: true, defaultPriority: 'normal', slaHours: 24 },
  { key: 'retard_livraison', label: '9. Retard de livraison', enabled: true, defaultPriority: 'normal', slaHours: 24 },
  { key: 'colis_perdu', label: '10. Colis perdu', enabled: true, defaultPriority: 'urgent', slaHours: 18 },
  { key: 'comportement_vendeur', label: '11. Mauvais comportement du vendeur', enabled: true, defaultPriority: 'normal', slaHours: 48 },
  { key: 'comportement_livreur', label: '12. Historique comportement livreur (Archivé)', enabled: false, defaultPriority: 'normal', slaHours: 48 },
  { key: 'probleme_entreprise_livraison', label: '13. Historique entreprise livraison (Archivé)', enabled: false, defaultPriority: 'normal', slaHours: 48 },
  { key: 'suspicion_fraude', label: '14. Suspicion de fraude', enabled: true, defaultPriority: 'urgent', slaHours: 12 },
  { key: 'usurpation_identite', label: '15. Usurpation d’identité', enabled: true, defaultPriority: 'urgent', slaHours: 12 },
  { key: 'probleme_compte_acces', label: '16. Problème de compte ou d’accès', enabled: true, defaultPriority: 'faible', slaHours: 48 },
  { key: 'autre_reclamation', label: '17. Autre réclamation', enabled: true, defaultPriority: 'faible', slaHours: 72 }
];

const DEFAULT_SETTINGS: DisputeModuleSettings = {
  categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
  slaHoursByPriority: {
    urgent: 12,
    normal: 36,
    faible: 72
  },
  autoAssignMode: 'equilibre_charge',
  autoEscalationOnSlaBreach: true,
  requireDualValidationForRefundOverFcfa: 10000,
  requireProofBeforeClose: false,
  preventCloseWithPendingRefund: true,
  allowReopenWithinDays: 14,
  evidenceRetentionDays: 365,
  mediationMaxHours: 48,
  antiFraudThresholds: {
    maxClaimsPerUser30d: 3,
    flagDuplicateProofHash: true,
    flagMultipleDisputesSameOrder: true,
    abnormalClaimRatioPercent: 35
  },
  notificationsEnabled: {
    new_dispute: true,
    assigned_agent: true,
    evidence_received: true,
    new_message: true,
    evidence_requested: true,
    urgent_dispute: true,
    sla_overdue: true,
    admin_decision: true,
    refund_confirmed: true,
    funds_released: true,
    dispute_closed: true
  }
};

interface DisputesDatabase {
  disputes: DisputeRecord[];
  approvalRequests: DisputeFinancialApprovalRequest[];
  notifications: DisputeNotificationItem[];
  settings: DisputeModuleSettings;
  staffPermissions: Record<string, Record<DisputePermissionKey, boolean>>;
  processedIdempotencyKeys: Record<string, { at: string; resourceId: string }>;
  emittedSlaAlerts: Record<string, string>;
}

function loadDisputesDb(): DisputesDatabase {
  if (fs.existsSync(DISPUTES_DB_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(DISPUTES_DB_FILE, 'utf8'));
      return {
        disputes: Array.isArray(raw.disputes) ? raw.disputes : [],
        approvalRequests: Array.isArray(raw.approvalRequests) ? raw.approvalRequests : [],
        notifications: Array.isArray(raw.notifications) ? raw.notifications : [],
        settings: {
          ...DEFAULT_SETTINGS,
          ...(raw.settings || {}),
          categories:
            Array.isArray(raw.settings?.categories) && raw.settings.categories.length === DEFAULT_CATEGORIES.length
              ? raw.settings.categories
              : DEFAULT_CATEGORIES.map((c) => ({ ...c })),
          slaHoursByPriority: { ...DEFAULT_SETTINGS.slaHoursByPriority, ...(raw.settings?.slaHoursByPriority || {}) },
          antiFraudThresholds: { ...DEFAULT_SETTINGS.antiFraudThresholds, ...(raw.settings?.antiFraudThresholds || {}) },
          notificationsEnabled: { ...DEFAULT_SETTINGS.notificationsEnabled, ...(raw.settings?.notificationsEnabled || {}) }
        },
        staffPermissions: raw.staffPermissions && typeof raw.staffPermissions === 'object' ? raw.staffPermissions : {},
        processedIdempotencyKeys: raw.processedIdempotencyKeys && typeof raw.processedIdempotencyKeys === 'object' ? raw.processedIdempotencyKeys : {},
        emittedSlaAlerts: raw.emittedSlaAlerts && typeof raw.emittedSlaAlerts === 'object' ? raw.emittedSlaAlerts : {}
      };
    } catch (err) {
      console.error('[Disputes] Failed to parse disputes_db.json, initializing fresh DB:', err);
    }
  }
  return {
    disputes: [],
    approvalRequests: [],
    notifications: [],
    settings: {
      ...DEFAULT_SETTINGS,
      categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
      slaHoursByPriority: { ...DEFAULT_SETTINGS.slaHoursByPriority },
      antiFraudThresholds: { ...DEFAULT_SETTINGS.antiFraudThresholds },
      notificationsEnabled: { ...DEFAULT_SETTINGS.notificationsEnabled }
    },
    staffPermissions: {},
    processedIdempotencyKeys: {},
    emittedSlaAlerts: {}
  };
}

let disputesDb: DisputesDatabase = loadDisputesDb();

function persistDisputesDb() {
  if (!atomicWriteJsonFile(DISPUTES_DB_FILE, disputesDb, { context: 'Disputes' })) {
    console.error('[Disputes] Failed to persist disputes_db.json');
  }
}

if (!fs.existsSync(DISPUTES_DB_FILE)) {
  persistDisputesDb();
}

function defaultPermissionsForRole(role: string): Record<DisputePermissionKey, boolean> {
  if (role === 'super_admin') {
    return {
      viewDisputes: true,
      viewAssignedOnly: false,
      triageAndAssign: true,
      investigateAndMediate: true,
      requestRefundOrRelease: true,
      approveFinancialDisputeOp: true,
      applySanction: true,
      closeOrReopenDispute: true,
      manageDisputeSettings: true,
      viewFullActorContacts: true
    };
  }
  if (role === 'admin') {
    return {
      viewDisputes: true,
      viewAssignedOnly: false,
      triageAndAssign: true,
      investigateAndMediate: true,
      requestRefundOrRelease: true,
      approveFinancialDisputeOp: false,
      applySanction: true,
      closeOrReopenDispute: true,
      manageDisputeSettings: false,
      viewFullActorContacts: true
    };
  }
  if (role === 'security_agent') {
    return {
      viewDisputes: true,
      viewAssignedOnly: false,
      triageAndAssign: false,
      investigateAndMediate: true,
      requestRefundOrRelease: false,
      approveFinancialDisputeOp: true,
      applySanction: true,
      closeOrReopenDispute: false,
      manageDisputeSettings: false,
      viewFullActorContacts: false
    };
  }
  if (role === 'auditor') {
    return {
      viewDisputes: true,
      viewAssignedOnly: false,
      triageAndAssign: false,
      investigateAndMediate: false,
      requestRefundOrRelease: false,
      approveFinancialDisputeOp: false,
      applySanction: false,
      closeOrReopenDispute: false,
      manageDisputeSettings: false,
      viewFullActorContacts: false
    };
  }
  return {
    viewDisputes: false,
    viewAssignedOnly: true,
    triageAndAssign: false,
    investigateAndMediate: false,
    requestRefundOrRelease: false,
    approveFinancialDisputeOp: false,
    applySanction: false,
    closeOrReopenDispute: false,
    manageDisputeSettings: false,
    viewFullActorContacts: false
  };
}

function getEffectivePermissions(staffId: string, role: string): Record<DisputePermissionKey, boolean> {
  if (role === 'super_admin') return defaultPermissionsForRole('super_admin');
  const base = defaultPermissionsForRole(role);
  const custom = disputesDb.staffPermissions[staffId];
  return custom ? { ...base, ...custom } : base;
}

function requireDisputePermission(permission: DisputePermissionKey, opts?: { requireStepUpMfa?: boolean }) {
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
        actionType: 'dispute_unauthorized_access',
        action: 'Accès module Réclamations & litiges refusé',
        target: req.path,
        targetType: 'permissions',
        result: 'bloque',
        severity: 'critique',
        details: 'Tentative d’accès sans profil administratif autorisé',
        ipAddress: getClientIp(req)
      });
      return res.status(403).json({
        success: false,
        error: 'ADMIN_ROLE_REQUIRED',
        message: 'Accès réservé aux agents administratifs autorisés.'
      });
    }

    const perms = getEffectivePermissions(actor.id, actor.role);
    if (!perms[permission]) {
      return res.status(403).json({
        success: false,
        error: 'DISPUTE_PERMISSION_DENIED',
        message: `Permission manquante pour cette action (${permission}).`
      });
    }

    if (opts?.requireStepUpMfa) {
      const mfaCheck = verifyStepUpMfaForRequest(req, authCtx, true);
      if (!mfaCheck.ok) {
        return res.status(mfaCheck.status).json({
          success: false,
          error: mfaCheck.error,
          message: mfaCheck.message
        });
      }
    }

    (req as Request & { disputeAuthCtx: AuthenticatedRequestContext }).disputeAuthCtx = authCtx;
    next();
  };
}

function canAgentAccessDispute(dispute: DisputeRecord, actorId: string, perms: Record<DisputePermissionKey, boolean>): boolean {
  if (!perms.viewDisputes) return false;
  if (!perms.viewAssignedOnly) return true;
  return dispute.assignedAgentId === actorId;
}

function maskPhone(p?: string): string | undefined {
  if (!p) return undefined;
  const trimmed = p.trim();
  if (trimmed.length <= 6) return '***';
  return `${trimmed.slice(0, 4)} •••• ${trimmed.slice(-2)}`;
}

function maskEmail(e?: string): string | undefined {
  if (!e || !e.includes('@')) return undefined;
  const [loc, dom] = e.split('@');
  return `${loc.slice(0, 2)}***@${dom}`;
}

function sanitizeDisputeForActor(dispute: DisputeRecord, perms: Record<DisputePermissionKey, boolean>): DisputeRecord {
  if (perms.viewFullActorContacts) return dispute;
  const maskActor = (a?: DisputeActorProfile): DisputeActorProfile | undefined => {
    if (!a) return undefined;
    return {
      ...a,
      phoneFull: undefined,
      emailFull: undefined,
      phoneMasked: a.phoneMasked || maskPhone(a.phoneFull),
      emailMasked: a.emailMasked || maskEmail(a.emailFull)
    };
  };
  return {
    ...dispute,
    declarant: maskActor(dispute.declarant)!,
    accusedActor: maskActor(dispute.accusedActor)!,
    actors: {
      client: maskActor(dispute.actors.client),
      seller: maskActor(dispute.actors.seller),
      driver: maskActor(dispute.actors.driver),
      company: maskActor(dispute.actors.company)
    }
  };
}

function getProviderCapabilities(): DisputeProviderCapability[] {
  const gpConfigured = Boolean(process.env.GENIUSPAY_API_KEY && process.env.GENIUSPAY_API_KEY.trim().length >= 8);

  return [
    {
      id: 'internal_ledger',
      name: 'Registre & Portefeuille Interne DJASSA',
      configured: true,
      supportsDirectBlock: true,
      supportsDirectRefund: true,
      statusDetail: 'Actif côté serveur (blocage/séquestre registre et écriture comptable immuable avec double contrôle).'
    },
    {
      id: 'wave',
      name: 'Wave CI (via GeniusPay)',
      configured: gpConfigured,
      supportsDirectBlock: false,
      supportsDirectRefund: gpConfigured,
      statusDetail: gpConfigured
        ? 'Passerelle GeniusPay détectée — remboursement serveur Wave activé.'
        : 'Passerelle GeniusPay non configurée (GENIUSPAY_API_KEY absent) : blocage/remboursement automatique direct non disponible ; enregistrement manuel/registre requis.'
    },
    {
      id: 'orange_money',
      name: 'Orange Money CI (via GeniusPay)',
      configured: gpConfigured,
      supportsDirectBlock: false,
      supportsDirectRefund: gpConfigured,
      statusDetail: gpConfigured
        ? 'Passerelle GeniusPay détectée — remboursement serveur Orange Money activé.'
        : 'Passerelle GeniusPay non configurée (GENIUSPAY_API_KEY absent) : statut suivi hors ligne avec référence manuelle.'
    },
    {
      id: 'mtn_momo',
      name: 'MTN MoMo CI (via GeniusPay)',
      configured: gpConfigured,
      supportsDirectBlock: false,
      supportsDirectRefund: gpConfigured,
      statusDetail: gpConfigured
        ? 'Passerelle GeniusPay détectée — remboursement serveur MTN MoMo activé.'
        : 'Passerelle GeniusPay non configurée (GENIUSPAY_API_KEY absent) : aucune confirmation automatique possible sans prestataire.'
    },
    {
      id: 'geniuspay_card',
      name: 'Carte Bancaire (via GeniusPay)',
      configured: gpConfigured,
      supportsDirectBlock: false,
      supportsDirectRefund: gpConfigured,
      statusDetail: gpConfigured
        ? 'Passerelle GeniusPay Carte configurée.'
        : 'Passerelle GeniusPay non configurée : les remboursements bancaires nécessitent une confirmation de référence externe.'
    }
  ];
}

function getCategoryConfig(cat: DisputeCategoryKey): DisputeCategoryConfig {
  return (
    disputesDb.settings.categories.find((c) => c.key === cat) ||
    DEFAULT_CATEGORIES.find((c) => c.key === cat) ||
    DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1]
  );
}

function computeSlaDeadlineIso(priority: DisputePriority, category: DisputeCategoryKey, fromIso = new Date().toISOString()): string {
  const catCfg = getCategoryConfig(category);
  const prioHours = disputesDb.settings.slaHoursByPriority[priority] || 36;
  const hours = priority === 'urgent' ? Math.min(prioHours, catCfg.slaHours) : Math.max(catCfg.slaHours, prioHours);
  return new Date(new Date(fromIso).getTime() + hours * 3_600_000).toISOString();
}

function pushDisputeNotification(params: {
  dispute: DisputeRecord;
  eventType: DisputeNotificationItem['eventType'];
  title: string;
  body: string;
  audience: DisputeNotificationItem['audience'];
  recipientAccountId?: string;
  auditActionType: string;
  auditSeverity: 'faible' | 'moyen' | 'eleve' | 'critique';
}) {
  if (!disputesDb.settings.notificationsEnabled[params.eventType]) return;

  const notif: DisputeNotificationItem = {
    id: `dn-${crypto.randomUUID().slice(0, 10)}`,
    disputeId: params.dispute.id,
    disputeCode: params.dispute.code,
    eventType: params.eventType,
    title: params.title,
    body: redactSensitiveText(params.body),
    audience: params.audience,
    recipientAccountId: params.recipientAccountId,
    createdAt: new Date().toISOString(),
    readByActorIds: []
  };
  disputesDb.notifications.unshift(notif);
  if (disputesDb.notifications.length > 400) disputesDb.notifications = disputesDb.notifications.slice(0, 400);

  appendAuditEntry({
    actorId: params.dispute.assignedAgentId || 'system-disputes',
    actorName: params.dispute.assignedAgentName || 'Cellule Litiges DJASSA',
    actorAccountLabel: 'litiges@djassa.ci',
    actorRole: 'admin',
    space: 'admin',
    category: 'order_disputes',
    actionType: params.auditActionType,
    action: `${params.title} (${params.dispute.code})`,
    target: `Commande #${params.dispute.orderNumber} • ${params.dispute.code}`,
    targetType: 'order',
    entityType: 'dispute',
    entityId: params.dispute.id,
    result: 'reussi',
    severity: params.auditSeverity,
    details: params.body
  });
}

function evaluateAbuseAndFraudSignals(dispute: DisputeRecord): DisputeAbuseIndicator[] {
  const indicators: DisputeAbuseIndicator[] = [];
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const thresholds = disputesDb.settings.antiFraudThresholds;
  const thirtyDaysMs = 30 * 86_400_000;

  // 1. Repetitive claims by declarant within 30d
  const recentSameDeclarant = disputesDb.disputes.filter(
    (d) =>
      d.id !== dispute.id &&
      d.declarant.accountId === dispute.declarant.accountId &&
      now - new Date(d.createdAt).getTime() <= thirtyDaysMs
  );
  if (recentSameDeclarant.length + 1 >= thresholds.maxClaimsPerUser30d) {
    indicators.push({
      id: `ab-${dispute.id}-rep`,
      code: 'REPETITIVE_CLAIMS',
      severity: 'eleve',
      label: 'Réclamations répétitives',
      detail: `${recentSameDeclarant.length + 1} réclamations ouvertes par ce déclarant sur les 30 derniers jours (seuil : ${thresholds.maxClaimsPerUser30d}).`,
      automaticSignalOnly: true,
      detectedAt: nowIso
    });
  }

  // 2. Multiple disputes on the same order
  if (thresholds.flagMultipleDisputesSameOrder && dispute.orderNumber) {
    const sameOrder = disputesDb.disputes.filter(
      (d) => d.id !== dispute.id && d.orderNumber.toUpperCase() === dispute.orderNumber.toUpperCase()
    );
    if (sameOrder.length > 0) {
      indicators.push({
        id: `ab-${dispute.id}-ord`,
        code: 'MULTIPLE_DISPUTES_SAME_ORDER',
        severity: 'eleve',
        label: 'Commande multi-litiges',
        detail: `${sameOrder.length + 1} dossiers associés à la commande #${dispute.orderNumber}. Vérifier risque de double réclamation.`,
        automaticSignalOnly: true,
        detectedAt: nowIso
      });
    }
  }

  // 3. Duplicate/reused evidence hashes across different disputes (potential false proof)
  if (thresholds.flagDuplicateProofHash) {
    for (const ev of dispute.evidence) {
      const reusedIn = disputesDb.disputes.filter(
        (other) => other.id !== dispute.id && other.evidence.some((oEv) => oEv.sha256 === ev.sha256)
      );
      if (reusedIn.length > 0) {
        ev.flaggedDuplicateInDisputeIds = reusedIn.map((r) => r.code);
        indicators.push({
          id: `ab-${dispute.id}-ev-${ev.id}`,
          code: 'DUPLICATE_PROOF_HASH',
          severity: 'critique',
          label: 'Preuve identique réutilisée',
          detail: `Le justificatif « ${ev.title} » (SHA-256 ${ev.sha256.slice(0, 12)}…) apparaît déjà dans : ${reusedIn.map((r) => r.code).join(', ')}.`,
          automaticSignalOnly: true,
          detectedAt: nowIso
        });
      }
    }
  }

  // 4. Multiple refund requests
  const refundRequestsCount = disputesDb.approvalRequests.filter(
    (r) => r.disputeId === dispute.id && r.actionType === 'remboursement' && r.status !== 'rejetee'
  ).length;
  if (refundRequestsCount > 1 || dispute.financial.transactions.filter((t) => t.type === 'remboursement').length > 1) {
    indicators.push({
      id: `ab-${dispute.id}-mref`,
      code: 'MULTIPLE_REFUND_ATTEMPTS',
      severity: 'eleve',
      label: 'Tentatives de remboursement multiples',
      detail: 'Plus d’une demande de remboursement détectée sur ce même dossier/transaction.',
      automaticSignalOnly: true,
      detectedAt: nowIso
    });
  }

  // 5. Suspect collusion / shared coordinates between declarant & accused
  const declPhone = (dispute.declarant.phoneFull || '').replace(/\s+/g, '');
  const accPhone = (dispute.accusedActor.phoneFull || '').replace(/\s+/g, '');
  if (declPhone && accPhone && declPhone === accPhone) {
    indicators.push({
      id: `ab-${dispute.id}-col`,
      code: 'POTENTIAL_COLLUSION',
      severity: 'critique',
      label: 'Collusion / comptes liés suspects',
      detail: 'Le déclarant et l’acteur mis en cause partagent le même numéro de téléphone.',
      automaticSignalOnly: true,
      detectedAt: nowIso
    });
  }

  // 6. Impersonation category or cross-check with fraud_db.json alerts
  if (dispute.category === 'usurpation_identite' || dispute.category === 'suspicion_fraude') {
    indicators.push({
      id: `ab-${dispute.id}-imp`,
      code: dispute.category === 'usurpation_identite' ? 'IDENTITY_IMPERSONATION' : 'LINKED_ACCOUNTS_SUSPECT',
      severity: 'critique',
      label: dispute.category === 'usurpation_identite' ? 'Alerte usurpation d’identité' : 'Signalement suspicion fraude',
      detail: 'Dossier classé sensible — nécessite vérification humaine d’identité et contrôle des preuves avant décision.',
      automaticSignalOnly: true,
      detectedAt: nowIso
    });
  }

  // 7. Cross-reference fraud_db.json
  try {
    if (fs.existsSync(FRAUD_DB_FILE)) {
      const fraudRaw = JSON.parse(fs.readFileSync(FRAUD_DB_FILE, 'utf8'));
      const openFraudAlerts = Array.isArray(fraudRaw.alerts)
        ? fraudRaw.alerts.filter(
            (a: any) =>
              a &&
              a.status !== 'faux_positif' &&
              (a.accountId === dispute.declarant.accountId ||
                a.accountId === dispute.accusedActor.accountId ||
                (dispute.orderNumber && String(a.description || '').includes(dispute.orderNumber)))
          )
        : [];
      if (openFraudAlerts.length > 0) {
        indicators.push({
          id: `ab-${dispute.id}-frdb`,
          code: 'ABNORMAL_CLAIM_RATIO',
          severity: 'eleve',
          label: 'Corrélation module Anti-Fraude',
          detail: `${openFraudAlerts.length} alerte(s) financière(s) liée(s) à un acteur ou à cette commande dans la surveillance anti-fraude.`,
          automaticSignalOnly: true,
          detectedAt: nowIso
        });
      }
    }
  } catch {
    // ignore read error
  }

  return indicators;
}

function autoAssignAgentIfConfigured(): { agentId: string | null; agentName: string | null } {
  if (disputesDb.settings.autoAssignMode !== 'equilibre_charge') {
    return { agentId: null, agentName: null };
  }
  const staff = getSecurityStaffDirectory().filter((s) => {
    if (!s.active) return false;
    const perms = getEffectivePermissions(s.id, s.role);
    return perms.investigateAndMediate;
  });
  if (staff.length === 0) return { agentId: null, agentName: null };

  const counts = staff.map((s) => ({
    staff: s,
    openCount: disputesDb.disputes.filter(
      (d) =>
        d.assignedAgentId === s.id &&
        d.status !== 'resolue' &&
        d.status !== 'rejetee' &&
        d.status !== 'cloturee'
    ).length
  }));
  counts.sort((a, b) => a.openCount - b.openCount);
  return { agentId: counts[0].staff.id, agentName: counts[0].staff.name };
}

function buildOrderSnapshotFromRaw(rawOrder: any): DisputeOrderSnapshot {
  const items = Array.isArray(rawOrder?.items)
    ? rawOrder.items.map((it: any) => {
        const qty = Number(it.quantity || 1);
        const unit = Number(it.price ?? it.product?.price ?? 0);
        return {
          productId: String(it.productId || it.id || 'prd'),
          productTitle: String(it.productTitle || it.product?.name || 'Produit DJASSA'),
          productImage: it.productImage || it.product?.images?.[0],
          quantity: qty,
          unitPriceFcfa: unit,
          totalFcfa: unit * qty,
          sellerId: it.sellerId,
          sellerName: it.sellerName
        };
      })
    : [];

  return {
    orderId: rawOrder?.id ? String(rawOrder.id) : undefined,
    orderNumber: String(rawOrder?.orderNumber || rawOrder?.id || 'SANS-CMD'),
    items,
    subtotalFcfa: Number(rawOrder?.subtotal || 0),
    deliveryFeeFcfa: Number(rawOrder?.deliveryFee || 0),
    discountFcfa: Number(rawOrder?.discount || 0),
    totalFcfa: Number(rawOrder?.total || 0),
    paymentMethod: String(rawOrder?.paymentMethod || 'non_specifie'),
    transactionRef: rawOrder?.transactionRef || rawOrder?.paymentReference || undefined,
    paymentStatus: String(rawOrder?.paymentStatus || 'pending'),
    preparationStatus: rawOrder?.readyForPickup || rawOrder?.isReady ? 'pret_ramassage' : String(rawOrder?.status || 'en_cours'),
    deliveryStatus: String(rawOrder?.status || 'passed'),
    deliveryMode: rawOrder?.deliveryMode,
    createdAt: rawOrder?.createdAt,
    trackingHistory: Array.isArray(rawOrder?.trackingEvents)
      ? rawOrder.trackingEvents.map((t: any) => ({
          status: String(t.status || ''),
          label: String(t.label || t.status || ''),
          time: String(t.time || ''),
          description: t.description
        }))
      : [],
    gpsInfo: rawOrder?.deliveryAddress
      ? {
          commune: rawOrder.deliveryAddress.commune,
          quartier: rawOrder.deliveryAddress.quartier,
          details: rawOrder.deliveryAddress.details
        }
      : undefined
  };
}

function extractRealOrderProofs(rawOrder: any, disputeId: string): DisputeEvidenceItem[] {
  const proofs: DisputeEvidenceItem[] = [];
  const nowIso = new Date().toISOString();

  const makeHash = (str: string) => crypto.createHash('sha256').update(str).digest('hex');

  if (rawOrder?.pickupProof) {
    const pp = rawOrder.pickupProof;
    if (pp.photo) {
      proofs.push({
        id: `ev-ord-${disputeId}-pickup-photo`,
        kind: 'delivery_handover_proof',
        title: 'Photo prise en charge colis (Ramassage)',
        description: `Capturée lors du ramassage vendeur${pp.at ? ` (${pp.at})` : ''}`,
        urlOrData: pp.photo,
        sha256: makeHash(String(pp.photo)),
        addedAt: pp.at || nowIso,
        addedById: String(pp.driverId || 'driver'),
        addedByName: rawOrder.driver?.name || 'Livreur',
        addedByRole: 'driver',
        immutableOriginal: true
      });
    }
    if (pp.signature) {
      proofs.push({
        id: `ev-ord-${disputeId}-seller-sig`,
        kind: 'seller_signature',
        title: 'Signature Vendeur (Remise au livreur)',
        description: `Signé par ${pp.signedBy || 'Vendeur'}`,
        urlOrData: pp.signature,
        sha256: makeHash(String(pp.signature)),
        addedAt: pp.at || nowIso,
        addedById: 'seller',
        addedByName: String(pp.signedBy || rawOrder.items?.[0]?.sellerName || 'Vendeur'),
        addedByRole: 'seller',
        immutableOriginal: true
      });
    }
  }

  if (rawOrder?.deliveryProof) {
    const dp = rawOrder.deliveryProof;
    if (dp.photo) {
      proofs.push({
        id: `ev-ord-${disputeId}-deliv-photo`,
        kind: 'delivery_handover_proof',
        title: 'Photo preuve de livraison finale (POD)',
        description: `Remise client${dp.at ? ` (${dp.at})` : ''}`,
        urlOrData: dp.photo,
        sha256: makeHash(String(dp.photo)),
        addedAt: dp.at || nowIso,
        addedById: String(dp.driverId || 'driver'),
        addedByName: rawOrder.driver?.name || 'Livreur',
        addedByRole: 'driver',
        immutableOriginal: true
      });
    }
    if (dp.signature) {
      proofs.push({
        id: `ev-ord-${disputeId}-client-sig`,
        kind: 'client_signature',
        title: 'Signature Client (Réception colis)',
        description: `Signé par ${dp.signedBy || rawOrder.deliveryAddress?.recipientName || 'Client'}`,
        urlOrData: dp.signature,
        sha256: makeHash(String(dp.signature)),
        addedAt: dp.at || nowIso,
        addedById: 'client',
        addedByName: String(dp.signedBy || rawOrder.deliveryAddress?.recipientName || 'Client'),
        addedByRole: 'client',
        immutableOriginal: true
      });
    }
  }

  if (rawOrder?.incident?.photoProof) {
    proofs.push({
      id: `ev-ord-${disputeId}-inc-photo`,
      kind: 'photo',
      title: 'Photo justificative incident commande',
      description: rawOrder.incident.reason || 'Photo jointe à l’incident',
      urlOrData: rawOrder.incident.photoProof,
      sha256: makeHash(String(rawOrder.incident.photoProof)),
      addedAt: rawOrder.incident.reportedAt || nowIso,
      addedById: String(rawOrder.incident.reportedBy || 'client'),
      addedByName: String(rawOrder.incident.reportedBy || 'Déclarant'),
      addedByRole: rawOrder.incident.reportedBy === 'seller' ? 'seller' : rawOrder.incident.reportedBy === 'driver' ? 'driver' : 'client',
      immutableOriginal: true
    });
  }

  return proofs;
}

function checkAndEmitSlaOverdueAlerts() {
  const nowMs = Date.now();
  let changed = false;

  for (const d of disputesDb.disputes) {
    if (d.status === 'resolue' || d.status === 'rejetee' || d.status === 'cloturee' || d.archived) continue;
    const deadlineMs = new Date(d.slaDeadlineAt).getTime();
    if (!Number.isFinite(deadlineMs) || nowMs <= deadlineMs) continue;

    if (disputesDb.settings.autoEscalationOnSlaBreach && d.priority !== 'urgent') {
      d.priority = 'urgent';
      d.updatedAt = new Date(nowMs).toISOString();
      d.timeline.push({
        id: `tl-${crypto.randomUUID().slice(0, 8)}`,
        kind: 'status_change',
        visibility: 'admin_only',
        at: d.updatedAt,
        authorId: 'system-sla',
        authorName: 'Moniteur SLA DJASSA',
        authorRole: 'system',
        title: 'Escalade automatique en priorité URGENT (délai dépassé)',
        message: `Le délai SLA (${d.slaDeadlineAt}) a été dépassé. Passage automatique en Urgent.`
      });
      changed = true;
    }

    if (!disputesDb.emittedSlaAlerts[d.id]) {
      disputesDb.emittedSlaAlerts[d.id] = new Date(nowMs).toISOString();
      pushDisputeNotification({
        dispute: d,
        eventType: 'sla_overdue',
        title: 'Dossier en retard de traitement (SLA dépassé)',
        body: `La réclamation ${d.code} (${d.subject}) a dépassé sa date limite de traitement.`,
        audience: d.assignedAgentId ? 'agent' : 'admins',
        recipientAccountId: d.assignedAgentId || undefined,
        auditActionType: 'dispute_sla_overdue',
        auditSeverity: 'critique'
      });
      changed = true;
    }
  }

  if (changed) persistDisputesDb();
}

function computeKpis(visibleDisputes: DisputeRecord[]): DisputeDashboardKpis {
  const nowMs = Date.now();
  let newDisputes = 0;
  let pendingDisputes = 0;
  let inProgressDisputes = 0;
  let urgentDisputes = 0;
  let resolvedDisputes = 0;
  let rejectedDisputes = 0;
  let pendingRefundsCount = 0;
  let totalFinancialDisputeFcfa = 0;
  let overdueCount = 0;
  let abuseFlaggedCount = 0;
  let resHoursSum = 0;
  let resHoursCount = 0;

  for (const d of visibleDisputes) {
    if (d.status === 'nouvelle') newDisputes++;
    if (d.status === 'en_attente_traitement' || d.status === 'en_attente_justificatifs') pendingDisputes++;
    if (d.status === 'en_cours_investigation' || d.status === 'en_mediation') inProgressDisputes++;
    if (d.status === 'resolue' || d.status === 'cloturee') resolvedDisputes++;
    if (d.status === 'rejetee') rejectedDisputes++;

    const isOpen = d.status !== 'resolue' && d.status !== 'rejetee' && d.status !== 'cloturee';
    if (d.priority === 'urgent' && isOpen) urgentDisputes++;
    if (isOpen && new Date(d.slaDeadlineAt).getTime() < nowMs) overdueCount++;

    if (
      d.financial.refundStatus === 'en_attente_double_validation' ||
      d.financial.refundStatus === 'en_attente_confirmation_prestataire'
    ) {
      pendingRefundsCount++;
    }

    totalFinancialDisputeFcfa += Number(d.financial.disputedAmountFcfa || d.amountFcfa || 0);
    if (d.abuseIndicators.length > 0) abuseFlaggedCount++;

    if (d.resolvedAt) {
      const diffMs = Math.max(0, new Date(d.resolvedAt).getTime() - new Date(d.createdAt).getTime());
      resHoursSum += diffMs / 3_600_000;
      resHoursCount++;
    }
  }

  return {
    totalDisputes: visibleDisputes.length,
    newDisputes,
    pendingDisputes,
    inProgressDisputes,
    urgentDisputes,
    resolvedDisputes,
    rejectedDisputes,
    pendingRefundsCount,
    totalFinancialDisputeFcfa,
    averageResolutionHours: resHoursCount > 0 ? Math.round((resHoursSum / resHoursCount) * 10) / 10 : 0,
    overdueCount,
    abuseFlaggedCount
  };
}

function generateUniqueDisputeCode(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `REC-${datePart}-${rand}`;
}

export function installDisputesRoutes(app: Express) {
  // 1. Overview (Real stats, accessible disputes by RBAC, approval requests, notifications, capabilities, settings)
  app.get('/api/disputes/overview', requireDisputePermission('viewDisputes'), (req: Request, res: Response) => {
    checkAndEmitSlaOverdueAlerts();
    const authCtx = (req as Request & { disputeAuthCtx: AuthenticatedRequestContext }).disputeAuthCtx;
    const actor = authCtx.staff!;
    const perms = getEffectivePermissions(actor.id, actor.role);

    const accessible = disputesDb.disputes
      .filter((d) => canAgentAccessDispute(d, actor.id, perms))
      .map((d) => sanitizeDisputeForActor(d, perms));

    const kpis = computeKpis(accessible);
    const providerCapabilities = getProviderCapabilities();

    const visibleNotifications = disputesDb.notifications.filter(
      (n) =>
        n.audience === 'admins' ||
        n.audience === 'all_involved' ||
        (n.audience === 'agent' && (!n.recipientAccountId || n.recipientAccountId === actor.id))
    );

    const visibleIds = new Set(accessible.map((d) => d.id));
    const visibleApprovals = disputesDb.approvalRequests.filter((r) => visibleIds.has(r.disputeId) || !perms.viewAssignedOnly);

    const staffList = getSecurityStaffDirectory();
    const staffPermissions: DisputeStaffPermissionRow[] = staffList.map((s) => ({
      staffId: s.id,
      name: s.name,
      email: perms.viewFullActorContacts ? s.email : maskEmail(s.email) || '***',
      role: s.role,
      active: s.active,
      permissions: getEffectivePermissions(s.id, s.role)
    }));

    const secSnap = getFinanceFraudTelemetrySnapshot();
    const auditTrail = secSnap.auditLogs
      .filter((a) => a.category === 'order_disputes' || (a.actionType || '').startsWith('dispute_'))
      .slice(0, 80)
      .map((a) => ({
        id: a.id,
        at: a.timestamp,
        actorName: a.actorName,
        action: a.action,
        target: a.target,
        severity: a.severity,
        details: a.details
      }));

    const response: DisputeOverviewResponse = {
      success: true,
      generatedAt: new Date().toISOString(),
      actor: {
        staffId: actor.id,
        name: actor.name,
        role: actor.role,
        permissions: perms
      },
      kpis,
      providerCapabilities,
      disputes: accessible,
      approvalRequests: visibleApprovals,
      notifications: visibleNotifications.slice(0, 80),
      settings: disputesDb.settings,
      staffPermissions,
      auditTrail
    };
    res.json(response);
  });

  // 2. Sync real orders with genuine incident/claim messages into persistent disputes (NO fake data!)
  app.post('/api/disputes/sync-from-orders', requireDisputePermission('viewDisputes'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { disputeAuthCtx: AuthenticatedRequestContext }).disputeAuthCtx;
    const actor = authCtx.staff!;
    const { orders = [], messages = [], sellers = [], drivers = [] } = (req.body || {}) as {
      orders?: any[];
      messages?: any[];
      sellers?: any[];
      drivers?: any[];
    };

    let createdCount = 0;
    const createdIds: string[] = [];

    // Helper to look up existing dispute by sourceKey
    const hasSource = (sourceKey: string) => disputesDb.disputes.some((d) => d.sourceKey === sourceKey);

    for (const rawOrder of Array.isArray(orders) ? orders : []) {
      if (!rawOrder || !rawOrder.orderNumber) continue;
      if (!rawOrder.incident && rawOrder.status !== 'damaged' && rawOrder.status !== 'returned') continue;

      const sourceKey = `order-inc:${rawOrder.id || rawOrder.orderNumber}`;
      if (hasSource(sourceKey)) continue;

      const incType = rawOrder.incident?.type;
      const category: DisputeCategoryKey =
        incType === 'damaged' || rawOrder.status === 'damaged'
          ? 'produit_endommage_defectueux'
          : incType === 'returned' || rawOrder.status === 'returned'
          ? 'probleme_livraison'
          : 'autre_reclamation';

      const id = `dsp-${crypto.randomUUID().slice(0, 10)}`;
      const code = generateUniqueDisputeCode();
      const nowIso = new Date().toISOString();
      const firstSellerId = rawOrder.items?.[0]?.sellerId;
      const matchedSeller = (Array.isArray(sellers) ? sellers : []).find((s: any) => s.id === firstSellerId);
      const autoAgent = autoAssignAgentIfConfigured();

      const clientActor: DisputeActorProfile = {
        roleType: 'client',
        accountId: `cli-${rawOrder.deliveryAddress?.phone || rawOrder.orderNumber}`,
        name: rawOrder.deliveryAddress?.recipientName || 'Client DJASSA',
        avatar: rawOrder.clientAvatar,
        phoneFull: rawOrder.deliveryAddress?.phone,
        phoneMasked: maskPhone(rawOrder.deliveryAddress?.phone),
        accountStatus: 'active',
        pastDisputesCount: disputesDb.disputes.filter((x) => x.declarant.name === rawOrder.deliveryAddress?.recipientName).length,
        commune: rawOrder.deliveryAddress?.commune
      };

      const sellerActor: DisputeActorProfile | undefined = (matchedSeller || rawOrder.items?.[0]?.sellerName)
        ? {
            roleType: 'seller',
            accountId: String(matchedSeller?.id || firstSellerId || 'seller'),
            name: matchedSeller?.storeName || matchedSeller?.name || rawOrder.items?.[0]?.sellerName || 'Boutique Vendeur',
            avatar: matchedSeller?.avatar || rawOrder.sellerAvatar,
            phoneFull: matchedSeller?.phone,
            phoneMasked: maskPhone(matchedSeller?.phone),
            emailFull: matchedSeller?.email,
            emailMasked: maskEmail(matchedSeller?.email),
            accountStatus: 'active',
            pastDisputesCount: disputesDb.disputes.filter((x) => x.accusedActor.accountId === String(matchedSeller?.id || firstSellerId)).length,
            commune: matchedSeller?.location
          }
        : undefined;

      const driverActor: DisputeActorProfile | undefined = undefined;
      const companyActor: DisputeActorProfile | undefined = undefined;

      const reportedBy = rawOrder.incident?.reportedBy;
      const declarant = reportedBy === 'seller' && sellerActor ? sellerActor : clientActor;
      const accusedActor = declarant.roleType === 'client' ? sellerActor || clientActor : clientActor;

      const priority: DisputePriority =
        rawOrder.incident?.type === 'damaged' ? 'urgent' : getCategoryConfig(category).defaultPriority;
      const proofs = extractRealOrderProofs(rawOrder, id);
      const orderSnapshot = buildOrderSnapshotFromRaw(rawOrder);
      const commissionFcfa = 150;

      const record: DisputeRecord = {
        id,
        code,
        sourceKey,
        category,
        subject: rawOrder.incident?.reason || `Incident commande #${rawOrder.orderNumber}`,
        description: rawOrder.incident?.details || rawOrder.incident?.reason || `Signalement réel issu de la commande #${rawOrder.orderNumber}.`,
        orderNumber: String(rawOrder.orderNumber),
        orderId: String(rawOrder.id || rawOrder.orderNumber),
        declarant,
        accusedActor,
        actors: { client: clientActor, seller: sellerActor, driver: driverActor, company: companyActor },
        orderSnapshot,
        amountFcfa: Number(rawOrder.total || 0),
        priority,
        status: 'nouvelle',
        assignedAgentId: autoAgent.agentId,
        assignedAgentName: autoAgent.agentName,
        createdAt: rawOrder.incident?.reportedAt && !Number.isNaN(Date.parse(rawOrder.incident.reportedAt))
          ? new Date(rawOrder.incident.reportedAt).toISOString()
          : nowIso,
        updatedAt: nowIso,
        slaDeadlineAt: computeSlaDeadlineIso(priority, category, nowIso),
        resolvedAt: null,
        closedAt: null,
        archived: false,
        evidence: proofs,
        timeline: [
          {
            id: `tl-${crypto.randomUUID().slice(0, 8)}`,
            kind: 'initial_claim',
            visibility: 'actors_and_admin',
            at: nowIso,
            authorId: declarant.accountId,
            authorName: declarant.name,
            authorRole: declarant.roleType,
            title: 'Réclamation importée depuis commande réelle',
            message: rawOrder.incident?.details || rawOrder.incident?.reason || 'Incident enregistré sur la commande.'
          }
        ],
        mediation: { active: false },
        financial: {
          disputedAmountFcfa: Number(rawOrder.total || 0),
          blockedAmountFcfa: 0,
          amountToRefundFcfa: 0,
          refundedAmountFcfa: 0,
          deliveryFeeFcfa: Number(rawOrder.deliveryFee || 0),
          commissionFcfa,
          blockStatus: 'non_bloque',
          refundStatus: 'aucun',
          transactions: []
        },
        sanctions: [],
        abuseIndicators: []
      };

      record.abuseIndicators = evaluateAbuseAndFraudSignals(record);
      disputesDb.disputes.unshift(record);
      createdCount++;
      createdIds.push(record.id);

      pushDisputeNotification({
        dispute: record,
        eventType: 'new_dispute',
        title: 'Nouvelle réclamation synchronisée',
        body: `Dossier ${record.code} créé depuis la commande #${record.orderNumber} (${record.amountFcfa} FCFA).`,
        audience: 'admins',
        auditActionType: 'dispute_created',
        auditSeverity: record.priority === 'urgent' ? 'critique' : 'eleve'
      });
    }

    // Also inspect genuine claim / complaint messages in conversations
    for (const msg of Array.isArray(messages) ? messages : []) {
      if (!msg?.meta || (!msg.meta.isClaim && !msg.meta.isDriverComplaint && !msg.meta.isDamageAlert)) continue;
      const sourceKey = `msg-claim:${msg.meta.claimNumber || msg.meta.complaintNumber || msg.id}`;
      if (hasSource(sourceKey)) continue;

      const orderNum = String(msg.meta.orderNumber || msg.meta.orderId || 'N/A');
      const matchedOrder = (Array.isArray(orders) ? orders : []).find(
        (o: any) => String(o.orderNumber) === orderNum || String(o.id) === String(msg.meta.orderId)
      );
      const id = `dsp-${crypto.randomUUID().slice(0, 10)}`;
      const code = generateUniqueDisputeCode();
      const nowIso = new Date().toISOString();

      const cat: DisputeCategoryKey = msg.meta.isDamageAlert
        ? 'produit_endommage_defectueux'
        : msg.meta.claimType === 'refund'
        ? 'remboursement_non_recu'
        : 'produit_incorrect';

      const declRole: DisputeActorRoleType =
        msg.senderType === 'seller' ? 'seller' : 'client';
      const autoAgent = autoAssignAgentIfConfigured();
      const orderSnapshot = matchedOrder
        ? buildOrderSnapshotFromRaw(matchedOrder)
        : {
            orderNumber: orderNum,
            items: [],
            subtotalFcfa: Number(matchedOrder?.total || msg.meta.fee || 0),
            deliveryFeeFcfa: 0,
            discountFcfa: 0,
            totalFcfa: Number(matchedOrder?.total || msg.meta.fee || 0),
            paymentMethod: 'non_specifie',
            paymentStatus: 'unknown',
            preparationStatus: 'Commande confirmée',
            deliveryStatus: 'Commande confirmée',
            trackingHistory: []
          };

      const declProfile: DisputeActorProfile = {
        roleType: declRole,
        accountId: String(msg.senderId || 'user'),
        name: matchedOrder?.deliveryAddress?.recipientName || String(msg.senderId || 'Déclarant'),
        accountStatus: 'active',
        pastDisputesCount: 0
      };
      const accProfile: DisputeActorProfile = {
        roleType: 'seller',
        accountId: String(matchedOrder?.items?.[0]?.sellerId || 'actor'),
        name: String(matchedOrder?.items?.[0]?.sellerName || 'Vendeur concerné'),
        accountStatus: 'active',
        pastDisputesCount: 0
      };

      const evidence: DisputeEvidenceItem[] = matchedOrder ? extractRealOrderProofs(matchedOrder, id) : [];
      if (msg.meta.proofPhoto) {
        evidence.push({
          id: `ev-msg-${msg.id}`,
          kind: 'photo',
          title: 'Justificatif transmis dans la discussion',
          description: msg.meta.claimReason || msg.meta.reason || 'Photo réclamation',
          urlOrData: msg.meta.proofPhoto,
          sha256: crypto.createHash('sha256').update(String(msg.meta.proofPhoto)).digest('hex'),
          addedAt: nowIso,
          addedById: String(msg.senderId || 'user'),
          addedByName: declProfile.name,
          addedByRole: declRole,
          immutableOriginal: true
        });
      }

      const priority: DisputePriority = getCategoryConfig(cat).defaultPriority;
      const record: DisputeRecord = {
        id,
        code,
        sourceKey,
        category: cat,
        subject: String(msg.meta.claimReason || msg.meta.reason || msg.meta.orderTitle || 'Réclamation messagerie'),
        description: String(msg.meta.details || msg.content || 'Réclamation ouverte dans les échanges.'),
        orderNumber: orderNum,
        orderId: matchedOrder?.id,
        declarant: declProfile,
        accusedActor: accProfile,
        actors: {
          client: declRole === 'client' ? declProfile : undefined,
          seller: declRole === 'seller' ? declProfile : accProfile
        },
        orderSnapshot,
        amountFcfa: Number(matchedOrder?.total || orderSnapshot.totalFcfa || 0),
        priority,
        status: 'nouvelle',
        assignedAgentId: autoAgent.agentId,
        assignedAgentName: autoAgent.agentName,
        createdAt: nowIso,
        updatedAt: nowIso,
        slaDeadlineAt: computeSlaDeadlineIso(priority, cat, nowIso),
        resolvedAt: null,
        closedAt: null,
        archived: false,
        evidence,
        timeline: [
          {
            id: `tl-${crypto.randomUUID().slice(0, 8)}`,
            kind: 'initial_claim',
            visibility: 'actors_and_admin',
            at: nowIso,
            authorId: declProfile.accountId,
            authorName: declProfile.name,
            authorRole: declRole,
            title: 'Réclamation reçue depuis discussion',
            message: String(msg.meta.details || msg.content || '')
          }
        ],
        mediation: { active: false },
        financial: {
          disputedAmountFcfa: Number(matchedOrder?.total || 0),
          blockedAmountFcfa: 0,
          amountToRefundFcfa: 0,
          refundedAmountFcfa: 0,
          deliveryFeeFcfa: Number(matchedOrder?.deliveryFee || 0),
          commissionFcfa: 0,
          blockStatus: 'non_bloque',
          refundStatus: 'aucun',
          transactions: []
        },
        sanctions: [],
        abuseIndicators: []
      };

      record.abuseIndicators = evaluateAbuseAndFraudSignals(record);
      disputesDb.disputes.unshift(record);
      createdCount++;
      createdIds.push(record.id);
    }

    if (createdCount > 0) persistDisputesDb();
    res.json({ success: true, importedCount: createdCount, importedIds: createdIds, actorId: actor.id });
  });

  // 3. Create a real dispute linked to an order & real actors (supports idempotency key!)
  app.post('/api/disputes', requireDisputePermission('triageAndAssign'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { disputeAuthCtx: AuthenticatedRequestContext }).disputeAuthCtx;
    const actor = authCtx.staff!;

    const idemKey = (req.header('x-idempotency-key') || '').trim();
    if (idemKey && disputesDb.processedIdempotencyKeys[idemKey]) {
      const existing = disputesDb.disputes.find((d) => d.id === disputesDb.processedIdempotencyKeys[idemKey].resourceId);
      if (existing) {
        return res.json({ success: true, idempotentDuplicate: true, dispute: existing });
      }
    }

    const {
      category = 'autre_reclamation',
      subject,
      description,
      orderNumber,
      order,
      declarant,
      accusedActor,
      actors,
      amountFcfa,
      priority,
      assignedAgentId,
      initialEvidence
    } = req.body || {};

    if (!subject || !String(subject).trim() || !description || !String(description).trim()) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'L’objet du litige et la description détaillée sont obligatoires.'
      });
    }

    const catCfg = getCategoryConfig(category);
    if (!catCfg.enabled) {
      return res.status(400).json({
        success: false,
        error: 'CATEGORY_DISABLED',
        message: `La catégorie « ${catCfg.label} » est actuellement désactivée dans les paramètres.`
      });
    }

    const chosenPriority: DisputePriority =
      priority && ['faible', 'normal', 'urgent'].includes(priority) ? priority : catCfg.defaultPriority;
    const nowIso = new Date().toISOString();
    const id = `dsp-${crypto.randomUUID().slice(0, 10)}`;
    const code = generateUniqueDisputeCode();

    const orderSnap: DisputeOrderSnapshot = order
      ? buildOrderSnapshotFromRaw(order)
      : {
          orderNumber: String(orderNumber || 'SANS-CMD'),
          items: [],
          subtotalFcfa: Number(amountFcfa || 0),
          deliveryFeeFcfa: 0,
          discountFcfa: 0,
          totalFcfa: Number(amountFcfa || 0),
          paymentMethod: 'non_specifie',
          paymentStatus: 'unknown',
          preparationStatus: 'unknown',
          deliveryStatus: 'unknown',
          trackingHistory: []
        };

    const disputedAmount = Math.max(0, Math.round(Number(amountFcfa ?? orderSnap.totalFcfa ?? 0)));

    let assignId: string | null = null;
    let assignName: string | null = null;
    if (assignedAgentId) {
      const staffTarget = getSecurityStaffDirectory().find((s) => s.id === assignedAgentId && s.active);
      if (staffTarget) {
        assignId = staffTarget.id;
        assignName = staffTarget.name;
      }
    } else {
      const auto = autoAssignAgentIfConfigured();
      assignId = auto.agentId;
      assignName = auto.agentName;
    }

    const normalizeActor = (a: any, fallbackRole: DisputeActorRoleType, fallbackName: string): DisputeActorProfile => ({
      roleType: a?.roleType || fallbackRole,
      accountId: String(a?.accountId || `${fallbackRole}-${crypto.randomUUID().slice(0, 6)}`),
      name: String(a?.name || fallbackName),
      avatar: a?.avatar,
      phoneFull: a?.phoneFull || a?.phone,
      phoneMasked: maskPhone(a?.phoneFull || a?.phone),
      emailFull: a?.emailFull || a?.email,
      emailMasked: maskEmail(a?.emailFull || a?.email),
      accountStatus: a?.accountStatus || 'active',
      pastDisputesCount: disputesDb.disputes.filter((d) => d.declarant.accountId === a?.accountId || d.accusedActor.accountId === a?.accountId).length,
      companyName: a?.companyName,
      vehicleInfo: a?.vehicleInfo,
      commune: a?.commune
    });

    const decl = normalizeActor(declarant, 'client', 'Client déclarant');
    const acc = normalizeActor(accusedActor, 'seller', 'Acteur mis en cause');

    const proofs: DisputeEvidenceItem[] = order ? extractRealOrderProofs(order, id) : [];
    if (Array.isArray(initialEvidence)) {
      for (const ev of initialEvidence) {
        if (!ev?.title) continue;
        const contentStr = String(ev.urlOrData || ev.description || ev.title);
        proofs.push({
          id: `ev-${crypto.randomUUID().slice(0, 8)}`,
          kind: (ev.kind || 'document') as DisputeEvidenceKind,
          title: redactSensitiveText(String(ev.title)),
          description: ev.description ? redactSensitiveText(String(ev.description)) : undefined,
          urlOrData: ev.urlOrData,
          mimeType: ev.mimeType,
          fileSizeBytes: ev.fileSizeBytes,
          sha256: crypto.createHash('sha256').update(contentStr).digest('hex'),
          addedAt: nowIso,
          addedById: decl.accountId,
          addedByName: decl.name,
          addedByRole: decl.roleType,
          immutableOriginal: true
        });
      }
    }

    const commissionFcfa = 150;

    const record: DisputeRecord = {
      id,
      code,
      category: catCfg.key,
      subject: redactSensitiveText(String(subject).trim()),
      description: redactSensitiveText(String(description).trim()),
      orderNumber: String(orderNumber || orderSnap.orderNumber || 'SANS-CMD'),
      orderId: order?.id ? String(order.id) : undefined,
      declarant: decl,
      accusedActor: acc,
      actors: {
        client: actors?.client ? normalizeActor(actors.client, 'client', 'Client') : decl.roleType === 'client' ? decl : undefined,
        seller: actors?.seller ? normalizeActor(actors.seller, 'seller', 'Vendeur') : acc.roleType === 'seller' ? acc : undefined,
        driver: actors?.driver ? normalizeActor(actors.driver, 'driver', 'Livreur') : acc.roleType === 'driver' ? acc : undefined,
        company: actors?.company ? normalizeActor(actors.company, 'company', 'Entreprise') : acc.roleType === 'company' ? acc : undefined
      },
      orderSnapshot: orderSnap,
      amountFcfa: disputedAmount,
      priority: chosenPriority,
      status: assignId ? 'en_attente_traitement' : 'nouvelle',
      assignedAgentId: assignId,
      assignedAgentName: assignName,
      createdAt: nowIso,
      updatedAt: nowIso,
      slaDeadlineAt: computeSlaDeadlineIso(chosenPriority, catCfg.key, nowIso),
      resolvedAt: null,
      closedAt: null,
      archived: false,
      evidence: proofs,
      timeline: [
        {
          id: `tl-${crypto.randomUUID().slice(0, 8)}`,
          kind: 'initial_claim',
          visibility: 'actors_and_admin',
          at: nowIso,
          authorId: actor.id,
          authorName: `${decl.name} (enregistré par ${actor.name})`,
          authorRole: decl.roleType,
          title: 'Ouverture officielle du dossier de réclamation',
          message: redactSensitiveText(String(description).trim()),
          afterStatus: assignId ? 'en_attente_traitement' : 'nouvelle'
        }
      ],
      mediation: { active: false },
      financial: {
        disputedAmountFcfa: disputedAmount,
        blockedAmountFcfa: 0,
        amountToRefundFcfa: 0,
        refundedAmountFcfa: 0,
        deliveryFeeFcfa: Number(orderSnap.deliveryFeeFcfa || 0),
        commissionFcfa,
        blockStatus: 'non_bloque',
        refundStatus: 'aucun',
        transactions: []
      },
      sanctions: [],
      abuseIndicators: []
    };

    record.abuseIndicators = evaluateAbuseAndFraudSignals(record);
    disputesDb.disputes.unshift(record);
    if (idemKey) {
      disputesDb.processedIdempotencyKeys[idemKey] = { at: nowIso, resourceId: record.id };
    }
    persistDisputesDb();

    pushDisputeNotification({
      dispute: record,
      eventType: chosenPriority === 'urgent' ? 'urgent_dispute' : 'new_dispute',
      title: chosenPriority === 'urgent' ? 'Litige URGENT ouvert' : 'Nouvelle réclamation ouverte',
      body: `${record.code} • ${record.subject} (${disputedAmount.toLocaleString('fr-FR')} FCFA)`,
      audience: 'admins',
      auditActionType: chosenPriority === 'urgent' ? 'dispute_urgent_alert' : 'dispute_created',
      auditSeverity: chosenPriority === 'urgent' ? 'critique' : 'eleve'
    });
    if (assignId) {
      pushDisputeNotification({
        dispute: record,
        eventType: 'assigned_agent',
        title: 'Réclamation attribuée à un agent',
        body: `Dossier ${record.code} confié à ${assignName}.`,
        audience: 'agent',
        recipientAccountId: assignId,
        auditActionType: 'dispute_assigned',
        auditSeverity: 'moyen'
      });
    }
    persistDisputesDb();

    res.status(201).json({ success: true, dispute: record });
  });

  // 4. Take charge of a dispute
  app.post('/api/disputes/:id/take-charge', requireDisputePermission('investigateAndMediate'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { disputeAuthCtx: AuthenticatedRequestContext }).disputeAuthCtx;
    const actor = authCtx.staff!;
    const perms = getEffectivePermissions(actor.id, actor.role);
    const dispute = disputesDb.disputes.find((d) => d.id === req.params.id);
    if (!dispute) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });
    if (perms.viewAssignedOnly && dispute.assignedAgentId && dispute.assignedAgentId !== actor.id) {
      return res.status(403).json({ success: false, error: 'DISPUTE_NOT_ASSIGNED_TO_YOU', message: 'Ce dossier est déjà affecté à un autre agent.' });
    }

    const nowIso = new Date().toISOString();
    const prevStatus = dispute.status;
    dispute.assignedAgentId = actor.id;
    dispute.assignedAgentName = actor.name;
    if (dispute.status === 'nouvelle' || dispute.status === 'en_attente_traitement') {
      dispute.status = 'en_cours_investigation';
    }
    dispute.updatedAt = nowIso;
    dispute.timeline.push({
      id: `tl-${crypto.randomUUID().slice(0, 8)}`,
      kind: 'assignment_change',
      visibility: 'actors_and_admin',
      at: nowIso,
      authorId: actor.id,
      authorName: actor.name,
      authorRole: 'admin',
      title: `Prise en charge par ${actor.name}`,
      message: `${actor.name} a pris en charge le dossier.`,
      beforeStatus: prevStatus,
      afterStatus: dispute.status
    });
    persistDisputesDb();

    pushDisputeNotification({
      dispute,
      eventType: 'assigned_agent',
      title: 'Réclamation prise en charge',
      body: `${actor.name} est désormais responsable du dossier ${dispute.code}.`,
      audience: 'agent',
      recipientAccountId: actor.id,
      auditActionType: 'dispute_assigned',
      auditSeverity: 'moyen'
    });
    persistDisputesDb();

    res.json({ success: true, dispute: sanitizeDisputeForActor(dispute, perms) });
  });

  // 5. Assign dispute to another staff agent
  app.post('/api/disputes/:id/assign', requireDisputePermission('triageAndAssign'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { disputeAuthCtx: AuthenticatedRequestContext }).disputeAuthCtx;
    const actor = authCtx.staff!;
    const perms = getEffectivePermissions(actor.id, actor.role);
    const dispute = disputesDb.disputes.find((d) => d.id === req.params.id);
    if (!dispute) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });

    const { agentId } = req.body || {};
    const targetStaff = getSecurityStaffDirectory().find((s) => s.id === agentId && s.active);
    if (!targetStaff) {
      return res.status(400).json({ success: false, error: 'AGENT_NOT_FOUND', message: 'Agent cible introuvable ou inactif.' });
    }

    const nowIso = new Date().toISOString();
    const prevStatus = dispute.status;
    dispute.assignedAgentId = targetStaff.id;
    dispute.assignedAgentName = targetStaff.name;
    if (dispute.status === 'nouvelle') dispute.status = 'en_attente_traitement';
    dispute.updatedAt = nowIso;
    dispute.timeline.push({
      id: `tl-${crypto.randomUUID().slice(0, 8)}`,
      kind: 'assignment_change',
      visibility: 'admin_only',
      at: nowIso,
      authorId: actor.id,
      authorName: actor.name,
      authorRole: 'admin',
      title: `Dossier affecté à ${targetStaff.name}`,
      message: `Affectation réalisée par ${actor.name}.`,
      beforeStatus: prevStatus,
      afterStatus: dispute.status
    });
    persistDisputesDb();

    pushDisputeNotification({
      dispute,
      eventType: 'assigned_agent',
      title: 'Réclamation attribuée à un agent',
      body: `Dossier ${dispute.code} attribué à ${targetStaff.name} par ${actor.name}.`,
      audience: 'agent',
      recipientAccountId: targetStaff.id,
      auditActionType: 'dispute_assigned',
      auditSeverity: 'moyen'
    });
    persistDisputesDb();

    res.json({ success: true, dispute: sanitizeDisputeForActor(dispute, perms) });
  });

  // 6. Change Priority
  app.patch('/api/disputes/:id/priority', requireDisputePermission('triageAndAssign'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { disputeAuthCtx: AuthenticatedRequestContext }).disputeAuthCtx;
    const actor = authCtx.staff!;
    const perms = getEffectivePermissions(actor.id, actor.role);
    const dispute = disputesDb.disputes.find((d) => d.id === req.params.id);
    if (!dispute) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });

    const { priority, reason = '' } = req.body || {};
    if (!['faible', 'normal', 'urgent'].includes(priority)) {
      return res.status(400).json({ success: false, error: 'INVALID_PRIORITY', message: 'Priorité invalide.' });
    }

    const oldPrio = dispute.priority;
    const nowIso = new Date().toISOString();
    dispute.priority = priority;
    dispute.slaDeadlineAt = computeSlaDeadlineIso(priority, dispute.category, dispute.createdAt);
    dispute.updatedAt = nowIso;
    dispute.timeline.push({
      id: `tl-${crypto.randomUUID().slice(0, 8)}`,
      kind: 'status_change',
      visibility: 'admin_only',
      at: nowIso,
      authorId: actor.id,
      authorName: actor.name,
      authorRole: 'admin',
      title: `Priorité modifiée : ${oldPrio.toUpperCase()} → ${priority.toUpperCase()}`,
      message: redactSensitiveText(reason || 'Mise à jour de priorité par l’administration.')
    });
    persistDisputesDb();

    if (priority === 'urgent') {
      pushDisputeNotification({
        dispute,
        eventType: 'urgent_dispute',
        title: 'Litige classé URGENT',
        body: `Le dossier ${dispute.code} a été passé en priorité urgente par ${actor.name}.`,
        audience: 'admins',
        auditActionType: 'dispute_urgent_alert',
        auditSeverity: 'critique'
      });
      persistDisputesDb();
    }

    res.json({ success: true, dispute: sanitizeDisputeForActor(dispute, perms) });
  });

  // 7. Status Change, Accept, Reject (with mandatory reason), Close & Reopen
  app.patch('/api/disputes/:id/status', requireDisputePermission('investigateAndMediate'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { disputeAuthCtx: AuthenticatedRequestContext }).disputeAuthCtx;
    const actor = authCtx.staff!;
    const perms = getEffectivePermissions(actor.id, actor.role);
    const dispute = disputesDb.disputes.find((d) => d.id === req.params.id);
    if (!dispute) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });
    if (!canAgentAccessDispute(dispute, actor.id, perms)) {
      return res.status(403).json({ success: false, error: 'ACCESS_DENIED', message: 'Dossier hors de votre périmètre.' });
    }

    const { status, reason = '', confirmed = false } = req.body || {};
    const validStatuses: DisputeStatus[] = [
      'nouvelle',
      'en_attente_traitement',
      'en_cours_investigation',
      'en_attente_justificatifs',
      'en_mediation',
      'resolue',
      'rejetee',
      'cloturee'
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'INVALID_STATUS', message: 'Statut inconnu.' });
    }

    const isDecisionOrClose = ['resolue', 'rejetee', 'cloturee'].includes(status) || (dispute.status === 'cloturee' && status !== 'cloturee');
    if (isDecisionOrClose && !confirmed) {
      return res.status(400).json({ success: false, error: 'CONFIRMATION_REQUIRED', message: 'Cette décision critique requiert une confirmation explicite.' });
    }

    // Reopen checks
    if (dispute.status === 'cloturee' && status !== 'cloturee') {
      if (!perms.closeOrReopenDispute) {
        return res.status(403).json({ success: false, error: 'REOPEN_PERMISSION_DENIED', message: 'Permission closeOrReopenDispute requise pour réouvrir un dossier.' });
      }
      const closedMs = dispute.closedAt ? new Date(dispute.closedAt).getTime() : Date.now();
      const daysSinceClose = (Date.now() - closedMs) / 86_400_000;
      if (daysSinceClose > disputesDb.settings.allowReopenWithinDays && actor.role !== 'super_admin') {
        return res.status(400).json({
          success: false,
          error: 'REOPEN_WINDOW_EXPIRED',
          message: `Délai de réouverture dépassé (${disputesDb.settings.allowReopenWithinDays} jours). Seul le Super Admin peut réouvrir exceptionnellement.`
        });
      }
      if (!String(reason).trim()) {
        return res.status(400).json({ success: false, error: 'REOPEN_REASON_REQUIRED', message: 'Motif obligatoire pour réouvrir un dossier clôturé.' });
      }
    }

    // Reject requires mandatory justification
    if (status === 'rejetee' && String(reason).trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'REJECTION_REASON_REQUIRED',
        message: 'Une justification détaillée (minimum 5 caractères) est obligatoire pour rejeter une réclamation.'
      });
    }

    // Close checks
    if (status === 'cloturee') {
      if (!perms.closeOrReopenDispute) {
        return res.status(403).json({ success: false, error: 'CLOSE_PERMISSION_DENIED', message: 'Permission closeOrReopenDispute requise.' });
      }
      if (
        disputesDb.settings.preventCloseWithPendingRefund &&
        (dispute.financial.refundStatus === 'en_attente_double_validation' ||
          dispute.financial.refundStatus === 'en_attente_confirmation_prestataire')
      ) {
        return res.status(409).json({
          success: false,
          error: 'PENDING_REFUND_BLOCKS_CLOSE',
          message: 'Clôture impossible : un remboursement est toujours en attente de validation ou confirmation.'
        });
      }
      if (disputesDb.settings.requireProofBeforeClose && dispute.evidence.length === 0) {
        return res.status(409).json({
          success: false,
          error: 'EVIDENCE_REQUIRED_BEFORE_CLOSE',
          message: 'La politique actuelle exige au moins un justificatif avant de clôturer le dossier.'
        });
      }
    }

    const nowIso = new Date().toISOString();
    const prevStatus = dispute.status;
    dispute.status = status;
    dispute.updatedAt = nowIso;

    if (status === 'resolue') {
      dispute.resolvedAt = dispute.resolvedAt || nowIso;
      dispute.decisionSummary = redactSensitiveText(reason || 'Réclamation acceptée et résolue.');
    } else if (status === 'rejetee') {
      dispute.resolvedAt = dispute.resolvedAt || nowIso;
      dispute.rejectionReason = redactSensitiveText(reason);
      dispute.decisionSummary = `Réclamation rejetée : ${dispute.rejectionReason}`;
    } else if (status === 'cloturee') {
      dispute.closedAt = nowIso;
      dispute.archived = true;
    } else {
      dispute.archived = false;
    }

    dispute.timeline.push({
      id: `tl-${crypto.randomUUID().slice(0, 8)}`,
      kind: status === 'resolue' || status === 'rejetee' ? 'decision' : 'status_change',
      visibility: 'actors_and_admin',
      at: nowIso,
      authorId: actor.id,
      authorName: actor.name,
      authorRole: 'admin',
      title: `Changement de statut : ${prevStatus} → ${status}`,
      message: redactSensitiveText(reason || `Statut mis à jour vers ${status} par ${actor.name}.`),
      beforeStatus: prevStatus,
      afterStatus: status
    });
    persistDisputesDb();

    if (status === 'resolue' || status === 'rejetee') {
      pushDisputeNotification({
        dispute,
        eventType: 'admin_decision',
        title: status === 'resolue' ? 'Décision administrative : réclamation acceptée' : 'Décision administrative : réclamation rejetée',
        body: `${dispute.code} — ${dispute.decisionSummary}`,
        audience: 'all_involved',
        auditActionType: 'dispute_decision_made',
        auditSeverity: 'eleve'
      });
    } else if (status === 'cloturee') {
      pushDisputeNotification({
        dispute,
        eventType: 'dispute_closed',
        title: 'Dossier de réclamation clôturé',
        body: `Le dossier ${dispute.code} a été clôturé par ${actor.name}.`,
        audience: 'all_involved',
        auditActionType: 'dispute_closed',
        auditSeverity: 'moyen'
      });
    } else {
      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'order_disputes',
        actionType: 'dispute_status_updated',
        action: `Statut dossier ${dispute.code} : ${prevStatus} → ${status}`,
        target: dispute.code,
        targetType: 'order',
        result: 'reussi',
        severity: 'faible',
        details: reason || `Mise à jour statut par ${actor.name}`
      });
    }
    persistDisputesDb();

    res.json({ success: true, dispute: sanitizeDisputeForActor(dispute, perms) });
  });

  // 8. Messages, Actor Contact, Request Evidence, Internal Admin Note
  app.post('/api/disputes/:id/messages', requireDisputePermission('investigateAndMediate'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { disputeAuthCtx: AuthenticatedRequestContext }).disputeAuthCtx;
    const actor = authCtx.staff!;
    const perms = getEffectivePermissions(actor.id, actor.role);
    const dispute = disputesDb.disputes.find((d) => d.id === req.params.id);
    if (!dispute) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });
    if (!canAgentAccessDispute(dispute, actor.id, perms)) {
      return res.status(403).json({ success: false, error: 'ACCESS_DENIED', message: 'Accès refusé.' });
    }

    const {
      kind = 'admin_to_actor',
      message,
      targetActorRole = 'client',
      actorResponseMode,
      switchStatusToAwaitingEvidence = false
    } = req.body || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, error: 'MESSAGE_REQUIRED', message: 'Le message ne peut pas être vide.' });
    }

    const nowIso = new Date().toISOString();
    const isInternal = kind === 'internal_note';
    const isEvidenceReq = kind === 'evidence_request';
    const isActorReply = kind === 'actor_message';

    let authorId = actor.id;
    let authorName = actor.name;
    let authorRole: DisputeActorRoleType | 'system' = 'admin';

    if (isActorReply && actorResponseMode) {
      const matched =
        actorResponseMode === 'client'
          ? dispute.actors.client
          : actorResponseMode === 'seller'
          ? dispute.actors.seller
          : actorResponseMode === 'driver'
          ? dispute.actors.driver
          : actorResponseMode === 'company'
          ? dispute.actors.company
          : undefined;
      if (matched) {
        authorId = matched.accountId;
        authorName = `${matched.name} (saisi par ${actor.name})`;
        authorRole = matched.roleType;
      }
    }

    const prevStatus = dispute.status;
    if (isEvidenceReq && switchStatusToAwaitingEvidence && dispute.status !== 'cloturee') {
      dispute.status = 'en_attente_justificatifs';
    }
    dispute.updatedAt = nowIso;

    const titleMap: Record<string, string> = {
      internal_note: 'Note interne administration (confidentielle)',
      evidence_request: `Demande de justificatifs → ${targetActorRole}`,
      actor_message: `Réponse enregistrée (${authorRole})`,
      admin_to_actor: `Message administration → ${targetActorRole === 'all_actors' ? 'Tous les acteurs' : targetActorRole}`
    };

    dispute.timeline.push({
      id: `tl-${crypto.randomUUID().slice(0, 8)}`,
      kind: isInternal ? 'internal_note' : isEvidenceReq ? 'evidence_request' : isActorReply ? 'actor_message' : 'admin_to_actor',
      visibility: isInternal ? 'admin_only' : 'actors_and_admin',
      at: nowIso,
      authorId,
      authorName,
      authorRole,
      targetActorRole: isInternal ? undefined : targetActorRole,
      title: titleMap[kind] || 'Échange sur le dossier',
      message: redactSensitiveText(String(message).trim()),
      beforeStatus: prevStatus !== dispute.status ? prevStatus : undefined,
      afterStatus: prevStatus !== dispute.status ? dispute.status : undefined
    });
    persistDisputesDb();

    if (isEvidenceReq) {
      pushDisputeNotification({
        dispute,
        eventType: 'evidence_requested',
        title: 'Demande de preuve envoyée',
        body: `Justificatifs demandés à (${targetActorRole}) sur ${dispute.code}.`,
        audience: targetActorRole === 'client' || targetActorRole === 'seller' || targetActorRole === 'driver' || targetActorRole === 'company' ? targetActorRole : 'all_involved',
        auditActionType: 'dispute_evidence_requested',
        auditSeverity: 'moyen'
      });
    } else if (!isInternal) {
      pushDisputeNotification({
        dispute,
        eventType: 'new_message',
        title: 'Nouveau message sur litige',
        body: `${authorName} a publié un message sur ${dispute.code}.`,
        audience: isActorReply ? 'admins' : targetActorRole === 'all_actors' ? 'all_involved' : targetActorRole,
        auditActionType: 'dispute_message_received',
        auditSeverity: 'moyen'
      });
    }
    persistDisputesDb();

    res.json({ success: true, dispute: sanitizeDisputeForActor(dispute, perms) });
  });

  // 9. Add Immutable Evidence (and detect reused SHA-256 hashes!)
  app.post('/api/disputes/:id/evidence', requireDisputePermission('investigateAndMediate'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { disputeAuthCtx: AuthenticatedRequestContext }).disputeAuthCtx;
    const actor = authCtx.staff!;
    const perms = getEffectivePermissions(actor.id, actor.role);
    const dispute = disputesDb.disputes.find((d) => d.id === req.params.id);
    if (!dispute) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });

    const { kind = 'document', title, description = '', urlOrData = '', mimeType = '', fileSizeBytes = 0, submittedByRole = 'client' } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, error: 'TITLE_REQUIRED', message: 'Titre de pièce justificative requis.' });
    }

    const nowIso = new Date().toISOString();
    const rawHashSeed = String(urlOrData || `${title}:${description}`);
    const sha256 = crypto.createHash('sha256').update(rawHashSeed).digest('hex');

    const submitterRole: DisputeActorRoleType = ['client', 'seller', 'driver', 'company', 'admin'].includes(submittedByRole)
      ? submittedByRole
      : 'admin';
    const submitterName =
      submitterRole === 'client'
        ? dispute.actors.client?.name || dispute.declarant.name
        : submitterRole === 'seller'
        ? dispute.actors.seller?.name || 'Vendeur'
        : submitterRole === 'driver'
        ? dispute.actors.driver?.name || 'Livreur'
        : submitterRole === 'company'
        ? dispute.actors.company?.name || 'Entreprise livraison'
        : actor.name;

    const item: DisputeEvidenceItem = {
      id: `ev-${crypto.randomUUID().slice(0, 10)}`,
      kind: kind as DisputeEvidenceKind,
      title: redactSensitiveText(String(title).trim()),
      description: description ? redactSensitiveText(String(description).trim()) : undefined,
      urlOrData: urlOrData ? String(urlOrData) : undefined,
      mimeType: mimeType ? String(mimeType) : undefined,
      fileSizeBytes: Number(fileSizeBytes || 0),
      sha256,
      addedAt: nowIso,
      addedById: actor.id,
      addedByName: submitterName,
      addedByRole: submitterRole,
      immutableOriginal: true
    };

    dispute.evidence.push(item);
    dispute.updatedAt = nowIso;
    dispute.timeline.push({
      id: `tl-${crypto.randomUUID().slice(0, 8)}`,
      kind: 'evidence_submitted',
      visibility: 'actors_and_admin',
      at: nowIso,
      authorId: actor.id,
      authorName: submitterName,
      authorRole: submitterRole,
      title: `Justificatif ajouté : ${item.title}`,
      message: `Pièce horodatée conservée de façon immuable (SHA-256 : ${sha256.slice(0, 12)}…).`
    });
    dispute.abuseIndicators = evaluateAbuseAndFraudSignals(dispute);
    persistDisputesDb();

    pushDisputeNotification({
      dispute,
      eventType: 'evidence_received',
      title: 'Nouveau justificatif reçu',
      body: `Pièce « ${item.title} » ajoutée au dossier ${dispute.code} par ${submitterName}.`,
      audience: 'admins',
      auditActionType: 'dispute_evidence_added',
      auditSeverity: 'moyen'
    });
    persistDisputesDb();

    res.json({ success: true, evidence: item, dispute: sanitizeDisputeForActor(dispute, perms) });
  });

  // 9B. Block any deletion/tampering of original proofs!
  app.delete('/api/disputes/:id/evidence/:evId', requireDisputePermission('viewDisputes'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { disputeAuthCtx: AuthenticatedRequestContext }).disputeAuthCtx;
    const actor = authCtx.staff!;
    const dispute = disputesDb.disputes.find((d) => d.id === req.params.id);
    if (dispute) {
      dispute.abuseIndicators.push({
        id: `ab-tamper-${crypto.randomUUID().slice(0, 6)}`,
        code: 'EVIDENCE_TAMPER_ATTEMPT',
        severity: 'critique',
        label: 'Tentative de suppression de justificatif bloquée',
        detail: `${actor.name} a tenté de supprimer la pièce ${req.params.evId}.`,
        automaticSignalOnly: true,
        detectedAt: new Date().toISOString()
      });
      persistDisputesDb();
    }
    appendAuditEntry({
      actorId: actor.id,
      actorName: actor.name,
      actorAccountLabel: actor.email,
      actorRole: actor.role,
      space: 'admin',
      category: 'security',
      actionType: 'dispute_evidence_tamper_blocked',
      action: `Tentative de suppression de preuve bloquée (${req.params.id})`,
      target: req.params.evId,
      targetType: 'system',
      result: 'bloque',
      severity: 'critique',
      details: 'Les justificatifs originaux sont immuables et protégés contre la suppression.'
    });
    return res.status(403).json({
      success: false,
      error: 'EVIDENCE_IMMUTABLE',
      message: 'Suppression interdite : les pièces justificatives originales sont protégées et inaltérables.'
    });
  });

  // 10. Mediation workflow
  app.post('/api/disputes/:id/mediation', requireDisputePermission('investigateAndMediate'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { disputeAuthCtx: AuthenticatedRequestContext }).disputeAuthCtx;
    const actor = authCtx.staff!;
    const perms = getEffectivePermissions(actor.id, actor.role);
    const dispute = disputesDb.disputes.find((d) => d.id === req.params.id);
    if (!dispute) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });

    const { action = 'start', proposedSettlement = '', outcome, outcomeNote = '', clientAccepted, sellerAccepted } = req.body || {};
    const nowIso = new Date().toISOString();
    const prevStatus = dispute.status;

    if (action === 'start') {
      dispute.status = 'en_mediation';
      dispute.mediation = {
        active: true,
        startedAt: nowIso,
        moderatorId: actor.id,
        moderatorName: actor.name,
        proposedSettlement: redactSensitiveText(proposedSettlement || 'Proposition de conciliation amiable en cours'),
        deadlineAt: new Date(Date.now() + disputesDb.settings.mediationMaxHours * 3_600_000).toISOString(),
        clientAccepted: false,
        sellerAccepted: false,
        outcome: 'en_cours'
      };
      dispute.timeline.push({
        id: `tl-${crypto.randomUUID().slice(0, 8)}`,
        kind: 'mediation_event',
        visibility: 'actors_and_admin',
        at: nowIso,
        authorId: actor.id,
        authorName: actor.name,
        authorRole: 'admin',
        title: 'Médiation ouverte entre les parties',
        message: dispute.mediation.proposedSettlement || 'Médiation ouverte.',
        beforeStatus: prevStatus,
        afterStatus: 'en_mediation'
      });
    } else {
      dispute.mediation = {
        ...dispute.mediation,
        proposedSettlement: proposedSettlement ? redactSensitiveText(proposedSettlement) : dispute.mediation.proposedSettlement,
        clientAccepted: typeof clientAccepted === 'boolean' ? clientAccepted : dispute.mediation.clientAccepted,
        sellerAccepted: typeof sellerAccepted === 'boolean' ? sellerAccepted : dispute.mediation.sellerAccepted,
        outcome: outcome || dispute.mediation.outcome,
        outcomeNote: outcomeNote ? redactSensitiveText(outcomeNote) : dispute.mediation.outcomeNote,
        active: outcome === 'accord_trouve' || outcome === 'echec_arbitrage_admin' ? false : dispute.mediation.active
      };
      if (outcome === 'accord_trouve') {
        dispute.status = 'resolue';
        dispute.resolvedAt = nowIso;
        dispute.decisionSummary = `Accord de médiation validé : ${dispute.mediation.outcomeNote || dispute.mediation.proposedSettlement || ''}`;
      } else if (outcome === 'echec_arbitrage_admin') {
        dispute.status = 'en_cours_investigation';
      }
      dispute.timeline.push({
        id: `tl-${crypto.randomUUID().slice(0, 8)}`,
        kind: 'mediation_event',
        visibility: 'actors_and_admin',
        at: nowIso,
        authorId: actor.id,
        authorName: actor.name,
        authorRole: 'admin',
        title: outcome === 'accord_trouve' ? 'Accord de médiation trouvé' : outcome === 'echec_arbitrage_admin' ? 'Médiation close sans accord → arbitrage admin' : 'Mise à jour médiation',
        message: redactSensitiveText(outcomeNote || proposedSettlement || 'Suivi médiation mis à jour.'),
        beforeStatus: prevStatus,
        afterStatus: dispute.status
      });
    }
    dispute.updatedAt = nowIso;
    persistDisputesDb();
    res.json({ success: true, dispute: sanitizeDisputeForActor(dispute, perms) });
  });

  // 11. Financial Operation 1: Block Funds (Honest provider check + internal ledger hold)
  app.post(
    '/api/disputes/:id/financial/block',
    requireDisputePermission('requestRefundOrRelease', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { disputeAuthCtx: AuthenticatedRequestContext }).disputeAuthCtx;
      const actor = authCtx.staff!;
      const perms = getEffectivePermissions(actor.id, actor.role);
      const dispute = disputesDb.disputes.find((d) => d.id === req.params.id);
      if (!dispute) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });

      const { amountFcfa, mode = 'internal_ledger', reason = 'Séquestre conservatoire litige' } = req.body || {};
      const amount = Math.min(dispute.financial.disputedAmountFcfa || dispute.amountFcfa, Math.max(0, Math.round(Number(amountFcfa || dispute.amountFcfa))));
      const providers = getProviderCapabilities();
      const targetProvider = providers.find((p) => p.id === mode);

      const nowIso = new Date().toISOString();
      if (mode !== 'internal_ledger' && (!targetProvider || !targetProvider.supportsDirectBlock)) {
        dispute.financial.blockStatus = 'bloque_externe_non_disponible';
        dispute.financial.transactions.unshift({
          id: `ftx-${crypto.randomUUID().slice(0, 8)}`,
          type: 'blocage_fonds',
          amountFcfa: amount,
          channel: mode,
          providerConfigured: Boolean(targetProvider?.configured),
          providerStatus: 'bloque_prestataire_non_configure',
          reference: `NO-DIRECT-BLOCK-${Date.now()}`,
          initiatedById: actor.id,
          initiatedByName: actor.name,
          createdAt: nowIso,
          proofNote: targetProvider?.statusDetail || 'Blocage direct externe non supporté par ce prestataire.'
        });
        dispute.updatedAt = nowIso;
        persistDisputesDb();
        return res.status(422).json({
          success: false,
          error: 'EXTERNAL_BLOCK_NOT_SUPPORTED',
          message: `Impossible de bloquer directement les fonds via « ${mode} » : prestataire non configuré ou ne supportant pas le gel API. Utilisez la protection sur le registre interne DJASSA.`,
          dispute: sanitizeDisputeForActor(dispute, perms)
        });
      }

      // Real internal ledger hold / payout protection
      const targetAccountId = dispute.actors.seller?.accountId || dispute.accusedActor.accountId;
      dispute.financial.blockedAmountFcfa = amount;
      dispute.financial.blockStatus = 'bloque_registre_interne';
      dispute.financial.financialManagerId = actor.id;
      dispute.financial.financialManagerName = actor.name;
      const ref = `HOLD-${dispute.code}-${Date.now().toString().slice(-4)}`;
      dispute.financial.transactions.unshift({
        id: `ftx-${crypto.randomUUID().slice(0, 8)}`,
        type: 'blocage_fonds',
        amountFcfa: amount,
        channel: 'internal_ledger',
        providerConfigured: true,
        providerStatus: 'confirme_registre_interne',
        reference: ref,
        initiatedById: actor.id,
        initiatedByName: actor.name,
        createdAt: nowIso,
        confirmedAt: nowIso,
        proofNote: redactSensitiveText(reason)
      });
      dispute.timeline.push({
        id: `tl-${crypto.randomUUID().slice(0, 8)}`,
        kind: 'financial_event',
        visibility: 'admin_only',
        at: nowIso,
        authorId: actor.id,
        authorName: actor.name,
        authorRole: 'admin',
        title: `Blocage conservatoire registre interne (${amount.toLocaleString('fr-FR')} FCFA)`,
        message: `Compte ${targetAccountId} • Réf ${ref} • ${reason}`
      });
      dispute.updatedAt = nowIso;
      persistDisputesDb();

      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'payments',
        actionType: 'dispute_funds_blocked',
        action: `Séquestre / blocage registre interne (${dispute.code})`,
        target: `${targetAccountId} • ${amount} FCFA`,
        targetType: 'finance',
        result: 'reussi',
        severity: 'eleve',
        details: reason
      });

      res.json({ success: true, dispute: sanitizeDisputeForActor(dispute, perms) });
    }
  );

  // 12. Financial Operation 2: Request / Execute Authorized Refund (Anti-duplicate, MFA, Provider Honesty, Dual Control)
  app.post(
    '/api/disputes/:id/financial/refund',
    requireDisputePermission('requestRefundOrRelease', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { disputeAuthCtx: AuthenticatedRequestContext }).disputeAuthCtx;
      const actor = authCtx.staff!;
      const perms = getEffectivePermissions(actor.id, actor.role);
      const dispute = disputesDb.disputes.find((d) => d.id === req.params.id);
      if (!dispute) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });

      const {
        amountFcfa,
        channel = 'internal_ledger',
        reason = '',
        confirmationText = '',
        externalProviderReference = ''
      } = req.body || {};

      if (String(confirmationText).trim().toUpperCase() !== 'CONFIRMER') {
        return res.status(400).json({
          success: false,
          error: 'CONFIRMATION_REQUIRED',
          message: 'Saisissez « CONFIRMER » pour valider le déclenchement du remboursement.'
        });
      }

      const amount = Math.round(Number(amountFcfa || 0));
      const maxAllowed = dispute.financial.disputedAmountFcfa || dispute.amountFcfa;
      if (!amount || amount <= 0 || amount > maxAllowed) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_REFUND_AMOUNT',
          message: `Le montant doit être compris entre 1 et ${maxAllowed.toLocaleString('fr-FR')} FCFA.`
        });
      }

      // ANTI-DOUBLE REMBOURSEMENT GUARD
      const existingPendingOrConfirmed =
        dispute.financial.refundStatus === 'en_attente_double_validation' ||
        dispute.financial.refundStatus === 'en_attente_confirmation_prestataire' ||
        dispute.financial.refundedAmountFcfa + amount > maxAllowed ||
        disputesDb.approvalRequests.some(
          (r) => r.disputeId === dispute.id && r.actionType === 'remboursement' && r.status === 'en_attente_double_validation'
        );

      if (existingPendingOrConfirmed) {
        dispute.abuseIndicators = evaluateAbuseAndFraudSignals(dispute);
        persistDisputesDb();
        return res.status(409).json({
          success: false,
          error: 'DUPLICATE_REFUND_BLOCKED',
          message: 'Blocage anti-double remboursement : un remboursement a déjà été effectué ou est déjà en cours pour ce dossier/montant.'
        });
      }

      const providers = getProviderCapabilities();
      const cap = providers.find((p) => p.id === channel);
      const nowIso = new Date().toISOString();

      // External provider WITHOUT API configuration MUST NOT claim to execute automatically!
      if (channel !== 'internal_ledger' && (!cap || !cap.supportsDirectRefund)) {
        const txRef = externalProviderReference ? String(externalProviderReference).trim() : `EXT-PEND-${dispute.code}-${Date.now().toString().slice(-4)}`;
        dispute.financial.amountToRefundFcfa = amount;
        dispute.financial.refundStatus = 'en_attente_confirmation_prestataire';
        dispute.financial.refundReference = txRef;
        dispute.financial.financialManagerId = actor.id;
        dispute.financial.financialManagerName = actor.name;
        dispute.financial.transactions.unshift({
          id: `ftx-${crypto.randomUUID().slice(0, 8)}`,
          type: 'remboursement',
          amountFcfa: amount,
          channel,
          providerConfigured: false,
          providerStatus: 'en_attente_confirmation_prestataire',
          reference: txRef,
          initiatedById: actor.id,
          initiatedByName: actor.name,
          createdAt: nowIso,
          proofNote: redactSensitiveText(
            `${reason || 'Demande enregistrée'} — Prestataire ${channel} non connecté automatiquement ; confirmation manuelle de preuve requise avant marquage « Confirmé ».`
          )
        });
        dispute.timeline.push({
          id: `tl-${crypto.randomUUID().slice(0, 8)}`,
          kind: 'financial_event',
          visibility: 'admin_only',
          at: nowIso,
          authorId: actor.id,
          authorName: actor.name,
          authorRole: 'admin',
          title: `Remboursement en attente confirmation prestataire (${channel})`,
          message: `Montant : ${amount.toLocaleString('fr-FR')} FCFA • Réf : ${txRef} (non confirmé tant que le reçu prestataire n’est pas validé).`
        });
        dispute.updatedAt = nowIso;
        persistDisputesDb();

        return res.json({
          success: true,
          awaitingProviderConfirmation: true,
          message: `Demande enregistrée en statut « En attente confirmation prestataire » (${channel} non configuré en API directe). Fournissez la référence vérifiée pour confirmer.`,
          dispute: sanitizeDisputeForActor(dispute, perms)
        });
      }

      // Check Dual Validation threshold (Four-Eyes Check)
      const dualStaffAvailable = getSecurityStaffDirectory().filter(
        (s) => s.active && getEffectivePermissions(s.id, s.role).approveFinancialDisputeOp
      ).length >= 2;
      const needsDual =
        amount > disputesDb.settings.requireDualValidationForRefundOverFcfa && dualStaffAvailable;

      if (needsDual) {
        const reqObj: DisputeFinancialApprovalRequest = {
          id: `dfin-${crypto.randomUUID().slice(0, 10)}`,
          disputeId: dispute.id,
          disputeCode: dispute.code,
          actionType: 'remboursement',
          amountFcfa: amount,
          channel,
          targetAccountId: dispute.actors.client?.accountId || dispute.declarant.accountId,
          targetAccountName: dispute.actors.client?.name || dispute.declarant.name,
          reason: redactSensitiveText(reason || `Remboursement dossier ${dispute.code}`),
          requestedById: actor.id,
          requestedByName: actor.name,
          requestedAt: nowIso,
          status: 'en_attente_double_validation'
        };
        disputesDb.approvalRequests.unshift(reqObj);
        dispute.financial.amountToRefundFcfa = amount;
        dispute.financial.refundStatus = 'en_attente_double_validation';
        dispute.financial.financialManagerId = actor.id;
        dispute.financial.financialManagerName = actor.name;
        dispute.timeline.push({
          id: `tl-${crypto.randomUUID().slice(0, 8)}`,
          kind: 'financial_event',
          visibility: 'admin_only',
          at: nowIso,
          authorId: actor.id,
          authorName: actor.name,
          authorRole: 'admin',
          title: `Demande de remboursement soumise à double validation (${amount.toLocaleString('fr-FR')} FCFA)`,
          message: `Seuil > ${disputesDb.settings.requireDualValidationForRefundOverFcfa.toLocaleString('fr-FR')} FCFA : approbation d’un second agent financier requise.`
        });
        dispute.updatedAt = nowIso;
        persistDisputesDb();
        return res.json({
          success: true,
          dualValidationRequired: true,
          approvalRequest: reqObj,
          dispute: sanitizeDisputeForActor(dispute, perms)
        });
      }

      // Below dual threshold & internal_ledger: execute immediately via server ledger
      const ref = `RBT-${dispute.code}-${Date.now().toString().slice(-4)}`;
      const ledgerRes = applyVerifiedLedgerAction({
        mode: 'exceptional_refund',
        targetId: dispute.id,
        accountId: dispute.actors.client?.accountId || dispute.declarant.accountId,
        amountFcfa: amount,
        actorName: actor.name,
        reason: reason || `Remboursement litige ${dispute.code}`,
        reference: ref
      });

      if (!ledgerRes.ok) {
        return res.status(400).json({ success: false, error: 'LEDGER_ERROR', message: ledgerRes.message });
      }

      dispute.financial.refundedAmountFcfa += amount;
      dispute.financial.amountToRefundFcfa = Math.max(0, dispute.financial.amountToRefundFcfa - amount);
      dispute.financial.refundStatus = 'confirme';
      dispute.financial.blockStatus =
        dispute.financial.refundedAmountFcfa >= maxAllowed ? 'rembourse_total' : 'rembourse_partiel';
      dispute.financial.refundReference = ref;
      dispute.financial.refundDate = nowIso;
      dispute.financial.refundProof = `Écriture registre vérifiée (${ref})`;
      dispute.financial.financialManagerId = actor.id;
      dispute.financial.financialManagerName = actor.name;
      dispute.financial.transactions.unshift({
        id: `ftx-${crypto.randomUUID().slice(0, 8)}`,
        type: 'remboursement',
        amountFcfa: amount,
        channel,
        providerConfigured: true,
        providerStatus: 'confirme_registre_interne',
        reference: ref,
        initiatedById: actor.id,
        initiatedByName: actor.name,
        approvedById: actor.id,
        approvedByName: actor.name,
        createdAt: nowIso,
        confirmedAt: nowIso,
        proofNote: redactSensitiveText(reason || 'Remboursement registre interne exécuté.')
      });
      dispute.timeline.push({
        id: `tl-${crypto.randomUUID().slice(0, 8)}`,
        kind: 'financial_event',
        visibility: 'actors_and_admin',
        at: nowIso,
        authorId: actor.id,
        authorName: actor.name,
        authorRole: 'admin',
        title: `Remboursement confirmé (${amount.toLocaleString('fr-FR')} FCFA)`,
        message: `Réf ${ref} • Exécuté sur le registre serveur.`
      });
      dispute.updatedAt = nowIso;
      persistDisputesDb();

      pushDisputeNotification({
        dispute,
        eventType: 'refund_confirmed',
        title: 'Remboursement confirmé',
        body: `Remboursement de ${amount.toLocaleString('fr-FR')} FCFA confirmé (${ref}) sur ${dispute.code}.`,
        audience: 'all_involved',
        auditActionType: 'dispute_refund_confirmed',
        auditSeverity: 'eleve'
      });
      persistDisputesDb();

      res.json({ success: true, dispute: sanitizeDisputeForActor(dispute, perms) });
    }
  );

  // 12B. Confirm pending external provider refund with explicit proof reference
  app.post(
    '/api/disputes/:id/financial/confirm-external',
    requireDisputePermission('approveFinancialDisputeOp', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { disputeAuthCtx: AuthenticatedRequestContext }).disputeAuthCtx;
      const actor = authCtx.staff!;
      const perms = getEffectivePermissions(actor.id, actor.role);
      const dispute = disputesDb.disputes.find((d) => d.id === req.params.id);
      if (!dispute) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });

      if (dispute.financial.refundStatus !== 'en_attente_confirmation_prestataire') {
        return res.status(400).json({ success: false, error: 'NO_PENDING_EXTERNAL_REFUND', message: 'Aucun remboursement externe en attente de confirmation.' });
      }
      const { providerReceiptRef, proofNote = '' } = req.body || {};
      if (!providerReceiptRef || String(providerReceiptRef).trim().length < 4) {
        return res.status(400).json({ success: false, error: 'RECEIPT_REF_REQUIRED', message: 'Référence de reçu prestataire obligatoire.' });
      }

      const nowIso = new Date().toISOString();
      const amount = dispute.financial.amountToRefundFcfa;
      dispute.financial.refundedAmountFcfa += amount;
      dispute.financial.amountToRefundFcfa = 0;
      dispute.financial.refundStatus = 'confirme';
      dispute.financial.blockStatus =
        dispute.financial.refundedAmountFcfa >= (dispute.financial.disputedAmountFcfa || dispute.amountFcfa)
          ? 'rembourse_total'
          : 'rembourse_partiel';
      dispute.financial.refundReference = String(providerReceiptRef).trim();
      dispute.financial.refundDate = nowIso;
      dispute.financial.refundProof = redactSensitiveText(proofNote || `Reçu externe confirmé : ${providerReceiptRef}`);

      const pendingTx = dispute.financial.transactions.find((t) => t.providerStatus === 'en_attente_confirmation_prestataire');
      if (pendingTx) {
        pendingTx.providerStatus = 'confirme_prestataire';
        pendingTx.approvedById = actor.id;
        pendingTx.approvedByName = actor.name;
        pendingTx.confirmedAt = nowIso;
        pendingTx.reference = String(providerReceiptRef).trim();
        pendingTx.proofRef = String(providerReceiptRef).trim();
      }
      dispute.timeline.push({
        id: `tl-${crypto.randomUUID().slice(0, 8)}`,
        kind: 'financial_event',
        visibility: 'actors_and_admin',
        at: nowIso,
        authorId: actor.id,
        authorName: actor.name,
        authorRole: 'admin',
        title: `Remboursement prestataire confirmé (${amount.toLocaleString('fr-FR')} FCFA)`,
        message: `Réf reçu : ${providerReceiptRef} • Confirmé par ${actor.name}.`
      });
      dispute.updatedAt = nowIso;
      persistDisputesDb();

      pushDisputeNotification({
        dispute,
        eventType: 'refund_confirmed',
        title: 'Remboursement externe confirmé',
        body: `Preuve prestataire ${providerReceiptRef} validée sur ${dispute.code} (${amount.toLocaleString('fr-FR')} FCFA).`,
        audience: 'all_involved',
        auditActionType: 'dispute_refund_confirmed',
        auditSeverity: 'eleve'
      });
      persistDisputesDb();

      res.json({ success: true, dispute: sanitizeDisputeForActor(dispute, perms) });
    }
  );

  // 13. Dual Validation Decide (Four-Eyes Check)
  app.post(
    '/api/disputes/financial-requests/:reqId/decide',
    requireDisputePermission('approveFinancialDisputeOp', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { disputeAuthCtx: AuthenticatedRequestContext }).disputeAuthCtx;
      const actor = authCtx.staff!;
      const reqObj = disputesDb.approvalRequests.find((r) => r.id === req.params.reqId);
      if (!reqObj) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Demande financière introuvable.' });

      if (reqObj.status !== 'en_attente_double_validation') {
        return res.json({ success: true, idempotentDuplicate: true, approvalRequest: reqObj });
      }

      const { decision = 'approve', note = '' } = req.body || {};
      if (decision === 'approve' && reqObj.requestedById === actor.id) {
        return res.status(403).json({
          success: false,
          error: 'SELF_APPROVAL_FORBIDDEN',
          message: 'Double validation requise : un second responsable autorisé différent du demandeur doit approuver ce remboursement ou déblocage.'
        });
      }

      const dispute = disputesDb.disputes.find((d) => d.id === reqObj.disputeId);
      const nowIso = new Date().toISOString();

      if (decision === 'reject' || decision === 'cancel') {
        reqObj.status = decision === 'cancel' ? 'annulee' : 'rejetee';
        reqObj.decidedById = actor.id;
        reqObj.decidedByName = actor.name;
        reqObj.decidedAt = nowIso;
        reqObj.executionMessage = redactSensitiveText(note || 'Demande refusée par le second contrôleur.');
        if (dispute) {
          dispute.financial.refundStatus = 'rejete';
          dispute.financial.amountToRefundFcfa = 0;
          dispute.timeline.push({
            id: `tl-${crypto.randomUUID().slice(0, 8)}`,
            kind: 'financial_event',
            visibility: 'admin_only',
            at: nowIso,
            authorId: actor.id,
            authorName: actor.name,
            authorRole: 'admin',
            title: `Opération financière rejetée (${reqObj.amountFcfa.toLocaleString('fr-FR')} FCFA)`,
            message: reqObj.executionMessage
          });
          dispute.updatedAt = nowIso;
        }
        persistDisputesDb();
        return res.json({ success: true, approvalRequest: reqObj, dispute });
      }

      if (!dispute) {
        return res.status(404).json({ success: false, error: 'DISPUTE_NOT_FOUND', message: 'Dossier associé introuvable.' });
      }

      const ref = `${reqObj.actionType === 'remboursement' ? 'RBT' : 'REL'}-${dispute.code}-${Date.now().toString().slice(-4)}`;
      if (reqObj.actionType === 'remboursement') {
        const ledgerRes = applyVerifiedLedgerAction({
          mode: 'exceptional_refund',
          targetId: dispute.id,
          accountId: reqObj.targetAccountId,
          amountFcfa: reqObj.amountFcfa,
          actorName: `${reqObj.requestedByName} + ${actor.name}`,
          reason: reqObj.reason,
          reference: ref
        });
        if (!ledgerRes.ok) {
          return res.status(400).json({ success: false, error: 'LEDGER_ERROR', message: ledgerRes.message });
        }
        dispute.financial.refundedAmountFcfa += reqObj.amountFcfa;
        dispute.financial.amountToRefundFcfa = 0;
        dispute.financial.refundStatus = 'confirme';
        dispute.financial.blockStatus =
          dispute.financial.refundedAmountFcfa >= (dispute.financial.disputedAmountFcfa || dispute.amountFcfa)
            ? 'rembourse_total'
            : 'rembourse_partiel';
        dispute.financial.refundReference = ref;
        dispute.financial.refundDate = nowIso;
        dispute.financial.refundProof = `Double validation (${reqObj.requestedByName} + ${actor.name}) • Réf ${ref}`;
        dispute.financial.transactions.unshift({
          id: `ftx-${crypto.randomUUID().slice(0, 8)}`,
          type: 'remboursement',
          amountFcfa: reqObj.amountFcfa,
          channel: reqObj.channel,
          providerConfigured: true,
          providerStatus: 'confirme_registre_interne',
          reference: ref,
          initiatedById: reqObj.requestedById,
          initiatedByName: reqObj.requestedByName,
          approvedById: actor.id,
          approvedByName: actor.name,
          createdAt: nowIso,
          confirmedAt: nowIso,
          proofNote: reqObj.reason
        });

        pushDisputeNotification({
          dispute,
          eventType: 'refund_confirmed',
          title: 'Remboursement approuvé & confirmé',
          body: `${reqObj.amountFcfa.toLocaleString('fr-FR')} FCFA remboursés (${ref}) après double validation.`,
          audience: 'all_involved',
          auditActionType: 'dispute_refund_confirmed',
          auditSeverity: 'eleve'
        });
      } else {
        dispute.financial.blockedAmountFcfa = 0;
        dispute.financial.blockStatus = 'libere';
        dispute.financial.transactions.unshift({
          id: `ftx-${crypto.randomUUID().slice(0, 8)}`,
          type: 'liberation_fonds',
          amountFcfa: reqObj.amountFcfa,
          channel: reqObj.channel,
          providerConfigured: true,
          providerStatus: 'confirme_registre_interne',
          reference: ref,
          initiatedById: reqObj.requestedById,
          initiatedByName: reqObj.requestedByName,
          approvedById: actor.id,
          approvedByName: actor.name,
          createdAt: nowIso,
          confirmedAt: nowIso,
          proofNote: reqObj.reason
        });
        pushDisputeNotification({
          dispute,
          eventType: 'funds_released',
          title: 'Fonds libérés après double validation',
          body: `${reqObj.amountFcfa.toLocaleString('fr-FR')} FCFA débloqués (${ref}) sur ${dispute.code}.`,
          audience: 'all_involved',
          auditActionType: 'dispute_funds_released',
          auditSeverity: 'eleve'
        });
      }

      reqObj.status = 'approuvee';
      reqObj.decidedById = actor.id;
      reqObj.decidedByName = actor.name;
      reqObj.decidedAt = nowIso;
      reqObj.executionMessage = `Exécuté avec double validation (${ref}).`;
      dispute.updatedAt = nowIso;
      persistDisputesDb();

      res.json({ success: true, approvalRequest: reqObj, dispute });
    }
  );

  // 14. Release Blocked Funds
  app.post(
    '/api/disputes/:id/financial/release',
    requireDisputePermission('requestRefundOrRelease', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { disputeAuthCtx: AuthenticatedRequestContext }).disputeAuthCtx;
      const actor = authCtx.staff!;
      const perms = getEffectivePermissions(actor.id, actor.role);
      const dispute = disputesDb.disputes.find((d) => d.id === req.params.id);
      if (!dispute) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });

      const { reason = 'Libération autorisée des fonds bloqués', confirmationText = '' } = req.body || {};
      if (String(confirmationText).trim().toUpperCase() !== 'CONFIRMER') {
        return res.status(400).json({ success: false, error: 'CONFIRMATION_REQUIRED', message: 'Saisissez « CONFIRMER » pour autoriser le déblocage.' });
      }
      if (dispute.financial.blockedAmountFcfa <= 0) {
        return res.status(400).json({ success: false, error: 'NO_BLOCKED_FUNDS', message: 'Aucun montant actuellement bloqué sur ce dossier.' });
      }

      const amount = dispute.financial.blockedAmountFcfa;
      const nowIso = new Date().toISOString();
      const ref = `REL-${dispute.code}-${Date.now().toString().slice(-4)}`;
      dispute.financial.blockedAmountFcfa = 0;
      dispute.financial.blockStatus = 'libere';
      dispute.financial.financialManagerId = actor.id;
      dispute.financial.financialManagerName = actor.name;
      dispute.financial.transactions.unshift({
        id: `ftx-${crypto.randomUUID().slice(0, 8)}`,
        type: 'liberation_fonds',
        amountFcfa: amount,
        channel: 'internal_ledger',
        providerConfigured: true,
        providerStatus: 'confirme_registre_interne',
        reference: ref,
        initiatedById: actor.id,
        initiatedByName: actor.name,
        approvedById: actor.id,
        approvedByName: actor.name,
        createdAt: nowIso,
        confirmedAt: nowIso,
        proofNote: redactSensitiveText(reason)
      });
      dispute.timeline.push({
        id: `tl-${crypto.randomUUID().slice(0, 8)}`,
        kind: 'financial_event',
        visibility: 'actors_and_admin',
        at: nowIso,
        authorId: actor.id,
        authorName: actor.name,
        authorRole: 'admin',
        title: `Fonds libérés (${amount.toLocaleString('fr-FR')} FCFA)`,
        message: `Réf ${ref} • ${reason}`
      });
      dispute.updatedAt = nowIso;
      persistDisputesDb();

      pushDisputeNotification({
        dispute,
        eventType: 'funds_released',
        title: 'Fonds libérés',
        body: `Fonds de ${amount.toLocaleString('fr-FR')} FCFA débloqués (${ref}) sur ${dispute.code}.`,
        audience: 'all_involved',
        auditActionType: 'dispute_funds_released',
        auditSeverity: 'eleve'
      });
      persistDisputesDb();

      res.json({ success: true, dispute: sanitizeDisputeForActor(dispute, perms) });
    }
  );

  // 15. Apply Verified Sanction per DJASSA Rules
  app.post(
    '/api/disputes/:id/sanction',
    requireDisputePermission('applySanction', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { disputeAuthCtx: AuthenticatedRequestContext }).disputeAuthCtx;
      const actor = authCtx.staff!;
      const perms = getEffectivePermissions(actor.id, actor.role);
      const dispute = disputesDb.disputes.find((d) => d.id === req.params.id);
      if (!dispute) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Dossier introuvable.' });

      const {
        targetRole = 'seller',
        sanctionType = 'avertissement',
        reason = '',
        durationDays = 7,
        confirmationText = ''
      } = req.body || {};

      if (String(confirmationText).trim().toUpperCase() !== 'CONFIRMER') {
        return res.status(400).json({ success: false, error: 'CONFIRMATION_REQUIRED', message: 'Confirmation écrite « CONFIRMER » requise pour appliquer une sanction.' });
      }
      if (!reason || String(reason).trim().length < 5) {
        return res.status(400).json({ success: false, error: 'SANCTION_REASON_REQUIRED', message: 'Motif précis requis (minimum 5 caractères).' });
      }

      const targetActor =
        targetRole === 'client'
          ? dispute.actors.client || dispute.declarant
          : targetRole === 'driver'
          ? dispute.actors.driver || dispute.accusedActor
          : targetRole === 'company'
          ? dispute.actors.company || dispute.accusedActor
          : dispute.actors.seller || dispute.accusedActor;

      const safeSanctionAccountType: 'client' | 'seller' | 'admin' =
        targetActor.roleType === 'admin'
          ? 'admin'
          : targetActor.roleType === 'seller'
          ? 'seller'
          : 'client';
      const secRes = applyVerifiedDisputeSanction({
        accountId: targetActor.accountId,
        accountName: targetActor.name,
        accountEmail: targetActor.emailFull,
        accountType: safeSanctionAccountType,
        sanctionType,
        reason,
        actorName: actor.name,
        durationDays: Number(durationDays || 7)
      });

      const nowIso = new Date().toISOString();
      dispute.sanctions.unshift({
        id: `snc-${crypto.randomUUID().slice(0, 8)}`,
        targetAccountId: targetActor.accountId,
        targetName: targetActor.name,
        targetRole: targetActor.roleType,
        sanctionType,
        reason: redactSensitiveText(reason),
        appliedById: actor.id,
        appliedByName: actor.name,
        appliedAt: nowIso,
        durationDays: sanctionType === 'suspension_permanente' ? undefined : Number(durationDays || 7),
        activeBlockApplied: secRes.activeBlockApplied
      });

      if (secRes.activeBlockApplied) {
        targetActor.accountStatus = 'suspended';
      }

      dispute.timeline.push({
        id: `tl-${crypto.randomUUID().slice(0, 8)}`,
        kind: 'sanction_event',
        visibility: 'actors_and_admin',
        at: nowIso,
        authorId: actor.id,
        authorName: actor.name,
        authorRole: 'admin',
        title: `Sanction appliquée à ${targetActor.name} (${sanctionType})`,
        message: redactSensitiveText(reason)
      });
      dispute.updatedAt = nowIso;
      persistDisputesDb();

      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'order_disputes',
        actionType: 'dispute_sanction_applied',
        action: `Sanction ${sanctionType} appliquée (${dispute.code})`,
        target: `${targetActor.name} (${targetActor.accountId})`,
        targetType: 'account',
        result: 'reussi',
        severity: 'eleve',
        details: reason
      });

      res.json({ success: true, dispute: sanitizeDisputeForActor(dispute, perms) });
    }
  );

  // 16. Mark dispute notification as read
  app.post('/api/disputes/notifications/:notifId/read', requireDisputePermission('viewDisputes'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { disputeAuthCtx: AuthenticatedRequestContext }).disputeAuthCtx;
    const actor = authCtx.staff!;
    const n = disputesDb.notifications.find((x) => x.id === req.params.notifId);
    if (n && !n.readByActorIds.includes(actor.id)) {
      n.readByActorIds.push(actor.id);
      persistDisputesDb();
    }
    res.json({ success: true });
  });

  // 17. Update Dispute Module Settings (scoped ONLY to disputes module)
  app.patch(
    '/api/disputes/settings',
    requireDisputePermission('manageDisputeSettings', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { disputeAuthCtx: AuthenticatedRequestContext }).disputeAuthCtx;
      const actor = authCtx.staff!;
      const patch = req.body || {};
      const next = { ...disputesDb.settings };

      if (Array.isArray(patch.categories)) {
        next.categories = next.categories.map((existing) => {
          const incoming = patch.categories.find((c: any) => c?.key === existing.key);
          if (!incoming) return existing;
          return {
            ...existing,
            enabled: typeof incoming.enabled === 'boolean' ? incoming.enabled : existing.enabled,
            defaultPriority: ['faible', 'normal', 'urgent'].includes(incoming.defaultPriority)
              ? incoming.defaultPriority
              : existing.defaultPriority,
            slaHours: typeof incoming.slaHours === 'number' ? Math.max(1, Math.min(360, incoming.slaHours)) : existing.slaHours
          };
        });
      }
      if (patch.slaHoursByPriority) {
        (['urgent', 'normal', 'faible'] as DisputePriority[]).forEach((p) => {
          if (typeof patch.slaHoursByPriority[p] === 'number') {
            next.slaHoursByPriority[p] = Math.max(1, Math.min(360, patch.slaHoursByPriority[p]));
          }
        });
      }
      if (patch.autoAssignMode && ['manuel', 'equilibre_charge'].includes(patch.autoAssignMode)) {
        next.autoAssignMode = patch.autoAssignMode;
      }
      if (typeof patch.autoEscalationOnSlaBreach === 'boolean') next.autoEscalationOnSlaBreach = patch.autoEscalationOnSlaBreach;
      if (typeof patch.requireDualValidationForRefundOverFcfa === 'number') {
        next.requireDualValidationForRefundOverFcfa = Math.max(0, patch.requireDualValidationForRefundOverFcfa);
      }
      if (typeof patch.requireProofBeforeClose === 'boolean') next.requireProofBeforeClose = patch.requireProofBeforeClose;
      if (typeof patch.preventCloseWithPendingRefund === 'boolean') next.preventCloseWithPendingRefund = patch.preventCloseWithPendingRefund;
      if (typeof patch.allowReopenWithinDays === 'number') next.allowReopenWithinDays = Math.max(0, Math.min(90, patch.allowReopenWithinDays));
      if (typeof patch.evidenceRetentionDays === 'number') next.evidenceRetentionDays = Math.max(30, Math.min(3650, patch.evidenceRetentionDays));
      if (typeof patch.mediationMaxHours === 'number') next.mediationMaxHours = Math.max(6, Math.min(240, patch.mediationMaxHours));
      if (patch.antiFraudThresholds && typeof patch.antiFraudThresholds === 'object') {
        next.antiFraudThresholds = { ...next.antiFraudThresholds, ...patch.antiFraudThresholds };
      }
      if (patch.notificationsEnabled && typeof patch.notificationsEnabled === 'object') {
        next.notificationsEnabled = { ...next.notificationsEnabled, ...patch.notificationsEnabled };
      }

      disputesDb.settings = next;
      persistDisputesDb();

      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'order_disputes',
        actionType: 'dispute_settings_updated',
        action: 'Paramètres du module Réclamations & litiges mis à jour',
        target: 'Paramètres litiges',
        targetType: 'settings',
        result: 'reussi',
        severity: 'eleve',
        details: `Affectation=${next.autoAssignMode}, Double validation > ${next.requireDualValidationForRefundOverFcfa} FCFA, Rétention preuves=${next.evidenceRetentionDays}j`
      });

      res.json({ success: true, settings: next });
    }
  );

  // 18. Update Agent Permissions (Super Admin only)
  app.patch(
    '/api/disputes/permissions/:staffId',
    requireDisputePermission('manageDisputeSettings', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { disputeAuthCtx: AuthenticatedRequestContext }).disputeAuthCtx;
      const actor = authCtx.staff!;
      if (actor.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'SUPER_ADMIN_REQUIRED',
          message: 'Seul le Super Administrateur peut modifier les permissions du module Litiges.'
        });
      }

      const staffTarget = getSecurityStaffDirectory().find((s) => s.id === req.params.staffId);
      if (!staffTarget) return res.status(404).json({ success: false, error: 'STAFF_NOT_FOUND', message: 'Collaborateur introuvable.' });
      if (staffTarget.role === 'super_admin') {
        return res.status(400).json({ success: false, error: 'SUPER_ADMIN_IMMUTABLE', message: 'Les droits Super Admin sont globaux et non révocables.' });
      }

      const incoming = (req.body?.permissions || {}) as Partial<Record<DisputePermissionKey, boolean>>;
      const updated = { ...getEffectivePermissions(staffTarget.id, staffTarget.role) };
      ALL_DISPUTE_PERMISSIONS.forEach((k) => {
        if (typeof incoming[k] === 'boolean') updated[k] = incoming[k]!;
      });
      disputesDb.staffPermissions[staffTarget.id] = updated;
      persistDisputesDb();

      appendAuditEntry({
        actorId: actor.id,
        actorName: actor.name,
        actorAccountLabel: actor.email,
        actorRole: actor.role,
        space: 'admin',
        category: 'admin_mgmt',
        actionType: 'dispute_permissions_updated',
        action: `Permissions Litiges modifiées pour ${staffTarget.name}`,
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

export function getDisputesSnapshotForRefunds(): DisputeRecord[] {
  return disputesDb.disputes;
}

export function syncRefundConfirmationIntoDispute(params: {
  disputeId?: string;
  disputeCode?: string;
  amountFcfa: number;
  refundReference: string;
  actorId: string;
  actorName: string;
  status: 'pending' | 'confirmed' | 'failed';
  channel: string;
}): boolean {
  const dispute = disputesDb.disputes.find(
    (d) => (params.disputeId && d.id === params.disputeId) || (params.disputeCode && d.code === params.disputeCode)
  );
  if (!dispute) return false;

  const nowIso = new Date().toISOString();
  const maxAllowed = dispute.financial.disputedAmountFcfa || dispute.amountFcfa;

  if (params.status === 'confirmed') {
    const alreadyRecorded = dispute.financial.transactions.some((t) => t.reference === params.refundReference);
    if (!alreadyRecorded) {
      dispute.financial.refundedAmountFcfa = Math.min(maxAllowed, dispute.financial.refundedAmountFcfa + params.amountFcfa);
      dispute.financial.amountToRefundFcfa = Math.max(0, maxAllowed - dispute.financial.refundedAmountFcfa);
      dispute.financial.refundStatus = 'confirme';
      dispute.financial.blockStatus =
        dispute.financial.refundedAmountFcfa >= maxAllowed ? 'rembourse_total' : 'rembourse_partiel';
      dispute.financial.refundReference = params.refundReference;
      dispute.financial.refundDate = nowIso;
      dispute.financial.refundProof = `Synchronisé depuis Remboursements & indemnisations (${params.refundReference})`;
      dispute.financial.transactions.unshift({
        id: `ftx-sync-${crypto.randomUUID().slice(0, 8)}`,
        type: 'remboursement',
        amountFcfa: params.amountFcfa,
        channel: params.channel,
        providerConfigured: true,
        providerStatus: params.channel === 'internal_ledger' ? 'confirme_registre_interne' : 'confirme_prestataire',
        reference: params.refundReference,
        initiatedById: params.actorId,
        initiatedByName: params.actorName,
        approvedById: params.actorId,
        approvedByName: params.actorName,
        createdAt: nowIso,
        confirmedAt: nowIso,
        proofNote: 'Synchronisé depuis le module Remboursements & indemnisations'
      });
      dispute.timeline.push({
        id: `tl-${crypto.randomUUID().slice(0, 8)}`,
        kind: 'financial_event',
        visibility: 'actors_and_admin',
        at: nowIso,
        authorId: params.actorId,
        authorName: params.actorName,
        authorRole: 'admin',
        title: `Remboursement confirmé (${params.amountFcfa.toLocaleString('fr-FR')} FCFA)`,
        message: `Réf ${params.refundReference} • Synchronisé depuis Remboursements & indemnisations.`
      });
      dispute.updatedAt = nowIso;
      persistDisputesDb();
    }
    return true;
  }

  if (params.status === 'failed') {
    dispute.financial.refundStatus = 'echoue';
    dispute.timeline.push({
      id: `tl-${crypto.randomUUID().slice(0, 8)}`,
      kind: 'financial_event',
      visibility: 'admin_only',
      at: nowIso,
      authorId: params.actorId,
      authorName: params.actorName,
      authorRole: 'admin',
      title: `Échec de versement remboursement (${params.refundReference})`,
      message: `Le versement via ${params.channel} a échoué dans Remboursements & indemnisations.`
    });
    dispute.updatedAt = nowIso;
    persistDisputesDb();
    return true;
  }

  return true;
}

