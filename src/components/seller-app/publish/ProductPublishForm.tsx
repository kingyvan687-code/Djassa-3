import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Upload,
  Image as ImageIcon,
  X,
  Star,
  Sparkles,
  Layers,
  Tag,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  Plus,
  Minus,
  Check,
  HelpCircle,
  ChevronRight,
  Flame,
  Trash2,
  RefreshCw,
  Camera,
  Pencil,
  MapPin,
  Clock,
  MessageCircle,
  Ruler,
  FileText,
  SlidersHorizontal,
  Package,
  Eye,
  Store,
  ArrowRight,
} from 'lucide-react';
import { formatFCFA } from '../../../services/marketServices';
import { VariantItem } from '../../../types';
import { useApp } from '../../../context/AppContext';
import { ReturnPolicyModal } from './ReturnPolicyModal';
import { ItemConditionModal } from './ItemConditionModal';
import { CategorySelectModal, CATEGORIES_CATALOG, getCategoryIconHelper } from './CategorySelectModal';

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

const SAMPLE_PHOTOS = [
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&auto=format&fit=crop&q=80',
];

const SUGGESTED_TAGS = [
  '#Nouveauté',
  '#QualitéGarantie',
  '#PromoAdjamé',
  '#100%Original',
  '#StockLimité',
  '#LivraisonRapide',
  '#TendanceAbidjan',
  '#ArrivageDirect',
];

const PITCH_TEMPLATES = [
  '🔥 Arrivage direct en boutique ! Produit 100% original de qualité supérieure, testé et vérifié au Marché d’Adjamé. Livraison ultra rapide partout à Abidjan sous 24h avec paiement sécurisé (Wave, Orange Money ou à la livraison). Satisfait ou remboursé sous 3 jours !',
  '✨ Modèle haut de gamme très tendance. Finitions soignées, matière durable et confort garanti. Stock très limité disponible en magasin, commandez dès maintenant pour réserver votre taille.',
  '⚡ Super promotion de la semaine ! Article neuf sous emballage d’origine avec garantie boutique. Remise ou expédition organisée directement par la boutique.',
];

const MOCK_REVIEWS_PREVIEW = [
  {
    id: 'rev-1',
    author: 'Aminata K.',
    location: 'Cocody Angré',
    rating: 5,
    comment: 'Conforme à 100% ! Tissu de haute qualité et expédition rapide organisée par la boutique à Abidjan.',
  },
  {
    id: 'rev-2',
    author: 'Ibrahim S.',
    location: 'Marcory Zone 4',
    rating: 5,
    comment: 'Superbe produit, vendeur sérieux et très arrangeant sur le paiement Wave.',
  },
];

interface Props {
  // Media
  mediaUrls: string[];
  coverIndex: number;
  onAddMedia: (url: string) => void;
  onRemoveMedia: (index: number) => void;
  onSetCover: (index: number) => void;

  // Basic Info
  name: string;
  onChangeName: (v: string) => void;
  category: string;
  onChangeCategory: (v: string) => void;
  location?: string;
  onChangeLocation?: (v: string) => void;

  // Price & Global Stock
  price: string;
  onChangePrice: (v: string) => void;
  originalPrice?: string;
  onChangeOriginalPrice?: (v: string) => void;
  stock: string;
  onChangeStock: (v: string) => void;

  // Description & Pitch
  description: string;
  onChangeDescription: (v: string) => void;

  // Variants and Stock per Size
  variants: VariantItem[];
  setVariants: React.Dispatch<React.SetStateAction<VariantItem[]>>;
  variantStock: Record<string, number>;
  setVariantStock: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  variantImages: Record<string, string[]>;
  setVariantImages: React.Dispatch<React.SetStateAction<Record<string, number | any>>>;

  // Useful Info (Delivery, Warranties, Payment)
  deliveryMode?: string;
  onChangeDeliveryMode?: (v: string) => void;
  deliveryFee?: string;
  onChangeDeliveryFee?: (v: string) => void;
  returnPolicy: string;
  onChangeReturnPolicy: (v: string) => void;
  acceptedPayments: string[];
  onTogglePayment: (method: string) => void;
  itemCondition: string;
  onChangeItemCondition: (v: string) => void;

  // Tags
  tags: string[];
  onToggleTag: (t: string) => void;
}

export const ProductPublishForm: React.FC<Props> = ({
  mediaUrls,
  coverIndex,
  onAddMedia,
  onRemoveMedia,
  onSetCover,
  name,
  onChangeName,
  category,
  onChangeCategory,
  location = 'Marché d’Adjamé',
  onChangeLocation = () => {},
  price,
  onChangePrice,
  originalPrice = '',
  onChangeOriginalPrice = () => {},
  stock,
  onChangeStock,
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
  acceptedPayments,
  onTogglePayment,
  itemCondition,
  onChangeItemCondition,
  tags,
  onToggleTag,
}) => {
  const { sellers, currentSellerId } = useApp();
  const currentSeller = useMemo(() => {
    return sellers.find((s) => s.id === currentSellerId) || sellers[0] || {
      storeName: 'Boutique Wax & Élégance',
      name: 'Vendeur Pro',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      location: 'Adjamé Forum des Marchés',
      verified: true,
    };
  }, [sellers, currentSellerId]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const variantFileInputRef = useRef<HTMLInputElement | null>(null);
  const [targetVariantForPhoto, setTargetVariantForPhoto] = useState<string>('');
  const [newOptionInput, setNewOptionInput] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isReturnPolicyModalOpen, setIsReturnPolicyModalOpen] = useState(false);
  const [isItemConditionModalOpen, setIsItemConditionModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  const [activePhotoIndex, setActivePhotoIndex] = useState<number>(0);
  const [detailTab, setDetailTab] = useState<'description' | 'specs' | 'reviews' | 'warranty'>('description');
  const [targetPhotoSlot, setTargetPhotoSlot] = useState<number>(0);
  const [photoManagerOption, setPhotoManagerOption] = useState<string | null>(null);

  // Fiche technique (Specs)
  const [specs, setSpecs] = useState<Record<string, string>>({
    'Matière': 'Coton 100% Uniwax',
    'Coupe': 'Ajustée / Moderne',
    'Origine': 'Côte d’Ivoire (Adjamé)',
    'Entretien': 'Lavage doux 30°C',
  });
  const [newSpecKey, setNewSpecKey] = useState('');
  const [newSpecVal, setNewSpecVal] = useState('');

  const handleAddSpec = () => {
    if (!newSpecKey.trim() || !newSpecVal.trim()) return;
    setSpecs((prev) => ({ ...prev, [newSpecKey.trim()]: newSpecVal.trim() }));
    setNewSpecKey('');
    setNewSpecVal('');
  };

  const handleRemoveSpec = (key: string) => {
    setSpecs((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  // Conditions de remboursement & retour
  const [returnDays, setReturnDays] = useState<number>(3);
  const [refundConditions, setRefundConditions] = useState<string[]>([
    'Article non porté',
    'Étiquette intacte',
    "Emballage d'origine conservé",
  ]);
  const [newRefundCondInput, setNewRefundCondInput] = useState('');

  const handleAddRefundCond = () => {
    if (!newRefundCondInput.trim()) return;
    setRefundConditions((prev) => [...prev, newRefundCondInput.trim()]);
    setNewRefundCondInput('');
  };

  const handleRemoveRefundCond = (index: number) => {
    setRefundConditions((prev) => prev.filter((_, i) => i !== index));
  };

  // Procédure de remboursement étape par étape
  const [refundSteps, setRefundSteps] = useState<string[]>([
    "Le client contacte votre boutique via la messagerie Djassa.",
    "Validation du motif : photo/vidéo transmise par le client.",
    "Restitution du colis : le client retourne l'article selon les modalités convenues avec la boutique.",
    "Règlement : remboursement via Wave ou échange de produit.",
  ]);
  const [newRefundStepInput, setNewRefundStepInput] = useState('');

  const handleAddRefundStep = () => {
    if (!newRefundStepInput.trim()) return;
    setRefundSteps((prev) => [...prev, newRefundStepInput.trim()]);
    setNewRefundStepInput('');
  };

  const handleRemoveRefundStep = (index: number) => {
    setRefundSteps((prev) => prev.filter((_, i) => i !== index));
  };

  // Sync active photo index when media list changes
  useEffect(() => {
    if (activePhotoIndex >= mediaUrls.length && mediaUrls.length > 0) {
      setActivePhotoIndex(0);
    }
  }, [mediaUrls.length, activePhotoIndex]);

  // Current displayed hero image
  const activeHeroImage = mediaUrls[activePhotoIndex] || mediaUrls[coverIndex] || mediaUrls[0] || SAMPLE_PHOTOS[0];

  // Price calculations
  const numPrice = Number(price) || 0;
  const numOriginalPrice = Number(originalPrice) || 0;
  const discountAmount = numOriginalPrice > numPrice && numPrice > 0 ? numOriginalPrice - numPrice : 0;
  const discountPercent = numOriginalPrice > numPrice && numOriginalPrice > 0
    ? Math.round(((numOriginalPrice - numPrice) / numOriginalPrice) * 100)
    : 0;

  // Options & Variants calculations (strictly deduplicated)
  const allOptions = Array.from(new Set(variants.flatMap((v) => v.options)));
  const totalVariantStock = Object.values(variantStock).reduce(
    (acc, val) => acc + (Number(val) || 0),
    0
  );
  const currentTotalStock = allOptions.length > 0 ? totalVariantStock : (parseInt(stock) || 0);

  // Strict stock sync with parent
  useEffect(() => {
    if (allOptions.length > 0) {
      if (parseInt(stock) !== totalVariantStock) {
        onChangeStock(String(totalVariantStock));
      }
    }
  }, [totalVariantStock, allOptions.length, stock, onChangeStock]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const url = URL.createObjectURL(files[i]);
        onAddMedia(url);
      }
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        if (file.type.startsWith('image/')) {
          onAddMedia(URL.createObjectURL(file));
        }
      }
    }
  };

  const handleUseDemoImages = () => {
    SAMPLE_PHOTOS.forEach((url) => {
      if (!mediaUrls.includes(url)) {
        onAddMedia(url);
      }
    });
    if (!name) onChangeName('Robe Wax Moderne Africaine Stylée');
    if (!price) onChangePrice('18500');
    if (!originalPrice) onChangeOriginalPrice('25000');
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
    const sum = Object.values(preset.stocks).reduce((acc, val) => acc + (Number(val) || 0), 0);
    onChangeStock(String(sum));
  };

  const adjustStock = (option: string, delta: number) => {
    setVariantStock((prev) => {
      const current = prev[option] ?? 5;
      const next = Math.max(0, current + delta);
      const updated = { ...prev, [option]: next };
      const newTotal = Object.values(updated).reduce((acc, val) => acc + (Number(val) || 0), 0);
      onChangeStock(String(newTotal));
      return updated;
    });
  };

  const setStockDirect = (option: string, value: number) => {
    const safeVal = Math.max(0, value);
    setVariantStock((prev) => {
      const updated = { ...prev, [option]: safeVal };
      const newTotal = Object.values(updated).reduce((acc, val) => acc + (Number(val) || 0), 0);
      onChangeStock(String(newTotal));
      return updated;
    });
  };

  const addCustomOption = () => {
    const trimmed = newOptionInput.trim();
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

    setVariantStock((prev) => {
      const updated = { ...prev, [trimmed]: 5 };
      const newTotal = Object.values(updated).reduce((acc, val) => acc + (Number(val) || 0), 0);
      onChangeStock(String(newTotal));
      return updated;
    });

    setNewOptionInput('');
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
      const newTotal = Object.values(copy).reduce((acc, val) => acc + (Number(val) || 0), 0);
      onChangeStock(String(newTotal));
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

  const handleSelectActiveVariantPhoto = (option: string, chosenImg: string) => {
    setVariantImages((prev: any) => {
      const list = prev[option] || [];
      if (!list.includes(chosenImg)) return prev;
      const rest = list.filter((x: string) => x !== chosenImg);
      return {
        ...prev,
        [option]: [chosenImg, ...rest],
      };
    });
  };

  const handleSetVariantImageFromMedia = (option: string, url: string, slot: number = 0) => {
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
    if (files && files.length > 0 && targetVariantForPhoto) {
      const url = URL.createObjectURL(files[0]);
      handleSetVariantImageFromMedia(targetVariantForPhoto, url, targetPhotoSlot);
      if (!mediaUrls.includes(url)) {
        onAddMedia(url);
      }
    }
    e.target.value = '';
    setTargetVariantForPhoto('');
  };

  const generatePitch = () => {
    const randomPitch = PITCH_TEMPLATES[Math.floor(Math.random() * PITCH_TEMPLATES.length)];
    onChangeDescription(randomPitch);
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={variantFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleVariantPhotoUpload}
      />

      {/* ========================================================================= */}
      {/* HERO SECTION INSPIRÉE DE LA PAGE DU CLIENT ("VOIR PRODUIT") */}
      {/* ========================================================================= */}
      <div 
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`relative aspect-[4/3] w-full bg-neutral-900 rounded-3xl border overflow-hidden shadow-2xl transition-all ${
          isDragOver ? 'border-[#FF6321] ring-4 ring-[#FF6321]/30' : 'border-white/10'
        }`}
      >
        <img
          src={activeHeroImage}
          alt={name || 'Aperçu du produit'}
          className="w-full h-full object-cover transition duration-300"
        />

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
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>
              Tailles actives :{' '}
              <span className="text-emerald-400 font-black">
                {allOptions.length > 0 ? allOptions.join(', ') : 'Taille Unique'}
              </span>
            </span>
          </div>
        </div>

        {/* TOP-RIGHT FLOATING CONTROLS */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1 rounded-full bg-[#FF6321] hover:bg-[#ff7539] text-white text-[10px] font-black backdrop-blur-md shadow-lg flex items-center gap-1 transition active:scale-95"
            title="Ajouter des photos"
          >
            <Upload className="w-3 h-3" />
            <span>+ Photos ({mediaUrls.length}/8)</span>
          </button>
        </div>

        {/* BOTTOM THUMBNAIL GALLERY STRIP (Identique au client "Voir Produit") */}
        <div className="absolute bottom-3 left-0 right-0 px-3 z-10 flex items-center justify-center gap-2 overflow-x-auto no-scrollbar py-1">
          {mediaUrls.map((img, i) => {
            const isCover = i === coverIndex;
            const isActive = i === activePhotoIndex;
            return (
              <div
                key={i}
                onClick={() => setActivePhotoIndex(i)}
                className={`group relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition shadow-md cursor-pointer ${
                  isActive
                    ? 'border-[#FF6321] scale-105 ring-2 ring-[#FF6321]/40'
                    : isCover
                    ? 'border-emerald-400/80 opacity-90'
                    : 'border-white/20 opacity-70 hover:opacity-100'
                }`}
                title={isCover ? 'Photo de couverture principale' : `Photo ${i + 1}`}
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

                {/* Quick actions on hover */}
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

          {/* Quick upload tile in the strip */}
          {mediaUrls.length < 8 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
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
            <span>En stock ({currentTotalStock})</span>
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
                  Stock total prêt à expédier : <span className="font-bold text-emerald-400">{currentTotalStock} pièces</span>
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
                        key={`pub-sz-${sz}-${szIdx}`}
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
                            onClick={() => handleSelectActiveVariantPhoto(option, images[0])}
                            className="w-8 h-8 rounded-lg object-cover border-2 border-emerald-400 shadow cursor-pointer hover:scale-105 transition"
                            title="Photo 1 - Cliquez pour activer"
                          />
                          <img
                            src={images[1]}
                            alt={`${option} photo 2`}
                            onClick={() => handleSwitchVariantImages(option)}
                            className="w-8 h-8 rounded-lg object-cover border-2 border-white/20 hover:border-[#FF6321] shadow cursor-pointer hover:scale-105 transition opacity-80"
                            title="Photo 2 - Cliquez pour basculer"
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
                              setPhotoManagerOption(option);
                              setTargetPhotoSlot(1);
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
                            setPhotoManagerOption(option);
                            setTargetPhotoSlot(0);
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
              value={newOptionInput}
              onChange={(e) => setNewOptionInput(e.target.value)}
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
                Texte descriptif de l'article
              </label>
            </div>

            <textarea
              rows={4}
              value={description}
              onChange={(e) => onChangeDescription(e.target.value)}
              placeholder="Magnifique ensemble robe wax taillée sur mesure, tissu 100% coton véritable Uniwax. Idéale pour vos cérémonies et sorties chics à Abidjan."
              className="w-full p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321] no-scrollbar leading-relaxed"
            />
          </div>
        )}

        {detailTab === 'specs' && (
          <div className="space-y-4">
            {/* Fiche technique du produit (Design identique à EditMerchandiseModal) */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs text-white/70">
                <span className="font-bold">Fiche technique du produit</span>
                <span className="text-[10px] text-white/50">Matière, coupe, entretien, détails</span>
              </div>

              {/* Liste des caractéristiques existantes */}
              <div className="space-y-1.5">
                {Object.entries(specs).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs"
                  >
                    <span className="text-white/60 font-semibold">{key} :</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold">{value}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSpec(key)}
                        className="p-1 text-white/30 hover:text-rose-400 transition"
                        title="Retirer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Ajouter une nouvelle caractéristique */}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Attribut (ex: Matière)"
                  value={newSpecKey}
                  onChange={(e) => setNewSpecKey(e.target.value)}
                  className="flex-1 p-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                />
                <input
                  type="text"
                  placeholder="Valeur (ex: 100% Coton)"
                  value={newSpecVal}
                  onChange={(e) => setNewSpecVal(e.target.value)}
                  className="flex-1 p-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                />
                <button
                  type="button"
                  onClick={handleAddSpec}
                  className="px-3 py-2 rounded-xl bg-[#FF6321] hover:brightness-110 text-white text-xs font-bold transition flex items-center gap-1 shadow-md shadow-[#FF6321]/30 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {detailTab === 'warranty' && (
          <div className="space-y-4">
            {/* 1. Politique d'échange & Délai (Design identique à EditMerchandiseModal) */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">Garantie & Délai d'échange</span>
                </div>
                <select
                  value={returnDays}
                  onChange={(e) => {
                    const days = Number(e.target.value);
                    setReturnDays(days);
                    onChangeReturnPolicy(days > 0 ? `Garantie ${days} jours échange / remboursement` : 'Aucun retour (Vente définitive)');
                  }}
                  className="bg-neutral-800 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl border border-white/15 focus:outline-none focus:border-[#FF6321]"
                >
                  <option value={3}>3 jours (Standard Djassa)</option>
                  <option value={7}>7 jours</option>
                  <option value={14}>14 jours</option>
                  <option value={0}>Aucun retour (Vente définitive)</option>
                </select>
              </div>

              {/* Conditions exigées */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold text-white/50 block uppercase">
                  Conditions exigées pour acceptation du retour :
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {refundConditions.map((cond, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5"
                    >
                      <span>✓ {cond}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRefundCond(i)}
                        className="text-white/40 hover:text-rose-400 transition"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Ajouter une condition (ex: Emballage scellé)"
                    value={newRefundCondInput}
                    onChange={(e) => setNewRefundCondInput(e.target.value)}
                    className="flex-1 p-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                  />
                  <button
                    type="button"
                    onClick={handleAddRefundCond}
                    className="px-3 py-1.5 rounded-xl bg-[#FF6321] hover:brightness-110 text-white text-xs font-bold transition flex items-center gap-1 shadow-md shadow-[#FF6321]/30 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Procédure de retour étape par étape */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
              <span className="text-xs font-bold text-white block">
                Étapes de remboursement affichées à l'acheteur :
              </span>
              <div className="space-y-1.5">
                {refundSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs text-white/90"
                  >
                    <span className="w-5 h-5 rounded-full bg-[#FF6321]/20 text-[#FF6321] font-black text-[10px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="flex-1 text-white/80">{step}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRefundStep(idx)}
                      className="p-1 text-white/30 hover:text-rose-400 transition"
                      title="Supprimer cette étape"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Ajouter une étape personnalisée..."
                  value={newRefundStepInput}
                  onChange={(e) => setNewRefundStepInput(e.target.value)}
                  className="flex-1 p-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                />
                <button
                  type="button"
                  onClick={handleAddRefundStep}
                  className="px-3 py-1.5 rounded-xl bg-[#FF6321] hover:brightness-110 text-white text-xs font-bold transition flex items-center gap-1 shadow-md shadow-[#FF6321]/30 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter</span>
                </button>
              </div>
            </div>

            {/* 3. Moyens de Paiement Acceptés */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <span className="text-xs font-bold text-white block">
                Moyens de paiement acceptés pour cet article :
              </span>
              <div className="flex flex-wrap gap-2 pt-1">
                {['Wave', 'Orange Money', 'Paiement à la livraison'].map((m) => {
                  const isAccepted = acceptedPayments.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onTogglePayment(m)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                        isAccepted
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-white/5 text-white/40 border border-white/10 hover:text-white'
                      }`}
                    >
                      <Check className={`w-3.5 h-3.5 ${isAccepted ? 'opacity-100' : 'opacity-0'}`} />
                      <span>{m}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Badge Djassa */}
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-[11px] text-emerald-300/90 leading-tight">
                <strong>Paiement sécurisé Djassa :</strong> Paiement en ligne (Wave / Orange Money) reversé directement à la boutique (commission fixe 150 FCFA) ou paiement à la livraison (0% frais client). Livraison gérée directement par votre boutique (0 F frais Djassa).
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modal / Dialog dédié : Photos de la variante */}
      {photoManagerOption && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-[#171717] border border-white/15 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-white text-base flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#FF6321]" />
                  <span>Photos de la variante</span>
                </h3>
                <p className="text-xs text-[#FF6321] font-bold mt-0.5">
                  Option : {photoManagerOption}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPhotoManagerOption(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(variantImages[photoManagerOption] || []).length > 0 ? (
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">
                    Photos actuelles ({(variantImages[photoManagerOption] || []).length}/2)
                  </span>
                  {(variantImages[photoManagerOption] || []).length >= 2 && (
                    <button
                      type="button"
                      onClick={() => handleSwitchVariantImages(photoManagerOption)}
                      className="px-2.5 py-1 rounded-xl bg-[#FF6321] hover:bg-[#ff7539] text-white text-[10px] font-black flex items-center gap-1 transition shadow-md shadow-orange-600/30 active:scale-95"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Basculer ⇄</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 overflow-x-auto pb-1">
                  {(variantImages[photoManagerOption] || []).map((imgUrl: string, imgIdx: number) => (
                    <div
                      key={imgIdx}
                      className={`relative rounded-xl overflow-hidden border-2 p-1 bg-black/40 flex flex-col items-center gap-1 shrink-0 ${
                        imgIdx === 0 ? 'border-emerald-400 ring-2 ring-emerald-400/30' : 'border-white/20'
                      }`}
                    >
                      <img
                        src={imgUrl}
                        alt=""
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                      <span className="text-[8px] font-black text-white/70">
                        {imgIdx === 0 ? 'Photo 1 ★' : 'Photo 2'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const copy = [...(variantImages[photoManagerOption] || [])];
                          copy.splice(imgIdx, 1);
                          setVariantImages((prev: any) => ({
                            ...prev,
                            [photoManagerOption]: copy,
                          }));
                        }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Télécharger nouvelle photo pour la variante */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-white/70 block">
                Ajouter une photo pour cette taille :
              </span>
              <button
                type="button"
                onClick={() => {
                  setTargetVariantForPhoto(photoManagerOption);
                  variantFileInputRef.current?.click();
                }}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-[#FF6321]/40 hover:border-[#FF6321] bg-[#FF6321]/5 hover:bg-[#FF6321]/10 text-white font-bold text-xs flex items-center justify-center gap-2 transition"
              >
                <Upload className="w-4 h-4 text-[#FF6321]" />
                <span>Sélectionner une image locale</span>
              </button>
            </div>

            {/* Ou choisir parmi les photos déjà uploadées */}
            {mediaUrls.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] text-white/50 block">
                  Ou choisir parmi les photos de l'article :
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {mediaUrls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt=""
                      onClick={() => {
                        handleSetVariantImageFromMedia(photoManagerOption, url, targetPhotoSlot);
                        setPhotoManagerOption(null);
                      }}
                      className="w-full aspect-square rounded-xl object-cover border border-white/20 hover:border-[#FF6321] cursor-pointer hover:scale-105 transition"
                    />
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setPhotoManagerOption(null)}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

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
