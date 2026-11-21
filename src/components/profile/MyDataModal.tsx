import React from 'react';
import { X, Database, Download, Trash2, ShieldCheck, HardDrive } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface MyDataModalProps {
  onClose: () => void;
}

export const MyDataModal: React.FC<MyDataModalProps> = ({ onClose }) => {
  const { userProfile, clearHistory, showToast } = useApp();

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(userProfile, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `djassa_profile_${userProfile.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Vos données ont été exportées en format JSON');
  };

  const handleClearHistory = () => {
    clearHistory();
    showToast('Historique de navigation vidé avec succès');
  };

  return (
    <div
      id="my-data-modal-overlay"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end"
      onClick={onClose}
    >
      <div
        id="my-data-modal-sheet"
        className="w-full max-h-[85vh] bg-[#141414] rounded-t-3xl border-t border-white/15 p-5 flex flex-col shadow-2xl animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#FF6321]" />
            <h2 className="text-sm font-extrabold text-white">Mes Données & Confidentialité</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 text-white/70 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4 no-scrollbar">
          {/* Export Data */}
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-[#FF6321]" />
              <h3 className="text-xs font-bold text-white">Exporter mes données</h3>
            </div>
            <p className="text-xs text-white/60">
              Téléchargez une copie complète de votre profil, vos adresses et vos statistiques.
            </p>
            <button
              onClick={handleExport}
              className="mt-2 w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition border border-white/10"
            >
              Télécharger l'archive JSON
            </button>
          </div>

          {/* Clear History */}
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2">
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-400" />
              <h3 className="text-xs font-bold text-white">Vider l'historique</h3>
            </div>
            <p className="text-xs text-white/60">
              Effacez l'historique des vidéos regardées et des recherches locales.
            </p>
            <button
              onClick={handleClearHistory}
              className="mt-2 w-full py-2.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs transition border border-rose-500/20"
            >
              Supprimer l'historique
            </button>
          </div>

          <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex items-center gap-2.5 text-xs text-emerald-300">
            <ShieldCheck className="w-5 h-5 flex-shrink-0" />
            <span>Conformité RGPD et protection des données personnelles garantie par Djassa.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
