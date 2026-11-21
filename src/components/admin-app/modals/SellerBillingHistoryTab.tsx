import React, { useMemo, useState } from 'react';
import {
  Crown,
  Megaphone,
  CheckCircle2,
  Clock,
  Calendar,
  CreditCard,
  Download,
  Search,
  Eye,
  MousePointerClick,
  ShoppingCart,
  ShoppingBag,
  TrendingUp,
  Receipt,
  Sparkles,
  X,
  PauseCircle,
  XCircle,
  Check,
  Store,
  MapPin,
  Wallet
} from 'lucide-react';
import { AdminBoostCampaign, AdminUserRecord, BoostPlacement, Product, Seller } from '../../../types';
import { INITIAL_BOOST_CAMPAIGNS } from '../../../data/advertisingMockData';
import { formatFCFA } from '../../../services/marketServices';

export interface SellerPaidSubscriptionItem {
  id: string;
  planId: string;
  planName: string;
  badge: string;
  amountPaidFCFA: number;
  paymentMethod: 'Wave' | 'Orange Money' | 'MTN MoMo' | 'Carte Bancaire';
  reference: string;
  paidAtDate: string;
  paidAtTime: string;
  periodStart: string;
  periodEnd: string;
  creditsTotal: number;
  creditsRemaining: number;
  status: 'active' | 'expired' | 'renewed';
  autoRenew: boolean;
  features: string[];
}

export interface SellerPaidAdItem {
  id: string;
  title: string;
  targetType: 'product' | 'seller';
  targetName: string;
  targetImage: string;
  placement: BoostPlacement;
  placementLabel: string;
  targetZones: string[];
  amountPaidFCFA: number;
  paymentMethod: 'Wave' | 'Orange Money' | 'MTN MoMo';
  reference: string;
  paidAtDate: string;
  paidAtTime: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  remainingDays: number;
  status: 'active' | 'paused' | 'completed';
  impressionsCount: number;
  clicksCount: number;
  cartAdditionsCount: number;
  ordersCount: number;
  revenueGeneratedFCFA: number;
}

interface StoredSubscriberShape {
  id: string;
  name: string;
  role: 'client' | 'seller';
  phone: string;
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
}

type SelectedReceipt =
  | { kind: 'subscription'; item: SellerPaidSubscriptionItem }
  | { kind: 'ad'; item: SellerPaidAdItem };

interface SellerBillingHistoryTabProps {
  user: AdminUserRecord;
  seller: Seller;
  sellerProducts: Product[];
  onShowToast: (msg: string) => void;
}

const getPlacementLabel = (placement: BoostPlacement): string => {
  switch (placement) {
    case 'hero_banner':
      return 'Carrousel Accueil VIP';
    case 'search_top':
      return 'Top 1 Résultat Recherche';
    case 'sponsored_badge':
      return 'Badge Sponsorisé / Flash 24h';
    case 'push_notification':
      return 'Alerte Push Flash';
    case 'all':
      return 'Pack Visibilité Totale 360°';
    default:
      return 'Campagne Publicitaire';
  }
};

const getPlanFeatures = (planId: string): string[] => {
  if (planId.includes('elite')) {
    return [
      '1 800 crédits IA mensuels inclus',
      '200 questions IA vendeur & audit catalogue',
      '80 shootings studio 4K + 18 vidéos RodiumAI Pro',
      'Badge Boutique Recommandée Djassa'
    ];
  }
  if (planId.includes('starter')) {
    return [
      '450 crédits IA mensuels inclus',
      '50 questions IA vendeur & calcul de marge',
      '20 images studio catalogue + 3 vidéos RodiumAI 5s'
    ];
  }
  return [
    '900 crédits IA mensuels inclus',
    '100 questions IA vendeur & bilan de semaine',
    '40 images catalogue 4K + 8 vidéos défilés RodiumAI'
  ];
};

const normalizePhone = (value?: string): string => (value || '').replace(/\D/g, '');
const normalizeText = (value?: string): string =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const computeRemainingDays = (endDateStr: string, fallbackDays: number): number => {
  const end = new Date(endDateStr);
  if (Number.isNaN(end.getTime())) return Math.max(0, fallbackDays);
  const ref = new Date('2026-11-06');
  const diff = Math.ceil(
    (new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime() -
      new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  return Math.max(0, diff);
};

export const useSellerBillingHistoryData = (
  user: AdminUserRecord,
  seller: Seller,
  sellerProducts: Product[]
) => {
  const subscriptions = useMemo<SellerPaidSubscriptionItem[]>(() => {
    const cleanPhone = normalizePhone(user.phone || seller.phone);
    const cleanNames = [user.storeName, user.name, seller.name]
      .map(normalizeText)
      .filter(Boolean);

    let storedSubs: StoredSubscriberShape[] = [];
    try {
      const raw = localStorage.getItem('djassa_admin_subscriber_profiles');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) storedSubs = parsed;
      }
    } catch {
      storedSubs = [];
    }

    const matchedStored = storedSubs.filter((sub) => {
      if (sub.role !== 'seller') return false;
      if (cleanPhone && normalizePhone(sub.phone) === cleanPhone) return true;
      const subName = normalizeText(sub.name);
      return cleanNames.some((n) => n && (subName.includes(n) || n.includes(subName)));
    });

    const mappedFromStorage: SellerPaidSubscriptionItem[] = matchedStored.map((sub, idx) => {
      const isCompleted = sub.status === 'completed' || sub.status === 'overdue';
      return {
        id: `seller-sub-live-${sub.id}-${idx}`,
        planId: sub.planId,
        planName: sub.planName,
        badge: sub.planId.includes('elite')
          ? 'MARQUES & GROSSISTES'
          : sub.planId.includes('starter')
          ? 'LANCEMENT BOUTIQUE'
          : 'FORMULE PRO MARCHÉ',
        amountPaidFCFA: sub.amountPaid,
        paymentMethod: sub.paymentMethod,
        reference: `DJ-SUB-${sub.id.toUpperCase().replace(/[^A-Z0-9]/g, '')}-2026`,
        paidAtDate: sub.startDate,
        paidAtTime: sub.purchaseTime || '10:15',
        periodStart: sub.startDate,
        periodEnd: sub.renewalDate,
        creditsTotal: sub.creditsTotal,
        creditsRemaining: isCompleted ? 0 : sub.creditsRemaining,
        status: isCompleted ? 'expired' : 'active',
        autoRenew: sub.autoRenew,
        features: getPlanFeatures(sub.planId)
      };
    });

    // If seller is brand new and pending verification without stored subscription, keep empty or starter
    const isVeryNewSeller = Boolean(user.isNew && (user.registeredDaysAgo ?? 0) <= 7 && (user.ordersCount ?? 0) < 20);
    if (isVeryNewSeller && mappedFromStorage.length === 0) {
      return [
        {
          id: `seller-sub-new-${user.id}`,
          planId: 'vendeur_starter',
          planName: 'Vendeur Starter',
          badge: 'LANCEMENT BOUTIQUE',
          amountPaidFCFA: 4500,
          paymentMethod: 'Orange Money',
          reference: `OM-SUB-${(user.id || 'NEW').slice(-4).toUpperCase()}-0908`,
          paidAtDate: '08 Sept 2026',
          paidAtTime: '14:18',
          periodStart: '08 Sept 2026',
          periodEnd: '08 Oct 2026',
          creditsTotal: 450,
          creditsRemaining: 390,
          status: 'active',
          autoRenew: true,
          features: getPlanFeatures('vendeur_starter')
        }
      ];
    }

    const baseActive = mappedFromStorage[0];
    const seedCode = (seller.id || user.id || 'SEL').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-4);

    const historicalCycles: SellerPaidSubscriptionItem[] = [
      ...(baseActive
        ? []
        : [
            {
              id: `seller-sub-curr-${user.id}`,
              planId: 'vendeur_pro',
              planName: 'Vendeur Pro Marché',
              badge: 'FORMULE PRO MARCHÉ',
              amountPaidFCFA: 8900,
              paymentMethod: 'Wave' as const,
              reference: `WAV-SUB-${seedCode}-1101`,
              paidAtDate: '01 Nov 2026',
              paidAtTime: '09:42',
              periodStart: '01 Nov 2026',
              periodEnd: '01 Déc 2026',
              creditsTotal: 900,
              creditsRemaining: 620,
              status: 'active' as const,
              autoRenew: true,
              features: getPlanFeatures('vendeur_pro')
            }
          ]),
      {
        id: `seller-sub-hist-1-${user.id}`,
        planId: 'vendeur_pro',
        planName: 'Vendeur Pro Marché',
        badge: 'RENOUVELLEMENT MENSUEL',
        amountPaidFCFA: 8900,
        paymentMethod: 'Wave',
        reference: `WAV-SUB-${seedCode}-1001`,
        paidAtDate: '01 Oct 2026',
        paidAtTime: '09:15',
        periodStart: '01 Oct 2026',
        periodEnd: '01 Nov 2026',
        creditsTotal: 900,
        creditsRemaining: 0,
        status: 'renewed',
        autoRenew: true,
        features: getPlanFeatures('vendeur_pro')
      },
      {
        id: `seller-sub-hist-2-${user.id}`,
        planId: 'vendeur_pro',
        planName: 'Vendeur Pro Marché',
        badge: 'RENOUVELLEMENT MENSUEL',
        amountPaidFCFA: 8900,
        paymentMethod: 'Orange Money',
        reference: `OM-SUB-${seedCode}-0901`,
        paidAtDate: '01 Sept 2026',
        paidAtTime: '11:04',
        periodStart: '01 Sept 2026',
        periodEnd: '01 Oct 2026',
        creditsTotal: 900,
        creditsRemaining: 0,
        status: 'expired',
        autoRenew: false,
        features: getPlanFeatures('vendeur_pro')
      },
      {
        id: `seller-sub-hist-3-${user.id}`,
        planId: 'vendeur_starter',
        planName: 'Vendeur Starter',
        badge: 'PREMIER ABONNEMENT',
        amountPaidFCFA: 4500,
        paymentMethod: 'MTN MoMo',
        reference: `MTN-SUB-${seedCode}-0801`,
        paidAtDate: '01 Août 2026',
        paidAtTime: '16:28',
        periodStart: '01 Août 2026',
        periodEnd: '01 Sept 2026',
        creditsTotal: 450,
        creditsRemaining: 0,
        status: 'expired',
        autoRenew: false,
        features: getPlanFeatures('vendeur_starter')
      }
    ];

    return [...mappedFromStorage, ...historicalCycles];
  }, [user, seller]);

  const paidAds = useMemo<SellerPaidAdItem[]>(() => {
    let campaigns: AdminBoostCampaign[] = INITIAL_BOOST_CAMPAIGNS;
    try {
      const saved = localStorage.getItem('djassa_admin_boost_campaigns');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          campaigns = parsed;
        }
      }
    } catch {
      campaigns = INITIAL_BOOST_CAMPAIGNS;
    }

    const sellerIdsToMatch = new Set<string>([seller.id, user.id]);
    if (user.id === 'user-seller-1') sellerIdsToMatch.add('seller-1');
    if (user.id === 'user-seller-2') sellerIdsToMatch.add('seller-2');

    const cleanSellerNames = [seller.name, user.storeName, user.name]
      .map(normalizeText)
      .filter(Boolean);

    const matchedCampaigns = campaigns.filter((camp) => {
      if (camp.isFreeAdminGrant || camp.budgetFCFA <= 0) return false;
      if (camp.sellerId && sellerIdsToMatch.has(camp.sellerId)) return true;
      if (camp.targetType === 'seller' && sellerIdsToMatch.has(camp.targetId)) return true;
      const campSellerName = normalizeText(camp.sellerName);
      return cleanSellerNames.some(
        (n) => n && (campSellerName.includes(n) || n.includes(campSellerName))
      );
    });

    const methods: Array<'Wave' | 'Orange Money' | 'MTN MoMo'> = ['Wave', 'Orange Money', 'MTN MoMo'];

    if (matchedCampaigns.length > 0) {
      return matchedCampaigns.map((camp, index) => {
        const remDays =
          camp.status === 'completed'
            ? 0
            : computeRemainingDays(camp.endDate, camp.remainingDays);
        const resolvedStatus: 'active' | 'paused' | 'completed' =
          camp.status === 'completed' || remDays <= 0
            ? 'completed'
            : camp.status === 'paused'
            ? 'paused'
            : 'active';

        const createdDateObj = new Date(camp.createdAt);
        const paidDate = !Number.isNaN(createdDateObj.getTime())
          ? createdDateObj.toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            })
          : camp.startDate;
        const paidTime = !Number.isNaN(createdDateObj.getTime())
          ? createdDateObj.toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit'
            })
          : '10:30';

        return {
          id: camp.id,
          title: camp.title,
          targetType: camp.targetType,
          targetName: camp.targetName,
          targetImage: camp.targetImage,
          placement: camp.placement,
          placementLabel: getPlacementLabel(camp.placement),
          targetZones: camp.targetZones || ['Abidjan'],
          amountPaidFCFA: camp.budgetFCFA,
          paymentMethod: methods[index % methods.length],
          reference: `PUB-${camp.id.toUpperCase().replace(/[^A-Z0-9]/g, '')}-CI`,
          paidAtDate: paidDate,
          paidAtTime: paidTime,
          startDate: camp.startDate,
          endDate: camp.endDate,
          durationDays: camp.durationDays,
          remainingDays: remDays,
          status: resolvedStatus,
          impressionsCount: camp.impressionsCount,
          clicksCount: camp.clicksCount,
          cartAdditionsCount: camp.cartAdditionsCount,
          ordersCount: camp.ordersCount,
          revenueGeneratedFCFA: camp.revenueGeneratedFCFA
        };
      });
    }

    // Fallback when opening a seller with no campaigns in localStorage yet:
    // Use the seller's own real products if established, or empty if brand new
    const isVeryNewSeller = Boolean(user.isNew && (user.registeredDaysAgo ?? 0) <= 7 && (user.ordersCount ?? 0) < 20);
    if (isVeryNewSeller) {
      return [];
    }

    const p1 = sellerProducts[0];
    const p2 = sellerProducts[1] || sellerProducts[0];
    const fallbackAds: SellerPaidAdItem[] = [];

    if (p1) {
      fallbackAds.push({
        id: `ad-derived-1-${seller.id}`,
        title: `Top 1 Recherche : ${p1.name}`,
        targetType: 'product',
        targetName: p1.name,
        targetImage: p1.images?.[0] || seller.avatar,
        placement: 'search_top',
        placementLabel: getPlacementLabel('search_top'),
        targetZones: ['Cocody', 'Adjamé', 'Plateau'],
        amountPaidFCFA: 3000,
        paymentMethod: 'Wave',
        reference: `PUB-${seller.id.toUpperCase().slice(-4)}-1104`,
        paidAtDate: '04 Nov 2026',
        paidAtTime: '11:20',
        startDate: '2026-11-04',
        endDate: '2026-11-07',
        durationDays: 3,
        remainingDays: 1,
        status: 'active',
        impressionsCount: 28400,
        clicksCount: 3120,
        cartAdditionsCount: 385,
        ordersCount: 94,
        revenueGeneratedFCFA: 94 * (p1.price || 15000)
      });
    }

    if (p2) {
      fallbackAds.push({
        id: `ad-derived-2-${seller.id}`,
        title: `Flash 24h : ${p2.name}`,
        targetType: 'product',
        targetName: p2.name,
        targetImage: p2.images?.[0] || seller.avatar,
        placement: 'sponsored_badge',
        placementLabel: getPlacementLabel('sponsored_badge'),
        targetZones: ['Toutes les communes'],
        amountPaidFCFA: 500,
        paymentMethod: 'Orange Money',
        reference: `PUB-${seller.id.toUpperCase().slice(-4)}-1018`,
        paidAtDate: '18 Oct 2026',
        paidAtTime: '15:05',
        startDate: '2026-10-18',
        endDate: '2026-10-19',
        durationDays: 1,
        remainingDays: 0,
        status: 'completed',
        impressionsCount: 11850,
        clicksCount: 1090,
        cartAdditionsCount: 148,
        ordersCount: 37,
        revenueGeneratedFCFA: 37 * (p2.price || 12000)
      });
    }

    return fallbackAds;
  }, [user, seller, sellerProducts]);

  return { subscriptions, paidAds };
};

export const SellerBillingHistoryTab: React.FC<SellerBillingHistoryTabProps> = ({
  user,
  seller,
  sellerProducts,
  onShowToast
}) => {
  const { subscriptions: initialSubs, paidAds } = useSellerBillingHistoryData(
    user,
    seller,
    sellerProducts
  );

  const [extraSubs, setExtraSubs] = useState<SellerPaidSubscriptionItem[]>([]);
  const [sectionFilter, setSectionFilter] = useState<'all' | 'subscriptions' | 'ads'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'ended'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<SelectedReceipt | null>(null);

  const subscriptions = useMemo(
    () => [...extraSubs, ...initialSubs],
    [extraSubs, initialSubs]
  );

  const totalSubscriptionsFCFA = useMemo(
    () => subscriptions.reduce((sum, s) => sum + s.amountPaidFCFA, 0),
    [subscriptions]
  );

  const totalAdsFCFA = useMemo(
    () => paidAds.reduce((sum, a) => sum + a.amountPaidFCFA, 0),
    [paidAds]
  );

  const totalSpentFCFA = totalSubscriptionsFCFA + totalAdsFCFA;
  const activeAdsCount = paidAds.filter((a) => a.status === 'active').length;
  const activeSub = subscriptions.find((s) => s.status === 'active');
  const totalAdsRevenueFCFA = useMemo(
    () => paidAds.reduce((sum, a) => sum + a.revenueGeneratedFCFA, 0),
    [paidAds]
  );

  const filteredSubscriptions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return subscriptions.filter((sub) => {
      if (statusFilter === 'active' && sub.status !== 'active') return false;
      if (statusFilter === 'ended' && sub.status === 'active') return false;
      if (!q) return true;
      return (
        sub.planName.toLowerCase().includes(q) ||
        sub.reference.toLowerCase().includes(q) ||
        sub.paymentMethod.toLowerCase().includes(q) ||
        sub.paidAtDate.toLowerCase().includes(q)
      );
    });
  }, [subscriptions, statusFilter, searchQuery]);

  const filteredAds = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return paidAds.filter((ad) => {
      if (statusFilter === 'active' && ad.status !== 'active') return false;
      if (statusFilter === 'ended' && ad.status === 'active') return false;
      if (!q) return true;
      return (
        ad.title.toLowerCase().includes(q) ||
        ad.targetName.toLowerCase().includes(q) ||
        ad.placementLabel.toLowerCase().includes(q) ||
        ad.reference.toLowerCase().includes(q) ||
        ad.paymentMethod.toLowerCase().includes(q)
      );
    });
  }, [paidAds, statusFilter, searchQuery]);

  const handleExportCsv = () => {
    const headers = [
      'Type',
      'Libelle',
      'Categorie',
      'Montant_FCFA',
      'Moyen_Paiement',
      'Reference',
      'Date_Paiement',
      'Heure_Paiement',
      'Periode',
      'Statut'
    ];
    const subRows = subscriptions.map((s) => [
      'Abonnement Vendeur',
      s.planName,
      s.badge,
      String(s.amountPaidFCFA),
      s.paymentMethod,
      s.reference,
      s.paidAtDate,
      s.paidAtTime,
      `${s.periodStart} - ${s.periodEnd}`,
      s.status === 'active' ? 'Actif' : s.status === 'renewed' ? 'Renouvelé' : 'Expiré'
    ]);
    const adRows = paidAds.map((a) => [
      'Publicité Payée',
      a.targetName,
      a.placementLabel,
      String(a.amountPaidFCFA),
      a.paymentMethod,
      a.reference,
      a.paidAtDate,
      a.paidAtTime,
      `${a.startDate} - ${a.endDate}`,
      a.status === 'active' ? 'En diffusion' : a.status === 'paused' ? 'En pause' : 'Expirée'
    ]);

    const csvContent = [headers, ...subRows, ...adRows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historique_paiements_${seller.username || 'vendeur'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    onShowToast('Historique abonnements & publicités exporté en CSV');
  };

  const handleGrantMonthlyPack = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const newSub: SellerPaidSubscriptionItem = {
      id: `seller-sub-grant-${Date.now()}`,
      planId: 'vendeur_pro',
      planName: 'Vendeur Pro Marché',
      badge: 'ACTIVATION ADMIN',
      amountPaidFCFA: 8900,
      paymentMethod: 'Wave',
      reference: `ADM-SUB-${Date.now().toString().slice(-6)}`,
      paidAtDate: dateStr,
      paidAtTime: timeStr,
      periodStart: dateStr,
      periodEnd: nextMonth,
      creditsTotal: 900,
      creditsRemaining: 900,
      status: 'active',
      autoRenew: false,
      features: getPlanFeatures('vendeur_pro')
    };
    setExtraSubs((prev) => [newSub, ...prev]);
    onShowToast(`Abonnement Vendeur Pro Marché ajouté pour ${seller.name}`);
  };

  const handleDownloadReceiptText = (receipt: SelectedReceipt) => {
    const lines: string[] = [
      'DJASSA MARKETPLACE — REÇU DE PAIEMENT VENDEUR',
      '================================================',
      `Boutique : ${seller.name}`,
      `Responsable : ${user.name}`,
      `Téléphone : ${user.phone || seller.phone}`,
      ''
    ];
    if (receipt.kind === 'subscription') {
      const s = receipt.item;
      lines.push(
        `Nature : Abonnement Boutique`,
        `Formule : ${s.planName}`,
        `Référence : ${s.reference}`,
        `Date et heure de paiement : ${s.paidAtDate} à ${s.paidAtTime}`,
        `Période de validité : Du ${s.periodStart} au ${s.periodEnd}`,
        `Crédits IA inclus : ${s.creditsTotal} crédits`,
        `Moyen de paiement : ${s.paymentMethod}`,
        `Montant payé : ${formatFCFA(s.amountPaidFCFA)}`,
        `Statut : ${s.status === 'active' ? 'Actif' : s.status === 'renewed' ? 'Renouvelé' : 'Expiré'}`
      );
    } else {
      const a = receipt.item;
      lines.push(
        `Nature : Campagne Publicitaire Payée`,
        `Produit / Cible : ${a.targetName}`,
        `Type de publicité : ${a.placementLabel}`,
        `Zones ciblées : ${a.targetZones.join(', ')}`,
        `Référence : ${a.reference}`,
        `Date et heure de paiement : ${a.paidAtDate} à ${a.paidAtTime}`,
        `Période de diffusion : Du ${a.startDate} au ${a.endDate} (${a.durationDays} jours)`,
        `Moyen de paiement : ${a.paymentMethod}`,
        `Montant payé : ${formatFCFA(a.amountPaidFCFA)}`,
        `Performances : ${a.impressionsCount.toLocaleString()} vues | ${a.clicksCount.toLocaleString()} clics | ${a.cartAdditionsCount.toLocaleString()} ajouts panier | ${a.ordersCount} commandes`
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recu_${receipt.item.reference}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    onShowToast('Reçu téléchargé');
  };

  return (
    <div id="seller-billing-history-page" className="space-y-5 max-w-5xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#141417] border border-white/10 rounded-3xl p-4 sm:p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Crown className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white">
                Historique Abonnements & Publicités Payées
              </h3>
              <p className="text-xs text-white/50 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-[#FF6321]" />
                <span>{seller.name}</span>
                <span>•</span>
                <span>{seller.location}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Exporter CSV</span>
          </button>

          <button
            type="button"
            onClick={handleGrantMonthlyPack}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-amber-500/10"
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Ajouter un Abonnement</span>
          </button>
        </div>
      </div>

      {/* KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setSectionFilter('all')}
          className={`text-left p-4 rounded-2xl border transition cursor-pointer ${
            sectionFilter === 'all'
              ? 'bg-emerald-500/10 border-emerald-500/40'
              : 'bg-[#141417] border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] text-white/60 font-semibold">
            <span>Total payé par le vendeur</span>
            <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-400 font-mono mt-1">
            {formatFCFA(totalSpentFCFA)}
          </div>
          <span className="text-[10px] text-white/45 block mt-0.5">
            {subscriptions.length + paidAds.length} paiements enregistrés
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSectionFilter('subscriptions')}
          className={`text-left p-4 rounded-2xl border transition cursor-pointer ${
            sectionFilter === 'subscriptions'
              ? 'bg-amber-500/10 border-amber-500/40'
              : 'bg-[#141417] border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] text-white/60 font-semibold">
            <span>Abonnements payés</span>
            <Crown className="w-4 h-4 text-amber-400 shrink-0" />
          </div>
          <div className="text-base sm:text-lg font-black text-white font-mono mt-1">
            {formatFCFA(totalSubscriptionsFCFA)}
          </div>
          <span className="text-[10px] text-amber-300/90 font-semibold block mt-0.5 truncate">
            {subscriptions.length} cycle{subscriptions.length > 1 ? 's' : ''} •{' '}
            {activeSub ? activeSub.planName : 'Aucun actif'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSectionFilter('ads')}
          className={`text-left p-4 rounded-2xl border transition cursor-pointer ${
            sectionFilter === 'ads'
              ? 'bg-[#FF6321]/10 border-[#FF6321]/40'
              : 'bg-[#141417] border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] text-white/60 font-semibold">
            <span>Publicités payées</span>
            <Megaphone className="w-4 h-4 text-[#FF6321] shrink-0" />
          </div>
          <div className="text-base sm:text-lg font-black text-white font-mono mt-1">
            {formatFCFA(totalAdsFCFA)}
          </div>
          <span className="text-[10px] text-[#FF6321] font-semibold block mt-0.5">
            {paidAds.length} pub{paidAds.length > 1 ? 's' : ''} • {activeAdsCount} en diffusion
          </span>
        </button>

        <div className="p-4 rounded-2xl bg-[#141417] border border-white/10">
          <div className="flex items-center justify-between text-[11px] text-white/60 font-semibold">
            <span>CA généré par les pubs</span>
            <TrendingUp className="w-4 h-4 text-cyan-400 shrink-0" />
          </div>
          <div className="text-base sm:text-lg font-black text-cyan-400 font-mono mt-1">
            {formatFCFA(totalAdsRevenueFCFA)}
          </div>
          <span className="text-[10px] text-white/45 block mt-0.5">
            {paidAds.reduce((sum, a) => sum + a.ordersCount, 0)} commandes attribuées
          </span>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-[#141417] border border-white/10 rounded-2xl p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'all' as const, label: `Tout (${subscriptions.length + paidAds.length})` },
            { id: 'subscriptions' as const, label: `Abonnements (${subscriptions.length})` },
            { id: 'ads' as const, label: `Publicités (${paidAds.length})` }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSectionFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                sectionFilter === tab.id
                  ? 'bg-amber-500 text-black font-black'
                  : 'bg-white/5 text-white/65 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl p-1">
            {[
              { id: 'all' as const, label: 'Tous' },
              { id: 'active' as const, label: 'En cours' },
              { id: 'ended' as const, label: 'Expirés / Terminés' }
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  statusFilter === st.id
                    ? 'bg-white/15 text-white'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher formule, produit, réf..."
              className="w-full sm:w-56 pl-8 pr-7 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-white/40 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 1: HISTORIQUE DES ABONNEMENTS PAYÉS PAR LE VENDEUR */}
      {(sectionFilter === 'all' || sectionFilter === 'subscriptions') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <span>Historique des abonnements payés par le vendeur</span>
            </h4>
            <span className="text-xs font-mono text-amber-300 font-bold">
              {filteredSubscriptions.length} abonnement{filteredSubscriptions.length > 1 ? 's' : ''}
            </span>
          </div>

          {filteredSubscriptions.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-[#141417] border border-white/10 text-xs text-white/50">
              Aucun abonnement correspondant aux filtres sélectionnés.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredSubscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-[#141417] border border-white/10 hover:border-amber-500/35 rounded-3xl p-4 space-y-3 transition"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono block">
                        {sub.badge}
                      </span>
                      <h5 className="text-sm font-black text-white truncate mt-0.5">
                        {sub.planName}
                      </h5>
                      <span className="text-[11px] text-white/45 font-mono block">
                        Réf : {sub.reference}
                      </span>
                    </div>

                    {sub.status === 'active' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        Actif
                      </span>
                    ) : sub.status === 'renewed' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shrink-0">
                        <Check className="w-3 h-3" />
                        Renouvelé
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-white/10 text-white/60 border border-white/15 shrink-0">
                        <Clock className="w-3 h-3" />
                        Expiré
                      </span>
                    )}
                  </div>

                  {/* Montant + Paiement */}
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-black/40 border border-white/5 text-xs">
                    <div>
                      <span className="text-[10px] text-white/45 block">Montant payé</span>
                      <span className="text-sm font-black text-emerald-400 font-mono">
                        {formatFCFA(sub.amountPaidFCFA)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-white/45 block">Moyen</span>
                      <span className="text-xs font-bold text-white flex items-center gap-1 mt-0.5">
                        <CreditCard className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span className="truncate">{sub.paymentMethod}</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-white/45 block">Crédits IA</span>
                      <span className="text-xs font-black text-amber-300 font-mono">
                        {sub.creditsRemaining}/{sub.creditsTotal}
                      </span>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/60 font-mono">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-white/40" />
                      Payé le {sub.paidAtDate} à {sub.paidAtTime}
                    </span>
                    <span className="text-white/45">
                      Valide : {sub.periodStart} → {sub.periodEnd}
                    </span>
                  </div>

                  {/* Avantages clés */}
                  <div className="space-y-1 pt-1 border-t border-white/5">
                    {sub.features.slice(0, 3).map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-[11px] text-white/70">
                        <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="truncate">{feat}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[10px] text-white/45">
                      Renouvellement auto : {sub.autoRenew ? 'Activé' : 'Désactivé'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedReceipt({ kind: 'subscription', item: sub })}
                      className="px-3 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Voir reçu</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* SECTION 2: HISTORIQUE DES PUBLICITÉS PAYÉES PAR LE VENDEUR */}
      {(sectionFilter === 'all' || sectionFilter === 'ads') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-[#FF6321]" />
              <span>Historique des publicités payées par le vendeur</span>
            </h4>
            <span className="text-xs font-mono text-[#FF6321] font-bold">
              {filteredAds.length} publicité{filteredAds.length > 1 ? 's' : ''}
            </span>
          </div>

          {filteredAds.length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-[#141417] border border-white/10 text-xs text-white/50 space-y-1">
              <p className="font-bold text-white/75">Aucune publicité payée trouvée</p>
              <p>Ce vendeur n’a pas encore acheté de campagne publicitaire correspondant aux filtres.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAds.map((ad) => (
                <div
                  key={ad.id}
                  className="bg-[#141417] border border-white/10 hover:border-[#FF6321]/40 rounded-3xl p-4 space-y-3.5 transition"
                >
                  {/* Top row: Image, Title, Type de pub, Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <img
                        src={ad.targetImage}
                        alt={ad.targetName}
                        className="w-14 h-14 rounded-2xl object-cover border border-white/10 shrink-0 bg-neutral-900"
                      />
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-lg bg-[#FF6321]/15 border border-[#FF6321]/30 text-[#FF6321] text-[10px] font-black">
                            {ad.placementLabel}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-[10px] font-semibold">
                            {ad.targetType === 'product' ? 'Produit sponsorisé' : 'Boutique mise en avant'}
                          </span>
                        </div>
                        <h5 className="text-sm font-black text-white truncate">
                          {ad.targetName}
                        </h5>
                        <p className="text-[11px] text-white/45 truncate">
                          {ad.title} • Réf : <span className="font-mono">{ad.reference}</span>
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {ad.status === 'active' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" />
                          En diffusion ({ad.remainingDays}j rest.)
                        </span>
                      )}
                      {ad.status === 'paused' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          <PauseCircle className="w-3 h-3" />
                          En pause ({ad.remainingDays}j rest.)
                        </span>
                      )}
                      {ad.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-white/10 text-white/60 border border-white/15">
                          <XCircle className="w-3 h-3" />
                          Expirée / Terminée
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Financial & Schedule Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-2xl bg-black/40 border border-white/5 text-xs">
                    <div>
                      <span className="text-[10px] text-white/45 block">Montant payé</span>
                      <span className="text-sm font-black text-emerald-400 font-mono">
                        {formatFCFA(ad.amountPaidFCFA)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-white/45 block">Paiement</span>
                      <span className="text-xs font-bold text-white">{ad.paymentMethod}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-white/45 block">Payé le</span>
                      <span className="text-xs font-mono text-white/85">
                        {ad.paidAtDate} • {ad.paidAtTime}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-white/45 block">Durée campagne</span>
                      <span className="text-xs font-mono text-white/85">
                        {ad.durationDays} jour{ad.durationDays > 1 ? 's' : ''} ({ad.startDate} → {ad.endDate})
                      </span>
                    </div>
                  </div>

                  {/* Performance Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <div>
                        <span className="text-[10px] text-white/45 block">Vues</span>
                        <span className="font-mono font-black text-white">
                          {ad.impressionsCount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-2">
                      <MousePointerClick className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <div>
                        <span className="text-[10px] text-white/45 block">Clics</span>
                        <span className="font-mono font-black text-white">
                          {ad.clicksCount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-2">
                      <ShoppingCart className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <div>
                        <span className="text-[10px] text-white/45 block">Mis au panier</span>
                        <span className="font-mono font-black text-white">
                          {ad.cartAdditionsCount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-2">
                      <ShoppingBag className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <div>
                        <span className="text-[10px] text-white/45 block">Commandes / CA</span>
                        <span className="font-mono font-black text-emerald-400">
                          {ad.ordersCount} ({formatFCFA(ad.revenueGeneratedFCFA)})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Zones & Receipt Button */}
                  <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="text-white/50 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      Zones : {ad.targetZones.join(', ')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedReceipt({ kind: 'ad', item: ad })}
                      className="px-3 py-1 rounded-xl bg-[#FF6321]/15 hover:bg-[#FF6321]/25 border border-[#FF6321]/30 text-[#FF6321] font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Voir reçu</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* MODAL REÇU DE PAIEMENT (SOBRE, SANS EMOJIS NI PHOTOS) */}
      {selectedReceipt && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            className="w-full max-w-md bg-[#141417] border border-white/15 rounded-3xl p-5 space-y-4 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h4 className="text-sm font-black text-white">
                  Reçu de Paiement Officiel
                </h4>
                <p className="text-[11px] text-white/50 font-mono">
                  Réf : {selectedReceipt.item.reference}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/50">Boutique vendeur</span>
                <span className="font-bold text-white text-right">{seller.name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/50">Responsable</span>
                <span className="font-semibold text-white text-right">{user.name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/50">Téléphone</span>
                <span className="font-mono text-white text-right">{user.phone || seller.phone}</span>
              </div>

              {selectedReceipt.kind === 'subscription' ? (
                <>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-white/50">Nature du paiement</span>
                    <span className="font-bold text-amber-300">Abonnement Vendeur</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-white/50">Formule</span>
                    <span className="font-bold text-white">{selectedReceipt.item.planName}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-white/50">Date et heure de paiement</span>
                    <span className="font-mono text-white">
                      {selectedReceipt.item.paidAtDate} à {selectedReceipt.item.paidAtTime}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-white/50">Période de validité</span>
                    <span className="font-mono text-white">
                      {selectedReceipt.item.periodStart} → {selectedReceipt.item.periodEnd}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-white/50">Crédits attribués</span>
                    <span className="font-mono text-white">
                      {selectedReceipt.item.creditsTotal} crédits
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-white/50">Nature du paiement</span>
                    <span className="font-bold text-[#FF6321]">Publicité Sponsorisée</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-white/50">Type de publicité</span>
                    <span className="font-bold text-white text-right">
                      {selectedReceipt.item.placementLabel}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5 gap-3">
                    <span className="text-white/50 shrink-0">Produit / Cible</span>
                    <span className="font-bold text-white text-right">
                      {selectedReceipt.item.targetName}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-white/50">Date et heure de paiement</span>
                    <span className="font-mono text-white">
                      {selectedReceipt.item.paidAtDate} à {selectedReceipt.item.paidAtTime}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-white/50">Période de diffusion</span>
                    <span className="font-mono text-white">
                      {selectedReceipt.item.startDate} → {selectedReceipt.item.endDate} ({selectedReceipt.item.durationDays}j)
                    </span>
                  </div>
                </>
              )}

              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/50">Moyen de paiement</span>
                <span className="font-bold text-white">{selectedReceipt.item.paymentMethod}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-white/70 font-bold">Montant total payé</span>
                <span className="text-base font-black text-emerald-400 font-mono">
                  {formatFCFA(selectedReceipt.item.amountPaidFCFA)}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleDownloadReceiptText(selectedReceipt)}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger le reçu</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
