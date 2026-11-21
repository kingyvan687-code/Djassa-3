import React, { useState, useMemo } from 'react';
import {
  History,
  Receipt,
  Search,
  Store,
  X,
  Sparkles,
  ShoppingBag,
  Truck,
  CheckCircle2,
  Calendar,
  CreditCard,
  LayoutGrid,
  Grid3X3,
  ArrowUpDown,
  Clock,
  Compass,
  FileText,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Users
} from 'lucide-react';
import { Order, Product, Seller } from '../../types';
import { formatFCFA, formatMetricCount } from '../../services/marketServices';
import { PurchaseReceiptModal } from './PurchaseReceiptModal';

interface HistoryTabContentProps {
  orders: Order[];
  products: Product[];
  sellers: Seller[];
  onSelectOrder: (order: Order) => void;
  onSelectProduct: (product: Product) => void;
  onNavigateFeed: () => void;
  onShowToast: (message: string) => void;
  onOpenPurchasedProducts?: () => void;
}

export const HistoryTabContent: React.FC<HistoryTabContentProps> = ({
  orders,
  products,
  sellers,
  onSelectOrder,
  onSelectProduct,
  onNavigateFeed,
  onShowToast,
  onOpenPurchasedProducts
}) => {
  // Search, filter, sort & layout state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'delivered'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'price-asc' | 'price-desc'>('recent');
  const [columnsLayout, setColumnsLayout] = useState<2 | 3>(2);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Selected order to view receipt modal
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  // Map sellers by id
  const sellerMap = useMemo(() => {
    const map = new Map<string, Seller>();
    sellers.forEach((s) => map.set(s.id, s));
    return map;
  }, [sellers]);

  // Map products by id
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  // Counts: Dans l'onglet historique, toutes les commandes sont livrées
  const deliveredCount = orders.length;

  // Filter & sort
  const processedOrders = useMemo(() => {
    let result = [...orders];

    // Filter by search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter((o) => {
        const orderNum = o.orderNumber.toLowerCase();
        const commune = (o.deliveryAddress?.commune || '').toLowerCase();
        const matchesItem = o.items.some((item) =>
          item.productTitle.toLowerCase().includes(q) || (item.sellerName || '').toLowerCase().includes(q)
        );
        return orderNum.includes(q) || commune.includes(q) || matchesItem;
      });
    }

    // Sort
    if (sortBy === 'price-asc') {
      result.sort((a, b) => a.total - b.total);
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.total - a.total);
    }
    // 'recent' preserves original array order (newest first)

    return result;
  }, [orders, searchTerm, sortBy]);

  // Total count formatted with formatMetricCount rule (0 to 999 exact, 1k, etc.)
  const formattedTotal = formatMetricCount(orders.length);

  return (
    <div id="history-purchases-tab-content" className="space-y-3 pb-8">
      {/* 1. TOP TOOLBAR: Total count, Search toggle, Filter Chips & Layout Switcher */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#FF6321] inline-block animate-pulse" />
              Historique des achats
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#FF6321]/20 text-[#FF6321] text-[10px] font-bold border border-[#FF6321]/30">
              {formattedTotal} {orders.length > 1 ? 'commandes' : 'commande'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Search Toggle */}
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen(!isSearchOpen);
                if (isSearchOpen) setSearchTerm('');
              }}
              className={`p-1.5 rounded-lg border transition ${
                isSearchOpen || searchTerm
                  ? 'bg-[#FF6321] text-white border-[#FF6321]'
                  : 'bg-white/5 text-white/70 border-white/10 hover:text-white'
              }`}
              title="Rechercher dans l'historique des achats"
              aria-label="Rechercher"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Sort Selector */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                aria-label="Trier l'historique des achats"
                className="appearance-none bg-white/5 border border-white/10 text-white/80 hover:text-white rounded-lg px-2.5 py-1.5 text-[11px] font-bold pr-6 focus:outline-none focus:border-[#FF6321] transition cursor-pointer"
              >
                <option value="recent" className="bg-[#181818] text-white">Plus récents</option>
                <option value="price-asc" className="bg-[#181818] text-white">Montant croissant</option>
                <option value="price-desc" className="bg-[#181818] text-white">Montant décroissant</option>
              </select>
              <ArrowUpDown className="w-3 h-3 text-white/40 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Grid Layout Switcher (2 cols vs 3 cols) */}
            <div className="flex items-center bg-white/5 rounded-lg border border-white/10 p-0.5">
              <button
                type="button"
                onClick={() => setColumnsLayout(2)}
                className={`p-1 rounded-md transition ${
                  columnsLayout === 2
                    ? 'bg-[#FF6321] text-white font-bold'
                    : 'text-white/40 hover:text-white'
                }`}
                title="Grandes cartes (2 colonnes)"
                aria-label="Affichage 2 colonnes"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setColumnsLayout(3)}
                className={`p-1 rounded-md transition ${
                  columnsLayout === 3
                    ? 'bg-[#FF6321] text-white font-bold'
                    : 'text-white/40 hover:text-white'
                }`}
                title="Grille compacte (3 colonnes)"
                aria-label="Affichage 3 colonnes"
              >
                <Grid3X3 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible Search Input */}
        {isSearchOpen && (
          <div className="relative animate-in fade-in slide-in-from-top-1 duration-150">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par article, n° commande (#DJ-...), boutique..."
              className="w-full bg-white/10 border border-white/15 rounded-xl pl-8 pr-8 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]"
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Filter Chips */}
        {orders.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setSelectedFilter('all')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
                selectedFilter === 'all'
                  ? 'bg-[#FF6321] text-white shadow-md shadow-orange-600/20'
                  : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
              }`}
            >
              Toutes ({formattedTotal})
            </button>

            <button
              type="button"
              onClick={() => setSelectedFilter('delivered')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                selectedFilter === 'delivered'
                  ? 'bg-[#FF6321] text-white shadow-md shadow-orange-600/20'
                  : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Commandes confirmées ({formattedTotal})</span>
            </button>
          </div>
        )}

        {/* Quick link: Voir les produits achetés & nombre d'acheteurs */}
        {onOpenPurchasedProducts && orders.length > 0 && (
          <button
            type="button"
            onClick={onOpenPurchasedProducts}
            className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-orange-500/15 via-[#FF6321]/10 to-transparent border border-[#FF6321]/30 flex items-center justify-between text-left hover:border-[#FF6321]/60 transition group active:scale-[0.99]"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-[#FF6321] text-white flex items-center justify-center shrink-0 shadow-sm">
                <Users className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-xs font-bold text-white group-hover:text-[#FF6321] transition flex items-center gap-1.5">
                  Produits achetés & Nombre d'acheteurs
                  <span className="px-1.5 py-0.2 rounded-full bg-[#FF6321] text-white text-[9px] font-black">Voir</span>
                </span>
                <span className="text-[10px] text-white/50 block">
                  Découvrez combien de personnes ont acheté chacun de vos articles
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#FF6321] group-hover:translate-x-0.5 transition" />
          </button>
        )}
      </div>

      {/* 2. MAIN GRID DISPLAY */}
      {processedOrders.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl bg-white/[0.02] border border-white/5 space-y-3">
          <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 bg-[#FF6321]/20 rounded-full blur-xl" />
            <div className="relative w-12 h-12 rounded-full bg-gradient-to-tr from-[#FF6321]/30 to-amber-500/20 border border-[#FF6321]/30 flex items-center justify-center">
              <Receipt className="w-6 h-6 text-[#FF6321]" />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-extrabold text-white">
              {orders.length === 0
                ? 'Aucun historique d’achat pour le moment'
                : 'Aucune commande ne correspond à votre filtre'}
            </p>
            <p className="text-xs text-white/50 max-w-xs mx-auto">
              {orders.length === 0
                ? 'Vos achats et vos reçus électroniques s’afficheront ici après chaque commande passée sur Djassa.'
                : 'Essayez de modifier votre recherche ou réinitialisez le filtre.'}
            </p>
          </div>

          {orders.length === 0 ? (
            <button
              type="button"
              onClick={onNavigateFeed}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#FF6321] to-[#FF8C00] text-white text-xs font-extrabold shadow-lg shadow-orange-600/30 hover:brightness-110 active:scale-95 transition"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Découvrir les articles tendance</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedFilter('all');
              }}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/10 text-white text-xs font-bold hover:bg-white/15 transition"
            >
              <span>Réinitialiser les filtres</span>
            </button>
          )}
        </div>
      ) : (
        <div
          className={`grid gap-3 ${
            columnsLayout === 2
              ? 'grid-cols-2'
              : 'grid-cols-3'
          }`}
        >
          {processedOrders.map((order) => {
            const firstItem = order.items[0];
            const relatedProduct = firstItem ? productMap.get(firstItem.productId) : undefined;
            const fallbackImage = 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600';
            const imageUrl = firstItem?.productImage || relatedProduct?.images[0] || fallbackImage;
            const seller = firstItem ? sellerMap.get(firstItem.sellerId) : undefined;

            const statusLabel = 'Commande confirmée';
            const statusBadgeStyle = 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';

            const paymentLabel = order.paymentMode === 'cod' || order.paymentMethod === 'cash_on_delivery'
              ? 'À la livraison'
              : ({
                  wave: 'Wave',
                  orange_money: 'Orange Money',
                  mtn_momo: 'MTN MoMo',
                  card: 'Carte',
                  cash_on_delivery: 'À la livraison'
                }[order.paymentMethod] || 'En ligne');

            const formattedDate = order.createdAt
              ? new Date(order.createdAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short'
                })
              : 'Récent';

            return (
              <div
                key={order.id}
                onClick={() => setReceiptOrder(order)}
                className={`relative group rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-900 border border-white/10 hover:border-[#FF6321]/60 transition-all duration-200 cursor-pointer shadow-xl flex flex-col justify-between ${
                  columnsLayout === 2
                    ? 'aspect-[9/14]'
                    : 'aspect-[9/15]'
                }`}
              >
                {/* Background Image of the Purchased Product */}
                <img
                  src={imageUrl}
                  alt={firstItem?.productTitle || 'Achat'}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                  loading="lazy"
                />

                {/* Dark gradient for text legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-black/55 pointer-events-none" />

                {/* TOP BAR OVERLAY */}
                <div className="relative z-10 p-2.5 flex items-start justify-between gap-1.5">
                  {/* Top-left: Order date & Number */}
                  <div className="flex flex-col gap-0.5 items-start min-w-0">
                    <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[9px] font-bold text-white border border-white/15 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5 text-[#FF6321]" />
                      <span>{formattedDate}</span>
                    </span>
                    <span className="text-[9px] font-mono font-extrabold text-white/70 drop-shadow-md">
                      #{order.orderNumber}
                    </span>
                  </div>

                  {/* Top-right: Status Badge & Receipt Quick Icon */}
                  <div className="flex items-center gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border backdrop-blur-md flex items-center gap-1 ${statusBadgeStyle}`}>
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                      <span>{statusLabel}</span>
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReceiptOrder(order);
                      }}
                      className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-md border border-white/20 hover:bg-[#FF6321] text-white flex items-center justify-center active:scale-75 transition shadow-lg"
                      title="Voir le reçu de l'achat"
                      aria-label="Reçu"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* BOTTOM CONTENT OVERLAY */}
                <div className="relative z-10 p-2.5 sm:p-3 space-y-1.5">
                  {/* Seller Handle & Payment method */}
                  <div className="flex items-center justify-between text-[9px] text-white/70">
                    <span className="inline-flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full border border-white/10 truncate max-w-[120px]">
                      <Store className="w-2.5 h-2.5 text-[#FF6321] shrink-0" />
                      <span className="truncate">
                        @{seller?.username || firstItem?.sellerName || 'boutique'}
                      </span>
                    </span>

                    <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-white/80 font-semibold text-[8px] border border-white/10">
                      {paymentLabel}
                    </span>
                  </div>

                  {/* Product Title */}
                  <h3
                    className={`font-extrabold text-white leading-tight drop-shadow-md break-words ${
                      columnsLayout === 2
                        ? 'text-xs line-clamp-2'
                        : 'text-[11px] line-clamp-1'
                    }`}
                  >
                    {firstItem?.productTitle || 'Article commandé'}
                    {order.items.length > 1 && (
                      <span className="text-[#FF6321] font-bold ml-1 text-[10px]">
                        +{order.items.length - 1} autre{order.items.length > 2 ? 's' : ''}
                      </span>
                    )}
                  </h3>

                  {/* Total price */}
                  <div className="flex items-center justify-between gap-1 pt-0.5">
                    <span
                      className={`font-black text-[#FF6321] drop-shadow-sm ${
                        columnsLayout === 2 ? 'text-xs' : 'text-[11px]'
                      }`}
                    >
                      {formatFCFA(order.total)}
                    </span>

                    <span className="text-[9px] text-white/50">
                      {order.deliveryAddress?.commune || 'Abidjan'}
                    </span>
                  </div>

                  {/* ACTION BUTTONS: "Détails" & "Reçu" */}
                  <div className="pt-1 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectOrder(order);
                      }}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-[10px] font-bold flex items-center justify-center gap-1.5 border border-white/10 transition shadow-md"
                      title="Voir les détails de la commande"
                    >
                      <Store className="w-3 h-3 text-[#FF6321] shrink-0" />
                      <span className="truncate">Détails</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReceiptOrder(order);
                      }}
                      className="py-1.5 px-2.5 rounded-xl bg-[#FF6321]/20 hover:bg-[#FF6321] active:scale-95 text-white text-[10px] font-bold flex items-center justify-center gap-1 border border-[#FF6321]/30 backdrop-blur-md transition shadow-md shrink-0"
                      title="Voir le reçu de commande"
                    >
                      <Receipt className="w-3 h-3 text-[#FF6321]" />
                      <span>Reçu</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DEDICATED PURCHASE RECEIPT MODAL */}
      {receiptOrder && (
        <PurchaseReceiptModal
          order={receiptOrder}
          seller={receiptOrder.items[0] ? sellerMap.get(receiptOrder.items[0].sellerId) : undefined}
          onClose={() => setReceiptOrder(null)}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};
