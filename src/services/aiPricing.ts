/**
 * Grille tarifaire officielle des fonctionnalités IA sur Djassa
 * 
 * - Discussion IA : 1 question = 5 crédits
 * - Génération d'image : 1 image = 10 crédits
 * - Génération Vidéo (5 secondes) : 1 vidéo (5s) = 60 crédits
 */

export const AI_BILLING_RATES = {
  CHAT_QUESTION: 5,        // 1 question à l'IA = 5 Crédits
  LIVE_VOICE_PER_MINUTE: 10, // 1 minute de discussion direct live = 10 Crédits
  IMAGE_GENERATION: 10,    // 1 génération d'image = 10 Crédits
  VIDEO_GENERATION_5S: 60, // 1 génération vidéo (5s) = 60 Crédits
} as const;

export interface AiPricingItem {
  id: 'chat' | 'live_voice' | 'image' | 'video';
  title: string;
  unit: string;
  costCredits: number;
  description: string;
  tag: string;
}

export const AI_PRICING_TABLE: AiPricingItem[] = [
  {
    id: 'chat',
    title: 'Discussion IA',
    unit: '1 question',
    costCredits: AI_BILLING_RATES.CHAT_QUESTION,
    description: 'Recherche intelligente de produits, conseils shopping & négociation (MiniMax H3)',
    tag: '5 Crédits'
  },
  {
    id: 'live_voice',
    title: 'Discussion Directe Live IA',
    unit: '1 minute',
    costCredits: AI_BILLING_RATES.LIVE_VOICE_PER_MINUTE,
    description: 'Conversation vocale fluide en temps réel (MiniMax H3 Max Turbo) avec cartes produits',
    tag: '10 Crédits / min'
  },
  {
    id: 'image',
    title: "Génération d'image",
    unit: '1 image',
    costCredits: AI_BILLING_RATES.IMAGE_GENERATION,
    description: 'Essayage virtuel Qwen Image 2.1 Turbo, rendus sur mannequins réels et photos HD',
    tag: '10 Crédits'
  },
  {
    id: 'video',
    title: 'Génération Vidéo (5s)',
    unit: '1 vidéo de 5 secondes',
    costCredits: AI_BILLING_RATES.VIDEO_GENERATION_5S,
    description: 'Clips animés promotionnels Studio Vidéo IA, défilés de mode et mouvements réalistes',
    tag: '60 Crédits'
  }
];

export interface AiPlanInfo {
  id: string;
  name: string;
  priceFcfa: number;
  credits: number;
  badge?: string;
  period: string;
  audience: 'client' | 'seller';
  hasVideos: boolean;
  capabilitiesSummary: {
    questions: string;
    images: string;
    videos: string;
  };
}

// Client subscriber plans (Gratuit 10 crédits / 24h + DJASSA Mini 300 F, Plus 600 F, Premium 1200 F)
export const CLIENT_SUBSCRIPTION_PLANS: Record<string, AiPlanInfo> = {
  GRATUIT: {
    id: 'gratuit',
    name: 'Plan Gratuit',
    priceFcfa: 0,
    credits: 10,
    badge: 'Renouvellement 24h',
    period: 'Toutes les 24h',
    audience: 'client',
    hasVideos: false,
    capabilitiesSummary: {
      questions: 'Questions IA incluses (10 cr./24h)',
      images: 'Images IA incluses (10 cr./u)',
      videos: 'Non inclus (réservé vendeurs)'
    }
  },
  MINI: {
    id: 'mini',
    name: 'DJASSA Mini',
    priceFcfa: 300,
    credits: 30,
    badge: 'Découverte',
    period: 'par mois',
    audience: 'client',
    hasVideos: false,
    capabilitiesSummary: {
      questions: '30 questions IA',
      images: '2 créations d’images',
      videos: 'Non inclus (réservé vendeurs)'
    }
  },
  PLUS: {
    id: 'plus',
    name: 'DJASSA Plus',
    priceFcfa: 600,
    credits: 60,
    badge: 'LE PLUS POPULAIRE',
    period: 'par mois',
    audience: 'client',
    hasVideos: false,
    capabilitiesSummary: {
      questions: '60 questions IA',
      images: '5 créations d’images',
      videos: 'Non inclus (réservé vendeurs)'
    }
  },
  PREMIUM: {
    id: 'premium',
    name: 'DJASSA Premium',
    priceFcfa: 1200,
    credits: 120,
    badge: 'VIP Shopping',
    period: 'par mois',
    audience: 'client',
    hasVideos: false,
    capabilitiesSummary: {
      questions: '120 questions IA',
      images: '12 créations d’images',
      videos: 'Non inclus (réservé vendeurs)'
    }
  }
};

// Seller subscriber plans (Questions + Images + Vidéos Studio RodiumAI)
export const SELLER_SUBSCRIPTION_PLANS: Record<string, AiPlanInfo> = {
  VENDEUR_STARTER: {
    id: 'vendeur_starter',
    name: 'Vendeur Starter',
    priceFcfa: 4500,
    credits: 450,
    badge: 'Lancement Boutique',
    period: 'par mois',
    audience: 'seller',
    hasVideos: true,
    capabilitiesSummary: {
      questions: '50 questions (fiches produits & marge)',
      images: '20 images Qwen Image 2.1 Turbo',
      videos: '3 vidéos 5s Studio RodiumAI vitrine'
    }
  },
  VENDEUR_PRO: {
    id: 'vendeur_pro',
    name: 'Vendeur Pro Marché',
    priceFcfa: 8900,
    credits: 900,
    badge: 'LE PLUS POPULAIRE VENDEUR',
    period: 'par mois',
    audience: 'seller',
    hasVideos: true,
    capabilitiesSummary: {
      questions: '100 questions (analyses MiniMax M3.1 Flash)',
      images: '40 images Qwen Image 2.1 Turbo HD',
      videos: '8 vidéos 5s Studio RodiumAI défilés'
    }
  },
  VENDEUR_ELITE: {
    id: 'vendeur_elite',
    name: 'Vendeur Élite Studio',
    priceFcfa: 16900,
    credits: 1800,
    badge: 'STUDIO & GROSSISTES',
    period: 'par mois',
    audience: 'seller',
    hasVideos: true,
    capabilitiesSummary: {
      questions: '200 questions MiniMax H3 & H3 Max Turbo',
      images: '80 images lookbook Qwen Image 2.1 Turbo',
      videos: '18 vidéos 5s MiniMax H3 Max Turbo 1080p'
    }
  }
};

// Consolidated subscription plans for access across the app
export const AI_SUBSCRIPTION_PLANS: Record<string, AiPlanInfo> = {
  ...CLIENT_SUBSCRIPTION_PLANS,
  ...SELLER_SUBSCRIPTION_PLANS
};
