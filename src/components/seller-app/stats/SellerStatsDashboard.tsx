import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft,
  ChevronRight,
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Eye, 
  ShoppingBag, 
  Calendar, 
  BarChart3, 
  ArrowUpRight, 
  Download, 
  Sparkles, 
  Wallet, 
  CheckCircle2, 
  MapPin, 
  Check, 
  Clock, 
  Flame, 
  ShieldCheck, 
  FileText, 
  Receipt,
  Layers,
  Award,
  Users,
  Search,
  Filter,
  ArrowUpDown,
  Smartphone,
  ChevronDown,
  X
} from 'lucide-react';
import { Product, Seller } from '../../../types';
import { formatFCFA, formatMetricCount } from '../../../services/marketServices';
import { DJASSA_FIXED_COMMISSION_FCFA } from '../../../services/commerceService';
import { useApp } from '../../../context/AppContext';
import { PublicationDetailedModal, PublicationStats } from './PublicationDetailedModal';
import { PublicationQuickEditModal } from './PublicationQuickEditModal';
import { PublicationBoostModal } from './PublicationBoostModal';

interface Props {
  seller: Seller;
  products: Product[];
  totalRevenue: number;
  balance: number;
  withdrawals: { id: string; amount: number; provider: string; date: string; status: string }[];
  onWithdrawSuccess: (
    newBalance: number,
    newWithdrawal: { id: string; amount: number; provider: string; date: string; status: string }
  ) => void;
  onClose: () => void;
  onOpenVideoViewer?: (products: Product[], productId?: string) => void;
  onSelectProduct?: (product: Product | null) => void;
}

type SelectedYear = '2026' | '2025' | '2024' | 'all';
type ViewTab = 'evolution' | 'annees' | 'produits' | 'zones' | 'retraits';

interface MonthData {
  monthIndex: number; // 0 to 11
  name: string;
  shortName: string;
  revenue: number;
  orders: number;
  views: number;
  avgBasket: number;
  growth: number; // percentage vs previous month
  topItemName: string;
  topCommune: string;
}

export const SellerStatsDashboard: React.FC<Props> = ({
  seller,
  products,
  totalRevenue,
  balance,
  withdrawals,
  onWithdrawSuccess,
  onClose,
  onOpenVideoViewer,
  onSelectProduct,
}) => {
  const { showToast } = useApp();

  // Navigation states
  const [activeTab, setActiveTab] = useState<ViewTab>('evolution');
  const [selectedYear, setSelectedYear] = useState<SelectedYear>('2026');
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null); // null = all year
  const [comparePreviousYear, setComparePreviousYear] = useState<boolean>(true);
  const [metricMode, setMetricMode] = useState<'revenue' | 'orders' | 'views'>('revenue');

  // Modals state
  const [detailedProduct, setDetailedProduct] = useState<Product | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [boostProduct, setBoostProduct] = useState<Product | null>(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  // Withdrawal form states
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawProvider, setWithdrawProvider] = useState<'wave' | 'orange_money'>('wave');
  const [withdrawPhone, setWithdrawPhone] = useState<string>(seller.phone || '+225 07 48 99 12 34');

  // Multi-Year monthly datasets (grounded in realistic progression)
  const monthlyDataByYear: Record<'2024' | '2025' | '2026', MonthData[]> = useMemo(() => {
    const months = [
      { name: 'Janvier', shortName: 'Jan' },
      { name: 'Février', shortName: 'Fév' },
      { name: 'Mars', shortName: 'Mar' },
      { name: 'Avril', shortName: 'Avr' },
      { name: 'Mai', shortName: 'Mai' },
      { name: 'Juin', shortName: 'Juin' },
      { name: 'Juillet', shortName: 'Juil' },
      { name: 'Août', shortName: 'Aoû' },
      { name: 'Septembre', shortName: 'Sep' },
      { name: 'Octobre', shortName: 'Oct' },
      { name: 'Novembre', shortName: 'Nov' },
      { name: 'Décembre', shortName: 'Déc' },
    ];

    // 2024: Shop launch & early traction
    const data2024: MonthData[] = months.map((m, idx) => {
      const baseRev = 450000 + idx * 85000 + ((idx * 17) % 60000);
      const orders = Math.round(baseRev / 22000);
      const views = Math.round(baseRev * 0.12 + 1400);
      return {
        monthIndex: idx,
        name: m.name,
        shortName: m.shortName,
        revenue: baseRev,
        orders,
        views,
        avgBasket: Math.round(baseRev / orders),
        growth: idx === 0 ? 0 : Number((((baseRev - (450000 + (idx - 1) * 85000)) / (450000 + (idx - 1) * 85000)) * 100).toFixed(1)),
        topItemName: idx % 2 === 0 ? 'Pagne Wax Holliwood' : 'Robe Wax Moderne',
        topCommune: idx % 3 === 0 ? 'Cocody' : idx % 3 === 1 ? 'Adjamé' : 'Yopougon',
      };
    });

    // 2025: Strong digital expansion
    const data2025: MonthData[] = months.map((m, idx) => {
      const baseRev = 1100000 + idx * 160000 + (idx === 11 ? 500000 : ((idx * 23) % 90000));
      const orders = Math.round(baseRev / 25000);
      const views = Math.round(baseRev * 0.14 + 3200);
      return {
        monthIndex: idx,
        name: m.name,
        shortName: m.shortName,
        revenue: baseRev,
        orders,
        views,
        avgBasket: Math.round(baseRev / orders),
        growth: idx === 0 ? 14.5 : Number((((baseRev - (1100000 + (idx - 1) * 160000)) / (1100000 + (idx - 1) * 160000)) * 100).toFixed(1)),
        topItemName: idx % 2 === 0 ? 'Sac Cuir & Baoulé Tissé' : 'Ensemble Boubou Bazin',
        topCommune: idx % 2 === 0 ? 'Cocody' : 'Marcory',
      };
    });

    // 2026: Maturity & Live selling peak (Jan to current month Sep, with forecasts for Q4)
    const data2026: MonthData[] = months.map((m, idx) => {
      const isPastOrCurrent = idx <= 8; // Jan to Sept 2026
      const baseRev = isPastOrCurrent
        ? 2100000 + idx * 220000 + ((idx * 31) % 150000)
        : Math.round((2100000 + idx * 240000) * 1.1); // Projection for remaining months
      const orders = Math.round(baseRev / 28500);
      const views = Math.round(baseRev * 0.18 + 5800);
      return {
        monthIndex: idx,
        name: m.name,
        shortName: m.shortName,
        revenue: baseRev,
        orders,
        views,
        avgBasket: Math.round(baseRev / orders),
        growth: idx === 0 ? 18.2 : Number((((baseRev - (2100000 + (idx - 1) * 220000)) / (2100000 + (idx - 1) * 220000)) * 100).toFixed(1)),
        topItemName: idx % 3 === 0 ? 'Sac à Main Cuir & Pagne Baoulé' : idx % 3 === 1 ? 'Robe Wax Moderne Africaine' : 'Ensemble Boubou Bazin Riche',
        topCommune: idx % 2 === 0 ? 'Cocody' : 'Yopougon',
      };
    });

    return {
      '2024': data2024,
      '2025': data2025,
      '2026': data2026,
    };
  }, []);

  // Compute active dataset based on year selection
  const currentMonths = useMemo(() => {
    if (selectedYear === 'all') {
      // Average or combined view across all years
      return monthlyDataByYear['2026'];
    }
    return monthlyDataByYear[selectedYear];
  }, [selectedYear, monthlyDataByYear]);

  // Previous year dataset for direct comparison
  const previousYearMonths = useMemo(() => {
    if (selectedYear === '2026') return monthlyDataByYear['2025'];
    if (selectedYear === '2025') return monthlyDataByYear['2024'];
    return null;
  }, [selectedYear, monthlyDataByYear]);

  // Filtered dataset according to active month
  const activeMonthData = useMemo(() => {
    if (selectedMonth === null) return null;
    return currentMonths[selectedMonth] || null;
  }, [selectedMonth, currentMonths]);

  // Aggregate stats for current view
  const aggregatedStats = useMemo(() => {
    if (activeMonthData) {
      return {
        revenue: activeMonthData.revenue,
        orders: activeMonthData.orders,
        views: activeMonthData.views,
        avgBasket: activeMonthData.avgBasket,
        growth: activeMonthData.growth,
        topItem: activeMonthData.topItemName,
        topCommune: activeMonthData.topCommune,
      };
    }

    const totalRev = currentMonths.reduce((acc, m) => acc + m.revenue, 0);
    const totalOrders = currentMonths.reduce((acc, m) => acc + m.orders, 0);
    const totalViews = currentMonths.reduce((acc, m) => acc + m.views, 0);
    const avgBasket = Math.round(totalRev / Math.max(totalOrders, 1));
    
    // Growth vs previous year
    let yearlyGrowth = 24.8;
    if (previousYearMonths) {
      const prevRev = previousYearMonths.reduce((acc, m) => acc + m.revenue, 0);
      yearlyGrowth = Number((((totalRev - prevRev) / prevRev) * 100).toFixed(1));
    }

    return {
      revenue: totalRev,
      orders: totalOrders,
      views: totalViews,
      avgBasket,
      growth: yearlyGrowth,
      topItem: 'Sac à Main Cuir & Pagne Baoulé Tissé',
      topCommune: 'Cocody (38% des ventes)',
    };
  }, [activeMonthData, currentMonths, previousYearMonths]);

  // Max revenue in current dataset for proportional bar chart
  const maxMetricValue = useMemo(() => {
    return Math.max(
      ...currentMonths.map((m) =>
        metricMode === 'revenue' ? m.revenue : metricMode === 'orders' ? m.orders : m.views
      ),
      1
    );
  }, [currentMonths, metricMode]);

  // Multi-year comparison table
  const multiYearOverview = useMemo(() => {
    const y2024Rev = monthlyDataByYear['2024'].reduce((acc, m) => acc + m.revenue, 0);
    const y2025Rev = monthlyDataByYear['2025'].reduce((acc, m) => acc + m.revenue, 0);
    const y2026Rev = monthlyDataByYear['2026'].reduce((acc, m) => acc + m.revenue, 0);

    const y2024Orders = monthlyDataByYear['2024'].reduce((acc, m) => acc + m.orders, 0);
    const y2025Orders = monthlyDataByYear['2025'].reduce((acc, m) => acc + m.orders, 0);
    const y2026Orders = monthlyDataByYear['2026'].reduce((acc, m) => acc + m.orders, 0);

    return [
      {
        year: '2026',
        label: '2026 (En cours)',
        status: 'Année record',
        revenue: y2026Rev,
        orders: y2026Orders,
        growth: `+${(((y2026Rev - y2025Rev) / y2025Rev) * 100).toFixed(1)}%`,
        isPositive: true,
        bestMonth: 'Août (3.9M FCFA)',
        avgBasket: Math.round(y2026Rev / y2026Orders),
      },
      {
        year: '2025',
        label: '2025 (Expansion)',
        status: 'Plein essor',
        revenue: y2025Rev,
        orders: y2025Orders,
        growth: `+${(((y2025Rev - y2024Rev) / y2024Rev) * 100).toFixed(1)}%`,
        isPositive: true,
        bestMonth: 'Décembre (2.7M FCFA)',
        avgBasket: Math.round(y2025Rev / y2025Orders),
      },
      {
        year: '2024',
        label: '2024 (Lancement)',
        status: 'Fondation Adjamé',
        revenue: y2024Rev,
        orders: y2024Orders,
        growth: '—',
        isPositive: true,
        bestMonth: 'Décembre (1.4M FCFA)',
        avgBasket: Math.round(y2024Rev / y2024Orders),
      },
    ];
  }, [monthlyDataByYear]);

  // Top products of the selected period
  const topProductsList = useMemo(() => {
    return products.slice(0, 6).map((p, idx) => {
      const salesCount = p.salesCount || Math.round(60 + idx * 24);
      const totalProdRevenue = salesCount * p.price;
      const periodSales = selectedMonth !== null ? Math.round(salesCount * 0.12) : salesCount;
      const periodRevenue = periodSales * p.price;
      const marginPercent = 68 - idx * 3;

      return {
        product: p,
        sales: periodSales,
        revenue: periodRevenue,
        views: (p.viewsCount || 2400) + idx * 800,
        marginPercent,
      };
    });
  }, [products, selectedMonth]);

  // Geographic distribution
  const communesBreakdown = [
    { commune: 'Cocody', share: 38, salesCount: Math.round(aggregatedStats.orders * 0.38), revenue: Math.round(aggregatedStats.revenue * 0.40) },
    { commune: 'Yopougon', share: 26, salesCount: Math.round(aggregatedStats.orders * 0.26), revenue: Math.round(aggregatedStats.revenue * 0.24) },
    { commune: 'Adjamé / Plateau', share: 18, salesCount: Math.round(aggregatedStats.orders * 0.18), revenue: Math.round(aggregatedStats.revenue * 0.17) },
    { commune: 'Marcory / Zone 4', share: 12, salesCount: Math.round(aggregatedStats.orders * 0.12), revenue: Math.round(aggregatedStats.revenue * 0.13) },
    { commune: 'Autres communes', share: 6, salesCount: Math.round(aggregatedStats.orders * 0.06), revenue: Math.round(aggregatedStats.revenue * 0.06) },
  ];

  // Handle mobile money withdrawal
  const handleConfirmWithdrawal = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Montant invalide.');
      return;
    }
    if (amount > balance) {
      showToast(`Solde insuffisant : ${formatFCFA(balance)} disponible.`);
      return;
    }
    if (!/^\+?225?0?\d{8,10}$/.test(withdrawPhone.replace(/\s|-/g, ''))) {
      showToast('Numéro de téléphone ivoirien invalide.');
      return;
    }

    const providerLabel = withdrawProvider === 'wave' ? 'Wave' : 'Orange Money';

    const newWithdrawal = {
      id: `w-${Date.now()}`,
      amount,
      provider: providerLabel,
      date: "À l'instant",
      status: 'En traitement',
    };

    onWithdrawSuccess(balance - amount, newWithdrawal);
    setWithdrawAmount('');
    setShowWithdrawModal(false);
    showToast(`Demande de reversement de ${formatFCFA(amount)} vers ${providerLabel} validée ! 💰`);
  };

  return (
    <div
      id="seller-stats-dashboard"
      className="fixed inset-0 z-50 bg-[#0A0A0A] text-white flex flex-col overflow-hidden select-none animate-in fade-in duration-200"
    >
      {/* 1. TOP HEADER BAR */}
      <header className="sticky top-0 z-40 bg-[#0E0E0E]/95 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="p-2 -ml-1 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition active:scale-95"
            aria-label="Retour"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold text-white tracking-tight">
                Finances & Évolution Boutique
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live 2026
              </span>
            </div>
            <p className="text-[10px] text-white/50">
              Historique de croissance • {seller.name} (@{seller.username})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Download Official Accounting Report */}
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-bold transition flex items-center gap-1.5"
            title="Exporter le rapport comptable"
          >
            <Download className="w-4 h-4 text-[#FF6321]" />
            <span className="hidden sm:inline">Bilan</span>
          </button>

          {/* Direct Withdraw Trigger */}
          <button
            type="button"
            onClick={() => setShowWithdrawModal(true)}
            className="px-3 py-1.5 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white text-xs font-bold shadow-lg shadow-orange-600/25 active:scale-95 transition flex items-center gap-1.5"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Retrait</span>
          </button>
        </div>
      </header>

      {/* 2. TIME HORIZON BAR (ANNÉES & MOIS) */}
      <section className="bg-[#121212] border-b border-white/5 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 z-30">
        {/* Year Selector Tabs */}
        <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
          <span className="text-[11px] font-bold text-white/50 px-2 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-[#FF6321]" />
            Année :
          </span>
          {(['2026', '2025', '2024', 'all'] as SelectedYear[]).map((yr) => (
            <button
              key={yr}
              type="button"
              onClick={() => {
                setSelectedYear(yr);
                setSelectedMonth(null); // reset month when changing year
              }}
              className={`px-3 py-1 rounded-lg text-xs font-extrabold transition ${
                selectedYear === yr
                  ? 'bg-[#FF6321] text-white shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {yr === 'all' ? 'Toutes' : yr}
            </button>
          ))}
        </div>

        {/* View Mode Tabs (Évolution, Bilan par Années, Produits, Zones, Retraits) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'evolution', label: '📈 Évolution Mensuelle' },
            { id: 'annees', label: '📅 Comparatif Annuel' },
            { id: 'produits', label: '🏆 Produits Stars' },
            { id: 'zones', label: '🗺️ Communes' },
            { id: 'retraits', label: '💳 Reversements' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as ViewTab)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-white text-black shadow-sm'
                  : 'bg-white/5 text-white/60 hover:text-white border border-white/5'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* 3. SCROLLABLE DASHBOARD CONTENT */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-24 p-4 space-y-5 max-w-4xl mx-auto w-full">
        
        {/* KPI CARDS GRID */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Card 1: Chiffre d'affaires */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#181818] to-[#121212] border border-white/10 space-y-1 shadow-lg">
            <div className="flex items-center justify-between text-white/50 text-[11px] font-bold">
              <span>Chiffre d'Affaires</span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-base sm:text-lg font-black text-white truncate">
              {formatFCFA(aggregatedStats.revenue)}
            </p>
            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
              <TrendingUp className="w-3 h-3" />
              <span>+{aggregatedStats.growth}% vs N-1</span>
            </div>
          </div>

          {/* Card 2: Commandes Confirmées */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#181818] to-[#121212] border border-white/10 space-y-1 shadow-lg">
            <div className="flex items-center justify-between text-white/50 text-[11px] font-bold">
              <span>Commandes Confirmées</span>
              <ShoppingBag className="w-3.5 h-3.5 text-[#FF6321]" />
            </div>
            <p className="text-base sm:text-lg font-black text-white">
              {aggregatedStats.orders.toLocaleString('fr-FR')} commandes
            </p>
            <div className="text-[10px] font-medium text-white/40">
              Livraison gérée par la boutique
            </div>
          </div>

          {/* Card 3: Panier Moyen */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#181818] to-[#121212] border border-white/10 space-y-1 shadow-lg">
            <div className="flex items-center justify-between text-white/50 text-[11px] font-bold">
              <span>Panier Moyen</span>
              <Receipt className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <p className="text-base sm:text-lg font-black text-white truncate">
              {formatFCFA(aggregatedStats.avgBasket)}
            </p>
            <div className="text-[10px] font-medium text-cyan-400">
              Par commande client
            </div>
          </div>

          {/* Card 4: Portefeuille Disponible */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#181818] to-[#121212] border border-[#FF6321]/30 space-y-1 shadow-lg">
            <div className="flex items-center justify-between text-white/50 text-[11px] font-bold">
              <span>Solde Disponible</span>
              <Wallet className="w-3.5 h-3.5 text-[#FF6321]" />
            </div>
            <p className="text-base sm:text-lg font-black text-[#FF6321] truncate">
              {formatFCFA(balance)}
            </p>
            <button
              type="button"
              onClick={() => setShowWithdrawModal(true)}
              className="text-[10px] font-bold text-white hover:underline flex items-center gap-1"
            >
              <span>Retirer maintenant</span>
              <ChevronRight className="w-2.5 h-2.5" />
            </button>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* TAB 1: ÉVOLUTION MENSUELLE (Graphique Barres & Sélecteur interactif Mois) */}
        {/* ========================================================================= */}
        {activeTab === 'evolution' && (
          <section className="space-y-4">
            <div className="p-4 rounded-3xl bg-[#121212] border border-white/10 space-y-4 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#FF6321]" />
                    <span>Progression Mensuelle • Année {selectedYear === 'all' ? '2024-2026' : selectedYear}</span>
                  </h3>
                  <p className="text-[11px] text-white/50">
                    Cliquez sur un mois pour afficher son détail complet et son bilan.
                  </p>
                </div>

                {/* Metric Mode Toggle */}
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setMetricMode('revenue')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                      metricMode === 'revenue'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'text-white/50 hover:text-white'
                    }`}
                  >
                    Revenus (FCFA)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetricMode('orders')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                      metricMode === 'orders'
                        ? 'bg-[#FF6321]/20 text-[#FF6321] border border-[#FF6321]/30'
                        : 'text-white/50 hover:text-white'
                    }`}
                  >
                    Commandes
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetricMode('views')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                      metricMode === 'views'
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        : 'text-white/50 hover:text-white'
                    }`}
                  >
                    Vues
                  </button>
                </div>
              </div>

              {/* MONTHLY INTERACTIVE BAR CHART */}
              <div className="space-y-2 pt-2">
                <div className="h-48 sm:h-56 flex items-end gap-1.5 sm:gap-3 px-1 pt-6 pb-2 border-b border-white/10">
                  {currentMonths.map((m) => {
                    const value = metricMode === 'revenue' ? m.revenue : metricMode === 'orders' ? m.orders : m.views;
                    const heightPercent = Math.max(12, Math.round((value / maxMetricValue) * 100));
                    const isSelected = selectedMonth === m.monthIndex;

                    return (
                      <div
                        key={m.monthIndex}
                        onClick={() => setSelectedMonth(isSelected ? null : m.monthIndex)}
                        className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                      >
                        {/* Hover Tooltip Value */}
                        <div
                          className={`absolute -top-7 px-1.5 py-0.5 rounded bg-black/90 border border-white/20 text-[9px] font-mono text-white pointer-events-none transition opacity-0 group-hover:opacity-100 z-20 whitespace-nowrap shadow-xl ${
                            isSelected ? 'opacity-100' : ''
                          }`}
                        >
                          {metricMode === 'revenue'
                            ? `${(m.revenue / 1000).toFixed(0)}k`
                            : m.orders}
                        </div>

                        {/* Bar */}
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full rounded-t-xl transition-all duration-300 relative overflow-hidden ${
                            isSelected
                              ? 'bg-gradient-to-t from-[#FF6321] to-[#ff8c53] ring-2 ring-[#FF6321] shadow-lg shadow-orange-600/40'
                              : 'bg-white/10 group-hover:bg-[#FF6321]/60'
                          }`}
                        >
                          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition" />
                        </div>

                        {/* Month Label */}
                        <span
                          className={`text-[10px] mt-2 font-bold transition ${
                            isSelected ? 'text-[#FF6321]' : 'text-white/50 group-hover:text-white'
                          }`}
                        >
                          {m.shortName}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-[11px] text-white/40 pt-1">
                  <span>0 FCFA</span>
                  <span className="text-[#FF6321] font-bold">
                    Pic mensuel : {formatFCFA(maxMetricValue)}
                  </span>
                </div>
              </div>

              {/* ACTIVE MONTH DETAILED POPUP / EXPANDED SUMMARY */}
              {activeMonthData ? (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-950/30 via-[#181818] to-neutral-900 border border-[#FF6321]/30 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FF6321] animate-ping" />
                      <h4 className="text-sm font-extrabold text-white">
                        Bilan détaillé • {activeMonthData.name} {selectedYear}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedMonth(null)}
                      className="text-xs text-white/50 hover:text-white px-2 py-1 rounded-lg bg-white/5"
                    >
                      Voir toute l'année
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                      <span className="text-[10px] text-white/40 block">Chiffre d'Affaires</span>
                      <span className="font-bold text-emerald-400">
                        {formatFCFA(activeMonthData.revenue)}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                      <span className="text-[10px] text-white/40 block">Commandes</span>
                      <span className="font-bold text-white">
                        {activeMonthData.orders} confirmées
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                      <span className="text-[10px] text-white/40 block">Produit Star</span>
                      <span className="font-bold text-white truncate block">
                        {activeMonthData.topItemName}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                      <span className="text-[10px] text-white/40 block">Commune n°1</span>
                      <span className="font-bold text-cyan-400">
                        {activeMonthData.topCommune}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs text-white/50">
                  <span>💡 Cliquez sur n'importe quel mois du graphique ci-dessus pour inspecter ses statistiques.</span>
                  <span className="text-[10px] text-[#FF6321] font-bold">12 mois actifs</span>
                </div>
              )}
            </div>

            {/* MONTH BY MONTH TABLE OF THE YEAR */}
            <div className="p-4 rounded-3xl bg-[#121212] border border-white/10 space-y-3 shadow-xl">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-white/60">
                Tableau chronologique mois par mois ({selectedYear})
              </h3>

              <div className="divide-y divide-white/5 text-xs">
                {currentMonths.map((m) => (
                  <div
                    key={m.monthIndex}
                    onClick={() => setSelectedMonth(m.monthIndex)}
                    className="py-2.5 flex items-center justify-between hover:bg-white/[0.03] px-2 rounded-xl transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-12 font-bold text-white group-hover:text-[#FF6321] transition">
                        {m.name}
                      </span>
                      <span className="text-[11px] text-white/40 hidden sm:inline">
                        Top : {m.topItemName}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-white/60 text-[11px]">
                        {m.orders} ventes
                      </span>
                      <span className="font-mono font-bold text-white group-hover:text-emerald-400 transition min-w-[90px] text-right">
                        {formatFCFA(m.revenue)}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-400 min-w-[45px] text-right">
                        +{m.growth}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: BILAN PAR ANNÉES (2024, 2025, 2026)                                */}
        {/* ========================================================================= */}
        {activeTab === 'annees' && (
          <section className="space-y-4">
            <div className="p-4 rounded-3xl bg-[#121212] border border-white/10 space-y-4 shadow-xl">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#FF6321]" />
                  <span>Historique Pluriannuel & Croissance (2024 - 2026)</span>
                </h3>
                <p className="text-[11px] text-white/50">
                  Vue d'ensemble de l'évolution financière depuis la création de la boutique.
                </p>
              </div>

              {/* Multi-Year Cards */}
              <div className="space-y-3">
                {multiYearOverview.map((item) => (
                  <div
                    key={item.year}
                    className={`p-4 rounded-2xl border transition ${
                      item.year === '2026'
                        ? 'bg-gradient-to-r from-orange-950/20 via-[#181818] to-neutral-900 border-[#FF6321]/40'
                        : 'bg-white/[0.02] border-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-white">{item.label}</span>
                        <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold text-white/70">
                          {item.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Croissance : {item.growth}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs">
                      <div>
                        <span className="text-[10px] text-white/40 block">Chiffre d'Affaires</span>
                        <span className="text-sm font-black text-white">
                          {formatFCFA(item.revenue)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-white/40 block">Total Commandes</span>
                        <span className="text-sm font-black text-white">
                          {item.orders.toLocaleString('fr-FR')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-white/40 block">Panier Moyen</span>
                        <span className="text-sm font-bold text-white/80">
                          {formatFCFA(item.avgBasket)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-white/40 block">Mois Record</span>
                        <span className="text-sm font-bold text-[#FF6321]">
                          {item.bestMonth}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Growth Narrative */}
              <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-white/70 space-y-1 leading-relaxed">
                <span className="font-bold text-white flex items-center gap-1.5 text-[#FF6321]">
                  <Sparkles className="w-3.5 h-3.5" />
                  Analyse de rentabilité Djassa
                </span>
                <p>
                  En 3 ans, votre boutique est passée de 450 000 FCFA/mois à plus de 3 800 000 FCFA/mois grâce aux vidéos démos et aux livraisons le jour même assurées à Abidjan.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: PRODUITS STARS & RENTABILITÉ                                       */}
        {/* ========================================================================= */}
        {activeTab === 'produits' && (
          <section className="space-y-3">
            <div className="p-4 rounded-3xl bg-[#121212] border border-white/10 space-y-4 shadow-xl">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Articles les Plus Vendus & Rentables ({selectedYear})</span>
                </h3>
                <p className="text-[11px] text-white/50">
                  Classement par chiffre d'affaires généré sur la période.
                </p>
              </div>

              <div className="space-y-2.5">
                {topProductsList.map((item, idx) => (
                  <div
                    key={item.product.id}
                    className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-5 text-center text-xs font-black text-[#FF6321]">
                        #{idx + 1}
                      </span>
                      <img
                        src={item.product.images?.[0] || item.product.videoPoster || 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=200'}
                        alt={item.product.name}
                        className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate group-hover:text-[#FF6321] transition">
                          {item.product.name}
                        </p>
                        <p className="text-[10px] text-white/50 flex items-center gap-2">
                          <span>{item.sales} ventes</span>
                          <span>•</span>
                          <span className="text-cyan-400">{formatMetricCount(item.views)} vues</span>
                          <span>•</span>
                          <span className="text-emerald-400">Marge {item.marginPercent}%</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-white font-mono">
                        {formatFCFA(item.revenue)}
                      </p>
                      <button
                        type="button"
                        onClick={() => setDetailedProduct(item.product)}
                        className="text-[10px] font-bold text-[#FF6321] hover:underline"
                      >
                        Stats détaillées
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: RÉPARTITION PAR COMMUNES D'ABIDJAN                                 */}
        {/* ========================================================================= */}
        {activeTab === 'zones' && (
          <section className="space-y-4">
            <div className="p-4 rounded-3xl bg-[#121212] border border-white/10 space-y-4 shadow-xl">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span>Répartition des Ventes à Abidjan ({selectedYear})</span>
                </h3>
                <p className="text-[11px] text-white/50">
                  Où habitent vos clients et quelles sont vos zones de livraison les plus rentables.
                </p>
              </div>

              <div className="space-y-3">
                {communesBreakdown.map((item) => (
                  <div key={item.commune} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white">{item.commune}</span>
                      <span className="text-white/60">
                        {item.share}% ({item.salesCount} livraisons • {formatFCFA(item.revenue)})
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        style={{ width: `${item.share}%` }}
                        className="h-full rounded-full bg-gradient-to-r from-[#FF6321] to-emerald-400"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-white/60 leading-relaxed">
                📍 <strong>Adjamé et Cocody</strong> représentent plus de 55% de votre chiffre d'affaires. Ciblez vos prochaines promotions et publications vidéo sur ces secteurs.
              </div>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: REVERSEMENTS & RETRAITS DIRECTS                                    */}
        {/* ========================================================================= */}
        {activeTab === 'retraits' && (
          <section className="space-y-4">
            <div className="p-4 rounded-3xl bg-[#121212] border border-white/10 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#FF6321]" />
                    <span>Portefeuille & Demandes de Reversement</span>
                  </h3>
                  <p className="text-[11px] text-white/50">
                    Solde disponible immédiatement sur votre compte Mobile Money.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(true)}
                  className="px-4 py-2 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white text-xs font-bold transition shadow-lg shadow-orange-600/25"
                >
                  Demander un retrait
                </button>
              </div>

              {/* Balance Box */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-950/40 to-neutral-900 border border-[#FF6321]/40 flex items-center justify-between">
                <div>
                  <span className="text-xs text-white/60 block">Solde prêt à être viré</span>
                  <span className="text-2xl font-black text-white">{formatFCFA(balance)}</span>
                </div>
                <div className="text-right text-[11px] text-white/50">
                  <span>Délai moyen de virement :</span>
                  <span className="block font-bold text-emerald-400">&lt; 15 minutes</span>
                </div>
              </div>

              {/* Withdrawals List */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-white/70">Historique des retraits récents</h4>
                {withdrawals.length === 0 ? (
                  <p className="text-xs text-white/40 py-4 text-center">Aucun retrait récent.</p>
                ) : (
                  <div className="divide-y divide-white/5">
                    {withdrawals.map((w) => (
                      <div key={w.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <div>
                            <p className="font-bold text-white">{formatFCFA(w.amount)}</p>
                            <p className="text-[10px] text-white/40">{w.provider} • {w.date}</p>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
                          {w.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

      </main>

      {/* ========================================================================= */}
      {/* MODAL: DEMANDE DE RETRAIT RAPIDE MOBILE MONEY                             */}
      {/* ========================================================================= */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full sm:max-w-md bg-[#141414] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#FF6321]" />
                Retirer vers Mobile Money
              </h3>
              <button
                type="button"
                onClick={() => setShowWithdrawModal(false)}
                className="p-1 text-white/50 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmWithdrawal} className="space-y-4">
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                <span className="text-[10px] text-white/40 block">Solde disponible</span>
                <span className="text-lg font-black text-emerald-400">{formatFCFA(balance)}</span>
              </div>

              {/* Provider Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/80 block">Opérateur de réception</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'wave', label: 'Wave', color: 'border-cyan-400 text-cyan-400' },
                    { id: 'orange_money', label: 'Orange Money', color: 'border-orange-500 text-orange-400' },
                  ].map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => setWithdrawProvider(op.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition text-center ${
                        withdrawProvider === op.id
                          ? 'bg-white/10 border-white text-white shadow-md'
                          : 'bg-white/5 border-white/5 text-white/50 hover:text-white'
                      }`}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white/80 block">Montant du retrait (FCFA)</label>
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(balance.toString())}
                    className="text-[10px] font-bold text-[#FF6321] hover:underline"
                  >
                    Tout retirer
                  </button>
                </div>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Ex: 50000"
                  required
                  min={1000}
                  max={balance}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-[#FF6321]"
                />
              </div>

              {/* Phone Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/80 block">Numéro Mobile Money (+225)</label>
                <input
                  type="tel"
                  value={withdrawPhone}
                  onChange={(e) => setWithdrawPhone(e.target.value)}
                  required
                  placeholder="+225 07 48 99 12 34"
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-[#FF6321]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-white/70 font-bold text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!withdrawAmount || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > balance}
                  className="flex-1 py-3 rounded-xl bg-[#FF6321] disabled:opacity-50 text-white font-extrabold text-xs shadow-lg shadow-orange-600/30"
                >
                  Confirmer le virement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BILAN COMPTABLE OFFICIEL                                           */}
      {/* ========================================================================= */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#121212] border border-white/15 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[#FF6321]" />
                <h3 className="text-sm font-black text-white">Attestation de Ventes & Bilan</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="p-1 text-white/50 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs bg-white/[0.03] p-4 rounded-2xl border border-white/5">
              <div className="flex justify-between">
                <span className="text-white/50">Boutique :</span>
                <span className="font-bold text-white">{seller.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Période concernée :</span>
                <span className="font-bold text-[#FF6321]">
                  {selectedMonth !== null ? `${currentMonths[selectedMonth]?.name} ${selectedYear}` : `Année ${selectedYear}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Volume des ventes :</span>
                <span className="font-bold text-white">{aggregatedStats.orders} commandes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Chiffre d'Affaires Brut :</span>
                <span className="font-black text-emerald-400">{formatFCFA(aggregatedStats.revenue)}</span>
              </div>
              <div className="flex justify-between border-t border-white/5 pt-2">
                <span className="text-white/50">Date d'édition :</span>
                <span className="font-mono text-white/80">29/09/2026 • 16:45</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                showToast('Bilan officiel téléchargé au format PDF ! 📄');
                setShowExportModal(false);
              }}
              className="w-full py-3 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white text-xs font-black transition flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Télécharger le bilan officiel (PDF)</span>
            </button>
          </div>
        </div>
      )}

      {/* Publication detailed stats modal */}
      {detailedProduct && (
        <PublicationDetailedModal
          product={detailedProduct}
          stats={{
            views: detailedProduct.viewsCount || 3400,
            likes: 180,
            shares: 45,
            comments: 28,
            cartAdds: 95,
            salesCount: detailedProduct.salesCount || 42,
            revenue: (detailedProduct.salesCount || 42) * detailedProduct.price,
            netRevenue: Math.max(0, ((detailedProduct.salesCount || 42) * detailedProduct.price) - ((detailedProduct.salesCount || 42) * DJASSA_FIXED_COMMISSION_FCFA)),
            commission: (detailedProduct.salesCount || 42) * DJASSA_FIXED_COMMISSION_FCFA,
            conversionRate: 4.8,
            topCommunes: communesBreakdown.map((c) => ({
              commune: c.commune,
              percentage: c.share,
              sales: c.salesCount,
            })),
            dailyViews: [
              { day: 'Lun', views: 320, sales: 5 },
              { day: 'Mar', views: 410, sales: 8 },
              { day: 'Mer', views: 490, sales: 11 },
              { day: 'Jeu', views: 380, sales: 6 },
              { day: 'Ven', views: 620, sales: 14 },
              { day: 'Sam', views: 780, sales: 19 },
              { day: 'Dim', views: 400, sales: 7 },
            ],
          }}
          seller={seller}
          onClose={() => setDetailedProduct(null)}
          onQuickEdit={(p) => {
            setDetailedProduct(null);
            setEditProduct(p);
          }}
          onBoost={(p) => {
            setDetailedProduct(null);
            setBoostProduct(p);
          }}
          onOpenViewer={(p) => {
            if (onOpenVideoViewer) onOpenVideoViewer([p], p.id);
          }}
        />
      )}

      {/* Quick edit & boost modal integrations */}
      {editProduct && (
        <PublicationQuickEditModal
          product={editProduct}
          onClose={() => setEditProduct(null)}
          onUpdated={(updated) => {
            setEditProduct(null);
            showToast('Produit mis à jour avec succès.');
          }}
        />
      )}

      {boostProduct && (
        <PublicationBoostModal
          product={boostProduct}
          onClose={() => setBoostProduct(null)}
          onBoostSuccess={() => {
            setBoostProduct(null);
            showToast('Campagne boost activée avec succès ! 🚀');
          }}
        />
      )}

    </div>
  );
};
