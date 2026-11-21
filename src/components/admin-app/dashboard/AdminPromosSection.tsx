import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Play, 
  Pause, 
  Clock, 
  Calendar, 
  MousePointer, 
  Percent, 
  DollarSign, 
  Store, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Filter, 
  Tag, 
  ArrowUpRight, 
  Crown, 
  Flame, 
  Zap, 
  Download, 
  Layers, 
  ShoppingBag, 
  Edit3, 
  ChevronRight, 
  Check,
  RotateCcw,
  Sliders,
  Share2,
  ExternalLink,
  Sparkles,
  History,
  Smartphone,
  Home,
  Eye
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { formatFCFA } from '../../../services/marketServices';
import { getSecurityToken, securityService } from '../../../services/securityService';
import { INITIAL_BOOST_CAMPAIGNS } from '../../../data/advertisingMockData';
import { AdminBoostCampaign, BoostPlacement } from '../../../types';
import { AdminBoostDetailModal } from '../modals/AdminBoostDetailModal';
import { AdminCreateBoostModal } from '../modals/AdminCreateBoostModal';

// =============================================================================
// TYPES & PROMO CODES DEFINITIONS
// =============================================================================

export interface PromoCode {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number; // e.g. 10 (%) or 1500 (FCFA)
  minOrderAmount: number;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  active: boolean;
}

export interface BoostPricingPackage {
  id: BoostPlacement;
  title: string;
  badge: string;
  description: string;
  dailyRateFCFA: number;
  recommendedDurationDays: number;
  totalPackageFCFA: number;
  estimatedReach: string;
  highlightColor: string;
}

const INITIAL_PROMO_CODES: PromoCode[] = [
  {
    id: 'promo-1',
    code: 'DJASSA10',
    type: 'percentage',
    value: 10,
    minOrderAmount: 10000,
    maxUses: 500,
    usedCount: 238,
    expiresAt: '30 Sept 2026',
    active: true
  },
  {
    id: 'promo-2',
    code: 'LIVRAISON500',
    type: 'fixed',
    value: 500,
    minOrderAmount: 5000,
    maxUses: 1000,
    usedCount: 712,
    expiresAt: '15 Oct 2026',
    active: true
  },
  {
    id: 'promo-3',
    code: 'VAKANSE225',
    type: 'percentage',
    value: 15,
    minOrderAmount: 20000,
    maxUses: 200,
    usedCount: 198,
    expiresAt: '10 Sept 2026',
    active: false
  }
];

const DEFAULT_BOOST_PRICING: BoostPricingPackage[] = [
  {
    id: 'hero_banner',
    title: "Carrousel Accueil VIP",
    badge: "👑 Visibilité Maximale",
    description: "Bannière grand format en première position de l'accueil de l'application",
    dailyRateFCFA: 3500,
    recommendedDurationDays: 10,
    totalPackageFCFA: 35000,
    estimatedReach: "50 000 - 80 000 vues",
    highlightColor: "from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30"
  },
  {
    id: 'search_top',
    title: "Top 1 Résultat Recherche",
    badge: "🔥 Priorité Algorithmique",
    description: "Le produit apparaît en 1ère position dès qu'un acheteur tape des mots-clés associés",
    dailyRateFCFA: 5000,
    recommendedDurationDays: 3,
    totalPackageFCFA: 15000,
    estimatedReach: "25 000 - 40 000 recherches",
    highlightColor: "from-purple-500/20 to-indigo-500/20 text-purple-400 border-purple-500/30"
  },
  {
    id: 'sponsored_badge',
    title: "Badge Produit Sponsorisé & Cadre Doré",
    badge: "✨ Badge Confiance",
    description: "Bordure dorée animée et macaron 'Sponsorisé' dans tous les catalogues de la commune",
    dailyRateFCFA: 2850,
    recommendedDurationDays: 7,
    totalPackageFCFA: 20000,
    estimatedReach: "20 000 - 35 000 affichages",
    highlightColor: "from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30"
  },
  {
    id: 'push_notification',
    title: "Alerte Push Flash Abidjan",
    badge: "⚡ Notification Directe",
    description: "Envoi ciblé sur le smartphone des acheteurs actifs dans les communes ciblées",
    dailyRateFCFA: 5000,
    recommendedDurationDays: 2,
    totalPackageFCFA: 10000,
    estimatedReach: "15 000 - 25 000 alertes",
    highlightColor: "from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/30"
  },
  {
    id: 'all',
    title: "Pack Visibilité Totale 360°",
    badge: "🚀 Pack Intégral",
    description: "Activation combinée : Carrousel Accueil + Top Recherche + Badge Doré + Push",
    dailyRateFCFA: 3570,
    recommendedDurationDays: 14,
    totalPackageFCFA: 50000,
    estimatedReach: "100 000+ interactions",
    highlightColor: "from-[#FF6321]/20 to-rose-500/20 text-[#FF6321] border-[#FF6321]/40"
  }
];

// Helper to calculate remaining days between an end date and reference date (default: 2026-11-06)
export const calculateRemainingDays = (endDateStr?: string, refDateStr: string = '2026-11-06'): number => {
  if (!endDateStr) return 0;
  try {
    const end = new Date(endDateStr);
    const ref = new Date(refDateStr);
    if (isNaN(end.getTime()) || isNaN(ref.getTime())) return 0;
    const endMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    const refMidnight = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime();
    const diffMs = endMidnight - refMidnight;
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
};

export interface CampaignResolvedState {
  status: 'active' | 'completed' | 'paused';
  isExpired: boolean;
  remainingDays: number;
  label: string;
  badgeText: string;
  badgeClass: string;
  progressPercent: number;
}

// Single source of truth for campaign status
export const getCampaignResolvedState = (camp: AdminBoostCampaign, refDateStr: string = '2026-11-06'): CampaignResolvedState => {
  const calculatedRemaining = calculateRemainingDays(camp.endDate, refDateStr);
  const isPastEndDate = calculatedRemaining <= 0;

  // 1. If explicit status is 'completed' or end date is past or remainingDays <= 0
  if (camp.status === 'completed' || isPastEndDate || (camp.remainingDays !== undefined && camp.remainingDays <= 0)) {
    return {
      status: 'completed',
      isExpired: true,
      remainingDays: 0,
      label: 'Terminé',
      badgeText: 'Période expirée',
      badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
      progressPercent: 100
    };
  }

  // 2. If status is paused and not expired
  if (camp.status === 'paused') {
    const remainingDays = calculatedRemaining > 0 ? calculatedRemaining : Math.max(1, camp.remainingDays || 1);
    const totalDays = Math.max(camp.durationDays || 1, remainingDays);
    const elapsed = Math.max(0, totalDays - remainingDays);
    const progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100)));
    return {
      status: 'paused',
      isExpired: false,
      remainingDays,
      label: 'En pause',
      badgeText: 'Diffusion suspendue',
      badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      progressPercent
    };
  }

  // 3. Active campaign with positive remaining days
  const remainingDays = calculatedRemaining > 0 ? calculatedRemaining : Math.max(1, camp.remainingDays || 1);
  const totalDays = Math.max(camp.durationDays || 1, remainingDays);
  const elapsed = Math.max(0, totalDays - remainingDays);
  const progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100)));
  return {
    status: 'active',
    isExpired: false,
    remainingDays,
    label: 'En diffusion',
    badgeText: 'En diffusion active',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    progressPercent
  };
};

// Helper to determine if a boost campaign has expired (past date, 0 days remaining, or completed)
export const isCampaignExpired = (c: AdminBoostCampaign): boolean => {
  return getCampaignResolvedState(c).isExpired;
};

export const AdminPromosSection: React.FC = () => {
  const { addAuditLog, showToast } = useApp();

  // Active Sub-Tab: 'boosts' (default) | 'revenues' | 'pricing' | 'promos'
  const [activeSubTab, setActiveSubTab] = useState<'boosts' | 'revenues' | 'pricing' | 'promos'>('boosts');

  // Boost Campaigns state synchronized with localStorage
  const [campaigns, setCampaigns] = useState<AdminBoostCampaign[]>(() => {
    const saved = localStorage.getItem('djassa_admin_boost_campaigns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 10) {
          const hasOldData = parsed.some((c: AdminBoostCampaign) => 
            c.startDate?.includes('2026-09-') || 
            c.startDate?.includes('2026-08-') || 
            c.startDate === '2026-10-18' ||
            c.startDate === '2026-10-19'
          );
          const hasBoost10 = parsed.some((c: AdminBoostCampaign) => c.id === 'boost-10');
          if (!hasOldData && hasBoost10) {
            return parsed.map((c: AdminBoostCampaign) => {
              const state = getCampaignResolvedState(c);
              return { 
                ...c, 
                status: state.status, 
                remainingDays: state.remainingDays 
              };
            });
          }
        }
      } catch (e) {
        // fallback
      }
    }
    const initial = INITIAL_BOOST_CAMPAIGNS.map(c => {
      const state = getCampaignResolvedState(c);
      return {
        ...c,
        status: state.status,
        remainingDays: state.remainingDays
      };
    });
    localStorage.setItem('djassa_admin_boost_campaigns', JSON.stringify(initial));
    return initial;
  });

  // Promo codes state
  const [promos, setPromos] = useState<PromoCode[]>(() => {
    try {
      const saved = localStorage.getItem('djassa_admin_promos');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : INITIAL_PROMO_CODES;
    } catch {
      return INITIAL_PROMO_CODES;
    }
  });

  // Pricing packages state
  const [pricingPackages, setPricingPackages] = useState<BoostPricingPackage[]>(() => {
    try {
      const saved = localStorage.getItem('djassa_admin_boost_pricing');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : DEFAULT_BOOST_PRICING;
    } catch {
      return DEFAULT_BOOST_PRICING;
    }
  });

  // Filters for Boosts view
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'completed'>('all');
  const [placementFilter, setPlacementFilter] = useState<string>('all');
  const [targetTypeFilter, setTargetTypeFilter] = useState<'all' | 'product' | 'seller'>('all');

  // Modals state
  const [selectedCampaignForDetail, setSelectedCampaignForDetail] = useState<AdminBoostCampaign | null>(null);
  const [showCreateBoostModal, setShowCreateBoostModal] = useState(false);
  const [createBoostInitialPlacement, setCreateBoostInitialPlacement] = useState<BoostPlacement | undefined>(undefined);
  const [createBoostInitialDays, setCreateBoostInitialDays] = useState<number | undefined>(undefined);

  // Active tab for the 3 promo packages ("onglets")
  const [activeBoostPackageTab, setActiveBoostPackageTab] = useState<'all' | 'flash' | 'search' | 'vip'>('all');

  // 4 Status Tabs ('active' | 'completed' | 'paused' | 'history')
  const [statusTab, setStatusTab] = useState<'active' | 'completed' | 'paused' | 'history'>('active');

  const handleOpenCreateBoost = (placement?: BoostPlacement, days?: number) => {
    setCreateBoostInitialPlacement(placement);
    setCreateBoostInitialDays(days);
    setShowCreateBoostModal(true);
  };

  const [showAddPromoModal, setShowAddPromoModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<BoostPricingPackage | null>(null);

  // New Promo form state
  const [newPromo, setNewPromo] = useState({
    code: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: 10,
    minOrderAmount: 5000,
    maxUses: 100,
    expiresAt: '31 Déc 2026'
  });

  // Helper to format clean French dates (e.g. "18 oct. → 25 oct.")
  const formatFriendlyDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length < 3) return dateStr;
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
      const monthName = months[m - 1] || `${m}`;
      return `${d} ${monthName}`;
    } catch {
      return dateStr;
    }
  };

  // Save helpers
  const saveCampaigns = (next: AdminBoostCampaign[]) => {
    setCampaigns(next);
    localStorage.setItem('djassa_admin_boost_campaigns', JSON.stringify(next));
  };

  const savePromos = (next: PromoCode[]) => {
    setPromos(next);
    localStorage.setItem('djassa_admin_promos', JSON.stringify(next));
  };

  const savePricing = (next: BoostPricingPackage[]) => {
    setPricingPackages(next);
    localStorage.setItem('djassa_admin_boost_pricing', JSON.stringify(next));
  };

  // Toggle Campaign Status (Active <-> Paused, or Reactivate if Completed)
  const handleToggleCampaignStatus = (campaignId: string) => {
    const target = campaigns.find(c => c.id === campaignId);
    if (!target) return;

    const resolved = getCampaignResolvedState(target);
    let newStatus: 'active' | 'paused' = resolved.status === 'active' ? 'paused' : 'active';
    let newRemainingDays = target.remainingDays;
    let newEndDate = target.endDate;

    // If it was completed/expired and admin activates it, grant 3 days by default from 2026-11-06
    if (resolved.status === 'completed') {
      newStatus = 'active';
      newRemainingDays = 3;
      newEndDate = '2026-11-09';
    }

    const updated: AdminBoostCampaign[] = campaigns.map(c => 
      c.id === campaignId 
        ? { 
            ...c, 
            status: newStatus, 
            remainingDays: newRemainingDays,
            endDate: newEndDate,
            startDate: resolved.status === 'completed' ? '2026-11-06' : c.startDate
          } 
        : c
    );
    saveCampaigns(updated);

    addAuditLog(
      newStatus === 'active' ? 'Activation Boost Publicitaire' : 'Suspension Boost Publicitaire',
      target.title,
      'financial',
      `Campagne ${newStatus === 'active' ? 'mise en diffusion active' : 'suspendue temporairement'}`
    );
    void securityService.recordActivity({
      category: 'products',
      actionType: newStatus === 'active' ? 'boost_campaign_activated' : 'boost_campaign_paused',
      action: newStatus === 'active' ? `Campagne pub réactivée (${target.title})` : `Campagne pub mise en pause (${target.title})`,
      target: target.title,
      targetType: 'product',
      entityType: 'campaign',
      entityId: target.id,
      space: 'admin',
      result: 'reussi',
      severity: 'information',
      beforeValue: resolved.status,
      afterValue: newStatus,
      details: `Budget ${formatFCFA(target.budgetFCFA)} • Statut ${newStatus}`
    });
    showToast(newStatus === 'active' ? `🚀 Boost "${target.title}" activé !` : `⏸️ Boost "${target.title}" mis en pause.`);

    if (selectedCampaignForDetail && selectedCampaignForDetail.id === campaignId) {
      const updatedTarget = updated.find(c => c.id === campaignId);
      if (updatedTarget) setSelectedCampaignForDetail(updatedTarget);
    }
  };

  // Extend Campaign Duration
  const handleExtendDuration = (campaignId: string, additionalDays: number) => {
    const updated = campaigns.map(c => {
      if (c.id === campaignId) {
        const resolved = getCampaignResolvedState(c);
        let newEndDate = c.endDate;
        let newRemaining = (resolved.remainingDays || 0) + additionalDays;
        let newStartDate = c.startDate;

        if (resolved.status === 'completed') {
          newStartDate = '2026-11-06';
          const d = new Date('2026-11-06');
          d.setDate(d.getDate() + additionalDays);
          newEndDate = d.toISOString().split('T')[0];
          newRemaining = additionalDays;
        } else {
          try {
            const baseDate = new Date(c.endDate || '2026-11-06');
            if (!isNaN(baseDate.getTime())) {
              baseDate.setDate(baseDate.getDate() + additionalDays);
              newEndDate = baseDate.toISOString().split('T')[0];
            }
          } catch {
            // fallback
          }
        }

        return {
          ...c,
          startDate: newStartDate,
          endDate: newEndDate,
          durationDays: c.durationDays + additionalDays,
          remainingDays: newRemaining,
          status: 'active' as const
        };
      }
      return c;
    });
    saveCampaigns(updated);

    const target = campaigns.find(c => c.id === campaignId);
    addAuditLog('Prolongation Boost', target?.title || campaignId, 'financial', `+${additionalDays} jours ajoutés`);
    showToast(`✅ Durée prolongée de +${additionalDays} jours ! Campagne en diffusion.`);

    if (selectedCampaignForDetail && selectedCampaignForDetail.id === campaignId) {
      const updatedTarget = updated.find(c => c.id === campaignId);
      if (updatedTarget) setSelectedCampaignForDetail(updatedTarget);
    }
  };

  // Delete / Close Campaign (Safe, non-blocking for iFrame)
  const handleDeleteCampaign = (campaignId: string) => {
    const target = campaigns.find(c => c.id === campaignId);
    if (!target) return;

    const updated = campaigns.filter(c => c.id !== campaignId);
    saveCampaigns(updated);
    addAuditLog('Suppression Campagne Pub', target.title, 'financial', `Campagne de ${formatFCFA(target.budgetFCFA)} supprimée`);
    void securityService.recordActivity({
      category: 'products',
      actionType: 'boost_campaign_ended',
      action: `Campagne publicitaire terminée / supprimée (${target.title})`,
      target: target.title,
      targetType: 'product',
      entityType: 'campaign',
      entityId: target.id,
      space: 'admin',
      result: 'reussi',
      severity: 'moyen',
      beforeValue: target.status,
      afterValue: 'terminée',
      details: `Campagne de ${formatFCFA(target.budgetFCFA)} clôturée`
    });
    showToast(`🗑️ Campagne publicitaire "${target.title}" supprimée.`);
    if (selectedCampaignForDetail?.id === campaignId) {
      setSelectedCampaignForDetail(null);
    }
  };

  // Handle Campaign Created from Modal
  const handleCampaignCreated = (newCampaign: AdminBoostCampaign) => {
    const updated = [newCampaign, ...campaigns];
    saveCampaigns(updated);
    addAuditLog('Nouveau Boost Créé', newCampaign.title, 'financial', `Budget: ${formatFCFA(newCampaign.budgetFCFA)}`);
    void securityService.recordActivity({
      category: 'products',
      actionType: 'boost_campaign_created',
      action: `Campagne publicitaire créée (${newCampaign.title})`,
      target: `${newCampaign.targetName} (${newCampaign.placement})`,
      targetType: 'product',
      entityType: 'campaign',
      entityId: newCampaign.id,
      space: 'admin',
      result: 'reussi',
      severity: 'information',
      afterValue: `${formatFCFA(newCampaign.budgetFCFA)} • ${newCampaign.durationDays}j`,
      details: `Nouvelle campagne boost lancée pour ${newCampaign.sellerName}`
    });
    showToast(`🎉 Produit boosté avec succès ! Diffusion immédiate.`);
    setShowCreateBoostModal(false);
  };

  // Create Promo Code
  const handleCreatePromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromo.code.trim()) return;

    const created: PromoCode = {
      id: `promo-${Date.now()}`,
      code: newPromo.code.trim().toUpperCase(),
      type: newPromo.type,
      value: Number(newPromo.value) || 10,
      minOrderAmount: Number(newPromo.minOrderAmount) || 0,
      maxUses: Number(newPromo.maxUses) || 100,
      usedCount: 0,
      expiresAt: newPromo.expiresAt,
      active: true
    };

    savePromos([created, ...promos]);
    if (getSecurityToken()) {
      void securityService.createControlPlaneCampaign({
        campaignType: 'promotion',
        name: `Code Promo ${created.code}`,
        status: 'active',
        promoCode: created.code,
        discountType: created.type === 'percentage' ? 'percent' : 'fixed',
        discountValue: created.value,
        minSubtotalFcfa: created.minOrderAmount,
        description: `Code promotionnel ${created.code} (${created.maxUses} utilisations max)`
      }).catch(() => {});
    }
    addAuditLog('Création Code Promo', created.code, 'marketplace', `Réduction de ${created.type === 'percentage' ? `${created.value}%` : formatFCFA(created.value)}`);
    void securityService.recordActivity({
      category: 'products',
      actionType: 'promo_campaign_created',
      action: `Nouveau code promo créé (${created.code})`,
      target: created.code,
      targetType: 'product',
      entityType: 'promo',
      entityId: created.id,
      space: 'admin',
      result: 'reussi',
      severity: 'information',
      afterValue: created.type === 'percentage' ? `${created.value}%` : formatFCFA(created.value),
      details: `Code promotionnel actif (${created.maxUses} utilisations max)`
    });
    showToast(`🎉 Code promo ${created.code} créé !`);
    setShowAddPromoModal(false);
    setNewPromo({ code: '', type: 'percentage', value: 10, minOrderAmount: 5000, maxUses: 100, expiresAt: '31 Déc 2026' });
  };

  // Toggle Promo
  const handleTogglePromo = (id: string) => {
    const updated = promos.map(p => {
      if (p.id === id) {
        const nextState = !p.active;
        showToast(`Code ${p.code} ${nextState ? 'activé' : 'désactivé'}`);
        if (getSecurityToken()) {
          void securityService.getControlPlaneCampaigns()
            .then((res) => {
              const match = res.campaigns?.find((c: any) => c.promoCode?.toUpperCase() === p.code.toUpperCase());
              if (match?.id) {
                return securityService.updateControlPlaneCampaign(match.id, { status: nextState ? 'active' : 'paused' });
              }
            })
            .catch(() => {});
        }
        return { ...p, active: nextState };
      }
      return p;
    });
    savePromos(updated);
  };

  // Financial & Operational Metrics
  const metrics = useMemo(() => {
    const totalRevenue = campaigns.reduce((acc, c) => acc + (c.budgetFCFA || 0), 0);
    const activeCampaigns = campaigns.filter(c => c.status === 'active' && !isCampaignExpired(c));
    const totalImpressions = campaigns.reduce((acc, c) => acc + (c.impressionsCount || 0), 0);
    const totalClicks = campaigns.reduce((acc, c) => acc + (c.clicksCount || 0), 0);
    const totalSalesGenerated = campaigns.reduce((acc, c) => acc + (c.revenueGeneratedFCFA || 0), 0);
    const totalOrdersGenerated = campaigns.reduce((acc, c) => acc + (c.ordersCount || 0), 0);
    const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0';
    const roas = totalRevenue > 0 ? (totalSalesGenerated / totalRevenue).toFixed(1) : '0';

    return {
      totalRevenue,
      activeCount: activeCampaigns.length,
      totalCount: campaigns.length,
      totalImpressions,
      totalClicks,
      totalSalesGenerated,
      totalOrdersGenerated,
      ctr,
      roas
    };
  }, [campaigns]);

  // Statistiques exactes pour chaque type de forfait publicitaire
  const packageStats = useMemo(() => {
    const flashList = campaigns.filter(c => c.placement === 'sponsored_badge');
    const searchList = campaigns.filter(c => c.placement === 'search_top');
    const vipList = campaigns.filter(c => c.placement === 'hero_banner');

    return {
      flash: {
        count: flashList.length,
        revenue: flashList.reduce((acc, c) => acc + (c.budgetFCFA || 0), 0)
      },
      search: {
        count: searchList.length,
        revenue: searchList.reduce((acc, c) => acc + (c.budgetFCFA || 0), 0)
      },
      vip: {
        count: vipList.length,
        revenue: vipList.reduce((acc, c) => acc + (c.budgetFCFA || 0), 0)
      }
    };
  }, [campaigns]);

  // Total argent gagné par type de publicité
  const revenueByPlacement = useMemo(() => {
    return {
      vip: packageStats.vip.revenue,
      search: packageStats.search.revenue,
      flash: packageStats.flash.revenue
    };
  }, [packageStats]);

  // Title/Label of the currently selected advertising package
  const currentPackageTitle = useMemo(() => {
    switch (activeBoostPackageTab) {
      case 'flash': return 'Flash 24h';
      case 'search': return 'Top 1 Recherche';
      case 'vip': return 'Carrousel VIP';
      default: return 'Tous forfaits';
    }
  }, [activeBoostPackageTab]);

  // Statistics for the Status Tabs: En cours, Terminé, En pause, Historique
  // Automatically ADAPTS to the currently selected advertising package type (Flash 24h, Top Recherche, Carrousel VIP, Tous forfaits)
  const statusStats = useMemo(() => {
    const packageCampaigns = campaigns.filter(c => {
      if (activeBoostPackageTab === 'flash') return c.placement === 'sponsored_badge';
      if (activeBoostPackageTab === 'search') return c.placement === 'search_top';
      if (activeBoostPackageTab === 'vip') return c.placement === 'hero_banner';
      return true;
    });

    const activeList = packageCampaigns.filter(c => getCampaignResolvedState(c).status === 'active');
    const completedList = packageCampaigns.filter(c => getCampaignResolvedState(c).status === 'completed');
    const pausedList = packageCampaigns.filter(c => getCampaignResolvedState(c).status === 'paused');
    // Historique rassemble toutes les publicités archivées (terminées/expirées ou en pause)
    const historyList = packageCampaigns.filter(c => {
      const st = getCampaignResolvedState(c).status;
      return st === 'completed' || st === 'paused';
    });

    return {
      active: {
        count: activeList.length,
        earned: activeList.reduce((acc, c) => acc + (c.budgetFCFA || 0), 0),
        label: 'En cours',
        badge: 'En diffusion active',
        color: 'text-emerald-400',
        borderColor: 'border-emerald-500/40',
        bgGradient: 'from-emerald-950/70 via-[#101b13] to-[#101012]'
      },
      completed: {
        count: completedList.length,
        earned: completedList.reduce((acc, c) => acc + (c.budgetFCFA || 0), 0),
        label: 'Terminé',
        badge: 'Période expirée',
        color: 'text-indigo-400',
        borderColor: 'border-indigo-500/40',
        bgGradient: 'from-indigo-950/70 via-[#131221] to-[#101012]'
      },
      paused: {
        count: pausedList.length,
        earned: pausedList.reduce((acc, c) => acc + (c.budgetFCFA || 0), 0),
        label: 'En pause',
        badge: 'Diffusion suspendue',
        color: 'text-amber-400',
        borderColor: 'border-amber-500/40',
        bgGradient: 'from-amber-950/70 via-[#1c1812] to-[#101012]'
      },
      history: {
        count: historyList.length,
        earned: historyList.reduce((acc, c) => acc + (c.budgetFCFA || 0), 0),
        label: 'Historique',
        badge: 'Publicités archivées',
        color: 'text-sky-400',
        borderColor: 'border-sky-500/40',
        bgGradient: 'from-sky-950/70 via-[#101824] to-[#101012]'
      }
    };
  }, [campaigns, activeBoostPackageTab]);

  // Filtered Campaigns: respects active package type AND active status tab
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      const campState = getCampaignResolvedState(c);

      // 1. Filtrage par forfait publicitaire actif (Flash 24h, Top Recherche, Carrousel VIP)
      if (activeBoostPackageTab === 'flash' && c.placement !== 'sponsored_badge') return false;
      if (activeBoostPackageTab === 'search' && c.placement !== 'search_top') return false;
      if (activeBoostPackageTab === 'vip' && c.placement !== 'hero_banner') return false;

      // 2. Filtrage par onglet de statut
      if (statusTab === 'active') {
        if (campState.status !== 'active') return false;
      } else if (statusTab === 'completed') {
        if (campState.status !== 'completed') return false;
      } else if (statusTab === 'paused') {
        if (campState.status !== 'paused') return false;
      } else if (statusTab === 'history') {
        if (campState.status !== 'completed' && campState.status !== 'paused') return false;
      }

      // 3. Filtrage secondaire par pilule si sélectionnée manuellement (non redondant)
      if (statusFilter !== 'all' && campState.status !== statusFilter) return false;

      if (placementFilter !== 'all') {
        if (placementFilter === 'all_pack') {
          if (c.placement !== 'all') return false;
        } else if (c.placement !== placementFilter) {
          return false;
        }
      }
      if (targetTypeFilter !== 'all' && c.targetType !== targetTypeFilter) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = c.title.toLowerCase().includes(query);
        const matchesSeller = c.sellerName.toLowerCase().includes(query);
        const matchesTarget = c.targetName.toLowerCase().includes(query);
        const matchesId = c.id.toLowerCase().includes(query);
        const matchesZones = c.targetZones?.some(z => z.toLowerCase().includes(query));
        if (!matchesTitle && !matchesSeller && !matchesTarget && !matchesId && !matchesZones) {
          return false;
        }
      }

      return true;
    });
  }, [campaigns, statusFilter, statusTab, activeBoostPackageTab, placementFilter, targetTypeFilter, searchQuery]);

  // Export CSV of Advertising Revenues
  const handleExportCSV = () => {
    const headers = [
      'ID Campagne',
      'Titre',
      'Type Cible',
      'Article / Boutique',
      'Vendeur',
      'Emplacement',
      'Budget Facturé (FCFA)',
      'Statut',
      'Date Début',
      'Date Fin',
      'Impressions',
      'Clics',
      'Ventes Générées (FCFA)',
      'Mode de Règlement'
    ];

    const rows = campaigns.map(c => [
      c.id,
      `"${c.title.replace(/"/g, '""')}"`,
      c.targetType === 'product' ? 'Produit' : 'Boutique',
      `"${c.targetName.replace(/"/g, '""')}"`,
      `"${c.sellerName.replace(/"/g, '""')}"`,
      c.placement,
      c.budgetFCFA,
      c.status,
      c.startDate,
      c.endDate,
      c.impressionsCount,
      c.clicksCount,
      c.revenueGeneratedFCFA,
      c.isFreeAdminGrant ? 'Offert par Admin' : 'Mobile Money (Wave / OM / MoMo)'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Djassa_Recettes_Publicitaires_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('📊 Grand livre des recettes publicitaires exporté en CSV');
  };

  const getPlacementBadge = (p: BoostPlacement) => {
    switch (p) {
      case 'hero_banner':
        return { label: '👑 Bannière VIP Accueil', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
      case 'search_top':
        return { label: '🔥 Top 1 Recherche', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
      case 'sponsored_badge':
        return { label: '✨ Badge Sponsorisé', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
      case 'push_notification':
        return { label: '⚡ Push Mobile Flash', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' };
      case 'all':
        return { label: '🚀 Pack 360° Intégral', color: 'bg-[#FF6321]/20 text-[#FF8C53] border-[#FF6321]/40' };
      default:
        return { label: p, color: 'bg-white/10 text-white/70 border-white/10' };
    }
  };

  return (
    <div id="admin-promos-management-section" className="space-y-4 text-white animate-in fade-in duration-200">
      
      {/* =======================================================================
          FINANCIAL & OPERATIONAL SUMMARY METRICS (2 HERO CARDS ON SAME LINE)
          ======================================================================= */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {/* Metric 1: Nombre total d'achats de publicité */}
        <div 
          onClick={() => setActiveSubTab('boosts')}
          className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-orange-950/40 via-[#151518] to-[#101012] border border-[#FF6321]/30 hover:border-[#FF6321]/60 transition cursor-pointer group space-y-1.5"
        >
          <div className="flex items-center justify-between text-xs text-[#FF8C53]">
            <span className="font-bold flex items-center gap-1.5 truncate">
              <ShoppingBag className="w-3.5 h-3.5 text-[#FF6321] shrink-0" />
              <span className="truncate">Achats Publicité</span>
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#FF6321]/20 font-black text-[#FF8C53] shrink-0">
              Total
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-black text-white font-mono tracking-tight">
            {metrics.totalCount} <span className="text-xs font-semibold text-white/50">achats</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-white/50 pt-0.5">
            <span className="truncate">{metrics.activeCount} en cours de diffusion</span>
            <span className="text-[#FF8C53] group-hover:translate-x-0.5 transition font-bold shrink-0 hidden sm:inline">Détails →</span>
          </div>
        </div>

        {/* Metric 2: Nombre d'argent total gagné par le type de publicité */}
        <div 
          onClick={() => setActiveSubTab('revenues')}
          className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-amber-950/40 via-[#151518] to-[#101012] border border-amber-500/30 hover:border-amber-500/60 transition cursor-pointer group space-y-1.5"
        >
          <div className="flex items-center justify-between text-xs text-amber-300">
            <span className="font-bold flex items-center gap-1.5 truncate">
              <DollarSign className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">Argent Gagné par Type</span>
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 font-black text-amber-300 shrink-0">
              Recettes
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-black text-amber-400 font-mono tracking-tight">
            {formatFCFA(metrics.totalRevenue)}
          </div>
          <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-white/60 pt-0.5 overflow-x-auto no-scrollbar">
            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono font-bold whitespace-nowrap">
              VIP: {formatFCFA(revenueByPlacement.vip)}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#FF6321]/15 text-[#FF8C53] font-mono font-bold whitespace-nowrap">
              Top: {formatFCFA(revenueByPlacement.search)}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-mono font-bold whitespace-nowrap">
              Flash: {formatFCFA(revenueByPlacement.flash)}
            </span>
          </div>
        </div>
      </div>

      {/* =======================================================================
          TAB 1: PRODUITS & ANNONCES BOOSTÉS PAR LES VENDEURS
          ======================================================================= */}
      {activeSubTab === 'boosts' && (
        <div className="space-y-4">

          {/* ===================================================================
          {/* ===================================================================
              ONGLETS DES 3 TYPES DE PUBLICITÉS (500 F, 3 000 F, 10 000 F)
              =================================================================== */}
          <div className="space-y-3">
            {/* Barre d'onglets */}
            <div className="border-t border-b border-white/10 grid grid-cols-2 divide-x divide-y divide-white/5 bg-[#0A0A0A]/95 backdrop-blur-md rounded-2xl overflow-hidden">
              {/* Onglet 0 : Tous les forfaits */}
              <button
                type="button"
                onClick={() => {
                  setActiveBoostPackageTab('all');
                  setStatusFilter('all');
                }}
                className={`py-3 px-2 sm:px-3 text-xs font-bold flex items-center justify-center transition group cursor-pointer ${
                  activeBoostPackageTab === 'all'
                    ? 'text-white border-b-2 border-white bg-white/[0.08]'
                    : 'text-white/45 hover:text-white/75 border-b-2 border-transparent'
                }`}
              >
                <div className="w-full flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <Layers className={`w-3.5 h-3.5 shrink-0 ${activeBoostPackageTab === 'all' ? 'text-white' : 'text-current'}`} />
                    <span className="truncate">Tous forfaits</span>
                  </div>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    activeBoostPackageTab === 'all' ? 'bg-white/20 text-white font-black' : 'bg-white/5 text-white/40'
                  }`}>
                    {metrics.totalCount}
                  </span>
                </div>
              </button>

              {/* Onglet 1 : Flash 24h (500 F) */}
              <button
                type="button"
                onClick={() => {
                  setActiveBoostPackageTab('flash');
                  setStatusFilter('all');
                }}
                className={`py-3 px-2 sm:px-3 text-xs font-bold flex items-center justify-center transition group cursor-pointer ${
                  activeBoostPackageTab === 'flash'
                    ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/[0.08]'
                    : 'text-white/45 hover:text-white/75 border-b-2 border-transparent'
                }`}
              >
                <div className="w-full flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <Zap className={`w-3.5 h-3.5 shrink-0 ${activeBoostPackageTab === 'flash' ? 'text-cyan-400' : 'text-current'}`} />
                    <span className="truncate">Flash 24h</span>
                  </div>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    activeBoostPackageTab === 'flash' ? 'bg-cyan-500/20 text-cyan-300 font-black' : 'bg-white/5 text-white/40'
                  }`}>
                    500 F
                  </span>
                </div>
              </button>

              {/* Onglet 2 : Top 1 Recherche (3 000 F) */}
              <button
                type="button"
                onClick={() => {
                  setActiveBoostPackageTab('search');
                  setStatusFilter('all');
                }}
                className={`py-3 px-2 sm:px-3 text-xs font-bold flex items-center justify-center transition group cursor-pointer ${
                  activeBoostPackageTab === 'search'
                    ? 'text-[#FF6321] border-b-2 border-[#FF6321] bg-orange-500/[0.08]'
                    : 'text-white/45 hover:text-white/75 border-b-2 border-transparent'
                }`}
              >
                <div className="w-full flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <Flame className={`w-3.5 h-3.5 shrink-0 ${activeBoostPackageTab === 'search' ? 'text-[#FF6321]' : 'text-current'}`} />
                    <span className="truncate">Top 1 Rech.</span>
                  </div>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    activeBoostPackageTab === 'search' ? 'bg-[#FF6321]/20 text-[#FF8C53] font-black' : 'bg-white/5 text-white/40'
                  }`}>
                    3 000 F
                  </span>
                </div>
              </button>

              {/* Onglet 3 : Carrousel VIP (10 000 F) */}
              <button
                type="button"
                onClick={() => {
                  setActiveBoostPackageTab('vip');
                  setStatusFilter('all');
                }}
                className={`py-3 px-2 sm:px-3 text-xs font-bold flex items-center justify-center transition group cursor-pointer ${
                  activeBoostPackageTab === 'vip'
                    ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-500/[0.08]'
                    : 'text-white/45 hover:text-white/75 border-b-2 border-transparent'
                }`}
              >
                <div className="w-full flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <Crown className={`w-3.5 h-3.5 shrink-0 ${activeBoostPackageTab === 'vip' ? 'text-amber-400' : 'text-current'}`} />
                    <span className="truncate">Carrousel VIP</span>
                  </div>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    activeBoostPackageTab === 'vip' ? 'bg-amber-500/20 text-amber-300 font-black' : 'bg-white/5 text-white/40'
                  }`}>
                    10 000 F
                  </span>
                </div>
              </button>
            </div>

            {/* 4 ONGLETS DE STATUT EN DESSOUS : EN COURS, TERMINÉ, EN PAUSE, HISTORIQUE (ADAPTÉS AU FORFAIT ACTIF) */}
            <div 
              id="admin-promos-status-tabs"
              className="border-t border-b border-white/10 bg-[#121215]/90 backdrop-blur-md rounded-2xl overflow-hidden shadow-lg sticky top-0 z-10"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 divide-x md:divide-x divide-white/5">
                {/* Onglet 1: En cours */}
                <button
                  id="tab-btn-promo-active"
                  type="button"
                  onClick={() => {
                    setStatusTab('active');
                    setStatusFilter('all');
                  }}
                  className={`py-3 px-2 sm:px-3 text-xs font-bold flex items-center justify-center transition group cursor-pointer ${
                    statusTab === 'active'
                      ? 'text-emerald-400 border-b-2 border-emerald-400 bg-emerald-500/10'
                      : 'text-white/60 hover:text-white border-b-2 border-transparent hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="w-full flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <Clock className={`w-3.5 h-3.5 shrink-0 ${statusTab === 'active' ? 'text-emerald-400' : 'text-current'}`} />
                      <span className="truncate">En cours</span>
                    </div>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold shrink-0 ${
                      statusTab === 'active'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-white/10 text-white/50'
                    }`}>
                      {statusStats.active.count}
                    </span>
                  </div>
                </button>

                {/* Onglet 2: Terminé */}
                <button
                  id="tab-btn-promo-completed"
                  type="button"
                  onClick={() => {
                    setStatusTab('completed');
                    setStatusFilter('all');
                  }}
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

                {/* Onglet 3: En pause */}
                <button
                  id="tab-btn-promo-paused"
                  type="button"
                  onClick={() => {
                    setStatusTab('paused');
                    setStatusFilter('all');
                  }}
                  className={`py-3 px-2 sm:px-3 text-xs font-bold flex items-center justify-center transition group cursor-pointer ${
                    statusTab === 'paused'
                      ? 'text-amber-400 border-b-2 border-amber-400 bg-amber-500/10'
                      : 'text-white/60 hover:text-white border-b-2 border-transparent hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="w-full flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <Pause className={`w-3.5 h-3.5 shrink-0 ${statusTab === 'paused' ? 'text-amber-400' : 'text-current'}`} />
                      <span className="truncate">En pause</span>
                    </div>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold shrink-0 ${
                      statusTab === 'paused'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-white/10 text-white/50'
                    }`}>
                      {statusStats.paused.count}
                    </span>
                  </div>
                </button>

                {/* Onglet 4: Historique */}
                <button
                  id="tab-btn-promo-history"
                  type="button"
                  onClick={() => {
                    setStatusTab('history');
                    setStatusFilter('all');
                  }}
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

            {/* 2 CARTES DE L'ONGLET ACTIF : NOMBRE D'ACHATS PUBLICITAIRES ET ARGENT GAGNÉ (ADAPTÉES AU FORFAIT ACTIF) */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 animate-in fade-in duration-200">
              {/* CARTE 1: NOMBRE D'ACHATS */}
              <div className={`p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-br ${statusStats[statusTab].bgGradient} border ${statusStats[statusTab].borderColor} shadow-xl relative overflow-hidden group transition duration-300 flex flex-col justify-between`}>
                <div>
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2 gap-1">
                    <span className="text-[11px] sm:text-xs font-bold text-white/70 uppercase tracking-wider truncate">
                      Nombre d'achats ({statusStats[statusTab].label} • {currentPackageTitle})
                    </span>
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-lg sm:rounded-xl bg-white/10 ${statusStats[statusTab].color} flex items-center justify-center font-black`}>
                      <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  </div>
                  <div className="text-base sm:text-2xl font-black text-white font-mono tracking-tight truncate">
                    {statusStats[statusTab].count} <span className="text-xs sm:text-sm font-semibold opacity-70">campagnes</span>
                  </div>
                </div>
                <div className="mt-2 sm:mt-2.5 flex items-center justify-between text-[10px] sm:text-[11px] pt-1.5 sm:pt-2 border-t border-white/5 gap-1">
                  <span className="text-white/50 truncate">Forfait : <strong className="text-white">{currentPackageTitle}</strong> • {statusStats[statusTab].label}</span>
                  <span className={`px-1.5 sm:px-2 py-0.5 rounded-full bg-white/10 ${statusStats[statusTab].color} font-bold text-[9px] sm:text-[10px] shrink-0`}>
                    {statusStats[statusTab].badge}
                  </span>
                </div>
              </div>

              {/* CARTE 2: ARGENT GAGNÉ */}
              <div className={`p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-br ${statusStats[statusTab].bgGradient} border ${statusStats[statusTab].borderColor} shadow-xl relative overflow-hidden group transition duration-300 flex flex-col justify-between`}>
                <div>
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2 gap-1">
                    <span className="text-[11px] sm:text-xs font-bold text-white/70 uppercase tracking-wider truncate">
                      Argent gagné ({statusStats[statusTab].label} • {currentPackageTitle})
                    </span>
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-lg sm:rounded-xl bg-white/10 ${statusStats[statusTab].color} flex items-center justify-center font-black`}>
                      <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  </div>
                  <div className={`text-base sm:text-2xl font-black ${statusStats[statusTab].color} font-mono tracking-tight truncate`}>
                    {formatFCFA(statusStats[statusTab].earned)}
                  </div>
                </div>
                <div className="mt-2 sm:mt-2.5 flex items-center justify-between text-[10px] sm:text-[11px] pt-1.5 sm:pt-2 border-t border-white/5 gap-1">
                  <span className="text-white/50 truncate">Budget encaissé ({currentPackageTitle})</span>
                  <span className={`px-1.5 sm:px-2 py-0.5 rounded-full bg-white/10 ${statusStats[statusTab].color} font-bold text-[9px] sm:text-[10px] shrink-0`}>
                    100% Encaissé
                  </span>
                </div>
              </div>
            </div>

          </div>
          {/* SEARCH & FILTERS CONTROLS */}
          <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              {/* Search input */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher un produit boosté, un marchand (Wax Prestige, Électro...), une commune..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]"
                />
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar">
                {(['all', 'active', 'paused', 'completed'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap border ${
                      statusFilter === st
                        ? 'bg-white/15 text-white border-white/30'
                        : 'bg-black/30 text-white/50 border-white/5 hover:text-white'
                    }`}
                  >
                    {st === 'all' ? 'Tous les statuts' : st === 'active' ? '● En cours' : st === 'paused' ? '⏸ En pause' : '✓ Terminés'}
                  </button>
                ))}
              </div>
            </div>

            {/* Campaign Counter */}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5 flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-[11px]">
                {activeBoostPackageTab !== 'all' && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 text-white font-medium">
                    Filtre : <strong className="text-[#FF8C53]">{activeBoostPackageTab === 'flash' ? 'Flash 24h' : activeBoostPackageTab === 'search' ? 'Top Recherche' : 'Carrousel VIP'}</strong>
                    <button 
                      type="button"
                      onClick={() => setActiveBoostPackageTab('all')}
                      className="ml-0.5 text-white/50 hover:text-white cursor-pointer font-bold"
                      title="Afficher tous les forfaits"
                    >
                      ✕
                    </button>
                  </span>
                )}
              </div>
              <div className="text-[11px] text-white/50">
                Affichage de <strong>{filteredCampaigns.length}</strong> sur {campaigns.length} campagnes
              </div>
            </div>
          </div>

          {/* BOOSTED PRODUCTS LIST */}
          {filteredCampaigns.length === 0 ? (
            <div className="p-8 text-center bg-[#141417] rounded-3xl border border-white/10 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/5 text-white/40 mx-auto flex items-center justify-center">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">
                Aucune publicité {statusStats[statusTab].label.toLowerCase()} ({currentPackageTitle})
              </h3>
              <p className="text-xs text-white/50 max-w-sm mx-auto">
                Il n'y a actuellement aucune campagne avec le statut « {statusStats[statusTab].label} » pour le forfait {currentPackageTitle}.
              </p>
              <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStatusTab('active');
                    setStatusFilter('all');
                  }}
                  className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Voir les publicités en cours</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setPlacementFilter('all');
                    setActiveBoostPackageTab('all');
                  }}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Tous les forfaits & statuts</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredCampaigns.map((camp) => {
                const placementBadge = getPlacementBadge(camp.placement);
                const campState = getCampaignResolvedState(camp);

                return (
                  <div
                    key={camp.id}
                    id={`admin-boost-campaign-card-${camp.id}`}
                    className={`p-4 sm:p-5 rounded-3xl border transition-all duration-300 flex flex-col justify-between gap-3.5 relative overflow-hidden group ${
                      campState.status === 'active'
                        ? 'bg-gradient-to-b from-[#18181D] via-[#131317] to-[#0E0E11] border-white/10 hover:border-[#FF6321]/50 shadow-xl shadow-black/40 hover:shadow-orange-950/20'
                        : campState.status === 'paused'
                        ? 'bg-gradient-to-b from-[#171512] via-[#121110] to-[#0E0E10] border-amber-500/20 opacity-95 shadow-lg'
                        : 'bg-[#101012] border-white/5 opacity-75'
                    }`}
                  >
                    {/* Ambient background glow for active cards */}
                    {campState.status === 'active' && (
                      <div className="absolute -top-16 -right-16 w-40 h-40 bg-[#FF6321]/10 rounded-full blur-3xl pointer-events-none group-hover:bg-[#FF6321]/15 transition-all duration-500" />
                    )}

                    <div className="space-y-3 relative z-10">
                      {/* TOP ROW: Placement tag, Status pill, and Price */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black border inline-flex items-center gap-1.5 shadow-sm ${placementBadge.color}`}>
                            {placementBadge.label}
                          </span>
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1 border ${campState.badgeClass}`}>
                            {campState.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                            {campState.status === 'paused' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                            {campState.status === 'completed' && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                            {campState.label}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-white/40 block font-medium">Budget alloué</span>
                          <span className="text-sm sm:text-base font-black text-amber-400 font-mono tracking-tight">
                            {camp.isFreeAdminGrant ? 'Offert (Admin)' : formatFCFA(camp.budgetFCFA)}
                          </span>
                        </div>
                      </div>

                      {/* MIDDLE ROW: Image Thumbnail + Details */}
                      <div className="flex items-start gap-3.5 pt-1">
                        <div className="relative shrink-0">
                          <img
                            src={camp.targetImage}
                            alt={camp.targetName}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1544441893-675973e31985?w=400';
                            }}
                            className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl object-cover border border-white/10 shadow-md group-hover:scale-[1.03] transition-transform duration-300"
                          />
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[8px] font-bold text-white/80 border border-white/10 uppercase">
                            {camp.targetType === 'product' ? 'Produit' : 'Boutique'}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <h3 className="text-sm font-black text-white truncate leading-snug group-hover:text-[#FF8C53] transition-colors" title={camp.title || camp.targetName}>
                            {camp.title || camp.targetName}
                          </h3>

                          <div className="flex items-center gap-2 text-xs text-white/70 flex-wrap">
                            <span className="flex items-center gap-1.5 truncate font-semibold">
                              <Store className="w-3.5 h-3.5 text-[#FF6321] shrink-0" />
                              <span className="text-white truncate">{camp.sellerName}</span>
                            </span>
                            {camp.targetType === 'product' && camp.targetPrice ? (
                              <>
                                <span className="text-white/20">•</span>
                                <span className="text-emerald-400 font-mono font-bold shrink-0">
                                  {formatFCFA(camp.targetPrice)}
                                </span>
                              </>
                            ) : camp.targetSubtitle ? (
                              <>
                                <span className="text-white/20">•</span>
                                <span className="text-white/40 truncate text-[11px]">
                                  {camp.targetSubtitle}
                                </span>
                              </>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-1 text-[10px] text-white/45 pt-0.5">
                            <span className="truncate">
                              📍 {camp.targetZones?.join(', ') || 'Toutes les communes d’Abidjan'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* DURATION & PROGRESS BAR */}
                      <div className="bg-black/50 p-2.5 sm:p-3 rounded-2xl border border-white/5 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1.5 font-bold text-white/80">
                            <Clock className="w-3.5 h-3.5 text-[#FF6321]" />
                            <span>
                              {campState.status === 'completed'
                                ? 'Période expirée (Terminé)' 
                                : campState.status === 'paused'
                                ? `En pause (${campState.remainingDays}j restant${campState.remainingDays > 1 ? 's' : ''})`
                                : `${campState.remainingDays} jour${campState.remainingDays > 1 ? 's' : ''} restant${campState.remainingDays > 1 ? 's' : ''}`}
                            </span>
                          </span>
                          <span className="text-white/50 font-mono text-[10px]">
                            {formatFriendlyDate(camp.startDate)} → {formatFriendlyDate(camp.endDate)}
                          </span>
                        </div>

                        <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              campState.status === 'active' 
                                ? 'bg-gradient-to-r from-[#FF6321] via-amber-500 to-emerald-400' 
                                : campState.status === 'paused'
                                ? 'bg-amber-500'
                                : 'bg-neutral-600'
                            }`}
                            style={{ width: `${campState.progressPercent}%` }}
                          />
                        </div>
                      </div>

                    </div>

                    {/* ACTION BUTTONS ROW */}
                    <div className="pt-2.5 border-t border-white/10 flex items-center justify-between gap-2 relative z-10">
                      {/* Bouton de statut rapide (Mettre en pause / Reprendre / Prolonger) */}
                      {campState.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() => handleToggleCampaignStatus(camp.id)}
                          className="py-2 px-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                          title="Suspendre temporairement la diffusion"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Pause</span>
                        </button>
                      ) : campState.status === 'paused' ? (
                        <button
                          type="button"
                          onClick={() => handleToggleCampaignStatus(camp.id)}
                          className="py-2 px-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                          title="Reprendre la diffusion active"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Reprendre</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleExtendDuration(camp.id, 3)}
                          className="py-2 px-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                          title="Prolonger de +3 jours et relancer la campagne"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">+3j</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedCampaignForDetail(camp)}
                        className="flex-1 py-2 px-3.5 bg-gradient-to-r from-[#FF6321] via-[#FF7538] to-[#FF8C53] hover:from-[#e0551a] hover:to-[#FF6321] text-white rounded-xl text-xs font-black shadow-md shadow-orange-950/40 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 group/btn"
                      >
                        <Eye className="w-3.5 h-3.5 text-white/90 group-hover/btn:scale-110 transition-transform" />
                        <span>Publication, Stats & Vendeur</span>
                        <ChevronRight className="w-3.5 h-3.5 text-white/80 group-hover/btn:translate-x-0.5 transition-transform" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteCampaign(camp.id)}
                        className="p-2 text-white/30 hover:text-rose-400 rounded-xl hover:bg-rose-500/10 transition cursor-pointer active:scale-95 border border-transparent hover:border-rose-500/20"
                        title="Supprimer la campagne"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =======================================================================
          TAB 2: GRAND LIVRE DES RECETTES PUBLICITAIRES (REVENUS MONÉTAIRES)
          ======================================================================= */}
      {activeSubTab === 'revenues' && (
        <div className="space-y-4">
          {/* Revenue Breakdown by Channel & Payment Mode */}
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-[#161619] via-[#101012] to-[#0A0A0C] border border-amber-500/20 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" />
                  Encaissements Publicités & Sponsoring Djassa
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
                  {formatFCFA(metrics.totalRevenue)}
                </h3>
                <p className="text-xs text-white/50 mt-0.5">
                  100% des fonds sont perçus d'avance auprès des vendeurs avant l'activation du boost
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-3.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger Relevé Comptable</span>
                </button>
              </div>
            </div>

            {/* Payment gateways distribution */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-2xl bg-black/40 border border-white/10 space-y-1">
                <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span>⚡ Wave Mobile Money</span>
                </span>
                <div className="text-sm font-black text-white font-mono">
                  {formatFCFA(Math.round(metrics.totalRevenue * 0.52))}
                </div>
                <span className="text-[9px] text-white/40 block">52% des paiements boosts</span>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/10 space-y-1">
                <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span>🟠 Orange Money CI</span>
                </span>
                <div className="text-sm font-black text-white font-mono">
                  {formatFCFA(Math.round(metrics.totalRevenue * 0.31))}
                </div>
                <span className="text-[9px] text-white/40 block">31% des paiements boosts</span>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/10 space-y-1">
                <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span>🟡 MTN MoMo</span>
                </span>
                <div className="text-sm font-black text-white font-mono">
                  {formatFCFA(Math.round(metrics.totalRevenue * 0.12))}
                </div>
                <span className="text-[9px] text-white/40 block">12% des paiements boosts</span>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/10 space-y-1">
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span>💼 Solde Portefeuille</span>
                </span>
                <div className="text-sm font-black text-white font-mono">
                  {formatFCFA(Math.round(metrics.totalRevenue * 0.05))}
                </div>
                <span className="text-[9px] text-white/40 block">5% déduit des ventes</span>
              </div>
            </div>
          </div>

          {/* Transactions Ledger Table */}
          <div className="rounded-2xl bg-[#141417] border border-white/10 overflow-hidden shadow-xl">
            <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-black text-white uppercase tracking-wider">
                  Journal des Transactions Publicitaires Encaissées
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                  {campaigns.length} règlements
                </span>
              </div>
              <span className="text-[11px] text-white/50">Ordre chronologique</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 text-[10px] uppercase font-bold bg-white/[0.02]">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Marchand / Boutique</th>
                    <th className="py-2.5 px-3">Produit Boosté</th>
                    <th className="py-2.5 px-3">Format</th>
                    <th className="py-2.5 px-3">Moyen Paiement</th>
                    <th className="py-2.5 px-3 text-right">Montant Encaissé</th>
                    <th className="py-2.5 px-3 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-white/80">
                  {campaigns.map((camp, idx) => {
                    const paymentGateway = camp.isFreeAdminGrant
                      ? 'Offert par Admin'
                      : idx % 3 === 0
                      ? 'Wave Mobile Money ⚡'
                      : idx % 3 === 1
                      ? 'Orange Money 🟠'
                      : 'MTN MoMo 🟡';

                    return (
                      <tr key={camp.id} className="hover:bg-white/[0.02] transition">
                        <td className="py-3 px-3 font-mono text-[11px] text-white/50 whitespace-nowrap">
                          {camp.startDate}
                        </td>
                        <td className="py-3 px-3 font-bold text-white whitespace-nowrap">
                          {camp.sellerName}
                        </td>
                        <td className="py-3 px-3 max-w-[200px] truncate" title={camp.targetName}>
                          <div className="flex items-center gap-2 truncate">
                            <img
                              src={camp.targetImage}
                              alt=""
                              className="w-6 h-6 rounded-md object-cover border border-white/10 shrink-0"
                            />
                            <span className="truncate">{camp.targetName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="text-[10px] text-white/60 capitalize">
                            {camp.placement.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[11px] text-white/60 whitespace-nowrap font-mono">
                          {paymentGateway}
                        </td>
                        <td className="py-3 px-3 text-right font-black font-mono text-amber-400 whitespace-nowrap">
                          {camp.isFreeAdminGrant ? '0 FCFA' : formatFCFA(camp.budgetFCFA)}
                        </td>
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            ✓ Encaissé
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 3: TARIFS & FORFAITS PUBLICITAIRES CONFIGURABLES
          ======================================================================= */}
      {activeSubTab === 'pricing' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[#141417] border border-white/10 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  <span>Grille Tarifaire des Forfaits Publicitaires</span>
                </h3>
                <p className="text-xs text-white/50 mt-0.5">
                  Configurez les tarifs proposés aux marchands pour booster leurs produits et générer des recettes publicitaires
                </p>
              </div>

              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase">
                Synchronisé sur les Apps Vendeurs
              </span>
            </div>
          </div>

          {/* Pricing cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pricingPackages.map((pkg) => (
              <div
                key={pkg.id}
                className="p-4 rounded-2xl bg-[#141417] border border-white/10 hover:border-indigo-500/40 transition space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${pkg.highlightColor}`}>
                      {pkg.badge}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingPackage(pkg)}
                      className="p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition"
                      title="Modifier ce forfait"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h4 className="text-sm font-black text-white">{pkg.title}</h4>
                  <p className="text-xs text-white/60 leading-relaxed">{pkg.description}</p>
                </div>

                <div className="pt-3 border-t border-white/5 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-white/50">Tarif Forfait ({pkg.recommendedDurationDays} jours) :</span>
                    <span className="text-base font-black text-amber-400 font-mono">
                      {formatFCFA(pkg.totalPackageFCFA)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-white/50">
                    <span>Soit par jour :</span>
                    <span className="font-mono text-white font-bold">{formatFCFA(pkg.dailyRateFCFA)} / j</span>
                  </div>

                  <div className="p-2 rounded-xl bg-white/[0.03] text-[10px] text-white/70 flex items-center justify-between">
                    <span>Audience estimée :</span>
                    <strong className="text-cyan-300 font-mono">{pkg.estimatedReach}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 4: CODES PROMOS & RÉDUCTIONS
          ======================================================================= */}
      {activeSubTab === 'promos' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#141417] border border-white/10">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Codes Promotionnels Actifs ({promos.length})
              </h3>
              <p className="text-[11px] text-white/50">Coupons de remise sur les paniers des clients</p>
            </div>

            <button
              type="button"
              onClick={() => setShowAddPromoModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-md transition"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Code Promo</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {promos.map((item) => {
              const usagePercent = Math.min(100, Math.round((item.usedCount / item.maxUses) * 100));

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    item.active ? 'bg-white/5 border-white/10 hover:border-purple-500/30' : 'bg-white/2 border-white/5 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center flex-shrink-0 font-mono font-black text-sm">
                      {item.type === 'percentage' ? '%' : 'F'}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-black text-white tracking-wider bg-white/10 px-2 py-0.5 rounded-lg border border-white/10">
                          {item.code}
                        </span>
                        <span className="text-xs font-bold text-emerald-400">
                          {item.type === 'percentage' ? `-${item.value}%` : `-${formatFCFA(item.value)}`}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${item.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/50'}`}>
                          {item.active ? 'Actif' : 'Inactif'}
                        </span>
                      </div>

                      <p className="text-[11px] text-white/50">
                        Min. d'achat: {formatFCFA(item.minOrderAmount)} • Expire le : {item.expiresAt}
                      </p>

                      <div className="w-48 pt-1">
                        <div className="flex justify-between text-[9px] text-white/40 mb-0.5">
                          <span>Utilisations : {item.usedCount} / {item.maxUses}</span>
                          <span>{usagePercent}%</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-purple-500 rounded-full" 
                            style={{ width: `${usagePercent}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleTogglePromo(item.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 border ${
                        item.active 
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20' 
                          : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30'
                      }`}
                    >
                      {item.active ? 'Désactiver' : 'Activer'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Supprimer le code promo ${item.code} ?`)) {
                          savePromos(promos.filter(p => p.id !== item.id));
                          showToast(`Code promo ${item.code} supprimé`);
                        }
                      }}
                      className="p-1.5 text-white/40 hover:text-rose-400 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =======================================================================
          MODALS INTEGRATIONS
          ======================================================================= */}

      {/* 1. Modal Detail Campagne Boost */}
      {selectedCampaignForDetail && (
        <AdminBoostDetailModal
          campaign={selectedCampaignForDetail}
          campaigns={campaigns}
          onClose={() => setSelectedCampaignForDetail(null)}
          onToggleStatus={handleToggleCampaignStatus}
          onExtendDuration={handleExtendDuration}
          onDeleteCampaign={handleDeleteCampaign}
        />
      )}

      {/* 2. Modal Créer / Lancer un Boost Produit */}
      {showCreateBoostModal && (
        <AdminCreateBoostModal
          onClose={() => {
            setShowCreateBoostModal(false);
            setCreateBoostInitialPlacement(undefined);
            setCreateBoostInitialDays(undefined);
          }}
          onCampaignCreated={handleCampaignCreated}
          initialPlacement={createBoostInitialPlacement}
          initialDurationDays={createBoostInitialDays}
        />
      )}

      {/* 3. Modal Edit Pricing Package */}
      {editingPackage && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#121214] border border-indigo-500/40 rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Modifier le Forfait Publicitaire</h3>
                <p className="text-[11px] text-white/50">{editingPackage.title}</p>
              </div>
              <button
                onClick={() => setEditingPackage(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const updated = pricingPackages.map(p => p.id === editingPackage.id ? editingPackage : p);
                savePricing(updated);
                showToast(`Tarif du forfait "${editingPackage.title}" mis à jour ! 🚀`);
                setEditingPackage(null);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block text-white/70 font-bold mb-1">Titre du forfait</label>
                <input
                  type="text"
                  required
                  value={editingPackage.title}
                  onChange={(e) => setEditingPackage({ ...editingPackage, title: e.target.value })}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-white/70 font-bold mb-1">Tarif Total (FCFA)</label>
                  <input
                    type="number"
                    required
                    min="1000"
                    step="500"
                    value={editingPackage.totalPackageFCFA}
                    onChange={(e) => {
                      const total = Number(e.target.value);
                      const daily = Math.round(total / editingPackage.recommendedDurationDays);
                      setEditingPackage({ ...editingPackage, totalPackageFCFA: total, dailyRateFCFA: daily });
                    }}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-white/70 font-bold mb-1">Durée (Jours)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="60"
                    value={editingPackage.recommendedDurationDays}
                    onChange={(e) => {
                      const days = Math.max(1, Number(e.target.value));
                      const daily = Math.round(editingPackage.totalPackageFCFA / days);
                      setEditingPackage({ ...editingPackage, recommendedDurationDays: days, dailyRateFCFA: daily });
                    }}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/70 font-bold mb-1">Audience & Portée Estimée</label>
                <input
                  type="text"
                  required
                  value={editingPackage.estimatedReach}
                  onChange={(e) => setEditingPackage({ ...editingPackage, estimatedReach: e.target.value })}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingPackage(null)}
                  className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition shadow-lg shadow-indigo-600/30"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal Nouveau Code Promo */}
      {showAddPromoModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#121214] border border-purple-500/30 rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Nouveau Code Promo</h3>
              </div>
              <button
                onClick={() => setShowAddPromoModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePromo} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-white/70 mb-1">Code promotionnel *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: ADJAME20"
                  value={newPromo.code}
                  onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white uppercase font-mono font-bold focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-white/70 mb-1">Type de réduction</label>
                  <select
                    value={newPromo.type}
                    onChange={(e) => setNewPromo({ ...newPromo, type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="percentage">Pourcentage (%)</option>
                    <option value="fixed">Montant fixe (FCFA)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-white/70 mb-1">Valeur</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newPromo.value}
                    onChange={(e) => setNewPromo({ ...newPromo, value: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-white/70 mb-1">Min. d’achat (FCFA)</label>
                  <input
                    type="number"
                    value={newPromo.minOrderAmount}
                    onChange={(e) => setNewPromo({ ...newPromo, minOrderAmount: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-white/70 mb-1">Usages max.</label>
                  <input
                    type="number"
                    value={newPromo.maxUses}
                    onChange={(e) => setNewPromo({ ...newPromo, maxUses: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-white/70 mb-1">Date d’expiration</label>
                <input
                  type="text"
                  placeholder="Ex: 31 Décembre 2026"
                  value={newPromo.expiresAt}
                  onChange={(e) => setNewPromo({ ...newPromo, expiresAt: e.target.value })}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddPromoModal(false)}
                  className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition shadow-lg shadow-purple-600/30"
                >
                  Activer le Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
