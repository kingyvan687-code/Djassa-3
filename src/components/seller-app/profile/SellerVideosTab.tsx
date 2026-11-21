import React, { useState } from 'react';
import { 
  Play, 
  Eye, 
  Heart, 
  ShoppingBag, 
  TrendingUp, 
  Search, 
  Filter, 
  Plus, 
  Pin, 
  Sparkles, 
  MoreVertical, 
  ArrowUpRight, 
  BarChart2, 
  Rocket, 
  ExternalLink,
  Video as VideoIcon,
  X,
  Check,
  Star
} from 'lucide-react';
import { Product } from '../../../types';
import { formatFCFA, formatMetricCount } from '../../../services/marketServices';
import { VideoStatsModal } from './VideoStatsModal';
import { VideoBoostModal } from './VideoBoostModal';
import { VideoDetailModal } from './VideoDetailModal';

interface Props {
  videos: Product[];
  onOpenVideoViewer: (products: Product[], startId?: string) => void;
  onSelectProduct: (product: Product) => void;
  onGoAddVideo: () => void;
  showToast: (msg: string) => void;
}

export const SellerVideosTab: React.FC<Props> = ({
  videos,
  onOpenVideoViewer,
  onSelectProduct,
  onGoAddVideo,
  showToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'popular' | 'sales' | 'pinned'>('all');
  const [sortBy, setSortBy] = useState<'views' | 'recent' | 'sales' | 'price'>('views');
  const [pinnedVideoId, setPinnedVideoId] = useState<string>(videos[0]?.id || '');
  const [activeMenuVideoId, setActiveMenuVideoId] = useState<string | null>(null);
  
  // Modals state
  const [statsVideo, setStatsVideo] = useState<Product | null>(null);
  const [boostVideo, setBoostVideo] = useState<Product | null>(null);
  const [selectedVideoForDetail, setSelectedVideoForDetail] = useState<Product | null>(null);

  // Cumulative Metrics
  const totalViews = videos.reduce(
    (acc, v) => acc + (v.videoViewsCount || v.viewsCount || 0),
    0
  );
  const totalLikes = videos.reduce(
    (acc, v) => acc + (v.videoLikesCount || v.likesCount || 0),
    0
  );
  const totalSales = videos.reduce((acc, v) => acc + (v.salesCount || 0), 0);
  const totalRevenue = videos.reduce(
    (acc, v) => acc + (v.salesCount || 0) * v.price,
    0
  );

  // Filter & Sort
  const filteredVideos = videos.filter((v) => {
    if (filterTab === 'popular' && (v.videoViewsCount || v.viewsCount || 0) < 10000) {
      return false;
    }
    if (filterTab === 'sales' && (v.salesCount || 0) < 40) {
      return false;
    }
    if (filterTab === 'pinned' && v.id !== pinnedVideoId) {
      return false;
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q) ||
      (v.tags && v.tags.some((t) => t.toLowerCase().includes(q)))
    );
  });

  const sortedVideos = [...filteredVideos].sort((a, b) => {
    if (sortBy === 'views') {
      return (b.videoViewsCount || b.viewsCount || 0) - (a.videoViewsCount || a.viewsCount || 0);
    }
    if (sortBy === 'sales') {
      return (b.salesCount || 0) - (a.salesCount || 0);
    }
    if (sortBy === 'price') {
      return b.price - a.price;
    }
    return 0;
  });

  const handleTogglePin = (videoId: string) => {
    if (pinnedVideoId === videoId) {
      setPinnedVideoId('');
      showToast('Vidéo retirée de la une boutique');
    } else {
      setPinnedVideoId(videoId);
      showToast('Vidéo épinglée à la une de votre boutique 📌');
    }
    setActiveMenuVideoId(null);
  };

  const handleBoostConfirmed = (product: Product, packName: string, amount: number) => {
    showToast(`Campagne ${packName} activée pour "${product.name}" 🚀`);
  };

  return (
    <div id="seller-videos-tab-container" className="space-y-4 select-none">
      {/* SEARCH & FILTERS BAR */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une vidéo, mot-clé, tissu..."
              className="w-full pl-8 pr-8 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF6321] transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-2.5 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white/80 focus:outline-none focus:border-[#FF6321]"
          >
            <option value="views" className="bg-[#121212]">Plus vues</option>
            <option value="sales" className="bg-[#121212]">Top ventes</option>
            <option value="price" className="bg-[#121212]">Prix</option>
          </select>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {[
            { id: 'all', label: `Toutes (${videos.length} publiées)` },
            { id: 'popular', label: '🔥 Plus Populaires' },
            { id: 'sales', label: '🛒 Meilleures Ventes' },
            { id: 'pinned', label: '📌 Épinglée' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold shrink-0 transition ${
                filterTab === tab.id
                  ? 'bg-[#FF6321] text-white shadow-md'
                  : 'bg-white/5 text-white/50 hover:text-white border border-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. VIDEO GRID */}
      {sortedVideos.length === 0 ? (
        <div className="p-10 rounded-3xl bg-white/[0.02] border border-white/5 text-center text-white/40 space-y-2">
          <VideoIcon className="w-10 h-10 mx-auto text-white/20" />
          <p className="text-xs font-bold text-white/70">Aucune vidéo trouvée</p>
          <p className="text-[10px] text-white/40">
            {searchQuery
              ? 'Aucun résultat ne correspond à votre recherche.'
              : 'Postez des vidéos démos pour capter l’attention des acheteurs à Abidjan !'}
          </p>
          <button
            onClick={onGoAddVideo}
            className="mt-2 px-4 py-2 rounded-xl bg-[#FF6321] hover:bg-[#ff753b] text-white text-xs font-bold transition shadow"
          >
            Publier une vidéo démo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {sortedVideos.map((video) => {
            const isPinned = video.id === pinnedVideoId;
            const viewsCount = video.videoViewsCount || video.viewsCount || 0;
            const likesCount = video.videoLikesCount || video.likesCount || 0;
            const isMenuOpen = activeMenuVideoId === video.id;

            return (
              <div
                key={video.id}
                onClick={() => setSelectedVideoForDetail(video)}
                className="relative aspect-[9/15] rounded-2xl overflow-hidden bg-neutral-900 border border-white/10 shadow-lg group flex flex-col justify-between p-2.5 select-none cursor-pointer hover:border-[#FF6321]/60 transition"
              >
                {/* Background Poster Image */}
                <img
                  src={video.videoPoster || video.images[0]}
                  alt={video.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500 pointer-events-none"
                />

                {/* Dark Gradient Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-black/60 pointer-events-none" />

                {/* TOP BAR: Views badge + 3-dots Menu */}
                <div className="relative z-10 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[10px] font-bold text-white shadow-sm">
                    <Eye className="w-3 h-3 text-cyan-400" />
                    <span>{formatMetricCount(viewsCount)}</span>
                  </div>

                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuVideoId(isMenuOpen ? null : video.id);
                      }}
                      className="p-1 rounded-full bg-black/60 backdrop-blur-md text-white/70 hover:text-white border border-white/15 transition"
                      aria-label="Options de la vidéo"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>

                    {/* Dropdown Options */}
                    {isMenuOpen && (
                      <div
                        className="absolute right-0 mt-1 w-44 bg-[#181818] border border-white/15 rounded-2xl p-1.5 shadow-2xl z-30 text-xs space-y-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            setActiveMenuVideoId(null);
                            setSelectedVideoForDetail(video);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-white/80 transition flex items-center gap-2"
                        >
                          <Play className="w-3.5 h-3.5 text-[#FF6321]" />
                          <span>Visionner en grand</span>
                        </button>

                        <button
                          onClick={() => {
                            setActiveMenuVideoId(null);
                            setStatsVideo(video);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-white/80 transition flex items-center gap-2"
                        >
                          <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Statistiques</span>
                        </button>

                        <button
                          onClick={() => {
                            setActiveMenuVideoId(null);
                            setBoostVideo(video);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-white/80 transition flex items-center gap-2"
                        >
                          <Rocket className="w-3.5 h-3.5 text-amber-400" />
                          <span>Booster (Djassa Ads)</span>
                        </button>

                        <button
                          onClick={() => handleTogglePin(video.id)}
                          className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-white/80 transition flex items-center gap-2"
                        >
                          <Pin className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{isPinned ? 'Désépingler' : 'Épingler à la une'}</span>
                        </button>

                        <button
                          onClick={() => {
                            setActiveMenuVideoId(null);
                            onSelectProduct(video);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-white/80 transition flex items-center gap-2"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Voir la fiche article</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* CENTER: Big Play Button to trigger video viewer */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedVideoForDetail(video);
                  }}
                  className="relative z-10 my-auto flex flex-col items-center justify-center cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-full bg-white/20 hover:bg-[#FF6321] backdrop-blur-md text-white flex items-center justify-center transition shadow-xl group-hover:scale-110 active:scale-95 border border-white/20">
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </div>
                  {isPinned && (
                    <span className="mt-2 px-2 py-0.5 rounded-full bg-[#FF6321] text-white text-[9px] font-black shadow flex items-center gap-0.5">
                      <Pin className="w-2.5 h-2.5 fill-white" /> Épinglée
                    </span>
                  )}
                </div>

                {/* BOTTOM: Product info + direct stats */}
                <div className="relative z-10 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-white/70 flex-wrap gap-1">
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                      {formatMetricCount(likesCount)}
                    </span>
                    <span className="flex items-center gap-1 text-amber-400 font-bold">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      {video.rating || 4.9} ({video.reviewsCount || Math.max(1, Math.round((video.salesCount || 10) * 0.15))})
                    </span>
                    <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                      <ShoppingBag className="w-3 h-3 text-emerald-400" />
                      {formatMetricCount(video.salesCount || 0)} {((video.salesCount || 0) <= 1) ? 'achat' : 'achats'}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-white line-clamp-1">
                    {video.name}
                  </p>

                  <div className="flex items-center justify-between gap-1 pt-0.5">
                    <span className="text-xs font-black text-[#FF6321]">
                      {formatFCFA(video.price)}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProduct(video);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[9px] font-extrabold transition"
                    >
                      Article
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* STATS MODAL */}
      <VideoStatsModal
        product={statsVideo}
        onClose={() => setStatsVideo(null)}
        onOpenVideoViewer={(p) => setSelectedVideoForDetail(p)}
        onOpenBoost={(p) => setBoostVideo(p)}
      />

      {/* BOOST MODAL */}
      <VideoBoostModal
        product={boostVideo}
        onClose={() => setBoostVideo(null)}
        onBoostConfirm={handleBoostConfirmed}
      />

      {/* RECREATED VIDEO DETAIL MODAL (MATCHING CLIENT HOME FEED) */}
      {selectedVideoForDetail && (
        <VideoDetailModal
          product={selectedVideoForDetail}
          allProducts={sortedVideos.length > 0 ? sortedVideos : videos}
          onClose={() => setSelectedVideoForDetail(null)}
          onSelectProduct={onSelectProduct}
          onOpenStats={(p) => setStatsVideo(p)}
          onOpenBoost={(p) => setBoostVideo(p)}
          showToast={showToast}
        />
      )}
    </div>
  );
};
