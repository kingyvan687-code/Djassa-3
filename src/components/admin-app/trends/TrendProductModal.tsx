import React, { useState } from 'react';
import { 
  X, 
  ShoppingBag, 
  ShoppingCart, 
  TrendingUp, 
  Store, 
  Eye, 
  Heart, 
  Star, 
  Package, 
  Tag, 
  ArrowUpRight, 
  ExternalLink,
  Percent,
  Play,
  Share2,
  Clock,
  MapPin,
  CheckCircle2
} from 'lucide-react';
import { Product, Seller } from '../../../types';
import { formatFCFA } from '../../../services/marketServices';

export interface TrendProductData {
  product: Product;
  seller?: Seller;
  cartAddsCount: number;
  purchasesCount: number;
  conversionRate: number; // e.g. 18.5%
  totalRevenue: number;
  viewsTotal: number;
  growthPercentage: number;
  rankPurchased: number;
  rankCart: number;
}

interface TrendProductModalProps {
  data: TrendProductData;
  onClose: () => void;
  onOpenSellerDetail?: (sellerId: string) => void;
}

export const TrendProductModal: React.FC<TrendProductModalProps> = ({
  data,
  onClose,
  onOpenSellerDetail
}) => {
  const { product, seller, cartAddsCount, purchasesCount, conversionRate, totalRevenue, viewsTotal, growthPercentage, rankPurchased, rankCart } = data;
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  return (
    <div
      id="trend-product-detail-overlay"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="trend-product-detail-modal"
        className="w-full max-w-3xl max-h-[90vh] bg-[#0E0E0E] rounded-3xl border border-white/15 flex flex-col shadow-2xl overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP HEADER */}
        <div className="shrink-0 px-4 py-3.5 border-b border-white/10 bg-[#141414] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <ShoppingBag className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white">Analyse Produit Tendance</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#FF6321]/20 text-[#FF6321] border border-[#FF6321]/30">
                  Rang #{rankPurchased} Ventes
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Rang #{rankCart} Paniers
                </span>
              </div>
              <p className="text-[10px] text-white/50">Réf. Produit : {product.id}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY SCROLL */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 no-scrollbar">
          {/* PRODUCT CARD HERO */}
          <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
            {/* Gallery / Image Preview */}
            <div className="sm:w-48 shrink-0 space-y-2">
              <div className="relative aspect-square rounded-2xl overflow-hidden border border-white/15 bg-black">
                <img
                  src={product.images[activeImageIndex] || product.images[0]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                {product.mediaType === 'video' && (
                  <span className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/70 backdrop-blur-md text-white text-[10px] font-black flex items-center gap-1 border border-white/20">
                    <Play className="w-2.5 h-2.5 text-[#FF6321] fill-[#FF6321]" />
                    Vidéo Vitrine
                  </span>
                )}
                <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-[#FF6321] text-white text-[10px] font-black">
                  {formatFCFA(product.price)}
                </span>
              </div>

              {product.images.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                  {product.images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      className={`w-10 h-10 rounded-lg overflow-hidden border-2 shrink-0 transition ${
                        activeImageIndex === idx ? 'border-[#FF6321]' : 'border-transparent opacity-60'
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Details & Seller Info */}
            <div className="flex-1 space-y-2.5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#FF6321] font-bold uppercase tracking-wider">
                    {product.category}
                  </span>
                  <span className="text-white/30">•</span>
                  <span className="text-[10px] text-white/50 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#FF6321]" />
                    {product.location}
                  </span>
                </div>
                <h1 className="text-base font-black text-white mt-0.5 leading-snug">
                  {product.name}
                </h1>
              </div>

              <p className="text-xs text-white/70 line-clamp-2 leading-relaxed">
                {product.description}
              </p>

              {/* Marchand Associé */}
              {seller && (
                <div 
                  onClick={() => onOpenSellerDetail && onOpenSellerDetail(seller.id)}
                  className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between cursor-pointer hover:border-[#FF6321]/40 transition group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={seller.avatar}
                      alt={seller.name}
                      className="w-8 h-8 rounded-full object-cover border border-white/20 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate group-hover:text-[#FF6321] transition">
                        {seller.storeName || seller.name}
                      </p>
                      <p className="text-[10px] text-white/40 truncate">
                        Marchand Adjamé • ★ {seller.rating} ({seller.salesCount} ventes)
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-[#FF6321] font-bold flex items-center gap-1 shrink-0">
                    <span>Voir vendeur</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </span>
                </div>
              )}

              {/* Stock & Status */}
              <div className="flex items-center gap-2 pt-1">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" />
                  Stock Disponible : {product.stock} pièces
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white/5 text-white/70 border border-white/10 text-xs font-bold flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  {product.rating} / 5
                </span>
              </div>
            </div>
          </div>

          {/* KEY TREND PERFORMANCE KPIS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* KPI 1: Commandes Achetées */}
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
              <div className="flex items-center justify-between text-white/50 text-[10px] font-bold uppercase">
                <span>Commandes</span>
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-lg font-black text-emerald-400">{purchasesCount}</p>
              <span className="text-[9px] text-emerald-400/80 font-bold flex items-center gap-0.5">
                <TrendingUp className="w-2.5 h-2.5" />
                +{growthPercentage}% cette semaine
              </span>
            </div>

            {/* KPI 2: Mis au Panier */}
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
              <div className="flex items-center justify-between text-white/50 text-[10px] font-bold uppercase">
                <span>Mis au Panier</span>
                <ShoppingCart className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <p className="text-lg font-black text-cyan-300">{cartAddsCount}</p>
              <span className="text-[9px] text-white/40">Forte intention</span>
            </div>

            {/* KPI 3: Taux de Conversion Panier -> Achat */}
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
              <div className="flex items-center justify-between text-white/50 text-[10px] font-bold uppercase">
                <span>Conversion Panier</span>
                <Percent className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <p className="text-lg font-black text-amber-300">{conversionRate}%</p>
              <span className="text-[9px] text-white/40">Excellente efficacité</span>
            </div>

            {/* KPI 4: Chiffre d'Affaires Généré */}
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
              <div className="flex items-center justify-between text-white/50 text-[10px] font-bold uppercase">
                <span>Volume d'Affaires</span>
                <TrendingUp className="w-3.5 h-3.5 text-[#FF6321]" />
              </div>
              <p className="text-sm sm:text-base font-black text-[#FF6321] truncate">
                {formatFCFA(totalRevenue)}
              </p>
              <span className="text-[9px] text-white/40 truncate block">
                Commissions (5%) : {formatFCFA(Math.round(totalRevenue * 0.05))}
              </span>
            </div>
          </div>

          {/* SOCIAL & ENGAGEMENT METRICS */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
              <span>Engagement Social & Visibilité</span>
            </h3>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                <span className="text-white/40 text-[10px] block">Vues Totales</span>
                <span className="font-black text-white text-base">{viewsTotal.toLocaleString()}</span>
              </div>
              <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                <span className="text-white/40 text-[10px] block">Likes Enregistrés</span>
                <span className="font-black text-rose-400 text-base">{(product.likesCount || 1240).toLocaleString()}</span>
              </div>
              <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                <span className="text-white/40 text-[10px] block">Partages & Clics</span>
                <span className="font-black text-emerald-400 text-base">{Math.round(viewsTotal * 0.08).toLocaleString()}</span>
              </div>
            </div>

            {/* Conversion Funnel Bar */}
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-[11px] text-white/60">
                <span>Entonnoir de Conversion Commerciale</span>
                <span className="text-emerald-400 font-bold">{((purchasesCount / (viewsTotal || 1)) * 100).toFixed(1)}% Vues → Vente</span>
              </div>
              <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden flex">
                <div style={{ width: '100%' }} className="bg-cyan-500/40" title="Vues" />
                <div style={{ width: `${Math.min(100, Math.round((cartAddsCount / (viewsTotal || 1)) * 100 * 5))}%` }} className="bg-amber-400" title="Ajouts panier" />
                <div style={{ width: `${Math.min(100, Math.round((purchasesCount / (viewsTotal || 1)) * 100 * 10))}%` }} className="bg-emerald-500" title="Achats finaux" />
              </div>
              <div className="flex justify-between text-[9px] text-white/40 pt-0.5">
                <span className="text-cyan-400">1. Vues ({viewsTotal})</span>
                <span className="text-amber-400">2. Paniers ({cartAddsCount})</span>
                <span className="text-emerald-400 font-bold">3. Commandes Payées ({purchasesCount})</span>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="shrink-0 p-4 border-t border-white/10 bg-[#141414] flex items-center justify-between">
          <span className="text-xs text-white/50">
            Ce produit génère un trafic actif au marché d'Adjamé.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
