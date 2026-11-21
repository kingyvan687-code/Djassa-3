import React, { useState } from 'react';
import { X, Check, DollarSign, Package, Percent, Eye, EyeOff, Save, Sparkles } from 'lucide-react';
import { Product } from '../../../types';
import { useApp } from '../../../context/AppContext';
import { formatFCFA } from '../../../services/marketServices';

interface Props {
  product: Product;
  onClose: () => void;
  onUpdated?: (updatedProduct: Product) => void;
}

export const PublicationQuickEditModal: React.FC<Props> = ({
  product,
  onClose,
  onUpdated,
}) => {
  const { updateProductSeller, showToast } = useApp();

  const [price, setPrice] = useState(product.price.toString());
  const [stock, setStock] = useState((product.stock ?? 10).toString());
  const [isPromotion, setIsPromotion] = useState(Boolean(product.isPromotion));
  const [discountPercentage, setDiscountPercentage] = useState(
    (product.discountPercentage || 0).toString()
  );
  const [inStock, setInStock] = useState(product.inStock !== false);

  const numericPrice = Number(price) || product.price;
  const numericDiscount = isPromotion ? Math.min(90, Math.max(0, Number(discountPercentage) || 0)) : 0;
  const discountedPrice = numericDiscount > 0
    ? Math.round(numericPrice * (1 - numericDiscount / 100))
    : numericPrice;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedPrice = Number(price);
    const parsedStock = Number(stock);

    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      showToast('Veuillez renseigner un prix valide supérieur à 0.');
      return;
    }

    const updates: Partial<Product> = {
      price: parsedPrice,
      originalPrice: isPromotion && numericDiscount > 0 ? parsedPrice : undefined,
      discountPercentage: isPromotion ? numericDiscount : 0,
      isPromotion,
      stock: Math.max(0, parsedStock),
      inStock: inStock && parsedStock > 0,
    };

    updateProductSeller(product.id, updates);

    if (onUpdated) {
      onUpdated({ ...product, ...updates });
    }

    showToast('Publication mise à jour avec succès ! ✨');
    onClose();
  };

  return (
    <div
      id="publication-quick-edit-backdrop"
      className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="publication-quick-edit-modal"
        className="w-full max-w-md bg-[#141414] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Gérer Prix & Stock</h3>
              <p className="text-[10px] text-white/50 truncate max-w-[220px]">{product.name}</p>
            </div>
          </div>
          <button
            id="btn-close-quick-edit"
            onClick={onClose}
            className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Price input */}
          <div>
            <label className="text-xs font-bold text-white/80 block mb-1.5 flex items-center justify-between">
              <span>Prix de vente normal (FCFA)</span>
              <span className="text-[10px] text-emerald-400 font-semibold">{formatFCFA(numericPrice)}</span>
            </label>
            <div className="relative">
              <input
                id="input-edit-price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min={100}
                step={500}
                className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-[#FF6321] transition"
                required
              />
            </div>
          </div>

          {/* Promotion toggle */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <label htmlFor="toggle-promo" className="text-xs font-bold text-white flex items-center gap-2 cursor-pointer">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Activer une réduction promo</span>
              </label>
              <input
                id="toggle-promo"
                type="checkbox"
                checked={isPromotion}
                onChange={(e) => setIsPromotion(e.target.checked)}
                className="w-4 h-4 accent-[#FF6321] rounded cursor-pointer"
              />
            </div>

            {isPromotion && (
              <div className="pt-2 border-t border-white/5 flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-white/60 block mb-1">Pourcentage de remise (%)</label>
                  <input
                    id="input-discount-percent"
                    type="number"
                    value={discountPercentage}
                    onChange={(e) => setDiscountPercentage(e.target.value)}
                    min={1}
                    max={90}
                    placeholder="Ex: 20"
                    className="w-full p-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-white/50 block">Nouveau prix client</span>
                  <b className="text-sm text-emerald-400 font-black">{formatFCFA(discountedPrice)}</b>
                </div>
              </div>
            )}
          </div>

          {/* Stock input */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-white/80 block mb-1.5">
                Quantité en stock
              </label>
              <input
                id="input-edit-stock"
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                min={0}
                className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-[#FF6321]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-white/80 block mb-1.5">
                Statut de disponibilité
              </label>
              <select
                id="select-stock-status"
                value={inStock ? 'in_stock' : 'out_of_stock'}
                onChange={(e) => setInStock(e.target.value === 'in_stock')}
                className="w-full p-2.5 rounded-xl bg-[#1c1c1c] border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
              >
                <option value="in_stock">✅ Disponible à la vente</option>
                <option value="out_of_stock">❌ Rupture temporaire</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 text-xs font-bold transition"
            >
              Annuler
            </button>
            <button
              id="btn-save-publication-edit"
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-[#FF6321] hover:bg-[#ff753b] text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-lg shadow-orange-600/20 transition"
            >
              <Save className="w-4 h-4" />
              <span>Enregistrer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
