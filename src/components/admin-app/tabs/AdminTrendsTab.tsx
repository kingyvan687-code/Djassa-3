import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Flame,
  TrendingUp,
  Sparkles,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Play,
  ArrowUpRight,
  BarChart3,
  Tag,
  Store,
  RefreshCw,
  Pin,
  Zap,
  Award,
  Trash2,
  EyeOff,
  Check,
  X,
  ExternalLink,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  MapPin,
  Clock,
  Radio,
  ShoppingBag,
  Wallet,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Camera
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Product, Seller } from '../../../types';
import { formatFCFA, formatMetricCount } from '../../../services/marketServices';
import { CommentsBottomSheet } from '../../feed/CommentsBottomSheet';

interface AdminTrendsTabProps {
  onNavigateTab?: (tab: any) => void;
  onSelectOrder?: (order: any) => void;
}

type TimeFilter = '24h' | '7j' | '30j' | 'tout';
type MediaFilter = 'all' | 'video' | 'photo';
type StatusFilter = 'all' | 'active' | 'boosted' | 'flagged' | 'hidden';

interface PublicationItem {
  id: string;
  name: string;
  description: string;
  images: string[];
  mediaType: 'video' | 'image';
  videoUrl?: string;
  videoPoster?: string;
  sellerId: string;
  category: string;
  price: number;
  likesCount: number;
  viewsCount: number;
  commentsCount: number;
  sharesCount: number;
  savesCount: number;
  salesCount: number;
  isPinned?: boolean;
  isBoosted?: boolean;
  boostDuration?: string;
  status: 'active' | 'flagged' | 'hidden';
  flagReason?: string;
  tags: string[];
  createdAt: string;
}

export const AdminTrendsTab: React.FC<AdminTrendsTabProps> = ({ onNavigateTab }) => {
  const {
    products,
    sellers,
    comments,
    setSelectedSeller,
    openPhotoViewer,
    updateProductAdmin,
    deleteProductAdmin,
    showToast,
    addAuditLog
  } = useApp();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('7j');
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modals & Active selections (100% fullscreen read-only preview matching AdminBoostDetailModal)
  const [selectedPublication, setSelectedPublication] = useState<PublicationItem | null>(null);
  const [previewScope, setPreviewScope] = useState<'current' | 'all'>('all');
  const [previewCurrentIndex, setPreviewCurrentIndex] = useState(0);
  const [isPreviewMuted, setIsPreviewMuted] = useState(true);
  const [previewImageIndices, setPreviewImageIndices] = useState<Record<string, number>>({});
  const [previewCommentsPubId, setPreviewCommentsPubId] = useState<string | null>(null);
  const [selectedStatsPubId, setSelectedStatsPubId] = useState<string | null>(null);
  const previewVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const previewFeedContainerRef = useRef<HTMLDivElement | null>(null);

  const [isBoostModalOpen, setIsBoostModalOpen] = useState(false);
  const [boostTargetPub, setBoostTargetPub] = useState<PublicationItem | null>(null);
  const [boostBadge, setBoostBadge] = useState('🔥 TENDANCE NATIONALE');
  const [boostDays, setBoostDays] = useState('3');

  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
  const [flagTargetPub, setFlagTargetPub] = useState<PublicationItem | null>(null);
  const [flagReasonText, setFlagReasonText] = useState('Contenu publicitaire non vérifié ou prix non conforme');

  // Mock publication items synced with products and enriched with realistic viral social data
  const [localPubOverrides, setLocalPubOverrides] = useState<Record<string, Partial<PublicationItem>>>({
    'prod-1': { isPinned: true, isBoosted: true, boostDuration: '3 jours restants' },
    'prod-3': { status: 'flagged', flagReason: 'Signalement utilisateur: prix jugé trompeur' }
  });

  // Extract / Map publications from products list
  const publications: PublicationItem[] = useMemo(() => {
    return products.map((p, idx) => {
      const override = localPubOverrides[p.id] || {};
      const isVid = p.mediaType === 'video' || !!p.videoUrl || (idx % 3 === 0);
      const seedViews = p.viewsCount || (1200 + ((p.id.charCodeAt(0) * 89 + idx * 450) % 35000));
      const seedLikes = p.likesCount || Math.floor(seedViews * 0.082);
      const seedComments = (p.reviewsCount || Math.floor(seedLikes * 0.12)) + (idx * 3);
      const seedShares = p.sharesCount || Math.floor(seedLikes * 0.09) + 4;
      const seedSaves = p.savesCount || Math.floor(seedLikes * 0.14) + 6;

      const currentStatus: 'active' | 'flagged' | 'hidden' =
        override.status || (idx === 4 ? 'flagged' : idx === 8 ? 'hidden' : 'active');

      return {
        id: p.id,
        name: p.name,
        description: p.description || 'Publication découverte shopping sur Djassa Côte d’Ivoire',
        images: p.images && p.images.length > 0 ? p.images : ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600'],
        mediaType: isVid ? 'video' : 'image',
        videoUrl: p.videoUrl || (isVid ? 'https://assets.mixkit.co/videos/preview/mixkit-fashion-model-in-colorful-clothes-39878-large.mp4' : undefined),
        videoPoster: p.videoPoster || p.images[0],
        sellerId: p.sellerId,
        category: p.category || 'Mode & Style',
        price: p.price || 15000,
        likesCount: seedLikes,
        viewsCount: seedViews,
        commentsCount: seedComments,
        sharesCount: seedShares,
        savesCount: seedSaves,
        salesCount: p.salesCount || 18,
        isPinned: override.isPinned ?? (idx === 0),
        isBoosted: override.isBoosted ?? (idx % 4 === 1),
        boostDuration: override.boostDuration || (override.isBoosted ? '48 heures' : undefined),
        status: currentStatus,
        flagReason: override.flagReason || (currentStatus === 'flagged' ? 'Signalé par la communauté' : undefined),
        tags: p.tags && p.tags.length > 0 ? p.tags : ['Tendance', 'Abidjan', 'Promo'],
        createdAt: 'Il y a ' + ((idx % 5) + 1) + ' jours'
      };
    });
  }, [products, localPubOverrides]);

  // Key stats
  const totalActivePubs = publications.filter(p => p.status === 'active').length;
  const totalViews = publications.reduce((acc, p) => acc + p.viewsCount, 0);
  const totalBoosted = publications.filter(p => p.isBoosted).length;
  const totalFlagged = publications.filter(p => p.status === 'flagged').length;
  const totalSales = publications.reduce((acc, p) => acc + (p.salesCount || 0), 0);
  const totalRevenue = publications.reduce((acc, p) => acc + ((p.salesCount || 0) * (p.price || 0)), 0);

  // Filtered publications
  const filteredPublications = useMemo(() => {
    return publications.filter(pub => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const seller = sellers.find(s => s.id === pub.sellerId);
        const matchName = pub.name.toLowerCase().includes(q);
        const matchDesc = pub.description.toLowerCase().includes(q);
        const matchSeller = seller?.name.toLowerCase().includes(q) || seller?.username?.toLowerCase().includes(q);
        const matchCategory = pub.category.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchSeller && !matchCategory) return false;
      }
      // Media filter
      if (mediaFilter !== 'all' && pub.mediaType !== mediaFilter) return false;
      // Status filter
      if (statusFilter === 'active' && pub.status !== 'active') return false;
      if (statusFilter === 'boosted' && !pub.isBoosted) return false;
      if (statusFilter === 'flagged' && pub.status !== 'flagged') return false;
      if (statusFilter === 'hidden' && pub.status !== 'hidden') return false;
      // Category filter
      if (categoryFilter !== 'all' && pub.category !== categoryFilter) return false;

      return true;
    });
  }, [publications, searchQuery, mediaFilter, statusFilter, categoryFilter, sellers]);

  // Ranked most popular publications (sorted by viral score = views + likes*3 + shares*5)
  const popularPublications = useMemo(() => {
    return [...filteredPublications].sort((a, b) => {
      const scoreA = a.viewsCount + a.likesCount * 3 + a.sharesCount * 5 + (a.isPinned ? 100000 : 0);
      const scoreB = b.viewsCount + b.likesCount * 3 + b.sharesCount * 5 + (b.isPinned ? 100000 : 0);
      return scoreB - scoreA;
    });
  }, [filteredPublications]);

  // Publications rendered inside the 100% fullscreen read-only preview
  const previewPublications = useMemo(() => {
    if (!selectedPublication) return [];
    const liveSelected = publications.find((p) => p.id === selectedPublication.id) || selectedPublication;
    if (previewScope === 'current') {
      return [liveSelected];
    }
    if (popularPublications.some((p) => p.id === liveSelected.id)) {
      return popularPublications;
    }
    return [liveSelected, ...popularPublications];
  }, [selectedPublication, previewScope, popularPublications, publications]);

  const currentPreviewPub = previewPublications[previewCurrentIndex] || previewPublications[0];
  const currentPreviewPubId = currentPreviewPub?.id;
  const selectedStatsPub = useMemo(() => {
    if (!selectedStatsPubId) return null;
    return publications.find((p) => p.id === selectedStatsPubId) || null;
  }, [selectedStatsPubId, publications]);

  const handleOpenPreview = (pub: PublicationItem) => {
    const idx = popularPublications.findIndex((p) => p.id === pub.id);
    setPreviewScope('all');
    setPreviewCurrentIndex(idx >= 0 ? idx : 0);
    setSelectedPublication(pub);
  };

  // Scroll to selected publication when opening preview or toggling scope
  useEffect(() => {
    if (!selectedPublication) return;
    const container = previewFeedContainerRef.current;
    if (!container) return;
    const targetIdx = previewScope === 'current'
      ? 0
      : Math.max(0, previewPublications.findIndex((p) => p.id === selectedPublication.id));
    setPreviewCurrentIndex(targetIdx);
    requestAnimationFrame(() => {
      if (previewFeedContainerRef.current && previewFeedContainerRef.current.clientHeight > 0) {
        previewFeedContainerRef.current.scrollTo({
          top: targetIdx * previewFeedContainerRef.current.clientHeight,
          behavior: 'auto'
        });
      }
    });
  }, [selectedPublication, previewScope]);

  // Sync video play/pause on active publication in fullscreen preview
  useEffect(() => {
    if (!selectedPublication || !currentPreviewPubId) return;
    Object.entries(previewVideoRefs.current).forEach(([id, videoEl]) => {
      if (!videoEl) return;
      if (id === currentPreviewPubId) {
        videoEl.play().catch(() => {});
      } else {
        videoEl.pause();
      }
    });
  }, [selectedPublication, currentPreviewPubId]);

  // Handlers for moderation
  const handleTogglePin = (pubId: string) => {
    const current = localPubOverrides[pubId]?.isPinned ?? publications.find(p => p.id === pubId)?.isPinned ?? false;
    const nextState = !current;
    setLocalPubOverrides(prev => ({
      ...prev,
      [pubId]: { ...prev[pubId], isPinned: nextState }
    }));
    showToast(nextState ? 'Publication épinglée en tête du fil 🔥' : 'Publication désépinglée');
    if (addAuditLog) {
      addAuditLog(
        nextState ? 'Épinglage publication' : 'Retrait épinglage publication',
        `Pub #${pubId}`,
        'marketplace',
        `Statut épinglé modifié par Admin`
      );
    }
  };

  const handleToggleStatus = (pubId: string, targetStatus: 'active' | 'hidden' | 'flagged', reason?: string) => {
    setLocalPubOverrides(prev => ({
      ...prev,
      [pubId]: {
        ...prev[pubId],
        status: targetStatus,
        flagReason: reason || (targetStatus === 'flagged' ? 'Signalé par la modération' : undefined)
      }
    }));
    if (targetStatus === 'active') {
      showToast('Publication approuvée et republiée ✅');
    } else if (targetStatus === 'hidden') {
      showToast('Publication masquée du fil public 👁️‍🗨️');
    } else {
      showToast('Publication placée en quarantaine / signalée ⚠️');
    }
    if (addAuditLog) {
      addAuditLog(
        `Changement statut publication -> ${targetStatus}`,
        `Pub #${pubId}`,
        'marketplace',
        reason || `Action modération Djassa Admin`
      );
    }
  };

  const handleApplyBoost = () => {
    if (!boostTargetPub) return;
    setLocalPubOverrides(prev => ({
      ...prev,
      [boostTargetPub.id]: {
        ...prev[boostTargetPub.id],
        isBoosted: true,
        boostDuration: `${boostDays} jours`
      }
    }));
    showToast(`Publication boostée avec le badge « ${boostBadge} » pour ${boostDays} jours ! 🚀`);
    if (addAuditLog) {
      addAuditLog(
        'Boost Sponsorisé Administrateur',
        `Pub #${boostTargetPub.id}`,
        'marketplace',
        `Badge: ${boostBadge}, Durée: ${boostDays}j`
      );
    }
    setIsBoostModalOpen(false);
    setBoostTargetPub(null);
  };

  const handleRemoveBoost = (pubId: string) => {
    setLocalPubOverrides(prev => ({
      ...prev,
      [pubId]: {
        ...prev[pubId],
        isBoosted: false,
        boostDuration: undefined
      }
    }));
    showToast('Boost sponsorisé retiré');
  };

  const handleDeletePublication = (pub: PublicationItem) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer définitivement la publication "${pub.name}" ?`)) {
      deleteProductAdmin(pub.id);
      showToast('Publication supprimée avec succès 🗑️');
      if (selectedPublication?.id === pub.id) {
        setSelectedPublication(null);
      }
      if (addAuditLog) {
        addAuditLog(
          'Suppression publication vendeur',
          `Pub #${pub.id} - ${pub.name}`,
          'marketplace',
          `Supprimé par super administrateur`
        );
      }
    }
  };

  return (
    <div id="admin-trends-screen" className="w-full h-full bg-[#0A0A0A] text-white overflow-y-auto no-scrollbar pb-24 select-none">
      {/* =========================================================================
          1. HEADER AVEC GRADIENT & BADGE TENDANCES
          ========================================================================= */}
      <div className="relative p-4 pt-6 bg-gradient-to-b from-purple-950/40 via-purple-900/10 to-transparent border-b border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF6321] to-purple-600 flex items-center justify-center shadow-lg shadow-[#FF6321]/20">
              <Flame className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-black text-white tracking-tight">Tendances & Publications</h1>
                <span className="px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] font-bold">
                  LIVE FEED
                </span>
              </div>
              <p className="text-[11px] text-white/50">Gestion virale, modération des posts & tops des ventes</p>
            </div>
          </div>

          <button
            onClick={() => showToast('Flux actualisé en temps réel ✨')}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white/70 hover:text-white transition cursor-pointer"
            title="Rafraîchir"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* STATS OVERVIEW CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {/* Card 1: Nombre d'achats */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-white/5 backdrop-blur-md rounded-2xl p-2.5 border border-emerald-500/20 flex flex-col justify-between">
            <div className="flex items-center justify-between text-white/50 text-[10px]">
              <span>Nombre d'Achats</span>
              <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="mt-1">
              <span className="text-lg font-black text-emerald-400">{totalSales}</span>
              <span className="text-[10px] text-emerald-400/80 ml-1.5 font-bold">commandes</span>
            </div>
          </div>

          {/* Card 2: Revenu généré */}
          <div className="bg-gradient-to-br from-amber-500/10 to-white/5 backdrop-blur-md rounded-2xl p-2.5 border border-amber-500/20 flex flex-col justify-between">
            <div className="flex items-center justify-between text-white/50 text-[10px]">
              <span>Revenu Estimé</span>
              <Wallet className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="mt-1">
              <span className="text-base font-black text-amber-400 truncate block">{formatFCFA(totalRevenue)}</span>
              <span className="text-[9px] text-amber-400/80 font-bold block">chiffre d'affaires</span>
            </div>
          </div>

          {/* Card 3: Publications */}
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-white/50 text-[10px]">
              <span>Publications</span>
              <Layers className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="mt-1">
              <span className="text-lg font-black text-white">{totalActivePubs}</span>
              <span className="text-[10px] text-emerald-400 ml-1.5 font-bold">actives</span>
            </div>
          </div>

          {/* Card 4: Vues Totales */}
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-white/50 text-[10px]">
              <span>Vues Totales</span>
              <Eye className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="mt-1">
              <span className="text-lg font-black text-white">{(totalViews / 1000).toFixed(1)}k</span>
              <span className="text-[10px] text-sky-400 ml-1.5 font-bold">+18%</span>
            </div>
          </div>

          {/* Card 5: Sponsorisées */}
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-white/50 text-[10px]">
              <span>Sponsorisées</span>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="mt-1">
              <span className="text-lg font-black text-white">{totalBoosted}</span>
              <span className="text-[10px] text-amber-400 ml-1.5 font-bold">Djassa Ads</span>
            </div>
          </div>

          {/* Card 6: Signalements */}
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 flex flex-col justify-between">
            <div className="flex items-center justify-between text-white/50 text-[10px]">
              <span>Signalements</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="mt-1">
              <span className="text-lg font-black text-rose-400">{totalFlagged}</span>
              <span className="text-[10px] text-rose-400/80 ml-1.5 font-bold">à modérer</span>
            </div>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            id="trends-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une publication, un marchand, un produit ou un tag..."
            className="w-full pl-10 pr-10 py-2.5 bg-white/10 border border-white/10 rounded-2xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-purple-400 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

      </div>

      {/* =========================================================================
          2. PUBLICATIONS POPULAIRES ET TENDANCES VENDEURS
          ========================================================================= */}
      <div className="p-4 space-y-4">
        <div className="space-y-4">
            {/* List of top viral publications */}
            {popularPublications.length === 0 ? (
              <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/10 space-y-2">
                <Flame className="w-8 h-8 text-white/30 mx-auto" />
                <p className="text-sm font-bold text-white">Aucune publication trouvée</p>
                <p className="text-xs text-white/40">Essayez de modifier vos filtres ou termes de recherche.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {popularPublications.map((pub, index) => {
                  const seller = sellers.find(s => s.id === pub.sellerId);
                  const isTop3 = index < 3;

                  return (
                    <div
                      key={pub.id}
                      className={`relative rounded-2xl border transition overflow-hidden bg-white/5 backdrop-blur-sm ${
                        pub.isPinned
                          ? 'border-purple-500/60 shadow-lg shadow-purple-900/20'
                          : pub.isBoosted
                          ? 'border-amber-500/40 shadow-md shadow-amber-900/10'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      {/* Top Rank & Status Badges Row (in-flow header so it never blocks thumbnail or title) */}
                      <div className="px-3 pt-2.5 pb-2 border-b border-white/5 bg-white/[0.02] flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 shadow-sm ${
                            index === 0
                              ? 'bg-amber-400 text-black'
                              : index === 1
                              ? 'bg-slate-200 text-black'
                              : index === 2
                              ? 'bg-amber-700 text-white'
                              : 'bg-black/70 text-white/80 border border-white/20'
                          }`}
                        >
                          {index === 0 ? '👑 #1 VIRAL' : `#${index + 1}`}
                        </span>

                        {pub.isPinned && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white text-[9px] font-black flex items-center gap-1 shadow-sm">
                            <Pin className="w-2.5 h-2.5 fill-current" /> ÉPINGLÉ
                          </span>
                        )}

                        {pub.isBoosted && (
                          <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-[#FF6321] text-white text-[9px] font-black flex items-center gap-1 shadow-sm">
                            <Zap className="w-2.5 h-2.5 fill-current" /> SPONSORISÉ
                          </span>
                        )}
                      </div>

                      {/* Content Card Layout */}
                      <div className="flex p-3 gap-3">
                        {/* Media Thumbnail */}
                        <div
                          onClick={() => handleOpenPreview(pub)}
                          className="relative w-28 sm:w-32 aspect-[3/4] rounded-xl overflow-hidden bg-black shrink-0 cursor-pointer group"
                        >
                          <img
                            src={pub.images[0] || pub.videoPoster}
                            alt={pub.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                          
                          {pub.mediaType === 'video' ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/30 text-white group-hover:scale-110 transition">
                                <Play className="w-4 h-4 fill-current ml-0.5" />
                              </div>
                            </div>
                          ) : (
                            <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[9px] text-white/80">
                              Photo
                            </div>
                          )}

                          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[9px] font-bold text-white">
                            <Eye className="w-3 h-3 text-sky-400" />
                            <span>{(pub.viewsCount / 1000).toFixed(1)}k</span>
                          </div>
                        </div>

                        {/* Details & Performance */}
                        <div className="flex-1 flex flex-col justify-between min-w-0">
                          <div>
                            {/* Seller & Location */}
                            <div className="flex items-center gap-2 mb-1">
                              <img
                                src={seller?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
                                alt={seller?.name || 'Vendeur'}
                                className="w-5 h-5 rounded-full object-cover border border-purple-500/40"
                              />
                              <span className="text-xs font-bold text-white/90 truncate">
                                {seller?.name || 'Marchand Djassa'}
                              </span>
                              {seller?.verified && (
                                <CheckCircle2 className="w-3 h-3 text-purple-400 shrink-0" />
                              )}
                            </div>

                            {/* Title & Price */}
                            <h3
                              onClick={() => handleOpenPreview(pub)}
                              className="text-xs font-bold text-white line-clamp-2 hover:text-purple-300 transition cursor-pointer"
                            >
                              {pub.name}
                            </h3>

                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-black text-[#FF6321]">{formatFCFA(pub.price)}</span>
                              <span className="text-[10px] text-white/40">• {pub.category}</span>
                            </div>
                          </div>

                          {/* Section: Nombre d'achats du produit */}
                          <div className="flex items-center justify-between bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-transparent border border-emerald-500/25 rounded-xl px-2.5 py-1.5 my-1.5 shadow-sm">
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                                <ShoppingBag className="w-3 h-3" />
                              </div>
                              <span className="text-[10px] font-bold text-white/90">Achats du produit :</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-black text-emerald-400">{pub.salesCount} vendus</span>
                              <span className="text-[9px] text-emerald-400/70">({formatFCFA(pub.salesCount * pub.price)})</span>
                            </div>
                          </div>

                          {/* Social Metrics Grid */}
                          <div className="bg-black/30 rounded-xl p-2 border border-white/5 grid grid-cols-4 gap-1 text-center my-2">
                            <div>
                              <div className="flex items-center justify-center gap-0.5 text-rose-400 text-[10px] font-bold">
                                <Heart className="w-2.5 h-2.5 fill-current" />
                                <span>{pub.likesCount}</span>
                              </div>
                              <span className="text-[8px] text-white/40 block">J'aime</span>
                            </div>
                            <div>
                              <div className="flex items-center justify-center gap-0.5 text-sky-400 text-[10px] font-bold">
                                <MessageCircle className="w-2.5 h-2.5" />
                                <span>{pub.commentsCount}</span>
                              </div>
                              <span className="text-[8px] text-white/40 block">Avis</span>
                            </div>
                            <div>
                              <div className="flex items-center justify-center gap-0.5 text-emerald-400 text-[10px] font-bold">
                                <Share2 className="w-2.5 h-2.5" />
                                <span>{pub.sharesCount}</span>
                              </div>
                              <span className="text-[8px] text-white/40 block">Partages</span>
                            </div>
                            <div>
                              <div className="flex items-center justify-center gap-0.5 text-amber-400 text-[10px] font-bold">
                                <Bookmark className="w-2.5 h-2.5" />
                                <span>{pub.savesCount}</span>
                              </div>
                              <span className="text-[8px] text-white/40 block">Sauvegardes</span>
                            </div>
                          </div>

                          {/* Quick Admin Actions Row */}
                          <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-white/5">
                            <button
                              onClick={() => handleOpenPreview(pub)}
                              className="flex-1 py-1.5 px-2 bg-white/10 hover:bg-white/15 rounded-lg text-[10px] font-bold text-white flex items-center justify-center gap-1 transition cursor-pointer"
                            >
                              <Eye className="w-3 h-3 text-sky-400" />
                              <span>Aperçu</span>
                            </button>

                            <button
                              onClick={() => handleTogglePin(pub.id)}
                              className={`py-1.5 px-2.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                                pub.isPinned
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'
                              }`}
                              title={pub.isPinned ? 'Désépingler' : 'Épingler en haut'}
                            >
                              <Pin className={`w-3 h-3 ${pub.isPinned ? 'fill-current' : ''}`} />
                            </button>

                            <button
                              onClick={() => {
                                setBoostTargetPub(pub);
                                setIsBoostModalOpen(true);
                              }}
                              className={`py-1.5 px-2.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                                pub.isBoosted
                                  ? 'bg-amber-500 text-black'
                                  : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'
                              }`}
                              title="Booster / Sponsoriser"
                            >
                              <Zap className={`w-3 h-3 ${pub.isBoosted ? 'fill-current' : ''}`} />
                            </button>

                            <button
                              onClick={() => {
                                setFlagTargetPub(pub);
                                setIsFlagModalOpen(true);
                              }}
                              className={`py-1.5 px-2.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                                pub.status === 'flagged'
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-400'
                              }`}
                              title="Signaler / Modérer"
                            >
                              <ShieldAlert className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
      </div>

      {/* =========================================================================
          3. PAGE APERÇU PLEIN ÉCRAN 100% ESPACE — OBSERVATION LECTURE SEULE & STATS
          (MÊME DESIGN QUE LA PAGE DÉTAIL DES PUBLICITÉS DE L'ONGLET PROMO & PUB)
          ========================================================================= */}
      {selectedPublication && (
        <div
          id="admin-trend-preview-screen"
          className="fixed inset-0 z-50 w-full h-[100dvh] bg-[#0A0A0A] text-white flex flex-col overflow-hidden select-none isolate animate-in fade-in duration-200"
        >
          {/* AMBIENT GLOWS (EXACT DESIGN OF CLIENT APP & PROMO DETAIL) */}
          <div className="absolute -top-32 -left-32 w-80 h-80 bg-[#FF6321] opacity-20 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute top-1/2 -right-32 w-80 h-80 bg-[#FF6321] opacity-15 blur-[140px] rounded-full pointer-events-none" />
          <div className="absolute -bottom-32 left-1/4 w-80 h-80 bg-[#FF6321] opacity-10 blur-[120px] rounded-full pointer-events-none" />

          {/* TOP HEADER */}
          <div className="absolute top-0 left-0 right-0 z-40 pt-safe px-4 py-3 flex items-center justify-between gap-2 bg-gradient-to-b from-black/90 via-black/50 to-transparent">
            {/* Left: Back Button to Admin Trends */}
            <button
              id="btn-return-to-admin-trends"
              type="button"
              onClick={() => setSelectedPublication(null)}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/80 hover:bg-black/95 backdrop-blur-md border border-[#FF6321]/60 text-white font-extrabold text-xs shadow-xl shadow-orange-600/30 transition active:scale-95 cursor-pointer group shrink-0"
              title="Revenir aux tendances"
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-r from-[#FF6321] to-[#FF8C00] flex items-center justify-center shrink-0 shadow-sm">
                <ArrowLeft className="w-3.5 h-3.5 text-white stroke-[3] group-hover:-translate-x-0.5 transition-transform" />
              </div>
              <span className="font-black text-white text-xs">Retour Admin</span>
            </button>

            {/* Center: Scope Toggle (Navigation across publications) */}
            <div className="flex items-center p-0.5 bg-black/70 backdrop-blur-md border border-white/15 rounded-full shadow-lg">
              <button
                type="button"
                onClick={() => setPreviewScope('current')}
                className={`px-3 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                  previewScope === 'current'
                    ? 'bg-gradient-to-r from-[#FF6321] to-[#FF8C53] text-white shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                Cette publication
              </button>
              {popularPublications.length > 1 && (
                <button
                  type="button"
                  onClick={() => setPreviewScope('all')}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                    previewScope === 'all'
                      ? 'bg-gradient-to-r from-[#FF6321] to-[#FF8C53] text-white shadow-sm'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Tout le flux ({popularPublications.length})
                </button>
              )}
            </div>

            {/* Right: Sound & Close Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsPreviewMuted(!isPreviewMuted)}
                className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition active:scale-95 border border-white/10 cursor-pointer"
                title={isPreviewMuted ? 'Activer le son' : 'Couper le son'}
              >
                {isPreviewMuted ? <VolumeX className="w-4 h-4 text-white/70" /> : <Volume2 className="w-4 h-4 text-[#FF6321]" />}
              </button>

              <button
                id="btn-close-trend-preview-screen"
                type="button"
                onClick={() => setSelectedPublication(null)}
                className="w-8 h-8 rounded-full bg-black/80 hover:bg-black/95 text-white/80 hover:text-white flex items-center justify-center transition active:scale-95 border border-white/20 cursor-pointer shadow-lg"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* MAIN FULLSCREEN VERTICAL FEED CONTAINER (100% SPACE) */}
          <main className="flex-1 w-full h-full overflow-hidden relative">
            <div
              ref={previewFeedContainerRef}
              className="w-full h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
              onScroll={(e) => {
                if (!e.currentTarget.clientHeight) return;
                const nextIndex = Math.round(e.currentTarget.scrollTop / e.currentTarget.clientHeight);
                setPreviewCurrentIndex((prev) => (prev === nextIndex ? prev : nextIndex));
              }}
            >
              {previewPublications.map((pub) => {
                const pubSeller = sellers.find((s) => s.id === pub.sellerId) || {
                  id: pub.sellerId,
                  name: 'Vendeur Djassa',
                  username: 'vendeur',
                  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120',
                  verified: true
                };
                const catalogProduct = products.find((p) => p.id === pub.id);
                const realComments = comments[pub.id] || [];
                const displayedCommentsCount = realComments.length > 0 ? realComments.length : pub.commentsCount;
                const isVid = pub.mediaType === 'video' && Boolean(pub.videoUrl);
                const pubImages = (pub.images && pub.images.length > 0)
                  ? pub.images
                  : [pub.videoPoster || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600'];
                const activeImgIdx = previewImageIndices[pub.id] || 0;
                const currentImg = pubImages[activeImgIdx] || pubImages[0];

                return (
                  <div
                    key={pub.id}
                    id={`admin-trend-feed-item-${pub.id}`}
                    className="relative w-full h-full snap-start snap-always bg-neutral-950 flex items-center justify-center overflow-hidden"
                  >
                    {/* MEDIA BACKGROUND */}
                    {isVid ? (
                      <video
                        ref={(el) => {
                          previewVideoRefs.current[pub.id] = el;
                        }}
                        src={pub.videoUrl}
                        poster={pub.videoPoster || pubImages[0]}
                        className="w-full h-full object-cover cursor-pointer"
                        loop
                        playsInline
                        muted={isPreviewMuted}
                        onClick={() => {
                          const v = previewVideoRefs.current[pub.id];
                          if (v) v.paused ? v.play() : v.pause();
                        }}
                      />
                    ) : (
                      <div className="relative w-full h-full flex items-center justify-center overflow-hidden select-none">
                        {/* Ambient blurred backdrop */}
                        <img
                          src={currentImg}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-35 scale-110 pointer-events-none transition-all duration-500"
                          aria-hidden="true"
                        />

                        {/* Main High-Res Image */}
                        <img
                          key={`${pub.id}-${activeImgIdx}`}
                          src={currentImg}
                          alt={pub.name}
                          className="relative z-10 max-w-full max-h-full w-auto h-auto object-contain select-none transition duration-300 pointer-events-none"
                        />

                        {/* Multi-Photo Carousel Dots / Indicator */}
                        {pubImages.length > 1 && (
                          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 shadow-lg">
                            <Layers className="w-3 h-3 text-[#FF6321]" />
                            <span className="text-[11px] font-black text-white">
                              {activeImgIdx + 1} / {pubImages.length}
                            </span>
                            <div className="flex items-center gap-1 ml-1.5">
                              {pubImages.map((_, i) => (
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

                        {/* Quick Previous / Next buttons for multi-image navigation */}
                        {pubImages.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewImageIndices((prev) => ({
                                  ...prev,
                                  [pub.id]: activeImgIdx === 0 ? pubImages.length - 1 : activeImgIdx - 1
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
                                setPreviewImageIndices((prev) => ({
                                  ...prev,
                                  [pub.id]: activeImgIdx === pubImages.length - 1 ? 0 : activeImgIdx + 1
                                }));
                              }}
                              className="absolute right-16 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white/90 backdrop-blur-md border border-white/10 transition active:scale-90 cursor-pointer"
                              title="Photo suivante"
                            >
                              <ChevronRight className="w-5 h-5" />
                            </button>
                          </>
                        )}

                        {/* Fullscreen Image Viewer CTA */}
                        {catalogProduct && (
                          <button
                            type="button"
                            onClick={() => openPhotoViewer([catalogProduct], catalogProduct.id)}
                            className="absolute top-16 right-4 z-20 px-2.5 py-1 rounded-full bg-black/60 hover:bg-black/80 text-white/90 backdrop-blur-md border border-white/15 text-[10px] font-bold flex items-center gap-1 shadow-lg transition active:scale-95 cursor-pointer"
                            title="Visionner en plein écran"
                          >
                            <Camera className="w-3.5 h-3.5 text-[#FF6321]" />
                            <span>Visionner</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* GRADIENT OVERLAYS */}
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/40 via-transparent to-black/90" />

                    {/* RIGHT SIDEBAR ACTIONS (OBSERVATION LECTURE SEULE + STATS + COMMENTAIRES) */}
                    <div className="absolute right-3 bottom-10 z-20 flex flex-col items-center gap-4">
                      {/* Seller Avatar (No Follow '+' button for Admin) */}
                      <div className="relative mb-1">
                        <img
                          src={pubSeller.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                          alt={pubSeller.name}
                          onClick={() => {
                            const fullSeller = sellers.find((s) => s.id === pub.sellerId);
                            if (fullSeller) setSelectedSeller(fullSeller);
                          }}
                          className="w-12 h-12 rounded-full border-2 border-[#FF6321] object-cover cursor-pointer shadow-xl hover:scale-105 active:scale-95 transition-transform"
                        />
                        {pubSeller.verified && (
                          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#FF6321] text-white flex items-center justify-center text-[9px] font-black shadow">
                            ✓
                          </span>
                        )}
                      </div>

                      {/* BOUTON STATS (STATISTIQUES & MODÉRATION) */}
                      <button
                        id={`btn-trend-stats-${pub.id}`}
                        type="button"
                        onClick={() => setSelectedStatsPubId(pub.id)}
                        className="flex flex-col items-center group select-none active:scale-90 transition-transform cursor-pointer"
                        title="Voir les statistiques et options de modération"
                      >
                        <div className="p-2.5 rounded-full bg-gradient-to-tr from-[#FF6321] via-[#FF7538] to-[#FF9040] text-white shadow-xl shadow-orange-600/40 border border-white/30 group-hover:scale-115 transition-transform">
                          <BarChart3 className="w-5 h-5 text-white stroke-[2.5]" />
                        </div>
                        <span className="text-[10px] font-black text-white mt-0.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
                          Stats
                        </span>
                        <span className="text-[8px] font-bold text-amber-300 px-1 py-0.2 rounded-full bg-black/80 border border-amber-400/30 mt-0.5 font-mono">
                          {pub.salesCount}v
                        </span>
                      </button>

                      {/* Like Display (Read-Only Observation — cannot interact) */}
                      <div
                        className="flex flex-col items-center select-none cursor-default"
                        title="J'aime (Affichage observation uniquement)"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="w-9 h-9 text-white fill-white filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
                        >
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                        <span className="text-[11px] font-bold text-white mt-0.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
                          {formatMetricCount(pub.likesCount)}
                        </span>
                      </div>

                      {/* Comments Button (Admin CAN view comments in read-only mode) */}
                      <button
                        id={`btn-trend-comment-${pub.id}`}
                        type="button"
                        onClick={() => setPreviewCommentsPubId(pub.id)}
                        className="flex flex-col items-center group select-none active:scale-90 transition-transform cursor-pointer"
                        title="Consulter les commentaires (lecture seule)"
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
                          {formatMetricCount(displayedCommentsCount)}
                        </span>
                      </button>

                      {/* Save Display (Read-Only Observation — cannot interact) */}
                      <div
                        className="flex flex-col items-center select-none cursor-default"
                        title="Enregistrements (Affichage observation uniquement)"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="w-9 h-9 text-white fill-white filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
                        >
                          <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3.5 7 3.5V5c0-1.1-.9-2-2-2z" />
                        </svg>
                        <span className="text-[11px] font-bold text-white mt-0.5 drop-shadow">
                          {formatMetricCount(pub.savesCount)}
                        </span>
                      </div>

                      {/* Share Display (Read-Only Observation — cannot interact) */}
                      <div
                        className="flex flex-col items-center select-none cursor-default"
                        title="Partages (Affichage observation uniquement)"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="w-9 h-9 text-white fill-white filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
                        >
                          <path d="M14 5v4C7 10 4 15 3 20c2.5-3.5 6-5.1 11-5.1V19l8-7-8-7z" />
                        </svg>
                        <span className="text-[11px] font-bold text-white mt-0.5 drop-shadow">
                          {formatMetricCount(pub.sharesCount)}
                        </span>
                      </div>
                    </div>

                    {/* BOTTOM LEFT PRODUCT DETAILS OVERLAY (READ-ONLY OBSERVATION + STATS) */}
                    <div className="absolute left-4 bottom-5 right-20 z-20 space-y-2">
                      {/* Top Badges Row: Seller Handle + Status/Boost + Views */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <div
                          onClick={() => {
                            const fullSeller = sellers.find((s) => s.id === pub.sellerId);
                            if (fullSeller) setSelectedSeller(fullSeller);
                          }}
                          className="inline-flex items-center gap-1.5 cursor-pointer bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 hover:bg-black/80 transition"
                        >
                          <Store className="w-3.5 h-3.5 text-[#FF6321]" />
                          <span className="text-xs font-bold text-white">@{pubSeller.username || 'vendeur'}</span>
                          {pubSeller.verified && (
                            <span className="w-3.5 h-3.5 rounded-full bg-[#FF6321] text-white text-[9px] font-black flex items-center justify-center">
                              ✓
                            </span>
                          )}
                        </div>

                        {pub.isBoosted && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border text-amber-300 bg-amber-500/20 border-amber-500/40 shadow-sm">
                            <Zap className="w-3 h-3 fill-current" />
                            <span>Boosté Djassa Ads</span>
                          </span>
                        )}

                        {pub.isPinned && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border text-purple-300 bg-purple-500/20 border-purple-500/40 shadow-sm">
                            <Pin className="w-3 h-3 fill-current" />
                            <span>Épinglé</span>
                          </span>
                        )}

                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border shadow-sm ${
                          pub.status === 'active'
                            ? 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40'
                            : pub.status === 'flagged'
                            ? 'text-rose-300 bg-rose-500/20 border-rose-500/40'
                            : 'text-white/70 bg-white/10 border-white/20'
                        }`}>
                          {pub.status === 'active' ? 'En ligne' : pub.status === 'flagged' ? 'Signalé' : 'Masqué'}
                        </span>

                        <button
                          type="button"
                          onClick={() => setSelectedStatsPubId(pub.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-black/70 backdrop-blur-md border border-white/15 text-sky-300 shadow cursor-pointer active:scale-95"
                          title="Cliquez pour afficher les statistiques détaillées"
                        >
                          <Eye className="w-3 h-3 text-sky-400" />
                          <span>{formatMetricCount(pub.viewsCount)} vues</span>
                        </button>
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h2 className="text-sm font-extrabold text-white leading-tight line-clamp-2 drop-shadow-md">
                          {pub.name}
                        </h2>
                        <p className="text-xs text-white/80 line-clamp-1 mt-0.5">
                          {pub.description}
                        </p>
                      </div>

                      {/* Price Tag & Performances Button (NO Buy / NO Client Actions) */}
                      <div className="flex items-center gap-2 pt-1">
                        <div className="flex items-baseline gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl border border-white/15">
                          <span className="text-sm font-black text-[#FF6321]">
                            {formatFCFA(pub.price)}
                          </span>
                          {catalogProduct?.originalPrice && catalogProduct.originalPrice > pub.price && (
                            <span className="text-[10px] text-white/50 line-through">
                              {formatFCFA(catalogProduct.originalPrice)}
                            </span>
                          )}
                        </div>

                        {catalogProduct?.discountPercentage && (
                          <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-bold">
                            <Tag className="w-2.5 h-2.5" /> -{catalogProduct.discountPercentage}%
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedStatsPubId(pub.id)}
                          className="ml-auto px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white font-extrabold text-[11px] flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow"
                        >
                          <BarChart3 className="w-3.5 h-3.5 text-[#FF6321]" />
                          <span>Performances</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </main>

          {/* ===================================================================
              DRAWER STATISTIQUES & MODÉRATION DE LA PUBLICATION
              =================================================================== */}
          {selectedStatsPub && (() => {
            const realCommentsLen = (comments[selectedStatsPub.id] || []).length;
            const effectiveComments = realCommentsLen > 0 ? realCommentsLen : selectedStatsPub.commentsCount;
            const engagementRate = selectedStatsPub.viewsCount > 0
              ? (((selectedStatsPub.likesCount + effectiveComments + selectedStatsPub.sharesCount) / selectedStatsPub.viewsCount) * 100).toFixed(1)
              : '0.0';
            const revenueGenerated = (selectedStatsPub.salesCount || 0) * (selectedStatsPub.price || 0);

            return (
              <div
                id="trend-performance-stats-overlay"
                className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
                onClick={() => setSelectedStatsPubId(null)}
              >
                <div
                  className="w-full max-w-lg bg-[#111215] border border-white/15 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar select-none animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
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
                          Statistiques & Modération
                        </h3>
                        <p className="text-[11px] text-white/50 truncate max-w-[240px]">
                          {selectedStatsPub.name} · #{selectedStatsPub.id}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedStatsPubId(null)}
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition active:scale-95 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Section 1: Statut & Visibilité */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-950/40 via-[#18181D] to-[#121215] border border-[#FF6321]/30 space-y-2 shadow-lg">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <span className="text-[10px] text-white/40 uppercase font-bold block">Catégorie & Format</span>
                        <span className="text-xs font-black text-white">
                          {selectedStatsPub.category} · {selectedStatsPub.mediaType === 'video' ? 'Vidéo' : 'Photo'}
                        </span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                        selectedStatsPub.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : selectedStatsPub.status === 'flagged'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : 'bg-white/10 text-white/60 border-white/20'
                      }`}>
                        {selectedStatsPub.status === 'active' ? 'En ligne' : selectedStatsPub.status === 'flagged' ? 'Signalé' : 'Masqué'}
                      </span>
                    </div>

                    {(selectedStatsPub.isPinned || selectedStatsPub.isBoosted) && (
                      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-white/10 text-[10px]">
                        {selectedStatsPub.isPinned && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold flex items-center gap-1">
                            <Pin className="w-3 h-3" /> Épinglé en tête
                          </span>
                        )}
                        {selectedStatsPub.isBoosted && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold flex items-center gap-1">
                            <Zap className="w-3 h-3 fill-current" /> Boosté ({selectedStatsPub.boostDuration || 'Actif'})
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Section 2: Statistiques d'engagement et ventes */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-white/50 uppercase font-bold">
                        <span>Vues / Portée</span>
                        <Eye className="w-3.5 h-3.5 text-cyan-400" />
                      </div>
                      <div className="text-lg font-black text-white font-mono">
                        {selectedStatsPub.viewsCount.toLocaleString()}
                      </div>
                      <span className="text-[10px] text-cyan-300 font-semibold block">Engagement : {engagementRate}%</span>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-white/50 uppercase font-bold">
                        <span>Interactions</span>
                        <Heart className="w-3.5 h-3.5 text-rose-400" />
                      </div>
                      <div className="text-lg font-black text-rose-300 font-mono">
                        {selectedStatsPub.likesCount.toLocaleString()}
                      </div>
                      <span className="text-[10px] text-white/60 font-semibold block">
                        {effectiveComments} avis · {selectedStatsPub.savesCount} enr. · {selectedStatsPub.sharesCount} part.
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-white/50 uppercase font-bold">
                        <span>Ventes Produit</span>
                        <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div className="text-lg font-black text-emerald-400 font-mono">
                        {selectedStatsPub.salesCount}
                      </div>
                      <span className="text-[10px] text-emerald-300 font-semibold block">Commandes enregistrées</span>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-white/50 uppercase font-bold">
                        <span>CA Généré</span>
                        <TrendingUp className="w-3.5 h-3.5 text-[#FF6321]" />
                      </div>
                      <div className="text-lg font-black text-[#FF8C53] font-mono truncate">
                        {formatFCFA(revenueGenerated)}
                      </div>
                      <span className="text-[10px] text-white/60 font-semibold block">Prix : {formatFCFA(selectedStatsPub.price)}</span>
                    </div>
                  </div>

                  {/* Section 3: Actions Admin */}
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleTogglePin(selectedStatsPub.id)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          selectedStatsPub.isPinned
                            ? 'bg-purple-600 text-white'
                            : 'bg-white/10 text-white hover:bg-white/15'
                        }`}
                      >
                        <Pin className="w-3.5 h-3.5" />
                        <span>{selectedStatsPub.isPinned ? 'Désépingler' : 'Épingler en haut'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setBoostTargetPub(selectedStatsPub);
                          setIsBoostModalOpen(true);
                        }}
                        className="py-2 px-3 bg-gradient-to-r from-amber-500 to-[#FF6321] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Booster Djassa Ads</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(selectedStatsPub.id, selectedStatsPub.status === 'hidden' ? 'active' : 'hidden')}
                        className={`py-2 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                          selectedStatsPub.status === 'hidden'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white/10 text-white/80 hover:bg-white/20'
                        }`}
                      >
                        {selectedStatsPub.status === 'hidden' ? 'Rétablir' : 'Masquer'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFlagTargetPub(selectedStatsPub);
                          setIsFlagModalOpen(true);
                        }}
                        className="py-2 px-2 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Signaler
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleDeletePublication(selectedStatsPub);
                          setSelectedStatsPubId(null);
                        }}
                        className="py-2 px-2 bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Supprimer</span>
                      </button>
                    </div>
                  </div>

                  {/* Bouton Fermer */}
                  <button
                    type="button"
                    onClick={() => setSelectedStatsPubId(null)}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#FF6321] to-[#FF8C00] text-white font-black text-xs transition active:scale-95 cursor-pointer shadow-lg shadow-orange-950/40"
                  >
                    Fermer les statistiques
                  </button>
                </div>
              </div>
            );
          })()}

          {/* COMMENTS BOTTOM SHEET (READ-ONLY OBSERVATION FOR ADMIN) */}
          {previewCommentsPubId && (
            <CommentsBottomSheet
              productId={previewCommentsPubId}
              isOpen={Boolean(previewCommentsPubId)}
              onClose={() => setPreviewCommentsPubId(null)}
              readOnly={true}
            />
          )}
        </div>
      )}

      {/* =========================================================================
          4. MODAL BOOSTER / SPONSORISER DJASSA ADS
          ========================================================================= */}
      {isBoostModalOpen && boostTargetPub && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121214] border border-white/10 rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Zap className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Booster la publication</h3>
                  <p className="text-[10px] text-white/50">Mise en avant sponsorisée sur Djassa Ads</p>
                </div>
              </div>
              <button
                onClick={() => setIsBoostModalOpen(false)}
                className="text-white/40 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-white/80 block mb-1">Badge de mise en avant</label>
                <select
                  value={boostBadge}
                  onChange={(e) => setBoostBadge(e.target.value)}
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="🔥 TENDANCE NATIONALE" className="bg-[#121214]">🔥 TENDANCE NATIONALE</option>
                  <option value="⭐ SÉLECTION DJASSA" className="bg-[#121214]">⭐ SÉLECTION DJASSA</option>
                  <option value="⚡ VENTE FLASH VIRALE" className="bg-[#121214]">⚡ VENTE FLASH VIRALE</option>
                  <option value="👑 COUP DE CŒUR MODÉRATION" className="bg-[#121214]">👑 COUP DE CŒUR MODÉRATION</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-white/80 block mb-1">Durée du boost</label>
                <div className="grid grid-cols-4 gap-2">
                  {['1', '3', '7', '14'].map((d) => (
                    <button
                      key={d}
                      onClick={() => setBoostDays(d)}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        boostDays === d
                          ? 'bg-amber-500 text-black border-amber-400 font-black'
                          : 'bg-white/5 text-white/60 border-white/10 hover:text-white'
                      }`}
                    >
                      {d} jour{d !== '1' ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setIsBoostModalOpen(false)}
                className="flex-1 py-2.5 bg-white/10 text-white rounded-xl text-xs font-bold hover:bg-white/15 transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleApplyBoost}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-[#FF6321] text-white rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 hover:opacity-90 transition cursor-pointer"
              >
                Activer le Boost 🚀
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          5. MODAL SIGNALEMENT & MISE EN QUARANTAINE
          ========================================================================= */}
      {isFlagModalOpen && flagTargetPub && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121214] border border-white/10 rounded-3xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Modérer cette publication</h3>
                  <p className="text-[10px] text-white/50">Mettre en quarantaine ou masquer</p>
                </div>
              </div>
              <button
                onClick={() => setIsFlagModalOpen(false)}
                className="text-white/40 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-white/80 block mb-1">Motif de modération</label>
                <textarea
                  value={flagReasonText}
                  onChange={(e) => setFlagReasonText(e.target.value)}
                  rows={3}
                  className="w-full bg-white/10 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-white/40 focus:outline-none focus:border-rose-400"
                  placeholder="Expliquez la raison du signalement..."
                />
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-white/50 block">Suggestions rapides :</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Prix trompeur ou incorrect',
                    'Contrefaçon présumée',
                    'Contenu vidéo non conforme',
                    'Publicité hors sujet'
                  ].map((sug) => (
                    <button
                      key={sug}
                      onClick={() => setFlagReasonText(sug)}
                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-white/70 border border-white/10 transition cursor-pointer"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setIsFlagModalOpen(false)}
                className="flex-1 py-2.5 bg-white/10 text-white rounded-xl text-xs font-bold hover:bg-white/15 transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  handleToggleStatus(flagTargetPub.id, 'flagged', flagReasonText);
                  setIsFlagModalOpen(false);
                  setFlagTargetPub(null);
                }}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-black hover:bg-rose-500 transition cursor-pointer"
              >
                Confirmer Signalement ⚠️
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
