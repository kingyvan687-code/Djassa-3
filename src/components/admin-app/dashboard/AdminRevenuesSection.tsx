import React, { useState, useMemo, lazy, Suspense } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowRight,
  CheckCircle2, 
  XCircle, 
  Clock, 
  Smartphone, 
  Sliders, 
  ShieldCheck, 
  Send,
  AlertCircle,
  FileSpreadsheet,
  Crown,
  Percent,
  Megaphone,
  ArrowDownLeft,
  Store,
  Sparkles,
  Search,
  Filter,
  Download,
  Plus,
  RefreshCw,
  Info,
  Calendar,
  Check,
  Zap,
  Tag,
  User
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { formatFCFA, formatOrderDate } from '../../../services/marketServices';
import { INITIAL_BOOST_CAMPAIGNS } from '../../../data/advertisingMockData';
import { AdminBoostCampaign, AdminUserRecord, AdminTabType } from '../../../types';
import {
  INITIAL_SUBSCRIPTIONS,
  INITIAL_WITHDRAWALS,
  type SubscriptionTransaction,
  type WithdrawalRequest,
} from '../../../data/adminMockData';

export {
  INITIAL_SUBSCRIPTIONS,
  INITIAL_WITHDRAWALS,
  type SubscriptionTransaction,
  type WithdrawalRequest,
};

const AdminSubscriptionsManager = lazy(() =>
  import('./AdminSubscriptionsManager').then((m) => ({ default: m.AdminSubscriptionsManager }))
);
const AdminCommissionsManager = lazy(() =>
  import('./AdminCommissionsManager').then((m) => ({ default: m.AdminCommissionsManager }))
);
const AdminUserDetailModal = lazy(() =>
  import('../modals/AdminUserDetailModal').then((m) => ({ default: m.AdminUserDetailModal }))
);

const LazySectionLoader = () => (
  <div className="p-4 rounded-2xl bg-[#141417] border border-white/10 text-xs text-white/50">
    Chargement du module...
  </div>
);

interface AdminRevenuesSectionProps {
  onNavigateTab?: (tab: AdminTabType) => void;
}

export const AdminRevenuesSection: React.FC<AdminRevenuesSectionProps> = ({ onNavigateTab }) => {
  const { orders, platformConfig, updatePlatformConfig, addAuditLog, showToast, sellers, adminUsers } = useApp();

  // Selected User Profile for Modal
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<AdminUserRecord | null>(null);

  const handleOpenProfile = (name: string, role: 'seller' | 'client', phone?: string) => {
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    const cleanName = name.toLowerCase();

    const matchedUser = adminUsers.find(u => {
      const cleanUserPhone = u.phone.replace(/\D/g, '');
      if (cleanPhone && cleanUserPhone && cleanPhone === cleanUserPhone) return true;
      if (u.name.toLowerCase() === cleanName) return true;
      if (u.storeName && cleanName.includes(u.storeName.toLowerCase())) return true;
      if (cleanName.includes(u.name.toLowerCase())) return true;
      return false;
    });

    if (matchedUser) {
      setSelectedUserForProfile(matchedUser);
      showToast(`Profil de ${matchedUser.name} ouvert 👤`);
      return;
    }

    if (role === 'seller') {
      const matchedSeller = sellers.find(s => cleanName.includes(s.name.toLowerCase()) || (s.storeName && cleanName.includes(s.storeName.toLowerCase())));
      const generated: AdminUserRecord = {
        id: `user-seller-${matchedSeller?.id || Date.now()}`,
        name: matchedSeller?.name || name,
        username: matchedSeller?.username || name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 18),
        email: matchedSeller?.email || `contact@djassa.ci`,
        phone: phone || matchedSeller?.phone || '+225 07 00 00 00 00',
        role: 'seller',
        status: 'active',
        avatar: matchedSeller?.avatar || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200',
        createdAt: '2026-01-15',
        registeredDaysAgo: 240,
        location: matchedSeller?.location || 'Adjamé Forum des Marchés, Abidjan',
        ordersCount: matchedSeller?.salesCount || 240,
        totalSpentOrEarned: 2450000,
        kycVerified: true,
        storeName: matchedSeller?.storeName || name,
        bio: matchedSeller?.bio || 'Vendeur officiel sur Djassa',
        dailyAverageMinutes: 180,
        timeTodayMinutes: 120
      };
      setSelectedUserForProfile(generated);
      showToast(`Profil du vendeur ${generated.name} ouvert 👤`);
      return;
    }

    const generated: AdminUserRecord = {
      id: `user-${role}-${Date.now()}`,
      name,
      username: name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 18),
      email: `contact@djassa.ci`,
      phone: phone || '+225 07 00 00 00 00',
      role,
      status: 'active',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      createdAt: '2026-02-01',
      registeredDaysAgo: 220,
      location: 'Abidjan',
      ordersCount: 15,
      totalSpentOrEarned: 150000,
      kycVerified: true,
      dailyAverageMinutes: 60,
      timeTodayMinutes: 30
    };
    setSelectedUserForProfile(generated);
    showToast(`Profil de ${generated.name} ouvert 👤`);
  };

  // Active revenue sub-tab: 'subscriptions' | 'commissions' | 'withdrawals' | 'ads' | 'settings' | 'overview'
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'subscriptions' | 'commissions' | 'withdrawals' | 'ads' | 'settings'>('commissions');

  // Subscriptions state
  const [subscriptions, setSubscriptions] = useState<SubscriptionTransaction[]>(() => {
    try {
      const saved = localStorage.getItem('djassa_admin_subscriptions');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : INITIAL_SUBSCRIPTIONS;
    } catch {
      return INITIAL_SUBSCRIPTIONS;
    }
  });

  // Withdrawals state
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>(() => {
    try {
      const saved = localStorage.getItem('djassa_admin_withdrawals');
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed)) {
        return parsed.map(item => {
          const feeAmount = Math.round((item.amount || 0) * 0.066) + 150;
          const netAmount = Math.max(0, (item.amount || 0) - feeAmount);
          return {
            ...item,
            feeAmount,
            netAmount
          };
        });
      }
    } catch {
      // fallback
    }
    return INITIAL_WITHDRAWALS;
  });

  // Ads campaigns state
  const [campaigns, setCampaigns] = useState<AdminBoostCampaign[]>(() => {
    try {
      const saved = localStorage.getItem('djassa_admin_boost_campaigns');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : INITIAL_BOOST_CAMPAIGNS;
    } catch {
      return INITIAL_BOOST_CAMPAIGNS;
    }
  });

  // Tarifs centralisés (150 FCFA fixe DJASSA par commande vendeur, 6,5% frais paiement en ligne client)
  const [sellerCommissionRate, setSellerCommissionRate] = useState<number>(platformConfig.sellerCommissionRate ?? 150);
  const [clientOnlineFeeRate, setClientOnlineFeeRate] = useState<number>(platformConfig.clientOnlineFeeRate ?? 6.5);
  const [withdrawalFeeRate, setWithdrawalFeeRate] = useState<number>(platformConfig.withdrawalFeeRate ?? 10);
  const [baseDelivery, setBaseDelivery] = useState<number>(platformConfig.baseDeliveryFee ?? 0);
  const [minWithdrawal, setMinWithdrawal] = useState<number>(platformConfig.minWithdrawalAmount || 5000);

  // Filters & search
  const [searchTerm, setSearchTerm] = useState('');
  const [withdrawalFilter, setWithdrawalFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [subscriptionRoleFilter, setSubscriptionRoleFilter] = useState<'all' | 'client' | 'seller'>('all');

  // Save helpers
  const saveWithdrawals = (next: WithdrawalRequest[]) => {
    setWithdrawals(next);
    localStorage.setItem('djassa_admin_withdrawals', JSON.stringify(next));
  };

  const saveSubscriptions = (next: SubscriptionTransaction[]) => {
    setSubscriptions(next);
    localStorage.setItem('djassa_admin_subscriptions', JSON.stringify(next));
  };

  // ===========================================================================
  // 1. REVENUE CALCULATIONS FOR THE 4 CHANNELS
  // ===========================================================================

  // Channel 1: Abonnements & Packs IA
  const totalSubscriptionRevenue = useMemo(() => {
    return subscriptions.reduce((sum, s) => sum + s.amount, 0);
  }, [subscriptions]);

  // Channel 2: Commissions Ventes DJASSA (150 FCFA fixe par commande confirmée)
  const commissionCalculations = useMemo(() => {
    let totalGMV = 0;
    let totalSellerCommissions = 0;

    const detailedOrders = orders.map((order) => {
      const orderSubtotal = order.subtotal || order.total || 0;
      totalGMV += order.total || 0;

      // Règle unifiée : forfait fixe de 150 FCFA prélevé sur chaque commande vendeur
      const sellerComm =
        sellerCommissionRate >= 50
          ? Math.round(sellerCommissionRate)
          : Math.round(orderSubtotal * (sellerCommissionRate / 100));

      totalSellerCommissions += sellerComm;

      const primarySeller = sellers.find(s => s.id === order.items?.[0]?.sellerId) || {
        name: order.items?.[0]?.sellerName || 'Marchand Adjamé'
      };

      return {
        order,
        sellerName: primarySeller.name,
        sellerComm,
        totalPlatformComm: sellerComm
      };
    });

    return {
      totalGMV,
      totalSellerCommissions,
      totalCommissionsRevenue: totalSellerCommissions,
      detailedOrders
    };
  }, [orders, sellerCommissionRate, sellers]);

  // Channel 3: Frais de Retraits (10% facturé sur chaque retrait)
  const withdrawalCalculations = useMemo(() => {
    const totalWithdrawalVolume = withdrawals.reduce((sum, w) => sum + w.amount, 0);
    // 10% de frais facturé par l'application pour chaque retrait
    const totalWithdrawalFeesCollected = withdrawals
      .filter(w => w.status === 'approved')
      .reduce((sum, w) => sum + w.feeAmount, 0);

    const pendingPayouts = withdrawals
      .filter(w => w.status === 'pending')
      .reduce((sum, w) => sum + w.netAmount, 0);

    const pendingFees = withdrawals
      .filter(w => w.status === 'pending')
      .reduce((sum, w) => sum + w.feeAmount, 0);

    return {
      totalWithdrawalVolume,
      totalWithdrawalFeesCollected,
      pendingPayouts,
      pendingFees,
      totalCount: withdrawals.length,
      rejectedCount: withdrawals.filter(w => w.status === 'rejected').length
    };
  }, [withdrawals]);

  // Channel 4: Revenus des Publicités
  const totalAdvertisingRevenue = useMemo(() => {
    return campaigns.reduce((sum, c) => sum + (c.budgetFCFA || 0), 0);
  }, [campaigns]);

  // GRAND TOTAL: Caisse globale de l'application
  const grandTotalPlatformRevenue = useMemo(() => {
    return (
      totalSubscriptionRevenue +
      commissionCalculations.totalCommissionsRevenue +
      withdrawalCalculations.totalWithdrawalFeesCollected +
      totalAdvertisingRevenue
    );
  }, [
    totalSubscriptionRevenue,
    commissionCalculations.totalCommissionsRevenue,
    withdrawalCalculations.totalWithdrawalFeesCollected,
    totalAdvertisingRevenue
  ]);

  // ===========================================================================
  // HANDLERS
  // ===========================================================================

  const handleApproveWithdrawal = (item: WithdrawalRequest) => {
    const next = withdrawals.map((w) =>
      w.id === item.id 
        ? { 
            ...w, 
            status: 'approved' as const, 
            reference: `${item.network.toUpperCase()}-PAY-${Date.now().toString().slice(-4)}` 
          } 
        : w
    );
    saveWithdrawals(next);
    addAuditLog(
      'Validation Retrait (10% Frais Prélevé)',
      item.name,
      'financial',
      `Retrait brut: ${formatFCFA(item.amount)} • Frais 10% encaissés: ${formatFCFA(item.feeAmount)} • Net viré: ${formatFCFA(item.netAmount)} via ${item.network}`
    );
    showToast(`✅ Virement de ${formatFCFA(item.netAmount)} approuvé pour ${item.name} (${formatFCFA(item.feeAmount)} de frais 10% encaissés par Djassa) 💸`);
  };

  const handleRejectWithdrawal = (item: WithdrawalRequest) => {
    const next = withdrawals.map((w) =>
      w.id === item.id ? { ...w, status: 'rejected' as const } : w
    );
    saveWithdrawals(next);
    addAuditLog(
      'Refus Retrait de Fonds',
      item.name,
      'financial',
      `Demande de ${formatFCFA(item.amount)} rejetée (justificatif ou solde insuffisant)`
    );
    showToast(`Demande de retrait ${item.id} rejetée.`);
  };

  const handleSaveRates = (e: React.FormEvent) => {
    e.preventDefault();
    updatePlatformConfig({
      marketplaceCommissionRate: sellerCommissionRate,
      sellerCommissionRate,
      clientOnlineFeeRate,
      withdrawalFeeRate,
      baseDeliveryFee: baseDelivery,
      minWithdrawalAmount: minWithdrawal
    });
    addAuditLog(
      'Mise à Jour Taux Financiers',
      'Configuration Monétaire',
      'financial',
      `Commission Vendeur: ${sellerCommissionRate} F • Frais client en ligne: ${clientOnlineFeeRate}% • Frais Retrait: ${withdrawalFeeRate}%`
    );
    showToast(`Taux financiers enregistrés : ${sellerCommissionRate} F vendeur, ${clientOnlineFeeRate}% en ligne ✅`);
  };

  // Export CSV Ledger
  const handleExportCSV = () => {
    const rows = [
      ['TYPE DE REVENU', 'REFERENCE', 'BENEFICIAIRE / ANNONCEUR', 'DATE', 'MONTANT BRUT (FCFA)', 'TAUX APPLIQUE', 'REVENU NET DJASSA (FCFA)'],
      // Abonnements
      ...subscriptions.map(s => ['Abonnement', s.reference, s.subscriberName, s.date, String(s.amount), s.planName, String(s.amount)]),
      // Commissions Ventes
      ...commissionCalculations.detailedOrders.map(d => [
        'Commission Vente',
        d.order.orderNumber,
        `Vendeur: ${d.sellerName}`,
        (d.order as any).date || (d.order as any).createdAt || 'Aujourd’hui',
        String(d.order.total),
        `Commission fixe (${d.sellerComm} F)`,
        String(d.totalPlatformComm)
      ]),
      // Retraits
      ...withdrawals.filter(w => w.status === 'approved').map(w => [
        'Frais de Retrait',
        w.reference || w.id,
        w.name,
        w.date,
        String(w.amount),
        '10% Frais de décaissement',
        String(w.feeAmount)
      ]),
      // Publicités
      ...campaigns.map(c => [
        'Publicite & Boost',
        c.id,
        c.sellerName,
        c.startDate,
        String(c.budgetFCFA),
        c.placement,
        String(c.budgetFCFA)
      ])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(';')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Djassa_Grand_Livre_Revenus_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Grand livre financier exporté en CSV avec succès 📊');
  };

  return (
    <div className="space-y-4 text-white">





      {/* =======================================================================
          VIEW 2: TYPE 1 - REVENUS DES ABONNEMENTS
          ======================================================================= */}
      {activeSubTab === 'subscriptions' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Main Plan & Subscriber Manager Suite */}
          <Suspense fallback={<LazySectionLoader />}>
            <AdminSubscriptionsManager onBack={() => setActiveSubTab('overview')} />
          </Suspense>
        </div>
      )}

      {/* =======================================================================
          VIEW 3: TYPE 2 - COMMISSIONS FIXES SUR CHAQUE VENTE (150 FCFA)
          ======================================================================= */}
      {activeSubTab === 'commissions' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <Suspense fallback={<LazySectionLoader />}>
            <AdminCommissionsManager onNavigateTab={onNavigateTab} />
          </Suspense>
        </div>
      )}

      {/* =======================================================================
          VIEW 4: TYPE 3 - REVENUS RETRAITS
          ======================================================================= */}
      {activeSubTab === 'withdrawals' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Rule Explanatory Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/60 via-[#141417] to-neutral-900 border border-cyan-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-bold">
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">
                    Flux de Revenus 3 : Frais de Décaissement &amp; Retraits Marchands
                  </h3>
                  <p className="text-[11px] text-cyan-400/90 font-medium">
                    Suivi des retraits marchands via Wave et Orange Money
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-black uppercase">
                Wave &amp; OM
              </span>
            </div>

            <p className="text-xs text-white/70 leading-relaxed pt-1">
              Les vendeurs perçoivent leurs versements en ligne directement sur leur compte Wave ou Orange Money.
              <br />• <strong>Montant Brut</strong> : Solde débité du compte marchand.
              <br />• <strong>Frais Passerelle &amp; Plateforme</strong> : Prélevés automatiquement selon la grille officielle.
              <br />• <strong>Net Versé</strong> : Montant transféré sur le compte Mobile Money du marchand.
            </p>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30">
              <span className="text-[10px] text-indigo-300 font-bold block">Nombre de Retraits</span>
              <span className="text-sm font-black text-indigo-300">{withdrawalCalculations.totalCount}</span>
            </div>
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30">
              <span className="text-[10px] text-rose-300 font-bold block">Nombre d'Échecs</span>
              <span className="text-sm font-black text-rose-400">{withdrawalCalculations.rejectedCount}</span>
            </div>
            <div className="p-3 rounded-2xl bg-[#141417] border border-white/10">
              <span className="text-[10px] text-white/40 block">Total Retraits Demandés</span>
              <span className="text-sm font-black text-white">{formatFCFA(withdrawalCalculations.totalWithdrawalVolume)}</span>
            </div>
            <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30">
              <span className="text-[10px] text-cyan-300 font-bold block">Frais 10% Encaissés Djassa</span>
              <span className="text-sm font-black text-cyan-400">{formatFCFA(withdrawalCalculations.totalWithdrawalFeesCollected)}</span>
            </div>
            <div className="p-3 rounded-2xl bg-[#141417] border border-white/10">
              <span className="text-[10px] text-white/40 block">Net Reversé aux Acteurs (90%)</span>
              <span className="text-sm font-black text-emerald-400">
                {formatFCFA(withdrawalCalculations.totalWithdrawalVolume - withdrawalCalculations.totalWithdrawalFeesCollected)}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <span className="text-[10px] text-amber-300 font-bold block">En Attente de Traitement</span>
              <span className="text-sm font-black text-amber-300">
                {withdrawals.filter(w => w.status === 'pending').length} demande(s)
              </span>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10 self-start">
            {[
              { id: 'all', label: `Tous (${withdrawals.length})` },
              { id: 'pending', label: `⏳ En Attente (${withdrawals.filter(w => w.status === 'pending').length})` },
              { id: 'approved', label: '✅ Approuvés' },
              { id: 'rejected', label: '❌ Rejetés' }
            ].map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setWithdrawalFilter(btn.id as any)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition ${
                  withdrawalFilter === btn.id
                    ? 'bg-cyan-600 text-white'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Withdrawals List */}
          <div className="space-y-2">
            {withdrawals
              .filter(w => withdrawalFilter === 'all' || w.status === withdrawalFilter)
              .map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 bg-[#141417] rounded-2xl border border-white/10 hover:border-cyan-500/30 transition flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleOpenProfile(item.name, item.role, item.phone)}
                        className="text-xs font-black text-white hover:text-cyan-300 transition text-left cursor-pointer hover:underline"
                        title={`Voir le profil de ${item.name}`}
                      >
                        {item.name}
                      </button>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase bg-amber-500/20 text-amber-300">
                        Marchand
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/15">
                        {item.network} • {item.phone}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenProfile(item.name, item.role, item.phone)}
                        className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition flex items-center gap-1 cursor-pointer"
                      >
                        <User className="w-2.5 h-2.5 text-cyan-400" />
                        <span>Profil</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-white/50">
                      <span>Réf: {item.reference || item.id}</span>
                      <span>•</span>
                      <span>{item.date}</span>
                    </div>
                  </div>

                  {/* Calculations Display: Brut -> 10% Fee -> Net */}
                  <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t border-white/5 md:border-0">
                    <div className="text-left md:text-right">
                      <div className="flex items-center gap-2 md:justify-end">
                        <span className="text-xs text-white/40 line-through">Brut: {formatFCFA(item.amount)}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                          -10% Frais: {formatFCFA(item.feeAmount)}
                        </span>
                      </div>
                      <div className="text-sm font-black text-white mt-0.5">
                        Net versé: <span className="text-emerald-400">{formatFCFA(item.netAmount)}</span>
                      </div>
                    </div>

                    {item.status === 'pending' ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleApproveWithdrawal(item)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-[10px] font-bold flex items-center gap-1 shadow-md transition cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Valider (Encaisser 10%)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectWithdrawal(item)}
                          className="px-2.5 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl text-[10px] font-bold transition"
                          title="Rejeter la demande"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.status === 'approved'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {item.status === 'approved' ? '✓ Virement validé' : '✗ Refusé'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* =======================================================================
          VIEW 5: TYPE 4 - REVENUS DES PUBLICITÉS
          ======================================================================= */}
      {activeSubTab === 'ads' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="p-4 rounded-2xl bg-[#141417] border border-white/10 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-amber-400" />
                  <span>Flux de Revenus 4 : Publicités, Boosts & Sponsoring</span>
                </h3>
                <p className="text-[11px] text-white/50 mt-0.5">
                  Revenus générés par les bannières d'accueil, le top du fil TikTok et les recherches sponsorisées
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-white/40 block">Total Recettes Publicitaires</span>
                <span className="text-base font-black text-amber-400">{formatFCFA(totalAdvertisingRevenue)}</span>
              </div>
            </div>

            {/* Quick ad formats showcase */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/5">
              <div className="p-2.5 rounded-xl bg-white/[0.03]">
                <span className="text-[10px] text-white/40 block">Bannière VIP Hero</span>
                <span className="text-xs font-bold text-white">35 000 FCFA / 10 jours</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03]">
                <span className="text-[10px] text-white/40 block">Top Feed Vidéo</span>
                <span className="text-xs font-bold text-white">25 000 FCFA / 7 jours</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03]">
                <span className="text-[10px] text-white/40 block">Top Recherche</span>
                <span className="text-xs font-bold text-white">15 000 FCFA / 3 jours</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03]">
                <span className="text-[10px] text-white/40 block">Badge Certifié</span>
                <span className="text-xs font-bold text-white">20 000 FCFA / 7 jours</span>
              </div>
            </div>
          </div>

          {/* Campaigns Ledger */}
          <div className="space-y-2">
            {campaigns.map((camp) => (
              <div
                key={camp.id}
                className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 hover:border-amber-500/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={camp.targetImage}
                    alt={camp.title}
                    className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white">{camp.title}</h4>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase bg-emerald-500/20 text-emerald-300">
                        {camp.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/50 mt-0.5">
                      <span>Annonceur: <strong>{camp.sellerName}</strong></span>
                      <span>•</span>
                      <span>{camp.impressionsCount.toLocaleString()} vues</span>
                      <span>•</span>
                      <span>{camp.clicksCount.toLocaleString()} clics</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t border-white/5 sm:border-0">
                  <div className="text-left sm:text-right">
                    <div className="text-sm font-black text-amber-400">{formatFCFA(camp.budgetFCFA)}</div>
                    <span className="text-[10px] text-white/40">100% encaissé d'avance</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =======================================================================
          VIEW 6: SETTINGS & TARIFS FINANCIERS
          ======================================================================= */}
      {activeSubTab === 'settings' && (
        <form onSubmit={handleSaveRates} className="p-4 sm:p-5 rounded-2xl bg-[#141417] border border-white/10 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#FF6321]" />
              <div>
                <h3 className="text-sm font-black text-white">Paramétrage des Taux et Commissions Plateforme</h3>
                <p className="text-xs text-white/50">Ajustez les taux appliqués sur les ventes, retraits et livraisons</p>
              </div>
            </div>
            <span className="text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              Synchronisation Immédiate
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Seller commission */}
            <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5">
              <label className="text-[11px] font-bold text-white flex items-center justify-between">
                <span>Commission Vendeur sur Vente</span>
                <span className="text-emerald-400 font-mono font-black">
                  {sellerCommissionRate >= 50 ? `${sellerCommissionRate} F fixe` : `${sellerCommissionRate}%`}
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="5000"
                  value={sellerCommissionRate}
                  onChange={(e) => setSellerCommissionRate(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#1A1A1E] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-emerald-500 focus:outline-none"
                />
                <span className="absolute right-3 top-2 text-xs text-emerald-400 font-bold">
                  {sellerCommissionRate >= 50 ? 'FCFA' : '%'}
                </span>
              </div>
              <p className="text-[10px] text-white/40">Prélevé sur chaque commande vendeur</p>
            </div>

            {/* Client online fee */}
            <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5">
              <label className="text-[11px] font-bold text-white flex items-center justify-between">
                <span>Frais Paiement en Ligne (Client)</span>
                <span className="text-cyan-400 font-mono font-black">{clientOnlineFeeRate}%</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="15"
                  value={clientOnlineFeeRate}
                  onChange={(e) => setClientOnlineFeeRate(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#1A1A1E] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-cyan-500 focus:outline-none"
                />
                <span className="absolute right-3 top-2 text-xs text-cyan-400 font-bold">%</span>
              </div>
              <p className="text-[10px] text-white/40">6,5% en ligne (Wave / OM) • 0% à la livraison</p>
            </div>

            {/* Withdrawal fee */}
            <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5">
              <label className="text-[11px] font-bold text-white flex items-center justify-between">
                <span>Frais de Retrait (Orange/Wave/MTN/Moov)</span>
                <span className="text-purple-400 font-mono font-black">{withdrawalFeeRate}%</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="25"
                  value={withdrawalFeeRate}
                  onChange={(e) => setWithdrawalFeeRate(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#1A1A1E] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-purple-500 focus:outline-none"
                />
                <span className="absolute right-3 top-2 text-xs text-purple-400 font-bold">%</span>
              </div>
              <p className="text-[10px] text-white/40">Taux officiel retenu côté serveur sur chaque retrait</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5">
              <label className="text-[11px] font-bold text-white block">Frais de livraison DJASSA (FCFA — Vendeur gère en externe)</label>
              <input
                type="number"
                step="100"
                min="0"
                value={baseDelivery}
                onChange={(e) => setBaseDelivery(parseInt(e.target.value) || 0)}
                className="w-full bg-[#1A1A1E] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-[#FF6321] focus:outline-none"
              />
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5">
              <label className="text-[11px] font-bold text-white block">Seuil minimal de retrait (FCFA)</label>
              <input
                type="number"
                step="500"
                min="1000"
                value={minWithdrawal}
                onChange={(e) => setMinWithdrawal(parseInt(e.target.value) || 0)}
                className="w-full bg-[#1A1A1E] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:border-[#FF6321] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#FF6321] hover:bg-[#ff7738] active:scale-95 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-orange-600/30 transition cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Enregistrer la Grille des 4 Revenus</span>
            </button>
          </div>
        </form>
      )}

      {/* Modal Détails Profil Vendeur / Client */}
      {selectedUserForProfile && (
        <Suspense fallback={null}>
          <AdminUserDetailModal
            user={selectedUserForProfile}
            onClose={() => setSelectedUserForProfile(null)}
          />
        </Suspense>
      )}
    </div>
  );
};
