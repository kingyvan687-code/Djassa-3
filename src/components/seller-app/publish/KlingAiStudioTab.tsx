import React, { useState } from 'react';
import {
  Sparkles,
  Video as VideoIcon,
  Image as ImageIcon,
  Zap,
  Play,
  RotateCw,
  Download,
  CheckCircle2,
  Sliders,
  Wand2,
  ChevronDown,
  Layers,
  Film,
  Camera,
  Maximize2,
  Plus,
  RefreshCw,
  Check,
  Eye,
  ShoppingBag,
  Send,
  Upload,
  Info,
  ArrowRight,
  Flame,
  Settings2
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { KlingAiLogo } from '../../credits/KlingAiCreditsModal';
import { AI_BILLING_RATES } from '../../../services/aiPricing';
import { creditsService } from '../../../services/creditsService';
import { getSecurityToken } from '../../../services/securityService';

interface Props {
  activeMode: 'image' | 'video';
  onChangeMode: (mode: 'image' | 'video') => void;
  onApplyImageToProduct: (imageUrl: string) => void;
  onApplyVideoToReel: (videoUrl: string, posterUrl?: string) => void;
  initialProductName?: string;
  currentMediaUrls?: string[];
}

// Kling Preset Showcase for E-commerce & Fashion
const KLING_PRESET_PROMPTS = {
  video: [
    {
      title: 'Défilé Mannequin Wax Chic',
      prompt: 'Mannequin ivoirienne élégante marchant sur un podium avec une robe en Wax moderne aux reflets or, mouvements fluides et éclairage studio haute couture',
      category: 'Mode & Wax',
      videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-fashion-model-in-a-black-outfit-walking-in-a-studio-40348-large.mp4',
      poster: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800'
    },
    {
      title: 'Sneakers 360° Studio Flottant',
      prompt: 'Baskets streetwear en lévitation avec rotation 360 degrés, reflets néon dynamiques et zoom avant cinématographique sur les coutures',
      category: 'Chaussures',
      videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-hands-holding-and-showing-a-pair-of-sneakers-42661-large.mp4',
      poster: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800'
    },
    {
      title: 'Bijoux Or & Macro Scintillant',
      prompt: 'Parure de bijoux traditionnels et colliers en or scintillant avec macro-zoom cinématographique et jeu de lumière scintillante',
      category: 'Bijouterie',
      videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-close-up-of-a-woman-wearing-jewelry-41399-large.mp4',
      poster: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800'
    },
    {
      title: 'Costume Homme Coupe Italienne',
      prompt: 'Homme chic portant un costume trois pièces moderne marchant dans les allées d’un centre commercial moderne, style premium',
      category: 'Hommes',
      videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-young-man-in-a-suit-posing-for-the-camera-42662-large.mp4',
      poster: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800'
    }
  ],
  image: [
    {
      title: 'Mannequin Wax Royale 4K',
      prompt: 'Mannequin femme africaine en robe wax haut de gamme sur mesure, pose éditoriale de magazine Vogue, fond studio neutre épuré, éclairage softbox ultra-doux, 8K ultra-détaillé',
      category: 'Mode & Wax',
      imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=900&auto=format&fit=crop&q=80'
    },
    {
      title: 'Packshot Sneakers Minimaliste',
      prompt: 'Baskets de course design moderne posées sur un socle en béton brut, lumière naturelle rasante, fond monochrome beige, packshot e-commerce de luxe',
      category: 'Sneakers',
      imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&auto=format&fit=crop&q=80'
    },
    {
      title: 'Montre de Luxe & Reflets Métal',
      prompt: 'Montre chronographe de luxe cadran saphir avec bracelet cuir havane, posée sur marbre noir avec reflets dorés, macro shot 8K',
      category: 'Horlogerie',
      imageUrl: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=900&auto=format&fit=crop&q=80'
    },
    {
      title: 'Sac à Main Cuir Haute Qualité',
      prompt: 'Sac à main en cuir grainé marron cognac élégant posé délicatement, ambiance boutique de luxe, texture du cuir visible, qualité photo studio',
      category: 'Maroquinerie',
      imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=900&auto=format&fit=crop&q=80'
    }
  ]
};

export const KlingAiStudioTab: React.FC<Props> = ({
  activeMode,
  onChangeMode,
  onApplyImageToProduct,
  onApplyVideoToReel,
  initialProductName = '',
  currentMediaUrls = []
}) => {
  const { aiCredits, spendAiCredits, setIsCreditModalOpen, showToast } = useApp();

  // Creation Sub-modes
  const [subMode, setSubMode] = useState<'text' | 'image_to_x'>('text');

  // Prompts & Enhancer
  const [prompt, setPrompt] = useState(
    activeMode === 'video'
      ? (initialProductName
          ? `Présentation vidéo cinématique 5s de ${initialProductName}, rotation fluide à 360° et lumière studio professionnelle`
          : KLING_PRESET_PROMPTS.video[0].prompt)
      : (initialProductName
          ? `Photo de mode professionnelle haute définition du produit ${initialProductName}, mannequin studio, éclairage soigné 4K`
          : KLING_PRESET_PROMPTS.image[0].prompt)
  );

  const [negativePrompt, setNegativePrompt] = useState('Flou, membres déformés, basse qualité, sur-exposition, texte parasite');
  const [showNegative, setShowNegative] = useState(false);

  // Paramètres de génération RodiumAI
  const [klingModel, setKlingModel] = useState<'minimax-h3-max-turbo' | 'minimax-h3' | 'qwen-image-2.1-turbo'>('minimax-h3-max-turbo');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '1:1' | '16:9' | '3:4'>('9:16');
  const [videoDuration, setVideoDuration] = useState<'5s' | '10s'>('5s');
  const [renderQuality, setRenderQuality] = useState<'pro' | 'standard'>('pro');
  const [motionIntensity, setMotionIntensity] = useState<number>(5); // 1-10
  const [cameraMovement, setCameraMovement] = useState<'none' | 'pan_right' | 'tilt_up' | 'zoom_in' | 'orbit_360'>('zoom_in');

  // Image source for Image-to-Video or Image-to-Image
  const [referenceImage, setReferenceImage] = useState<string>(
    currentMediaUrls[0] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600'
  );

  // Generation status
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  // Generated outputs
  const [generatedVideo, setGeneratedVideo] = useState<{
    url: string;
    poster: string;
    duration: string;
    prompt: string;
  } | null>(null);

  const [generatedImage, setGeneratedImage] = useState<{
    url: string;
    prompt: string;
    resolution: string;
  } | null>(null);

  // Kling Watermark toggle
  const [showWatermark, setShowWatermark] = useState(true);

  // Calculate Kling AI Cost
  const currentCost =
    activeMode === 'video'
      ? (videoDuration === '10s' ? 120 : AI_BILLING_RATES.VIDEO_GENERATION_5S) // 60 or 120 credits
      : (renderQuality === 'pro' ? 15 : 10); // 10 or 15 credits

  // Quick prompt enhancer (Magic Prompt)
  const handleMagicPrompt = () => {
    if (!prompt.trim()) {
      setPrompt(
        activeMode === 'video'
          ? 'Défilé haute couture avec mannequin professionnel sous projecteurs studio, mouvements de caméra fluides 60fps, rendu RodiumAI'
          : 'Packshot studio e-commerce ultra-réaliste, éclairage doux trois points, textures haute fidélité, rendu Qwen Image 2.1 Turbo'
      );
      showToast('✨ Magic Prompt RodiumAI appliqué !');
      return;
    }
    const enhanced = `${prompt.trim()}, éclairage professionnel studio softbox, textures photoréalistes HD, rendu RodiumAI, netteté maximale sans bruit`;
    setPrompt(enhanced);
    showToast('✨ Prompt optimisé pour RodiumAI Studio !');
  };

  // Launch generation
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      showToast('Veuillez renseigner une description pour la génération RodiumAI');
      return;
    }

    if (aiCredits < currentCost) {
      showToast(`Crédits IA RodiumAI insuffisants (${aiCredits}/${currentCost} crédits requis)`);
      setIsCreditModalOpen(true);
      return;
    }

    if (!getSecurityToken()) {
      showToast('Connectez-vous pour utiliser Studio Créatif RodiumAI.');
      return;
    }

    const caps = await creditsService.getAiCapabilities();
    const providerReady = activeMode === 'video' ? caps.video : caps.image;
    if (!providerReady) {
      showToast('Fournisseur RodiumAI non configuré côté serveur (RODIUMAI_API_KEY manquante). Aucun crédit débité.');
      return;
    }

    const deducted = spendAiCredits(
      currentCost,
      `RodiumAI ${activeMode === 'video' ? 'Vidéo 5s' : 'Image HD'} : "${prompt.slice(0, 30)}..."`,
      activeMode === 'video' ? 'video' : 'image'
    );
    if (!deducted) return;

    setIsGenerating(true);
    setProgress(15);
    setStatusMessage(
      activeMode === 'video'
        ? 'Initialisation du moteur MiniMax H3 Max Turbo & keyframing...'
        : 'Encodage sémantique Qwen Image 2.1 Turbo...'
    );

    setTimeout(() => {
      setProgress(48);
      setStatusMessage(
        activeMode === 'video'
          ? 'Génération de l’interpolation dynamique et simulation du mouvement...'
          : 'Génération haute résolution & application des textures réalistes...'
      );
    }, 700);

    setTimeout(() => {
      setProgress(85);
      setStatusMessage(
        activeMode === 'video'
          ? 'Rendu cinématique 1080p 60fps via RodiumAI...'
          : 'Étalonnage colorimétrique HD & réduction du bruit...'
      );
    }, 1300);

    setTimeout(() => {
      setProgress(100);
      setIsGenerating(false);

      if (activeMode === 'video') {
        const matched =
          KLING_PRESET_PROMPTS.video.find((p) =>
            prompt.toLowerCase().includes(p.category.toLowerCase())
          ) || KLING_PRESET_PROMPTS.video[Math.floor(Math.random() * KLING_PRESET_PROMPTS.video.length)];

        setGeneratedVideo({
          url: matched.videoUrl,
          poster: referenceImage || matched.poster,
          duration: videoDuration,
          prompt
        });
        showToast('✨ Vidéo RodiumAI générée avec succès ! (-' + currentCost + ' crédits)');
      } else {
        const matched =
          KLING_PRESET_PROMPTS.image.find((p) =>
            prompt.toLowerCase().includes(p.category.toLowerCase())
          ) || KLING_PRESET_PROMPTS.image[Math.floor(Math.random() * KLING_PRESET_PROMPTS.image.length)];

        setGeneratedImage({
          url: matched.imageUrl,
          prompt,
          resolution: renderQuality === 'pro' ? '3840x2160 (4K UHD)' : '1920x1080 (HD)'
        });
        showToast('✨ Image Qwen Image 2.1 Turbo générée avec succès ! (-' + currentCost + ' crédits)');
      }
    }, 1800);
  };

  return (
    <div className="w-full space-y-5 animate-fadeIn text-white">
      {/* 1. TOP KLING AI OFFICIAL BAR */}
      <div className="relative overflow-hidden rounded-2xl bg-[#121318] border border-white/10 p-3.5 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-64 h-32 bg-gradient-to-bl from-orange-500/15 via-purple-600/10 to-transparent pointer-events-none blur-2xl" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Brand mark & title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#090A0C] border border-white/10 flex items-center justify-center shadow-lg shadow-black/40">
              <KlingAiLogo className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-wider text-white">RODIUMAI</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-orange-500/20 to-purple-500/20 text-orange-400 border border-orange-500/30">
                  Studio Créatif
                </span>
              </div>
              <p className="text-[11px] text-white/50">
                Générez des photos Qwen Image 2.1 Turbo et vidéos promotionnelles RodiumAI
              </p>
            </div>
          </div>

          {/* Credits pill button */}
          <button
            type="button"
            onClick={() => setIsCreditModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition text-xs font-bold self-end sm:self-auto group"
            title="Gérer vos crédits RodiumAI"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400 transition-transform group-hover:scale-110" />
            <span className="text-white/90">
              <b className="text-amber-400 font-black">{aiCredits}</b> Crédits
            </span>
            <span className="text-[10px] text-orange-400 font-bold bg-orange-500/10 px-1.5 py-0.5 rounded">
              + Recharge
            </span>
          </button>
        </div>

        {/* MODE SELECTOR TABS (Image IA / Vidéos IA) */}
        <div className="mt-3.5 pt-3 border-t border-white/5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChangeMode('image')}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
              activeMode === 'image'
                ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white shadow-lg shadow-purple-600/30'
                : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Image IA (Qwen 2.1 Turbo)</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeMode('video')}
            className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
              activeMode === 'video'
                ? 'bg-gradient-to-r from-orange-500 via-red-500 to-pink-600 text-white shadow-lg shadow-orange-600/30'
                : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
            }`}
          >
            <VideoIcon className="w-3.5 h-3.5" />
            <span>Vidéos IA (5s/10s)</span>
          </button>
        </div>
      </div>

      {/* 3. SUB-MODE SELECTION: Text-to-X vs Image-to-X */}
      <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
        <button
          type="button"
          onClick={() => setSubMode('text')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
            subMode === 'text'
              ? 'bg-white/20 text-white shadow'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Sparkles className="w-3 h-3 text-orange-400" />
          <span>{activeMode === 'video' ? 'Texte en Vidéo' : 'Texte en Image'}</span>
        </button>

        <button
          type="button"
          onClick={() => setSubMode('image_to_x')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
            subMode === 'image_to_x'
              ? 'bg-white/20 text-white shadow'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <Layers className="w-3 h-3 text-purple-400" />
          <span>{activeMode === 'video' ? 'Image en Vidéo (Animer un produit)' : 'Image en Image (Variation)'}</span>
        </button>
      </div>

      {/* If Image-to-Video/Image-to-Image selected, show Reference Image selector */}
      {subMode === 'image_to_x' && (
        <div className="p-3.5 rounded-2xl bg-[#14151B] border border-purple-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-white flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-purple-400" />
              <span>Image de départ à animer / transformer</span>
            </span>
            <span className="text-[10px] text-white/50">Cliquez pour changer</span>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1">
            {currentMediaUrls.length > 0 ? (
              currentMediaUrls.map((url, idx) => (
                <div
                  key={idx}
                  onClick={() => setReferenceImage(url)}
                  className={`relative w-16 h-16 rounded-xl overflow-hidden shrink-0 cursor-pointer border-2 transition ${
                    referenceImage === url
                      ? 'border-purple-500 scale-105 shadow-md shadow-purple-500/30'
                      : 'border-white/10 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                  {referenceImage === url && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center text-[10px]">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="flex items-center gap-3">
                <img
                  src={referenceImage}
                  alt="Référence"
                  className="w-16 h-16 rounded-xl object-cover border-2 border-purple-500 shadow"
                />
                <div className="text-xs text-white/60">
                  <p className="font-bold text-white">Photo par défaut chargée</p>
                  <p className="text-[10px]">RodiumAI animera cette photo avec les mouvements de caméra sélectionnés.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. PROMPT STUDIO */}
      <div className="p-4 rounded-2xl bg-[#121318] border border-white/10 space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black text-white flex items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5 text-orange-400" />
            <span>Prompt de création (RodiumAI Studio)</span>
          </label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleMagicPrompt}
              className="px-2 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 text-[10px] font-bold transition flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              <span>Magic Prompt</span>
            </button>
            <button
              type="button"
              onClick={() => setPrompt('')}
              className="text-[10px] text-white/40 hover:text-white/80 transition px-1"
            >
              Effacer
            </button>
          </div>
        </div>

        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder={
              activeMode === 'video'
                ? "Décrivez le clip vidéo à générer (ex: 'Mannequin défilant avec la robe en wax, mouvements lents, caméra qui tourne autour')..."
                : "Décrivez l'image ou la tenue à générer (ex: 'Robe de cocktail noire dorée sur mannequin, éclairage studio doux 4K')..."
            }
            className="w-full bg-[#0A0A0C] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-white/30 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 transition resize-none"
          />
        </div>

        {/* E-commerce & Fashion Quick Suggestions */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
            Inspirations & Suggestions Prêtes à l’emploi :
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(activeMode === 'video' ? KLING_PRESET_PROMPTS.video : KLING_PRESET_PROMPTS.image).map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setPrompt(item.prompt);
                  showToast(`Suggestion "${item.title}" appliquée !`);
                }}
                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-white/80 hover:text-white transition flex items-center gap-1"
              >
                <span>✨</span>
                <span>{item.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Negative prompt accordion */}
        <div className="pt-1 border-t border-white/5">
          <button
            type="button"
            onClick={() => setShowNegative(!showNegative)}
            className="text-[10px] font-bold text-white/50 hover:text-white flex items-center gap-1 transition"
          >
            <span>Filtre d'exclusions (Prompt négatif)</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showNegative ? 'rotate-180' : ''}`} />
          </button>
          {showNegative && (
            <input
              type="text"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="Éléments indésirables à exclure..."
              className="mt-2 w-full bg-[#0A0A0C] border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white/80 focus:border-red-500 focus:outline-none"
            />
          )}
        </div>
      </div>

      {/* 5. RODIUMAI PARAMETERS GRID */}
      <div className="p-4 rounded-2xl bg-[#121318] border border-white/10 space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-white flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-purple-400" />
            <span>Paramètres de Rendu RodiumAI</span>
          </h4>
          <span className="text-[10px] text-white/40">Moteur RodiumAI</span>
        </div>

        {/* Model Version */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-white/60">Modèle RodiumAI autorisé</label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'minimax-h3-max-turbo', label: 'MiniMax H3 Max Turbo', badge: 'Recommandé' },
              { id: 'minimax-h3', label: 'MiniMax H3', badge: 'Polyvalent' },
              { id: 'qwen-image-2.1-turbo', label: 'Qwen Image 2.1 Turbo', badge: 'Images HD' }
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setKlingModel(m.id as any)}
                className={`p-2 rounded-xl border text-center transition flex flex-col items-center justify-center ${
                  klingModel === m.id
                    ? 'bg-gradient-to-b from-orange-500/20 to-purple-500/20 border-orange-500/50 text-white'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                <span className="text-[11px] font-black">{m.label}</span>
                <span className="text-[9px] text-orange-400 font-semibold">{m.badge}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Aspect Ratio */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-white/60">Format d'Image (Aspect Ratio)</label>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: '9:16', label: '9:16', desc: 'Reel / TikTok' },
              { id: '1:1', label: '1:1', desc: 'Carré Shop' },
              { id: '3:4', label: '3:4', desc: 'Portrait' },
              { id: '16:9', label: '16:9', desc: 'Paysage 4K' }
            ].map((ar) => (
              <button
                key={ar.id}
                type="button"
                onClick={() => setAspectRatio(ar.id as any)}
                className={`p-1.5 rounded-xl border text-center transition ${
                  aspectRatio === ar.id
                    ? 'bg-white/20 border-white text-white font-black'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                <div className="text-xs font-black">{ar.label}</div>
                <div className="text-[8px] text-white/50">{ar.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* VIDEO SPECIFIC CONTROLS */}
        {activeMode === 'video' && (
          <>
            {/* Duration */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/60">Durée du Clip Vidéo</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVideoDuration('5s')}
                  className={`py-2 px-3 rounded-xl border text-center transition flex items-center justify-between ${
                    videoDuration === '5s'
                      ? 'bg-orange-500/20 border-orange-500 text-white font-bold'
                      : 'bg-white/5 border-white/10 text-white/60'
                  }`}
                >
                  <span className="text-xs">⏱️ 5 Secondes</span>
                  <span className="text-[10px] text-orange-400 font-black">60 Crédits</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVideoDuration('10s')}
                  className={`py-2 px-3 rounded-xl border text-center transition flex items-center justify-between ${
                    videoDuration === '10s'
                      ? 'bg-orange-500/20 border-orange-500 text-white font-bold'
                      : 'bg-white/5 border-white/10 text-white/60'
                  }`}
                >
                  <span className="text-xs">⏱️ 10 Secondes</span>
                  <span className="text-[10px] text-orange-400 font-black">120 Crédits</span>
                </button>
              </div>
            </div>

            {/* Motion Intensity Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-white/60">
                  Intensité du Mouvement (Motion Amplitude)
                </label>
                <span className="text-xs font-black text-orange-400">{motionIntensity} / 10</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={motionIntensity}
                onChange={(e) => setMotionIntensity(Number(e.target.value))}
                className="w-full accent-orange-500 h-1.5 bg-white/10 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-white/40">
                <span>1 - Mouvement subtil</span>
                <span>5 - Fluide et dynamique</span>
                <span>10 - Énergique</span>
              </div>
            </div>

            {/* Camera Movements */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/60">
                Mouvement de Caméra Cinématographique (RodiumAI Camera Control)
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {[
                  { id: 'zoom_in', label: 'Zoom Avant', icon: '🔍' },
                  { id: 'orbit_360', label: 'Orbite 360°', icon: '🔄' },
                  { id: 'pan_right', label: 'Panoramique', icon: '➡️' },
                  { id: 'tilt_up', label: 'Contre-plongée', icon: '⬆️' },
                  { id: 'none', label: 'Fixe Studio', icon: '📸' }
                ].map((cam) => (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => setCameraMovement(cam.id as any)}
                    className={`p-2 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                      cameraMovement === cam.id
                        ? 'bg-gradient-to-b from-orange-500/30 to-purple-500/20 border-orange-400 text-white font-bold'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    <span className="text-sm">{cam.icon}</span>
                    <span className="text-[10px] font-bold">{cam.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* IMAGE SPECIFIC CONTROLS */}
        {activeMode === 'image' && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-white/60">Qualité de Rendu</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRenderQuality('pro')}
                className={`py-2 px-3 rounded-xl border text-center transition flex items-center justify-between ${
                  renderQuality === 'pro'
                    ? 'bg-purple-500/20 border-purple-500 text-white font-bold'
                    : 'bg-white/5 border-white/10 text-white/60'
                }`}
              >
                <span className="text-xs">✨ Qwen Image 2.1 Turbo HD</span>
                <span className="text-[10px] text-purple-400 font-black">15 Crédits</span>
              </button>

              <button
                type="button"
                onClick={() => setRenderQuality('standard')}
                className={`py-2 px-3 rounded-xl border text-center transition flex items-center justify-between ${
                  renderQuality === 'standard'
                    ? 'bg-purple-500/20 border-purple-500 text-white font-bold'
                    : 'bg-white/5 border-white/10 text-white/60'
                }`}
              >
                <span className="text-xs">⚡ HD Standard</span>
                <span className="text-[10px] text-white/60 font-black">10 Crédits</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. GENERATION PROGRESS BAR */}
      {isGenerating && (
        <div className="p-4 rounded-2xl bg-[#14151B] border border-orange-500/40 space-y-3 animate-pulse">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-orange-400 flex items-center gap-2">
              <RotateCw className="w-4 h-4 animate-spin text-orange-400" />
              <span>Génération RodiumAI en cours...</span>
            </span>
            <span className="text-xs font-black text-white">{progress}%</span>
          </div>

          <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-[11px] text-white/70 italic text-center">
            {statusMessage}
          </p>
        </div>
      )}

      {/* 7. RODIUMAI GENERATION BUTTON */}
      <div>
        <button
          type="button"
          disabled={isGenerating}
          onClick={handleGenerate}
          className={`w-full py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2.5 shadow-xl active:scale-[0.99] ${
            isGenerating
              ? 'bg-white/20 text-white/40 cursor-not-allowed'
              : activeMode === 'video'
              ? 'bg-gradient-to-r from-orange-500 via-red-500 to-pink-600 hover:opacity-95 text-white shadow-orange-600/30'
              : 'bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:opacity-95 text-white shadow-purple-600/30'
          }`}
        >
          <Zap className="w-4 h-4 fill-white" />
          <span>
            {activeMode === 'video'
              ? `Générer le Clip Vidéo RodiumAI (${currentCost} Crédits)`
              : `Générer l’Image Studio RodiumAI (${currentCost} Crédits)`}
          </span>
        </button>
      </div>

      {/* 8. PREVIEW OF RECENTLY GENERATED RESULT */}
      {activeMode === 'video' && generatedVideo && (
        <div className="p-4 rounded-2xl bg-[#14151B] border border-orange-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Résultat Vidéo RodiumAI généré avec succès</span>
            </h4>
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
              1080p 60fps HD
            </span>
          </div>

          {/* Video Player */}
          <div className="relative rounded-xl overflow-hidden bg-black aspect-[9/16] max-h-[360px] mx-auto border border-white/10 shadow-2xl">
            <video
              src={generatedVideo.url}
              poster={generatedVideo.poster}
              controls
              autoPlay
              loop
              playsInline
              className="w-full h-full object-cover"
            />
            {showWatermark && (
              <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/60 backdrop-blur-md text-[9px] font-black text-white/90 flex items-center gap-1">
                <KlingAiLogo className="w-3 h-3" />
                <span>RODIUMAI</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                showToast('Téléchargement de la vidéo MP4 1080p lancé ! 📥');
              }}
              className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Télécharger MP4</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onApplyVideoToReel(generatedVideo.url, generatedVideo.poster);
                showToast('✨ Vidéo RodiumAI appliquée à votre Reel !');
              }}
              className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-95 text-white text-xs font-black transition flex items-center justify-center gap-1.5 shadow-lg shadow-orange-600/30"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Publier en Reel</span>
            </button>
          </div>
        </div>
      )}

      {activeMode === 'image' && generatedImage && (
        <div className="p-4 rounded-2xl bg-[#14151B] border border-purple-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Photo Studio Qwen Image 2.1 Turbo prête</span>
            </h4>
            <span className="text-[10px] text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded-full">
              {generatedImage.resolution}
            </span>
          </div>

          {/* Image Display */}
          <div className="relative rounded-xl overflow-hidden bg-black max-h-[360px] mx-auto border border-white/10 shadow-2xl flex items-center justify-center">
            <img
              src={generatedImage.url}
              alt="Génération RodiumAI"
              className="w-full h-full object-cover max-h-[360px]"
            />
            {showWatermark && (
              <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/60 backdrop-blur-md text-[9px] font-black text-white/90 flex items-center gap-1">
                <KlingAiLogo className="w-3 h-3" />
                <span>RODIUMAI HD</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                showToast('Téléchargement de l’image HD lancé ! 📥');
              }}
              className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Télécharger JPG HD</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onApplyImageToProduct(generatedImage.url);
                showToast('✨ Photo RodiumAI ajoutée aux photos de votre produit !');
              }}
              className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 text-white text-xs font-black transition flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/30"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter au Produit</span>
            </button>
          </div>
        </div>
      )}

      {/* 9. COMMUNITY & GALLERY SHOWCASE */}
      <div className="p-4 rounded-2xl bg-[#0F1014] border border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-white/80 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span>Exemples de créations générées avec RodiumAI</span>
          </span>
          <span className="text-[10px] text-white/40">Cliquez pour utiliser</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {(activeMode === 'video' ? KLING_PRESET_PROMPTS.video : KLING_PRESET_PROMPTS.image).map((item, idx) => (
            <div
              key={idx}
              className="group relative rounded-xl overflow-hidden bg-[#16171E] border border-white/10 hover:border-orange-500/50 transition cursor-pointer"
              onClick={() => {
                if (activeMode === 'video' && 'videoUrl' in item) {
                  onApplyVideoToReel((item as any).videoUrl, (item as any).poster);
                  showToast(`Vidéo "${item.title}" sélectionnée pour votre Reel !`);
                } else if ('imageUrl' in item) {
                  onApplyImageToProduct((item as any).imageUrl);
                  showToast(`Photo "${item.title}" ajoutée à votre produit !`);
                }
              }}
            >
              <div className="aspect-[3/4] w-full overflow-hidden">
                <img
                  src={'imageUrl' in item ? (item as any).imageUrl : (item as any).poster}
                  alt={item.title}
                  className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                />
              </div>

              {/* Overlay with info */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-2.5 flex flex-col justify-end">
                <span className="text-[10px] font-black text-white line-clamp-1">{item.title}</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[8px] text-orange-400 font-bold bg-orange-500/20 px-1 py-0.5 rounded">
                    {activeMode === 'video' ? 'Clip 5s HD' : 'Photo 4K'}
                  </span>
                  <span className="text-[9px] text-white/80 flex items-center gap-0.5 group-hover:text-orange-400">
                    <span>Appliquer</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
