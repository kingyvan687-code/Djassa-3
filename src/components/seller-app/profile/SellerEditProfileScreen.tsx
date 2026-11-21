import React, { useState, useRef } from 'react';
import {
  ChevronLeft,
  Camera,
  Store,
  AtSign,
  MapPin,
  Compass,
  Phone,
  Mail,
  Globe,
  Instagram,
  ShieldCheck,
  Check,
  X,
  Copy,
  Upload,
  Clock3,
  Tag,
  MessageSquare,
  ExternalLink,
  Eye,
  Sparkles,
  CheckCircle2,
  RotateCcw,
  Image as ImageIcon,
  Wallet
} from 'lucide-react';
import { Seller } from '../../../types';
import { useApp } from '../../../context/AppContext';

interface SellerEditProfileScreenProps {
  isOpen: boolean;
  onClose: () => void;
  seller: Seller;
}

const ABIDJAN_COMMUNES_AND_MARKETS = [
  'Adjamé (Grand Marché, Forum des Marchés)',
  'Adjamé (Roxy, Black Market)',
  'Treichville (Marché de Belleville, Avenue 16)',
  'Cocody (Angré, Deux Plateaux, Riviera)',
  'Yopougon (Niangon, Siporex, Bel Air)',
  'Marcory (Zone 4, Boulevard de Marseille)',
  'Plateau (Centre des affaires)',
  'Koumassi (Grand Carrefour)',
  'Port-Bouët (Vridi, Marché de Nuit)',
  'Abobo (Gare, Samaké)',
  'Attécoubé (Agban, Locodjro)'
];

const SELLER_CATEGORIES = [
  { id: 'mode', label: 'Mode & Prêt-à-porter', icon: '👗' },
  { id: 'bazin', label: 'Bazin Riche & Tissus Africains', icon: '🧵' },
  { id: 'maroquinerie', label: 'Sacs & Maroquinerie', icon: '👜' },
  { id: 'chaussures', label: 'Chaussures & Sneakers', icon: '👟' },
  { id: 'hightech', label: 'Smartphones & High-Tech', icon: '📱' },
  { id: 'beaute', label: 'Beauté, Cosmétiques & Perruques', icon: '💄' },
  { id: 'bijoux', label: 'Bijoux, Montres & Accessoires', icon: '💍' },
  { id: 'maison', label: 'Maison, Déco & Électroménager', icon: '🏠' }
];

const PRESET_BANNERS = [
  {
    title: 'Wax & Pagne Ébène',
    url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200&auto=format&fit=crop&q=80',
    color: 'from-orange-950/80 to-neutral-950'
  },
  {
    title: 'Mode Chic Urbain',
    url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&auto=format&fit=crop&q=80',
    color: 'from-emerald-950/80 to-neutral-950'
  },
  {
    title: 'High-Tech & Gadgets',
    url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&auto=format&fit=crop&q=80',
    color: 'from-blue-950/80 to-neutral-950'
  },
  {
    title: 'Maroquinerie de Luxe',
    url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=1200&auto=format&fit=crop&q=80',
    color: 'from-amber-950/80 to-neutral-950'
  },
  {
    title: 'Beauté & Cosmétiques',
    url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&auto=format&fit=crop&q=80',
    color: 'from-pink-950/80 to-neutral-950'
  }
];

const PRESET_AVATARS = [
  {
    name: 'Créatrice Mode',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'
  },
  {
    name: 'Commerçant HighTech',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80'
  },
  {
    name: 'Boutique Styliste',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80'
  },
  {
    name: 'Artisan Cuir',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80'
  },
  {
    name: 'Styliste Wax',
    url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&auto=format&fit=crop&q=80'
  }
];

export const SellerEditProfileScreen: React.FC<SellerEditProfileScreenProps> = ({
  isOpen,
  onClose,
  seller
}) => {
  const { updateSeller, showToast } = useApp();

  // Primary form states
  const [name, setName] = useState(seller.name || '');
  const [username, setUsername] = useState(seller.username || '');
  const [bio, setBio] = useState(seller.bio || '');
  const [avatar, setAvatar] = useState(seller.avatar || '');
  const [banner, setBanner] = useState(
    seller.banner || 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200&auto=format&fit=crop&q=80'
  );
  const [location, setLocation] = useState(seller.location || 'Adjamé (Grand Marché, Forum des Marchés)');
  const [landmark, setLandmark] = useState(seller.marketLocation || 'Allée des Tissus, Box 142');
  const [category, setCategory] = useState(seller.category || 'Mode & Prêt-à-porter');
  const [openingHours, setOpeningHours] = useState(seller.openingHours || '08h00 - 19h30 • Lundi au Samedi');
  const [phone, setPhone] = useState(seller.phone || '+225 07 48 99 12 34');
  const [whatsapp, setWhatsapp] = useState(seller.whatsapp || seller.phone || '+225 07 48 99 12 34');
  const [email, setEmail] = useState(seller.email || 'boutique@djassa.ci');
  const [instagram, setInstagram] = useState(seller.instagram || seller.username || '');
  const [tiktok, setTiktok] = useState(seller.tiktok || seller.username || '');
  const [website, setWebsite] = useState(seller.website || '');
  const [verified, setVerified] = useState(seller.verified ?? true);

  // UI state
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'location' | 'contacts' | 'design'>('info');

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatar(reader.result);
        showToast('Nouveau logo boutique chargé !');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBanner(reader.result);
        showToast('Nouvelle bannière boutique chargée !');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!name.trim()) {
      showToast('Le nom de la boutique est obligatoire.');
      return;
    }

    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_.]/g, '');

    updateSeller(seller.id, {
      name: name.trim(),
      username: cleanUsername || 'boutique',
      bio: bio.trim(),
      avatar: avatar.trim(),
      banner: banner.trim(),
      location: location.trim(),
      marketLocation: landmark.trim(),
      category: category.trim(),
      openingHours: openingHours.trim(),
      phone: phone.trim(),
      whatsapp: whatsapp.trim(),
      email: email.trim(),
      instagram: instagram.trim().replace(/^@/, ''),
      tiktok: tiktok.trim().replace(/^@/, ''),
      website: website.trim(),
      verified
    });

    showToast('Profil boutique mis à jour avec succès ! ✨');
    onClose();
  };

  const handleCopyLink = () => {
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '') || seller.username;
    const url = `https://djassa.ci/boutique/@${cleanUsername}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      showToast('Lien de votre boutique copié !');
    } else {
      showToast(`Lien : ${url}`);
    }
  };

  return (
    <div
      id="seller-edit-profile-modal"
      className="fixed inset-0 z-50 bg-[#0A0A0A] text-white flex flex-col overflow-hidden select-none animate-in fade-in duration-200"
    >
      {/* 1. HEADER BAR */}
      <header className="sticky top-0 z-40 bg-[#0E0E0E]/95 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 -ml-1 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition active:scale-95"
            aria-label="Fermer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm font-extrabold text-white tracking-tight">
              Modifier le profil boutique
            </h1>
            <p className="text-[10px] text-white/50">
              Personnalisez votre vitrine et vos coordonnées à Abidjan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Live Preview */}
          <button
            type="button"
            onClick={() => setShowLivePreview(!showLivePreview)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition ${
              showLivePreview
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
            }`}
            title="Aperçu en direct"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Aperçu</span>
          </button>

          {/* Primary Save Button */}
          <button
            type="button"
            onClick={() => handleSave()}
            className="px-4 py-1.5 rounded-full bg-[#FF6321] hover:bg-[#ff7538] text-white text-xs font-black shadow-lg shadow-orange-600/30 active:scale-95 transition flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Enregistrer</span>
          </button>
        </div>
      </header>

      {/* 2. SECTION TABS CHIPS (Quick Jump) */}
      <nav className="bg-[#121212] border-b border-white/5 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 z-30">
        {[
          { id: 'info', label: '🏪 Identité & Bio' },
          { id: 'design', label: '🎨 Bannière & Logo' },
          { id: 'location', label: '📍 Marché & Emplacement' },
          { id: 'contacts', label: '📞 Contacts & Réseaux' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-[#FF6321] text-white shadow-md shadow-orange-600/20'
                : 'bg-white/5 text-white/60 hover:text-white border border-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* 3. SCROLLABLE FORM BODY */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-24">
        
        {/* LIVE PREVIEW HERO CARD (Toggled or inline) */}
        {showLivePreview && (
          <section className="p-4 bg-gradient-to-b from-[#181818] to-transparent border-b border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Aperçu en direct (Vue client)
              </span>
              <button
                type="button"
                onClick={() => setShowLivePreview(false)}
                className="text-[10px] text-white/40 hover:text-white"
              >
                Masquer
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden border border-white/15 bg-[#0E0E0E] shadow-2xl">
              {/* Preview Banner */}
              <div className="w-full h-28 bg-neutral-900 relative">
                <img
                  src={banner}
                  alt="Aperçu bannière"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0E0E0E] via-black/20 to-black/30" />
              </div>

              {/* Preview Profile info */}
              <div className="px-4 pb-4 -mt-10 flex flex-col items-center text-center relative z-10">
                <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-[#0E0E0E] ring-2 ring-[#FF6321] shadow-xl bg-neutral-900">
                  <img
                    src={avatar}
                    alt={name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white">{name || 'Nom boutique'}</span>
                  {verified && <ShieldCheck className="w-3.5 h-3.5 text-[#FF6321]" />}
                </div>
                <span className="text-xs text-[#FF6321] font-medium">
                  @{username || 'identifiant'}
                </span>
                <p className="text-[11px] text-white/70 mt-1 max-w-xs leading-relaxed">
                  {bio || 'Description de votre boutique...'}
                </p>
                <div className="mt-2 flex items-center gap-3 text-[10px] text-white/50">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-[#FF6321]" />
                    <span>{location.split('(')[0].trim()}</span>
                  </div>
                  <span>•</span>
                  <span>{phone}</span>
                </div>
              </div>
            </div>
          </section>
        )}

        <form onSubmit={handleSave} className="p-4 space-y-6 max-w-2xl mx-auto">
          
          {/* TAB 1: IDENTITÉ & BIO */}
          {(activeTab === 'info' || activeTab === 'design') && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-wider text-[#FF6321] flex items-center gap-1.5">
                  <Store className="w-4 h-4" />
                  Identité de la Boutique
                </h2>
                <span className="text-[10px] text-white/40">Visible sur Djassa</span>
              </div>

              {/* STORE NAME */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/80 block">
                  Nom de la boutique <span className="text-[#FF6321]">*</span>
                </label>
                <div className="relative">
                  <Store className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Boutique Wax & Élégance"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321] transition"
                  />
                </div>
              </div>

              {/* USERNAME / IDENTIFIANT UNIQUE */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white/80 block">
                    Identifiant unique (@nom) <span className="text-[#FF6321]">*</span>
                  </label>
                  <span className="text-[10px] text-white/40">Sans espaces ni accents</span>
                </div>
                <div className="relative">
                  <span className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm">
                    @
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))
                    }
                    placeholder="wax_elegance_ci"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs text-white font-mono placeholder-white/30 focus:outline-none focus:border-[#FF6321] transition"
                  />
                </div>

                {/* Live Link Badge */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-white/50 truncate">
                    djassa.ci/boutique/@{username || 'votre_nom'}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="text-[10px] font-bold text-[#FF6321] hover:text-[#ff7538] flex items-center gap-1 shrink-0 ml-2"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copier</span>
                  </button>
                </div>
              </div>

              {/* CATEGORY SELECTOR */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/80 block">
                  Catégorie d'activité principale
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SELLER_CATEGORIES.map((cat) => {
                    const isSelected = category.toLowerCase().includes(cat.id) || category === cat.label;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.label)}
                        className={`p-2.5 rounded-xl text-left text-xs font-semibold flex items-center gap-2 border transition ${
                          isSelected
                            ? 'bg-[#FF6321]/15 border-[#FF6321] text-white'
                            : 'bg-white/5 border-white/5 text-white/60 hover:text-white hover:bg-white/[0.08]'
                        }`}
                      >
                        <span className="text-base">{cat.icon}</span>
                        <span className="truncate">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* BIO / SLOGAN */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white/80 block">
                    Biographie & Slogan de la boutique
                  </label>
                  <span className="text-[10px] text-white/40">{bio.length}/200</span>
                </div>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 200))}
                  rows={3}
                  placeholder="Présentez vos produits phares, vos tissus, vos garanties ou vos arrivages réguliers..."
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-2xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321] transition resize-none"
                />
              </div>
            </section>
          )}

          {/* TAB 2: DESIGN (BANNIÈRE & LOGO) */}
          {(activeTab === 'design' || activeTab === 'info') && (
            <section className="space-y-4 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4" />
                  Bannière & Logo Visuel
                </h2>
                <span className="text-[10px] text-white/40">Format & Galerie</span>
              </div>

              {/* BANNER EDITING */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/80 block">
                  Bannière de couverture
                </label>
                
                {/* Banner preview card with action */}
                <div className="relative w-full h-36 rounded-2xl overflow-hidden border border-white/15 bg-neutral-900 group">
                  <img
                    src={banner}
                    alt="Bannière boutique"
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30 flex items-end justify-between p-3">
                    <span className="text-[11px] font-bold text-white/80">
                      Bannière actuelle
                    </span>

                    <button
                      type="button"
                      onClick={() => bannerInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white text-xs font-bold flex items-center gap-1.5 shadow-lg active:scale-95 transition"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Changer la photo</span>
                    </button>
                  </div>
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleBannerFileChange}
                  />
                </div>

                {/* Preset Banners Carousel */}
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-white/50 block">
                    Ou choisissez parmi nos bannières préconçues :
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {PRESET_BANNERS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setBanner(preset.url);
                          showToast(`Bannière "${preset.title}" appliquée !`);
                        }}
                        className={`group relative aspect-[16/9] rounded-xl overflow-hidden border transition ${
                          banner === preset.url
                            ? 'border-[#FF6321] ring-2 ring-[#FF6321]/50'
                            : 'border-white/10 hover:border-white/30'
                        }`}
                        title={preset.title}
                      >
                        <img
                          src={preset.url}
                          alt={preset.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                          <span className="text-[9px] font-bold text-white text-center px-1">
                            {preset.title}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* LOGO / AVATAR EDITING */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-white/80 block">
                  Logo / Photo de profil de la boutique
                </label>

                <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                  <div className="relative shrink-0">
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#FF6321] shadow-lg bg-neutral-900">
                      <img
                        src={avatar}
                        alt={name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-1 rounded-full bg-[#FF6321] text-white shadow-md border border-neutral-950 hover:scale-105 transition"
                      title="Téléverser un logo"
                    >
                      <Camera className="w-3 h-3" />
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarFileChange}
                    />
                  </div>

                  <div className="flex-1 space-y-1">
                    <p className="text-xs font-bold text-white">Logo officiel</p>
                    <p className="text-[10px] text-white/50">
                      Format carré recommandé (PNG ou JPG). Sera visible en filigrane de vos publications.
                    </p>
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="text-xs font-bold text-[#FF6321] hover:underline flex items-center gap-1"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Importer depuis l'appareil</span>
                    </button>
                  </div>
                </div>

                {/* Preset Avatars */}
                <div className="space-y-1 pt-1">
                  <span className="text-[11px] font-medium text-white/50 block">
                    Modèles de profil :
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    {PRESET_AVATARS.map((av, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setAvatar(av.url);
                          showToast(`Avatar "${av.name}" appliqué !`);
                        }}
                        className={`w-12 h-12 rounded-full overflow-hidden border-2 shrink-0 transition ${
                          avatar === av.url
                            ? 'border-[#FF6321] ring-2 ring-[#FF6321]/50'
                            : 'border-white/10 hover:border-white/40'
                        }`}
                        title={av.name}
                      >
                        <img
                          src={av.url}
                          alt={av.name}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB 3: MARCHÉ & EMPLACEMENT */}
          {(activeTab === 'location' || activeTab === 'info') && (
            <section className="space-y-4 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  Marché & Emplacement à Abidjan
                </h2>
                <span className="text-[10px] text-white/40">Point de retrait</span>
              </div>

              {/* COMMUNE & GRAND MARCHÉ */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/80 block">
                  Marché / Commune à Abidjan <span className="text-[#FF6321]">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-[#121212] border border-white/10 rounded-2xl text-xs text-white focus:outline-none focus:border-emerald-400 transition"
                  >
                    {ABIDJAN_COMMUNES_AND_MARKETS.map((loc) => (
                      <option key={loc} value={loc} className="bg-[#121212] text-white">
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* REPÈRE PRÉCIS / NUMÉRO DE BOX */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/80 block">
                  Repère précis / Numéro de box au marché
                </label>
                <div className="relative">
                  <Compass className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="Ex: Box 142, Allée des Tissus, Face Grand Hangar"
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-emerald-400 transition"
                  />
                </div>
                <p className="text-[10px] text-white/40">
                  Permet à vos clients de localiser facilement votre boutique lors de leurs commandes ou retraits.
                </p>
              </div>

              {/* OPENING HOURS */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/80 block">
                  Horaires d'ouverture de la boutique
                </label>
                <div className="relative">
                  <Clock3 className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={openingHours}
                    onChange={(e) => setOpeningHours(e.target.value)}
                    placeholder="Ex: 08h00 - 19h30 • Lundi au Samedi"
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-emerald-400 transition"
                  />
                </div>
              </div>
            </section>
          )}

          {/* TAB 4: CONTACTS & RÉSEAUX */}
          {(activeTab === 'contacts' || activeTab === 'info') && (
            <section className="space-y-4 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <Phone className="w-4 h-4" />
                  Contacts Professionnels & Réseaux
                </h2>
                <span className="text-[10px] text-white/40">Service Client</span>
              </div>

              {/* TÉLÉPHONE DIRECT APPELS */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/80 block">
                  Numéro de téléphone d'appels (+225) <span className="text-[#FF6321]">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+225 07 48 99 12 34"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs text-white font-mono placeholder-white/30 focus:outline-none focus:border-purple-400 transition"
                  />
                </div>
              </div>

              {/* WHATSAPP PROFESSIONNEL */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-emerald-400 block">
                  WhatsApp Business pour les clients (+225)
                </label>
                <div className="relative">
                  <MessageSquare className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="+225 07 48 99 12 34"
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs text-white font-mono placeholder-white/30 focus:outline-none focus:border-emerald-400 transition"
                  />
                </div>
              </div>

              {/* EMAIL */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/80 block">
                  Adresse e-mail professionnelle
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="boutique@djassa.ci"
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-400 transition"
                  />
                </div>
              </div>

              {/* RÉSEAUX SOCIAUX */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Instagram */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-pink-400 block">
                    Instagram (@nom)
                  </label>
                  <div className="relative">
                    <Instagram className="w-4 h-4 text-pink-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value.replace(/^@/, ''))}
                      placeholder="wax_elegance"
                      className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-pink-400 transition"
                    />
                  </div>
                </div>

                {/* TikTok */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-cyan-400 block">
                    TikTok (@nom)
                  </label>
                  <div className="relative">
                    <span className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-xs">
                      ♪
                    </span>
                    <input
                      type="text"
                      value={tiktok}
                      onChange={(e) => setTiktok(e.target.value.replace(/^@/, ''))}
                      placeholder="wax_elegance_ci"
                      className="w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400 transition"
                    />
                  </div>
                </div>
              </div>

              {/* WEBSITE */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-white/80 block">
                  Site Web / Catalogue externe (Optionnel)
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://..."
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-400 transition"
                  />
                </div>
              </div>
            </section>
          )}

          {/* TAB 5: CERTIFICATION & CONFIANCE */}
          <section className="space-y-3 pt-2 border-t border-white/10">
            <h2 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              Confiance & Certifications
            </h2>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-[#FF6321]/30 flex items-center justify-center text-[#FF6321]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">
                    Badge Boutique Vérifiée Djassa
                  </span>
                  <span className="text-[10px] text-white/50 block">
                    Prouve aux clients votre présence physique sur le marché
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setVerified(!verified)}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center shrink-0 ${
                  verified ? 'bg-[#FF6321]' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    verified ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </section>

          {/* SUBMIT BUTTON IN PAGE BODY */}
          <div className="pt-4">
            <button
              type="submit"
              className="w-full py-3.5 px-6 rounded-2xl bg-[#FF6321] hover:bg-[#ff7538] text-white text-sm font-extrabold shadow-xl shadow-orange-600/30 active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Enregistrer toutes les modifications</span>
            </button>
          </div>

        </form>
      </main>

      {/* 4. STICKY BOTTOM ACTION BAR */}
      <footer className="sticky bottom-0 z-40 bg-[#0E0E0E]/95 backdrop-blur-xl border-t border-white/10 px-4 py-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-bold transition"
        >
          Annuler
        </button>

        <button
          type="button"
          onClick={() => handleSave()}
          className="flex-1 py-2.5 px-5 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white text-xs font-extrabold shadow-lg shadow-orange-600/25 active:scale-95 transition flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>Enregistrer les modifications</span>
        </button>
      </footer>
    </div>
  );
};
