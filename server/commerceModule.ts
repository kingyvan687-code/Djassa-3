import type { Express, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { databaseHealth, query, withTransaction } from './database';
import { atomicWriteJsonFile } from './atomicFileStore';
import {
  enqueueTwoPersonApprovalRequest,
  getControlPlaneQuotas,
  registerTwoPersonApprovalExecutor,
  SELLER_STORAGE_QUOTA_BYTES,
  validatePromoFromControlPlane
} from './adminControlPlaneModule';
import {
  fetchGeniusPayDepositStatus,
  fetchGeniusPayPayoutStatus,
  getGeniusPayConfig,
  initiateGeniusPayDeposit,
  initiateGeniusPayPayout,
  mapGeniusPayStatusToDjassa,
  maskPhoneNumber,
  redactWebhookPayload,
  verifyWebhookHmacSignature
} from './geniusPayService';
import { applyGeniusPayRefundWebhookEvent } from './refundsModule';
import {
  archivePgProduct,
  expirePgStaleReservations,
  recordPgOrderStatusTransition,
  reservePgInventoryForOrder,
  upsertPgStoreAndProduct
} from './repositories/commercePgRepository';
import {
  getPgSellerPayoutAccount,
  recordPgCommissionEntry,
  recordPgCommissionSettlement,
  recordPgFinancialReconciliationRun,
  recordPgPaymentWebhookEvent,
  recordPgWalletLedgerEntry,
  syncPgPaymentStatusUpdate,
  upsertPgSellerPayoutAccount
} from './repositories/financePgRepository';
import { syncPgChatMessage } from './repositories/communicationsPgRepository';
import {
  appendAuditEntry,
  authenticateSessionRequest,
  computeServerLedgerBalance,
  getClientIp,
  persistSecurityDb,
  recordVerifiedFinancialOperationInSecurityLedger,
  requireSecurityPermission,
  securityDb,
  type AuthenticatedRequestContext
} from './securityModule';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const COMMERCE_DB_FILE = path.join(DATA_DIR, 'commerce_db.json');

type CreditRechargeWebhookHandler = (input: {
  rechargeId: string;
  reference?: string;
  status: 'confirmed' | 'failed';
  providerReference?: string;
  providerStatus?: string;
  paidAmountFcfa?: number;
  expectedUserId?: string;
  verifiedBy?: string;
}) => {
  found: boolean;
  idempotent?: boolean;
  rejected?: boolean;
  error?: string;
  message?: string;
  newBalance?: number;
  activePlan?: string;
  recharge?: unknown;
};

let creditRechargeWebhookHandler: CreditRechargeWebhookHandler | null = null;

export function registerCreditRechargeWebhookHandler(handler: CreditRechargeWebhookHandler): void {
  creditRechargeWebhookHandler = handler;
}

export const VISIBLE_ORDER_STATUS = 'Commande confirmée' as const;
export const CLIENT_ONLINE_FEE_RATE = 0.065;
export const DJASSA_FIXED_COMMISSION_FCFA = 150;

export type OrderPaymentMode = 'online' | 'cod';
export type OnlineOrderPaymentMethod = 'wave' | 'orange_money';
export type OrderPaymentMethod = OnlineOrderPaymentMethod | 'cash_on_delivery';
export type OrderCommissionStatus = 'pending' | 'collected' | 'paid' | 'cancelled';
export type SellerPayoutStatus =
  | 'not_applicable'
  | 'pending_payment'
  | 'pending_config'
  | 'pending_seller_account'
  | 'initiated'
  | 'completed'
  | 'failed';

export interface ServerSellerPayoutSettings {
  sellerId: string;
  preferredChannel: 'wave' | 'orange_money';
  wavePhone?: string;
  orangeMoneyPhone?: string;
  accountHolderName?: string;
  updatedAt: string;
}

export interface ServerCommissionSettlement {
  id: string;
  orderId: string;
  orderNumber: string;
  sellerId: string;
  sellerName: string;
  amountFcfa: number;
  channel: string;
  providerReference?: string | null;
  status: 'pending_provider' | 'paid' | 'failed';
  settledBy?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface ServerPlatformConfig {
  marketplaceCommissionRate: number; // FCFA fixe par commande (150 FCFA)
  sellerCommissionRate: number; // FCFA fixe vendeur (150 FCFA)
  clientOnlineFeeRate: number; // 0.065 (6.5%)
  commissionModel: 'fixed_fcfa' | 'percentage';
  withdrawalFeeRate: number; // % frais retrait Mobile Money
  minOrderAmount: number;
  maxOrderAmount: number;
  requireKycForSellers: boolean;
  allowCashOnDelivery: boolean;
  autoValidateSellers: boolean;
  maintenanceMode: boolean;
  updatedAt: string;
}

export interface ServerProduct {
  id: string;
  sellerId: string;
  sellerName: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  discountPercentage?: number;
  reviewsCount?: number;
  stock: number;
  inStock: boolean;
  category: string;
  images: string[];
  videoPoster?: string;
  variants?: Array<{ type: string; options: string[] }>;
  variantStock?: Record<string, number>;
  parcelClass?: 'small' | 'standard' | 'bulky';
  mediaBytes?: number;
  salesCount: number;
  status: 'published' | 'paused' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface ServerOrder {
  id: string;
  orderNumber: string;
  clientId: string;
  clientName: string;
  sellerId: string;
  sellerName: string;
  sellerPhone?: string;
  items: Array<{
    productId: string;
    productTitle: string;
    productImage: string;
    price: number;
    quantity: number;
    variant: Record<string, string>;
    /** Exact variant inventory keys reserved by this order line. */
    variantStockKeys?: string[];
    sellerId: string;
    sellerName: string;
  }>;
  subtotal: number;
  discount: number;
  promoCode?: string;
  serviceFee: number;
  clientFeeFcfa: number;
  deliveryFee: number;
  commissionFcfa: number;
  commissionStatus: OrderCommissionStatus;
  sellerNetFcfa: number;
  sellerPayoutStatus: SellerPayoutStatus;
  sellerPayoutReference?: string | null;
  sellerPayoutChannel?: 'wave' | 'orange_money' | null;
  sellerPayoutPhone?: string | null;
  providerFeeFcfa?: number | null;
  total: number;
  deliveryMode: 'seller_managed' | 'normal' | 'express';
  paymentMode: OrderPaymentMode;
  paymentMethod: OrderPaymentMethod | 'mtn_momo' | 'card';
  paymentStatus: 'pending' | 'processing' | 'paid' | 'cod_pending' | 'failed' | 'refunded';
  paymentId: string;
  visibleStatus?: string;
  status:
    | 'pending_payment'
    | 'passed'
    | 'preparing'
    | 'ready_for_pickup'
    | 'driver_assigned'
    | 'in_delivery'
    | 'delivered'
    | 'cancelled';
  deliveryAddress: {
    commune: string;
    quartier: string;
    details: string;
    landmark?: string;
    deliveryInstructions?: string;
    gpsCoords?: { lat: number; lng: number };
    recipientName: string;
    phone: string;
    absencePolicy?: 'return_to_seller_next_day' | 'leave_with_authorized_person';
    absenceRecipientName?: string;
    absenceRecipientPhone?: string;
  };
  /** Optional historical legacy metadata kept read-only for older orders */
  driverId?: string;
  driverName?: string;
  deliveryCompanyId?: string;
  deliveryCompanyName?: string;
  otpCode?: string;
  settled: boolean;
  stockRestored: boolean;
  parcelClass?: 'small' | 'standard' | 'bulky';
  checkoutGroupId?: string;
  /** Temporary stock reservation deadline for unpaid online orders. */
  reservationExpiresAt?: string;
  trackingEvents: Array<{
    status: string;
    label: string;
    time: string;
    done: boolean;
    description?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ServerPaymentRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  clientId: string;
  checkoutGroupId?: string;
  provider: OrderPaymentMethod | 'mtn_momo' | 'card';
  providerReference: string | null;
  providerConfigured: boolean;
  providerFeeFcfa?: number | null;
  checkoutUrl?: string | null;
  idempotencyKey: string;
  amountFcfa: number;
  status: 'pending' | 'processing' | 'confirmed' | 'failed' | 'cancelled' | 'refunded';
  verifiedWebhookAt: string | null;
  confirmedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerWithdrawalRecord {
  id: string;
  accountId: string;
  accountEmail: string;
  accountName: string;
  role: 'seller';
  amountFcfa: number;
  feeFcfa: number;
  netAmountFcfa: number;
  channel: string;
  payoutTargetMasked: string;
  payoutTargetRaw?: string;
  reference: string;
  status: 'completed' | 'held_security' | 'rejected' | 'failed';
  geniusPayPayoutStatus?: string;
  approvalId?: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionReason?: string;
  suspicionReasons?: string[];
  createdAt: string;
}

export interface ServerConversation {
  id: string;
  participantIds: string[];
  title: string;
  orderId?: string;
  lastMessage: string;
  updatedAt: string;
}

export interface ServerMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  body: string;
  type?: string;
  mediaUrl?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface ServerNotification {
  id: string;
  userId: string;
  targetRoles?: string[];
  type: 'order' | 'delivery' | 'finance' | 'security' | 'system';
  title: string;
  body: string;
  referenceId?: string;
  read: boolean;
  createdAt: string;
}

interface CommerceDatabase {
  platformConfig: ServerPlatformConfig;
  products: ServerProduct[];
  orders: ServerOrder[];
  payments: ServerPaymentRecord[];
  withdrawals: ServerWithdrawalRecord[];
  sellerPayoutAccounts: Record<string, ServerSellerPayoutSettings>;
  commissionSettlements: ServerCommissionSettlement[];
  conversations: ServerConversation[];
  messages: Record<string, ServerMessage[]>;
  notifications: ServerNotification[];
  processedWebhookKeys: Record<string, { at: string; paymentId: string; status: string }>;
  processedIdempotencyKeys: Record<string, { type: string; entityId: string; at: string }>;
}

const DEFAULT_CONFIG: ServerPlatformConfig = {
  marketplaceCommissionRate: DJASSA_FIXED_COMMISSION_FCFA,
  sellerCommissionRate: DJASSA_FIXED_COMMISSION_FCFA,
  clientOnlineFeeRate: CLIENT_ONLINE_FEE_RATE,
  commissionModel: 'fixed_fcfa',
  withdrawalFeeRate: 10,
  minOrderAmount: 1000,
  maxOrderAmount: 2500000,
  requireKycForSellers: true,
  allowCashOnDelivery: true,
  autoValidateSellers: false,
  maintenanceMode: false,
  updatedAt: new Date().toISOString()
};

const DEFAULT_PRODUCTS: ServerProduct[] = [
  {
    id: 'prod-1',
    sellerId: 'seller-1',
    sellerName: 'Boutique Wax & Élégance',
    name: 'Robe Wax Moderne Africaine Stylée',
    description: 'Magnifique ensemble robe wax taillée sur mesure, tissu 100% coton véritable Uniwax. Idéale pour vos cérémonies et sorties chics à Abidjan.',
    price: 18500,
    originalPrice: 25000,
    discountPercentage: 26,
    reviewsCount: 128,
    stock: 24,
    inStock: true,
    category: 'Mode & Habillement',
    images: [
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600'
    ],
    variants: [
      { type: 'Couleur', options: ['Orange / Bleu', 'Vert Émeraude', 'Jaune Soleil'] },
      { type: 'Taille', options: ['S', 'M', 'L', 'XL'] }
    ],
    variantStock: {
      'Orange / Bleu': 8,
      'Vert Émeraude': 8,
      'Jaune Soleil': 8,
      S: 4,
      M: 8,
      L: 6,
      XL: 6
    },
    salesCount: 1420,
    status: 'published',
    createdAt: new Date(Date.now() - 864e5 * 14).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-2',
    sellerId: 'seller-2',
    sellerName: 'HighTech Abidjan Express',
    name: 'Écouteurs Bluetooth Pro 5.3 Stéréo',
    description: 'Écouteurs intra-auriculaires autonomie 28h avec boîtier numérique LED, réduction de bruit active et son bass puissant.',
    price: 12000,
    originalPrice: 16000,
    discountPercentage: 25,
    reviewsCount: 64,
    stock: 50,
    inStock: true,
    category: 'Électronique & High-Tech',
    images: [
      'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600',
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600'
    ],
    variants: [{ type: 'Couleur', options: ['Noir Mat', 'Blanc Perle'] }],
    variantStock: { 'Noir Mat': 30, 'Blanc Perle': 20 },
    salesCount: 220,
    status: 'published',
    createdAt: new Date(Date.now() - 864e5 * 12).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-3',
    sellerId: 'seller-3',
    sellerName: 'Kaba & Souliers Chic',
    name: 'Mocassins Cuir Homme Faits Main',
    description: 'Chaussures mocassins confortables en cuir pleine fleur cousues main. Semelle antidérapante souple et durable pour le travail ou les cérémonies.',
    price: 24500,
    originalPrice: 32000,
    discountPercentage: 23,
    reviewsCount: 38,
    stock: 15,
    inStock: true,
    category: 'Chaussures & Maroquinerie',
    images: [
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600',
      'https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=600'
    ],
    variants: [
      { type: 'Taille', options: ['40', '41', '42', '43', '44', '45'] },
      { type: 'Couleur', options: ['Marron Cognac', 'Noir Profond'] }
    ],
    variantStock: { 'Marron Cognac': 9, 'Noir Profond': 6, '40': 2, '41': 3, '42': 4, '43': 3, '44': 2, '45': 1 },
    salesCount: 95,
    status: 'published',
    createdAt: new Date(Date.now() - 864e5 * 11).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-4',
    sellerId: 'seller-1',
    sellerName: 'Boutique Wax & Élégance',
    name: 'Sac à Main Cuir & Pagne Baoulé Tissé',
    description: 'Sac artisanal haut de gamme confectionné à la main avec empiècements en pagne Baoulé traditionnel d’Ahougnansou et cuir noble.',
    price: 26000,
    originalPrice: 35000,
    discountPercentage: 25,
    reviewsCount: 94,
    stock: 18,
    inStock: true,
    category: 'Sacs & Maroquinerie',
    images: [
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600',
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600'
    ],
    variants: [{ type: 'Couleur', options: ['Bleu Indigo Royal', 'Ocre Solaire'] }],
    variantStock: { 'Bleu Indigo Royal': 10, 'Ocre Solaire': 8 },
    salesCount: 1100,
    status: 'published',
    createdAt: new Date(Date.now() - 864e5 * 10).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-5',
    sellerId: 'seller-1',
    sellerName: 'Boutique Wax & Élégance',
    name: 'Ensemble Boubou Bazin Riche Brodé',
    description: 'Ensemble traditionnel en Bazin riche teinté à l’indigo naturel avec broderies royales dorées au fil de soie.',
    price: 45000,
    originalPrice: 60000,
    discountPercentage: 25,
    reviewsCount: 152,
    stock: 12,
    inStock: true,
    category: 'Mode & Cérémonie',
    images: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600'
    ],
    variants: [{ type: 'Taille', options: ['M', 'L', 'XL', 'XXL'] }],
    variantStock: { M: 3, L: 4, XL: 3, XXL: 2 },
    salesCount: 2300,
    status: 'published',
    createdAt: new Date(Date.now() - 864e5 * 9).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-6',
    sellerId: 'seller-1',
    sellerName: 'Boutique Wax & Élégance',
    name: 'Combinaison Pantalon Wax Ankara Chic',
    description: 'Combinaison élégante cintrée à la taille avec ceinture amovible et poches italiennes. Tissu Wax hollandais garanti grand teint.',
    price: 22000,
    originalPrice: 28000,
    discountPercentage: 21,
    reviewsCount: 81,
    stock: 16,
    inStock: true,
    category: 'Mode & Habillement',
    images: [
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600'
    ],
    variants: [
      { type: 'Taille', options: ['S', 'M', 'L', 'XL'] },
      { type: 'Modèle', options: ['Fleurs de Mariage', 'Écailles Royales'] }
    ],
    variantStock: { S: 4, M: 5, L: 4, XL: 3, 'Fleurs de Mariage': 9, 'Écailles Royales': 7 },
    salesCount: 1000,
    status: 'published',
    createdAt: new Date(Date.now() - 864e5 * 8).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-7',
    sellerId: 'seller-1',
    sellerName: 'Boutique Wax & Élégance',
    name: 'Chemise Homme Lin Pur & Détails Wax Tissé',
    description: 'Chemise col officier en lin naturel respirant avec liseré et manchettes en véritable pagne tissé.',
    price: 16500,
    originalPrice: 20000,
    discountPercentage: 17,
    reviewsCount: 54,
    stock: 22,
    inStock: true,
    category: 'Mode Homme',
    images: [
      'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600',
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600'
    ],
    variants: [
      { type: 'Taille', options: ['M', 'L', 'XL', 'XXL'] },
      { type: 'Couleur', options: ['Blanc Cassé & Wax', 'Bleu Ciel & Wax'] }
    ],
    variantStock: { M: 5, L: 7, XL: 6, XXL: 4, 'Blanc Cassé & Wax': 12, 'Bleu Ciel & Wax': 10 },
    salesCount: 820,
    status: 'published',
    createdAt: new Date(Date.now() - 864e5 * 7).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-8',
    sellerId: 'seller-1',
    sellerName: 'Boutique Wax & Élégance',
    name: 'Arrivage Capsule Baoulé & Sacs Pochette Fête',
    description: 'Nouvel arrivage spécial fêtes ! Pochette de soirée rigide avec fermoir doré bijou et empiècement en pagne Baoulé d’apparat fait main.',
    price: 18000,
    originalPrice: 22000,
    discountPercentage: 18,
    reviewsCount: 110,
    stock: 30,
    inStock: true,
    category: 'Sacs & Maroquinerie',
    images: [
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600'
    ],
    variants: [{ type: 'Modèle', options: ['Pochette Soirée Or', 'Bandoulière Cuir Noir'] }],
    variantStock: { 'Pochette Soirée Or': 18, 'Bandoulière Cuir Noir': 12 },
    salesCount: 1540,
    status: 'published',
    createdAt: new Date(Date.now() - 864e5 * 6).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-9',
    sellerId: 'seller-2',
    sellerName: 'HighTech Abidjan Express',
    name: 'Pack Ménage Express : Balai Magique Essoreur 360° + Nettoyant 5L',
    description: 'Kit de ménage complet professionnel comprenant un seau à double compartiment essorage rapide, tête microfibre rotative et détergent sol parfumé longue durée.',
    price: 14500,
    originalPrice: 19000,
    discountPercentage: 23,
    reviewsCount: 29,
    stock: 35,
    inStock: true,
    category: 'Ménage & Entretien',
    images: [
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600',
      'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=600'
    ],
    variants: [{ type: 'Option', options: ['Lavande Provençale', 'Citron Frais', 'Jasmin des Îles'] }],
    variantStock: { 'Lavande Provençale': 15, 'Citron Frais': 12, 'Jasmin des Îles': 8 },
    salesCount: 112,
    status: 'published',
    createdAt: new Date(Date.now() - 864e5 * 5).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-10',
    sellerId: 'seller-1',
    sellerName: 'Boutique Wax & Élégance',
    name: 'Canapé Salon Scandinave 3 Places Velours & Coussins Déco',
    description: 'Canapé droit au style contemporain, assise ultra-moelleuse haute résilience avec pieds en bois massif et 3 coussins assortis inclus.',
    price: 145000,
    originalPrice: 180000,
    discountPercentage: 19,
    reviewsCount: 12,
    stock: 6,
    inStock: true,
    category: 'Meubles & Mobilier',
    images: [
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600',
      'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?w=600'
    ],
    variants: [{ type: 'Couleur', options: ['Bleu Nuit Canard', 'Gris Anthracite', 'Vert Forêt'] }],
    variantStock: { 'Bleu Nuit Canard': 2, 'Gris Anthracite': 2, 'Vert Forêt': 2 },
    salesCount: 18,
    status: 'published',
    createdAt: new Date(Date.now() - 864e5 * 4).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-11',
    sellerId: 'seller-1',
    sellerName: 'Boutique Wax & Élégance',
    name: 'Table Basse Salon Bois Massif Iroko & Métal Noir',
    description: 'Table basse artisanale fabriquée à Adjamé avec plateau en bois d’Iroko verni haute protection et piètement géométrique acier noir mat.',
    price: 48000,
    originalPrice: 60000,
    discountPercentage: 20,
    reviewsCount: 74,
    stock: 9,
    inStock: true,
    category: 'Meubles & Mobilier',
    images: [
      'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=600',
      'https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=600'
    ],
    variants: [{ type: 'Modèle', options: ['Iroko Naturel Brut', 'Teck Foncé Mat'] }],
    variantStock: { 'Iroko Naturel Brut': 5, 'Teck Foncé Mat': 4 },
    salesCount: 1200,
    status: 'published',
    createdAt: new Date(Date.now() - 864e5 * 3).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod-12',
    sellerId: 'seller-3',
    sellerName: 'Kaba & Souliers Chic',
    name: 'Sneakers Baskets Streetwear Running Air Cushion',
    description: 'Baskets ultra-légères semelle à bulle d\'air amortissante. Tige en mesh aéré respirant pour le sport, la marche et le style urbain quotidien.',
    price: 19500,
    originalPrice: 26000,
    discountPercentage: 25,
    reviewsCount: 41,
    stock: 28,
    inStock: true,
    category: 'Chaussures & Baskets',
    images: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600',
      'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=600'
    ],
    variants: [
      { type: 'Taille', options: ['39', '40', '41', '42', '43', '44'] },
      { type: 'Couleur', options: ['Rouge Écarlate & Blanc', 'Noir Triple Stealth'] }
    ],
    variantStock: {
      'Rouge Écarlate & Blanc': 15,
      'Noir Triple Stealth': 13,
      '39': 4,
      '40': 5,
      '41': 6,
      '42': 6,
      '43': 4,
      '44': 3
    },
    salesCount: 77,
    status: 'published',
    createdAt: new Date(Date.now() - 864e5 * 2).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Delivery companies & external courier fleet removed (seller manages delivery externally)

interface ServerPromoRule {
  code: string;
  type: 'fixed' | 'percent';
  value: number;
  maxDiscount?: number;
  minSubtotal: number;
  label: string;
  description: string;
  active: boolean;
  expiresAt?: string;
}

const SERVER_PROMO_RULES: ServerPromoRule[] = [
  {
    code: 'ADJAME10',
    type: 'fixed',
    value: 2000,
    minSubtotal: 10000,
    label: 'ADJAME10 (-2 000 FCFA)',
    description: 'Réduction immédiate de 2 000 FCFA dès 10 000 FCFA d’achats.',
    active: true
  },
  {
    code: 'DJASSA',
    type: 'fixed',
    value: 5000,
    minSubtotal: 20000,
    label: 'DJASSA (-5 000 FCFA)',
    description: 'Bon privilège DJASSA de 5 000 FCFA dès 20 000 FCFA d’achats.',
    active: true
  },
  {
    code: 'BIENVENUE',
    type: 'percent',
    value: 10,
    maxDiscount: 5000,
    minSubtotal: 5000,
    label: 'BIENVENUE (-10%)',
    description: '10% de remise (jusqu’à 5 000 FCFA) sur votre commande.',
    active: true
  }
];

function validatePromoCodeServer(rawCode: string, subtotal: number): {
  valid: boolean;
  code: string;
  discountFcfa: number;
  label?: string;
  description?: string;
  error?: string;
  message?: string;
} {
  const controlPlaneMatch = validatePromoFromControlPlane(rawCode, subtotal);
  if (controlPlaneMatch.found) {
    return {
      valid: controlPlaneMatch.valid,
      code: controlPlaneMatch.code,
      discountFcfa: controlPlaneMatch.discountFcfa,
      label: controlPlaneMatch.label,
      description: controlPlaneMatch.description,
      error: controlPlaneMatch.error,
      message: controlPlaneMatch.message
    };
  }
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) {
    return { valid: false, code: '', discountFcfa: 0, error: 'EMPTY_PROMO_CODE', message: 'Veuillez saisir un code promo.' };
  }
  const rule = SERVER_PROMO_RULES.find((r) => r.code === code);
  if (!rule || !rule.active) {
    return { valid: false, code, discountFcfa: 0, error: 'INVALID_PROMO_CODE', message: 'Code promo invalide ou expiré.' };
  }
  if (rule.expiresAt && Date.now() > Date.parse(rule.expiresAt)) {
    return { valid: false, code, discountFcfa: 0, error: 'EXPIRED_PROMO_CODE', message: 'Ce code promo a expiré.' };
  }
  if (subtotal < rule.minSubtotal) {
    return {
      valid: false,
      code,
      discountFcfa: 0,
      error: 'PROMO_MIN_SUBTOTAL',
      message: `Ce code requiert un sous-total minimum de ${rule.minSubtotal.toLocaleString('fr-FR')} FCFA.`
    };
  }
  const rawDiscount = rule.type === 'fixed' ? rule.value : Math.round((subtotal * rule.value) / 100);
  const capped = rule.maxDiscount ? Math.min(rawDiscount, rule.maxDiscount) : rawDiscount;
  const discountFcfa = Math.min(subtotal, Math.max(0, capped));
  return {
    valid: true,
    code: rule.code,
    discountFcfa,
    label: rule.label,
    description: rule.description
  };
}

function inferProductParcelClass(product: Pick<ServerProduct, 'parcelClass' | 'category' | 'name'>): 'small' | 'standard' | 'bulky' {
  if (product.parcelClass === 'bulky' || product.parcelClass === 'small' || product.parcelClass === 'standard') {
    return product.parcelClass;
  }
  const text = `${product.category || ''} ${product.name || ''}`.toLowerCase();
  if (/(meuble|mobilier|canap[ée]|table|armoire|réfrigérateur|frigo|congélateur|matelas|lave-linge|électroménager)/.test(text)) {
    return 'bulky';
  }
  if (/(écouteur|bijou|montre|accessoire|téléphone|smartphone|coque)/.test(text)) {
    return 'small';
  }
  return 'standard';
}

function estimateProductMediaBytes(input: { images?: string[]; videoPoster?: string; mediaBytes?: number }): number {
  if (typeof input.mediaBytes === 'number' && Number.isFinite(input.mediaBytes) && input.mediaBytes >= 0) {
    return Math.round(input.mediaBytes);
  }
  let total = 0;
  for (const url of input.images || []) {
    if (!url) continue;
    total += url.startsWith('data:') ? Buffer.byteLength(url, 'utf8') : 180_000;
  }
  if (input.videoPoster) {
    total += input.videoPoster.startsWith('data:') ? Buffer.byteLength(input.videoPoster, 'utf8') : 250_000;
  }
  return total;
}

function computeSellerStorageStats(sellerId: string) {
  const sellerProducts = commerceDb.products.filter((p) => p.sellerId === sellerId && p.status !== 'archived');
  const usedBytes = sellerProducts.reduce((sum, p) => sum + estimateProductMediaBytes(p), 0);
  const quotas = getControlPlaneQuotas();
  const quotaBytes = Math.min(SELLER_STORAGE_QUOTA_BYTES, quotas.maxSellerStorageBytes || SELLER_STORAGE_QUOTA_BYTES);
  const usagePercent = quotaBytes > 0 ? Math.min(100, Number(((usedBytes / quotaBytes) * 100).toFixed(2))) : 0;
  return {
    sellerId,
    usedBytes,
    quotaBytes,
    remainingBytes: Math.max(0, quotaBytes - usedBytes),
    usagePercent,
    productCount: sellerProducts.length,
    maxProducts: quotas.maxProductsPerSeller
  };
}

export let commerceDb: CommerceDatabase = {
  platformConfig: { ...DEFAULT_CONFIG },
  products: [...DEFAULT_PRODUCTS],
  orders: [],
  payments: [],
  withdrawals: [],
  sellerPayoutAccounts: {
    'seller-1': {
      sellerId: 'seller-1',
      preferredChannel: 'wave',
      wavePhone: '+225 07 08 11 22 33',
      accountHolderName: 'Boutique Wax & Élégance',
      updatedAt: new Date().toISOString()
    }
  },
  commissionSettlements: [],
  conversations: [
    {
      id: 'conv-client-seller-1',
      participantIds: ['client-demo-1', 'seller-1'],
      title: 'Boutique Wax & Élégance',
      lastMessage: 'Bonjour ! Tous nos modèles Wax sont disponibles en stock à Adjamé.',
      updatedAt: new Date(Date.now() - 3600_000).toISOString()
    }
  ],
  messages: {
    'conv-client-seller-1': [
      {
        id: 'msg-init-1',
        conversationId: 'conv-client-seller-1',
        senderId: 'seller-1',
        senderName: 'Boutique Wax & Élégance',
        senderRole: 'seller',
        body: 'Bonjour ! Tous nos modèles Wax sont disponibles en stock à Adjamé.',
        createdAt: new Date(Date.now() - 3600_000).toISOString()
      }
    ]
  },
  notifications: [],
  processedWebhookKeys: {},
  processedIdempotencyKeys: {}
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function persistCommerceDb(): boolean {
  const ok = atomicWriteJsonFile(COMMERCE_DB_FILE, commerceDb, { context: 'CommerceModule' });
  if (!ok) {
    console.error('[CommerceModule] Failed to persist commerce DB');
  }
  return ok;
}

/**
 * Restore stock reserved by an order exactly once.
 * This JSON-backed adapter is still single-process only; production inventory
 * must move to a PostgreSQL transaction with row locks.
 */
function restoreOrderStock(order: ServerOrder): boolean {
  if (order.stockRestored) return false;
  for (const item of order.items) {
    const product = commerceDb.products.find((candidate) => candidate.id === item.productId);
    if (!product) continue;
    product.stock += item.quantity;
    if (!order.reservationExpiresAt) product.salesCount = Math.max(0, (product.salesCount || 0) - item.quantity);
    product.inStock = product.stock > 0;
    if (product.variantStock) {
      const keys = Array.isArray(item.variantStockKeys)
        ? item.variantStockKeys
        : Object.values(item.variant || {}).filter((value) => Object.prototype.hasOwnProperty.call(product.variantStock!, value));
      for (const key of new Set(keys)) {
        if (Object.prototype.hasOwnProperty.call(product.variantStock, key)) {
          product.variantStock[key] += item.quantity;
        }
      }
    }
    product.updatedAt = new Date().toISOString();
  }
  order.stockRestored = true;
  return true;
}

export function ensureClientSupportConversation(
  uid: string,
  userName: string,
  topic?: string
): { conversation: ServerConversation; messages: ServerMessage[] } {
  const convId = `conv-support-${uid}`;
  let conv = commerceDb.conversations.find((c) => c.id === convId);
  const nowIso = new Date().toISOString();
  if (!conv) {
    conv = {
      id: convId,
      participantIds: [uid, 'support-djassa'],
      title: 'Support Client DJASSA',
      lastMessage: 'Bonjour ! Comment pouvons-nous vous aider aujourd’hui ?',
      updatedAt: nowIso
    };
    commerceDb.conversations.unshift(conv);
    commerceDb.messages[convId] = [
      {
        id: `msg-sup-${crypto.randomUUID().slice(0, 8)}`,
        conversationId: convId,
        senderId: 'support-djassa',
        senderName: 'Support Client DJASSA',
        senderRole: 'admin',
        body: `Bonjour ${userName || 'Client'} ! Notre équipe support est à votre écoute.${topic ? ` Sujet : ${topic}` : ''}`,
        type: 'text',
        createdAt: nowIso
      }
    ];
    persistCommerceDb();
  } else if (topic) {
    const msg: ServerMessage = {
      id: `msg-sup-${crypto.randomUUID().slice(0, 8)}`,
      conversationId: convId,
      senderId: uid,
      senderName: userName || 'Client',
      senderRole: 'client',
      body: `Demande d'assistance : ${topic}`,
      type: 'text',
      createdAt: nowIso
    };
    if (!commerceDb.messages[convId]) commerceDb.messages[convId] = [];
    commerceDb.messages[convId].push(msg);
    conv.lastMessage = msg.body;
    conv.updatedAt = nowIso;
    persistCommerceDb();
  }
  return {
    conversation: conv,
    messages: commerceDb.messages[convId] || []
  };
}

function seedVerifiedInitialWalletsIfEmpty() {
  // Seed initial verified earned revenue entries ONLY once for seller-1 (never seed driver/company accounts)
  const hasAnySellerCredit = securityDb.financeLedger.some((e) => e.accountId === 'seller-1');
  if (!hasAnySellerCredit) {
    recordVerifiedFinancialOperationInSecurityLedger({
      reference: 'SEED-EARN-SELLER-1',
      accountId: 'seller-1',
      accountName: 'Boutique Wax & Élégance',
      accountEmail: 'vendeur@djassa.ci',
      spaceRole: 'seller',
      type: 'credit',
      amountFcfa: 125000,
      channel: 'Ventes confirmées',
      actorName: 'Système DJASSA',
      note: 'Solde initial vérifié des ventes confirmées'
    });
  }
}

function normalizeLegacyOrder(raw: Record<string, unknown>): ServerOrder {
  const o = raw as unknown as ServerOrder;
  const subtotal = Math.max(0, Math.round(Number(o.subtotal || 0)));
  const discount = Math.max(0, Math.round(Number(o.discount || 0)));
  const merchandiseNet = Math.max(0, subtotal - discount);
  const paymentMode: OrderPaymentMode =
    o.paymentMode === 'cod' || o.paymentMethod === 'cash_on_delivery' ? 'cod' : 'online';
  const commissionFcfa =
    typeof o.commissionFcfa === 'number' && Number.isFinite(o.commissionFcfa)
      ? Math.max(0, Math.round(o.commissionFcfa))
      : DJASSA_FIXED_COMMISSION_FCFA;
  const clientFeeFcfa =
    typeof o.clientFeeFcfa === 'number' && Number.isFinite(o.clientFeeFcfa)
      ? Math.max(0, Math.round(o.clientFeeFcfa))
      : paymentMode === 'cod'
      ? 0
      : Math.max(0, Math.round(Number(o.serviceFee ?? 0)));
  const sellerNetFcfa =
    typeof o.sellerNetFcfa === 'number' && Number.isFinite(o.sellerNetFcfa)
      ? Math.max(0, Math.round(o.sellerNetFcfa))
      : Math.max(0, merchandiseNet - commissionFcfa);
  const commissionStatus: OrderCommissionStatus =
    o.commissionStatus && ['pending', 'collected', 'paid', 'cancelled'].includes(o.commissionStatus)
      ? o.commissionStatus
      : o.status === 'cancelled'
      ? 'cancelled'
      : paymentMode === 'online' && o.paymentStatus === 'paid'
      ? 'collected'
      : 'pending';
  const sellerPayoutStatus: SellerPayoutStatus =
    o.sellerPayoutStatus ||
    (paymentMode === 'cod'
      ? 'not_applicable'
      : o.paymentStatus === 'paid'
      ? 'pending_seller_account'
      : 'pending_payment');
  return {
    ...o,
    paymentMode,
    clientFeeFcfa,
    commissionFcfa,
    commissionStatus,
    sellerNetFcfa,
    sellerPayoutStatus,
    deliveryFee: typeof o.deliveryFee === 'number' ? o.deliveryFee : 0
  };
}

function loadCommerceDb() {
  ensureDataDir();
  if (fs.existsSync(COMMERCE_DB_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(COMMERCE_DB_FILE, 'utf8'));
      const loadedProducts: ServerProduct[] =
        Array.isArray(parsed.products) && parsed.products.length > 0 ? parsed.products : [...DEFAULT_PRODUCTS];
      const byProdId = new Map(loadedProducts.map((p) => [p.id, p]));
      let catalogSynced = false;
      for (const defProd of DEFAULT_PRODUCTS) {
        const existing = byProdId.get(defProd.id);
        if (!existing) {
          loadedProducts.push(defProd);
          catalogSynced = true;
        } else {
          if (!existing.variants && defProd.variants) {
            existing.variants = defProd.variants;
            catalogSynced = true;
          }
          if (!existing.variantStock && defProd.variantStock) {
            existing.variantStock = defProd.variantStock;
            catalogSynced = true;
          }
          if (existing.discountPercentage === undefined && defProd.discountPercentage !== undefined) {
            existing.discountPercentage = defProd.discountPercentage;
            catalogSynced = true;
          }
          if (existing.reviewsCount === undefined && defProd.reviewsCount !== undefined) {
            existing.reviewsCount = defProd.reviewsCount;
            catalogSynced = true;
          }
        }
      }

      const rawOrders = Array.isArray(parsed.orders) ? parsed.orders : [];
      const normalizedOrders = rawOrders.map((raw: Record<string, unknown>) => normalizeLegacyOrder(raw));

      const defaultSellerAccounts = commerceDb.sellerPayoutAccounts;
      const loadedSellerAccounts =
        parsed.sellerPayoutAccounts && typeof parsed.sellerPayoutAccounts === 'object'
          ? { ...defaultSellerAccounts, ...parsed.sellerPayoutAccounts }
          : defaultSellerAccounts;

      commerceDb = {
        platformConfig: {
          ...DEFAULT_CONFIG,
          ...(parsed.platformConfig || {}),
          clientOnlineFeeRate: CLIENT_ONLINE_FEE_RATE,
          allowCashOnDelivery: true
        },
        products: loadedProducts,
        orders: normalizedOrders,
        payments: Array.isArray(parsed.payments) ? parsed.payments : [],
        withdrawals: Array.isArray(parsed.withdrawals) ? parsed.withdrawals : [],
        sellerPayoutAccounts: loadedSellerAccounts,
        commissionSettlements: Array.isArray(parsed.commissionSettlements) ? parsed.commissionSettlements : [],
        conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
        messages: parsed.messages && typeof parsed.messages === 'object' ? parsed.messages : {},
        notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
        processedWebhookKeys:
          parsed.processedWebhookKeys && typeof parsed.processedWebhookKeys === 'object' ? parsed.processedWebhookKeys : {},
        processedIdempotencyKeys:
          parsed.processedIdempotencyKeys && typeof parsed.processedIdempotencyKeys === 'object'
            ? parsed.processedIdempotencyKeys
            : {}
      };
      if (catalogSynced) {
        persistCommerceDb();
      }
    } catch (err) {
      console.error('[CommerceModule] Error loading commerce_db.json:', err);
    }
  } else {
    persistCommerceDb();
  }
  seedVerifiedInitialWalletsIfEmpty();
}

loadCommerceDb();

function maskTarget(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return 'Compte vérifié';
  if (s.length <= 4) return '****';
  return `***${s.slice(-4)}`;
}

function pushNotification(params: Omit<ServerNotification, 'id' | 'read' | 'createdAt'>) {
  const notif: ServerNotification = {
    ...params,
    id: `ntf-${crypto.randomUUID().slice(0, 10)}`,
    read: false,
    createdAt: new Date().toISOString()
  };
  commerceDb.notifications.unshift(notif);
  if (commerceDb.notifications.length > 1000) {
    commerceDb.notifications = commerceDb.notifications.slice(0, 1000);
  }
}

function isGatewayConfigured(_provider: ServerPaymentRecord['provider']): boolean {
  return getGeniusPayConfig().configured;
}

export function computeOrderCommissions(order: Pick<ServerOrder, 'subtotal' | 'discount' | 'paymentMode' | 'commissionFcfa'>) {
  const merchandiseNet = Math.max(0, Math.round(order.subtotal) - Math.round(order.discount || 0));
  const sellerFee =
    typeof order.commissionFcfa === 'number' && Number.isFinite(order.commissionFcfa)
      ? Math.max(0, Math.round(order.commissionFcfa))
      : DJASSA_FIXED_COMMISSION_FCFA;
  const clientFeeFcfa = order.paymentMode === 'cod' ? 0 : Math.round(merchandiseNet * CLIENT_ONLINE_FEE_RATE);
  const sellerNet = Math.max(0, merchandiseNet - sellerFee);
  return { sellerFee, clientFeeFcfa, sellerNet };
}

async function attemptDirectSellerPayout(order: ServerOrder): Promise<void> {
  if (order.paymentMode !== 'online' || order.paymentStatus !== 'paid') return;
  if (order.sellerNetFcfa <= 0) {
    order.sellerPayoutStatus = 'not_applicable';
    return;
  }

  let sellerAccount = commerceDb.sellerPayoutAccounts[order.sellerId] || null;
  if (!sellerAccount) {
    const pgAcc = await getPgSellerPayoutAccount(order.sellerId).catch(() => null);
    if (pgAcc) {
      sellerAccount = {
        sellerId: pgAcc.seller_id,
        preferredChannel: pgAcc.preferred_channel,
        wavePhone: pgAcc.wave_phone || undefined,
        orangeMoneyPhone: pgAcc.orange_money_phone || undefined,
        accountHolderName: pgAcc.account_holder_name || undefined,
        updatedAt: pgAcc.updated_at
      };
      commerceDb.sellerPayoutAccounts[order.sellerId] = sellerAccount;
    }
  }

  const preferredChannel = sellerAccount?.preferredChannel || 'wave';
  const rawPhone =
    preferredChannel === 'wave'
      ? sellerAccount?.wavePhone || sellerAccount?.orangeMoneyPhone || ''
      : sellerAccount?.orangeMoneyPhone || sellerAccount?.wavePhone || '';
  const actualChannel: 'wave' | 'orange_money' =
    sellerAccount?.preferredChannel === 'wave' && sellerAccount?.wavePhone
      ? 'wave'
      : sellerAccount?.preferredChannel === 'orange_money' && sellerAccount?.orangeMoneyPhone
      ? 'orange_money'
      : sellerAccount?.wavePhone
      ? 'wave'
      : 'orange_money';

  if (!sellerAccount || !rawPhone.trim()) {
    order.sellerPayoutStatus = 'pending_seller_account';
    order.sellerPayoutChannel = actualChannel;
    order.sellerPayoutPhone = null;
    order.trackingEvents.push({
      status: 'payout_pending_seller_account',
      label: 'Reversement vendeur en attente (compte Wave/OM vendeur non configuré)',
      time: new Date().toISOString(),
      done: false
    });
    return;
  }

  order.sellerPayoutChannel = actualChannel;
  order.sellerPayoutPhone = maskTarget(rawPhone);

  if (!getGeniusPayConfig().configured) {
    // HONESTY: Never fake a completed payout when GENIUSPAY_API_KEY is missing!
    order.sellerPayoutStatus = 'pending_config';
    order.trackingEvents.push({
      status: 'payout_pending_config',
      label: `Reversement ${order.sellerNetFcfa.toLocaleString('fr-FR')} FCFA en attente (passerelle GeniusPay non configurée)`,
      time: new Date().toISOString(),
      done: false
    });
    return;
  }

  const payoutId = `payout-${order.id}`;
  order.sellerPayoutReference = payoutId;
  const payoutRes = await initiateGeniusPayPayout({
    payoutId,
    amountFcfa: order.sellerNetFcfa,
    provider: actualChannel,
    recipientPhone: rawPhone,
    statementDescription: `VENTE ${order.orderNumber}`
  });

  if (payoutRes.ok) {
    // Strictly 'initiated' until GeniusPay payout webhook confirms 'completed'
    order.sellerPayoutStatus = 'initiated';
    order.sellerPayoutReference = payoutRes.payoutId || payoutId;
    order.trackingEvents.push({
      status: 'payout_initiated',
      label: `Reversement vendeur initié (${actualChannel === 'wave' ? 'Wave' : 'Orange Money'})`,
      time: new Date().toISOString(),
      done: true,
      description: `Réf ${order.sellerPayoutReference} • Montant net ${order.sellerNetFcfa.toLocaleString('fr-FR')} FCFA`
    });
  } else {
    order.sellerPayoutStatus = 'failed';
    order.trackingEvents.push({
      status: 'payout_failed',
      label: `Échec initiation reversement vendeur (${payoutRes.error || 'GENIUSPAY_ERROR'})`,
      time: new Date().toISOString(),
      done: false
    });
  }
}

async function applyOnlineOrderPaymentConfirmed(
  order: ServerOrder,
  payment: ServerPaymentRecord,
  source: 'webhook' | 'api' | 'admin',
  actorName: string,
  providerReference: string,
  providerFeeFcfa?: number | null
): Promise<void> {
  const nowIso = new Date().toISOString();
  const prevOrderStatus = order.status;
  payment.status = 'confirmed';
  payment.providerReference = providerReference;
  if (source === 'webhook') {
    payment.verifiedWebhookAt = nowIso;
  } else if (source === 'admin') {
    payment.confirmedBy = actorName;
  }
  if (typeof providerFeeFcfa === 'number' && Number.isFinite(providerFeeFcfa) && providerFeeFcfa >= 0) {
    payment.providerFeeFcfa = Math.round(providerFeeFcfa);
    order.providerFeeFcfa = Math.round(providerFeeFcfa);
  }
  payment.updatedAt = nowIso;

  order.paymentStatus = 'paid';
  order.status = 'passed';
  order.commissionStatus = 'collected';
  delete order.reservationExpiresAt;

  // Increment completed sales on confirmed payment
  for (const item of order.items) {
    const product = commerceDb.products.find((candidate) => candidate.id === item.productId);
    if (product) product.salesCount = (product.salesCount || 0) + item.quantity;
  }

  // Credit seller wallet net of 150 FCFA DJASSA commission exactly once
  if (!order.settled) {
    const { sellerFee, sellerNet } = computeOrderCommissions(order);
    order.commissionFcfa = sellerFee;
    order.sellerNetFcfa = sellerNet;
    order.settled = true;

    recordVerifiedFinancialOperationInSecurityLedger({
      reference: `SETTLE-SELLER-${order.orderNumber}`,
      accountId: order.sellerId,
      accountName: order.sellerName,
      spaceRole: 'seller',
      type: 'credit',
      amountFcfa: sellerNet,
      commissionFcfa: sellerFee,
      channel: `Paiement en ligne #${order.orderNumber}`,
      actorName,
      note: `Net vendeur ${sellerNet} FCFA après prélèvement commission DJASSA ${sellerFee} FCFA`
    });
    void recordPgWalletLedgerEntry({
      accountId: order.sellerId,
      transactionKey: `SETTLE-SELLER-${order.orderNumber}`,
      entryType: 'credit',
      amountFcfa: sellerNet,
      referenceType: 'order',
      referenceId: `order:${order.id}`,
      description: `Revenu vendeur net #${order.orderNumber}`
    });
    void recordPgCommissionEntry({
      orderId: order.id,
      beneficiaryId: order.sellerId,
      beneficiaryRole: 'platform',
      commissionType: 'fixed_fcfa',
      basisAmountFcfa: order.subtotal - order.discount,
      commissionAmountFcfa: sellerFee,
      status: 'accrued',
      ledgerTransactionKey: `COMM-DJASSA-${order.orderNumber}`
    });
  }

  order.trackingEvents.push({
    status: 'payment_confirmed',
    label: `Paiement en ligne confirmé (${payment.provider.toUpperCase()})`,
    time: nowIso,
    done: true,
    description: `Réf : ${providerReference} • Commission DJASSA ${order.commissionFcfa} FCFA encaissée`
  });

  await attemptDirectSellerPayout(order);
  order.updatedAt = new Date().toISOString();

  void recordPgOrderStatusTransition({
    orderId: order.id,
    fromStatus: prevOrderStatus,
    toStatus: 'passed',
    paymentStatus: 'paid',
    commissionStatus: order.commissionStatus,
    sellerPayoutStatus: order.sellerPayoutStatus,
    sellerPayoutReference: order.sellerPayoutReference || null,
    sellerPayoutChannel: order.sellerPayoutChannel || null,
    sellerPayoutPhone: order.sellerPayoutPhone || null,
    providerFeeFcfa: order.providerFeeFcfa ?? null,
    note: `Paiement confirmé (${source})`
  });
}

export function reverseOrderSettlementAndCommissions(order: ServerOrder, actorName: string, reason: string) {
  order.commissionStatus = 'cancelled';
  if (!order.settled) return false;
  const { sellerFee, sellerNet } = computeOrderCommissions(order);
  order.settled = false;

  if (sellerNet > 0) {
    recordVerifiedFinancialOperationInSecurityLedger({
      reference: `REV-SELLER-${order.orderNumber}`,
      accountId: order.sellerId,
      accountName: order.sellerName,
      spaceRole: 'seller',
      type: 'debit',
      amountFcfa: sellerNet,
      channel: `Extourne #${order.orderNumber}`,
      actorName,
      note: `Annulation / remboursement : ${reason}`
    });
    void recordPgWalletLedgerEntry({
      accountId: order.sellerId,
      transactionKey: `REV-SELLER-${order.orderNumber}`,
      entryType: 'refund',
      amountFcfa: sellerNet,
      referenceType: 'order',
      referenceId: `order:${order.id}`,
      description: `Extourne vendeur #${order.orderNumber}`
    });
  }

  void recordPgCommissionEntry({
    orderId: order.id,
    beneficiaryId: order.sellerId,
    beneficiaryRole: 'platform',
    commissionType: commerceDb.platformConfig.commissionModel,
    basisAmountFcfa: order.subtotal - order.discount,
    commissionAmountFcfa: sellerFee,
    status: 'reversed',
    ledgerTransactionKey: `COMM-DJASSA-${order.orderNumber}`
  });
  return true;
}

function getScopedOrders(authCtx: AuthenticatedRequestContext): ServerOrder[] {
  const role = authCtx.token.spaceRole;
  const uid = authCtx.token.uid;
  const tenantId = authCtx.token.tenantId;
  if (role === 'admin') return commerceDb.orders;
  if (role === 'client') return commerceDb.orders.filter((o) => o.clientId === uid);
  if (role === 'seller') return commerceDb.orders.filter((o) => o.sellerId === tenantId || o.sellerId === uid);
  return [];
}

function formatScopedOrderDto(order: ServerOrder, role: string): ServerOrder {
  const dto = { ...order };
  delete dto.otpCode;
  if (role === 'client' || role === 'seller') {
    dto.visibleStatus = VISIBLE_ORDER_STATUS;
  }
  return dto;
}

function buildCommissionsSummary(scopedOrders: ServerOrder[]) {
  let totalGeneratedFcfa = 0;
  let collectedFcfa = 0;
  let pendingFcfa = 0;
  let paidFcfa = 0;
  let cancelledFcfa = 0;
  let collectedCount = 0;
  let pendingCount = 0;
  let paidCount = 0;
  let cancelledCount = 0;

  const bySellerMap = new Map<
    string,
    {
      sellerId: string;
      sellerName: string;
      totalOrders: number;
      onlineOrders: number;
      codOrders: number;
      collectedFcfa: number;
      pendingFcfa: number;
      paidFcfa: number;
      cancelledFcfa: number;
    }
  >();

  for (const ord of scopedOrders) {
    const fee = Math.max(0, ord.commissionFcfa ?? DJASSA_FIXED_COMMISSION_FCFA);
    const st: OrderCommissionStatus = ord.commissionStatus || 'pending';
    const cur = bySellerMap.get(ord.sellerId) || {
      sellerId: ord.sellerId,
      sellerName: ord.sellerName,
      totalOrders: 0,
      onlineOrders: 0,
      codOrders: 0,
      collectedFcfa: 0,
      pendingFcfa: 0,
      paidFcfa: 0,
      cancelledFcfa: 0
    };
    cur.totalOrders += 1;
    if (ord.paymentMode === 'cod') cur.codOrders += 1;
    else cur.onlineOrders += 1;

    if (st === 'cancelled' || ord.status === 'cancelled') {
      cancelledFcfa += fee;
      cancelledCount += 1;
      cur.cancelledFcfa += fee;
    } else {
      totalGeneratedFcfa += fee;
      if (st === 'collected') {
        collectedFcfa += fee;
        collectedCount += 1;
        cur.collectedFcfa += fee;
      } else if (st === 'paid') {
        paidFcfa += fee;
        paidCount += 1;
        cur.paidFcfa += fee;
      } else {
        pendingFcfa += fee;
        pendingCount += 1;
        cur.pendingFcfa += fee;
      }
    }
    bySellerMap.set(ord.sellerId, cur);
  }

  return {
    totalGeneratedFcfa,
    collectedFcfa,
    pendingFcfa,
    paidFcfa,
    cancelledFcfa,
    counts: {
      total: scopedOrders.length,
      collected: collectedCount,
      pending: pendingCount,
      paid: paidCount,
      cancelled: cancelledCount
    },
    bySeller: Array.from(bySellerMap.values())
  };
}

async function syncPlatformConfigToPostgres(config: ServerPlatformConfig, actorEmail: string): Promise<void> {
  try {
    const health = await databaseHealth();
    if (!health.connected) return;
    await query(
      `INSERT INTO djassa_platform_config (config_key, payload, updated_by, updated_at)
       VALUES ('global', $1::jsonb, $2, now())
       ON CONFLICT (config_key) DO UPDATE SET payload = EXCLUDED.payload, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [JSON.stringify(config), actorEmail]
    );
  } catch (err) {
    console.warn('[CommerceModule] Postgres config sync warning:', (err as Error).message);
  }
}

// Breakdown sync removed alongside external delivery companies

async function syncWithdrawalToPostgres(w: ServerWithdrawalRecord): Promise<void> {
  try {
    const health = await databaseHealth();
    if (!health.connected) return;
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO djassa_withdrawals
         (account_id, account_role, amount_fcfa, fee_fcfa, net_amount_fcfa, channel, payout_target_masked, reference, status, suspicion_reasons)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
         ON CONFLICT (reference) DO NOTHING`,
        [
          w.accountId,
          w.role,
          w.amountFcfa,
          w.feeFcfa,
          w.netAmountFcfa,
          w.channel,
          w.payoutTargetMasked,
          w.reference,
          w.status === 'held_security' ? 'held_security' : w.status,
          w.suspicionReasons ? JSON.stringify(w.suspicionReasons) : null
        ]
      );
    });
  } catch (err) {
    console.warn('[CommerceModule] Postgres withdrawal sync warning:', (err as Error).message);
  }
}

/** Release expired unpaid stock reservations. This remains a single-process JSON adapter;
 * the production implementation must use a PostgreSQL worker and row locks.
 */
function releaseExpiredOrderReservations(): number {
  const now = Date.now();
  let released = 0;
  for (const order of commerceDb.orders) {
    if (order.status !== 'pending_payment' || order.paymentStatus !== 'pending' || order.stockRestored) continue;
    if (!order.reservationExpiresAt || Date.parse(order.reservationExpiresAt) > now) continue;
    const payment = commerceDb.payments.find((candidate) => candidate.id === order.paymentId);
    if (payment && !['pending', 'processing'].includes(payment.status)) continue;
    if (payment) {
      payment.status = 'cancelled';
      payment.updatedAt = new Date(now).toISOString();
    }
    order.paymentStatus = 'failed';
    order.status = 'cancelled';
    order.updatedAt = new Date(now).toISOString();
    order.trackingEvents.push({
      status: 'reservation_expired',
      label: 'Réservation expirée — stock libéré',
      time: order.updatedAt,
      done: true,
      description: 'Le paiement n’a pas été confirmé dans le délai de réservation de 15 minutes.'
    });
    if (restoreOrderStock(order)) released += 1;
  }
  if (released > 0) persistCommerceDb();
  return released;
}

let commerceWorkerStarted = false;
function startCommerceMaintenanceWorker() {
  if (commerceWorkerStarted) return;
  commerceWorkerStarted = true;
  const timer = setInterval(() => {
    releaseExpiredOrderReservations();
    void expirePgStaleReservations();
  }, 60_000);
  if (typeof timer.unref === 'function') timer.unref();
}

export function installCommerceRoutes(app: Express) {
  startCommerceMaintenanceWorker();
  // Run expiration before every commerce endpoint so abandoned checkouts do not
  // keep inventory reserved indefinitely.
  app.use('/api/commerce', (_req: Request, _res: Response, next) => {
    releaseExpiredOrderReservations();
    next();
  });

  registerTwoPersonApprovalExecutor('withdrawal', async (approval, decision, actor) => {
    const withdrawal = commerceDb.withdrawals.find((w) => w.id === approval.resourceId);
    if (!withdrawal) {
      throw new Error('WITHDRAWAL_NOT_FOUND');
    }
    if (withdrawal.status !== 'held_security') {
      throw new Error(`WITHDRAWAL_NOT_HELD:${withdrawal.status}`);
    }
    const nowIso = new Date().toISOString();
    withdrawal.decidedAt = nowIso;
    withdrawal.decidedBy = actor.email;
    withdrawal.decisionReason = actor.reason || '';

    // Always append immutable release of hold entry in ledger
    securityDb.financeLedger.unshift({
      id: `led-rel-${crypto.randomUUID().slice(0, 10)}`,
      accountId: withdrawal.accountId,
      accountEmail: withdrawal.accountEmail,
      accountName: withdrawal.accountName,
      spaceRole: withdrawal.role,
      type: 'release',
      amountFcfa: withdrawal.amountFcfa,
      commissionFcfa: 0,
      channel: withdrawal.channel,
      payoutTarget: withdrawal.payoutTargetMasked,
      reference: `REL-${withdrawal.reference}`,
      status: 'valide',
      createdAt: nowIso
    });

    void recordPgWalletLedgerEntry({
      accountId: withdrawal.accountId,
      transactionKey: `REL-${withdrawal.reference}`,
      entryType: 'release',
      amountFcfa: withdrawal.amountFcfa,
      status: 'posted',
      referenceType: 'withdrawal',
      referenceId: `withdrawal:${withdrawal.id}`,
      description: `Déblocage retenue sécurité ${withdrawal.reference}`,
      idempotencyKey: `rel-${withdrawal.id}`
    });

    if (decision === 'approved') {
      securityDb.financeLedger.unshift({
        id: `led-deb-${crypto.randomUUID().slice(0, 10)}`,
        accountId: withdrawal.accountId,
        accountEmail: withdrawal.accountEmail,
        accountName: withdrawal.accountName,
        spaceRole: withdrawal.role,
        type: 'debit',
        amountFcfa: withdrawal.amountFcfa,
        commissionFcfa: withdrawal.feeFcfa,
        channel: withdrawal.channel,
        payoutTarget: withdrawal.payoutTargetMasked,
        reference: `EXEC-${withdrawal.reference}`,
        status: 'valide',
        createdAt: nowIso
      });
      void recordPgWalletLedgerEntry({
        accountId: withdrawal.accountId,
        transactionKey: `EXEC-${withdrawal.reference}`,
        entryType: 'debit',
        amountFcfa: withdrawal.amountFcfa,
        status: 'posted',
        referenceType: 'withdrawal',
        referenceId: `withdrawal:${withdrawal.id}`,
        description: `Exécution retrait validé ${withdrawal.reference}`,
        idempotencyKey: `exec-${withdrawal.id}`
      });
      withdrawal.status = 'completed';

      if (getGeniusPayConfig().configured && withdrawal.payoutTargetRaw) {
        const chLower = withdrawal.channel.toLowerCase();
        const mappedProv = chLower.includes('wave')
          ? 'wave'
          : chLower.includes('orange')
          ? 'orange_money'
          : chLower.includes('mtn') || chLower.includes('momo')
          ? 'mtn_momo'
          : null;
        if (mappedProv) {
          const payoutRes = await initiateGeniusPayPayout({
            payoutId: withdrawal.id,
            amountFcfa: withdrawal.netAmountFcfa,
            provider: mappedProv,
            recipientPhone: withdrawal.payoutTargetRaw,
            statementDescription: `RETRAIT ${withdrawal.reference}`
          });
          withdrawal.geniusPayPayoutStatus = payoutRes.status;
          if (!payoutRes.ok && payoutRes.status === 'failed') {
            withdrawal.status = 'failed';
            securityDb.financeLedger.unshift({
              id: `led-rev-${crypto.randomUUID().slice(0, 10)}`,
              accountId: withdrawal.accountId,
              accountEmail: withdrawal.accountEmail,
              accountName: withdrawal.accountName,
              spaceRole: withdrawal.role,
              type: 'credit',
              amountFcfa: withdrawal.amountFcfa,
              commissionFcfa: 0,
              channel: withdrawal.channel,
              payoutTarget: withdrawal.payoutTargetMasked,
              reference: `FAIL-REFUND-${withdrawal.reference}`,
              status: 'valide',
              suspicionReasons: [`Recrédit automatique : échec GeniusPay (${payoutRes.error || 'failed'})`],
              createdAt: new Date().toISOString()
            });
            void recordPgWalletLedgerEntry({
              accountId: withdrawal.accountId,
              transactionKey: `FAIL-REFUND-${withdrawal.reference}`,
              entryType: 'credit',
              amountFcfa: withdrawal.amountFcfa,
              status: 'posted',
              referenceType: 'withdrawal',
              referenceId: `withdrawal:${withdrawal.id}`,
              description: `Recrédit échec GeniusPay ${withdrawal.reference}`,
              idempotencyKey: `fail-refund-${withdrawal.id}`
            });
          }
        }
      }
      delete withdrawal.payoutTargetRaw;
    } else {
      withdrawal.status = 'rejected';
      delete withdrawal.payoutTargetRaw;
    }

    persistSecurityDb();
    persistCommerceDb();
    void syncWithdrawalToPostgres(withdrawal);

    appendAuditEntry({
      actorId: actor.uid,
      actorName: actor.email,
      actorAccountLabel: actor.email,
      actorRole: 'admin',
      space: 'admin',
      category: 'wallets',
      actionType: decision === 'approved' ? 'withdrawal_two_person_approved' : 'withdrawal_two_person_rejected',
      action: decision === 'approved'
        ? `Retrait ${withdrawal.reference} débloqué par double validation`
        : `Retrait ${withdrawal.reference} rejeté et fonds libérés`,
      target: withdrawal.reference,
      targetType: 'finance',
      entityType: 'withdrawal',
      entityId: withdrawal.id,
      result: 'reussi',
      severity: 'eleve',
      details: `${withdrawal.amountFcfa} FCFA • statut final : ${withdrawal.status}`
    });

    return { withdrawalId: withdrawal.id, status: withdrawal.status };
  });

  // --------------------------------------------------------------------------
  // 1. BOOTSTRAP & CONFIGURATION (Scoping par rôle : client | seller | admin)
  // --------------------------------------------------------------------------
  app.get('/api/commerce/bootstrap', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const uid = authCtx.token.uid;
    const role = authCtx.token.spaceRole;
    const tenantId = authCtx.token.tenantId;
    const rawScopedOrders = getScopedOrders(authCtx);
    const scopedOrders = rawScopedOrders.map((o) => formatScopedOrderDto(o, role));

    const walletAccountId = role === 'seller' ? tenantId : uid;
    const serverBalanceFcfa = computeServerLedgerBalance(walletAccountId);
    const withdrawals =
      role === 'admin'
        ? commerceDb.withdrawals
        : commerceDb.withdrawals.filter((w) => w.accountId === walletAccountId);

    const notifications = commerceDb.notifications.filter(
      (n) => role === 'admin' || n.userId === uid || n.userId === tenantId || n.targetRoles?.includes(role)
    );

    const conversations = commerceDb.conversations.filter(
      (c) => role === 'admin' || c.participantIds.includes(uid) || c.participantIds.includes(tenantId)
    );

    const sellerPayoutSettings =
      role === 'seller' ? commerceDb.sellerPayoutAccounts[tenantId] || null : undefined;
    const commissionsSummary =
      role === 'admin' || role === 'seller' ? buildCommissionsSummary(rawScopedOrders) : undefined;

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      platformConfig: commerceDb.platformConfig,
      products: commerceDb.products.filter((p) => p.status !== 'archived' || role === 'admin' || p.sellerId === tenantId),
      orders: scopedOrders,
      wallet: {
        accountId: walletAccountId,
        balanceFcfa: serverBalanceFcfa
      },
      withdrawals,
      ...(sellerPayoutSettings !== undefined ? { sellerPayoutSettings } : {}),
      ...(commissionsSummary !== undefined ? { commissionsSummary } : {}),
      notifications: notifications.slice(0, 60),
      conversations
    });
  });

  app.get('/api/commerce/config', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
    res.json({ success: true, platformConfig: commerceDb.platformConfig });
  });

  app.get('/api/commerce/public-catalog', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'public, max-age=10, stale-while-revalidate=20');
    const publicProducts = commerceDb.products.filter((p) => p.status !== 'archived');
    res.json({
      success: true,
      platformConfig: commerceDb.platformConfig,
      products: publicProducts
    });
  });

  app.patch('/api/commerce/config', requireSecurityPermission('modifySettings'), (req: Request, res: Response) => {
    const caller = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
    const patch = req.body || {};
    const nextConfig: ServerPlatformConfig = {
      ...commerceDb.platformConfig,
      ...(typeof patch.marketplaceCommissionRate === 'number' && patch.marketplaceCommissionRate >= 0
        ? { marketplaceCommissionRate: patch.marketplaceCommissionRate }
        : {}),
      ...(typeof patch.sellerCommissionRate === 'number' && patch.sellerCommissionRate >= 0
        ? { sellerCommissionRate: patch.sellerCommissionRate }
        : {}),
      ...(patch.commissionModel === 'fixed_fcfa' || patch.commissionModel === 'percentage'
        ? { commissionModel: patch.commissionModel }
        : {}),
      ...(typeof patch.withdrawalFeeRate === 'number' && patch.withdrawalFeeRate >= 0 && patch.withdrawalFeeRate <= 50
        ? { withdrawalFeeRate: patch.withdrawalFeeRate }
        : {}),
      ...(typeof patch.minOrderAmount === 'number' && patch.minOrderAmount >= 0
        ? { minOrderAmount: patch.minOrderAmount }
        : {}),
      ...(typeof patch.requireKycForSellers === 'boolean' ? { requireKycForSellers: patch.requireKycForSellers } : {}),
      ...(typeof patch.allowCashOnDelivery === 'boolean' ? { allowCashOnDelivery: patch.allowCashOnDelivery } : {}),
      ...(typeof patch.autoValidateSellers === 'boolean' ? { autoValidateSellers: patch.autoValidateSellers } : {}),
      ...(typeof patch.maintenanceMode === 'boolean' ? { maintenanceMode: patch.maintenanceMode } : {}),
      updatedAt: new Date().toISOString()
    };

    commerceDb.platformConfig = nextConfig;
    persistCommerceDb();
    void syncPlatformConfigToPostgres(nextConfig, caller?.token.email || 'admin@djassa.ci');

    appendAuditEntry({
      actorId: caller?.token.uid || 'admin',
      actorName: caller?.token.name || 'Administrateur',
      actorAccountLabel: caller?.token.email || 'admin@djassa.ci',
      actorRole: 'admin',
      space: 'admin',
      category: 'system_config',
      actionType: 'platform_config_updated',
      action: 'Mise à jour configuration tarifs & règles plateforme',
      target: 'platformConfig',
      targetType: 'settings',
      result: 'reussi',
      severity: 'moyen',
      beforeValue: null,
      afterValue: `Commission fixe: ${nextConfig.sellerCommissionRate} FCFA, Retrait ${nextConfig.withdrawalFeeRate}%`,
      details: 'Configuration centralisée synchronisée (Client, Vendeur, Admin)',
      ipAddress: getClientIp(req)
    });

    res.json({ success: true, platformConfig: nextConfig });
  });

  // --------------------------------------------------------------------------
  // 2. PRODUCTS CRUD (Propriété vendeur vérifiée, validation prix & stock)
  // --------------------------------------------------------------------------
  app.get('/api/commerce/products', (req: Request, res: Response) => {
    let list = commerceDb.products.filter((p) => p.status === 'published');

    const categoryParam = typeof req.query.category === 'string' ? req.query.category.trim().toLowerCase() : '';
    if (categoryParam) {
      list = list.filter((p) => (p.category || '').toLowerCase() === categoryParam);
    }

    const qParam = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    if (qParam) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(qParam) ||
          (p.description || '').toLowerCase().includes(qParam) ||
          (p.category || '').toLowerCase().includes(qParam)
      );
    }

    const total = list.length;
    const hasPagination = req.query.limit !== undefined || req.query.offset !== undefined;
    res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');

    if (hasPagination) {
      const parsedLimit = Number(req.query.limit ?? 20);
      const parsedOffset = Number(req.query.offset ?? 0);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(1, Math.floor(parsedLimit)), 100) : 20;
      const offset = Number.isFinite(parsedOffset) ? Math.max(0, Math.floor(parsedOffset)) : 0;
      const page = list.slice(offset, offset + limit);
      return res.json({
        success: true,
        products: page,
        total,
        limit,
        offset,
        hasMore: offset + page.length < total
      });
    }

    return res.json({
      success: true,
      products: list,
      total
    });
  });

  app.get('/api/commerce/seller/storage', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    if (authCtx.token.spaceRole !== 'seller' && authCtx.token.spaceRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'SELLER_ROLE_REQUIRED' });
    }
    const sellerId = authCtx.token.spaceRole === 'admin' && req.query.sellerId ? String(req.query.sellerId) : authCtx.token.tenantId;
    return res.json({ success: true, storage: computeSellerStorageStats(sellerId) });
  });

  app.post('/api/commerce/products', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    if (authCtx.token.spaceRole !== 'seller' && authCtx.token.spaceRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'SELLER_ROLE_REQUIRED',
        message: 'Seul un vendeur vérifié ou un administrateur peut publier un produit.'
      });
    }

    const { name, description = '', price, originalPrice, stock = 1, category = 'Mode', images = [], sellerId, parcelClass, mediaBytes } = req.body || {};
    const nameClean = String(name || '').trim();
    const numericPrice = Number(price);
    const numericStock = Math.floor(Number(stock));
    if (nameClean.length < 2) {
      return res.status(400).json({ success: false, error: 'INVALID_NAME', message: 'Nom du produit invalide.' });
    }
    if (!Number.isFinite(numericPrice) || numericPrice < 100) {
      return res.status(400).json({ success: false, error: 'INVALID_PRICE', message: 'Prix minimum : 100 FCFA.' });
    }
    if (!Number.isFinite(numericStock) || numericStock < 0) {
      return res.status(400).json({ success: false, error: 'INVALID_STOCK', message: 'Le stock ne peut pas être négatif.' });
    }

    const ownerSellerId = authCtx.token.spaceRole === 'admin' && sellerId ? String(sellerId) : authCtx.token.tenantId;
    const storageStats = computeSellerStorageStats(ownerSellerId);
    const nextImages = Array.isArray(images) && images.length > 0 ? images.map(String) : [];
    const incomingMediaBytes = estimateProductMediaBytes({ images: nextImages, mediaBytes: mediaBytes !== undefined ? Number(mediaBytes) : undefined });

    if (storageStats.productCount >= storageStats.maxProducts) {
      return res.status(403).json({
        success: false,
        error: 'SELLER_PRODUCT_LIMIT_EXCEEDED',
        message: `Quota maximum de ${storageStats.maxProducts} produits atteint pour cette boutique.`
      });
    }
    if (storageStats.usedBytes + incomingMediaBytes > storageStats.quotaBytes) {
      return res.status(413).json({
        success: false,
        error: 'SELLER_STORAGE_QUOTA_EXCEEDED',
        message: 'Quota de stockage médias vendeur (5 Go) dépassé.',
        storage: storageStats
      });
    }

    const nowIso = new Date().toISOString();
    const product: ServerProduct = {
      id: `prod-${crypto.randomUUID().slice(0, 10)}`,
      sellerId: ownerSellerId,
      sellerName: authCtx.token.name,
      name: nameClean,
      description: String(description || ''),
      price: Math.round(numericPrice),
      ...(Number.isFinite(Number(originalPrice)) && Number(originalPrice) > numericPrice
        ? { originalPrice: Math.round(Number(originalPrice)) }
        : {}),
      stock: numericStock,
      inStock: numericStock > 0,
      category: String(category || 'Mode'),
      images: nextImages,
      parcelClass: inferProductParcelClass({ parcelClass, category: String(category || 'Mode'), name: nameClean }),
      mediaBytes: incomingMediaBytes,
      salesCount: 0,
      status: 'published',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    commerceDb.products.unshift(product);
    persistCommerceDb();
    void upsertPgStoreAndProduct(product);

    return res.status(201).json({ success: true, product, storage: computeSellerStorageStats(ownerSellerId) });
  });

  app.patch('/api/commerce/products/:id', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const product = commerceDb.products.find((p) => p.id === req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'PRODUCT_NOT_FOUND' });
    }
    const isOwner = authCtx.token.spaceRole === 'seller' && product.sellerId === authCtx.token.tenantId;
    if (!isOwner && authCtx.token.spaceRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN_PRODUCT_EDIT',
        message: 'Vous ne pouvez modifier que les produits de votre propre boutique.'
      });
    }

    const patch = req.body || {};
    if (patch.price !== undefined) {
      const p = Number(patch.price);
      if (!Number.isFinite(p) || p < 100) {
        return res.status(400).json({ success: false, error: 'INVALID_PRICE', message: 'Prix minimum : 100 FCFA.' });
      }
      product.price = Math.round(p);
    }
    if (patch.stock !== undefined) {
      const st = Math.floor(Number(patch.stock));
      if (!Number.isFinite(st) || st < 0) {
        return res.status(400).json({ success: false, error: 'INVALID_STOCK', message: 'Le stock ne peut pas être négatif.' });
      }
      product.stock = st;
      product.inStock = st > 0;
    }
    if (typeof patch.name === 'string' && patch.name.trim().length >= 2) {
      product.name = patch.name.trim();
    }
    if (typeof patch.description === 'string') {
      product.description = patch.description;
    }
    if (Array.isArray(patch.images) || patch.mediaBytes !== undefined) {
      const nextImages = Array.isArray(patch.images) ? patch.images.map(String) : product.images;
      const nextBytes = estimateProductMediaBytes({
        images: nextImages,
        mediaBytes: patch.mediaBytes !== undefined ? Number(patch.mediaBytes) : undefined
      });
      const currentStats = computeSellerStorageStats(product.sellerId);
      const existingBytes = estimateProductMediaBytes(product);
      if (currentStats.usedBytes - existingBytes + nextBytes > currentStats.quotaBytes) {
        return res.status(413).json({
          success: false,
          error: 'SELLER_STORAGE_QUOTA_EXCEEDED',
          message: 'Quota de stockage médias vendeur (5 Go) dépassé.',
          storage: currentStats
        });
      }
      product.images = nextImages;
      product.mediaBytes = nextBytes;
    }
    if (patch.status && ['published', 'paused', 'archived'].includes(patch.status)) {
      product.status = patch.status;
    }
    product.updatedAt = new Date().toISOString();
    persistCommerceDb();
    void upsertPgStoreAndProduct(product);
    return res.json({ success: true, product, storage: computeSellerStorageStats(product.sellerId) });
  });

  app.delete('/api/commerce/products/:id', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const idx = commerceDb.products.findIndex((p) => p.id === req.params.id);
    if (idx < 0) return res.status(404).json({ success: false, error: 'PRODUCT_NOT_FOUND' });
    const product = commerceDb.products[idx];
    const isOwner = authCtx.token.spaceRole === 'seller' && product.sellerId === authCtx.token.tenantId;
    if (!isOwner && authCtx.token.spaceRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'FORBIDDEN_PRODUCT_DELETE' });
    }
    commerceDb.products.splice(idx, 1);
    persistCommerceDb();
    void archivePgProduct(product.id);
    return res.json({ success: true, deletedId: product.id });
  });

  // --------------------------------------------------------------------------
  // 2b. PROMO CODE VALIDATION (Strictement calculé côté serveur)
  // --------------------------------------------------------------------------
  app.post('/api/commerce/promo/validate', (req: Request, res: Response) => {
    const { code, subtotal = 0 } = req.body || {};
    const numericSubtotal = Math.max(0, Number(subtotal) || 0);
    const result = validatePromoCodeServer(String(code || ''), numericSubtotal);
    if (!result.valid) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: result.error,
        message: result.message
      });
    }
    return res.json({
      success: true,
      valid: true,
      code: result.code,
      discountFcfa: result.discountFcfa,
      label: result.label,
      description: result.description
    });
  });

  // --------------------------------------------------------------------------
  // 3. COMMANDES ATOMIQUES, STOCK VARIANTE & PAIEMENTS (Zéro prix client / Zéro OTP fixe)
  // --------------------------------------------------------------------------
  app.get('/api/commerce/orders/:id', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const order = getScopedOrders(authCtx).find((o) => o.id === req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'ORDER_NOT_FOUND' });
    }
    const payment = commerceDb.payments.find((p) => p.id === order.paymentId) || null;
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      order: formatScopedOrderDto(order, authCtx.token.spaceRole),
      payment
    });
  });

  app.post('/api/commerce/orders/:id/retry-payment', async (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const order = commerceDb.orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'ORDER_NOT_FOUND' });
    if (order.clientId !== authCtx.token.uid && authCtx.token.spaceRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'FORBIDDEN_ORDER_ACCESS' });
    }
    if (order.paymentMode === 'cod') {
      return res.status(409).json({
        success: false,
        error: 'COD_ORDER_NO_ONLINE_RETRY',
        message: 'Cette commande est en Paiement à la livraison (aucun paiement en ligne requis).'
      });
    }
    if (order.paymentStatus === 'paid') {
      return res.json({ success: true, alreadyPaid: true, order: formatScopedOrderDto(order, authCtx.token.spaceRole) });
    }
    if (order.status === 'cancelled' || order.stockRestored) {
      return res.status(409).json({
        success: false,
        error: 'CANCELLED_ORDER_CANNOT_RETRY_PAYMENT',
        message: 'Cette commande a été annulée et son stock libéré. Créez une nouvelle commande.'
      });
    }

    const nextMethod = String(req.body?.paymentMethod || order.paymentMethod);
    if (!['wave', 'orange_money'].includes(nextMethod)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ONLINE_PAYMENT_METHOD',
        message: 'Seuls Wave et Orange Money sont acceptés pour le paiement en ligne.'
      });
    }

    const nowIso = new Date().toISOString();
    const typedMethod = nextMethod as OnlineOrderPaymentMethod;
    const gatewayReady = isGatewayConfigured(typedMethod);

    order.paymentMethod = typedMethod;
    order.paymentStatus = 'pending';
    order.status = 'pending_payment';
    order.updatedAt = nowIso;

    const payment = commerceDb.payments.find((p) => p.id === order.paymentId);
    if (payment) {
      payment.provider = typedMethod;
      payment.providerConfigured = gatewayReady;
      payment.status = 'pending';
      payment.updatedAt = nowIso;
    }

    let checkoutUrl: string | undefined;
    if (gatewayReady && payment) {
      const initRes = await initiateGeniusPayDeposit({
        depositId: payment.id,
        amountFcfa: order.total,
        provider: typedMethod,
        payerPhone: req.body?.payerPhone ? String(req.body.payerPhone) : order.deliveryAddress.phone,
        statementDescription: `DJASSA ${order.orderNumber}`,
        metadata: { orderId: order.id, orderNumber: order.orderNumber }
      });
      if (initRes.ok) {
        payment.status = 'processing';
        payment.providerReference = initRes.depositId || payment.id;
        checkoutUrl = initRes.checkoutUrl;
        if (checkoutUrl) payment.checkoutUrl = checkoutUrl;
        payment.updatedAt = new Date().toISOString();
      }
    }

    order.trackingEvents.push({
      status: 'pending_payment',
      label: `Nouvelle tentative de paiement (${typedMethod === 'wave' ? 'Wave' : 'Orange Money'})`,
      time: nowIso,
      done: true,
      description: gatewayReady
        ? `Paiement ${typedMethod.toUpperCase()} réinitialisé (${order.total.toLocaleString('fr-FR')} FCFA).`
        : `En attente de confirmation ${typedMethod.toUpperCase()} (passerelle non configurée).`
    });

    persistCommerceDb();
    return res.json({
      success: true,
      order: formatScopedOrderDto(order, authCtx.token.spaceRole),
      payment: payment || null,
      providerConfigured: gatewayReady,
      ...(checkoutUrl ? { paymentUrl: checkoutUrl, checkoutUrl } : {})
    });
  });

  app.post('/api/commerce/orders', async (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    if (authCtx.token.spaceRole !== 'client' && authCtx.token.spaceRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'CLIENT_ROLE_REQUIRED',
        message: 'Seul un client authentifié peut passer une commande.'
      });
    }

    const {
      items = [],
      paymentMode,
      paymentMethod,
      deliveryAddress,
      promoCode,
      idempotencyKey
    } = req.body || {};

    const idemKey = idempotencyKey ? String(idempotencyKey) : '';
    if (idemKey && commerceDb.processedIdempotencyKeys[`order:${authCtx.token.uid}:${idemKey}`]) {
      const existingId = commerceDb.processedIdempotencyKeys[`order:${authCtx.token.uid}:${idemKey}`].entityId;
      const existingOrder = commerceDb.orders.find((o) => o.id === existingId);
      if (existingOrder) {
        const existingPay = commerceDb.payments.find((p) => p.id === existingOrder.paymentId);
        return res.json({
          success: true,
          isDuplicate: true,
          order: formatScopedOrderDto(existingOrder, authCtx.token.spaceRole),
          payment: existingPay,
          ...(existingPay?.checkoutUrl ? { paymentUrl: existingPay.checkoutUrl, checkoutUrl: existingPay.checkoutUrl } : {})
        });
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'EMPTY_CART', message: 'Votre panier est vide.' });
    }

    if (paymentMode !== 'online' && paymentMode !== 'cod') {
      return res.status(400).json({
        success: false,
        error: 'PAYMENT_MODE_REQUIRED',
        message: 'Veuillez choisir un mode de paiement : Paiement en ligne ou Paiement à la livraison.'
      });
    }

    const resolvedPaymentMode: OrderPaymentMode = paymentMode;
    let resolvedPaymentMethod: OrderPaymentMethod;
    if (resolvedPaymentMode === 'online') {
      if (paymentMethod !== 'wave' && paymentMethod !== 'orange_money') {
        return res.status(400).json({
          success: false,
          error: 'INVALID_ONLINE_PAYMENT_METHOD',
          message: 'Pour le paiement en ligne, choisissez exclusivement Wave ou Orange Money.'
        });
      }
      resolvedPaymentMethod = paymentMethod;
    } else {
      resolvedPaymentMethod = 'cash_on_delivery';
    }

    if (!deliveryAddress?.commune || !deliveryAddress?.quartier || !deliveryAddress?.recipientName || !deliveryAddress?.phone) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ADDRESS',
        message: 'Adresse de livraison et numéro destinataire requis.'
      });
    }

    // Aggregate quantities per product and verify catalog prices & atomic stock (including variantStock)
    const qtyByProduct = new Map<string, number>();
    const resolvedItems: ServerOrder['items'] = [];
    const sellerIds = new Set<string>();
    const variantChecks: Array<{ product: ServerProduct; keysToDecrement: string[]; qty: number }> = [];

    for (const rawItem of items) {
      const pid = String(rawItem?.productId || '');
      const qty = Math.floor(Number(rawItem?.quantity || 0));
      if (!pid || !Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ success: false, error: 'INVALID_ITEM_QUANTITY' });
      }
      const product = commerceDb.products.find((p) => p.id === pid && p.status === 'published');
      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'PRODUCT_UNAVAILABLE',
          message: `Produit ${pid} indisponible ou introuvable.`
        });
      }
      if (!product.inStock || product.stock <= 0) {
        return res.status(409).json({
          success: false,
          error: 'OUT_OF_STOCK',
          message: `Le produit "${product.name}" est en rupture de stock.`
        });
      }
      sellerIds.add(product.sellerId);
      qtyByProduct.set(product.id, (qtyByProduct.get(product.id) || 0) + qty);

      const variantObj: Record<string, string> =
        rawItem?.variant && typeof rawItem.variant === 'object' ? rawItem.variant : {};

      // Check variant-specific stock if defined
      const matchedKeys: string[] = [];
      if (product.variantStock) {
        const colorVal = variantObj['Couleur'] || variantObj['Color'] || '';
        const sizeVal = variantObj['Taille'] || variantObj['Pointure'] || variantObj['Size'] || '';
        const comboKeys = [
          colorVal && sizeVal ? `${colorVal}-${sizeVal}` : '',
          colorVal && sizeVal ? `${colorVal} - ${sizeVal}` : ''
        ].filter(Boolean);

        let checkedCombo = false;
        for (const ck of comboKeys) {
          if (product.variantStock[ck] !== undefined) {
            checkedCombo = true;
            matchedKeys.push(ck);
            if (product.variantStock[ck] < qty) {
              return res.status(409).json({
                success: false,
                error: 'INSUFFICIENT_VARIANT_STOCK',
                message: `Stock insuffisant pour "${product.name}" (${ck} : ${product.variantStock[ck]} restant(s)).`
              });
            }
          }
        }
        if (!checkedCombo) {
          for (const optVal of Object.values(variantObj)) {
            if (optVal && product.variantStock[optVal] !== undefined) {
              matchedKeys.push(optVal);
              if (product.variantStock[optVal] < qty) {
                return res.status(409).json({
                  success: false,
                  error: 'INSUFFICIENT_VARIANT_STOCK',
                  message: `Stock insuffisant pour "${product.name}" — option "${optVal}" (${product.variantStock[optVal]} restant(s)).`
                });
              }
            }
          }
        }
      }
      variantChecks.push({ product, keysToDecrement: matchedKeys, qty });

      resolvedItems.push({
        productId: product.id,
        productTitle: product.name,
        productImage: product.images[0] || product.videoPoster || '',
        price: product.price, // Strictly server catalog price!
        quantity: qty,
        variant: variantObj,
        variantStockKeys: matchedKeys,
        sellerId: product.sellerId,
        sellerName: product.sellerName
      });
    }

    if (sellerIds.size > 1) {
      return res.status(400).json({
        success: false,
        error: 'MULTI_SELLER_CART_FORBIDDEN',
        message: 'Le panier contient des produits de plusieurs vendeurs. Finalisez chaque boutique séparément.'
      });
    }

    // Check atomic total product stock BEFORE mutating any product stock
    for (const [pid, reqQty] of qtyByProduct.entries()) {
      const product = commerceDb.products.find((p) => p.id === pid)!;
      if (product.stock < reqQty) {
        return res.status(409).json({
          success: false,
          error: 'INSUFFICIENT_STOCK',
          message: `Stock insuffisant pour "${product.name}" (demandé: ${reqQty}, disponible: ${product.stock}).`
        });
      }
    }

    const subtotal = resolvedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (subtotal < commerceDb.platformConfig.minOrderAmount) {
      return res.status(400).json({
        success: false,
        error: 'MIN_ORDER_AMOUNT',
        message: `Montant minimum par commande : ${commerceDb.platformConfig.minOrderAmount} FCFA.`
      });
    }

    let discount = 0;
    let appliedPromoCode: string | undefined;
    if (promoCode && String(promoCode).trim()) {
      const promoCheck = validatePromoCodeServer(String(promoCode), subtotal);
      if (!promoCheck.valid) {
        return res.status(400).json({
          success: false,
          error: promoCheck.error || 'INVALID_PROMO_CODE',
          message: promoCheck.message || 'Code promo invalide ou expiré.'
        });
      }
      discount = promoCheck.discountFcfa;
      appliedPromoCode = promoCheck.code;
    }

    const merchandiseNet = Math.max(0, subtotal - discount);
    const clientFeeFcfa =
      resolvedPaymentMode === 'online' ? Math.round(merchandiseNet * CLIENT_ONLINE_FEE_RATE) : 0;
    const deliveryFee = 0; // Livraison organisée directement par le vendeur hors DJASSA
    const total = merchandiseNet + clientFeeFcfa;
    const commissionFcfa = DJASSA_FIXED_COMMISSION_FCFA;
    const sellerNetFcfa = Math.max(0, merchandiseNet - commissionFcfa);

    const orderParcelClass: 'small' | 'standard' | 'bulky' = resolvedItems.some((item) => {
      const p = commerceDb.products.find((cand) => cand.id === item.productId);
      return p ? inferProductParcelClass(p) === 'bulky' : false;
    })
      ? 'bulky'
      : 'standard';

    // Atomic stock decrement (total + matched variants)
    for (const [pid, reqQty] of qtyByProduct.entries()) {
      const product = commerceDb.products.find((p) => p.id === pid)!;
      product.stock = Math.max(0, product.stock - reqQty);
      product.inStock = product.stock > 0;
      if (resolvedPaymentMode === 'cod') {
        product.salesCount = (product.salesCount || 0) + reqQty;
      }
      product.updatedAt = new Date().toISOString();
    }
    for (const vc of variantChecks) {
      if (vc.product.variantStock) {
        for (const k of vc.keysToDecrement) {
          vc.product.variantStock[k] = Math.max(0, (vc.product.variantStock[k] ?? 0) - vc.qty);
        }
      }
    }

    const nowIso = new Date().toISOString();
    const orderId = `ord-${crypto.randomUUID().slice(0, 12)}`;
    const orderNumber = `ADJ${crypto.randomInt(10000, 99999)}`;
    const paymentId = `pay-${crypto.randomUUID().slice(0, 12)}`;
    const sellerId = resolvedItems[0].sellerId;
    const sellerName = resolvedItems[0].sellerName;

    const gatewayReady = resolvedPaymentMode === 'online' ? isGatewayConfigured(resolvedPaymentMethod) : false;
    const paymentRecord: ServerPaymentRecord = {
      id: paymentId,
      orderId,
      orderNumber,
      clientId: authCtx.token.uid,
      provider: resolvedPaymentMethod,
      providerReference: null,
      providerConfigured: gatewayReady,
      idempotencyKey: idemKey || `pay-idem-${orderId}`,
      amountFcfa: total,
      status: 'pending',
      verifiedWebhookAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    const isCod = resolvedPaymentMode === 'cod';
    const newOrder: ServerOrder = {
      id: orderId,
      orderNumber,
      clientId: authCtx.token.uid,
      clientName: authCtx.token.name,
      sellerId,
      sellerName,
      items: resolvedItems,
      subtotal,
      discount,
      ...(appliedPromoCode ? { promoCode: appliedPromoCode } : {}),
      serviceFee: clientFeeFcfa,
      clientFeeFcfa,
      deliveryFee: 0,
      commissionFcfa,
      commissionStatus: 'pending',
      sellerNetFcfa,
      sellerPayoutStatus: isCod ? 'not_applicable' : 'pending_payment',
      total,
      deliveryMode: 'seller_managed',
      paymentMode: resolvedPaymentMode,
      paymentMethod: resolvedPaymentMethod,
      paymentStatus: isCod ? 'cod_pending' : 'pending',
      paymentId,
      status: isCod ? 'passed' : 'pending_payment',
      deliveryAddress: {
        commune: String(deliveryAddress.commune),
        quartier: String(deliveryAddress.quartier),
        details: String(deliveryAddress.details || ''),
        ...(deliveryAddress.landmark ? { landmark: String(deliveryAddress.landmark) } : {}),
        ...(deliveryAddress.deliveryInstructions ? { deliveryInstructions: String(deliveryAddress.deliveryInstructions) } : {}),
        ...(deliveryAddress.gpsCoords && typeof deliveryAddress.gpsCoords.lat === 'number'
          ? { gpsCoords: { lat: Number(deliveryAddress.gpsCoords.lat), lng: Number(deliveryAddress.gpsCoords.lng) } }
          : {}),
        recipientName: String(deliveryAddress.recipientName),
        phone: String(deliveryAddress.phone),
        ...(deliveryAddress.absencePolicy ? { absencePolicy: deliveryAddress.absencePolicy } : {}),
        ...(deliveryAddress.absenceRecipientName ? { absenceRecipientName: String(deliveryAddress.absenceRecipientName) } : {}),
        ...(deliveryAddress.absenceRecipientPhone ? { absenceRecipientPhone: String(deliveryAddress.absenceRecipientPhone) } : {})
      },
      settled: false,
      stockRestored: false,
      parcelClass: orderParcelClass,
      ...(!isCod ? { reservationExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() } : {}),
      trackingEvents: [
        {
          status: isCod ? 'passed' : 'pending_payment',
          label: isCod
            ? 'Commande confirmée — Paiement à la livraison (0 FCFA de frais client)'
            : 'Commande confirmée — En attente de confirmation paiement en ligne',
          time: nowIso,
          done: true,
          description: isCod
            ? `Le client paiera directement ${total.toLocaleString('fr-FR')} FCFA à la réception • Livraison gérée par la boutique.`
            : gatewayReady
            ? `Paiement ${resolvedPaymentMethod.toUpperCase()} initialisé (${total.toLocaleString('fr-FR')} FCFA dont frais 6,5 % = ${clientFeeFcfa.toLocaleString('fr-FR')} FCFA).`
            : `Paiement en ligne en attente de validation (${total.toLocaleString('fr-FR')} FCFA).`
        }
      ],
      createdAt: nowIso,
      updatedAt: nowIso
    };

    commerceDb.payments.unshift(paymentRecord);
    commerceDb.orders.unshift(newOrder);
    if (idemKey) {
      commerceDb.processedIdempotencyKeys[`order:${authCtx.token.uid}:${idemKey}`] = {
        type: 'order',
        entityId: orderId,
        at: nowIso
      };
    }

    pushNotification({
      userId: sellerId,
      targetRoles: ['seller'],
      type: 'order',
      title: `Nouvelle commande #${orderNumber}`,
      body: `${resolvedItems.length} article(s) — ${total.toLocaleString('fr-FR')} FCFA (${isCod ? 'Paiement à la livraison' : 'Paiement en ligne'}) • Livraison à organiser par votre boutique`,
      referenceId: orderId
    });
    pushNotification({
      userId: authCtx.token.uid,
      type: 'order',
      title: `Commande #${orderNumber} enregistrée`,
      body: isCod
        ? `Commande confirmée (${total.toLocaleString('fr-FR')} FCFA à régler directement au vendeur à la livraison).`
        : `Total ${total.toLocaleString('fr-FR')} FCFA • En attente de validation ${resolvedPaymentMethod === 'wave' ? 'Wave' : 'Orange Money'}.`,
      referenceId: orderId
    });

    let geniusPayInit: Record<string, unknown> | null = null;
    let checkoutUrl: string | undefined;
    if (resolvedPaymentMode === 'online' && gatewayReady && (req.body?.payerPhone || deliveryAddress?.phone)) {
      const initRes = await initiateGeniusPayDeposit({
        depositId: paymentRecord.id,
        amountFcfa: total,
        provider: resolvedPaymentMethod as OnlineOrderPaymentMethod,
        payerPhone: String(req.body?.payerPhone || deliveryAddress.phone),
        statementDescription: `DJASSA ${orderNumber}`,
        metadata: { orderId, orderNumber }
      });
      const ts = new Date().toISOString();
      if (initRes.ok) {
        paymentRecord.status = 'processing';
        paymentRecord.providerReference = initRes.depositId || paymentRecord.id;
        if (initRes.checkoutUrl) {
          paymentRecord.checkoutUrl = initRes.checkoutUrl;
          checkoutUrl = initRes.checkoutUrl;
        }
        paymentRecord.updatedAt = ts;
        geniusPayInit = {
          configured: true,
          depositId: paymentRecord.providerReference,
          ...(checkoutUrl ? { paymentUrl: checkoutUrl, checkoutUrl } : {})
        };
      } else if (initRes.status === 'failed') {
        paymentRecord.status = 'failed';
        paymentRecord.updatedAt = ts;
        newOrder.paymentStatus = 'failed';
        newOrder.status = 'cancelled';
        newOrder.commissionStatus = 'cancelled';
        restoreOrderStock(newOrder);
        newOrder.updatedAt = ts;
        newOrder.trackingEvents.push({
          status: 'payment_failed',
          label: `Initiation GeniusPay refusée (${initRes.error || 'ERROR'}) — stock libéré`,
          time: ts,
          done: true
        });
        persistCommerceDb();
        return res.status(400).json({
          success: false,
          error: initRes.error || 'GENIUSPAY_INIT_FAILED',
          message: initRes.message || 'Échec initiation paiement GeniusPay.',
          order: formatScopedOrderDto(newOrder, authCtx.token.spaceRole),
          payment: paymentRecord
        });
      }
    }

    persistCommerceDb();
    void reservePgInventoryForOrder({
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
      clientId: newOrder.clientId,
      sellerId: newOrder.sellerId,
      sellerName: newOrder.sellerName,
      subtotal: newOrder.subtotal,
      discount: newOrder.discount,
      promoCode: newOrder.promoCode,
      serviceFee: clientFeeFcfa,
      clientFeeFcfa,
      commissionFcfa,
      commissionStatus: newOrder.commissionStatus,
      sellerNetFcfa,
      sellerPayoutStatus: newOrder.sellerPayoutStatus,
      paymentMode: resolvedPaymentMode,
      paymentStatus: newOrder.paymentStatus,
      initialStatus: newOrder.status,
      deliveryFee: 0,
      total: newOrder.total,
      deliveryMode: 'seller_managed',
      deliveryAddress: newOrder.deliveryAddress as unknown as Record<string, unknown>,
      paymentId: paymentRecord.id,
      paymentMethod: paymentRecord.provider,
      payerPhoneMasked: maskPhoneNumber(newOrder.deliveryAddress.phone),
      idempotencyKey: idemKey || undefined,
      expiresAtIso: newOrder.reservationExpiresAt || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      items: newOrder.items
    });

    if (isCod) {
      void recordPgCommissionEntry({
        orderId: newOrder.id,
        beneficiaryId: newOrder.sellerId,
        beneficiaryRole: 'platform',
        commissionType: 'fixed_fcfa',
        basisAmountFcfa: merchandiseNet,
        commissionAmountFcfa: commissionFcfa,
        status: 'pending',
        ledgerTransactionKey: `COMM-DJASSA-${newOrder.orderNumber}`
      });
    }

    appendAuditEntry({
      actorId: authCtx.token.uid,
      actorName: authCtx.token.name,
      actorAccountLabel: authCtx.token.email,
      actorRole: authCtx.token.spaceRole,
      space: 'client',
      category: 'orders',
      actionType: 'order_created_server',
      action: `Commande serveur #${orderNumber} créée (${resolvedPaymentMode})`,
      target: `#${orderNumber}`,
      targetType: 'order',
      entityType: 'order',
      entityId: orderId,
      result: 'reussi',
      severity: 'information',
      beforeValue: null,
      afterValue: `${total} FCFA • Commission DJASSA ${commissionFcfa} FCFA`,
      details: `Mode ${resolvedPaymentMode} (${resolvedPaymentMethod}), frais client ${clientFeeFcfa} FCFA, net vendeur ${sellerNetFcfa} FCFA`,
      ipAddress: getClientIp(req)
    });

    return res.status(201).json({
      success: true,
      order: formatScopedOrderDto(newOrder, authCtx.token.spaceRole),
      payment: paymentRecord,
      providerConfigured: gatewayReady,
      ...(checkoutUrl ? { paymentUrl: checkoutUrl, checkoutUrl } : {}),
      ...(geniusPayInit ? { geniusPay: geniusPayInit } : {})
    });
  });

  // Multi-seller atomic checkout: splits cart into independent boutique orders sharing a checkoutGroupId
  app.post('/api/commerce/orders/multi-seller', async (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    if (authCtx.token.spaceRole !== 'client' && authCtx.token.spaceRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'CLIENT_ROLE_REQUIRED',
        message: 'Seul un client authentifié peut passer une commande.'
      });
    }

    const {
      items = [],
      paymentMode,
      paymentMethod,
      deliveryAddress,
      promoCode,
      idempotencyKey
    } = req.body || {};

    const idemKey = idempotencyKey ? String(idempotencyKey) : '';
    if (idemKey && commerceDb.processedIdempotencyKeys[`multi-order:${authCtx.token.uid}:${idemKey}`]) {
      const existingGroupId = commerceDb.processedIdempotencyKeys[`multi-order:${authCtx.token.uid}:${idemKey}`].entityId;
      const existingOrders = commerceDb.orders.filter((o) => o.checkoutGroupId === existingGroupId);
      if (existingOrders.length > 0) {
        const existingPays = commerceDb.payments.filter((p) => p.checkoutGroupId === existingGroupId);
        return res.json({
          success: true,
          isDuplicate: true,
          checkoutGroupId: existingGroupId,
          orders: existingOrders.map((o) => formatScopedOrderDto(o, authCtx.token.spaceRole)),
          payments: existingPays,
          totalAmountFcfa: existingOrders.reduce((s, o) => s + o.total, 0),
          ...(existingPays[0]?.checkoutUrl
            ? { paymentUrl: existingPays[0].checkoutUrl, checkoutUrl: existingPays[0].checkoutUrl }
            : {})
        });
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'EMPTY_CART', message: 'Votre panier est vide.' });
    }
    if (paymentMode !== 'online' && paymentMode !== 'cod') {
      return res.status(400).json({
        success: false,
        error: 'PAYMENT_MODE_REQUIRED',
        message: 'Veuillez choisir un mode de paiement : Paiement en ligne ou Paiement à la livraison.'
      });
    }
    const resolvedPaymentMode: OrderPaymentMode = paymentMode;
    let resolvedPaymentMethod: OrderPaymentMethod;
    if (resolvedPaymentMode === 'online') {
      if (paymentMethod !== 'wave' && paymentMethod !== 'orange_money') {
        return res.status(400).json({
          success: false,
          error: 'INVALID_ONLINE_PAYMENT_METHOD',
          message: 'Pour le paiement en ligne, choisissez exclusivement Wave ou Orange Money.'
        });
      }
      resolvedPaymentMethod = paymentMethod;
    } else {
      resolvedPaymentMethod = 'cash_on_delivery';
    }
    if (!deliveryAddress?.commune || !deliveryAddress?.quartier || !deliveryAddress?.recipientName || !deliveryAddress?.phone) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ADDRESS',
        message: 'Adresse de livraison et numéro destinataire requis.'
      });
    }

    const qtyByProduct = new Map<string, number>();
    const resolvedItems: ServerOrder['items'] = [];
    const variantChecks: Array<{ product: ServerProduct; keysToDecrement: string[]; qty: number }> = [];

    for (const rawItem of items) {
      const pid = String(rawItem?.productId || '');
      const qty = Math.floor(Number(rawItem?.quantity || 0));
      if (!pid || !Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ success: false, error: 'INVALID_ITEM_QUANTITY' });
      }
      const product = commerceDb.products.find((p) => p.id === pid && p.status === 'published');
      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'PRODUCT_UNAVAILABLE',
          message: `Produit ${pid} indisponible ou introuvable.`
        });
      }
      if (!product.inStock || product.stock <= 0) {
        return res.status(409).json({
          success: false,
          error: 'OUT_OF_STOCK',
          message: `Le produit "${product.name}" est en rupture de stock.`
        });
      }
      qtyByProduct.set(product.id, (qtyByProduct.get(product.id) || 0) + qty);

      const variantObj: Record<string, string> =
        rawItem?.variant && typeof rawItem.variant === 'object' ? rawItem.variant : {};
      const matchedKeys: string[] = [];
      if (product.variantStock) {
        const colorVal = variantObj['Couleur'] || variantObj['Color'] || '';
        const sizeVal = variantObj['Taille'] || variantObj['Pointure'] || variantObj['Size'] || '';
        const comboKeys = [
          colorVal && sizeVal ? `${colorVal}-${sizeVal}` : '',
          colorVal && sizeVal ? `${colorVal} - ${sizeVal}` : ''
        ].filter(Boolean);
        let checkedCombo = false;
        for (const ck of comboKeys) {
          if (product.variantStock[ck] !== undefined) {
            checkedCombo = true;
            matchedKeys.push(ck);
            if (product.variantStock[ck] < qty) {
              return res.status(409).json({
                success: false,
                error: 'INSUFFICIENT_VARIANT_STOCK',
                message: `Stock insuffisant pour "${product.name}" (${ck}).`
              });
            }
          }
        }
        if (!checkedCombo) {
          for (const optVal of Object.values(variantObj)) {
            if (optVal && product.variantStock[optVal] !== undefined) {
              matchedKeys.push(optVal);
              if (product.variantStock[optVal] < qty) {
                return res.status(409).json({
                  success: false,
                  error: 'INSUFFICIENT_VARIANT_STOCK',
                  message: `Stock insuffisant pour "${product.name}" — option "${optVal}".`
                });
              }
            }
          }
        }
      }
      variantChecks.push({ product, keysToDecrement: matchedKeys, qty });
      resolvedItems.push({
        productId: product.id,
        productTitle: product.name,
        productImage: product.images[0] || product.videoPoster || '',
        price: product.price,
        quantity: qty,
        variant: variantObj,
        variantStockKeys: matchedKeys,
        sellerId: product.sellerId,
        sellerName: product.sellerName
      });
    }

    for (const [pid, reqQty] of qtyByProduct.entries()) {
      const product = commerceDb.products.find((p) => p.id === pid)!;
      if (product.stock < reqQty) {
        return res.status(409).json({
          success: false,
          error: 'INSUFFICIENT_STOCK',
          message: `Stock insuffisant pour "${product.name}" (demandé: ${reqQty}, disponible: ${product.stock}).`
        });
      }
    }

    const totalCartSubtotal = resolvedItems.reduce((s, item) => s + item.price * item.quantity, 0);
    if (totalCartSubtotal < commerceDb.platformConfig.minOrderAmount) {
      return res.status(400).json({
        success: false,
        error: 'MIN_ORDER_AMOUNT',
        message: `Montant minimum par commande : ${commerceDb.platformConfig.minOrderAmount} FCFA.`
      });
    }

    let totalDiscount = 0;
    let appliedPromoCode: string | undefined;
    if (promoCode && String(promoCode).trim()) {
      const promoCheck = validatePromoCodeServer(String(promoCode), totalCartSubtotal);
      if (!promoCheck.valid) {
        return res.status(400).json({
          success: false,
          error: promoCheck.error || 'INVALID_PROMO_CODE',
          message: promoCheck.message || 'Code promo invalide ou expiré.'
        });
      }
      totalDiscount = promoCheck.discountFcfa;
      appliedPromoCode = promoCheck.code;
    }

    // Group items by sellerId
    const itemsBySeller = new Map<string, ServerOrder['items']>();
    for (const item of resolvedItems) {
      const list = itemsBySeller.get(item.sellerId) || [];
      list.push(item);
      itemsBySeller.set(item.sellerId, list);
    }

    const sellerGroups = Array.from(itemsBySeller.entries());
    let allocatedDiscount = 0;
    const preparedGroups: Array<{
      sellerId: string;
      sellerName: string;
      items: ServerOrder['items'];
      subtotal: number;
      discount: number;
      clientFeeFcfa: number;
      commissionFcfa: number;
      sellerNetFcfa: number;
      total: number;
      parcelClass: 'small' | 'standard' | 'bulky';
    }> = [];

    for (let idx = 0; idx < sellerGroups.length; idx++) {
      const [sId, groupItems] = sellerGroups[idx];
      const parcelClass: 'small' | 'standard' | 'bulky' = groupItems.some((item) => {
        const p = commerceDb.products.find((cand) => cand.id === item.productId);
        return p ? inferProductParcelClass(p) === 'bulky' : false;
      })
        ? 'bulky'
        : 'standard';

      const groupSubtotal = groupItems.reduce((s, it) => s + it.price * it.quantity, 0);
      const groupDiscount =
        totalDiscount <= 0
          ? 0
          : idx === sellerGroups.length - 1
          ? Math.max(0, totalDiscount - allocatedDiscount)
          : Math.round((groupSubtotal / totalCartSubtotal) * totalDiscount);
      allocatedDiscount += groupDiscount;

      const merchandiseNet = Math.max(0, groupSubtotal - groupDiscount);
      const clientFeeFcfa =
        resolvedPaymentMode === 'online' ? Math.round(merchandiseNet * CLIENT_ONLINE_FEE_RATE) : 0;
      const total = merchandiseNet + clientFeeFcfa;
      const commissionFcfa = DJASSA_FIXED_COMMISSION_FCFA;
      const sellerNetFcfa = Math.max(0, merchandiseNet - commissionFcfa);

      preparedGroups.push({
        sellerId: sId,
        sellerName: groupItems[0].sellerName,
        items: groupItems,
        subtotal: groupSubtotal,
        discount: groupDiscount,
        clientFeeFcfa,
        commissionFcfa,
        sellerNetFcfa,
        total,
        parcelClass
      });
    }

    // All validations succeeded — perform atomic stock decrement across all items
    const isCod = resolvedPaymentMode === 'cod';
    for (const [pid, reqQty] of qtyByProduct.entries()) {
      const product = commerceDb.products.find((p) => p.id === pid)!;
      product.stock = Math.max(0, product.stock - reqQty);
      product.inStock = product.stock > 0;
      if (isCod) {
        product.salesCount = (product.salesCount || 0) + reqQty;
      }
      product.updatedAt = new Date().toISOString();
    }
    for (const vc of variantChecks) {
      if (vc.product.variantStock) {
        for (const k of vc.keysToDecrement) {
          vc.product.variantStock[k] = Math.max(0, (vc.product.variantStock[k] ?? 0) - vc.qty);
        }
      }
    }

    const nowIso = new Date().toISOString();
    const checkoutGroupId = `grp-${crypto.randomUUID().slice(0, 12)}`;
    const gatewayReady = resolvedPaymentMode === 'online' ? isGatewayConfigured(resolvedPaymentMethod) : false;
    const createdOrders: ServerOrder[] = [];
    const createdPayments: ServerPaymentRecord[] = [];
    const totalAmountFcfa = preparedGroups.reduce((s, g) => s + g.total, 0);

    for (let idx = 0; idx < preparedGroups.length; idx++) {
      const grp = preparedGroups[idx];
      const orderId = `ord-${crypto.randomUUID().slice(0, 12)}`;
      const orderNumber = `ADJ${crypto.randomInt(10000, 99999)}`;
      const paymentId = `pay-${crypto.randomUUID().slice(0, 12)}`;

      const paymentRecord: ServerPaymentRecord = {
        id: paymentId,
        orderId,
        orderNumber,
        clientId: authCtx.token.uid,
        checkoutGroupId,
        provider: resolvedPaymentMethod,
        providerReference: null,
        providerConfigured: gatewayReady,
        idempotencyKey: idemKey ? `${idemKey}:${idx}` : `pay-idem-${orderId}`,
        amountFcfa: grp.total,
        status: 'pending',
        verifiedWebhookAt: null,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      const newOrder: ServerOrder = {
        id: orderId,
        orderNumber,
        clientId: authCtx.token.uid,
        clientName: authCtx.token.name,
        sellerId: grp.sellerId,
        sellerName: grp.sellerName,
        items: grp.items,
        subtotal: grp.subtotal,
        discount: grp.discount,
        ...(appliedPromoCode ? { promoCode: appliedPromoCode } : {}),
        serviceFee: grp.clientFeeFcfa,
        clientFeeFcfa: grp.clientFeeFcfa,
        deliveryFee: 0,
        commissionFcfa: grp.commissionFcfa,
        commissionStatus: 'pending',
        sellerNetFcfa: grp.sellerNetFcfa,
        sellerPayoutStatus: isCod ? 'not_applicable' : 'pending_payment',
        total: grp.total,
        deliveryMode: 'seller_managed',
        paymentMode: resolvedPaymentMode,
        paymentMethod: resolvedPaymentMethod,
        paymentStatus: isCod ? 'cod_pending' : 'pending',
        paymentId,
        checkoutGroupId,
        status: isCod ? 'passed' : 'pending_payment',
        deliveryAddress: {
          commune: String(deliveryAddress.commune),
          quartier: String(deliveryAddress.quartier),
          details: String(deliveryAddress.details || ''),
          ...(deliveryAddress.landmark ? { landmark: String(deliveryAddress.landmark) } : {}),
          ...(deliveryAddress.deliveryInstructions ? { deliveryInstructions: String(deliveryAddress.deliveryInstructions) } : {}),
          ...(deliveryAddress.gpsCoords && typeof deliveryAddress.gpsCoords.lat === 'number'
            ? { gpsCoords: { lat: Number(deliveryAddress.gpsCoords.lat), lng: Number(deliveryAddress.gpsCoords.lng) } }
            : {}),
          recipientName: String(deliveryAddress.recipientName),
          phone: String(deliveryAddress.phone),
          ...(deliveryAddress.absencePolicy ? { absencePolicy: deliveryAddress.absencePolicy } : {}),
          ...(deliveryAddress.absenceRecipientName ? { absenceRecipientName: String(deliveryAddress.absenceRecipientName) } : {}),
          ...(deliveryAddress.absenceRecipientPhone ? { absenceRecipientPhone: String(deliveryAddress.absenceRecipientPhone) } : {})
        },
        settled: false,
        stockRestored: false,
        parcelClass: grp.parcelClass,
        ...(!isCod ? { reservationExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() } : {}),
        trackingEvents: [
          {
            status: isCod ? 'passed' : 'pending_payment',
            label: isCod
              ? `Commande multi-vendeurs #${orderNumber} confirmée (Paiement à la livraison)`
              : `Commande multi-vendeurs #${orderNumber} créée — En attente paiement`,
            time: nowIso,
            done: true,
            description: `Groupe ${checkoutGroupId} • ${grp.sellerName}`
          }
        ],
        createdAt: nowIso,
        updatedAt: nowIso
      };

      commerceDb.payments.unshift(paymentRecord);
      commerceDb.orders.unshift(newOrder);
      createdOrders.push(newOrder);
      createdPayments.push(paymentRecord);

      pushNotification({
        userId: grp.sellerId,
        targetRoles: ['seller'],
        type: 'order',
        title: `Nouvelle commande #${orderNumber}`,
        body: `${grp.items.length} article(s) — ${grp.total.toLocaleString('fr-FR')} FCFA (${deliveryAddress.commune})`,
        referenceId: orderId
      });
      pushNotification({
        userId: authCtx.token.uid,
        type: 'order',
        title: `Commande #${orderNumber} (${grp.sellerName}) enregistrée`,
        body: isCod ? 'Paiement direct au vendeur à la réception.' : 'En attente de confirmation du paiement en ligne.',
        referenceId: orderId
      });

      void reservePgInventoryForOrder({
        orderId: newOrder.id,
        orderNumber: newOrder.orderNumber,
        clientId: newOrder.clientId,
        sellerId: newOrder.sellerId,
        sellerName: newOrder.sellerName,
        subtotal: newOrder.subtotal,
        discount: newOrder.discount,
        promoCode: newOrder.promoCode,
        serviceFee: newOrder.clientFeeFcfa,
        clientFeeFcfa: newOrder.clientFeeFcfa,
        commissionFcfa: newOrder.commissionFcfa,
        commissionStatus: newOrder.commissionStatus,
        sellerNetFcfa: newOrder.sellerNetFcfa,
        sellerPayoutStatus: newOrder.sellerPayoutStatus,
        paymentMode: resolvedPaymentMode,
        paymentStatus: newOrder.paymentStatus,
        initialStatus: newOrder.status,
        deliveryFee: 0,
        total: newOrder.total,
        deliveryMode: 'seller_managed',
        deliveryAddress: newOrder.deliveryAddress as unknown as Record<string, unknown>,
        paymentId: paymentRecord.id,
        paymentMethod: paymentRecord.provider,
        payerPhoneMasked: maskPhoneNumber(newOrder.deliveryAddress.phone),
        checkoutGroupId,
        idempotencyKey: paymentRecord.idempotencyKey,
        expiresAtIso: newOrder.reservationExpiresAt || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        items: newOrder.items
      });

      if (isCod) {
        void recordPgCommissionEntry({
          orderId: newOrder.id,
          beneficiaryId: newOrder.sellerId,
          beneficiaryRole: 'platform',
          commissionType: 'fixed_fcfa',
          basisAmountFcfa: Math.max(0, newOrder.subtotal - newOrder.discount),
          commissionAmountFcfa: newOrder.commissionFcfa,
          status: 'pending',
          ledgerTransactionKey: `COMM-DJASSA-${newOrder.orderNumber}`
        });
      }
    }

    if (idemKey) {
      commerceDb.processedIdempotencyKeys[`multi-order:${authCtx.token.uid}:${idemKey}`] = {
        type: 'multi-order',
        entityId: checkoutGroupId,
        at: nowIso
      };
    }

    let geniusPayInit: Record<string, unknown> | null = null;
    let checkoutUrl: string | undefined;
    if (resolvedPaymentMode === 'online' && gatewayReady && (req.body?.payerPhone || deliveryAddress?.phone)) {
      const groupDepositId = createdOrders.length === 1 ? createdPayments[0].id : checkoutGroupId;
      const initRes = await initiateGeniusPayDeposit({
        depositId: groupDepositId,
        amountFcfa: totalAmountFcfa,
        provider: resolvedPaymentMethod as OnlineOrderPaymentMethod,
        payerPhone: String(req.body?.payerPhone || deliveryAddress.phone),
        statementDescription: `DJASSA GRP ${createdOrders.length}`.slice(0, 22),
        metadata: { checkoutGroupId, orderCount: String(createdOrders.length) }
      });
      const ts = new Date().toISOString();
      if (initRes.ok) {
        createdPayments.forEach((p) => {
          p.status = 'processing';
          p.providerReference = initRes.depositId || groupDepositId;
          if (initRes.checkoutUrl) p.checkoutUrl = initRes.checkoutUrl;
          p.updatedAt = ts;
        });
        checkoutUrl = initRes.checkoutUrl;
        geniusPayInit = {
          configured: true,
          depositId: initRes.depositId || groupDepositId,
          ...(checkoutUrl ? { paymentUrl: checkoutUrl, checkoutUrl } : {})
        };
      } else if (initRes.status === 'failed') {
        createdOrders.forEach((ord, idx2) => {
          const p = createdPayments[idx2];
          p.status = 'failed';
          p.updatedAt = ts;
          ord.paymentStatus = 'failed';
          ord.status = 'cancelled';
          ord.commissionStatus = 'cancelled';
          restoreOrderStock(ord);
          ord.updatedAt = ts;
        });
        persistCommerceDb();
        return res.status(400).json({
          success: false,
          error: initRes.error || 'GENIUSPAY_INIT_FAILED',
          message: initRes.message || 'Échec initiation paiement GeniusPay.',
          orders: createdOrders.map((o) => formatScopedOrderDto(o, authCtx.token.spaceRole)),
          payments: createdPayments
        });
      }
    }

    persistCommerceDb();

    appendAuditEntry({
      actorId: authCtx.token.uid,
      actorName: authCtx.token.name,
      actorAccountLabel: authCtx.token.email,
      actorRole: authCtx.token.spaceRole,
      space: 'client',
      category: 'orders',
      actionType: 'multi_seller_orders_created',
      action: `${createdOrders.length} commandes multi-vendeurs créées (${checkoutGroupId})`,
      target: checkoutGroupId,
      targetType: 'order',
      entityType: 'order_group',
      entityId: checkoutGroupId,
      result: 'reussi',
      severity: 'information',
      details: `${createdOrders.length} commandes (${createdOrders.map((o) => `#${o.orderNumber}`).join(', ')}) pour ${totalAmountFcfa} FCFA (${resolvedPaymentMode})`,
      afterValue: `${totalAmountFcfa} FCFA • ${createdOrders.map((o) => `#${o.orderNumber}`).join(', ')}`,
      ipAddress: getClientIp(req)
    });

    return res.status(201).json({
      success: true,
      checkoutGroupId,
      orders: createdOrders.map((o) => formatScopedOrderDto(o, authCtx.token.spaceRole)),
      payments: createdPayments,
      totalAmountFcfa,
      providerConfigured: gatewayReady,
      ...(checkoutUrl ? { paymentUrl: checkoutUrl, checkoutUrl } : {}),
      ...(geniusPayInit ? { geniusPay: geniusPayInit } : {})
    });
  });

  // Payment Webhook (raw-body HMAC verified + replay-safe) — never mints paid state without secret verification
  app.post('/api/commerce/payments/webhook', async (req: Request, res: Response) => {
    const webhookSecret = (process.env.GENIUSPAY_WEBHOOK_SECRET || process.env.DJASSA_PAYMENT_WEBHOOK_SECRET || '').trim();
    if (!webhookSecret) {
      return res.status(503).json({
        success: false,
        error: 'PAYMENT_WEBHOOK_SECRET_NOT_CONFIGURED',
        message: 'Webhook paiement désactivé : GENIUSPAY_WEBHOOK_SECRET / DJASSA_PAYMENT_WEBHOOK_SECRET non configuré sur le serveur.'
      });
    }

    const providedSig = String(
      req.header('x-djassa-webhook-signature') || req.header('x-geniuspay-signature') || ''
    ).trim();
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody || JSON.stringify(req.body || {});
    const signatureValid = verifyWebhookHmacSignature({
      rawBody,
      providedSignature: providedSig,
      secret: webhookSecret
    });

    if (!signatureValid) {
      void recordPgPaymentWebhookEvent({
        provider: String(req.body?.provider || 'geniuspay'),
        providerEventKey: `invalid-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
        providerReference: null,
        eventType: 'payment.webhook',
        signatureValid: false,
        processingStatus: 'failed',
        payloadRedacted: redactWebhookPayload(req.body),
        failureReason: 'INVALID_WEBHOOK_SIGNATURE'
      });
      return res.status(401).json({
        success: false,
        error: 'INVALID_WEBHOOK_SIGNATURE',
        message: 'Signature HMAC du webhook de paiement invalide.'
      });
    }

    const { paymentId, depositId, payoutId, refundId, checkoutGroupId, orderId, providerReference, status } = req.body || {};
    const resolvedStatusRaw = String(status || '');
    const normalizedStatus = ['confirmed', 'paid', 'COMPLETED', 'CONFIRMED', 'PAID'].includes(resolvedStatusRaw)
      ? 'confirmed'
      : ['failed', 'FAILED', 'REJECTED'].includes(resolvedStatusRaw)
      ? 'failed'
      : ['cancelled', 'CANCELLED', 'EXPIRED'].includes(resolvedStatusRaw)
      ? 'cancelled'
      : mapGeniusPayStatusToDjassa(resolvedStatusRaw);

    const rawProviderFee = req.body?.providerFeeFcfa ?? req.body?.fees ?? req.body?.fee;
    const parsedProviderFee =
      rawProviderFee !== undefined && rawProviderFee !== null && Number.isFinite(Number(rawProviderFee))
        ? Math.max(0, Math.round(Number(rawProviderFee)))
        : null;

    // 1) GeniusPay Seller Direct Order Payout callback (payout-ord-...)
    const resolvedPayoutId = String(payoutId || '').trim();
    if (resolvedPayoutId && resolvedPayoutId.startsWith('payout-')) {
      const targetOrder = commerceDb.orders.find(
        (cand) => cand.sellerPayoutReference === resolvedPayoutId || `payout-${cand.id}` === resolvedPayoutId
      );
      if (!targetOrder) return res.status(404).json({ success: false, error: 'PAYOUT_ORDER_NOT_FOUND' });
      const evtKey = String(req.body?.eventId || `seller-payout:${resolvedPayoutId}:${normalizedStatus}`);
      if (commerceDb.processedWebhookKeys[evtKey]) {
        return res.json({ success: true, idempotent: true, order: targetOrder });
      }
      const nowIso = new Date().toISOString();
      targetOrder.sellerPayoutStatus = normalizedStatus === 'confirmed' ? 'completed' : 'failed';
      targetOrder.updatedAt = nowIso;
      targetOrder.trackingEvents.push({
        status: `seller_payout_${targetOrder.sellerPayoutStatus}`,
        label:
          targetOrder.sellerPayoutStatus === 'completed'
            ? `Reversement vendeur confirmé (${targetOrder.sellerNetFcfa.toLocaleString('fr-FR')} FCFA)`
            : 'Échec du reversement vendeur par le fournisseur',
        time: nowIso,
        done: targetOrder.sellerPayoutStatus === 'completed'
      });
      commerceDb.processedWebhookKeys[evtKey] = { at: nowIso, paymentId: resolvedPayoutId, status: targetOrder.sellerPayoutStatus };
      persistCommerceDb();
      void recordPgOrderStatusTransition({
        orderId: targetOrder.id,
        fromStatus: targetOrder.status,
        toStatus: targetOrder.status,
        sellerPayoutStatus: targetOrder.sellerPayoutStatus,
        sellerPayoutReference: String(providerReference || resolvedPayoutId),
        note: `Webhook payout vendeur (${targetOrder.sellerPayoutStatus})`
      });
      void recordPgPaymentWebhookEvent({
        provider: 'geniuspay',
        providerEventKey: evtKey,
        providerReference: String(providerReference || resolvedPayoutId),
        eventType: 'seller_payout.webhook',
        signatureValid: true,
        processingStatus: 'processed',
        payloadRedacted: redactWebhookPayload(req.body)
      });
      return res.json({ success: true, order: targetOrder });
    }

    // 1b) GeniusPay Withdrawal Payout callback (wdr-...)
    if (resolvedPayoutId && resolvedPayoutId.startsWith('wdr-')) {
      const w = commerceDb.withdrawals.find((cand) => cand.id === resolvedPayoutId);
      if (!w) return res.status(404).json({ success: false, error: 'WITHDRAWAL_NOT_FOUND' });
      const evtKey = String(req.body?.eventId || `payout:${w.id}:${normalizedStatus}`);
      if (commerceDb.processedWebhookKeys[evtKey]) {
        return res.json({ success: true, idempotent: true, withdrawal: w });
      }
      const nowIso = new Date().toISOString();
      w.geniusPayPayoutStatus = normalizedStatus;
      if ((normalizedStatus === 'failed' || normalizedStatus === 'cancelled') && w.status === 'completed') {
        w.status = 'failed';
        securityDb.financeLedger.unshift({
          id: `led-payout-rev-${crypto.randomUUID().slice(0, 8)}`,
          accountId: w.accountId,
          accountEmail: w.accountEmail,
          accountName: w.accountName,
          spaceRole: w.role,
          type: 'credit',
          amountFcfa: w.amountFcfa,
          commissionFcfa: 0,
          channel: w.channel,
          payoutTarget: w.payoutTargetMasked,
          reference: `WEBHOOK-FAIL-${w.reference}`,
          status: 'valide',
          suspicionReasons: [`Recrédit automatique : échec décaissement GeniusPay (${resolvedStatusRaw})`],
          createdAt: nowIso
        });
        persistSecurityDb();
        void recordPgWalletLedgerEntry({
          accountId: w.accountId,
          transactionKey: `WEBHOOK-FAIL-${w.reference}`,
          entryType: 'credit',
          amountFcfa: w.amountFcfa,
          status: 'posted',
          referenceType: 'withdrawal',
          referenceId: `withdrawal:${w.id}`,
          description: `Recrédit échec payout webhook ${w.reference}`
        });
      }
      commerceDb.processedWebhookKeys[evtKey] = { at: nowIso, paymentId: w.id, status: w.status };
      persistCommerceDb();
      void syncWithdrawalToPostgres(w);
      void recordPgPaymentWebhookEvent({
        provider: 'geniuspay',
        providerEventKey: evtKey,
        providerReference: String(providerReference || w.id),
        eventType: 'payout.webhook',
        signatureValid: true,
        processingStatus: 'processed',
        payloadRedacted: redactWebhookPayload(req.body)
      });
      return res.json({ success: true, withdrawal: w });
    }

    // 2) GeniusPay Refund callback (rfnd-...)
    const resolvedRefundId = String(refundId || '').trim();
    if (resolvedRefundId && (resolvedStatusRaw === 'confirmed' || resolvedStatusRaw === 'COMPLETED' || normalizedStatus === 'confirmed' || normalizedStatus === 'failed' || normalizedStatus === 'cancelled')) {
      const refResult = applyGeniusPayRefundWebhookEvent({
        providerReference: resolvedRefundId,
        status: normalizedStatus === 'confirmed' ? 'confirmed' : 'failed',
        providerStatus: resolvedStatusRaw,
        failureReason: req.body?.failureReason ? String(req.body.failureReason) : undefined
      });
      if (refResult.found) {
        const evtKey = String(req.body?.eventId || `refund:${resolvedRefundId}:${normalizedStatus}`);
        commerceDb.processedWebhookKeys[evtKey] = { at: new Date().toISOString(), paymentId: resolvedRefundId, status: normalizedStatus };
        persistCommerceDb();
        void recordPgPaymentWebhookEvent({
          provider: 'geniuspay',
          providerEventKey: evtKey,
          providerReference: resolvedRefundId,
          eventType: 'refund.webhook',
          signatureValid: true,
          processingStatus: 'processed',
          payloadRedacted: redactWebhookPayload(req.body)
        });
        return res.json({ success: true, idempotent: Boolean(refResult.idempotent), refund: refResult.refund });
      }
    }

    // 3) AI Credits Recharge callback (rch-... or metadata.rechargeId / providerReference)
    const resolvedPid = String(paymentId || depositId || '').trim();
    const bodyRef = String(req.body?.reference || '').trim();
    const metaRechargeId = String(req.body?.metadata?.rechargeId || '').trim();
    const metaUserId = req.body?.metadata?.userId ? String(req.body.metadata.userId).trim() : undefined;
    const rawWebhookAmount = req.body?.amountFcfa ?? req.body?.amount_fcfa ?? req.body?.amount;
    const parsedWebhookAmount =
      rawWebhookAmount !== undefined && rawWebhookAmount !== null && rawWebhookAmount !== ''
        ? Number(rawWebhookAmount)
        : undefined;
    const candidateRechargeId =
      (metaRechargeId.startsWith('rch-') ? metaRechargeId : '') ||
      (resolvedPid.startsWith('rch-') ? resolvedPid : '') ||
      (bodyRef.startsWith('rch-') ? bodyRef : '') ||
      resolvedPid ||
      bodyRef ||
      String(providerReference || '').trim();

    if (
      creditRechargeWebhookHandler &&
      candidateRechargeId &&
      (candidateRechargeId.startsWith('rch-') ||
        resolvedPid.startsWith('rch-') ||
        bodyRef.startsWith('rch-') ||
        metaRechargeId.startsWith('rch-') ||
        (providerReference && String(providerReference).trim()))
    ) {
      if (normalizedStatus === 'confirmed' || normalizedStatus === 'failed' || normalizedStatus === 'cancelled') {
        const rchRes = creditRechargeWebhookHandler({
          rechargeId: candidateRechargeId,
          reference: bodyRef || undefined,
          status: normalizedStatus === 'confirmed' ? 'confirmed' : 'failed',
          providerReference: providerReference ? String(providerReference) : resolvedPid || undefined,
          providerStatus: resolvedStatusRaw,
          ...(parsedWebhookAmount !== undefined && Number.isFinite(parsedWebhookAmount)
            ? { paidAmountFcfa: parsedWebhookAmount }
            : {}),
          ...(metaUserId ? { expectedUserId: metaUserId } : {}),
          verifiedBy: 'geniuspay_webhook'
        });
        if (rchRes.found) {
          const evtKey = String(req.body?.eventId || `credit:${candidateRechargeId}:${normalizedStatus}`);
          if (rchRes.rejected) {
            void recordPgPaymentWebhookEvent({
              provider: 'geniuspay',
              providerEventKey: `${evtKey}:rejected:${Date.now()}`,
              providerReference: String(providerReference || candidateRechargeId),
              eventType: 'credits_recharge.webhook',
              signatureValid: true,
              processingStatus: 'failed',
              payloadRedacted: redactWebhookPayload(req.body),
              failureReason: rchRes.error || 'RECHARGE_VERIFICATION_FAILED'
            });
            return res.status(409).json({
              success: false,
              error: rchRes.error || 'RECHARGE_VERIFICATION_FAILED',
              message: rchRes.message || 'Vérification de la recharge refusée.',
              newBalance: rchRes.newBalance,
              recharge: rchRes.recharge
            });
          }
          commerceDb.processedWebhookKeys[evtKey] = {
            at: new Date().toISOString(),
            paymentId: candidateRechargeId,
            status: normalizedStatus
          };
          persistCommerceDb();
          void recordPgPaymentWebhookEvent({
            provider: 'geniuspay',
            providerEventKey: evtKey,
            providerReference: String(providerReference || candidateRechargeId),
            eventType: 'credits_recharge.webhook',
            signatureValid: true,
            processingStatus: 'processed',
            payloadRedacted: redactWebhookPayload(req.body)
          });
          return res.json({
            success: true,
            idempotent: Boolean(rchRes.idempotent),
            newBalance: rchRes.newBalance,
            ...(rchRes.activePlan ? { activePlan: rchRes.activePlan } : {}),
            recharge: rchRes.recharge
          });
        }
      } else {
        // Status is pending / processing — acknowledge cleanly without crediting
        return res.status(202).json({
          success: true,
          pending: true,
          message: 'Paiement toujours en attente de confirmation opérateur ; aucun crédit attribué.'
        });
      }
    }

    // 3b) COD Commission Settlement callback (cset-...)
    const candidateSettlementId = (resolvedPid.startsWith('cset-') ? resolvedPid : '') || (bodyRef.startsWith('cset-') ? bodyRef : '');
    if (candidateSettlementId) {
      const settlement = commerceDb.commissionSettlements.find((s) => s.id === candidateSettlementId);
      if (settlement) {
        const evtKey = String(req.body?.eventId || `cset:${settlement.id}:${normalizedStatus}`);
        if (commerceDb.processedWebhookKeys[evtKey]) {
          return res.json({ success: true, idempotent: true, settlement });
        }
        const nowIso = new Date().toISOString();
        if (normalizedStatus === 'confirmed') {
          settlement.status = 'paid';
          settlement.providerReference = String(providerReference || depositId || settlement.providerReference || settlement.id);
          const ord = commerceDb.orders.find((o) => o.id === settlement.orderId);
          if (ord) {
            ord.commissionStatus = 'paid';
            ord.updatedAt = nowIso;
          }
        } else if (normalizedStatus === 'failed' || normalizedStatus === 'cancelled') {
          settlement.status = 'failed';
        }
        commerceDb.processedWebhookKeys[evtKey] = { at: nowIso, paymentId: settlement.id, status: settlement.status };
        persistCommerceDb();
        return res.json({ success: true, settlement });
      }
    }

    // 4) Commerce single or multi-seller group payment(s)
    const resolvedGroupId = String(checkoutGroupId || (resolvedPid.startsWith('grp-') ? resolvedPid : '')).trim();
    const matchedPayments = resolvedGroupId
      ? commerceDb.payments.filter((p) => p.checkoutGroupId === resolvedGroupId)
      : commerceDb.payments.filter(
          (p) =>
            (resolvedPid && (p.id === resolvedPid || p.providerReference === resolvedPid)) ||
            (orderId && p.orderId === orderId)
        );
    if (matchedPayments.length === 0) {
      return res.status(404).json({ success: false, error: 'PAYMENT_NOT_FOUND' });
    }

    const primaryPayment = matchedPayments[0];
    const providerEventKey = String(
      req.body?.eventId || `${resolvedGroupId || primaryPayment.id}:${providerReference || 'noref'}:${normalizedStatus}`
    );

    if (commerceDb.processedWebhookKeys[providerEventKey] || matchedPayments.every((p) => p.status === 'confirmed')) {
      return res.json({
        success: true,
        idempotent: true,
        payment: primaryPayment,
        ...(resolvedGroupId ? { payments: matchedPayments } : {})
      });
    }

    if (matchedPayments.some((p) => p.status === 'failed' || p.status === 'cancelled' || p.status === 'refunded')) {
      return res.status(409).json({
        success: false,
        error: 'PAYMENT_TERMINAL_STATE',
        message: 'Ce paiement est déjà dans un état terminal et ne peut plus être confirmé automatiquement.'
      });
    }

    const nowIso = new Date().toISOString();
    const updatedOrders: ServerOrder[] = [];

    for (const payment of matchedPayments) {
      const order = commerceDb.orders.find((o) => o.id === payment.orderId);
      if (!order) return res.status(404).json({ success: false, error: 'ORDER_NOT_FOUND' });
      if (order.status !== 'pending_payment' || !['pending', 'processing'].includes(order.paymentStatus)) {
        return res.status(409).json({
          success: false,
          error: 'ORDER_PAYMENT_STATE_CONFLICT',
          message: 'La commande n’est plus dans un état permettant cette transition de paiement.'
        });
      }

      const prevPaymentStatus = payment.status;
      if (normalizedStatus === 'confirmed') {
        const ref = String(providerReference || depositId || payment.providerReference || `EXT-${Date.now()}`);
        await applyOnlineOrderPaymentConfirmed(order, payment, 'webhook', 'geniuspay_webhook', ref, parsedProviderFee);
      } else if (normalizedStatus === 'failed' || normalizedStatus === 'cancelled') {
        payment.status = normalizedStatus;
        payment.updatedAt = nowIso;
        order.paymentStatus = 'failed';
        order.commissionStatus = 'cancelled';
        order.sellerPayoutStatus = 'not_applicable';
        if (order.status === 'pending_payment') {
          order.status = 'cancelled';
          restoreOrderStock(order);
        }
        order.updatedAt = nowIso;
        order.trackingEvents.push({
          status: normalizedStatus === 'failed' ? 'payment_failed' : 'payment_cancelled',
          label: normalizedStatus === 'failed' ? 'Paiement refusé — stock libéré' : 'Paiement annulé — stock libéré',
          time: nowIso,
          done: true
        });
        void recordPgOrderStatusTransition({
          orderId: order.id,
          fromStatus: 'pending_payment',
          toStatus: 'cancelled',
          paymentStatus: 'failed',
          commissionStatus: 'cancelled',
          sellerPayoutStatus: 'not_applicable',
          note: `Webhook ${normalizedStatus}`
        });
      } else {
        return res.status(400).json({ success: false, error: 'INVALID_PAYMENT_STATUS' });
      }

      void syncPgPaymentStatusUpdate({
        paymentId: payment.id,
        orderId: order.id,
        provider: payment.provider,
        providerReference: payment.providerReference,
        previousStatus: prevPaymentStatus,
        nextStatus: payment.status,
        source: 'webhook',
        providerStatus: String(status),
        eventKey: `${providerEventKey}:${payment.id}`,
        amountFcfa: payment.amountFcfa,
        payerPhoneMasked: maskPhoneNumber(order.deliveryAddress.phone)
      });
      updatedOrders.push(order);
    }

    commerceDb.processedWebhookKeys[providerEventKey] = {
      at: nowIso,
      paymentId: primaryPayment.id,
      status: primaryPayment.status
    };
    persistCommerceDb();

    void recordPgPaymentWebhookEvent({
      provider: primaryPayment.provider,
      providerEventKey,
      providerReference: primaryPayment.providerReference,
      eventType: resolvedGroupId ? 'payment_group.webhook' : 'payment.webhook',
      signatureValid: true,
      processingStatus: 'processed',
      payloadRedacted: redactWebhookPayload(req.body)
    });
    return res.json({
      success: true,
      payment: primaryPayment,
      order: updatedOrders[0],
      ...(updatedOrders.length > 1 ? { orders: updatedOrders, payments: matchedPayments } : {})
    });
  });

  // Live provider status check (never fabricates confirmation without GeniusPay key & COMPLETED response)
  app.post('/api/commerce/payments/:paymentId/verify-provider', async (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const payment = commerceDb.payments.find((p) => p.id === req.params.paymentId);
    if (!payment) return res.status(404).json({ success: false, error: 'PAYMENT_NOT_FOUND' });
    const order = commerceDb.orders.find((o) => o.id === payment.orderId);
    if (!order) return res.status(404).json({ success: false, error: 'ORDER_NOT_FOUND' });

    const isAllowed =
      authCtx.token.spaceRole === 'admin' ||
      order.clientId === authCtx.token.uid ||
      order.sellerId === authCtx.token.tenantId;
    if (!isAllowed) return res.status(403).json({ success: false, error: 'FORBIDDEN_PAYMENT_CHECK' });

    const check = await fetchGeniusPayDepositStatus(payment.providerReference || payment.id);
    if (!check.configured) {
      return res.status(503).json({
        success: false,
        error: 'GENIUSPAY_NOT_CONFIGURED',
        message: 'GENIUSPAY_API_KEY non configuré : vérification en direct impossible.',
        payment
      });
    }
    if (!check.found) {
      return res.status(404).json({
        success: false,
        error: 'PROVIDER_TRANSACTION_NOT_FOUND',
        message: check.error || 'Transaction introuvable chez GeniusPay.'
      });
    }
    const nowIso = new Date().toISOString();
    if (check.djassaStatus === 'confirmed' && payment.status !== 'confirmed') {
      const prevStatus = payment.status;
      await applyOnlineOrderPaymentConfirmed(
        order,
        payment,
        'api',
        'geniuspay_api',
        payment.providerReference || check.reference || payment.id
      );
      persistCommerceDb();
      void syncPgPaymentStatusUpdate({
        paymentId: payment.id,
        orderId: order.id,
        provider: payment.provider,
        providerReference: payment.providerReference,
        previousStatus: prevStatus,
        nextStatus: 'confirmed',
        source: 'api',
        providerStatus: check.providerStatus,
        eventKey: `api-check:${payment.id}:${nowIso}`,
        amountFcfa: payment.amountFcfa
      });
    }
    return res.json({
      success: true,
      providerCheck: check,
      payment,
      order: formatScopedOrderDto(order, authCtx.token.spaceRole)
    });
  });

  // Financial reconciliation job (payments vs orders vs withdrawals vs security ledger)
  app.post(
    '/api/commerce/payments/reconcile',
    requireSecurityPermission('manageFinanceProtection'),
    (_req: Request, res: Response) => {
      const confirmedPayments = commerceDb.payments.filter((p) => p.status === 'confirmed');
      const paidOrders = commerceDb.orders.filter((o) => o.paymentStatus === 'paid');
      const findings: Array<{ type: string; entityId: string; detail: string }> = [];

      for (const p of confirmedPayments) {
        const o = commerceDb.orders.find((ord) => ord.id === p.orderId);
        if (!o || o.paymentStatus !== 'paid') {
          findings.push({ type: 'PAYMENT_CONFIRMED_ORDER_UNPAID', entityId: p.id, detail: `Paiement ${p.id} confirmé mais commande non marquée payée.` });
        } else if (o.total !== p.amountFcfa) {
          findings.push({ type: 'AMOUNT_MISMATCH', entityId: p.id, detail: `Écart montant paiement=${p.amountFcfa} vs commande=${o.total}.` });
        }
      }
      for (const o of paidOrders) {
        const p = commerceDb.payments.find((pay) => pay.id === o.paymentId);
        if (!p || p.status !== 'confirmed') {
          findings.push({ type: 'ORDER_PAID_WITHOUT_CONFIRMED_PAYMENT', entityId: o.id, detail: `Commande ${o.orderNumber} payée sans paiement confirmé.` });
        }
      }

      const sourceTotals = {
        confirmedPaymentsCount: confirmedPayments.length,
        confirmedPaymentsFcfa: confirmedPayments.reduce((s, p) => s + p.amountFcfa, 0),
        paidOrdersCount: paidOrders.length,
        paidOrdersFcfa: paidOrders.reduce((s, o) => s + o.total, 0)
      };
      const ledgerTotals = {
        withdrawalsCount: commerceDb.withdrawals.length,
        withdrawalsFcfa: commerceDb.withdrawals.reduce((s, w) => s + w.amountFcfa, 0),
        securityLedgerEntries: securityDb.financeLedger.length
      };
      const status = findings.length === 0 ? 'matched' : 'mismatch';
      void recordPgFinancialReconciliationRun({
        scope: 'all',
        status,
        sourceTotals,
        ledgerTotals,
        mismatchCount: findings.length,
        findings
      });

      return res.json({ success: true, status, mismatchCount: findings.length, sourceTotals, ledgerTotals, findings });
    }
  );

  // Admin manual payment verification (when real Mobile Money provider API keys are absent or offline)
  app.post(
    '/api/commerce/payments/:paymentId/confirm',
    requireSecurityPermission('manageFinanceProtection'),
    async (req: Request, res: Response) => {
      const caller = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
      const payment = commerceDb.payments.find((p) => p.id === req.params.paymentId);
      if (!payment) return res.status(404).json({ success: false, error: 'PAYMENT_NOT_FOUND' });
      const order = commerceDb.orders.find((o) => o.id === payment.orderId);
      if (!order) return res.status(404).json({ success: false, error: 'ORDER_NOT_FOUND' });

      if (payment.status === 'confirmed') {
        return res.json({ success: true, idempotent: true, payment, order });
      }

      const operatorRef = String(req.body?.providerReference || `ADM-VERIFIED-${Date.now().toString().slice(-6)}`);
      const prevPaymentStatus = payment.status;
      await applyOnlineOrderPaymentConfirmed(
        order,
        payment,
        'admin',
        caller?.token.email || 'admin@djassa.ci',
        operatorRef
      );
      persistCommerceDb();

      void syncPgPaymentStatusUpdate({
        paymentId: payment.id,
        orderId: order.id,
        provider: payment.provider,
        providerReference: payment.providerReference,
        previousStatus: prevPaymentStatus,
        nextStatus: 'confirmed',
        source: 'admin',
        providerStatus: 'MANUAL_CONFIRMED',
        eventKey: `manual-confirm:${payment.id}:${Date.now()}`,
        amountFcfa: payment.amountFcfa,
        payerPhoneMasked: maskPhoneNumber(order.deliveryAddress.phone)
      });

      appendAuditEntry({
        actorId: caller?.token.uid || 'admin',
        actorName: caller?.token.name || 'Administrateur',
        actorAccountLabel: caller?.token.email || 'admin@djassa.ci',
        actorRole: 'admin',
        space: 'admin',
        category: 'payments',
        actionType: 'manual_payment_confirmed',
        action: `Paiement #${order.orderNumber} vérifié manuellement`,
        target: payment.id,
        targetType: 'finance',
        entityType: 'payment',
        entityId: payment.id,
        result: 'reussi',
        severity: 'moyen',
        beforeValue: 'pending',
        afterValue: `confirmed (${operatorRef})`,
        details: `Montant ${payment.amountFcfa} FCFA confirmé manuellement • Commission ${order.commissionFcfa} FCFA encaissée`,
        ipAddress: getClientIp(req)
      });

      return res.json({ success: true, payment, order });
    }
  );

  app.patch('/api/commerce/orders/:id/status', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const order = commerceDb.orders.find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'ORDER_NOT_FOUND' });

    const { status } = req.body || {};
    const role = authCtx.token.spaceRole;
    const isAdmin = role === 'admin';
    const isOwnerSeller = role === 'seller' && (order.sellerId === authCtx.token.tenantId || order.sellerId === authCtx.token.uid);
    const isOwnerClient = role === 'client' && order.clientId === authCtx.token.uid;

    if (status === 'cancelled') {
      if (!isOwnerClient && !isOwnerSeller && !isAdmin) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN_ORDER_CANCEL' });
      }
      if (order.status === 'cancelled') {
        return res.json({ success: true, idempotent: true, order: formatScopedOrderDto(order, role) });
      }

      const prevStatus = order.status;
      order.status = 'cancelled';
      order.commissionStatus = 'cancelled';
      restoreOrderStock(order);
      const commissionReversed = reverseOrderSettlementAndCommissions(order, authCtx.token.name, 'Annulation commande');
      order.updatedAt = new Date().toISOString();
      order.trackingEvents.push({
        status: 'cancelled',
        label: 'Commande annulée — Stock restauré et commission annulée',
        time: order.updatedAt,
        done: true
      });
      persistCommerceDb();
      void recordPgOrderStatusTransition({
        orderId: order.id,
        fromStatus: prevStatus,
        toStatus: 'cancelled',
        commissionStatus: 'cancelled',
        note: 'Annulation, restitution stock et annulation commission'
      });
      return res.json({
        success: true,
        order: formatScopedOrderDto(order, role),
        stockRestored: order.stockRestored,
        commissionReversed
      });
    }

    return res.status(400).json({ success: false, error: 'INVALID_STATUS_TRANSITION' });
  });
  // --------------------------------------------------------------------------
  // 4. ANCIENNES ROUTES LIVREURS & ENTREPRISES SUPPRIMÉES (410 GONE)
  // --------------------------------------------------------------------------
  app.all(['/api/commerce/delivery', '/api/commerce/delivery/*', '/api/commerce/deliveries', '/api/commerce/deliveries/*'], (_req: Request, res: Response) => {
    return res.status(410).json({
      success: false,
      error: 'DELIVERY_SPACES_REMOVED',
      message: 'Les espaces Livreur et Entreprise de livraison ont été supprimés. Le vendeur organise sa livraison hors DJASSA.'
    });
  });

  // --------------------------------------------------------------------------
  // 4B. PARAMÈTRES ENCAISSEMENT VENDEUR, COMMISSIONS DJASSA & REÇUS OFFICIELS
  // --------------------------------------------------------------------------
  app.get('/api/commerce/seller/payout-settings', async (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const role = authCtx.token.spaceRole;
    if (role !== 'seller' && role !== 'admin') {
      return res.status(403).json({ success: false, error: 'SELLER_OR_ADMIN_REQUIRED' });
    }
    const targetSellerId = role === 'admin' && req.query.sellerId ? String(req.query.sellerId) : authCtx.token.tenantId || authCtx.token.uid;
    let settings = commerceDb.sellerPayoutAccounts[targetSellerId] || null;
    if (!settings) {
      const pgAcc = await getPgSellerPayoutAccount(targetSellerId).catch(() => null);
      if (pgAcc) {
        settings = {
          sellerId: pgAcc.seller_id,
          preferredChannel: pgAcc.preferred_channel,
          wavePhone: pgAcc.wave_phone || undefined,
          orangeMoneyPhone: pgAcc.orange_money_phone || undefined,
          accountHolderName: pgAcc.account_holder_name || undefined,
          updatedAt: pgAcc.updated_at
        };
      }
    }
    return res.json({ success: true, settings });
  });

  app.put('/api/commerce/seller/payout-settings', async (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const role = authCtx.token.spaceRole;
    if (role !== 'seller' && role !== 'admin') {
      return res.status(403).json({ success: false, error: 'SELLER_OR_ADMIN_REQUIRED' });
    }
    const targetSellerId = role === 'admin' && req.body?.sellerId ? String(req.body.sellerId) : authCtx.token.tenantId || authCtx.token.uid;
    const preferredChannel = req.body?.preferredChannel === 'orange_money' ? 'orange_money' : 'wave';
    const wavePhone = typeof req.body?.wavePhone === 'string' ? req.body.wavePhone.trim() : '';
    const orangeMoneyPhone = typeof req.body?.orangeMoneyPhone === 'string' ? req.body.orangeMoneyPhone.trim() : '';
    const accountHolderName = typeof req.body?.accountHolderName === 'string' ? req.body.accountHolderName.trim() : authCtx.token.name;

    const chosenPhone = preferredChannel === 'wave' ? wavePhone : orangeMoneyPhone;
    const digitsCount = chosenPhone.replace(/[^\d]/g, '').length;
    if (digitsCount < 8) {
      return res.status(400).json({
        success: false,
        error: 'VALID_PAYOUT_PHONE_REQUIRED',
        message: `Veuillez renseigner un numéro ${preferredChannel === 'wave' ? 'Wave' : 'Orange Money'} valide (au moins 8 chiffres).`
      });
    }

    const updated: ServerSellerPayoutSettings = {
      sellerId: targetSellerId,
      preferredChannel,
      ...(wavePhone ? { wavePhone } : {}),
      ...(orangeMoneyPhone ? { orangeMoneyPhone } : {}),
      ...(accountHolderName ? { accountHolderName } : {}),
      updatedAt: new Date().toISOString()
    };
    commerceDb.sellerPayoutAccounts[targetSellerId] = updated;
    persistCommerceDb();
    await upsertPgSellerPayoutAccount({
      sellerId: targetSellerId,
      preferredChannel,
      wavePhone: wavePhone || null,
      orangeMoneyPhone: orangeMoneyPhone || null,
      accountHolderName: accountHolderName || null
    });

    return res.json({ success: true, settings: updated });
  });

  app.get('/api/commerce/commissions', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const role = authCtx.token.spaceRole;
    if (role !== 'seller' && role !== 'admin') {
      return res.status(403).json({ success: false, error: 'SELLER_OR_ADMIN_REQUIRED' });
    }
    const scoped = getScopedOrders(authCtx);
    const summary = buildCommissionsSummary(scoped);
    const entries = scoped.map((o) => ({
      orderId: o.id,
      orderNumber: o.orderNumber,
      sellerId: o.sellerId,
      sellerName: o.sellerName,
      clientId: o.clientId,
      clientName: o.clientName,
      paymentMode: o.paymentMode,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      subtotal: o.subtotal,
      discount: o.discount,
      clientFeeFcfa: o.clientFeeFcfa,
      total: o.total,
      commissionFcfa: o.commissionFcfa,
      commissionStatus: o.commissionStatus,
      sellerNetFcfa: o.sellerNetFcfa,
      sellerPayoutStatus: o.sellerPayoutStatus,
      sellerPayoutReference: o.sellerPayoutReference || null,
      createdAt: o.createdAt
    }));
    const settlements =
      role === 'admin'
        ? commerceDb.commissionSettlements
        : commerceDb.commissionSettlements.filter((s) => s.sellerId === authCtx.token.tenantId || s.sellerId === authCtx.token.uid);

    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, summary, entries, settlements });
  });

  app.post('/api/commerce/commissions/:orderId/settle', async (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const role = authCtx.token.spaceRole;
    if (role !== 'seller' && role !== 'admin') {
      return res.status(403).json({ success: false, error: 'SELLER_OR_ADMIN_REQUIRED' });
    }
    const order = commerceDb.orders.find((o) => o.id === req.params.orderId);
    if (!order) return res.status(404).json({ success: false, error: 'ORDER_NOT_FOUND' });
    if (role === 'seller' && order.sellerId !== authCtx.token.tenantId && order.sellerId !== authCtx.token.uid) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN_COMMISSION_ACCESS' });
    }
    if (order.commissionStatus === 'cancelled' || order.status === 'cancelled') {
      return res.status(409).json({ success: false, error: 'COMMISSION_CANCELLED' });
    }
    if (order.commissionStatus === 'collected' || order.commissionStatus === 'paid') {
      return res.json({ success: true, idempotent: true, order: formatScopedOrderDto(order, role) });
    }

    const nowIso = new Date().toISOString();
    const channelRaw = req.body?.channel === 'orange_money' ? 'orange_money' : 'wave';
    const settlementId = `cset-${crypto.randomUUID().slice(0, 10)}`;

    // Admin manual verification (with real provider reference required)
    if (role === 'admin' && req.body?.verifiedManual === true) {
      const ref = String(req.body?.providerReference || '').trim();
      if (ref.length < 4) {
        return res.status(400).json({
          success: false,
          error: 'PROVIDER_REFERENCE_REQUIRED',
          message: 'Référence de transfert opérateur requise pour valider une commission payée.'
        });
      }
      order.commissionStatus = 'paid';
      order.updatedAt = nowIso;
      const settlement: ServerCommissionSettlement = {
        id: settlementId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        sellerId: order.sellerId,
        sellerName: order.sellerName,
        amountFcfa: order.commissionFcfa,
        channel: String(req.body?.channel || 'manual_verified'),
        providerReference: ref,
        status: 'paid',
        settledBy: authCtx.token.email,
        notes: req.body?.notes ? String(req.body.notes) : 'Règlement vérifié par administration',
        createdAt: nowIso
      };
      commerceDb.commissionSettlements.unshift(settlement);
      persistCommerceDb();
      void recordPgCommissionSettlement(settlement);
      void recordPgCommissionEntry({
        orderId: order.id,
        beneficiaryId: order.sellerId,
        beneficiaryRole: 'platform',
        commissionType: 'fixed_fcfa',
        basisAmountFcfa: order.subtotal - order.discount,
        commissionAmountFcfa: order.commissionFcfa,
        status: 'accrued',
        ledgerTransactionKey: `COMM-DJASSA-PAID-${order.orderNumber}`
      });
      return res.json({ success: true, order: formatScopedOrderDto(order, role), settlement });
    }

    // Real GeniusPay deposit collection for Seller paying pending COD commission
    if (!getGeniusPayConfig().configured) {
      return res.status(503).json({
        success: false,
        error: 'GENIUSPAY_NOT_CONFIGURED',
        message: 'Passerelle GeniusPay non configurée : le règlement automatique est impossible. Effectuez un transfert et demandez validation admin.'
      });
    }
    const payerPhone = String(req.body?.payerPhone || '').trim();
    if (payerPhone.replace(/[^\d]/g, '').length < 8) {
      return res.status(400).json({
        success: false,
        error: 'VALID_PHONE_REQUIRED',
        message: 'Numéro Mobile Money requis pour régler la commission.'
      });
    }
    const initRes = await initiateGeniusPayDeposit({
      depositId: settlementId,
      amountFcfa: order.commissionFcfa,
      provider: channelRaw,
      payerPhone,
      statementDescription: `COMM DJASSA ${order.orderNumber}`,
      metadata: { orderId: order.id, orderNumber: order.orderNumber, type: 'cod_commission' }
    });
    if (!initRes.ok) {
      return res.status(400).json({
        success: false,
        error: initRes.error || 'GENIUSPAY_DEPOSIT_FAILED',
        message: initRes.message || 'Échec initiation règlement commission.'
      });
    }
    // Keep commissionStatus === 'pending' until GeniusPay webhook confirms payment!
    const settlement: ServerCommissionSettlement = {
      id: settlementId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      sellerId: order.sellerId,
      sellerName: order.sellerName,
      amountFcfa: order.commissionFcfa,
      channel: channelRaw,
      providerReference: initRes.depositId || settlementId,
      status: 'pending_provider',
      settledBy: authCtx.token.email,
      notes: 'En attente de confirmation webhook GeniusPay',
      createdAt: nowIso
    };
    commerceDb.commissionSettlements.unshift(settlement);
    persistCommerceDb();
    void recordPgCommissionSettlement(settlement);
    return res.json({
      success: true,
      pendingConfirmation: true,
      ...(initRes.checkoutUrl ? { paymentUrl: initRes.checkoutUrl, checkoutUrl: initRes.checkoutUrl } : {}),
      settlement,
      order: formatScopedOrderDto(order, role)
    });
  });

  app.get('/api/commerce/orders/:id/receipt', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const role = authCtx.token.spaceRole;
    const order = getScopedOrders(authCtx).find((o) => o.id === req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'ORDER_NOT_FOUND' });

    const payment = commerceDb.payments.find((p) => p.id === order.paymentId) || null;
    const perspective = role === 'admin' ? 'admin' : role === 'seller' ? 'seller' : 'client';
    const isOnline = order.paymentMode !== 'cod';
    const merchandiseNet = Math.max(0, order.subtotal - order.discount);

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      perspective,
      receipt: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        transactionNumber: payment?.id || order.paymentId,
        providerReference: payment?.providerReference || null,
        date: order.createdAt,
        visibleStatus: VISIBLE_ORDER_STATUS,
        paymentMode: order.paymentMode,
        paymentModeLabel: isOnline ? 'Paiement en ligne' : 'Paiement à la livraison',
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        client: {
          id: order.clientId,
          name: order.deliveryAddress.recipientName || order.clientName,
          phone: order.deliveryAddress.phone
        },
        seller: {
          id: order.sellerId,
          name: order.sellerName
        },
        items: order.items,
        subtotal: order.subtotal,
        discount: order.discount,
        merchandiseNet,
        clientFeeFcfa: isOnline ? order.clientFeeFcfa : 0,
        clientFeeRatePercent: isOnline ? 6.5 : 0,
        totalPaidByClient: order.total,
        commissionFcfa: order.commissionFcfa,
        commissionStatus: order.commissionStatus,
        sellerNetFcfa: order.sellerNetFcfa,
        sellerPayoutStatus: order.sellerPayoutStatus,
        sellerPayoutReference: order.sellerPayoutReference || null,
        sellerPayoutChannel: order.sellerPayoutChannel || null,
        providerFeeFcfa: perspective === 'admin' ? order.providerFeeFcfa ?? null : undefined,
        codSellerNotice: !isOnline ? 'Le client paiera directement à la réception' : undefined,
        deliveryAddress: order.deliveryAddress,
        history: perspective === 'admin' ? order.trackingEvents : undefined
      }
    });
  });

  // --------------------------------------------------------------------------
  // 5. PORTEFEUILLES & RETRAITS SERVEUR AUTORITAIRES (Vendeur uniquement)
  // --------------------------------------------------------------------------
  app.get('/api/commerce/wallets/me', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const role = authCtx.token.spaceRole;
    const accountId = role === 'seller' ? authCtx.token.tenantId : authCtx.token.uid;
    const balanceFcfa = computeServerLedgerBalance(accountId);
    const ledger = securityDb.financeLedger.filter((e) => e.accountId === accountId).slice(0, 50);
    const withdrawals = commerceDb.withdrawals.filter((w) => w.accountId === accountId);

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      success: true,
      accountId,
      balanceFcfa,
      withdrawalFeeRate: commerceDb.platformConfig.withdrawalFeeRate,
      ledger,
      withdrawals
    });
  });

  app.post('/api/commerce/withdrawals', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const role = authCtx.token.spaceRole;
    if (role !== 'seller') {
      return res.status(403).json({
        success: false,
        error: 'SELLER_ROLE_REQUIRED',
        message: 'Seuls les vendeurs peuvent demander un retrait.'
      });
    }

    const accountId = authCtx.token.tenantId || authCtx.token.uid;
    const { amountFcfa, channel = 'Wave CI', payoutTarget, idempotencyKey } = req.body || {};
    const idemKey = String(idempotencyKey || req.header('x-idempotency-key') || '').trim();
    if (idemKey) {
      const existingWithdrawal = commerceDb.withdrawals.find(
        (w) => w.accountId === accountId && (w as ServerWithdrawalRecord & { idempotencyKey?: string }).idempotencyKey === idemKey
      );
      if (existingWithdrawal) {
        return res.json({
          success: true,
          idempotent: true,
          withdrawal: existingWithdrawal,
          newBalanceFcfa: computeServerLedgerBalance(accountId)
        });
      }
    }

    const amount = Math.round(Number(amountFcfa));
    if (!Number.isFinite(amount) || amount < 500) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_WITHDRAWAL_AMOUNT',
        message: 'Montant invalide (minimum 500 FCFA).'
      });
    }
    if (!payoutTarget || String(payoutTarget).trim().length < 6) {
      return res.status(400).json({
        success: false,
        error: 'PAYOUT_TARGET_REQUIRED',
        message: 'Numéro Mobile Money ou compte bénéficiaire requis.'
      });
    }

    const serverBalance = computeServerLedgerBalance(accountId);
    if (amount > serverBalance) {
      return res.status(400).json({
        success: false,
        error: 'INSUFFICIENT_SERVER_BALANCE',
        message: `Solde serveur insuffisant (${serverBalance.toLocaleString('fr-FR')} FCFA disponibles).`
      });
    }

    const quotas = getControlPlaneQuotas();
    const todayPrefix = new Date().toISOString().slice(0, 10);
    const withdrawnToday = commerceDb.withdrawals
      .filter((w) => w.accountId === accountId && w.status !== 'rejected' && w.createdAt.startsWith(todayPrefix))
      .reduce((sum, w) => sum + w.amountFcfa, 0);
    if (withdrawnToday + amount > quotas.maxDailyWithdrawalFcfa) {
      return res.status(429).json({
        success: false,
        error: 'DAILY_WITHDRAWAL_QUOTA_EXCEEDED',
        message: `Plafond journalier de retrait (${quotas.maxDailyWithdrawalFcfa.toLocaleString('fr-FR')} FCFA) dépassé.`
      });
    }

    const feeRate = Math.max(0, Number(commerceDb.platformConfig.withdrawalFeeRate ?? 10));
    const feeFcfa = Math.round((amount * feeRate) / 100);
    const netAmountFcfa = Math.max(0, amount - feeFcfa);
    const targetMasked = maskTarget(String(payoutTarget));
    const ref = `WD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    const isHighAmount = amount > (securityDb.settings.maxAutoWithdrawalFcfa || 150000);
    const suspicionReasons = isHighAmount
      ? [`Montant supérieur au plafond automatique (${(securityDb.settings.maxAutoWithdrawalFcfa || 150000).toLocaleString('fr-FR')} FCFA)`]
      : undefined;

    const nowIso = new Date().toISOString();
    securityDb.financeLedger.unshift({
      id: `led-${crypto.randomUUID()}`,
      accountId,
      accountEmail: authCtx.token.email,
      accountName: authCtx.token.name,
      spaceRole: role,
      type: isHighAmount ? 'hold' : 'debit',
      amountFcfa: amount,
      commissionFcfa: feeFcfa,
      channel: String(channel),
      payoutTarget: targetMasked,
      reference: ref,
      status: isHighAmount ? 'en_attente_verification' : 'valide',
      ...(suspicionReasons ? { suspicionReasons } : {}),
      device: `${authCtx.session.device} (${authCtx.session.browser})`,
      ipAddress: getClientIp(req),
      createdAt: nowIso
    });
    persistSecurityDb();

    const withdrawalRecord: ServerWithdrawalRecord & { idempotencyKey?: string } = {
      id: `wdr-${crypto.randomUUID().slice(0, 10)}`,
      accountId,
      accountEmail: authCtx.token.email,
      accountName: authCtx.token.name,
      role,
      amountFcfa: amount,
      feeFcfa,
      netAmountFcfa,
      channel: String(channel),
      payoutTargetMasked: targetMasked,
      ...(isHighAmount ? { payoutTargetRaw: String(payoutTarget) } : {}),
      reference: ref,
      status: isHighAmount ? 'held_security' : 'completed',
      ...(idemKey ? { idempotencyKey: idemKey } : {}),
      ...(suspicionReasons ? { suspicionReasons } : {}),
      createdAt: nowIso
    };

    if (isHighAmount) {
      const approval = enqueueTwoPersonApprovalRequest({
        actionKey: 'withdrawal_release',
        resourceType: 'withdrawal',
        resourceId: withdrawalRecord.id,
        requestedById: authCtx.token.uid,
        requestedByEmail: authCtx.token.email,
        requestPayload: {
          accountId,
          role,
          amountFcfa: amount,
          feeFcfa,
          netAmountFcfa,
          channel: String(channel),
          payoutTargetMasked: targetMasked,
          reference: ref
        }
      });
      withdrawalRecord.approvalId = approval.id;
    }

    if (!isHighAmount && getGeniusPayConfig().configured) {
      const chLower = String(channel).toLowerCase();
      const mappedProv = chLower.includes('wave')
        ? 'wave'
        : chLower.includes('orange')
        ? 'orange_money'
        : chLower.includes('mtn') || chLower.includes('momo')
        ? 'mtn_momo'
        : null;
      if (mappedProv) {
        void initiateGeniusPayPayout({
          payoutId: withdrawalRecord.id,
          amountFcfa: netAmountFcfa,
          provider: mappedProv,
          recipientPhone: String(payoutTarget),
          statementDescription: `RETRAIT ${ref}`
        }).then((payoutRes) => {
          withdrawalRecord.geniusPayPayoutStatus = payoutRes.status;
          if (!payoutRes.ok && payoutRes.status === 'failed' && withdrawalRecord.status === 'completed') {
            withdrawalRecord.status = 'failed';
            const ts = new Date().toISOString();
            securityDb.financeLedger.unshift({
              id: `led-payout-initfail-${crypto.randomUUID().slice(0, 8)}`,
              accountId,
              accountEmail: authCtx.token.email,
              accountName: authCtx.token.name,
              spaceRole: role,
              type: 'credit',
              amountFcfa: amount,
              commissionFcfa: 0,
              channel: String(channel),
              payoutTarget: targetMasked,
              reference: `INIT-FAIL-${ref}`,
              status: 'valide',
              suspicionReasons: [`Recrédit automatique : rejet initiation GeniusPay (${payoutRes.error || 'failed'})`],
              createdAt: ts
            });
            persistSecurityDb();
            void recordPgWalletLedgerEntry({
              accountId,
              transactionKey: `INIT-FAIL-${ref}`,
              entryType: 'credit',
              amountFcfa: amount,
              status: 'posted',
              referenceType: 'withdrawal',
              referenceId: `withdrawal:${withdrawalRecord.id}`,
              description: `Recrédit échec initiation GeniusPay ${ref}`
            });
          }
          persistCommerceDb();
          void syncWithdrawalToPostgres(withdrawalRecord);
        });
      }
    }

    commerceDb.withdrawals.unshift(withdrawalRecord);
    persistCommerceDb();
    void syncWithdrawalToPostgres(withdrawalRecord);
    void recordPgWalletLedgerEntry({
      accountId,
      transactionKey: ref,
      entryType: isHighAmount ? 'hold' : 'debit',
      amountFcfa: amount,
      status: isHighAmount ? 'pending' : 'posted',
      referenceType: 'withdrawal',
      referenceId: `withdrawal:${withdrawalRecord.id}`,
      description: `Retrait ${channel} (${targetMasked})`,
      idempotencyKey: idemKey || ref
    });

    const newBalance = computeServerLedgerBalance(accountId);
    appendAuditEntry({
      actorId: authCtx.token.uid,
      actorName: authCtx.token.name,
      actorAccountLabel: authCtx.token.email,
      actorRole: role,
      space: role,
      category: 'wallets',
      actionType: isHighAmount ? 'withdrawal_held_security' : 'withdrawal_completed',
      action: isHighAmount ? 'Retrait mis en attente de contrôle sécurité' : 'Retrait serveur exécuté',
      target: ref,
      targetType: 'finance',
      entityType: 'withdrawal',
      entityId: withdrawalRecord.id,
      result: 'reussi',
      severity: isHighAmount ? 'eleve' : 'information',
      beforeValue: `${serverBalance} FCFA`,
      afterValue: `${newBalance} FCFA`,
      details: `${amount} FCFA (Frais ${feeFcfa} FCFA • Net ${netAmountFcfa} FCFA vers ${targetMasked})`,
      ipAddress: getClientIp(req)
    });

    const { payoutTargetRaw: _omitRaw, ...safeWithdrawal } = withdrawalRecord;
    return res.json({
      success: true,
      withdrawal: safeWithdrawal,
      ...(withdrawalRecord.approvalId ? { approvalId: withdrawalRecord.approvalId } : {}),
      newBalanceFcfa: newBalance
    });
  });

  app.get('/api/commerce/withdrawals/:id/payout-status', async (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const w = commerceDb.withdrawals.find((cand) => cand.id === req.params.id);
    if (!w) return res.status(404).json({ success: false, error: 'WITHDRAWAL_NOT_FOUND' });
    const myAccount = authCtx.token.tenantId || authCtx.token.uid;
    if (authCtx.token.spaceRole !== 'admin' && w.accountId !== myAccount) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN_WITHDRAWAL_ACCESS' });
    }
    const status = await fetchGeniusPayPayoutStatus(w.id);
    return res.json({ success: true, withdrawal: w, geniusPayStatus: status });
  });

  // --------------------------------------------------------------------------
  // 6. MESSAGERIE & NOTIFICATIONS PERSISTANTES
  // --------------------------------------------------------------------------
  app.get('/api/commerce/chat/conversations', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const uid = authCtx.token.uid;
    const tenantId = authCtx.token.tenantId;
    const list = commerceDb.conversations.filter(
      (c) => authCtx.token.spaceRole === 'admin' || c.participantIds.includes(uid) || c.participantIds.includes(tenantId)
    );
    return res.json({ success: true, conversations: list });
  });

  app.get('/api/commerce/chat/:conversationId/messages', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const conv = commerceDb.conversations.find((c) => c.id === req.params.conversationId);
    if (!conv) return res.status(404).json({ success: false, error: 'CONVERSATION_NOT_FOUND' });

    const isParticipant =
      authCtx.token.spaceRole === 'admin' ||
      conv.participantIds.includes(authCtx.token.uid) ||
      conv.participantIds.includes(authCtx.token.tenantId);
    if (!isParticipant) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN_CONVERSATION_ACCESS' });
    }

    return res.json({
      success: true,
      conversation: conv,
      messages: commerceDb.messages[conv.id] || []
    });
  });

  app.post('/api/commerce/chat/:conversationId/messages', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    let conv = commerceDb.conversations.find((c) => c.id === req.params.conversationId);
    const body = String(req.body?.body || '').trim();
    if (!body) {
      return res.status(400).json({ success: false, error: 'EMPTY_MESSAGE' });
    }

    if (!conv) {
      const targetParticipantId = String(req.body?.recipientId || '').trim();
      const linkedOrderId = req.body?.orderId ? String(req.body.orderId).trim() : undefined;
      if (!targetParticipantId) {
        return res.status(404).json({ success: false, error: 'CONVERSATION_NOT_FOUND' });
      }
      if (authCtx.token.spaceRole !== 'admin' && targetParticipantId !== 'support-djassa') {
        const hasBusinessLink = linkedOrderId
          ? commerceDb.orders.some(
              (o) =>
                o.id === linkedOrderId &&
                [o.clientId, o.sellerId].includes(authCtx.token.uid || authCtx.token.tenantId) &&
                [o.clientId, o.sellerId].includes(targetParticipantId)
            )
          : commerceDb.products.some((p) => p.sellerId === targetParticipantId) ||
            commerceDb.orders.some(
              (o) =>
                [o.clientId, o.sellerId].includes(authCtx.token.uid || authCtx.token.tenantId) &&
                [o.clientId, o.sellerId].includes(targetParticipantId)
            );
        if (!hasBusinessLink) {
          return res.status(403).json({
            success: false,
            error: 'FORBIDDEN_CONVERSATION_CREATE',
            message: 'Conversation autorisée uniquement entre participants légitimes (boutique, support ou commande partagée).'
          });
        }
      }
      conv = {
        id: req.params.conversationId,
        participantIds: Array.from(new Set([authCtx.token.uid, authCtx.token.tenantId, targetParticipantId])),
        title: String(req.body?.title || 'Discussion DJASSA'),
        ...(linkedOrderId ? { orderId: linkedOrderId } : {}),
        lastMessage: body,
        updatedAt: new Date().toISOString()
      };
      commerceDb.conversations.unshift(conv);
    } else {
      const isParticipant =
        authCtx.token.spaceRole === 'admin' ||
        conv.participantIds.includes(authCtx.token.uid) ||
        conv.participantIds.includes(authCtx.token.tenantId);
      if (!isParticipant) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN_CONVERSATION_SEND' });
      }
    }

    const allowedTypes = ['text', 'image', 'audio', 'video', 'location', 'order'];
    const msgType = typeof req.body?.type === 'string' && allowedTypes.includes(req.body.type) ? req.body.type : 'text';
    const mediaUrl = typeof req.body?.mediaUrl === 'string' ? req.body.mediaUrl.slice(0, 2_500_000) : undefined;
    const meta = req.body?.meta && typeof req.body.meta === 'object' ? (req.body.meta as Record<string, unknown>) : undefined;

    const msg: ServerMessage = {
      id: `msg-${crypto.randomUUID().slice(0, 10)}`,
      conversationId: conv.id,
      senderId: authCtx.token.uid,
      senderName: authCtx.token.name,
      senderRole: authCtx.token.spaceRole,
      body: body.slice(0, 2000),
      type: msgType,
      ...(mediaUrl ? { mediaUrl } : {}),
      ...(meta ? { meta } : {}),
      createdAt: new Date().toISOString()
    };

    if (!commerceDb.messages[conv.id]) commerceDb.messages[conv.id] = [];
    commerceDb.messages[conv.id].push(msg);
    conv.lastMessage = msg.body;
    conv.updatedAt = msg.createdAt;
    persistCommerceDb();
    void syncPgChatMessage({
      conversationId: conv.id,
      participantIds: conv.participantIds,
      title: conv.title,
      messageId: msg.id,
      senderId: msg.senderId,
      body: msg.body,
      messageType: msgType === 'image' || msgType === 'video' || msgType === 'audio' ? msgType : 'text'
    });

    return res.status(201).json({ success: true, message: msg, conversation: conv });
  });

  app.post('/api/commerce/notifications/read-all', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    for (const n of commerceDb.notifications) {
      if (n.userId === authCtx.token.uid || n.userId === authCtx.token.tenantId || n.targetRoles?.includes(authCtx.token.spaceRole)) {
        n.read = true;
      }
    }
    persistCommerceDb();
    return res.json({ success: true });
  });
}
