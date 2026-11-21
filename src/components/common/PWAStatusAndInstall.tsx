import React from 'react';
import { Download, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAStatusAndInstall: React.FC = () => {
  const { canInstall, isOffline, triggerInstall, dismissPrompt } = usePWAInstall();

  return (
    <>
      {isOffline && (
        <div
          id="pwa-offline-banner"
          className="fixed top-2 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-[11px] font-semibold backdrop-blur-md flex items-center gap-2 shadow-lg max-w-[92vw]"
        >
          <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">Mode hors-ligne : reconnectez-vous pour synchroniser vos commandes.</span>
        </div>
      )}

      {canInstall && (
        <div
          id="pwa-install-banner"
          className="fixed bottom-20 right-4 z-40 max-w-xs rounded-2xl bg-[#141414]/95 border border-white/10 p-3 shadow-2xl backdrop-blur-xl flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-xl bg-[#FF6321]/15 border border-[#FF6321]/30 flex items-center justify-center shrink-0">
            <Download className="w-4 h-4 text-[#FF6321]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate">Installer DJASSA</p>
            <p className="text-[10px] text-white/55 truncate">Accès rapide depuis l’écran d’accueil</p>
          </div>
          <button
            type="button"
            onClick={() => void triggerInstall()}
            className="px-2.5 py-1.5 rounded-lg bg-[#FF6321] hover:bg-[#ff7538] text-white text-[11px] font-bold cursor-pointer shrink-0"
          >
            Installer
          </button>
          <button
            type="button"
            onClick={dismissPrompt}
            aria-label="Fermer l’invitation d’installation"
            className="p-1 text-white/40 hover:text-white cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
};
