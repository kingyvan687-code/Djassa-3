import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Check,
  X,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';

interface ContentPreferencesSettingsScreenProps {
  onBack: () => void;
}

const ALL_TOPICS = [
  'Tissus & Wax Hollandais',
  'Baskets & Sneakers',
  'Smartphones & High-Tech',
  'Bijoux & Parfums',
  'Électroménager & Maison',
  'Épicerie & Saveurs d\'Abidjan',
  'Cosmétiques & Soins',
  'Accessoires & Maroquinerie',
  'Véhicules & Pièces auto',
  'Vêtements Homme & Femme'
];

export const ContentPreferencesSettingsScreen: React.FC<ContentPreferencesSettingsScreenProps> = ({ onBack }) => {
  const { showToast, clientPreferences, updateClientPreferences, sellers } = useApp();

  const filteredKeywords = clientPreferences.contentPreferences.mutedKeywords;
  const selectedTopics = clientPreferences.contentPreferences.favoriteCategories;
  const blockedSellerIds = clientPreferences.privacy.blockedSellerIds;

  const [activeModal, setActiveModal] = useState<
    null | 'filter_keywords' | 'refresh_feed' | 'stem_topics' | 'hidden_sellers'
  >(null);
  const [newKeywordInput, setNewKeywordInput] = useState('');

  const blockedSellersList = useMemo(
    () =>
      blockedSellerIds.map((id) => {
        const found = sellers.find((s) => s.id === id);
        return {
          id,
          name: found?.storeName || found?.name || `Boutique (${id})`,
        };
      }),
    [blockedSellerIds, sellers]
  );

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newKeywordInput.trim().toLowerCase();
    if (!cleaned) return;
    if (filteredKeywords.includes(cleaned)) {
      showToast('Ce mot-clé est déjà dans votre liste.');
      return;
    }
    void updateClientPreferences({
      contentPreferences: {
        ...clientPreferences.contentPreferences,
        mutedKeywords: [...filteredKeywords, cleaned],
      },
    });
    setNewKeywordInput('');
    showToast('Mot-clé ajouté au filtre');
  };

  const handleRemoveKeyword = (kw: string) => {
    void updateClientPreferences({
      contentPreferences: {
        ...clientPreferences.contentPreferences,
        mutedKeywords: filteredKeywords.filter((k) => k !== kw),
      },
    });
    showToast('Mot-clé retiré du filtre');
  };

  const handleToggleTopic = (topic: string) => {
    const nextTopics = selectedTopics.includes(topic)
      ? selectedTopics.filter((t) => t !== topic)
      : [...selectedTopics, topic];

    void updateClientPreferences({
      contentPreferences: {
        ...clientPreferences.contentPreferences,
        favoriteCategories: nextTopics,
      },
    });
    showToast('Centres d\'intérêt mis à jour');
  };

  const handleUnblockSeller = (sellerId: string, sellerName: string) => {
    void updateClientPreferences({
      privacy: {
        ...clientPreferences.privacy,
        blockedSellerIds: blockedSellerIds.filter((id) => id !== sellerId),
      },
    });
    showToast(`${sellerName} est de nouveau visible dans votre fil.`);
  };

  const handleConfirmResetFilters = () => {
    void updateClientPreferences({
      contentPreferences: {
        favoriteCategories: [],
        mutedKeywords: [],
      },
    });
    showToast('Préférences de contenu réinitialisées');
    setActiveModal(null);
  };

  return (
    <div
      id="content-preferences-settings-screen"
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
            Préférences de contenu
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-16">
        {/* BANNER RÉINITIALISER LES PRÉFÉRENCES */}
        <div className="p-4 mx-4 mt-4 bg-gradient-to-r from-[#FF6321]/20 via-[#FF6321]/10 to-transparent border border-[#FF6321]/30 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#FF6321] text-white flex items-center justify-center flex-shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Réinitialiser le filtrage du fil</p>
              <p className="text-[11px] text-white/60">Efface les mots-clés masqués et thèmes sélectionnés.</p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal('refresh_feed')}
            className="px-3 py-1.5 rounded-xl bg-[#FF6321] text-white text-xs font-bold hover:bg-[#E05316] transition active:scale-95 shadow"
          >
            Réinitialiser
          </button>
        </div>

        {/* SECTION 1: FILTRES ET THÈMES */}
        <section className="mt-5">
          <div className="px-4 py-1.5 text-[11px] font-bold text-white/40 tracking-wider">
            FILTRAGE DE CONTENU
          </div>
          <div className="bg-[#121212] border-t border-b border-white/5 divide-y divide-white/5">
            <button
              onClick={() => setActiveModal('filter_keywords')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] transition"
            >
              <div className="space-y-0.5 max-w-[80%]">
                <span className="text-sm font-semibold text-white block">Filtrer les mots-clés</span>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Mots-clés masqués dans votre fil ({filteredKeywords.length} actif(s)).
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30" />
            </button>

            <button
              onClick={() => setActiveModal('stem_topics')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] transition"
            >
              <div className="space-y-0.5 max-w-[80%]">
                <span className="text-sm font-semibold text-white block">Centres d'intérêt du marché</span>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Catégories préférées ({selectedTopics.length} sélectionnée(s)).
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30" />
            </button>

            <button
              onClick={() => setActiveModal('hidden_sellers')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] transition"
            >
              <div className="space-y-0.5 max-w-[80%]">
                <span className="text-sm font-semibold text-white block">Boutiques masquées</span>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Vendeurs bloqués ({blockedSellersList.length}).
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30" />
            </button>
          </div>
        </section>
      </main>

      {/* MODAL 1: FILTRER MOTS CLÉS */}
      {activeModal === 'filter_keywords' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-sm mx-auto bg-[#181818] rounded-3xl border border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Mots-clés filtrés</h3>
              <button onClick={() => setActiveModal(null)} className="p-1 text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddKeyword} className="flex gap-2">
              <input
                type="text"
                value={newKeywordInput}
                onChange={(e) => setNewKeywordInput(e.target.value)}
                placeholder="Ajouter un mot-clé..."
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-[#FF6321]"
              />
              <button
                type="submit"
                className="px-3.5 py-2 bg-[#FF6321] hover:bg-[#E05316] text-white rounded-xl text-xs font-bold transition shadow"
              >
                Ajouter
              </button>
            </form>

            {filteredKeywords.length === 0 ? (
              <p className="text-xs text-white/50 py-3 text-center">Aucun mot-clé filtré.</p>
            ) : (
              <div className="space-y-2">
                {filteredKeywords.map((kw) => (
                  <div key={kw} className="p-2.5 bg-white/5 rounded-xl flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{kw}</span>
                    <button
                      onClick={() => handleRemoveKeyword(kw)}
                      className="p-1 text-white/40 hover:text-red-400 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: RÉINITIALISER */}
      {activeModal === 'refresh_feed' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-sm mx-auto bg-[#181818] rounded-3xl border border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-[#FF6321]/20 text-[#FF6321] flex items-center justify-center mx-auto">
              <RefreshCw className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Réinitialiser vos filtres ?</h3>
              <p className="text-xs text-white/60 mt-1">
                Vos thèmes favoris et mots-clés filtrés seront remis à zéro. Vos commandes et abonnements restent intacts.
              </p>
            </div>

            <div className="flex gap-2 pt-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmResetFilters}
                className="flex-1 py-3 rounded-xl bg-[#FF6321] hover:bg-[#E05316] text-white transition shadow"
              >
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: THÈMES DU MARCHÉ */}
      {activeModal === 'stem_topics' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-sm mx-auto bg-[#181818] rounded-3xl border border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Vos thèmes favoris</h3>
              <button onClick={() => setActiveModal(null)} className="p-1 text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              {ALL_TOPICS.map((topic) => {
                const isSelected = selectedTopics.includes(topic);
                return (
                  <button
                    key={topic}
                    onClick={() => handleToggleTopic(topic)}
                    className={`w-full p-3 rounded-2xl flex items-center justify-between text-left text-xs transition ${
                      isSelected
                        ? 'bg-[#FF6321]/15 border border-[#FF6321] text-white font-bold'
                        : 'bg-white/5 border border-white/5 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <span>{topic}</span>
                    {isSelected && <Check className="w-4 h-4 text-[#FF6321]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: BOUTIQUES MASQUÉES */}
      {activeModal === 'hidden_sellers' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-sm mx-auto bg-[#181818] rounded-3xl border border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Boutiques masquées ({blockedSellersList.length})</h3>
              <button onClick={() => setActiveModal(null)} className="p-1 text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {blockedSellersList.length === 0 ? (
              <p className="text-xs text-white/50 py-4 text-center">Aucune boutique masquée.</p>
            ) : (
              blockedSellersList.map((seller) => (
                <div key={seller.id} className="p-3 bg-white/5 rounded-2xl flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">{seller.name}</span>
                  <button
                    onClick={() => handleUnblockSeller(seller.id, seller.name)}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-[#FF6321] text-white font-bold text-[11px] transition active:scale-95"
                  >
                    Débloquer
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
