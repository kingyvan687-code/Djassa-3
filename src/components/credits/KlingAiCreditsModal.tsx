import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Zap, 
  MessageSquare, 
  Image as ImageIcon, 
  Video, 
  Check, 
  History, 
  ShieldCheck, 
  RotateCw,
  Crown,
  CheckCircle2,
  XCircle,
  Sliders,
  ArrowRight,
  Store,
  User,
  ShoppingBag,
  Layers,
  AlertCircle,
  MapPin,
  Clock,
  ExternalLink
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../services/marketServices';
import { AI_BILLING_RATES, AI_PRICING_TABLE } from '../../services/aiPricing';
import { creditsService } from '../../services/creditsService';
import { getSecurityToken } from '../../services/securityService';

// ChatGPT Signature Emblem
export const ChatGptEmblem: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1683a.071.071 0 0 1 .038.052v5.5826a4.5045 4.5045 0 0 1-4.4945 4.4947zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1684a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.8956zm16.0993 3.8558L12.5973 8.3829l2.02-1.1683a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.402-.6815zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L8.907 9.2297V6.8974a.0662.0662 0 0 1 .0331-.0615l4.8824-2.8198a4.4992 4.4992 0 0 1 6.6025 4.6738zM12 10.5366l2.8717 1.656-2.8717 1.656-2.8717-1.656L12 10.5366z"/>
  </svg>
);

// Kling AI Logo Emblem
export const KlingAiLogo: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="6" fill="#0F0F11" />
    <path 
      d="M7 5H10.5V11L14.5 5H18.5L13.5 12L19 19H14.8L11 13.5L10.5 14.2V19H7V5Z" 
      fill="url(#kling-gradient-modal)" 
    />
    <circle cx="17.5" cy="6.5" r="1.5" fill="#FF5E00" />
    <defs>
      <linearGradient id="kling-gradient-modal" x1="7" y1="5" x2="19" y2="19" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FF7700" />
        <stop offset="50%" stopColor="#FF3700" />
        <stop offset="100%" stopColor="#FF9900" />
      </linearGradient>
    </defs>
  </svg>
);

export interface PlanDefinition {
  id: string;
  name: string;
  badge?: string;
  priceFcfa: number;
  period: string;
  creditsGranted: number;
  tagline: string;
  accentColor: string;
  isPopular?: boolean;
  audience: 'client' | 'seller';
  capabilities: {
    questionsCount: string;
    questionsDetail: string;
    imagesCount?: string;
    imagesDetail?: string;
    videosCount?: string;
    videosDetail?: string;
    hasVideos?: boolean;
    models: string;
    extras: string[];
  };
}

// -----------------------------------------------------------------------------
// 1. PLANS ABONNÉS CLIENTS (Questions IA + Créations d'Images Try On)
// Les clients peuvent uniquement poser des questions et créer des images.
// -----------------------------------------------------------------------------
export const CLIENT_GPT_PLANS: PlanDefinition[] = [
  {
    id: 'gratuit',
    name: 'Plan Gratuit',
    badge: 'Renouvelé chaque 24h',
    priceFcfa: 0,
    period: 'Toutes les 24 h',
    creditsGranted: 10,
    tagline: '10 crédits offerts et renouvelés automatiquement toutes les 24 heures',
    accentColor: 'from-emerald-500 to-teal-600',
    audience: 'client',
    capabilities: {
      questionsCount: 'Questions IA incluses',
      questionsDetail: 'Recherche d\'articles, négociation de prix & conseils shopping personnalisés',
      imagesCount: 'Créations d\'images IA',
      imagesDetail: 'Essayage virtuel & génération d\'images selon votre solde disponible',
      videosCount: 'Non inclus',
      videosDetail: 'Aucune génération de vidéo dans les forfaits clients',
      hasVideos: false,
      models: 'RodiumAI MiniMax H3 Standard',
      extras: [
        '10 crédits renouvelés automatiquement toutes les 24 h',
        'Cumulables sans perte avec vos recharges',
        'Accès complet au catalogue des boutiques d\'Adjamé'
      ]
    }
  },
  {
    id: 'mini',
    name: 'DJASSA Mini',
    badge: 'Découverte',
    priceFcfa: 300,
    period: 'par mois',
    creditsGranted: 30,
    tagline: '30 crédits pour poser vos questions à l\'assistant et créer des images IA',
    accentColor: 'from-purple-500 to-indigo-600',
    audience: 'client',
    capabilities: {
      questionsCount: '30 questions IA',
      questionsDetail: 'Pour poser des questions à l\'assistant shopping & conseils mode',
      imagesCount: '2 créations d\'images',
      imagesDetail: 'Essayages virtuels & images générées par l\'IA',
      videosCount: 'Non inclus (exclusif vendeurs)',
      videosDetail: 'La création de vidéos est réservée aux formules abonnés vendeurs',
      hasVideos: false,
      models: 'RodiumAI MiniMax H3 Max Turbo',
      extras: [
        '30 crédits IA inclus immédiatement',
        'Cumul automatique avec les 10 crédits gratuits / 24h',
        'Essayages virtuels sur les articles du catalogue'
      ]
    }
  },
  {
    id: 'plus',
    name: 'DJASSA Plus',
    badge: 'LE PLUS POPULAIRE',
    isPopular: true,
    priceFcfa: 600,
    period: 'par mois',
    creditsGranted: 60,
    tagline: '60 crédits IA pour vos recherches et créations d\'images studio',
    accentColor: 'from-blue-600 to-indigo-600',
    audience: 'client',
    capabilities: {
      questionsCount: '60 questions IA',
      questionsDetail: 'Pour poser des questions à l\'assistant & conseils shopping personnalisés',
      imagesCount: '5 créations d\'images',
      imagesDetail: 'Essayage virtuel RodiumAI Qwen Image 2.1 Turbo HD & multi-angles',
      videosCount: 'Non inclus (exclusif vendeurs)',
      videosDetail: 'Fonctionnalité vidéo exclusive aux boutiques et commerçants',
      hasVideos: false,
      models: 'MiniMax H3 Max Turbo & MiniMax M3.1 Flash',
      extras: [
        '60 crédits IA inclus immédiatement',
        'Priorité standard sur les recommandations boutiques',
        'Support client prioritaire 7j/7'
      ]
    }
  },
  {
    id: 'premium',
    name: 'DJASSA Premium',
    badge: 'VIP Shopping',
    priceFcfa: 1200,
    period: 'par mois',
    creditsGranted: 120,
    tagline: '120 crédits IA haute vitesse et créations d\'images haute définition',
    accentColor: 'from-amber-500 to-purple-600',
    audience: 'client',
    capabilities: {
      questionsCount: '120 questions IA',
      questionsDetail: 'Accès haute vitesse assistant IA & styliste personnel dédié',
      imagesCount: '12 créations d\'images',
      imagesDetail: 'Essayages virtuels VIP & créations d\'images haute définition',
      videosCount: 'Non inclus (exclusif vendeurs)',
      videosDetail: 'Création de vidéo promotionnelle réservée aux comptes vendeurs',
      hasVideos: false,
      models: 'MiniMax H3 Max Turbo, MiniMax H3 & Qwen Image 2.1 Turbo',
      extras: [
        '120 crédits IA haute vitesse inclus immédiatement',
        'Traitement prioritaire sur toutes vos générations IA',
        'Assistance stylisme VIP 24h/24'
      ]
    }
  }
];

// -----------------------------------------------------------------------------
// 2. PLANS ABONNÉS VENDEURS (Questions IA + Créations d'Images + Vidéos Kling AI)
// Les vendeurs peuvent poser des questions, créer des images ET créer des vidéos.
// -----------------------------------------------------------------------------
export const SELLER_GPT_PLANS: PlanDefinition[] = [
  {
    id: 'vendeur_starter',
    name: 'Vendeur Starter',
    badge: 'Lancement Boutique',
    priceFcfa: 4500,
    period: 'par mois',
    creditsGranted: 450,
    tagline: 'Démarrez vos ventes avec la rédaction commerciale IA, les lookbooks et 3 vidéos promotionnelles RodiumAI',
    accentColor: 'from-emerald-500 to-teal-600',
    audience: 'seller',
    capabilities: {
      questionsCount: '50 questions IA Vendeur (5 crédits/u)',
      questionsDetail: 'Rédaction fiches produits vendeuses, calcul de marges & conseils commerce local',
      imagesCount: '20 créations d\'images catalogue (10 crédits/u)',
      imagesDetail: 'Photos studio de vos articles portés par des mannequins virtuels',
      videosCount: '3 vidéos 5s RodiumAI (60 crédits/u)',
      videosDetail: '3 clips animés promotionnels de 5s pour votre statut WhatsApp & catalogue',
      hasVideos: true,
      models: 'MiniMax H3 + MiniMax H3 Max Turbo + Qwen Image 2.1 Turbo',
      extras: [
        'Format vidéo 5s optimisé pour WhatsApp Status & TikTok',
        'Calcul automatique des prix & marges bénéficiaires',
        'Vitesse de génération prioritaire'
      ]
    }
  },
  {
    id: 'vendeur_pro',
    name: 'Vendeur Pro Marché',
    badge: 'LE PLUS POPULAIRE VENDEUR',
    isPopular: true,
    priceFcfa: 8900,
    period: 'par mois',
    creditsGranted: 900,
    tagline: 'La formule star des boutiques : calcul de marge, lookbooks 4K et 8 vidéos de défilés RodiumAI pour TikTok & WhatsApp',
    accentColor: 'from-[#FF6321] to-[#FF8540]',
    audience: 'seller',
    capabilities: {
      questionsCount: '100 questions IA Vendeur (5 crédits/u)',
      questionsDetail: 'Calcul de marge nette, bilan de semaine, gestion réclamations & plan d\'action ventes',
      imagesCount: '40 créations d\'images studio Ultra-HD (10 crédits/u)',
      imagesDetail: 'Shootings virtuels 3 angles (face, profil, dos) de vos nouveaux arrivages',
      videosCount: '8 vidéos 5s RodiumAI Studio HD (60 crédits/u)',
      videosDetail: '8 vidéos 5s de défilés mannequins dynamiques haute résolution avec drapés',
      hasVideos: true,
      models: 'MiniMax H3 Max Turbo, MiniMax M3.1 Flash & Qwen Image 2.1 Turbo',
      extras: [
        'Export vidéo prêt à publier pour TikTok, Instagram Reels & WhatsApp',
        'Analyse financière et calcul du produit le plus rentable du catalogue',
        'Badge Boutique Vérifiée & Recommandée dans les résultats',
        'Support prioritaire commerçants 7j/7'
      ]
    }
  },
  {
    id: 'vendeur_elite',
    name: 'Vendeur Élite Studio',
    badge: 'MARQUES & GROSSISTES',
    priceFcfa: 16900,
    period: 'par mois',
    creditsGranted: 1800,
    tagline: 'La suite complète grand commerce : 1 800 crédits mensuels, 18 vidéos RodiumAI Studio 1080p et lookbooks 4K',
    accentColor: 'from-purple-600 to-indigo-600',
    audience: 'seller',
    capabilities: {
      questionsCount: '200 questions IA Vendeur illimitées (5 crédits/u)',
      questionsDetail: 'Audit complet de catalogue, prévisions des ventes et scripts de relance clients personnalisés',
      imagesCount: '80 créations d\'images studio 4K (10 crédits/u)',
      imagesDetail: 'Lookbooks haute couture, retouche professionnelle & création d\'ambiance studio',
      videosCount: '18 vidéos 5s RodiumAI Studio 1080p (60 crédits/u)',
      videosDetail: '18 clips cinématiques 5 secondes avec mannequins en mouvement, cadrage dynamique et audio',
      hasVideos: true,
      models: 'MiniMax H3 Max Turbo, MiniMax M3.1 Flash & Qwen Image 2.1 Turbo',
      extras: [
        'File d\'attente 0 attente ultra-prioritaire pour les vidéos et images',
        'Exportations vidéo sans compression avec filigrane de votre boutique',
        'Accès anticipé aux nouveaux modèles IA et modes rafale multi-articles',
        'Gestionnaire de compte VIP dédié 24h/24'
      ]
    }
  }
];

export const GPT_PLANS: PlanDefinition[] = [
  ...SELLER_GPT_PLANS,
  ...CLIENT_GPT_PLANS
];

export const KlingAiCreditsModal: React.FC = () => {
  const { 
    aiCredits, 
    userPlan,
    upgradeUserPlan,
    addAiCredits, 
    spendAiCredits, 
    claimDailyBonus, 
    aiCreditHistory, 
    isCreditModalOpen, 
    setIsCreditModalOpen, 
    showToast,
    openAiVideoModal,
    openTryOnModal,
    products,
    accountRole,
    creditModalAudience,
    setActiveTab: setNavTab,
    refreshCreditsState
  } = useApp();

  const [activeTab, setActiveTab] = useState<'plans' | 'compare' | 'history'>('plans');
  
  // Segmented audience: 'seller' (Questions + Images + Vidéos) vs 'client' (Questions + Images)
  const [selectedAudience, setSelectedAudience] = useState<'seller' | 'client'>(() => {
    if (creditModalAudience === 'seller' || creditModalAudience === 'client') return creditModalAudience;
    if (accountRole === 'seller') return 'seller';
    return 'client';
  });

  // Keep audience in sync when opening modal or changing role, and refresh live credits/plan/history
  useEffect(() => {
    if (isCreditModalOpen) {
      if (creditModalAudience === 'seller' || creditModalAudience === 'client') {
        setSelectedAudience(creditModalAudience);
      } else if (accountRole === 'seller') {
        setSelectedAudience('seller');
      } else {
        setSelectedAudience('client');
      }
      if (getSecurityToken() && refreshCreditsState) {
        void refreshCreditsState();
      }
    }
  }, [isCreditModalOpen, creditModalAudience, accountRole, refreshCreditsState]);

  // Checkout Modal State (identifiants stricts GeniusPay : wave | orange_money | mtn_momo | card)
  const [selectedPlanToUpgrade, setSelectedPlanToUpgrade] = useState<PlanDefinition | null>(null);
  const [selectedCreditPack, setSelectedCreditPack] = useState<{ id: string; name: string; credits: number; priceFcfa: number; tag: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'wave' | 'orange_money' | 'mtn_momo' | 'card'>('wave');
  const [phoneNumber, setPhoneNumber] = useState('07 00 12 34 56');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isCheckingPendingStatus, setIsCheckingPendingStatus] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState<{
    rechargeId: string;
    itemTitle: string;
    amountFcfa: number;
    creditsGranted: number;
    checkoutUrl?: string;
    providerConfigured?: boolean;
    paymentMethod: 'wave' | 'orange_money' | 'mtn_momo' | 'card';
    status: 'pending' | 'failed' | 'rejected';
    message: string;
  } | null>(null);

  if (!isCreditModalOpen) return null;

  const currentPlanDef =
    selectedAudience === 'client'
      ? (CLIENT_GPT_PLANS.find(p => p.id === userPlan) || CLIENT_GPT_PLANS[0])
      : (SELLER_GPT_PLANS.find(p => p.id === userPlan) || SELLER_GPT_PLANS[0]);

  const CREDIT_PACKS = [
    { id: 'pack-3500', name: 'Pack Découverte (Min.)', credits: 350, priceFcfa: 3500, tag: '+350 crédits' },
    { id: 'pack-5000', name: 'Pack Populaire', credits: 500, priceFcfa: 5000, tag: '+500 crédits', popular: true },
    { id: 'pack-10000', name: 'Pack Créateur', credits: 1000, priceFcfa: 10000, tag: '+1 000 crédits' },
    { id: 'pack-20000', name: 'Pack Mega VIP', credits: 2000, priceFcfa: 20000, tag: '+2 000 crédits' },
  ];

  const handleOpenUpgrade = (plan: PlanDefinition) => {
    setPendingCheckout(null);
    if (plan.id === 'gratuit') {
      upgradeUserPlan('gratuit', 0, 0);
      return;
    }
    setSelectedCreditPack(null);
    setSelectedPlanToUpgrade(plan);
  };

  const handleConfirmUpgrade = async () => {
    if (!selectedPlanToUpgrade && !selectedCreditPack) return;
    if (!getSecurityToken()) {
      showToast('Veuillez vous connecter pour effectuer une recharge.');
      return;
    }

    const priceToPay = selectedPlanToUpgrade ? selectedPlanToUpgrade.priceFcfa : (selectedCreditPack?.priceFcfa || 0);
    const creditsToAdd = selectedPlanToUpgrade ? selectedPlanToUpgrade.creditsGranted : (selectedCreditPack?.credits || 0);
    const itemTitle = selectedPlanToUpgrade ? selectedPlanToUpgrade.name : (selectedCreditPack?.name || 'Recharge crédits');

    setIsProcessingPayment(true);
    try {
      const result = await creditsService.confirmRecharge({
        planId: selectedPlanToUpgrade?.id,
        packId: selectedCreditPack?.id,
        purchaseType: selectedPlanToUpgrade ? 'subscription' : 'pack',
        amountFcfa: priceToPay,
        paymentMethod,
        phoneNumber: paymentMethod !== 'card' ? phoneNumber : undefined
      });

      await refreshCreditsState?.();

      if (result.pending || result.recharge?.status === 'pending') {
        setSelectedPlanToUpgrade(null);
        setSelectedCreditPack(null);
        setPendingCheckout({
          rechargeId: result.recharge.id,
          itemTitle,
          amountFcfa: result.recharge.amountFcfa || priceToPay,
          creditsGranted: result.recharge.credits || creditsToAdd,
          checkoutUrl: result.checkoutUrl || result.recharge.checkoutUrl,
          providerConfigured: result.providerConfigured,
          paymentMethod,
          status: 'pending',
          message:
            result.message ||
            'Paiement en attente de confirmation GeniusPay. Aucun crédit n’est ajouté avant validation réelle.'
        });
        showToast('Paiement initié en attente de validation opérateur.');
        return;
      }

      setSelectedPlanToUpgrade(null);
      setSelectedCreditPack(null);
      setPendingCheckout(null);
      showToast(result.message || `Paiement confirmé : +${creditsToAdd} crédits ajoutés.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Échec de la demande de paiement.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCheckPendingStatus = async () => {
    if (!pendingCheckout) return;
    setIsCheckingPendingStatus(true);
    try {
      const statusRes = await creditsService.checkRechargeStatus(pendingCheckout.rechargeId);
      if (statusRes.confirmed || statusRes.status === 'confirmed') {
        await refreshCreditsState?.();
        const confirmedCredits = statusRes.recharge?.credits || pendingCheckout.creditsGranted;
        setPendingCheckout(null);
        showToast(`Paiement confirmé ! +${confirmedCredits} crédits attribués.`);
        return;
      }
      if (statusRes.status === 'failed' || statusRes.status === 'rejected') {
        await refreshCreditsState?.();
        setPendingCheckout((prev) =>
          prev
            ? {
                ...prev,
                status: statusRes.status === 'rejected' ? 'rejected' : 'failed',
                message: 'Paiement refusé ou annulé. Aucun crédit n’a été ajouté.'
              }
            : null
        );
        showToast('Paiement refusé ou annulé.');
        return;
      }

      // Still pending locally: verify live provider status if GeniusPay deposit exists
      const providerRes = await creditsService.verifyProviderRecharge(pendingCheckout.rechargeId);
      if (providerRes.status === 'confirmed') {
        await refreshCreditsState?.();
        const confirmedCredits = providerRes.recharge?.credits || pendingCheckout.creditsGranted;
        setPendingCheckout(null);
        showToast(`Paiement confirmé par GeniusPay ! +${confirmedCredits} crédits attribués.`);
      } else if (providerRes.status === 'failed' || providerRes.status === 'rejected') {
        await refreshCreditsState?.();
        setPendingCheckout((prev) =>
          prev
            ? {
                ...prev,
                status: providerRes.status === 'rejected' ? 'rejected' : 'failed',
                message: providerRes.message || 'Transaction refusée par le fournisseur de paiement.'
              }
            : null
        );
        showToast(providerRes.message || 'Transaction refusée.');
      } else {
        setPendingCheckout((prev) =>
          prev
            ? {
                ...prev,
                message:
                  providerRes.message ||
                  'Paiement toujours en attente de confirmation. Finalisez sur votre téléphone ou GeniusPay puis revérifiez.'
              }
            : null
        );
        showToast('Paiement toujours en attente de confirmation.');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la vérification du statut.');
    } finally {
      setIsCheckingPendingStatus(false);
    }
  };

  return (
    <div 
      id="modal-kling-ai-credits"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 overflow-hidden animate-fadeIn"
      onClick={() => setIsCreditModalOpen(false)}
    >
      <div 
        className="w-full max-w-xl h-[95vh] sm:h-[90vh] bg-[#171717] border border-white/10 rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden text-[#ECECEC]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* =========================================================================
            1. HEADER (EXACT CHATGPT / GPT UPGRADE OFFERS HEADER)
            ========================================================================= */}
        <header className="px-5 py-4 bg-[#212121]/90 border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/10 shadow-sm">
              <ChatGptEmblem className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Voir les offres
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/10">
                  RodiumAI
                </span>
              </div>
              <p className="text-[11px] text-white/50">
                Passez au niveau supérieur pour vos essayages, vidéos & questions
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsCreditModalOpen(false)}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center transition active:scale-90"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Current Balance Bar (Status & Credits remaining) */}
        <div className="px-5 py-3 bg-[#1D1D1D] border-b border-white/[0.06] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-400/30">
              <Zap className="w-3.5 h-3.5 fill-amber-400" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-white/70">Forfait actuel :</span>
                <span className="text-xs font-black text-white uppercase tracking-wider px-1.5 py-0.2 rounded bg-white/10 border border-white/15">
                  {currentPlanDef ? currentPlanDef.name : 'Gratuit'}
                </span>
              </div>
              <p className="text-[11px] text-amber-300 font-extrabold flex items-center gap-1 mt-0.5">
                <span>{aiCredits} crédits restants</span>
                <span className="text-white/40 font-normal">• Solde actif</span>
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs (Style ChatGPT App: Les offres, Historique) */}
        <div className="px-4 pt-2.5 pb-2 border-b border-white/[0.06] bg-[#171717] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {[
            { id: 'plans', label: 'Les Offres', icon: Crown },
            { id: 'history', label: 'Historique', icon: History }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition shrink-0 active:scale-95 ${
                  isActive 
                    ? 'bg-white text-black shadow-sm' 
                    : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
          
          {/* =========================================================================
              TAB: LES OFFRES (CHATGPT & KLING AI PLANS)
              ========================================================================= */}
          {activeTab === 'plans' && (
            <div className="space-y-4">
              <div className="text-center px-2 py-1">
                <h4 className="text-lg font-black text-white tracking-tight">
                  {selectedAudience === 'seller'
                    ? 'Forfaits IA Vendeurs'
                    : 'Forfaits IA Clients'}
                </h4>
                <p className="text-xs text-white/60 mt-1 max-w-md mx-auto">
                  {selectedAudience === 'seller'
                    ? 'Boostez vos ventes avec des questions de rentabilité, lookbooks studio et vidéos défilés RodiumAI.'
                    : 'Profitez de conseils shopping IA personnalisés et de vos essayages virtuels multi-angles.'}
                </p>
              </div>

              {/* Plans List Cards for Selected Audience */}
              <div className="space-y-3.5">
                {(selectedAudience === 'seller' ? SELLER_GPT_PLANS : CLIENT_GPT_PLANS).map((plan) => {
                  const isCurrent = userPlan === plan.id;
                  const isPopular = plan.isPopular;

                  return (
                    <div
                      key={plan.id}
                      className={`relative rounded-3xl p-5 border transition-all ${
                        isPopular
                          ? 'bg-gradient-to-b from-[#242424] to-[#1E1E1E] border-[#FF6321] shadow-2xl shadow-[#FF6321]/10 ring-1 ring-[#FF6321]/30'
                          : isCurrent
                          ? 'bg-[#212121] border-white/30 shadow-lg'
                          : 'bg-[#1E1E1E] border-white/10 hover:border-white/20'
                      }`}
                    >
                      {/* Popular pill ribbon */}
                      {isPopular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-[#FF6321] to-[#FF944D] text-white text-[10px] font-black uppercase tracking-wider shadow-md flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          <span>{plan.badge}</span>
                        </div>
                      )}

                      {/* Header of the plan */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xl font-black text-white tracking-tight">
                              {plan.name}
                            </h4>
                            {!isPopular && plan.badge && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                                {plan.badge}
                              </span>
                            )}
                            {isCurrent && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Forfait Actuel
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-white/60 mt-1 leading-snug">
                            {plan.tagline}
                          </p>
                        </div>

                        {/* Price */}
                        <div className="text-right shrink-0">
                          <span className="text-xl font-black text-white block">
                            {plan.priceFcfa === 0 ? 'Gratuit' : formatFCFA(plan.priceFcfa)}
                          </span>
                          <span className="text-[10px] text-white/50 block font-medium">
                            {plan.period}
                          </span>
                        </div>
                      </div>

                      {/* Highlight: Number of Credits Allocated */}
                      <div className="mt-4 p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold">
                            <Zap className="w-4 h-4 fill-amber-400" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white/90 block">
                              Crédits accordés
                            </span>
                            <span className="text-[11px] text-white/50">
                              {plan.id === 'gratuit' ? 'Renouvelés automatiquement chaque 24 h' : 'Renouvelés chaque mois'}
                            </span>
                          </div>
                        </div>
                        <span className="text-sm font-black text-amber-300 bg-amber-400/10 px-2.5 py-1 rounded-xl border border-amber-400/20">
                          {plan.id === 'gratuit' ? `${plan.creditsGranted} crédits / 24h` : `${plan.creditsGranted} crédits`}
                        </span>
                      </div>

                      {/* Client & Seller Pillars */}
                      <div className="mt-3 space-y-2">
                        {/* 1. Questions IA */}
                        <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                              <MessageSquare className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-[10px] text-blue-300 font-bold block leading-tight">
                                Questions à l'IA
                              </span>
                              <span className="text-[11px] text-white/80 truncate block">
                                {plan.capabilities.questionsDetail}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs font-black text-white shrink-0 bg-blue-500/20 px-2 py-0.5 rounded-lg border border-blue-500/30">
                            {plan.capabilities.questionsCount.split('(')[0]}
                          </span>
                        </div>

                        {/* 2. Création d'Images */}
                        {plan.capabilities.imagesCount && (
                          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                                <ImageIcon className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] text-purple-300 font-bold block leading-tight">
                                  Création d'images ({plan.audience === 'seller' ? 'Catalogue Studio' : 'Try On Virtuel'})
                                </span>
                                <span className="text-[11px] text-white/80 truncate block">
                                  {plan.capabilities.imagesDetail}
                                </span>
                              </div>
                            </div>
                            <span className="text-xs font-black text-white shrink-0 bg-purple-500/20 px-2 py-0.5 rounded-lg border border-purple-500/30">
                              {plan.capabilities.imagesCount.split('(')[0]}
                            </span>
                          </div>
                        )}

                        {/* 3. Vidéos IA (exclusif Vendeurs) */}
                        {plan.audience === 'seller' && plan.capabilities.hasVideos && plan.capabilities.videosCount && (
                          <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                                <Video className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] text-orange-300 font-bold block leading-tight">
                                  Vidéos promotionnelles RodiumAI
                                </span>
                                <span className="text-[11px] text-white/80 truncate block">
                                  {plan.capabilities.videosDetail}
                                </span>
                              </div>
                            </div>
                            <span className="text-xs font-black text-orange-300 shrink-0 bg-orange-500/20 px-2 py-0.5 rounded-lg border border-orange-500/30">
                              {plan.capabilities.videosCount.split('(')[0]}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Capabilities: Extras inclus */}
                      {plan.capabilities.extras && plan.capabilities.extras.length > 0 && (
                        <div className="mt-3 space-y-1.5 pt-2 border-t border-white/5">
                          {plan.capabilities.extras.slice(0, 3).map((extra, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-white/70">
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>{extra}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* CTA Action Button */}
                      <div className="mt-4">
                        {isCurrent ? (
                          plan.id === 'gratuit' ? (
                            <button
                              disabled
                              className="w-full py-3 rounded-2xl bg-white/10 text-white/50 font-bold text-xs flex items-center justify-center gap-2 cursor-default border border-white/5"
                            >
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              <span>Votre forfait actuel ({aiCredits} crédits disponibles)</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenUpgrade(plan)}
                              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg transition active:scale-[0.98] cursor-pointer"
                            >
                              <Zap className="w-4 h-4 fill-white" />
                              <span>Recharger ce forfait (+{plan.creditsGranted} crédits cumulés)</span>
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => handleOpenUpgrade(plan)}
                            className={`w-full py-3.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition active:scale-[0.98] cursor-pointer ${
                              isPopular
                                ? 'bg-gradient-to-r from-[#FF6321] to-[#FF8038] hover:opacity-95 text-white shadow-orange-600/30'
                                : 'bg-white hover:bg-zinc-200 text-black'
                            }`}
                          >
                            <span>
                              {plan.id === 'gratuit' 
                                ? 'Revenir au plan gratuit' 
                                : `Passer à ${plan.name} (+${plan.creditsGranted} crédits cumulés)`}
                            </span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Recharges classiques de crédits (Minimum 3 500 FCFA conservé) */}
              <div className="pt-2 space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <h5 className="text-xs font-bold text-white/90 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span>Recharges classiques de crédits</span>
                  </h5>
                  <span className="text-[10px] text-white/50">Min. 3 500 FCFA</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {CREDIT_PACKS.map((pack) => (
                    <button
                      key={pack.id}
                      type="button"
                      onClick={() => {
                        setPendingCheckout(null);
                        setSelectedPlanToUpgrade(null);
                        setSelectedCreditPack(pack);
                      }}
                      className={`p-3 rounded-2xl border text-left transition active:scale-[0.98] cursor-pointer ${
                        pack.popular
                          ? 'bg-[#23201D] border-[#FF6321]/50 hover:border-[#FF6321]'
                          : 'bg-[#1E1E1E] border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-white truncate">{pack.name}</span>
                      </div>
                      <p className="text-xs font-black text-amber-300 mt-1">{pack.tag}</p>
                      <p className="text-sm font-black text-[#FF6321] mt-0.5">{formatFCFA(pack.priceFcfa)}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Security & Money Back Info */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center gap-3 text-xs text-white/60">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <p>
                  Abonnements sans engagement. Paiement 100% sécurisé par Wave, Orange Money, MTN MoMo et cartes bancaires via GeniusPay.
                </p>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB: COMPARATIF DES FORFAITS (TABLEAU DÉTAILLÉ CLIENTS VS VENDEURS)
              ========================================================================= */}
          {activeTab === 'compare' && (
            <div className="space-y-4">
              <div className="text-center px-2">
                <h4 className="text-base font-bold text-white">
                  Tableau comparatif des forfaits
                </h4>
                <p className="text-xs text-white/50 mt-0.5">
                  Visualisez en un clin d'œil les quotas et fonctionnalités incluses selon votre profil
                </p>
              </div>

              {/* Segmented Switcher in Comparatif Tab */}
              <div className="p-1 rounded-2xl bg-[#242424] border border-white/10 flex items-center gap-1 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedAudience('seller')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    selectedAudience === 'seller'
                      ? 'bg-[#FF6321] text-white shadow-md font-black'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Vendeurs</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAudience('client')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                    selectedAudience === 'client'
                      ? 'bg-white text-black shadow-md font-black'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Clients</span>
                </button>
              </div>

              {/* TABLEAU SELON AUDIENCE */}
              {selectedAudience === 'seller' ? (
                <div className="overflow-x-auto no-scrollbar -mx-4 px-4 animate-fadeIn">
                  <div className="min-w-[560px] rounded-2xl border border-orange-500/30 bg-[#1F1F1F] overflow-hidden text-xs">
                    {/* Table Header */}
                    <div className="grid grid-cols-4 p-3 bg-orange-500/10 border-b border-orange-500/20 font-bold text-white">
                      <div>Critères Vendeur</div>
                      <div className="text-center">Starter</div>
                      <div className="text-center text-[#FF6321]">Pro Marché ★</div>
                      <div className="text-center text-purple-400">Élite Studio 👑</div>
                    </div>

                    {/* Row 1: Prix */}
                    <div className="grid grid-cols-4 p-3 border-b border-white/5 items-center">
                      <div className="font-semibold text-white/80">Prix mensuel</div>
                      <div className="text-center text-white/80 font-bold">4 500 F</div>
                      <div className="text-center text-[#FF6321] font-black">8 900 F</div>
                      <div className="text-center text-purple-400 font-black">16 900 F</div>
                    </div>

                    {/* Row 2: Crédits inclus */}
                    <div className="grid grid-cols-4 p-3 border-b border-white/5 items-center bg-white/[0.02]">
                      <div className="font-semibold text-white/80 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span>Crédits / mois</span>
                      </div>
                      <div className="text-center text-amber-300 font-bold">450</div>
                      <div className="text-center text-amber-300 font-black">900</div>
                      <div className="text-center text-amber-300 font-black">1 800</div>
                    </div>

                    {/* Row 3: Questions IA Vendeur */}
                    <div className="grid grid-cols-4 p-3 border-b border-white/5 items-center">
                      <div className="font-semibold text-white/80">Questions IA Vendeur (5 cr.)</div>
                      <div className="text-center text-white/90 font-bold">50 / mois</div>
                      <div className="text-center text-emerald-400 font-bold">100 / mois</div>
                      <div className="text-center text-emerald-400 font-black">200 / mois</div>
                    </div>

                    {/* Row 4: Création d'images Studio */}
                    <div className="grid grid-cols-4 p-3 border-b border-white/5 items-center bg-white/[0.02]">
                      <div className="font-semibold text-white/80">Images Catalogue Studio (10 cr.)</div>
                      <div className="text-center text-white/90 font-bold">20 images</div>
                      <div className="text-center text-emerald-400 font-bold">40 images Ultra-HD</div>
                      <div className="text-center text-emerald-400 font-black">80 images 4K</div>
                    </div>

                    {/* Row 5: Export WhatsApp / TikTok */}
                    <div className="grid grid-cols-4 p-3 border-b border-white/5 items-center">
                      <div className="font-semibold text-white/80">Export TikTok & WhatsApp</div>
                      <div className="text-center text-emerald-400 font-bold">✓ Inclus</div>
                      <div className="text-center text-emerald-400 font-bold">✓ Inclus (Optimisé)</div>
                      <div className="text-center text-emerald-400 font-black">✓ Inclus (Filigrane VIP)</div>
                    </div>

                    {/* Row 6: Modèles */}
                    <div className="grid grid-cols-4 p-3 items-center">
                      <div className="font-semibold text-white/80">Modèles IA</div>
                      <div className="text-center text-white/80">MiniMax H3 & Qwen 2.1</div>
                      <div className="text-center text-white font-bold">MiniMax H3 Max & M3.1</div>
                      <div className="text-center text-purple-300 font-black">Suite Complète RodiumAI</div>
                    </div>
                  </div>
                </div>
              ) : (
                /* TABLEAU CLIENTS */
                <div className="overflow-x-auto no-scrollbar -mx-4 px-4 animate-fadeIn">
                  <div className="min-w-[620px] rounded-2xl border border-white/10 bg-[#1F1F1F] overflow-hidden text-xs">
                    {/* Table Header */}
                    <div className="grid grid-cols-5 p-3 bg-white/5 border-b border-white/10 font-bold text-white">
                      <div className="col-span-1">Critères Client</div>
                      <div className="text-center text-emerald-400">Gratuit</div>
                      <div className="text-center">Mini</div>
                      <div className="text-center text-blue-400">Plus ★</div>
                      <div className="text-center text-purple-400">Premium 👑</div>
                    </div>

                    {/* Row 1: Prix */}
                    <div className="grid grid-cols-5 p-3 border-b border-white/5 items-center">
                      <div className="font-semibold text-white/80">Tarif</div>
                      <div className="text-center text-emerald-400 font-bold">0 F</div>
                      <div className="text-center text-white/90 font-bold">300 F</div>
                      <div className="text-center text-blue-400 font-black">600 F</div>
                      <div className="text-center text-purple-400 font-black">1 200 F</div>
                    </div>

                    {/* Row 2: Crédits inclus */}
                    <div className="grid grid-cols-5 p-3 border-b border-white/5 items-center bg-white/[0.02]">
                      <div className="font-semibold text-white/80 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span>Crédits inclus</span>
                      </div>
                      <div className="text-center text-emerald-300 font-bold">10 / 24h</div>
                      <div className="text-center text-amber-300 font-bold">30</div>
                      <div className="text-center text-amber-300 font-black">60</div>
                      <div className="text-center text-amber-300 font-black">120</div>
                    </div>

                    {/* Row 3: Questions IA */}
                    <div className="grid grid-cols-5 p-3 border-b border-white/5 items-center">
                      <div className="font-semibold text-white/80">Questions IA Shopping</div>
                      <div className="text-center text-white/70 font-semibold">Chaque 24h</div>
                      <div className="text-center text-white/90 font-bold">30 questions</div>
                      <div className="text-center text-emerald-400 font-bold">60 questions</div>
                      <div className="text-center text-emerald-400 font-black">120 questions</div>
                    </div>

                    {/* Row 4: Création d'images & Try On */}
                    <div className="grid grid-cols-5 p-3 border-b border-white/5 items-center bg-white/[0.02]">
                      <div className="font-semibold text-white/80">Images & Try On</div>
                      <div className="text-center text-white/70 font-semibold">Inclus</div>
                      <div className="text-center text-white/90 font-bold">2 images</div>
                      <div className="text-center text-emerald-400 font-bold">5 images</div>
                      <div className="text-center text-emerald-400 font-black">12 images HD</div>
                    </div>

                    {/* Row 6: Stylisme 360° */}
                    <div className="grid grid-cols-5 p-3 border-b border-white/5 items-center bg-white/[0.02]">
                      <div className="font-semibold text-white/80">Essayage virtuel</div>
                      <div className="text-center text-white/50">Standard</div>
                      <div className="text-center text-white/80">Catalogue</div>
                      <div className="text-center text-emerald-400 font-bold">✓ HD 3 Angles</div>
                      <div className="text-center text-emerald-400 font-black">✓ VIP Haute Déf.</div>
                    </div>

                    {/* Row 7: Modèles */}
                    <div className="grid grid-cols-5 p-3 items-center">
                      <div className="font-semibold text-white/80">Modèles IA</div>
                      <div className="text-center text-white/60">MiniMax H3</div>
                      <div className="text-center text-white/80">M3.1 Flash</div>
                      <div className="text-center text-white font-bold">H3 Max & M3.1</div>
                      <div className="text-center text-purple-300 font-black">RodiumAI VIP</div>
                    </div>
                  </div>
                </div>
              )}


              {/* Barème officiel de facturation par action */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Grille tarifaire officielle en vigueur :</span>
                  </h5>
                  <span className="text-[10px] text-amber-300 font-bold bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                    Débit direct
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-xs">
                  {/* Discussion IA */}
                  <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-left flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-blue-300 font-bold flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" />
                          Discussion IA
                        </span>
                        <span className="text-[10px] text-blue-200/60 font-mono">1 question</span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-lg font-black text-white">{AI_BILLING_RATES.CHAT_QUESTION} Crédits</span>
                      </div>
                      <p className="text-[10px] text-white/50 mt-1">Recherche de produits, conseils shopping & chat</p>
                    </div>

                    <button
                      onClick={() => {
                        setIsCreditModalOpen(false);
                        setNavTab('explorer');
                      }}
                      className="mt-2.5 w-full py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 font-bold text-[11px] transition active:scale-95"
                    >
                      Poser une question →
                    </button>
                  </div>

                  {/* Image */}
                  <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-left flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-purple-300 font-bold flex items-center gap-1">
                          <ImageIcon className="w-3.5 h-3.5" />
                          Génération d'image
                        </span>
                        <span className="text-[10px] text-purple-200/60 font-mono">1 image</span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-lg font-black text-white">{AI_BILLING_RATES.IMAGE_GENERATION} Crédits</span>
                      </div>
                      <p className="text-[10px] text-white/50 mt-1">Qwen Image 2.1 Turbo & essayage virtuel HD</p>
                    </div>

                    <button
                      onClick={() => {
                        setIsCreditModalOpen(false);
                        const p = products[0];
                        if (p) openTryOnModal(p);
                      }}
                      className="mt-2.5 w-full py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 font-bold text-[11px] transition active:scale-95"
                    >
                      Essayer une tenue →
                    </button>
                  </div>

                  {/* Vidéo 5s */}
                  <div className="p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-left flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-orange-300 font-bold flex items-center gap-1">
                          <Video className="w-3.5 h-3.5" />
                          Génération Vidéo
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-orange-500/20 text-orange-300 font-bold border border-orange-500/30">
                          Exclusif Vendeurs
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-lg font-black text-white">{AI_BILLING_RATES.VIDEO_GENERATION_5S} Crédits</span>
                        <span className="text-[10px] text-white/40">/ 5 secondes</span>
                      </div>
                      <p className="text-[10px] text-white/50 mt-1">Clips défilés mannequins RodiumAI 5s pour TikTok & WhatsApp</p>
                    </div>

                    <button
                      onClick={() => {
                        if (accountRole !== 'seller') {
                          setSelectedAudience('seller');
                          setActiveTab('plans');
                          showToast("🎬 La génération vidéo RodiumAI est réservée aux abonnés Vendeurs. Choisissez votre forfait ci-dessus !");
                        } else {
                          setIsCreditModalOpen(false);
                          openAiVideoModal();
                        }
                      }}
                      className="mt-2.5 w-full py-1.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 font-bold text-[11px] transition active:scale-95"
                    >
                      {accountRole === 'seller' ? 'Générer une vidéo 5s →' : 'Voir les forfaits Vendeur →'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              TAB: HISTORIQUE DES TRANSACTIONS
              ========================================================================= */}
          {activeTab === 'history' && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider px-1">
                Dernières consommations et recharges de crédits
              </h4>
              {aiCreditHistory.length === 0 ? (
                <p className="text-xs text-white/50 p-4 text-center">Aucune transaction pour le moment.</p>
              ) : (
                <div className="space-y-2">
                  {aiCreditHistory.map((tx) => (
                    <div 
                      key={tx.id}
                      className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                          tx.type === 'spend' 
                            ? 'bg-rose-500/20 text-rose-400' 
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {tx.type === 'spend' ? '-' : '+'}
                        </div>
                        <div>
                          <p className="font-bold text-white text-xs">{tx.label}</p>
                          <p className="text-[10px] text-white/40">{tx.date}</p>
                        </div>
                      </div>

                      <span className={`font-black ${
                        tx.type === 'spend' ? 'text-rose-400' : 'text-emerald-400'
                      }`}>
                        {tx.type === 'spend' ? `-${tx.amount}` : `+${tx.amount}`} crédits
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* =========================================================================
            CHECKOUT / PAYMENT MODAL (GENIUSPAY MOBILE MONEY / CARTE)
            ========================================================================= */}
        {(selectedPlanToUpgrade || selectedCreditPack) && (() => {
          const itemTitle = selectedPlanToUpgrade 
            ? (userPlan === selectedPlanToUpgrade.id ? `Recharger le Forfait ${selectedPlanToUpgrade.name}` : `Souscrire au Forfait ${selectedPlanToUpgrade.name}`)
            : selectedCreditPack?.name;
          const creditsToAdd = selectedPlanToUpgrade ? selectedPlanToUpgrade.creditsGranted : (selectedCreditPack?.credits || 0);
          const priceToPay = selectedPlanToUpgrade ? selectedPlanToUpgrade.priceFcfa : (selectedCreditPack?.priceFcfa || 0);
          const newProjectedBalance = aiCredits + creditsToAdd;

          return (
            <div 
              className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
              onClick={() => { setSelectedPlanToUpgrade(null); setSelectedCreditPack(null); }}
            >
              <div 
                className="bg-[#212121] border border-white/15 rounded-3xl p-5 space-y-4 text-white shadow-2xl max-w-lg mx-auto w-full animate-slideUp"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-bold text-white">
                      {itemTitle}
                    </h4>
                    <p className="text-xs text-amber-300 font-bold">
                      +{creditsToAdd} crédits ajoutés dès confirmation du paiement
                    </p>
                  </div>
                  <button
                    onClick={() => { setSelectedPlanToUpgrade(null); setSelectedCreditPack(null); }}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-white/80 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Explicit Cumulative Credits Banner */}
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-center gap-2.5 font-medium">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <span className="block font-bold text-white">Cumul garanti après validation :</span>
                    <span>
                      Vos <strong>{aiCredits} crédits actuels</strong> + <strong>+{creditsToAdd} nouveaux crédits</strong> = <strong className="text-emerald-300">{newProjectedBalance} crédits au total</strong> !
                    </span>
                  </div>
                </div>

                {/* Price Recap */}
                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white/80 block">Total à régler :</span>
                    <span className="text-[10px] text-white/50">Paiement sécurisé GeniusPay</span>
                  </div>
                  <span className="text-lg font-black text-[#FF6321]">
                    {formatFCFA(priceToPay)}
                  </span>
                </div>

                {/* Payment Methods (Strict GeniusPay Identifiers) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white/80">
                    Mode de paiement :
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'wave', label: 'Wave', color: 'bg-sky-500/20 border-sky-400 text-sky-300' },
                      { id: 'orange_money', label: 'Orange Money', color: 'bg-orange-500/20 border-orange-400 text-orange-300' },
                      { id: 'mtn_momo', label: 'MTN MoMo', color: 'bg-yellow-500/20 border-yellow-400 text-yellow-300' },
                      { id: 'card', label: 'Carte Bancaire', color: 'bg-purple-500/20 border-purple-400 text-purple-300' }
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id as 'wave' | 'orange_money' | 'mtn_momo' | 'card')}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center text-center cursor-pointer ${
                          paymentMethod === m.id 
                            ? m.color + ' ring-1 ring-white/40 font-black' 
                            : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Phone input if mobile money */}
                {paymentMethod !== 'card' && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-white/70">
                      Numéro de téléphone ({paymentMethod === 'wave' ? 'Wave' : paymentMethod === 'orange_money' ? 'Orange Money' : 'MTN MoMo'}) :
                    </label>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-black/40 border border-white/15">
                      <span className="text-xs font-bold text-white/50">+225</span>
                      <input 
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="bg-transparent text-xs font-bold text-white w-full outline-none"
                        placeholder="07 00 00 00 00"
                      />
                    </div>
                  </div>
                )}

                {/* Confirm Button */}
                <button
                  type="button"
                  onClick={handleConfirmUpgrade}
                  disabled={isProcessingPayment}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#FF6321] to-[#FF8038] hover:opacity-95 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl shadow-orange-600/30 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {isProcessingPayment ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Initialisation GeniusPay en cours...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Payer {formatFCFA(priceToPay)}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })()}

        {/* =========================================================================
            PENDING / FAILED PAYMENT STATUS SHEET (HONEST PROVIDER CONFIRMATION)
            ========================================================================= */}
        {pendingCheckout && !selectedPlanToUpgrade && !selectedCreditPack && (
          <div
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
            onClick={() => setPendingCheckout(null)}
          >
            <div
              className="bg-[#212121] border border-white/15 rounded-3xl p-5 space-y-4 text-white shadow-2xl max-w-lg mx-auto w-full animate-slideUp"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    pendingCheckout.status === 'pending'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
                  }`}>
                    {pendingCheckout.status === 'pending' ? (
                      <Clock className="w-5 h-5" />
                    ) : (
                      <XCircle className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">
                      {pendingCheckout.status === 'pending'
                        ? 'Paiement en attente de confirmation'
                        : 'Paiement non confirmé'}
                    </h4>
                    <p className="text-[11px] text-white/60">
                      {pendingCheckout.itemTitle} • Réf. {pendingCheckout.rechargeId}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingCheckout(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-white/80 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className={`p-3.5 rounded-2xl border text-xs leading-relaxed ${
                pendingCheckout.status === 'pending'
                  ? 'bg-amber-500/10 border-amber-400/25 text-amber-100'
                  : 'bg-rose-500/10 border-rose-400/25 text-rose-100'
              }`}>
                <p>{pendingCheckout.message}</p>
                <p className="mt-1.5 font-bold text-white/90">
                  Montant : {formatFCFA(pendingCheckout.amountFcfa)} • Crédits prévus après confirmation : +{pendingCheckout.creditsGranted} crédits
                </p>
              </div>

              <div className="space-y-2">
                {pendingCheckout.checkoutUrl && pendingCheckout.status === 'pending' && (
                  <a
                    href={pendingCheckout.checkoutUrl}
                    target="_top"
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#FF6321] to-[#FF8038] hover:opacity-95 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg transition"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Finaliser le paiement sur GeniusPay</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleCheckPendingStatus}
                  disabled={isCheckingPendingStatus}
                  className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
                >
                  <RotateCw className={`w-4 h-4 ${isCheckingPendingStatus ? 'animate-spin' : ''}`} />
                  <span>
                    {isCheckingPendingStatus
                      ? 'Vérification auprès de GeniusPay...'
                      : 'Vérifier le statut du paiement'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
