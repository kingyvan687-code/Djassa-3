import React, { useState } from 'react';
import { 
  Camera, 
  Eye, 
  Heart, 
  ShoppingBag, 
  TrendingUp, 
  Search, 
  Plus, 
  Sparkles, 
  Layers, 
  LayoutGrid, 
  LayoutList, 
  SlidersHorizontal,
  Share2,
  ExternalLink,
  BarChart2,
  Rocket,
  MessageCircle,
  MoreVertical,
  Check,
  Tag,
  ArrowUpDown,
  MessageSquare,
  Edit3,
  Zap,
  Star
} from 'lucide-react';
import { Product } from '../../../types';
import { formatFCFA, formatMetricCount } from '../../../services/marketServices';
import { useApp } from '../../../context/AppContext';
import { PhotoDetailModal } from './PhotoDetailModal';
import { PhotoStatsModal } from './PhotoStatsModal';
import { VideoBoostModal } from './VideoBoostModal';
import { EditMerchandiseModal } from '../boutique/EditMerchandiseModal';

interface Props {
  photos: Product[];
  onSelectProduct: (product: Product) => void;
  onGoAddPhoto: () => void;
  showToast: (msg: string) => void;
}

type ViewMode = 'grid' | 'feed' | 'compact';
type FilterCategory = 'all' | 'mode' | 'maroquinerie' | 'promo' | 'arrivage';
type SortOption = 'recent' | 'views' | 'sales' | 'price_asc' | 'price_desc';

export const SellerPhotosTab: React.FC<Props> = ({
  photos,
  onSelectProduct,
  onGoAddPhoto,
  showToast,
}) => {
  const { openChatWithParticipant, updateProductSeller, deleteProductSeller } = useApp();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [activeMenuPhotoId, setActiveMenuPhotoId] = useState<string | null>(null);

  // Modals state
  const [selectedPhotoForDetail, setSelectedPhotoForDetail] = useState<Product | null>(null);
  const [selectedPhotoForStats, setSelectedPhotoForStats] = useState<Product | null>(null);
  const [selectedPhotoForBoost, setSelectedPhotoForBoost] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Filter & Search
  const filteredPhotos = photos.filter((p) => {
    // Category chips
    if (categoryFilter === 'promo' && !p.isPromotion && !(p.originalPrice && p.originalPrice > p.price)) {
      return false;
    }
    if (categoryFilter === 'arrivage' && p.contentType !== 'publication' && !p.tags?.some(t => t.toLowerCase().includes('arrivage'))) {
      return false;
    }
    if (categoryFilter === 'mode' && !p.category.toLowerCase().includes('mode') && !p.category.toLowerCase().includes('habillement')) {
      return false;
    }
    if (categoryFilter === 'maroquinerie' && !p.category.toLowerCase().includes('sac') && !p.category.toLowerCase().includes('chaussure') && !p.category.toLowerCase().includes('maroquinerie')) {
      return false;
    }

    // Search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.tags && p.tags.some((t) => t.toLowerCase().includes(q)))
    );
  });

  // Sorting
  const sortedPhotos = [...filteredPhotos].sort((a, b) => {
    if (sortBy === 'views') {
      return (b.viewsCount || 0) - (a.viewsCount || 0);
    }
    if (sortBy === 'sales') {
      return (b.salesCount || 0) - (a.salesCount || 0);
    }
    if (sortBy === 'price_asc') {
      return a.price - b.price;
    }
    if (sortBy === 'price_desc') {
      return b.price - a.price;
    }
    return 0; // default order
  });

  const handleOpenDiscussion = (product: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    openChatWithParticipant({
      participantId: product.sellerId || 'seller-1',
      participantName: 'Vendeur Djassa',
      participantType: 'seller',
      participantRoleSubtitle: `Article Photo • ${product.category || 'Djassa'}`,
      initialMessage: `Bonjour, message à propos de l'article "${product.name}" (${formatFCFA(product.price)}).`
    });
  };

  // Helper for formatting views & likes numbers
  const formatCount = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1).replace('.', ',')}M`;
    if (num >= 10000) return `${(num / 1000).toFixed(0)}k`;
    if (num >= 1000) return `${(num / 1000).toFixed(1).replace('.', ',')}k`;
    return num.toLocaleString('fr-FR');
  };

  // Real or fallback statistics for each photo publication
  const getProductStats = (prod: Product, index: number) => {
    const fallbackViews = [15400, 28700, 8900, 11200, 9800, 7400];
    const fallbackLikes = [1201, 2250, 716, 907, 808, 620];
    const views = prod.viewsCount || fallbackViews[index % fallbackViews.length];
    const likes = prod.likesCount || prod.videoLikesCount || fallbackLikes[index % fallbackLikes.length];
    return { views, likes };
  };

  // Handlers for modifying merchandise
  const handleSaveEdit = (updates: Partial<Product>) => {
    if (!editingProduct) return;
    updateProductSeller(editingProduct.id, updates);
    showToast('Publication modifiée avec succès ! ✨');
    setEditingProduct(null);
  };

  const handleDeleteProduct = () => {
    if (!editingProduct) return;
    deleteProductSeller(editingProduct.id);
    showToast('Article retiré du catalogue.');
    setEditingProduct(null);
  };

  return (
    <div id="seller-photos-tab" className="space-y-4">
      {/* 1. CONTROLS: SEARCH, FILTERS, VIEW MODES */}
      <div className="space-y-2.5">
        {/* Search bar & View mode toggles */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une photo, un modèle ou un tag..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]/60 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/40 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* View Mode Switcher: Grid (Instagram) | Feed (Lookbook) | Compact */}
          <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/10 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              title="Grille (2 par 2)"
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid'
                  ? 'bg-[#FF6321] text-white shadow-md'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('feed')}
              title="Flux Lookbook détaillé"
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'feed'
                  ? 'bg-[#FF6321] text-white shadow-md'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('compact')}
              title="Liste catalogue rapide"
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'compact'
                  ? 'bg-[#FF6321] text-white shadow-md'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <LayoutList className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category Pills & Sort Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap ${
                categoryFilter === 'all'
                  ? 'bg-white text-black shadow-sm'
                  : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
              }`}
            >
              Tout ({photos.length} publiés)
            </button>
            <button
              onClick={() => setCategoryFilter('mode')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap ${
                categoryFilter === 'mode'
                  ? 'bg-[#FF6321] text-white'
                  : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
              }`}
            >
              👗 Mode & Wax
            </button>
            <button
              onClick={() => setCategoryFilter('maroquinerie')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap ${
                categoryFilter === 'maroquinerie'
                  ? 'bg-[#FF6321] text-white'
                  : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
              }`}
            >
              👜 Maroquinerie & Sacs
            </button>
            <button
              onClick={() => setCategoryFilter('arrivage')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap ${
                categoryFilter === 'arrivage'
                  ? 'bg-[#FF6321] text-white'
                  : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
              }`}
            >
              ⚡ Arrivages récents
            </button>
            <button
              onClick={() => setCategoryFilter('promo')}
              className={`px-3 py-1 rounded-full text-[11px] font-bold transition whitespace-nowrap ${
                categoryFilter === 'promo'
                  ? 'bg-red-500 text-white'
                  : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
              }`}
            >
              🏷️ En Promo
            </button>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1 text-[11px] text-white/50 shrink-0">
            <ArrowUpDown className="w-3 h-3 text-[#FF6321]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-[#181818] text-white text-[11px] font-bold rounded-lg px-2 py-1 border border-white/10 focus:outline-none"
            >
              <option value="recent">Plus récentes</option>
              <option value="views">Plus vues 🔥</option>
              <option value="sales">Top ventes</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix décroissant</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. CONTENT DISPLAY ACCORDING TO VIEW MODE */}
      {sortedPhotos.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-3xl bg-white/[0.02] border border-white/10 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-white/30">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Aucune photo trouvée</h4>
            <p className="text-[11px] text-white/40 mt-1 max-w-xs mx-auto">
              Aucun cliché ne correspond à vos filtres ou à votre recherche actuelle.
            </p>
          </div>
          <button
            onClick={onGoAddPhoto}
            className="py-2 px-4 rounded-xl bg-[#FF6321] text-white text-xs font-bold shadow-md hover:bg-[#ff753b] transition"
          >
            Ajouter un article avec photos
          </button>
        </div>
      ) : (
        <>
          {/* VIEW MODE A: 2-BY-2 GRID (Inspired by seller videos tab with k metrics) */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
              {sortedPhotos.map((product, index) => {
                const imagesCount = product.images?.length || 1;
                const coverImage = product.images?.[0] || product.videoPoster || 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600';
                const { views, likes } = getProductStats(product, index);
                const isMenuOpen = activeMenuPhotoId === product.id;

                return (
                  <div
                    key={product.id}
                    id={`photo-card-${product.id}`}
                    onClick={() => setSelectedPhotoForDetail(product)}
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-black/60 pointer-events-none" />

                    {/* TOP BAR: Views badge + Promo badge */}
                    <div className="relative z-10 flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[10px] font-bold text-white shadow-sm">
                          <Eye className="w-3 h-3 text-cyan-400" />
                          <span>{formatMetricCount(views)}</span>
                        </div>
                        {product.isPromotion && (
                          <span className="px-1.5 py-0.5 rounded-full bg-red-600/90 border border-red-500/40 text-[9px] font-black text-white shadow-sm tracking-wide">
                            PROMO
                          </span>
                        )}
                      </div>
                    </div>

                    {/* CENTER: Subtle photo indicator on hover */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPhotoForDetail(product);
                      }}
                      className="relative z-10 my-auto flex flex-col items-center justify-center cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-full bg-white/20 hover:bg-[#FF6321] backdrop-blur-md text-white flex items-center justify-center transition shadow-xl group-hover:scale-110 active:scale-95 border border-white/20 opacity-0 group-hover:opacity-100 duration-200">
                        <Camera className="w-4 h-4 text-white" />
                      </div>
                    </div>

                    {/* BOTTOM: Product info + direct stats with 'k' formatting */}
                    <div className="relative z-10 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-white/70 flex-wrap gap-1">
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                          {formatMetricCount(likes)}
                        </span>
                        <span className="flex items-center gap-1 text-amber-400 font-bold">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          {product.rating || 4.9} ({product.reviewsCount || Math.max(1, Math.round((product.salesCount || 10) * 0.15))})
                        </span>
                        <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                          <ShoppingBag className="w-3 h-3 text-emerald-400" />
                          {formatMetricCount(product.salesCount || 0)} {((product.salesCount || 0) <= 1) ? 'achat' : 'achats'}
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
                          className="px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 text-[10px] font-bold transition"
                        >
                          Article
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW MODE B: LOOKBOOK FEED CARDS */}
          {viewMode === 'feed' && (
            <div className="space-y-4">
              {sortedPhotos.map((product) => {
                const images = product.images && product.images.length > 0
                  ? product.images
                  : [product.videoPoster || 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600'];

                return (
                  <div
                    key={product.id}
                    className="p-3.5 sm:p-4 rounded-3xl bg-[#141414] border border-white/10 space-y-3 shadow-lg"
                  >
                    {/* Header with Title, Category, Price & Menu */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-black uppercase text-[#FF6321] tracking-wider block">
                          {product.category}
                        </span>
                        <h3 className="text-sm font-black text-white truncate">
                          {product.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs font-black text-[#FF6321]">
                            {formatFCFA(product.price)}
                          </span>
                          {product.originalPrice && product.originalPrice > product.price && (
                            <span className="text-[10px] text-white/40 line-through">
                              {formatFCFA(product.originalPrice)}
                            </span>
                          )}
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                            Stock : {product.stock}
                          </span>
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/30 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Produit publié
                          </span>
                        </div>
                      </div>

                      {/* Quick options button */}
                      <button
                        onClick={() => setSelectedPhotoForStats(product)}
                        className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition flex items-center gap-1 text-[10px] font-bold"
                      >
                        <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="hidden sm:inline">Stats</span>
                      </button>
                    </div>

                    {/* Horizontal swipeable gallery of all photos */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 pt-0.5 snap-x">
                      {images.map((img, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedPhotoForDetail(product)}
                          className="relative aspect-[3/4] h-48 sm:h-56 rounded-2xl overflow-hidden bg-neutral-900 border border-white/10 shrink-0 snap-center cursor-pointer group"
                        >
                          <img
                            src={img}
                            alt={`${product.name} photo ${idx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                          <div className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[9px] font-bold text-white">
                            {idx + 1}/{images.length}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Description & tags */}
                    {product.description && (
                      <p className="text-[11px] text-white/70 line-clamp-2">
                        {product.description}
                      </p>
                    )}

                    {product.tags && product.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {product.tags.map((t, ti) => (
                          <span key={ti} className="text-[10px] text-[#FF6321]/80 bg-[#FF6321]/10 px-2 py-0.5 rounded-md">
                            {t.startsWith('#') ? t : `#${t}`}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Bottom Action Footer */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5 flex-wrap">
                      <div className="flex items-center gap-3 text-[10px] text-white/50 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3 text-cyan-400" />
                          {formatMetricCount(product.viewsCount || 10000)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3 text-rose-500" />
                          {formatMetricCount(product.likesCount || 850)}
                        </span>
                        <span className="flex items-center gap-1 text-emerald-400 font-bold">
                          <ShoppingBag className="w-3 h-3" />
                          {formatMetricCount(product.salesCount || 0)} {((product.salesCount || 0) <= 1) ? 'article acheté' : 'articles achetés'}
                        </span>
                        <span className="flex items-center gap-1 text-amber-400 font-bold">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          {product.rating || 4.9} ({product.reviewsCount || Math.max(1, Math.round((product.salesCount || 10) * 0.15))} avis)
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setEditingProduct(product)}
                          className="py-1.5 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/90 hover:text-emerald-300 transition text-xs font-bold flex items-center gap-1 border border-white/10"
                          title="Modifier les détails de la marchandise"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Modifier</span>
                        </button>

                        <button
                          onClick={() => setSelectedPhotoForBoost(product)}
                          className="py-1.5 px-3 rounded-xl bg-[#FF6321]/15 text-[#FF6321] hover:bg-[#FF6321] hover:text-white transition text-xs font-bold flex items-center gap-1 border border-[#FF6321]/20"
                        >
                          <Zap className="w-3.5 h-3.5 fill-current" />
                          <span>Booster</span>
                        </button>

                        <button
                          onClick={() => setSelectedPhotoForStats(product)}
                          className="py-1.5 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/90 hover:text-cyan-300 transition text-xs font-bold flex items-center gap-1 border border-white/10"
                          title="Statistiques de la photo"
                        >
                          <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Stats</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW MODE C: COMPACT CATALOG LIST */}
          {viewMode === 'compact' && (
            <div className="space-y-2">
              {sortedPhotos.map((product) => {
                const coverImage = product.images?.[0] || product.videoPoster;
                const imagesCount = product.images?.length || 1;

                return (
                  <div
                    key={product.id}
                    onClick={() => setSelectedPhotoForDetail(product)}
                    className="p-2.5 rounded-2xl bg-[#141414] border border-white/10 hover:border-white/20 flex items-center justify-between gap-3 cursor-pointer group transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Photo thumb */}
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-neutral-900 shrink-0 border border-white/10">
                        <img
                          src={coverImage}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                        {imagesCount > 1 && (
                          <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/70 text-[8px] font-bold text-white">
                            {imagesCount}📷
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <b className="text-xs text-white block truncate">{product.name}</b>
                        <span className="text-[10px] text-white/50 block truncate">{product.category}</span>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs font-black text-[#FF6321]">{formatFCFA(product.price)}</span>
                          <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-0.5">
                            <ShoppingBag className="w-2.5 h-2.5" />
                            {formatMetricCount(product.salesCount || 0)} {(product.salesCount || 0) <= 1 ? 'achat' : 'achats'}
                          </span>
                          <span className="text-[9px] text-amber-400 font-bold flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5 fill-amber-400" />
                            {product.rating || 4.9} ({product.reviewsCount || Math.max(1, Math.round((product.salesCount || 10) * 0.15))} avis)
                          </span>
                          <span className="text-[8px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                            Publié
                          </span>
                          <span className="text-[9px] text-white/40">Stock : {product.stock}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions: Modifier, Booster, Stats */}
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setEditingProduct(product)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-emerald-400 hover:text-emerald-300 transition border border-white/5"
                        title="Modifier l'article"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setSelectedPhotoForBoost(product)}
                        className="p-2 rounded-xl bg-[#FF6321]/15 hover:bg-[#FF6321] text-[#FF6321] hover:text-white transition border border-[#FF6321]/20"
                        title="Booster la publication"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                      </button>

                      <button
                        onClick={() => setSelectedPhotoForStats(product)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-cyan-400 hover:text-cyan-300 transition border border-white/5"
                        title="Statistiques de la photo"
                      >
                        <BarChart2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 4. MODALS */}
      {selectedPhotoForDetail && (
        <PhotoDetailModal
          product={selectedPhotoForDetail}
          allProducts={sortedPhotos.length > 0 ? sortedPhotos : photos}
          onClose={() => setSelectedPhotoForDetail(null)}
          onSelectProduct={onSelectProduct}
          onOpenStats={(p) => {
            setSelectedPhotoForDetail(null);
            setSelectedPhotoForStats(p);
          }}
          onOpenBoost={(p) => {
            setSelectedPhotoForDetail(null);
            setSelectedPhotoForBoost(p);
          }}
          showToast={showToast}
        />
      )}

      {selectedPhotoForStats && (
        <PhotoStatsModal
          product={selectedPhotoForStats}
          onClose={() => setSelectedPhotoForStats(null)}
          onOpenPhotoDetail={(p) => {
            setSelectedPhotoForStats(null);
            setSelectedPhotoForDetail(p);
          }}
          onOpenBoost={(p) => {
            setSelectedPhotoForStats(null);
            setSelectedPhotoForBoost(p);
          }}
        />
      )}

      {selectedPhotoForBoost && (
        <VideoBoostModal
          product={selectedPhotoForBoost}
          onClose={() => setSelectedPhotoForBoost(null)}
          onBoostConfirm={(p, packName, amount) => {
            setSelectedPhotoForBoost(null);
            showToast(`Campagne Djassa Ads (${packName}) activée pour ${p.name} ! 🚀`);
          }}
        />
      )}

      {/* 5. EDIT MERCHANDISE MODAL */}
      {editingProduct && (
        <EditMerchandiseModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={handleSaveEdit}
          onDelete={handleDeleteProduct}
        />
      )}
    </div>
  );
};
