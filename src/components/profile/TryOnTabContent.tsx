import React, { useState } from 'react';
import { 
  Sparkles, 
  Trash2, 
  ShoppingBag, 
  ShoppingCart, 
  RotateCw, 
  Eye, 
  X, 
  ExternalLink, 
  Tag, 
  Check, 
  Store,
  ChevronRight,
  Maximize2
} from 'lucide-react';
import { TryOnHistoryItem, Product, Seller } from '../../types';
import { formatFCFA } from '../../services/marketServices';

interface TryOnTabContentProps {
  tryOnHistory: TryOnHistoryItem[];
  products: Product[];
  sellers: Seller[];
  onSelectProduct: (product: Product) => void;
  onOpenTryOn: (product: Product) => void;
  onRemoveItem: (id: string) => void;
  onAddToCart: (productId: string, options?: Record<string, string>) => void;
  onNavigateFeed: () => void;
}

export const TryOnTabContent: React.FC<TryOnTabContentProps> = ({
  tryOnHistory,
  products,
  sellers,
  onSelectProduct,
  onOpenTryOn,
  onRemoveItem,
  onAddToCart,
  onNavigateFeed
}) => {
  const [selectedItemForZoom, setSelectedItemForZoom] = useState<TryOnHistoryItem | null>(null);
  const [zoomCompareMode, setZoomCompareMode] = useState<'generated' | 'garment'>('generated');
  const [filterQuery, setFilterQuery] = useState<'all' | string>('all');

  const filteredItems = tryOnHistory.filter((item) => {
    if (filterQuery === 'all') return true;
    return item.productName.toLowerCase().includes(filterQuery.toLowerCase()) ||
           item.color.toLowerCase().includes(filterQuery.toLowerCase());
  });

  if (tryOnHistory.length === 0) {
    return (
      <div className="py-14 px-4 flex flex-col items-center justify-center text-center space-y-4 max-w-sm mx-auto">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#FF6321]/20 via-[#4285F4]/15 to-[#34A853]/20 border border-white/15 flex items-center justify-center shadow-xl">
          <Sparkles className="w-10 h-10 text-[#FF6321] animate-pulse" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-extrabold text-white">
            Aucun essayage virtuel enregistré
          </h3>
          <p className="text-xs text-white/60 leading-relaxed">
            Essayez les vêtements du catalogue grâce à l'IA d'essayage virtuel Google Shopping Try On et retrouvez ici vos rendus générés !
          </p>
        </div>
        <button
          type="button"
          onClick={onNavigateFeed}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6321] to-[#FF8533] text-white text-xs font-black shadow-lg shadow-orange-950/40 hover:opacity-90 active:scale-95 transition flex items-center gap-2"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Découvrir des tenues à essayer</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* HEADER STATS & INFO BANNER */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-neutral-900/90 via-black to-neutral-900/90 border border-white/10 flex items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF6321] to-amber-500 flex items-center justify-center shrink-0 shadow-md">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-black text-white truncate flex items-center gap-1.5">
              <span>Mes photos d'essayage virtuel</span>
              <span className="px-1.5 py-0.2 rounded-full bg-[#FF6321]/20 border border-[#FF6321]/40 text-[#FF6321] text-[9px] font-black">
                {tryOnHistory.length}
              </span>
            </h3>
            <p className="text-[10px] text-white/50 truncate">
              Rendus générés par Google Shopping Try On AI
            </p>
          </div>
        </div>
        
        <button
          type="button"
          onClick={onNavigateFeed}
          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[10px] font-bold shrink-0 transition flex items-center gap-1"
        >
          <span>Essayer d'autres</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* GRID OF GENERATED TRY-ON PHOTOS */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {filteredItems.map((item) => {
          const matchedProduct = products.find((p) => p.id === item.productId);
          const matchedSeller = sellers.find((s) => s.id === item.sellerId);

          return (
            <div
              key={item.id}
              className="relative group rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-900 border border-white/10 hover:border-[#FF6321]/60 transition-all duration-300 shadow-xl flex flex-col justify-between aspect-[9/14]"
            >
              {/* Main Generated Photo */}
              <img
                src={item.generatedImageUrl}
                alt={item.productName}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer"
                onClick={() => {
                  setSelectedItemForZoom(item);
                  setZoomCompareMode('generated');
                }}
                loading="lazy"
              />

              {/* Gradient Dark Backdrop for Legibility */}
              <div 
                className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/60 pointer-events-none" 
              />

              {/* TOP BAR OVERLAY */}
              <div className="relative z-10 p-2.5 flex items-start justify-between gap-1.5">
                {/* AI Badge & Angle */}
                <div className="flex flex-col gap-1 items-start min-w-0">
                  <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[#4285F4] via-[#EA4335] via-[#FBBC05] to-[#34A853] text-white text-[8px] sm:text-[9px] font-black shadow-md flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>IA Essayage</span>
                  </span>

                  <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/15 text-[8px] font-bold text-white/90">
                    {item.angle === 'front' ? 'Vue Face' : item.angle === 'side' ? 'Vue Profil' : 'Vue Dos'}
                  </span>
                </div>

                {/* Top-Right: Zoom preview + Delete */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedItemForZoom(item);
                      setZoomCompareMode('generated');
                    }}
                    className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-md border border-white/20 hover:bg-black/80 flex items-center justify-center text-white active:scale-75 transition shadow-lg"
                    title="Agrandir la photo"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveItem(item.id);
                    }}
                    className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-md border border-white/20 hover:bg-red-500/80 hover:border-red-500 flex items-center justify-center text-white/80 hover:text-white active:scale-75 transition shadow-lg"
                    title="Supprimer cet essayage"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* BOTTOM CONTENT OVERLAY */}
              <div className="relative z-10 p-2.5 sm:p-3 space-y-1.5">
                {/* Title */}
                <h4 
                  onClick={() => {
                    if (matchedProduct) onSelectProduct(matchedProduct);
                  }}
                  className="font-extrabold text-white leading-tight drop-shadow-md break-words text-xs line-clamp-2 hover:text-[#FF6321] transition cursor-pointer"
                >
                  {item.productName}
                </h4>

                {/* Price & Date */}
                <div className="flex items-center justify-between gap-1 pt-0.5">
                  <div className="flex items-baseline gap-1">
                    <span className="font-black text-[#FF6321] drop-shadow-sm text-xs">
                      {formatFCFA(item.productPrice)}
                    </span>
                    {item.productOriginalPrice && (
                      <span className="text-[9px] text-white/40 line-through">
                        {formatFCFA(item.productOriginalPrice)}
                      </span>
                    )}
                  </div>

                  <span className="text-[9px] text-white/50 font-medium">
                    {item.createdAt}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="pt-1 flex items-center gap-1.5 opacity-95 group-hover:opacity-100 transition">
                  {/* Re-try / View Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (matchedProduct) {
                        onSelectProduct(matchedProduct);
                      }
                    }}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-white/15 hover:bg-white/25 active:bg-[#FF6321] text-white text-[10px] font-extrabold flex items-center justify-center gap-1 backdrop-blur-md border border-white/15 transition cursor-pointer"
                  >
                    <ShoppingBag className="w-3 h-3" />
                    <span>Voir</span>
                  </button>

                  {/* Quick Try-on button */}
                  {matchedProduct && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTryOn(matchedProduct);
                      }}
                      className="py-1.5 px-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 text-[10px] font-extrabold flex items-center justify-center gap-1 backdrop-blur-md border border-amber-500/30 transition cursor-pointer"
                      title="Réessayer avec d'autres angles ou tailles"
                    >
                      <RotateCw className="w-3 h-3" />
                    </button>
                  )}

                  {/* Add to Cart Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToCart(item.productId, {
                        'Taille': item.size,
                        'Couleur': item.color
                      });
                    }}
                    className="py-1.5 px-2.5 rounded-xl bg-[#FF6321] hover:bg-[#FF8533] text-white text-[10px] font-extrabold flex items-center justify-center backdrop-blur-md border border-white/10 active:scale-90 transition shadow-lg cursor-pointer"
                    title="Ajouter au panier avec cette taille et couleur"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FULLSCREEN PHOTO INSPECTION MODAL */}
      {selectedItemForZoom && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-3 animate-fadeIn"
          onClick={() => setSelectedItemForZoom(null)}
        >
          <div 
            className="w-full max-w-md bg-neutral-900 border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 py-3 bg-neutral-950 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FF6321]" />
                <h3 className="text-xs font-black text-white">Détail de l'essayage IA</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemForZoom(null)}
                className="p-1 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* View Mode Toggle: Photo essayée vs Vêtement original */}
            <div className="p-2 bg-neutral-950/60 border-b border-white/10 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomCompareMode('generated')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  zoomCompareMode === 'generated'
                    ? 'bg-[#FF6321] text-white shadow'
                    : 'bg-white/5 text-white/60 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Rendu Essayage IA</span>
              </button>

              <button
                type="button"
                onClick={() => setZoomCompareMode('garment')}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  zoomCompareMode === 'garment'
                    ? 'bg-white/20 text-white shadow'
                    : 'bg-white/5 text-white/60 hover:text-white'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Article Original</span>
              </button>
            </div>

            {/* Photo Body */}
            <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center min-h-[340px]">
              <img
                src={zoomCompareMode === 'generated' ? selectedItemForZoom.generatedImageUrl : selectedItemForZoom.productImage}
                alt={selectedItemForZoom.productName}
                className="w-full h-full object-contain max-h-[55vh]"
              />

              <div className="absolute bottom-3 left-3 px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/20 text-[10px] font-bold text-white flex items-center gap-1.5">
                <span>{selectedItemForZoom.modelName}</span>
                <span>•</span>
                <span>Taille {selectedItemForZoom.size}</span>
                <span>•</span>
                <span>{selectedItemForZoom.color}</span>
              </div>
            </div>

            {/* Footer with Details & Actions */}
            <div className="p-4 bg-neutral-950 border-t border-white/10 space-y-3">
              <div>
                <h4 className="text-sm font-extrabold text-white">
                  {selectedItemForZoom.productName}
                </h4>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-base font-black text-[#FF6321]">
                    {formatFCFA(selectedItemForZoom.productPrice)}
                  </span>
                  <span className="text-[11px] text-white/50">
                    Enregistré {selectedItemForZoom.createdAt}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const prod = products.find((p) => p.id === selectedItemForZoom.productId);
                    if (prod) {
                      setSelectedItemForZoom(null);
                      onSelectProduct(prod);
                    }
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Fiche produit</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onAddToCart(selectedItemForZoom.productId, {
                      'Taille': selectedItemForZoom.size,
                      'Couleur': selectedItemForZoom.color
                    });
                    setSelectedItemForZoom(null);
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#FF6321] hover:bg-[#FF8533] text-white text-xs font-black shadow-lg shadow-orange-950/40 transition flex items-center justify-center gap-1.5"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Commander ({selectedItemForZoom.size})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
