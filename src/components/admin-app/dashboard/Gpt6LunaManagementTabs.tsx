import React, { useState } from 'react';
import {
  Info,
  Zap,
  Clock,
  Settings,
  Coins,
  Wallet,
  RefreshCw,
  ChevronRight,
  ArrowDown,
  CreditCard,
  XCircle,
  List,
  RotateCcw,
  FileText,
  Save,
  Shield,
  User as UserIcon,
  Store,
  Crown,
  Edit3,
  BarChart3,
  Lock,
  CheckCircle2,
  Leaf,
  Scale,
  Power,
  Gauge,
  Bell,
  Link2,
  Copy,
  Eye,
  EyeOff,
  Play,
  Stethoscope,
  Calendar,
  Users,
  PieChart
} from 'lucide-react';
import { formatFCFA } from '../../../services/marketServices';
import type { ApiProvider } from './AdminApiSection';
import type { AdminPlanItem } from './AdminSubscriptionsManager';

export type Gpt6TopSectionTab =
  | 'config'
  | 'pricing_balance'
  | 'apps'
  | 'monitoring'
  | 'consumption';

export interface Gpt6ExtendedSettings {
  activeModel: string;
  fallbackModel: string;
  temperature: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  timeoutSec: number;
  inputRatePerMillion: number;
  outputRatePerMillion: number;
  targetBalanceFCFA: number;
  minBalanceAlertFCFA: number;
  rechargeThresholdFCFA: number;
  rechargeAmountFCFA: number;
  operatingMode: 'economy' | 'speed' | 'balanced';
  checkInterval: string;
  alertsEnabled: boolean;
  alertMode: string;
  autoSync: boolean;
}

export type AppConfigKey = 'Client' | 'Vendeur' | 'Admin';

export interface AppConsumptionLimits {
  dailyBudgetFCFA: number;
  monthlyBudgetFCFA: number;
  maxReqPerDay: number;
  maxReqPerUser: number;
  subLimitCredits: number;
  autoBlock: boolean;
}

export const DEFAULT_APP_LIMITS: Record<AppConfigKey, AppConsumptionLimits> = {
  Client: {
    dailyBudgetFCFA: 1000,
    monthlyBudgetFCFA: 20000,
    maxReqPerDay: 1000,
    maxReqPerUser: 100,
    subLimitCredits: 2000,
    autoBlock: true
  },
  Vendeur: {
    dailyBudgetFCFA: 2500,
    monthlyBudgetFCFA: 45000,
    maxReqPerDay: 2500,
    maxReqPerUser: 250,
    subLimitCredits: 1800,
    autoBlock: true
  },
  Admin: {
    dailyBudgetFCFA: 1500,
    monthlyBudgetFCFA: 15000,
    maxReqPerDay: 500,
    maxReqPerUser: 200,
    subLimitCredits: 5000,
    autoBlock: false
  }
};

interface SharedTabProps {
  provider: ApiProvider;
  settings: Gpt6ExtendedSettings;
  onChangeSettings: (next: Partial<Gpt6ExtendedSettings>) => void;
  onToggleConnected: (connected: boolean) => void;
  onTestConnection: () => void;
  isTestingConnection: boolean;
  onSync: () => void;
  onSaveAll: () => void;
  onResetAll: () => void;
  onOpenLogs: () => void;
  onSwitchToConsumption: () => void;
  showToast: (msg: string) => void;
}

// =============================================================================
// TAB 1: CONFIGURATION DES CONSO API (IMAGE 1)
// =============================================================================

export const Tab1ConfigApi: React.FC<SharedTabProps> = ({
  provider,
  settings,
  onChangeSettings,
  onToggleConnected,
  onTestConnection,
  isTestingConnection,
  onSaveAll
}) => {
  return (
    <div className="space-y-3 animate-in fade-in duration-150">
      {/* 1. Informations du fournisseur */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center shrink-0">
            <Info className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
          <h3 className="text-sm font-black text-white">1. Informations du fournisseur</h3>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1.5 text-xs flex-1 min-w-0">
            <div className="grid grid-cols-[125px_1fr] gap-1 items-center">
              <span className="text-blue-400/90 font-medium">Fournisseur :</span>
              <span className="text-white font-semibold truncate">RodiumAI</span>
            </div>
            <div className="grid grid-cols-[125px_1fr] gap-1 items-center">
              <span className="text-blue-400/90 font-medium">Nom de l'API :</span>
              <span className="text-white font-semibold truncate">{provider.name}</span>
            </div>
            <div className="grid grid-cols-[125px_1fr] gap-1 items-center">
              <span className="text-blue-400/90 font-medium">Model ID :</span>
              <span className="text-white/90 font-mono truncate">minimax-h3-max-turbo</span>
            </div>
            <div className="grid grid-cols-[125px_1fr] gap-1 items-center">
              <span className="text-blue-400/90 font-medium">Adresse de l'API :</span>
              <span className="text-white/90 font-mono text-[11px] truncate">https://api.rodiumai.io/v1</span>
            </div>
            <div className="grid grid-cols-[125px_1fr] gap-1 items-center">
              <span className="text-white/75 font-medium">Clé API :</span>
              <span className="text-white font-mono tracking-widest text-xs">••••••••••••••</span>
            </div>
            <div className="grid grid-cols-[125px_1fr] gap-1 items-center">
              <span className="text-white/75 font-medium">Dernière vérification :</span>
              <span className="text-white/90 font-mono text-[11px] flex items-center gap-1.5 truncate">
                <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                {provider.lastSync}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onTestConnection}
            disabled={isTestingConnection}
            className="px-3 py-3 rounded-xl bg-[#181b22] hover:bg-[#1f232c] border border-white/15 flex items-center gap-2 text-left transition cursor-pointer shrink-0 disabled:opacity-60"
          >
            <Zap className={`w-4 h-4 text-yellow-400 shrink-0 ${isTestingConnection ? 'animate-pulse' : ''}`} />
            <div className="leading-tight">
              <span className="text-xs font-black text-white block">
                {isTestingConnection ? 'Test...' : 'Tester'}
              </span>
              <span className="text-[10px] text-white/65 block">la connexion</span>
            </div>
          </button>
        </div>
      </div>

      {/* 2. Configurations du modèle */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-3.5">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Settings className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-black text-white">2. Configurations du modèle</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Left column */}
          <div className="space-y-2.5 sm:border-r sm:border-white/[0.08] sm:pr-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-white/75 font-medium">Modèle actif :</span>
              <select
                value={settings.activeModel}
                onChange={(e) => onChangeSettings({ activeModel: e.target.value })}
                className="px-2.5 py-1.5 rounded-xl bg-[#181b22] border border-white/10 text-white font-semibold text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="MiniMax H3 Max Turbo">MiniMax H3 Max Turbo</option>
                <option value="MiniMax M3.1 Flash">MiniMax M3.1 Flash</option>
                <option value="MiniMax H3">MiniMax H3</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-white/75 font-medium">Modèle de secours :</span>
              <select
                value={settings.fallbackModel}
                onChange={(e) => onChangeSettings({ fallbackModel: e.target.value })}
                className="px-2.5 py-1.5 rounded-xl bg-[#181b22] border border-white/10 text-white font-semibold text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="MiniMax M3.1 Flash">MiniMax M3.1 Flash</option>
                <option value="MiniMax H3">MiniMax H3</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-white/75 font-medium">Température :</span>
              <select
                value={settings.temperature}
                onChange={(e) => onChangeSettings({ temperature: e.target.value })}
                className="px-2.5 py-1.5 rounded-xl bg-[#181b22] border border-white/10 text-white font-mono font-semibold text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="0.3">0.3</option>
                <option value="0.7">0.7</option>
                <option value="1.0">1.0</option>
              </select>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onToggleConnected(!provider.isConnected)}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                  provider.isConnected ? 'bg-emerald-500' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    provider.isConnected ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-white font-bold">API activée</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-white/75 font-medium">Limite tokens entrée :</span>
              <select
                value={settings.maxInputTokens}
                onChange={(e) => onChangeSettings({ maxInputTokens: Number(e.target.value) })}
                className="px-2.5 py-1.5 rounded-xl bg-[#181b22] border border-white/10 text-white font-mono font-semibold text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value={4096}>4 096</option>
                <option value={8192}>8 192</option>
                <option value={16384}>16 384</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-white/75 font-medium">Limite tokens sortie :</span>
              <select
                value={settings.maxOutputTokens}
                onChange={(e) => onChangeSettings({ maxOutputTokens: Number(e.target.value) })}
                className="px-2.5 py-1.5 rounded-xl bg-[#181b22] border border-white/10 text-white font-mono font-semibold text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value={2048}>2 048</option>
                <option value={4096}>4 096</option>
                <option value={8192}>8 192</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-white/75 font-medium">Délai max. (Timeout) :</span>
              <select
                value={settings.timeoutSec}
                onChange={(e) => onChangeSettings({ timeoutSec: Number(e.target.value) })}
                className="px-2.5 py-1.5 rounded-xl bg-[#181b22] border border-white/10 text-white font-mono font-semibold text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value={15}>15 s</option>
                <option value={30}>30 s</option>
                <option value={60}>60 s</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onSaveAll}
        className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer"
      >
        <Save className="w-4 h-4" />
        <span>Enregistrer la configuration</span>
      </button>
    </div>
  );
};

// =============================================================================
// TAB 2: TARIF ET SOLDE API (IMAGE 2)
// =============================================================================

export const Tab2PricingBalance: React.FC<SharedTabProps> = ({
  provider,
  settings,
  onChangeSettings,
  onSync,
  onSaveAll,
  onResetAll,
  onOpenLogs
}) => {
  const [editingRate, setEditingRate] = useState<'in' | 'out' | null>(null);

  const balancePct = settings.targetBalanceFCFA > 0
    ? Math.min(100, Math.round((provider.providerBalanceFCFA / settings.targetBalanceFCFA) * 100))
    : 0;

  const budgetPct = provider.budgetLimitFCFA > 0
    ? Math.min(100, Math.round((provider.costFCFA / provider.budgetLimitFCFA) * 100))
    : 0;

  // Estimated costs derived from current token rates (typical 1500 in / 600 out tokens)
  const estQuestionFCFA = Math.max(
    1,
    Math.round((1500 / 1_000_000) * settings.inputRatePerMillion * 100 + (600 / 1_000_000) * settings.outputRatePerMillion * 100) / 100
  );
  const estAnswerAvgFCFA = Math.round(estQuestionFCFA * 2.5);

  const rechargeItems = [
    {
      id: 'tx-1',
      title: 'Recharge automatique',
      date: '14/11/2026 • 08:45',
      amount: '+10 000 FCFA',
      status: 'Réussie',
      balanceAfter: formatFCFA(provider.providerBalanceFCFA),
      type: 'auto'
    },
    {
      id: 'tx-2',
      title: 'Recharge manuelle',
      date: '12/11/2026 • 16:20',
      amount: '+ 5 000 FCFA',
      status: 'Réussie',
      balanceAfter: formatFCFA(Math.max(0, provider.providerBalanceFCFA - 5000)),
      type: 'manual'
    },
    {
      id: 'tx-3',
      title: 'Recharge échouée',
      date: '10/11/2026 • 11:12',
      amount: '+ 5 000 FCFA',
      status: 'Échouée',
      balanceAfter: formatFCFA(Math.max(0, provider.providerBalanceFCFA - 10000)),
      type: 'failed'
    }
  ];

  return (
    <div className="space-y-3 animate-in fade-in duration-150">
      {/* 3. Tarification API */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-yellow-400" />
            <h3 className="text-sm font-black text-white">3. Tarification API</h3>
          </div>
          <ChevronRight className="w-4 h-4 text-white/40" />
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-2 border-r border-white/[0.08] pr-3">
            <span className="text-[11px] text-white/70 block leading-snug">
              Coût des tokens en entrée<br />(1 million)
            </span>
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-full bg-[#181b22] border border-white/10">
              {editingRate === 'in' ? (
                <input
                  type="number"
                  step="0.1"
                  value={settings.inputRatePerMillion}
                  onChange={(e) => onChangeSettings({ inputRatePerMillion: Math.max(0, Number(e.target.value)) })}
                  onBlur={() => setEditingRate(null)}
                  autoFocus
                  className="w-full bg-transparent text-yellow-400 font-black font-mono text-xs focus:outline-none"
                />
              ) : (
                <span className="text-yellow-400 font-black font-mono">
                  {settings.inputRatePerMillion.toString().replace('.', ',')} FCFA
                </span>
              )}
              <button
                type="button"
                onClick={() => setEditingRate(editingRate === 'in' ? null : 'in')}
                className="text-blue-400 hover:text-blue-300 cursor-pointer shrink-0"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="pt-1">
              <span className="text-[11px] text-white/65 underline decoration-white/25 block">
                Coût estimé par question
              </span>
              <span className="text-sm font-black text-white font-mono mt-0.5 block">
                ≈ {provider.financialParams?.realCostPerQuestionFCFA ?? estQuestionFCFA} FCFA
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] text-white/70 block leading-snug">
              Coût des tokens en sortie<br />(1 million)
            </span>
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-full bg-[#181b22] border border-white/10">
              {editingRate === 'out' ? (
                <input
                  type="number"
                  step="1"
                  value={settings.outputRatePerMillion}
                  onChange={(e) => onChangeSettings({ outputRatePerMillion: Math.max(0, Number(e.target.value)) })}
                  onBlur={() => setEditingRate(null)}
                  autoFocus
                  className="w-full bg-transparent text-yellow-400 font-black font-mono text-xs focus:outline-none"
                />
              ) : (
                <span className="text-yellow-400 font-black font-mono">
                  {settings.outputRatePerMillion} FCFA
                </span>
              )}
              <button
                type="button"
                onClick={() => setEditingRate(editingRate === 'out' ? null : 'out')}
                className="text-blue-400 hover:text-blue-300 cursor-pointer shrink-0"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="pt-1">
              <span className="text-[11px] text-white/65 underline decoration-white/25 block">
                Coût moyen par réponse
              </span>
              <span className="text-sm font-black text-white font-mono mt-0.5 block">
                ≈ {estAnswerAvgFCFA} FCFA
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Gestion du solde */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-black text-white">4. Gestion du solde</h3>
          </div>
          <ChevronRight className="w-4 h-4 text-white/40" />
        </div>

        <div>
          <span className="text-xs text-white/75 block">Solde actuel chez RodiumAI</span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-black text-emerald-400 font-mono">
              {formatFCFA(provider.providerBalanceFCFA)}
            </span>
            <span className="px-3 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-mono font-black text-xs">
              {balancePct} %
            </span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${balancePct}%` }} />
          </div>
          <div className="flex justify-between text-[11px] text-white/65 font-mono mt-1">
            <span>0 FCFA</span>
            <span>Objectif : {formatFCFA(settings.targetBalanceFCFA)}</span>
          </div>
        </div>

        <div className="pt-1 border-t border-white/[0.07]">
          <span className="text-xs text-white/80 block mb-1.5">Budget API consommé (mensuel)</span>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${budgetPct}%` }} />
            </div>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono font-black text-[11px]">
              {budgetPct} %
            </span>
            <span className="text-[11px] text-white/75 font-mono shrink-0">
              {provider.costFCFA.toLocaleString()} / {provider.budgetLimitFCFA.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.07] text-center">
          <div>
            <span className="text-[10px] text-white/55 block">Seuil minimum d'alerte</span>
            <span className="text-xs font-black text-white font-mono mt-0.5 block">
              {formatFCFA(settings.minBalanceAlertFCFA)}
            </span>
          </div>
          <div className="border-x border-white/[0.08]">
            <span className="text-[10px] text-white/55 block">Seuil de recharge</span>
            <span className="text-xs font-black text-white font-mono mt-0.5 block">
              {formatFCFA(settings.rechargeThresholdFCFA)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-white/55 block">Montant de recharge</span>
            <span className="text-xs font-black text-white font-mono mt-0.5 block">
              {formatFCFA(settings.rechargeAmountFCFA)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onSync}
          className="w-full py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Synchroniser le solde</span>
        </button>
      </div>

      {/* 5. Historique des recharges et transactions */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-black text-white">5. Historique des recharges et transactions</h3>
          </div>
          <ChevronRight className="w-4 h-4 text-white/40" />
        </div>

        <div className="divide-y divide-white/[0.06]">
          {rechargeItems.map(tx => (
            <div key={tx.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  tx.type === 'auto'
                    ? 'bg-emerald-500 text-black'
                    : tx.type === 'manual'
                    ? 'bg-blue-500 text-white'
                    : 'bg-rose-500 text-white'
                }`}>
                  {tx.type === 'auto' && <ArrowDown className="w-4 h-4 stroke-[2.5]" />}
                  {tx.type === 'manual' && <CreditCard className="w-3.5 h-3.5" />}
                  {tx.type === 'failed' && <XCircle className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-white block truncate">{tx.title}</span>
                  <span className="text-[10px] text-white/50 font-mono block">{tx.date}</span>
                </div>
              </div>

              <span className="text-emerald-400 font-black font-mono shrink-0">{tx.amount}</span>

              <div className="text-right shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  tx.status === 'Réussie'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/35'
                    : 'bg-rose-500/15 text-rose-400 border-rose-500/35'
                }`}>
                  {tx.status}
                </span>
                <span className="text-[10px] text-white/60 font-mono block mt-0.5">
                  Solde : {tx.balanceAfter}
                </span>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onOpenLogs}
          className="w-full py-2 rounded-xl bg-[#181b22] hover:bg-white/10 border border-white/10 text-xs font-bold text-white/85 flex items-center justify-center gap-2 cursor-pointer transition"
        >
          <List className="w-3.5 h-3.5" />
          <span>Voir tout l'historique</span>
        </button>
      </div>

      {/* Bottom 3-Button Bar */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <button
          type="button"
          onClick={onResetAll}
          className="py-2.5 px-2 rounded-2xl bg-[#12141a] border border-white/10 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-white/10 transition cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Réinitialiser</span>
        </button>

        <button
          type="button"
          onClick={onOpenLogs}
          className="py-2.5 px-2 rounded-2xl bg-[#12141a] border border-white/10 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 hover:bg-white/10 transition cursor-pointer"
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span className="truncate">Journaux</span>
        </button>

        <button
          type="button"
          onClick={onSaveAll}
          className="py-2.5 px-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-black flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <Save className="w-4 h-4 shrink-0" />
          <span className="truncate">Enregistrer</span>
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// TAB 3: CONFIGURATION DES APPLICATIONS (IMAGE 3)
// =============================================================================

interface Tab3AppsProps extends SharedTabProps {
  realPlans: AdminPlanItem[];
  activeClientsCount: number;
  appLimits: Record<AppConfigKey, AppConsumptionLimits>;
  onUpdateAppLimit: (app: AppConfigKey, patch: Partial<AppConsumptionLimits>) => void;
}

export const Tab3ConfigApps: React.FC<Tab3AppsProps> = ({
  provider,
  realPlans,
  activeClientsCount,
  appLimits,
  onUpdateAppLimit,
  onSaveAll,
  onResetAll,
  onSwitchToConsumption,
  showToast
}) => {
  const [selectedApp, setSelectedApp] = useState<AppConfigKey>('Client');
  const [editingLimitKey, setEditingLimitKey] = useState<keyof AppConsumptionLimits | null>(null);

  const currentLimits = appLimits[selectedApp];

  // Real plans for the selected app from DJASSA
  const plansForApp = realPlans.filter(p => {
    if (selectedApp === 'Client') return p.appType === 'client';
    if (selectedApp === 'Vendeur') return p.appType === 'seller';
    return false;
  });

  const appTabs: Array<{ key: AppConfigKey; label: string; icon: React.ComponentType<{ className?: string }>; iconColor: string }> = [
    { key: 'Client', label: 'Client', icon: UserIcon, iconColor: 'text-purple-400' },
    { key: 'Vendeur', label: 'Vendeur', icon: Store, iconColor: 'text-blue-400' },
    { key: 'Admin', label: 'Admin', icon: Shield, iconColor: 'text-amber-400' }
  ];

  const nextApp = () => {
    const idx = appTabs.findIndex(a => a.key === selectedApp);
    setSelectedApp(appTabs[(idx + 1) % appTabs.length].key);
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-150">
      {/* Vue d'ensemble */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-purple-400" />
          <h3 className="text-sm font-black text-white">Vue d'ensemble</h3>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center pt-1">
          <div className="border-r border-white/[0.08]">
            <span className="text-base font-black text-white block font-mono">3</span>
            <span className="text-[10px] text-white/55 block">Applications</span>
          </div>
          <div className="border-r border-white/[0.08]">
            <span className="text-sm font-black text-white block font-mono">{provider.providerBalanceFCFA.toLocaleString()}</span>
            <span className="text-[10px] text-white/55 block">FCFA Solde</span>
          </div>
          <div className="border-r border-white/[0.08]">
            <span className="text-sm font-black text-white block font-mono">{provider.consumptionPercent}%</span>
            <span className="text-[10px] text-white/55 block">Conso totale</span>
          </div>
          <div>
            <span className="text-base font-black text-white block font-mono">{activeClientsCount}</span>
            <span className="text-[10px] text-white/55 block">Clients actifs</span>
          </div>
        </div>
      </div>

      {/* 1. Sélection de l'application */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-400" />
          <div>
            <h3 className="text-sm font-black text-white">1. Sélection de l'application</h3>
            <p className="text-[11px] text-white/55">Choisissez une application pour configurer ses limites</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {appTabs.map(tab => {
            const Icon = tab.icon;
            const active = selectedApp === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => { setSelectedApp(tab.key); setEditingLimitKey(null); }}
                className={`py-2 px-1 rounded-xl border text-[10px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                  active
                    ? 'border-purple-500 bg-purple-500/15 text-white shadow-[0_0_12px_rgba(168,85,247,0.22)]'
                    : 'bg-[#181b22] border-white/[0.08] text-white/70 hover:text-white'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${tab.iconColor}`} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Application Détail */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-3.5">
        <div className="flex items-center gap-2.5">
          <UserIcon className="w-6 h-6 text-purple-400" />
          <div>
            <h3 className="text-sm font-black text-white">2. Application {selectedApp}</h3>
            <p className="text-[11px] text-white/55">Gestion du plan gratuit et des abonnements réels DJASSA</p>
          </div>
        </div>

        {/* Plan Gratuit Card for Client */}
        {selectedApp === 'Client' && (
          <div className="p-3 rounded-2xl bg-[#0b0c10] border border-white/[0.08] grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500 text-black font-black text-[10px]">
                Plan Gratuit
              </span>
              <div className="text-2xl font-black text-emerald-400 font-mono">10 crédits</div>
              <span className="text-[11px] text-emerald-400/90 flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Renouvellement : toutes les 24h
              </span>
            </div>
            <div className="space-y-1 text-[11px] text-white/80 sm:border-l sm:border-white/[0.07] sm:pl-3">
              <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Crédits cumulables</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Ajout de 10 crédits toutes les 24h</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Aucun crédit perdu</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Blocage si épuisement</div>
            </div>
          </div>
        )}

        {/* Abonnements disponibles (Real Plans) */}
        {plansForApp.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-black text-white">
              <Crown className="w-4 h-4 text-yellow-400" />
              <span>Abonnements disponibles</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {plansForApp.map(plan => (
                <div
                  key={plan.id}
                  className="p-2.5 rounded-xl bg-[#0b0c10] border border-white/[0.08] flex flex-col justify-between space-y-2 text-center"
                >
                  <div>
                    <span className="text-[11px] font-black text-white block truncate">{plan.name}</span>
                    <span className="text-xs font-black text-white font-mono block mt-1">
                      {plan.priceFcfa.toLocaleString()} FCFA
                    </span>
                    <span className="text-[10px] text-white/50 block">≈ {plan.creditsGranted} crédits</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => showToast(`Configuration ${plan.name} (${plan.creditsGranted} crédits) active`)}
                    className="w-full py-1 px-1.5 rounded-full bg-[#181b22] hover:bg-white/10 border border-white/15 text-[10px] font-bold text-white flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" /> Configurer
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Limites de consommation */}
        <div className="space-y-2 pt-1 border-t border-white/[0.07]">
          <div className="flex items-center gap-2 text-xs font-black text-white">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span>Limites de consommation ({selectedApp})</span>
          </div>

          <div className="space-y-2 text-xs">
            {[
              { key: 'dailyBudgetFCFA' as const, label: 'Budget journalier maximum', suffix: 'FCFA', icon: Calendar, color: 'text-blue-400' },
              { key: 'monthlyBudgetFCFA' as const, label: 'Budget mensuel maximum', suffix: 'FCFA', icon: Calendar, color: 'text-cyan-400' },
              { key: 'maxReqPerDay' as const, label: 'Nombre maximal de requêtes par jour', suffix: '', icon: Play, color: 'text-blue-400' },
              { key: 'maxReqPerUser' as const, label: 'Nombre maximal de requêtes par utilisateur', suffix: '', icon: Users, color: 'text-blue-400' },
              { key: 'subLimitCredits' as const, label: 'Limite de consommation par abonnement', suffix: 'crédits', icon: PieChart, color: 'text-cyan-400' }
            ].map(row => {
              const Icon = row.icon;
              const isEditing = editingLimitKey === row.key;
              return (
                <div key={row.key} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className={`w-3.5 h-3.5 ${row.color} shrink-0`} />
                    <span className="text-white/80 truncate">{row.label}</span>
                  </div>
                  {isEditing ? (
                    <input
                      type="number"
                      value={currentLimits[row.key] as number}
                      onChange={(e) => onUpdateAppLimit(selectedApp, { [row.key]: Math.max(0, Number(e.target.value)) })}
                      onBlur={() => setEditingLimitKey(null)}
                      autoFocus
                      className="w-28 px-3 py-1 rounded-full bg-[#181b22] border border-purple-500 text-right font-mono font-bold text-white text-xs focus:outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingLimitKey(row.key)}
                      className="px-3 py-1 rounded-full bg-[#181b22] hover:bg-white/10 border border-white/10 font-mono font-bold text-white text-xs shrink-0 cursor-pointer"
                    >
                      {(currentLimits[row.key] as number).toLocaleString()} {row.suffix} &gt;
                    </button>
                  )}
                </div>
              );
            })}

            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                <span className="text-white/85 font-semibold">Blocage automatique en cas de dépassement</span>
              </div>
              <button
                type="button"
                onClick={() => onUpdateAppLimit(selectedApp, { autoBlock: !currentLimits.autoBlock })}
                className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                  currentLimits.autoBlock ? 'bg-emerald-500' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    currentLimits.autoBlock ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center gap-2 text-[11px] text-blue-200">
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              {selectedApp === 'Client'
                ? 'Les crédits gratuits se cumulent automatiquement chaque 24h pour chaque client.'
                : `Les limites configurées pour ${selectedApp} protègent le budget mensuel RodiumAI.`}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Autres applications */}
      <button
        type="button"
        onClick={nextApp}
        className="w-full bg-[#12141a] hover:bg-[#181b22] rounded-2xl p-3.5 border border-white/[0.08] flex items-center justify-between transition cursor-pointer text-left"
      >
        <div className="flex items-center gap-2.5">
          <Store className="w-5 h-5 text-emerald-400" />
          <div>
            <span className="text-xs font-black text-white block">3. Autres applications</span>
            <span className="text-[11px] text-white/55 block">Configurer les limites pour les autres applications</span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-white/40" />
      </button>

      {/* Bottom 3-Button Bar */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <button
          type="button"
          onClick={onResetAll}
          className="py-2.5 px-2 rounded-2xl bg-[#12141a] border border-white/10 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-white/10 transition cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Réinitialiser</span>
        </button>

        <button
          type="button"
          onClick={onSwitchToConsumption}
          className="py-2.5 px-2 rounded-2xl bg-[#12141a] border border-white/10 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 hover:bg-white/10 transition cursor-pointer"
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span className="truncate">Voir le rapport</span>
        </button>

        <button
          type="button"
          onClick={onSaveAll}
          className="py-2.5 px-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-black flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <Save className="w-4 h-4 shrink-0" />
          <span className="truncate">Enregistrer</span>
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// TAB 4: SURVEILLANCE ET CONTRÔLE API (IMAGE 4)
// =============================================================================

interface Tab4MonitoringProps extends SharedTabProps {
  stats: {
    successRate: number;
    failedRate: number;
    avgLatencySec: string;
    minLatencySec: string;
    maxLatencySec: string;
  };
}

export const Tab4MonitoringControl: React.FC<Tab4MonitoringProps> = ({
  provider,
  settings,
  stats,
  onChangeSettings,
  onToggleConnected,
  onTestConnection,
  isTestingConnection,
  onSync,
  onSaveAll,
  showToast
}) => {
  const [revealKeyPrefix, setRevealKeyPrefix] = useState(false);

  return (
    <div className="space-y-3 animate-in fade-in duration-150">
      {/* État de l'API */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${provider.isConnected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <span className="text-xs font-black text-white">État de l'API</span>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-[#181b22] border border-white/10 text-[10px] text-white/75 font-mono flex items-center gap-1">
            <Clock className="w-3 h-3 text-emerald-400" />
            Dernier test : {provider.lastSync}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center ${
              provider.isConnected ? 'border-emerald-500/60 bg-emerald-500/15' : 'border-rose-500/60 bg-rose-500/15'
            }`}>
              {provider.isConnected ? (
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              ) : (
                <XCircle className="w-7 h-7 text-rose-400" />
              )}
            </div>
            <div>
              <span className={`text-lg font-black block leading-tight ${provider.isConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
                {provider.isConnected ? 'Connectée' : 'Déconnectée'}
              </span>
              <span className="text-[11px] text-white/65">
                {provider.isConnected ? 'API opérationnelle' : 'API interrompue'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onTestConnection}
            disabled={isTestingConnection}
            className="px-3.5 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin' : ''}`} />
            <span>Tester la connexion</span>
          </button>
        </div>

        {/* 4 mini-metrics */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/[0.07] text-center">
          <div>
            <span className="text-[10px] text-white/55 block">Temps moy.</span>
            <span className="text-sm font-black text-purple-400 font-mono">{stats.avgLatencySec} s</span>
          </div>
          <div>
            <span className="text-[10px] text-white/55 block">Réussies</span>
            <span className="text-sm font-black text-emerald-400 font-mono">{stats.successRate}%</span>
          </div>
          <div>
            <span className="text-[10px] text-white/55 block">Échouées</span>
            <span className="text-sm font-black text-rose-400 font-mono">{stats.failedRate}%</span>
          </div>
          <div>
            <span className="text-[10px] text-white/55 block">Disponibilité</span>
            <span className="text-sm font-black text-blue-400 font-mono">{provider.isConnected ? '99.9%' : '0.0%'}</span>
          </div>
        </div>
      </div>

      {/* 1. Mode de fonctionnement de l'API */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-purple-400" />
          <div>
            <h3 className="text-xs font-black text-white">1. Mode de fonctionnement de l'API</h3>
            <p className="text-[10px] text-white/55">Choisissez le mode adapté à vos besoins</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'economy' as const, title: 'Mode Économie', desc: 'Réduit les coûts et limite les dépenses.', icon: Leaf, color: 'text-emerald-400' },
            { id: 'speed' as const, title: 'Mode Vitesse', desc: 'Privilégie les réponses rapides.', icon: Zap, color: 'text-yellow-400' },
            { id: 'balanced' as const, title: 'Mode Équilibré', desc: 'Équilibre coût et performance.', icon: Scale, color: 'text-blue-400' }
          ].map(mode => {
            const Icon = mode.icon;
            const active = settings.operatingMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => onChangeSettings({ operatingMode: mode.id })}
                className={`p-2.5 rounded-xl border text-center relative transition cursor-pointer ${
                  active
                    ? 'border-emerald-500 bg-emerald-500/15 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                    : 'bg-[#0b0c10] border-white/[0.08] hover:border-white/20'
                }`}
              >
                {active && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 absolute top-1.5 right-1.5" />
                )}
                <Icon className={`w-5 h-5 mx-auto mb-1 ${mode.color}`} />
                <span className="text-[11px] font-black text-white block leading-tight">{mode.title}</span>
                <span className="text-[9px] text-white/55 block mt-1 leading-snug">{mode.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Fréquence de vérification & 3. Contrôle de connexion */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 className="w-4 h-4 text-purple-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-xs font-black text-white truncate">2. Fréquence de vérification</h3>
            <p className="text-[10px] text-white/55 truncate">Intervalle entre chaque contrôle automatique</p>
          </div>
        </div>
        <select
          value={settings.checkInterval}
          onChange={(e) => onChangeSettings({ checkInterval: e.target.value })}
          className="px-2.5 py-1.5 rounded-xl bg-[#181b22] border border-white/10 text-xs font-semibold text-white shrink-0"
        >
          <option value="1m">Toutes les minutes</option>
          <option value="5m">Toutes les 5 minutes</option>
          <option value="15m">Toutes les 15 minutes</option>
        </select>
      </div>

      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Power className="w-4 h-4 text-blue-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-xs font-black text-white truncate">3. Contrôle de connexion</h3>
            <p className="text-[10px] text-white/55 truncate">Gérez l'état de la connexion à l'API</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onToggleConnected(false)}
            className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold cursor-pointer transition ${
              !provider.isConnected
                ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                : 'bg-[#181b22] border-rose-500/40 text-rose-300 hover:bg-rose-500/10'
            }`}
          >
            Déconnecter
          </button>
          <button
            type="button"
            onClick={() => onToggleConnected(true)}
            className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold cursor-pointer transition ${
              provider.isConnected
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                : 'bg-[#181b22] border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'
            }`}
          >
            Connecter
          </button>
        </div>
      </div>

      {/* 4. Performances et vitesse */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-yellow-400" />
          <div>
            <h3 className="text-xs font-black text-white">4. Performances et vitesse</h3>
            <p className="text-[10px] text-white/55">Suivez les performances de l'API</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded-xl bg-[#0b0c10] border border-emerald-500/30">
            <span className="text-[10px] text-white/60 block">Réponse min.</span>
            <span className="text-xs font-black text-emerald-400 font-mono">{stats.minLatencySec} s</span>
          </div>
          <div className="p-2 rounded-xl bg-[#0b0c10] border border-blue-500/30">
            <span className="text-[10px] text-white/60 block">Réponse moy.</span>
            <span className="text-xs font-black text-blue-400 font-mono">{stats.avgLatencySec} s</span>
          </div>
          <div className="p-2 rounded-xl bg-[#0b0c10] border border-yellow-500/30">
            <span className="text-[10px] text-white/60 block">Réponse max.</span>
            <span className="text-xs font-black text-yellow-400 font-mono">{stats.maxLatencySec} s</span>
          </div>
          <div className="p-2 rounded-xl bg-[#0b0c10] border border-purple-500/30">
            <span className="text-[10px] text-white/60 block">Taux réussite</span>
            <span className="text-xs font-black text-purple-300 font-mono">{stats.successRate}%</span>
          </div>
        </div>
      </div>

      {/* 5. Alertes et notifications */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-yellow-400" />
            <div>
              <h3 className="text-xs font-black text-white">5. Alertes et notifications</h3>
              <p className="text-[10px] text-white/55">Recevez des alertes en temps réel</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChangeSettings({ alertsEnabled: !settings.alertsEnabled })}
            className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
              settings.alertsEnabled ? 'bg-emerald-500' : 'bg-white/20'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                settings.alertsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1 text-[11px] text-white/80">
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Alerte de solde faible (≤ {formatFCFA(settings.minBalanceAlertFCFA)})</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Alerte de dépassement budgétaire</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Alerte de consommation anormale</div>
            <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Notification d'indisponibilité de l'API</div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#0b0c10] border border-white/[0.07] shrink-0">
            <span className="text-[10px] text-white/60 block mb-1">Mode d'alerte</span>
            <select
              value={settings.alertMode}
              onChange={(e) => onChangeSettings({ alertMode: e.target.value })}
              className="px-2 py-1 rounded-lg bg-[#181b22] border border-white/10 text-[11px] text-white font-semibold"
            >
              <option value="internal">Notifications internes</option>
              <option value="push_email">Push + Email Admin</option>
            </select>
          </div>
        </div>
      </div>

      {/* 6. Configuration des endpoints */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-blue-400" />
          <div>
            <h3 className="text-xs font-black text-white">6. Configuration des endpoints</h3>
            <p className="text-[10px] text-white/55">Points d'accès et authentification</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-white/60 block mb-1">URL de base</span>
            <div className="px-2.5 py-1.5 rounded-xl bg-[#0b0c10] border border-white/10 flex items-center justify-between gap-2">
              <span className="font-mono text-white/90 truncate">https://api.rodiumai.io/v1</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText('https://api.rodiumai.io/v1');
                  showToast('URL de base copiée');
                }}
                className="text-white/60 hover:text-white cursor-pointer shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div>
            <span className="text-white/60 block mb-1">Clé API secrète</span>
            <div className="px-2.5 py-1.5 rounded-xl bg-[#0b0c10] border border-white/10 flex items-center justify-between gap-2">
              <span className="font-mono text-white/90 tracking-wider">
                {revealKeyPrefix ? 'rk_live_•••••[MASQUÉE]' : '•••••••••••••••••••'}
              </span>
              <button
                type="button"
                onClick={() => setRevealKeyPrefix(v => !v)}
                className="text-white/60 hover:text-white cursor-pointer shrink-0"
              >
                {revealKeyPrefix ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
          <span className="px-2.5 py-1 rounded-xl bg-[#0b0c10] border border-white/10 font-mono text-blue-300">/models</span>
          <span className="px-2.5 py-1 rounded-xl bg-[#0b0c10] border border-white/10 font-mono text-purple-300">/wallet</span>
          <span className="px-2.5 py-1 rounded-xl bg-[#0b0c10] border border-white/10 font-mono text-emerald-300">/pricing</span>
          <button
            type="button"
            onClick={onTestConnection}
            className="ml-auto px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1 cursor-pointer hover:bg-emerald-500/25"
          >
            <Play className="w-3 h-3 fill-current" /> Tester les endpoints
          </button>
        </div>
      </div>

      {/* 7. Synchronisation automatique & 8. Tests et diagnostic */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-400" />
            <div>
              <h3 className="text-xs font-black text-white">7. Synchronisation automatique</h3>
              <p className="text-[10px] text-white/55">Mettez à jour automatiquement les tarifs et le solde</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChangeSettings({ autoSync: !settings.autoSync })}
            className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
              settings.autoSync ? 'bg-emerald-500' : 'bg-white/20'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                settings.autoSync ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-emerald-400 flex items-center gap-1 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" /> Dernière synchronisation : {provider.lastSync}
          </span>
          <button
            type="button"
            onClick={onSync}
            className="px-3 py-1 rounded-full bg-[#181b22] border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" /> Synchroniser
          </button>
        </div>
      </div>

      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-purple-400" />
          <div>
            <h3 className="text-xs font-black text-white">8. Tests et diagnostic</h3>
            <p className="text-[10px] text-white/55">Vérifiez le bon fonctionnement de l'API</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onTestConnection}
          className="px-3 py-1.5 rounded-full bg-[#181b22] border border-purple-500/40 text-purple-300 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer hover:bg-purple-500/15"
        >
          <Play className="w-3 h-3 fill-current" /> Lancer un diagnostic
        </button>
      </div>

      <button
        type="button"
        onClick={onSaveAll}
        className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer"
      >
        <Save className="w-4 h-4" />
        <span>Enregistrer les paramètres</span>
      </button>
    </div>
  );
};
