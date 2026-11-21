import React, { useState, useMemo } from 'react';
import { 
  Crown, 
  Users, 
  Store, 
  User, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Calendar, 
  DollarSign, 
  Sparkles, 
  Edit3, 
  Plus, 
  ExternalLink, 
  ArrowRight, 
  ArrowLeft,
  ShoppingBag,
  X, 
  ChevronRight, 
  Phone, 
  MapPin, 
  Check, 
  Zap, 
  HardDrive, 
  Navigation, 
  Video, 
  Image as ImageIcon, 
  MessageSquare, 
  TrendingUp,
  Download,
  ShieldCheck,
  Smartphone,
  Activity,
  Server,
  Database,
  Cpu,
  Layers,
  Wifi,
  FileText,
  RefreshCw,
  History,
  BarChart3,
  Trash2
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { formatFCFA, formatOrderDate } from '../../../services/marketServices';
import { AdminUserRecord } from '../../../types';
import { AdminUserDetailModal } from '../modals/AdminUserDetailModal';

// =============================================================================
// TYPES
// =============================================================================

export interface AdminPlanItem {
  id: string;
  name: string;
  appType: 'client' | 'seller';
  appLabel: string;
  badge?: string;
  priceFcfa: number;
  period: string;
  creditsGranted: number;
  tagline: string;
  accentColor: string;
  isPopular?: boolean;
  isActive: boolean;
  capacity?: string;
  features?: string[];
  capabilities: {
    questionsCount: string;
    questionsDetail: string;
    imagesCount?: string;
    videosCount?: string;
    storageCount?: string;
    mapOpsCount?: string;
    mapViewsCount?: string;
    routeCalcCount?: string;
    geocodingCount?: string;
  };
}

export interface SubscriberProfile {
  id: string;
  name: string;
  role: 'client' | 'seller';
  appType: 'Client' | 'Vendeur';
  avatar: string;
  phone: string;
  commune: string;
  planId: string;
  planName: string;
  startDate: string;
  purchaseTime?: string;
  renewalDate: string;
  amountPaid: number;
  paymentMethod: 'Wave' | 'Orange Money' | 'MTN MoMo' | 'Carte Bancaire';
  creditsTotal: number;
  creditsRemaining: number;
  status: 'active' | 'expiring_soon' | 'completed' | 'overdue';
  autoRenew: boolean;
  mapViewsTotal?: number;
  mapViewsRemaining?: number;
  routeCalcTotal?: number;
  routeCalcRemaining?: number;
  geocodingTotal?: number;
  geocodingRemaining?: number;
}

// Helpers for strict and unambiguous subscription status categorization
export const isSubscriptionInProgress = (status: SubscriberProfile['status']) => {
  return status === 'active' || status === 'expiring_soon';
};

export const isSubscriptionCompleted = (status: SubscriberProfile['status']) => {
  return status === 'completed' || status === 'overdue';
};

// =============================================================================
// INITIAL PLANS DATA FOR THE 2 APPS (CLIENT & VENDEUR)
// =============================================================================

export const INITIAL_ADMIN_PLANS: AdminPlanItem[] = [
  // ---------------------------------------------------------------------------
  // 1. APPLICATION CLIENT (DJASSA Mini, DJASSA Plus, DJASSA Premium)
  // ---------------------------------------------------------------------------
  {
    id: 'mini',
    name: 'DJASSA Mini',
    appType: 'client',
    appLabel: 'Application Client',
    badge: 'Découverte',
    priceFcfa: 300,
    period: 'par mois',
    creditsGranted: 30,
    tagline: '30 crédits pour poser vos questions à l’assistant & créations IA',
    accentColor: 'from-purple-500 to-indigo-600',
    isActive: true,
    capabilities: {
      questionsCount: '30 questions IA',
      questionsDetail: 'Pour poser des questions à l\'assistant',
      imagesCount: '2 créations d’images (générées par l’IA)'
    }
  },
  {
    id: 'plus',
    name: 'DJASSA Plus',
    appType: 'client',
    appLabel: 'Application Client',
    badge: 'LE PLUS POPULAIRE CLIENT',
    isPopular: true,
    priceFcfa: 600,
    period: 'par mois',
    creditsGranted: 60,
    tagline: '60 crédits IA pour vos recherches et créations d’images studio',
    accentColor: 'from-blue-600 to-indigo-600',
    isActive: true,
    capabilities: {
      questionsCount: '60 questions IA',
      questionsDetail: 'Pour poser des questions à l\'assistant & conseils shopping',
      imagesCount: '5 créations d’images'
    }
  },
  {
    id: 'premium',
    name: 'DJASSA Premium',
    appType: 'client',
    appLabel: 'Application Client',
    badge: 'VIP Shopping',
    priceFcfa: 1200,
    period: 'par mois',
    creditsGranted: 120,
    tagline: '120 crédits IA haute vitesse et créations d’images haute définition',
    accentColor: 'from-amber-500 to-purple-600',
    isActive: true,
    capabilities: {
      questionsCount: '120 questions IA',
      questionsDetail: 'Accès haute vitesse assistant IA & styliste dédié',
      imagesCount: '12 créations d’images'
    }
  },

  // ---------------------------------------------------------------------------
  // 2. APPLICATION VENDEUR (Starter, Pro Marché, Élite Studio)
  // ---------------------------------------------------------------------------
  {
    id: 'vendeur_starter',
    name: 'Vendeur Starter',
    appType: 'seller',
    appLabel: 'Application Vendeur',
    badge: 'Lancement Boutique',
    priceFcfa: 4500,
    period: 'par mois',
    creditsGranted: 450,
    tagline: 'Rédaction fiches produits vendeuses, lookbooks et 3 vidéos RodiumAI 5s WhatsApp',
    accentColor: 'from-emerald-500 to-teal-600',
    isActive: true,
    capabilities: {
      questionsCount: '50 questions IA Vendeur (5 crédits/u)',
      questionsDetail: 'Calcul de marge & conseils commerce local Adjamé',
      imagesCount: '20 images studio catalogue (10 crédits/u)',
      videosCount: '3 vidéos 5s RodiumAI (60 crédits/u)'
    }
  },
  {
    id: 'vendeur_pro',
    name: 'Vendeur Pro Marché',
    appType: 'seller',
    appLabel: 'Application Vendeur',
    badge: 'LE PLUS POPULAIRE VENDEUR',
    isPopular: true,
    priceFcfa: 8900,
    period: 'par mois',
    creditsGranted: 900,
    tagline: 'La formule star des boutiques : lookbooks 4K et 8 vidéos de défilés RodiumAI',
    accentColor: 'from-[#FF6321] to-[#FF8540]',
    isActive: true,
    capabilities: {
      questionsCount: '100 questions IA Vendeur (5 crédits/u)',
      questionsDetail: 'Bilan de semaine, calcul de rentabilité & gestion SAV',
      imagesCount: '40 images catalogue 4K (10 crédits/u)',
      videosCount: '8 vidéos 5s défilés RodiumAI HD (60 crédits/u)'
    }
  },
  {
    id: 'vendeur_elite',
    name: 'Vendeur Élite Studio',
    appType: 'seller',
    appLabel: 'Application Vendeur',
    badge: 'MARQUES & GROSSISTES',
    priceFcfa: 16900,
    period: 'par mois',
    creditsGranted: 1800,
    tagline: '1 800 crédits mensuels, 18 vidéos RodiumAI Studio 1080p et badge Boutique Recommandée',
    accentColor: 'from-purple-600 to-pink-600',
    isActive: true,
    capabilities: {
      questionsCount: '200 questions IA illimitées (5 crédits/u)',
      questionsDetail: 'Audit de catalogue & prévisions de ventes mensuelles',
      imagesCount: '80 shootings studio 4K (10 crédits/u)',
      videosCount: '18 vidéos 5s défilés RodiumAI Pro (60 crédits/u)'
    }
  },

];

// =============================================================================
// INITIAL SUBSCRIBER PROFILES DATA (Real Ivorian Users across the 2 apps)
// =============================================================================

export const INITIAL_SUBSCRIBER_PROFILES: SubscriberProfile[] = [
  // --- Clients: DJASSA Premium (1 200 F) ---
  {
    id: 'sub-cli-1',
    name: 'Amina Kouamé (Styliste & Shopper VIP)',
    role: 'client',
    appType: 'Client',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
    phone: '+225 07 11 22 33 44',
    commune: 'Cocody Angré 8ème Tranche',
    planId: 'premium',
    planName: 'DJASSA Premium',
    startDate: '14 Sept 2026',
    purchaseTime: '10:15',
    renewalDate: '14 Oct 2026',
    amountPaid: 1200,
    paymentMethod: 'Orange Money',
    creditsTotal: 120,
    creditsRemaining: 110,
    status: 'active',
    autoRenew: true
  },
  {
    id: 'sub-cli-2',
    name: 'David Gnaoré (Directeur Artistique)',
    role: 'client',
    appType: 'Client',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    phone: '+225 05 44 88 12 34',
    commune: 'Plateau Cité Administrative',
    planId: 'premium',
    planName: 'DJASSA Premium',
    startDate: '08 Sept 2026',
    purchaseTime: '11:40',
    renewalDate: '08 Oct 2026',
    amountPaid: 1200,
    paymentMethod: 'Wave',
    creditsTotal: 120,
    creditsRemaining: 95,
    status: 'active',
    autoRenew: true
  },
  {
    id: 'sub-cli-3',
    name: 'Fatou Traoré (Créatrice de Contenu Mode)',
    role: 'client',
    appType: 'Client',
    avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200',
    phone: '+225 07 48 99 55 12',
    commune: 'Cocody Deux-Plateaux Vallons',
    planId: 'premium',
    planName: 'DJASSA Premium',
    startDate: '12 Sept 2026',
    purchaseTime: '16:20',
    renewalDate: '12 Oct 2026',
    amountPaid: 1200,
    paymentMethod: 'Wave',
    creditsTotal: 120,
    creditsRemaining: 118,
    status: 'active',
    autoRenew: true
  },
  {
    id: 'sub-cli-4',
    name: 'Estelle Kouassi',
    role: 'client',
    appType: 'Client',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
    phone: '+225 07 55 66 77 88',
    commune: 'Marcory Zone 4',
    planId: 'premium',
    planName: 'DJASSA Premium',
    startDate: '01 Sept 2026',
    purchaseTime: '09:05',
    renewalDate: '01 Oct 2026',
    amountPaid: 1200,
    paymentMethod: 'MTN MoMo',
    creditsTotal: 120,
    creditsRemaining: 0,
    status: 'completed',
    autoRenew: false
  },

  // --- Clients: DJASSA Plus (600 F) ---
  {
    id: 'sub-cli-5',
    name: 'Sarah Koné',
    role: 'client',
    appType: 'Client',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200',
    phone: '+225 07 12 34 56 78',
    commune: 'Yopougon Maroc',
    planId: 'plus',
    planName: 'DJASSA Plus',
    startDate: '15 Sept 2026',
    purchaseTime: '15:10',
    renewalDate: '15 Oct 2026',
    amountPaid: 600,
    paymentMethod: 'Wave',
    creditsTotal: 60,
    creditsRemaining: 55,
    status: 'active',
    autoRenew: true
  },
  {
    id: 'sub-cli-6',
    name: 'Brice N’Da',
    role: 'client',
    appType: 'Client',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
    phone: '+225 05 01 02 03 04',
    commune: 'Koumassi Remblais',
    planId: 'plus',
    planName: 'DJASSA Plus',
    startDate: '10 Sept 2026',
    purchaseTime: '18:50',
    renewalDate: '10 Oct 2026',
    amountPaid: 600,
    paymentMethod: 'Orange Money',
    creditsTotal: 60,
    creditsRemaining: 0,
    status: 'completed',
    autoRenew: false
  },

  // --- Clients: DJASSA Mini (300 F) ---
  {
    id: 'sub-cli-7',
    name: 'Salimata Bamba',
    role: 'client',
    appType: 'Client',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200',
    phone: '+225 07 88 99 00 11',
    commune: 'Abobo Baoulé',
    planId: 'mini',
    planName: 'DJASSA Mini',
    startDate: '16 Sept 2026',
    purchaseTime: '14:32',
    renewalDate: '16 Oct 2026',
    amountPaid: 300,
    paymentMethod: 'Wave',
    creditsTotal: 30,
    creditsRemaining: 30,
    status: 'active',
    autoRenew: true
  },
  {
    id: 'sub-cli-8',
    name: 'Yao Koffi Kouadio',
    role: 'client',
    appType: 'Client',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200',
    phone: '+225 01 02 03 04 05',
    commune: 'Yopougon Siporex',
    planId: 'mini',
    planName: 'DJASSA Mini',
    startDate: '25 Août 2026',
    purchaseTime: '11:20',
    renewalDate: '25 Sept 2026',
    amountPaid: 300,
    paymentMethod: 'Wave',
    creditsTotal: 30,
    creditsRemaining: 0,
    status: 'completed',
    autoRenew: false
  },

  // --- Vendeurs: Élite Studio (16 900 F) ---
  {
    id: 'sub-sel-1',
    name: 'Marcory Bazin VIP & Soieries',
    role: 'seller',
    appType: 'Vendeur',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
    phone: '+225 07 14 15 16 17',
    commune: 'Marcory Résidentiel',
    planId: 'vendeur_elite',
    planName: 'Vendeur Élite Studio',
    startDate: '13 Sept 2026',
    renewalDate: '13 Oct 2026',
    amountPaid: 16900,
    paymentMethod: 'Wave',
    creditsTotal: 1800,
    creditsRemaining: 1240,
    status: 'active',
    autoRenew: true
  },
  {
    id: 'sub-sel-2',
    name: 'Kouassi Cuir & Chaussures de Luxe',
    role: 'seller',
    appType: 'Vendeur',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200',
    phone: '+225 07 12 34 56 78',
    commune: 'Adjamé Dallas',
    planId: 'vendeur_elite',
    planName: 'Vendeur Élite Studio',
    startDate: '05 Sept 2026',
    renewalDate: '05 Oct 2026',
    amountPaid: 16900,
    paymentMethod: 'Wave',
    creditsTotal: 1800,
    creditsRemaining: 680,
    status: 'active',
    autoRenew: true
  },
  {
    id: 'sub-sel-8',
    name: 'Haute Couture Abidjan Riviera VIP',
    role: 'seller',
    appType: 'Vendeur',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
    phone: '+225 07 77 66 55 44',
    commune: 'Cocody Riviera 3',
    planId: 'vendeur_elite',
    planName: 'Vendeur Élite Studio',
    startDate: '04 Août 2026',
    renewalDate: '04 Sept 2026',
    amountPaid: 16900,
    paymentMethod: 'Orange Money',
    creditsTotal: 1800,
    creditsRemaining: 0,
    status: 'completed',
    autoRenew: false
  },

  // --- Vendeurs: Pro Marché (8 900 F) ---
  {
    id: 'sub-sel-3',
    name: 'Boutique Wax & Élégance (Adjamé)',
    role: 'seller',
    appType: 'Vendeur',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
    phone: '+225 07 48 99 12 34',
    commune: 'Adjamé Forum des Marchés Hall 2',
    planId: 'vendeur_pro',
    planName: 'Vendeur Pro Marché',
    startDate: '16 Sept 2026',
    renewalDate: '16 Oct 2026',
    amountPaid: 8900,
    paymentMethod: 'Wave',
    creditsTotal: 900,
    creditsRemaining: 620,
    status: 'active',
    autoRenew: true
  },
  {
    id: 'sub-sel-4',
    name: 'Adjamé High-Tech Store & Audio',
    role: 'seller',
    appType: 'Vendeur',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    phone: '+225 05 55 44 33 22',
    commune: 'Adjamé Roxy Commerce',
    planId: 'vendeur_pro',
    planName: 'Vendeur Pro Marché',
    startDate: '11 Sept 2026',
    renewalDate: '11 Oct 2026',
    amountPaid: 8900,
    paymentMethod: 'Orange Money',
    creditsTotal: 900,
    creditsRemaining: 440,
    status: 'active',
    autoRenew: true
  },
  {
    id: 'sub-sel-5',
    name: 'Bijoux & Parfums Koumassi Centre',
    role: 'seller',
    appType: 'Vendeur',
    avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200',
    phone: '+225 07 33 44 55 66',
    commune: 'Koumassi Grand Carrefour',
    planId: 'vendeur_pro',
    planName: 'Vendeur Pro Marché',
    startDate: '07 Août 2026',
    renewalDate: '07 Sept 2026',
    amountPaid: 8900,
    paymentMethod: 'MTN MoMo',
    creditsTotal: 900,
    creditsRemaining: 0,
    status: 'completed',
    autoRenew: false
  },

  // --- Vendeurs: Starter (4 500 F) ---
  {
    id: 'sub-sel-7',
    name: 'Épicerie Fine & Saveurs d\'Ivoire',
    role: 'seller',
    appType: 'Vendeur',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200',
    phone: '+225 07 20 21 22 23',
    commune: 'Cocody Cité des Arts',
    planId: 'vendeur_starter',
    planName: 'Vendeur Starter',
    startDate: '14 Sept 2026',
    renewalDate: '14 Oct 2026',
    amountPaid: 4500,
    paymentMethod: 'Wave',
    creditsTotal: 450,
    creditsRemaining: 310,
    status: 'active',
    autoRenew: true
  },
  {
    id: 'sub-sel-6',
    name: 'Mode & Sneakers Yopougon Siporex',
    role: 'seller',
    appType: 'Vendeur',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200',
    phone: '+225 05 99 88 77 66',
    commune: 'Yopougon Siporex',
    planId: 'vendeur_starter',
    planName: 'Vendeur Starter',
    startDate: '12 Août 2026',
    renewalDate: '12 Sept 2026',
    amountPaid: 4500,
    paymentMethod: 'Wave',
    creditsTotal: 450,
    creditsRemaining: 0,
    status: 'completed',
    autoRenew: false
  },

];

// =============================================================================
// SUBSCRIPTION API CONSUMPTION DATA & TYPES (Discussions, Images, Vidéos, etc.)
// =============================================================================

export interface SubscriptionApiRecord {
  id: string;
  planId: string;
  timestamp: string;
  date: string;
  userOrStore: string;
  userRole: 'client' | 'seller';
  featureType: 'chat' | 'image' | 'video' | 'maps' | 'sms';
  featureLabel: string;
  model: string;
  tokensUsed: number;
  unitsConsumed: number;
  unitLabel: string;
  costFCFA: number;
  revenueFCFA: number;
  profitFCFA: number;
  statusCode: number;
  latencyMs: number;
  endpoint: string;
}

export const INITIAL_SUBSCRIPTION_API_RECORDS: SubscriptionApiRecord[] = [
  // --- Plan Client Plus (plus) ---
  {
    id: 'sub-api-101',
    planId: 'plus',
    timestamp: '15:42:10',
    date: 'Aujourd’hui',
    userOrStore: 'Amina Kouamé (Styliste VIP)',
    userRole: 'client',
    featureType: 'chat',
    featureLabel: 'Discussion IA Styliste : Tenue mariage traditionnel Baoulé',
    model: 'RodiumAI — MiniMax H3 Max Turbo',
    tokensUsed: 1850,
    unitsConsumed: 1850,
    unitLabel: 'tokens',
    costFCFA: 0.28,
    revenueFCFA: 200,
    profitFCFA: 199.72,
    statusCode: 200,
    latencyMs: 145,
    endpoint: '/v1/chat/completions'
  },
  {
    id: 'sub-api-102',
    planId: 'plus',
    timestamp: '15:20:05',
    date: 'Aujourd’hui',
    userOrStore: 'Fatou Traoré (Créatrice Mode)',
    userRole: 'client',
    featureType: 'image',
    featureLabel: 'Création d’image 1K : Essayage virtuel 360° robe bazin fuchsia',
    model: 'RodiumAI — Qwen Image 2.1 Turbo',
    tokensUsed: 1200,
    unitsConsumed: 1,
    unitLabel: 'image 1K',
    costFCFA: 23.44,
    revenueFCFA: 150,
    profitFCFA: 126.56,
    statusCode: 200,
    latencyMs: 420,
    endpoint: '/v1/images/generations'
  },
  {
    id: 'sub-api-103',
    planId: 'plus',
    timestamp: '14:55:18',
    date: 'Aujourd’hui',
    userOrStore: 'David Gnaoré (Directeur Artistique)',
    userRole: 'client',
    featureType: 'chat',
    featureLabel: 'Discussion IA Nouchi : Recherche artisan maroquinier Adjamé',
    model: 'RodiumAI — MiniMax H3 Max Turbo',
    tokensUsed: 1420,
    unitsConsumed: 1420,
    unitLabel: 'tokens',
    costFCFA: 0.22,
    revenueFCFA: 180,
    profitFCFA: 179.78,
    statusCode: 200,
    latencyMs: 135,
    endpoint: '/v1/chat/completions'
  },
  {
    id: 'sub-api-104',
    planId: 'plus',
    timestamp: '14:10:40',
    date: 'Aujourd’hui',
    userOrStore: 'Estelle Kouassi',
    userRole: 'client',
    featureType: 'image',
    featureLabel: 'Création d’image 1K : Visualisation ensemble veste wax contemporain',
    model: 'RodiumAI — Qwen Image 2.1 Turbo',
    tokensUsed: 1200,
    unitsConsumed: 1,
    unitLabel: 'image 1K',
    costFCFA: 23.44,
    revenueFCFA: 150,
    profitFCFA: 126.56,
    statusCode: 200,
    latencyMs: 450,
    endpoint: '/v1/images/generations'
  },

  // --- Plan Vendeur Pro Marché (vendeur_pro) ---
  {
    id: 'sub-api-201',
    planId: 'vendeur_pro',
    timestamp: '15:38:00',
    date: 'Aujourd’hui',
    userOrStore: 'Mode & Tendance Plateau (M. Bamba)',
    userRole: 'seller',
    featureType: 'video',
    featureLabel: 'Création vidéo 5s 480p : Clip défilé mannequin robe kita',
    model: 'RodiumAI — MiniMax H3 Max Turbo',
    tokensUsed: 4500,
    unitsConsumed: 1,
    unitLabel: 'vidéo 5s 480p',
    costFCFA: 205.10,
    revenueFCFA: 650,
    profitFCFA: 444.90,
    statusCode: 200,
    latencyMs: 1850,
    endpoint: '/v1/video/generations'
  },
  {
    id: 'sub-api-202',
    planId: 'vendeur_pro',
    timestamp: '15:15:22',
    date: 'Aujourd’hui',
    userOrStore: 'Chic & Wax Cocody',
    userRole: 'seller',
    featureType: 'image',
    featureLabel: 'Création d’image 2K : Lookbook haute définition collection Korhogo',
    model: 'RodiumAI — Qwen Image 2.1 Turbo',
    tokensUsed: 2400,
    unitsConsumed: 1,
    unitLabel: 'image 2K',
    costFCFA: 43.95,
    revenueFCFA: 300,
    profitFCFA: 256.05,
    statusCode: 200,
    latencyMs: 650,
    endpoint: '/v1/images/generations'
  },
  {
    id: 'sub-api-203',
    planId: 'vendeur_pro',
    timestamp: '14:40:11',
    date: 'Aujourd’hui',
    userOrStore: 'Adjamé Luxe Maroquinerie',
    userRole: 'seller',
    featureType: 'chat',
    featureLabel: 'Discussion IA : Rédaction fiches produits & hashtags TikTok',
    model: 'RodiumAI — MiniMax H3 Max Turbo',
    tokensUsed: 2200,
    unitsConsumed: 2200,
    unitLabel: 'tokens',
    costFCFA: 0.33,
    revenueFCFA: 250,
    profitFCFA: 249.67,
    statusCode: 200,
    latencyMs: 140,
    endpoint: '/v1/chat/completions'
  },
  {
    id: 'sub-api-204',
    planId: 'vendeur_pro',
    timestamp: '13:55:04',
    date: 'Aujourd’hui',
    userOrStore: 'Mode & Tendance Plateau (M. Bamba)',
    userRole: 'seller',
    featureType: 'video',
    featureLabel: 'Création vidéo 5s 720p : Défilé vitrine TikTok ensemble lin',
    model: 'RodiumAI — MiniMax H3 Max Turbo',
    tokensUsed: 4500,
    unitsConsumed: 1,
    unitLabel: 'vidéo 5s 720p',
    costFCFA: 439.50,
    revenueFCFA: 1200,
    profitFCFA: 760.50,
    statusCode: 200,
    latencyMs: 2400,
    endpoint: '/v1/video/generations'
  },

  // --- Plan Client Plus (plus) ---
  {
    id: 'sub-api-301',
    planId: 'plus',
    timestamp: '15:10:00',
    date: 'Aujourd’hui',
    userOrStore: 'Amina Kouamé (Styliste VIP)',
    userRole: 'client',
    featureType: 'image',
    featureLabel: 'Création d’image : Shooting haute couture 4K multi-poses mannequin',
    model: 'RodiumAI — Qwen Image 2.1 Turbo',
    tokensUsed: 3600,
    unitsConsumed: 3,
    unitLabel: 'images HD',
    costFCFA: 37.5,
    revenueFCFA: 450,
    profitFCFA: 412.5,
    statusCode: 200,
    latencyMs: 780,
    endpoint: '/v1/images/generations'
  },
  {
    id: 'sub-api-302',
    planId: 'plus',
    timestamp: '14:25:30',
    date: 'Aujourd’hui',
    userOrStore: 'David Gnaoré (Directeur Artistique)',
    userRole: 'client',
    featureType: 'chat',
    featureLabel: 'Discussion IA : Analyse tendance défilés Abidjan Fashion Week',
    model: 'RodiumAI — MiniMax M3.1 Flash',
    tokensUsed: 3800,
    unitsConsumed: 3800,
    unitLabel: 'tokens',
    costFCFA: 57.0,
    revenueFCFA: 350,
    profitFCFA: 293.0,
    statusCode: 200,
    latencyMs: 240,
    endpoint: '/v1/chat/completions'
  },

  // --- Plan Vendeur Élite Studio (vendeur_elite) ---
  {
    id: 'sub-api-401',
    planId: 'vendeur_elite',
    timestamp: '15:30:15',
    date: 'Aujourd’hui',
    userOrStore: 'Kouassi Prestige Adjamé',
    userRole: 'seller',
    featureType: 'video',
    featureLabel: 'Création vidéo : Spot publicitaire 4K mannequin robe perles 5s',
    model: 'RodiumAI — MiniMax H3 Max Turbo',
    tokensUsed: 5000,
    unitsConsumed: 1,
    unitLabel: 'vidéo 5s',
    costFCFA: 110.0,
    revenueFCFA: 800,
    profitFCFA: 690.0,
    statusCode: 200,
    latencyMs: 2800,
    endpoint: '/v1/video/generations'
  },
  {
    id: 'sub-api-402',
    planId: 'vendeur_elite',
    timestamp: '14:48:50',
    date: 'Aujourd’hui',
    userOrStore: 'Kouassi Prestige Adjamé',
    userRole: 'seller',
    featureType: 'image',
    featureLabel: 'Création d’image : Packshot studio 360° bijoux or baoulé',
    model: 'RodiumAI — Qwen Image 2.1 Turbo',
    tokensUsed: 4800,
    unitsConsumed: 4,
    unitLabel: 'images HD',
    costFCFA: 50.0,
    revenueFCFA: 500,
    profitFCFA: 450.0,
    statusCode: 200,
    latencyMs: 910,
    endpoint: '/v1/images/generations'
  },
  {
    id: 'sub-api-403',
    planId: 'vendeur_elite',
    timestamp: '14:02:10',
    date: 'Aujourd’hui',
    userOrStore: 'Kouassi Prestige Adjamé',
    userRole: 'seller',
    featureType: 'chat',
    featureLabel: 'Discussion IA : Négociation VIP & stratégie pricing gros et détail',
    model: 'RodiumAI — MiniMax H3',
    tokensUsed: 4200,
    unitsConsumed: 4200,
    unitLabel: 'tokens',
    costFCFA: 63.0,
    revenueFCFA: 400,
    profitFCFA: 337.0,
    statusCode: 200,
    latencyMs: 230,
    endpoint: '/v1/chat/completions'
  },

  // --- Plan Client Plus (plus) ---
  {
    id: 'sub-api-601',
    planId: 'plus',
    timestamp: '14:30:10',
    date: 'Aujourd’hui',
    userOrStore: 'Sarah Koné',
    userRole: 'client',
    featureType: 'chat',
    featureLabel: 'Discussion IA : Conseils taille et pointure sandales cuir',
    model: 'RodiumAI — MiniMax M3.1 Flash',
    tokensUsed: 1100,
    unitsConsumed: 1100,
    unitLabel: 'tokens',
    costFCFA: 16.5,
    revenueFCFA: 120,
    profitFCFA: 103.5,
    statusCode: 200,
    latencyMs: 135,
    endpoint: '/v1/chat/completions'
  },
  {
    id: 'sub-api-602',
    planId: 'plus',
    timestamp: '13:45:00',
    date: 'Aujourd’hui',
    userOrStore: 'Brice N’Da',
    userRole: 'client',
    featureType: 'image',
    featureLabel: 'Création d’image : Aperçu casquette brodée personnalisée',
    model: 'RodiumAI — Qwen Image 2.1 Turbo',
    tokensUsed: 1000,
    unitsConsumed: 1,
    unitLabel: 'image HD',
    costFCFA: 10.0,
    revenueFCFA: 100,
    profitFCFA: 90.0,
    statusCode: 200,
    latencyMs: 440,
    endpoint: '/v1/images/generations'
  },

  // --- Plan Client Mini (mini) ---
  {
    id: 'sub-api-701',
    planId: 'mini',
    timestamp: '15:12:00',
    date: 'Aujourd’hui',
    userOrStore: 'Salimata Bamba',
    userRole: 'client',
    featureType: 'chat',
    featureLabel: 'Discussion IA : Découverte des boutiques wax Yopougon',
    model: 'RodiumAI — MiniMax M3.1 Flash',
    tokensUsed: 950,
    unitsConsumed: 950,
    unitLabel: 'tokens',
    costFCFA: 14.25,
    revenueFCFA: 50,
    profitFCFA: 35.75,
    statusCode: 200,
    latencyMs: 140,
    endpoint: '/v1/chat/completions'
  }
];

// =============================================================================
// INFRASTRUCTURE & CONSUMPTION TYPES AND HELPER
// =============================================================================

export interface InfrastructureItem {
  id: string;
  name: string;
  category: 'api' | 'storage' | 'server' | 'database';
  categoryLabel: string;
  provider: string;
  allocation: string;
  currentUsage: string;
  usagePercent: number;
  unitCostFcfa: number;
  unitCostFormatted: string;
  status: 'optimal' | 'moderate' | 'high';
  description: string;
  technicalSpecs: { label: string; value: string }[];
}

export function getPlanInfrastructureDetails(plan: AdminPlanItem): InfrastructureItem[] {
  if (plan.appType === 'client') {
    const isPremium = plan.id === 'premium';
    const isPlus = plan.id === 'plus';
    const isMini = plan.id === 'mini';

    return [
      {
        id: 'api-rodiumai',
        name: 'RodiumAI MiniMax & Qwen (Styliste Djassa)',
        category: 'api',
        categoryLabel: 'Consommation API',
        provider: 'RodiumAI Platform',
        allocation: isPremium ? '120 crédits IA (Haute vitesse)' : isPlus ? '60 crédits IA / mois' : isMini ? '30 crédits IA / mois' : '30 crédits IA / mois',
        currentUsage: isPremium ? '64 req/j en moyenne' : isPlus ? '48 req/j' : '19 req/j',
        usagePercent: isPremium ? 45 : isPlus ? 60 : 63,
        unitCostFcfa: isPremium ? 420 : isPlus ? 240 : 120,
        unitCostFormatted: isPremium ? '420 FCFA / user' : isPlus ? '240 FCFA / user' : '120 FCFA / user',
        status: 'optimal',
        description: 'Moteur de suggestions personnalisées, essayage virtuel Qwen Image 2.1 Turbo et assistant conversationnel.',
        technicalSpecs: [
          { label: 'Modèle', value: isPremium ? 'MiniMax H3 Max Turbo' : 'MiniMax M3.1 Flash' },
          { label: 'Latence p95', value: '185 ms' },
          { label: 'Concurrence', value: '50 req/sec max' },
          { label: 'SLA Uptime', value: '99.98%' }
        ]
      },
      {
        id: 'api-maps',
        name: 'Google Maps Routes & Geocoding API',
        category: 'api',
        categoryLabel: 'Consommation API',
        provider: 'Google Maps Platform',
        allocation: isPremium ? '150 géocodages / mois' : isPlus ? '90 géocodages / mois' : '40 géocodages / mois',
        currentUsage: isPremium ? '92 adresses' : isPlus ? '58 adresses' : '28 adresses',
        usagePercent: isPremium ? 61 : isPlus ? 64 : 70,
        unitCostFcfa: isPremium ? 180 : isPlus ? 110 : 60,
        unitCostFormatted: isPremium ? '180 FCFA / user' : isPlus ? '110 FCFA / user' : '60 FCFA / user',
        status: 'optimal',
        description: 'Localisation précise des communes d\'Abidjan et saisie simplifiée des adresses client pour le vendeur.',
        technicalSpecs: [
          { label: 'API endpoint', value: 'Geocoding API' },
          { label: 'Couverture', value: 'Abidjan + 15 villes intérieures' },
          { label: 'Cache géocode', value: 'TTL 7j' },
          { label: 'Taux succès', value: '99.94%' }
        ]
      },
      {
        id: 'api-fcm',
        name: 'Notifications Push Firebase Cloud Messaging (FCM)',
        category: 'api',
        categoryLabel: 'Consommation API',
        provider: 'Firebase Cloud Messaging (Notifications uniquement)',
        allocation: isPremium ? 'Illimité (Commandes & Promos)' : 'Push temps réel inclus',
        currentUsage: isPremium ? '14 push / mois' : '9 push / mois',
        usagePercent: isPremium ? 48 : 45,
        unitCostFcfa: 0,
        unitCostFormatted: '0 FCFA / user',
        status: 'optimal',
        description: 'Alertes push instantanées de confirmation de commande et de validation de paiement.',
        technicalSpecs: [
          { label: 'Délai d\'envoi', value: '< 1.2 sec' },
          { label: 'Protocole', value: 'FCM HTTP v1' },
          { label: 'Taux délivrabilité', value: '99.4%' }
        ]
      },
      {
        id: 'storage-cdn',
        name: 'Stockage R2 & Cloudflare CDN Edge Media',
        category: 'storage',
        categoryLabel: 'Stockage Cloud',
        provider: 'Cloudflare R2 + Cloudflare CDN Edge',
        allocation: isPremium ? '25 Go Bande passante / mois' : isPlus ? '15 Go / mois' : '5 Go / mois',
        currentUsage: isPremium ? '16.4 Go' : isPlus ? '9.8 Go' : '3.1 Go',
        usagePercent: isPremium ? 65 : isPlus ? 65 : 62,
        unitCostFcfa: isPremium ? 380 : isPlus ? 220 : 90,
        unitCostFormatted: isPremium ? '380 FCFA / user' : isPlus ? '220 FCFA / user' : '90 FCFA / user',
        status: 'optimal',
        description: 'Distribution ultra-rapide des photos haute définition des articles, caches lookbooks et vidéos défilés.',
        technicalSpecs: [
          { label: 'PoP Local', value: 'Edge Abidjan / Dakar' },
          { label: 'Compression', value: 'Auto-WebP & AVIF' },
          { label: 'Cache Hit Ratio', value: '94.2%' },
          { label: 'Egress R2', value: '0 F (Gratuit)' }
        ]
      },
      {
        id: 'storage-backups',
        name: 'Stockage Objets Cloudflare R2 & Archives',
        category: 'storage',
        categoryLabel: 'Stockage Cloud',
        provider: 'Cloudflare R2 Object Storage',
        allocation: isPremium ? '5 Go archives profil' : '1 Go archive',
        currentUsage: isPremium ? '2.8 Go' : '0.6 Go',
        usagePercent: isPremium ? 56 : 60,
        unitCostFcfa: 70,
        unitCostFormatted: '70 FCFA / user',
        status: 'optimal',
        description: 'Sauvegarde redondante des reçus PDF, médias et pièces justificatives.',
        technicalSpecs: [
          { label: 'Redondance', value: 'Cloudflare R2 Répliqué' },
          { label: 'Rétention', value: '365 jours' }
        ]
      },
      {
        id: 'server-backend',
        name: 'Instances Google Cloud Run Backend API',
        category: 'server',
        categoryLabel: 'Serveur / Backend',
        provider: 'Google Cloud Run (Node.js & Express)',
        allocation: isPremium ? 'Pool Dédié 1 vCPU / 2 Go RAM' : 'Cluster Partagé 0.5 vCPU',
        currentUsage: isPremium ? '54% charge CPU' : '48%',
        usagePercent: isPremium ? 54 : 48,
        unitCostFcfa: isPremium ? 550 : isPlus ? 340 : 150,
        unitCostFormatted: isPremium ? '550 FCFA / user' : isPlus ? '340 FCFA / user' : '150 FCFA / user',
        status: 'optimal',
        description: 'Microservices de gestion de panier, recherche instantanée, validation de paiement et WebSocket en direct.',
        technicalSpecs: [
          { label: 'Temps réponse p50', value: '42 ms' },
          { label: 'Temps réponse p99', value: '130 ms' },
          { label: 'Auto-scaling', value: '0 à 40 instances' },
          { label: 'Cold start', value: '< 280 ms' }
        ]
      },
      {
        id: 'db-postgres',
        name: 'Base de Données Relationnelle Supabase PostgreSQL',
        category: 'database',
        categoryLabel: 'Base de Données',
        provider: 'Supabase PostgreSQL v16 (RLS)',
        allocation: isPremium ? '1 500 requêtes SQL / jour' : isPlus ? '800 req / jour' : '300 req / jour',
        currentUsage: isPremium ? '890 req / jour' : isPlus ? '510 req / jour' : '220 req / jour',
        usagePercent: isPremium ? 59 : isPlus ? 63 : 73,
        unitCostFcfa: isPremium ? 480 : isPlus ? 290 : 110,
        unitCostFormatted: isPremium ? '480 FCFA / user' : isPlus ? '290 FCFA / user' : '110 FCFA / user',
        status: 'optimal',
        description: 'Stockage hautement sécurisé des transactions, comptes fidélité, factures et historiques avec RLS.',
        technicalSpecs: [
          { label: 'Moteur', value: 'PostgreSQL 16 (Supabase)' },
          { label: 'Sécurité', value: 'Row-Level Security (RLS)' },
          { label: 'Réplication', value: 'Haute Disponibilité' },
          { label: 'Pool de connexions', value: 'PgBouncer actif' }
        ]
      },
      {
        id: 'db-supabase-auth',
        name: 'Supabase Auth & Notifications Temps Réel',
        category: 'database',
        categoryLabel: 'Base de Données',
        provider: 'Supabase Auth + PostgreSQL Realtime',
        allocation: isPremium ? '50 000 lectures temps réel / mois' : '15 000 lectures / mois',
        currentUsage: isPremium ? '32 400 lectures' : '10 800 lectures',
        usagePercent: isPremium ? 64 : 72,
        unitCostFcfa: isPremium ? 320 : isPlus ? 190 : 80,
        unitCostFormatted: isPremium ? '320 FCFA / user' : isPlus ? '190 FCFA / user' : '80 FCFA / user',
        status: 'optimal',
        description: 'Synchronisation des articles dans le panier, authentification JWT et statuts de commandes.',
        technicalSpecs: [
          { label: 'Latence SQL', value: '< 5 ms' },
          { label: 'Protection', value: 'Cloudflare WAF + RLS' }
        ]
      }
    ];
  } else {
    const isElite = plan.id === 'vendeur_elite';
    const isPro = plan.id === 'vendeur_pro';

    return [
      {
        id: 'api-rodium-video',
        name: 'Générateur Vidéo IA Défilés 5s (RodiumAI)',
        category: 'api',
        categoryLabel: 'Consommation API',
        provider: 'RodiumAI — MiniMax H3 Max Turbo',
        allocation: isElite ? '150 crédits vidéo / mois' : isPro ? '60 crédits vidéo / mois' : '15 crédits vidéo / mois',
        currentUsage: isElite ? '112 vidéos générées' : isPro ? '44 vidéos générées' : '12 vidéos générées',
        usagePercent: isElite ? 74 : isPro ? 73 : 80,
        unitCostFcfa: isElite ? 3200 : isPro ? 1800 : 700,
        unitCostFormatted: isElite ? '3 200 FCFA / vendeur' : isPro ? '1 800 FCFA / vendeur' : '700 FCFA / vendeur',
        status: 'moderate',
        description: 'Transformation automatique des photos d\'habits en défilés mannequins animés réalistes 1080p.',
        technicalSpecs: [
          { label: 'Résolution', value: '1080p HD 30fps' },
          { label: 'Temps rendu', value: '~45 secondes / vidéo' },
          { label: 'File de rendu', value: 'File prioritaire Marchand' },
          { label: 'Modèle', value: 'MiniMax H3 Max Turbo' }
        ]
      },
      {
        id: 'api-rodium-studio',
        name: 'RodiumAI Qwen Image 2.1 Turbo & MiniMax H3 (Studio Photo)',
        category: 'api',
        categoryLabel: 'Consommation API',
        provider: 'RodiumAI Platform',
        allocation: isElite ? '800 retouches photos / mois' : isPro ? '350 retouches / mois' : '120 retouches / mois',
        currentUsage: isElite ? '540 retouches' : isPro ? '265 retouches' : '88 retouches',
        usagePercent: isElite ? 67 : isPro ? 75 : 73,
        unitCostFcfa: isElite ? 950 : isPro ? 520 : 250,
        unitCostFormatted: isElite ? '950 FCFA / vendeur' : isPro ? '520 FCFA / vendeur' : '250 FCFA / vendeur',
        status: 'optimal',
        description: 'Génération visuelle studio, essayage virtuel Qwen Image 2.1 Turbo et rédaction automatique de fiches produits.',
        technicalSpecs: [
          { label: 'Image Studio', value: 'Qwen Image 2.1 Turbo' },
          { label: 'Vitesse de traitement', value: '< 1.8 sec' },
          { label: 'Génération texte', value: 'MiniMax H3 / M3.1 Flash' }
        ]
      },
      {
        id: 'api-momo-webhooks',
        name: 'Webhooks GeniusPay & Réconciliation',
        category: 'api',
        categoryLabel: 'Consommation API',
        provider: 'GeniusPay (Wave CI, Orange Money, MTN MoMo, Moov)',
        allocation: 'Illimité (Transactions Marchand)',
        currentUsage: isElite ? '1 480 webhooks / mois' : isPro ? '620 webhooks / mois' : '240 webhooks / mois',
        usagePercent: 55,
        unitCostFcfa: isElite ? 450 : isPro ? 250 : 150,
        unitCostFormatted: isElite ? '450 FCFA / vendeur' : isPro ? '250 FCFA / vendeur' : '150 FCFA / vendeur',
        status: 'optimal',
        description: 'Confirmation instantanée des encaissements marchands GeniusPay, notifications push FCM et reçus signés.',
        technicalSpecs: [
          { label: 'Signature', value: 'HMAC SHA-256 crypté' },
          { label: 'Retry backoff', value: 'Exponentiel (5 tentatives)' },
          { label: 'Taux succès', value: '99.97%' }
        ]
      },
      {
        id: 'storage-products-r2',
        name: 'Cloudflare R2 Boutique (Catalogue 4K & Médias)',
        category: 'storage',
        categoryLabel: 'Stockage Cloud',
        provider: 'Cloudflare R2 Storage',
        allocation: isElite ? '100 Go Stockage Photos & Vidéos' : isPro ? '40 Go' : '10 Go',
        currentUsage: isElite ? '68.5 Go utilisé' : isPro ? '28.2 Go' : '6.4 Go',
        usagePercent: isElite ? 68 : isPro ? 70 : 64,
        unitCostFcfa: isElite ? 1100 : isPro ? 620 : 280,
        unitCostFormatted: isElite ? '1 100 FCFA / vendeur' : isPro ? '620 FCFA / vendeur' : '280 FCFA / vendeur',
        status: 'optimal',
        description: 'Hébergement haute disponibilité sur Cloudflare R2 pour le catalogue, photos d\'articles et vidéos.',
        technicalSpecs: [
          { label: 'Type stockage', value: 'Cloudflare R2 Compatible S3' },
          { label: 'Bande passante CDN', value: 'Illimitée (0 F Egress)' },
          { label: 'Intégrité', value: 'Checksum MD5 par fichier' }
        ]
      },
      {
        id: 'server-inventory-engine',
        name: 'Moteur Cloud Run Inventaire & Commandes Marchand',
        category: 'server',
        categoryLabel: 'Serveur / Backend',
        provider: 'Google Cloud Run Clusters',
        allocation: isElite ? 'Worker dédié 1.5 vCPU / 4 Go RAM' : isPro ? 'Worker 1 vCPU / 2 Go RAM' : 'Instance partagée',
        currentUsage: isElite ? '58% de charge CPU' : isPro ? '52%' : '44%',
        usagePercent: isElite ? 58 : isPro ? 52 : 44,
        unitCostFcfa: isElite ? 1350 : isPro ? 780 : 380,
        unitCostFormatted: isElite ? '1 350 FCFA / vendeur' : isPro ? '780 FCFA / vendeur' : '380 FCFA / vendeur',
        status: 'optimal',
        description: 'Calcul des stocks en direct, gestion multi-tailles/multi-couleurs, alertes de réapprovisionnement et exportations.',
        technicalSpecs: [
          { label: 'Capacité req/s', value: isElite ? '1 200 req/sec' : '500 req/sec' },
          { label: 'Temps de cycle', value: '28 ms' },
          { label: 'Auto-guérison', value: 'Healthcheck actif toutes les 10s' }
        ]
      },
      {
        id: 'db-postgres-merchant',
        name: 'PostgreSQL Supabase Marchands & Comptabilité',
        category: 'database',
        categoryLabel: 'Base de Données',
        provider: 'Supabase PostgreSQL Enterprise',
        allocation: isElite ? 'Tables partitionnées & 5 000 écritures/j' : '2 000 écritures/j',
        currentUsage: isElite ? '3 420 écritures/j' : '1 380 écritures/j',
        usagePercent: isElite ? 68 : isPro ? 69 : 60,
        unitCostFcfa: isElite ? 950 : isPro ? 580 : 280,
        unitCostFormatted: isElite ? '950 FCFA / vendeur' : isPro ? '580 FCFA / vendeur' : '280 FCFA / vendeur',
        status: 'optimal',
        description: 'Journal de caisse certifié, historique des versements GeniusPay et factures téléchargeables.',
        technicalSpecs: [
          { label: 'Sauvegardes', value: 'Quotidiennes + PITR 7j' },
          { label: 'Chiffrement', value: 'AES-256 au repos' },
          { label: 'Sécurité', value: 'Row-Level Security (RLS)' }
        ]
      }
    ];
  }
}

export interface AdminSubscriptionsManagerProps {
  onBack?: () => void;
}

export const AdminSubscriptionsManager: React.FC<AdminSubscriptionsManagerProps> = ({ onBack }) => {
  const { showToast, addAuditLog, adminUsers, sellers } = useApp();

  // Active App Selector: 'client' | 'seller' | 'all'
  const [selectedApp, setSelectedApp] = useState<'client' | 'seller' | 'all'>('client');

  // Plans data state (persisted)
  const [plans, setPlans] = useState<AdminPlanItem[]>(() => {
    const sanitizePlans = (list: AdminPlanItem[]) => {
      return list.filter(p => p.id !== 'pro' && (p.appType as string) !== 'company' && !p.id.startsWith('flotte_')).map(p => {
        if (p.appType === 'client') {
          const caps = { ...p.capabilities };
          delete caps.videosCount;
          delete caps.storageCount;
          delete caps.mapViewsCount;
          delete caps.routeCalcCount;

          if (p.id === 'gratuit' || p.id === 'mini' || p.name === 'DJASSA Mini') {
            caps.questionsCount = '30 questions IA';
            caps.questionsDetail = 'Pour poser des questions à l\'assistant';
            caps.imagesCount = '2 créations d’images (générées par l’IA)';
            return {
              ...p,
              id: 'mini',
              name: 'DJASSA Mini',
              badge: 'Découverte',
              priceFcfa: 300,
              period: 'par mois',
              creditsGranted: 30,
              tagline: '30 crédits pour poser vos questions à l’assistant & créations IA',
              capabilities: caps
            };
          } else if (p.id === 'go' || p.name === 'DJASSA Plus' || (p.id === 'plus' && p.priceFcfa !== 1200 && p.priceFcfa !== 500 && p.name !== 'DJASSA Premium')) {
            caps.questionsCount = '60 questions IA';
            caps.questionsDetail = 'Pour poser des questions à l\'assistant & conseils shopping';
            caps.imagesCount = '5 créations d’images';
            return {
              ...p,
              id: 'plus',
              name: 'DJASSA Plus',
              badge: 'LE PLUS POPULAIRE CLIENT',
              isPopular: true,
              priceFcfa: 600,
              period: 'par mois',
              creditsGranted: 60,
              tagline: '60 crédits IA pour vos recherches et créations d’images studio',
              capabilities: caps
            };
          } else if (p.id === 'premium' || p.name === 'DJASSA Premium' || p.priceFcfa === 500 || p.priceFcfa === 1200 || p.priceFcfa === 6500) {
            caps.questionsCount = '120 questions IA';
            caps.questionsDetail = 'Accès haute vitesse assistant IA & styliste dédié';
            caps.imagesCount = '12 créations d’images';
            return {
              ...p,
              id: 'premium',
              name: 'DJASSA Premium',
              badge: 'VIP Shopping',
              isPopular: false,
              priceFcfa: 1200,
              period: 'par mois',
              creditsGranted: 120,
              tagline: '120 crédits IA haute vitesse et créations d’images haute définition',
              capabilities: caps
            };
          }
          return { ...p, capabilities: caps };
        }
        return p;
      });
    };

    const saved = localStorage.getItem('djassa_admin_managed_plans');
    if (saved) {
      try {
        const parsed: AdminPlanItem[] = JSON.parse(saved);
        return sanitizePlans(parsed);
      } catch {
        return sanitizePlans(INITIAL_ADMIN_PLANS);
      }
    }
    return sanitizePlans(INITIAL_ADMIN_PLANS);
  });

  // Subscribers data state (persisted)
  const [subscribers, setSubscribers] = useState<SubscriberProfile[]>(() => {
    const saved = localStorage.getItem('djassa_admin_subscriber_profiles');
    let raw: SubscriberProfile[] = saved ? JSON.parse(saved) : INITIAL_SUBSCRIBER_PROFILES;

    // Merge any missing initial profiles to guarantee complete dataset for all roles
    const existingIds = new Set(raw.map(s => s.id));
    INITIAL_SUBSCRIBER_PROFILES.forEach(initSub => {
      if (!existingIds.has(initSub.id)) {
        raw.push(initSub);
      }
    });

    return raw
      .filter(s => (s.role as string) !== 'company' && !String(s.planId || '').startsWith('flotte_'))
      .map(s => {
        let updated = { ...s };
        // Explicit known completed profiles
        const knownCompleted = ['sub-cli-4', 'sub-cli-6', 'sub-cli-8', 'sub-sel-5', 'sub-sel-6', 'sub-sel-8'];
        if (knownCompleted.includes(updated.id)) {
          updated.status = 'completed';
          updated.creditsRemaining = 0;
          updated.autoRenew = false;
        }

        if (!updated.purchaseTime) {
          if (updated.id === 'sub-cli-7') updated.purchaseTime = '14:32';
          else if (updated.id === 'sub-cli-1') updated.purchaseTime = '10:15';
          else if (updated.id === 'sub-cli-2') updated.purchaseTime = '11:40';
          else if (updated.id === 'sub-cli-3') updated.purchaseTime = '16:20';
          else if (updated.id === 'sub-cli-4') updated.purchaseTime = '09:05';
          else if (updated.id === 'sub-cli-5') updated.purchaseTime = '15:10';
          else if (updated.id === 'sub-cli-6') updated.purchaseTime = '18:50';
          else updated.purchaseTime = '14:30';
        }
        if (updated.planId === 'gratuit' || updated.planId === 'mini' || updated.planName === 'DJASSA Mini') {
          updated.planId = 'mini';
          updated.planName = 'DJASSA Mini';
          updated.amountPaid = 300;
          updated.creditsTotal = 30;
          if (updated.status !== 'completed' && updated.creditsRemaining > 30) {
            updated.creditsRemaining = 30;
          }
        }
        if (updated.planId === 'go') {
          updated.planId = 'plus';
          updated.planName = 'DJASSA Plus';
          updated.amountPaid = 600;
          updated.creditsTotal = 60;
          if (updated.status !== 'completed' && updated.creditsRemaining > 60) updated.creditsRemaining = 55;
        }
        if ((updated.planId === 'plus' || updated.planName === 'DJASSA Plus') && updated.role === 'client') {
          if (updated.amountPaid === 500 || updated.amountPaid === 1200) {
            updated.planId = 'premium';
            updated.planName = 'DJASSA Premium';
            updated.amountPaid = 1200;
            updated.creditsTotal = 120;
            if (updated.status !== 'completed' && updated.creditsRemaining > 120) updated.creditsRemaining = 100;
          } else {
            updated.planName = 'DJASSA Plus';
            updated.amountPaid = 600;
            updated.creditsTotal = 60;
            if (updated.status !== 'completed' && updated.creditsRemaining > 60) updated.creditsRemaining = 50;
          }
        }
        if (updated.planId === 'premium' || updated.planName === 'DJASSA Premium') {
          updated.planName = 'DJASSA Premium';
          updated.amountPaid = 1200;
          updated.creditsTotal = 120;
          if (updated.status !== 'completed' && updated.creditsRemaining > 120) updated.creditsRemaining = 100;
        }
        if (updated.planId === 'pro') updated = { ...updated, planId: 'plus', planName: 'DJASSA Plus', amountPaid: 600, creditsTotal: 60 };
        return updated;
      });
  });

  // Modal 1: Detailed Subscribers List Modal
  const [selectedPlanForDetails, setSelectedPlanForDetails] = useState<AdminPlanItem | null>(null);
  const [subscriberSearchTerm, setSubscriberSearchTerm] = useState('');
  const [subscriberStatusFilter, setSubscriberStatusFilter] = useState<'all' | 'active' | 'expiring_soon' | 'completed'>('all');

  // State: Detailed user profile to view (Seller, Client)
  const [selectedSubscriberProfile, setSelectedSubscriberProfile] = useState<AdminUserRecord | null>(null);

  const handleOpenSubscriberProfile = (sub: SubscriberProfile) => {
    const cleanSubPhone = sub.phone.replace(/\D/g, '');
    const cleanSubName = sub.name.toLowerCase();

    const matchedUser = adminUsers.find(u => {
      const cleanUserPhone = u.phone.replace(/\D/g, '');
      if (cleanSubPhone && cleanUserPhone && cleanSubPhone === cleanUserPhone) return true;
      if (u.name.toLowerCase() === cleanSubName) return true;
      if (u.storeName && cleanSubName.includes(u.storeName.toLowerCase())) return true;
      if (cleanSubName.includes(u.name.toLowerCase())) return true;
      return false;
    });

    if (matchedUser) {
      setSelectedSubscriberProfile(matchedUser);
      showToast(`Profil de ${matchedUser.name} ouvert 👤`);
      return;
    }

    if (sub.role === 'seller') {
      const matchedSeller = sellers.find(s => 
        cleanSubName.includes(s.name.toLowerCase()) || 
        (s.storeName && cleanSubName.includes(s.storeName.toLowerCase())) ||
        s.phone.replace(/\D/g, '') === cleanSubPhone
      );

      const generatedSellerUser: AdminUserRecord = {
        id: `user-seller-${matchedSeller?.id || sub.id}`,
        name: matchedSeller?.name || sub.name.replace(/\s*\(.*?\)/g, ''),
        username: matchedSeller?.username || sub.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 18),
        email: matchedSeller?.email || `contact.${sub.id.toLowerCase()}@djassa.ci`,
        phone: sub.phone,
        role: 'seller',
        status: 'active',
        avatar: matchedSeller?.avatar || sub.avatar,
        createdAt: '2026-01-15',
        registeredDaysAgo: 240,
        location: matchedSeller?.location || (sub.commune ? `${sub.commune}, Abidjan` : 'Adjamé Forum des Marchés, Abidjan'),
        ordersCount: matchedSeller?.salesCount || 340,
        totalSpentOrEarned: sub.amountPaid * 10,
        kycVerified: true,
        storeName: matchedSeller?.storeName || sub.name,
        bio: matchedSeller?.bio || `Boutique certifiée sur Djassa Marketplace. Ventes régulières et encaissements sécurisés.`,
        banner: matchedSeller?.banner || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800',
        dailyAverageMinutes: 195,
        timeTodayMinutes: 140,
        weeklyUsage: [
          { day: 'Lun', minutes: 190 },
          { day: 'Mar', minutes: 210 },
          { day: 'Mer', minutes: 180 },
          { day: 'Jeu', minutes: 230 },
          { day: 'Ven', minutes: 240 },
          { day: 'Sam', minutes: 260 },
          { day: 'Dim', minutes: 140 }
        ],
        kycDocument: {
          type: 'rccm',
          number: 'CI-ABJ-2024-B-48902',
          submittedAt: '2026-01-16',
          documentUrl: 'https://djassa.ci/docs/kyc-rccm.pdf'
        }
      };

      setSelectedSubscriberProfile(generatedSellerUser);
      showToast(`Profil du vendeur ${generatedSellerUser.name} ouvert 👤`);
      return;
    }

    const generatedUser: AdminUserRecord = {
      id: `user-${sub.role}-${sub.id}`,
      name: sub.name,
      username: sub.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 18),
      email: `${sub.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@djassa.ci`,
      phone: sub.phone,
      role: sub.role,
      status: 'active',
      avatar: sub.avatar,
      createdAt: '2026-02-01',
      registeredDaysAgo: 215,
      location: sub.commune ? `${sub.commune}, Abidjan` : 'Abidjan',
      ordersCount: sub.role === 'client' ? 18 : 650,
      totalSpentOrEarned: sub.amountPaid * 12,
      kycVerified: true,
      storeName: undefined,
      bio: `Abonné actif à l’offre ${sub.planName} avec solde de ${sub.creditsRemaining} crédits IA.`,
      dailyAverageMinutes: 140,
      timeTodayMinutes: 85,
      kycDocument: {
        type: 'cni',
        number: 'CI-ABJ-2024-' + Math.floor(100000 + Math.random() * 900000),
        submittedAt: sub.startDate,
        documentUrl: 'https://djassa.ci/docs/kyc.pdf'
      }
    };

    setSelectedSubscriberProfile(generatedUser);
    showToast(`Profil de ${generatedUser.name} ouvert 👤`);
  };

  // 3 Status Tabs: 'in_progress' | 'completed' | 'history'
  const [statusTab, setStatusTab] = useState<'in_progress' | 'completed' | 'history'>('in_progress');

  // Modal: Plan Infrastructure & Consumption Breakdown Modal (Demandé par l'admin)
  const [selectedPlanForConsumption, setSelectedPlanForConsumption] = useState<AdminPlanItem | null>(null);
  const [consumptionCategoryFilter, setConsumptionCategoryFilter] = useState<'all' | 'api' | 'storage' | 'server' | 'database'>('all');
  const [consumptionSearchTerm, setConsumptionSearchTerm] = useState('');

  // Subscription API Consumption Management states
  const [apiRecords, setApiRecords] = useState<SubscriptionApiRecord[]>(() => {
    const saved = localStorage.getItem('djassa_admin_subscription_api_records_v3');
    if (saved) {
      try {
        const raw = JSON.parse(saved) as SubscriptionApiRecord[];
        if (Array.isArray(raw) && raw.some(r => r.model?.includes('Rodium IA'))) {
          return raw;
        }
      } catch (e) {
        // fallback
      }
    }
    return INITIAL_SUBSCRIPTION_API_RECORDS;
  });
  const [apiActiveModuleTab, setApiActiveModuleTab] = useState<'all' | 'chat' | 'image' | 'video' | 'other'>('all');
  const [apiSearchQuery, setApiSearchQuery] = useState('');
  const [isSimulatingApi, setIsSimulatingApi] = useState(false);
  const [isAdjustingQuotas, setIsAdjustingQuotas] = useState(false);
  const [editingQuotas, setEditingQuotas] = useState<{
    questionsCount: string;
    imagesCount: string;
    videosCount: string;
    economyMode: boolean;
  }>({
    questionsCount: '',
    imagesCount: '',
    videosCount: '',
    economyMode: true
  });

  const saveApiRecords = (next: SubscriptionApiRecord[]) => {
    setApiRecords(next);
    localStorage.setItem('djassa_admin_subscription_api_records_v3', JSON.stringify(next));
  };

  // Modal 2: Edit Plan Modal
  const [editingPlan, setEditingPlan] = useState<AdminPlanItem | null>(null);

  // Modal 3: Manual Subscribe Modal
  const [isManualSubscribeOpen, setIsManualSubscribeOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    name: '',
    phone: '+225 ',
    commune: 'Cocody',
    planId: 'vendeur_pro',
    paymentMethod: 'Wave' as 'Wave' | 'Orange Money' | 'MTN MoMo' | 'Carte Bancaire'
  });

  const savePlans = (next: AdminPlanItem[]) => {
    const sanitized = next.filter(p => p.id !== 'pro' && (p.appType as string) !== 'company' && !p.id.startsWith('flotte_')).map(p => {
      if (p.appType === 'client') {
        const caps = { ...p.capabilities };
        delete caps.videosCount;
        delete caps.storageCount;
        delete caps.mapViewsCount;
        delete caps.routeCalcCount;

        if (p.id === 'gratuit' || p.id === 'mini' || p.name === 'DJASSA Mini') {
          caps.questionsCount = '30 questions IA';
          caps.questionsDetail = 'Pour poser des questions à l\'assistant';
          caps.imagesCount = '2 créations d’images (générées par l’IA)';
          return {
            ...p,
            id: 'mini',
            name: 'DJASSA Mini',
            badge: 'Découverte',
            priceFcfa: 300,
            period: 'par mois',
            creditsGranted: 30,
            tagline: '30 crédits pour poser vos questions à l’assistant & créations IA',
            capabilities: caps
          };
        } else if (p.id === 'go' || p.name === 'DJASSA Plus' || (p.id === 'plus' && p.priceFcfa !== 1200 && p.priceFcfa !== 500 && p.name !== 'DJASSA Premium')) {
          caps.questionsCount = '60 questions IA';
          caps.questionsDetail = 'Pour poser des questions à l\'assistant & conseils shopping';
          caps.imagesCount = '5 créations d’images';
          return {
            ...p,
            id: 'plus',
            name: 'DJASSA Plus',
            badge: 'LE PLUS POPULAIRE CLIENT',
            isPopular: true,
            priceFcfa: 600,
            period: 'par mois',
            creditsGranted: 60,
            tagline: '60 crédits IA pour vos recherches et créations d’images studio',
            capabilities: caps
          };
        } else if (p.id === 'premium' || p.name === 'DJASSA Premium' || p.priceFcfa === 500 || p.priceFcfa === 1200 || p.priceFcfa === 6500) {
          caps.questionsCount = '120 questions IA';
          caps.questionsDetail = 'Accès haute vitesse assistant IA & styliste dédié';
          caps.imagesCount = '12 créations d’images';
          return {
            ...p,
            id: 'premium',
            name: 'DJASSA Premium',
            badge: 'VIP Shopping',
            isPopular: false,
            priceFcfa: 1200,
            period: 'par mois',
            creditsGranted: 120,
            tagline: '120 crédits IA haute vitesse et créations d’images haute définition',
            capabilities: caps
          };
        }
        return { ...p, capabilities: caps };
      }
      return p;
    });
    setPlans(sanitized);
    localStorage.setItem('djassa_admin_managed_plans', JSON.stringify(sanitized));
  };

  const saveSubscribers = (next: SubscriberProfile[]) => {
    setSubscribers(next);
    localStorage.setItem('djassa_admin_subscriber_profiles', JSON.stringify(next));
  };

  // ===========================================================================
  // CALCULATIONS & COUNTS PER PLAN
  // ===========================================================================

  // Map subscriber counts and total revenue generated for each plan, FILTERED BY statusTab
  const planStats = useMemo(() => {
    const stats: Record<string, { count: number; totalMonthlyFcfa: number }> = {};
    plans.forEach(p => {
      stats[p.id] = { count: 0, totalMonthlyFcfa: 0 };
    });

    subscribers.forEach(sub => {
      // STRICT FILTER BY statusTab: No completed in En cours, no active in Terminé!
      if (statusTab === 'in_progress' && !isSubscriptionInProgress(sub.status)) return;
      if (statusTab === 'completed' && !isSubscriptionCompleted(sub.status)) return;

      if (stats[sub.planId]) {
        stats[sub.planId].count += 1;
        stats[sub.planId].totalMonthlyFcfa += sub.amountPaid;
      }
    });

    return stats;
  }, [plans, subscribers, statusTab]);

  // App-specific counts & financial metrics filtered according to the active statusTab
  const appTabStats = useMemo(() => {
    const filterByRole = (role: 'client' | 'seller') => {
      return subscribers.filter(s => {
        if (s.role !== role) return false;
        if (statusTab === 'in_progress') return isSubscriptionInProgress(s.status);
        if (statusTab === 'completed') return isSubscriptionCompleted(s.status);
        return true; // history
      });
    };

    const clientSubs = filterByRole('client');
    const sellerSubs = filterByRole('seller');

    const clientRev = clientSubs.reduce((sum, s) => sum + s.amountPaid, 0);
    const sellerRev = sellerSubs.reduce((sum, s) => sum + s.amountPaid, 0);

    return {
      client: { count: clientSubs.length, revenue: clientRev, profit: Math.round(clientRev * 0.88) },
      seller: { count: sellerSubs.length, revenue: sellerRev, profit: Math.round(sellerRev * 0.88) }
    };
  }, [subscribers, statusTab]);

  // Overall subscribers count and MRR (all time)
  const totalSubscribersCount = subscribers.length;
  const totalMRR = subscribers.reduce((sum, s) => sum + s.amountPaid, 0);

  const clientSubscribersCount = appTabStats.client.count;
  const sellerSubscribersCount = appTabStats.seller.count;

  const clientRevenue = appTabStats.client.revenue;
  const sellerRevenue = appTabStats.seller.revenue;

  // Filter plans based on selected application tab
  const filteredPlans = useMemo(() => {
    if (selectedApp === 'all') return plans;
    return plans.filter(p => p.appType === selectedApp);
  }, [plans, selectedApp]);

  // Metadata for the active application tab (Nombre d'abonnés, Argent gagné)
  const currentTabMeta = useMemo(() => {
    switch (selectedApp) {
      case 'seller':
        return {
          title: 'App Vendeurs (Boutiques)',
          subscribersCount: sellerSubscribersCount,
          subscribersUnit: 'boutiques',
          revenue: sellerRevenue,
          forfaitsCount: plans.filter(p => p.appType === 'seller').length,
          forfaitsLabel: 'Starter, Pro & Élite',
          glowColor: 'bg-amber-500/20',
          gradientBg: 'from-amber-950/70 via-[#191512] to-[#101012]',
          borderColor: 'border-amber-500/30 hover:border-amber-500/60',
          textColor: 'text-amber-400',
          badgeBg: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
          iconBg: 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
        };
      case 'client':
      default:
        return {
          title: 'App Clients (Acheteurs)',
          subscribersCount: clientSubscribersCount,
          subscribersUnit: 'clients',
          revenue: clientRevenue,
          forfaitsCount: plans.filter(p => p.appType === 'client').length,
          forfaitsLabel: 'Mini, Plus & Premium',
          glowColor: 'bg-purple-500/20',
          gradientBg: 'from-purple-950/70 via-[#16121f] to-[#101012]',
          borderColor: 'border-purple-500/30 hover:border-purple-500/60',
          textColor: 'text-purple-400',
          badgeBg: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
          iconBg: 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
        };
    }
  }, [selectedApp, clientSubscribersCount, clientRevenue, sellerSubscribersCount, sellerRevenue, plans]);

  // Statistics for the 3 Status Tabs: En cours, Terminé, Historique
  const statusStats = useMemo(() => {
    const pool = selectedApp === 'all' 
      ? subscribers 
      : subscribers.filter(s => s.role === selectedApp);

    const inProgressList = pool.filter(s => isSubscriptionInProgress(s.status));
    const completedList = pool.filter(s => isSubscriptionCompleted(s.status));
    const totalList = pool;

    const inProgressEarned = inProgressList.reduce((sum, s) => sum + s.amountPaid, 0);
    const completedEarned = completedList.reduce((sum, s) => sum + s.amountPaid, 0);
    const totalEarned = totalList.reduce((sum, s) => sum + s.amountPaid, 0);

    return {
      in_progress: {
        count: inProgressList.length,
        earned: inProgressEarned,
        profit: Math.round(inProgressEarned * 0.88),
        label: 'En cours',
        badge: 'Actifs en cours',
        color: 'text-emerald-400',
        borderColor: 'border-emerald-500/40',
        bgGradient: 'from-emerald-950/70 via-[#101b13] to-[#101012]'
      },
      completed: {
        count: completedList.length,
        earned: completedEarned,
        profit: Math.round(completedEarned * 0.88),
        label: 'Terminé',
        badge: 'Période achevée',
        color: 'text-indigo-400',
        borderColor: 'border-indigo-500/40',
        bgGradient: 'from-indigo-950/70 via-[#131221] to-[#101012]'
      },
      refunded: {
        count: 0,
        earned: 0,
        profit: 0,
        label: 'Remboursé',
        badge: 'Résilié',
        color: 'text-rose-400',
        borderColor: 'border-rose-500/40',
        bgGradient: 'from-rose-950/70 via-[#1c1214] to-[#101012]'
      },
      history: {
        count: totalList.length,
        earned: totalEarned,
        profit: Math.round(totalList.reduce((sum, s) => sum + (s.status !== 'overdue' ? s.amountPaid * 0.88 : 0), 0)),
        label: 'Historique',
        badge: 'Tous abonnements',
        color: 'text-sky-400',
        borderColor: 'border-sky-500/40',
        bgGradient: 'from-sky-950/70 via-[#101824] to-[#101012]'
      }
    };
  }, [subscribers, selectedApp]);

  // Subscribers for the active modal with STRICT separation according to statusTab
  const modalSubscribersList = useMemo(() => {
    if (!selectedPlanForDetails) return [];
    return subscribers.filter(s => {
      const matchesPlan = s.planId === selectedPlanForDetails.id;
      const matchesSearch = 
        s.name.toLowerCase().includes(subscriberSearchTerm.toLowerCase()) ||
        s.phone.toLowerCase().includes(subscriberSearchTerm.toLowerCase()) ||
        s.commune.toLowerCase().includes(subscriberSearchTerm.toLowerCase());
      
      // STRICT FILTER BY statusTab: No completed in En cours, and no active in Terminé!
      if (statusTab === 'in_progress' && !isSubscriptionInProgress(s.status)) return false;
      if (statusTab === 'completed' && !isSubscriptionCompleted(s.status)) return false;

      // Filter within modal toolbar
      if (subscriberStatusFilter === 'active' && s.status !== 'active') return false;
      if (subscriberStatusFilter === 'expiring_soon' && s.status !== 'expiring_soon') return false;
      if (subscriberStatusFilter === 'completed' && !isSubscriptionCompleted(s.status)) return false;

      return matchesPlan && matchesSearch;
    });
  }, [subscribers, selectedPlanForDetails, subscriberSearchTerm, subscriberStatusFilter, statusTab]);

  // ===========================================================================
  // ACTIONS ON SUBSCRIBERS
  // ===========================================================================

  const handleTerminateSubscription = (sub: SubscriberProfile) => {
    const next = subscribers.map(s => s.id === sub.id ? { ...s, status: 'completed' as const, autoRenew: false } : s);
    saveSubscribers(next);
    addAuditLog(
      'Fin d\'Abonnement',
      sub.name,
      'financial',
      `Forfait ${sub.planName} clôturé (marqué comme terminé)`
    );
    showToast(`L'abonnement de ${sub.name} a été marqué comme terminé.`);
  };

  const handleReactivateSubscription = (sub: SubscriberProfile) => {
    const next = subscribers.map(s => s.id === sub.id ? {
      ...s,
      status: 'active' as const,
      autoRenew: true,
      startDate: 'Aujourd’hui',
      purchaseTime: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      renewalDate: '17 Nov 2026',
      creditsRemaining: s.creditsTotal,
      mapViewsRemaining: s.mapViewsTotal,
      routeCalcRemaining: s.routeCalcTotal,
      geocodingRemaining: s.geocodingTotal
    } : s);
    saveSubscribers(next);
    addAuditLog(
      'Réactivation Abonnement',
      sub.name,
      'financial',
      `Abonnement ${sub.planName} réactivé avec succès`
    );
    showToast(`L'abonnement de ${sub.name} a été réactivé en cours.`);
  };

  const handleCancelSubscription = (sub: SubscriberProfile) => {
    const next = subscribers.filter(s => s.id !== sub.id);
    saveSubscribers(next);
    addAuditLog(
      'Résiliation Abonnement',
      sub.name,
      'financial',
      `Forfait ${sub.planName} résilié par l'administrateur`
    );
    showToast(`Abonnement de ${sub.name} supprimé.`);
  };

  // ===========================================================================
  // ACTIONS ON PLANS
  // ===========================================================================

  const handleSaveEditedPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    const next = plans.map(p => p.id === editingPlan.id ? editingPlan : p);
    savePlans(next);
    addAuditLog(
      'Modification Paramètres Forfait',
      editingPlan.name,
      'financial',
      `Nouveau prix: ${formatFCFA(editingPlan.priceFcfa)} • Crédits: ${editingPlan.creditsGranted}`
    );
    showToast(`Forfait "${editingPlan.name}" mis à jour avec succès ✅`);
    setEditingPlan(null);
  };

  const handleTogglePlanActive = (planId: string) => {
    const next = plans.map(p => p.id === planId ? { ...p, isActive: !p.isActive } : p);
    savePlans(next);
    const updated = next.find(p => p.id === planId);
    showToast(`Forfait ${updated?.name} ${updated?.isActive ? 'activé' : 'désactivé'} pour les nouvelles souscriptions`);
  };

  const handleManualSubscribeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetPlan = plans.find(p => p.id === manualForm.planId) || plans[0];
    const newSub: SubscriberProfile = {
      id: 'sub-' + Date.now(),
      name: manualForm.name.trim() || 'Nouvel Abonné',
      role: targetPlan.appType,
      appType: targetPlan.appType === 'client' ? 'Client' : 'Vendeur',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
      phone: manualForm.phone.trim(),
      commune: manualForm.commune,
      planId: targetPlan.id,
      planName: targetPlan.name,
      startDate: 'Aujourd’hui',
      purchaseTime: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      renewalDate: '17 Nov 2026',
      amountPaid: targetPlan.priceFcfa,
      paymentMethod: manualForm.paymentMethod,
      creditsTotal: targetPlan.creditsGranted,
      creditsRemaining: targetPlan.creditsGranted,
      status: 'active',
      autoRenew: true
    };

    const next = [newSub, ...subscribers];
    saveSubscribers(next);
    addAuditLog(
      'Attribution Manuelle Abonnement',
      newSub.name,
      'financial',
      `Souscription manuelle au forfait ${targetPlan.name} (${formatFCFA(targetPlan.priceFcfa)})`
    );
    showToast(`✅ ${newSub.name} a été abonné avec succès au forfait ${targetPlan.name} !`);
    setIsManualSubscribeOpen(false);
    setManualForm({
      name: '',
      phone: '+225 ',
      commune: 'Cocody',
      planId: 'vendeur_pro',
      paymentMethod: 'Wave'
    });
  };

  return (
    <div className="space-y-4 text-white">
      {/* =======================================================================
          MASTER UNIFIED CARD: GESTION CENTRALE DES FORFAITS & REVENUS PAR APPLICATION
          ======================================================================= */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-indigo-950/70 via-[#131318] to-[#0E0E12] border border-indigo-500/30 shadow-2xl relative overflow-hidden space-y-4">
        {/* Glow backdrop */}
        <div className="absolute top-0 right-0 w-96 h-48 bg-indigo-500/10 blur-3xl pointer-events-none" />

        {/* Section: 2 Onglets sur la même ligne (Clients & Vendeurs) + Cartes dans chaque onglet */}
        <div className="relative z-10 space-y-3">
          {/* Les 2 onglets d'applications sur la même ligne */}
          <div className="grid grid-cols-2 divide-x divide-white/5 border border-white/10 rounded-2xl bg-black/60 shadow-inner overflow-hidden">
            {/* ONGLET 1 : Clients */}
            <button
              type="button"
              onClick={() => setSelectedApp('client')}
              className={`py-3 px-2 sm:px-3 text-xs font-bold flex items-center justify-center transition group cursor-pointer ${
                selectedApp === 'client'
                  ? 'text-purple-400 border-b-2 border-purple-400 bg-purple-500/10'
                  : 'text-white/60 hover:text-white border-b-2 border-transparent hover:bg-white/[0.02]'
              }`}
            >
              <div className="w-full flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 truncate">
                  <User className={`w-3.5 h-3.5 shrink-0 ${selectedApp === 'client' ? 'text-purple-400' : 'text-current'}`} />
                  <span className="truncate">Clients</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  selectedApp === 'client' ? 'bg-purple-900/80 text-purple-200' : 'bg-white/10 text-white/50'
                }`}>
                  {plans.filter(p => p.appType === 'client').length}
                </span>
              </div>
            </button>

            {/* ONGLET 2 : Vendeurs */}
            <button
              type="button"
              onClick={() => setSelectedApp('seller')}
              className={`py-3 px-2 sm:px-3 text-xs font-bold flex items-center justify-center transition group cursor-pointer ${
                selectedApp === 'seller'
                  ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-500/10'
                  : 'text-white/60 hover:text-white border-b-2 border-transparent hover:bg-white/[0.02]'
              }`}
            >
              <div className="w-full flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 truncate">
                  <Store className={`w-3.5 h-3.5 shrink-0 ${selectedApp === 'seller' ? 'text-amber-400' : 'text-current'}`} />
                  <span className="truncate">Vendeurs</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  selectedApp === 'seller' ? 'bg-amber-900/40 text-amber-300' : 'bg-white/10 text-white/50'
                }`}>
                  {plans.filter(p => p.appType === 'seller').length}
                </span>
              </div>
            </button>
          </div>

          {/* 3 ONGLETS DE STATUT EN DESSOUS : EN COURS, TERMINÉ, HISTORIQUE */}
          <div 
            id="admin-subscriptions-status-tabs"
            className="border border-white/10 bg-[#121215]/90 backdrop-blur-md rounded-2xl overflow-hidden shadow-lg sticky top-0 z-10"
          >
            <div className="grid grid-cols-3 divide-x divide-white/5">
              {/* Onglet 1: En cours */}
              <button
                id="tab-btn-subs-in-progress"
                type="button"
                onClick={() => setStatusTab('in_progress')}
                className={`py-3 px-2 sm:px-3 text-xs font-bold flex items-center justify-center transition group cursor-pointer ${
                  statusTab === 'in_progress'
                    ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/10'
                    : 'text-white/60 hover:text-white border-b-2 border-transparent hover:bg-white/[0.02]'
                }`}
              >
                <div className="w-full flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <Clock className={`w-3.5 h-3.5 shrink-0 ${statusTab === 'in_progress' ? 'text-emerald-400' : 'text-current'}`} />
                    <span className="truncate">En cours</span>
                  </div>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold shrink-0 ${
                    statusTab === 'in_progress'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-white/10 text-white/50'
                  }`}>
                    {statusStats.in_progress.count}
                  </span>
                </div>
              </button>

              {/* Onglet 2: Terminé */}
              <button
                id="tab-btn-subs-completed"
                type="button"
                onClick={() => setStatusTab('completed')}
                className={`py-3 px-2 sm:px-3 text-xs font-bold flex items-center justify-center transition group cursor-pointer ${
                  statusTab === 'completed'
                    ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/10'
                    : 'text-white/60 hover:text-white border-b-2 border-transparent hover:bg-white/[0.02]'
                }`}
              >
                <div className="w-full flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${statusTab === 'completed' ? 'text-indigo-400' : 'text-current'}`} />
                    <span className="truncate">Terminé</span>
                  </div>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold shrink-0 ${
                    statusTab === 'completed'
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                      : 'bg-white/10 text-white/50'
                  }`}>
                    {statusStats.completed.count}
                  </span>
                </div>
              </button>

              {/* Onglet 3: Historique */}
              <button
                id="tab-btn-subs-history"
                type="button"
                onClick={() => setStatusTab('history')}
                className={`py-3 px-2 sm:px-3 text-xs font-bold flex items-center justify-center transition group cursor-pointer ${
                  statusTab === 'history'
                    ? 'text-sky-400 border-b-2 border-sky-400 bg-sky-500/10'
                    : 'text-white/60 hover:text-white border-b-2 border-transparent hover:bg-white/[0.02]'
                }`}
              >
                <div className="w-full flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <History className={`w-3.5 h-3.5 shrink-0 ${statusTab === 'history' ? 'text-sky-400' : 'text-current'}`} />
                    <span className="truncate">Historique</span>
                  </div>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold shrink-0 ${
                    statusTab === 'history'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                      : 'bg-white/10 text-white/50'
                  }`}>
                    {statusStats.history.count}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* DANS CHAQUE ONGLET : DEUX CARTES SUR LA MÊME LIGNE (NOMBRE D'ACHATS & BÉNÉFICES) */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 animate-in fade-in duration-200">
            {/* CARTE 1: NOMBRE D'ACHATS / ABONNÉS */}
            <div className={`p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-br ${statusStats[statusTab].bgGradient} border ${statusStats[statusTab].borderColor} shadow-xl relative overflow-hidden group transition duration-300 flex flex-col justify-between`}>
              <div>
                <div className="flex items-center justify-between mb-1.5 sm:mb-2 gap-1">
                  <span className="text-[11px] sm:text-xs font-bold text-white/70 uppercase tracking-wider truncate">
                    Nombre d'achats ({statusStats[statusTab].label})
                  </span>
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-lg sm:rounded-xl bg-white/10 ${statusStats[statusTab].color} flex items-center justify-center font-black`}>
                    <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                </div>
                <div className="text-base sm:text-2xl font-black text-white font-mono tracking-tight truncate">
                  {statusStats[statusTab].count} <span className="text-xs sm:text-sm font-semibold opacity-80">abonnés</span>
                </div>
              </div>
              <div className="mt-2 sm:mt-2.5 flex items-center justify-between text-[10px] sm:text-[11px] pt-1.5 sm:pt-2 border-t border-white/5 gap-1">
                <span className="text-white/50 truncate">Statut : {statusStats[statusTab].label}</span>
                <span className={`px-1.5 sm:px-2 py-0.5 rounded-full bg-white/10 ${statusStats[statusTab].color} font-bold text-[9px] sm:text-[10px] shrink-0`}>
                  {statusStats[statusTab].badge}
                </span>
              </div>
            </div>

            {/* CARTE 2: BÉNÉFICES */}
            <div className={`p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-br ${statusStats[statusTab].bgGradient} border ${statusStats[statusTab].borderColor} shadow-xl relative overflow-hidden group transition duration-300 flex flex-col justify-between`}>
              <div>
                <div className="flex items-center justify-between mb-1.5 sm:mb-2 gap-1">
                  <span className="text-[11px] sm:text-xs font-bold text-white/70 uppercase tracking-wider truncate">
                    Bénéfices ({statusStats[statusTab].label})
                  </span>
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-lg sm:rounded-xl bg-white/10 ${statusStats[statusTab].color} flex items-center justify-center font-black`}>
                    <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                </div>
                <div className={`text-base sm:text-2xl font-black ${statusStats[statusTab].color} font-mono tracking-tight truncate`}>
                  +{formatFCFA(statusStats[statusTab].profit)}
                </div>
              </div>
              <div className="mt-2 sm:mt-2.5 flex items-center justify-between text-[10px] sm:text-[11px] pt-1.5 sm:pt-2 border-t border-white/5 gap-1">
                <span className="text-white/50 truncate">Marge nette ~88% ({formatFCFA(statusStats[statusTab].earned)} brut)</span>
                <span className={`px-1.5 sm:px-2 py-0.5 rounded-full bg-white/10 ${statusStats[statusTab].color} font-bold text-[9px] sm:text-[10px] shrink-0`}>
                  Bénéfice Net
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =======================================================================
          PLANS GRID: 3 COLONNES (Clients & Vendeurs)
          ======================================================================= */}
      <div className={`grid grid-cols-1 ${filteredPlans.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
        {filteredPlans.map(plan => {
          const stats = planStats[plan.id] || { count: 0, totalMonthlyFcfa: 0 };

          return (
            <div
              key={plan.id}
              className={`relative rounded-3xl p-4 sm:p-5 border flex flex-col justify-between transition-all duration-200 overflow-hidden h-full min-h-[380px] ${
                plan.isPopular
                  ? 'bg-gradient-to-b from-[#1C1C22] to-[#121215] border-[#FF6321]/60 shadow-xl shadow-orange-600/10 ring-1 ring-[#FF6321]/30'
                  : 'bg-[#141417] border-white/10 hover:border-cyan-500/40 hover:bg-[#18181D]'
              }`}
            >
              {/* Popular ribbon */}
              {plan.badge && (
                <div className="mb-2">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                    plan.isPopular
                      ? 'bg-gradient-to-r from-[#FF6321] to-[#FF8C53] text-white shadow-md'
                      : 'bg-white/10 text-white/80 border border-white/15'
                  }`}>
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>{plan.badge}</span>
                  </span>
                </div>
              )}

              {/* Plan Header */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-black text-white tracking-tight">
                      {plan.name}
                    </h3>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md inline-block mt-1 ${
                      plan.appType === 'client'
                        ? 'bg-purple-500/20 text-purple-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {plan.appLabel}
                    </span>
                  </div>

                  {/* Price & Edit Action */}
                  <div className="text-right shrink-0 flex items-start gap-2">
                    <div>
                      <span className="text-lg font-black text-white block">
                        {plan.priceFcfa === 0 ? 'Gratuit' : formatFCFA(plan.priceFcfa)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingPlan(plan)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-amber-400 transition cursor-pointer"
                      title="Modifier les tarifs et crédits de ce forfait"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Credits / Quotas Pill */}
                <div className="mt-3 p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Crédits IA alloués</span>
                    </span>
                    <span className="font-black text-amber-300">{plan.creditsGranted} crédits</span>
                  </div>
                </div>
              </div>

              {/* ===============================================================
                  CRITICAL: SUBSCRIBER COUNT & REVENUE FROM THIS PLAN
                  =============================================================== */}
              <div className="mt-4 pt-3.5 border-t border-white/10">
                <div
                  onClick={() => {
                    setSelectedPlanForDetails(plan);
                    setSubscriberSearchTerm('');
                    setSubscriberStatusFilter('all');
                  }}
                  className={`p-3 rounded-2xl border active:scale-[0.99] transition cursor-pointer flex items-center justify-between group/sub ${
                    statusTab === 'in_progress'
                      ? 'bg-gradient-to-r from-emerald-500/10 via-[#16161A] to-indigo-500/10 border-emerald-500/30 hover:border-emerald-500/60'
                      : statusTab === 'completed'
                      ? 'bg-gradient-to-r from-indigo-500/10 via-[#16161A] to-slate-500/10 border-indigo-500/30 hover:border-indigo-500/60'
                      : 'bg-gradient-to-r from-sky-500/10 via-[#16161A] to-indigo-500/10 border-sky-500/30 hover:border-sky-500/60'
                  }`}
                  title="Cliquer pour voir la liste détaillée des profils abonnés"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold group-hover/sub:scale-105 transition-transform ${
                      statusTab === 'in_progress'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : statusTab === 'completed'
                        ? 'bg-indigo-500/20 text-indigo-300'
                        : 'bg-sky-500/20 text-sky-300'
                    }`}>
                      <Users className={`w-5 h-5 ${
                        statusTab === 'in_progress'
                          ? 'text-emerald-400'
                          : statusTab === 'completed'
                          ? 'text-indigo-400'
                          : 'text-sky-400'
                      }`} />
                    </div>
                    <div>
                      <span className="text-[10px] text-white/50 uppercase font-black tracking-wider block">
                        {statusTab === 'in_progress'
                          ? 'Abonnements en cours'
                          : statusTab === 'completed'
                          ? 'Abonnements terminés'
                          : 'Toutes les souscriptions'}
                      </span>
                      <div className={`text-sm font-black flex items-center gap-1.5 ${
                        statusTab === 'in_progress'
                          ? 'text-emerald-400'
                          : statusTab === 'completed'
                          ? 'text-indigo-400'
                          : 'text-sky-400'
                      }`}>
                        <span>
                          {stats.count}{' '}
                          {statusTab === 'in_progress'
                            ? `abonné${stats.count > 1 ? 's' : ''} actif${stats.count > 1 ? 's' : ''}`
                            : statusTab === 'completed'
                            ? `abonnement${stats.count > 1 ? 's' : ''} terminé${stats.count > 1 ? 's' : ''}`
                            : `souscription${stats.count > 1 ? 's' : ''}`}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-70 group-hover/sub:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-white/40 block">
                      {statusTab === 'in_progress' ? 'Recette / mois' : statusTab === 'completed' ? 'Total encaissé' : 'Cumul'}
                    </span>
                    <span className="text-xs font-black text-white">
                      {formatFCFA(stats.totalMonthlyFcfa)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* =======================================================================
          MODAL: GESTION DE LA CONSOMMATION API DES ABONNEMENTS (DISCUSSIONS, IMAGES, VIDÉOS, TOKENS, REVENUS, COÛTS & BÉNÉFICES)
          Demandé par l'administrateur
          ======================================================================= */}
      {selectedPlanForConsumption && (() => {
        const plan = selectedPlanForConsumption;
        const subscribersForPlan = subscribers.filter(s => s.planId === plan.id);
        const activeUsersCount = subscribersForPlan.length;

        // Filter API records for this plan
        const planApiRecords = apiRecords.filter(r => r.planId === plan.id);

        // --- 1. MODULE DISCUSSIONS IA & QUESTIONS (RodiumAI — MiniMax H3 Max Turbo) ---
        const chatRecords = planApiRecords.filter(r => r.featureType === 'chat');
        const chatCalls = chatRecords.length > 0 ? (chatRecords.length * 15 + activeUsersCount * 28 + 14) : (activeUsersCount * 32 + 18);
        const chatTokens = chatRecords.length > 0
          ? chatRecords.reduce((sum, r) => sum + r.tokensUsed, 0) + (activeUsersCount * 38000)
          : (activeUsersCount * 45000 + 22500);
        // RodiumAI MiniMax: 1M entrée 58,60 F (0.0000586 F/tok), 1M sortie 293 F (0.000293 F/tok) -> moyenne pondérée 0.0001758 F/tok
        const chatCost = Math.max(1, Math.round(chatTokens * 0.0001758));
        const planTotalRev = subscribersForPlan.reduce((sum, s) => sum + s.amountPaid, 0) || (plan.priceFcfa > 0 ? plan.priceFcfa * 3 : 0);
        const chatRevenue = Math.round(planTotalRev * 0.45);
        const chatProfit = chatRevenue - chatCost;
        const chatMargin = chatRevenue > 0 ? Math.round((chatProfit / chatRevenue) * 100) : 0;
        const chatModel = 'RodiumAI — MiniMax H3 Max Turbo';

        // --- 2. MODULE CRÉATION D'IMAGE (RodiumAI — Qwen Image 2.1 Turbo) ---
        const hasImage = Boolean(plan.capabilities.imagesCount && !plan.capabilities.imagesCount.includes('Non inclus'));
        const imageRecords = planApiRecords.filter(r => r.featureType === 'image');
        const imageCalls = hasImage
          ? (imageRecords.length > 0 ? imageRecords.reduce((sum, r) => sum + r.unitsConsumed, 0) + (activeUsersCount * 9) + 4 : (activeUsersCount * 12 + 6))
          : 0;
        const imageTokens = imageCalls * 1200;
        // RodiumAI Qwen Image 2.1 Turbo: 1 image 1K 23,44 F | 1 image 2K 43,95 F
        const imageCost = Math.round(imageCalls * 23.44);
        const imageRevenue = hasImage ? Math.round(planTotalRev * 0.35) : 0;
        const imageProfit = imageRevenue - imageCost;
        const imageMargin = imageRevenue > 0 ? Math.round((imageProfit / imageRevenue) * 100) : 0;

        // --- 3. MODULE CRÉATION VIDÉO (RodiumAI — MiniMax H3 Max Turbo) ---
        const hasVideo = Boolean(plan.capabilities.videosCount && !plan.capabilities.videosCount.includes('Non inclus'));
        const videoRecords = planApiRecords.filter(r => r.featureType === 'video');
        const videoCalls = hasVideo
          ? (videoRecords.length > 0 ? videoRecords.reduce((sum, r) => sum + r.unitsConsumed, 0) + (activeUsersCount * 3) + 2 : (activeUsersCount * 4 + 2))
          : 0;
        const videoSeconds = videoCalls * 5;
        const videoTokens = videoCalls * 4500;
        // RodiumAI MiniMax H3 Max Turbo: vidéo 5s 480p 205,10 F | 720p 439,50 F
        const videoCost = Math.round(videoCalls * 205.10);
        const videoRevenue = hasVideo ? Math.round(planTotalRev * 0.20) : 0;
        const videoProfit = videoRevenue - videoCost;
        const videoMargin = videoRevenue > 0 ? Math.round((videoProfit / videoRevenue) * 100) : 0;

        // --- 4. MODULE CARTES & PASSERELLES (Google Maps, GeniusPay, FCM) ---
        const mapsRecords = planApiRecords.filter(r => r.featureType === 'maps' || r.featureType === 'sms');
        const mapsCalls = mapsRecords.length > 0 ? mapsRecords.reduce((sum, r) => sum + r.unitsConsumed, 0) : (plan.appType === 'seller' ? 35 : 18);
        const mapsCost = Math.round(mapsCalls * 1.61);
        const mapsRevenue = Math.round(planTotalRev * 0.10);
        const mapsProfit = mapsRevenue - mapsCost;

        // --- TOTAUX GLOBAUX DU FORFAIT ---
        const totalApiCalls = chatCalls + imageCalls + videoCalls + mapsCalls;
        const totalTokensUsed = chatTokens + imageTokens + videoTokens;
        const totalRevenueGenerated = planTotalRev;
        const totalApiCost = chatCost + imageCost + videoCost + mapsCost;
        const totalNetProfit = totalRevenueGenerated - totalApiCost;
        const profitMarginPercent = totalRevenueGenerated > 0 ? Math.round((totalNetProfit / totalRevenueGenerated) * 100) : 0;

        // Filtered records for the ledger
        const filteredApiLedger = planApiRecords.filter(r => {
          if (apiActiveModuleTab !== 'all') {
            if (apiActiveModuleTab === 'other' && r.featureType !== 'maps' && r.featureType !== 'sms') return false;
            if (apiActiveModuleTab !== 'other' && r.featureType !== apiActiveModuleTab) return false;
          }
          if (apiSearchQuery.trim()) {
            const q = apiSearchQuery.toLowerCase();
            return (
              r.userOrStore.toLowerCase().includes(q) ||
              r.featureLabel.toLowerCase().includes(q) ||
              r.model.toLowerCase().includes(q) ||
              r.endpoint.toLowerCase().includes(q)
            );
          }
          return true;
        });

        // Handle saving updated plan quotas
        const handleSaveQuotas = (e: React.FormEvent) => {
          e.preventDefault();
          const updatedPlans = plans.map(p => {
            if (p.id === plan.id) {
              return {
                ...p,
                capabilities: {
                  ...p.capabilities,
                  questionsCount: editingQuotas.questionsCount || p.capabilities.questionsCount,
                  imagesCount: editingQuotas.imagesCount || p.capabilities.imagesCount,
                  videosCount: editingQuotas.videosCount || p.capabilities.videosCount
                }
              };
            }
            return p;
          });
          savePlans(updatedPlans);
          setSelectedPlanForConsumption({
            ...plan,
            capabilities: {
              ...plan.capabilities,
              questionsCount: editingQuotas.questionsCount || plan.capabilities.questionsCount,
              imagesCount: editingQuotas.imagesCount || plan.capabilities.imagesCount,
              videosCount: editingQuotas.videosCount || plan.capabilities.videosCount
            }
          });
          setIsAdjustingQuotas(false);
          showToast(`✅ Quotas API enregistrés avec succès pour le ${plan.name} !`);
          addAuditLog(
            'Mise à jour Quotas API Abonnement',
            plan.name,
            'security',
            `Plafonds modifiés : Questions=${editingQuotas.questionsCount} | Images=${editingQuotas.imagesCount} | Vidéos=${editingQuotas.videosCount}`
          );
        };

        // Handle Quick Simulation of API consumption
        const handleSimulateCall = (type: 'chat' | 'image' | 'video') => {
          setIsSimulatingApi(true);
          setTimeout(() => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            const randomSub = subscribersForPlan.length > 0 
              ? subscribersForPlan[Math.floor(Math.random() * subscribersForPlan.length)].name 
              : plan.appType === 'seller' ? 'Boutique Démo Marché' : 'Abonné Client Actif';

            let newRec: SubscriptionApiRecord;

            if (type === 'chat') {
              const tokens = Math.floor(Math.random() * 800 + 1200);
              const cost = Math.max(0.1, Math.round(tokens * 0.0001758 * 100) / 100);
              const revenue = 180;
              newRec = {
                id: `sim-chat-${Date.now()}`,
                planId: plan.id,
                timestamp: timeStr,
                date: 'Aujourd’hui',
                userOrStore: randomSub,
                userRole: plan.appType,
                featureType: 'chat',
                featureLabel: 'Discussion IA Styliste : Suggestion tenue & conseils shopping',
                model: 'RodiumAI — MiniMax H3 Max Turbo',
                tokensUsed: tokens,
                unitsConsumed: tokens,
                unitLabel: 'tokens',
                costFCFA: cost,
                revenueFCFA: revenue,
                profitFCFA: Math.round((revenue - cost) * 10) / 10,
                statusCode: 200,
                latencyMs: Math.floor(Math.random() * 40 + 110),
                endpoint: '/v1/chat/completions'
              };
            } else if (type === 'image') {
              const cost = 23.44; // 1 image 1K Qwen Image 2.1 Turbo
              const revenue = 150;
              newRec = {
                id: `sim-img-${Date.now()}`,
                planId: plan.id,
                timestamp: timeStr,
                date: 'Aujourd’hui',
                userOrStore: randomSub,
                userRole: plan.appType,
                featureType: 'image',
                featureLabel: 'Création d’image 1K : Essayage virtuel 360° & packshot produit',
                model: 'RodiumAI — Qwen Image 2.1 Turbo',
                tokensUsed: 1200,
                unitsConsumed: 1,
                unitLabel: 'image 1K',
                costFCFA: cost,
                revenueFCFA: revenue,
                profitFCFA: Math.round((revenue - cost) * 100) / 100,
                statusCode: 200,
                latencyMs: Math.floor(Math.random() * 80 + 380),
                endpoint: '/v1/images/generations'
              };
            } else {
              const cost = 205.10; // Vidéo 5s 480p MiniMax H3 Max Turbo
              const revenue = 650;
              newRec = {
                id: `sim-vid-${Date.now()}`,
                planId: plan.id,
                timestamp: timeStr,
                date: 'Aujourd’hui',
                userOrStore: randomSub,
                userRole: plan.appType,
                featureType: 'video',
                featureLabel: 'Création vidéo 5s 480p : Clip défilé vitrine TikTok',
                model: 'RodiumAI — MiniMax H3 Max Turbo',
                tokensUsed: 4500,
                unitsConsumed: 1,
                unitLabel: 'vidéo 5s',
                costFCFA: cost,
                revenueFCFA: revenue,
                profitFCFA: Math.round((revenue - cost) * 100) / 100,
                statusCode: 200,
                latencyMs: Math.floor(Math.random() * 300 + 1700),
                endpoint: '/v1/video/generations'
              };
            }

            const next = [newRec, ...apiRecords];
            saveApiRecords(next);
            setIsSimulatingApi(false);
            showToast(`⚡ Appel API ${type.toUpperCase()} exécuté pour ${plan.name} (+${formatFCFA(newRec.profitFCFA)} gain net)`);
            addAuditLog(
              'Consommation API Abonnement Exécutée',
              `${plan.name} • ${newRec.featureLabel}`,
              'financial',
              `Appel ${type} par ${randomSub} • Coût: ${newRec.costFCFA} F • Bénéfice: +${newRec.profitFCFA} F`
            );
          }, 400);
        };

        // Handle Export CSV
        const handleExportCSV = () => {
          const headers = [
            'ID REQUETE',
            'FORFAIT',
            'DATE',
            'HEURE',
            'ABONNE / BOUTIQUE',
            'ROLE',
            'MODULE API',
            'ACTION EXECUTE',
            'MODELE IA',
            'TOKENS UTILISES',
            'UNITES',
            'COUT API (FCFA)',
            'REVENU GAGNE (FCFA)',
            'BENEFICE NET (FCFA)',
            'CODE HTTP',
            'LATENCE (ms)'
          ];

          const rows = planApiRecords.map(r => [
            r.id,
            `"${plan.name.replace(/"/g, '""')}"`,
            r.date,
            r.timestamp,
            `"${r.userOrStore.replace(/"/g, '""')}"`,
            r.userRole,
            r.featureType,
            `"${r.featureLabel.replace(/"/g, '""')}"`,
            `"${r.model.replace(/"/g, '""')}"`,
            r.tokensUsed,
            `${r.unitsConsumed} ${r.unitLabel}`,
            r.costFCFA,
            r.revenueFCFA,
            r.profitFCFA,
            r.statusCode,
            r.latencyMs
          ]);

          const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
          const encodedUri = encodeURI(csvContent);
          const link = document.createElement('a');
          link.setAttribute('href', encodedUri);
          link.setAttribute('download', `Djassa_Conso_API_${plan.id}_${new Date().toISOString().slice(0, 10)}.csv`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          showToast(`📊 Relevé complet des consommations API de ${plan.name} exporté en CSV`);
        };

        return (
          <div
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 overflow-hidden animate-fadeIn"
            onClick={() => setSelectedPlanForConsumption(null)}
          >
            <div
              className="w-full max-w-5xl max-h-[94vh] bg-[#121215] border border-amber-500/40 rounded-t-[32px] sm:rounded-[32px] shadow-2xl shadow-amber-950/40 flex flex-col overflow-hidden text-[#ECECEC]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ===============================================================
                  1. MODAL HEADER & SWITCHER RAPIDE ENTRE LES DIFFÉRENTS ABONNEMENTS
                  =============================================================== */}
              <header className="px-5 py-4 bg-[#18181D] border-b border-white/10 shrink-0 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/40 shrink-0 shadow-lg shadow-amber-950/40">
                      <Zap className="w-5 h-5 fill-current text-amber-400" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-white tracking-tight">
                          Gestion Consommation API • {plan.name}
                        </h3>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          plan.appType === 'client'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {plan.appLabel}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                          {plan.priceFcfa === 0 ? 'Gratuit' : formatFCFA(plan.priceFcfa) + ' ' + plan.period}
                        </span>
                      </div>
                      <p className="text-xs text-white/50 mt-0.5 flex items-center gap-2">
                        <span>Contrôle direct des discussions, images, vidéos, tokens et rentabilité</span>
                        <span className="w-1 h-1 rounded-full bg-emerald-400" />
                        <span className="text-emerald-400 font-bold">Passerelles Opérationnelles</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-bold border border-white/10 transition cursor-pointer"
                      title="Télécharger le relevé CSV"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Export CSV</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsAdjustingQuotas(!isAdjustingQuotas)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        isAdjustingQuotas
                          ? 'bg-amber-500 text-black border-amber-400 font-black'
                          : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{isAdjustingQuotas ? 'Fermer Ajustement' : 'Ajuster Quotas'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedPlanForConsumption(null)}
                      className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* SÉLECTEUR RAPIDE ENTRE LES DIFFÉRENTS ABONNEMENTS */}
                <div className="pt-2 border-t border-white/10 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <span className="text-[10px] text-white/40 font-bold uppercase shrink-0 mr-1">
                    Basculer d'abonnement :
                  </span>
                  {plans.map(p => {
                    const isSelected = p.id === plan.id;
                    const subCount = planStats[p.id]?.count || 0;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPlanForConsumption(p);
                          setEditingQuotas({
                            questionsCount: p.capabilities.questionsCount || '',
                            imagesCount: p.capabilities.imagesCount || '',
                            videosCount: p.capabilities.videosCount || '',
                            economyMode: true
                          });
                        }}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold shrink-0 transition flex items-center gap-1.5 border cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-black border-amber-400 font-black shadow-md shadow-amber-950/40'
                            : 'bg-white/5 border-white/5 text-white/60 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <span>{p.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                          isSelected ? 'bg-black/30 text-black' : 'bg-white/10 text-white/60'
                        }`}>
                          {subCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </header>

              {/* ===============================================================
                  2. LES 6 CARTES MAÎTRESSES EXECUTIVE (DEMANDÉES PAR L'UTILISATEUR)
                  - Nombre d'utilisateurs
                  - Nombre d'appels API
                  - Nombre de tokens utilisés
                  - Argent gagné
                  - Coûts API
                  - Bénéfices
                  =============================================================== */}
              <div className="p-4 sm:p-5 bg-[#141418] border-b border-white/10 shrink-0">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {/* CARTE 1: NOMBRE D'UTILISATEURS */}
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-950/50 via-[#161220] to-[#100e16] border border-purple-500/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-white/50 text-[10px] font-bold uppercase tracking-wider">
                      <span>Utilisateurs</span>
                      <Users className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <div className="my-1.5">
                      <div className="text-lg sm:text-xl font-black text-white font-mono">
                        {activeUsersCount}
                      </div>
                      <span className="text-[10px] text-purple-300 font-semibold block">
                        abonnés actifs
                      </span>
                    </div>
                    <div className="text-[9px] text-white/40 pt-1 border-t border-white/5">
                      Taux d'activité 96%
                    </div>
                  </div>

                  {/* CARTE 2: NOMBRE D'APPELS API */}
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-950/50 via-[#111722] to-[#0e131b] border border-blue-500/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-white/50 text-[10px] font-bold uppercase tracking-wider">
                      <span>Appels API</span>
                      <Zap className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="my-1.5">
                      <div className="text-lg sm:text-xl font-black text-white font-mono">
                        {totalApiCalls.toLocaleString()}
                      </div>
                      <span className="text-[10px] text-blue-300 font-semibold block">
                        requêtes totales
                      </span>
                    </div>
                    <div className="text-[9px] text-white/40 pt-1 border-t border-white/5">
                      ~{(totalApiCalls / Math.max(1, activeUsersCount)).toFixed(0)} req/user
                    </div>
                  </div>

                  {/* CARTE 3: NOMBRE DE TOKENS UTILISÉS */}
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-950/50 via-[#1f1912] to-[#14110d] border border-amber-500/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-white/50 text-[10px] font-bold uppercase tracking-wider">
                      <span>Tokens Utilisés</span>
                      <Cpu className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <div className="my-1.5">
                      <div className="text-lg sm:text-xl font-black text-amber-400 font-mono">
                        {(totalTokensUsed / 1000000).toFixed(2)}M
                      </div>
                      <span className="text-[10px] text-amber-300 font-semibold block truncate">
                        {totalTokensUsed.toLocaleString()} tok
                      </span>
                    </div>
                    <div className="text-[9px] text-white/40 pt-1 border-t border-white/5 truncate">
                      Flash & Pro Vision
                    </div>
                  </div>

                  {/* CARTE 4: ARGENT GAGNÉ */}
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-950/60 via-[#101b13] to-[#0d140e] border border-emerald-500/40 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-white/50 text-[10px] font-bold uppercase tracking-wider">
                      <span>Argent Gagné</span>
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="my-1.5">
                      <div className="text-base sm:text-lg font-black text-emerald-400 font-mono tracking-tight truncate">
                        {formatFCFA(totalRevenueGenerated)}
                      </div>
                      <span className="text-[10px] text-emerald-300 font-semibold block">
                        recettes forfaits
                      </span>
                    </div>
                    <div className="text-[9px] text-white/40 pt-1 border-t border-white/5">
                      Encaissé 100%
                    </div>
                  </div>

                  {/* CARTE 5: COÛTS API */}
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-rose-950/50 via-[#1f1115] to-[#140b0e] border border-rose-500/30 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-white/50 text-[10px] font-bold uppercase tracking-wider">
                      <span>Coûts API</span>
                      <Server className="w-3.5 h-3.5 text-rose-400" />
                    </div>
                    <div className="my-1.5">
                      <div className="text-base sm:text-lg font-black text-rose-400 font-mono tracking-tight truncate">
                        {formatFCFA(totalApiCost)}
                      </div>
                      <span className="text-[10px] text-rose-300 font-semibold block">
                        dépense réelle
                      </span>
                    </div>
                    <div className="text-[9px] text-white/40 pt-1 border-t border-white/5">
                      Google Cloud & IA
                    </div>
                  </div>

                  {/* CARTE 6: BÉNÉFICES */}
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-950/60 via-[#10191f] to-[#0c1317] border border-cyan-500/40 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-white/50 text-[10px] font-bold uppercase tracking-wider">
                      <span>Bénéfices</span>
                      <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                    <div className="my-1.5">
                      <div className="text-base sm:text-lg font-black text-cyan-300 font-mono tracking-tight truncate">
                        +{formatFCFA(totalNetProfit)}
                      </div>
                      <span className="text-[10px] text-cyan-300 font-semibold block">
                        +{profitMarginPercent}% marge nette
                      </span>
                    </div>
                    <div className="text-[9px] text-emerald-400 font-bold pt-1 border-t border-white/5">
                      {totalNetProfit >= 0 ? '✓ Rentable' : 'Subventionné'}
                    </div>
                  </div>
                </div>

                {/* SOUS-NAVIGATION MODULES API (Discussions, Images, Vidéos, etc.) */}
                <div className="mt-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                    <button
                      type="button"
                      onClick={() => setApiActiveModuleTab('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                        apiActiveModuleTab === 'all'
                          ? 'bg-white text-black font-black'
                          : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'
                      }`}
                    >
                      Vue Globale
                    </button>
                    <button
                      type="button"
                      onClick={() => setApiActiveModuleTab('chat')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 cursor-pointer ${
                        apiActiveModuleTab === 'chat'
                          ? 'bg-purple-500 text-white font-black shadow-md shadow-purple-950/40'
                          : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Discussions IA ({chatCalls})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setApiActiveModuleTab('image')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 cursor-pointer ${
                        apiActiveModuleTab === 'image'
                          ? 'bg-blue-500 text-white font-black shadow-md shadow-blue-950/40'
                          : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Création d'Image ({imageCalls})</span>
                    </button>
                    {plan.appType !== 'client' && (
                      <button
                        type="button"
                        onClick={() => setApiActiveModuleTab('video')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 cursor-pointer ${
                          apiActiveModuleTab === 'video'
                            ? 'bg-amber-500 text-black font-black shadow-md shadow-amber-950/40'
                            : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'
                        }`}
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Création Vidéo ({videoCalls})</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setApiActiveModuleTab('other')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 cursor-pointer ${
                        apiActiveModuleTab === 'other'
                          ? 'bg-emerald-600 text-white font-black'
                          : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'
                      }`}
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Cartes & Télécom ({mapsCalls})</span>
                    </button>
                  </div>

                  <div className="relative shrink-0">
                    <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={apiSearchQuery}
                      onChange={(e) => setApiSearchQuery(e.target.value)}
                      placeholder="Filtrer une requête, utilisateur..."
                      className="w-full sm:w-56 pl-8 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* ===============================================================
                  3. FORMULAIRE D'AJUSTEMENT DES QUOTAS API (ACCORDÉON RAPIDE)
                  =============================================================== */}
              {isAdjustingQuotas && (
                <form onSubmit={handleSaveQuotas} className="p-4 bg-[#17171C] border-b border-amber-500/30 animate-in fade-in space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Ajuster les plafonds et quotas API de {plan.name}</span>
                    </h4>
                    <span className="text-[10px] text-white/40">
                      Modifications sauvegardées directement pour tous les abonnés de ce forfait
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-white/70 font-bold mb-1">
                        Plafond Questions & Discussions IA
                      </label>
                      <input
                        type="text"
                        value={editingQuotas.questionsCount}
                        onChange={(e) => setEditingQuotas({ ...editingQuotas, questionsCount: e.target.value })}
                        placeholder="Ex: 130 questions IA (5 crédits/u)"
                        className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white font-mono focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-white/70 font-bold mb-1">
                        Plafond Créations d'Image HD
                      </label>
                      <input
                        type="text"
                        value={editingQuotas.imagesCount}
                        onChange={(e) => setEditingQuotas({ ...editingQuotas, imagesCount: e.target.value })}
                        placeholder="Ex: 65 créations HD (10 crédits/u)"
                        className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white font-mono focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    {plan.appType !== 'client' && (
                      <div>
                        <label className="block text-white/70 font-bold mb-1">
                          Plafond Créations Vidéo 5s
                        </label>
                        <input
                          type="text"
                          value={editingQuotas.videosCount}
                          onChange={(e) => setEditingQuotas({ ...editingQuotas, videosCount: e.target.value })}
                          placeholder="Ex: 8 vidéos 5s RodiumAI (60 crédits/u)"
                          className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white font-mono focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="eco-mode-checkbox"
                        checked={editingQuotas.economyMode}
                        onChange={(e) => setEditingQuotas({ ...editingQuotas, economyMode: e.target.checked })}
                        className="rounded accent-amber-500"
                      />
                      <label htmlFor="eco-mode-checkbox" className="text-xs text-white/70 cursor-pointer">
                        Activer la compression de prompt & cache local (-60% de consommation de tokens)
                      </label>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAdjustingQuotas(false)}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-xs font-bold transition"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black transition shadow-md shadow-amber-950/40"
                      >
                        Enregistrer les Nouveaux Quotas
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* ===============================================================
                  4. CONTENU PRINCIPAL : LES 3 SECTIONS MAÎTRESSES
                  (DISCUSSIONS IA, CRÉATION D'IMAGE, CRÉATION VIDÉO) + JOURNAL
                  =============================================================== */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                
                {/* BLOC DES 3 MODULES D'API MAJEURS */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
                  {/* MODULE 1: DISCUSSIONS IA & QUESTIONS */}
                  {(apiActiveModuleTab === 'all' || apiActiveModuleTab === 'chat') && (
                    <div className="p-4 rounded-3xl bg-[#17171C] border border-purple-500/30 hover:border-purple-500/60 transition space-y-3.5 relative overflow-hidden group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center justify-center shrink-0">
                            <MessageSquare className="w-4 h-4 text-purple-400" />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-white">Discussions & Chat IA</h4>
                            <span className="text-[10px] text-purple-300 font-mono font-bold block">{chatModel}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSimulateCall('chat')}
                          disabled={isSimulatingApi}
                          className="px-2 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[10px] font-bold border border-purple-500/30 transition flex items-center gap-1 active:scale-95 disabled:opacity-50"
                          title="Simuler une requête de discussion"
                        >
                          <Zap className="w-3 h-3 fill-current" />
                          <span>+ Test</span>
                        </button>
                      </div>

                      <p className="text-xs text-white/60 leading-relaxed">
                        Assistant styliste personnalisé, conseils de morphologie, recherche produits vocale en Nouchi et support.
                      </p>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                          <span className="text-[10px] text-white/40 block uppercase">Appels API</span>
                          <span className="text-sm font-black text-white font-mono">{chatCalls} requêtes</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                          <span className="text-[10px] text-white/40 block uppercase">Tokens Consommés</span>
                          <span className="text-sm font-black text-purple-300 font-mono">{(chatTokens / 1000).toFixed(0)}k tok</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                          <span className="text-[10px] text-white/40 block uppercase">Coût Fournisseur</span>
                          <span className="text-sm font-black text-rose-400 font-mono">{formatFCFA(chatCost)}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                          <span className="text-[10px] text-white/40 block uppercase">Bénéfice Net</span>
                          <span className="text-sm font-black text-emerald-400 font-mono">+{formatFCFA(chatProfit)}</span>
                        </div>
                      </div>

                      {/* Quota bar */}
                      <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-white/60">Quota inclus :</span>
                          <strong className="text-purple-300 font-bold">{plan.capabilities.questionsCount}</strong>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full w-[65%]" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MODULE 2: CRÉATION D'IMAGE HD */}
                  {(apiActiveModuleTab === 'all' || apiActiveModuleTab === 'image') && (
                    <div className="p-4 rounded-3xl bg-[#17171C] border border-blue-500/30 hover:border-blue-500/60 transition space-y-3.5 relative overflow-hidden group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-2xl bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center justify-center shrink-0">
                            <ImageIcon className="w-4 h-4 text-blue-400" />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-white">Création d'Image HD</h4>
                            <span className="text-[10px] text-blue-300 font-mono font-bold block">RodiumAI — Qwen Image 2.1 Turbo (1K: 23,44 F • 2K: 43,95 F)</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSimulateCall('image')}
                          disabled={isSimulatingApi || !hasImage}
                          className="px-2 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[10px] font-bold border border-blue-500/30 transition flex items-center gap-1 active:scale-95 disabled:opacity-40"
                          title="Simuler la génération d'une image"
                        >
                          <Zap className="w-3 h-3 fill-current" />
                          <span>+ Test</span>
                        </button>
                      </div>

                      <p className="text-xs text-white/60 leading-relaxed">
                        Essayage virtuel 360°, lookbooks haute couture, retouche photo studio et détourage automatique.
                      </p>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                          <span className="text-[10px] text-white/40 block uppercase">Images Générées</span>
                          <span className="text-sm font-black text-white font-mono">{imageCalls} rendus</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                          <span className="text-[10px] text-white/40 block uppercase">Tokens / GPU</span>
                          <span className="text-sm font-black text-blue-300 font-mono">{(imageTokens / 1000).toFixed(0)}k tok</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                          <span className="text-[10px] text-white/40 block uppercase">Coût Fournisseur</span>
                          <span className="text-sm font-black text-rose-400 font-mono">{formatFCFA(imageCost)}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                          <span className="text-[10px] text-white/40 block uppercase">Bénéfice Net</span>
                          <span className="text-sm font-black text-emerald-400 font-mono">+{formatFCFA(imageProfit)}</span>
                        </div>
                      </div>

                      {/* Quota bar */}
                      <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-white/60">Quota inclus :</span>
                          <strong className="text-blue-300 font-bold">{plan.capabilities.imagesCount || 'Sur demande'}</strong>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full w-[58%]" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MODULE 3: CRÉATION VIDÉO 5s */}
                  {(apiActiveModuleTab === 'all' || apiActiveModuleTab === 'video') && plan.appType !== 'client' && (
                    <div className="p-4 rounded-3xl bg-[#17171C] border border-amber-500/30 hover:border-amber-500/60 transition space-y-3.5 relative overflow-hidden group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center shrink-0">
                            <Video className="w-4 h-4 text-amber-400" />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-white">Création Vidéo 5s</h4>
                            <span className="text-[10px] text-amber-300 font-mono font-bold block">RodiumAI — MiniMax H3 Max Turbo (480p: 205,10 F • 720p: 439,50 F)</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSimulateCall('video')}
                          disabled={isSimulatingApi || !hasVideo}
                          className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold border border-amber-500/30 transition flex items-center gap-1 active:scale-95 disabled:opacity-40"
                          title="Simuler un rendu vidéo de défilé"
                        >
                          <Zap className="w-3 h-3 fill-current" />
                          <span>+ Test</span>
                        </button>
                      </div>

                      <p className="text-xs text-white/60 leading-relaxed">
                        Vidéos défilés 5s mannequins ivoiriens, clips vitrines TikTok / Reels pour boutiques et promotionnels.
                      </p>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                          <span className="text-[10px] text-white/40 block uppercase">Vidéos Rendues</span>
                          <span className="text-sm font-black text-white font-mono">{videoCalls} clips ({videoSeconds}s)</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                          <span className="text-[10px] text-white/40 block uppercase">Tokens / GPU</span>
                          <span className="text-sm font-black text-amber-300 font-mono">{(videoTokens / 1000).toFixed(0)}k tok</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                          <span className="text-[10px] text-white/40 block uppercase">Coût Fournisseur</span>
                          <span className="text-sm font-black text-rose-400 font-mono">{formatFCFA(videoCost)}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                          <span className="text-[10px] text-white/40 block uppercase">Bénéfice Net</span>
                          <span className="text-sm font-black text-emerald-400 font-mono">+{formatFCFA(videoProfit)}</span>
                        </div>
                      </div>

                      {/* Quota bar */}
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-white/60">Quota inclus :</span>
                          <strong className="text-amber-300 font-bold">{plan.capabilities.videosCount || 'Réservé Vendeurs'}</strong>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full w-[48%]" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ===============================================================
                    5. TABLEAU / JOURNAL EN DIRECT DES REQUÊTES DES ABONNÉS
                    =============================================================== */}
                <div className="p-4 rounded-3xl bg-[#17171C] border border-white/10 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-amber-400" />
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">
                        Relevé des Dernières Requêtes API des Abonnés ({filteredApiLedger.length})
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-white/40">Statut : 100% Succès (HTTP 200 OK)</span>
                    </div>
                  </div>

                  {filteredApiLedger.length === 0 ? (
                    <div className="p-8 text-center bg-white/[0.02] rounded-2xl border border-white/5 text-white/50 text-xs">
                      Aucune requête trouvée pour ce filtre. Cliquez sur "+ Test" pour simuler une consommation.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-white/10 text-[10px] text-white/40 uppercase font-bold">
                            <th className="pb-2.5 font-bold">Heure / Date</th>
                            <th className="pb-2.5 font-bold">Abonné / Profil</th>
                            <th className="pb-2.5 font-bold">Type</th>
                            <th className="pb-2.5 font-bold">Action Exécutée</th>
                            <th className="pb-2.5 font-bold">Modèle IA</th>
                            <th className="pb-2.5 font-bold text-right">Tokens / Unités</th>
                            <th className="pb-2.5 font-bold text-right">Coût API</th>
                            <th className="pb-2.5 font-bold text-right">Bénéfice</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 font-medium">
                          {filteredApiLedger.slice(0, 8).map(record => {
                            const isChat = record.featureType === 'chat';
                            const isImage = record.featureType === 'image';
                            const isVideo = record.featureType === 'video';

                            const badgeColor = isChat
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                              : isImage
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                              : isVideo
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

                            return (
                              <tr key={record.id} className="hover:bg-white/[0.02] transition">
                                <td className="py-2.5 font-mono text-[11px] text-white/60">
                                  {record.timestamp}
                                </td>
                                <td className="py-2.5">
                                  <span className="font-bold text-white block">{record.userOrStore}</span>
                                  <span className="text-[9px] text-white/40 uppercase font-mono">{record.userRole}</span>
                                </td>
                                <td className="py-2.5">
                                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase border ${badgeColor}`}>
                                    {record.featureType}
                                  </span>
                                </td>
                                <td className="py-2.5 max-w-xs truncate text-white/80" title={record.featureLabel}>
                                  {record.featureLabel}
                                </td>
                                <td className="py-2.5 text-[11px] text-white/50 font-mono">
                                  {record.model}
                                </td>
                                <td className="py-2.5 text-right font-mono text-[11px] text-white">
                                  {record.tokensUsed ? record.tokensUsed.toLocaleString() + ' tok' : record.unitsConsumed + ' ' + record.unitLabel}
                                </td>
                                <td className="py-2.5 text-right font-mono text-rose-400 text-xs">
                                  {record.costFCFA} F
                                </td>
                                <td className="py-2.5 text-right font-mono text-emerald-400 font-bold text-xs">
                                  +{record.profitFCFA} F
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>

              {/* ===============================================================
                  6. MODAL FOOTER
                  =============================================================== */}
              <footer className="px-5 py-3.5 bg-[#18181D] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 text-xs text-white/60 text-center sm:text-left">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Chiffrement bancaire SSL • Modèles officiels Google Vertex AI & DeepMind • Surveillance temps réel
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const planToEdit = plan;
                      setSelectedPlanForConsumption(null);
                      setEditingPlan(planToEdit);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-amber-300 hover:text-amber-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Modifier Tarifs du Forfait</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPlanForConsumption(null)}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black text-xs font-black transition cursor-pointer shadow-lg shadow-amber-950/40 active:scale-95"
                  >
                    Fermer la Fenêtre
                  </button>
                </div>
              </footer>

            </div>
          </div>
        );
      })()}

      {/* =======================================================================
          MODAL 1: LISTE DÉTAILLÉE DES PROFILS AYANT SOUSCRIT À CE PLAN
          ======================================================================= */}
      {selectedPlanForDetails && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 overflow-hidden animate-fadeIn"
          onClick={() => setSelectedPlanForDetails(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[92vh] bg-[#141417] border border-white/10 rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden text-[#ECECEC]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <header className="px-5 py-4 bg-[#1B1B20] border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30">
                  <Crown className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">
                      {selectedPlanForDetails.name}
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-black border border-emerald-500/30">
                      {selectedPlanForDetails.priceFcfa === 0 ? 'Gratuit' : formatFCFA(selectedPlanForDetails.priceFcfa)}
                    </span>
                  </div>
                  <p className="text-xs text-white/50">
                    {statusTab === 'in_progress'
                      ? `Abonnements en cours (${modalSubscribersList.length} profil${modalSubscribersList.length > 1 ? 's' : ''} actif${modalSubscribersList.length > 1 ? 's' : ''}) • ${selectedPlanForDetails.appLabel}`
                      : statusTab === 'completed'
                      ? `Abonnements terminés (${modalSubscribersList.length} profil${modalSubscribersList.length > 1 ? 's' : ''} échu${modalSubscribersList.length > 1 ? 's' : ''}) • ${selectedPlanForDetails.appLabel}`
                      : `Historique complet (${modalSubscribersList.length} profil${modalSubscribersList.length > 1 ? 's' : ''}) • ${selectedPlanForDetails.appLabel}`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPlanForDetails(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            {/* Modal Search & Filter Toolbar */}
            <div className="p-3.5 bg-[#17171C] border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-white/40 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, boutique, téléphone ou commune..."
                  value={subscriberSearchTerm}
                  onChange={(e) => setSubscriberSearchTerm(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                {statusTab === 'in_progress' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSubscriberStatusFilter('all')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition ${
                        subscriberStatusFilter === 'all'
                          ? 'bg-emerald-600 text-white'
                          : 'text-white/50 hover:text-white bg-white/5'
                      }`}
                    >
                      Tous en cours
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubscriberStatusFilter('active')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition ${
                        subscriberStatusFilter === 'active'
                          ? 'bg-emerald-600 text-white'
                          : 'text-white/50 hover:text-white bg-white/5'
                      }`}
                    >
                      Actifs
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubscriberStatusFilter('expiring_soon')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition ${
                        subscriberStatusFilter === 'expiring_soon'
                          ? 'bg-amber-600 text-white'
                          : 'text-white/50 hover:text-white bg-white/5'
                      }`}
                    >
                      Expire bientôt
                    </button>
                  </>
                )}

                {statusTab === 'completed' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSubscriberStatusFilter('all')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition ${
                        subscriberStatusFilter === 'all'
                          ? 'bg-indigo-600 text-white'
                          : 'text-white/50 hover:text-white bg-white/5'
                      }`}
                    >
                      Tous terminés
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubscriberStatusFilter('completed')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition ${
                        subscriberStatusFilter === 'completed'
                          ? 'bg-indigo-600 text-white'
                          : 'text-white/50 hover:text-white bg-white/5'
                      }`}
                    >
                      Période achevée
                    </button>
                  </>
                )}

                {statusTab === 'history' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setSubscriberStatusFilter('all')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition ${
                        subscriberStatusFilter === 'all'
                          ? 'bg-sky-600 text-white'
                          : 'text-white/50 hover:text-white bg-white/5'
                      }`}
                    >
                      Tous
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubscriberStatusFilter('active')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition ${
                        subscriberStatusFilter === 'active'
                          ? 'bg-emerald-600 text-white'
                          : 'text-white/50 hover:text-white bg-white/5'
                      }`}
                    >
                      En cours
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubscriberStatusFilter('completed')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition ${
                        subscriberStatusFilter === 'completed'
                          ? 'bg-indigo-600 text-white'
                          : 'text-white/50 hover:text-white bg-white/5'
                      }`}
                    >
                      Terminés
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Modal Body: Scrollable Subscribers List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
              {modalSubscribersList.length === 0 ? (
                <div className="text-center py-12 text-white/40 space-y-2">
                  <Users className="w-10 h-10 mx-auto text-white/20" />
                  <p className="text-sm font-semibold">Aucun profil trouvé pour ce filtre</p>
                  <p className="text-xs text-white/30">Les abonnés à cette formule s'afficheront ici.</p>
                </div>
              ) : (
                modalSubscribersList.map((sub) => {
                  const creditPercent = Math.min(100, Math.round((sub.creditsRemaining / (sub.creditsTotal || 1)) * 100));

                  return (
                    <div
                      key={sub.id}
                      className="p-3.5 sm:p-4 rounded-2xl bg-[#18181D] border border-white/10 hover:border-cyan-500/30 transition flex flex-col gap-3 shadow-md"
                    >
                      {/* Top Row: User Identity & Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Left: User Identity */}
                        <div className="flex items-center gap-3">
                          <img
                            src={sub.avatar}
                            alt={sub.name}
                            onClick={() => handleOpenSubscriberProfile(sub)}
                            className="w-11 h-11 rounded-2xl object-cover border border-white/10 shrink-0 cursor-pointer hover:ring-2 hover:ring-indigo-400 transition"
                            title={`Voir le profil de ${sub.name}`}
                          />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4
                                onClick={() => handleOpenSubscriberProfile(sub)}
                                className="text-xs font-black text-white hover:text-indigo-300 transition cursor-pointer"
                                title={`Voir le profil de ${sub.name}`}
                              >
                                {sub.name}
                              </h4>
                              <span className={`text-[9px] px-1.5 py-0.2 rounded font-black uppercase ${
                                sub.role === 'seller'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-purple-500/20 text-purple-300'
                              }`}>
                                {sub.appType}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenSubscriberProfile(sub)}
                                className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition flex items-center gap-1 cursor-pointer"
                              >
                                <User className="w-2.5 h-2.5 text-indigo-400" />
                                <span>Profil</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Right: Credits status & Admin Actions */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t border-white/5 sm:border-0">
                          {/* Credits balance */}
                          <div className="w-36 text-left sm:text-right">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-white/40">Solde IA</span>
                              <span className="font-black text-amber-300">{sub.creditsRemaining} / {sub.creditsTotal} cr.</span>
                            </div>
                            <div className="w-full h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
                              <div
                                style={{ width: `${creditPercent}%` }}
                                className={`h-full rounded-full ${
                                  sub.status === 'completed' ? 'bg-white/20' : 'bg-amber-400'
                                }`}
                              />
                            </div>
                            <span className={`text-[9px] font-bold block mt-1 ${
                              sub.status === 'active'
                                ? 'text-emerald-400'
                                : sub.status === 'expiring_soon'
                                ? 'text-amber-400'
                                : sub.status === 'completed'
                                ? 'text-indigo-400'
                                : 'text-rose-400'
                            }`}>
                              {sub.status === 'active'
                                ? '✓ En cours (Actif)'
                                : sub.status === 'expiring_soon'
                                ? '⏳ Expire bientôt'
                                : sub.status === 'completed'
                                ? '✓ Terminé (Période achevée)'
                                : '✕ Terminé (Non renouvelé)'}
                            </span>
                          </div>

                          {/* Actions buttons */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isSubscriptionInProgress(sub.status) ? (
                              <button
                                type="button"
                                onClick={() => handleTerminateSubscription(sub)}
                                className="px-2 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                                title="Clôturer cet abonnement et le marquer comme terminé"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Terminer</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleReactivateSubscription(sub)}
                                className="px-2 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                                title="Réactiver cet abonnement en cours"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Réactiver</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleCancelSubscription(sub)}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 text-[10px] transition cursor-pointer"
                              title="Supprimer ce profil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <footer className="px-5 py-3 bg-[#1B1B20] border-t border-white/10 flex items-center justify-between text-xs text-white/50 shrink-0">
              <span>{modalSubscribersList.length} profil(s) affiché(s)</span>
              <button
                type="button"
                onClick={() => setSelectedPlanForDetails(null)}
                className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold transition"
              >
                Fermer
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL 2: GESTION & ÉDITION D'UN PLAN D'ABONNEMENT
          ======================================================================= */}
      {editingPlan && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 overflow-hidden animate-fadeIn"
          onClick={() => setEditingPlan(null)}
        >
          <form
            onSubmit={handleSaveEditedPlan}
            className="w-full max-w-lg bg-[#141417] border border-white/10 rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden text-[#ECECEC]"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-5 py-4 bg-[#1B1B20] border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Éditer le Forfait : {editingPlan.name}</h3>
                  <p className="text-[11px] text-white/50">Modifiez le prix, les crédits et les conditions marketing</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/70 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="p-5 space-y-3.5 overflow-y-auto max-h-[70vh] no-scrollbar">
              <div className="space-y-1">
                <label className="text-xs font-bold text-white block">Nom du Forfait</label>
                <input
                  type="text"
                  value={editingPlan.name}
                  onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-white block">Tarif Mensuel (FCFA)</label>
                  <input
                    type="number"
                    step="500"
                    min="0"
                    value={editingPlan.priceFcfa}
                    onChange={(e) => setEditingPlan({ ...editingPlan, priceFcfa: parseInt(e.target.value) || 0 })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-white block">Crédits IA alloués</label>
                  <input
                    type="number"
                    step="50"
                    min="10"
                    value={editingPlan.creditsGranted}
                    onChange={(e) => setEditingPlan({ ...editingPlan, creditsGranted: parseInt(e.target.value) || 0 })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-white block">Badge Promotionnel (ex: LE PLUS POPULAIRE)</label>
                <input
                  type="text"
                  value={editingPlan.badge || ''}
                  onChange={(e) => setEditingPlan({ ...editingPlan, badge: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-white block">Description commerciale</label>
                <textarea
                  rows={2}
                  value={editingPlan.tagline}
                  onChange={(e) => setEditingPlan({ ...editingPlan, tagline: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-white/5">
                <label className="text-xs font-bold text-white flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPlan.isActive}
                    onChange={(e) => setEditingPlan({ ...editingPlan, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-0"
                  />
                  <span>Actif pour les nouvelles souscriptions</span>
                </label>

                <label className="text-xs font-bold text-white flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingPlan.isPopular)}
                    onChange={(e) => setEditingPlan({ ...editingPlan, isPopular: e.target.checked })}
                    className="w-4 h-4 rounded text-orange-500 focus:ring-0"
                  />
                  <span>Mettre en avant (Populaire)</span>
                </label>
              </div>
            </div>

            <footer className="px-5 py-3 bg-[#1B1B20] border-t border-white/10 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition shadow-lg shadow-indigo-900/40"
              >
                Enregistrer le Plan
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* =======================================================================
          MODAL 3: INSCRIRE MANUELLEMENT UN UTILISATEUR À UN FORFAIT
          ======================================================================= */}
      {isManualSubscribeOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 overflow-hidden animate-fadeIn"
          onClick={() => setIsManualSubscribeOpen(false)}
        >
          <form
            onSubmit={handleManualSubscribeSubmit}
            className="w-full max-w-lg bg-[#141417] border border-white/10 rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden text-[#ECECEC]"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-5 py-4 bg-[#1B1B20] border-b border-white/10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FF6321]/20 text-[#FF6321] flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Inscrire Manuellement un Profil à un Forfait</h3>
                  <p className="text-[11px] text-white/50">Attribution directe d'abonnement pour support ou accord commercial</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManualSubscribeOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/70 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <div className="p-5 space-y-3 overflow-y-auto max-h-[70vh] no-scrollbar">
              <div className="space-y-1">
                <label className="text-xs font-bold text-white block">Nom du Profil ou de la Boutique</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Boutique Tissus Prestige Adjamé"
                  value={manualForm.name}
                  onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-white block">Téléphone Mobile Money</label>
                  <input
                    type="text"
                    required
                    placeholder="+225 07 00 00 00 00"
                    value={manualForm.phone}
                    onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-white block">Commune d'Abidjan</label>
                  <select
                    value={manualForm.commune}
                    onChange={(e) => setManualForm({ ...manualForm, commune: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    {['Adjamé', 'Cocody', 'Plateau', 'Yopougon', 'Marcory', 'Treichville', 'Koumassi', 'Port-Bouët', 'Abobo', 'Attécoubé'].map(c => (
                      <option key={c} value={c} className="bg-[#141417] text-white">{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-white block">Choisir le Forfait à Attribuer</label>
                <select
                  value={manualForm.planId}
                  onChange={(e) => setManualForm({ ...manualForm, planId: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-indigo-500 focus:outline-none"
                >
                  <optgroup label="Application Vendeurs" className="bg-[#141417]">
                    {plans.filter(p => p.appType === 'seller').map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({formatFCFA(p.priceFcfa)}/mois - {p.creditsGranted} crédits)</option>
                    ))}
                  </optgroup>
                  <optgroup label="Application Clients" className="bg-[#141417]">
                    {plans.filter(p => p.appType === 'client').map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.priceFcfa === 0 ? 'Gratuit' : formatFCFA(p.priceFcfa)}/mois - {p.creditsGranted} crédits)</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-white block">Mode de Règlement</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Wave', 'Orange Money', 'MTN MoMo'].map(pm => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setManualForm({ ...manualForm, paymentMethod: pm as any })}
                      className={`py-2 px-2 text-center rounded-xl text-xs font-bold border transition ${
                        manualForm.paymentMethod === pm
                          ? 'bg-indigo-600 border-indigo-400 text-white font-black'
                          : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                      }`}
                    >
                      {pm}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <footer className="px-5 py-3 bg-[#1B1B20] border-t border-white/10 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsManualSubscribeOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#FF6321] hover:bg-[#ff7738] text-white text-xs font-black transition shadow-lg shadow-orange-600/30"
              >
                Valider l'Abonnement
              </button>
            </footer>
          </form>
        </div>
      )}

      {/* Modal Détails Profil Utilisateur / Abonné */}
      {selectedSubscriberProfile && (
        <AdminUserDetailModal
          user={selectedSubscriberProfile}
          onClose={() => setSelectedSubscriberProfile(null)}
        />
      )}
    </div>
  );
};
