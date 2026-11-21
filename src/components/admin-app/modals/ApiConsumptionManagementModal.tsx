import React, { useState, useMemo } from 'react';
import {
  X,
  Activity,
  ShieldCheck,
  ShieldAlert,
  Zap,
  TrendingUp,
  RefreshCw,
  Power,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Key,
  Globe,
  HardDrive,
  Bell,
  SlidersHorizontal,
  ChevronRight,
  User,
  Store,
  Truck,
  Download,
  Search,
  Check,
  CreditCard,
  Navigation,
  FileText,
  Database,
  Info,
  Edit3,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { ApiConsumptionItem, getRolesForApi, getRoleUsageDescription } from '../dashboard/AdminApiSection';
import { formatFCFA } from '../../../services/marketServices';
import { securityService } from '../../../services/securityService';

export interface ApiConsumptionManagementModalProps {
  api?: ApiConsumptionItem;
  selectedApi?: ApiConsumptionItem;
  allApis?: ApiConsumptionItem[];
  alertThreshold: number;
  onClose: () => void;
  onSave?: (updatedApi: ApiConsumptionItem) => void;
  onSaveApi?: (updatedApi: ApiConsumptionItem) => void;
  onPing: (apiId: string) => void;
  onResetUsage: (apiId: string) => void;
  onToggleActive?: (apiId: string, newActiveState: boolean) => void;
}

export const ApiConsumptionManagementModal: React.FC<ApiConsumptionManagementModalProps> = ({
  api,
  selectedApi,
  allApis = [],
  alertThreshold,
  onClose,
  onSave,
  onSaveApi,
  onPing,
  onResetUsage,
  onToggleActive
}) => {
  // Determine primary selected API
  const activeSelected = selectedApi || api;
  const initialApisList = useMemo(() => {
    if (allApis && allApis.length > 0) return allApis;
    if (activeSelected) return [activeSelected];
    return [];
  }, [allApis, activeSelected]);

  // Local state for table items so changes can be previewed or saved immediately
  const [tableApis, setTableApis] = useState<ApiConsumptionItem[]>(initialApisList);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedApiId, setSelectedApiId] = useState<string>(activeSelected ? activeSelected.id : (initialApisList[0]?.id || ''));

  // Ping tracking per API
  const [pingingMap, setPingingMap] = useState<Record<string, boolean>>({});
  const [lastPingResults, setLastPingResults] = useState<Record<string, { latency: number; timestamp: string }>>({});

  // Mini-modal for adjusting quota of a specific API
  const [editingQuotaApi, setEditingQuotaApi] = useState<ApiConsumptionItem | null>(null);
  const [newQuotaValue, setNewQuotaValue] = useState<number>(0);
  const [newRateLimitValue, setNewRateLimitValue] = useState<number>(0);

  // Detail drawer for technical information
  const [infoDrawerApi, setInfoDrawerApi] = useState<ApiConsumptionItem | null>(null);

  // Filtered APIs based on search and category
  const filteredApis = useMemo(() => {
    return tableApis.filter(item => {
      const matchesSearch = 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.endpoint.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.unit.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [tableApis, searchQuery, selectedCategory]);

  // Global KPIs for summary header
  const totalCallsCount = useMemo(() => {
    return tableApis.reduce((acc, curr) => acc + curr.usedCalls, 0);
  }, [tableApis]);

  const totalCostFCFA = useMemo(() => {
    return tableApis.reduce((acc, curr) => acc + curr.estimatedCostFCFA, 0);
  }, [tableApis]);

  const activeServicesCount = useMemo(() => {
    return tableApis.filter(item => item.status !== 'down').length;
  }, [tableApis]);

  const totalServicesCount = tableApis.length;

  // Toggle active state for an API
  const handleToggleServiceActive = (apiId: string) => {
    const current = tableApis.find(a => a.id === apiId);
    if (!current) return;
    const isCurrentlyActive = current.status !== 'down';
    const newStatus: 'healthy' | 'down' = isCurrentlyActive ? 'down' : 'healthy';

    setTableApis(prev => prev.map(a => {
      if (a.id === apiId) {
        return { ...a, status: newStatus };
      }
      return a;
    }));

    void securityService.recordActivity({
      category: 'api',
      action: !isCurrentlyActive ? `Activation passerelle API ${current.name}` : `Suspension passerelle API ${current.name}`,
      actionType: 'api_gateway_toggle',
      target: current.name,
      targetType: 'api',
      entityType: 'api_provider',
      entityId: current.id,
      space: 'admin',
      result: 'reussi',
      severity: !isCurrentlyActive ? 'moyen' : 'eleve',
      beforeValue: isCurrentlyActive ? 'Actif' : 'Inactif',
      afterValue: !isCurrentlyActive ? 'Actif' : 'Inactif',
      details: `Passerelle ${current.provider} (${current.name})`
    });

    if (onToggleActive) {
      onToggleActive(apiId, !isCurrentlyActive);
    } else {
      const updated = { ...current, status: newStatus };
      if (onSave) onSave(updated);
      if (onSaveApi) onSaveApi(updated);
    }
  };

  // Perform Ping on an API
  const handleTriggerPing = (apiId: string) => {
    setPingingMap(prev => ({ ...prev, [apiId]: true }));
    onPing(apiId);

    setTimeout(() => {
      const current = tableApis.find(a => a.id === apiId);
      const baseLatency = current ? current.latencyMs : 80;
      const variation = Math.floor(Math.random() * 16 - 8);
      const finalLatency = Math.max(18, baseLatency + variation);
      const nowStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      setLastPingResults(prev => ({
        ...prev,
        [apiId]: { latency: finalLatency, timestamp: nowStr }
      }));

      setPingingMap(prev => ({ ...prev, [apiId]: false }));
    }, 500);
  };

  // Reset usage
  const handleTriggerReset = (apiId: string) => {
    const target = tableApis.find(a => a.id === apiId);
    if (!target) return;
    if (window.confirm(`Confirmez-vous la remise à zéro de la consommation pour le service "${target.name}" ?`)) {
      setTableApis(prev => prev.map(a => {
        if (a.id === apiId) {
          return { ...a, usedCalls: 0, estimatedCostFCFA: 0 };
        }
        return a;
      }));
      void securityService.recordActivity({
        category: 'api',
        action: `Remise à zéro compteur API ${target.name}`,
        actionType: 'api_usage_reset',
        target: target.name,
        targetType: 'api',
        entityType: 'api_provider',
        entityId: target.id,
        space: 'admin',
        result: 'reussi',
        severity: 'moyen',
        beforeValue: `${target.usedCalls} appels / ${target.estimatedCostFCFA} FCFA`,
        afterValue: '0 appels / 0 FCFA',
        details: `Compteur réinitialisé pour ${target.provider}`
      });
      onResetUsage(apiId);
    }
  };

  // Open Quota adjustment modal
  const handleOpenEditQuota = (item: ApiConsumptionItem) => {
    setEditingQuotaApi(item);
    setNewQuotaValue(item.maxQuota);
    setNewRateLimitValue(item.rateLimitPerMin);
  };

  // Save Quota adjustment
  const handleSaveQuota = () => {
    if (!editingQuotaApi) return;
    const updated = {
      ...editingQuotaApi,
      maxQuota: newQuotaValue,
      rateLimitPerMin: newRateLimitValue
    };

    void securityService.recordActivity({
      category: 'api',
      action: `Modification plafond & débit API ${editingQuotaApi.name}`,
      actionType: 'api_quota_update',
      target: editingQuotaApi.name,
      targetType: 'api',
      entityType: 'api_provider',
      entityId: editingQuotaApi.id,
      space: 'admin',
      result: 'reussi',
      severity: 'moyen',
      beforeValue: `Quota ${editingQuotaApi.maxQuota} • ${editingQuotaApi.rateLimitPerMin} req/min`,
      afterValue: `Quota ${newQuotaValue} • ${newRateLimitValue} req/min`,
      details: `Ajustement plafond pour ${editingQuotaApi.provider}`
    });

    setTableApis(prev => prev.map(a => a.id === editingQuotaApi.id ? updated : a));
    if (onSave) onSave(updated);
    if (onSaveApi) onSaveApi(updated);
    setEditingQuotaApi(null);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Information (Catégorie)',
      'Nom du service',
      'Fournisseur',
      'Nombre d utilisations',
      'Quantité consommée',
      'Quota Max',
      'Pourcentage consommé',
      'l unité facturée',
      'Tarif unitaire FCFA',
      'Coût total estimé FCFA',
      'État Actif',
      'Latence moyenne'
    ];

    const rows = tableApis.map(api => [
      `"${api.category.toUpperCase()} - ${api.endpoint}"`,
      `"${api.name}"`,
      `"${api.provider}"`,
      api.usedCalls,
      api.usedCalls,
      api.maxQuota,
      `${Math.round((api.usedCalls / api.maxQuota) * 100)}%`,
      `"${api.unit}"`,
      api.costPerUnitFCFA,
      api.estimatedCostFCFA,
      api.status !== 'down' ? 'Actif' : 'Inactif',
      `${api.latencyMs}ms`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tableau_consommation_api_djassa_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Category Icon helper
  const renderCategoryIcon = (category: string) => {
    switch (category) {
      case 'ai':
        return <Sparkles className="w-4 h-4 text-purple-400" />;
      case 'payment':
        return <CreditCard className="w-4 h-4 text-emerald-400" />;
      case 'maps':
        return <Navigation className="w-4 h-4 text-sky-400" />;
      case 'sms':
        return <MessageSquare className="w-4 h-4 text-amber-400" />;
      case 'storage':
        return <Database className="w-4 h-4 text-cyan-400" />;
      case 'push':
        return <Bell className="w-4 h-4 text-rose-400" />;
      default:
        return <Activity className="w-4 h-4 text-indigo-400" />;
    }
  };

  const renderCategoryBadge = (category: string) => {
    switch (category) {
      case 'ai':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">IA Studio</span>;
      case 'payment':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">Paiement Mobile</span>;
      case 'maps':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/20">Cartographie CI</span>;
      case 'sms':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">SMS OTP</span>;
      case 'storage':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">Stockage Vidéo</span>;
      case 'push':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">Notifications FCM</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/10 text-slate-300 border border-slate-500/20">API Rest</span>;
    }
  };

  return (
    <div
      id="api-consumption-table-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-7xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl shadow-indigo-950/50 overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* =====================================================================
            TOP BAR HEADER (SANS ONGLETS)
            ===================================================================== */}
        <div className="px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight text-white">
                  Tableau de Consommation des APIs
                </h2>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Temps Réel
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Vue consolidée sans onglets : informations, volume consommé, facturation et activation des passerelles Djassa.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-xl transition shadow-sm"
              title="Télécharger le rapport de consommation au format CSV"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              <span>Exporter CSV</span>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition border border-slate-700"
              title="Fermer la vue"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* =====================================================================
            SYNTHÈSE EXÉCUTIVE (KPIs STATISTIQUES)
            ===================================================================== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 py-3.5 bg-slate-900/60 border-b border-slate-800 text-xs">
          <div className="p-3 rounded-2xl bg-slate-800/40 border border-slate-700/50 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Nombre d'utilisations total</div>
              <div className="text-base font-black text-white mt-0.5">
                {totalCallsCount.toLocaleString('fr-FR')} <span className="text-[10px] font-normal text-slate-400">appels</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-800/40 border border-slate-700/50 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Quantité globale consommée</div>
              <div className="text-base font-black text-emerald-400 mt-0.5">
                {Math.round((tableApis.reduce((a, b) => a + (b.usedCalls / b.maxQuota), 0) / (totalServicesCount || 1)) * 100)}%
                <span className="text-[10px] font-normal text-slate-400 ml-1">du quota moyen</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-800/40 border border-slate-700/50 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Montant total facturé</div>
              <div className="text-base font-black text-amber-400 mt-0.5">
                {formatFCFA(totalCostFCFA)}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-800/40 border border-slate-700/50 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">État Actif du réseau</div>
              <div className="text-base font-black text-white mt-0.5 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>{activeServicesCount} / {totalServicesCount} Actifs</span>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================================
            BARRE DE FILTRES ET RECHERCHE
            ===================================================================== */}
        <div className="px-6 py-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {/* Champ Recherche */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrer par service, fournisseur, endpoint..."
              className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtres par Catégorie */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-1">
            {[
              { id: 'all', label: 'Toutes les APIs', count: tableApis.length },
              { id: 'ai', label: 'Intelligence Artificielle', count: tableApis.filter(a => a.category === 'ai').length },
              { id: 'payment', label: 'Paiements CI', count: tableApis.filter(a => a.category === 'payment').length },
              { id: 'maps', label: 'Cartographie', count: tableApis.filter(a => a.category === 'maps').length },
              { id: 'sms', label: 'SMS & OTP', count: tableApis.filter(a => a.category === 'sms').length },
              { id: 'storage', label: 'CDN & Stockage', count: tableApis.filter(a => a.category === 'storage').length },
              { id: 'push', label: 'Notifications FCM', count: tableApis.filter(a => a.category === 'push').length }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl font-medium transition whitespace-nowrap flex items-center gap-1.5 ${
                  selectedCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                }`}
              >
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedCategory === cat.id ? 'bg-indigo-700 text-white' : 'bg-slate-700 text-slate-300'
                }`}>
                  {cat.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* =====================================================================
            LE TABLEAU DE CONSOMMATION DES APIS (LES 7 COLONNES EXACTES)
            1. Information
            2. Nom du service
            3. Fournisseur
            4. Nombre d'utilisations
            5. Quantité consommée
            6. l'unité facturée
            7. État Actif
            ===================================================================== */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="overflow-x-auto rounded-2xl border border-slate-800 shadow-xl bg-slate-900/60">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-800/90 text-slate-300 uppercase tracking-wider text-[11px] font-bold border-b border-slate-700/80">
                  <th scope="col" className="py-3.5 px-4 min-w-[150px]">
                    <div className="flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Information</span>
                    </div>
                  </th>
                  <th scope="col" className="py-3.5 px-4 min-w-[210px]">
                    <span>Nom du service</span>
                  </th>
                  <th scope="col" className="py-3.5 px-4 min-w-[180px]">
                    <span>Fournisseur</span>
                  </th>
                  <th scope="col" className="py-3.5 px-4 min-w-[140px]">
                    <span>Nombre d'utilisations</span>
                  </th>
                  <th scope="col" className="py-3.5 px-4 min-w-[220px]">
                    <span>Quantité consommée</span>
                  </th>
                  <th scope="col" className="py-3.5 px-4 min-w-[150px]">
                    <span>l'unité facturée</span>
                  </th>
                  <th scope="col" className="py-3.5 px-4 min-w-[170px] text-center">
                    <span>État Actif</span>
                  </th>
                  <th scope="col" className="py-3.5 px-3 min-w-[110px] text-right">
                    <span>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredApis.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center">
                        <Activity className="w-10 h-10 text-slate-600 mb-2" />
                        <p className="text-sm font-semibold text-slate-300">Aucun service trouvé pour cette recherche.</p>
                        <p className="text-xs text-slate-500 mt-1">Modifiez vos termes de recherche ou réinitialisez le filtre.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredApis.map((apiItem) => {
                    const isSelected = apiItem.id === selectedApiId;
                    const isActive = apiItem.status !== 'down';
                    const usagePercent = Math.min(100, Math.round((apiItem.usedCalls / apiItem.maxQuota) * 100));
                    const isOverWarning = usagePercent >= alertThreshold;
                    const roles = getRolesForApi(apiItem.id);
                    const isPinging = pingingMap[apiItem.id] || false;
                    const pingResult = lastPingResults[apiItem.id];

                    return (
                      <tr
                        key={apiItem.id}
                        id={`row-${apiItem.id}`}
                        onClick={() => setSelectedApiId(apiItem.id)}
                        className={`transition-colors duration-150 group cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-950/30 hover:bg-indigo-950/40 border-l-4 border-l-indigo-500'
                            : 'hover:bg-slate-800/50'
                        }`}
                      >
                        {/* ===================================================
                            1. COLONNE : Information
                            =================================================== */}
                        <td className="py-4 px-4 align-middle">
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                              {renderCategoryIcon(apiItem.category)}
                            </div>
                            <div className="space-y-1">
                              <div>{renderCategoryBadge(apiItem.category)}</div>
                              <div
                                className="text-[11px] text-slate-400 font-mono truncate max-w-[140px] block"
                                title={apiItem.endpoint}
                              >
                                {apiItem.endpoint.split('/')[0]}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInfoDrawerApi(apiItem);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 hover:underline"
                              >
                                <Info className="w-3 h-3" />
                                <span>Fiche tech.</span>
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* ===================================================
                            2. COLONNE : Nom du service
                            =================================================== */}
                        <td className="py-4 px-4 align-middle">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-white group-hover:text-indigo-200 transition">
                                {apiItem.name}
                              </span>
                              {isSelected && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shrink-0">
                                  Sélectionné
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1" title={apiItem.description}>
                              {apiItem.description}
                            </div>
                            {/* Rôles ciblés */}
                            <div className="flex items-center gap-1 mt-1.5">
                              {roles.includes('client') && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 text-[10px] font-medium border border-sky-500/20">
                                  <User className="w-2.5 h-2.5" /> Client
                                </span>
                              )}
                              {roles.includes('seller') && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 text-[10px] font-medium border border-amber-500/20">
                                  <Store className="w-2.5 h-2.5" /> Vendeur
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* ===================================================
                            3. COLONNE : Fournisseur
                            =================================================== */}
                        <td className="py-4 px-4 align-middle">
                          <div>
                            <div className="font-semibold text-slate-200 flex items-center gap-1">
                              <span>{apiItem.provider}</span>
                              <span title="Fournisseur Vérifié & Partenaire Officiel">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-500" />
                                {pingResult ? `${pingResult.latency} ms` : `${apiItem.latencyMs} ms`}
                              </span>
                              <span>•</span>
                              <span className="text-emerald-400 font-mono">SLA 99.9%</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Env : <span className="uppercase text-slate-400 font-semibold">{apiItem.environment}</span>
                            </div>
                          </div>
                        </td>

                        {/* ===================================================
                            4. COLONNE : Nombre d'utilisations
                            =================================================== */}
                        <td className="py-4 px-4 align-middle">
                          <div>
                            <div className="font-black text-sm text-white tracking-tight">
                              {apiItem.usedCalls.toLocaleString('fr-FR')}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              appels traités
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                              <span>Débit :</span>
                              <span className="font-semibold text-slate-300">{apiItem.rateLimitPerMin} req/min</span>
                            </div>
                          </div>
                        </td>

                        {/* ===================================================
                            5. COLONNE : Quantité consommée
                            =================================================== */}
                        <td className="py-4 px-4 align-middle">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-white">
                                {apiItem.usedCalls.toLocaleString('fr-FR')}{' '}
                                <span className="text-slate-400 font-normal">/ {apiItem.maxQuota.toLocaleString('fr-FR')}</span>
                              </span>
                              <span className={`font-black text-xs px-1.5 py-0.2 rounded ${
                                isOverWarning
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : usagePercent > 65
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}>
                                {usagePercent}%
                              </span>
                            </div>

                            {/* Jauge visuelle de consommation */}
                            <div className="w-full h-2 rounded-full bg-slate-800 border border-slate-700 overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 rounded-full ${
                                  isOverWarning
                                    ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                                    : usagePercent > 65
                                    ? 'bg-gradient-to-r from-emerald-500 to-amber-500'
                                    : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                }`}
                                style={{ width: `${usagePercent}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span>
                                Restant : {(Math.max(0, apiItem.maxQuota - apiItem.usedCalls)).toLocaleString('fr-FR')} {apiItem.unit}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditQuota(apiItem);
                                }}
                                className="text-indigo-400 hover:text-indigo-300 font-semibold hover:underline inline-flex items-center gap-0.5"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Ajuster</span>
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* ===================================================
                            6. COLONNE : l'unité facturée
                            =================================================== */}
                        <td className="py-4 px-4 align-middle">
                          <div>
                            <div className="font-semibold text-white capitalize flex items-center gap-1">
                              <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono">
                                {apiItem.unit}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1">
                              Tarif : <span className="font-mono text-slate-300 font-semibold">{apiItem.costPerUnitFCFA} FCFA</span> / unité
                            </div>
                            <div className="mt-1 text-xs font-bold text-amber-400">
                              {formatFCFA(apiItem.estimatedCostFCFA)} <span className="text-[10px] font-normal text-slate-400">facturés</span>
                            </div>
                          </div>
                        </td>

                        {/* ===================================================
                            7. COLONNE : État Actif
                            =================================================== */}
                        <td className="py-4 px-4 align-middle text-center">
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            {/* Toggle Switch Interactif */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleServiceActive(apiItem.id);
                              }}
                              className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                                isActive ? 'bg-emerald-500' : 'bg-slate-700'
                              }`}
                              role="switch"
                              aria-checked={isActive}
                              title={isActive ? 'Désactiver le service (Couper le trafic)' : 'Activer le service'}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                  isActive ? 'translate-x-6' : 'translate-x-0'
                                }`}
                              />
                            </button>

                            {/* Badge État Actif */}
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                Actif (En ligne)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                                <Power className="w-3 h-3" />
                                Inactif (Coupé)
                              </span>
                            )}

                            {/* Résultat Ping rapide */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTriggerPing(apiItem.id);
                              }}
                              disabled={isPinging || !isActive}
                              className={`mt-1 inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md border transition ${
                                !isActive
                                  ? 'opacity-40 cursor-not-allowed bg-slate-800 border-slate-700 text-slate-500'
                                  : isPinging
                                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                              }`}
                              title="Tester la connexion et latence"
                            >
                              <RefreshCw className={`w-2.5 h-2.5 ${isPinging ? 'animate-spin text-indigo-400' : ''}`} />
                              <span>{isPinging ? 'Test...' : 'Ping'}</span>
                            </button>
                          </div>
                        </td>

                        {/* ===================================================
                            ACTIONS COMPACTES
                            =================================================== */}
                        <td className="py-4 px-3 align-middle text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditQuota(apiItem);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/30 hover:text-indigo-300 text-slate-400 border border-slate-700 hover:border-indigo-500/40 transition"
                              title="Modifier Quota & Plafond"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTriggerReset(apiItem.id);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 text-slate-400 border border-slate-700 hover:border-rose-500/40 transition"
                              title="Remettre la consommation à zéro"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* =====================================================================
            PIED DE PAGE AVEC CONTRÔLES DIRECTS & LOG DE SÉCURITÉ
            ===================================================================== */}
        <div className="px-6 py-3.5 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              Contrôleur de flux actif • Quotas surveillés automatiquement avec coupure d’urgence (Circuit Breaker)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition border border-slate-700"
            >
              Fermer
            </button>
          </div>
        </div>

      </div>

      {/* =====================================================================
          MINI-MODAL DE MODIFICATION DU QUOTA POUR UN SERVICE SÉLECTIONNÉ
          ===================================================================== */}
      {editingQuotaApi && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingQuotaApi(null);
          }}
        >
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Ajuster la Consommation</h3>
                  <p className="text-xs text-slate-400">{editingQuotaApi.name}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingQuotaApi(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Plafond Max Quota */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Plafond Maximum ({editingQuotaApi.unit})
                </label>
                <input
                  type="number"
                  value={newQuotaValue}
                  onChange={(e) => setNewQuotaValue(Math.max(100, Number(e.target.value)))}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setNewQuotaValue(prev => Math.round(prev * 1.1))}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-[11px]"
                  >
                    +10%
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewQuotaValue(prev => Math.round(prev * 1.25))}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-[11px]"
                  >
                    +25%
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewQuotaValue(prev => Math.round(prev * 1.5))}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-[11px]"
                  >
                    +50%
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewQuotaValue(prev => Math.round(prev * 2))}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-[11px]"
                  >
                    x2 Plafond
                  </button>
                </div>
              </div>

              {/* Cadence Maximale */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Cadence Débit Max (Requêtes / Minute)
                </label>
                <input
                  type="number"
                  value={newRateLimitValue}
                  onChange={(e) => setNewRateLimitValue(Math.max(10, Number(e.target.value)))}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Rappel des consommations actuelles */}
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Consommation actuelle :</span>
                  <span className="font-bold text-white font-mono">{editingQuotaApi.usedCalls.toLocaleString('fr-FR')} {editingQuotaApi.unit}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Nouveau taux d'occupation :</span>
                  <span className="font-bold text-indigo-400 font-mono">
                    {Math.min(100, Math.round((editingQuotaApi.usedCalls / (newQuotaValue || 1)) * 100))}%
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingQuotaApi(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition text-xs"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveQuota}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition shadow-lg shadow-indigo-600/30 text-xs"
              >
                Appliquer Quota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          DRAWER D'INFORMATION TECHNIQUE (FICHE TECHNIQUE DU SERVICE)
          ===================================================================== */}
      {infoDrawerApi && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInfoDrawerApi(null);
          }}
        >
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  {renderCategoryIcon(infoDrawerApi.category)}
                </div>
                <div>
                  <h3 className="font-black text-white text-base">{infoDrawerApi.name}</h3>
                  <p className="text-slate-400">{infoDrawerApi.provider}</p>
                </div>
              </div>
              <button
                onClick={() => setInfoDrawerApi(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-slate-400 font-semibold block mb-1">Description opérationnelle :</span>
                <p className="text-slate-200 bg-slate-800/60 p-3 rounded-xl border border-slate-700 leading-relaxed">
                  {infoDrawerApi.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700">
                  <span className="text-slate-400 block text-[10px]">Endpoint API</span>
                  <span className="font-mono text-indigo-300 font-semibold text-xs break-all">
                    {infoDrawerApi.endpoint}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700">
                  <span className="text-slate-400 block text-[10px]">Clé API masquée</span>
                  <span className="font-mono text-slate-300 text-xs">
                    {infoDrawerApi.keyMasked}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700">
                  <span className="text-slate-400 block text-[10px]">Environnement</span>
                  <span className="uppercase text-emerald-400 font-bold text-xs">
                    {infoDrawerApi.environment}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700">
                  <span className="text-slate-400 block text-[10px]">Date de renouvellement</span>
                  <span className="text-slate-200 font-medium text-xs">
                    {infoDrawerApi.resetDate}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-800/40 rounded-xl border border-slate-700">
                <span className="text-slate-400 block text-[10px] font-semibold mb-1">Rôles Djassa concernés</span>
                <div className="space-y-1.5 mt-1">
                  {getRolesForApi(infoDrawerApi.id).map(r => (
                    <div key={r} className="flex items-center justify-between text-[11px] text-slate-300">
                      <span className="capitalize font-bold text-indigo-300">Application {r} :</span>
                      <span className="text-slate-400">{getRoleUsageDescription(infoDrawerApi.id, r)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setInfoDrawerApi(null)}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition text-xs"
              >
                Fermer la Fiche
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
