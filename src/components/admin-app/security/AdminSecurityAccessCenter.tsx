import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  Filter,
  Globe,
  History,
  KeyRound,
  Landmark,
  Lock,
  LogIn,
  Plus,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Sliders,
  Smartphone,
  Unlock,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  Wallet,
  X
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { formatFCFA } from '../../../services/marketServices';
import { SecurityApiError, securityService } from '../../../services/securityService';
import type {
  AlertSeverityLevel,
  FinanceLedgerEntry,
  PlatformSpaceRole,
  ProtectedAuditEntry,
  SecurityAccountType,
  SecurityActiveSession,
  SecurityAlert,
  SecurityBlockedIp,
  SecurityCyberAttackEvent,
  SecurityDashboardSummary,
  SecurityIncidentRecord,
  SecurityIntrusionEvent,
  SecurityLoginLog,
  SecurityPeriodFilter,
  SecurityPermissionKey,
  SecurityRole,
  SecuritySettings,
  SecurityStaffMember,
  SecuritySuspendedAccount,
  SensitiveOperationType
} from '../../../types/security';
import { PendingConfirmation, SecurityConfirmModal } from './SecurityConfirmModal';
import { SecurityTargetHistoryModal } from './SecurityTargetHistoryModal';

type AccessCenterSection =
  | 'overview'
  | 'devices'
  | 'accounts'
  | 'permissions'
  | 'alerts'
  | 'threats'
  | 'finance'
  | 'audit'
  | 'incidents'
  | 'settings';

const SECTION_TABS: Array<{ id: AccessCenterSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Vue générale', icon: ShieldCheck },
  { id: 'devices', label: 'Connexions & appareils', icon: Smartphone },
  { id: 'accounts', label: 'Comptes & accès', icon: Users },
  { id: 'permissions', label: 'Permissions & rôles', icon: KeyRound },
  { id: 'alerts', label: 'Alertes (5 niveaux)', icon: AlertTriangle },
  { id: 'threats', label: 'Activités suspectes', icon: ShieldAlert },
  { id: 'finance', label: 'Protection financière', icon: Wallet },
  { id: 'audit', label: "Journal d'audit", icon: History },
  { id: 'incidents', label: 'Incidents & suspensions', icon: Ban },
  { id: 'settings', label: 'Paramètres sécurité', icon: Sliders }
];

const PERMISSION_LABELS: Record<SecurityPermissionKey, string> = {
  viewDashboard: 'Vue générale',
  viewLoginLogs: 'Journal connexions',
  viewIntrusions: 'Intrusions',
  viewCyberattacks: 'Cyberattaques',
  manageAlerts: 'Gestion alertes',
  executeProtectionActions: 'Actions protection',
  manageSessions: 'Sessions actives',
  modifySettings: 'Paramètres sécurité',
  managePermissions: 'Rôles & permissions',
  manageFinanceProtection: 'Protection financière',
  manageIncidents: 'Incidents & comptes'
};

const ALERT_LEVEL_META: Record<AlertSeverityLevel, { label: string; badge: string; border: string }> = {
  critique: { label: 'Critique', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40', border: 'border-rose-500/40 bg-rose-500/5' },
  eleve: { label: 'Élevé', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/40', border: 'border-orange-500/35 bg-orange-500/5' },
  moyen: { label: 'Moyen', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/35', border: 'border-amber-500/30 bg-white/[0.03]' },
  faible: { label: 'Faible', badge: 'bg-sky-500/20 text-sky-300 border-sky-500/35', border: 'border-sky-500/25 bg-white/[0.02]' },
  information: { label: 'Information', badge: 'bg-white/10 text-white/75 border-white/20', border: 'border-white/10 bg-white/[0.02]' }
};

const ROLE_BADGE_MAP: Record<SecurityRole, { label: string; cls: string }> = {
  super_admin: { label: 'Super Admin (Immuable)', cls: 'bg-purple-500/20 text-purple-300 border-purple-500/35' },
  admin: { label: 'Administrateur', cls: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/35' },
  security_agent: { label: 'Agent Sécurité', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35' },
  other_agent: { label: 'Agent Restreint', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' }
};

const SPACE_MATRIX: Array<{
  space: PlatformSpaceRole;
  title: string;
  scope: string;
  blocked: string;
}> = [
  {
    space: 'client',
    title: '1. Espace Client',
    scope: 'Consulte son propre profil, ses commandes, son panier et ses crédits.',
    blocked: 'Accès bloqué aux comptes d’autres clients, boutiques, livreurs, flottes et admin.'
  },
  {
    space: 'seller',
    title: '2. Espace Vendeur',
    scope: 'Gère ses propres produits, commandes reçues et son propre portefeuille vendeur.',
    blocked: 'Accès bloqué aux boutiques, catalogues ou portefeuilles d’autres vendeurs.'
  },
  {
    space: 'driver',
    title: '3. Espace Livreur',
    scope: 'Accède uniquement aux livraisons qui lui sont attribuées et ses preuves de remise.',
    blocked: 'Modification des commissions, livraisons d’autres livreurs et soldes admin bloquées.'
  },
  {
    space: 'company',
    title: '4. Entreprise de livraison',
    scope: 'Gère sa propre flotte, ses livreurs rattachés et leurs missions de dispatch.',
    blocked: 'Accès bloqué aux données/flottes d’autres entreprises et aux paramètres plateforme.'
  },
  {
    space: 'admin',
    title: '5. Espace Administrateur',
    scope: 'Supervision globale soumise à permissions granulaires, MFA et journalisation SHA-256.',
    blocked: 'Impossible d’altérer le Super Admin, de s’auto-élever ou de supprimer les logs d’audit.'
  }
];

const formatDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDuration = (seconds: number) => {
  if (!seconds || seconds < 60) return `${Math.max(0, seconds || 0)}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
};

const mapAppRoleToSecurityAccountType = (role: string): SecurityAccountType => {
  if (role === 'seller') return 'vendeur';
  if (role === 'driver') return 'livreur';
  if (role === 'company') return 'entreprise de livraison';
  if (role === 'admin') return 'administrateur';
  return 'client';
};

interface MfaPendingAction {
  title: string;
  description: string;
  execute: (stepUpCode: string) => Promise<void>;
}

export const AdminSecurityAccessCenter: React.FC = () => {
  const { adminUsers, updateAdminUser, addAuditLog, showToast } = useApp();

  const [section, setSection] = useState<AccessCenterSection>('overview');
  const [actor, setActor] = useState<SecurityStaffMember | null>(null);
  const [staffDirectory, setStaffDirectory] = useState<SecurityStaffMember[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loadingIdentity, setLoadingIdentity] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dashboard & period
  const [period, setPeriod] = useState<SecurityPeriodFilter>('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [dashboard, setDashboard] = useState<SecurityDashboardSummary | null>(null);

  // Devices & logins
  const [sessions, setSessions] = useState<SecurityActiveSession[]>([]);
  const [loginLogs, setLoginLogs] = useState<SecurityLoginLog[]>([]);
  const [loginSearch, setLoginSearch] = useState('');
  const [loginTypeFilter, setLoginTypeFilter] = useState('all');
  const [loginStatusFilter, setLoginStatusFilter] = useState('all');

  // Accounts directory filter
  const [accountSearch, setAccountSearch] = useState('');
  const [accountSpaceFilter, setAccountSpaceFilter] = useState<'all' | PlatformSpaceRole>('all');

  // Alerts (5 levels)
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [alertSeverityFilter, setAlertSeverityFilter] = useState<'all' | AlertSeverityLevel>('all');
  const [alertStatusFilter, setAlertStatusFilter] = useState<'all' | 'nouvelle' | 'en_examen' | 'resolue'>('all');

  // Threats
  const [threatView, setThreatView] = useState<'intrusions' | 'cyberattacks'>('intrusions');
  const [intrusions, setIntrusions] = useState<SecurityIntrusionEvent[]>([]);
  const [cyberAttacks, setCyberAttacks] = useState<SecurityCyberAttackEvent[]>([]);
  const [cloudflareConnected, setCloudflareConnected] = useState(false);
  const [blockedIps, setBlockedIps] = useState<SecurityBlockedIp[]>([]);
  const [manualIpInput, setManualIpInput] = useState('');
  const [manualIpDuration, setManualIpDuration] = useState('60');

  // Finance Protection
  const [financeEntries, setFinanceEntries] = useState<FinanceLedgerEntry[]>([]);
  const [financeBalances, setFinanceBalances] = useState<Record<string, number>>({});

  // Audit
  const [auditLogs, setAuditLogs] = useState<ProtectedAuditEntry[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditIntegrity, setAuditIntegrity] = useState<{
    valid: boolean;
    totalEntries: number;
    brokenAtSeq?: number;
    lastHash: string;
  } | null>(null);

  // Incidents & suspensions
  const [incidents, setIncidents] = useState<SecurityIncidentRecord[]>([]);
  const [suspendedAccounts, setSuspendedAccounts] = useState<SecuritySuspendedAccount[]>([]);
  const [compromiseFormOpen, setCompromiseFormOpen] = useState(false);
  const [compEmail, setCompEmail] = useState('');
  const [compName, setCompName] = useState('');
  const [compType, setCompType] = useState<SecurityAccountType>('client');
  const [compSummary, setCompSummary] = useState('Activité inhabituelle ou tentative de détournement détectée');
  const [compForceReset, setCompForceReset] = useState(true);
  const [compOps, setCompOps] = useState<SensitiveOperationType[]>(['withdrawals', 'profile_changes', 'role_changes']);

  // Permissions & add staff
  const [permissionsStaff, setPermissionsStaff] = useState<SecurityStaffMember[]>([]);
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffTitle, setNewStaffTitle] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'admin' | 'security_agent' | 'other_agent'>('security_agent');

  // Settings
  const [settingsDraft, setSettingsDraft] = useState<SecuritySettings | null>(null);

  // Modals
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);
  const [historyTarget, setHistoryTarget] = useState<string | null>(null);
  const [mfaAction, setMfaAction] = useState<MfaPendingAction | null>(null);
  const [mfaPreviewCode, setMfaPreviewCode] = useState<string>('');
  const [mfaInputCode, setMfaInputCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

  const can = useCallback(
    (perm: SecurityPermissionKey): boolean => {
      if (!actor || !actor.active) return false;
      if (actor.role === 'super_admin') return true;
      if (actor.role === 'other_agent') return false;
      return Boolean(actor.permissions?.[perm]);
    },
    [actor]
  );

  const syncAppUserSuspension = useCallback(
    (emailOrId: string, suspended: boolean) => {
      const target = adminUsers.find(
        (u) => u.id === emailOrId || u.email.toLowerCase() === emailOrId.toLowerCase()
      );
      if (target) {
        updateAdminUser(target.id, { status: suspended ? 'suspended' : 'active' });
      }
    },
    [adminUsers, updateAdminUser]
  );

  const loadIdentity = useCallback(async () => {
    setLoadingIdentity(true);
    setAuthError(null);
    try {
      const me = await securityService.getMe();
      setActor(me.actor);
      if (me.staffDirectory && me.staffDirectory.length > 0) {
        setStaffDirectory(me.staffDirectory);
      }
      if (!me.authorized) {
        setAuthError(
          `Accès restreint : le profil "${me.actor.name}" (${ROLE_BADGE_MAP[me.actor.role].label}) ne dispose d’aucune permission de sécurité active.`
        );
      }
    } catch (err: unknown) {
      setActor(null);
      setAuthError((err as Error)?.message || 'Accès refusé au centre Sécurité & accès.');
    } finally {
      setLoadingIdentity(false);
    }
  }, []);

  const loadAllData = useCallback(async () => {
    if (!actor || !actor.active || actor.role === 'other_agent') return;
    setRefreshing(true);
    try {
      const tasks: Promise<void>[] = [];

      if (can('viewDashboard')) {
        tasks.push(
          securityService.getDashboard(period, customFrom, customTo).then((res) => setDashboard(res)).catch(() => {}),
          securityService.getSettings().then((res) => setSettingsDraft(res.settings)).catch(() => {}),
          securityService
            .getAuditLogs()
            .then((res) => {
              setAuditLogs(res.logs);
              setAuditIntegrity(res.integrity);
            })
            .catch(() => {})
        );
      }
      if (can('manageSessions')) {
        tasks.push(
          securityService
            .getSessionsAndBlocks()
            .then((res) => {
              setSessions(res.sessions);
              setBlockedIps(res.blockedIps);
              setSuspendedAccounts(res.suspendedAccounts);
            })
            .catch(() => {})
        );
      }
      if (can('viewLoginLogs')) {
        tasks.push(
          securityService
            .getLoginLogs({
              q: loginSearch,
              accountType: loginTypeFilter,
              status: loginStatusFilter,
              period,
              from: customFrom,
              to: customTo
            })
            .then((res) => setLoginLogs(res.logs))
            .catch(() => {})
        );
      }
      if (can('manageAlerts')) {
        tasks.push(
          securityService
            .getAlerts(alertSeverityFilter, alertStatusFilter)
            .then((res) => setAlerts(res.alerts))
            .catch(() => {})
        );
      }
      if (can('viewIntrusions')) {
        tasks.push(
          securityService.getIntrusions('all', 'all').then((res) => setIntrusions(res.intrusions)).catch(() => {})
        );
      }
      if (can('viewCyberattacks')) {
        tasks.push(
          securityService
            .getCyberAttacks('all')
            .then((res) => {
              setCyberAttacks(res.cyberAttacks);
              setCloudflareConnected(res.cloudflareWafConnected);
            })
            .catch(() => {})
        );
      }
      if (can('manageFinanceProtection')) {
        tasks.push(
          securityService
            .getFinanceLedger()
            .then((res) => {
              setFinanceEntries(res.entries);
              setFinanceBalances(res.calculatedBalances || {});
            })
            .catch(() => {})
        );
      }
      if (can('manageIncidents')) {
        tasks.push(
          securityService.getIncidents().then((res) => setIncidents(res.incidents)).catch(() => {})
        );
      }
      if (can('managePermissions')) {
        tasks.push(
          securityService.getPermissions().then((res) => setPermissionsStaff(res.staff)).catch(() => {})
        );
      }

      await Promise.all(tasks);
    } finally {
      setRefreshing(false);
    }
  }, [
    actor,
    can,
    period,
    customFrom,
    customTo,
    loginSearch,
    loginTypeFilter,
    loginStatusFilter,
    alertSeverityFilter,
    alertStatusFilter
  ]);

  useEffect(() => {
    void loadIdentity();
  }, [loadIdentity]);

  useEffect(() => {
    if (actor && actor.role !== 'other_agent') {
      void loadAllData();
    }
  }, [actor, loadAllData]);

  // Step-Up MFA trigger helper
  const triggerMfaStepUp = async (action: MfaPendingAction) => {
    setMfaAction(action);
    setMfaError(null);
    setMfaInputCode('');
    setMfaPreviewCode('');
    try {
      const ch = await securityService.requestMfaChallenge();
      setMfaPreviewCode(ch.verificationCodePreview);
      setMfaInputCode(ch.verificationCodePreview);
    } catch (err: unknown) {
      setMfaError((err as Error)?.message || 'Impossible de générer le code MFA.');
    }
  };

  const submitMfaDialog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaAction || !mfaInputCode.trim()) return;
    setMfaLoading(true);
    setMfaError(null);
    try {
      await mfaAction.execute(mfaInputCode.trim());
      setMfaAction(null);
      setMfaInputCode('');
      setMfaPreviewCode('');
    } catch (err: unknown) {
      setMfaError((err as SecurityApiError)?.message || 'Code MFA invalide ou expiré.');
    } finally {
      setMfaLoading(false);
    }
  };

  // Actions
  const handleSwitchTestRole = async (staffId: string) => {
    try {
      await securityService.switchTestRole(staffId);
      showToast('Profil RBAC mis à jour (jeton signé par le serveur)');
      await loadIdentity();
    } catch (err: unknown) {
      showToast((err as Error)?.message || 'Basculement non autorisé.');
    }
  };

  const requestRevokeSession = (s: SecurityActiveSession) => {
    setPendingConfirm({
      title: 'Déconnecter cet appareil à distance ?',
      targetLabel: `${s.userName} • ${s.device} (${s.ipAddress})`,
      description: 'Le jeton signé sera immédiatement invalidé côté serveur sur toutes les routes API.',
      confirmLabel: 'Déconnecter l’appareil',
      tone: 'danger',
      requireReason: true,
      defaultReason: 'Session ou appareil non reconnu',
      onConfirm: async (reason) => {
        await securityService.revokeSession(s.sessionId, reason);
        addAuditLog('Révocation session distante', `${s.userEmail} (${s.ipAddress})`, 'security', reason);
        showToast('Appareil déconnecté à distance');
        await loadAllData();
      }
    });
  };

  const requestRevokeAllUserSessions = (email: string, name: string) => {
    setPendingConfirm({
      title: 'Révoquer toutes les sessions de ce compte ?',
      targetLabel: `${name} (${email})`,
      description: 'Tous les téléphones et navigateurs connectés à ce compte seront déconnectés immédiatement.',
      confirmLabel: 'Tout révoquer',
      tone: 'danger',
      requireReason: true,
      defaultReason: 'Réinitialisation de sécurité complète des sessions',
      onConfirm: async (reason) => {
        const res = await securityService.revokeUserSessions({ userEmail: email, reason });
        addAuditLog('Révocation globale sessions', email, 'security', `${res.revokedCount} session(s)`);
        showToast(`${res.revokedCount} session(s) révoquée(s)`);
        await loadAllData();
      }
    });
  };

  const requestBlockIp = (ip: string, defaultReason = 'Activité suspecte détectée') => {
    setPendingConfirm({
      title: 'Bloquer cette adresse IP ?',
      targetLabel: ip,
      description: 'Le serveur rejettera toutes les requêtes API provenant de cette adresse IP (HTTP 403).',
      confirmLabel: 'Bloquer IP',
      tone: 'danger',
      requireReason: true,
      defaultReason,
      onConfirm: async (reason) => {
        const mins = Number(manualIpDuration) > 0 ? Number(manualIpDuration) : undefined;
        await securityService.blockIp(ip, reason, mins);
        addAuditLog('Blocage adresse IP', ip, 'security', reason);
        showToast(`IP ${ip} bloquée`);
        await loadAllData();
      }
    });
  };

  const requestUnblockIp = (ip: string) => {
    setPendingConfirm({
      title: 'Débloquer cette adresse IP ?',
      targetLabel: ip,
      description: 'Cette adresse IP pourra à nouveau contacter les services DJASSA.',
      confirmLabel: 'Débloquer',
      tone: 'primary',
      requireReason: false,
      defaultReason: 'Levée après vérification',
      onConfirm: async () => {
        await securityService.unblockIp(ip);
        showToast(`IP ${ip} débloquée`);
        await loadAllData();
      }
    });
  };

  const requestSuspendAccount = (target: {
    accountId: string;
    accountName: string;
    accountEmail: string;
    accountType: SecurityAccountType;
  }) => {
    setPendingConfirm({
      title: 'Suspendre temporairement ce compte ?',
      targetLabel: `${target.accountName} (${target.accountEmail})`,
      description: 'Toutes les sessions sont révoquées et les retraits/modifications sensibles sont bloqués sans supprimer l’historique.',
      confirmLabel: 'Suspendre le compte',
      tone: 'danger',
      requireReason: true,
      defaultReason: 'Vérification de sécurité requise',
      onConfirm: async (reason) => {
        await securityService.suspendAccount(target ? { ...target, reason } : { accountEmail: '', reason });
        syncAppUserSuspension(target.accountEmail, true);
        addAuditLog('Suspension compte sécurité', target.accountEmail, 'security', reason);
        showToast(`Compte ${target.accountName} suspendu`);
        await loadAllData();
      }
    });
  };

  const requestReactivateAccount = (target: { accountId?: string; accountEmail: string; accountName?: string }) => {
    setPendingConfirm({
      title: 'Réactiver ce compte après vérification ?',
      targetLabel: `${target.accountName || target.accountEmail}`,
      description: 'Le compte retrouvera son accès et les incidents liés seront clôturés avec traçabilité.',
      confirmLabel: 'Réactiver le compte',
      tone: 'primary',
      requireReason: true,
      defaultReason: 'Identité et sécurité vérifiées avec le titulaire',
      onConfirm: async (reason) => {
        await securityService.reactivateAccount({ accountId: target.accountId, accountEmail: target.accountEmail, note: reason });
        syncAppUserSuspension(target.accountEmail, false);
        addAuditLog('Réactivation compte sécurité', target.accountEmail, 'security', reason);
        showToast(`Compte ${target.accountEmail} réactivé`);
        await loadAllData();
      }
    });
  };

  const requestForcePasswordReset = (email: string, accountId?: string) => {
    setPendingConfirm({
      title: 'Forcer la réinitialisation du mot de passe ?',
      targetLabel: email,
      description: 'Les sessions actives exigeront une nouvelle authentification avec renouvellement du mot de passe.',
      confirmLabel: 'Forcer réinitialisation',
      tone: 'danger',
      requireReason: true,
      defaultReason: 'Mot de passe potentiellement compromis',
      onConfirm: async (reason) => {
        await securityService.forcePasswordReset({ accountId, accountEmail: email, reason });
        showToast(`Réinitialisation sécurisée exigée pour ${email}`);
        await loadAllData();
      }
    });
  };

  const handleSaveSettingsWithMfa = () => {
    if (!settingsDraft) return;
    if (settingsDraft.requireTwoFactorAdmins && settingsDraft.requireTwoFactorSensitiveActions) {
      void triggerMfaStepUp({
        title: 'Validation MFA : Paramètres de sécurité',
        description: 'La modification de la politique globale de sécurité exige une confirmation MFA administrateur.',
        execute: async (code) => {
          const res = await securityService.updateSettings(settingsDraft, undefined, code);
          setSettingsDraft(res.settings);
          addAuditLog('Politique sécurité mise à jour', 'Paramètres globaux', 'security', 'Sauvegardé après validation MFA');
          showToast('Paramètres de sécurité sauvegardés côté serveur');
          await loadAllData();
        }
      });
      return;
    }
    void securityService
      .updateSettings(settingsDraft)
      .then((res) => {
        setSettingsDraft(res.settings);
        showToast('Paramètres enregistrés');
        void loadAllData();
      })
      .catch((err: SecurityApiError) => {
        if (err.code === 'MFA_STEPUP_REQUIRED') {
          void triggerMfaStepUp({
            title: 'Validation MFA requise',
            description: err.message,
            execute: async (code) => {
              const res = await securityService.updateSettings(settingsDraft, undefined, code);
              setSettingsDraft(res.settings);
              showToast('Paramètres de sécurité sauvegardés');
              await loadAllData();
            }
          });
        } else {
          showToast(err.message);
        }
      });
  };

  const handleTogglePermission = (staff: SecurityStaffMember, key: SecurityPermissionKey) => {
    const nextVal = !staff.permissions[key];
    void triggerMfaStepUp({
      title: `Validation MFA : Permission "${PERMISSION_LABELS[key]}"`,
      description: `${nextVal ? 'Accorder' : 'Retirer'} cette permission à ${staff.name}.`,
      execute: async (code) => {
        await securityService.updateStaffPermissions(staff.id, { permissions: { [key]: nextVal } }, undefined, code);
        showToast('Permissions mises à jour côté serveur');
        await loadAllData();
      }
    });
  };

  const handleAddStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffEmail.trim()) return;
    setAddStaffOpen(false);
    void triggerMfaStepUp({
      title: 'Validation MFA : Ajout de collaborateur',
      description: `Création encadrée du profil "${newStaffName}" (${newStaffRole}).`,
      execute: async (code) => {
        await securityService.createStaffMember(
          {
            name: newStaffName.trim(),
            email: newStaffEmail.trim(),
            role: newStaffRole,
            title: newStaffTitle.trim() || 'Agent DJASSA'
          },
          code
        );
        setNewStaffName('');
        setNewStaffEmail('');
        setNewStaffTitle('');
        showToast('Collaborateur ajouté avec succès');
        await loadAllData();
      }
    });
  };

  const handleReviewWithdrawal = (entry: FinanceLedgerEntry, decision: 'approve' | 'reject') => {
    void triggerMfaStepUp({
      title: decision === 'approve' ? 'Validation MFA : Approuver le retrait' : 'Validation MFA : Rejeter le retrait',
      description: `${entry.accountName} • ${formatFCFA(entry.amountFcfa)} (${entry.channel})`,
      execute: async (code) => {
        await securityService.reviewSuspiciousWithdrawal(
          entry.id,
          decision,
          decision === 'approve' ? 'Identité et preuves validées par administrateur' : 'Opération frauduleuse confirmée et bloquée',
          code
        );
        showToast(decision === 'approve' ? 'Retrait approuvé après contrôle' : 'Retrait définitivement rejeté');
        await loadAllData();
      }
    });
  };

  const handleCompromiseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compEmail.trim() || !compSummary.trim()) return;
    try {
      await securityService.reportCompromisedAccount({
        accountName: compName.trim() || compEmail.trim(),
        accountEmail: compEmail.trim(),
        accountType: compType,
        summary: compSummary.trim(),
        blockedOperations: compOps,
        forcePasswordReset: compForceReset
      });
      syncAppUserSuspension(compEmail.trim(), true);
      setCompromiseFormOpen(false);
      setCompEmail('');
      setCompName('');
      showToast('Compte signalé compromis : sessions révoquées et opérations sensibles bloquées');
      await loadAllData();
    } catch (err: unknown) {
      showToast((err as Error)?.message || 'Erreur lors du signalement');
    }
  };

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    return adminUsers.filter((u) => {
      if (accountSpaceFilter !== 'all' && u.role !== accountSpaceFilter) return false;
      if (q) {
        const hay = `${u.name} ${u.email} ${u.id} ${u.phone}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [adminUsers, accountSearch, accountSpaceFilter]);

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return auditLogs;
    return auditLogs.filter((l) =>
      `${l.actorName} ${l.action} ${l.target} ${l.ipAddress} ${l.details} ${l.reason || ''}`.toLowerCase().includes(q)
    );
  }, [auditLogs, auditSearch]);

  const suspiciousWithdrawals = useMemo(
    () => financeEntries.filter((f) => f.status === 'en_attente_verification' || f.status === 'bloque_securite'),
    [financeEntries]
  );

  if (loadingIdentity) {
    return (
      <div className="p-6 rounded-2xl bg-[#141417] border border-white/10 text-center space-y-2">
        <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin mx-auto" />
        <p className="text-xs font-bold text-white/70">Vérification de la session signée et des privilèges...</p>
      </div>
    );
  }

  if (authError || !actor) {
    return (
      <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-3 text-center">
        <ShieldOff className="w-7 h-7 text-rose-400 mx-auto" />
        <div>
          <h4 className="text-sm font-black text-white">Accès Sécurité Refusé</h4>
          <p className="text-xs text-rose-200/80 mt-1">{authError || 'Session non authentifiée.'}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadIdentity()}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white"
        >
          Réessayer l'authentification
        </button>
      </div>
    );
  }

  return (
    <div id="admin-security-access-center" className="space-y-3.5 text-white">
      {/* Header status bar */}
      <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Centre Sécurité & Contrôle d'Accès</span>
            </h4>
            <p className="text-[11px] text-white/55 mt-0.5">
              Protection serveur des 5 espaces DJASSA • Jeton HMAC signé
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadAllData()}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition cursor-pointer"
            title="Actualiser"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10 text-[10px]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`px-2 py-0.5 rounded-lg border font-bold ${ROLE_BADGE_MAP[actor.role].cls}`}>
              {actor.name} • {ROLE_BADGE_MAP[actor.role].label}
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
              MFA {actor.mfaEnabled ? 'Actif' : 'Inactif'}
            </span>
          </div>

          {actor.role === 'super_admin' && staffDirectory.length > 0 && (
            <select
              aria-label="Tester un profil RBAC"
              value={actor.id}
              onChange={(e) => void handleSwitchTestRole(e.target.value)}
              className="bg-black/60 border border-white/15 rounded-lg px-2 py-1 text-[10px] font-bold text-white/80 focus:outline-none focus:border-emerald-400"
            >
              {staffDirectory.map((s) => (
                <option key={s.id} value={s.id}>
                  Profil : {s.name} ({s.role})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 10 Sections horizontal scroll bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {SECTION_TABS.map((t) => {
          const Icon = t.icon;
          const active = section === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSection(t.id)}
              className={`shrink-0 px-3 py-2 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                active
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-[#141417] border-white/10 text-white/55 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* 1. VUE GÉNÉRALE DE SÉCURITÉ                                           */}
      {/* ===================================================================== */}
      {section === 'overview' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-[#141417] p-1 rounded-xl border border-white/10">
              {(['today', '7d', '30d', 'custom'] as SecurityPeriodFilter[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                    period === p ? 'bg-[#FF6321] text-white' : 'text-white/55 hover:text-white'
                  }`}
                >
                  {p === 'today' ? "Aujourd'hui" : p === '7d' ? '7 jours' : p === '30d' ? '30 jours' : 'Personnalisé'}
                </button>
              ))}
            </div>
            {auditIntegrity && (
              <span
                className={`px-2.5 py-1 rounded-xl border text-[10px] font-bold flex items-center gap-1 ${
                  auditIntegrity.valid
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                }`}
              >
                <FileCheck2 className="w-3 h-3" />
                <span>Intégrité SHA-256 : {auditIntegrity.valid ? 'Valide' : 'Altérée'} ({auditIntegrity.totalEntries})</span>
              </span>
            )}
          </div>

          {period === 'custom' && (
            <div className="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-[#141417] border border-white/10 text-xs">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-white text-[11px]"
              />
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-white text-[11px]"
              />
            </div>
          )}

          {dashboard && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: 'Connexions totales', val: dashboard.kpis.totalLogins, cls: 'text-white' },
                  { label: 'Connexions réussies', val: dashboard.kpis.successfulLogins, cls: 'text-emerald-400' },
                  { label: 'Échecs de connexion', val: dashboard.kpis.failedLogins, cls: 'text-amber-400' },
                  { label: 'Connexions suspectes', val: dashboard.kpis.suspiciousLogins, cls: 'text-orange-400' },
                  { label: 'Intrusions détectées', val: dashboard.kpis.detectedIncidents, cls: 'text-rose-400' },
                  { label: 'Attaques bloquées', val: dashboard.kpis.blockedAttacks, cls: 'text-rose-300' },
                  { label: 'Sessions actives', val: dashboard.kpis.activeSessions, cls: 'text-cyan-400' },
                  { label: 'Comptes suspendus', val: dashboard.kpis.temporarilySuspendedAccounts, cls: 'text-rose-400' },
                  { label: 'Retraits en contrôle', val: dashboard.kpis.suspiciousWithdrawals, cls: 'text-amber-300' }
                ].map((k, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-[#141417] border border-white/10">
                    <span className="text-[10px] text-white/50 block">{k.label}</span>
                    <span className={`text-lg font-black mt-0.5 block ${k.cls}`}>{k.val}</span>
                  </div>
                ))}
              </div>

              {/* 5 spaces isolation status */}
              <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-2.5">
                <h5 className="text-[11px] font-black uppercase tracking-wider text-white/75 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Protection en temps réel des 5 espaces</span>
                </h5>
                <div className="space-y-1.5">
                  {dashboard.spacesProtected.map((sp) => (
                    <div
                      key={sp.space}
                      className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-white">{sp.label}</p>
                        <p className="text-[10px] text-white/45">
                          {sp.activeSessionsCount} session(s) • {sp.suspendedCount} suspendu(s)
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-300">
                        Isolation active
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Protections engine telemetry */}
              <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-2">
                <h5 className="text-[11px] font-black uppercase tracking-wider text-white/75 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-cyan-400" />
                  <span>État des protections serveur</span>
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                  <div className="p-2 rounded-xl bg-white/[0.03] flex justify-between">
                    <span className="text-white/60">Jetons HMAC signés</span>
                    <b className="text-emerald-400">Actif</b>
                  </div>
                  <div className="p-2 rounded-xl bg-white/[0.03] flex justify-between">
                    <span className="text-white/60">Isolation RBAC 5 espaces</span>
                    <b className="text-emerald-400">Actif</b>
                  </div>
                  <div className="p-2 rounded-xl bg-white/[0.03] flex justify-between">
                    <span className="text-white/60">Registre financier serveur</span>
                    <b className="text-emerald-400">Actif</b>
                  </div>
                  <div className="p-2 rounded-xl bg-white/[0.03] flex justify-between">
                    <span className="text-white/60">Pare-feu Express (SQLi/XSS/Flood)</span>
                    <b className="text-emerald-400">Actif</b>
                  </div>
                  <div className="p-2 rounded-xl bg-white/[0.03] flex justify-between sm:col-span-2">
                    <span className="text-white/60">Connecteur Cloudflare WAF externe</span>
                    <b className={dashboard.protectionsStatus.cloudflareWaf === 'connected' ? 'text-emerald-400' : 'text-amber-400'}>
                      {dashboard.protectionsStatus.cloudflareWaf === 'connected' ? 'Connecté' : 'Non configuré (config externe requise)'}
                    </b>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. CONNEXIONS ET APPAREILS                                            */}
      {/* ===================================================================== */}
      {section === 'devices' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-black text-white flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>Appareils et sessions ({sessions.length})</span>
              </h5>
              <span className="text-[10px] text-white/40">Mots de passe & jetons masqués</span>
            </div>

            {!can('manageSessions') ? (
              <p className="text-xs text-white/50">Permission « Sessions actives » requise.</p>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-white/45 py-4 text-center">Aucune session enregistrée pour le moment.</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div key={s.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-white">{s.userName}</span>
                          <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-bold uppercase text-white/75">
                            {s.accountType}
                          </span>
                          {s.isNewDevice && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/35 text-[9px] font-bold">
                              Nouvel appareil
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-white/50 font-mono">
                          ID: {s.userId} • {s.userEmail}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${
                          s.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : s.status === 'suspect'
                            ? 'bg-orange-500/20 text-orange-300 border-orange-500/35'
                            : s.status === 'revoked'
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : 'bg-white/10 text-white/50 border-white/15'
                        }`}
                      >
                        {s.status === 'reauth_required' ? 'Réauth requise' : s.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[10px] text-white/60 bg-black/30 p-2 rounded-lg">
                      <span>Appareil : <b className="text-white/85">{s.device}</b></span>
                      <span>OS : <b className="text-white/85">{s.os}</b></span>
                      <span>Navigateur : <b className="text-white/85">{s.browser}</b></span>
                      <span>IP : <b className="text-white/85 font-mono">{s.ipAddress}</b></span>
                      <span>Connexion : {formatDateTime(s.startedAt)}</span>
                      <span>Activité : {formatDateTime(s.lastActivityAt)} ({formatDuration(s.durationSeconds)})</span>
                      {s.location && <span className="col-span-2">Lieu : {s.location}</span>}
                    </div>

                    {s.status !== 'revoked' && s.status !== 'expired' && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => requestRevokeSession(s)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[10px] font-bold cursor-pointer"
                        >
                          Déconnecter l'appareil
                        </button>
                        <button
                          type="button"
                          onClick={() => requestRevokeAllUserSessions(s.userEmail, s.userName)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 text-[10px] font-bold cursor-pointer"
                        >
                          Révoquer toutes les sessions
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Login Logs */}
          <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-2.5">
            <h5 className="text-xs font-black text-white flex items-center gap-1.5">
              <LogIn className="w-4 h-4 text-[#FF6321]" />
              <span>Journal des connexions ({loginLogs.length})</span>
            </h5>
            <div className="flex flex-wrap gap-1.5">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="w-3.5 h-3.5 text-white/35 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={loginSearch}
                  onChange={(e) => setLoginSearch(e.target.value)}
                  placeholder="Rechercher email, IP, appareil..."
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-black/50 border border-white/10 text-[11px] text-white"
                />
              </div>
              <select
                value={loginTypeFilter}
                onChange={(e) => setLoginTypeFilter(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-xl px-2 py-1.5 text-[11px] text-white"
              >
                <option value="all">Tous espaces</option>
                <option value="client">Client</option>
                <option value="vendeur">Vendeur</option>
                <option value="livreur">Livreur</option>
                <option value="entreprise de livraison">Entreprise</option>
                <option value="administrateur">Administrateur</option>
              </select>
              <select
                value={loginStatusFilter}
                onChange={(e) => setLoginStatusFilter(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-xl px-2 py-1.5 text-[11px] text-white"
              >
                <option value="all">Tous statuts</option>
                <option value="reussite">Réussie</option>
                <option value="echec">Échec</option>
                <option value="suspect">Suspecte</option>
              </select>
            </div>

            <div className="space-y-1.5 max-h-96 overflow-y-auto no-scrollbar">
              {loginLogs.map((l) => (
                <div key={l.id} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white truncate">{l.accountName} ({l.accountEmail})</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                        l.status === 'reussite'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : l.status === 'suspect'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      {l.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/55">
                    {l.accountType} • IP {l.ipAddress} • {l.device} ({l.os} / {l.browser}) • {formatDateTime(l.timestamp)}
                  </p>
                  {l.reason && <p className="text-[10px] text-amber-300/80">{l.reason}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. COMPTES ET ACCÈS                                                   */}
      {/* ===================================================================== */}
      {section === 'accounts' && (
        <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h5 className="text-xs font-black text-white flex items-center gap-1.5">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>Comptes & Accès des 5 espaces ({filteredAccounts.length})</span>
            </h5>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-3.5 h-3.5 text-white/35 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                placeholder="Nom, email, téléphone..."
                className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-black/50 border border-white/10 text-[11px] text-white"
              />
            </div>
            <select
              value={accountSpaceFilter}
              onChange={(e) => setAccountSpaceFilter(e.target.value as 'all' | PlatformSpaceRole)}
              className="bg-black/50 border border-white/10 rounded-xl px-2 py-1.5 text-[11px] text-white"
            >
              <option value="all">Tous espaces</option>
              <option value="client">Client</option>
              <option value="seller">Vendeur</option>
              <option value="driver">Livreur</option>
              <option value="company">Entreprise</option>
              <option value="admin">Administrateur</option>
            </select>
          </div>

          <div className="space-y-2">
            {filteredAccounts.map((u) => {
              const susp = suspendedAccounts.find(
                (s) => s.active && (s.accountEmail.toLowerCase() === u.email.toLowerCase() || s.accountId === u.id)
              );
              const isSusp = Boolean(susp) || u.status === 'suspended';
              return (
                <div key={u.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-white">{u.name}</p>
                      <p className="text-[10px] text-white/50">{u.email} • {u.phone}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-bold uppercase text-white/80">
                          {mapAppRoleToSecurityAccountType(u.role)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] text-white/60">
                          KYC {u.kycVerified ? 'Vérifié' : 'En attente'}
                        </span>
                        {susp?.compromisedFlag && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[9px] font-bold">
                            Compromis signalé
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${
                        isSusp
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {isSusp ? 'Suspendu' : 'Actif'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setHistoryTarget(u.email)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-white/80 flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Historique</span>
                    </button>
                    {u.role !== 'admin' && (
                      <>
                        {isSusp ? (
                          <button
                            type="button"
                            onClick={() =>
                              requestReactivateAccount({ accountId: u.id, accountEmail: u.email, accountName: u.name })
                            }
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[10px] font-bold text-emerald-300 cursor-pointer"
                          >
                            Réactiver
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              requestSuspendAccount({
                                accountId: u.id,
                                accountName: u.name,
                                accountEmail: u.email,
                                accountType: mapAppRoleToSecurityAccountType(u.role)
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-[10px] font-bold text-rose-300 cursor-pointer"
                          >
                            Suspendre
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => requestForcePasswordReset(u.email, u.id)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-[10px] font-bold text-amber-300 cursor-pointer"
                        >
                          Forcer réinit. MDP
                        </button>
                        <button
                          type="button"
                          onClick={() => requestRevokeAllUserSessions(u.email, u.name)}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-white/75 cursor-pointer"
                        >
                          Révoquer sessions
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. PERMISSIONS ET RÔLES                                               */}
      {/* ===================================================================== */}
      {section === 'permissions' && (
        <div className="space-y-3">
          {/* 5-Space Strict Isolation Rules */}
          <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-2.5">
            <h5 className="text-xs font-black text-white flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>Matrice d'isolation des 5 espaces</span>
            </h5>
            <div className="space-y-2">
              {SPACE_MATRIX.map((m) => (
                <div key={m.space} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] space-y-1">
                  <p className="font-bold text-white">{m.title}</p>
                  <p className="text-emerald-300/90">Autorisé : {m.scope}</p>
                  <p className="text-rose-300/80">Bloqué serveur : {m.blocked}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Admin & Security Staff RBAC */}
          <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h5 className="text-xs font-black text-white flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-purple-400" />
                  <span>Collaborateurs & Permissions RBAC</span>
                </h5>
                <p className="text-[10px] text-white/50">Validation MFA requise pour toute modification</p>
              </div>
              {actor.role === 'super_admin' && (
                <button
                  type="button"
                  onClick={() => setAddStaffOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Ajouter</span>
                </button>
              )}
            </div>

            {!can('managePermissions') ? (
              <p className="text-xs text-white/50">Permission « Rôles & permissions » requise pour administrer la matrice.</p>
            ) : (
              <div className="space-y-2.5">
                {permissionsStaff.map((member) => {
                  const isSuper = member.role === 'super_admin';
                  return (
                    <div key={member.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-white">{member.name}</p>
                          <p className="text-[10px] text-white/50">{member.title} • {member.email}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-lg border text-[9px] font-bold ${ROLE_BADGE_MAP[member.role].cls}`}>
                          {ROLE_BADGE_MAP[member.role].label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5">
                        {(Object.keys(PERMISSION_LABELS) as SecurityPermissionKey[]).map((key) => {
                          const enabled = isSuper ? true : Boolean(member.permissions?.[key]);
                          return (
                            <button
                              key={key}
                              type="button"
                              disabled={isSuper || member.id === actor.id}
                              onClick={() => handleTogglePermission(member, key)}
                              className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold flex items-center justify-between transition ${
                                enabled
                                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                  : 'bg-black/40 border-white/10 text-white/40'
                              } ${isSuper || member.id === actor.id ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:border-white/30'}`}
                            >
                              <span className="truncate">{PERMISSION_LABELS[key]}</span>
                              <span>{enabled ? 'OUI' : 'NON'}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. ALERTES DE SÉCURITÉ (5 NIVEAUX)                                    */}
      {/* ===================================================================== */}
      {section === 'alerts' && (
        <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-black text-white flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Alertes de sécurité (5 niveaux • Non supprimables)</span>
            </h5>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <select
              value={alertSeverityFilter}
              onChange={(e) => setAlertSeverityFilter(e.target.value as 'all' | AlertSeverityLevel)}
              className="bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] text-white"
            >
              <option value="all">Tous niveaux (5)</option>
              <option value="critique">Critique</option>
              <option value="eleve">Élevé</option>
              <option value="moyen">Moyen</option>
              <option value="faible">Faible</option>
              <option value="information">Information</option>
            </select>
            <select
              value={alertStatusFilter}
              onChange={(e) => setAlertStatusFilter(e.target.value as 'all' | 'nouvelle' | 'en_examen' | 'resolue')}
              className="bg-black/50 border border-white/10 rounded-xl px-2.5 py-1.5 text-[11px] text-white"
            >
              <option value="all">Tous statuts</option>
              <option value="nouvelle">Nouvelle</option>
              <option value="en_examen">En examen</option>
              <option value="resolue">Résolue</option>
            </select>
          </div>

          {alerts.length === 0 ? (
            <p className="text-xs text-white/45 py-6 text-center">Aucune alerte de sécurité pour ces critères.</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => {
                const meta = ALERT_LEVEL_META[a.severity] || ALERT_LEVEL_META.information;
                return (
                  <div key={a.id} className={`p-3 rounded-xl border space-y-2 text-xs ${meta.border}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black uppercase ${meta.badge}`}>
                            {meta.label}
                          </span>
                          <span className="text-[10px] text-white/45">{formatDateTime(a.timestamp)}</span>
                        </div>
                        <p className="font-bold text-white mt-1">{a.title}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-white/10 text-[9px] font-bold uppercase text-white/75 shrink-0">
                        {a.status === 'nouvelle' ? 'Nouvelle' : a.status === 'en_examen' ? 'En examen' : 'Résolue'}
                      </span>
                    </div>

                    <p className="text-[11px] text-white/75 leading-relaxed">{a.description}</p>
                    <p className="text-[10px] text-white/45">
                      Cible : <span className="text-white/70">{a.targetUserOrResource}</span> • IP : <span className="font-mono text-white/70">{a.sourceIp}</span>
                    </p>
                    <p className="text-[10px] text-emerald-300/90">Recommandation : {a.recommendedAction}</p>

                    {a.status !== 'resolue' && can('manageAlerts') && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {a.status === 'nouvelle' && (
                          <button
                            type="button"
                            onClick={() =>
                              void securityService.updateAlertStatus(a.id, 'en_examen').then(() => {
                                showToast('Alerte prise en examen');
                                void loadAllData();
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/35 text-amber-300 text-[10px] font-bold cursor-pointer"
                          >
                            Prendre en examen
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            void securityService
                              .updateAlertStatus(a.id, 'resolue', 'Vérifiée et traitée par l’administrateur sécurité')
                              .then(() => {
                                showToast('Alerte résolue et archivée');
                                void loadAllData();
                              })
                          }
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/35 text-emerald-300 text-[10px] font-bold cursor-pointer"
                        >
                          Marquer résolue
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. ACTIVITÉS SUSPECTES (INTRUSIONS + CYBERATTAQUES + BLOCAGE IP)      */}
      {/* ===================================================================== */}
      {section === 'threats' && (
        <div className="space-y-3">
          {/* Manual IP block bar */}
          <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-2">
            <h5 className="text-xs font-black text-white flex items-center gap-1.5">
              <Ban className="w-4 h-4 text-rose-400" />
              <span>Blocage d'adresse IP immédiat</span>
            </h5>
            <div className="flex flex-wrap gap-1.5">
              <input
                type="text"
                value={manualIpInput}
                onChange={(e) => setManualIpInput(e.target.value)}
                placeholder="Ex : 197.159.44.12"
                className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white font-mono"
              />
              <select
                value={manualIpDuration}
                onChange={(e) => setManualIpDuration(e.target.value)}
                className="px-2 py-1.5 rounded-xl bg-black/50 border border-white/10 text-[11px] text-white"
              >
                <option value="30">30 min</option>
                <option value="60">1 heure</option>
                <option value="1440">24 heures</option>
                <option value="0">Permanent</option>
              </select>
              <button
                type="button"
                disabled={!manualIpInput.trim()}
                onClick={() => requestBlockIp(manualIpInput.trim(), 'Blocage manuel depuis Activités suspectes')}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-black cursor-pointer"
              >
                Bloquer IP
              </button>
            </div>
          </div>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setThreatView('intrusions')}
              className={`flex-1 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
                threatView === 'intrusions'
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  : 'bg-[#141417] border-white/10 text-white/55'
              }`}
            >
              Intrusions & Tentatives ({intrusions.length})
            </button>
            <button
              type="button"
              onClick={() => setThreatView('cyberattacks')}
              className={`flex-1 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
                threatView === 'cyberattacks'
                  ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                  : 'bg-[#141417] border-white/10 text-white/55'
              }`}
            >
              Cyberattaques WAF ({cyberAttacks.length})
            </button>
          </div>

          {threatView === 'intrusions' ? (
            <div className="space-y-2">
              {intrusions.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#141417] border border-white/10 text-center text-xs text-white/45">
                  Aucune tentative d'intrusion enregistrée.
                </div>
              ) : (
                intrusions.map((ev) => (
                  <div key={ev.id} className="p-3 rounded-xl bg-[#141417] border border-rose-500/25 text-xs space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-white">{ev.threatLabel}</span>
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[9px] font-black uppercase">
                        {ev.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/70">{ev.details}</p>
                    <div className="flex items-center justify-between text-[10px] text-white/45">
                      <span>Cible : {ev.targetAccountOrResource} • IP {ev.sourceIp}</span>
                      <span>{formatDateTime(ev.timestamp)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="p-2.5 rounded-xl bg-[#141417] border border-white/10 flex items-center justify-between text-[11px]">
                <span className="text-white/60">Cloudflare WAF externe</span>
                <span className={cloudflareConnected ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {cloudflareConnected ? 'Connecté (Webhook actif)' : 'Non configuré — Pare-feu Express actif'}
                </span>
              </div>
              {cyberAttacks.map((atk) => (
                <div key={atk.id} className="p-3 rounded-xl bg-[#141417] border border-orange-500/25 text-xs space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-white">{atk.attackLabel}</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[9px] font-bold">
                      {atk.blocked ? 'Bloquée' : 'Détectée'}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/60 font-mono">{atk.targetEndpoint} • IP {atk.sourceIp}</p>
                  <p className="text-[10px] text-orange-300">{atk.actionTaken}</p>
                </div>
              ))}
            </div>
          )}

          {blockedIps.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-2">
              <h6 className="text-[11px] font-black uppercase text-white/70">Adresses IP bloquées</h6>
              {blockedIps.map((b) => (
                <div key={b.id} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-2 text-xs">
                  <div>
                    <p className="font-mono font-bold text-white">{b.ipAddress}</p>
                    <p className="text-[10px] text-white/50">{b.reason} • Par {b.blockedBy}</p>
                  </div>
                  {b.active ? (
                    <button
                      type="button"
                      onClick={() => requestUnblockIp(b.ipAddress)}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[10px] font-bold text-white cursor-pointer"
                    >
                      Débloquer
                    </button>
                  ) : (
                    <span className="text-[10px] text-white/40">Levée</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 7. PROTECTION FINANCIÈRE                                              */}
      {/* ===================================================================== */}
      {section === 'finance' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-[#141417] border border-emerald-500/25 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h5 className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                  <Landmark className="w-4 h-4" />
                  <span>Protection Financière & Registre Serveur</span>
                </h5>
                <p className="text-[10px] text-white/60 mt-0.5">
                  Soldes calculés exclusivement depuis le registre immuable. Toute modification directe de solde est bloquée côté serveur (HTTP 403).
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/35 text-amber-300 text-[10px] font-bold shrink-0">
                {suspiciousWithdrawals.length} en vérification
              </span>
            </div>

            {Object.keys(financeBalances).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-2 border-t border-white/10">
                {Object.entries(financeBalances).map(([accId, bal]) => (
                  <div key={accId} className="p-2 rounded-xl bg-black/40 border border-white/10 flex justify-between items-center text-[11px]">
                    <span className="font-mono text-white/70 truncate max-w-[160px]">{accId}</span>
                    <b className="text-emerald-400">{formatFCFA(bal)}</b>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Suspicious / Held Withdrawals Queue */}
          <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-2.5">
            <h5 className="text-xs font-black text-white">Retraits suspects & Vérifications</h5>
            {suspiciousWithdrawals.length === 0 ? (
              <p className="text-xs text-white/45 py-4 text-center">Aucun retrait suspect en attente de contrôle.</p>
            ) : (
              suspiciousWithdrawals.map((entry) => (
                <div key={entry.id} className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/35 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-white">{entry.accountName} ({entry.accountEmail})</p>
                      <p className="text-[10px] text-white/60 font-mono">
                        Réf {entry.reference} • {entry.channel} • Cible {entry.payoutTarget || '—'}
                      </p>
                    </div>
                    <span className="text-sm font-black text-amber-300">{formatFCFA(entry.amountFcfa)}</span>
                  </div>
                  {entry.suspicionReasons && (
                    <ul className="text-[10px] text-amber-200 list-disc pl-4 space-y-0.5">
                      {entry.suspicionReasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[10px] text-white/50">
                    Appareil : {entry.device || '—'} • IP : {entry.ipAddress || '—'} • {formatDateTime(entry.createdAt)}
                  </p>
                  {can('manageFinanceProtection') && (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleReviewWithdrawal(entry, 'approve')}
                        className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black cursor-pointer"
                      >
                        Approuver (MFA)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewWithdrawal(entry, 'reject')}
                        className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black cursor-pointer"
                      >
                        Rejeter fraude (MFA)
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* All Financial Ledger Movements */}
          <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-2">
            <h5 className="text-xs font-black text-white">Registre des transactions vérifiées ({financeEntries.length})</h5>
            {financeEntries.length === 0 ? (
              <p className="text-xs text-white/45 py-3 text-center">Aucune écriture financière enregistrée sur cette session.</p>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto no-scrollbar">
                {financeEntries.map((e) => (
                  <div key={e.id} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-2 text-[11px]">
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">{e.accountName} • {e.channel}</p>
                      <p className="text-[10px] text-white/50 truncate">
                        {e.reference} • {e.payoutTarget || 'Crédit plateforme'} • {formatDateTime(e.createdAt)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-white">{formatFCFA(e.amountFcfa)}</p>
                      <span
                        className={`text-[9px] font-bold uppercase ${
                          e.status === 'valide'
                            ? 'text-emerald-400'
                            : e.status === 'rejete'
                            ? 'text-rose-400'
                            : 'text-amber-300'
                        }`}
                      >
                        {e.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 8. JOURNAL D'AUDIT (IMMUABLE SHA-256)                                 */}
      {/* ===================================================================== */}
      {section === 'audit' && (
        <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h5 className="text-xs font-black text-white flex items-center gap-1.5">
                <History className="w-4 h-4 text-amber-400" />
                <span>Journal d'Audit Immuable</span>
              </h5>
              <p className="text-[10px] text-white/50">Non modifiable, non supprimable • Chaîne SHA-256 vérifiée</p>
            </div>
            {auditIntegrity && (
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-300 font-mono">
                {auditIntegrity.valid ? 'CHAÎNE INTÈGRE' : 'RUPTURE CHAÎNE'} • #{auditIntegrity.totalEntries}
              </span>
            )}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-white/35 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              placeholder="Filtrer par acteur, action, cible, IP..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white"
            />
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto no-scrollbar">
            {filteredAuditLogs.map((log) => (
              <div key={log.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-white">{log.action}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                      log.result === 'bloque' || log.result === 'echec'
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-emerald-500/15 text-emerald-300'
                    }`}
                  >
                    #{log.seq} • {log.result || 'succes'}
                  </span>
                </div>
                <p className="text-[11px] text-white/75">
                  Cible : <span className="text-white">{log.target}</span>
                </p>
                <p className="text-[10px] text-white/50">
                  Par <b className="text-white/80">{log.actorName}</b> ({log.actorRole}) • IP {log.ipAddress} • {log.device || 'Console Web'} • {formatDateTime(log.timestamp)}
                </p>
                {log.reason && <p className="text-[10px] text-amber-300/85">Motif : {log.reason}</p>}
                <p className="text-[9px] font-mono text-white/35 truncate">SHA-256 : {log.entryHash}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 9. INCIDENTS ET COMPTES SUSPENDUS                                     */}
      {/* ===================================================================== */}
      {section === 'incidents' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 p-3.5 rounded-2xl bg-[#141417] border border-white/10">
            <div>
              <h5 className="text-xs font-black text-white flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4 text-rose-400" />
                <span>Gestion des Incidents & Comptes Compromis</span>
              </h5>
              <p className="text-[10px] text-white/50">Aucune suppression automatique de compte ou d’historique</p>
            </div>
            {can('manageIncidents') && (
              <button
                type="button"
                onClick={() => setCompromiseFormOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black cursor-pointer shrink-0"
              >
                Signaler compromis
              </button>
            )}
          </div>

          {/* Active Suspensions */}
          <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-2">
            <h6 className="text-[11px] font-black uppercase text-white/70">Comptes suspendus / restreints ({suspendedAccounts.length})</h6>
            {suspendedAccounts.length === 0 ? (
              <p className="text-xs text-white/45 py-3 text-center">Aucun compte actuellement suspendu.</p>
            ) : (
              suspendedAccounts.map((s) => (
                <div key={`${s.accountId}-${s.suspendedAt}`} className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-white">{s.accountName} ({s.accountEmail})</p>
                      <p className="text-[10px] text-white/50">
                        {s.accountType} • Par {s.suspendedBy} • {formatDateTime(s.suspendedAt)}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${s.active ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                      {s.active ? 'Suspendu' : 'Réactivé'}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-200/85">Motif : {s.reason}</p>
                  {s.blockedOperations && s.blockedOperations.length > 0 && (
                    <p className="text-[10px] text-rose-300">Opérations bloquées : {s.blockedOperations.join(', ')}</p>
                  )}
                  {s.active && can('executeProtectionActions') && (
                    <button
                      type="button"
                      onClick={() =>
                        requestReactivateAccount({
                          accountId: s.accountId,
                          accountEmail: s.accountEmail,
                          accountName: s.accountName
                        })
                      }
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black cursor-pointer"
                    >
                      Réactiver après vérification
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Incident Timeline */}
          <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-2">
            <h6 className="text-[11px] font-black uppercase text-white/70">Historique des incidents ({incidents.length})</h6>
            {incidents.length === 0 ? (
              <p className="text-xs text-white/45 py-3 text-center">Aucun incident enregistré.</p>
            ) : (
              incidents.map((inc) => (
                <div key={inc.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-white">{inc.accountName} ({inc.accountEmail})</span>
                    <span className="px-2 py-0.5 rounded bg-white/10 text-[9px] font-bold uppercase text-white/80">
                      {inc.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/75">{inc.summary}</p>
                  <div className="space-y-1 pl-2 border-l border-white/15 text-[10px] text-white/55">
                    {inc.timeline.map((step, i) => (
                      <div key={i}>
                        <span className="text-white/80 font-bold">{step.action}</span> — {step.details} ({step.actor} • {formatDateTime(step.at)})
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 10. PARAMÈTRES DE SÉCURITÉ                                            */}
      {/* ===================================================================== */}
      {section === 'settings' && settingsDraft && (
        <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h5 className="text-xs font-black text-white flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-sky-400" />
                <span>Paramètres de sécurité serveur</span>
              </h5>
              <p className="text-[10px] text-white/50">Validation MFA requise à l'enregistrement</p>
            </div>
            {can('modifySettings') && (
              <button
                type="button"
                onClick={handleSaveSettingsWithMfa}
                className="px-3.5 py-2 rounded-xl bg-[#FF6321] hover:bg-[#ff753b] text-white text-xs font-black cursor-pointer"
              >
                Enregistrer (MFA)
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { key: 'maxLoginAttempts', label: 'Max échecs connexion' },
              { key: 'tempBlockMinutes', label: 'Blocage temp. (min)' },
              { key: 'progressiveDelaySeconds', label: 'Délai progressif (sec)' },
              { key: 'rateLimitPerMinute', label: 'Limite API (req/min)' },
              { key: 'sessionTtlMinutes', label: 'Expiration session (min)' },
              { key: 'maxAutoWithdrawalFcfa', label: 'Seuil retrait auto (FCFA)' },
              { key: 'logRetentionDays', label: 'Rétention logs (jours)' }
            ].map((f) => (
              <div key={f.key} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                <label className="text-[10px] text-white/55 block mb-1">{f.label}</label>
                <input
                  type="number"
                  min={1}
                  value={Number((settingsDraft as unknown as Record<string, unknown>)[f.key] || 1)}
                  onChange={(e) =>
                    setSettingsDraft((prev) => (prev ? { ...prev, [f.key]: Math.max(1, Number(e.target.value)) } : prev))
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-xs font-bold text-white"
                />
              </div>
            ))}
          </div>

          <div className="space-y-1.5 text-xs">
            {(
              [
                ['requireTwoFactorAdmins', '2FA obligatoire pour Administrateurs & Agents'],
                ['requireTwoFactorSensitiveActions', 'Confirmation MFA sur actions admin sensibles'],
                ['requireReauthBeforeWithdrawals', 'Nouvelle authentification exigée avant retrait'],
                ['alertsEnabled', 'Génération automatique des alertes 5 niveaux'],
                ['notifySuperAdminOnCritical', 'Alerter Super Admin sur incidents critiques'],
                ['detectSqlInjection', 'Blocage signatures SQL Injection (SQLi)'],
                ['detectXss', 'Blocage scripts malveillants (XSS)'],
                ['detectBotScanners', 'Blocage bots & scanners de vulnérabilités'],
                ['detectUnusualDevices', 'Détection nouveaux appareils & connexions inhabituelles'],
                ['detectMaliciousUploads', 'Contrôle extensions & fichiers dangereux'],
                ['cloudflareWafConnected', 'Activer connecteur webhook Cloudflare WAF']
              ] as Array<[keyof SecuritySettings, string]>
            ).map(([key, label]) => {
              const checked = Boolean(settingsDraft[key]);
              return (
                <div key={key} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-white/85">{label}</span>
                  <button
                    type="button"
                    onClick={() => setSettingsDraft((prev) => (prev ? { ...prev, [key]: !checked } : prev))}
                    className={`w-10 h-5 rounded-full p-0.5 transition cursor-pointer shrink-0 ${
                      checked ? 'bg-emerald-500' : 'bg-white/20'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        checked ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODALS: MFA STEP-UP, COMPROMISED REPORT, ADD STAFF, CONFIRM, HISTORY */}
      {/* ===================================================================== */}
      {mfaAction && (
        <div className="fixed inset-0 z-[130] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={(e) => void submitMfaDialog(e)}
            className="w-full max-w-sm rounded-3xl bg-[#141417] border border-purple-500/35 p-5 space-y-3.5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-purple-400" />
                <h4 className="text-sm font-black text-white">{mfaAction.title}</h4>
              </div>
              <button
                type="button"
                onClick={() => setMfaAction(null)}
                className="p-1 rounded-full bg-white/10 text-white/70"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-white/65">{mfaAction.description}</p>
            {mfaPreviewCode && (
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-[11px] text-purple-200">
                Code de vérification généré pour votre session : <b className="font-mono text-white">{mfaPreviewCode}</b>
              </div>
            )}
            <input
              type="text"
              required
              value={mfaInputCode}
              onChange={(e) => setMfaInputCode(e.target.value)}
              placeholder="Code à 6 chiffres"
              className="w-full px-3 py-2.5 rounded-xl bg-black/50 border border-white/15 text-center font-mono text-base font-black text-white tracking-widest"
            />
            {mfaError && <p className="text-xs text-rose-400">{mfaError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMfaAction(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-xs font-bold text-white/80"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={mfaLoading}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-black text-white"
              >
                {mfaLoading ? 'Vérification...' : 'Valider MFA'}
              </button>
            </div>
          </form>
        </div>
      )}

      {compromiseFormOpen && (
        <div className="fixed inset-0 z-[125] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={(e) => void handleCompromiseSubmit(e)}
            className="w-full max-w-md rounded-3xl bg-[#141417] border border-rose-500/35 p-5 space-y-3 text-xs"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <h4 className="text-sm font-black text-white">Signaler un compte compromis</h4>
              <button type="button" onClick={() => setCompromiseFormOpen(false)} className="p-1 text-white/60">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="email"
              required
              value={compEmail}
              onChange={(e) => setCompEmail(e.target.value)}
              placeholder="Adresse e-mail du compte (ex : vendeur@djassa.ci)"
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white"
            />
            <input
              type="text"
              value={compName}
              onChange={(e) => setCompName(e.target.value)}
              placeholder="Nom complet (optionnel)"
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white"
            />
            <select
              value={compType}
              onChange={(e) => setCompType(e.target.value as SecurityAccountType)}
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white"
            >
              <option value="client">Client</option>
              <option value="vendeur">Vendeur</option>
              <option value="livreur">Livreur</option>
              <option value="entreprise de livraison">Entreprise de livraison</option>
              <option value="administrateur">Administrateur</option>
            </select>
            <textarea
              rows={2}
              required
              value={compSummary}
              onChange={(e) => setCompSummary(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white"
            />
            <label className="flex items-center gap-2 text-white/80">
              <input
                type="checkbox"
                checked={compForceReset}
                onChange={(e) => setCompForceReset(e.target.checked)}
              />
              <span>Forcer la réinitialisation du mot de passe et révoquer toutes les sessions</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(['withdrawals', 'profile_changes', 'role_changes', 'api_writes'] as SensitiveOperationType[]).map((op) => {
                const active = compOps.includes(op);
                return (
                  <button
                    key={op}
                    type="button"
                    onClick={() =>
                      setCompOps((prev) => (active ? prev.filter((x) => x !== op) : [...prev, op]))
                    }
                    className={`px-2 py-1 rounded-lg border text-[10px] font-bold ${
                      active ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' : 'bg-white/5 border-white/10 text-white/50'
                    }`}
                  >
                    Bloquer : {op}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCompromiseFormOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 font-bold text-white/80"
              >
                Annuler
              </button>
              <button type="submit" className="flex-1 py-2.5 rounded-xl bg-rose-600 font-black text-white">
                Activer la protection
              </button>
            </div>
          </form>
        </div>
      )}

      {addStaffOpen && (
        <div className="fixed inset-0 z-[125] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleAddStaffSubmit}
            className="w-full max-w-md rounded-3xl bg-[#141417] border border-purple-500/35 p-5 space-y-3 text-xs"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <h4 className="text-sm font-black text-white">Ajouter un Collaborateur (Protégé MFA)</h4>
              <button type="button" onClick={() => setAddStaffOpen(false)} className="p-1 text-white/60">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              required
              value={newStaffName}
              onChange={(e) => setNewStaffName(e.target.value)}
              placeholder="Nom complet"
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white"
            />
            <input
              type="email"
              required
              value={newStaffEmail}
              onChange={(e) => setNewStaffEmail(e.target.value)}
              placeholder="Email professionnel (@djassa.ci)"
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white"
            />
            <input
              type="text"
              value={newStaffTitle}
              onChange={(e) => setNewStaffTitle(e.target.value)}
              placeholder="Intitulé de poste"
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white"
            />
            <select
              value={newStaffRole}
              onChange={(e) => setNewStaffRole(e.target.value as 'admin' | 'security_agent' | 'other_agent')}
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white"
            >
              <option value="security_agent">Agent Sécurité</option>
              <option value="admin">Administrateur (Sans Super Admin)</option>
              <option value="other_agent">Agent Opérationnel Restreint</option>
            </select>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAddStaffOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 font-bold text-white/80"
              >
                Annuler
              </button>
              <button type="submit" className="flex-1 py-2.5 rounded-xl bg-purple-600 font-black text-white">
                Continuer vers MFA
              </button>
            </div>
          </form>
        </div>
      )}

      <SecurityConfirmModal pending={pendingConfirm} onClose={() => setPendingConfirm(null)} />
      {historyTarget && (
        <SecurityTargetHistoryModal target={historyTarget} actorId={actor.id} onClose={() => setHistoryTarget(null)} />
      )}
    </div>
  );
};
