import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Wallet,
  X,
  XCircle
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import {
  AdminTabType,
  AdminUserRecord,
  CommissionEntryDto,
  CommissionSettlementDto,
  CommissionSummaryStats,
  Order,
  OrderReceiptDto
} from '../../../types';
import { formatFCFA, formatOrderDate, OrderService } from '../../../services/marketServices';
import { commerceService } from '../../../services/commerceService';
import {
  calcOrderFinancials,
  DJASSA_FIXED_COMMISSION_FCFA,
  getCommissionStatusLabel,
  getPaymentMethodLabel,
  getPaymentModeLabel,
  getSellerPayoutStatusLabel,
  resolveOrderPaymentMode
} from '../../../utils/commerceCalculations';
import { AdminUserDetailModal } from '../modals/AdminUserDetailModal';
import { DjassaOfficialReceiptModal } from '../../common/DjassaOfficialReceiptModal';

export interface AdminCommissionsManagerProps {
  onNavigateTab?: (tab: AdminTabType) => void;
}

export const AdminCommissionsManager: React.FC<AdminCommissionsManagerProps> = () => {
  const { orders, sellers, adminUsers, showToast } = useApp();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CommissionSummaryStats | null>(null);
  const [entries, setEntries] = useState<CommissionEntryDto[]>([]);
  const [settlements, setSettlements] = useState<CommissionSettlementDto[]>([]);

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'collected' | 'paid' | 'cancelled'>('all');
  const [modeFilter, setModeFilter] = useState<'all' | 'online' | 'cod'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // COD verified manual settlement modal
  const [settleTarget, setSettleTarget] = useState<CommissionEntryDto | null>(null);
  const [settleChannel, setSettleChannel] = useState<'wave' | 'orange_money' | 'manual_verified'>('wave');
  const [providerReference, setProviderReference] = useState('');
  const [verifiedManual, setVerifiedManual] = useState(false);
  const [settleNotes, setSettleNotes] = useState('');
  const [submittingSettle, setSubmittingSettle] = useState(false);

  // Official receipt modal & user detail modal
  const [receiptTarget, setReceiptTarget] = useState<{ order: Order; dto?: OrderReceiptDto } | null>(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState<AdminUserRecord | null>(null);

  const buildLocalFallback = useCallback(() => {
    const derivedEntries: CommissionEntryDto[] = orders.map((o) => {
      const paymentMode = resolveOrderPaymentMode(o);
      const subtotal = o.subtotal ?? o.items.reduce((s, it) => s + it.price * it.quantity, 0);
      const discount = o.discount ?? 0;
      const fin = calcOrderFinancials({ subtotal, discount, paymentMode });
      const commissionStatus =
        o.commissionStatus ||
        (o.status === 'cancelled'
          ? 'cancelled'
          : paymentMode === 'online' && o.paymentStatus === 'paid'
          ? 'collected'
          : 'pending');
      return {
        orderId: o.id,
        orderNumber: o.orderNumber,
        sellerId: o.sellerId || o.items[0]?.sellerId || 'seller-1',
        sellerName: o.sellerName || o.items[0]?.sellerName || 'Boutique DJASSA',
        clientId: o.clientId || 'client-1',
        clientName: o.clientName || o.deliveryAddress?.recipientName || 'Client DJASSA',
        paymentMode,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        subtotal,
        discount,
        clientFeeFcfa: o.clientFeeFcfa ?? fin.clientFeeFcfa,
        total: o.total ?? fin.total,
        commissionFcfa: o.commissionFcfa ?? DJASSA_FIXED_COMMISSION_FCFA,
        commissionStatus,
        sellerNetFcfa: o.sellerNetFcfa ?? fin.sellerNetFcfa,
        sellerPayoutStatus:
          o.sellerPayoutStatus ||
          (paymentMode === 'cod'
            ? 'not_applicable'
            : o.paymentStatus === 'paid'
            ? 'completed'
            : 'pending_payment'),
        sellerPayoutReference: o.sellerPayoutReference || null,
        createdAt: o.createdAt
      };
    });

    const stats: CommissionSummaryStats = {
      totalOrdersCount: derivedEntries.length,
      generatedFcfa: derivedEntries
        .filter((e) => e.commissionStatus !== 'cancelled')
        .reduce((s, e) => s + e.commissionFcfa, 0),
      collectedFcfa: derivedEntries
        .filter((e) => e.commissionStatus === 'collected')
        .reduce((s, e) => s + e.commissionFcfa, 0),
      pendingFcfa: derivedEntries
        .filter((e) => e.commissionStatus === 'pending')
        .reduce((s, e) => s + e.commissionFcfa, 0),
      paidFcfa: derivedEntries
        .filter((e) => e.commissionStatus === 'paid')
        .reduce((s, e) => s + e.commissionFcfa, 0),
      cancelledFcfa: derivedEntries
        .filter((e) => e.commissionStatus === 'cancelled')
        .reduce((s, e) => s + e.commissionFcfa, 0)
    };

    setSummary(stats);
    setEntries(derivedEntries);
  }, [orders]);

  const loadCommissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await commerceService.getCommissionsDashboard();
      if (res?.success && res.summary && Array.isArray(res.entries)) {
        setSummary(res.summary);
        setEntries(res.entries);
        setSettlements(res.settlements || []);
      } else {
        buildLocalFallback();
      }
    } catch {
      buildLocalFallback();
    } finally {
      setLoading(false);
    }
  }, [buildLocalFallback]);

  useEffect(() => {
    void loadCommissions();
  }, [loadCommissions]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((entry) => {
      if (statusFilter !== 'all' && entry.commissionStatus !== statusFilter) return false;
      if (modeFilter !== 'all' && entry.paymentMode !== modeFilter) return false;
      if (!q) return true;
      return (
        entry.orderNumber.toLowerCase().includes(q) ||
        entry.sellerName.toLowerCase().includes(q) ||
        entry.clientName.toLowerCase().includes(q) ||
        (entry.sellerPayoutReference || '').toLowerCase().includes(q)
      );
    });
  }, [entries, statusFilter, modeFilter, searchQuery]);

  // Per-seller breakdown
  const sellerBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        sellerId: string;
        sellerName: string;
        ordersCount: number;
        grossSalesFcfa: number;
        totalCommissionFcfa: number;
        collectedFcfa: number;
        pendingFcfa: number;
        paidFcfa: number;
        sellerNetFcfa: number;
      }
    >();

    entries.forEach((e) => {
      const key = e.sellerId || e.sellerName;
      const cur = map.get(key) || {
        sellerId: e.sellerId,
        sellerName: e.sellerName,
        ordersCount: 0,
        grossSalesFcfa: 0,
        totalCommissionFcfa: 0,
        collectedFcfa: 0,
        pendingFcfa: 0,
        paidFcfa: 0,
        sellerNetFcfa: 0
      };
      cur.ordersCount += 1;
      if (e.commissionStatus !== 'cancelled') {
        cur.grossSalesFcfa += Math.max(0, e.subtotal - e.discount);
        cur.totalCommissionFcfa += e.commissionFcfa;
        cur.sellerNetFcfa += e.sellerNetFcfa;
      }
      if (e.commissionStatus === 'collected') cur.collectedFcfa += e.commissionFcfa;
      if (e.commissionStatus === 'pending') cur.pendingFcfa += e.commissionFcfa;
      if (e.commissionStatus === 'paid') cur.paidFcfa += e.commissionFcfa;
      map.set(key, cur);
    });

    return Array.from(map.values()).sort((a, b) => b.totalCommissionFcfa - a.totalCommissionFcfa);
  }, [entries]);

  const handleOpenSettleModal = (entry: CommissionEntryDto) => {
    setSettleTarget(entry);
    setSettleChannel('wave');
    setProviderReference('');
    setVerifiedManual(false);
    setSettleNotes('');
  };

  const handleConfirmCodSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleTarget) return;
    if (!verifiedManual || !providerReference.trim()) {
      showToast('Veuillez confirmer la vérification manuelle et saisir une référence de paiement réelle.');
      return;
    }

    setSubmittingSettle(true);
    try {
      const res = await commerceService.settleCodCommission(settleTarget.orderId, {
        channel: settleChannel,
        verifiedManual: true,
        providerReference: providerReference.trim(),
        notes: settleNotes.trim() || undefined
      });
      if (res?.success) {
        showToast(`Commission COD de ${formatFCFA(settleTarget.commissionFcfa)} régularisée (#${settleTarget.orderNumber})`);
        setSettleTarget(null);
        await loadCommissions();
      } else {
        showToast('Impossible de régulariser cette commission.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors de la régularisation de la commission COD.');
    } finally {
      setSubmittingSettle(false);
    }
  };

  const handleOpenOfficialReceipt = async (entry: CommissionEntryDto) => {
    const matchedOrder =
      orders.find((o) => o.id === entry.orderId || o.orderNumber === entry.orderNumber) ||
      ({
        id: entry.orderId,
        orderNumber: entry.orderNumber,
        items: [
          {
            productId: 'item-1',
            productTitle: `Commande #${entry.orderNumber}`,
            productImage: '',
            price: entry.subtotal,
            quantity: 1,
            sellerId: entry.sellerId,
            sellerName: entry.sellerName
          }
        ],
        subtotal: entry.subtotal,
        deliveryFee: 0,
        discount: entry.discount,
        clientFeeFcfa: entry.clientFeeFcfa,
        commissionFcfa: entry.commissionFcfa,
        commissionStatus: entry.commissionStatus,
        sellerNetFcfa: entry.sellerNetFcfa,
        sellerPayoutStatus: entry.sellerPayoutStatus,
        sellerPayoutReference: entry.sellerPayoutReference,
        total: entry.total,
        paymentMode: entry.paymentMode,
        paymentMethod: entry.paymentMethod as Order['paymentMethod'],
        paymentStatus: entry.paymentStatus as Order['paymentStatus'],
        visibleStatus: 'Commande confirmée',
        status: entry.commissionStatus === 'cancelled' ? 'cancelled' : 'passed',
        sellerId: entry.sellerId,
        sellerName: entry.sellerName,
        clientId: entry.clientId,
        clientName: entry.clientName,
        createdAt: entry.createdAt,
        deliveryAddress: {
          commune: 'Abidjan',
          quartier: '',
          details: '',
          recipientName: entry.clientName,
          phone: ''
        },
        trackingEvents: []
      } as Order);

    setReceiptTarget({ order: matchedOrder });
    try {
      const res = await commerceService.getOrderReceipt(entry.orderId);
      if (res?.receipt) {
        setReceiptTarget({ order: matchedOrder, dto: res.receipt });
      }
    } catch {
      // fallback to local DTO
    }
  };

  const handleOpenSellerProfile = (sellerId: string, sellerName: string) => {
    const matchedUser = adminUsers.find(
      (u) =>
        u.role === 'seller' &&
        (u.id === sellerId ||
          u.name.toLowerCase() === sellerName.toLowerCase() ||
          u.storeName?.toLowerCase() === sellerName.toLowerCase())
    );
    if (matchedUser) {
      setSelectedUserProfile(matchedUser);
      return;
    }

    const matchedSeller = sellers.find(
      (s) => s.id === sellerId || s.name.toLowerCase() === sellerName.toLowerCase()
    );
    setSelectedUserProfile({
      id: matchedSeller?.id || sellerId || `seller-${sellerName}`,
      name: matchedSeller?.name || sellerName,
      username: matchedSeller?.username || sellerName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      email: matchedSeller?.email || 'boutique@djassa.ci',
      phone: matchedSeller?.phone || '+225 07 00 00 00 00',
      role: 'seller',
      status: 'active',
      avatar: matchedSeller?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      createdAt: '2026-01-15',
      location: matchedSeller?.location || 'Abidjan',
      ordersCount: matchedSeller?.salesCount || 0,
      totalSpentOrEarned: 0,
      kycVerified: matchedSeller?.verified ?? true,
      storeName: matchedSeller?.storeName || sellerName,
      bio: matchedSeller?.bio
    });
  };

  const handleExportCSV = () => {
    const headers = [
      'Commande',
      'Date',
      'Boutique',
      'Client',
      'Mode',
      'Moyen',
      'Statut_Paiement',
      'SousTotal_FCFA',
      'Remise_FCFA',
      'Frais_Client_FCFA',
      'Total_Client_FCFA',
      'Commission_DJASSA_FCFA',
      'Statut_Commission',
      'Net_Vendeur_FCFA',
      'Statut_Reversement_Vendeur'
    ];
    const rows = filteredEntries.map((e) => [
      e.orderNumber,
      formatOrderDate(e.createdAt),
      `"${e.sellerName.replace(/"/g, '""')}"`,
      `"${e.clientName.replace(/"/g, '""')}"`,
      e.paymentMode,
      String(e.paymentMethod),
      e.paymentStatus,
      String(e.subtotal),
      String(e.discount),
      String(e.clientFeeFcfa),
      String(e.total),
      String(e.commissionFcfa),
      e.commissionStatus,
      String(e.sellerNetFcfa),
      e.sellerPayoutStatus
    ]);
    const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Djassa_Commissions_150F_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Tableau des commissions exporté en CSV');
  };

  const stats = summary || {
    totalOrdersCount: entries.length,
    generatedFcfa: 0,
    collectedFcfa: 0,
    pendingFcfa: 0,
    paidFcfa: 0,
    cancelledFcfa: 0
  };

  const receiptSeller = receiptTarget
    ? sellers.find(
        (s) =>
          s.id === receiptTarget.order.sellerId ||
          s.id === receiptTarget.order.items[0]?.sellerId ||
          s.name.toLowerCase() === (receiptTarget.order.items[0]?.sellerName || '').toLowerCase()
      )
    : undefined;

  return (
    <div id="admin-commissions-manager" className="space-y-4 text-white">
      {/* HEADER */}
      <div className="p-4 rounded-2xl bg-[#141417] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#FF6321]" />
            <span>Tableau de Bord des Commissions DJASSA ({DJASSA_FIXED_COMMISSION_FCFA} FCFA / commande)</span>
          </h3>
          <p className="text-xs text-white/55 mt-0.5">
            En ligne : 6,5% frais client + 150 FCFA commission DJASSA + reversement net vendeur · Livraison (COD) : 0% frais client, 150 FCFA en attente jusqu’au règlement vérifié
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void loadCommissions()}
            disabled={loading}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#FF6321] ${loading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-xl bg-[#FF6321] hover:bg-[#ff773b] text-xs font-black text-white flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
        <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10">
          <span className="text-[10px] text-white/50 font-bold block">Générées (actives)</span>
          <p className="text-base sm:text-lg font-black text-white font-mono mt-1">{formatFCFA(stats.generatedFcfa)}</p>
          <span className="text-[10px] text-white/40">{stats.totalOrdersCount} commande(s)</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
          <span className="text-[10px] text-emerald-300 font-bold block">Encaissées (en ligne)</span>
          <p className="text-base sm:text-lg font-black text-emerald-400 font-mono mt-1">{formatFCFA(stats.collectedFcfa)}</p>
          <span className="text-[10px] text-emerald-300/75">Paiement vérifié</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
          <span className="text-[10px] text-amber-300 font-bold block">En attente (COD / attente)</span>
          <p className="text-base sm:text-lg font-black text-amber-400 font-mono mt-1">{formatFCFA(stats.pendingFcfa)}</p>
          <span className="text-[10px] text-amber-300/75">À régulariser</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30">
          <span className="text-[10px] text-sky-300 font-bold block">Payées (COD réglées)</span>
          <p className="text-base sm:text-lg font-black text-sky-400 font-mono mt-1">{formatFCFA(stats.paidFcfa)}</p>
          <span className="text-[10px] text-sky-300/75">Règlement vendeur vérifié</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30">
          <span className="text-[10px] text-rose-300 font-bold block">Annulées</span>
          <p className="text-base sm:text-lg font-black text-rose-400 font-mono mt-1">{formatFCFA(stats.cancelledFcfa)}</p>
          <span className="text-[10px] text-rose-300/75">Exclues des encaissements</span>
        </div>
      </div>

      {/* PER-SELLER BREAKDOWN */}
      {sellerBreakdown.length > 0 && (
        <div className="p-4 rounded-2xl bg-[#141417] border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Store className="w-4 h-4 text-[#FF6321]" />
              <span>Ventilation par vendeur ({sellerBreakdown.length})</span>
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {sellerBreakdown.map((sb) => (
              <div
                key={sb.sellerId || sb.sellerName}
                onClick={() => handleOpenSellerProfile(sb.sellerId, sb.sellerName)}
                className="p-3 rounded-xl bg-black/40 border border-white/10 hover:border-[#FF6321]/40 cursor-pointer transition space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white truncate">{sb.sellerName}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/80 font-mono">
                    {sb.ordersCount} cmd
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[10px] font-mono pt-1 border-t border-white/5">
                  <div>
                    <span className="text-white/45 block">Comm.</span>
                    <span className="text-[#FF6321] font-bold">{formatFCFA(sb.totalCommissionFcfa)}</span>
                  </div>
                  <div>
                    <span className="text-white/45 block">Enc./Payé</span>
                    <span className="text-emerald-400 font-bold">{formatFCFA(sb.collectedFcfa + sb.paidFcfa)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-white/45 block">En attente</span>
                    <span className="text-amber-300 font-bold">{formatFCFA(sb.pendingFcfa)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FILTERS */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par commande, boutique, client ou référence..."
            className="w-full pl-10 pr-4 py-2 bg-[#141417] border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'Tous statuts' },
            { id: 'pending', label: 'En attente' },
            { id: 'collected', label: 'Encaissées' },
            { id: 'paid', label: 'Payées' },
            { id: 'cancelled', label: 'Annulées' }
          ].map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setStatusFilter(st.id as typeof statusFilter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                statusFilter === st.id ? 'bg-[#FF6321] text-white' : 'bg-white/5 text-white/60 hover:text-white'
              }`}
            >
              {st.label}
            </button>
          ))}

          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value as typeof modeFilter)}
            className="px-2.5 py-1.5 rounded-xl bg-[#141417] border border-white/10 text-xs font-bold text-white focus:outline-none"
          >
            <option value="all">Tous modes</option>
            <option value="online">En ligne (6,5%)</option>
            <option value="cod">À la livraison (0%)</option>
          </select>
        </div>
      </div>

      {/* COMMISSION ENTRIES LIST */}
      <div className="space-y-2.5">
        {filteredEntries.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-[#141417] border border-white/10 text-xs text-white/45">
            Aucune commission trouvée pour ces critères.
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const commBadge = getCommissionStatusLabel(entry.commissionStatus);
            const payBadge = OrderService.getPaymentStatusBadge(entry.paymentStatus, entry.paymentMode);
            const payoutBadge = getSellerPayoutStatusLabel(entry.sellerPayoutStatus);
            const canSettleCod =
              entry.paymentMode === 'cod' &&
              entry.commissionStatus === 'pending';

            const commToneCls =
              commBadge.tone === 'emerald'
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : commBadge.tone === 'blue'
                ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                : commBadge.tone === 'rose'
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30';

            return (
              <div
                key={entry.orderId}
                className="p-4 rounded-2xl bg-[#141417] border border-white/10 hover:border-[#FF6321]/35 transition space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-black text-[#FF6321] bg-[#FF6321]/10 px-2 py-0.5 rounded-lg border border-[#FF6321]/25">
                      #{entry.orderNumber}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${commToneCls}`}>
                      Commission : {commBadge.label}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${payBadge.color} ${payBadge.bgColor}`}>
                      {payBadge.label}
                    </span>
                  </div>

                  <span className="text-[11px] text-white/45 font-mono">{formatOrderDate(entry.createdAt)}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div>
                    <span className="text-[10px] text-white/45 block">Boutique & Client</span>
                    <button
                      type="button"
                      onClick={() => handleOpenSellerProfile(entry.sellerId, entry.sellerName)}
                      className="font-bold text-white hover:text-[#FF6321] text-left truncate block max-w-full cursor-pointer"
                    >
                      {entry.sellerName}
                    </button>
                    <span className="text-[10px] text-white/60 block truncate">Client : {entry.clientName}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-white/45 block">Mode / Moyen</span>
                    <span className="font-bold text-white flex items-center gap-1">
                      <CreditCard className="w-3 h-3 text-[#FF6321] shrink-0" />
                      <span className="truncate">{getPaymentModeLabel(entry.paymentMode, entry.paymentMethod)}</span>
                    </span>
                    <span className="text-[10px] text-white/55 block truncate">
                      {getPaymentMethodLabel(entry.paymentMethod, entry.paymentMode)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-white/45 block">Montants commande</span>
                    <span className="font-mono font-bold text-white block">Client : {formatFCFA(entry.total)}</span>
                    <span className="text-[10px] font-mono text-white/55 block">
                      Frais client : {formatFCFA(entry.clientFeeFcfa)} · Net vendeur : {formatFCFA(entry.sellerNetFcfa)}
                    </span>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-white/45 block">Commission DJASSA</span>
                    <span className="text-sm font-black font-mono text-[#FF6321] block">
                      {formatFCFA(entry.commissionFcfa)}
                    </span>
                    <span className="text-[10px] text-white/60 block truncate">{payoutBadge.label}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
                  <div className="text-[10px] font-mono text-white/50">
                    {entry.sellerPayoutReference ? `Réf reversement : ${entry.sellerPayoutReference}` : 'Livraison organisée par le vendeur (0 FCFA DJASSA)'}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleOpenOfficialReceipt(entry)}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Receipt className="w-3.5 h-3.5 text-[#FF6321]" />
                      <span>Reçu officiel (Admin)</span>
                    </button>

                    {canSettleCod && (
                      <button
                        type="button"
                        onClick={() => handleOpenSettleModal(entry)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Régulariser COD (150 F)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* SETTLEMENTS HISTORY */}
      {settlements.length > 0 && (
        <div className="p-4 rounded-2xl bg-[#141417] border border-white/10 space-y-2.5">
          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span>Historique des règlements COD vérifiés ({settlements.length})</span>
          </h4>
          <div className="space-y-2">
            {settlements.map((s) => (
              <div
                key={s.id}
                className="p-3 rounded-xl bg-black/40 border border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div>
                  <p className="font-bold text-white">
                    #{s.orderNumber} · {s.sellerName}
                  </p>
                  <p className="text-[10px] text-white/50 font-mono">
                    Canal : {s.channel} · Réf : {s.providerReference || '—'} · {formatOrderDate(s.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-emerald-400 block">{formatFCFA(s.amountFcfa)}</span>
                  <span className="text-[10px] text-white/60 uppercase">{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VERIFIED MANUAL COD SETTLEMENT MODAL */}
      {settleTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSettleTarget(null)}
        >
          <div
            className="w-full max-w-md bg-[#141414] border border-emerald-500/35 rounded-3xl p-5 space-y-4 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h4 className="text-sm font-black text-white">Régularisation Commission COD</h4>
                <p className="text-[11px] text-white/50 font-mono">
                  #{settleTarget.orderNumber} · {settleTarget.sellerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettleTarget(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCodSettlement} className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1">
                <p className="font-bold text-amber-300">
                  Montant de la commission à encaisser : {formatFCFA(settleTarget.commissionFcfa)}
                </p>
                <p className="text-[11px] text-white/70">
                  Aucune commission COD ne peut être passée à « Payée » sans vérification manuelle et référence opérateur réelle.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-white/70 block mb-1">Canal de règlement</label>
                <select
                  value={settleChannel}
                  onChange={(e) => setSettleChannel(e.target.value as typeof settleChannel)}
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-400"
                >
                  <option value="wave">Wave CI</option>
                  <option value="orange_money">Orange Money CI</option>
                  <option value="manual_verified">Vérification manuelle interne</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-white/70 block mb-1">
                  Référence réelle de transaction (obligatoire)
                </label>
                <input
                  type="text"
                  required
                  value={providerReference}
                  onChange={(e) => setProviderReference(e.target.value)}
                  placeholder="Ex: WAVE-COD-2026-98412"
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-white/70 block mb-1">Notes de contrôle (optionnel)</label>
                <input
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  placeholder="Justification ou trace comptable..."
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <label className="flex items-start gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={verifiedManual}
                  onChange={(e) => setVerifiedManual(e.target.checked)}
                  className="mt-0.5 accent-emerald-500"
                />
                <span className="text-[11px] text-white/85">
                  Je certifie avoir vérifié la réception effective des {formatFCFA(settleTarget.commissionFcfa)} avec la référence ci-dessus.
                </span>
              </label>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSettleTarget(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submittingSettle || !verifiedManual || !providerReference.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black cursor-pointer"
                >
                  {submittingSettle ? 'Validation...' : 'Confirmer le règlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {receiptTarget && (
        <DjassaOfficialReceiptModal
          order={receiptTarget.order}
          seller={receiptSeller}
          receiptDto={receiptTarget.dto}
          perspective="admin"
          onClose={() => setReceiptTarget(null)}
          onShowToast={showToast}
        />
      )}

      {selectedUserProfile && (
        <AdminUserDetailModal
          user={selectedUserProfile}
          onClose={() => setSelectedUserProfile(null)}
        />
      )}
    </div>
  );
};
