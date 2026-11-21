import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  MoreVertical,
  RefreshCw,
  Download,
  FileText,
  Printer,
  Calendar,
  Users,
  Crown,
  ListFilter,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  Settings,
  Info,
  Coins,
  Code2,
  Server,
  Calculator,
  ArrowUpDown,
  RotateCcw,
  Check,
  Store,
  Shield,
  User as UserIcon,
  Wallet,
  Activity,
  TrendingUp,
  Power,
  Save
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { formatFCFA } from '../../../services/marketServices';
import { securityService } from '../../../services/securityService';
import { ProviderIcon, type ApiProvider, type ProviderConfigChange } from './AdminApiSection';
import {
  INITIAL_ADMIN_PLANS,
  INITIAL_SUBSCRIBER_PROFILES,
  INITIAL_SUBSCRIPTION_API_RECORDS,
  type AdminPlanItem,
  type SubscriberProfile,
  type SubscriptionApiRecord
} from './AdminSubscriptionsManager';
import {
  PROVIDER_PROFILES,
  type ProviderAppKey,
  type ProviderExtendedSettings,
  type ProviderNativeAppLimits,
  type ProviderOperationItem,
  type ProviderTopTab,
  generateProviderOperations,
  getProviderAuditKey,
  loadProviderAppLimits,
  loadProviderAuditHistory,
  loadProviderExtendedSettings,
  saveProviderAppLimits,
  saveProviderExtendedSettings
} from './apiProvidersConfig';
import {
  Tab1ProviderConfig,
  Tab2ProviderPricingBalance,
  Tab3ProviderConfigApps,
  Tab4ProviderMonitoring
} from './ApiProviderManagementTabs';

type ConsumptionSubTab = 'date' | 'users' | 'subscriptions' | 'requests';
type PeriodScope = 'today' | 'yesterday' | '7d' | '30d' | 'this_month' | 'prev_month' | 'custom';
type AppScope = 'all' | 'Client' | 'Vendeur' | 'Administrateur';
type StatusScope = 'all' | 'success' | 'failed';
type ChartGranularity = 'hour' | 'day' | 'week' | 'month';
type ErrorHttpFilter = 'all' | '400' | '401' | '429' | '500' | 'other';

interface FilterState {
  period: PeriodScope;
  customStart: string;
  customEnd: string;
  app: AppScope;
  subscription: string;
  status: StatusScope;
}

const DEFAULT_FILTERS: FilterState = {
  period: '30d',
  customStart: '',
  customEnd: '',
  app: 'all',
  subscription: 'all',
  status: 'all'
};

interface ApiProviderDetailConsoleProps {
  provider: ApiProvider;
  onBack: () => void;
  onUpdateProvider?: (updated: ApiProvider) => void;
}

// Pure-TypeScript valid PDF generator for provider reports
const downloadProviderPdfReport = (
  title: string,
  lines: string[],
  filename: string
): void => {
  const safeAscii = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, ' ');

  const sanitizedLines = [safeAscii(title), ...lines.map(safeAscii)].slice(0, 42);
  let textCommands = 'BT\n/F1 13 Tf\n42 790 Td\n';
  sanitizedLines.forEach((line, idx) => {
    const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    if (idx === 0) {
      textCommands += `(${escaped}) Tj\n/F1 10 Tf\n0 -22 Td\n`;
    } else {
      textCommands += `(${escaped}) Tj\n0 -15 Td\n`;
    }
  });
  textCommands += 'ET';

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${textCommands.length} >>\nstream\n${textCommands}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// SVG Donut Chart
const SubscriptionDonutChart: React.FC<{
  segments: Array<{ label: string; value: number; color: string }>;
  centerPercent: string;
  centerLabel: string;
}> = ({ segments, centerPercent, centerLabel }) => {
  const total = Math.max(1, segments.reduce((s, item) => s + item.value, 0));
  const size = 128;
  const stroke = 15;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        {segments.map((seg, i) => {
          const pct = seg.value / total;
          const dash = pct * circumference;
          const gap = circumference - dash;
          const offset = -cumulative * circumference;
          cumulative += pct;
          return (
            <circle
              key={`${seg.label}-${i}`}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={offset}
              fill="none"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
        <span className="text-lg font-black text-white font-mono leading-none">{centerPercent}</span>
        <span className="text-[10px] font-semibold text-white/75 mt-1 truncate max-w-[78px]">{centerLabel}</span>
      </div>
    </div>
  );
};

export const ApiProviderDetailConsole: React.FC<ApiProviderDetailConsoleProps> = ({
  provider,
  onBack,
  onUpdateProvider
}) => {
  const { showToast } = useApp();
  const profile = PROVIDER_PROFILES[provider.id] || PROVIDER_PROFILES['api-google-maps'];

  const [topTab, setTopTab] = useState<ProviderTopTab>('config');
  const [activeSubTab, setActiveSubTab] = useState<ConsumptionSubTab>('date');
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const [extendedSettings, setExtendedSettings] = useState<ProviderExtendedSettings>(() =>
    loadProviderExtendedSettings(provider.id)
  );
  const [appLimits, setAppLimits] = useState<Record<ProviderAppKey, ProviderNativeAppLimits>>(() =>
    loadProviderAppLimits(provider.id)
  );
  const [auditHistory, setAuditHistory] = useState<ProviderConfigChange[]>(() =>
    loadProviderAuditHistory(provider)
  );

  // Filters & search state
  const [draftFilters, setDraftFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [granularity, setGranularity] = useState<ChartGranularity>('day');
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userSortBy, setUserSortBy] = useState<'volume' | 'cost' | 'ops'>('volume');
  const [requestSearchId, setRequestSearchId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Drill-down states
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedOperation, setSelectedOperation] = useState<ProviderOperationItem | null>(null);
  const [selectedPlanDetail, setSelectedPlanDetail] = useState<{ app: ProviderOperationItem['app']; name: string } | null>(null);
  const [showTechnicalLogs, setShowTechnicalLogs] = useState(false);
  const [errorHttpFilter, setErrorHttpFilter] = useState<ErrorHttpFilter>('all');

  // Real DJASSA entities
  const realPlans = useMemo<AdminPlanItem[]>(() => {
    try {
      const saved = localStorage.getItem('djassa_admin_managed_plans');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return INITIAL_ADMIN_PLANS;
  }, []);

  const realSubscribers = useMemo<SubscriberProfile[]>(() => {
    try {
      const saved = localStorage.getItem('djassa_admin_subscriber_profiles');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return INITIAL_SUBSCRIBER_PROFILES;
  }, []);

  const realSubRecords = useMemo<SubscriptionApiRecord[]>(() => {
    try {
      const saved = localStorage.getItem('djassa_admin_subscription_api_records_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return INITIAL_SUBSCRIPTION_API_RECORDS;
  }, []);

  const allOperations = useMemo<ProviderOperationItem[]>(() => {
    return generateProviderOperations(provider, extendedSettings, realPlans, realSubRecords);
  }, [provider, extendedSettings, realPlans, realSubRecords]);

  // Append config audit entry
  const appendAudit = (parameter: string, oldValue: string, newValue: string) => {
    const now = new Date();
    const ts = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} • ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const entry: ProviderConfigChange = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: ts,
      admin: 'SuperAdmin Djassa',
      parameter,
      oldValue,
      newValue
    };
    const next = [entry, ...auditHistory].slice(0, 30);
    setAuditHistory(next);
    try {
      localStorage.setItem(getProviderAuditKey(provider.id), JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  // Handlers
  const handleChangeExtendedSettings = (patch: Partial<ProviderExtendedSettings>) => {
    setExtendedSettings(prev => {
      const next = { ...prev, ...patch };
      saveProviderExtendedSettings(provider.id, next);
      return next;
    });
  };

  const handleUpdateAppLimit = (app: ProviderAppKey, patch: Partial<ProviderNativeAppLimits>) => {
    setAppLimits(prev => {
      const next = {
        ...prev,
        [app]: { ...prev[app], ...patch }
      };
      saveProviderAppLimits(provider.id, next);
      return next;
    });
  };

  const handleSaveAll = () => {
    saveProviderExtendedSettings(provider.id, extendedSettings);
    saveProviderAppLimits(provider.id, appLimits);
    appendAudit('Configuration & plafonds', 'État précédent', `${provider.name} enregistré (${extendedSettings.operatingMode})`);
    if (onUpdateProvider) {
      const now = new Date();
      const stamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} à ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      onUpdateProvider({
        ...provider,
        economyModeEnabled: extendedSettings.operatingMode === 'economy',
        lastSync: stamp,
        configHistory: auditHistory
      });
    }
    void securityService.recordActivity({
      category: 'api',
      action: `Modification configuration API ${provider.name}`,
      actionType: 'api_provider_config_saved',
      target: provider.name,
      targetType: 'api',
      entityType: 'api_provider',
      entityId: provider.id,
      space: 'admin',
      result: 'reussi',
      severity: 'moyen',
      beforeValue: `Mode ${provider.economyModeEnabled ? 'économie' : 'standard'}`,
      afterValue: `Mode ${extendedSettings.operatingMode} • Plafond ${extendedSettings.targetBalanceOrBudgetFCFA ?? provider.budgetLimitFCFA} FCFA`,
      details: `Paramètres & plafonds enregistrés pour ${provider.name}`
    });
    showToast(`Configuration ${provider.name} enregistrée`);
  };

  const handleResetAll = () => {
    const resetSettings = { ...profile.defaultSettings };
    const resetLimits = JSON.parse(JSON.stringify(profile.defaultAppLimits)) as Record<ProviderAppKey, ProviderNativeAppLimits>;
    setExtendedSettings(resetSettings);
    setAppLimits(resetLimits);
    saveProviderExtendedSettings(provider.id, resetSettings);
    saveProviderAppLimits(provider.id, resetLimits);
    appendAudit('Réinitialisation complète', 'Personnalisée', 'Valeurs par défaut');
    void securityService.recordActivity({
      category: 'api',
      action: `Réinitialisation configuration API ${provider.name}`,
      actionType: 'api_provider_config_reset',
      target: provider.name,
      targetType: 'api',
      entityType: 'api_provider',
      entityId: provider.id,
      space: 'admin',
      result: 'reussi',
      severity: 'moyen',
      beforeValue: 'Personnalisée',
      afterValue: 'Valeurs par défaut',
      details: `Configuration ${provider.name} réinitialisée aux paramètres d’usine`
    });
    showToast(`Configuration ${provider.name} réinitialisée aux valeurs par défaut`);
  };

  const handleToggleProviderConnected = (connected: boolean) => {
    if (onUpdateProvider) {
      onUpdateProvider({
        ...provider,
        isConnected: connected,
        lastError: connected ? 'Aucune' : 'Service suspendu manuellement par l’administrateur'
      });
    }
    appendAudit('Activation service API', provider.isConnected ? 'Activée' : 'Désactivée', connected ? 'Activée' : 'Désactivée');
    void securityService.recordActivity({
      category: 'api',
      action: connected ? `Activation API ${provider.name}` : `Suspension API ${provider.name}`,
      actionType: 'api_provider_toggle',
      target: provider.name,
      targetType: 'api',
      entityType: 'api_provider',
      entityId: provider.id,
      space: 'admin',
      result: 'reussi',
      severity: connected ? 'moyen' : 'eleve',
      beforeValue: provider.isConnected ? 'Activée' : 'Désactivée',
      afterValue: connected ? 'Activée' : 'Désactivée',
      details: `Passerelle ${provider.name} ${connected ? 'réactivée' : 'coupée manuellement'}`
    });
    showToast(connected ? `${provider.name} activée` : `${provider.name} désactivée`);
  };

  const handleTestConnection = () => {
    setIsTestingConnection(true);
    setTimeout(() => {
      setIsTestingConnection(false);
      const latency = Math.floor(Math.random() * 35) + 18;
      const now = new Date();
      const stamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} à ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (onUpdateProvider) {
        onUpdateProvider({ ...provider, isConnected: true, lastSync: stamp, lastError: 'Aucune' });
      }
      if (profile.supportsLiveApiBalance && provider.providerBalanceFCFA <= extendedSettings.minAlertFCFA) {
        void securityService.recordActivity({
          category: 'api',
          actionType: 'api_low_balance',
          action: `Solde API faible détecté (${provider.name})`,
          target: provider.name,
          targetType: 'api',
          entityType: 'api_provider',
          entityId: provider.id,
          space: 'admin',
          result: 'reussi',
          severity: 'eleve',
          afterValue: `${formatFCFA(provider.providerBalanceFCFA)} (seuil ${formatFCFA(extendedSettings.minAlertFCFA)})`,
          details: `Le solde prépayé ${provider.name} est inférieur ou égal au seuil minimal configuré`
        });
      }
      if (provider.consumptionPercent >= 100) {
        void securityService.recordActivity({
          category: 'api',
          actionType: 'api_cap_reached',
          action: `Plafond API atteint (${provider.name})`,
          target: provider.name,
          targetType: 'api',
          entityType: 'api_provider',
          entityId: provider.id,
          space: 'admin',
          result: 'bloque',
          severity: 'critique',
          afterValue: `${provider.consumptionPercent}% du budget consommé`,
          details: `Le plafond mensuel configuré pour ${provider.name} est atteint (${provider.consumptionPercent}%)`
        });
      }
      showToast(`Diagnostic ${provider.name} réussi : HTTP 200 OK (${latency} ms)`);
    }, 650);
  };

  const handleSyncData = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      const now = new Date();
      const stamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} à ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (onUpdateProvider) {
        onUpdateProvider({ ...provider, lastSync: stamp });
      }
      if (profile.supportsLiveApiBalance && provider.providerBalanceFCFA <= extendedSettings.minAlertFCFA) {
        void securityService.recordActivity({
          category: 'api',
          actionType: 'api_low_balance',
          action: `Alerte solde API faible après synchro (${provider.name})`,
          target: provider.name,
          targetType: 'api',
          entityType: 'api_provider',
          entityId: provider.id,
          space: 'admin',
          result: 'reussi',
          severity: 'eleve',
          afterValue: `${formatFCFA(provider.providerBalanceFCFA)}`,
          details: `Synchronisation effectuée : solde ${provider.name} sous le seuil d’alerte`
        });
      }
      showToast(
        profile.supportsLiveApiBalance
          ? `Solde et métriques ${provider.name} synchronisés via API`
          : `Métriques budgétaires DJASSA (${provider.name}) actualisées`
      );
    }, 550);
  };

  // Filtered operations
  const filteredOperations = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayMs = 86400000;

    return allOperations.filter(op => {
      const opTs = new Date(op.timestampIso).getTime();
      if (appliedFilters.period === 'today' && opTs < startOfToday) return false;
      if (appliedFilters.period === 'yesterday' && (opTs < startOfToday - dayMs || opTs >= startOfToday)) return false;
      if (appliedFilters.period === '7d' && opTs < now.getTime() - 7 * dayMs) return false;
      if (appliedFilters.period === '30d' && opTs < now.getTime() - 30 * dayMs) return false;
      if (appliedFilters.period === 'custom') {
        if (appliedFilters.customStart) {
          const cs = new Date(appliedFilters.customStart).getTime();
          if (opTs < cs) return false;
        }
        if (appliedFilters.customEnd) {
          const ce = new Date(appliedFilters.customEnd).getTime() + dayMs;
          if (opTs > ce) return false;
        }
      }

      if (appliedFilters.app !== 'all' && op.app !== appliedFilters.app) return false;
      if (appliedFilters.subscription !== 'all' && op.subscriptionName !== appliedFilters.subscription) return false;
      if (appliedFilters.status === 'success' && op.status !== 'success') return false;
      if (appliedFilters.status === 'failed' && op.status !== 'failed') return false;
      return true;
    });
  }, [allOperations, appliedFilters]);

  // Available subscription options for filter dropdown
  const availableSubscriptionOptions = useMemo(() => {
    const set = new Set<string>(allOperations.map(o => o.subscriptionName));
    return Array.from(set);
  }, [allOperations]);

  // KPIs
  const stats = useMemo(() => {
    const total = filteredOperations.length;
    const success = filteredOperations.filter(o => o.status === 'success').length;
    const failed = filteredOperations.filter(o => o.status === 'failed').length;
    const totalPrimary = filteredOperations.reduce((s, o) => s + o.primaryQty, 0);
    const totalSecondary = filteredOperations.reduce((s, o) => s + o.secondaryQty, 0);
    const totalCostFCFA = Math.round(filteredOperations.reduce((s, o) => s + o.realCostFCFA, 0) * 100) / 100;
    const totalRevenueFCFA = Math.round(filteredOperations.reduce((s, o) => s + o.revenueFCFA, 0) * 100) / 100;
    const totalProfitFCFA = Math.round((totalRevenueFCFA - totalCostFCFA) * 100) / 100;
    const avgCostPerOp = total > 0 ? Math.round((totalCostFCFA / total) * 100) / 100 : 0;
    const avgUnitCost = total > 0 ? Math.round((filteredOperations.reduce((s, o) => s + o.unitCostFCFA, 0) / total) * 100) / 100 : 0;
    const avgFee = total > 0 ? Math.round((filteredOperations.reduce((s, o) => s + o.feeCostFCFA, 0) / total) * 100) / 100 : 0;
    const profitMargin = totalRevenueFCFA > 0 ? Math.round((totalProfitFCFA / totalRevenueFCFA) * 100) : 0;

    const latencies = filteredOperations.map(o => o.latencyMs);
    const avgLatencySec = latencies.length > 0 ? ((latencies.reduce((a, b) => a + b, 0) / latencies.length) / 1000).toFixed(2) : '0.00';
    const minLatencySec = latencies.length > 0 ? (Math.min(...latencies) / 1000).toFixed(2) : '0.00';
    const maxLatencySec = latencies.length > 0 ? (Math.max(...latencies) / 1000).toFixed(2) : '0.00';

    return {
      total,
      success,
      failed,
      successRate: total > 0 ? Math.round((success / total) * 100) : 100,
      failedRate: total > 0 ? Math.round((failed / total) * 100) : 0,
      totalPrimary,
      totalSecondary,
      totalCostFCFA,
      totalRevenueFCFA,
      totalProfitFCFA,
      avgCostPerOp,
      avgUnitCost,
      avgFee,
      profitMargin,
      avgLatencySec,
      minLatencySec,
      maxLatencySec
    };
  }, [filteredOperations]);

  // Chart Buckets
  const chartBuckets = useMemo(() => {
    const map = new Map<string, { key: string; label: string; costFCFA: number; count: number; ops: ProviderOperationItem[] }>();
    filteredOperations.forEach(op => {
      let key = op.dateLabel;
      let label = op.dateLabel.slice(0, 5);
      if (granularity === 'hour') {
        key = `${op.dateLabel} ${op.timeLabel.slice(0, 2)}h`;
        label = `${op.timeLabel.slice(0, 2)}h`;
      } else if (granularity === 'week') {
        key = `Sem. ${op.dateLabel.slice(0, 5)}`;
        label = key;
      } else if (granularity === 'month') {
        key = op.dateLabel.slice(3);
        label = op.dateLabel.slice(3);
      }
      const prev = map.get(key) || { key, label, costFCFA: 0, count: 0, ops: [] };
      prev.costFCFA = Math.round((prev.costFCFA + op.realCostFCFA) * 100) / 100;
      prev.count += 1;
      prev.ops.push(op);
      map.set(key, prev);
    });
    return Array.from(map.values()).slice(0, 7);
  }, [filteredOperations, granularity]);

  // Users Aggregation
  const usersAggregation = useMemo(() => {
    const map = new Map<string, {
      userId: string;
      userName: string;
      avatar: string;
      app: ProviderOperationItem['app'];
      subscription: string;
      opsCount: number;
      primaryQty: number;
      secondaryQty: number;
      costFCFA: number;
      errors: number;
      history: ProviderOperationItem[];
    }>();

    filteredOperations.forEach(op => {
      const prev = map.get(op.userId) || {
        userId: op.userId,
        userName: op.userName,
        avatar: op.userAvatar,
        app: op.app,
        subscription: op.subscriptionName,
        opsCount: 0,
        primaryQty: 0,
        secondaryQty: 0,
        costFCFA: 0,
        errors: 0,
        history: []
      };
      prev.opsCount += 1;
      prev.primaryQty += op.primaryQty;
      prev.secondaryQty += op.secondaryQty;
      prev.costFCFA = Math.round((prev.costFCFA + op.realCostFCFA) * 100) / 100;
      if (op.status === 'failed') prev.errors += 1;
      prev.history.push(op);
      map.set(op.userId, prev);
    });

    const term = userSearch.trim().toLowerCase();
    return Array.from(map.values())
      .filter(u => !term || u.userName.toLowerCase().includes(term) || u.userId.toLowerCase().includes(term))
      .sort((a, b) => {
        if (userSortBy === 'cost') return b.costFCFA - a.costFCFA;
        if (userSortBy === 'ops') return b.opsCount - a.opsCount;
        return b.primaryQty - a.primaryQty;
      });
  }, [filteredOperations, userSearch, userSortBy]);

  // Subscriptions Aggregation grouped by the 3 DJASSA Apps
  const subscriptionGroups = useMemo(() => {
    const definitions: Array<{ app: ProviderOperationItem['app']; title: string; plans: string[] }> = [
      { app: 'Client', title: 'Application Client', plans: ['Plan gratuit', 'DJASSA Mini', 'DJASSA Plus', 'DJASSA Premium'] },
      { app: 'Vendeur', title: 'Application Vendeur', plans: ['Vendeur Starter', 'Vendeur Pro Marché', 'Vendeur Élite Studio'] },
      { app: 'Administrateur', title: 'Application Administrateur', plans: ['Super Administrateur', 'Admin Finance & Support'] }
    ];

    const globalTotalCost = Math.max(1, stats.totalCostFCFA);

    return definitions.map(def => ({
      ...def,
      cards: def.plans.map(planName => {
        const ops = filteredOperations.filter(o => o.app === def.app && o.subscriptionName === planName);
        const costFCFA = Math.round(ops.reduce((s, o) => s + o.realCostFCFA, 0) * 100) / 100;
        const primaryQty = ops.reduce((s, o) => s + o.primaryQty, 0);
        const secondaryQty = ops.reduce((s, o) => s + o.secondaryQty, 0);
        const subUsers = realSubscribers.filter(s => s.planName === planName && s.status === 'active').length;
        const activeUsersCount = Math.max(subUsers, new Set(ops.map(o => o.userId)).size);
        const globalPercent = Math.round((costFCFA / globalTotalCost) * 100);
        const avgCostPerUser = activeUsersCount > 0 ? Math.round((costFCFA / activeUsersCount) * 100) / 100 : 0;
        return {
          planName,
          activeUsersCount,
          opsCount: ops.length,
          primaryQty,
          secondaryQty,
          costFCFA,
          avgCostPerUser,
          globalPercent
        };
      })
    }));
  }, [filteredOperations, realSubscribers, stats.totalCostFCFA]);

  const donutOverview = useMemo(() => {
    const palette = ['#a855f7', '#3b82f6', '#22d3ee', '#eab308', '#10b981'];
    const map = new Map<string, number>();
    filteredOperations.forEach(op => {
      map.set(op.subscriptionName, (map.get(op.subscriptionName) || 0) + Math.max(1, op.realCostFCFA));
    });
    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = Math.max(1, entries.reduce((s, e) => s + e[1], 0));
    return entries.map(([label, value], i) => ({
      label,
      value,
      percent: Math.round((value / sum) * 100),
      color: palette[i % palette.length]
    }));
  }, [filteredOperations]);

  // Paginated Requests
  const pageSize = 5;
  const searchedOperations = useMemo(() => {
    const q = requestSearchId.trim().toLowerCase();
    if (!q) return filteredOperations;
    return filteredOperations.filter(
      o => o.id.toLowerCase().includes(q) || o.userName.toLowerCase().includes(q) || o.opType.toLowerCase().includes(q)
    );
  }, [filteredOperations, requestSearchId]);

  const totalPages = Math.max(1, Math.ceil(searchedOperations.length / pageSize));
  const paginatedOperations = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return searchedOperations.slice(start, start + pageSize);
  }, [searchedOperations, currentPage]);

  // Error logs filter
  const filteredErrorLogs = useMemo(() => {
    const errs = allOperations.filter(o => o.status === 'failed' || o.httpCode >= 400);
    if (errorHttpFilter === 'all') return errs;
    if (errorHttpFilter === 'other') return errs.filter(e => ![400, 401, 429, 500].includes(e.httpCode));
    return errs.filter(e => String(e.httpCode) === errorHttpFilter);
  }, [allOperations, errorHttpFilter]);

  // Exports
  const handleExportCsv = () => {
    const headers = `ID,Date,Heure,Application,Abonnement,Utilisateur,Operation,Quantite (${profile.nativeUnitPlural}),Latence (ms),HTTP,Statut,Cout Reel (FCFA)\n`;
    const rows = filteredOperations
      .map(o => `"${o.id}","${o.dateLabel}","${o.timeLabel}","${o.app}","${o.subscriptionName}","${o.userName}","${o.opType}",${o.primaryQty},${o.latencyMs},${o.httpCode},${o.status},${o.realCostFCFA}`)
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conso_${provider.id}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Export CSV ${provider.name} téléchargé`);
  };

  const handleExportPdf = () => {
    const lines = [
      `Fournisseur : ${profile.supplierName} | API : ${provider.name}`,
      `Service : ${profile.serviceType}`,
      `Etat connexion : ${provider.isConnected ? 'Connectee' : 'Deconnectee'} | Sync : ${provider.lastSync}`,
      `Operations filtrees : ${stats.total} (Reussies: ${stats.success} / Echecs: ${stats.failed})`,
      `Volume principal : ${stats.totalPrimary.toLocaleString()} ${profile.nativeUnitPlural}`,
      `Cout total periode : ${stats.totalCostFCFA} FCFA | Moy/op : ${stats.avgCostPerOp} FCFA`,
      `Budget mensuel interne : ${provider.costFCFA} / ${provider.budgetLimitFCFA} FCFA (${provider.consumptionPercent}%)`,
      '------------------------------------------------------------',
      ...filteredOperations.slice(0, 18).map(
        o => `${o.id} | ${o.dateLabel} | ${o.app} | ${o.primaryQty} ${o.primaryUnit} | ${o.realCostFCFA} F | HTTP ${o.httpCode}`
      )
    ];
    downloadProviderPdfReport(`Rapport Conso API - ${provider.name} (DJASSA)`, lines, `rapport_${provider.id}.pdf`);
    showToast(`Export PDF ${provider.name} généré`);
  };

  const selectedUserDetail = useMemo(
    () => (selectedUserId ? usersAggregation.find(u => u.userId === selectedUserId) || null : null),
    [selectedUserId, usersAggregation]
  );

  // ===========================================================================
  // SECONDARY PAGE 1: USER DETAIL VIEW
  // ===========================================================================

  if (selectedUserDetail && !selectedOperation) {
    return (
      <div className="bg-[#060709] text-white min-h-full pb-8 animate-in fade-in duration-200">
        <div className="max-w-xl mx-auto space-y-3.5">
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setSelectedUserId(null)}
              className="w-10 h-10 rounded-full bg-[#15171e] border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-black text-white truncate">Consommation utilisateur ({provider.name})</h1>
              <p className="text-[11px] text-white/55 font-mono truncate">
                {selectedUserDetail.userId} • {selectedUserDetail.app}
              </p>
            </div>
          </div>

          <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-3">
            <div className="flex items-center gap-3">
              <img src={selectedUserDetail.avatar} alt={selectedUserDetail.userName} className="w-12 h-12 rounded-full object-cover border border-white/15 shrink-0" />
              <div className="min-w-0">
                <h2 className="text-sm font-black text-white truncate">{selectedUserDetail.userName}</h2>
                <span className="inline-block mt-0.5 px-2.5 py-0.5 rounded-lg bg-purple-500/15 text-purple-300 text-[10px] font-bold">
                  {selectedUserDetail.subscription}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.06] text-center">
              <div className="p-2 rounded-xl bg-[#0b0c10]">
                <span className="text-[10px] text-white/50 block">Opérations</span>
                <span className="text-sm font-black text-blue-400 font-mono">{selectedUserDetail.opsCount}</span>
              </div>
              <div className="p-2 rounded-xl bg-[#0b0c10]">
                <span className="text-[10px] text-white/50 block">{profile.primaryMetricLabel}</span>
                <span className="text-sm font-black text-cyan-300 font-mono">{selectedUserDetail.primaryQty.toLocaleString()}</span>
              </div>
              <div className="p-2 rounded-xl bg-[#0b0c10]">
                <span className="text-[10px] text-white/50 block">Coût réel</span>
                <span className="text-sm font-black text-yellow-400 font-mono">{selectedUserDetail.costFCFA} F</span>
              </div>
            </div>
          </div>

          <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
            <h3 className="text-xs font-black text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>Historique complet ({selectedUserDetail.history.length})</span>
            </h3>
            <div className="space-y-2">
              {selectedUserDetail.history.map(op => (
                <div
                  key={op.id}
                  onClick={() => setSelectedOperation(op)}
                  className="p-3 rounded-xl bg-[#0b0c10] border border-white/[0.07] hover:border-cyan-500/40 transition cursor-pointer flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-white font-mono">{op.id}</span>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                        op.status === 'success' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                      }`}>
                        HTTP {op.httpCode}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/55 font-mono mt-0.5 truncate">
                      {op.dateLabel} • {op.timeLabel} • {op.primaryQty.toLocaleString()} {op.primaryUnit} • {op.latencyMs} ms
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-yellow-400 font-mono block">{op.realCostFCFA} F</span>
                    <ChevronRight className="w-4 h-4 text-white/40 ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // SECONDARY PAGE 2: OPERATION DETAIL PAGE (SECTIONS A, B, C, D SANITIZED)
  // ===========================================================================

  if (selectedOperation) {
    return (
      <div className="bg-[#060709] text-white min-h-full pb-8 animate-in fade-in duration-200">
        <div className="max-w-xl mx-auto space-y-3.5">
          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => setSelectedOperation(null)}
              className="w-10 h-10 rounded-full bg-[#15171e] border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-black text-white truncate">Détail d’une opération ({provider.name})</h1>
              <p className="text-[11px] text-white/55 font-mono truncate">{selectedOperation.id}</p>
            </div>
            <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
              selectedOperation.status === 'success'
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
            }`}>
              {selectedOperation.status === 'success' ? 'Réussie' : 'Échouée'}
            </span>
          </div>

          {/* A. Informations générales */}
          <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-black text-white">
              <Info className="w-4 h-4 text-emerald-400" />
              <span>A. Informations générales</span>
            </div>
            <div className="divide-y divide-white/[0.06] text-xs">
              <div className="py-2 flex justify-between gap-2">
                <span className="text-blue-400/90">Identifiant</span>
                <span className="font-mono font-bold text-white">{selectedOperation.id}</span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-blue-400/90">Date et heure</span>
                <span className="font-mono text-white">{selectedOperation.dateLabel} • {selectedOperation.timeLabel}</span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-blue-400/90">Application</span>
                <span className="font-semibold text-white">{selectedOperation.app}</span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-blue-400/90">Utilisateur / Service</span>
                <span className="font-semibold text-white text-right truncate max-w-[200px]">{selectedOperation.userName}</span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-blue-400/90">Abonnement</span>
                <span className="font-bold text-purple-300">{selectedOperation.subscriptionName}</span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-blue-400/90">Type d'opération</span>
                <span className="font-semibold text-emerald-400 text-right">{selectedOperation.opType}</span>
              </div>
            </div>
          </div>

          {/* B. Informations techniques */}
          <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-black text-white">
              <Server className="w-4 h-4 text-blue-400" />
              <span>B. Informations techniques</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-[#0b0c10] border border-white/[0.06]">
                <span className="text-[10px] text-white/50 block">{selectedOperation.primaryUnit}</span>
                <span className="text-xs font-black text-blue-400 font-mono">{selectedOperation.primaryQty.toLocaleString()}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0b0c10] border border-white/[0.06]">
                <span className="text-[10px] text-white/50 block">{selectedOperation.secondaryUnit}</span>
                <span className="text-xs font-black text-purple-400 font-mono">{selectedOperation.secondaryQty.toLocaleString()}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0b0c10] border border-white/[0.06]">
                <span className="text-[10px] text-white/50 block">Temps d'exécution</span>
                <span className="text-xs font-black text-white font-mono">{selectedOperation.latencyMs} ms</span>
              </div>
            </div>
            <div className="divide-y divide-white/[0.06] text-xs">
              <div className="py-2 flex justify-between gap-2">
                <span className="text-white/60">Service cible / Endpoint</span>
                <span className="font-mono text-cyan-300 truncate max-w-[210px]">{selectedOperation.endpoint}</span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-white/60">Code HTTP</span>
                <span className={`font-mono font-black ${selectedOperation.status === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  HTTP {selectedOperation.httpCode}
                </span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-white/60">Trace ID fournisseur</span>
                <span className="font-mono text-white/85">{selectedOperation.providerTraceId}</span>
              </div>
            </div>
          </div>

          {/* C. Informations financières */}
          <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black text-white">
                <Coins className="w-4 h-4 text-yellow-400" />
                <span>C. Informations financières</span>
              </div>
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                selectedOperation.billedByProvider
                  ? 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30'
                  : 'bg-white/10 text-white/70'
              }`}>
                {selectedOperation.billedByProvider ? `Facturée par ${profile.supplierName}` : 'Non facturée'}
              </span>
            </div>
            <div className="divide-y divide-white/[0.06] text-xs">
              <div className="py-2 flex justify-between">
                <span className="text-white/60">Coût brut service</span>
                <span className="font-mono text-yellow-300 font-bold">{selectedOperation.unitCostFCFA} FCFA</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-white/60">Frais annexes / routage</span>
                <span className="font-mono text-amber-400 font-bold">{selectedOperation.feeCostFCFA} FCFA</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-white/80 font-bold">Coût total réel supporté par DJASSA</span>
                <span className="font-mono text-yellow-400 font-black">{selectedOperation.realCostFCFA} FCFA</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-white/80 font-bold">Bénéfice / Marge estimée</span>
                <span className={`font-mono font-black ${selectedOperation.estimatedProfitFCFA >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {selectedOperation.estimatedProfitFCFA >= 0 ? '+' : ''}{selectedOperation.estimatedProfitFCFA} FCFA
                </span>
              </div>
            </div>
          </div>

          {/* D. Réponse API (Strictement expurgée) */}
          <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black text-white">
                <Code2 className="w-4 h-4 text-blue-400" />
                <span>D. Réponse technique</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                <Lock className="w-3 h-3" /> Clés et PII masquées
              </span>
            </div>
            {selectedOperation.errorReason && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                <span className="font-bold block mb-0.5">Diagnostic erreur :</span>
                {selectedOperation.errorReason}
              </div>
            )}
            <div className="p-3 rounded-xl bg-[#08090c] border border-white/[0.06] font-mono text-[11px] text-blue-300 break-all">
              {selectedOperation.sanitizedPreview}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // SECONDARY PAGE 3: SUBSCRIPTION FORMULA DETAIL
  // ===========================================================================

  if (selectedPlanDetail) {
    const planSubscribers = realSubscribers.filter(s => s.planName === selectedPlanDetail.name);
    const planOps = filteredOperations.filter(
      o => o.app === selectedPlanDetail.app && o.subscriptionName === selectedPlanDetail.name
    );

    const byUser = new Map<string, { id: string; name: string; avatar: string; opsCount: number; qty: number; cost: number }>();
    planOps.forEach(o => {
      const prev = byUser.get(o.userId) || { id: o.userId, name: o.userName, avatar: o.userAvatar, opsCount: 0, qty: 0, cost: 0 };
      prev.opsCount += 1;
      prev.qty += o.primaryQty;
      prev.cost = Math.round((prev.cost + o.realCostFCFA) * 100) / 100;
      byUser.set(o.userId, prev);
    });
    planSubscribers.forEach(s => {
      if (!byUser.has(s.id)) {
        byUser.set(s.id, { id: s.id, name: s.name, avatar: s.avatar, opsCount: 0, qty: 0, cost: 0 });
      }
    });
    const formulaUsers = Array.from(byUser.values());

    return (
      <div className="bg-[#060709] text-white min-h-full pb-8 animate-in fade-in duration-200">
        <div className="max-w-xl mx-auto space-y-3.5">
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setSelectedPlanDetail(null)}
              className="w-10 h-10 rounded-full bg-[#15171e] border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-black text-white truncate">{selectedPlanDetail.name}</h1>
              <p className="text-[11px] text-white/55 truncate">{selectedPlanDetail.app} • {provider.name}</p>
            </div>
          </div>

          <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
            <h3 className="text-xs font-black text-white flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-400" />
              <span>Utilisateurs sur cette formule ({formulaUsers.length})</span>
            </h3>

            {formulaUsers.length === 0 ? (
              <div className="py-6 text-center text-xs text-white/45">
                Aucune consommation enregistrée pour cette formule sur la période sélectionnée.
              </div>
            ) : (
              <div className="space-y-2">
                {formulaUsers.map(u => (
                  <div key={u.id} className="p-3 rounded-xl bg-[#0b0c10] border border-white/[0.06] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white block truncate">{u.name}</span>
                        <span className="text-[10px] text-white/50 font-mono block truncate">
                          {u.opsCount} op. • {u.qty.toLocaleString()} {profile.nativeUnitPlural}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-black text-yellow-400 font-mono shrink-0">{u.cost} FCFA</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // SECONDARY PAGE 4: TECHNICAL & ERROR LOGS + ADMIN AUDIT HISTORY
  // ===========================================================================

  if (showTechnicalLogs) {
    return (
      <div className="bg-[#060709] text-white min-h-full pb-8 animate-in fade-in duration-200">
        <div className="max-w-xl mx-auto space-y-3.5">
          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowTechnicalLogs(false)}
              className="w-10 h-10 rounded-full bg-[#15171e] border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-black text-white truncate">Journaux techniques ({provider.name})</h1>
              <p className="text-[11px] text-white/55 truncate">Erreurs HTTP, alertes & historique modifications admin</p>
            </div>
            <span className="px-2 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center gap-1 shrink-0">
              <Lock className="w-3 h-3" /> Masqué
            </span>
          </div>

          {/* HTTP Error Filters */}
          <div className="bg-[#12141a] rounded-2xl p-3 border border-white/[0.08] flex flex-wrap gap-1.5">
            {[
              { id: 'all' as const, label: 'Toutes erreurs' },
              { id: '400' as const, label: 'HTTP 400' },
              { id: '401' as const, label: 'HTTP 401' },
              { id: '429' as const, label: 'HTTP 429' },
              { id: '500' as const, label: 'HTTP 500' },
              { id: 'other' as const, label: 'Autres' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setErrorHttpFilter(f.id)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                  errorHttpFilter === f.id
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                    : 'bg-[#0b0c10] text-white/60 border border-white/[0.07] hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Errors List */}
          <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
            <h3 className="text-xs font-black text-white">Incidents & codes HTTP enregistrés</h3>
            {filteredErrorLogs.length === 0 ? (
              <div className="py-6 text-center text-xs text-white/50">
                Aucune erreur enregistrée pour ce filtre HTTP.
              </div>
            ) : (
              filteredErrorLogs.map(err => (
                <div
                  key={err.id}
                  onClick={() => setSelectedOperation(err)}
                  className="p-3 rounded-xl bg-[#0b0c10] border border-rose-500/25 hover:border-rose-500/50 space-y-1.5 cursor-pointer transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-white font-mono">{err.id}</span>
                    <span className="px-2 py-0.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 font-mono text-[10px] font-black">
                      HTTP {err.httpCode}
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-300 font-medium">
                    {err.errorReason || 'Échec lors de l’appel service'}
                  </p>
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-white/55 font-mono pt-1">
                    <span className="truncate">Endpoint : {err.endpoint}</span>
                    <span className="text-right">Latence : {err.latencyMs} ms</span>
                    <span>{err.dateLabel} • {err.timeLabel}</span>
                    <span className="text-right text-yellow-400 font-bold">
                      Coût : {err.realCostFCFA} F
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Admin Configuration Audit Log */}
          <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
            <h3 className="text-xs font-black text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-purple-400" />
              <span>Historique des modifications de configuration ({auditHistory.length})</span>
            </h3>
            <div className="divide-y divide-white/[0.06]">
              {auditHistory.map(item => (
                <div key={item.id} className="py-2 text-[11px] space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white">{item.parameter}</span>
                    <span className="font-mono text-[10px] text-white/50">{item.date}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-white/65">
                    <span>{item.admin}</span>
                    <span className="font-mono text-cyan-300">{item.oldValue} → {item.newValue}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // MAIN 5-PAGE HARMONIZED CONSOLE
  // ===========================================================================

  const maxChartCost = Math.max(1, ...chartBuckets.map(b => b.costFCFA));
  const selectedBucket = chartBuckets.find(b => b.key === selectedDateKey) || null;
  const connectionStatus = !provider.isConnected
    ? 'Déconnectée'
    : provider.lastError && provider.lastError !== 'Aucune'
    ? 'Erreur'
    : 'Connectée';

  const topHeaderCopy: Record<ProviderTopTab, { title: string; subtitle: string }> = {
    config: { title: 'Configuration des Conso API', subtitle: `Paramétrage technique ${provider.name}` },
    pricing_balance: { title: 'Tarif et Gestion de Solde', subtitle: `Facturation & budget ${provider.name}` },
    apps: { title: 'Configuration des Applications', subtitle: `Quotas DJASSA par application (${provider.name})` },
    monitoring: { title: 'Surveillance et Contrôle API', subtitle: `Performances, alertes et diagnostic ${provider.name}` },
    consumption: { title: 'Consommation et Actions Admin', subtitle: `Analyse détaillée & journaux ${provider.name}` }
  };

  const topTabsList: Array<{
    id: ProviderTopTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
    activeClass: string;
  }> = [
    {
      id: 'config',
      label: 'Configuration des conso API',
      icon: Settings,
      iconColor: 'text-emerald-400',
      activeClass: 'border-emerald-500 bg-emerald-500/15 text-white shadow-[0_0_12px_rgba(16,185,129,0.2)]'
    },
    {
      id: 'pricing_balance',
      label: 'Tarif et solde API',
      icon: Wallet,
      iconColor: 'text-yellow-400',
      activeClass: 'border-yellow-500 bg-yellow-500/15 text-white shadow-[0_0_12px_rgba(234,179,8,0.2)]'
    },
    {
      id: 'apps',
      label: 'Configuration des applications',
      icon: Shield,
      iconColor: 'text-blue-400',
      activeClass: 'border-blue-500 bg-blue-500/15 text-white shadow-[0_0_12px_rgba(59,130,246,0.2)]'
    },
    {
      id: 'monitoring',
      label: 'Surveillance et contrôle API',
      icon: Activity,
      iconColor: 'text-cyan-400',
      activeClass: 'border-cyan-500 bg-cyan-500/15 text-white shadow-[0_0_12px_rgba(34,211,238,0.2)]'
    },
    {
      id: 'consumption',
      label: 'Consommation et actions admin',
      icon: TrendingUp,
      iconColor: 'text-purple-400',
      activeClass: 'border-purple-500 bg-purple-500/15 text-white shadow-[0_0_12px_rgba(168,85,247,0.25)]'
    }
  ];

  return (
    <div className="bg-[#060709] text-white min-h-full pb-8 font-sans animate-in fade-in duration-200">
      <div className="max-w-xl mx-auto space-y-3">

        {/* 1. HEADER */}
        <div className="flex items-center justify-between gap-2.5 pt-1 relative">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-[#15171e] border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition active:scale-95 cursor-pointer shrink-0"
            title="Retour aux fournisseurs"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
              {topHeaderCopy[topTab].title}
            </h1>
            <p className="text-[11px] text-white/55 font-medium truncate">
              {topHeaderCopy[topTab].subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowHeaderMenu(v => !v)}
            className="w-10 h-10 rounded-full bg-[#15171e] border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition cursor-pointer shrink-0"
            title="Options"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showHeaderMenu && (
            <div className="absolute right-0 top-12 z-40 w-60 bg-[#14161d] border border-white/15 rounded-2xl p-1.5 shadow-2xl space-y-0.5 text-xs">
              <button
                type="button"
                onClick={() => { setShowHeaderMenu(false); handleTestConnection(); }}
                className="w-full px-3 py-2 rounded-xl hover:bg-white/5 text-left flex items-center gap-2.5 text-white/90 cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400" /> Tester la connexion
              </button>
              <button
                type="button"
                onClick={() => { setShowHeaderMenu(false); handleSyncData(); }}
                className="w-full px-3 py-2 rounded-xl hover:bg-white/5 text-left flex items-center gap-2.5 text-white/90 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-yellow-400" /> Synchroniser les données
              </button>
              <button
                type="button"
                onClick={() => { setShowHeaderMenu(false); handleExportCsv(); }}
                className="w-full px-3 py-2 rounded-xl hover:bg-white/5 text-left flex items-center gap-2.5 text-white/90 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" /> Exporter en CSV
              </button>
              <button
                type="button"
                onClick={() => { setShowHeaderMenu(false); handleExportPdf(); }}
                className="w-full px-3 py-2 rounded-xl hover:bg-white/5 text-left flex items-center gap-2.5 text-white/90 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-purple-400" /> Exporter en PDF
              </button>
              <button
                type="button"
                onClick={() => { setShowHeaderMenu(false); setShowTechnicalLogs(true); }}
                className="w-full px-3 py-2 rounded-xl hover:bg-white/5 text-left flex items-center gap-2.5 text-white/90 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-rose-400" /> Consulter les journaux
              </button>
              <button
                type="button"
                onClick={() => { setShowHeaderMenu(false); handleToggleProviderConnected(!provider.isConnected); }}
                className="w-full px-3 py-2 rounded-xl hover:bg-white/5 text-left flex items-center gap-2.5 text-amber-300 cursor-pointer"
              >
                <Power className="w-3.5 h-3.5" /> {provider.isConnected ? 'Désactiver l’API' : 'Activer l’API'}
              </button>
              <button
                type="button"
                onClick={() => { setShowHeaderMenu(false); handleResetAll(); }}
                className="w-full px-3 py-2 rounded-xl hover:bg-white/5 text-left flex items-center gap-2.5 text-rose-300 cursor-pointer border-t border-white/10 mt-1 pt-2"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser la configuration
              </button>
            </div>
          )}
        </div>

        {/* 2. 5 ONGLETS HORIZONTAUX */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {topTabsList.map(t => {
            const Icon = t.icon;
            const active = topTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTopTab(t.id)}
                className={`px-2.5 py-2 rounded-xl border text-[10px] sm:text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                  active
                    ? t.activeClass
                    : 'bg-[#12141a] border-white/[0.08] text-white/65 hover:text-white'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${t.iconColor}`} />
                <span className="whitespace-nowrap">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* 3. HERO PROVIDER CARD */}
        <div className="bg-[#12141a] rounded-2xl p-3.5 border border-white/[0.08] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-[#0b0c10] border border-white/10 flex items-center justify-center shrink-0">
              <ProviderIcon type={provider.iconType} className="w-8 h-8" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-black text-white leading-tight truncate">{provider.name}</h2>
              <p className="text-xs text-white/80 font-semibold truncate">Fournisseur : {profile.supplierName}</p>
              <p className="text-[11px] text-white/45 truncate">{profile.serviceType}</p>
            </div>
          </div>

          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border shrink-0 whitespace-nowrap ${
            connectionStatus === 'Connectée'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/35'
              : connectionStatus === 'Erreur'
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/35'
              : 'bg-white/10 text-white/60 border-white/15'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              connectionStatus === 'Connectée'
                ? 'bg-emerald-400 animate-pulse'
                : connectionStatus === 'Erreur'
                ? 'bg-rose-400'
                : 'bg-white/40'
            }`} />
            {connectionStatus}
          </span>
        </div>

        {/* PAGES 1-4 */}
        {topTab === 'config' && (
          <Tab1ProviderConfig
            provider={provider}
            profile={profile}
            settings={extendedSettings}
            onChangeSettings={handleChangeExtendedSettings}
            onToggleConnected={handleToggleProviderConnected}
            onTestConnection={handleTestConnection}
            isTestingConnection={isTestingConnection}
            onSync={handleSyncData}
            onSaveAll={handleSaveAll}
            onResetAll={handleResetAll}
            onOpenLogs={() => setShowTechnicalLogs(true)}
            onSwitchToConsumption={() => setTopTab('consumption')}
            showToast={showToast}
          />
        )}

        {topTab === 'pricing_balance' && (
          <Tab2ProviderPricingBalance
            provider={provider}
            profile={profile}
            settings={extendedSettings}
            onChangeSettings={handleChangeExtendedSettings}
            onToggleConnected={handleToggleProviderConnected}
            onTestConnection={handleTestConnection}
            isTestingConnection={isTestingConnection}
            onSync={handleSyncData}
            onSaveAll={handleSaveAll}
            onResetAll={handleResetAll}
            onOpenLogs={() => setShowTechnicalLogs(true)}
            onSwitchToConsumption={() => setTopTab('consumption')}
            showToast={showToast}
          />
        )}

        {topTab === 'apps' && (
          <Tab3ProviderConfigApps
            provider={provider}
            profile={profile}
            settings={extendedSettings}
            onChangeSettings={handleChangeExtendedSettings}
            onToggleConnected={handleToggleProviderConnected}
            onTestConnection={handleTestConnection}
            isTestingConnection={isTestingConnection}
            onSync={handleSyncData}
            onSaveAll={handleSaveAll}
            onResetAll={handleResetAll}
            onOpenLogs={() => setShowTechnicalLogs(true)}
            onSwitchToConsumption={() => setTopTab('consumption')}
            showToast={showToast}
            realPlans={realPlans}
            subscribers={realSubscribers}
            operations={allOperations}
            appLimits={appLimits}
            onUpdateAppLimit={handleUpdateAppLimit}
          />
        )}

        {topTab === 'monitoring' && (
          <Tab4ProviderMonitoring
            provider={provider}
            profile={profile}
            settings={extendedSettings}
            stats={{
              total: stats.total,
              success: stats.success,
              failed: stats.failed,
              successRate: stats.successRate,
              failedRate: stats.failedRate,
              avgLatencySec: stats.avgLatencySec,
              minLatencySec: stats.minLatencySec,
              maxLatencySec: stats.maxLatencySec
            }}
            onChangeSettings={handleChangeExtendedSettings}
            onToggleConnected={handleToggleProviderConnected}
            onTestConnection={handleTestConnection}
            isTestingConnection={isTestingConnection}
            onSync={handleSyncData}
            onSaveAll={handleSaveAll}
            onResetAll={handleResetAll}
            onOpenLogs={() => setShowTechnicalLogs(true)}
            onSwitchToConsumption={() => setTopTab('consumption')}
            showToast={showToast}
          />
        )}

        {/* PAGE 5: CONSOMMATION ET ACTIONS ADMINISTRATEUR */}
        {topTab === 'consumption' && (
          <>
            {/* 4 Sub-tabs */}
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'date' as const, label: 'Par date', icon: Calendar, activeClass: 'border-purple-500 bg-purple-500/15 text-white', iconColor: 'text-purple-400' },
                { id: 'users' as const, label: 'Par utilisateur', icon: Users, activeClass: 'border-blue-500 bg-blue-500/15 text-white', iconColor: 'text-blue-400' },
                { id: 'subscriptions' as const, label: 'Par abonnement', icon: Crown, activeClass: 'border-yellow-500 bg-yellow-500/15 text-white', iconColor: 'text-yellow-400' },
                { id: 'requests' as const, label: 'Détails des opérations', icon: ListFilter, activeClass: 'border-cyan-500 bg-cyan-500/15 text-white', iconColor: 'text-cyan-400' }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveSubTab(tab.id)}
                    className={`py-2 px-1.5 rounded-xl border text-[10px] sm:text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                      isActive ? tab.activeClass : 'bg-[#12141a] border-white/[0.08] text-white/65 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${tab.iconColor}`} />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* General Filters */}
            <div className="bg-[#12141a] rounded-2xl p-3.5 border border-white/[0.08] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowFiltersPanel(v => !v)}
                  className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer min-w-0"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span>Filtres généraux</span>
                  <span className="text-[10px] text-white/45 font-normal truncate">
                    ({appliedFilters.app === 'all' ? 'Toutes apps' : appliedFilters.app} • {appliedFilters.status === 'all' ? 'Tous statuts' : appliedFilters.status === 'success' ? 'Réussies' : 'Échouées'})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowFiltersPanel(v => !v)}
                  className="px-2.5 py-1 rounded-lg bg-[#191c24] border border-white/10 text-[11px] font-semibold text-white/80 flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <span>{showFiltersPanel ? 'Masquer' : 'Afficher'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFiltersPanel ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {showFiltersPanel && (
                <div className="pt-2 border-t border-white/[0.07] space-y-2.5 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-white/55 font-semibold block mb-1">Période</label>
                      <select
                        value={draftFilters.period}
                        onChange={(e) => setDraftFilters(f => ({ ...f, period: e.target.value as PeriodScope }))}
                        className="w-full px-2.5 py-2 rounded-xl bg-[#181b22] border border-white/10 text-white text-xs"
                      >
                        <option value="today">Aujourd’hui</option>
                        <option value="yesterday">Hier</option>
                        <option value="7d">7 derniers jours</option>
                        <option value="30d">30 derniers jours</option>
                        <option value="this_month">Ce mois</option>
                        <option value="prev_month">Mois précédent</option>
                        <option value="custom">Période personnalisée</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-white/55 font-semibold block mb-1">Application</label>
                      <select
                        value={draftFilters.app}
                        onChange={(e) => setDraftFilters(f => ({ ...f, app: e.target.value as AppScope, subscription: 'all' }))}
                        className="w-full px-2.5 py-2 rounded-xl bg-[#181b22] border border-white/10 text-white text-xs"
                      >
                        <option value="all">Toutes les applications</option>
                        <option value="Client">Client</option>
                        <option value="Vendeur">Vendeur</option>
                        <option value="Administrateur">Administrateur</option>
                      </select>
                    </div>
                  </div>

                  {draftFilters.period === 'custom' && (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={draftFilters.customStart}
                        onChange={(e) => setDraftFilters(f => ({ ...f, customStart: e.target.value }))}
                        className="px-2.5 py-1.5 rounded-xl bg-[#181b22] border border-white/10 text-white text-xs"
                      />
                      <input
                        type="date"
                        value={draftFilters.customEnd}
                        onChange={(e) => setDraftFilters(f => ({ ...f, customEnd: e.target.value }))}
                        className="px-2.5 py-1.5 rounded-xl bg-[#181b22] border border-white/10 text-white text-xs"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-white/55 font-semibold block mb-1">Abonnement</label>
                      <select
                        value={draftFilters.subscription}
                        onChange={(e) => setDraftFilters(f => ({ ...f, subscription: e.target.value }))}
                        className="w-full px-2.5 py-2 rounded-xl bg-[#181b22] border border-white/10 text-white text-xs"
                      >
                        <option value="all">Tous les abonnements</option>
                        {availableSubscriptionOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-white/55 font-semibold block mb-1">Statut</label>
                      <select
                        value={draftFilters.status}
                        onChange={(e) => setDraftFilters(f => ({ ...f, status: e.target.value as StatusScope }))}
                        className="w-full px-2.5 py-2 rounded-xl bg-[#181b22] border border-white/10 text-white text-xs"
                      >
                        <option value="all">Toutes</option>
                        <option value="success">Réussies</option>
                        <option value="failed">Échouées</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => { setDraftFilters(DEFAULT_FILTERS); setAppliedFilters(DEFAULT_FILTERS); setSelectedDateKey(null); setCurrentPage(1); }}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#181b22] border border-white/10 text-white/80 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Réinitialiser
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAppliedFilters(draftFilters); setSelectedDateKey(null); setCurrentPage(1); }}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 text-black font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" /> Appliquer
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* SUB-TAB 1: PAR DATE */}
            {activeSubTab === 'date' && (
              <div className="space-y-3">
                <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-3">
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-[#0b0c10] border border-white/[0.05]">
                      <span className="text-[10px] text-white/55 block">Opérations</span>
                      <span className="text-sm font-black text-blue-400 font-mono">{stats.total}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-[#0b0c10] border border-white/[0.05]">
                      <span className="text-[10px] text-white/55 block">Réussies</span>
                      <span className="text-sm font-black text-emerald-400 font-mono">{stats.success}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-[#0b0c10] border border-white/[0.05]">
                      <span className="text-[10px] text-white/55 block">Échouées</span>
                      <span className="text-sm font-black text-rose-400 font-mono">{stats.failed}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-[#0b0c10] border border-white/[0.05]">
                      <span className="text-[10px] text-white/55 block">Moy./op.</span>
                      <span className="text-sm font-black text-yellow-400 font-mono">{stats.avgCostPerOp} F</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-[#0b0c10] border border-white/[0.05]">
                      <span className="text-[10px] text-white/55 block truncate">{profile.primaryMetricLabel}</span>
                      <span className="text-xs font-black text-blue-300 font-mono">{stats.totalPrimary.toLocaleString()}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-[#0b0c10] border border-white/[0.05]">
                      <span className="text-[10px] text-white/55 block truncate">{profile.secondaryMetricLabel}</span>
                      <span className="text-xs font-black text-purple-300 font-mono">{stats.totalSecondary.toLocaleString()}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-[#0b0c10] border border-white/[0.05]">
                      <span className="text-[10px] text-white/55 block">Coût total</span>
                      <span className="text-xs font-black text-yellow-400 font-mono">{stats.totalCostFCFA} FCFA</span>
                    </div>
                  </div>
                </div>

                {/* Bar Chart */}
                <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white">1. Consommation par date</h3>
                        <p className="text-[11px] text-white/50">Dépenses {provider.name} (FCFA &amp; opérations)</p>
                      </div>
                    </div>
                    <select
                      value={granularity}
                      onChange={(e) => { setGranularity(e.target.value as ChartGranularity); setSelectedDateKey(null); }}
                      className="px-2.5 py-1.5 rounded-xl bg-[#181b22] border border-white/10 text-[11px] font-semibold text-white"
                    >
                      <option value="hour">Par heure</option>
                      <option value="day">Quotidienne</option>
                      <option value="week">Hebdomadaire</option>
                      <option value="month">Mensuelle</option>
                    </select>
                  </div>

                  {chartBuckets.length === 0 ? (
                    <div className="py-8 text-center text-xs text-white/45">Aucune opération sur la période.</div>
                  ) : (
                    <div className="pt-2">
                      <div className="flex items-end justify-between gap-2 h-40 border-b border-white/10 pb-2 px-1">
                        {chartBuckets.map(bucket => {
                          const heightPct = Math.max(14, Math.round((bucket.costFCFA / maxChartCost) * 100));
                          const isSelected = selectedDateKey === bucket.key;
                          return (
                            <button
                              key={bucket.key}
                              type="button"
                              onClick={() => setSelectedDateKey(isSelected ? null : bucket.key)}
                              className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer"
                            >
                              <span className="text-[9px] font-mono font-bold text-white/90 mb-1">{bucket.costFCFA} F</span>
                              <div
                                className={`w-full max-w-[36px] rounded-t-lg bg-gradient-to-b from-violet-400 to-purple-600 transition-all ${
                                  isSelected ? 'ring-2 ring-white shadow-[0_0_12px_rgba(168,85,247,0.6)]' : 'opacity-90 group-hover:opacity-100'
                                }`}
                                style={{ height: `${heightPct}%` }}
                              />
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1.5 px-1">
                        {chartBuckets.map(bucket => (
                          <div key={`lbl-${bucket.key}`} className="flex-1 text-center">
                            <span className="text-[10px] font-mono text-white/70 block truncate">{bucket.label}</span>
                            <span className="text-[9px] text-purple-300/80 block">{bucket.count} op.</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedBucket && (
                    <div className="p-3 rounded-xl bg-[#0b0c10] border border-purple-500/35 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black text-purple-300">Détail du {selectedBucket.key}</span>
                        <span className="font-mono font-bold text-yellow-400">{selectedBucket.costFCFA} FCFA • {selectedBucket.count} op.</span>
                      </div>
                      <div className="space-y-1">
                        {selectedBucket.ops.map(o => (
                          <div
                            key={`sel-${o.id}`}
                            onClick={() => setSelectedOperation(o)}
                            className="flex items-center justify-between text-[11px] py-1 border-t border-white/[0.05] cursor-pointer hover:text-cyan-300"
                          >
                            <span className="truncate max-w-[200px]">{o.id} • {o.userName}</span>
                            <span className="font-mono font-bold text-yellow-300">{o.realCostFCFA} F</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Preview cards: Users + Subscriptions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setActiveSubTab('users')}
                    className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] hover:border-emerald-500/35 transition cursor-pointer space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-black text-white">2. Par utilisateur</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/40" />
                    </div>
                    <div className="space-y-2">
                      {usersAggregation.slice(0, 4).map(u => {
                        const maxQty = Math.max(1, usersAggregation[0]?.primaryQty || 1);
                        return (
                          <div key={`mini-${u.userId}`} className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span className="text-white/80 truncate max-w-[130px]">{u.userName}</span>
                              <span className="font-mono text-white font-bold">{u.primaryQty.toLocaleString()} {profile.nativeUnitPlural}</span>
                            </div>
                            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.round((u.primaryQty / maxQty) * 100)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    onClick={() => setActiveSubTab('subscriptions')}
                    className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] hover:border-yellow-500/35 transition cursor-pointer space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Crown className="w-4 h-4 text-yellow-400" />
                        <span className="text-xs font-black text-white">3. Par abonnement</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/40" />
                    </div>
                    <div className="flex items-center gap-3">
                      <SubscriptionDonutChart
                        segments={donutOverview}
                        centerPercent={`${donutOverview[0]?.percent ?? 0}%`}
                        centerLabel={donutOverview[0]?.label || '—'}
                      />
                      <div className="space-y-1.5 flex-1 min-w-0">
                        {donutOverview.map(seg => (
                          <div key={seg.label} className="flex items-center justify-between gap-1 text-[10px]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                              <span className="text-white/75 truncate">{seg.label}</span>
                            </div>
                            <span className="font-mono font-bold text-white shrink-0">{seg.percent}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Real Cost + HTTP Codes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-yellow-400" />
                      <div>
                        <h3 className="text-xs font-black text-white">4. Coût réel ({provider.name})</h3>
                        <p className="text-[10px] text-white/50">Selon grille tarifaire configurée</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                        <Calculator className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <span className="text-base font-black text-emerald-400 font-mono">≈ {stats.avgCostPerOp} FCFA</span>
                        <span className="text-[10px] text-white/50 block">coût moyen par {profile.operationNoun}</span>
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#0b0c10] border border-white/[0.06] space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-white/60">Coût brut moyen :</span>
                        <span className="font-mono text-yellow-300">{stats.avgUnitCost} F</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Frais annexes moyens :</span>
                        <span className="font-mono text-amber-400">{stats.avgFee} F</span>
                      </div>
                      <div className="flex justify-between border-t border-white/[0.06] pt-1">
                        <span className="text-white/75 font-bold">Total DJASSA / Revenus :</span>
                        <span className="font-mono font-black text-yellow-400">{stats.totalCostFCFA} F / {stats.totalRevenueFCFA} F</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/75 font-bold">Bénéfice &amp; marge :</span>
                        <span className={`font-mono font-black ${stats.totalProfitFCFA >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {stats.totalProfitFCFA} F ({stats.profitMargin}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => setShowTechnicalLogs(true)}
                    className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] hover:border-blue-500/40 transition cursor-pointer space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-blue-400" />
                        <div>
                          <h3 className="text-xs font-black text-white">5. Réponses API &amp; codes HTTP</h3>
                          <p className="text-[10px] text-white/50">Journaux techniques</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/40" />
                    </div>
                    <div className="space-y-2.5 text-[11px]">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="flex items-center gap-1.5 text-white/80"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Réponses réussies</span>
                          <span className="font-mono font-bold text-emerald-400">{stats.successRate} %</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${stats.successRate}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="flex items-center gap-1.5 text-white/80"><XCircle className="w-3.5 h-3.5 text-rose-400" /> Réponses échouées</span>
                          <span className="font-mono font-bold text-rose-400">{stats.failedRate} %</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-rose-400 rounded-full" style={{ width: `${stats.failedRate}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
                        <span className="text-white/70">Code dominant :</span>
                        <span className="font-mono font-bold text-white">HTTP 200 (OK)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB 2: PAR UTILISATEUR */}
            {activeSubTab === 'users' && (
              <div className="space-y-3">
                <div className="bg-[#12141a] rounded-2xl p-3.5 border border-white/[0.08] space-y-2.5">
                  <div className="relative">
                    <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Rechercher par nom ou ID utilisateur..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0b0c10] border border-white/10 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'volume' as const, label: `Trier par ${profile.nativeUnitPlural}` },
                      { id: 'cost' as const, label: 'Trier par coût' },
                      { id: 'ops' as const, label: 'Trier par opérations' }
                    ].map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setUserSortBy(s.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                          userSortBy === s.id ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'bg-[#0b0c10] text-white/60 border border-white/[0.08]'
                        }`}
                      >
                        <ArrowUpDown className="w-3 h-3" /> {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {usersAggregation.map(u => (
                    <div
                      key={u.userId}
                      onClick={() => setSelectedUserId(u.userId)}
                      className="bg-[#12141a] rounded-2xl p-3.5 border border-white/[0.08] hover:border-blue-500/40 transition cursor-pointer space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img src={u.avatar} alt={u.userName} className="w-10 h-10 rounded-full object-cover border border-white/15 shrink-0" />
                          <div className="min-w-0">
                            <h4 className="text-xs sm:text-sm font-black text-white truncate">{u.userName}</h4>
                            <p className="text-[10px] text-white/50 font-mono truncate">ID : {u.userId} • {u.app}</p>
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded-lg bg-purple-500/15 text-purple-300 text-[10px] font-bold">
                              {u.subscription}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-white/[0.06] text-center text-[10px]">
                        <div>
                          <span className="text-white/45 block">Opérations</span>
                          <span className="font-mono font-black text-blue-400">{u.opsCount}</span>
                        </div>
                        <div>
                          <span className="text-white/45 block truncate">{profile.primaryMetricLabel}</span>
                          <span className="font-mono font-black text-cyan-300">{u.primaryQty.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-white/45 block">Coût réel</span>
                          <span className="font-mono font-black text-yellow-400">{u.costFCFA} F</span>
                        </div>
                        <div>
                          <span className="text-white/45 block">Erreurs</span>
                          <span className={`font-mono font-black ${u.errors > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{u.errors}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SUB-TAB 3: PAR ABONNEMENT */}
            {activeSubTab === 'subscriptions' && (
              <div className="space-y-3.5">
                {subscriptionGroups.map(group => (
                  <div key={group.app} className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      {group.app === 'Client' && <UserIcon className="w-4 h-4 text-purple-400" />}
                      {group.app === 'Vendeur' && <Store className="w-4 h-4 text-blue-400" />}
                      {group.app === 'Administrateur' && <Shield className="w-4 h-4 text-amber-400" />}
                      <h3 className="text-xs font-black text-white uppercase tracking-wider">{group.title}</h3>
                    </div>
                    <div className="space-y-2">
                      {group.cards.map(card => (
                        <div
                          key={`${group.app}-${card.planName}`}
                          onClick={() => setSelectedPlanDetail({ app: group.app, name: card.planName })}
                          className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] hover:border-yellow-500/40 transition cursor-pointer space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Crown className="w-4 h-4 text-yellow-400 shrink-0" />
                              <h4 className="text-sm font-black text-white truncate">{card.planName}</h4>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-[10px] font-bold">
                                {card.globalPercent}% global
                              </span>
                              <ChevronRight className="w-4 h-4 text-white/40" />
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-[11px]">
                            <div className="p-2 rounded-xl bg-[#0b0c10] border border-white/[0.05]">
                              <span className="text-[10px] text-white/50 block">Actifs</span>
                              <span className="font-mono font-black text-white">{card.activeUsersCount}</span>
                            </div>
                            <div className="p-2 rounded-xl bg-[#0b0c10] border border-white/[0.05]">
                              <span className="text-[10px] text-white/50 block">{profile.nativeUnitPlural}</span>
                              <span className="font-mono font-black text-cyan-300">{card.primaryQty.toLocaleString()}</span>
                            </div>
                            <div className="p-2 rounded-xl bg-[#0b0c10] border border-white/[0.05]">
                              <span className="text-[10px] text-white/50 block">Coût DJASSA</span>
                              <span className="font-mono font-black text-yellow-400">{card.costFCFA} F</span>
                            </div>
                            <div className="p-2 rounded-xl bg-[#0b0c10] border border-white/[0.05]">
                              <span className="text-[10px] text-white/50 block">Moy./user</span>
                              <span className="font-mono font-black text-emerald-400">{card.avgCostPerUser} F</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 rounded-full" style={{ width: `${Math.min(100, card.globalPercent)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SUB-TAB 4: DÉTAILS DES OPÉRATIONS */}
            {activeSubTab === 'requests' && (
              <div className="space-y-3">
                <div className="bg-[#12141a] rounded-2xl p-3.5 border border-white/[0.08]">
                  <div className="relative">
                    <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={requestSearchId}
                      onChange={(e) => { setRequestSearchId(e.target.value); setCurrentPage(1); }}
                      placeholder="Rechercher par ID d'opération, utilisateur ou type..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0b0c10] border border-white/10 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                {paginatedOperations.length === 0 ? (
                  <div className="bg-[#12141a] rounded-2xl p-8 border border-white/[0.08] text-center text-xs text-white/50">
                    Aucune opération ne correspond à vos filtres.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {paginatedOperations.map(op => (
                      <div
                        key={op.id}
                        onClick={() => setSelectedOperation(op)}
                        className="bg-[#12141a] rounded-2xl p-3.5 border border-white/[0.08] hover:border-cyan-500/40 transition cursor-pointer space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${op.status === 'success' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            <span className="text-xs font-black text-white font-mono truncate">{op.id}</span>
                            <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-blue-300 truncate max-w-[130px]">
                              {op.serviceTarget}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black font-mono border ${
                              op.status === 'success' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            }`}>
                              HTTP {op.httpCode}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-white/40" />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-white/70">
                          <span className="truncate max-w-[220px]">{op.userName} • {op.app} ({op.subscriptionName})</span>
                          <span className="font-mono text-white/50 shrink-0">{op.dateLabel} • {op.timeLabel}</span>
                        </div>

                        <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-white/[0.06] text-[10px] font-mono">
                          <div>
                            <span className="text-white/45 block font-sans truncate">{op.primaryUnit}</span>
                            <span className="text-blue-300 font-bold">{op.primaryQty.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-white/45 block font-sans truncate">{op.secondaryUnit}</span>
                            <span className="text-purple-300 font-bold">{op.secondaryQty.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-white/45 block font-sans">Latence</span>
                            <span className="text-white font-bold">{op.latencyMs} ms</span>
                          </div>
                          <div className="text-right">
                            <span className="text-white/45 block font-sans">Coût réel</span>
                            <span className="text-yellow-400 font-black">{op.realCostFCFA} F</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center justify-between bg-[#12141a] rounded-2xl px-4 py-2.5 border border-white/[0.08] text-xs">
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className="px-3 py-1 rounded-lg bg-[#181b22] border border-white/10 text-white disabled:opacity-40 cursor-pointer"
                      >
                        Précédent
                      </button>
                      <span className="font-mono text-white/75">
                        Page {currentPage} / {totalPages} ({searchedOperations.length} op.)
                      </span>
                      <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className="px-3 py-1 rounded-lg bg-[#181b22] border border-white/10 text-white disabled:opacity-40 cursor-pointer"
                      >
                        Suivant
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ACTIONS ADMINISTRATEUR */}
            <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
                  <Settings className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Actions administrateur</h3>
                  <p className="text-[11px] text-white/50">Supervision, exportations et contrôle {provider.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  className="py-2.5 px-2 rounded-xl bg-blue-500/10 border border-blue-500/40 text-blue-300 hover:bg-blue-500/20 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Tester API</span>
                </button>
                <button
                  type="button"
                  onClick={handleSyncData}
                  className="py-2.5 px-2 rounded-xl bg-yellow-500/10 border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/20 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="truncate">Synchroniser</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="py-2.5 px-2 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="py-2.5 px-2 rounded-xl bg-purple-500/10 border border-purple-500/40 text-purple-300 hover:bg-purple-500/20 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Export PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowTechnicalLogs(true)}
                  className="py-2.5 px-2 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 hover:bg-rose-500/20 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Journaux</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleProviderConnected(!provider.isConnected)}
                  className="py-2.5 px-2 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Power className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{provider.isConnected ? 'Désactiver' : 'Activer'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTopTab('config')}
                  className="py-2.5 px-2 rounded-xl bg-white/5 border border-white/20 text-white hover:bg-white/10 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                  <span className="truncate">Config API</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="py-2.5 px-2 rounded-xl bg-white/5 border border-white/20 text-white/80 hover:bg-white/10 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                  <span className="truncate">Réinitialiser</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveAll}
                  className="py-2.5 px-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Enregistrer</span>
                </button>
              </div>

              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-2 min-w-0">
                  <Info className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-white/80 truncate">
                    Dernière synchronisation : <strong className="text-white font-mono">{provider.lastSync}</strong>
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 font-bold text-[10px] shrink-0">
                  {provider.isConnected ? 'Actif' : 'Suspendu'}
                </span>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
};
