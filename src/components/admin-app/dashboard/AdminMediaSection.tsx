import React, { useState } from 'react';
import { 
  Film, 
  Image as ImageIcon, 
  Eye, 
  Heart, 
  Sparkles, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Store, 
  Search, 
  Filter, 
  Play, 
  Tag, 
  X, 
  ExternalLink,
  ShieldAlert,
  Flame
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Product } from '../../../types';
import { formatFCFA } from '../../../services/marketServices';

interface AdminMediaItem extends Partial<Product> {
  id: string;
  name: string;
  sellerId: string;
  price: number;
  mediaType?: 'video' | 'image';
  videoUrl?: string;
  images: string[];
  viewsCount?: number;
  likesCount?: number;
  reported?: boolean;
  featured?: boolean;
  category: string;
  moderationStatus?: 'approved' | 'pending' | 'flagged';
  reportReason?: string;
}

export const AdminMediaSection: React.FC = () => {
  const { products, sellers, updateProductAdmin, deleteProductAdmin, addAuditLog, showToast } = useApp();

  const [activeFilter, setActiveFilter] = useState<'all' | 'video' | 'image' | 'flagged' | 'featured'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewMedia, setPreviewMedia] = useState<AdminMediaItem | null>(null);

  // Local state for media with moderation attributes
  const [mediaList, setMediaList] = useState<AdminMediaItem[]>(() => {
    const saved = localStorage.getItem('djassa_admin_media');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    // Seed with existing products and some flagged / featured media
    return products.map((p, idx) => ({
      ...p,
      mediaType: p.mediaType || (idx % 2 === 0 ? 'video' : 'image'),
      videoUrl: p.videoUrl || (idx % 2 === 0 ? 'https://assets.mixkit.co/videos/preview/mixkit-fashion-model-showing-african-dress-41142-large.mp4' : undefined),
      viewsCount: p.viewsCount || Math.floor(Math.random() * 4500) + 300,
      likesCount: p.likesCount || Math.floor(Math.random() * 850) + 40,
      featured: idx === 0 || idx === 3,
      reported: idx === 1,
      moderationStatus: idx === 1 ? 'flagged' : 'approved',
      reportReason: idx === 1 ? 'Signalé par 3 utilisateurs : Prix non conforme au marché d’Adjamé' : undefined
    }));
  });

  const saveMedia = (updated: AdminMediaItem[]) => {
    setMediaList(updated);
    localStorage.setItem('djassa_admin_media', JSON.stringify(updated));
  };

  // Metrics
  const totalVideos = mediaList.filter(m => m.mediaType === 'video' || !!m.videoUrl).length;
  const totalPhotos = mediaList.filter(m => m.mediaType !== 'video' && !m.videoUrl).length;
  const totalViews = mediaList.reduce((acc, m) => acc + (m.viewsCount || 0), 0);
  const flaggedCount = mediaList.filter(m => m.reported || m.moderationStatus === 'flagged').length;

  const getSellerName = (sellerId: string) => {
    const s = sellers.find(sel => sel.id === sellerId);
    return s ? s.name : 'Marchand Adjamé';
  };

  // Filtered media
  const filteredList = mediaList.filter(m => {
    if (activeFilter === 'video' && m.mediaType !== 'video' && !m.videoUrl) return false;
    if (activeFilter === 'image' && (m.mediaType === 'video' || !!m.videoUrl)) return false;
    if (activeFilter === 'flagged' && !m.reported && m.moderationStatus !== 'flagged') return false;
    if (activeFilter === 'featured' && !m.featured) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = m.name?.toLowerCase().includes(q);
      const matchSeller = getSellerName(m.sellerId).toLowerCase().includes(q);
      const matchCat = m.category?.toLowerCase().includes(q);
      return matchName || matchSeller || matchCat;
    }

    return true;
  });

  const handleToggleFeature = (item: AdminMediaItem) => {
    const nextFeatured = !item.featured;
    const updated = mediaList.map(m => m.id === item.id ? { ...m, featured: nextFeatured } : m);
    saveMedia(updated);
    addAuditLog(
      nextFeatured ? 'Mise en avant média' : 'Retrait vedette média',
      item.name || item.id,
      'marketplace',
      `Publication ${nextFeatured ? 'épinglée en haut du flux' : 'retirée des vedettes'}`
    );
    showToast(nextFeatured ? `✨ "${item.name}" propulsé en vedette d’accueil !` : `Mise en avant retirée pour "${item.name}"`);
    if (previewMedia?.id === item.id) {
      setPreviewMedia({ ...previewMedia, featured: nextFeatured });
    }
  };

  const handleApproveMedia = (item: AdminMediaItem) => {
    const updated = mediaList.map(m => m.id === item.id ? { ...m, reported: false, moderationStatus: 'approved' as const, reportReason: undefined } : m);
    saveMedia(updated);
    addAuditLog('Validation contenu média', item.name || item.id, 'marketplace', 'Signalement levé après inspection admin.');
    showToast(`✅ Publication "${item.name}" approuvée conforme !`);
    if (previewMedia?.id === item.id) {
      setPreviewMedia({ ...previewMedia, reported: false, moderationStatus: 'approved', reportReason: undefined });
    }
  };

  const handleDeleteMedia = (item: AdminMediaItem) => {
    if (confirm(`Confirmez-vous la suppression de la publication "${item.name}" ?`)) {
      const updated = mediaList.filter(m => m.id !== item.id);
      saveMedia(updated);
      deleteProductAdmin(item.id);
      addAuditLog('Suppression média illicite', item.name || item.id, 'security', 'Contenu supprimé par l’administrateur.');
      showToast(`🗑️ Publication "${item.name}" supprimée du flux.`);
      setPreviewMedia(null);
    }
  };

  return (
    <div id="admin-media-management-section" className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
            <Film className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base font-black text-white">Vidéos & Photos Postées</h2>
            <p className="text-xs text-white/50">Modération du flux vidéo TikTok/Reels et vitrines des marchands</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60">Audience cumulée :</span>
          <span className="text-sm font-black text-emerald-400">{(totalViews).toLocaleString()} vues</span>
        </div>
      </div>

      {/* KPI METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div 
          onClick={() => setActiveFilter('video')}
          className={`p-3 rounded-xl border transition cursor-pointer ${
            activeFilter === 'video' ? 'bg-purple-900/30 border-purple-500/40' : 'bg-white/5 border-white/10 hover:bg-white/10'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-white/50 mb-1">
            <span>Vidéos Courtes</span>
            <Play className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <p className="text-lg font-black text-white">{totalVideos}</p>
          <span className="text-[10px] text-purple-400 font-bold">Format vertical</span>
        </div>

        <div 
          onClick={() => setActiveFilter('image')}
          className={`p-3 rounded-xl border transition cursor-pointer ${
            activeFilter === 'image' ? 'bg-cyan-950/40 border-cyan-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-white/50 mb-1">
            <span>Photos Produits</span>
            <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <p className="text-lg font-black text-white">{totalPhotos}</p>
          <span className="text-[10px] text-cyan-300 font-bold">Catalogues Adjamé</span>
        </div>

        <div 
          onClick={() => setActiveFilter('featured')}
          className={`p-3 rounded-xl border transition cursor-pointer ${
            activeFilter === 'featured' ? 'bg-amber-950/40 border-amber-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-white/50 mb-1">
            <span>En Vedette</span>
            <Flame className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p className="text-lg font-black text-amber-400">{mediaList.filter(m => m.featured).length}</p>
          <span className="text-[10px] text-amber-300 font-bold">Boostées accueil</span>
        </div>

        <div 
          onClick={() => setActiveFilter('flagged')}
          className={`p-3 rounded-xl border transition cursor-pointer ${
            activeFilter === 'flagged' ? 'bg-rose-950/40 border-rose-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-white/50 mb-1">
            <span>Signalements</span>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <p className="text-lg font-black text-rose-400">{flaggedCount}</p>
          <span className="text-[10px] text-rose-300 font-bold">À vérifier</span>
        </div>
      </div>

      {/* FILTER & SEARCH */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par titre, marchand ou catégorie..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-purple-500/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              activeFilter === 'all' ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/60 hover:text-white'
            }`}
          >
            Tous les médias ({mediaList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('video')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              activeFilter === 'video' ? 'bg-pink-600 text-white' : 'bg-white/5 text-pink-400 hover:text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            Vidéos ({totalVideos})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('image')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              activeFilter === 'image' ? 'bg-cyan-600 text-white' : 'bg-white/5 text-cyan-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Photos ({totalPhotos})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('featured')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              activeFilter === 'featured' ? 'bg-amber-600 text-white' : 'bg-white/5 text-amber-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Vedettes
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('flagged')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              activeFilter === 'flagged' ? 'bg-rose-600 text-white' : 'bg-white/5 text-rose-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Signalés ({flaggedCount})
          </button>
        </div>
      </div>

      {/* MEDIA GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filteredList.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-white/5 rounded-2xl border border-white/10 space-y-2">
            <Film className="w-8 h-8 text-white/30 mx-auto" />
            <p className="text-sm font-bold text-white">Aucun média trouvé</p>
            <p className="text-xs text-white/50">Modifiez la recherche ou le filtre de contenu.</p>
          </div>
        ) : (
          filteredList.map((item) => {
            const isVideo = item.mediaType === 'video' || !!item.videoUrl;
            const thumbnail = item.images?.[0] || 'https://images.unsplash.com/photo-1544441893-675973e31985?w=400';
            const sellerName = getSellerName(item.sellerId);

            return (
              <div
                key={item.id}
                className={`relative group bg-white/5 rounded-2xl border overflow-hidden flex flex-col transition ${
                  item.reported 
                    ? 'border-rose-500/50 ring-1 ring-rose-500/40' 
                    : item.featured
                    ? 'border-amber-500/40 ring-1 ring-amber-500/30'
                    : 'border-white/10 hover:border-purple-500/40'
                }`}
              >
                {/* THUMBNAIL / VIDEO COVER */}
                <div 
                  onClick={() => setPreviewMedia(item)}
                  className="relative aspect-[3/4] bg-black cursor-pointer overflow-hidden"
                >
                  <img
                    src={thumbnail}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />

                  {/* MEDIA TYPE BADGE */}
                  <div className="absolute top-2 left-2 flex items-center gap-1">
                    {isVideo ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-pink-400 text-[9px] font-bold">
                        <Play className="w-2.5 h-2.5 fill-pink-400" />
                        Vidéo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-cyan-400 text-[9px] font-bold">
                        <ImageIcon className="w-2.5 h-2.5" />
                        Photo
                      </span>
                    )}

                    {item.featured && (
                      <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[9px] font-black">
                        VEDETTE
                      </span>
                    )}
                  </div>

                  {item.reported && (
                    <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[9px] font-black animate-pulse flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      SIGNALÉ
                    </div>
                  )}

                  {/* BOTTOM STATS OVERLAY */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2.5 flex items-end justify-between text-white text-[10px]">
                    <div className="flex items-center gap-2 font-bold">
                      <span className="flex items-center gap-0.5">
                        <Eye className="w-3 h-3 text-white/70" />
                        {item.viewsCount || 0}
                      </span>
                      <span className="flex items-center gap-0.5 text-rose-400">
                        <Heart className="w-3 h-3 fill-rose-400" />
                        {item.likesCount || 0}
                      </span>
                    </div>

                    <span className="text-[#FF6321] font-black text-xs">
                      {formatFCFA(item.price)}
                    </span>
                  </div>
                </div>

                {/* TEXT & CONTROLS */}
                <div className="p-2.5 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white truncate" title={item.name}>
                      {item.name}
                    </h4>
                    <p className="text-[10px] text-white/50 truncate flex items-center gap-1">
                      <Store className="w-2.5 h-2.5 text-[#FF6321]" />
                      {sellerName}
                    </p>
                    {item.reportReason && (
                      <p className="text-[9px] text-rose-400 italic line-clamp-1 mt-1 bg-rose-500/10 p-1 rounded">
                        {item.reportReason}
                      </p>
                    )}
                  </div>

                  {/* ACTION BAR */}
                  <div className="flex items-center gap-1 pt-1 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => handleToggleFeature(item)}
                      title={item.featured ? 'Retirer de la une' : 'Propulser en vedette'}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition ${
                        item.featured 
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                          : 'bg-white/5 text-white/60 hover:text-white'
                      }`}
                    >
                      <Sparkles className="w-3 h-3" />
                      {item.featured ? 'Vedette' : 'Booster'}
                    </button>

                    {item.reported && (
                      <button
                        type="button"
                        onClick={() => handleApproveMedia(item)}
                        title="Valider et lever le signalement"
                        className="p-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteMedia(item)}
                      title="Supprimer la publication"
                      className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MEDIA PREVIEW MODAL */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#141414] border border-white/10 rounded-2xl overflow-hidden shadow-2xl space-y-3 p-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white truncate max-w-[280px]">
                  {previewMedia.name}
                </span>
                {previewMedia.featured && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-black text-[9px] font-black">
                    VEDETTE
                  </span>
                )}
              </div>
              <button
                onClick={() => setPreviewMedia(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            {/* VIDEO PLAYER OR PHOTO */}
            <div className="relative aspect-[9/14] max-h-[380px] bg-black rounded-xl overflow-hidden mx-auto">
              {previewMedia.videoUrl ? (
                <video
                  src={previewMedia.videoUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={previewMedia.images?.[0]}
                  alt={previewMedia.name}
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            {/* METADATA */}
            <div className="p-3 bg-white/5 rounded-xl space-y-1.5 text-xs text-white/70">
              <div className="flex justify-between items-center text-white">
                <span className="font-bold">{getSellerName(previewMedia.sellerId)}</span>
                <span className="text-[#FF6321] font-black">{formatFCFA(previewMedia.price)}</span>
              </div>
              <p className="text-[11px] text-white/50">{previewMedia.description || 'Présentation vidéo des articles disponibles à Adjamé.'}</p>
              
              <div className="flex items-center gap-4 text-[10px] text-white/60 pt-1">
                <span>Vues: <strong className="text-white">{previewMedia.viewsCount}</strong></span>
                <span>Likes: <strong className="text-rose-400">{previewMedia.likesCount}</strong></span>
                <span>Catégorie: <strong className="text-purple-400">{previewMedia.category}</strong></span>
              </div>

              {previewMedia.reportReason && (
                <div className="p-2 rounded bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[11px]">
                  ⚠️ <strong>Motif de signalement :</strong> {previewMedia.reportReason}
                </div>
              )}
            </div>

            {/* ACTIONS */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleToggleFeature(previewMedia)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  previewMedia.featured ? 'bg-amber-500 text-black' : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {previewMedia.featured ? 'Retirer des vedettes' : 'Mettre en Vedette'}
              </button>

              {previewMedia.reported && (
                <button
                  type="button"
                  onClick={() => handleApproveMedia(previewMedia)}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition"
                >
                  Approuver le média
                </button>
              )}

              <button
                type="button"
                onClick={() => handleDeleteMedia(previewMedia)}
                className="py-2 px-3 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
