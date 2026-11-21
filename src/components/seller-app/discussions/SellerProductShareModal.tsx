import React, { useState } from 'react';
import { X, Search, Sparkles, Send, Check } from 'lucide-react';
import { Product } from '../../../types';
import { formatFCFA } from '../../../services/marketServices';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSelectProduct: (product: Product) => void;
}

export const SellerProductShareModal: React.FC<Props> = ({
  isOpen,
  onClose,
  products,
  onSelectProduct,
}) => {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#121212] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#FF6321]/15 text-[#FF6321] flex items-center justify-center border border-[#FF6321]/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Partager un article de ma boutique</h3>
              <p className="text-[11px] text-white/50">Envoyez la fiche produit directement dans la conversation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-white/5 bg-white/[0.02]">
          <div className="relative">
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher par nom de vêtement, tissu, catégorie..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-white/40 text-xs">
              Aucun produit trouvé dans votre catalogue
            </div>
          ) : (
            filtered.map((product) => {
              const imgUrl = (product as any).media?.[0]?.url || product.images?.[0] || 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600';
              return (
                <div
                  key={product.id}
                  onClick={() => {
                    onSelectProduct(product);
                    onClose();
                  }}
                  className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-[#FF6321]/40 flex items-center justify-between gap-3 cursor-pointer transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={imgUrl}
                      alt={product.name}
                      className="w-14 h-14 rounded-xl object-cover border border-white/10 shrink-0 group-hover:scale-105 transition"
                    />
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{product.name}</h4>
                      <p className="text-[11px] font-black text-[#FF6321] pt-0.5">{formatFCFA(product.price)}</p>
                      <div className="flex items-center gap-2 pt-1 text-[10px] text-white/40">
                        <span>Stock: {product.stock || 12}</span>
                        <span>•</span>
                        <span>{product.category || 'Mode Wax'}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-xl bg-[#FF6321] hover:bg-[#ff753b] text-white text-[11px] font-bold flex items-center gap-1.5 shrink-0 shadow-md shadow-[#FF6321]/20"
                  >
                    <Send className="w-3 h-3" />
                    <span>Envoyer</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
