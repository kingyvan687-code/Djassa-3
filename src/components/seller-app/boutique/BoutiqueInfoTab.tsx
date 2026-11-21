import React, { useState, useMemo } from 'react';
import { 
  Store, 
  MapPin, 
  Phone, 
  ShieldCheck, 
  Truck, 
  Star, 
  Edit3, 
  Clock, 
  MessageSquare, 
  Check, 
  Send,
  Power,
  Share2,
  QrCode,
  Megaphone,
  Copy,
  ExternalLink,
  MessageCircle,
  Plus,
  Trash2,
  Camera,
  X,
  CreditCard,
  Package,
  Award,
  Sparkles,
  ChevronRight,
  Shield,
  ThumbsUp,
  Download,
  AlertCircle,
  FileText
} from 'lucide-react';
import { Seller, Product } from '../../../types';
import { formatFCFA } from '../../../services/marketServices';
import { useApp } from '../../../context/AppContext';

interface Props {
  seller: Seller;
  products?: Product[];
  isOpen: boolean;
  onToggleOpen: () => void;
  onEditBoutique?: () => void;
  onGoProfile?: () => void;
  onUpdateSeller?: (updates: Partial<Seller>) => void;
}

export const BoutiqueInfoTab: React.FC<Props> = ({
  seller,
  products = [],
  isOpen,
  onToggleOpen,
  onEditBoutique,
  onGoProfile,
  onUpdateSeller,
}) => {
  const { showToast, startCall, navigateToDiscussions, setSelectedSeller } = useApp();

  // Local storage keys for customizable boutique parameters
  const [openingHours, setOpeningHours] = useState(() => {
    return localStorage.getItem(`djassa_boutique_hours_${seller.id}`) || 'Lun - Sam : 08h00 - 19h00 (Dimanche sur commande)';
  });

  const [deliveryDelay, setDeliveryDelay] = useState(() => {
    return localStorage.getItem(`djassa_boutique_delay_${seller.id}`) || 'Expédition rapide en 30 à 45 min à Abidjan';
  });

  const [returnPolicy, setReturnPolicy] = useState(() => {
    return localStorage.getItem(`djassa_boutique_policy_${seller.id}`) || 'Échange accepté sous 48h en boutique en cas de non-conformité ou défaut.';
  });

  const [acceptedPayments, setAcceptedPayments] = useState<{ wave: boolean; om: boolean; cod: boolean }>(() => {
    const saved = localStorage.getItem(`djassa_boutique_payments_${seller.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { wave: parsed.wave ?? true, om: parsed.om ?? true, cod: parsed.cod ?? true };
      } catch (e) {}
    }
    return { wave: true, om: true, cod: true };
  });

  // Client reviews state with interactive replies
  const [clientReviews, setClientReviews] = useState([
    {
      id: 1,
      author: 'Aïcha Traoré',
      commune: 'Cocody Angré',
      rating: 5,
      date: 'Hier, 16:30',
      comment: 'Superbe qualité des pagnes et emballage très soigné. Expédition rapide à Angré par la boutique !',
      productName: 'Pagne Woodin Original 3 Pièces',
      sellerReply: 'Merci infiniment pour votre confiance Mme Traoré ! Nous sélectionnons nos pagnes directement à la source.',
      likes: 12,
    },
    {
      id: 2,
      author: 'Kouamé Eric',
      commune: 'Marcory Zone 4',
      rating: 5,
      date: 'Il y a 2 jours',
      comment: 'Vendeur très réactif en messagerie interne. Commande passée à midi, reçue au bureau avant 13h.',
      productName: 'Chemise en Lin Brodé',
      sellerReply: '',
      likes: 8,
    },
    {
      id: 3,
      author: 'Fatou Diop',
      commune: 'Yopougon Maroc',
      rating: 4,
      date: 'Il y a 4 jours',
      comment: 'Très jolie marchandise conforme aux photos. Emballage protecteur intact avec facture.',
      productName: 'Robe Wax Moderne',
      sellerReply: 'Ravi que la coupe vous plaise Fatou ! À très bientôt sur Djassa.',
      likes: 5,
    },
    {
      id: 4,
      author: 'Bamba Souleymane',
      commune: 'Adjamé Forum',
      rating: 5,
      date: 'Il y a 1 semaine',
      comment: 'La meilleure boutique du marché pour les commandes de gros et détails. Vendeur sérieux.',
      productName: 'Lot Tissus Bazin Riche',
      sellerReply: 'Merci mon frère Souleymane, la fidélité est toujours récompensée chez nous !',
      likes: 19,
    },
  ]);

  const [replyInput, setReplyInput] = useState<Record<number, string>>({});

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState(seller.name);
  const [editUsername, setEditUsername] = useState(seller.username);
  const [editLocation, setEditLocation] = useState(seller.location);
  const [editPhone, setEditPhone] = useState(seller.phone || '+225 07 00 00 00 00');
  const [editBio, setEditBio] = useState(seller.bio || '');
  const [editBanner, setEditBanner] = useState(seller.banner || 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=1200');
  const [editHours, setEditHours] = useState(openingHours);
  const [editDelay, setEditDelay] = useState(deliveryDelay);
  const [editPolicy, setEditPolicy] = useState(returnPolicy);

  // Broadcast state
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastPromo, setBroadcastPromo] = useState('');

  // Handle Save Boutique Details
  const handleSaveBoutiqueInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;

    const updates: Partial<Seller> = {
      name: editName.trim(),
      username: editUsername.trim().replace(/^@/, ''),
      location: editLocation.trim(),
      phone: editPhone.trim(),
      bio: editBio.trim(),
      banner: editBanner,
    };

    onUpdateSeller?.(updates);
    setOpeningHours(editHours);
    setDeliveryDelay(editDelay);
    setReturnPolicy(editPolicy);

    localStorage.setItem(`djassa_boutique_hours_${seller.id}`, editHours);
    localStorage.setItem(`djassa_boutique_delay_${seller.id}`, editDelay);
    localStorage.setItem(`djassa_boutique_policy_${seller.id}`, editPolicy);

    setIsEditModalOpen(false);
    showToast('Coordonnées et paramètres boutique enregistrés ! ✨');
  };

  // Toggle payment option
  const handleTogglePayment = (key: 'wave' | 'om' | 'cod') => {
    const next = { ...acceptedPayments, [key]: !acceptedPayments[key] };
    setAcceptedPayments(next);
    localStorage.setItem(`djassa_boutique_payments_${seller.id}`, JSON.stringify(next));
    showToast(`Moyen de paiement mis à jour : ${key.toUpperCase()} ${next[key] ? 'activé 🟢' : 'désactivé 🔴'}`);
  };

  // Reply to Client Review
  const handleSendReply = (reviewId: number) => {
    const text = replyInput[reviewId]?.trim();
    if (!text) return;

    setClientReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, sellerReply: text } : r))
    );
    setReplyInput((prev) => ({ ...prev, [reviewId]: '' }));
    showToast('Votre réponse officielle a été publiée ! 💬');
  };

  // Share Boutique Link
  const shopUrl = `https://djassa.ci/b/@${seller.username || 'boutique'}`;
  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(shopUrl);
      showToast('Lien de votre boutique copié dans le presse-papier ! 📋');
    } catch (e) {
      showToast(shopUrl);
    }
  };

  const handleOpenDiscussions = () => {
    navigateToDiscussions();
  };

  // Send Broadcast Announcement
  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;

    setIsBroadcastModalOpen(false);
    showToast(`Annonce diffusée à vos ${seller.followedCount || 1240} abonnés avec succès ! 📢`);
    setBroadcastMessage('');
    setBroadcastPromo('');
  };

  return (
    <div id="boutique-management-hub" className="space-y-4">
      {/* 1. STORE COVER BANNER & BRAND IDENTITY CARD */}
      <div className="rounded-3xl bg-[#141414] border border-white/10 overflow-hidden shadow-2xl relative">
        {/* Cover Photo Banner */}
        <div className="relative h-32 sm:h-44 w-full overflow-hidden bg-neutral-900">
          <img
            src={seller.banner || 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=1200'}
            alt="Bannière Boutique"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-black/40 to-black/20" />

          {/* Quick Edit Banner Button */}
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="absolute top-3 right-3 px-2.5 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-[10px] font-bold border border-white/15 flex items-center gap-1.5 transition active:scale-95"
            title="Modifier la photo de vitrine"
          >
            <Camera className="w-3.5 h-3.5 text-[#FF6321]" />
            <span>Modifier la vitrine</span>
          </button>

          {/* Live Status Badge */}
          <div className="absolute top-3 left-3">
            <button
              id="boutique-quick-toggle-status"
              onClick={onToggleOpen}
              className={`px-3 py-1.5 rounded-full text-xs font-black backdrop-blur-md border transition flex items-center gap-2 shadow-lg ${
                isOpen
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                  : 'bg-amber-950/80 text-amber-300 border-amber-500/50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
              <span>{isOpen ? 'Boutique Ouverte 🟢' : 'Boutique Fermée 🟡'}</span>
            </button>
          </div>
        </div>

        {/* Brand Details & Profile Avatar Header */}
        <div className="px-4 pb-4 pt-0 -mt-10 relative space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            {/* Avatar + Main Identity */}
            <div className="flex items-end gap-3 min-w-0">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-3 border-[#141414] bg-neutral-900 shadow-xl shrink-0">
                <img
                  src={seller.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300'}
                  alt={seller.name}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="pb-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-base sm:text-lg font-black text-white truncate">
                    {seller.name}
                  </h2>
                  {seller.verified && (
                    <span title="Boutique Vérifiée Djassa Pro">
                      <ShieldCheck className="w-4 h-4 text-[#FF6321] shrink-0" />
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-[#FF6321] font-bold">
                  <span>@{seller.username}</span>
                  <span className="text-white/30">•</span>
                  <span className="text-white/60 font-normal">{seller.location}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons: Share, QR Code, Voir Profil, Discussions, Edit */}
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              <button
                id="btn-view-profile-boutique"
                onClick={() => {
                  if (onGoProfile) {
                    onGoProfile();
                  } else {
                    setSelectedSeller(seller);
                  }
                }}
                className="p-2 rounded-xl bg-[#FF6321]/20 hover:bg-[#FF6321]/30 text-[#FF6321] hover:text-white transition border border-[#FF6321]/30 flex items-center gap-1 text-xs font-bold active:scale-95"
                title="Voir le profil de la boutique"
              >
                <Store className="w-4 h-4" />
                <span className="hidden sm:inline">Voir profil</span>
              </button>

              <button
                id="btn-open-qr-boutique"
                onClick={() => setIsQrModalOpen(true)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition border border-white/10 flex items-center gap-1 text-xs font-bold"
                title="Afficher le QR Code de la boutique"
              >
                <QrCode className="w-4 h-4 text-[#FF6321]" />
                <span className="hidden sm:inline">QR Code</span>
              </button>

              <button
                id="btn-open-discussions-boutique"
                onClick={handleOpenDiscussions}
                className="p-2 rounded-xl bg-[#FF6321]/15 hover:bg-[#FF6321]/25 text-[#FF6321] transition border border-[#FF6321]/30 flex items-center gap-1 text-xs font-bold"
                title="Accéder aux discussions internes sur Djassa"
              >
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">Discussions</span>
              </button>

              <button
                id="btn-edit-boutique-main"
                onClick={() => setIsEditModalOpen(true)}
                className="p-2 rounded-xl bg-[#FF6321] hover:bg-[#e05518] text-white transition flex items-center gap-1 text-xs font-black shadow-lg shadow-[#FF6321]/30 active:scale-95"
              >
                <Edit3 className="w-4 h-4" />
                <span>Modifier</span>
              </button>
            </div>
          </div>

          {/* Boutique Bio */}
          <p className="text-xs text-white/75 leading-relaxed bg-white/[0.03] p-3 rounded-2xl border border-white/5">
            {seller.bio || 'Bienvenue dans notre boutique officielle DJASSA ! Mode, accessoires de luxe et pagnes authentiques avec livraison express garantie à Abidjan.'}
          </p>

          {/* Key Trust Badges & Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="p-2.5 rounded-2xl bg-black/50 border border-white/10 text-left">
              <span className="text-[9px] font-bold text-amber-300 uppercase block">Satisfaction client</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <b className="text-sm font-black text-white">{seller.rating || 4.9} / 5</b>
              </div>
              <span className="text-[9px] text-white/40">{seller.reviewsCount || 384} avis certifiés</span>
            </div>

            <div className="p-2.5 rounded-2xl bg-black/50 border border-white/10 text-left">
              <span className="text-[9px] font-bold text-cyan-300 uppercase block">Clients fidèles</span>
              <b className="text-sm font-black text-white mt-0.5 block">
                {(seller.followedCount || 1240).toLocaleString('fr-FR')}
              </b>
              <span className="text-[9px] text-white/40">Abonnés actifs</span>
            </div>

            <div className="p-2.5 rounded-2xl bg-black/50 border border-white/10 text-left">
              <span className="text-[9px] font-bold text-emerald-300 uppercase block">Ventes réalisées</span>
              <b className="text-sm font-black text-emerald-400 mt-0.5 block">
                {seller.salesCount || 1420}+ colis
              </b>
              <span className="text-[9px] text-white/40">100% livrés</span>
            </div>

            <div className="p-2.5 rounded-2xl bg-black/50 border border-white/10 text-left">
              <span className="text-[9px] font-bold text-[#FF6321] uppercase block">Articles en vitrine</span>
              <b className="text-sm font-black text-white mt-0.5 block">
                {products.length} référence{products.length > 1 ? 's' : ''}
              </b>
              <span className="text-[9px] text-white/40">Disponibles en rayon</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. PROMOTION & BROADCAST BANNER */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-[#FF6321]/15 via-orange-950/20 to-black border border-[#FF6321]/30 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-[#FF6321]/20 text-[#FF6321] shrink-0 border border-[#FF6321]/30">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black text-white">
              Diffuser une annonce à vos {(seller.followedCount || 1240).toLocaleString('fr-FR')} abonnés
            </h3>
            <p className="text-[11px] text-white/60 mt-0.5">
              Prévenez vos clients d'un nouvel arrivage, d'une promo flash ou d'une remise exclusive
            </p>
          </div>
        </div>

        <button
          id="btn-open-broadcast-modal"
          onClick={() => setIsBroadcastModalOpen(true)}
          className="px-3.5 py-2 rounded-2xl bg-[#FF6321] hover:bg-[#e05518] text-white text-xs font-black transition shadow-lg shadow-[#FF6321]/30 flex items-center gap-1.5 shrink-0 active:scale-95"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Envoyer une annonce</span>
        </button>
      </div>

      {/* 3. INFORMATIONS PRATIQUES & PARAMÈTRES COMMERCIAUX */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Card 1: Coordonnées & Horaires */}
        <div className="p-4 rounded-3xl bg-[#141414] border border-white/10 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <b className="text-xs text-white flex items-center gap-2">
              <Store className="w-4 h-4 text-[#FF6321]" />
              <span>Coordonnées & Magasin</span>
            </b>
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="text-[10px] text-[#FF6321] font-bold hover:underline"
            >
              Modifier
            </button>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Location */}
            <div className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-white/5 border border-white/5">
              <MapPin className="w-4 h-4 text-[#FF6321] shrink-0 mt-0.5" />
              <div>
                <b className="text-white block">Localisation du magasin / dépôt</b>
                <span className="text-white/70 block mt-0.5">{seller.location}</span>
                <span className="text-[10px] text-white/40 block mt-0.5">Abidjan, Côte d'Ivoire</span>
              </div>
            </div>

            {/* Direct Phone & Chat */}
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <b className="text-white block">Ligne directe & Contact</b>
                  <span className="text-white/70 font-mono">{seller.phone || '+225 07 00 00 00 00'}</span>
                </div>
              </div>
              {seller.phone && (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      startCall(seller.phone, 'client');
                    } catch (e) {
                      showToast(`Test d'appel vers ${seller.phone}`);
                    }
                  }}
                  className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30 hover:bg-emerald-500/30 transition"
                >
                  Tester appel
                </button>
              )}
            </div>

            {/* Hours */}
            <div className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-white/5 border border-white/5">
              <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <b className="text-white block">Horaires de préparation & ouverture</b>
                <span className="text-white/70 block mt-0.5">{openingHours}</span>
                <span className="text-[10px] text-emerald-400 block mt-0.5 font-bold">⚡ {deliveryDelay}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Moyens de Paiement Acceptés & Garanties */}
        <div className="p-4 rounded-3xl bg-[#141414] border border-white/10 space-y-3 shadow-lg">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <b className="text-xs text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span>Modes de Règlement Acceptés</span>
            </b>
            <span className="text-[10px] text-white/40">Cliquez pour basculer</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Wave CI */}
            <div
              onClick={() => handleTogglePayment('wave')}
              className={`p-2.5 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                acceptedPayments.wave
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-white'
                  : 'bg-white/5 border-white/10 text-white/40 opacity-60'
              }`}
            >
              <div>
                <b className="text-xs block text-cyan-400">Wave CI (En ligne)</b>
                <span className="text-[9px] text-white/50">Reversement direct · 150 F</span>
              </div>
              <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                acceptedPayments.wave ? 'bg-cyan-400 text-black' : 'bg-white/10 text-white/40'
              }`}>
                {acceptedPayments.wave ? '✓' : '×'}
              </span>
            </div>

            {/* Orange Money */}
            <div
              onClick={() => handleTogglePayment('om')}
              className={`p-2.5 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                acceptedPayments.om
                  ? 'bg-orange-500/15 border-orange-500/40 text-white'
                  : 'bg-white/5 border-white/10 text-white/40 opacity-60'
              }`}
            >
              <div>
                <b className="text-xs block text-orange-400">Orange Money (En ligne)</b>
                <span className="text-[9px] text-white/50">Reversement direct · 150 F</span>
              </div>
              <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                acceptedPayments.om ? 'bg-orange-400 text-black' : 'bg-white/10 text-white/40'
              }`}>
                {acceptedPayments.om ? '✓' : '×'}
              </span>
            </div>

            {/* Paiement à la livraison (COD) */}
            <div
              onClick={() => handleTogglePayment('cod')}
              className={`col-span-2 p-2.5 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                acceptedPayments.cod
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
                  : 'bg-white/5 border-white/10 text-white/40 opacity-60'
              }`}
            >
              <div>
                <b className="text-xs block text-emerald-400">Paiement à la livraison (COD)</b>
                <span className="text-[9px] text-white/50">0% frais client · Le client paie directement à la réception (150 F comm. DJASSA)</span>
              </div>
              <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                acceptedPayments.cod ? 'bg-emerald-400 text-black' : 'bg-white/10 text-white/40'
              }`}>
                {acceptedPayments.cod ? '✓' : '×'}
              </span>
            </div>
          </div>

          {/* Return & Quality Policy */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-xs space-y-1">
            <div className="flex items-center gap-1.5 text-white font-bold">
              <ShieldCheck className="w-4 h-4 text-[#FF6321]" />
              <span>Garantie & Politique d'Échange</span>
            </div>
            <p className="text-[11px] text-white/70 leading-relaxed">
              "{returnPolicy}"
            </p>
          </div>
        </div>
      </div>

      {/* 4. GESTION EXTERNE DE LA LIVRAISON PAR LA BOUTIQUE */}
      <div className="p-4 rounded-3xl bg-[#141414] border border-white/10 space-y-2.5 shadow-xl">
        <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
          <div className="p-2 rounded-xl bg-[#FF6321]/15 text-[#FF6321]">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <b className="text-xs sm:text-sm text-white block">
              Livraison organisée directement par votre boutique
            </b>
            <span className="text-[10px] text-white/50">
              0 FCFA de frais de livraison facturé sur DJASSA · Vous organisez l'expédition externe avec le client
            </span>
          </div>
        </div>
        <p className="text-[11px] text-white/70 leading-relaxed">
          À chaque commande confirmée, vous recevez l'adresse et le téléphone du client pour convenir directement de la remise du colis en dehors de DJASSA.
        </p>
      </div>

      {/* 5. AVIS CLIENTS & RÉPONSES OFFICIELLES DU VENDEUR */}
      <div className="p-4 rounded-3xl bg-[#141414] border border-white/10 space-y-3.5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
              <Star className="w-4 h-4 fill-amber-400" />
            </div>
            <div>
              <b className="text-xs sm:text-sm text-white block">
                Avis Clients Vérifiés & Réputation ({seller.reviewsCount || 384})
              </b>
              <span className="text-[10px] text-white/50">
                Répondez directement aux clients pour soigner votre image de marque
              </span>
            </div>
          </div>

          <span className="text-xs font-black text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-xl">
            ★ {seller.rating || 4.9} / 5 d'excellence
          </span>
        </div>

        {/* Reviews List */}
        <div className="space-y-3">
          {clientReviews.map((rev) => (
            <div
              key={rev.id}
              className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-2.5 hover:border-white/10 transition"
            >
              {/* Review Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <b className="text-xs text-white">{rev.author}</b>
                    <span className="text-[10px] text-white/40">• {rev.commune}</span>
                    <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded-md border border-emerald-500/20">
                      Achat vérifié ✓
                    </span>
                  </div>
                  {rev.productName && (
                    <span className="text-[10px] text-white/50 block mt-0.5">
                      Article : <b className="text-white/70">{rev.productName}</b>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 text-amber-400 text-xs shrink-0">
                  {'★'.repeat(rev.rating)}
                  <span className="text-[10px] text-white/40 ml-1">{rev.date}</span>
                </div>
              </div>

              {/* Comment */}
              <p className="text-xs text-white/80 leading-relaxed bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                "{rev.comment}"
              </p>

              {/* Seller Official Reply */}
              {rev.sellerReply ? (
                <div className="p-2.5 rounded-xl bg-orange-500/10 border border-[#FF6321]/25 text-xs text-white/85 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-[#FF6321]">
                    <Store className="w-3.5 h-3.5" />
                    <span>Réponse officielle de {seller.name} :</span>
                  </div>
                  <p className="text-[11px] text-white/80 leading-relaxed pl-5">
                    "{rev.sellerReply}"
                  </p>
                </div>
              ) : (
                /* Reply Input Form */
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="text"
                    value={replyInput[rev.id] || ''}
                    onChange={(e) => setReplyInput({ ...replyInput, [rev.id]: e.target.value })}
                    placeholder="Rédiger une réponse publique et polie..."
                    className="flex-1 p-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF6321]"
                  />
                  <button
                    type="button"
                    onClick={() => handleSendReply(rev.id)}
                    className="px-3 py-2 rounded-xl bg-[#FF6321] hover:bg-[#e05518] text-white text-xs font-black transition flex items-center gap-1 shrink-0 shadow-md shadow-[#FF6321]/30 active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Répondre</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 6. MODAL: EDIT BOUTIQUE DETAILS */}
      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-[#141414] border border-white/15 rounded-3xl p-5 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#FF6321]/20 text-[#FF6321]">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    Modifier la Vitrine & Paramètres
                  </h3>
                  <p className="text-[10px] text-white/50">
                    Ces informations sont directement visibles par tous vos clients
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-full text-white/50 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBoutiqueInfo} className="space-y-3.5">
              {/* Store Name & Username */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-white/80 block mb-1">Nom de la boutique</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-white/80 block mb-1">Identifiant @handle</label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    required
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                  />
                </div>
              </div>

              {/* Location & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-white/80 block mb-1">Commune & Adresse (Abidjan)</label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="Ex: Cocody Angré 8ème Tranche"
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-white/80 block mb-1">Téléphone de contact</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Ex: +225 07 12 34 56 78"
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="text-xs font-bold text-white/80 block mb-1">
                  Description / Présentation de la boutique
                </label>
                <textarea
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Présentez vos spécialités, collections et garanties à vos futurs clients..."
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321] resize-none"
                />
              </div>

              {/* Photo de Bannière URL */}
              <div>
                <label className="text-xs font-bold text-white/80 block mb-1">
                  URL de la photo de bannière
                </label>
                <input
                  type="url"
                  value={editBanner}
                  onChange={(e) => setEditBanner(e.target.value)}
                  placeholder="https://..."
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                />
              </div>

              {/* Opening Hours & Speed */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-white/80 block mb-1">Horaires d'ouverture</label>
                  <input
                    type="text"
                    value={editHours}
                    onChange={(e) => setEditHours(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-white/80 block mb-1">Délai moyen d'expédition</label>
                  <input
                    type="text"
                    value={editDelay}
                    onChange={(e) => setEditDelay(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                  />
                </div>
              </div>

              {/* Return Policy */}
              <div>
                <label className="text-xs font-bold text-white/80 block mb-1">Politique d'échange & retours</label>
                <input
                  type="text"
                  value={editPolicy}
                  onChange={(e) => setEditPolicy(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 text-xs font-bold transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6321] hover:bg-[#e05518] text-white text-xs font-black shadow-lg shadow-[#FF6321]/30 transition flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Enregistrer les modifications</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: QR CODE & PUBLIC SHOP LINK */}
      {isQrModalOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsQrModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-[#141414] border border-white/15 rounded-3xl p-5 space-y-4 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-[#FF6321]" />
                <span>QR Code Officiel de la Boutique</span>
              </span>
              <button
                onClick={() => setIsQrModalOpen(false)}
                className="p-1 rounded-full text-white/50 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Generated QR Code View */}
            <div className="p-4 rounded-3xl bg-white flex flex-col items-center justify-center space-y-2.5 shadow-xl">
              <div className="w-44 h-44 bg-neutral-100 rounded-2xl flex items-center justify-center p-2 border-2 border-dashed border-neutral-300 relative">
                {/* Visual stylised QR Code */}
                <div className="w-full h-full bg-black rounded-xl p-2.5 flex flex-col justify-between">
                  <div className="flex justify-between">
                    <div className="w-10 h-10 bg-white rounded-lg p-1.5 flex items-center justify-center">
                      <div className="w-full h-full bg-black rounded" />
                    </div>
                    <div className="w-10 h-10 bg-white rounded-lg p-1.5 flex items-center justify-center">
                      <div className="w-full h-full bg-black rounded" />
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-[#FF6321] text-white flex items-center justify-center text-[10px] font-black">
                      DJ
                    </div>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="w-10 h-10 bg-white rounded-lg p-1.5 flex items-center justify-center">
                      <div className="w-full h-full bg-black rounded" />
                    </div>
                    <div className="w-6 h-6 bg-white rounded-sm" />
                  </div>
                </div>
              </div>
              <p className="text-[11px] font-black text-black">
                {seller.name} • DJASSA CI
              </p>
            </div>

            {/* Share & Copy Link */}
            <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs text-white/80">
              <span className="font-mono text-[11px] truncate">{shopUrl}</span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white shrink-0 ml-2"
                title="Copier le lien"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsQrModalOpen(false);
                  navigateToDiscussions();
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#FF6321] hover:bg-[#e05518] text-white text-xs font-black transition flex items-center justify-center gap-1.5"
                title="Ouvrir les discussions"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Discussions</span>
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copier le lien</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL: BROADCAST ANNOUNCEMENT TO FOLLOWERS */}
      {isBroadcastModalOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsBroadcastModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[#141414] border border-white/15 rounded-3xl p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#FF6321]/20 text-[#FF6321]">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Diffuser une Annonce</h3>
                  <p className="text-[10px] text-white/50">
                    Envoyée à vos {(seller.followedCount || 1240).toLocaleString('fr-FR')} abonnés
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBroadcastModalOpen(false)}
                className="p-1 rounded-full text-white/50 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendBroadcast} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-white/80 block mb-1">
                  Message de l'annonce ou de la promotion
                </label>
                <textarea
                  rows={3}
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="Ex : Arrivage exclusif de pagnes Woodin ce samedi ! Profitez de la livraison offerte dès 2 articles..."
                  required
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#FF6321] resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white/80 block mb-1">
                  Code promo ou avantage spécial (optionnel)
                </label>
                <input
                  type="text"
                  value={broadcastPromo}
                  onChange={(e) => setBroadcastPromo(e.target.value)}
                  placeholder="Ex : DJASSAWOODIN (-15%)"
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono font-bold text-[#FF6321] placeholder:text-white/25 focus:outline-none focus:border-[#FF6321]"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsBroadcastModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 text-xs font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6321] hover:bg-[#e05518] text-white text-xs font-black shadow-lg shadow-[#FF6321]/30 flex items-center justify-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  <span>Diffuser l'annonce</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
