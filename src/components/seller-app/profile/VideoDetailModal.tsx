import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ChevronUp,
  ChevronDown,
  Share2, 
  Heart, 
  ShoppingBag, 
  Sparkles, 
  TrendingUp, 
  ExternalLink,
  MessageCircle,
  Truck,
  Check,
  Rocket,
  BarChart2,
  Copy,
  Store,
  Tag,
  Plus,
  Bookmark,
  Send,
  MoreVertical,
  Volume2,
  VolumeX,
  Play,
  Pause,
  MessageSquare,
  Star
} from 'lucide-react';
import { Product } from '../../../types';
import { formatFCFA, formatMetricCount } from '../../../services/marketServices';
import { useApp } from '../../../context/AppContext';

interface Props {
  product: Product | null;
  allProducts?: Product[];
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
  onOpenStats?: (product: Product) => void;
  onOpenBoost?: (product: Product) => void;
  showToast: (msg: string) => void;
}

export const VideoDetailModal: React.FC<Props> = ({
  product: initialProduct,
  allProducts = [],
  onClose,
  onSelectProduct,
  onOpenStats,
  onOpenBoost,
  showToast,
}) => {
  const {
    sellers,
    userProfile,
    toggleLikeVideo,
    toggleSaveProduct,
    toggleFollowSeller,
    setSelectedSeller,
    setVariantModalProduct,
    setIsVariantModalDirectBuy,
    comments,
    addComment,
    accountRole,
    currentSellerId,
    trackVideoWatch,
    openChatWithParticipant,
  } = useApp();

  // Mode Vendeur : l'application vendeur ne doit pas afficher les filtres de flux client ni le bouton Acheter
  const isSellerView = accountRole === 'seller' || Boolean(onOpenStats) || Boolean(onOpenBoost);

  // Combine products list: prioritize allProducts if provided, else fallback to initialProduct
  const productList = allProducts.length > 0 ? allProducts : (initialProduct ? [initialProduct] : []);

  // Determine current video index
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (!initialProduct) return 0;
    const foundIdx = productList.findIndex((p) => p.id === initialProduct.id);
    return foundIdx >= 0 ? foundIdx : 0;
  });

  const currentProduct = productList[currentIndex] || initialProduct;
  const currentProductId = currentProduct?.id;

  // Video playback states
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showPlayPauseIcon, setShowPlayPauseIcon] = useState<'play' | 'pause' | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Feed sub-tabs state (identical to client home feed: Suivi / Pour toi / Promo)
  const [activeTab, setActiveTab] = useState<'suivi' | 'pour_toi' | 'promo'>('pour_toi');

  // UI States
  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isCommentSheetOpen, setIsCommentSheetOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [showLikeHeartAnimation, setShowLikeHeartAnimation] = useState(false);

  // Gesture & interaction refs
  const touchStartY = useRef<number | null>(null);
  const lastWheelTime = useRef<number>(0);
  const lastTapTime = useRef<number>(0);
  const iconTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-play and track watch when video changes
  useEffect(() => {
    setIsDescriptionExpanded(false);
    setIsPlaying(true);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
    if (currentProductId) {
      trackVideoWatch(currentProductId, 5, true);
    }
  }, [currentIndex, currentProductId, trackVideoWatch]);

  if (!currentProduct) return null;

  const seller = sellers.find((s) => s.id === currentProduct.sellerId);
  const isLiked = userProfile?.likedVideoIds?.includes(currentProduct.id) || false;
  const isSaved = userProfile?.savedItemIds?.includes(currentProduct.id) || false;
  const isFollowed = seller ? userProfile?.followedSellerIds?.includes(seller.id) : false;
  const productComments = (currentProductId && comments[currentProductId]) || [];
  const isOwnerSeller = Boolean(accountRole === 'seller' && currentProduct.sellerId === currentSellerId);

  // Navigation handlers
  const goToNextProduct = () => {
    if (currentIndex < productList.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const goToPrevProduct = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCommentSheetOpen) return;
      if (e.key === 'ArrowDown') {
        goToNextProduct();
      } else if (e.key === 'ArrowUp') {
        goToPrevProduct();
      } else if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlayPause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, productList.length, isCommentSheetOpen]);

  // Touch gestures for vertical scrolling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const endY = e.changedTouches[0]?.clientY ?? touchStartY.current;
    const deltaY = touchStartY.current - endY;
    touchStartY.current = null;

    if (Math.abs(deltaY) > 45) {
      if (deltaY > 0) {
        goToNextProduct();
      } else {
        goToPrevProduct();
      }
    }
  };

  // Mouse wheel listener
  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    if (now - lastWheelTime.current < 450) return;
    if (Math.abs(e.deltaY) > 30) {
      lastWheelTime.current = now;
      if (e.deltaY > 0) {
        goToNextProduct();
      } else {
        goToPrevProduct();
      }
    }
  };

  // Single vs Double tap handling
  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
      setShowPlayPauseIcon('play');
    } else {
      video.pause();
      setIsPlaying(false);
      setShowPlayPauseIcon('pause');
    }
    if (iconTimeoutRef.current) clearTimeout(iconTimeoutRef.current);
    iconTimeoutRef.current = setTimeout(() => setShowPlayPauseIcon(null), 700);
  };

  const handleVideoAreaClick = () => {
    const now = Date.now();
    if (now - lastTapTime.current < 300) {
      // Double tap detected: like video with animation
      if (!isLiked && currentProductId) {
        toggleLikeVideo(currentProductId);
      }
      setShowLikeHeartAnimation(true);
      setTimeout(() => setShowLikeHeartAnimation(false), 900);
      lastTapTime.current = 0;
    } else {
      lastTapTime.current = now;
      // Single tap: toggle play/pause
      togglePlayPause();
    }
  };

  // Sharing and Discussion handlers
  const handleOpenDiscussion = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setShowOptionsDropdown(false);
    onClose();
    openChatWithParticipant({
      participantId: currentProduct.sellerId || 'seller-1',
      participantName: seller?.name || 'Vendeur Djassa',
      participantType: 'seller',
      participantRoleSubtitle: `Boutique • ${seller?.name || 'Djassa'}`,
      initialMessage: `Bonjour, je vous contacte à propos de votre vidéo "${currentProduct.name}" (${formatFCFA(currentProduct.price)}). Est-il toujours disponible ?`
    });
  };

  const handleCopyLink = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast('Lien copié dans le presse-papiers 📋');
    }
    setShowOptionsDropdown(false);
  };

  const handleNativeShare = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (navigator.share) {
      navigator.share({
        title: currentProduct.name,
        text: `Découvre ${currentProduct.name} sur Djassa !`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  // Comment submission
  const handleAddCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !currentProductId) return;
    addComment(currentProductId, newCommentText.trim());
    setNewCommentText('');
    showToast('Commentaire publié ! ✨');
  };

  return (
    <div
      id="video-feed-detail-viewer"
      className="fixed inset-0 z-[120] bg-black overflow-hidden select-none flex flex-col items-center justify-center animate-in fade-in duration-200"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* 1. TOP HEADER NAVIGATION (Identical to Client FeedScreen) */}
      <div className="absolute top-0 left-0 right-0 z-40 pt-safe px-4 py-3 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/50 to-transparent">
        {/* Close / Back Button */}
        <button
          id="btn-close-video-detail"
          onClick={onClose}
          className="p-2.5 rounded-full bg-black/50 hover:bg-black/80 text-white/90 hover:text-white backdrop-blur-md border border-white/10 transition active:scale-90"
          title="Fermer"
          aria-label="Fermer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Center Sub-Tabs (Suivi / Pour toi / Promo) - Masqués dans l'application vendeur */}
        {!isSellerView && (
          <div className="flex items-center gap-5 text-sm font-bold">
            <button
              onClick={() => setActiveTab('suivi')}
              className={`transition-all ${
                activeTab === 'suivi'
                  ? 'text-white border-b-2 border-[#FF6321] pb-0.5'
                  : 'text-white/60 hover:text-white/90'
              }`}
            >
              Suivi
            </button>
            <button
              onClick={() => setActiveTab('pour_toi')}
              className={`transition-all ${
                activeTab === 'pour_toi'
                  ? 'text-white border-b-2 border-[#FF6321] pb-0.5'
                  : 'text-white/60 hover:text-white/90'
              }`}
            >
              Pour toi
            </button>
            <button
              onClick={() => setActiveTab('promo')}
              className={`flex items-center gap-1 transition-all ${
                activeTab === 'promo'
                  ? 'text-[#FF6321] border-b-2 border-[#FF6321] pb-0.5'
                  : 'text-white/60 hover:text-white/90'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FF6321]" />
              Promo
            </button>
          </div>
        )}

        {/* Right Controls: Sound Toggle + More Options */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMuted((v) => !v)}
            className="p-2.5 rounded-full bg-black/50 hover:bg-black/80 text-white/90 hover:text-white backdrop-blur-md border border-white/10 transition active:scale-90"
            aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
            title={isMuted ? 'Activer le son' : 'Couper le son'}
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-rose-400" />
            ) : (
              <Volume2 className="w-5 h-5 text-[#FF6321]" />
            )}
          </button>

          {!isSellerView && (
            <div className="relative">
              <button
                id="btn-video-options-menu"
                onClick={() => setShowOptionsDropdown((v) => !v)}
                className="p-2.5 rounded-full bg-black/50 hover:bg-black/80 text-white/90 hover:text-white backdrop-blur-md border border-white/10 transition active:scale-90"
                title="Options de la publication"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {/* Options Dropdown Menu */}
              {showOptionsDropdown && (
                <div 
                  className="absolute right-0 top-12 w-52 rounded-2xl bg-[#181818]/95 backdrop-blur-xl border border-white/15 p-1.5 shadow-2xl z-50 text-xs animate-in zoom-in-95 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  {onOpenStats && (
                    <button
                      onClick={() => {
                        setShowOptionsDropdown(false);
                        onOpenStats(currentProduct);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-white/90 hover:text-white hover:bg-white/10 font-bold flex items-center gap-2 transition"
                    >
                      <BarChart2 className="w-4 h-4 text-cyan-400" />
                      <span>Statistiques complètes</span>
                    </button>
                  )}

                  {onOpenBoost && (
                    <button
                      onClick={() => {
                        setShowOptionsDropdown(false);
                        onOpenBoost(currentProduct);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-[#FF6321] hover:bg-[#FF6321]/15 font-bold flex items-center gap-2 transition"
                    >
                      <Rocket className="w-4 h-4 text-[#FF6321]" />
                      <span>Booster avec Djassa Ads</span>
                    </button>
                  )}

                  <button
                    onClick={handleOpenDiscussion}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-[#FF6321] hover:bg-[#FF6321]/15 font-bold flex items-center gap-2 transition"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Discussion avec le vendeur</span>
                  </button>

                  <button
                    onClick={handleCopyLink}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 font-bold flex items-center gap-2 transition"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copier le lien</span>
                  </button>

                  <div className="h-px bg-white/10 my-1" />

                  <button
                    onClick={() => {
                      setShowOptionsDropdown(false);
                      onClose();
                      onSelectProduct(currentProduct);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 text-[11px] font-medium flex items-center gap-2 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Fiche article détaillée</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. MEDIA DISPLAY STAGE (FULL SCREEN VIDEO IMMERSION) */}
      <div 
        className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-pointer"
        onClick={handleVideoAreaClick}
      >
        {/* Ambient blurred backdrop */}
        {currentProduct.videoPoster && (
          <img
            src={currentProduct.videoPoster}
            alt=""
            className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-35 scale-110 pointer-events-none transition-all duration-500"
            aria-hidden="true"
          />
        )}

        {/* Video Player */}
        <video
          ref={videoRef}
          key={currentProduct.id}
          src={currentProduct.videoUrl}
          poster={currentProduct.videoPoster || currentProduct.images[0]}
          className="relative z-10 w-full h-full object-cover select-none pointer-events-none"
          autoPlay
          loop
          playsInline
          muted={isMuted}
        />

        {/* Gradient overlays matching TikTok / FeedScreen */}
        <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-b from-black/60 via-transparent to-black/95" />

        {/* Play / Pause transient indicator icon */}
        {showPlayPauseIcon && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <div className="w-20 h-20 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/20 animate-in zoom-in duration-150">
              {showPlayPauseIcon === 'pause' ? (
                <Pause className="w-10 h-10 text-white fill-white" />
              ) : (
                <Play className="w-10 h-10 text-white fill-white ml-1" />
              )}
            </div>
          </div>
        )}

        {/* Double-tap Heart Pop Animation */}
        {showLikeHeartAnimation && (
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none animate-in zoom-in duration-200">
            <Heart className="w-28 h-28 text-rose-500 fill-rose-500 drop-shadow-2xl animate-bounce" />
          </div>
        )}

        {/* Vertical Navigation Chevrons (Desktop Up / Down) */}
        {productList.length > 1 && (
          <div className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-30 flex-col gap-2 pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToPrevProduct();
              }}
              disabled={currentIndex === 0}
              className={`p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/80 transition ${
                currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/80 hover:text-white active:scale-90'
              }`}
              title="Vidéo précédente (Flèche Haut)"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToNextProduct();
              }}
              disabled={currentIndex === productList.length - 1}
              className={`p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/80 transition ${
                currentIndex === productList.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/80 hover:text-white active:scale-90'
              }`}
              title="Vidéo suivante (Flèche Bas)"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* 3. RIGHT FLOATING ACTIONS BAR (Identical to Client FeedScreen) */}
      <div className="absolute right-3 bottom-24 z-30 flex flex-col items-center gap-3.5">
        {/* Seller Avatar + Follow badge */}
        <div className="relative mb-1">
          <img
            src={seller?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
            alt={seller?.name || 'Boutique'}
            onClick={() => {
              if (seller) {
                onClose();
                setSelectedSeller(seller);
              }
            }}
            className="w-12 h-12 rounded-full border-2 border-[#FF6321] object-cover cursor-pointer shadow-lg hover:scale-105 transition"
          />
          {seller && !isFollowed && (
            <button
              onClick={() => toggleFollowSeller(seller.id)}
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#FF6321] text-white flex items-center justify-center text-xs shadow-md hover:scale-110 transition"
              title="S'abonner"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          )}
        </div>

        {/* Like Button (TikTok Heart) */}
        <button
          id={`btn-like-video-${currentProduct.id}`}
          onClick={() => {
            if (currentProductId) toggleLikeVideo(currentProductId);
          }}
          className="flex flex-col items-center group select-none active:scale-90 transition-transform"
          title="J'aime"
        >
          <div className="transition-transform duration-200 group-active:scale-125">
            <svg 
              viewBox="0 0 24 24" 
              className={`w-9 h-9 filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] transition-colors ${
                isLiked ? 'text-[#FE2C55] fill-[#FE2C55]' : 'text-white fill-white'
              }`}
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
          <span className="text-[11px] font-bold text-white mt-0.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
            {formatMetricCount((currentProduct.videoLikesCount || currentProduct.likesCount || 0) + (isLiked ? 1 : 0))}
          </span>
        </button>

        {/* Comments Button (TikTok Comment Bubble) */}
        <button
          id={`btn-comment-video-${currentProduct.id}`}
          onClick={() => setIsCommentSheetOpen(true)}
          className="flex flex-col items-center group select-none active:scale-90 transition-transform"
          title="Commentaires"
        >
          <div className="transition-transform duration-200 group-active:scale-125">
            <svg 
              viewBox="0 0 24 24" 
              className="w-9 h-9 text-white fill-white filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
            >
              <path d="M12 2C6.48 2 2 6.03 2 11c0 2.76 1.4 5.23 3.61 6.84-.13.93-.52 2.3-1.63 3.48-.22.24-.07.63.26.65 2.12.14 4.09-.76 5.28-1.57.8.21 1.63.32 2.48.32 5.52 0 10-4.03 10-9s-4.48-9-10-9z" />
              <circle cx="8" cy="11" r="1.2" fill="#121212" />
              <circle cx="12" cy="11" r="1.2" fill="#121212" />
              <circle cx="16" cy="11" r="1.2" fill="#121212" />
            </svg>
          </div>
          <span className="text-[11px] font-bold text-white mt-0.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
            {formatMetricCount(productComments.length)}
          </span>
        </button>

        {/* Bookmark / Save Button (TikTok Ribbon) */}
        <button
          id={`btn-save-video-${currentProduct.id}`}
          onClick={() => {
            if (currentProductId) toggleSaveProduct(currentProductId);
          }}
          className="flex flex-col items-center group select-none active:scale-90 transition-transform"
          title="Enregistrer"
        >
          <div className="transition-transform duration-200 group-active:scale-125">
            <svg 
              viewBox="0 0 24 24" 
              className={`w-9 h-9 filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] transition-colors ${
                isSaved ? 'text-[#FACE15] fill-[#FACE15]' : 'text-white fill-white'
              }`}
            >
              <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3.5 7 3.5V5c0-1.1-.9-2-2-2z" />
            </svg>
          </div>
          <span className="text-[11px] font-bold text-white mt-0.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
            {formatMetricCount((currentProduct.savesCount || Math.max(18, Math.floor((currentProduct.likesCount || 100) * 0.22))) + (isSaved ? 1 : 0))}
          </span>
        </button>

        {/* Share Button (TikTok Curved Arrow) */}
        <button
          id={`btn-share-video-${currentProduct.id}`}
          onClick={handleNativeShare}
          className="flex flex-col items-center group select-none active:scale-90 transition-transform"
          title="Partager"
        >
          <div className="transition-transform duration-200 group-active:scale-125">
            <svg 
              viewBox="0 0 24 24" 
              className="w-9 h-9 text-white fill-white filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
            >
              <path d="M14 5v4C7 10 4 15 3 20c2.5-3.5 6-5.1 11-5.1V19l8-7-8-7z" />
            </svg>
          </div>
          <span className="text-[11px] font-bold text-white mt-0.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
            {formatMetricCount(currentProduct.sharesCount || Math.max(8, Math.floor((currentProduct.likesCount || 100) * 0.08)))}
          </span>
        </button>

        {/* Seller Specific Quick Shortcut (Stats / Boost) */}
        {onOpenStats && (
          <button
            onClick={() => onOpenStats(currentProduct)}
            className="flex flex-col items-center group select-none active:scale-90 transition-transform pt-0.5"
            title="Statistiques de la vidéo"
          >
            <div className="transition-transform duration-200 group-active:scale-125">
              <svg 
                viewBox="0 0 24 24" 
                className="w-8 h-8 text-[#00F2FE] fill-[#00F2FE] filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
              >
                <path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zM16.2 13h2.8v6h-2.8z" />
              </svg>
            </div>
            <span className="text-[11px] font-bold text-[#00F2FE] mt-0.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
              Stats
            </span>
          </button>
        )}
      </div>

      {/* 4. BOTTOM PRODUCT OVERLAY (Identical to Client FeedScreen) */}
      <div className="absolute left-4 bottom-3 right-20 z-30 space-y-2 select-none">
        {/* Seller handle badge & Quick Stats Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div
            onClick={() => {
              if (seller) {
                onClose();
                setSelectedSeller(seller);
              }
            }}
            className="inline-flex items-center gap-1.5 cursor-pointer bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/15 hover:bg-black/70 transition shadow-lg"
          >
            <Store className="w-3.5 h-3.5 text-[#FF6321]" />
            <span className="text-xs font-bold text-white">
              @{seller?.username || 'mamadou_tech'}
            </span>
            {seller?.verified && (
              <span className="w-3.5 h-3.5 rounded-full bg-[#FF6321] text-white text-[9px] font-black flex items-center justify-center">
                ✓
              </span>
            )}
          </div>

          <div className="inline-flex items-center gap-1 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/15 text-[11px] font-bold text-emerald-400 shadow-lg">
            <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
            <span>{formatMetricCount(currentProduct.salesCount || 0)} {((currentProduct.salesCount || 0) <= 1) ? 'achat' : 'achats'}</span>
          </div>

          <div className="inline-flex items-center gap-1 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/15 text-[11px] font-bold text-amber-400 shadow-lg">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>{currentProduct.rating || 4.9} ({currentProduct.reviewsCount || Math.max(1, Math.round((currentProduct.salesCount || 10) * 0.15))} avis)</span>
          </div>

          <span className="inline-flex items-center gap-1 bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 px-2.5 py-1 rounded-full text-[11px] font-extrabold shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Vidéo Publiée
          </span>
        </div>

        {/* Product Title & Expandable Description */}
        <div 
          onClick={() => {
            onClose();
            onSelectProduct(currentProduct);
          }}
          className="cursor-pointer group"
        >
          <h2 className="text-sm sm:text-base font-extrabold text-white leading-tight line-clamp-2 drop-shadow-md group-hover:text-[#FF6321] transition">
            {currentProduct.name}
          </h2>
          {currentProduct.description && (
            <p 
              onClick={(e) => {
                e.stopPropagation();
                setIsDescriptionExpanded(!isDescriptionExpanded);
              }}
              className={`text-xs text-white/80 mt-0.5 leading-snug transition-all ${
                isDescriptionExpanded ? 'line-clamp-none bg-black/60 p-2 rounded-xl border border-white/10' : 'line-clamp-1'
              }`}
            >
              {currentProduct.description}
            </p>
          )}
        </div>

        {/* Price Tag, Discount Badge, Stock, & Direct Buy CTAs */}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {/* Price Container */}
          <div className="flex items-baseline gap-1.5 bg-black/65 backdrop-blur-md px-3 py-1 rounded-xl border border-white/15 shadow-md">
            <span className="text-sm sm:text-base font-black text-[#FF6321]">
              {formatFCFA(currentProduct.price)}
            </span>
            {currentProduct.originalPrice && currentProduct.originalPrice > currentProduct.price && (
              <span className="text-[10px] text-white/50 line-through">
                {formatFCFA(currentProduct.originalPrice)}
              </span>
            )}
          </div>

          {/* Promo Tag */}
          {currentProduct.discountPercentage && (
            <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-bold">
              <Tag className="w-2.5 h-2.5" /> -{currentProduct.discountPercentage}%
            </span>
          )}

          {/* Stock Tag */}
          <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
            <Check className="w-3 h-3" /> En stock
          </span>

          {/* CTAs: Voir produit & Acheter (Acheter masqué dans l'application vendeur) */}
          <div className="ml-auto flex items-center gap-1.5">
            <button
              id={`btn-view-product-${currentProduct.id}`}
              onClick={() => {
                onClose();
                onSelectProduct(currentProduct);
              }}
              className="px-3.5 py-1.5 rounded-full bg-black/65 hover:bg-black/85 text-white border border-white/20 font-extrabold text-xs shadow-lg transition flex items-center gap-1 active:scale-95"
            >
              <span>Voir produit</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {!isSellerView && (
              <button
                id={`btn-direct-buy-${currentProduct.id}`}
                onClick={() => {
                  setVariantModalProduct(currentProduct);
                  setIsVariantModalDirectBuy(true);
                }}
                className="px-3.5 py-1.5 rounded-full bg-[#FF6321] hover:bg-[#ff7538] text-white font-extrabold text-xs shadow-lg shadow-orange-600/30 transition flex items-center gap-1 active:scale-95"
              >
                <span>Acheter</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. INTERACTIVE COMMENTS BOTTOM SHEET (Exact replica of FeedScreen comments) */}
      {isCommentSheetOpen && (
        <div
          id="video-comments-bottom-sheet"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-150"
          onClick={() => setIsCommentSheetOpen(false)}
        >
          <div
            className="w-full max-h-[70vh] bg-[#141414] rounded-t-3xl border-t border-white/15 flex flex-col p-4 shadow-2xl animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-[#FF6321]" />
                Commentaires ({productComments.length})
              </span>
              <button
                onClick={() => setIsCommentSheetOpen(false)}
                className="p-1 rounded-full bg-white/10 text-white/60 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto py-3 space-y-3 no-scrollbar max-h-80">
              {productComments.length === 0 ? (
                <div className="py-8 text-center space-y-1 text-white/50">
                  <Sparkles className="w-7 h-7 text-[#FF6321] mx-auto opacity-70 mb-2" />
                  <p className="text-xs font-semibold text-white/80">Aucun commentaire pour le moment</p>
                  <p className="text-[11px] text-white/50">Soyez le premier à commenter cette publication !</p>
                </div>
              ) : (
                productComments.map((comm) => (
                  <div key={comm.id} className="space-y-1.5">
                    <div className="flex items-start gap-2.5">
                      <img
                        src={comm.userAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                        alt={comm.userName}
                        className="w-8 h-8 rounded-full object-cover border border-white/10"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white/90 truncate">{comm.userName}</span>
                          <span className="text-[10px] text-white/40 shrink-0">{comm.timestamp}</span>
                        </div>
                        <p className="text-xs text-white/80 mt-0.5">{comm.content}</p>
                      </div>
                    </div>

                    {/* Replies if any */}
                    {comm.replies && comm.replies.map((reply) => (
                      <div key={reply.id} className="ml-10 flex items-start gap-2 bg-white/5 p-2 rounded-xl">
                        <img
                          src={reply.userAvatar}
                          alt={reply.userName}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-[#FF6321]">{reply.userName}</span>
                            <span className="text-[9px] text-white/40">{reply.timestamp}</span>
                          </div>
                          <p className="text-[11px] text-white/80 mt-0.5">{reply.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>

            {/* Comment Form Input */}
            <form onSubmit={handleAddCommentSubmit} className="pt-2 border-t border-white/10 flex items-center gap-2">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Écrire un commentaire..."
                className="flex-1 bg-white/10 border border-white/15 rounded-full px-4 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]"
              />
              <button
                type="submit"
                disabled={!newCommentText.trim()}
                className="p-2 rounded-full bg-[#FF6321] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-95 transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
