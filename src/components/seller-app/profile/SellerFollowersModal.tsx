import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  Search,
  Users,
  MapPin,
  MessageCircle,
  ShoppingBag,
  Calendar,
  Sparkles,
  Send,
  Star,
  Award,
  TrendingUp,
  Percent,
  Gift,
  Phone,
  CheckCircle2,
  Filter,
  X,
  ArrowUpDown,
  Tag,
  Clock,
  ChevronRight,
  ShieldCheck,
  Copy,
  SlidersHorizontal,
  Flame,
  Volume2
} from 'lucide-react';
import { Seller } from '../../../types';
import { formatFCFA, formatMetricCount } from '../../../services/marketServices';
import { useApp } from '../../../context/AppContext';
import { FollowerClientData, SellerClientPromoModal } from './SellerClientPromoModal';

interface SellerFollowersModalProps {
  seller: Seller;
  onClose: () => void;
  onSendMessage?: (followerName: string) => void;
  onShowToast: (message: string) => void;
}

export type FollowerItem = FollowerClientData & {
  phone?: string;
  favoriteCategory?: string;
  notes?: string;
  loyaltyLevel?: 'Bronze' | 'Argent' | 'Or' | 'VIP Diamant';
};

export const SellerFollowersModal: React.FC<SellerFollowersModalProps> = ({
  seller,
  onClose,
  onShowToast
}) => {
  const { openChatWithParticipant, setSellerActiveTab, products } = useApp();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'vip' | 'buyers' | 'recent' | 'new'>('all');
  const [selectedCommune, setSelectedCommune] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'spent_desc' | 'orders_desc' | 'recent' | 'name'>('spent_desc');

  // Modals state
  const [selectedClientForDetail, setSelectedClientForDetail] = useState<FollowerItem | null>(null);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('👗 Nouveautés Arrivage');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastCoupon, setBroadcastCoupon] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [selectedClientForPromo, setSelectedClientForPromo] = useState<FollowerItem | null>(null);

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    setIsBroadcasting(true);
    setTimeout(() => {
      setIsBroadcasting(false);
      setIsBroadcastModalOpen(false);
      onShowToast(`Message diffusé avec succès aux ${formatMetricCount(seller.followedCount)} abonnés de votre boutique ! 📢`);
      setBroadcastMessage('');
      setBroadcastCoupon('');
    }, 700);
  };

  // Comprehensive realistic mock list of followers in Abidjan
  const mockFollowers: FollowerItem[] = useMemo(() => [
    {
      id: 'f-1',
      name: 'Fatou Bamba',
      username: 'fatou_bamba',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300',
      commune: 'Cocody',
      quartier: 'Angré 8ème Tranche',
      phone: '+225 07 48 11 22 33',
      ordersPlacedCount: 7,
      followedSince: 'Il y a 6 mois',
      isVip: true,
      loyaltyLevel: 'VIP Diamant',
      lastPurchaseDate: '18 Sept 2026',
      totalSpent: 168000,
      favoriteCategory: 'Robes Wax & Bazin',
      notes: 'Cliente fidèle très réactive sur les directs vidéo.'
    },
    {
      id: 'f-2',
      name: 'Koffi Serge',
      username: 'serge_koffi_ci',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300',
      commune: 'Marcory',
      quartier: 'Zone 4, Rue Mercedes',
      phone: '+225 05 88 44 22 11',
      ordersPlacedCount: 4,
      followedSince: 'Il y a 3 mois',
      isVip: true,
      loyaltyLevel: 'Or',
      lastPurchaseDate: '12 Sept 2026',
      totalSpent: 98000,
      favoriteCategory: 'Sacs Cuir & Pagne',
      notes: 'Commande souvent pour des cadeaux.'
    },
    {
      id: 'f-3',
      name: 'Amina Kouamé',
      username: 'amina_style',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
      commune: 'Yopougon',
      quartier: 'Selmer, Vers Nouveau Quartier',
      phone: '+225 01 22 33 44 55',
      ordersPlacedCount: 3,
      followedSince: 'Il y a 4 mois',
      loyaltyLevel: 'Argent',
      lastPurchaseDate: '5 Sept 2026',
      totalSpent: 64000,
      favoriteCategory: 'Pagnes Woodin & Uniwax',
      notes: 'Préfère la livraison en express l’après-midi.'
    },
    {
      id: 'f-4',
      name: 'Nadia Yao',
      username: 'nadia_chic',
      avatar: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=300',
      commune: 'Plateau',
      quartier: 'Avenue Chardy',
      phone: '+225 07 99 88 77 66',
      ordersPlacedCount: 6,
      followedSince: 'Il y a 8 mois',
      isVip: true,
      loyaltyLevel: 'VIP Diamant',
      lastPurchaseDate: '22 Sept 2026',
      totalSpent: 142000,
      favoriteCategory: 'Ensembles Haute Couture',
      notes: 'Cadre bancaire au Plateau, commande pour ses événements.'
    },
    {
      id: 'f-5',
      name: 'Patrick Koffi',
      username: 'pat_koffi',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300',
      commune: 'Koumassi',
      quartier: 'Grand Remblais',
      phone: '+225 05 55 44 33 22',
      ordersPlacedCount: 2,
      followedSince: 'Il y a 2 semaines',
      loyaltyLevel: 'Bronze',
      lastPurchaseDate: '8 Sept 2026',
      totalSpent: 38000,
      favoriteCategory: 'Accessoires Wax',
      notes: 'Nouvel abonné intéressé par les arrivages réguliers.'
    },
    {
      id: 'f-6',
      name: 'Sandrine Kouadio',
      username: 'sandrine_k',
      avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300',
      commune: 'Marcory',
      quartier: 'Biétry Résidentiel',
      phone: '+225 07 12 34 56 78',
      ordersPlacedCount: 8,
      followedSince: 'Il y a 10 mois',
      isVip: true,
      loyaltyLevel: 'VIP Diamant',
      lastPurchaseDate: '24 Sept 2026',
      totalSpent: 195000,
      favoriteCategory: 'Sacs à main & Chaussures assorties',
      notes: 'Achète dès la publication des vidéos lookbook.'
    },
    {
      id: 'f-7',
      name: 'Moussa Bakayoko',
      username: 'moussa_b',
      avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300',
      commune: 'Adjamé',
      quartier: 'Forum des Marchés, Allée C',
      phone: '+225 01 02 03 04 05',
      ordersPlacedCount: 3,
      followedSince: 'Il y a 5 jours',
      loyaltyLevel: 'Argent',
      lastPurchaseDate: '26 Sept 2026',
      totalSpent: 55000,
      favoriteCategory: 'Bazin Riche Brodé',
      notes: 'Voisin de marché qui commande pour sa famille.'
    },
    {
      id: 'f-8',
      name: 'Mariam Traoré',
      username: 'mariam_tr',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300',
      commune: 'Abobo',
      quartier: 'Avocatier',
      phone: '+225 07 77 66 55 44',
      ordersPlacedCount: 1,
      followedSince: 'Il y a 3 jours',
      loyaltyLevel: 'Bronze',
      lastPurchaseDate: '27 Sept 2026',
      totalSpent: 22000,
      favoriteCategory: 'Petits pagnes et foulards',
      notes: 'Attire par la vidéo TikTok virale.'
    },
    {
      id: 'f-9',
      name: 'Estelle Diop',
      username: 'estelle_d',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300',
      commune: 'Cocody',
      quartier: 'Deux-Plateaux Vallons',
      phone: '+225 05 66 77 88 99',
      ordersPlacedCount: 5,
      followedSince: 'Il y a 7 mois',
      isVip: true,
      loyaltyLevel: 'Or',
      lastPurchaseDate: '15 Sept 2026',
      totalSpent: 128000,
      favoriteCategory: 'Robes modernes et vestes wax',
      notes: 'Recommande souvent la boutique à ses collègues.'
    },
    {
      id: 'f-10',
      name: 'Jean-Eudes Béké',
      username: 'jeaneudes_b',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300',
      commune: 'Treichville',
      quartier: 'Avenue 16',
      phone: '+225 01 44 55 66 77',
      ordersPlacedCount: 0,
      followedSince: 'Hier',
      loyaltyLevel: 'Bronze',
      totalSpent: 0,
      favoriteCategory: 'Chemises imprimées homme',
      notes: 'Nouvel abonné n’ayant pas encore commandé (prospect chaud).'
    },
    {
      id: 'f-11',
      name: 'Aïcha Ouattara',
      username: 'aicha_o',
      avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=300',
      commune: 'Cocody',
      quartier: 'Riviera Bonoumin',
      phone: '+225 07 33 22 11 00',
      ordersPlacedCount: 4,
      followedSince: 'Il y a 5 mois',
      loyaltyLevel: 'Or',
      lastPurchaseDate: '20 Sept 2026',
      totalSpent: 89000,
      favoriteCategory: 'Ensembles tailleurs wax chic',
      notes: 'Apprécie les tissus certifiés Uniwax Côte d’Ivoire.'
    },
    {
      id: 'f-12',
      name: 'Stéphane N’Goran',
      username: 'steph_ngoran',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300',
      commune: 'Yopougon',
      quartier: 'Niangon Sud',
      phone: '+225 05 11 22 33 44',
      ordersPlacedCount: 2,
      followedSince: 'Il y a 1 mois',
      loyaltyLevel: 'Argent',
      lastPurchaseDate: '10 Sept 2026',
      totalSpent: 47000,
      favoriteCategory: 'Tenues traditionnelles pour cérémonies',
      notes: 'Règlement toujours ponctuel par Wave.'
    }
  ], []);

  // Filter & Search logic
  const filteredFollowers = useMemo(() => {
    let result = [...mockFollowers];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.username.toLowerCase().includes(q) ||
          f.commune.toLowerCase().includes(q) ||
          (f.quartier && f.quartier.toLowerCase().includes(q)) ||
          (f.favoriteCategory && f.favoriteCategory.toLowerCase().includes(q))
      );
    }

    // Segment filter
    if (selectedFilter === 'vip') {
      result = result.filter((f) => f.isVip || (f.totalSpent && f.totalSpent >= 90000));
    } else if (selectedFilter === 'buyers') {
      result = result.filter((f) => f.ordersPlacedCount > 0);
    } else if (selectedFilter === 'recent') {
      result = result.filter((f) => f.lastPurchaseDate && (f.lastPurchaseDate.includes('Sept') || f.lastPurchaseDate.includes('Aoû')));
    } else if (selectedFilter === 'new') {
      result = result.filter((f) => f.followedSince.includes('Hier') || f.followedSince.includes('jours') || f.followedSince.includes('semaines'));
    }

    // Commune filter
    if (selectedCommune !== 'all') {
      result = result.filter((f) => f.commune.toLowerCase() === selectedCommune.toLowerCase());
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'spent_desc') {
        return (b.totalSpent || 0) - (a.totalSpent || 0);
      }
      if (sortBy === 'orders_desc') {
        return b.ordersPlacedCount - a.ordersPlacedCount;
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

    return result;
  }, [mockFollowers, searchQuery, selectedFilter, selectedCommune, sortBy]);

  // Aggregate metrics
  const totalCommunityRevenue = useMemo(() => {
    return mockFollowers.reduce((acc, f) => acc + (f.totalSpent || 0), 0);
  }, [mockFollowers]);

  const vipCount = useMemo(() => {
    return mockFollowers.filter((f) => f.isVip || (f.totalSpent && f.totalSpent >= 90000)).length;
  }, [mockFollowers]);

  const buyersCount = useMemo(() => {
    return mockFollowers.filter((f) => f.ordersPlacedCount > 0).length;
  }, [mockFollowers]);

  const handleStartChatWithFollower = (follower: FollowerItem) => {
    openChatWithParticipant({
      participantId: follower.id,
      participantName: follower.name,
      participantType: 'client',
      participantAvatar: follower.avatar,
      participantRoleSubtitle: `Client • ${follower.commune}`,
      participantVerified: true,
      initialMessage: `Bonjour ${follower.name.split(' ')[0]} ! Comment allez-vous ? Merci de faire partie des abonnés fidèles de la ${seller.name}. Avez-vous besoin d'un conseil sur nos nouveautés en boutique ?`
    });
    onShowToast(`Discussion directe ouverte avec ${follower.name} 💬`);
    setSellerActiveTab('discussions');
    onClose();
  };

  return (
    <div
      id="seller-followers-page"
      className="fixed inset-0 z-50 bg-[#0A0A0A] text-white flex flex-col overflow-hidden select-none animate-in fade-in duration-200"
    >
      {/* 1. TOP NAVIGATION HEADER */}
      <header className="sticky top-0 z-40 bg-[#0E0E0E]/95 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="p-2 -ml-1 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition active:scale-95"
            aria-label="Retour"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold text-white tracking-tight">
                Communauté & Abonnés
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-[#FF6321]/15 border border-[#FF6321]/30 text-[10px] font-black text-[#FF6321]">
                {formatMetricCount(seller.followedCount)} abonnés
              </span>
            </div>
            <p className="text-[10px] text-white/50">
              Clients abonnés à votre vitrine • Fidélisation et communication directe
            </p>
          </div>
        </div>
      </header>

      {/* 2. COMMUNITY METRICS DASHBOARD */}
      <section className="bg-[#121212] border-b border-white/5 p-4 shrink-0 z-30 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Card 1: Total & Growth */}
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-white/50 text-[10px] font-bold">
              <span>Total Abonnés</span>
              <Users className="w-3.5 h-3.5 text-[#FF6321]" />
            </div>
            <p className="text-base sm:text-lg font-black text-white">
              {formatMetricCount(seller.followedCount)}
            </p>
            <div className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>+148 ce mois (+12%)</span>
            </div>
          </div>

          {/* Card 2: Clients Acheteurs */}
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-white/50 text-[10px] font-bold">
              <span>Taux d'Achat</span>
              <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-base sm:text-lg font-black text-white">
              {Math.round((buyersCount / mockFollowers.length) * 100)}% clients
            </p>
            <div className="text-[10px] text-white/40">
              {buyersCount} abonnés ont déjà commandé
            </div>
          </div>

          {/* Card 3: CA Généré par la communauté */}
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-white/50 text-[10px] font-bold">
              <span>CA Communauté</span>
              <Award className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-base sm:text-lg font-black text-amber-400 truncate">
              {formatFCFA(totalCommunityRevenue)}
            </p>
            <div className="text-[10px] text-white/40 truncate">
              Panier moyen : ~34 500 FCFA
            </div>
          </div>

          {/* Card 4: Clients VIP & Top Commune */}
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-white/50 text-[10px] font-bold">
              <span>Clients VIP</span>
              <Star className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <p className="text-base sm:text-lg font-black text-cyan-400">
              {vipCount} fidèles VIP
            </p>
            <div className="text-[10px] text-white/40 truncate">
              📍 Cocody (38% des abonnés)
            </div>
          </div>
        </div>
      </section>

      {/* 3. SEARCH & SEGMENTATION FILTERS */}
      <section className="bg-[#121212]/70 border-b border-white/5 px-4 py-3 shrink-0 z-20 space-y-2.5">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Rechercher un abonné par nom, @pseudo, quartier, commune..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321] transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Chips & Commune Picker */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Segment Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'all', label: `Tous (${mockFollowers.length})` },
              { id: 'vip', label: `⭐ Clients VIP (${vipCount})` },
              { id: 'buyers', label: `🛒 Acheteurs (${buyersCount})` },
              { id: 'recent', label: '⚡ Acheté récemment' },
              { id: 'new', label: '🆕 Nouveaux abonnés' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  selectedFilter === tab.id
                    ? 'bg-[#FF6321] text-white shadow-md'
                    : 'bg-white/5 text-white/60 hover:text-white border border-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Commune & Sorting Selectors */}
          <div className="flex items-center gap-2 text-xs">
            {/* Commune Filter */}
            <select
              value={selectedCommune}
              onChange={(e) => setSelectedCommune(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#FF6321]"
            >
              <option value="all" className="bg-[#121212]">Toutes les communes</option>
              <option value="cocody" className="bg-[#121212]">Cocody</option>
              <option value="yopougon" className="bg-[#121212]">Yopougon</option>
              <option value="adjamé" className="bg-[#121212]">Adjamé</option>
              <option value="marcory" className="bg-[#121212]">Marcory</option>
              <option value="plateau" className="bg-[#121212]">Plateau</option>
              <option value="koumassi" className="bg-[#121212]">Koumassi</option>
              <option value="abobo" className="bg-[#121212]">Abobo</option>
              <option value="treichville" className="bg-[#121212]">Treichville</option>
            </select>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white/80 focus:outline-none focus:border-[#FF6321]"
            >
              <option value="spent_desc" className="bg-[#121212]">Total dépensé ↓</option>
              <option value="orders_desc" className="bg-[#121212]">Commandes ↓</option>
              <option value="name" className="bg-[#121212]">Nom (A-Z)</option>
            </select>
          </div>
        </div>
      </section>

      {/* 4. SCROLLABLE FOLLOWERS LIST */}
      <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3 pb-24 max-w-4xl mx-auto w-full">
        {filteredFollowers.length === 0 ? (
          <div className="p-12 text-center bg-white/[0.02] rounded-3xl border border-white/10 space-y-3">
            <Users className="w-10 h-10 text-white/20 mx-auto" />
            <h3 className="text-sm font-bold text-white">Aucun abonné correspondant</h3>
            <p className="text-xs text-white/40 max-w-xs mx-auto">
              Aucun profil ne correspond à vos filtres actuels ou à votre recherche.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedFilter('all');
                setSelectedCommune('all');
              }}
              className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/15 transition"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFollowers.map((follower) => {
              const isVip = follower.isVip || (follower.totalSpent && follower.totalSpent >= 90000);

              return (
                <div
                  key={follower.id}
                  className="p-4 rounded-2xl bg-gradient-to-r from-white/[0.03] to-white/[0.01] hover:bg-white/[0.06] border border-white/10 hover:border-[#FF6321]/40 transition group flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg"
                >
                  {/* Left info */}
                  <div
                    onClick={() => setSelectedClientForDetail(follower)}
                    className="flex items-start gap-3.5 min-w-0 cursor-pointer flex-1"
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-13 h-13 rounded-full overflow-hidden border-2 border-white/15 group-hover:border-[#FF6321] transition shadow-md bg-neutral-900">
                        <img
                          src={follower.avatar}
                          alt={follower.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      </div>
                      {isVip && (
                        <div
                          className="absolute -bottom-1 -right-1 p-1 rounded-full bg-amber-500 text-black shadow-md border-2 border-[#0A0A0A]"
                          title="Client VIP"
                        >
                          <Star className="w-2.5 h-2.5 fill-black stroke-black" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-extrabold text-white group-hover:text-[#FF6321] transition">
                          {follower.name}
                        </span>
                        <span className="text-xs text-white/40">@{follower.username}</span>

                        {isVip && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[9px] font-black text-amber-400 flex items-center gap-1">
                            <Award className="w-3 h-3" />
                            {follower.loyaltyLevel || 'VIP'}
                          </span>
                        )}

                        <span className="text-[10px] text-white/40">
                          • {follower.followedSince}
                        </span>
                      </div>

                      {/* Location & Preferred item */}
                      <div className="flex items-center gap-3 text-xs text-white/60 flex-wrap">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#FF6321]" />
                          <span>{follower.commune}</span>
                          {follower.quartier && <span className="text-white/40">({follower.quartier})</span>}
                        </span>

                        {follower.favoriteCategory && (
                          <>
                            <span className="text-white/20">•</span>
                            <span className="text-cyan-400 text-[11px]">
                              Préfère : {follower.favoriteCategory}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Commerce metrics */}
                      <div className="flex items-center gap-3 pt-1 text-[11px]">
                        <span className="font-bold text-emerald-400">
                          {follower.ordersPlacedCount} commande{follower.ordersPlacedCount > 1 ? 's' : ''} passée{follower.ordersPlacedCount > 1 ? 's' : ''}
                        </span>
                        <span className="text-white/30">•</span>
                        <span className="font-mono font-bold text-white">
                          Total : {formatFCFA(follower.totalSpent || 0)}
                        </span>
                        {follower.lastPurchaseDate && (
                          <>
                            <span className="text-white/30">•</span>
                            <span className="text-white/40">Dernier achat : {follower.lastPurchaseDate}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Action Buttons */}
                  <div className="flex items-center self-end sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5 w-full sm:w-auto justify-end">
                    {/* Chat with Follower Button */}
                    <button
                      type="button"
                      onClick={() => handleStartChatWithFollower(follower)}
                      className="px-4 py-2.5 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white text-xs font-black shadow-lg shadow-orange-600/25 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
                      title="Contacter directement le client"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Discuter</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODAL 1: MESSAGE GROUPÉ & OFFRE VIP À TOUS LES ABONNÉS                     */}
      {/* ========================================================================= */}
      {isBroadcastModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[#141414] border border-white/15 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-[#FF6321] flex items-center justify-center">
                  <Volume2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    Message Groupé à la Communauté
                  </h3>
                  <p className="text-[10px] text-white/50">
                    Sera notifié aux {formatMetricCount(seller.followedCount)} abonnés de votre boutique
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBroadcastModalOpen(false)}
                className="p-1.5 text-white/50 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendBroadcast} className="space-y-4 text-xs">
              {/* Campaign Type Pills */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-white/70 block">
                  Objet de la diffusion
                </label>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                  {[
                    '👗 Nouveautés Arrivage',
                    '⚡ Vente Flash 24H',
                    '🎁 Code Promo VIP',
                    '🎥 Direct Vidéo Démo'
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setBroadcastTitle(preset)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition whitespace-nowrap ${
                        broadcastTitle.includes(preset.split(' ')[1])
                          ? 'bg-[#FF6321] text-white'
                          : 'bg-white/5 text-white/60 hover:text-white border border-white/5'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title Input */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-white/70 block">
                  Titre de la notification
                </label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  required
                  placeholder="Ex: Arrivage Woodin & Uniwax chez Boutique Wax !"
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#FF6321]"
                />
              </div>

              {/* Message Input */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-white/70 block">
                  Message détaillé pour vos abonnés
                </label>
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  rows={4}
                  required
                  placeholder="Rédigez votre annonce..."
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#FF6321] resize-none"
                />
              </div>

              {/* Optional Coupon Code */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-white/70 block">
                    Code Promo inclus (Optionnel)
                  </label>
                  <span className="text-[10px] text-emerald-400 font-bold">-10% de réduction</span>
                </div>
                <div className="relative">
                  <Tag className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={broadcastCoupon}
                    onChange={(e) => setBroadcastCoupon(e.target.value.toUpperCase())}
                    placeholder="Ex: WAXVIP10"
                    className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-mono text-amber-400 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBroadcastModalOpen(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 text-white/70 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isBroadcasting}
                  className="flex-1 py-3 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white font-extrabold shadow-lg shadow-orange-600/30 flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isBroadcasting ? 'Envoi en cours...' : 'Diffuser aux 1.4k abonnés'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: FICHE CLIENT COMPLÈTE & HISTORIQUE                               */}
      {/* ========================================================================= */}
      {selectedClientForDetail && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full sm:max-w-md bg-[#141414] border border-white/15 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-extrabold text-white">Fiche Client & Fidélité</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClientForDetail(null)}
                className="p-1 text-white/50 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Hero */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/5">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#FF6321] shrink-0">
                <img
                  src={selectedClientForDetail.avatar}
                  alt={selectedClientForDetail.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                  <span>{selectedClientForDetail.name}</span>
                  {selectedClientForDetail.isVip && (
                    <span className="text-[10px] text-amber-400 font-bold">★ VIP</span>
                  )}
                </h4>
                <p className="text-xs text-white/50">@{selectedClientForDetail.username}</p>
                <p className="text-[11px] text-[#FF6321] flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  <span>{selectedClientForDetail.commune} ({selectedClientForDetail.quartier})</span>
                </p>
              </div>
            </div>

            {/* Detailed Stats */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                <span className="text-[10px] text-white/40 block">Total Dépensé</span>
                <span className="text-sm font-black text-emerald-400">
                  {formatFCFA(selectedClientForDetail.totalSpent || 0)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                <span className="text-[10px] text-white/40 block">Commandes passées</span>
                <span className="text-sm font-black text-white">
                  {selectedClientForDetail.ordersPlacedCount} livraisons
                </span>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                <span className="text-[10px] text-white/40 block">Ancienneté</span>
                <span className="font-bold text-white">{selectedClientForDetail.followedSince}</span>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-0.5">
                <span className="text-[10px] text-white/40 block">Statut Fidélité</span>
                <span className="font-bold text-amber-400">{selectedClientForDetail.loyaltyLevel || 'Client régulier'}</span>
              </div>
            </div>

            {/* Notes */}
            {selectedClientForDetail.notes && (
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-white/70">
                <span className="text-white/40 block font-bold mb-0.5">Note sur le client :</span>
                {selectedClientForDetail.notes}
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const client = selectedClientForDetail;
                  setSelectedClientForDetail(null);
                  setSelectedClientForPromo(client);
                }}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <Gift className="w-3.5 h-3.5 text-amber-400" />
                <span>Offrir un coupon</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const client = selectedClientForDetail;
                  setSelectedClientForDetail(null);
                  handleStartChatWithFollower(client);
                }}
                className="flex-1 py-3 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white font-black text-xs shadow-lg shadow-orange-600/30 flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Discuter</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: INTÉGRATION CODE PROMO / COUPON PRIVÉ                            */}
      {/* ========================================================================= */}
      {selectedClientForPromo && (
        <SellerClientPromoModal
          client={selectedClientForPromo}
          seller={seller}
          products={products}
          onClose={() => setSelectedClientForPromo(null)}
          onShowToast={onShowToast}
          onOpenChat={(clientName, initialMessage) => {
            setSelectedClientForPromo(null);
            openChatWithParticipant({
              participantId: selectedClientForPromo.id,
              participantName: selectedClientForPromo.name,
              participantType: 'client',
              participantAvatar: selectedClientForPromo.avatar,
              participantRoleSubtitle: `Client • ${selectedClientForPromo.commune}`,
              participantVerified: true,
              initialMessage: initialMessage || `Bonjour ${clientName} ! Voici votre bon de réduction exclusif.`
            });
            setSellerActiveTab('discussions');
            onClose();
          }}
        />
      )}
    </div>
  );
};
