import React, { useState } from 'react';
import { 
  X, 
  Play, 
  Pause, 
  Eye, 
  Heart, 
  MessageCircle, 
  Share2, 
  ShoppingBag, 
  Store, 
  Flame, 
  TrendingUp, 
  Clock, 
  Calendar, 
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Volume2,
  VolumeX,
  ArrowUpRight
} from 'lucide-react';
import { Product, Seller } from '../../../types';
import { formatFCFA } from '../../../services/marketServices';

export interface TrendMediaData {
  id: string;
  title: string;
  type: 'video' | 'image';
  mediaUrl: string;
  posterUrl: string;
  product: Product;
  seller?: Seller;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  completionRate: number; // e.g. 74%
  averageWatchDurationSec: number; // e.g. 26s
  directOrdersCount: number;
  revenueGenerated: number;
  publishDate: string;
  recentComments: {
    userName: string;
    avatar: string;
    text: string;
    timeAgo: string;
    likes: number;
  }[];
}

interface TrendMediaModalProps {
  data: TrendMediaData;
  onClose: () => void;
  onOpenProductDetail?: (product: Product) => void;
  onOpenSellerDetail?: (sellerId: string) => void;
}

export const TrendMediaModal: React.FC<TrendMediaModalProps> = ({
  data,
  onClose,
  onOpenProductDetail,
  onOpenSellerDetail
}) => {
  const {
    title,
    type,
    mediaUrl,
    posterUrl,
    product,
    seller,
    viewsCount,
    likesCount,
    commentsCount,
    sharesCount,
    completionRate,
    averageWatchDurationSec,
    directOrdersCount,
    revenueGenerated,
    publishDate,
    recentComments
  } = data;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  return (
    <div
      id="trend-media-detail-overlay"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="trend-media-detail-modal"
        className="w-full max-w-3xl max-h-[92vh] bg-[#0E0E0E] rounded-3xl border border-white/15 flex flex-col shadow-2xl overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="shrink-0 px-4 py-3.5 border-b border-white/10 bg-[#141414] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400">
              {type === 'video' ? <Play className="w-4 h-4 text-[#FF6321]" /> : <Flame className="w-4 h-4 text-orange-400" />}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white">
                  {type === 'video' ? 'Vidéo Vitrine Virale' : 'Photo Post Tendance'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-rose-400" />
                  Ultra Tendance
                </span>
              </div>
              <p className="text-[10px] text-white/50">Publié le {publishDate}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 no-scrollbar">
          {/* MEDIA PLAYER & PRODUCT ATTACHMENT */}
          <div className="flex flex-col md:flex-row gap-4 items-start">
            {/* Player Container */}
            <div className="w-full md:w-64 shrink-0 rounded-2xl overflow-hidden border border-white/15 bg-black relative group aspect-[9/14]">
              {type === 'video' && mediaUrl ? (
                <video
                  src={mediaUrl}
                  poster={posterUrl}
                  playsInline
                  loop
                  muted={isMuted}
                  autoPlay={isPlaying}
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={posterUrl || mediaUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              )}

              {/* OVERLAY CONTROLS FOR VIDEO */}
              {type === 'video' && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 p-3 flex flex-col justify-between">
                  <div className="flex justify-between items-center">
                    <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[9px] font-bold text-white border border-white/20 flex items-center gap-1">
                      <Play className="w-2.5 h-2.5 text-[#FF6321] fill-[#FF6321]" />
                      Vidéo Djassa
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsMuted(!isMuted)}
                      className="p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 border border-white/20"
                    >
                      {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="p-3.5 rounded-full bg-[#FF6321]/90 hover:bg-[#FF6321] text-white shadow-xl transition transform group-hover:scale-110 active:scale-95"
                    >
                      {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white ml-0.5" />}
                    </button>
                  </div>

                  <div className="text-[10px] text-white/80 flex items-center justify-between">
                    <span>Durée moyenne : {averageWatchDurationSec}s</span>
                    <span className="text-emerald-400 font-bold">{completionRate}% complétion</span>
                  </div>
                </div>
              )}
            </div>

            {/* DETAILS & METRICS */}
            <div className="flex-1 space-y-3 min-w-0">
              <div>
                <h3 className="text-base font-black text-white leading-snug">{title}</h3>
                {seller && (
                  <div 
                    onClick={() => onOpenSellerDetail && onOpenSellerDetail(seller.id)}
                    className="flex items-center gap-2 mt-2 cursor-pointer group"
                  >
                    <img
                      src={seller.avatar}
                      alt={seller.name}
                      className="w-6 h-6 rounded-full object-cover border border-white/20"
                    />
                    <span className="text-xs font-bold text-white/80 group-hover:text-[#FF6321] transition">
                      {seller.storeName || seller.name}
                    </span>
                    <span className="text-[10px] text-[#FF6321] font-bold">(Vendeur)</span>
                  </div>
                )}
              </div>

              {/* 3 STATS CLÉS (Vues / Likes / Commentaires) */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-center">
                  <div className="flex items-center justify-center gap-1 text-cyan-400 text-xs font-bold">
                    <Eye className="w-3.5 h-3.5" />
                    <span>Regardé</span>
                  </div>
                  <p className="text-base font-black text-cyan-300 mt-1">{viewsCount.toLocaleString()}</p>
                  <span className="text-[9px] text-white/40">Vues vérifiées</span>
                </div>

                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
                  <div className="flex items-center justify-center gap-1 text-rose-400 text-xs font-bold">
                    <Heart className="w-3.5 h-3.5 fill-rose-500/50" />
                    <span>Liké</span>
                  </div>
                  <p className="text-base font-black text-rose-300 mt-1">{likesCount.toLocaleString()}</p>
                  <span className="text-[9px] text-white/40">Coups de cœur</span>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <div className="flex items-center justify-center gap-1 text-amber-400 text-xs font-bold">
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Commenté</span>
                  </div>
                  <p className="text-base font-black text-amber-300 mt-1">{commentsCount.toLocaleString()}</p>
                  <span className="text-[9px] text-white/40">Interactions</span>
                </div>
              </div>

              {/* COMMERCE CONVERSION BOX */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
                <span className="text-[10px] text-white/50 uppercase font-black tracking-wider flex items-center justify-between">
                  <span>Impact Commercial Direct</span>
                  <span className="text-emerald-400 font-bold">{directOrdersCount} Commandes générées</span>
                </span>

                <div
                  onClick={() => onOpenProductDetail && onOpenProductDetail(product)}
                  className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between cursor-pointer hover:border-[#FF6321]/40 transition group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate group-hover:text-[#FF6321] transition">
                        {product.name}
                      </p>
                      <p className="text-[10px] text-[#FF6321] font-bold">
                        {formatFCFA(product.price)} • En stock ({product.stock})
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-white/60 group-hover:text-white font-bold flex items-center gap-1 shrink-0">
                    <span>Fiche Produit</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs pt-1">
                  <span className="text-white/60">Chiffre d'affaires généré par ce média :</span>
                  <span className="font-black text-emerald-400 text-sm">{formatFCFA(revenueGenerated)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* RECENT COMMENTS SECTION */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Commentaires des Clients sur cette Publication</span>
              </h4>
              <span className="text-[11px] text-white/40">{recentComments.length} récents</span>
            </div>

            <div className="space-y-2">
              {recentComments.map((comment, i) => (
                <div key={i} className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-start gap-2.5">
                  <img
                    src={comment.avatar}
                    alt={comment.userName}
                    className="w-7 h-7 rounded-full object-cover border border-white/20 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{comment.userName}</span>
                      <span className="text-[10px] text-white/40">{comment.timeAgo}</span>
                    </div>
                    <p className="text-xs text-white/80 mt-0.5">{comment.text}</p>
                    <div className="flex items-center gap-1 text-[10px] text-rose-400/80 mt-1">
                      <Heart className="w-2.5 h-2.5 fill-rose-500/40" />
                      <span>{comment.likes} personnes aiment ce commentaire</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="shrink-0 p-4 border-t border-white/10 bg-[#141414] flex items-center justify-between">
          <span className="text-xs text-white/50">Média vérifié et conforme aux règles de la communauté.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
