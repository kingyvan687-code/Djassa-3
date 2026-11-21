import React, { useState, useMemo, lazy, Suspense } from 'react';
import { 
  Layers, 
  Wallet, 
  AlertTriangle, 
  Users, 
  ShoppingBag, 
  Film, 
  Megaphone, 
  Cpu, 
  DollarSign, 
  ShieldCheck, 
  ShieldAlert, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  Plus, 
  RefreshCw, 
  ArrowUpRight, 
  Sliders, 
  ExternalLink,
  AlertCircle,
  Truck,
  Sparkles,
  UserCheck,
  Zap,
  Phone,
  MessageCircle,
  Navigation,
  RotateCcw,
  Copy,
  Check,
  Crown,
  ArrowDownLeft,
  Scale
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { AdminTabType, Order } from '../../../types';
import { formatFCFA } from '../../../services/marketServices';
import { INITIAL_SUBSCRIPTIONS, INITIAL_WITHDRAWALS } from '../../../data/adminMockData';
import { INITIAL_BOOST_CAMPAIGNS } from '../../../data/advertisingMockData';

const AdminRevenuesSection = lazy(() =>
  import('../dashboard/AdminRevenuesSection').then((m) => ({ default: m.AdminRevenuesSection }))
);
const AdminSubscriptionsManager = lazy(() =>
  import('../dashboard/AdminSubscriptionsManager').then((m) => ({ default: m.AdminSubscriptionsManager }))
);
const AdminWithdrawalsSection = lazy(() =>
  import('../dashboard/AdminWithdrawalsSection').then((m) => ({ default: m.AdminWithdrawalsSection }))
);
const AdminProblemsSection = lazy(() =>
  import('../dashboard/AdminProblemsSection').then((m) => ({ default: m.AdminProblemsSection }))
);
const AdminUsersSection = lazy(() =>
  import('../dashboard/AdminUsersSection').then((m) => ({ default: m.AdminUsersSection }))
);
const AdminOrdersSection = lazy(() =>
  import('../dashboard/AdminOrdersSection').then((m) => ({ default: m.AdminOrdersSection }))
);
const AdminMediaSection = lazy(() =>
  import('../dashboard/AdminMediaSection').then((m) => ({ default: m.AdminMediaSection }))
);
const AdminPromosSection = lazy(() =>
  import('../dashboard/AdminPromosSection').then((m) => ({ default: m.AdminPromosSection }))
);
const AdminApiSection = lazy(() =>
  import('../dashboard/AdminApiSection').then((m) => ({ default: m.AdminApiSection }))
);
const AdminHistorySection = lazy(() =>
  import('../dashboard/AdminHistorySection').then((m) => ({ default: m.AdminHistorySection }))
);
const AdminDisputesModule = lazy(() =>
  import('../disputes/AdminDisputesModule').then((m) => ({ default: m.AdminDisputesModule }))
);
const AdminRefundsModule = lazy(() =>
  import('../refunds/AdminRefundsModule').then((m) => ({ default: m.AdminRefundsModule }))
);

const DashboardSectionFallback = () => (
  <div className="p-6 rounded-2xl bg-[#141417] border border-white/10 flex items-center justify-center gap-2 text-xs text-white/60">
    <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-emerald-400 animate-spin" />
    <span>Chargement de la section...</span>
  </div>
);

interface DashboardTabProps {
  onNavigateTab: (tab: AdminTabType) => void;
  onSelectOrder: (order: Order) => void;
}

export type AdminDashboardView = 
  | 'overview' 
  | 'revenues' 
  | 'subscriptions'
  | 'withdrawals'
  | 'problems' 
  | 'users' 
  | 'orders' 
  | 'media' 
  | 'promos' 
  | 'api'
  | 'history'
  | 'disputes'
  | 'refunds';

export const DashboardTab: React.FC<DashboardTabProps> = ({
  onNavigateTab,
  onSelectOrder
}) => {
  const { 
    orders, 
    products,
    adminUsers, 
    sellers, 
    platformConfig, 
    auditLogs,
    showToast,
    addAuditLog 
  } = useApp();

  // Active view tab (Defaults to revenues)
  const [activeSection, setActiveSection] = useState<AdminDashboardView>('revenues');
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  const handleCopyNumber = (e: React.MouseEvent, refNumber: string) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(refNumber);
    setCopiedRef(refNumber);
    showToast(`Réf #${refNumber} copiée !`);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  // Financial calculations: Commission fixe unique de 150 FCFA par commande (payée par le vendeur)
  const platformCommissions = useMemo(() => {
    let sellerComm = 0;
    orders.forEach((order) => {
      if (order.status !== 'cancelled' && (order as any).status !== 'refunded') {
        sellerComm += Number((order as any).commissionFcfa || 150);
      }
    });
    return sellerComm || (orders.length > 0 ? orders.length * 150 : 0);
  }, [orders]);

  // Abonnements
  const subscriptionRevenue = useMemo(() => {
    try {
      const saved = localStorage.getItem('djassa_admin_subscriptions');
      const list = saved ? JSON.parse(saved) : INITIAL_SUBSCRIPTIONS;
      return list.reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
    } catch {
      return INITIAL_SUBSCRIPTIONS.reduce((sum, s) => sum + s.amount, 0);
    }
  }, []);

  // Frais de paiement en ligne / retraits (Wave & Orange Money)
  const withdrawalFees = useMemo(() => {
    try {
      const saved = localStorage.getItem('djassa_admin_withdrawals');
      const list = saved ? JSON.parse(saved) : INITIAL_WITHDRAWALS;
      return list
        .filter((w: any) => w.status === 'approved')
        .reduce((sum: number, w: any) => sum + (w.feeAmount || 0), 0);
    } catch {
      return INITIAL_WITHDRAWALS.filter((w) => w.status === 'approved').reduce((sum, w) => sum + w.feeAmount, 0);
    }
  }, []);

  // Publicités & Boosts
  const advertisingRevenue = useMemo(() => {
    try {
      const saved = localStorage.getItem('djassa_admin_boost_campaigns');
      const list = saved ? JSON.parse(saved) : INITIAL_BOOST_CAMPAIGNS;
      return list.reduce((sum: number, c: any) => sum + (c.budgetFCFA || 0), 0);
    } catch {
      return INITIAL_BOOST_CAMPAIGNS.reduce((sum, c) => sum + (c.budgetFCFA || 0), 0);
    }
  }, []);

  // Total d'argent gagné par Djassa
  const totalMoneyEarned = useMemo(() => {
    return platformCommissions + subscriptionRevenue + withdrawalFees + advertisingRevenue;
  }, [platformCommissions, subscriptionRevenue, withdrawalFees, advertisingRevenue]);

  // Orders calculations
  const activeOrders = useMemo(() => {
    return orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled');
  }, [orders]);

  // Pending KYC users
  const pendingKycUsers = useMemo(() => {
    return adminUsers.filter((u) => u.status === 'pending_verification' || !u.kycVerified);
  }, [adminUsers]);

  // Open problems & disputes
  const openProblemsCount = 3; // From initial mock issues
  const flaggedMediaCount = 1;

  // Tabs configuration
  const navigationTabs: { id: AdminDashboardView; label: string; icon: React.ReactNode; badge?: number | string | null }[] = [
    { id: 'revenues', label: 'Revenus', icon: <Wallet className="w-3.5 h-3.5" /> },
    { id: 'promos', label: 'Promo & Pub', icon: <Megaphone className="w-3.5 h-3.5" /> },
    { id: 'api', label: 'Conso API', icon: <Cpu className="w-3.5 h-3.5" /> },
  ];

  return (
    <div
      id="admin-dashboard-screen"
      className="w-full h-full bg-[#0A0A0A] text-white flex flex-col overflow-y-auto no-scrollbar pb-24 select-none"
    >
      <div className="p-3 sm:p-4 space-y-4">
        {/* 1. CARTE TOTALE D'ARGENT GAGNÉ (Revenus globaux générés par l'application) */}
        <div
          id="kpi-card-admin-total-earnings"
          onClick={() => setActiveSection('revenues')}
          className="relative p-5 sm:p-6 rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/80 via-[#101914] to-neutral-950 shadow-2xl shadow-emerald-950/50 cursor-pointer overflow-hidden transition-all duration-300 hover:border-emerald-400 group"
        >
          {/* Subtle background glow */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none group-hover:bg-emerald-500/25 transition-all" />

          <div className="relative z-10 space-y-1">
            <p className="text-xs sm:text-sm font-semibold text-white/60">
              Total d'argent gagné par Djassa
            </p>
            <h2 className="text-2xl sm:text-4xl font-black text-white font-mono tracking-tight text-emerald-300 drop-shadow-md">
              {formatFCFA(totalMoneyEarned)}
            </h2>
          </div>
        </div>

        {/* 2. MAIN NAVIGATION TABS (Exact Seller Boutique Tabs Design) */}
        <div className="border-t border-b border-white/10 flex bg-[#0A0A0A]/95 backdrop-blur-md sticky top-0 z-20 overflow-x-auto no-scrollbar">
          {/* Tab 1: Revenus & Caisse */}
          <button
            id="tab-btn-admin-revenues"
            type="button"
            onClick={() => setActiveSection('revenues')}
            className={`px-3.5 py-3 text-xs font-bold flex items-center justify-center gap-2 transition whitespace-nowrap shrink-0 group ${
              activeSection === 'revenues'
                ? 'text-emerald-400 border-b-2 border-emerald-400'
                : 'text-white/45 hover:text-white/75 border-b-2 border-transparent'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className={`w-4 h-4 filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] transition-all group-hover:scale-110 ${
                activeSection === 'revenues'
                  ? 'fill-emerald-400/30 stroke-emerald-400 stroke-[2]'
                  : 'fill-none stroke-current stroke-[2]'
              }`}
            >
              <rect x="2" y="5" width="20" height="14" rx="3" />
              <path d="M16 12h4" />
              <circle cx="18" cy="12" r="1" className={activeSection === 'revenues' ? 'fill-emerald-400' : 'fill-current'} />
            </svg>
            <span>Revenus & Caisse</span>
          </button>

          {/* Tab 2: Abonnements */}
          <button
            id="tab-btn-admin-subscriptions"
            type="button"
            onClick={() => setActiveSection('subscriptions')}
            className={`px-3.5 py-3 text-xs font-bold flex items-center justify-center gap-2 transition whitespace-nowrap shrink-0 group ${
              activeSection === 'subscriptions'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-white/45 hover:text-white/75 border-b-2 border-transparent'
            }`}
          >
            <Crown className={`w-4 h-4 filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] transition-all group-hover:scale-110 ${
              activeSection === 'subscriptions' ? 'text-indigo-400' : 'text-current'
            }`} />
            <span>Abonnements</span>
          </button>

          {/* Tab 3: Revenu de Retrait */}
          <button
            id="tab-btn-admin-withdrawals"
            type="button"
            onClick={() => setActiveSection('withdrawals')}
            className={`px-3.5 py-3 text-xs font-bold flex items-center justify-center gap-2 transition whitespace-nowrap shrink-0 group ${
              activeSection === 'withdrawals'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-white/45 hover:text-white/75 border-b-2 border-transparent'
            }`}
          >
            <ArrowDownLeft className={`w-4 h-4 filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] transition-all group-hover:scale-110 ${
              activeSection === 'withdrawals' ? 'text-cyan-400' : 'text-current'
            }`} />
            <span>Revenu de Retrait</span>
          </button>

          {/* Tab 4: Promo & Publicité */}
          <button
            id="tab-btn-admin-promos"
            type="button"
            onClick={() => setActiveSection('promos')}
            className={`px-3.5 py-3 text-xs font-bold flex items-center justify-center gap-2 transition whitespace-nowrap shrink-0 group ${
              activeSection === 'promos'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-white/45 hover:text-white/75 border-b-2 border-transparent'
            }`}
          >
            <Megaphone className={`w-4 h-4 filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] transition-all group-hover:scale-110 ${
              activeSection === 'promos' ? 'text-amber-400' : 'text-current'
            }`} />
            <span>Promo & Pub</span>
          </button>

          {/* Tab 5: Consommation API */}
          <button
            id="tab-btn-admin-api"
            type="button"
            onClick={() => setActiveSection('api')}
            className={`px-3.5 py-3 text-xs font-bold flex items-center justify-center gap-2 transition whitespace-nowrap shrink-0 group ${
              activeSection === 'api'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-white/45 hover:text-white/75 border-b-2 border-transparent'
            }`}
          >
            <Cpu className={`w-4 h-4 filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] transition-all group-hover:scale-110 ${
              activeSection === 'api' ? 'text-cyan-400' : 'text-current'
            }`} />
            <span>Conso API</span>
          </button>

          {/* Tab 6: Réclamations & litiges */}
          <button
            id="tab-btn-admin-disputes"
            type="button"
            onClick={() => setActiveSection('disputes')}
            className={`px-3.5 py-3 text-xs font-bold flex items-center justify-center gap-2 transition whitespace-nowrap shrink-0 group ${
              activeSection === 'disputes'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-white/45 hover:text-white/75 border-b-2 border-transparent'
            }`}
          >
            <Scale className={`w-4 h-4 filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] transition-all group-hover:scale-110 ${
              activeSection === 'disputes' ? 'text-amber-400' : 'text-current'
            }`} />
            <span>Réclamations &amp; litiges</span>
          </button>

          {/* Tab 7: Remboursements & indemnisations */}
          <button
            id="tab-btn-admin-refunds"
            type="button"
            onClick={() => setActiveSection('refunds')}
            className={`px-3.5 py-3 text-xs font-bold flex items-center justify-center gap-2 transition whitespace-nowrap shrink-0 group ${
              activeSection === 'refunds'
                ? 'text-emerald-400 border-b-2 border-emerald-400'
                : 'text-white/45 hover:text-white/75 border-b-2 border-transparent'
            }`}
          >
            <RotateCcw className={`w-4 h-4 filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] transition-all group-hover:scale-110 ${
              activeSection === 'refunds' ? 'text-emerald-400' : 'text-current'
            }`} />
            <span>Remboursements &amp; indemnisations</span>
          </button>

        </div>

        {/* 5. TAB CONTENT */}
        <div className="pt-1">
          <Suspense fallback={<DashboardSectionFallback />}>
            {/* ======================= 1. REVENUS SECTION ======================= */}
            {activeSection === 'revenues' && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <AdminRevenuesSection onNavigateTab={onNavigateTab} />
              </div>
            )}

            {/* ======================= 1B. ABONNEMENTS SECTION ======================= */}
            {activeSection === 'subscriptions' && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <AdminSubscriptionsManager onBack={() => setActiveSection('revenues')} />
              </div>
            )}

            {/* ======================= 1C. REVENU DE RETRAIT SECTION ======================= */}
            {activeSection === 'withdrawals' && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <AdminWithdrawalsSection onBack={() => setActiveSection('revenues')} />
              </div>
            )}

            {/* ======================= 2. PROBLÈMES SECTION ======================= */}
            {activeSection === 'problems' && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-1">
                  <button
                    type="button"
                    onClick={() => setActiveSection('overview')}
                    className="text-xs text-[#FF6321] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    ← Revenir au Tableau de Bord
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveSection('revenues')}
                      className="text-xs text-white/50 hover:text-white flex items-center gap-1 transition cursor-pointer"
                    >
                      Aller aux Revenus →
                    </button>
                  </div>
                </div>
                <AdminProblemsSection />
              </div>
            )}

            {/* ======================= 3. UTILISATEURS SECTION ======================= */}
            {activeSection === 'users' && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-1">
                  <button
                    type="button"
                    onClick={() => setActiveSection('revenues')}
                    className="text-xs text-[#FF6321] font-bold hover:underline flex items-center gap-1"
                  >
                    ← Revenir aux Revenus
                  </button>
                </div>
                <AdminUsersSection />
              </div>
            )}

            {/* ======================= 4. COMMANDES SECTION ======================= */}
            {activeSection === 'orders' && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-1">
                  <button
                    type="button"
                    onClick={() => setActiveSection('revenues')}
                    className="text-xs text-[#FF6321] font-bold hover:underline flex items-center gap-1"
                  >
                    ← Revenir aux Revenus
                  </button>
                </div>
                <AdminOrdersSection onSelectOrder={onSelectOrder} />
              </div>
            )}

            {/* ======================= 5. VIDÉOS & PHOTOS SECTION ======================= */}
            {activeSection === 'media' && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between pb-1">
                  <button
                    type="button"
                    onClick={() => setActiveSection('revenues')}
                    className="text-xs text-[#FF6321] font-bold hover:underline flex items-center gap-1"
                  >
                    ← Revenir aux Revenus
                  </button>
                </div>
                <AdminMediaSection />
              </div>
            )}

            {/* ======================= 6. PROMO ET PUBLICITÉ SECTION ======================= */}
            {activeSection === 'promos' && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <AdminPromosSection />
              </div>
            )}

            {/* ======================= 7. CONSOMMATION API SECTION ======================= */}
            {activeSection === 'api' && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <AdminApiSection />
              </div>
            )}

            {/* ======================= 8. HISTORIQUE SECTION ======================= */}
            {activeSection === 'history' && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <AdminHistorySection />
              </div>
            )}

            {/* ======================= 9. RÉCLAMATIONS & LITIGES SECTION ======================= */}
            {activeSection === 'disputes' && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <AdminDisputesModule />
              </div>
            )}

            {/* ======================= 10. REMBOURSEMENTS & INDEMNISATIONS SECTION ======================= */}
            {activeSection === 'refunds' && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <AdminRefundsModule />
              </div>
            )}
          </Suspense>
        </div>
      </div>
    </div>
  );
};
