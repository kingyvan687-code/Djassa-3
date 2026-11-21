import React, { useState } from 'react';
import {
  ChevronLeft,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';

interface SafetyCenterSettingsScreenProps {
  onBack: () => void;
}

export const SafetyCenterSettingsScreen: React.FC<SafetyCenterSettingsScreenProps> = ({ onBack }) => {
  const { createSupportTicket, userProfile, showToast } = useApp();

  const [fraudDetails, setFraudDetails] = useState('');
  const [showFraudModal, setShowFraudModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);

  const rules = [
    {
      title: 'Paiement à la livraison après inspection',
      short: 'Vérifiez le contenu de votre paquet avant de régler.',
      desc: 'Vous avez le droit légal d\'ouvrir le colis et d\'examiner votre article lors de la remise organisée par le vendeur avant de régler le montant en espèces à la livraison. Si l\'article ne correspond pas, vous refusez la livraison sans pénalité.',
      badge: 'Garantie légale'
    },
    {
      title: 'Vérification physique des marchands d\'Adjamé',
      short: 'Boutiques réelles certifiées au Registre de Commerce.',
      desc: 'Chaque marchand portant le badge vérifié a été inspecté physiquement sur son stand ou dans son magasin au Marché Forum, Black Market ou Marché Gouro d\'Adjamé par les équipes terrain de Djassa.',
      badge: 'Audit physique'
    },
    {
      title: 'Reçu officiel et suivi transparent',
      short: 'Conservez votre numéro de commande DJASSA.',
      desc: 'Votre reçu officiel DJASSA et les coordonnées directes de la boutique garantissent la traçabilité de chaque commande confirmée, qu’elle soit réglée en ligne ou à la livraison.',
      badge: 'Traçabilité'
    },
    {
      title: 'Zéro tolérance pour la contrefaçon abusive',
      short: 'Articles authentiques ou clairement indiqués.',
      desc: 'Tout marchand vendant des articles contrefaits en prétendant qu\'il s\'agit d\'originaux est immédiatement banni de la plateforme Djassa et son dépôt de garantie est utilisé pour rembourser les acheteurs lésés.',
      badge: 'Sanction immédiate'
    },
    {
      title: 'Protection contre le phishing et faux appels',
      short: 'Le service client Djassa ne vous demandera jamais votre code secret.',
      desc: 'Méfiez-vous de toute personne se faisant passer pour un agent Djassa demandant votre code secret Wave, Orange Money ou mot de passe. Toutes nos communications officielles passent par l\'application.',
      badge: 'Anti-phishing'
    }
  ];

  const handleSubmitFraudAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fraudDetails.trim()) {
      showToast('Décrivez brièvement la tentative d\'escroquerie.');
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await createSupportTicket({
        ticketType: 'fraud',
        category: 'Alerte fraude urgente',
        description: fraudDetails.trim(),
        contactEmail: userProfile.email || undefined,
      });
      if (created) {
        setSubmittedTicketId(created.id);
        setFraudDetails('');
        setShowFraudModal(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="safety-center-settings-screen"
      className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
    >
      {/* Top Header */}
      <header className="sticky top-0 z-20 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/10 px-3 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition active:scale-95"
            aria-label="Retour"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-base font-extrabold text-white tracking-tight">
            Centre de sécurité
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-16 p-4 space-y-5">
        {/* HERO BANNER */}
        <div className="p-5 bg-gradient-to-br from-emerald-950/60 to-[#121212] border border-emerald-500/30 rounded-3xl space-y-3 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Charte de confiance Djassa</h2>
              <p className="text-[11px] text-emerald-300/80">Nos engagements pour des transactions 100% sereines à Abidjan.</p>
            </div>
          </div>
          <p className="text-xs text-white/70 leading-relaxed pt-1 border-t border-white/5">
            Djassa protège chaque commande passée auprès des marchands d'Adjamé grâce à la vérification d'identité, au suivi GPS en temps réel et à la garantie d'inspection avant règlement.
          </p>
        </div>

        {/* RULES LIST */}
        <div className="space-y-3">
          <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider block">
            RÈGLES ET GARANTIES DU MARCHÉ
          </span>

          <div className="space-y-2.5">
            {rules.map((rule, idx) => (
              <div
                key={idx}
                className="p-4 bg-[#121212] border border-white/5 rounded-2xl space-y-2 hover:border-white/10 transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 max-w-[75%]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <h3 className="text-xs font-bold text-white">{rule.title}</h3>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/20">
                    {rule.badge}
                  </span>
                </div>
                <p className="text-[11px] text-white/60 leading-relaxed pl-6">{rule.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* EMERGENCY FRAUD ALERT BUTTON */}
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-white">Signaler une tentative d'escroquerie</p>
                <p className="text-[10px] text-red-300/80">Enregistrement d'une alerte prioritaire auprès du support.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowFraudModal(true)}
              className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition active:scale-95 shadow"
            >
              Alerter
            </button>
          </div>

          {submittedTicketId && (
            <p className="text-[11px] text-emerald-400 font-semibold">
              Alerte enregistrée sous le ticket #{submittedTicketId}.
            </p>
          )}
        </div>
      </main>

      {showFraudModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4"
          onClick={() => setShowFraudModal(false)}
        >
          <form
            onSubmit={handleSubmitFraudAlert}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm mx-auto bg-[#181818] border border-white/10 rounded-3xl p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white">Alerte fraude urgente</h3>
            </div>
            <p className="text-xs text-white/60">
              Précisez le numéro concerné, le vendeur ou la demande suspecte afin de bloquer toute tentative d'arnaque.
            </p>
            <textarea
              rows={3}
              maxLength={500}
              value={fraudDetails}
              onChange={(e) => setFraudDetails(e.target.value)}
              placeholder="Ex: Demande de code Wave par appel depuis +225..."
              className="w-full bg-black border border-white/10 rounded-2xl p-3 text-xs text-white placeholder-white/30 outline-none focus:border-red-500 resize-none"
            />
            <div className="flex gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setShowFraudModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white hover:bg-white/15"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white"
              >
                {isSubmitting ? 'Envoi...' : 'Transmettre'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
