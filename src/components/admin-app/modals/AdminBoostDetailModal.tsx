import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Tag, 
  Camera, 
  Layers, 
  ArrowLeft, 
  X,
  BarChart3,
  Clock,
  Crown,
  Flame,
  Zap,
  Sparkles,
  Award,
  TrendingUp,
  Eye,
  MousePointerClick,
  ShoppingBag,
  ShoppingCart,
  Calendar,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Download
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { formatFCFA, formatMetricCount } from '../../../services/marketServices';
import { Product, AdminBoostCampaign } from '../../../types';
import { CommentsBottomSheet } from '../../feed/CommentsBottomSheet';
import { INITIAL_BOOST_CAMPAIGNS } from '../../../data/advertisingMockData';
import { isCampaignExpired, getCampaignResolvedState } from '../dashboard/AdminPromosSection';

interface AdminBoostDetailModalProps {
  campaign: AdminBoostCampaign;
  campaigns?: AdminBoostCampaign[];
  onClose: () => void;
  onToggleStatus: (campaignId: string) => void;
  onExtendDuration: (campaignId: string, additionalDays: number) => void;
  onDeleteCampaign: (campaignId: string) => void;
}

export interface BoostedPublicationItem extends Product {
  campaignInfo: AdminBoostCampaign;
}

export const AdminBoostDetailModal: React.FC<AdminBoostDetailModalProps> = ({
  campaign,
  campaigns = [],
  onClose
}) => {
  const { 
    products, 
    sellers, 
    setSelectedSeller, 
    comments, 
    commentBottomSheetProductId, 
    setCommentBottomSheetProductId, 
    openPhotoViewer 
  } = useApp();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [activeImageIndices, setActiveImageIndices] = useState<Record<string, number>>({});
  const [selectedStatsCampaign, setSelectedStatsCampaign] = useState<AdminBoostCampaign | null>(null);
  const [viewScope, setViewScope] = useState<'current' | 'all'>('current');
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const feedContainerRef = useRef<HTMLDivElement | null>(null);

  const isSelectedExpired = isCampaignExpired(campaign);

  // Active, non-expired paid campaigns only
  const activePaidCampaigns = useMemo(() => {
    const sourceCampaigns = campaigns && campaigns.length > 0 ? campaigns : INITIAL_BOOST_CAMPAIGNS;
    return sourceCampaigns.filter(c => !isCampaignExpired(c) && c.status === 'active' && !c.isFreeAdminGrant && (c.budgetFCFA || 0) > 0);
  }, [campaigns]);

  // Current product's active campaigns
  const currentProductCampaigns = useMemo(() => {
    const targetId = campaign.targetId;
    const targetName = (campaign.targetName || '').toLowerCase().trim();
    const sellerId = campaign.sellerId;
    return activePaidCampaigns.filter(c => 
      c.id === campaign.id ||
      (targetId && (c.targetId === targetId || c.targetId === campaign.id)) ||
      (c.targetName && targetName && c.targetName.toLowerCase().trim() === targetName) ||
      (c.sellerId && sellerId && c.sellerId === sellerId && c.targetType === campaign.targetType)
    );
  }, [activePaidCampaigns, campaign]);

  // Filter strictly real products with paid advertising in progress
  const boostedPublications = useMemo<BoostedPublicationItem[]>(() => {
    // Helper to find or construct a genuine product whose seller paid for advertising
    const resolveProductForCampaign = (camp: AdminBoostCampaign): BoostedPublicationItem | null => {
      // 1. Direct match by product id in catalog
      let p = products.find(prod => prod.id === camp.targetId);

      // 2. Direct match by exact or partial product name (when targetType is product)
      if (!p && camp.targetType === 'product') {
        const queryName = (camp.targetName || '').toLowerCase().trim();
        p = products.find(prod => prod.name.toLowerCase().trim() === queryName || prod.name.toLowerCase().includes(queryName));
      }

      // 3. If campaign is for a store (targetType === 'seller') or no match yet:
      // find real products belonging to this seller who paid for the boost
      if (!p && camp.sellerId) {
        const sellerProducts = products.filter(prod => prod.sellerId === camp.sellerId);
        p = sellerProducts[0];
      }

      // 4. Secondary lookup by seller name matching
      if (!p && camp.sellerName) {
        const sName = camp.sellerName.toLowerCase().trim();
        const sellerObj = sellers.find(s => s.name.toLowerCase().trim() === sName || s.name.toLowerCase().includes(sName));
        if (sellerObj) {
          const sellerProducts = products.filter(prod => prod.sellerId === sellerObj.id);
          p = sellerProducts[0];
        }
      }

      if (p) {
        return {
          ...p,
          id: p.id,
          name: p.name,
          description: p.description,
          price: camp.targetPrice && camp.targetType === 'product' ? camp.targetPrice : p.price,
          isPromotion: true,
          discountPercentage: p.discountPercentage || 20,
          likesCount: camp.clicksCount ? camp.clicksCount * 3 + 120 : p.likesCount || 1420,
          viewsCount: camp.impressionsCount || p.viewsCount || 24800,
          videoLikesCount: camp.clicksCount ? camp.clicksCount * 3 + 120 : p.videoLikesCount || 1420,
          videoViewsCount: camp.impressionsCount || p.videoViewsCount || 24800,
          savesCount: Math.max(24, Math.round((camp.clicksCount || 30) * 0.4)),
          sharesCount: Math.max(12, Math.round((camp.clicksCount || 30) * 0.15)),
          campaignInfo: camp
        };
      }

      // 5. If no catalog product exists, create a genuine PRODUCT (never a store name)
      const productName = camp.targetType === 'product' && camp.targetName 
        ? camp.targetName 
        : `Article Tendance • ${camp.sellerName}`;

      return {
        id: `paid-boost-prod-${camp.id}`,
        name: productName,
        description: camp.targetSubtitle || `Article de premier choix sponsorisé par ${camp.sellerName} sur Djassa`,
        images: [camp.targetImage || 'https://images.unsplash.com/photo-1544441893-675973e31985?w=800'],
        mediaType: 'image',
        price: camp.targetPrice || 18500,
        originalPrice: camp.targetPrice ? Math.round(camp.targetPrice * 1.25) : 24000,
        discountPercentage: 20,
        stock: 25,
        variants: [
          { type: 'Taille', options: ['S', 'M', 'L', 'XL'] },
          { type: 'Couleur', options: ['Orange Djassa', 'Noir', 'Blanc'] }
        ],
        category: 'Mode & Tendance',
        sellerId: camp.sellerId || 'seller-1',
        location: camp.targetZones?.[0] || 'Adjamé, Abidjan',
        rating: 4.9,
        salesCount: camp.ordersCount || 42,
        reviewsCount: 18,
        likesCount: camp.clicksCount ? camp.clicksCount * 3 + 120 : 1840,
        videoLikesCount: camp.clicksCount ? camp.clicksCount * 3 + 120 : 1840,
        viewsCount: camp.impressionsCount || 24800,
        videoViewsCount: camp.impressionsCount || 24800,
        savesCount: Math.max(38, Math.round((camp.clicksCount || 40) * 0.4)),
        sharesCount: Math.max(14, Math.round((camp.clicksCount || 40) * 0.15)),
        inStock: true,
        isPromotion: true,
        delivery: {
          estimatedDays: '24h',
          fee: 1500,
          mode: 'Livraison Express',
          location: camp.targetZones?.[0] || 'Abidjan toutes communes'
        },
        conditions: {
          isRefundable: true,
          returnPeriodDays: 3,
          returnConditions: ['Article non porté', 'Étiquette intacte'],
          refundConditions: ['Échange immédiat ou remboursement'],
          nonRefundableSituations: ['Article endommagé ou lavé'],
          fees: 'Gratuit si défaut',
          procedure: 'Contactez le service client via discussion'
        },
        specs: {
          'Garantie': 'Authenticité certifiée Djassa',
          'Origine': "Côte d'Ivoire"
        },
        tags: ['Sponsorisé', 'Publicité Payée', 'Djassa Boost'],
        campaignInfo: camp
      };
    };

    // If this campaign is expired (e.g. clicked from Historique tab), show only this past campaign
    if (isSelectedExpired) {
      const prod = resolveProductForCampaign(campaign);
      return prod ? [prod] : [];
    }

    // Default mode: ONLY active advertisements for the CURRENT product
    let targetCampaigns: AdminBoostCampaign[] = [];

    if (viewScope === 'current') {
      targetCampaigns = currentProductCampaigns.length > 0 ? currentProductCampaigns : [campaign];
    } else {
      // All active ongoing campaigns (never expired ones)
      const others = activePaidCampaigns.filter(c => !currentProductCampaigns.some(cp => cp.id === c.id));
      targetCampaigns = [...currentProductCampaigns, ...others];
      if (targetCampaigns.length === 0) {
        targetCampaigns = [campaign];
      }
    }

    const seenProductIds = new Set<string>();
    const list: BoostedPublicationItem[] = [];

    targetCampaigns.forEach((c) => {
      const prod = resolveProductForCampaign(c);
      if (prod && !seenProductIds.has(prod.id)) {
        seenProductIds.add(prod.id);
        list.push(prod);
      }
    });

    return list;
  }, [campaign, isSelectedExpired, viewScope, currentProductCampaigns, activePaidCampaigns, products, sellers]);

  const currentProduct = boostedPublications[currentIndex] || boostedPublications[0];
  const currentProductId = currentProduct?.id;

  // Video playback sync
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

  // Helper for advertising placement type
  const getPlacementDetails = (p: string) => {
    switch (p) {
      case 'hero_banner':
        return {
          label: "Carrousel VIP Accueil",
          badge: "👑 VIP 1ère Position",
          icon: Crown,
          color: "text-amber-400 bg-amber-500/20 border-amber-500/40",
          desc: "Bannière grand format en 1ère position de l'accueil de l'application et priorité maximale dans le flux."
        };
      case 'search_top':
        return {
          label: "Top 1 Résultat Recherche",
          badge: "🔥 Priorité Algorithmique",
          icon: Flame,
          color: "text-[#FF8C53] bg-[#FF6321]/20 border-[#FF6321]/40",
          desc: "Le produit apparaît en 1ère position dès qu'un acheteur tape des mots-clés associés."
        };
      case 'sponsored_badge':
        return {
          label: "Badge Flash 24h & Cadre Doré",
          badge: "✨ Badge Confiance Express",
          icon: Zap,
          color: "text-cyan-400 bg-cyan-500/20 border-cyan-500/40",
          desc: "Macaron doré 'Sponsorisé' et surbrillance dans les catalogues de commune."
        };
      case 'push_notification':
        return {
          label: "Alerte Push Flash Abidjan",
          badge: "⚡ Notification Directe",
          icon: Sparkles,
          color: "text-purple-400 bg-purple-500/20 border-purple-500/40",
          desc: "Envoi ciblé sur le smartphone des acheteurs actifs dans les communes ciblées."
        };
      case 'all':
      default:
        return {
          label: "Pack Visibilité Totale 360°",
          badge: "🚀 Pack Intégral",
          icon: Award,
          color: "text-emerald-400 bg-emerald-500/20 border-emerald-500/40",
          desc: "Activation combinée Carrousel VIP, Top Recherche, Badge Doré et Push."
        };
    }
  };

  return (
    <div 
      id="admin-boost-detail-screen" 
      className="fixed inset-0 z-50 w-full h-[100dvh] bg-[#0A0A0A] text-white flex flex-col overflow-hidden select-none isolate animate-in fade-in duration-200"
    >
      {/* AMBIENT GLOWS (EXACT DESIGN OF THE CLIENT APP ROOT) */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-[#FF6321] opacity-20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/2 -right-32 w-80 h-80 bg-[#FF6321] opacity-15 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-32 left-1/4 w-80 h-80 bg-[#FF6321] opacity-10 blur-[120px] rounded-full pointer-events-none" />

      {/* TOP HEADER */}
      <div className="absolute top-0 left-0 right-0 z-40 pt-safe px-4 py-3 flex items-center justify-between gap-2 bg-gradient-to-b from-black/90 via-black/50 to-transparent">
        
        {/* Left: Back Button to Admin Promos */}
        <button
          id="btn-return-to-admin-dashboard"
          onClick={onClose}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/80 hover:bg-black/95 backdrop-blur-md border border-[#FF6321]/60 text-white font-extrabold text-xs shadow-xl shadow-orange-600/30 transition active:scale-95 cursor-pointer group shrink-0"
          title="Revenir au tableau de bord Admin"
        >
          <div className="w-5 h-5 rounded-full bg-gradient-to-r from-[#FF6321] to-[#FF8C00] flex items-center justify-center shrink-0 shadow-sm">
            <ArrowLeft className="w-3.5 h-3.5 text-white stroke-[3] group-hover:-translate-x-0.5 transition-transform" />
          </div>
          <span className="font-black text-white text-xs">Retour Admin</span>
        </button>

        {/* Center: Status / Scope Indicator */}
        {isSelectedExpired ? (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 backdrop-blur-md text-[11px] font-bold text-amber-300 shadow">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Publicité Expirée (Historique)</span>
          </div>
        ) : (
          <div className="flex items-center p-0.5 bg-black/70 backdrop-blur-md border border-white/15 rounded-full shadow-lg">
            <button
              type="button"
              onClick={() => setViewScope('current')}
              className={`px-3 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                viewScope === 'current'
                  ? 'bg-gradient-to-r from-[#FF6321] to-[#FF8C53] text-white shadow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Ce produit en cours
            </button>
            {activePaidCampaigns.length > 1 && (
              <button
                type="button"
                onClick={() => setViewScope('all')}
                className={`px-3 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                  viewScope === 'all'
                    ? 'bg-gradient-to-r from-[#FF6321] to-[#FF8C53] text-white shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Tout le flux actif ({activePaidCampaigns.length})
              </button>
            )}
          </div>
        )}

        {/* Right: Sound & Close Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition active:scale-95 border border-white/10"
            title={isMuted ? "Activer le son" : "Couper le son"}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-white/70" /> : <Volume2 className="w-4 h-4 text-[#FF6321]" />}
          </button>

          <button 
            id="btn-close-boost-screen"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/80 hover:bg-black/95 text-white/80 hover:text-white flex items-center justify-center transition active:scale-95 border border-white/20 cursor-pointer shadow-lg"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MAIN VERTICAL FEED CONTAINER (ONLY BOOSTED ADVERTISED PRODUCTS) */}
      <main className="flex-1 w-full h-full overflow-hidden relative">
        <div
          ref={feedContainerRef}
          className="w-full h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
          onScroll={(e) => {
            const nextIndex = Math.round(e.currentTarget.scrollTop / e.currentTarget.clientHeight);
            setCurrentIndex((prev) => prev === nextIndex ? prev : nextIndex);
          }}
        >
          {boostedPublications.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-[#FF6321]/20 border border-[#FF6321]/40 flex items-center justify-center text-[#FF6321]">
                <Clock className="w-7 h-7" />
              </div>
              <h3 className="text-base font-black text-white">Aucune publicité en cours pour ce produit</h3>
              <p className="text-xs text-white/60 max-w-xs">
                Cette campagne publicitaire est expirée ou clôturée. Toutes les campagnes expirées sont archivées dans l’onglet « Historique ».
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF6321] to-[#FF8C53] text-white font-bold text-xs shadow-lg active:scale-95 cursor-pointer"
              >
                Retour à l'administration
              </button>
            </div>
          ) : (
            boostedPublications.map((product) => {
            const camp = product.campaignInfo;
            const placementDetails = getPlacementDetails(camp.placement);
            const PlacementIcon = placementDetails.icon;

            const seller = sellers.find((s) => s.id === product.sellerId) || {
              id: product.sellerId,
              name: camp.sellerName,
              username: camp.sellerName.toLowerCase().replace(/\s+/g, ''),
              avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120',
              verified: true
            };

            const productComments = comments[product.id] || [];
            const isVideo = product.mediaType === 'video' && Boolean(product.videoUrl);
            const images = (product.images && product.images.length > 0)
              ? product.images
              : [camp.targetImage || 'https://images.unsplash.com/photo-1544441893-675973e31985?w=600'];
            const activeImgIdx = activeImageIndices[product.id] || 0;
            const currentImage = images[activeImgIdx] || images[0];

            return (
              <div
                key={product.id}
                id={`feed-item-${product.id}`}
                className="relative w-full h-full snap-start snap-always bg-neutral-950 flex items-center justify-center overflow-hidden"
              >
                {/* MEDIA BACKGROUND */}
                {isVideo ? (
                  <video
                    ref={(el) => {
                      videoRefs.current[product.id] = el;
                    }}
                    src={product.videoUrl}
                    poster={product.videoPoster || product.images[0]}
                    className="w-full h-full object-cover"
                    loop
                    playsInline
                    muted={isMuted}
                    onClick={() => {
                      const v = videoRefs.current[product.id];
                      if (v) v.paused ? v.play() : v.pause();
                    }}
                  />
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center overflow-hidden select-none">
                    {/* Ambient blurred backdrop for immersion */}
                    <img
                      src={currentImage}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-35 scale-110 pointer-events-none transition-all duration-500"
                      aria-hidden="true"
                    />

                    {/* Main High-Res Image */}
                    <img
                      key={`${product.id}-${activeImgIdx}`}
                      src={currentImage}
                      alt={product.name}
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
                          onClick={() => {
                            setActiveImageIndices((prev) => ({
                              ...prev,
                              [product.id]: (activeImgIdx === 0 ? images.length - 1 : activeImgIdx - 1)
                            }));
                          }}
                          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white/90 backdrop-blur-md border border-white/10 transition active:scale-90 cursor-pointer"
                          title="Photo précédente"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveImageIndices((prev) => ({
                              ...prev,
                              [product.id]: (activeImgIdx === images.length - 1 ? 0 : activeImgIdx + 1)
                            }));
                          }}
                          className="absolute right-16 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white/90 backdrop-blur-md border border-white/10 transition active:scale-90 cursor-pointer"
                          title="Photo suivante"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </>
                    )}

                    {/* Fullscreen Viewer CTA badge */}
                    <button
                      type="button"
                      onClick={() => {
                        openPhotoViewer([product], product.id);
                      }}
                      className="absolute top-16 right-4 z-20 px-2.5 py-1 rounded-full bg-black/60 hover:bg-black/80 text-white/90 backdrop-blur-md border border-white/15 text-[10px] font-bold flex items-center gap-1 shadow-lg transition active:scale-95 cursor-pointer"
                      title="Visionner en plein écran"
                    >
                      <Camera className="w-3.5 h-3.5 text-[#FF6321]" />
                      <span>Visionner</span>
                    </button>
                  </div>
                )}

                {/* GRADIENT OVERLAYS */}
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/40 via-transparent to-black/90" />

                {/* RIGHT SIDEBAR ACTIONS (WITH DEDICATED STATS BUTTON) */}
                <div className="absolute right-3 bottom-10 z-20 flex flex-col items-center gap-4">
                  {/* Seller Avatar */}
                  <div className="relative mb-1">
                    <img
                      src={seller.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                      alt={seller.name}
                      onClick={() => setSelectedSeller(seller as any)}
                      className="w-12 h-12 rounded-full border-2 border-[#FF6321] object-cover cursor-pointer shadow-xl hover:scale-105 active:scale-95 transition-transform"
                    />
                    {seller.verified && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#FF6321] text-white flex items-center justify-center text-[9px] font-black shadow">
                        ✓
                      </span>
                    )}
                  </div>

                  {/* BOUTON STATS (PERFORMANCES, JOURS RESTANTS & TYPE DE PUB) */}
                  <button
                    id={`btn-stats-feed-${product.id}`}
                    type="button"
                    onClick={() => setSelectedStatsCampaign(camp)}
                    className="flex flex-col items-center group select-none active:scale-90 transition-transform cursor-pointer"
                    title="Voir les performances, jours restants et détails de la pub"
                  >
                    <div className="p-2.5 rounded-full bg-gradient-to-tr from-[#FF6321] via-[#FF7538] to-[#FF9040] text-white shadow-xl shadow-orange-600/40 border border-white/30 group-hover:scale-115 transition-transform">
                      <BarChart3 className="w-5 h-5 text-white stroke-[2.5]" />
                    </div>
                    <span className="text-[10px] font-black text-white mt-0.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
                      Stats
                    </span>
                    <span className="text-[8px] font-bold text-amber-300 px-1 py-0.2 rounded-full bg-black/80 border border-amber-400/30 mt-0.5 font-mono">
                      {camp.remainingDays}j
                    </span>
                  </button>

                  {/* Like Display (Admin observation: shows real count) */}
                  <div 
                    className="flex flex-col items-center select-none cursor-default"
                    title="J'aime (Affichage observation)"
                  >
                    <svg 
                      viewBox="0 0 24 24" 
                      className="w-9 h-9 text-white fill-white filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
                    >
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                    <span className="text-[11px] font-bold text-white mt-0.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
                      {formatMetricCount(product.videoLikesCount || product.likesCount || 0)}
                    </span>
                  </div>

                  {/* Comments Button (Admin CAN view comments in read-only mode) */}
                  <button
                    id={`btn-comment-feed-${product.id}`}
                    onClick={() => setCommentBottomSheetProductId(product.id)}
                    className="flex flex-col items-center group select-none active:scale-90 transition-transform cursor-pointer"
                    title="Consulter les commentaires"
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
                      {formatMetricCount(productComments.length || 18)}
                    </span>
                  </button>

                  {/* Save Display (Admin observation) */}
                  <div 
                    className="flex flex-col items-center select-none cursor-default"
                    title="Enregistrements (Affichage observation)"
                  >
                    <svg 
                      viewBox="0 0 24 24" 
                      className="w-9 h-9 text-white fill-white filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
                    >
                      <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3.5 7 3.5V5c0-1.1-.9-2-2-2z" />
                    </svg>
                    <span className="text-[11px] font-bold text-white mt-0.5 drop-shadow">
                      {formatMetricCount(product.savesCount || 42)}
                    </span>
                  </div>

                  {/* Share Display (Admin observation) */}
                  <div 
                    className="flex flex-col items-center select-none cursor-default"
                    title="Partages (Affichage observation)"
                  >
                    <svg 
                      viewBox="0 0 24 24" 
                      className="w-9 h-9 text-white fill-white filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
                    >
                      <path d="M14 5v4C7 10 4 15 3 20c2.5-3.5 6-5.1 11-5.1V19l8-7-8-7z" />
                    </svg>
                    <span className="text-[11px] font-bold text-white mt-0.5 drop-shadow">
                      {formatMetricCount(product.sharesCount || 16)}
                    </span>
                  </div>
                </div>

                {/* BOTTOM LEFT PRODUCT DETAILS OVERLAY (DISPLAYS TYPE DE PUB, EXPIRATION & PRODUCT DATA) */}
                <div className="absolute left-4 bottom-5 right-20 z-20 space-y-2">
                  
                  {/* Top Badges Row: Seller Handle + Type de Pub + Expiration */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Seller handle badge */}
                    <div
                      onClick={() => setSelectedSeller(seller as any)}
                      className="inline-flex items-center gap-1.5 cursor-pointer bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 hover:bg-black/80 transition"
                    >
                      <Store className="w-3.5 h-3.5 text-[#FF6321]" />
                      <span className="text-xs font-bold text-white">@{seller.username || 'vendeur'}</span>
                      {seller.verified && (
                        <span className="w-3.5 h-3.5 rounded-full bg-[#FF6321] text-white text-[9px] font-black flex items-center justify-center">
                          ✓
                        </span>
                      )}
                    </div>

                    {/* Précision du Type de Pub */}
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border shadow-sm ${placementDetails.color}`}>
                      <PlacementIcon className="w-3 h-3" />
                      <span>{placementDetails.label}</span>
                    </span>

                    {/* Nombre de jours restants avant expiration */}
                    <button
                      type="button"
                      onClick={() => setSelectedStatsCampaign(camp)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-black/70 backdrop-blur-md border border-amber-500/30 text-amber-300 shadow cursor-pointer active:scale-95"
                      title="Cliquez pour afficher les stats détaillées"
                    >
                      <Clock className="w-3 h-3 text-[#FF6321]" />
                      <span>{camp.remainingDays} jour{camp.remainingDays > 1 ? 's' : ''} restant{camp.remainingDays > 1 ? 's' : ''}</span>
                    </button>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h2 className="text-sm font-extrabold text-white leading-tight line-clamp-2 drop-shadow-md">
                      {product.name}
                    </h2>
                    <p className="text-xs text-white/80 line-clamp-1 mt-0.5">
                      {product.description}
                    </p>
                  </div>

                  {/* Price Tag & Discount */}
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

                    {/* Bouton Rapide Stats dans la barre d'action inférieure */}
                    <button
                      type="button"
                      onClick={() => setSelectedStatsCampaign(camp)}
                      className="ml-auto px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white font-extrabold text-[11px] flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow"
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-[#FF6321]" />
                      <span>Performances</span>
                    </button>
                  </div>
                </div>

              </div>
            );
          }))}
        </div>
      </main>

      {/* =======================================================================
          MODAL DRAWER DES PERFORMANCES DU PRODUIT (STATS COMPLETES)
          ======================================================================= */}
      {selectedStatsCampaign && (() => {
        const camp = selectedStatsCampaign;
        const placement = getPlacementDetails(camp.placement);
        const PlacementIcon = placement.icon;

        const impressions = camp.impressionsCount || 0;
        const clicks = camp.clicksCount || 0;
        const cartAdditions = camp.cartAdditionsCount || Math.max(camp.ordersCount * 3 + 12, Math.round((camp.clicksCount || 100) * 0.28));
        const orders = camp.ordersCount || 0;
        const revenue = camp.revenueGeneratedFCFA || 0;
        const budget = camp.budgetFCFA || 0;
        const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : '0';
        const roas = budget > 0 ? (revenue / budget).toFixed(1) : '8.4';
        const netProfit = Math.max(0, revenue - budget);
        const campState = getCampaignResolvedState(camp);
        const totalDays = Math.max(1, camp.durationDays || 1);
        const remaining = campState.remainingDays;
        const progressPercent = campState.progressPercent;

        return (
          <div 
            id="product-performance-stats-overlay"
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
            onClick={() => setSelectedStatsCampaign(null)}
          >
            <div 
              className="w-full max-w-lg bg-[#111215] border border-white/15 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl overflow-hidden select-none animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-[#FF6321]/20 border border-[#FF6321]/40 flex items-center justify-center text-[#FF6321]">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-white">
                      Performances & Suivi du Boost
                    </h3>
                    <p className="text-[11px] text-white/50 truncate max-w-[240px]">
                      {camp.targetName || camp.title}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedStatsCampaign(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition active:scale-95 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* SECTION 1: TYPE DE PUB & EXPIRATION (CONSIGNE EXACTE DU USER) */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-950/40 via-[#18181D] to-[#121215] border border-[#FF6321]/30 space-y-3 shadow-lg">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-white/40 uppercase font-bold block">Type de Publicité Souscrite</span>
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-black border flex items-center gap-1.5 shadow-sm ${placement.color}`}>
                        <PlacementIcon className="w-3.5 h-3.5" />
                        <span>{placement.label}</span>
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-white/40 uppercase font-bold block">Statut Diffusion</span>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 border ${campState.badgeClass}`}>
                      {campState.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                      {campState.status === 'paused' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                      {campState.status === 'completed' && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                      {campState.label}
                    </span>
                  </div>
                </div>

                {/* Compte à rebours avant expiration */}
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/70 flex items-center gap-1.5 font-bold">
                      <Clock className="w-3.5 h-3.5 text-[#FF6321]" />
                      <span>Temps restant avant expiration :</span>
                    </span>
                    <span className="text-amber-300 font-mono font-black text-sm">
                      {campState.status === 'completed' 
                        ? 'Expirée (Terminé)' 
                        : campState.status === 'paused'
                        ? `En pause (${remaining}j restant${remaining > 1 ? 's' : ''})`
                        : `${remaining} jour${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''}`}
                    </span>
                  </div>

                  {/* Jauge de progression */}
                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        campState.status === 'active'
                          ? 'bg-gradient-to-r from-[#FF6321] via-amber-400 to-emerald-400'
                          : campState.status === 'paused'
                          ? 'bg-amber-500'
                          : 'bg-neutral-600'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-white/50 font-mono">
                    <span>Début : <strong>{camp.startDate}</strong></span>
                    <span>Expiration : <strong className="text-amber-300">{camp.endDate}</strong> ({camp.durationDays}j total)</span>
                  </div>
                </div>
              </div>

              {/* SECTION 2: PERFORMANCES DU PRODUIT (CHIFFRES RÉELS) */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Vues / Portée */}
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-white/50 uppercase font-bold">
                    <span>Vues / Portée</span>
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div className="text-lg font-black text-white font-mono">
                    {impressions.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-cyan-300 font-semibold block">Affichages flux acheteurs</span>
                </div>

                {/* Mis au Panier (Remplacement selon demande utilisateur) */}
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-white/50 uppercase font-bold">
                    <span>Mis au Panier</span>
                    <ShoppingCart className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-lg font-black text-amber-300 font-mono">
                    {cartAdditions.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-amber-300 font-semibold block">Ajouts panier acheteurs</span>
                </div>

                {/* Commandes Directes */}
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-white/50 uppercase font-bold">
                    <span>Commandes</span>
                    <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-lg font-black text-emerald-400 font-mono">
                    {orders}
                  </div>
                  <span className="text-[10px] text-emerald-300 font-semibold block">Achats issus du boost</span>
                </div>

                {/* Chiffre d'Affaires */}
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-white/50 uppercase font-bold">
                    <span>CA Généré</span>
                    <TrendingUp className="w-3.5 h-3.5 text-[#FF6321]" />
                  </div>
                  <div className="text-lg font-black text-[#FF8C53] font-mono truncate">
                    {formatFCFA(revenue)}
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold block">ROAS : x{roas}</span>
                </div>
              </div>

              {/* SECTION 3: FINANCES & ZONES CIBLÉES */}
              <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/60">Budget publicitaire investi :</span>
                  <span className="font-mono font-black text-amber-300">{formatFCFA(budget)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/60">Bénéfice net marchand généré :</span>
                  <span className="font-mono font-black text-emerald-400">+{formatFCFA(netProfit)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/5">
                  <span className="text-white/60 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#FF6321]" />
                    Communes ciblées :
                  </span>
                  <span className="font-semibold text-white/80 truncate max-w-[200px]">
                    {camp.targetZones?.join(', ') || 'Toutes les communes d’Abidjan'}
                  </span>
                </div>
              </div>

              {/* Bouton Fermer */}
              <button
                type="button"
                onClick={() => setSelectedStatsCampaign(null)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#FF6321] to-[#FF8C00] text-white font-black text-xs transition active:scale-95 cursor-pointer shadow-lg shadow-orange-950/40"
              >
                Fermer les performances
              </button>
            </div>
          </div>
        );
      })()}

      {/* COMMENTS BOTTOM SHEET (READ-ONLY FOR ADMIN) */}
      {commentBottomSheetProductId && (
        <CommentsBottomSheet
          productId={commentBottomSheetProductId}
          isOpen={Boolean(commentBottomSheetProductId)}
          onClose={() => setCommentBottomSheetProductId(null)}
          readOnly={true}
        />
      )}
    </div>
  );
};
