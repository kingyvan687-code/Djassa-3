import React from 'react';
import { X, Download, Video, Image as ImageIcon } from 'lucide-react';

interface Props {
  mediaUrl: string | null;
  mediaType?: 'image' | 'video';
  onClose: () => void;
}

export const ImageViewerModal: React.FC<Props> = ({ mediaUrl, mediaType = 'image', onClose }) => {
  if (!mediaUrl) return null;

  const isVideo = mediaType === 'video' || mediaUrl.endsWith('.mp4') || mediaUrl.includes('sample/ForBigger');

  return (
    <div
      id="media-viewer-modal-backdrop"
      className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-between p-4 animate-fadeIn"
      onClick={onClose}
    >
      {/* Header controls */}
      <div className="w-full max-w-3xl flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          {isVideo ? (
            <Video className="w-4 h-4 text-purple-400" />
          ) : (
            <ImageIcon className="w-4 h-4 text-cyan-400" />
          )}
          <span className="text-xs font-bold text-white/80">
            {isVideo ? 'Lecteur Vidéo' : 'Aperçu de la photo'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Media container */}
      <div
        className="relative max-w-3xl max-h-[80vh] flex items-center justify-center p-2 w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo ? (
          <video
            src={mediaUrl}
            controls
            autoPlay
            playsInline
            className="max-h-[75vh] w-auto max-w-full rounded-2xl shadow-2xl border border-white/10"
          />
        ) : (
          <img
            src={mediaUrl}
            alt="Aperçu"
            className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
          />
        )}
      </div>

      {/* Footer controls */}
      <div className="flex items-center gap-3 pb-4">
        <a
          href={mediaUrl}
          download={isVideo ? 'djassa-video.mp4' : 'djassa-photo.jpg'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition border border-white/10"
        >
          <Download className="w-4 h-4 text-[#FF6321]" />
          <span>Télécharger {isVideo ? 'la vidéo' : 'la photo'}</span>
        </a>
      </div>
    </div>
  );
};

