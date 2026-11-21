import React, { useState } from 'react';
import { Search, Package, Store, Eye, Tag, Sparkles } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { formatFCFA } from '../../../services/marketServices';

export const MarketplaceTab: React.FC = () => {
  const { products, sellers, setSelectedProduct } = useApp();
  const [search, setSearch] = useState('');

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div id="admin-tab-marketplace" className="w-full h-full overflow-y-auto no-scrollbar p-4 space-y-4 pb-20">
      <div className="space-y-3">
        <h2 className="text-base font-black text-white">Supervision Marketplace</h2>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit ou une boutique..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/10 rounded-2xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-purple-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {filteredProducts.map((prod) => {
          const seller = sellers.find((s) => s.id === prod.sellerId);
          return (
            <div
              key={prod.id}
              onClick={() => setSelectedProduct(prod)}
              className="p-3 bg-white/5 rounded-2xl border border-white/10 hover:border-purple-500/30 cursor-pointer transition space-y-2"
            >
              <img
                src={prod.images[0]}
                alt={prod.name}
                className="w-full aspect-square rounded-xl object-cover"
              />
              <div>
                <h4 className="text-xs font-bold text-white truncate">{prod.name}</h4>
                <p className="text-[10px] text-white/50 truncate">@{seller?.username || 'marchand'}</p>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="font-black text-[#FF6321]">{formatFCFA(prod.price)}</span>
                  <span className="text-[10px] text-emerald-400">Stock: {prod.stock}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
