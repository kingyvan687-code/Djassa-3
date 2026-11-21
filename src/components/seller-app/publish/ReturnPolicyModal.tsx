import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  X,
  Check,
  RotateCcw,
  Sparkles,
  Clock,
  Truck,
  CheckCircle2,
  FileText,
  HelpCircle,
  Eye,
  AlertTriangle,
} from 'lucide-react';

export interface ReturnPolicyDetails {
  title: string;
  durationDays: number;
  durationLabel: string;
  allowExchange: boolean;
  allowRefund: boolean;
  allowStoreCredit: boolean;
  shippingFeePayer: 'seller' | 'buyer' | 'shared';
  conditionTags: string[];
  customNote: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentPolicy: string;
  onSave: (policyText: string, details?: ReturnPolicyDetails) => void;
}

interface PresetOption {
  id: string;
  title: string;
  badge: string;
  badgeColor: string;
  icon: typeof ShieldCheck;
  durationDays: number;
  durationLabel: string;
  description: string;
  recommendedFor: string;
  allowExchange: boolean;
  allowRefund: boolean;
  allowStoreCredit: boolean;
  shippingFeePayer: 'seller' | 'buyer' | 'shared';
  conditions: string[];
}

const PRESET_POLICIES: PresetOption[] = [
  {
    id: '3_days',
    title: 'Garantie 3 jours échange / remboursement',
    badge: '⭐ Recommandé Djassa',
    badgeColor: 'bg-[#FF6321]/20 text-[#FF6321] border-[#FF6321]/30',
    icon: ShieldCheck,
    durationDays: 3,
    durationLabel: '3 jours',
    description: "L'acheteur dispose de 3 jours après réception pour essayer et vérifier. Échange gratuit de taille ou remboursement si non conforme.",
    recommendedFor: 'Vêtements, chaussures, mode & accessoires',
    allowExchange: true,
    allowRefund: true,
    allowStoreCredit: true,
    shippingFeePayer: 'seller',
    conditions: [
      'Article non porté et non lavé avec étiquettes d’origine',
      'Emballage d’origine conservé',
      'Signalement sous 72h via l’application Djassa',
    ],
  },
  {
    id: 'delivery_check',
    title: 'Vérification à la livraison avant paiement',
    badge: '⚡ Anti-Litige',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    icon: Eye,
    durationDays: 0,
    durationLabel: 'À la livraison',
    description: "Le client vérifie l'article directement à la réception avec la boutique avant de régler.",
    recommendedFor: 'Ventes flash, déstockage, parfums & produits scellés',
    allowExchange: true,
    allowRefund: false,
    allowStoreCredit: true,
    shippingFeePayer: 'buyer',
    conditions: [
      'Inspection immédiate lors de la remise par la boutique',
      'Validation du paiement à la réception',
      'Refus sur place sans frais si l’article n’est pas conforme',
    ],
  },
  {
    id: '7_days_tech',
    title: 'Garantie 7 jours pièces et main d’œuvre',
    badge: '🔧 Électronique',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    icon: RotateCcw,
    durationDays: 7,
    durationLabel: '7 jours',
    description: "Prise en charge technique complète sous 7 jours. Réparation, échange standard ou remplacement immédiat en boutique.",
    recommendedFor: 'Téléphonie, écouteurs, montres connectées, petits appareils',
    allowExchange: true,
    allowRefund: true,
    allowStoreCredit: true,
    shippingFeePayer: 'shared',
    conditions: [
      'Appareil non démonté et sans trace de choc ou liquide',
      'Présentation de la facture / reçu numérique Djassa',
      'Accessoires et boîte d’origine complets',
    ],
  },
  {
    id: '14_days_premium',
    title: 'Garantie Sérénité 14 jours échange ou avoir',
    badge: '💎 Premium',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    icon: Sparkles,
    durationDays: 14,
    durationLabel: '14 jours',
    description: "Délai étendu de 14 jours pour rassurer vos acheteurs et booster votre taux de conversion. Échange rapide contre tout article de la boutique.",
    recommendedFor: 'Boutiques officielles certifiées & articles de luxe',
    allowExchange: true,
    allowRefund: false,
    allowStoreCredit: true,
    shippingFeePayer: 'shared',
    conditions: [
      'État neuf irréprochable sous blister ou boîte',
      'Conservation du certificat d’authenticité',
    ],
  },
  {
    id: 'no_return',
    title: 'Vente finale (Sans retour ni échange)',
    badge: '🔒 Déstockage',
    badgeColor: 'bg-neutral-500/20 text-neutral-300 border-neutral-500/30',
    icon: AlertTriangle,
    durationDays: 0,
    durationLabel: 'Aucun retour',
    description: "Article vendu en l’état avec forte remise. Pas d'échange ni de remboursement possible après expédition.",
    recommendedFor: 'Sous-vêtements, soldes ultimes & fin de série',
    allowExchange: false,
    allowRefund: false,
    allowStoreCredit: false,
    shippingFeePayer: 'buyer',
    conditions: [
      'Prix cassé non négociable',
      'Vérification visuelle possible avant expédition',
    ],
  },
];

export const ReturnPolicyModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentPolicy,
  onSave,
}) => {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('3_days');
  const [customTitle, setCustomTitle] = useState('');
  const [durationDays, setDurationDays] = useState<number>(3);
  const [allowExchange, setAllowExchange] = useState(true);
  const [allowRefund, setAllowRefund] = useState(true);
  const [allowStoreCredit, setAllowStoreCredit] = useState(true);
  const [shippingFeePayer, setShippingFeePayer] = useState<'seller' | 'buyer' | 'shared'>('seller');
  const [selectedConditions, setSelectedConditions] = useState<string[]>([
    'Article non porté et non lavé avec étiquettes d’origine',
    'Emballage d’origine conservé',
    'Signalement sous 72h via l’application Djassa',
  ]);
  const [customNote, setCustomNote] = useState('');
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');

  // Initialize state when modal opens
  useEffect(() => {
    if (isOpen) {
      const matched = PRESET_POLICIES.find((p) => p.title === currentPolicy);
      if (matched) {
        setSelectedPresetId(matched.id);
        setCustomTitle(matched.title);
        setDurationDays(matched.durationDays);
        setAllowExchange(matched.allowExchange);
        setAllowRefund(matched.allowRefund);
        setAllowStoreCredit(matched.allowStoreCredit);
        setShippingFeePayer(matched.shippingFeePayer);
        setSelectedConditions(matched.conditions);
        setActiveTab('presets');
      } else {
        setSelectedPresetId('custom');
        setCustomTitle(currentPolicy || 'Garantie 3 jours échange / remboursement');
        setActiveTab('custom');
      }
    }
  }, [isOpen, currentPolicy]);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: PresetOption) => {
    setSelectedPresetId(preset.id);
    setCustomTitle(preset.title);
    setDurationDays(preset.durationDays);
    setAllowExchange(preset.allowExchange);
    setAllowRefund(preset.allowRefund);
    setAllowStoreCredit(preset.allowStoreCredit);
    setShippingFeePayer(preset.shippingFeePayer);
    setSelectedConditions(preset.conditions);
  };

  const toggleCondition = (cond: string) => {
    if (selectedConditions.includes(cond)) {
      setSelectedConditions(selectedConditions.filter((c) => c !== cond));
    } else {
      setSelectedConditions([...selectedConditions, cond]);
    }
  };

  const handleApply = () => {
    const finalTitle = customTitle.trim() || 'Garantie 3 jours échange / remboursement';
    onSave(finalTitle, {
      title: finalTitle,
      durationDays,
      durationLabel: durationDays === 0 ? 'À la livraison' : `${durationDays} jours`,
      allowExchange,
      allowRefund,
      allowStoreCredit,
      shippingFeePayer,
      conditionTags: selectedConditions,
      customNote,
    });
    onClose();
  };

  const selectedPreset = PRESET_POLICIES.find((p) => p.id === selectedPresetId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm transition-all"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[92vh] bg-[#121212] border border-white/10 rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-6 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP HEADER */}
        <div className="sticky top-0 z-20 px-5 py-4 bg-[#141414]/95 backdrop-blur-xl border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FF6321]/15 border border-[#FF6321]/30 flex items-center justify-center text-[#FF6321]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                Garantie & Politique d'échange
              </h3>
              <p className="text-[11px] text-white/50">
                Rassurez vos acheteurs et réduisez les litiges à la livraison
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* TABS SELECTOR */}
        <div className="px-5 pt-3 bg-[#121212] border-b border-white/5">
          <div className="flex gap-2 p-1 rounded-2xl bg-white/5 border border-white/5">
            <button
              type="button"
              onClick={() => setActiveTab('presets')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'presets'
                  ? 'bg-[#FF6321] text-white shadow-md shadow-orange-500/20'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Formules Recommandées</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('custom')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'custom'
                  ? 'bg-[#FF6321] text-white shadow-md shadow-orange-500/20'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Personnaliser en détail</span>
            </button>
          </div>
        </div>

        {/* BODY SCROLLABLE CONTENT */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
          {activeTab === 'presets' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white/80">
                  Choisissez votre engagement boutique :
                </span>
                <span className="text-[10px] text-white/40">1 clic pour appliquer</span>
              </div>

              {PRESET_POLICIES.map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                const IconComponent = preset.icon;

                return (
                  <div
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-4 rounded-2xl border transition cursor-pointer relative ${
                      isSelected
                        ? 'bg-[#FF6321]/10 border-[#FF6321] shadow-lg shadow-[#FF6321]/10'
                        : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected
                              ? 'bg-[#FF6321] text-white'
                              : 'bg-white/10 text-white/70'
                          }`}
                        >
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-white">
                              {preset.title}
                            </h4>
                            <span
                              className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${preset.badgeColor}`}
                            >
                              {preset.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-white/70 leading-relaxed">
                            {preset.description}
                          </p>
                          <div className="pt-1 flex items-center gap-2 text-[10px] text-white/50">
                            <span>Idéal pour :</span>
                            <span className="font-semibold text-white/80">
                              {preset.recommendedFor}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? 'bg-[#FF6321] border-[#FF6321] text-white'
                            : 'border-white/30 text-transparent'
                        }`}
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* CUSTOM TAB */
            <div className="space-y-4">
              {/* Titre affiché */}
              <div>
                <label className="text-xs font-bold text-white/80 block mb-1.5">
                  Titre de la politique de garantie
                </label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Ex: Garantie 3 jours échange / remboursement"
                  className="w-full p-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                />
              </div>

              {/* Délai accordé */}
              <div>
                <label className="text-xs font-bold text-white/80 block mb-1.5">
                  Délai pour faire une réclamation :
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'À la livraison', days: 0 },
                    { label: '24 heures', days: 1 },
                    { label: '3 jours', days: 3 },
                    { label: '7 jours', days: 7 },
                    { label: '14 jours', days: 14 },
                    { label: '30 jours', days: 30 },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setDurationDays(item.days)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1 ${
                        durationDays === item.days
                          ? 'bg-[#FF6321] border-[#FF6321] text-white'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Solutions proposées */}
              <div>
                <label className="text-xs font-bold text-white/80 block mb-1.5">
                  Solutions proposées à l'acheteur :
                </label>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition">
                    <span className="text-xs text-white">Échange direct de taille ou couleur</span>
                    <input
                      type="checkbox"
                      checked={allowExchange}
                      onChange={(e) => setAllowExchange(e.target.checked)}
                      className="w-4 h-4 accent-[#FF6321]"
                    />
                  </label>
                  <label className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition">
                    <span className="text-xs text-white">Remboursement intégral (Wave / Orange Money / Espèces)</span>
                    <input
                      type="checkbox"
                      checked={allowRefund}
                      onChange={(e) => setAllowRefund(e.target.checked)}
                      className="w-4 h-4 accent-[#FF6321]"
                    />
                  </label>
                  <label className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition">
                    <span className="text-xs text-white">Avoir / Bon d'achat réutilisable dans votre boutique</span>
                    <input
                      type="checkbox"
                      checked={allowStoreCredit}
                      onChange={(e) => setAllowStoreCredit(e.target.checked)}
                      className="w-4 h-4 accent-[#FF6321]"
                    />
                  </label>
                </div>
              </div>

              {/* Frais de retour pour l'échange */}
              <div>
                <label className="text-xs font-bold text-white/80 block mb-1.5">
                  Frais de retour pour l'échange :
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'seller', label: 'Vendeur (Gratuit acheteur)' },
                    { id: 'buyer', label: 'À la charge acheteur' },
                    { id: 'shared', label: '50% / 50% partagé' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setShippingFeePayer(f.id as any)}
                      className={`p-2 rounded-xl border text-[11px] font-bold text-center transition ${
                        shippingFeePayer === f.id
                          ? 'bg-[#FF6321]/20 border-[#FF6321] text-[#FF6321]'
                          : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Conditions exigées */}
              <div>
                <label className="text-xs font-bold text-white/80 block mb-1.5">
                  Conditions impératives pour valider le retour :
                </label>
                <div className="space-y-1.5">
                  {[
                    'Article non porté et non lavé avec étiquettes d’origine',
                    'Emballage d’origine conservé',
                    'Signalement sous 72h via l’application Djassa',
                    'Produit propre sans tâche ni odeur de parfum',
                  ].map((cond) => {
                    const isChecked = selectedConditions.includes(cond);
                    return (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => toggleCondition(cond)}
                        className={`w-full text-left p-2.5 rounded-xl border text-[11px] transition flex items-center justify-between ${
                          isChecked
                            ? 'bg-white/10 border-white/20 text-white'
                            : 'bg-transparent border-white/5 text-white/40'
                        }`}
                      >
                        <span>{cond}</span>
                        <span
                          className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] ${
                            isChecked
                              ? 'bg-emerald-500 text-black font-bold'
                              : 'border border-white/20'
                          }`}
                        >
                          {isChecked ? '✓' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Note ou consigne additionnelle */}
              <div>
                <label className="text-xs font-bold text-white/80 block mb-1.5">
                  Consigne particulière pour votre boutique (Optionnel)
                </label>
                <textarea
                  rows={2}
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  placeholder="Ex: Échange possible directement à notre boutique d'Adjamé avec le numéro de commande..."
                  className="w-full p-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321] resize-none"
                />
              </div>
            </div>
          )}

          {/* APERÇU CARTE CLIENT */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-white/5 to-transparent border border-emerald-500/20 space-y-1.5">
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Visible par les clients sur la fiche produit :</span>
            </div>
            <p className="text-xs font-black text-white">
              🛡️ {customTitle || selectedPreset?.title || 'Garantie 3 jours échange / remboursement'}
            </p>
            <p className="text-[11px] text-white/60 leading-relaxed">
              {selectedPreset?.description ||
                "Couvert par la Garantie Transparence Djassa. Échange rapide organisé directement avec la boutique."}
            </p>
          </div>
        </div>

        {/* BOTTOM STICKY ACTION */}
        <div className="p-4 bg-[#141414] border-t border-white/10 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 py-3.5 rounded-2xl bg-[#FF6321] hover:bg-[#FF6321]/90 text-xs sm:text-sm font-black text-white transition shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Valider et appliquer cette garantie</span>
          </button>
        </div>
      </div>
    </div>
  );
};
