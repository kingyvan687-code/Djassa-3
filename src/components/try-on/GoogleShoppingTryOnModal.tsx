import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  X, 
  Sparkles, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Layers, 
  Ruler, 
  Camera, 
  Upload, 
  ShoppingBag, 
  Zap, 
  ShieldCheck, 
  Info, 
  RotateCw, 
  Store,
  Sliders,
  CheckCircle2,
  Sparkle,
  Eye,
  Video,
  User
} from 'lucide-react';
import { Product, Seller } from '../../types';
import { formatFCFA } from '../../services/marketServices';
import { useApp } from '../../context/AppContext';
import { AI_BILLING_RATES } from '../../services/aiPricing';
import { creditsService } from '../../services/creditsService';
import { getSecurityToken } from '../../services/securityService';

// The Iconic Google 4-Color Sparkle SVG (Google AI / Try On emblem)
const GoogleSparkleIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M12 2C12.5 7.5 16.5 11.5 22 12C16.5 12.5 12.5 16.5 12 22C11.5 16.5 7.5 12.5 2 12C7.5 11.5 11.5 7.5 12 2Z" 
      fill="url(#google-sparkle-gradient)" 
    />
    <defs>
      <linearGradient id="google-sparkle-gradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#4285F4" />
        <stop offset="35%" stopColor="#EA4335" />
        <stop offset="70%" stopColor="#FBBC05" />
        <stop offset="100%" stopColor="#34A853" />
      </linearGradient>
    </defs>
  </svg>
);

import {
  TryOnModel,
  TRY_ON_MODELS,
  FEMALE_TRY_ON_MODELS,
  MALE_TRY_ON_MODELS
} from './tryOnModelsData';


interface GoogleShoppingTryOnModalProps {
  product: Product;
  onClose: () => void;
}

export const GoogleShoppingTryOnModal: React.FC<GoogleShoppingTryOnModalProps> = ({ 
  product, 
  onClose 
}) => {
  const { 
    sellers, 
    setVariantModalProduct, 
    addToCart, 
    showToast,
    aiCredits,
    spendAiCredits,
    setIsCreditModalOpen,
    openCreditModal,
    openAiVideoModal,
    addTryOnHistoryItem,
    refreshCreditsState,
    isAuthenticated,
    requireAuth
  } = useApp();

  const seller = useMemo(() => sellers.find((s) => s.id === product.sellerId), [sellers, product.sellerId]);

  // Mode: Customer Photo / Try on me (Mannequins réels tab removed)
  const [activeTab] = useState<'myPhoto'>('myPhoto');
  
  const defaultGender = useMemo<'homme' | 'femme'>(() => {
    const text = `${product.name} ${product.category || ''}`.toLowerCase();
    if (text.includes('homme') || text.includes('man') || text.includes('garçon') || text.includes('costume')) {
      return 'homme';
    }
    return 'femme';
  }, [product.name, product.category]);

  // Selected Model fallback with full-body morphology support
  const [selectedModel, setSelectedModel] = useState<TryOnModel>(() => {
    return defaultGender === 'homme' ? MALE_TRY_ON_MODELS[0] : FEMALE_TRY_ON_MODELS[0];
  });
  
  // Gender filter for models: all, female, male
  const [genderFilter, setGenderFilter] = useState<'all' | 'female' | 'male'>('all');

  // Size filter for models: All, XS-S, M-L, XL-3XL
  const [sizeFilter, setSizeFilter] = useState<'all' | 'xs_s' | 'm_l' | 'xl_plus'>('all');

  // View angle: front, side, back, details
  const [viewAngle, setViewAngle] = useState<'front' | 'side' | 'back' | 'details'>('front');

  // Selected size for checkout
  const [selectedSize, setSelectedSize] = useState<string>(selectedModel.size);

  // Selected color / pattern
  const availableColors = useMemo(() => {
    const colorVar = product.variants?.find((v) => 
      v.type.toLowerCase().includes('couleur') || v.type.toLowerCase().includes('color') || v.type.toLowerCase().includes('modèle')
    );
    return colorVar ? colorVar.options : ['Motif Original', 'Bleu Indigo', 'Orange Terracotta', 'Vert Émeraude'];
  }, [product.variants]);

  const [selectedColor, setSelectedColor] = useState<string>(availableColors[0] || 'Original');

  // AI Fitting simulation animation state
  const [isAiFitting, setIsAiFitting] = useState(false);

  // Custom customer uploaded photo for try-on
  const [userUploadedPhoto, setUserUploadedPhoto] = useState<string | null>(null);
  const [uploadedPhotosList, setUploadedPhotosList] = useState<string[]>([]);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Model gender filter for predefined try-on silhouettes ('homme' | 'femme')
  const [modelGenderFilter, setModelGenderFilter] = useState<'homme' | 'femme'>(() => {
    const text = `${product.name} ${product.category || ''}`.toLowerCase();
    if (text.includes('homme') || text.includes('man') || text.includes('garçon') || text.includes('costume')) {
      return 'homme';
    }
    return 'femme';
  });

  // Smart size recommendation tool state
  const [showSizeAdvisor, setShowSizeAdvisor] = useState(false);
  const [userHeightCm, setUserHeightCm] = useState<number>(168);
  const [userWeightKg, setUserWeightKg] = useState<number>(64);

  // Calculate recommended size
  const recommendedSize = useMemo(() => {
    const bmi = userWeightKg / ((userHeightCm / 100) * (userHeightCm / 100));
    if (bmi < 19) return 'XS';
    if (bmi < 22) return 'S';
    if (bmi < 26) return 'M';
    if (bmi < 30) return 'L';
    if (bmi < 35) return 'XL';
    return '2XL';
  }, [userHeightCm, userWeightKg]);

  const [isGeneratingTryOn, setIsGeneratingTryOn] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStep, setGenerationStep] = useState('');
  const [hasGeneratedImage, setHasGeneratedImage] = useState(false);
  const [generatedTryOnUrl, setGeneratedTryOnUrl] = useState<string | null>(null);
  const [showOriginalModel, setShowOriginalModel] = useState(false);

  const handleLaunchTryOn = async () => {
    if (!isAuthenticated) {
      requireAuth('tryon', { type: 'tryon', product });
      return;
    }

    if (!getSecurityToken()) {
      showToast('Connectez-vous pour lancer une génération Try-On IA.');
      return;
    }

    const cost = AI_BILLING_RATES.IMAGE_GENERATION;
    if (aiCredits < cost) {
      showToast(`Crédits IA insuffisants (${aiCredits}/${cost} crédits requis pour 1 création d'image)`);
      openCreditModal('client');
      return;
    }

    setIsGeneratingTryOn(true);
    setGenerationProgress(25);
    setGenerationStep("Envoi de votre silhouette au moteur RodiumAI (Qwen Image 2.1 Turbo)...");

    try {
      const caps = await creditsService.getAiCapabilities();
      if (!caps.image) {
        setIsGeneratingTryOn(false);
        setGenerationProgress(0);
        showToast('Génération image IA indisponible : clé API RodiumAI (RODIUMAI_API_KEY) non configurée côté serveur. Aucun crédit débité.');
        return;
      }

      setGenerationProgress(60);
      setGenerationStep("Génération de la tenue avec Qwen Image 2.1 Turbo...");
      const res = await creditsService.generateTryOn({
        userPhoto: activeImage,
        productImage: garmentImage,
        productName: product.name,
        productCategory: product.category,
        modelId: userUploadedPhoto ? 'custom-user-photo' : selectedModel.id,
        modelName: userUploadedPhoto ? 'Ma Silhouette Personnelle' : selectedModel.name,
        modelGender: userUploadedPhoto
          ? (modelGenderFilter === 'homme' ? 'male' : 'female')
          : selectedModel.gender,
        morphology: userUploadedPhoto ? 'Silhouette personnelle importée' : selectedModel.morphologyLabel,
        morphologyDetail: userUploadedPhoto ? 'Photo personnelle importée par le client' : selectedModel.morphology,
        size: selectedSize,
        color: selectedColor,
        viewAngle: viewAngle === 'details' ? 'front' : viewAngle,
        drapeFitNotes: userUploadedPhoto ? undefined : selectedModel.drapeFitNotes
      });

      setGenerationProgress(100);
      setGeneratedTryOnUrl(res.imageDataUrl);
      setHasGeneratedImage(true);
      setShowOriginalModel(false);
      await refreshCreditsState?.();
      addTryOnHistoryItem({
        productId: product.id,
        productName: product.name,
        productPrice: product.price,
        productOriginalPrice: product.originalPrice,
        productImage: garmentImage,
        sellerId: product.sellerId,
        sellerName: seller?.name || 'Boutique Partenaire',
        generatedImageUrl: res.imageDataUrl,
        modelName: userUploadedPhoto
          ? 'Ma Silhouette Personnelle'
          : `${selectedModel.name} • ${selectedModel.morphologyLabel} (${selectedModel.size})`,
        size: selectedSize,
        color: selectedColor,
        angle: viewAngle === 'details' ? 'front' : viewAngle
      });
      showToast(`Tenue essayée et enregistrée dans votre profil (-${cost} crédits).`);
    } catch (err) {
      setHasGeneratedImage(false);
      showToast(err instanceof Error ? err.message : 'Erreur lors de la génération Try-On. Aucun crédit débité.');
    } finally {
      setIsGeneratingTryOn(false);
    }
  };

  // Handle changing model
  const handleSelectModel = (model: TryOnModel) => {
    if (model.id === selectedModel.id) return;
    setSelectedModel(model);
    setSelectedSize(model.size);
    setHasGeneratedImage(false);
    setGeneratedTryOnUrl(null);
    setIsAiFitting(false);
  };

  // Filtered models by gender and size
  const filteredModels = useMemo(() => {
    return TRY_ON_MODELS.filter((m) => {
      if (genderFilter !== 'all' && m.gender !== genderFilter) return false;
      if (sizeFilter === 'xs_s') return ['XS', 'S'].includes(m.size);
      if (sizeFilter === 'm_l') return ['M', 'L'].includes(m.size);
      if (sizeFilter === 'xl_plus') return ['XL', '2XL', '3XL'].includes(m.size);
      return true;
    });
  }, [genderFilter, sizeFilter]);

  // Process an uploaded photo file
  const processPhotoFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Veuillez sélectionner un format image valide (JPG, PNG, WebP)');
      return;
    }

    setIsProcessingUpload(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setUserUploadedPhoto(result);
        setUploadedPhotosList((prev) => [result, ...prev.filter((p) => p !== result)].slice(0, 5));
        setHasGeneratedImage(false);
        setGeneratedTryOnUrl(null);
        setIsProcessingUpload(false);
        showToast("Photo importée pour l'essayage virtuel !");
      }
    };
    reader.onerror = () => {
      setIsProcessingUpload(false);
      showToast('Impossible de lire ce fichier image.');
    };
    reader.readAsDataURL(file);
  };

  // Handle custom photo upload via file input
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processPhotoFile(file);
    }
    e.target.value = '';
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processPhotoFile(file);
    }
  };

  const handleDirectBuy = () => {
    setVariantModalProduct(product);
    onClose();
  };

  const handleAddToCart = () => {
    addToCart(product.id, {
      'Taille': selectedSize,
      'Couleur': selectedColor
    }, 1);
    showToast(`Taille ${selectedSize} ajoutée au panier !`);
  };

  // Main active try on image preview dynamically responding to viewAngle ('front' | 'side' | 'back')
  const activeImage = useMemo(() => {
    // If the customer uploaded their personal photo
    if (userUploadedPhoto) {
      if (viewAngle === 'front') return userUploadedPhoto;
      // In profile or back view, show the corresponding angle of the matching silhouette
      if (viewAngle === 'side') return selectedModel.sideImage;
      if (viewAngle === 'back') return selectedModel.backImage;
      return userUploadedPhoto;
    }

    // Predefined model angles: face (frontImage), profil (sideImage), derrière (backImage)
    if (viewAngle === 'side') {
      return selectedModel.sideImage || selectedModel.frontImage;
    }
    if (viewAngle === 'back') {
      return selectedModel.backImage || selectedModel.frontImage;
    }
    return selectedModel.frontImage;
  }, [userUploadedPhoto, selectedModel, viewAngle]);

  // List of all photos for this product
  const productImagesList = useMemo(() => {
    if (product.images && product.images.length > 0) {
      return product.images;
    }
    const fallback = product.videoPoster || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80';
    return [fallback];
  }, [product.images, product.videoPoster]);

  const [activeProductImageIndex, setActiveProductImageIndex] = useState<number>(0);
  const garmentImage = productImagesList[activeProductImageIndex] || productImagesList[0];
  const [isProductZoomModalOpen, setIsProductZoomModalOpen] = useState(false);

  return (
    <div 
      id="modal-google-shopping-try-on" 
      className="fixed inset-0 z-[140] bg-black/85 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 overflow-hidden animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl h-[94vh] sm:h-[90vh] bg-[#121212] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* =========================================================================
            1. GOOGLE SHOPPING TRY ON - BRANDED HEADER
            ========================================================================= */}
        <header className="px-4 py-3 bg-[#1A1A1A] border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center p-1.5 shadow-inner">
              <GoogleSparkleIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                  <span>Essayage virtuel</span>
                </h2>
              </div>
              <p className="text-[10px] text-white/50">
                Visualisez le tombé et les plis sur votre photo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => openCreditModal('client')}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 border border-amber-400/40 text-amber-300 text-[10px] font-black shadow hover:bg-black/80 transition active:scale-95"
              title="Consulter et recharger vos crédits IA RodiumAI"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>{aiCredits} crédits</span>
              <span className="w-3.5 h-3.5 rounded-full bg-amber-400 text-black flex items-center justify-center text-[9px] font-black">+</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition active:scale-90"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Mini Product Header Bar */}
        <div className="px-4 py-2 bg-[#181818] border-b border-white/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <img 
              src={garmentImage} 
              alt={product.name} 
              className="w-9 h-9 rounded-lg object-cover border border-white/10 shrink-0" 
            />
            <div className="min-w-0">
              <h3 className="font-bold text-white truncate text-xs">{product.name}</h3>
              <p className="text-[10px] text-white/50 truncate">
                Vendeur : @{seller?.username || 'boutique'} • {seller?.location || 'Adjamé'}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-xs font-black text-[#FF6321]">
              {formatFCFA(product.price)}
            </span>
            <p className="text-[9px] text-emerald-400 font-semibold">En stock</p>
          </div>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
          {/* =========================================================================
              2. MAIN HERO TRY-ON STAGE (FULL-BODY UN-CROPPED MODEL DISPLAY)
              ========================================================================= */}
          <div className="relative w-full aspect-[3/4] min-h-[380px] sm:min-h-[420px] bg-[#161618] overflow-hidden flex items-center justify-center group">
            {/* Ambient Background glow */}
            <div className="absolute inset-0 bg-radial from-white/5 via-transparent to-black pointer-events-none" />

            {/* Model full-body studio portrait (object-contain so head-to-toe silhouette is never cropped) */}
            <img
              key={`${selectedModel.id}-${viewAngle}-${userUploadedPhoto ? 'upload' : 'preset'}-${hasGeneratedImage ? 'ai' : 'raw'}`}
              src={hasGeneratedImage && !showOriginalModel && generatedTryOnUrl ? generatedTryOnUrl : activeImage}
              alt={`${selectedModel.name} (${selectedModel.morphologyLabel} - Taille ${selectedModel.size}) - Vue ${viewAngle === 'front' ? 'de face' : viewAngle === 'side' ? 'de profil' : 'de dos'}`}
              className={`w-full h-full object-contain transition-all duration-300 animate-fadeIn ${
                isAiFitting ? 'scale-105 blur-sm opacity-60' : 'scale-100 blur-0 opacity-100'
              }`}
            />

            {/* Realistic Photorealistic Overlay Composite of the Clothing Garment */}
            {!showOriginalModel && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* Garment & selected morphology badge */}
                <div className="absolute bottom-3 right-3 p-1.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/15 flex items-center gap-2 shadow-xl">
                  <img 
                    src={garmentImage} 
                    alt="Article" 
                    className="w-7 h-7 rounded-lg object-cover border border-white/20" 
                  />
                  <div className="pr-1.5 text-left">
                    <p className="text-[9px] font-bold text-white leading-none">
                      {hasGeneratedImage ? 'Rendu IA appliqué' : 'Tenue sélectionnée'}
                    </p>
                    <p className="text-[8px] text-white/70 leading-tight mt-0.5">
                      {userUploadedPhoto
                        ? 'Ma photo personnelle'
                        : `${selectedModel.name} • ${selectedModel.morphologyLabel} (${selectedModel.size})`} • {selectedColor}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Google Shopping Try On Generative Scanning Pipeline */}
            {isGeneratingTryOn && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-black/70 backdrop-blur-xs animate-fadeIn">
                {/* Laser scan line moving across the image */}
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-[#4285F4] via-[#EA4335] via-[#FBBC05] to-[#34A853] shadow-[0_0_20px_rgba(66,133,244,0.9)] animate-pulse top-1/2 -translate-y-1/2" />
                
                <div className="relative p-4 rounded-3xl bg-neutral-900/90 border border-white/20 shadow-2xl flex flex-col items-center text-center max-w-xs space-y-3">
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#4285F4]/30 via-[#EA4335]/20 to-[#34A853]/30 border border-white/30 flex items-center justify-center shadow-lg">
                    <GoogleSparkleIcon className="w-8 h-8 animate-spin" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white">Création de l'image d'essayage</h4>
                    <p className="text-[10px] text-white/70 mt-1 leading-relaxed">{generationStep}</p>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#4285F4] via-[#EA4335] via-[#FBBC05] to-[#34A853] transition-all duration-300"
                      style={{ width: `${generationProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-extrabold text-emerald-400">
                    Qwen Image 2.1 Turbo • {generationProgress}%
                  </span>
                </div>
              </div>
            )}

            {/* RodiumAI Model Switch Shimmer */}
            {isAiFitting && !isGeneratingTryOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-xs z-20 animate-fadeIn">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mb-2 shadow-2xl">
                  <GoogleSparkleIcon className="w-7 h-7 animate-spin" />
                </div>
                <span className="text-xs font-bold text-white bg-black/60 px-3 py-1 rounded-full border border-white/20 shadow-lg">
                  Ajustement morphologique RodiumAI...
                </span>
              </div>
            )}

            {/* Generated Image Success Banner */}
            {hasGeneratedImage && !isGeneratingTryOn && (
              <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-500/40 text-emerald-300 text-[10px] font-black shadow-lg animate-fadeIn">
                <span>✦ Image d'essayage générée</span>
                <span className="text-white/60">• RodiumAI</span>
              </div>
            )}

            {/* Angle view selector pills (Top Left of image) */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-black/75 backdrop-blur-md p-1 rounded-full border border-white/20 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setViewAngle('front');
                  showToast(`${selectedModel.name} • Vue de face`);
                }}
                className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold transition active:scale-95 cursor-pointer flex items-center gap-1 ${
                  viewAngle === 'front' 
                    ? 'bg-gradient-to-r from-[#FF6321] to-amber-500 text-white shadow-md shadow-orange-950/50 ring-1 ring-white/30' 
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>Face</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewAngle('side');
                  showToast(`${selectedModel.name} • Vue de profil (90°)`);
                }}
                className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold transition active:scale-95 cursor-pointer flex items-center gap-1 ${
                  viewAngle === 'side' 
                    ? 'bg-gradient-to-r from-[#FF6321] to-amber-500 text-white shadow-md shadow-orange-950/50 ring-1 ring-white/30' 
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>De profil</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewAngle('back');
                  showToast(`${selectedModel.name} • Vue de dos / derrière (180°)`);
                }}
                className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold transition active:scale-95 cursor-pointer flex items-center gap-1 ${
                  viewAngle === 'back' 
                    ? 'bg-gradient-to-r from-[#FF6321] to-amber-500 text-white shadow-md shadow-orange-950/50 ring-1 ring-white/30' 
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>Derrière</span>
              </button>
              {hasGeneratedImage && (
                <button
                  type="button"
                  onClick={() => setShowOriginalModel(!showOriginalModel)}
                  className={`px-2.5 py-1.5 rounded-full text-[10px] font-bold transition active:scale-95 cursor-pointer ${
                    showOriginalModel ? 'bg-amber-400 text-black shadow' : 'bg-white/10 text-white/90 hover:text-white'
                  }`}
                  title="Comparer avec/sans la tenue"
                >
                  {showOriginalModel ? 'Sans tenue' : 'Avant/Après'}
                </button>
              )}
            </div>

            {/* Perspective & morphology badge (Top Right of image) */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-[10px] font-bold text-white shadow-lg pointer-events-none">
              <span className={`w-1.5 h-1.5 rounded-full ${viewAngle === 'front' ? 'bg-emerald-400' : viewAngle === 'side' ? 'bg-[#FF6321]' : 'bg-purple-400'} animate-pulse`} />
              <span>
                {userUploadedPhoto
                  ? 'Photo client'
                  : `${selectedModel.name} • ${selectedModel.morphologyLabel} (${selectedModel.size})`}
              </span>
            </div>
          </div>

          {/* =========================================================================
              ZONE D'IMPORTATION DE PHOTOS POUR ESSAYER LA TENUE
              ========================================================================= */}
          <div className="p-3.5 border-b border-white/10 bg-[#171717] space-y-3">
            {/* Hidden inputs for gallery selection and camera capture */}
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              onChange={handlePhotoUpload} 
              className="hidden" 
            />
            <input 
              ref={cameraInputRef}
              type="file" 
              accept="image/*" 
              capture="user"
              onChange={handlePhotoUpload} 
              className="hidden" 
            />

            {/* Header de la zone d'importation */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#FF6321]/20 text-[#FF6321] flex items-center justify-center">
                  <Camera className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Importer vos photos pour essayer la tenue</span>
                  </h4>
                  <p className="text-[9px] text-white/50">
                    Prenez une photo ou importez depuis votre galerie
                  </p>
                </div>
              </div>

              <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                {userUploadedPhoto ? 'Photo chargée' : 'Détection IA'}
              </span>
            </div>

            {/* Disposition côte à côte sur la même ligne (Side by side grid) */}
            <div className="grid grid-cols-2 gap-3 items-stretch">
              {/* Carte 1 : Photo du produit à essayer */}
              <div className="rounded-2xl bg-black/40 border border-white/10 p-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-white/80 flex items-center gap-1">
                      <ShoppingBag className="w-3 h-3 text-[#FF6321]" />
                      La tenue
                    </span>
                    <span className="text-[9px] font-extrabold text-[#FF6321]">
                      {formatFCFA(product.price)}
                    </span>
                  </div>

                  {/* Main Product Image Container */}
                  <div 
                    className="relative w-full aspect-square rounded-xl overflow-hidden bg-neutral-900 border border-white/10 cursor-pointer group"
                    onClick={() => setIsProductZoomModalOpen(true)}
                  >
                    <img 
                      src={garmentImage} 
                      alt={product.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                    <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-[9px] font-bold text-white px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-xs flex items-center gap-1">
                        <Eye className="w-2.5 h-2.5" />
                        Agrandir
                      </span>
                    </div>
                    <div className="absolute top-1 left-1 px-1.5 py-0.2 rounded-md bg-black/75 text-[8px] font-mono text-white/80">
                      {activeProductImageIndex + 1}/{productImagesList.length}
                    </div>
                  </div>
                </div>

                <div className="mt-2 text-left">
                  <p className="text-[10px] font-bold text-white truncate">{product.name}</p>
                  <p className="text-[9px] text-white/50">{selectedColor} • {selectedSize}</p>
                </div>
              </div>

              {/* Carte 2 : Zone pour importer vos photos pour essayer la tenue */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative rounded-2xl border-2 border-dashed p-2.5 flex flex-col justify-between items-center text-center transition ${
                  isDragging 
                    ? 'border-[#FF6321] bg-[#FF6321]/15 scale-[1.02]' 
                    : userUploadedPhoto
                      ? 'border-emerald-500/40 bg-emerald-950/20'
                      : 'border-white/20 hover:border-[#FF6321] bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="w-full flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-white/80 flex items-center gap-1">
                    <Camera className="w-3 h-3 text-[#FF6321]" />
                    Votre photo
                  </span>
                  {userUploadedPhoto && (
                    <button
                      type="button"
                      onClick={() => {
                        setUserUploadedPhoto(null);
                        setHasGeneratedImage(false);
                        showToast('Photo réinitialisée');
                      }}
                      className="text-[9px] text-white/50 hover:text-rose-400 transition"
                      title="Retirer la photo"
                    >
                      Effacer
                    </button>
                  )}
                </div>

                {isProcessingUpload ? (
                  <div className="w-full aspect-square rounded-xl bg-black/50 border border-white/10 flex flex-col items-center justify-center p-2 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-[#FF6321]/20 flex items-center justify-center mb-1 text-[#FF6321]">
                      <RotateCw className="w-4 h-4 animate-spin" />
                    </div>
                    <span className="text-[10px] font-bold text-white">Analyse IA...</span>
                    <span className="text-[8px] text-white/50 mt-0.5">Détection du corps</span>
                  </div>
                ) : userUploadedPhoto ? (
                  <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-neutral-900 border border-emerald-500/40 group">
                    <img 
                      src={userUploadedPhoto} 
                      alt="Votre photo d'essayage" 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 rounded-full bg-[#FF6321] text-white text-[9px] font-bold shadow hover:bg-[#e05518] transition flex items-center gap-1"
                      >
                        <Upload className="w-2.5 h-2.5" />
                        Changer
                      </button>
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="px-2.5 py-1 rounded-full bg-white/20 text-white text-[9px] font-bold backdrop-blur-xs hover:bg-white/30 transition flex items-center gap-1"
                      >
                        <Camera className="w-2.5 h-2.5" />
                        Reprendre
                      </button>
                    </div>
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/75 text-[8px] font-bold text-emerald-400 flex items-center gap-1">
                      <Check className="w-2.5 h-2.5" />
                      Prête
                    </div>
                  </div>
                ) : (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-square rounded-xl bg-black/40 border border-white/10 hover:border-[#FF6321]/60 flex flex-col items-center justify-center p-2 cursor-pointer group transition"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#FF6321]/20 text-[#FF6321] flex items-center justify-center mb-1.5 group-hover:scale-110 transition shadow-inner">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold text-white leading-tight">
                      Importer une photo
                    </span>
                    <span className="text-[8px] text-white/50 mt-1 leading-tight">
                      Glisser ou cliquer ici
                    </span>
                  </div>
                )}

                <div className="mt-2 text-center w-full">
                  <p className="text-[9px] text-white/60 leading-tight">
                    {userUploadedPhoto ? 'Photo prête pour l\'essayage' : 'Buste ou plein pied conseillé'}
                  </p>
                </div>
              </div>
            </div>

            {/* Boutons d'action directs pour l'import de photos */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-[11px] font-bold transition active:scale-95 cursor-pointer shadow-sm"
              >
                <Camera className="w-3.5 h-3.5 text-[#FF6321]" />
                <span>Prendre une photo</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#FF6321] hover:bg-[#e05518] text-white text-[11px] font-bold transition active:scale-95 cursor-pointer shadow-md"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Galerie photos</span>
              </button>
            </div>

            {/* Liste des photos récemment importées pour l'essayage */}
            {uploadedPhotosList.length > 0 && (
              <div className="pt-1.5 border-t border-white/5">
                <span className="text-[9px] font-bold text-white/60 block mb-1.5">
                  Vos photos importées ({uploadedPhotosList.length}) :
                </span>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                  {uploadedPhotosList.map((photoUrl, idx) => {
                    const isSelected = userUploadedPhoto === photoUrl;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setUserUploadedPhoto(photoUrl);
                          setHasGeneratedImage(false);
                          showToast(`Photo ${idx + 1} sélectionnée pour l'essayage`);
                        }}
                        className={`relative w-11 h-11 rounded-xl overflow-hidden border shrink-0 transition active:scale-95 cursor-pointer ${
                          isSelected
                            ? 'border-[#FF6321] ring-2 ring-[#FF6321]/40 scale-105'
                            : 'border-white/10 hover:border-white/30 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                        {isSelected && (
                          <div className="absolute inset-0 bg-[#FF6321]/30 flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Thumbnails Gallery si plusieurs images de produit */}
            {productImagesList.length > 1 && (
              <div className="space-y-1 pt-1 border-t border-white/5">
                <span className="text-[9px] font-bold text-white/60">
                  Autres vues de l'article ({productImagesList.length}) :
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {productImagesList.map((imgUrl, idx) => {
                    const isSelected = idx === activeProductImageIndex;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setActiveProductImageIndex(idx);
                          showToast(`Vue ${idx + 1} du produit sélectionnée`);
                        }}
                        className={`relative w-10 h-10 rounded-lg overflow-hidden border shrink-0 transition active:scale-95 cursor-pointer ${
                          isSelected
                            ? 'border-[#FF6321] ring-2 ring-[#FF6321]/40 scale-105'
                            : 'border-white/10 hover:border-white/30 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                        {isSelected && (
                          <div className="absolute inset-0 bg-[#FF6321]/20 flex items-center justify-center">
                            <Check className="w-3 h-3 text-white drop-shadow" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* =========================================================================
              SILHOUETTES & MANNEQUINS TYPES (HOMME & FEMME SÉPARÉS - PLEIN PIED)
              ========================================================================= */}
          <div className="p-3.5 space-y-3 bg-[#161616] rounded-2xl border border-white/5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold text-white/90 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#FF6321]" />
                  <span>Mannequins & morphologies plein pied :</span>
                </span>
                <p className="text-[9px] text-white/50 mt-0.5">
                  Choisissez une morphologie ({modelGenderFilter === 'homme' ? '4 gabarits Homme' : '4 gabarits Femme'})
                </p>
              </div>

              {/* Sélecteur de Genre strictement séparé : Hommes / Femmes */}
              <div className="flex items-center p-0.5 rounded-xl bg-black/40 border border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setModelGenderFilter('homme');
                    if (selectedModel.gender !== 'male') {
                      const nextMale = MALE_TRY_ON_MODELS[0];
                      setUserUploadedPhoto(null);
                      setSelectedModel(nextMale);
                      setSelectedSize(nextMale.size);
                      setHasGeneratedImage(false);
                      setGeneratedTryOnUrl(null);
                    }
                    showToast('Mannequins Homme affichés');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                    modelGenderFilter === 'homme'
                      ? 'bg-[#FF6321] text-white shadow-sm'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <span>Hommes</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModelGenderFilter('femme');
                    if (selectedModel.gender !== 'female') {
                      const nextFemale = FEMALE_TRY_ON_MODELS[0];
                      setUserUploadedPhoto(null);
                      setSelectedModel(nextFemale);
                      setSelectedSize(nextFemale.size);
                      setHasGeneratedImage(false);
                      setGeneratedTryOnUrl(null);
                    }
                    showToast('Mannequins Femme affichés');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                    modelGenderFilter === 'femme'
                      ? 'bg-[#FF6321] text-white shadow-sm'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <span>Femmes</span>
                </button>
              </div>
            </div>

            {/* Grille Plein Pied des 4 Morphologies du genre actif (sans recadrage) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {(modelGenderFilter === 'homme' ? MALE_TRY_ON_MODELS : FEMALE_TRY_ON_MODELS).map((presetModel) => {
                const isSelected = !userUploadedPhoto && selectedModel.id === presetModel.id;
                return (
                  <button
                    key={presetModel.id}
                    type="button"
                    aria-label={`Mannequin ${presetModel.name} - ${presetModel.morphologyLabel} (${presetModel.size})`}
                    onClick={() => {
                      setUserUploadedPhoto(null);
                      setSelectedModel(presetModel);
                      setSelectedSize(presetModel.size);
                      setHasGeneratedImage(false);
                      setGeneratedTryOnUrl(null);
                      showToast(`${presetModel.name} • Morphologie ${presetModel.morphologyLabel} (${presetModel.size}) sélectionnée`);
                    }}
                    className={`relative p-2 rounded-2xl border text-left flex flex-col gap-1.5 transition active:scale-[0.98] cursor-pointer ${
                      isSelected
                        ? 'bg-orange-500/15 border-[#FF6321] ring-2 ring-[#FF6321]/40 shadow-md shadow-orange-950/30'
                        : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10'
                    }`}
                  >
                    <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-[#1b1b1e] border border-white/10 flex items-center justify-center">
                      <img
                        src={presetModel.frontImage}
                        alt={`${presetModel.name} — Morphologie ${presetModel.morphologyLabel} (${presetModel.size})`}
                        className="w-full h-full object-contain"
                      />
                      <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/80 border border-white/20 text-[9px] font-black text-amber-300">
                        {presetModel.size}
                      </span>
                      {isSelected && (
                        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[#FF6321] text-white text-[8px] font-black">
                          Actif
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5 px-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-extrabold text-white truncate">
                          {presetModel.name}
                        </span>
                        <span className="text-[9px] text-white/50 shrink-0">
                          {presetModel.height}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-[#FF8540] block truncate">
                        {presetModel.morphologyLabel}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {!userUploadedPhoto && (
              <div className="px-3 py-2 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-2 text-[10px]">
                <span className="text-white/80 truncate">
                  Actif : <strong className="text-white">{selectedModel.name}</strong> • {selectedModel.morphologyLabel} ({selectedModel.size})
                </span>
                <span className="text-emerald-400 font-bold shrink-0">Plein pied</span>
              </div>
            )}
          </div>


          {/* =========================================================================
              6. SIZE ADVISOR MODAL / ACCORDION
              ========================================================================= */}
          {showSizeAdvisor && (
            <div className="m-4 p-3.5 rounded-2xl bg-gradient-to-r from-blue-900/30 via-purple-900/30 to-orange-900/30 border border-white/15 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-[#FF6321]" />
                  <span className="text-xs font-bold text-white">Conseiller de taille IA RodiumAI</span>
                </div>
                <button 
                  onClick={() => setShowSizeAdvisor(false)} 
                  className="text-white/60 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[10px] text-white/60">Votre taille (cm)</label>
                  <input
                    type="number"
                    value={userHeightCm}
                    onChange={(e) => setUserHeightCm(Number(e.target.value) || 168)}
                    className="w-full mt-1 px-3 py-1.5 rounded-xl bg-black/40 border border-white/15 text-white font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/60">Votre poids (kg)</label>
                  <input
                    type="number"
                    value={userWeightKg}
                    onChange={(e) => setUserWeightKg(Number(e.target.value) || 64)}
                    className="w-full mt-1 px-3 py-1.5 rounded-xl bg-black/40 border border-white/15 text-white font-bold text-xs"
                  />
                </div>
              </div>

              <div className="p-2 rounded-xl bg-black/50 border border-emerald-500/30 flex items-center justify-between text-xs">
                <span className="text-white/80">Taille recommandée pour vous :</span>
                <span className="text-sm font-black text-emerald-400 px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40">
                  {recommendedSize}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            7. BOTTOM ACTION FOOTER (SIZE SELECTOR & DIRECT CHECKOUT)
            ========================================================================= */}
        <footer className="p-3 bg-[#1A1A1A] border-t border-white/10 shrink-0 space-y-2.5">
          {/* BOUTON D'ESSAYAGE DE LA TENUE (CRÉATION DE L'IMAGE - 10 CRÉDITS) */}
          <button
            id="btn-launch-try-on"
            onClick={handleLaunchTryOn}
            disabled={isGeneratingTryOn}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#4285F4] via-[#7B1FA2] to-[#FF6321] hover:opacity-95 active:scale-[0.98] text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl shadow-purple-900/40 transition border border-white/25 disabled:opacity-60 cursor-pointer"
          >
            {isGeneratingTryOn ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin text-white" />
                <span>Création de l'image d'essayage en cours ({generationProgress}%)...</span>
              </>
            ) : hasGeneratedImage ? (
              <>
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                <span>✦ Régénérer l'essayage (Nouvelle image • {AI_BILLING_RATES.IMAGE_GENERATION} crédits)</span>
              </>
            ) : (
              <>
                <GoogleSparkleIcon className="w-5 h-5" />
                <span>✦ Essayer la tenue (Génération image • {AI_BILLING_RATES.IMAGE_GENERATION} crédits)</span>
              </>
            )}
          </button>

          {/* Action Buttons Row */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddToCart}
              className="flex-1 py-2.5 px-3 rounded-2xl bg-white/10 hover:bg-white/15 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition border border-white/10"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Ajouter au panier</span>
            </button>

            <button
              onClick={handleDirectBuy}
              className="flex-1 py-2.5 px-3 rounded-2xl bg-[#FF6321] hover:bg-[#ff753a] active:scale-95 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-lg shadow-orange-600/30 transition"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Commander ({formatFCFA(product.price)})</span>
            </button>
          </div>
        </footer>
      </div>

      {/* Zoom Modal for Product Photo */}
      {isProductZoomModalOpen && (
        <div 
          className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setIsProductZoomModalOpen(false)}
        >
          <div 
            className="relative max-w-lg w-full bg-[#1A1A1A] border border-white/20 rounded-3xl overflow-hidden shadow-2xl p-4 flex flex-col space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">{product.name}</h4>
                <p className="text-[10px] text-white/60">Photo du produit à essayer • {formatFCFA(product.price)}</p>
              </div>
              <button 
                onClick={() => setIsProductZoomModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-black/60 border border-white/10 flex items-center justify-center">
              <img 
                src={garmentImage} 
                alt={product.name} 
                className="w-full h-full object-contain" 
              />
            </div>

            {productImagesList.length > 1 && (
              <div className="flex items-center justify-center gap-2 overflow-x-auto no-scrollbar py-1">
                {productImagesList.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveProductImageIndex(idx)}
                    className={`w-12 h-12 rounded-xl overflow-hidden border transition cursor-pointer ${
                      idx === activeProductImageIndex ? 'border-[#FF6321] ring-2 ring-[#FF6321]/40' : 'border-white/15 opacity-60'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
