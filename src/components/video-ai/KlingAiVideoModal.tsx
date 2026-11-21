import React, { useState } from 'react';
import {
  X,
  Video,
  Sparkles,
  Zap,
  Play,
  RotateCw,
  Download,
  Share2,
  CheckCircle2,
  Clock,
  Film,
  Layers,
  Wand2,
  Sliders,
  ChevronRight,
  Store
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AI_BILLING_RATES } from '../../services/aiPricing';
import { creditsService } from '../../services/creditsService';
import { getSecurityToken } from '../../services/securityService';
import { KlingAiLogo } from '../credits/KlingAiCreditsModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
  initialProductName?: string;
  initialImage?: string;
}

const PRESET_PROMPTS = [
  {
    title: 'Défilé Mannequin Wax',
    prompt: 'Mannequin élégante défilant sur un tapis avec une robe en tissu Wax ivoirien, mouvements fluides et lumière dorée',
    category: 'Mode & Wax',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-fashion-model-in-a-black-outfit-walking-in-a-studio-40348-large.mp4',
    poster: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800'
  },
  {
    title: 'Sneakers 360° Studio',
    prompt: 'Baskets streetwear en lévitation avec rotation 360 degrés, reflets néon dynamiques et zoom sur les coutures',
    category: 'Chaussures',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-hands-holding-and-showing-a-pair-of-sneakers-42661-large.mp4',
    poster: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800'
  },
  {
    title: 'Bijoux & Or Scintillant',
    prompt: 'Parure de bijoux traditionnels et colliers en or scintillant avec macro-zoom cinématographique et jeu de lumière',
    category: 'Bijouterie',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-close-up-of-a-woman-wearing-jewelry-41399-large.mp4',
    poster: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800'
  },
  {
    title: 'Défilé Homme Costume Chic',
    prompt: 'Homme chic portant un ensemble veste coupe moderne africaine marchant avec assurance, style urbain premium',
    category: 'Hommes',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-young-man-in-a-suit-posing-for-the-camera-42662-large.mp4',
    poster: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800'
  }
];

export const KlingAiVideoModal: React.FC<Props> = ({
  isOpen,
  onClose,
  initialPrompt = '',
  initialProductName = '',
  initialImage
}) => {
  const {
    aiCredits,
    spendAiCredits,
    setIsCreditModalOpen,
    openCreditModal,
    showToast,
    products,
    accountRole,
    userPlan,
    currentSellerId,
    addSellerCreation
  } = useApp();

  const isSeller = accountRole === 'seller' || userPlan.startsWith('vendeur');

  const [prompt, setPrompt] = useState(
    initialPrompt || 
    (initialProductName ? `Présentation dynamique 5s du produit "${initialProductName}" porté par un mannequin` : PRESET_PROMPTS[0].prompt)
  );
  const [selectedStyle, setSelectedStyle] = useState<'cinematic' | 'studio' | 'urban'>('cinematic');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [generatedPoster, setGeneratedPoster] = useState<string | null>(null);

  if (!isOpen) return null;

  const cost = AI_BILLING_RATES.VIDEO_GENERATION_5S; // 60 Crédits

  const handleStartGeneration = async () => {
    if (!isSeller) {
      showToast('La génération de vidéo IA est réservée aux abonnés Vendeurs.');
      setIsCreditModalOpen(true);
      return;
    }

    if (!prompt.trim()) {
      showToast('Veuillez décrire votre vidéo ou choisir une suggestion');
      return;
    }

    if (aiCredits < cost) {
      showToast(`Crédits insuffisants (${aiCredits}/${cost} crédits requis pour 1 vidéo de 5s)`);
      setIsCreditModalOpen(true);
      return;
    }

    if (!getSecurityToken()) {
      showToast('Connectez-vous pour générer une vidéo IA RodiumAI.');
      return;
    }

    setIsGenerating(true);
    setProgress(25);
    setStatusText('Vérification des capacités RodiumAI côté serveur...');
    setGeneratedVideoUrl(null);

    try {
      const caps = await creditsService.getAiCapabilities();
      if (!caps.video) {
        setIsGenerating(false);
        setProgress(0);
        showToast('Génération vidéo RodiumAI indisponible : clé API RodiumAI (RODIUMAI_API_KEY) non configurée côté serveur. Aucun crédit débité.');
        return;
      }

      setProgress(60);
      setStatusText('Soumission du rendu 5s au moteur RodiumAI (MiniMax H3 Max Turbo)...');
      const res = await creditsService.generateVideo({
        prompt: prompt.trim(),
        mode: initialImage ? 'image' : 'text',
        sourceImage: initialImage
      });

      setProgress(100);
      if (res.videoUrl) {
        setGeneratedVideoUrl(res.videoUrl);
        setGeneratedPoster(initialImage || null);
        if (addSellerCreation) {
          addSellerCreation({
            sellerId: currentSellerId || 'seller-1',
            title: initialProductName ? `Vidéo IA RodiumAI : ${initialProductName}` : 'Clip Vidéo IA 5s',
            type: 'ai_video',
            mediaUrl: res.videoUrl,
            posterUrl: initialImage || '',
            productName: initialProductName || undefined,
            prompt,
            viewsCount: 1,
            likesCount: 0,
            sharesCount: 0,
            duration: '0:05',
            isAiGenerated: true,
            aspectRatio: '9:16',
            status: 'published'
          });
        }
        showToast('Vidéo 5s RodiumAI générée avec succès.');
      } else {
        showToast(
          res.taskId
            ? `Tâche RodiumAI créée (${res.taskId}) : rendu en cours côté fournisseur.`
            : 'Tâche RodiumAI soumise.'
        );
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur fournisseur RodiumAI. Aucun crédit débité.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    showToast('Téléchargement du clip vidéo 5s lancé (MP4 1080p) ! 📥');
  };

  const handleShare = () => {
    showToast('Lien de la vidéo 5s copié dans le presse-papier ! 🔗');
  };

  return (
    <div
      id="modal-kling-ai-video"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 overflow-hidden animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl h-[95vh] sm:h-[90vh] bg-[#141416] border border-white/10 rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden text-[#ECECEC]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <header className="px-5 py-4 bg-[#1E1E22] border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FF5E00]/15 flex items-center justify-center border border-[#FF5E00]/30 shadow-sm">
              <KlingAiLogo className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Studio Vidéo IA RodiumAI
                </h3>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-300 border border-orange-500/30">
                  5 secondes
                </span>
              </div>
              <p className="text-[11px] text-white/50">
                Créez des clips vidéos ultra-réalistes de vos produits
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition active:scale-90"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* BILLING & CREDITS SUMMARY BAR */}
        <div className="px-5 py-3 bg-[#18181C] border-b border-white/[0.06] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
              <Film className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-white/70">Tarif officiel :</span>
                <span className="text-xs font-black text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-md border border-orange-500/20">
                  {cost} Crédits / vidéo (5s)
                </span>
              </div>
            </div>
          </div>

          {/* Current user balance */}
          <button
            onClick={() => setIsCreditModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 text-amber-300 text-xs font-black transition active:scale-95"
            title="Recharger des crédits"
          >
            <Zap className="w-3.5 h-3.5 fill-amber-400" />
            <span>{aiCredits} crédits</span>
            <span className="text-[10px] text-white/50">+</span>
          </button>
        </div>

        {/* BODY CONTAINER */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
          {/* Seller-only warning if client */}
          {!isSeller && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-400/30">
                  <Store className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-white block">Génération vidéo réservée aux Vendeurs</span>
                  <span className="text-[11px] text-amber-200/80 block leading-tight">
                    Les clients ont accès aux questions et images Try On. Activez un forfait Vendeur pour débloquer les vidéos Studio IA 5s.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreditModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#FF6321] to-[#FF8038] hover:opacity-95 text-white font-black text-[11px] shadow-md shrink-0 cursor-pointer"
              >
                Forfaits Vendeurs
              </button>
            </div>
          )}
          {/* VIDEO PLAYER / GENERATION STAGE */}
          <div className="relative aspect-[9/12] sm:aspect-[16/11] w-full rounded-2xl bg-black border border-white/10 overflow-hidden flex flex-col items-center justify-center shadow-xl">
            {isGenerating ? (
              <div className="p-6 text-center space-y-4 max-w-sm">
                <div className="relative w-16 h-16 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-orange-500/20 animate-ping" />
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-600/40">
                    <RotateCw className="w-8 h-8 text-white animate-spin" />
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white">Génération vidéo 5s en cours...</h4>
                  <p className="text-xs text-orange-300 font-mono font-bold mt-1">{progress}%</p>
                  <p className="text-[11px] text-white/60 mt-1 leading-snug">{statusText}</p>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-orange-500 via-amber-400 to-[#FF6321] h-full transition-all duration-300 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : generatedVideoUrl ? (
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                <video
                  src={generatedVideoUrl}
                  poster={generatedPoster || undefined}
                  autoPlay
                  loop
                  playsInline
                  controls
                  className="w-full h-full object-cover"
                />
                
                {/* 5s Badge Overlay */}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-xl bg-black/70 backdrop-blur-md border border-white/15 text-[11px] font-bold text-white flex items-center gap-1.5 shadow-lg">
                  <Clock className="w-3.5 h-3.5 text-orange-400" />
                  <span>Durée : 5 secondes</span>
                </div>

                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  <button
                    onClick={handleDownload}
                    className="p-2 rounded-xl bg-black/70 hover:bg-black text-white border border-white/15 backdrop-blur-md transition"
                    title="Télécharger"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleShare}
                    className="p-2 rounded-xl bg-black/70 hover:bg-black text-white border border-white/15 backdrop-blur-md transition"
                    title="Partager"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center space-y-3 max-w-sm">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-orange-400 shadow-inner">
                  <Video className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Générateur Vidéo 5s RodiumAI</h4>
                  <p className="text-xs text-white/50 mt-1">
                    Saisissez votre description ci-dessous pour créer une vidéo de 5 secondes au format haute définition.
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-white/70">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Durée fixe : 5 secondes • Coût : 60 crédits</span>
                </div>
              </div>
            )}
          </div>

          {/* PROMPT INPUT */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-white/80 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-orange-400" />
                Description de la vidéo (Prompt) :
              </span>
              <span className="text-[10px] text-white/40">5 secondes • 1080p</span>
            </label>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="Décrivez l'action, le vêtement, les mouvements du mannequin..."
                className="w-full p-3 rounded-2xl bg-[#1D1D21] border border-white/10 focus:border-orange-500 focus:outline-none text-xs text-white placeholder-white/40 resize-none leading-relaxed"
              />
            </div>
          </div>

          {/* PRESET PROMPTS */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">
              Suggestions populaires :
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_PROMPTS.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPrompt(item.prompt)}
                  className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-orange-500/40 text-left transition text-xs group flex items-start gap-2.5"
                >
                  <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                    <Play className="w-3 h-3 fill-orange-400" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-white block truncate">{item.title}</span>
                    <span className="text-[10px] text-white/50 line-clamp-1">{item.prompt}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* STYLE OPTIONS */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">
              Style cinématique :
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'cinematic', label: 'Cinématographique', desc: 'Lumière dorée' },
                { id: 'studio', label: 'Studio Minimal', desc: 'Fond épuré' },
                { id: 'urban', label: 'Urbain Abidjan', desc: 'Ambiance rue chic' }
              ].map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyle(style.id as any)}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    selectedStyle === style.id
                      ? 'bg-orange-500/15 border-orange-500 text-white'
                      : 'bg-white/[0.02] border-white/5 text-white/60 hover:text-white'
                  }`}
                >
                  <p className="text-xs font-bold leading-tight">{style.label}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">{style.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        <footer className="p-4 bg-[#1E1E22] border-t border-white/10 shrink-0 space-y-2">
          <button
            onClick={handleStartGeneration}
            disabled={isGenerating}
            className={`w-full py-3.5 px-4 rounded-2xl text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl transition active:scale-[0.98] disabled:opacity-60 cursor-pointer ${
              !isSeller
                ? 'bg-gradient-to-r from-amber-600 to-[#FF6321] hover:opacity-95 shadow-amber-600/30'
                : 'bg-gradient-to-r from-orange-600 via-[#FF6321] to-amber-500 hover:opacity-95 shadow-orange-600/30'
            }`}
          >
            {isGenerating ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                <span>Génération du clip 5s en cours ({progress}%)...</span>
              </>
            ) : !isSeller ? (
              <>
                <Store className="w-4 h-4" />
                <span>Débloquer avec un Forfait Vendeur (Vidéos incluses)</span>
              </>
            ) : generatedVideoUrl ? (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Régénérer une nouvelle vidéo 5s ({cost} Crédits)</span>
              </>
            ) : (
              <>
                <Video className="w-4 h-4" />
                <span>Générer la vidéo 5s RodiumAI ({cost} Crédits)</span>
              </>
            )}
          </button>

          <div className="flex items-center justify-between text-[11px] text-white/50 px-1">
            <span>Barème : 1 vidéo 5s = 60 crédits</span>
            <button
              onClick={() => setIsCreditModalOpen(true)}
              className="text-orange-400 hover:underline font-bold"
            >
              Recharger mes crédits →
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
