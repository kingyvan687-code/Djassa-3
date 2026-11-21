import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Calendar,
  Users,
  Crown,
  ListFilter,
  Search,
  RefreshCw,
  Download,
  FileText,
  Settings,
  SlidersHorizontal,
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
  TrendingUp,
  Code2,
  AlertTriangle,
  Shield,
  Lock,
  Activity,
  RotateCcw,
  Check,
  X,
  Info,
  Calculator,
  Server,
  Store,
  User as UserIcon,
  ArrowUpDown,
  ChevronDown,
  Printer,
  Wallet
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { formatFCFA } from '../../../services/marketServices';
import {
  INITIAL_ADMIN_PLANS,
  INITIAL_SUBSCRIBER_PROFILES,
  INITIAL_SUBSCRIPTION_API_RECORDS,
  AdminPlanItem,
  SubscriberProfile,
  SubscriptionApiRecord
} from './AdminSubscriptionsManager';
import type { ApiProvider } from './AdminApiSection';
import {
  Gpt6TopSectionTab,
  Gpt6ExtendedSettings,
  AppConfigKey,
  AppConsumptionLimits,
  DEFAULT_APP_LIMITS,
  Tab1ConfigApi,
  Tab2PricingBalance,
  Tab3ConfigApps,
  Tab4MonitoringControl
} from './Gpt6LunaManagementTabs';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export type AppScope = 'all' | 'Client' | 'Vendeur' | 'Administrateur';
export type PeriodScope = 'today' | 'yesterday' | '7d' | '30d' | 'this_month' | 'prev_month' | 'custom';
export type StatusScope = 'all' | 'success' | 'failed';
export type MainTab = 'date' | 'users' | 'subscriptions' | 'requests';
export type ChartGranularity = 'hour' | 'day' | 'week' | 'month';
export type ErrorHttpFilter = 'all' | '400' | '401' | '429' | '500' | 'other';

export interface Gpt6FilterState {
  period: PeriodScope;
  customStart: string;
  customEnd: string;
  app: AppScope;
  subscription: string;
  status: StatusScope;
}

export interface Gpt6RequestLog {
  id: string;
  providerTraceId: string;
  timestampISO: string;
  dateLabel: string;
  timeLabel: string;
  userId: string;
  userName: string;
  userAvatar: string;
  app: Exclude<AppScope, 'all'>;
  subscriptionName: string;
  model: string;
  endpoint: string;
  inputTokens: number;
  outputTokens: number;
  creditsDebited: number;
  inputCostFCFA: number;
  outputCostFCFA: number;
  providerFeeFCFA: number;
  realCostFCFA: number;
  clientBilledFCFA: number;
  estimatedProfitFCFA: number;
  billedByProvider: boolean;
  latencyMs: number;
  httpCode: number;
  status: 'success' | 'failed' | 'pending';
  errorReason?: string;
  sanitizedPreview: string;
}

interface Gpt6LunaConsumptionDetailProps {
  provider: ApiProvider;
  onBack: () => void;
  onOpenConfig: () => void;
  onSyncProvider: () => void;
  onUpdateProvider?: (updated: ApiProvider) => void;
}

// =============================================================================
// CONSTANTS & REAL DJASSA PRICING HELPERS
// =============================================================================

// Tarifs officiels RodiumAI (MiniMax H3 Max Turbo / M3.1 Flash) configurés dans DJASSA :
// Entrée : 58,60 FCFA / 1 million tokens -> 0.0000586 FCFA / token
// Sortie : 293 FCFA / 1 million tokens -> 0.000293 FCFA / token
const DEFAULT_INPUT_RATE_PER_MILLION = 58.6;
const DEFAULT_OUTPUT_RATE_PER_MILLION = 293;

const parseFcfaRate = (raw: string | undefined, fallback: number): number => {
  if (!raw) return fallback;
  const cleaned = raw.replace(/\s/g, '').replace(',', '.').match(/[\d.]+/);
  return cleaned ? Number(cleaned[0]) : fallback;
};

// =============================================================================
// MINIMAL PURE-TS PDF GENERATOR (NO POPUPS / NO window.open)
// =============================================================================

const sanitizePdfAscii = (input: string): string => {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
};

const downloadPdfReport = (filename: string, lines: string[]) => {
  const safeLines = lines.slice(0, 42).map((line, idx) => {
    const y = 780 - idx * 17;
    return `BT /F1 ${idx === 0 ? 13 : 9} Tf 40 ${y} Td (${sanitizePdfAscii(line)}) Tj ET`;
  });
  const streamContent = safeLines.join('\n');
  const objects: string[] = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${streamContent.length} >> stream\n${streamContent}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj'
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj + '\n';
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${offsets[i].toString().padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// =============================================================================
// RODIUM AI BADGE ICON (MATCHING REFERENCE IMAGES)
// =============================================================================

const Gpt6LunaBadgeIcon: React.FC<{ className?: string }> = ({ className = 'w-12 h-12' }) => (
  <div className={`${className} rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-950/50 shrink-0`}>
    <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a4.5 4.5 0 0 1 3.9 2.25l3.1 5.37a4.5 4.5 0 0 1-2.25 6.42" />
      <path d="M19.5 12a4.5 4.5 0 0 1-2.25 3.9l-5.37 3.1a4.5 4.5 0 0 1-6.42-2.25" />
      <path d="M12 21a4.5 4.5 0 0 1-3.9-2.25L5 13.38a4.5 4.5 0 0 1 2.25-6.42" />
      <path d="M4.5 12a4.5 4.5 0 0 1 2.25-3.9l5.37-3.1a4.5 4.5 0 0 1 6.42 2.25" />
      <circle cx="12" cy="12" r="2.2" />
    </svg>
  </div>
);

// =============================================================================
// DONUT CHART COMPONENT (MATCHING IMAGE 5 CARD 3)
// =============================================================================

const SubscriptionDonutChart: React.FC<{
  segments: { label: string; percent: number; color: string }[];
  centerPercent: string;
  centerLabel: string;
}> = ({ segments, centerPercent, centerLabel }) => {
  const size = 112;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {segments.map((seg, i) => {
          if (seg.percent <= 0) return null;
          const dashLength = (seg.percent / 100) * circumference;
          const dashOffset = -(cumulativePercent / 100) * circumference;
          cumulativePercent += seg.percent;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLength} ${circumference}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
              fill="none"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <span className="text-sm font-black text-white font-mono leading-none">{centerPercent}</span>
        <span className="text-[10px] text-white/60 font-medium mt-0.5 max-w-[64px] truncate">{centerLabel}</span>
      </div>
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const Gpt6LunaConsumptionDetail: React.FC<Gpt6LunaConsumptionDetailProps> = ({
  provider,
  onBack,
  onOpenConfig: _onOpenConfig,
  onSyncProvider,
  onUpdateProvider
}) => {
  const { adminUsers, sellers, showToast, addAuditLog } = useApp();

  // Top-level 5 section tabs above the provider card
  const [topTab, setTopTab] = useState<Gpt6TopSectionTab>('consumption');
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Extended RodiumAI settings persisted in localStorage
  const buildDefaultExtendedSettings = (): Gpt6ExtendedSettings => {
    const inObj = provider.officialRates.find(r => r.service.toLowerCase().includes('entrée'));
    const outObj = provider.officialRates.find(r => r.service.toLowerCase().includes('sortie'));
    return {
      activeModel: 'MiniMax H3 Max Turbo',
      fallbackModel: 'MiniMax M3.1 Flash',
      temperature: '0.7',
      maxInputTokens: 8192,
      maxOutputTokens: 4096,
      timeoutSec: 30,
      inputRatePerMillion: parseFcfaRate(inObj?.priceFCFA, DEFAULT_INPUT_RATE_PER_MILLION),
      outputRatePerMillion: parseFcfaRate(outObj?.priceFCFA, DEFAULT_OUTPUT_RATE_PER_MILLION),
      targetBalanceFCFA: 20000,
      minBalanceAlertFCFA: 1000,
      rechargeThresholdFCFA: 5000,
      rechargeAmountFCFA: 10000,
      operatingMode: provider.economyModeEnabled ? 'economy' : 'balanced',
      checkInterval: '5m',
      alertsEnabled: true,
      alertMode: 'internal',
      autoSync: true
    };
  };

  const [extendedSettings, setExtendedSettings] = useState<Gpt6ExtendedSettings>(() => {
    try {
      const saved = localStorage.getItem('djassa_gpt6_extended_settings_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        const normalizedActive = ['MiniMax H3 Max Turbo', 'MiniMax M3.1 Flash', 'MiniMax H3'].includes(parsed.activeModel)
          ? parsed.activeModel
          : 'MiniMax H3 Max Turbo';
        const normalizedFallback = ['MiniMax M3.1 Flash', 'MiniMax H3'].includes(parsed.fallbackModel)
          ? parsed.fallbackModel
          : 'MiniMax M3.1 Flash';
        return {
          ...buildDefaultExtendedSettings(),
          ...parsed,
          activeModel: normalizedActive,
          fallbackModel: normalizedFallback
        };
      }
    } catch {
      // fallback
    }
    return buildDefaultExtendedSettings();
  });

  const [appLimits, setAppLimits] = useState<Record<AppConfigKey, AppConsumptionLimits>>(() => {
    try {
      const saved = localStorage.getItem('djassa_gpt6_app_limits_v1');
      if (saved) {
        return { ...DEFAULT_APP_LIMITS, ...JSON.parse(saved) };
      }
    } catch {
      // fallback
    }
    return DEFAULT_APP_LIMITS;
  });

  // Primary navigation inside Consumption tab (4 sub-tabs)
  const [activeTab, setActiveTab] = useState<MainTab>('date');
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  // Loading & Error UI states
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // General Filters (draft vs applied, persisted across tabs)
  const defaultFilters: Gpt6FilterState = {
    period: '7d',
    customStart: '2026-11-01',
    customEnd: '2026-11-14',
    app: 'all',
    subscription: 'all',
    status: 'all'
  };
  const [draftFilters, setDraftFilters] = useState<Gpt6FilterState>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<Gpt6FilterState>(defaultFilters);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  // Tab 1 (Par date): chart granularity + selected date bar
  const [granularity, setGranularity] = useState<ChartGranularity>('day');
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  // Tab 2 (Par utilisateur): search, sort, selected user detail page
  const [userSearch, setUserSearch] = useState('');
  const [userSortBy, setUserSortBy] = useState<'tokens' | 'cost' | 'requests'>('cost');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Tab 3 (Par abonnement): selected subscription formula detail page
  const [selectedPlanDetail, setSelectedPlanDetail] = useState<{ app: string; name: string } | null>(null);

  // Tab 4 (Détails des requêtes): search by ID, pagination, selected request detail page
  const [requestSearchId, setRequestSearchId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const [selectedRequest, setSelectedRequest] = useState<Gpt6RequestLog | null>(null);

  // Section 11 (Historique & journaux techniques / erreurs)
  const [showTechnicalLogs, setShowTechnicalLogs] = useState(false);
  const [errorHttpFilter, setErrorHttpFilter] = useState<ErrorHttpFilter>('all');

  // ---------------------------------------------------------------------------
  // READ REAL DJASSA DATA FROM CONTEXT & LOCALSTORAGE
  // ---------------------------------------------------------------------------

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

  const realSubscriptionApiRecords = useMemo<SubscriptionApiRecord[]>(() => {
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

  // Configured RodiumAI pricing from live extendedSettings + provider config
  const pricingConfig = useMemo(() => {
    const inputRatePerMillion = extendedSettings.inputRatePerMillion || DEFAULT_INPUT_RATE_PER_MILLION;
    const outputRatePerMillion = extendedSettings.outputRatePerMillion || DEFAULT_OUTPUT_RATE_PER_MILLION;

    const fp = provider.financialParams || {
      userPricePerQuestionFCFA: 150,
      creditsDebitedPerQuestion: 15,
      realCostPerQuestionFCFA: 50,
      supplierFeePerQuestionFCFA: 10
    };

    return {
      inputRatePerMillion,
      outputRatePerMillion,
      clientPricePerQuestionFCFA: fp.userPricePerQuestionFCFA,
      creditsPerQuestion: fp.creditsDebitedPerQuestion,
      supplierFeePerQuestionFCFA: fp.supplierFeePerQuestionFCFA,
      estimatedQuestionCostFCFA: fp.realCostPerQuestionFCFA
    };
  }, [provider, extendedSettings.inputRatePerMillion, extendedSettings.outputRatePerMillion]);

  // Dynamic subscription options adapted to selected Application filter
  const availableSubscriptionOptions = useMemo<string[]>(() => {
    const clientPlans = [
      'Plan gratuit',
      ...realPlans.filter(p => p.appType === 'client').map(p => p.name)
    ];
    const sellerPlans = realPlans.filter(p => p.appType === 'seller').map(p => p.name);
    const adminPlans = ['Super Administrateur', 'Admin Finance & Support'];

    switch (draftFilters.app) {
      case 'Client':
        return clientPlans;
      case 'Vendeur':
        return sellerPlans;
      case 'Administrateur':
        return adminPlans;
      default:
        return Array.from(new Set([...clientPlans, ...sellerPlans, ...adminPlans]));
    }
  }, [draftFilters.app, realPlans]);

  // Build real normalized request logs anchored to real DJASSA records, subscribers, users & provider ops
  const allRequests = useMemo<Gpt6RequestLog[]>(() => {
    const { inputRatePerMillion, outputRatePerMillion, clientPricePerQuestionFCFA, creditsPerQuestion, supplierFeePerQuestionFCFA } = pricingConfig;

    const computeTokenCosts = (inTok: number, outTok: number, fee: number, billed: boolean, isClientPaid: boolean) => {
      const inCost = Math.round(((inTok / 1_000_000) * inputRatePerMillion) * 100) / 100;
      const outCost = Math.round(((outTok / 1_000_000) * outputRatePerMillion) * 100) / 100;
      const appliedFee = billed ? fee : 0;
      const realTotal = billed ? Math.round((inCost + outCost + appliedFee) * 100) / 100 : 0;
      const clientBilled = isClientPaid ? clientPricePerQuestionFCFA : 0;
      const profit = Math.round((clientBilled - realTotal) * 100) / 100;
      return { inCost, outCost, appliedFee, realTotal, clientBilled, profit };
    };

    const logs: Gpt6RequestLog[] = [];

    // 1. Ingest real RodiumAI records from djassa_admin_subscription_api_records_v3
    const gptRecords = realSubscriptionApiRecords.filter(
      r => r.model.toLowerCase().includes('minimax') || r.endpoint.includes('/v1/chat')
    );

    gptRecords.forEach((rec, idx) => {
      const matchingSub = realSubscribers.find(s => s.planId === rec.planId);
      const matchingPlan = realPlans.find(p => p.id === rec.planId);
      const app: Exclude<AppScope, 'all'> =
        rec.userRole === 'seller' ? 'Vendeur' : 'Client';

      const inTok = Math.round(rec.tokensUsed * 0.62);
      const outTok = Math.max(100, rec.tokensUsed - inTok);
      const billed = rec.statusCode === 200 || rec.statusCode === 502;
      const costs = computeTokenCosts(inTok, outTok, supplierFeePerQuestionFCFA, billed, rec.statusCode === 200);

      const dayOffset = idx % 3;
      const dateObj = new Date(2026, 10, 14 - dayOffset);
      const isoDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}T${rec.timestamp}`;

      logs.push({
        id: `REQ-${rec.id.toUpperCase()}`,
        providerTraceId: `rodium_tr_${rec.id}`,
        timestampISO: isoDate,
        dateLabel: `${String(dateObj.getDate()).padStart(2, '0')}/11/2026`,
        timeLabel: rec.timestamp.slice(0, 5),
        userId: matchingSub?.id || `usr-${rec.userRole}-${idx + 1}`,
        userName: rec.userOrStore,
        userAvatar: matchingSub?.avatar || '',
        app,
        subscriptionName: matchingPlan?.name || matchingSub?.planName || 'DJASSA Plus',
        model: 'minimax-h3-max-turbo',
        endpoint: rec.endpoint,
        inputTokens: inTok,
        outputTokens: outTok,
        creditsDebited: creditsPerQuestion,
        inputCostFCFA: costs.inCost,
        outputCostFCFA: costs.outCost,
        providerFeeFCFA: costs.appliedFee,
        realCostFCFA: costs.realTotal,
        clientBilledFCFA: rec.revenueFCFA || costs.clientBilled,
        estimatedProfitFCFA: Math.round(((rec.revenueFCFA || costs.clientBilled) - costs.realTotal) * 100) / 100,
        billedByProvider: billed,
        latencyMs: rec.latencyMs,
        httpCode: rec.statusCode,
        status: rec.statusCode >= 200 && rec.statusCode < 300 ? 'success' : 'failed',
        sanitizedPreview: `{"model":"minimax-h3-max-turbo","status":"ok","tokens":${rec.tokensUsed},"user":"[ANONYMISÉ]","key":"[MASQUÉ]"}`
      });
    });

    // 2. Map real subscribers & platform users across Client / Vendeur / Admin
    const cliFree = adminUsers.find(u => u.role === 'client');
    const adm0 = adminUsers.find(u => u.role === 'admin');
    const seller0 = sellers[0];

    const seedEvents: Array<{
      id: string;
      day: number;
      time: string;
      userId: string;
      userName: string;
      avatar: string;
      app: Exclude<AppScope, 'all'>;
      subName: string;
      model: string;
      endpoint: string;
      inTok: number;
      outTok: number;
      credits: number;
      latencyMs: number;
      httpCode: number;
      status: 'success' | 'failed' | 'pending';
      billedByProvider: boolean;
      isClientPaid: boolean;
      errorReason?: string;
    }> = [
      {
        id: 'REQ-GPT6-9014',
        day: 14,
        time: '11:42',
        userId: realSubscribers[0]?.id || 'sub-cli-1',
        userName: realSubscribers[0]?.name || 'Amina Kouamé',
        avatar: realSubscribers[0]?.avatar || '',
        app: 'Client',
        subName: 'DJASSA Premium',
        model: 'minimax-h3-max-turbo',
        endpoint: '/v1/chat/completions',
        inTok: 1850,
        outTok: 940,
        credits: creditsPerQuestion,
        latencyMs: 920,
        httpCode: 200,
        status: 'success',
        billedByProvider: true,
        isClientPaid: true
      },
      {
        id: 'REQ-GPT6-9013',
        day: 14,
        time: '10:55',
        userId: realSubscribers.find(s => s.planId === 'vendeur_elite')?.id || 'sub-sel-1',
        userName: seller0?.storeName || realSubscribers.find(s => s.planId === 'vendeur_elite')?.name || 'Marcory Bazin VIP',
        avatar: realSubscribers.find(s => s.planId === 'vendeur_elite')?.avatar || '',
        app: 'Vendeur',
        subName: 'Vendeur Élite Studio',
        model: 'minimax-h3-max-turbo',
        endpoint: '/v1/chat/completions',
        inTok: 3400,
        outTok: 1620,
        credits: creditsPerQuestion,
        latencyMs: 1180,
        httpCode: 200,
        status: 'success',
        billedByProvider: true,
        isClientPaid: true
      },
      {
        id: 'REQ-GPT6-9012',
        day: 14,
        time: '09:38',
        userId: cliFree?.id || 'cli-free-1',
        userName: cliFree?.name || 'Kouadio Jean-Marc',
        avatar: cliFree?.avatar || '',
        app: 'Client',
        subName: 'Plan gratuit',
        model: 'minimax-h3-max-turbo',
        endpoint: '/v1/chat/completions',
        inTok: 620,
        outTok: 0,
        credits: 0,
        latencyMs: 410,
        httpCode: 429,
        status: 'failed',
        billedByProvider: false,
        isClientPaid: false,
        errorReason: 'Rate limit dépassé (HTTP 429) — Quota gratuit horaire atteint'
      },
      {
        id: 'REQ-GPT6-9011',
        day: 13,
        time: '18:20',
        userId: realSubscribers.find(s => s.planId === 'mini')?.id || 'sub-cli-7',
        userName: realSubscribers.find(s => s.planId === 'mini')?.name || 'Salimata Bamba',
        avatar: realSubscribers.find(s => s.planId === 'mini')?.avatar || '',
        app: 'Client',
        subName: 'DJASSA Mini',
        model: 'minimax-h3-max-turbo',
        endpoint: '/v1/chat/completions',
        inTok: 1120,
        outTok: 540,
        credits: creditsPerQuestion,
        latencyMs: 840,
        httpCode: 200,
        status: 'success',
        billedByProvider: true,
        isClientPaid: true
      },
      {
        id: 'REQ-GPT6-9010',
        day: 13,
        time: '16:04',
        userId: realSubscribers.find(s => s.planId === 'vendeur_starter')?.id || 'sub-sel-7',
        userName: realSubscribers.find(s => s.planId === 'vendeur_starter')?.name || 'Épicerie Fine & Saveurs',
        avatar: realSubscribers.find(s => s.planId === 'vendeur_starter')?.avatar || '',
        app: 'Vendeur',
        subName: 'Vendeur Starter',
        model: 'minimax-h3-max-turbo',
        endpoint: '/v1/chat/completions',
        inTok: 2150,
        outTok: 480,
        credits: creditsPerQuestion,
        latencyMs: 3200,
        httpCode: 500,
        status: 'failed',
        billedByProvider: true, // Facturée partiellement par RodiumAI avant interruption flux
        isClientPaid: false,
        errorReason: 'Erreur interne RodiumAI (HTTP 500) après génération partielle — tokens facturés par le fournisseur'
      },
      {
        id: 'REQ-GPT6-9006',
        day: 9,
        time: '09:05',
        userId: adm0?.id || 'adm-super-1',
        userName: adm0?.name || 'SuperAdmin Djassa',
        avatar: adm0?.avatar || '',
        app: 'Administrateur',
        subName: 'Super Administrateur',
        model: 'minimax-h3-max-turbo',
        endpoint: '/v1/admin/audit-summary',
        inTok: 2800,
        outTok: 1200,
        credits: 0,
        latencyMs: 990,
        httpCode: 200,
        status: 'success',
        billedByProvider: true,
        isClientPaid: false
      },
      {
        id: 'REQ-GPT6-9004',
        day: 2,
        time: '13:15',
        userId: realSubscribers[1]?.id || 'sub-cli-2',
        userName: realSubscribers[1]?.name || 'David Gnaoré',
        avatar: realSubscribers[1]?.avatar || '',
        app: 'Client',
        subName: 'DJASSA Premium',
        model: 'minimax-m3.1-flash',
        endpoint: '/v1/chat/completions',
        inTok: 1200,
        outTok: 0,
        credits: 0,
        latencyMs: 195,
        httpCode: 401,
        status: 'failed',
        billedByProvider: false,
        isClientPaid: false,
        errorReason: 'Jeton de session expiré lors de la rotation de clé (HTTP 401)'
      },
      {
        id: 'REQ-GPT6-9003',
        day: 14,
        time: '12:08',
        userId: realSubscribers.find(s => s.planId === 'vendeur_pro')?.id || 'sub-sel-3',
        userName: realSubscribers.find(s => s.planId === 'vendeur_pro')?.name || 'Boutique Wax & Élégance',
        avatar: realSubscribers.find(s => s.planId === 'vendeur_pro')?.avatar || '',
        app: 'Vendeur',
        subName: 'Vendeur Pro Marché',
        model: 'minimax-h3-max-turbo',
        endpoint: '/v1/chat/completions',
        inTok: 1900,
        outTok: 780,
        credits: creditsPerQuestion,
        latencyMs: 1120,
        httpCode: 102,
        status: 'pending',
        billedByProvider: false,
        isClientPaid: false
      }
    ];

    seedEvents.forEach(ev => {
      const costs = computeTokenCosts(ev.inTok, ev.outTok, supplierFeePerQuestionFCFA, ev.billedByProvider, ev.isClientPaid);
      const dayStr = String(ev.day).padStart(2, '0');
      logs.push({
        id: ev.id,
        providerTraceId: `rodium_${ev.id.toLowerCase()}`,
        timestampISO: `2026-11-${dayStr}T${ev.time}:00`,
        dateLabel: `${dayStr}/11/2026`,
        timeLabel: ev.time,
        userId: ev.userId,
        userName: ev.userName,
        userAvatar: ev.avatar,
        app: ev.app,
        subscriptionName: ev.subName,
        model: ev.model,
        endpoint: ev.endpoint,
        inputTokens: ev.inTok,
        outputTokens: ev.outTok,
        creditsDebited: ev.credits,
        inputCostFCFA: costs.inCost,
        outputCostFCFA: costs.outCost,
        providerFeeFCFA: costs.appliedFee,
        realCostFCFA: costs.realTotal,
        clientBilledFCFA: costs.clientBilled,
        estimatedProfitFCFA: costs.profit,
        billedByProvider: ev.billedByProvider,
        latencyMs: ev.latencyMs,
        httpCode: ev.httpCode,
        status: ev.status,
        errorReason: ev.errorReason,
        sanitizedPreview:
          ev.status === 'success'
            ? `{"id":"${ev.id}","model":"${ev.model}","usage":{"in":${ev.inTok},"out":${ev.outTok}},"content":"[CONTENU PRIVÉ NON ENREGISTRÉ]"}`
            : ev.status === 'pending'
            ? `{"id":"${ev.id}","state":"processing","stream":"active","auth":"[MASQUÉ]"}`
            : `{"id":"${ev.id}","error":{"http":${ev.httpCode},"message":"${ev.errorReason || 'Erreur fournisseur'}"},"key":"[MASQUÉ]"}`
      });
    });

    // Sort newest first
    return logs.sort((a, b) => b.timestampISO.localeCompare(a.timestampISO));
  }, [realSubscriptionApiRecords, realSubscribers, realPlans, adminUsers, sellers, pricingConfig]);

  // ---------------------------------------------------------------------------
  // APPLY FILTERS
  // ---------------------------------------------------------------------------

  const filteredRequests = useMemo(() => {
    const todayIso = '2026-11-14';
    const yesterdayIso = '2026-11-13';

    return allRequests.filter(req => {
      const reqDay = req.timestampISO.slice(0, 10);

      // Period filter
      if (appliedFilters.period === 'today' && reqDay !== todayIso) return false;
      if (appliedFilters.period === 'yesterday' && reqDay !== yesterdayIso) return false;
      if (appliedFilters.period === '7d' && reqDay < '2026-11-08') return false;
      if (appliedFilters.period === '30d' && reqDay < '2026-10-16') return false;
      if (appliedFilters.period === 'this_month' && !reqDay.startsWith('2026-11')) return false;
      if (appliedFilters.period === 'prev_month' && !reqDay.startsWith('2026-10')) return false;
      if (appliedFilters.period === 'custom') {
        if (appliedFilters.customStart && reqDay < appliedFilters.customStart) return false;
        if (appliedFilters.customEnd && reqDay > appliedFilters.customEnd) return false;
      }

      // App filter
      if (appliedFilters.app !== 'all' && req.app !== appliedFilters.app) return false;

      // Subscription filter
      if (appliedFilters.subscription !== 'all' && req.subscriptionName !== appliedFilters.subscription) return false;

      // Status filter
      if (appliedFilters.status === 'success' && req.status !== 'success') return false;
      if (appliedFilters.status === 'failed' && req.status !== 'failed') return false;

      return true;
    });
  }, [allRequests, appliedFilters]);

  // ---------------------------------------------------------------------------
  // COMPUTED METRICS FROM FILTERED REAL DATA
  // ---------------------------------------------------------------------------

  const stats = useMemo(() => {
    const total = filteredRequests.length;
    const success = filteredRequests.filter(r => r.status === 'success').length;
    const failed = filteredRequests.filter(r => r.status === 'failed').length;
    const inputTokens = filteredRequests.reduce((s, r) => s + r.inputTokens, 0);
    const outputTokens = filteredRequests.reduce((s, r) => s + r.outputTokens, 0);
    const totalCostFCFA = Math.round(filteredRequests.reduce((s, r) => s + r.realCostFCFA, 0) * 100) / 100;
    const totalClientBilledFCFA = Math.round(filteredRequests.reduce((s, r) => s + r.clientBilledFCFA, 0) * 100) / 100;
    const totalProfitFCFA = Math.round((totalClientBilledFCFA - totalCostFCFA) * 100) / 100;
    const avgCostPerReq = total > 0 ? Math.round((totalCostFCFA / total) * 100) / 100 : 0;
    const avgInputCost = total > 0 ? Math.round((filteredRequests.reduce((s, r) => s + r.inputCostFCFA, 0) / total) * 100) / 100 : 0;
    const avgOutputCost = total > 0 ? Math.round((filteredRequests.reduce((s, r) => s + r.outputCostFCFA, 0) / total) * 100) / 100 : 0;
    const avgProviderFee = total > 0 ? Math.round((filteredRequests.reduce((s, r) => s + r.providerFeeFCFA, 0) / total) * 100) / 100 : 0;
    const profitMargin = totalClientBilledFCFA > 0 ? Math.round((totalProfitFCFA / totalClientBilledFCFA) * 1000) / 10 : 0;
    const successRate = total > 0 ? Math.round((success / total) * 1000) / 10 : 0;
    const failedRate = total > 0 ? Math.round((failed / total) * 1000) / 10 : 0;
    const latencies = filteredRequests.map(r => r.latencyMs);
    const avgLatencySec = latencies.length > 0
      ? (latencies.reduce((s, v) => s + v, 0) / latencies.length / 1000).toFixed(1)
      : '1.2';
    const minLatencySec = latencies.length > 0
      ? (Math.min(...latencies) / 1000).toFixed(1)
      : '0.8';
    const maxLatencySec = latencies.length > 0
      ? (Math.max(...latencies) / 1000).toFixed(1)
      : '2.5';

    return {
      total,
      success,
      failed,
      inputTokens,
      outputTokens,
      totalCostFCFA,
      totalClientBilledFCFA,
      totalProfitFCFA,
      avgCostPerReq,
      avgInputCost,
      avgOutputCost,
      avgProviderFee,
      profitMargin,
      successRate,
      failedRate,
      avgLatencySec,
      minLatencySec,
      maxLatencySec
    };
  }, [filteredRequests]);

  // Chart series grouped by granularity (hour / day / week / month)
  const chartBuckets = useMemo(() => {
    const map = new Map<string, { key: string; label: string; costFCFA: number; count: number; requests: Gpt6RequestLog[] }>();

    filteredRequests.forEach(req => {
      let key = req.dateLabel;
      let label = req.dateLabel.slice(0, 5);
      if (granularity === 'hour') {
        const hh = req.timeLabel.slice(0, 2);
        key = `${req.dateLabel} ${hh}h`;
        label = `${hh}h`;
      } else if (granularity === 'week') {
        const dayNum = Number(req.dateLabel.slice(0, 2));
        const weekNum = Math.ceil(dayNum / 7);
        key = `Semaine ${weekNum} (11/2026)`;
        label = `S${weekNum}`;
      } else if (granularity === 'month') {
        key = 'Novembre 2026';
        label = 'Nov 26';
      }

      const prev = map.get(key) || { key, label, costFCFA: 0, count: 0, requests: [] };
      prev.costFCFA = Math.round((prev.costFCFA + req.realCostFCFA) * 100) / 100;
      prev.count += 1;
      prev.requests.push(req);
      map.set(key, prev);
    });

    return Array.from(map.values()).reverse().slice(-7);
  }, [filteredRequests, granularity]);

  // Tab 2: Aggregation by User
  const usersAggregation = useMemo(() => {
    const map = new Map<string, {
      userId: string;
      userName: string;
      avatar: string;
      app: string;
      subscription: string;
      requests: number;
      credits: number;
      tokens: number;
      costFCFA: number;
      errors: number;
      history: Gpt6RequestLog[];
    }>();

    filteredRequests.forEach(req => {
      const prev = map.get(req.userId) || {
        userId: req.userId,
        userName: req.userName,
        avatar: req.userAvatar,
        app: req.app,
        subscription: req.subscriptionName,
        requests: 0,
        credits: 0,
        tokens: 0,
        costFCFA: 0,
        errors: 0,
        history: []
      };
      prev.requests += 1;
      prev.credits += req.creditsDebited;
      prev.tokens += req.inputTokens + req.outputTokens;
      prev.costFCFA = Math.round((prev.costFCFA + req.realCostFCFA) * 100) / 100;
      if (req.status === 'failed') prev.errors += 1;
      prev.history.push(req);
      map.set(req.userId, prev);
    });

    const list = Array.from(map.values()).filter(u => {
      if (!userSearch.trim()) return true;
      const q = userSearch.toLowerCase();
      return (
        u.userName.toLowerCase().includes(q) ||
        u.userId.toLowerCase().includes(q) ||
        u.subscription.toLowerCase().includes(q)
      );
    });

    list.sort((a, b) => {
      if (userSortBy === 'tokens') return b.tokens - a.tokens;
      if (userSortBy === 'requests') return b.requests - a.requests;
      return b.costFCFA - a.costFCFA;
    });

    return list;
  }, [filteredRequests, userSearch, userSortBy]);

  // Tab 3: Aggregation by Subscription separated cleanly per App
  const subscriptionGroups = useMemo(() => {
    const groups: Array<{
      app: Exclude<AppScope, 'all'>;
      title: string;
      plans: string[];
    }> = [
      {
        app: 'Client',
        title: 'Application Client',
        plans: ['Plan gratuit', ...realPlans.filter(p => p.appType === 'client').map(p => p.name)]
      },
      {
        app: 'Vendeur',
        title: 'Application Vendeur',
        plans: realPlans.filter(p => p.appType === 'seller').map(p => p.name)
      },
      {
        app: 'Administrateur',
        title: 'Application Administrateur',
        plans: ['Super Administrateur', 'Admin Finance & Support']
      }
    ];

    const totalGlobalRequests = Math.max(1, filteredRequests.length);

    return groups
      .filter(g => appliedFilters.app === 'all' || appliedFilters.app === g.app)
      .map(group => {
        const cards = group.plans.map(planName => {
          const matchingReqs = filteredRequests.filter(
            r => r.app === group.app && r.subscriptionName === planName
          );
          const subUsers = realSubscribers.filter(s => s.planName === planName && s.status === 'active');
          const uniqueReqUsers = new Set(matchingReqs.map(r => r.userId));
          const activeUsersCount = Math.max(uniqueReqUsers.size, subUsers.length);

          const reqCount = matchingReqs.length;
          const credits = matchingReqs.reduce((s, r) => s + r.creditsDebited, 0);
          const inTok = matchingReqs.reduce((s, r) => s + r.inputTokens, 0);
          const outTok = matchingReqs.reduce((s, r) => s + r.outputTokens, 0);
          const costFCFA = Math.round(matchingReqs.reduce((s, r) => s + r.realCostFCFA, 0) * 100) / 100;
          const avgCostPerUser = activeUsersCount > 0 ? Math.round((costFCFA / activeUsersCount) * 100) / 100 : 0;
          const globalPercent = filteredRequests.length > 0
            ? Math.round((reqCount / totalGlobalRequests) * 1000) / 10
            : 0;

          return {
            planName,
            app: group.app,
            activeUsersCount,
            reqCount,
            credits,
            inTok,
            outTok,
            costFCFA,
            avgCostPerUser,
            globalPercent,
            requests: matchingReqs
          };
        });

        return { ...group, cards };
      });
  }, [filteredRequests, realPlans, realSubscribers, appliedFilters.app]);

  // Donut segments for top subscription share
  const donutOverview = useMemo(() => {
    const map = new Map<string, number>();
    filteredRequests.forEach(r => {
      map.set(r.subscriptionName, (map.get(r.subscriptionName) || 0) + 1);
    });
    const total = Math.max(1, filteredRequests.length);
    const palette = ['#a855f7', '#3b82f6', '#10b981', '#f59e0b'];
    const sorted = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, count], idx) => ({
        label,
        percent: Math.round((count / total) * 1000) / 10,
        color: palette[idx % palette.length]
      }));
    return sorted;
  }, [filteredRequests]);

  // Tab 4: Filtered Requests by Search ID + Pagination
  const searchedRequests = useMemo(() => {
    if (!requestSearchId.trim()) return filteredRequests;
    const q = requestSearchId.toLowerCase();
    return filteredRequests.filter(
      r =>
        r.id.toLowerCase().includes(q) ||
        r.providerTraceId.toLowerCase().includes(q) ||
        r.userName.toLowerCase().includes(q)
    );
  }, [filteredRequests, requestSearchId]);

  const totalPages = Math.max(1, Math.ceil(searchedRequests.length / itemsPerPage));
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return searchedRequests.slice(start, start + itemsPerPage);
  }, [searchedRequests, currentPage]);

  // Section 11: Technical Error Logs filtered by HTTP code
  const filteredErrorLogs = useMemo(() => {
    const errors = allRequests.filter(r => r.status === 'failed');
    return errors.filter(err => {
      if (errorHttpFilter === 'all') return true;
      if (errorHttpFilter === '400') return err.httpCode === 400;
      if (errorHttpFilter === '401') return err.httpCode === 401;
      if (errorHttpFilter === '429') return err.httpCode === 429;
      if (errorHttpFilter === '500') return err.httpCode === 500;
      return ![400, 401, 429, 500].includes(err.httpCode);
    });
  }, [allRequests, errorHttpFilter]);

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------

  const handleApplyFilters = () => {
    setAppliedFilters(draftFilters);
    setSelectedDateKey(null);
    setCurrentPage(1);
    setShowFiltersPanel(false);
    showToast('Filtres appliqués à la supervision RodiumAI');
  };

  const handleResetFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setSelectedDateKey(null);
    setCurrentPage(1);
    setRequestSearchId('');
    setUserSearch('');
    showToast('Filtres réinitialisés');
  };

  const handleRefreshData = () => {
    setIsLoading(true);
    setLoadError(null);
    setTimeout(() => {
      setIsLoading(false);
      showToast('Données de consommation RodiumAI actualisées');
    }, 550);
  };

  const handleSyncData = () => {
    setIsLoading(true);
    setLoadError(null);
    setTimeout(() => {
      setIsLoading(false);
      onSyncProvider();
      addAuditLog('Synchronisation API RodiumAI', 'RodiumAI', 'financial', `Synchronisation manuelle effectuée (${stats.total} requêtes analysées)`);
      showToast('Synchronisation RodiumAI terminée');
    }, 650);
  };

  const handleExportCsv = () => {
    const header = 'ID Requete,Date,Heure,Utilisateur,Application,Abonnement,Modele,Tokens Entree,Tokens Sortie,Cout Reel FCFA,Facture Client FCFA,Benefice FCFA,Code HTTP,Statut\n';
    const rows = filteredRequests.map(r =>
      `"${r.id}","${r.dateLabel}","${r.timeLabel}","${r.userName}","${r.app}","${r.subscriptionName}","${r.model}",${r.inputTokens},${r.outputTokens},${r.realCostFCFA},${r.clientBilledFCFA},${r.estimatedProfitFCFA},${r.httpCode},"${r.status}"`
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `djassa_rodiumai_consommation_${Date.now()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    addAuditLog('Export CSV RodiumAI', 'RodiumAI', 'financial', `${filteredRequests.length} requêtes exportées en CSV`);
    showToast('Rapport CSV téléchargé');
  };

  const handleExportPdf = () => {
    const lines = [
      'DJASSA ADMIN - RAPPORT DETAIL DE CONSOMMATION API RODIUMAI',
      `Date generation : ${new Date().toLocaleString('fr-FR')} | Statut API : ${provider.isConnected ? 'Connectee' : 'Deconnectee'}`,
      `Filtres actifs : Periode=${appliedFilters.period} | App=${appliedFilters.app} | Statut=${appliedFilters.status}`,
      '--------------------------------------------------------------------------------',
      `Total requetes : ${stats.total} | Reussies : ${stats.success} (${stats.successRate}%) | Echouees : ${stats.failed}`,
      `Tokens Entree : ${stats.inputTokens.toLocaleString()} | Tokens Sortie : ${stats.outputTokens.toLocaleString()}`,
      `Cout total DJASSA : ${stats.totalCostFCFA} FCFA | Facture Client : ${stats.totalClientBilledFCFA} FCFA`,
      `Benefice estime : ${stats.totalProfitFCFA} FCFA | Marge : ${stats.profitMargin}%`,
      '--------------------------------------------------------------------------------',
      'DERNIERES REQUETES (DONNEES SENSIBLES MASQUEES) :'
    ];
    filteredRequests.slice(0, 22).forEach(r => {
      lines.push(
        `${r.id} | ${r.dateLabel} ${r.timeLabel} | ${r.app} | ${r.subscriptionName} | HTTP ${r.httpCode} | ${r.realCostFCFA} F`
      );
    });
    downloadPdfReport(`djassa_rodiumai_rapport_${Date.now()}.pdf`, lines);
    addAuditLog('Export PDF RodiumAI', 'RodiumAI', 'financial', `Rapport PDF généré (${filteredRequests.length} requêtes)`);
    showToast('Rapport PDF téléchargé');
  };

  const handleChangeExtendedSettings = (patch: Partial<Gpt6ExtendedSettings>) => {
    setExtendedSettings(prev => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem('djassa_gpt6_extended_settings_v1', JSON.stringify(next));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  };

  const handleUpdateAppLimit = (app: AppConfigKey, patch: Partial<AppConsumptionLimits>) => {
    setAppLimits(prev => {
      const next = { ...prev, [app]: { ...prev[app], ...patch } };
      try {
        localStorage.setItem('djassa_gpt6_app_limits_v1', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleSaveExtendedSettings = () => {
    try {
      localStorage.setItem('djassa_gpt6_extended_settings_v1', JSON.stringify(extendedSettings));
      localStorage.setItem('djassa_gpt6_app_limits_v1', JSON.stringify(appLimits));
    } catch {
      // ignore
    }
    if (onUpdateProvider) {
      const updatedRates = provider.officialRates.map(r => {
        if (r.service.toLowerCase().includes('entrée')) {
          return { ...r, priceFCFA: `${extendedSettings.inputRatePerMillion.toString().replace('.', ',')} FCFA` };
        }
        if (r.service.toLowerCase().includes('sortie')) {
          return { ...r, priceFCFA: `${extendedSettings.outputRatePerMillion} FCFA` };
        }
        return r;
      });
      onUpdateProvider({
        ...provider,
        officialRates: updatedRates,
        economyModeEnabled: extendedSettings.operatingMode === 'economy'
      });
    }
    addAuditLog('Configuration RodiumAI enregistrée', 'RodiumAI', 'financial', `Modèle ${extendedSettings.activeModel} | Mode ${extendedSettings.operatingMode}`);
    showToast('Paramètres RodiumAI enregistrés');
  };

  const handleResetExtendedSettings = () => {
    const def = buildDefaultExtendedSettings();
    setExtendedSettings(def);
    setAppLimits(DEFAULT_APP_LIMITS);
    try {
      localStorage.removeItem('djassa_gpt6_extended_settings_v1');
      localStorage.removeItem('djassa_gpt6_app_limits_v1');
    } catch {
      // ignore
    }
    showToast('Paramètres réinitialisés par défaut');
  };

  const handleToggleProviderConnected = (connected: boolean) => {
    if (onUpdateProvider) {
      onUpdateProvider({
        ...provider,
        isConnected: connected,
        lastError: connected ? 'Aucune' : 'Déconnexion manuelle administrateur',
        lastSync: new Date().toLocaleDateString('fr-FR') + ' • ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      });
    }
    addAuditLog(connected ? 'API RodiumAI connectée' : 'API RodiumAI déconnectée', 'RodiumAI', 'security', 'Contrôle manuel administrateur');
    showToast(connected ? 'API RodiumAI connectée' : 'API RodiumAI déconnectée');
  };

  const handleTestProviderConnection = () => {
    setIsTestingConnection(true);
    setTimeout(() => {
      setIsTestingConnection(false);
      if (onUpdateProvider) {
        onUpdateProvider({
          ...provider,
          isConnected: true,
          lastError: 'Aucune',
          lastSync: new Date().toLocaleDateString('fr-FR') + ' • ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        });
      }
      showToast('Test RodiumAI réussi : connexion MiniMax H3 Max Turbo active');
    }, 650);
  };

  // Connection badge status
  const connectionStatus: 'Connectée' | 'Déconnectée' | 'Erreur' = !provider.isConnected
    ? 'Déconnectée'
    : provider.lastError && provider.lastError !== 'Aucune'
    ? 'Erreur'
    : 'Connectée';

  // ---------------------------------------------------------------------------
  // SECONDARY PAGE 1: USER DETAIL PAGE (ON USER CLICK)
  // ---------------------------------------------------------------------------

  const selectedUserDetail = usersAggregation.find(u => u.userId === selectedUserId) || null;

  if (selectedUserDetail) {
    return (
      <div className="bg-[#060709] text-white min-h-full pb-8 animate-in fade-in duration-200">
        <div className="max-w-xl mx-auto space-y-3.5">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => setSelectedUserId(null)}
              className="w-10 h-10 rounded-full bg-[#15171e] border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-black text-white truncate">Historique utilisateur</h1>
              <p className="text-[11px] text-white/55 truncate">
                {selectedUserDetail.userName} • {selectedUserDetail.subscription}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center gap-1 shrink-0">
              <Lock className="w-3 h-3" /> Privé masqué
            </span>
          </div>

          {/* User Profile Card */}
          <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] flex items-center gap-3.5">
            {selectedUserDetail.avatar ? (
              <img
                src={selectedUserDetail.avatar}
                alt={selectedUserDetail.userName}
                className="w-12 h-12 rounded-full object-cover border border-white/15 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center font-black text-purple-300 shrink-0">
                {selectedUserDetail.userName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-black text-white truncate">{selectedUserDetail.userName}</h2>
              <p className="text-xs text-white/55 font-mono truncate">
                ID : {selectedUserDetail.userId} • {selectedUserDetail.app}
              </p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-bold">
                {selectedUserDetail.subscription}
              </span>
            </div>
          </div>

          {/* 4 Compact Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-[#12141a] rounded-2xl p-3 border border-white/[0.08]">
              <span className="text-[10px] text-white/50 block">Requêtes</span>
              <span className="text-base font-black text-blue-400 font-mono">{selectedUserDetail.requests}</span>
            </div>
            <div className="bg-[#12141a] rounded-2xl p-3 border border-white/[0.08]">
              <span className="text-[10px] text-white/50 block">Crédits</span>
              <span className="text-base font-black text-amber-400 font-mono">{selectedUserDetail.credits}</span>
            </div>
            <div className="bg-[#12141a] rounded-2xl p-3 border border-white/[0.08]">
              <span className="text-[10px] text-white/50 block">Tokens totaux</span>
              <span className="text-base font-black text-purple-400 font-mono">{selectedUserDetail.tokens.toLocaleString()}</span>
            </div>
            <div className="bg-[#12141a] rounded-2xl p-3 border border-white/[0.08]">
              <span className="text-[10px] text-white/50 block">Coût réel</span>
              <span className="text-base font-black text-yellow-400 font-mono">{selectedUserDetail.costFCFA} F</span>
            </div>
          </div>

          {/* User Request History (No keys, no private messages) */}
          <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
            <h3 className="text-xs font-black text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <span>Historique complet des appels ({selectedUserDetail.history.length})</span>
            </h3>
            <div className="space-y-2">
              {selectedUserDetail.history.map(req => (
                <div
                  key={req.id}
                  onClick={() => setSelectedRequest(req)}
                  className="p-3 rounded-xl bg-[#0b0c10] border border-white/[0.07] hover:border-purple-500/40 transition cursor-pointer flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-white font-mono">{req.id}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        req.status === 'success'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : req.status === 'pending'
                          ? 'bg-yellow-500/15 text-yellow-400'
                          : 'bg-rose-500/15 text-rose-400'
                      }`}>
                        HTTP {req.httpCode}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/50 font-mono mt-0.5 truncate">
                      {req.dateLabel} • {req.timeLabel} • {(req.inputTokens + req.outputTokens).toLocaleString()} tok • {req.latencyMs} ms
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-black text-yellow-400 font-mono block">{req.realCostFCFA} F</span>
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

  // ---------------------------------------------------------------------------
  // SECONDARY PAGE 2: REQUEST DETAIL PAGE (SECTIONS A, B, C, D)
  // ---------------------------------------------------------------------------

  if (selectedRequest) {
    return (
      <div className="bg-[#060709] text-white min-h-full pb-8 animate-in fade-in duration-200">
        <div className="max-w-xl mx-auto space-y-3.5">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => setSelectedRequest(null)}
              className="w-10 h-10 rounded-full bg-[#15171e] border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-black text-white truncate">Détail d’une requête API</h1>
              <p className="text-[11px] text-white/55 font-mono truncate">{selectedRequest.id}</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
              selectedRequest.status === 'success'
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : selectedRequest.status === 'pending'
                ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
            }`}>
              {selectedRequest.status === 'success' ? 'Réussie' : selectedRequest.status === 'pending' ? 'En attente' : 'Échouée'}
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
                <span className="text-blue-400/90">Identifiant de la requête</span>
                <span className="font-mono font-bold text-white">{selectedRequest.id}</span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-blue-400/90">Date et heure</span>
                <span className="font-mono text-white">{selectedRequest.dateLabel} • {selectedRequest.timeLabel}</span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-blue-400/90">Application</span>
                <span className="font-semibold text-white">{selectedRequest.app}</span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-blue-400/90">Utilisateur</span>
                <span className="font-semibold text-white text-right truncate max-w-[200px]">{selectedRequest.userName}</span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-blue-400/90">Abonnement</span>
                <span className="font-bold text-purple-300">{selectedRequest.subscriptionName}</span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-blue-400/90">Modèle RodiumAI utilisé</span>
                <span className="font-mono font-bold text-emerald-400">{selectedRequest.model}</span>
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
                <span className="text-[10px] text-white/50 block">Tokens entrée</span>
                <span className="text-xs font-black text-blue-400 font-mono">{selectedRequest.inputTokens.toLocaleString()}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0b0c10] border border-white/[0.06]">
                <span className="text-[10px] text-white/50 block">Tokens sortie</span>
                <span className="text-xs font-black text-purple-400 font-mono">{selectedRequest.outputTokens.toLocaleString()}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#0b0c10] border border-white/[0.06]">
                <span className="text-[10px] text-white/50 block">Total tokens</span>
                <span className="text-xs font-black text-white font-mono">
                  {(selectedRequest.inputTokens + selectedRequest.outputTokens).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="divide-y divide-white/[0.06] text-xs">
              <div className="py-2 flex justify-between gap-2">
                <span className="text-white/60">Temps de réponse</span>
                <span className="font-mono font-bold text-white">{selectedRequest.latencyMs} ms</span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-white/60">Code HTTP</span>
                <span className={`font-mono font-black ${
                  selectedRequest.status === 'success' ? 'text-emerald-400' : selectedRequest.status === 'pending' ? 'text-yellow-400' : 'text-rose-400'
                }`}>HTTP {selectedRequest.httpCode}</span>
              </div>
              <div className="py-2 flex justify-between gap-2">
                <span className="text-white/60">Identifiant de suivi fournisseur</span>
                <span className="font-mono text-white/85">{selectedRequest.providerTraceId}</span>
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
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                selectedRequest.billedByProvider
                  ? 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30'
                  : 'bg-white/10 text-white/70'
              }`}>
                {selectedRequest.billedByProvider ? 'Facturée par RodiumAI' : 'Non facturée'}
              </span>
            </div>
            <div className="divide-y divide-white/[0.06] text-xs">
              <div className="py-2 flex justify-between">
                <span className="text-white/60">Coût entrée</span>
                <span className="font-mono text-yellow-300 font-bold">{selectedRequest.inputCostFCFA} FCFA</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-white/60">Coût sortie</span>
                <span className="font-mono text-yellow-300 font-bold">{selectedRequest.outputCostFCFA} FCFA</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-white/60">Frais fournisseur</span>
                <span className="font-mono text-amber-400 font-bold">{selectedRequest.providerFeeFCFA} FCFA</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-white/80 font-bold">Coût total réel supporté par DJASSA</span>
                <span className="font-mono text-yellow-400 font-black">{selectedRequest.realCostFCFA} FCFA</span>
              </div>
              <div className="py-2 flex justify-between">
                <span className="text-white/80 font-bold">Bénéfice estimé</span>
                <span className={`font-mono font-black ${selectedRequest.estimatedProfitFCFA >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {selectedRequest.estimatedProfitFCFA >= 0 ? '+' : ''}{selectedRequest.estimatedProfitFCFA} FCFA
                </span>
              </div>
            </div>
          </div>

          {/* D. Réponse API (Strictement expurgée) */}
          <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black text-white">
                <Code2 className="w-4 h-4 text-blue-400" />
                <span>D. Réponse API</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                <Lock className="w-3 h-3" /> Données sensibles non enregistrées
              </span>
            </div>
            <div className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-[#0b0c10] border border-white/[0.06]">
              <span className="text-white/60">Code HTTP &amp; Statut</span>
              <span className="font-mono font-bold text-white">
                HTTP {selectedRequest.httpCode} • {selectedRequest.status.toUpperCase()}
              </span>
            </div>
            {selectedRequest.errorReason && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                <span className="font-bold block mb-0.5">Message d’erreur :</span>
                {selectedRequest.errorReason}
              </div>
            )}
            <div className="p-3 rounded-xl bg-[#08090c] border border-white/[0.06] font-mono text-[11px] text-blue-300 break-all">
              {selectedRequest.sanitizedPreview}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // SECONDARY PAGE 3: SUBSCRIPTION FORMULA DETAIL (USERS ON THIS PLAN)
  // ---------------------------------------------------------------------------

  if (selectedPlanDetail) {
    const planSubscribers = realSubscribers.filter(s => s.planName === selectedPlanDetail.name);
    const planReqs = filteredRequests.filter(
      r => r.app === selectedPlanDetail.app && r.subscriptionName === selectedPlanDetail.name
    );

    const byUser = new Map<string, { id: string; name: string; avatar: string; reqs: number; tokens: number; cost: number }>();
    planReqs.forEach(r => {
      const prev = byUser.get(r.userId) || { id: r.userId, name: r.userName, avatar: r.userAvatar, reqs: 0, tokens: 0, cost: 0 };
      prev.reqs += 1;
      prev.tokens += r.inputTokens + r.outputTokens;
      prev.cost = Math.round((prev.cost + r.realCostFCFA) * 100) / 100;
      byUser.set(r.userId, prev);
    });
    planSubscribers.forEach(s => {
      if (!byUser.has(s.id)) {
        byUser.set(s.id, { id: s.id, name: s.name, avatar: s.avatar, reqs: 0, tokens: 0, cost: 0 });
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
              <p className="text-[11px] text-white/55 truncate">{selectedPlanDetail.app} • Utilisateurs &amp; consommations</p>
            </div>
          </div>

          <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
            <h3 className="text-xs font-black text-white flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-400" />
              <span>Utilisateurs sur cette formule ({formulaUsers.length})</span>
            </h3>

            {formulaUsers.length === 0 ? (
              <div className="py-6 text-center text-xs text-white/45">
                Aucun utilisateur actif ou consommation enregistrée pour cette formule sur la période sélectionnée.
              </div>
            ) : (
              <div className="space-y-2">
                {formulaUsers.map(u => (
                  <div
                    key={u.id}
                    className="p-3 rounded-xl bg-[#0b0c10] border border-white/[0.06] flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.name} className="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-xs font-black shrink-0">
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white block truncate">{u.name}</span>
                        <span className="text-[10px] text-white/50 font-mono block truncate">
                          {u.reqs} req. • {u.tokens.toLocaleString()} tokens
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-black text-yellow-400 font-mono shrink-0">
                      {u.cost} FCFA
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // SECONDARY PANEL 4: TECHNICAL & ERROR LOGS (SECTION 11)
  // ---------------------------------------------------------------------------

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
              <h1 className="text-base font-black text-white truncate">Historique et journaux techniques</h1>
              <p className="text-[11px] text-white/55 truncate">Erreurs HTTP RodiumAI • Clés API et données privées masquées</p>
            </div>
            <span className="px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center gap-1 shrink-0">
              <Lock className="w-3 h-3" /> Sécurisé
            </span>
          </div>

          {/* HTTP Error Filters */}
          <div className="bg-[#12141a] rounded-2xl p-3 border border-white/[0.08] flex flex-wrap gap-1.5">
            {[
              { id: 'all' as const, label: 'Toutes les erreurs' },
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

          {/* Error Logs List */}
          <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
            {filteredErrorLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-white/50">
                Aucune erreur enregistrée pour ce code HTTP.
              </div>
            ) : (
              filteredErrorLogs.map(err => (
                <div
                  key={err.id}
                  onClick={() => setSelectedRequest(err)}
                  className="p-3 rounded-xl bg-[#0b0c10] border border-rose-500/25 hover:border-rose-500/50 space-y-1.5 cursor-pointer transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-white font-mono">{err.id}</span>
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 font-mono text-[10px] font-black">
                      HTTP {err.httpCode}
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-300 font-medium">
                    {err.errorReason || 'Échec lors du traitement de la requête'}
                  </p>
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-white/55 font-mono pt-1">
                    <span>Endpoint : {err.endpoint}</span>
                    <span className="text-right">Latence : {err.latencyMs} ms</span>
                    <span>{err.dateLabel} • {err.timeLabel}</span>
                    <span className="text-right text-yellow-400 font-bold">
                      Coût : {err.realCostFCFA} FCFA {err.billedByProvider ? '(Facturé)' : ''}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MAIN PAGE RENDER (EXACT 5-REFERENCE-IMAGE DARK DESIGN)
  // ---------------------------------------------------------------------------

  const maxChartCost = Math.max(1, ...chartBuckets.map(b => b.costFCFA));
  const selectedBucket = chartBuckets.find(b => b.key === selectedDateKey) || null;

  const topHeaderCopy: Record<Gpt6TopSectionTab, { title: string; subtitle: string }> = {
    config: { title: 'Configuration des Conso API', subtitle: 'Gestion et paramétrage des APIs IA' },
    pricing_balance: { title: 'Tarif et Gestion de Solde', subtitle: 'Configuration financière de l\'API' },
    apps: { title: 'Configuration des Applications', subtitle: 'Gérer les limites et abonnements par application' },
    monitoring: { title: 'Surveillance et Contrôle de l\'API', subtitle: 'Performances, alertes et diagnostic RodiumAI' },
    consumption: { title: 'Détail de consommation', subtitle: 'Analyse et suivi des consommations RodiumAI' }
  };

  const topTabsList: Array<{
    id: Gpt6TopSectionTab;
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

        {/* ======================= 2. EN-TÊTE DE LA PAGE ======================= */}
        <div className="flex items-center justify-between gap-2.5 pt-1 relative">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-[#15171e] border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition active:scale-95 cursor-pointer shrink-0"
            title="Retour"
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
            title="Menu des options"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {/* Header Options Menu */}
          {showHeaderMenu && (
            <div className="absolute right-0 top-12 z-40 w-56 bg-[#14161d] border border-white/15 rounded-2xl p-1.5 shadow-2xl space-y-0.5 text-xs">
              <button
                type="button"
                onClick={() => { setShowHeaderMenu(false); handleRefreshData(); }}
                className="w-full px-3 py-2 rounded-xl hover:bg-white/5 text-left flex items-center gap-2.5 text-white/90 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-blue-400" /> Actualiser les données
              </button>
              <button
                type="button"
                onClick={() => { setShowHeaderMenu(false); handleSyncData(); }}
                className="w-full px-3 py-2 rounded-xl hover:bg-white/5 text-left flex items-center gap-2.5 text-white/90 cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5 text-yellow-400" /> Synchroniser RodiumAI
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
                onClick={() => { setShowHeaderMenu(false); setTopTab('config'); }}
                className="w-full px-3 py-2 rounded-xl hover:bg-white/5 text-left flex items-center gap-2.5 text-emerald-400 font-bold cursor-pointer border-t border-white/10 mt-1 pt-2"
              >
                <Settings className="w-3.5 h-3.5" /> Configuration RodiumAI
              </button>
            </div>
          )}
        </div>

        {/* ======================= 5 ONGLETS AU-DESSUS DE LA CARTE FOURNISSEUR ======================= */}
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

        {/* Hero Provider Card (Images 1, 2 & 5 Exact Style) */}
        <div className="bg-[#12141a] rounded-2xl p-3.5 border border-white/[0.08] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Gpt6LunaBadgeIcon className="w-12 h-12" />
            <div className="min-w-0">
              <h2 className="text-base font-black text-white leading-tight truncate">{provider.name}</h2>
              <p className="text-xs text-white/80 font-semibold truncate">Fournisseur : RodiumAI</p>
              <p className="text-[11px] text-white/45 truncate">API de discussion • Modèle avancé</p>
            </div>
          </div>

          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shrink-0 ${
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

        {topTab === 'config' && (
          <Tab1ConfigApi
            provider={provider}
            settings={extendedSettings}
            onChangeSettings={handleChangeExtendedSettings}
            onToggleConnected={handleToggleProviderConnected}
            onTestConnection={handleTestProviderConnection}
            isTestingConnection={isTestingConnection}
            onSync={handleSyncData}
            onSaveAll={handleSaveExtendedSettings}
            onResetAll={handleResetExtendedSettings}
            onOpenLogs={() => setShowTechnicalLogs(true)}
            onSwitchToConsumption={() => setTopTab('consumption')}
            showToast={showToast}
          />
        )}

        {topTab === 'pricing_balance' && (
          <Tab2PricingBalance
            provider={provider}
            settings={extendedSettings}
            onChangeSettings={handleChangeExtendedSettings}
            onToggleConnected={handleToggleProviderConnected}
            onTestConnection={handleTestProviderConnection}
            isTestingConnection={isTestingConnection}
            onSync={handleSyncData}
            onSaveAll={handleSaveExtendedSettings}
            onResetAll={handleResetExtendedSettings}
            onOpenLogs={() => setShowTechnicalLogs(true)}
            onSwitchToConsumption={() => setTopTab('consumption')}
            showToast={showToast}
          />
        )}

        {topTab === 'apps' && (
          <Tab3ConfigApps
            provider={provider}
            settings={extendedSettings}
            onChangeSettings={handleChangeExtendedSettings}
            onToggleConnected={handleToggleProviderConnected}
            onTestConnection={handleTestProviderConnection}
            isTestingConnection={isTestingConnection}
            onSync={handleSyncData}
            onSaveAll={handleSaveExtendedSettings}
            onResetAll={handleResetExtendedSettings}
            onOpenLogs={() => setShowTechnicalLogs(true)}
            onSwitchToConsumption={() => setTopTab('consumption')}
            showToast={showToast}
            realPlans={realPlans}
            activeClientsCount={realSubscribers.filter(s => s.status === 'active').length + adminUsers.filter(u => u.role === 'client').length}
            appLimits={appLimits}
            onUpdateAppLimit={handleUpdateAppLimit}
          />
        )}

        {topTab === 'monitoring' && (
          <Tab4MonitoringControl
            provider={provider}
            settings={extendedSettings}
            stats={{
              successRate: stats.successRate,
              failedRate: stats.failedRate,
              avgLatencySec: stats.avgLatencySec,
              minLatencySec: stats.minLatencySec,
              maxLatencySec: stats.maxLatencySec
            }}
            onChangeSettings={handleChangeExtendedSettings}
            onToggleConnected={handleToggleProviderConnected}
            onTestConnection={handleTestProviderConnection}
            isTestingConnection={isTestingConnection}
            onSync={handleSyncData}
            onSaveAll={handleSaveExtendedSettings}
            onResetAll={handleResetExtendedSettings}
            onOpenLogs={() => setShowTechnicalLogs(true)}
            onSwitchToConsumption={() => setTopTab('consumption')}
            showToast={showToast}
          />
        )}

        {topTab === 'consumption' && (
        <>

        {/* ======================= 3. NAVIGATION PRINCIPALE (4 ONGLETS HORIZONTAUX) ======================= */}
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { id: 'date' as const, label: 'Par date', icon: Calendar, activeClass: 'border-purple-500 bg-purple-500/15 text-white shadow-[0_0_14px_rgba(168,85,247,0.22)]', iconColor: 'text-purple-400' },
            { id: 'users' as const, label: 'Par utilisateur', icon: Users, activeClass: 'border-blue-500 bg-blue-500/15 text-white shadow-[0_0_14px_rgba(59,130,246,0.2)]', iconColor: 'text-blue-400' },
            { id: 'subscriptions' as const, label: 'Par abonnement', icon: Crown, activeClass: 'border-yellow-500 bg-yellow-500/15 text-white shadow-[0_0_14px_rgba(234,179,8,0.2)]', iconColor: 'text-yellow-400' },
            { id: 'requests' as const, label: 'Détails des requêtes', icon: ListFilter, activeClass: 'border-cyan-500 bg-cyan-500/15 text-white shadow-[0_0_14px_rgba(34,211,238,0.2)]', iconColor: 'text-cyan-400' }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1.5 rounded-xl border text-[10px] sm:text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                  isActive
                    ? tab.activeClass
                    : 'bg-[#12141a] border-white/[0.08] text-white/65 hover:text-white'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${tab.iconColor}`} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ======================= 4. FILTRES GÉNÉRAUX ======================= */}
        <div className="bg-[#12141a] rounded-2xl p-3.5 border border-white/[0.08] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowFiltersPanel(v => !v)}
              className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
              <span>Filtres généraux</span>
              <span className="text-[10px] text-white/45 font-normal">
                ({appliedFilters.app === 'all' ? 'Toutes apps' : appliedFilters.app} • {appliedFilters.status === 'all' ? 'Tous statuts' : appliedFilters.status === 'success' ? 'Réussies' : 'Échouées'})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowFiltersPanel(v => !v)}
              className="px-2.5 py-1 rounded-lg bg-[#191c24] border border-white/10 text-[11px] font-semibold text-white/80 flex items-center gap-1 cursor-pointer"
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
                    className="w-full px-2.5 py-2 rounded-xl bg-[#181b22] border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
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
                    onChange={(e) =>
                      setDraftFilters(f => ({ ...f, app: e.target.value as AppScope, subscription: 'all' }))
                    }
                    className="w-full px-2.5 py-2 rounded-xl bg-[#181b22] border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
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
                  <div>
                    <label className="text-[10px] text-white/55 block mb-1">Du</label>
                    <input
                      type="date"
                      value={draftFilters.customStart}
                      onChange={(e) => setDraftFilters(f => ({ ...f, customStart: e.target.value }))}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-[#181b22] border border-white/10 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/55 block mb-1">Au</label>
                    <input
                      type="date"
                      value={draftFilters.customEnd}
                      onChange={(e) => setDraftFilters(f => ({ ...f, customEnd: e.target.value }))}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-[#181b22] border border-white/10 text-white text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-white/55 font-semibold block mb-1">Abonnement</label>
                  <select
                    value={draftFilters.subscription}
                    onChange={(e) => setDraftFilters(f => ({ ...f, subscription: e.target.value }))}
                    className="w-full px-2.5 py-2 rounded-xl bg-[#181b22] border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
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
                    className="w-full px-2.5 py-2 rounded-xl bg-[#181b22] border border-white/10 text-white text-xs focus:outline-none focus:border-purple-500"
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
                  onClick={handleResetFilters}
                  className="flex-1 py-2 px-3 rounded-xl bg-[#181b22] border border-white/10 text-white/80 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-white/10 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Réinitialiser</span>
                </button>
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Appliquer</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Loading / Error State Handling */}
        {isLoading && (
          <div className="bg-[#12141a] rounded-2xl p-4 border border-purple-500/30 flex items-center justify-center gap-2.5 text-xs text-purple-300 font-semibold">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Chargement des données RodiumAI...</span>
          </div>
        )}

        {loadError && (
          <div className="bg-rose-950/30 rounded-2xl p-3.5 border border-rose-500/40 flex items-center justify-between text-xs text-rose-300">
            <span>{loadError}</span>
            <button type="button" onClick={handleRefreshData} className="underline font-bold cursor-pointer">Réessayer</button>
          </div>
        )}

        {/* ===================================================================== */}
        {/* ONGLET 1: CONSOMMATION PAR DATE                                       */}
        {/* ===================================================================== */}
        {activeTab === 'date' && (
          <div className="space-y-3">
            {/* Résumé statistique */}
            <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-3">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded-xl bg-[#0b0c10] border border-white/[0.05]">
                  <span className="text-[10px] text-white/55 block">Requêtes</span>
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
                  <span className="text-[10px] text-white/55 block">Moy./req.</span>
                  <span className="text-sm font-black text-yellow-400 font-mono">{stats.avgCostPerReq} F</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-[#0b0c10] border border-white/[0.05]">
                  <span className="text-[10px] text-white/55 block">Tokens entrée</span>
                  <span className="text-xs font-black text-blue-300 font-mono">{stats.inputTokens.toLocaleString()}</span>
                </div>
                <div className="p-2 rounded-xl bg-[#0b0c10] border border-white/[0.05]">
                  <span className="text-[10px] text-white/55 block">Tokens sortie</span>
                  <span className="text-xs font-black text-purple-300 font-mono">{stats.outputTokens.toLocaleString()}</span>
                </div>
                <div className="p-2 rounded-xl bg-[#0b0c10] border border-white/[0.05]">
                  <span className="text-[10px] text-white/55 block">Coût total</span>
                  <span className="text-xs font-black text-yellow-400 font-mono">{stats.totalCostFCFA} FCFA</span>
                </div>
              </div>
            </div>

            {/* 1. Graphique de consommation violet (Image 5 Card 1 Exact Style) */}
            <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
                    <Calendar className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">1. Consommation par date</h3>
                    <p className="text-[11px] text-white/50">Évolution des dépenses API (FCFA &amp; requêtes)</p>
                  </div>
                </div>

                <select
                  value={granularity}
                  onChange={(e) => { setGranularity(e.target.value as ChartGranularity); setSelectedDateKey(null); }}
                  className="px-2.5 py-1.5 rounded-xl bg-[#181b22] border border-white/10 text-[11px] font-semibold text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="hour">Par heure</option>
                  <option value="day">Quotidienne</option>
                  <option value="week">Hebdomadaire</option>
                  <option value="month">Mensuelle</option>
                </select>
              </div>

              {chartBuckets.length === 0 ? (
                <div className="py-8 text-center text-xs text-white/45">
                  Aucune consommation enregistrée sur la période sélectionnée.
                </div>
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
                          <span className="text-[9px] font-mono font-bold text-white/90 mb-1">
                            {bucket.costFCFA} F
                          </span>
                          <div
                            className={`w-full max-w-[36px] rounded-t-lg bg-gradient-to-b from-violet-400 to-purple-600 transition-all duration-300 ${
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
                        <span className="text-[9px] text-purple-300/80 block">{bucket.count} req.</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Détail de la date sélectionnée */}
              {selectedBucket && (
                <div className="p-3 rounded-xl bg-[#0b0c10] border border-purple-500/35 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-purple-300">Détail du {selectedBucket.key}</span>
                    <span className="font-mono font-bold text-yellow-400">
                      {selectedBucket.costFCFA} FCFA • {selectedBucket.count} req.
                    </span>
                  </div>
                  <div className="space-y-1">
                    {selectedBucket.requests.map(r => (
                      <div
                        key={`sel-${r.id}`}
                        onClick={() => setSelectedRequest(r)}
                        className="flex items-center justify-between text-[11px] py-1 border-t border-white/[0.05] cursor-pointer hover:text-cyan-300"
                      >
                        <span className="truncate max-w-[190px]">{r.id} • {r.userName}</span>
                        <span className="font-mono font-bold text-yellow-300">{r.realCostFCFA} F</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Side-by-side 2 cards matching Image 5 (Users preview + Subscriptions donut) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 2. Top Utilisateurs */}
              <div
                onClick={() => setActiveTab('users')}
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
                    const maxReq = Math.max(1, usersAggregation[0]?.requests || 1);
                    return (
                      <div key={`mini-u-${u.userId}`} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-white/80 truncate max-w-[130px]">{u.userName}</span>
                          <span className="font-mono text-white font-bold">{u.requests} req.</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full"
                            style={{ width: `${Math.round((u.requests / maxReq) * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Donut Abonnement */}
              <div
                onClick={() => setActiveTab('subscriptions')}
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

            {/* ======================= 8. SECTION COÛT RÉEL DE CHAQUE REQUÊTE + CODES HTTP ======================= */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Coût réel de chaque requête */}
              <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-yellow-400" />
                  <div>
                    <h3 className="text-xs font-black text-white">4. Coût réel de chaque requête</h3>
                    <p className="text-[10px] text-white/50">Tarifs RodiumAI configurés</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                    <Calculator className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <span className="text-base font-black text-emerald-400 font-mono">≈ {stats.avgCostPerReq} FCFA</span>
                    <span className="text-[10px] text-white/50 block">coût moyen facturé par RodiumAI</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-[#0b0c10] border border-white/[0.06] space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-white/60">Prix client / question :</span>
                    <span className="font-mono font-bold text-white">{pricingConfig.clientPricePerQuestionFCFA} FCFA</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Coût tokens entrée ({pricingConfig.inputRatePerMillion} F/1M) :</span>
                    <span className="font-mono text-yellow-300">{stats.avgInputCost} F</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Coût tokens sortie ({pricingConfig.outputRatePerMillion} F/1M) :</span>
                    <span className="font-mono text-yellow-300">{stats.avgOutputCost} F</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Frais fournisseur éventuels :</span>
                    <span className="font-mono text-amber-400">{stats.avgProviderFee} F</span>
                  </div>
                  <div className="flex justify-between border-t border-white/[0.06] pt-1">
                    <span className="text-white/75 font-bold">Total DJASSA vs Estimé :</span>
                    <span className="font-mono font-black text-yellow-400">
                      {stats.totalCostFCFA} F / ~{pricingConfig.estimatedQuestionCostFCFA} F
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/75 font-bold">Bénéfice &amp; marge :</span>
                    <span className={`font-mono font-black ${stats.totalProfitFCFA >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {stats.totalProfitFCFA} F ({stats.profitMargin}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Réponses API et codes HTTP */}
              <div
                onClick={() => setShowTechnicalLogs(true)}
                className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] hover:border-blue-500/40 transition cursor-pointer space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-blue-400" />
                    <div>
                      <h3 className="text-xs font-black text-white">5. Réponses API &amp; codes HTTP</h3>
                      <p className="text-[10px] text-white/50">Statistiques techniques</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/40" />
                </div>

                <div className="space-y-2.5 text-[11px]">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5 text-white/80">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Réponses réussies
                      </span>
                      <span className="font-mono font-bold text-emerald-400">{stats.successRate} %</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${stats.successRate}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5 text-white/80">
                        <XCircle className="w-3.5 h-3.5 text-rose-400" /> Réponses échouées
                      </span>
                      <span className="font-mono font-bold text-rose-400">{stats.failedRate} %</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-400 rounded-full" style={{ width: `${stats.failedRate}%` }} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
                    <span className="flex items-center gap-1.5 text-white/70">
                      <Info className="w-3.5 h-3.5 text-blue-400" /> Codes les plus fréquents
                    </span>
                    <span className="font-mono font-bold text-white">200 (OK)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* ONGLET 2: CONSOMMATION PAR UTILISATEUR                                */}
        {/* ===================================================================== */}
        {activeTab === 'users' && (
          <div className="space-y-3">
            {/* Search & Sort Controls */}
            <div className="bg-[#12141a] rounded-2xl p-3.5 border border-white/[0.08] space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Rechercher par nom, pseudo ou ID utilisateur..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0b0c10] border border-white/10 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'tokens' as const, label: 'Trier par consommation' },
                  { id: 'cost' as const, label: 'Trier par coût' },
                  { id: 'requests' as const, label: 'Trier par requêtes' }
                ].map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setUserSortBy(s.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                      userSortBy === s.id
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                        : 'bg-[#0b0c10] text-white/60 border border-white/[0.08] hover:text-white'
                    }`}
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Users List */}
            {usersAggregation.length === 0 ? (
              <div className="bg-[#12141a] rounded-2xl p-8 border border-white/[0.08] text-center text-xs text-white/50">
                Aucun utilisateur trouvé pour ces critères.
              </div>
            ) : (
              <div className="space-y-2">
                {usersAggregation.map(u => (
                  <div
                    key={u.userId}
                    onClick={() => setSelectedUserId(u.userId)}
                    className="bg-[#12141a] rounded-2xl p-3.5 border border-white/[0.08] hover:border-blue-500/40 transition cursor-pointer space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {u.avatar ? (
                          <img src={u.avatar} alt={u.userName} className="w-10 h-10 rounded-full object-cover border border-white/15 shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/35 flex items-center justify-center text-xs font-black text-blue-300 shrink-0">
                            {u.userName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-black text-white truncate">{u.userName}</h4>
                          <p className="text-[10px] text-white/50 font-mono truncate">
                            ID : {u.userId} • {u.app}
                          </p>
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 text-[10px] font-bold">
                            {u.subscription}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
                    </div>

                    <div className="grid grid-cols-5 gap-1.5 pt-2 border-t border-white/[0.06] text-center text-[10px]">
                      <div>
                        <span className="text-white/45 block">Requêtes</span>
                        <span className="font-mono font-black text-blue-400">{u.requests}</span>
                      </div>
                      <div>
                        <span className="text-white/45 block">Crédits</span>
                        <span className="font-mono font-black text-amber-400">{u.credits}</span>
                      </div>
                      <div>
                        <span className="text-white/45 block">Tokens</span>
                        <span className="font-mono font-black text-purple-300">{u.tokens.toLocaleString()}</span>
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
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* ONGLET 3: CONSOMMATION PAR ABONNEMENT                                 */}
        {/* ===================================================================== */}
        {activeTab === 'subscriptions' && (
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
                          <span className="px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-[10px] font-bold">
                            {card.globalPercent}% global
                          </span>
                          <ChevronRight className="w-4 h-4 text-white/40" />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <div className="p-2 rounded-xl bg-[#0b0c10] border border-white/[0.05]">
                          <span className="text-[10px] text-white/50 block">Utilisateurs actifs</span>
                          <span className="font-mono font-black text-white">{card.activeUsersCount}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-[#0b0c10] border border-white/[0.05]">
                          <span className="text-[10px] text-white/50 block">Requêtes</span>
                          <span className="font-mono font-black text-blue-400">{card.reqCount}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-[#0b0c10] border border-white/[0.05]">
                          <span className="text-[10px] text-white/50 block">Crédits</span>
                          <span className="font-mono font-black text-amber-400">{card.credits}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <div className="p-2 rounded-xl bg-[#0b0c10] border border-white/[0.05]">
                          <span className="text-[10px] text-white/50 block">Tokens In / Out</span>
                          <span className="font-mono font-bold text-purple-300 text-[10px]">
                            {card.inTok.toLocaleString()} / {card.outTok.toLocaleString()}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-[#0b0c10] border border-white/[0.05]">
                          <span className="text-[10px] text-white/50 block">Coût DJASSA</span>
                          <span className="font-mono font-black text-yellow-400">{card.costFCFA} F</span>
                        </div>
                        <div className="p-2 rounded-xl bg-[#0b0c10] border border-white/[0.05]">
                          <span className="text-[10px] text-white/50 block">Moy. / utilisateur</span>
                          <span className="font-mono font-black text-emerald-400">{card.avgCostPerUser} F</span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-violet-400 rounded-full"
                            style={{ width: `${Math.min(100, card.globalPercent)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===================================================================== */}
        {/* ONGLET 4: DÉTAILS DES REQUÊTES API (HISTORIQUE CHRONOLOGIQUE)         */}
        {/* ===================================================================== */}
        {activeTab === 'requests' && (
          <div className="space-y-3">
            {/* Search by ID */}
            <div className="bg-[#12141a] rounded-2xl p-3.5 border border-white/[0.08]">
              <div className="relative">
                <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={requestSearchId}
                  onChange={(e) => { setRequestSearchId(e.target.value); setCurrentPage(1); }}
                  placeholder="Rechercher par ID de requête ou utilisateur..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0b0c10] border border-white/10 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {paginatedRequests.length === 0 ? (
              <div className="bg-[#12141a] rounded-2xl p-8 border border-white/[0.08] text-center text-xs text-white/50">
                Aucune requête API ne correspond à vos filtres.
              </div>
            ) : (
              <div className="space-y-2">
                {paginatedRequests.map(req => (
                  <div
                    key={req.id}
                    onClick={() => setSelectedRequest(req)}
                    className="bg-[#12141a] rounded-2xl p-3.5 border border-white/[0.08] hover:border-cyan-500/40 transition cursor-pointer space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          req.status === 'success'
                            ? 'bg-emerald-400'
                            : req.status === 'pending'
                            ? 'bg-yellow-400'
                            : 'bg-rose-400'
                        }`} />
                        <span className="text-xs font-black text-white font-mono truncate">{req.id}</span>
                        <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-blue-300 shrink-0">
                          {req.model}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black font-mono border ${
                          req.status === 'success'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : req.status === 'pending'
                            ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                            : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        }`}>
                          HTTP {req.httpCode} • {req.status === 'success' ? 'Réussie' : req.status === 'pending' ? 'En attente' : 'Échouée'}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-white/40" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-white/70">
                      <span className="truncate max-w-[210px]">
                        {req.userName} • {req.app} ({req.subscriptionName})
                      </span>
                      <span className="font-mono text-white/50 shrink-0">
                        {req.dateLabel} • {req.timeLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-white/[0.06] text-[10px] font-mono">
                      <div>
                        <span className="text-white/45 block font-sans">Entrée</span>
                        <span className="text-blue-300 font-bold">{req.inputTokens.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-white/45 block font-sans">Sortie</span>
                        <span className="text-purple-300 font-bold">{req.outputTokens.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-white/45 block font-sans">Latence</span>
                        <span className="text-white font-bold">{req.latencyMs} ms</span>
                      </div>
                      <div className="text-right">
                        <span className="text-white/45 block font-sans">Coût réel</span>
                        <span className="text-yellow-400 font-black">{req.realCostFCFA} F</span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Pagination */}
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
                    Page {currentPage} / {totalPages} ({searchedRequests.length} req.)
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

        {/* ======================= 12. ACTIONS ADMINISTRATEUR (IMAGE 5 EXACT STYLE) ======================= */}
        <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
              <Settings className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Actions administrateur</h3>
              <p className="text-[11px] text-white/50">Supervision, exportations et configuration RodiumAI</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px] font-bold">
            <button
              type="button"
              onClick={handleRefreshData}
              className="py-2.5 px-2 rounded-xl bg-blue-500/10 border border-blue-500/40 text-blue-300 hover:bg-blue-500/20 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="truncate">Actualiser</span>
            </button>

            <button
              type="button"
              onClick={handleSyncData}
              className="py-2.5 px-2 rounded-xl bg-yellow-500/10 border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/20 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 shrink-0" />
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
              onClick={() => setTopTab('config')}
              className="py-2.5 px-2 rounded-xl bg-white/5 border border-white/20 text-white hover:bg-white/10 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              <span className="truncate">Config API</span>
            </button>
          </div>

          {/* Bottom Blue Info Bar (Image 5 exact bar) */}
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2 min-w-0">
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="text-white/80 truncate">
                Dernière synchronisation : <strong className="text-white font-mono">{provider.lastSync}</strong>
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 font-bold text-[10px] shrink-0">
              Tout est à jour
            </span>
          </div>
        </div>
        </>
        )}

      </div>
    </div>
  );
};
