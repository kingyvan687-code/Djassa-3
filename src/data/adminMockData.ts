import { AdminAuditLog, AdminUserRecord, PlatformConfig } from '../types';

export const INITIAL_PLATFORM_CONFIG: PlatformConfig = {
  marketplaceCommissionRate: 150,
  sellerCommissionRate: 150,
  clientOnlineFeeRate: 6.5,
  withdrawalFeeRate: 10,
  baseDeliveryFee: 0,
  minWithdrawalAmount: 2000,
  maintenanceMode: false,
  globalBannerMessage: '',
  enableWavePayments: true,
  enableOrangeMoney: true,
  enableMtnMomo: false,
  requireKycForSellers: true
};

export const INITIAL_ADMIN_USERS: AdminUserRecord[] = [
  {
    id: 'client-demo-1',
    name: 'Koffi Mariam',
    username: '@koffi_mariam',
    email: 'client@djassa.ci',
    phone: '+225 07 08 09 10 11',
    role: 'client',
    status: 'active',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
    createdAt: '2026-09-12T10:00:00.000Z',
    location: 'Cocody, Abidjan',
    deliveryCommune: 'Cocody',
    ordersCount: 6,
    totalSpentOrEarned: 142500,
    kycVerified: true
  },
  {
    id: 'seller-1',
    name: 'Boutique Wax & Élégance',
    storeName: 'Boutique Wax & Élégance',
    username: '@wax_elegance_ci',
    email: 'vendeur@djassa.ci',
    phone: '+225 05 44 22 11 00',
    role: 'seller',
    status: 'active',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
    createdAt: '2026-08-05T09:00:00.000Z',
    location: 'Adjamé, Abidjan',
    ordersCount: 142,
    totalSpentOrEarned: 3450000,
    kycVerified: true
  },
  {
    id: 'sec-super-admin',
    name: 'Kouassi Yves',
    email: 'admin@djassa.ci',
    phone: '+225 07 00 00 00 01',
    role: 'admin',
    status: 'active',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200',
    createdAt: '2026-01-10T08:00:00.000Z',
    location: 'Plateau, Abidjan',
    ordersCount: 0,
    totalSpentOrEarned: 0,
    kycVerified: true
  }
];

export const INITIAL_AUDIT_LOGS: AdminAuditLog[] = [
  {
    id: 'audit-init-1',
    adminName: 'Kouassi Yves',
    action: 'Configuration commission fixe 150 FCFA',
    target: 'Plateforme DJASSA',
    category: 'financial',
    timestamp: new Date().toISOString(),
    details: 'Commission fixe 150 FCFA par commande vendeur + frais de paiement en ligne client 6,5% (0% en paiement à la livraison).'
  }
];

export interface SubscriptionTransaction {
  id: string;
  subscriberName: string;
  subscriberRole: 'client' | 'seller';
  avatar?: string;
  planName: string;
  planBadge: string;
  amount: number;
  date: string;
  paymentMethod: 'Wave' | 'Orange Money' | 'MTN MoMo' | 'Carte Bancaire';
  creditsGranted?: number;
  status: 'completed' | 'active';
  reference: string;
}

export interface WithdrawalRequest {
  id: string;
  name: string;
  role: 'seller';
  amount: number;
  feeAmount: number;
  netAmount: number;
  phone: string;
  network: 'Wave' | 'Orange Money' | 'MTN MoMo' | 'Moov Money';
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  reference?: string;
}

export const INITIAL_SUBSCRIPTIONS: SubscriptionTransaction[] = [
  {
    id: 'SUB-2026-101',
    subscriberName: 'Boutique Wax & Élégance (Adjamé)',
    subscriberRole: 'seller',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
    planName: 'Vendeur Pro Marché',
    planBadge: 'Mensuel Vendeur',
    amount: 8900,
    date: '16 Oct 2026, 09:14',
    paymentMethod: 'Wave',
    creditsGranted: 900,
    status: 'active',
    reference: 'WAVE-SUB-9941'
  },
  {
    id: 'SUB-2026-103',
    subscriberName: 'Amina Kouamé',
    subscriberRole: 'client',
    avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200',
    planName: 'DJASSA Premium',
    planBadge: 'Mensuel Client',
    amount: 1200,
    date: '14 Oct 2026, 18:22',
    paymentMethod: 'Orange Money',
    creditsGranted: 120,
    status: 'active',
    reference: 'OM-SUB-4412'
  },
  {
    id: 'SUB-2026-104',
    subscriberName: 'Adjamé High-Tech Store',
    subscriberRole: 'seller',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    planName: 'Pack Créateur 750 Crédits',
    planBadge: 'Recharge IA',
    amount: 5000,
    date: '14 Oct 2026, 11:05',
    paymentMethod: 'Wave',
    creditsGranted: 750,
    status: 'completed',
    reference: 'WAVE-SUB-8120'
  },
  {
    id: 'SUB-2026-105',
    subscriberName: 'Marcory Bazin VIP',
    subscriberRole: 'seller',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
    planName: 'Vendeur VIP Adjamé',
    planBadge: 'Mensuel Vendeur',
    amount: 14900,
    date: '13 Oct 2026, 10:45',
    paymentMethod: 'Wave',
    creditsGranted: 1600,
    status: 'active',
    reference: 'WAVE-SUB-7711'
  },
  {
    id: 'SUB-2026-106',
    subscriberName: 'Fatou Traoré',
    subscriberRole: 'client',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
    planName: 'DJASSA Plus',
    planBadge: 'Mensuel Client',
    amount: 600,
    date: '12 Oct 2026, 16:15',
    paymentMethod: 'Wave',
    creditsGranted: 60,
    status: 'active',
    reference: 'WAVE-SUB-5510'
  }
];

export const INITIAL_WITHDRAWALS: WithdrawalRequest[] = [
  {
    id: 'WTH-8821',
    name: 'Boutique Wax & Élégance (Adjamé)',
    role: 'seller',
    amount: 150000,
    feeAmount: 10050,
    netAmount: 139950,
    phone: '+225 07 48 99 12 34',
    network: 'Wave',
    date: 'Aujourd’hui 14:12',
    status: 'pending',
    reference: 'WAVE-CI-7712'
  },
  {
    id: 'WTH-8819',
    name: 'Adjamé High-Tech Store',
    role: 'seller',
    amount: 320000,
    feeAmount: 21270,
    netAmount: 298730,
    phone: '+225 05 55 44 33 22',
    network: 'Orange Money',
    date: 'Hier 18:45',
    status: 'pending',
    reference: 'OM-CI-9901'
  },
  {
    id: 'WTH-8817',
    name: 'Kouassi Cuir & Chaussures',
    role: 'seller',
    amount: 180000,
    feeAmount: 12030,
    netAmount: 167970,
    phone: '+225 07 12 34 56 78',
    network: 'Wave',
    date: '14 Oct 16:30',
    status: 'approved',
    reference: 'WAVE-CI-5502'
  }
];
