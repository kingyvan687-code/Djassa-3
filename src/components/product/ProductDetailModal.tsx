import React, { useMemo, useState, useEffect } from 'react';
import {
  ChevronLeft,
  Store,
  MapPin,
  Star,
  ShieldCheck,
  MessageCircle,
  ChevronRight,
  Pencil,
  Megaphone,
  Trash2,
  Check,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus,
  Tag,
  Play,
  ShoppingCart,
  RotateCcw,
  FileText,
  Ruler,
  Heart,
  ShoppingBag,
  Box,
  Maximize2,
  Info,
  Headphones,
  Zap,
  ArrowRight
} from 'lucide-react';
import { SizeGuideModal } from './SizeGuideModal';
import { Product } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatFCFA, formatMetricCount } from '../../services/marketServices';
import { EditMerchandiseModal } from '../seller-app/boutique/EditMerchandiseModal';
import {
  calculateServiceFee,
  getCheckoutPalette,
  getRealPromoPercentage
} from '../achats/checkout/checkoutTypes';
import {
  CardPaymentLogo,
  DjassaBagLogo,
  MtnMomoLogo,
  OrangeMoneyLogo,
  SummaryCalculatorIcon,
  VerifiedBlueSeal,
  WaveLogo
} from '../achats/checkout/PaymentBrandLogos';

interface ProductDetailModalProps {
  product: Product;
  onClose: () => void;
}

type TabSection = 'description' | 'specs' | 'avis' | 'remboursement';

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, onClose }) => {
  const {
    sellers,
    accountRole,
    currentSellerId,
    setSelectedSeller,
    openChatWithSeller,
    updateProductSeller,
    deleteProductSeller,
    showToast,
    addToCart,
    setActiveTab,
    products: allProducts,
    setVariantModalProduct,
    setIsVariantModalDirectBuy,
    userProfile,
    toggleLikeVideo,
    navigateToFeedProduct,
    cart,
    requireAuth
  } = useApp();

  const pal = useMemo(() => getCheckoutPalette('client'), []);

  // Active image & media state
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [activeTab, setActiveTabState] = useState<TabSection>('description');
  const [showSizeGuideModal, setShowSizeGuideModal] = useState(false);
  const [showStockInfo, setShowStockInfo] = useState(false);
  const [showFeeTooltip, setShowFeeTooltip] = useState(false);

  // Variant Selection State (Taille, Modèle, etc.)
  const visibleVariants = useMemo(() => {
    const rawList = [...(product.variants || [])];
    const list = rawList
      .map((v) => ({
        ...v,
        options: Array.from(new Set(v.options))
      }))
      .filter((v) => v.options.length > 0);

    list.sort((a, b) => {
      const aIsSize =
        a.type.toLowerCase().includes('taille') ||
        a.type.toLowerCase().includes('size') ||
        a.type.toLowerCase().includes('pointure');
      const bIsSize =
        b.type.toLowerCase().includes('taille') ||
        b.type.toLowerCase().includes('size') ||
        b.type.toLowerCase().includes('pointure');
      if (aIsSize && !bIsSize) return -1;
      if (!aIsSize && bIsSize) return 1;
      return 0;
    });
    return list;
  }, [product.variants]);

  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    (product.variants || []).forEach((v) => {
      if (v.options && v.options.length > 0) {
        initial[v.type] = v.options[0];
      }
    });
    return initial;
  });

  const sizeGroup = useMemo(() => {
    return visibleVariants.find(
      (v) =>
        v.type.toLowerCase().includes('taille') ||
        v.type.toLowerCase().includes('size') ||
        v.type.toLowerCase().includes('pointure')
    );
  }, [visibleVariants]);

  const defaultColorKey = selectedVariants['Couleur'] || selectedVariants['Color'] || '';

  // Calculate available sizes from variant stock
  const availableSizes = useMemo(() => {
    if (!sizeGroup) return [];
    return sizeGroup.options.filter((size) => {
      if (defaultColorKey && product.variantStock?.[`${defaultColorKey}-${size}`] !== undefined) {
        return product.variantStock[`${defaultColorKey}-${size}`] > 0;
      }
      if (defaultColorKey && product.variantStock?.[`${defaultColorKey} - ${size}`] !== undefined) {
        return product.variantStock[`${defaultColorKey} - ${size}`] > 0;
      }
      const stock = product.variantStock?.[size];
      if (stock !== undefined) {
        return stock > 0;
      }
      return product.stock > 0;
    });
  }, [sizeGroup, defaultColorKey, product.variantStock, product.stock]);

  // Auto-switch to available size if current size is out of stock
  useEffect(() => {
    if (sizeGroup && availableSizes.length > 0) {
      const currentSize = selectedVariants[sizeGroup.type];
      if (!currentSize || !availableSizes.includes(currentSize)) {
        setSelectedVariants((prev) => ({
          ...prev,
          [sizeGroup.type]: availableSizes[0]
        }));
      }
    }
  }, [availableSizes, sizeGroup, selectedVariants]);

  const [quantity, setQuantity] = useState(() => (product.stock > 0 ? 1 : 0));
  const [videoError, setVideoError] = useState(false);

  // Seller management state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [discount, setDiscount] = useState(String(product.discountPercentage || 10));

  const seller = sellers.find((s) => s.id === product.sellerId);
  const isSellerView = accountRole === 'seller' && product.sellerId === currentSellerId;

  const cartBadgeCount = useMemo(
    () => (cart || []).reduce((sum, c) => sum + (c.quantity || 1), 0),
    [cart]
  );

  // Gather unique images
  const images = useMemo(() => {
    const list = Array.from(
      new Set([...(product.images || []), ...Object.values(product.variantImages || {}).flat()])
    );
    return list.length > 0
      ? list
      : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'];
  }, [product]);

  // Helper to map an image URL to its corresponding non-color variant option
  const getVariantForImage = (imgUrl: string) => {
    if (product.variantImages) {
      for (const [optionName, photos] of Object.entries(product.variantImages)) {
        if (photos && photos.includes(imgUrl)) {
          const group = visibleVariants.find(
            (v) =>
              v.options.includes(optionName) &&
              !v.type.toLowerCase().includes('couleur') &&
              !v.type.toLowerCase().includes('color')
          );
          if (group) {
            return {
              type: group.type,
              option: optionName
            };
          }
        }
      }
    }
    return null;
  };

  // When clicking on a thumbnail in the hero gallery
  const handleThumbnailClick = (imgUrl: string, index: number) => {
    setShowVideo(false);
    setActiveImgIndex(index);
    const matched = getVariantForImage(imgUrl);
    if (matched) {
      handleSelectOption(matched.type, matched.option);
    }
  };

  // Related products from same category or seller
  const relatedProducts = useMemo(() => {
    return allProducts
      .filter((p) => p.id !== product.id && (p.category === product.category || p.sellerId === product.sellerId))
      .slice(0, 4);
  }, [allProducts, product]);

  const promoPercentage = getRealPromoPercentage(product);
  const discountAmount =
    product.originalPrice && product.originalPrice > product.price
      ? product.originalPrice - product.price
      : 0;

  const subtotal = product.price * Math.max(0, quantity);
  const serviceFee = useMemo(() => calculateServiceFee(subtotal), [subtotal]);
  const estimatedTotal = subtotal + serviceFee;
  const returnDays = product.conditions?.returnPeriodDays ?? 7;

  const handleSelectOption = (type: string, option: string) => {
    setSelectedVariants((prev) => ({ ...prev, [type]: option }));

    const photos = product.variantImages?.[option] || [];
    const optImg = photos[0];
    if (optImg) {
      const idx = images.indexOf(optImg);
      if (idx >= 0) {
        setActiveImgIndex(idx);
        setShowVideo(false);
      }
    }

    if (type.toLowerCase().includes('taille') || type.toLowerCase().includes('size')) {
      showToast(`Taille ${option} sélectionnée ✓`);
    }
  };

  const handleAddToCart = () => {
    if (!product.inStock || product.stock <= 0 || quantity <= 0) {
      showToast('Cet article est actuellement en rupture de stock.');
      return;
    }
    const clampedQty = Math.min(quantity, product.stock);
    if (!requireAuth('cart', { type: 'add_to_cart', productId: product.id, variantSelected: selectedVariants, quantity: clampedQty })) {
      return;
    }
    addToCart(product.id, selectedVariants, clampedQty);
    showToast(`${clampedQty}x "${product.name}" ajouté au panier 🛒`);
  };

  const handleBuyNow = () => {
    if (!requireAuth('purchase', { type: 'buy_direct', product, variantSelected: selectedVariants, quantity: Math.max(1, quantity) })) {
      return;
    }
    setVariantModalProduct(product);
    setIsVariantModalDirectBuy(true);
    onClose();
  };

  const mockReviews = [
    {
      id: 'rev-1',
      author: 'Aminata Koné',
      location: 'Cocody Angré',
      rating: 5,
      date: 'Hier',
      comment:
        'Superbe qualité ! Le tissu wax est épais et très bien taillé. Livré en 2h chrono par le coursier. Je recommande les yeux fermés ! ✨',
      verified: true
    },
    {
      id: 'rev-2',
      author: 'Yasmine Traoré',
      location: 'Marcory Zone 4',
      rating: 5,
      date: 'Il y a 3 jours',
      comment:
        'Exactement conforme à la vidéo ! La coupe tombe parfaitement bien et les coutures sont impeccables. Paiement Wave à la livraison très pratique.',
      verified: true
    },
    {
      id: 'rev-3',
      author: 'Christelle B.',
      location: 'Yopougon Maroc',
      rating: 4,
      date: 'Il y a 1 semaine',
      comment:
        'Très jolie robe, couleur éclatante. Le vendeur est très réactif sur le chat pour conseiller sur la taille.',
      verified: true
    }
  ];

  const nonColorVariants = visibleVariants.filter(
    (v) => !v.type.toLowerCase().includes('couleur') && !v.type.toLowerCase().includes('color')
  );

  return (
    <div
      id="product-detail-modal"
      className={`fixed inset-0 z-[70] ${pal.pageBg} text-white flex flex-col overflow-hidden animate-fadeIn`}
    >
      {/* Subtle atmospheric lighting behind the dark canvas (identical to Home "Acheter" page) */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: pal.pageGlow }}
      />

      <div className="relative z-10 flex flex-col flex-1 min-h-0">
        {/* 1. TOP HEADER BAR (Matching CheckoutHeaderStepper client theme) */}
        <header className={`sticky top-0 z-30 ${pal.headerBg} shrink-0`}>
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-80"
            style={{ background: pal.headerGlow }}
          />
          <div className="relative w-full px-4 pt-3 pb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Retour"
              className={`w-11 h-11 rounded-full ${pal.headerIconBtn} flex items-center justify-center text-white transition active:scale-95 shrink-0`}
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.4]" />
            </button>

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-full bg-[#FF6321]/30 blur-md" />
                <DjassaBagLogo className="relative w-10 h-10 drop-shadow-[0_4px_12px_rgba(255,99,33,0.45)]" />
              </div>
              <div className="min-w-0">
                <div className="text-[20px] font-black tracking-wide text-white leading-none">
                  DJASSA
                </div>
                <div className="text-[10.5px] font-medium text-white/65 leading-tight mt-0.5 truncate">
                  {product.category || 'Fiche produit'} • Marché d’Abidjan
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!requireAuth('orders', { type: 'open_orders' })) return;
                onClose();
                setActiveTab('achats');
              }}
              aria-label={`Panier (${cartBadgeCount})`}
              className={`relative w-11 h-11 rounded-full ${pal.headerIconBtn} flex items-center justify-center text-white/95 transition active:scale-95 shrink-0`}
            >
              <ShoppingCart className="w-5 h-5" />
              {cartBadgeCount > 0 && (
                <span
                  className={`absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full ${pal.cartBadge} text-white text-[10px] font-black flex items-center justify-center tabular-nums`}
                >
                  {cartBadgeCount > 99 ? '99+' : cartBadgeCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* 2. SCROLLABLE CONTENT BODY */}
        <main className="flex-1 overflow-y-auto no-scrollbar">
          <div className="w-full max-w-2xl mx-auto px-4 pt-4 pb-32 space-y-3.5">
            {/* MEDIA & MAIN PRODUCT CARD */}
            <section className={`${pal.card} overflow-hidden`}>
              {/* Media Showcase */}
              <div className="relative aspect-[4/3] w-full bg-[#121212] border-b border-white/10 overflow-hidden">
                {showVideo && product.videoUrl ? (
                  videoError ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0A0A0A] gap-2 p-4 text-center">
                      <p className="text-xs font-bold text-white/80">Impossible de charger la vidéo</p>
                      <button
                        type="button"
                        onClick={() => setVideoError(false)}
                        className="px-4 py-1.5 rounded-full bg-[#FF6321] text-white text-xs font-bold"
                      >
                        Réessayer
                      </button>
                    </div>
                  ) : (
                    <video
                      src={product.videoUrl}
                      controls
                      autoPlay
                      onError={() => setVideoError(true)}
                      className="w-full h-full object-cover"
                    />
                  )
                ) : (
                  <img
                    src={images[activeImgIndex] || images[0]}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition duration-300"
                  />
                )}

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

                {/* Top-Left Badges */}
                <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1.5 pointer-events-none max-w-[70%]">
                  {promoPercentage > 0 && (
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black tabular-nums flex items-center gap-1 ${pal.promoBadge}`}>
                      <Tag className="w-3 h-3" /> -{promoPercentage}% PROMO
                    </span>
                  )}

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 backdrop-blur-md shadow-md ${
                      product.stock > 0
                        ? 'bg-emerald-950/90 text-emerald-400 border border-emerald-500/45'
                        : 'bg-rose-950/95 text-rose-300 border border-rose-500/45'
                    }`}
                  >
                    {product.stock > 0 ? (
                      <>
                        <Check className="w-2.5 h-2.5 stroke-[3.2]" />
                        <span>En stock</span>
                      </>
                    ) : (
                      <span>Rupture</span>
                    )}
                  </span>
                </div>

                {/* Top-Right Video Toggle & Image Counter */}
                <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                  {product.videoUrl && (
                    <button
                      type="button"
                      onClick={() => setShowVideo(!showVideo)}
                      className={`px-3 py-1 rounded-full backdrop-blur-md text-xs font-black flex items-center gap-1.5 shadow-lg transition active:scale-95 ${
                        showVideo
                          ? 'bg-[#FF6321] text-white'
                          : 'bg-black/75 hover:bg-black/90 text-white border border-white/20'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{showVideo ? 'Photo' : 'Vidéo'}</span>
                    </button>
                  )}

                  <div className="bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/15 text-white/90 text-[10px] font-bold tabular-nums">
                    {activeImgIndex + 1} / {images.length}
                  </div>
                </div>

                {/* Thumbnail Strip */}
                {images.length > 1 && (
                  <div className="absolute bottom-3 left-0 right-0 px-4 flex justify-center gap-2 overflow-x-auto no-scrollbar py-1">
                    {images.map((img, i) => {
                      const matched = getVariantForImage(img);
                      const isActive = activeImgIndex === i && !showVideo;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleThumbnailClick(img, i)}
                          className={`relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition shadow-md ${
                            isActive
                              ? pal.thumbRingActive
                              : 'border-white/20 opacity-65 hover:opacity-100'
                          }`}
                          title={matched ? `${matched.type} : ${matched.option}` : `Photo ${i + 1}`}
                        >
                          <img src={img} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          {matched && (
                            <div className="absolute bottom-0 inset-x-0 bg-black/75 text-[8px] text-white font-bold text-center truncate px-0.5 leading-tight">
                              {matched.option.split('/')[0].trim()}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Price, Title & Social Proof */}
              <div className="p-4 space-y-2.5">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div className="flex items-baseline gap-2.5 flex-wrap">
                    <span className="text-[24px] font-black text-white tabular-nums leading-none tracking-tight">
                      {formatFCFA(product.price)}
                    </span>
                    {product.originalPrice && product.originalPrice > product.price && (
                      <span className="text-xs text-white/40 line-through tabular-nums">
                        {formatFCFA(product.originalPrice)}
                      </span>
                    )}
                    {discountAmount > 0 && (
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tabular-nums ${pal.promoAppliedPill}`}>
                        Économisez {formatFCFA(discountAmount)}
                      </span>
                    )}
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-[10.5px] font-bold text-white/75 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#FF6321]" />
                    Livraison Express 24h
                  </span>
                </div>

                <h1 className="text-[17px] sm:text-[19px] font-extrabold text-white leading-snug tracking-tight">
                  {product.name}
                </h1>

                <div className="flex items-center gap-3 text-xs text-white/65 flex-wrap pt-1.5 border-t border-white/[0.07]">
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]" />
                    <span className="font-extrabold text-amber-300 tabular-nums">
                      {product.rating > 0 ? product.rating.toFixed(1) : 'Nouveau'}
                    </span>
                    <span className="text-white/50 tabular-nums">
                      ({formatMetricCount(product.reviewsCount ?? 0)} avis)
                    </span>
                  </div>
                  <span className="text-white/20">•</span>
                  <span className="font-semibold text-white/75 tabular-nums">
                    {formatMetricCount(product.salesCount ?? 0)} ventes
                  </span>
                  <span className="text-white/20">•</span>
                  <span className="flex items-center gap-1 text-white/75">
                    <MapPin className="w-3.5 h-3.5 text-[#FF6321]" />
                    <span>{product.location || 'Adjamé, Abidjan'}</span>
                  </span>
                </div>
              </div>
            </section>

            {/* VARIANTS, QUANTITY & AUTHENTIC STOCK CARD (Same design as Step1ProductVerification) */}
            <section className={`${pal.card} p-4 space-y-3.5`}>
              {nonColorVariants.map((v, vIdx) => {
                const isSizeGroup =
                  v.type.toLowerCase().includes('taille') ||
                  v.type.toLowerCase().includes('size') ||
                  v.type.toLowerCase().includes('pointure');
                const selectedVal = selectedVariants[v.type] || v.options[0] || '';

                return (
                  <div
                    key={`pdm-group-${v.type}-${vIdx}`}
                    className="pb-3 border-b border-white/[0.07] last:border-b-0 last:pb-0 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 min-h-[32px]">
                      <div className="flex items-center gap-2.5 text-sm font-semibold text-white/80">
                        <span className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/55 shrink-0">
                          {isSizeGroup ? (
                            <Maximize2 className="w-3.5 h-3.5" />
                          ) : (
                            <Box className="w-3.5 h-3.5" />
                          )}
                        </span>
                        <span>{v.type}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isSizeGroup && (
                          <button
                            type="button"
                            onClick={() => setShowSizeGuideModal(true)}
                            className={`text-[11px] font-bold ${pal.accentText} hover:underline flex items-center gap-1 mr-1`}
                            title="Voir le guide des tailles"
                          >
                            <Ruler className="w-3 h-3" />
                            <span>Guide</span>
                          </button>
                        )}
                        <span className="text-sm font-extrabold text-white">{selectedVal}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {v.options.map((opt, optIdx) => {
                        const isSelected = selectedVal === opt;
                        const isAvailableSize = isSizeGroup ? availableSizes.includes(opt) : true;
                        const optStock = product.variantStock?.[opt];
                        const isOutOfStock = isSizeGroup
                          ? !isAvailableSize
                          : optStock !== undefined && optStock <= 0;

                        return (
                          <button
                            key={`pdm-opt-${v.type}-${opt}-${optIdx}`}
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => handleSelectOption(v.type, opt)}
                            className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 active:scale-95 ${
                              isSelected
                                ? pal.variantActive
                                : isOutOfStock
                                ? 'bg-white/[0.02] border-white/[0.06] text-white/35 line-through cursor-not-allowed'
                                : pal.variantIdle
                            }`}
                          >
                            <span>{isSizeGroup && opt.length <= 3 ? `Taille ${opt}` : opt}</span>
                            {isOutOfStock && <span className="text-[9px] text-rose-400 no-underline">Épuisé</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Quantity Row */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className={`flex items-center gap-1.5 ${pal.qtyWell} rounded-2xl p-1`}>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(product.stock > 0 ? 1 : 0, quantity - 1))}
                    disabled={quantity <= 1}
                    aria-label="Diminuer la quantité"
                    className={`w-10 h-10 rounded-xl ${pal.qtyBtn} disabled:opacity-35 flex items-center justify-center text-white transition active:scale-95`}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-14 text-center text-base font-black text-white tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    disabled={product.stock <= 0 || quantity >= product.stock}
                    aria-label="Augmenter la quantité"
                    className={`w-10 h-10 rounded-xl ${pal.qtyBtn} disabled:opacity-35 flex items-center justify-center text-white transition active:scale-95`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className={`px-5 py-2.5 rounded-2xl ${pal.unitPill} text-xs font-extrabold`}>
                  {product.specs?.['Unité'] || 'Pièce'}
                </div>
              </div>

              {/* Authentic Stock Status Line */}
              <div className="flex items-center justify-between gap-2 pt-1">
                {product.stock > 0 ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.35)]">
                      <Check className="w-3 h-3 stroke-[3.2]" />
                    </span>
                    <span className="font-extrabold text-emerald-400">Stock disponible :</span>
                    <span className="text-white/95 font-bold tabular-nums">
                      {product.stock} pièce{product.stock > 1 ? 's' : ''} restante{product.stock > 1 ? 's' : ''}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-rose-400 font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Article en rupture de stock actuellement.</span>
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
                  Le stock affiché correspond exactement aux pièces disponibles en boutique et est réservé dès la validation de votre commande.
                </p>
              )}
            </section>

            {/* SELLER VERIFICATION CARD (Same design as Step1ProductVerification) */}
            {seller && (
              <section className={`${pal.card} p-4 space-y-3`}>
                <div className="flex items-center justify-between gap-3">
                  <div
                    className="flex items-center gap-3 min-w-0 cursor-pointer"
                    onClick={() => {
                      onClose();
                      setSelectedSeller(seller);
                    }}
                  >
                    {seller.avatar ? (
                      <img
                        src={seller.avatar}
                        alt={seller.storeName || seller.name}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-full object-cover border-2 border-white/15 bg-[#1B1F1D] shadow-md shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#2B66FF] to-[#133EC9] border border-white/20 text-white font-black text-sm flex items-center justify-center shrink-0">
                        {(seller.storeName || seller.name).slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[15px] font-extrabold text-white truncate">
                          {seller.storeName || seller.name}
                        </span>
                        {seller.verified && <VerifiedBlueSeal className="w-4 h-4 shrink-0" />}
                      </div>
                      <p className="text-xs text-white/60 truncate mt-0.5">
                        Vendeur vérifié • {seller.location || 'Marché d’Adjamé'}
                      </p>
                      <p className="text-[10.5px] text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Répond en &lt; 15 min
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1 text-sm font-black text-white tabular-nums">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]" />
                      <span>{(seller.rating || 4.9).toFixed(1)}</span>
                    </div>
                    {(seller.salesCount ?? 0) > 0 && (
                      <p className="text-[11px] text-white/55 tabular-nums mt-0.5">
                        ({formatMetricCount(seller.salesCount)} ventes)
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (!requireAuth('messages', { type: 'open_messages', sellerId: seller.id, relatedProductId: product.id })) {
                        return;
                      }
                      onClose();
                      openChatWithSeller(seller.id, product.id);
                    }}
                    className={`flex-1 min-h-[40px] px-3 rounded-full ${pal.secondaryBtn} text-xs font-extrabold flex items-center justify-center gap-1.5 transition active:scale-95`}
                    title="Discuter avec le vendeur"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-[#FF6321]" />
                    <span>Discuter</span>
                  </button>

                  <button
                    id="btn-product-detail-view-seller-profile"
                    type="button"
                    onClick={() => {
                      onClose();
                      setSelectedSeller(seller);
                    }}
                    className={`flex-1 min-h-[40px] px-3 rounded-full ${pal.outlineAccentBtn} text-xs font-extrabold flex items-center justify-center gap-1.5 transition active:scale-95`}
                    title="Voir le profil du vendeur"
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>Voir la boutique</span>
                  </button>
                </div>
              </section>
            )}

            {/* SUMMARY CARD (Same design as Step1ProductVerification) */}
            <section className={`${pal.card} p-4 space-y-3`}>
              <div className="flex items-center gap-2.5 pb-1">
                <SummaryCalculatorIcon accent="orange" className="w-6 h-6 shrink-0" />
                <h3 className="text-[15.5px] font-extrabold text-white tracking-tight">Récapitulatif</h3>
              </div>

              <div className="space-y-2 text-[13px]">
                <div className="flex items-center justify-between text-white/70">
                  <span>
                    Sous-total ({quantity} article{quantity > 1 ? 's' : ''})
                  </span>
                  <span className="font-extrabold text-white tabular-nums">{formatFCFA(subtotal)}</span>
                </div>

                <div className="flex items-center justify-between text-white/70">
                  <span>Frais de livraison (à la commande)</span>
                  <span className={`font-extrabold ${pal.accentText}`}>À calculer</span>
                </div>

                <div className="flex items-center justify-between text-white/70">
                  <button
                    type="button"
                    onClick={() => setShowFeeTooltip((v) => !v)}
                    className="flex items-center gap-1.5 hover:text-white transition"
                  >
                    <span>Frais de service (1%)</span>
                    <Info className="w-3.5 h-3.5 text-white/45" />
                  </button>
                  <span className="font-extrabold text-white tabular-nums">+ {formatFCFA(serviceFee)}</span>
                </div>

                {showFeeTooltip && (
                  <p className="text-[11px] text-white/65 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
                    Frais de sécurisation des paiements et garantie séquestre DJASSA (1% du sous-total articles).
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-white/[0.09] flex items-center justify-between">
                <span className="text-[15px] font-extrabold text-white">Montant estimé</span>
                <span className={`text-xl font-black ${pal.accentText} tabular-nums`}>
                  {formatFCFA(estimatedTotal)}
                </span>
              </div>
            </section>

            {/* TABBED INFORMATION (Description, Spécifications, Avis, Remboursement) */}
            <section className={`${pal.card} p-4 space-y-3`}>
              <div className={`p-1 rounded-2xl ${pal.innerWell} flex items-center gap-1 overflow-x-auto no-scrollbar`}>
                {(
                  [
                    { key: 'description', label: 'Description' },
                    { key: 'specs', label: 'Caractéristiques' },
                    { key: 'avis', label: `Avis (${mockReviews.length})` },
                    { key: 'remboursement', label: 'Remboursement' }
                  ] as const
                ).map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTabState(tab.key)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs transition-all whitespace-nowrap ${
                        isActive
                          ? 'bg-gradient-to-r from-[#FF6321] to-[#ff7d45] text-white shadow-md shadow-orange-600/25 font-black'
                          : 'text-white/60 hover:text-white hover:bg-white/5 font-bold'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {activeTab === 'description' && (
                <div className={`p-3.5 rounded-2xl ${pal.innerWell} text-xs text-white/80 leading-relaxed`}>
                  <p className="whitespace-pre-line">
                    {product.description ||
                      'Superbe article de haute qualité sélectionné par les commerçants du grand marché d’Adjamé.'}
                  </p>
                </div>
              )}

              {activeTab === 'specs' && (
                <div className={`rounded-2xl ${pal.innerWell} divide-y divide-white/[0.07] overflow-hidden`}>
                  {product.specs && Object.keys(product.specs).length > 0 ? (
                    Object.entries(product.specs).map(([key, val]) => (
                      <div key={key} className="flex justify-between items-center p-3 text-xs">
                        <span className="text-white/55">{key}</span>
                        <span className="font-bold text-white">{val}</span>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="flex justify-between items-center p-3 text-xs">
                        <span className="text-white/55">Matière / Tissu</span>
                        <span className="font-bold text-white">100% Coton Wax Véritable</span>
                      </div>
                      <div className="flex justify-between items-center p-3 text-xs">
                        <span className="text-white/55">Origine</span>
                        <span className="font-bold text-white">Confection Côte d'Ivoire 🇨🇮</span>
                      </div>
                      <div className="flex justify-between items-center p-3 text-xs">
                        <span className="text-white/55">Entretien</span>
                        <span className="font-bold text-white">Lavage à 30°C ou main</span>
                      </div>
                      <div className="flex justify-between items-center p-3 text-xs">
                        <span className="text-white/55">Catégorie</span>
                        <span className="font-bold text-white">{product.category}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'avis' && (
                <div className="space-y-2.5">
                  <div className={`p-3.5 rounded-2xl ${pal.innerWell} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-black text-amber-400 tabular-nums">
                        {product.rating || '4.9'}
                      </span>
                      <div>
                        <div className="flex text-amber-400 gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-current" />
                          ))}
                        </div>
                        <span className="text-[10.5px] text-white/50 block mt-0.5">
                          Basé sur 138 avis vérifiés
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/12 px-3 py-1 rounded-full border border-emerald-500/30">
                      98% recommandent
                    </span>
                  </div>

                  {mockReviews.map((rev) => (
                    <div key={rev.id} className={`p-3.5 rounded-2xl ${pal.innerWell} space-y-2`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FF6321] to-amber-400 text-white text-xs font-black flex items-center justify-center shrink-0">
                            {rev.author.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-extrabold text-white">{rev.author}</span>
                              {rev.verified && (
                                <span className="text-[9.5px] text-emerald-400 font-semibold flex items-center gap-0.5">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> Achat vérifié
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-white/45">{rev.location}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-white/45">{rev.date}</span>
                      </div>

                      <div className="flex text-amber-400 gap-0.5">
                        {[...Array(rev.rating)].map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-current" />
                        ))}
                      </div>

                      <p className="text-xs text-white/80 leading-relaxed">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'remboursement' && (
                <div className="space-y-3 text-xs text-white/85 leading-relaxed">
                  <div className={`${pal.securityCard} flex items-start gap-3`}>
                    <div className={`w-9 h-9 rounded-xl ${pal.iconBox} ${pal.accentText} flex items-center justify-center shrink-0`}>
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-white">Garantie Djassa Acheteur Protégé</h4>
                      <p className="text-[11px] text-white/75 leading-snug mt-0.5">
                        {product.conditions?.returnPeriodDays === 0 ? (
                          <span>Cet article est <strong>non retournable</strong> après réception.</span>
                        ) : (
                          <span>
                            Délai de{' '}
                            <strong className="text-white">
                              {product.conditions?.returnPeriodDays !== undefined
                                ? product.conditions.returnPeriodDays === 1
                                  ? '24 heures (1 jour)'
                                  : product.conditions.returnPeriodDays === 2
                                  ? '48 heures (2 jours)'
                                  : `${product.conditions.returnPeriodDays} jours`
                                : '3 jours'}
                            </strong>{' '}
                            après réception pour demander un échange ou un remboursement complet.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h5 className="text-[11px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5 text-[#FF6321]" /> Motifs acceptés de retour
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      {[
                        { title: 'Article non conforme', desc: 'Taille, couleur ou modèle différent.' },
                        { title: 'Défaut de fabrication', desc: 'Tissu abîmé ou couture déchirée.' },
                        { title: 'Échange de taille facile', desc: 'Échange possible sous 48h.' },
                        { title: 'Colis endommagé', desc: 'Détérioration constatée à la remise.' }
                      ].map((reason) => (
                        <div key={reason.title} className={`p-2.5 rounded-xl ${pal.innerWell} flex items-start gap-2`}>
                          <span className="text-emerald-400 font-black text-sm">✓</span>
                          <div>
                            <strong className="text-white block">{reason.title}</strong>
                            <span className="text-white/60">{reason.desc}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {((product.conditions?.refundSteps && product.conditions.refundSteps.length > 0) ||
                    product.conditions?.returnPeriodDays !== 0) && (
                    <div className="pt-1 space-y-2">
                      <h5 className="text-[11px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-[#FF6321]" /> Comment demander un remboursement ?
                      </h5>
                      <ol className={`space-y-1.5 text-[11px] text-white/75 list-decimal list-inside p-3 rounded-2xl ${pal.innerWell}`}>
                        {product.conditions?.refundSteps && product.conditions.refundSteps.length > 0 ? (
                          product.conditions.refundSteps.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))
                        ) : (
                          <>
                            <li>Contactez le vendeur via le bouton « Discuter » ou le support Djassa.</li>
                            <li>Joignez une photo ou vidéo montrant le défaut ou la taille reçue.</li>
                            <li>Un coursier récupère l'article non porté dans son emballage d'origine.</li>
                            <li>Règlement par Wave ou échange immédiat de produit.</li>
                          </>
                        )}
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* REASSURANCE & SECURITY STRIP (Identical to Home "Acheter" flow) */}
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

            <section className={`${pal.securityCard} flex items-center justify-between gap-2`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-9 h-9 rounded-xl ${pal.iconBox} ${pal.accentText} flex items-center justify-center shrink-0`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-white">Paiement 100% sécurisé</div>
                  <div className="text-[10.5px] text-white/60 truncate">
                    Vos achats sont protégés sous séquestre DJASSA
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <MtnMomoLogo className="w-7 h-7" />
                <WaveLogo className="w-7 h-7" />
                <OrangeMoneyLogo className="w-7 h-7" />
                <CardPaymentLogo className="w-7 h-7" />
              </div>
            </section>

            {/* SIMILAR PRODUCTS / VOUS AIMEREZ AUSSI */}
            {relatedProducts.length > 0 && (
              <section className={`${pal.card} p-4 space-y-3`}>
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-extrabold text-white tracking-tight">
                    Vous aimerez aussi
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full ${pal.promoAppliedPill} text-[10.5px] font-extrabold`}>
                    Même catégorie
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {relatedProducts.map((relProd) => {
                    const relSeller = sellers.find((s) => s.id === relProd.sellerId);
                    const isLiked = userProfile?.likedVideoIds?.includes(relProd.id);
                    const rawLikes =
                      (relProd.videoLikesCount || relProd.likesCount || 0) + (isLiked ? 1 : 0);
                    const formattedLikes = formatMetricCount(rawLikes);
                    const cardPoster =
                      relProd.videoPoster ||
                      relProd.images?.[0] ||
                      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400';
                    const isVideo = relProd.mediaType === 'video' && Boolean(relProd.videoUrl);

                    return (
                      <div
                        key={relProd.id}
                        onClick={() => {
                          onClose();
                          navigateToFeedProduct(relProd.id, product);
                        }}
                        className="relative group rounded-2xl overflow-hidden bg-neutral-900 border border-white/10 hover:border-[#FF6321]/60 transition-all duration-300 cursor-pointer shadow-xl select-none flex flex-col justify-between aspect-[9/14]"
                      >
                        <img
                          src={cardPoster}
                          alt={relProd.name}
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 pointer-events-none"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/50 pointer-events-none" />

                        <div className="relative z-10 p-2.5 flex items-start justify-between gap-1.5">
                          <div className="flex flex-col gap-1 items-start min-w-0">
                            {relProd.discountPercentage ? (
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${pal.promoBadge}`}>
                                -{relProd.discountPercentage}%
                              </span>
                            ) : (
                              <div className="inline-flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/15 max-w-[110px]">
                                <Store className="w-2.5 h-2.5 text-[#FF6321] shrink-0" />
                                <span className="text-[9px] font-bold text-white truncate">
                                  @{relSeller?.username || 'boutique'}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleLikeVideo(relProd.id);
                              }}
                              className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-md border border-white/20 hover:bg-black/80 flex items-center justify-center text-[#FE2C55] active:scale-75 transition shadow-lg"
                              title={isLiked ? 'Ne plus aimer' : 'Aimer'}
                              aria-label="Aimer"
                            >
                              <Heart
                                className={`w-3.5 h-3.5 ${
                                  isLiked ? 'fill-[#FE2C55] text-[#FE2C55]' : 'text-white'
                                }`}
                              />
                            </button>

                            {isVideo && (
                              <div className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
                                <Play className="w-3 h-3 text-white fill-white ml-0.5" />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="relative z-10 p-2.5 space-y-1.5">
                          <h4 className="font-extrabold text-white leading-tight drop-shadow-md break-words text-xs line-clamp-2">
                            {relProd.name}
                          </h4>

                          <div className="flex items-center justify-between gap-1 pt-0.5">
                            <span className="font-black text-[#FF6321] drop-shadow-sm text-xs tabular-nums">
                              {formatFCFA(relProd.price)}
                            </span>

                            <span className="inline-flex items-center gap-1 text-white/90 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 text-[10px] font-bold shrink-0">
                              <Heart className="w-2.5 h-2.5 text-[#FE2C55] fill-[#FE2C55]" />
                              <span>{formattedLikes}</span>
                            </span>
                          </div>

                          <div className="pt-1 flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                                navigateToFeedProduct(relProd.id, product);
                              }}
                              className="flex-1 py-1.5 px-2 rounded-full bg-white/15 hover:bg-white/25 text-white text-[10px] font-extrabold flex items-center justify-center gap-1 backdrop-blur-md border border-white/15 transition"
                            >
                              <ShoppingBag className="w-3 h-3" />
                              <span>Voir</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!requireAuth('cart', { type: 'add_to_cart', productId: relProd.id, variantSelected: {}, quantity: 1 })) {
                                  return;
                                }
                                addToCart(relProd.id, {}, 1);
                                showToast?.('Ajouté au panier ! 🛍️');
                              }}
                              className="p-1.5 px-2.5 rounded-full bg-[#FF6321] hover:bg-[#ff7538] active:scale-90 text-white text-[10px] font-bold flex items-center justify-center border border-[#FF6321]/40 transition shadow-md shadow-orange-600/30 shrink-0"
                              title="Ajouter au panier"
                              aria-label="Ajouter au panier"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </main>

        {/* 3. STICKY BOTTOM ACTION BAR (Matching Step1ProductVerification rounded-full CTAs) */}
        <div className="sticky bottom-0 left-0 right-0 px-4 py-3 border-t border-white/10 bg-[#0A0A0A]/95 backdrop-blur-xl pb-safe z-30 shadow-2xl">
          <div className="w-full max-w-2xl mx-auto flex items-center gap-2.5">
            {isSellerView ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className={`flex-1 min-h-[50px] rounded-full ${pal.secondaryBtn} text-xs font-black transition active:scale-95 flex items-center justify-center gap-1.5`}
                >
                  <Pencil className="w-4 h-4 text-[#FF6321]" />
                  <span>Modifier</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPromoting(true)}
                  className={`flex-1 min-h-[50px] rounded-full ${pal.secondaryBtn} text-xs font-black transition active:scale-95 flex items-center justify-center gap-1.5`}
                >
                  <Megaphone className="w-4 h-4 text-amber-400" />
                  <span>Promouvoir</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-[50px] h-[50px] rounded-full bg-rose-500/12 hover:bg-rose-500/20 text-rose-300 border border-rose-500/25 flex items-center justify-center transition active:scale-95 shrink-0"
                  title="Supprimer le produit"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={product.stock <= 0}
                  className={`min-h-[54px] px-5 rounded-full ${pal.secondaryBtn} font-extrabold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0`}
                >
                  <ShoppingCart className={`w-4 h-4 ${pal.accentText}`} />
                  <span>Panier</span>
                </button>

                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={product.stock <= 0}
                  className={`flex-1 min-h-[54px] py-3.5 px-6 rounded-full ${pal.primaryBtn} disabled:opacity-40 disabled:cursor-not-allowed font-black text-[15.5px] flex items-center justify-center gap-2 transition active:scale-[0.98]`}
                >
                  <span>{product.stock <= 0 ? 'Rupture de stock' : 'Acheter maintenant'}</span>
                  {product.stock > 0 && <ArrowRight className="w-5 h-5 stroke-[2.6]" />}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* MODAL EDIT PRODUIT (SELLER) */}
      {editing && (
        <EditMerchandiseModal
          product={product}
          onClose={() => setEditing(false)}
          onSave={(updates) => {
            updateProductSeller(product.id, updates);
            setEditing(false);
            showToast('Produit mis à jour avec succès ! ✨');
          }}
          onDelete={() => {
            deleteProductSeller(product.id);
            setEditing(false);
            onClose();
            showToast('Produit supprimé de votre boutique.');
          }}
        />
      )}

      {/* MODAL PROMOTION (SELLER) */}
      {promoting && (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className={`w-full max-w-sm ${pal.card} p-5 space-y-3.5 shadow-2xl`}>
            <h3 className="font-black text-white text-base">Promouvoir le produit</h3>
            <p className="text-xs text-white/55">
              Définissez un pourcentage de réduction pour mettre en avant l'article dans l'onglet Promo.
            </p>
            <div className="flex items-center gap-2">
              <input
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                type="number"
                min="0"
                max="90"
                className={`flex-1 ${pal.inputWell} text-sm text-white font-black outline-none`}
                placeholder="Remise %"
              />
              <span className="text-sm font-black text-white">%</span>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPromoting(false)}
                className={`flex-1 py-2.5 rounded-full ${pal.secondaryBtn} text-xs font-bold transition`}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = Math.max(0, Math.min(90, Number(discount) || 0));
                  updateProductSeller(product.id, { discountPercentage: d, isPromotion: d > 0 });
                  setPromoting(false);
                  showToast(d > 0 ? `Promotion de ${d}% activée sur Djassa ! 🔥` : 'Promotion retirée.');
                }}
                className={`flex-1 py-2.5 rounded-full ${pal.primaryBtn} text-xs font-black transition`}
              >
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SUPPRESSION (SELLER) */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className={`w-full max-w-sm ${pal.card} p-5 space-y-4 shadow-2xl`}>
            <div className="flex items-center gap-2 text-rose-400">
              <AlertCircle className="w-5 h-5" />
              <h3 className="font-black text-white text-base">Supprimer ce produit ?</h3>
            </div>
            <p className="text-xs text-white/60">
              Cette action retirera définitivement cet article de votre boutique et du flux public.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className={`flex-1 py-2.5 rounded-full ${pal.secondaryBtn} text-xs font-bold transition`}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteProductSeller(product.id);
                  setConfirmDelete(false);
                  onClose();
                  showToast('Produit supprimé de la boutique.');
                }}
                className="flex-1 py-2.5 rounded-full bg-rose-500 text-xs font-black text-white hover:bg-rose-600 transition shadow-lg shadow-rose-600/30"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO & SIZE GUIDE MODAL */}
      <SizeGuideModal
        isOpen={showSizeGuideModal}
        onClose={() => setShowSizeGuideModal(false)}
        productName={product.name}
        category={product.category}
        options={
          (product.variants || []).find(
            (v) =>
              v.type.toLowerCase().includes('taille') ||
              v.type.toLowerCase().includes('size') ||
              v.type.toLowerCase().includes('pointure')
          )?.options || ['S', 'M', 'L', 'XL']
        }
        selectedSize={selectedVariants['Taille'] || selectedVariants['Pointure'] || selectedVariants['Size']}
        onSelectSize={(size) => {
          const foundSizeGroup = (product.variants || []).find(
            (v) =>
              v.type.toLowerCase().includes('taille') ||
              v.type.toLowerCase().includes('size') ||
              v.type.toLowerCase().includes('pointure')
          );
          if (foundSizeGroup) {
            handleSelectOption(foundSizeGroup.type, size);
          }
        }}
        variantImages={product.variantImages}
      />
    </div>
  );
};
