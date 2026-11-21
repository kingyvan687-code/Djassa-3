import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Users,
  ShoppingBag,
  ShoppingCart,
  Truck,
  CheckCircle2,
  Clock,
  Star,
  Store,
  MapPin,
  Flame,
  ArrowUpDown,
  Play,
  ExternalLink,
  Receipt,
  Calendar,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  ChevronRight,
  Filter,
  Check
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Order, OrderItem, Product, Seller } from '../../types';
import { formatFCFA, formatMetricCount } from '../../services/marketServices';

interface PurchasedProductsModalProps {
  onClose: () => void;
}

export interface PurchasedProductSummary {
  productId: string;
  productTitle: string;
  productImage: string;
  price: number;
  sellerId: string;
  sellerName: string;
  product?: Product;
  seller?: Seller;
  salesCount: number; // Number of people who bought this product
  totalQuantityBoughtByUser: number;
  totalSpentByUser: number;
  lastOrderDate: string;
  lastOrderNumber: string;
  lastOrderStatus: Order['status'];
  lastOrder: Order;
  allOrders: { order: Order; item: OrderItem }[];
  variantsBought: string[];
}

export const PurchasedProductsModal: React.FC<PurchasedProductsModalProps> = ({ onClose }) => {
  const {
    orders,
    products,
    sellers,
    addToCart,
    setSelectedProduct,
    setSelectedSeller,
    setSelectedOrder,
    openVideoViewer,
    showToast
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'popular' | 'delivered' | 'in_progress'>('all');
  const [sortBy, setSortBy] = useState<'buyers-desc' | 'buyers-asc' | 'recent' | 'price-desc' | 'price-asc'>('buyers-desc');
  const [addedProductIds, setAddedProductIds] = useState<Record<string, boolean>>({});

  // Map sellers and products for instant lookup
  const sellerMap = useMemo(() => {
    const map = new Map<string, Seller>();
    sellers.forEach((s) => map.set(s.id, s));
    return map;
  }, [sellers]);

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  // Aggregate user's purchased products across all orders
  const purchasedProducts = useMemo(() => {
    const map = new Map<string, PurchasedProductSummary>();

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const prod = productMap.get(item.productId);
        const seller = sellerMap.get(item.sellerId || prod?.sellerId || '');

        const baseSalesCount = prod?.salesCount ?? 0;

        const existing = map.get(item.productId);
        const variantStr = item.variant ? Object.values(item.variant).join(' / ') : '';

        if (!existing) {
          map.set(item.productId, {
            productId: item.productId,
            productTitle: item.productTitle || prod?.name || 'Produit sans titre',
            productImage: item.productImage || prod?.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600',
            price: item.price || prod?.price || 0,
            sellerId: item.sellerId || prod?.sellerId || '',
            sellerName: item.sellerName || seller?.name || 'Vendeur Adjamé',
            product: prod,
            seller: seller,
            salesCount: baseSalesCount,
            totalQuantityBoughtByUser: item.quantity,
            totalSpentByUser: (item.price || 0) * item.quantity,
            lastOrderDate: order.createdAt,
            lastOrderNumber: order.orderNumber,
            lastOrderStatus: order.status,
            lastOrder: order,
            allOrders: [{ order, item }],
            variantsBought: variantStr ? [variantStr] : []
          });
        } else {
          existing.totalQuantityBoughtByUser += item.quantity;
          existing.totalSpentByUser += (item.price || 0) * item.quantity;
          existing.allOrders.push({ order, item });
          if (variantStr && !existing.variantsBought.includes(variantStr)) {
            existing.variantsBought.push(variantStr);
          }
          // If this order is more recent, update last order info
          if (new Date(order.createdAt).getTime() > new Date(existing.lastOrderDate).getTime()) {
            existing.lastOrderDate = order.createdAt;
            existing.lastOrderNumber = order.orderNumber;
            existing.lastOrderStatus = order.status;
            existing.lastOrder = order;
          }
        }
      });
    });

    return Array.from(map.values());
  }, [orders, productMap, sellerMap]);

  // Overall Statistics
  const stats = useMemo(() => {
    const totalItems = purchasedProducts.reduce((acc, p) => acc + p.totalQuantityBoughtByUser, 0);
    const totalBuyersCommunity = purchasedProducts.reduce((acc, p) => acc + p.salesCount, 0);
    const totalSpent = purchasedProducts.reduce((acc, p) => acc + p.totalSpentByUser, 0);
    const mostPopular = [...purchasedProducts].sort((a, b) => b.salesCount - a.salesCount)[0];

    return {
      totalProductsCount: purchasedProducts.length,
      totalItems,
      totalBuyersCommunity,
      totalSpent,
      mostPopular
    };
  }, [purchasedProducts]);

  // Filter & Sort
  const filteredProducts = useMemo(() => {
    let result = [...purchasedProducts];

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.productTitle.toLowerCase().includes(q) ||
          p.sellerName.toLowerCase().includes(q) ||
          p.product?.category?.toLowerCase().includes(q) ||
          p.lastOrderNumber.toLowerCase().includes(q)
      );
    }

    // Filter type
    if (filterType === 'popular') {
      result = result.filter((p) => p.salesCount >= 1000);
    } else if (filterType === 'delivered') {
      result = result.filter((p) => p.allOrders.some((o) => o.order.status === 'delivered'));
    } else if (filterType === 'in_progress') {
      result = result.filter((p) => p.allOrders.some((o) => o.order.status !== 'delivered'));
    }

    // Sort
    if (sortBy === 'buyers-desc') {
      result.sort((a, b) => b.salesCount - a.salesCount);
    } else if (sortBy === 'buyers-asc') {
      result.sort((a, b) => a.salesCount - b.salesCount);
    } else if (sortBy === 'recent') {
      result.sort((a, b) => new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime());
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'price-asc') {
      result.sort((a, b) => a.price - b.price);
    }

    return result;
  }, [purchasedProducts, searchTerm, filterType, sortBy]);

  const handleBuyAgain = (prodSummary: PurchasedProductSummary) => {
    addToCart(prodSummary.productId, {}, 1);
    setAddedProductIds((prev) => ({ ...prev, [prodSummary.productId]: true }));
    showToast(`"${prodSummary.productTitle}" ajouté au panier ! 🛍️`);
    setTimeout(() => {
      setAddedProductIds((prev) => ({ ...prev, [prodSummary.productId]: false }));
    }, 2000);
  };

  return (
    <div
      id="purchased-products-modal-overlay"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-end sm:justify-center sm:items-center animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="purchased-products-sheet"
        className="w-full sm:max-w-2xl h-[92vh] sm:h-[86vh] bg-[#121212] rounded-t-3xl sm:rounded-3xl border border-white/15 flex flex-col shadow-2xl animate-slideUp overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER BAR */}
        <div className="sticky top-0 z-20 bg-[#161616]/95 backdrop-blur-xl px-4 py-3.5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FF6321]/20 border border-[#FF6321]/40 flex items-center justify-center text-[#FF6321]">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <span>Produits Achetés</span>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold text-white/80">
                  {purchasedProducts.length}
                </span>
              </h2>
              <p className="text-[11px] text-white/50">
                Liste de vos articles et nombre de personnes les ayant achetés
              </p>
            </div>
          </div>
          <button
            id="btn-close-purchased-products-modal"
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {/* STATS OVERVIEW CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Total Articles */}
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 flex flex-col justify-between">
              <div className="flex items-center justify-between text-white/50 text-[11px]">
                <span>Articles achetés</span>
                <ShoppingBag className="w-3.5 h-3.5 text-[#FF6321]" />
              </div>
              <div className="mt-2">
                <span className="text-base font-black text-white">{stats.totalItems}</span>
                <span className="text-[10px] text-white/40 block">
                  en {stats.totalProductsCount} produit{stats.totalProductsCount > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Total Community Buyers */}
            <div className="p-3 bg-gradient-to-br from-orange-500/15 to-transparent rounded-2xl border border-[#FF6321]/30 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#FF6321] text-[11px] font-semibold">
                <span>Acheteurs totaux</span>
                <Users className="w-3.5 h-3.5 text-[#FF6321]" />
              </div>
              <div className="mt-2">
                <span className="text-base font-black text-[#FF6321]">
                  {formatMetricCount(stats.totalBuyersCommunity)}
                </span>
                <span className="text-[10px] text-white/50 block">
                  personnes ont acheté
                </span>
              </div>
            </div>

            {/* Most Popular Product */}
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 flex flex-col justify-between">
              <div className="flex items-center justify-between text-white/50 text-[11px]">
                <span>Top Bestseller</span>
                <Flame className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="mt-2">
                <span className="text-base font-black text-amber-400">
                  {stats.mostPopular ? formatMetricCount(stats.mostPopular.salesCount) : '0'}
                </span>
                <span className="text-[10px] text-white/40 block truncate max-w-full">
                  acheteurs ({stats.mostPopular?.productTitle.slice(0, 14)}...)
                </span>
              </div>
            </div>

            {/* Total Amount Spent */}
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 flex flex-col justify-between">
              <div className="flex items-center justify-between text-white/50 text-[11px]">
                <span>Total dépensé</span>
                <Receipt className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="mt-2">
                <span className="text-xs sm:text-sm font-black text-emerald-400">
                  {formatFCFA(stats.totalSpent)}
                </span>
                <span className="text-[10px] text-white/40 block">
                  sur le marché Adjamé
                </span>
              </div>
            </div>
          </div>

          {/* SEARCH & FILTER CONTROLS */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  placeholder="Rechercher par produit, boutique, catégorie..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-8 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]/60"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Sort selector */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-white/5 border border-white/10 text-white/80 rounded-xl py-2 px-2.5 text-xs font-semibold appearance-none pr-7 focus:outline-none cursor-pointer"
                >
                  <option value="buyers-desc" className="bg-[#1a1a1a]">👥 + d'acheteurs</option>
                  <option value="buyers-asc" className="bg-[#1a1a1a]">👥 - d'acheteurs</option>
                  <option value="recent" className="bg-[#1a1a1a]">🕒 Plus récent</option>
                  <option value="price-desc" className="bg-[#1a1a1a]">💰 Prix décroissant</option>
                  <option value="price-asc" className="bg-[#1a1a1a]">💰 Prix croissant</option>
                </select>
                <ArrowUpDown className="w-3 h-3 text-white/40 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition shrink-0 ${
                  filterType === 'all'
                    ? 'bg-[#FF6321] text-white shadow-md shadow-orange-600/30'
                    : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
                }`}
              >
                Tous ({purchasedProducts.length})
              </button>
              <button
                onClick={() => setFilterType('popular')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition shrink-0 flex items-center gap-1 ${
                  filterType === 'popular'
                    ? 'bg-[#FF6321] text-white shadow-md shadow-orange-600/30'
                    : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
                }`}
              >
                <Flame className="w-3 h-3 text-amber-400" />
                <span>Bestsellers (+1k acheteurs)</span>
              </button>
              <button
                onClick={() => setFilterType('delivered')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition shrink-0 flex items-center gap-1 ${
                  filterType === 'delivered'
                    ? 'bg-[#FF6321] text-white shadow-md shadow-orange-600/30'
                    : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Livrés</span>
              </button>
              <button
                onClick={() => setFilterType('in_progress')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition shrink-0 flex items-center gap-1 ${
                  filterType === 'in_progress'
                    ? 'bg-[#FF6321] text-white shadow-md shadow-orange-600/30'
                    : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
                }`}
              >
                <Truck className="w-3 h-3 text-cyan-400" />
                <span>En cours de livraison</span>
              </button>
            </div>
          </div>

          {/* LIST OF PURCHASED PRODUCTS */}
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center space-y-3 bg-white/5 rounded-3xl border border-white/10 p-6">
              <div className="w-12 h-12 rounded-full bg-white/10 text-white/40 flex items-center justify-center mx-auto">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">Aucun produit acheté trouvé</h3>
              <p className="text-xs text-white/50 max-w-sm mx-auto">
                {searchTerm
                  ? `Aucun résultat pour "${searchTerm}". Essayez avec d'autres mots-clés.`
                  : "Vous n'avez pas encore acheté de produits avec ces critères."}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredProducts.map((item) => {
                const isAdded = addedProductIds[item.productId];
                const hasVideo = Boolean(item.product?.videoUrl);

                return (
                  <div
                    key={item.productId}
                    className="p-3.5 bg-white/5 hover:bg-white/[0.08] rounded-2xl border border-white/10 transition space-y-3"
                  >
                    {/* TOP SECTION: PRODUCT & SELLER */}
                    <div className="flex gap-3">
                      {/* Product Thumbnail */}
                      <div
                        onClick={() => {
                          if (item.product) {
                            setSelectedProduct(item.product);
                          }
                        }}
                        className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-neutral-900 border border-white/10 shrink-0 cursor-pointer group"
                      >
                        <img
                          src={item.productImage}
                          alt={item.productTitle}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                        {hasVideo && (
                          <div className="absolute bottom-1 right-1 p-1 rounded-md bg-black/70 backdrop-blur-sm text-white">
                            <Play className="w-2.5 h-2.5 fill-white" />
                          </div>
                        )}
                        {item.salesCount >= 1000 && (
                          <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-[#FF6321] text-[9px] font-black text-white shadow">
                            Top Vente
                          </div>
                        )}
                      </div>

                      {/* Product details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          {/* Title and price */}
                          <div className="flex items-start justify-between gap-2">
                            <h3
                              onClick={() => {
                                if (item.product) setSelectedProduct(item.product);
                              }}
                              className="text-xs sm:text-sm font-bold text-white line-clamp-2 hover:text-[#FF6321] cursor-pointer transition"
                            >
                              {item.productTitle}
                            </h3>
                            <span className="text-xs sm:text-sm font-black text-[#FF6321] shrink-0 font-mono">
                              {formatFCFA(item.price)}
                            </span>
                          </div>

                          {/* Seller & location */}
                          <div
                            onClick={() => {
                              if (item.seller) setSelectedSeller(item.seller);
                            }}
                            className="flex items-center gap-1.5 mt-1 text-[11px] text-white/60 hover:text-white cursor-pointer transition"
                          >
                            <Store className="w-3 h-3 text-[#FF6321]" />
                            <span className="font-semibold text-white/80 truncate">
                              {item.sellerName}
                            </span>
                            {item.seller?.verified && (
                              <span className="w-3 h-3 rounded-full bg-[#FF6321] text-white text-[7px] font-black flex items-center justify-center">
                                ✓
                              </span>
                            )}
                            <span className="text-white/30">•</span>
                            <span className="text-[10px] text-white/40 truncate">
                              {item.seller?.location || item.product?.location || 'Adjamé'}
                            </span>
                          </div>

                          {/* Category and variants */}
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[10px]">
                            {item.product?.category && (
                              <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-white/60">
                                {item.product.category}
                              </span>
                            )}
                            {item.variantsBought.length > 0 && (
                              <span className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/50">
                                {item.variantsBought.join(' · ')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Order status pill & date */}
                        <div className="flex items-center justify-between text-[10px] text-white/40 mt-1 pt-1 border-t border-white/5">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" />
                            Acheté le {new Date(item.lastOrderDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="font-mono text-white/60">
                            Réf: {item.lastOrderNumber}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* ⭐ NUMBER OF PEOPLE WHO BOUGHT THIS PRODUCT - PRIMARY USER REQUIREMENT */}
                    <div className="p-2.5 rounded-xl bg-gradient-to-r from-orange-500/15 via-[#FF6321]/10 to-amber-500/10 border border-[#FF6321]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#FF6321] text-white flex items-center justify-center shrink-0 shadow-md shadow-orange-600/30">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs sm:text-sm font-black text-white">
                              {formatMetricCount(item.salesCount)} personnes
                            </span>
                            <span className="text-xs font-semibold text-[#FF6321]">
                              ont acheté ce produit
                            </span>
                          </div>
                          <p className="text-[10px] text-white/60 flex items-center gap-1 mt-0.5">
                            <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                            <span>Article populaire validé par la communauté d'Abidjan</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        <span className="text-[10px] font-bold text-white/70">
                          {formatMetricCount(item.product?.reviewsCount ?? 0)} avis vérifiés
                        </span>
                      </div>
                    </div>

                    {/* USER PURCHASE DETAILS ROW */}
                    <div className="grid grid-cols-3 gap-2 p-2 bg-black/30 rounded-xl text-[11px]">
                      <div>
                        <span className="text-[10px] text-white/40 block">Qté achetée</span>
                        <span className="font-bold text-white">
                          {item.totalQuantityBoughtByUser} pièce{item.totalQuantityBoughtByUser > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-white/40 block">Montant payé</span>
                        <span className="font-bold text-emerald-400 font-mono">
                          {formatFCFA(item.totalSpentByUser)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-white/40 block">Statut colis</span>
                        <span className={`font-bold flex items-center gap-1 ${
                          item.lastOrderStatus === 'delivered' ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {item.lastOrderStatus === 'delivered' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              Livré
                            </>
                          ) : (
                            <>
                              <Truck className="w-3 h-3" />
                              En cours
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* ACTION BUTTONS */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap sm:flex-nowrap">
                      {/* Buy again button */}
                      <button
                        id={`btn-buy-again-${item.productId}`}
                        onClick={() => handleBuyAgain(item)}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition active:scale-95 shadow ${
                          isAdded
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#FF6321] hover:bg-[#ff753b] text-white shadow-orange-600/20'
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Ajouté !</span>
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>Racheter</span>
                          </>
                        )}
                      </button>

                      {/* View product */}
                      {item.product && (
                        <button
                          onClick={() => setSelectedProduct(item.product!)}
                          className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-white/70" />
                          <span>Fiche</span>
                        </button>
                      )}

                      {/* Video Reel button if video is present */}
                      {hasVideo && item.product && (
                        <button
                          onClick={() => openVideoViewer([item.product!], item.productId)}
                          className="py-2 px-3 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-xs font-bold transition flex items-center justify-center gap-1"
                          title="Regarder le Reel vidéo du produit"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Reel</span>
                        </button>
                      )}

                      {/* View order / receipt */}
                      <button
                        onClick={() => {
                          setSelectedOrder(item.lastOrder);
                        }}
                        className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-xs font-semibold transition flex items-center justify-center gap-1"
                        title="Voir la commande ou le suivi"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Suivi</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-3 bg-[#161616] border-t border-white/10 flex items-center justify-between text-xs text-white/50">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Séquestre Djassa & Données d'achats certifiées</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
