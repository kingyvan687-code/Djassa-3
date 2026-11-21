import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  TrendingUp,
  Award,
  Crown,
  Flame,
  Star,
  Eye,
  Heart,
  Search,
  Filter,
  ArrowUpDown,
  LayoutGrid,
  ListOrdered,
  ExternalLink,
  Sparkles,
  BarChart2,
  Zap,
  Tag,
  CheckCircle2,
  ChevronRight,
  X
} from 'lucide-react';
import { Product, Seller } from '../../../types';
import { formatFCFA, formatMetricCount } from '../../../services/marketServices';
import { PhotoStatsModal } from './PhotoStatsModal';
import { VideoBoostModal } from './VideoBoostModal';

interface Props {
  seller: Seller;
  products: Product[];
  onSelectProduct: (product: Product) => void;
  showToast: (msg: string) => void;
}

type SortCriteria = 'sales' | 'popularity' | 'revenue' | 'rating';
type FilterTag = 'all' | 'top5' | 'promo' | 'high_volume';

export const SellerSalesTab: React.FC<Props> = ({
  seller,
  products,
  onSelectProduct,
  showToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortCriteria>('sales');
  const [filterTag, setFilterTag] = useState<FilterTag>('all');
  const [displayMode, setDisplayMode] = useState<'grid' | 'list'>('grid');

  // Modals state
  const [selectedProductForStats, setSelectedProductForStats] = useState<Product | null>(null);
  const [selectedProductForBoost, setSelectedProductForBoost] = useState<Product | null>(null);

  // Filter & Search logic
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Filter tag
      if (filterTag === 'promo' && !p.isPromotion && !(p.originalPrice && p.originalPrice > p.price)) {
        return false;
      }
      if (filterTag === 'high_volume' && (p.salesCount || 0) < 500) {
        return false;
      }

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.tags && p.tags.some((t) => t.toLowerCase().includes(q)))
      );
    });
  }, [products, filterTag, searchQuery]);

  // Sort logic
  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    if (sortBy === 'sales') {
      list.sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0));
    } else if (sortBy === 'popularity') {
      list.sort((a, b) => {
        const popA = (a.viewsCount || 0) + (a.likesCount || 0) * 5;
        const popB = (b.viewsCount || 0) + (b.likesCount || 0) * 5;
        return popB - popA;
      });
    } else if (sortBy === 'revenue') {
      list.sort((a, b) => {
        const revA = (a.salesCount || 0) * a.price;
        const revB = (b.salesCount || 0) * b.price;
        return revB - revA;
      });
    } else if (sortBy === 'rating') {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    if (filterTag === 'top5') {
      return list.slice(0, 5);
    }

    return list;
  }, [filteredProducts, sortBy, filterTag]);

  // Maximum sales for relative popularity bar
  const maxSales = useMemo(() => {
    const max = Math.max(...products.map((p) => p.salesCount || 0), 1);
    return max;
  }, [products]);

  // Overall statistics
  const totalSalesCount = useMemo(() => {
    return products.reduce((acc, p) => acc + (p.salesCount || 0), 0);
  }, [products]);

  const topSellerProduct = useMemo(() => {
    const sorted = [...products].sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0));
    return sorted[0] || null;
  }, [products]);

  return (
    <div id="seller-sales-tab" className="space-y-4 select-none">
      {/* 1. TOP SUMMARY BANNER: POPULARITÉ & CLASSEMENT */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {/* Total des ventes */}
        <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/50 text-[10px]">
            <span>Volume total acheté</span>
            <ShoppingBag className="w-3.5 h-3.5 text-[#FF6321]" />
          </div>
          <div className="mt-2">
            <span className="text-base sm:text-lg font-black text-white">
              {formatMetricCount(totalSalesCount)} achats
            </span>
            <span className="text-[10px] text-emerald-400 font-bold block mt-0.5">
              +18% ce mois-ci
            </span>
          </div>
        </div>

        {/* N°1 Bestseller de la boutique */}
        <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500/15 via-[#FF6321]/10 to-transparent border border-amber-500/30 flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-300 text-[10px] font-bold">
            <span className="flex items-center gap-1">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>N°1 des Ventes</span>
            </span>
            <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-[9px] font-black text-amber-300 border border-amber-400/30">
              {topSellerProduct ? formatMetricCount(topSellerProduct.salesCount) : '0'} achats
            </span>
          </div>
          <div className="mt-2">
            <p className="text-xs font-bold text-white truncate">
              {topSellerProduct ? topSellerProduct.name : 'Aucun produit'}
            </p>
            <p className="text-[10px] text-white/50 truncate mt-0.5">
              {topSellerProduct ? formatFCFA(topSellerProduct.price) : '0 FCFA'}
            </p>
          </div>
        </div>

        {/* Note moyenne sur les achats */}
        <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between text-white/50 text-[10px]">
            <span>Satisfaction Acheteurs</span>
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-base sm:text-lg font-black text-white">
              4.9 / 5
            </span>
            <span className="text-[10px] text-amber-400 font-bold">
              ★ {seller.reviewsCount || 384} avis vérifiés
            </span>
          </div>
        </div>
      </div>

      {/* 2. SEARCH & CONTROLS */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, tissu, modèle..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321] transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View mode toggle (Grid / List) */}
          <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/10 shrink-0">
            <button
              onClick={() => setDisplayMode('grid')}
              className={`p-1.5 rounded-lg transition ${
                displayMode === 'grid'
                  ? 'bg-[#FF6321] text-white shadow-md'
                  : 'text-white/50 hover:text-white'
              }`}
              title="Vue Grille / Cartes Vidéo"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDisplayMode('list')}
              className={`p-1.5 rounded-lg transition ${
                displayMode === 'list'
                  ? 'bg-[#FF6321] text-white shadow-md'
                  : 'text-white/50 hover:text-white'
              }`}
              title="Vue Liste Classement détaillée"
            >
              <ListOrdered className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter chips & Sorting selector */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
            <button
              onClick={() => setFilterTag('all')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap ${
                filterTag === 'all'
                  ? 'bg-[#FF6321] text-white shadow-sm'
                  : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
              }`}
            >
              Tous les articles ({products.length})
            </button>

            <button
              onClick={() => setFilterTag('top5')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap flex items-center gap-1 ${
                filterTag === 'top5'
                  ? 'bg-[#FF6321] text-white shadow-sm'
                  : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
              }`}
            >
              <Crown className="w-3 h-3 text-amber-400" />
              <span>Top 5 Plus Achetés</span>
            </button>

            <button
              onClick={() => setFilterTag('high_volume')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap flex items-center gap-1 ${
                filterTag === 'high_volume'
                  ? 'bg-[#FF6321] text-white shadow-sm'
                  : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
              }`}
            >
              <Flame className="w-3 h-3 text-orange-400" />
              <span>+500 Achats (Bestsellers)</span>
            </button>

            <button
              onClick={() => setFilterTag('promo')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap flex items-center gap-1 ${
                filterTag === 'promo'
                  ? 'bg-[#FF6321] text-white shadow-sm'
                  : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
              }`}
            >
              <Tag className="w-3 h-3 text-rose-400" />
              <span>En Promo</span>
            </button>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1 text-[11px] text-white/50 shrink-0">
            <ArrowUpDown className="w-3 h-3 text-[#FF6321]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortCriteria)}
              className="bg-[#181818] text-white text-[11px] font-bold rounded-lg px-2 py-1 border border-white/10 focus:outline-none"
            >
              <option value="sales">Plus achetés 🛍️</option>
              <option value="popularity">Popularité (Vues 🔥)</option>
              <option value="revenue">Chiffre d'affaires 💰</option>
              <option value="rating">Meilleures notes ⭐</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. PRODUCT LISTING */}
      {sortedProducts.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-3xl bg-white/[0.02] border border-white/10 space-y-3">
          <ShoppingBag className="w-10 h-10 text-white/20 mx-auto" />
          <p className="text-xs font-bold text-white">Aucun produit trouvé</p>
          <p className="text-[11px] text-white/40 max-w-xs mx-auto">
            Aucun article ne correspond à votre filtre de classement actuel.
          </p>
        </div>
      ) : displayMode === 'grid' ? (
        /* GRID MODE: CARDS WITH RANK MEDAL AND K METRICS (INSPIRED BY VIDEO TAB) */
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
          {sortedProducts.map((product, index) => {
            const rank = index + 1;
            const coverImage = product.images?.[0] || product.videoPoster || 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600';
            const sales = product.salesCount || 0;
            const views = product.viewsCount || (sales * 8 + 420);

            return (
              <div
                key={product.id}
                onClick={() => onSelectProduct(product)}
                className="relative aspect-[9/15] rounded-2xl overflow-hidden bg-neutral-900 border border-white/10 shadow-lg group flex flex-col justify-between p-2.5 select-none cursor-pointer hover:border-[#FF6321]/60 transition"
              >
                {/* Background Poster Image */}
                <img
                  src={coverImage}
                  alt={product.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500 pointer-events-none"
                  loading="lazy"
                />

                {/* Dark Gradient Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-black/60 pointer-events-none" />

                {/* TOP BAR: CLASSEMENT RANK MEDAL */}
                <div className="relative z-10 flex items-center gap-1 flex-wrap">
                  {/* Rank Badge */}
                  {rank === 1 ? (
                    <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-black text-[10px] font-black shadow-md flex items-center gap-1">
                      <Crown className="w-3 h-3 fill-black text-black" />
                      <span>N°1 Bestseller</span>
                    </span>
                  ) : rank === 2 ? (
                    <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-slate-200 to-slate-400 text-black text-[10px] font-black shadow-md flex items-center gap-1">
                      <Award className="w-3 h-3 fill-black text-black" />
                      <span>N°2</span>
                    </span>
                  ) : rank === 3 ? (
                    <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-700 to-amber-600 text-white text-[10px] font-black shadow-md flex items-center gap-1">
                      <Award className="w-3 h-3 text-white" />
                      <span>N°3</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-white/90 text-[10px] font-black">
                      #{rank}
                    </span>
                  )}

                  {product.isPromotion && (
                    <span className="px-1.5 py-0.5 rounded-full bg-red-600/90 border border-red-500/40 text-[9px] font-black text-white shadow-sm">
                      PROMO
                    </span>
                  )}
                </div>

                {/* BOTTOM OVERLAY: Product info & Metrics with 'k' */}
                <div className="relative z-10 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-white/80 flex-wrap gap-1">
                    <span className="flex items-center gap-1 font-extrabold text-emerald-400">
                      <ShoppingBag className="w-3 h-3 text-emerald-400" />
                      {formatMetricCount(sales)} {sales <= 1 ? 'achat' : 'achats'}
                    </span>
                    <span className="flex items-center gap-1 text-amber-400 font-bold">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      {product.rating || 4.9} ({product.reviewsCount || Math.max(1, Math.round(sales * 0.15))})
                    </span>
                    <span className="flex items-center gap-1 text-white/60">
                      <Eye className="w-3 h-3 text-cyan-400" />
                      {formatMetricCount(views)}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-white line-clamp-1">
                    {product.name}
                  </p>

                  <div className="flex items-center justify-between gap-1 pt-0.5">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-black text-[#FF6321]">
                        {formatFCFA(product.price)}
                      </span>
                      {product.originalPrice && product.originalPrice > product.price && (
                        <span className="text-[10px] text-white/40 line-through">
                          {formatFCFA(product.originalPrice)}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProduct(product);
                      }}
                      className="px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 text-[10px] font-bold transition flex items-center gap-0.5"
                    >
                      Article
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST MODE: LEADERBOARD DETAILED ROWS */
        <div className="space-y-2">
          {sortedProducts.map((product, index) => {
            const rank = index + 1;
            const coverImage = product.images?.[0] || product.videoPoster || 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600';
            const sales = product.salesCount || 0;
            const views = product.viewsCount || (sales * 8 + 420);
            const popularityPercentage = Math.min(100, Math.round((sales / maxSales) * 100));
            const estimatedRevenue = sales * product.price;

            return (
              <div
                key={product.id}
                onClick={() => onSelectProduct(product)}
                className="p-3 rounded-2xl bg-[#141414] border border-white/10 hover:border-[#FF6321]/50 flex items-center justify-between gap-3 cursor-pointer group transition select-none"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Rank Column */}
                  <div className="w-7 text-center shrink-0">
                    {rank === 1 ? (
                      <span className="text-base" title="Top 1">🥇</span>
                    ) : rank === 2 ? (
                      <span className="text-base" title="Top 2">🥈</span>
                    ) : rank === 3 ? (
                      <span className="text-base" title="Top 3">🥉</span>
                    ) : (
                      <span className="text-xs font-black text-white/40">#{rank}</span>
                    )}
                  </div>

                  {/* Thumbnail */}
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-neutral-900 shrink-0 border border-white/10">
                    <img
                      src={coverImage}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                  </div>

                  {/* Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <b className="text-xs text-white truncate block">{product.name}</b>
                      {product.isPromotion && (
                        <span className="px-1.5 py-0.2 rounded bg-red-600/30 text-red-400 text-[8px] font-black border border-red-500/30">
                          PROMO
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-white/50 mt-0.5 flex-wrap">
                      <span className="text-xs font-black text-[#FF6321]">{formatFCFA(product.price)}</span>
                      <span>•</span>
                      <span className="text-emerald-400 font-extrabold flex items-center gap-0.5">
                        <ShoppingBag className="w-3 h-3" />
                        {formatMetricCount(sales)} {sales <= 1 ? 'achat' : 'achats'}
                      </span>
                      <span>•</span>
                      <span className="text-amber-400 font-bold flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-amber-400" />
                        {product.rating || 4.9}
                      </span>
                      <span>•</span>
                      <span>CA estimé: <b className="text-white/80">{formatMetricCount(estimatedRevenue)} FCFA</b></span>
                    </div>

                    {/* Mini Popularity Bar */}
                    <div className="w-36 max-w-full h-1 bg-white/10 rounded-full mt-1.5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-[#FF6321] rounded-full"
                        style={{ width: `${Math.max(5, popularityPercentage)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setSelectedProductForStats(product)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-cyan-400 hover:text-cyan-300 transition border border-white/5"
                    title="Statistiques de vente"
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setSelectedProductForBoost(product)}
                    className="p-2 rounded-xl bg-[#FF6321]/15 hover:bg-[#FF6321] text-[#FF6321] hover:text-white transition border border-[#FF6321]/20"
                    title="Booster ce produit"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                  </button>

                  <button
                    onClick={() => onSelectProduct(product)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 transition border border-white/5"
                    title="Voir l'article"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. MODALS */}
      {selectedProductForStats && (
        <PhotoStatsModal
          product={selectedProductForStats}
          onClose={() => setSelectedProductForStats(null)}
          onOpenPhotoDetail={() => {}}
          onOpenBoost={(p) => {
            setSelectedProductForStats(null);
            setSelectedProductForBoost(p);
          }}
        />
      )}

      {selectedProductForBoost && (
        <VideoBoostModal
          product={selectedProductForBoost}
          onClose={() => setSelectedProductForBoost(null)}
          onBoostConfirm={(p, packName) => {
            setSelectedProductForBoost(null);
            showToast(`Campagne Djassa Ads (${packName}) activée pour ${p.name} ! 🚀`);
          }}
        />
      )}
    </div>
  );
};
