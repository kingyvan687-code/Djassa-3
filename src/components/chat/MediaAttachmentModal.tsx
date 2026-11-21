import React, { useState, useRef } from 'react';
import { 
  X, 
  Image as ImageIcon, 
  Video, 
  Send
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSendMedia: (
    type: 'image' | 'video',
    mediaUrl: string,
    caption?: string,
    meta?: {
      mediaName?: string;
      mediaSize?: string;
      videoPoster?: string;
      videoDuration?: string;
    }
  ) => void;
  onOpenProductShare?: () => void;
  onShareLocation?: () => void;
  participantName: string;
}

export const MediaAttachmentModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSendMedia,
  participantName,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  // Process chosen file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadLocalFile(file);
  };

  const loadLocalFile = (file: File) => {
    const isVid = file.type.startsWith('video');
    const isImg = file.type.startsWith('image');

    if (!isVid && !isImg) {
      alert('Veuillez sélectionner un fichier image (JPG, PNG, WebP) ou vidéo (MP4, WebM, MOV).');
      return;
    }

    setSelectedFile(file);
    setMediaType(isVid ? 'video' : 'image');
    setFileName(file.name);
    setFileSize(formatSize(file.size));

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleSend = () => {
    if (!previewUrl) return;

    onSendMedia(
      mediaType,
      previewUrl,
      caption.trim() || undefined,
      {
        mediaName: fileName || (mediaType === 'video' ? 'video_djassa.mp4' : 'photo_djassa.jpg'),
        mediaSize: fileSize || '1.5 Mo',
        videoPoster: mediaType === 'video' ? 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800' : undefined,
        videoDuration: mediaType === 'video' ? '0:15' : undefined,
      }
    );

    // Reset and close
    setPreviewUrl(null);
    setSelectedFile(null);
    setCaption('');
    onClose();
  };

  const handleCancelPreview = () => {
    setPreviewUrl(null);
    setSelectedFile(null);
    setCaption('');
  };

  return (
    <div 
      id="media-attachment-drawer"
      className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex flex-col justify-end animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg mx-auto bg-[#141414] border-t border-white/15 rounded-t-3xl shadow-2xl overflow-hidden flex flex-col animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden native file inputs */}
        <input 
          ref={imageInputRef}
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={handleFileChange}
        />
        <input 
          ref={videoInputRef}
          type="file" 
          accept="video/*" 
          className="hidden" 
          onChange={handleFileChange}
        />

        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#181818]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#FF6321]/20 text-[#FF6321]">
              {mediaType === 'video' && previewUrl ? <Video className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-black text-white">
                {previewUrl ? 'Aperçu avant envoi' : 'Importer une image ou vidéo'}
              </h3>
              <p className="text-[11px] text-white/50">
                {previewUrl ? `Destinataire : ${participantName}` : 'Sélectionnez depuis votre téléphone ou galerie'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 overflow-y-auto space-y-4 no-scrollbar">
          {previewUrl ? (
            /* PREVIEW STATE */
            <div className="space-y-4 animate-fadeIn">
              {/* Media Container */}
              <div className="relative rounded-2xl overflow-hidden border border-white/15 bg-black/60 shadow-xl flex items-center justify-center max-h-[300px]">
                {mediaType === 'video' ? (
                  <video 
                    src={previewUrl} 
                    controls
                    autoPlay
                    playsInline
                    className="w-full max-h-[280px] object-contain rounded-xl"
                  />
                ) : (
                  <img 
                    src={previewUrl} 
                    alt="Aperçu importé"
                    className="w-full max-h-[280px] object-contain rounded-xl"
                  />
                )}

                {/* Badge File Info */}
                <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/15 text-[10px] font-bold text-white flex items-center gap-1.5 shadow">
                  {mediaType === 'video' ? <Video className="w-3.5 h-3.5 text-purple-400" /> : <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />}
                  <span className="truncate max-w-[140px]">{fileName}</span>
                  {fileSize && <span className="text-white/50">• {fileSize}</span>}
                </div>
              </div>

              {/* Caption input */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-white/70 block">
                  Légende ou message accompagnant le média :
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Ex : Voici l'article reçu, regardez la couture..."
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/15 rounded-xl text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF6321] transition"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCancelPreview}
                  className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition active:scale-95"
                >
                  Changer de fichier
                </button>

                <button
                  type="button"
                  onClick={handleSend}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#FF6321] to-[#ff7e47] hover:from-[#ff753b] hover:to-[#ff8d5c] text-white text-xs font-black shadow-lg shadow-[#FF6321]/30 transition flex items-center justify-center gap-2 active:scale-95"
                >
                  <Send className="w-4 h-4" />
                  <span>Envoyer {mediaType === 'video' ? 'la vidéo' : 'la photo'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* SELECTION STATE: Clean 2 buttons only */
            <div className="grid grid-cols-2 gap-3 py-2">
              {/* 1. Import Photo */}
              <button
                id="btn-import-photo-file"
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/15 via-blue-500/10 to-transparent border border-cyan-500/30 hover:border-cyan-400 text-left transition flex flex-col justify-between group active:scale-95 shadow-md hover:shadow-cyan-500/10"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition shadow-inner">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] font-black text-cyan-300 uppercase tracking-wider bg-cyan-500/20 px-2 py-0.5 rounded-full border border-cyan-500/30">
                    Galerie / Appareil
                  </span>
                </div>
                <div className="mt-4">
                  <h4 className="text-xs font-black text-white group-hover:text-cyan-200 transition">
                    Importer une Photo
                  </h4>
                  <p className="text-[10px] text-white/50 mt-0.5">
                    JPG, PNG, WEBP depuis votre appareil
                  </p>
                </div>
              </button>

              {/* 2. Import Video */}
              <button
                id="btn-import-video-file"
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/15 via-pink-500/10 to-transparent border border-purple-500/30 hover:border-purple-400 text-left transition flex flex-col justify-between group active:scale-95 shadow-md hover:shadow-purple-500/10"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-110 transition shadow-inner">
                    <Video className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] font-black text-purple-300 uppercase tracking-wider bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30">
                    Vidéo HD
                  </span>
                </div>
                <div className="mt-4">
                  <h4 className="text-xs font-black text-white group-hover:text-purple-200 transition">
                    Importer une Vidéo
                  </h4>
                  <p className="text-[10px] text-white/50 mt-0.5">
                    MP4, WebM, MOV avec son & lecteur
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
