import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Clock, 
  ShoppingBag, 
  Heart, 
  MessageSquare, 
  Star, 
  Store, 
  User, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Activity, 
  Ban, 
  Camera, 
  Shield, 
  Key, 
  Package, 
  Sliders, 
  Bookmark, 
  Copy, 
  Check, 
  Navigation, 
  Layers, 
  Play, 
  TrendingUp, 
  Sparkles, 
  Award, 
  Zap,
  ExternalLink,
  Flame,
  Smartphone,
  Eye,
  Handshake,
  Users,
  Maximize2,
  Minimize2,
  Crown,
  CreditCard,
  Download,
  Search,
  Filter,
  Coins,
  Send,
  HelpCircle,
  PlusCircle,
  Lock,
  ArrowRight,
  Bot,
  History,
  Edit3,
  Menu,
  LogOut,
  LayoutGrid,
  Video as VideoIcon,
  MessageCircle,
  ArrowDownLeft
} from 'lucide-react';
import { AdminUserRecord, AdminTabType, Order, Product, Seller, TryOnHistoryItem } from '../../../types';
import { useApp } from '../../../context/AppContext';
import { formatFCFA, formatMetricCount } from '../../../services/marketServices';

// Client profile tabs from the Client application
import { LikedTabContent } from '../../profile/LikedTabContent';
import { SavedTabContent } from '../../profile/SavedTabContent';
import { HistoryTabContent } from '../../profile/HistoryTabContent';
import { PurchasesTabContent, PurchasedEntry } from '../../profile/PurchasesTabContent';
import { TryOnTabContent } from '../../profile/TryOnTabContent';

// Seller profile tabs from the Seller application
import { SellerPhotosTab } from '../../seller-app/profile/SellerPhotosTab';
import { SellerVideosTab } from '../../seller-app/profile/SellerVideosTab';
import { SellerCreationsTab } from '../../seller-app/profile/SellerCreationsTab';
import { SellerSalesTab } from '../../seller-app/profile/SellerSalesTab';
import { SellerReviewsTab } from '../../seller-app/profile/SellerReviewsTab';
import {
  SellerBillingHistoryTab,
  useSellerBillingHistoryData
} from './SellerBillingHistoryTab';
import {
  ClientBillingHistoryTab,
  useClientBillingHistoryData
} from './ClientBillingHistoryTab';
import {
  SellerRevenueTab,
  SellerWithdrawalTab,
  useSellerFinanceController
} from './SellerFinanceTabs';

// The Iconic ChatGPT Emblem SVG
export const ChatGptLogo: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    aria-hidden="true"
  >
    <path d="M22.28 9.87a5.98 5.98 0 00-.51-4.88 6.05 6.05 0 00-6.51-2.9 6.07 6.07 0 00-4.64-2.09 6.07 6.07 0 00-5.77 4.19 6.04 6.04 0 00-4.06 2.94 6.03 6.03 0 00.74 7.07 5.98 5.98 0 00.51 4.88 6.05 6.05 0 006.51 2.9 6.07 6.07 0 004.64 2.09 6.07 6.07 0 005.77-4.19 6.04 6.04 0 004.06-2.94 6.03 6.03 0 00-.74-7.07zm-9.03 12.18a4.57 4.57 0 01-2.94-1.07l.14-.08 4.88-2.82a.76.76 0 00.38-.66v-6.9l2.08 1.2a.08.08 0 01.04.06v5.71a4.6 4.6 0 01-4.58 4.56zm-8.62-4.1a4.56 4.56 0 01-.58-3.09l.15.09 4.88 2.82c.24.14.38.39.38.66v2.39l-2.08-1.2a.08.08 0 01-.04-.06l-2.71-1.61zm-1.5-9.15a4.58 4.58 0 012.36-2.02v5.82a.75.75 0 00.38.65l4.88 2.82-2.08 1.2a.08.08 0 01-.07 0l-4.95-2.86a4.59 4.59 0 01-.52-5.61zm14.54 3.75l-4.88-2.82a.75.75 0 00-.76 0l-4.88 2.82-2.08-1.2a.08.08 0 010-.07l4.95-2.86a4.59 4.59 0 016.94 2.45l.71 1.68zm2.63 4.14l-.15-.09-4.88-2.82a.76.76 0 00-.38-.66v-2.39l2.08 1.2a.08.08 0 01.04.06l2.71 1.61a4.56 4.56 0 01.58 3.09zm-3.01 4.74a4.58 4.58 0 01-2.36 2.02v-5.82a.75.75 0 00-.38-.65l-4.88-2.82 2.08-1.2a.08.08 0 01.07 0l4.95 2.86a4.59 4.59 0 01.52 5.61z" />
  </svg>
);

interface AdminUserDetailModalProps {
  user: AdminUserRecord;
  onClose: () => void;
  onNavigateTab?: (tab: AdminTabType) => void;
  zIndexClass?: string;
}

export const AdminUserDetailModal: React.FC<AdminUserDetailModalProps> = ({ 
  user, 
  onClose,
  onNavigateTab,
  zIndexClass = 'z-50'
}) => {
  const { 
    verifyUserKyc, 
    toggleUserSuspension, 
    showToast, 
    addAuditLog,
    setActiveConversationId,
    products,
    sellers,
    orders,
    userProfile,
    userActivity,
    setSelectedOrder,
    setSelectedProduct,
    openVideoViewer,
    toggleLikeVideo,
    toggleSaveProduct,
    addToCart,
    tryOnHistory,
    openTryOnModal,
    removeTryOnHistoryItem,
    sellerCreations
  } = useApp();

  // Full Screen 100% space toggle: default is true to satisfy user request!
  const [isFullScreen, setIsFullScreen] = useState(true);

  // Default active tab based on user role
  const defaultSubTab = useMemo(() => {
    if (user.role === 'client') return 'liked';
    if (user.role === 'seller') return 'photos';
    return 'kyc';
  }, [user.role]);

  // Active sub-tab
  const [activeSubTab, setActiveSubTab] = useState<string>(defaultSubTab);

  // Synchronize active tab whenever user or user role changes
  useEffect(() => {
    setActiveSubTab(defaultSubTab);
  }, [defaultSubTab, user.id]);

  const [warningMessage, setWarningMessage] = useState('');
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Inspector states
  const [selectedDiscussionThread, setSelectedDiscussionThread] = useState<any | null>(null);
  const [discussionFilterRole, setDiscussionFilterRole] = useState<'all' | 'seller' | 'admin'>('all');

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard?.writeText?.(text);
    setCopiedText(text);
    showToast(`${label} copié ! 📋`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Seniorities and formatted dates
  const isNew = user.isNew || (user.registeredDaysAgo !== undefined && user.registeredDaysAgo <= 14);
  const registeredDaysText = user.registeredDaysAgo !== undefined
    ? user.registeredDaysAgo === 0 
      ? "Aujourd'hui"
      : user.registeredDaysAgo === 1
      ? "Hier"
      : user.registeredDaysAgo < 30
      ? `Il y a ${user.registeredDaysAgo} jours`
      : `Il y a ${Math.floor(user.registeredDaysAgo / 30)} mois (${user.registeredDaysAgo} jours)`
    : user.createdAt;

  // Admin Actions
  const handleApproveKyc = () => {
    verifyUserKyc(user.id);
    addAuditLog('Approbation KYC', user.name, 'user', `Dossier légal validé pour l'utilisateur ${user.name} (${user.role}).`);
    showToast(`Dossier KYC approuvé avec succès pour ${user.name} 🟢`);
  };

  const handleToggleSuspension = () => {
    toggleUserSuspension(user.id);
    const action = user.status === 'suspended' ? 'Réactivation de compte' : 'Suspension de compte';
    addAuditLog(action, user.name, 'security', `Statut modifié pour ${user.name}.`);
    showToast(user.status === 'suspended' ? `Compte de ${user.name} réactivé ✓` : `Compte de ${user.name} suspendu ⚠️`);
  };

  const handleSendOfficialNotice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!warningMessage.trim()) return;
    addAuditLog('Avertissement Officiel', user.name, 'user', `Message : "${warningMessage}"`);
    showToast(`Notification officielle envoyée par SMS / App à ${user.name} 📲`);
    setWarningMessage('');
    setShowWarningModal(false);
  };

  const handleOpenDirectChat = () => {
    setActiveConversationId(`aconv-${user.role}-${user.id}`);
    onClose();
    onNavigateTab?.('discussions');
    showToast(`Ouverture de la messagerie avec ${user.name} 💬`);
  };

  // =========================================================================
  // CLIENT APP DATA COLLECTIONS (IDENTIQUE À ProfileScreen.tsx)
  // =========================================================================

  const likedProducts = useMemo(() => {
    const fromProfile = products.filter((p) => userProfile.likedVideoIds?.includes(p.id));
    if (fromProfile.length > 0) return fromProfile;
    return products.slice(0, 4);
  }, [products, userProfile.likedVideoIds]);

  const savedProducts = useMemo(() => {
    const fromProfile = products.filter((p) => userProfile.savedItemIds?.includes(p.id));
    if (fromProfile.length > 0) return fromProfile;
    return products.slice(2, 6);
  }, [products, userProfile.savedItemIds]);

  const purchasedEntries = useMemo<PurchasedEntry[]>(() => {
    const entries: PurchasedEntry[] = [];
    orders.forEach((order) => {
      order.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        if (prod) {
          entries.push({ order, item, product: prod });
        }
      });
    });
    return entries;
  }, [orders, products]);

  const deliveredOrders = useMemo(() => {
    return orders.filter((o) => o.status === 'delivered');
  }, [orders]);

  const inProgressPurchasedEntries = useMemo(() => {
    return purchasedEntries.filter((e) => e.order.status !== 'delivered');
  }, [purchasedEntries]);

  // Fallback try-on history
  const clientTryOnHistory = useMemo<TryOnHistoryItem[]>(() => {
    if (tryOnHistory && tryOnHistory.length > 0) return tryOnHistory;
    return [
      {
        id: 'try-sample-1',
        productId: products[0]?.id || 'prod-1',
        productName: 'Robe Brodée Wax Baoulé Haute Couture',
        productPrice: 28500,
        productOriginalPrice: 35000,
        productImage: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400',
        sellerName: 'Boutique Wax Chic',
        generatedImageUrl: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400',
        modelName: 'Awa - Mannequin Studio',
        size: 'M',
        color: 'Orange Royal',
        angle: 'front',
        createdAt: '26/11/2026 à 14:10'
      },
      {
        id: 'try-sample-2',
        productId: products[1]?.id || 'prod-2',
        productName: 'Pagne Woodin Original 2026',
        productPrice: 45000,
        productImage: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400',
        sellerName: 'Ivoire Créations Plateau',
        generatedImageUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400',
        modelName: 'Fatou - 3D Avatar',
        size: 'L',
        color: 'Doré Ivoire',
        angle: 'side',
        createdAt: '25/11/2026 à 11:20'
      }
    ];
  }, [tryOnHistory, products]);

  // =========================================================================
  // SELLER, DRIVER & COMPANY PROFILE DATASETS
  // =========================================================================

  // Reconstruct or match official Seller object
  const sellerObj = useMemo<Seller>(() => {
    const existing = sellers.find(
      (s) =>
        s.id === user.id ||
        s.name.toLowerCase() === user.name.toLowerCase() ||
        (user.storeName && s.name.toLowerCase() === user.storeName.toLowerCase()) ||
        (user.username && s.username.toLowerCase() === user.username.toLowerCase())
    );
    if (existing) {
      return {
        ...existing,
        name: user.storeName || existing.name,
        avatar: user.avatar || existing.avatar,
        banner: user.banner || existing.banner || 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200&auto=format&fit=crop&q=80',
        verified: user.kycVerified ?? existing.verified,
      };
    }
    return {
      id: user.id,
      name: user.storeName || user.name || 'Boutique Wax & Chic',
      username: (user.username || user.name || 'boutique').toLowerCase().replace(/\s+/g, '_').replace(/^@/, ''),
      avatar: user.avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
      banner: user.banner || 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200&auto=format&fit=crop&q=80',
      bio: user.bio || 'Boutique certifiée DJASSA. Spécialiste de la mode africaine, wax hollandais, confections sur mesure et maroquinerie haut de gamme à Abidjan.',
      location: user.location || 'Cocody, Abidjan',
      phone: user.phone || '+225 07 89 45 12',
      verified: Boolean(user.kycVerified),
      rating: 4.9,
      reviewsCount: 142,
      followedCount: 1840,
      salesCount: user.ordersCount || 342,
      badges: ['Certifié DJASSA', 'Vendeur Pro', 'Top Ventes'],
      partnerDriverIds: [],
    };
  }, [sellers, user]);

  const sellerProductsList = useMemo<Product[]>(() => {
    const matched = products.filter((p) => p.sellerId === sellerObj.id);
    if (matched.length > 0) return matched;
    return products.slice(0, 8).map((p) => ({
      ...p,
      sellerId: sellerObj.id,
    }));
  }, [products, sellerObj]);

  const sellerPhotos = useMemo<Product[]>(() => {
    const p = sellerProductsList.filter(
      (item) => (item.images && item.images.length > 0) || (item.contentType === 'publication' && item.mediaType !== 'video')
    );
    return p.length > 0 ? p : sellerProductsList;
  }, [sellerProductsList]);

  const sellerVideosList = useMemo<Product[]>(() => {
    const vids = sellerProductsList.filter((p) => p.mediaType === 'video' && p.videoUrl);
    if (vids.length > 0) return vids;
    return products.filter((p) => p.mediaType === 'video' && p.videoUrl).slice(0, 6);
  }, [sellerProductsList, products]);

  const iaCreations = useMemo(() => {
    return (sellerCreations || []).filter(
      (c) =>
        (!c.sellerId || c.sellerId === sellerObj.id) &&
        (c.isAiGenerated ||
          c.type === 'ai_video' ||
          c.type === 'ai_photo' ||
          (!c.productId && (c.type === 'video' || c.type === 'photo' || (c as { type: string }).type === 'image')))
    );
  }, [sellerCreations, sellerObj.id]);

  const {
    subscriptions: sellerPaidSubscriptions,
    paidAds: sellerPaidAds
  } = useSellerBillingHistoryData(user, sellerObj, sellerProductsList);

  const sellerFinance = useSellerFinanceController(user, sellerObj, sellerProductsList, orders);
  const clientPaidSubscriptions = useClientBillingHistoryData(user);

  // =========================================================================
  // USER-EXCLUSIVE ADMIN AUDIT TABS: DISCUSSIONS, CHATGPT & ABONNEMENTS
  // =========================================================================

  const userDiscussionsList = useMemo(() => [
    {
      id: 'disc-1',
      participantName: 'Boutique Wax Baoulé Chic',
      participantRole: 'seller',
      participantAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120',
      lastMessage: 'Bonjour ! Votre commande DJA-8891 est confirmée et la boutique prépare votre expédition.',
      date: 'Hier à 15:42',
      unreadCount: 0,
      messages: [
        { sender: 'user', text: 'Bonjour, la robe en taille L est-elle bien disponible ?', time: '14:20' },
        { sender: 'other', text: 'Oui tout à fait madame ! Nous avons le tissu Baoulé en stock.', time: '14:25' },
        { sender: 'user', text: 'Parfait, je valide ma commande par Wave.', time: '14:30' },
        { sender: 'other', text: 'Bonjour ! Votre commande DJA-8891 est confirmée et la boutique prépare votre expédition.', time: '15:42' }
      ]
    },
    {
      id: 'disc-3',
      participantName: 'Support Officiel Djassa Marketplace',
      participantRole: 'admin',
      participantAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120',
      lastMessage: 'Votre reçu d’abonnement VIP Club a été généré avec succès.',
      date: '10/11/2026 à 10:15',
      unreadCount: 0,
      messages: [
        { sender: 'user', text: 'Bonjour le support, je voulais confirmer mon reçu de paiement VIP.', time: '09:40' },
        { sender: 'other', text: 'Bonjour ! Votre reçu d’abonnement VIP Club a été généré avec succès.', time: '10:15' }
      ]
    }
  ], []);

  const chatGptSessions = useMemo(() => [
    {
      id: 'cg-1',
      title: 'Recherche & Conseil Robe Wax Baoulé Haute Couture',
      topic: 'Mode & Shopping IA',
      date: '26/11/2026 à 14:15',
      tokensUsed: 1450,
      costFCFA: 0.28,
      model: 'MiniMax H3 Max Turbo (RodiumAI)',
      messages: [
        { sender: 'user', text: 'Peux-tu me recommander les meilleures boutiques à Abidjan pour une robe traditionnelle Bazin chic pour un mariage ?' },
        { sender: 'assistant', text: 'Absolument ! Pour un mariage traditionnel ivoirien avec du Bazin de qualité supérieure, voici les boutiques recommandées sur Djassa :\n\n1. **Boutique Wax Baoulé Chic** (Adjamé) — Confection sur-mesure et broderie fil d\'or.\n2. **Ivoire Créations** (Plateau) — Tissus riches et ensembles de cérémonie Bété & Baoulé.\n3. **Haute Couture Cocody** — Modèles modernes avec coupe cintrée.\n\nSouhaitez-vous que je vérifie les modèles en stock avec livraison express aujourd’hui ?' }
      ]
    },
    {
      id: 'cg-2',
      title: 'Génération de fiche produit optimisée & SEO local',
      topic: 'Création Contenu & Vente',
      date: '25/11/2026 à 11:30',
      tokensUsed: 2280,
      costFCFA: 0.44,
      model: 'MiniMax H3 Max Turbo (RodiumAI)',
      messages: [
        { sender: 'user', text: 'Rédige une description percutante pour notre Pagne Woodin Original Collection 2026.' },
        { sender: 'assistant', text: 'Voici votre description commerciale optimisée :\n\n✨ **Pagne Woodin Original 2026 — L’Élégance Africaine Réinventée** ✨\n\nAdoptez l\'authenticité et le prestige avec ce tissu Woodin 100% coton de qualité supérieure. Motifs vibrants, tenue parfaite au lavage et douceur incomparable au toucher.\n\n• **Matière** : 100% Coton Supérieur certifié\n• **Usage** : Robes de soirée, tailleurs, chemises et tenues de cérémonie\n• **Origine** : Garanti authentique Abidjan\n\n📦 *Expédition organisée directement par la boutique sur DJASSA (0 FCFA frais de livraison plateforme).*' }
      ]
    }
  ], []);

  const userSubscriptions = useMemo(() => [
    {
      id: 'sub-1',
      name: 'Djassa Club VIP — Acheteur Privilège',
      category: 'Abonnement Membre',
      priceFCFA: 1500,
      period: 'Mensuel (Renouvellement automatique)',
      startDate: '15/10/2026',
      endDate: '15/11/2026',
      status: 'active',
      paymentMethod: 'Wave Mobile Money',
      reference: 'WAV-SUB-9082',
      features: [
        'Frais de livraison DJASSA : 0 FCFA',
        'Accès prioritaire aux ventes privées exclusives',
        'Badge VIP or visible sur le profil',
        'Support client prioritaire 7j/7'
      ]
    },
    {
      id: 'sub-2',
      name: 'Badge Vérifié & Accrédité Djassa Pro',
      category: 'Certification Officielle',
      priceFCFA: 5000,
      period: 'Annuel',
      startDate: '10/01/2026',
      endDate: '10/01/2027',
      status: 'active',
      paymentMethod: 'Orange Money Pro',
      reference: 'OM-KYC-7714',
      features: [
        'Badge officiel vert de confiance KYC certifié',
        'Garantie acheteur jusqu’à 500 000 FCFA',
        'Mise en avant sur le moteur de recherche d’Abidjan'
      ]
    },
    {
      id: 'sub-3',
      name: 'Pack Booster Visibilité Produits — 30 Jours',
      category: 'Publicité & Vente',
      priceFCFA: 10000,
      period: 'Ponctuel (30 jours)',
      startDate: '20/10/2026',
      endDate: '20/11/2026',
      status: 'active',
      paymentMethod: 'Wave Mobile Money',
      reference: 'BST-PROMO-3310',
      features: [
        '5 000 impressions garanties sur le feed Découverte',
        'Affichage en tête des résultats de recherche',
        'Diffusion automatique en push aux clients de la commune'
      ]
    }
  ], []);

  // Filtered discussions
  const filteredDiscussions = useMemo(() => {
    return userDiscussionsList.filter(d => {
      if (discussionFilterRole === 'all') return true;
      return d.participantRole === discussionFilterRole;
    });
  }, [userDiscussionsList, discussionFilterRole]);

  // =========================================================================
  // MAIN RENDER (100% IDENTIQUE À ProfileScreen.tsx POUR LE CLIENT)
  // =========================================================================

  return (
    <div
      id="admin-user-detail-overlay"
      className={`fixed inset-0 ${zIndexClass} bg-black/95 backdrop-blur-md flex items-center justify-center transition-all duration-200 ${
        isFullScreen ? 'p-0 w-full h-full' : 'p-2 sm:p-4'
      }`}
      onClick={onClose}
    >
      <div
        id="admin-user-detail-modal"
        className={`bg-[#0A0A0A] text-white flex flex-col shadow-2xl overflow-hidden select-none transition-all duration-200 ${
          isFullScreen 
            ? 'w-full h-full rounded-none border-0' 
            : 'w-full max-w-6xl max-h-[96vh] rounded-3xl border border-white/15'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* =========================================================================
            TOP BAR IDENTIQUE À ProfileScreen.tsx AVEC RETOUR, TITRE ET CONTRÔLE 100%
            ========================================================================= */}
        <div className="sticky top-0 z-30 bg-[#0A0A0A]/90 backdrop-blur-xl px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition cursor-pointer flex items-center gap-1"
              aria-label="Retour"
              title="Fermer le profil"
            >
              <span className="text-lg leading-none font-bold">←</span>
            </button>
            <span className="text-sm font-bold text-white">Profil</span>
            <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-mono font-bold">
              Vue Super-Admin (100% Espace)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle 100% de l'espace / Plein écran */}
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer border border-white/15"
              title={isFullScreen ? "Réduire en fenêtre" : "Utiliser 100% de l'espace (Plein écran)"}
            >
              {isFullScreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Réduire</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">100% de l'espace</span>
                </>
              )}
            </button>

            {/* Direct Discussion button in header */}
            <button
              type="button"
              onClick={handleOpenDirectChat}
              className="p-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition active:scale-95 cursor-pointer"
              title="Envoyer un message officiel"
            >
              <MessageSquare className="w-4 h-4" />
            </button>

            {/* Close button */}
            <button
              id="btn-close-user-detail"
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition active:scale-95 cursor-pointer"
              title="Fermer"
            >
              <X className="w-4 h-4 stroke-[2.2]" />
            </button>
          </div>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col bg-[#0A0A0A]">

          {/* =========================================================================
              1. USER PROFILE HEADER (IDENTIQUE À 100% À ProfileScreen.tsx POUR LE CLIENT)
              ========================================================================= */}
          {user.role === 'client' && (
            <div className="p-4 flex flex-col items-center text-center space-y-3 shrink-0 bg-[#0A0A0A]">
              {/* Avatar */}
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#FF6321] shadow-xl shadow-orange-600/20">
                  <img
                    src={user.avatar || userProfile.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200'}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#FF6321] text-white shadow border-2 border-neutral-950 cursor-default"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
                {user.kycVerified && (
                  <span className="absolute top-0 right-0 p-1 rounded-full bg-emerald-500 text-black border-2 border-black" title="Identité KYC vérifiée">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                )}
              </div>

              {/* Identity */}
              <div>
                <h2 className="text-base font-bold text-white flex items-center justify-center gap-1.5">
                  <span>{user.name}</span>
                  {user.kycVerified && <ShieldCheck className="w-4 h-4 text-[#FF6321]" />}
                </h2>
                <p className="text-xs text-[#FF6321] font-medium mt-0.5">
                  @{user.username || user.name.toLowerCase().replace(/\s+/g, '_')}
                </p>
              </div>

              {/* Bio */}
              <p className="text-xs text-white/70 max-w-xs leading-relaxed">
                {user.bio || userProfile.bio || "Client membre régulier de la marketplace Djassa. Commandes confirmées et paiement sécurisé Wave, Orange Money ou à la livraison."}
              </p>

              <div className="flex items-center gap-1 text-[11px] text-white/50">
                <MapPin className="w-3.5 h-3.5 text-[#FF6321]" />
                <span>{user.deliveryCommune || user.location || userProfile.deliveryCommune || 'Cocody'}, Abidjan</span>
              </div>

              {/* STATS ROW (STRICT RULE: CLIENT -> SELLER ONLY. NO CLIENT FOLLOWERS) */}
              <div className="flex items-center justify-center gap-7 pt-1">
                {/* 👥 Vendeurs suivis */}
                <div className="flex flex-col items-center">
                  <span className="text-sm font-extrabold text-white">
                    {formatMetricCount(user.followedSellerIds?.length || userProfile.followedSellerIds?.length || 14)}
                  </span>
                  <span className="text-[11px] text-white/50 font-medium mt-0.5">
                    👥 Vendeurs suivis
                  </span>
                </div>

                <div className="w-px h-6 bg-white/10" />

                {/* ❤️ J'aime */}
                <div className="flex flex-col items-center">
                  <span className="text-sm font-extrabold text-white">
                    {formatMetricCount(likedProducts.length)}
                  </span>
                  <span className="text-[11px] text-white/50 font-medium mt-0.5">
                    ❤️ J'aime
                  </span>
                </div>

                <div className="w-px h-6 bg-white/10" />

                {/* 🛍️ Achats effectués */}
                <div className="flex flex-col items-center">
                  <span className="text-sm font-extrabold text-white">
                    {formatMetricCount(purchasedEntries.length || deliveredOrders.length || user.ordersCount || 3)}
                  </span>
                  <span className="text-[11px] text-white/50 font-medium mt-0.5">
                    🛍️ Achats effectués
                  </span>
                </div>
              </div>

              {/* Action Buttons like ProfileScreen */}
              <div className="flex items-center gap-2 pt-1">
                <span className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-semibold text-white/70">
                  📊 Activité : ~{user.dailyAverageMinutes || 45} min/j
                </span>
                {user.phone && (
                  <button
                    type="button"
                    onClick={() => handleCopy(user.phone, 'Téléphone')}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-semibold text-white/70 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Phone className="w-3 h-3 text-cyan-400" />
                    <span>{user.phone}</span>
                    {copiedText === user.phone && <Check className="w-2.5 h-2.5 text-emerald-400" />}
                  </button>
                )}
              </div>

              <div className="mt-1 py-2 px-6 rounded-xl bg-white/5 text-white/90 border border-white/10 text-xs font-bold flex items-center gap-2 backdrop-blur-md">
                <Edit3 className="w-3.5 h-3.5 text-[#FF6321]" />
                <span>Statut : {user.status === 'suspended' ? 'Compte Suspendu' : 'Client Actif'}</span>
              </div>
            </div>
          )}

          {/* =========================================================================
              2. USER PROFILE HEADER (IDENTIQUE À 100% À SellerProfileScreen.tsx POUR LE VENDEUR)
              ========================================================================= */}
          {user.role === 'seller' && (
            <div className="flex flex-col shrink-0 bg-[#0A0A0A]">
              {/* Boutique Banner */}
              <div className="relative w-full h-44 sm:h-52 bg-neutral-900 overflow-hidden shrink-0">
                <img
                  src={sellerObj.banner || 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200&auto=format&fit=crop&q=80'}
                  alt={`Bannière de ${sellerObj.name}`}
                  className="w-full h-full object-cover"
                />
                {/* Gradients */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-black/25 to-black/40 pointer-events-none" />

                {/* Menu / Settings Button flottant */}
                <button
                  type="button"
                  onClick={() => setActiveSubTab('actions_admin')}
                  className="absolute top-3 right-3 p-2 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white/90 hover:text-white transition active:scale-95 flex items-center justify-center shadow-lg z-20 cursor-pointer"
                  title="Paramètres et administration"
                  aria-label="Paramètres et administration"
                >
                  <Menu className="w-5 h-5" />
                </button>

                {/* Change Banner Button */}
                <button
                  type="button"
                  onClick={() => showToast('Bannière de la boutique certifiée DJASSA')}
                  className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-black/65 hover:bg-black/85 backdrop-blur-md border border-white/20 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-lg active:scale-95 transition z-10 cursor-pointer"
                  title="Bannière de la boutique"
                >
                  <Camera className="w-3.5 h-3.5 text-[#FF6321]" />
                  <span>Bannière</span>
                </button>
              </div>

              {/* User Profile Header (Overlapping Banner) */}
              <div className="px-4 pb-4 -mt-12 flex flex-col items-center text-center space-y-3 relative z-10">
                {/* Avatar with orange ring */}
                <div className="relative">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#0A0A0A] ring-2 ring-[#FF6321] shadow-2xl shadow-orange-600/30 bg-neutral-900">
                    <img
                      src={sellerObj.avatar}
                      alt={sellerObj.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#FF6321] text-white shadow-lg border-2 border-[#0A0A0A]">
                    <Camera className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Identity */}
                <div>
                  <div className="flex items-center justify-center gap-1.5">
                    <h2 className="text-base font-bold text-white">{sellerObj.name}</h2>
                    {sellerObj.verified && <ShieldCheck className="w-4 h-4 text-[#FF6321]" />}
                  </div>
                  <p className="text-xs text-[#FF6321] font-medium mt-0.5">@{sellerObj.username}</p>
                </div>

                {/* Bio */}
                <p className="text-xs text-white/70 max-w-md leading-relaxed">
                  {sellerObj.bio || 'Bienvenue sur la boutique officielle DJASSA ! Découvrez nos collections exclusives.'}
                </p>

                {/* Location & Contact */}
                <div className="flex items-center justify-center gap-3 text-[11px] text-white/50">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#FF6321]" />
                    <span>{sellerObj.location}</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-white/30" />
                  <div className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-white/40" />
                    <span>{sellerObj.phone || '+225 07 00 00 00'}</span>
                  </div>
                </div>

                {/* STATS ROW (4 stats matching SellerProfileScreen exactly) */}
                <div className="flex items-center justify-center gap-3 sm:gap-5 pt-1 w-full max-w-sm">
                  {/* Abonnés */}
                  <button
                    type="button"
                    onClick={() => showToast(`${formatMetricCount(sellerObj.followedCount)} clients sont abonnés à la boutique 👥`)}
                    className="flex flex-col items-center flex-1 p-2 rounded-2xl hover:bg-white/10 active:scale-95 transition cursor-pointer group"
                    title="Voir les abonnés de la boutique"
                  >
                    <span className="text-sm font-extrabold text-white group-hover:text-[#FF6321] transition">
                      {formatMetricCount(sellerObj.followedCount)}
                    </span>
                    <span className="text-[11px] text-white/50 group-hover:text-white/80 font-medium mt-0.5 transition">
                      👥 Abonnés
                    </span>
                  </button>

                  <div className="w-px h-6 bg-white/10 shrink-0" />

                  {/* Achats / Ventes */}
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('achats')}
                    className="flex flex-col items-center flex-1 p-2 rounded-2xl hover:bg-white/10 active:scale-95 transition cursor-pointer group"
                    title="Voir les achats et ventes de la boutique"
                  >
                    <span className="text-sm font-extrabold text-white group-hover:text-[#FF6321] transition">
                      {formatMetricCount(sellerObj.salesCount)}
                    </span>
                    <span className="text-[11px] text-white/50 group-hover:text-white/80 font-medium mt-0.5 transition">
                      🛍️ Achats
                    </span>
                  </button>

                  <div className="w-px h-6 bg-white/10 shrink-0" />

                  {/* Produits */}
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('photos')}
                    className="flex flex-col items-center flex-1 p-2 rounded-2xl hover:bg-white/10 active:scale-95 transition cursor-pointer group"
                    title="Voir les produits du catalogue"
                  >
                    <span className="text-sm font-extrabold text-white group-hover:text-[#FF6321] transition">
                      {formatMetricCount(sellerProductsList.length)}
                    </span>
                    <span className="text-[11px] text-white/50 group-hover:text-white/80 font-medium mt-0.5 transition">
                      📦 Produits
                    </span>
                  </button>

                  <div className="w-px h-6 bg-white/10 shrink-0" />

                  {/* Avis */}
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('avis')}
                    className="flex flex-col items-center flex-1 p-2 rounded-2xl hover:bg-white/10 active:scale-95 transition cursor-pointer group"
                    title="Consulter les avis clients"
                  >
                    <span className="text-sm font-extrabold text-amber-400 group-hover:scale-105 transition">
                      {sellerObj.rating} ★
                    </span>
                    <span className="text-[11px] text-white/50 group-hover:text-white/80 font-medium mt-0.5 transition">
                      ⭐ Avis
                    </span>
                  </button>
                </div>

                {/* Primary Action Buttons: Modifier le profil + Assistant IA Vendeur */}
                <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => showToast('Dossier marchand vérifié par l’administration DJASSA')}
                    className="py-2 px-5 rounded-xl bg-white/5 hover:bg-white/10 text-white/90 border border-white/10 text-xs font-bold flex items-center gap-1.5 transition backdrop-blur-md active:scale-95 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#FF6321]" />
                    <span>Modifier le profil</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSubTab('chatgpt')}
                    className="py-2 px-4 rounded-xl bg-[#212121] hover:bg-[#282828] text-white border border-[#10A37F]/50 hover:border-[#10A37F] text-xs font-bold flex items-center gap-2 transition backdrop-blur-md active:scale-95 shadow-md shadow-[#10A37F]/15 cursor-pointer group"
                    title="Ouvrir Assistant IA Vendeur"
                  >
                    <div className="w-4.5 h-4.5 rounded-full bg-white text-black flex items-center justify-center p-0.5 shadow">
                      <ChatGptLogo className="w-3 h-3" />
                    </div>
                    <span>Assistant IA</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#10A37F]/25 text-emerald-300 font-extrabold border border-[#10A37F]/40">
                      Vendeur
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              2. CONTENT TABS BAR (IDENTIQUE À ProfileScreen.tsx + ONGLETS ADMIN EXCLUSIFS)
              ========================================================================= */}
          <div 
            id="admin-user-tabs-bar"
            className="w-full shrink-0 min-h-[50px] border-t border-b border-white/10 flex items-center bg-[#0A0A0A] backdrop-blur-xl text-xs font-bold overflow-x-auto no-scrollbar sticky top-0 z-30 px-2 shadow-sm"
          >
            {/* ONGLETS HABITUELS CLIENT */}
            {user.role === 'client' && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('liked')}
                  className={`min-w-[85px] h-[46px] px-3.5 flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer ${
                    activeSubTab === 'liked'
                      ? 'text-[#FF6321] border-b-2 border-[#FF6321] bg-white/[0.04]'
                      : 'text-white/70 hover:text-white hover:bg-white/[0.03] border-b-2 border-transparent'
                  }`}
                  title="Vidéos et produits aimés"
                >
                  <Heart className={`w-3.5 h-3.5 ${activeSubTab === 'liked' ? 'fill-[#FF6321]' : ''}`} />
                  <span>J'aime ({formatMetricCount(likedProducts.length)})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('saved')}
                  className={`min-w-[95px] h-[46px] px-3.5 flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer ${
                    activeSubTab === 'saved'
                      ? 'text-[#FF6321] border-b-2 border-[#FF6321] bg-white/[0.04]'
                      : 'text-white/70 hover:text-white hover:bg-white/[0.03] border-b-2 border-transparent'
                  }`}
                  title="Produits enregistrés"
                >
                  <Bookmark className={`w-3.5 h-3.5 ${activeSubTab === 'saved' ? 'fill-[#FF6321]' : ''}`} />
                  <span>Enregistrés ({formatMetricCount(savedProducts.length)})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('history')}
                  className={`min-w-[90px] h-[46px] px-3.5 flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer ${
                    activeSubTab === 'history'
                      ? 'text-[#FF6321] border-b-2 border-[#FF6321] bg-white/[0.04]'
                      : 'text-white/70 hover:text-white hover:bg-white/[0.03] border-b-2 border-transparent'
                  }`}
                  title="Historique de tous les colis livrés"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Historique ({formatMetricCount(deliveredOrders.length)})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('purchases')}
                  className={`min-w-[85px] h-[46px] px-3.5 flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer ${
                    activeSubTab === 'purchases'
                      ? 'text-[#FF6321] border-b-2 border-[#FF6321] bg-white/[0.04]'
                      : 'text-white/70 hover:text-white hover:bg-white/[0.03] border-b-2 border-transparent'
                  }`}
                  title="Commandes en cours et achats"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Achats ({formatMetricCount(inProgressPurchasedEntries.length || purchasedEntries.length)})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('tryon')}
                  className={`min-w-[95px] h-[46px] px-3.5 flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer ${
                    activeSubTab === 'tryon'
                      ? 'text-[#FF6321] border-b-2 border-[#FF6321] bg-white/[0.04]'
                      : 'text-white/70 hover:text-white hover:bg-white/[0.03] border-b-2 border-transparent'
                  }`}
                  title="Photos d'essayages virtuels générées par IA"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${activeSubTab === 'tryon' ? 'text-[#FF6321]' : ''}`} />
                  <span>Essayages ({formatMetricCount(clientTryOnHistory.length)})</span>
                </button>
              </>
            )}

            {/* ONGLETS HABITUELS VENDEUR (EXACTEMENT COMME SellerProfileScreen.tsx) */}
            {user.role === 'seller' && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('photos')}
                  className={`min-w-[85px] h-[46px] px-3.5 flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer ${
                    activeSubTab === 'photos'
                      ? 'text-[#FF6321] border-b-2 border-[#FF6321] bg-white/[0.04]'
                      : 'text-white/70 hover:text-white hover:bg-white/[0.03] border-b-2 border-transparent'
                  }`}
                  title="Publications photos"
                >
                  <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                  <span>Photos ({sellerPhotos.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('videos')}
                  className={`min-w-[85px] h-[46px] px-3.5 flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer ${
                    activeSubTab === 'videos'
                      ? 'text-[#FF6321] border-b-2 border-[#FF6321] bg-white/[0.04]'
                      : 'text-white/70 hover:text-white hover:bg-white/[0.03] border-b-2 border-transparent'
                  }`}
                  title="Vidéos publiées"
                >
                  <VideoIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>Vidéos ({sellerVideosList.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('creations')}
                  className={`min-w-[130px] h-[46px] px-3.5 flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer ${
                    activeSubTab === 'creations'
                      ? 'text-[#FF6321] border-b-2 border-[#FF6321] bg-white/[0.04]'
                      : 'text-white/70 hover:text-white hover:bg-white/[0.03] border-b-2 border-transparent'
                  }`}
                  title="Toutes les créations photos, vidéos et clips IA"
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span>Mes créations ({iaCreations.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('achats')}
                  className={`min-w-[90px] h-[46px] px-3.5 flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer ${
                    activeSubTab === 'achats'
                      ? 'text-[#FF6321] border-b-2 border-[#FF6321] bg-white/[0.04]'
                      : 'text-white/70 hover:text-white hover:bg-white/[0.03] border-b-2 border-transparent'
                  }`}
                  title="Classement des articles les plus achetés et popularité"
                >
                  <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
                  <span>Achats ({formatMetricCount(sellerObj.salesCount)})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('avis')}
                  className={`min-w-[80px] h-[46px] px-3.5 flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer ${
                    activeSubTab === 'avis'
                      ? 'text-[#FF6321] border-b-2 border-[#FF6321] bg-white/[0.04]'
                      : 'text-white/70 hover:text-white hover:bg-white/[0.03] border-b-2 border-transparent'
                  }`}
                  title="Avis et commentaires clients"
                >
                  <Star className="w-3.5 h-3.5 shrink-0" />
                  <span>Avis ({sellerObj.reviewsCount})</span>
                </button>
              </>
            )}

            <div className="w-px h-6 bg-white/20 shrink-0 self-center mx-1.5" />

            {/* =========================================================================
                SUPER ADMIN EXCLUSIVE TABS: DISCUSSIONS, CHATGPT, ABONNEMENTS, KYC, ACTIONS
                ========================================================================= */}
            <button
              type="button"
              onClick={() => setActiveSubTab('discussions')}
              className={`min-w-[130px] h-[46px] px-3.5 flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer ${
                activeSubTab === 'discussions'
                  ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/15 font-bold'
                  : 'text-purple-300/80 hover:text-purple-200 hover:bg-white/[0.03] border-b-2 border-transparent'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>💬 Discussions ({userDiscussionsList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('chatgpt')}
              className={`min-w-[140px] h-[46px] px-3.5 flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer ${
                activeSubTab === 'chatgpt'
                  ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/15 font-bold'
                  : 'text-emerald-300/80 hover:text-emerald-200 hover:bg-white/[0.03] border-b-2 border-transparent'
              }`}
            >
              <ChatGptLogo className="w-3.5 h-3.5" />
              <span>🤖 Assistant IA RodiumAI ({chatGptSessions.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('abonnements')}
              className={`min-w-[140px] h-[46px] px-3.5 flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer ${
                activeSubTab === 'abonnements'
                  ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-500/15 font-bold'
                  : 'text-amber-300/80 hover:text-amber-200 hover:bg-white/[0.03] border-b-2 border-transparent'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>
                {user.role === 'seller'
                  ? `👑 Abonnements & Pubs (${sellerPaidSubscriptions.length + sellerPaidAds.length})`
                  : user.role === 'client'
                  ? `👑 Abonnements (${clientPaidSubscriptions.length})`
                  : `👑 Abonnements (${userSubscriptions.length})`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('kyc')}
              className={`min-w-[105px] h-[46px] px-3.5 flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer ${
                activeSubTab === 'kyc'
                  ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/15 font-bold'
                  : 'text-cyan-300/80 hover:text-cyan-200 hover:bg-white/[0.03] border-b-2 border-transparent'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>🪪 Dossier KYC</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('actions_admin')}
              className={`min-w-[110px] h-[46px] px-3.5 flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer ${
                activeSubTab === 'actions_admin' || activeSubTab === 'actions'
                  ? 'text-rose-400 border-b-2 border-rose-400 bg-rose-500/15 font-bold'
                  : 'text-rose-300/80 hover:text-rose-200 hover:bg-white/[0.03] border-b-2 border-transparent'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>⚡ Actions Admin</span>
            </button>

            {user.role === 'seller' && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('revenus')}
                  className={`min-w-[125px] h-[46px] px-3.5 flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer ${
                    activeSubTab === 'revenus'
                      ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/15 font-bold'
                      : 'text-emerald-300/80 hover:text-emerald-200 hover:bg-white/[0.03] border-b-2 border-transparent'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>💰 Revenus ({sellerFinance.revenueEntries.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('retraits')}
                  className={`min-w-[125px] h-[46px] px-3.5 flex items-center justify-center gap-1.5 transition shrink-0 cursor-pointer ${
                    activeSubTab === 'retraits'
                      ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/15 font-bold'
                      : 'text-cyan-300/80 hover:text-cyan-200 hover:bg-white/[0.03] border-b-2 border-transparent'
                  }`}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>💸 Retraits ({sellerFinance.withdrawals.length})</span>
                </button>
              </>
            )}
          </div>

          {/* =========================================================================
              3. TAB CONTENTS (100% ESPACE + VRAIS COMPOSANTS DE L'APPLICATION CLIENT)
              ========================================================================= */}
          <div className="p-3 sm:p-5 flex-1">

            {/* TAB: J'AIME (UTILISE LikedTabContent DU CLIENT APP) */}
            {user.role === 'client' && activeSubTab === 'liked' && (
              <LikedTabContent
                likedProducts={likedProducts}
                sellers={sellers}
                onOpenVideoViewer={openVideoViewer}
                onSelectProduct={setSelectedProduct}
                onToggleLike={toggleLikeVideo}
                onAddToCart={(productId) => addToCart(productId, {}, 1)}
                onNavigateFeed={() => {}}
              />
            )}

            {/* TAB: ENREGISTRÉS (UTILISE SavedTabContent DU CLIENT APP) */}
            {user.role === 'client' && activeSubTab === 'saved' && (
              <SavedTabContent
                savedProducts={savedProducts}
                sellers={sellers}
                onOpenVideoViewer={openVideoViewer}
                onSelectProduct={setSelectedProduct}
                onToggleSave={toggleSaveProduct}
                onAddToCart={(productId) => addToCart(productId, {}, 1)}
                onNavigateExplore={() => {}}
              />
            )}

            {/* TAB: HISTORIQUE (UTILISE HistoryTabContent DU CLIENT APP) */}
            {user.role === 'client' && activeSubTab === 'history' && (
              <HistoryTabContent
                orders={deliveredOrders}
                products={products}
                sellers={sellers}
                onSelectOrder={setSelectedOrder}
                onSelectProduct={setSelectedProduct}
                onNavigateFeed={() => {}}
                onShowToast={showToast}
              />
            )}

            {/* TAB: ACHATS (UTILISE PurchasesTabContent DU CLIENT APP) */}
            {user.role === 'client' && activeSubTab === 'purchases' && (
              <PurchasesTabContent
                purchasedEntries={inProgressPurchasedEntries.length > 0 ? inProgressPurchasedEntries : purchasedEntries}
                sellers={sellers}
                onSelectOrder={setSelectedOrder}
                onSelectProduct={setSelectedProduct}
                onNavigateExplore={() => {}}
              />
            )}

            {/* TAB: ESSAYAGES IA (UTILISE TryOnTabContent DU CLIENT APP) */}
            {user.role === 'client' && activeSubTab === 'tryon' && (
              <TryOnTabContent
                tryOnHistory={clientTryOnHistory}
                products={products}
                sellers={sellers}
                onSelectProduct={setSelectedProduct}
                onOpenTryOn={openTryOnModal}
                onRemoveItem={removeTryOnHistoryItem}
                onAddToCart={(productId, opts) => addToCart(productId, opts || {}, 1)}
                onNavigateFeed={() => {}}
              />
            )}

            {/* =========================================================================
                ONGLETS VENDEUR (COMPOSANTS OFFICIELS DE L'APPLICATION VENDEUR DJASSA)
                ========================================================================= */}

            {/* TAB: VITRINE PHOTOS (POUR VENDEUR - EXACT COMME SELLER APP) */}
            {user.role === 'seller' && activeSubTab === 'photos' && (
              <SellerPhotosTab
                photos={sellerPhotos}
                onSelectProduct={setSelectedProduct}
                onGoAddPhoto={() => showToast('Action ajout photo disponible depuis l’application vendeur')}
                showToast={showToast}
              />
            )}

            {/* TAB: VIDÉOS VITRINES (POUR VENDEUR - EXACT COMME SELLER APP) */}
            {user.role === 'seller' && activeSubTab === 'videos' && (
              <SellerVideosTab
                videos={sellerVideosList}
                onOpenVideoViewer={openVideoViewer}
                onSelectProduct={setSelectedProduct}
                onGoAddVideo={() => showToast('Action ajout vidéo disponible depuis l’application vendeur')}
                showToast={showToast}
              />
            )}

            {/* TAB: MES CRÉATIONS (POUR VENDEUR - EXACT COMME SELLER APP) */}
            {user.role === 'seller' && activeSubTab === 'creations' && (
              <SellerCreationsTab
                seller={sellerObj}
                photos={sellerPhotos}
                videos={sellerVideosList}
                onSelectProduct={setSelectedProduct}
                onOpenVideoViewer={openVideoViewer}
                onGoAddCreation={() => showToast('Action création IA disponible depuis l’application vendeur')}
                showToast={showToast}
              />
            )}

            {/* TAB: ACHATS / VENTES (POUR VENDEUR - EXACT COMME SELLER APP) */}
            {user.role === 'seller' && activeSubTab === 'achats' && (
              <SellerSalesTab
                seller={sellerObj}
                products={sellerProductsList}
                onSelectProduct={setSelectedProduct}
                showToast={showToast}
              />
            )}

            {/* TAB: AVIS & COMMENTAIRES (POUR VENDEUR - EXACT COMME SELLER APP) */}
            {user.role === 'seller' && activeSubTab === 'avis' && (
              <SellerReviewsTab
                seller={sellerObj}
                products={sellerProductsList}
                isSellerSelf={false}
                onSelectProduct={setSelectedProduct}
                showToast={showToast}
              />
            )}

            {/* =====================================================================
                SUPER ADMIN TAB 1: HISTORIQUE DES DISCUSSIONS
                ===================================================================== */}
            {activeSubTab === 'discussions' && (
              <div className="space-y-4 max-w-6xl mx-auto">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-purple-400" />
                      <span>Historique complet des discussions de l'utilisateur</span>
                    </h3>
                    <p className="text-xs text-white/50">
                      Surveillance administrative des conversations avec boutiques et support.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10 text-xs">
                    {(['all', 'seller', 'admin'] as const).map(roleKey => (
                      <button
                        key={roleKey}
                        type="button"
                        onClick={() => setDiscussionFilterRole(roleKey)}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                          discussionFilterRole === roleKey 
                            ? 'bg-purple-600 text-white' 
                            : 'text-white/60 hover:text-white'
                        }`}
                      >
                        {roleKey === 'all' && 'Tous'}
                        {roleKey === 'seller' && 'Vendeurs'}
                        {roleKey === 'admin' && 'Support'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Left: Conversations list */}
                  <div className="space-y-2 md:col-span-1">
                    {filteredDiscussions.map((d) => (
                      <div
                        key={d.id}
                        onClick={() => setSelectedDiscussionThread(d)}
                        className={`p-3 rounded-2xl border transition cursor-pointer flex items-center gap-3 ${
                          selectedDiscussionThread?.id === d.id
                            ? 'bg-purple-600/20 border-purple-500 shadow-md'
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <img src={d.participantAvatar} alt={d.participantName} className="w-10 h-10 rounded-full object-cover shrink-0" />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-white truncate">{d.participantName}</h4>
                          <p className="text-[11px] text-white/50 truncate mt-0.5">{d.lastMessage}</p>
                          <span className="text-[10px] text-white/30 font-mono">{d.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Right: Message Thread Inspector */}
                  <div className="md:col-span-2 p-4 rounded-3xl bg-white/5 border border-white/10 flex flex-col min-h-[380px]">
                    {selectedDiscussionThread ? (
                      <div className="flex flex-col h-full space-y-3">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                          <div className="flex items-center gap-2">
                            <img src={selectedDiscussionThread.participantAvatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                            <div>
                              <span className="text-xs font-bold text-white block">{selectedDiscussionThread.participantName}</span>
                              <span className="text-[10px] text-purple-300 font-mono">Discussion authentique vérifiée</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedDiscussionThread(null)}
                            className="text-white/40 hover:text-white p-1 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex-1 space-y-2.5 overflow-y-auto no-scrollbar max-h-80 p-2">
                          {selectedDiscussionThread.messages.map((m: any, idx: number) => (
                            <div
                              key={idx}
                              className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                            >
                              <div
                                className={`p-2.5 rounded-2xl text-xs max-w-xs ${
                                  m.sender === 'user'
                                    ? 'bg-[#FF6321] text-white rounded-br-xs'
                                    : 'bg-white/10 text-white rounded-bl-xs'
                                }`}
                              >
                                {m.text}
                              </div>
                              <span className="text-[10px] text-white/30 font-mono mt-0.5 px-1">{m.time}</span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 border-t border-white/10 flex items-center gap-2 text-xs text-white/40">
                          <Lock className="w-3.5 h-3.5 text-purple-400" />
                          <span>Mode audit super-administrateur en lecture intégrale.</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-white/40 text-xs">
                        <MessageSquare className="w-10 h-10 text-white/20 mb-2" />
                        <span>Sélectionnez une discussion à gauche pour inspecter l'intégralité des messages échangés.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* =====================================================================
                SUPER ADMIN TAB 2: DISCUSSIONS ASSISTANT IA RODIUMAI
                ===================================================================== */}
            {activeSubTab === 'chatgpt' && (
              <div className="space-y-4 max-w-5xl mx-auto">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <ChatGptLogo className="w-5 h-5 text-emerald-400" />
                      <span>Historique des requêtes et discussions IA RodiumAI (MiniMax &amp; Qwen)</span>
                    </h3>
                    <p className="text-xs text-white/50">
                      Consultation des prompts, fiches créées et conseils générés par l'IA pour cet utilisateur.
                    </p>
                  </div>

                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-mono font-bold">
                    {chatGptSessions.length} Sessions IA enregistrées
                  </span>
                </div>

                <div className="space-y-3">
                  {chatGptSessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500/40 transition space-y-3"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
                            <Bot className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-black text-white">{session.title}</h4>
                            <p className="text-[11px] text-white/40 font-mono">{session.topic} • {session.date}</p>
                          </div>
                        </div>

                        <div className="text-right font-mono text-xs">
                          <span className="text-emerald-400 font-bold block">{session.tokensUsed.toLocaleString()} tokens</span>
                          <span className="text-white/40 text-[10px]">Coût : {session.costFCFA} FCFA</span>
                        </div>
                      </div>

                      {/* Transcripts */}
                      <div className="space-y-2 pt-2 border-t border-white/5 text-xs">
                        {session.messages.map((msg, i) => (
                          <div
                            key={i}
                            className={`p-3 rounded-xl ${
                              msg.sender === 'user' 
                                ? 'bg-white/5 text-white/90 border border-white/5' 
                                : 'bg-emerald-950/20 text-emerald-100 border border-emerald-500/20 whitespace-pre-line'
                            }`}
                          >
                            <span className="text-[10px] font-bold block mb-1 text-white/40">
                              {msg.sender === 'user' ? 'Prompt Utilisateur :' : 'Réponse RodiumAI (MiniMax H3 Max Turbo) :'}
                            </span>
                            {msg.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* =====================================================================
                SUPER ADMIN TAB 3: ABONNEMENTS ET FORFAITS PAYÉS (+ PUBLICITÉS VENDEUR)
                ===================================================================== */}
            {activeSubTab === 'abonnements' && user.role === 'seller' && (
              <SellerBillingHistoryTab
                user={user}
                seller={sellerObj}
                sellerProducts={sellerProductsList}
                onShowToast={showToast}
              />
            )}

            {activeSubTab === 'abonnements' && user.role === 'client' && (
              <ClientBillingHistoryTab
                user={user}
                onShowToast={showToast}
              />
            )}

            {activeSubTab === 'abonnements' && user.role !== 'seller' && user.role !== 'client' && (
              <div className="space-y-4 max-w-5xl mx-auto">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-base font-black text-white flex items-center gap-2">
                      <Crown className="w-5 h-5 text-amber-400" />
                      <span>Abonnements, Packs et Forfaits payés par l'utilisateur</span>
                    </h3>
                    <p className="text-xs text-white/50">
                      Suivi complet des transactions récurrentes, renouvellements et forfaits VIP actifs.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => showToast('Forfait accordé avec succès')}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Accorder un Forfait</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {userSubscriptions.map((sub) => (
                    <div
                      key={sub.id}
                      className="p-4 rounded-3xl bg-white/5 border border-white/10 hover:border-amber-400/40 transition space-y-3.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block font-mono">
                            {sub.category}
                          </span>
                          <h4 className="text-sm font-black text-white">{sub.name}</h4>
                          <span className="text-[11px] text-white/40 font-mono block">Réf : {sub.reference}</span>
                        </div>

                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                          {sub.status === 'active' ? 'ACTIF ✓' : 'RENOUVELÉ'}
                        </span>
                      </div>

                      <div className="p-3 bg-black/40 rounded-2xl border border-white/5 flex items-center justify-between text-xs font-mono">
                        <div>
                          <span className="text-white/40 text-[10px] block">Montant Facturé</span>
                          <span className="text-base font-black text-emerald-400">{formatFCFA(sub.priceFCFA)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-white/40 text-[10px] block">Moyen de paiement</span>
                          <span className="text-white font-bold">{sub.paymentMethod}</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs text-white/70">
                        <span className="text-[10px] text-white/40 font-bold block uppercase">Avantages inclus :</span>
                        {sub.features.map((feat, fidx) => (
                          <div key={fidx} className="flex items-center gap-1.5 text-[11px]">
                            <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-white/40 font-mono">
                        <span>Période : {sub.startDate} au {sub.endDate}</span>
                        <button
                          type="button"
                          onClick={() => showToast('Reçu PDF téléchargé')}
                          className="text-amber-300 hover:text-white flex items-center gap-1 font-bold cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Reçu</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* =====================================================================
                SUPER ADMIN TAB 4: DOSSIER KYC
                ===================================================================== */}
            {activeSubTab === 'kyc' && (
              <div className="space-y-4 max-w-4xl mx-auto">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Dossier KYC et Pièces Officielles</span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleApproveKyc}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Check className="w-4 h-4" />
                    <span>Valider KYC en 1 Clic</span>
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 text-xs">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/50">Type de document</span>
                    <span className="font-bold text-white">Carte Nationale d’Identité Ivoirienne (CNI)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/50">Numéro de pièce</span>
                    <span className="font-mono text-cyan-300 font-bold">CI-002849102-2024</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/50">Statut de vérification</span>
                    <span className={`font-bold ${user.kycVerified ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {user.kycVerified ? 'Certifié & Conforme ✓' : 'En attente de validation'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-white/50">Vérification faciale / Selfie</span>
                    <span className="text-emerald-400 font-bold">Validée avec succès</span>
                  </div>
                </div>
              </div>
            )}

            {/* =====================================================================
                SUPER ADMIN TAB 5: ACTIONS ET SANCTIONS ADMINISTRATEUR
                ===================================================================== */}
            {(activeSubTab === 'actions_admin' || activeSubTab === 'actions') && (
              <div className="space-y-4 max-w-4xl mx-auto">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-rose-500" />
                  <span>Panneau d’administration et sanctions directes</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <span className="font-bold text-white text-xs block">Suspension temporaire ou définitive</span>
                    <p className="text-[11px] text-white/50">Bloque l'accès à la marketplace et aux transactions.</p>
                    <button
                      type="button"
                      onClick={handleToggleSuspension}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                        user.status === 'suspended'
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-rose-600/30 hover:bg-rose-600 text-rose-200 border border-rose-500/40'
                      }`}
                    >
                      <Ban className="w-4 h-4" />
                      <span>{user.status === 'suspended' ? 'Réactiver le compte' : 'Suspendre le compte'}</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <span className="font-bold text-white text-xs block">Certification KYC & Conformité</span>
                    <p className="text-[11px] text-white/50">Valide la CNI, le selfie et accorde le badge officiel.</p>
                    <button
                      type="button"
                      onClick={handleApproveKyc}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Valider KYC Immédiatement</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <span className="font-bold text-white text-xs block">Avertissement officiel</span>
                    <p className="text-[11px] text-white/50">Envoie un avertissement push et SMS avec motif consigné au dossier.</p>
                    <button
                      type="button"
                      onClick={() => setShowWarningModal(true)}
                      className="w-full py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      <span>Rédiger un avertissement</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <span className="font-bold text-white text-xs block">Ouvrir discussion directe</span>
                    <p className="text-[11px] text-white/50">Lance un canal officiel d'assistance et de contact administrateur.</p>
                    <button
                      type="button"
                      onClick={handleOpenDirectChat}
                      className="w-full py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Contacter l'utilisateur</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* =====================================================================
                SUPER ADMIN SELLER FINANCE TABS: REVENUS & RETRAITS
                ===================================================================== */}
            {user.role === 'seller' && activeSubTab === 'revenus' && (
              <SellerRevenueTab
                user={user}
                seller={sellerObj}
                revenueEntries={sellerFinance.revenueEntries}
                totalGross={sellerFinance.totalGross}
                totalCommission={sellerFinance.totalCommission}
                totalNet={sellerFinance.totalNet}
                availableBalance={sellerFinance.withdrawalTotals.availableBalance}
                totalWithdrawnGross={sellerFinance.withdrawalTotals.totalWithdrawnGross}
                monthlyBreakdown={sellerFinance.monthlyBreakdown}
                onRefundEntry={sellerFinance.refundEntry}
                onGoWithdrawals={() => setActiveSubTab('retraits')}
                onShowToast={showToast}
              />
            )}

            {user.role === 'seller' && activeSubTab === 'retraits' && (
              <SellerWithdrawalTab
                user={user}
                seller={sellerObj}
                withdrawals={sellerFinance.withdrawals}
                setWithdrawals={sellerFinance.setWithdrawals}
                totals={sellerFinance.withdrawalTotals}
                totalNetEarned={sellerFinance.totalNet}
                onShowToast={showToast}
              />
            )}

          </div>
        </div>

        {/* =========================================================================
            BOTTOM BAR CONTROLS
            ========================================================================= */}
        <div className="shrink-0 p-3.5 bg-[#0E0E0E] border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleSuspension}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition active:scale-95 cursor-pointer ${
                user.status === 'suspended'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
              }`}
            >
              <Ban className="w-3.5 h-3.5" />
              <span>{user.status === 'suspended' ? 'Réactiver Compte' : 'Suspendre Compte'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowWarningModal(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Avertissement</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenDirectChat}
              className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Ouvrir Discussion</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>

      {/* Official Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#161616] border border-amber-500/40 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Notifier {user.name}</h3>
                <p className="text-xs text-amber-300/80">Notification push & SMS direct</p>
              </div>
            </div>

            <form onSubmit={handleSendOfficialNotice} className="space-y-3">
              <textarea
                value={warningMessage}
                onChange={(e) => setWarningMessage(e.target.value)}
                rows={3}
                placeholder="Raison de l'alerte ou message d'administration..."
                className="w-full p-3 rounded-xl bg-black/50 border border-white/15 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400 resize-none"
                required
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowWarningModal(false)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black transition cursor-pointer"
                >
                  Envoyer l'Alerte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
