import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Product } from '../../../types';
import {
  Video as VideoIcon,
  Upload,
  Sparkles,
  ShoppingBag,
  Plus,
  Trash2,
  Image as ImageIcon,
  Star,
  X,
  Check,
  Truck,
  ShieldCheck,
  Layers,
  AlertCircle,
  Flame,
  Clock,
  CreditCard,
  ChevronRight,
  Minus,
  SlidersHorizontal,
  Play,
  Film,
  Music,
  MapPin,
  MessageCircle,
  Ruler,
  RefreshCw,
  Camera,
  Tag,
  Package,
} from 'lucide-react';
import { formatFCFA } from '../../../services/marketServices';
import { VariantItem } from './VariantsManager';
import { CategorySelectModal, CATEGORIES_CATALOG, getCategoryIconHelper } from './CategorySelectModal';
import { ReturnPolicyModal } from './ReturnPolicyModal';
import { ItemConditionModal } from './ItemConditionModal';
import { useApp } from '../../../context/AppContext';

export const CATEGORIES = CATEGORIES_CATALOG.map((c) => c.name);

const PRESETS = [
  {
    label: '👗 Vêtements (S, M, L, XL, XXL)',
    type: 'Taille',
    options: ['S', 'M', 'L', 'XL', 'XXL'],
    stocks: { S: 4, M: 8, L: 6, XL: 4, XXL: 2 },
  },
  {
    label: '👟 Chaussures (39 à 44)',
    type: 'Pointure',
    options: ['39', '40', '41', '42', '43', '44'],
    stocks: { '39': 2, '40': 4, '41': 6, '42': 5, '43': 3, '44': 2 },
  },
];

const SAMPLE_DEMO_VIDEOS = [
  'https://assets.mixkit.co/videos/preview/mixkit-woman-shopping-for-clothes-in-a-store-41549-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-holding-a-modern-smartphone-with-a-blank-green-screen-42984-large.mp4',
];

const SAMPLE_DEMO_IMAGES = [
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&auto=format&fit=crop&q=80',
];

const SUGGESTED_TAGS = [
  '#Nouveauté',
  '#QualitéGarantie',
  '#PromoAdjamé',
  '#ReelAbidjan',
  '#Tendance2026',
  '#LivraisonRapide',
  '#ModeIvoirienne',
  '#StockLimité',
];

const PITCH_TEMPLATES = [
  '🔥 Arrivage direct en boutique ! Admirez les détails en vidéo : produit 100% original de qualité supérieure, vérifié au Marché d’Adjamé. Livraison ultra rapide partout à Abidjan sous 24h avec paiement sécurisé (Wave, Orange Money ou à la livraison). Satisfait ou remboursé sous 3 jours !',
  '✨ Modèle haut de gamme très tendance présenté dans ce Reel. Finitions soignées, matière durable et confort garanti. Stock très limité disponible en magasin, commandez dès maintenant pour réserver votre taille.',
  '⚡ Super promotion de la semaine vue en vidéo ! Article neuf sous emballage d’origine avec garantie boutique. Livraison organisée directement par votre boutique.',
];

const MOCK_REVIEWS_PREVIEW = [
  {
    id: 'rev-1',
    author: 'Aminata K.',
    location: 'Cocody Angré',
    rating: 5,
    comment: 'Exactement conforme à la vidéo ! Le tissu wax est épais et très bien taillé. Livré rapidement par la boutique.',
  },
  {
    id: 'rev-2',
    author: 'Ibrahim S.',
    location: 'Marcory Zone 4',
    rating: 5,
    comment: 'Superbe produit, le rendu réel est identique à ce qu’on voit sur le Reel. Vendeur très sérieux !',
  },
];

interface Props {
  products?: Product[];
  // Video state
  videoUrl: string;
  onSetVideoUrl: (url: string) => void;
  // Media photos state
  mediaUrls: string[];
  coverIndex: number;
  onAddMedia: (url: string) => void;
  onRemoveMedia: (idx: number) => void;
  onSetCover: (idx: number) => void;
  // Product details
  name: string;
  onChangeName: (val: string) => void;
  price: string;
  onChangePrice: (val: string) => void;
  originalPrice?: string;
  onChangeOriginalPrice?: (val: string) => void;
  category: string;
  onChangeCategory: (val: string) => void;
  location?: string;
  onChangeLocation?: (val: string) => void;
  description: string;
  onChangeDescription: (val: string) => void;
  // Variants with sizes & remaining stock
  variants: VariantItem[];
  setVariants: React.Dispatch<React.SetStateAction<VariantItem[]>>;
  variantStock: Record<string, number>;
  setVariantStock: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  variantImages: Record<string, string[]>;
  setVariantImages: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  // Logistics & Useful info
  deliveryMode: string;
  onChangeDeliveryMode: (val: string) => void;
  deliveryFee: string;
  onChangeDeliveryFee: (val: string) => void;
  returnPolicy: string;
  onChangeReturnPolicy: (val: string) => void;
  acceptedPayments?: string[];
  onTogglePayment?: (method: string) => void;
  itemCondition?: string;
  onChangeItemCondition?: (val: string) => void;
  // Reel specific info (optional)
  selectedProductId?: string;
  onSelectProduct?: (id: string) => void;
  videoCaption?: string;
  onChangeCaption?: (c: string) => void;
  soundTitle?: string;
  onChangeSound?: (s: string) => void;
  tags: string[];
  onToggleTag: (t: string) => void;
  specs?: Record<string, string>;
  onChangeSpecs?: (specs: Record<string, string>) => void;
}

export const VideoShowcaseForm: React.FC<Props> = ({
  products = [],
  videoUrl,
  onSetVideoUrl,
  mediaUrls,
  coverIndex,
  onAddMedia,
  onRemoveMedia,
  onSetCover,
  name,
  onChangeName,
  price,
  onChangePrice,
  originalPrice = '',
  onChangeOriginalPrice = () => {},
  category,
  onChangeCategory,
  location = 'Marché d’Adjamé',
  onChangeLocation = () => {},
  description,
  onChangeDescription,
  variants,
  setVariants,
  variantStock,
  setVariantStock,
  variantImages,
  setVariantImages,
  deliveryMode = 'Gérée par la boutique (externe)',
  onChangeDeliveryMode = () => {},
  deliveryFee = '0',
  onChangeDeliveryFee = () => {},
  returnPolicy,
  onChangeReturnPolicy,
  acceptedPayments = ['Wave', 'Orange Money', 'Paiement à la livraison'],
  onTogglePayment = () => {},
  itemCondition = "Neuf sous emballage d'origine",
  onChangeItemCondition = () => {},
  selectedProductId,
  onSelectProduct,
  videoCaption = '',
  onChangeCaption = () => {},
  soundTitle = 'DJ Arafat - Moto Moto (Son original)',
  onChangeSound = () => {},
  tags,
  onToggleTag,
}) => {
  const { sellers, currentSellerId, openAiVideoModal } = useApp();
  const currentSeller = useMemo(() => {
    return sellers.find((s) => s.id === currentSellerId) || sellers[0] || {
      storeName: 'Boutique Wax & Élégance',
      name: 'Vendeur Pro',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      location: 'Adjamé Forum des Marchés',
      verified: true,
    };
  }, [sellers, currentSellerId]);

  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const variantPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const [creationMode, setCreationMode] = useState<'new' | 'link'>(
    selectedProductId ? 'link' : 'new'
  );
  const [showVideo, setShowVideo] = useState<boolean>(true);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);
  const [currentTargetOption, setCurrentTargetOption] = useState<string>('');
  const [customOptionInput, setCustomOptionInput] = useState('');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isReturnPolicyModalOpen, setIsReturnPolicyModalOpen] = useState(false);
  const [isItemConditionModalOpen, setIsItemConditionModalOpen] = useState(false);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  const [detailTab, setDetailTab] = useState<'description' | 'specs' | 'reviews' | 'warranty'>('description');
  const [targetPhotoSlot, setTargetPhotoSlot] = useState<number>(0);

  // Default to showing video if available, else show photos
  useEffect(() => {
    if (videoUrl) {
      setShowVideo(true);
    } else if (mediaUrls.length > 0) {
      setShowVideo(false);
    }
  }, [videoUrl]);

  // Price calculations
  const numPrice = Number(price) || 0;
  const numOriginal = Number(originalPrice) || 0;
  const discountAmount = numOriginal > numPrice && numPrice > 0 ? numOriginal - numPrice : 0;
  const discountPercent =
    numOriginal > numPrice && numPrice > 0
      ? Math.round(((numOriginal - numPrice) / numOriginal) * 100)
      : 0;

  // Options & Variants calculations (strictly deduplicated)
  const allOptions = Array.from(new Set(variants.flatMap((v) => v.options)));
  const totalStockCount = Object.values(variantStock).reduce(
    (acc, val) => acc + (Number(val) || 0),
    0
  );

  const activeHeroImage =
    mediaUrls[activePhotoIndex] || mediaUrls[coverIndex] || mediaUrls[0] || SAMPLE_DEMO_IMAGES[0];

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onSetVideoUrl(url);
      setShowVideo(true);
    }
    e.target.value = '';
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const url = URL.createObjectURL(files[i]);
        onAddMedia(url);
      }
    }
    e.target.value = '';
  };

  const handleUseDemo = () => {
    onSetVideoUrl(SAMPLE_DEMO_VIDEOS[0]);
    setShowVideo(true);
    SAMPLE_DEMO_IMAGES.forEach((url) => {
      if (!mediaUrls.includes(url)) {
        onAddMedia(url);
      }
    });
    if (!name) onChangeName('Robe Wax Moderne Africaine Stylée');
    if (!price) onChangePrice('18500');
    if (!originalPrice) onChangeOriginalPrice('25000');
    if (!videoCaption) onChangeCaption('🔥 Nouveau arrivage chic ! Robe wax taillée sur mesure #Mode #Abidjan');
    if (allOptions.length === 0) {
      applyPreset(PRESETS[0]);
    }
    if (!description) {
      onChangeDescription(
        'Magnifique ensemble robe wax taillée sur mesure, tissu 100% coton véritable Uniwax. Idéale pour vos cérémonies et sorties chics à Abidjan.'
      );
    }
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setVariants([{ type: preset.type as any, options: [...preset.options] }]);
    setVariantStock({ ...preset.stocks });
  };

  const adjustStock = (option: string, delta: number) => {
    setVariantStock((prev) => {
      const current = prev[option] ?? 0;
      const updated = Math.max(0, current + delta);
      return { ...prev, [option]: updated };
    });
  };

  const setStockDirect = (option: string, val: number) => {
    setVariantStock((prev) => ({
      ...prev,
      [option]: Math.max(0, val),
    }));
  };

  const addCustomOption = () => {
    const trimmed = customOptionInput.trim();
    if (!trimmed) return;

    setVariants((prev) => {
      if (prev.length === 0) {
        return [{ type: 'Taille', options: [trimmed] }];
      }
      const existing = prev[0].options;
      if (existing.includes(trimmed)) return prev;
      return [
        {
          ...prev[0],
          options: [...existing, trimmed],
        },
      ];
    });

    setVariantStock((prev) => ({
      ...prev,
      [trimmed]: 5,
    }));

    setCustomOptionInput('');
  };

  const removeOption = (option: string) => {
    setVariants((prev) =>
      prev.map((v) => ({
        ...v,
        options: v.options.filter((o) => o !== option),
      }))
    );
    setVariantStock((prev) => {
      const copy = { ...prev };
      delete copy[option];
      return copy;
    });
  };

  const handleSwitchVariantImages = (option: string) => {
    setVariantImages((prev: any) => {
      const list = prev[option] || [];
      if (list.length < 2) return prev;
      return {
        ...prev,
        [option]: [list[1], list[0], ...list.slice(2)],
      };
    });
  };

  const handleSetVariantImage = (option: string, url: string, slot: number = 0) => {
    setVariantImages((prev: any) => {
      const list = [...(prev[option] || [])];
      if (slot === 1) {
        if (list.length === 0) list.push(url);
        else list[1] = url;
      } else {
        if (list.length === 0) list.push(url);
        else list[0] = url;
      }
      return {
        ...prev,
        [option]: list.slice(0, 2),
      };
    });
  };

  const handleVariantPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && currentTargetOption) {
      const url = URL.createObjectURL(files[0]);
      handleSetVariantImage(currentTargetOption, url, targetPhotoSlot);
      if (!mediaUrls.includes(url)) {
        onAddMedia(url);
      }
    }
    e.target.value = '';
    setCurrentTargetOption('');
  };

  const generatePitch = () => {
    const randomPitch = PITCH_TEMPLATES[Math.floor(Math.random() * PITCH_TEMPLATES.length)];
    onChangeDescription(randomPitch);
  };

  const handleSelectExistingProduct = (prod: Product) => {
    if (onSelectProduct) onSelectProduct(prod.id);
    onChangeName(prod.name);
    onChangePrice(String(prod.price));
    if (prod.originalPrice) onChangeOriginalPrice(String(prod.originalPrice));
    if (prod.category) onChangeCategory(prod.category);
    if (prod.location) onChangeLocation(prod.location);
    if (prod.description) onChangeDescription(prod.description);
    if (prod.images && prod.images.length > 0) {
      prod.images.forEach((img) => onAddMedia(img));
    }
    if (prod.variants && prod.variants.length > 0) {
      setVariants(prod.variants);
    }
    if (prod.variantStock) {
      setVariantStock(prod.variantStock);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Hidden file inputs */}
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={handleVideoFileChange}
      />
      <input
        ref={photoInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handlePhotoFileChange}
      />
      <input
        ref={variantPhotoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleVariantPhotoUpload}
      />

      {/* ========================================================================= */}
      {/* SÉLECTEUR DE MODE REEL (Nouveau produit OU Lier à un article existant) */}
      {/* ========================================================================= */}
      {products.length > 0 && (
        <div className="p-1 rounded-2xl bg-white/5 border border-white/10 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setCreationMode('new')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              creationMode === 'new'
                ? 'bg-[#FF6321] text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Nouveau produit Reel</span>
          </button>

          <button
            type="button"
            onClick={() => setCreationMode('link')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              creationMode === 'link'
                ? 'bg-[#FF6321] text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Lier à un article boutique</span>
          </button>
        </div>
      )}

      {/* SÉLECTION RAPIDE SI MODE LIER */}
      {creationMode === 'link' && products.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-neutral-900 border border-white/10 space-y-2">
          <span className="text-[11px] font-bold text-white/70 block">
            Choisissez l’article auquel rattacher ce Reel :
          </span>
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
            {products.map((p) => {
              const isSelected = selectedProductId === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectExistingProduct(p)}
                  className={`p-2 rounded-xl border flex items-center gap-2.5 shrink-0 cursor-pointer transition ${
                    isSelected
                      ? 'border-[#FF6321] bg-[#FF6321]/15 text-white shadow-md'
                      : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <img
                    src={p.images?.[0] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100'}
                    alt={p.name}
                    className="w-9 h-9 rounded-lg object-cover"
                  />
                  <div>
                    <span className="text-xs font-bold block line-clamp-1 max-w-[130px]">
                      {p.name}
                    </span>
                    <span className="text-[10px] text-[#FF6321] font-black">
                      {formatFCFA(p.price)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HERO SECTION INSPIRÉE DE LA PAGE DU CLIENT ("VOIR PRODUIT") AVEC REEL VIDÉO */}
      {/* ========================================================================= */}
      <div className="relative aspect-[4/3] w-full bg-neutral-900 rounded-3xl border border-white/10 overflow-hidden shadow-2xl transition-all">
        {/* LECTEUR VIDÉO OU PHOTO EN HERO */}
        {showVideo && videoUrl ? (
          <video
            src={videoUrl}
            controls
            autoPlay
            loop
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={activeHeroImage}
            alt={name || 'Aperçu du Reel'}
            className="w-full h-full object-cover transition duration-300"
          />
        )}

        {/* Ambient Dark Gradient Bottom for Thumbnails readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/30 pointer-events-none" />

        {/* TOP-LEFT FLOATING OVERLAYS (Structured vertical flex column without overlap) */}
        <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1.5 pointer-events-none max-w-[70%]">
          {discountPercent > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-rose-500/90 backdrop-blur-md text-white font-black text-xs shadow-lg flex items-center gap-1 shrink-0 animate-pulse">
              <Tag className="w-3 h-3" /> -{discountPercent}% PROMO
            </span>
          )}

          <div className="px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white shadow-xl flex items-center gap-1.5 text-[10px] font-bold shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#FF6321] animate-pulse" />
            <span>
              Vidéo Reel •{' '}
              <span className="text-emerald-400 font-black">
                {totalStockCount > 0 ? `${totalStockCount} en stock` : 'Prêt à expédier'}
              </span>
            </span>
          </div>
        </div>

        {/* TOP-RIGHT FLOATING CONTROLS (Bouton bascule Photo/Vidéo identique au client) */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          {videoUrl && (
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

          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            className="px-2.5 py-1 rounded-full bg-[#FF6321] hover:bg-[#ff7539] text-white text-[10px] font-black backdrop-blur-md shadow-lg flex items-center gap-1 transition active:scale-95"
            title="Uploader une vidéo Reel"
          >
            <Upload className="w-3 h-3" />
            <span>+ Vidéo Reel</span>
          </button>

          <button
            type="button"
            onClick={() => {
              openAiVideoModal({
                name: name || 'Produit Vendeur',
                prompt: `Présentation vidéo dynamique 5s de ${name || 'ce produit'}, vue à 360 degrés et lumière cinématographique`,
                image: activeHeroImage
              });
            }}
            className="px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-600 to-amber-500 hover:opacity-95 text-white text-[10px] font-black backdrop-blur-md shadow-lg flex items-center gap-1 transition active:scale-95"
            title="Générer une vidéo de 5s avec RodiumAI (60 crédits)"
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>IA Vidéo 5s (60 cr)</span>
          </button>
        </div>

        {/* BOTTOM THUMBNAIL GALLERY STRIP (Avec tuile Vidéo + Photos) */}
        <div className="absolute bottom-3 left-0 right-0 px-3 z-10 flex items-center justify-center gap-2 overflow-x-auto no-scrollbar py-1">
          {/* Tuile Vidéo Reel */}
          {videoUrl ? (
            <div
              onClick={() => setShowVideo(true)}
              className={`relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition shadow-md cursor-pointer ${
                showVideo
                  ? 'border-[#FF6321] scale-105 ring-2 ring-[#FF6321]/40'
                  : 'border-white/20 opacity-80 hover:opacity-100'
              }`}
              title="Aperçu de la vidéo Reel"
            >
              <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
                <Play className="w-5 h-5 text-[#FF6321] fill-current" />
              </div>
              <div className="absolute bottom-0 inset-x-0 bg-black/80 text-[7px] text-[#FF6321] font-black text-center truncate px-0.5">
                Vidéo
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="w-12 h-12 rounded-xl border-2 border-dashed border-[#FF6321]/60 hover:border-[#FF6321] bg-black/50 hover:bg-[#FF6321]/20 flex flex-col items-center justify-center gap-0.5 text-white/80 hover:text-white transition shrink-0"
              title="Ajouter une vidéo Reel"
            >
              <VideoIcon className="w-4 h-4 text-[#FF6321]" />
              <span className="text-[7px] font-black">+ Vidéo</span>
            </button>
          )}

          {/* Photos associées */}
          {mediaUrls.map((img, i) => {
            const isCover = i === coverIndex;
            const isActive = !showVideo && i === activePhotoIndex;
            return (
              <div
                key={i}
                onClick={() => {
                  setShowVideo(false);
                  setActivePhotoIndex(i);
                }}
                className={`group relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition shadow-md cursor-pointer ${
                  isActive
                    ? 'border-[#FF6321] scale-105 ring-2 ring-[#FF6321]/40'
                    : isCover
                    ? 'border-emerald-400/80 opacity-90'
                    : 'border-white/20 opacity-70 hover:opacity-100'
                }`}
                title={isCover ? 'Photo de couverture' : `Photo ${i + 1}`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
                {isCover && (
                  <div className="absolute top-0.5 left-0.5 bg-[#FF6321] text-white p-0.5 rounded shadow">
                    <Star className="w-2.5 h-2.5 fill-current" />
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 bg-black/80 text-[7px] text-white font-bold text-center truncate px-0.5">
                  {isCover ? 'Couverture' : `P${i + 1}`}
                </div>

                {/* Bouton supprimer */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveMedia(i);
                  }}
                  className="absolute inset-0 bg-rose-900/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  title="Supprimer cette photo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}

          {/* Quick upload photo in carousel */}
          {mediaUrls.length < 8 && (
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="w-12 h-12 rounded-xl border-2 border-dashed border-white/30 hover:border-[#FF6321] bg-black/50 hover:bg-[#FF6321]/20 flex flex-col items-center justify-center gap-0.5 text-white/60 hover:text-white transition shrink-0"
              title="Ajouter une photo supplémentaire"
            >
              <Plus className="w-3.5 h-3.5 text-[#FF6321]" />
              <span className="text-[8px] font-bold">+ Photo</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TARIFICATION & IDENTITÉ PRODUIT (Design inspiré de ProductDetailModal) */}
      {/* ========================================================================= */}
      <div className="p-4 rounded-3xl bg-white/[0.03] border border-white/10 space-y-3.5">
        {/* Prix principal & stock en temps réel */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <div className="flex items-center bg-white/5 px-3 py-1.5 rounded-2xl border border-white/10 focus-within:border-[#FF6321] transition">
              <input
                type="number"
                min="0"
                required
                value={price}
                onChange={(e) => onChangePrice(e.target.value)}
                placeholder="15000"
                className="text-2xl sm:text-3xl font-black text-[#FF6321] bg-transparent focus:outline-none w-28 sm:w-36 tracking-tight placeholder-orange-400/30"
              />
              <span className="text-xl sm:text-2xl font-black text-[#FF6321]">FCFA</span>
            </div>

            {/* Prix d'origine barré pour réduction */}
            <div className="flex items-center gap-1.5 bg-black/30 px-2.5 py-1.5 rounded-xl border border-white/10">
              <span className="text-[10px] text-white/40 font-bold">Barré :</span>
              <input
                type="number"
                min="0"
                value={originalPrice}
                onChange={(e) => onChangeOriginalPrice(e.target.value)}
                placeholder="20000"
                className="text-xs text-white/50 line-through bg-transparent focus:outline-none w-16"
              />
            </div>

            {discountAmount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Économisez {formatFCFA(discountAmount)}
              </span>
            )}
          </div>

          {/* Badge Stock global en magasin */}
          <div className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-black text-xs flex items-center gap-1.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>En stock ({totalStockCount || 10})</span>
          </div>
        </div>

        {/* Titre du produit */}
        <div>
          <label className="text-[10px] uppercase font-bold text-white/50 block mb-1">
            Titre de l'article visible par les clients *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => onChangeName(e.target.value)}
            placeholder="Ex: Robe Wax Moderne Africaine Stylée, Baskets Air Force..."
            className="w-full text-base sm:text-lg font-black text-white bg-white/5 p-3 rounded-2xl border border-white/10 placeholder-white/30 focus:outline-none focus:border-[#FF6321] transition"
          />
        </div>

        {/* Section Catégorie du produit (Demandée sous le titre) */}
        <div>
          <label className="text-[10px] uppercase font-bold text-white/50 block mb-1">
            Catégorie du produit *
          </label>
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="w-full p-3 rounded-2xl bg-white/5 hover:bg-white/[0.08] border border-white/10 hover:border-[#FF6321]/60 text-left transition flex items-center justify-between group shadow-sm"
          >
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <span className="text-xl shrink-0 p-1.5 rounded-xl bg-white/5 border border-white/10">
                {getCategoryIconHelper(category)}
              </span>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-black text-white truncate block">
                  {category || 'Mode & Vêtements'}
                </span>
                {selectedSubcategory ? (
                  <span className="text-[11px] text-[#FF6321] font-bold block truncate">
                    › {selectedSubcategory}
                  </span>
                ) : (
                  <span className="text-[10px] text-white/40 block truncate">
                    Cliquez pour choisir une catégorie
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 text-white/40 group-hover:text-white transition">
              <span className="text-xs font-bold text-[#FF6321]">Modifier</span>
              <ChevronRight className="w-4 h-4 text-[#FF6321]" />
            </div>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION OPTIONS & VARIANTES (Exactement identique à ProductDetailModal) */}
      {/* ========================================================================= */}
      <div className="p-4 rounded-3xl bg-white/[0.03] border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-wider text-white">
            Options & Variantes
          </span>
          <span className="text-[10px] text-white/50">
            Personnalisez vos tailles et stocks en magasin
          </span>
        </div>

        {/* CARTE DE SYNTHÈSE DYNAMIQUE DU PRODUIT (Inspirée de ProductDetailModal) */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#FF6321]/15 via-black/50 to-emerald-500/10 border border-[#FF6321]/30 shadow-lg space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl overflow-hidden border border-white/20 shrink-0 bg-neutral-800 shadow-sm">
                <img
                  src={activeHeroImage}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/50 uppercase font-bold">Article actif :</span>
                  <span className="text-xs font-black text-[#FF6321]">{name || 'Modèle standard'}</span>
                </div>
                <p className="text-[10px] text-white/70">
                  Stock total prêt à expédier :{' '}
                  <span className="font-bold text-emerald-400">
                    {totalStockCount > 0 ? `${totalStockCount} pièces` : '10 pièces'}
                  </span>
                </p>
              </div>
            </div>

            <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
              <Check className="w-3 h-3 stroke-[3]" />
              <span>En stock & Prêt à expédier</span>
            </span>
          </div>

          {/* Tailles actives disponibles */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-white/10">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-white/60 font-bold uppercase tracking-wider">
                Tailles en magasin :
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {allOptions.length > 0 ? (
                  allOptions.map((sz, szIdx) => {
                    const cnt = variantStock[sz] ?? 0;
                    return (
                      <span
                        key={`showcase-sz-${sz}-${szIdx}`}
                        className={`text-[10px] font-black px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                          cnt > 0
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border-rose-500/30 line-through'
                        }`}
                      >
                        <span>{sz}</span>
                        <span>({cnt})</span>
                      </span>
                    );
                  })
                ) : (
                  <span className="text-[11px] text-emerald-400 font-bold">Taille unique (Standard)</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Préréglages rapides en 1 clic */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-white/60 block">
            Préréglages rapides en 1 clic :
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => applyPreset(p)}
                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#FF6321]/40 text-[11px] font-bold text-white transition flex items-center gap-1 active:scale-95"
              >
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Liste des tailles avec boutons de stock interactifs */}
        <div className="space-y-2 pt-1">
          {allOptions.length === 0 ? (
            <div className="p-4 rounded-2xl bg-black/20 border border-dashed border-white/10 text-center">
              <p className="text-xs text-white/50">
                Aucune taille ou variante configurée pour le moment.
              </p>
              <p className="text-[10px] text-white/40 mt-1">
                Choisissez un préréglage ci-dessus ou ajoutez vos tailles personnalisées.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {allOptions.map((option) => {
                const count = variantStock[option] ?? 5;
                const isOut = count <= 0;
                const isLow = count > 0 && count <= 2;
                const images = variantImages[option] || [];

                return (
                  <div
                    key={option}
                    className="p-3 rounded-2xl bg-black/40 border border-white/10 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 hover:border-white/20 transition"
                  >
                    {/* Taille pill */}
                    <div className="flex items-center gap-2 min-w-[130px]">
                      <span className="w-9 h-9 rounded-xl bg-[#FF6321]/15 text-[#FF6321] border border-[#FF6321]/30 font-black text-xs flex items-center justify-center shrink-0">
                        {option}
                      </span>
                      <div>
                        <span className="text-xs font-bold text-white block">
                          Taille {option}
                        </span>
                        <span
                          className={`text-[9px] font-bold flex items-center gap-1 ${
                            isOut
                              ? 'text-rose-400'
                              : isLow
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {isOut ? (
                            '⚠️ Épuisé'
                          ) : isLow ? (
                            <>
                              <Flame className="w-3 h-3 text-amber-400" />
                              Stock limité ({count} restant{count > 1 ? 's' : ''})
                            </>
                          ) : (
                            `✓ ${count} restants en magasin`
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Stepper stock */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-white/50 hidden sm:inline">
                        Nombre qui reste :
                      </span>
                      <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1">
                        <button
                          type="button"
                          onClick={() => adjustStock(option, -1)}
                          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-black text-sm flex items-center justify-center transition active:scale-95"
                          title="Diminuer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={count}
                          onChange={(e) =>
                            setStockDirect(option, parseInt(e.target.value) || 0)
                          }
                          className="w-12 text-center bg-transparent text-xs font-black text-white focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => adjustStock(option, 1)}
                          className="w-7 h-7 rounded-lg bg-[#FF6321] hover:bg-[#ff7539] text-white font-black text-sm flex items-center justify-center transition active:scale-95 shadow-sm shadow-orange-500/30"
                          title="Augmenter"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Photos de la taille & boutons */}
                    <div className="flex items-center gap-2 bg-black/40 px-2.5 py-1.5 rounded-xl border border-white/10 shrink-0">
                      {images.length >= 2 ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={images[0]}
                            alt={`${option} photo 1`}
                            className="w-8 h-8 rounded-lg object-cover border-2 border-emerald-400 shadow"
                          />
                          <img
                            src={images[1]}
                            alt={`${option} photo 2`}
                            onClick={() => handleSwitchVariantImages(option)}
                            className="w-8 h-8 rounded-lg object-cover border-2 border-white/20 hover:border-[#FF6321] shadow cursor-pointer hover:scale-105 transition opacity-80"
                            title="Basculer entre les photos"
                          />
                          <button
                            type="button"
                            onClick={() => handleSwitchVariantImages(option)}
                            className="px-2 py-1 rounded-lg bg-[#FF6321]/20 hover:bg-[#FF6321] text-[#FF6321] hover:text-white border border-[#FF6321]/40 text-[10px] font-black flex items-center gap-1 transition active:scale-95"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>P1 ⇄ P2</span>
                          </button>
                        </div>
                      ) : images.length === 1 ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={images[0]}
                            alt=""
                            className="w-8 h-8 rounded-lg object-cover border-2 border-emerald-400 shadow"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentTargetOption(option);
                              setTargetPhotoSlot(1);
                              variantPhotoInputRef.current?.click();
                            }}
                            className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-dashed border-white/20 text-white/70 text-[10px] font-bold flex items-center gap-1 transition"
                          >
                            <Plus className="w-3 h-3 text-[#FF6321]" />
                            <span>+ Photo 2</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentTargetOption(option);
                            setTargetPhotoSlot(0);
                            variantPhotoInputRef.current?.click();
                          }}
                          className="px-2.5 py-1 rounded-xl border border-dashed border-white/20 hover:border-[#FF6321] bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[10px] font-bold flex items-center gap-1 transition"
                        >
                          <Camera className="w-3 h-3 text-[#FF6321]" />
                          <span>+ Photos</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => removeOption(option)}
                        className="p-1.5 rounded-xl text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition ml-1"
                        title="Supprimer cette option"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Ajouter une nouvelle taille */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="text"
              value={customOptionInput}
              onChange={(e) => setCustomOptionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomOption();
                }
              }}
              placeholder="Ajouter une autre taille (ex: 3XL, 46, Rose S...)"
              className="flex-1 p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
            />
            <button
              type="button"
              onClick={addCustomOption}
              className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-[#FF6321] text-white text-xs font-bold transition flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ONGLETS INTERACTIFS (Description | Caractéristiques | Remboursement)      */}
      {/* ========================================================================= */}
      <div className="p-4 rounded-3xl bg-white/[0.03] border border-white/10 space-y-4">
        {/* Navigation des Onglets (Design capsules tactiles avec icônes en relief) */}
        <div className="p-1.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {/* 1. Description */}
          <button
            type="button"
            onClick={() => setDetailTab('description')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 whitespace-nowrap group ${
              detailTab === 'description'
                ? 'bg-[#FF6321] text-white shadow-md shadow-orange-600/25 font-black'
                : 'text-white/60 hover:text-white hover:bg-white/5 font-bold'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className={`w-4 h-4 filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] transition-transform group-hover:scale-110 ${
                detailTab === 'description' ? 'fill-white' : 'fill-none stroke-current stroke-[2]'
              }`}
            >
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span>Description</span>
          </button>

          {/* 2. Caractéristiques */}
          <button
            type="button"
            onClick={() => setDetailTab('specs')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 whitespace-nowrap group ${
              detailTab === 'specs'
                ? 'bg-[#FF6321] text-white shadow-md shadow-orange-600/25 font-black'
                : 'text-white/60 hover:text-white hover:bg-white/5 font-bold'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className={`w-4 h-4 filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] transition-transform group-hover:scale-110 ${
                detailTab === 'specs' ? 'fill-white' : 'fill-none stroke-current stroke-[2]'
              }`}
            >
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            <span>Caractéristiques</span>
          </button>

          {/* 3. Conditions de remboursement */}
          <button
            type="button"
            onClick={() => setDetailTab('warranty')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 whitespace-nowrap group ${
              detailTab === 'warranty'
                ? 'bg-[#FF6321] text-white shadow-md shadow-orange-600/25 font-black'
                : 'text-white/60 hover:text-white hover:bg-white/5 font-bold'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className={`w-4 h-4 filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] transition-transform group-hover:scale-110 ${
                detailTab === 'warranty' ? 'fill-white' : 'fill-none stroke-current stroke-[2]'
              }`}
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
            <span>Conditions de remboursement</span>
          </button>
        </div>

        {/* CONTENU ONGLETS */}
        {detailTab === 'description' && (
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-white/80 block mb-1.5">
                Texte descriptif de l'article en vidéo
              </label>
            </div>

            <textarea
              rows={4}
              value={description}
              onChange={(e) => onChangeDescription(e.target.value)}
              placeholder="Admirez en vidéo cet ensemble robe wax taillée sur mesure, tissu 100% coton véritable Uniwax. Idéale pour vos cérémonies et sorties chics à Abidjan."
              className="w-full p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321] no-scrollbar leading-relaxed"
            />
          </div>
        )}

        {detailTab === 'specs' && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs text-white/70">
                <span className="font-bold">Fiche technique de la vidéo</span>
                <span className="text-[10px] text-white/50">Détails, matière, confection</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs">
                  <span className="text-white/60">Type d'article</span>
                  <span className="font-bold text-white">{category}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs">
                  <span className="text-white/60">Conditionnement</span>
                  <span className="font-bold text-emerald-400">Prêt à expédier</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs">
                  <span className="text-white/60">Origine</span>
                  <span className="font-bold text-white">Côte d'Ivoire (Marché Adjamé) 🇨🇮</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {detailTab === 'warranty' && (
          <div className="space-y-3">
            {/* Politique d'échange */}
            <div>
              <label className="text-[11px] font-bold text-white/80 block mb-1">
                Garantie & Politique d'échange
              </label>
              <button
                type="button"
                onClick={() => setIsReturnPolicyModalOpen(true)}
                className="w-full p-3 rounded-2xl bg-neutral-900 border border-white/10 hover:border-[#FF6321]/50 text-left transition flex items-center justify-between group"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span className="text-sm shrink-0">📦</span>
                  <span className="text-xs font-bold text-white truncate">
                    {returnPolicy || 'Garantie 3 jours échange / remboursement'}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-white/40 group-hover:text-white transition">
                  <span className="text-[10px] text-white/40 group-hover:text-[#FF6321] transition">Modifier</span>
                  <ChevronRight className="w-4 h-4 text-white/50 group-hover:text-[#FF6321] transition" />
                </div>
              </button>
            </div>

            {/* Moyens de paiement acceptés */}
            <div>
              <label className="text-[11px] font-bold text-white/80 block mb-1.5">
                Moyens de paiement acceptés pour cette vidéo Reel :
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'Wave', label: 'Wave 🌊' },
                  { id: 'Orange Money', label: 'Orange Money 🍊' },
                  { id: 'Paiement à la livraison', label: 'Paiement à la livraison 💵' },
                ].map((m) => {
                  const isChecked = acceptedPayments.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onTogglePayment(m.id)}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 ${
                        isChecked
                          ? 'bg-white/15 text-white border-white/30 shadow-sm'
                          : 'bg-white/5 text-white/40 border-white/5 hover:text-white'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${
                        isChecked ? 'bg-emerald-400 text-black font-black' : 'border border-white/30'
                      }`}>
                        {isChecked && '✓'}
                      </span>
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modales pour Catégorie, Condition et Politique de retour */}
      <ReturnPolicyModal
        isOpen={isReturnPolicyModalOpen}
        onClose={() => setIsReturnPolicyModalOpen(false)}
        currentPolicy={returnPolicy}
        onSave={(newPolicy) => onChangeReturnPolicy(newPolicy)}
      />

      <ItemConditionModal
        isOpen={isItemConditionModalOpen}
        onClose={() => setIsItemConditionModalOpen(false)}
        currentCondition={itemCondition}
        onSave={(newCondition) => onChangeItemCondition(newCondition)}
      />

      <CategorySelectModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        currentCategory={category}
        productName={name}
        onSelectCategory={(newCat, subCat) => {
          onChangeCategory(newCat);
          if (subCat) {
            setSelectedSubcategory(subCat);
            const cleanSubTag = `#${subCat.replace(/[^a-zA-Z0-9\u00C0-\u017F]/g, '')}`;
            if (!tags.includes(cleanSubTag) && cleanSubTag.length > 2) {
              onToggleTag(cleanSubTag);
            }
          } else {
            setSelectedSubcategory('');
          }
        }}
      />
    </div>
  );
};
