import React from 'react';
import { 
  X, 
  MapPin, 
  Award, 
  TrendingUp, 
  Clock, 
  Bike, 
  ShoppingBag, 
  Users, 
  AlertTriangle,
  CheckCircle2,
  Navigation,
  Compass
} from 'lucide-react';
import { formatFCFA } from '../../../services/marketServices';

export interface TrendZoneData {
  commune: string;
  rank: number;
  ordersCount: number;
  totalGMV: number;
  averageDeliveryMin: number;
  satisfactionRate: number; // e.g. 98.2%
  activeMotards: number;
  hotspots: string[]; // e.g. ["Carrefour Duncan", "Saint-Jean", "Vallon"]
  topCategory: string;
  growthPercentage: number;
}

interface TrendZoneModalProps {
  data: TrendZoneData;
  onClose: () => void;
}

export const TrendZoneModal: React.FC<TrendZoneModalProps> = ({
  data,
  onClose
}) => {
  const { commune, rank, ordersCount, totalGMV, averageDeliveryMin, satisfactionRate, activeMotards, hotspots, topCategory, growthPercentage } = data;

  return (
    <div
      id="trend-zone-detail-overlay"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="trend-zone-detail-modal"
        className="w-full max-w-2xl max-h-[90vh] bg-[#0E0E0E] rounded-3xl border border-white/15 flex flex-col shadow-2xl overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="shrink-0 px-4 py-3.5 border-b border-white/10 bg-[#141414] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400">
              <MapPin className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white">Zone de Livraison Tendance</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-500/20 text-orange-300 border border-orange-500/30 flex items-center gap-1">
                  <Award className="w-3 h-3 text-orange-400" />
                  Top #{rank} Commune
                </span>
              </div>
              <p className="text-[10px] text-white/50">District d'Abidjan • {commune}</p>
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
          {/* HERO */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">
                Bassin de Demande Forte
              </span>
              <h3 className="text-xl font-black text-white">Commune de {commune}</h3>
              <p className="text-xs text-white/70">
                Catégorie numéro 1 demandée : <span className="text-white font-bold">{topCategory}</span>
              </p>
            </div>

            <div className="text-right">
              <span className="text-2xl font-black text-orange-400 block">#{rank}</span>
              <span className="text-[10px] text-white/40">Rang Global</span>
            </div>
          </div>

          {/* METRICS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
              <span className="text-[10px] text-white/45 uppercase font-bold">Volume Livré</span>
              <p className="text-base font-black text-white">{ordersCount} colis</p>
              <span className="text-[9px] text-emerald-400 font-bold">+{growthPercentage}% ce mois</span>
            </div>

            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
              <span className="text-[10px] text-white/45 uppercase font-bold">Volume Financier</span>
              <p className="text-base font-black text-emerald-400">{formatFCFA(totalGMV)}</p>
              <span className="text-[9px] text-white/40">Panier moy. {formatFCFA(Math.round(totalGMV / (ordersCount || 1)))}</span>
            </div>

            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
              <span className="text-[10px] text-white/45 uppercase font-bold">Délai Moyen</span>
              <p className="text-base font-black text-cyan-300">{averageDeliveryMin} min</p>
              <span className="text-[9px] text-cyan-300/80">Départ Adjamé</span>
            </div>

            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
              <span className="text-[10px] text-white/45 uppercase font-bold">Motards en Zone</span>
              <p className="text-base font-black text-amber-400">{activeMotards} en service</p>
              <span className="text-[9px] text-white/40">Satisfaction {satisfactionRate}%</span>
            </div>
          </div>

          {/* HOTSPOTS & HUBS */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-orange-400" />
                <span>Carrefours Stratégiques & Points Chauds</span>
              </h4>
              <span className="text-[11px] text-white/40">{hotspots.length} points de dépôt clés</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {hotspots.map((point, i) => (
                <div key={i} className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-black">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">{point}</p>
                    <p className="text-[10px] text-white/40">Point de remise sécurisé pour motards</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TRAFFIC & LOGISTIC ADVICE */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Fluidité Routière & Alertes d'Acheminement</span>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">
              Pour {commune}, le couloir d’expédition le plus fluide depuis le Marché d’Adjamé se fait en évitant les heures de pointe (07h30-09h00 et 17h30-19h30). Les motards assignés reçoivent les instructions de contournement direct via l’application.
            </p>
          </div>
        </div>

        {/* FOOTER */}
        <div className="shrink-0 p-4 border-t border-white/10 bg-[#141414] flex items-center justify-between">
          <span className="text-xs text-white/50">Données calculées en temps réel sur les flux GPS.</span>
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
