import React from 'react';
import { 
  Store, 
  DollarSign, 
  Tag, 
  Bell, 
  ShieldAlert, 
  CheckCircle2, 
  MapPin, 
  ArrowUpRight,
  Sparkles
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { formatFCFA } from '../../../services/marketServices';

interface OperationsTabProps {
  section: 'livraisons' | 'finance' | 'promotions' | 'notifications' | 'moderation';
}

export const OperationsTab: React.FC<OperationsTabProps> = ({ section }) => {
  const { orders, sellers } = useApp();
  const totalFixedCommissions = orders.filter(o => o.status !== 'cancelled').length * 150;

  return (
    <div id={`admin-tab-operations-${section}`} className="w-full h-full overflow-y-auto no-scrollbar p-4 space-y-4 pb-20">
      {section === 'livraisons' && (
        <div className="space-y-4">
          <h2 className="text-base font-black text-white">Organisation des Livraisons (Hors DJASSA)</h2>
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2 text-xs text-white/70">
            <p className="font-bold text-white flex items-center gap-2">
              <Store className="w-4 h-4 text-[#FF6321]" />
              <span>Livraison gérée directement par les vendeurs ({sellers.length} boutiques)</span>
            </p>
            <p>
              Les vendeurs organisent eux-mêmes l'expédition auprès du client à l'extérieur de la plateforme. Frais de livraison DJASSA : 0 FCFA. Statut unique visible : Commande confirmée.
            </p>
          </div>
        </div>
      )}

      {section === 'finance' && (
        <div className="space-y-4">
          <h2 className="text-base font-black text-white">Finances & Commissions</h2>
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
            <span className="text-xs text-white/50">Commissions fixes DJASSA (150 FCFA / commande)</span>
            <p className="text-xl font-black text-purple-400">{formatFCFA(totalFixedCommissions)}</p>
            <p className="text-[10px] text-white/40">Commission fixe prélevée par commande vendeur (Wave, Orange Money ou règlement COD vérifié)</p>
          </div>
        </div>
      )}

      {section === 'promotions' && (
        <div className="space-y-4">
          <h2 className="text-base font-black text-white">Gestion des Campagnes Promos</h2>
          <p className="text-xs text-white/60">
            Campagne actuelle : "Adjamé Fraîcheur & Wax" avec -15% à -30% sur les sélections certifiées.
          </p>
        </div>
      )}

      {section === 'notifications' && (
        <div className="space-y-4">
          <h2 className="text-base font-black text-white">Centre de Diffusion & Alertes</h2>
          <p className="text-xs text-white/60">
            Envoi de notifications push officielles aux clients et aux boutiques vendeurs DJASSA.
          </p>
        </div>
      )}

      {section === 'moderation' && (
        <div className="space-y-4">
          <h2 className="text-base font-black text-white">Modération & Signalements</h2>
          <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-xs text-emerald-300">
            Aucun signalement grave en cours. 100% des produits vérifiés conformes au cahier des charges de Djassa.
          </div>
        </div>
      )}
    </div>
  );
};
