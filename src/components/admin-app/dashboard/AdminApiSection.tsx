import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Coins,
  TrendingUp,
  Shield,
  ChevronRight,
  Database,
  BarChart3,
  Download,
  Layers
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { formatFCFA } from '../../../services/marketServices';
import { creditsService } from '../../../services/creditsService';
import { getSecurityToken, securityService } from '../../../services/securityService';
import { Gpt6LunaConsumptionDetail } from './Gpt6LunaConsumptionDetail';
import { ApiProviderDetailConsole } from './ApiProviderDetailConsole';

// =============================================================================
// BACKWARD COMPATIBLE TYPES & DATA STRUCTURES (Used across Admin App)
// =============================================================================

export type ApiRoleTab = 'client' | 'seller';

export const getRolesForApi = (apiId: string): ApiRoleTab[] => {
  switch (apiId) {
    case 'api-gmaps':
    case 'api-google-maps':
      return ['client', 'seller'];
    default:
      return ['client', 'seller'];
  }
};

export const getRoleUsageDescription = (apiId: string, role: ApiRoleTab): string => {
  if (role === 'client') {
    switch (apiId) {
      case 'api-rodium-gpt6':
      case 'api-gpt6-luna': return 'Discussion IA RodiumAI (MiniMax H3 Max Turbo & M3.1 Flash) et création image Qwen 2.1 Turbo';
      case 'api-geniuspay': return 'Paiements commandes GeniusPay (Wave, Orange Money, MTN MoMo, Cartes)';
      case 'api-gmaps':
      case 'api-google-maps': return 'Sélection des repères géographiques et adresses à Abidjan';
      case 'api-fcm':
      case 'api-push': return 'Notifications push FCM commande & promo';
      case 'api-cloudflare-r2': return 'Chargement ultra-rapide des avatars, factures et photos produits';
      case 'api-cloud-run': return 'Microservices backend haute réactivité conteneurisés';
      case 'api-supabase': return 'Synchronisation PostgreSQL avec politiques RLS du panier, favoris et commandes';
      default: return 'Service mobilisé pour l’application Client';
    }
  } else {
    switch (apiId) {
      case 'api-rodium-gpt6':
      case 'api-gpt6-luna': return 'Rédaction fiches produits, studio Qwen Image 2.1 Turbo et vidéos 5s MiniMax H3 Max Turbo';
      case 'api-geniuspay': return 'Encaissements marchands & reversements directs Wave / Orange Money';
      case 'api-gmaps':
      case 'api-google-maps': return 'Localisation précise du magasin physique sur la carte';
      case 'api-fcm':
      case 'api-push': return 'Alertes push FCM de nouvelle commande à préparer';
      case 'api-cloudflare-r2': return 'Hébergement haute performance des catalogues, bilans et vitrines';
      case 'api-cloud-run': return 'Traitement d’arrière-plan des fiches marchands';
      case 'api-supabase': return 'Gestion PostgreSQL RLS des stocks, boutiques et commandes vendeurs';
      default: return 'Service mobilisé pour l’application Vendeur';
    }
  }
};

export interface ApiPricingTier {
  label: string;
  volumeOrFeature: string;
  priceFCFA: string;
  isPopular?: boolean;
}

export const getApiPricingTiers = (apiId: string): { title: string; subtitle?: string; tiers: ApiPricingTier[] } | null => {
  switch (apiId) {
    case 'api-rodium-gpt6':
    case 'api-gpt6-luna':
      return {
        title: 'Tarifs RodiumAI — MiniMax & Qwen 2.1 Turbo',
        subtitle: 'Modèles autorisés : MiniMax M3.1 Flash, Qwen Image 2.1 Turbo, MiniMax H3 Max Turbo, MiniMax H3',
        tiers: [
          { label: 'Prix par million de tokens', volumeOrFeature: '1 Million de tokens', priceFCFA: '1 000 F', isPopular: true },
          { label: 'Prix par requête standard', volumeOrFeature: 'Par appel prompt court', priceFCFA: '50 F' },
          { label: 'Prix par image générée', volumeOrFeature: 'Qwen Image 2.1 Turbo', priceFCFA: '100 F' },
          { label: 'Prix par vidéo générée', volumeOrFeature: 'MiniMax H3 Max Turbo 5s', priceFCFA: '450 F' }
        ]
      };
    case 'api-gmaps':
    case 'api-google-maps':
      return {
        title: 'Tarifs Google Maps Platform',
        subtitle: 'Services géographiques et cartographiques',
        tiers: [
          { label: 'Affichage de carte', volumeOrFeature: '1 000 affichages standard', priceFCFA: '1 610 F', isPopular: true },
          { label: 'Calcul d’itinéraire', volumeOrFeature: '1 000 routes routières', priceFCFA: '3 220 F' },
          { label: 'Recherche de lieu & Places', volumeOrFeature: '1 000 autocomplétions', priceFCFA: '1 850 F' }
        ]
      };
    case 'api-cloudflare-r2':
      return {
        title: 'Tarifs Cloudflare R2',
        subtitle: 'Stockage cloud S3 sans frais de bande passante',
        tiers: [
          { label: 'Stockage mensuel 10 Go', volumeOrFeature: '10 Go inclus', priceFCFA: '0 F' },
          { label: 'Stockage mensuel 50 Go', volumeOrFeature: '50 Go', priceFCFA: '439,50 F' },
          { label: 'Stockage mensuel 100 Go', volumeOrFeature: '100 Go', priceFCFA: '879 F', isPopular: true },
          { label: 'Bande passante (Egress)', volumeOrFeature: 'Trafic sortant illimité', priceFCFA: '0 F (Gratuit)' }
        ]
      };
    default:
      return null;
  }
};

export interface ApiConsumptionItem {
  id: string;
  name: string;
  provider: string;
  category: 'ai' | 'maps' | 'payment' | 'sms' | 'storage' | 'push' | 'cloud';
  usedCalls: number;
  maxQuota: number;
  unit: string;
  costPerUnitFCFA: number;
  estimatedCostFCFA: number;
  revenueGeneratedFCFA?: number;
  status: 'healthy' | 'warning' | 'degraded' | 'down';
  latencyMs: number;
  errorRate: number;
  resetDate: string;
  endpoint: string;
  rateLimitPerMin: number;
  economyModeEnabled: boolean;
  environment: 'production' | 'sandbox';
  lastPingTimestamp: string;
  keyMasked: string;
  description: string;
  budgetLimitFCFA?: number;
  providerBalanceFCFA?: number;
  lastSync?: string;
  lastError?: string;
  keyConfigured?: boolean;
}

export interface ApiLogEntry {
  id: string;
  timestamp: string;
  apiName: string;
  method: 'GET' | 'POST' | 'WEBHOOK';
  endpoint: string;
  statusCode: number;
  latencyMs: number;
  payloadSizeKb: number;
  originApp: 'client' | 'seller' | 'admin';
}

export interface ApiConsumptionRecord {
  id: string;
  apiId: string;
  timestamp: string;
  date: string;
  userOrStore: string;
  role: 'client' | 'seller' | 'system';
  action: string;
  endpoint: string;
  unitsConsumed: number;
  unit: string;
  costFCFA: number;
  revenueFCFA: number;
  profitFCFA: number;
  statusCode: number;
  latencyMs: number;
  details?: string;
}

export const SAMPLE_CONSUMPTIONS_MAP: Record<string, ApiConsumptionRecord[]> = {};

export const getSampleConsumptionsForApi = (api: ApiConsumptionItem): ApiConsumptionRecord[] => {
  return [
    {
      id: `cso-${api.id}-1`,
      apiId: api.id,
      timestamp: '09:15',
      date: '26/11/2025',
      userOrStore: 'Client #4829',
      role: 'client',
      action: 'Génération d\'image',
      endpoint: api.endpoint,
      unitsConsumed: 1,
      unit: 'image',
      costFCFA: 150,
      revenueFCFA: 300,
      profitFCFA: 150,
      statusCode: 200,
      latencyMs: api.latencyMs,
      details: 'Opération réussie'
    }
  ];
};

export interface ApiRechargeRecord {
  id: string;
  apiId: string;
  apiName: string;
  amountFCFA: number;
  unitsAdded: number;
  paymentMethod: string;
  date: string;
  operatorRef: string;
  adminName: string;
}

// =============================================================================
// PROVIDER MODELS (MATCHING THE 3-SCREEN REFERENCE DESIGN)
// =============================================================================

export interface OfficialRateItem {
  service: string;
  priceFCFA: string;
}

export interface AppConsumptionItem {
  key: 'client' | 'seller' | 'admin';
  label: string;
  volume: string;
  costFCFA: number;
}

export interface ProviderOperation {
  id: string;
  type: string;
  app: string;
  volumeAndCost: string;
  costFCFA: number;
  date: string;
  status: 'success' | 'failed';
  endpoint: string;
  latencyMs: number;
  statusCode: number;
  details?: string;
  method?: 'GET' | 'POST' | 'PUT';
  userLabel?: string;
  subscriptionPlan?: 'Djassa Pro' | 'Djassa Business' | 'Standard (Gratuit)' | 'Système Interne';
  sanitizedResponse?: string;
}

export interface ProviderConfigChange {
  id: string;
  date: string;
  admin: string;
  parameter: string;
  oldValue: string;
  newValue: string;
}

export interface ProviderFinancialParams {
  userPricePerQuestionFCFA: number;
  creditsDebitedPerQuestion: number;
  realCostPerQuestionFCFA: number;
  supplierFeePerQuestionFCFA: number;
  supplierFeeNote?: string;
}

export interface ApiProvider {
  id: string;
  name: string;
  category: string;
  iconType: 'google' | 'maps' | 'cloudflare' | 'supabase' | 'geniuspay' | 'cloudrun' | 'fcm' | 'firestore' | 'sms';
  costFCFA: number;
  revenueFCFA: number;
  budgetLimitFCFA: number;
  consumptionPercent: number;
  keyConfigured: boolean;
  providerBalanceFCFA: number;
  lastSync: string;
  lastError: string;
  isConnected: boolean;
  officialRates: OfficialRateItem[];
  appConsumptions: AppConsumptionItem[];
  quotas: {
    total: number;
    consumed: number;
    remaining: number;
    percent: number;
  };
  operations: ProviderOperation[];
  endpoint: string;
  rateLimitPerMin: number;
  economyModeEnabled: boolean;
  financialParams?: ProviderFinancialParams;
  budgetAlertEnabled?: boolean;
  configHistory?: ProviderConfigChange[];
}

const INITIAL_PROVIDERS: ApiProvider[] = [
  {
    id: 'api-gpt6-luna',
    name: 'RodiumAI (MiniMax & Qwen)',
    category: 'Intelligence artificielle',
    iconType: 'google',
    costFCFA: 5000,
    revenueFCFA: 8000,
    budgetLimitFCFA: 10000,
    consumptionPercent: 50,
    keyConfigured: true,
    providerBalanceFCFA: 15000,
    lastSync: '26/11/2025 à 09:15',
    lastError: 'Aucune',
    isConnected: true,
    officialRates: [
      { service: 'Prix par million de tokens', priceFCFA: '1 000 F' },
      { service: 'Prix par requête', priceFCFA: '50 F' },
      { service: 'Prix par image (Qwen 2.1 Turbo)', priceFCFA: '100 F' },
      { service: 'Prix par vidéo (MiniMax H3 Max Turbo)', priceFCFA: '450 F' },
      { service: 'Prompt entrée (1M tokens)', priceFCFA: '58,60 F' },
      { service: 'Réponse sortie (1M tokens)', priceFCFA: '293,00 F' }
    ],
    appConsumptions: [
      { key: 'client', label: 'Application Client', volume: '2 500 tokens', costFCFA: 2500 },
      { key: 'seller', label: 'Application Vendeur', volume: '1 800 tokens', costFCFA: 1800 },
      { key: 'admin', label: 'Application Administrateur', volume: '300 requêtes', costFCFA: 300 }
    ],
    quotas: {
      total: 10000,
      consumed: 5000,
      remaining: 5000,
      percent: 50
    },
    operations: [
      {
        id: 'op-1',
        type: 'Génération d\'image',
        app: 'Application Client',
        volumeAndCost: '150 F • 1 image',
        costFCFA: 150,
        date: '26/11/2025 • 09:15',
        status: 'success',
        endpoint: '/v1/images/generations',
        latencyMs: 145,
        statusCode: 200,
        details: 'Génération visuel Qwen Image 2.1 Turbo 1024x1024'
      },
      {
        id: 'op-2',
        type: 'Discussion RodiumAI MiniMax',
        app: 'Application Vendeur',
        volumeAndCost: '50 F • 1000 tokens',
        costFCFA: 50,
        date: '26/11/2025 • 08:45',
        status: 'success',
        endpoint: '/v1/chat/completions',
        latencyMs: 82,
        statusCode: 200,
        details: 'Assistance négociation et rédaction fiche produit wax'
      },
      {
        id: 'op-5',
        type: 'Service interne',
        app: 'Administrateur',
        volumeAndCost: '30 F • 500 requêtes',
        costFCFA: 30,
        date: '24/11/2025 • 14:10',
        status: 'success',
        endpoint: '/v1/admin/health-audit',
        latencyMs: 24,
        statusCode: 200,
        details: 'Audit automatique de santé système Djassa'
      }
    ],
    endpoint: 'api.rodiumai.io/v1/chat/completions',
    rateLimitPerMin: 300,
    economyModeEnabled: true
  },
  {
    id: 'api-google-maps',
    name: 'Google Maps',
    category: 'Cartographie & géolocalisation',
    iconType: 'maps',
    costFCFA: 3000,
    revenueFCFA: 5000,
    budgetLimitFCFA: 8000,
    consumptionPercent: 63,
    keyConfigured: true,
    providerBalanceFCFA: 25000,
    lastSync: '26/11/2025 à 09:12',
    lastError: 'Aucune',
    isConnected: true,
    officialRates: [
      { service: 'Prix par affichage de carte', priceFCFA: '1,61 F' },
      { service: 'Prix par calcul d\'itinéraire', priceFCFA: '3,22 F' },
      { service: 'Prix par recherche Places', priceFCFA: '1,85 F' },
      { service: 'Forfait Essentials 100k', priceFCFA: '161 150 F' }
    ],
    appConsumptions: [
      { key: 'client', label: 'Application Client', volume: '1 200 affichages', costFCFA: 1200 },
      { key: 'seller', label: 'Application Vendeur', volume: '800 affichages', costFCFA: 800 },
      { key: 'admin', label: 'Application Administrateur', volume: '100 requêtes', costFCFA: 100 }
    ],
    quotas: {
      total: 8000,
      consumed: 5000,
      remaining: 3000,
      percent: 63
    },
    operations: [
      {
        id: 'op-m1',
        type: 'Affichage de carte',
        app: 'Application Client',
        volumeAndCost: '100 F • 1000 affichages',
        costFCFA: 100,
        date: '25/11/2025 • 17:30',
        status: 'success',
        endpoint: 'maps.googleapis.com/maps/api/js',
        latencyMs: 34,
        statusCode: 200,
        details: 'Carte des boutiques à Abidjan'
      }
    ],
    endpoint: 'routes.googleapis.com/directions/v2',
    rateLimitPerMin: 300,
    economyModeEnabled: false
  },
  {
    id: 'api-cloudflare-r2',
    name: 'Cloudflare R2',
    category: 'Stockage & diffusion',
    iconType: 'cloudflare',
    costFCFA: 2000,
    revenueFCFA: 3500,
    budgetLimitFCFA: 7000,
    consumptionPercent: 29,
    keyConfigured: true,
    providerBalanceFCFA: 18500,
    lastSync: '26/11/2025 à 09:10',
    lastError: 'Aucune',
    isConnected: true,
    officialRates: [
      { service: 'Stockage mensuel 10 Go', priceFCFA: '0 F' },
      { service: 'Stockage mensuel 50 Go', priceFCFA: '439,50 F' },
      { service: 'Stockage mensuel 100 Go', priceFCFA: '879 F' },
      { service: 'Bande passante (Egress)', priceFCFA: '0 F (Gratuit)' }
    ],
    appConsumptions: [
      { key: 'client', label: 'Application Client', volume: '15 Go médias', costFCFA: 800 },
      { key: 'seller', label: 'Application Vendeur', volume: '25 Go vitrines', costFCFA: 700 },
      { key: 'admin', label: 'Application Administrateur', volume: '1 Go logs', costFCFA: 50 }
    ],
    quotas: {
      total: 7000,
      consumed: 2000,
      remaining: 5000,
      percent: 29
    },
    operations: [
      {
        id: 'op-cf1',
        type: 'Upload photo produit',
        app: 'Application Vendeur',
        volumeAndCost: '45 F • 12 Mo',
        costFCFA: 45,
        date: '26/11/2025 • 08:30',
        status: 'success',
        endpoint: 'djassa.r2.cloudflarestorage.com/products',
        latencyMs: 45,
        statusCode: 200,
        details: 'Photo haute résolution catalogue'
      }
    ],
    endpoint: 'djassa.r2.cloudflarestorage.com',
    rateLimitPerMin: 1500,
    economyModeEnabled: true
  },
  {
    id: 'api-supabase',
    name: 'Supabase PostgreSQL & Auth',
    category: 'Base SQL relationnelle & Auth (RLS)',
    iconType: 'supabase',
    costFCFA: 1500,
    revenueFCFA: 4200,
    budgetLimitFCFA: 6000,
    consumptionPercent: 25,
    keyConfigured: true,
    providerBalanceFCFA: 12000,
    lastSync: '26/11/2025 à 09:14',
    lastError: 'Aucune',
    isConnected: true,
    officialRates: [
      { service: 'Base PostgreSQL & Auth RLS', priceFCFA: 'Inclus Pro' },
      { service: 'Connexions temps réel', priceFCFA: 'Selon volume' },
      { service: 'Sauvegarde PITR', priceFCFA: '110 F / Go' }
    ],
    appConsumptions: [
      { key: 'client', label: 'Application Client', volume: '22 000 requêtes SQL', costFCFA: 600 },
      { key: 'seller', label: 'Application Vendeur', volume: '12 000 écritures', costFCFA: 500 },
      { key: 'admin', label: 'Application Administrateur', volume: '1 500 queries', costFCFA: 50 }
    ],
    quotas: {
      total: 6000,
      consumed: 1500,
      remaining: 4500,
      percent: 25
    },
    operations: [
      {
        id: 'op-sup1',
        type: 'Requête PostgreSQL RLS',
        app: 'Application Client',
        volumeAndCost: '10 F • 250 ops',
        costFCFA: 10,
        date: '26/11/2025 • 09:10',
        status: 'success',
        endpoint: 'supabase.co/rest/v1/orders',
        latencyMs: 24,
        statusCode: 200,
        details: 'Mise à jour commande et panier avec politique RLS'
      }
    ],
    endpoint: 'supabase.co/rest/v1',
    rateLimitPerMin: 5000,
    economyModeEnabled: true
  },
  {
    id: 'api-geniuspay',
    name: 'GeniusPay Paiements',
    category: 'Paiements Mobile Money & Cartes',
    iconType: 'geniuspay',
    costFCFA: 4500,
    revenueFCFA: 7000,
    budgetLimitFCFA: 10000,
    consumptionPercent: 45,
    keyConfigured: true,
    providerBalanceFCFA: 22000,
    lastSync: '26/11/2025 à 09:08',
    lastError: 'Aucune',
    isConnected: true,
    officialRates: [
      { service: 'Frais client en ligne (Wave / OM)', priceFCFA: '6,5% (0% COD)' },
      { service: 'Commission fixe DJASSA', priceFCFA: '150 F / cmd' },
      { service: 'Reversement direct vendeur', priceFCFA: 'Wave / OM' }
    ],
    appConsumptions: [
      { key: 'client', label: 'Application Client', volume: '2 000 paiements', costFCFA: 2000 },
      { key: 'seller', label: 'Application Vendeur', volume: '1 200 reversements', costFCFA: 1200 },
      { key: 'admin', label: 'Application Administrateur', volume: '200 audits webhook', costFCFA: 200 }
    ],
    quotas: {
      total: 10000,
      consumed: 4500,
      remaining: 5500,
      percent: 45
    },
    operations: [
      {
        id: 'op-gp1',
        type: 'Encaissement GeniusPay Mobile Money',
        app: 'Application Client',
        volumeAndCost: '150 F • 1 tx',
        costFCFA: 150,
        date: '26/11/2025 • 09:05',
        status: 'success',
        endpoint: 'api.geniuspay.ci/v1/payments',
        latencyMs: 78,
        statusCode: 200,
        details: 'Webhook HMAC signé Orange / MTN / Wave CI'
      }
    ],
    endpoint: 'api.geniuspay.ci/v1',
    rateLimitPerMin: 120,
    economyModeEnabled: true
  },
  {
    id: 'api-fcm',
    name: 'Firebase Cloud Messaging (FCM)',
    category: 'Notifications Push temps réel',
    iconType: 'fcm',
    costFCFA: 0,
    revenueFCFA: 2400,
    budgetLimitFCFA: 3000,
    consumptionPercent: 0,
    keyConfigured: true,
    providerBalanceFCFA: 0,
    lastSync: '26/11/2025 à 09:12',
    lastError: 'Aucune',
    isConnected: true,
    officialRates: [
      { service: 'Notifications Push FCM', priceFCFA: '0 F (Gratuit)' },
      { service: 'Envoi par topics & tokens', priceFCFA: '0 F' }
    ],
    appConsumptions: [
      { key: 'client', label: 'Application Client', volume: '4 500 push', costFCFA: 0 },
      { key: 'seller', label: 'Application Vendeur', volume: '1 800 alertes', costFCFA: 0 },
      { key: 'admin', label: 'Application Administrateur', volume: '300 alertes sécu', costFCFA: 0 }
    ],
    quotas: {
      total: 3000,
      consumed: 0,
      remaining: 3000,
      percent: 0
    },
    operations: [
      {
        id: 'op-fcm1',
        type: 'Notification Push FCM',
        app: 'Application Client',
        volumeAndCost: '0 F • 1 push',
        costFCFA: 0,
        date: '26/11/2025 • 09:11',
        status: 'success',
        endpoint: 'fcm.googleapis.com/v1/projects/djassa/messages:send',
        latencyMs: 52,
        statusCode: 200,
        details: 'Notification suivi commande expédiée'
      }
    ],
    endpoint: 'fcm.googleapis.com/v1',
    rateLimitPerMin: 2000,
    economyModeEnabled: true
  },
  {
    id: 'api-cloud-run',
    name: 'Google Cloud Run',
    category: 'Microservices & calcul cloud',
    iconType: 'cloudrun',
    costFCFA: 3200,
    revenueFCFA: 6000,
    budgetLimitFCFA: 8000,
    consumptionPercent: 40,
    keyConfigured: true,
    providerBalanceFCFA: 30000,
    lastSync: '26/11/2025 à 09:14',
    lastError: 'Aucune',
    isConnected: true,
    officialRates: [
      { service: 'CPU vCPU-seconde', priceFCFA: '0,0105 F' },
      { service: 'Mémoire Gio-seconde', priceFCFA: '0,0012 F' },
      { service: 'Requêtes microservices', priceFCFA: 'Selon volume' }
    ],
    appConsumptions: [
      { key: 'client', label: 'Application Client', volume: '800 000 vCPU-s', costFCFA: 1400 },
      { key: 'seller', label: 'Application Vendeur', volume: '500 000 vCPU-s', costFCFA: 900 },
      { key: 'admin', label: 'Application Administrateur', volume: '100 000 vCPU-s', costFCFA: 150 }
    ],
    quotas: {
      total: 8000,
      consumed: 3200,
      remaining: 4800,
      percent: 40
    },
    operations: [
      {
        id: 'op-cr1',
        type: 'Traitement commandes boutique',
        app: 'Application Vendeur',
        volumeAndCost: '35 F • 1 200 ms',
        costFCFA: 35,
        date: '26/11/2025 • 08:50',
        status: 'success',
        endpoint: 'djassa-backend-run.a.run.app',
        latencyMs: 38,
        statusCode: 200,
        details: 'Calcul du batch de commandes'
      }
    ],
    endpoint: 'djassa-backend-run.a.run.app',
    rateLimitPerMin: 3000,
    economyModeEnabled: true
  }
];

// =============================================================================
// SUB-COMPONENTS: LOGOS & CIRCULAR PROGRESS (DARK THEME OPTIMIZED)
// =============================================================================

export const ProviderIcon: React.FC<{ type: ApiProvider['iconType']; className?: string }> = ({ type, className = 'w-9 h-9' }) => {
  switch (type) {
    case 'google':
      return (
        <svg className={className} viewBox="0 0 24 24">
          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
        </svg>
      );
    case 'maps':
      return (
        <svg className={className} viewBox="0 0 48 48">
          <path fill="#4385F4" d="M24 4C14.06 4 6 12.06 6 22c0 8.08 6.2 16.59 16.27 24.87a2.7 2.7 0 0 0 3.46 0C35.8 38.59 42 30.08 42 22 42 12.06 33.94 4 24 4z"/>
          <circle fill="#fff" cx="24" cy="20" r="7.5"/>
          <path fill="#EA4335" d="M24 12.5c4.14 0 7.5 3.36 7.5 7.5 0 2.87-1.61 5.36-3.97 6.6l-3.53 11.4-3.53-11.4A7.49 7.49 0 0 1 16.5 20c0-4.14 3.36-7.5 7.5-7.5z"/>
          <path fill="#34A853" d="M24 16a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>
        </svg>
      );
    case 'cloudflare':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="#F38020">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
        </svg>
      );
    case 'supabase':
      return (
        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-black text-xs shadow-inner">
          SUPA
        </div>
      );
    case 'geniuspay':
      return (
        <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 flex items-center justify-center font-black text-xs shadow-inner">
          GPAY
        </div>
      );
    case 'firestore':
    case 'fcm':
      return (
        <svg className={className} viewBox="0 0 24 24">
          <path fill="#FFA000" d="m3.89 15.67 1.4-9.1a.9.9 0 0 1 1.63-.37l2.87 5.33-5.9 4.14z"/>
          <path fill="#F57C00" d="M13.78 8.66 9.8 1.44a.9.9 0 0 0-1.62.13L3.89 15.67l9.89-7.01z"/>
          <path fill="#FFCA28" d="m14.28 20.73 5.83-3.26a.9.9 0 0 0 .38-1.07l-3.2-11.5a.9.9 0 0 0-1.64-.17L3.89 15.67l10.39 5.06z"/>
        </svg>
      );
    case 'sms':
      return (
        <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-black text-xs shadow-inner">
          PAY
        </div>
      );
    case 'cloudrun':
      return (
        <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-black text-xs shadow-inner">
          RUN
        </div>
      );
    default:
      return (
        <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
          <Layers className="w-5 h-5" />
        </div>
      );
  }
};

// =============================================================================
// MAIN COMPONENT (HARMONIZED WITH DJASSA ADMIN DARK THEME)
// =============================================================================

export const AdminApiSection: React.FC = () => {
  const { showToast } = useApp();

  // Navigation tab: 'providers' (Fournisseurs) or 'reports' (Rapports)
  const [activeMainTab, setActiveMainTab] = useState<'providers' | 'reports'>('providers');

  // Currently selected provider for Detail Screen (null = main list)
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  // Providers state (stored in localStorage for persistence)
  const [providers, setProviders] = useState<ApiProvider[]>(() => {
    const saved = localStorage.getItem('djassa_admin_api_providers_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasLegacyProvider = parsed.some(
            (p: any) => p.id === 'api-firebase-firestore' || p.id === 'api-sms-gateway' || p.name === 'GPT-6 Luna'
          );
          if (!hasLegacyProvider) return parsed;
        }
      } catch (e) {
        // fallback
      }
    }
    return INITIAL_PROVIDERS;
  });

  const saveProviders = (next: ApiProvider[]) => {
    setProviders(next);
    localStorage.setItem('djassa_admin_api_providers_v2', JSON.stringify(next));
  };

  // Currently active provider object
  const activeProvider = useMemo(() => {
    if (!selectedProviderId) return null;
    return providers.find(p => p.id === selectedProviderId) || null;
  }, [providers, selectedProviderId]);

  const syncFromServer = useCallback(async () => {
    if (!getSecurityToken()) return;
    try {
      const [statusRes, statsRes, cpProvidersRes] = await Promise.all([
        creditsService.getAiStatus().catch(() => null),
        creditsService.getAdminStats().catch(() => null),
        securityService.getControlPlaneProviders().catch(() => null)
      ]);
      const now = new Date();
      const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} à ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const cpMap = new Map<string, any>(
        (cpProvidersRes?.providers || []).map((item: any) => [String(item.providerKey).toLowerCase(), item])
      );
      setProviders((prev) => {
        const next = prev.map((p) => {
          const cpMatch =
            (p.id.includes('gpt6') || p.id.includes('rodium')) ? cpMap.get('rodiumai')
            : p.id.includes('geniuspay') ? cpMap.get('geniuspay')
            : p.id.includes('supabase') ? cpMap.get('supabase')
            : p.id.includes('fcm') ? cpMap.get('fcm')
            : undefined;
          if (p.id === 'api-gpt6-luna' && statusRes?.providers?.rodiumAi) {
            const aiConfigured = Boolean(statusRes.providers.rodiumAi.configured || cpMatch?.hasEncryptedSecret);
            const fin = statsRes?.financials;
            return {
              ...p,
              keyConfigured: aiConfigured,
              isConnected: aiConfigured,
              budgetLimitFCFA: cpMatch?.monthlyLimitFcfa ?? p.budgetLimitFCFA,
              lastSync: dateStr,
              lastError: aiConfigured ? 'Aucune' : 'Variable RODIUMAI_API_KEY manquante côté serveur',
              costFCFA: fin ? Math.round(fin.totalRealApiCostFcfa) : p.costFCFA,
              revenueFCFA: fin ? Math.round(fin.totalConsumedRevenueFcfa) : p.revenueFCFA
            };
          }
          if (p.id === 'api-google-maps' && statusRes?.providers?.googleMaps) {
            const mapsConfigured = Boolean(statusRes.providers.googleMaps.configured);
            return {
              ...p,
              keyConfigured: mapsConfigured,
              isConnected: mapsConfigured,
              lastSync: dateStr,
              lastError: mapsConfigured ? 'Aucune' : 'Variable GOOGLE_MAPS_API_KEY manquante côté serveur'
            };
          }
          if (p.id === 'api-cloudflare-r2' && statusRes?.providers?.cloudflareR2) {
            const r2Configured = Boolean(statusRes.providers.cloudflareR2.configured);
            return {
              ...p,
              keyConfigured: r2Configured,
              isConnected: r2Configured,
              lastSync: dateStr,
              lastError: r2Configured ? 'Aucune' : 'Variables R2_BUCKET / R2_ACCESS_KEY_ID manquantes côté serveur'
            };
          }
          if (p.id === 'api-supabase' && statusRes?.providers?.supabase) {
            const supaConfigured = Boolean(statusRes.providers.supabase.configured);
            return {
              ...p,
              keyConfigured: supaConfigured,
              isConnected: supaConfigured,
              lastSync: dateStr,
              lastError: supaConfigured ? 'Aucune' : 'Variables SUPABASE_URL / DATABASE_URL manquantes côté serveur'
            };
          }
          if (p.id === 'api-geniuspay' && statusRes?.providers?.geniusPay) {
            const gpConfigured = Boolean(statusRes.providers.geniusPay.configured || cpMatch?.hasEncryptedSecret);
            return {
              ...p,
              keyConfigured: gpConfigured,
              isConnected: gpConfigured,
              budgetLimitFCFA: cpMatch?.monthlyLimitFcfa ?? p.budgetLimitFCFA,
              lastSync: dateStr,
              lastError: gpConfigured ? 'Aucune' : 'Variables GENIUSPAY_API_KEY / GENIUSPAY_WEBHOOK_SECRET manquantes côté serveur'
            };
          }
          if (p.id === 'api-fcm' && statusRes?.providers?.fcm) {
            const fcmConfigured = Boolean(statusRes.providers.fcm.configured);
            return {
              ...p,
              keyConfigured: fcmConfigured,
              isConnected: fcmConfigured,
              lastSync: dateStr,
              lastError: fcmConfigured ? 'Aucune' : 'Variables FCM_PROJECT_ID / FCM_SERVER_KEY manquantes côté serveur'
            };
          }
          if (cpMatch) {
            const configured = Boolean(cpMatch.hasEncryptedSecret || cpMatch.status === 'active' || cpMatch.status === 'sandbox');
            return {
              ...p,
              keyConfigured: configured,
              isConnected: cpMatch.status === 'active' || cpMatch.status === 'sandbox',
              budgetLimitFCFA: cpMatch.monthlyLimitFcfa ?? p.budgetLimitFCFA,
              lastSync: dateStr
            };
          }
          return p;
        });
        localStorage.setItem('djassa_admin_api_providers_v2', JSON.stringify(next));
        return next;
      });
    } catch {
      // keep existing providers snapshot when offline
    }
  }, []);

  useEffect(() => {
    void syncFromServer();
  }, [syncFromServer]);

  const handleRefresh = async () => {
    await syncFromServer();
    showToast('Données synchronisées avec succès');
  };

  // Overall Financial Totals for Rapports
  const reportTotals = useMemo(() => {
    const totalCost = providers.reduce((acc, p) => acc + p.costFCFA, 0);
    const totalRevenue = providers.reduce((acc, p) => acc + p.revenueFCFA, 0);
    const totalLimit = providers.reduce((acc, p) => acc + p.budgetLimitFCFA, 0);
    const totalProfit = totalRevenue - totalCost;
    const percent = totalLimit > 0 ? Math.round((totalCost / totalLimit) * 100) : 0;

    return { totalCost, totalRevenue, totalLimit, totalProfit, percent };
  }, [providers]);

  // ---------------------------------------------------------------------------
  // RENDER: SCREEN 2 (CONSOLE DE GESTION HARMONISÉE PAR FOURNISSEUR)
  // ---------------------------------------------------------------------------

  if (activeProvider) {
    if (activeProvider.id === 'api-gpt6-luna') {
      return (
        <Gpt6LunaConsumptionDetail
          provider={activeProvider}
          onBack={() => setSelectedProviderId(null)}
          onOpenConfig={() => {}}
          onSyncProvider={handleRefresh}
          onUpdateProvider={(updatedProvider) => {
            const next = providers.map(p => (p.id === updatedProvider.id ? updatedProvider : p));
            saveProviders(next);
          }}
        />
      );
    }

    return (
      <ApiProviderDetailConsole
        provider={activeProvider}
        onBack={() => setSelectedProviderId(null)}
        onUpdateProvider={(updatedProvider) => {
          const next = providers.map(p => (p.id === updatedProvider.id ? updatedProvider : p));
          saveProviders(next);
        }}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: SCREEN 1 (PAGE PRINCIPALE — FOURNISSEURS & RAPPORTS EN THEME SOMBRE)
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4 text-white font-sans animate-in fade-in duration-200">
      <div className="max-w-xl mx-auto space-y-4">

        {/* ======================= HEADER SECTION ======================= */}
        <div className="text-center pt-1 pb-1">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Consommation API
          </h1>
          <p className="text-xs sm:text-sm text-white/50 font-medium mt-0.5">
            Suivez vos dépenses et optimisez votre budget
          </p>
        </div>

        {/* ======================= SEGMENTED CONTROL ======================= */}
        <div className="flex max-w-xs mx-auto p-1 bg-white/5 border border-white/10 rounded-full">
          <button
            type="button"
            onClick={() => setActiveMainTab('providers')}
            className={`flex-1 py-2 px-4 rounded-full text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeMainTab === 'providers'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-950/40 font-black'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Fournisseurs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('reports')}
            className={`flex-1 py-2 px-4 rounded-full text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeMainTab === 'reports'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-950/40 font-black'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Rapports</span>
          </button>
        </div>

        {/* ======================= TAB 1: LISTE DES FOURNISSEURS ======================= */}
        {activeMainTab === 'providers' && (
          <div className="space-y-3 pt-1">
            {providers.map((provider) => {
              const remainingFCFA = Math.max(0, provider.budgetLimitFCFA - provider.costFCFA);
              const percent = provider.consumptionPercent;

              // Color of progress bar based on level:
              let barColor = 'bg-cyan-400';
              if (percent > 80) {
                barColor = 'bg-rose-500';
              } else if (percent > 60) {
                barColor = 'bg-emerald-400';
              } else if (percent < 35) {
                barColor = 'bg-teal-400';
              }

              return (
                <div
                  key={provider.id}
                  onClick={() => {
                    setSelectedProviderId(provider.id);
                  }}
                  className="bg-[#141417] rounded-2xl p-4 sm:p-5 border border-white/10 hover:border-cyan-500/40 shadow-lg shadow-black/30 transition active:scale-[0.99] cursor-pointer space-y-3 group"
                >
                  {/* Top row: Icon, Name, Category & Chevron */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                        <ProviderIcon type={provider.iconType} className="w-9 h-9" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-black text-white tracking-tight truncate">
                          {provider.name}
                        </h3>
                        <p className="text-xs text-white/50 font-medium truncate">
                          {provider.category}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-white/40 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition">
                      <ChevronRight className="w-5 h-5 stroke-[2.5]" />
                    </div>
                  </div>

                  {/* 3 Horizontal Financial Indicators */}
                  <div className="grid grid-cols-3 gap-2 py-2 border-t border-b border-white/10 text-xs">
                    <div>
                      <div className="flex items-center gap-1.5 text-white/50 font-medium text-[11px]">
                        <Coins className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>Coût</span>
                      </div>
                      <div className="text-xs sm:text-sm font-black text-white font-mono mt-0.5">
                        {formatFCFA(provider.costFCFA)}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 text-white/50 font-medium text-[11px]">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Bénéfice</span>
                      </div>
                      <div className="text-xs sm:text-sm font-black text-emerald-400 font-mono mt-0.5">
                        {formatFCFA(provider.revenueFCFA)}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 text-white/50 font-medium text-[11px]">
                        <Shield className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span>Plafond</span>
                      </div>
                      <div className="text-xs sm:text-sm font-black text-white font-mono mt-0.5">
                        {formatFCFA(provider.budgetLimitFCFA)}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar & Percentage */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="text-xs font-black text-white font-mono min-w-[36px] text-right">
                      {percent} %
                    </span>
                  </div>

                  {/* Remaining Amount */}
                  <div className="text-xs font-bold text-cyan-400 font-mono">
                    Restant : {formatFCFA(remainingFCFA)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ======================= TAB 2: RAPPORTS FINANCIERS ======================= */}
        {activeMainTab === 'reports' && (
          <div className="space-y-4 pt-1 animate-in fade-in">
            {/* Global Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#141417] p-4 rounded-2xl border border-white/10 shadow-lg shadow-black/40">
                <span className="text-[11px] text-white/50 font-semibold block">Dépenses Totales API</span>
                <div className="text-base sm:text-lg font-black text-rose-400 font-mono mt-1">
                  {formatFCFA(reportTotals.totalCost)}
                </div>
                <span className="text-[10px] text-white/40 block mt-0.5">
                  Sur plafond de {formatFCFA(reportTotals.totalLimit)}
                </span>
              </div>

              <div className="bg-[#141417] p-4 rounded-2xl border border-white/10 shadow-lg shadow-black/40">
                <span className="text-[11px] text-white/50 font-semibold block">Bénéfices Générés</span>
                <div className="text-base sm:text-lg font-black text-emerald-400 font-mono mt-1">
                  {formatFCFA(reportTotals.totalRevenue)}
                </div>
                <span className="text-[10px] text-emerald-400 font-bold block mt-0.5">
                  Marge nette : +{formatFCFA(reportTotals.totalProfit)}
                </span>
              </div>
            </div>

            {/* Breakdown by DJASSA Application */}
            <div className="bg-[#141417] p-4 sm:p-5 rounded-2xl border border-white/10 shadow-lg shadow-black/40 space-y-3.5">
              <h3 className="text-sm font-black text-white">
                Répartition des coûts par application DJASSA
              </h3>

              <div className="space-y-2.5 text-xs">
                {[
                  { name: 'Application Client', cost: 7100, pct: 52, color: 'bg-blue-500' },
                  { name: 'Application Vendeur', cost: 4800, pct: 35, color: 'bg-emerald-500' },
                  { name: 'Application Administrateur', cost: 1800, pct: 13, color: 'bg-purple-500' }
                ].map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between font-medium">
                      <span className="text-white/80">{item.name}</span>
                      <span className="font-mono font-bold text-white">{formatFCFA(item.cost)} ({item.pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top providers */}
            <div className="bg-[#141417] p-4 sm:p-5 rounded-2xl border border-white/10 shadow-lg shadow-black/40 space-y-3">
              <h3 className="text-sm font-black text-white">
                Fournisseurs les plus sollicités
              </h3>

              <div className="divide-y divide-white/5 text-xs">
                {providers.slice(0, 4).map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ProviderIcon type={p.iconType} className="w-6 h-6" />
                      <div className="truncate">
                        <span className="font-bold text-white block truncate">{p.name}</span>
                        <span className="text-[10px] text-white/40 block">{p.category}</span>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <span className="font-black text-white">{formatFCFA(p.costFCFA)}</span>
                      <span className="text-[10px] text-emerald-400 font-bold block">+{formatFCFA(p.revenueFCFA)} gain</span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  const csv = `Fournisseur,Categorie,Cout,Benefice,Plafond\n` +
                    providers.map(p => `"${p.name}","${p.category}",${p.costFCFA},${p.revenueFCFA},${p.budgetLimitFCFA}`).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `rapport_conso_api_djassa_${Date.now()}.csv`;
                  a.click();
                  showToast('Export CSV téléchargé');
                }}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer mt-2"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Exporter le rapport complet (CSV)</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
