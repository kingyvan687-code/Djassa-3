import React, { useMemo, useState, useDeferredValue } from 'react';
import { 
  Search, 
  Plus, 
  Pencil, 
  Trash2, 
  Megaphone, 
  Video as VideoIcon, 
  Minus, 
  Package,
} from 'lucide-react';
import { Product } from '../../../types';
import { formatFCFA, formatMetricCount } from '../../../services/marketServices';

interface Props {
  products: Product[];
  onGoAdd: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
  onPromoteProduct: (product: Product) => void;
  onQuickStockChange: (productId: string, newStock: number) => void;
  onSelectProduct: (product: Product) => void;
  onOpenVideo: (products: Product[], productId: string) => void;
}

export const MerchandiseTab: React.FC<Props> = ({
  products,
  onGoAdd,
  onEditProduct,
  onDeleteProduct,
  onPromoteProduct,
  onQuickStockChange,
  onSelectProduct,
  onOpenVideo,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [filter, setFilter] = useState<'all' | 'healthy' | 'low' | 'out' | 'promo' | 'video'>('all');

  // Single-pass memoized stock health & catalog counts
  const { countTotal, countHealthy, countLow, countOut, countPromo, countVideo } = useMemo(() => {
    let healthy = 0;
    let low = 0;
    let out = 0;
    let promo = 0;
    let video = 0;
    for (const p of products) {
      if (p.stock > 5) healthy++;
      else if (p.stock > 0) low++;
      else out++;
      if (p.isPromotion || (p.discountPercentage || 0) > 0) promo++;
      if (p.mediaType === 'video' && p.videoUrl) video++;
    }
    return {
      countTotal: products.length,
      countHealthy: healthy,
      countLow: low,
      countOut: out,
      countPromo: promo,
      countVideo: video,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (q) {
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesCat = p.category.toLowerCase().includes(q);
        if (!matchesName && !matchesCat) return false;
      }

      if (filter === 'healthy') return p.stock > 5;
      if (filter === 'low') return p.stock > 0 && p.stock <= 5;
      if (filter === 'out') return p.stock === 0;
      if (filter === 'promo') return p.isPromotion || (p.discountPercentage || 0) > 0;
      if (filter === 'video') return p.mediaType === 'video' && p.videoUrl;

      return true;
    });
  }, [products, deferredSearchQuery, filter]);

  return (
    <div id="boutique-merchandise-tab" className="space-y-4">
      {/* 1. STOCK SUMMARY BANNER (Micro KPI Grid with Client App Style Icons) */}
      <div className="grid grid-cols-4 gap-2">
        <div 
          onClick={() => setFilter('all')}
          className={`p-2.5 rounded-2xl border text-center cursor-pointer transition-all duration-200 relative overflow-hidden group select-none ${
            filter === 'all' 
              ? 'bg-gradient-to-br from-[#1C130D] via-neutral-900 to-black border-[#FF6321] ring-1 ring-[#FF6321]/30 shadow-lg shadow-[#FF6321]/20' 
              : 'bg-gradient-to-br from-white/[0.05] via-[#141414] to-white/[0.02] border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg viewBox="0 0 24 24" className="w-3 h-3 text-white/80 fill-current filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
            </div>
            <span className="text-[10px] text-white/70 font-black uppercase tracking-wider">Total</span>
          </div>
          <span className="text-sm font-black text-white block font-mono drop-shadow-sm">{countTotal}</span>
          <span className="text-[9px] text-white/40 truncate block">articles</span>
        </div>

        <div 
          onClick={() => setFilter('healthy')}
          className={`p-2.5 rounded-2xl border text-center cursor-pointer transition-all duration-200 relative overflow-hidden group select-none ${
            filter === 'healthy' 
              ? 'bg-gradient-to-br from-emerald-950/60 via-neutral-900 to-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500/30 shadow-lg shadow-emerald-950/40' 
              : 'bg-gradient-to-br from-white/[0.05] via-[#141414] to-white/[0.02] border-white/10 hover:border-emerald-500/40'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg viewBox="0 0 24 24" className="w-3 h-3 text-emerald-400 fill-current filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </div>
            <span className="text-[10px] text-emerald-400 font-black uppercase tracking-wider">Sain</span>
          </div>
          <span className="text-sm font-black text-emerald-400 block font-mono drop-shadow-sm">{countHealthy}</span>
          <span className="text-[9px] text-emerald-400/60 truncate block">&gt; 5 unités</span>
        </div>

        <div 
          onClick={() => setFilter('low')}
          className={`p-2.5 rounded-2xl border text-center cursor-pointer transition-all duration-200 relative overflow-hidden group select-none ${
            filter === 'low' 
              ? 'bg-gradient-to-br from-amber-950/60 via-neutral-900 to-amber-950/40 border-amber-500 ring-1 ring-amber-500/30 shadow-lg shadow-amber-950/40' 
              : 'bg-gradient-to-br from-white/[0.05] via-[#141414] to-white/[0.02] border-white/10 hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg viewBox="0 0 24 24" className="w-3 h-3 text-amber-400 stroke-current stroke-2 fill-none filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <span className="text-[10px] text-amber-400 font-black uppercase tracking-wider">Faible</span>
          </div>
          <span className="text-sm font-black text-amber-400 block font-mono drop-shadow-sm">{countLow}</span>
          <span className="text-[9px] text-amber-400/60 truncate block">&le; 5 unités</span>
        </div>

        <div 
          onClick={() => setFilter('out')}
          className={`p-2.5 rounded-2xl border text-center cursor-pointer transition-all duration-200 relative overflow-hidden group select-none ${
            filter === 'out' 
              ? 'bg-gradient-to-br from-rose-950/60 via-neutral-900 to-rose-950/40 border-[#FE2C55] ring-1 ring-rose-500/30 shadow-lg shadow-rose-950/40' 
              : 'bg-gradient-to-br from-white/[0.05] via-[#141414] to-white/[0.02] border-white/10 hover:border-[#FE2C55]/40'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded-lg bg-[#FE2C55]/20 border border-[#FE2C55]/30 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg viewBox="0 0 24 24" className="w-3 h-3 text-[#FE2C55] fill-current filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            </div>
            <span className="text-[10px] text-rose-400 font-black uppercase tracking-wider">Rupture</span>
          </div>
          <span className="text-sm font-black text-rose-400 block font-mono drop-shadow-sm">{countOut}</span>
          <span className="text-[9px] text-rose-400/60 truncate block">0 unité</span>
        </div>
      </div>

      {/* 2. SEARCH & ACTION BAR */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une marchandise..."
            className="w-full p-2.5 pl-8 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF6321]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-xs text-white/40 hover:text-white"
            >
              ×
            </button>
          )}
        </div>

        <button
          id="btn-add-new-merchandise"
          onClick={onGoAdd}
          className="py-2.5 px-3.5 rounded-xl bg-[#FF6321] hover:bg-[#ff753b] text-white text-xs font-black flex items-center gap-1.5 shrink-0 shadow-lg shadow-orange-600/20 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Ajouter</span>
        </button>
      </div>

      {/* 3. FILTER CHIPS */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'all', label: `Toutes (${countTotal})` },
          { id: 'low', label: `⚠️ Stock faible (${countLow})` },
          { id: 'out', label: `⛔ Ruptures (${countOut})` },
          { id: 'promo', label: `🏷️ En promo (${countPromo})` },
          { id: 'video', label: `🎥 Vidéos (${countVideo})` },
          { id: 'healthy', label: `✓ En stock (${countHealthy})` },
        ].map((chip) => {
          const isActive = filter === chip.id;
          return (
            <button
              key={chip.id}
              onClick={() => setFilter(chip.id as any)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap border transition ${
                isActive
                  ? 'bg-[#FF6321] border-[#FF6321] text-white shadow'
                  : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* 4. MERCHANDISE CARDS LIST */}
      {filteredProducts.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-white/5 border border-white/10 space-y-2">
          <Package className="w-8 h-8 mx-auto text-white/30" />
          <p className="text-xs font-semibold text-white/70">Aucune marchandise trouvée.</p>
          <p className="text-[10px] text-white/40">Modifiez vos critères de recherche ou ajoutez un nouvel article.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProducts.map((product) => {
            const isVideo = product.mediaType === 'video' && product.videoUrl;
            const hasPromo = product.isPromotion || (product.discountPercentage || 0) > 0;
            const discountPct = product.discountPercentage || 15;
            const discountedPrice = hasPromo ? Math.round(product.price * (1 - discountPct / 100)) : product.price;

            const isOutOfStock = product.stock === 0;
            const isLowStock = product.stock > 0 && product.stock <= 5;

            return (
              <div
                key={product.id}
                className={`p-3.5 rounded-2xl border transition-all duration-200 space-y-3 shadow-lg ${
                  isOutOfStock
                    ? 'bg-gradient-to-br from-rose-950/20 via-neutral-900 to-black border-rose-500/40 shadow-rose-950/25 ring-1 ring-rose-500/20'
                    : isLowStock
                    ? 'bg-gradient-to-br from-amber-950/20 via-neutral-900 to-black border-amber-500/40 shadow-amber-950/25 ring-1 ring-amber-500/20'
                    : 'bg-gradient-to-br from-white/[0.04] via-[#141414] to-white/[0.02] border-white/10 hover:border-white/20'
                }`}
              >
                {/* Top: Image + Info + Quick Actions */}
                <div className="flex gap-3 items-start">
                  {/* Media Thumbnail */}
                  <div
                    onClick={() => {
                      if (isVideo) {
                        onOpenVideo(products, product.id);
                      } else {
                        onSelectProduct(product);
                      }
                    }}
                    className="relative w-20 h-20 rounded-xl overflow-hidden bg-black/40 border border-white/10 cursor-pointer shrink-0 group"
                  >
                    <img
                      src={product.videoPoster || product.images[0]}
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
                    {isVideo && (
                      <span className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white">
                        <VideoIcon className="w-2.5 h-2.5" />
                      </span>
                    )}
                    {hasPromo && (
                      <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-[#FF6321] text-white font-black text-[8px]">
                        -{discountPct}%
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <b 
                        onClick={() => onSelectProduct(product)}
                        className="text-xs text-white font-bold truncate hover:text-[#FF6321] cursor-pointer block"
                      >
                        {product.name}
                      </b>
                      <span
                        className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                          isOutOfStock
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : isLowStock
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {isOutOfStock ? 'Rupture' : isLowStock ? `Stock faible (${product.stock})` : `En stock (${product.stock})`}
                      </span>
                    </div>

                    <p className="text-[10px] text-white/50 mt-0.5">{product.category}</p>

                    {/* Price */}
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-xs font-black text-[#FF6321]">
                        {formatFCFA(discountedPrice)}
                      </span>
                      {hasPromo && (
                        <span className="text-[10px] text-white/40 line-through">
                          {formatFCFA(product.price)}
                        </span>
                      )}
                    </div>

                    {/* Social / Sales Stats */}
                    <div className="flex items-center gap-3 text-[9px] text-white/50 mt-1">
                      <span className="flex items-center gap-0.5">👁 {formatMetricCount(product.viewsCount || 14)}</span>
                      <span className="flex items-center gap-0.5">❤️ {formatMetricCount(product.likesCount || 8)}</span>
                      <span className="flex items-center gap-0.5 text-emerald-400 font-bold">
                        🛒 {formatMetricCount(product.salesCount || 0)} {((product.salesCount || 0) <= 1) ? 'achat' : 'achats'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Direct Stock Stepper Bar */}
                <div className="p-2 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between gap-2 text-xs">
                  <span className="text-[10px] text-white/60 font-semibold flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-[#FF6321]" />
                    Stock en boutique :
                  </span>

                  <div className="flex items-center gap-1.5">
                    {/* -1 Button */}
                    <button
                      type="button"
                      onClick={() => onQuickStockChange(product.id, Math.max(0, product.stock - 1))}
                      disabled={product.stock <= 0}
                      className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white flex items-center justify-center font-bold"
                      title="Diminuer stock (-1)"
                    >
                      <Minus className="w-3 h-3" />
                    </button>

                    <span className="w-9 text-center font-black text-white font-mono">
                      {product.stock}
                    </span>

                    {/* +1 Button */}
                    <button
                      type="button"
                      onClick={() => onQuickStockChange(product.id, product.stock + 1)}
                      className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold"
                      title="Augmenter stock (+1)"
                    >
                      <Plus className="w-3 h-3" />
                    </button>

                    {/* Quick +5 pill */}
                    <button
                      type="button"
                      onClick={() => onQuickStockChange(product.id, product.stock + 5)}
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-white/80"
                      title="Ajouter 5 unités au stock"
                    >
                      +5
                    </button>
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="flex items-center gap-1.5 pt-1">
                  {/* Edit complete */}
                  <button
                    onClick={() => onEditProduct(product)}
                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/90 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <Pencil className="w-3.5 h-3.5 text-[#FF6321]" />
                    <span>Modifier</span>
                  </button>

                  {/* Promote */}
                  <button
                    onClick={() => onPromoteProduct(product)}
                    className={`py-1.5 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
                      hasPromo
                        ? 'bg-orange-500/20 text-[#FF6321] border-[#FF6321]/30 shadow-sm'
                        : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                    }`}
                    title="Définir une promotion ou un solde pour ce produit"
                  >
                    <Megaphone className="w-3.5 h-3.5 text-[#FF6321]" />
                    <span>{hasPromo ? `Promo (-${discountPct}%)` : 'Solde & Promo'}</span>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => onDeleteProduct(product)}
                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 transition"
                    title="Supprimer la marchandise"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
