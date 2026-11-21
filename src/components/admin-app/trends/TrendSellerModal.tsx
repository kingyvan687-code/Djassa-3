import React from 'react';
import { 
  X, 
  Store, 
  Star, 
  Award, 
  TrendingUp, 
  ShoppingBag, 
  Clock, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  AlertCircle,
  Package,
  Users,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { Seller, Product } from '../../../types';
import { formatFCFA } from '../../../services/marketServices';

export interface TrendSellerData {
  seller: Seller;
  rank: number;
  totalRevenue: number;
  commissionsPaid: number;
  completionRate: number; // e.g. 98.4%
  satisfactionRate: number; // e.g. 96.8%
  averageShippingHours: number; // e.g. 2.4 heures
  topProducts: Product[];
  growthPercentage: number;
}

interface TrendSellerModalProps {
  data: TrendSellerData;
  onClose: () => void;
  onSelectProduct?: (productId: string) => void;
}

export const TrendSellerModal: React.FC<TrendSellerModalProps> = ({
  data,
  onClose,
  onSelectProduct
}) => {
  const { seller, rank, totalRevenue, commissionsPaid, completionRate, satisfactionRate, averageShippingHours, topProducts, growthPercentage } = data;

  return (
    <div
      id="trend-seller-detail-overlay"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="trend-seller-detail-modal"
        className="w-full max-w-2xl max-h-[90vh] bg-[#0E0E0E] rounded-3xl border border-white/15 flex flex-col shadow-2xl overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="shrink-0 px-4 py-3.5 border-b border-white/10 bg-[#141414] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Store className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white">Performance Meilleur Vendeur</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Award className="w-3 h-3 text-amber-400" />
                  Top #{rank} Marketplace
                </span>
              </div>
              <p className="text-[10px] text-white/50">ID : {seller.id}</p>
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

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 no-scrollbar">
          {/* PROFILE HERO */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="relative">
              <img
                src={seller.avatar}
                alt={seller.name}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-amber-400/40"
              />
              <span className="absolute -bottom-2 -right-2 px-1.5 py-0.5 rounded-md bg-amber-500 text-black text-[9px] font-black shadow-md">
                #{rank}
              </span>
            </div>

            <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h3 className="text-base font-black text-white">{seller.storeName || seller.name}</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Vérifié Adjamé
                </span>
              </div>
              <p className="text-xs text-white/70 line-clamp-2">{seller.bio || 'Boutique certifiée et active sur le marché de gros d’Adjamé.'}</p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-[11px] text-white/50 pt-1">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#FF6321]" />
                  Adjamé, Abidjan
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-white/40" />
                  {seller.phone}
                </span>
                <span className="flex items-center gap-1 text-amber-400 font-bold">
                  <Star className="w-3 h-3 fill-amber-400" />
                  {seller.rating} / 5 ({seller.reviewsCount || 89} avis)
                </span>
              </div>
            </div>
          </div>

          {/* METRICS GRID */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
              <span className="text-[10px] text-white/45 uppercase font-bold">Chiffre d'Affaires</span>
              <p className="text-base font-black text-emerald-400">{formatFCFA(totalRevenue)}</p>
              <span className="text-[9px] text-emerald-400 font-bold">+{growthPercentage}% ce mois</span>
            </div>

            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
              <span className="text-[10px] text-white/45 uppercase font-bold">Ventes Livrées</span>
              <p className="text-base font-black text-white">{seller.salesCount} colis</p>
              <span className="text-[9px] text-white/40">Taux succès {completionRate}%</span>
            </div>

            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
              <span className="text-[10px] text-white/45 uppercase font-bold">Commissions Djassa</span>
              <p className="text-base font-black text-[#FF6321]">{formatFCFA(commissionsPaid)}</p>
              <span className="text-[9px] text-white/40">Taux 5% reversé</span>
            </div>

            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
              <span className="text-[10px] text-white/45 uppercase font-bold">Délai Expédition</span>
              <p className="text-base font-black text-cyan-300">~{averageShippingHours}h</p>
              <span className="text-[9px] text-cyan-300/80">Remise motard rapide</span>
            </div>
          </div>

          {/* TOP BEST SELLERS FROM THIS SELLER */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
                <span>Articles Vedettes du Marchand</span>
              </h4>
              <span className="text-[11px] text-white/40">{topProducts.length} articles phares</span>
            </div>

            <div className="space-y-2">
              {topProducts.map((prod, idx) => (
                <div
                  key={prod.id}
                  onClick={() => onSelectProduct && onSelectProduct(prod.id)}
                  className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between cursor-pointer hover:border-amber-400/40 transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-black text-white/30 w-4">{idx + 1}</span>
                    <img
                      src={prod.images[0]}
                      alt={prod.name}
                      className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate group-hover:text-amber-400 transition">
                        {prod.name}
                      </p>
                      <p className="text-[10px] text-white/40">
                        {prod.salesCount} ventes • Stock restant : {prod.stock}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-[#FF6321] block">
                      {formatFCFA(prod.price)}
                    </span>
                    <span className="text-[9px] text-white/40">
                      CA: {formatFCFA(prod.price * (prod.salesCount || 1))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* BADGES & REPUTATION */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <h4 className="text-xs font-black text-white uppercase tracking-wider">
              Distinctions & Fiabilité
            </h4>
            <div className="flex flex-wrap gap-2">
              {(seller.badges || ['Marchand Élite', 'Expédition Express', 'Stock Certifié Adjamé']).map((badge) => (
                <span
                  key={badge}
                  className="px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold flex items-center gap-1.5"
                >
                  <Award className="w-3 h-3" />
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="shrink-0 p-4 border-t border-white/10 bg-[#141414] flex items-center justify-between">
          <a
            href={`tel:${seller.phone}`}
            className="px-4 py-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 font-bold text-xs flex items-center gap-1.5 transition"
          >
            <Phone className="w-3.5 h-3.5" />
            Contacter le Vendeur
          </a>
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
