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
  PieChart,
  Sliders,
  AlertTriangle,
  Receipt
} from 'lucide-react';
import { formatFCFA } from '../../../services/marketServices';
import { securityService } from '../../../services/securityService';
import type { ApiProvider } from './AdminApiSection';
import type { AdminPlanItem, SubscriberProfile } from './AdminSubscriptionsManager';
import {
  type ProviderAppKey,
  type ProviderExtendedSettings,
  type ProviderNativeAppLimits,
  type ProviderOperationItem,
  type ProviderProfile,
  getProviderTransactions
} from './apiProvidersConfig';

interface SharedProviderTabProps {
  provider: ApiProvider;
  profile: ProviderProfile;
  settings: ProviderExtendedSettings;
  onChangeSettings: (next: Partial<ProviderExtendedSettings>) => void;
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

const maskSecretInput = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return '••••••••••••';
  return `${trimmed.slice(0, 4)}••••••••••••${trimmed.slice(-4)}`;
};

// =============================================================================
// PAGE 1: CONFIGURATION DES CONSO API
// =============================================================================

export const Tab1ProviderConfig: React.FC<SharedProviderTabProps> = ({
  provider,
  profile,
  settings,
  onChangeSettings,
  onToggleConnected,
  onTestConnection,
  isTestingConnection,
  onSaveAll,
  showToast
}) => {
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [draftKeyInput, setDraftKeyInput] = useState('');

  const handleSaveMaskedKey = () => {
    const masked = maskSecretInput(draftKeyInput);
    if (!masked) {
      showToast('Veuillez saisir un identifiant ou une clé valide');
      return;
    }
    const previousMasked = settings.apiKeyMasked || profile.defaultMaskedKey;
    onChangeSettings({ apiKeyMasked: masked });
    setDraftKeyInput('');
    setIsEditingKey(false);
    void securityService.recordActivity({
      category: 'api',
      actionType: 'api_key_rotated',
      action: `Rotation / modification clé API (${provider.name})`,
      target: `${profile.apiName} (${provider.id})`,
      targetType: 'settings',
      entityType: 'api_provider',
      entityId: provider.id,
      space: 'admin',
      result: 'reussi',
      severity: 'eleve',
      beforeValue: previousMasked,
      afterValue: masked,
      details: `Identifiant API modifié pour ${profile.supplierName} (clé secrète masquée)`
    });
    showToast('Clé API enregistrée et immédiatement masquée');
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-150">
      {/* 1. Informations du fournisseur */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center shrink-0">
              <Info className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
            <h3 className="text-sm font-black text-white">1. Informations du fournisseur</h3>
          </div>
          <span className="text-[10px] font-bold text-white/50 truncate">{profile.serviceType}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1.5 text-xs flex-1 min-w-0">
            <div className="grid grid-cols-[130px_1fr] gap-1 items-center">
              <span className="text-blue-400/90 font-medium">Fournisseur :</span>
              <span className="text-white font-semibold truncate">{profile.supplierName}</span>
            </div>
            <div className="grid grid-cols-[130px_1fr] gap-1 items-center">
              <span className="text-blue-400/90 font-medium">Type de service :</span>
              <span className="text-white/85 font-medium truncate">{profile.serviceType}</span>
            </div>
            <div className="grid grid-cols-[130px_1fr] gap-1 items-center">
              <span className="text-blue-400/90 font-medium">Nom de l'API :</span>
              <span className="text-white font-semibold truncate">{profile.apiName}</span>
            </div>
            <div className="grid grid-cols-[130px_1fr] gap-1 items-center">
              <span className="text-blue-400/90 font-medium">{profile.serviceIdentifierLabel} :</span>
              <span className="text-cyan-300 font-mono text-[11px] truncate">{profile.serviceIdentifierValue}</span>
            </div>
            <div className="grid grid-cols-[130px_1fr] gap-1 items-center">
              <span className="text-blue-400/90 font-medium">Adresse de l'API :</span>
              <span className="text-white/90 font-mono text-[11px] truncate">{profile.baseEndpoint}</span>
            </div>
            <div className="grid grid-cols-[130px_1fr] gap-1 items-center">
              <span className="text-white/75 font-medium">Clé / Identifiant :</span>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-white font-mono tracking-wider text-[11px] truncate">
                  {settings.apiKeyMasked || profile.defaultMaskedKey}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingKey(v => !v)}
                  className="text-[10px] font-bold text-blue-400 hover:text-blue-300 cursor-pointer shrink-0 whitespace-nowrap"
                >
                  {isEditingKey ? 'Annuler' : 'Modifier'}
                </button>
              </div>
            </div>
            {isEditingKey && (
              <div className="pt-1 flex items-center gap-1.5">
                <input
                  type="password"
                  value={draftKeyInput}
                  onChange={(e) => setDraftKeyInput(e.target.value)}
                  placeholder="Nouvelle clé ou jeton secret..."
                  className="flex-1 px-2.5 py-1.5 rounded-xl bg-[#0b0c10] border border-blue-500/40 text-xs text-white font-mono focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveMaskedKey}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 text-black text-[11px] font-black cursor-pointer shrink-0"
                >
                  Valider
                </button>
              </div>
            )}
            <div className="grid grid-cols-[130px_1fr] gap-1 items-center">
              <span className="text-white/75 font-medium">Dernière vérification :</span>
              <span className="text-white/90 font-mono text-[11px] flex items-center gap-1.5 truncate">
                <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                {provider.lastSync}
              </span>
            </div>
            <div className="grid grid-cols-[130px_1fr] gap-1 items-center">
              <span className="text-white/75 font-medium">État connexion :</span>
              <span className={`font-bold text-[11px] ${provider.isConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
                {provider.isConnected ? 'Connectée • Opérationnelle' : 'Déconnectée / Suspendue'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onTestConnection}
            disabled={isTestingConnection}
            className="px-3.5 py-3 rounded-xl bg-[#181b22] hover:bg-[#1f232c] border border-white/15 flex items-center gap-2 text-left transition cursor-pointer shrink-0 disabled:opacity-60 self-start sm:self-center"
          >
            <Zap className={`w-4 h-4 text-yellow-400 shrink-0 ${isTestingConnection ? 'animate-pulse' : ''}`} />
            <div className="leading-tight">
              <span className="text-xs font-black text-white block whitespace-nowrap">
                {isTestingConnection ? 'Test en cours...' : 'Tester'}
              </span>
              <span className="text-[10px] text-white/65 block whitespace-nowrap">la connexion</span>
            </div>
          </button>
        </div>
      </div>

      {/* 2. Configurations du service */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-3.5">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Settings className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-black text-white">2. Configurations du service ({provider.name})</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Left column: 3 configurable fields */}
          <div className="space-y-2.5 sm:border-r sm:border-white/[0.08] sm:pr-3">
            {profile.configFields.slice(0, 3).map(field => (
              <div key={field.key} className="flex items-center justify-between gap-2">
                <span className="text-white/75 font-medium truncate">{field.label}</span>
                <select
                  value={settings[field.key]}
                  onChange={(e) => onChangeSettings({ [field.key]: e.target.value })}
                  className="max-w-[165px] px-2.5 py-1.5 rounded-xl bg-[#181b22] border border-white/10 text-white font-semibold text-[11px] focus:outline-none focus:border-emerald-500"
                >
                  {field.options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Right column: activation toggle + remaining fields + timeout */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-white font-bold">API activée</span>
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
            </div>

            {profile.configFields.slice(3, 5).map(field => (
              <div key={field.key} className="flex items-center justify-between gap-2">
                <span className="text-white/75 font-medium truncate">{field.label}</span>
                <select
                  value={settings[field.key]}
                  onChange={(e) => onChangeSettings({ [field.key]: e.target.value })}
                  className="max-w-[165px] px-2.5 py-1.5 rounded-xl bg-[#181b22] border border-white/10 text-white font-semibold text-[11px] focus:outline-none focus:border-emerald-500"
                >
                  {field.options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            ))}

            <div className="flex items-center justify-between gap-2">
              <span className="text-white/75 font-medium">Délai max. (Timeout) :</span>
              <select
                value={settings.timeoutSec}
                onChange={(e) => onChangeSettings({ timeoutSec: Number(e.target.value) })}
                className="px-2.5 py-1.5 rounded-xl bg-[#181b22] border border-white/10 text-white font-mono font-semibold text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value={10}>10 s</option>
                <option value={15}>15 s</option>
                <option value={20}>20 s</option>
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
        <span>Enregistrer la configuration {provider.name}</span>
      </button>
    </div>
  );
};

// =============================================================================
// PAGE 2: TARIF ET GESTION DE SOLDE API
// =============================================================================

export const Tab2ProviderPricingBalance: React.FC<SharedProviderTabProps> = ({
  provider,
  profile,
  settings,
  onChangeSettings,
  onSync,
  onSaveAll,
  onResetAll,
  onOpenLogs,
  showToast
}) => {
  const [editingRateKey, setEditingRateKey] = useState<'rate1' | 'rate2' | 'rate3' | null>(null);
  const [editingBudgetTarget, setEditingBudgetTarget] = useState(false);

  const budgetPct = provider.budgetLimitFCFA > 0
    ? Math.min(100, Math.round((provider.costFCFA / provider.budgetLimitFCFA) * 100))
    : 0;

  const balancePct = profile.supportsLiveApiBalance && settings.targetBalanceOrBudgetFCFA > 0
    ? Math.min(100, Math.round((provider.providerBalanceFCFA / settings.targetBalanceOrBudgetFCFA) * 100))
    : 0;

  const remainingBudget = Math.max(0, provider.budgetLimitFCFA - provider.costFCFA);
  const transactions = getProviderTransactions(provider, settings);

  // Provider-specific estimated unit cost
  const avgEstimatedOpCostFCFA = (() => {
    switch (provider.id) {
      case 'api-google-maps':
        return Math.round(((settings.rate1 + settings.rate2) / 2000) * 100) / 100;
      case 'api-cloudflare-r2':
        return Math.round((settings.rate1 * 0.1 + settings.rate2 / 1000) * 100) / 100;
      case 'api-supabase':
        return Math.round(((settings.rate1 + settings.rate2) / 1000) * 100) / 100;
      case 'api-geniuspay':
        return settings.rate1;
      case 'api-fcm':
        return 0;
      case 'api-cloud-run':
        return Math.round(((settings.rate1 + settings.rate2) / 100) * 100) / 100;
      default:
        return 10;
    }
  })();

  return (
    <div className="space-y-3 animate-in fade-in duration-150">
      {/* 3. Tarification du fournisseur */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-yellow-400" />
            <h3 className="text-sm font-black text-white">3. Tarification ({provider.name})</h3>
          </div>
          {profile.supportsOfficialPricingSync ? (
            <button
              type="button"
              onClick={() => {
                onSync();
                showToast(`Grille tarifaire officielle synchronisée avec ${profile.supplierName}`);
              }}
              className="px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer hover:bg-emerald-500/25 shrink-0"
            >
              <RefreshCw className="w-3 h-3" /> Sync tarifs API
            </button>
          ) : (
            <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white/60 shrink-0">
              Grille Cloud manuelle
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          {profile.tariffFields.map(field => {
            const isEditing = editingRateKey === field.key;
            const currentVal = settings[field.key];
            return (
              <div key={field.key} className="p-3 rounded-xl bg-[#0b0c10] border border-white/[0.07] space-y-2">
                <div>
                  <span className="text-[11px] font-bold text-white/85 block leading-snug">{field.label}</span>
                  <span className="text-[10px] text-white/50 block">{field.unitHint}</span>
                </div>
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-[#181b22] border border-white/10">
                  {isEditing ? (
                    <input
                      type="number"
                      step={field.step}
                      value={currentVal}
                      onChange={(e) => onChangeSettings({ [field.key]: Math.max(0, Number(e.target.value)) })}
                      onBlur={() => setEditingRateKey(null)}
                      autoFocus
                      className="w-full bg-transparent text-yellow-400 font-black font-mono text-xs focus:outline-none"
                    />
                  ) : (
                    <span className="text-yellow-400 font-black font-mono text-xs tabular-nums">
                      {currentVal.toString().replace('.', ',')} F
                    </span>
                  )}
                  {field.editable && (
                    <button
                      type="button"
                      onClick={() => setEditingRateKey(isEditing ? null : field.key)}
                      className="text-blue-400 hover:text-blue-300 cursor-pointer shrink-0"
                      title="Modifier le tarif"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {profile.freeTierEgressNote && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-emerald-300 font-semibold">{profile.freeTierEgressNote}</span>
            <span className="px-2 py-0.5 rounded-lg bg-emerald-500 text-black font-black text-[10px] shrink-0">0 F</span>
          </div>
        )}

        <div className="p-2.5 rounded-xl bg-[#0b0c10] border border-white/[0.06] flex items-center justify-between gap-2 text-xs">
          <div className="min-w-0">
            <span className="text-white/75 font-semibold block">Coût moyen estimé par {profile.operationNoun}</span>
            <span className="text-[10px] text-white/45 block truncate">{profile.pricingSyncNote}</span>
          </div>
          <span className="text-sm font-black text-emerald-400 font-mono shrink-0 tabular-nums">
            ≈ {avgEstimatedOpCostFCFA} FCFA
          </span>
        </div>
      </div>

      {/* 4. Gestion du solde et du budget interne DJASSA */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-purple-400" />
            <h3 className="text-sm font-black text-white">4. Gestion du solde et du budget</h3>
          </div>
          <span className="text-[10px] font-mono text-white/50">Sync : {provider.lastSync}</span>
        </div>

        {/* STRICT DISTINCTION: Real Supplier Balance vs Unavailable via API */}
        {profile.supportsLiveApiBalance ? (
          <div className="p-3 rounded-xl bg-[#0b0c10] border border-emerald-500/25 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-emerald-300">{profile.balanceCardTitle}</span>
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 font-mono font-black text-xs">
                {balancePct} %
              </span>
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono tabular-nums">
              {formatFCFA(provider.providerBalanceFCFA)}
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${balancePct}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-white/65 font-mono">
              <span>0 FCFA</span>
              <span>Objectif : {formatFCFA(settings.targetBalanceOrBudgetFCFA)}</span>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-[#0b0c10] border border-amber-500/30 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-white/80">{profile.balanceCardTitle}</span>
              <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[10px] font-black shrink-0">
                Solde non disponible via API
              </span>
            </div>
            <p className="text-[11px] text-white/60 leading-relaxed">
              {profile.balanceUnavailableReason}
            </p>
          </div>
        )}

        {/* Internal DJASSA Monthly Budget Progress */}
        <div className="pt-1 border-t border-white/[0.07] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white/90">Budget interne DJASSA consommé (mensuel)</span>
            <button
              type="button"
              onClick={() => setEditingBudgetTarget(v => !v)}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3 h-3" /> Plafond autorisé
            </button>
          </div>

          {editingBudgetTarget && (
            <div className="flex items-center gap-2 p-2 rounded-xl bg-[#0b0c10] border border-blue-500/35 text-xs">
              <span className="text-white/70 shrink-0">Objectif / Plafond cible (FCFA) :</span>
              <input
                type="number"
                step={500}
                value={settings.targetBalanceOrBudgetFCFA}
                onChange={(e) => onChangeSettings({ targetBalanceOrBudgetFCFA: Math.max(1000, Number(e.target.value)) })}
                className="flex-1 px-2 py-1 rounded-lg bg-[#181b22] border border-white/10 text-white font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => { setEditingBudgetTarget(false); onSaveAll(); }}
                className="px-2.5 py-1 rounded-lg bg-emerald-500 text-black font-black text-[11px] cursor-pointer"
              >
                OK
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  budgetPct >= 85 ? 'bg-rose-500' : budgetPct >= 65 ? 'bg-amber-400' : 'bg-blue-500'
                }`}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
            <span className="px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-300 font-mono font-black text-[11px]">
              {budgetPct} %
            </span>
            <span className="text-[11px] text-white/80 font-mono shrink-0 tabular-nums">
              {provider.costFCFA.toLocaleString()} / {provider.budgetLimitFCFA.toLocaleString()} F
            </span>
          </div>

          <div className="flex justify-between text-[11px] text-white/60 font-mono">
            <span>Reste disponible (Budget interne) : <strong className="text-cyan-400">{formatFCFA(remainingBudget)}</strong></span>
            <span>Objectif : {formatFCFA(settings.targetBalanceOrBudgetFCFA)}</span>
          </div>
        </div>

        {/* 3 Threshold Cards */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.07] text-center">
          <div>
            <span className="text-[10px] text-white/55 block">Seuil min. d'alerte</span>
            <span className="text-xs font-black text-white font-mono mt-0.5 block tabular-nums">
              {formatFCFA(settings.minAlertFCFA)}
            </span>
          </div>
          <div className="border-x border-white/[0.08] px-1">
            <span className="text-[10px] text-white/55 block">
              {profile.supportsLiveApiBalance ? 'Seuil de recharge' : 'Seuil alerte provision'}
            </span>
            <span className="text-xs font-black text-white font-mono mt-0.5 block tabular-nums">
              {formatFCFA(settings.rechargeOrProvisionThresholdFCFA)}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-white/55 block">
              {profile.supportsLiveApiBalance ? 'Montant de recharge' : 'Provision mensuelle'}
            </span>
            <span className="text-xs font-black text-white font-mono mt-0.5 block tabular-nums">
              {formatFCFA(settings.rechargeOrProvisionAmountFCFA)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onSync}
          className="w-full py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>
            {profile.supportsLiveApiBalance
              ? 'Synchroniser le solde via API'
              : 'Synchroniser le suivi budgétaire interne'}
          </span>
        </button>
      </div>

      {/* 5. Historique des recharges / provisions / dépenses */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-black text-white">
              {profile.supportsLiveApiBalance
                ? '5. Historique des recharges et transactions'
                : '5. Historique des provisions et dépenses'}
            </h3>
          </div>
          <ChevronRight className="w-4 h-4 text-white/40" />
        </div>

        <div className="divide-y divide-white/[0.06]">
          {transactions.map(tx => (
            <div key={tx.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  tx.type === 'auto'
                    ? 'bg-emerald-500 text-black'
                    : tx.type === 'manual'
                    ? 'bg-blue-500 text-white'
                    : tx.type === 'invoice'
                    ? 'bg-purple-500 text-white'
                    : 'bg-rose-500 text-white'
                }`}>
                  {tx.type === 'auto' && <ArrowDown className="w-4 h-4 stroke-[2.5]" />}
                  {tx.type === 'manual' && <CreditCard className="w-3.5 h-3.5" />}
                  {tx.type === 'invoice' && <Receipt className="w-3.5 h-3.5" />}
                  {tx.type === 'failed' && <XCircle className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-white block truncate">{tx.title}</span>
                  <span className="text-[10px] text-white/50 block truncate">{tx.date} • {tx.subtitle}</span>
                </div>
              </div>

              <span className={`font-black font-mono shrink-0 tabular-nums ${
                tx.amount.startsWith('-') ? 'text-amber-300' : 'text-emerald-400'
              }`}>
                {tx.amount}
              </span>

              <div className="text-right shrink-0">
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                  tx.status === 'Réussie' || tx.status === 'Validée'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/35'
                    : 'bg-rose-500/15 text-rose-400 border-rose-500/35'
                }`}>
                  {tx.status}
                </span>
                <span className="text-[10px] text-white/60 font-mono block mt-0.5">
                  {tx.afterLabel}
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
          <RotateCcw className="w-4 h-4 shrink-0" />
          <span className="truncate">Réinitialiser</span>
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
// PAGE 3: CONFIGURATION DES APPLICATIONS (ADAPTED TO PROVIDER NATIVE QUOTAS)
// =============================================================================

interface Tab3ProviderAppsProps extends SharedProviderTabProps {
  realPlans: AdminPlanItem[];
  subscribers: SubscriberProfile[];
  operations: ProviderOperationItem[];
  appLimits: Record<ProviderAppKey, ProviderNativeAppLimits>;
  onUpdateAppLimit: (app: ProviderAppKey, patch: Partial<ProviderNativeAppLimits>) => void;
}

const getPlanNativeQuotaForProvider = (
  plan: AdminPlanItem,
  providerId: string
): { quota: number; unit: string; dailyLimit: number; monthlyLimit: number } => {
  if (providerId === 'api-google-maps') {
    if (plan.appType === 'seller') {
      const q = plan.id === 'vendeur_elite' ? 200 : plan.id === 'vendeur_pro' ? 100 : 40;
      return { quota: q, unit: 'géocodages', dailyLimit: Math.max(2, Math.round(q / 25)), monthlyLimit: q };
    }
    const q = plan.id === 'premium' ? 120 : plan.id === 'plus' ? 60 : 30;
    return { quota: q, unit: 'affichages carte', dailyLimit: Math.max(2, Math.round(q / 20)), monthlyLimit: q };
  }

  if (providerId === 'api-cloudflare-r2') {
    if (plan.appType === 'seller') {
      const q = plan.id === 'vendeur_elite' ? 30 : plan.id === 'vendeur_pro' ? 15 : 5;
      return { quota: q, unit: 'Go stockage', dailyLimit: Math.round(q * 150), monthlyLimit: q * 1024 };
    }
    const q = plan.id === 'premium' ? 25 : plan.id === 'plus' ? 15 : 5;
    return { quota: q, unit: 'Go CDN/mois', dailyLimit: q * 80, monthlyLimit: q * 1024 };
  }

  if (providerId === 'api-supabase') {
    if (plan.appType === 'seller') {
      const q = plan.id === 'vendeur_elite' ? 50000 : plan.id === 'vendeur_pro' ? 25000 : 10000;
      return { quota: q, unit: 'lectures/écrit. SQL', dailyLimit: Math.round(q / 25), monthlyLimit: q };
    }
    const q = plan.id === 'premium' ? 50000 : plan.id === 'plus' ? 25000 : 15000;
    return { quota: q, unit: 'requêtes SQL/mois', dailyLimit: Math.round(q / 30), monthlyLimit: q };
  }

  if (providerId === 'api-geniuspay') {
    if (plan.appType === 'seller') {
      const q = plan.id === 'vendeur_elite' ? 120 : plan.id === 'vendeur_pro' ? 60 : 25;
      return { quota: q, unit: 'encaissements/mois', dailyLimit: Math.max(2, Math.round(q / 20)), monthlyLimit: q };
    }
    const q = plan.id === 'premium' ? 60 : plan.id === 'plus' ? 30 : 20;
    return { quota: q, unit: 'paiements/mois', dailyLimit: Math.max(2, Math.round(q / 15)), monthlyLimit: q };
  }

  if (providerId === 'api-fcm') {
    return { quota: 5000, unit: 'push FCM/mois', dailyLimit: 250, monthlyLimit: 5000 };
  }

  // Google Cloud Run
  if (plan.appType === 'seller') {
    const q = plan.id === 'vendeur_elite' ? 2500 : plan.id === 'vendeur_pro' ? 1500 : 700;
    return { quota: q, unit: 'exécutions/mois', dailyLimit: Math.round(q / 25), monthlyLimit: q };
  }
  const q = plan.id === 'premium' ? 1500 : plan.id === 'plus' ? 900 : 500;
  return { quota: q, unit: 'requêtes API/mois', dailyLimit: Math.round(q / 25), monthlyLimit: q };
};

export const Tab3ProviderConfigApps: React.FC<Tab3ProviderAppsProps> = ({
  provider,
  profile,
  realPlans,
  subscribers,
  operations,
  appLimits,
  onUpdateAppLimit,
  onSaveAll,
  onResetAll,
  onSwitchToConsumption,
  showToast
}) => {
  const [selectedApp, setSelectedApp] = useState<ProviderAppKey>('Client');
  const [editingLimitKey, setEditingLimitKey] = useState<keyof ProviderNativeAppLimits | null>(null);

  const currentLimits = appLimits[selectedApp];
  const plansForApp = realPlans.filter(p => {
    if (selectedApp === 'Client') return p.appType === 'client';
    if (selectedApp === 'Vendeur') return p.appType === 'seller';
    return false;
  });

  const appTabs: Array<{ key: ProviderAppKey; label: string; icon: React.ComponentType<{ className?: string }>; iconColor: string }> = [
    { key: 'Client', label: 'Client', icon: UserIcon, iconColor: 'text-purple-400' },
    { key: 'Vendeur', label: 'Vendeur', icon: Store, iconColor: 'text-blue-400' },
    { key: 'Admin', label: 'Admin', icon: Shield, iconColor: 'text-amber-400' }
  ];

  const appLabelFull: Record<ProviderAppKey, ProviderOperationItem['app']> = {
    Client: 'Client',
    Vendeur: 'Vendeur',
    Admin: 'Administrateur'
  };

  const nextApp = () => {
    const idx = appTabs.findIndex(a => a.key === selectedApp);
    setSelectedApp(appTabs[(idx + 1) % appTabs.length].key);
  };

  const totalActiveSubscribers = subscribers.filter(s => s.status === 'active').length;
  const remainingInternalBudget = Math.max(0, provider.budgetLimitFCFA - provider.costFCFA);

  // Free Plan consumption derived from operations
  const freeClientOps = operations.filter(op => op.app === 'Client' && op.subscriptionName === 'Plan gratuit');
  const freeConsumedNative = freeClientOps.reduce((sum, op) => sum + op.primaryQty, 0);
  const freeCostFCFA = Math.round(freeClientOps.reduce((sum, op) => sum + op.realCostFCFA, 0) * 100) / 100;

  return (
    <div className="space-y-3 animate-in fade-in duration-150">
      {/* Vue d'ensemble */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-purple-400" />
          <h3 className="text-sm font-black text-white">Vue d'ensemble ({provider.name})</h3>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center pt-1">
          <div className="border-r border-white/[0.08]">
            <span className="text-base font-black text-white block font-mono">3</span>
            <span className="text-[10px] text-white/55 block">Applications</span>
          </div>
          <div className="border-r border-white/[0.08]">
            <span className="text-sm font-black text-white block font-mono tabular-nums">
              {profile.supportsLiveApiBalance
                ? provider.providerBalanceFCFA.toLocaleString()
                : remainingInternalBudget.toLocaleString()}
            </span>
            <span className="text-[10px] text-white/55 block">
              {profile.supportsLiveApiBalance ? 'FCFA Solde' : 'FCFA Budget rest.'}
            </span>
          </div>
          <div className="border-r border-white/[0.08]">
            <span className="text-sm font-black text-white block font-mono">{provider.consumptionPercent}%</span>
            <span className="text-[10px] text-white/55 block">Conso budget</span>
          </div>
          <div>
            <span className="text-base font-black text-white block font-mono">{totalActiveSubscribers}</span>
            <span className="text-[10px] text-white/55 block">Abonnés actifs</span>
          </div>
        </div>
      </div>

      {/* 1. Sélection de l'application */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-400" />
          <div>
            <h3 className="text-sm font-black text-white">1. Sélection de l'application</h3>
            <p className="text-[11px] text-white/55">Choisissez une application pour contrôler ses quotas {provider.name}</p>
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

      {/* 2. Détail de l'application */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-3.5">
        <div className="flex items-center gap-2.5">
          <UserIcon className="w-6 h-6 text-purple-400" />
          <div>
            <h3 className="text-sm font-black text-white">2. Application {appLabelFull[selectedApp]}</h3>
            <p className="text-[11px] text-white/55">Quotas natifs {provider.name} par formule d'abonnement DJASSA</p>
          </div>
        </div>

        {/* Client Plan Gratuit Card (10 crédits cumulables toutes les 24h, jamais perdus) */}
        {selectedApp === 'Client' && (
          <div className="p-3 rounded-2xl bg-[#0b0c10] border border-white/[0.08] space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-500 text-black font-black text-[10px]">
                  Plan Gratuit Client
                </span>
                <div className="text-xl font-black text-emerald-400 font-mono">10 crédits / 24h</div>
                <span className="text-[11px] text-emerald-400/90 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Cumulables automatiquement sans remise à zéro
                </span>
              </div>
              <div className="space-y-1 text-[11px] text-white/80 sm:border-l sm:border-white/[0.07] sm:pl-3">
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> 10 crédits ajoutés toutes les 24h</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Solde existant jamais effacé</div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Blocage auto si plafond {provider.name} atteint</div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-white/[0.06] text-center text-[10px]">
              <div>
                <span className="text-white/45 block">Consommé</span>
                <span className="font-mono font-black text-cyan-300">{freeConsumedNative.toLocaleString()} {profile.nativeUnitPlural}</span>
              </div>
              <div>
                <span className="text-white/45 block">Coût réel</span>
                <span className="font-mono font-black text-yellow-400">{freeCostFCFA} F</span>
              </div>
              <div>
                <span className="text-white/45 block">Limite / jour</span>
                <span className="font-mono font-black text-white">10 u/user</span>
              </div>
              <div>
                <span className="text-white/45 block">Limite / mois</span>
                <span className="font-mono font-black text-white">300 u/user</span>
              </div>
            </div>
          </div>
        )}

        {/* Paid Subscription Formulas (Client, Vendeur) */}
        {plansForApp.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-black text-white">
              <Crown className="w-4 h-4 text-yellow-400" />
              <span>Abonnements disponibles ({plansForApp.length})</span>
            </div>

            <div className="space-y-2">
              {plansForApp.map(plan => {
                const quotaInfo = getPlanNativeQuotaForProvider(plan, provider.id);
                const planOps = operations.filter(
                  op => op.app === appLabelFull[selectedApp] && op.subscriptionName === plan.name
                );
                const planConsumed = planOps.reduce((s, o) => s + o.primaryQty, 0);
                const planCost = Math.round(planOps.reduce((s, o) => s + o.realCostFCFA, 0) * 100) / 100;
                const activeUsers = Math.max(
                  subscribers.filter(s => s.planName === plan.name && s.status === 'active').length,
                  new Set(planOps.map(o => o.userId)).size
                );
                const pct = quotaInfo.quota > 0
                  ? Math.min(100, Math.round((planConsumed / quotaInfo.quota) * 100))
                  : 0;
                const remainingQuota = Math.max(0, quotaInfo.quota - planConsumed);

                return (
                  <div
                    key={plan.id}
                    className="p-3 rounded-xl bg-[#0b0c10] border border-white/[0.08] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-xs font-black text-white block truncate">{plan.name}</span>
                        <span className="text-[10px] text-white/55 font-mono">
                          {plan.priceFcfa.toLocaleString()} FCFA / mois • {activeUsers} utilisateurs actifs
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-[10px] font-bold">
                          {pct}%
                        </span>
                        <button
                          type="button"
                          onClick={() => showToast(`Quota ${plan.name} (${quotaInfo.quota.toLocaleString()} ${quotaInfo.unit}) actif`)}
                          className="px-2.5 py-1 rounded-lg bg-[#181b22] hover:bg-white/10 border border-white/15 text-[10px] font-bold text-white flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" /> Configurer
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-2 border-t border-white/[0.06] text-[10px]">
                      <div>
                        <span className="text-white/45 block">Quota</span>
                        <span className="font-mono font-bold text-white">{quotaInfo.quota.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-white/45 block">Consommé</span>
                        <span className="font-mono font-bold text-cyan-300">{planConsumed.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-white/45 block">Restant</span>
                        <span className="font-mono font-bold text-emerald-400">{remainingQuota.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-white/45 block">Coût réel</span>
                        <span className="font-mono font-bold text-yellow-400">{planCost} F</span>
                      </div>
                      <div>
                        <span className="text-white/45 block">Lim. jour</span>
                        <span className="font-mono font-bold text-white/80">{quotaInfo.dailyLimit.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-white/45 block">Lim. mois</span>
                        <span className="font-mono font-bold text-white/80">{quotaInfo.monthlyLimit.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Operational Quotas for Administrateur */}
        {selectedApp === 'Admin' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-black text-white">
              <Crown className="w-4 h-4 text-cyan-400" />
              <span>Profils opérationnels {selectedApp} ({profile.extraRolePlans[selectedApp].length})</span>
            </div>

            <div className="space-y-2">
              {profile.extraRolePlans[selectedApp].map(rolePlan => {
                const remaining = Math.max(0, rolePlan.nativeQuota - rolePlan.consumedNative);
                const pct = rolePlan.nativeQuota > 0
                  ? Math.min(100, Math.round((rolePlan.consumedNative / rolePlan.nativeQuota) * 100))
                  : 0;

                return (
                  <div key={rolePlan.id} className="p-3 rounded-xl bg-[#0b0c10] border border-white/[0.08] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-xs font-black text-white block truncate">{rolePlan.name}</span>
                        <span className="text-[10px] text-white/55 font-mono">
                          {rolePlan.badge} • {rolePlan.priceLabel} • {rolePlan.activeUsers} actifs
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-[10px] font-bold shrink-0">
                        {pct}%
                      </span>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-2 border-t border-white/[0.06] text-[10px]">
                      <div>
                        <span className="text-white/45 block">Quota</span>
                        <span className="font-mono font-bold text-white">{rolePlan.nativeQuota.toLocaleString()} {rolePlan.nativeUnit}</span>
                      </div>
                      <div>
                        <span className="text-white/45 block">Consommé</span>
                        <span className="font-mono font-bold text-cyan-300">{rolePlan.consumedNative.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-white/45 block">Restant</span>
                        <span className="font-mono font-bold text-emerald-400">{remaining.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-white/45 block">Coût réel</span>
                        <span className="font-mono font-bold text-yellow-400">{rolePlan.realCostFCFA} F</span>
                      </div>
                      <div>
                        <span className="text-white/45 block">Lim. jour</span>
                        <span className="font-mono font-bold text-white/80">{rolePlan.dailyLimit.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-white/45 block">Lim. mois</span>
                        <span className="font-mono font-bold text-white/80">{rolePlan.monthlyLimit.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Limites de consommation (Provider-Native Units) */}
        <div className="space-y-2 pt-2 border-t border-white/[0.07]">
          <div className="flex items-center gap-2 text-xs font-black text-white">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <span>Limites de consommation ({selectedApp})</span>
          </div>

          <div className="space-y-2 text-xs">
            {[
              { key: 'dailyBudgetFCFA' as const, label: 'Budget journalier maximum', suffix: 'FCFA', icon: Calendar, color: 'text-blue-400' },
              { key: 'monthlyBudgetFCFA' as const, label: 'Budget mensuel maximum', suffix: 'FCFA', icon: Calendar, color: 'text-cyan-400' },
              { key: 'maxOpsPerDay' as const, label: `Max ${profile.nativeUnitPlural} par jour`, suffix: profile.nativeUnitPlural, icon: Play, color: 'text-blue-400' },
              { key: 'maxOpsPerUser' as const, label: `Max ${profile.nativeUnitPlural} par utilisateur`, suffix: profile.nativeUnitPlural, icon: Users, color: 'text-blue-400' },
              { key: 'subLimitUnits' as const, label: 'Limite par formule / abonnement', suffix: profile.nativeUnitPlural, icon: PieChart, color: 'text-cyan-400' }
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
                      className="w-32 px-3 py-1 rounded-xl bg-[#181b22] border border-purple-500 text-right font-mono font-bold text-white text-xs focus:outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingLimitKey(row.key)}
                      className="px-3 py-1 rounded-xl bg-[#181b22] hover:bg-white/10 border border-white/10 font-mono font-bold text-white text-xs shrink-0 cursor-pointer tabular-nums"
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
                ? `Les 10 crédits gratuits se cumulent toutes les 24h sans perte pour chaque client tout en respectant le plafond ${provider.name}.`
                : `Ces plafonds natifs (${profile.nativeUnitPlural}) protègent le budget mensuel DJASSA sur ${provider.name}.`}
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
            <span className="text-xs font-black text-white block">3. Passer à l'application suivante</span>
            <span className="text-[11px] text-white/55 block">Configurer Client, Vendeur et Administrateur</span>
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
          <RotateCcw className="w-4 h-4 shrink-0" />
          <span className="truncate">Réinitialiser</span>
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
// PAGE 4: SURVEILLANCE ET CONTRÔLE API
// =============================================================================

interface Tab4ProviderMonitoringProps extends SharedProviderTabProps {
  stats: {
    total: number;
    success: number;
    failed: number;
    successRate: number;
    failedRate: number;
    avgLatencySec: string;
    minLatencySec: string;
    maxLatencySec: string;
  };
}

export const Tab4ProviderMonitoring: React.FC<Tab4ProviderMonitoringProps> = ({
  provider,
  profile,
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

  const isBudgetHigh = provider.consumptionPercent >= 80;
  const isLowBalance = profile.supportsLiveApiBalance && provider.providerBalanceFCFA <= settings.minAlertFCFA;
  const isAbnormalUsage = stats.failed >= 2 || isBudgetHigh;

  const modeIcon = (id: ProviderProfile['operatingModes'][number]['id']) => {
    if (id === 'economy') return { icon: Leaf, color: 'text-emerald-400' };
    if (id === 'speed') return { icon: Zap, color: 'text-yellow-400' };
    if (id === 'manual') return { icon: Sliders, color: 'text-purple-400' };
    return { icon: Scale, color: 'text-blue-400' };
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-150">
      {/* État de l'API */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${provider.isConnected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <span className="text-xs font-black text-white">État de l'API ({provider.name})</span>
          </div>
          <span className="px-2.5 py-1 rounded-xl bg-[#181b22] border border-white/10 text-[10px] text-white/75 font-mono flex items-center gap-1">
            <Clock className="w-3 h-3 text-emerald-400" />
            Vérifié : {provider.lastSync}
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
                {provider.isConnected ? 'Service opérationnel en temps réel' : 'Service interrompu par l\'admin'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onTestConnection}
            disabled={isTestingConnection}
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin' : ''}`} />
            <span>Tester</span>
          </button>
        </div>

        {/* Live Alerts Banner */}
        {(isBudgetHigh || isLowBalance || isAbnormalUsage) && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/35 flex items-start gap-2 text-[11px] text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              {isLowBalance && <p className="font-bold">Alerte solde faible : solde prépayé ≤ {formatFCFA(settings.minAlertFCFA)}.</p>}
              {isBudgetHigh && <p className="font-bold">Alerte dépassement budgétaire : {provider.consumptionPercent}% du plafond mensuel consommé.</p>}
              {stats.failed >= 2 && <p>Alerte consommation anormale : {stats.failed} opérations échouées détectées sur la période.</p>}
            </div>
          </div>
        )}

        {/* 4 mini-metrics */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/[0.07] text-center">
          <div>
            <span className="text-[10px] text-white/55 block">Temps moy.</span>
            <span className="text-sm font-black text-purple-400 font-mono">{stats.avgLatencySec} s</span>
          </div>
          <div>
            <span className="text-[10px] text-white/55 block">Réussies ({stats.success})</span>
            <span className="text-sm font-black text-emerald-400 font-mono">{stats.successRate}%</span>
          </div>
          <div>
            <span className="text-[10px] text-white/55 block">Échouées ({stats.failed})</span>
            <span className="text-sm font-black text-rose-400 font-mono">{stats.failedRate}%</span>
          </div>
          <div>
            <span className="text-[10px] text-white/55 block">Disponibilité</span>
            <span className="text-sm font-black text-blue-400 font-mono">{provider.isConnected ? '99.9%' : '0.0%'}</span>
          </div>
        </div>
      </div>

      {/* 1. Mode de fonctionnement adapté au fournisseur */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-purple-400" />
          <div>
            <h3 className="text-xs font-black text-white">1. Mode de fonctionnement ({provider.name})</h3>
            <p className="text-[10px] text-white/55">Modes techniques réellement applicables à ce service</p>
          </div>
        </div>

        <div className={`grid gap-2 ${profile.operatingModes.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
          {profile.operatingModes.map(mode => {
            const { icon: Icon, color } = modeIcon(mode.id);
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
                <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
                <span className="text-[11px] font-black text-white block leading-tight">{mode.title}</span>
                <span className="text-[9px] text-white/55 block mt-1 leading-snug">{mode.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Fréquence de vérification */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 className="w-4 h-4 text-purple-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-xs font-black text-white truncate">2. Fréquence de vérification automatique</h3>
            <p className="text-[10px] text-white/55 truncate">Intervalle des pings de disponibilité</p>
          </div>
        </div>
        <select
          value={settings.checkInterval}
          onChange={(e) => onChangeSettings({ checkInterval: e.target.value as '1m' | '5m' | '15m' })}
          className="px-2.5 py-1.5 rounded-xl bg-[#181b22] border border-white/10 text-xs font-semibold text-white shrink-0"
        >
          <option value="1m">Toutes les minutes</option>
          <option value="5m">Toutes les 5 minutes</option>
          <option value="15m">Toutes les 15 minutes</option>
        </select>
      </div>

      {/* 3. Contrôle de connexion & Activation */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Power className="w-4 h-4 text-blue-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-xs font-black text-white truncate">3. Contrôle d'activation du service</h3>
            <p className="text-[10px] text-white/55 truncate">Activer ou suspendre immédiatement l'API</p>
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
            Désactiver
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
            Activer
          </button>
        </div>
      </div>

      {/* 4. Performances et vitesse */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-yellow-400" />
          <div>
            <h3 className="text-xs font-black text-white">4. Performances et latence</h3>
            <p className="text-[10px] text-white/55">Mesures relevées sur {stats.total} opérations</p>
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
              <h3 className="text-xs font-black text-white">5. Alertes et notifications configurables</h3>
              <p className="text-[10px] text-white/55">Supervision proactive des anomalies</p>
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

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1.5 text-[11px] text-white/85">
            {profile.supportsLiveApiBalance && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.lowBalanceAlertEnabled}
                  onChange={(e) => onChangeSettings({ lowBalanceAlertEnabled: e.target.checked })}
                  className="accent-emerald-500"
                />
                <span>Alerte solde prépayé faible (≤ {formatFCFA(settings.minAlertFCFA)})</span>
              </label>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.budgetOverrunAlertEnabled}
                onChange={(e) => onChangeSettings({ budgetOverrunAlertEnabled: e.target.checked })}
                className="accent-emerald-500"
              />
              <span>Alerte de dépassement budgétaire DJASSA</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.abnormalAlertEnabled}
                onChange={(e) => onChangeSettings({ abnormalAlertEnabled: e.target.checked })}
                className="accent-emerald-500"
              />
              <span>Alerte de consommation anormale / pic d'erreurs</span>
            </label>
          </div>

          <div className="p-2.5 rounded-xl bg-[#0b0c10] border border-white/[0.07] shrink-0">
            <span className="text-[10px] text-white/60 block mb-1">Canal de notification</span>
            <select
              value={settings.alertMode}
              onChange={(e) => onChangeSettings({ alertMode: e.target.value as 'internal' | 'push_email' })}
              className="px-2 py-1 rounded-lg bg-[#181b22] border border-white/10 text-[11px] text-white font-semibold"
            >
              <option value="internal">Notifications internes Admin</option>
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
            <h3 className="text-xs font-black text-white">6. Endpoints configurés ({provider.name})</h3>
            <p className="text-[10px] text-white/55">Points d'accès et authentification sécurisée</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-white/60 block mb-1">URL de base</span>
            <div className="px-2.5 py-1.5 rounded-xl bg-[#0b0c10] border border-white/10 flex items-center justify-between gap-2">
              <span className="font-mono text-white/90 truncate">{profile.baseEndpoint}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(profile.baseEndpoint);
                  showToast('URL de base copiée');
                }}
                className="text-white/60 hover:text-white cursor-pointer shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div>
            <span className="text-white/60 block mb-1">Clé / Jeton secret</span>
            <div className="px-2.5 py-1.5 rounded-xl bg-[#0b0c10] border border-white/10 flex items-center justify-between gap-2">
              <span className="font-mono text-white/90 tracking-wider truncate">
                {revealKeyPrefix ? settings.apiKeyMasked : '••••••••••••••••••••'}
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
          {profile.endpointPills.map((pill, idx) => (
            <span
              key={pill}
              className={`px-2.5 py-1 rounded-xl bg-[#0b0c10] border border-white/10 font-mono ${
                idx === 0 ? 'text-blue-300' : idx === 1 ? 'text-purple-300' : 'text-emerald-300'
              }`}
            >
              {pill}
            </span>
          ))}
          <button
            type="button"
            onClick={onTestConnection}
            className="ml-auto px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1 cursor-pointer hover:bg-emerald-500/25"
          >
            <Play className="w-3 h-3 fill-current" /> Tester endpoints
          </button>
        </div>
      </div>

      {/* 7. Synchronisation automatique & 8. Diagnostic technique */}
      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-400" />
            <div>
              <h3 className="text-xs font-black text-white">7. Synchronisation automatique</h3>
              <p className="text-[10px] text-white/55">
                {profile.supportsLiveApiBalance
                  ? 'Mise à jour auto du solde et des consommations'
                  : 'Mise à jour auto des métriques budgétaires DJASSA'}
              </p>
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
          <span className="text-emerald-400 flex items-center gap-1 font-mono truncate">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Dernière sync : {provider.lastSync}
          </span>
          <button
            type="button"
            onClick={onSync}
            className="px-3 py-1 rounded-xl bg-[#181b22] border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1 cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3 h-3" /> Synchroniser
          </button>
        </div>
      </div>

      <div className="bg-[#12141a] rounded-2xl p-4 border border-white/[0.08] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-purple-400" />
          <div>
            <h3 className="text-xs font-black text-white">8. Diagnostic technique</h3>
            <p className="text-[10px] text-white/55">Vérification latence, authentification et endpoints</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onTestConnection}
          className="px-3 py-1.5 rounded-xl bg-[#181b22] border border-purple-500/40 text-purple-300 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer hover:bg-purple-500/15 shrink-0"
        >
          <Play className="w-3 h-3 fill-current" /> Lancer diagnostic
        </button>
      </div>

      <button
        type="button"
        onClick={onSaveAll}
        className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center justify-center gap-2 transition cursor-pointer"
      >
        <Save className="w-4 h-4" />
        <span>Enregistrer les paramètres de surveillance</span>
      </button>
    </div>
  );
};
