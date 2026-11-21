import type { ApiProvider, ProviderConfigChange } from './AdminApiSection';
import type { AdminPlanItem, SubscriptionApiRecord } from './AdminSubscriptionsManager';

export type ProviderTopTab =
  | 'config'
  | 'pricing_balance'
  | 'apps'
  | 'monitoring'
  | 'consumption';

export type ProviderAppKey = 'Client' | 'Vendeur' | 'Admin';

export type ProviderOperatingMode = 'economy' | 'balanced' | 'speed' | 'manual';

export interface ProviderTariffField {
  key: 'rate1' | 'rate2' | 'rate3';
  label: string;
  unitHint: string;
  defaultValue: number;
  step: number;
  editable: boolean;
}

export interface ProviderConfigSelectOption {
  value: string;
  label: string;
}

export interface ProviderConfigFieldDef {
  key: 'param1' | 'param2' | 'param3' | 'param4' | 'param5';
  label: string;
  options: ProviderConfigSelectOption[];
  defaultValue: string;
}

export interface ProviderModeOption {
  id: ProviderOperatingMode;
  title: string;
  desc: string;
}

export interface ProviderNativeAppLimits {
  dailyBudgetFCFA: number;
  monthlyBudgetFCFA: number;
  maxOpsPerDay: number;
  maxOpsPerUser: number;
  subLimitUnits: number;
  autoBlock: boolean;
}

export interface ProviderExtendedSettings {
  apiKeyMasked: string;
  param1: string;
  param2: string;
  param3: string;
  param4: string;
  param5: string;
  timeoutSec: number;
  rate1: number;
  rate2: number;
  rate3: number;
  targetBalanceOrBudgetFCFA: number;
  minAlertFCFA: number;
  rechargeOrProvisionThresholdFCFA: number;
  rechargeOrProvisionAmountFCFA: number;
  operatingMode: ProviderOperatingMode;
  checkInterval: '1m' | '5m' | '15m';
  alertsEnabled: boolean;
  abnormalAlertEnabled: boolean;
  budgetOverrunAlertEnabled: boolean;
  lowBalanceAlertEnabled: boolean;
  alertMode: 'internal' | 'push_email';
  autoSync: boolean;
}

export interface ProviderTransactionEntry {
  id: string;
  title: string;
  subtitle: string;
  date: string;
  amount: string;
  status: 'Réussie' | 'Validée' | 'Échouée' | 'En attente';
  afterLabel: string;
  type: 'auto' | 'manual' | 'invoice' | 'failed';
}

export interface ProviderOperationItem {
  id: string;
  timestampIso: string;
  dateLabel: string;
  timeLabel: string;
  app: 'Client' | 'Vendeur' | 'Administrateur';
  subscriptionName: string;
  userId: string;
  userName: string;
  userAvatar: string;
  opType: string;
  serviceTarget: string;
  endpoint: string;
  primaryQty: number;
  primaryUnit: string;
  secondaryQty: number;
  secondaryUnit: string;
  latencyMs: number;
  status: 'success' | 'failed' | 'pending';
  httpCode: number;
  billedByProvider: boolean;
  unitCostFCFA: number;
  feeCostFCFA: number;
  realCostFCFA: number;
  revenueFCFA: number;
  estimatedProfitFCFA: number;
  providerTraceId: string;
  errorReason?: string;
  sanitizedPreview: string;
}

export interface ProviderRolePlanQuota {
  id: string;
  name: string;
  badge: string;
  priceLabel: string;
  nativeQuota: number;
  nativeUnit: string;
  dailyLimit: number;
  monthlyLimit: number;
  activeUsers: number;
  consumedNative: number;
  realCostFCFA: number;
}

export interface ProviderProfile {
  id: string;
  supplierName: string;
  serviceType: string;
  apiName: string;
  serviceIdentifierLabel: string;
  serviceIdentifierValue: string;
  baseEndpoint: string;
  endpointPills: string[];
  defaultMaskedKey: string;
  supportsLiveApiBalance: boolean;
  balanceCardTitle: string;
  balanceUnavailableReason?: string;
  supportsOfficialPricingSync: boolean;
  pricingSyncNote: string;
  freeTierEgressNote?: string;
  tariffFields: ProviderTariffField[];
  configFields: ProviderConfigFieldDef[];
  operatingModes: ProviderModeOption[];
  nativeUnitSingular: string;
  nativeUnitPlural: string;
  primaryMetricLabel: string;
  secondaryMetricLabel: string;
  operationNoun: string;
  defaultSettings: ProviderExtendedSettings;
  defaultAppLimits: Record<ProviderAppKey, ProviderNativeAppLimits>;
  extraRolePlans: Record<'Admin', ProviderRolePlanQuota[]>;
}

const AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'
];

export const PROVIDER_PROFILES: Record<string, ProviderProfile> = {
  'api-google-maps': {
    id: 'api-google-maps',
    supplierName: 'Google Cloud Platform',
    serviceType: 'Cartographie, itinéraires & géocodage',
    apiName: 'Google Maps Platform (Maps JS / Routes v2)',
    serviceIdentifierLabel: 'Service / Project ID',
    serviceIdentifierValue: 'routes.googleapis.com • djassa-maps-prod',
    baseEndpoint: 'https://routes.googleapis.com/directions/v2',
    endpointPills: ['/maps/api/js', '/directions/v2:computeRoutes', '/geocode/json', '/places:autocomplete'],
    defaultMaskedKey: 'AIza••••••••••••••9xKp',
    supportsLiveApiBalance: false,
    balanceCardTitle: 'Solde fournisseur (Compte Cloud Billing)',
    balanceUnavailableReason: 'Solde non disponible via API — Facturation post-payée Google Cloud Billing. Suivi piloté par budget interne DJASSA.',
    supportsOfficialPricingSync: false,
    pricingSyncNote: 'Tarifs officiels Google Maps Platform saisis en FCFA (conversion Cloud Billing USD → FCFA).',
    tariffFields: [
      { key: 'rate1', label: 'Affichage de carte', unitHint: 'pour 1 000 vues', defaultValue: 1610, step: 10, editable: true },
      { key: 'rate2', label: 'Calcul d\'itinéraire (Routes v2)', unitHint: 'pour 1 000 trajets', defaultValue: 3220, step: 10, editable: true },
      { key: 'rate3', label: 'Géocodage & Places', unitHint: 'pour 1 000 requêtes', defaultValue: 1850, step: 10, editable: true }
    ],
    configFields: [
      {
        key: 'param1',
        label: 'Module cartographique actif :',
        defaultValue: 'Maps JS + Routes API v2',
        options: [
          { value: 'Maps JS + Routes API v2', label: 'Maps JS + Routes v2' },
          { value: 'Static Maps + Routes v2', label: 'Static Maps + Routes v2' },
          { value: 'Routes v2 + Places Autocomplete', label: 'Routes + Places' }
        ]
      },
      {
        key: 'param2',
        label: 'Zone de restriction géographique :',
        defaultValue: 'Côte d\'Ivoire (CI)',
        options: [
          { value: 'Côte d\'Ivoire (CI)', label: 'Côte d\'Ivoire (CI)' },
          { value: 'Afrique de l\'Ouest (UEMOA)', label: 'Zone UEMOA' },
          { value: 'Globale (Restreinte App)', label: 'Globale restreinte' }
        ]
      },
      {
        key: 'param3',
        label: 'Cache géocodage & tuiles :',
        defaultValue: 'Activé (TTL 7 jours)',
        options: [
          { value: 'Activé (TTL 7 jours)', label: 'Activé (7 jours)' },
          { value: 'Activé (TTL 24 heures)', label: 'Activé (24h)' },
          { value: 'Désactivé (Direct API)', label: 'Désactivé' }
        ]
      },
      {
        key: 'param4',
        label: 'Précision trafic routier :',
        defaultValue: 'Trafic temps réel Abidjan',
        options: [
          { value: 'Trafic temps réel Abidjan', label: 'Temps réel (TRAFFIC_AWARE)' },
          { value: 'Routage standard sans trafic', label: 'Standard (ROUTING_UNSPECIFIED)' }
        ]
      },
      {
        key: 'param5',
        label: 'Restriction domaine / clé :',
        defaultValue: '*.djassa.ci + Android SHA-256',
        options: [
          { value: '*.djassa.ci + Android SHA-256', label: 'djassa.ci + Android' },
          { value: 'Serveur Cloud Run uniquement', label: 'Backend uniquement' }
        ]
      }
    ],
    operatingModes: [
      { id: 'economy', title: 'Mode Économie', desc: 'Cache tuiles 7j + cartes statiques sans trafic continu.' },
      { id: 'balanced', title: 'Mode Équilibré', desc: 'Routes v2 optimisées + cache géocodage activé.' },
      { id: 'speed', title: 'Mode Vitesse', desc: 'Trafic temps réel continu & rafraîchissement GPS 5s.' },
      { id: 'manual', title: 'Mode Manuel', desc: 'Plafonds et quotas appliqués manuellement par app.' }
    ],
    nativeUnitSingular: 'requête Maps',
    nativeUnitPlural: 'req. Maps',
    primaryMetricLabel: 'Vues carte / Itinéraires',
    secondaryMetricLabel: 'Géocodages',
    operationNoun: 'requête cartographique',
    defaultSettings: {
      apiKeyMasked: 'AIza••••••••••••••9xKp',
      param1: 'Maps JS + Routes API v2',
      param2: 'Côte d\'Ivoire (CI)',
      param3: 'Activé (TTL 7 jours)',
      param4: 'Trafic temps réel Abidjan',
      param5: '*.djassa.ci + Android SHA-256',
      timeoutSec: 15,
      rate1: 1610,
      rate2: 3220,
      rate3: 1850,
      targetBalanceOrBudgetFCFA: 12000,
      minAlertFCFA: 2000,
      rechargeOrProvisionThresholdFCFA: 6500,
      rechargeOrProvisionAmountFCFA: 8000,
      operatingMode: 'balanced',
      checkInterval: '5m',
      alertsEnabled: true,
      abnormalAlertEnabled: true,
      budgetOverrunAlertEnabled: true,
      lowBalanceAlertEnabled: false,
      alertMode: 'internal',
      autoSync: true
    },
    defaultAppLimits: {
      Client: { dailyBudgetFCFA: 200, monthlyBudgetFCFA: 3000, maxOpsPerDay: 400, maxOpsPerUser: 20, subLimitUnits: 120, autoBlock: true },
      Vendeur: { dailyBudgetFCFA: 150, monthlyBudgetFCFA: 1800, maxOpsPerDay: 250, maxOpsPerUser: 15, subLimitUnits: 150, autoBlock: true },
      Admin: { dailyBudgetFCFA: 80, monthlyBudgetFCFA: 800, maxOpsPerDay: 100, maxOpsPerUser: 50, subLimitUnits: 500, autoBlock: false }
    },
    extraRolePlans: {
      Admin: [
        { id: 'adm-super', name: 'Super Administrateur', badge: 'Supervision CI', priceLabel: 'Interne', nativeQuota: 500, nativeUnit: 'req. Maps', dailyLimit: 40, monthlyLimit: 500, activeUsers: 2, consumedNative: 65, realCostFCFA: 65 },
        { id: 'adm-ops', name: 'Admin Support & Qualité', badge: 'Contrôle zones', priceLabel: 'Interne', nativeQuota: 250, nativeUnit: 'req. Maps', dailyLimit: 20, monthlyLimit: 250, activeUsers: 3, consumedNative: 35, realCostFCFA: 35 }
      ]
    }
  },

  'api-cloudflare-r2': {
    id: 'api-cloudflare-r2',
    supplierName: 'Cloudflare, Inc.',
    serviceType: 'Stockage objet S3 & diffusion média CDN',
    apiName: 'Cloudflare R2 Storage API',
    serviceIdentifierLabel: 'Bucket / Account ID',
    serviceIdentifierValue: 'djassa-media-prod • cf-acc-88412',
    baseEndpoint: 'https://djassa.r2.cloudflarestorage.com',
    endpointPills: ['/products', '/avatars', '/delivery-proofs', '/invoices-pdf'],
    defaultMaskedKey: 'cf_r2_••••••••••••4mPx',
    supportsLiveApiBalance: false,
    balanceCardTitle: 'Solde fournisseur (Facturation Cloudflare)',
    balanceUnavailableReason: 'Solde non disponible via API — Facturation mensuelle Cloudflare post-payée (0 FCFA de bande passante sortante Egress).',
    supportsOfficialPricingSync: false,
    pricingSyncNote: 'Tarifs officiels Cloudflare R2 : 10 Go gratuits inclus puis facturation au Go stocké et opérations Classe A/B.',
    freeTierEgressNote: 'Bande passante sortante (Egress) : 0 FCFA (Gratuit illimité Cloudflare R2)',
    tariffFields: [
      { key: 'rate1', label: 'Stockage mensuel', unitHint: 'par Go (au-delà 10 Go)', defaultValue: 8.79, step: 0.5, editable: true },
      { key: 'rate2', label: 'Opérations Classe A (Upload/Put)', unitHint: 'par million d\'ops', defaultValue: 2700, step: 50, editable: true },
      { key: 'rate3', label: 'Opérations Classe B (Lecture/Get)', unitHint: 'pour 10 millions d\'ops', defaultValue: 2160, step: 50, editable: true }
    ],
    configFields: [
      {
        key: 'param1',
        label: 'Bucket principal actif :',
        defaultValue: 'djassa-media-prod',
        options: [
          { value: 'djassa-media-prod', label: 'djassa-media-prod' },
          { value: 'djassa-media-eu', label: 'djassa-media-eu' },
          { value: 'djassa-backups', label: 'djassa-backups' }
        ]
      },
      {
        key: 'param2',
        label: 'Domaine CDN public :',
        defaultValue: 'cdn.djassa.ci',
        options: [
          { value: 'cdn.djassa.ci', label: 'cdn.djassa.ci (Custom Edge)' },
          { value: 'pub-djassa.r2.dev', label: 'pub-djassa.r2.dev' }
        ]
      },
      {
        key: 'param3',
        label: 'Compression médias auto :',
        defaultValue: 'WebP + AVIF automatique',
        options: [
          { value: 'WebP + AVIF automatique', label: 'WebP + AVIF auto' },
          { value: 'WebP standard', label: 'WebP standard' },
          { value: 'Format original', label: 'Sans compression' }
        ]
      },
      {
        key: 'param4',
        label: 'Politique Cache-Control CDN :',
        defaultValue: 'max-age=2592000 (30 jours)',
        options: [
          { value: 'max-age=2592000 (30 jours)', label: '30 jours (Immuable)' },
          { value: 'max-age=604800 (7 jours)', label: '7 jours' },
          { value: 'max-age=86400 (24h)', label: '24 heures' }
        ]
      },
      {
        key: 'param5',
        label: 'Taille maximale par fichier :',
        defaultValue: '25 Mo / fichier',
        options: [
          { value: '10 Mo / fichier', label: '10 Mo' },
          { value: '25 Mo / fichier', label: '25 Mo' },
          { value: '50 Mo / fichier', label: '50 Mo' }
        ]
      }
    ],
    operatingModes: [
      { id: 'economy', title: 'Mode Économie', desc: 'Compression WebP agressive + cache CDN 30j.' },
      { id: 'balanced', title: 'Mode Équilibré', desc: 'AVIF/WebP HD et mise en cache adaptative.' },
      { id: 'manual', title: 'Mode Manuel', desc: 'Règles d\'expiration et taille gérées manuellement.' }
    ],
    nativeUnitSingular: 'Mo',
    nativeUnitPlural: 'Go / Mo',
    primaryMetricLabel: 'Volume transféré / stocké',
    secondaryMetricLabel: 'Opérations A/B',
    operationNoun: 'opération stockage R2',
    defaultSettings: {
      apiKeyMasked: 'cf_r2_••••••••••••4mPx',
      param1: 'djassa-media-prod',
      param2: 'cdn.djassa.ci',
      param3: 'WebP + AVIF automatique',
      param4: 'max-age=2592000 (30 jours)',
      param5: '25 Mo / fichier',
      timeoutSec: 20,
      rate1: 8.79,
      rate2: 2700,
      rate3: 2160,
      targetBalanceOrBudgetFCFA: 10000,
      minAlertFCFA: 1500,
      rechargeOrProvisionThresholdFCFA: 5500,
      rechargeOrProvisionAmountFCFA: 7000,
      operatingMode: 'economy',
      checkInterval: '5m',
      alertsEnabled: true,
      abnormalAlertEnabled: true,
      budgetOverrunAlertEnabled: true,
      lowBalanceAlertEnabled: false,
      alertMode: 'internal',
      autoSync: true
    },
    defaultAppLimits: {
      Client: { dailyBudgetFCFA: 120, monthlyBudgetFCFA: 2000, maxOpsPerDay: 8000, maxOpsPerUser: 150, subLimitUnits: 15, autoBlock: true },
      Vendeur: { dailyBudgetFCFA: 250, monthlyBudgetFCFA: 3500, maxOpsPerDay: 5000, maxOpsPerUser: 200, subLimitUnits: 30, autoBlock: true },
      Admin: { dailyBudgetFCFA: 40, monthlyBudgetFCFA: 500, maxOpsPerDay: 300, maxOpsPerUser: 100, subLimitUnits: 5, autoBlock: false }
    },
    extraRolePlans: {
      Admin: [
        { id: 'r2-adm-super', name: 'Super Administrateur', badge: 'Archives & exports', priceLabel: 'Interne', nativeQuota: 5, nativeUnit: 'Go/mois', dailyLimit: 50, monthlyLimit: 1000, activeUsers: 2, consumedNative: 0.8, realCostFCFA: 35 },
        { id: 'r2-adm-fin', name: 'Admin Finance & Support', badge: 'Reçus PDF', priceLabel: 'Interne', nativeQuota: 2, nativeUnit: 'Go/mois', dailyLimit: 30, monthlyLimit: 500, activeUsers: 3, consumedNative: 0.4, realCostFCFA: 15 }
      ]
    }
  },

  'api-supabase': {
    id: 'api-supabase',
    supplierName: 'Supabase Platform',
    serviceType: 'Base SQL relationnelle PostgreSQL & Auth (RLS)',
    apiName: 'Supabase PostgreSQL & Auth API',
    serviceIdentifierLabel: 'Projet / Base PostgreSQL',
    serviceIdentifierValue: 'djassa-prod-ci • PostgreSQL v16 (RLS)',
    baseEndpoint: 'https://supabase.co/rest/v1',
    endpointPills: ['/rest/v1/orders', '/rest/v1/products', '/auth/v1/token', '/realtime/v1'],
    defaultMaskedKey: 'sb_pub_••••••••••••8tQr',
    supportsLiveApiBalance: false,
    balanceCardTitle: 'Suivi plan Supabase (PostgreSQL & RLS)',
    balanceUnavailableReason: 'Facturation forfaitaire et dépassement via le tableau de bord Supabase.',
    supportsOfficialPricingSync: false,
    pricingSyncNote: 'Base PostgreSQL relationnelle hébergée avec authentification et Row-Level Security (RLS) activée.',
    tariffFields: [
      { key: 'rate1', label: 'Requêtes SQL / REST', unitHint: 'pour 100 000 requêtes', defaultValue: 30, step: 2, editable: true },
      { key: 'rate2', label: 'Écritures transactionnelles', unitHint: 'pour 100 000 écritures', defaultValue: 90, step: 2, editable: true },
      { key: 'rate3', label: 'Stockage PostgreSQL + PITR', unitHint: 'par Go / mois', defaultValue: 108, step: 5, editable: true }
    ],
    configFields: [
      {
        key: 'param1',
        label: 'Instance / Base active :',
        defaultValue: 'postgres-djassa-prod',
        options: [
          { value: 'postgres-djassa-prod', label: 'postgres-djassa-prod (Production)' },
          { value: 'postgres-djassa-staging', label: 'postgres-djassa-staging' }
        ]
      },
      {
        key: 'param2',
        label: 'Région de réplication :',
        defaultValue: 'eu-west-1 (Irlande)',
        options: [
          { value: 'eu-west-1 (Irlande)', label: 'eu-west-1 (Irlande)' },
          { value: 'eu-central-1 (Francfort)', label: 'eu-central-1' }
        ]
      },
      {
        key: 'param3',
        label: 'Politiques Row-Level Security :',
        defaultValue: 'Strictes (client, vendeur, admin)',
        options: [
          { value: 'Strictes (client, vendeur, admin)', label: 'RLS Strict par rôle' },
          { value: 'Audit lecture seule', label: 'Audit RLS' }
        ]
      },
      {
        key: 'param4',
        label: 'Limite pagination requêtes :',
        defaultValue: '50 lignes / page',
        options: [
          { value: '25 lignes / page', label: '25 lignes / page' },
          { value: '50 lignes / page', label: '50 lignes / page' },
          { value: '100 lignes / page', label: '100 lignes / page' }
        ]
      },
      {
        key: 'param5',
        label: 'Pooling PgBouncer :',
        defaultValue: 'Mode Transaction (Port 6543)',
        options: [
          { value: 'Mode Transaction (Port 6543)', label: 'Transaction Pool' },
          { value: 'Session directe', label: 'Session directe' }
        ]
      }
    ],
    operatingModes: [
      { id: 'economy', title: 'Mode Économie', desc: 'Requêtes indexées avec cache PgBouncer et pagination 25.' },
      { id: 'balanced', title: 'Mode Équilibré', desc: 'Transactions ACID strictes + politiques RLS actives.' },
      { id: 'speed', title: 'Mode Vitesse', desc: 'Pool haute concurrence pour pics de trafic.' }
    ],
    nativeUnitSingular: 'requête SQL',
    nativeUnitPlural: 'requêtes SQL',
    primaryMetricLabel: 'Lectures / Écritures SQL',
    secondaryMetricLabel: 'Index & Stockage',
    operationNoun: 'requête Supabase',
    defaultSettings: {
      apiKeyMasked: 'sb_pub_••••••••••••8tQr',
      param1: 'postgres-djassa-prod',
      param2: 'eu-west-1 (Irlande)',
      param3: 'Strictes (client, vendeur, admin)',
      param4: '50 lignes / page',
      param5: 'Mode Transaction (Port 6543)',
      timeoutSec: 15,
      rate1: 30,
      rate2: 90,
      rate3: 108,
      targetBalanceOrBudgetFCFA: 8000,
      minAlertFCFA: 1200,
      rechargeOrProvisionThresholdFCFA: 4500,
      rechargeOrProvisionAmountFCFA: 6000,
      operatingMode: 'balanced',
      checkInterval: '5m',
      alertsEnabled: true,
      abnormalAlertEnabled: true,
      budgetOverrunAlertEnabled: true,
      lowBalanceAlertEnabled: false,
      alertMode: 'internal',
      autoSync: true
    },
    defaultAppLimits: {
      Client: { dailyBudgetFCFA: 100, monthlyBudgetFCFA: 1800, maxOpsPerDay: 25000, maxOpsPerUser: 300, subLimitUnits: 15000, autoBlock: true },
      Vendeur: { dailyBudgetFCFA: 120, monthlyBudgetFCFA: 1800, maxOpsPerDay: 18000, maxOpsPerUser: 450, subLimitUnits: 25000, autoBlock: true },
      Admin: { dailyBudgetFCFA: 40, monthlyBudgetFCFA: 400, maxOpsPerDay: 4000, maxOpsPerUser: 800, subLimitUnits: 50000, autoBlock: false }
    },
    extraRolePlans: {
      Admin: [
        { id: 'supa-adm-super', name: 'Super Administrateur', badge: 'Console live', priceLabel: 'Interne', nativeQuota: 50000, nativeUnit: 'ops/mois', dailyLimit: 2000, monthlyLimit: 50000, activeUsers: 2, consumedNative: 1100, realCostFCFA: 35 },
        { id: 'supa-adm-ops', name: 'Admin Finance & Support', badge: 'Litiges & Suivi', priceLabel: 'Interne', nativeQuota: 25000, nativeUnit: 'ops/mois', dailyLimit: 1000, monthlyLimit: 25000, activeUsers: 3, consumedNative: 400, realCostFCFA: 15 }
      ]
    }
  },

  'api-geniuspay': {
    id: 'api-geniuspay',
    supplierName: 'GeniusPay Côte d\'Ivoire',
    serviceType: 'Paiements Mobile Money, cartes & décaissements',
    apiName: 'GeniusPay REST & Webhooks API v1',
    serviceIdentifierLabel: 'Merchant ID / Canal',
    serviceIdentifierValue: 'djassa-ci-prod • Wave / Orange Money / MTN / Cartes',
    baseEndpoint: 'https://api.geniuspay.ci/v1',
    endpointPills: ['/payments', '/payouts', '/transactions/verify', '/webhooks'],
    defaultMaskedKey: 'gp_live_••••••••••••3vNm',
    supportsLiveApiBalance: true,
    balanceCardTitle: 'Solde marchand disponible sur GeniusPay',
    supportsOfficialPricingSync: true,
    pricingSyncNote: 'Commissions DJASSA : 150 FCFA par commande validée + 6,5% frais paiement en ligne client (0% à la livraison).',
    tariffFields: [
      { key: 'rate1', label: 'Commission fixe DJASSA', unitHint: 'par commande validée', defaultValue: 150, step: 10, editable: true },
      { key: 'rate2', label: 'Frais paiement en ligne client (%)', unitHint: 'Wave / OM (0% COD)', defaultValue: 6.5, step: 0.1, editable: true },
      { key: 'rate3', label: 'Décaissement Mobile Money', unitHint: 'par retrait validé', defaultValue: 0, step: 5, editable: true }
    ],
    configFields: [
      {
        key: 'param1',
        label: 'Environnement GeniusPay :',
        defaultValue: 'Production (Live)',
        options: [
          { value: 'Production (Live)', label: 'Production (Live)' },
          { value: 'Sandbox Test', label: 'Sandbox Test' }
        ]
      },
      {
        key: 'param2',
        label: 'Opérateurs Mobile Money actifs :',
        defaultValue: 'Orange Money, MTN MoMo, Moov, Wave CI',
        options: [
          { value: 'Orange Money, MTN MoMo, Moov, Wave CI', label: 'Tous opérateurs CI' },
          { value: 'Wave CI & Orange Money uniquement', label: 'Wave & Orange' }
        ]
      },
      {
        key: 'param3',
        label: 'Signature Webhook :',
        defaultValue: 'HMAC-SHA256 Strict (x-geniuspay-signature)',
        options: [
          { value: 'HMAC-SHA256 Strict (x-geniuspay-signature)', label: 'HMAC-SHA256 Strict' },
          { value: 'Double validation header', label: 'Double en-tête' }
        ]
      },
      {
        key: 'param4',
        label: 'Délai vérification transaction :',
        defaultValue: '15 secondes',
        options: [
          { value: '10 secondes', label: '10 secondes' },
          { value: '15 secondes', label: '15 secondes' },
          { value: '30 secondes', label: '30 secondes' }
        ]
      },
      {
        key: 'param5',
        label: 'Clé d\'idempotence paiements :',
        defaultValue: 'Obligatoire sur chaque requête',
        options: [
          { value: 'Obligatoire sur chaque requête', label: 'Stricte' }
        ]
      }
    ],
    operatingModes: [
      { id: 'economy', title: 'Mode Économie', desc: 'Regroupement des vérifications webhook avant polling.' },
      { id: 'balanced', title: 'Mode Équilibré', desc: 'Validation temps réel des encaissements et retraits.' },
      { id: 'speed', title: 'Mode Vitesse', desc: 'Confirmation instantanée < 2s multi-opérateurs.' }
    ],
    nativeUnitSingular: 'transaction',
    nativeUnitPlural: 'transactions',
    primaryMetricLabel: 'Transactions GeniusPay',
    secondaryMetricLabel: 'Webhooks confirmés',
    operationNoun: 'transaction GeniusPay',
    defaultSettings: {
      apiKeyMasked: 'gp_live_••••••••••••3vNm',
      param1: 'Production (Live)',
      param2: 'Orange Money, MTN MoMo, Moov, Wave CI',
      param3: 'HMAC-SHA256 Strict (x-geniuspay-signature)',
      param4: '15 secondes',
      param5: 'Obligatoire sur chaque requête',
      timeoutSec: 15,
      rate1: 150,
      rate2: 6.5,
      rate3: 0,
      targetBalanceOrBudgetFCFA: 40000,
      minAlertFCFA: 5000,
      rechargeOrProvisionThresholdFCFA: 10000,
      rechargeOrProvisionAmountFCFA: 20000,
      operatingMode: 'balanced',
      checkInterval: '1m',
      alertsEnabled: true,
      abnormalAlertEnabled: true,
      budgetOverrunAlertEnabled: true,
      lowBalanceAlertEnabled: true,
      alertMode: 'internal',
      autoSync: true
    },
    defaultAppLimits: {
      Client: { dailyBudgetFCFA: 600, monthlyBudgetFCFA: 5000, maxOpsPerDay: 300, maxOpsPerUser: 20, subLimitUnits: 40, autoBlock: true },
      Vendeur: { dailyBudgetFCFA: 350, monthlyBudgetFCFA: 3000, maxOpsPerDay: 180, maxOpsPerUser: 25, subLimitUnits: 60, autoBlock: true },
      Admin: { dailyBudgetFCFA: 100, monthlyBudgetFCFA: 800, maxOpsPerDay: 50, maxOpsPerUser: 50, subLimitUnits: 100, autoBlock: false }
    },
    extraRolePlans: {
      Admin: [
        { id: 'gp-adm-super', name: 'Super Administrateur', badge: 'Validation double contrôle', priceLabel: 'Interne', nativeQuota: 100, nativeUnit: 'audits/mois', dailyLimit: 10, monthlyLimit: 100, activeUsers: 2, consumedNative: 12, realCostFCFA: 120 },
        { id: 'gp-adm-fin', name: 'Admin Finance & Support', badge: 'Rapprochement GeniusPay', priceLabel: 'Interne', nativeQuota: 50, nativeUnit: 'audits/mois', dailyLimit: 8, monthlyLimit: 50, activeUsers: 3, consumedNative: 8, realCostFCFA: 80 }
      ]
    }
  },

  'api-fcm': {
    id: 'api-fcm',
    supplierName: 'Firebase Cloud Messaging',
    serviceType: 'Notifications Push mobiles & web',
    apiName: 'FCM HTTP v1 API (Notifications uniquement)',
    serviceIdentifierLabel: 'Sender / Project ID',
    serviceIdentifierValue: 'djassa-fcm-push • HTTP v1',
    baseEndpoint: 'https://fcm.googleapis.com/v1',
    endpointPills: ['/messages:send', '/topics/orders', '/topics/sellers', '/topics/admin-alerts'],
    defaultMaskedKey: 'fcm_sa_••••••••••••9kLp',
    supportsLiveApiBalance: false,
    balanceCardTitle: 'Quota notifications Push FCM',
    balanceUnavailableReason: 'Firebase Cloud Messaging (FCM) est gratuit et dédié exclusivement aux notifications push temps réel.',
    supportsOfficialPricingSync: false,
    pricingSyncNote: 'Coût fournisseur nul (0 FCFA) pour les notifications push FCM.',
    tariffFields: [
      { key: 'rate1', label: 'Push transactionnel (Commande)', unitHint: 'pour 1 000 envois', defaultValue: 0, step: 0, editable: false },
      { key: 'rate2', label: 'Push vendeur (Nouvelle commande)', unitHint: 'pour 1 000 envois', defaultValue: 0, step: 0, editable: false },
      { key: 'rate3', label: 'Push sécurité Admin', unitHint: 'pour 1 000 envois', defaultValue: 0, step: 0, editable: false }
    ],
    configFields: [
      {
        key: 'param1',
        label: 'Protocole actif :',
        defaultValue: 'FCM HTTP v1 (OAuth2)',
        options: [
          { value: 'FCM HTTP v1 (OAuth2)', label: 'FCM HTTP v1' }
        ]
      },
      {
        key: 'param2',
        label: 'Priorité livraison :',
        defaultValue: 'Haute priorité (Commandes & Paiements)',
        options: [
          { value: 'Haute priorité (Commandes & Paiements)', label: 'Haute priorité' },
          { value: 'Normale', label: 'Normale' }
        ]
      },
      {
        key: 'param3',
        label: 'Durée TTL des notifications :',
        defaultValue: '3600 secondes',
        options: [
          { value: '3600 secondes', label: '1 heure' },
          { value: '86400 secondes', label: '24 heures' }
        ]
      },
      {
        key: 'param4',
        label: 'Périmètre Firebase autorisé :',
        defaultValue: 'Notifications Push FCM uniquement',
        options: [
          { value: 'Notifications Push FCM uniquement', label: 'FCM uniquement' }
        ]
      },
      {
        key: 'param5',
        label: 'Fallback in-app :',
        defaultValue: 'Journal notifications PostgreSQL',
        options: [
          { value: 'Journal notifications PostgreSQL', label: 'Supabase PostgreSQL' }
        ]
      }
    ],
    operatingModes: [
      { id: 'economy', title: 'Mode Économie', desc: 'Regroupement notifications non critiques.' },
      { id: 'balanced', title: 'Mode Équilibré', desc: 'Push immédiat commandes, paiements et boutiques.' },
      { id: 'speed', title: 'Mode Vitesse', desc: 'Priorité haute Android/iOS/Web Push.' }
    ],
    nativeUnitSingular: 'notification push',
    nativeUnitPlural: 'notifications push',
    primaryMetricLabel: 'Notifications envoyées',
    secondaryMetricLabel: 'Accusés réception',
    operationNoun: 'notification FCM',
    defaultSettings: {
      apiKeyMasked: 'fcm_sa_••••••••••••9kLp',
      param1: 'FCM HTTP v1 (OAuth2)',
      param2: 'Haute priorité (Commandes & Paiements)',
      param3: '3600 secondes',
      param4: 'Notifications Push FCM uniquement',
      param5: 'Journal notifications PostgreSQL',
      timeoutSec: 10,
      rate1: 0,
      rate2: 0,
      rate3: 0,
      targetBalanceOrBudgetFCFA: 3000,
      minAlertFCFA: 500,
      rechargeOrProvisionThresholdFCFA: 1000,
      rechargeOrProvisionAmountFCFA: 2000,
      operatingMode: 'balanced',
      checkInterval: '5m',
      alertsEnabled: true,
      abnormalAlertEnabled: true,
      budgetOverrunAlertEnabled: false,
      lowBalanceAlertEnabled: false,
      alertMode: 'internal',
      autoSync: true
    },
    defaultAppLimits: {
      Client: { dailyBudgetFCFA: 0, monthlyBudgetFCFA: 0, maxOpsPerDay: 5000, maxOpsPerUser: 50, subLimitUnits: 1500, autoBlock: false },
      Vendeur: { dailyBudgetFCFA: 0, monthlyBudgetFCFA: 0, maxOpsPerDay: 3000, maxOpsPerUser: 80, subLimitUnits: 1200, autoBlock: false },
      Admin: { dailyBudgetFCFA: 0, monthlyBudgetFCFA: 0, maxOpsPerDay: 500, maxOpsPerUser: 100, subLimitUnits: 500, autoBlock: false }
    },
    extraRolePlans: {
      Admin: [
        { id: 'fcm-adm-super', name: 'Super Administrateur', badge: 'Alertes critiques', priceLabel: 'Interne', nativeQuota: 500, nativeUnit: 'push/mois', dailyLimit: 40, monthlyLimit: 500, activeUsers: 2, consumedNative: 85, realCostFCFA: 0 },
        { id: 'fcm-adm-ops', name: 'Admin Finance & Support', badge: 'Signalements & litiges', priceLabel: 'Interne', nativeQuota: 400, nativeUnit: 'push/mois', dailyLimit: 30, monthlyLimit: 400, activeUsers: 3, consumedNative: 60, realCostFCFA: 0 }
      ]
    }
  },

  'api-cloud-run': {
    id: 'api-cloud-run',
    supplierName: 'Google Cloud Platform',
    serviceType: 'Microservices conteneurisés & calcul serverless',
    apiName: 'Google Cloud Run v2',
    serviceIdentifierLabel: 'Service ID / Région',
    serviceIdentifierValue: 'djassa-backend-run • europe-west1',
    baseEndpoint: 'https://djassa-backend-run.a.run.app',
    endpointPills: ['/api/orders/dispatch', '/api/checkout/verify', '/api/catalog/search', '/healthz'],
    defaultMaskedKey: 'gcp_iam_••••••••••••7wLs',
    supportsLiveApiBalance: false,
    balanceCardTitle: 'Solde fournisseur (Compte Google Cloud)',
    balanceUnavailableReason: 'Solde non disponible via API — Facturation Cloud Run à la seconde vCPU / GiB via Google Cloud Billing.',
    supportsOfficialPricingSync: false,
    pricingSyncNote: 'Facturation Google Cloud Run (Tier 1 europe-west1) : vCPU-seconde active, mémoire GiB-seconde et volume de requêtes HTTP.',
    tariffFields: [
      { key: 'rate1', label: 'Temps processeur (vCPU)', unitHint: 'pour 100 000 vCPU-s', defaultValue: 1050, step: 25, editable: true },
      { key: 'rate2', label: 'Mémoire vive allouée (RAM)', unitHint: 'pour 100 000 GiB-s', defaultValue: 120, step: 10, editable: true },
      { key: 'rate3', label: 'Requêtes HTTP entrantes', unitHint: 'par million de req.', defaultValue: 240, step: 10, editable: true }
    ],
    configFields: [
      {
        key: 'param1',
        label: 'Service Cloud Run actif :',
        defaultValue: 'djassa-backend-run',
        options: [
          { value: 'djassa-backend-run', label: 'djassa-backend-run (Prod)' },
          { value: 'djassa-dispatch-worker', label: 'djassa-dispatch-worker' }
        ]
      },
      {
        key: 'param2',
        label: 'Région de déploiement :',
        defaultValue: 'europe-west1 (Belgique)',
        options: [
          { value: 'europe-west1 (Belgique)', label: 'europe-west1' },
          { value: 'europe-west9 (Paris)', label: 'europe-west9 (Paris)' }
        ]
      },
      {
        key: 'param3',
        label: 'Ressources conteneur :',
        defaultValue: '1 vCPU / 512 MiB RAM',
        options: [
          { value: '0.5 vCPU / 256 MiB RAM', label: '0.5 vCPU / 256 MiB' },
          { value: '1 vCPU / 512 MiB RAM', label: '1 vCPU / 512 MiB' },
          { value: '2 vCPU / 1 GiB RAM', label: '2 vCPU / 1 GiB' }
        ]
      },
      {
        key: 'param4',
        label: 'Auto-scaling (Min → Max) :',
        defaultValue: 'Min 0 → Max 20 instances',
        options: [
          { value: 'Min 0 → Max 20 instances', label: '0 → 20 (Scale-to-zero)' },
          { value: 'Min 1 → Max 30 instances', label: '1 → 30 (1 chaude)' },
          { value: 'Min 2 → Max 50 instances', label: '2 → 50 (Haute charge)' }
        ]
      },
      {
        key: 'param5',
        label: 'Concurrence par conteneur :',
        defaultValue: '80 requêtes simultanées',
        options: [
          { value: '40 requêtes simultanées', label: '40 req/instance' },
          { value: '80 requêtes simultanées', label: '80 req/instance' },
          { value: '120 requêtes simultanées', label: '120 req/instance' }
        ]
      }
    ],
    operatingModes: [
      { id: 'economy', title: 'Mode Économie', desc: 'Scale-to-zero (min=0) et facturation stricte à la requête.' },
      { id: 'balanced', title: 'Mode Équilibré', desc: 'Auto-scaling adaptatif 1 vCPU / 80 req. simultanées.' },
      { id: 'speed', title: 'Mode Vitesse', desc: 'Minimum 1 instance chaude permanente (zéro cold-start).' },
      { id: 'manual', title: 'Mode Manuel', desc: 'Nombre d\'instances et concurrence fixés manuellement.' }
    ],
    nativeUnitSingular: 'exéc.',
    nativeUnitPlural: 'exécutions',
    primaryMetricLabel: 'Temps vCPU-s',
    secondaryMetricLabel: 'Mémoire GiB-s',
    operationNoun: 'exécution Cloud Run',
    defaultSettings: {
      apiKeyMasked: 'gcp_iam_••••••••••••7wLs',
      param1: 'djassa-backend-run',
      param2: 'europe-west1 (Belgique)',
      param3: '1 vCPU / 512 MiB RAM',
      param4: 'Min 0 → Max 20 instances',
      param5: '80 requêtes simultanées',
      timeoutSec: 30,
      rate1: 1050,
      rate2: 120,
      rate3: 240,
      targetBalanceOrBudgetFCFA: 10000,
      minAlertFCFA: 1500,
      rechargeOrProvisionThresholdFCFA: 5500,
      rechargeOrProvisionAmountFCFA: 8000,
      operatingMode: 'balanced',
      checkInterval: '5m',
      alertsEnabled: true,
      abnormalAlertEnabled: true,
      budgetOverrunAlertEnabled: true,
      lowBalanceAlertEnabled: false,
      alertMode: 'internal',
      autoSync: true
    },
    defaultAppLimits: {
      Client: { dailyBudgetFCFA: 200, monthlyBudgetFCFA: 3500, maxOpsPerDay: 25000, maxOpsPerUser: 400, subLimitUnits: 400000, autoBlock: true },
      Vendeur: { dailyBudgetFCFA: 150, monthlyBudgetFCFA: 2200, maxOpsPerDay: 15000, maxOpsPerUser: 300, subLimitUnits: 250000, autoBlock: true },
      Admin: { dailyBudgetFCFA: 50, monthlyBudgetFCFA: 500, maxOpsPerDay: 2000, maxOpsPerUser: 500, subLimitUnits: 100000, autoBlock: false }
    },
    extraRolePlans: {
      Admin: [
        { id: 'cr-adm-super', name: 'Super Administrateur', badge: 'Exports & Audits', priceLabel: 'Interne', nativeQuota: 100000, nativeUnit: 'vCPU-ms', dailyLimit: 5000, monthlyLimit: 100000, activeUsers: 2, consumedNative: 42000, realCostFCFA: 95 },
        { id: 'cr-adm-fin', name: 'Admin Finance & Support', badge: 'Rapports PDF/CSV', priceLabel: 'Interne', nativeQuota: 60000, nativeUnit: 'vCPU-ms', dailyLimit: 3000, monthlyLimit: 60000, activeUsers: 3, consumedNative: 24000, realCostFCFA: 55 }
      ]
    }
  }
};

// =============================================================================
// STORAGE HELPERS (PER PROVIDER — ZERO SHARED SETTINGS ACROSS PROVIDERS)
// =============================================================================

export const getProviderSettingsKey = (providerId: string) => `djassa_api_settings_${providerId}_v1`;
export const getProviderAppLimitsKey = (providerId: string) => `djassa_api_app_limits_${providerId}_v1`;
export const getProviderAuditKey = (providerId: string) => `djassa_api_audit_${providerId}_v1`;

export function loadProviderExtendedSettings(providerId: string): ProviderExtendedSettings {
  const profile = PROVIDER_PROFILES[providerId];
  const fallback = profile?.defaultSettings || PROVIDER_PROFILES['api-google-maps'].defaultSettings;
  try {
    const raw = localStorage.getItem(getProviderSettingsKey(providerId));
    if (raw) {
      return { ...fallback, ...JSON.parse(raw) };
    }
  } catch {
    // ignore storage parse failure
  }
  return { ...fallback };
}

export function saveProviderExtendedSettings(providerId: string, next: ProviderExtendedSettings): void {
  try {
    localStorage.setItem(getProviderSettingsKey(providerId), JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }
}

export function loadProviderAppLimits(providerId: string): Record<ProviderAppKey, ProviderNativeAppLimits> {
  const profile = PROVIDER_PROFILES[providerId];
  const fallback = profile?.defaultAppLimits || PROVIDER_PROFILES['api-google-maps'].defaultAppLimits;
  try {
    const raw = localStorage.getItem(getProviderAppLimitsKey(providerId));
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        Client: { ...fallback.Client, ...(parsed.Client || {}) },
        Vendeur: { ...fallback.Vendeur, ...(parsed.Vendeur || {}) },
        Admin: { ...fallback.Admin, ...(parsed.Admin || {}) }
      };
    }
  } catch {
    // ignore
  }
  return JSON.parse(JSON.stringify(fallback));
}

export function saveProviderAppLimits(providerId: string, next: Record<ProviderAppKey, ProviderNativeAppLimits>): void {
  try {
    localStorage.setItem(getProviderAppLimitsKey(providerId), JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function loadProviderAuditHistory(provider: ApiProvider): ProviderConfigChange[] {
  try {
    const raw = localStorage.getItem(getProviderAuditKey(provider.id));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  if (provider.configHistory && provider.configHistory.length > 0) {
    return provider.configHistory;
  }
  return [
    {
      id: `aud-${provider.id}-1`,
      date: '14/11/2026 • 09:00',
      admin: 'SuperAdmin Djassa',
      parameter: 'Plafond budgétaire mensuel interne',
      oldValue: `${Math.max(1000, provider.budgetLimitFCFA - 2000).toLocaleString()} FCFA`,
      newValue: `${provider.budgetLimitFCFA.toLocaleString()} FCFA`
    },
    {
      id: `aud-${provider.id}-2`,
      date: '12/11/2026 • 16:40',
      admin: 'Admin Technique',
      parameter: 'Mode de fonctionnement',
      oldValue: 'Standard',
      newValue: provider.economyModeEnabled ? 'Mode Économie' : 'Mode Équilibré'
    }
  ];
}

// =============================================================================
// REAL TRANSACTIONS / PROVISIONS PER PROVIDER
// =============================================================================

export function getProviderTransactions(provider: ApiProvider, settings: ProviderExtendedSettings): ProviderTransactionEntry[] {
  const profile = PROVIDER_PROFILES[provider.id];
  if (!profile) return [];

  if (profile.supportsLiveApiBalance) {
    // GeniusPay supports live merchant balance & payouts
    const bal = provider.providerBalanceFCFA;
    return [
      {
        id: `${provider.id}-tx-1`,
        title: 'Encaissements Mobile Money GeniusPay',
        subtitle: 'Règlement marchand validé par webhook HMAC',
        date: '14/11/2026 • 08:30',
        amount: `+${settings.rechargeOrProvisionAmountFCFA.toLocaleString()} FCFA`,
        status: 'Réussie',
        afterLabel: `Solde : ${bal.toLocaleString()} FCFA`,
        type: 'auto'
      },
      {
        id: `${provider.id}-tx-2`,
        title: 'Paiement client Wave / Orange Money',
        subtitle: 'Passerelle GeniusPay Côte d\'Ivoire',
        date: '10/11/2026 • 15:10',
        amount: '+10 000 FCFA',
        status: 'Réussie',
        afterLabel: `Solde : ${Math.max(0, bal - 10000).toLocaleString()} FCFA`,
        type: 'manual'
      },
      {
        id: `${provider.id}-tx-3`,
        title: 'Tentative décaissement GeniusPay',
        subtitle: 'Délai réponse opérateur dépassé',
        date: '07/11/2026 • 04:12',
        amount: '+10 000 FCFA',
        status: 'Échouée',
        afterLabel: `Solde : ${Math.max(0, bal - 20000).toLocaleString()} FCFA`,
        type: 'failed'
      }
    ];
  }

  // Postpaid / managed providers (Maps, R2, Supabase, FCM, Cloud Run): billing provisions & usage ledger
  return [
    {
      id: `${provider.id}-inv-1`,
      title: `Provision budgétaire interne (${provider.name})`,
      subtitle: 'Enveloppe mensuelle DJASSA allouée',
      date: '14/11/2026 • 08:00',
      amount: `${provider.budgetLimitFCFA.toLocaleString()} FCFA`,
      status: 'Validée',
      afterLabel: `Consommé : ${provider.costFCFA.toLocaleString()} FCFA`,
      type: 'invoice'
    },
    {
      id: `${provider.id}-inv-2`,
      title: 'Dépense cumulée relevée (Période en cours)',
      subtitle: 'Facturation post-payée fournisseur',
      date: '13/11/2026 • 23:55',
      amount: `-${Math.round(provider.costFCFA * 0.45).toLocaleString()} FCFA`,
      status: 'Réussie',
      afterLabel: `Reste budget : ${Math.max(0, provider.budgetLimitFCFA - provider.costFCFA).toLocaleString()} FCFA`,
      type: 'manual'
    },
    {
      id: `${provider.id}-inv-3`,
      title: 'Clôture relevé mensuel précédent',
      subtitle: 'Règlement facture console fournisseur',
      date: '01/11/2026 • 09:15',
      amount: `-${Math.round(provider.budgetLimitFCFA * 0.72).toLocaleString()} FCFA`,
      status: 'Réussie',
      afterLabel: 'Facture soldée',
      type: 'auto'
    }
  ];
}

// =============================================================================
// REAL OPERATIONS SEEDED PER PROVIDER (NO GPT TOKENS FOR NON-GPT PROVIDERS)
// =============================================================================

const isoDaysAgo = (daysAgo: number, hh: number, mm: number): { iso: string; dateLabel: string; timeLabel: string } => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hh, mm, 0, 0);
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return {
    iso: d.toISOString(),
    dateLabel: `${dd}/${mo}/${yyyy}`,
    timeLabel: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  };
};

export function generateProviderOperations(
  provider: ApiProvider,
  settings: ProviderExtendedSettings,
  realPlans: AdminPlanItem[],
  subRecords: SubscriptionApiRecord[]
): ProviderOperationItem[] {
  const ops: ProviderOperationItem[] = [];

  // Map authentic records from AdminSubscriptionsManager if matching provider
  if (provider.id === 'api-google-maps') {
    const mapsSubRecords = subRecords.filter(r => r.featureType === 'maps');
    mapsSubRecords.forEach((r, idx) => {
      const t = isoDaysAgo(0, 15 - idx, 40);
      const planName = realPlans.find(p => p.id === r.planId)?.name || 'Vendeur Pro Marché';
      ops.push({
        id: `GM-${r.id.toUpperCase()}`,
        timestampIso: t.iso,
        dateLabel: t.dateLabel,
        timeLabel: r.timestamp.slice(0, 5),
        app: 'Vendeur',
        subscriptionName: planName,
        userId: `USR-SEL-${10 + idx}`,
        userName: r.userOrStore,
        userAvatar: AVATARS[1],
        opType: 'Localisation boutique & zone vendeur',
        serviceTarget: r.model,
        endpoint: r.endpoint,
        primaryQty: r.unitsConsumed,
        primaryUnit: 'affichages',
        secondaryQty: r.unitsConsumed * 2,
        secondaryUnit: 'géocodages',
        latencyMs: r.latencyMs,
        status: r.statusCode >= 400 ? 'failed' : 'success',
        httpCode: r.statusCode,
        billedByProvider: true,
        unitCostFCFA: r.costFCFA,
        feeCostFCFA: 2,
        realCostFCFA: Math.round((r.costFCFA + 2) * 100) / 100,
        revenueFCFA: r.revenueFCFA,
        estimatedProfitFCFA: Math.round((r.revenueFCFA - r.costFCFA - 2) * 100) / 100,
        providerTraceId: `gmaps-tr-${100 + idx}`,
        sanitizedPreview: `{"status":"OK","service":"routes.googleapis.com","geocodes":${r.unitsConsumed},"region":"CI","api_key":"[MASQUÉ]"}`
      });
    });

    const seeds: Array<Omit<ProviderOperationItem, 'timestampIso' | 'dateLabel' | 'timeLabel'> & { d: number; h: number; m: number }> = [
      {
        d: 0, h: 14, m: 22,
        id: 'GM-2026-091', app: 'Client', subscriptionName: 'DJASSA Plus',
        userId: 'CLI-101', userName: 'Amina Kouamé', userAvatar: AVATARS[0],
        opType: 'Affichage carte adresse livraison', serviceTarget: 'Maps JavaScript API v3', endpoint: '/maps/api/js/viewport',
        primaryQty: 45, primaryUnit: 'affichages', secondaryQty: 3, secondaryUnit: 'géocodages',
        latencyMs: 42, status: 'success', httpCode: 200, billedByProvider: true,
        unitCostFCFA: 78, feeCostFCFA: 4, realCostFCFA: 82, revenueFCFA: 150, estimatedProfitFCFA: 68,
        providerTraceId: 'gm-91a8f',
        sanitizedPreview: '{"status":"OK","map_loads":45,"geocodes":3,"commune":"Cocody","pii":"[MASQUÉ]"}'
      },
      {
        d: 0, h: 11, m: 5,
        id: 'GM-2026-092', app: 'Client', subscriptionName: 'DJASSA Mini',
        userId: 'CLI-109', userName: 'Salimata Bamba', userAvatar: AVATARS[2],
        opType: 'Autocomplétion repère adresse', serviceTarget: 'Places Autocomplete API', endpoint: '/places:autocomplete',
        primaryQty: 18, primaryUnit: 'affichages', secondaryQty: 5, secondaryUnit: 'requêtes Places',
        latencyMs: 56, status: 'success', httpCode: 200, billedByProvider: true,
        unitCostFCFA: 38, feeCostFCFA: 2, realCostFCFA: 40, revenueFCFA: 50, estimatedProfitFCFA: 10,
        providerTraceId: 'gm-92b7c',
        sanitizedPreview: '{"status":"OK","autocomplete_hits":5,"country":"ci","api_key":"[MASQUÉ]"}'
      },
      {
        d: 1, h: 10, m: 12,
        id: 'GM-2026-094', app: 'Vendeur', subscriptionName: 'Vendeur Pro Marché',
        userId: 'SEL-1042', userName: 'Boutique Chic & Wax Cocody', userAvatar: AVATARS[3],
        opType: 'Positionnement vitrine sur carte', serviceTarget: 'Geocoding API', endpoint: '/geocode/json',
        primaryQty: 60, primaryUnit: 'affichages', secondaryQty: 12, secondaryUnit: 'géocodages',
        latencyMs: 48, status: 'success', httpCode: 200, billedByProvider: true,
        unitCostFCFA: 118, feeCostFCFA: 5, realCostFCFA: 123, revenueFCFA: 300, estimatedProfitFCFA: 177,
        providerTraceId: 'gm-94e1a',
        sanitizedPreview: '{"status":"OK","geocoded_stores":12,"cache_hit":true,"auth":"[MASQUÉ]"}'
      },
      {
        d: 4, h: 9, m: 15,
        id: 'GM-2026-096', app: 'Administrateur', subscriptionName: 'Super Administrateur',
        userId: 'ADM-01', userName: 'SuperAdmin Djassa', userAvatar: AVATARS[1],
        opType: 'Audit carte des boutiques Abidjan', serviceTarget: 'Maps JS API', endpoint: '/maps/api/js',
        primaryQty: 35, primaryUnit: 'affichages', secondaryQty: 8, secondaryUnit: 'géocodages',
        latencyMs: 39, status: 'success', httpCode: 200, billedByProvider: true,
        unitCostFCFA: 70, feeCostFCFA: 2, realCostFCFA: 72, revenueFCFA: 0, estimatedProfitFCFA: -72,
        providerTraceId: 'gm-96f2b',
        sanitizedPreview: '{"status":"OK","stores_checked":8,"auth":"[MASQUÉ]"}'
      }
    ];
    seeds.forEach(s => {
      const t = isoDaysAgo(s.d, s.h, s.m);
      ops.push({ ...s, timestampIso: t.iso, dateLabel: t.dateLabel, timeLabel: t.timeLabel });
    });
  } else if (provider.id === 'api-cloudflare-r2') {
    const seeds: Array<Omit<ProviderOperationItem, 'timestampIso' | 'dateLabel' | 'timeLabel'> & { d: number; h: number; m: number }> = [
      {
        d: 0, h: 15, m: 18,
        id: 'R2-2026-301', app: 'Vendeur', subscriptionName: 'Vendeur Élite Studio',
        userId: 'SEL-201', userName: 'Kouassi Prestige Adjamé', userAvatar: AVATARS[3],
        opType: 'Upload packshot catalogue 4K (Classe A)', serviceTarget: settings.param1, endpoint: '/products/packshot-webp',
        primaryQty: 420, primaryUnit: 'Mo stockés', secondaryQty: 140, secondaryUnit: 'ops Classe A',
        latencyMs: 46, status: 'success', httpCode: 200, billedByProvider: true,
        unitCostFCFA: 185, feeCostFCFA: 0, realCostFCFA: 185, revenueFCFA: 450, estimatedProfitFCFA: 265,
        providerTraceId: 'cf-r2-301a',
        sanitizedPreview: '{"status":"200 OK","bucket":"djassa-media-prod","egress_fee_fcfa":0,"compression":"WebP","token":"[MASQUÉ]"}'
      },
      {
        d: 0, h: 13, m: 42,
        id: 'R2-2026-302', app: 'Client', subscriptionName: 'DJASSA Plus',
        userId: 'CLI-101', userName: 'Amina Kouamé', userAvatar: AVATARS[0],
        opType: 'Diffusion CDN Edge photos lookbook (Classe B)', serviceTarget: settings.param2, endpoint: '/cdn-cgi/image/lookbook',
        primaryQty: 1250, primaryUnit: 'Mo diffusés', secondaryQty: 4800, secondaryUnit: 'ops Classe B',
        latencyMs: 19, status: 'success', httpCode: 200, billedByProvider: true,
        unitCostFCFA: 95, feeCostFCFA: 0, realCostFCFA: 95, revenueFCFA: 280, estimatedProfitFCFA: 185,
        providerTraceId: 'cf-r2-302b',
        sanitizedPreview: '{"status":"200 OK","cache":"HIT","egress_fcfa":0,"format":"AVIF","auth":"[MASQUÉ]"}'
      },
      {
        d: 1, h: 18, m: 10,
        id: 'R2-2026-303', app: 'Client', subscriptionName: 'DJASSA Mini',
        userId: 'CLI-109', userName: 'Salimata Bamba', userAvatar: AVATARS[2],
        opType: 'Chargement vignettes catalogue Abidjan', serviceTarget: settings.param2, endpoint: '/products/thumbs',
        primaryQty: 680, primaryUnit: 'Mo diffusés', secondaryQty: 2600, secondaryUnit: 'ops Classe B',
        latencyMs: 22, status: 'success', httpCode: 200, billedByProvider: true,
        unitCostFCFA: 52, feeCostFCFA: 0, realCostFCFA: 52, revenueFCFA: 90, estimatedProfitFCFA: 38,
        providerTraceId: 'cf-r2-303c',
        sanitizedPreview: '{"status":"200 OK","cache":"HIT","egress_fcfa":0}'
      },
      {
        d: 3, h: 16, m: 5,
        id: 'R2-2026-305', app: 'Vendeur', subscriptionName: 'Vendeur Starter',
        userId: 'SEL-204', userName: 'Adjamé Luxe Maroquinerie', userAvatar: AVATARS[3],
        opType: 'Upload vidéo vitrine (Échec taille > limite)', serviceTarget: settings.param1, endpoint: '/products/video-upload',
        primaryQty: 0, primaryUnit: 'Mo stockés', secondaryQty: 1, secondaryUnit: 'ops Classe A',
        latencyMs: 310, status: 'failed', httpCode: 400, billedByProvider: false,
        unitCostFCFA: 0, feeCostFCFA: 0, realCostFCFA: 0, revenueFCFA: 0, estimatedProfitFCFA: 0,
        providerTraceId: 'cf-r2-err400',
        errorReason: 'HTTP 400 EntityTooLarge — Fichier supérieur au plafond configuré (25 Mo)',
        sanitizedPreview: '{"error":"EntityTooLarge","code":400,"bucket":"djassa-media-prod"}'
      }
    ];
    seeds.forEach(s => {
      const t = isoDaysAgo(s.d, s.h, s.m);
      ops.push({ ...s, timestampIso: t.iso, dateLabel: t.dateLabel, timeLabel: t.timeLabel });
    });
  } else if (provider.id === 'api-supabase') {
    const seeds: Array<Omit<ProviderOperationItem, 'timestampIso' | 'dateLabel' | 'timeLabel'> & { d: number; h: number; m: number }> = [
      {
        d: 0, h: 15, m: 45,
        id: 'SUP-2026-501', app: 'Client', subscriptionName: 'DJASSA Premium',
        userId: 'CLI-102', userName: 'David Gnaoré', userAvatar: AVATARS[1],
        opType: 'Synchronisation panier & commandes PostgreSQL', serviceTarget: settings.param1, endpoint: '/rest/v1/orders',
        primaryQty: 12400, primaryUnit: 'lectures SQL', secondaryQty: 2100, secondaryUnit: 'écritures',
        latencyMs: 24, status: 'success', httpCode: 200, billedByProvider: true,
        unitCostFCFA: 270, feeCostFCFA: 10, realCostFCFA: 280, revenueFCFA: 650, estimatedProfitFCFA: 370,
        providerTraceId: 'supa-501a',
        sanitizedPreview: '{"status":"COMMITTED","reads":12400,"writes":2100,"rls":"enforced","uid":"[MASQUÉ]"}'
      },
      {
        d: 0, h: 12, m: 30,
        id: 'SUP-2026-502', app: 'Client', subscriptionName: 'DJASSA Mini',
        userId: 'CLI-109', userName: 'Salimata Bamba', userAvatar: AVATARS[2],
        opType: 'Requête catalogue PostgreSQL avec RLS', serviceTarget: settings.param1, endpoint: '/rest/v1/products',
        primaryQty: 8900, primaryUnit: 'lectures SQL', secondaryQty: 650, secondaryUnit: 'écritures',
        latencyMs: 28, status: 'success', httpCode: 200, billedByProvider: true,
        unitCostFCFA: 135, feeCostFCFA: 5, realCostFCFA: 140, revenueFCFA: 200, estimatedProfitFCFA: 60,
        providerTraceId: 'supa-502b',
        sanitizedPreview: '{"status":"OK","pgbouncer":true,"reads":8900}'
      },
      {
        d: 1, h: 14, m: 15,
        id: 'SUP-2026-503', app: 'Vendeur', subscriptionName: 'Vendeur Pro Marché',
        userId: 'SEL-1042', userName: 'Mode & Tendance Plateau', userAvatar: AVATARS[3],
        opType: 'Mise à jour stock & commandes boutique', serviceTarget: settings.param1, endpoint: '/rest/v1/orders',
        primaryQty: 6200, primaryUnit: 'lectures SQL', secondaryQty: 3800, secondaryUnit: 'écritures',
        latencyMs: 31, status: 'success', httpCode: 200, billedByProvider: true,
        unitCostFCFA: 310, feeCostFCFA: 12, realCostFCFA: 322, revenueFCFA: 780, estimatedProfitFCFA: 458,
        providerTraceId: 'supa-503c',
        sanitizedPreview: '{"status":"COMMITTED","batch_writes":3800,"auth":"[MASQUÉ]"}'
      }
    ];
    seeds.forEach(s => {
      const t = isoDaysAgo(s.d, s.h, s.m);
      ops.push({ ...s, timestampIso: t.iso, dateLabel: t.dateLabel, timeLabel: t.timeLabel });
    });
  } else if (provider.id === 'api-geniuspay') {
    const seeds: Array<Omit<ProviderOperationItem, 'timestampIso' | 'dateLabel' | 'timeLabel'> & { d: number; h: number; m: number }> = [
      {
        d: 0, h: 15, m: 35,
        id: 'GP-2026-701', app: 'Client', subscriptionName: 'DJASSA Mini',
        userId: 'CLI-109', userName: 'Salimata Bamba', userAvatar: AVATARS[2],
        opType: 'Paiement commande Mobile Money (Orange CI)', serviceTarget: 'GeniusPay CI', endpoint: '/v1/payments',
        primaryQty: 1, primaryUnit: 'transaction', secondaryQty: 1, secondaryUnit: 'webhook',
        latencyMs: 74, status: 'success', httpCode: 200, billedByProvider: true,
        unitCostFCFA: 150, feeCostFCFA: 0, realCostFCFA: 150, revenueFCFA: 720, estimatedProfitFCFA: 570,
        providerTraceId: 'gp-tx-701',
        sanitizedPreview: '{"status":"COMPLETED","carrier":"Orange CI","msisdn":"+225 07•••89","signature":"[MASQUÉ]"}'
      },
      {
        d: 0, h: 14, m: 12,
        id: 'GP-2026-702', app: 'Client', subscriptionName: 'DJASSA Plus',
        userId: 'CLI-101', userName: 'Amina Kouamé', userAvatar: AVATARS[0],
        opType: 'Recharge crédits IA Wave CI (3 500 FCFA)', serviceTarget: 'GeniusPay CI', endpoint: '/v1/payments',
        primaryQty: 1, primaryUnit: 'transaction', secondaryQty: 1, secondaryUnit: 'webhook',
        latencyMs: 81, status: 'success', httpCode: 200, billedByProvider: true,
        unitCostFCFA: 35, feeCostFCFA: 0, realCostFCFA: 35, revenueFCFA: 540, estimatedProfitFCFA: 505,
        providerTraceId: 'gp-tx-702',
        sanitizedPreview: '{"status":"COMPLETED","carrier":"Wave CI","msisdn":"+225 05•••41","credits":350}'
      },
      {
        d: 1, h: 16, m: 45,
        id: 'GP-2026-703', app: 'Vendeur', subscriptionName: 'Vendeur Pro Marché',
        userId: 'SEL-1042', userName: 'Mode & Tendance Plateau', userAvatar: AVATARS[3],
        opType: 'Reversement direct vendeur Wave / OM', serviceTarget: 'GeniusPay CI', endpoint: '/v1/payouts',
        primaryQty: 1, primaryUnit: 'transaction', secondaryQty: 1, secondaryUnit: 'webhook',
        latencyMs: 69, status: 'success', httpCode: 200, billedByProvider: true,
        unitCostFCFA: 0, feeCostFCFA: 0, realCostFCFA: 0, revenueFCFA: 1100, estimatedProfitFCFA: 1100,
        providerTraceId: 'gp-tx-703',
        sanitizedPreview: '{"status":"COMPLETED","carrier":"Wave CI","phone":"[MASQUÉ]"}'
      },
      {
        d: 3, h: 19, m: 5,
        id: 'GP-2026-705', app: 'Administrateur', subscriptionName: 'Super Administrateur',
        userId: 'ADM-01', userName: 'SuperAdmin Djassa', userAvatar: AVATARS[1],
        opType: 'Vérification signature webhook HMAC rejetée', serviceTarget: 'GeniusPay Webhook', endpoint: '/v1/webhooks',
        primaryQty: 1, primaryUnit: 'transaction', secondaryQty: 0, secondaryUnit: 'webhook',
        latencyMs: 280, status: 'failed', httpCode: 401, billedByProvider: false,
        unitCostFCFA: 0, feeCostFCFA: 0, realCostFCFA: 0, revenueFCFA: 0, estimatedProfitFCFA: 0,
        providerTraceId: 'gp-err-401',
        errorReason: 'HTTP 401 INVALID_SIGNATURE — Signature x-geniuspay-signature invalide',
        sanitizedPreview: '{"error":{"code":401,"message":"INVALID_WEBHOOK_SIGNATURE","key":"[MASQUÉ]"}}'
      }
    ];
    seeds.forEach(s => {
      const t = isoDaysAgo(s.d, s.h, s.m);
      ops.push({ ...s, timestampIso: t.iso, dateLabel: t.dateLabel, timeLabel: t.timeLabel });
    });
  } else if (provider.id === 'api-fcm') {
    const seeds: Array<Omit<ProviderOperationItem, 'timestampIso' | 'dateLabel' | 'timeLabel'> & { d: number; h: number; m: number }> = [
      {
        d: 0, h: 15, m: 42,
        id: 'FCM-2026-901', app: 'Client', subscriptionName: 'DJASSA Plus',
        userId: 'CLI-101', userName: 'Amina Kouamé', userAvatar: AVATARS[0],
        opType: 'Push FCM commande confirmée', serviceTarget: 'FCM HTTP v1', endpoint: '/v1/messages:send',
        primaryQty: 120, primaryUnit: 'notifications', secondaryQty: 118, secondaryUnit: 'livrées',
        latencyMs: 48, status: 'success', httpCode: 200, billedByProvider: false,
        unitCostFCFA: 0, feeCostFCFA: 0, realCostFCFA: 0, revenueFCFA: 0, estimatedProfitFCFA: 0,
        providerTraceId: 'fcm-901a',
        sanitizedPreview: '{"status":"SENT","protocol":"fcm_http_v1","delivered":118,"token":"[MASQUÉ]"}'
      },
      {
        d: 1, h: 11, m: 20,
        id: 'FCM-2026-902', app: 'Vendeur', subscriptionName: 'Vendeur Pro Marché',
        userId: 'SEL-1042', userName: 'Mode & Tendance Plateau', userAvatar: AVATARS[3],
        opType: 'Push FCM nouvelle commande boutique', serviceTarget: 'FCM HTTP v1', endpoint: '/v1/messages:send',
        primaryQty: 85, primaryUnit: 'notifications', secondaryQty: 85, secondaryUnit: 'livrées',
        latencyMs: 52, status: 'success', httpCode: 200, billedByProvider: false,
        unitCostFCFA: 0, feeCostFCFA: 0, realCostFCFA: 0, revenueFCFA: 0, estimatedProfitFCFA: 0,
        providerTraceId: 'fcm-902b',
        sanitizedPreview: '{"status":"SENT","priority":"high","topic":"seller_orders"}'
      }
    ];
    seeds.forEach(s => {
      const t = isoDaysAgo(s.d, s.h, s.m);
      ops.push({ ...s, timestampIso: t.iso, dateLabel: t.dateLabel, timeLabel: t.timeLabel });
    });
  } else {
    // Google Cloud Run
    const seeds: Array<Omit<ProviderOperationItem, 'timestampIso' | 'dateLabel' | 'timeLabel'> & { d: number; h: number; m: number }> = [
      {
        d: 0, h: 15, m: 50,
        id: 'CR-2026-801', app: 'Client', subscriptionName: 'DJASSA Plus',
        userId: 'CLI-101', userName: 'Amina Kouamé', userAvatar: AVATARS[0],
        opType: 'API Recherche Catalogue & Recommandations', serviceTarget: settings.param1, endpoint: '/api/catalog/search',
        primaryQty: 4200, primaryUnit: 'vCPU-s', secondaryQty: 2100, secondaryUnit: 'GiB-s',
        latencyMs: 38, status: 'success', httpCode: 200, billedByProvider: true,
        unitCostFCFA: 440, feeCostFCFA: 20, realCostFCFA: 460, revenueFCFA: 980, estimatedProfitFCFA: 520,
        providerTraceId: 'cr-801a',
        sanitizedPreview: '{"status":"200 OK","region":"europe-west1","instances":3,"cold_starts":0,"auth":"[MASQUÉ]"}'
      },
      {
        d: 0, h: 13, m: 15,
        id: 'CR-2026-802', app: 'Client', subscriptionName: 'DJASSA Mini',
        userId: 'CLI-109', userName: 'Salimata Bamba', userAvatar: AVATARS[2],
        opType: 'Validation panier & frais paiement en ligne', serviceTarget: settings.param1, endpoint: '/api/checkout/verify',
        primaryQty: 2600, primaryUnit: 'vCPU-s', secondaryQty: 1300, secondaryUnit: 'GiB-s',
        latencyMs: 42, status: 'success', httpCode: 200, billedByProvider: true,
        unitCostFCFA: 280, feeCostFCFA: 12, realCostFCFA: 292, revenueFCFA: 450, estimatedProfitFCFA: 158,
        providerTraceId: 'cr-802b',
        sanitizedPreview: '{"status":"200 OK","duration_ms":42,"memory":"512MiB"}'
      },
      {
        d: 1, h: 17, m: 20,
        id: 'CR-2026-803', app: 'Vendeur', subscriptionName: 'Vendeur Élite Studio',
        userId: 'SEL-201', userName: 'Kouassi Prestige Adjamé', userAvatar: AVATARS[3],
        opType: 'Traitement lot fiches produits & reçus', serviceTarget: settings.param1, endpoint: '/api/seller/batch-sync',
        primaryQty: 3100, primaryUnit: 'vCPU-s', secondaryQty: 1550, secondaryUnit: 'GiB-s',
        latencyMs: 65, status: 'success', httpCode: 200, billedByProvider: true,
        unitCostFCFA: 340, feeCostFCFA: 15, realCostFCFA: 355, revenueFCFA: 750, estimatedProfitFCFA: 395,
        providerTraceId: 'cr-803c',
        sanitizedPreview: '{"status":"200 OK","jobs_processed":140,"auth":"[MASQUÉ]"}'
      }
    ];
    seeds.forEach(s => {
      const t = isoDaysAgo(s.d, s.h, s.m);
      ops.push({ ...s, timestampIso: t.iso, dateLabel: t.dateLabel, timeLabel: t.timeLabel });
    });
  }

  return ops;
}
