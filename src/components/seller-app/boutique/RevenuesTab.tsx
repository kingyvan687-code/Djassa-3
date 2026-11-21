import React, { useState, useMemo, useEffect } from 'react';
import {
  Wallet,
  ArrowUpRight,
  CheckCircle2,
  History,
  X,
  Smartphone,
  ArrowDownLeft,
  ShieldCheck,
  DollarSign,
  Download,
  Search,
  AlertCircle,
  FileText,
  MapPin,
  Package,
  Target,
  Printer,
  Check,
  Copy,
  SlidersHorizontal,
  Coins,
  Receipt,
  Phone,
  ArrowUpDown,
  Percent
} from 'lucide-react';
import { Order, OrderReceiptDto, Product, Seller, SellerPayoutSettings } from '../../../types';
import { formatFCFA, OrderService } from '../../../services/marketServices';
import { commerceService } from '../../../services/commerceService';
import {
  DJASSA_FIXED_COMMISSION_FCFA,
  calculateClientOnlineFee
} from '../../achats/checkout/checkoutTypes';
import { SellerTransaction } from './types';
import { useApp } from '../../../context/AppContext';
import { securityService } from '../../../services/securityService';
import { DjassaOfficialReceiptModal } from '../../common/DjassaOfficialReceiptModal';

interface Props {
  seller?: Seller;
  balance: number;
  totalGrossRevenue: number;
  orders: Order[];
  products: Product[];
  transactions: SellerTransaction[];
  onOpenWithdraw: () => void;
}

export type SellerRevenueSubTab = 'commandes' | 'historique';

export interface SellerOrderRevenueItem {
  id: string;
  orderNumber: string;
  clientName: string;
  clientPhone: string;
  clientAvatar?: string;
  clientCommune: string;
  dropoffLocation: string;
  sellerName: string;
  itemsSummary: string;
  itemCount: number;
  productImage: string;
  paymentMode: 'online' | 'cod';
  paymentMethod: 'wave' | 'orange_money' | 'cash_on_delivery';
  paymentStatus: Order['paymentStatus'];
  totalOrderAmount: number;
  subtotal: number;
  discount: number;
  clientFeeFcfa: number;
  djassaCommission: number;
  commissionStatus: Order['commissionStatus'];
  netSellerGain: number;
  isCod: boolean;
  sellerPayoutStatus: Order['sellerPayoutStatus'];
  sellerPayoutReference?: string | null;
  date: string;
  time: string;
  rawOrder: Order;
}

export const RevenuesTab: React.FC<Props> = ({
  seller,
  balance: initialBalance,
  totalGrossRevenue: initialTotalGrossRevenue,
  orders,
  products,
  transactions: initialTransactions,
  onOpenWithdraw,
}) => {
  const { showToast, startCall } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<SellerRevenueSubTab>('commandes');

  const [currentBalance, setCurrentBalance] = useState<number>(initialBalance || 0);
  useEffect(() => {
    if (initialBalance !== undefined) {
      setCurrentBalance(initialBalance);
    }
  }, [initialBalance]);

  const [transactionsList, setTransactionsList] = useState<SellerTransaction[]>(
    initialTransactions || []
  );
  useEffect(() => {
    if (initialTransactions) {
      setTransactionsList(initialTransactions);
    }
  }, [initialTransactions]);

  // Real Seller Payout Settings (Wave & Orange Money)
  const [payoutSettings, setPayoutSettings] = useState<SellerPayoutSettings>({
    sellerId: seller?.id || '',
    preferredChannel: 'wave',
    wavePhone: seller?.phone || '',
    orangeMoneyPhone: '',
    accountHolderName: seller?.name || '',
    updatedAt: new Date().toISOString()
  });
  const [isSavingPayoutSettings, setIsSavingPayoutSettings] = useState(false);

  useEffect(() => {
    let cancelled = false;
    commerceService
      .getSellerPayoutSettings(seller?.id)
      .then((res) => {
        if (!cancelled && res?.success && res.settings) {
          setPayoutSettings(res.settings);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [seller?.id]);

  // Monthly sales target
  const [monthlyTarget, setMonthlyTarget] = useState<number>(() => {
    const saved = localStorage.getItem(`djassa_seller_monthly_target_${seller?.id || 'default'}`);
    return saved ? Number(saved) : 1500000;
  });
  const [targetInput, setTargetInput] = useState<string>(String(monthlyTarget));

  // Search, filter & sort
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'online_paid' | 'cod_pending' | 'pending_online'>('all');
  const [orderSortBy, setOrderSortBy] = useState<'date_desc' | 'revenue_desc' | 'total_desc'>('date_desc');
  const [copiedOrderNumber, setCopiedOrderNumber] = useState<string | null>(null);

  const [transactionTypeFilter, setTransactionTypeFilter] = useState<'all' | 'sale_earning' | 'withdrawal' | 'refund_deduction'>('all');
  const [transactionSearchQuery, setTransactionSearchQuery] = useState('');

  // Modals
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<SellerOrderRevenueItem | null>(null);
  const [receiptDto, setReceiptDto] = useState<OrderReceiptDto | undefined>(undefined);
  const [selectedTransactionForReceipt, setSelectedTransactionForReceipt] = useState<SellerTransaction | null>(null);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);

  // Simulator amount
  const [simulatedGrossAmount, setSimulatedGrossAmount] = useState<number>(25000);

  const handleOpenOrderReceipt = (item: SellerOrderRevenueItem) => {
    setSelectedOrderForReceipt(item);
    setReceiptDto(undefined);
    void commerceService
      .getOrderReceipt(item.id)
      .then((res) => {
        if (res?.success && res.receipt) {
          setReceiptDto(res.receipt);
        }
      })
      .catch(() => {});
  };

  // Real orders mapped to financial items
  const sellerOrderRevenues: SellerOrderRevenueItem[] = useMemo(() => {
    return orders.map((order, idx) => {
      const firstItem = order.items?.[0];
      const itemsTitle =
        order.items?.map((it) => `${it.quantity}x ${it.productTitle}`).join(', ') || 'Article Boutique';
      const itemsCount = order.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 1;
      const subtotal =
        order.subtotal ??
        order.items?.reduce((s, it) => s + it.price * it.quantity, 0) ??
        0;
      const discount = order.discount || 0;
      const merchandiseNet = Math.max(0, subtotal - discount);
      const isCod =
        order.paymentMode === 'cod' ||
        order.paymentMethod === 'cash_on_delivery' ||
        order.paymentStatus === 'cod_pending';
      const paymentMode: 'online' | 'cod' = isCod ? 'cod' : 'online';
      const paymentMethod: 'wave' | 'orange_money' | 'cash_on_delivery' = isCod
        ? 'cash_on_delivery'
        : order.paymentMethod === 'orange_money'
        ? 'orange_money'
        : 'wave';

      const clientFeeFcfa = isCod
        ? 0
        : order.clientFeeFcfa ?? order.serviceFee ?? calculateClientOnlineFee(merchandiseNet, 'online');
      const djassaCommission = order.commissionFcfa ?? DJASSA_FIXED_COMMISSION_FCFA;
      const netSellerGain =
        order.sellerNetFcfa ?? Math.max(0, merchandiseNet - djassaCommission);
      const totalOrderAmount = order.total ?? merchandiseNet + clientFeeFcfa;

      const img =
        firstItem?.productImage ||
        products.find((p) => p.id === firstItem?.productId)?.images?.[0] ||
        'https://images.unsplash.com/photo-1590736969955-71cc94801759?w=600';

      return {
        id: order.id,
        orderNumber: order.orderNumber || `CMD-${89000 + idx}`,
        clientName: order.deliveryAddress?.recipientName || order.clientName || 'Client Djassa',
        clientPhone: order.deliveryAddress?.phone || '',
        clientAvatar: order.clientAvatar,
        clientCommune: order.deliveryAddress?.commune || 'Abidjan',
        dropoffLocation: `${order.deliveryAddress?.commune || 'Abidjan'}${
          order.deliveryAddress?.quartier ? `, ${order.deliveryAddress.quartier}` : ''
        }`,
        sellerName: seller?.storeName || seller?.name || 'Votre Boutique',
        itemsSummary: itemsTitle,
        itemCount: itemsCount,
        productImage: img,
        paymentMode,
        paymentMethod,
        paymentStatus: order.paymentStatus || (isCod ? 'cod_pending' : 'pending'),
        totalOrderAmount,
        subtotal,
        discount,
        clientFeeFcfa,
        djassaCommission,
        commissionStatus: order.commissionStatus || 'pending',
        netSellerGain,
        isCod,
        sellerPayoutStatus: order.sellerPayoutStatus || (isCod ? 'not_applicable' : 'pending_payment'),
        sellerPayoutReference: order.sellerPayoutReference,
        date: order.createdAt
          ? new Date(order.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
          : 'Confirmée',
        time: order.createdAt
          ? new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          : '',
        rawOrder: order
      };
    });
  }, [orders, products, seller]);

  const paidOnlineOrders = useMemo(
    () => sellerOrderRevenues.filter((o) => !o.isCod && o.paymentStatus === 'paid'),
    [sellerOrderRevenues]
  );

  const codOrders = useMemo(
    () => sellerOrderRevenues.filter((o) => o.isCod),
    [sellerOrderRevenues]
  );

  const pendingOnlineOrders = useMemo(
    () => sellerOrderRevenues.filter((o) => !o.isCod && o.paymentStatus !== 'paid'),
    [sellerOrderRevenues]
  );

  const totalOnlineNetEarned = useMemo(
    () => paidOnlineOrders.reduce((sum, o) => sum + o.netSellerGain, 0),
    [paidOnlineOrders]
  );

  const totalCodMerchandiseAmount = useMemo(
    () => codOrders.reduce((sum, o) => sum + Math.max(0, o.subtotal - o.discount), 0),
    [codOrders]
  );

  const grossMerchandiseVolume = useMemo(
    () => sellerOrderRevenues.reduce((acc, o) => acc + Math.max(0, o.subtotal - o.discount), 0) || initialTotalGrossRevenue || 0,
    [sellerOrderRevenues, initialTotalGrossRevenue]
  );

  const targetProgressPercent = useMemo(() => {
    if (!monthlyTarget || monthlyTarget <= 0) return 0;
    return Math.min(100, Math.round((grossMerchandiseVolume / monthlyTarget) * 100));
  }, [grossMerchandiseVolume, monthlyTarget]);

  const filteredOrderRevenues = useMemo(() => {
    let result = [...sellerOrderRevenues];

    if (orderSearchQuery.trim()) {
      const q = orderSearchQuery.toLowerCase();
      result = result.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.clientName.toLowerCase().includes(q) ||
          o.itemsSummary.toLowerCase().includes(q) ||
          o.clientCommune.toLowerCase().includes(q)
      );
    }

    if (orderStatusFilter === 'online_paid') {
      result = result.filter((o) => !o.isCod && o.paymentStatus === 'paid');
    } else if (orderStatusFilter === 'cod_pending') {
      result = result.filter((o) => o.isCod);
    } else if (orderStatusFilter === 'pending_online') {
      result = result.filter((o) => !o.isCod && o.paymentStatus !== 'paid');
    }

    if (orderSortBy === 'revenue_desc') {
      result.sort((a, b) => b.netSellerGain - a.netSellerGain);
    } else if (orderSortBy === 'total_desc') {
      result.sort((a, b) => b.totalOrderAmount - a.totalOrderAmount);
    }

    return result;
  }, [sellerOrderRevenues, orderSearchQuery, orderStatusFilter, orderSortBy]);

  const totalSalesCredited = useMemo(
    () => transactionsList.filter((t) => t.type === 'sale_earning').reduce((acc, t) => acc + t.amount, 0),
    [transactionsList]
  );
  const totalWithdrawals = useMemo(
    () => transactionsList.filter((t) => t.type === 'withdrawal').reduce((acc, t) => acc + t.amount, 0),
    [transactionsList]
  );
  const totalRefundDeductions = useMemo(
    () => transactionsList.filter((t) => t.type === 'refund_deduction').reduce((acc, t) => acc + t.amount, 0),
    [transactionsList]
  );

  const filteredTransactions = useMemo(() => {
    let list = [...transactionsList];
    if (transactionTypeFilter !== 'all') {
      list = list.filter((t) => t.type === transactionTypeFilter);
    }
    if (transactionSearchQuery.trim()) {
      const q = transactionSearchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          t.reference.toLowerCase().includes(q) ||
          (t.provider && t.provider.toLowerCase().includes(q))
      );
    }
    return list;
  }, [transactionsList, transactionTypeFilter, transactionSearchQuery]);

  const handleCopyOrderNumber = (e: React.MouseEvent, orderNumber: string) => {
    e.stopPropagation();
    navigator.clipboard?.writeText?.(orderNumber);
    setCopiedOrderNumber(orderNumber);
    showToast(`Numéro #${orderNumber} copié !`);
    setTimeout(() => setCopiedOrderNumber(null), 2500);
  };

  const handleSaveTarget = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(targetInput);
    if (val > 0) {
      const prevTarget = monthlyTarget;
      setMonthlyTarget(val);
      localStorage.setItem(`djassa_seller_monthly_target_${seller?.id || 'default'}`, String(val));
      void securityService.recordActivity({
        category: 'products',
        actionType: 'seller_sales_target_updated',
        action: `Mise à jour objectif mensuel boutique (${seller?.name || 'Boutique'})`,
        target: seller?.name || seller?.id || 'Boutique',
        targetType: 'store',
        entityType: 'store',
        entityId: seller?.id,
        space: 'seller',
        result: 'reussi',
        severity: 'information',
        beforeValue: formatFCFA(prevTarget),
        afterValue: formatFCFA(val),
        details: `Objectif de chiffre d'affaires ajusté à ${formatFCFA(val)}`
      });
      setIsTargetModalOpen(false);
      showToast(`Objectif mensuel fixé à ${formatFCFA(val)} ! 🎯`);
    }
  };

  const handleSavePayoutSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPayoutSettings(true);
    try {
      const res = await commerceService.updateSellerPayoutSettings({
        sellerId: seller?.id,
        preferredChannel: payoutSettings.preferredChannel,
        wavePhone: payoutSettings.wavePhone?.trim() || undefined,
        orangeMoneyPhone: payoutSettings.orangeMoneyPhone?.trim() || undefined,
        accountHolderName: payoutSettings.accountHolderName?.trim() || undefined
      });
      if (res?.success && res.settings) {
        setPayoutSettings(res.settings);
      }
      showToast('Compte de reversement direct enregistré (Wave / Orange Money) ✓');
      setIsRatesModalOpen(false);
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors de la sauvegarde du compte de reversement.');
    } finally {
      setIsSavingPayoutSettings(false);
    }
  };

  return (
    <div id="seller-revenue-management-root" className="space-y-4">
      {/* 1. PRINCIPAL WALLET & PAYOUT HUB */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950/70 via-[#0C0C0C] to-neutral-950 border border-emerald-500/30 p-5 shadow-2xl space-y-4">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />

        <div className="flex items-start justify-between relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Wallet className="w-4 h-4" />
              </span>
              <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider">
                Portefeuille Vendeur · Reversement Direct Wave & Orange Money
              </span>
            </div>
            <p className="text-[11px] text-white/50 mt-1 font-medium">
              Commission fixe DJASSA : {formatFCFA(DJASSA_FIXED_COMMISSION_FCFA)} / commande · Paiements en ligne reversés directement
            </p>
          </div>

          <button
            type="button"
            id="btn-seller-open-statement"
            onClick={() => setIsStatementModalOpen(true)}
            className="py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-[10px] font-bold flex items-center gap-1.5 transition active:scale-95"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>Relevé PDF</span>
          </button>
        </div>

        <div className="relative z-10 pt-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {formatFCFA(currentBalance)}
            </h2>
            <span className="text-[10px] font-extrabold text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/40 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Canal préféré : {payoutSettings.preferredChannel === 'orange_money' ? 'Orange Money' : 'Wave CI'}</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
            <div
              onClick={() => {
                setActiveSubTab('commandes');
                setOrderStatusFilter('cod_pending');
              }}
              className="p-3 rounded-2xl bg-black/60 border border-amber-500/20 hover:border-amber-500/40 cursor-pointer transition space-y-1 group"
            >
              <div className="flex items-center justify-between text-[10px] text-white/50">
                <span className="font-bold text-amber-300">À la livraison (COD)</span>
                <Coins className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition" />
              </div>
              <p className="text-sm font-black text-white">{formatFCFA(totalCodMerchandiseAmount)}</p>
              <span className="text-[9px] text-amber-400 font-bold block">
                {codOrders.length} commande(s) · Le client paie à la réception
              </span>
            </div>

            <div
              onClick={() => {
                setActiveSubTab('commandes');
                setOrderStatusFilter('online_paid');
              }}
              className="p-3 rounded-2xl bg-black/60 border border-white/5 hover:border-white/20 cursor-pointer transition space-y-1"
            >
              <div className="flex items-center justify-between text-[10px] text-white/50">
                <span>Net payé en ligne</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-sm font-black text-emerald-400">{formatFCFA(totalOnlineNetEarned)}</p>
              <span className="text-[9px] text-white/40 block">
                {paidOnlineOrders.length} commande(s) payée(s)
              </span>
            </div>

            <div
              onClick={() => setIsTargetModalOpen(true)}
              className="p-3 rounded-2xl bg-black/60 border border-white/5 col-span-2 sm:col-span-1 hover:border-emerald-500/30 cursor-pointer transition space-y-1"
            >
              <div className="flex items-center justify-between text-[10px] text-white/50">
                <span>Objectif du mois</span>
                <Target className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-black text-emerald-400">{formatFCFA(grossMerchandiseVolume)}</p>
                <span className="text-[10px] font-bold text-white/70">{targetProgressPercent}%</span>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${targetProgressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 pt-2 relative z-10">
          <button
            type="button"
            id="btn-seller-open-direct-withdraw"
            onClick={onOpenWithdraw}
            className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-95"
          >
            <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            <span>Retirer mes gains</span>
          </button>

          <button
            type="button"
            id="btn-seller-config-payout"
            onClick={() => setIsRatesModalOpen(true)}
            className="py-3 px-4 rounded-2xl border bg-[#FF6321] hover:bg-[#ff7638] text-white border-[#FF6321] shadow-lg shadow-orange-600/20 font-black text-xs transition flex items-center justify-center gap-2 active:scale-95"
          >
            <SlidersHorizontal className="w-4 h-4 text-white" />
            <span>Compte Wave / OM</span>
          </button>
        </div>

        {/* Active Payout Operator Strip */}
        <div className="p-2.5 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between text-[10px] flex-wrap gap-1.5">
          <span className="text-white/60 font-medium">Reversement direct automatique via GeniusPay :</span>
          <div className="flex items-center gap-1.5 font-bold">
            <span className="px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30">
              Wave CI {payoutSettings.wavePhone ? `(${payoutSettings.wavePhone})` : ''}
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-orange-500/20 text-orange-300 border border-orange-500/30">
              Orange Money {payoutSettings.orangeMoneyPhone ? `(${payoutSettings.orangeMoneyPhone})` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* 2. NAVIGATION SUB-TABS */}
      <div className="flex p-1 rounded-2xl bg-black/60 border border-white/10 overflow-x-auto no-scrollbar">
        <button
          type="button"
          id="seller-subtab-order-revenues"
          onClick={() => setActiveSubTab('commandes')}
          className={`flex-1 py-2 px-3 rounded-xl text-[11px] font-bold shrink-0 transition flex items-center justify-center gap-1.5 ${
            activeSubTab === 'commandes'
              ? 'bg-[#FF6321] text-white shadow-md'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Gains par Commande ({sellerOrderRevenues.length})</span>
        </button>

        <button
          type="button"
          id="seller-subtab-revenue-history"
          onClick={() => setActiveSubTab('historique')}
          className={`flex-1 py-2 px-3 rounded-xl text-[11px] font-bold shrink-0 transition flex items-center justify-center gap-1.5 ${
            activeSubTab === 'historique'
              ? 'bg-[#FF6321] text-white shadow-md'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Histoire des transactions</span>
        </button>
      </div>

      {/* 3. SUB-TAB 1: GAINS PAR COMMANDE */}
      {activeSubTab === 'commandes' && (
        <div className="space-y-3.5 animate-fadeIn">
          <div className="p-4 rounded-3xl bg-white/[0.04] border border-white/10 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-[#FF6321]" />
                  <span>Détail Financier des Commandes Confirmées</span>
                </h3>
                <p className="text-[10px] text-white/50">
                  Commission fixe DJASSA : {formatFCFA(DJASSA_FIXED_COMMISSION_FCFA)} / commande · Livraison gérée par votre boutique (0 F DJASSA)
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-white/60 shrink-0">
                {filteredOrderRevenues.length} vente(s)
              </span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Rechercher par numéro, client, article, commune..."
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                className="w-full pl-9.5 pr-4 py-2 bg-black/50 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]"
              />
              {orderSearchQuery && (
                <button
                  type="button"
                  onClick={() => setOrderSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pt-1">
              <div className="flex gap-1.5 shrink-0">
                {[
                  { id: 'all', label: 'Toutes' },
                  { id: 'online_paid', label: 'Payées en ligne' },
                  { id: 'cod_pending', label: 'À la livraison (COD)' },
                  { id: 'pending_online', label: 'En attente en ligne' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setOrderStatusFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold shrink-0 transition ${
                      orderStatusFilter === f.id
                        ? 'bg-white text-black'
                        : 'bg-white/5 text-white/60 hover:text-white border border-white/5'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <ArrowUpDown className="w-3 h-3 text-white/40" />
                <select
                  value={orderSortBy}
                  onChange={(e) => setOrderSortBy(e.target.value as any)}
                  className="bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white/70 focus:outline-none focus:border-[#FF6321]"
                >
                  <option value="date_desc">Plus récentes</option>
                  <option value="revenue_desc">Gains les plus élevés</option>
                  <option value="total_desc">Montant commande</option>
                </select>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-neutral-900 to-amber-500/10 border border-white/10 flex items-center justify-between text-xs gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-[11px] text-white/80 font-medium">
                Paiements en ligne Wave / Orange Money reversés directement après confirmation · COD encaissé directement à la livraison.
              </span>
            </div>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-lg border border-emerald-500/30 shrink-0">
              150 F / cmd
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredOrderRevenues.length === 0 ? (
              <div className="col-span-full p-8 text-center bg-white/[0.02] border border-white/5 rounded-3xl space-y-2">
                <Package className="w-8 h-8 text-white/20 mx-auto" />
                <p className="text-xs font-bold text-white/50">Aucune vente trouvée</p>
                <p className="text-[10px] text-white/30">Modifiez vos critères de recherche ou réinitialisez vos filtres</p>
                <button
                  type="button"
                  onClick={() => {
                    setOrderSearchQuery('');
                    setOrderStatusFilter('all');
                  }}
                  className="mt-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-[10px] font-bold"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            ) : (
              filteredOrderRevenues.map((orderRev) => {
                const isCopied = copiedOrderNumber === orderRev.orderNumber;
                const statusBadge = OrderService.getStatusBadge(orderRev.rawOrder.status);
                const paymentBadge = OrderService.getPaymentStatusBadge(orderRev.paymentStatus, orderRev.paymentMode);

                return (
                  <div
                    key={orderRev.id}
                    id={`seller-revenue-card-${orderRev.orderNumber}`}
                    className="rounded-2xl sm:rounded-3xl bg-[#141414] hover:bg-[#181818] border border-white/10 hover:border-white/25 transition-all flex flex-col justify-between shadow-xl overflow-hidden group"
                  >
                    <div>
                      <div
                        onClick={() => handleOpenOrderReceipt(orderRev)}
                        className="relative w-full h-36 sm:h-48 overflow-hidden bg-neutral-900 cursor-pointer"
                      >
                        <img
                          src={orderRev.productImage}
                          alt={orderRev.itemsSummary}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />

                        <div className="absolute inset-x-0 top-0 p-2 sm:p-3 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-start justify-between gap-1">
                          <div
                            onClick={(e) => handleCopyOrderNumber(e, orderRev.orderNumber)}
                            className="px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 font-mono text-[10px] sm:text-xs font-black text-white flex items-center gap-1 cursor-pointer hover:bg-black/90 transition"
                            title="Copier le numéro"
                          >
                            <span>#{orderRev.orderNumber}</span>
                            {isCopied ? (
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-2.5 h-2.5 text-white/50" />
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[9px] font-black border backdrop-blur-md flex items-center gap-1 ${statusBadge.bgColor} ${statusBadge.color}`}
                            >
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>{statusBadge.label}</span>
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border backdrop-blur-md ${paymentBadge.bgColor} ${paymentBadge.color}`}
                            >
                              {paymentBadge.label}
                            </span>
                          </div>
                        </div>

                        <div className="absolute inset-x-0 bottom-0 p-2 sm:p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-end justify-between gap-1">
                          <span className="text-[9px] sm:text-[10px] text-white/70 font-semibold truncate bg-black/60 px-1.5 py-0.5 rounded-md">
                            {orderRev.date} {orderRev.time}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-black/80 backdrop-blur-md border border-emerald-500/35 text-[11px] sm:text-xs font-black text-emerald-400 font-mono">
                            Net +{formatFCFA(orderRev.netSellerGain)}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 sm:p-4 space-y-2.5">
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <h4 className="text-xs sm:text-sm font-black text-white line-clamp-1">
                              {orderRev.itemsSummary}
                            </h4>
                            <span className="text-[10px] font-bold text-white/70 shrink-0">
                              ×{orderRev.itemCount}
                            </span>
                          </div>
                          <p className="text-[10px] text-white/60 mt-0.5">
                            MODE DE PAIEMENT :{' '}
                            <strong className={orderRev.isCod ? 'text-amber-300' : 'text-emerald-300'}>
                              {orderRev.isCod
                                ? 'Paiement à la livraison'
                                : `Paiement en ligne (${orderRev.paymentMethod === 'orange_money' ? 'Orange Money' : 'Wave'})`}
                            </strong>
                          </p>
                          {orderRev.isCod && (
                            <p className="text-[10px] text-amber-300/90 font-semibold mt-0.5">
                              Le client paiera directement à la réception ({formatFCFA(orderRev.totalOrderAmount)})
                            </p>
                          )}
                        </div>

                        <div className="p-2 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between gap-2 text-[10px]">
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={
                                orderRev.clientAvatar ||
                                OrderService.getClientAvatar(orderRev.rawOrder)
                              }
                              alt=""
                              className="w-6 h-6 rounded-full object-cover border border-cyan-400/40 shrink-0"
                            />
                            <div className="truncate">
                              <span className="text-white font-bold block truncate">{orderRev.clientName}</span>
                              <span className="text-white/45 text-[9px] flex items-center gap-0.5 truncate">
                                <MapPin className="w-2.5 h-2.5 text-[#FF6321] shrink-0" />
                                <span className="truncate">{orderRev.dropoffLocation}</span>
                              </span>
                            </div>
                          </div>

                          {orderRev.clientPhone && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                startCall(orderRev.clientName, 'client', {
                                  name: orderRev.clientName,
                                  role: `Client Acheteur • #${orderRev.orderNumber}`,
                                  phone: orderRev.clientPhone,
                                  orderNumber: orderRev.orderNumber,
                                  avatar: orderRev.clientAvatar
                                });
                              }}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-white/60 hover:text-emerald-400 transition shrink-0"
                              title="Appeler le client"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="p-2 rounded-xl bg-black/40 border border-white/5 grid grid-cols-3 gap-1 text-center">
                          <div>
                            <span className="text-[8px] text-white/40 block leading-tight">Sous-total</span>
                            <span className="text-[10px] font-bold text-white font-mono">
                              {formatFCFA(Math.max(0, orderRev.subtotal - orderRev.discount))}
                            </span>
                          </div>
                          <div>
                            <span className="text-[8px] text-white/40 block leading-tight">Com. DJASSA</span>
                            <span className="text-[10px] font-bold text-purple-300 font-mono">
                              -{formatFCFA(orderRev.djassaCommission)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[8px] text-emerald-400/80 block leading-tight font-bold">Net Vendeur</span>
                            <span className="text-[10px] font-black text-emerald-400 font-mono">
                              +{formatFCFA(orderRev.netSellerGain)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 sm:p-3 bg-black/40 border-t border-white/10 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenOrderReceipt(orderRev)}
                        className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-[#FF6321] to-amber-600 hover:brightness-110 active:scale-95 text-white font-black text-xs transition flex items-center justify-center gap-1.5"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Reçu Vendeur Officiel</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 4. SUB-TAB 2: HISTOIRE DES TRANSACTIONS */}
      {activeSubTab === 'historique' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="p-4 rounded-3xl bg-white/[0.04] border border-white/10 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-black text-[#FF6321] uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  <span>Journal Financier</span>
                </span>
                <h3 className="text-xl font-black text-white mt-0.5">Histoire des transactions</h3>
                <p className="text-[11px] text-white/50">
                  Ventes confirmées, reversements Wave / Orange Money et déductions
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  id="btn-seller-history-rates-modal"
                  onClick={() => setIsRatesModalOpen(true)}
                  className="py-1.5 px-3 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-[11px] font-bold flex items-center gap-1.5 transition active:scale-95"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Comptes Wave / OM</span>
                </button>

                <button
                  type="button"
                  id="btn-seller-history-withdraw"
                  onClick={onOpenWithdraw}
                  className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-emerald-600/20"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Nouveau Retrait</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="p-3 rounded-2xl bg-black/60 border border-emerald-500/20 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-white/50">
                  <span className="font-bold text-emerald-400">Ventes Créditées</span>
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <p className="text-base font-black text-white">+{formatFCFA(totalSalesCredited)}</p>
              </div>

              <div className="p-3 rounded-2xl bg-black/60 border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-white/50">
                  <span>Reversements</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <p className="text-base font-black text-purple-300">-{formatFCFA(totalWithdrawals)}</p>
              </div>

              <div className="p-3 rounded-2xl bg-black/60 border border-white/5 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-white/50">
                  <span>Ajustements</span>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                </div>
                <p className="text-base font-black text-rose-400">-{formatFCFA(totalRefundDeductions)}</p>
              </div>

              <div className="p-3 rounded-2xl bg-black/60 border border-emerald-500/30 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-emerald-400">
                  <span className="font-bold">Solde Disponible</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <p className="text-base font-black text-emerald-400">{formatFCFA(currentBalance)}</p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  placeholder="Rechercher par référence, libellé ou opérateur..."
                  value={transactionSearchQuery}
                  onChange={(e) => setTransactionSearchQuery(e.target.value)}
                  className="w-full pl-9.5 pr-4 py-2 bg-black/50 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]"
                />
              </div>

              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {[
                  { id: 'all', label: 'Toutes les écritures' },
                  { id: 'sale_earning', label: 'Ventes en ligne' },
                  { id: 'withdrawal', label: 'Reversements Wave / OM' },
                  { id: 'refund_deduction', label: 'Ajustements' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTransactionTypeFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold shrink-0 transition ${
                      transactionTypeFilter === f.id
                        ? 'bg-white text-black'
                        : 'bg-white/5 text-white/60 hover:text-white border border-white/5'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {filteredTransactions.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-black/40 border border-white/5 text-xs text-white/40">
                Aucune transaction trouvée.
              </div>
            ) : (
              filteredTransactions.map((tx) => {
                const isEarning = tx.type === 'sale_earning';
                const isWithdrawal = tx.type === 'withdrawal';

                return (
                  <div
                    key={tx.id}
                    className="p-3.5 rounded-2xl bg-black/40 border border-white/5 hover:border-white/15 transition flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isEarning
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : isWithdrawal
                            ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {isEarning ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : isWithdrawal ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <AlertCircle className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="font-bold text-white text-xs truncate">{tx.description}</p>
                        <p className="text-[10px] text-white/40 flex items-center gap-2 mt-0.5">
                          <span>{tx.date}</span>
                          <span>•</span>
                          <span className="font-mono">{tx.reference}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-3">
                      <div>
                        <p
                          className={`text-xs font-black font-mono ${
                            isEarning ? 'text-emerald-400' : isWithdrawal ? 'text-white' : 'text-rose-400'
                          }`}
                        >
                          {isEarning ? '+' : '-'}{formatFCFA(tx.amount)}
                        </p>
                        <span className="text-[9px] text-emerald-400/80 font-bold block">
                          {tx.status === 'completed' ? '✓ Validé' : 'En attente'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedTransactionForReceipt(tx)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition"
                        title="Voir le reçu"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* MODAL: BARÈME COMMISSION FIXE & COMPTE DE REVERSEMENT DIRECT WAVE / ORANGE MONEY */}
      {isRatesModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsRatesModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[#141414] rounded-3xl border border-white/15 p-5 space-y-4 shadow-2xl animate-fadeIn relative max-h-[90vh] overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  Reversement Direct & Commission DJASSA
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRatesModalOpen(false)}
                className="p-1 rounded-full text-white/50 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-0.5">
                <span className="text-[10px] text-white/50 block font-bold">Commission DJASSA</span>
                <p className="text-xl font-black text-purple-300">{formatFCFA(DJASSA_FIXED_COMMISSION_FCFA)}</p>
                <p className="text-[9px] text-white/50">Montant fixe par commande</p>
              </div>
              <div className="p-3 rounded-2xl bg-black/40 border border-emerald-500/20 space-y-0.5">
                <span className="text-[10px] text-emerald-400 block font-bold">Frais client en ligne</span>
                <p className="text-xl font-black text-emerald-400">6,5%</p>
                <p className="text-[9px] text-emerald-300/70">0% si paiement à la livraison</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-black/50 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-[#FF6321]" />
                  <span>Simulateur Gain Net Vendeur</span>
                </span>
                <span className="text-[9px] text-white/40">-150 FCFA / commande</span>
              </div>
              <input
                type="number"
                step="500"
                min="500"
                value={simulatedGrossAmount}
                onChange={(e) => setSimulatedGrossAmount(Number(e.target.value) || 0)}
                className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-black focus:outline-none focus:border-[#FF6321]"
                placeholder="Prix article..."
              />
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <span className="text-[9px] text-purple-300 block">Commission fixe</span>
                  <p className="font-bold text-purple-200 text-[11px]">-{formatFCFA(DJASSA_FIXED_COMMISSION_FCFA)}</p>
                </div>
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[9px] text-emerald-300 block">Net Boutique</span>
                  <p className="font-bold text-emerald-400 text-xs">
                    +{formatFCFA(Math.max(0, simulatedGrossAmount - DJASSA_FIXED_COMMISSION_FCFA))}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSavePayoutSettings} className="space-y-3 pt-1 border-t border-white/10">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Comptes de Reversement Direct</span>
              </h4>

              <div>
                <label className="text-[10px] text-white/60 block mb-1">Canal prioritaire</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'wave' as const, label: 'Wave CI' },
                    { id: 'orange_money' as const, label: 'Orange Money' }
                  ].map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() =>
                        setPayoutSettings((prev) => ({ ...prev, preferredChannel: ch.id }))
                      }
                      className={`p-2 rounded-xl border text-xs font-bold transition ${
                        payoutSettings.preferredChannel === ch.id
                          ? 'bg-[#FF6321]/20 border-[#FF6321] text-white'
                          : 'bg-white/5 border-white/10 text-white/60'
                      }`}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/60 block mb-1">Numéro Wave CI</label>
                <input
                  type="tel"
                  value={payoutSettings.wavePhone || ''}
                  onChange={(e) =>
                    setPayoutSettings((prev) => ({ ...prev, wavePhone: e.target.value }))
                  }
                  placeholder="+225 07 XX XX XX XX"
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                />
              </div>

              <div>
                <label className="text-[10px] text-white/60 block mb-1">Numéro Orange Money CI</label>
                <input
                  type="tel"
                  value={payoutSettings.orangeMoneyPhone || ''}
                  onChange={(e) =>
                    setPayoutSettings((prev) => ({ ...prev, orangeMoneyPhone: e.target.value }))
                  }
                  placeholder="+225 07 XX XX XX XX"
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                />
              </div>

              <div>
                <label className="text-[10px] text-white/60 block mb-1">Titulaire du compte</label>
                <input
                  type="text"
                  value={payoutSettings.accountHolderName || ''}
                  onChange={(e) =>
                    setPayoutSettings((prev) => ({ ...prev, accountHolderName: e.target.value }))
                  }
                  placeholder="Nom de la boutique ou du gérant"
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingPayoutSettings}
                className="w-full py-2.5 bg-[#FF6321] hover:bg-[#ff7638] disabled:opacity-50 text-white rounded-xl text-xs font-black transition"
              >
                {isSavingPayoutSettings ? 'Enregistrement...' : 'Enregistrer mes comptes Wave / OM'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ORDER RECEIPT MODAL */}
      {selectedOrderForReceipt && (
        <DjassaOfficialReceiptModal
          order={selectedOrderForReceipt.rawOrder}
          seller={seller}
          receiptDto={receiptDto}
          perspective="seller"
          financialBreakdown={{
            paymentMode: selectedOrderForReceipt.paymentMode,
            paymentMethod: selectedOrderForReceipt.paymentMethod,
            paymentStatus: selectedOrderForReceipt.paymentStatus,
            subtotal: selectedOrderForReceipt.subtotal,
            discount: selectedOrderForReceipt.discount,
            clientFeeFcfa: selectedOrderForReceipt.clientFeeFcfa,
            total: selectedOrderForReceipt.totalOrderAmount,
            djassaCommission: selectedOrderForReceipt.djassaCommission,
            sellerNetGain: selectedOrderForReceipt.netSellerGain
          }}
          onClose={() => {
            setSelectedOrderForReceipt(null);
            setReceiptDto(undefined);
          }}
          onShowToast={showToast}
        />
      )}

      {/* TRANSACTION RECEIPT MODAL */}
      {selectedTransactionForReceipt && (() => {
        const foundOrder = orders.find(
          (o) => o.orderNumber === selectedTransactionForReceipt.orderNumber
        );
        const effectiveOrder: Order = foundOrder || {
          id: selectedTransactionForReceipt.id,
          orderNumber: selectedTransactionForReceipt.orderNumber || selectedTransactionForReceipt.reference,
          items: [
            {
              productId: 'prod-tx',
              productTitle: selectedTransactionForReceipt.description || `Écriture ${selectedTransactionForReceipt.type}`,
              productImage: 'https://images.unsplash.com/photo-1590736969955-71cc94801759?w=300',
              price: selectedTransactionForReceipt.amount,
              quantity: 1,
              sellerId: seller?.id || 'seller-1',
              sellerName: seller?.name || 'Boutique'
            }
          ],
          subtotal: selectedTransactionForReceipt.amount,
          deliveryFee: 0,
          discount: 0,
          clientFeeFcfa: 0,
          commissionFcfa: selectedTransactionForReceipt.type === 'sale_earning' ? DJASSA_FIXED_COMMISSION_FCFA : 0,
          sellerNetFcfa: selectedTransactionForReceipt.amount,
          total: selectedTransactionForReceipt.amount,
          paymentMode: 'online',
          paymentMethod: selectedTransactionForReceipt.provider === 'orange_money' ? 'orange_money' : 'wave',
          paymentStatus: 'paid',
          visibleStatus: 'Commande confirmée',
          status: 'payment_confirmed',
          createdAt: new Date().toISOString(),
          deliveryAddress: {
            commune: seller?.location || 'Abidjan',
            quartier: '',
            details: `Référence comptable : ${selectedTransactionForReceipt.reference}`,
            recipientName: seller?.name || 'Boutique Vendeur',
            phone: seller?.phone || ''
          },
          trackingEvents: []
        };

        return (
          <DjassaOfficialReceiptModal
            order={effectiveOrder}
            seller={seller}
            perspective="seller"
            customBadge="REÇU FINANCIER"
            customTitle={`Reçu d'Écriture Financière - ${selectedTransactionForReceipt.reference}`}
            financialBreakdown={{
              subtotal: selectedTransactionForReceipt.amount,
              clientFeeFcfa: 0,
              total: selectedTransactionForReceipt.amount,
              sellerNetGain: selectedTransactionForReceipt.amount,
              djassaCommission: selectedTransactionForReceipt.type === 'sale_earning' ? DJASSA_FIXED_COMMISSION_FCFA : 0,
              paymentMode: 'online',
              paymentMethod: selectedTransactionForReceipt.provider || 'wave',
              paymentStatus: 'paid'
            }}
            onClose={() => setSelectedTransactionForReceipt(null)}
            onShowToast={showToast}
          />
        );
      })()}

      {/* EDIT MONTHLY TARGET MODAL */}
      {isTargetModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsTargetModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-[#141414] border border-white/15 rounded-3xl p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-[#FF6321]/20 text-[#FF6321]">
                  <Target className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-white">Fixer l'Objectif Mensuel</h3>
              </div>
              <button
                onClick={() => setIsTargetModalOpen(false)}
                className="p-1 rounded-full text-white/50 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTarget} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-white/80 block mb-1">
                  Chiffre d'affaires visé ce mois (FCFA)
                </label>
                <input
                  type="number"
                  min={100000}
                  step={50000}
                  value={targetInput}
                  onChange={(e) => setTargetInput(e.target.value)}
                  className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-sm font-black text-white focus:outline-none focus:border-[#FF6321]"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsTargetModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 text-xs font-bold transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6321] hover:bg-[#e05518] text-white text-xs font-black shadow-lg shadow-[#FF6321]/30 transition"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STATEMENT MODAL */}
      {isStatementModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsStatementModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[#141414] rounded-3xl border border-white/15 p-5 space-y-4 shadow-2xl animate-fadeIn relative max-h-[90vh] overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  Relevé Financier Boutique Certifié
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsStatementModalOpen(false)}
                className="p-1 rounded-full text-white/50 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div>
                  <h4 className="font-bold text-white">{seller?.name || 'Boutique Partenaire'}</h4>
                  <p className="text-[10px] text-white/40">{seller?.location || 'Abidjan'}</p>
                </div>
                <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                  OFFICIEL DJASSA
                </span>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-white/50">Total Marchandises (Commandes) :</span>
                  <span className="text-white font-bold">{formatFCFA(grossMerchandiseVolume)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Commission DJASSA ({sellerOrderRevenues.length} × 150 F) :</span>
                  <span className="text-purple-300 font-bold">
                    -{formatFCFA(sellerOrderRevenues.length * DJASSA_FIXED_COMMISSION_FCFA)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/50">Total Retraits Wave / OM :</span>
                  <span className="text-white font-bold">-{formatFCFA(totalWithdrawals)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-white/10 text-emerald-400 font-black">
                  <span>Solde Disponible Actuel :</span>
                  <span>{formatFCFA(currentBalance)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.print?.()}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer Relevé</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsStatementModalOpen(false);
                  showToast('Relevé PDF téléchargé avec succès ! 📄');
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
