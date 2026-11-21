import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  Trash2,
  HardDrive,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';

interface FreeUpSpaceSettingsScreenProps {
  onBack: () => void;
}

const TRANSIENT_KEY_PREFIXES = ['djassa_cache_', 'djassa_thumb_', 'djassa_ai_preview_'];
const DOWNLOAD_KEY_PREFIXES = ['djassa_receipt_', 'djassa_invoice_', 'djassa_download_'];
const DRAFT_KEY_PREFIXES = ['djassa_draft_', 'djassa_review_draft_', 'djassa_comment_draft_'];

function measureStorageMb(prefixes: string[]): number {
  if (typeof window === 'undefined') return 0;
  let totalBytes = 0;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && prefixes.some((p) => key.startsWith(p))) {
        const val = window.localStorage.getItem(key) || '';
        totalBytes += (key.length + val.length) * 2;
      }
    }
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key && prefixes.some((p) => key.startsWith(p))) {
        const val = window.sessionStorage.getItem(key) || '';
        totalBytes += (key.length + val.length) * 2;
      }
    }
  } catch {
    return 0;
  }
  return Number((totalBytes / (1024 * 1024)).toFixed(2));
}

function measureAppStateMb(): number {
  if (typeof window === 'undefined') return 0;
  let totalBytes = 0;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      const isBucket =
        TRANSIENT_KEY_PREFIXES.some((p) => key.startsWith(p)) ||
        DOWNLOAD_KEY_PREFIXES.some((p) => key.startsWith(p)) ||
        DRAFT_KEY_PREFIXES.some((p) => key.startsWith(p));
      if (!isBucket) {
        const val = window.localStorage.getItem(key) || '';
        totalBytes += (key.length + val.length) * 2;
      }
    }
  } catch {
    return 0;
  }
  return Number((totalBytes / (1024 * 1024)).toFixed(2));
}

function purgeStorageKeys(prefixes: string[]): number {
  if (typeof window === 'undefined') return 0;
  let removedCount = 0;
  try {
    const lsKeys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && prefixes.some((p) => key.startsWith(p))) lsKeys.push(key);
    }
    lsKeys.forEach((k) => {
      window.localStorage.removeItem(k);
      removedCount += 1;
    });

    const ssKeys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key && prefixes.some((p) => key.startsWith(p))) ssKeys.push(key);
    }
    ssKeys.forEach((k) => {
      window.sessionStorage.removeItem(k);
      removedCount += 1;
    });
  } catch {
    // Ignore storage access errors in restricted mode
  }
  return removedCount;
}

export const FreeUpSpaceSettingsScreen: React.FC<FreeUpSpaceSettingsScreenProps> = ({ onBack }) => {
  const { showToast, clearTransientCache } = useApp();

  const [cacheSize, setCacheSize] = useState(0);
  const [downloadsSize, setDownloadsSize] = useState(0);
  const [draftsSize, setDraftsSize] = useState(0);
  const [appStateSize, setAppStateSize] = useState(0);
  const [freedTotalMb, setFreedTotalMb] = useState(0);

  const [clearingCache, setClearingCache] = useState(false);
  const [clearingDownloads, setClearingDownloads] = useState(false);
  const [clearingDrafts, setClearingDrafts] = useState(false);

  const [confirmClearType, setConfirmClearType] = useState<null | 'cache' | 'downloads' | 'drafts'>(null);

  const refreshUsage = () => {
    setCacheSize(measureStorageMb(TRANSIENT_KEY_PREFIXES));
    setDownloadsSize(measureStorageMb(DOWNLOAD_KEY_PREFIXES));
    setDraftsSize(measureStorageMb(DRAFT_KEY_PREFIXES));
    setAppStateSize(measureAppStateMb());
  };

  useEffect(() => {
    refreshUsage();
  }, []);

  const handleClearCache = async () => {
    setClearingCache(true);
    setConfirmClearType(null);
    const before = cacheSize;
    try {
      purgeStorageKeys(TRANSIENT_KEY_PREFIXES);
      if (typeof window !== 'undefined' && 'caches' in window) {
        const names = await window.caches.keys();
        await Promise.all(
          names
            .filter((name) => name.toLowerCase().includes('djassa') || name.toLowerCase().includes('video'))
            .map((name) => window.caches.delete(name))
        );
      }
      clearTransientCache();
      refreshUsage();
      setFreedTotalMb((prev) => Number((prev + before).toFixed(2)));
      showToast(`Cache vidéo et miniatures vidé (${before.toFixed(2)} Mo)`);
    } finally {
      setClearingCache(false);
    }
  };

  const handleClearDownloads = () => {
    setClearingDownloads(true);
    setConfirmClearType(null);
    const before = downloadsSize;
    try {
      purgeStorageKeys(DOWNLOAD_KEY_PREFIXES);
      refreshUsage();
      setFreedTotalMb((prev) => Number((prev + before).toFixed(2)));
      showToast(`Téléchargements locaux effacés (${before.toFixed(2)} Mo)`);
    } finally {
      setClearingDownloads(false);
    }
  };

  const handleClearDrafts = () => {
    setClearingDrafts(true);
    setConfirmClearType(null);
    const before = draftsSize;
    try {
      purgeStorageKeys(DRAFT_KEY_PREFIXES);
      refreshUsage();
      setFreedTotalMb((prev) => Number((prev + before).toFixed(2)));
      showToast(`Brouillons locaux effacés (${before.toFixed(2)} Mo)`);
    } finally {
      setClearingDrafts(false);
    }
  };

  const totalUsedMb = Number((cacheSize + downloadsSize + draftsSize + appStateSize).toFixed(2));
  const scaleMax = Math.max(1, totalUsedMb);

  return (
    <div
      id="free-up-space-settings-screen"
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
            Libérer de l'espace
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-16 p-4 space-y-6">
        {/* STORAGE GAUGE HERO */}
        <div className="p-5 bg-gradient-to-br from-[#181818] to-[#101010] border border-white/10 rounded-3xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FF6321]/20 flex items-center justify-center text-[#FF6321] flex-shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Stockage navigateur Djassa</p>
                <p className="text-[11px] text-white/50">{totalUsedMb.toFixed(2)} Mo mesurés sur cet appareil</p>
              </div>
            </div>
            {freedTotalMb > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                +{freedTotalMb.toFixed(2)} Mo libérés
              </span>
            )}
          </div>

          {/* Multi-segment progress bar */}
          <div className="space-y-1.5">
            <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${Math.min(100, (cacheSize / scaleMax) * 100)}%` }}
                className="bg-[#FF6321] transition-all duration-500"
                title="Cache vidéo"
              />
              <div
                style={{ width: `${Math.min(100, (downloadsSize / scaleMax) * 100)}%` }}
                className="bg-amber-400 transition-all duration-500"
                title="Téléchargements"
              />
              <div
                style={{ width: `${Math.min(100, (draftsSize / scaleMax) * 100)}%` }}
                className="bg-indigo-400 transition-all duration-500"
                title="Brouillons"
              />
              <div
                style={{ width: `${Math.min(100, (appStateSize / scaleMax) * 100)}%` }}
                className="bg-white/20 transition-all duration-500"
                title="Session et préférences"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-white/40 pt-1">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#FF6321]" /> Cache ({cacheSize.toFixed(2)} Mo)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Téléchargements ({downloadsSize.toFixed(2)} Mo)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-white/20" /> Compte ({appStateSize.toFixed(2)} Mo)
              </span>
            </div>
          </div>
        </div>

        {/* ITEMS LIST */}
        <div className="bg-[#121212] border border-white/5 rounded-3xl divide-y divide-white/5 overflow-hidden">
          {/* 1. CACHE */}
          <div className="p-4 flex items-center justify-between">
            <div className="space-y-0.5 max-w-[70%]">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white">Cache temporaire</p>
                <span className="text-xs font-bold text-white/40">{cacheSize.toFixed(2)} Mo</span>
              </div>
              <p className="text-[11px] text-white/50 leading-relaxed">
                Vidéos préchargées et miniatures en cache local. Ne supprime ni votre compte ni votre historique serveur.
              </p>
            </div>

            <button
              onClick={() => setConfirmClearType('cache')}
              disabled={clearingCache}
              className="px-4 py-2 rounded-2xl text-xs font-bold transition active:scale-95 bg-white/10 hover:bg-red-500/20 text-white hover:text-red-400 border border-white/5 disabled:opacity-50"
            >
              {clearingCache ? 'Nettoyage...' : 'Effacer'}
            </button>
          </div>

          {/* 2. TÉLÉCHARGEMENTS */}
          <div className="p-4 flex items-center justify-between">
            <div className="space-y-0.5 max-w-[70%]">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white">Téléchargements locaux</p>
                <span className="text-xs font-bold text-white/40">{downloadsSize.toFixed(2)} Mo</span>
              </div>
              <p className="text-[11px] text-white/50 leading-relaxed">
                Reçus et fiches enregistrés localement pour consultation hors ligne.
              </p>
            </div>

            <button
              onClick={() => setConfirmClearType('downloads')}
              disabled={downloadsSize === 0 || clearingDownloads}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition active:scale-95 ${
                downloadsSize === 0
                  ? 'bg-white/5 text-white/30 cursor-not-allowed'
                  : 'bg-white/10 hover:bg-red-500/20 text-white hover:text-red-400 border border-white/5'
              }`}
            >
              {clearingDownloads ? 'Suppression...' : downloadsSize === 0 ? 'Vide' : 'Effacer'}
            </button>
          </div>

          {/* 3. BROUILLONS */}
          <div className="p-4 flex items-center justify-between">
            <div className="space-y-0.5 max-w-[70%]">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white">Brouillons locaux</p>
                <span className="text-xs font-bold text-white/40">{draftsSize.toFixed(2)} Mo</span>
              </div>
              <p className="text-[11px] text-white/50 leading-relaxed">
                Brouillons d'avis et de commentaires conservés sur votre appareil avant envoi.
              </p>
            </div>

            <button
              onClick={() => setConfirmClearType('drafts')}
              disabled={draftsSize === 0 || clearingDrafts}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition active:scale-95 ${
                draftsSize === 0
                  ? 'bg-white/5 text-white/30 cursor-not-allowed'
                  : 'bg-white/10 hover:bg-red-500/20 text-white hover:text-red-400 border border-white/5'
              }`}
            >
              {clearingDrafts ? 'Effacement...' : draftsSize === 0 ? 'Vide' : 'Effacer'}
            </button>
          </div>
        </div>
      </main>

      {/* CONFIRMATION MODAL */}
      {confirmClearType && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
          onClick={() => setConfirmClearType(null)}
        >
          <div
            className="w-full max-w-sm mx-auto bg-[#181818] rounded-3xl border border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">
                {confirmClearType === 'cache'
                  ? 'Vider le cache temporaire ?'
                  : confirmClearType === 'downloads'
                  ? 'Supprimer les téléchargements locaux ?'
                  : 'Effacer les brouillons locaux ?'}
              </h3>
              <p className="text-xs text-white/60 mt-1">
                {confirmClearType === 'cache'
                  ? 'Cette action purge les caches mémoire et navigateur temporaires sans supprimer votre compte, vos commandes ni votre historique serveur.'
                  : confirmClearType === 'downloads'
                  ? 'Les reçus locaux supprimés resteront accessibles depuis votre centre de commandes.'
                  : 'Les brouillons non publiés seront définitivement supprimés de cet appareil.'}
              </p>
            </div>

            <div className="flex gap-2 pt-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setConfirmClearType(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white transition active:scale-95"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmClearType === 'cache') void handleClearCache();
                  else if (confirmClearType === 'downloads') handleClearDownloads();
                  else handleClearDrafts();
                }}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 transition active:scale-95"
              >
                Effacer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
