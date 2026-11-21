import React, { useState } from 'react';
import { X, Search, Package, Check, ShoppingBag } from 'lucide-react';
import { Product } from '../../types';
import { formatFCFA } from '../../services/marketServices';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSelectProduct: (product: Product) => void;
}

export const ProductShareModal: React.FC<Props> = ({
  isOpen,
  onClose,
  products,
  onSelectProduct,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      id="product-share-modal-backdrop"
      className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        id="product-share-modal"
        className="w-full max-w-sm bg-[#121212] border border-white/10 rounded-3xl p-5 shadow-2xl space-y-3.5 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-[#FF6321]/20 text-[#FF6321]">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-white">Partager un Article</h3>
              <p className="text-[10px] text-white/50">Envoyez la fiche produit dans le chat</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-white/50 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative shrink-0">
          <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un article de la boutique..."
            className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF6321]"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar pr-0.5">
          {filtered.map((prod) => (
            <div
              key={prod.id}
              onClick={() => {
                onSelectProduct(prod);
                onClose();
              }}
              className="p-2 rounded-2xl bg-white/[0.03] hover:bg-white/10 border border-white/5 transition flex items-center justify-between gap-2.5 cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={prod.videoPoster || prod.images[0]}
                  alt={prod.name}
                  className="w-11 h-11 rounded-xl object-cover border border-white/10 shrink-0"
                />
                <div className="min-w-0">
                  <b className="text-xs text-white block truncate group-hover:text-[#FF6321] transition">
                    {prod.name}
                  </b>
                  <span className="text-[10px] font-black text-[#FF6321] block">
                    {formatFCFA(prod.price)}
                  </span>
                  <span className="text-[9px] text-white/40 block truncate">
                    Stock : {prod.stock} • {prod.category}
                  </span>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-lg bg-[#FF6321] text-white text-[10px] font-bold shrink-0 active:scale-95 transition">
                Partager
              </span>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="p-6 text-center text-white/40 text-xs">
              Aucun produit trouvé.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
