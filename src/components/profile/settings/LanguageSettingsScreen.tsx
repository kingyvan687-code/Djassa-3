import React, { useState } from 'react';
import {
  ChevronLeft,
  Check,
  BookOpen,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';

interface LanguageSettingsScreenProps {
  onBack: () => void;
}

export const LanguageSettingsScreen: React.FC<LanguageSettingsScreenProps> = ({ onBack }) => {
  const { showToast, clientPreferences, updateClientPreferences } = useApp();
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);

  const selectedAppLang = clientPreferences.language || 'fr-CI';

  const languages = [
    {
      id: 'fr-CI',
      name: 'Français (Côte d\'Ivoire)',
      subtitle: 'Langue principale d\'Abidjan et expressions locales',
      badge: 'Recommandé'
    },
    {
      id: 'fr-FR',
      name: 'Français (Standard)',
      subtitle: 'Français international standard',
      badge: 'Standard'
    },
    {
      id: 'en-US',
      name: 'English (US)',
      subtitle: 'Préférence enregistrée (interface actuelle en français)',
      badge: 'Partiel'
    }
  ];

  const glossary = [
    { term: 'Djassa', def: 'Le marché populaire, lieu où l\'on fait de bonnes affaires et où tout se vend.' },
    { term: 'Wari', def: 'L\'argent, les espèces ou le solde mobile (Wave / Mobile Money).' },
    { term: 'Kpaflottage', def: 'Le marchandage amical et la négociation des prix avec le vendeur.' },
    { term: 'Enjaillement', def: 'La joie, l\'enthousiasme de recevoir son colis conforme en direct.' },
    { term: 'Gouro', def: 'Le grand marché des vivres frais et produits agricoles d\'Adjamé.' },
    { term: 'Gaou', def: 'Une personne naïve qui achète sans vérifier la qualité ou sans code OTP.' }
  ];

  const handleSelectLanguage = (id: string, name: string) => {
    void updateClientPreferences({ language: id });
    showToast(`Langue enregistrée : ${name}`);
  };

  return (
    <div
      id="language-settings-screen"
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
            Langue
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-16">
        {/* SECTION 1: LANGUE DE L'APP */}
        <section className="mt-4">
          <div className="px-4 py-1.5 text-[11px] font-bold text-white/40 tracking-wider">
            LANGUE PRÉFÉRÉE DU COMPTE
          </div>
          <div className="bg-[#121212] border-t border-b border-white/5 divide-y divide-white/5">
            {languages.map((lang) => {
              const isSelected = selectedAppLang.toLowerCase() === lang.id.toLowerCase();
              return (
                <button
                  key={lang.id}
                  onClick={() => handleSelectLanguage(lang.id, lang.name)}
                  className={`w-full px-4 py-3.5 flex items-center justify-between text-left transition ${
                    isSelected ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="space-y-0.5 max-w-[80%]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{lang.name}</span>
                      {lang.badge && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/60 font-bold">
                          {lang.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/50">{lang.subtitle}</p>
                  </div>
                  {isSelected && <Check className="w-5 h-5 text-[#FF6321]" />}
                </button>
              );
            })}
          </div>
        </section>

        {/* SECTION 2: LEXIQUE DU MARCHÉ D'ADJAMÉ */}
        <section className="mt-6 px-4">
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-3">
            <button
              onClick={() => setIsGlossaryOpen(!isGlossaryOpen)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-[#FF6321]" />
                <span className="text-xs font-bold text-white">Lexique des expressions d'Adjamé</span>
              </div>
              <ChevronRight
                className={`w-4 h-4 text-white/40 transition-transform ${isGlossaryOpen ? 'rotate-90 text-[#FF6321]' : ''}`}
              />
            </button>

            {isGlossaryOpen && (
              <div className="space-y-2.5 pt-2 border-t border-white/5 text-xs">
                {glossary.map((item, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <span className="font-bold text-[#FF6321]">{item.term}</span>
                    <p className="text-[11px] text-white/60">{item.def}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};
