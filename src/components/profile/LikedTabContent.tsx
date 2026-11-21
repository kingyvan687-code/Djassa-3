import React, { useState, useMemo } from 'react';
import {
  Heart,
  Play,
  Search,
  Store,
  X,
  Sparkles,
  ShoppingBag,
  ShoppingCart,
  Eye,
  SlidersHorizontal,
  LayoutGrid,
  Grid3X3,
  ArrowUpDown,
  Tag,
  MapPin
} from 'lucide-react';
import { Product, Seller } from '../../types';
import { formatFCFA, formatMetricCount } from '../../services/marketServices';
import { useApp } from '../../context/AppContext';

interface LikedTabContentProps {
  likedProducts: Product[];
  sellers: Seller[];
  onOpenVideoViewer: (products: Product[], selectedId: string) => void;
  onSelectProduct: (product: Product) => void;
  onToggleLike: (productId: string) => void;
  onNavigateFeed: () => void;
  onAddToCart?: (productId: string) => void;
}

export const LikedTabContent: React.FC<LikedTabContentProps> = ({
  likedProducts,
  sellers,
  onOpenVideoViewer,
  onSelectProduct,
  onToggleLike,
  onNavigateFeed,
  onAddToCart
}) => {
  const { addToCart, setVariantModalProduct, showToast } = useApp();

  const handleAddToCart = (product: Product) => {
    if (onAddToCart) {
      onAddToCart(product.id);
      return;
    }
    if (product.variants && product.variants.length > 0) {
      setVariantModalProduct(product);
    } else {
      addToCart(product.id, {}, 1);
      showToast('Article ajouté au panier ! 🛍️');
    }
  };
  // Local state for search, filter & layout
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'price-asc' | 'price-desc' | 'popular'>('recent');
  const [columnsLayout, setColumnsLayout] = useState<2 | 3>(2);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Extract categories present in liked products
  const categories = useMemo(() => {
    const cats = new Set<string>();
    likedProducts.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [likedProducts]);

  // Map sellers by id for fast lookup
  const sellerMap = useMemo(() => {
    const map = new Map<string, Seller>();
    sellers.forEach((s) => map.set(s.id, s));
    return map;
  }, [sellers]);

  // Filtered and sorted products
  const processedProducts = useMemo(() => {
    let result = [...likedProducts];

    // Filter by category
    if (selectedCategory === 'videos') {
      result = result.filter((p) => Boolean(p.videoUrl || p.mediaType === 'video'));
    } else if (selectedCategory !== 'all') {
      result = result.filter((p) => p.category === selectedCategory);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter((p) => {
        const seller = sellerMap.get(p.sellerId);
        return (
          p.name.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          seller?.name.toLowerCase().includes(q) ||
          seller?.username.toLowerCase().includes(q)
        );
      });
    }

    // Sort
    if (sortBy === 'price-asc') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'popular') {
      result.sort(
        (a, b) =>
          (b.videoLikesCount || b.likesCount || 0) - (a.videoLikesCount || a.likesCount || 0)
      );
    }
    // 'recent' keeps userProfile.likedVideoIds order (newest first)

    return result;
  }, [likedProducts, selectedCategory, searchTerm, sortBy, sellerMap]);

  // Total likes counter format
  const formattedCount = formatMetricCount(likedProducts.length);

  return (
    <div id="liked-tab-content-container" className="space-y-3 pb-8">
      {/* 1. TOP TOOLBAR: Total count, Search toggle, Category Pills & Layout View */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#FF6321] inline-block animate-pulse" />
              Vos coups de cœur
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#FF6321]/20 text-[#FF6321] text-[10px] font-bold border border-[#FF6321]/30">
              {formattedCount} {likedProducts.length > 1 ? 'articles' : 'article'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Search Toggle Button */}
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
              title="Rechercher dans les J'aime"
              aria-label="Rechercher"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Sort Dropdown Selector */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                aria-label="Trier les coups de cœur"
                className="appearance-none bg-white/5 border border-white/10 text-white/80 hover:text-white rounded-lg px-2.5 py-1.5 text-[11px] font-bold pr-6 focus:outline-none focus:border-[#FF6321] transition cursor-pointer"
              >
                <option value="recent" className="bg-[#181818] text-white">Récents</option>
                <option value="popular" className="bg-[#181818] text-white">Plus aimés</option>
                <option value="price-asc" className="bg-[#181818] text-white">Prix croissant</option>
                <option value="price-desc" className="bg-[#181818] text-white">Prix décroissant</option>
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
                    ? 'bg-[#FF6321] text-white'
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
                    ? 'bg-[#FF6321] text-white'
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
              placeholder="Filtrer par nom de produit, boutique ou wax..."
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

        {/* Category Filter Chips */}
        {likedProducts.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
                selectedCategory === 'all'
                  ? 'bg-[#FF6321] text-white shadow-md shadow-orange-600/20'
                  : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
              }`}
            >
              Tous ({formatMetricCount(likedProducts.length)})
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('videos')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition flex items-center gap-1 ${
                selectedCategory === 'videos'
                  ? 'bg-[#FF6321] text-white shadow-md shadow-orange-600/20'
                  : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
              }`}
            >
              <Play className="w-2.5 h-2.5 fill-current" />
              <span>Vidéos</span>
            </button>

            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-[#FF6321] text-white shadow-md shadow-orange-600/20'
                    : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. MAIN GRID DISPLAY */}
      {processedProducts.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl bg-white/[0.02] border border-white/5 space-y-3">
          <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 bg-[#FF6321]/20 rounded-full blur-xl" />
            <div className="relative w-12 h-12 rounded-full bg-gradient-to-tr from-[#FF6321]/30 to-rose-500/20 border border-[#FF6321]/30 flex items-center justify-center">
              <Heart className="w-6 h-6 text-[#FF6321] fill-[#FF6321]/40" />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-extrabold text-white">
              {likedProducts.length === 0
                ? 'Aucun coup de cœur pour le moment'
                : 'Aucun produit ne correspond à votre filtre'}
            </p>
            <p className="text-xs text-white/50 max-w-xs mx-auto">
              {likedProducts.length === 0
                ? 'Aimez des vidéos et articles dans le fil ou l’explorateur pour les sauvegarder ici.'
                : 'Essayez de modifier votre mot-clé de recherche ou réinitialisez le filtre.'}
            </p>
          </div>

          {likedProducts.length === 0 ? (
            <button
              type="button"
              onClick={onNavigateFeed}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#FF6321] to-[#FF8C00] text-white text-xs font-extrabold shadow-lg shadow-orange-600/30 hover:brightness-110 active:scale-95 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Découvrir les vidéos tendance</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
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
          {processedProducts.map((product) => {
            const seller = sellerMap.get(product.sellerId);
            const rawLikes = (product.videoLikesCount || product.likesCount || 0) + 1; // It is currently in liked list
            const formattedLikes = formatMetricCount(rawLikes);
            const formattedViews = formatMetricCount(
              product.videoViewsCount || product.viewsCount || 0
            );

            return (
              <div
                key={product.id}
                onClick={() => onOpenVideoViewer(processedProducts, product.id)}
                className={`relative group rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-900 border border-white/10 hover:border-[#FF6321]/60 transition-all duration-200 cursor-pointer shadow-xl select-none flex flex-col justify-between ${
                  columnsLayout === 2
                    ? 'aspect-[9/14]'
                    : 'aspect-[9/15]'
                }`}
              >
                {/* Background Image / Poster */}
                <img
                  src={product.videoPoster || product.images[0]}
                  alt={product.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                  loading="lazy"
                />

                {/* Dark gradient for text legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/50 pointer-events-none" />

                {/* TOP BAR OVERLAY */}
                <div className="relative z-10 p-2.5 flex items-start justify-between gap-1.5">
                  {/* Top-left: Seller badge or discount */}
                  <div className="flex flex-col gap-1 items-start min-w-0">
                    {product.discountPercentage ? (
                      <span className="px-2 py-0.5 rounded-full bg-[#FF6321] text-white text-[9px] font-black shadow-md">
                        -{product.discountPercentage}%
                      </span>
                    ) : (
                      <div className="inline-flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/15 max-w-[120px]">
                        <Store className="w-2.5 h-2.5 text-[#FF6321] shrink-0" />
                        <span className="text-[9px] font-bold text-white truncate">
                          @{seller?.username || 'boutique'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Top-right: Play icon & Unlike button */}
                  <div className="flex items-center gap-1.5">
                    {/* Unlike interactive heart button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLike(product.id);
                      }}
                      className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-md border border-white/20 hover:bg-black/80 flex items-center justify-center text-[#FE2C55] active:scale-75 transition shadow-lg"
                      title="Retirer des coups de cœur"
                      aria-label="Ne plus aimer"
                    >
                      <Heart className="w-3.5 h-3.5 fill-[#FE2C55]" />
                    </button>

                    {/* Play Badge */}
                    <div className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
                      <Play className="w-3 h-3 text-white fill-white ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* BOTTOM CONTENT OVERLAY */}
                <div className="relative z-10 p-2.5 sm:p-3 space-y-1.5">
                  {/* Location & In stock badge */}
                  <div className="flex items-center justify-between text-[9px] text-white/70">
                    <span className="flex items-center gap-0.5 truncate text-white/60">
                      <MapPin className="w-2.5 h-2.5 text-[#FF6321]" />
                      <span className="truncate">{seller?.location || 'Adjamé'}</span>
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-emerald-400 font-bold shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                      En stock
                    </span>
                  </div>

                  {/* Title */}
                  <h3
                    className={`font-extrabold text-white leading-tight drop-shadow-md break-words ${
                      columnsLayout === 2
                        ? 'text-xs line-clamp-2'
                        : 'text-[11px] line-clamp-1'
                    }`}
                  >
                    {product.name}
                  </h3>

                  {/* Price & Likes Count */}
                  <div className="flex items-center justify-between gap-1 pt-0.5">
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className={`font-black text-[#FF6321] drop-shadow-sm ${
                          columnsLayout === 2 ? 'text-xs' : 'text-[11px]'
                        }`}
                      >
                        {formatFCFA(product.price)}
                      </span>
                      {product.originalPrice && product.originalPrice > product.price && (
                        <span className="text-[10px] text-white/40 line-through">
                          {formatFCFA(product.originalPrice)}
                        </span>
                      )}
                    </div>

                    {/* Like counter formatted */}
                    <span className="inline-flex items-center gap-1 text-white/90 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 text-[10px] font-bold shrink-0">
                      <Heart className="w-2.5 h-2.5 text-[#FE2C55] fill-[#FE2C55]" />
                      <span>{formattedLikes}</span>
                    </span>
                  </div>

                  {/* Bottom Action Button: Responsive 2-col vs 3-col */}
                  {columnsLayout === 2 && (
                    <div className="pt-1 flex items-center gap-1.5 opacity-95 group-hover:opacity-100 transition">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProduct(product);
                        }}
                        className="flex-1 py-1.5 px-2 rounded-xl bg-white/15 hover:bg-white/25 active:bg-[#FF6321] text-white text-[10px] font-extrabold flex items-center justify-center gap-1 backdrop-blur-md border border-white/15 transition"
                      >
                        <ShoppingBag className="w-3 h-3" />
                        <span>Voir l'article</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(product);
                        }}
                        className="p-1.5 px-2.5 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] active:scale-90 text-white text-[10px] font-bold flex items-center justify-center gap-1 border border-[#FF6321]/40 backdrop-blur-md transition shadow-md shadow-orange-600/30 shrink-0"
                        title="Ajouter au panier"
                        aria-label="Ajouter au panier"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {columnsLayout === 3 && (
                    <div className="pt-1 flex items-center gap-1 opacity-95 group-hover:opacity-100 transition">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(product);
                        }}
                        className="w-full py-1 px-1.5 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] active:scale-95 text-white text-[9px] font-black flex items-center justify-center gap-1 shadow-md shadow-orange-600/30 transition"
                        title="Ajouter au panier"
                      >
                        <ShoppingCart className="w-3 h-3" />
                        <span>Panier</span>
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
