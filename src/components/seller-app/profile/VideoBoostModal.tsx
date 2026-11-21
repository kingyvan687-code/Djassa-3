import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft,
  X, 
  Sparkles, 
  Rocket, 
  Target, 
  Check, 
  CreditCard, 
  ShieldCheck,
  Zap,
  TrendingUp,
  Eye,
  Users,
  MapPin,
  Clock,
  Flame,
  CheckCircle2,
  Calendar,
  Share2,
  Play,
  Pause,
  Store,
  ChevronRight,
  Info,
  DollarSign,
  Crown
} from 'lucide-react';
import { Product } from '../../../types';
import { formatFCFA, formatMetricCount } from '../../../services/marketServices';
import { useApp } from '../../../context/AppContext';

interface Props {
  product: Product | null;
  onClose: () => void;
  onBoostConfirm?: (product: Product, packName: string, amount: number) => void;
}

export type BoostGoal = 'sales' | 'messages' | 'views';

interface BoostPack {
  id: 'starter' | 'pro' | 'buzz' | 'ultra';
  name: string;
  price: number;
  estimatedViews: string;
  estimatedReach: number;
  durationDays: number;
  durationLabel: string;
  badge: string;
  highlight?: boolean;
  features: string[];
}

const BOOST_PACKS: BoostPack[] = [
  {
    id: 'starter',
    name: 'Pack Découverte Express',
    price: 2500,
    estimatedViews: '+5 000 vues',
    estimatedReach: 5000,
    durationDays: 3,
    durationLabel: '3 jours',
    badge: 'Idéal démarrage',
    highlight: false,
    features: [
      'Diffusion fil d’accueil standard',
      'Ciblage 1 commune au choix',
      'Rapport statistique quotidien'
    ]
  },
  {
    id: 'pro',
    name: 'Pack Vendeur Pro',
    price: 5000,
    estimatedViews: '+15 000 vues',
    estimatedReach: 15000,
    durationDays: 5,
    durationLabel: '5 jours',
    badge: 'Recommandé 🔥',
    highlight: true,
    features: [
      'Priorité haute sur le fil d’accueil',
      'Badge « SPONSORISÉ » doré sur la photo',
      'Ciblage multi-communes Grand Abidjan',
      'Recommandé dans les suggestions d’achats'
    ]
  },
  {
    id: 'buzz',
    name: 'Pack Buzz Express',
    price: 10000,
    estimatedViews: '+40 000 vues',
    estimatedReach: 40000,
    durationDays: 7,
    durationLabel: '7 jours (1 semaine)',
    badge: 'Impact maximal 🚀',
    highlight: false,
    features: [
      'Placement #1 en tête du fil d’actualité',
      'Notification envoyée aux acheteurs actifs',
      'Bannière animée en haut de catégorie',
      'Support prioritaire Djassa Ads'
    ]
  },
  {
    id: 'ultra',
    name: 'Pack Domination Abidjan',
    price: 20000,
    estimatedViews: '+100 000 vues',
    estimatedReach: 100000,
    durationDays: 14,
    durationLabel: '14 jours (2 semaines)',
    badge: 'Visibilité VIP 👑',
    highlight: false,
    features: [
      'Omniprésence fil d’accueil, recherche & vidéos',
      'Push notification ciblée à 20 000 clients',
      'Story sponsorisée permanente en haut du feed',
      'Conseiller marketing dédié Djassa'
    ]
  }
];

const TARGET_ZONES = [
  { id: 'all_abidjan', label: 'Grand Abidjan (Toutes les 10 communes)', desc: 'Portée maximale sur tout le district' },
  { id: 'cocody', label: 'Cocody, Angré, Riviera & Bingerville', desc: 'Zone à très fort pouvoir d’achat' },
  { id: 'yopougon', label: 'Yopougon, Abobo & Attécoubé', desc: 'Plus grand bassin d’acheteurs actifs' },
  { id: 'marcory', label: 'Marcory, Zone 4, Koumassi & Treichville', desc: 'Zone urbaine dynamique & livraison rapide' },
  { id: 'plateau', label: 'Plateau & Adjamé (Bureaux & marchés)', desc: 'Idéal commandes en semaine et retraits boutique' }
];

export const VideoBoostModal: React.FC<Props> = ({
  product,
  onClose,
  onBoostConfirm,
}) => {
  const { showToast, sellers, currentSellerId } = useApp();

  const currentSeller = sellers.find(s => s.id === currentSellerId) || sellers[0];

  // Gallery active index
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  // Form states
  const [selectedPackId, setSelectedPackId] = useState<'starter' | 'pro' | 'buzz' | 'ultra'>('pro');
  const [campaignGoal, setCampaignGoal] = useState<BoostGoal>('sales');
  const [targetZone, setTargetZone] = useState<string>('all_abidjan');
  const [targetAudience, setTargetAudience] = useState<'all' | 'women' | 'men'>('all');
  const [paymentMethod, setPaymentMethod] = useState<'wave' | 'om' | 'balance'>('wave');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedCampaignId, setGeneratedCampaignId] = useState('');

  if (!product) return null;

  // Media list
  const mediaList: string[] = useMemo(() => {
    if (product.images && product.images.length > 0) {
      return product.images;
    }
    if ((product as any).media && Array.isArray((product as any).media)) {
      return (product as any).media.map((m: any) => m.url || m);
    }
    return ['https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600'];
  }, [product]);

  const activeMediaUrl = mediaList[activeMediaIndex] || mediaList[0];
  const hasVideo = Boolean(product.videoUrl);

  const currentPack = BOOST_PACKS.find(p => p.id === selectedPackId) || BOOST_PACKS[1];

  // Handle launch boost
  const handleLaunchBoost = () => {
    setIsProcessing(true);
    const campaignCode = `ADS-${Math.floor(100000 + Math.random() * 900000)}`;
    setGeneratedCampaignId(campaignCode);

    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);

      if (onBoostConfirm) {
        onBoostConfirm(product, currentPack.name, currentPack.price);
      } else {
        showToast(`Campagne Djassa Ads (${currentPack.name}) activée pour ${product.name} ! 🚀`);
      }
    }, 1000);
  };

  return (
    <div
      id="video-boost-modal-backdrop"
      className="fixed inset-0 z-[140] bg-black/80 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="video-boost-modal"
        className="w-full max-w-2xl bg-[#0F0F0F] sm:border sm:border-white/10 sm:rounded-3xl shadow-2xl flex flex-col h-full sm:h-auto sm:max-h-[92vh] overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. STICKY TOP HEADER */}
        <header className="shrink-0 h-14 px-4 bg-[#141414]/95 backdrop-blur-md border-b border-white/10 flex items-center justify-between z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              className="p-2 -ml-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition active:scale-95"
              title="Fermer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#FF6321]">
                  DJASSA ADS PRO
                </span>
                <span className="px-1.5 py-0.2 rounded-md bg-[#FF6321]/20 text-[#FF6321] text-[9px] font-black flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 fill-current" />
                  <span>PROPULSION</span>
                </span>
              </div>
              <h2 className="text-xs font-black text-white truncate max-w-[280px] sm:max-w-md">
                Booster la visibilité de l’article
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* 2. SUCCESS SCREEN STATE */}
        {isSuccess ? (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center text-center space-y-5 animate-fadeIn">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#FF6321] to-amber-400 text-white flex items-center justify-center shadow-2xl shadow-[#FF6321]/30 animate-bounce">
              <Rocket className="w-10 h-10" />
            </div>

            <div className="space-y-2 max-w-md">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-black border border-emerald-500/30 inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Campagne Sponsorisée Active</span>
              </span>
              <h3 className="text-lg font-black text-white">
                Votre article est propulsé sur Djassa !
              </h3>
              <p className="text-xs text-white/60 leading-relaxed">
                La campagne <b>{currentPack.name}</b> a été programmée pour <b>{product.name}</b>. Elle sera diffusée en priorité auprès des acheteurs ciblés à Abidjan pendant <b>{currentPack.durationLabel}</b>.
              </p>
            </div>

            {/* Campaign Summary Card */}
            <div className="w-full max-w-sm p-4 rounded-2xl bg-white/5 border border-white/10 text-left space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Référence campagne :</span>
                <span className="font-mono font-bold text-amber-300">{generatedCampaignId}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Objectif :</span>
                <span className="font-bold text-white">
                  {campaignGoal === 'sales' ? 'Commandes directes 🛍️' : campaignGoal === 'messages' ? 'Messages prospects 💬' : 'Visibilité maximale 👁️'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Portée estimée :</span>
                <span className="font-bold text-emerald-400">{currentPack.estimatedViews}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">Zone ciblée :</span>
                <span className="font-bold text-white truncate max-w-[180px]">
                  {TARGET_ZONES.find(z => z.id === targetZone)?.label || 'Grand Abidjan'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                <span className="text-white/50">Montant réglé :</span>
                <span className="font-black text-[#FF6321]">{formatFCFA(currentPack.price)}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full max-w-sm py-3 rounded-2xl bg-[#FF6321] hover:bg-[#ff753b] text-white text-xs font-black shadow-xl shadow-[#FF6321]/25 transition active:scale-95"
            >
              Fermer et retourner à la boutique
            </button>
          </div>
        ) : (
          /* 3. MAIN FORM BODY */
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-5 p-4 sm:p-5">
            {/* 3A. HERO MEDIA GALLERY */}
            <div className="relative rounded-3xl overflow-hidden bg-black/60 border border-white/10 shadow-xl group">
              <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full bg-black/80 flex items-center justify-center overflow-hidden">
                {hasVideo && isVideoPlaying ? (
                  <video
                    src={product.videoUrl}
                    controls
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={activeMediaUrl}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                )}

                {/* Top Overlay Badges */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                  <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-[#FF6321] text-black text-[10px] font-black shadow-lg flex items-center gap-1.5 border border-amber-300/40">
                    <Zap className="w-3 h-3 fill-current" />
                    <span>SPONSORISÉ • TOP FIL DJASSA</span>
                  </span>

                  <span className="px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-white/90 text-[10px] font-bold border border-white/10 flex items-center gap-1">
                    <Eye className="w-3 h-3 text-cyan-400" />
                    <span>{formatMetricCount((product as any).views || 15200)} vues</span>
                  </span>
                </div>

                {/* Bottom Overlay Title & Price */}
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black via-black/60 to-transparent flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-white truncate drop-shadow-md">
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-xs font-black text-[#FF6321]">
                        {formatFCFA(product.price)}
                      </span>
                      {product.originalPrice && product.originalPrice > product.price && (
                        <span className="text-[10px] text-white/40 line-through">
                          {formatFCFA(product.originalPrice)}
                        </span>
                      )}
                      <span className="text-[10px] text-white/50">• Stock: {product.stock || 12}</span>
                    </div>
                  </div>

                  {hasVideo && (
                    <button
                      type="button"
                      onClick={() => setIsVideoPlaying(prev => !prev)}
                      className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-[10px] font-black flex items-center gap-1.5 border border-white/20 transition active:scale-95 shrink-0"
                    >
                      {isVideoPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
                      <span>{isVideoPlaying ? 'Pause' : 'Voir Vidéo'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Media Thumbnails Row */}
              {mediaList.length > 1 && (
                <div className="p-2.5 bg-[#141414] border-t border-white/5 flex gap-2 overflow-x-auto no-scrollbar">
                  {mediaList.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setActiveMediaIndex(i);
                        setIsVideoPlaying(false);
                      }}
                      className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 transition shrink-0 ${
                        activeMediaIndex === i
                          ? 'border-[#FF6321] scale-105 shadow-md shadow-[#FF6321]/30'
                          : 'border-white/10 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 3B. MASTER SYNTHESIS IMPACT CARD */}
            <div className="p-4 rounded-3xl bg-gradient-to-br from-[#FF6321]/15 via-amber-500/10 to-black/60 border border-[#FF6321]/30 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-[#FF6321] text-white flex items-center justify-center font-black">
                    <Rocket className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white">Impact Estimé du Boost</h4>
                    <p className="text-[10px] text-white/50">Projection basée sur l'historique des ventes d'Adjamé</p>
                  </div>
                </div>

                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                  {currentPack.estimatedViews}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="p-2.5 rounded-2xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-white/50 block">Multiplicateur</span>
                  <b className="text-sm font-black text-amber-400">x5 à x10</b>
                </div>
                <div className="p-2.5 rounded-2xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-white/50 block">Commandes est.</span>
                  <b className="text-sm font-black text-emerald-400">
                    {Math.round(currentPack.estimatedReach * 0.003)} - {Math.round(currentPack.estimatedReach * 0.006)}
                  </b>
                </div>
                <div className="p-2.5 rounded-2xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-white/50 block">Durée active</span>
                  <b className="text-sm font-black text-white">{currentPack.durationLabel}</b>
                </div>
              </div>
            </div>

            {/* 3C. OBJECTIVE SELECTOR */}
            <div className="space-y-2">
              <label className="text-xs font-black text-white/80 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-[#FF6321]" />
                <span>1. Choisissez l’objectif principal de votre boost :</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  {
                    id: 'sales',
                    label: 'Commandes Directes 🛍️',
                    desc: 'Bouton d’achat express mis en avant sur le fil client.',
                  },
                  {
                    id: 'messages',
                    label: 'Demandes & Messages 💬',
                    desc: 'Inciter les clients à poser des questions et négocier.',
                  },
                  {
                    id: 'views',
                    label: 'Notoriété & Vues 👁️',
                    desc: 'Explosion des vues pour faire connaître votre boutique.',
                  },
                ].map((goal) => {
                  const isSelected = campaignGoal === goal.id;
                  return (
                    <div
                      key={goal.id}
                      onClick={() => setCampaignGoal(goal.id as BoostGoal)}
                      className={`p-3 rounded-2xl border transition cursor-pointer space-y-1 ${
                        isSelected
                          ? 'bg-[#FF6321]/15 border-[#FF6321] shadow-lg shadow-[#FF6321]/15'
                          : 'bg-white/5 border-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <b className="text-xs font-bold text-white">{goal.label}</b>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#FF6321]" />}
                      </div>
                      <p className="text-[10px] text-white/50 leading-relaxed">{goal.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3D. CAMPAIGN PACK SELECTOR */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-white/80 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>2. Sélectionnez votre forfait de visibilité Djassa Ads :</span>
                </label>
                <span className="text-[10px] text-white/40">Tarifs certifiés</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {BOOST_PACKS.map((pack) => {
                  const isSelected = selectedPackId === pack.id;
                  return (
                    <div
                      key={pack.id}
                      onClick={() => setSelectedPackId(pack.id)}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer relative flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'bg-gradient-to-br from-[#FF6321]/20 via-[#FF6321]/10 to-transparent border-[#FF6321] shadow-xl shadow-[#FF6321]/20 scale-[1.01]'
                          : 'bg-white/5 border-white/10 hover:bg-white/[0.08]'
                      }`}
                    >
                      {/* Top Row: Name + Badge */}
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-black text-white">{pack.name}</h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-black shrink-0 ${
                              pack.highlight
                                ? 'bg-[#FF6321] text-white shadow-md'
                                : 'bg-white/10 text-white/80'
                            }`}
                          >
                            {pack.badge}
                          </span>
                        </div>

                        {/* Reach & Duration */}
                        <div className="flex items-center gap-2 pt-1 text-[11px]">
                          <span className="font-extrabold text-emerald-400">{pack.estimatedViews}</span>
                          <span className="text-white/30">•</span>
                          <span className="text-white/60">{pack.durationLabel}</span>
                        </div>

                        {/* Features bullet list */}
                        <ul className="pt-2 space-y-1 text-[10px] text-white/60">
                          {pack.features.map((feat, fIdx) => (
                            <li key={fIdx} className="flex items-center gap-1.5">
                              <Check className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                              <span className="truncate">{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Bottom Row: Price & Selector Radio */}
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                        <div>
                          <span className="text-[9px] text-white/40 block">Tarif TTC :</span>
                          <b className="text-sm font-black text-white">{formatFCFA(pack.price)}</b>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                            isSelected
                              ? 'border-[#FF6321] bg-[#FF6321] text-white'
                              : 'border-white/30'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3E. GEOGRAPHIC & AUDIENCE TARGETING */}
            <div className="p-4 rounded-3xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-white flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>3. Ciblage géographique & audience :</span>
                </label>
                <span className="text-[10px] text-cyan-400 font-bold">Abidjan & Régions</span>
              </div>

              {/* Commune Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-white/60">Zone prioritaire :</label>
                <select
                  value={targetZone}
                  onChange={(e) => setTargetZone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                >
                  {TARGET_ZONES.map((zone) => (
                    <option key={zone.id} value={zone.id} className="bg-[#121212]">
                      {zone.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Audience Pill */}
              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-bold text-white/60">Public cible :</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'all', label: 'Tous (Mixte)' },
                    { id: 'women', label: 'Femmes (Wax & Mode)' },
                    { id: 'men', label: 'Hommes' },
                  ].map((aud) => (
                    <button
                      key={aud.id}
                      type="button"
                      onClick={() => setTargetAudience(aud.id as any)}
                      className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition ${
                        targetAudience === aud.id
                          ? 'border-[#FF6321] bg-[#FF6321]/20 text-white'
                          : 'border-white/5 bg-black/40 text-white/50 hover:text-white'
                      }`}
                    >
                      {aud.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3F. LIVE FEED PREVIEW SIMULATION CARD */}
            <div className="p-4 rounded-3xl bg-black/40 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white/70 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-[#FF6321]" />
                  <span>Aperçu en direct sur le fil d'accueil client</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-bold">Rendu acheteur</span>
              </div>

              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-white/10">
                    <img src={activeMediaUrl} alt="" className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/80 text-[7px] text-amber-300 font-black text-center py-0.5">
                      SPONSORISÉ
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-white/50">{currentSeller.name || 'Boutique Wax'}</span>
                      <CheckCircle2 className="w-3 h-3 text-[#FF6321]" />
                    </div>
                    <h5 className="text-xs font-bold text-white truncate">{product.name}</h5>
                    <span className="text-xs font-black text-[#FF6321]">{formatFCFA(product.price)}</span>
                  </div>
                </div>

                <div className="px-3 py-1.5 rounded-xl bg-[#FF6321] text-white text-[10px] font-black shrink-0 shadow-md">
                  Commander
                </div>
              </div>
            </div>

            {/* 3G. PAYMENT METHOD SELECTOR */}
            <div className="p-4 rounded-3xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-white flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                  <span>4. Moyen de règlement sécurisé :</span>
                </label>
                <span className="text-[10px] text-emerald-400 font-bold">100% Sécurisé</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'wave', label: 'Wave 🌊', sub: 'Paiement en ligne' },
                  { id: 'om', label: 'Orange Money 🍊', sub: 'Paiement mobile CI' },
                  { id: 'balance', label: 'Solde Boutique 💼', sub: 'Déduit de vos ventes' },
                ].map((pay) => {
                  const isSelected = paymentMethod === pay.id;
                  return (
                    <button
                      key={pay.id}
                      type="button"
                      onClick={() => setPaymentMethod(pay.id as any)}
                      className={`p-3 rounded-2xl border text-left transition flex items-center justify-between ${
                        isSelected
                          ? 'border-[#FF6321] bg-[#FF6321]/15 text-white shadow-md shadow-[#FF6321]/10'
                          : 'border-white/5 bg-black/40 text-white/60 hover:text-white'
                      }`}
                    >
                      <div>
                        <b className="text-xs block text-white">{pay.label}</b>
                        <span className="text-[10px] text-white/40 block">{pay.sub}</span>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-[#FF6321] bg-[#FF6321] text-white' : 'border-white/30'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Security Pill */}
              <div className="pt-1 flex items-center justify-center gap-1.5 text-[10px] text-white/40">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Garantie de diffusion intégrale Djassa Ads • Facture officielle disponible</span>
              </div>
            </div>
          </div>
        )}

        {/* 4. STICKY BOTTOM ACTION BAR */}
        {!isSuccess && (
          <footer className="shrink-0 p-4 bg-[#141414]/95 backdrop-blur-md border-t border-white/10 flex items-center justify-between gap-3 z-20">
            <div className="min-w-0">
              <span className="text-[10px] text-white/50 block">Total de la campagne :</span>
              <div className="flex items-baseline gap-1.5">
                <b className="text-base font-black text-white">{formatFCFA(currentPack.price)}</b>
                <span className="text-[10px] text-emerald-400 font-bold">({currentPack.durationLabel})</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold transition"
              >
                Annuler
              </button>

              <button
                type="button"
                disabled={isProcessing}
                onClick={handleLaunchBoost}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-[#FF6321] to-[#ff7e47] hover:from-[#ff753b] hover:to-[#ff8d5c] text-white text-xs font-black shadow-xl shadow-[#FF6321]/30 transition active:scale-95 flex items-center gap-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <>
                    <Rocket className="w-4 h-4" />
                    <span>Lancer le Boost • {formatFCFA(currentPack.price)}</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                  </>
                )}
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
};
