import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Heart,
  Sparkles,
  MessageCircle,
  Check,
  Layers,
  Store,
  Tag,
  Plus,
  Send,
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

export const PhotoDetailModal: React.FC<Props> = ({
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
    openTryOnModal,
  } = useApp();

  // Mode Vendeur : l'application vendeur ne doit pas afficher les actions d'achat client
  const isSellerView = accountRole === 'seller' || Boolean(onOpenStats) || Boolean(onOpenBoost);

  // Combine products list: prioritize allProducts if provided, else fallback to initialProduct
  const productList = allProducts.length > 0 ? allProducts : (initialProduct ? [initialProduct] : []);

  // Determine current product index
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (!initialProduct) return 0;
    const foundIdx = productList.findIndex((p) => p.id === initialProduct.id);
    return foundIdx >= 0 ? foundIdx : 0;
  });

  const currentProduct = productList[currentIndex] || productList[0] || initialProduct;
  const currentProductId = currentProduct?.id;

  // Active image within the current multi-image product
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // When product changes, reset active image index to 0
  useEffect(() => {
    setActiveImageIndex(0);
    setIsDescriptionExpanded(false);
  }, [currentIndex, currentProduct]);

  // UI States
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isCommentSheetOpen, setIsCommentSheetOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [showLikeHeartAnimation, setShowLikeHeartAnimation] = useState(false);

  // Touch gesture refs
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const lastWheelTime = useRef<number>(0);
  const lastTapTime = useRef<number>(0);

  const images = currentProduct
    ? (currentProduct.images && currentProduct.images.length > 0
        ? currentProduct.images
        : [currentProduct.videoPoster || 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600'])
    : [];

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

  const goToNextImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (images.length === 0) return;
    setActiveImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const goToPrevImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (images.length === 0) return;
    setActiveImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  // Keyboard navigation (declared unconditionally before early return per Rules of Hooks C-03)
  useEffect(() => {
    if (!currentProduct) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCommentSheetOpen) return;
      if (e.key === 'ArrowDown') {
        goToNextProduct();
      } else if (e.key === 'ArrowUp') {
        goToPrevProduct();
      } else if (e.key === 'ArrowRight') {
        goToNextImage();
      } else if (e.key === 'ArrowLeft') {
        goToPrevImage();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentProduct, currentIndex, activeImageIndex, productList.length, images.length, isCommentSheetOpen]);

  if (!currentProduct) return null;

  const seller = sellers.find((s) => s.id === currentProduct.sellerId);
  const isLiked = userProfile?.likedVideoIds?.includes(currentProduct.id) || false;
  const isSaved = userProfile?.savedItemIds?.includes(currentProduct.id) || false;
  const isFollowed = seller ? userProfile?.followedSellerIds?.includes(seller.id) : false;
  const productComments = (currentProductId && comments[currentProductId]) || [];
  const currentImage = images[activeImageIndex] || images[0];

  // Touch gesture listeners for horizontal swipe (images) and vertical swipe (products)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    touchStartY.current = e.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const endY = e.changedTouches[0]?.clientY ?? touchStartY.current;
    const deltaX = touchStartX.current - endX;
    const deltaY = touchStartY.current - endY;
    touchStartX.current = null;
    touchStartY.current = null;

    // Determine if gesture is predominantly horizontal or vertical
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      // Vertical swipe: change product
      if (Math.abs(deltaY) > 40) {
        if (deltaY > 0) {
          goToNextProduct();
        } else {
          goToPrevProduct();
        }
      }
    } else {
      // Horizontal swipe: change photo of this product
      if (Math.abs(deltaX) > 40 && images.length > 1) {
        if (deltaX > 0) {
          goToNextImage();
        } else {
          goToPrevImage();
        }
      }
    }
  };

  // Wheel listener for smooth mouse scroll
  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    if (now - lastWheelTime.current < 450) return;
    if (Math.abs(e.deltaY) > 35) {
      lastWheelTime.current = now;
      if (e.deltaY > 0) {
        goToNextProduct();
      } else {
        goToPrevProduct();
      }
    }
  };

  // Double tap to like on photo
  const handlePhotoClick = (e: React.MouseEvent) => {
    const now = Date.now();
    if (now - lastTapTime.current < 300) {
      // Double tap detected!
      if (!isLiked && currentProductId) {
        toggleLikeVideo(currentProductId);
      }
      setShowLikeHeartAnimation(true);
      setTimeout(() => setShowLikeHeartAnimation(false), 900);
      lastTapTime.current = 0;
    } else {
      lastTapTime.current = now;
    }
  };

  // Sharing handler
  const handleCopyLink = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const shareUrl = `${window.location.origin}/?product=${encodeURIComponent(currentProduct.id)}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).catch(() => {});
      showToast('Lien copié dans le presse-papiers 📋');
    }
  };

  const handleNativeShare = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const shareUrl = `${window.location.origin}/?product=${encodeURIComponent(currentProduct.id)}`;
    if (navigator.share) {
      navigator.share({
        title: currentProduct.name,
        text: `Découvre ${currentProduct.name} sur Djassa !`,
        url: shareUrl,
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
      id="photo-feed-detail-viewer"
      className="fixed inset-0 z-[120] bg-black overflow-hidden flex flex-col items-center justify-center animate-in fade-in duration-200"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* 1. TOP HEADER NAVIGATION */}
      <div className="absolute top-0 left-0 right-0 z-40 pt-safe px-4 py-3 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/50 to-transparent">
        {/* Close / Back Button */}
        <button
          id="btn-close-photo-detail"
          onClick={onClose}
          className="p-2.5 rounded-full bg-black/50 hover:bg-black/80 text-white/90 hover:text-white backdrop-blur-md border border-white/10 transition active:scale-90"
          title="Fermer"
          aria-label="Fermer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* 2. MEDIA DISPLAY STAGE (FULL SCREEN PHOTO IMMERSION) */}
      <div 
        className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-pointer"
        onClick={handlePhotoClick}
      >
        {/* Ambient blurred backdrop for widescreen / mobile immersion */}
        <img
          src={currentImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-35 scale-110 pointer-events-none transition-all duration-500"
          aria-hidden="true"
        />

        {/* Main High-Res Image */}
        <img
          key={`${currentProduct.id}-${activeImageIndex}`}
          src={currentImage}
          alt={currentProduct.name}
          className="relative z-10 max-w-full max-h-full w-auto h-auto object-contain select-none transition duration-300 pointer-events-none"
        />

        {/* Gradient overlays matching TikTok / FeedScreen */}
        <div className="absolute inset-0 z-20 pointer-events-none bg-gradient-to-b from-black/60 via-transparent to-black/95" />

        {/* Multi-Photo Dots / Indicator (if multiple photos) */}
        {images.length > 1 && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 shadow-lg">
            <Layers className="w-3 h-3 text-[#FF6321]" />
            <span className="text-[11px] font-black text-white">
              {activeImageIndex + 1} / {images.length}
            </span>
            <div className="flex items-center gap-1 ml-1.5">
              {images.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === activeImageIndex ? 'w-4 bg-[#FF6321]' : 'w-1.5 bg-white/40'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Left & Right Chevron Arrows for Photo Gallery within Product (Desktop / Hover) */}
        {images.length > 1 && (
          <>
            <button
              onClick={goToPrevImage}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white flex items-center justify-center border border-white/20 backdrop-blur-md transition active:scale-90"
              aria-label="Photo précédente"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={goToNextImage}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white flex items-center justify-center border border-white/20 backdrop-blur-md transition active:scale-90"
              aria-label="Photo suivante"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Vertical Navigation Chevrons (Up / Down for desktop & quick navigation) */}
        {productList.length > 1 && (
          <div className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-30 flex-col gap-2">
            <button
              onClick={goToPrevProduct}
              disabled={currentIndex === 0}
              className={`p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/80 transition ${
                currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/80 hover:text-white active:scale-90'
              }`}
              title="Publication précédente (Flèche Haut)"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
            <button
              onClick={goToNextProduct}
              disabled={currentIndex === productList.length - 1}
              className={`p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/80 transition ${
                currentIndex === productList.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/80 hover:text-white active:scale-90'
              }`}
              title="Publication suivante (Flèche Bas)"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Double-tap Heart Pop Animation */}
        {showLikeHeartAnimation && (
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none animate-in zoom-in duration-200">
            <Heart className="w-28 h-28 text-rose-500 fill-rose-500 drop-shadow-2xl animate-bounce" />
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
          id={`btn-like-photo-${currentProduct.id}`}
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
            {formatMetricCount((currentProduct.likesCount || 0) + (isLiked ? 1 : 0))}
          </span>
        </button>

        {/* Comments Button (TikTok Comment Bubble) */}
        <button
          id={`btn-comment-photo-${currentProduct.id}`}
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

        {/* Google Shopping Virtual Try-On Button (Bouton d'essayage) */}
        {!isSellerView && (
          <button
            id={`btn-tryon-photo-${currentProduct.id}`}
            onClick={() => openTryOnModal(currentProduct)}
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
                  fill="url(#sparkle-grad-photo-tryon-btn)"
                />
                <path
                  d="M12 9C10.5 9 9.5 10 9.5 11.2C9.5 12.5 10.8 13.2 12 13.8L19.5 17.5C20.4 18 20.8 19 20.2 19.8C19.7 20.5 18.6 20.7 17.7 20.2L12 17.2L6.3 20.2C5.4 20.7 4.3 20.5 3.8 19.8C3.2 19 3.6 18 4.5 17.5L12 13.8V12"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <defs>
                  <linearGradient id="sparkle-grad-photo-tryon-btn" x1="6" y1="2" x2="18" y2="14" gradientUnits="userSpaceOnUse">
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
        )}

        {/* Bookmark / Save Button (TikTok Ribbon) */}
        <button
          id={`btn-save-photo-${currentProduct.id}`}
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
            {formatMetricCount((currentProduct.savesCount || 0) + (isSaved ? 1 : 0))}
          </span>
        </button>

        {/* Share Button (TikTok Curved Arrow) */}
        <button
          id={`btn-share-photo-${currentProduct.id}`}
          onClick={handleNativeShare}
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
            {formatMetricCount(currentProduct.sharesCount || 0)}
          </span>
        </button>

        {/* Seller Specific Quick Shortcut (Stats / Boost) */}
        {onOpenStats && (
          <button
            onClick={() => onOpenStats(currentProduct)}
            className="flex flex-col items-center group select-none active:scale-90 transition-transform pt-0.5"
            title="Statistiques de la photo"
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
      <div className="absolute left-4 bottom-3 right-20 z-30 space-y-2">
        {/* Seller handle badge */}
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
              @{seller?.username || 'boutique'}
            </span>
            {seller?.verified && (
              <span className="w-3.5 h-3.5 rounded-full bg-[#FF6321] text-white text-[9px] font-black flex items-center justify-center">
                ✓
              </span>
            )}
          </div>
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
          {currentProduct.inStock && (currentProduct.stock ?? 0) > 0 ? (
            <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
              <Check className="w-3 h-3" /> En stock
            </span>
          ) : (
            <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-bold">
              Rupture de stock
            </span>
          )}

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
                disabled={!currentProduct.inStock || (currentProduct.stock ?? 0) <= 0}
                onClick={() => {
                  setVariantModalProduct(currentProduct);
                  setIsVariantModalDirectBuy(true);
                }}
                className="px-3.5 py-1.5 rounded-full bg-[#FF6321] hover:bg-[#ff7538] disabled:bg-white/15 disabled:text-white/40 disabled:cursor-not-allowed text-white font-extrabold text-xs shadow-lg shadow-orange-600/30 transition flex items-center gap-1 active:scale-95"
              >
                <span>{!currentProduct.inStock || (currentProduct.stock ?? 0) <= 0 ? 'Épuisé' : 'Acheter'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. INTERACTIVE COMMENTS BOTTOM SHEET (Exact replica of FeedScreen comments) */}
      {isCommentSheetOpen && (
        <div
          id="photo-comments-bottom-sheet"
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
