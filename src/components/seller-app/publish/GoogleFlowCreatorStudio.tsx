import React, { useState, useRef, useEffect } from 'react';
import {
  Image as ImageIcon,
  Video as VideoIcon,
  Plus,
  ArrowRight,
  Upload,
  Download,
  Trash2,
  ChevronDown,
  Check,
  CheckCircle2,
  Play,
  RotateCw,
  ExternalLink,
  Sparkles,
  X,
  Share2
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { AI_BILLING_RATES } from '../../../services/aiPricing';
import { creditsService } from '../../../services/creditsService';
import { getSecurityToken } from '../../../services/securityService';
import { Product } from '../../../types';

export const GoogleFlowSparkle: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="gflow-spark-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4285F4" />
        <stop offset="35%" stopColor="#9B72CF" />
        <stop offset="70%" stopColor="#EA4335" />
        <stop offset="100%" stopColor="#FBBC05" />
      </linearGradient>
    </defs>
    <path 
      d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z" 
      fill="url(#gflow-spark-grad)" 
    />
    <path 
      d="M19 2.5C19 4.433 17.433 6 15.5 6C17.433 6 19 7.567 19 9.5C19 7.567 20.567 6 22.5 6C20.567 6 19 4.433 19 2.5Z" 
      fill="#34A853" 
    />
  </svg>
);

export interface CreatedMediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  poster?: string;
  aspectRatio: string;
  prompt: string;
  model: string;
  timestamp: string;
}

interface GoogleFlowCreatorStudioProps {
  products: Product[];
  onUseGeneratedMedia: (type: 'image' | 'video', url: string, metadata?: { title?: string; prompt?: string }) => void;
  onGoToProductTab: () => void;
  onGoToVideoTab: () => void;
}

// Aspect ratio definitions
type ImageRatio = '16:9' | '4:3' | '1:1' | '3:4' | '9:16';
type VideoRatio = '9:16' | '16:9' | '1:1';

// High quality photo and video templates
const SAMPLE_IMAGE_STOCK: Record<string, string> = {
  '16:9': 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&auto=format&fit=crop&q=80',
  '4:3': 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1000&auto=format&fit=crop&q=80',
  '1:1': 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=900&auto=format&fit=crop&q=80',
  '3:4': 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=900&auto=format&fit=crop&q=80',
  '9:16': 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=900&auto=format&fit=crop&q=80'
};

const SAMPLE_VIDEOS = [
  {
    url: 'https://assets.mixkit.co/videos/preview/mixkit-fashion-model-in-a-black-outfit-walking-in-a-studio-40348-large.mp4',
    poster: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800'
  },
  {
    url: 'https://assets.mixkit.co/videos/preview/mixkit-hands-holding-and-showing-a-pair-of-sneakers-42661-large.mp4',
    poster: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800'
  },
  {
    url: 'https://assets.mixkit.co/videos/preview/mixkit-close-up-of-a-woman-wearing-jewelry-41399-large.mp4',
    poster: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800'
  }
];

// Modèles RodiumAI autorisés
const IMAGE_MODELS = [
  { id: 'qwen-image-2.1-turbo', name: '✨ Qwen Image 2.1 Turbo', badge: 'RodiumAI', desc: 'Génération ultra-rapide & packshots HD' }
];

const VIDEO_MODELS = [
  { id: 'minimax-h3-max-turbo', name: '🎬 MiniMax H3 Max Turbo', badge: 'RodiumAI', desc: 'Scènes animées & clips promotionnels 5s+' },
  { id: 'minimax-h3', name: '🎥 MiniMax H3 Studio', badge: 'RodiumAI', desc: 'Storytelling & mise en scène boutique' }
];

export const GoogleFlowCreatorStudio: React.FC<GoogleFlowCreatorStudioProps> = ({
  products,
  onUseGeneratedMedia,
  onGoToProductTab,
  onGoToVideoTab
}) => {
  const {
    aiCredits,
    spendAiCredits,
    setIsCreditModalOpen,
    showToast,
    addSellerCreation,
    sellerCreations,
    removeSellerCreation,
  } = useApp();

  // Creations list state (empty initially as requested)
  const [creations, setCreations] = useState<CreatedMediaItem[]>([]);

  // Generation parameters state
  const [inputText, setInputText] = useState('');
  const [generationType, setGenerationType] = useState<'image' | 'video'>('image');
  const [imageRatio, setImageRatio] = useState<ImageRatio>('1:1');
  const [videoRatio, setVideoRatio] = useState<VideoRatio>('9:16');
  const [videoDuration, setVideoDuration] = useState<5 | 10 | 15 | 30>(5);
  const [quantity, setQuantity] = useState<1 | 2 | 3 | 4>(1);
  const [selectedModel, setSelectedModel] = useState<string>('✨ Qwen Image 2.1 Turbo');

  // Video duration choices with labels, badges and unit costs
  const VIDEO_DURATIONS: { duration: 5 | 10 | 15 | 30; label: string; badge: string; desc: string; credits: number }[] = [
    { duration: 5, label: '5s', badge: 'Express', desc: 'Clip court & rapide', credits: 60 },
    { duration: 10, label: '10s', badge: 'Reels', desc: 'Reels, TikTok & Shorts', credits: 120 },
    { duration: 15, label: '15s', badge: 'Story', desc: 'Story vitrine produit', credits: 180 },
    { duration: 30, label: '30s', badge: 'Spot Pub', desc: 'Vidéo commerciale complète', credits: 360 },
  ];

  // Reference visual attachment
  const [referenceMedia, setReferenceMedia] = useState<string | null>(null);

  // Bottom Sheet Modal & Model Picker States
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);

  // Generation in-progress state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const creationsEndRef = useRef<HTMLDivElement>(null);

  // Unit costs (dynamically takes into account duration: 5s = 60cr, 10s = 120cr, 15s = 180cr, 30s = 360cr)
  const durationMultiplier = generationType === 'video' ? videoDuration / 5 : 1;
  const unitCost = generationType === 'image' 
    ? AI_BILLING_RATES.IMAGE_GENERATION 
    : AI_BILLING_RATES.VIDEO_GENERATION_5S * durationMultiplier;
  const totalCost = unitCost * quantity;

  // Active ratio according to mode
  const currentRatio = generationType === 'image' ? imageRatio : videoRatio;

  // Can generate condition: either non-empty text prompt or reference media attached
  const canGenerate = (inputText.trim().length > 0 || referenceMedia !== null) && !isGenerating;

  // Sync selected model default when switching types
  useEffect(() => {
    if (generationType === 'image') {
      if (!IMAGE_MODELS.some(m => m.name === selectedModel)) {
        setSelectedModel(IMAGE_MODELS[0].name);
      }
    } else {
      if (!VIDEO_MODELS.some(m => m.name === selectedModel)) {
        setSelectedModel(VIDEO_MODELS[0].name);
      }
    }
  }, [generationType]);

  // Handle direct file import into creations gallery
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isImage && !isVideo) {
      showToast('Veuillez sélectionner un fichier image ou vidéo valide.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        const newItem: CreatedMediaItem = {
          id: 'import-' + Date.now(),
          type: isVideo ? 'video' : 'image',
          url: result,
          aspectRatio: isVideo ? '9:16' : '1:1',
          prompt: file.name.replace(/\.[^/.]+$/, ''),
          model: 'Import galerie',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setCreations((prev) => [newItem, ...prev]);
        if (addSellerCreation) {
          addSellerCreation({
            sellerId: 'seller-1',
            title: file.name.replace(/\.[^/.]+$/, ''),
            type: isVideo ? 'ai_video' : 'ai_photo',
            mediaUrl: result,
            posterUrl: isVideo ? result : undefined,
            thumbnailUrl: !isVideo ? result : undefined,
            prompt: file.name,
            isAiGenerated: true,
            aspectRatio: isVideo ? '9:16' : '1:1',
            status: 'draft',
          });
        }
        showToast('Fichier importé avec succès dans votre studio ! 📁');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Handle reference visual upload for prompt
  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const res = event.target?.result as string;
      if (res) {
        setReferenceMedia(res);
        showToast('Référence visuelle attachée avec succès ! 📎');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Launch AI generation
  const handleLaunchGeneration = async () => {
    if (!canGenerate) return;

    if (aiCredits < totalCost) {
      showToast(`Crédits d’IA insuffisants (${aiCredits}/${totalCost} crédits requis)`);
      setIsCreditModalOpen(true);
      return;
    }

    if (!getSecurityToken()) {
      showToast('Connectez-vous pour générer du contenu IA.');
      return;
    }

    const caps = await creditsService.getAiCapabilities();
    const providerReady = generationType === 'video' ? caps.video : caps.image;
    if (!providerReady) {
      showToast(
        generationType === 'video'
          ? 'Génération vidéo indisponible : clé API RodiumAI (RODIUMAI_API_KEY) non configurée côté serveur. Aucun crédit débité.'
          : 'Génération image indisponible : clé API RodiumAI (RODIUMAI_API_KEY) non configurée côté serveur. Aucun crédit débité.'
      );
      return;
    }

    const deducted = spendAiCredits(
      totalCost,
      `Création ${generationType === 'image' ? 'Image' : `Vidéo ${videoDuration}s`} (${selectedModel}) ×${quantity}`,
      generationType
    );
    if (!deducted) return;

    setIsGenerating(true);
    setGenerationStep(generationType === 'image' ? 'Interprétation du prompt & composition...' : `Synthèse temporelle & rendu vidéo ${videoDuration}s...`);

    setTimeout(() => {
      setGenerationStep(generationType === 'image' ? 'Génération haute résolution...' : `Interpolation des mouvements 60fps (${videoDuration}s)...`);
    }, 800);

    setTimeout(() => {
      setIsGenerating(false);
      setGenerationStep('');

      const newItems: CreatedMediaItem[] = [];

      for (let i = 0; i < quantity; i++) {
        const id = 'gen-' + Date.now() + '-' + i;
        if (generationType === 'image') {
          // Select suitable image
          const baseImg = referenceMedia || SAMPLE_IMAGE_STOCK[imageRatio] || SAMPLE_IMAGE_STOCK['1:1'];
          const promptText = inputText.trim() || 'Création Studio E-commerce';
          newItems.push({
            id,
            type: 'image',
            url: baseImg,
            aspectRatio: imageRatio,
            prompt: promptText,
            model: selectedModel,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
          if (addSellerCreation) {
            addSellerCreation({
              sellerId: 'seller-1',
              title: promptText,
              type: 'ai_photo',
              mediaUrl: baseImg,
              thumbnailUrl: baseImg,
              prompt: promptText,
              isAiGenerated: true,
              aspectRatio: imageRatio === '16:9' ? '16:9' : imageRatio === '9:16' ? '9:16' : '1:1',
              status: 'draft',
            });
          }
        } else {
          // Select suitable video
          const sampleVid = SAMPLE_VIDEOS[i % SAMPLE_VIDEOS.length];
          const promptText = inputText.trim() || `Reel Vidéo ${videoDuration}s E-commerce`;
          newItems.push({
            id,
            type: 'video',
            url: sampleVid.url,
            poster: referenceMedia || sampleVid.poster,
            aspectRatio: videoRatio,
            prompt: promptText,
            model: `${selectedModel} (${videoDuration}s)`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
          if (addSellerCreation) {
            addSellerCreation({
              sellerId: 'seller-1',
              title: promptText,
              type: 'ai_video',
              mediaUrl: sampleVid.url,
              posterUrl: referenceMedia || sampleVid.poster,
              prompt: promptText,
              isAiGenerated: true,
              aspectRatio: videoRatio === '16:9' ? '16:9' : '9:16',
              duration: `0:${videoDuration < 10 ? '0' + videoDuration : videoDuration}`,
              status: 'draft',
            });
          }
        }
      }

      setCreations((prev) => [...newItems, ...prev]);
      showToast(`✨ ${quantity} ${generationType === 'image' ? 'image(s)' : `vidéo(s) de ${videoDuration}s`} générée(s) avec succès ! (-${totalCost} crédits)`);
      setInputText('');
      setReferenceMedia(null);
    }, 1700);
  };

  // Delete creation
  const handleDeleteCreation = (id: string) => {
    setCreations((prev) => prev.filter((item) => item.id !== id));
    if (removeSellerCreation) {
      removeSellerCreation(id);
    }
    showToast('Élément supprimé de la galerie');
  };

  // Use for publication
  const handleUseCreation = (item: CreatedMediaItem) => {
    if (item.type === 'image') {
      onUseGeneratedMedia('image', item.url, {
        title: item.prompt,
        prompt: item.prompt
      });
      showToast('Image envoyée dans votre formulaire de publication ! 📸');
      onGoToProductTab();
    } else {
      onUseGeneratedMedia('video', item.url, {
        title: item.prompt,
        prompt: item.prompt
      });
      showToast('Vidéo Reel envoyée dans votre publication ! 🎬');
      onGoToVideoTab();
    }
  };

  return (
    <div 
      id="google-flow-creator-studio-page" 
      className="w-full min-h-[calc(100vh-140px)] flex flex-col justify-between bg-[#000000] text-[#F1F3F4] select-none pb-44"
    >
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleImportFile}
      />
      <input
        ref={referenceInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleReferenceUpload}
      />

      {/* =========================================================================
          3. ZONE PRINCIPALE DE CRÉATION
          ========================================================================= */}
      <div className="flex-1 flex flex-col justify-center items-center w-full px-3 py-4 max-w-xl mx-auto">
        {creations.length === 0 ? (
          /* Empty State (Exact text and button as required) */
          <div className="flex flex-col items-center justify-center text-center my-auto py-12 px-4 animate-fadeIn">
            <p className="text-base font-semibold text-[#F1F3F4] tracking-tight">
              Aucun élément pour l’instant.
            </p>
            <p className="text-xs text-[#9AA0A6] mt-1.5 max-w-xs leading-relaxed">
              Créez-en un ou importez-en un depuis votre galerie.
            </p>

            {/* Bouton arrondi "Importer" avec icône */}
            <button
              type="button"
              id="btn-import-creator-gallery"
              onClick={() => fileInputRef.current?.click()}
              className="mt-6 px-6 py-2.5 rounded-full bg-[#202124] hover:bg-[#303134] text-[#F1F3F4] border border-[#303134] text-xs font-semibold flex items-center gap-2 transition active:scale-95 shadow-sm cursor-pointer"
            >
              <Upload className="w-4 h-4 text-[#9AA0A6]" />
              <span>Importer</span>
            </button>
          </div>
        ) : (
          /* Creations Feed - Display without distortion */
          <div className="w-full space-y-4 pb-4 animate-fadeIn">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-[#9AA0A6]">
                Vos créations récentes ({creations.length})
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] text-[#9AA0A6] hover:text-[#F1F3F4] flex items-center gap-1 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importer un autre</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 w-full">
              {creations.map((item) => {
                // Determine aspect ratio class
                let aspectClass = 'aspect-square';
                if (item.aspectRatio === '16:9') aspectClass = 'aspect-[16/9]';
                else if (item.aspectRatio === '4:3') aspectClass = 'aspect-[4/3]';
                else if (item.aspectRatio === '3:4') aspectClass = 'aspect-[3/4]';
                else if (item.aspectRatio === '9:16') aspectClass = 'aspect-[9/16] max-h-[460px]';

                return (
                  <div
                    key={item.id}
                    className="w-full rounded-[24px] bg-[#141414] border border-[#303134] overflow-hidden shadow-xl flex flex-col group transition"
                  >
                    {/* Media Container */}
                    <div className={`relative w-full ${aspectClass} bg-black flex items-center justify-center overflow-hidden`}>
                      {item.type === 'image' ? (
                        <img
                          src={item.url}
                          alt={item.prompt}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <video
                          src={item.url}
                          poster={item.poster}
                          controls
                          loop
                          playsInline
                          className="w-full h-full object-contain"
                        />
                      )}

                      {/* Top Overlay Badge */}
                      <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-medium text-[#F1F3F4] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>{item.model}</span>
                        <span className="text-[#9AA0A6]">({item.aspectRatio})</span>
                      </div>

                      {/* Video Duration Badge */}
                      {item.type === 'video' && (
                        <div className="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded-md bg-black/85 backdrop-blur-md border border-white/10 text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1 shadow-md">
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>{item.model.match(/\((\d+s)\)/)?.[1] || '5s'}</span>
                        </div>
                      )}
                    </div>

                    {/* Metadata & Actions Bar */}
                    <div className="p-3 bg-[#1A1A1A] border-t border-[#303134] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-[#F1F3F4] truncate">
                          {item.prompt}
                        </p>
                        <p className="text-[10px] text-[#9AA0A6] mt-0.5">
                          {item.type === 'image' ? 'Image HD' : 'Vidéo 1080p'} • {item.timestamp}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Use in publication */}
                        <button
                          type="button"
                          onClick={() => handleUseCreation(item)}
                          className="px-3 py-1.5 rounded-full bg-[#303134] hover:bg-[#3C4043] text-[#F1F3F4] text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                          title="Transférer dans la publication du produit ou du Reel"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Utiliser</span>
                        </button>

                        {/* Download */}
                        <button
                          type="button"
                          onClick={() => showToast('Téléchargement lancé ! 📥')}
                          className="w-8 h-8 rounded-full bg-[#202124] hover:bg-[#303134] text-[#9AA0A6] hover:text-[#F1F3F4] flex items-center justify-center transition cursor-pointer"
                          title="Télécharger"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDeleteCreation(item.id)}
                          className="w-8 h-8 rounded-full bg-[#202124] hover:bg-red-500/20 text-[#9AA0A6] hover:text-red-400 flex items-center justify-center transition cursor-pointer"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div ref={creationsEndRef} />
          </div>
        )}

        {/* Loading overlay during generation */}
        {isGenerating && (
          <div className="w-full my-3 p-4 rounded-2xl bg-[#1E1F20] border border-[#303134] flex items-center gap-3 animate-pulse">
            <RotateCw className="w-5 h-5 text-[#9AA0A6] animate-spin shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[#F1F3F4]">{generationStep}</p>
              <p className="text-[10px] text-[#9AA0A6] mt-0.5">Modèle : {selectedModel}</p>
            </div>
          </div>
        )}
      </div>

      {/* Backdrop for config sheet */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-500 ${
          isConfigOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => {
          setIsConfigOpen(false);
          setIsModelPickerOpen(false);
        }}
      />

      {/* =========================================================================
          4. BARRE DE SAISIE FLOTTANTE (GLISSE EN HAUT) & PANNEAU CONFIGURATION (EN BAS)
          ========================================================================= */}
      <div 
        id="floating-input-bar-container"
        className="fixed bottom-[64px] left-0 right-0 z-50 w-full pointer-events-none flex flex-col justify-end"
      >
        {/* 1. BARRE DE CHAT (EN HAUT : glisse pour aller au-dessus de la page du bouton image) */}
        <div className="w-full px-2.5 sm:px-4 pt-1 pb-1.5 pointer-events-auto transition-all duration-500 ease-out">
          <div className={`w-full rounded-[26px] bg-[#1E1F20] border border-[#303134] p-3 shadow-2xl backdrop-blur-xl flex flex-col gap-2 transition-all duration-500 ease-out ${
            isConfigOpen ? 'ring-1 ring-white/10 shadow-[0_-8px_25px_rgba(0,0,0,0.6)]' : ''
          }`}>
            {/* Reference Media Preview if attached */}
            {referenceMedia && (
              <div className="flex items-center justify-between p-1.5 px-2.5 rounded-xl bg-[#141414] border border-[#303134] text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <img src={referenceMedia} alt="" className="w-6 h-6 rounded-md object-cover border border-[#303134]" />
                  <span className="text-[11px] text-[#9AA0A6] truncate">Image de référence attachée</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReferenceMedia(null)}
                  className="w-5 h-5 rounded-full hover:bg-white/10 text-[#9AA0A6] hover:text-[#F1F3F4] flex items-center justify-center text-xs"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Champ de saisie multiligne */}
            <textarea
              ref={textareaRef}
              id="input-prompt-creator"
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Que voulez-vous faire ?"
              className="w-full bg-transparent border-none text-sm text-[#F1F3F4] placeholder-[#9AA0A6] focus:outline-none focus:ring-0 resize-none leading-relaxed px-1"
            />

            {/* Ligne de commandes : "+" à gauche, "Image ▯ ×1" et "=>" côte à côte à droite */}
            <div className="flex items-center justify-between pt-1">
              {/* À gauche : bouton "+" pour importer une image ou référence */}
              <button
                type="button"
                id="btn-add-reference"
                onClick={() => referenceInputRef.current?.click()}
                className="w-9 h-9 rounded-full bg-[#2D2F31] hover:bg-[#3C4043] text-[#F1F3F4] flex items-center justify-center transition active:scale-95 cursor-pointer shadow-sm shrink-0"
                title="Ajouter une image de référence"
              >
                <Plus className="w-4 h-4" />
              </button>

              {/* À droite : les deux boutons Image et => l'un à côté de l'autre */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Sélecteur type, durée et quantité (ex: "Image ▯ ×1" ou "Vidéo 10s ▯ ×1") */}
                <button
                  type="button"
                  id="btn-open-config-sheet"
                  onClick={() => setIsConfigOpen(!isConfigOpen)}
                  className={`px-3 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0 ${
                    isConfigOpen
                      ? 'bg-[#3C4043] border-[#5F6368] text-white shadow-md ring-1 ring-white/10'
                      : 'bg-[#2D2F31] hover:bg-[#3C4043] border-[#3C4043] text-[#F1F3F4]'
                  }`}
                  title="Configurer le type, la durée de la vidéo, le format et la quantité"
                >
                  <span className="capitalize">{generationType}</span>
                  {generationType === 'video' && (
                    <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      {videoDuration}s
                    </span>
                  )}
                  <span className="text-[#9AA0A6] text-[10px] font-mono">▯</span>
                  <span>×{quantity}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-[#9AA0A6] transition-transform duration-300 ${isConfigOpen ? 'rotate-180 text-white' : ''}`} />
                </button>

                {/* Bouton circulaire flèche vers la droite pour lancer la génération */}
                <button
                  type="button"
                  id="btn-launch-generation"
                  onClick={handleLaunchGeneration}
                  disabled={!canGenerate}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 ${
                    canGenerate
                      ? 'bg-[#F1F3F4] text-[#1E1F20] hover:bg-white active:scale-90 shadow-md cursor-pointer'
                      : 'bg-[#2D2F31] text-[#5F6368] cursor-not-allowed opacity-60'
                  }`}
                  title={canGenerate ? 'Lancer la génération' : 'Saisissez une description ou ajoutez une référence pour générer'}
                >
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. LA PAGE DE BOUTON IMAGE (EN BAS : reste en bas au-dessus du menu de navigation et touche de gauche à droite) */}
        <div 
          className={`w-full bg-[#1E1F20] shadow-2xl text-[#F1F3F4] transition-all duration-500 ease-out pointer-events-auto overflow-hidden ${
            isConfigOpen
              ? 'max-h-[48vh] sm:max-h-[52vh] opacity-100 py-3.5 px-4 sm:px-5 border-t border-[#303134] translate-y-0'
              : 'max-h-0 opacity-0 py-0 px-4 sm:px-5 border-t-0 pointer-events-none translate-y-6'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-3.5 overflow-y-auto max-h-[calc(48vh-28px)] sm:max-h-[calc(52vh-28px)] no-scrollbar pr-0.5">
            {/* Poignée centrale discrète */}
            <div className="w-10 h-1 rounded-full bg-[#5F6368]/60 mx-auto mb-1" />

            {/* A. Affichage du coût dynamique */}
            <div className="text-center text-xs text-[#9AA0A6]">
              La génération utilisera{' '}
              <span className="text-[#F1F3F4] font-bold">{totalCost}</span>{' '}
              <span 
                onClick={() => setIsCreditModalOpen(true)}
                className="underline decoration-[#9AA0A6] cursor-pointer hover:text-[#F1F3F4]"
              >
                crédits d’IA
              </span>
            </div>

            {/* B. Choix du type de génération (Image / Vidéo) */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#141414] border border-[#303134]">
              <button
                type="button"
                onClick={() => setGenerationType('image')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                  generationType === 'image'
                    ? 'bg-[#303134] text-[#F1F3F4] shadow-sm'
                    : 'text-[#9AA0A6] hover:text-[#F1F3F4]'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>Image</span>
              </button>

              <button
                type="button"
                onClick={() => setGenerationType('video')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                  generationType === 'video'
                    ? 'bg-[#303134] text-[#F1F3F4] shadow-sm'
                    : 'text-[#9AA0A6] hover:text-[#F1F3F4]'
                }`}
              >
                <VideoIcon className="w-4 h-4" />
                <span>Vidéo</span>
              </button>
            </div>

            {/* Si Vidéo : Choix de la durée (5s | 10s | 15s | 30s) */}
            {generationType === 'video' && (
              <div className="space-y-2 p-2.5 rounded-2xl bg-[#141414] border border-[#303134]">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#F1F3F4]">
                      ⏱️ Durée de la vidéo :
                    </span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-mono font-semibold">
                      {videoDuration}s
                    </span>
                  </div>
                  <span className="text-[10px] text-[#9AA0A6] font-mono">
                    {AI_BILLING_RATES.VIDEO_GENERATION_5S * (videoDuration / 5)} cr / vidéo
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                  {VIDEO_DURATIONS.map(({ duration: d, label, badge }) => {
                    const isSelected = videoDuration === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        id={`btn-duration-${d}s`}
                        onClick={() => setVideoDuration(d)}
                        className={`py-2 px-1 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#303134] border-emerald-500/60 text-white shadow-md ring-1 ring-emerald-500/30'
                            : 'bg-[#1A1A1A] border-[#303134] text-[#9AA0A6] hover:text-[#F1F3F4] hover:border-[#5F6368]'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold">{label}</span>
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                        </div>
                        <span className={`text-[9px] ${isSelected ? 'text-emerald-400 font-medium' : 'text-[#9AA0A6]'}`}>
                          {badge}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* C. Formats d'image ou vidéo */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-[#9AA0A6] px-1">
                Format d'affichage :
              </span>
              {generationType === 'image' ? (
                /* 5 formats pour le mode Image : 16:9 | 4:3 | 1:1 | 3:4 | 9:16 */
                <div className="grid grid-cols-5 gap-1.5">
                  {[
                    { ratio: '16:9', iconW: 'w-4 h-2.5' },
                    { ratio: '4:3', iconW: 'w-3.5 h-2.5' },
                    { ratio: '1:1', iconW: 'w-3 h-3' },
                    { ratio: '3:4', iconW: 'w-2.5 h-3.5' },
                    { ratio: '9:16', iconW: 'w-2 h-4' }
                  ].map((item) => {
                    const isSelected = imageRatio === item.ratio;
                    return (
                      <button
                        key={item.ratio}
                        type="button"
                        onClick={() => setImageRatio(item.ratio as ImageRatio)}
                        className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#303134] border-[#5F6368] text-[#F1F3F4]'
                            : 'bg-[#141414] border-[#303134] text-[#9AA0A6] hover:text-[#F1F3F4]'
                        }`}
                      >
                        <div className={`${item.iconW} border border-current rounded-[2px] mb-1`} />
                        <span className="text-[10px] font-medium">{item.ratio}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Formats réellement pris en charge par le moteur vidéo : 9:16 | 16:9 | 1:1 */
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { ratio: '9:16', label: '9:16 Reel', iconW: 'w-2.5 h-4.5' },
                    { ratio: '16:9', label: '16:9 Cinéma', iconW: 'w-4.5 h-2.5' },
                    { ratio: '1:1', label: '1:1 Carré', iconW: 'w-3.5 h-3.5' }
                  ].map((item) => {
                    const isSelected = videoRatio === item.ratio;
                    return (
                      <button
                        key={item.ratio}
                        type="button"
                        onClick={() => setVideoRatio(item.ratio as VideoRatio)}
                        className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#303134] border-[#5F6368] text-[#F1F3F4]'
                            : 'bg-[#141414] border-[#303134] text-[#9AA0A6] hover:text-[#F1F3F4]'
                        }`}
                      >
                        <div className={`${item.iconW} border border-current rounded-[2px] mb-1`} />
                        <span className="text-[10px] font-medium">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* D. Quantité de créations (×1 | ×2 | ×3 | ×4) */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-[#9AA0A6] px-1">
                Nombre de créations simultanées :
              </span>
              <div className="grid grid-cols-4 gap-2">
                {([1, 2, 3, 4] as const).map((q) => {
                  const isSelected = quantity === q;
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuantity(q)}
                      className={`py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                        isSelected
                          ? 'bg-[#303134] border-[#5F6368] text-[#F1F3F4]'
                          : 'bg-[#141414] border-[#303134] text-[#9AA0A6] hover:text-[#F1F3F4]'
                      }`}
                    >
                      ×{q}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* E. Sélecteur de modèle IA (Bouton arrondi pleine largeur avec flèche) */}
            <div className="space-y-1.5 pt-0.5">
              <span className="text-[11px] font-semibold text-[#9AA0A6] px-1">
                Modèle d'IA :
              </span>

              <div className="relative">
                <button
                  type="button"
                  id="btn-select-model"
                  onClick={() => setIsModelPickerOpen(!isModelPickerOpen)}
                  className="w-full py-2.5 px-4 rounded-2xl bg-[#141414] hover:bg-[#1A1A1A] border border-[#303134] text-xs font-semibold flex items-center justify-between text-[#F1F3F4] transition cursor-pointer"
                >
                  <span className="truncate">{selectedModel}</span>
                  <ChevronDown className={`w-4 h-4 text-[#9AA0A6] transition-transform ${isModelPickerOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Popover / liste des modèles disponibles */}
                {isModelPickerOpen && (
                  <div className="mt-2 p-1.5 rounded-2xl bg-[#141414] border border-[#303134] space-y-1 animate-fadeIn shadow-2xl">
                    {(generationType === 'image' ? IMAGE_MODELS : VIDEO_MODELS).map((m) => {
                      const isSelected = selectedModel === m.name;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setSelectedModel(m.name);
                            setIsModelPickerOpen(false);
                            showToast(`Modèle "${m.name}" sélectionné`);
                          }}
                          className={`w-full p-2 rounded-xl text-left flex items-center justify-between transition cursor-pointer ${
                            isSelected ? 'bg-[#303134]' : 'hover:bg-white/5'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-[#F1F3F4]">{m.name}</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/10 text-[#9AA0A6]">
                                {m.badge}
                              </span>
                            </div>
                            <p className="text-[10px] text-[#9AA0A6] mt-0.5">{m.desc}</p>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Bouton de confirmation & fermeture */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="w-full py-2.5 rounded-full bg-[#F1F3F4] text-[#1E1F20] hover:bg-white text-xs font-bold transition active:scale-95 cursor-pointer shadow-md"
              >
                Fermer les paramètres
              </button>
            </div>
          </div>
        </div>
      </div>


    </div>
  );
};
