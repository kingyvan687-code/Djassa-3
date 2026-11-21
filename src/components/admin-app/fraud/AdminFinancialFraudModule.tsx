import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Ban,
  Bell,
  CheckCircle2,
  CreditCard,
  FileSearch,
  History,
  KeyRound,
  Link2,
  Lock,
  RefreshCw,
  Scale,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sliders,
  Users,
  Wallet,
  X
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { fraudService } from '../../../services/fraudService';
import { securityService } from '../../../services/securityService';
import { formatFCFA } from '../../../services/marketServices';
import type {
  FraudAccountWatchRecord,
  FraudActorSpace,
  FraudAlertRecord,
  FraudAlertStatus,
  FraudLinkedAccountsCluster,
  FraudOverviewResponse,
  FraudPermissionKey,
  FraudRiskLevel,
  SensitiveFinanceActionType
} from '../../../types/fraud';

type FraudSectionKey =
  | 'overview'
  | 'payments'
  | 'withdrawals'
  | 'wallets'
  | 'orders'
  | 'linked'
  | 'alerts'
  | 'blocked'
  | 'history'
  | 'rules'
  | 'settings';

interface AdminFinancialFraudModuleProps {
  onOpenNotifications?: () => void;
  onOpenAudit?: () => void;
}

const FRAUD_NAV: Array<{ id: FraudSectionKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Vue générale', icon: Activity },
  { id: 'payments', label: 'Transactions suspectes', icon: CreditCard },
  { id: 'withdrawals', label: 'Retraits suspects', icon: ArrowUpRight },
  { id: 'wallets', label: 'Portefeuilles', icon: Wallet },
  { id: 'orders', label: 'Fraudes commandes', icon: ShoppingBag },
  { id: 'linked', label: 'Comptes liés', icon: Link2 },
  { id: 'alerts', label: 'Alertes & enquêtes', icon: ShieldAlert },
  { id: 'blocked', label: 'Opérations bloquées', icon: Ban },
  { id: 'history', label: 'Historique fraudes', icon: History },
  { id: 'rules', label: 'Règles de détection', icon: Sliders },
  { id: 'settings', label: 'Paramètres & droits', icon: Settings }
];

const RISK_BADGE: Record<FraudRiskLevel, { label: string; cls: string }> = {
  faible: { label: 'Risque faible', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  moyen: { label: 'Risque moyen', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  eleve: { label: 'Risque élevé', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  critique: { label: 'Risque critique', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40' }
};

const ALERT_STATUS_LABEL: Record<FraudAlertStatus, { label: string; cls: string }> = {
  nouvelle: { label: 'Nouvelle', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  en_cours: { label: 'En cours d’analyse', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  en_attente_justificatifs: { label: 'Attente justificatifs', cls: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  suspicion_ecartee: { label: 'Suspicion écartée', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  fraude_confirmee: { label: 'Fraude confirmée', cls: 'bg-rose-600/30 text-rose-200 border-rose-400/50' },
  transmise_decision: { label: 'Transmise décision', cls: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  cloturee: { label: 'Clôturée', cls: 'bg-white/10 text-white/60 border-white/15' }
};

const FRAUD_PERMISSION_LABELS: Record<FraudPermissionKey, string> = {
  viewFraudDashboard: 'Tableau de bord & alertes',
  viewSensitiveFraudDetails: 'Détails financiers démasqués',
  manageInvestigations: 'Enquêtes & décisions fraude',
  requestSensitiveFinanceAction: 'Initier action sensible',
  approveDualControlAction: '2e validation (Four-Eyes)',
  manageFraudRules: 'Règles & seuils anti-fraude',
  manageAccountWatch: 'Surveillance comptes (5 espaces)'
};

const SENSITIVE_ACTION_OPTIONS: Array<{ id: SensitiveFinanceActionType; label: string }> = [
  { id: 'release_critical_operation', label: 'Libérer une opération critique bloquée' },
  { id: 'manual_balance_adjustment', label: 'Ajustement manuel de solde (écriture registre)' },
  { id: 'exceptional_refund', label: 'Valider un remboursement exceptionnel' },
  { id: 'modify_financial_coordinates', label: 'Modifier des coordonnées financières' },
  { id: 'cancel_confirmed_transaction', label: 'Annuler une transaction confirmée' },
  { id: 'unlock_suspended_wallet', label: 'Débloquer une opération/portefeuille suspendu' },
  { id: 'modify_critical_fraud_rules', label: 'Autoriser règle critique anti-fraude' }
];

export const AdminFinancialFraudModule: React.FC<AdminFinancialFraudModuleProps> = ({
  onOpenNotifications,
  onOpenAudit
}) => {
  const { showToast } = useApp();
  const [section, setSection] = useState<FraudSectionKey>('overview');
  const [data, setData] = useState<FraudOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [spaceFilter, setSpaceFilter] = useState<'all' | FraudActorSpace>('all');
  const [riskFilter, setRiskFilter] = useState<'all' | FraudRiskLevel>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Investigation drawer / modal
  const [selectedAlert, setSelectedAlert] = useState<FraudAlertRecord | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [justifInput, setJustifInput] = useState('');
  const [evidenceInput, setEvidenceInput] = useState('');
  const [closureInput, setClosureInput] = useState('');
  const [busyAction, setBusyAction] = useState(false);

  // Server payment check form
  const [payRef, setPayRef] = useState('');
  const [payOrderId, setPayOrderId] = useState('');
  const [payAccountId, setPayAccountId] = useState('');
  const [payChannel, setPayChannel] = useState('wave');
  const [payExpected, setPayExpected] = useState('');
  const [payPaid, setPayPaid] = useState('');
  const [payClientOnly, setPayClientOnly] = useState(false);

  // Server order check form
  const [ordId, setOrdId] = useState('');
  const [ordSellerId, setOrdSellerId] = useState('');
  const [ordAmt, setOrdAmt] = useState('');
  const [ordExpected, setOrdExpected] = useState('');
  const [ordMissingPod, setOrdMissingPod] = useState(false);
  const [ordPostModified, setOrdPostModified] = useState(false);

  // Sensitive action request form
  const [showSensitiveModal, setShowSensitiveModal] = useState(false);
  const [saType, setSaType] = useState<SensitiveFinanceActionType>('release_critical_operation');
  const [saTargetId, setSaTargetId] = useState('');
  const [saAccountId, setSaAccountId] = useState('');
  const [saAmount, setSaAmount] = useState('');
  const [saReason, setSaReason] = useState('');
  const [saSummary, setSaSummary] = useState('');

  // Step-Up MFA modal state
  const [mfaModal, setMfaModal] = useState<{
    title: string;
    challengeCode: string | null;
    codeInput: string;
    onVerified: (code: string) => Promise<void>;
  } | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fraudService.getOverview();
      setData(res);
      setSelectedAlert((prev) => (prev ? res.alerts.find((a) => a.id === prev.id) || prev : null));
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Impossible de charger la détection des fraudes financières.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const requestMfaAndRun = async (title: string, fn: (code: string) => Promise<void>) => {
    try {
      const challenge = await securityService.requestMfaChallenge();
      setMfaModal({
        title,
        challengeCode: challenge.verificationCodePreview || null,
        codeInput: challenge.verificationCodePreview || '',
        onVerified: fn
      });
    } catch (err: unknown) {
      showToast((err as Error).message || 'Erreur initialisation MFA');
    }
  };

  const handleConfirmMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaModal) return;
    const modal = mfaModal;
    setBusyAction(true);
    try {
      await modal.onVerified(modal.codeInput.trim());
      setMfaModal(null);
      await loadOverview();
    } catch (err: unknown) {
      showToast((err as Error).message || 'Action refusée');
    } finally {
      setBusyAction(false);
    }
  };

  const handleVerifyPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payRef.trim()) return;
    setBusyAction(true);
    try {
      const res = await fraudService.verifyPayment({
        transactionRef: payRef.trim(),
        orderId: payOrderId.trim() || undefined,
        accountId: payAccountId.trim() || 'client-inconnu',
        channel: payChannel,
        expectedAmountFcfa: Number(payExpected) || 0,
        paidAmountFcfa: Number(payPaid) || 0,
        clientClaimedSuccess: payClientOnly,
        screenshotOnly: payClientOnly
      });
      showToast(
        res.alert
          ? `Anomalie détectée (${res.alert.riskLevel}) — alerte ${res.alert.id} ouverte`
          : `Contrôle serveur enregistré (${res.payment.providerStatus})`
      );
      setPayRef('');
      setPayOrderId('');
      await loadOverview();
    } catch (err: unknown) {
      showToast((err as Error).message || 'Erreur contrôle paiement');
    } finally {
      setBusyAction(false);
    }
  };

  const handleVerifyOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ordId.trim()) return;
    setBusyAction(true);
    try {
      const res = await fraudService.verifyOrderAnomaly({
        orderId: ordId.trim(),
        sellerId: ordSellerId.trim() || 'vendeur-inconnu',
        amountFcfa: Number(ordAmt) || 0,
        expectedAmountFcfa: ordExpected ? Number(ordExpected) : Number(ordAmt) || 0,
        deliveryStatus: ordMissingPod ? 'livree' : 'en_cours',
        hasDeliveryProof: !ordMissingPod,
        postPaymentModified: ordPostModified
      });
      showToast(
        res.alert
          ? `Anomalie commande détectée (${res.alert.riskLevel})`
          : 'Contrôle commande enregistré sans anomalie critique'
      );
      setOrdId('');
      await loadOverview();
    } catch (err: unknown) {
      showToast((err as Error).message || 'Erreur contrôle commande');
    } finally {
      setBusyAction(false);
    }
  };

  const handleUpdateAlert = async (
    alertId: string,
    payload: Parameters<typeof fraudService.updateAlert>[1],
    toastMsg: string
  ) => {
    setBusyAction(true);
    try {
      await fraudService.updateAlert(alertId, payload);
      showToast(toastMsg);
      setNoteInput('');
      setJustifInput('');
      setEvidenceInput('');
      setClosureInput('');
      await loadOverview();
    } catch (err: unknown) {
      showToast((err as Error).message || 'Erreur mise à jour enquête');
    } finally {
      setBusyAction(false);
    }
  };

  const openSensitiveModalFor = (
    type: SensitiveFinanceActionType,
    targetId: string,
    accountId: string,
    amountFcfa: number
  ) => {
    setSaType(type);
    setSaTargetId(targetId);
    setSaAccountId(accountId);
    setSaAmount(String(amountFcfa || 0));
    setSaReason('');
    setSaSummary('');
    setShowSensitiveModal(true);
  };

  const handleSubmitSensitiveAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowSensitiveModal(false);
    await requestMfaAndRun(`Double contrôle : ${saType}`, async (code) => {
      const res = await fraudService.requestSensitiveAction(
        {
          actionType: saType,
          targetId: saTargetId.trim() || saAccountId.trim(),
          accountId: saAccountId.trim() || saTargetId.trim(),
          amountFcfa: Number(saAmount) || 0,
          reason: saReason.trim(),
          payloadSummary: saSummary.trim() || saReason.trim()
        },
        code
      );
      showToast(
        res.request.requiresDualValidation
          ? 'Demande créée — en attente d’un 2e administrateur autorisé'
          : 'Action financière sensible exécutée et journalisée'
      );
    });
  };

  if (loading && !data) {
    return (
      <div className="p-6 rounded-2xl bg-[#141414] border border-white/10 text-center space-y-2">
        <RefreshCw className="w-5 h-5 text-amber-400 animate-spin mx-auto" />
        <p className="text-xs font-bold text-white/70">Analyse des flux financiers & journaux anti-fraude...</p>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-3 text-center">
        <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto" />
        <p className="text-xs font-bold text-rose-200">{errorMsg || 'Données indisponibles'}</p>
        <button
          onClick={() => void loadOverview()}
          className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white cursor-pointer"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const perms = data.actor.permissions;
  const searchLower = searchTerm.trim().toLowerCase();

  const filterBySpaceAndSearch = <T extends { space?: FraudActorSpace; accountLabelMasked?: string; accountId?: string }>(
    items: T[]
  ) =>
    items.filter((item) => {
      if (spaceFilter !== 'all' && item.space && item.space !== spaceFilter) return false;
      if (searchLower) {
        const hay = `${item.accountLabelMasked || ''} ${item.accountId || ''}`.toLowerCase();
        if (!hay.includes(searchLower)) return false;
      }
      return true;
    });

  const filteredAlerts = data.alerts.filter((a) => {
    if (spaceFilter !== 'all' && a.space !== spaceFilter) return false;
    if (riskFilter !== 'all' && a.riskLevel !== riskFilter) return false;
    if (searchLower) {
      const hay = `${a.id} ${a.title} ${a.accountLabelMasked} ${a.linkedTransactionRef || ''} ${a.linkedOrderId || ''}`.toLowerCase();
      if (!hay.includes(searchLower)) return false;
    }
    return true;
  });

  return (
    <div id="admin-financial-fraud-module" className="space-y-3.5 text-xs text-white">
      {/* Compact Header */}
      <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-white">Détection des fraudes financières</h3>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-300">
                Contrôle serveur actif
              </span>
            </div>
            <p className="text-[11px] text-white/50">
              Scoring 0–100, vérifications paiements/retraits/commandes & double validation (Four-Eyes)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {onOpenNotifications && (
            <button
              onClick={onOpenNotifications}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-white/80 flex items-center gap-1.5 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-[#FF6321]" />
              <span>Notifications</span>
            </button>
          )}
          {onOpenAudit && (
            <button
              onClick={onOpenAudit}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-white/80 flex items-center gap-1.5 cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-amber-400" />
              <span>Journal d’audit</span>
            </button>
          )}
          <button
            onClick={() => void loadOverview()}
            className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-[11px] font-bold text-amber-300 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* Horizontal 11-Section Sub-Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {FRAUD_NAV.map((item) => {
          const Icon = item.icon;
          const isActive = section === item.id;
          const badge =
            item.id === 'alerts' && data.kpis.pendingAlertsCount > 0
              ? data.kpis.pendingAlertsCount
              : item.id === 'blocked' && data.kpis.pendingDualValidationsCount + data.blockedOperations.length > 0
              ? data.kpis.pendingDualValidationsCount + data.blockedOperations.length
              : 0;
          return (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`shrink-0 px-2.5 py-2 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                isActive
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                  : 'bg-[#141414] border-white/10 text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{item.label}</span>
              {badge > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-rose-500 text-white text-[9px] font-black">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Shared Compact Filters Bar */}
      {['overview', 'payments', 'withdrawals', 'wallets', 'alerts', 'blocked'].includes(section) && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-2xl bg-[#111111] border border-white/10">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher référence, commande, compte..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-black/50 border border-white/10 text-[11px] text-white placeholder-white/30 focus:border-amber-400 outline-none"
            />
          </div>
          <select
            value={spaceFilter}
            onChange={(e) => setSpaceFilter(e.target.value as 'all' | FraudActorSpace)}
            className="px-2.5 py-1.5 rounded-xl bg-black/50 border border-white/10 text-[11px] font-bold text-white outline-none"
          >
            <option value="all">Tous les 5 espaces</option>
            <option value="client">Clients</option>
            <option value="seller">Vendeurs</option>
            <option value="driver">Livreurs</option>
            <option value="company">Entreprises livraison</option>
            <option value="admin">Admins & agents</option>
          </select>
          {section === 'alerts' && (
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as 'all' | FraudRiskLevel)}
              className="px-2.5 py-1.5 rounded-xl bg-black/50 border border-white/10 text-[11px] font-bold text-white outline-none"
            >
              <option value="all">Tous niveaux de risque</option>
              <option value="critique">Critique (75–100)</option>
              <option value="eleve">Élevé (50–74)</option>
              <option value="moyen">Moyen (25–49)</option>
              <option value="faible">Faible (0–24)</option>
            </select>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 1. VUE GÉNÉRALE                                                       */}
      {/* ===================================================================== */}
      {section === 'overview' && (
        <div className="space-y-3">
          {/* Honesty & Suspicion vs Confirmed Fraud Guard Banner */}
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5">
            <Scale className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold text-amber-200">
                Principe de séparation stricte : une alerte reste une suspicion jusqu’à confirmation humaine
              </p>
              <p className="text-[11px] text-white/65">
                {data.providerIntegration.externalVerificationMode} • Admins habilités double validation :{' '}
                <span className="font-bold text-white">{data.providerIntegration.dualControlAvailableAdminsCount}</span>
              </p>
            </div>
          </div>

          {/* 9 Required KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: 'Transactions surveillées', val: String(data.kpis.monitoredTransactionsCount), cls: 'text-white' },
              { label: 'Opérations suspectes', val: String(data.kpis.suspiciousOperationsCount), cls: 'text-amber-300' },
              { label: 'Fraudes confirmées', val: String(data.kpis.confirmedFraudsCount), cls: 'text-rose-400' },
              { label: 'Alertes en attente', val: String(data.kpis.pendingAlertsCount), cls: 'text-orange-300' },
              { label: 'Montant suspect détecté', val: formatFCFA(data.kpis.totalSuspiciousAmountFcfa), cls: 'text-amber-300' },
              { label: 'Pertes confirmées', val: formatFCFA(data.kpis.confirmedFinancialLossFcfa), cls: 'text-rose-400' },
              { label: 'Opérations bloquées (temp.)', val: formatFCFA(data.kpis.temporarilyBlockedAmountFcfa), cls: 'text-sky-300' },
              { label: 'Comptes sous surveillance', val: String(data.kpis.accountsUnderWatchCount), cls: 'text-purple-300' },
              {
                label: 'Dernière détection',
                val: data.kpis.lastDetectionAt ? new Date(data.kpis.lastDetectionAt).toLocaleString('fr-FR') : 'Aucune',
                cls: 'text-white/80'
              }
            ].map((kpi) => (
              <div key={kpi.label} className="p-3 rounded-2xl bg-[#141414] border border-white/10">
                <p className="text-[10px] text-white/50 font-medium">{kpi.label}</p>
                <p className={`text-sm font-black mt-1 font-mono tabular-nums ${kpi.cls}`}>{kpi.val}</p>
              </div>
            ))}
          </div>

          {/* Risk Classification Breakdown */}
          <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-white/70">
              Classification des alertes par niveau de risque
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['faible', 'moyen', 'eleve', 'critique'] as FraudRiskLevel[]).map((lvl) => (
                <div key={lvl} className={`p-2.5 rounded-xl border ${RISK_BADGE[lvl].cls}`}>
                  <p className="text-[10px] font-bold">{RISK_BADGE[lvl].label}</p>
                  <p className="text-base font-black font-mono mt-0.5">{data.kpis.byRiskLevel[lvl] || 0}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 5-Space Accounts Watch Directory */}
          <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-white/70 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>Surveillance des 5 espaces ({filterBySpaceAndSearch(data.accountsWatch).length})</span>
              </h4>
            </div>
            {filterBySpaceAndSearch(data.accountsWatch).length === 0 ? (
              <p className="text-[11px] text-white/40 py-4 text-center">
                Aucun compte enregistré dans cette vue pour le moment.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {filterBySpaceAndSearch(data.accountsWatch).map((acc: FraudAccountWatchRecord) => (
                  <div
                    key={`${acc.space}-${acc.accountId}`}
                    className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-white">{acc.accountLabelMasked}</span>
                        <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-bold text-white/70">
                          {acc.spaceLabel}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${
                            acc.watchStatus === 'normal'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                              : acc.watchStatus === 'operations_restreintes'
                              ? 'bg-rose-500/20 border-rose-500/30 text-rose-300'
                              : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                          }`}
                        >
                          {acc.watchStatus}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/50">
                        Opérations: {acc.operationsCount} • Paiements: {acc.paymentsCount} • Retraits: {acc.withdrawalsCount} • Modifs coord.:{' '}
                        {acc.payoutTargetChangesCount} {acc.payoutTargetMasked ? `• Cible: ${acc.payoutTargetMasked}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-white/60">Score max {acc.maxRiskScore}/100</span>
                      {perms.manageAccountWatch && (
                        <select
                          value={acc.watchStatus}
                          onChange={(e) =>
                            void fraudService
                              .updateAccountWatch(acc.accountId, {
                                watchStatus: e.target.value as FraudAccountWatchRecord['watchStatus'],
                                watchReason: 'Ajustement surveillance depuis Vue générale'
                              })
                              .then(() => {
                                showToast('Statut de surveillance mis à jour');
                                void loadOverview();
                              })
                              .catch((err) => showToast((err as Error).message))
                          }
                          className="px-2 py-1 rounded-lg bg-[#1A1A1A] border border-white/15 text-[10px] font-bold text-white"
                        >
                          <option value="normal">Normal</option>
                          <option value="surveillance_renforcee">Surveillance renforcée</option>
                          <option value="verification_requise">Vérification requise</option>
                          <option value="operations_restreintes">Opérations restreintes</option>
                        </select>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. TRANSACTIONS SUSPECTES (PAIEMENTS + VÉRIFICATION SERVEUR)          */}
      {/* ===================================================================== */}
      {section === 'payments' && (
        <div className="space-y-3">
          {perms.manageInvestigations && (
            <form onSubmit={handleVerifyPaymentSubmit} className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Vérification serveur d’une transaction de paiement</span>
                </h4>
                <span className="text-[10px] text-white/45">
                  {data.providerIntegration.geniusPayConfigured ? 'GeniusPay connecté' : 'Mode honnête sans clé externe'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="Référence transaction *"
                  className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-[11px] text-white outline-none focus:border-amber-400"
                />
                <input
                  type="text"
                  value={payOrderId}
                  onChange={(e) => setPayOrderId(e.target.value)}
                  placeholder="ID commande (optionnel)"
                  className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-[11px] text-white outline-none focus:border-amber-400"
                />
                <input
                  type="text"
                  value={payAccountId}
                  onChange={(e) => setPayAccountId(e.target.value)}
                  placeholder="ID / email compte client"
                  className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-[11px] text-white outline-none focus:border-amber-400"
                />
                <input
                  type="number"
                  value={payExpected}
                  onChange={(e) => setPayExpected(e.target.value)}
                  placeholder="Montant attendu (FCFA)"
                  className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-[11px] text-white outline-none focus:border-amber-400"
                />
                <input
                  type="number"
                  value={payPaid}
                  onChange={(e) => setPayPaid(e.target.value)}
                  placeholder="Montant reçu (FCFA)"
                  className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-[11px] text-white outline-none focus:border-amber-400"
                />
                <select
                  value={payChannel}
                  onChange={(e) => setPayChannel(e.target.value)}
                  className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-[11px] text-white outline-none"
                >
                  <option value="wave">Wave CI</option>
                  <option value="orange">Orange Money</option>
                  <option value="mtn">MTN MoMo</option>
                  <option value="geniuspay">GeniusPay</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-[11px] text-white/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={payClientOnly}
                    onChange={(e) => setPayClientOnly(e.target.checked)}
                    className="rounded border-white/20 bg-black"
                  />
                  <span>Preuve déclarée uniquement côté navigateur / capture d’écran (sans confirmation API)</span>
                </label>
                <button
                  type="submit"
                  disabled={busyAction}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] cursor-pointer disabled:opacity-50"
                >
                  Contrôler côté serveur
                </button>
              </div>
            </form>
          )}

          <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-white/70">
              Paiements analysés ({filterBySpaceAndSearch(data.suspiciousPayments).length})
            </h4>
            {filterBySpaceAndSearch(data.suspiciousPayments).length === 0 ? (
              <p className="text-[11px] text-white/40 py-6 text-center">Aucune transaction de paiement enregistrée.</p>
            ) : (
              <div className="space-y-2">
                {filterBySpaceAndSearch(data.suspiciousPayments).map((p) => (
                  <div key={p.id} className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-white">{p.transactionRef}</span>
                        <span className="text-white/60">{p.accountLabelMasked}</span>
                        <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${RISK_BADGE[p.riskLevel].cls}`}>
                          {RISK_BADGE[p.riskLevel].label} ({p.riskScore})
                        </span>
                      </div>
                      <span className="font-mono font-black text-amber-300">
                        {formatFCFA(p.paidAmountFcfa)} / att. {formatFCFA(p.expectedAmountFcfa)}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/55">
                      Canal: {p.channel} • Statut fournisseur: <span className="font-bold text-white/80">{p.providerStatus}</span> — {p.providerDetail}
                    </p>
                    {p.anomalyFlags.length > 0 && (
                      <ul className="space-y-0.5 text-[10px] text-rose-300">
                        {p.anomalyFlags.map((flag, i) => (
                          <li key={i}>• {flag}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. RETRAITS SUSPECTS                                                  */}
      {/* ===================================================================== */}
      {section === 'withdrawals' && (
        <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5">
          <h4 className="text-[11px] font-black uppercase tracking-wider text-white/70">
            Surveillance des retraits ({filterBySpaceAndSearch(data.suspiciousWithdrawals).length})
          </h4>
          {filterBySpaceAndSearch(data.suspiciousWithdrawals).length === 0 ? (
            <p className="text-[11px] text-white/40 py-6 text-center">Aucun retrait dans le registre financier serveur.</p>
          ) : (
            <div className="space-y-2">
              {filterBySpaceAndSearch(data.suspiciousWithdrawals).map((w) => (
                <div key={w.id} className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-white">{w.reference}</span>
                      <span className="text-white/70">{w.accountLabelMasked}</span>
                      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${RISK_BADGE[w.riskLevel].cls}`}>
                        {w.riskScore}/100
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-bold text-white/80">
                        {w.status}
                      </span>
                    </div>
                    <span className="font-mono font-black text-amber-300">{formatFCFA(w.amountFcfa)}</span>
                  </div>
                  <p className="text-[10px] text-white/50">
                    Canal: {w.channel} {w.payoutTargetMasked ? `• Bénéficiaire: ${w.payoutTargetMasked}` : ''} • Nouvel appareil:{' '}
                    {w.isNewDevice ? 'Oui' : 'Non'} • Comptes sur cette coord.: {w.sharedPayoutAccountsCount}
                  </p>
                  {w.suspicionReasons.length > 0 && (
                    <ul className="text-[10px] text-orange-300 space-y-0.5">
                      {w.suspicionReasons.map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  )}
                  {w.status === 'en_attente_verification' && perms.requestSensitiveFinanceAction && (
                    <div className="pt-1 flex flex-wrap gap-1.5">
                      <button
                        onClick={() =>
                          openSensitiveModalFor('release_critical_operation', w.id, w.accountId, w.amountFcfa)
                        }
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/30 text-[10px] font-bold text-amber-200 hover:bg-amber-500/30 cursor-pointer"
                      >
                        Demander libération (Double Validation)
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. PORTEFEUILLES                                                      */}
      {/* ===================================================================== */}
      {section === 'wallets' && (
        <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-white/70">
              Audit d’intégrité des portefeuilles ({filterBySpaceAndSearch(data.walletConsistencies).length})
            </h4>
            {perms.requestSensitiveFinanceAction && (
              <button
                onClick={() => openSensitiveModalFor('manual_balance_adjustment', '', '', 0)}
                className="px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-300 cursor-pointer"
              >
                + Ajustement comptable (Double Validation)
              </button>
            )}
          </div>
          {filterBySpaceAndSearch(data.walletConsistencies).length === 0 ? (
            <p className="text-[11px] text-white/40 py-6 text-center">Aucun portefeuille suivi.</p>
          ) : (
            <div className="space-y-2">
              {filterBySpaceAndSearch(data.walletConsistencies).map((w) => (
                <div key={w.accountId} className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{w.accountLabelMasked}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${
                          w.consistencyStatus === 'coherent'
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                            : w.consistencyStatus === 'anomalie_critique'
                            ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                            : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                        }`}
                      >
                        {w.consistencyStatus}
                      </span>
                    </div>
                    <span className="font-mono font-black text-emerald-300">
                      Registre: {formatFCFA(w.ledgerBalanceFcfa)}
                      {w.creditsWalletFcfa !== null ? ` • Crédits: ${formatFCFA(w.creditsWalletFcfa)}` : ''}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/50">
                    Crédits: {w.creditsCount} • Débits/Holds: {w.debitsCount} • En attente: {formatFCFA(w.pendingHoldsFcfa)} •
                    Tentatives édition directe bloquées: {w.directEditAttemptsCount}
                  </p>
                  {w.anomalyReasons.length > 0 && (
                    <ul className="text-[10px] text-rose-300 space-y-0.5">
                      {w.anomalyReasons.map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. FRAUDES LIÉES AUX COMMANDES                                        */}
      {/* ===================================================================== */}
      {section === 'orders' && (
        <div className="space-y-3">
          {perms.manageInvestigations && (
            <form onSubmit={handleVerifyOrderSubmit} className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5">
              <h4 className="font-black text-white">Contrôle financier commande / livraison / POD</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  required
                  value={ordId}
                  onChange={(e) => setOrdId(e.target.value)}
                  placeholder="ID Commande *"
                  className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-[11px] text-white outline-none"
                />
                <input
                  type="text"
                  value={ordSellerId}
                  onChange={(e) => setOrdSellerId(e.target.value)}
                  placeholder="ID Vendeur"
                  className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-[11px] text-white outline-none"
                />
                <input
                  type="number"
                  value={ordAmt}
                  onChange={(e) => setOrdAmt(e.target.value)}
                  placeholder="Montant actuel (FCFA)"
                  className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-[11px] text-white outline-none"
                />
                <input
                  type="number"
                  value={ordExpected}
                  onChange={(e) => setOrdExpected(e.target.value)}
                  placeholder="Montant initial payé"
                  className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-[11px] text-white outline-none"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-3 text-[11px] text-white/70">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={ordMissingPod} onChange={(e) => setOrdMissingPod(e.target.checked)} />
                    <span>Livrée sans preuve POD</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={ordPostModified} onChange={(e) => setOrdPostModified(e.target.checked)} />
                    <span>Modifiée après paiement</span>
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={busyAction}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] cursor-pointer"
                >
                  Analyser la commande
                </button>
              </div>
            </form>
          )}

          <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-white/70">
              Anomalies commandes & livraisons ({data.orderAnomalies.length})
            </h4>
            {data.orderAnomalies.length === 0 ? (
              <p className="text-[11px] text-white/40 py-6 text-center">Aucune anomalie commande détectée pour le moment.</p>
            ) : (
              <div className="space-y-2">
                {data.orderAnomalies.map((o) => (
                  <div key={o.id} className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-white">{o.orderId}</span>
                        <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${RISK_BADGE[o.riskLevel].cls}`}>
                          {o.riskScore}/100
                        </span>
                      </div>
                      <span className="font-mono text-amber-300 font-bold">{formatFCFA(o.amountFcfa)}</span>
                    </div>
                    <p className="text-[10px] text-white/50">
                      Acheteur: {o.buyerMasked} • Vendeur: {o.sellerMasked} {o.driverOrCompanyMasked ? `• Livreur: ${o.driverOrCompanyMasked}` : ''} • POD:{' '}
                      {o.hasDeliveryProof ? 'Présente' : 'Absente'}
                    </p>
                    <ul className="text-[10px] text-orange-300 space-y-0.5">
                      {o.anomalyTypes.map((t, i) => (
                        <li key={i}>• {t}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. COMPTES LIÉS                                                       */}
      {/* ===================================================================== */}
      {section === 'linked' && (
        <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5">
          <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/25 text-[11px] text-sky-200">
            Les regroupements ci-dessous sont des <strong>indices à vérifier</strong> (coordonnée de retrait partagée, signature réseau). Le système ne conclut jamais automatiquement à une fraude multi-comptes.
          </div>
          {data.linkedClusters.length === 0 ? (
            <p className="text-[11px] text-white/40 py-6 text-center">Aucun regroupement suspect de comptes détecté.</p>
          ) : (
            <div className="space-y-2">
              {data.linkedClusters.map((c: FraudLinkedAccountsCluster) => (
                <div key={c.id} className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-white">{c.signalSummary}</p>
                      <p className="text-[10px] text-white/50">
                        Indicateur partagé : <span className="font-mono text-amber-300">{c.sharedIndicatorMasked}</span>
                      </p>
                    </div>
                    {perms.manageInvestigations && (
                      <select
                        value={c.verificationStatus}
                        onChange={(e) =>
                          void fraudService
                            .updateLinkedCluster(c.id, {
                              verificationStatus: e.target.value as FraudLinkedAccountsCluster['verificationStatus']
                            })
                            .then(() => {
                              showToast('Qualification du lien enregistrée');
                              void loadOverview();
                            })
                            .catch((err) => showToast((err as Error).message))
                        }
                        className="px-2 py-1 rounded-lg bg-[#1A1A1A] border border-white/15 text-[10px] font-bold text-white"
                      >
                        <option value="indice_a_verifier">Indice à vérifier</option>
                        <option value="en_analyse">En analyse</option>
                        <option value="justifie_legitime">Justifié / Légitime</option>
                        <option value="collusion_confirmee">Collusion confirmée</option>
                      </select>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.accounts.map((a) => (
                      <span key={a.accountId} className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px]">
                        {a.accountLabelMasked} ({a.space})
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 7. ALERTES & ENQUÊTES                                                 */}
      {/* ===================================================================== */}
      {section === 'alerts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-white/70">
              File d’alertes anti-fraude ({filteredAlerts.length})
            </h4>
            {filteredAlerts.length === 0 ? (
              <p className="text-[11px] text-white/40 py-6 text-center">Aucune alerte correspondant aux filtres.</p>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {filteredAlerts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAlert(a)}
                    className={`w-full text-left p-3 rounded-xl border transition cursor-pointer space-y-1 ${
                      selectedAlert?.id === a.id
                        ? 'bg-amber-500/10 border-amber-400/50'
                        : 'bg-black/40 border-white/10 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white truncate">{a.title}</span>
                      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold shrink-0 ${RISK_BADGE[a.riskLevel].cls}`}>
                        {a.riskScore}/100
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-white/55">
                      <span>{a.accountLabelMasked} • {a.space}</span>
                      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${ALERT_STATUS_LABEL[a.status].cls}`}>
                        {ALERT_STATUS_LABEL[a.status].label}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Investigation Dossier */}
          <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-3">
            {!selectedAlert ? (
              <div className="py-12 text-center text-white/40 space-y-2">
                <FileSearch className="w-6 h-6 mx-auto opacity-60" />
                <p className="text-[11px]">Sélectionnez une alerte pour ouvrir le dossier d’enquête</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2.5">
                  <div>
                    <p className="font-black text-white text-sm">{selectedAlert.title}</p>
                    <p className="text-[10px] text-white/50">
                      ID {selectedAlert.id} • Score {selectedAlert.riskScore}/100 ({RISK_BADGE[selectedAlert.riskLevel].label}) • Montant {formatFCFA(selectedAlert.amountFcfa)}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${ALERT_STATUS_LABEL[selectedAlert.status].cls}`}>
                    {ALERT_STATUS_LABEL[selectedAlert.status].label}
                  </span>
                </div>

                {/* Score Breakdown */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-white/60 uppercase">Critères du score de risque</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedAlert.scoreBreakdown.map((b) => (
                      <span key={b.key} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px]">
                        {b.label}: +{b.score} pts ({b.reason})
                      </span>
                    ))}
                  </div>
                </div>

                {/* Immutable Evidences */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-white/60 uppercase">Preuves horodatées (non modifiables)</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedAlert.evidences.map((ev) => (
                      <div key={ev.id} className="p-2 rounded-lg bg-black/50 border border-white/10 text-[10px]">
                        <p className="text-white/80">{ev.summary}</p>
                        <p className="text-white/40 font-mono text-[9px]">
                          {new Date(ev.timestamp).toLocaleString('fr-FR')} • Empreinte {ev.immutableHash}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {perms.manageInvestigations && (
                  <div className="space-y-2 pt-1 border-t border-white/10">
                    <div className="flex flex-wrap gap-1.5">
                      <select
                        value={selectedAlert.assignedToId || ''}
                        onChange={(e) =>
                          void handleUpdateAlert(
                            selectedAlert.id,
                            { assignedToId: e.target.value || null },
                            'Assignation mise à jour'
                          )
                        }
                        className="px-2 py-1.5 rounded-lg bg-black/60 border border-white/15 text-[10px] font-bold text-white"
                      >
                        <option value="">Non assigné</option>
                        {data.staffPermissions.map((s) => (
                          <option key={s.staffId} value={s.staffId}>
                            Agent : {s.name}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() =>
                          void handleUpdateAlert(selectedAlert.id, { status: 'en_cours' }, 'Enquête passée en cours d’analyse')
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-200 cursor-pointer"
                      >
                        Prendre en charge
                      </button>
                      <button
                        onClick={() =>
                          void handleUpdateAlert(
                            selectedAlert.id,
                            { status: 'suspicion_ecartee' },
                            'Suspicion écartée (aucune fraude)'
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-300 cursor-pointer"
                      >
                        Écarter suspicion
                      </button>
                      <button
                        onClick={() =>
                          void handleUpdateAlert(
                            selectedAlert.id,
                            { status: 'fraude_confirmee', confirmedLossFcfa: selectedAlert.amountFcfa },
                            'Fraude confirmée enregistrée'
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-[10px] font-bold text-rose-200 cursor-pointer"
                      >
                        Confirmer fraude
                      </button>
                    </div>

                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="Ajouter une observation (sans secrets/OTP)..."
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-[11px] text-white outline-none"
                      />
                      <button
                        disabled={!noteInput.trim() || busyAction}
                        onClick={() => void handleUpdateAlert(selectedAlert.id, { note: noteInput }, 'Note ajoutée')}
                        className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold cursor-pointer disabled:opacity-40"
                      >
                        Noter
                      </button>
                    </div>

                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={justifInput}
                        onChange={(e) => setJustifInput(e.target.value)}
                        placeholder="Demander justificatif (ex: reçu Wave officiel)..."
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-[11px] text-white outline-none"
                      />
                      <button
                        disabled={!justifInput.trim() || busyAction}
                        onClick={() =>
                          void handleUpdateAlert(
                            selectedAlert.id,
                            { justificatifRequestNote: justifInput },
                            'Demande de justificatif envoyée'
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-sky-500/20 border border-sky-500/30 text-[10px] font-bold text-sky-200 cursor-pointer disabled:opacity-40"
                      >
                        Exiger pièce
                      </button>
                    </div>

                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={evidenceInput}
                        onChange={(e) => setEvidenceInput(e.target.value)}
                        placeholder="Consigner une preuve vérifiée..."
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-[11px] text-white outline-none"
                      />
                      <button
                        disabled={!evidenceInput.trim() || busyAction}
                        onClick={() =>
                          void handleUpdateAlert(selectedAlert.id, { evidenceSummary: evidenceInput }, 'Preuve scellée')
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-bold text-emerald-200 cursor-pointer disabled:opacity-40"
                      >
                        Sceller preuve
                      </button>
                    </div>

                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={closureInput}
                        onChange={(e) => setClosureInput(e.target.value)}
                        placeholder="Motif obligatoire pour clôturer le dossier..."
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-[11px] text-white outline-none"
                      />
                      <button
                        disabled={!closureInput.trim() || busyAction}
                        onClick={() =>
                          void handleUpdateAlert(
                            selectedAlert.id,
                            { status: 'cloturee', closureReason: closureInput },
                            'Dossier clôturé avec justification'
                          )
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-[10px] font-bold cursor-pointer disabled:opacity-40"
                      >
                        Clôturer
                      </button>
                    </div>
                  </div>
                )}

                {selectedAlert.notes.length > 0 && (
                  <div className="space-y-1 max-h-36 overflow-y-auto pt-1 border-t border-white/10">
                    <p className="text-[10px] font-bold text-white/60 uppercase">Journal d’enquête</p>
                    {selectedAlert.notes.map((n) => (
                      <div key={n.id} className="text-[10px] text-white/75 p-1.5 rounded bg-black/30">
                        <span className="font-bold text-white">{n.authorName}</span> : {n.content}
                        <span className="text-white/40 ml-1.5">({new Date(n.at).toLocaleString('fr-FR')})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 8. OPÉRATIONS BLOQUÉES & DOUBLE VALIDATION                            */}
      {/* ===================================================================== */}
      {section === 'blocked' && (
        <div className="space-y-3">
          {/* Dual Control Queue */}
          <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-black text-white flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>Double validation des actions financières sensibles (Four-Eyes Check)</span>
                </h4>
                <p className="text-[10px] text-white/50">
                  Un second administrateur autorisé distinct du demandeur + MFA sont exigés côté serveur.
                </p>
              </div>
              {perms.requestSensitiveFinanceAction && (
                <button
                  onClick={() => openSensitiveModalFor('release_critical_operation', '', '', 0)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] cursor-pointer"
                >
                  + Nouvelle demande sensible
                </button>
              )}
            </div>

            {data.sensitiveActionRequests.length === 0 ? (
              <p className="text-[11px] text-white/40 py-4 text-center">Aucune demande de validation sensible enregistrée.</p>
            ) : (
              <div className="space-y-2">
                {data.sensitiveActionRequests.map((reqItem) => {
                  const isOwnRequest = reqItem.requestedById === data.actor.staffId;
                  return (
                    <div key={reqItem.id} className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white">{reqItem.actionLabel}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              reqItem.status === 'en_attente_second_valideur'
                                ? 'bg-amber-500/20 text-amber-300'
                                : reqItem.status === 'approuvee_executee'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {reqItem.status}
                          </span>
                        </div>
                        {reqItem.amountFcfa > 0 && (
                          <span className="font-mono font-black text-amber-300">{formatFCFA(reqItem.amountFcfa)}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-white/55">
                        Cible: {reqItem.targetAccountMasked} • Demandeur: <span className="text-white font-bold">{reqItem.requestedByName}</span> • Motif: {reqItem.reason}
                      </p>
                      {reqItem.executionResult && (
                        <p className="text-[10px] text-emerald-300">Exécution : {reqItem.executionResult}</p>
                      )}
                      {reqItem.status === 'en_attente_second_valideur' && perms.approveDualControlAction && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {isOwnRequest ? (
                            <span className="text-[10px] text-amber-300 font-bold">
                              Auto-validation interdite : un 2e administrateur doit approuver cette demande.
                            </span>
                          ) : (
                            <button
                              onClick={() =>
                                void requestMfaAndRun(`2e validation : ${reqItem.actionLabel}`, async (code) => {
                                  await fraudService.decideSensitiveAction(reqItem.id, { decision: 'approve' }, code);
                                  showToast('Double validation confirmée et exécutée');
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[10px] cursor-pointer"
                            >
                              Approuver (2e valideur + MFA)
                            </button>
                          )}
                          <button
                            onClick={() =>
                              void requestMfaAndRun(`Rejeter demande : ${reqItem.actionLabel}`, async (code) => {
                                await fraudService.decideSensitiveAction(
                                  reqItem.id,
                                  { decision: isOwnRequest ? 'cancel' : 'reject' },
                                  code
                                );
                                showToast(isOwnRequest ? 'Demande annulée' : 'Demande rejetée');
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-200 font-bold text-[10px] cursor-pointer"
                          >
                            {isOwnRequest ? 'Annuler ma demande' : 'Rejeter'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Targeted Blocked Operations */}
          <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-white/70">
              Opérations temporairement bloquées ({data.blockedOperations.length})
            </h4>
            {data.blockedOperations.length === 0 ? (
              <p className="text-[11px] text-white/40 py-4 text-center">Aucune opération financière bloquée actuellement.</p>
            ) : (
              <div className="space-y-1.5">
                {data.blockedOperations.map((b) => (
                  <div key={b.id} className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-white">
                        {b.reference} • {b.accountLabelMasked}
                      </p>
                      <p className="text-[10px] text-orange-300">{b.suspicionReasons.join(' ; ') || 'Contrôle sécurité actif'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-amber-300">{formatFCFA(b.amountFcfa)}</span>
                      {perms.requestSensitiveFinanceAction && (
                        <button
                          onClick={() =>
                            openSensitiveModalFor('release_critical_operation', b.id, b.accountId, b.amountFcfa)
                          }
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/30 text-[10px] font-bold text-amber-200 cursor-pointer"
                        >
                          Initier libération
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 9. HISTORIQUE DES FRAUDES & PREUVES                                   */}
      {/* ===================================================================== */}
      {section === 'history' && (
        <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5">
          <h4 className="text-[11px] font-black uppercase tracking-wider text-white/70">
            Historique complet des décisions & preuves ({data.historyAlerts.length})
          </h4>
          {data.historyAlerts.length === 0 ? (
            <p className="text-[11px] text-white/40 py-6 text-center">Aucun dossier clôturé ou tranché pour le moment.</p>
          ) : (
            <div className="space-y-2">
              {data.historyAlerts.map((h) => (
                <div key={h.id} className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-white">{h.title}</span>
                    <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${ALERT_STATUS_LABEL[h.status].cls}`}>
                      {ALERT_STATUS_LABEL[h.status].label}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/55">
                    Compte: {h.accountLabelMasked} • Montant: {formatFCFA(h.amountFcfa)} • Pertes confirmées:{' '}
                    {formatFCFA(h.confirmedLossFcfa)} • Preuves scellées: {h.evidences.length}
                  </p>
                  {h.closureReason && <p className="text-[10px] text-emerald-300">Justification : {h.closureReason}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 10. RÈGLES DE DÉTECTION                                               */}
      {/* ===================================================================== */}
      {section === 'rules' && (
        <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-white/70">
              Règles & pondération du moteur de scoring ({data.rules.length})
            </h4>
            <span className="text-[10px] text-white/45">MFA requise pour modifier</span>
          </div>
          <div className="space-y-2">
            {data.rules.map((r) => (
              <div key={r.id} className="p-3 rounded-xl bg-black/40 border border-white/10 flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5 flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{r.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-mono text-white/70">{r.code}</span>
                  </div>
                  <p className="text-[10px] text-white/50">{r.description}</p>
                  <p className="text-[10px] text-amber-300">
                    Poids: {r.weight} pts • Seuil: {r.thresholdValue} {r.thresholdUnit} • Protection: {r.autoAction}
                  </p>
                </div>
                {perms.manageFraudRules && (
                  <button
                    onClick={() =>
                      void requestMfaAndRun(`${r.enabled ? 'Désactiver' : 'Activer'} règle ${r.code}`, async (code) => {
                        await fraudService.updateRule(r.id, { enabled: !r.enabled }, code);
                        showToast(`Règle ${r.code} mise à jour`);
                      })
                    }
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                      r.enabled
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                        : 'bg-white/5 border-white/10 text-white/50'
                    }`}
                  >
                    {r.enabled ? 'Active' : 'Inactive'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 11. PARAMÈTRES & PERMISSIONS                                          */}
      {/* ===================================================================== */}
      {section === 'settings' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-white/70">
              Paramètres de gouvernance anti-fraude
            </h4>
            {[
              {
                key: 'dualValidationRequired' as const,
                label: 'Exiger la double validation (2 administrateurs distincts)',
                val: data.settings.dualValidationRequired
              },
              {
                key: 'autoHoldCriticalOps' as const,
                label: 'Suspendre automatiquement toute opération à risque critique (≥ 75)',
                val: data.settings.autoHoldCriticalOps
              },
              {
                key: 'autoHoldHighOps' as const,
                label: 'Contrôle supplémentaire sur opérations à risque élevé (≥ 50)',
                val: data.settings.autoHoldHighOps
              },
              {
                key: 'maskSensitiveFinancialCoords' as const,
                label: 'Masquer les coordonnées financières complètes par défaut',
                val: data.settings.maskSensitiveFinancialCoords
              }
            ].map((item) => (
              <div key={item.key} className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-white/85">{item.label}</span>
                <button
                  disabled={!perms.manageFraudRules}
                  onClick={() =>
                    void requestMfaAndRun(`Modifier ${item.key}`, async (code) => {
                      await fraudService.updateSettings({ [item.key]: !item.val }, code);
                      showToast('Paramètre anti-fraude enregistré');
                    })
                  }
                  className={`px-3 py-1 rounded-lg text-[10px] font-black cursor-pointer disabled:opacity-40 ${
                    item.val ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/60'
                  }`}
                >
                  {item.val ? 'Activé' : 'Désactivé'}
                </button>
              </div>
            ))}
          </div>

          <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-white/70 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Contrôle d’accès anti-fraude par collaborateur (RBAC)</span>
            </h4>
            <div className="space-y-2">
              {data.staffPermissions.map((staff) => (
                <div key={staff.staffId} className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white">{staff.name}</p>
                      <p className="text-[10px] text-white/45">{staff.email} • {staff.title}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-white/10 text-[9px] font-bold text-white/75">{staff.role}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(FRAUD_PERMISSION_LABELS) as FraudPermissionKey[]).map((pk) => {
                      const active = staff.permissions[pk];
                      const canEdit = data.actor.role === 'super_admin' && staff.role !== 'super_admin';
                      return (
                        <button
                          key={pk}
                          disabled={!canEdit}
                          onClick={() =>
                            void requestMfaAndRun(`Permission ${pk} (${staff.name})`, async (code) => {
                              await fraudService.updateStaffPermissions(staff.staffId, { [pk]: !active }, code);
                              showToast('Permissions anti-fraude mises à jour');
                            })
                          }
                          className={`px-2 py-1 rounded-lg border text-[10px] font-bold transition ${
                            active
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                              : 'bg-white/5 border-white/10 text-white/40'
                          } ${canEdit ? 'cursor-pointer hover:brightness-125' : 'opacity-70 cursor-default'}`}
                        >
                          {FRAUD_PERMISSION_LABELS[pk]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sensitive Action Request Modal */}
      {showSensitiveModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#151515] border border-white/15 p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                <span>Action financière sensible (Double Validation)</span>
              </h4>
              <button
                onClick={() => setShowSensitiveModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitSensitiveAction} className="space-y-2.5">
              <select
                value={saType}
                onChange={(e) => setSaType(e.target.value as SensitiveFinanceActionType)}
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white font-bold outline-none"
              >
                {SENSITIVE_ACTION_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                value={saAccountId}
                onChange={(e) => setSaAccountId(e.target.value)}
                placeholder="ID compte / vendeur / livreur *"
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white outline-none"
              />
              <input
                type="text"
                value={saTargetId}
                onChange={(e) => setSaTargetId(e.target.value)}
                placeholder="ID opération / référence (optionnel)"
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white outline-none"
              />
              <input
                type="number"
                value={saAmount}
                onChange={(e) => setSaAmount(e.target.value)}
                placeholder="Montant FCFA (si applicable)"
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white outline-none"
              />
              <input
                type="text"
                value={saSummary}
                onChange={(e) => setSaSummary(e.target.value)}
                placeholder="Détail (ex: crédit ou débit / nouvelle coordonnée)"
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white outline-none"
              />
              <textarea
                required
                rows={2}
                value={saReason}
                onChange={(e) => setSaReason(e.target.value)}
                placeholder="Motif vérifiable obligatoire (min 6 caractères)..."
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white outline-none resize-none"
              />
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowSensitiveModal(false)}
                  className="flex-1 py-2 rounded-xl bg-white/10 font-bold text-white/80 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black cursor-pointer"
                >
                  Soumettre (MFA)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Step-Up MFA Verification Modal */}
      {mfaModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#161616] border border-amber-500/30 p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Confirmation MFA requise</span>
              </h4>
              <button
                onClick={() => setMfaModal(null)}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-white/65">{mfaModal.title}</p>
            {mfaModal.challengeCode && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-center">
                <p className="text-[10px] text-white/60">Code de validation à usage unique :</p>
                <p className="text-base font-black font-mono text-amber-300 tracking-widest mt-0.5">
                  {mfaModal.challengeCode}
                </p>
              </div>
            )}
            <form onSubmit={handleConfirmMfa} className="space-y-2.5">
              <input
                type="text"
                required
                value={mfaModal.codeInput}
                onChange={(e) => setMfaModal({ ...mfaModal, codeInput: e.target.value })}
                placeholder="Saisir le code MFA..."
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-center font-mono text-white font-bold outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={busyAction}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black cursor-pointer disabled:opacity-50"
              >
                {busyAction ? 'Validation en cours...' : 'Confirmer et exécuter'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
