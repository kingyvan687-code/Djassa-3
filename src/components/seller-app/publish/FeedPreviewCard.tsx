import React from 'react';
import { Seller, Product, VariantItem } from '../../../types';
import { 
  ShoppingBag, 
  Heart, 
  MessageCircle, 
  Share2, 
  Bookmark, 
  Music, 
  CheckCircle2, 
  Eye,
  MapPin
} from 'lucide-react';
import { formatFCFA } from '../../../services/marketServices';

interface Props {
  mode: 'product' | 'video';
  seller?: Seller;
  name: string;
  price: string;
  originalPrice?: string;
  category: string;
  images: string[];
  coverIndex: number;
  videoUrl?: string;
  caption: string;
  soundTitle?: string;
  tags: string[];
  variants?: VariantItem[];
  variantStock?: Record<string, number>;
}

export const FeedPreviewCard: React.FC<Props> = ({
  mode,
  seller,
  name,
  price,
  originalPrice,
  category,
  images,
  coverIndex,
  videoUrl,
  caption,
  soundTitle,
  tags,
  variants,
  variantStock,
}) => {
  const displayPrice = Number(price) || 15000;
  const numOriginal = Number(originalPrice) || 0;
  const discountPercent =
    numOriginal > displayPrice && displayPrice > 0
      ? Math.round(((numOriginal - displayPrice) / numOriginal) * 100)
      : 0;
  const displayImage = images[coverIndex] || images[0] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80';
  const displayName = name.trim() || 'Titre de votre produit';

  return (
    <div className="p-4 rounded-3xl bg-black/60 border border-white/10 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Eye className="w-4 h-4 text-[#FF6321]" />
          <span className="text-xs font-black text-white uppercase tracking-wider">
            Aperçu en Direct (Vue Client)
          </span>
        </div>
        <span className="text-[10px] text-white/50 bg-white/5 px-2 py-0.5 rounded-full">
          {mode === 'video' ? 'Fil Vidéo TikTok' : 'Fil Marché Adjamé'}
        </span>
      </div>

      {mode === 'video' ? (
        /* VIDEO FEED PREVIEW */
        <div className="relative aspect-[9/14] max-h-[380px] w-full rounded-2xl overflow-hidden bg-black mx-auto border border-white/15 shadow-2xl">
          {videoUrl ? (
            <video
              src={videoUrl}
              className="w-full h-full object-cover"
              muted
              playsInline
              loop
              autoPlay
            />
          ) : (
            <img
              src={displayImage}
              alt=""
              className="w-full h-full object-cover opacity-80"
            />
          )}

          {/* Right vertical action bar */}
          <div className="absolute right-2 bottom-16 flex flex-col items-center gap-3 z-20">
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white">
                <Heart className="w-4 h-4" />
              </div>
              <span className="text-[8px] text-white font-bold">1.2k</span>
            </div>

            <div className="flex flex-col items-center gap-0.5">
              <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white">
                <MessageCircle className="w-4 h-4" />
              </div>
              <span className="text-[8px] text-white font-bold">48</span>
            </div>

            <div className="flex flex-col items-center gap-0.5">
              <div className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center text-white">
                <Share2 className="w-4 h-4" />
              </div>
              <span className="text-[8px] text-white font-bold">Partager</span>
            </div>
          </div>

          {/* Bottom Overlay Info */}
          <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/60 to-transparent space-y-2 z-10">
            {/* Seller profile tag */}
            <div className="flex items-center gap-2">
              <img
                src={seller?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                alt=""
                className="w-6 h-6 rounded-full border border-[#FF6321]"
              />
              <span className="text-xs font-black text-white truncate">
                @{seller?.name || 'MaBoutique'}
              </span>
              <span className="text-[9px] text-[#FF6321] font-bold">Abonné</span>
            </div>

            {/* Caption & tags */}
            <p className="text-[11px] text-white line-clamp-2">
              {caption || 'Découvrez ce nouveau produit directement disponible dans notre boutique !'}
            </p>

            {/* Sound bar */}
            <div className="flex items-center gap-1.5 text-[9px] text-white/70">
              <Music className="w-3 h-3 text-[#FF6321]" />
              <span className="truncate">{soundTitle || 'Son original - Boutique Djassa'}</span>
            </div>

            {/* Floating Product Sticker */}
            <div className="p-2 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#FF6321]/20 text-[#FF6321] flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <p className="text-[10px] font-bold text-white truncate">{displayName}</p>
                  <p className="text-[10px] text-[#FF6321] font-black">{formatFCFA(displayPrice)}</p>
                </div>
              </div>
              <button
                type="button"
                className="px-2.5 py-1 rounded-lg bg-[#FF6321] text-white text-[10px] font-black shrink-0"
              >
                Acheter
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* PRODUCT CARD PREVIEW (MARKET FEED) */
        <div className="rounded-2xl overflow-hidden bg-neutral-900 border border-white/10 shadow-xl max-w-sm mx-auto">
          <div className="relative aspect-square bg-neutral-800">
            <img
              src={displayImage}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 left-2 flex items-center gap-1.5">
              <span className="bg-[#FF6321] text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-md">
                {formatFCFA(displayPrice)}
              </span>
              {discountPercent > 0 && (
                <span className="bg-black/70 backdrop-blur-md text-emerald-400 text-[9px] font-black px-1.5 py-0.5 rounded-md">
                  -{discountPercent}%
                </span>
              )}
            </div>
            {category && (
              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white/90 text-[9px] font-medium px-2 py-0.5 rounded-md">
                {category}
              </div>
            )}
          </div>

          <div className="p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <img
                  src={seller?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                  alt=""
                  className="w-4 h-4 rounded-full"
                />
                <span className="text-[10px] text-white/60 truncate font-medium">
                  {seller?.name || 'Ma Boutique'}
                </span>
                <span className="text-[9px] text-amber-400 font-bold">★ 4.9</span>
              </div>
              {numOriginal > displayPrice && (
                <span className="text-[10px] text-white/40 line-through">
                  {formatFCFA(numOriginal)}
                </span>
              )}
            </div>

            <h4 className="text-xs font-bold text-white truncate">{displayName}</h4>

            {variants && variants.length > 0 && variants[0].options.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {variants[0].options.slice(0, 5).map((opt) => {
                  const remaining = variantStock?.[opt];
                  return (
                    <span
                      key={opt}
                      className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] text-white/80 font-medium flex items-center gap-1"
                    >
                      <span>{opt}</span>
                      {remaining !== undefined && (
                        <span
                          className={`text-[8px] font-bold ${
                            remaining <= 0
                              ? 'text-rose-400'
                              : remaining <= 2
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          ({remaining})
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            )}

            <p className="text-[10px] text-white/50 line-clamp-1">
              {caption || 'Qualité supérieure certifiée, stock disponible en boutique.'}
            </p>

            <div className="flex items-center justify-between pt-1 border-t border-white/5">
              <span className="text-[9px] text-emerald-400 font-bold">
                ✓ Livraison 24h à Abidjan
              </span>
              <button
                type="button"
                className="px-2.5 py-1 rounded-lg bg-[#FF6321] text-white text-[10px] font-bold"
              >
                Commander
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
