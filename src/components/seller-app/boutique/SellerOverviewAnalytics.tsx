import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Calendar,
  Clock,
  Package,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Target,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Award,
  Layers,
  FileText,
  BarChart3,
  CheckCircle2,
  Info,
  SlidersHorizontal,
  Flame,
  ArrowUpDown,
  Download,
  Store,
  Percent
} from 'lucide-react';
import { Order, Product } from '../../../types';
import { formatFCFA } from '../../../services/marketServices';

export type SellerAnalyticsPeriodType = 'day' | 'week' | 'month' | 'year';
export type SellerAnalyticsMetricType = 'all' | 'revenue' | 'orders';

interface Props {
  orders: Order[];
  products: Product[];
  totalGrossRevenue: number;
  balance: number;
  monthlyTarget: number;
  onOpenTargetModal?: () => void;
  onOpenStatementModal?: () => void;
  showToast: (msg: string) => void;
}

interface DataPoint {
  id: string;
  label: string;
  subLabel?: string;
  fullDate: string;
  grossRevenue: number;
  netRevenue: number;
  djassaCommission: number;
  ordersCount: number;
  bestTimeSlot?: string;
  topProduct?: string;
  isPeak?: boolean;
  isCurrent?: boolean;
}

export const SellerOverviewAnalytics: React.FC<Props> = ({
  orders,
  products,
  totalGrossRevenue,
  balance,
  monthlyTarget,
  onOpenTargetModal,
  onOpenStatementModal,
  showToast
}) => {
  // 1. État de la période d'analyse : Jour, Semaine, Mois, Année
  const [periodType, setPeriodType] = useState<SellerAnalyticsPeriodType>('week');

  // 2. Métrique visualisée : Tout (Mixte), Revenus seuls (FCFA), Commandes seules (Nombre)
  const [metricView, setMetricView] = useState<SellerAnalyticsMetricType>('all');

  // 3. Décalage temporel (0 = actuel, -1 = précédent, etc.)
  const [timeOffset, setTimeOffset] = useState<number>(0);

  // 4. Élément sélectionné dans le graphique pour afficher le détail
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  // 5. Tri du tableau récapitulatif
  const [tableSort, setTableSort] = useState<'date' | 'revenue_desc' | 'orders_desc'>('date');

  // Réinitialiser le point sélectionné lors d'un changement de période
  const handlePeriodChange = (newPeriod: SellerAnalyticsPeriodType) => {
    setPeriodType(newPeriod);
    setTimeOffset(0);
    setSelectedPointId(null);
  };

  // Calcul du label de la période courante selon l'offset
  const periodTitle = useMemo(() => {
    if (periodType === 'day') {
      if (timeOffset === 0) return "Aujourd'hui · Jeudi 17 Septembre 2026";
      if (timeOffset === -1) return "Hier · Mercredi 16 Septembre 2026";
      if (timeOffset === -2) return "Mardi 15 Septembre 2026";
      return `Il y a ${Math.abs(timeOffset)} jours`;
    }
    if (periodType === 'week') {
      if (timeOffset === 0) return 'Semaine en cours · 14 au 20 Septembre 2026';
      if (timeOffset === -1) return 'Semaine dernière · 07 au 13 Septembre 2026';
      if (timeOffset === -2) return 'Semaine du 31 Août au 06 Septembre 2026';
      return `Semaine S-${Math.abs(timeOffset)} (2026)`;
    }
    if (periodType === 'month') {
      const months = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
      ];
      const baseMonthIdx = 8; // Septembre (0-indexed)
      const targetMonthIdx = (baseMonthIdx + timeOffset + 120) % 12;
      return `${months[targetMonthIdx]} 2026`;
    }
    if (periodType === 'year') {
      const year = 2026 + timeOffset;
      return `Année Fiscale ${year}`;
    }
    return '';
  }, [periodType, timeOffset]);

  // Top product name fallback
  const topProductName = products[0]?.name || 'Pagne Wax Hollandais Authentique';

  // =========================================================
  // GÉNÉRATION DES DONNÉES SELON LA PÉRIODE SÉLECTIONNÉE
  // =========================================================
  const chartData: DataPoint[] = useMemo(() => {
    const baseMult = 1 + (timeOffset % 3) * 0.08;
    const baseRefRevenue = Math.max(120000, totalGrossRevenue);

    // -------------------------------------------------------
    // A. MODE JOUR : Tranches horaires (06h à 22h)
    // -------------------------------------------------------
    if (periodType === 'day') {
      const slots = [
        { id: 'slot-08-10', label: '08h-10h', subLabel: 'Matin', fullDate: '08:00 - 10:00', share: 0.12, orders: 2, bestTime: '09h20', peak: false },
        { id: 'slot-10-12', label: '10h-12h', subLabel: 'Midi', fullDate: '10:00 - 12:00', share: 0.22, orders: 4, bestTime: '11h45', peak: false },
        { id: 'slot-12-14', label: '12h-14h', subLabel: 'Déjeuner', fullDate: '12:00 - 14:00', share: 0.32, orders: 6, bestTime: '13h10', peak: true },
        { id: 'slot-14-16', label: '14h-16h', subLabel: 'Après-midi', fullDate: '14:00 - 16:00', share: 0.16, orders: 3, bestTime: '15h00', peak: false },
        { id: 'slot-16-18', label: '16h-18h', subLabel: 'Sortie', fullDate: '16:00 - 18:00', share: 0.24, orders: 5, bestTime: '17h30', peak: false },
        { id: 'slot-18-21', label: '18h-21h', subLabel: 'Soir', fullDate: '18:00 - 21:00', share: 0.18, orders: 3, bestTime: '19h40', peak: false },
      ];
      const dailyBase = Math.round(baseRefRevenue * 0.15 * baseMult);

      return slots.map((s, idx) => {
        const gross = Math.round(dailyBase * s.share);
        const ordersCount = Math.max(1, Math.round(s.orders * baseMult));
        const comm = ordersCount * 150;
        return {
          id: s.id,
          label: s.label,
          subLabel: s.subLabel,
          fullDate: s.fullDate,
          grossRevenue: gross,
          netRevenue: Math.max(0, gross - comm),
          djassaCommission: comm,
          ordersCount,
          bestTimeSlot: s.bestTime,
          topProduct: products[idx % (products.length || 1)]?.name || topProductName,
          isPeak: s.peak,
          isCurrent: idx === 2
        };
      });
    }

    // -------------------------------------------------------
    // B. MODE SEMAINE : Lundi à Dimanche
    // -------------------------------------------------------
    if (periodType === 'week') {
      const days = [
        { id: 'day-lun', label: 'Lun', subLabel: '14 Sept', fullDate: 'Lundi 14 Septembre 2026', share: 0.11, orders: 3, bestTime: '11h30', peak: false },
        { id: 'day-mar', label: 'Mar', subLabel: '15 Sept', fullDate: 'Mardi 15 Septembre 2026', share: 0.14, orders: 4, bestTime: '14h00', peak: false },
        { id: 'day-mer', label: 'Mer', subLabel: '16 Sept', fullDate: 'Mercredi 16 Septembre 2026', share: 0.17, orders: 5, bestTime: '16h15', peak: false },
        { id: 'day-jeu', label: 'Jeu', subLabel: '17 Sept', fullDate: 'Jeudi 17 Septembre 2026', share: 0.15, orders: 4, bestTime: '13h20', peak: false, current: true },
        { id: 'day-ven', label: 'Ven', subLabel: '18 Sept', fullDate: 'Vendredi 18 Septembre 2026', share: 0.22, orders: 7, bestTime: '17h45', peak: false },
        { id: 'day-sam', label: 'Sam', subLabel: '19 Sept', fullDate: 'Samedi 19 Septembre 2026', share: 0.26, orders: 9, bestTime: '15h30 (Pic Shopping)', peak: true },
        { id: 'day-dim', label: 'Dim', subLabel: '20 Sept', fullDate: 'Dimanche 20 Septembre 2026', share: 0.10, orders: 2, bestTime: '19h00', peak: false },
      ];
      const weeklyBase = Math.round(baseRefRevenue * 0.45 * baseMult);

      return days.map((d, idx) => {
        const gross = Math.round(weeklyBase * d.share);
        const ordersCount = Math.max(1, Math.round(d.orders * baseMult));
        const comm = ordersCount * 150;
        return {
          id: d.id,
          label: d.label,
          subLabel: d.subLabel,
          fullDate: d.fullDate,
          grossRevenue: gross,
          netRevenue: Math.max(0, gross - comm),
          djassaCommission: comm,
          ordersCount,
          bestTimeSlot: d.bestTime,
          topProduct: products[idx % (products.length || 1)]?.name || topProductName,
          isPeak: d.peak,
          isCurrent: !!d.current
        };
      });
    }

    // -------------------------------------------------------
    // C. MODE MOIS : 4 Semaines du mois
    // -------------------------------------------------------
    if (periodType === 'month') {
      const weeks = [
        { id: 'sem-1', label: 'Sem 1', subLabel: '01-07', fullDate: 'Semaine 1 (01 au 07)', share: 0.21, orders: 12, bestTime: 'Vendredi soir', peak: false },
        { id: 'sem-2', label: 'Sem 2', subLabel: '08-14', fullDate: 'Semaine 2 (08 au 14)', share: 0.24, orders: 15, bestTime: 'Samedi après-midi', peak: false },
        { id: 'sem-3', label: 'Sem 3', subLabel: '15-21', fullDate: 'Semaine 3 (15 au 21)', share: 0.28, orders: 19, bestTime: 'Samedi (Virements fin de mois)', peak: true, current: true },
        { id: 'sem-4', label: 'Sem 4', subLabel: '22-30', fullDate: 'Semaine 4 (22 au 30)', share: 0.27, orders: 18, bestTime: 'Jeudi midi', peak: false },
      ];
      const monthlyBase = Math.round(baseRefRevenue * 0.9 * baseMult);

      return weeks.map((w, idx) => {
        const gross = Math.round(monthlyBase * w.share);
        const ordersCount = Math.max(1, Math.round(w.orders * baseMult));
        const comm = ordersCount * 150;
        return {
          id: w.id,
          label: w.label,
          subLabel: w.subLabel,
          fullDate: w.fullDate,
          grossRevenue: gross,
          netRevenue: Math.max(0, gross - comm),
          djassaCommission: comm,
          ordersCount,
          bestTimeSlot: w.bestTime,
          topProduct: products[idx % (products.length || 1)]?.name || topProductName,
          isPeak: w.peak,
          isCurrent: !!w.current
        };
      });
    }

    // -------------------------------------------------------
    // D. MODE ANNÉE : 12 Mois
    // -------------------------------------------------------
    const months = [
      { id: 'm-jan', label: 'Jan', subLabel: 'Janv', fullDate: 'Janvier 2026', factor: 0.75, orders: 40 },
      { id: 'm-fev', label: 'Fév', subLabel: 'Févr', fullDate: 'Février 2026', factor: 0.85, orders: 48 },
      { id: 'm-mar', label: 'Mar', subLabel: 'Mars', fullDate: 'Mars 2026', factor: 0.95, orders: 54 },
      { id: 'm-avr', label: 'Avr', subLabel: 'Avr', fullDate: 'Avril 2026', factor: 1.05, orders: 60 },
      { id: 'm-mai', label: 'Mai', subLabel: 'Mai', fullDate: 'Mai 2026', factor: 1.10, orders: 65 },
      { id: 'm-jui', label: 'Juin', subLabel: 'Juin', fullDate: 'Juin 2026', factor: 1.00, orders: 58 },
      { id: 'm-jul', label: 'Juil', subLabel: 'Juil', fullDate: 'Juillet 2026', factor: 1.15, orders: 68 },
      { id: 'm-aou', label: 'Août', subLabel: 'Août', fullDate: 'Août 2026', factor: 1.20, orders: 72 },
      { id: 'm-sep', label: 'Sep', subLabel: 'Sept', fullDate: 'Septembre 2026', factor: 1.35, orders: 84, peak: true, current: true },
      { id: 'm-oct', label: 'Oct', subLabel: 'Oct', fullDate: 'Octobre 2026', factor: 1.10, orders: 64 },
      { id: 'm-nov', label: 'Nov', subLabel: 'Nov', fullDate: 'Novembre 2026 (Black Friday)', factor: 1.45, orders: 95 },
      { id: 'm-dec', label: 'Déc', subLabel: 'Déc', fullDate: 'Décembre 2026 (Fêtes)', factor: 1.60, orders: 110 },
    ];
    const yearMonthBase = Math.round(baseRefRevenue * 0.7 * baseMult);

    return months.map((m, idx) => {
      const gross = Math.round(yearMonthBase * m.factor);
      const ordersCount = Math.max(1, Math.round(m.orders * baseMult));
      const comm = ordersCount * 150;
      return {
        id: m.id,
        label: m.label,
        subLabel: m.subLabel,
        fullDate: m.fullDate,
        grossRevenue: gross,
        netRevenue: Math.max(0, gross - comm),
        djassaCommission: comm,
        ordersCount,
        bestTimeSlot: 'Week-ends et début de mois',
        topProduct: products[idx % (products.length || 1)]?.name || topProductName,
        isPeak: !!m.peak,
        isCurrent: !!m.current
      };
    });
  }, [periodType, timeOffset, totalGrossRevenue, products, topProductName]);

  // Point sélectionné (ou premier par défaut si non trouvé)
  const activePoint = useMemo(() => {
    if (selectedPointId) {
      const found = chartData.find((d) => d.id === selectedPointId);
      if (found) return found;
    }
    // Trouver le point courant ou le pic par défaut
    const curr = chartData.find((d) => d.isCurrent) || chartData.find((d) => d.isPeak) || chartData[0];
    return curr;
  }, [selectedPointId, chartData]);

  // Agrégats totaux de la période
  const periodTotals = useMemo(() => {
    const totalGross = chartData.reduce((acc, d) => acc + d.grossRevenue, 0);
    const totalNet = chartData.reduce((acc, d) => acc + d.netRevenue, 0);
    const totalComm = chartData.reduce((acc, d) => acc + d.djassaCommission, 0);
    const totalOrders = chartData.reduce((acc, d) => acc + d.ordersCount, 0);
    const avgBasket = totalOrders > 0 ? Math.round(totalGross / totalOrders) : 0;
    return { totalGross, totalNet, totalComm, totalOrders, avgBasket };
  }, [chartData]);

  // Valeur maximale pour calculer la hauteur relative des barres
  const maxBarValue = useMemo(() => {
    if (metricView === 'orders') {
      return Math.max(...chartData.map((d) => d.ordersCount), 1);
    }
    return Math.max(...chartData.map((d) => d.grossRevenue), 1);
  }, [chartData, metricView]);

  // Données triées pour le tableau récapitulatif
  const sortedTableData = useMemo(() => {
    const copy = [...chartData];
    if (tableSort === 'revenue_desc') {
      return copy.sort((a, b) => b.grossRevenue - a.grossRevenue);
    }
    if (tableSort === 'orders_desc') {
      return copy.sort((a, b) => b.ordersCount - a.ordersCount);
    }
    return copy;
  }, [chartData, tableSort]);

  // Objectif progression calculé
  const targetPercent = Math.min(100, Math.round((periodTotals.totalGross / monthlyTarget) * 100));

  return (
    <div id="seller-overview-analytics-root" className="space-y-4 animate-fadeIn">
      {/* 1. SÉLECTEUR DE PÉRIODE & NAVIGATION TEMPORELLE */}
      <div className="p-4 rounded-3xl bg-white/[0.04] border border-white/10 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-[#FF6321]/20 text-[#FF6321] border border-[#FF6321]/30">
                <BarChart3 className="w-4 h-4" />
              </span>
              <h3 className="text-xs font-black text-white uppercase tracking-wider">
                Vue d'Ensemble & Analyse Financière
              </h3>
            </div>
            <p className="text-[11px] text-white/50 mt-0.5">
              Évolution précise de vos ventes, marges nettes et commissions Djassa
            </p>
          </div>

          {/* Quick statement / target shortcuts */}
          <div className="flex items-center gap-1.5">
            {onOpenStatementModal && (
              <button
                type="button"
                onClick={onOpenStatementModal}
                className="py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-bold flex items-center gap-1.5 transition active:scale-95"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span>Relevé PDF</span>
              </button>
            )}

            {onOpenTargetModal && (
              <button
                type="button"
                onClick={onOpenTargetModal}
                className="py-1.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center gap-1.5 transition active:scale-95"
              >
                <Target className="w-3.5 h-3.5 text-emerald-400" />
                <span>Objectif Ventes</span>
              </button>
            )}
          </div>
        </div>

        {/* Period Selector Tabs (Jour, Semaine, Mois, Année) */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-black/60 border border-white/10 text-center">
          {[
            { id: 'day', label: 'Jour', icon: Clock },
            { id: 'week', label: 'Semaine', icon: Calendar },
            { id: 'month', label: 'Mois', icon: TrendingUp },
            { id: 'year', label: 'Année', icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = periodType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handlePeriodChange(tab.id as SellerAnalyticsPeriodType)}
                className={`py-2 px-2 rounded-xl text-[11px] font-black transition flex items-center justify-center gap-1.5 active:scale-95 ${
                  active
                    ? 'bg-[#FF6321] text-white shadow-md shadow-orange-600/25'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Date Navigator Banner (< Title >) */}
        <div className="flex items-center justify-between p-2.5 rounded-2xl bg-black/40 border border-white/5 text-xs">
          <button
            type="button"
            onClick={() => setTimeOffset((prev) => prev - 1)}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition active:scale-95"
            title="Période précédente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="text-center">
            <span className="text-[10px] text-white/40 uppercase tracking-wider font-mono block">
              Période visualisée
            </span>
            <span className="font-black text-white text-xs sm:text-sm">
              {periodTitle}
            </span>
          </div>

          <button
            type="button"
            disabled={timeOffset >= 0}
            onClick={() => setTimeOffset((prev) => prev + 1)}
            className={`p-1.5 rounded-xl transition active:scale-95 ${
              timeOffset >= 0
                ? 'opacity-30 cursor-not-allowed text-white/30'
                : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
            }`}
            title="Période suivante"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Metric Selector Pills (Tout, Revenus nets, Ventes) */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5 flex-wrap">
          <div className="flex gap-1.5">
            {[
              { id: 'all', label: 'Tout (Mixte)' },
              { id: 'revenue', label: 'Chiffre d’Affaires (FCFA)' },
              { id: 'orders', label: 'Nombre de Ventes' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMetricView(m.id as SellerAnalyticsMetricType)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition ${
                  metricView === m.id
                    ? 'bg-white text-black'
                    : 'bg-white/5 text-white/60 hover:text-white border border-white/5'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>Mise à jour en direct</span>
          </span>
        </div>
      </div>

      {/* 2. GRAPHIQUE À BARRES INTERACTIF AVEC OVERLAYS */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-b from-neutral-900/90 to-[#0F0F0F] border border-white/10 shadow-xl space-y-4">
        {/* Header du graphique */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-[#FF6321] uppercase tracking-wider">
                Graphique d'Activité Boutique
              </span>
              {chartData.some((d) => d.isPeak) && (
                <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 text-[9px] font-black flex items-center gap-1 border border-orange-500/30">
                  <Flame className="w-2.5 h-2.5 text-[#FF6321]" />
                  <span>Pic détecté</span>
                </span>
              )}
            </div>
            <p className="text-xl sm:text-2xl font-black text-white mt-1">
              {metricView === 'orders'
                ? `${periodTotals.totalOrders} ventes réalisées`
                : formatFCFA(periodTotals.totalGross)}
            </p>
            <p className="text-[10px] text-white/40">
              Cliquez ou touchez une barre pour inspecter le détail de cette tranche
            </p>
          </div>

          <div className="text-right">
            <span className="text-[9px] text-white/40 uppercase block font-bold">
              Net Boutique perçu
            </span>
            <p className="text-base sm:text-lg font-black text-emerald-400">
              +{formatFCFA(periodTotals.totalNet)}
            </p>
            <span className="text-[9px] text-emerald-300/80 font-bold block">
              Commission fixe : 150 FCFA / commande
            </span>
          </div>
        </div>

        {/* Le Graphique SVG / Barres stylisées */}
        <div className="pt-6 pb-2">
          <div className="h-44 sm:h-52 w-full flex items-end justify-between gap-1.5 sm:gap-2 px-1">
            {chartData.map((d) => {
              const val = metricView === 'orders' ? d.ordersCount : d.grossRevenue;
              const heightPercent = Math.max(12, Math.round((val / maxBarValue) * 100));
              const isSelected = activePoint?.id === d.id;

              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedPointId(d.id)}
                  className="flex-1 h-full flex flex-col items-center justify-end cursor-pointer group relative"
                >
                  {/* Tooltip badge au-dessus de la barre au hover ou sélectionné */}
                  {(isSelected || d.isPeak) && (
                    <div
                      className={`absolute -top-7 px-1.5 py-0.5 rounded-md text-[8px] sm:text-[9px] font-black whitespace-nowrap shadow-md z-10 transition-transform ${
                        isSelected
                          ? 'bg-[#FF6321] text-white scale-105'
                          : 'bg-black/80 text-orange-300 border border-orange-500/40'
                      }`}
                    >
                      {metricView === 'orders'
                        ? `${d.ordersCount} vtes`
                        : formatFCFA(d.grossRevenue)}
                    </div>
                  )}

                  {/* La Barre */}
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full max-w-[42px] rounded-xl transition-all duration-300 flex flex-col justify-end p-1 relative overflow-hidden ${
                      isSelected
                        ? 'bg-gradient-to-t from-[#FF6321] via-orange-500 to-amber-300 shadow-lg shadow-orange-500/30 ring-2 ring-white/80'
                        : d.isPeak
                        ? 'bg-gradient-to-t from-orange-600/80 to-amber-500/80 hover:brightness-125'
                        : d.isCurrent
                        ? 'bg-gradient-to-t from-emerald-600/80 to-teal-400/80 hover:brightness-125'
                        : 'bg-white/10 group-hover:bg-white/20'
                    }`}
                  >
                    {/* Glowing highlight strip inside bar */}
                    <div className="w-full h-1 rounded-full bg-white/40 mb-auto" />
                  </div>

                  {/* Labels du bas */}
                  <div className="mt-2 text-center">
                    <span
                      className={`text-[10px] sm:text-[11px] font-black block leading-none transition ${
                        isSelected ? 'text-[#FF6321]' : 'text-white/60 group-hover:text-white'
                      }`}
                    >
                      {d.label}
                    </span>
                    {d.subLabel && (
                      <span className="text-[8px] text-white/30 block leading-tight mt-0.5">
                        {d.subLabel}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. DÉTAIL DE LA TRANCHE SÉLECTIONNÉE (INSPECTOR DRAWER) */}
        {activePoint && (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-black/60 border border-white/10 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div>
                <span className="text-[9px] text-white/40 uppercase tracking-wider font-bold">
                  Détail de la tranche inspectée
                </span>
                <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                  <span>{activePoint.fullDate}</span>
                  {activePoint.isPeak && (
                    <span className="px-1.5 py-0.2 rounded bg-orange-500/20 text-[#FF6321] text-[9px] font-black border border-orange-500/30">
                      ★ Heure Forte
                    </span>
                  )}
                  {activePoint.isCurrent && (
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-black border border-emerald-500/30">
                      En cours
                    </span>
                  )}
                </h4>
              </div>

              <div className="text-right">
                <span className="text-[9px] text-white/40 block">Ventes enregistrées</span>
                <span className="text-xs font-black text-[#FF6321]">
                  {activePoint.ordersCount} commande(s)
                </span>
              </div>
            </div>

            {/* 3 KPI rapides de la tranche */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[9px] text-white/40 block">CA Brut Total</span>
                <p className="font-black text-white text-[11px] sm:text-xs">
                  {formatFCFA(activePoint.grossRevenue)}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-[9px] text-emerald-300/70 block">Votre Net vendeur</span>
                <p className="font-black text-emerald-400 text-[11px] sm:text-xs">
                  +{formatFCFA(activePoint.netRevenue)}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-[9px] text-white/40 block">Commission Djassa (150 F/cmd)</span>
                <p className="font-black text-white/70 text-[11px] sm:text-xs">
                  -{formatFCFA(activePoint.djassaCommission)}
                </p>
              </div>
            </div>

            {/* Note complémentaire sur les ventes */}
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-[10px] text-white/60">
              <div className="flex items-center gap-1.5 truncate">
                <Store className="w-3.5 h-3.5 text-[#FF6321] shrink-0" />
                <span className="truncate">
                  Article le plus vendu : <strong>{activePoint.topProduct}</strong>
                </span>
              </div>
              <span className="text-[#FF6321] font-bold shrink-0 ml-2">
                Panier moyen : {formatFCFA(Math.round(activePoint.grossRevenue / activePoint.ordersCount))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 4. LES 4 CARTES KPI DE SYNTHÈSE GLOBALE */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* KPI 1 : CA Brut */}
        <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1">
          <div className="flex items-center justify-between text-[10px] text-white/50">
            <span>Ventes Brutes</span>
            <DollarSign className="w-3.5 h-3.5 text-white/60" />
          </div>
          <p className="text-base sm:text-lg font-black text-white">
            {formatFCFA(periodTotals.totalGross)}
          </p>
          <span className="text-[9px] text-white/40 block">
            {periodTotals.totalOrders} ventes totales
          </span>
        </div>

        {/* KPI 2 : Net Boutique */}
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
          <div className="flex items-center justify-between text-[10px] text-emerald-300">
            <span className="font-bold">Net Boutique</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
          </div>
          <p className="text-base sm:text-lg font-black text-emerald-400">
            +{formatFCFA(periodTotals.totalNet)}
          </p>
          <span className="text-[9px] text-emerald-300/80 font-bold block">
            Solde encaissable ⚡
          </span>
        </div>

        {/* KPI 3 : Commission Djassa */}
        <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1">
          <div className="flex items-center justify-between text-[10px] text-white/50">
            <span>Frais Djassa</span>
            <Percent className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <p className="text-base sm:text-lg font-black text-purple-300">
            {formatFCFA(periodTotals.totalComm)}
          </p>
          <span className="text-[9px] text-purple-400/80 font-bold block">
            150 FCFA fixe par commande
          </span>
        </div>

        {/* KPI 4 : Panier Moyen */}
        <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1">
          <div className="flex items-center justify-between text-[10px] text-white/50">
            <span>Panier Moyen</span>
            <Package className="w-3.5 h-3.5 text-[#FF6321]" />
          </div>
          <p className="text-base sm:text-lg font-black text-white">
            {formatFCFA(periodTotals.avgBasket)}
          </p>
          <span className="text-[9px] text-amber-400 font-bold block">
            Par client acheteur
          </span>
        </div>
      </div>

      {/* 5. TABLEAU RÉCAPITULATIF DÉTAILLÉ DE LA PÉRIODE */}
      <div className="p-4 rounded-3xl bg-white/[0.04] border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-black text-white flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#FF6321]" />
              <span>Tableau Récapitulatif Périodique</span>
            </h4>
            <p className="text-[10px] text-white/50">
              Historique chiffré des ventes et des prélèvements
            </p>
          </div>

          {/* Tri du tableau */}
          <div className="flex items-center gap-1 text-[10px]">
            <ArrowUpDown className="w-3 h-3 text-white/40" />
            <select
              value={tableSort}
              onChange={(e) => setTableSort(e.target.value as any)}
              className="bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-white/70 focus:outline-none focus:border-[#FF6321]"
            >
              <option value="date">Ordre chronologique</option>
              <option value="revenue_desc">Revenus les plus hauts</option>
              <option value="orders_desc">Plus grand nombre de ventes</option>
            </select>
          </div>
        </div>

        {/* Table Rows */}
        <div className="space-y-1.5 overflow-x-auto no-scrollbar">
          {sortedTableData.map((row) => (
            <div
              key={row.id}
              onClick={() => setSelectedPointId(row.id)}
              className={`p-3 rounded-2xl transition border flex items-center justify-between gap-3 text-xs cursor-pointer ${
                activePoint?.id === row.id
                  ? 'bg-white/10 border-[#FF6321]/40'
                  : 'bg-black/40 border-white/5 hover:border-white/15'
              }`}
            >
              <div className="min-w-0">
                <p className="font-bold text-white text-xs truncate">
                  {row.fullDate}
                </p>
                <p className="text-[10px] text-white/40 flex items-center gap-1.5">
                  <span>{row.ordersCount} vente(s)</span>
                  <span>•</span>
                  <span>Article phare : {row.topProduct}</span>
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="font-mono font-black text-emerald-400 text-xs block">
                  +{formatFCFA(row.netRevenue)}
                </span>
                <span className="text-[9px] text-white/40 block">
                  Brut: {formatFCFA(row.grossRevenue)} (Frais: -{formatFCFA(row.djassaCommission)})
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
