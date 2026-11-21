import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  X,
  Megaphone,
  Percent,
  Tag,
  Clock,
  Flame,
  Sparkles,
  Package,
  Eye,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Trash2,
  Zap,
  Play,
  Star,
  MapPin,
  ChevronRight,
  Check,
  RefreshCw,
  Store,
  ShieldCheck
} from 'lucide-react';
import { Product } from '../../../types';
import { useApp } from '../../../context/AppContext';
import { formatFCFA, formatMetricCount } from '../../../services/marketServices';

interface ProductPromotionScreenProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

type PricingMode = 'percent' | 'target_price';

const PRESET_DISCOUNTS = [10, 15, 20, 25, 30, 40, 50, 60, 70];

const PROMO_TYPES = [
  {
    id: 'discount',
    label: 'Solde & Remise Standard',
    badgeText: '🏷️ EN PROMO',
    desc: 'Réduction directe appliquée sur le prix normal pour dynamiser vos ventes.',
    color: '#FF6321'
  },
  {
    id: 'flash',
    label: 'Vente Flash Abidjan ⚡',
    badgeText: '🔥 VENTE FLASH',
    desc: 'Offre coup de poing à durée limitée avec compte à rebours d\'urgence.',
    color: '#FE2C55'
  },
  {
    id: 'clearance',
    label: 'Déstockage / Fin de série 📦',
    badgeText: '📦 DÉSTOCKAGE',
    desc: 'Prix plancher pour écouler rapidement les dernières pièces en rayon.',
    color: '#F59E0B'
  },
  {
    id: 'special',
    label: 'Bon Plan Vedette Djassa 🎉',
    badgeText: '⚡ BON PLAN',
    desc: 'Mise en avant prioritaire dans l\'onglet Bons Plans et sur le fil d\'accueil.',
    color: '#EC4899'
  },
  {
    id: 'exclusive',
    label: 'Exclusivité Abonnés ✨',
    badgeText: '👑 PRIX VIP',
    desc: 'Tarif préférentiel réservé pour fidéliser et récompenser vos abonnés.',
    color: '#8B5CF6'
  }
];

const PROMO_BADGES = [
  '🏷️ EN PROMO',
  '🔥 VENTE FLASH',
  '⚡ BON PLAN',
  '📦 DÉSTOCKAGE',
  '💥 PRIX CASSÉ',
  '✨ EXCLUSIVITÉ',
  '🎉 OFFRE DU JOUR',
  '👑 PRIX VIP'
];

const PROMO_DURATIONS = [
  { id: 'permanent', label: 'Jusqu\'à épuisement du stock', desc: 'Reste actif tant qu\'il y a du stock en rayon' },
  { id: '24h', label: '24 Heures (Flash Express)', desc: 'Crée une forte urgence d\'achat immédiat' },
  { id: '48h', label: '48 Heures (Spécial Week-end)', desc: 'Idéal du vendredi au dimanche soir' },
  { id: '7d', label: '7 Jours (Semaine promotionnelle)', desc: 'Parfait pour une opération hebdomadaire' },
  { id: 'custom', label: 'Date personnalisée', desc: 'Définissez une date exacte de fin d\'opération' }
];

export const ProductPromotionScreen: React.FC<ProductPromotionScreenProps> = ({
  product,
  isOpen,
  onClose
}) => {
  const { updateProductSeller, showToast } = useApp();

  // Active gallery media
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [showVideo, setShowVideo] = useState(false);

  // Pricing input mode
  const [pricingMode, setPricingMode] = useState<PricingMode>('percent');

  // Form states
  const [isPromotionActive, setIsPromotionActive] = useState<boolean>(true);
  const [originalPrice, setOriginalPrice] = useState<number>(20000);
  const [discountPercent, setDiscountPercent] = useState<number>(20);
  const [customTargetPrice, setCustomTargetPrice] = useState<number>(16000);
  const [promoType, setPromoType] = useState<string>('discount');
  const [promoBadge, setPromoBadge] = useState<string>('🏷️ EN PROMO');
  const [customBadgeText, setCustomBadgeText] = useState<string>('');
  const [isCustomBadge, setIsCustomBadge] = useState<boolean>(false);
  const [promoDuration, setPromoDuration] = useState<string>('permanent');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showCountdown, setShowCountdown] = useState<boolean>(true);
  const [limitStockQuota, setLimitStockQuota] = useState<boolean>(false);
  const [promoStockQuota, setPromoStockQuota] = useState<number>(5);
  const [notifyFollowers, setNotifyFollowers] = useState<boolean>(true);

  // Sync state whenever product changes
  useEffect(() => {
    if (product) {
      const baseOriginal = product.originalPrice && product.originalPrice > product.price
        ? product.originalPrice
        : (product.isPromotion && product.discountPercentage 
            ? Math.round(product.price / (1 - product.discountPercentage / 100)) 
            : product.price);

      setOriginalPrice(baseOriginal);

      const hasActivePromo = product.isPromotion ?? false;
      setIsPromotionActive(hasActivePromo);

      const initialPct = product.discountPercentage && product.discountPercentage > 0 
        ? product.discountPercentage 
        : 20;
      setDiscountPercent(initialPct);

      const calculatedTarget = Math.round(baseOriginal * (1 - initialPct / 100));
      setCustomTargetPrice(product.isPromotion ? product.price : calculatedTarget);

      setPromoType(product.promoType || 'discount');
      
      const badge = product.promoBadge || '🏷️ EN PROMO';
      if (PROMO_BADGES.includes(badge)) {
        setPromoBadge(badge);
        setIsCustomBadge(false);
      } else {
        setPromoBadge(badge);
        setCustomBadgeText(badge);
        setIsCustomBadge(true);
      }

      setShowCountdown(product.promoShowCountdown ?? true);
      setNotifyFollowers(product.promoNotifyFollowers ?? true);

      if (product.promoStockLimit && product.promoStockLimit > 0) {
        setLimitStockQuota(true);
        setPromoStockQuota(Math.min(product.stock, product.promoStockLimit));
      } else {
        setLimitStockQuota(false);
        setPromoStockQuota(Math.min(product.stock, Math.max(1, Math.round(product.stock / 2))));
      }

      if (product.promoEndDate) {
        setPromoDuration('custom');
        setCustomEndDate(product.promoEndDate);
      } else {
        setPromoDuration('permanent');
      }

      setActiveImgIndex(0);
      setShowVideo(false);
    }
  }, [product, isOpen]);

  // Derived calculations
  const effectiveDiscountPercent = useMemo(() => {
    if (pricingMode === 'percent') {
      return Math.max(1, Math.min(95, discountPercent));
    }
    if (pricingMode === 'target_price') {
      if (originalPrice <= 0) return 0;
      const pct = Math.round(((originalPrice - customTargetPrice) / originalPrice) * 100);
      return Math.max(1, Math.min(95, pct));
    }
    return Math.max(1, Math.min(95, discountPercent));
  }, [pricingMode, discountPercent, originalPrice, customTargetPrice]);

  const discountAmount = useMemo(() => {
    return Math.round((originalPrice * effectiveDiscountPercent) / 100);
  }, [originalPrice, effectiveDiscountPercent]);

  const finalSellingPrice = useMemo(() => {
    if (pricingMode === 'target_price') {
      return Math.max(100, customTargetPrice);
    }
    return Math.max(100, originalPrice - discountAmount);
  }, [pricingMode, customTargetPrice, originalPrice, discountAmount]);

  if (!isOpen || !product) return null;

  // Change percentage directly
  const handlePercentChange = (pct: number) => {
    const clamped = Math.max(1, Math.min(90, pct));
    setDiscountPercent(clamped);
    const newTarget = Math.round(originalPrice * (1 - clamped / 100));
    setCustomTargetPrice(newTarget);
  };

  // Change target price directly
  const handleTargetPriceChange = (price: number) => {
    const clamped = Math.max(100, Math.min(originalPrice - 100, price));
    setCustomTargetPrice(clamped);
    const computedPct = Math.round(((originalPrice - clamped) / originalPrice) * 100);
    setDiscountPercent(Math.max(1, Math.min(95, computedPct)));
  };

  // Save changes
  const handleSave = () => {
    const finalBadge = isCustomBadge && customBadgeText.trim() ? customBadgeText.trim() : promoBadge;
    
    let calculatedEndDate: string | undefined = undefined;
    if (promoDuration === 'custom' && customEndDate) {
      calculatedEndDate = customEndDate;
    } else if (promoDuration === '24h') {
      const d = new Date();
      d.setHours(d.getHours() + 24);
      calculatedEndDate = d.toISOString();
    } else if (promoDuration === '48h') {
      const d = new Date();
      d.setHours(d.getHours() + 48);
      calculatedEndDate = d.toISOString();
    } else if (promoDuration === '7d') {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      calculatedEndDate = d.toISOString();
    }

    if (isPromotionActive) {
      updateProductSeller(product.id, {
        isPromotion: true,
        discountPercentage: effectiveDiscountPercent,
        originalPrice: originalPrice,
        price: finalSellingPrice,
        promoBadge: finalBadge,
        promoType: promoType,
        promoShowCountdown: showCountdown,
        promoNotifyFollowers: notifyFollowers,
        promoStockLimit: limitStockQuota ? promoStockQuota : undefined,
        promoEndDate: calculatedEndDate
      });

      showToast(`Promotion de -${effectiveDiscountPercent}% publiée avec succès sur ${product.name} ! 🏷️`);
    } else {
      updateProductSeller(product.id, {
        isPromotion: false,
        discountPercentage: 0,
        price: originalPrice,
        promoBadge: undefined,
        promoType: undefined,
        promoShowCountdown: false,
        promoStockLimit: undefined,
        promoEndDate: undefined
      });

      showToast(`Promotion désactivée. Tarif normal rétabli (${formatFCFA(originalPrice)}).`);
    }

    onClose();
  };

  // Deactivate promotion
  const handleDeactivate = () => {
    updateProductSeller(product.id, {
      isPromotion: false,
      discountPercentage: 0,
      price: originalPrice,
      promoBadge: undefined,
      promoType: undefined,
      promoShowCountdown: false,
      promoStockLimit: undefined,
      promoEndDate: undefined
    });

    showToast(`Promotion retirée pour ${product.name}. Prix normal rétabli.`);
    onClose();
  };

  const images = (product.images && product.images.length > 0)
    ? product.images
    : [product.videoPoster || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'];

  return (
    <div 
      id="product-promotion-screen-overlay"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center overflow-hidden animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl h-full sm:h-[94vh] bg-[#0E0E0E] sm:rounded-3xl border-t sm:border border-white/15 flex flex-col overflow-hidden shadow-2xl relative"
        onClick={e => e.stopPropagation()}
      >
        {/* TOP NAVIGATION BAR (Matching ProductDetailModal design) */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[#121212]/95 backdrop-blur-md border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <button 
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/15 text-white/80 hover:text-white transition active:scale-95"
              aria-label="Retour"
              title="Retour"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#FF6321] uppercase tracking-widest block font-black">
                  Paramètres Promotion & Solde
                </span>
                {isPromotionActive && (
                  <span className="text-[9px] bg-rose-500/20 text-rose-400 font-bold px-1.5 py-0.2 rounded border border-rose-500/30">
                    -{effectiveDiscountPercent}% Actif
                  </span>
                )}
              </div>
              <h2 className="text-xs font-black text-white line-clamp-1 max-w-[240px] sm:max-w-md">
                {product.name}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* SCROLLABLE BODY CONTENT */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-5 pb-36">
          {/* MEDIA HERO SECTION (4:3 ratio, identical to ProductDetailModal) */}
          <div className="relative aspect-[4/3] w-full bg-neutral-900 border-b border-white/10 overflow-hidden">
            {showVideo && product.videoUrl ? (
              <video
                src={product.videoUrl}
                controls
                autoPlay
                className="w-full h-full object-cover"
              />
            ) : (
              <img 
                src={images[activeImgIndex] || images[0]} 
                alt={product.name} 
                className="w-full h-full object-cover transition duration-300"
              />
            )}

            {/* FLOATING OVERLAYS (Stacked in single flex column to prevent badge overlap) */}
            <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1.5 pointer-events-none max-w-[72%]">
              {isPromotionActive ? (
                <>
                  <span className="px-2.5 py-1 rounded-full bg-rose-500/95 backdrop-blur-md text-white font-black text-xs shadow-lg flex items-center gap-1 shrink-0 animate-pulse">
                    <Tag className="w-3 h-3" /> -{effectiveDiscountPercent}% PROMO
                  </span>

                  <span className="px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white font-bold text-[10px] shadow-lg flex items-center gap-1 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-[#FF6321]" />
                    {isCustomBadge && customBadgeText ? customBadgeText : promoBadge}
                  </span>

                  <div className="px-3 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/15 text-white shadow-xl flex items-center gap-1.5 text-[10px] font-bold shrink-0">
                    <span className="text-white/60">Prix réduit :</span>
                    <span className="text-[#FF6321] font-black">{formatFCFA(finalSellingPrice)}</span>
                  </div>
                </>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-white/70 font-bold text-[10px] shadow-lg flex items-center gap-1 shrink-0">
                  <span className="w-2 h-2 rounded-full bg-white/40" /> Tarif catalogue normal
                </span>
              )}
            </div>

            {/* RIGHT STATUS BADGE */}
            <div className="absolute top-3 right-3 flex items-center gap-2">
              {product.videoUrl && (
                <button
                  type="button"
                  onClick={() => setShowVideo(!showVideo)}
                  className={`px-3 py-1 rounded-full backdrop-blur-md text-xs font-black flex items-center gap-1.5 shadow-lg transition active:scale-95 ${
                    showVideo 
                      ? 'bg-[#FF6321] text-white' 
                      : 'bg-black/70 hover:bg-black/90 text-white border border-white/20'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{showVideo ? 'Voir photo' : 'Vidéo'}</span>
                </button>
              )}

              <div className="bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/15 text-white/90 text-[10px] font-bold">
                {activeImgIndex + 1} / {images.length}
              </div>
            </div>

            {/* THUMBNAIL STRIP */}
            {images.length > 1 && (
              <div className="absolute bottom-3 left-0 right-0 px-4 flex justify-center gap-2 overflow-x-auto no-scrollbar py-1">
                {images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setShowVideo(false);
                      setActiveImgIndex(i);
                    }}
                    className={`relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition shadow-md ${
                      activeImgIndex === i && !showVideo 
                        ? 'border-[#FF6321] scale-105 ring-2 ring-[#FF6321]/40' 
                        : 'border-white/20 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* MAIN PRICE & TITLE BLOCK (Identical to ProductDetailModal layout) */}
          <div className="px-4 space-y-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl sm:text-3xl font-black text-[#FF6321]">
                  {formatFCFA(finalSellingPrice)}
                </span>
                {isPromotionActive && (
                  <>
                    <span className="text-sm text-white/40 line-through">
                      {formatFCFA(originalPrice)}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      Économie client : {formatFCFA(discountAmount)} (-{effectiveDiscountPercent}%)
                    </span>
                  </>
                )}
              </div>

              {product.stock > 0 ? (
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 shrink-0 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Stock : {product.stock} pcs
                </span>
              ) : (
                <span className="text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20 shrink-0">
                  Rupture de stock
                </span>
              )}
            </div>

            <h1 className="text-lg font-black text-white leading-snug">
              {product.name}
            </h1>

            {/* RATING & SALES PROOF */}
            <div className="flex items-center gap-3 text-xs text-white/60 flex-wrap pt-1 border-t border-white/5">
              <div className="flex items-center gap-1 text-amber-400 font-extrabold">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>{product.rating || '4.9'}</span>
                <span className="text-white/40 font-normal">
                  ({formatMetricCount((product.salesCount || 10) * 3 + 14)} avis)
                </span>
              </div>
              <span className="text-white/20">•</span>
              <span className="text-white/70 font-semibold">
                🔥 {formatMetricCount(product.salesCount || 120)} ventes enregistrées
              </span>
              <span className="text-white/20">•</span>
              <span className="text-white/70 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#FF6321]" />
                {product.location || 'Adjamé Forum des Marchés'}
              </span>
            </div>
          </div>

          {/* MASTER PROMOTION TOGGLE CARD */}
          <div className="px-4">
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  isPromotionActive 
                    ? 'bg-[#FF6321]/20 border-[#FF6321]/40 text-[#FF6321]' 
                    : 'bg-white/5 border-white/10 text-white/40'
                }`}>
                  <Megaphone className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-white truncate">
                      Statut de la promotion
                    </span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                      isPromotionActive 
                        ? 'bg-[#FF6321]/20 text-[#FF6321]' 
                        : 'bg-white/10 text-white/50'
                    }`}>
                      {isPromotionActive ? 'ACTIVÉE' : 'DÉSACTIVÉE'}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/50 truncate mt-0.5">
                    {isPromotionActive 
                      ? 'L\'article bénéficie du badge, prix barré et visibilité prioritaire' 
                      : 'L\'article est vendu à son plein tarif de base sans réduction'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={isPromotionActive}
                onClick={() => setIsPromotionActive(!isPromotionActive)}
                className={`w-13 h-7 rounded-full transition-colors relative flex items-center shrink-0 px-1 ${
                  isPromotionActive ? 'bg-[#FF6321]' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                    isPromotionActive ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {isPromotionActive && (
            <>
              {/* DYNAMIC SYNTHESIS CARD: REGLAGE DE LA REMISE (Similar to Variant Synthesis Card) */}
              <div className="px-4 space-y-3">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-1.5">
                      <Percent className="w-4 h-4 text-[#FF6321]" />
                      Niveau de réduction & Tarification
                    </span>
                    
                    {/* Mode Toggle Button */}
                    <div className="flex items-center bg-black/40 p-0.5 rounded-xl border border-white/10 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setPricingMode('percent')}
                        className={`px-2.5 py-1 rounded-lg transition ${
                          pricingMode === 'percent'
                            ? 'bg-[#FF6321] text-white shadow-sm'
                            : 'text-white/60 hover:text-white'
                        }`}
                      >
                        En %
                      </button>
                      <button
                        type="button"
                        onClick={() => setPricingMode('target_price')}
                        className={`px-2.5 py-1 rounded-lg transition ${
                          pricingMode === 'target_price'
                            ? 'bg-[#FF6321] text-white shadow-sm'
                            : 'text-white/60 hover:text-white'
                        }`}
                      >
                        Prix direct FCFA
                      </button>
                    </div>
                  </div>

                  {/* DYNAMIC CARD HIGHLIGHT */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#FF6321]/15 via-black/50 to-emerald-500/10 border border-[#FF6321]/30 shadow-lg space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-white/50 uppercase font-bold">Remise appliquée :</span>
                          <span className="text-base font-black text-[#FF6321]">-{effectiveDiscountPercent}%</span>
                        </div>
                        <p className="text-[10px] text-emerald-400 font-semibold">
                          Le client économise <strong>{formatFCFA(discountAmount)}</strong> sur cet achat
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-white/50 block font-bold">Prix affiché client :</span>
                        <span className="text-sm font-black text-white">{formatFCFA(finalSellingPrice)}</span>
                      </div>
                    </div>

                    {/* Quick percentage buttons */}
                    <div className="pt-2 border-t border-white/10 space-y-1.5">
                      <span className="text-[10px] text-white/60 font-bold uppercase tracking-wider block">
                        Pourcentages recommandés :
                      </span>
                      <div className="grid grid-cols-5 gap-1.5">
                        {PRESET_DISCOUNTS.slice(0, 5).map((pct) => {
                          const isCurrent = effectiveDiscountPercent === pct;
                          return (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => handlePercentChange(pct)}
                              className={`py-1.5 rounded-lg text-xs font-black border transition flex items-center justify-center gap-0.5 ${
                                isCurrent
                                  ? 'bg-[#FF6321] border-[#FF6321] text-white shadow-md shadow-orange-600/30'
                                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                              }`}
                            >
                              <span>-{pct}%</span>
                              {isCurrent && <Check className="w-3 h-3 stroke-[3]" />}
                            </button>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {PRESET_DISCOUNTS.slice(5).map((pct) => {
                          const isCurrent = effectiveDiscountPercent === pct;
                          return (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => handlePercentChange(pct)}
                              className={`py-1.5 rounded-lg text-xs font-black border transition flex items-center justify-center gap-0.5 ${
                                isCurrent
                                  ? 'bg-[#FF6321] border-[#FF6321] text-white shadow-md shadow-orange-600/30'
                                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                              }`}
                            >
                              <span>-{pct}%</span>
                              {isCurrent && <Check className="w-3 h-3 stroke-[3]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Dual Synced Price Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
                      <label className="text-[10px] text-white/50 block font-bold">
                        Prix normal de référence (barré) :
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={500}
                          step={500}
                          value={originalPrice}
                          onChange={(e) => setOriginalPrice(Math.max(500, Number(e.target.value)))}
                          className="w-full bg-transparent text-sm font-black text-white font-mono focus:outline-none"
                        />
                        <span className="text-xs text-white/40 font-mono">FCFA</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-gradient-to-r from-orange-500/10 to-transparent border border-[#FF6321]/40 space-y-1">
                      <label className="text-[10px] text-[#FF6321] block font-bold">
                        Nouveau prix réduit affiché client :
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={100}
                          step={500}
                          value={finalSellingPrice}
                          onChange={(e) => handleTargetPriceChange(Number(e.target.value))}
                          className="w-full bg-transparent text-sm font-black text-[#FF6321] font-mono focus:outline-none"
                        />
                        <span className="text-xs text-[#FF6321] font-mono font-bold">FCFA</span>
                      </div>
                    </div>
                  </div>

                  {/* Slider for exact % fine-tuning */}
                  <div className="space-y-1 pt-1 border-t border-white/10">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-white/60 font-semibold">Ajustement fin du pourcentage :</span>
                      <span className="font-black text-[#FF6321] text-sm">-{effectiveDiscountPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={85}
                      step={1}
                      value={effectiveDiscountPercent}
                      onChange={(e) => handlePercentChange(Number(e.target.value))}
                      className="w-full accent-[#FF6321] cursor-pointer h-2 bg-white/10 rounded-lg"
                    />
                    <div className="flex justify-between text-[9px] text-white/30 font-mono">
                      <span>-5%</span>
                      <span>-25%</span>
                      <span>-50%</span>
                      <span>-85%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: TYPE D'OFFRE & BADGE VISIBLE */}
              <div className="px-4 space-y-3">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#FF6321]/20 border border-[#FF6321]/30 flex items-center justify-center text-[#FF6321]">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-black text-white uppercase tracking-wider">
                          Type d'opération & Badge public
                        </h3>
                        <p className="text-[10px] text-white/50">
                          Sélectionnez le style d'offre mis en avant
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Promo Type Choices */}
                  <div className="space-y-2">
                    {PROMO_TYPES.map((type) => {
                      const isSelected = promoType === type.id;
                      return (
                        <div
                          key={type.id}
                          onClick={() => {
                            setPromoType(type.id);
                            setPromoBadge(type.badgeText);
                            setIsCustomBadge(false);
                          }}
                          className={`p-3 rounded-xl border text-left cursor-pointer transition flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-gradient-to-r from-[#FF6321]/20 to-white/5 border-[#FF6321] ring-1 ring-orange-400/40 shadow-lg'
                              : 'bg-black/30 border-white/10 hover:bg-white/5 text-white/70'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">
                                {type.label}
                              </span>
                              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-white/10 text-white/90">
                                {type.badgeText}
                              </span>
                            </div>
                            <p className="text-[10px] text-white/50 mt-0.5 leading-tight">
                              {type.desc}
                            </p>
                          </div>

                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-[#FF6321] text-white flex items-center justify-center shrink-0 shadow">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Badges List Selection */}
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider block">
                      Badge visible sur l'image du produit :
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {PROMO_BADGES.map((b) => {
                        const isSelected = !isCustomBadge && promoBadge === b;
                        return (
                          <button
                            key={b}
                            type="button"
                            onClick={() => {
                              setPromoBadge(b);
                              setIsCustomBadge(false);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border flex items-center gap-1.5 ${
                              isSelected
                                ? 'bg-[#FF6321] text-white border-[#FF6321] shadow-md shadow-orange-600/30'
                                : 'bg-black/40 border-white/10 text-white/70 hover:bg-white/10'
                            }`}
                          >
                            <span>{b}</span>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: DUREE & LIMITATION */}
              <div className="px-4 space-y-3">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#FF6321]/20 border border-[#FF6321]/30 flex items-center justify-center text-[#FF6321]">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-white uppercase tracking-wider">
                        Durée & Limites de l'offre
                      </h3>
                      <p className="text-[10px] text-white/50">
                        Automatisation de la fin de promotion
                      </p>
                    </div>
                  </div>

                  {/* Durations */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PROMO_DURATIONS.map((dur) => {
                      const isSelected = promoDuration === dur.id;
                      return (
                        <div
                          key={dur.id}
                          onClick={() => setPromoDuration(dur.id)}
                          className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-[#FF6321]/15 border-[#FF6321] text-white shadow-md'
                              : 'bg-black/30 border-white/10 text-white/60 hover:bg-white/5'
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-white block truncate">
                              {dur.label}
                            </span>
                            <span className="text-[10px] text-white/40 block truncate">
                              {dur.desc}
                            </span>
                          </div>

                          {isSelected && (
                            <Check className="w-4 h-4 text-[#FF6321] shrink-0 stroke-[3]" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Stock Quota Toggle */}
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white block">
                          Limiter le nombre d'unités en promotion
                        </span>
                        <span className="text-[10px] text-white/50">
                          {limitStockQuota 
                            ? `Promotion limitée aux ${promoStockQuota} premières pièces vendues` 
                            : 'Promotion valable sur l\'intégralité du stock disponible'}
                        </span>
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={limitStockQuota}
                        onClick={() => setLimitStockQuota(!limitStockQuota)}
                        className={`w-11 h-6 rounded-full transition-colors relative flex items-center shrink-0 px-1 ${
                          limitStockQuota ? 'bg-[#FF6321]' : 'bg-white/20'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform ${
                            limitStockQuota ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {limitStockQuota && (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-black/40 border border-white/10 animate-fadeIn">
                        <span className="text-xs text-white/70 font-bold">Quota d'unités :</span>
                        <input
                          type="number"
                          min={1}
                          max={product.stock}
                          value={promoStockQuota}
                          onChange={(e) => setPromoStockQuota(Math.max(1, Math.min(product.stock, Number(e.target.value))))}
                          className="w-20 px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-xs text-white font-mono font-bold text-center outline-none focus:border-[#FF6321]"
                        />
                        <span className="text-[11px] text-white/50">sur {product.stock} pièces en stock</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* STICKY BOTTOM ACTION BAR (Identical to ProductDetailModal layout & design) */}
        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 border-t border-white/10 bg-[#121212]/95 backdrop-blur-xl flex items-center gap-2.5 pb-safe z-30 shadow-2xl">
          {product.isPromotion && (
            <button 
              type="button"
              onClick={handleDeactivate} 
              className="p-3.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition active:scale-95 flex flex-col items-center justify-center shrink-0"
              title="Désactiver et retirer la promotion"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}

          <button 
            type="button"
            onClick={onClose}
            className="py-3.5 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-extrabold text-xs transition active:scale-95 flex items-center justify-center border border-white/10 shrink-0"
          >
            <span>Annuler</span>
          </button>

          <button 
            type="button"
            id="btn-save-product-promotion"
            onClick={handleSave}
            className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#FF6321] to-[#ff7d45] hover:opacity-95 text-white font-black text-xs transition active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30 uppercase tracking-wider"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>
              {isPromotionActive 
                ? `Appliquer la promo (-${effectiveDiscountPercent}%)` 
                : 'Enregistrer'}
            </span>
            <ChevronRight className="w-4 h-4 stroke-[3]" />
          </button>
        </div>
      </div>
    </div>
  );
};
