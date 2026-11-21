import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Camera,
  Video as VideoIcon,
  User,
  AtSign,
  FileText,
  MapPin,
  Phone,
  Mail,
  Wallet,
  Globe,
  Instagram,
  Sparkles,
  Shirt,
  Heart,
  Eye,
  ShieldCheck,
  Check,
  X,
  Copy,
  Upload,
  AlertCircle,
  Footprints,
  Info,
  CheckCircle2,
  Sliders,
  Play,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface EditProfileScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

const ABIDJAN_COMMUNES = [
  'Cocody',
  'Yopougon',
  'Adjamé',
  'Marcory',
  'Plateau',
  'Koumassi',
  'Treichville',
  'Port-Bouët',
  'Abobo',
  'Attécoubé',
  'Bingerville',
  'Songon',
  'Anyama',
  'Grand-Bassam'
];

const PRESET_AVATARS = [
  { url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400', label: 'Amina (Style Wax)' },
  { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', label: 'Koffi (Casual Chic)' },
  { url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400', label: 'Fatou (Élégance)' },
  { url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400', label: 'Yvan (Créateur)' },
  { url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400', label: 'Mariam (Tendance)' },
  { url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400', label: 'Jean-Marc (Urbain)' },
  { url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400', label: 'Grace (Vogue)' },
  { url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400', label: 'Ibrahim (Minimaliste)' }
];

const SAMPLE_PROFILE_VIDEOS = [
  {
    url: 'https://assets.mixkit.co/videos/preview/mixkit-fashion-model-showing-clothes-in-a-studio-34351-large.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=300',
    title: 'Showcase Mode & Style'
  },
  {
    url: 'https://assets.mixkit.co/videos/preview/mixkit-young-woman-posing-for-the-camera-in-a-studio-41400-large.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300',
    title: 'Lookbook Urbain Abidjan'
  },
  {
    url: 'https://assets.mixkit.co/videos/preview/mixkit-hands-holding-a-smartphone-with-green-screen-40760-large.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=300',
    title: 'Shopping Addict Djassa'
  }
];

const PAYMENT_METHODS = [
  { id: 'wave', name: 'Wave Côte d\'Ivoire', color: 'bg-[#1DC4FF]/10 text-[#1DC4FF] border-[#1DC4FF]/30', icon: '🌊', fee: 'Paiement en ligne sécurisé' },
  { id: 'orange', name: 'Orange Money', color: 'bg-[#FF6600]/10 text-[#FF6600] border-[#FF6600]/30', icon: '🍊', fee: 'Paiement en ligne sécurisé' },
  { id: 'cash', name: 'Espèces à la livraison', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: '💵', fee: '0 % de frais client' }
];

const CLOTHING_SIZES = ['XS (34)', 'S (36)', 'M (38)', 'L (40)', 'XL (42)', 'XXL (44)', '3XL (46+)'];
const SHOE_SIZES = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];

const STYLE_CATEGORIES = [
  'Mode Femme & Robes',
  'Mode Homme & Chemises',
  'Bazin Riche & Wax Africain',
  'Sneakers & Baskets',
  'Mocassins & Souliers Cuir',
  'Sacs à main & Maroquinerie',
  'Bijoux & Montres de Luxe',
  'Parfums & Senteurs d\'Orient',
  'Smartphones & Accessoires High-Tech',
  'Perruques & Mèches Naturelles',
  'Soins & Cosmétiques Teint Éclat',
  'Décoration & Maison Djassa'
];

type SectionTab = 'general' | 'livraison' | 'paiement' | 'styles' | 'reseaux' | 'confidentialite';

export const EditProfileScreen: React.FC<EditProfileScreenProps> = ({ isOpen, onClose }) => {
  const { userProfile, updateProfile, showToast } = useApp();

  const [activeTab, setActiveTab] = useState<SectionTab>('general');
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [customVideoUrl, setCustomVideoUrl] = useState('');
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: userProfile.name || '',
    username: userProfile.username || '',
    bio: userProfile.bio || '',
    pronouns: userProfile.pronouns || 'Elle / La',
    avatar: userProfile.avatar || '',
    profileVideo: userProfile.profileVideo || '',
    phone: userProfile.phone || '+225 07 11 22 33 44',
    email: userProfile.email || 'client@djassa.ci',
    commune: userProfile.deliveryCommune || 'Cocody',
    quartier: userProfile.deliveryQuartier || 'Angré 8ème tranche',
    addressDetails: userProfile.deliveryAddressDetails || 'Face pharmacie Saint-Jean',
    preferredPaymentMethod: userProfile.preferredPaymentMethod || 'wave',
    instagram: userProfile.instagram || 'amina_style',
    tiktok: userProfile.tiktok || 'amina_abidjan',
    youtube: userProfile.youtube || '',
    website: userProfile.website || '',
    clothingSize: userProfile.clothingSize || 'M (38)',
    shoeSize: userProfile.shoeSize || '38',
    gender: userProfile.gender || 'Femme',
    favoriteCategories: userProfile.favoriteCategories || ['Mode Femme & Robes', 'Bazin Riche & Wax Africain', 'Sneakers & Baskets'],
    showCommuneOnProfile: userProfile.showCommuneOnProfile !== false,
    showBuyerBadge: userProfile.showBuyerBadge !== false,
    showLikedVideos: userProfile.showLikedVideos ?? true,
    allowPersonalizedOffers: userProfile.allowPersonalizedOffers ?? true
  });

  // Sync with userProfile when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: userProfile.name || '',
        username: userProfile.username || '',
        bio: userProfile.bio || '',
        pronouns: userProfile.pronouns || 'Elle / La',
        avatar: userProfile.avatar || '',
        profileVideo: userProfile.profileVideo || '',
        phone: userProfile.phone || '+225 07 11 22 33 44',
        email: userProfile.email || 'client@djassa.ci',
        commune: userProfile.deliveryCommune || 'Cocody',
        quartier: userProfile.deliveryQuartier || 'Angré 8ème tranche',
        addressDetails: userProfile.deliveryAddressDetails || 'Face pharmacie Saint-Jean',
        preferredPaymentMethod: userProfile.preferredPaymentMethod || 'wave',
        instagram: userProfile.instagram || 'amina_style',
        tiktok: userProfile.tiktok || 'amina_abidjan',
        youtube: userProfile.youtube || '',
        website: userProfile.website || '',
        clothingSize: userProfile.clothingSize || 'M (38)',
        shoeSize: userProfile.shoeSize || '38',
        gender: userProfile.gender || 'Femme',
        favoriteCategories: userProfile.favoriteCategories || ['Mode Femme & Robes', 'Bazin Riche & Wax Africain', 'Sneakers & Baskets'],
        showCommuneOnProfile: userProfile.showCommuneOnProfile !== false,
        showBuyerBadge: userProfile.showBuyerBadge !== false,
        showLikedVideos: userProfile.showLikedVideos ?? true,
        allowPersonalizedOffers: userProfile.allowPersonalizedOffers ?? true
      });
      setHasChanges(false);
    }
  }, [isOpen, userProfile]);

  if (!isOpen) return null;

  const updateField = <K extends keyof typeof formData>(field: K, value: typeof formData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleToggleCategory = (category: string) => {
    const current = formData.favoriteCategories;
    const next = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category];
    updateField('favoriteCategories', next);
  };

  const handleSaveAll = () => {
    updateProfile({
      name: formData.name.trim() || userProfile.name,
      username: formData.username.trim() || userProfile.username,
      bio: formData.bio.trim(),
      pronouns: formData.pronouns,
      avatar: formData.avatar,
      profileVideo: formData.profileVideo,
      phone: formData.phone.trim(),
      email: formData.email.trim(),
      commune: formData.commune,
      deliveryCommune: formData.commune,
      deliveryQuartier: formData.quartier.trim(),
      deliveryAddressDetails: formData.addressDetails.trim(),
      preferredPaymentMethod: formData.preferredPaymentMethod,
      instagram: formData.instagram.trim(),
      tiktok: formData.tiktok.trim(),
      youtube: formData.youtube.trim(),
      website: formData.website.trim(),
      clothingSize: formData.clothingSize,
      shoeSize: formData.shoeSize,
      gender: formData.gender,
      favoriteCategories: formData.favoriteCategories,
      showCommuneOnProfile: formData.showCommuneOnProfile,
      showBuyerBadge: formData.showBuyerBadge,
      showLikedVideos: formData.showLikedVideos,
      allowPersonalizedOffers: formData.allowPersonalizedOffers
    });

    setHasChanges(false);
    showToast('Profil client mis à jour avec succès ✨');
    onClose();
  };

  const handleReset = () => {
    setFormData({
      name: userProfile.name || '',
      username: userProfile.username || '',
      bio: userProfile.bio || '',
      pronouns: userProfile.pronouns || 'Elle / La',
      avatar: userProfile.avatar || '',
      profileVideo: userProfile.profileVideo || '',
      phone: userProfile.phone || '+225 07 11 22 33 44',
      email: userProfile.email || 'client@djassa.ci',
      commune: userProfile.deliveryCommune || 'Cocody',
      quartier: userProfile.deliveryQuartier || 'Angré 8ème tranche',
      addressDetails: userProfile.deliveryAddressDetails || 'Face pharmacie Saint-Jean',
      preferredPaymentMethod: userProfile.preferredPaymentMethod || 'wave',
      instagram: userProfile.instagram || 'amina_style',
      tiktok: userProfile.tiktok || 'amina_abidjan',
      youtube: userProfile.youtube || '',
      website: userProfile.website || '',
      clothingSize: userProfile.clothingSize || 'M (38)',
      shoeSize: userProfile.shoeSize || '38',
      gender: userProfile.gender || 'Femme',
      favoriteCategories: userProfile.favoriteCategories || ['Mode Femme & Robes', 'Bazin Riche & Wax Africain', 'Sneakers & Baskets'],
      showCommuneOnProfile: userProfile.showCommuneOnProfile !== false,
      showBuyerBadge: userProfile.showBuyerBadge !== false,
      showLikedVideos: userProfile.showLikedVideos ?? true,
      allowPersonalizedOffers: userProfile.allowPersonalizedOffers ?? true
    });
    setHasChanges(false);
    showToast('Modifications réinitialisées');
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(`https://djassa.ci/@${formData.username}`);
    showToast('Lien de votre profil copié !');
  };

  // Profile completion score
  const completionScore = [
    formData.name,
    formData.username,
    formData.avatar,
    formData.bio,
    formData.commune,
    formData.quartier,
    formData.phone,
    formData.preferredPaymentMethod,
    formData.clothingSize,
    formData.favoriteCategories.length > 0
  ].filter(Boolean).length * 10;

  return (
    <div
      id="edit-profile-screen"
      className="fixed inset-0 z-50 bg-[#0A0A0A] text-white flex flex-col overflow-hidden animate-in fade-in duration-200"
    >
      {/* 1. TOP HEADER */}
      <header className="sticky top-0 z-30 bg-[#0D0D0D]/95 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            id="btn-back-edit-profile"
            onClick={onClose}
            className="p-2 -ml-1 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition active:scale-95"
            aria-label="Retour au profil"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>Modifier le profil</span>
              {hasChanges && (
                <span className="w-2 h-2 rounded-full bg-[#FF6321] animate-pulse" title="Modifications en attente" />
              )}
            </h1>
            <p className="text-[11px] text-white/50">
              Complété à <span className="text-[#FF6321] font-semibold">{completionScore}%</span> · Djassa Client
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Live Preview Toggle Button */}
          <button
            type="button"
            onClick={() => setShowLivePreview(!showLivePreview)}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
              showLivePreview
                ? 'bg-[#FF6321]/15 text-[#FF6321] border-[#FF6321]/30'
                : 'bg-white/5 text-white/70 border-white/10 hover:text-white'
            }`}
            title="Aperçu en direct"
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">Aperçu</span>
          </button>

          {/* Quick Save */}
          <button
            id="btn-save-edit-profile"
            onClick={handleSaveAll}
            className="px-4 py-2 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white text-xs font-bold shadow-lg shadow-orange-600/30 active:scale-95 transition flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Enregistrer</span>
          </button>
        </div>
      </header>

      {/* 2. TAB SELECTOR BAR */}
      <nav className="flex items-center gap-1.5 px-3 py-2 bg-[#121212] border-b border-white/10 overflow-x-auto no-scrollbar shrink-0">
        {[
          { id: 'general', label: 'Identité', icon: User },
          { id: 'livraison', label: 'Livraison', icon: MapPin },
          { id: 'paiement', label: 'Paiement', icon: Wallet },
          { id: 'styles', label: 'Tailles & Styles', icon: Shirt },
          { id: 'reseaux', label: 'Réseaux', icon: Globe },
          { id: 'confidentialite', label: 'Visibilité', icon: ShieldCheck }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as SectionTab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                isActive
                  ? 'bg-white text-black shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 3. MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-24">
        
        {/* LIVE PREVIEW BANNER (WHEN TOGGLED) */}
        {showLivePreview && (
          <div className="m-4 p-4 rounded-2xl bg-gradient-to-br from-[#1C1C1E] to-[#121214] border border-[#FF6321]/30 shadow-2xl relative animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF6321] flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> Aperçu direct de votre profil public
              </span>
              <button
                type="button"
                onClick={() => setShowLivePreview(false)}
                className="text-white/40 hover:text-white text-xs p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 mt-3">
              <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-[#FF6321] shrink-0 bg-black/40">
                <img
                  src={formData.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400'}
                  alt={formData.name}
                  className="w-full h-full object-cover"
                />
                {formData.profileVideo && (
                  <div className="absolute bottom-0 right-0 bg-[#FF6321] text-white p-0.5 rounded-full">
                    <VideoIcon className="w-3 h-3" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-extrabold text-white text-base truncate">
                    {formData.name || 'Nom Client'}
                  </h3>
                  {formData.showBuyerBadge && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <ShieldCheck className="w-3 h-3" /> Client Vérifié
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/50 truncate">@{formData.username || 'identifiant'}</p>
                {formData.showCommuneOnProfile && (
                  <p className="text-[11px] text-white/70 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-[#FF6321]" />
                    <span>{formData.commune}, {formData.quartier || 'Abidjan'}</span>
                  </p>
                )}
              </div>
            </div>

            {formData.bio && (
              <p className="text-xs text-white/80 mt-3 pt-2.5 border-t border-white/5 italic">
                "{formData.bio}"
              </p>
            )}

            <div className="mt-3 pt-2 border-t border-white/5 flex items-center gap-3 text-[11px] text-white/50">
              <span>💳 {formData.preferredPaymentMethod ? formData.preferredPaymentMethod.toUpperCase() : 'WAVE'}</span>
              <span>·</span>
              <span>👗 Taille {formData.clothingSize}</span>
              <span>·</span>
              <span>👟 Pointure {formData.shoeSize}</span>
            </div>
          </div>
        )}

        <div className="p-4 max-w-2xl mx-auto space-y-6">

          {/* ======================================================== */}
          {/* TAB 1: IDENTITÉ & MÉDIAS                                  */}
          {/* ======================================================== */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              
              {/* PHOTO DE PROFIL & VIDÉO INTRO */}
              <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 space-y-4">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#FF6321]" />
                  <span>Photo & Vidéo de profil</span>
                </h2>

                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {/* Photo Actuelle */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative group w-24 h-24 rounded-full overflow-hidden border-2 border-[#FF6321] shadow-lg shadow-orange-950/40">
                      <img
                        src={formData.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400'}
                        alt="Photo de profil"
                        className="w-full h-full object-cover"
                      />
                      <label
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition"
                        title="Changer la photo"
                      >
                        <Camera className="w-6 h-6 text-white mb-1" />
                        <span className="text-[9px] font-bold text-white uppercase">Changer</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const localUrl = URL.createObjectURL(file);
                              updateField('avatar', localUrl);
                              showToast('Photo de profil mise à jour');
                            }
                          }}
                        />
                      </label>
                    </div>
                    <span className="text-xs font-semibold text-white/70">Photo actuelle</span>
                  </div>

                  {/* Vidéo de profil */}
                  <div className="flex-1 w-full flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <VideoIcon className="w-3.5 h-3.5 text-[#FF6321]" />
                        <span>Vidéo de profil (Style TikTok)</span>
                      </span>
                      {formData.profileVideo && (
                        <button
                          type="button"
                          onClick={() => updateField('profileVideo', '')}
                          className="text-[11px] text-red-400 hover:text-red-300 font-semibold"
                        >
                          Supprimer vidéo
                        </button>
                      )}
                    </div>

                    {formData.profileVideo ? (
                      <div className="relative rounded-xl overflow-hidden bg-black/60 border border-white/10 aspect-video flex items-center justify-center">
                        <video
                          src={formData.profileVideo}
                          className="w-full h-full object-cover"
                          controls={isPlayingVideo}
                          autoPlay={isPlayingVideo}
                          loop
                        />
                        {!isPlayingVideo && (
                          <button
                            type="button"
                            onClick={() => setIsPlayingVideo(true)}
                            className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/20 transition"
                          >
                            <div className="w-10 h-10 rounded-full bg-[#FF6321] text-white flex items-center justify-center shadow-lg">
                              <Play className="w-5 h-5 ml-0.5" />
                            </div>
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-white/50 bg-white/5 p-3 rounded-xl border border-white/5">
                        Ajoutez une vidéo courte pour animer votre profil comme sur TikTok ou choisissez un modèle ci-dessous.
                      </p>
                    )}
                  </div>
                </div>

                {/* SÉLECTEUR RAPIDE D'AVATARS PRESETS */}
                <div className="pt-3 border-t border-white/5">
                  <label className="block text-xs font-bold text-white/80 mb-2">
                    Choisir un avatar prédéfini (Élégance ivoirienne) :
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {PRESET_AVATARS.map((preset, index) => {
                      const isSelected = formData.avatar === preset.url;
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => updateField('avatar', preset.url)}
                          className={`relative rounded-xl overflow-hidden aspect-square border-2 transition active:scale-95 ${
                            isSelected ? 'border-[#FF6321] scale-105 shadow-md shadow-orange-600/30' : 'border-transparent hover:border-white/30 opacity-70 hover:opacity-100'
                          }`}
                          title={preset.label}
                        >
                          <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                          {isSelected && (
                            <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#FF6321] text-white flex items-center justify-center">
                              <Check className="w-2.5 h-2.5" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* URL D'AVATAR PERSONNALISÉE */}
                <div className="pt-2 flex gap-2">
                  <input
                    type="url"
                    placeholder="Ou collez l'URL directe d'une photo..."
                    value={customAvatarUrl}
                    onChange={(e) => setCustomAvatarUrl(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customAvatarUrl.trim()) {
                        updateField('avatar', customAvatarUrl.trim());
                        setCustomAvatarUrl('');
                        showToast('Avatar personnalisé appliqué !');
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition shrink-0"
                  >
                    Appliquer
                  </button>
                </div>

                {/* MODÈLES VIDÉO RAPIDES */}
                <div className="pt-3 border-t border-white/5">
                  <label className="block text-xs font-bold text-white/80 mb-2">
                    Ou choisissez une vidéo d'ambiance Djassa :
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {SAMPLE_PROFILE_VIDEOS.map((vid, idx) => {
                      const isSelected = formData.profileVideo === vid.url;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            updateField('profileVideo', vid.url);
                            setIsPlayingVideo(false);
                            showToast(`Vidéo "${vid.title}" sélectionnée`);
                          }}
                          className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition ${
                            isSelected
                              ? 'bg-[#FF6321]/15 border-[#FF6321] text-white'
                              : 'bg-white/5 border-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          <img
                            src={vid.thumbnail}
                            alt={vid.title}
                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold truncate">{vid.title}</p>
                            <p className="text-[10px] text-white/40">Clip HD 9:16</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* COORDONNÉES IDENTITÉ */}
              <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 space-y-4">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-[#FF6321]" />
                  <span>Informations personnelles</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Nom complet */}
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">
                      Nom complet ou Prénom
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => updateField('name', e.target.value)}
                        placeholder="Ex: Amina Touré"
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                      />
                    </div>
                  </div>

                  {/* Nom d'utilisateur */}
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">
                      Identifiant (@pseudo)
                    </label>
                    <div className="relative">
                      <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => updateField('username', e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                        placeholder="amina_abidjan"
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                      />
                    </div>
                  </div>
                </div>

                {/* Bio & Description */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#FF6321]" />
                      <span>Bio & Description</span>
                    </label>
                    <span className="text-[10px] text-white/40">
                      {formData.bio.length} / 150 caractères
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={150}
                    value={formData.bio}
                    onChange={(e) => updateField('bio', e.target.value)}
                    placeholder="Parlez de vos goûts, de votre style à Abidjan, ou de ce que vous aimez chiner sur Djassa..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321] resize-none leading-relaxed"
                  />
                </div>

                {/* Genre & Pronoms */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">Genre</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Femme', 'Homme', 'Autre'].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => updateField('gender', g)}
                          className={`py-2 rounded-xl text-xs font-bold border transition ${
                            formData.gender === g
                              ? 'bg-white text-black border-white'
                              : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">Pronoms</label>
                    <select
                      value={formData.pronouns}
                      onChange={(e) => updateField('pronouns', e.target.value)}
                      className="w-full bg-[#18181A] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                    >
                      <option value="Elle / La">Elle / La</option>
                      <option value="Il / Lui">Il / Lui</option>
                      <option value="Iel / Lea">Iel / Lea</option>
                      <option value="Ne pas préciser">Ne pas préciser</option>
                    </select>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: LIVRAISON & ADRESSE ABIDJAN                         */}
          {/* ======================================================== */}
          {activeTab === 'livraison' && (
            <div className="space-y-6">
              
              <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#FF6321]" />
                    <span>Adresse de livraison préférée (Abidjan)</span>
                  </h2>
                  <span className="text-[11px] text-[#FF6321] font-semibold bg-[#FF6321]/10 px-2 py-0.5 rounded-full">
                    Livraison locale
                  </span>
                </div>

                {/* Commune d'Abidjan (1-Click Selector) */}
                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-2">
                    Commune principale :
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {ABIDJAN_COMMUNES.slice(0, 8).map((commune) => {
                      const isSelected = formData.commune === commune;
                      return (
                        <button
                          key={commune}
                          type="button"
                          onClick={() => updateField('commune', commune)}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border transition text-center ${
                            isSelected
                              ? 'bg-[#FF6321] text-white border-[#FF6321] shadow-md shadow-orange-600/30'
                              : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                          }`}
                        >
                          {commune}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-white/50">Toutes les communes :</span>
                    <select
                      value={formData.commune}
                      onChange={(e) => updateField('commune', e.target.value)}
                      className="flex-1 bg-[#18181A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                    >
                      {ABIDJAN_COMMUNES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Quartier */}
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1.5">
                    Quartier / Cité
                  </label>
                  <input
                    type="text"
                    value={formData.quartier}
                    onChange={(e) => updateField('quartier', e.target.value)}
                    placeholder="Ex: Angré 8ème tranche, Riviera Palmeraie, Niangon..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                  />
                </div>

                {/* Repère précis pour la livraison */}
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1.5">
                    Repère précis & instructions pour la boutique
                  </label>
                  <textarea
                    rows={2}
                    value={formData.addressDetails}
                    onChange={(e) => updateField('addressDetails', e.target.value)}
                    placeholder="Ex: En face de la pharmacie Saint-Jean, portail bleu, appeler à l'arrivée..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321] resize-none"
                  />
                  <p className="text-[11px] text-white/40 mt-1 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-emerald-400" />
                    Transmis au vendeur pour organiser votre livraison facilement.
                  </p>
                </div>
              </div>

              {/* CONTACT DIRECT CLIENT */}
              <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 space-y-4">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#FF6321]" />
                  <span>Téléphone & Notifications de commande</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Téléphone CI */}
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">
                      Numéro de téléphone (Côte d'Ivoire)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#FF6321]">
                        🇨🇮
                      </span>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => updateField('phone', e.target.value)}
                        placeholder="+225 07 00 00 00 00"
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">
                      Email de contact
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        placeholder="votre-email@exemple.ci"
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                      />
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: MOYENS DE PAIEMENT FAVORIS                         */}
          {/* ======================================================== */}
          {activeTab === 'paiement' && (
            <div className="space-y-6">
              
              <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[#FF6321]" />
                    <span>Mode de règlement par défaut</span>
                  </h2>
                  <span className="text-[11px] text-white/50">1-clic au panier</span>
                </div>

                <p className="text-xs text-white/60">
                  Choisissez votre méthode de paiement préférée. Elle sera pré-sélectionnée lors de vos commandes sur Djassa.
                </p>

                <div className="space-y-2.5">
                  {PAYMENT_METHODS.map((method) => {
                    const isSelected = formData.preferredPaymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => updateField('preferredPaymentMethod', method.id)}
                        className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition text-left ${
                          isSelected
                            ? 'bg-[#1C1C1E] border-[#FF6321] ring-1 ring-[#FF6321]/40'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{method.icon}</span>
                          <div>
                            <p className="text-xs font-bold text-white">{method.name}</p>
                            <p className="text-[10px] text-white/50">{method.fee}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isSelected && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FF6321] text-white">
                              Actif
                            </span>
                          )}
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                              isSelected ? 'border-[#FF6321] bg-[#FF6321] text-white' : 'border-white/30'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: TAILLES & PRÉFÉRENCES STYLES                       */}
          {/* ======================================================== */}
          {activeTab === 'styles' && (
            <div className="space-y-6">
              
              {/* TAILLES VÊTEMENTS */}
              <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Shirt className="w-4 h-4 text-[#FF6321]" />
                    <span>Taille de vêtements habituelle</span>
                  </h2>
                  <span className="text-xs font-bold text-[#FF6321]">{formData.clothingSize}</span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                  {CLOTHING_SIZES.map((size) => {
                    const isSelected = formData.clothingSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => updateField('clothingSize', size)}
                        className={`py-2 px-1 rounded-xl text-xs font-bold border transition text-center ${
                          isSelected
                            ? 'bg-[#FF6321] text-white border-[#FF6321] shadow-md shadow-orange-600/30'
                            : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* POINTURES CHAUSSURES */}
              <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Footprints className="w-4 h-4 text-[#FF6321]" />
                    <span>Pointure de chaussures</span>
                  </h2>
                  <span className="text-xs font-bold text-[#FF6321]">Pointure {formData.shoeSize}</span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {SHOE_SIZES.map((pointure) => {
                    const isSelected = formData.shoeSize === pointure;
                    return (
                      <button
                        key={pointure}
                        type="button"
                        onClick={() => updateField('shoeSize', pointure)}
                        className={`py-2 rounded-xl text-xs font-bold border transition text-center ${
                          isSelected
                            ? 'bg-[#FF6321] text-white border-[#FF6321] shadow-md shadow-orange-600/30'
                            : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {pointure}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* CATÉGORIES & UNIVERS PRÉFÉRÉS */}
              <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Heart className="w-4 h-4 text-[#FF6321]" />
                    <span>Rayons et styles préférés</span>
                  </h2>
                  <span className="text-xs text-white/50">
                    {formData.favoriteCategories.length} sélectionnés
                  </span>
                </div>

                <p className="text-xs text-white/50">
                  Djassa personnalise votre flux de vidéos et vos suggestions en fonction de vos préférences.
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  {STYLE_CATEGORIES.map((cat) => {
                    const isSelected = formData.favoriteCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleToggleCategory(cat)}
                        className={`py-1.5 px-3 rounded-full text-xs font-semibold border transition flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-[#FF6321] text-white border-[#FF6321]'
                            : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                        <span>{cat}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 5: RÉSEAUX SOCIAUX & LIENS                            */}
          {/* ======================================================== */}
          {activeTab === 'reseaux' && (
            <div className="space-y-6">
              
              <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 space-y-4">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#FF6321]" />
                  <span>Réseaux sociaux & Profil public</span>
                </h2>

                <div className="space-y-3.5">
                  {/* Instagram */}
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">Instagram</label>
                    <div className="relative">
                      <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#E1306C]" />
                      <input
                        type="text"
                        value={formData.instagram}
                        onChange={(e) => updateField('instagram', e.target.value)}
                        placeholder="amina_style"
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                      />
                    </div>
                  </div>

                  {/* TikTok */}
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">TikTok</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-white">
                        🎵
                      </span>
                      <input
                        type="text"
                        value={formData.tiktok}
                        onChange={(e) => updateField('tiktok', e.target.value)}
                        placeholder="amina_abidjan"
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                      />
                    </div>
                  </div>

                  {/* YouTube */}
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">Chaîne YouTube</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-red-500">
                        ▶
                      </span>
                      <input
                        type="text"
                        value={formData.youtube}
                        onChange={(e) => updateField('youtube', e.target.value)}
                        placeholder="Lien de chaîne ou @handle"
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                      />
                    </div>
                  </div>

                  {/* Site Web */}
                  <div>
                    <label className="block text-xs font-semibold text-white/70 mb-1.5">Site web ou Portfolio</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(e) => updateField('website', e.target.value)}
                        placeholder="https://..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                      />
                    </div>
                  </div>
                </div>

                {/* Copier lien Djassa */}
                <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">Lien de votre profil Djassa</p>
                    <p className="text-[10px] text-white/50 truncate">djassa.ci/@{formData.username}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copier</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 6: CONFIDENTIALITÉ & VISIBILITÉ                       */}
          {/* ======================================================== */}
          {activeTab === 'confidentialite' && (
            <div className="space-y-6">
              
              <div className="p-4 rounded-2xl bg-[#141416] border border-white/10 space-y-4">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#FF6321]" />
                  <span>Affichage & Préférences de confidentialité</span>
                </h2>

                <div className="space-y-3 divide-y divide-white/5">
                  {/* Afficher la commune */}
                  <div className="flex items-center justify-between pt-3 first:pt-0">
                    <div>
                      <p className="text-xs font-bold text-white">Afficher ma commune sur le profil</p>
                      <p className="text-[10px] text-white/50">Visible par les vendeurs et autres acheteurs ({formData.commune})</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateField('showCommuneOnProfile', !formData.showCommuneOnProfile)}
                      className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                        formData.showCommuneOnProfile ? 'bg-[#FF6321]' : 'bg-white/20'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          formData.showCommuneOnProfile ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Badge Acheteur */}
                  <div className="flex items-center justify-between pt-3">
                    <div>
                      <p className="text-xs font-bold text-white">Badge Acheteur Vérifié</p>
                      <p className="text-[10px] text-white/50">Affiche le macaron de confiance auprès des boutiques</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateField('showBuyerBadge', !formData.showBuyerBadge)}
                      className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                        formData.showBuyerBadge ? 'bg-[#FF6321]' : 'bg-white/20'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          formData.showBuyerBadge ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Vidéos aimées */}
                  <div className="flex items-center justify-between pt-3">
                    <div>
                      <p className="text-xs font-bold text-white">Onglet des vidéos aimées public</p>
                      <p className="text-[10px] text-white/50">Permet à vos amis de voir les styles que vous aimez</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateField('showLikedVideos', !formData.showLikedVideos)}
                      className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                        formData.showLikedVideos ? 'bg-[#FF6321]' : 'bg-white/20'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          formData.showLikedVideos ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Offres personnalisées */}
                  <div className="flex items-center justify-between pt-3">
                    <div>
                      <p className="text-xs font-bold text-white">Offres & Promos adaptées à mes tailles</p>
                      <p className="text-[10px] text-white/50">Recommandations ciblées selon vos tailles {formData.clothingSize} et pointure {formData.shoeSize}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateField('allowPersonalizedOffers', !formData.allowPersonalizedOffers)}
                      className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                        formData.allowPersonalizedOffers ? 'bg-[#FF6321]' : 'bg-white/20'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          formData.allowPersonalizedOffers ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      </main>

      {/* 4. FIXED BOTTOM BAR WITH AUTO-SAVE CONFIRMATION */}
      <footer className="sticky bottom-0 z-30 bg-[#0E0E10]/95 backdrop-blur-md border-t border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasChanges ? (
            <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 animate-pulse">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Modifications non enregistrées</span>
            </span>
          ) : (
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Profil à jour</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-bold flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Rétablir</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveAll}
            className="px-5 py-2 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white text-xs font-bold shadow-lg shadow-orange-600/30 active:scale-95 transition flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Enregistrer les modifications</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
