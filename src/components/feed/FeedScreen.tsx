import React, { useState, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import { 
  Heart, 
  MessageCircle, 
  Bookmark, 
  Share2, 
  Volume2, 
  VolumeX, 
  Store, 
  ChevronRight, 
  ChevronLeft,
  Send, 
  X, 
  Plus, 
  Check, 
  Tag, 
  Sparkles,
  Search,
  Camera,
  Layers,
  Eye,
  User,
  ArrowLeft,
  Headphones,
  ShoppingBag
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatFCFA, formatMetricCount } from '../../services/marketServices';
import { Product } from '../../types';

const CommentsBottomSheet = lazy(() =>
  import('./CommentsBottomSheet').then((m) => ({ default: m.CommentsBottomSheet }))
);

export const FeedScreen: React.FC = () => {
  const { 
    isAuthenticated,
    requireAuth,
    openAuthModal,
    products, 
    sellers, 
    feedSubTab, 
    setFeedSubTab, 
    userProfile, 
    toggleLikeVideo, 
    toggleSaveProduct, 
    toggleFollowSeller, 
    setSelectedProduct, 
    setSelectedSeller, 
    setVariantModalProduct, 
    setIsVariantModalDirectBuy,
    comments,
    addComment,
    commentBottomSheetProductId,
    setCommentBottomSheetProductId,
    setActiveTab,
    trackVideoWatch,
    openPhotoViewer,
    openTryOnModal,
    openAiVideoModal,
    aiCredits,
    setIsCreditModalOpen,
    openCreditModal,
    feedTargetProductId,
    setFeedTargetProductId,
    feedReturnProduct,
    setFeedReturnProduct,
    returnToLiveVoiceAvailable,
    setReturnToLiveVoiceAvailable,
    setIsVoiceModeOpen,
    liveAiProducts,
    setLiveAiProducts,
    hideBottomNav,
    setHideBottomNav
  } = useApp();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [newCommentText, setNewCommentText] = useState('');
  const [activeImageIndices, setActiveImageIndices] = useState<Record<string, number>>({});
  const [doubleTapHeartProductId, setDoubleTapHeartProductId] = useState<string | null>(null);
  const [videoErrors, setVideoErrors] = useState<Record<string, boolean>>({});
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const lastTapTimeRef = useRef<Record<string, number>>({});
  const feedContainerRef = useRef<HTMLDivElement | null>(null);
  const watchStartRef = useRef<{ id: string; startedAt: number }>({ id: '', startedAt: Date.now() });

  // When viewing products proposed by Live IA
  const isLiveAiMode = Boolean(returnToLiveVoiceAvailable && liveAiProducts && liveAiProducts.length > 0);

  // Keep bottom nav hidden only in full-screen live AI mode
  useEffect(() => {
    if (isLiveAiMode) {
      setHideBottomNav(true);
    } else {
      setHideBottomNav(false);
    }
  }, [isLiveAiMode, setHideBottomNav]);

  // Filter products by sub-tab
  // TikTok-style home feed: includes BOTH videos AND photos published by sellers!
  const allFeedPublications = useMemo(() => {
    return products.filter((product) => {
      const isVideo = product.mediaType === 'video' && Boolean(product.videoUrl);
      const isPhoto = (product.images && product.images.length > 0) || product.mediaType === 'image';
      return isVideo || isPhoto;
    });
  }, [products]);

  const allPhotoProducts = useMemo(() => {
    return products.filter(
      (product) => (product.images && product.images.length > 0) || product.mediaType === 'image'
    );
  }, [products]);

  // When coming from Live IA, user can scroll ONLY on products proposed by the Live IA!
  const filteredProducts = useMemo(() => {
    if (isLiveAiMode) {
      return liveAiProducts;
    }
    return allFeedPublications.filter((product) => {
      if (feedSubTab === 'promo') {
        return product.isPromotion || (product.discountPercentage && product.discountPercentage > 0);
      }
      if (feedSubTab === 'suivi') {
        return userProfile.followedSellerIds.includes(product.sellerId);
      }
      return true; // 'pour_toi'
    });
  }, [isLiveAiMode, liveAiProducts, allFeedPublications, feedSubTab, userProfile.followedSellerIds]);

  const sellersById = useMemo(() => new Map(sellers.map((s) => [s.id, s])), [sellers]);
  const likedSet = useMemo(() => new Set(userProfile.likedVideoIds), [userProfile.likedVideoIds]);
  const savedSet = useMemo(() => new Set(userProfile.savedItemIds), [userProfile.savedItemIds]);
  const followedSet = useMemo(() => new Set(userProfile.followedSellerIds), [userProfile.followedSellerIds]);

  const currentProduct = filteredProducts[currentIndex] || filteredProducts[0];
  const currentProductId = currentProduct?.id;
  const trackedVideosRef = useRef<Set<string>>(new Set());

  // Play/pause video based on visibility
  useEffect(() => {
    if (!currentProductId) return;

    Object.entries(videoRefs.current).forEach(([id, videoEl]) => {
      if (!videoEl) return;
      if (currentProductId === id) {
        videoEl.play().catch(() => {});
      } else {
        videoEl.pause();
      }
    });
  }, [currentProductId]);

  // Track real elapsed watch duration when switching away from a feed publication (C-02)
  useEffect(() => {
    if (!currentProductId) return;
    watchStartRef.current = { id: currentProductId, startedAt: Date.now() };

    return () => {
      const elapsedSec = Math.max(1, Math.round((Date.now() - watchStartRef.current.startedAt) / 1000));
      const vid = videoRefs.current[currentProductId];
      const completed =
        vid && vid.duration && Number.isFinite(vid.duration)
          ? (vid.currentTime / vid.duration) >= 0.85 || elapsedSec >= 8
          : elapsedSec >= 4;
      if (elapsedSec >= 2 && !trackedVideosRef.current.has(`${currentProductId}:${elapsedSec >= 4 ? 'full' : 'view'}`)) {
        trackedVideosRef.current.add(`${currentProductId}:${elapsedSec >= 4 ? 'full' : 'view'}`);
        trackVideoWatch(currentProductId, elapsedSec, completed);
      }
    };
  }, [currentProductId, trackVideoWatch]);

  // Automatically scroll and focus on target product when navigated from other views
  useEffect(() => {
    if (!feedTargetProductId) return;
    const foundIndex = filteredProducts.findIndex((p) => p.id === feedTargetProductId);
    if (foundIndex >= 0) {
      setCurrentIndex(foundIndex);
      const container = feedContainerRef.current;
      if (container) {
        container.scrollTo({
          top: foundIndex * container.clientHeight,
          behavior: 'auto'
        });
      }
    }
    setFeedTargetProductId(null);
  }, [feedTargetProductId, filteredProducts, setFeedTargetProductId]);

  const handlePhotoDoubleTap = (product: Product) => {
    const now = Date.now();
    const lastTap = lastTapTimeRef.current[product.id] || 0;
    if (now - lastTap < 350) {
      if (!userProfile.likedVideoIds.includes(product.id)) {
        toggleLikeVideo(product.id);
      }
      setDoubleTapHeartProductId(product.id);
      setTimeout(() => {
        setDoubleTapHeartProductId((current) => (current === product.id ? null : current));
      }, 800);
      lastTapTimeRef.current[product.id] = 0;
    } else {
      lastTapTimeRef.current[product.id] = now;
    }
  };

  const handleShare = (product: Product) => {
    const shareUrl = `${window.location.origin}/?product=${encodeURIComponent(product.id)}`;
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: `Découvre ${product.name} sur Djassa !`,
        url: shareUrl,
      }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).catch(() => {});
    }
  };

  const handleAddCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !commentBottomSheetProductId) return;
    addComment(commentBottomSheetProductId, newCommentText.trim());
    setNewCommentText('');
  };

  return (
    <div 
      id="feed-screen-container" 
      className={`relative w-full h-full bg-black overflow-hidden ${
        isLiveAiMode || hideBottomNav ? 'pb-0' : 'pb-16'
      }`}
    >
      {/* TOP HEADER SUB-TABS */}
      <div className="absolute top-0 left-0 right-0 z-30 pt-safe px-4 py-3 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        {/* Left: Return buttons and RodiumAI Credits Badge */}
        <div className="flex items-center gap-2">
          {/* Back button to previous product when navigated from similar products */}
          {feedReturnProduct && (
            <button
              id="btn-feed-return-to-previous"
              onClick={() => {
                const prev = feedReturnProduct;
                setFeedReturnProduct(null);
                setSelectedProduct(prev);
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/75 hover:bg-black/95 backdrop-blur-md border border-[#FF6321]/60 text-white font-extrabold text-xs shadow-xl shadow-orange-600/30 transition active:scale-95 cursor-pointer group"
              title="Revenir à l'article précédent"
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-r from-[#FF6321] to-[#FF8C00] flex items-center justify-center shrink-0 shadow-sm">
                <ArrowLeft className="w-3.5 h-3.5 text-white stroke-[3] group-hover:-translate-x-0.5 transition-transform" />
              </div>
              <span className="font-black text-white text-xs">Retour</span>
            </button>
          )}

          {returnToLiveVoiceAvailable && (
            <button
              id="btn-header-return-live-voice"
              onClick={() => {
                setActiveTab('explorer');
                setIsVoiceModeOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#FF6321] via-orange-500 to-amber-500 hover:from-[#ff7538] hover:to-amber-400 text-white font-extrabold text-xs shadow-xl shadow-orange-600/30 transition active:scale-95 cursor-pointer border border-white/20 group"
              title="Retourner à la discussion live avec l'IA"
            >
              <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <ArrowLeft className="w-3.5 h-3.5 stroke-[3] group-hover:-translate-x-0.5 transition-transform" />
              </div>
              <span className="hidden sm:inline">Discussion Live</span>
              <span className="sm:hidden">Live IA</span>
              <Headphones className="w-3.5 h-3.5 text-white/90" />
            </button>
          )}

          {/* RodiumAI Credits Counter Badge or Visitor Auth Button */}
          {isAuthenticated ? (
            <button
              id="btn-kling-credits-feed"
              onClick={() => openCreditModal('client')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-black/55 hover:bg-black/80 backdrop-blur-md border border-amber-400/40 text-amber-300 font-black text-xs shadow-xl transition active:scale-95 cursor-pointer group"
              title="Consulter et recharger vos crédits IA RodiumAI"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform" />
              <span>{aiCredits}</span>
              <span className="text-[10px] text-white/70 font-semibold hidden sm:inline">crédits</span>
              <span className="text-[10px] w-4 h-4 rounded-full bg-gradient-to-r from-amber-400 to-[#FF5E00] text-black flex items-center justify-center font-black shadow ml-0.5">+</span>
            </button>
          ) : (
            <button
              id="btn-visitor-login-feed"
              onClick={() => openAuthModal('account', { initialMode: 'login', directToAuthForm: true })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md border border-white/20 text-white font-bold text-[11px] shadow-xl transition active:scale-95 cursor-pointer"
              title="Se connecter ou créer un compte DJASSA"
            >
              <User className="w-3.5 h-3.5 text-[#FF6321]" />
              <span>Connexion</span>
            </button>
          )}
        </div>

        {/* Center: Live AI Selection or Standard Tabs */}
        {isLiveAiMode ? (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-[#FF6321]/40 text-white text-xs font-bold shadow-lg">
            <ShoppingBag className="w-3.5 h-3.5 text-[#FF6321]" />
            <span className="font-bold hidden sm:inline">Sélection Live IA</span>
            <span className="text-[10px] font-black bg-[#FF6321] text-white px-2 py-0.5 rounded-full">
              {currentIndex + 1} / {filteredProducts.length}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-5 text-sm font-bold">
            <button
              id="tab-suivi"
              onClick={() => { setFeedSubTab('suivi'); setCurrentIndex(0); }}
              className={`transition-all ${
                feedSubTab === 'suivi' 
                  ? 'text-white border-b-2 border-[#FF6321] pb-0.5' 
                  : 'text-white/60 hover:text-white/90'
              }`}
            >
              Suivi
            </button>
            <button
              id="tab-pour-toi"
              onClick={() => { setFeedSubTab('pour_toi'); setCurrentIndex(0); }}
              className={`transition-all ${
                feedSubTab === 'pour_toi' 
                  ? 'text-white border-b-2 border-[#FF6321] pb-0.5' 
                  : 'text-white/60 hover:text-white/90'
              }`}
            >
              Pour toi
            </button>
            <button
              id="tab-promo"
              onClick={() => { setFeedSubTab('promo'); setCurrentIndex(0); }}
              className={`transition-all ${
                feedSubTab === 'promo' 
                  ? 'text-[#FF6321] border-b-2 border-[#FF6321] pb-0.5' 
                  : 'text-white/60 hover:text-white/90'
              }`}
            >
              Promo
            </button>
          </div>
        )}

        {/* Right: Search Button (only in normal feed) */}
        <div className="flex items-center gap-2">
          {!isLiveAiMode && (
            <button 
              onClick={() => setActiveTab('explorer')}
              className="p-2 rounded-full bg-black/40 text-white/80 hover:text-white backdrop-blur-md transition active:scale-95"
              title="Rechercher"
              aria-label="Rechercher"
            >
              <Search className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* FEED LIST (VERTICAL SNAP SCROLL) */}
      {filteredProducts.length === 0 ? (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 text-white/60">
          <Sparkles className="w-12 h-12 text-[#FF6321] mb-3 opacity-60" />
          <p className="text-base font-semibold text-white">Aucun produit dans cet onglet</p>
          <p className="text-xs text-white/50 mt-1 max-w-xs">
            {feedSubTab === 'suivi' 
              ? !isAuthenticated
                ? 'Connectez-vous pour retrouver ici les nouveautés des boutiques que vous suivez.'
                : "Abonnez-vous à des marchands d'Adjamé pour voir leurs nouveautés ici !"
              : 'Découvrez les offres disponibles dans "Pour toi".'}
          </p>
          <div className="mt-4 flex items-center gap-2">
            {feedSubTab === 'suivi' && !isAuthenticated && (
              <button
                type="button"
                onClick={() => openAuthModal('follow', { initialMode: 'login', directToAuthForm: true })}
                className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold shadow-lg cursor-pointer"
              >
                Se connecter
              </button>
            )}
            <button
              onClick={() => setFeedSubTab('pour_toi')}
              className="px-5 py-2.5 rounded-full bg-[#FF6321] text-white text-xs font-bold shadow-lg cursor-pointer"
            >
              Retourner au flux principal
            </button>
          </div>
        </div>
      ) : (
        <div
          ref={feedContainerRef}
          className="w-full h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
          onScroll={(e) => {
            const clientH = e.currentTarget.clientHeight;
            if (!clientH) return;
            const nextIndex = Math.round(e.currentTarget.scrollTop / clientH);
            setCurrentIndex((prev) => prev === nextIndex ? prev : nextIndex);
          }}
        >
          {filteredProducts.map((product, idx) => {
            const seller = sellersById.get(product.sellerId);
            const isLiked = likedSet.has(product.id);
            const isSaved = savedSet.has(product.id);
            const isFollowed = seller ? followedSet.has(seller.id) : false;
            const productComments = comments[product.id] || [];
            const isVideo = product.mediaType === 'video' && Boolean(product.videoUrl);
            const images = (product.images && product.images.length > 0)
              ? product.images
              : [product.videoPoster || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'];
            const activeImgIdx = activeImageIndices[product.id] || 0;
            const currentImage = images[activeImgIdx] || images[0];
            const distance = Math.abs(idx - currentIndex);
            const isActiveSlide = distance === 0;
            const shouldMountVideo = distance <= 1;
            const shouldRenderAmbient = distance <= 1;
          
            return (
              <div
                key={product.id}
                id={`feed-item-${product.id}`}
                className="relative w-full h-full snap-start snap-always bg-neutral-950 flex items-center justify-center overflow-hidden"
              >
                {/* MEDIA BACKGROUND */}
                {isVideo ? (
                  videoErrors[product.id] ? (
                    <div className="relative w-full h-full flex flex-col items-center justify-center bg-neutral-950 p-6 text-center gap-3">
                      {images[0] && (
                        <img
                          src={images[0]}
                          alt={product.name}
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 w-full h-full object-cover opacity-35"
                        />
                      )}
                      <div className="relative z-10 bg-black/75 border border-white/15 rounded-2xl p-4 max-w-xs space-y-2 backdrop-blur-md">
                        <p className="text-xs font-bold text-white">Vidéo momentanément indisponible</p>
                        <button
                          type="button"
                          onClick={() => setVideoErrors((prev) => ({ ...prev, [product.id]: false }))}
                          className="px-4 py-1.5 rounded-full bg-[#FF6321] text-white text-xs font-bold cursor-pointer"
                        >
                          Réessayer
                        </button>
                      </div>
                    </div>
                  ) : shouldMountVideo ? (
                    <video
                      ref={(el) => {
                        if (el) {
                          videoRefs.current[product.id] = el;
                        } else {
                          delete videoRefs.current[product.id];
                        }
                      }}
                      src={product.videoUrl}
                      poster={product.videoPoster || product.images[0]}
                      preload={isActiveSlide ? 'auto' : 'metadata'}
                      className="w-full h-full object-cover"
                      loop
                      playsInline
                      muted={isMuted}
                      onError={() => setVideoErrors((prev) => ({ ...prev, [product.id]: true }))}
                      onClick={() => {
                        const v = videoRefs.current[product.id];
                        if (v) v.paused ? v.play() : v.pause();
                      }}
                    />
                  ) : (
                    <img
                      src={product.videoPoster || images[0]}
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  )
                ) : (
                  <div 
                    className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-pointer"
                    onClick={() => handlePhotoDoubleTap(product)}
                  >
                    {/* Ambient blurred backdrop for immersion (mounted only near viewport) */}
                    {shouldRenderAmbient && (
                      <img
                        src={currentImage}
                        alt=""
                        loading={isActiveSlide ? 'eager' : 'lazy'}
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-35 scale-110 pointer-events-none transition-all duration-500"
                        aria-hidden="true"
                      />
                    )}

                    {/* Main High-Res Image */}
                    <img
                      key={`${product.id}-${activeImgIdx}`}
                      src={currentImage}
                      alt={product.name}
                      loading={shouldRenderAmbient ? 'eager' : 'lazy'}
                      decoding="async"
                      className="relative z-10 max-w-full max-h-full w-auto h-auto object-contain select-none transition duration-300 pointer-events-none"
                    />

                    {/* Multi-Photo Carousel Dots / Indicator */}
                    {images.length > 1 && (
                      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 shadow-lg">
                        <Layers className="w-3 h-3 text-[#FF6321]" />
                        <span className="text-[11px] font-black text-white">
                          {activeImgIdx + 1} / {images.length}
                        </span>
                        <div className="flex items-center gap-1 ml-1.5">
                          {images.map((_, i) => (
                            <div
                              key={i}
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                i === activeImgIdx ? 'w-4 bg-[#FF6321]' : 'w-1.5 bg-white/40'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick Previous / Next buttons for multi-image carousel */}
                    {images.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveImageIndices((prev) => ({
                              ...prev,
                              [product.id]: (activeImgIdx === 0 ? images.length - 1 : activeImgIdx - 1)
                            }));
                          }}
                          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white/90 backdrop-blur-md border border-white/10 transition active:scale-90"
                          title="Photo précédente"
                          aria-label="Photo précédente"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveImageIndices((prev) => ({
                              ...prev,
                              [product.id]: (activeImgIdx === images.length - 1 ? 0 : activeImgIdx + 1)
                            }));
                          }}
                          className="absolute right-16 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white/90 backdrop-blur-md border border-white/10 transition active:scale-90"
                          title="Photo suivante"
                          aria-label="Photo suivante"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </>
                    )}

                    {/* Fullscreen Viewer CTA badge (opens PhotoDetailModal directly) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPhotoViewer(allPhotoProducts, product.id);
                      }}
                      className="absolute top-16 right-4 z-20 px-2.5 py-1 rounded-full bg-black/60 hover:bg-black/80 text-white/90 backdrop-blur-md border border-white/15 text-[10px] font-bold flex items-center gap-1 shadow-lg transition active:scale-95"
                      title="Visionner en plein écran"
                    >
                      <Camera className="w-3.5 h-3.5 text-[#FF6321]" />
                      <span>Visionner</span>
                    </button>
                  </div>
                )}

                {/* Double-tap Heart Pop Animation */}
                {doubleTapHeartProductId === product.id && (
                  <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none animate-in zoom-in duration-200">
                    <Heart className="w-28 h-28 text-rose-500 fill-rose-500 drop-shadow-2xl animate-bounce" />
                  </div>
                )}

                {/* GRADIENT OVERLAYS */}
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/40 via-transparent to-black/90" />

                {/* RIGHT SIDEBAR ACTIONS (TikTok style: no background bubbles, authentic TikTok icons & shadows) */}
                <div className="absolute right-3 bottom-24 z-20 flex flex-col items-center gap-4.5">
                  {/* Seller Avatar + Follow */}
                  <div className="relative mb-2">
                    <img
                      src={seller?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                      alt={seller?.name}
                      loading={shouldRenderAmbient ? 'eager' : 'lazy'}
                      decoding="async"
                      onClick={() => seller && setSelectedSeller(seller)}
                      className="w-12 h-12 rounded-full border-2 border-[#FF6321] object-cover cursor-pointer shadow-xl hover:scale-105 active:scale-95 transition-transform"
                    />
                    {seller && !isFollowed && (
                      <button
                        onClick={() => toggleFollowSeller(seller.id)}
                        className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#FE2C55] text-white flex items-center justify-center text-xs shadow-lg hover:scale-110 active:scale-90 transition-transform"
                        title="S'abonner"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                    )}
                  </div>

                  {/* Like Button (TikTok Heart) */}
                  <button
                    id={`btn-like-feed-${product.id}`}
                    onClick={() => toggleLikeVideo(product.id)}
                    className="flex flex-col items-center group select-none active:scale-90 transition-transform"
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

                  {/* Comments Button (TikTok Comment Bubble) */}
                  <button
                    id={`btn-comment-feed-${product.id}`}
                    onClick={() => {
                      if (!requireAuth('comment', { type: 'comment', productId: product.id })) return;
                      setCommentBottomSheetProductId(product.id);
                    }}
                    className="flex flex-col items-center group select-none active:scale-90 transition-transform"
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
                    id={`btn-tryon-feed-${product.id}`}
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
                        {/* Google AI Sparkle */}
                        <path 
                          d="M12 2C12.4 5.3 14.7 7.6 18 8C14.7 8.4 12.4 10.7 12 14C11.6 10.7 9.3 8.4 6 8C9.3 7.6 11.6 5.3 12 2Z" 
                          fill="url(#sparkle-grad-action-btn)" 
                        />
                        {/* Hanger Silhouette */}
                        <path 
                          d="M12 9C10.5 9 9.5 10 9.5 11.2C9.5 12.5 10.8 13.2 12 13.8L19.5 17.5C20.4 18 20.8 19 20.2 19.8C19.7 20.5 18.6 20.7 17.7 20.2L12 17.2L6.3 20.2C5.4 20.7 4.3 20.5 3.8 19.8C3.2 19 3.6 18 4.5 17.5L12 13.8V12" 
                          stroke="white" 
                          strokeWidth="1.8" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                        />
                        <defs>
                          <linearGradient id="sparkle-grad-action-btn" x1="6" y1="2" x2="18" y2="14" gradientUnits="userSpaceOnUse">
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

                  {/* Save/Bookmark Button (TikTok Ribbon) */}
                  <button
                    id={`btn-save-feed-${product.id}`}
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

                  {/* Share Button (TikTok Curved Arrow) */}
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

                {/* BOTTOM LEFT PRODUCT DETAILS OVERLAY */}
                <div className="absolute left-4 bottom-3 right-20 z-20 space-y-2">
                  {/* Seller name & Views badge */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div
                      onClick={() => seller && setSelectedSeller(seller)}
                      className="inline-flex items-center gap-1.5 cursor-pointer bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 hover:bg-black/60 transition"
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

                  {/* Title & Description */}
                  <div 
                    onClick={() => setSelectedProduct(product)}
                    className="cursor-pointer group"
                  >
                    <h2 className="text-sm font-extrabold text-white leading-tight line-clamp-2 drop-shadow-md group-hover:text-[#FF6321] transition">
                      {product.name}
                    </h2>
                    <p className="text-xs text-white/80 line-clamp-1 mt-0.5">
                      {product.description}
                    </p>
                  </div>

                  {/* Price Tag & Buy Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex items-baseline gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl border border-white/15">
                      <span className="text-sm font-black text-[#FF6321]">
                        {formatFCFA(product.price)}
                      </span>
                      {product.originalPrice && product.originalPrice > product.price && (
                        <span className="text-[10px] text-white/50 line-through">
                          {formatFCFA(product.originalPrice)}
                        </span>
                      )}
                    </div>

                    {product.discountPercentage && (
                      <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-bold">
                        <Tag className="w-2.5 h-2.5" /> -{product.discountPercentage}%
                      </span>
                    )}

                    <div className="ml-auto flex items-center gap-1.5">
                      <button
                        id={`btn-view-product-${product.id}`}
                        onClick={() => setSelectedProduct(product)}
                        className="px-3.5 py-1.5 rounded-full bg-black/60 hover:bg-black/75 text-white border border-white/20 font-extrabold text-xs shadow-lg transition flex items-center gap-1"
                      >
                        <span>Voir produit</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        id={`btn-direct-buy-${product.id}`}
                        disabled={!product.inStock || (product.stock ?? 0) <= 0}
                        onClick={() => {
                          if (!requireAuth('purchase', { type: 'buy_direct', product })) return;
                          setVariantModalProduct(product);
                          setIsVariantModalDirectBuy(true);
                        }}
                        className="px-3.5 py-1.5 rounded-full bg-[#FF6321] hover:bg-[#ff7538] disabled:bg-white/15 disabled:text-white/40 disabled:cursor-not-allowed text-white font-extrabold text-xs shadow-lg shadow-orange-600/30 transition flex items-center gap-1"
                      >
                        <span>{!product.inStock || (product.stock ?? 0) <= 0 ? 'Épuisé' : 'Acheter'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* COMMENTS BOTTOM SHEET */}
      {commentBottomSheetProductId && (
        <Suspense fallback={null}>
          <CommentsBottomSheet
            productId={commentBottomSheetProductId}
            isOpen={Boolean(commentBottomSheetProductId)}
            onClose={() => setCommentBottomSheetProductId(null)}
          />
        </Suspense>
      )}
    </div>
  );
};
