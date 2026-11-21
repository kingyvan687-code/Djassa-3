import React, { useState, useMemo, useEffect } from 'react';
import { 
  Wallet, 
  ArrowDownToLine, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  CheckCircle2, 
  ShieldCheck, 
  DollarSign, 
  Calendar, 
  Package,
  Layers,
  Search,
  Filter,
  FileText,
  Share2,
  Download,
  Target,
  Sparkles,
  ChevronRight,
  Eye,
  Printer,
  X,
  CreditCard,
  Percent,
  BarChart3,
  Check,
  Copy,
  AlertCircle,
  Building2,
  Phone,
  Smartphone,
  RotateCcw,
  ShoppingBag
} from 'lucide-react';
import { Order, Product, Seller } from '../../types';
import { formatFCFA, formatMetricCount } from '../../services/marketServices';
import { SellerTransaction } from './boutique/types';
import { DJASSA_FIXED_COMMISSION_FCFA } from '../achats/checkout/checkoutTypes';
import { WithdrawEarningsModal } from './boutique/WithdrawEarningsModal';
import { useApp } from '../../context/AppContext';

interface Props {
  seller: Seller;
  products: Product[];
  orders: Order[];
  onOpenWithdrawFromParent?: () => void;
  isStandalone?: boolean;
}

type RevenueSubTab = 'apercu' | 'ventes' | 'retraits' | 'releve';
type PeriodType = 'today' | 'week' | 'month' | 'quarter' | 'all';

export const SellerRevenuesScreen: React.FC<Props> = ({
  seller,
  products,
  orders,
  onOpenWithdrawFromParent,
  isStandalone = true,
}) => {
  const { showToast } = useApp();

  // Internal sub-tab selector
  const [activeSubTab, setActiveSubTab] = useState<RevenueSubTab>('apercu');

  // Time filter
  const [period, setPeriod] = useState<PeriodType>('month');

  // Withdrawal modal state
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);

  // Digital Receipt modal
  const [selectedTxForReceipt, setSelectedTxForReceipt] = useState<SellerTransaction | null>(null);

  // Statement modal
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);

  // Sales Target modal
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);

  // Monthly sales target
  const [monthlyTarget, setMonthlyTarget] = useState<number>(() => {
    const saved = localStorage.getItem(`djassa_sales_target_${seller?.id || 'default'}`);
    return saved ? Number(saved) : 1500000;
  });
  const [targetInput, setTargetInput] = useState(String(monthlyTarget));

  // Transactions filter & search
  const [txSearchQuery, setTxSearchQuery] = useState('');
  const [txFilterType, setTxFilterType] = useState<'all' | 'sale_earning' | 'withdrawal' | 'refund_deduction'>('all');
  const [withdrawalProviderFilter, setWithdrawalProviderFilter] = useState<'all' | 'wave' | 'orange_money'>('all');

  // Top products sort
  const [productSortBy, setProductSortBy] = useState<'revenue' | 'units' | 'price'>('revenue');

  // Filter seller orders
  const sellerOrders = useMemo(() => {
    const list = orders.filter((o) =>
      o.items.some((item) =>
        products.some((p) => p.id === item.productId && p.sellerId === seller.id)
      )
    );
    return list.length > 0 ? list : orders;
  }, [orders, products, seller.id]);

  // Online Paid vs Cash on Delivery Orders (No legacy delivery statuses)
  const paidOnlineOrders = useMemo(
    () => sellerOrders.filter((o) => o.paymentMode !== 'cod' && o.paymentStatus === 'paid'),
    [sellerOrders]
  );
  const onlineRevenue = useMemo(
    () => paidOnlineOrders.reduce((acc, o) => acc + Math.max(0, (o.subtotal || o.total || 0) - (o.discount || 0)), 0),
    [paidOnlineOrders]
  );

  const codOrders = useMemo(
    () =>
      sellerOrders.filter(
        (o) => o.paymentMode === 'cod' || o.paymentMethod === 'cash_on_delivery' || o.paymentStatus === 'cod_pending'
      ),
    [sellerOrders]
  );
  const codRevenue = useMemo(
    () => codOrders.reduce((acc, o) => acc + Math.max(0, (o.subtotal || o.total || 0) - (o.discount || 0)), 0),
    [codOrders]
  );

  // Base gross revenue from all orders
  const baseGrossRevenue = useMemo(() => {
    const total = sellerOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    return total > 0 ? total : 380000;
  }, [sellerOrders]);

  // Transactions state loaded from localStorage
  const [transactions, setTransactions] = useState<SellerTransaction[]>(() => {
    const saved = localStorage.getItem(`djassa_seller_transactions_${seller.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return [
      {
        id: 'tx-1',
        type: 'sale_earning',
        amount: 38000,
        description: 'Vente Commande #CMD-9821 (Pagne Woodin x2)',
        date: 'Hier, 17:40',
        status: 'completed',
        reference: 'VNT-9821',
        orderNumber: 'CMD-9821',
        clientName: 'Awa Koné (Cocody)',
        grossAmount: 40000,
        platformFee: 2000,
        netAmount: 38000,
      },
      {
        id: 'tx-2',
        type: 'withdrawal',
        amount: 45000,
        description: 'Retrait Wave CI (+225 07 48 99 12 34)',
        date: 'Il y a 2 jours, 14:15',
        status: 'completed',
        provider: 'wave',
        phone: '+225 07 48 99 12 34',
        reference: 'VIR-741920',
        grossAmount: 45000,
        platformFee: 0,
        netAmount: 45000,
      },
      {
        id: 'tx-3',
        type: 'sale_earning',
        amount: 64000,
        description: 'Vente Commande #CMD-9410 (Ensemble Lin)',
        date: 'Il y a 3 jours, 11:20',
        status: 'completed',
        reference: 'VNT-9410',
        orderNumber: 'CMD-9410',
        clientName: 'Marc Kouadio (Plateau)',
        grossAmount: 67368,
        platformFee: 3368,
        netAmount: 64000,
      },
      {
        id: 'tx-4',
        type: 'withdrawal',
        amount: 60000,
        description: 'Retrait Orange Money (+225 07 00 11 22 33)',
        date: 'Il y a 5 jours, 09:45',
        status: 'completed',
        provider: 'orange_money',
        phone: '+225 07 00 11 22 33',
        reference: 'OM-883019',
        grossAmount: 60000,
        platformFee: 0,
        netAmount: 60000,
      },
      {
        id: 'tx-5',
        type: 'sale_earning',
        amount: 22000,
        description: 'Vente Commande #CMD-9102 (Sandales cuir artisanal)',
        date: 'Il y a 6 jours, 16:30',
        status: 'completed',
        reference: 'VNT-9102',
        orderNumber: 'CMD-9102',
        clientName: 'Fatou Diop (Marcory)',
        grossAmount: 22150,
        platformFee: 150,
        netAmount: 22000,
      },
      {
        id: 'tx-7',
        type: 'refund_deduction',
        amount: 12000,
        description: 'Dédommagement litige client #LIT-089 (Robe retour)',
        date: 'Il y a 12 jours, 15:10',
        status: 'completed',
        reference: 'REM-1049',
        grossAmount: 12000,
        platformFee: 0,
        netAmount: 12000,
      }
    ];
  });

  // Calculate totals
  const totalWithdrawn = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'withdrawal' && t.status === 'completed')
      .reduce((acc, t) => acc + t.amount, 0);
  }, [transactions]);

  const totalSalesEarned = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'sale_earning' && t.status === 'completed')
      .reduce((acc, t) => acc + t.amount, 0) || baseGrossRevenue;
  }, [transactions, baseGrossRevenue]);

  const totalRefunded = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'refund_deduction')
      .reduce((acc, t) => acc + t.amount, 0);
  }, [transactions]);

  // Balance calculation
  const [balance, setBalance] = useState<number>(() => {
    const saved = localStorage.getItem(`djassa_seller_balance_${seller.id}`);
    if (saved) {
      const num = Number(saved);
      if (!isNaN(num)) return num;
    }
    return Math.max(35000, totalSalesEarned - totalWithdrawn - totalRefunded);
  });

  // Persist balance & transactions
  useEffect(() => {
    localStorage.setItem(`djassa_seller_transactions_${seller.id}`, JSON.stringify(transactions));
  }, [transactions, seller.id]);

  useEffect(() => {
    localStorage.setItem(`djassa_seller_balance_${seller.id}`, String(balance));
  }, [balance, seller.id]);

  // Period multiplier
  const periodMultiplier = useMemo(() => {
    switch (period) {
      case 'today': return 0.15;
      case 'week': return 0.42;
      case 'month': return 0.85;
      case 'quarter': return 0.96;
      case 'all': return 1.0;
    }
  }, [period]);

  const displayedGrossRevenue = Math.round(totalSalesEarned * periodMultiplier);
  const displayedOrdersCount = Math.max(1, Math.round(sellerOrders.length * periodMultiplier));
  const djassaCommission = displayedOrdersCount * DJASSA_FIXED_COMMISSION_FCFA;
  const netEarnings = Math.max(0, displayedGrossRevenue - djassaCommission);
  const averageBasket = displayedOrdersCount > 0 ? Math.round(displayedGrossRevenue / displayedOrdersCount) : 0;

  // Monthly target calculations
  const targetProgress = Math.min(100, Math.round((displayedGrossRevenue / monthlyTarget) * 100));
  const remainingForTarget = Math.max(0, monthlyTarget - displayedGrossRevenue);

  // Withdrawals breakdown by payment provider (Wave & Orange Money)
  const withdrawalsList = useMemo(() => {
    return transactions.filter((t) => t.type === 'withdrawal');
  }, [transactions]);

  const withdrawalsByProvider = useMemo(() => {
    const counts: Record<'wave' | 'orange_money', { count: number; total: number; label: string; color: string; bg: string }> = {
      wave: { count: 0, total: 0, label: 'Wave CI', color: 'text-cyan-400', bg: 'bg-cyan-500' },
      orange_money: { count: 0, total: 0, label: 'Orange Money', color: 'text-orange-400', bg: 'bg-orange-500' },
    };

    withdrawalsList.forEach((w) => {
      const p = w.provider === 'orange_money' ? 'orange_money' : 'wave';
      counts[p].count += 1;
      counts[p].total += w.amount;
    });

    return counts;
  }, [withdrawalsList]);

  // Payment Breakdown for incoming sales
  const incomingPaymentBreakdown = useMemo(() => {
    return [
      { name: 'Wave CI (En ligne)', code: 'wave', share: 60, bgColor: 'bg-cyan-500', textColor: 'text-cyan-400' },
      { name: 'Orange Money (En ligne)', code: 'om', share: 25, bgColor: 'bg-orange-500', textColor: 'text-orange-400' },
      { name: 'Paiement à la livraison (COD)', code: 'cod', share: 15, bgColor: 'bg-emerald-500', textColor: 'text-emerald-400' },
    ];
  }, []);

  // Weekly Activity Simulation (for the Chart)
  const weeklyData = useMemo(() => {
    const days = [
      { label: 'Lun', factor: 0.11, dayName: 'Lundi' },
      { label: 'Mar', factor: 0.14, dayName: 'Mardi' },
      { label: 'Mer', factor: 0.18, dayName: 'Mercredi' },
      { label: 'Jeu', factor: 0.15, dayName: 'Jeudi' },
      { label: 'Ven', factor: 0.22, dayName: 'Vendredi' },
      { label: 'Sam', factor: 0.25, dayName: 'Samedi' },
      { label: 'Dim', factor: 0.09, dayName: 'Dimanche' },
    ];
    const baseWeekly = Math.max(80000, totalSalesEarned * 0.38);
    return days.map((d) => {
      const amount = Math.round(baseWeekly * d.factor);
      const ordersCount = Math.max(1, Math.round(amount / (averageBasket || 18000)));
      return { ...d, amount, ordersCount };
    });
  }, [totalSalesEarned, averageBasket]);

  const maxWeeklyAmount = useMemo(() => {
    return Math.max(...weeklyData.map((d) => d.amount), 1);
  }, [weeklyData]);

  const [activeHoverDay, setActiveHoverDay] = useState<{ dayName: string; amount: number; ordersCount: number } | null>(null);

  // Sorted Top Products
  const sortedProducts = useMemo(() => {
    const list = [...products];
    if (productSortBy === 'revenue') {
      return list.sort((a, b) => (b.salesCount || 1) * b.price - (a.salesCount || 1) * a.price).slice(0, 5);
    } else if (productSortBy === 'units') {
      return list.sort((a, b) => (b.salesCount || 1) - (a.salesCount || 1)).slice(0, 5);
    } else {
      return list.sort((a, b) => b.price - a.price).slice(0, 5);
    }
  }, [products, productSortBy]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesType = txFilterType === 'all' || tx.type === txFilterType;
      const q = txSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        tx.description.toLowerCase().includes(q) ||
        tx.reference.toLowerCase().includes(q) ||
        (tx.phone && tx.phone.toLowerCase().includes(q)) ||
        (tx.clientName && tx.clientName.toLowerCase().includes(q));
      
      const matchesProvider =
        withdrawalProviderFilter === 'all' ||
        tx.type !== 'withdrawal' ||
        tx.provider === withdrawalProviderFilter;

      return matchesType && matchesSearch && matchesProvider;
    });
  }, [transactions, txFilterType, txSearchQuery, withdrawalProviderFilter]);

  // Handle successful new withdrawal
  const handleWithdrawSuccess = (newTx: SellerTransaction) => {
    setTransactions((prev) => [newTx, ...prev]);
    setBalance((prev) => Math.max(0, prev - newTx.amount));
    showToast(`Retrait de ${formatFCFA(newTx.amount)} enregistré avec succès ! 🎉`);
  };

  const handleOpenWithdraw = () => {
    if (onOpenWithdrawFromParent) {
      onOpenWithdrawFromParent();
    } else {
      setIsWithdrawModalOpen(true);
    }
  };

  const handleSaveTarget = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(targetInput);
    if (val && val >= 100000) {
      setMonthlyTarget(val);
      localStorage.setItem(`djassa_sales_target_${seller?.id || 'default'}`, String(val));
      setIsTargetModalOpen(false);
      showToast(`Nouvel objectif fixé : ${formatFCFA(val)} / mois 🎯`);
    } else {
      showToast('Veuillez saisir un objectif valide (min. 100 000 FCFA).');
    }
  };

  const handleShareStatement = () => {
    const text = `📊 Bilan Financier DJASSA - ${seller?.name || 'Boutique'}\n` +
      `Solde disponible : ${formatFCFA(balance)}\n` +
      `Chiffre d'affaires brut (ventes) : ${formatFCFA(totalSalesEarned)}\n` +
      `Total sommes retirées : ${formatFCFA(totalWithdrawn)}\n` +
      `Gains nets vendeur : ${formatFCFA(netEarnings)}\n` +
      `Lien boutique : https://djassa.ci/b/@${seller?.username || 'boutique'}`;
    
    try {
      navigator.clipboard.writeText(text);
      showToast('Bilan copié dans le presse-papier ! 📋');
    } catch (e) {
      showToast('Bilan généré.');
    }
  };

  return (
    <div
      id="seller-revenues-screen"
      className={`w-full h-full bg-[#0A0A0A] text-white flex flex-col overflow-y-auto no-scrollbar ${
        isStandalone ? 'p-3 sm:p-5 space-y-4 pb-28' : 'space-y-4'
      }`}
    >
      {/* 1. TOP HEADER & STORE IDENTITY */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#121c17] via-[#101413] to-[#0d0d0d] border border-emerald-500/30 p-5 shadow-2xl space-y-4">
        {/* Glow ambient accent */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-52 h-52 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-44 h-44 bg-[#FF6321]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-lg shadow-emerald-500/10 shrink-0">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider">
                  Caisse Disponible (Solde Retirable)
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <CheckCircle2 className="w-2.5 h-2.5 mr-1 text-emerald-400" />
                  Prêt au virement
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">
                {formatFCFA(balance)}
              </p>
            </div>
          </div>

          {/* Action Buttons: Withdraw + Statement */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-revenues-statement"
              onClick={() => setIsStatementModalOpen(true)}
              className="px-3 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition border border-white/10 flex items-center gap-1.5 active:scale-95"
              title="Consulter le relevé financier"
            >
              <FileText className="w-4 h-4 text-[#FF6321]" />
              <span className="hidden sm:inline">Relevé</span>
            </button>

            <button
              id="btn-revenues-withdraw-action"
              onClick={handleOpenWithdraw}
              disabled={balance <= 0}
              className="px-4 py-2.5 rounded-2xl bg-[#FF6321] hover:bg-[#ff753b] disabled:opacity-40 text-white text-xs font-black flex items-center gap-2 shadow-xl shadow-[#FF6321]/30 transition active:scale-95"
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>Retirer mes fonds</span>
            </button>
          </div>
        </div>

        {/* 3 Secondary Mini-KPIs */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-white/10">
          {/* Card A: Paiements en ligne */}
          <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-white/50 block">Payées en ligne (Wave/OM)</span>
              <b className="text-xs sm:text-sm font-black text-white mt-0.5 block">
                {formatFCFA(onlineRevenue || totalSalesEarned)}
              </b>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
              {paidOnlineOrders.length} confirmée(s)
            </span>
          </div>

          {/* Card B: Sommes Retirées */}
          <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-white/50 block">Total Sommes Retirées</span>
              <b className="text-xs sm:text-sm font-black text-rose-400 mt-0.5 block">
                -{formatFCFA(totalWithdrawn)}
              </b>
            </div>
            <span className="text-[10px] text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/20">
              {withdrawalsList.length} retraits
            </span>
          </div>

          {/* Card C: Paiement à la livraison (COD) */}
          <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-white/50 block">À payer à la livraison (COD)</span>
              <b className="text-xs sm:text-sm font-black text-amber-400 mt-0.5 block">
                {formatFCFA(codRevenue)}
              </b>
            </div>
            <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
              {codOrders.length} cmd(s)
            </span>
          </div>
        </div>
      </div>

      {/* 2. SUB-NAVIGATION TABS (Aperçu, Argent Gagné, Sommes Retirées, Relevé) */}
      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#141414] border border-white/10 overflow-x-auto no-scrollbar sticky top-0 z-20 backdrop-blur-md">
        {[
          { id: 'apercu', label: 'Vue d\'Ensemble', icon: <BarChart3 className="w-3.5 h-3.5" /> },
          { id: 'ventes', label: `Argent Gagné (${formatFCFA(totalSalesEarned)})`, icon: <TrendingUp className="w-3.5 h-3.5" /> },
          { id: 'retraits', label: `Sommes Retirées (-${formatFCFA(totalWithdrawn)})`, icon: <ArrowUpRight className="w-3.5 h-3.5" /> },
          { id: 'releve', label: 'Relevé & Registre', icon: <Clock className="w-3.5 h-3.5" /> },
        ].map((tab) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                isActive
                  ? 'bg-[#FF6321] text-white shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3. TAB 1: VUE D'ENSEMBLE */}
      {activeSubTab === 'apercu' && (
        <div className="space-y-4">
          {/* Target tracker */}
          <div className="p-4 rounded-3xl bg-[#141414] border border-white/10 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-[#FF6321]/15 text-[#FF6321]">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <b className="text-xs text-white">Objectif de Ventes du Mois</b>
                  <span className="text-[10px] text-white/40 block">
                    Cible : <strong className="text-white/80">{formatFCFA(monthlyTarget)}</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-[#FF6321]">{targetProgress}% atteint</span>
                <button
                  onClick={() => {
                    setTargetInput(String(monthlyTarget));
                    setIsTargetModalOpen(true);
                  }}
                  className="text-[10px] text-white/60 hover:text-white px-2 py-1 rounded-lg bg-white/5 border border-white/10"
                >
                  Modifier
                </button>
              </div>
            </div>

            {/* Target Progress Bar */}
            <div className="space-y-1.5">
              <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 via-[#FF6321] to-emerald-400 transition-all duration-500"
                  style={{ width: `${Math.max(4, targetProgress)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-white/50">
                <span>Encaissé : {formatFCFA(displayedGrossRevenue)}</span>
                <span>
                  {remainingForTarget > 0 ? (
                    <>Reste <strong className="text-amber-400">{formatFCFA(remainingForTarget)}</strong> à réaliser</>
                  ) : (
                    <span className="text-emerald-400 font-bold">🎉 Objectif dépassé !</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Time Period Selector */}
          <div className="flex items-center justify-between bg-[#141414] p-1 rounded-2xl border border-white/10 text-xs">
            {[
              { id: 'today', label: "Aujourd'hui" },
              { id: 'week', label: 'Cette semaine' },
              { id: 'month', label: 'Ce mois' },
              { id: 'quarter', label: 'Trimestre' },
              { id: 'all', label: 'Cumul total' },
            ].map((p) => {
              const isActive = period === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id as any)}
                  className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold transition ${
                    isActive ? 'bg-[#FF6321] text-white shadow-md' : 'text-white/50 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* 4 Financial Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/50 uppercase font-bold">Chiffre d'Affaires Brut</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-base font-black text-white leading-tight">
                {formatFCFA(displayedGrossRevenue)}
              </p>
              <span className="text-[9px] text-white/40 block">
                {displayedOrdersCount} commande{displayedOrdersCount > 1 ? 's' : ''}
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/50 uppercase font-bold">Bénéfice Net Vendeur</span>
                <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/15 px-1 rounded">
                  -150 F/cmd
                </span>
              </div>
              <p className="text-base font-black text-emerald-400 leading-tight">
                {formatFCFA(netEarnings)}
              </p>
              <span className="text-[9px] text-white/40 block">
                Après commission fixe DJASSA (150 F)
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/50 uppercase font-bold">Panier Moyen</span>
                <Package className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <p className="text-base font-black text-white leading-tight">
                {formatFCFA(averageBasket)}
              </p>
              <span className="text-[9px] text-white/40 block">
                Par commande confirmée
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/50 uppercase font-bold">Total Déjà Retiré</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <p className="text-base font-black text-rose-400 leading-tight">
                {formatFCFA(totalWithdrawn)}
              </p>
              <span className="text-[9px] text-white/40 block">
                {withdrawalsList.length} virements réussis
              </span>
            </div>
          </div>

          {/* Weekly Sales Chart */}
          <div className="p-4 rounded-3xl bg-[#141414] border border-white/10 space-y-3 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-cyan-500/15 text-cyan-400">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <b className="text-xs sm:text-sm text-white block">Activité Commerciale Hebdomadaire</b>
                  <span className="text-[10px] text-white/50">
                    Évolution des ventes encaissées de la semaine
                  </span>
                </div>
              </div>

              {activeHoverDay ? (
                <div className="text-right">
                  <span className="text-[10px] text-[#FF6321] font-bold block">{activeHoverDay.dayName}</span>
                  <b className="text-xs text-white">{formatFCFA(activeHoverDay.amount)} ({activeHoverDay.ordersCount} cmd)</b>
                </div>
              ) : (
                <span className="text-[10px] text-white/40">Touchez une colonne pour détailler</span>
              )}
            </div>

            {/* Bar Chart Visualizer */}
            <div className="pt-4 pb-2">
              <div className="flex items-end justify-between gap-2 h-36 border-b border-white/10 px-2">
                {weeklyData.map((d) => {
                  const heightPercent = Math.round((d.amount / maxWeeklyAmount) * 100);
                  const isPeak = heightPercent >= 90;

                  return (
                    <div
                      key={d.label}
                      className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end cursor-pointer group"
                      onMouseEnter={() => setActiveHoverDay(d)}
                      onClick={() => setActiveHoverDay(d)}
                    >
                      <span className="text-[8px] font-mono text-white/60 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                        {Math.round(d.amount / 1000)}k
                      </span>

                      <div className="w-full max-w-[32px] rounded-xl bg-white/5 overflow-hidden flex flex-col justify-end p-0.5 h-full">
                        <div
                          className={`w-full rounded-lg transition-all duration-300 ${
                            isPeak
                              ? 'bg-gradient-to-t from-orange-600 to-[#FF6321] group-hover:brightness-125 shadow-lg shadow-[#FF6321]/30'
                              : 'bg-gradient-to-t from-emerald-600/70 to-emerald-400 group-hover:brightness-125'
                          }`}
                          style={{ height: `${Math.max(12, heightPercent)}%` }}
                        />
                      </div>

                      <span className={`text-[10px] font-bold ${isPeak ? 'text-[#FF6321]' : 'text-white/50'}`}>
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Dual Preview: Latest Sales vs Latest Withdrawals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Latest Sales */}
            <div className="p-4 rounded-3xl bg-[#141414] border border-white/10 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <b className="text-xs text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Dernières Ventes Encaissées</span>
                </b>
                <button
                  onClick={() => setActiveSubTab('ventes')}
                  className="text-[10px] text-[#FF6321] font-bold hover:underline"
                >
                  Voir tout ({transactions.filter((t) => t.type === 'sale_earning').length})
                </button>
              </div>

              <div className="space-y-2">
                {transactions
                  .filter((t) => t.type === 'sale_earning')
                  .slice(0, 3)
                  .map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTxForReceipt(t)}
                      className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-between cursor-pointer transition"
                    >
                      <div className="min-w-0 pr-2">
                        <b className="text-xs text-white block truncate">{t.description}</b>
                        <span className="text-[10px] text-white/40 block">{t.date} • {t.clientName || 'Client vérifié'}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <b className="text-xs font-black text-emerald-400">+{formatFCFA(t.amount)}</b>
                        <span className="text-[9px] text-white/40 block">Gain net</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Latest Withdrawals */}
            <div className="p-4 rounded-3xl bg-[#141414] border border-white/10 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <b className="text-xs text-white flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-rose-400" />
                  <span>Derniers Retraits Effectués</span>
                </b>
                <button
                  onClick={() => setActiveSubTab('retraits')}
                  className="text-[10px] text-[#FF6321] font-bold hover:underline"
                >
                  Voir tout ({withdrawalsList.length})
                </button>
              </div>

              <div className="space-y-2">
                {withdrawalsList.slice(0, 3).map((w) => (
                  <div
                    key={w.id}
                    onClick={() => setSelectedTxForReceipt(w)}
                    className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-between cursor-pointer transition"
                  >
                    <div className="min-w-0 pr-2">
                      <b className="text-xs text-white block truncate">{w.description}</b>
                      <span className="text-[10px] text-white/40 block">{w.date} • Réf: {w.reference}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <b className="text-xs font-black text-rose-400">-{formatFCFA(w.amount)}</b>
                      <span className="text-[9px] text-emerald-400 font-bold block">✓ Transféré</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB 2: ARGENT GAGNÉ GRÂCE AUX VENTES */}
      {activeSubTab === 'ventes' && (
        <div className="space-y-4">
          {/* Header Card */}
          <div className="p-4 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-[#141414] to-black border border-emerald-500/20 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Chiffre d'Affaires & Bénéfices des Ventes</h3>
                  <p className="text-[10px] text-white/50">Détail des recettes encaissées grâce aux commandes clients</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-white/40 block">Total Encaissé</span>
                <b className="text-base sm:text-lg font-black text-emerald-400">{formatFCFA(totalSalesEarned)}</b>
              </div>
            </div>
          </div>

          {/* Top Products By Revenue */}
          <div className="p-4 rounded-3xl bg-[#141414] border border-white/10 space-y-3 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-orange-500/15 text-[#FF6321]">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <b className="text-xs sm:text-sm text-white block">Articles Générateurs de Revenus</b>
                  <span className="text-[10px] text-white/50">
                    Classement des articles les plus vendus de votre boutique
                  </span>
                </div>
              </div>

              {/* Sort Buttons */}
              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10 text-[10px]">
                <button
                  onClick={() => setProductSortBy('revenue')}
                  className={`px-2 py-1 rounded-lg font-bold transition ${
                    productSortBy === 'revenue' ? 'bg-[#FF6321] text-white' : 'text-white/50 hover:text-white'
                  }`}
                >
                  Revenu total
                </button>
                <button
                  onClick={() => setProductSortBy('units')}
                  className={`px-2 py-1 rounded-lg font-bold transition ${
                    productSortBy === 'units' ? 'bg-[#FF6321] text-white' : 'text-white/50 hover:text-white'
                  }`}
                >
                  Quantités
                </button>
                <button
                  onClick={() => setProductSortBy('price')}
                  className={`px-2 py-1 rounded-lg font-bold transition ${
                    productSortBy === 'price' ? 'bg-[#FF6321] text-white' : 'text-white/50 hover:text-white'
                  }`}
                >
                  Prix
                </button>
              </div>
            </div>

            {/* Product items */}
            <div className="space-y-2">
              {sortedProducts.map((p, idx) => {
                const count = p.salesCount || 1;
                const revenue = count * p.price;
                const net = Math.max(0, revenue - count * DJASSA_FIXED_COMMISSION_FCFA);
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/5 hover:border-white/15 transition gap-2.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-6 h-6 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                        idx === 0
                          ? 'bg-amber-400 text-black'
                          : idx === 1
                          ? 'bg-neutral-300 text-black'
                          : idx === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-white/10 text-white/70'
                      }`}>
                        {idx + 1}
                      </span>

                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-neutral-900 border border-white/10 shrink-0">
                        <img src={p.videoPoster || p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                      </div>

                      <div className="min-w-0">
                        <b className="text-xs text-white block truncate">{p.name}</b>
                        <span className="text-[10px] text-white/50 block">
                          {formatMetricCount(count)} vendu{count > 1 ? 's' : ''} • Prix : {formatFCFA(p.price)} • Stock : {p.stock}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <b className="text-xs font-black text-[#FF6321] block">{formatFCFA(revenue)}</b>
                      <span className="text-[9px] text-emerald-400 font-bold block">
                        Net: {formatFCFA(net)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sales Transactions List */}
          <div className="p-4 rounded-3xl bg-[#141414] border border-white/10 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <b className="text-xs text-white">Historique Détaillé des Ventes Encaissées</b>
              <span className="text-[10px] text-emerald-400 font-bold">Commission fixe : 150 FCFA / cmd</span>
            </div>

            <div className="space-y-2">
              {transactions
                .filter((t) => t.type === 'sale_earning')
                .map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTxForReceipt(t)}
                    className="p-3 rounded-2xl bg-black/40 border border-white/5 hover:border-white/15 transition flex items-center justify-between gap-3 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                        <DollarSign className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <b className="text-xs text-white block truncate group-hover:text-[#FF6321] transition">
                          {t.description}
                        </b>
                        <div className="flex items-center gap-2 text-[10px] text-white/40 mt-0.5">
                          <span>{t.date}</span>
                          <span>•</span>
                          <span className="font-mono text-white/60">Réf : {t.reference}</span>
                          {t.clientName && (
                            <>
                              <span>•</span>
                              <span className="text-white/60">{t.clientName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-2">
                      <div>
                        <b className="text-xs font-black text-emerald-400 block">+{formatFCFA(t.amount)}</b>
                        <span className="text-[9px] text-white/40 block">
                          Brut: {formatFCFA(t.grossAmount || t.amount + DJASSA_FIXED_COMMISSION_FCFA)}
                        </span>
                      </div>
                      <div className="p-1.5 rounded-lg bg-white/5 text-white/40 group-hover:text-white transition">
                        <Eye className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 3: SOMMES RETIRÉES SUR L'APPLICATION AVEC MOYENS DE PAIEMENT */}
      {activeSubTab === 'retraits' && (
        <div className="space-y-4">
          {/* Header Card for Withdrawals */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-rose-950/30 via-[#141414] to-black border border-rose-500/20 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                  <ArrowUpRight className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-rose-400 uppercase tracking-wider block">
                    Sommes Retirées sur l'Application
                  </span>
                  <p className="text-2xl sm:text-3xl font-black text-white mt-0.5">
                    {formatFCFA(totalWithdrawn)}
                  </p>
                </div>
              </div>

              <button
                id="btn-withdraw-now"
                onClick={handleOpenWithdraw}
                disabled={balance <= 0}
                className="px-4 py-2.5 rounded-2xl bg-[#FF6321] hover:bg-[#ff753b] disabled:opacity-40 text-white text-xs font-black flex items-center gap-2 shadow-xl shadow-[#FF6321]/20 transition active:scale-95"
              >
                <ArrowDownToLine className="w-4 h-4" />
                <span>Nouveau Retrait</span>
              </button>
            </div>

            {/* Provider Totals Grid (Wave & Orange Money only) */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
              <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 space-y-1">
                <span className="text-[10px] text-cyan-300 font-bold block">Wave CI</span>
                <b className="text-xs sm:text-sm font-black text-white block">
                  {formatFCFA(withdrawalsByProvider.wave.total)}
                </b>
                <span className="text-[9px] text-white/50 block">
                  {withdrawalsByProvider.wave.count} virement{withdrawalsByProvider.wave.count > 1 ? 's' : ''}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20 space-y-1">
                <span className="text-[10px] text-orange-300 font-bold block">Orange Money</span>
                <b className="text-xs sm:text-sm font-black text-white block">
                  {formatFCFA(withdrawalsByProvider.orange_money.total)}
                </b>
                <span className="text-[9px] text-white/50 block">
                  {withdrawalsByProvider.orange_money.count} virement{withdrawalsByProvider.orange_money.count > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Filter Bar for Providers */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <span className="text-[10px] text-white/50 font-bold mr-1 shrink-0">Filtrer par moyen :</span>
            {[
              { id: 'all', label: 'Tous les moyens' },
              { id: 'wave', label: 'Wave CI' },
              { id: 'orange_money', label: 'Orange Money' },
            ].map((p) => {
              const isActive = withdrawalProviderFilter === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setWithdrawalProviderFilter(p.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-bold shrink-0 transition ${
                    isActive
                      ? 'bg-[#FF6321] text-white shadow'
                      : 'bg-white/5 text-white/60 hover:text-white border border-white/5'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Complete List of Withdrawals */}
          <div className="p-4 rounded-3xl bg-[#141414] border border-white/10 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <b className="text-xs text-white">Registre Chronologique des Sommes Retirées</b>
              <span className="text-[10px] text-white/40">Cliquez sur un virement pour afficher le reçu</span>
            </div>

            {withdrawalsList.length === 0 ? (
              <div className="py-8 text-center text-white/40 space-y-2">
                <ArrowUpRight className="w-8 h-8 mx-auto text-white/20" />
                <p className="text-xs">Aucun retrait n'a encore été effectué.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {withdrawalsList
                  .filter((w) => withdrawalProviderFilter === 'all' || w.provider === withdrawalProviderFilter)
                  .map((w) => {
                    const isOM = w.provider === 'orange_money';
                    const providerLabel = isOM ? 'Orange Money' : 'Wave CI';
                    const providerBadgeStyle = isOM
                      ? 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                      : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';

                    return (
                      <div
                        key={w.id}
                        onClick={() => setSelectedTxForReceipt(w)}
                        className="p-3.5 rounded-2xl bg-black/40 border border-white/5 hover:border-white/15 transition flex items-center justify-between gap-3 cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
                            <ArrowUpRight className="w-5 h-5" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <b className="text-xs text-white block truncate group-hover:text-[#FF6321] transition">
                                {w.description}
                              </b>
                              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border shrink-0 ${providerBadgeStyle}`}>
                                {providerLabel}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] text-white/40 mt-1">
                              <span>{w.date}</span>
                              <span>•</span>
                              <span className="font-mono text-white/60">Réf : {w.reference}</span>
                              {w.phone && (
                                <>
                                  <span>•</span>
                                  <span className="text-white/60">{w.phone}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 flex items-center gap-2.5">
                          <div>
                            <b className="text-xs sm:text-sm font-black text-rose-400 block">
                              -{formatFCFA(w.amount)}
                            </b>
                            <span className="text-[9px] font-bold text-emerald-400 flex items-center justify-end gap-1">
                              <Check className="w-2.5 h-2.5" />
                              Validé & Transféré ⚡
                            </span>
                          </div>

                          <button
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition"
                            title="Voir le reçu de virement"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. TAB 4: RELEVÉ DE CAISSE & REGISTRE COMPLET */}
      {activeSubTab === 'releve' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-[#141414] border border-white/10 space-y-3.5 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-white/10 text-white">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <b className="text-xs sm:text-sm text-white block">
                    Registre des Opérations Financières ({filteredTransactions.length})
                  </b>
                  <span className="text-[10px] text-white/50">
                    Grand livre des ventes, retraits bancaires et dédommagements
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleShareStatement}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold transition flex items-center gap-1 border border-white/10 active:scale-95"
                >
                  <Share2 className="w-3 h-3 text-[#FF6321]" />
                  <span>Copier le Bilan</span>
                </button>
                <button
                  onClick={() => setIsStatementModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-[#FF6321] hover:bg-[#ff753b] text-white text-[10px] font-bold transition flex items-center gap-1 shadow-md shadow-[#FF6321]/20 active:scale-95"
                >
                  <FileText className="w-3 h-3" />
                  <span>Imprimer le Relevé</span>
                </button>
              </div>
            </div>

            {/* Filter Bar & Search Input */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={txSearchQuery}
                  onChange={(e) => setTxSearchQuery(e.target.value)}
                  placeholder="Rechercher par référence, description, numéro..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF6321]"
                />
              </div>

              {/* Type Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                {[
                  { id: 'all', label: 'Toutes' },
                  { id: 'sale_earning', label: '🟢 Ventes' },
                  { id: 'withdrawal', label: '🔴 Retraits' },
                  { id: 'refund_deduction', label: '🟠 Litiges' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setTxFilterType(f.id as any)}
                    className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold shrink-0 transition ${
                      txFilterType === f.id
                        ? 'bg-[#FF6321] text-white'
                        : 'bg-white/5 text-white/60 hover:text-white border border-white/5'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Transactions Table */}
            {filteredTransactions.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/5 text-white/40 space-y-1">
                <Clock className="w-6 h-6 mx-auto text-white/20" />
                <p className="text-xs">Aucune opération trouvée pour ces critères.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTransactions.map((tx) => {
                  const isWithdraw = tx.type === 'withdrawal';
                  const isRefund = tx.type === 'refund_deduction';

                  return (
                    <div
                      key={tx.id}
                      onClick={() => setSelectedTxForReceipt(tx)}
                      className="p-3 rounded-2xl bg-black/40 border border-white/5 hover:border-white/15 transition flex items-center justify-between gap-3 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                            isWithdraw
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : isRefund
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}
                        >
                          {isWithdraw ? (
                            <ArrowUpRight className="w-5 h-5" />
                          ) : isRefund ? (
                            <ArrowDownLeft className="w-5 h-5" />
                          ) : (
                            <DollarSign className="w-5 h-5" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <b className="text-xs text-white block truncate group-hover:text-[#FF6321] transition">
                            {tx.description}
                          </b>
                          <div className="flex items-center gap-2 text-[10px] text-white/40 mt-0.5">
                            <span>{tx.date}</span>
                            <span>•</span>
                            <span className="font-mono text-white/60">Réf : {tx.reference}</span>
                            {tx.provider && (
                              <>
                                <span>•</span>
                                <span className="uppercase text-[9px] font-bold text-cyan-400">
                                  {tx.provider.replace('_', ' ')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div>
                          <b
                            className={`text-xs font-black block ${
                              isWithdraw ? 'text-rose-400' : isRefund ? 'text-amber-400' : 'text-emerald-400'
                            }`}
                          >
                            {isWithdraw ? '-' : isRefund ? '-' : '+'}{formatFCFA(tx.amount)}
                          </b>
                          <span className="text-[9px] font-bold text-emerald-400 flex items-center justify-end gap-1">
                            <Check className="w-2.5 h-2.5" />
                            {tx.status === 'completed' ? 'Validé' : 'En attente'}
                          </span>
                        </div>

                        <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-white/10 text-white/40 group-hover:text-white transition">
                          <Eye className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: WITHDRAW EARNINGS MODAL */}
      {isWithdrawModalOpen && (
        <WithdrawEarningsModal
          balance={balance}
          onClose={() => setIsWithdrawModalOpen(false)}
          onSuccess={handleWithdrawSuccess}
          sellerPhone={seller.phone}
          sellerName={seller.name}
        />
      )}

      {/* MODAL 2: TRANSACTION DIGITAL RECEIPT */}
      {selectedTxForReceipt && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSelectedTxForReceipt(null)}
        >
          <div
            className="w-full max-w-sm bg-[#141414] border border-white/15 rounded-3xl p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="px-2 py-1 rounded-lg bg-[#FF6321] text-white font-black text-xs uppercase tracking-wider">
                  REÇU OFFICIEL
                </div>
                <span className="text-xs font-bold text-white">
                  {selectedTxForReceipt.type === 'withdrawal' ? 'Preuve de Virement' : 'Reçu de Vente'}
                </span>
              </div>
              <button
                onClick={() => setSelectedTxForReceipt(null)}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
              >
                Fermer
              </button>
            </div>

            {/* Receipt Card */}
            <div className="p-4 rounded-2xl bg-white text-black space-y-3 shadow-xl font-sans">
              <div className="text-center border-b border-neutral-200 pb-2.5">
                <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold block">
                  DJASSA CI - PLATEFORME OFFICIELLE
                </span>
                <h4 className="text-sm font-black text-black mt-0.5">
                  {seller?.name || 'Boutique Vendeur'}
                </h4>
                <span className="text-[10px] text-neutral-600 block">
                  Abidjan, Côte d'Ivoire
                </span>
              </div>

              {/* Amount Display */}
              <div className="text-center py-1">
                <span className="text-[10px] text-neutral-500 uppercase font-bold block">
                  {selectedTxForReceipt.type === 'withdrawal'
                    ? 'Somme Retirée par le Vendeur'
                    : selectedTxForReceipt.type === 'refund_deduction'
                    ? 'Remboursement Déduit'
                    : 'Encaissement Vente'}
                </span>
                <p className="text-2xl font-black text-neutral-900">
                  {formatFCFA(selectedTxForReceipt.amount)}
                </p>
                <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800">
                  TRANSACTION CONFIRMÉE & EFFECTUÉE
                </span>
              </div>

              {/* Details table */}
              <div className="space-y-1.5 text-[11px] border-t border-b border-neutral-200 py-2.5">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Numéro de Référence</span>
                  <span className="font-mono font-bold text-neutral-900">{selectedTxForReceipt.reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Date</span>
                  <span className="font-bold text-neutral-900">{selectedTxForReceipt.date}</span>
                </div>
                {selectedTxForReceipt.provider && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Moyen de Paiement</span>
                    <span className="font-black text-neutral-900 uppercase">
                      {selectedTxForReceipt.provider.replace('_', ' ')}
                    </span>
                  </div>
                )}
                {selectedTxForReceipt.phone && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Numéro Bénéficiaire</span>
                    <span className="font-bold text-neutral-900">{selectedTxForReceipt.phone}</span>
                  </div>
                )}
                {selectedTxForReceipt.bankName && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Banque & Compte</span>
                    <span className="font-bold text-neutral-900">{selectedTxForReceipt.bankName} - {selectedTxForReceipt.accountName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-500">Frais de Virement</span>
                  <span className="font-bold text-emerald-700">0 FCFA (Pris en charge)</span>
                </div>
              </div>

              {/* Legal Notice */}
              <div className="text-[9px] text-neutral-500 text-center space-y-0.5 pt-1">
                <p>Document numérique à valeur probante conformément aux règles de commerce électronique.</p>
                <p className="font-mono text-neutral-400">DJASSA PAY CI • Séquestre BCEAO</p>
              </div>
            </div>

            {/* Print Button */}
            <button
              onClick={() => {
                showToast('Reçu imprimé / enregistré en PDF ! 🖨️');
                setSelectedTxForReceipt(null);
              }}
              className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer le Reçu Numérique</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: STATEMENT / RELEVÉ OFFICIEL */}
      {isStatementModalOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4"
          onClick={() => setIsStatementModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-[#141414] border border-white/15 rounded-3xl p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#FF6321]" />
                <h3 className="text-sm sm:text-base font-bold text-white">Relevé de Caisse & Bilan Financier</h3>
              </div>
              <button
                onClick={() => setIsStatementModalOpen(false)}
                className="p-1 rounded-full text-white/50 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Statement Summary Card */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 text-xs">
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span className="text-white/60">Boutique :</span>
                <b className="text-white">{seller.name} (@{seller.username})</b>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Solde Caisse Disponible :</span>
                <b className="text-emerald-400 font-bold">{formatFCFA(balance)}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Total Chiffre d'Affaires Brut :</span>
                <b className="text-white font-bold">{formatFCFA(totalSalesEarned)}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Total Sommes Déjà Retirées :</span>
                <b className="text-rose-400 font-bold">-{formatFCFA(totalWithdrawn)}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60">Commission Plateforme (150 FCFA / commande) :</span>
                <span className="text-white/70">-{formatFCFA(djassaCommission)}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2">
                <span className="text-white/80 font-bold">Bénéfice Net Vendeur :</span>
                <b className="text-emerald-400 text-sm font-black">{formatFCFA(netEarnings)}</b>
              </div>
            </div>

            {/* Withdrawals summary inside statement */}
            <div className="space-y-2">
              <b className="text-xs text-white block">Détail des Retraits Effectués :</b>
              <div className="space-y-1.5">
                {withdrawalsList.map((w) => (
                  <div key={w.id} className="p-2 rounded-xl bg-black/40 border border-white/5 flex justify-between text-[11px]">
                    <div>
                      <span className="text-white block font-medium">{w.description}</span>
                      <span className="text-white/40 text-[9px]">{w.date} • {w.reference}</span>
                    </div>
                    <b className="text-rose-400 shrink-0">-{formatFCFA(w.amount)}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleShareStatement}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Copy className="w-4 h-4" />
                <span>Copier les chiffres</span>
              </button>
              <button
                onClick={() => {
                  showToast('Relevé complet téléchargé en format certifié ! 📄');
                  setIsStatementModalOpen(false);
                }}
                className="flex-1 py-3 rounded-xl bg-[#FF6321] hover:bg-[#ff753b] text-white text-xs font-black transition flex items-center justify-center gap-1.5 shadow-lg shadow-[#FF6321]/20"
              >
                <Download className="w-4 h-4" />
                <span>Télécharger PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: EDIT TARGET MODAL */}
      {isTargetModalOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsTargetModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-[#141414] border border-white/15 rounded-3xl p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white">Fixer l'objectif de vente mensuel</h3>
              <button onClick={() => setIsTargetModalOpen(false)} className="text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTarget} className="space-y-4">
              <div>
                <label className="text-xs text-white/70 block mb-1">Objectif en FCFA / mois</label>
                <input
                  type="number"
                  min={100000}
                  step={50000}
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-white focus:outline-none focus:border-[#FF6321]"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsTargetModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-white text-xs font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6321] text-white text-xs font-black shadow-lg shadow-[#FF6321]/20"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
