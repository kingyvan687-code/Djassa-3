import React, { useEffect } from 'react';
import {
  ChevronLeft,
  Check,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';

interface DisplaySettingsScreenProps {
  onBack: () => void;
}

export const DisplaySettingsScreen: React.FC<DisplaySettingsScreenProps> = ({ onBack }) => {
  const { showToast, clientPreferences, updateClientPreferences } = useApp();
  const display = clientPreferences.display;

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = display.theme;
      document.documentElement.dataset.fontSize = display.fontSize;
      document.documentElement.dataset.reduceMotion = String(display.reduceMotion);
    }
  }, [display.theme, display.fontSize, display.reduceMotion]);

  const handleSelectTheme = (mode: 'dark' | 'light') => {
    void updateClientPreferences({
      display: {
        ...display,
        theme: mode,
      },
    });
    showToast(mode === 'light' ? 'Mode clair activé' : 'Mode sombre activé');
  };

  const handleSelectFontSize = (fontSize: 'small' | 'normal' | 'large') => {
    void updateClientPreferences({
      display: {
        ...display,
        fontSize,
      },
    });
    showToast('Taille du texte enregistrée');
  };

  const handleToggleReduceMotion = (reduceMotion: boolean) => {
    void updateClientPreferences({
      display: {
        ...display,
        reduceMotion,
      },
    });
    showToast(reduceMotion ? 'Animations réduites' : 'Animations standard');
  };

  const previewSizes: Record<'small' | 'normal' | 'large', string> = {
    small: 'text-xs',
    normal: 'text-sm',
    large: 'text-base',
  };

  return (
    <div
      id="display-settings-screen"
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
            Mode sombre / Affichage
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-16 p-4 space-y-6">
        {/* SECTION 1: THEME APPARENCE */}
        <div className="space-y-3">
          <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider block">
            APPARENCE
          </span>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleSelectTheme('dark')}
              className={`p-4 rounded-3xl border text-left space-y-3 transition active:scale-95 ${
                display.theme === 'dark'
                  ? 'bg-[#181818] border-[#FF6321] ring-2 ring-[#FF6321]/30'
                  : 'bg-[#121212] border-white/10 hover:border-white/20'
              }`}
            >
              <div className="w-full h-20 rounded-2xl bg-black border border-white/10 p-2 flex flex-col justify-between">
                <div className="flex gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-[#FF6321]" />
                  <div className="w-12 h-2 rounded bg-white/20" />
                </div>
                <div className="w-full h-6 rounded-lg bg-white/10" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Mode sombre</span>
                {display.theme === 'dark' && <Check className="w-4 h-4 text-[#FF6321]" />}
              </div>
            </button>

            <button
              onClick={() => handleSelectTheme('light')}
              className={`p-4 rounded-3xl border text-left space-y-3 transition active:scale-95 ${
                display.theme === 'light'
                  ? 'bg-neutral-800 border-[#FF6321] ring-2 ring-[#FF6321]/30'
                  : 'bg-[#121212] border-white/10 hover:border-white/20'
              }`}
            >
              <div className="w-full h-20 rounded-2xl bg-white border border-neutral-300 p-2 flex flex-col justify-between">
                <div className="flex gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-[#FF6321]" />
                  <div className="w-12 h-2 rounded bg-neutral-300" />
                </div>
                <div className="w-full h-6 rounded-lg bg-neutral-200" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Mode clair</span>
                {display.theme === 'light' && <Check className="w-4 h-4 text-[#FF6321]" />}
              </div>
            </button>
          </div>
        </div>

        {/* SECTION 2: TAILLE DU TEXTE */}
        <div className="space-y-3">
          <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider block">
            TAILLE DU TEXTE & LISIBILITÉ
          </span>

          <div className="p-4 bg-[#141414] border border-white/10 rounded-3xl space-y-2">
            <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Aperçu en direct</span>
            <div className="p-3 bg-white/5 rounded-2xl space-y-1">
              <p className={`font-bold text-white ${previewSizes[display.fontSize]}`}>
                Boutique Wax & Élégance d'Adjamé
              </p>
              <p className={`text-white/60 leading-relaxed ${display.fontSize === 'large' ? 'text-sm' : 'text-xs'}`}>
                Arrivage spécial Wax Hollandais garanti 100% coton. Livraison moto rapide dans toutes les communes d'Abidjan.
              </p>
              <p className="text-[#FF6321] font-extrabold text-xs pt-1">15 000 FCFA</p>
            </div>
          </div>

          <div className="flex bg-[#121212] border border-white/5 p-1 rounded-2xl text-xs font-bold">
            {[
              { id: 'small' as const, label: 'Petit' },
              { id: 'normal' as const, label: 'Standard' },
              { id: 'large' as const, label: 'Grand' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelectFontSize(s.id)}
                className={`flex-1 py-2 rounded-xl transition ${
                  display.fontSize === s.id
                    ? 'bg-[#FF6321] text-white shadow'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* SECTION 3: ANIMATIONS */}
        <div className="bg-[#121212] border border-white/5 rounded-3xl divide-y divide-white/5 overflow-hidden">
          <div className="p-4 flex items-center justify-between">
            <div className="space-y-0.5 max-w-[80%]">
              <p className="text-xs font-bold text-white">Réduire les animations vives</p>
              <p className="text-[11px] text-white/50">
                Diminue les effets de transition pour plus de fluidité sur les appareils modestes.
              </p>
            </div>
            <input
              type="checkbox"
              checked={display.reduceMotion}
              onChange={(e) => handleToggleReduceMotion(e.target.checked)}
              className="accent-[#FF6321] w-4 h-4 cursor-pointer"
            />
          </div>
        </div>
      </main>
    </div>
  );
};
