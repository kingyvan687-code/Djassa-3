import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Image as ImageIcon,
  Check,
  Sparkles,
  AlertCircle,
  Plus,
  Minus,
  Tag,
  Play,
  RotateCcw,
  FileText,
  Save,
  Video as VideoIcon,
  X,
  ShieldCheck,
  Upload,
  Camera,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Star,
  MapPin,
  Clock,
  MessageCircle,
  ChevronRight,
  Flame,
  Truck,
  CreditCard,
  ShoppingBag,
  SlidersHorizontal,
  Ruler,
  HelpCircle,
  CheckCircle2
} from 'lucide-react';
import { Product } from '../../../types';
import { useApp } from '../../../context/AppContext';
import { formatFCFA } from '../../../services/marketServices';

interface Props {
  product: Product;
  onClose: () => void;
  onSave?: (updates: Partial<Product>) => void;
  onDelete?: () => void;
}

type TabSection = 'description' | 'specs' | 'avis' | 'remboursement';

const DEFAULT_REFUND_STEPS = [
  "Le client contacte votre boutique via la messagerie Djassa.",
  "Validation du motif : photo/vidéo transmise par le client.",
  "Restitution du colis : le client retourne l'article selon les modalités convenues avec la boutique.",
  "Règlement : remboursement via Wave ou échange de produit."
];

const PRESETS = [
  {
    label: '👗 Vêtements (S, M, L, XL, XXL)',
    type: 'Taille',
    options: ['S', 'M', 'L', 'XL', 'XXL'],
    stocks: { S: 4, M: 8, L: 6, XL: 4, XXL: 2 }
  },
  {
    label: '👟 Chaussures (39 à 44)',
    type: 'Pointure',
    options: ['39', '40', '41', '42', '43', '44'],
    stocks: { '39': 2, '40': 4, '41': 6, '42': 5, '43': 3, '44': 2 }
  }
];

const SUGGESTED_TAGS = [
  '#Nouveauté',
  '#QualitéGarantie',
  '#PromoAdjamé',
  '#100%Original',
  '#StockLimité',
  '#LivraisonRapide',
  '#TendanceAbidjan',
  '#ArrivageDirect'
];

const PITCH_TEMPLATES = [
  '🔥 Arrivage direct en boutique ! Produit 100% original de qualité supérieure, vérifié au Marché d’Adjamé. Livraison ultra rapide partout à Abidjan sous 24h avec paiement sécurisé (Wave, Orange Money ou à la livraison). Satisfait ou remboursé sous 3 jours !',
  '✨ Modèle haut de gamme très tendance. Finitions soignées, matière durable et confort garanti. Stock très limité disponible en magasin, réservez votre taille dès maintenant.',
  '⚡ Super promotion de la semaine ! Article neuf sous emballage d’origine avec garantie boutique. Livraison organisée directement par votre boutique.'
];

const MOCK_REVIEWS_PREVIEW = [
  {
    id: 'rev-1',
    author: 'Aminata Koné',
    location: 'Cocody Angré',
    rating: 5,
    date: 'Hier',
    comment: 'Superbe qualité ! Le tissu wax est épais et très bien taillé. Livré rapidement par la boutique. Je recommande les yeux fermés ! ✨'
  },
  {
    id: 'rev-2',
    author: 'Yasmine Traoré',
    location: 'Marcory Zone 4',
    rating: 5,
    date: 'Il y a 3 jours',
    comment: 'Exactement conforme aux photos ! La coupe tombe parfaitement bien et les coutures sont impeccables. Paiement Wave à la livraison très pratique.'
  },
  {
    id: 'rev-3',
    author: 'Christelle B.',
    location: 'Yopougon Maroc',
    rating: 4,
    date: 'Il y a 1 semaine',
    comment: 'Très jolie robe, couleur éclatante. Vendeur très réactif sur le chat pour conseiller sur la taille.'
  }
];

export const EditMerchandiseModal: React.FC<Props> = ({
  product,
  onClose,
  onSave,
  onDelete
}) => {
  const { showToast, updateProductSeller, sellers, currentSellerId } = useApp();

  const currentSeller = useMemo(() => {
    return sellers.find((s) => s.id === currentSellerId) || sellers[0] || {
      storeName: 'Boutique Wax & Élégance',
      name: 'Vendeur Pro',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
      location: 'Adjamé Forum des Marchés',
      verified: true
    };
  }, [sellers, currentSellerId]);

  // Active media viewer state
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [activeTab, setActiveTabState] = useState<TabSection>('description');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [targetPhotoSlot, setTargetPhotoSlot] = useState<number>(0);
  const [activeTargetOption, setActiveTargetOption] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const variantFileInputRef = useRef<HTMLInputElement | null>(null);

  // Editable product fields
  const [name, setName] = useState(product.name || '');
  const [category, setCategory] = useState(product.category || 'Mode & Habillement');
  const [location, setLocation] = useState(product.location || 'Adjamé Forum des Marchés');
  const [price, setPrice] = useState(product.price || 0);
  const [originalPrice, setOriginalPrice] = useState(
    product.originalPrice || Math.round((product.price || 10000) * 1.25)
  );
  const [images, setImages] = useState<string[]>(
    product.images && product.images.length > 0
      ? [...product.images]
      : ['https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600']
  );
  const [videoUrl, setVideoUrl] = useState(product.videoUrl || '');
  const [videoPoster, setVideoPoster] = useState(product.videoPoster || '');

  // Options & Variantes
  const [variants, setVariants] = useState<{ type: string; options: string[] }[]>(() => {
    if (product.variants && product.variants.length > 0) {
      return JSON.parse(JSON.stringify(product.variants));
    }
    return [{ type: 'Taille', options: ['S', 'M', 'L', 'XL'] }];
  });

  const [variantStock, setVariantStock] = useState<Record<string, number>>(() => {
    if (product.variantStock && Object.keys(product.variantStock).length > 0) {
      return { ...product.variantStock };
    }
    return { S: 4, M: 8, L: 6, XL: 4 };
  });

  const [variantImages, setVariantImages] = useState<Record<string, string[]>>(() => {
    return product.variantImages ? JSON.parse(JSON.stringify(product.variantImages)) : {};
  });

  const [customOptionInput, setCustomOptionInput] = useState('');

  // Active variant options across all groups (strictly deduplicated)
  const allVariantOptions = useMemo(() => {
    return Array.from(new Set(variants.flatMap((v) => v.options)));
  }, [variants]);

  // Compute total variant stock strictly coherent with variant stocks
  const totalVariantStock = allVariantOptions.length > 0
    ? allVariantOptions.reduce((acc, opt) => acc + (Number(variantStock[opt]) || 0), 0)
    : (Number(product.stock) || 0);

  // Stock state strictly kept in sync with variants
  const [stock, setStock] = useState<number>(() => {
    return allVariantOptions.length > 0 ? totalVariantStock : (product.stock ?? 10);
  });

  useEffect(() => {
    if (allVariantOptions.length > 0) {
      setStock(totalVariantStock);
    }
  }, [totalVariantStock, allVariantOptions.length]);

  // Description
  const [description, setDescription] = useState(
    product.description ||
      'Superbe article de haute qualité sélectionné par les commerçants du grand marché d’Adjamé. Finition artisanale ivoirienne soignée.'
  );

  // Tags
  const [tags, setTags] = useState<string[]>([
    '#Nouveauté',
    '#QualitéGarantie',
    '#PromoAdjamé'
  ]);

  const handleToggleTag = (t: string) => {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  // Caractéristiques (Specs)
  const [specs, setSpecs] = useState<Record<string, string>>(
    product.specs && Object.keys(product.specs).length > 0
      ? { ...product.specs }
      : {
          'Matière / Tissu': '100% Coton Wax Véritable',
          'Origine': "Confection Côte d'Ivoire 🇨🇮",
          'Entretien': 'Lavage à 30°C ou main',
          'Catégorie': product.category || 'Mode & Habillement'
        }
  );
  const [newSpecKey, setNewSpecKey] = useState('');
  const [newSpecVal, setNewSpecVal] = useState('');

  // Conditions de remboursement & retour
  const [returnDays, setReturnDays] = useState(
    product.conditions?.returnPeriodDays !== undefined ? product.conditions.returnPeriodDays : 3
  );
  const [refundConditions, setRefundConditions] = useState<string[]>(
    product.conditions?.returnConditions && product.conditions.returnConditions.length > 0
      ? [...product.conditions.returnConditions]
      : ['Article non porté', 'Étiquette intacte', "Emballage d'origine conservé"]
  );
  const [newRefundCondInput, setNewRefundCondInput] = useState('');

  // Procédure de remboursement (étapes éditables)
  const [refundSteps, setRefundSteps] = useState<string[]>(() => {
    if (product.conditions?.refundSteps && product.conditions.refundSteps.length > 0) {
      return [...product.conditions.refundSteps];
    }
    return [...DEFAULT_REFUND_STEPS];
  });
  const [newRefundStepInput, setNewRefundStepInput] = useState('');
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [editingStepText, setEditingStepText] = useState('');

  // Moyens de paiement
  const [acceptedPayments, setAcceptedPayments] = useState<string[]>([
    'Wave',
    'Orange Money',
    'Paiement à la livraison'
  ]);

  const handleTogglePayment = (method: string) => {
    setAcceptedPayments((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  };

  // Calculated values
  const currentPrice = Number(price) || 0;
  const currOriginalPrice = Number(originalPrice) || 0;
  const discountAmount = currOriginalPrice > currentPrice && currentPrice > 0 ? currOriginalPrice - currentPrice : 0;
  const computedDiscountPercent = currOriginalPrice > currentPrice && currOriginalPrice > 0
    ? Math.round(((currOriginalPrice - currentPrice) / currOriginalPrice) * 100)
    : 0;

  // Media handlers
  const handleLocalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const url = URL.createObjectURL(file);
        newUrls.push(url);
      }
      setImages((prev) => [...prev, ...newUrls]);
      showToast(`${newUrls.length} photo(s) ajoutée(s) ! 📸`);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setShowVideo(true);
      showToast('Vidéo Reel importée avec succès ! 🎥');
    }
    e.target.value = '';
  };

  const handleVariantFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeTargetOption) {
      const url = URL.createObjectURL(file);
      setVariantImages((prev) => {
        const existing = [...(prev[activeTargetOption] || [])];
        if (targetPhotoSlot === 1) {
          if (existing.length === 0) existing.push(url);
          else existing[1] = url;
        } else {
          if (existing.length === 0) existing.push(url);
          else existing[0] = url;
        }
        return {
          ...prev,
          [activeTargetOption]: existing.slice(0, 2)
        };
      });
      setImages((prev) => (prev.includes(url) ? prev : [...prev, url]));
      showToast(`Photo ${targetPhotoSlot + 1} associée à "${activeTargetOption}" ! 📸`);
      setActiveTargetOption(null);
      if (variantFileInputRef.current) variantFileInputRef.current.value = '';
    }
  };

  const handleSwitchVariantImages = (option: string) => {
    setVariantImages((prev) => {
      const list = prev[option] || [];
      if (list.length < 2) return prev;
      return {
        ...prev,
        [option]: [list[1], list[0], ...list.slice(2)]
      };
    });
    showToast(`Bascule photo effectuée pour "${option}" ! 🔄`);
  };

  const handleRemoveImage = (index: number) => {
    if (images.length <= 1) {
      showToast('Le produit doit avoir au moins une photo.');
      return;
    }
    setImages((prev) => prev.filter((_, i) => i !== index));
    if (activeImgIndex >= images.length - 1) {
      setActiveImgIndex(Math.max(0, images.length - 2));
    }
    showToast('Photo retirée.');
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setVariants([{ type: preset.type as any, options: [...preset.options] }]);
    setVariantStock({ ...preset.stocks });
    const sum = Object.values(preset.stocks).reduce((acc, val) => acc + (Number(val) || 0), 0);
    setStock(sum);
    showToast(`Préréglage "${preset.label}" appliqué ! ✓`);
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
      [option]: Math.max(0, val)
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
          options: [...existing, trimmed]
        }
      ];
    });

    setVariantStock((prev) => ({
      ...prev,
      [trimmed]: 5
    }));

    setCustomOptionInput('');
    showToast(`Taille "${trimmed}" ajoutée !`);
  };

  const removeOption = (option: string) => {
    setVariants((prev) =>
      prev.map((v) => ({
        ...v,
        options: v.options.filter((o) => o !== option)
      }))
    );
    setVariantStock((prev) => {
      const copy = { ...prev };
      delete copy[option];
      return copy;
    });
    showToast(`Option "${option}" supprimée.`);
  };

  const generatePitch = () => {
    const randomPitch = PITCH_TEMPLATES[Math.floor(Math.random() * PITCH_TEMPLATES.length)];
    setDescription(randomPitch);
    showToast('✨ Argumentaire généré avec succès !');
  };

  // Specs handlers
  const handleAddSpec = () => {
    if (!newSpecKey.trim() || !newSpecVal.trim()) return;
    setSpecs((prev) => ({ ...prev, [newSpecKey.trim()]: newSpecVal.trim() }));
    setNewSpecKey('');
    setNewSpecVal('');
    showToast('Caractéristique ajoutée !');
  };

  const handleRemoveSpec = (key: string) => {
    setSpecs((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  // Refund condition handlers
  const handleAddRefundCond = () => {
    if (!newRefundCondInput.trim()) return;
    setRefundConditions((prev) => [...prev, newRefundCondInput.trim()]);
    setNewRefundCondInput('');
    showToast('Condition ajoutée.');
  };

  const handleRemoveRefundCond = (index: number) => {
    setRefundConditions((prev) => prev.filter((_, i) => i !== index));
  };

  // Refund steps handlers
  const handleAddRefundStep = () => {
    if (!newRefundStepInput.trim()) return;
    setRefundSteps((prev) => [...prev, newRefundStepInput.trim()]);
    setNewRefundStepInput('');
    showToast('Étape ajoutée.');
  };

  const handleRemoveRefundStep = (index: number) => {
    setRefundSteps((prev) => prev.filter((_, i) => i !== index));
    if (editingStepIndex === index) {
      setEditingStepIndex(null);
      setEditingStepText('');
    }
  };

  const handleStartEditRefundStep = (index: number) => {
    setEditingStepIndex(index);
    setEditingStepText(refundSteps[index] || '');
  };

  const handleSaveEditRefundStep = () => {
    if (editingStepIndex === null) return;
    const text = editingStepText.trim();
    if (!text) {
      handleRemoveRefundStep(editingStepIndex);
    } else {
      setRefundSteps((prev) => {
        const copy = [...prev];
        copy[editingStepIndex] = text;
        return copy;
      });
      showToast('Étape modifiée.');
    }
    setEditingStepIndex(null);
    setEditingStepText('');
  };

  // Save all modifications
  const handleSaveAll = () => {
    const finalStock = allVariantOptions.length > 0 ? totalVariantStock : Math.max(0, Number(stock) || 0);
    const updates: Partial<Product> = {
      name: name.trim() || product.name,
      category,
      location,
      price: currentPrice,
      originalPrice: currOriginalPrice,
      isPromotion: computedDiscountPercent > 0,
      discountPercentage: computedDiscountPercent > 0 ? computedDiscountPercent : 0,
      stock: finalStock,
      inStock: finalStock > 0,
      images,
      videoUrl: videoUrl.trim() || undefined,
      videoPoster: videoPoster.trim() || (videoUrl ? images[0] : undefined),
      mediaType: videoUrl.trim() ? 'video' : 'image',
      variants: variants as any,
      variantStock,
      variantImages,
      description: description.trim(),
      specs,
      conditions: {
        ...product.conditions,
        returnPeriodDays: Number(returnDays),
        returnConditions: refundConditions,
        refundSteps: refundSteps,
        isRefundable: Number(returnDays) > 0
      }
    };

    if (onSave) {
      onSave(updates);
    } else {
      updateProductSeller(product.id, updates);
      showToast('Article mis à jour avec succès ! ✨');
      onClose();
    }
  };

  return (
    <div
      id="edit-merchandise-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleLocalImageUpload}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={handleVideoUpload}
      />
      <input
        ref={variantFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleVariantFileUpload}
      />

      <div
        id="edit-merchandise-modal"
        className="relative w-full max-w-xl bg-[#0E0E0E] sm:rounded-3xl rounded-t-3xl border border-white/15 overflow-hidden shadow-2xl flex flex-col max-h-[94vh] h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================================= */}
        {/* 1. TOP STICKY BAR: RETOUR, IDENTIFIANT & BOUTON ENREGISTRER               */}
        {/* ========================================================================= */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-[#121212]/95 backdrop-blur-md border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/15 text-white/80 hover:text-white transition active:scale-95 shrink-0"
              aria-label="Retour"
              title="Fermer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <span className="text-[10px] text-white/50 uppercase tracking-widest block font-bold">
                {category || 'Article'} • Modification
              </span>
              <h2 className="text-xs font-black text-white line-clamp-1 max-w-[240px] sm:max-w-md">
                {name || product.name}
              </h2>
            </div>
          </div>

          <button
            onClick={handleSaveAll}
            className="px-4 py-2 rounded-full bg-[#FF6321] hover:bg-[#ff7538] text-white text-xs font-black transition flex items-center gap-1.5 shadow-lg shadow-orange-600/30 active:scale-95 shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Enregistrer</span>
          </button>
        </header>

        {/* ========================================================================= */}
        {/* 2. SCROLLABLE CONTENT BODY (Conforme au design de ProductDetailModal)      */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-5 pb-28">

          {/* ========================================================================= */}
          {/* MEDIA HERO SECTION (Style Fiche Produit Client avec overlays propres)     */}
          {/* ========================================================================= */}
          <div className="relative aspect-[4/3] w-full bg-neutral-900 border-b border-white/10 overflow-hidden">
            {showVideo && videoUrl ? (
              <video
                src={videoUrl}
                poster={videoPoster || images[0]}
                controls
                autoPlay
                loop
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={images[activeImgIndex] || images[0]}
                alt={name}
                className="w-full h-full object-cover transition duration-300"
              />
            )}

            {/* Ambient Dark Gradient Bottom for Thumbnails readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/30 pointer-events-none" />

            {/* FLOATING OVERLAYS (Stacked in single flex column without overlap) */}
            <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1.5 pointer-events-none max-w-[72%]">
              {computedDiscountPercent > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-rose-500/90 backdrop-blur-md text-white font-black text-xs shadow-lg flex items-center gap-1 shrink-0 animate-pulse">
                  <Tag className="w-3 h-3" /> -{computedDiscountPercent}% PROMO
                </span>
              )}

              <span className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-white font-bold text-[10px] shadow-lg flex items-center gap-1 shrink-0">
                <span className="w-2 h-2 rounded-full bg-[#FF6321]" /> Livraison Express 24h
              </span>

              {/* ACTIVE SIZES PILL */}
              <div className="px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white shadow-xl flex items-center gap-1.5 text-[10px] font-bold shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>
                  Tailles actives :{' '}
                  <span className="text-emerald-400 font-black">
                    {allVariantOptions.length > 0 ? allVariantOptions.join(', ') : 'Taille Unique'}
                  </span>
                </span>
              </div>
            </div>

            {/* RIGHT STATUS & MEDIA CONTROLS */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
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
                className="px-2.5 py-1 rounded-full bg-black/70 hover:bg-black/90 text-white border border-white/20 text-[10px] font-bold backdrop-blur-md transition active:scale-95 flex items-center gap-1"
                title="Changer ou ajouter une vidéo"
              >
                <VideoIcon className="w-3 h-3 text-[#FF6321]" />
                <span>+ Vidéo</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 rounded-full bg-[#FF6321] hover:bg-[#ff7538] text-white text-[10px] font-black backdrop-blur-md shadow-lg transition active:scale-95 flex items-center gap-1"
                title="Importer des photos"
              >
                <Upload className="w-3 h-3" />
                <span>+ Photos</span>
              </button>
            </div>

            {/* THUMBNAIL STRIP (Identique au client "Voir Produit") */}
            <div className="absolute bottom-3 left-0 right-0 px-3 z-10 flex items-center justify-center gap-2 overflow-x-auto no-scrollbar py-1">
              {/* Vidéo tile si vidéo active */}
              {videoUrl && (
                <div
                  onClick={() => setShowVideo(true)}
                  className={`relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition shadow-md cursor-pointer ${
                    showVideo
                      ? 'border-[#FF6321] scale-105 ring-2 ring-[#FF6321]/40'
                      : 'border-white/20 opacity-80 hover:opacity-100'
                  }`}
                  title="Aperçu vidéo"
                >
                  <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
                    <Play className="w-5 h-5 text-[#FF6321] fill-current" />
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-black/80 text-[7px] text-[#FF6321] font-black text-center truncate px-0.5">
                    Vidéo
                  </div>
                </div>
              )}

              {/* Photos de la galerie */}
              {images.map((img, i) => {
                const isActive = !showVideo && activeImgIndex === i;
                const isCover = i === 0;

                return (
                  <div
                    key={i}
                    onClick={() => {
                      setShowVideo(false);
                      setActiveImgIndex(i);
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

                    {/* Quick delete on hover */}
                    {images.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveImage(i);
                        }}
                        className="absolute inset-0 bg-rose-900/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                        title="Supprimer cette photo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Quick upload tile in the strip */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-12 h-12 rounded-xl border-2 border-dashed border-white/30 hover:border-[#FF6321] bg-black/50 hover:bg-[#FF6321]/20 flex flex-col items-center justify-center gap-0.5 text-white/60 hover:text-white transition shrink-0"
                title="Ajouter une photo supplémentaire"
              >
                <Plus className="w-3.5 h-3.5 text-[#FF6321]" />
                <span className="text-[8px] font-bold">+ Photo</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TARIFICATION & IDENTITÉ PRODUIT (Design inspiré de ProductDetailModal)     */}
          {/* ========================================================================= */}
          <div className="px-4 space-y-3.5">
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
                      onChange={(e) => setPrice(Number(e.target.value) || 0)}
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
                      onChange={(e) => setOriginalPrice(Number(e.target.value) || 0)}
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
                  <span>En stock ({stock})</span>
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
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Robe Wax Moderne Africaine Stylée..."
                  className="w-full text-base sm:text-lg font-black text-white bg-white/5 p-3 rounded-2xl border border-white/10 placeholder-white/30 focus:outline-none focus:border-[#FF6321] transition"
                />
              </div>

              {/* Ligne de réassurance & localisation (Identique au client) */}
              <div className="flex items-center gap-3 text-xs text-white/60 flex-wrap pt-1 border-t border-white/5">
                <div className="flex items-center gap-1 text-amber-400 font-bold">
                  <Star className="w-3.5 h-3.5 fill-current" />
                  <span>4.9 (4.3k avis)</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1 text-[#FF6321] font-bold">
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  <span>1.4k ventes réussies</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1 text-white/80 font-bold">
                  <MapPin className="w-3.5 h-3.5 text-[#FF6321]" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Adjamé Forum des Marchés"
                    className="bg-transparent text-white font-bold focus:outline-none border-b border-transparent focus:border-[#FF6321] text-xs max-w-[170px]"
                  />
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* APERÇU CARTE VENDEUR PRO (Exactement comme dans la fiche client)           */}
            {/* ========================================================================= */}
            <div className="p-3.5 rounded-3xl bg-neutral-900/80 border border-white/10 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={currentSeller.avatar}
                    alt={currentSeller.storeName}
                    className="w-11 h-11 rounded-full object-cover border-2 border-[#FF6321]"
                  />
                  {currentSeller.verified && (
                    <span className="absolute -bottom-1 -right-1 bg-[#FF6321] text-white text-[8px] font-black rounded-full p-0.5 shadow">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-white">
                      {currentSeller.storeName}
                    </span>
                    <span className="text-[9px] bg-[#FF6321]/20 text-[#FF6321] font-bold px-1.5 py-0.5 rounded">
                      Vendeur Pro
                    </span>
                  </div>
                  <p className="text-[10px] text-white/50 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-2.5 h-2.5 text-[#FF6321]" />
                    <span>{currentSeller.location || 'Marché d’Adjamé'}</span>
                  </p>
                  <p className="text-[10px] text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> Répond en &lt; 15 min
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="p-2 rounded-xl bg-white/5 text-white/70">
                  <MessageCircle className="w-4 h-4 text-[#FF6321]" />
                </div>
                <span className="px-3 py-1.5 rounded-xl bg-white/5 text-white text-xs font-bold border border-white/10 flex items-center gap-1">
                  <span>Boutique</span>
                  <ChevronRight className="w-3.5 h-3.5 text-white/50" />
                </span>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* SECTION OPTIONS & VARIANTES (Exactement identique à ProductDetailModal)   */}
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
                        src={images[activeImgIndex] || images[0]}
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
                        <span className="font-bold text-emerald-400">{stock} pièces</span>
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
                      {allVariantOptions.length > 0 ? (
                        allVariantOptions.map((sz, szIdx) => {
                          const cnt = variantStock[sz] ?? 0;
                          return (
                            <span
                              key={`merch-sz-${sz}-${szIdx}`}
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
                {allVariantOptions.length === 0 ? (
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
                    {allVariantOptions.map((option, optIdx) => {
                      const count = variantStock[option] ?? 5;
                      const isOut = count <= 0;
                      const isLow = count > 0 && count <= 2;
                      const optImages = variantImages[option] || [];

                      return (
                        <div
                          key={`merch-opt-${option}-${optIdx}`}
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
                            {optImages.length >= 2 ? (
                              <div className="flex items-center gap-2">
                                <img
                                  src={optImages[0]}
                                  alt={`${option} photo 1`}
                                  className="w-8 h-8 rounded-lg object-cover border-2 border-emerald-400 shadow"
                                />
                                <img
                                  src={optImages[1]}
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
                            ) : optImages.length === 1 ? (
                              <div className="flex items-center gap-2">
                                <img
                                  src={optImages[0]}
                                  alt=""
                                  className="w-8 h-8 rounded-lg object-cover border-2 border-emerald-400 shadow"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTargetOption(option);
                                    setTargetPhotoSlot(1);
                                    variantFileInputRef.current?.click();
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
                                  setActiveTargetOption(option);
                                  setTargetPhotoSlot(0);
                                  variantFileInputRef.current?.click();
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
            {/* ONGLETS INTERACTIFS (Description | Caractéristiques | Avis | Garantie)    */}
            {/* ========================================================================= */}
            <div className="p-4 rounded-3xl bg-white/[0.03] border border-white/10 space-y-4">
              {/* Navigation des Onglets (Design capsules tactiles avec icônes en relief) */}
              <div className="p-1.5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {/* 1. Description */}
                <button
                  type="button"
                  onClick={() => setActiveTabState('description')}
                  className={`flex-1 py-2 px-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 whitespace-nowrap group ${
                    activeTab === 'description'
                      ? 'bg-[#FF6321] text-white shadow-md shadow-orange-600/25 font-black'
                      : 'text-white/60 hover:text-white hover:bg-white/5 font-bold'
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={`w-3.5 h-3.5 filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] transition-transform group-hover:scale-110 ${
                      activeTab === 'description' ? 'fill-white' : 'fill-none stroke-current stroke-[2]'
                    }`}
                  >
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <span>Description</span>
                </button>

                {/* 2. Caractéristiques */}
                <button
                  type="button"
                  onClick={() => setActiveTabState('specs')}
                  className={`flex-1 py-2 px-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 whitespace-nowrap group ${
                    activeTab === 'specs'
                      ? 'bg-[#FF6321] text-white shadow-md shadow-orange-600/25 font-black'
                      : 'text-white/60 hover:text-white hover:bg-white/5 font-bold'
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={`w-3.5 h-3.5 filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] transition-transform group-hover:scale-110 ${
                      activeTab === 'specs' ? 'fill-white' : 'fill-none stroke-current stroke-[2]'
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
                  onClick={() => setActiveTabState('remboursement')}
                  className={`flex-1 py-2 px-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 whitespace-nowrap group ${
                    activeTab === 'remboursement'
                      ? 'bg-[#FF6321] text-white shadow-md shadow-orange-600/25 font-black'
                      : 'text-white/60 hover:text-white hover:bg-white/5 font-bold'
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={`w-3.5 h-3.5 filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] transition-transform group-hover:scale-110 ${
                      activeTab === 'remboursement' ? 'fill-white' : 'fill-none stroke-current stroke-[2]'
                    }`}
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                  <span>Remboursement</span>
                </button>
              </div>

              {/* CONTENU ONGLETS */}
              {activeTab === 'description' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-white/80 block">
                      Texte descriptif de l'article
                    </label>
                    <button
                      type="button"
                      onClick={generatePitch}
                      className="flex items-center gap-1 text-[10px] font-bold text-[#FF6321] hover:underline"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>✨ Rédiger pour moi avec IA</span>
                    </button>
                  </div>

                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Magnifique ensemble robe wax taillée sur mesure..."
                    className="w-full p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321] no-scrollbar leading-relaxed"
                  />

                  {/* Tags suggérés */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {SUGGESTED_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleToggleTag(tag)}
                        className={`text-[10px] px-2.5 py-1 rounded-full border transition ${
                          tags.includes(tag)
                            ? 'bg-[#FF6321] text-white border-[#FF6321] font-bold'
                            : 'bg-white/5 text-white/50 border-white/10 hover:text-white'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'specs' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <span className="font-bold">Fiche technique du produit</span>
                    <span className="text-[10px] text-white/50">Matière, entretien, coupe</span>
                  </div>

                  {/* Liste des caractéristiques existantes */}
                  <div className="space-y-1.5">
                    {Object.entries(specs).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs"
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
                      className="flex-1 p-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                    />
                    <input
                      type="text"
                      placeholder="Valeur (ex: 100% Soie)"
                      value={newSpecVal}
                      onChange={(e) => setNewSpecVal(e.target.value)}
                      className="flex-1 p-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                    />
                    <button
                      type="button"
                      onClick={handleAddSpec}
                      className="px-3 py-2 rounded-xl bg-white/10 hover:bg-[#FF6321] text-white text-xs font-bold transition flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ajouter</span>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'avis' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <span className="font-bold">Aperçu des avis clients vérifiés</span>
                    <span className="text-emerald-400 font-bold">⭐ 4.9 / 5 (100% avis positifs)</span>
                  </div>

                  <div className="space-y-2.5">
                    {MOCK_REVIEWS_PREVIEW.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{rev.author}</span>
                            <span className="text-[10px] text-white/40">📍 {rev.location}</span>
                          </div>
                          <div className="flex items-center text-amber-400 text-xs">
                            {'★'.repeat(rev.rating)}
                          </div>
                        </div>
                        <p className="text-xs text-white/80 leading-relaxed">{rev.comment}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'remboursement' && (
                <div className="space-y-4">
                  {/* Politique d'échange & Délai */}
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-white">Garantie & Délai d'échange</span>
                      </div>
                      <select
                        value={returnDays}
                        onChange={(e) => setReturnDays(Number(e.target.value))}
                        className="bg-neutral-800 text-white text-xs font-bold px-2.5 py-1 rounded-xl border border-white/15 focus:outline-none focus:border-[#FF6321]"
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
                            className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5"
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
                          className="flex-1 p-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                        />
                        <button
                          type="button"
                          onClick={handleAddRefundCond}
                          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-[#FF6321] text-white text-xs font-bold transition flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Ajouter</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Procédure de retour étape par étape */}
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
                    <span className="text-xs font-bold text-white block">
                      Étapes de remboursement affichées à l'acheteur :
                    </span>
                    <div className="space-y-1.5">
                      {refundSteps.map((step, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/5 text-xs text-white/90"
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
                            <Trash2 className="w-3 h-3" />
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
                        className="flex-1 p-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                      />
                      <button
                        type="button"
                        onClick={handleAddRefundStep}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-[#FF6321] text-white text-xs font-bold transition flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Ajouter</span>
                      </button>
                    </div>
                  </div>

                  {/* Moyens de paiement acceptés */}
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
                            onClick={() => handleTogglePayment(m)}
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
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. STICKY BOTTOM ACTION BAR (Identique au design de ProductDetailModal)   */}
        {/* ========================================================================= */}
        <footer className="sticky bottom-0 z-20 px-4 py-3 bg-[#121212]/95 backdrop-blur-md border-t border-white/10 flex items-center justify-between gap-2 shrink-0">
          {/* Bouton Supprimer */}
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="p-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition active:scale-95 flex items-center justify-center shrink-0"
            title="Supprimer la marchandise"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Bouton Annuler */}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition active:scale-95 text-center"
          >
            Annuler
          </button>

          {/* Bouton Enregistrer Principal */}
          <button
            type="button"
            onClick={handleSaveAll}
            className="flex-[2] py-3 px-4 rounded-2xl bg-[#FF6321] hover:bg-[#ff7538] text-white text-xs font-black transition flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30 active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Enregistrer ({stock} en stock)</span>
          </button>
        </footer>

        {/* ========================================================================= */}
        {/* 4. CONFIRM DELETE DIALOG                                                  */}
        {/* ========================================================================= */}
        {confirmDelete && (
          <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
            <div className="w-full max-w-sm rounded-3xl bg-[#171717] border border-white/15 p-5 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertCircle className="w-5 h-5" />
                <h3 className="font-black text-white text-base">Supprimer ce produit ?</h3>
              </div>
              <p className="text-xs text-white/60">
                Cette action retirera définitivement cet article de votre boutique et du catalogue Djassa.
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-xs font-bold text-white hover:bg-white/15 transition"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelete(false);
                    if (onDelete) {
                      onDelete();
                    }
                    onClose();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-rose-500 text-xs font-black text-white hover:bg-rose-600 transition shadow-lg shadow-rose-600/30"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
