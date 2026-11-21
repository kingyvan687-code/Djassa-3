import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Cloud,
  Cpu,
  Database,
  Eye,
  FileCode2,
  GitBranch,
  Globe,
  History,
  KeyRound,
  Layers,
  Lock,
  PauseCircle,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Terminal,
  Wrench,
  X,
  XCircle
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { maintenanceService } from '../../../services/maintenanceService';
import { securityService, type SecurityApiError } from '../../../services/securityService';
import type {
  AppEnvironment,
  AppOperationalStatus,
  AppVersionRecord,
  DeploymentChannel,
  DeploymentRecord,
  DeploymentStatus,
  DjassaAppId,
  MaintenanceOverviewResponse,
  MaintenancePermissionKey,
  MaintenanceScope,
  MaintenanceWindowRecord,
  RollbackPreflightResult,
  ServiceHealthStatus,
  TechnicalErrorRecord,
  TechnicalErrorSeverity,
  TechnicalErrorStatus,
  VersionPublicationStatus
} from '../../../types/maintenance';

type SectionKey =
  | 'overview'
  | 'apps_versions'
  | 'deployments'
  | 'maintenance'
  | 'services'
  | 'errors'
  | 'maintenance_history'
  | 'rollbacks'
  | 'settings_permissions';

const SECTION_NAV: Array<{ id: SectionKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Vue générale', icon: Activity },
  { id: 'apps_versions', label: 'Apps & versions', icon: Layers },
  { id: 'deployments', label: 'Déploiements', icon: GitBranch },
  { id: 'maintenance', label: 'Mode maintenance', icon: Wrench },
  { id: 'services', label: 'État des services', icon: Server },
  { id: 'errors', label: 'Erreurs techniques', icon: AlertTriangle },
  { id: 'maintenance_history', label: 'Hist. maintenances', icon: History },
  { id: 'rollbacks', label: 'Rollbacks', icon: RotateCcw },
  { id: 'settings_permissions', label: 'Paramètres & droits', icon: Settings }
];

const MAINTENANCE_PERMISSION_LABELS: Record<MaintenancePermissionKey, { label: string; desc: string }> = {
  viewVersions: { label: 'Consulter les versions', desc: 'Lecture du registre apps, versions et déploiements' },
  viewTechnicalErrors: { label: 'Consulter les erreurs', desc: 'Accès aux journaux techniques masqués et résolution' },
  scheduleMaintenance: { label: 'Programmer une maintenance', desc: 'Planification de fenêtres futures (apps individuelles)' },
  toggleMaintenance: { label: 'Activer / désactiver maintenance', desc: 'Activation et arrêt d’une maintenance individuelle' },
  prepareDeployment: { label: 'Préparer un déploiement', desc: 'Création de version, mise en test et préparation paquet' },
  validateDeployment: { label: 'Valider un déploiement', desc: 'Approbation avant publication et lancement vérifié' },
  executeRollback: { label: 'Effectuer un rollback', desc: 'Retour vers une version précédente avec vérification' },
  modifyTechnicalSettings: { label: 'Modifier paramètres techniques', desc: 'Configuration sondes, délais et rétention logs' }
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Jamais';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatCountdown(endAt: string | null | undefined, nowMs: number): string {
  if (!endAt) return 'Durée indéterminée';
  const diff = new Date(endAt).getTime() - nowMs;
  if (diff <= 0) return 'Échéance atteinte';
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h > 0 ? `${String(h).padStart(2, '0')}h ` : ''}${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

function appStatusBadge(status: AppOperationalStatus): { label: string; cls: string } {
  switch (status) {
    case 'operationnel':
      return { label: 'Opérationnel', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    case 'maintenance':
      return { label: 'Maintenance', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    case 'degrade':
      return { label: 'Dégradé', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' };
    case 'indisponible':
      return { label: 'Indisponible', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
  }
}

function serviceStatusBadge(status: ServiceHealthStatus): { label: string; cls: string } {
  switch (status) {
    case 'operationnel':
      return { label: 'Opérationnel', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    case 'degrade':
      return { label: 'Dégradé', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    case 'indisponible':
      return { label: 'Indisponible', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
    case 'maintenance':
      return { label: 'Maintenance', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
    case 'non_verifie':
      return { label: 'Non vérifié', cls: 'bg-white/10 text-white/60 border-white/15' };
  }
}

function versionStatusBadge(status: VersionPublicationStatus): { label: string; cls: string } {
  switch (status) {
    case 'en_preparation':
      return { label: 'En préparation', cls: 'bg-white/10 text-white/75 border-white/15' };
    case 'en_test':
      return { label: 'En test', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
    case 'prete_a_publier':
      return { label: 'Prête à publier', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    case 'deployee':
      return { label: 'Déployée', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    case 'echec':
      return { label: 'Échec', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
    case 'annulee':
      return { label: 'Annulée', cls: 'bg-white/5 text-white/40 border-white/10' };
  }
}

function deploymentStatusBadge(status: DeploymentStatus): { label: string; cls: string } {
  switch (status) {
    case 'en_preparation':
      return { label: 'En préparation', cls: 'bg-white/10 text-white/75 border-white/15' };
    case 'en_attente_validation':
      return { label: 'À valider', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    case 'en_cours':
      return { label: 'Validé / Prêt', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
    case 'deploiement_progressif':
      return { label: 'Progressif', cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30' };
    case 'verification':
      return { label: 'Vérification', cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' };
    case 'deployee':
      return { label: 'Déployé & Vérifié', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    case 'echec':
      return { label: 'Échec', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
    case 'annulee':
      return { label: 'Annulé', cls: 'bg-white/5 text-white/45 border-white/10' };
  }
}

function severityBadge(sev: TechnicalErrorSeverity): string {
  switch (sev) {
    case 'critique':
      return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    case 'eleve':
      return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
    case 'moyen':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    case 'faible':
      return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
    default:
      return 'bg-white/10 text-white/60 border-white/15';
  }
}

export const AdminMaintenanceVersionsModule: React.FC = () => {
  const { showToast } = useApp();

  const [section, setSection] = useState<SectionKey>('overview');
  const [data, setData] = useState<MaintenanceOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Selected app detail
  const [selectedAppId, setSelectedAppId] = useState<DjassaAppId>('client');

  // Create version form state
  const [showNewVersionForm, setShowNewVersionForm] = useState(false);
  const [verVersion, setVerVersion] = useState('1.0.1');
  const [verBuild, setVerBuild] = useState('');
  const [verEnv, setVerEnv] = useState<AppEnvironment>('production');
  const [verDesc, setVerDesc] = useState('');
  const [verFixes, setVerFixes] = useState('');
  const [verFeatures, setVerFeatures] = useState('');
  const [verSecurity, setVerSecurity] = useState('');
  const [verCompatNotes, setVerCompatNotes] = useState('Compatible API v1 & JSON Store v1');
  const [creatingVersion, setCreatingVersion] = useState(false);

  // Prepare deployment form
  const [depVersionId, setDepVersionId] = useState('');
  const [depTargetEnv, setDepTargetEnv] = useState<AppEnvironment>('test');
  const [depRolloutMode, setDepRolloutMode] = useState<'standard' | 'progressif'>('standard');
  const [depChannel, setDepChannel] = useState<DeploymentChannel>('local_runtime_manifest');
  const [preparingDep, setPreparingDep] = useState(false);
  const [busyDepId, setBusyDepId] = useState<string | null>(null);

  // Maintenance form state
  const [maintScope, setMaintScope] = useState<MaintenanceScope>('individuelle');
  const [maintAppIds, setMaintAppIds] = useState<DjassaAppId[]>(['seller']);
  const [maintActivateNow, setMaintActivateNow] = useState(true);
  const [maintStartLocal, setMaintStartLocal] = useState('');
  const [maintDurationMin, setMaintDurationMin] = useState(30);
  const [maintMessage, setMaintMessage] = useState(
    'Maintenance technique en cours sur DJASSA. Nos équipes rétablissent le service très rapidement.'
  );
  const [maintReason, setMaintReason] = useState('Mise à jour applicative et contrôle de sécurité');
  const [submittingMaint, setSubmittingMaint] = useState(false);

  // Technical errors filters & expanded log
  const [errAppFilter, setErrAppFilter] = useState<string>('all');
  const [errTypeFilter, setErrTypeFilter] = useState<string>('all');
  const [errStatusFilter, setErrStatusFilter] = useState<string>('all');
  const [expandedErrId, setExpandedErrId] = useState<string | null>(null);

  // Rollback state
  const [rbAppId, setRbAppId] = useState<DjassaAppId>('client');
  const [rbVersionId, setRbVersionId] = useState<string>('');
  const [rbPreflight, setRbPreflight] = useState<RollbackPreflightResult | null>(null);
  const [rbConfirmPhrase, setRbConfirmPhrase] = useState('');
  const [rbReason, setRbReason] = useState('');
  const [rbLoading, setRbLoading] = useState(false);

  // Technical settings editable state
  const [settingsIntervalSec, setSettingsIntervalSec] = useState(120);
  const [settingsAutoCheck, setSettingsAutoCheck] = useState(true);
  const [settingsNotifyOutage, setSettingsNotifyOutage] = useState(true);
  const [settingsNotifyCriticalErr, setSettingsNotifyCriticalErr] = useState(true);
  const [settingsRetentionCap, setSettingsRetentionCap] = useState(500);
  const [savingSettings, setSavingSettings] = useState(false);

  // Step-up MFA Modal state
  const [mfaPrompt, setMfaPrompt] = useState<{
    title: string;
    description: string;
    previewCode?: string;
    onVerified: (code: string) => Promise<void>;
  } | null>(null);
  const [mfaInput, setMfaInput] = useState('');
  const [mfaSubmitting, setMfaSubmitting] = useState(false);

  const fetchOverview = useCallback(async (runProbes = false) => {
    try {
      setErrorBanner(null);
      if (!data) setLoading(true);
      const res = await maintenanceService.getOverview(runProbes);
      setData(res);
      setSettingsIntervalSec(res.settings.autoCheckIntervalSeconds);
      setSettingsAutoCheck(res.settings.autoCheckEnabled);
      setSettingsNotifyOutage(res.settings.notifySuperAdminOnOutage);
      setSettingsNotifyCriticalErr(res.settings.notifySuperAdminOnCriticalError);
      setSettingsRetentionCap(res.settings.maxErrorRetentionCount);
    } catch (err) {
      const msg = (err as Error)?.message || 'Impossible de charger le module Maintenance & versions.';
      setErrorBanner(msg);
    } finally {
      setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    void fetchOverview(false);
  }, []);

  // Live 1s countdown clock when any maintenance window is active or scheduled
  useEffect(() => {
    const hasMaint = Boolean(data?.activeMaintenances.length || data?.scheduledMaintenances.length);
    if (!hasMaint) return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [data?.activeMaintenances.length, data?.scheduledMaintenances.length]);

  const withMfaStepUp = async (
    title: string,
    description: string,
    actionFn: (stepUpCode?: string) => Promise<void>
  ) => {
    try {
      await actionFn(undefined);
    } catch (err) {
      const apiErr = err as SecurityApiError;
      if (apiErr.status === 428 || apiErr.code === 'MFA_STEPUP_REQUIRED') {
        try {
          const ch = await securityService.requestMfaChallenge();
          setMfaInput(ch.verificationCodePreview || '');
          setMfaPrompt({
            title,
            description,
            previewCode: ch.verificationCodePreview,
            onVerified: async (code) => {
              await actionFn(code);
            }
          });
        } catch (chErr) {
          showToast((chErr as Error)?.message || 'Erreur lors de la demande MFA');
        }
      } else {
        showToast(apiErr.message || 'Opération refusée');
      }
    }
  };

  const handleManualProbe = async () => {
    setProbing(true);
    try {
      await maintenanceService.runServiceChecks();
      await fetchOverview(false);
      showToast('Sondes de santé exécutées avec succès');
    } catch (err) {
      showToast((err as Error)?.message || 'Erreur lors de la vérification des services');
    } finally {
      setProbing(false);
    }
  };

  const selectedAppInfo = useMemo(
    () => data?.apps.find((a) => a.appId === selectedAppId) || null,
    [data?.apps, selectedAppId]
  );

  const selectedAppVersions = useMemo(
    () => (data?.versions || []).filter((v) => v.appId === selectedAppId),
    [data?.versions, selectedAppId]
  );

  const deployableVersions = useMemo(
    () => (data?.versions || []).filter((v) => v.status !== 'annulee'),
    [data?.versions]
  );

  const filteredErrors = useMemo(() => {
    if (!data?.errors) return [];
    return data.errors.filter((e) => {
      if (errAppFilter !== 'all' && e.appId !== errAppFilter) return false;
      if (errTypeFilter !== 'all' && e.errorType !== errTypeFilter) return false;
      if (errStatusFilter !== 'all' && e.status !== errStatusFilter) return false;
      return true;
    });
  }, [data?.errors, errAppFilter, errTypeFilter, errStatusFilter]);

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingVersion(true);
    try {
      const splitLines = (s: string) =>
        s
          .split('\n')
          .map((x) => x.trim())
          .filter(Boolean);
      const res = await maintenanceService.createVersion({
        appId: selectedAppId,
        version: verVersion.trim(),
        buildNumber: verBuild.trim() || undefined,
        targetEnv: verEnv,
        description: verDesc.trim() || `Mise à jour ${selectedAppInfo?.name || selectedAppId}`,
        bugFixes: splitLines(verFixes),
        newFeatures: splitLines(verFeatures),
        securityImprovements: splitLines(verSecurity),
        compatibilityNotes: verCompatNotes.trim()
      });
      setDepVersionId(res.version.id);
      setShowNewVersionForm(false);
      setVerDesc('');
      setVerFixes('');
      setVerFeatures('');
      setVerSecurity('');
      await fetchOverview(false);
      showToast(`Version v${res.version.version} créée (En préparation)`);
    } catch (err) {
      showToast((err as Error)?.message || 'Erreur création de version');
    } finally {
      setCreatingVersion(false);
    }
  };

  const handleVersionStatusChange = async (versionId: string, status: VersionPublicationStatus) => {
    try {
      await maintenanceService.updateVersionStatus(versionId, status);
      await fetchOverview(false);
      showToast(`Statut version mis à jour : ${versionStatusBadge(status).label}`);
    } catch (err) {
      showToast((err as Error)?.message || 'Transition refusée');
    }
  };

  const handlePrepareDeployment = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetVerId = depVersionId || deployableVersions[0]?.id;
    if (!targetVerId) {
      showToast('Créez d’abord une version avant de préparer un déploiement.');
      return;
    }
    setPreparingDep(true);
    try {
      await maintenanceService.prepareDeployment({
        versionId: targetVerId,
        targetEnv: depTargetEnv,
        rolloutMode: depRolloutMode,
        deployChannel: depChannel
      });
      await fetchOverview(false);
      showToast('Déploiement préparé — validation requise avant publication');
    } catch (err) {
      showToast((err as Error)?.message || 'Erreur préparation déploiement');
    } finally {
      setPreparingDep(false);
    }
  };

  const handleValidateDeployment = async (dep: DeploymentRecord) => {
    setBusyDepId(dep.id);
    await withMfaStepUp(
      'Validation avant publication (MFA)',
      `Confirmez la validation de ${dep.appName} v${dep.version} (${dep.targetEnv}) avant son exécution.`,
      async (code) => {
        await maintenanceService.validateDeployment(dep.id, code);
        await fetchOverview(false);
        showToast('Déploiement validé avant publication');
      }
    );
    setBusyDepId(null);
  };

  const handleExecuteDeployment = async (dep: DeploymentRecord, advanceStage: 'next' | 'full' = 'next') => {
    setBusyDepId(dep.id);
    await withMfaStepUp(
      'Exécution & vérification du déploiement (MFA)',
      `Exécuter le déploiement ${dep.appName} v${dep.version} sur ${dep.targetEnv} (canal ${dep.deployChannel}).`,
      async (code) => {
        const res = await maintenanceService.executeDeployment(dep.id, { advanceStage }, code);
        await fetchOverview(false);
        if (res.progressiveStage && res.progressiveStage < 100) {
          showToast(`Palier progressif ${res.progressiveStage}% activé`);
        } else {
          showToast(`Déploiement vérifié : ${dep.appName} v${dep.version}`);
        }
      }
    );
    setBusyDepId(null);
  };

  const handleCancelDeployment = async (dep: DeploymentRecord) => {
    setBusyDepId(dep.id);
    try {
      await maintenanceService.cancelDeployment(dep.id, 'Annulation par l’administrateur');
      await fetchOverview(false);
      showToast('Déploiement annulé');
    } catch (err) {
      showToast((err as Error)?.message || 'Impossible d’annuler ce déploiement');
    } finally {
      setBusyDepId(null);
    }
  };

  const handleCreateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingMaint(true);
    try {
      await maintenanceService.createMaintenanceWindow({
        scope: maintScope,
        appIds: maintScope === 'globale' ? ['client', 'seller', 'admin'] : maintAppIds,
        activateNow: maintActivateNow,
        startAt: !maintActivateNow && maintStartLocal ? new Date(maintStartLocal).toISOString() : undefined,
        estimatedDurationMinutes: Number(maintDurationMin) || 30,
        customMessage: maintMessage,
        reason: maintReason
      });
      await fetchOverview(false);
      showToast(maintActivateNow ? 'Maintenance activée' : 'Maintenance programmée');
    } catch (err) {
      showToast((err as Error)?.message || 'Erreur maintenance');
    } finally {
      setSubmittingMaint(false);
    }
  };

  const handleStopMaintenance = async (win: MaintenanceWindowRecord) => {
    try {
      await maintenanceService.stopMaintenanceWindow(win.id);
      await fetchOverview(false);
      showToast(win.status === 'programmee' ? 'Maintenance programmée annulée' : 'Maintenance désactivée');
    } catch (err) {
      showToast((err as Error)?.message || 'Action refusée');
    }
  };

  const handleUpdateErrorStatus = async (errRec: TechnicalErrorRecord, nextStatus: TechnicalErrorStatus) => {
    try {
      await maintenanceService.updateTechnicalErrorStatus(errRec.id, nextStatus);
      await fetchOverview(false);
      showToast(`Erreur marquée : ${nextStatus}`);
    } catch (err) {
      showToast((err as Error)?.message || 'Action refusée');
    }
  };

  const handleRunRollbackPreflight = async (appId = rbAppId, verId = rbVersionId) => {
    setRbLoading(true);
    try {
      const res = await maintenanceService.rollbackPreflight(appId, verId || undefined);
      setRbPreflight(res.preflight);
      if (res.preflight.targetVersion && !verId) {
        setRbVersionId(res.preflight.targetVersion.id);
      }
    } catch (err) {
      showToast((err as Error)?.message || 'Erreur vérification pré-rollback');
    } finally {
      setRbLoading(false);
    }
  };

  const handleExecuteRollback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rbPreflight?.targetVersion) {
      showToast('Exécutez d’abord le contrôle de compatibilité.');
      return;
    }
    setRbLoading(true);
    await withMfaStepUp(
      'Confirmation renforcée — Rollback',
      `Restaurer ${rbAppId} vers v${rbPreflight.targetVersion.version} avec vérification post-restauration.`,
      async (code) => {
        await maintenanceService.executeRollback(
          {
            appId: rbAppId,
            targetVersionId: rbPreflight.targetVersion!.id,
            confirmPhrase: rbConfirmPhrase,
            reason: rbReason
          },
          code
        );
        setRbConfirmPhrase('');
        setRbReason('');
        await fetchOverview(false);
        await handleRunRollbackPreflight(rbAppId, '');
        showToast('Rollback exécuté et vérifié');
      }
    );
    setRbLoading(false);
  };

  const handleSaveTechnicalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    await withMfaStepUp(
      'Paramètres techniques (MFA)',
      'Confirmez la modification des paramètres de surveillance et de maintenance.',
      async (code) => {
        await maintenanceService.updateTechnicalSettings(
          {
            autoCheckEnabled: settingsAutoCheck,
            autoCheckIntervalSeconds: Number(settingsIntervalSec) || 120,
            notifySuperAdminOnOutage: settingsNotifyOutage,
            notifySuperAdminOnCriticalError: settingsNotifyCriticalErr,
            maxErrorRetentionCount: Number(settingsRetentionCap) || 500
          },
          code
        );
        await fetchOverview(false);
        showToast('Paramètres techniques enregistrés');
      }
    );
    setSavingSettings(false);
  };

  const handleToggleStaffPermission = async (staffId: string, key: MaintenancePermissionKey, nextVal: boolean) => {
    await withMfaStepUp(
      'Matrice permissions Maintenance (MFA)',
      'Confirmez la modification des droits d’administration Maintenance & Versions.',
      async (code) => {
        await maintenanceService.updateStaffMaintenancePermissions(staffId, { [key]: nextVal }, code);
        await fetchOverview(false);
        showToast('Permission mise à jour');
      }
    );
  };

  if (loading && !data) {
    return (
      <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center space-y-2">
        <RefreshCw className="w-5 h-5 text-amber-400 animate-spin mx-auto" />
        <p className="text-xs font-bold text-white/80">Chargement du module Maintenance & versions...</p>
      </div>
    );
  }

  if (errorBanner && !data) {
    return (
      <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2 text-xs">
        <div className="flex items-center gap-2 text-rose-300 font-bold">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{errorBanner}</span>
        </div>
        <button
          type="button"
          onClick={() => void fetchOverview(false)}
          className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-[11px] cursor-pointer"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { actor, apps, versions, deployments, activeMaintenances, scheduledMaintenances, maintenanceHistory, services, errors, readiness, runtimeMeta } =
    data;

  const isSuperAdmin = actor.role === 'super_admin';
  const perms = actor.permissions;
  const openErrorsCount = errors.filter((e) => e.status === 'nouvelle' || e.status === 'en_cours').length;
  const criticalErrorsCount = errors.filter((e) => e.severity === 'critique' && e.status !== 'resolue').length;
  const degradedOrDownServices = services.filter((s) => s.status === 'indisponible' || s.status === 'degrade').length;

  return (
    <div id="admin-maintenance-versions-module" className="space-y-3 text-xs select-none">
      {/* Header compact */}
      <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <Wrench className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-white">
              Maintenance & gestion des versions
            </h3>
          </div>
          <p className="text-[10px] text-white/50 mt-0.5">
            {actor.name} ({isSuperAdmin ? 'Super Admin' : actor.role}) • Env : {runtimeMeta.environment.toUpperCase()} • Uptime {Math.floor(runtimeMeta.uptimeSeconds / 60)} min
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void handleManualProbe()}
            disabled={probing}
            className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${probing ? 'animate-spin' : ''}`} />
            <span>{probing ? 'Sondage...' : 'Vérifier services'}</span>
          </button>
        </div>
      </div>

      {/* Active maintenance alert strip */}
      {activeMaintenances.length > 0 && (
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black text-amber-300 flex items-center gap-1.5">
              <PauseCircle className="w-4 h-4" />
              {activeMaintenances.length} maintenance(s) en cours
            </span>
            <button
              type="button"
              onClick={() => setSection('maintenance')}
              className="text-[10px] font-bold text-amber-200 underline cursor-pointer"
            >
              Gérer
            </button>
          </div>
          {activeMaintenances.map((m) => (
            <div key={m.id} className="text-[10px] text-white/80 flex items-center justify-between gap-2">
              <span>
                [{m.scope === 'globale' ? 'GLOBALE' : m.appIds.join(', ')}] {m.customMessage}
              </span>
              <span className="font-mono text-amber-300 shrink-0">{formatCountdown(m.endAt, nowMs)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 9-section horizontal scroll nav */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {SECTION_NAV.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          let badgeCount = 0;
          if (item.id === 'maintenance') badgeCount = activeMaintenances.length;
          if (item.id === 'services') badgeCount = degradedOrDownServices;
          if (item.id === 'errors') badgeCount = openErrorsCount;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`shrink-0 px-2.5 py-2 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                active
                  ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
              {badgeCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-rose-500/80 text-white text-[9px] font-black leading-none">
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* SECTION 1: VUE GÉNÉRALE                                             */}
      {/* =================================================================== */}
      {section === 'overview' && (
        <div className="space-y-3">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-[10px] text-white/50">Applications suivies</p>
              <p className="text-base font-black text-white mt-0.5">{apps.length} / 5</p>
              <p className="text-[10px] text-emerald-400">
                {apps.filter((a) => a.status === 'operationnel').length} opérationnelles
              </p>
            </div>
            <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-[10px] text-white/50">Maintenances</p>
              <p className="text-base font-black text-amber-300 mt-0.5">{activeMaintenances.length} active(s)</p>
              <p className="text-[10px] text-white/45">{scheduledMaintenances.length} programmée(s)</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-[10px] text-white/50">Services sondés</p>
              <p className="text-base font-black text-white mt-0.5">
                {services.filter((s) => s.status === 'operationnel').length}/{services.length}
              </p>
              <p className="text-[10px] text-white/45">
                {services.filter((s) => s.status === 'non_verifie').length} non configuré(s)
              </p>
            </div>
            <div className="p-2.5 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-[10px] text-white/50">Erreurs techniques</p>
              <p className="text-base font-black text-rose-300 mt-0.5">{openErrorsCount} ouverte(s)</p>
              <p className="text-[10px] text-white/45">{criticalErrorsCount} critique(s)</p>
            </div>
          </div>

          {/* 5 Apps status cards */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-white/50">
              Les 5 applications DJASSA
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {apps.map((app) => {
                const st = appStatusBadge(app.status);
                return (
                  <button
                    key={app.appId}
                    type="button"
                    onClick={() => {
                      setSelectedAppId(app.appId);
                      setSection('apps_versions');
                    }}
                    className="p-3 rounded-2xl bg-white/5 hover:bg-white/[0.08] border border-white/10 text-left transition space-y-1.5 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-white text-xs">{app.name}</span>
                      <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-white/60 font-mono">
                      <span>v{app.currentVersion} ({app.buildNumber})</span>
                      <span className="uppercase">{app.environment}</span>
                    </div>
                    <p className="text-[10px] text-white/45 truncate">{app.lastUpdateSummary}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Infrastructure Readiness & Honesty Matrix */}
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-black text-white">État réel de l’infrastructure & transparence</h4>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-emerald-300 uppercase">Opérationnel immédiatement</p>
              {readiness.operationalNow.map((item, idx) => (
                <div key={idx} className="p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/15 text-[10px]">
                  <p className="font-bold text-white">{item.title}</p>
                  <p className="text-white/55 mt-0.5">{item.details}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-amber-300 uppercase">
                Fournisseurs externes (statut réel détecté)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {readiness.requiresExternalConfig.map((ext, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-xl border text-[10px] ${
                      ext.configured
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-white/[0.03] border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-white">{ext.service}</span>
                      <span className={ext.configured ? 'text-emerald-300 font-bold' : 'text-white/50 font-bold'}>
                        {ext.configured ? 'Configuré' : 'Non configuré'}
                      </span>
                    </div>
                    <p className="text-white/50 mt-0.5">{ext.note}</p>
                    {ext.missingKeys.length > 0 && (
                      <p className="text-[9px] font-mono text-amber-300/80 mt-0.5">
                        Clés requises : {ext.missingKeys.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-sky-300 uppercase">Reste à connecter pour CI/CD complet</p>
              {readiness.remainingIntegrations.map((rem, idx) => (
                <div key={idx} className="p-2 rounded-xl bg-sky-500/5 border border-sky-500/15 text-[10px]">
                  <p className="font-bold text-white">{rem.title}</p>
                  <p className="text-white/55 mt-0.5">{rem.details}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION 2: APPLICATIONS ET VERSIONS                                 */}
      {/* =================================================================== */}
      {section === 'apps_versions' && (
        <div className="space-y-3">
          {/* App selector pills */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {apps.map((a) => (
              <button
                key={a.appId}
                type="button"
                onClick={() => setSelectedAppId(a.appId)}
                className={`shrink-0 px-3 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer ${
                  selectedAppId === a.appId
                    ? 'bg-purple-500/25 border-purple-400 text-white'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                {a.shortName} • v{a.currentVersion}
              </button>
            ))}
          </div>

          {selectedAppInfo && (
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-black text-white">{selectedAppInfo.name}</h4>
                  <p className="text-[10px] text-white/50">{selectedAppInfo.description}</p>
                </div>
                <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${appStatusBadge(selectedAppInfo.status).cls}`}>
                  {appStatusBadge(selectedAppInfo.status).label}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
                <div className="p-2 rounded-xl bg-black/40 border border-white/10">
                  <p className="text-white/45">Version actuelle</p>
                  <p className="font-mono font-black text-white mt-0.5">v{selectedAppInfo.currentVersion}</p>
                </div>
                <div className="p-2 rounded-xl bg-black/40 border border-white/10">
                  <p className="text-white/45">Numéro de build</p>
                  <p className="font-mono font-bold text-white mt-0.5">{selectedAppInfo.buildNumber}</p>
                </div>
                <div className="p-2 rounded-xl bg-black/40 border border-white/10">
                  <p className="text-white/45">Environnement</p>
                  <p className="font-bold text-amber-300 uppercase mt-0.5">{selectedAppInfo.environment}</p>
                </div>
                <div className="p-2 rounded-xl bg-black/40 border border-white/10">
                  <p className="text-white/45">Dernier déploiement</p>
                  <p className="font-mono text-white/85 mt-0.5">{formatDateTime(selectedAppInfo.lastDeployedAt)}</p>
                </div>
                <div className="p-2 rounded-xl bg-black/40 border border-white/10">
                  <p className="text-white/45">Dernier résultat</p>
                  <p className="font-bold text-white/85 uppercase mt-0.5">{selectedAppInfo.lastDeploymentResult}</p>
                </div>
                <div className="p-2 rounded-xl bg-black/40 border border-white/10">
                  <p className="text-white/45">Point d’entrée</p>
                  <p className="font-mono text-white/85 mt-0.5">{selectedAppInfo.entryRoute}</p>
                </div>
              </div>

              <div className="p-2 rounded-xl bg-black/30 border border-white/10 text-[10px]">
                <span className="text-white/45 font-bold">Dernière mise à jour : </span>
                <span className="text-white/85">{selectedAppInfo.lastUpdateSummary}</span>
              </div>

              {perms.prepareDeployment && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowNewVersionForm((v) => !v)}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Préparer une nouvelle version</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {showNewVersionForm && perms.prepareDeployment && (
            <form onSubmit={handleCreateVersion} className="p-3 rounded-2xl bg-[#131318] border border-purple-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-black text-purple-300">Nouvelle version pour {selectedAppInfo?.name}</h5>
                <button type="button" onClick={() => setShowNewVersionForm(false)} className="text-white/50 hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-white/60 block mb-1">Numéro de version (Semver)</label>
                  <input
                    value={verVersion}
                    onChange={(e) => setVerVersion(e.target.value)}
                    placeholder="ex: 1.1.0"
                    className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/60 block mb-1">Build (optionnel)</label>
                  <input
                    value={verBuild}
                    onChange={(e) => setVerBuild(e.target.value)}
                    placeholder="auto si vide"
                    className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/60 block mb-1">Environnement cible</label>
                  <select
                    value={verEnv}
                    onChange={(e) => setVerEnv(e.target.value as AppEnvironment)}
                    className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-bold"
                  >
                    <option value="development">Développement</option>
                    <option value="test">Test</option>
                    <option value="production">Production</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-white/60 block mb-1">Description des changements</label>
                <textarea
                  rows={2}
                  value={verDesc}
                  onChange={(e) => setVerDesc(e.target.value)}
                  placeholder="Résumé technique des modifications..."
                  className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white resize-none"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-white/60 block mb-1">Corrections de bugs (1/ligne)</label>
                  <textarea
                    rows={2}
                    value={verFixes}
                    onChange={(e) => setVerFixes(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white resize-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/60 block mb-1">Nouvelles fonctionnalités (1/ligne)</label>
                  <textarea
                    rows={2}
                    value={verFeatures}
                    onChange={(e) => setVerFeatures(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white resize-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/60 block mb-1">Sécurité & compatibilité (1/ligne)</label>
                  <textarea
                    rows={2}
                    value={verSecurity}
                    onChange={(e) => setVerSecurity(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white resize-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-white/60 block mb-1">Notes de compatibilité inter-services</label>
                <input
                  value={verCompatNotes}
                  onChange={(e) => setVerCompatNotes(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white"
                />
              </div>
              <button
                type="submit"
                disabled={creatingVersion}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black cursor-pointer disabled:opacity-50"
              >
                {creatingVersion ? 'Enregistrement...' : 'Créer la version (En préparation)'}
              </button>
            </form>
          )}

          {/* Version History for selected app */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-white/50">
              Historique des versions ({selectedAppVersions.length})
            </p>
            {!perms.viewVersions ? (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px]">
                Permission « Consulter les versions » requise.
              </div>
            ) : (
              selectedAppVersions.map((ver) => {
                const st = versionStatusBadge(ver.status);
                const isActive = selectedAppInfo?.activeVersionId === ver.id;
                return (
                  <div key={ver.id} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-black text-white text-xs">v{ver.version}</span>
                          <span className="text-[10px] font-mono text-white/50">({ver.buildNumber})</span>
                          {isActive && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-black">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-white/45 mt-0.5">
                          Créée le {formatDateTime(ver.createdAt)} • Cible: {ver.targetEnv} • {ver.createdBy}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>

                    <p className="text-[11px] text-white/80">{ver.description}</p>

                    {(ver.newFeatures.length > 0 || ver.bugFixes.length > 0 || ver.securityImprovements.length > 0) && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10px]">
                        {ver.newFeatures.length > 0 && (
                          <div className="p-2 rounded-xl bg-black/30 border border-white/5">
                            <p className="font-bold text-emerald-300">Nouveautés</p>
                            <ul className="list-disc pl-3.5 text-white/70 space-y-0.5 mt-0.5">
                              {ver.newFeatures.map((f, i) => (
                                <li key={i}>{f}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {ver.bugFixes.length > 0 && (
                          <div className="p-2 rounded-xl bg-black/30 border border-white/5">
                            <p className="font-bold text-sky-300">Correctifs</p>
                            <ul className="list-disc pl-3.5 text-white/70 space-y-0.5 mt-0.5">
                              {ver.bugFixes.map((b, i) => (
                                <li key={i}>{b}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {ver.securityImprovements.length > 0 && (
                          <div className="p-2 rounded-xl bg-black/30 border border-white/5">
                            <p className="font-bold text-amber-300">Sécurité</p>
                            <ul className="list-disc pl-3.5 text-white/70 space-y-0.5 mt-0.5">
                              {ver.securityImprovements.map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="text-[10px] text-white/50 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5">
                      <span>
                        Compatibilité : API {ver.compatibility.apiVersion} • DB {ver.compatibility.dbSchemaVersion} • {ver.compatibility.notes}
                      </span>
                      {perms.prepareDeployment && ver.status !== 'deployee' && ver.status !== 'annulee' && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {ver.status === 'en_preparation' && (
                            <button
                              type="button"
                              onClick={() => void handleVersionStatusChange(ver.id, 'en_test')}
                              className="px-2 py-1 rounded-lg bg-sky-500/20 text-sky-300 font-bold cursor-pointer"
                            >
                              Passer en test
                            </button>
                          )}
                          {(ver.status === 'en_preparation' || ver.status === 'en_test') && (
                            <button
                              type="button"
                              onClick={() => void handleVersionStatusChange(ver.id, 'prete_a_publier')}
                              className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-bold cursor-pointer"
                            >
                              Marquer prête
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setDepVersionId(ver.id);
                              setDepTargetEnv(ver.targetEnv);
                              setSection('deployments');
                            }}
                            className="px-2 py-1 rounded-lg bg-purple-500/20 text-purple-300 font-bold cursor-pointer"
                          >
                            Préparer déploiement →
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleVersionStatusChange(ver.id, 'annulee')}
                            className="px-2 py-1 rounded-lg bg-rose-500/15 text-rose-300 font-bold cursor-pointer"
                          >
                            Annuler
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION 3: HISTORIQUE ET PIPELINE DES DÉPLOIEMENTS                  */}
      {/* =================================================================== */}
      {section === 'deployments' && (
        <div className="space-y-3">
          {perms.prepareDeployment && (
            <form onSubmit={handlePrepareDeployment} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
              <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                <GitBranch className="w-4 h-4 text-purple-400" />
                <span>Préparer un déploiement</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-white/55 block mb-1">Version & Application</label>
                  <select
                    value={depVersionId || deployableVersions[0]?.id || ''}
                    onChange={(e) => setDepVersionId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-bold"
                  >
                    {deployableVersions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {apps.find((a) => a.appId === v.appId)?.shortName} — v{v.version} ({versionStatusBadge(v.status).label})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-white/55 block mb-1">Environnement cible</label>
                  <select
                    value={depTargetEnv}
                    onChange={(e) => setDepTargetEnv(e.target.value as AppEnvironment)}
                    className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-bold"
                  >
                    <option value="development">Développement</option>
                    <option value="test">Test</option>
                    <option value="production">Production (Super Admin)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-white/55 block mb-1">Stratégie de déploiement</label>
                  <select
                    value={depRolloutMode}
                    onChange={(e) => setDepRolloutMode(e.target.value as 'standard' | 'progressif')}
                    className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-bold"
                  >
                    <option value="standard">Standard (100% après validation)</option>
                    <option value="progressif">Progressif par paliers (25% → 50% → 100%)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-white/55 block mb-1">Canal d’exécution réel</label>
                  <select
                    value={depChannel}
                    onChange={(e) => setDepChannel(e.target.value as DeploymentChannel)}
                    className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-bold"
                  >
                    <option value="local_runtime_manifest">Manifeste runtime local + vérification HTTP</option>
                    <option value="cloudflare_pages_hook">Cloudflare Pages Webhook (requiert CLOUDFLARE_DEPLOY_HOOK)</option>
                    <option value="cloud_run_deploy_hook">Google Cloud Run Deploy Hook (requiert CLOUD_RUN_DEPLOY_HOOK)</option>
                  </select>
                </div>
              </div>
              <p className="text-[10px] text-white/45">
                Règle stricte : aucun déploiement n’est déclaré « Déployé » avant validation explicite et exécution réussie des sondes de vérification post-déploiement.
              </p>
              <button
                type="submit"
                disabled={preparingDep}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black cursor-pointer disabled:opacity-50"
              >
                {preparingDep ? 'Préparation...' : 'Préparer ce déploiement'}
              </button>
            </form>
          )}

          {/* Deployments list */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-white/50">
              Historique des déploiements ({deployments.length})
            </p>
            {deployments.length === 0 ? (
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center text-white/50 text-[11px]">
                Aucun déploiement exécuté ou préparé pour le moment.
              </div>
            ) : (
              deployments.map((dep) => {
                const st = deploymentStatusBadge(dep.status);
                const busy = busyDepId === dep.id;
                return (
                  <div key={dep.id} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-white">{dep.appName}</span>
                          <span className="font-mono text-purple-300 font-bold">v{dep.version}</span>
                          {dep.isRollback && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-black">
                              ROLLBACK
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-white/50 mt-0.5">
                          Cible : <strong className="text-white/75 uppercase">{dep.targetEnv}</strong> • Canal : {dep.deployChannel} • Auteur : {dep.authorName}
                        </p>
                        <p className="text-[10px] text-white/40 font-mono">
                          Démarré : {formatDateTime(dep.startedAt)} {dep.durationMs !== null ? `• ${dep.durationMs} ms` : ''}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>

                    <p className="text-[11px] text-white/85">{dep.result}</p>

                    {dep.errorsEncountered.length > 0 && (
                      <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-[10px] text-rose-300 space-y-0.5">
                        {dep.errorsEncountered.map((errStr, i) => (
                          <p key={i}>• {errStr}</p>
                        ))}
                      </div>
                    )}

                    {/* Steps timeline */}
                    <div className="space-y-1 pt-1 border-t border-white/5">
                      {dep.steps.map((step) => (
                        <div key={step.id} className="flex items-start gap-1.5 text-[10px]">
                          {step.status === 'passed' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          ) : step.status === 'failed' ? (
                            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <span className="font-bold text-white/85">{step.label}</span>
                            <span className="text-white/50"> — {step.details}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {dep.status === 'en_attente_validation' && perms.validateDeployment && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleValidateDeployment(dep)}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-bold text-[10px] cursor-pointer disabled:opacity-50"
                        >
                          Valider avant publication
                        </button>
                      )}

                      {(dep.status === 'en_cours' || dep.status === 'deploiement_progressif') && perms.validateDeployment && (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleExecuteDeployment(dep, 'next')}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 font-bold text-[10px] cursor-pointer disabled:opacity-50"
                          >
                            {dep.status === 'deploiement_progressif'
                              ? `Avancer palier (${dep.rolloutPercent}% → étape suivante)`
                              : 'Exécuter & vérifier post-déploiement'}
                          </button>
                          {dep.status === 'deploiement_progressif' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleExecuteDeployment(dep, 'full')}
                              className="px-2.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-200 font-bold text-[10px] cursor-pointer disabled:opacity-50"
                            >
                              Finaliser 100%
                            </button>
                          )}
                        </>
                      )}

                      {['en_preparation', 'en_attente_validation', 'en_cours', 'deploiement_progressif'].includes(dep.status) &&
                        perms.prepareDeployment && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleCancelDeployment(dep)}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 font-bold text-[10px] cursor-pointer disabled:opacity-50"
                          >
                            Annuler
                          </button>
                        )}

                      {dep.status === 'deployee' && !dep.isRollback && perms.executeRollback && (
                        <button
                          type="button"
                          onClick={() => {
                            setRbAppId(dep.appId);
                            setSection('rollbacks');
                            void handleRunRollbackPreflight(dep.appId, '');
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 font-bold text-[10px] cursor-pointer"
                        >
                          Vérifier rollback
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION 4: MODE MAINTENANCE                                         */}
      {/* =================================================================== */}
      {section === 'maintenance' && (
        <div className="space-y-3">
          {/* Active & scheduled windows */}
          {(activeMaintenances.length > 0 || scheduledMaintenances.length > 0) && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                Maintenances actives ou programmées
              </p>
              {[...activeMaintenances, ...scheduledMaintenances].map((win) => (
                <div
                  key={win.id}
                  className={`p-3 rounded-2xl border space-y-2 ${
                    win.status === 'active'
                      ? 'bg-amber-500/10 border-amber-500/35'
                      : 'bg-sky-500/10 border-sky-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-white text-xs">
                          {win.scope === 'globale' ? 'Maintenance GLOBALE DJASSA' : `Maintenance : ${win.appIds.join(', ')}`}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            win.status === 'active' ? 'bg-amber-500 text-black' : 'bg-sky-500/30 text-sky-200'
                          }`}
                        >
                          {win.status === 'active' ? 'ACTIVE' : 'PROGRAMMÉE'}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/60 mt-0.5">
                        Début : {formatDateTime(win.startAt)} • Fin prévue : {formatDateTime(win.endAt)} ({win.estimatedDurationMinutes} min)
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[9px] text-white/50">Compte à rebours</p>
                      <p className="font-mono font-black text-amber-300 text-xs">{formatCountdown(win.endAt, nowMs)}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-white/90 bg-black/30 p-2 rounded-xl border border-white/10">
                    « {win.customMessage} »
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-white/55">
                    <span>Sécurité, journalisation, surveillance et admins autorisés préservés</span>
                    {perms.toggleMaintenance && (win.scope !== 'globale' || isSuperAdmin) && (
                      <button
                        type="button"
                        onClick={() => void handleStopMaintenance(win)}
                        className="px-2.5 py-1 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/35 text-rose-200 font-bold cursor-pointer"
                      >
                        {win.status === 'programmee' ? 'Annuler la planification' : 'Désactiver maintenant'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create / Schedule Maintenance Form */}
          {(perms.toggleMaintenance || perms.scheduleMaintenance) ? (
            <form onSubmit={handleCreateMaintenance} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
              <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-amber-400" />
                <span>Activer ou programmer une maintenance</span>
              </h4>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMaintScope('individuelle')}
                  className={`p-2 rounded-xl border text-left cursor-pointer ${
                    maintScope === 'individuelle'
                      ? 'bg-amber-500/20 border-amber-400 text-white'
                      : 'bg-black/30 border-white/10 text-white/60'
                  }`}
                >
                  <p className="font-bold text-[11px]">Maintenance individuelle</p>
                  <p className="text-[9px] text-white/55">Cibler 1 ou plusieurs apps sans stopper le reste</p>
                </button>
                <button
                  type="button"
                  disabled={!isSuperAdmin}
                  onClick={() => setMaintScope('globale')}
                  className={`p-2 rounded-xl border text-left cursor-pointer disabled:opacity-40 ${
                    maintScope === 'globale'
                      ? 'bg-rose-500/20 border-rose-400 text-white'
                      : 'bg-black/30 border-white/10 text-white/60'
                  }`}
                >
                  <p className="font-bold text-[11px]">Maintenance globale</p>
                  <p className="text-[9px] text-white/55">
                    {isSuperAdmin ? 'Toute la plateforme (sauf sécurité & admin)' : 'Réservé au Super Admin'}
                  </p>
                </button>
              </div>

              {maintScope === 'individuelle' && (
                <div>
                  <label className="text-[10px] text-white/55 block mb-1">Applications concernées</label>
                  <div className="flex flex-wrap gap-1.5">
                    {apps.map((a) => {
                      const checked = maintAppIds.includes(a.appId);
                      return (
                        <button
                          key={a.appId}
                          type="button"
                          onClick={() =>
                            setMaintAppIds((prev) =>
                              prev.includes(a.appId) ? prev.filter((x) => x !== a.appId) : [...prev, a.appId]
                            )
                          }
                          className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-bold cursor-pointer ${
                            checked
                              ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                              : 'bg-black/30 border-white/10 text-white/60'
                          }`}
                        >
                          {checked ? '✓ ' : ''}
                          {a.shortName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!perms.toggleMaintenance}
                  onClick={() => setMaintActivateNow(true)}
                  className={`py-2 rounded-xl border text-[11px] font-bold cursor-pointer disabled:opacity-40 ${
                    maintActivateNow ? 'bg-amber-500 text-black border-amber-400' : 'bg-black/30 text-white/70 border-white/10'
                  }`}
                >
                  Activer immédiatement
                </button>
                <button
                  type="button"
                  disabled={!perms.scheduleMaintenance}
                  onClick={() => setMaintActivateNow(false)}
                  className={`py-2 rounded-xl border text-[11px] font-bold cursor-pointer disabled:opacity-40 ${
                    !maintActivateNow ? 'bg-sky-500 text-black border-sky-400' : 'bg-black/30 text-white/70 border-white/10'
                  }`}
                >
                  Programmer plus tard
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {!maintActivateNow && (
                  <div>
                    <label className="text-[10px] text-white/55 block mb-1">Date & heure de début</label>
                    <input
                      type="datetime-local"
                      value={maintStartLocal}
                      onChange={(e) => setMaintStartLocal(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white"
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="text-[10px] text-white/55 block mb-1">Durée estimée (minutes)</label>
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={maintDurationMin}
                    onChange={(e) => setMaintDurationMin(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/55 block mb-1">Message affiché aux utilisateurs</label>
                <textarea
                  rows={2}
                  value={maintMessage}
                  onChange={(e) => setMaintMessage(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white resize-none"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-white/55 block mb-1">Motif interne (journal d’audit)</label>
                <input
                  value={maintReason}
                  onChange={(e) => setMaintReason(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submittingMaint}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black cursor-pointer disabled:opacity-50"
              >
                {submittingMaint
                  ? 'Application...'
                  : maintActivateNow
                  ? 'Activer le mode maintenance'
                  : 'Enregistrer la maintenance programmée'}
              </button>
            </form>
          ) : (
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 text-[11px]">
              Vous n’avez pas la permission d’activer ou de programmer une maintenance.
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION 5: ÉTAT DES SERVICES TECHNIQUES                             */}
      {/* =================================================================== */}
      {section === 'services' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[10px] text-white/55">
            <span>Dernière sonde complète : {formatDateTime(runtimeMeta.lastProbeAt)}</span>
            <button
              type="button"
              onClick={() => void handleManualProbe()}
              disabled={probing}
              className="text-amber-300 font-bold underline cursor-pointer"
            >
              {probing ? 'Vérification...' : 'Relancer les sondes'}
            </button>
          </div>

          <div className="space-y-2">
            {services.map((svc) => {
              const st = serviceStatusBadge(svc.status);
              return (
                <div key={svc.id} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-white text-xs">{svc.name}</p>
                      <p className="text-[10px] text-white/45">{svc.configHint}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 ${st.cls}`}>
                      {st.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[10px] font-mono pt-1">
                    <div className="p-1.5 rounded-lg bg-black/30">
                      <span className="text-white/40 block font-sans">Vérifié le</span>
                      <span className="text-white/85">{formatDateTime(svc.lastCheckedAt)}</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-black/30">
                      <span className="text-white/40 block font-sans">Temps réponse</span>
                      <span className="text-white/85">
                        {svc.responseTimeMs !== null ? `${svc.responseTimeMs} ms` : '—'}
                      </span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-black/30">
                      <span className="text-white/40 block font-sans">Disponibilité</span>
                      <span className="text-white/85">
                        {svc.uptimePercent !== null ? `${svc.uptimePercent}% (${svc.successfulChecks}/${svc.totalChecks})` : 'Non mesurée'}
                      </span>
                    </div>
                  </div>

                  {svc.lastError && (
                    <p className="text-[10px] text-amber-300/90 bg-black/30 px-2 py-1.5 rounded-lg border border-white/5">
                      Détail : {svc.lastError}
                    </p>
                  )}

                  {svc.incidentHistory.length > 0 && (
                    <div className="pt-1 border-t border-white/5 space-y-0.5">
                      <p className="text-[9px] font-bold text-white/45 uppercase">Derniers incidents</p>
                      {svc.incidentHistory.slice(0, 3).map((inc) => (
                        <p key={inc.id} className="text-[10px] text-white/60">
                          [{formatDateTime(inc.at)}] {inc.message}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION 6: ERREURS TECHNIQUES & LOGS MASQUÉS                        */}
      {/* =================================================================== */}
      {section === 'errors' && (
        <div className="space-y-2.5">
          {!perms.viewTechnicalErrors ? (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs">
              Accès refusé : permission « Consulter les erreurs » requise.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1.5">
                <select
                  value={errAppFilter}
                  onChange={(e) => setErrAppFilter(e.target.value)}
                  className="px-2 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-white"
                >
                  <option value="all">Toutes apps</option>
                  {apps.map((a) => (
                    <option key={a.appId} value={a.appId}>
                      {a.shortName}
                    </option>
                  ))}
                </select>
                <select
                  value={errTypeFilter}
                  onChange={(e) => setErrTypeFilter(e.target.value)}
                  className="px-2 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-white"
                >
                  <option value="all">Tous types</option>
                  <option value="frontend">Frontend</option>
                  <option value="backend">Backend</option>
                  <option value="api">API</option>
                  <option value="database">Base de données</option>
                  <option value="network">Connexion</option>
                  <option value="deployment">Déploiement</option>
                  <option value="sync">Synchronisation</option>
                  <option value="external_service">Service externe</option>
                </select>
                <select
                  value={errStatusFilter}
                  onChange={(e) => setErrStatusFilter(e.target.value)}
                  className="px-2 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-white"
                >
                  <option value="all">Tous statuts</option>
                  <option value="nouvelle">Nouvelle</option>
                  <option value="en_cours">En cours</option>
                  <option value="resolue">Résolue</option>
                  <option value="ignoree">Ignorée</option>
                </select>
              </div>

              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>Protection active : aucun secret, mot de passe, clé API ou jeton de session n’est conservé ni affiché dans les journaux.</span>
              </div>

              {filteredErrors.length === 0 ? (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center text-white/50 text-[11px]">
                  Aucune erreur technique correspondant aux filtres.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredErrors.map((errRec) => {
                    const expanded = expandedErrId === errRec.id;
                    return (
                      <div key={errRec.id} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[10px] text-white/50">#{errRec.id}</span>
                              <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase ${severityBadge(errRec.severity)}`}>
                                {errRec.severity}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/75 text-[9px] font-bold">
                                {errRec.errorType}
                              </span>
                              {errRec.occurrenceCount > 1 && (
                                <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] font-bold">
                                  x{errRec.occurrenceCount}
                                </span>
                              )}
                            </div>
                            <p className="font-bold text-white text-xs mt-1">{errRec.serviceName} ({errRec.appId})</p>
                            <p className="text-[10px] text-white/45 font-mono">{formatDateTime(errRec.lastOccurrenceAt)}</p>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-black/40 border border-white/10 text-[10px] font-bold text-white/80 uppercase">
                            {errRec.status}
                          </span>
                        </div>

                        <p className="text-[11px] text-white/85">{errRec.description}</p>

                        <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                          <button
                            type="button"
                            onClick={() => setExpandedErrId(expanded ? null : errRec.id)}
                            className="text-[10px] font-bold text-sky-300 flex items-center gap-1 cursor-pointer"
                          >
                            <Terminal className="w-3.5 h-3.5" />
                            <span>{expanded ? 'Masquer log technique' : 'Voir log technique masqué'}</span>
                          </button>

                          <div className="flex items-center gap-1">
                            {errRec.status !== 'en_cours' && errRec.status !== 'resolue' && (
                              <button
                                type="button"
                                onClick={() => void handleUpdateErrorStatus(errRec, 'en_cours')}
                                className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-[10px] font-bold cursor-pointer"
                              >
                                Prendre en charge
                              </button>
                            )}
                            {errRec.status !== 'resolue' && (
                              <button
                                type="button"
                                onClick={() => void handleUpdateErrorStatus(errRec, 'resolue')}
                                className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-bold cursor-pointer"
                              >
                                Résolue
                              </button>
                            )}
                          </div>
                        </div>

                        {expanded && (
                          <pre className="p-2.5 rounded-xl bg-black/70 border border-white/10 text-[10px] font-mono text-white/75 whitespace-pre-wrap break-all">
                            {errRec.redactedLog}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION 7: HISTORIQUE DES MAINTENANCES                              */}
      {/* =================================================================== */}
      {section === 'maintenance_history' && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider text-white/50">
            Archives des maintenances ({maintenanceHistory.length})
          </p>
          {maintenanceHistory.length === 0 ? (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center text-white/50 text-[11px]">
              Aucune maintenance clôturée ou annulée enregistrée.
            </div>
          ) : (
            maintenanceHistory.map((win) => (
              <div key={win.id} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-white text-xs">
                    {win.scope === 'globale' ? 'Maintenance GLOBALE' : `Maintenance : ${win.appIds.join(', ')}`}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      win.status === 'terminee' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-white/50'
                    }`}
                  >
                    {win.status}
                  </span>
                </div>
                <p className="text-[10px] text-white/55 font-mono">
                  Début : {formatDateTime(win.startAt)} → Fin réelle : {formatDateTime(win.actualEndedAt || win.endAt)}
                </p>
                <p className="text-[11px] text-white/80">{win.customMessage}</p>
                <p className="text-[10px] text-white/45">
                  Initiateur : {win.createdByName} {win.endedByName ? `• Clôturée par : ${win.endedByName}` : ''} • Motif : {win.reason}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION 8: RETOUR AUX VERSIONS PRÉCÉDENTES (ROLLBACK SÉCURISÉ)      */}
      {/* =================================================================== */}
      {section === 'rollbacks' && (
        <div className="space-y-3">
          {!perms.executeRollback ? (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs">
              Accès refusé : permission « Effectuer un rollback » requise.
            </div>
          ) : (
            <>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
                <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                  <span>Analyse de compatibilité avant retour arrière</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-white/55 block mb-1">Application cible</label>
                    <select
                      value={rbAppId}
                      onChange={(e) => {
                        const nextApp = e.target.value as DjassaAppId;
                        setRbAppId(nextApp);
                        setRbVersionId('');
                        setRbPreflight(null);
                      }}
                      className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-bold"
                    >
                      {apps.map((a) => (
                        <option key={a.appId} value={a.appId}>
                          {a.name} (active: v{a.currentVersion})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-white/55 block mb-1">Version antérieure cible</label>
                    <select
                      value={rbVersionId}
                      onChange={(e) => {
                        setRbVersionId(e.target.value);
                        setRbPreflight(null);
                      }}
                      className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-bold"
                    >
                      <option value="">Dernière version éligible automatique</option>
                      {versions
                        .filter((v) => v.appId === rbAppId)
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            v{v.version} ({v.buildNumber}) — {versionStatusBadge(v.status).label}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={rbLoading}
                  onClick={() => void handleRunRollbackPreflight()}
                  className="w-full py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/35 text-sky-200 font-bold cursor-pointer disabled:opacity-50"
                >
                  {rbLoading ? 'Analyse...' : 'Vérifier compatibilité & éligibilité du rollback'}
                </button>
              </div>

              {rbPreflight && (
                <div className="p-3 rounded-2xl bg-[#131318] border border-white/15 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-white text-xs">
                      Résultat pré-contrôle ({rbPreflight.eligible ? 'ÉLIGIBLE' : 'BLOQUÉ'})
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        rbPreflight.eligible ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      v{rbPreflight.currentVersion} → {rbPreflight.targetVersion ? `v${rbPreflight.targetVersion.version}` : 'Aucune'}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {rbPreflight.checks.map((chk) => (
                      <div key={chk.id} className="p-2 rounded-xl bg-black/40 border border-white/10 flex items-start gap-2 text-[10px]">
                        {chk.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <div>
                          <p className="font-bold text-white">{chk.label}</p>
                          <p className="text-white/60">{chk.details}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {rbPreflight.warnings.map((w, i) => (
                    <p key={i} className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-[10px]">
                      ⚠ {w}
                    </p>
                  ))}

                  {rbPreflight.eligible && rbPreflight.targetVersion && (
                    <form onSubmit={handleExecuteRollback} className="space-y-2 pt-2 border-t border-white/10">
                      <div>
                        <label className="text-[10px] text-rose-300 font-bold block mb-1">
                          Confirmation renforcée : tapez exactement CONFIRMER ROLLBACK
                        </label>
                        <input
                          value={rbConfirmPhrase}
                          onChange={(e) => setRbConfirmPhrase(e.target.value)}
                          placeholder="CONFIRMER ROLLBACK"
                          className="w-full px-2.5 py-2 rounded-xl bg-black/60 border border-rose-500/40 text-white font-mono"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-white/60 block mb-1">Motif d’audit obligatoire</label>
                        <input
                          value={rbReason}
                          onChange={(e) => setRbReason(e.target.value)}
                          placeholder="Ex: Régression détectée après déploiement v1.0.1"
                          className="w-full px-2.5 py-2 rounded-xl bg-black/60 border border-white/15 text-white"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={rbLoading}
                        className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black cursor-pointer disabled:opacity-50"
                      >
                        Exécuter le retour arrière & vérifier la santé
                      </button>
                    </form>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SECTION 9: PARAMÈTRES TECHNIQUES & 8 PERMISSIONS                    */}
      {/* =================================================================== */}
      {section === 'settings_permissions' && (
        <div className="space-y-3">
          {/* Technical settings */}
          <form onSubmit={handleSaveTechnicalSettings} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
            <h4 className="text-xs font-black text-white flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-sky-400" />
              <span>Paramètres techniques de surveillance</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-white/55 block mb-1">Fréquence sondes automatiques (sec)</label>
                <input
                  type="number"
                  min={30}
                  max={3600}
                  disabled={!perms.modifyTechnicalSettings}
                  value={settingsIntervalSec}
                  onChange={(e) => setSettingsIntervalSec(Number(e.target.value))}
                  className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-mono disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/55 block mb-1">Rétention maximale erreurs techniques</label>
                <input
                  type="number"
                  min={50}
                  max={5000}
                  disabled={!perms.modifyTechnicalSettings}
                  value={settingsRetentionCap}
                  onChange={(e) => setSettingsRetentionCap(Number(e.target.value))}
                  className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-mono disabled:opacity-50"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-[11px]">
              {[
                { label: 'Sondes de santé périodiques automatiques', val: settingsAutoCheck, set: setSettingsAutoCheck },
                { label: 'Alerter Super Admin sur panne de service', val: settingsNotifyOutage, set: setSettingsNotifyOutage },
                { label: 'Alerter Super Admin sur erreur critique', val: settingsNotifyCriticalErr, set: setSettingsNotifyCriticalErr }
              ].map((t, idx) => (
                <label key={idx} className="flex items-center justify-between p-2 rounded-xl bg-black/30 border border-white/5 cursor-pointer">
                  <span className="text-white/85 font-semibold">{t.label}</span>
                  <input
                    type="checkbox"
                    disabled={!perms.modifyTechnicalSettings}
                    checked={t.val}
                    onChange={(e) => t.set(e.target.checked)}
                    className="accent-amber-500 w-4 h-4"
                  />
                </label>
              ))}
            </div>

            {perms.modifyTechnicalSettings && (
              <button
                type="submit"
                disabled={savingSettings}
                className="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black cursor-pointer disabled:opacity-50"
              >
                {savingSettings ? 'Sauvegarde...' : 'Enregistrer les paramètres techniques'}
              </button>
            )}
          </form>

          {/* 8 Granular Permissions Matrix */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
            <div>
              <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Permissions distinctes — Maintenance & Versions</span>
              </h4>
              <p className="text-[10px] text-white/50 mt-0.5">
                Le Super Administrateur gère les maintenances globales et les publications production. Les autres admins n’accèdent qu’aux droits explicitement cochés.
              </p>
            </div>

            <div className="space-y-2">
              {data.permissionsDirectory.map((member) => {
                const isMemberSuper = member.role === 'super_admin';
                const isOtherAgent = member.role === 'other_agent';
                return (
                  <div key={member.staffId} className="p-2.5 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-white text-xs">{member.name}</p>
                        <p className="text-[10px] text-white/50 font-mono">{member.email} • {member.role}</p>
                      </div>
                      {isMemberSuper && (
                        <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] font-black">
                          CONTRÔLE TOTAL IMMUABLE
                        </span>
                      )}
                      {isOtherAgent && (
                        <span className="px-2 py-0.5 rounded bg-white/10 text-white/45 text-[9px] font-bold">
                          AUCUN DROIT ADMIN
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {(Object.keys(MAINTENANCE_PERMISSION_LABELS) as MaintenancePermissionKey[]).map((permKey) => {
                        const checked = member.permissions[permKey];
                        const editable = isSuperAdmin && !isMemberSuper && !isOtherAgent;
                        return (
                          <button
                            key={permKey}
                            type="button"
                            disabled={!editable}
                            onClick={() => void handleToggleStaffPermission(member.staffId, permKey, !checked)}
                            className={`p-2 rounded-xl border text-left flex items-center justify-between gap-2 transition ${
                              checked
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                                : 'bg-white/[0.02] border-white/10 text-white/45'
                            } ${editable ? 'cursor-pointer hover:bg-white/10' : 'opacity-75 cursor-default'}`}
                          >
                            <div>
                              <p className="text-[10px] font-bold">{MAINTENANCE_PERMISSION_LABELS[permKey].label}</p>
                              <p className="text-[9px] text-white/45">{MAINTENANCE_PERMISSION_LABELS[permKey].desc}</p>
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

      {/* Step-Up MFA Modal */}
      {mfaPrompt && (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setMfaPrompt(null)}>
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
              <button
                type="button"
                onClick={() => setMfaPrompt(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white/80 font-bold cursor-pointer"
              >
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
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black cursor-pointer disabled:opacity-50"
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
