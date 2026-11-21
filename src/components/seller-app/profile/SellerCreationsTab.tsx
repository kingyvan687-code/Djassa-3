import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Video as VideoIcon,
  Image as ImageIcon,
  Play,
  Share2,
  Download,
  Trash2,
  X,
  Volume2,
  VolumeX,
  Plus,
  Maximize2
} from 'lucide-react';
import { Seller, Product, SellerCreation } from '../../../types';
import { useApp } from '../../../context/AppContext';

interface Props {
  seller: Seller;
  photos?: Product[];
  videos?: Product[];
  onSelectProduct?: (product: Product) => void;
  onOpenVideoViewer?: (products: Product[], startId?: string) => void;
  onGoAddCreation?: () => void;
  showToast: (msg: string) => void;
}

type FilterType = 'all' | 'image' | 'video';

export const SellerCreationsTab: React.FC<Props> = ({
  seller,
  onGoAddCreation,
  showToast,
}) => {
  const { sellerCreations, removeSellerCreation } = useApp();

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedPreviewCreation, setSelectedPreviewCreation] = useState<SellerCreation | null>(null);
  const [isVideoMuted, setIsVideoMuted] = useState(true);

  // 1. Filtrer UNIQUEMENT les créations générées ou créées sur la page IA Creator
  const iaCreations = useMemo<SellerCreation[]>(() => {
    return (sellerCreations || []).filter(
      (c) =>
        (!c.sellerId || c.sellerId === seller.id) &&
        (c.isAiGenerated ||
          c.type === 'ai_video' ||
          c.type === 'ai_photo' ||
          (!c.productId && (c.type === 'video' || c.type === 'photo' || (c as { type: string }).type === 'image')))
    );
  }, [sellerCreations, seller.id]);

  // 2. Filtres par type de média (Images vs Vidéos)
  const imagesCount = iaCreations.filter(
    (c) => c.type === 'photo' || c.type === 'ai_photo' || (c as { type: string }).type === 'image'
  ).length;

  const videosCount = iaCreations.filter(
    (c) => c.type === 'video' || c.type === 'ai_video'
  ).length;

  const filteredCreations = useMemo(() => {
    if (activeFilter === 'image') {
      return iaCreations.filter(
        (c) => c.type === 'photo' || c.type === 'ai_photo' || (c as { type: string }).type === 'image'
      );
    }
    if (activeFilter === 'video') {
      return iaCreations.filter(
        (c) => c.type === 'video' || c.type === 'ai_video'
      );
    }
    return iaCreations;
  }, [iaCreations, activeFilter]);

  const handleDeleteCreation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Voulez-vous supprimer cette création de votre galerie ?')) {
      removeSellerCreation(id);
      if (selectedPreviewCreation?.id === id) {
        setSelectedPreviewCreation(null);
      }
      showToast('Création supprimée.');
    }
  };

  const handleShare = (creation: SellerCreation) => {
    navigator.clipboard?.writeText(creation.mediaUrl);
    showToast('Lien de la création copié ! 🔗');
  };

  const handleDownload = (creation: SellerCreation) => {
    const a = document.createElement('a');
    a.href = creation.mediaUrl;
    a.download = `djassa-ia-${creation.id}`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Téléchargement de la création démarré ! 📥');
  };

  return (
    <div id="seller-creations-container" className="w-full space-y-4 pb-12 animate-fadeIn">
      {/* 1. EN-TÊTE ÉPURÉ & FILTRES */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition shrink-0 cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-[#FF6321] text-white shadow-md shadow-orange-500/20'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10'
              }`}
            >
              Tout ({iaCreations.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('image')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition shrink-0 cursor-pointer ${
                activeFilter === 'image'
                  ? 'bg-[#FF6321] text-white shadow-md shadow-orange-500/20'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>Images ({imagesCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFilter('video')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition shrink-0 cursor-pointer ${
                activeFilter === 'video'
                  ? 'bg-[#FF6321] text-white shadow-md shadow-orange-500/20'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10'
              }`}
            >
              <VideoIcon className="w-3.5 h-3.5 text-purple-400" />
              <span>Vidéos ({videosCount})</span>
            </button>
          </div>
        </div>

        {onGoAddCreation && (
          <button
            type="button"
            onClick={onGoAddCreation}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-[#FF6321] hover:from-orange-600 hover:to-[#e05319] text-white text-xs font-bold transition shadow-sm cursor-pointer shrink-0 active:scale-95"
            title="Créer une nouvelle image ou vidéo sur IA Creator"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Créer sur IA Creator</span>
          </button>
        )}
      </div>

      {/* 2. GRILLE DES CRÉATIONS UNIQUEMENT (SANS PRIX, SANS J'AIME, SANS VUES) */}
      {filteredCreations.length === 0 ? (
        <div className="text-center py-16 px-4 bg-[#141416]/50 rounded-2xl border border-white/5 space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-white/5 flex items-center justify-center text-white/30">
            <Sparkles className="w-7 h-7 text-amber-400/60" />
          </div>
          <h3 className="text-base font-bold text-white">Aucune création IA pour le moment</h3>
          <p className="text-xs text-white/50 max-w-sm mx-auto">
            Les images et vidéos que vous créez sur la page IA Creator apparaîtront directement ici.
          </p>
          {onGoAddCreation && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onGoAddCreation}
                className="px-4 py-2 rounded-xl bg-[#FF6321] text-white text-xs font-bold flex items-center gap-2 mx-auto hover:bg-orange-600 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Ouvrir l&apos;IA Creator</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {filteredCreations.map((creation) => {
            const isVideo = creation.type === 'video' || creation.type === 'ai_video';

            return (
              <div
                key={creation.id}
                onClick={() => setSelectedPreviewCreation(creation)}
                className="group relative aspect-[3/4] sm:aspect-[9/16] rounded-2xl overflow-hidden bg-[#16161A] border border-white/10 hover:border-[#FF6321] transition-all duration-300 shadow-md cursor-pointer select-none"
              >
                {/* Visual Media */}
                {isVideo ? (
                  creation.posterUrl ? (
                    <img
                      src={creation.posterUrl}
                      alt={creation.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <video
                      src={creation.mediaUrl}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  )
                ) : (
                  <img
                    src={creation.thumbnailUrl || creation.mediaUrl}
                    alt={creation.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                )}

                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

                {/* Top media badge */}
                <div className="absolute top-2 left-2 z-10">
                  {isVideo ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-bold text-white border border-white/15">
                      <VideoIcon className="w-3 h-3 text-purple-400" />
                      <span>{creation.duration || 'Vidéo'}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-bold text-amber-300 border border-amber-500/30">
                      <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                      <span>Image IA</span>
                    </span>
                  )}
                </div>

                {/* Top right delete button */}
                <button
                  type="button"
                  onClick={(e) => handleDeleteCreation(e, creation.id)}
                  className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/70 hover:bg-rose-600 text-white/80 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow"
                  title="Supprimer cette création"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {/* Play button indicator for videos */}
                {isVideo && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center border border-white/20 group-hover:scale-110 group-hover:bg-[#FF6321] group-hover:border-[#FF6321] transition-all">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>
                )}

                {/* Bottom discreet prompt/title overlay */}
                <div className="absolute inset-x-0 bottom-0 p-2.5 z-10">
                  <p className="text-[11px] font-medium text-white/90 line-clamp-1">
                    {creation.prompt || creation.title}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. MODAL DE VISUALISATION PLEIN ÉCRAN DE LA CRÉATION */}
      {selectedPreviewCreation && (
        <div
          id="creation-preview-modal-overlay"
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
          onClick={() => setSelectedPreviewCreation(null)}
        >
          <div
            className="w-full max-w-lg max-h-[92vh] bg-[#16161A] border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-4 py-3 bg-[#1E1E24] border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white truncate max-w-[240px]">
                  {selectedPreviewCreation.prompt || selectedPreviewCreation.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreviewCreation(null)}
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white flex items-center justify-center transition cursor-pointer"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Media Body */}
            <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[300px] max-h-[60vh]">
              {selectedPreviewCreation.type === 'video' || selectedPreviewCreation.type === 'ai_video' ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <video
                    src={selectedPreviewCreation.mediaUrl}
                    poster={selectedPreviewCreation.posterUrl}
                    className="w-full h-full max-h-[60vh] object-contain"
                    autoPlay
                    loop
                    playsInline
                    muted={isVideoMuted}
                    controls
                  />
                  <button
                    type="button"
                    onClick={() => setIsVideoMuted(!isVideoMuted)}
                    className="absolute bottom-4 right-4 z-20 w-8 h-8 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-black transition active:scale-90"
                    title={isVideoMuted ? 'Activer le son' : 'Couper le son'}
                  >
                    {isVideoMuted ? (
                      <VolumeX className="w-4 h-4 text-white/70" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                    )}
                  </button>
                </div>
              ) : (
                <img
                  src={selectedPreviewCreation.mediaUrl}
                  alt={selectedPreviewCreation.title}
                  className="w-full h-full max-h-[60vh] object-contain"
                />
              )}
            </div>

            {/* Prompt footer if exists */}
            {selectedPreviewCreation.prompt && (
              <div className="px-4 py-2 bg-black/40 border-t border-white/5 text-[11px] text-white/70 flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="italic leading-snug line-clamp-2">
                  &ldquo;{selectedPreviewCreation.prompt}&rdquo;
                </p>
              </div>
            )}

            {/* Action Bar (Download, Share, Delete) - NO PRICES, NO LIKES */}
            <div className="px-4 py-3 bg-[#1A1A20] border-t border-white/10 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={(e) => handleDeleteCreation(e, selectedPreviewCreation.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Supprimer</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleShare(selectedPreviewCreation)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 hover:text-white transition active:scale-95 cursor-pointer"
                  title="Copier le lien"
                >
                  <Share2 className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDownload(selectedPreviewCreation)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 hover:text-white transition active:scale-95 cursor-pointer"
                  title="Télécharger le fichier"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
