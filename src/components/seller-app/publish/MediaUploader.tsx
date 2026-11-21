import React, { useRef } from 'react';
import { 
  Upload, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  X, 
  Star, 
  Camera, 
  Play, 
  Film,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

interface Props {
  mode: 'photo' | 'video';
  mediaUrls: string[];
  coverIndex: number;
  onAddMedia: (url: string) => void;
  onRemoveMedia: (index: number) => void;
  onSetCover: (index: number) => void;
  videoUrl?: string;
  onSetVideoUrl?: (url: string) => void;
}

const SAMPLE_DEMO_IMAGES = [
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&auto=format&fit=crop&q=80',
];

const SAMPLE_DEMO_VIDEOS = [
  'https://assets.mixkit.co/videos/preview/mixkit-woman-shopping-for-clothes-in-a-store-41549-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-holding-a-modern-smartphone-with-a-blank-green-screen-42984-large.mp4',
];

export const MediaUploader: React.FC<Props> = ({
  mode,
  mediaUrls,
  coverIndex,
  onAddMedia,
  onRemoveMedia,
  onSetCover,
  videoUrl,
  onSetVideoUrl,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const url = URL.createObjectURL(file);
        if (mode === 'video') {
          if (onSetVideoUrl) onSetVideoUrl(url);
        } else {
          onAddMedia(url);
        }
      }
    }
    e.target.value = '';
  };

  const handleUseDemo = () => {
    if (mode === 'video') {
      const demo = SAMPLE_DEMO_VIDEOS[Math.floor(Math.random() * SAMPLE_DEMO_VIDEOS.length)];
      if (onSetVideoUrl) onSetVideoUrl(demo);
    } else {
      SAMPLE_DEMO_IMAGES.forEach((url) => {
        if (!mediaUrls.includes(url)) {
          onAddMedia(url);
        }
      });
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        multiple={mode === 'photo'}
        accept={mode === 'video' ? 'video/*' : 'image/*'}
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {mode === 'video' ? (
            <VideoIcon className="w-4 h-4 text-[#FF6321]" />
          ) : (
            <ImageIcon className="w-4 h-4 text-[#FF6321]" />
          )}
          <span className="text-xs font-black text-white uppercase tracking-wider">
            {mode === 'video' ? 'Vidéo du Produit (Reel)' : `Photos du Produit (${mediaUrls.length}/8)`}
          </span>
        </div>
      </div>

      {/* VIDEO MODE */}
      {mode === 'video' ? (
        <div className="space-y-2">
          {videoUrl ? (
            <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/60 aspect-[9/12] max-h-[360px] mx-auto flex items-center justify-center group">
              <video
                src={videoUrl}
                controls
                className="w-full h-full object-cover"
                playsInline
              />
              <button
                type="button"
                onClick={() => onSetVideoUrl && onSetVideoUrl('')}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-black text-white transition z-10"
                title="Supprimer la vidéo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-10 px-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border-2 border-dashed border-white/15 hover:border-[#FF6321]/60 flex flex-col items-center justify-center cursor-pointer transition text-center group"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#FF6321]/15 text-[#FF6321] flex items-center justify-center mb-3 group-hover:scale-110 transition border border-[#FF6321]/30">
                <VideoIcon className="w-7 h-7" />
              </div>
              <p className="text-xs font-bold text-white">Importer ou filmer une vidéo</p>
              <p className="text-[10px] text-white/50 mt-1 max-w-[240px]">
                Format MP4 ou WebM vertical (9:16 recommandé), démonstration du produit en direct
              </p>
              <span className="mt-3 px-3 py-1.5 rounded-xl bg-white/10 group-hover:bg-[#FF6321] text-white text-[10px] font-bold transition">
                Choisir la vidéo
              </span>
            </div>
          )}
        </div>
      ) : (
        /* PHOTO MODE */
        <div className="space-y-3">
          {/* Photos Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {mediaUrls.map((url, idx) => {
              const isCover = idx === coverIndex;
              return (
                <div
                  key={idx}
                  className={`relative aspect-square rounded-2xl overflow-hidden border-2 group bg-neutral-900 ${
                    isCover ? 'border-[#FF6321] ring-2 ring-[#FF6321]/20' : 'border-white/10'
                  }`}
                >
                  <img
                    src={url}
                    alt={`Photo ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />

                  {/* Cover badge */}
                  {isCover && (
                    <div className="absolute top-1 left-1 bg-[#FF6321] text-white text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5 fill-white" />
                      <span>Couverture</span>
                    </div>
                  )}

                  {/* Hover actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 transition">
                    {!isCover && (
                      <button
                        type="button"
                        onClick={() => onSetCover(idx)}
                        className="p-1.5 rounded-lg bg-white/20 hover:bg-[#FF6321] text-white transition"
                        title="Définir comme photo principale"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveMedia(idx)}
                      className="p-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white transition"
                      title="Supprimer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Add Photo Button Tile */}
            {mediaUrls.length < 8 && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border-2 border-dashed border-white/15 hover:border-[#FF6321] flex flex-col items-center justify-center cursor-pointer transition group"
              >
                <Upload className="w-5 h-5 text-white/40 group-hover:text-[#FF6321] group-hover:scale-110 transition mb-1" />
                <span className="text-[10px] font-bold text-white/60 group-hover:text-white">
                  + Ajouter
                </span>
              </div>
            )}
          </div>

          {mediaUrls.length === 0 && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="py-8 px-4 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-center cursor-pointer hover:bg-white/[0.04] transition"
            >
              <Camera className="w-8 h-8 text-white/30 mx-auto mb-2" />
              <p className="text-xs font-bold text-white/80">Aucune photo sélectionnée</p>
              <p className="text-[10px] text-white/40 mt-0.5">
                Prenez des photos sous plusieurs angles pour rassurer les acheteurs
              </p>
            </div>
          )}

          {mediaUrls.length > 0 && (
            <p className="text-[10px] text-white/45 flex items-center gap-1">
              <Star className="w-3 h-3 text-[#FF6321]" />
              <span>Survolez une photo pour la désigner comme couverture principale ou la retirer.</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};
