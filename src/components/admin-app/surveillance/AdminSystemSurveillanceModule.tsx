import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Eye,
  FileText,
  Filter,
  History,
  KeyRound,
  Layers,
  RefreshCw,
  Search,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  Wrench,
  X,
  XCircle
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { systemSurveillanceService } from '../../../services/systemSurveillanceService';
import { securityService, type SecurityApiError } from '../../../services/securityService';
import type {
  AnomalySeverity,
  AnomalyStatus,
  DetectedAnomalyRecord,
  SurveillancePermissionKey,
  SystemGlobalState,
  SystemSurveillanceOverviewResponse,
  TechnicalLogEntry
} from '../../../types/systemSurveillance';
import type { ServiceHealthStatus } from '../../../types/maintenance';

type SectionKey =
  | 'overview'
  | 'apps'
  | 'services'
  | 'anomalies'
  | 'alerts'
  | 'logs'
  | 'incidents'
  | 'settings';

interface AdminSystemSurveillanceModuleProps {
  onOpenMaintenance?: () => void;
  onOpenNotifications?: () => void;
  onOpenAudit?: () => void;
}

const SECTION_NAV: Array<{ id: SectionKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Vue générale', icon: Activity },
  { id: 'apps', label: 'Applications DJASSA', icon: Layers },
  { id: 'services', label: 'Services & fournisseurs', icon: Server },
  { id: 'anomalies', label: 'Anomalies détectées', icon: AlertTriangle },
  { id: 'alerts', label: 'Alertes techniques', icon: Bell },
  { id: 'logs', label: 'Journaux techniques', icon: FileText },
  { id: 'incidents', label: 'Historique incidents', icon: History },
  { id: 'settings', label: 'Paramètres', icon: Settings }
];

const SURV_PERMISSION_LABELS: Record<SurveillancePermissionKey, { label: string; desc: string }> = {
  viewSurveillance: { label: 'Consulter la surveillance', desc: 'Accès aux tableaux de bord, sondes et journaux techniques' },
  runManualChecks: { label: 'Relancer un contrôle', desc: 'Exécution manuelle des vérifications de disponibilité' },
  manageAnomalies: { label: 'Gérer les anomalies', desc: 'Prise en charge, commentaires, résolution et acquittement d’alertes' },
  modifySurveillanceSettings: { label: 'Configurer la surveillance', desc: 'Modification de la fréquence et des seuils d’alerte (MFA)' }
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return 'Jamais';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function globalStateBadge(state: SystemGlobalState | 'maintenance'): { label: string; dot: string; cls: string } {
  switch (state) {
    case 'operationnel':
      return { label: 'Opérationnel', dot: 'bg-emerald-400', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    case 'degrade':
      return { label: 'Dégradé', dot: 'bg-amber-400', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    case 'en_panne':
      return { label: 'En panne', dot: 'bg-rose-400', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
    case 'maintenance':
      return { label: 'Maintenance', dot: 'bg-sky-400', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
    case 'non_verifie':
      return { label: 'Non vérifié', dot: 'bg-white/40', cls: 'bg-white/10 text-white/60 border-white/15' };
  }
}

function serviceBadge(status: ServiceHealthStatus): { label: string; dot: string; cls: string } {
  switch (status) {
    case 'operationnel':
      return { label: 'Opérationnel', dot: 'bg-emerald-400', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    case 'degrade':
      return { label: 'Dégradé', dot: 'bg-amber-400', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    case 'indisponible':
      return { label: 'Indisponible', dot: 'bg-rose-400', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
    case 'maintenance':
      return { label: 'Maintenance', dot: 'bg-sky-400', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
    case 'non_verifie':
      return { label: 'Non configuré / Non vérifié', dot: 'bg-white/40', cls: 'bg-white/10 text-white/60 border-white/15' };
  }
}

function severityBadge(sev: AnomalySeverity): { label: string; cls: string } {
  switch (sev) {
    case 'critique':
      return { label: 'Critique', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
    case 'avertissement':
      return { label: 'Avertissement', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    case 'information':
      return { label: 'Information', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
  }
}

function anomalyStatusBadge(st: AnomalyStatus): { label: string; cls: string } {
  switch (st) {
    case 'nouvelle':
      return { label: 'Nouvelle', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
    case 'en_cours':
      return { label: 'En cours', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    case 'non_resolue':
      return { label: 'Non résolue', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' };
    case 'resolue':
      return { label: 'Résolue', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
  }
}

export const AdminSystemSurveillanceModule: React.FC<AdminSystemSurveillanceModuleProps> = ({
  onOpenMaintenance,
  onOpenNotifications,
  onOpenAudit
}) => {
  const { showToast } = useApp();
  const [section, setSection] = useState<SectionKey>('overview');
  const [data, setData] = useState<SystemSurveillanceOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningProbe, setRunningProbe] = useState(false);

  // Selected anomaly inspection
  const [selectedAnomaly, setSelectedAnomaly] = useState<DetectedAnomalyRecord | null>(null);
  const [anomalyComment, setAnomalyComment] = useState('');
  const [updatingAnomaly, setUpdatingAnomaly] = useState(false);

  // Logs filter state
  const [logSearch, setLogSearch] = useState('');
  const [logAppFilter, setLogAppFilter] = useState('all_filter');
  const [logServiceFilter, setLogServiceFilter] = useState('all');
  const [logSeverityFilter, setLogSeverityFilter] = useState('all');
  const [logStatusFilter, setLogStatusFilter] = useState('all');
  const [logDateFrom, setLogDateFrom] = useState('');
  const [logDateTo, setLogDateTo] = useState('');
  const [filteredLogs, setFilteredLogs] = useState<TechnicalLogEntry[] | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Settings form state
  const [setAutoEnabled, setSetAutoEnabled] = useState(true);
  const [setIntervalSec, setSetIntervalSec] = useState(180);
  const [setLatencyWarn, setSetLatencyWarn] = useState(1200);
  const [setLatencyCrit, setSetLatencyCrit] = useState(3000);
  const [setErrThreshold, setSetErrThreshold] = useState(5);
  const [setMemWarn, setSetMemWarn] = useState(88);
  const [setAuthThreshold, setSetAuthThreshold] = useState(8);
  const [setNotifyCrit, setSetNotifyCrit] = useState(true);
  const [setNotifyWarn, setSetNotifyWarn] = useState(true);

  // MFA Modal
  const [mfaPrompt, setMfaPrompt] = useState<{
    title: string;
    description: string;
    previewCode?: string;
    onVerified: (code: string) => Promise<void>;
  } | null>(null);
  const [mfaInput, setMfaInput] = useState('');
  const [mfaSubmitting, setMfaSubmitting] = useState(false);

  const loadData = useCallback(async (probe = false) => {
    try {
      const res = await systemSurveillanceService.getOverview(probe);
      setData(res);
      setSetAutoEnabled(res.settings.autoCheckEnabled);
      setSetIntervalSec(res.settings.checkIntervalSeconds);
      setSetLatencyWarn(res.settings.latencyWarnMs);
      setSetLatencyCrit(res.settings.latencyCriticalMs);
      setSetErrThreshold(res.settings.errorSpikeThreshold);
      setSetMemWarn(res.settings.memoryWarnPercent);
      setSetAuthThreshold(res.settings.authFailureSpikeThreshold);
      setSetNotifyCrit(res.settings.notifyOnCritical);
      setSetNotifyWarn(res.settings.notifyOnWarning);
    } catch (err) {
      showToast((err as Error)?.message || 'Erreur chargement surveillance système');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  const requestMfaChallenge = async (
    title: string,
    description: string,
    onVerified: (code: string) => Promise<void>
  ) => {
    try {
      const challenge = await securityService.requestMfaChallenge();
      setMfaInput('');
      setMfaPrompt({
        title,
        description,
        previewCode: challenge.verificationCodePreview,
        onVerified
      });
    } catch (err) {
      showToast((err as Error)?.message || 'Impossible de lancer le contrôle MFA');
    }
  };

  const handleRunManualProbe = async () => {
    setRunningProbe(true);
    try {
      const res = await systemSurveillanceService.runManualCheck();
      setData(res);
      showToast('Vérification technique en direct terminée');
    } catch (err) {
      showToast((err as Error)?.message || 'Échec du contrôle technique');
    } finally {
      setRunningProbe(false);
    }
  };

  const handleUpdateAnomaly = async (id: string, status?: AnomalyStatus, takeOwnership = false) => {
    setUpdatingAnomaly(true);
    try {
      const res = await systemSurveillanceService.updateAnomaly(id, {
        status,
        comment: anomalyComment.trim() || undefined,
        takeOwnership
      });
      setSelectedAnomaly(res.anomaly);
      setAnomalyComment('');
      showToast(`Anomalie mise à jour (${res.anomaly.status})`);
      await loadData(false);
    } catch (err) {
      showToast((err as Error)?.message || 'Impossible de modifier cette anomalie');
    } finally {
      setUpdatingAnomaly(false);
    }
  };

  const handleAckAlert = async (id: string) => {
    try {
      await systemSurveillanceService.acknowledgeAlert(id);
      showToast('Alerte technique acquittée');
      await loadData(false);
    } catch (err) {
      showToast((err as Error)?.message || 'Erreur acquittement alerte');
    }
  };

  const handleFilterLogs = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoadingLogs(true);
    try {
      const res = await systemSurveillanceService.queryLogs({
        appId: logAppFilter,
        serviceId: logServiceFilter,
        severity: logSeverityFilter,
        status: logStatusFilter,
        dateFrom: logDateFrom,
        dateTo: logDateTo,
        q: logSearch
      });
      setFilteredLogs(res.logs);
    } catch (err) {
      showToast((err as Error)?.message || 'Erreur recherche journaux');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await requestMfaChallenge(
      'Validation MFA — Paramètres surveillance',
      'Confirmez la modification des seuils et de la fréquence des sondes système.',
      async (code) => {
        await systemSurveillanceService.updateSettings(
          {
            autoCheckEnabled: setAutoEnabled,
            checkIntervalSeconds: Number(setIntervalSec),
            latencyWarnMs: Number(setLatencyWarn),
            latencyCriticalMs: Number(setLatencyCrit),
            errorSpikeThreshold: Number(setErrThreshold),
            memoryWarnPercent: Number(setMemWarn),
            authFailureSpikeThreshold: Number(setAuthThreshold),
            notifyOnCritical: setNotifyCrit,
            notifyOnWarning: setNotifyWarn
          },
          code
        );
        showToast('Paramètres de surveillance enregistrés');
        await loadData(false);
      }
    );
  };

  const handleTogglePermission = async (
    staffId: string,
    key: SurveillancePermissionKey,
    val: boolean
  ) => {
    await requestMfaChallenge(
      'Modification droits Surveillance Technique',
      `Confirmez la modification de la permission « ${SURV_PERMISSION_LABELS[key].label} ».`,
      async (code) => {
        await systemSurveillanceService.updateStaffPermissions(staffId, { [key]: val }, code);
        showToast('Permission mise à jour');
        await loadData(false);
      }
    );
  };

  if (loading && !data) {
    return (
      <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center space-y-2">
        <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
        <p className="text-xs font-bold text-white/70">Collecte des contrôles techniques réels en cours...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
        Impossible de charger les données de surveillance technique.
      </div>
    );
  }

  const perms = data.myPermissions;
  const isSuperAdmin = data.myRole === 'super_admin';
  const gBadge = globalStateBadge(data.kpis.globalState);
  const displayedLogs = filteredLogs !== null ? filteredLogs : data.logs;

  return (
    <div className="space-y-3.5 text-xs">
      {/* Header Banner */}
      <div className="p-3.5 rounded-2xl bg-[#111318] border border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${gBadge.dot}`} />
            <h3 className="text-sm font-black text-white">Surveillance technique du système</h3>
            <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-black ${gBadge.cls}`}>
              {gBadge.label}
            </span>
          </div>
          <p className="text-[11px] text-white/55">
            Contrôles réels sur les 5 applications, services API, stockage, base serveur, ressources Node.js et anomalies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {perms.runManualChecks && (
            <button
              type="button"
              disabled={runningProbe}
              onClick={() => void handleRunManualProbe()}
              className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[11px] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${runningProbe ? 'animate-spin' : ''}`} />
              <span>{runningProbe ? 'Contrôle en cours...' : 'Relancer un contrôle'}</span>
            </button>
          )}
          {onOpenMaintenance && (
            <button
              type="button"
              onClick={onOpenMaintenance}
              className="px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              <span>Maintenance</span>
            </button>
          )}
          {onOpenNotifications && (
            <button
              type="button"
              onClick={onOpenNotifications}
              className="px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-[#FF6321]" />
              <span>Alertes ({data.kpis.openAlertsCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Horizontal 8-Section Sub-Navigation */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {SECTION_NAV.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`shrink-0 px-3 py-2 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition ${
                active
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-white/[0.03] border-white/10 text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{item.label}</span>
              {item.id === 'anomalies' && data.kpis.openAnomaliesCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[10px]">
                  {data.kpis.openAnomaliesCount}
                </span>
              )}
              {item.id === 'alerts' && data.kpis.openAlertsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                  {data.kpis.openAlertsCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          1. VUE GÉNÉRALE (TABLEAU DE BORD TECHNIQUE)
         ========================================================================= */}
      {section === 'overview' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
              <p className="text-[10px] text-white/50 font-bold uppercase">État général</p>
              <div className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${gBadge.dot}`} />
                <span className="text-sm font-black text-white">{gBadge.label}</span>
              </div>
              <p className="text-[10px] text-white/45">
                Vérif : {fmtDate(data.kpis.lastSystemCheckAt)}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
              <p className="text-[10px] text-white/50 font-bold uppercase">Disponibilité services</p>
              <p className="text-base font-black text-emerald-300 font-mono">
                {data.kpis.globalAvailabilityPercent !== null ? `${data.kpis.globalAvailabilityPercent}%` : 'Non vérifiée'}
              </p>
              <p className="text-[10px] text-white/45">
                Uniquement sur services réellement sondés
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
              <p className="text-[10px] text-white/50 font-bold uppercase">Services actifs</p>
              <div className="flex items-center gap-2 font-mono font-black text-xs">
                <span className="text-emerald-300">{data.kpis.operationalServicesCount} OK</span>
                <span className="text-amber-300">{data.kpis.degradedServicesCount} dégr.</span>
                <span className="text-rose-300">{data.kpis.unavailableServicesCount} KO</span>
              </div>
              <p className="text-[10px] text-white/45">
                {data.kpis.unverifiedServicesCount} service(s) non configuré(s)
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
              <p className="text-[10px] text-white/50 font-bold uppercase">Latence & erreurs</p>
              <p className="text-base font-black text-white font-mono">
                {data.kpis.averageResponseTimeMs !== null ? `${data.kpis.averageResponseTimeMs} ms` : '—'}
              </p>
              <p className="text-[10px] text-white/45">
                {data.kpis.recentErrorsCount} erreur(s) récente(s) ouverte(s)
              </p>
            </div>
          </div>

          {/* Runtime Node.js Resources Card */}
          <div className="p-3 rounded-2xl bg-[#111318] border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-black text-white flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-sky-400" />
                <span>Ressources serveur en direct ({data.resources.nodeVersion})</span>
              </span>
              <span className="text-[10px] text-white/50 font-mono">
                Uptime : {Math.floor(data.resources.uptimeSeconds / 60)} min
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                <p className="text-white/45 text-[10px]">Process RSS</p>
                <p className="font-mono font-black text-white">{data.resources.rssMb} Mo</p>
              </div>
              <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                <p className="text-white/45 text-[10px]">Heap JS</p>
                <p className="font-mono font-black text-white">
                  {data.resources.heapUsedMb} / {data.resources.heapTotalMb} Mo
                </p>
              </div>
              <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                <p className="text-white/45 text-[10px]">RAM système</p>
                <p className={`font-mono font-black ${data.resources.systemMemUsedPercent >= data.settings.memoryWarnPercent ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {data.resources.systemMemUsedPercent}% ({data.resources.systemMemTotalMb} Mo)
                </p>
              </div>
              <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                <p className="text-white/45 text-[10px]">CPU / Charge 1m</p>
                <p className="font-mono font-black text-white">
                  {data.resources.cpuCount} cœurs • {data.resources.loadAvg1m}
                </p>
              </div>
            </div>
          </div>

          {/* Color Legend + Quick Status of 5 Apps */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-black text-white">État rapide des 5 espaces DJASSA</h4>
              <div className="flex flex-wrap gap-2 text-[10px] text-white/60">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Opérationnel</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Dégradé</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" /> En panne</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-white/40" /> Non vérifié</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              {data.apps.map((app) => {
                const badge = globalStateBadge(app.status);
                return (
                  <button
                    key={app.appId}
                    type="button"
                    onClick={() => setSection('apps')}
                    className="p-2.5 rounded-xl bg-black/40 border border-white/10 hover:border-white/25 text-left space-y-1 cursor-pointer transition"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-white text-[11px] truncate">{app.shortName}</span>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${badge.dot}`} />
                    </div>
                    <p className="text-[10px] font-mono text-white/60">
                      {app.responseTimeMs !== null ? `${app.responseTimeMs} ms` : 'Non mesuré'}
                    </p>
                    <p className="text-[9px] text-white/45 truncate">v{app.deployedVersion || '—'}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cross-module Links */}
          <div className="flex flex-wrap gap-2">
            {onOpenAudit && (
              <button
                type="button"
                onClick={onOpenAudit}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-amber-300 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Ouvrir le Journal d'activité</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
            {onOpenMaintenance && (
              <button
                type="button"
                onClick={onOpenMaintenance}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sky-300 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Ouvrir Maintenance & versions</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          2. APPLICATIONS DJASSA (SURVEILLANCE INDÉPENDANTE DES 5 ESPACES)
         ========================================================================= */}
      {section === 'apps' && (
        <div className="space-y-2.5 animate-in fade-in duration-150">
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] text-white/65">
            Chaque espace DJASSA est surveillé indépendamment : une panne détectée sur une application n’affecte pas le statut des quatre autres.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {data.apps.map((app) => {
              const badge = globalStateBadge(app.status);
              return (
                <div key={app.appId} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-white text-xs">{app.name}</p>
                      <p className="text-[10px] text-white/50 font-mono">
                        Version {app.deployedVersion || 'N/A'} ({app.buildNumber || 'local'}) • {app.environment}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-black flex items-center gap-1 ${badge.cls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                      {badge.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                      <p className="text-white/45">Disponibilité</p>
                      <p className="font-mono font-black text-white">
                        {app.availabilityPercent !== null ? `${app.availabilityPercent}%` : 'Non vérifiée'}
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                      <p className="text-white/45">Temps réponse</p>
                      <p className="font-mono font-black text-white">
                        {app.responseTimeMs !== null ? `${app.responseTimeMs} ms` : '—'}
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-black/40 border border-white/5">
                      <p className="text-white/45">Erreurs ouvertes</p>
                      <p className={`font-mono font-black ${app.errorCount > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                        {app.errorCount}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-white/50 pt-1 border-t border-white/5">
                    <span>Dernière vérif : {fmtDate(app.lastCheckedAt)}</span>
                  </div>
                  {app.lastAnomalyDetected && (
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-200">
                      Dernière anomalie : {app.lastAnomalyDetected}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          3. SERVICES & FOURNISSEURS
         ========================================================================= */}
      {section === 'services' && (
        <div className="space-y-2.5 animate-in fade-in duration-150">
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] text-white/65">
            Aucun indicateur n’est forcé au vert sans contrôle technique réel : les fournisseurs sans clé serveur affichent honnêtement « Non configuré / Non vérifié ».
          </div>

          <div className="space-y-2">
            {data.services.map((svc) => {
              const badge = serviceBadge(svc.status);
              return (
                <div key={svc.id} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-white text-xs">{svc.name}</p>
                      <p className="text-[10px] text-white/45">{svc.configHint}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-black flex items-center gap-1 ${badge.cls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                      {badge.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                    <div className="p-1.5 rounded-lg bg-black/35">
                      <span className="text-white/45 block">Disponibilité</span>
                      <span className="font-mono font-bold text-white">
                        {svc.availabilityPercent !== null ? `${svc.availabilityPercent}%` : 'Non vérifiée'}
                      </span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-black/35">
                      <span className="text-white/45 block">Temps réponse</span>
                      <span className="font-mono font-bold text-white">
                        {svc.responseTimeMs !== null ? `${svc.responseTimeMs} ms` : '—'}
                      </span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-black/35">
                      <span className="text-white/45 block">Erreurs ouvertes</span>
                      <span className={`font-mono font-bold ${svc.errorCount > 0 ? 'text-rose-300' : 'text-white'}`}>
                        {svc.errorCount}
                      </span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-black/35">
                      <span className="text-white/45 block">Dernière vérif</span>
                      <span className="font-mono text-white/80">{fmtDate(svc.lastCheckedAt)}</span>
                    </div>
                  </div>

                  {svc.errorMessage && (
                    <div className="p-2 rounded-xl bg-black/40 border border-white/10 text-[10px] text-white/75 font-mono">
                      Message : {svc.errorMessage}
                    </div>
                  )}
                  {svc.lastKnownOutageAt && (
                    <p className="text-[10px] text-rose-300/80">
                      Dernière interruption connue : {fmtDate(svc.lastKnownOutageAt)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          4. ANOMALIES DÉTECTÉES
         ========================================================================= */}
      {section === 'anomalies' && (
        <div className="space-y-2.5 animate-in fade-in duration-150">
          {data.anomalies.length === 0 ? (
            <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-center space-y-1">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
              <p className="font-black text-white text-xs">Aucune anomalie active détectée</p>
              <p className="text-[11px] text-white/55">Les contrôles techniques n’ont relevé aucun dépassement de seuil.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.anomalies.map((anom) => {
                const sev = severityBadge(anom.severity);
                const st = anomalyStatusBadge(anom.status);
                return (
                  <div key={anom.id} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black ${sev.cls}`}>{sev.label}</span>
                          <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black ${st.cls}`}>{st.label}</span>
                          <span className="text-[10px] font-mono text-white/45">{anom.id}</span>
                        </div>
                        <p className="font-black text-white text-xs">{anom.title}</p>
                        <p className="text-[11px] text-white/70">{anom.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedAnomaly(anom);
                          setAnomalyComment('');
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspecter</span>
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-white/50">
                      <span>Service : {anom.serviceName} • Occurrences : {anom.occurrenceCount}</span>
                      <span>
                        Détectée : {fmtDate(anom.detectedAt)}
                        {anom.assignedToName ? ` • Resp : ${anom.assignedToName}` : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          5. ALERTES TECHNIQUES (DÉDUPLIQUÉES)
         ========================================================================= */}
      {section === 'alerts' && (
        <div className="space-y-2.5 animate-in fade-in duration-150">
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/65">
            <span>Les alertes sont dédupliquées tant qu’un incident reste ouvert afin d’éviter toute saturation.</span>
            {onOpenNotifications && (
              <button
                type="button"
                onClick={onOpenNotifications}
                className="text-[#FF6321] font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Voir Notifications & alertes</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {data.alerts.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center text-white/55">
              Aucune alerte technique émise pour le moment.
            </div>
          ) : (
            <div className="space-y-2">
              {data.alerts.map((al) => {
                const sev = severityBadge(al.severity);
                return (
                  <div key={al.id} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black ${sev.cls}`}>{sev.label}</span>
                          <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/75 text-[9px] font-bold uppercase">
                            {al.status}
                          </span>
                          <span className="text-[10px] font-mono text-white/45">×{al.occurrenceCount}</span>
                        </div>
                        <p className="font-black text-white text-xs">{al.title}</p>
                        <p className="text-[11px] text-white/65">{al.description}</p>
                      </div>
                      {al.status === 'ouverte' && perms.manageAnomalies && (
                        <button
                          type="button"
                          onClick={() => void handleAckAlert(al.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 font-bold text-[10px] cursor-pointer"
                        >
                          Acquitter
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-white/45">
                      Créée : {fmtDate(al.createdAt)} • Dernière occurrence : {fmtDate(al.updatedAt)}
                      {al.acknowledgedBy ? ` • Acquittée par ${al.acknowledgedBy}` : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          6. JOURNAUX TECHNIQUES (MASQUAGE STRICT DES SECRETS & PII)
         ========================================================================= */}
      {section === 'logs' && (
        <div className="space-y-2.5 animate-in fade-in duration-150">
          <form onSubmit={(e) => void handleFilterLogs(e)} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-2.5" />
                <input
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Rechercher message, service..."
                  className="w-full pl-8 pr-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-[11px]"
                />
              </div>
              <select
                value={logAppFilter}
                onChange={(e) => setLogAppFilter(e.target.value)}
                className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-[11px]"
              >
                <option value="all_filter">Toutes les applications</option>
                <option value="client">DJASSA Client</option>
                <option value="seller">DJASSA Vendeur</option>
                <option value="admin">DJASSA Admin</option>
              </select>
              <select
                value={logSeverityFilter}
                onChange={(e) => setLogSeverityFilter(e.target.value)}
                className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-[11px]"
              >
                <option value="all">Toutes sévérités</option>
                <option value="critique">Critique</option>
                <option value="avertissement">Avertissement</option>
                <option value="information">Information</option>
              </select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <select
                value={logStatusFilter}
                onChange={(e) => setLogStatusFilter(e.target.value)}
                className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-[11px]"
              >
                <option value="all">Tous statuts</option>
                <option value="ok">OK</option>
                <option value="degrade">Dégradé</option>
                <option value="erreur">Erreur</option>
                <option value="critique">Critique</option>
              </select>
              <input
                type="date"
                value={logDateFrom}
                onChange={(e) => setLogDateFrom(e.target.value)}
                className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-[11px]"
              />
              <input
                type="date"
                value={logDateTo}
                onChange={(e) => setLogDateTo(e.target.value)}
                className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-[11px]"
              />
              <button
                type="submit"
                disabled={loadingLogs}
                className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[11px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>{loadingLogs ? 'Filtrage...' : 'Filtrer'}</span>
              </button>
            </div>
            <p className="text-[10px] text-white/45">
              Sécurité : mots de passe, OTP, jetons Bearer, clés API et données personnelles sont automatiquement masqués.
            </p>
          </form>

          <div className="space-y-1.5">
            {displayedLogs.map((log) => {
              const sev = severityBadge(log.severity);
              return (
                <div key={log.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black ${sev.cls}`}>{sev.label}</span>
                      <span className="text-[10px] font-bold text-white">{log.serviceName}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 uppercase">{log.status}</span>
                    </div>
                    <span className="text-[10px] font-mono text-white/45">{fmtDate(log.timestamp)}</span>
                  </div>
                  <p className="text-[11px] font-semibold text-white/90">{log.message}</p>
                  {log.redactedDetails && (
                    <p className="text-[10px] font-mono text-white/55 break-all">{log.redactedDetails}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          7. HISTORIQUE DES INCIDENTS
         ========================================================================= */}
      {section === 'incidents' && (
        <div className="space-y-2 animate-in fade-in duration-150">
          {data.incidents.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center text-white/55">
              Aucun incident technique enregistré.
            </div>
          ) : (
            data.incidents.map((inc) => {
              const sev = severityBadge(inc.severity);
              return (
                <div key={inc.id} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black ${sev.cls}`}>{sev.label}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                          inc.status === 'resolu' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {inc.status === 'resolu' ? 'Résolu' : 'Ouvert'}
                      </span>
                      <span className="text-[10px] font-bold text-white/70">{inc.serviceName}</span>
                    </div>
                    <span className="text-[10px] font-mono text-white/45">{fmtDate(inc.at)}</span>
                  </div>
                  <p className="font-bold text-white text-xs">{inc.title}</p>
                  <p className="text-[11px] text-white/65">{inc.details}</p>
                  {inc.resolvedAt && (
                    <p className="text-[10px] text-emerald-300/80">
                      Résolu le {fmtDate(inc.resolvedAt)} {inc.durationSeconds !== null ? `(Durée : ${inc.durationSeconds}s)` : ''}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =========================================================================
          8. PARAMÈTRES DE SURVEILLANCE & RBAC
         ========================================================================= */}
      {section === 'settings' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <form onSubmit={(e) => void handleSaveSettings(e)} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <h4 className="font-black text-white flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-sky-400" />
              <span>Seuils de détection & fréquence des contrôles</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
              <label className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                <span className="font-bold text-white/85">Contrôles automatiques périodiques</span>
                <input
                  type="checkbox"
                  disabled={!perms.modifySurveillanceSettings}
                  checked={setAutoEnabled}
                  onChange={(e) => setSetAutoEnabled(e.target.checked)}
                  className="accent-emerald-500 w-4 h-4"
                />
              </label>

              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                <label className="text-[10px] text-white/50 block">Fréquence contrôles (secondes, min 60s)</label>
                <input
                  type="number"
                  min={60}
                  max={3600}
                  disabled={!perms.modifySurveillanceSettings}
                  value={setIntervalSec}
                  onChange={(e) => setSetIntervalSec(Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white font-mono"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                <label className="text-[10px] text-white/50 block">Seuil latence Avertissement (ms)</label>
                <input
                  type="number"
                  min={300}
                  disabled={!perms.modifySurveillanceSettings}
                  value={setLatencyWarn}
                  onChange={(e) => setSetLatencyWarn(Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white font-mono"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                <label className="text-[10px] text-white/50 block">Seuil latence Critique (ms)</label>
                <input
                  type="number"
                  min={500}
                  disabled={!perms.modifySurveillanceSettings}
                  value={setLatencyCrit}
                  onChange={(e) => setSetLatencyCrit(Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white font-mono"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                <label className="text-[10px] text-white/50 block">Seuil pic erreurs techniques (2h)</label>
                <input
                  type="number"
                  min={2}
                  disabled={!perms.modifySurveillanceSettings}
                  value={setErrThreshold}
                  onChange={(e) => setSetErrThreshold(Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white font-mono"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                <label className="text-[10px] text-white/50 block">Seuil alerte RAM système (%)</label>
                <input
                  type="number"
                  min={60}
                  max={98}
                  disabled={!perms.modifySurveillanceSettings}
                  value={setMemWarn}
                  onChange={(e) => setSetMemWarn(Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white font-mono"
                />
              </div>
            </div>

            {perms.modifySurveillanceSettings && (
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs cursor-pointer"
              >
                Enregistrer les paramètres (Validation MFA)
              </button>
            )}
          </form>

          {/* RBAC Permissions */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
            <h4 className="font-black text-white flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Permissions Surveillance Technique (RBAC)</span>
            </h4>
            <div className="space-y-2">
              {data.permissionsDirectory.map((member) => {
                const isMemberSuper = member.role === 'super_admin';
                const isOther = member.role === 'other_agent';
                return (
                  <div key={member.staffId} className="p-2.5 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-white text-xs">{member.name}</p>
                        <p className="text-[10px] text-white/50 font-mono">{member.email} • {member.role}</p>
                      </div>
                      {isMemberSuper && (
                        <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] font-black">
                          CONTRÔLE TOTAL
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {(Object.keys(SURV_PERMISSION_LABELS) as SurveillancePermissionKey[]).map((key) => {
                        const checked = member.permissions[key];
                        const editable = isSuperAdmin && !isMemberSuper && !isOther;
                        return (
                          <button
                            key={key}
                            type="button"
                            disabled={!editable}
                            onClick={() => void handleTogglePermission(member.staffId, key, !checked)}
                            className={`p-2 rounded-xl border text-left flex items-center justify-between gap-2 ${
                              checked
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                                : 'bg-white/[0.02] border-white/10 text-white/45'
                            } ${editable ? 'cursor-pointer hover:bg-white/10' : 'opacity-75 cursor-default'}`}
                          >
                            <div>
                              <p className="text-[10px] font-bold">{SURV_PERMISSION_LABELS[key].label}</p>
                              <p className="text-[9px] text-white/45">{SURV_PERMISSION_LABELS[key].desc}</p>
                            </div>
                            <span
                              className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                                checked ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/30'
                              }`}
                            >
                              {checked ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <X className="w-3 h-3" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Anomaly Detail & Action Modal */}
      {selectedAnomaly && (
        <div className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedAnomaly(null)}>
          <div className="w-full max-w-md rounded-2xl bg-[#141418] border border-white/15 p-4 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2.5">
              <div>
                <p className="text-[10px] font-mono text-white/50">{selectedAnomaly.id} • {selectedAnomaly.serviceName}</p>
                <h4 className="text-sm font-black text-white">{selectedAnomaly.title}</h4>
              </div>
              <button type="button" onClick={() => setSelectedAnomaly(null)} className="text-white/50 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-[11px]">
              <p className="text-white/85">{selectedAnomaly.description}</p>
              {selectedAnomaly.technicalCause && (
                <div className="p-2 rounded-xl bg-black/50 border border-white/10 font-mono text-[10px] text-amber-200 break-all">
                  Cause technique : {selectedAnomaly.technicalCause}
                </div>
              )}
            </div>

            {perms.manageAnomalies && (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <textarea
                  value={anomalyComment}
                  onChange={(e) => setAnomalyComment(e.target.value)}
                  rows={2}
                  placeholder="Ajouter un commentaire d'intervention..."
                  className="w-full p-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-[11px]"
                />
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    disabled={updatingAnomaly}
                    onClick={() => void handleUpdateAnomaly(selectedAnomaly.id, 'en_cours', true)}
                    className="py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 font-bold text-[10px] cursor-pointer"
                  >
                    Prendre en charge
                  </button>
                  <button
                    type="button"
                    disabled={updatingAnomaly}
                    onClick={() => void handleUpdateAnomaly(selectedAnomaly.id, 'resolue', false)}
                    className="py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[10px] cursor-pointer"
                  >
                    Marquer résolue
                  </button>
                  <button
                    type="button"
                    disabled={updatingAnomaly}
                    onClick={() => void handleUpdateAnomaly(selectedAnomaly.id, 'non_resolue', false)}
                    className="py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 font-bold text-[10px] cursor-pointer"
                  >
                    Non résolue
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5 pt-2 border-t border-white/10">
              <p className="text-[10px] font-black text-white/60 uppercase">Historique d’intervention</p>
              {selectedAnomaly.history.map((h) => (
                <div key={h.id} className="p-2 rounded-xl bg-black/40 border border-white/5 text-[10px]">
                  <div className="flex justify-between text-white/50">
                    <span className="font-bold text-white/80">{h.actorName}</span>
                    <span>{fmtDate(h.at)}</span>
                  </div>
                  <p className="text-white/75 mt-0.5">{h.action}</p>
                  {h.comment && <p className="text-white/50 mt-0.5">{h.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step-Up MFA Modal */}
      {mfaPrompt && (
        <div className="fixed inset-0 z-[85] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setMfaPrompt(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-[#141418] border border-amber-500/35 p-4 space-y-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h4 className="text-sm font-black text-white">{mfaPrompt.title}</h4>
              </div>
              <button type="button" onClick={() => setMfaPrompt(null)} className="text-white/50 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-white/75">{mfaPrompt.description}</p>
            {mfaPrompt.previewCode && (
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200 font-mono">
                Code de vérification MFA émis : <strong>{mfaPrompt.previewCode}</strong>
              </div>
            )}
            <input
              value={mfaInput}
              onChange={(e) => setMfaInput(e.target.value)}
              placeholder="Saisissez le code à 6 chiffres"
              className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white font-mono text-center tracking-widest"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setMfaPrompt(null)} className="flex-1 py-2 rounded-xl bg-white/10 text-white/80 font-bold cursor-pointer">
                Annuler
              </button>
              <button
                type="button"
                disabled={mfaSubmitting || !mfaInput.trim()}
                onClick={async () => {
                  setMfaSubmitting(true);
                  try {
                    await mfaPrompt.onVerified(mfaInput.trim());
                    setMfaPrompt(null);
                  } catch (err) {
                    showToast((err as Error)?.message || 'Code MFA invalide');
                  } finally {
                    setMfaSubmitting(false);
                  }
                }}
                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black cursor-pointer disabled:opacity-50"
              >
                {mfaSubmitting ? 'Vérification...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
