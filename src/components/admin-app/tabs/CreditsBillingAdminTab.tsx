import React, { useState, useEffect, useCallback } from 'react';
import { 
  Zap, 
  TrendingUp, 
  DollarSign, 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCw, 
  Sliders, 
  Check, 
  HelpCircle, 
  RotateCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { creditsService, AdminStatsResponse, CreditConfig, RechargeLog } from '../../../services/creditsService';
import { formatFCFA } from '../../../services/marketServices';
import { useApp } from '../../../context/AppContext';

export const CreditsBillingAdminTab: React.FC = () => {
  const { showToast } = useApp();
  const [statsData, setStatsData] = useState<AdminStatsResponse | null>(null);
  const [pendingRecharges, setPendingRecharges] = useState<RechargeLog[]>([]);
  const [verifyingRechargeId, setVerifyingRechargeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Filter for usage logs
  const [logFilter, setLogFilter] = useState<'all' | 'chat' | 'image' | 'video' | 'refunded'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Editable Config
  const [chatCredits, setChatCredits] = useState<number>(5);
  const [chatModel, setChatModel] = useState<string>("MiniMax H3 Max Turbo / MiniMax M3.1 Flash");
  const [chatApiCost, setChatApiCost] = useState<number>(1.2);

  const [imageCredits, setImageCredits] = useState<number>(10);
  const [imageModel, setImageModel] = useState<string>("Qwen Image 2.1 Turbo");
  const [imageApiCost, setImageApiCost] = useState<number>(12.5);

  const [videoCredits, setVideoCredits] = useState<number>(60);
  const [videoModel, setVideoModel] = useState<string>("MiniMax H3 Max Turbo");
  const [videoApiCost, setVideoApiCost] = useState<number>(175.0);

  const [creditValueFcfa, setCreditValueFcfa] = useState<number>(10);
  const [minRechargeFcfa, setMinRechargeFcfa] = useState<number>(3500);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const [data, pendingRes] = await Promise.all([
        creditsService.getAdminStats(),
        creditsService.getPendingRecharges().catch(() => ({ success: false, pendingRecharges: [] as RechargeLog[] }))
      ]);
      setStatsData(data);
      setPendingRecharges(pendingRes.pendingRecharges || []);
      if (data.config) {
        setCreditValueFcfa(data.config.creditValueFcfa || 10);
        setMinRechargeFcfa(data.config.minRechargeFcfa || 3500);
        if (data.config.pricing.chat) {
          setChatCredits(data.config.pricing.chat.credits);
          setChatModel(data.config.pricing.chat.model);
          setChatApiCost(data.config.pricing.chat.apiCostFcfa);
        }
        if (data.config.pricing.image) {
          setImageCredits(data.config.pricing.image.credits);
          setImageModel(data.config.pricing.image.model);
          setImageApiCost(data.config.pricing.image.apiCostFcfa);
        }
        if (data.config.pricing.video) {
          setVideoCredits(data.config.pricing.video.credits);
          setVideoModel(data.config.pricing.video.model);
          setVideoApiCost(data.config.pricing.video.apiCostFcfa);
        }
      }
    } catch (e: any) {
      showToast("Erreur lors de la récupération des statistiques de facturation");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      await creditsService.updateConfig({
        creditValueFcfa,
        minRechargeFcfa,
        pricing: {
          chat: {
            name: "Discussion avec l'IA",
            credits: Number(chatCredits),
            model: chatModel,
            apiCostFcfa: Number(chatApiCost),
            isEstimate: true,
            costSource: "Estimation signalée (~1.5k tokens)",
            provider: "RodiumAI"
          },
          image: {
            name: "Génération d'une image RodiumAI",
            credits: Number(imageCredits),
            model: imageModel,
            apiCostFcfa: Number(imageApiCost),
            isEstimate: false,
            costSource: "Coût officiel fournisseur ($0.020 / image)",
            provider: "RodiumAI"
          },
          video: {
            name: "Génération d'une vidéo de 5 secondes",
            credits: Number(videoCredits),
            model: videoModel,
            apiCostFcfa: Number(videoApiCost),
            isEstimate: false,
            costSource: "Coût officiel fournisseur ($0.280 / vidéo 5s)",
            provider: "RodiumAI"
          }
        }
      });
      showToast("✅ Configuration des tarifs et modèles enregistrée avec succès !");
      await fetchStats();
    } catch (err: any) {
      showToast(err.message || "Erreur de sauvegarde");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleRunSimulation = async (type: 'recharge_3500' | 'recharge_5000' | 'recharge_10000' | 'chat' | 'image' | 'video' | 'failure_refund') => {
    setIsSimulating(true);
    try {
      if (type.startsWith('recharge_')) {
        const amount = type === 'recharge_3500' ? 3500 : type === 'recharge_5000' ? 5000 : 10000;
        const rchRes = await creditsService.confirmRecharge({
          userId: 'test-admin-user',
          amountFcfa: amount,
          paymentMethod: 'wave',
          phoneNumber: '07 00 11 22 33'
        });
        showToast(
          rchRes.pending
            ? `Demande de recharge ${amount} FCFA enregistrée en attente (validez-la ci-dessous pour créditer).`
            : `Recharge ${amount} FCFA confirmée côté serveur !`
        );
      } else if (type === 'failure_refund') {
        const deductRes = await creditsService.deductCredits({
          serviceType: 'image',
          label: 'Test débit suivi de remboursement admin'
        });
        if (deductRes.usage?.id) {
          const refundRes = await creditsService.requestRefund(
            deductRes.usage.id,
            'Simulation remboursement admin suite à erreur fournisseur'
          );
          showToast(refundRes.message || 'Remboursement admin exécuté côté serveur !');
        } else {
          showToast('Débit exécuté.');
        }
      } else {
        const labels = {
          chat: "Simulation Chat IA RodiumAI (5 crédits)",
          image: "Simulation Image Qwen 2.1 Turbo (10 crédits)",
          video: "Simulation Vidéo 5s RodiumAI (60 crédits)"
        };
        await creditsService.deductCredits({
          userId: 'test-admin-user',
          serviceType: type as 'chat' | 'image' | 'video',
          label: labels[type as 'chat' | 'image' | 'video']
        });
        showToast(`Simulation débit ${type} validée côté serveur !`);
      }
      await fetchStats();
    } catch (err: any) {
      showToast(err.message || "Erreur lors de la simulation");
    } finally {
      setIsSimulating(false);
    }
  };

  const financials = statsData?.financials;

  const filteredUsages = (statsData?.recentUsages || []).filter((u) => {
    if (logFilter === 'refunded' && u.status !== 'refunded') return false;
    if (logFilter !== 'all' && logFilter !== 'refunded' && u.serviceType !== logFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return u.label.toLowerCase().includes(q) || u.model.toLowerCase().includes(q) || u.userId.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div id="admin-credits-billing-screen" className="h-full overflow-y-auto no-scrollbar p-4 md:p-6 space-y-6 pb-24 text-white">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg md:text-xl font-black tracking-tight text-white">
              Facturation des API & Rentabilité des Crédits
            </h2>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Serveur Confirmé
            </span>
          </div>
          <p className="text-xs text-white/50 mt-0.5">
            Suivi des recharges, coûts réels d'API en FCFA, calcul du bénéfice brut et net, et gestion des tarifs.
          </p>
        </div>

        <button
          onClick={fetchStats}
          disabled={isLoading}
          className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-300' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* =========================================================================
          1. FINANCIAL KPI CARDS
          ========================================================================= */}
      {financials && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: CA Consommé */}
          <div className="p-4 rounded-2xl bg-[#161616] border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-white/60">
              <span className="text-xs font-medium">Chiffre d'Affaires Consommé</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl md:text-2xl font-black text-white">
              {formatFCFA(financials.totalConsumedRevenueFcfa)}
            </div>
            <div className="text-[11px] text-white/50 flex items-center justify-between">
              <span>{financials.totalCreditsConsumed} crédits consommés</span>
              <span className="text-emerald-400 font-bold">1 cr = 10 F</span>
            </div>
          </div>

          {/* Card 2: Coût Réel API */}
          <div className="p-4 rounded-2xl bg-[#161616] border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-white/60">
              <span className="text-xs font-medium">Coût Réel Fournisseur API</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl md:text-2xl font-black text-amber-300">
              {financials.totalRealApiCostFcfa.toFixed(1)} FCFA
            </div>
            <div className="text-[11px] text-white/50 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span>Coûts réels vérifiés & signalés</span>
            </div>
          </div>

          {/* Card 3: Bénéfice Brut */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-emerald-950/20 border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between text-emerald-300">
              <span className="text-xs font-bold">Bénéfice Brut Estimé</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl md:text-2xl font-black text-emerald-400">
              {formatFCFA(Math.round(financials.totalGrossProfitFcfa))}
            </div>
            <div className="text-[11px] text-emerald-200/80 flex items-center justify-between">
              <span>Marge brute calculée :</span>
              <strong className="font-black text-white">{financials.grossMarginPercent}%</strong>
            </div>
          </div>

          {/* Card 4: Bénéfice Net */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/15 to-purple-950/20 border border-purple-500/30 space-y-2">
            <div className="flex items-center justify-between text-purple-300">
              <span className="text-xs font-bold">Bénéfice Net Réel</span>
              <ShieldCheck className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-xl md:text-2xl font-black text-purple-300">
              {formatFCFA(Math.round(financials.netProfitFcfa))}
            </div>
            <div className="text-[10px] text-white/50">
              Après frais passerelle ({financials.totalPaymentFeesFcfa} F) & remb. ({financials.totalRefundsFcfa} F)
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          2. CONFIGURATION DES TARIFS ET MODÈLES (EXIGENCE 4)
          ========================================================================= */}
      <div className="p-5 rounded-3xl bg-[#161616] border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#FF6321]" />
              <span>Configuration des Tarifs & Modèles IA (Administration)</span>
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              Modifiez les crédits débités, les modèles associés et les coûts réels fournisseurs.
            </p>
          </div>
          <button
            onClick={handleSaveConfig}
            disabled={isSavingConfig}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF6321] to-[#FF8038] hover:opacity-95 text-white text-xs font-black flex items-center gap-1.5 shadow-md active:scale-95 transition disabled:opacity-50 cursor-pointer"
          >
            {isSavingConfig ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>Enregistrer la Configuration Serveur</span>
          </button>
        </div>

        {/* Global Credit Base Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 text-xs">
          <div>
            <label className="text-white/60 block mb-1 font-semibold">Valeur d'1 Crédit (FCFA) :</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={creditValueFcfa}
                onChange={(e) => setCreditValueFcfa(Number(e.target.value))}
                className="w-24 px-3 py-1.5 rounded-xl bg-black border border-white/20 font-bold text-white text-xs"
              />
              <span className="text-white/50">1 crédit = 10 FCFA (Fixé)</span>
            </div>
          </div>
          <div>
            <label className="text-white/60 block mb-1 font-semibold">Seuil de Recharge Minimale (FCFA) :</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={minRechargeFcfa}
                onChange={(e) => setMinRechargeFcfa(Number(e.target.value))}
                className="w-28 px-3 py-1.5 rounded-xl bg-black border border-white/20 font-bold text-white text-xs"
              />
              <span className="text-white/50">Min: 3 500 FCFA (350 crédits)</span>
            </div>
          </div>
        </div>

        {/* 3 Services Table Config */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Service 1: Discussion IA */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">1. Discussion avec l'IA</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">Chat</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <label className="text-white/60 block text-[11px]">Crédits par question :</label>
              <input
                type="number"
                value={chatCredits}
                onChange={(e) => setChatCredits(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-xl bg-black border border-white/15 text-white font-bold"
              />
            </div>
            <div className="space-y-1.5 text-xs">
              <label className="text-white/60 block text-[11px]">Modèle IA déployé :</label>
              <input
                type="text"
                value={chatModel}
                onChange={(e) => setChatModel(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-black border border-white/15 text-white font-semibold text-xs"
              />
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <label className="text-white/60">Coût réel API (FCFA) :</label>
                <span className="text-[10px] text-amber-400 font-bold">Estimation signalée</span>
              </div>
              <input
                type="number"
                step="0.1"
                value={chatApiCost}
                onChange={(e) => setChatApiCost(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-xl bg-black border border-white/15 text-white font-bold"
              />
              <span className="text-[10px] text-white/40 block">
                Bénéfice brut : {(chatCredits * creditValueFcfa - chatApiCost).toFixed(1)} FCFA
              </span>
            </div>
          </div>

          {/* Service 2: Image Qwen 2.1 Turbo */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">2. Image Qwen 2.1 Turbo</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">Image</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <label className="text-white/60 block text-[11px]">Crédits par image :</label>
              <input
                type="number"
                value={imageCredits}
                onChange={(e) => setImageCredits(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-xl bg-black border border-white/15 text-white font-bold"
              />
            </div>
            <div className="space-y-1.5 text-xs">
              <label className="text-white/60 block text-[11px]">Modèle IA déployé :</label>
              <input
                type="text"
                value={imageModel}
                onChange={(e) => setImageModel(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-black border border-white/15 text-white font-semibold text-xs"
              />
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <label className="text-white/60">Coût réel API (FCFA) :</label>
                <span className="text-[10px] text-emerald-400 font-bold">Coût officiel (0.02$)</span>
              </div>
              <input
                type="number"
                step="0.5"
                value={imageApiCost}
                onChange={(e) => setImageApiCost(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-xl bg-black border border-white/15 text-white font-bold"
              />
              <span className="text-[10px] text-white/40 block">
                Bénéfice brut : {(imageCredits * creditValueFcfa - imageApiCost).toFixed(1)} FCFA
              </span>
            </div>
          </div>

          {/* Service 3: Vidéo 5s */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">3. Vidéo de 5 secondes</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300">Vidéo 5s</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <label className="text-white/60 block text-[11px]">Crédits par vidéo 5s :</label>
              <input
                type="number"
                value={videoCredits}
                onChange={(e) => setVideoCredits(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-xl bg-black border border-white/15 text-white font-bold"
              />
            </div>
            <div className="space-y-1.5 text-xs">
              <label className="text-white/60 block text-[11px]">Modèle IA déployé :</label>
              <input
                type="text"
                value={videoModel}
                onChange={(e) => setVideoModel(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-black border border-white/15 text-white font-semibold text-xs"
              />
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px]">
                <label className="text-white/60">Coût réel API (FCFA) :</label>
                <span className="text-[10px] text-emerald-400 font-bold">Coût officiel (0.28$)</span>
              </div>
              <input
                type="number"
                step="5"
                value={videoApiCost}
                onChange={(e) => setVideoApiCost(Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-xl bg-black border border-white/15 text-white font-bold"
              />
              <span className="text-[10px] text-white/40 block">
                Bénéfice brut : {(videoCredits * creditValueFcfa - videoApiCost).toFixed(1)} FCFA
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. BANC DE TESTS ET SIMULATIONS SERVEUR (EXIGENCE 5)
          ========================================================================= */}
      <div className="p-5 rounded-3xl bg-[#161616] border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-purple-400" />
            <span>Console de Tests des Recharges, Débits et Remboursements Automatiques</span>
          </h3>
          <span className="text-[10px] text-white/40">Exigence de validation</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          <button
            onClick={() => handleRunSimulation('recharge_3500')}
            disabled={isSimulating}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-center text-xs font-bold transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <span className="text-[10px] text-emerald-400 block">+350 cr.</span>
            <span>Recharge 3 500 F</span>
          </button>
          <button
            onClick={() => handleRunSimulation('recharge_5000')}
            disabled={isSimulating}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-center text-xs font-bold transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <span className="text-[10px] text-emerald-400 block">+500 cr.</span>
            <span>Pack 5 000 F</span>
          </button>
          <button
            onClick={() => handleRunSimulation('recharge_10000')}
            disabled={isSimulating}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-center text-xs font-bold transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <span className="text-[10px] text-emerald-400 block">+1 000 cr.</span>
            <span>Pack 10 000 F</span>
          </button>
          <button
            onClick={() => handleRunSimulation('chat')}
            disabled={isSimulating}
            className="p-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-center text-xs font-bold transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <span className="text-[10px] text-blue-300 block">-5 cr.</span>
            <span>Test Chat IA</span>
          </button>
          <button
            onClick={() => handleRunSimulation('image')}
            disabled={isSimulating}
            className="p-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-center text-xs font-bold transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <span className="text-[10px] text-purple-300 block">-10 cr.</span>
            <span>Test Image IA</span>
          </button>
          <button
            onClick={() => handleRunSimulation('video')}
            disabled={isSimulating}
            className="p-2.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-center text-xs font-bold transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <span className="text-[10px] text-orange-300 block">-60 cr.</span>
            <span>Test Vidéo 5s</span>
          </button>
          <button
            onClick={() => handleRunSimulation('failure_refund')}
            disabled={isSimulating}
            className="p-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-center text-xs font-bold transition active:scale-95 cursor-pointer disabled:opacity-50 col-span-2 sm:col-span-1"
          >
            <span className="text-[10px] text-amber-300 block">↺ Auto-Refund</span>
            <span>Test Échec & Remb.</span>
          </button>
        </div>
      </div>

      {/* Pending Recharges awaiting server/admin confirmation */}
      <div className="p-5 rounded-3xl bg-[#161616] border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Recharges en attente de validation ({pendingRecharges.length})</span>
          </h3>
          <span className="text-[10px] text-white/50">Contrôle anti-auto-validation</span>
        </div>

        {pendingRecharges.length === 0 ? (
          <p className="text-xs text-white/40">Aucune recharge en attente de confirmation.</p>
        ) : (
          <div className="space-y-2">
            {pendingRecharges.map((r) => (
              <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-2xl bg-black/30 border border-white/10 text-xs">
                <div>
                  <div className="font-bold text-white">
                    {r.userId} • {formatFCFA(r.amountFcfa)} ({r.credits} crédits)
                  </div>
                  <div className="text-[11px] text-white/50">
                    {r.paymentMethod.toUpperCase()} {r.phoneNumber ? `• ${r.phoneNumber}` : ''} • {new Date(r.createdAt).toLocaleString()}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={verifyingRechargeId === r.id}
                  onClick={async () => {
                    setVerifyingRechargeId(r.id);
                    try {
                      const res = await creditsService.verifyRecharge(r.id);
                      showToast(res.message || 'Recharge validée !');
                      await fetchStats();
                    } catch (err: any) {
                      showToast(err.message || 'Erreur lors de la validation');
                    } finally {
                      setVerifyingRechargeId(null);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs cursor-pointer disabled:opacity-50"
                >
                  {verifyingRechargeId === r.id ? 'Validation...' : 'Valider le paiement'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* =========================================================================
          4. JOURNAL DÉTAILLÉ DES UTILISATIONS & COUTS FOURNISSEURS
          ========================================================================= */}
      <div className="p-5 rounded-3xl bg-[#161616] border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-white">
              Journal des Utilisations, Modèles Employés & Rentabilité
            </h3>
            <p className="text-xs text-white/50">
              Historique vérifié côté serveur avec coût fournisseur réel en FCFA et marge brute calculée.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'Tout' },
              { id: 'chat', label: 'Chat (5 cr)' },
              { id: 'image', label: 'Image (10 cr)' },
              { id: 'video', label: 'Vidéo (60 cr)' },
              { id: 'refunded', label: 'Remboursements' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setLogFilter(f.id as any)}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition shrink-0 ${
                  logFilter === f.id
                    ? 'bg-purple-500 text-white shadow'
                    : 'bg-white/5 text-white/60 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Usages Table */}
        <div className="overflow-x-auto no-scrollbar rounded-2xl border border-white/5 bg-black/20">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 text-white/60 uppercase text-[10px] font-bold border-b border-white/10">
              <tr>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Service & Modèle Employé</th>
                <th className="py-3 px-3 text-center">Crédits</th>
                <th className="py-3 px-3 text-right">Encaissé</th>
                <th className="py-3 px-3 text-right">Coût API Fournisseur</th>
                <th className="py-3 px-3 text-right">Bénéfice Brut</th>
                <th className="py-3 px-3 text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsages.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-white/40">
                    Aucune transaction trouvée pour ces filtres.
                  </td>
                </tr>
              ) : (
                filteredUsages.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-3 text-[11px] text-white/50 whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-white">{u.label}</div>
                      <div className="text-[10px] text-purple-300/80 flex items-center gap-1.5 mt-0.5">
                        <span>{u.model}</span>
                        {u.isEstimate ? (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                            Estimation Signalée
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">
                            Coût Réel
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center font-black text-amber-300">
                      {u.credits} cr.
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-white">
                      {formatFCFA(u.amountChargedFcfa)}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-amber-200">
                      {u.apiCostFcfa.toFixed(1)} F
                    </td>
                    <td className="py-3 px-3 text-right font-black text-emerald-400">
                      +{u.grossProfitFcfa.toFixed(1)} F
                    </td>
                    <td className="py-3 px-3 text-center">
                      {u.status === 'success' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3" /> Succès
                        </span>
                      ) : u.status === 'refunded' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                          <RefreshCw className="w-3 h-3" /> Remboursé
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold">
                          <XCircle className="w-3 h-3" /> Échec
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
