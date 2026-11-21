import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import {
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Heart,
  Volume2,
  VolumeX,
  Store,
  ChevronRight,
  Tag,
  Check,
  Play,
  Pause,
  Plus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatFCFA, formatMetricCount } from '../../services/marketServices';
import { Product } from '../../types';

const CommentsBottomSheet = lazy(() =>
  import('./CommentsBottomSheet').then((m) => ({ default: m.CommentsBottomSheet }))
);

/**
 * Universal TikTok-style video viewer used across the app (Boutique, Profile, Explorer, etc.).
 * Fully replicates the rich immersion of the client home feed.
 */
export const ExplorerVideoViewer: React.FC = () => {
  const {
    requireAuth,
    commentBottomSheetProductId,
    setCommentBottomSheetProductId,
    selectedVideoProduct,
    setSelectedVideoProduct,
    videoViewerProducts,
    sellers,
    userProfile,
    toggleLikeVideo,
    toggleSaveProduct,
    toggleFollowSeller,
    setSelectedSeller,
    setSelectedProduct,
    setVariantModalProduct,
    setIsVariantModalDirectBuy,
    comments,
    addComment,
    trackVideoWatch,
    showToast,
    openTryOnModal,
  } = useApp();

  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showPlayPauseIcon, setShowPlayPauseIcon] = useState<'play' | 'pause' | null>(null);
  const [showLikeHeartAnimation, setShowLikeHeartAnimation] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isCommentSheetOpen, setIsCommentSheetOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');

  const touchStartY = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastWheelTime = useRef<number>(0);
  const lastTapTime = useRef<number>(0);
  const iconTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const products = selectedVideoProduct
    ? (videoViewerProducts.length ? videoViewerProducts : [selectedVideoProduct])
    : [];
  const currentIndex = selectedVideoProduct
    ? Math.max(0, products.findIndex((p) => p.id === selectedVideoProduct.id))
    : 0;
  const product = selectedVideoProduct ? (products[currentIndex] || selectedVideoProduct) : null;
  const seller = product ? sellers.find((s) => s.id === product.sellerId) : undefined;
  const isLiked = product ? userProfile?.likedVideoIds?.includes(product.id) : false;
  const isSaved = product ? userProfile?.savedItemIds?.includes(product.id) : false;
  const isFollowed = seller ? userProfile?.followedSellerIds?.includes(seller.id) : false;
  const productComments = product ? (comments[product.id] || []) : [];

  const [videoError, setVideoError] = useState(false);
  const watchStartRef = useRef<number>(Date.now());

  useEffect(() => {
    if (product?.id && commentBottomSheetProductId === product.id) {
      setIsCommentSheetOpen(true);
      setCommentBottomSheetProductId(null);
    }
  }, [product?.id, commentBottomSheetProductId, setCommentBottomSheetProductId]);

  useEffect(() => {
    if (!product?.id) return;
    setIsDescriptionExpanded(false);
    setIsPlaying(true);
    setVideoError(false);
    watchStartRef.current = Date.now();
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
    const targetId = product.id;
    return () => {
      const elapsedSec = Math.max(1, Math.round((Date.now() - watchStartRef.current) / 1000));
      const vid = videoRef.current;
      const completed =
        vid && vid.duration && Number.isFinite(vid.duration)
          ? (vid.currentTime / vid.duration) >= 0.85 || elapsedSec >= 8
          : elapsedSec >= 4;
      if (elapsedSec >= 2) {
        trackVideoWatch(targetId, elapsedSec, completed);
      }
    };
  }, [product?.id, trackVideoWatch]);

  const goTo = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= products.length) return;
    setSelectedVideoProduct(products[nextIndex]);
  };

  // Keyboard navigation (declared unconditionally before early return per Rules of Hooks C-03)
  useEffect(() => {
    if (!product) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCommentSheetOpen) return;
      if (e.key === 'ArrowDown') {
        goTo(currentIndex + 1);
      } else if (e.key === 'ArrowUp') {
        goTo(currentIndex - 1);
      } else if (e.key === 'Escape') {
        setSelectedVideoProduct(null);
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlayPause();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [product, currentIndex, products.length, isCommentSheetOpen]);

  if (!product) return null;

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

  const handleVideoClick = () => {
    const now = Date.now();
    if (now - lastTapTime.current < 300) {
      if (!isLiked) {
        toggleLikeVideo(product.id);
      }
      setShowLikeHeartAnimation(true);
      setTimeout(() => setShowLikeHeartAnimation(false), 900);
      lastTapTime.current = 0;
    } else {
      lastTapTime.current = now;
      togglePlayPause();
    }
  };

  const handleCopyLink = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const shareUrl = `${window.location.origin}/?product=${encodeURIComponent(product.id)}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).catch(() => {});
      showToast?.('Lien copié dans le presse-papiers 📋');
    }
  };

  const handleShare = (item: Product) => {
    const shareUrl = `${window.location.origin}/?product=${encodeURIComponent(item.id)}`;
    if (navigator.share) {
      navigator.share({
        title: item.name,
        text: `Découvre ${item.name} sur Djassa !`,
        url: shareUrl,
      }).catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const endY = e.changedTouches[0]?.clientY ?? touchStartY.current;
    const delta = touchStartY.current - endY;
    touchStartY.current = null;
    if (Math.abs(delta) < 45) return;
    goTo(currentIndex + (delta > 0 ? 1 : -1));
  };

  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    if (now - lastWheelTime.current < 450) return;
    if (Math.abs(e.deltaY) > 30) {
      lastWheelTime.current = now;
      goTo(currentIndex + (e.deltaY > 0 ? 1 : -1));
    }
  };

  const handleAddCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !product.id) return;
    addComment(product.id, newCommentText.trim());
    setNewCommentText('');
    showToast?.('Commentaire publié ! ✨');
  };

  return (
    <div
      id="explorer-video-viewer-modal"
      className="fixed inset-0 z-[120] bg-black flex flex-col items-center justify-center overflow-hidden animate-in fade-in duration-200"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* 1. TOP HEADER NAVIGATION */}
      <div className="absolute top-0 left-0 right-0 z-40 pt-safe px-4 py-3 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/50 to-transparent">
        <button
          id="btn-close-video-viewer"
          onClick={() => setSelectedVideoProduct(null)}
          className="p-2.5 rounded-full bg-black/50 hover:bg-black/80 text-white/90 hover:text-white backdrop-blur-md border border-white/10 transition active:scale-90"
          aria-label="Fermer la vidéo"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Right Controls: Sound Toggle */}
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
        </div>
      </div>

      {/* 2. MEDIA DISPLAY STAGE (FULL SCREEN VIDEO IMMERSION) */}
      <div 
        className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-pointer"
        onClick={handleVideoClick}
      >
        {/* Ambient blurred backdrop */}
        {product.videoPoster && (
          <img
            src={product.videoPoster}
            alt=""
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-35 scale-110 pointer-events-none transition-all duration-500"
            aria-hidden="true"
          />
        )}

        {videoError ? (
          <div className="relative z-20 p-5 rounded-2xl bg-black/80 border border-white/15 text-center space-y-2 max-w-xs">
            <p className="text-xs font-bold text-white">Erreur de lecture vidéo</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setVideoError(false);
              }}
              className="px-4 py-1.5 rounded-full bg-[#FF6321] text-white text-xs font-bold cursor-pointer"
            >
              Réessayer
            </button>
          </div>
        ) : (
          <video
            ref={videoRef}
            key={product.id}
            src={product.videoUrl}
            poster={product.videoPoster || product.images[0]}
            preload="auto"
            className="relative z-10 w-full h-full object-cover pointer-events-none"
            autoPlay
            loop
            playsInline
            muted={isMuted}
            onError={() => setVideoError(true)}
          />
        )}

        <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-b from-black/60 via-transparent to-black/95" />

        {/* Play / Pause transient indicator */}
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

        {/* Vertical Navigation Chevrons (Desktop) */}
        {products.length > 1 && (
          <div className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-30 flex-col gap-2 pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                goTo(currentIndex - 1);
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
                goTo(currentIndex + 1);
              }}
              disabled={currentIndex === products.length - 1}
              className={`p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/80 transition ${
                currentIndex === products.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/80 hover:text-white active:scale-90'
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
        <div className="relative mb-1">
          <img
            src={seller?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
            alt={seller?.name || 'Vendeur'}
            loading="lazy"
            decoding="async"
            onClick={() => {
              if (seller) {
                setSelectedVideoProduct(null);
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

        {/* Like (TikTok Heart) */}
        <button
          onClick={() => toggleLikeVideo(product.id)}
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
            {formatMetricCount((product.videoLikesCount || product.likesCount || 0) + (isLiked ? 1 : 0))}
          </span>
        </button>

        {/* Comments (TikTok Speech Bubble) */}
        <button
          onClick={() => {
            if (!requireAuth('comment', { type: 'comment', productId: product.id })) return;
            setIsCommentSheetOpen(true);
          }}
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

        {/* Google Shopping Virtual Try-On Button (Bouton d'essayage) */}
        <button
          id={`btn-tryon-video-${product.id}`}
          onClick={() => openTryOnModal(product)}
          className="flex flex-col items-center group select-none active:scale-90 transition-transform cursor-pointer"
          title="Essayer cette tenue (Google Shopping Try On)"
        >
          <div className="relative p-1.5 rounded-full bg-gradient-to-tr from-[#4285F4]/40 via-[#EA4335]/30 to-[#34A853]/40 backdrop-blur-md border border-white/30 shadow-2xl transition-transform duration-200 group-hover:scale-115 group-active:scale-125">
            <svg
              viewBox="0 0 24 24"
              className="w-7 h-7 filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
              fill="none"
            >
              <path
                d="M12 2C12.4 5.3 14.7 7.6 18 8C14.7 8.4 12.4 10.7 12 14C11.6 10.7 9.3 8.4 6 8C9.3 7.6 11.6 5.3 12 2Z"
                fill="url(#sparkle-grad-video-tryon-btn)"
              />
              <path
                d="M12 9C10.5 9 9.5 10 9.5 11.2C9.5 12.5 10.8 13.2 12 13.8L19.5 17.5C20.4 18 20.8 19 20.2 19.8C19.7 20.5 18.6 20.7 17.7 20.2L12 17.2L6.3 20.2C5.4 20.7 4.3 20.5 3.8 19.8C3.2 19 3.6 18 4.5 17.5L12 13.8V12"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="sparkle-grad-video-tryon-btn" x1="6" y1="2" x2="18" y2="14" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#4285F4" />
                  <stop offset="35%" stopColor="#EA4335" />
                  <stop offset="70%" stopColor="#FBBC05" />
                  <stop offset="100%" stopColor="#34A853" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="text-[10px] font-black text-white mt-0.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] flex items-center gap-0.5 tracking-tight">
            <span className="text-[#FBBC05]">✦</span>
            <span>Essayer</span>
          </span>
        </button>

        {/* Save (TikTok Ribbon) */}
        <button
          onClick={() => toggleSaveProduct(product.id)}
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
            {formatMetricCount((product.savesCount || 0) + (isSaved ? 1 : 0))}
          </span>
        </button>

        {/* Share (TikTok Curved Arrow) */}
        <button
          onClick={() => handleShare(product)}
          className="flex flex-col items-center group active:scale-90 transition-transform"
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
            {formatMetricCount(product.sharesCount || 0)}
          </span>
        </button>
      </div>

      {/* 4. BOTTOM PRODUCT OVERLAY (Identical to Client FeedScreen) */}
      <div className="absolute left-4 bottom-3 right-20 z-30 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div
            onClick={() => {
              if (seller) {
                setSelectedVideoProduct(null);
                setSelectedSeller(seller);
              }
            }}
            className="inline-flex items-center gap-1.5 cursor-pointer bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/15 hover:bg-black/70 transition shadow-lg"
          >
            <Store className="w-3.5 h-3.5 text-[#FF6321]" />
            <span className="text-xs font-bold text-white">@{seller?.username || 'vendeur'}</span>
            {seller?.verified && (
              <span className="w-3.5 h-3.5 rounded-full bg-[#FF6321] text-white text-[9px] font-black flex items-center justify-center">
                ✓
              </span>
            )}
          </div>
        </div>

        <div 
          onClick={() => {
            setSelectedVideoProduct(null);
            setSelectedProduct(product);
          }}
          className="cursor-pointer group"
        >
          <h2 className="text-sm sm:text-base font-extrabold text-white leading-tight line-clamp-2 drop-shadow-md group-hover:text-[#FF6321] transition">
            {product.name}
          </h2>
          {product.description && (
            <p 
              onClick={(e) => {
                e.stopPropagation();
                setIsDescriptionExpanded(!isDescriptionExpanded);
              }}
              className={`text-xs text-white/80 mt-0.5 leading-snug transition-all ${
                isDescriptionExpanded ? 'line-clamp-none bg-black/60 p-2 rounded-xl border border-white/10' : 'line-clamp-1'
              }`}
            >
              {product.description}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <div className="flex items-baseline gap-1.5 bg-black/65 backdrop-blur-md px-3 py-1 rounded-xl border border-white/15 shadow-md">
            <span className="text-sm sm:text-base font-black text-[#FF6321]">{formatFCFA(product.price)}</span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="text-[10px] text-white/50 line-through">{formatFCFA(product.originalPrice)}</span>
            )}
          </div>

          {product.discountPercentage && (
            <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-bold">
              <Tag className="w-2.5 h-2.5" /> -{product.discountPercentage}%
            </span>
          )}

          {product.inStock && (product.stock ?? 0) > 0 ? (
            <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
              <Check className="w-3 h-3" /> En stock
            </span>
          ) : (
            <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-bold">
              Rupture de stock
            </span>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => {
                setSelectedVideoProduct(null);
                setSelectedProduct(product);
              }}
              className="px-3.5 py-1.5 rounded-full bg-black/65 hover:bg-black/85 text-white border border-white/20 font-extrabold text-xs shadow-lg transition flex items-center gap-1 active:scale-95"
            >
              <span>Voir produit</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              disabled={!product.inStock || (product.stock ?? 0) <= 0}
              onClick={() => {
                if (!requireAuth('purchase', { type: 'buy_direct', product })) return;
                setVariantModalProduct(product);
                setIsVariantModalDirectBuy(true);
              }}
              className="px-3.5 py-1.5 rounded-full bg-[#FF6321] hover:bg-[#ff7538] disabled:bg-white/15 disabled:text-white/40 disabled:cursor-not-allowed text-white font-extrabold text-xs shadow-lg shadow-orange-600/30 transition flex items-center gap-1 active:scale-95"
            >
              <span>{!product.inStock || (product.stock ?? 0) <= 0 ? 'Épuisé' : 'Acheter'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 5. INTERACTIVE COMMENTS BOTTOM SHEET */}
      {isCommentSheetOpen && product && (
        <Suspense fallback={null}>
          <CommentsBottomSheet
            productId={product.id}
            isOpen={isCommentSheetOpen}
            onClose={() => setIsCommentSheetOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
};
