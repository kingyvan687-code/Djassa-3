import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft,
  X, 
  Eye, 
  Heart, 
  Share2, 
  ShoppingBag, 
  TrendingUp, 
  Sparkles, 
  MapPin, 
  DollarSign, 
  Percent, 
  Clock, 
  MessageSquare, 
  CheckCircle2, 
  Play, 
  ChevronRight, 
  Edit3, 
  Flame, 
  AlertCircle, 
  BarChart3, 
  Users, 
  Zap, 
  Check, 
  Star, 
  Info, 
  Layers, 
  PackageCheck, 
  Download,
  Sliders,
  Send,
  ArrowUpRight,
  TrendingDown,
  Calendar,
  Award,
  ChevronDown,
  Truck
} from 'lucide-react';
import { Product, Seller } from '../../../types';
import { formatFCFA } from '../../../services/marketServices';
import { DJASSA_FIXED_COMMISSION_FCFA } from '../../../services/commerceService';
import { useApp } from '../../../context/AppContext';

export interface PublicationStats {
  views: number;
  likes: number;
  shares: number;
  comments: number;
  cartAdds: number;
  salesCount: number;
  revenue: number;
  netRevenue: number;
  commission: number;
  conversionRate: number;
  watchDurationSec?: number;
  completionRate?: number;
  topCommunes: { commune: string; percentage: number; sales: number }[];
  dailyViews: { day: string; views: number; sales: number }[];
}

interface Props {
  product: Product;
  stats: PublicationStats;
  seller?: Seller;
  allProducts?: Product[];
  onClose: () => void;
  onOpenViewer?: (product: Product) => void;
  onQuickEdit?: (product: Product) => void;
  onBoost?: (product: Product) => void;
  onSelectOtherProduct?: (product: Product) => void;
}

type AnalysisTab = 'performance' | 'audience' | 'retention' | 'geography' | 'ai_insights' | 'reviews';
type PeriodOption = '7d' | '28d' | '90d' | 'all';

export const PublicationDetailedModal: React.FC<Props> = ({
  product,
  stats,
  seller,
  allProducts = [],
  onClose,
  onOpenViewer,
  onQuickEdit,
  onBoost,
  onSelectOtherProduct,
}) => {
  const { showToast } = useApp();

  // Tab & Period state
  const [activeTab, setActiveTab] = useState<AnalysisTab>('performance');
  const [period, setPeriod] = useState<PeriodOption>('28d');
  const [chartMetric, setChartMetric] = useState<'sales' | 'views' | 'revenue'>('revenue');

  // Profit & Price simulator state
  const [simulatedPrice, setSimulatedPrice] = useState<number>(product.price);
  const [simulatedDiscount, setSimulatedDiscount] = useState<number>(product.discountPercentage || 0);

  // Boost simulator state
  const [boostBudget, setBoostBudget] = useState<number>(7500);

  // Reviews mock response state
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const [repliedList, setRepliedList] = useState<{ [key: string]: string }>({
    'rev-1': 'Merci beaucoup Aïcha ! Ravie que le pagne vous plaise !',
  });

  const isVideo = product.mediaType === 'video' || Boolean(product.videoUrl);
  const mediaUrl = isVideo ? (product.videoPoster || product.images[0]) : product.images[0];

  // Dynamic multiplier based on chosen period
  const periodMultiplier = useMemo(() => {
    switch (period) {
      case '7d': return 0.28;
      case '28d': return 1.0;
      case '90d': return 2.8;
      case 'all': return 4.1;
      default: return 1.0;
    }
  }, [period]);

  // Dynamically adjusted stats for the selected period
  const currentStats = useMemo(() => {
    const periodViews = Math.max(12, Math.round(stats.views * periodMultiplier));
    const periodSales = Math.max(1, Math.round(stats.salesCount * periodMultiplier));
    const periodLikes = Math.max(4, Math.round(stats.likes * periodMultiplier));
    const periodShares = Math.max(1, Math.round(stats.shares * periodMultiplier));
    const periodComments = Math.max(1, Math.round(stats.comments * periodMultiplier));
    const periodCartAdds = Math.max(3, Math.round(stats.cartAdds * periodMultiplier));
    const revenue = periodSales * product.price;
    const commission = periodSales * DJASSA_FIXED_COMMISSION_FCFA; // Commission fixe 150 FCFA / commande
    const netRevenue = Math.max(0, revenue - commission);
    const conversionRate = Number(((periodSales / Math.max(periodViews, 1)) * 100).toFixed(2));

    const dailyData = [
      { day: 'Lun', views: Math.round(periodViews * 0.11), sales: Math.max(0, Math.round(periodSales * 0.10)), revenue: Math.round(revenue * 0.10) },
      { day: 'Mar', views: Math.round(periodViews * 0.12), sales: Math.max(0, Math.round(periodSales * 0.12)), revenue: Math.round(revenue * 0.12) },
      { day: 'Mer', views: Math.round(periodViews * 0.14), sales: Math.max(0, Math.round(periodSales * 0.14)), revenue: Math.round(revenue * 0.14) },
      { day: 'Jeu', views: Math.round(periodViews * 0.13), sales: Math.max(0, Math.round(periodSales * 0.13)), revenue: Math.round(revenue * 0.13) },
      { day: 'Ven', views: Math.round(periodViews * 0.18), sales: Math.max(1, Math.round(periodSales * 0.19)), revenue: Math.round(revenue * 0.19) },
      { day: 'Sam', views: Math.round(periodViews * 0.20), sales: Math.max(1, Math.round(periodSales * 0.22)), revenue: Math.round(revenue * 0.22) },
      { day: 'Dim', views: Math.round(periodViews * 0.12), sales: Math.max(0, Math.round(periodSales * 0.10)), revenue: Math.round(revenue * 0.10) },
    ];

    return {
      views: periodViews,
      salesCount: periodSales,
      likes: periodLikes,
      shares: periodShares,
      comments: periodComments,
      cartAdds: periodCartAdds,
      revenue,
      commission,
      netRevenue,
      conversionRate,
      dailyData,
      topCommunes: stats.topCommunes.map((c) => ({
        ...c,
        sales: Math.max(1, Math.round(periodSales * (c.percentage / 100))),
      })),
    };
  }, [stats, periodMultiplier, product.price]);

  // Video retention curve data points
  const videoRetentionData = useMemo(() => {
    return [
      { sec: '0s', label: 'Début', pct: 100, note: 'Lancement de la vidéo' },
      { sec: '3s', label: 'Accroche', pct: 89, note: 'Taux de rétention initial élevé' },
      { sec: '6s', label: 'Détails', pct: 81, note: 'Présentation du tissu & finitions' },
      { sec: '10s', label: 'Porté', pct: 75, note: 'Mannequin en mouvement' },
      { sec: '15s', label: 'Offre', pct: 68, note: 'Affichage du prix & livraison' },
      { sec: '20s', label: 'CTA', pct: 62, note: 'Bouton commander en bas' },
      { sec: '25s+', label: 'Fin', pct: 54, note: 'Complétion totale' },
    ];
  }, []);

  // Customer reviews for this publication
  const mockReviews = [
    {
      id: 'rev-1',
      author: 'Aïcha Traoré',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      commune: 'Cocody Riviera 3',
      rating: 5,
      date: 'Il y a 2 jours',
      comment: 'Superbe robe ! La coupe wax est impeccable et la livraison a été faite en 45 minutes par la boutique. Je recommande les yeux fermés !',
      verified: true,
      likes: 8,
    },
    {
      id: 'rev-2',
      author: 'Kouassi Marc',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
      commune: 'Yopougon Maroc',
      rating: 5,
      date: 'Il y a 5 jours',
      comment: 'Cadeau acheté pour mon épouse, elle a adoré la qualité des coutures et la doublure. Paiement Wave à la commande simple et rapide.',
      verified: true,
      likes: 5,
    },
    {
      id: 'rev-3',
      author: 'Fatou Diabate',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80',
      commune: 'Marcory Zone 4',
      rating: 4,
      date: 'Il y a 1 semaine',
      comment: 'Très joli modèle. Taille un tout petit peu grand au niveau des épaules mais le tissu est de vraie qualité hollandaise.',
      verified: true,
      likes: 3,
    },
  ];

  // Frequently Asked Questions received via chat for this item
  const commonQuestions = [
    {
      q: 'Est-ce que la livraison est possible aujourd\'hui à Cocody ou Yopougon ?',
      suggestedReply: 'Oui absolument ! Notre boutique organise l\'expédition le jour même partout à Abidjan (0 F frais de livraison Djassa). Vous pouvez commander directement !',
    },
    {
      q: 'Avez-vous d\'autres tailles disponibles en stock ?',
      suggestedReply: 'Oui, nous avons encore les tailles M, L et XL disponibles en stock immédiat. Précisez votre taille lors de l\'achat.',
    },
    {
      q: 'Peut-on payer par Wave, Orange Money ou à la livraison ?',
      suggestedReply: 'Tout à fait ! Vous pouvez choisir Paiement en ligne (Wave ou Orange Money) ou Paiement à la livraison (0% frais client) sur Djassa.',
    },
  ];

  // Copy quick reply helper
  const handleCopyQuickReply = (text: string) => {
    navigator.clipboard?.writeText(text);
    showToast('Réponse rapide copiée dans le presse-papier !');
  };

  // Submit vendor reply
  const handleSubmitReply = (reviewId: string) => {
    const text = replyText[reviewId];
    if (!text || !text.trim()) return;
    setRepliedList((prev) => ({ ...prev, [reviewId]: text.trim() }));
    setReplyText((prev) => ({ ...prev, [reviewId]: '' }));
    showToast('Votre réponse au client a été publiée !');
  };

  // Download complete report
  const handleExportFullReport = () => {
    const reportData = `RAPPORT D'ANALYSE DÉTAILLÉ DE PUBLICATION - DJASSA
--------------------------------------------------
Publication: ${product.name}
ID: ${product.id}
Catégorie: ${product.category}
Date d'analyse: ${new Date().toLocaleDateString('fr-FR')}
Période: ${period === '7d' ? '7 derniers jours' : period === '28d' ? '28 derniers jours' : period === '90d' ? '90 derniers jours' : 'Depuis la publication'}

PERFORMANCE FINANCIÈRE:
- Vues totales: ${currentStats.views.toLocaleString('fr-FR')}
- Ventes confirmées: ${currentStats.salesCount} unités
- Prix unitaire: ${formatFCFA(product.price)}
- Chiffre d'Affaires Brut: ${formatFCFA(currentStats.revenue)}
- Commission fixe Djassa (${DJASSA_FIXED_COMMISSION_FCFA} F/cmd): -${formatFCFA(currentStats.commission)}
- Net Vendeur estimé: ${formatFCFA(currentStats.netRevenue)}
- Taux de conversion global: ${currentStats.conversionRate}%

RÉPARTITION GÉOGRAPHIQUE ABIDJAN:
${currentStats.topCommunes.map((c) => `- ${c.commune}: ${c.sales} ventes (${c.percentage}%)`).join('\n')}

DIAGNOSTIC DJASSA IA:
- Score global d'efficacité: 92/100
- Statut de stock: ${product.inStock ? `${product.stock ?? 12} unités en stock` : 'Rupture'}
--------------------------------------------------
Généré avec succès sur Djassa Vendeur Pro.`;

    const blob = new Blob([reportData], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Analyse_${product.name.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Rapport complet de publication téléchargé avec succès !');
  };

  // Max value for chart scaling
  const maxChartValue = useMemo(() => {
    return Math.max(...currentStats.dailyData.map((d) => d[chartMetric]), 1);
  }, [currentStats.dailyData, chartMetric]);

  return (
    <div
      id="publication-detailed-page"
      className="fixed inset-0 z-[120] bg-[#0A0A0A] text-white flex flex-col overflow-y-auto no-scrollbar"
    >
      {/* 1. TOP STICKY APP BAR */}
      <header className="sticky top-0 z-40 bg-[#121212]/95 backdrop-blur-xl border-b border-white/10 px-4 py-3 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Back button & Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              id="btn-back-to-stats-dashboard"
              onClick={onClose}
              className="p-2 -ml-1 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 transition flex items-center gap-1.5 active:scale-95 shrink-0"
              title="Retour aux statistiques"
            >
              <ArrowLeft className="w-4 h-4 text-[#FF6321]" />
              <span className="text-xs font-bold hidden sm:inline">Statistiques</span>
            </button>

            {/* Thumbnail and Title */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-neutral-900 border border-white/15 shrink-0">
                <img
                  src={mediaUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                {isVideo && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Play className="w-3 h-3 text-white fill-white" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[#FF6321]/20 text-[#FF6321] border border-[#FF6321]/30 shrink-0">
                    {isVideo ? 'Vidéo Vitrine' : 'Photo Catalogue'}
                  </span>
                  <span className="text-[11px] text-white/40 hidden md:inline">• {product.category}</span>
                </div>
                <h1 className="text-xs sm:text-sm font-black text-white truncate">{product.name}</h1>
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {onOpenViewer && (
              <button
                id="btn-header-preview-publication"
                onClick={() => onOpenViewer(product)}
                className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                title="Aperçu de la publication"
              >
                <Eye className="w-3.5 h-3.5 text-white/70" />
                <span className="hidden md:inline">Voir</span>
              </button>
            )}

            {onQuickEdit && (
              <button
                id="btn-header-quick-edit-publication"
                onClick={() => onQuickEdit(product)}
                className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                title="Modifier prix et stock"
              >
                <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden md:inline">Éditer</span>
              </button>
            )}

            {onBoost && (
              <button
                id="btn-header-boost-publication"
                onClick={() => onBoost(product)}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#FF6321] to-[#ff7d45] hover:brightness-110 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-orange-600/20 transition active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Booster</span>
              </button>
            )}

            <button
              onClick={handleExportFullReport}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition active:scale-95"
              title="Exporter le rapport"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              id="btn-close-publication-page"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTAINER */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6 pb-28">
        
        {/* HERO PUBLICATION OVERVIEW CARD */}
        <section className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-[#161616] via-[#121212] to-[#1c1410] border border-white/10 relative overflow-hidden shadow-2xl">
          {/* Decorative background glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#FF6321]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-black border-2 border-white/15 shrink-0 shadow-lg group">
                <img
                  src={mediaUrl}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {isVideo && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Play className="w-6 h-6 text-white fill-white drop-shadow" />
                  </div>
                )}
                {product.isPromotion && (
                  <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-rose-500 text-[9px] font-black text-white">
                    PROMO
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FF6321] text-white">
                    Analyse Approfondie
                  </span>
                  <span className="text-xs text-white/50">{product.category}</span>
                  <span className="text-xs text-white/40">• SKU: #{product.id.slice(0, 8)}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">{product.name}</h2>
                <div className="flex items-center gap-3 text-xs text-white/70 flex-wrap pt-0.5">
                  <span className="text-emerald-400 font-extrabold text-sm">
                    {formatFCFA(product.price)}
                  </span>
                  <span className="text-white/40">|</span>
                  <span className="flex items-center gap-1 text-white/80">
                    <PackageCheck className="w-3.5 h-3.5 text-blue-400" />
                    Stock : <b className="text-white">{product.stock ?? 12} unités</b>
                  </span>
                  <span className="text-white/40">|</span>
                  <span className="flex items-center gap-1 text-amber-400">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    4.8 (42 avis acheteurs)
                  </span>
                </div>
              </div>
            </div>

            {/* Time Period Selector Buttons */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 pt-2 md:pt-0">
              <div className="p-1 rounded-2xl bg-black/60 border border-white/10 flex items-center gap-1 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setPeriod('7d')}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    period === '7d'
                      ? 'bg-[#FF6321] text-white shadow-md'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  7 Jours
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod('28d')}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    period === '28d'
                      ? 'bg-[#FF6321] text-white shadow-md'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  28 Jours
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod('90d')}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    period === '90d'
                      ? 'bg-[#FF6321] text-white shadow-md'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  90 Jours
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod('all')}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    period === 'all'
                      ? 'bg-[#FF6321] text-white shadow-md'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Tout
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 3. EXECUTIVE KPI CARDS */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Chiffre d'affaires brut */}
          <div className="p-4 rounded-2xl bg-[#141414] border border-white/10 space-y-2 hover:border-[#FF6321]/40 transition">
            <div className="flex items-center justify-between text-white/50 text-xs font-medium">
              <span>Chiffre d'Affaires</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <b className="text-lg sm:text-2xl font-black text-white block">
                {formatFCFA(currentStats.revenue)}
              </b>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold mt-1">
                <TrendingUp className="w-3 h-3" />
                <span>+24.8% vs période préc.</span>
              </div>
            </div>
          </div>

          {/* Card 2: Net Vendeur */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/30 to-[#141414] border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between text-emerald-400 text-xs font-bold">
              <span>Net Vendeur Estimé</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                150 F / cmd
              </span>
            </div>
            <div>
              <b className="text-lg sm:text-2xl font-black text-emerald-400 block">
                {formatFCFA(currentStats.netRevenue)}
              </b>
              <p className="text-[10px] text-white/40 mt-1">
                Commission fixe Djassa déduite ({formatFCFA(currentStats.commission)})
              </p>
            </div>
          </div>

          {/* Card 3: Commandes & Ventes */}
          <div className="p-4 rounded-2xl bg-[#141414] border border-white/10 space-y-2 hover:border-[#FF6321]/40 transition">
            <div className="flex items-center justify-between text-white/50 text-xs font-medium">
              <span>Commandes Confirmées</span>
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                <ShoppingBag className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <b className="text-lg sm:text-2xl font-black text-white block">
                {currentStats.salesCount} ventes
              </b>
              <div className="flex items-center gap-1.5 text-[11px] text-blue-400 font-bold mt-1">
                <span>Panier : {formatFCFA(product.price)}</span>
                <span className="text-white/30">•</span>
                <span>0 retour</span>
              </div>
            </div>
          </div>

          {/* Card 4: Taux de Conversion */}
          <div className="p-4 rounded-2xl bg-[#141414] border border-white/10 space-y-2 hover:border-[#FF6321]/40 transition">
            <div className="flex items-center justify-between text-white/50 text-xs font-medium">
              <span>Taux de Conversion</span>
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                <Percent className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <b className="text-lg sm:text-2xl font-black text-amber-400 block">
                {currentStats.conversionRate}%
              </b>
              <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-bold mt-1">
                <Award className="w-3 h-3" />
                <span>Top 12% des publications</span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. TAB NAVIGATION BAR */}
        <section className="border-b border-white/10 flex items-center gap-2 overflow-x-auto no-scrollbar pt-2">
          <button
            id="tab-btn-performance"
            onClick={() => setActiveTab('performance')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
              activeTab === 'performance'
                ? 'text-[#FF6321] border-[#FF6321]'
                : 'text-white/50 hover:text-white border-transparent'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Finances & Ventes</span>
          </button>

          <button
            id="tab-btn-audience"
            onClick={() => setActiveTab('audience')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
              activeTab === 'audience'
                ? 'text-[#FF6321] border-[#FF6321]'
                : 'text-white/50 hover:text-white border-transparent'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Audience & Entonnoir</span>
          </button>

          <button
            id="tab-btn-retention"
            onClick={() => setActiveTab('retention')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
              activeTab === 'retention'
                ? 'text-[#FF6321] border-[#FF6321]'
                : 'text-white/50 hover:text-white border-transparent'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{isVideo ? 'Rétention Vidéo' : 'Comportement Visuel'}</span>
          </button>

          <button
            id="tab-btn-geography"
            onClick={() => setActiveTab('geography')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
              activeTab === 'geography'
                ? 'text-[#FF6321] border-[#FF6321]'
                : 'text-white/50 hover:text-white border-transparent'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Communes & Logistique</span>
          </button>

          <button
            id="tab-btn-ai-insights"
            onClick={() => setActiveTab('ai_insights')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
              activeTab === 'ai_insights'
                ? 'text-[#FF6321] border-[#FF6321]'
                : 'text-white/50 hover:text-white border-transparent'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Diagnostic IA & Boost</span>
          </button>

          <button
            id="tab-btn-reviews"
            onClick={() => setActiveTab('reviews')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
              activeTab === 'reviews'
                ? 'text-[#FF6321] border-[#FF6321]'
                : 'text-white/50 hover:text-white border-transparent'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Avis Clients ({mockReviews.length})</span>
          </button>
        </section>

        {/* 5. TAB CONTENT PANELS */}

        {/* TAB 1: FINANCES & VENTES */}
        {activeTab === 'performance' && (
          <div className="space-y-6">
            {/* Interactive Timeline Chart */}
            <div className="p-5 rounded-3xl bg-[#141414] border border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#FF6321]" />
                    Évolution Quotidienne de la Publication
                  </h3>
                  <p className="text-xs text-white/50">Performance détaillée jour par jour sur la période</p>
                </div>

                {/* Metric toggle */}
                <div className="p-1 rounded-xl bg-black/60 border border-white/10 flex items-center gap-1 self-start">
                  <button
                    onClick={() => setChartMetric('revenue')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      chartMetric === 'revenue' ? 'bg-[#FF6321] text-white' : 'text-white/50 hover:text-white'
                    }`}
                  >
                    Chiffre d'Affaires
                  </button>
                  <button
                    onClick={() => setChartMetric('sales')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      chartMetric === 'sales' ? 'bg-[#FF6321] text-white' : 'text-white/50 hover:text-white'
                    }`}
                  >
                    Ventes
                  </button>
                  <button
                    onClick={() => setChartMetric('views')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      chartMetric === 'views' ? 'bg-[#FF6321] text-white' : 'text-white/50 hover:text-white'
                    }`}
                  >
                    Vues
                  </button>
                </div>
              </div>

              {/* Bar Chart Visualizer */}
              <div className="pt-6 pb-2">
                <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-44 border-b border-white/10 pb-2">
                  {currentStats.dailyData.map((item, idx) => {
                    const value = item[chartMetric];
                    const heightPercent = Math.max(12, Math.round((value / maxChartValue) * 100));

                    return (
                      <div key={idx} className="flex flex-col items-center gap-2 group h-full justify-end">
                        {/* Tooltip on hover */}
                        <span className="text-[10px] font-bold text-[#FF6321] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {chartMetric === 'revenue' ? formatFCFA(value) : value.toLocaleString('fr-FR')}
                        </span>
                        <div
                          className="w-full max-w-[36px] bg-gradient-to-t from-[#FF6321]/60 to-[#FF6321] rounded-t-xl group-hover:brightness-125 transition-all duration-300 shadow-sm"
                          style={{ height: `${heightPercent}%` }}
                        />
                        <span className="text-xs font-bold text-white/60 group-hover:text-white transition">
                          {item.day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Financial Statement & Payment Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card A: Financial Breakdown */}
              <div className="p-5 rounded-3xl bg-[#141414] border border-white/10 space-y-4">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  Décomposition Financière
                </h4>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-white/5">
                    <span className="text-white/60">Prix unitaire affiché</span>
                    <b className="text-white font-bold">{formatFCFA(product.price)}</b>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-white/5">
                    <span className="text-white/60">Nombre total de pièces vendues</span>
                    <b className="text-white font-bold">{currentStats.salesCount} articles</b>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-white/5">
                    <span className="text-white/60">Chiffre d'Affaires Brut</span>
                    <b className="text-white font-black">{formatFCFA(currentStats.revenue)}</b>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-white/5 text-rose-400">
                    <span>Commission fixe Djassa ({DJASSA_FIXED_COMMISSION_FCFA} F / cmd)</span>
                    <b className="font-bold">-{formatFCFA(currentStats.commission)}</b>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <span className="font-extrabold uppercase text-[11px]">Net vendeur sur vos ventes</span>
                    <b className="text-base font-black">{formatFCFA(currentStats.netRevenue)}</b>
                  </div>
                </div>
              </div>

              {/* Card B: Payment methods used by buyers */}
              <div className="p-5 rounded-3xl bg-[#141414] border border-white/10 space-y-4">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4 text-[#FF6321]" />
                  Modes de Paiement des Acheteurs
                </h4>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white font-bold flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                        Wave Côte d'Ivoire (En ligne)
                      </span>
                      <span className="text-white/70 font-semibold">56% des commandes</span>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                      <div className="bg-cyan-400 h-full rounded-full" style={{ width: '56%' }} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white font-bold flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                        Orange Money CI (En ligne)
                      </span>
                      <span className="text-white/70 font-semibold">26% des commandes</span>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                      <div className="bg-orange-500 h-full rounded-full" style={{ width: '26%' }} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white font-bold flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                        Paiement à la livraison (0% frais client)
                      </span>
                      <span className="text-white/70 font-semibold">18% des commandes</span>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-400 h-full rounded-full" style={{ width: '18%' }} />
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-2 text-[11px] text-white/60 mt-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Reversement direct sur votre Wave ou Orange Money pour les achats en ligne confirmés.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Price & Profit Simulator */}
            <div className="p-5 rounded-3xl bg-[#141414] border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#FF6321]" />
                    Simulateur de Prix & Marge
                  </h4>
                  <p className="text-xs text-white/50">Testez l'impact d'un ajustement de prix sur vos bénéfices</p>
                </div>
                {onQuickEdit && (
                  <button
                    onClick={() => onQuickEdit(product)}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition flex items-center gap-1"
                  >
                    <span>Appliquer en boutique</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="space-y-2">
                  <label className="text-xs text-white/60 font-medium block">
                    Prix de vente testé (FCFA)
                  </label>
                  <input
                    type="number"
                    value={simulatedPrice}
                    onChange={(e) => setSimulatedPrice(Math.max(100, Number(e.target.value)))}
                    step="500"
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-sm focus:outline-none focus:border-[#FF6321]"
                  />
                </div>

                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-[10px] text-white/50 uppercase font-bold block">Commission fixe Djassa</span>
                  <b className="text-base text-rose-400 font-black block mt-0.5">
                    -{formatFCFA(DJASSA_FIXED_COMMISSION_FCFA)}
                  </b>
                  <span className="text-[10px] text-white/40 block mt-0.5">Par commande confirmée</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                  <span className="text-[10px] text-emerald-400 uppercase font-black block">Net Vendeur Estimé</span>
                  <b className="text-lg text-emerald-400 font-black block mt-0.5">
                    {formatFCFA(Math.max(0, simulatedPrice - DJASSA_FIXED_COMMISSION_FCFA))}
                  </b>
                  <span className="text-[10px] text-emerald-400/80 block mt-0.5">Gain net après commission de 150 F</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AUDIENCE & ENTONNOIR */}
        {activeTab === 'audience' && (
          <div className="space-y-6">
            {/* Step-by-Step Conversion Funnel */}
            <div className="p-5 rounded-3xl bg-[#141414] border border-white/10 space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#FF6321]" />
                  Entonnoir de Conversion de la Publication
                </h3>
                <p className="text-xs text-white/50">De la première vue jusqu'au paiement finalisé à Abidjan</p>
              </div>

              {/* Visual Funnel */}
              <div className="space-y-3">
                {/* Step 1: Vues */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/10 text-white">
                      <Eye className="w-4 h-4" />
                    </div>
                    <div>
                      <b className="text-xs text-white block">1. Vues de la publication</b>
                      <span className="text-[10px] text-white/40">Spectateurs ayant vu le média dans leur fil</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <b className="text-sm font-black text-white">{currentStats.views.toLocaleString('fr-FR')}</b>
                    <span className="text-[10px] text-emerald-400 font-bold block">100% de l'audience</span>
                  </div>
                </div>

                {/* Step 2: Clics Fiche Produit */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between ml-2 sm:ml-4 border-l-2 border-l-[#FF6321]">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[#FF6321]/15 text-[#FF6321]">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                    <div>
                      <b className="text-xs text-white block">2. Clics & Visites de la fiche</b>
                      <span className="text-[10px] text-white/40">Utilisateurs ayant ouvert les détails ou zoomé</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <b className="text-sm font-black text-white">{Math.round(currentStats.views * 0.38).toLocaleString('fr-FR')}</b>
                    <span className="text-[10px] text-[#FF6321] font-bold block">38.0% d'engagement</span>
                  </div>
                </div>

                {/* Step 3: Ajouts Panier */}
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between ml-4 sm:ml-8 border-l-2 border-l-blue-400">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div>
                      <b className="text-xs text-white block">3. Ajouts au panier</b>
                      <span className="text-[10px] text-white/40">Intention d'achat confirmée par le client</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <b className="text-sm font-black text-white">{currentStats.cartAdds.toLocaleString('fr-FR')}</b>
                    <span className="text-[10px] text-blue-400 font-bold block">
                      {((currentStats.cartAdds / currentStats.views) * 100).toFixed(1)}% des vues
                    </span>
                  </div>
                </div>

                {/* Step 4: Commandes Finalisées */}
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between ml-6 sm:ml-12">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <b className="text-xs text-emerald-400 block">4. Commandes payées & livrées</b>
                      <span className="text-[10px] text-emerald-400/70">Achat finalisé avec succès</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <b className="text-sm font-black text-emerald-400">{currentStats.salesCount} commandes</b>
                    <span className="text-[10px] text-emerald-300 font-black block">
                      {currentStats.conversionRate}% taux final
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Traffic Sources & Peak Hours */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Traffic Sources */}
              <div className="p-5 rounded-3xl bg-[#141414] border border-white/10 space-y-4">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#FF6321]" />
                  Origine du Trafic
                </h4>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white font-medium">Fil "Pour Vous" (Algorithme)</span>
                      <b className="text-white">68% ({(currentStats.views * 0.68).toFixed(0)} vues)</b>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#FF6321] h-full rounded-full" style={{ width: '68%' }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white font-medium">Visite directe de votre Boutique</span>
                      <b className="text-white">18% ({(currentStats.views * 0.18).toFixed(0)} vues)</b>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-400 h-full rounded-full" style={{ width: '18%' }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white font-medium">Recherche par mots-clés</span>
                      <b className="text-white">9% ({(currentStats.views * 0.09).toFixed(0)} vues)</b>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-400 h-full rounded-full" style={{ width: '9%' }} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white font-medium">Partages WhatsApp & Liens</span>
                      <b className="text-white">5% ({(currentStats.views * 0.05).toFixed(0)} vues)</b>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                      <div className="bg-purple-400 h-full rounded-full" style={{ width: '5%' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Peak Buying Hours */}
              <div className="p-5 rounded-3xl bg-[#141414] border border-white/10 space-y-4">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  Heures de Vente Privilégiées
                </h4>

                <div className="space-y-3">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <div>
                      <b className="text-xs text-white block">Pause Déjeuner (12h - 14h)</b>
                      <span className="text-[10px] text-white/50">Achats au bureau à Abidjan</span>
                    </div>
                    <span className="text-xs font-black text-amber-400">32% des ventes</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <div>
                      <b className="text-xs text-white block">Soirée Détente (19h - 22h)</b>
                      <span className="text-[10px] text-white/50">Session vidéo TikTok à domicile</span>
                    </div>
                    <span className="text-xs font-black text-[#FF6321]">48% des ventes 🔥</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <div>
                      <b className="text-xs text-white block">Matinée (08h - 11h)</b>
                      <span className="text-[10px] text-white/50">Consultation des nouveautés</span>
                    </div>
                    <span className="text-xs font-black text-white/60">20% des ventes</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: RETENTION VIDEO / VISUELLE */}
        {activeTab === 'retention' && (
          <div className="space-y-6">
            {isVideo ? (
              <>
                {/* Video Retention Overview */}
                <div className="p-5 rounded-3xl bg-[#141414] border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Clock className="w-4 h-4 text-purple-400" />
                        Courbe de Rétention Vidéo Seconde par Seconde
                      </h3>
                      <p className="text-xs text-white/50">Analyse du comportement des spectateurs tout au long de la vidéo</p>
                    </div>
                    <span className="text-xs px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 font-bold">
                      Taux de complétion : {stats.completionRate || 74}%
                    </span>
                  </div>

                  {/* Retention Points List */}
                  <div className="space-y-3 pt-2">
                    {videoRetentionData.map((item, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-white font-bold flex items-center gap-2">
                            <span className="text-[#FF6321]">{item.sec}</span>
                            <span className="text-white/80">{item.label}</span>
                            <span className="text-[10px] text-white/40 hidden sm:inline">• {item.note}</span>
                          </span>
                          <span className="text-white font-extrabold">{item.pct}%</span>
                        </div>
                        <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-purple-500 via-[#FF6321] to-emerald-400"
                            style={{ width: `${item.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Key Retention Insights */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-[#141414] border border-white/10 text-center space-y-1">
                    <span className="text-[11px] text-white/50 block">Taux d'Accroche (3s)</span>
                    <b className="text-xl font-black text-emerald-400">89%</b>
                    <p className="text-[10px] text-white/40">Excellent début de vidéo</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#141414] border border-white/10 text-center space-y-1">
                    <span className="text-[11px] text-white/50 block">Temps Moyen de Visionnage</span>
                    <b className="text-xl font-black text-purple-400">{stats.watchDurationSec || 24}s</b>
                    <p className="text-[10px] text-white/40">Sur 30 secondes totales</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#141414] border border-white/10 text-center space-y-1">
                    <span className="text-[11px] text-white/50 block">Taux de Re-visionnage</span>
                    <b className="text-xl font-black text-[#FF6321]">+38%</b>
                    <p className="text-[10px] text-white/40">Vidéo vue plus d'une fois</p>
                  </div>
                </div>
              </>
            ) : (
              /* Photo Publication Behaviour */
              <div className="p-5 rounded-3xl bg-[#141414] border border-white/10 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-400" />
                  Comportement des Acheteurs sur les Photos
                </h3>
                <p className="text-xs text-white/50">Interactions avec le carrousel d'images et les détails produits</p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <span className="text-xs text-white/50 block">Swipe dans le carrousel</span>
                    <b className="text-xl font-black text-blue-400 block mt-1">82%</b>
                    <span className="text-[10px] text-white/40">Regardent plus de 2 photos</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <span className="text-xs text-white/50 block">Zoom sur le tissu/détail</span>
                    <b className="text-xl font-black text-emerald-400 block mt-1">64%</b>
                    <span className="text-[10px] text-white/40">Vérifient les finitions</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <span className="text-xs text-white/50 block">Temps moyen sur la fiche</span>
                    <b className="text-xl font-black text-amber-400 block mt-1">42s</b>
                    <span className="text-[10px] text-white/40">Lecture de la description</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: COMMUNES & LOGISTIQUE */}
        {activeTab === 'geography' && (
          <div className="space-y-6">
            {/* Abidjan Communes Breakdown */}
            <div className="p-5 rounded-3xl bg-[#141414] border border-white/10 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#FF6321]" />
                  Répartition des Acheteurs par Commune d'Abidjan
                </h3>
                <p className="text-xs text-white/50">Zones géographiques générant le plus de commandes pour cet article</p>
              </div>

              <div className="space-y-3 pt-1">
                {currentStats.topCommunes.map((c, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white font-bold flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#FF6321]" />
                        {c.commune}
                      </span>
                      <span className="text-white font-black">
                        {c.sales} commandes <span className="text-white/50 font-normal">({c.percentage}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#FF6321] h-full rounded-full"
                        style={{ width: `${c.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery & Buyer Profile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-3xl bg-[#141414] border border-white/10 space-y-3">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Truck className="w-4 h-4 text-emerald-400" />
                  Organisation de la livraison
                </h4>
                <div className="space-y-2">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
                    <div>
                      <b className="text-white block">Livraison gérée par la boutique (externe)</b>
                      <span className="text-[10px] text-white/50">0 F frais de livraison Djassa</span>
                    </div>
                    <b className="text-emerald-400 font-bold">100%</b>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-[#141414] border border-white/10 space-y-3">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  Profil des Acheteurs
                </h4>
                <div className="space-y-2">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
                    <div>
                      <b className="text-white block">Nouveaux Clients Découverte</b>
                      <span className="text-[10px] text-white/50">Premier achat dans votre boutique</span>
                    </div>
                    <b className="text-blue-400 font-bold">65%</b>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
                    <div>
                      <b className="text-white block">Clients Fidèles Récurrents</b>
                      <span className="text-[10px] text-white/50">Déjà clients de votre boutique</span>
                    </div>
                    <b className="text-emerald-400 font-bold">35%</b>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: DIAGNOSTIC IA & BOOST */}
        {activeTab === 'ai_insights' && (
          <div className="space-y-6">
            {/* AI Score Banner */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-amber-500/15 via-[#141414] to-[#181818] border border-amber-500/30 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Diagnostic IA Djassa : Score 92/100</h3>
                    <p className="text-xs text-amber-300/80">Publication à très fort potentiel commercial</p>
                  </div>
                </div>
                <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                  Top Performance 🔥
                </span>
              </div>

              {/* Actionable Recommendations List */}
              <div className="space-y-2.5 pt-2">
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <b className="text-white block">Points forts détectés :</b>
                    <p className="text-white/60 mt-0.5">
                      Taux d'accroche exceptionnel (89%) et prix positionné de manière très compétitive pour le marché d'Abidjan.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <b className="text-white block">Alerte de Stock Préventive :</b>
                    <p className="text-white/60 mt-0.5">
                      Au rythme actuel des ventes, votre stock sera épuisé dans environ 4 jours. Pensez à réapprovisionner ou ajuster le stock.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3">
                  <Zap className="w-4 h-4 text-[#FF6321] shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <b className="text-white block">Optimisation du Panier :</b>
                    <p className="text-white/60 mt-0.5">
                      Les acheteurs de cette robe consultent également vos chaussures et accessoires. Proposer une offre pack vous permettra de doubler le panier moyen.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Boost Simulator */}
            <div className="p-5 rounded-3xl bg-[#141414] border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Flame className="w-4 h-4 text-[#FF6321]" />
                    Simulateur de Propulsion Djassa Boost
                  </h4>
                  <p className="text-xs text-white/50">Estimez la portée et les ventes additionnelles avant d'activer</p>
                </div>
                {onBoost && (
                  <button
                    onClick={() => onBoost(product)}
                    className="px-4 py-2 rounded-xl bg-[#FF6321] hover:bg-[#ff763d] text-white text-xs font-black transition flex items-center gap-1.5 shadow-lg shadow-orange-600/20"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Lancer un Boost</span>
                  </button>
                )}
              </div>

              {/* Budget selector buttons */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBoostBudget(3000)}
                  className={`p-3 rounded-2xl border text-center transition ${
                    boostBudget === 3000
                      ? 'bg-[#FF6321]/15 border-[#FF6321] text-white'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  <b className="text-xs block">Flash (48h)</b>
                  <span className="text-sm font-black text-[#FF6321] block mt-1">3 000 FCFA</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBoostBudget(7500)}
                  className={`p-3 rounded-2xl border text-center transition ${
                    boostBudget === 7500
                      ? 'bg-[#FF6321]/15 border-[#FF6321] text-white'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  <b className="text-xs block">Pro (7 jours) 🔥</b>
                  <span className="text-sm font-black text-[#FF6321] block mt-1">7 500 FCFA</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBoostBudget(15000)}
                  className={`p-3 rounded-2xl border text-center transition ${
                    boostBudget === 15000
                      ? 'bg-[#FF6321]/15 border-[#FF6321] text-white'
                      : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  <b className="text-xs block">Campagne Virale</b>
                  <span className="text-sm font-black text-[#FF6321] block mt-1">15 000 FCFA</span>
                </button>
              </div>

              {/* Simulation projection box */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
                <div>
                  <span className="text-[10px] text-white/50 uppercase font-semibold block">Vues Additionnelles</span>
                  <b className="text-base sm:text-lg font-black text-emerald-400 block mt-0.5">
                    {boostBudget === 3000 ? '+8 500' : boostBudget === 7500 ? '+28 000' : '+70 000'} vues
                  </b>
                </div>
                <div>
                  <span className="text-[10px] text-white/50 uppercase font-semibold block">Ventes Prévues</span>
                  <b className="text-base sm:text-lg font-black text-blue-400 block mt-0.5">
                    {boostBudget === 3000 ? '+8 à 14' : boostBudget === 7500 ? '+22 à 38' : '+55 à 90'} ventes
                  </b>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-white/50 uppercase font-semibold block">Gain Net Estimé</span>
                  <b className="text-base sm:text-lg font-black text-emerald-400 block mt-0.5">
                    {formatFCFA(
                      Math.max(
                        0,
                        (boostBudget === 3000 ? 10 : boostBudget === 7500 ? 28 : 65) *
                          (product.price - DJASSA_FIXED_COMMISSION_FCFA)
                      )
                    )}
                  </b>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: AVIS CLIENTS & RETOURS ACHETEURS */}
        {activeTab === 'reviews' && (
          <div className="space-y-6">
            {/* Reviews Summary Header */}
            <div className="p-5 rounded-3xl bg-[#141414] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3.5 rounded-2xl bg-amber-500/20 text-amber-400 flex flex-col items-center">
                  <b className="text-2xl font-black">4.8</b>
                  <div className="flex items-center gap-0.5 text-amber-400 mt-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="w-3 h-3 fill-amber-400" />
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Avis Clients Vérifiés ({mockReviews.length})</h3>
                  <p className="text-xs text-white/50">Acheteurs réels ayant reçu leur commande</p>
                  <span className="text-[11px] text-emerald-400 font-bold mt-1 inline-block">
                    100% de satisfaction sur la livraison
                  </span>
                </div>
              </div>
            </div>

            {/* Reviews List */}
            <div className="space-y-3">
              {mockReviews.map((rev) => {
                const existingReply = repliedList[rev.id];
                return (
                  <div key={rev.id} className="p-4 sm:p-5 rounded-3xl bg-[#141414] border border-white/10 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={rev.avatar}
                          alt={rev.author}
                          className="w-10 h-10 rounded-full object-cover border border-white/10"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <b className="text-xs text-white">{rev.author}</b>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-bold border border-emerald-500/20">
                              Achat vérifié
                            </span>
                          </div>
                          <span className="text-[10px] text-white/40 block mt-0.5">
                            {rev.commune} • {rev.date}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 text-amber-400 shrink-0">
                        {[...Array(rev.rating)].map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-white/80 leading-relaxed">{rev.comment}</p>

                    {/* Existing Vendor Reply */}
                    {existingReply && (
                      <div className="p-3 rounded-2xl bg-white/5 border border-white/10 ml-4 sm:ml-8 space-y-1">
                        <span className="text-[10px] text-[#FF6321] font-bold block flex items-center gap-1">
                          <span>Réponse de votre boutique :</span>
                        </span>
                        <p className="text-xs text-white/70 italic">"{existingReply}"</p>
                      </div>
                    )}

                    {/* Vendor Reply Input */}
                    {!existingReply && (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={replyText[rev.id] || ''}
                          onChange={(e) =>
                            setReplyText((prev) => ({ ...prev, [rev.id]: e.target.value }))
                          }
                          placeholder="Répondre à ce client..."
                          className="flex-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                        />
                        <button
                          type="button"
                          onClick={() => handleSubmitReply(rev.id)}
                          className="px-3 py-1.5 rounded-xl bg-[#FF6321] text-white text-xs font-bold transition hover:bg-[#ff763d] flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          <span>Envoyer</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Frequently Asked Questions by buyers in chat for this product */}
            <div className="p-5 rounded-3xl bg-[#141414] border border-white/10 space-y-4">
              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                Questions Fréquentes Reçues en Message Privé
              </h4>

              <div className="space-y-3">
                {commonQuestions.map((q, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <b className="text-xs text-white block">❓ {q.q}</b>
                    <div className="p-2.5 rounded-xl bg-black/40 text-[11px] text-white/70 border border-white/5 flex items-center justify-between gap-3">
                      <span>💡 Réponse suggérée : "{q.suggestedReply}"</span>
                      <button
                        type="button"
                        onClick={() => handleCopyQuickReply(q.suggestedReply)}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold shrink-0 transition"
                      >
                        Copier
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 6. OTHER PUBLICATIONS CAROUSEL (IF MULTIPLE PRODUCTS EXIST) */}
        {allProducts.length > 1 && onSelectOtherProduct && (
          <section className="p-5 rounded-3xl bg-[#141414] border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#FF6321]" />
                Comparer avec une Autre Publication de votre Boutique
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {allProducts
                .filter((p) => p.id !== product.id)
                .slice(0, 4)
                .map((other) => (
                  <div
                    key={other.id}
                    onClick={() => onSelectOtherProduct(other)}
                    className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-[#FF6321] transition cursor-pointer group space-y-2"
                  >
                    <div className="w-full aspect-square rounded-xl overflow-hidden bg-black relative">
                      <img
                        src={other.images[0] || other.videoPoster}
                        alt={other.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div>
                      <b className="text-xs text-white block truncate">{other.name}</b>
                      <span className="text-[11px] text-emerald-400 font-bold block">
                        {formatFCFA(other.price)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}
      </main>

      {/* 7. STICKY BOTTOM ACTION BAR */}
      <footer className="sticky bottom-0 z-40 bg-[#121212]/95 backdrop-blur-xl border-t border-white/10 p-3 sm:p-4 shadow-2xl">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-xs text-white/50">Statut de la publication :</span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-xs flex items-center gap-1 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              En ligne sur Djassa
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {onOpenViewer && (
              <button
                id="btn-footer-view-live"
                onClick={() => onOpenViewer(product)}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4 text-white/70" />
                <span>Voir la publication</span>
              </button>
            )}

            {onQuickEdit && (
              <button
                id="btn-footer-quick-edit"
                onClick={() => onQuickEdit(product)}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <Edit3 className="w-4 h-4 text-emerald-400" />
                <span>Prix & Stock</span>
              </button>
            )}

            {onBoost && (
              <button
                id="btn-footer-boost-live"
                onClick={() => onBoost(product)}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6321] to-[#ff7e48] hover:brightness-110 text-white text-xs font-black transition flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20 active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>Booster la publication</span>
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
