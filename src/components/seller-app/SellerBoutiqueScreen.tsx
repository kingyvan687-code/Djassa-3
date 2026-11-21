import React, { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { 
  Store, 
  Package, 
  Trash2, 
  X, 
} from 'lucide-react';
import { Product, Seller, Order, OrderReceiptDto } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../services/marketServices';
import { commerceService } from '../../services/commerceService';
import { BoutiqueTab, SellerTransaction } from './boutique/types';
import { MerchandiseTab } from './boutique/MerchandiseTab';

const RevenuesTab = lazy(() =>
  import('./boutique/RevenuesTab').then((m) => ({ default: m.RevenuesTab }))
);
const WithdrawEarningsModal = lazy(() =>
  import('./boutique/WithdrawEarningsModal').then((m) => ({ default: m.WithdrawEarningsModal }))
);
const EditMerchandiseModal = lazy(() =>
  import('./boutique/EditMerchandiseModal').then((m) => ({ default: m.EditMerchandiseModal }))
);
const ProductPromotionScreen = lazy(() =>
  import('./boutique/ProductPromotionScreen').then((m) => ({ default: m.ProductPromotionScreen }))
);
const SellerOrderHistorySection = lazy(() =>
  import('./orders/SellerOrderHistorySection').then((m) => ({ default: m.SellerOrderHistorySection }))
);
const SellerOrderDetailModal = lazy(() =>
  import('./orders/SellerOrderDetailModal').then((m) => ({ default: m.SellerOrderDetailModal }))
);
const DjassaOfficialReceiptModal = lazy(() =>
  import('../common/DjassaOfficialReceiptModal').then((m) => ({ default: m.DjassaOfficialReceiptModal }))
);
const SellerSettingsPrivacyScreen = lazy(() =>
  import('./settings/SellerSettingsPrivacyScreen').then((m) => ({ default: m.SellerSettingsPrivacyScreen }))
);

const BoutiqueTabFallback = () => (
  <div className="p-6 rounded-2xl bg-[#141414] border border-white/10 flex items-center justify-center gap-2 text-xs text-white/60">
    <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-[#FF6321] animate-spin" />
    <span>Chargement...</span>
  </div>
);

interface Props {
  seller: Seller;
  products: Product[];
  onGoAdd: () => void;
  onGoProfile?: () => void;
}

export const SellerBoutiqueScreen: React.FC<Props> = ({
  seller,
  products,
  onGoAdd,
}) => {
  const { 
    orders, 
    updateProductSeller, 
    deleteProductSeller, 
    updateSeller, 
    showToast, 
    openVideoViewer, 
    setSelectedProduct,
    startCall,
    signOut,
  } = useApp();

  // Active view tab
  const [activeTab, setActiveTab] = useState<BoutiqueTab>('marchandises');

  // Orders detail and official receipt modals
  const [activeDetailOrder, setActiveDetailOrder] = useState<Order | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [receiptDto, setReceiptDto] = useState<OrderReceiptDto | undefined>(undefined);

  const handleOpenReceipt = (order: Order) => {
    setReceiptOrder(order);
    setReceiptDto(undefined);
    void commerceService
      .getOrderReceipt(order.id)
      .then((res) => {
        if (res?.success && res.receipt) {
          setReceiptDto(res.receipt);
        }
      })
      .catch(() => {});
  };

  // Calculate seller orders
  const sellerOrders = useMemo(() => {
    const list = orders.filter((o) =>
      o.items.some((item) =>
        products.some((p) => p.id === item.productId && p.sellerId === seller.id)
      )
    );
    return list.length > 0 ? list : orders;
  }, [orders, products, seller.id]);

  const totalGrossRevenue = useMemo(() => {
    return sellerOrders.reduce((sum, o) => sum + (o.total || 0), 0) || 320000;
  }, [sellerOrders]);

  // Initial transactions
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
      },
      {
        id: 'tx-2',
        type: 'withdrawal',
        amount: 45000,
        description: 'Retrait Wave CI (+225 07 48 99 12 34)',
        date: 'Il y a 2 jours',
        status: 'completed',
        provider: 'wave',
        phone: '+225 07 48 99 12 34',
        reference: 'VIR-741920',
      },
      {
        id: 'tx-3',
        type: 'sale_earning',
        amount: 64000,
        description: 'Vente Commande #CMD-9410 (Ensemble Lin)',
        date: 'Il y a 3 jours',
        status: 'completed',
        reference: 'VNT-9410',
      },
      {
        id: 'tx-4',
        type: 'refund_deduction',
        amount: 12000,
        description: 'Dédommagement litige client #LIT-089 (Robe tachée)',
        date: 'Il y a 5 jours',
        status: 'completed',
        reference: 'REM-1049',
      },
    ];
  });

  // Balance calculation (total revenues - completed withdrawals - refunds)
  const totalWithdrawn = transactions
    .filter((t) => t.type === 'withdrawal' && t.status === 'completed')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalRefunded = transactions
    .filter((t) => t.type === 'refund_deduction')
    .reduce((acc, t) => acc + t.amount, 0);

  const [balance, setBalance] = useState<number>(() => {
    const saved = localStorage.getItem(`djassa_seller_balance_${seller.id}`);
    if (saved) {
      const num = Number(saved);
      if (!isNaN(num)) return num;
    }
    return Math.max(15000, totalGrossRevenue - totalWithdrawn - totalRefunded);
  });

  // Modals state
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [promotingProduct, setPromotingProduct] = useState<Product | null>(null);
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState<Product | null>(null);
  const [isEditShopOpen, setIsEditShopOpen] = useState(false);
  const [isSettingsPrivacyOpen, setIsSettingsPrivacyOpen] = useState(false);
  const [storageQuota, setStorageQuota] = useState<{
    usedBytes: number;
    quotaBytes: number;
    usagePercent: number;
    productCount: number;
    maxProducts: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    commerceService
      .getSellerStorage(seller.id)
      .then((res) => {
        if (!cancelled && res?.success && res.storage) {
          const s = res.storage;
          const usedBytes = Number(s.usedBytes) || 0;
          const quotaBytes = Number(s.quotaBytes) || 1024 * 1024 * 1024;
          const computedPercent = quotaBytes > 0 ? Math.min(100, (usedBytes / quotaBytes) * 100) : 0;
          const usagePercent =
            typeof s.usagePercent === 'number' && Number.isFinite(s.usagePercent)
              ? s.usagePercent
              : computedPercent;
          setStorageQuota({
            usedBytes,
            quotaBytes,
            usagePercent,
            productCount: Number(s.productCount) || 0,
            maxProducts: Number(s.maxProducts) || 100
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [seller.id, products.length]);

  // Persistence helpers
  useEffect(() => {
    localStorage.setItem(`djassa_seller_balance_${seller.id}`, String(balance));
  }, [balance, seller.id]);

  useEffect(() => {
    localStorage.setItem(`djassa_seller_transactions_${seller.id}`, JSON.stringify(transactions));
  }, [transactions, seller.id]);

  // Stock health & Macro KPI counts
  const countHealthy = products.filter((p) => p.stock > 5).length;
  const countLowStock = products.filter((p) => p.stock > 0 && p.stock <= 5).length;
  const countOutOfStock = products.filter((p) => p.stock === 0).length;
  const todayOrders = sellerOrders.filter((o) => {
    if (o.createdAt) {
      try {
        const d = new Date(o.createdAt);
        const now = new Date();
        if (
          d.getDate() === now.getDate() &&
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        ) return true;
      } catch (e) {}
    }
    return false;
  });
  const onlinePaidCount = sellerOrders.filter((o) => o.paymentStatus === 'paid').length;
  const codPendingCount = sellerOrders.filter(
    (o) => o.paymentMode === 'cod' || o.paymentMethod === 'cash_on_delivery' || o.paymentStatus === 'cod_pending'
  ).length;
  const urgentIssuesCountPlaceholder = 0;
  void urgentIssuesCountPlaceholder;

  // Handlers
  const handleWithdrawSuccess = (newTx: SellerTransaction) => {
    setBalance((prev) => Math.max(0, prev - newTx.amount));
    setTransactions((prev) => [newTx, ...prev]);
    showToast(`Virement de ${formatFCFA(newTx.amount)} confirmé vers ${newTx.provider?.toUpperCase()} ! 🚀`);
  };

  const handleQuickStockChange = (productId: string, newStock: number) => {
    updateProductSeller(productId, {
      stock: newStock,
      inStock: newStock > 0,
    });
    showToast(`Stock mis à jour : ${newStock} unité(s) 📦`);
  };

  const handleContactClient = (phone?: string, name?: string) => {
    if (phone) {
      try {
        startCall(phone, 'client');
      } catch (e) {
        showToast(`Ouverture de l'appel vers ${name || 'le client'} (${phone})...`);
      }
    } else {
      showToast('Coordonnées du client non disponibles.');
    }
  };

  return (
    <div
      id="seller-boutique-screen"
      className="w-full h-full bg-[#0A0A0A] text-white flex flex-col overflow-y-auto no-scrollbar pb-24"
    >
      <div className="p-4 space-y-4">
        {/* 1. TOP 4 KEY MANAGEMENT CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Card 1: Caisse & Trésorerie */}
          <div
            id="kpi-seller-revenus"
            onClick={() => setActiveTab('revenus')}
            className={`group relative p-3 rounded-2xl border text-left cursor-pointer transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-lg ${
              activeTab === 'revenus'
                ? 'bg-gradient-to-br from-emerald-950/70 via-neutral-900 to-emerald-950/40 border-emerald-400 ring-2 ring-emerald-500/40 shadow-emerald-950/60'
                : 'bg-gradient-to-br from-white/[0.05] via-[#141414] to-white/[0.02] border-white/10 hover:border-emerald-500/50 hover:bg-emerald-950/25'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-md border border-emerald-500/30 text-[9px] text-emerald-300 font-black uppercase tracking-wider inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Caisse</span>
              </span>
              {/* Client App Style Frosted Icon Badge */}
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-black/60 to-emerald-950/40 border border-emerald-400/40 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-110 active:scale-95 transition-transform duration-200">
                <svg viewBox="0 0 24 24" className="w-5 h-5 filter drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)] transition-colors">
                  <rect x="2" y="5" width="20" height="14" rx="3" className="fill-emerald-500/30 stroke-emerald-400 stroke-[1.8]" />
                  <path d="M16 12h4" className="stroke-emerald-300 stroke-[2] stroke-linecap-round" />
                  <circle cx="18" cy="12" r="1.2" className="fill-emerald-300" />
                  <path d="M6 9h5" className="stroke-emerald-300/80 stroke-[1.5] stroke-linecap-round" />
                </svg>
              </div>
            </div>
            <div className="my-1.5">
              <p className="text-sm sm:text-base font-black text-white truncate font-mono tracking-tight drop-shadow-sm">
                {formatFCFA(balance)}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-extrabold border border-emerald-500/25 inline-flex items-center gap-1">
                <span>Wave ⚡</span>
              </span>
            </div>
          </div>

          {/* Card 2: Commandes & Ventes (Client App Achats / Shopping Bag Icon) */}
          <div
            id="kpi-seller-commandes"
            onClick={() => setActiveTab('commandes')}
            className={`group relative p-3 rounded-2xl border text-left cursor-pointer transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-lg ${
              activeTab === 'commandes'
                ? 'bg-gradient-to-br from-orange-950/70 via-neutral-900 to-orange-950/40 border-[#FF6321] ring-2 ring-orange-500/40 shadow-orange-950/60'
                : 'bg-gradient-to-br from-white/[0.05] via-[#141414] to-white/[0.02] border-white/10 hover:border-[#FF6321]/60 hover:bg-orange-950/25'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-md border border-[#FF6321]/30 text-[9px] text-[#FF8C53] font-black uppercase tracking-wider inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6321] animate-pulse" />
                <span>Ventes</span>
              </span>
              {/* Client App Style Shopping Bag Icon with TikTok Drop Shadow */}
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#FF6321]/25 via-black/60 to-orange-950/40 border border-[#FF6321]/50 text-[#FF6321] flex items-center justify-center shadow-lg shadow-[#FF6321]/25 group-hover:scale-110 active:scale-95 transition-transform duration-200">
                <svg viewBox="0 0 24 24" className="w-5 h-5 filter drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)] transition-colors">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" className="fill-[#FF6321]/30 stroke-[#FF6321] stroke-[1.8]" />
                  <line x1="3" y1="6" x2="21" y2="6" className="stroke-[#FF6321] stroke-[1.8]" />
                  <path d="M16 10a4 4 0 01-8 0" className="fill-none stroke-[#FF8C53] stroke-[2]" />
                </svg>
              </div>
            </div>
            <div className="my-1.5">
              <p className="text-sm sm:text-base font-black text-white leading-tight drop-shadow-sm">
                {sellerOrders.length} <span className="text-xs font-medium text-white/50">commandes</span>
              </p>
            </div>
            <div>
              <span
                className={`text-[9px] px-2 py-0.5 rounded-full font-extrabold inline-flex items-center gap-1 border ${
                  todayOrders.length > 0
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {todayOrders.length > 0
                  ? `⚡ ${todayOrders.length} auj.`
                  : `✓ ${onlinePaidCount} payée(s) · ${codPendingCount} COD`}
              </span>
            </div>
          </div>

          {/* Card 3: Catalogue Articles (Client App Storefront & Explorer Grid Icon) */}
          <div
            id="kpi-seller-catalogue"
            onClick={() => setActiveTab('marchandises')}
            className={`group relative p-3 rounded-2xl border text-left cursor-pointer transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-lg ${
              activeTab === 'marchandises'
                ? 'bg-gradient-to-br from-cyan-950/70 via-neutral-900 to-cyan-950/40 border-cyan-400 ring-2 ring-cyan-500/40 shadow-cyan-950/60'
                : 'bg-gradient-to-br from-white/[0.05] via-[#141414] to-white/[0.02] border-white/10 hover:border-cyan-500/50 hover:bg-cyan-950/25'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-md border border-cyan-400/30 text-[9px] text-cyan-300 font-black uppercase tracking-wider inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>Catalogue</span>
              </span>
              {/* Client App Store & Grid Icon */}
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-cyan-500/25 via-black/60 to-cyan-950/40 border border-cyan-400/50 text-cyan-300 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-110 active:scale-95 transition-transform duration-200">
                <svg viewBox="0 0 24 24" className="w-5 h-5 filter drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)] transition-colors">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" className="fill-cyan-500/25 stroke-cyan-400 stroke-[1.8]" />
                  <path d="M9 22V12h6v10" className="fill-none stroke-cyan-300 stroke-[1.8]" />
                  <circle cx="12" cy="7" r="1.5" className="fill-cyan-300" />
                </svg>
              </div>
            </div>
            <div className="my-1.5">
              <p className="text-sm sm:text-base font-black text-white leading-tight drop-shadow-sm">
                {products.length} <span className="text-xs font-medium text-white/50">articles</span>
              </p>
            </div>
            <div>
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border block truncate ${
                countOutOfStock > 0 
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25'
              }`}>
                {countOutOfStock > 0
                  ? `⚠️ ${countOutOfStock} rupture(s)`
                  : `${countHealthy} sain • ${countLowStock} faible`}
              </span>
            </div>
          </div>

          {/* Card 4: Livraison Boutique & Reversement */}
          <div
            id="kpi-seller-livraisons"
            onClick={() => setActiveTab('commandes')}
            className="group relative p-3 rounded-2xl border text-left cursor-pointer transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-lg bg-gradient-to-br from-white/[0.05] via-[#141414] to-white/[0.02] border-white/10 hover:border-purple-400/50 hover:bg-purple-950/25"
          >
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-md border border-purple-400/30 text-[9px] text-purple-300 font-black uppercase tracking-wider inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                <span>Livraison</span>
              </span>
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-purple-500/25 via-black/60 to-purple-950/40 border border-purple-400/50 text-purple-300 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-110 active:scale-95 transition-transform duration-200">
                <Package className="w-5 h-5" />
              </div>
            </div>
            <div className="my-1.5">
              <p className="text-sm sm:text-base font-black text-white leading-tight drop-shadow-sm">
                0 F <span className="text-xs font-medium text-white/50">frais DJASSA</span>
              </p>
            </div>
            <div>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 font-bold border border-purple-500/25 block truncate">
                📦 Gérée par boutique
              </span>
            </div>
          </div>

        </div>

        {/* 3. SMART LOGISTICS & STOCK ALERT BANNER */}
        {countOutOfStock > 0 ? (
          <div 
            onClick={() => setActiveTab('marchandises')}
            className="p-3 rounded-2xl bg-gradient-to-r from-amber-950/70 via-black/70 to-neutral-900 border border-amber-500/50 shadow-xl backdrop-blur-md flex items-center justify-between gap-3 cursor-pointer group hover:border-amber-400 transition select-none"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/30 to-black/60 border border-amber-500/50 text-amber-400 flex items-center justify-center shrink-0 shadow-md shadow-amber-500/25">
                <Package className="w-4 h-4 text-amber-400 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-amber-300 truncate">
                  ⚠️ {countOutOfStock} article{countOutOfStock > 1 ? 's' : ''} en rupture de stock dans votre boutique
                </p>
                <p className="text-[10px] text-white/50 truncate">
                  Ajustez les stocks pour continuer à recevoir des commandes
                </p>
              </div>
            </div>
            <span className="text-xs text-amber-400 font-black group-hover:translate-x-1 transition-transform shrink-0 flex items-center gap-1">
              <span>Ajuster</span>
              <span>→</span>
            </span>
          </div>
        ) : (
          <div className="p-2.5 rounded-2xl bg-gradient-to-r from-white/[0.04] via-black/60 to-white/[0.02] border border-white/10 backdrop-blur-md flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0 text-white/70">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-[11px] truncate">
                ✓ Livraison organisée par votre boutique · Paiement en ligne Wave / Orange Money (versement direct) ou à la livraison · 150 F/cmd
              </span>
            </div>
            <button 
              type="button"
              onClick={() => setActiveTab('revenus')}
              className="text-[10px] text-[#FF6321] font-bold shrink-0 hover:underline"
            >
              Comptes & Revenus
            </button>
          </div>
        )}

        {storageQuota && (() => {
          const usedBytes = Number(storageQuota.usedBytes) || 0;
          const quotaBytes = Number(storageQuota.quotaBytes) || 1024 * 1024 * 1024;
          const safePercent =
            typeof storageQuota.usagePercent === 'number' && Number.isFinite(storageQuota.usagePercent)
              ? storageQuota.usagePercent
              : quotaBytes > 0
              ? Math.min(100, (usedBytes / quotaBytes) * 100)
              : 0;
          return (
            <div
              id="seller-storage-quota-card"
              className="p-3 rounded-2xl bg-[#141414] border border-white/10 space-y-1.5"
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-white/85">
                  Stockage médias boutique ({storageQuota.productCount ?? 0}/{storageQuota.maxProducts ?? 100} produits)
                </span>
                <span className="font-mono font-bold text-cyan-300">
                  {(usedBytes / (1024 * 1024)).toFixed(1)} Mo / {(quotaBytes / (1024 * 1024 * 1024)).toFixed(0)} Go ({safePercent.toFixed(1)}%)
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    safePercent >= 90
                      ? 'bg-rose-500'
                      : safePercent >= 70
                      ? 'bg-amber-400'
                      : 'bg-cyan-400'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(2, safePercent))}%` }}
                />
              </div>
            </div>
          );
        })()}

        {/* 4. MAIN NAVIGATION SUB-TABS (Client App Inspired Icons & Polish) */}
        <div className="border-t border-b border-white/10 flex bg-[#0A0A0A]/95 backdrop-blur-md sticky top-0 z-20 overflow-x-auto no-scrollbar">
          {/* Tab 1: Marchandises */}
          <button
            id="tab-btn-marchandises"
            onClick={() => setActiveTab('marchandises')}
            className={`px-3.5 py-3 text-xs font-bold flex items-center justify-center gap-2 transition whitespace-nowrap shrink-0 group ${
              activeTab === 'marchandises'
                ? 'text-[#FF6321] border-b-2 border-[#FF6321]'
                : 'text-white/45 hover:text-white/75 border-b-2 border-transparent'
            }`}
          >
            {/* Store / Grid Icon with drop shadow */}
            <svg
              viewBox="0 0 24 24"
              className={`w-4 h-4 filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] transition-all group-hover:scale-110 ${
                activeTab === 'marchandises'
                  ? 'fill-[#FF6321] text-[#FF6321]'
                  : 'fill-none stroke-current stroke-[2]'
              }`}
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path d="M9 22V12h6v10" />
            </svg>
            <span>Marchandises ({products.length})</span>
            {countOutOfStock > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-rose-500/30 text-rose-300 border border-rose-500/40 font-black">
                {countOutOfStock} rupt.
              </span>
            )}
          </button>

          {/* Tab 2: Historique Commandes */}
          <button
            id="tab-btn-commandes"
            onClick={() => setActiveTab('commandes')}
            className={`px-3.5 py-3 text-xs font-bold flex items-center justify-center gap-2 transition whitespace-nowrap shrink-0 group ${
              activeTab === 'commandes'
                ? 'text-orange-400 border-b-2 border-orange-400'
                : 'text-white/45 hover:text-white/75 border-b-2 border-transparent'
            }`}
          >
            {/* Shopping Bag / Orders Icon with drop shadow */}
            <svg
              viewBox="0 0 24 24"
              className={`w-4 h-4 filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] transition-all group-hover:scale-110 ${
                activeTab === 'commandes'
                  ? 'fill-orange-400 text-orange-400'
                  : 'fill-none stroke-current stroke-[2]'
              }`}
            >
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
            <span>Historique ({sellerOrders.length})</span>
            {todayOrders.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-[#FF6321] text-white font-black animate-pulse">
                {todayOrders.length} auj.
              </span>
            )}
          </button>

          {/* Tab 3: Revenus & Caisse */}
          <button
            id="tab-btn-revenus"
            onClick={() => setActiveTab('revenus')}
            className={`px-3.5 py-3 text-xs font-bold flex items-center justify-center gap-2 transition whitespace-nowrap shrink-0 group ${
              activeTab === 'revenus'
                ? 'text-emerald-400 border-b-2 border-emerald-400'
                : 'text-white/45 hover:text-white/75 border-b-2 border-transparent'
            }`}
          >
            {/* Wallet / Coin Icon with drop shadow */}
            <svg
              viewBox="0 0 24 24"
              className={`w-4 h-4 filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)] transition-all group-hover:scale-110 ${
                activeTab === 'revenus'
                  ? 'fill-emerald-400/30 stroke-emerald-400 stroke-[2]'
                  : 'fill-none stroke-current stroke-[2]'
              }`}
            >
              <rect x="2" y="5" width="20" height="14" rx="3" />
              <path d="M16 12h4" />
              <circle cx="18" cy="12" r="1" className={activeTab === 'revenus' ? 'fill-emerald-400' : 'fill-current'} />
            </svg>
            <span>Revenus & Caisse</span>
          </button>
        </div>

        {/* 5. TAB CONTENT */}
        <div className="pt-1">
          <Suspense fallback={<BoutiqueTabFallback />}>
            {activeTab === 'marchandises' && (
              <MerchandiseTab
                products={products}
                onGoAdd={onGoAdd}
                onEditProduct={(p) => setEditingProduct(p)}
                onDeleteProduct={(p) => setConfirmDeleteProduct(p)}
                onPromoteProduct={(p) => setPromotingProduct(p)}
                onQuickStockChange={handleQuickStockChange}
                onSelectProduct={(p) => setSelectedProduct(p)}
                onOpenVideo={(prods, id) => openVideoViewer(prods, id)}
              />
            )}

            {activeTab === 'commandes' && (
              <div className="space-y-4">
                <SellerOrderHistorySection
                  orders={sellerOrders}
                  onSelectOrder={(o) => setActiveDetailOrder(o)}
                  onOpenReceipt={handleOpenReceipt}
                />
              </div>
            )}

            {activeTab === 'revenus' && (
              <RevenuesTab
                seller={seller}
                balance={balance}
                totalGrossRevenue={totalGrossRevenue}
                orders={sellerOrders}
                products={products}
                transactions={transactions}
                onOpenWithdraw={() => setIsWithdrawModalOpen(true)}
              />
            )}
          </Suspense>
        </div>
      </div>

      {/* 6. MODALS */}
      <Suspense fallback={null}>
        {/* Withdraw Modal */}
        {isWithdrawModalOpen && (
          <WithdrawEarningsModal
            balance={balance}
            sellerPhone={seller.phone}
            onClose={() => setIsWithdrawModalOpen(false)}
            onSuccess={handleWithdrawSuccess}
          />
        )}

        {/* Edit Merchandise Modal */}
        {editingProduct && (
          <EditMerchandiseModal
            product={editingProduct}
            onClose={() => setEditingProduct(null)}
            onSave={(updates) => {
              updateProductSeller(editingProduct.id, updates);
              setEditingProduct(null);
              showToast('Marchandise mise à jour avec succès ! ✨');
            }}
            onDelete={() => {
              setConfirmDeleteProduct(editingProduct);
              setEditingProduct(null);
            }}
          />
        )}

        {/* Product Promotion & Solde Screen */}
        {promotingProduct && (
          <ProductPromotionScreen
            product={promotingProduct}
            isOpen={!!promotingProduct}
            onClose={() => setPromotingProduct(null)}
          />
        )}
      </Suspense>

      {/* Confirm Delete Merchandise Modal */}
      {confirmDeleteProduct && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#141414] border border-white/10 p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-400" />
              Supprimer cette marchandise ?
            </h3>
            <p className="text-xs text-white/60">
              L'article <b>"{confirmDeleteProduct.name}"</b> sera définitivement retiré du catalogue de votre boutique.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConfirmDeleteProduct(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-xs font-bold text-white/70"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  deleteProductSeller(confirmDeleteProduct.id);
                  setConfirmDeleteProduct(null);
                  showToast('Marchandise supprimée du catalogue.');
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-xs font-black text-white"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Boutique Coordonnées Modal */}
      {isEditShopOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#141414] border border-white/10 p-5 space-y-3.5 max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Store className="w-4 h-4 text-[#FF6321]" />
                Modifier les infos de la boutique
              </h3>
              <button
                onClick={() => setIsEditShopOpen(false)}
                className="p-1 text-white/50 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const name = (form.elements.namedItem('shopName') as HTMLInputElement).value;
                const location = (form.elements.namedItem('shopLocation') as HTMLInputElement).value;
                const phone = (form.elements.namedItem('shopPhone') as HTMLInputElement).value;
                const bio = (form.elements.namedItem('shopBio') as HTMLTextAreaElement).value;

                updateSeller(seller.id, {
                  name,
                  location,
                  phone,
                  bio,
                });
                setIsEditShopOpen(false);
                showToast('Informations boutique enregistrées ! ✨');
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-bold text-white/80 block mb-1">Nom de la boutique</label>
                <input
                  name="shopName"
                  defaultValue={seller.name}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white/80 block mb-1">Commune / Marché à Abidjan</label>
                <input
                  name="shopLocation"
                  defaultValue={seller.location}
                  placeholder="Ex : Adjamé Forum des Marchés"
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white/80 block mb-1">Numéro de téléphone</label>
                <input
                  name="shopPhone"
                  defaultValue={seller.phone || '+225 07 48 99 12 34'}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white/80 block mb-1">Présentation / Bio</label>
                <textarea
                  name="shopBio"
                  defaultValue={seller.bio}
                  rows={3}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321] resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditShopOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-xs font-bold text-white/70"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6321] text-xs font-black text-white"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. ORDER MODALS */}
      <Suspense fallback={null}>
        {activeDetailOrder && (
          <SellerOrderDetailModal
            order={activeDetailOrder}
            products={products}
            seller={seller}
            onClose={() => setActiveDetailOrder(null)}
            onOpenReceipt={handleOpenReceipt}
            onContactClient={handleContactClient}
          />
        )}

        {receiptOrder && (
          <DjassaOfficialReceiptModal
            order={receiptOrder}
            seller={seller}
            receiptDto={receiptDto}
            perspective="seller"
            onClose={() => {
              setReceiptOrder(null);
              setReceiptDto(undefined);
            }}
            onShowToast={showToast}
          />
        )}

        {/* 8. TIKTOK-STYLE SETTINGS & PRIVACY PAGE */}
        {isSettingsPrivacyOpen && (
          <SellerSettingsPrivacyScreen
            seller={seller}
            onClose={() => setIsSettingsPrivacyOpen(false)}
            onSignOut={signOut}
          />
        )}
      </Suspense>
    </div>
  );
};
