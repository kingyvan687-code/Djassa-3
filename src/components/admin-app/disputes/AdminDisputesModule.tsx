import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Award,
  BadgeAlert,
  Bell,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  Gavel,
  History,
  Image as ImageIcon,
  Lock,
  MessageSquare,
  Package,
  Paperclip,
  Plus,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Truck,
  User,
  UserCheck,
  UserPlus,
  Wallet,
  X,
  XCircle
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { AdminUserRecord, Order } from '../../../types';
import { formatFCFA } from '../../../services/marketServices';
import { securityService } from '../../../services/securityService';
import { disputesService, type DisputeApiError } from '../../../services/disputesService';
import { AdminUserDetailModal } from '../modals/AdminUserDetailModal';
import { AdminOrderDetailModal } from '../modals/AdminOrderDetailModal';
import type {
  DisputeActorProfile,
  DisputeActorRoleType,
  DisputeCategoryKey,
  DisputeEvidenceKind,
  DisputeModuleSettings,
  DisputeOverviewResponse,
  DisputePermissionKey,
  DisputePriority,
  DisputeRecord,
  DisputeStatus,
  DisputeWorkspaceSection
} from '../../../types/disputes';

const SECTION_TABS: { id: DisputeWorkspaceSection; label: string }[] = [
  { id: 'dashboard', label: 'Tableau de bord' },
  { id: 'all', label: 'Toutes' },
  { id: 'urgent', label: 'Litiges urgents' },
  { id: 'pending', label: 'En attente' },
  { id: 'investigating', label: 'Investigation' },
  { id: 'awaiting_evidence', label: 'Justificatifs' },
  { id: 'mediation', label: 'Médiation' },
  { id: 'refunds', label: 'Remboursements' },
  { id: 'resolved', label: 'Résolues' },
  { id: 'archives', label: 'Archives' },
  { id: 'settings', label: 'Paramètres' }
];

const STATUS_META: Record<DisputeStatus, { label: string; cls: string }> = {
  nouvelle: { label: 'Nouvelle réclamation', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/35' },
  en_attente_traitement: { label: 'En attente de traitement', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/35' },
  en_cours_investigation: { label: 'En cours d’investigation', cls: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/35' },
  en_attente_justificatifs: { label: 'En attente de justificatifs', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/35' },
  en_mediation: { label: 'En médiation', cls: 'bg-purple-500/15 text-purple-300 border-purple-500/35' },
  resolue: { label: 'Résolue', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35' },
  rejetee: { label: 'Rejetée', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/35' },
  cloturee: { label: 'Clôturée', cls: 'bg-white/10 text-white/65 border-white/20' }
};

const PRIORITY_META: Record<DisputePriority, { label: string; cls: string; rank: number }> = {
  urgent: { label: 'Urgent', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/45', rank: 3 },
  normal: { label: 'Normal', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/35', rank: 2 },
  faible: { label: 'Faible', cls: 'bg-white/10 text-white/65 border-white/20', rank: 1 }
};

const EVIDENCE_KIND_LABELS: Record<DisputeEvidenceKind, string> = {
  photo: 'Photo',
  video: 'Vidéo',
  screenshot: 'Capture d’écran',
  conversation: 'Extrait discussion',
  payment_receipt: 'Reçu de paiement',
  invoice: 'Facture',
  client_signature: 'Signature client',
  seller_signature: 'Signature vendeur',
  delivery_handover_proof: 'Preuve remise colis',
  gps_trace: 'Trace GPS',
  document: 'Document complémentaire'
};

const PERMISSION_LABELS: Record<DisputePermissionKey, string> = {
  viewDisputes: 'Consulter dossiers',
  viewAssignedOnly: 'Limité aux dossiers assignés',
  triageAndAssign: 'Créer, prioriser & affecter',
  investigateAndMediate: 'Enquêter, échanger & médier',
  requestRefundOrRelease: 'Demander remboursement / blocage',
  approveFinancialDisputeOp: 'Valider op. financière (4 yeux)',
  applySanction: 'Appliquer sanctions',
  closeOrReopenDispute: 'Clôturer / Réouvrir',
  manageDisputeSettings: 'Paramètres module litiges',
  viewFullActorContacts: 'Voir contacts non masqués'
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

export const AdminDisputesModule: React.FC = () => {
  const { orders, adminUsers, sellers, messages, showToast } = useApp();

  const [section, setSection] = useState<DisputeWorkspaceSection>('dashboard');
  const [overview, setOverview] = useState<DisputeOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterDateRange, setFilterDateRange] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority_desc' | 'amount_desc'>('priority_desc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  // Selected Claim Detail
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'general' | 'actors' | 'order' | 'evidence' | 'timeline' | 'financial'>('general');

  // Inline Profile / Order Overlays (without leaving the claim!)
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

  // Create new claim modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newOrderId, setNewOrderId] = useState('');
  const [newOrderNumberManual, setNewOrderNumberManual] = useState('');
  const [newCategory, setNewCategory] = useState<DisputeCategoryKey>('commande_non_recue');
  const [newPriority, setNewPriority] = useState<DisputePriority>('urgent');
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newAmountFcfa, setNewAmountFcfa] = useState('');
  const [newDeclarantName, setNewDeclarantName] = useState('');
  const [newDeclarantRole, setNewDeclarantRole] = useState<DisputeActorRoleType>('client');
  const [newAccusedName, setNewAccusedName] = useState('');
  const [newAccusedRole, setNewAccusedRole] = useState<DisputeActorRoleType>('seller');

  // Detail interactive forms
  const [msgKind, setMsgKind] = useState<'admin_to_actor' | 'internal_note' | 'evidence_request' | 'actor_message'>('admin_to_actor');
  const [msgTargetRole, setMsgTargetRole] = useState<DisputeActorRoleType | 'all_actors'>('client');
  const [msgActorSourceRole, setMsgActorSourceRole] = useState<DisputeActorRoleType>('client');
  const [msgText, setMsgText] = useState('');
  const [msgSwitchAwaiting, setMsgSwitchAwaiting] = useState(true);

  const [evKind, setEvKind] = useState<DisputeEvidenceKind>('photo');
  const [evTitle, setEvTitle] = useState('');
  const [evDescription, setEvDescription] = useState('');
  const [evUrlOrData, setEvUrlOrData] = useState('');
  const [evSubmitterRole, setEvSubmitterRole] = useState<DisputeActorRoleType>('client');

  const [assignAgentTarget, setAssignAgentTarget] = useState('');
  const [mediationProposal, setMediationProposal] = useState('');
  const [mediationOutcomeNote, setMediationOutcomeNote] = useState('');

  // Confirmation modal for decisions / reject / close / reopen
  const [decisionModal, setDecisionModal] = useState<{
    mode: 'accept' | 'reject' | 'close' | 'reopen';
    title: string;
    requireReason: boolean;
    reasonLabel: string;
    targetStatus: DisputeStatus;
  } | null>(null);
  const [decisionReason, setDecisionReason] = useState('');

  // Financial operation inputs
  const [finBlockMode, setFinBlockMode] = useState<'internal_ledger' | 'wave' | 'orange_money'>('internal_ledger');
  const [finBlockAmount, setFinBlockAmount] = useState('');
  const [finRefundAmount, setFinRefundAmount] = useState('');
  const [finRefundChannel, setFinRefundChannel] = useState('internal_ledger');
  const [finRefundReason, setFinRefundReason] = useState('');
  const [finRefundConfirm, setFinRefundConfirm] = useState('');
  const [finReleaseConfirm, setFinReleaseConfirm] = useState('');
  const [extReceiptRef, setExtReceiptRef] = useState('');

  // Sanction modal
  const [sanctionOpen, setSanctionOpen] = useState(false);
  const [sanctionTargetRole, setSanctionTargetRole] = useState<DisputeActorRoleType>('seller');
  const [sanctionType, setSanctionType] = useState<'avertissement' | 'blocage_retraits' | 'restriction_commandes' | 'suspension_temporaire' | 'suspension_permanente'>('avertissement');
  const [sanctionDuration, setSanctionDuration] = useState(7);
  const [sanctionReason, setSanctionReason] = useState('');
  const [sanctionConfirm, setSanctionConfirm] = useState('');

  // Settings draft
  const [settingsDraft, setSettingsDraft] = useState<DisputeModuleSettings | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      setErrorBanner(null);
      const data = await disputesService.getOverview();
      setOverview(data);
      setSettingsDraft(data.settings);
    } catch (err: unknown) {
      setErrorBanner((err as Error).message || 'Impossible de charger le module Réclamations & litiges.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const runWithMfaIfNeeded = async (
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
      const apiErr = err as DisputeApiError;
      if (apiErr.requiresMfa) {
        try {
          const ch = await securityService.requestMfaChallenge();
          setMfaInput(ch.verificationCodePreview || '');
          setMfaPrompt({
            title,
            description,
            previewCode: ch.verificationCodePreview,
            pendingRunner: async (code: string) => {
              await fn(code);
              await loadOverview();
            }
          });
        } catch (mfaErr: unknown) {
          showToast((mfaErr as Error).message || 'Impossible de générer le code MFA.');
        }
      } else {
        showToast(apiErr.message || 'Opération impossible.');
      }
    } finally {
      setBusyAction(null);
    }
  };

  const selectedDispute: DisputeRecord | null = useMemo(() => {
    if (!overview || !selectedDisputeId) return null;
    return overview.disputes.find((d) => d.id === selectedDisputeId) || null;
  }, [overview, selectedDisputeId]);

  const categoryLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    (overview?.settings.categories || []).forEach((c) => {
      map[c.key] = c.label;
    });
    return map;
  }, [overview]);

  const filteredDisputes = useMemo(() => {
    if (!overview) return [];
    const now = Date.now();
    const list = overview.disputes.filter((d) => {
      if (section === 'urgent' && (d.priority !== 'urgent' || d.status === 'cloturee' || d.status === 'resolue' || d.status === 'rejetee')) return false;
      if (section === 'pending' && d.status !== 'nouvelle' && d.status !== 'en_attente_traitement') return false;
      if (section === 'investigating' && d.status !== 'en_cours_investigation') return false;
      if (section === 'awaiting_evidence' && d.status !== 'en_attente_justificatifs') return false;
      if (section === 'mediation' && d.status !== 'en_mediation') return false;
      if (
        section === 'refunds' &&
        d.financial.refundStatus === 'aucun' &&
        d.financial.blockedAmountFcfa <= 0 &&
        d.financial.refundedAmountFcfa <= 0
      ) {
        return false;
      }
      if (section === 'resolved' && d.status !== 'resolue') return false;
      if (section === 'archives' && d.status !== 'cloturee' && d.status !== 'rejetee' && !d.archived) return false;

      if (filterCategory !== 'all' && d.category !== filterCategory) return false;
      if (filterStatus !== 'all' && d.status !== filterStatus) return false;
      if (filterPriority !== 'all' && d.priority !== filterPriority) return false;

      if (filterDateRange !== 'all') {
        const createdMs = new Date(d.createdAt).getTime();
        const maxAge =
          filterDateRange === 'today' ? 86_400_000 : filterDateRange === '7d' ? 7 * 86_400_000 : 30 * 86_400_000;
        if (now - createdMs > maxAge) return false;
      }

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hit =
          d.code.toLowerCase().includes(q) ||
          d.subject.toLowerCase().includes(q) ||
          d.orderNumber.toLowerCase().includes(q) ||
          d.declarant.name.toLowerCase().includes(q) ||
          d.accusedActor.name.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'priority_desc') {
        const diff = PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank;
        if (diff !== 0) return diff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'amount_desc') return b.amountFcfa - a.amountFcfa;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return list;
  }, [overview, section, filterCategory, filterStatus, filterPriority, filterDateRange, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredDisputes.length / PAGE_SIZE));
  const pagedDisputes = useMemo(
    () => filteredDisputes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredDisputes, page]
  );

  useEffect(() => {
    setPage(1);
  }, [section, filterCategory, filterStatus, filterPriority, filterDateRange, search, sortBy]);

  const handleSyncRealOrders = async () => {
    setBusyAction('sync');
    try {
      const flattenedMessages = Object.entries(messages || {}).flatMap(([conversationId, list]) =>
        Array.isArray(list) ? list.map((m) => ({ ...m, conversationId })) : []
      );
      const res = await disputesService.syncFromOrders({
        orders,
        messages: flattenedMessages,
        sellers
      });
      await loadOverview();
      if (res.importedCount > 0) {
        showToast(`${res.importedCount} dossier(s) réel(s) synchronisé(s) depuis les commandes et échanges.`);
      } else {
        showToast('Synchronisation vérifiée : aucun nouvel incident de commande à importer.');
      }
    } catch (err: unknown) {
      showToast((err as Error).message || 'Erreur lors de la synchronisation.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleOpenActorProfileModal = (actor: DisputeActorProfile) => {
    const matchedAdminUser = adminUsers.find(
      (u) =>
        u.id === actor.accountId ||
        u.name.toLowerCase() === actor.name.toLowerCase() ||
        (actor.emailFull && u.email?.toLowerCase() === actor.emailFull.toLowerCase())
    );
    if (matchedAdminUser) {
      setInspectedUser(matchedAdminUser);
      return;
    }
    const roleMap: AdminUserRecord['role'] =
      actor.roleType === 'seller'
        ? 'seller'
        : actor.roleType === 'admin'
        ? 'admin'
        : 'client';
    setInspectedUser({
      id: actor.accountId,
      name: actor.name,
      email: actor.emailFull || actor.emailMasked || 'Non renseigné',
      phone: actor.phoneFull || actor.phoneMasked || 'Masqué / non renseigné',
      role: roleMap,
      status: actor.accountStatus === 'suspended' ? 'suspended' : actor.accountStatus === 'pending_verification' ? 'pending_verification' : 'active',
      avatar: actor.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&q=80',
      createdAt: 'Compte lié au dossier',
      location: actor.commune || 'Abidjan',
      ordersCount: 1,
      totalSpentOrEarned: selectedDispute?.amountFcfa || 0,
      kycVerified: actor.accountStatus === 'active',
      storeName: actor.roleType === 'seller' ? actor.name : undefined
    });
  };

  const handleOpenOrderModal = (dispute: DisputeRecord) => {
    const found = orders.find((o) => o.id === dispute.orderId || o.orderNumber === dispute.orderNumber);
    if (found) {
      setInspectedOrder(found);
      return;
    }
    const snap = dispute.orderSnapshot;
    setInspectedOrder({
      id: snap.orderId || dispute.orderNumber,
      orderNumber: snap.orderNumber,
      items: snap.items.map((it) => ({
        productId: it.productId,
        productTitle: it.productTitle,
        productImage: it.productImage || '',
        price: it.unitPriceFcfa,
        quantity: it.quantity,
        sellerId: it.sellerId || 'seller',
        sellerName: it.sellerName || dispute.actors.seller?.name || 'Boutique'
      })),
      subtotal: snap.subtotalFcfa,
      deliveryFee: snap.deliveryFeeFcfa,
      discount: snap.discountFcfa,
      total: snap.totalFcfa,
      paymentMethod: (['wave', 'orange_money', 'mtn_momo', 'card'].includes(snap.paymentMethod) ? snap.paymentMethod : 'wave') as Order['paymentMethod'],
      paymentStatus: snap.paymentStatus === 'paid' ? 'paid' : 'pending',
      status: 'in_delivery',
      createdAt: snap.createdAt || dispute.createdAt,
      estimatedDelivery: dispute.slaDeadlineAt,
      deliveryAddress: {
        commune: snap.gpsInfo?.commune || 'Abidjan',
        quartier: snap.gpsInfo?.quartier || '',
        details: snap.gpsInfo?.details || '',
        recipientName: dispute.actors.client?.name || dispute.declarant.name,
        phone: dispute.actors.client?.phoneFull || dispute.actors.client?.phoneMasked || ''
      },
      trackingEvents: snap.trackingHistory.map((t) => ({
        status: 'in_delivery',
        label: t.label,
        time: t.time,
        done: true,
        description: t.description || ''
      }))
    });
  };

  const handleCreateClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busyAction) return; // double-submit guard
    setBusyAction('create_claim');
    try {
      const linkedOrder = orders.find((o) => o.id === newOrderId);
      const sellerId = linkedOrder?.items?.[0]?.sellerId;
      const linkedSeller = sellers.find((s) => s.id === sellerId);

      const clientProfile = linkedOrder
        ? {
            roleType: 'client' as const,
            accountId: `cli-${linkedOrder.deliveryAddress.phone || linkedOrder.orderNumber}`,
            name: linkedOrder.deliveryAddress.recipientName,
            avatar: linkedOrder.clientAvatar,
            phoneFull: linkedOrder.deliveryAddress.phone,
            commune: linkedOrder.deliveryAddress.commune
          }
        : undefined;

      const sellerProfile = linkedSeller
        ? {
            roleType: 'seller' as const,
            accountId: linkedSeller.id,
            name: linkedSeller.storeName || linkedSeller.name,
            avatar: linkedSeller.avatar,
            phoneFull: linkedSeller.phone,
            emailFull: linkedSeller.email,
            commune: linkedSeller.location
          }
        : linkedOrder?.items?.[0]?.sellerName
        ? {
            roleType: 'seller' as const,
            accountId: sellerId || 'seller-order',
            name: linkedOrder.items[0].sellerName
          }
        : undefined;

      const declarantObj =
        newDeclarantRole === 'seller' && sellerProfile
          ? sellerProfile
          : newDeclarantRole === 'client' && clientProfile
          ? clientProfile
          : {
              roleType: newDeclarantRole,
              accountId: `${newDeclarantRole}-${Date.now().toString(36)}`,
              name: newDeclarantName.trim() || clientProfile?.name || 'Déclarant'
            };

      const accusedObj =
        newAccusedRole === 'seller' && sellerProfile
          ? sellerProfile
          : newAccusedRole === 'client' && clientProfile
          ? clientProfile
          : {
              roleType: newAccusedRole,
              accountId: `${newAccusedRole}-${Date.now().toString(36)}`,
              name: newAccusedName.trim() || sellerProfile?.name || 'Acteur mis en cause'
            };

      const idem = `claim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const res = await disputesService.createDispute(
        {
          category: newCategory,
          subject: newSubject.trim(),
          description: newDescription.trim(),
          orderNumber: linkedOrder?.orderNumber || newOrderNumberManual.trim() || 'SANS-CMD',
          order: linkedOrder,
          declarant: declarantObj,
          accusedActor: accusedObj,
          actors: {
            client: clientProfile || (newDeclarantRole === 'client' ? declarantObj : undefined),
            seller: sellerProfile || (newAccusedRole === 'seller' ? accusedObj : undefined)
          },
          amountFcfa: Number(newAmountFcfa || linkedOrder?.total || 0),
          priority: newPriority
        },
        idem
      );
      showToast(`Réclamation ${res.dispute.code} créée et enregistrée.`);
      setCreateOpen(false);
      setNewSubject('');
      setNewDescription('');
      setNewOrderId('');
      setNewOrderNumberManual('');
      setNewAmountFcfa('');
      setSelectedDisputeId(res.dispute.id);
      await loadOverview();
    } catch (err: unknown) {
      showToast((err as Error).message || 'Erreur création réclamation.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleFileEvidenceSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      showToast('Fichier trop volumineux (max 4 Mo).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEvUrlOrData(reader.result);
        if (!evTitle) setEvTitle(file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadEvidence = async () => {
    if (!selectedDispute || !evTitle.trim()) return;
    setBusyAction('add_evidence');
    try {
      await disputesService.addEvidence(selectedDispute.id, {
        kind: evKind,
        title: evTitle.trim(),
        description: evDescription.trim(),
        urlOrData: evUrlOrData.trim(),
        submittedByRole: evSubmitterRole
      });
      setEvTitle('');
      setEvDescription('');
      setEvUrlOrData('');
      showToast('Justificatif original horodaté et protégé (SHA-256).');
      await loadOverview();
    } catch (err: unknown) {
      showToast((err as Error).message || 'Impossible d’ajouter la preuve.');
    } finally {
      setBusyAction(null);
    }
  };

  if (loading && !overview) {
    return (
      <div className="p-6 rounded-2xl bg-[#111111] border border-white/10 text-center space-y-2">
        <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin mx-auto" />
        <p className="text-xs text-white/60">Chargement du centre Réclamations & litiges…</p>
      </div>
    );
  }

  if (errorBanner && !overview) {
    return (
      <div className="p-5 rounded-2xl bg-rose-950/30 border border-rose-500/30 space-y-2">
        <p className="text-xs font-bold text-rose-300 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          <span>{errorBanner}</span>
        </p>
        <button
          type="button"
          onClick={() => void loadOverview()}
          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white cursor-pointer"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!overview) return null;

  const { kpis, actor, providerCapabilities, approvalRequests, notifications, staffPermissions, auditTrail } = overview;
  const perms = actor.permissions;
  const unreadNotifs = notifications.filter((n) => !n.readByActorIds.includes(actor.staffId));
  const pendingDualReqs = approvalRequests.filter((r) => r.status === 'en_attente_double_validation');

  // ============================================================================
  // RENDER CLAIM DETAIL VIEW
  // ============================================================================
  if (selectedDispute) {
    const isOverdue =
      selectedDispute.status !== 'resolue' &&
      selectedDispute.status !== 'rejetee' &&
      selectedDispute.status !== 'cloturee' &&
      new Date(selectedDispute.slaDeadlineAt).getTime() < Date.now();
    const isClosed = selectedDispute.status === 'cloturee';

    return (
      <div id="admin-dispute-detail-view" className="space-y-3 pb-10">
        {/* Top bar */}
        <div className="p-3 rounded-2xl bg-[#141414] border border-white/10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setSelectedDisputeId(null)}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Retour</span>
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-mono font-black text-emerald-400">{selectedDispute.code}</span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${PRIORITY_META[selectedDispute.priority].cls}`}>
                  {PRIORITY_META[selectedDispute.priority].label}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${STATUS_META[selectedDispute.status].cls}`}>
                  {STATUS_META[selectedDispute.status].label}
                </span>
                {isOverdue && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>SLA dépassé</span>
                  </span>
                )}
              </div>
              <h2 className="text-xs sm:text-sm font-black text-white truncate mt-0.5">{selectedDispute.subject}</h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {perms.investigateAndMediate && selectedDispute.assignedAgentId !== actor.staffId && !isClosed && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={async () => {
                  setBusyAction('take_charge');
                  try {
                    await disputesService.takeCharge(selectedDispute.id);
                    showToast('Dossier pris en charge.');
                    await loadOverview();
                  } catch (e: unknown) {
                    showToast((e as Error).message);
                  } finally {
                    setBusyAction(null);
                  }
                }}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Prendre en charge</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void loadOverview()}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 cursor-pointer"
              title="Actualiser"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Abuse / Fraud Alerts Banner */}
        {selectedDispute.abuseIndicators.length > 0 && (
          <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-500/35 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-black text-amber-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Signaux d’abus & fraude détectés ({selectedDispute.abuseIndicators.length})</span>
              </span>
              <span className="text-[10px] text-amber-200/80 font-semibold">
                Indice automatique uniquement — aucune sanction définitive automatique appliquée.
              </span>
            </div>
            <div className="space-y-1.5">
              {selectedDispute.abuseIndicators.map((ind) => (
                <div key={ind.id} className="p-2 rounded-xl bg-black/40 border border-amber-500/20 text-[11px]">
                  <span className="font-bold text-amber-300">{ind.label} : </span>
                  <span className="text-white/80">{ind.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Treatment Action Bar */}
        {perms.investigateAndMediate && (
          <div className="p-3 rounded-2xl bg-[#111111] border border-white/10 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Assign Agent */}
              {perms.triageAndAssign && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={assignAgentTarget || selectedDispute.assignedAgentId || ''}
                    onChange={(e) => setAssignAgentTarget(e.target.value)}
                    className="flex-1 bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] text-white"
                  >
                    <option value="">Affecter à un agent…</option>
                    {staffPermissions
                      .filter((s) => s.active)
                      .map((s) => (
                        <option key={s.staffId} value={s.staffId}>
                          {s.name} ({s.role})
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    disabled={!assignAgentTarget || busyAction !== null}
                    onClick={async () => {
                      setBusyAction('assign');
                      try {
                        await disputesService.assignToAgent(selectedDispute.id, assignAgentTarget);
                        showToast('Agent affecté au dossier.');
                        await loadOverview();
                      } catch (e: unknown) {
                        showToast((e as Error).message);
                      } finally {
                        setBusyAction(null);
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] font-bold text-white disabled:opacity-40 cursor-pointer"
                  >
                    Affecter
                  </button>
                </div>
              )}

              {/* Priority switch */}
              {perms.triageAndAssign && (
                <div className="flex items-center gap-1">
                  {(['faible', 'normal', 'urgent'] as DisputePriority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={busyAction !== null || selectedDispute.priority === p}
                      onClick={async () => {
                        setBusyAction('prio');
                        try {
                          await disputesService.updatePriority(selectedDispute.id, p);
                          showToast(`Priorité passée à ${PRIORITY_META[p].label}.`);
                          await loadOverview();
                        } catch (e: unknown) {
                          showToast((e as Error).message);
                        } finally {
                          setBusyAction(null);
                        }
                      }}
                      className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold border transition cursor-pointer ${
                        selectedDispute.priority === p
                          ? PRIORITY_META[p].cls
                          : 'bg-black/40 border-white/10 text-white/55 hover:text-white'
                      }`}
                    >
                      {PRIORITY_META[p].label}
                    </button>
                  ))}
                </div>
              )}

              {/* Workflow transitions */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {!isClosed && selectedDispute.status !== 'en_cours_investigation' && (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={async () => {
                      setBusyAction('inv');
                      try {
                        await disputesService.updateStatus(selectedDispute.id, {
                          status: 'en_cours_investigation',
                          reason: 'Ouverture d’investigation administrative'
                        });
                        showToast('Investigation démarrée.');
                        await loadOverview();
                      } catch (e: unknown) {
                        showToast((e as Error).message);
                      } finally {
                        setBusyAction(null);
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/35 text-indigo-300 text-[10px] font-bold cursor-pointer"
                  >
                    Investigation
                  </button>
                )}
                {!isClosed && selectedDispute.status !== 'en_mediation' && (
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={async () => {
                      setBusyAction('med');
                      try {
                        await disputesService.runMediation(selectedDispute.id, {
                          action: 'start',
                          proposedSettlement: mediationProposal || 'Ouverture de médiation amiable DJASSA'
                        });
                        showToast('Médiation démarrée.');
                        await loadOverview();
                      } catch (e: unknown) {
                        showToast((e as Error).message);
                      } finally {
                        setBusyAction(null);
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/35 text-purple-300 text-[10px] font-bold cursor-pointer"
                  >
                    Médiation
                  </button>
                )}
              </div>
            </div>

            {/* Critical Decisions Row */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-white/5">
              {!isClosed && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setDecisionReason('');
                      setDecisionModal({
                        mode: 'accept',
                        title: 'Accepter & Résoudre la réclamation',
                        requireReason: false,
                        reasonLabel: 'Motif / décision administrative',
                        targetStatus: 'resolue'
                      });
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Accepter</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDecisionReason('');
                      setDecisionModal({
                        mode: 'reject',
                        title: 'Rejeter la réclamation (justification obligatoire)',
                        requireReason: true,
                        reasonLabel: 'Justification détaillée du rejet (min. 5 caractères)',
                        targetStatus: 'rejetee'
                      });
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Rejeter</span>
                  </button>
                </>
              )}

              {perms.applySanction && (
                <button
                  type="button"
                  onClick={() => setSanctionOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Gavel className="w-3.5 h-3.5" />
                  <span>Sanctionner</span>
                </button>
              )}

              {perms.closeOrReopenDispute && !isClosed && (
                <button
                  type="button"
                  onClick={() => {
                    setDecisionReason('');
                    setDecisionModal({
                      mode: 'close',
                      title: 'Clôturer définitivement le dossier',
                      requireReason: false,
                      reasonLabel: 'Note de clôture',
                      targetStatus: 'cloturee'
                    });
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Clôturer</span>
                </button>
              )}

              {perms.closeOrReopenDispute && isClosed && (
                <button
                  type="button"
                  onClick={() => {
                    setDecisionReason('');
                    setDecisionModal({
                      mode: 'reopen',
                      title: 'Réouvrir le dossier clôturé',
                      requireReason: true,
                      reasonLabel: 'Motif de réouverture (élément nouveau, preuve reçue...)',
                      targetStatus: 'en_cours_investigation'
                    });
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Réouvrir</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Detail Sub-Tabs (A..E + Finance) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'general', label: 'A. Général', icon: FileText },
            { id: 'actors', label: 'B. Acteurs', icon: User },
            { id: 'order', label: 'C. Commande', icon: Package },
            { id: 'evidence', label: `D. Preuves (${selectedDispute.evidence.length})`, icon: Paperclip },
            { id: 'timeline', label: `E. Échanges (${selectedDispute.timeline.length})`, icon: MessageSquare },
            { id: 'financial', label: 'Finances & Remb.', icon: Wallet }
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

        {/* SECTION A: INFORMATIONS GÉNÉRALES */}
        {detailTab === 'general' && (
          <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-3 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-white/45 block">N° Dossier</span>
                <span className="font-mono font-bold text-emerald-300">{selectedDispute.code}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-white/45 block">Ouverture</span>
                <span className="font-semibold text-white">{fmtDateTime(selectedDispute.createdAt)}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-white/45 block">Date limite SLA</span>
                <span className={`font-semibold ${isOverdue ? 'text-rose-400' : 'text-white'}`}>
                  {fmtDateTime(selectedDispute.slaDeadlineAt)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-white/45 block">Agent responsable</span>
                <span className="font-semibold text-white">{selectedDispute.assignedAgentName || 'Non affecté'}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5">
              <span className="text-[10px] text-white/50 uppercase font-bold block">
                Catégorie : {categoryLabelMap[selectedDispute.category] || selectedDispute.category}
              </span>
              <p className="text-sm font-black text-white">{selectedDispute.subject}</p>
              <p className="text-xs text-white/80 leading-relaxed">{selectedDispute.description}</p>
            </div>

            {selectedDispute.decisionSummary && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200">
                <span className="font-black block text-[10px] uppercase mb-0.5">Décision enregistrée</span>
                {selectedDispute.decisionSummary}
              </div>
            )}

            {/* Mediation panel when active */}
            {selectedDispute.mediation.active && (
              <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/35 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                    <Scale className="w-4 h-4" />
                    <span>Médiation en cours (Modérateur : {selectedDispute.mediation.moderatorName})</span>
                  </span>
                  <span className="text-[10px] text-purple-200/70">Échéance : {fmtDateTime(selectedDispute.mediation.deadlineAt)}</span>
                </div>
                <input
                  type="text"
                  placeholder="Proposition de règlement amiable..."
                  value={mediationProposal || selectedDispute.mediation.proposedSettlement || ''}
                  onChange={(e) => setMediationProposal(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
                />
                <input
                  type="text"
                  placeholder="Conclusion / note d’issue..."
                  value={mediationOutcomeNote}
                  onChange={(e) => setMediationOutcomeNote(e.target.value)}
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={async () => {
                      await disputesService.runMediation(selectedDispute.id, {
                        action: 'update',
                        proposedSettlement: mediationProposal,
                        outcome: 'accord_trouve',
                        outcomeNote: mediationOutcomeNote || 'Accord amiable accepté par les parties',
                        clientAccepted: true,
                        sellerAccepted: true
                      });
                      showToast('Accord de médiation validé.');
                      await loadOverview();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
                  >
                    Valider accord amiable
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await disputesService.runMediation(selectedDispute.id, {
                        action: 'update',
                        outcome: 'echec_arbitrage_admin',
                        outcomeNote: mediationOutcomeNote || 'Échec de conciliation → arbitrage administratif'
                      });
                      showToast('Médiation clôturée sans accord.');
                      await loadOverview();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-600/80 hover:bg-amber-500 text-white text-[11px] font-bold cursor-pointer"
                  >
                    Clore sans accord → Arbitrage
                  </button>
                </div>
              </div>
            )}

            {selectedDispute.sanctions.length > 0 && (
              <div className="p-3 rounded-xl bg-rose-950/25 border border-rose-500/30 space-y-1.5">
                <span className="text-[10px] font-black text-rose-300 uppercase">Sanctions appliquées ({selectedDispute.sanctions.length})</span>
                {selectedDispute.sanctions.map((s) => (
                  <div key={s.id} className="text-[11px] text-white/80 flex items-center justify-between bg-black/30 p-2 rounded-lg">
                    <span>
                      <strong>{s.targetName}</strong> ({s.sanctionType}) — {s.reason}
                    </span>
                    <span className="text-[10px] text-white/45">{fmtDateTime(s.appliedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION B: ACTEURS CONCERNÉS */}
        {detailTab === 'actors' && (
          <div className="space-y-2.5">
            {[
              { title: 'Client', actor: selectedDispute.actors.client || (selectedDispute.declarant.roleType === 'client' ? selectedDispute.declarant : undefined), accent: 'text-sky-300 border-sky-500/25' },
              { title: 'Vendeur / Boutique', actor: selectedDispute.actors.seller || (selectedDispute.accusedActor.roleType === 'seller' ? selectedDispute.accusedActor : undefined), accent: 'text-amber-300 border-amber-500/25' },
              { title: 'Livreur', actor: selectedDispute.actors.driver || (selectedDispute.accusedActor.roleType === 'driver' ? selectedDispute.accusedActor : undefined), accent: 'text-emerald-300 border-emerald-500/25' },
              { title: 'Entreprise de livraison', actor: selectedDispute.actors.company, accent: 'text-purple-300 border-purple-500/25' }
            ]
              .filter((row) => Boolean(row.actor))
              .map((row, idx) => {
                const a = row.actor!;
                return (
                  <div key={idx} className={`p-3 rounded-2xl bg-[#141414] border ${row.accent} flex items-center justify-between gap-3`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={a.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&q=80'}
                        alt={a.name}
                        className="w-11 h-11 rounded-xl object-cover border border-white/15 shrink-0"
                      />
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black uppercase text-white/50">{row.title}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${a.accountStatus === 'suspended' ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                            {a.accountStatus === 'suspended' ? 'Suspendu' : 'Actif'}
                          </span>
                        </div>
                        <p className="text-xs font-black text-white truncate">{a.name}</p>
                        <p className="text-[10px] font-mono text-white/55 truncate">
                          ID : {a.accountId} • {a.phoneFull || a.phoneMasked || 'Tél. non renseigné'}
                        </p>
                        <p className="text-[10px] text-white/45">
                          Antécédents litiges : {a.pastDisputesCount} {a.vehicleInfo ? `• ${a.vehicleInfo}` : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenActorProfileModal(a)}
                      className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-[11px] font-bold shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Profil</span>
                    </button>
                  </div>
                );
              })}

            {/* Assigned Agent Card */}
            <div className="p-3 rounded-2xl bg-[#141414] border border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-white/45 block">Agent administratif chargé du dossier</span>
                  <p className="text-xs font-bold text-white">{selectedDispute.assignedAgentName || 'Aucun agent assigné'}</p>
                </div>
              </div>
              {selectedDispute.assignedAgentId && (
                <span className="text-[10px] font-mono text-white/45">{selectedDispute.assignedAgentId}</span>
              )}
            </div>
          </div>
        )}

        {/* SECTION C: INFORMATIONS DE LA COMMANDE */}
        {detailTab === 'order' && (
          <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-3 text-xs">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <span className="text-[10px] text-white/45 block">Commande associée</span>
                <span className="text-sm font-black font-mono text-white">#{selectedDispute.orderSnapshot.orderNumber}</span>
              </div>
              <button
                type="button"
                onClick={() => handleOpenOrderModal(selectedDispute)}
                className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/35 text-purple-300 text-[11px] font-bold cursor-pointer"
              >
                Ouvrir fiche commande
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-white/45 block">Paiement</span>
                <span className="font-bold text-white uppercase">{selectedDispute.orderSnapshot.paymentMethod}</span>
                <span className="text-[10px] text-white/55 block">Statut : {selectedDispute.orderSnapshot.paymentStatus}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-white/45 block">Préparation / Livraison</span>
                <span className="font-bold text-white">{selectedDispute.orderSnapshot.preparationStatus}</span>
                <span className="text-[10px] text-white/55 block">Livraison : {selectedDispute.orderSnapshot.deliveryStatus}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-white/45 block">Frais & Total</span>
                <span className="font-bold text-emerald-400 font-mono">{formatFCFA(selectedDispute.orderSnapshot.totalFcfa)}</span>
                <span className="text-[10px] text-white/55 block">Livraison : {formatFCFA(selectedDispute.orderSnapshot.deliveryFeeFcfa)}</span>
              </div>
            </div>

            {selectedDispute.orderSnapshot.transactionRef && (
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 text-[11px] font-mono text-white/80">
                Référence transaction : {selectedDispute.orderSnapshot.transactionRef}
              </div>
            )}

            {/* Products list */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase text-white/45 block">Produits ({selectedDispute.orderSnapshot.items.length})</span>
              {selectedDispute.orderSnapshot.items.length === 0 ? (
                <p className="text-[11px] text-white/50 p-2 rounded-xl bg-black/30">Aucun détail produit rattaché sur cet enregistrement.</p>
              ) : (
                selectedDispute.orderSnapshot.items.map((it, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">{it.productTitle}</p>
                      <p className="text-[10px] text-white/50">Qté : {it.quantity} × {formatFCFA(it.unitPriceFcfa)}</p>
                    </div>
                    <span className="font-mono font-bold text-white">{formatFCFA(it.totalFcfa)}</span>
                  </div>
                ))
              )}
            </div>

            {/* GPS / Tracking */}
            {selectedDispute.orderSnapshot.gpsInfo && (
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 text-[11px] text-white/75">
                <span className="font-bold text-white block mb-0.5">Adresse / repères livraison</span>
                {selectedDispute.orderSnapshot.gpsInfo.commune} {selectedDispute.orderSnapshot.gpsInfo.quartier} — {selectedDispute.orderSnapshot.gpsInfo.details}
                {selectedDispute.orderSnapshot.gpsInfo.lat !== undefined && (
                  <span className="block font-mono text-[10px] text-emerald-300 mt-0.5">
                    GPS : {selectedDispute.orderSnapshot.gpsInfo.lat}, {selectedDispute.orderSnapshot.gpsInfo.lng}
                  </span>
                )}
              </div>
            )}

            {selectedDispute.orderSnapshot.trackingHistory.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-white/45 block">Étapes de suivi commande</span>
                {selectedDispute.orderSnapshot.trackingHistory.map((step, i) => (
                  <div key={i} className="p-2 rounded-xl bg-black/35 border border-white/5 flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-white">{step.label}</span>
                    <span className="text-[10px] text-white/45">{step.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SECTION D: PREUVES ET JUSTIFICATIFS IMMUABLES */}
        {detailTab === 'evidence' && (
          <div className="space-y-3">
            <div className="p-3 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Coffre de preuves immuables ({selectedDispute.evidence.length})</span>
                </span>
                <span className="text-[10px] text-white/50">Suppression et altération interdites</span>
              </div>

              {selectedDispute.evidence.length === 0 ? (
                <p className="text-xs text-white/50 p-3 rounded-xl bg-black/40 text-center">
                  Aucune pièce justificative attachée pour le moment.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedDispute.evidence.map((ev) => (
                    <div key={ev.id} className="p-3 rounded-xl bg-black/45 border border-white/10 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-white/10 text-[9px] font-bold text-white/80">
                              {EVIDENCE_KIND_LABELS[ev.kind] || ev.kind}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[9px] font-bold">
                              Original protégé
                            </span>
                            {ev.flaggedDuplicateInDisputeIds && ev.flaggedDuplicateInDisputeIds.length > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[9px] font-black">
                                Réutilisée dans : {ev.flaggedDuplicateInDisputeIds.join(', ')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-white mt-1">{ev.title}</p>
                          {ev.description && <p className="text-[11px] text-white/65">{ev.description}</p>}
                          <p className="text-[10px] text-white/45 mt-1">
                            Ajouté par <strong>{ev.addedByName}</strong> ({ev.addedByRole}) le {fmtDateTime(ev.addedAt)} • SHA-256 :{' '}
                            <span className="font-mono">{ev.sha256.slice(0, 14)}…</span>
                          </p>
                        </div>
                      </div>
                      {ev.urlOrData && (ev.urlOrData.startsWith('data:image/') || ev.urlOrData.startsWith('http')) && (
                        <img
                          src={ev.urlOrData}
                          alt={ev.title}
                          className="max-h-40 rounded-xl border border-white/10 object-contain bg-black/50"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add proof form */}
              {perms.investigateAndMediate && (
                <div className="pt-2.5 border-t border-white/10 space-y-2">
                  <span className="text-[11px] font-bold text-emerald-300 block">Ajouter un justificatif (conservé de façon immuable)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={evKind}
                      onChange={(e) => setEvKind(e.target.value as DisputeEvidenceKind)}
                      className="bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    >
                      {Object.entries(EVIDENCE_KIND_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                    <select
                      value={evSubmitterRole}
                      onChange={(e) => setEvSubmitterRole(e.target.value as DisputeActorRoleType)}
                      className="bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="client">Auteur : Client</option>
                      <option value="seller">Auteur : Vendeur</option>
                      <option value="admin">Auteur : Administration</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    placeholder="Titre du justificatif (ex: Reçu Wave #WV-991, Photo colis ouvert)"
                    value={evTitle}
                    onChange={(e) => setEvTitle(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder="Description / détails ou référence"
                    value={evDescription}
                    onChange={(e) => setEvDescription(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-[11px] font-bold text-white cursor-pointer flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Joindre fichier / photo</span>
                      <input type="file" accept="image/*,application/pdf,video/*" onChange={handleFileEvidenceSelect} className="hidden" />
                    </label>
                    <input
                      type="text"
                      placeholder="Ou URL / contenu preuve"
                      value={evUrlOrData.startsWith('data:') ? '[Fichier chargé prêt]' : evUrlOrData}
                      onChange={(e) => setEvUrlOrData(e.target.value)}
                      className="flex-1 bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    />
                    <button
                      type="button"
                      disabled={!evTitle.trim() || busyAction !== null}
                      onClick={() => void handleUploadEvidence()}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold disabled:opacity-40 cursor-pointer"
                    >
                      Enregistrer preuve
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION E: HISTORIQUE DES ÉCHANGES */}
        {detailTab === 'timeline' && (
          <div className="space-y-3">
            {perms.investigateAndMediate && (
              <div className="p-3 rounded-2xl bg-[#141414] border border-white/10 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={msgKind}
                    onChange={(e) => setMsgKind(e.target.value as typeof msgKind)}
                    className="bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="admin_to_actor">Contacter un acteur (visible aux parties)</option>
                    <option value="evidence_request">Demander un justificatif</option>
                    <option value="actor_message">Consigner réponse d’un acteur</option>
                    <option value="internal_note">Note interne admin (invisible aux acteurs)</option>
                  </select>

                  {msgKind === 'actor_message' ? (
                    <select
                      value={msgActorSourceRole}
                      onChange={(e) => setMsgActorSourceRole(e.target.value as DisputeActorRoleType)}
                      className="bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="client">Réponse du Client</option>
                      <option value="seller">Réponse du Vendeur</option>
                    </select>
                  ) : msgKind !== 'internal_note' ? (
                    <select
                      value={msgTargetRole}
                      onChange={(e) => setMsgTargetRole(e.target.value as DisputeActorRoleType | 'all_actors')}
                      className="bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="client">Destinataire : Client</option>
                      <option value="seller">Destinataire : Vendeur</option>
                      <option value="all_actors">Tous les acteurs concernés</option>
                    </select>
                  ) : (
                    <div className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                      <span>Strictement interne administration</span>
                    </div>
                  )}
                </div>

                {msgKind === 'evidence_request' && (
                  <label className="flex items-center gap-2 text-[11px] text-white/75 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={msgSwitchAwaiting}
                      onChange={(e) => setMsgSwitchAwaiting(e.target.checked)}
                    />
                    <span>Passer le statut du dossier à « En attente de justificatifs »</span>
                  </label>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={
                      msgKind === 'internal_note'
                        ? 'Note confidentielle entre agents administratifs…'
                        : 'Écrire un message ou une demande officielle…'
                    }
                    value={msgText}
                    onChange={(e) => setMsgText(e.target.value)}
                    className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                  <button
                    type="button"
                    disabled={!msgText.trim() || busyAction !== null}
                    onClick={async () => {
                      setBusyAction('post_msg');
                      try {
                        await disputesService.postMessageOrNote(selectedDispute.id, {
                          kind: msgKind,
                          message: msgText.trim(),
                          targetActorRole: msgTargetRole,
                          actorResponseMode: msgActorSourceRole,
                          switchStatusToAwaitingEvidence: msgSwitchAwaiting
                        });
                        setMsgText('');
                        showToast(msgKind === 'internal_note' ? 'Note interne ajoutée.' : 'Échange enregistré et notifié.');
                        await loadOverview();
                      } catch (e: unknown) {
                        showToast((e as Error).message);
                      } finally {
                        setBusyAction(null);
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Envoyer</span>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {[...selectedDispute.timeline].reverse().map((entry) => {
                const isInternal = entry.visibility === 'admin_only';
                return (
                  <div
                    key={entry.id}
                    className={`p-3 rounded-2xl border space-y-1 ${
                      isInternal
                        ? 'bg-amber-950/20 border-amber-500/30'
                        : 'bg-[#141414] border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isInternal ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/35 text-[9px] font-black uppercase flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            <span>Note interne admin</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[9px] font-bold uppercase">
                            Visible acteurs
                          </span>
                        )}
                        <span className="text-[11px] font-bold text-white">{entry.title}</span>
                      </div>
                      <span className="text-[10px] text-white/45">{fmtDateTime(entry.at)}</span>
                    </div>
                    <p className="text-xs text-white/80 leading-relaxed">{entry.message}</p>
                    <p className="text-[10px] text-white/45">Par : {entry.authorName} ({entry.authorRole})</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION F: GESTION FINANCIÈRE DES LITIGES */}
        {detailTab === 'financial' && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-white/45 block">Montant contesté</span>
                  <span className="font-mono font-black text-white">{formatFCFA(selectedDispute.financial.disputedAmountFcfa)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-white/45 block">Montant bloqué</span>
                  <span className="font-mono font-black text-amber-400">{formatFCFA(selectedDispute.financial.blockedAmountFcfa)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-white/45 block">À rembourser</span>
                  <span className="font-mono font-black text-sky-300">{formatFCFA(selectedDispute.financial.amountToRefundFcfa)}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-white/45 block">Déjà remboursé</span>
                  <span className="font-mono font-black text-emerald-400">{formatFCFA(selectedDispute.financial.refundedAmountFcfa)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-black/35 p-2.5 rounded-xl border border-white/5">
                <div>
                  <span className="text-white/45 block">Frais de livraison</span>
                  <strong className="font-mono text-white">{formatFCFA(selectedDispute.financial.deliveryFeeFcfa)}</strong>
                </div>
                <div>
                  <span className="text-white/45 block">Commissions</span>
                  <strong className="font-mono text-white">{formatFCFA(selectedDispute.financial.commissionFcfa)}</strong>
                </div>
                <div>
                  <span className="text-white/45 block">Statut blocage</span>
                  <strong className="text-amber-300">{selectedDispute.financial.blockStatus}</strong>
                </div>
                <div>
                  <span className="text-white/45 block">Statut remboursement</span>
                  <strong className="text-emerald-300">{selectedDispute.financial.refundStatus}</strong>
                </div>
              </div>

              {selectedDispute.financial.refundReference && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-200 space-y-0.5">
                  <p>
                    <strong>Référence :</strong> {selectedDispute.financial.refundReference} •{' '}
                    <strong>Date :</strong> {fmtDateTime(selectedDispute.financial.refundDate)}
                  </p>
                  {selectedDispute.financial.refundProof && <p><strong>Preuve :</strong> {selectedDispute.financial.refundProof}</p>}
                  {selectedDispute.financial.financialManagerName && (
                    <p><strong>Responsable financier :</strong> {selectedDispute.financial.financialManagerName}</p>
                  )}
                </div>
              )}

              {/* Provider Honesty Banner */}
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 space-y-1">
                <span className="text-[10px] font-black uppercase text-white/55 block">État réel des prestataires financiers</span>
                {providerCapabilities.map((cap) => (
                  <div key={cap.id} className="text-[10px] flex items-start justify-between gap-2 text-white/75">
                    <span className={cap.configured ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>
                      {cap.configured ? '●' : '○'} {cap.name}
                    </span>
                    <span className="text-right text-white/50">{cap.statusDetail}</span>
                  </div>
                ))}
              </div>

              {/* Financial actions (RBAC guarded!) */}
              {perms.requestRefundOrRelease && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-white/10">
                  {/* Block or Release Funds */}
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
                    <span className="text-xs font-black text-amber-300 block">1. Bloquer ou libérer des fonds</span>
                    <div className="flex gap-1.5">
                      <select
                        value={finBlockMode}
                        onChange={(e) => setFinBlockMode(e.target.value as typeof finBlockMode)}
                        className="flex-1 bg-black/60 border border-white/10 rounded-xl px-2 py-1.5 text-[11px] text-white"
                      >
                        <option value="internal_ledger">Registre interne DJASSA (Actif)</option>
                        <option value="wave">Wave CI API (Vérifier dispo)</option>
                        <option value="orange_money">Orange Money API (Vérifier dispo)</option>
                      </select>
                      <input
                        type="number"
                        placeholder={String(selectedDispute.amountFcfa)}
                        value={finBlockAmount}
                        onChange={(e) => setFinBlockAmount(e.target.value)}
                        className="w-24 bg-black/60 border border-white/10 rounded-xl px-2 py-1.5 text-[11px] text-white"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={busyAction !== null}
                      onClick={() =>
                        void runWithMfaIfNeeded(
                          'block_funds',
                          'MFA requis — Blocage conservatoire',
                          'Confirmez votre identité pour enregistrer le séquestre ou vérifier le prestataire.',
                          async (code) => {
                            await disputesService.blockFunds(
                              selectedDispute.id,
                              {
                                amountFcfa: Number(finBlockAmount || selectedDispute.amountFcfa),
                                mode: finBlockMode,
                                reason: `Séquestre conservatoire sur dossier ${selectedDispute.code}`
                              },
                              code
                            );
                            showToast('Blocage conservatoire enregistré.');
                          }
                        )
                      }
                      className="w-full py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-bold cursor-pointer"
                    >
                      Exécuter blocage conservatoire
                    </button>

                    {selectedDispute.financial.blockedAmountFcfa > 0 && (
                      <div className="pt-2 border-t border-white/10 space-y-1.5">
                        <input
                          type="text"
                          placeholder="Saisir CONFIRMER pour libérer"
                          value={finReleaseConfirm}
                          onChange={(e) => setFinReleaseConfirm(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] text-white"
                        />
                        <button
                          type="button"
                          disabled={finReleaseConfirm.trim().toUpperCase() !== 'CONFIRMER' || busyAction !== null}
                          onClick={() =>
                            void runWithMfaIfNeeded(
                              'release_funds',
                              'MFA requis — Libération des fonds',
                              'Validation MFA requise pour autoriser la libération des fonds bloqués.',
                              async (code) => {
                                await disputesService.releaseFunds(
                                  selectedDispute.id,
                                  {
                                    reason: `Libération autorisée dossier ${selectedDispute.code}`,
                                    confirmationText: finReleaseConfirm
                                  },
                                  code
                                );
                                setFinReleaseConfirm('');
                                showToast('Fonds libérés avec succès.');
                              }
                            )
                          }
                          className="w-full py-1.5 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/35 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold disabled:opacity-40 cursor-pointer"
                        >
                          Autoriser la libération des fonds
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Trigger Refund */}
                  <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
                    <span className="text-xs font-black text-emerald-300 block">2. Déclencher un remboursement autorisé</span>
                    <div className="flex gap-1.5">
                      <select
                        value={finRefundChannel}
                        onChange={(e) => setFinRefundChannel(e.target.value)}
                        className="flex-1 bg-black/60 border border-white/10 rounded-xl px-2 py-1.5 text-[11px] text-white"
                      >
                        <option value="internal_ledger">Portefeuille / Registre interne</option>
                        <option value="wave">Wave CI (Suivi prestataire)</option>
                        <option value="orange_money">Orange Money (Suivi prestataire)</option>
                        <option value="mtn_momo">MTN MoMo (Suivi prestataire)</option>
                      </select>
                      <input
                        type="number"
                        placeholder={String(selectedDispute.amountFcfa)}
                        value={finRefundAmount}
                        onChange={(e) => setFinRefundAmount(e.target.value)}
                        className="w-24 bg-black/60 border border-white/10 rounded-xl px-2 py-1.5 text-[11px] text-white"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Motif du remboursement"
                      value={finRefundReason}
                      onChange={(e) => setFinRefundReason(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] text-white"
                    />
                    <input
                      type="text"
                      placeholder="Saisir CONFIRMER pour déclencher"
                      value={finRefundConfirm}
                      onChange={(e) => setFinRefundConfirm(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] text-white"
                    />
                    <button
                      type="button"
                      disabled={finRefundConfirm.trim().toUpperCase() !== 'CONFIRMER' || busyAction !== null}
                      onClick={() =>
                        void runWithMfaIfNeeded(
                          'req_refund',
                          'MFA requis — Remboursement litige',
                          'Opération financière sensible protégée par MFA et double validation si supérieur au seuil.',
                          async (code) => {
                            const res = await disputesService.requestRefund(
                              selectedDispute.id,
                              {
                                amountFcfa: Number(finRefundAmount || selectedDispute.amountFcfa),
                                channel: finRefundChannel,
                                reason: finRefundReason || `Remboursement litige ${selectedDispute.code}`,
                                confirmationText: finRefundConfirm
                              },
                              code
                            );
                            setFinRefundConfirm('');
                            setFinRefundReason('');
                            showToast(
                              res.dualValidationRequired
                                ? 'Demande soumise à double validation (4 yeux).'
                                : res.message || 'Opération de remboursement enregistrée.'
                            );
                          }
                        )
                      }
                      className="w-full py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold disabled:opacity-40 cursor-pointer"
                    >
                      Déclencher remboursement
                    </button>

                    {selectedDispute.financial.refundStatus === 'en_attente_confirmation_prestataire' &&
                      perms.approveFinancialDisputeOp && (
                        <div className="pt-2 border-t border-white/10 space-y-1.5">
                          <span className="text-[10px] font-bold text-amber-300 block">
                            Confirmer reçu prestataire externe
                          </span>
                          <input
                            type="text"
                            placeholder="Référence officielle reçu Wave/OM/MTN"
                            value={extReceiptRef}
                            onChange={(e) => setExtReceiptRef(e.target.value)}
                            className="w-full bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] text-white"
                          />
                          <button
                            type="button"
                            disabled={!extReceiptRef.trim() || busyAction !== null}
                            onClick={() =>
                              void runWithMfaIfNeeded(
                                'conf_ext_ref',
                                'MFA — Confirmation reçu prestataire',
                                'Confirmer la réception de la preuve officielle du prestataire.',
                                async (code) => {
                                  await disputesService.confirmExternalRefund(
                                    selectedDispute.id,
                                    { providerReceiptRef: extReceiptRef.trim() },
                                    code
                                  );
                                  setExtReceiptRef('');
                                  showToast('Remboursement externe confirmé.');
                                }
                              )
                            }
                            className="w-full py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold disabled:opacity-40 cursor-pointer"
                          >
                            Valider preuve prestataire
                          </button>
                        </div>
                      )}
                  </div>
                </div>
              )}

              {/* Transactions ledger */}
              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <span className="text-[10px] font-bold uppercase text-white/45 block">
                  Historique financier ({selectedDispute.financial.transactions.length})
                </span>
                {selectedDispute.financial.transactions.length === 0 ? (
                  <p className="text-[11px] text-white/45">Aucune écriture financière enregistrée sur ce dossier.</p>
                ) : (
                  selectedDispute.financial.transactions.map((tx) => (
                    <div key={tx.id} className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between gap-2 text-[11px]">
                      <div className="min-w-0">
                        <p className="font-bold text-white">
                          {tx.type} • {tx.channel} ({tx.providerStatus})
                        </p>
                        <p className="text-[10px] text-white/50 truncate">
                          Réf {tx.reference} • Par {tx.initiatedByName}
                          {tx.approvedByName ? ` / Validé ${tx.approvedByName}` : ''}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-emerald-300 shrink-0">{formatFCFA(tx.amountFcfa)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODALS */}
        {decisionModal && (
          <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-[#141414] border border-white/15 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white">{decisionModal.title}</h3>
                <button type="button" onClick={() => setDecisionModal(null)} className="text-white/50 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-white/65">Dossier {selectedDispute.code} — {selectedDispute.subject}</p>
              <textarea
                rows={3}
                placeholder={decisionModal.reasonLabel}
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                className="w-full bg-black/60 border border-white/15 rounded-xl p-2.5 text-xs text-white"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDecisionModal(null)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold text-white cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={(decisionModal.requireReason && decisionReason.trim().length < 5) || busyAction !== null}
                  onClick={async () => {
                    setBusyAction('decision');
                    try {
                      await disputesService.updateStatus(selectedDispute.id, {
                        status: decisionModal.targetStatus,
                        reason: decisionReason.trim(),
                        confirmed: true
                      });
                      setDecisionModal(null);
                      showToast('Décision enregistrée et tracée.');
                      await loadOverview();
                    } catch (e: unknown) {
                      showToast((e as Error).message);
                    } finally {
                      setBusyAction(null);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white disabled:opacity-40 cursor-pointer"
                >
                  Confirmer décision
                </button>
              </div>
            </div>
          </div>
        )}

        {sanctionOpen && (
          <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-[#141414] border border-amber-500/35 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-amber-300 flex items-center gap-1.5">
                  <Gavel className="w-4 h-4" />
                  <span>Appliquer une sanction DJASSA</span>
                </h3>
                <button type="button" onClick={() => setSanctionOpen(false)} className="text-white/50 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={sanctionTargetRole}
                  onChange={(e) => setSanctionTargetRole(e.target.value as DisputeActorRoleType)}
                  className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="seller">Acteur : Vendeur</option>
                  <option value="client">Acteur : Client</option>
                </select>
                <select
                  value={sanctionType}
                  onChange={(e) => setSanctionType(e.target.value as typeof sanctionType)}
                  className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="avertissement">Avertissement</option>
                  <option value="blocage_retraits">Blocage retraits</option>
                  <option value="restriction_commandes">Restriction commandes</option>
                  <option value="suspension_temporaire">Suspension temporaire</option>
                  <option value="suspension_permanente">Suspension permanente</option>
                </select>
              </div>
              {sanctionType !== 'avertissement' && sanctionType !== 'suspension_permanente' && (
                <input
                  type="number"
                  value={sanctionDuration}
                  onChange={(e) => setSanctionDuration(Number(e.target.value) || 7)}
                  placeholder="Durée (jours)"
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
                />
              )}
              <textarea
                rows={2}
                placeholder="Motif vérifié de la sanction (min. 5 caractères)"
                value={sanctionReason}
                onChange={(e) => setSanctionReason(e.target.value)}
                className="w-full bg-black/60 border border-white/15 rounded-xl p-2.5 text-xs text-white"
              />
              <input
                type="text"
                placeholder="Saisir CONFIRMER"
                value={sanctionConfirm}
                onChange={(e) => setSanctionConfirm(e.target.value)}
                className="w-full bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSanctionOpen(false)} className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold text-white">
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={sanctionReason.trim().length < 5 || sanctionConfirm.trim().toUpperCase() !== 'CONFIRMER'}
                  onClick={() => {
                    setSanctionOpen(false);
                    void runWithMfaIfNeeded(
                      'sanction',
                      'MFA requis — Application sanction',
                      'Confirmez votre identité pour appliquer cette sanction officielle.',
                      async (code) => {
                        await disputesService.applySanction(
                          selectedDispute.id,
                          {
                            targetRole: sanctionTargetRole,
                            sanctionType,
                            reason: sanctionReason.trim(),
                            durationDays: sanctionDuration,
                            confirmationText: sanctionConfirm
                          },
                          code
                        );
                        setSanctionReason('');
                        setSanctionConfirm('');
                        showToast('Sanction appliquée et consignée.');
                      }
                    );
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white disabled:opacity-40 cursor-pointer"
                >
                  Appliquer sanction
                </button>
              </div>
            </div>
          </div>
        )}

        {inspectedUser && (
          <AdminUserDetailModal user={inspectedUser} onClose={() => setInspectedUser(null)} zIndexClass="z-[75]" />
        )}
        {inspectedOrder && (
          <AdminOrderDetailModal order={inspectedOrder} onClose={() => setInspectedOrder(null)} />
        )}
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
                  Code MFA généré : {mfaPrompt.previewCode}
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

  // ============================================================================
  // MAIN WORKSPACE VIEW (11 SECTIONS)
  // ============================================================================
  return (
    <div id="admin-disputes-module" className="space-y-3.5 pb-12">
      {/* Header */}
      <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
              <Scale className="w-4 h-4 text-emerald-400" />
              <span>Réclamations & litiges</span>
            </h2>
            {unreadNotifs.length > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                <Bell className="w-3 h-3" />
                <span>{unreadNotifs.length} notif(s)</span>
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/55 mt-0.5">
            Arbitrage, médiation, coffre de preuves SHA-256 et gestion financière reliés aux commandes réelles.
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => void handleSyncRealOrders()}
            className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-white/85 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busyAction === 'sync' ? 'animate-spin' : ''}`} />
            <span>Sync commandes</span>
          </button>
          {perms.triageAndAssign && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouvelle réclamation</span>
            </button>
          )}
        </div>
      </div>

      {/* 11-Section Sub-Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {SECTION_TABS.map((tab) => {
          const isActive = section === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap border transition cursor-pointer ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/45'
                  : 'bg-[#141414] text-white/55 border-white/10 hover:text-white'
              }`}
            >
              {tab.label}
              {tab.id === 'urgent' && kpis.urgentDisputes > 0 ? ` (${kpis.urgentDisputes})` : ''}
              {tab.id === 'refunds' && pendingDualReqs.length > 0 ? ` (${pendingDualReqs.length})` : ''}
            </button>
          );
        })}
      </div>

      {/* SECTION 1: TABLEAU DE BORD */}
      {section === 'dashboard' && (
        <div className="space-y-3">
          {/* 10 Real KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {[
              { label: 'Total réclamations', value: String(kpis.totalDisputes), cls: 'text-white' },
              { label: 'Nouvelles', value: String(kpis.newDisputes), cls: 'text-sky-300' },
              { label: 'En attente', value: String(kpis.pendingDisputes), cls: 'text-amber-300' },
              { label: 'En cours', value: String(kpis.inProgressDisputes), cls: 'text-indigo-300' },
              { label: 'Litiges urgents', value: String(kpis.urgentDisputes), cls: 'text-rose-400' },
              { label: 'Résolues', value: String(kpis.resolvedDisputes), cls: 'text-emerald-400' },
              { label: 'Rejetées', value: String(kpis.rejectedDisputes), cls: 'text-white/70' },
              { label: 'Remb. en attente', value: String(kpis.pendingRefundsCount), cls: 'text-amber-300' },
              { label: 'Montant litiges', value: formatFCFA(kpis.totalFinancialDisputeFcfa), cls: 'text-emerald-300 font-mono' },
              { label: 'Délai moyen résol.', value: `${kpis.averageResolutionHours} h`, cls: 'text-white font-mono' }
            ].map((card, i) => (
              <div key={i} className="p-3 rounded-2xl bg-[#141414] border border-white/10 space-y-0.5">
                <span className="text-[10px] text-white/50 block truncate">{card.label}</span>
                <p className={`text-base font-black ${card.cls}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Alerts / SLA Overdue & Abuse Counter */}
          {(kpis.overdueCount > 0 || kpis.abuseFlaggedCount > 0) && (
            <div className="p-3 rounded-2xl bg-amber-950/25 border border-amber-500/35 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  {kpis.overdueCount} dossier(s) en retard SLA • {kpis.abuseFlaggedCount} dossier(s) avec signalement d’abus à vérifier.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSection('urgent')}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-[11px] font-bold cursor-pointer"
              >
                Voir urgences
              </button>
            </div>
          )}

          {/* Dual validation queue if any */}
          {pendingDualReqs.length > 0 && (
            <div className="p-3 rounded-2xl bg-[#141414] border border-emerald-500/30 space-y-2">
              <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Remboursements / Déblocages en attente de double validation ({pendingDualReqs.length})</span>
              </span>
              {pendingDualReqs.map((reqItem) => (
                <div key={reqItem.id} className="p-2.5 rounded-xl bg-black/45 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <p className="font-bold text-white">
                      {reqItem.disputeCode} — {formatFCFA(reqItem.amountFcfa)} ({reqItem.channel})
                    </p>
                    <p className="text-[10px] text-white/55">
                      Demandé par {reqItem.requestedByName} • Bénéficiaire : {reqItem.targetAccountName}
                    </p>
                  </div>
                  {perms.approveFinancialDisputeOp && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          void runWithMfaIfNeeded(
                            `dec_app_${reqItem.id}`,
                            'Double validation financière (MFA)',
                            'Confirmez l’approbation par un second responsable différent du demandeur.',
                            async (code) => {
                              await disputesService.decideFinancialRequest(reqItem.id, 'approve', 'Approuvé par second contrôleur', code);
                              showToast('Opération financière approuvée et exécutée.');
                            }
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold cursor-pointer"
                      >
                        Approuver
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void runWithMfaIfNeeded(
                            `dec_rej_${reqItem.id}`,
                            'Rejet opération financière (MFA)',
                            'Confirmez le rejet de cette demande financière.',
                            async (code) => {
                              await disputesService.decideFinancialRequest(reqItem.id, 'reject', 'Rejeté lors du double contrôle', code);
                              showToast('Demande financière rejetée.');
                            }
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-rose-600/80 text-white text-[10px] font-bold cursor-pointer"
                      >
                        Rejeter
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Notifications & Audit Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-[#141414] border border-white/10 space-y-2">
              <span className="text-xs font-black text-white flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-amber-400" />
                <span>Notifications récentes ({notifications.length})</span>
              </span>
              {notifications.length === 0 ? (
                <p className="text-[11px] text-white/45">Aucune notification enregistrée.</p>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto no-scrollbar">
                  {notifications.slice(0, 8).map((n) => {
                    const isRead = n.readByActorIds.includes(actor.staffId);
                    return (
                      <div
                        key={n.id}
                        onClick={async () => {
                          if (!isRead) await disputesService.markNotificationRead(n.id);
                          setSelectedDisputeId(n.disputeId);
                        }}
                        className={`p-2 rounded-xl border text-[11px] cursor-pointer ${
                          isRead ? 'bg-black/30 border-white/5 text-white/60' : 'bg-amber-500/10 border-amber-500/30 text-white'
                        }`}
                      >
                        <div className="flex justify-between gap-2">
                          <strong className="truncate">{n.title}</strong>
                          <span className="text-[9px] text-white/45 shrink-0">{fmtDateTime(n.createdAt)}</span>
                        </div>
                        <p className="text-[10px] text-white/65 truncate">{n.body}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-3 rounded-2xl bg-[#141414] border border-white/10 space-y-2">
              <span className="text-xs font-black text-white flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-emerald-400" />
                <span>Traçabilité & journal d’audit litiges</span>
              </span>
              {auditTrail.length === 0 ? (
                <p className="text-[11px] text-white/45">Aucune action enregistrée.</p>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto no-scrollbar">
                  {auditTrail.slice(0, 8).map((a) => (
                    <div key={a.id} className="p-2 rounded-xl bg-black/35 border border-white/5 text-[11px]">
                      <div className="flex justify-between gap-2">
                        <strong className="text-white truncate">{a.action}</strong>
                        <span className="text-[9px] text-white/45 shrink-0">{fmtDateTime(a.at)}</span>
                      </div>
                      <p className="text-[10px] text-white/55 truncate">
                        {a.actorName} • {a.target}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 11: PARAMÈTRES DES LITIGES */}
      {section === 'settings' && settingsDraft && (
        <div className="space-y-3">
          {!perms.manageDisputeSettings ? (
            <div className="p-4 rounded-2xl bg-[#141414] border border-amber-500/30 text-xs text-amber-300">
              Permission <code>manageDisputeSettings</code> requise pour modifier les règles du module.
            </div>
          ) : (
            <>
              <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-3 text-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-emerald-400" />
                    <span>Paramètres généraux du module Réclamations & litiges</span>
                  </span>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() =>
                      void runWithMfaIfNeeded(
                        'save_settings',
                        'MFA requis — Paramètres litiges',
                        'Validez la mise à jour des délais, seuils et règles du module litiges.',
                        async (code) => {
                          await disputesService.updateSettings(settingsDraft, code);
                          showToast('Paramètres enregistrés avec succès.');
                        }
                      )
                    }
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
                  >
                    Enregistrer paramètres
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="p-2.5 rounded-xl bg-black/40 border border-white/10 space-y-1">
                    <span className="text-[10px] text-white/55 block">Affectation automatique</span>
                    <select
                      value={settingsDraft.autoAssignMode}
                      onChange={(e) => setSettingsDraft({ ...settingsDraft, autoAssignMode: e.target.value as 'manuel' | 'equilibre_charge' })}
                      className="w-full bg-black/60 border border-white/15 rounded-lg px-2 py-1 text-xs text-white"
                    >
                      <option value="equilibre_charge">Équilibrage de charge auto</option>
                      <option value="manuel">Attribution manuelle uniquement</option>
                    </select>
                  </label>
                  <label className="p-2.5 rounded-xl bg-black/40 border border-white/10 space-y-1">
                    <span className="text-[10px] text-white/55 block">Seuil double validation remb. (FCFA)</span>
                    <input
                      type="number"
                      value={settingsDraft.requireDualValidationForRefundOverFcfa}
                      onChange={(e) =>
                        setSettingsDraft({ ...settingsDraft, requireDualValidationForRefundOverFcfa: Number(e.target.value) || 0 })
                      }
                      className="w-full bg-black/60 border border-white/15 rounded-lg px-2 py-1 text-xs text-white"
                    />
                  </label>
                  <label className="p-2.5 rounded-xl bg-black/40 border border-white/10 space-y-1">
                    <span className="text-[10px] text-white/55 block">Conservation preuves (jours)</span>
                    <input
                      type="number"
                      value={settingsDraft.evidenceRetentionDays}
                      onChange={(e) => setSettingsDraft({ ...settingsDraft, evidenceRetentionDays: Number(e.target.value) || 365 })}
                      className="w-full bg-black/60 border border-white/15 rounded-lg px-2 py-1 text-xs text-white"
                    />
                  </label>
                  <label className="p-2.5 rounded-xl bg-black/40 border border-white/10 space-y-1">
                    <span className="text-[10px] text-white/55 block">Délai max médiation (heures)</span>
                    <input
                      type="number"
                      value={settingsDraft.mediationMaxHours}
                      onChange={(e) => setSettingsDraft({ ...settingsDraft, mediationMaxHours: Number(e.target.value) || 48 })}
                      className="w-full bg-black/60 border border-white/15 rounded-lg px-2 py-1 text-xs text-white"
                    />
                  </label>
                  <label className="p-2.5 rounded-xl bg-black/40 border border-white/10 space-y-1">
                    <span className="text-[10px] text-white/55 block">Réouverture autorisée (jours)</span>
                    <input
                      type="number"
                      value={settingsDraft.allowReopenWithinDays}
                      onChange={(e) => setSettingsDraft({ ...settingsDraft, allowReopenWithinDays: Number(e.target.value) || 14 })}
                      className="w-full bg-black/60 border border-white/15 rounded-lg px-2 py-1 text-xs text-white"
                    />
                  </label>
                  <label className="p-2.5 rounded-xl bg-black/40 border border-white/10 space-y-1">
                    <span className="text-[10px] text-white/55 block">Seuil réclamations / 30j (anti-abus)</span>
                    <input
                      type="number"
                      value={settingsDraft.antiFraudThresholds.maxClaimsPerUser30d}
                      onChange={(e) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          antiFraudThresholds: {
                            ...settingsDraft.antiFraudThresholds,
                            maxClaimsPerUser30d: Number(e.target.value) || 3
                          }
                        })
                      }
                      className="w-full bg-black/60 border border-white/15 rounded-lg px-2 py-1 text-xs text-white"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { key: 'autoEscalationOnSlaBreach', label: 'Escalade automatique en URGENT si SLA dépassé' },
                    { key: 'preventCloseWithPendingRefund', label: 'Empêcher la clôture si un remboursement est en attente' },
                    { key: 'requireProofBeforeClose', label: 'Exiger au moins un justificatif avant clôture' }
                  ].map((chk) => (
                    <label key={chk.key} className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean((settingsDraft as any)[chk.key])}
                        onChange={(e) => setSettingsDraft({ ...settingsDraft, [chk.key]: e.target.checked })}
                      />
                      <span className="text-[11px] text-white/85">{chk.label}</span>
                    </label>
                  ))}
                </div>

                {/* 17 Categories Config */}
                <div className="space-y-1.5 pt-2 border-t border-white/10">
                  <span className="text-[10px] font-black uppercase text-white/50 block">17 Catégories & délais SLA</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto no-scrollbar">
                    {settingsDraft.categories.map((cat, idx) => (
                      <div key={cat.key} className="p-2 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={cat.enabled}
                            onChange={(e) => {
                              const nextCats = [...settingsDraft.categories];
                              nextCats[idx] = { ...cat, enabled: e.target.checked };
                              setSettingsDraft({ ...settingsDraft, categories: nextCats });
                            }}
                          />
                          <span className="text-[11px] text-white truncate">{cat.label}</span>
                        </label>
                        <input
                          type="number"
                          value={cat.slaHours}
                          onChange={(e) => {
                            const nextCats = [...settingsDraft.categories];
                            nextCats[idx] = { ...cat, slaHours: Number(e.target.value) || 24 };
                            setSettingsDraft({ ...settingsDraft, categories: nextCats });
                          }}
                          className="w-14 bg-black/60 border border-white/10 rounded-lg px-1.5 py-0.5 text-[10px] text-white text-right"
                          title="SLA (heures)"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Agent Permissions Matrix (Super Admin) */}
              {actor.role === 'super_admin' && (
                <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5">
                  <span className="text-xs font-black text-white flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span>Permissions des agents sur les litiges</span>
                  </span>
                  <div className="space-y-2">
                    {staffPermissions
                      .filter((sp) => sp.role !== 'super_admin')
                      .map((sp) => (
                        <div key={sp.staffId} className="p-2.5 rounded-xl bg-black/45 border border-white/10 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <strong>{sp.name}</strong>
                            <span className="text-[10px] text-white/50">{sp.role}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {(Object.keys(PERMISSION_LABELS) as DisputePermissionKey[]).map((pk) => (
                              <label key={pk} className="flex items-center gap-2 text-[10px] text-white/75 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(sp.permissions[pk])}
                                  onChange={(e) => {
                                    const nextVal = e.target.checked;
                                    void runWithMfaIfNeeded(
                                      `perm_${sp.staffId}_${pk}`,
                                      'MFA requis — Droits agent litiges',
                                      `Modifier « ${PERMISSION_LABELS[pk]} » pour ${sp.name}.`,
                                      async (code) => {
                                        await disputesService.updatePermissions(sp.staffId, { [pk]: nextVal }, code);
                                        showToast('Permissions mises à jour.');
                                      }
                                    );
                                  }}
                                />
                                <span>{PERMISSION_LABELS[pk]}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* SECTIONS 2-10: LISTE DYNAMIQUE DES RÉCLAMATIONS */}
      {section !== 'dashboard' && section !== 'settings' && (
        <div className="space-y-3">
          {/* Search & Filter Toolbar */}
          <div className="p-3 rounded-2xl bg-[#141414] border border-white/10 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher par ID dossier (REC-...), nom acteur ou N° commande…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-white/40"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-black/60 border border-white/10 rounded-xl px-2 py-1.5 text-[11px] text-white"
              >
                <option value="all">Toutes catégories (17)</option>
                {(overview.settings.categories || []).map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-black/60 border border-white/10 rounded-xl px-2 py-1.5 text-[11px] text-white"
              >
                <option value="all">Tous statuts</option>
                {(Object.keys(STATUS_META) as DisputeStatus[]).map((st) => (
                  <option key={st} value={st}>
                    {STATUS_META[st].label}
                  </option>
                ))}
              </select>

              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="bg-black/60 border border-white/10 rounded-xl px-2 py-1.5 text-[11px] text-white"
              >
                <option value="all">Toutes priorités</option>
                <option value="urgent">Urgent</option>
                <option value="normal">Normal</option>
                <option value="faible">Faible</option>
              </select>

              <div className="flex gap-1">
                <select
                  value={filterDateRange}
                  onChange={(e) => setFilterDateRange(e.target.value as typeof filterDateRange)}
                  className="flex-1 bg-black/60 border border-white/10 rounded-xl px-2 py-1.5 text-[11px] text-white"
                >
                  <option value="all">Toutes dates</option>
                  <option value="today">Aujourd’hui</option>
                  <option value="7d">7 derniers jours</option>
                  <option value="30d">30 derniers jours</option>
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="flex-1 bg-black/60 border border-white/10 rounded-xl px-2 py-1.5 text-[11px] text-white"
                >
                  <option value="priority_desc">Urgents en haut</option>
                  <option value="newest">Plus récents</option>
                  <option value="oldest">Plus anciens</option>
                  <option value="amount_desc">Montant ↓</option>
                </select>
              </div>
            </div>
          </div>

          {/* Dual validation banner on Refunds section */}
          {section === 'refunds' && pendingDualReqs.length > 0 && (
            <div className="p-3 rounded-2xl bg-emerald-950/25 border border-emerald-500/35 space-y-2">
              <span className="text-xs font-black text-emerald-300 block">File de double validation financière</span>
              {pendingDualReqs.map((reqItem) => (
                <div key={reqItem.id} className="p-2 rounded-xl bg-black/45 border border-white/10 flex items-center justify-between gap-2 text-xs">
                  <span>
                    <strong>{reqItem.disputeCode}</strong> • {formatFCFA(reqItem.amountFcfa)} ({reqItem.requestedByName})
                  </span>
                  {perms.approveFinancialDisputeOp && (
                    <button
                      type="button"
                      onClick={() =>
                        void runWithMfaIfNeeded(
                          `ref_app_${reqItem.id}`,
                          'Double validation (MFA)',
                          'Validez ce remboursement après contrôle.',
                          async (code) => {
                            await disputesService.decideFinancialRequest(reqItem.id, 'approve', 'Approuvé', code);
                            showToast('Remboursement approuvé.');
                          }
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold cursor-pointer"
                    >
                      Approuver
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Compact Dispute Cards */}
          {pagedDisputes.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#141414] border border-white/10 text-center space-y-2">
              <FileCheck2 className="w-6 h-6 text-white/35 mx-auto" />
              <p className="text-xs font-bold text-white">Aucune réclamation dans cette vue</p>
              <p className="text-[11px] text-white/50">
                Synchronisez les incidents des commandes réelles ou ouvrez une nouvelle réclamation liée à une commande.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {pagedDisputes.map((d) => {
                const isOverdue =
                  d.status !== 'resolue' &&
                  d.status !== 'rejetee' &&
                  d.status !== 'cloturee' &&
                  new Date(d.slaDeadlineAt).getTime() < Date.now();
                return (
                  <div
                    key={d.id}
                    onClick={() => {
                      setSelectedDisputeId(d.id);
                      setDetailTab('general');
                    }}
                    className={`p-3 rounded-2xl bg-[#141414] border transition cursor-pointer space-y-2 ${
                      d.priority === 'urgent'
                        ? 'border-rose-500/40 hover:border-rose-400/70'
                        : 'border-white/10 hover:border-emerald-500/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-mono font-black text-emerald-400">{d.code}</span>
                          <span className="text-[10px] font-mono text-purple-300 bg-purple-500/15 px-1.5 py-0.5 rounded">
                            #{d.orderNumber}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${PRIORITY_META[d.priority].cls}`}>
                            {PRIORITY_META[d.priority].label}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${STATUS_META[d.status].cls}`}>
                            {STATUS_META[d.status].label}
                          </span>
                          {isOverdue && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              En retard
                            </span>
                          )}
                          {d.abuseIndicators.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/35">
                              {d.abuseIndicators.length} alerte(s)
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-black text-white truncate">{d.subject}</p>
                        <p className="text-[10px] text-white/55 truncate">
                          {categoryLabelMap[d.category] || d.category}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-xs font-black font-mono text-emerald-300">{formatFCFA(d.amountFcfa)}</p>
                        <p className="text-[10px] text-white/45">{fmtDate(d.createdAt)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/5 text-[10px] text-white/65">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={d.declarant.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&q=80'}
                          alt={d.declarant.name}
                          className="w-5 h-5 rounded-full object-cover border border-white/20 shrink-0"
                        />
                        <span className="truncate">
                          <strong className="text-white">{d.declarant.name}</strong> ({d.declarant.roleType}) →{' '}
                          <strong className="text-white/90">{d.accusedActor.name}</strong>
                        </span>
                      </div>
                      <span className="shrink-0 text-white/50">
                        Agent : {d.assignedAgentName || 'Non affecté'}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-1 text-xs">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-white/75 disabled:opacity-35 flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Précédent</span>
                  </button>
                  <span className="text-[11px] text-white/55">
                    Page {page} / {totalPages} ({filteredDisputes.length} dossiers)
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-white/75 disabled:opacity-35 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Suivant</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CREATE NEW DISPUTE MODAL */}
      {createOpen && (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateClaimSubmit}
            className="w-full max-w-lg rounded-2xl bg-[#141414] border border-white/15 p-4 space-y-2.5 max-h-[90vh] overflow-y-auto no-scrollbar"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Ouvrir une réclamation liée</span>
              </h3>
              <button type="button" onClick={() => setCreateOpen(false)} className="text-white/50 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-white/55 block">Lier à une commande réelle existante</span>
              <select
                value={newOrderId}
                onChange={(e) => {
                  const id = e.target.value;
                  setNewOrderId(id);
                  const ord = orders.find((o) => o.id === id);
                  if (ord) {
                    setNewOrderNumberManual(ord.orderNumber);
                    setNewAmountFcfa(String(ord.total));
                    setNewDeclarantName(ord.deliveryAddress.recipientName);
                    setNewAccusedName(ord.items[0]?.sellerName || '');
                  }
                }}
                className="w-full bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                <option value="">-- Sélectionner une commande ({orders.length} disponibles) --</option>
                {orders.slice(0, 50).map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.orderNumber} • {o.deliveryAddress.recipientName} • {formatFCFA(o.total)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="N° Commande (ex: DJA-1042)"
                value={newOrderNumberManual}
                onChange={(e) => setNewOrderNumberManual(e.target.value)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              />
              <input
                type="number"
                placeholder="Montant contesté FCFA"
                value={newAmountFcfa}
                onChange={(e) => setNewAmountFcfa(e.target.value)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as DisputeCategoryKey)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                {(overview.settings.categories || []).map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as DisputePriority)}
                className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
              >
                <option value="urgent">Priorité : Urgent</option>
                <option value="normal">Priorité : Normal</option>
                <option value="faible">Priorité : Faible</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex gap-1">
                <select
                  value={newDeclarantRole}
                  onChange={(e) => setNewDeclarantRole(e.target.value as DisputeActorRoleType)}
                  className="bg-black/60 border border-white/15 rounded-xl px-2 py-1.5 text-[11px] text-white"
                >
                  <option value="client">Client</option>
                  <option value="seller">Vendeur</option>
                </select>
                <input
                  type="text"
                  placeholder="Nom déclarant"
                  value={newDeclarantName}
                  onChange={(e) => setNewDeclarantName(e.target.value)}
                  className="flex-1 min-w-0 bg-black/60 border border-white/15 rounded-xl px-2 py-1.5 text-xs text-white"
                />
              </div>

              <div className="flex gap-1">
                <select
                  value={newAccusedRole}
                  onChange={(e) => setNewAccusedRole(e.target.value as DisputeActorRoleType)}
                  className="bg-black/60 border border-white/15 rounded-xl px-2 py-1.5 text-[11px] text-white"
                >
                  <option value="seller">Vendeur</option>
                  <option value="client">Client</option>
                </select>
                <input
                  type="text"
                  placeholder="Acteur mis en cause"
                  value={newAccusedName}
                  onChange={(e) => setNewAccusedName(e.target.value)}
                  className="flex-1 min-w-0 bg-black/60 border border-white/15 rounded-xl px-2 py-1.5 text-xs text-white"
                />
              </div>
            </div>

            <input
              type="text"
              required
              placeholder="Objet précis du litige"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              className="w-full bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs text-white"
            />
            <textarea
              rows={3}
              required
              placeholder="Description détaillée des faits constatés…"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full bg-black/60 border border-white/15 rounded-xl p-2.5 text-xs text-white"
            />

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setCreateOpen(false)} className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold text-white">
                Annuler
              </button>
              <button
                type="submit"
                disabled={busyAction !== null}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white cursor-pointer"
              >
                Créer dossier
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Global MFA Prompt when triggered from main list/dashboard/settings */}
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
                Code MFA généré : {mfaPrompt.previewCode}
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
