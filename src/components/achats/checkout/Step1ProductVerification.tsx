import React, { useMemo, useState } from 'react';
import {
  Box,
  Check,
  Store,
  Star,
  Maximize2,
  Package,
  Minus,
  Plus,
  Info,
  ShieldCheck,
  Headphones,
  Zap,
  ArrowRight,
  ChevronDown,
  ShoppingBag,
  Ruler,
  AlertTriangle
} from 'lucide-react';
import { Seller } from '../../../types';
import { formatFCFA, formatMetricCount } from '../../../services/marketServices';
import { SizeGuideModal } from '../../product/SizeGuideModal';
import {
  CheckoutLineItem,
  CheckoutTheme,
  getCheckoutPalette,
  getRealPromoPercentage,
  getVariantAvailableStock,
  resolveSellerDisplay
} from './checkoutTypes';
import {
  SummaryCalculatorIcon,
  VerificationCubeIcon,
  VerifiedBlueSeal
} from './PaymentBrandLogos';

interface Step1ProductVerificationProps {
  mode: 'direct' | 'cart';
  theme?: CheckoutTheme;
  items: CheckoutLineItem[];
  seller?: Seller;
  onUpdateVariant?: (index: number, type: string, option: string) => void;
  onUpdateQuantity: (index: number, nextQuantity: number) => void;
  onAddToCart?: () => void;
  onContinue: () => void;
}

export const Step1ProductVerification: React.FC<Step1ProductVerificationProps> = ({
  mode,
  theme = 'neon',
  items,
  seller,
  onUpdateVariant,
  onUpdateQuantity,
  onAddToCart,
  onContinue
}) => {
  const pal = getCheckoutPalette(theme);
  const [showFeeTooltip, setShowFeeTooltip] = useState(false);
  const [showStockInfo, setShowStockInfo] = useState(false);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [expandedSelector, setExpandedSelector] = useState<string | null>(null);
  const [activeImageOverride, setActiveImageOverride] = useState<string | null>(null);

  const primaryItem = items[0];
  const isSingleItem = items.length === 1 && Boolean(primaryItem);

  const sellerDisplay = useMemo(
    () => resolveSellerDisplay(seller, primaryItem?.product.name ? undefined : 'Boutique Partenaire'),
    [seller, primaryItem]
  );

  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + it.product.price * it.quantity, 0),
    [items]
  );
  const totalQuantity = useMemo(
    () => items.reduce((sum, it) => sum + it.quantity, 0),
    [items]
  );
  const estimatedTotal = subtotal;

  const itemStocks = useMemo(
    () =>
      items.map((it) => ({
        available: getVariantAvailableStock(it.product, it.variantSelected),
        requested: it.quantity
      })),
    [items]
  );

  const hasOutOfStock = itemStocks.some((st) => st.available <= 0 || st.requested > st.available);

  const primaryAvailableStock = primaryItem
    ? getVariantAvailableStock(primaryItem.product, primaryItem.variantSelected)
    : 0;
  const primaryPromoPct = primaryItem ? getRealPromoPercentage(primaryItem.product) : 0;

  const primaryHeroImage = useMemo(() => {
    if (!primaryItem) return '';
    if (activeImageOverride) return activeImageOverride;
    const p = primaryItem.product;
    if (p.variantImages) {
      for (const optVal of Object.values(primaryItem.variantSelected)) {
        if (optVal && p.variantImages[optVal]?.[0]) {
          return p.variantImages[optVal][0];
        }
      }
    }
    return p.images?.[0] || p.videoPoster || '';
  }, [primaryItem, activeImageOverride]);

  const primaryGallery = useMemo(() => {
    if (!primaryItem) return [];
    const p = primaryItem.product;
    const all = Array.from(
      new Set([...(p.images || []), ...Object.values(p.variantImages || {}).flat()])
    ).filter(Boolean);
    return all.slice(0, 6);
  }, [primaryItem]);

  if (!primaryItem) {
    return (
      <div className={`${pal.card} p-6 text-center space-y-3`}>
        <div className="w-12 h-12 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center mx-auto">
          <ShoppingBag className="w-6 h-6 text-white/45" />
        </div>
        <p className="text-sm font-bold text-white">Aucun produit sélectionné</p>
        <p className="text-xs text-white/55">
          Sélectionnez au moins un article dans votre panier pour démarrer la commande.
        </p>
      </div>
    );
  }

  const returnDays = primaryItem.product.conditions?.returnPeriodDays || 7;

  return (
    <div className="space-y-3.5 pb-6">
      {/* 1. Verification Header Card */}
      <section className={`relative overflow-hidden ${pal.card} p-3.5 flex items-center gap-3.5`}>
        <div
          className="pointer-events-none absolute -left-6 -top-6 w-28 h-28 rounded-full opacity-55"
          style={{
            background: pal.isClient
              ? 'radial-gradient(circle, rgba(255,99,33,0.22) 0%, rgba(255,99,33,0) 70%)'
              : 'radial-gradient(circle, rgba(22,229,117,0.22) 0%, rgba(22,229,117,0) 70%)'
          }}
        />
        <div className={`relative w-11 h-11 rounded-2xl ${pal.iconBox} flex items-center justify-center shrink-0`}>
          <VerificationCubeIcon accent={pal.svgAccent} className="w-7 h-7" />
        </div>
        <div className="relative min-w-0">
          <h2 className="text-[16px] font-extrabold text-white leading-tight tracking-tight">
            Vérification du produit
          </h2>
          <p className="text-xs text-white/60 mt-0.5">
            Vérifiez bien les détails de votre commande
          </p>
        </div>
      </section>

      {/* 2. Product Card(s) */}
      {isSingleItem ? (
        <section className={`${pal.card} p-3.5 space-y-3`}>
          <div className="flex gap-3.5 items-stretch">
            {/* Thumbnail inside showcase frame */}
            <div className={`relative w-[118px] h-[126px] sm:w-[130px] sm:h-[136px] rounded-2xl overflow-hidden ${pal.thumbFrame} shrink-0`}>
              {primaryHeroImage ? (
                <img
                  src={primaryHeroImage}
                  alt={primaryItem.product.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/30">
                  <Package className="w-8 h-8" />
                </div>
              )}

              {/* Subtle bottom gradient for badge legibility */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />

              {/* Promo badge top-right ONLY if genuinely discounted */}
              {primaryPromoPct > 0 && (
                <span className={`absolute top-1.5 right-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-black tabular-nums ${pal.promoBadge}`}>
                  -{primaryPromoPct}%
                </span>
              )}

              {/* Stock badge bottom-left */}
              <span
                className={`absolute bottom-1.5 left-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 backdrop-blur-md shadow-md ${
                  primaryAvailableStock > 0
                    ? 'bg-emerald-950/90 text-emerald-400 border border-emerald-500/45'
                    : 'bg-rose-950/95 text-rose-300 border border-rose-500/45'
                }`}
              >
                {primaryAvailableStock > 0 ? (
                  <>
                    <Check className="w-2.5 h-2.5 stroke-[3.2]" />
                    <span>En stock</span>
                  </>
                ) : (
                  <span>Rupture</span>
                )}
              </span>
            </div>

            {/* Product Details Right */}
            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
              <div className="space-y-1.5">
                <h3 className="text-[16px] font-extrabold text-white leading-snug line-clamp-2 tracking-tight">
                  {primaryItem.product.name}
                </h3>

                {/* Real Rating + Real Reviews/Sales count */}
                <div className="flex items-center gap-1.5 text-xs text-white/70">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]" />
                  <span className="font-extrabold text-amber-300 tabular-nums">
                    {primaryItem.product.rating > 0
                      ? primaryItem.product.rating.toFixed(1)
                      : 'Nouveau'}
                  </span>
                  {primaryItem.product.reviewsCount && primaryItem.product.reviewsCount > 0 ? (
                    <span className="text-white/55 tabular-nums">
                      ({formatMetricCount(primaryItem.product.reviewsCount)} avis)
                    </span>
                  ) : primaryItem.product.salesCount > 0 ? (
                    <span className="text-white/55 tabular-nums">
                      ({formatMetricCount(primaryItem.product.salesCount)} ventes)
                    </span>
                  ) : null}
                </div>

                {/* Seller micro line */}
                <div className="flex items-center gap-1.5 text-xs text-white/75">
                  <span className="w-5 h-5 rounded-md bg-white/[0.07] border border-white/10 flex items-center justify-center shrink-0">
                    <Store className="w-3 h-3 text-white/70" />
                  </span>
                  <span className="truncate font-semibold">{sellerDisplay.name}</span>
                  {sellerDisplay.verified && <VerifiedBlueSeal className="w-4 h-4 shrink-0" />}
                </div>
              </div>

              {/* Price block */}
              <div className="pt-2">
                <div className="text-[22px] font-black text-white tabular-nums leading-none tracking-tight">
                  {formatFCFA(primaryItem.product.price)}
                </div>
                {primaryItem.product.originalPrice &&
                  primaryItem.product.originalPrice > primaryItem.product.price && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-white/40 line-through tabular-nums">
                        {formatFCFA(primaryItem.product.originalPrice)}
                      </span>
                      {primaryPromoPct > 0 && (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tabular-nums ${pal.promoBadge}`}>
                          -{primaryPromoPct}%
                        </span>
                      )}
                    </div>
                  )}
              </div>
            </div>
          </div>

          {/* Optional thumbnail strip when product has multiple photos */}
          {primaryGallery.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
              {primaryGallery.map((imgUrl, idx) => {
                const isActive = primaryHeroImage === imgUrl;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageOverride(imgUrl)}
                    className={`w-12 h-12 rounded-xl overflow-hidden shrink-0 border transition ${
                      isActive ? pal.thumbRingActive : 'border-white/10 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={imgUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        /* Multi-item cart summary list */
        <section className={`${pal.card} p-3.5 space-y-2.5`}>
          <div className="flex items-center justify-between text-xs pb-2 border-b border-white/[0.08]">
            <span className="font-bold text-white">Articles sélectionnés ({items.length})</span>
            <span className="text-white/55 tabular-nums">{totalQuantity} unité(s)</span>
          </div>
          {items.map((item, idx) => {
            const avail = itemStocks[idx]?.available ?? 0;
            const variantText = Object.entries(item.variantSelected)
              .filter(([, v]) => Boolean(v))
              .map(([k, v]) => `${k}: ${v}`)
              .join(' • ');
            return (
              <div
                key={item.cartItemId || `${item.product.id}-${idx}`}
                className={`p-2.5 rounded-2xl ${pal.innerWell} shadow-inner flex items-center gap-3`}
              >
                <img
                  src={item.product.images?.[0] || item.product.videoPoster}
                  alt={item.product.name}
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-xl object-cover border border-white/12 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-white truncate">{item.product.name}</h4>
                  {variantText && (
                    <p className={`text-[11px] ${pal.accentText} font-medium truncate mt-0.5`}>
                      {variantText}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2 mt-1.5">
                    <span className="text-xs font-extrabold text-white tabular-nums">
                      {formatFCFA(item.product.price * item.quantity)}
                    </span>
                    <div className={`flex items-center gap-1.5 ${pal.qtyWell} rounded-xl px-1 py-0.5`}>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(idx, Math.max(1, item.quantity - 1))}
                        disabled={item.quantity <= 1}
                        className="w-7 h-7 flex items-center justify-center text-white/80 disabled:opacity-30"
                        aria-label="Diminuer la quantité"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-extrabold text-white w-5 text-center tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateQuantity(idx, Math.min(avail, item.quantity + 1))}
                        disabled={item.quantity >= avail}
                        className="w-7 h-7 flex items-center justify-center text-white/80 disabled:opacity-30"
                        aria-label="Augmenter la quantité"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {avail <= 0 && (
                    <p className="text-[10px] text-rose-400 font-semibold mt-1">
                      Rupture de stock sur cette variante
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* 3. Variants & Quantity Card (for Single Product view) */}
      {isSingleItem && (
        <section className={`${pal.card} p-3.5 space-y-3`}>
          {primaryItem.product.variants &&
            primaryItem.product.variants.map((group) => {
              const groupTypeLower = group.type.toLowerCase();
              const isColor = groupTypeLower.includes('couleur') || groupTypeLower.includes('color');
              if (isColor) return null;
              const isSize =
                groupTypeLower.includes('taille') ||
                groupTypeLower.includes('pointure') ||
                groupTypeLower.includes('size');
              const selectedVal = primaryItem.variantSelected[group.type] || group.options[0] || '';
              const isOpen = expandedSelector === group.type || group.options.length > 1;

              return (
                <div
                  key={group.type}
                  className="pb-3 border-b border-white/[0.07] last:border-b-0 last:pb-0 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2 min-h-[34px]">
                    <div className="flex items-center gap-2.5 text-sm font-semibold text-white/80">
                      <span className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/55 shrink-0">
                        {isSize ? (
                          <Maximize2 className="w-3.5 h-3.5" />
                        ) : (
                          <Box className="w-3.5 h-3.5" />
                        )}
                      </span>
                      <span>{group.type}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isSize && (
                        <button
                          type="button"
                          onClick={() => setShowSizeGuide(true)}
                          className={`text-[11px] font-bold ${pal.accentText} hover:underline flex items-center gap-1 mr-1`}
                        >
                          <Ruler className="w-3 h-3" />
                          <span>Guide</span>
                        </button>
                      )}

                      {onUpdateVariant ? (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSelector((prev) => (prev === group.type ? null : group.type))
                          }
                          className="flex items-center gap-1 text-sm font-extrabold text-white"
                        >
                          <span>{selectedVal}</span>
                          <ChevronDown
                            className={`w-4 h-4 text-white/55 transition-transform ${
                              expandedSelector === group.type ? 'rotate-180' : ''
                            }`}
                          />
                        </button>
                      ) : (
                        <span className="flex items-center gap-1.5 text-sm font-extrabold text-white">
                          <span>{selectedVal}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {onUpdateVariant && isOpen && group.options.length > 1 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {group.options.map((opt) => {
                        const active = selectedVal === opt;
                        const testVariant = { ...primaryItem.variantSelected, [group.type]: opt };
                        const optStock = getVariantAvailableStock(primaryItem.product, testVariant);
                        const soldOut = optStock <= 0;

                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              setActiveImageOverride(null);
                              onUpdateVariant(0, group.type, opt);
                            }}
                            className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                              active
                                ? pal.variantActive
                                : soldOut
                                ? 'bg-white/[0.02] border-white/[0.06] text-white/35 line-through'
                                : pal.variantIdle
                            }`}
                          >
                            <span>{opt}</span>
                            {soldOut && <span className="text-[9px] text-rose-400 no-underline">Épuisé</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

          {/* Quantity Row */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className={`flex items-center gap-1.5 ${pal.qtyWell} rounded-2xl p-1`}>
              <button
                type="button"
                onClick={() => onUpdateQuantity(0, Math.max(1, primaryItem.quantity - 1))}
                disabled={primaryItem.quantity <= 1}
                aria-label="Diminuer la quantité"
                className={`w-10 h-10 rounded-xl ${pal.qtyBtn} disabled:opacity-35 flex items-center justify-center text-white transition active:scale-95`}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-14 text-center text-base font-black text-white tabular-nums">
                {primaryItem.quantity}
              </span>
              <button
                type="button"
                onClick={() =>
                  onUpdateQuantity(0, Math.min(Math.max(1, primaryAvailableStock), primaryItem.quantity + 1))
                }
                disabled={primaryItem.quantity >= primaryAvailableStock}
                aria-label="Augmenter la quantité"
                className={`w-10 h-10 rounded-xl ${pal.qtyBtn} disabled:opacity-35 flex items-center justify-center text-white transition active:scale-95`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className={`px-5 py-2.5 rounded-2xl ${pal.unitPill} text-xs font-extrabold`}>
              {primaryItem.product.specs?.['Unité'] || 'Pièce'}
            </div>
          </div>

          {/* Authentic Stock Status Line */}
          <div className="flex items-center justify-between gap-2 pt-1">
            {primaryAvailableStock > 0 ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.35)]">
                  <Check className="w-3 h-3 stroke-[3.2]" />
                </span>
                <span className="font-extrabold text-emerald-400">Stock disponible :</span>
                <span className="text-white/95 font-bold tabular-nums">
                  {primaryAvailableStock} pièce{primaryAvailableStock > 1 ? 's' : ''} restante
                  {primaryAvailableStock > 1 ? 's' : ''}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-rose-400 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Variante épuisée — sélectionnez une autre option.</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowStockInfo((v) => !v)}
              aria-label="Information stock"
              className="w-7 h-7 rounded-full text-white/45 hover:text-white hover:bg-white/[0.06] flex items-center justify-center shrink-0 transition"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
          {showStockInfo && (
            <p className="text-[11px] text-white/65 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
              Le stock affiché correspond exactement à la variante sélectionnée côté serveur et est
              réservé lors de la confirmation de commande.
            </p>
          )}
        </section>
      )}

      {/* 4. Seller Verification Card */}
      <section className={`${pal.card} p-3.5 flex items-center justify-between gap-3`}>
        <div className="flex items-center gap-3 min-w-0">
          {sellerDisplay.avatar ? (
            <img
              src={sellerDisplay.avatar}
              alt={sellerDisplay.name}
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-full object-cover border-2 border-white/15 bg-[#1B1F1D] shadow-md shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#2B66FF] to-[#133EC9] border border-white/20 text-white font-black text-sm flex items-center justify-center shadow-[0_4px_14px_rgba(37,99,235,0.35)] shrink-0">
              {sellerDisplay.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-extrabold text-white truncate">
                {sellerDisplay.name}
              </span>
              {sellerDisplay.verified && <VerifiedBlueSeal className="w-4 h-4 shrink-0" />}
            </div>
            <p className="text-xs text-white/60 truncate mt-0.5">
              Vendeur vérifié • {sellerDisplay.location}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          {sellerDisplay.rating > 0 && (
            <div className="flex items-center justify-end gap-1 text-sm font-black text-white tabular-nums">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]" />
              <span>{sellerDisplay.rating.toFixed(1)}</span>
            </div>
          )}
          {sellerDisplay.salesCount > 0 && (
            <p className="text-[11px] text-white/55 tabular-nums mt-0.5">
              ({formatMetricCount(sellerDisplay.salesCount)} ventes)
            </p>
          )}
        </div>
      </section>

      {/* 5. Order Summary Card */}
      <section className={`${pal.card} p-4 space-y-3`}>
        <div className="flex items-center gap-2.5 pb-1">
          <SummaryCalculatorIcon accent={pal.svgAccent} className="w-6 h-6 shrink-0" />
          <h3 className="text-[15.5px] font-extrabold text-white tracking-tight">Récapitulatif</h3>
        </div>

        <div className="space-y-2 text-[13px]">
          <div className="flex items-center justify-between text-white/70">
            <span>
              Sous-total ({totalQuantity} article{totalQuantity > 1 ? 's' : ''})
            </span>
            <span className="font-extrabold text-white tabular-nums">{formatFCFA(subtotal)}</span>
          </div>

          <div className="flex items-center justify-between text-white/70">
            <span>Livraison (gérée par la boutique)</span>
            <span className="font-extrabold text-emerald-400 tabular-nums">0 FCFA</span>
          </div>

          <div className="flex items-center justify-between text-white/70">
            <button
              type="button"
              onClick={() => setShowFeeTooltip((v) => !v)}
              className="flex items-center gap-1.5 hover:text-white transition"
            >
              <span>Frais de paiement client</span>
              <Info className="w-3.5 h-3.5 text-white/45" />
            </button>
            <span className={`font-extrabold ${pal.accentText}`}>Selon mode choisi</span>
          </div>

          {showFeeTooltip && (
            <p className="text-[11px] text-white/65 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
              <strong>Paiement en ligne</strong> (Wave / Orange Money) : frais client de{' '}
              <strong>6,5%</strong>. <strong>Paiement à la livraison</strong> :{' '}
              <strong>0 FCFA (0%)</strong>. Livraison organisée directement par le vendeur.
            </p>
          )}
        </div>

        <div className="pt-3 border-t border-white/[0.09] flex items-center justify-between">
          <span className="text-[15px] font-extrabold text-white">Sous-total articles</span>
          <span className={`text-xl font-black ${pal.accentText} tabular-nums`}>
            {formatFCFA(estimatedTotal)}
          </span>
        </div>
      </section>

      {/* 6. Reassurance Strip */}
      <div className="grid grid-cols-3 gap-2 pt-1 px-0.5">
        <div className="flex items-center gap-2">
          <span className={`w-7 h-7 rounded-full ${pal.iconBox} flex items-center justify-center shrink-0`}>
            <ShieldCheck className={`w-4 h-4 ${pal.accentText}`} />
          </span>
          <span className="text-[10.5px] text-white/80 leading-tight font-semibold">
            Paiement sécurisé et fiable
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-7 h-7 rounded-full ${pal.iconBox} flex items-center justify-center shrink-0`}>
            <Headphones className={`w-4 h-4 ${pal.accentText}`} />
          </span>
          <span className="text-[10.5px] text-white/80 leading-tight font-semibold">
            Assistance 24h/7j
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-amber-500/12 border border-amber-400/35 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-amber-400 fill-amber-400/30" />
          </span>
          <span className="text-[10.5px] text-white/80 leading-tight font-semibold">
            Retour facile sous {returnDays} jours
          </span>
        </div>
      </div>

      {/* 7. Bottom Primary CTA */}
      <div className="pt-1 flex items-center gap-2.5">
        {mode === 'direct' && onAddToCart && (
          <button
            type="button"
            disabled={hasOutOfStock}
            onClick={onAddToCart}
            aria-label="Ajouter au panier"
            title="Ajouter au panier"
            className={`min-h-[54px] px-4 rounded-full ${pal.secondaryBtn} font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40 shrink-0`}
          >
            <ShoppingBag className={`w-4 h-4 ${pal.accentText}`} />
            <span className="hidden sm:inline">Panier</span>
          </button>
        )}

        <button
          id="btn-checkout-step1-continue"
          type="button"
          disabled={hasOutOfStock}
          onClick={onContinue}
          className={`flex-1 min-h-[54px] py-3.5 px-6 rounded-full ${pal.primaryBtn} disabled:from-white/10 disabled:via-white/10 disabled:to-white/10 disabled:bg-white/10 disabled:text-white/35 font-black text-[16px] flex items-center justify-center gap-2 disabled:shadow-none transition active:scale-[0.98]`}
        >
          <span>{hasOutOfStock ? 'Stock insuffisant pour continuer' : 'Continuer'}</span>
          {!hasOutOfStock && <ArrowRight className="w-5 h-5 stroke-[2.6]" />}
        </button>
      </div>

      {showSizeGuide && (
        <SizeGuideModal
          isOpen={showSizeGuide}
          category={primaryItem.product.category}
          productName={primaryItem.product.name}
          onClose={() => setShowSizeGuide(false)}
        />
      )}
    </div>
  );
};
