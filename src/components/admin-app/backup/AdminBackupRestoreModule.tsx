import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  Archive,
  Bell,
  CalendarClock,
  CheckCircle2,
  Database,
  Download,
  FileCheck2,
  FlaskConical,
  HardDrive,
  History,
  Image as ImageIcon,
  KeyRound,
  Layers,
  Lock,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { backupService } from '../../../services/backupService';
import { securityService } from '../../../services/securityService';
import type {
  BackupDataDomainKey,
  BackupDestinationType,
  BackupOverviewResponse,
  BackupPermissionKey,
  BackupRecord,
  BackupSpaceKey,
  BackupStatus,
  BackupType
} from '../../../types/backup';

type BackupSectionKey =
  | 'overview'
  | 'schedules'
  | 'manual'
  | 'spaces_domains'
  | 'media'
  | 'history'
  | 'restore'
  | 'restore_tests'
  | 'incidents'
  | 'retention'
  | 'settings';

interface AdminBackupRestoreModuleProps {
  onOpenNotifications?: () => void;
  onOpenAudit?: () => void;
}

const BACKUP_NAV: Array<{ id: BackupSectionKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Vue générale', icon: Activity },
  { id: 'schedules', label: 'Sauvegardes auto', icon: CalendarClock },
  { id: 'manual', label: 'Sauvegardes manuelles', icon: Play },
  { id: 'spaces_domains', label: 'Applications & données', icon: Layers },
  { id: 'media', label: 'Fichiers & médias', icon: ImageIcon },
  { id: 'history', label: 'Historique', icon: History },
  { id: 'restore', label: 'Restaurer', icon: RotateCcw },
  { id: 'restore_tests', label: 'Tests restauration', icon: FlaskConical },
  { id: 'incidents', label: 'Incidents & reprise', icon: ShieldAlert },
  { id: 'retention', label: 'Conservation & stockage', icon: HardDrive },
  { id: 'settings', label: 'Paramètres & droits', icon: Settings }
];

const STATUS_BADGE: Record<BackupStatus, { label: string; cls: string }> = {
  protegee: { label: 'Protégée', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  en_cours: { label: 'En cours', cls: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  reussie: { label: 'Réussie', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  echouee: { label: 'Échouée', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  incomplete: { label: 'Incomplète', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  a_verifier: { label: 'À vérifier', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' }
};

const SPACE_LABELS: Record<BackupSpaceKey, string> = {
  client: 'DJASSA Client',
  seller: 'DJASSA Vendeur',
  driver: 'DJASSA Livreur (Archivé)',
  company: 'DJASSA Entreprise livraison (Archivé)',
  admin: 'DJASSA Administrateur'
};

const DOMAIN_LABELS: Record<BackupDataDomainKey, string> = {
  accounts_profiles: 'Comptes & profils',
  shops_products: 'Boutiques & produits',
  orders: 'Commandes',
  messages_discussions: 'Discussions & messages',
  deliveries: 'Livraisons',
  companies_drivers: 'Entreprises & livreurs',
  wallets: 'Portefeuilles',
  transactions_commissions: 'Transactions & commissions',
  withdrawals_refunds: 'Retraits & remboursements',
  business_settings: 'Paramètres & config métier',
  activity_history: 'Historique d’activité',
  documents_pod_media: 'Documents & preuves (POD)'
};

const PERMISSION_LABELS: Record<BackupPermissionKey, string> = {
  viewBackups: 'Consulter les sauvegardes',
  runManualBackup: 'Lancer sauvegarde manuelle',
  manageSchedules: 'Modifier la planification',
  downloadBackup: 'Télécharger une archive',
  runRestoreTest: 'Lancer test de restauration',
  restoreToTestEnv: 'Restaurer vers env. test',
  restoreToProduction: 'Restaurer en production',
  deleteBackup: 'Supprimer une sauvegarde',
  manageRetentionRules: 'Modifier règles conservation',
  approveDualControlRestore: '2e validation restauration prod'
};

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 o';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

export const AdminBackupRestoreModule: React.FC<AdminBackupRestoreModuleProps> = ({
  onOpenNotifications,
  onOpenAudit
}) => {
  const { showToast } = useApp();
  const [section, setSection] = useState<BackupSectionKey>('overview');
  const [data, setData] = useState<BackupOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Manual backup form state
  const [manualType, setManualType] = useState<BackupType>('complete');
  const [manualDest, setManualDest] = useState<BackupDestinationType>('serveur_local_chiffre');
  const [manualSpaces, setManualSpaces] = useState<BackupSpaceKey[]>(['client', 'seller', 'admin']);
  const [manualDomains, setManualDomains] = useState<BackupDataDomainKey[]>(
    Object.keys(DOMAIN_LABELS) as BackupDataDomainKey[]
  );
  const [manualNote, setManualNote] = useState('');

  // History filters & detail view
  const [histSearch, setHistSearch] = useState('');
  const [histTypeFilter, setHistTypeFilter] = useState<'all' | BackupType>('all');
  const [histStatusFilter, setHistStatusFilter] = useState<'all' | BackupStatus>('all');
  const [histSpaceFilter, setHistSpaceFilter] = useState<'all' | BackupSpaceKey>('all');
  const [selectedBackupDetail, setSelectedBackupDetail] = useState<BackupRecord | null>(null);

  // Restore form state
  const [restoreBackupId, setRestoreBackupId] = useState('');
  const [restoreTargetEnv, setRestoreTargetEnv] = useState<'test_env' | 'production'>('test_env');
  const [restoreMode, setRestoreMode] = useState<'complete' | 'perimetre' | 'metier' | 'medias'>('complete');
  const [restoreSpaces, setRestoreSpaces] = useState<BackupSpaceKey[]>(['client', 'seller', 'admin']);
  const [restoreDomains, setRestoreDomains] = useState<BackupDataDomainKey[]>(
    Object.keys(DOMAIN_LABELS) as BackupDataDomainKey[]
  );
  const [restoreReason, setRestoreReason] = useState('');
  const [restoreConfirmText, setRestoreConfirmText] = useState('');

  // MFA Modal
  const [mfaModal, setMfaModal] = useState<{
    title: string;
    challengeCode: string | null;
    codeInput: string;
    onVerified: (code: string) => Promise<void>;
  } | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await backupService.getOverview();
      setData(res);
      if (res.backups.length > 0 && !restoreBackupId) {
        const firstValid = res.backups.find((b) => b.integrityResult === 'valide');
        if (firstValid) setRestoreBackupId(firstValid.id);
      }
      setSelectedBackupDetail((prev) => (prev ? res.backups.find((b) => b.id === prev.id) || prev : null));
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Impossible de charger les sauvegardes.');
    } finally {
      setLoading(false);
    }
  }, [restoreBackupId]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const requestMfaAndRun = async (title: string, fn: (code: string) => Promise<void>) => {
    try {
      const challenge = await securityService.requestMfaChallenge();
      setMfaModal({
        title,
        challengeCode: challenge.verificationCodePreview || null,
        codeInput: challenge.verificationCodePreview || '',
        onVerified: fn
      });
    } catch (err: unknown) {
      showToast((err as Error).message || 'Erreur initialisation MFA');
    }
  };

  const handleConfirmMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaModal) return;
    const modal = mfaModal;
    setBusy(true);
    try {
      await modal.onVerified(modal.codeInput.trim());
      setMfaModal(null);
      await loadOverview();
    } catch (err: unknown) {
      showToast((err as Error).message || 'Opération refusée');
    } finally {
      setBusy(false);
    }
  };

  const handleRunManualBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await backupService.runBackup({
        type: manualType,
        spacesCovered: manualSpaces,
        domainsCovered: manualDomains,
        destination: manualDest,
        note: manualNote
      });
      showToast(`Sauvegarde ${res.backup.id} exécutée (${res.backup.status})`);
      setManualNote('');
      await loadOverview();
    } catch (err: unknown) {
      showToast((err as Error).message || 'Échec de la sauvegarde');
    } finally {
      setBusy(false);
    }
  };

  const handleRequestRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreBackupId) {
      showToast('Sélectionnez d’abord une sauvegarde valide');
      return;
    }
    await requestMfaAndRun(
      restoreTargetEnv === 'production'
        ? `Restauration PRODUCTION (${restoreBackupId})`
        : `Restauration environnement de TEST (${restoreBackupId})`,
      async (code) => {
        const res = await backupService.requestRestore(
          restoreBackupId,
          {
            targetEnv: restoreTargetEnv,
            restoreMode,
            spacesSelected: restoreSpaces,
            domainsSelected: restoreDomains,
            reason: restoreReason.trim(),
            confirmationText: restoreConfirmText.trim()
          },
          code
        );
        setRestoreConfirmText('');
        setRestoreReason('');
        showToast(
          res.restoreRequest.requiresDualValidation
            ? 'Demande créée — double validation d’un 2e admin requise avant exécution'
            : res.restoreRequest.executionSummary || 'Restauration terminée'
        );
      }
    );
  };

  if (loading && !data) {
    return (
      <div className="p-6 rounded-2xl bg-[#141414] border border-white/10 text-center space-y-2">
        <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin mx-auto" />
        <p className="text-xs font-bold text-white/70">Inspection des sauvegardes & stockages DJASSA...</p>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-3 text-center">
        <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto" />
        <p className="text-xs font-bold text-rose-200">{errorMsg || 'Données indisponibles'}</p>
        <button
          onClick={() => void loadOverview()}
          className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white cursor-pointer"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const perms = data.actor.permissions;
  const filteredBackups = data.backups.filter((b) => {
    if (histTypeFilter !== 'all' && b.type !== histTypeFilter) return false;
    if (histStatusFilter !== 'all' && b.status !== histStatusFilter) return false;
    if (histSpaceFilter !== 'all' && !b.spacesCovered.includes(histSpaceFilter)) return false;
    if (histSearch.trim()) {
      const q = histSearch.trim().toLowerCase();
      const hay = `${b.id} ${b.type} ${b.triggeredByName} ${b.note}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const selectedRestoreBackup = data.backups.find((b) => b.id === restoreBackupId) || null;

  return (
    <div id="admin-backup-restore-module" className="space-y-3.5 text-xs text-white">
      {/* Compact Header */}
      <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Archive className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-white">Sauvegardes & restauration</h3>
              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${STATUS_BADGE[data.kpis.overallStatus].cls}`}>
                {STATUS_BADGE[data.kpis.overallStatus].label}
              </span>
            </div>
            <p className="text-[11px] text-white/55">{data.kpis.protectionStateLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {onOpenNotifications && (
            <button
              onClick={onOpenNotifications}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-white/80 flex items-center gap-1.5 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-[#FF6321]" />
              <span>Notifications</span>
            </button>
          )}
          {onOpenAudit && (
            <button
              onClick={onOpenAudit}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-white/80 flex items-center gap-1.5 cursor-pointer"
            >
              <History className="w-3.5 h-3.5 text-amber-400" />
              <span>Journal d’audit</span>
            </button>
          )}
          <button
            onClick={() => void loadOverview()}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[11px] font-bold text-emerald-300 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* 11-Section Compact Horizontal Nav */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {BACKUP_NAV.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`shrink-0 px-2.5 py-2 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                active
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                  : 'bg-[#141414] border-white/10 text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* 1. VUE GÉNÉRALE                                                       */}
      {/* ===================================================================== */}
      {section === 'overview' && (
        <div className="space-y-3">
          {data.kpis.untestedBackupsCount > 0 && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-200">
                <strong>Fiabilité à confirmer :</strong> {data.kpis.untestedBackupsCount} sauvegarde(s) n’ont pas encore fait l’objet d’un test de restauration isolé.
              </p>
            </div>
          )}

          {/* 9 Required KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: 'État général', val: STATUS_BADGE[data.kpis.overallStatus].label, cls: 'text-emerald-300' },
              {
                label: 'Dernière sauvegarde réussie',
                val: data.kpis.lastSuccessfulBackupAt
                  ? new Date(data.kpis.lastSuccessfulBackupAt).toLocaleString('fr-FR')
                  : 'Aucune',
                cls: 'text-white'
              },
              {
                label: 'Prochaine programmée',
                val: data.kpis.nextScheduledBackupAt
                  ? new Date(data.kpis.nextScheduledBackupAt).toLocaleString('fr-FR')
                  : 'Désactivée',
                cls: 'text-amber-300'
              },
              { label: 'Sauvegardes disponibles', val: String(data.kpis.availableBackupsCount), cls: 'text-emerald-300' },
              { label: 'Volume total sauvegardé', val: formatBytes(data.kpis.totalBackedUpBytes), cls: 'text-white' },
              {
                label: 'Espace de stockage utilisé',
                val: `${formatBytes(data.kpis.storageUsedBytes)} (${data.kpis.storageUsagePercent}%)`,
                cls: data.kpis.storageUsagePercent >= 80 ? 'text-amber-300' : 'text-white'
              },
              { label: 'Sauvegardes échouées', val: String(data.kpis.failedBackupsCount), cls: data.kpis.failedBackupsCount > 0 ? 'text-rose-400' : 'text-white/70' },
              {
                label: 'Dernier test restauration',
                val: data.kpis.lastRestoreTestAt
                  ? `${new Date(data.kpis.lastRestoreTestAt).toLocaleDateString('fr-FR')} (${data.kpis.lastRestoreTestResult})`
                  : 'Jamais testé',
                cls: data.kpis.lastRestoreTestResult === 'reussi' ? 'text-emerald-300' : 'text-amber-300'
              },
              {
                label: 'Protection & chiffrement',
                val: data.retentionSettings.encryptSensitiveBackups ? 'AES-256-GCM + Clé isolée' : 'Non chiffré',
                cls: 'text-emerald-300'
              }
            ].map((k) => (
              <div key={k.label} className="p-3 rounded-2xl bg-[#141414] border border-white/10">
                <p className="text-[10px] text-white/50 font-medium">{k.label}</p>
                <p className={`text-xs font-black mt-1 font-mono tabular-nums ${k.cls}`}>{k.val}</p>
              </div>
            ))}
          </div>

          {/* Quick Action + Real Infrastructure Status */}
          <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-white/70">
                Capacités réelles de sauvegarde des fournisseurs
              </h4>
              {perms.runManualBackup && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void backupService
                      .runBackup({
                        type: 'complete',
                        spacesCovered: ['client', 'seller', 'admin'],
                        domainsCovered: Object.keys(DOMAIN_LABELS) as BackupDataDomainKey[],
                        destination: data.retentionSettings.defaultDestination,
                        note: 'Sauvegarde complète immédiate depuis Vue générale'
                      })
                      .then((res) => {
                        showToast(`Sauvegarde ${res.backup.id} créée (${res.backup.status})`);
                        void loadOverview();
                      })
                      .catch((err) => showToast((err as Error).message))
                  }
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[11px] flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Lancer une sauvegarde complète</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                data.providerCapabilities.backendStorage,
                data.providerCapabilities.supabase,
                data.providerCapabilities.cloudflareR2
              ].map((p) => (
                <div key={p.provider} className="p-2.5 rounded-xl bg-black/40 border border-white/10 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold text-white text-[11px]">{p.provider}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                        p.configured ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/50'
                      }`}
                    >
                      {p.configured ? 'Configuré' : 'Non configuré'}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/60">{p.capabilities}</p>
                  <p className="text-[10px] text-amber-300/80">Limite : {p.limits}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. SAUVEGARDES AUTOMATIQUES (PLANIFICATEUR SERVEUR)                   */}
      {/* ===================================================================== */}
      {section === 'schedules' && (
        <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[11px] text-emerald-200">
            Exécuté par le planificateur serveur Node.js avec verrou anti-chevauchement (aucune dépendance au navigateur).
          </div>
          {data.schedules.map((s) => (
            <div key={s.id} className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-white">{s.name}</p>
                  <p className="text-[10px] text-white/55">
                    Fréquence: <span className="text-amber-300 font-bold">{s.frequency}</span> • Type: {s.backupType} • Heure: {s.executionTimeHHMM} ({s.timezone}) • Destination: {s.destination}
                  </p>
                  <p className="text-[10px] text-white/45">
                    Prochaine exécution : {new Date(s.nextRunAt).toLocaleString('fr-FR')} • Dernière :{' '}
                    {s.lastRunAt ? `${new Date(s.lastRunAt).toLocaleString('fr-FR')} (${s.lastRunStatus})` : 'Jamais'}
                  </p>
                </div>
                {perms.manageSchedules && (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      defaultValue={s.executionTimeHHMM}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val && val !== s.executionTimeHHMM) {
                          void requestMfaAndRun(`Modifier heure planification ${s.name}`, async (code) => {
                            await backupService.updateSchedule(s.id, { executionTimeHHMM: val }, code);
                            showToast('Heure de planification mise à jour');
                          });
                        }
                      }}
                      className="px-2 py-1 rounded-lg bg-[#1A1A1A] border border-white/15 text-[11px] text-white"
                    />
                    <button
                      onClick={() =>
                        void requestMfaAndRun(`${s.enabled ? 'Désactiver' : 'Activer'} ${s.name}`, async (code) => {
                          await backupService.updateSchedule(s.id, { enabled: !s.enabled }, code);
                          showToast('Planification mise à jour');
                        })
                      }
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer ${
                        s.enabled ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/60'
                      }`}
                    >
                      {s.enabled ? 'Active' : 'En pause'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. SAUVEGARDES MANUELLES                                              */}
      {/* ===================================================================== */}
      {section === 'manual' && (
        <form onSubmit={handleRunManualBackup} className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-3">
          <h4 className="font-black text-white">Déclencher une sauvegarde serveur immédiate</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] text-white/55 font-bold block mb-1">Type de sauvegarde</label>
              <select
                value={manualType}
                onChange={(e) => setManualType(e.target.value as BackupType)}
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white font-bold outline-none"
              >
                <option value="complete">Sauvegarde complète</option>
                <option value="incrementale">Sauvegarde incrémentale (deltas depuis la base)</option>
                <option value="avant_operation_sensible">Sauvegarde avant opération sensible</option>
                <option value="manuelle">Sauvegarde manuelle ponctuelle</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-white/55 font-bold block mb-1">Destination de stockage</label>
              <select
                value={manualDest}
                onChange={(e) => setManualDest(e.target.value as BackupDestinationType)}
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white font-bold outline-none"
              >
                <option value="serveur_local_chiffre">Serveur principal chiffré (+ réplique isolée si active)</option>
                <option value="copie_independante_froid">Copie indépendante à froid (prioritaire)</option>
                <option value="cloudflare_r2_replication">Réplication R2 (fallback local si non configuré)</option>
              </select>
            </div>
          </div>

          <div>
            <p className="text-[10px] text-white/55 font-bold mb-1">Espaces DJASSA inclus (snapshot unifié sans duplication inutile)</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(SPACE_LABELS) as BackupSpaceKey[]).map((sp) => {
                const checked = manualSpaces.includes(sp);
                return (
                  <button
                    key={sp}
                    type="button"
                    onClick={() =>
                      setManualSpaces((prev) =>
                        prev.includes(sp) ? (prev.length > 1 ? prev.filter((x) => x !== sp) : prev) : [...prev, sp]
                      )
                    }
                    className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold cursor-pointer ${
                      checked
                        ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                        : 'bg-black/40 border-white/10 text-white/50'
                    }`}
                  >
                    {SPACE_LABELS[sp]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[10px] text-white/55 font-bold mb-1">Périmètres de données métier inclus</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(DOMAIN_LABELS) as BackupDataDomainKey[]).map((dom) => {
                const checked = manualDomains.includes(dom);
                return (
                  <button
                    key={dom}
                    type="button"
                    onClick={() =>
                      setManualDomains((prev) =>
                        prev.includes(dom) ? (prev.length > 1 ? prev.filter((x) => x !== dom) : prev) : [...prev, dom]
                      )
                    }
                    className={`px-2 py-1 rounded-lg border text-[10px] font-bold cursor-pointer ${
                      checked ? 'bg-amber-500/15 border-amber-400/40 text-amber-200' : 'bg-black/40 border-white/10 text-white/45'
                    }`}
                  >
                    {DOMAIN_LABELS[dom]}
                  </button>
                );
              })}
            </div>
          </div>

          <input
            type="text"
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            placeholder="Note / contexte (ex: Avant mise à jour v2.5)..."
            className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white outline-none"
          />

          <button
            type="submit"
            disabled={busy || !perms.runManualBackup}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs cursor-pointer disabled:opacity-40"
          >
            {busy ? 'Exécution & vérification SHA-256...' : 'Exécuter la sauvegarde maintenant'}
          </button>
        </form>
      )}

      {/* ===================================================================== */}
      {/* 4. APPLICATIONS & DONNÉES (5 ESPACES SANS COPIES REDONDANTES)         */}
      {/* ===================================================================== */}
      {section === 'spaces_domains' && (
        <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-3">
          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-white/75">
            Chaque sauvegarde unifiée identifie les entités des <strong>5 applications DJASSA</strong> sans dupliquer inutilement la base de données, tout en excluant les secrets/mots de passe/OTP/clés.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(data.backups[0]?.spaceStats ||
              (Object.keys(SPACE_LABELS) as BackupSpaceKey[]).map((sp) => ({
                space: sp,
                label: SPACE_LABELS[sp],
                accountsCount: 0,
                entitiesCount: 0,
                included: true
              }))).map((st) => (
              <div key={st.space} className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">{st.label}</p>
                  <p className="text-[10px] text-white/50">
                    Comptes recensés : {st.accountsCount} • Entités métier : {st.entitiesCount}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px] font-bold">
                  {st.included ? 'Couvert' : 'Exclu'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. FICHIERS & MÉDIAS (CLOUDFLARE R2 + DISQUE)                         */}
      {/* ===================================================================== */}
      {section === 'media' && (
        <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200">
            {data.latestMediaCheck.r2StatusDetail}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
              <p className="text-[10px] text-white/50">Fichiers référencés</p>
              <p className="text-sm font-black text-white font-mono">{data.latestMediaCheck.totalReferencedFiles}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
              <p className="text-[10px] text-white/50">Locaux vérifiés</p>
              <p className="text-sm font-black text-emerald-300 font-mono">{data.latestMediaCheck.verifiedLocalFiles}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
              <p className="text-[10px] text-white/50">URLs externes / R2</p>
              <p className="text-sm font-black text-sky-300 font-mono">{data.latestMediaCheck.externalRemoteUrls}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
              <p className="text-[10px] text-white/50">Manquants / cassés</p>
              <p className={`text-sm font-black font-mono ${data.latestMediaCheck.missingOrBrokenCount > 0 ? 'text-rose-400' : 'text-emerald-300'}`}>
                {data.latestMediaCheck.missingOrBrokenCount}
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            {data.latestMediaCheck.categories.map((c) => (
              <div key={c.key} className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                <span className="font-bold text-white">{c.label}</span>
                <span className="text-[11px] font-mono text-white/70">
                  {c.count} réf. • {c.verifiedCount} vérifié(s) • <span className={c.missingCount > 0 ? 'text-rose-400' : 'text-emerald-300'}>{c.missingCount} manquant(s)</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. HISTORIQUE DES SAUVEGARDES                                         */}
      {/* ===================================================================== */}
      {section === 'history' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 p-2.5 rounded-2xl bg-[#111111] border border-white/10">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={histSearch}
                onChange={(e) => setHistSearch(e.target.value)}
                placeholder="Rechercher ID, admin, note..."
                className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-black/50 border border-white/10 text-[11px] text-white outline-none"
              />
            </div>
            <select
              value={histTypeFilter}
              onChange={(e) => setHistTypeFilter(e.target.value as 'all' | BackupType)}
              className="px-2 py-1.5 rounded-xl bg-black/50 border border-white/10 text-[11px] font-bold text-white"
            >
              <option value="all">Tous types</option>
              <option value="complete">Complète</option>
              <option value="incrementale">Incrémentale</option>
              <option value="avant_operation_sensible">Avant op. sensible</option>
              <option value="automatique">Automatique</option>
              <option value="manuelle">Manuelle</option>
            </select>
            <select
              value={histStatusFilter}
              onChange={(e) => setHistStatusFilter(e.target.value as 'all' | BackupStatus)}
              className="px-2 py-1.5 rounded-xl bg-black/50 border border-white/10 text-[11px] font-bold text-white"
            >
              <option value="all">Tous statuts</option>
              <option value="protegee">Protégée</option>
              <option value="reussie">Réussie</option>
              <option value="echouee">Échouée</option>
              <option value="incomplete">Incomplète</option>
              <option value="a_verifier">À vérifier</option>
            </select>
            <select
              value={histSpaceFilter}
              onChange={(e) => setHistSpaceFilter(e.target.value as 'all' | BackupSpaceKey)}
              className="px-2 py-1.5 rounded-xl bg-black/50 border border-white/10 text-[11px] font-bold text-white"
            >
              <option value="all">Tous espaces</option>
              {(Object.keys(SPACE_LABELS) as BackupSpaceKey[]).map((sp) => (
                <option key={sp} value={sp}>
                  {SPACE_LABELS[sp]}
                </option>
              ))}
            </select>
          </div>

          {filteredBackups.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#141414] border border-white/10 text-center text-white/45">
              Aucune sauvegarde enregistrée ne correspond aux filtres.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredBackups.map((b) => (
                <div key={b.id} className="p-3 rounded-2xl bg-[#141414] border border-white/10 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-white">{b.id}</span>
                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-bold">{b.type}</span>
                      <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${STATUS_BADGE[b.status].cls}`}>
                        {STATUS_BADGE[b.status].label}
                      </span>
                      {b.legalHold && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-400/40 text-purple-200 text-[9px] font-bold">
                          Gel légal
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-emerald-300 font-bold">{formatBytes(b.storedBytes)}</span>
                  </div>
                  <p className="text-[10px] text-white/55">
                    {new Date(b.createdAt).toLocaleString('fr-FR')} • Durée: {b.durationMs} ms • Intégrité:{' '}
                    <span className="font-bold text-white">{b.integrityResult}</span> • Test restau:{' '}
                    <span className="font-bold text-amber-300">{b.lastRestoreTestResult}</span> • Par: {b.triggeredByName}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() =>
                        void backupService
                          .getDetails(b.id)
                          .then((res) => setSelectedBackupDetail(res.backup))
                          .catch((err) => showToast((err as Error).message))
                      }
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[10px] font-bold cursor-pointer"
                    >
                      Détails
                    </button>
                    <button
                      onClick={() =>
                        void backupService
                          .verifyIntegrity(b.id)
                          .then((res) => {
                            showToast(res.message);
                            void loadOverview();
                          })
                          .catch((err) => showToast((err as Error).message))
                      }
                      className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold cursor-pointer"
                    >
                      Vérifier intégrité
                    </button>
                    {perms.runRestoreTest && (
                      <button
                        onClick={() =>
                          void backupService
                            .runRestoreTest(b.id)
                            .then((res) => {
                              showToast(res.report.summary);
                              void loadOverview();
                            })
                            .catch((err) => showToast((err as Error).message))
                        }
                        className="px-2 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 text-[10px] font-bold cursor-pointer"
                      >
                        Tester restauration
                      </button>
                    )}
                    {perms.downloadBackup && (
                      <button
                        onClick={() =>
                          void requestMfaAndRun(`Télécharger archive ${b.id}`, async (code) => {
                            await backupService.downloadEncryptedArchive(b.id, code);
                            showToast('Archive chiffrée téléchargée');
                          })
                        }
                        className="px-2 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Télécharger (.enc)</span>
                      </button>
                    )}
                    {perms.manageRetentionRules && (
                      <button
                        onClick={() =>
                          void backupService
                            .toggleLegalHold(b.id, !b.legalHold, 'Verrouillage enquête / conservation légale')
                            .then(() => {
                              showToast(b.legalHold ? 'Gel légal retiré' : 'Gel légal activé');
                              void loadOverview();
                            })
                            .catch((err) => showToast((err as Error).message))
                        }
                        className="px-2 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-200 text-[10px] font-bold cursor-pointer"
                      >
                        {b.legalHold ? 'Lever gel légal' : 'Gel légal'}
                      </button>
                    )}
                    {perms.deleteBackup && (
                      <button
                        onClick={() =>
                          void requestMfaAndRun(`Supprimer sauvegarde ${b.id}`, async (code) => {
                            await backupService.deleteBackup(b.id, code);
                            showToast('Sauvegarde supprimée');
                          })
                        }
                        className="px-2 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Supprimer</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedBackupDetail && (
            <div className="p-3.5 rounded-2xl bg-black/60 border border-white/15 space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="font-black text-white">Détail protégé : {selectedBackupDetail.id}</h5>
                <button onClick={() => setSelectedBackupDetail(null)} className="text-white/50 hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] font-mono text-white/60 break-all">
                SHA-256 : {selectedBackupDetail.checksumSha256} • Algo : {selectedBackupDetail.encryptionAlgorithm} • Copie indépendante :{' '}
                {selectedBackupDetail.independentCopyExists ? 'Oui' : 'Non'}
              </p>
              <p className="text-[10px] text-white/60">
                Consultations & opérations tracées : {selectedBackupDetail.accessHistory.length}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 7. RESTAURER UNE SAUVEGARDE (CONTRÔLES + DOUBLE VALIDATION PROD)       */}
      {/* ===================================================================== */}
      {section === 'restore' && (
        <div className="space-y-3">
          <form onSubmit={handleRequestRestore} className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-3">
            <h4 className="font-black text-white flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>Assistant de restauration contrôlée</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={restoreBackupId}
                onChange={(e) => setRestoreBackupId(e.target.value)}
                className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-white font-bold"
              >
                <option value="">Choisir une sauvegarde...</option>
                {data.backups.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.id} ({b.type} • {b.integrityResult})
                  </option>
                ))}
              </select>
              <select
                value={restoreTargetEnv}
                onChange={(e) => setRestoreTargetEnv(e.target.value as 'test_env' | 'production')}
                className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-white font-bold"
              >
                <option value="test_env">Environnement de test isolé (recommandé)</option>
                <option value="production">Production (sauvegarde sécurité + double validation)</option>
              </select>
              <select
                value={restoreMode}
                onChange={(e) => setRestoreMode(e.target.value as 'complete' | 'perimetre' | 'metier' | 'medias')}
                className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-white font-bold"
              >
                <option value="complete">Restauration complète</option>
                <option value="perimetre">Périmètre d’espaces sélectionné</option>
                <option value="metier">Données métier spécifiques</option>
                <option value="medias">Fichiers & médias</option>
              </select>
            </div>

            {selectedRestoreBackup && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1 text-[11px]">
                <p className="font-bold text-amber-200">Impact avant restauration ({selectedRestoreBackup.id})</p>
                <p className="text-white/75">
                  Date archive : {new Date(selectedRestoreBackup.createdAt).toLocaleString('fr-FR')} • Intégrité :{' '}
                  <strong>{selectedRestoreBackup.integrityResult}</strong> • Compatibilité schéma :{' '}
                  <strong>{selectedRestoreBackup.schemaVersion === data.schemaVersion ? 'Compatible' : 'Incompatible'}</strong>
                </p>
                <p className="text-rose-200">
                  Risque : une restauration en production peut remplacer les modifications postérieures au {new Date(selectedRestoreBackup.createdAt).toLocaleString('fr-FR')}. Une sauvegarde de sécurité préalable sera créée automatiquement.
                </p>
              </div>
            )}

            <input
              type="text"
              required
              value={restoreReason}
              onChange={(e) => setRestoreReason(e.target.value)}
              placeholder="Motif vérifiable de la restauration *"
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white outline-none"
            />
            <input
              type="text"
              required
              value={restoreConfirmText}
              onChange={(e) => setRestoreConfirmText(e.target.value)}
              placeholder="Taper exactement : CONFIRMER RESTAURATION *"
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-amber-500/30 text-amber-200 font-mono font-bold outline-none"
            />
            <button
              type="submit"
              disabled={busy || !restoreBackupId}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs cursor-pointer disabled:opacity-40"
            >
              Lancer la procédure de restauration (MFA)
            </button>
          </form>

          {/* Pending / Completed Restore Requests */}
          <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-white/70">
              Demandes & exécutions de restauration ({data.restoreRequests.length})
            </h4>
            {data.restoreRequests.length === 0 ? (
              <p className="text-[11px] text-white/40 py-4 text-center">Aucune demande de restauration enregistrée.</p>
            ) : (
              data.restoreRequests.map((r) => {
                const isOwn = r.requestedById === data.actor.staffId;
                return (
                  <div key={r.id} className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-white">
                        {r.backupId} → {r.targetEnv === 'production' ? 'PRODUCTION' : 'TEST ISOLÉ'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-bold">{r.status}</span>
                    </div>
                    <p className="text-[10px] text-white/55">
                      Demandeur: {r.requestedByName} • Motif: {r.reason}
                      {r.executionSummary ? ` • Résultat: ${r.executionSummary}` : ''}
                    </p>
                    {r.status === 'en_attente_double_validation' && perms.approveDualControlRestore && (
                      <div className="flex gap-2 pt-1">
                        {!isOwn ? (
                          <button
                            onClick={() =>
                              void requestMfaAndRun(`2e validation restauration ${r.backupId}`, async (code) => {
                                await backupService.decideRestoreRequest(r.id, 'approve', code);
                                showToast('Restauration production approuvée et exécutée');
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-emerald-500 text-black font-black text-[10px] cursor-pointer"
                          >
                            Approuver (2e valideur + MFA)
                          </button>
                        ) : (
                          <span className="text-[10px] text-amber-300 font-bold">
                            Auto-validation interdite : un 2e admin distinct est requis.
                          </span>
                        )}
                        <button
                          onClick={() =>
                            void requestMfaAndRun(`Rejeter restauration ${r.id}`, async (code) => {
                              await backupService.decideRestoreRequest(r.id, isOwn ? 'cancel' : 'reject', code);
                              showToast(isOwn ? 'Demande annulée' : 'Demande rejetée');
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-200 font-bold text-[10px] cursor-pointer"
                        >
                          {isOwn ? 'Annuler' : 'Rejeter'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 8. TESTS DE RESTAURATION                                              */}
      {/* ===================================================================== */}
      {section === 'restore_tests' && (
        <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="font-black text-white">Tests de restauration isolés (zéro impact production)</h4>
              <p className="text-[10px] text-white/50">
                Vérifie déchiffrement, SHA-256, schéma, cohérence financière, médias et temps de reprise.
              </p>
            </div>
            {perms.runRestoreTest && data.backups[0] && (
              <button
                onClick={() =>
                  void backupService
                    .runRestoreTest(data.backups[0].id)
                    .then((res) => {
                      showToast(res.report.summary);
                      void loadOverview();
                    })
                    .catch((err) => showToast((err as Error).message))
                }
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] cursor-pointer"
              >
                Tester la dernière sauvegarde
              </button>
            )}
          </div>
          {data.restoreTests.length === 0 ? (
            <p className="text-[11px] text-white/40 py-6 text-center">Aucun test de restauration exécuté pour le moment.</p>
          ) : (
            data.restoreTests.map((t) => (
              <div key={t.id} className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white font-mono">{t.backupId}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      t.result === 'reussi' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                    }`}
                  >
                    {t.result.toUpperCase()} • {t.durationMs} ms
                  </span>
                </div>
                <p className="text-[10px] text-white/60">{t.summary}</p>
                {t.errorsDetected.length > 0 && (
                  <ul className="text-[10px] text-rose-300">
                    {t.errorsDetected.map((e, i) => (
                      <li key={i}>• {e}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 9. INCIDENTS & RÉCUPÉRATION (9 PROCÉDURES)                            */}
      {/* ===================================================================== */}
      {section === 'incidents' && (
        <div className="space-y-2">
          {data.playbooks.map((pb) => (
            <div key={pb.id} className="p-3 rounded-2xl bg-[#141414] border border-white/10 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-white">{pb.title}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    pb.severity === 'critique' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {pb.severity}
                </span>
              </div>
              <p className="text-[10px] text-white/60">{pb.description}</p>
              <p className="text-[10px] text-emerald-300 font-bold">Source recommandée : {pb.recommendedBackupType}</p>
              <ul className="text-[10px] text-white/70 space-y-0.5 pl-1">
                {pb.steps.map((st, idx) => (
                  <li key={idx}>{st}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 10. CONSERVATION & STOCKAGE                                           */}
      {/* ===================================================================== */}
      {section === 'retention' && (
        <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5">
          <h4 className="font-black text-white">Règles de conservation & protection stockage</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Quotidiennes gardées', val: `${data.retentionSettings.keepDailyCount}` },
              { label: 'Hebdomadaires gardées', val: `${data.retentionSettings.keepWeeklyCount}` },
              { label: 'Mensuelles gardées', val: `${data.retentionSettings.keepMonthlyCount}` },
              { label: 'Capacité max', val: `${data.retentionSettings.maxStorageCapacityMb} Mo` }
            ].map((item) => (
              <div key={item.label} className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                <p className="text-[10px] text-white/50">{item.label}</p>
                <p className="text-sm font-black font-mono text-white mt-0.5">{item.val}</p>
              </div>
            ))}
          </div>
          {[
            {
              key: 'encryptSensitiveBackups' as const,
              label: 'Chiffrer les sauvegardes sensibles (AES-256-GCM)',
              val: data.retentionSettings.encryptSensitiveBackups
            },
            {
              key: 'replicateIndependentCopy' as const,
              label: 'Maintenir une copie indépendante isolée (offsite locale)',
              val: data.retentionSettings.replicateIndependentCopy
            },
            {
              key: 'requireDualValidationForProdRestore' as const,
              label: 'Double validation obligatoire pour restauration production',
              val: data.retentionSettings.requireDualValidationForProdRestore
            }
          ].map((row) => (
            <div key={row.key} className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-white/85">{row.label}</span>
              <button
                disabled={!perms.manageRetentionRules}
                onClick={() =>
                  void requestMfaAndRun(`Modifier ${row.key}`, async (code) => {
                    await backupService.updateRetentionSettings({ [row.key]: !row.val }, code);
                    showToast('Paramètre de conservation mis à jour');
                  })
                }
                className={`px-3 py-1 rounded-lg text-[10px] font-black cursor-pointer disabled:opacity-40 ${
                  row.val ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/60'
                }`}
              >
                {row.val ? 'Activé' : 'Désactivé'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 11. PARAMÈTRES & PERMISSIONS                                          */}
      {/* ===================================================================== */}
      {section === 'settings' && (
        <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5">
          <h4 className="text-[11px] font-black uppercase tracking-wider text-white/70 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Permissions Sauvegardes & Restauration par administrateur</span>
          </h4>
          {data.staffPermissions.map((st) => (
            <div key={st.staffId} className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">{st.name}</p>
                  <p className="text-[10px] text-white/45">{st.email} • {st.title}</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-white/10 text-[9px] font-bold">{st.role}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(PERMISSION_LABELS) as BackupPermissionKey[]).map((pk) => {
                  const active = st.permissions[pk];
                  const canEdit = data.actor.role === 'super_admin' && st.role !== 'super_admin';
                  return (
                    <button
                      key={pk}
                      disabled={!canEdit}
                      onClick={() =>
                        void requestMfaAndRun(`Permission ${pk} (${st.name})`, async (code) => {
                          await backupService.updateStaffPermissions(st.staffId, { [pk]: !active }, code);
                          showToast('Permissions mises à jour');
                        })
                      }
                      className={`px-2 py-1 rounded-lg border text-[10px] font-bold ${
                        active
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : 'bg-white/5 border-white/10 text-white/40'
                      } ${canEdit ? 'cursor-pointer hover:brightness-125' : 'opacity-70 cursor-default'}`}
                    >
                      {PERMISSION_LABELS[pk]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Step-Up MFA Verification Modal */}
      {mfaModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#161616] border border-emerald-500/30 p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span>Validation MFA requise</span>
              </h4>
              <button
                onClick={() => setMfaModal(null)}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-white/65">{mfaModal.title}</p>
            {mfaModal.challengeCode && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-center">
                <p className="text-[10px] text-white/60">Code MFA temporaire :</p>
                <p className="text-base font-black font-mono text-emerald-300 tracking-widest mt-0.5">
                  {mfaModal.challengeCode}
                </p>
              </div>
            )}
            <form onSubmit={handleConfirmMfa} className="space-y-2.5">
              <input
                type="text"
                required
                value={mfaModal.codeInput}
                onChange={(e) => setMfaModal({ ...mfaModal, codeInput: e.target.value })}
                placeholder="Saisir le code MFA..."
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-center font-mono text-white font-bold outline-none focus:border-emerald-400"
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black cursor-pointer disabled:opacity-50"
              >
                {busy ? 'Exécution en cours...' : 'Confirmer'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
