import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Check,
  CheckCircle2,
} from 'lucide-react';

export interface ItemConditionDetails {
  conditionTitle: string;
  badge: string;
  badgeColor: string;
  origin?: string;
  includedAccessories?: string[];
  defectNote?: string;
  videoAvailable?: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentCondition: string;
  onSave: (conditionText: string, details?: ItemConditionDetails) => void;
}

interface PresetCondition {
  id: string;
  title: string;
  shortLabel: string;
  badge: string;
  badgeColor: string;
  icon: string;
  tagline: string;
  description: string;
  recommendedFor: string;
  defaultAccessories: string[];
}

export const PRESET_CONDITIONS: PresetCondition[] = [
  {
    id: 'new_sealed',
    title: "Neuf sous emballage d'origine",
    shortLabel: 'Neuf scellé',
    badge: '⭐ 100% Neuf & Scellé',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    icon: '✨',
    tagline: 'Jamais déballé, étiquettes et emballage d’usine intacts',
    description: "Article absolument neuf, blister scellé ou étiqueté d'origine. Aucun contact, accessoires neufs dans leur emballage d'origine.",
    recommendedFor: 'Smartphones scellés, parfums, cosmétiques, vêtements neufs avec étiquette',
    defaultAccessories: ["Boîte d'origine", "Étiquette attachée", "Notice constructeur"],
  },
  {
    id: 'authentic_certified',
    title: '100% Authentique Certifié',
    shortLabel: 'Authentique Garanti',
    badge: '🥇 Authenticité vérifiée',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    icon: '🥇',
    tagline: 'Produit original certifié conforme, sans contrefaçon',
    description: "Produit authentique de marque officielle vérifié par le vendeur. Facture d’achat ou numéro de série vérifiable sur demande.",
    recommendedFor: 'Sneakers & Baskets de marque (Nike, Jordan), montres, sacs, maroquinerie',
    defaultAccessories: ["Boîte de marque d'origine", "Facture / Reçu disponible"],
  },
  {
    id: 'like_new',
    title: 'Excellent état (Comme neuf)',
    shortLabel: 'Comme neuf',
    badge: '💎 Zéro défaut visible',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    icon: '💎',
    tagline: 'Utilisé 1 à 2 fois ou modèle d’exposition vitrine',
    description: "État impeccable sans aucune trace d'usure, ni rayure, ni tache. Aspect neuf à l'œil nu, parfait état de marche garanti.",
    recommendedFor: 'Tenues de soirée portées 1 fois, téléphones d’exposition, bijoux',
    defaultAccessories: ["Boîte d'origine", "Pochon de protection"],
  },
  {
    id: 'refurbished_guaranteed',
    title: 'Très bon état (Reconditionné garanti)',
    shortLabel: 'Reconditionné Pro',
    badge: '⚙️ 100% Testé & Révisé',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    icon: '⚙️',
    tagline: 'Révisé par des experts, micro-traces invisibles à 30cm',
    description: "Article testé en atelier technique sur tous ses points de contrôle. Batterie et composants en pleine capacité avec garantie vendeur.",
    recommendedFor: 'iPhones reconditionnés, ordinateurs PC/Mac portables, tablettes, consoles',
    defaultAccessories: ["Chargeur / Câble neuf inclus", "Garantie technique"],
  },
  {
    id: 'good_condition',
    title: 'Bon état (Prêt à l’emploi)',
    shortLabel: 'Bon plan usagé',
    badge: '🏷️ Bon rapport qualité/prix',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    icon: '👌',
    tagline: 'Signes normaux d’utilisation mais 100% fonctionnel et propre',
    description: "Article propre ayant servi normalement. Présente quelques légères traces d'usage superficielles qui n'altèrent en rien ses performances.",
    recommendedFor: 'Petit électroménager, matériel de sport, accessoires informatiques',
    defaultAccessories: ['Câble alimentation / adaptateur'],
  },
  {
    id: 'vintage_first_choice',
    title: 'Friperie 1er Choix (Sélectionnée & Lavée)',
    shortLabel: 'Friperie 1er Choix',
    badge: '🔥 Tendance Adjamé',
    badgeColor: 'bg-[#FF6321]/20 text-[#FF6321] border-[#FF6321]/30',
    icon: '👗',
    tagline: 'Sélection haut de gamme sans trou ni tache, prête à porter',
    description: "Pièce vintage ou friperie de première qualité, inspectée minutieusement, lavée et repassée avec soin avant mise en vente.",
    recommendedFor: 'Jeans vintage Levi’s, chemises en lin, vestes oversize, mode rétro',
    defaultAccessories: ['Prêt à porter / Repassé'],
  },
];

export const ItemConditionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentCondition,
  onSave,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('new_sealed');

  // Sync initial state from currentCondition
  useEffect(() => {
    if (!isOpen) return;

    const matched = PRESET_CONDITIONS.find(
      (p) =>
        p.title.toLowerCase().trim() === currentCondition.toLowerCase().trim() ||
        currentCondition.toLowerCase().includes(p.shortLabel.toLowerCase())
    );

    if (matched) {
      setSelectedPresetId(matched.id);
    } else {
      setSelectedPresetId('new_sealed');
    }
  }, [isOpen, currentCondition]);

  if (!isOpen) return null;

  const currentPreset =
    PRESET_CONDITIONS.find((p) => p.id === selectedPresetId) || PRESET_CONDITIONS[0];

  const handleSelectPreset = (preset: PresetCondition) => {
    setSelectedPresetId(preset.id);
  };

  const handleApply = () => {
    const details: ItemConditionDetails = {
      conditionTitle: currentPreset.title,
      badge: currentPreset.badge,
      badgeColor: currentPreset.badgeColor,
      includedAccessories: currentPreset.defaultAccessories,
      defectNote: currentPreset.description,
    };

    onSave(currentPreset.title, details);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div
        className="bg-neutral-900 border border-white/15 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#FF6321] to-amber-500 flex items-center justify-center text-white shadow-lg shadow-[#FF6321]/20 shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  État & Condition de l'article
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF6321]/20 text-[#FF6321] border border-[#FF6321]/30">
                  Transparence Vendeur
                </span>
              </div>
              <p className="text-xs text-white/60 line-clamp-1">
                Indiquez clairement l’état réel pour rassurer l’acheteur et accélérer la vente
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/70 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white/80 uppercase tracking-wider">
                Sélectionnez la condition de votre produit :
              </span>
              <span className="text-[11px] text-white/40">
                {PRESET_CONDITIONS.length} formules vérifiées
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {PRESET_CONDITIONS.map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition relative text-left flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-[#FF6321]/10 border-[#FF6321] shadow-md shadow-[#FF6321]/10 ring-1 ring-[#FF6321]/30'
                        : 'bg-neutral-800/40 border-white/10 hover:bg-neutral-800/80 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{preset.icon}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white leading-tight">
                              {preset.title}
                            </h3>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${preset.badgeColor}`}
                            >
                              {preset.badge}
                            </span>
                          </div>
                          <p className="text-xs text-[#FF6321] font-medium mt-0.5">
                            {preset.tagline}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition ${
                          isSelected
                            ? 'bg-[#FF6321] border-[#FF6321] text-white'
                            : 'border-white/20 bg-white/5'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>

                    <p className="text-[11px] text-white/70 pl-8 leading-relaxed">
                      {preset.description}
                    </p>

                    <div className="pl-8 pt-1 flex flex-wrap items-center gap-1.5 border-t border-white/5 mt-1">
                      <span className="text-[10px] text-white/40 font-medium">Idéal pour :</span>
                      <span className="text-[10px] text-white/80 font-medium bg-white/5 px-2 py-0.5 rounded-md">
                        {preset.recommendedFor}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Aperçu en direct pour l'acheteur */}
          <div className="p-3.5 rounded-xl bg-gradient-to-b from-neutral-800/90 to-neutral-900 border border-white/15 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#FF6321]" />
                Aperçu pour l'acheteur sur la fiche produit :
              </span>
              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                ● Visible publiquement
              </span>
            </div>

            <div className="bg-neutral-950/80 p-3 rounded-xl border border-white/10 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-xl shrink-0 border border-white/10">
                {currentPreset.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-white">{currentPreset.title}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${currentPreset.badgeColor}`}
                  >
                    {currentPreset.badge}
                  </span>
                </div>

                <p className="text-[11px] text-white/70 mt-1 leading-snug">
                  {currentPreset.description}
                </p>

                {currentPreset.defaultAccessories && currentPreset.defaultAccessories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {currentPreset.defaultAccessories.map((acc, i) => (
                      <span
                        key={i}
                        className="text-[9px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/80"
                      >
                        {acc}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-neutral-950/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-white/15 text-xs font-bold text-white/80 hover:bg-white/5 transition"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#FF6321] to-[#FF8A00] text-white font-black text-xs hover:brightness-110 active:scale-[0.99] transition shadow-lg shadow-[#FF6321]/20 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            Valider cet État ({currentPreset.shortLabel})
          </button>
        </div>
      </div>
    </div>
  );
};
