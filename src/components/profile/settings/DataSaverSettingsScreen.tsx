import React from 'react';
import {
  ChevronLeft,
  Wifi,
  Check,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';

interface DataSaverSettingsScreenProps {
  onBack: () => void;
}

export const DataSaverSettingsScreen: React.FC<DataSaverSettingsScreenProps> = ({ onBack }) => {
  const { showToast, clientPreferences, updateClientPreferences } = useApp();
  const dataSaver = clientPreferences.dataSaver;

  const updateDataSaver = (patch: Partial<typeof dataSaver>, message: string) => {
    void updateClientPreferences({
      dataSaver: {
        ...dataSaver,
        ...patch,
      },
    });
    showToast(message);
  };

  return (
    <div
      id="data-saver-settings-screen"
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
            Économiseur de données
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-16 p-4 space-y-6">
        {/* Toggle Hero Card */}
        <div className="p-5 bg-white/5 border border-white/10 rounded-3xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FF6321]/20 flex items-center justify-center text-[#FF6321] flex-shrink-0">
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Économiseur de données</p>
                <p className="text-[11px] text-white/50">Réseaux cellulaires (Orange, MTN, Moov CI)</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={dataSaver.enabled}
              onChange={(e) =>
                updateDataSaver(
                  { enabled: e.target.checked, videoQuality: e.target.checked ? 'data_saver' : 'auto' },
                  e.target.checked
                    ? 'Économiseur de données activé'
                    : 'Mode standard rétabli'
                )
              }
              className="accent-[#FF6321] w-5 h-5 cursor-pointer"
            />
          </div>

          <p className="text-xs text-white/60 leading-relaxed pt-1 border-t border-white/5">
            Lorsque cette option est activée, l'application limite le préchargement vidéo automatique sur connexion mobile afin de préserver votre forfait data.
          </p>
        </div>

        {/* STREAM QUALITY SELECTOR */}
        <div className="space-y-3">
          <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider block">
            QUALITÉ DU FLUX VIDÉO
          </span>

          <div className="bg-[#121212] border border-white/5 rounded-3xl divide-y divide-white/5 overflow-hidden">
            {[
              {
                id: 'data_saver' as const,
                title: 'Basse consommation (480p)',
                desc: 'Idéal pour préserver les forfaits internet Orange / MTN / Moov'
              },
              {
                id: 'auto' as const,
                title: 'Adaptative automatique (Recommandé)',
                desc: 'Ajuste le flux selon la bande passante disponible'
              },
              {
                id: 'high' as const,
                title: 'Haute définition',
                desc: 'Qualité maximale (consomme plus de données mobiles)'
              }
            ].map((q) => (
              <button
                key={q.id}
                onClick={() => updateDataSaver({ videoQuality: q.id }, 'Qualité vidéo enregistrée')}
                className={`w-full p-4 flex items-center justify-between text-left text-xs transition ${
                  dataSaver.videoQuality === q.id
                    ? 'bg-[#FF6321]/10 text-white font-bold'
                    : 'text-white/70 hover:bg-white/[0.04]'
                }`}
              >
                <div className="space-y-0.5 max-w-[85%]">
                  <p className="font-bold text-white">{q.title}</p>
                  <p className="text-[11px] text-white/40">{q.desc}</p>
                </div>
                {dataSaver.videoQuality === q.id && <Check className="w-4 h-4 text-[#FF6321]" />}
              </button>
            ))}
          </div>
        </div>

        {/* TOGGLE WI-FI ONLY */}
        <div className="p-4 bg-[#121212] border border-white/5 rounded-3xl flex items-center justify-between">
          <div className="space-y-0.5 max-w-[80%]">
            <p className="text-xs font-bold text-white">Lecture automatique en Wi-Fi uniquement</p>
            <p className="text-[11px] text-white/50">
              Désactive la lecture vidéo automatique lorsque vous utilisez les données mobiles.
            </p>
          </div>
          <input
            type="checkbox"
            checked={dataSaver.autoplayWifiOnly}
            onChange={(e) =>
              updateDataSaver(
                { autoplayWifiOnly: e.target.checked },
                e.target.checked ? 'Lecture auto limitée au Wi-Fi' : 'Lecture auto autorisée sur réseau mobile'
              )
            }
            className="accent-[#FF6321] w-4 h-4 cursor-pointer"
          />
        </div>
      </main>
    </div>
  );
};
