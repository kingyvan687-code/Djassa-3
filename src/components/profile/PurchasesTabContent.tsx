import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Search,
  X,
  LayoutGrid,
  Grid3X3,
  ArrowUpDown,
  ChevronRight,
  Compass,
  Receipt,
  Users,
  FileText,
  CreditCard,
  Banknote
} from 'lucide-react';
import { Order, OrderItem, Product, Seller } from '../../types';
import { OrderService, formatFCFA, formatMetricCount } from '../../services/marketServices';

export interface PurchasedEntry {
  order: Order;
  item: OrderItem;
  product?: Product;
}

interface PurchasesTabContentProps {
  purchasedEntries: PurchasedEntry[];
  sellers: Seller[];
  onSelectOrder: (order: Order) => void;
  onSelectProduct: (product: Product) => void;
  onNavigateExplore: () => void;
  onOpenPurchasedProducts?: () => void;
}

export const PurchasesTabContent: React.FC<PurchasesTabContentProps> = ({
  purchasedEntries,
  sellers,
  onSelectOrder,
  onSelectProduct,
  onNavigateExplore,
  onOpenPurchasedProducts
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'cod' | 'pending'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'price-asc' | 'price-desc'>('recent');
  const [columnsLayout, setColumnsLayout] = useState<2 | 3>(2);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const isCodOrder = (order: Order) =>
    order.paymentMode === 'cod' ||
    order.paymentMethod === 'cash_on_delivery' ||
    order.paymentStatus === 'cod_pending';

  const paidCount = useMemo(
    () => purchasedEntries.filter((e) => !isCodOrder(e.order) && e.order.paymentStatus === 'paid').length,
    [purchasedEntries]
  );

  const codCount = useMemo(
    () => purchasedEntries.filter((e) => isCodOrder(e.order)).length,
    [purchasedEntries]
  );

  const pendingCount = useMemo(
    () => purchasedEntries.filter((e) => !isCodOrder(e.order) && e.order.paymentStatus !== 'paid').length,
    [purchasedEntries]
  );

  const processedEntries = useMemo(() => {
    let result = [...purchasedEntries];

    if (paymentFilter === 'paid') {
      result = result.filter((e) => !isCodOrder(e.order) && e.order.paymentStatus === 'paid');
    } else if (paymentFilter === 'cod') {
      result = result.filter((e) => isCodOrder(e.order));
    } else if (paymentFilter === 'pending') {
      result = result.filter((e) => !isCodOrder(e.order) && e.order.paymentStatus !== 'paid');
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter((e) => {
        const title = (e.item.productTitle || e.product?.name || '').toLowerCase();
        const orderNum = e.order.orderNumber.toLowerCase();
        const sellerName = (e.item.sellerName || '').toLowerCase();
        const commune = (e.order.deliveryAddress?.commune || '').toLowerCase();
        return (
          title.includes(q) ||
          orderNum.includes(q) ||
          sellerName.includes(q) ||
          commune.includes(q)
        );
      });
    }

    if (sortBy === 'price-asc') {
      result.sort((a, b) => a.item.price - b.item.price);
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.item.price - a.item.price);
    }

    return result;
  }, [purchasedEntries, paymentFilter, searchTerm, sortBy]);

  const formattedTotal = formatMetricCount(purchasedEntries.length);

  return (
    <div id="purchases-tab-content-container" className="space-y-3 pb-8">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
              Mes commandes confirmées
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
              {formattedTotal} achat{purchasedEntries.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen(!isSearchOpen);
                if (isSearchOpen) setSearchTerm('');
              }}
              className={`p-1.5 rounded-lg border transition ${
                isSearchOpen || searchTerm
                  ? 'bg-emerald-500 text-black border-emerald-500'
                  : 'bg-white/5 text-white/70 border-white/10 hover:text-white'
              }`}
              title="Rechercher dans les achats"
              aria-label="Rechercher"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                aria-label="Trier les achats"
                className="appearance-none bg-white/5 border border-white/10 text-white/80 hover:text-white rounded-lg px-2.5 py-1.5 text-[11px] font-bold pr-6 focus:outline-none focus:border-emerald-400 transition cursor-pointer"
              >
                <option value="recent" className="bg-[#181818] text-white">
                  Plus récents
                </option>
                <option value="price-asc" className="bg-[#181818] text-white">
                  Prix croissant
                </option>
                <option value="price-desc" className="bg-[#181818] text-white">
                  Prix décroissant
                </option>
              </select>
              <ArrowUpDown className="w-3 h-3 text-white/40 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="flex items-center bg-white/5 rounded-lg border border-white/10 p-0.5">
              <button
                type="button"
                onClick={() => setColumnsLayout(2)}
                className={`p-1 rounded-md transition ${
                  columnsLayout === 2
                    ? 'bg-emerald-500 text-black font-bold'
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
                    ? 'bg-emerald-500 text-black font-bold'
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

        {isSearchOpen && (
          <div className="relative animate-in fade-in slide-in-from-top-1 duration-150">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par article, #DJ-..., boutique ou commune..."
              className="w-full bg-white/10 border border-white/15 rounded-xl pl-8 pr-8 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-emerald-400"
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

        {/* Payment Filter Chips */}
        {purchasedEntries.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setPaymentFilter('all')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
                paymentFilter === 'all'
                  ? 'bg-[#FF6321] text-white shadow-md shadow-orange-600/20'
                  : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
              }`}
            >
              Toutes ({formattedTotal})
            </button>

            <button
              type="button"
              onClick={() => setPaymentFilter('paid')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                paymentFilter === 'paid'
                  ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                  : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
              }`}
            >
              <CreditCard className="w-3 h-3" />
              <span>Payées en ligne ({formatMetricCount(paidCount)})</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentFilter('cod')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                paymentFilter === 'cod'
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                  : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
              }`}
            >
              <Banknote className="w-3 h-3" />
              <span>À la livraison ({formatMetricCount(codCount)})</span>
            </button>

            {pendingCount > 0 && (
              <button
                type="button"
                onClick={() => setPaymentFilter('pending')}
                className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
                  paymentFilter === 'pending'
                    ? 'bg-amber-500 text-black'
                    : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
                }`}
              >
                En attente ({formatMetricCount(pendingCount)})
              </button>
            )}
          </div>
        )}

        {onOpenPurchasedProducts && purchasedEntries.length > 0 && (
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
                  <span className="px-1.5 py-0.2 rounded-full bg-[#FF6321] text-white text-[9px] font-black">
                    Voir
                  </span>
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

      {/* MAIN GRID */}
      {processedEntries.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl bg-white/[0.02] border border-white/5 space-y-3">
          <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl" />
            <div className="relative w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-500/30 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-emerald-400" />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-extrabold text-white">
              {purchasedEntries.length === 0
                ? 'Aucun achat effectué pour le moment'
                : 'Aucun achat ne correspond à votre filtre'}
            </p>
            <p className="text-xs text-white/50 max-w-xs mx-auto">
              {purchasedEntries.length === 0
                ? 'Commandez sur Djassa pour retrouver vos commandes confirmées et vos reçus officiels ici.'
                : 'Essayez de modifier votre mot-clé ou réinitialisez le filtre.'}
            </p>
          </div>

          {purchasedEntries.length === 0 ? (
            <button
              type="button"
              onClick={onNavigateExplore}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-extrabold shadow-lg shadow-emerald-500/30 hover:brightness-110 active:scale-95 transition"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Parcourir les boutiques d'Adjamé</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setPaymentFilter('all');
              }}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/10 text-white text-xs font-bold hover:bg-white/15 transition"
            >
              <span>Réinitialiser les filtres</span>
            </button>
          )}
        </div>
      ) : (
        <div className={`grid gap-3 ${columnsLayout === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {processedEntries.map(({ order, item, product }) => {
            const paymentBadge = OrderService.getPaymentStatusBadge(
              order.paymentStatus,
              order.paymentMode
            );
            const fallbackImage =
              'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600';
            const imageUrl =
              item.productImage || product?.images[0] || product?.videoPoster || fallbackImage;
            const productTitle = item.productTitle || product?.name || 'Article commandé';

            return (
              <div
                key={`${order.id}-${item.productId}`}
                onClick={() => onSelectOrder(order)}
                className={`relative group rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-900 border border-white/10 hover:border-emerald-500/60 transition-all duration-200 cursor-pointer shadow-xl flex flex-col justify-between ${
                  columnsLayout === 2 ? 'aspect-[9/13.5]' : 'aspect-[9/14.5]'
                }`}
              >
                <img
                  src={imageUrl}
                  alt={productTitle}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                  loading="lazy"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-black/55 pointer-events-none" />

                <div className="relative z-10 p-2.5 flex items-start justify-between gap-1.5">
                  <span className="px-2 py-1 rounded-full bg-emerald-500 text-white text-[8px] font-black uppercase tracking-wider shadow-lg shadow-emerald-950/60 flex items-center gap-1 backdrop-blur-md">
                    <span>✓</span>
                    <span>Commande confirmée</span>
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectOrder(order);
                    }}
                    className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-md border border-white/20 hover:bg-emerald-500 hover:text-black flex items-center justify-center text-white/80 active:scale-75 transition shadow-lg shrink-0"
                    title="Détails & Reçu"
                    aria-label="Détails & Reçu"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="relative z-10 p-2.5 sm:p-3 space-y-1.5">
                  <h3
                    className={`font-extrabold text-white leading-tight drop-shadow-md break-words ${
                      columnsLayout === 2 ? 'text-xs line-clamp-2' : 'text-[11px] line-clamp-1'
                    }`}
                  >
                    {productTitle}
                  </h3>

                  <div className="flex items-center justify-between gap-1.5 pt-0.5">
                    <span
                      className={`font-black text-[#FF6321] drop-shadow-sm ${
                        columnsLayout === 2 ? 'text-xs' : 'text-[11px]'
                      }`}
                    >
                      {formatFCFA(item.price)}
                    </span>

                    {product && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProduct(product);
                        }}
                        className="shrink-0 px-2.5 py-1 rounded-full bg-[#FF6321] hover:bg-[#ff7538] active:scale-95 text-white text-[9px] font-extrabold shadow-md shadow-orange-600/30 transition"
                      >
                        Voir produit
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1 text-[9px] pt-0.5">
                    <span className="text-white/60 truncate font-medium">
                      #{order.orderNumber}
                    </span>

                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[8.5px] font-bold border shrink-0 ${paymentBadge.bgColor} ${paymentBadge.color}`}
                    >
                      {paymentBadge.label}
                    </span>
                  </div>

                  {columnsLayout === 2 && (
                    <div className="pt-1 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectOrder(order);
                        }}
                        className="w-full py-1 px-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 text-[9px] font-bold flex items-center justify-center gap-1 border border-white/10 transition"
                      >
                        <FileText className="w-3 h-3 text-emerald-400" />
                        <span>Détails & Reçu</span>
                        <ChevronRight className="w-2.5 h-2.5 text-white/50 ml-0.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
