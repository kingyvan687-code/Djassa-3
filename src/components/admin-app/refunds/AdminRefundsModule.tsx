import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Award,
  BadgeAlert,
  Banknote,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  History,
  Lock,
  Package,
  Paperclip,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  User,
  Wallet,
  X,
  XCircle
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { AdminUserRecord, Order } from '../../../types';
import { formatFCFA } from '../../../services/marketServices';
import { securityService } from '../../../services/securityService';
import { refundsService, type RefundApiError } from '../../../services/refundsService';
import { AdminUserDetailModal } from '../modals/AdminUserDetailModal';
import { AdminOrderDetailModal } from '../modals/AdminOrderDetailModal';
import type {
  CompensationBeneficiaryRole,
  CompensationFundingSource,
  CompensationReasonKey,
  CompensationRecord,
  CompensationStatus,
  PaymentProviderChannelId,
  RefundModuleSettings,
  RefundOriginType,
  RefundOverviewResponse,
  RefundPermissionKey,
  RefundRecord,
  RefundStatus,
  RefundType,
  RefundWorkspaceSection
} from '../../../types/refunds';

const SECTION_TABS: { id: RefundWorkspaceSection; label: string }[] = [
  { id: 'dashboard', label: 'Tableau de bord' },
  { id: 'all', label: 'Tous les remboursements' },
  { id: 'pending', label: 'En attente' },
  { id: 'in_progress', label: 'En cours' },
  { id: 'completed', label: 'Effectués' },
  { id: 'failed', label: 'Échoués' },
  { id: 'compensations', label: 'Indemnisations' },
  { id: 'partial', label: 'Partiels' },
  { id: 'full', label: 'Complets' },
  { id: 'financial_history', label: 'Historique financier' },
  { id: 'settings', label: 'Paramètres' }
];

const REFUND_STATUS_META: Record<RefundStatus, { label: string; cls: string }> = {
  nouvelle_demande: { label: 'Nouvelle demande', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/35' },
  en_attente_validation: { label: 'En attente de validation', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/35' },
  en_verification: { label: 'En vérification', cls: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/35' },
  approuvee: { label: 'Approuvée', cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35' },
  en_cours_traitement: { label: 'En cours de traitement', cls: 'bg-purple-500/15 text-purple-300 border-purple-500/35' },
  effectuee: { label: 'Effectuée', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35' },
  partiellement_effectuee: { label: 'Partiellement effectuée', cls: 'bg-teal-500/15 text-teal-300 border-teal-500/35' },
  echouee: { label: 'Échouée', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/45' },
  refusee: { label: 'Refusée', cls: 'bg-red-500/15 text-red-300 border-red-500/35' },
  annulee: { label: 'Annulée', cls: 'bg-white/10 text-white/60 border-white/20' }
};

const COMP_STATUS_META: Record<CompensationStatus, { label: string; cls: string }> = {
  nouvelle_demande: { label: 'Nouvelle demande', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/35' },
  en_verification: { label: 'En vérification', cls: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/35' },
  en_attente_validation: { label: 'En attente de validation', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/35' },
  approuvee: { label: 'Approuvée', cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35' },
  en_cours_versement: { label: 'En cours de versement', cls: 'bg-purple-500/15 text-purple-300 border-purple-500/35' },
  versee: { label: 'Versée', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35' },
  echouee: { label: 'Échouée', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/45' },
  refusee: { label: 'Refusée', cls: 'bg-red-500/15 text-red-300 border-red-500/35' },
  annulee: { label: 'Annulée', cls: 'bg-white/10 text-white/60 border-white/20' }
};

const REFUND_TYPE_LABELS: Record<RefundType, string> = {
  complet: 'Remboursement complet',
  partiel: 'Remboursement partiel',
  apres_annulation: 'Après annulation',
  apres_litige: 'Après litige',
  exceptionnel: 'Remboursement exceptionnel'
};

const COMP_REASON_LABELS: Record<CompensationReasonKey, string> = {
  colis_perdu: 'Colis perdu',
  produit_endommage_transport: 'Produit endommagé pendant le transport',
  erreur_livraison: 'Erreur de livraison',
  prejudice_commercial: 'Préjudice commercial reconnu',
  incident_technique: 'Incident technique ayant causé une perte financière',
  decision_mediation: 'Décision de médiation',
  autre_incident_justifie: 'Autre incident justifié'
};

const FUNDING_SOURCE_LABELS: Record<CompensationFundingSource, string> = {
  caisse_djassa_garantie: 'Caisse Garantie DJASSA',
  imputation_vendeur: 'Imputation Vendeur',
  imputation_livreur: 'Imputation Livreur',
  imputation_entreprise: 'Imputation Entreprise de livraison',
  fonds_mediation: 'Fonds de Médiation DJASSA'
};

const ROLE_LABELS: Record<CompensationBeneficiaryRole | 'admin', string> = {
  client: 'Client',
  seller: 'Vendeur',
  driver: 'Livreur (archive)',
  company: 'Entreprise (archive)',
  admin: 'Agent Administratif'
};

const CHANNEL_LABELS: Record<PaymentProviderChannelId, string> = {
  internal_ledger: 'Registre Interne DJASSA',
  wave: 'Wave CI',
  orange_money: 'Orange Money CI',
  mtn_momo: 'MTN MoMo',
  card: 'Carte Bancaire (GeniusPay)',
  bank_transfer: 'Virement Bancaire'
};

const PERMISSION_LABELS: Record<RefundPermissionKey, string> = {
  viewRefunds: 'Consulter remboursements',
  createRefundOrCompRequest: 'Créer demandes RBT / IND',
  verifyAndRequestEvidence: 'Vérifier & demander justificatifs',
  approveRefundStandard: 'Valider remboursement (Agent)',
  superAdminFinalValidate: 'Double validation Super Admin (4 yeux)',
  executeProviderTransfer: 'Exécuter paiement / confirmer reçu',
  manageCompensations: 'Gérer les indemnisations',
  cancelOrRetryOperation: 'Annuler ou relancer opération',
  viewImmutableFinancialJournal: 'Consulter journal financier immuable',
  manageRefundSettings: 'Modifier paramètres & seuils'
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const REASON_PRESETS_BY_TYPE: Record<RefundType, { category: string; label: string }[]> = {
  complet: [
    { category: 'restitution_totale', label: 'Restitution intégrale éligible de la commande' },
    { category: 'retour_conforme', label: 'Retour complet validé en boutique' }
  ],
  partiel: [
    { category: 'article_manquant', label: 'Produit(s) manquant(s) ou partiellement livré(s)' },
    { category: 'remise_commerciale_partielle', label: 'Ajustement partiel sur article(s) ciblé(s)' }
  ],
  apres_annulation: [
    { category: 'commande_annulee_client', label: 'Commande annulée avant expédition' },
    { category: 'paiement_sans_execution', label: 'Paiement effectué mais commande non exécutée' },
    { category: 'annulation_vendeur', label: 'Commande annulée par le vendeur' },
    { category: 'indisponibilite_produit', label: 'Indisponibilité du produit en stock' }
  ],
  apres_litige: [
    { category: 'produit_defectueux', label: 'Produit défectueux' },
    { category: 'produit_incorrect', label: 'Produit incorrect' },
    { category: 'produit_non_recu', label: 'Produit non reçu' },
    { category: 'colis_perdu', label: 'Colis perdu' },
    { category: 'livraison_non_conforme', label: 'Livraison non conforme' }
  ],
  exceptionnel: [
    { category: 'erreur_technique', label: 'Erreur technique plateforme' },
    { category: 'double_paiement', label: 'Double paiement constaté' },
    { category: 'debit_injustifie', label: 'Débit injustifié' },
    { category: 'decision_administrative', label: 'Décision administrative motivée' }
  ]
};

export const AdminRefundsModule: React.FC = () => {
  const { orders, sellers, adminUsers, showToast } = useApp();

  const [section, setSection] = useState<RefundWorkspaceSection>('dashboard');
  const [overview, setOverview] = useState<RefundOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [filterDateRange, setFilterDateRange] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [filterActorRole, setFilterActorRole] = useState<'all' | 'client' | 'seller'>('all');
  const [filterOrderRef, setFilterOrderRef] = useState('');
  const [filterMinAmount, setFilterMinAmount] = useState('');
  const [filterMaxAmount, setFilterMaxAmount] = useState('');
  const [filterReasonOrType, setFilterReasonOrType] = useState<'all' | RefundType>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | RefundStatus>('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  // Selected refund detail
  const [selectedRefundId, setSelectedRefundId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'general' | 'actors' | 'financial' | 'workflow'>('general');

  // Selected compensation detail
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);
  const [compFilterRole, setCompFilterRole] = useState<'all' | CompensationBeneficiaryRole>('all');
  const [compSearch, setCompSearch] = useState('');

  // Financial history filters
  const [journalSearch, setJournalSearch] = useState('');
  const [journalFilterType, setJournalFilterType] = useState<string>('all');

  // Inline Profile / Order Overlays
  const [inspectedUser, setInspectedUser] = useState<AdminUserRecord | null>(null);
  const [inspectedOrder, setInspectedOrder] = useState<Order | null>(null);

  // Step-Up MFA modal state
  const [mfaPrompt, setMfaPrompt] = useState<{
    title: string;
    description: string;
    previewCode?: string;
    pendingRunner: (code: string) => Promise<void>;
  } | null>(null);
  const [mfaInput, setMfaInput] = useState('');

  // Create Refund Modal
  const [createRefundOpen, setCreateRefundOpen] = useState(false);
  const [newOrderId, setNewOrderId] = useState('');
  const [newOrderNumberManual, setNewOrderNumberManual] = useState('');
  const [newRefundType, setNewRefundType] = useState<RefundType>('complet');
  const [newOrigin, setNewOrigin] = useState<RefundOriginType>('initiative_admin');
  const [newReasonCategory, setNewReasonCategory] = useState('restitution_totale');
  const [newReasonDetail, setNewReasonDetail] = useState('');
  const [newTargetChannel, setNewTargetChannel] = useState<PaymentProviderChannelId>('internal_ledger');
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newInitialPaid, setNewInitialPaid] = useState('');
  const [newDeliveryFee, setNewDeliveryFee] = useState('');
  const [newCustomAmount, setNewCustomAmount] = useState('');
  const [newEvidenceTitle, setNewEvidenceTitle] = useState('');
  const [newItemsDraft, setNewItemsDraft] = useState<
    Array<{
      productId: string;
      productTitle: string;
      productImage?: string;
      orderedQuantity: number;
      refundQuantity: number;
      unitPriceFcfa: number;
      selectedForRefund: boolean;
      sellerId?: string;
      sellerName?: string;
    }>
  >([]);

  // Create Compensation Modal
  const [createCompOpen, setCreateCompOpen] = useState(false);
  const [compRole, setCompRole] = useState<CompensationBeneficiaryRole>('client');
  const [compBeneficiaryName, setCompBeneficiaryName] = useState('');
  const [compBeneficiaryPhone, setCompBeneficiaryPhone] = useState('');
  const [compOrderNumber, setCompOrderNumber] = useState('');
  const [compReason, setCompReason] = useState<CompensationReasonKey>('colis_perdu');
  const [compFundingSource, setCompFundingSource] = useState<CompensationFundingSource>('caisse_djassa_garantie');
  const [compAmount, setCompAmount] = useState('');
  const [compChannel, setCompChannel] = useState<PaymentProviderChannelId>('internal_ledger');
  const [compDescription, setCompDescription] = useState('');

  // Detail interactive inputs
  const [verifyEvTitle, setVerifyEvTitle] = useState('');
  const [verifyEvUrl, setVerifyEvUrl] = useState('');
  const [reqEvTargetRole, setReqEvTargetRole] = useState<'client' | 'seller'>('client');
  const [reqEvMessage, setReqEvMessage] = useState('');
  const [execChannel, setExecChannel] = useState<PaymentProviderChannelId>('internal_ledger');
  const [execPartialAmount, setExecPartialAmount] = useState('');
  const [providerReceiptInput, setProviderReceiptInput] = useState('');
  const [providerProofNote, setProviderProofNote] = useState('');

  // Reject / Cancel Reason Modal
  const [reasonModal, setReasonModal] = useState<{
    targetKind: 'refund' | 'compensation';
    targetId: string;
    mode: 'reject' | 'cancel' | 'mark_failed';
    title: string;
    placeholder: string;
  } | null>(null);
  const [reasonText, setReasonText] = useState('');

  // Compensation action inputs
  const [compApproveAmount, setCompApproveAmount] = useState('');
  const [compExecChannel, setCompExecChannel] = useState<PaymentProviderChannelId>('internal_ledger');
  const [compProviderRef, setCompProviderRef] = useState('');

  // Settings draft
  const [settingsDraft, setSettingsDraft] = useState<RefundModuleSettings | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      setErrorBanner(null);
      const data = await refundsService.getOverview();
      setOverview(data);
      setSettingsDraft(data.settings);
    } catch (err: unknown) {
      setErrorBanner((err as Error).message || 'Impossible de charger le module Remboursements & indemnisations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const handleSyncOrders = useCallback(async () => {
    setBusyAction('sync');
    try {
      const res = await refundsService.syncFromOrdersAndDisputes({ orders, sellers });
      showToast(
        res.importedRefunds > 0
          ? `${res.importedRefunds} dossier(s) synchronisé(s) depuis les commandes & litiges.`
          : 'Dossiers déjà à jour avec les commandes et litiges.'
      );
      await loadOverview();
    } catch (err: unknown) {
      showToast((err as Error).message);
    } finally {
      setBusyAction(null);
    }
  }, [orders, sellers, loadOverview, showToast]);

  const runWithMfaIfNeeded = useCallback(
    async (
      actionKey: string,
      title: string,
      description: string,
      fn: (stepUpCode?: string) => Promise<void>
    ) => {
      setBusyAction(actionKey);
      try {
        await fn(undefined);
        await loadOverview();
      } catch (err: unknown) {
        const apiErr = err as RefundApiError;
        if (apiErr.requiresMfa) {
          try {
            const challenge = await securityService.requestMfaChallenge();
            setMfaInput(challenge.verificationCodePreview || '');
            setMfaPrompt({
              title,
              description,
              previewCode: challenge.verificationCodePreview,
              pendingRunner: async (code: string) => {
                await fn(code);
                await loadOverview();
              }
            });
          } catch (mfaErr: unknown) {
            showToast((mfaErr as Error).message || 'Erreur lors de l’initialisation MFA.');
          }
        } else {
          showToast(apiErr.message || 'Opération refusée.');
        }
      } finally {
        setBusyAction(null);
      }
    },
    [loadOverview, showToast]
  );

  // Selected order watcher in Create Modal
  useEffect(() => {
    if (!newOrderId) return;
    const found = orders.find((o) => o.id === newOrderId || o.orderNumber === newOrderId);
    if (!found) return;
    setNewOrderNumberManual(found.orderNumber);
    setNewClientName(found.deliveryAddress.recipientName || '');
    setNewClientPhone(found.deliveryAddress.phone || '');
    setNewInitialPaid(String(found.total || 0));
    setNewDeliveryFee(String(found.deliveryFee || 0));
    const lowerMethod = String(found.paymentMethod || '').toLowerCase();
    setNewTargetChannel(
      lowerMethod.includes('wave')
        ? 'wave'
        : lowerMethod.includes('orange')
        ? 'orange_money'
        : lowerMethod.includes('mtn')
        ? 'mtn_momo'
        : 'internal_ledger'
    );
    setNewItemsDraft(
      (found.items || []).map((it) => ({
        productId: it.productId,
        productTitle: it.productTitle,
        productImage: it.productImage,
        orderedQuantity: it.quantity,
        refundQuantity: it.quantity,
        unitPriceFcfa: it.price,
        selectedForRefund: true,
        sellerId: it.sellerId,
        sellerName: it.sellerName
      }))
    );
  }, [newOrderId, orders]);

  useEffect(() => {
    const presets = REASON_PRESETS_BY_TYPE[newRefundType];
    if (presets && presets.length > 0) {
      setNewReasonCategory(presets[0].category);
    }
  }, [newRefundType]);

  const partialComputedSum = useMemo(() => {
    return newItemsDraft
      .filter((i) => i.selectedForRefund && i.refundQuantity > 0)
      .reduce((sum, i) => sum + i.unitPriceFcfa * i.refundQuantity, 0);
  }, [newItemsDraft]);

  const selectedRefund: RefundRecord | null = useMemo(() => {
    if (!overview || !selectedRefundId) return null;
    return overview.refunds.find((r) => r.id === selectedRefundId) || null;
  }, [overview, selectedRefundId]);

  const selectedComp: CompensationRecord | null = useMemo(() => {
    if (!overview || !selectedCompId) return null;
    return overview.compensations.find((c) => c.id === selectedCompId) || null;
  }, [overview, selectedCompId]);

  useEffect(() => {
    if (selectedRefund) {
      setExecChannel(selectedRefund.targetChannel || 'internal_ledger');
      setExecPartialAmount(String(selectedRefund.financial.remainingToRefundFcfa || ''));
    }
  }, [selectedRefund?.id, selectedRefund?.financial.remainingToRefundFcfa]);

  useEffect(() => {
    if (selectedComp) {
      setCompApproveAmount(String(selectedComp.approvedAmountFcfa || selectedComp.requestedAmountFcfa));
      setCompExecChannel(selectedComp.targetChannel || 'internal_ledger');
    }
  }, [selectedComp?.id]);

  const inspectActorProfile = (accountId?: string, name?: string) => {
    if (!accountId && !name) return;
    const nowIso = new Date().toISOString();
    const match: AdminUserRecord =
      adminUsers.find((u) => u.id === accountId || u.name === name) || {
        id: accountId || `actor-${Date.now()}`,
        name: name || 'Acteur DJASSA',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
        email: 'non-renseigne@djassa.ci',
        phone: '+225 00 00 00 00',
        role: 'client',
        status: 'active',
        kycVerified: true,
        createdAt: nowIso,
        location: 'Abidjan',
        ordersCount: 0,
        totalSpentOrEarned: 0
      };
    setInspectedUser(match);
  };

  const inspectLinkedOrder = (orderNumber: string) => {
    const found = orders.find((o) => o.orderNumber === orderNumber || o.id === orderNumber);
    if (found) {
      setInspectedOrder(found);
    } else {
      showToast(`Commande #${orderNumber} hors cache local (données conservées dans le dossier).`);
    }
  };

  // Filtered refunds list for all refund-list tabs
  const filteredRefunds = useMemo(() => {
    if (!overview) return [];
    const q = search.trim().toLowerCase();
    const orderQ = filterOrderRef.trim().toLowerCase();
    const minAmt = Number(filterMinAmount || 0);
    const maxAmt = Number(filterMaxAmount || 0);
    const now = Date.now();

    return overview.refunds.filter((r) => {
      // Section filter
      if (section === 'pending') {
        if (!['nouvelle_demande', 'en_attente_validation', 'en_verification', 'approuvee'].includes(r.status)) {
          return false;
        }
      } else if (section === 'in_progress') {
        if (r.status !== 'en_cours_traitement') return false;
      } else if (section === 'completed') {
        if (r.status !== 'effectuee' && r.status !== 'partiellement_effectuee') return false;
      } else if (section === 'failed') {
        if (r.status !== 'echouee') return false;
      } else if (section === 'partial') {
        if (r.refundType !== 'partiel' && r.status !== 'partiellement_effectuee') return false;
      } else if (section === 'full') {
        if (r.refundType === 'partiel') return false;
      }

      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterReasonOrType !== 'all' && r.refundType !== filterReasonOrType) return false;
      if (orderQ && !r.orderNumber.toLowerCase().includes(orderQ)) return false;

      if (filterActorRole === 'seller' && !r.actors.seller) return false;

      if (minAmt > 0 && r.financial.requestedAmountFcfa < minAmt) return false;
      if (maxAmt > 0 && r.financial.requestedAmountFcfa > maxAmt) return false;

      if (filterDateRange !== 'all') {
        const ms = new Date(r.createdAt).getTime();
        const maxAge =
          filterDateRange === 'today' ? 86_400_000 : filterDateRange === '7d' ? 7 * 86_400_000 : 30 * 86_400_000;
        if (now - ms > maxAge) return false;
      }

      if (q) {
        const hay = [
          r.code,
          r.orderNumber,
          r.initialTransactionRef,
          r.actors.client.name,
          r.actors.seller?.name || '',
          r.reasonCategory,
          r.reasonDetail
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    overview,
    section,
    search,
    filterDateRange,
    filterActorRole,
    filterOrderRef,
    filterMinAmount,
    filterMaxAmount,
    filterReasonOrType,
    filterStatus
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredRefunds.length / PAGE_SIZE));
  const paginatedRefunds = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    return filteredRefunds.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  }, [filteredRefunds, page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [section, search, filterDateRange, filterActorRole, filterOrderRef, filterMinAmount, filterMaxAmount, filterReasonOrType, filterStatus]);

  const filteredCompensations = useMemo(() => {
    if (!overview) return [];
    const q = compSearch.trim().toLowerCase();
    return overview.compensations.filter((c) => {
      if (compFilterRole !== 'all' && c.beneficiaryRole !== compFilterRole) return false;
      if (q) {
        const hay = [c.code, c.beneficiary.name, c.orderNumber || '', c.reason, c.incidentDescription].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [overview, compFilterRole, compSearch]);

  const filteredJournal = useMemo(() => {
    if (!overview) return [];
    const q = journalSearch.trim().toLowerCase();
    return overview.journal.filter((j) => {
      if (journalFilterType !== 'all' && j.entryType !== journalFilterType) return false;
      if (q) {
        const hay = [j.entityCode, j.orderNumber || '', j.beneficiaryName, j.providerReference, j.note].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [overview, journalSearch, journalFilterType]);

  if (loading && !overview) {
    return (
      <div className="p-6 rounded-2xl bg-[#141414] border border-white/10 text-center space-y-2">
        <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
        <p className="text-xs text-white/70 font-semibold">Chargement sécurisé du module Remboursements & indemnisations…</p>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="p-5 rounded-2xl bg-[#141414] border border-rose-500/30 space-y-3">
        <p className="text-xs text-rose-300 font-bold">{errorBanner || 'Erreur de chargement du module.'}</p>
        <button
          type="button"
          onClick={() => void loadOverview()}
          className="px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs font-bold text-rose-200 cursor-pointer"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const perms = overview.actor.permissions;
  const unreadNotifsCount = overview.notifications.filter(
    (n) => !n.readByAdminIds.includes(overview.actor.staffId)
  ).length;
  const dualValidationQueue = overview.refunds.filter(
    (r) => r.requiresSuperAdminValidation && !r.superAdminValidatedById && r.status !== 'refusee' && r.status !== 'annulee'
  );

  // =========================================================================
  // RENDER : REFUND DETAIL VIEW
  // =========================================================================
  if (selectedRefund) {
    const statusMeta = REFUND_STATUS_META[selectedRefund.status];
    const isTerminal =
      selectedRefund.status === 'effectuee' ||
      selectedRefund.status === 'refusee' ||
      selectedRefund.status === 'annulee';
    const awaitingDual =
      selectedRefund.requiresSuperAdminValidation &&
      !selectedRefund.superAdminValidatedById &&
      selectedRefund.validatedByAgentId;

    return (
      <div id="admin-refund-detail-view" className="space-y-3 animate-in fade-in duration-200">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2 flex-wrap p-3 rounded-2xl bg-[#141414] border border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setSelectedRefundId(null)}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Retour</span>
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-mono font-black text-emerald-400">{selectedRefund.code}</span>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${statusMeta.cls}`}>
                  {statusMeta.label}
                </span>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/5 text-white/75 border border-white/10">
                  {REFUND_TYPE_LABELS[selectedRefund.refundType]}
                </span>
              </div>
              <p className="text-[11px] text-white/60 truncate">
                Commande #{selectedRefund.orderNumber} • {selectedRefund.actors.client.name} •{' '}
                <span className="text-emerald-300 font-mono font-bold">
                  {formatFCFA(selectedRefund.financial.requestedAmountFcfa)}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {!selectedRefund.archived && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={async () => {
                  setBusyAction('archive');
                  try {
                    await refundsService.archiveRefund(selectedRefund.id);
                    showToast('Dossier archivé (étape 10).');
                    await loadOverview();
                  } catch (e: unknown) {
                    showToast((e as Error).message);
                  } finally {
                    setBusyAction(null);
                  }
                }}
                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-[11px] font-bold text-white/80 flex items-center gap-1 cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Archiver</span>
              </button>
            )}
          </div>
        </div>

        {/* Suspicious signals banner */}
        {selectedRefund.suspiciousSignals.length > 0 && (
          <div className="p-3 rounded-2xl bg-rose-950/35 border border-rose-500/40 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-black text-rose-300">
              <ShieldAlert className="w-4 h-4" />
              <span>Alertes de sécurité financière & contrôle anti-doublon ({selectedRefund.suspiciousSignals.length})</span>
            </div>
            {selectedRefund.suspiciousSignals.map((sig) => (
              <div key={sig.id} className="text-[11px] text-rose-200/90 flex items-start gap-1.5">
                <span className="px-1.5 py-0.5 rounded bg-rose-500/25 text-[9px] font-bold uppercase shrink-0">
                  {sig.severity}
                </span>
                <span>
                  <strong className="text-white">{sig.label} :</strong> {sig.detail}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Sub-tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'general', label: 'A. Infos générales', icon: FileText },
            { id: 'actors', label: 'B. Acteurs concernés', icon: User },
            { id: 'financial', label: 'C. Détails financiers', icon: Wallet },
            { id: 'workflow', label: 'Validation & Paiement (10 étapes)', icon: ShieldCheck }
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setDetailTab(t.id as typeof detailTab)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap flex items-center gap-1.5 border cursor-pointer ${
                  detailTab === t.id
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/45'
                    : 'bg-[#141414] text-white/55 border-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB A : INFORMATIONS GÉNÉRALES */}
        {detailTab === 'general' && (
          <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-3 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-white/45 block">Identifiant unique</span>
                <span className="font-mono font-bold text-emerald-300">{selectedRefund.code}</span>
                <span className="block text-[9px] text-white/35 font-mono truncate">{selectedRefund.id}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-white/45 block">Création</span>
                <span className="font-semibold text-white">{fmtDateTime(selectedRefund.createdAt)}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-white/45 block">Référence commande</span>
                <button
                  type="button"
                  onClick={() => inspectLinkedOrder(selectedRefund.orderNumber)}
                  className="font-mono font-bold text-sky-300 hover:underline cursor-pointer"
                >
                  #{selectedRefund.orderNumber}
                </button>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-white/45 block">Transaction initiale</span>
                <span className="font-mono font-semibold text-white">{selectedRefund.initialTransactionRef}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-white/45 block">Origine de la demande</span>
                <span className="font-semibold text-white capitalize">{selectedRefund.origin.replace(/_/g, ' ')}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-white/45 block">Mode paiement initial</span>
                <span className="font-semibold text-white uppercase">{selectedRefund.initialPaymentMethod}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-white/45 block">Agent responsable</span>
                <span className="font-semibold text-white">{selectedRefund.assignedAgentName || 'Système'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-white/45 block">Délai SLA cible</span>
                <span className="font-semibold text-amber-300">{fmtDateTime(selectedRefund.dueAt)}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
              <span className="text-[10px] text-white/50 uppercase font-bold block">
                Motif ({selectedRefund.reasonCategory.replace(/_/g, ' ')})
              </span>
              <p className="text-xs text-white/90 leading-relaxed">{selectedRefund.reasonDetail}</p>
              {selectedRefund.linkedDisputeCode && (
                <p className="text-[11px] text-amber-300 font-semibold pt-1">
                  Lié au dossier litige : {selectedRefund.linkedDisputeCode}
                </p>
              )}
              {selectedRefund.rejectionReason && (
                <p className="text-[11px] text-rose-300 font-semibold pt-1">
                  Motif du refus : {selectedRefund.rejectionReason}
                </p>
              )}
            </div>

            {/* Evidence list */}
            <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Pièces & justificatifs immuables ({selectedRefund.evidence.length})</span>
                </span>
              </div>
              {selectedRefund.evidence.length === 0 ? (
                <p className="text-[11px] text-white/45">Aucun justificatif attaché pour le moment.</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedRefund.evidence.map((ev) => (
                    <div key={ev.id} className="p-2 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-white truncate">{ev.title}</p>
                        <p className="text-[10px] text-white/45 font-mono truncate">
                          SHA-256: {ev.sha256.slice(0, 18)}… • {ev.addedByName} ({fmtDateTime(ev.addedAt)})
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[9px] font-bold shrink-0">
                        IMMUTABLE
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB B : ACTEURS CONCERNÉS (Uniquement acteurs réellement impliqués) */}
        {detailTab === 'actors' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {(
              [
                { key: 'client', title: 'Client bénéficiaire', actor: selectedRefund.actors.client, icon: User, cls: 'text-emerald-400' },
                { key: 'seller', title: 'Vendeur concerné', actor: selectedRefund.actors.seller, icon: Package, cls: 'text-indigo-400' },
                { key: 'agent', title: 'Agent administratif', actor: selectedRefund.actors.agent, icon: ShieldCheck, cls: 'text-sky-400' }
              ] as const
            )
              .filter((row) => Boolean(row.actor))
              .map((row) => {
                const Icon = row.icon;
                const a = row.actor!;
                return (
                  <div key={row.key} className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold flex items-center gap-1.5 ${row.cls}`}>
                        <Icon className="w-3.5 h-3.5" />
                        <span>{row.title}</span>
                      </span>
                      {a.titularityVerified && (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 text-[10px] font-bold">
                          Titularité vérifiée
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-black text-white">{a.name}</p>
                      <p className="text-[11px] text-white/60">
                        {a.phoneMasked || a.emailMasked || 'Contact protégé'} {a.commune ? `• ${a.commune}` : ''}
                      </p>
                      {a.payoutTargetMasked && (
                        <p className="text-[10px] text-emerald-300 font-mono mt-0.5">
                          Compte versement : {a.payoutTargetMasked}
                        </p>
                      )}
                    </div>
                    {row.key !== 'agent' && (
                      <button
                        type="button"
                        onClick={() => inspectActorProfile(a.accountId, a.name)}
                        className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-white/80 flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspecter le profil</span>
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {/* TAB C : DÉTAILS FINANCIERS */}
        {detailTab === 'financial' && (
          <div className="space-y-3">
            {/* Breakdown Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="p-3 rounded-2xl bg-[#141414] border border-white/10">
                <span className="text-[10px] text-white/50 block">Montant initial payé (Client)</span>
                <span className="text-sm font-black text-white font-mono">
                  {formatFCFA(selectedRefund.financial.initialPaidFcfa)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-[#141414] border border-white/10">
                <span className="text-[10px] text-white/50 block">Montant contesté</span>
                <span className="text-sm font-black text-amber-300 font-mono">
                  {formatFCFA(selectedRefund.financial.disputedAmountFcfa)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-[#141414] border border-emerald-500/30">
                <span className="text-[10px] text-emerald-300/80 block">Montant à rembourser</span>
                <span className="text-sm font-black text-emerald-300 font-mono">
                  {formatFCFA(selectedRefund.financial.requestedAmountFcfa)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-[#141414] border border-white/10">
                <span className="text-[10px] text-white/50 block">Déjà remboursé</span>
                <span className="text-sm font-black text-cyan-300 font-mono">
                  {formatFCFA(selectedRefund.financial.alreadyRefundedFcfa)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-[#141414] border border-rose-500/25">
                <span className="text-[10px] text-rose-300/80 block">Solde restant à rembourser</span>
                <span className="text-sm font-black text-rose-300 font-mono">
                  {formatFCFA(selectedRefund.financial.remainingToRefundFcfa)}
                </span>
              </div>
            </div>

            {/* Distinct Client / Seller / Delivery / DJASSA Shares */}
            <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5 text-xs">
              <h4 className="text-xs font-black text-white">Répartition claire des flux financiers</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase">Part Client</span>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/60">Sous-total produits</span>
                    <span className="font-mono text-white">{formatFCFA(selectedRefund.financial.productsSubtotalFcfa)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/60">Frais livraison payés</span>
                    <span className="font-mono text-white">{formatFCFA(selectedRefund.financial.deliveryFeeFcfa)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/60">Frais service (6,6%)</span>
                    <span className="font-mono text-white">{formatFCFA(selectedRefund.financial.serviceFeeFcfa)}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase">Part Vendeur</span>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/60">Net vendeur avant RBT</span>
                    <span className="font-mono text-white">{formatFCFA(selectedRefund.financial.sellerNetBeforeRefundFcfa)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/60">Livraison vendeur (externe)</span>
                    <span className="font-mono text-white">0 F (DJASSA)</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/60">Frais non remboursables</span>
                    <span className="font-mono text-amber-300">{formatFCFA(selectedRefund.financial.nonRefundableFeesFcfa)}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-black/40 border border-emerald-500/20 space-y-1">
                  <span className="text-[10px] font-bold text-amber-400 uppercase">Commissions DJASSA &amp; Reprise</span>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/60">Commission vendeur prélevée</span>
                    <span className="font-mono text-white">
                      {formatFCFA(selectedRefund.financial.commissions.sellerCommissionChargedFcfa)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/60">Commissions reprises</span>
                    <span className="font-mono text-emerald-300">
                      {formatFCFA(
                        selectedRefund.financial.commissions.sellerCommissionReversedFcfa +
                          selectedRefund.financial.commissions.serviceFeeReversedFcfa
                      )}
                    </span>
                  </div>
                  <div className="text-[10px] pt-0.5 text-white/55">
                    {selectedRefund.financial.commissions.commissionAlreadyReversedOnce
                      ? `Protection anti-double reprise active (${selectedRefund.financial.commissions.commissionAdjustmentRef || 'OK'})`
                      : 'Aucune commission encore reprise sur ce dossier'}
                  </div>
                </div>
              </div>

              {/* Products Breakdown */}
              <div className="pt-2 border-t border-white/10 space-y-1.5">
                <span className="text-[11px] font-bold text-white/75 block">Produits & quantités concernées</span>
                {selectedRefund.items.map((it) => (
                  <div
                    key={it.productId}
                    className="p-2 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between gap-2 text-[11px]"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">{it.productTitle}</p>
                      <p className="text-[10px] text-white/50">
                        Commandé : {it.orderedQuantity} × {formatFCFA(it.unitPriceFcfa)} • Retenu RBT : {it.refundQuantity}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-emerald-300 shrink-0">
                      {formatFCFA(it.refundableLineFcfa)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4 : WORKFLOW EN 10 ÉTAPES + ACTIONS + EXÉCUTION PRESTATAIRE */}
        {detailTab === 'workflow' && (
          <div className="space-y-3">
            {/* 10 Steps Progress */}
            <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2">
              <h4 className="text-xs font-black text-white">Circuit de validation DJASSA (10 étapes)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {selectedRefund.steps.map((st) => (
                  <div
                    key={st.stepNumber}
                    className={`p-2 rounded-xl border text-[11px] flex items-center justify-between gap-2 ${
                      st.status === 'done'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                        : st.status === 'blocked'
                        ? 'bg-rose-500/15 border-rose-500/35 text-rose-200'
                        : st.status === 'skipped'
                        ? 'bg-white/5 border-white/10 text-white/45'
                        : 'bg-black/40 border-white/10 text-white/75'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-bold truncate">{st.label}</p>
                      {(st.note || st.actorName) && (
                        <p className="text-[10px] opacity-75 truncate">
                          {st.actorName ? `${st.actorName} • ` : ''}
                          {st.note}
                        </p>
                      )}
                    </div>
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-black/30 shrink-0">
                      {st.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            {!isTerminal && (
              <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-3">
                <h4 className="text-xs font-black text-white">Actions administratives & validation</h4>

                {/* Verify & Request Evidence */}
                {perms.verifyAndRequestEvidence && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-2.5 rounded-xl bg-black/40 border border-white/5">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-white/60 uppercase block">
                        Vérifier commande & pièce justificative
                      </span>
                      <input
                        type="text"
                        placeholder="Titre pièce (ex: Reçu Wave client)"
                        value={verifyEvTitle}
                        onChange={(e) => setVerifyEvTitle(e.target.value)}
                        className="w-full bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
                      />
                      <input
                        type="text"
                        placeholder="URL ou réf preuve (optionnel)"
                        value={verifyEvUrl}
                        onChange={(e) => setVerifyEvUrl(e.target.value)}
                        className="w-full bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
                      />
                      <button
                        type="button"
                        disabled={busyAction !== null}
                        onClick={async () => {
                          setBusyAction('verify');
                          try {
                            await refundsService.verifyRefund(selectedRefund.id, {
                              verifyTransaction: true,
                              verifyTitularity: true,
                              evidenceTitle: verifyEvTitle.trim() || undefined,
                              evidenceUrl: verifyEvUrl.trim() || undefined
                            });
                            setVerifyEvTitle('');
                            setVerifyEvUrl('');
                            showToast('Transaction, titularité & justificatifs vérifiés.');
                            await loadOverview();
                          } catch (e: unknown) {
                            showToast((e as Error).message);
                          } finally {
                            setBusyAction(null);
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white cursor-pointer"
                      >
                        Valider vérification (Étapes 2-3)
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-white/60 uppercase block">
                        Demander des justificatifs
                      </span>
                      <select
                        value={reqEvTargetRole}
                        onChange={(e) => setReqEvTargetRole(e.target.value as typeof reqEvTargetRole)}
                        className="w-full bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
                      >
                        <option value="client">Au Client</option>
                        <option value="seller">Au Vendeur</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Message de demande de pièce…"
                        value={reqEvMessage}
                        onChange={(e) => setReqEvMessage(e.target.value)}
                        className="w-full bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
                      />
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          disabled={busyAction !== null}
                          onClick={async () => {
                            setBusyAction('req-ev');
                            try {
                              await refundsService.requestEvidence(selectedRefund.id, {
                                targetRole: reqEvTargetRole,
                                message: reqEvMessage.trim() || 'Merci de transmettre votre justificatif sous 24h.'
                              });
                              setReqEvMessage('');
                              showToast('Demande de justificatif notifiée.');
                              await loadOverview();
                            } catch (e: unknown) {
                              showToast((e as Error).message);
                            } finally {
                              setBusyAction(null);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-amber-600/80 hover:bg-amber-600 text-xs font-bold text-white cursor-pointer"
                        >
                          Demander pièce
                        </button>
                        <button
                          type="button"
                          disabled={busyAction !== null}
                          onClick={async () => {
                            setBusyAction('hold');
                            try {
                              await refundsService.holdRefund(selectedRefund.id, 'Mis en attente administrative');
                              showToast('Dossier mis en attente.');
                              await loadOverview();
                            } catch (e: unknown) {
                              showToast((e as Error).message);
                            } finally {
                              setBusyAction(null);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white cursor-pointer"
                        >
                          Mettre en attente
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Approval / Dual Validation / Reject / Cancel */}
                <div className="flex items-center gap-2 flex-wrap">
                  {perms.approveRefundStandard &&
                    !selectedRefund.validatedByAgentId &&
                    selectedRefund.status !== 'en_cours_traitement' && (
                      <button
                        type="button"
                        disabled={busyAction !== null}
                        onClick={() =>
                          void runWithMfaIfNeeded(
                            'approve',
                            'MFA — Approbation remboursement',
                            `Confirmez la validation niveau 1 pour ${selectedRefund.code} (${formatFCFA(
                              selectedRefund.financial.requestedAmountFcfa
                            )}).`,
                            async (code) => {
                              await refundsService.approveRefund(selectedRefund.id, 'Validé par agent habilité', code);
                              showToast('Approbation niveau 1 enregistrée.');
                            }
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approuver (Agent)</span>
                      </button>
                    )}

                  {perms.superAdminFinalValidate && awaitingDual && (
                    <button
                      type="button"
                      disabled={busyAction !== null}
                      onClick={() =>
                        void runWithMfaIfNeeded(
                          'super-validate',
                          'MFA — Double validation Super Admin',
                          `Validation finale requise (> ${formatFCFA(overview.settings.dualValidationThresholdFcfa)}) pour ${selectedRefund.code}.`,
                          async (code) => {
                            await refundsService.superValidateRefund(
                              selectedRefund.id,
                              'Double validation Super Administrateur confirmée',
                              code
                            );
                            showToast('Double validation Super Admin confirmée.');
                          }
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Double validation Super Admin</span>
                    </button>
                  )}

                  {perms.approveRefundStandard && selectedRefund.status !== 'en_cours_traitement' && (
                    <button
                      type="button"
                      onClick={() => {
                        setReasonText('');
                        setReasonModal({
                          targetKind: 'refund',
                          targetId: selectedRefund.id,
                          mode: 'reject',
                          title: `Refuser le remboursement ${selectedRefund.code}`,
                          placeholder: 'Motif obligatoire du refus (min. 5 caractères)…'
                        });
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Refuser</span>
                    </button>
                  )}

                  {perms.cancelOrRetryOperation && selectedRefund.status !== 'en_cours_traitement' && (
                    <button
                      type="button"
                      onClick={() => {
                        setReasonText('');
                        setReasonModal({
                          targetKind: 'refund',
                          targetId: selectedRefund.id,
                          mode: 'cancel',
                          title: `Annuler avant exécution (${selectedRefund.code})`,
                          placeholder: 'Raison de l’annulation…'
                        });
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Annuler avant exécution</span>
                    </button>
                  )}

                  {perms.cancelOrRetryOperation && selectedRefund.status === 'echouee' && (
                    <button
                      type="button"
                      onClick={() =>
                        void runWithMfaIfNeeded(
                          'retry',
                          'MFA — Relancer opération échouée',
                          `Autoriser une nouvelle tentative de versement pour ${selectedRefund.code}.`,
                          async (code) => {
                            await refundsService.retryRefund(selectedRefund.id, execChannel, code);
                            showToast('Dossier prêt pour relance d’exécution.');
                          }
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Relancer après échec</span>
                    </button>
                  )}
                </div>

                {/* Step 7 & 8 Execution via Provider */}
                {perms.executeProviderTransfer &&
                  (selectedRefund.status === 'approuvee' || selectedRefund.status === 'en_cours_traitement') && (
                    <div className="p-3 rounded-xl bg-emerald-950/25 border border-emerald-500/30 space-y-2.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4" />
                          <span>Exécution & Rapprochement Prestataire</span>
                        </span>
                        <span className="text-[11px] font-mono text-white/75">
                          Solde à verser : {formatFCFA(selectedRefund.financial.remainingToRefundFcfa)}
                        </span>
                      </div>

                      {selectedRefund.status === 'approuvee' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <select
                            value={execChannel}
                            onChange={(e) => setExecChannel(e.target.value as PaymentProviderChannelId)}
                            className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
                          >
                            {overview.providers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.configured ? 'Configuré' : 'Manuel contrôlé'})
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={execPartialAmount}
                            onChange={(e) => setExecPartialAmount(e.target.value)}
                            placeholder="Montant FCFA"
                            className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                          />
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              disabled={busyAction !== null}
                              onClick={() =>
                                void runWithMfaIfNeeded(
                                  'execute',
                                  'MFA — Exécution remboursement',
                                  `Déclencher le versement via ${CHANNEL_LABELS[execChannel]} pour ${selectedRefund.code}.`,
                                  async (code) => {
                                    const res = await refundsService.executeRefund(
                                      selectedRefund.id,
                                      {
                                        channel: execChannel,
                                        amountFcfa: Number(execPartialAmount) || selectedRefund.financial.remainingToRefundFcfa
                                      },
                                      code,
                                      `exec-${selectedRefund.id}-${Date.now()}`
                                    );
                                    showToast(
                                      res.awaitingProviderConfirmation
                                        ? 'Dossier en cours de traitement : référence reçu prestataire requise.'
                                        : 'Remboursement exécuté et inscrit au journal immuable.'
                                    );
                                  }
                                )
                              }
                              className="flex-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white cursor-pointer"
                            >
                              Exécuter
                            </button>
                            <button
                              type="button"
                              disabled={busyAction !== null}
                              title="Tester gestion d'échec prestataire"
                              onClick={() =>
                                void runWithMfaIfNeeded(
                                  'exec-fail',
                                  'MFA — Test échec prestataire',
                                  `Simuler un refus/timeout prestataire sur ${selectedRefund.code}.`,
                                  async (code) => {
                                    await refundsService.executeRefund(
                                      selectedRefund.id,
                                      { channel: execChannel, simulateFailure: true },
                                      code
                                    );
                                  }
                                )
                              }
                              className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/35 text-[10px] font-bold text-rose-300 cursor-pointer"
                            >
                              Simuler échec
                            </button>
                          </div>
                        </div>
                      )}

                      {selectedRefund.status === 'en_cours_traitement' && (
                        <div className="space-y-2">
                          <p className="text-[11px] text-amber-300 font-semibold">
                            En attente de confirmation réelle ({CHANNEL_LABELS[selectedRefund.targetChannel]}). Saisissez la référence de reçu vérifiée :
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              placeholder="Référence reçu prestataire (ex: WV-984210)"
                              value={providerReceiptInput}
                              onChange={(e) => setProviderReceiptInput(e.target.value)}
                              className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                            />
                            <input
                              type="text"
                              placeholder="Note justificative (optionnel)"
                              value={providerProofNote}
                              onChange={(e) => setProviderProofNote(e.target.value)}
                              className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
                            />
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                disabled={providerReceiptInput.trim().length < 4 || busyAction !== null}
                                onClick={() =>
                                  void runWithMfaIfNeeded(
                                    'confirm-ext',
                                    'MFA — Confirmation reçu prestataire',
                                    `Confirmer le versement externe ${providerReceiptInput} pour ${selectedRefund.code}.`,
                                    async (code) => {
                                      await refundsService.confirmProviderRefund(
                                        selectedRefund.id,
                                        {
                                          providerReference: providerReceiptInput.trim(),
                                          proofNote: providerProofNote.trim() || undefined
                                        },
                                        code
                                      );
                                      setProviderReceiptInput('');
                                      setProviderProofNote('');
                                      showToast('Reçu prestataire confirmé et journalisé.');
                                    }
                                  )
                                }
                                className="flex-1 px-3 py-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white disabled:opacity-40 cursor-pointer"
                              >
                                Confirmer reçu
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setReasonText('');
                                  setReasonModal({
                                    targetKind: 'refund',
                                    targetId: selectedRefund.id,
                                    mode: 'mark_failed',
                                    title: `Signaler un échec prestataire (${selectedRefund.code})`,
                                    placeholder: 'Erreur retournée par le prestataire…'
                                  });
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs font-bold text-rose-300 cursor-pointer"
                              >
                                Échec
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
              </div>
            )}

            {/* Provider Attempts & Decision Log */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-[#141414] border border-white/10 space-y-2">
                <h5 className="text-xs font-black text-white">Tentatives prestataires ({selectedRefund.providerAttempts.length})</h5>
                {selectedRefund.providerAttempts.length === 0 ? (
                  <p className="text-[11px] text-white/45">Aucune exécution financière déclenchée.</p>
                ) : (
                  selectedRefund.providerAttempts.map((att) => (
                    <div key={att.id} className="p-2 rounded-xl bg-black/40 border border-white/5 text-[11px] space-y-0.5">
                      <div className="flex justify-between font-bold">
                        <span className="text-white">
                          #{att.attemptNumber} • {CHANNEL_LABELS[att.channel]}
                        </span>
                        <span className="font-mono text-emerald-300">{formatFCFA(att.amountFcfa)}</span>
                      </div>
                      <p className="text-[10px] font-mono text-white/60">
                        Réf: {att.providerReference} • {att.providerResponseStatus}
                      </p>
                      {att.errorMessage && <p className="text-[10px] text-rose-300">{att.errorMessage}</p>}
                      {att.receiptProof && <p className="text-[10px] text-white/55">{att.receiptProof}</p>}
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 rounded-2xl bg-[#141414] border border-white/10 space-y-2">
                <h5 className="text-xs font-black text-white">Journal des décisions ({selectedRefund.decisions.length})</h5>
                <div className="space-y-1.5 max-h-60 overflow-y-auto no-scrollbar">
                  {selectedRefund.decisions.map((dec) => (
                    <div key={dec.id} className="p-2 rounded-xl bg-black/40 border border-white/5 text-[11px]">
                      <div className="flex justify-between gap-2">
                        <span className="font-bold text-white">{dec.action}</span>
                        <span className="text-[10px] text-white/45 shrink-0">{fmtDateTime(dec.at)}</span>
                      </div>
                      <p className="text-[10px] text-white/65">{dec.note}</p>
                      <p className="text-[10px] text-emerald-300/80">Par : {dec.actorName}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Inspection Modals */}
        {inspectedUser && (
          <AdminUserDetailModal user={inspectedUser} onClose={() => setInspectedUser(null)} zIndexClass="z-[75]" />
        )}
        {inspectedOrder && <AdminOrderDetailModal order={inspectedOrder} onClose={() => setInspectedOrder(null)} />}

        {/* Reason Modal */}
        {reasonModal && (
          <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-[#141414] border border-white/15 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white">{reasonModal.title}</h3>
                <button type="button" onClick={() => setReasonModal(null)} className="text-white/50 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <textarea
                rows={3}
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder={reasonModal.placeholder}
                className="w-full bg-black/60 border border-white/15 rounded-xl p-2.5 text-xs text-white"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setReasonModal(null)} className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold text-white">
                  Fermer
                </button>
                <button
                  type="button"
                  disabled={reasonText.trim().length < 5 || busyAction !== null}
                  onClick={() => {
                    const rm = reasonModal;
                    const txt = reasonText.trim();
                    setReasonModal(null);
                    if (rm.mode === 'reject') {
                      void runWithMfaIfNeeded('reject', 'MFA — Refus remboursement', 'Confirmer le refus motivé.', async (code) => {
                        await refundsService.rejectRefund(rm.targetId, txt, code);
                        showToast('Dossier refusé avec motif enregistré.');
                      });
                    } else if (rm.mode === 'cancel') {
                      void (async () => {
                        setBusyAction('cancel');
                        try {
                          await refundsService.cancelRefund(rm.targetId, txt);
                          showToast('Dossier annulé avant exécution.');
                          await loadOverview();
                        } catch (e: unknown) {
                          showToast((e as Error).message);
                        } finally {
                          setBusyAction(null);
                        }
                      })();
                    } else {
                      void (async () => {
                        setBusyAction('mark-fail');
                        try {
                          await refundsService.markRefundFailed(rm.targetId, txt);
                          showToast('Échec signalé — relance disponible.');
                          await loadOverview();
                        } catch (e: unknown) {
                          showToast((e as Error).message);
                        } finally {
                          setBusyAction(null);
                        }
                      })();
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-xs font-bold text-white disabled:opacity-40 cursor-pointer"
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MFA Modal */}
        {mfaPrompt && (
          <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#141414] border border-emerald-500/40 p-4 space-y-3">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{mfaPrompt.title}</span>
              </h3>
              <p className="text-xs text-white/70">{mfaPrompt.description}</p>
              {mfaPrompt.previewCode && (
                <p className="text-[11px] font-mono bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-2.5 py-1.5 text-emerald-300">
                  Code MFA : {mfaPrompt.previewCode}
                </p>
              )}
              <input
                type="text"
                value={mfaInput}
                onChange={(e) => setMfaInput(e.target.value)}
                placeholder="Saisir le code MFA"
                className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setMfaPrompt(null)} className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold text-white">
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const p = mfaPrompt;
                    setMfaPrompt(null);
                    try {
                      await p.pendingRunner(mfaInput.trim());
                    } catch (e: unknown) {
                      showToast((e as Error).message);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white cursor-pointer"
                >
                  Valider MFA
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // MAIN WORKSPACE (11 SECTIONS)
  // =========================================================================
  return (
    <div id="admin-refunds-module" className="space-y-3 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-emerald-400 shrink-0" />
            <h3 className="text-sm font-black text-white">Remboursements &amp; indemnisations</h3>
            {unreadNotifsCount > 0 && (
              <span className="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/35 text-[10px] font-bold flex items-center gap-1">
                <Bell className="w-3 h-3" />
                {unreadNotifsCount} notif(s)
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/55">
            Opérations financières contrôlées, double validation Super Admin, commissions &amp; indemnisations acteurs.
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => void handleSyncOrders()}
            className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busyAction === 'sync' ? 'animate-spin' : ''}`} />
            <span>Sync commandes &amp; litiges</span>
          </button>
          {perms.createRefundOrCompRequest && (
            <button
              type="button"
              onClick={() => setCreateRefundOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouveau remboursement</span>
            </button>
          )}
          {perms.manageCompensations && (
            <button
              type="button"
              onClick={() => setCreateCompOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Nouvelle indemnisation</span>
            </button>
          )}
        </div>
      </div>

      {/* 11-Section Sub-Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {SECTION_TABS.map((t) => {
          const isActive = section === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setSection(t.id);
                setSelectedCompId(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap border transition cursor-pointer ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/45'
                  : 'bg-[#141414] text-white/55 border-white/10 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* 1. TABLEAU DE BORD (10 KPIs RÉELS + PRESTATAIRES + NOTIFICATIONS)      */}
      {/* ===================================================================== */}
      {section === 'dashboard' && (
        <div className="space-y-3">
          {/* 10 Required Indicators */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { label: 'Total remboursements', value: String(overview.kpis.totalRefunds), cls: 'text-white', onClick: () => setSection('all') },
              { label: 'En attente', value: String(overview.kpis.pendingRefunds), cls: 'text-amber-300', onClick: () => setSection('pending') },
              { label: 'En cours', value: String(overview.kpis.inProgressRefunds), cls: 'text-purple-300', onClick: () => setSection('in_progress') },
              { label: 'Effectués', value: String(overview.kpis.completedRefunds), cls: 'text-emerald-300', onClick: () => setSection('completed') },
              { label: 'Échoués', value: String(overview.kpis.failedRefunds), cls: 'text-rose-300', onClick: () => setSection('failed') },
              { label: 'Nombre d’indemnisations', value: String(overview.kpis.totalCompensations), cls: 'text-amber-300', onClick: () => setSection('compensations') },
              { label: 'Montant total remboursé', value: formatFCFA(overview.kpis.totalRefundedAmountFcfa), cls: 'text-emerald-300', onClick: () => setSection('completed') },
              { label: 'Total des indemnisations', value: formatFCFA(overview.kpis.totalCompensationsPaidFcfa), cls: 'text-amber-300', onClick: () => setSection('compensations') },
              { label: 'Montant en attente', value: formatFCFA(overview.kpis.pendingAmountFcfa), cls: 'text-sky-300', onClick: () => setSection('pending') },
              { label: 'Remboursements du mois', value: formatFCFA(overview.kpis.monthRefundedAmountFcfa), cls: 'text-cyan-300', onClick: () => setSection('financial_history') }
            ].map((k) => (
              <button
                key={k.label}
                type="button"
                onClick={k.onClick}
                className="p-3 rounded-2xl bg-[#141414] hover:bg-[#191919] border border-white/10 text-left transition cursor-pointer"
              >
                <span className="text-[10px] text-white/50 block truncate">{k.label}</span>
                <span className={`text-sm font-black font-mono mt-0.5 block ${k.cls}`}>{k.value}</span>
              </button>
            ))}
          </div>

          {/* Pending Super Admin 4-Eyes Validations */}
          {dualValidationQueue.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-cyan-950/25 border border-cyan-500/35 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-cyan-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>File de double validation Super Administrateur ({dualValidationQueue.length})</span>
                </h4>
              </div>
              <div className="space-y-1.5">
                {dualValidationQueue.slice(0, 5).map((r) => (
                  <div
                    key={r.id}
                    onClick={() => {
                      setSelectedRefundId(r.id);
                      setDetailTab('workflow');
                    }}
                    className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-2 cursor-pointer hover:border-cyan-400/50"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {r.code} • Commande #{r.orderNumber} • {r.actors.client.name}
                      </p>
                      <p className="text-[10px] text-white/55">
                        Validé agent : {r.validatedByAgentName || 'En attente agent'} • {REFUND_TYPE_LABELS[r.refundType]}
                      </p>
                    </div>
                    <span className="text-xs font-mono font-black text-cyan-300 shrink-0">
                      {formatFCFA(r.financial.requestedAmountFcfa)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Providers Status + Recent Notifications */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2">
              <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span>Canaux &amp; Prestataires de paiement</span>
              </h4>
              <div className="space-y-1.5">
                {overview.providers.map((p) => (
                  <div key={p.id} className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-white">{p.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border ${
                          p.configured
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                        }`}
                      >
                        {p.modeLabel}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/55">{p.statusDetail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2">
              <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-amber-400" />
                <span>Notifications automatiques récentes ({overview.notifications.length})</span>
              </h4>
              {overview.notifications.length === 0 ? (
                <p className="text-[11px] text-white/45">Aucune notification générée.</p>
              ) : (
                <div className="space-y-1.5 max-h-80 overflow-y-auto no-scrollbar">
                  {overview.notifications.slice(0, 12).map((n) => {
                    const isRead = n.readByAdminIds.includes(overview.actor.staffId);
                    return (
                      <div
                        key={n.id}
                        onClick={async () => {
                          if (!isRead) await refundsService.markNotificationRead(n.id);
                          if (n.entityType === 'refund') {
                            setSelectedRefundId(n.entityId);
                          } else {
                            setSection('compensations');
                            setSelectedCompId(n.entityId);
                          }
                          void loadOverview();
                        }}
                        className={`p-2.5 rounded-xl border cursor-pointer transition ${
                          isRead
                            ? 'bg-black/30 border-white/5 text-white/65'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold truncate">{n.title}</span>
                          <span className="text-[9px] text-white/45 shrink-0">{fmtDateTime(n.createdAt)}</span>
                        </div>
                        <p className="text-[10px] opacity-80">{n.body}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2-6 & 8-9. LISTE DES REMBOURSEMENTS (Recherche & Filtres complets)     */}
      {/* ===================================================================== */}
      {['all', 'pending', 'in_progress', 'completed', 'failed', 'partial', 'full'].includes(section) && (
        <div className="space-y-3">
          {/* Search & Multi-Filters Bar */}
          <div className="p-3 rounded-2xl bg-[#141414] border border-white/10 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div className="relative sm:col-span-2">
                <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher ID RBT, #commande, client, vendeur, motif…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-black/60 border border-white/15 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white"
                />
              </div>
              <input
                type="text"
                placeholder="Filtrer N° commande"
                value={filterOrderRef}
                onChange={(e) => setFilterOrderRef(e.target.value)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              />
              <select
                value={filterDateRange}
                onChange={(e) => setFilterDateRange(e.target.value as typeof filterDateRange)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                <option value="all">Toutes les dates</option>
                <option value="today">Aujourd’hui</option>
                <option value="7d">7 derniers jours</option>
                <option value="30d">30 derniers jours</option>
              </select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <select
                value={filterActorRole}
                onChange={(e) => setFilterActorRole(e.target.value as typeof filterActorRole)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                <option value="all">Tous acteurs</option>
                <option value="client">Client</option>
                <option value="seller">Avec Vendeur</option>
              </select>
              <select
                value={filterReasonOrType}
                onChange={(e) => setFilterReasonOrType(e.target.value as typeof filterReasonOrType)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                <option value="all">Tous types / motifs</option>
                <option value="complet">Complet</option>
                <option value="partiel">Partiel</option>
                <option value="apres_annulation">Après annulation</option>
                <option value="apres_litige">Après litige</option>
                <option value="exceptionnel">Exceptionnel</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                <option value="all">Tous statuts</option>
                {Object.entries(REFUND_STATUS_META).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Montant min (FCFA)"
                value={filterMinAmount}
                onChange={(e) => setFilterMinAmount(e.target.value)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
              />
              <input
                type="number"
                placeholder="Montant max (FCFA)"
                value={filterMaxAmount}
                onChange={(e) => setFilterMaxAmount(e.target.value)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
              />
            </div>
          </div>

          {/* Refunds List */}
          {paginatedRefunds.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#141414] border border-white/10 text-center space-y-2">
              <p className="text-xs text-white/60">Aucun remboursement correspondant dans cette rubrique.</p>
              <button
                type="button"
                onClick={() => void handleSyncOrders()}
                className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold text-white cursor-pointer"
              >
                Synchroniser avec commandes &amp; litiges
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {paginatedRefunds.map((r) => {
                const sm = REFUND_STATUS_META[r.status];
                return (
                  <div
                    key={r.id}
                    onClick={() => {
                      setSelectedRefundId(r.id);
                      setDetailTab('general');
                    }}
                    className="p-3 rounded-2xl bg-[#141414] hover:bg-[#191919] border border-white/10 hover:border-emerald-500/35 transition cursor-pointer space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-mono font-black text-emerald-400">{r.code}</span>
                          <span className="text-[11px] font-mono text-white/75">#{r.orderNumber}</span>
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${sm.cls}`}>
                            {sm.label}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/5 text-white/70 border border-white/10">
                            {REFUND_TYPE_LABELS[r.refundType]}
                          </span>
                          {r.suspiciousSignals.length > 0 && (
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/35 flex items-center gap-1">
                              <BadgeAlert className="w-3 h-3" />
                              Alerte ({r.suspiciousSignals.length})
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-white truncate">
                          Motif : {r.reasonDetail}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono font-black text-emerald-300 block">
                          {formatFCFA(r.financial.requestedAmountFcfa)}
                        </span>
                        <span className="text-[10px] text-white/45 font-mono block">
                          sur {formatFCFA(r.financial.initialPaidFcfa)} initial
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1.5 border-t border-white/5 text-[10px] text-white/65">
                      <div className="truncate">
                        <span className="text-white/40">Client : </span>
                        <span className="font-semibold text-white">{r.actors.client.name}</span>
                      </div>
                      <div className="truncate">
                        <span className="text-white/40">Vendeur : </span>
                        <span className="font-semibold text-white">{r.actors.seller?.name || '—'}</span>
                      </div>
                      <div className="truncate">
                        <span className="text-white/40">Livraison : </span>
                        <span className="font-semibold text-white">Gérée par le vendeur</span>
                      </div>
                      <div className="truncate">
                        <span className="text-white/40">Paiement init. : </span>
                        <span className="font-semibold text-white uppercase">{r.initialPaymentMethod}</span>
                      </div>
                      <div className="truncate sm:text-right">
                        <span className="text-white/40">Demandé le : </span>
                        <span className="font-semibold text-white">{fmtDate(r.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-1 text-xs text-white/60">
                  <span>
                    Page {page} / {totalPages} ({filteredRefunds.length} dossier(s))
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="p-1.5 rounded-xl bg-[#141414] border border-white/10 disabled:opacity-35 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="p-1.5 rounded-xl bg-[#141414] border border-white/10 disabled:opacity-35 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 7. GESTION DES INDEMNISATIONS (Distincte des remboursements)          */}
      {/* ===================================================================== */}
      {section === 'compensations' && (
        <div className="space-y-3">
          {!selectedComp ? (
            <>
              <div className="p-3 rounded-2xl bg-[#141414] border border-amber-500/25 flex items-center justify-between gap-2 flex-wrap">
                <div className="space-y-0.5">
                  <p className="text-xs font-black text-amber-300">
                    Indemnisations DJASSA — Compensation de préjudice reconnu
                  </p>
                  <p className="text-[11px] text-white/60">
                    Distinct des remboursements : compense une perte ou un incident pour un Client ou Vendeur.
                  </p>
                </div>
                {perms.manageCompensations && (
                  <button
                    type="button"
                    onClick={() => setCreateCompOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Créer une indemnisation</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Rechercher indemnisation, bénéficiaire, commande…"
                    value={compSearch}
                    onChange={(e) => setCompSearch(e.target.value)}
                    className="w-full bg-[#141414] border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white"
                  />
                </div>
                <select
                  value={compFilterRole}
                  onChange={(e) => setCompFilterRole(e.target.value as typeof compFilterRole)}
                  className="bg-[#141414] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="all">Tous bénéficiaires</option>
                  <option value="client">Clients</option>
                  <option value="seller">Vendeurs</option>
                </select>
              </div>

              {filteredCompensations.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#141414] border border-white/10 text-center text-xs text-white/55">
                  Aucune indemnisation enregistrée pour ce filtre.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCompensations.map((c) => {
                    const sm = COMP_STATUS_META[c.status];
                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCompId(c.id)}
                        className="p-3 rounded-2xl bg-[#141414] hover:bg-[#191919] border border-white/10 hover:border-amber-500/35 cursor-pointer space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-mono font-black text-amber-300">{c.code}</span>
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${sm.cls}`}>
                              {sm.label}
                            </span>
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/5 text-white/75 border border-white/10">
                              {ROLE_LABELS[c.beneficiaryRole]} : {c.beneficiary.name}
                            </span>
                          </div>
                          <span className="text-xs font-mono font-black text-emerald-300">
                            {formatFCFA(c.paidAmountFcfa || c.approvedAmountFcfa || c.requestedAmountFcfa)}
                          </span>
                        </div>
                        <p className="text-xs text-white/85">
                          <strong className="text-white">{COMP_REASON_LABELS[c.reason]} :</strong> {c.incidentDescription}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-white/50">
                          <span>Source : {FUNDING_SOURCE_LABELS[c.fundingSource]}</span>
                          <span>
                            {c.orderNumber ? `Commande #${c.orderNumber} • ` : ''}
                            {fmtDateTime(c.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* Selected Compensation Detail */
            <div className="space-y-3 p-3.5 rounded-2xl bg-[#141414] border border-amber-500/30">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCompId(null)}
                    className="px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Liste</span>
                  </button>
                  <span className="text-xs font-mono font-black text-amber-300">{selectedComp.code}</span>
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${COMP_STATUS_META[selectedComp.status].cls}`}>
                    {COMP_STATUS_META[selectedComp.status].label}
                  </span>
                </div>
                <span className="text-xs font-mono text-white/60">
                  Créée le {fmtDateTime(selectedComp.createdAt)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-white/45 block">Bénéficiaire ({ROLE_LABELS[selectedComp.beneficiaryRole]})</span>
                  <span className="font-bold text-white">{selectedComp.beneficiary.name}</span>
                  <span className="block text-[10px] text-white/50 font-mono">{selectedComp.beneficiaryPayoutAccount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-white/45 block">Montant demandé</span>
                  <span className="font-mono font-bold text-white">{formatFCFA(selectedComp.requestedAmountFcfa)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-white/45 block">Montant approuvé</span>
                  <span className="font-mono font-bold text-cyan-300">{formatFCFA(selectedComp.approvedAmountFcfa)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-white/45 block">Montant versé</span>
                  <span className="font-mono font-bold text-emerald-300">{formatFCFA(selectedComp.paidAmountFcfa)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-white/45 block">Motif &amp; Source financement</span>
                  <span className="font-bold text-white block">{COMP_REASON_LABELS[selectedComp.reason]}</span>
                  <span className="text-[11px] text-amber-300">{FUNDING_SOURCE_LABELS[selectedComp.fundingSource]}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-white/45 block">Validation &amp; Date décision</span>
                  <span className="font-semibold text-white block">
                    {selectedComp.superAdminValidatedByName || selectedComp.validatedByName || 'En attente'}
                  </span>
                  <span className="text-[10px] text-white/50">{fmtDateTime(selectedComp.decisionDate)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-white/45 block">Preuve du versement</span>
                  <span className="font-mono text-[11px] text-emerald-300 block">
                    {selectedComp.payoutReference || 'Non versée'}
                  </span>
                  <span className="text-[10px] text-white/55">{selectedComp.payoutProof || '—'}</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 text-xs">
                <span className="text-[10px] text-white/45 uppercase font-bold block">Description de l’incident</span>
                <p className="text-white/85 mt-0.5">{selectedComp.incidentDescription}</p>
              </div>

              {/* Compensation Workflow Actions */}
              {perms.manageCompensations && selectedComp.status !== 'versee' && selectedComp.status !== 'refusee' && selectedComp.status !== 'annulee' && (
                <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        void runWithMfaIfNeeded('comp-verify', 'MFA — Vérification indemnisation', 'Vérifier l’incident.', async (code) => {
                          await refundsService.runCompensationAction(selectedComp.id, { action: 'verify' }, code);
                          showToast('Incident vérifié.');
                        })
                      }
                      className="px-2.5 py-1.5 rounded-xl bg-indigo-600 text-xs font-bold text-white cursor-pointer"
                    >
                      Vérifier
                    </button>

                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={compApproveAmount}
                        onChange={(e) => setCompApproveAmount(e.target.value)}
                        className="w-28 bg-black/60 border border-white/15 rounded-xl px-2 py-1 text-xs font-mono text-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          void runWithMfaIfNeeded(
                            'comp-approve',
                            'MFA — Approbation indemnisation',
                            `Approuver ${compApproveAmount} FCFA pour ${selectedComp.beneficiary.name}.`,
                            async (code) => {
                              await refundsService.runCompensationAction(
                                selectedComp.id,
                                { action: 'approve', approvedAmountFcfa: Number(compApproveAmount) },
                                code
                              );
                              showToast('Indemnisation approuvée.');
                            }
                          )
                        }
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white cursor-pointer"
                      >
                        Approuver
                      </button>
                    </div>

                    {selectedComp.requiresSuperAdminValidation && !selectedComp.superAdminValidatedById && perms.superAdminFinalValidate && (
                      <button
                        type="button"
                        onClick={() =>
                          void runWithMfaIfNeeded(
                            'comp-super',
                            'MFA — Double validation Super Admin',
                            `Confirmer le versement > seuil pour ${selectedComp.code}.`,
                            async (code) => {
                              await refundsService.runCompensationAction(selectedComp.id, { action: 'super_validate' }, code);
                              showToast('Double validation Super Admin validée.');
                            }
                          )
                        }
                        className="px-2.5 py-1.5 rounded-xl bg-cyan-600 text-xs font-bold text-white cursor-pointer"
                      >
                        Double val. Super Admin
                      </button>
                    )}

                    {selectedComp.status === 'echouee' && (
                      <button
                        type="button"
                        onClick={() =>
                          void runWithMfaIfNeeded('comp-retry', 'MFA — Relance indemnisation', 'Autoriser relance.', async (code) => {
                            await refundsService.runCompensationAction(selectedComp.id, { action: 'retry' }, code);
                            showToast('Indemnisation prête pour relance.');
                          })
                        }
                        className="px-2.5 py-1.5 rounded-xl bg-amber-600 text-xs font-bold text-white cursor-pointer"
                      >
                        Relancer
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setReasonText('');
                        setReasonModal({
                          targetKind: 'compensation',
                          targetId: selectedComp.id,
                          mode: 'reject',
                          title: `Refuser l’indemnisation ${selectedComp.code}`,
                          placeholder: 'Motif obligatoire du refus…'
                        });
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs font-bold text-rose-300 cursor-pointer"
                    >
                      Refuser
                    </button>
                  </div>

                  {selectedComp.status === 'approuvee' && (
                    <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-white/10">
                      <select
                        value={compExecChannel}
                        onChange={(e) => setCompExecChannel(e.target.value as PaymentProviderChannelId)}
                        className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
                      >
                        {overview.providers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          void runWithMfaIfNeeded(
                            'comp-exec',
                            'MFA — Versement indemnisation',
                            `Verser ${formatFCFA(selectedComp.approvedAmountFcfa || selectedComp.requestedAmountFcfa)} à ${selectedComp.beneficiary.name}.`,
                            async (code) => {
                              const res = await refundsService.runCompensationAction(
                                selectedComp.id,
                                { action: 'execute', channel: compExecChannel },
                                code
                              );
                              showToast(
                                res.awaitingProviderConfirmation
                                  ? 'En cours de versement : référence reçu requise.'
                                  : 'Indemnisation versée et journalisée.'
                              );
                            }
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white cursor-pointer"
                      >
                        Verser l’indemnisation
                      </button>
                    </div>
                  )}

                  {selectedComp.status === 'en_cours_versement' && (
                    <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-white/10">
                      <input
                        type="text"
                        placeholder="Référence reçu externe…"
                        value={compProviderRef}
                        onChange={(e) => setCompProviderRef(e.target.value)}
                        className="flex-1 bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                      <button
                        type="button"
                        disabled={compProviderRef.trim().length < 4}
                        onClick={() =>
                          void runWithMfaIfNeeded(
                            'comp-confirm',
                            'MFA — Confirmation versement',
                            `Confirmer le reçu ${compProviderRef}.`,
                            async (code) => {
                              await refundsService.runCompensationAction(
                                selectedComp.id,
                                { action: 'confirm_provider', providerReference: compProviderRef.trim() },
                                code
                              );
                              setCompProviderRef('');
                              showToast('Indemnisation confirmée et versée.');
                            }
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white disabled:opacity-40 cursor-pointer"
                      >
                        Confirmer reçu
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Decisions log */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-white/70">Historique dossier ({selectedComp.decisions.length})</span>
                {selectedComp.decisions.map((d) => (
                  <div key={d.id} className="p-2 rounded-xl bg-black/40 border border-white/5 text-[11px] flex justify-between gap-2">
                    <div>
                      <span className="font-bold text-white">{d.action}</span>
                      <span className="text-white/60 ml-1.5">{d.note}</span>
                    </div>
                    <span className="text-[10px] text-white/45 shrink-0">{fmtDateTime(d.at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 10. HISTORIQUE FINANCIER IMMUABLE                                     */}
      {/* ===================================================================== */}
      {section === 'financial_history' && (
        <div className="space-y-3">
          <div className="p-3 rounded-2xl bg-[#141414] border border-emerald-500/25 flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h4 className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Journal financier immuable (SHA-256)</span>
              </h4>
              <p className="text-[10px] text-white/55">
                Toutes les écritures de remboursement, indemnisations, reprises de commissions et échecs sont scellées.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Rechercher réf, code, acteur…"
                value={journalSearch}
                onChange={(e) => setJournalSearch(e.target.value)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              />
              <select
                value={journalFilterType}
                onChange={(e) => setJournalFilterType(e.target.value)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                <option value="all">Toutes opérations</option>
                <option value="refund_executed">Remboursements exécutés</option>
                <option value="refund_partial_executed">Remboursements partiels</option>
                <option value="refund_failed">Échecs remboursements</option>
                <option value="compensation_paid">Indemnisations versées</option>
                <option value="commission_reversed">Commissions ajustées</option>
              </select>
            </div>
          </div>

          {filteredJournal.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#141414] border border-white/10 text-center text-xs text-white/55">
              Aucune écriture enregistrée dans le journal financier.
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredJournal.map((j) => (
                <div key={j.id} className="p-3 rounded-2xl bg-[#141414] border border-white/10 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-emerald-300">{j.entityCode}</span>
                      <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-bold text-white/80">
                        {j.entryType.replace(/_/g, ' ')}
                      </span>
                      {j.orderNumber && <span className="text-[11px] font-mono text-white/60">#{j.orderNumber}</span>}
                    </div>
                    <div className="text-right font-mono">
                      <span className="font-black text-white">{formatFCFA(j.amountFcfa)}</span>
                      {j.commissionDeltaFcfa !== 0 && (
                        <span className="text-[10px] text-amber-300 ml-2">
                          (Comm: {j.commissionDeltaFcfa > 0 ? '+' : ''}
                          {formatFCFA(j.commissionDeltaFcfa)})
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-white/75">{j.note}</p>
                  <div className="flex items-center justify-between text-[10px] text-white/45 font-mono flex-wrap gap-1">
                    <span>
                      Bénéficiaire : {j.beneficiaryName} • Canal : {CHANNEL_LABELS[j.channel]} • Réf : {j.providerReference}
                    </span>
                    <span>
                      {j.actorName} • {fmtDateTime(j.at)} • SHA:{j.immutableChecksum.slice(0, 12)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 11. PARAMÈTRES & PERMISSIONS                                          */}
      {/* ===================================================================== */}
      {section === 'settings' && settingsDraft && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>Seuils, Plafonds &amp; Règles d’éligibilité / Commissions</span>
              </h4>
              {perms.manageRefundSettings && (
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() =>
                    void runWithMfaIfNeeded(
                      'save-settings',
                      'MFA — Modification paramètres financiers',
                      'Confirmez la sauvegarde des règles de remboursements & indemnisations.',
                      async (code) => {
                        await refundsService.updateSettings(settingsDraft, code);
                        showToast('Paramètres sauvegardés et tracés.');
                      }
                    )
                  }
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white cursor-pointer"
                >
                  Enregistrer paramètres
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Seuil double val. Super Admin (FCFA)</label>
                <input
                  type="number"
                  value={settingsDraft.dualValidationThresholdFcfa}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, dualValidationThresholdFcfa: Number(e.target.value) || 0 })
                  }
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Plafond 1 remboursement (FCFA)</label>
                <input
                  type="number"
                  value={settingsDraft.maxSingleRefundFcfa}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, maxSingleRefundFcfa: Number(e.target.value) || 1000 })
                  }
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Plafond indemnisation (FCFA)</label>
                <input
                  type="number"
                  value={settingsDraft.maxCompensationFcfa}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, maxCompensationFcfa: Number(e.target.value) || 1000 })
                  }
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Délai SLA traitement (heures)</label>
                <input
                  type="number"
                  value={settingsDraft.slaProcessingHours}
                  onChange={(e) =>
                    setSettingsDraft({ ...settingsDraft, slaProcessingHours: Number(e.target.value) || 24 })
                  }
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Preuve obligatoire &gt; (FCFA)</label>
                <input
                  type="number"
                  value={settingsDraft.eligibilityRules.requireProofOverFcfa}
                  onChange={(e) =>
                    setSettingsDraft({
                      ...settingsDraft,
                      eligibilityRules: {
                        ...settingsDraft.eligibilityRules,
                        requireProofOverFcfa: Number(e.target.value) || 0
                      }
                    })
                  }
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                />
              </div>
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10 text-[11px]">
              <div className="space-y-1.5">
                <span className="font-bold text-white block">Types de remboursements autorisés</span>
                {(Object.keys(REFUND_TYPE_LABELS) as RefundType[]).map((rt) => (
                  <label key={rt} className="flex items-center justify-between p-2 rounded-xl bg-black/40 border border-white/5 cursor-pointer">
                    <span className="text-white/85">{REFUND_TYPE_LABELS[rt]}</span>
                    <input
                      type="checkbox"
                      checked={settingsDraft.enabledRefundTypes[rt]}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          enabledRefundTypes: { ...settingsDraft.enabledRefundTypes, [rt]: e.target.checked }
                        })
                      }
                    />
                  </label>
                ))}
              </div>

              <div className="space-y-1.5">
                <span className="font-bold text-white block">Règles de commissions &amp; sécurité</span>
                {(
                  [
                    ['reverseSellerCommissionOnFullRefund', 'Restituer commission vendeur si RBT complet'],
                    ['reversePlatformServiceFeeOnFullRefund', 'Reprise frais de service plateforme'],
                    ['preventDoubleCommissionReversal', 'Bloquer strictement la double reprise commission'],
                    ['blockDuplicateRefundsStrictly', 'Bloquer strictement les doubles remboursements']
                  ] as const
                ).map(([key, label]) => {
                  const isEligibility = key === 'blockDuplicateRefundsStrictly';
                  const checked = isEligibility
                    ? settingsDraft.eligibilityRules.blockDuplicateRefundsStrictly
                    : settingsDraft.commissionRules[key];
                  return (
                    <label key={key} className="flex items-center justify-between p-2 rounded-xl bg-black/40 border border-white/5 cursor-pointer">
                      <span className="text-white/85">{label}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (isEligibility) {
                            setSettingsDraft({
                              ...settingsDraft,
                              eligibilityRules: { ...settingsDraft.eligibilityRules, blockDuplicateRefundsStrictly: e.target.checked }
                            });
                          } else {
                            setSettingsDraft({
                              ...settingsDraft,
                              commissionRules: { ...settingsDraft.commissionRules, [key]: e.target.checked }
                            });
                          }
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Agent Permissions Matrix */}
          <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5">
            <h4 className="text-xs font-black text-white">Agents autorisés &amp; Matrice de permissions financières</h4>
            <div className="space-y-2">
              {overview.staffPermissions.map((staff) => (
                <div key={staff.staffId} className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">{staff.name}</p>
                      <p className="text-[10px] text-white/50">
                        {staff.email} • Rôle : <span className="uppercase text-emerald-300">{staff.role}</span>
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[10px]">
                    {(Object.keys(PERMISSION_LABELS) as RefundPermissionKey[]).map((pk) => (
                      <label key={pk} className="flex items-center gap-1.5 p-1.5 rounded-lg bg-white/5 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={staff.role === 'super_admin' || overview.actor.role !== 'super_admin'}
                          checked={staff.permissions[pk]}
                          onChange={(e) => {
                            const nextVal = e.target.checked;
                            void runWithMfaIfNeeded(
                              `perm-${staff.staffId}`,
                              'MFA — Droits financiers agent',
                              `Modifier la permission ${pk} pour ${staff.name}.`,
                              async (code) => {
                                await refundsService.updatePermissions(staff.staffId, { [pk]: nextVal }, code);
                                showToast('Permission mise à jour.');
                              }
                            );
                          }}
                        />
                        <span className="text-white/80 truncate" title={PERMISSION_LABELS[pk]}>
                          {PERMISSION_LABELS[pk]}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Settings Change History */}
          {overview.settings.settingsChangeHistory.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2">
              <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                <History className="w-4 h-4 text-amber-400" />
                <span>Historique des modifications de paramètres</span>
              </h4>
              {overview.settings.settingsChangeHistory.slice(0, 8).map((h) => (
                <div key={h.id} className="p-2 rounded-xl bg-black/40 border border-white/5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="font-bold text-white">{h.summary}</span>
                    <span className="text-[10px] text-white/45">{fmtDateTime(h.at)}</span>
                  </div>
                  <span className="text-[10px] text-emerald-300">Par : {h.actorName}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL : NOUVEAU REMBOURSEMENT (5 TYPES + CALCUL PARTIEL PRODUITS)     */}
      {/* ===================================================================== */}
      {createRefundOpen && (
        <div className="fixed inset-0 z-[85] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusyAction('create-refund');
              try {
                const matchedOrder = orders.find((o) => o.id === newOrderId || o.orderNumber === newOrderNumberManual.trim());
                const res = await refundsService.createRefund(
                  {
                    refundType: newRefundType,
                    origin: newOrigin,
                    orderNumber: newOrderNumberManual.trim(),
                    orderId: matchedOrder?.id,
                    order: matchedOrder,
                    reasonCategory: newReasonCategory,
                    reasonDetail: newReasonDetail.trim(),
                    targetChannel: newTargetChannel,
                    clientName: newClientName.trim() || undefined,
                    clientPhone: newClientPhone.trim() || undefined,
                    initialPaidFcfa: Number(newInitialPaid) || undefined,
                    deliveryFeeFcfa: Number(newDeliveryFee) || 0,
                    customAdjustedAmountFcfa:
                      newRefundType === 'partiel' && Number(newCustomAmount) > 0
                        ? Number(newCustomAmount)
                        : undefined,
                    items: newItemsDraft.length > 0 ? newItemsDraft : undefined,
                    evidence: newEvidenceTitle.trim()
                      ? [{ title: newEvidenceTitle.trim(), kind: 'receipt' }]
                      : undefined
                  },
                  `rbt-create-${newOrderNumberManual.trim()}-${Date.now()}`
                );
                setCreateRefundOpen(false);
                setNewReasonDetail('');
                setNewCustomAmount('');
                setNewEvidenceTitle('');
                showToast(`Demande ${res.refund.code} créée.`);
                await loadOverview();
                setSelectedRefundId(res.refund.id);
              } catch (err: unknown) {
                showToast((err as Error).message);
              } finally {
                setBusyAction(null);
              }
            }}
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#141414] border border-emerald-500/35 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white">Créer une demande de remboursement</h3>
              <button type="button" onClick={() => setCreateRefundOpen(false)} className="text-white/50 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={newOrderId}
                onChange={(e) => setNewOrderId(e.target.value)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                <option value="">Choisir une commande DJASSA…</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.orderNumber} — {o.deliveryAddress.recipientName} ({formatFCFA(o.total)})
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="Réf commande (ex: DJ-2026-8841)"
                value={newOrderNumberManual}
                onChange={(e) => setNewOrderNumberManual(e.target.value)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <select
                value={newRefundType}
                onChange={(e) => setNewRefundType(e.target.value as RefundType)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                <option value="complet">Remboursement complet</option>
                <option value="partiel">Remboursement partiel</option>
                <option value="apres_annulation">Après annulation</option>
                <option value="apres_litige">Après litige</option>
                <option value="exceptionnel">Remboursement exceptionnel</option>
              </select>
              <select
                value={newReasonCategory}
                onChange={(e) => setNewReasonCategory(e.target.value)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                {(REASON_PRESETS_BY_TYPE[newRefundType] || []).map((p) => (
                  <option key={p.category} value={p.category}>
                    {p.label}
                  </option>
                ))}
              </select>
              <select
                value={newTargetChannel}
                onChange={(e) => setNewTargetChannel(e.target.value as PaymentProviderChannelId)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                {overview.providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="Nom client"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              />
              <input
                type="text"
                placeholder="Tél / compte bénéficiaire"
                value={newClientPhone}
                onChange={(e) => setNewClientPhone(e.target.value)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              />
              <input
                type="number"
                required
                placeholder="Montant initial payé"
                value={newInitialPaid}
                onChange={(e) => setNewInitialPaid(e.target.value)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
              />
              <input
                type="number"
                placeholder="Frais livraison (FCFA)"
                value={newDeliveryFee}
                onChange={(e) => setNewDeliveryFee(e.target.value)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
              />
            </div>

            {/* Interactive Partial Items Selector */}
            {newRefundType === 'partiel' && (
              <div className="p-2.5 rounded-xl bg-black/40 border border-emerald-500/25 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-emerald-300">Sélection produits &amp; quantités (Calcul auto)</span>
                  <span className="font-mono font-bold text-white">Calculé : {formatFCFA(partialComputedSum)}</span>
                </div>
                {newItemsDraft.map((it, idx) => (
                  <div key={it.productId} className="flex items-center justify-between gap-2 text-[11px]">
                    <label className="flex items-center gap-1.5 min-w-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={it.selectedForRefund}
                        onChange={(e) => {
                          const copy = [...newItemsDraft];
                          copy[idx] = { ...copy[idx], selectedForRefund: e.target.checked };
                          setNewItemsDraft(copy);
                        }}
                      />
                      <span className="text-white truncate">{it.productTitle}</span>
                    </label>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min={0}
                        max={it.orderedQuantity}
                        value={it.refundQuantity}
                        onChange={(e) => {
                          const qty = Math.max(0, Math.min(it.orderedQuantity, Number(e.target.value) || 0));
                          const copy = [...newItemsDraft];
                          copy[idx] = { ...copy[idx], refundQuantity: qty, selectedForRefund: qty > 0 };
                          setNewItemsDraft(copy);
                        }}
                        className="w-14 bg-black/60 border border-white/15 rounded px-1.5 py-0.5 text-center font-mono text-white"
                      />
                      <span className="text-white/50">/ {it.orderedQuantity}</span>
                    </div>
                  </div>
                ))}
                <input
                  type="number"
                  placeholder="Ou saisir montant personnalisé autorisé (FCFA)…"
                  value={newCustomAmount}
                  onChange={(e) => setNewCustomAmount(e.target.value)}
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
                />
              </div>
            )}

            <textarea
              rows={2}
              required
              placeholder="Justification détaillée du remboursement (min. 4 caractères)…"
              value={newReasonDetail}
              onChange={(e) => setNewReasonDetail(e.target.value)}
              className="w-full bg-black/60 border border-white/15 rounded-xl p-2.5 text-xs text-white"
            />
            <input
              type="text"
              placeholder="Titre justificatif initial (optionnel)"
              value={newEvidenceTitle}
              onChange={(e) => setNewEvidenceTitle(e.target.value)}
              className="w-full bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
            />

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setCreateRefundOpen(false)} className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold text-white">
                Annuler
              </button>
              <button
                type="submit"
                disabled={busyAction !== null}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white cursor-pointer"
              >
                Créer dossier remboursement
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL : NOUVELLE INDEMNISATION                                        */}
      {/* ===================================================================== */}
      {createCompOpen && (
        <div className="fixed inset-0 z-[85] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusyAction('create-comp');
              try {
                const res = await refundsService.createCompensation({
                  beneficiaryRole: compRole,
                  beneficiaryName: compBeneficiaryName.trim(),
                  beneficiaryPhone: compBeneficiaryPhone.trim() || undefined,
                  orderNumber: compOrderNumber.trim() || undefined,
                  reason: compReason,
                  fundingSource: compFundingSource,
                  requestedAmountFcfa: Number(compAmount),
                  targetChannel: compChannel,
                  incidentDescription: compDescription.trim()
                });
                setCreateCompOpen(false);
                setCompBeneficiaryName('');
                setCompAmount('');
                setCompDescription('');
                showToast(`Indemnisation ${res.compensation.code} créée.`);
                setSection('compensations');
                await loadOverview();
                setSelectedCompId(res.compensation.id);
              } catch (err: unknown) {
                showToast((err as Error).message);
              } finally {
                setBusyAction(null);
              }
            }}
            className="w-full max-w-lg rounded-2xl bg-[#141414] border border-amber-500/35 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-amber-300">Nouvelle indemnisation acteur DJASSA</h3>
              <button type="button" onClick={() => setCreateCompOpen(false)} className="text-white/50 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={compRole}
                onChange={(e) => setCompRole(e.target.value as CompensationBeneficiaryRole)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                <option value="client">Client</option>
                <option value="seller">Vendeur</option>
              </select>
              <input
                type="text"
                required
                placeholder="Nom bénéficiaire"
                value={compBeneficiaryName}
                onChange={(e) => setCompBeneficiaryName(e.target.value)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Compte / Téléphone bénéficiaire"
                value={compBeneficiaryPhone}
                onChange={(e) => setCompBeneficiaryPhone(e.target.value)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              />
              <input
                type="text"
                placeholder="Commande associée (optionnel)"
                value={compOrderNumber}
                onChange={(e) => setCompOrderNumber(e.target.value)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={compReason}
                onChange={(e) => setCompReason(e.target.value as CompensationReasonKey)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                {(Object.keys(COMP_REASON_LABELS) as CompensationReasonKey[]).map((k) => (
                  <option key={k} value={k}>
                    {COMP_REASON_LABELS[k]}
                  </option>
                ))}
              </select>
              <select
                value={compFundingSource}
                onChange={(e) => setCompFundingSource(e.target.value as CompensationFundingSource)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                {(Object.keys(FUNDING_SOURCE_LABELS) as CompensationFundingSource[])
                  .filter((k) => k !== 'imputation_livreur' && k !== 'imputation_entreprise')
                  .map((k) => (
                  <option key={k} value={k}>
                    {FUNDING_SOURCE_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                required
                placeholder="Montant demandé (FCFA)"
                value={compAmount}
                onChange={(e) => setCompAmount(e.target.value)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs font-mono text-white"
              />
              <select
                value={compChannel}
                onChange={(e) => setCompChannel(e.target.value as PaymentProviderChannelId)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                {overview.providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              rows={3}
              required
              placeholder="Description précise de l’incident et du préjudice (min. 5 caractères)…"
              value={compDescription}
              onChange={(e) => setCompDescription(e.target.value)}
              className="w-full bg-black/60 border border-white/15 rounded-xl p-2.5 text-xs text-white"
            />

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCreateCompOpen(false)} className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold text-white">
                Annuler
              </button>
              <button
                type="submit"
                disabled={busyAction !== null}
                className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white cursor-pointer"
              >
                Créer indemnisation
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reason Modal when triggered from compensation detail */}
      {reasonModal && (
        <div className="fixed inset-0 z-[88] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#141414] border border-white/15 p-4 space-y-3">
            <h3 className="text-sm font-black text-white">{reasonModal.title}</h3>
            <textarea
              rows={3}
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder={reasonModal.placeholder}
              className="w-full bg-black/60 border border-white/15 rounded-xl p-2.5 text-xs text-white"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReasonModal(null)} className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold text-white">
                Fermer
              </button>
              <button
                type="button"
                disabled={reasonText.trim().length < 5}
                onClick={() => {
                  const rm = reasonModal;
                  const txt = reasonText.trim();
                  setReasonModal(null);
                  void runWithMfaIfNeeded('comp-reject', 'MFA — Refus indemnisation', 'Confirmer le refus motivé.', async (code) => {
                    await refundsService.runCompensationAction(rm.targetId, { action: 'reject', reason: txt }, code);
                    showToast('Indemnisation refusée avec motif enregistré.');
                  });
                }}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-xs font-bold text-white disabled:opacity-40 cursor-pointer"
              >
                Confirmer refus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global MFA Prompt */}
      {mfaPrompt && (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#141414] border border-emerald-500/40 p-4 space-y-3">
            <h3 className="text-sm font-black text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{mfaPrompt.title}</span>
            </h3>
            <p className="text-xs text-white/70">{mfaPrompt.description}</p>
            {mfaPrompt.previewCode && (
              <p className="text-[11px] font-mono bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-2.5 py-1.5 text-emerald-300">
                Code MFA : {mfaPrompt.previewCode}
              </p>
            )}
            <input
              type="text"
              value={mfaInput}
              onChange={(e) => setMfaInput(e.target.value)}
              placeholder="Saisir le code MFA"
              className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs font-mono text-white"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setMfaPrompt(null)} className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold text-white">
                Annuler
              </button>
              <button
                type="button"
                onClick={async () => {
                  const p = mfaPrompt;
                  setMfaPrompt(null);
                  try {
                    await p.pendingRunner(mfaInput.trim());
                  } catch (e: unknown) {
                    showToast((e as Error).message);
                  }
                }}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white cursor-pointer"
              >
                Valider MFA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
