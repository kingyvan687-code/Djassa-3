import React, { useState, useMemo } from 'react';
import { 
  X, 
  ArrowLeft,
  BarChart2, 
  TrendingUp, 
  Eye, 
  ShoppingBag, 
  DollarSign, 
  ChevronRight, 
  Play, 
  Camera, 
  Copy, 
  Check, 
  ShieldCheck, 
  Zap
} from 'lucide-react';
import { Product } from '../../../types';
import { formatFCFA, formatMetricCount } from '../../../services/marketServices';
import { useApp } from '../../../context/AppContext';

interface Props {
  product: Product | null;
  onClose: () => void;
  onOpenPhotoDetail: (product: Product) => void;
  onOpenBoost: (product: Product) => void;
}

type PeriodFilter = 'today' | '7d' | '30d' | 'all';
type ChartMetric = 'revenue' | 'sales' | 'views';

export const PhotoStatsModal: React.FC<Props> = ({
  product,
  onClose,
  onOpenPhotoDetail,
  onOpenBoost,
}) => {
  const { showToast } = useApp();

  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>('7d');
  const [chartMetric, setChartMetric] = useState<ChartMetric>('revenue');
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(6); // Default select latest day

  if (!product) return null;

  const images = product.images && product.images.length > 0 
    ? product.images 
    : [product.videoPoster || 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600'];

  // Base raw metrics
  const baseViews = product.viewsCount || 14800;
  const baseLikes = product.likesCount || 1120;
  const baseSales = product.salesCount || 74;
  const basePrice = product.price || 24500;

  // Period multiplier
  const periodMultiplier = useMemo(() => {
    switch (selectedPeriod) {
      case 'today': return 0.12;
      case '7d': return 1;
      case '30d': return 3.6;
      case 'all': return 8.2;
    }
  }, [selectedPeriod]);

  // Computed metrics according to selected period
  const views = Math.round(baseViews * periodMultiplier);
  const likes = Math.round(baseLikes * periodMultiplier);
  const saves = Math.round(likes * 0.42);
  const shares = Math.round(views * 0.045);
  const sales = Math.max(1, Math.round(baseSales * periodMultiplier));
  const revenue = sales * basePrice;
  const djassaCommission = sales * 150;
  const netRevenue = Math.max(0, revenue - djassaCommission);
  const avgBasket = sales > 0 ? Math.round(revenue / sales) : basePrice;
  const conversionRate = views > 0 ? ((sales / views) * 100).toFixed(1) : '5.2';

  // 7-day daily data for interactive chart
  const dailyData = useMemo(() => {
    const days = [
      { label: 'Lun 22', dayName: 'Lundi 22 Septembre', ratio: 0.11 },
      { label: 'Mar 23', dayName: 'Mardi 23 Septembre', ratio: 0.13 },
      { label: 'Mer 24', dayName: 'Mercredi 24 Septembre', ratio: 0.15 },
      { label: 'Jeu 25', dayName: 'Jeudi 25 Septembre', ratio: 0.12 },
      { label: 'Ven 26', dayName: 'Vendredi 26 Septembre', ratio: 0.18 },
      { label: 'Sam 27', dayName: 'Samedi 27 Septembre', ratio: 0.17 },
      { label: 'Dim 28', dayName: 'Dimanche 28 Septembre', ratio: 0.14 },
    ];

    return days.map((d) => {
      const daySales = Math.max(1, Math.round(sales * d.ratio));
      const dayRevenue = daySales * basePrice;
      const dayViews = Math.round(views * d.ratio);
      return {
        ...d,
        sales: daySales,
        revenue: dayRevenue,
        views: dayViews,
      };
    });
  }, [sales, views, basePrice]);

  const maxChartValue = useMemo(() => {
    return Math.max(...dailyData.map((d) => d[chartMetric]), 1);
  }, [dailyData, chartMetric]);

  // Selected bar details
  const activeDayData = selectedDayIdx !== null ? dailyData[selectedDayIdx] : dailyData[6];

  // Copy share report
  const handleCopyReport = () => {
    const reportText = `📊 Rapport Statistiques Djassa • ${product.name}
- Période : ${selectedPeriod.toUpperCase()}
- Chiffre d'Affaires Brut : ${formatFCFA(revenue)}
- Net Vendeur Encaissé : ${formatFCFA(netRevenue)}
- Ventes confirmées : ${sales} commandes
- Vues & Visites : ${views.toLocaleString('fr-FR')}
- Taux de conversion : ${conversionRate}%
- Séquestre garanti 100% par Djassa Côte d'Ivoire 🇨🇮`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(reportText);
    }
    setIsCopied(true);
    showToast('Rapport copié dans le presse-papiers 📋');
    setTimeout(() => setIsCopied(false), 2500);
  };

  return (
    <div
      id="photo-stats-modal-overlay"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center overflow-hidden animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl h-full sm:h-[94vh] bg-[#0E0E0E] sm:rounded-3xl border-t sm:border border-white/15 flex flex-col overflow-hidden shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP NAVIGATION BAR (Exact ProductDetailModal / ProductPromotionScreen style) */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[#121212]/95 backdrop-blur-md border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/15 text-white/80 hover:text-white transition active:scale-95"
              aria-label="Retour"
              title="Retour"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-cyan-400 uppercase tracking-widest block font-black">
                  Statistiques & Performance Vente
                </span>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.2 rounded border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  En direct
                </span>
              </div>
              <h2 className="text-xs font-black text-white line-clamp-1 max-w-[240px] sm:max-w-md">
                {product.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleCopyReport}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition"
              title="Exporter / Copier le rapport"
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* SCROLLABLE BODY CONTENT */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-5 pb-36">
          {/* MEDIA HERO SECTION (4:3 ratio, identical to ProductDetailModal) */}
          <div className="relative aspect-[4/3] w-full bg-neutral-900 border-b border-white/10 overflow-hidden">
            {showVideo && product.videoUrl ? (
              <video
                src={product.videoUrl}
                controls
                autoPlay
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={images[activeImgIndex] || images[0]}
                alt={product.name}
                className="w-full h-full object-cover transition duration-300"
              />
            )}

            {/* FLOATING OVERLAYS (Stacked in clean flex column without overlapping) */}
            <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1.5 pointer-events-none max-w-[75%]">
              <span className="px-2.5 py-1 rounded-full bg-[#FF6321]/95 backdrop-blur-md text-white font-black text-xs shadow-lg flex items-center gap-1 shrink-0">
                <DollarSign className="w-3.5 h-3.5" />
                <span>{formatFCFA(revenue)} CA GÉNÉRÉ</span>
              </span>

              <span className="px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-emerald-300 font-bold text-[10px] shadow-lg flex items-center gap-1 shrink-0">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                <span>{sales} ventes ({conversionRate}% conversion)</span>
              </span>

              <div className="px-3 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/15 text-white shadow-xl flex items-center gap-1.5 text-[10px] font-bold shrink-0">
                <span className="text-white/60">Prix catalogue :</span>
                <span className="text-white font-black">{formatFCFA(basePrice)}</span>
              </div>
            </div>

            {/* RIGHT STATUS BADGE */}
            <div className="absolute top-3 right-3 flex items-center gap-2">
              {product.videoUrl && (
                <button
                  type="button"
                  onClick={() => setShowVideo(!showVideo)}
                  className={`px-3 py-1 rounded-full backdrop-blur-md text-xs font-black flex items-center gap-1.5 shadow-lg transition active:scale-95 ${
                    showVideo
                      ? 'bg-[#FF6321] text-white'
                      : 'bg-black/70 hover:bg-black/90 text-white border border-white/20'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{showVideo ? 'Photo' : 'Vidéo'}</span>
                </button>
              )}

              <div className="bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/15 text-white/90 text-[10px] font-bold">
                {activeImgIndex + 1} / {images.length}
              </div>
            </div>

            {/* THUMBNAIL STRIP */}
            {images.length > 1 && (
              <div className="absolute bottom-3 left-0 right-0 px-4 flex justify-center gap-2 overflow-x-auto no-scrollbar py-1">
                {images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setShowVideo(false);
                      setActiveImgIndex(i);
                    }}
                    className={`relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition shadow-md ${
                      activeImgIndex === i && !showVideo
                        ? 'border-[#FF6321] scale-105 ring-2 ring-[#FF6321]/40'
                        : 'border-white/20 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PERIOD FILTER TABS */}
          <div className="px-4">
            <div className="p-1 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-1">
              {[
                { id: 'today', label: "Aujourd'hui" },
                { id: '7d', label: '7 Derniers Jours' },
                { id: '30d', label: '30 Jours' },
                { id: 'all', label: 'Tout l’historique' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedPeriod(tab.id as PeriodFilter)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition text-center ${
                    selectedPeriod === tab.id
                      ? 'bg-[#FF6321] text-white shadow-md shadow-[#FF6321]/20'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* MAIN 4 CORE EXECUTIVE KPI CARDS */}
          <div className="px-4 grid grid-cols-2 gap-2.5">
            {/* 1. CA Brut */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/15 via-white/[0.03] to-transparent border border-amber-500/30 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-amber-300 font-bold">
                <span className="flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-amber-400" /> CA Brut
                </span>
                <span className="text-[10px] text-emerald-400 font-black">+24%</span>
              </div>
              <p className="text-lg font-black text-white tracking-tight">{formatFCFA(revenue)}</p>
              <p className="text-[10px] text-white/50">Montant total des ventes</p>
            </div>

            {/* 2. Net Vendeur */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-white/[0.03] to-transparent border border-emerald-500/30 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-emerald-300 font-bold">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Net Encaissé
                </span>
                <span className="text-[10px] text-emerald-400 font-black">Wave 100%</span>
              </div>
              <p className="text-lg font-black text-emerald-400 tracking-tight">{formatFCFA(netRevenue)}</p>
              <p className="text-[10px] text-white/50">Commission fixe 150 F/cmd déduite ({formatFCFA(djassaCommission)})</p>
            </div>

            {/* 3. Commandes & Panier */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#FF6321]/15 via-white/[0.03] to-transparent border border-[#FF6321]/30 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-[#FF6321] font-bold">
                <span className="flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5" /> Commandes
                </span>
                <span className="text-[10px] text-white/50">Panier : {formatFCFA(avgBasket)}</span>
              </div>
              <p className="text-lg font-black text-white tracking-tight">{sales} achats</p>
              <p className="text-[10px] text-white/50">Livraison gérée par la boutique</p>
            </div>

            {/* 4. Vues & Conversion */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-cyan-500/15 via-white/[0.03] to-transparent border border-cyan-500/30 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-cyan-300 font-bold">
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-cyan-400" /> Vues / Visites
                </span>
                <span className="text-[10px] text-cyan-400 font-black">{conversionRate}% conv.</span>
              </div>
              <p className="text-lg font-black text-white tracking-tight">{views.toLocaleString('fr-FR')}</p>
              <p className="text-[10px] text-white/50">Audience qualifiée Abidjan</p>
            </div>
          </div>

          {/* INTERACTIVE DAILY REVENUE & TRAFFIC CHART */}
          <div className="px-4">
            <div className="p-4 rounded-3xl bg-[#141414] border border-white/10 space-y-4 shadow-xl">
              {/* Chart Header & Metric Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                    <BarChart2 className="w-4 h-4 text-[#FF6321]" />
                    <span>Courbe d'Activité Hebdomadaire</span>
                  </h3>
                  <p className="text-[10px] text-white/50">
                    Cliquez sur une barre pour inspecter le détail du jour
                  </p>
                </div>

                {/* Metric toggle */}
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setChartMetric('revenue')}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                      chartMetric === 'revenue'
                        ? 'bg-[#FF6321] text-white'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    CA (FCFA)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMetric('sales')}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                      chartMetric === 'sales'
                        ? 'bg-[#FF6321] text-white'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Ventes
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMetric('views')}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                      chartMetric === 'views'
                        ? 'bg-[#FF6321] text-white'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Vues
                  </button>
                </div>
              </div>

              {/* Selected Day Tooltip Banner */}
              {activeDayData && (
                <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-white/40 block">{activeDayData.dayName}</span>
                    <b className="text-white font-bold">
                      {chartMetric === 'revenue'
                        ? formatFCFA(activeDayData.revenue)
                        : chartMetric === 'sales'
                        ? `${activeDayData.sales} articles vendus`
                        : `${activeDayData.views.toLocaleString('fr-FR')} vues uniques`}
                    </b>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-400 font-bold block">
                      {activeDayData.sales} commandes
                    </span>
                    <span className="text-[10px] text-white/50">{formatFCFA(activeDayData.revenue)}</span>
                  </div>
                </div>
              )}

              {/* Bar Chart Visualization */}
              <div className="flex items-end justify-between gap-2 h-36 pt-4 px-1">
                {dailyData.map((d, i) => {
                  const val = d[chartMetric];
                  const heightPercent = Math.max(15, Math.round((val / maxChartValue) * 100));
                  const isSelected = selectedDayIdx === i;

                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedDayIdx(i)}
                      className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end cursor-pointer group"
                    >
                      <div className="relative w-full flex justify-center">
                        <div
                          className={`w-full max-w-[28px] rounded-t-xl transition-all duration-200 group-hover:scale-105 ${
                            isSelected
                              ? 'bg-gradient-to-t from-[#FF6321] to-[#ff854d] shadow-lg shadow-[#FF6321]/30'
                              : 'bg-white/15 group-hover:bg-white/30'
                          }`}
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                      <span
                        className={`text-[9px] font-bold tracking-tight ${
                          isSelected ? 'text-[#FF6321]' : 'text-white/50 group-hover:text-white'
                        }`}
                      >
                        {d.label.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* FIXED BOTTOM ACTION BAR (Identical to ProductDetailModal & ProductPromotionScreen) */}
        <footer className="absolute bottom-0 left-0 right-0 z-30 p-4 bg-[#121212]/95 backdrop-blur-md border-t border-white/10 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenPhotoDetail(product);
            }}
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white border border-white/10 transition active:scale-95 flex items-center justify-center shrink-0"
            title="Voir la galerie photo de l'article"
          >
            <Camera className="w-5 h-5 text-white/80" />
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenBoost(product);
            }}
            className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#FF6321] to-[#ff753b] hover:from-[#ff753b] hover:to-[#FF6321] text-white text-xs font-black shadow-xl shadow-[#FF6321]/25 transition flex items-center justify-center gap-2 active:scale-95"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>Booster cet article (Djassa Ads)</span>
            <ChevronRight className="w-4 h-4 ml-auto" />
          </button>
        </footer>
      </div>
    </div>
  );
};
