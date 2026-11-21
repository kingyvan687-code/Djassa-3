import React, { useState, useMemo } from 'react';
import { 
  X, 
  MapPin, 
  Star, 
  ShieldCheck, 
  MessageCircle, 
  Phone, 
  Plus, 
  Check, 
  Play, 
  LayoutGrid, 
  Video as VideoIcon, 
  ArrowLeft, 
  Search, 
  SlidersHorizontal, 
  Sparkles, 
  ShoppingBag, 
  Layers, 
  LayoutList,
  Eye,
  Heart,
  Tag,
  Clock,
  ExternalLink
} from 'lucide-react';
import { Seller, Product } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatFCFA, formatMetricCount } from '../../services/marketServices';
import { SellerReviewsTab } from '../seller-app/profile/SellerReviewsTab';

interface SellerProfileModalProps {
  seller: Seller;
  onClose: () => void;
}

type ContentTab = 'photos' | 'videos' | 'avis';
type PhotoFilterCategory = 'all' | 'mode' | 'maroquinerie' | 'promo' | 'nouveautes';
type PhotoViewMode = 'grid' | 'compact';

export const SellerProfileModal: React.FC<SellerProfileModalProps> = ({
  seller,
  onClose
}) => {
  const { 
    products, 
    userProfile, 
    toggleFollowSeller, 
    setSelectedProduct,
    openPhotoViewer,
    openVideoViewer,
    openChatWithSeller,
    requireAuth
  } = useApp();

  const [activeTab, setActiveTab] = useState<ContentTab>('photos');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Photos tab state
  const [photoSearchQuery, setPhotoSearchQuery] = useState('');
  const [photoCategory, setPhotoCategory] = useState<PhotoFilterCategory>('all');
  const [photoViewMode, setPhotoViewMode] = useState<PhotoViewMode>('grid');

  // Videos tab state
  const [videoFilter, setVideoFilter] = useState<'all' | 'popular' | 'sales'>('all');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const isFollowed = userProfile.followedSellerIds.includes(seller.id);
  const sellerProducts = useMemo(
    () => products.filter((p) => p.sellerId === seller.id),
    [products, seller.id]
  );
  const sellerVideos = useMemo(
    () => sellerProducts.filter((p) => p.mediaType === 'video' && p.videoUrl),
    [sellerProducts]
  );

  // Filtered photos
  const filteredProducts = useMemo(() => {
    return sellerProducts.filter((p) => {
      if (photoCategory === 'promo' && !p.isPromotion && !(p.originalPrice && p.originalPrice > p.price)) {
        return false;
      }
      if (photoCategory === 'nouveautes' && !p.tags?.some(t => t.toLowerCase().includes('nouveau') || t.toLowerCase().includes('arrivage') || t.toLowerCase().includes('tendance'))) {
        return false;
      }
      if (photoCategory === 'mode' && !p.category.toLowerCase().includes('mode') && !p.category.toLowerCase().includes('habillement')) {
        return false;
      }
      if (photoCategory === 'maroquinerie' && !p.category.toLowerCase().includes('sac') && !p.category.toLowerCase().includes('maroquinerie')) {
        return false;
      }
      if (photoSearchQuery.trim()) {
        const q = photoSearchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
        );
      }
      return true;
    });
  }, [sellerProducts, photoCategory, photoSearchQuery]);

  // Filtered videos
  const filteredVideos = useMemo(() => {
    return sellerVideos.filter((v) => {
      if (videoFilter === 'popular' && (v.videoViewsCount || v.viewsCount || 0) < 5000) {
        return false;
      }
      if (videoFilter === 'sales' && (v.salesCount || 0) < 20) {
        return false;
      }
      return true;
    });
  }, [sellerVideos, videoFilter]);

  const handleOpenPhotoCardViewer = (prod: Product) => {
    const photoCandidates = filteredProducts.map((p) =>
      p.images && p.images.length > 0
        ? p
        : {
            ...p,
            mediaType: 'image' as const,
            images: [p.videoPoster || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400']
          }
    );
    openPhotoViewer(photoCandidates, prod.id);
  };

  return (
    <div
      id="seller-profile-modal-overlay"
      className="fixed inset-0 z-50 bg-[#0A0A0A] flex flex-col overflow-hidden animate-fadeIn"
    >
      {/* 1. TOP BAR (identical seller app aesthetic) */}
      <div className="pt-safe px-4 py-3 bg-[#0A0A0A]/90 backdrop-blur-xl border-b border-white/10 flex items-center justify-between z-30">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 text-white/80 hover:text-white hover:bg-white/15 transition active:scale-95"
            title="Retour"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-bold text-white">Profil Boutique</span>
            {seller.verified && (
              <span className="px-2 py-0.5 rounded-full bg-orange-500/10 border border-[#FF6321]/30 text-[10px] font-extrabold text-[#FF6321] flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#FF6321]" />
                Vérifié
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. SCROLLABLE CONTAINER */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
        {/* BOUTIQUE BANNER */}
        <div className="relative w-full h-36 sm:h-44 bg-neutral-900 overflow-hidden shrink-0">
          <img
            src={seller.banner || 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200&auto=format&fit=crop&q=80'}
            alt={`Bannière de ${seller.name}`}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-black/25 to-black/40 pointer-events-none" />
        </div>

        {/* PROFILE HEADER (Social-style & Centered with avatar overlapping banner) */}
        <div className="px-4 pb-4 -mt-12 flex flex-col items-center text-center space-y-3 relative z-10">
          {/* Avatar with orange ring & verified badge */}
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#0A0A0A] ring-2 ring-[#FF6321] shadow-xl shadow-orange-600/30 bg-neutral-900">
              <img
                src={seller.avatar}
                alt={seller.name}
                className="w-full h-full object-cover"
              />
            </div>
            {seller.verified && (
              <div 
                className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#FF6321] text-white shadow-lg border-2 border-[#0A0A0A] flex items-center justify-center"
                title="Boutique certifiée Djassa"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            )}
          </div>

          {/* Identity */}
          <div>
            <div className="flex items-center justify-center gap-1.5">
              <h1 className="text-base font-bold text-white">{seller.name}</h1>
              {seller.verified && <ShieldCheck className="w-4 h-4 text-[#FF6321]" />}
            </div>
            <p className="text-xs text-[#FF6321] font-medium mt-0.5">@{seller.username}</p>
          </div>

          {/* Bio */}
          <p className="text-xs text-white/70 max-w-sm leading-relaxed">
            {seller.bio || 'Bienvenue sur la boutique officielle DJASSA ! Découvrez nos collections exclusives et nos arrivages récents.'}
          </p>

          {/* Location & Response Time */}
          <div className="flex items-center justify-center gap-3 text-[11px] text-white/50">
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#FF6321]" />
              <span>{seller.location}</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-white/30" />
            <div className="flex items-center gap-1 text-emerald-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Répond en &lt; 15 min</span>
            </div>
            {seller.phone && (
              <>
                <div className="w-1 h-1 rounded-full bg-white/30" />
                <div className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-white/40" />
                  <span>{seller.phone}</span>
                </div>
              </>
            )}
          </div>

          {/* STATS ROW (Purely informational, non-clickable indicators) */}
          <div className="flex items-center justify-center gap-3 sm:gap-5 pt-1 w-full max-w-sm">
            {/* Abonnés */}
            <div className="flex flex-col items-center flex-1 p-2 rounded-2xl select-none">
              <span className="text-sm font-extrabold text-white">
                {formatMetricCount(seller.followedCount + (isFollowed ? 1 : 0))}
              </span>
              <span className="text-[11px] text-white/50 font-medium mt-0.5">
                👥 Abonnés
              </span>
            </div>

            <div className="w-px h-6 bg-white/10 shrink-0" />

            {/* Ventes */}
            <div className="flex flex-col items-center flex-1 p-2 rounded-2xl select-none">
              <span className="text-sm font-extrabold text-white">
                {formatMetricCount(seller.salesCount)}
              </span>
              <span className="text-[11px] text-white/50 font-medium mt-0.5">
                🛍️ Ventes
              </span>
            </div>

            <div className="w-px h-6 bg-white/10 shrink-0" />

            {/* Produits */}
            <div className="flex flex-col items-center flex-1 p-2 rounded-2xl select-none">
              <span className="text-sm font-extrabold text-white">
                {formatMetricCount(sellerProducts.length)}
              </span>
              <span className="text-[11px] text-white/50 font-medium mt-0.5">
                📦 Produits
              </span>
            </div>

            <div className="w-px h-6 bg-white/10 shrink-0" />

            {/* Note */}
            <div className="flex flex-col items-center flex-1 p-2 rounded-2xl select-none">
              <span className="text-sm font-extrabold text-amber-400">
                {seller.rating} ★
              </span>
              <span className="text-[11px] text-white/50 font-medium mt-0.5">
                ⭐ Avis
              </span>
            </div>
          </div>

          {/* CLIENT CALL TO ACTIONS (Follow, Message, Call) */}
          <div className="flex items-center gap-2 pt-1 w-full max-w-sm">
            {/* Follow / Abonné Button */}
            <button
              id={`btn-follow-seller-${seller.id}`}
              onClick={() => {
                if (!requireAuth('follow', { type: 'follow_seller', sellerId: seller.id })) return;
                toggleFollowSeller(seller.id);
                showToast(isFollowed ? 'Abonnement retiré.' : 'Vous suivez maintenant cette boutique ! ✨');
              }}
              className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 active:scale-95 ${
                isFollowed
                  ? 'bg-white/10 hover:bg-white/15 text-white border border-white/20'
                  : 'bg-gradient-to-r from-[#FF6321] to-[#ff7d45] hover:opacity-95 text-white shadow-lg shadow-orange-600/30'
              }`}
            >
              {isFollowed ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Abonné</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>S'abonner</span>
                </>
              )}
            </button>

            {/* Message button */}
            <button
              onClick={() => {
                if (!requireAuth('messages', { type: 'open_messages', sellerId: seller.id })) return;
                onClose();
                openChatWithSeller(seller.id);
              }}
              className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 border border-white/10 active:scale-95"
            >
              <MessageCircle className="w-4 h-4 text-[#FF6321]" />
              <span>Message</span>
            </button>
          </div>
        </div>

        {/* 3. CONTENT TABS: Photos | Vidéos | Avis */}
        <div className="border-t border-b border-white/10 flex bg-[#0A0A0A]/80 backdrop-blur-md text-xs font-bold sticky top-0 z-20">
          <button
            onClick={() => setActiveTab('photos')}
            className={`flex-1 py-3 flex items-center justify-center gap-1.5 transition ${
              activeTab === 'photos'
                ? 'text-[#FF6321] border-b-2 border-[#FF6321]'
                : 'text-white/40 hover:text-white/70 border-b-2 border-transparent'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Photos ({sellerProducts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('videos')}
            className={`flex-1 py-3 flex items-center justify-center gap-1.5 transition ${
              activeTab === 'videos'
                ? 'text-[#FF6321] border-b-2 border-[#FF6321]'
                : 'text-white/40 hover:text-white/70 border-b-2 border-transparent'
            }`}
          >
            <VideoIcon className="w-4 h-4" />
            <span>Vidéos ({sellerVideos.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('avis')}
            className={`flex-1 py-3 flex items-center justify-center gap-1.5 transition ${
              activeTab === 'avis'
                ? 'text-[#FF6321] border-b-2 border-[#FF6321]'
                : 'text-white/40 hover:text-white/70 border-b-2 border-transparent'
            }`}
          >
            <Star className="w-4 h-4" />
            <span>Avis ({formatMetricCount(seller.reviewsCount)})</span>
          </button>
        </div>

        {/* 4. TAB CONTENTS */}
        <div className="p-3">
          {/* TAB: PHOTOS */}
          {activeTab === 'photos' && (
            <div className="space-y-3">
              {/* Filter chips & Search bar */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type="text"
                      value={photoSearchQuery}
                      onChange={(e) => setPhotoSearchQuery(e.target.value)}
                      placeholder="Rechercher un article..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 outline-none focus:border-[#FF6321] transition"
                    />
                    {photoSearchQuery && (
                      <button
                        onClick={() => setPhotoSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex bg-white/5 p-0.5 rounded-xl border border-white/10">
                    <button
                      onClick={() => setPhotoViewMode('grid')}
                      className={`p-1.5 rounded-lg transition ${
                        photoViewMode === 'grid'
                          ? 'bg-[#FF6321] text-white shadow'
                          : 'text-white/40 hover:text-white'
                      }`}
                      title="Grille 2 colonnes"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setPhotoViewMode('compact')}
                      className={`p-1.5 rounded-lg transition ${
                        photoViewMode === 'compact'
                          ? 'bg-[#FF6321] text-white shadow'
                          : 'text-white/40 hover:text-white'
                      }`}
                      title="Compact 3 colonnes"
                    >
                      <Layers className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Categories */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {(
                    [
                      { id: 'all', label: 'Tout' },
                      { id: 'promo', label: '🔥 En Promo' },
                      { id: 'mode', label: '👗 Mode' },
                      { id: 'maroquinerie', label: '👜 Sacs' },
                      { id: 'nouveautes', label: '✨ Arrivages' },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setPhotoCategory(cat.id)}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
                        photoCategory === cat.id
                          ? 'bg-white text-black shadow-sm'
                          : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Photos Grid */}
              {filteredProducts.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto text-white/30">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <p className="text-xs text-white/50">Aucun produit ne correspond à votre filtre.</p>
                </div>
              ) : photoViewMode === 'grid' ? (
                <div className="grid grid-cols-2 gap-2.5">
                  {filteredProducts.map((prod) => (
                    <div
                      key={prod.id}
                      onClick={() => handleOpenPhotoCardViewer(prod)}
                      className="group bg-[#141414] rounded-2xl overflow-hidden border border-white/10 hover:border-[#FF6321]/50 transition cursor-pointer flex flex-col"
                    >
                      <div className="relative aspect-[3/4] w-full bg-neutral-900 overflow-hidden">
                        <img
                          src={prod.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400'}
                          alt={prod.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />

                        {/* Badges */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                          {prod.discountPercentage && (
                            <span className="px-1.5 py-0.5 rounded-md bg-rose-500 text-white text-[9px] font-black shadow">
                              -{prod.discountPercentage}%
                            </span>
                          )}
                        </div>

                        {prod.images && prod.images.length > 1 && (
                          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-white text-[9px] font-bold flex items-center gap-1 shadow">
                            <span>📷 {prod.images.length}</span>
                          </div>
                        )}

                        {/* Bottom stats overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex items-center justify-between text-[9px] text-white/80 font-bold">
                          <span className="flex items-center gap-1">
                            <Eye className="w-2.5 h-2.5" />
                            {formatMetricCount(prod.viewsCount || 0)}
                          </span>
                          <span className="flex items-center gap-1 text-rose-400">
                            <Heart className="w-2.5 h-2.5 fill-current" />
                            {formatMetricCount(prod.likesCount || 0)}
                          </span>
                          <span className="flex items-center gap-1 text-emerald-400">
                            {formatMetricCount(prod.salesCount || 0)} {((prod.salesCount || 0) <= 1) ? 'achat' : 'achats'}
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-2.5 flex-1 flex flex-col justify-between">
                        <div>
                          <p className="text-[10px] text-white/40 truncate">{prod.category}</p>
                          <h4 className="text-xs font-bold text-white truncate group-hover:text-[#FF6321] transition">
                            {prod.name}
                          </h4>
                        </div>

                        <div className="flex items-baseline justify-between pt-1.5 mt-auto">
                          <div>
                            <span className="text-xs font-black text-[#FF6321]">
                              {formatFCFA(prod.price)}
                            </span>
                            {prod.originalPrice && prod.originalPrice > prod.price && (
                              <span className="text-[10px] text-white/40 line-through block">
                                {formatFCFA(prod.originalPrice)}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProduct(prod);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#FF6321] hover:bg-[#ff7538] text-white text-[10px] font-black transition active:scale-95 shadow-sm"
                          >
                            Voir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Compact 3-columns layout */
                <div className="grid grid-cols-3 gap-1.5">
                  {filteredProducts.map((prod) => (
                    <div
                      key={prod.id}
                      onClick={() => handleOpenPhotoCardViewer(prod)}
                      className="group relative aspect-square bg-neutral-900 rounded-xl overflow-hidden border border-white/10 cursor-pointer"
                    >
                      <img
                        src={prod.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300'}
                        alt={prod.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex flex-col justify-between p-1.5">
                        <span className="text-[9px] font-bold text-white truncate">{prod.name}</span>
                        <span className="text-[10px] font-black text-[#FF6321]">{formatFCFA(prod.price)}</span>
                      </div>
                      {prod.discountPercentage && (
                        <span className="absolute top-1 left-1 px-1 py-0.2 rounded bg-rose-500 text-white text-[8px] font-black">
                          -{prod.discountPercentage}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: VIDEOS */}
          {activeTab === 'videos' && (
            <div className="space-y-3">
              {/* Filter tabs */}
              <div className="flex items-center gap-1.5">
                {(
                  [
                    { id: 'all', label: 'Toutes les vidéos' },
                    { id: 'popular', label: '🔥 Plus vues' },
                    { id: 'sales', label: '🛍️ Plus vendus' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setVideoFilter(tab.id)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition ${
                      videoFilter === tab.id
                        ? 'bg-white text-black shadow-sm'
                        : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {filteredVideos.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto text-white/30">
                    <VideoIcon className="w-6 h-6" />
                  </div>
                  <p className="text-xs text-white/50">Aucune vidéo disponible dans cette section.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {filteredVideos.map((video) => (
                    <div
                      key={video.id}
                      onClick={() => openVideoViewer(sellerVideos, video.id)}
                      className="group bg-[#141414] rounded-2xl overflow-hidden border border-white/10 hover:border-[#FF6321]/50 transition cursor-pointer flex flex-col shadow-lg"
                    >
                      <div className="relative aspect-[3/4] w-full bg-neutral-900 overflow-hidden">
                        <img
                          src={video.videoPoster || video.images?.[0] || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400'}
                          alt={video.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />

                        {/* Play icon indicator */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/30 flex items-center justify-center">
                          <div className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white group-hover:scale-110 group-hover:bg-[#FF6321] transition shadow-xl">
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          </div>
                        </div>

                        {/* Top badges */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                          {video.discountPercentage && (
                            <span className="px-1.5 py-0.5 rounded-md bg-rose-500 text-white text-[9px] font-black shadow">
                              -{video.discountPercentage}%
                            </span>
                          )}
                        </div>

                        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-white text-[9px] font-bold flex items-center gap-1 shadow">
                          <VideoIcon className="w-2.5 h-2.5 text-[#FF6321]" />
                          <span>Vidéo</span>
                        </div>

                        {/* Bottom stats overlay (Views, Likes, Achats) */}
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex items-center justify-between text-[9px] text-white/80 font-bold">
                          <span className="flex items-center gap-1">
                            <Eye className="w-2.5 h-2.5" />
                            {formatMetricCount(video.videoViewsCount || video.viewsCount || 0)}
                          </span>
                          <span className="flex items-center gap-1 text-rose-400">
                            <Heart className="w-2.5 h-2.5 fill-current" />
                            {formatMetricCount(video.videoLikesCount || video.likesCount || 0)}
                          </span>
                          <span className="flex items-center gap-1 text-emerald-400">
                            {formatMetricCount(video.salesCount || 0)} {((video.salesCount || 0) <= 1) ? 'achat' : 'achats'}
                          </span>
                        </div>
                      </div>

                      {/* Content (Category, Title, Price + OriginalPrice, Voir button) */}
                      <div className="p-2.5 flex-1 flex flex-col justify-between">
                        <div>
                          <p className="text-[10px] text-white/40 truncate">{video.category}</p>
                          <h4 className="text-xs font-bold text-white truncate group-hover:text-[#FF6321] transition">
                            {video.name}
                          </h4>
                        </div>

                        <div className="flex items-baseline justify-between pt-1.5 mt-auto">
                          <div>
                            <span className="text-xs font-black text-[#FF6321]">
                              {formatFCFA(video.price)}
                            </span>
                            {video.originalPrice && video.originalPrice > video.price && (
                              <span className="text-[10px] text-white/40 line-through block">
                                {formatFCFA(video.originalPrice)}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProduct(video);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#FF6321] hover:bg-[#ff7538] text-white text-[10px] font-black transition active:scale-95 shadow-sm"
                          >
                            Voir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: AVIS */}
          {activeTab === 'avis' && (
            <div className="pt-1">
              <SellerReviewsTab
                seller={seller}
                products={sellerProducts}
                isSellerSelf={false}
                allowClientReview={true}
                onSelectProduct={setSelectedProduct}
                showToast={showToast}
              />
            </div>
          )}
        </div>
      </div>

      {/* TOAST FEEDBACK */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-4 py-2 rounded-full bg-[#FF6321] text-white text-xs font-bold shadow-xl animate-in fade-in">
          {toastMessage}
        </div>
      )}
    </div>
  );
};
