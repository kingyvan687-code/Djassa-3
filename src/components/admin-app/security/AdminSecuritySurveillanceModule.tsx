import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
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
  Lock,
  LogIn,
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
  UserX,
  Users
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import {
  getActiveSecurityActorId,
  securityService,
  setActiveSecurityActorId
} from '../../../services/securityService';
import type {
  ProtectedAuditEntry,
  SecurityActiveSession,
  SecurityAlert,
  SecurityBlockedIp,
  SecurityCyberAttackEvent,
  SecurityDashboardSummary,
  SecurityIntrusionEvent,
  SecurityLoginLog,
  SecurityPeriodFilter,
  SecurityPermissionKey,
  SecurityRole,
  SecuritySettings,
  SecurityStaffMember,
  SecuritySuspendedAccount
} from '../../../types/security';
import { PendingConfirmation, SecurityConfirmModal } from './SecurityConfirmModal';
import { SecurityTargetHistoryModal } from './SecurityTargetHistoryModal';

type ModuleSection =
  | 'dashboard'
  | 'logins'
  | 'threats'
  | 'alerts'
  | 'sessions'
  | 'governance';

const PERMISSION_LABELS: Record<SecurityPermissionKey, string> = {
  viewDashboard: 'Tableau de bord',
  viewLoginLogs: 'Journal connexions',
  viewIntrusions: 'Intrusions',
  viewCyberattacks: 'Cyberattaques',
  manageAlerts: 'Gestion alertes',
  executeProtectionActions: 'Actions protection',
  manageSessions: 'Sessions actives',
  modifySettings: 'Paramètres sécurité',
  managePermissions: 'Gestion permissions',
  manageFinanceProtection: 'Protection financière',
  manageIncidents: 'Gestion incidents'
};

const ROLE_BADGE_MAP: Record<SecurityRole, { label: string; cls: string }> = {
  super_admin: { label: 'Super Admin', cls: 'bg-purple-500/20 text-purple-300 border-purple-500/35' },
  admin: { label: 'Administrateur', cls: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/35' },
  security_agent: { label: 'Agent Sécurité', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35' },
  other_agent: { label: 'Autre Agent (Restreint)', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' }
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
};

export const AdminSecuritySurveillanceModule: React.FC = () => {
  const { adminUsers, updateAdminUser, addAuditLog, showToast } = useApp();

  const [actorId, setActorId] = useState<string>(() => getActiveSecurityActorId());
  const [actor, setActor] = useState<SecurityStaffMember | null>(null);
  const [staffDirectory, setStaffDirectory] = useState<SecurityStaffMember[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loadingIdentity, setLoadingIdentity] = useState(true);

  const [section, setSection] = useState<ModuleSection>('dashboard');
  const [refreshing, setRefreshing] = useState(false);

  // Dashboard filters & data
  const [period, setPeriod] = useState<SecurityPeriodFilter>('7d');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [dashboard, setDashboard] = useState<SecurityDashboardSummary | null>(null);

  // Login logs state
  const [loginLogs, setLoginLogs] = useState<SecurityLoginLog[]>([]);
  const [loginSearch, setLoginSearch] = useState('');
  const [loginTypeFilter, setLoginTypeFilter] = useState('all');
  const [loginStatusFilter, setLoginStatusFilter] = useState('all');

  // Intrusions & Cyberattacks state
  const [threatSubView, setThreatSubView] = useState<'intrusions' | 'cyberattacks'>('intrusions');
  const [intrusions, setIntrusions] = useState<SecurityIntrusionEvent[]>([]);
  const [cyberAttacks, setCyberAttacks] = useState<SecurityCyberAttackEvent[]>([]);
  const [cloudflareConnected, setCloudflareConnected] = useState(false);
  const [threatSeverityFilter, setThreatSeverityFilter] = useState('all');
  const [attackTypeFilter, setAttackTypeFilter] = useState('all');

  // Alerts state
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [alertSeverityFilter, setAlertSeverityFilter] = useState('all');
  const [alertStatusFilter, setAlertStatusFilter] = useState('all');

  // Sessions & protection actions state
  const [sessions, setSessions] = useState<SecurityActiveSession[]>([]);
  const [blockedIps, setBlockedIps] = useState<SecurityBlockedIp[]>([]);
  const [suspendedAccounts, setSuspendedAccounts] = useState<SecuritySuspendedAccount[]>([]);
  const [manualIpInput, setManualIpInput] = useState('');
  const [manualIpDuration, setManualIpDuration] = useState('60');
  const [selectedAccountId, setSelectedAccountId] = useState('');

  // Settings, Permissions & Audit state
  const [governanceTab, setGovernanceTab] = useState<'settings' | 'permissions' | 'audit'>('settings');
  const [settingsDraft, setSettingsDraft] = useState<SecuritySettings | null>(null);
  const [permissionsStaff, setPermissionsStaff] = useState<SecurityStaffMember[]>([]);
  const [auditLogs, setAuditLogs] = useState<ProtectedAuditEntry[]>([]);
  const [auditIntegrity, setAuditIntegrity] = useState<{
    valid: boolean;
    totalEntries: number;
    brokenAtSeq?: number;
    lastHash: string;
  } | null>(null);

  // Modals
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);
  const [historyTarget, setHistoryTarget] = useState<string | null>(null);
  const [lastRbacNotice, setLastRbacNotice] = useState<string | null>(null);

  const can = useCallback(
    (perm: SecurityPermissionKey): boolean => {
      if (!actor || !actor.active) return false;
      if (actor.role === 'super_admin') return true;
      if (actor.role === 'other_agent') return false;
      return Boolean(actor.permissions?.[perm]);
    },
    [actor]
  );

  // Sync adminUsers suspension cleanly with UI state
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
    setLastRbacNotice(null);
    try {
      const me = await securityService.getMe(actorId);
      setActor(me.actor);
      if (me.staffDirectory && me.staffDirectory.length > 0) {
        setStaffDirectory(me.staffDirectory);
      }
      if (!me.authorized) {
        setAuthError(
          `Accès refusé : le profil "${me.actor.name}" (${ROLE_BADGE_MAP[me.actor.role].label}) ne dispose d’aucune permission de sécurité.`
        );
      }
    } catch (err: unknown) {
      setActor(null);
      setAuthError((err as Error)?.message || 'Accès refusé au module Sécurité & surveillance.');
    } finally {
      setLoadingIdentity(false);
    }
  }, [actorId]);

  const loadAllPermittedData = useCallback(async () => {
    if (!actor || !actor.active || actor.role === 'other_agent') return;
    setRefreshing(true);
    setLastRbacNotice(null);

    try {
      const tasks: Promise<void>[] = [];

      if (can('viewDashboard')) {
        tasks.push(
          securityService
            .getDashboard(period, customFrom, customTo, actorId)
            .then((res) => setDashboard(res))
            .catch((e) => setLastRbacNotice((e as Error).message))
        );
        tasks.push(
          securityService
            .getSettings(actorId)
            .then((res) => setSettingsDraft(res.settings))
            .catch(() => {})
        );
        tasks.push(
          securityService
            .getAuditLogs(actorId)
            .then((res) => {
              setAuditLogs(res.logs);
              setAuditIntegrity(res.integrity);
            })
            .catch(() => {})
        );
      }

      if (can('viewLoginLogs')) {
        tasks.push(
          securityService
            .getLoginLogs(
              {
                q: loginSearch,
                accountType: loginTypeFilter,
                status: loginStatusFilter,
                period,
                from: customFrom,
                to: customTo
              },
              actorId
            )
            .then((res) => setLoginLogs(res.logs))
            .catch(() => {})
        );
      }

      if (can('viewIntrusions')) {
        tasks.push(
          securityService
            .getIntrusions(threatSeverityFilter, 'all', actorId)
            .then((res) => setIntrusions(res.intrusions))
            .catch(() => {})
        );
      }

      if (can('viewCyberattacks')) {
        tasks.push(
          securityService
            .getCyberAttacks(attackTypeFilter, actorId)
            .then((res) => {
              setCyberAttacks(res.cyberAttacks);
              setCloudflareConnected(res.cloudflareWafConnected);
            })
            .catch(() => {})
        );
      }

      if (can('manageAlerts')) {
        tasks.push(
          securityService
            .getAlerts(alertSeverityFilter, alertStatusFilter, actorId)
            .then((res) => setAlerts(res.alerts))
            .catch(() => {})
        );
      }

      if (can('manageSessions')) {
        tasks.push(
          securityService
            .getSessionsAndBlocks(actorId)
            .then((res) => {
              setSessions(res.sessions);
              setBlockedIps(res.blockedIps);
              setSuspendedAccounts(res.suspendedAccounts);
            })
            .catch(() => {})
        );
      }

      if (can('managePermissions')) {
        tasks.push(
          securityService
            .getPermissions(actorId)
            .then((res) => setPermissionsStaff(res.staff))
            .catch(() => {})
        );
      }

      await Promise.all(tasks);
    } finally {
      setRefreshing(false);
    }
  }, [
    actor,
    actorId,
    can,
    period,
    customFrom,
    customTo,
    loginSearch,
    loginTypeFilter,
    loginStatusFilter,
    threatSeverityFilter,
    attackTypeFilter,
    alertSeverityFilter,
    alertStatusFilter
  ]);

  useEffect(() => {
    void loadIdentity();
  }, [loadIdentity]);

  useEffect(() => {
    if (actor && actor.role !== 'other_agent') {
      void loadAllPermittedData();
    }
  }, [actor, loadAllPermittedData]);

  // Select first available account in protection panel
  useEffect(() => {
    if (!selectedAccountId && adminUsers.length > 0) {
      const nonAdmin = adminUsers.find((u) => u.role !== 'admin') || adminUsers[0];
      setSelectedAccountId(nonAdmin.id);
    }
  }, [adminUsers, selectedAccountId]);

  const handleSwitchActor = async (nextId: string) => {
    try {
      await securityService.switchTestRole(nextId);
      setActorId(nextId);
      showToast('Profil de vérification RBAC mis à jour');
    } catch (err: unknown) {
      showToast((err as Error)?.message || 'Impossible de basculer ce profil RBAC.');
    }
  };

  // Protection Actions wrapped in confirmation modal
  const requestBlockIp = (ip: string, defaultReason = 'Activité suspecte détectée') => {
    if (!can('executeProtectionActions')) {
      showToast('Permission "Actions protection" requise.');
      return;
    }
    setPendingConfirm({
      title: 'Bloquer cette adresse IP ?',
      targetLabel: ip,
      description:
        "Le pare-feu applicatif DJASSA rejettera immédiatement (HTTP 403) toutes les requêtes provenant de cette adresse IP.",
      confirmLabel: 'Confirmer le blocage IP',
      tone: 'danger',
      requireReason: true,
      defaultReason,
      onConfirm: async (reason) => {
        const mins = Number(manualIpDuration) > 0 ? Number(manualIpDuration) : undefined;
        await securityService.blockIp(ip, reason, mins, actorId);
        addAuditLog('Blocage IP Sécurité', ip, 'security', reason);
        showToast(`IP ${ip} bloquée sur le serveur`);
        await loadAllPermittedData();
      }
    });
  };

  const requestUnblockIp = (ip: string) => {
    setPendingConfirm({
      title: 'Débloquer cette adresse IP ?',
      targetLabel: ip,
      description: 'Cette adresse IP pourra de nouveau accéder aux API DJASSA.',
      confirmLabel: 'Débloquer l’IP',
      tone: 'primary',
      requireReason: false,
      defaultReason: 'Levée manuelle après vérification',
      onConfirm: async () => {
        await securityService.unblockIp(ip, actorId);
        addAuditLog('Déblocage IP Sécurité', ip, 'security', 'IP réautorisée');
        showToast(`IP ${ip} débloquée`);
        await loadAllPermittedData();
      }
    });
  };

  const requestSuspendAccount = (target: {
    accountId: string;
    accountName: string;
    accountEmail: string;
    accountType: string;
  }) => {
    if (!can('executeProtectionActions')) {
      showToast('Permission "Actions protection" requise.');
      return;
    }
    setPendingConfirm({
      title: 'Suspendre temporairement ce compte ?',
      targetLabel: `${target.accountName} (${target.accountEmail})`,
      description:
        'Toutes les sessions actives seront révoquées et toute nouvelle connexion sera bloquée jusqu’à réactivation.',
      confirmLabel: 'Suspendre le compte',
      tone: 'danger',
      requireReason: true,
      defaultReason: 'Vérification de sécurité requise',
      onConfirm: async (reason) => {
        await securityService.suspendAccount(
          {
            accountId: target.accountId,
            accountName: target.accountName,
            accountEmail: target.accountEmail,
            accountType: target.accountType,
            reason
          },
          actorId
        );
        syncAppUserSuspension(target.accountEmail, true);
        addAuditLog('Suspension compte (Sécurité)', target.accountName, 'security', reason);
        showToast(`Compte ${target.accountName} suspendu`);
        await loadAllPermittedData();
      }
    });
  };

  const requestReactivateAccount = (acc: SecuritySuspendedAccount) => {
    setPendingConfirm({
      title: 'Réactiver ce compte ?',
      targetLabel: `${acc.accountName} (${acc.accountEmail})`,
      description: 'Le compte pourra de nouveau se connecter à l’application DJASSA.',
      confirmLabel: 'Réactiver le compte',
      tone: 'primary',
      requireReason: false,
      defaultReason: 'Contrôle sécurité validé',
      onConfirm: async () => {
        await securityService.reactivateAccount(
          { accountId: acc.accountId, accountEmail: acc.accountEmail },
          actorId
        );
        syncAppUserSuspension(acc.accountEmail, false);
        addAuditLog('Réactivation compte (Sécurité)', acc.accountName, 'security', 'Accès rétabli');
        showToast(`Compte ${acc.accountName} réactivé`);
        await loadAllPermittedData();
      }
    });
  };

  const requestRevokeSession = (session: SecurityActiveSession) => {
    setPendingConfirm({
      title: 'Déconnecter cet appareil ?',
      targetLabel: `${session.userEmail} • ${session.device} (${session.ipAddress})`,
      description:
        'La session sera immédiatement révoquée côté serveur et l’utilisateur sera déconnecté lors du prochain battement de session.',
      confirmLabel: 'Déconnecter l’appareil',
      tone: 'warning',
      requireReason: true,
      defaultReason: 'Session jugée suspecte',
      onConfirm: async (reason) => {
        await securityService.revokeSession(session.sessionId, reason, actorId);
        addAuditLog('Révocation session', session.userEmail, 'security', reason);
        showToast('Session révoquée');
        await loadAllPermittedData();
      }
    });
  };

  const requestRevokeAllUserSessions = (email: string) => {
    setPendingConfirm({
      title: 'Révoquer toutes les sessions de cet utilisateur ?',
      targetLabel: email,
      description: 'Tous les appareils connectés avec ce compte seront déconnectés.',
      confirmLabel: 'Révoquer toutes les sessions',
      tone: 'danger',
      requireReason: true,
      defaultReason: 'Compromission potentielle du compte',
      onConfirm: async (reason) => {
        const res = await securityService.revokeUserSessions({ userEmail: email, reason }, actorId);
        addAuditLog('Révocation globale sessions', email, 'security', reason);
        showToast(`${res.revokedCount} session(s) révoquée(s)`);
        await loadAllPermittedData();
      }
    });
  };

  const requestRequireReauth = (email: string) => {
    setPendingConfirm({
      title: 'Exiger une nouvelle authentification ?',
      targetLabel: email,
      description: 'L’utilisateur devra ressaisir ses identifiants pour continuer.',
      confirmLabel: 'Exiger ré-authentification',
      tone: 'warning',
      requireReason: true,
      defaultReason: 'Contrôle d’identité renforcé',
      onConfirm: async (reason) => {
        await securityService.requireReauth({ userEmail: email, reason }, actorId);
        addAuditLog('Ré-authentification forcée', email, 'security', reason);
        showToast('Nouvelle authentification exigée');
        await loadAllPermittedData();
      }
    });
  };

  const requestResolveAlert = (alert: SecurityAlert, nextStatus: 'en_examen' | 'resolue') => {
    setPendingConfirm({
      title: nextStatus === 'en_examen' ? 'Passer l’alerte en examen ?' : 'Marquer cette alerte comme résolue ?',
      targetLabel: alert.title,
      description:
        nextStatus === 'resolue'
          ? 'L’alerte sera marquée résolue tout en restant conservée de façon permanente dans l’historique de sécurité.'
          : 'L’alerte sera assignée au statut En examen avec votre identité d’opérateur.',
      confirmLabel: nextStatus === 'en_examen' ? 'Marquer en examen' : 'Confirmer la résolution',
      tone: nextStatus === 'en_examen' ? 'warning' : 'primary',
      requireReason: nextStatus === 'resolue',
      defaultReason: nextStatus === 'resolue' ? 'Incident vérifié et maîtrisé' : 'Analyse démarrée',
      onConfirm: async (note) => {
        await securityService.updateAlertStatus(alert.id, nextStatus, note, actorId);
        addAuditLog(
          nextStatus === 'en_examen' ? 'Examen alerte sécurité' : 'Résolution alerte sécurité',
          alert.title,
          'security',
          note
        );
        showToast(nextStatus === 'en_examen' ? 'Alerte passée en examen' : 'Alerte marquée résolue');
        await loadAllPermittedData();
      }
    });
  };

  const requestSaveSettings = () => {
    if (!settingsDraft) return;
    setPendingConfirm({
      title: 'Appliquer les nouveaux paramètres de sécurité ?',
      targetLabel: 'Politique serveur DJASSA',
      description:
        'Ces règles (seuils de blocage, rate limiting, détection SQLi/XSS/bots) s’appliquent immédiatement sur le serveur Express et sont enregistrées dans le journal d’audit inaltérable.',
      confirmLabel: 'Enregistrer la politique',
      tone: 'primary',
      requireReason: false,
      defaultReason: 'Mise à jour politique de sécurité',
      onConfirm: async () => {
        await securityService.updateSettings(settingsDraft, actorId);
        addAuditLog('Mise à jour politique sécurité', 'Paramètres serveur', 'security', 'Seuils et règles appliqués');
        showToast('Paramètres de sécurité enregistrés et activés');
        await loadAllPermittedData();
      }
    });
  };

  const handleToggleStaffPermission = (
    member: SecurityStaffMember,
    permKey: SecurityPermissionKey,
    nextVal: boolean
  ) => {
    setPendingConfirm({
      title: 'Modifier une permission de sécurité ?',
      targetLabel: `${member.name} • ${PERMISSION_LABELS[permKey]}`,
      description: `La permission passera de "${member.permissions[permKey] ? 'Autorisée' : 'Refusée'}" à "${nextVal ? 'Autorisée' : 'Refusée'}" avec contrôle serveur immédiat.`,
      confirmLabel: 'Appliquer la permission',
      tone: 'warning',
      requireReason: false,
      defaultReason: 'Ajustement RBAC sécurité',
      onConfirm: async () => {
        await securityService.updateStaffPermissions(
          member.id,
          { permissions: { [permKey]: nextVal } },
          actorId
        );
        showToast('Permission mise à jour côté serveur');
        await loadAllPermittedData();
      }
    });
  };

  const visibleSubNav = useMemo(() => {
    const items: Array<{
      id: ModuleSection;
      label: string;
      icon: React.ReactNode;
      visible: boolean;
      badge?: number;
    }> = [
      {
        id: 'dashboard',
        label: 'Tableau de bord',
        icon: <Activity className="w-3.5 h-3.5" />,
        visible: can('viewDashboard')
      },
      {
        id: 'logins',
        label: 'Connexions',
        icon: <LogIn className="w-3.5 h-3.5" />,
        visible: can('viewLoginLogs')
      },
      {
        id: 'threats',
        label: 'Intrusions & Cyber',
        icon: <ShieldAlert className="w-3.5 h-3.5" />,
        visible: can('viewIntrusions') || can('viewCyberattacks')
      },
      {
        id: 'alerts',
        label: 'Alertes',
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
        visible: can('manageAlerts'),
        badge: dashboard?.unresolvedAlertsCount.total || 0
      },
      {
        id: 'sessions',
        label: 'Sessions & Actions',
        icon: <Smartphone className="w-3.5 h-3.5" />,
        visible: can('manageSessions') || can('executeProtectionActions')
      },
      {
        id: 'governance',
        label: 'Paramètres & Audit',
        icon: <Lock className="w-3.5 h-3.5" />,
        visible: can('viewDashboard') || can('modifySettings') || can('managePermissions')
      }
    ];
    return items.filter((i) => i.visible);
  }, [can, dashboard]);

  useEffect(() => {
    if (visibleSubNav.length > 0 && !visibleSubNav.some((i) => i.id === section)) {
      setSection(visibleSubNav[0].id);
    }
  }, [visibleSubNav, section]);

  const selectedAdminTargetUser = useMemo(
    () => adminUsers.find((u) => u.id === selectedAccountId) || adminUsers[0],
    [adminUsers, selectedAccountId]
  );

  if (loadingIdentity) {
    return (
      <div className="p-6 rounded-2xl bg-[#141417] border border-white/10 text-center space-y-2">
        <ShieldCheck className="w-7 h-7 text-emerald-400 mx-auto" />
        <p className="text-xs font-semibold text-white/75">Vérification des droits de sécurité côté serveur...</p>
      </div>
    );
  }

  return (
    <div id="security-surveillance-module" className="space-y-3.5">
      {/* HEADER BAR & ROLE VERIFICATION */}
      <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-black uppercase tracking-wider text-white truncate">
                Sécurité & surveillance
              </h3>
              <p className="text-[11px] text-white/50 truncate">
                {actor ? `${actor.name} • Contrôle serveur actif` : 'Accès restreint'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {actor && (
              <span
                className={`px-2 py-1 rounded-lg border text-[10px] font-bold ${ROLE_BADGE_MAP[actor.role].cls}`}
              >
                {ROLE_BADGE_MAP[actor.role].label}
              </span>
            )}
            <button
              type="button"
              onClick={() => void loadAllPermittedData()}
              disabled={refreshing || !actor || actor.role === 'other_agent'}
              className="min-w-[38px] min-h-[38px] rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/75 cursor-pointer disabled:opacity-40"
              title="Actualiser les données serveur"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Super Admin Critical Alert Notification Banner */}
        {actor?.role === 'super_admin' && (dashboard?.unresolvedAlertsCount.critique || 0) > 0 && (
          <button
            type="button"
            onClick={() => {
              setAlertSeverityFilter('critique');
              setAlertStatusFilter('nouvelle');
              setSection('alerts');
            }}
            className="w-full p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/35 flex items-center justify-between gap-2 text-left cursor-pointer hover:bg-rose-500/20 transition"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-rose-300 truncate">
                  {dashboard?.unresolvedAlertsCount.critique} alerte(s) critique(s) non résolue(s)
                </p>
                <p className="text-[10px] text-rose-200/70">Notification Super Administrateur • Touchez pour examiner</p>
              </div>
            </div>
            <span className="text-[10px] font-black uppercase text-rose-300 shrink-0">Voir →</span>
          </button>
        )}

        {/* Staff RBAC Switcher (Only visible when staffDirectory returned by Super Admin / authorized session) */}
        {staffDirectory.length > 0 && (
          <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-[10px] font-semibold text-white/50">
              Profil actif (contrôle RBAC serveur) :
            </span>
            <select
              value={actorId}
              onChange={(e) => handleSwitchActor(e.target.value)}
              className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-white focus:outline-none focus:border-emerald-400"
            >
              {staffDirectory.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} [{ROLE_BADGE_MAP[m.role].label}]
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* RBAC ACCESS DENIED SCREEN */}
      {authError && (
        <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-2.5">
          <ShieldOff className="w-8 h-8 text-rose-400 mx-auto" />
          <h4 className="text-sm font-bold text-white">Accès refusé par le contrôleur sécurité</h4>
          <p className="text-xs text-rose-200/80 leading-relaxed">{authError}</p>
          <p className="text-[11px] text-white/50">
            Ce module est réservé au Super administrateur ainsi qu’aux agents disposant d’une permission de sécurité explicite validée côté serveur.
          </p>
        </div>
      )}

      {lastRbacNotice && (
        <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-[11px] text-amber-300">
          {lastRbacNotice}
        </div>
      )}

      {/* AUTHORIZED MODULE CONTENT */}
      {!authError && actor && (
        <>
          {/* COMPACT MODULE SUB-NAVIGATION */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {visibleSubNav.map((tab) => {
              const active = section === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSection(tab.id)}
                  className={`min-h-[40px] px-3 py-2 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition cursor-pointer ${
                    active
                      ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                      : 'bg-white/[0.04] border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {typeof tab.badge === 'number' && tab.badge > 0 && (
                    <span className="px-1.5 py-0.5 rounded-md bg-rose-500 text-white text-[9px] font-black leading-none">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* =================================================================
              1. TABLEAU DE BORD DE SÉCURITÉ
             ================================================================= */}
          {section === 'dashboard' && can('viewDashboard') && (
            <div className="space-y-3">
              {/* Period Filters */}
              <div className="p-3 rounded-2xl bg-[#141417] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-white/65 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Période d’analyse</span>
                  </span>
                  <span className="text-[10px] font-mono text-white/40">Données réelles serveur</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: 'today', label: "Aujourd'hui" },
                      { id: '7d', label: '7 jours' },
                      { id: '30d', label: '30 jours' },
                      { id: 'custom', label: 'Perso' }
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPeriod(p.id)}
                      className={`min-h-[38px] rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                        period === p.id
                          ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                          : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {period === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] text-white/50 block mb-1">Du</label>
                      <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="w-full rounded-xl bg-black/50 border border-white/15 px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/50 block mb-1">Au</label>
                      <input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="w-full rounded-xl bg-black/50 border border-white/15 px-2.5 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 8 Real KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                {[
                  { label: 'Total connexions', value: dashboard?.kpis.totalLogins ?? 0, tone: 'text-white' },
                  { label: 'Connexions réussies', value: dashboard?.kpis.successfulLogins ?? 0, tone: 'text-emerald-400' },
                  { label: 'Tentatives échouées', value: dashboard?.kpis.failedLogins ?? 0, tone: 'text-amber-400' },
                  { label: 'Connexions suspectes', value: dashboard?.kpis.suspiciousLogins ?? 0, tone: 'text-orange-400' },
                  { label: 'Incidents détectés', value: dashboard?.kpis.detectedIncidents ?? 0, tone: 'text-rose-400' },
                  { label: 'Attaques bloquées', value: dashboard?.kpis.blockedAttacks ?? 0, tone: 'text-cyan-400' },
                  { label: 'Sessions actives', value: dashboard?.kpis.activeSessions ?? 0, tone: 'text-purple-400' },
                  { label: 'Comptes suspendus', value: dashboard?.kpis.temporarilySuspendedAccounts ?? 0, tone: 'text-rose-300' }
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="p-3 rounded-2xl bg-[#141417] border border-white/10 flex flex-col justify-between gap-1"
                  >
                    <span className="text-[10px] font-semibold text-white/55 leading-tight">{kpi.label}</span>
                    <span className={`text-xl font-black font-mono ${kpi.tone}`}>{kpi.value}</span>
                  </div>
                ))}
              </div>

              {/* Honest Protection & Integrity Status */}
              <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-2.5">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-cyan-400" />
                  <span>État réel des protections serveur & intégrité</span>
                </h4>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-white/75">Pare-feu applicatif Express (App-WAF)</span>
                    <span className="text-emerald-400 font-bold">Actif</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-white/75">Limitation de requêtes (Rate Limit)</span>
                    <span className="text-emerald-400 font-bold">
                      {settingsDraft?.rateLimitPerMinute || 120} req/min
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-white/75">Inspection SQLi / XSS / Bots / Uploads</span>
                    <span
                      className={`font-bold ${
                        dashboard?.protectionsStatus.sqlXssInspection === 'active'
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {dashboard?.protectionsStatus.sqlXssInspection === 'active'
                        ? 'Actif'
                        : dashboard?.protectionsStatus.sqlXssInspection === 'partial'
                        ? 'Partiel'
                        : 'Désactivé'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-white/75">Cloudflare WAF / DDoS Edge externe</span>
                    <span
                      className={`font-bold ${
                        dashboard?.protectionsStatus.cloudflareWaf === 'connected'
                          ? 'text-emerald-400'
                          : 'text-white/45'
                      }`}
                    >
                      {dashboard?.protectionsStatus.cloudflareWaf === 'connected'
                        ? 'Connecté (Webhook actif)'
                        : 'Non connecté (Webhook prêt)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-white/75">Chaîne d’intégrité des journaux (SHA-256)</span>
                    <span className={dashboard?.logIntegrity.valid ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {dashboard?.logIntegrity.valid
                        ? `Intègre (${dashboard.logIntegrity.totalEntries})`
                        : 'Anomalie détectée'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              2. JOURNAL DES CONNEXIONS
             ================================================================= */}
          {section === 'logins' && can('viewLoginLogs') && (
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-[#141417] border border-white/10 space-y-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={loginSearch}
                    onChange={(e) => setLoginSearch(e.target.value)}
                    placeholder="Rechercher nom, ID, email, IP, appareil..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder-white/35 focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={loginTypeFilter}
                    onChange={(e) => setLoginTypeFilter(e.target.value)}
                    className="rounded-xl bg-black/50 border border-white/10 px-2.5 py-2 text-[11px] font-semibold text-white"
                  >
                    <option value="all">Tous types de comptes</option>
                    <option value="client">Client</option>
                    <option value="vendeur">Vendeur</option>
                    <option value="livreur">Livreur</option>
                    <option value="entreprise de livraison">Entreprise de livraison</option>
                    <option value="administrateur">Administrateur</option>
                    <option value="agent">Agent</option>
                  </select>
                  <select
                    value={loginStatusFilter}
                    onChange={(e) => setLoginStatusFilter(e.target.value)}
                    className="rounded-xl bg-black/50 border border-white/10 px-2.5 py-2 text-[11px] font-semibold text-white"
                  >
                    <option value="all">Tous statuts</option>
                    <option value="reussite">Réussite</option>
                    <option value="echec">Échec</option>
                    <option value="suspect">Suspect</option>
                  </select>
                </div>
              </div>

              {loginLogs.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#141417] border border-white/10 text-center text-xs text-white/50">
                  Aucune connexion enregistrée pour ces critères. Les connexions réelles effectuées sur DJASSA apparaîtront ici automatiquement.
                </div>
              ) : (
                <div className="space-y-2">
                  {loginLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-2xl bg-[#141417] border border-white/10 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">{log.accountName}</p>
                          <p className="text-[10px] font-mono text-white/50 truncate">
                            ID: {log.accountId} • {log.accountEmail}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase shrink-0 ${
                            log.status === 'reussite'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : log.status === 'suspect'
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {log.status === 'reussite' ? 'Réussite' : log.status === 'suspect' ? 'Suspect' : 'Échec'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-white/70 bg-white/[0.03] rounded-xl p-2">
                        <div className="truncate">
                          <span className="text-white/40">Type : </span>
                          <span className="font-semibold capitalize">{log.accountType}</span>
                        </div>
                        <div className="truncate font-mono">
                          <span className="text-white/40 font-sans">IP : </span>
                          {log.ipAddress}
                        </div>
                        <div className="truncate">
                          <span className="text-white/40">Appareil : </span>
                          {log.device}
                        </div>
                        <div className="truncate">
                          <span className="text-white/40">Système : </span>
                          {log.browser} / {log.os}
                        </div>
                        <div className="truncate">
                          <span className="text-white/40">Lieu : </span>
                          {log.location || 'Non disponible'}
                        </div>
                        <div className="truncate font-mono">
                          <span className="text-white/40 font-sans">Date : </span>
                          {formatDateTime(log.timestamp)}
                        </div>
                      </div>

                      {log.reason && <p className="text-[11px] text-white/55">{log.reason}</p>}

                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <button
                          type="button"
                          onClick={() => setHistoryTarget(log.accountEmail)}
                          className="min-h-[34px] px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-white/75 flex items-center gap-1 cursor-pointer"
                        >
                          <History className="w-3 h-3" />
                          <span>Historique</span>
                        </button>
                        {can('executeProtectionActions') && (
                          <>
                            <button
                              type="button"
                              onClick={() => requestBlockIp(log.ipAddress, `Blocage depuis journal (${log.accountEmail})`)}
                              className="min-h-[34px] px-2.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-[10px] font-bold text-rose-300 flex items-center gap-1 cursor-pointer"
                            >
                              <Ban className="w-3 h-3" />
                              <span>Bloquer IP</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                requestSuspendAccount({
                                  accountId: log.accountId,
                                  accountName: log.accountName,
                                  accountEmail: log.accountEmail,
                                  accountType: log.accountType
                                })
                              }
                              className="min-h-[34px] px-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-[10px] font-bold text-amber-300 flex items-center gap-1 cursor-pointer"
                            >
                              <UserX className="w-3 h-3" />
                              <span>Suspendre</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              3. DÉTECTION DES INTRUSIONS & SURVEILLANCE DES CYBERATTAQUES
             ================================================================= */}
          {section === 'threats' && (can('viewIntrusions') || can('viewCyberattacks')) && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {can('viewIntrusions') && (
                  <button
                    type="button"
                    onClick={() => setThreatSubView('intrusions')}
                    className={`min-h-[42px] rounded-xl border text-xs font-bold cursor-pointer ${
                      threatSubView === 'intrusions'
                        ? 'bg-rose-500/15 border-rose-400/50 text-rose-300'
                        : 'bg-white/5 border-white/10 text-white/60'
                    }`}
                  >
                    Intrusions ({intrusions.length})
                  </button>
                )}
                {can('viewCyberattacks') && (
                  <button
                    type="button"
                    onClick={() => setThreatSubView('cyberattacks')}
                    className={`min-h-[42px] rounded-xl border text-xs font-bold cursor-pointer ${
                      threatSubView === 'cyberattacks'
                        ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-300'
                        : 'bg-white/5 border-white/10 text-white/60'
                    }`}
                  >
                    Cyberattaques ({cyberAttacks.length})
                  </button>
                )}
              </div>

              {threatSubView === 'intrusions' && can('viewIntrusions') && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {[
                      { id: 'all', label: 'Toutes gravités' },
                      { id: 'critique', label: 'Critique' },
                      { id: 'eleve', label: 'Élevée' },
                      { id: 'modere', label: 'Modérée' }
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setThreatSeverityFilter(f.id)}
                        className={`min-h-[34px] px-3 rounded-xl border text-[11px] font-bold whitespace-nowrap cursor-pointer ${
                          threatSeverityFilter === f.id
                            ? 'bg-rose-500/20 border-rose-400/40 text-rose-300'
                            : 'bg-white/5 border-white/10 text-white/55'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {intrusions.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-[#141417] border border-white/10 text-center text-xs text-white/50">
                      Aucune tentative d’intrusion détectée. Les tentatives de mots de passe répétés, accès admin non autorisés, élévations de privilèges ou appareils inhabituels seront journalisés ici en temps réel.
                    </div>
                  ) : (
                    intrusions.map((item) => (
                      <div key={item.id} className="p-3 rounded-2xl bg-[#141417] border border-white/10 space-y-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-white leading-snug">{item.threatLabel}</p>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase shrink-0 ${
                              item.severity === 'critique'
                                ? 'bg-rose-500/20 text-rose-300'
                                : item.severity === 'eleve'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-cyan-500/20 text-cyan-300'
                            }`}
                          >
                            {item.severity} • {item.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/70">{item.details}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/50 font-mono">
                          <span>Cible : {item.targetAccountOrResource}</span>
                          <span>IP : {item.sourceIp}</span>
                          <span>{formatDateTime(item.timestamp)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={() => setHistoryTarget(item.sourceIp)}
                            className="min-h-[34px] px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-white/75 flex items-center gap-1 cursor-pointer"
                          >
                            <History className="w-3 h-3" />
                            <span>Historique IP</span>
                          </button>
                          {can('executeProtectionActions') && (
                            <button
                              type="button"
                              onClick={() => requestBlockIp(item.sourceIp, item.threatLabel)}
                              className="min-h-[34px] px-2.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-[10px] font-bold text-rose-300 flex items-center gap-1 cursor-pointer"
                            >
                              <Ban className="w-3 h-3" />
                              <span>Bloquer IP</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {threatSubView === 'cyberattacks' && can('viewCyberattacks') && (
                <div className="space-y-2.5">
                  <div className="p-3 rounded-2xl bg-[#141417] border border-white/10 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Couches d’inspection actives</span>
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          cloudflareConnected
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-white/10 text-white/60'
                        }`}
                      >
                        Cloudflare WAF : {cloudflareConnected ? 'Connecté' : 'Non connecté'}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/55 leading-relaxed">
                      L’inspection applicative Express (Force brute, SQLi, XSS, Bots/Scanners, Fichiers malveillants, Rate-Limit HTTP) est active en temps réel.{' '}
                      {!cloudflareConnected &&
                        'La protection Edge L3/L4 Cloudflare WAF n’est pas encore connectée (webhook prêt sur /api/security/waf/webhook).'}
                    </p>
                  </div>

                  <select
                    value={attackTypeFilter}
                    onChange={(e) => setAttackTypeFilter(e.target.value)}
                    className="w-full rounded-xl bg-[#141417] border border-white/10 px-3 py-2.5 text-xs font-semibold text-white"
                  >
                    <option value="all">Tous vecteurs d’attaque</option>
                    <option value="brute_force">Force brute</option>
                    <option value="ddos_http_flood">Flood HTTP / Rate Limit</option>
                    <option value="sql_injection">Injection SQL</option>
                    <option value="xss">Injection XSS</option>
                    <option value="bot_scanner">Activité bot / scanner</option>
                    <option value="malicious_upload">Fichier malveillant</option>
                    <option value="waf_event">Événement WAF externe</option>
                  </select>

                  {cyberAttacks.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-[#141417] border border-white/10 text-center text-xs text-white/50">
                      Aucune attaque interceptée pour le moment. Les requêtes suspectes bloquées par le middleware Express apparaîtront ici.
                    </div>
                  ) : (
                    cyberAttacks.map((atk) => (
                      <div key={atk.id} className="p-3 rounded-2xl bg-[#141417] border border-white/10 space-y-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-white">{atk.attackLabel}</p>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                              atk.blocked ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {atk.blocked ? 'Bloquée' : 'Signalée'}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/70">{atk.actionTaken}</p>
                        <div className="text-[10px] font-mono text-white/50 space-y-0.5">
                          <p className="truncate">Endpoint : {atk.targetEndpoint}</p>
                          <p>
                            IP : {atk.sourceIp} • {formatDateTime(atk.timestamp)}
                          </p>
                          <p>
                            Source : {atk.sourceLayer === 'cloudflare_waf_webhook' ? 'Cloudflare WAF' : 'Express App-WAF'}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              4. ALERTES DE SÉCURITÉ (3 Niveaux — Aucune suppression)
             ================================================================= */}
          {section === 'alerts' && can('manageAlerts') && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={alertSeverityFilter}
                  onChange={(e) => setAlertSeverityFilter(e.target.value)}
                  className="rounded-xl bg-[#141417] border border-white/10 px-2.5 py-2 text-xs font-semibold text-white"
                >
                  <option value="all">Toutes gravités</option>
                  <option value="critique">Critique</option>
                  <option value="eleve">Élevé</option>
                  <option value="modere">Modéré</option>
                </select>
                <select
                  value={alertStatusFilter}
                  onChange={(e) => setAlertStatusFilter(e.target.value)}
                  className="rounded-xl bg-[#141417] border border-white/10 px-2.5 py-2 text-xs font-semibold text-white"
                >
                  <option value="all">Tous statuts</option>
                  <option value="nouvelle">Nouvelle</option>
                  <option value="en_examen">En examen</option>
                  <option value="resolue">Résolue</option>
                </select>
              </div>

              {alerts.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#141417] border border-white/10 text-center text-xs text-white/50">
                  Aucune alerte de sécurité pour ces filtres. L’historique des alertes est conservé de manière permanente sans suppression possible.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {alerts.map((al) => (
                    <div
                      key={al.id}
                      className={`p-3 rounded-2xl bg-[#141417] border space-y-2 text-xs ${
                        al.severity === 'critique' && al.status !== 'resolue'
                          ? 'border-rose-500/40'
                          : 'border-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                al.severity === 'critique'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : al.severity === 'eleve'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-sky-500/20 text-sky-300'
                              }`}
                            >
                              {al.severity === 'critique'
                                ? 'Critique'
                                : al.severity === 'eleve'
                                ? 'Élevé'
                                : 'Modéré'}
                            </span>
                            <span className="text-[10px] text-white/50 font-semibold">
                              {al.status === 'nouvelle'
                                ? 'Nouvelle'
                                : al.status === 'en_examen'
                                ? 'En examen'
                                : 'Résolue'}
                            </span>
                          </div>
                          <h4 className="font-bold text-white mt-1">{al.title}</h4>
                        </div>
                        <span className="text-[10px] font-mono text-white/45 shrink-0">
                          {formatDateTime(al.timestamp)}
                        </span>
                      </div>

                      <p className="text-[11px] text-white/75 leading-relaxed">{al.description}</p>

                      <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] space-y-1">
                        <p className="text-white/60">
                          <span className="text-white/40">Cible :</span> {al.targetUserOrResource} •{' '}
                          <span className="font-mono">{al.sourceIp}</span>
                        </p>
                        <p className="text-emerald-300/90">
                          <span className="text-white/40">Action recommandée :</span> {al.recommendedAction}
                        </p>
                        {al.resolutionNote && (
                          <p className="text-cyan-300">
                            <span className="text-white/40">Note :</span> {al.resolutionNote} ({al.resolvedBy})
                          </p>
                        )}
                      </div>

                      {al.status !== 'resolue' && (
                        <div className="flex items-center gap-2 pt-0.5">
                          {al.status === 'nouvelle' && (
                            <button
                              type="button"
                              onClick={() => requestResolveAlert(al, 'en_examen')}
                              className="min-h-[38px] px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-[11px] font-bold text-amber-300 flex items-center gap-1.5 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Examiner</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => requestResolveAlert(al, 'resolue')}
                            className="min-h-[38px] px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-[11px] font-bold text-emerald-300 flex items-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Marquer résolue</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              5. SESSIONS ACTIVES & ACTIONS DE PROTECTION
             ================================================================= */}
          {section === 'sessions' && (can('manageSessions') || can('executeProtectionActions')) && (
            <div className="space-y-3">
              {/* Protection Center: Manual IP / Account Actions */}
              {can('executeProtectionActions') && (
                <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-3">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-rose-400" />
                    <span>Centre d’actions de protection immédiates</span>
                  </h4>

                  {/* Block an IP */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-white/60 block">
                      Bloquer une adresse IP sur le serveur
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={manualIpInput}
                        onChange={(e) => setManualIpInput(e.target.value)}
                        placeholder="Ex: 41.202.219.10"
                        className="flex-1 rounded-xl bg-black/50 border border-white/15 px-3 py-2 text-xs text-white font-mono placeholder-white/30"
                      />
                      <select
                        value={manualIpDuration}
                        onChange={(e) => setManualIpDuration(e.target.value)}
                        className="rounded-xl bg-black/50 border border-white/15 px-2 py-2 text-[11px] text-white"
                      >
                        <option value="15">15 min</option>
                        <option value="60">1 heure</option>
                        <option value="1440">24 heures</option>
                        <option value="0">Permanent</option>
                      </select>
                      <button
                        type="button"
                        disabled={!manualIpInput.trim()}
                        onClick={() => requestBlockIp(manualIpInput.trim(), 'Blocage manuel console Sécurité')}
                        className="min-h-[38px] px-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-xs font-bold text-white cursor-pointer"
                      >
                        Bloquer
                      </button>
                    </div>
                  </div>

                  {/* Account Protection Actions */}
                  {selectedAdminTargetUser && (
                    <div className="pt-2 border-t border-white/10 space-y-2">
                      <label className="text-[11px] font-semibold text-white/60 block">
                        Intervention sur un compte DJASSA
                      </label>
                      <select
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        className="w-full rounded-xl bg-black/50 border border-white/15 px-3 py-2 text-xs text-white font-semibold"
                      >
                        {adminUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.role}) — {u.email}
                          </option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            requestSuspendAccount({
                              accountId: selectedAdminTargetUser.id,
                              accountName: selectedAdminTargetUser.name,
                              accountEmail: selectedAdminTargetUser.email,
                              accountType: selectedAdminTargetUser.role
                            })
                          }
                          className="min-h-[38px] px-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-[11px] font-bold text-rose-300 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>Suspendre compte</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => requestRevokeAllUserSessions(selectedAdminTargetUser.email)}
                          className="min-h-[38px] px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-[11px] font-bold text-amber-300 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <ShieldOff className="w-3.5 h-3.5" />
                          <span>Révoquer sessions</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => requestRequireReauth(selectedAdminTargetUser.email)}
                          className="min-h-[38px] px-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-[11px] font-bold text-cyan-300 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Exiger ré-auth</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryTarget(selectedAdminTargetUser.email)}
                          className="min-h-[38px] px-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-white/80 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5" />
                          <span>Voir incidents</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Active Sessions List */}
              {can('manageSessions') && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-white/80 px-1 flex items-center justify-between">
                    <span>Sessions actives & récentes ({sessions.length})</span>
                  </h4>
                  {sessions.length === 0 ? (
                    <div className="p-5 rounded-2xl bg-[#141417] border border-white/10 text-center text-xs text-white/50">
                      Aucune session enregistrée pour le moment.
                    </div>
                  ) : (
                    sessions.map((ses) => (
                      <div key={ses.id} className="p-3 rounded-2xl bg-[#141417] border border-white/10 space-y-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate">{ses.userName}</p>
                            <p className="text-[10px] text-white/55 truncate">
                              {ses.userEmail} • <span className="capitalize">{ses.accountType}</span>
                            </p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                              ses.status === 'active'
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : ses.status === 'reauth_required'
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'bg-white/10 text-white/50'
                            }`}
                          >
                            {ses.status === 'active'
                              ? 'Active'
                              : ses.status === 'reauth_required'
                              ? 'Ré-auth exigée'
                              : 'Révoquée'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1 text-[10px] text-white/65 bg-white/[0.03] rounded-xl p-2">
                          <span className="truncate">{ses.device} • {ses.browser}/{ses.os}</span>
                          <span className="font-mono truncate">IP : {ses.ipAddress}</span>
                          <span>Connexion : {formatDateTime(ses.startedAt)}</span>
                          <span>Durée : {formatDuration(ses.durationSeconds)}</span>
                        </div>

                        {ses.status === 'active' && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => requestRevokeSession(ses)}
                              className="min-h-[36px] px-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-[10px] font-bold text-rose-300 cursor-pointer"
                            >
                              Déconnecter cet appareil
                            </button>
                            {can('executeProtectionActions') && (
                              <button
                                type="button"
                                onClick={() => requestRequireReauth(ses.userEmail)}
                                className="min-h-[36px] px-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-[10px] font-bold text-amber-300 cursor-pointer"
                              >
                                Exiger ré-auth
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Blocked IPs & Suspended Accounts Lists */}
              {(blockedIps.some((b) => b.active) || suspendedAccounts.some((s) => s.active)) && (
                <div className="space-y-2.5">
                  {blockedIps.filter((b) => b.active).length > 0 && (
                    <div className="p-3 rounded-2xl bg-[#141417] border border-white/10 space-y-2">
                      <p className="text-[11px] font-bold text-rose-300">
                        Adresses IP actuellement bloquées ({blockedIps.filter((b) => b.active).length})
                      </p>
                      {blockedIps
                        .filter((b) => b.active)
                        .map((b) => (
                          <div
                            key={b.id}
                            className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-mono font-bold text-white">{b.ipAddress}</p>
                              <p className="text-[10px] text-white/50 truncate">{b.reason}</p>
                            </div>
                            {can('executeProtectionActions') && (
                              <button
                                type="button"
                                onClick={() => requestUnblockIp(b.ipAddress)}
                                className="min-h-[36px] px-2.5 rounded-lg bg-emerald-500/15 text-emerald-300 text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                              >
                                <Unlock className="w-3 h-3" />
                                <span>Débloquer</span>
                              </button>
                            )}
                          </div>
                        ))}
                    </div>
                  )}

                  {suspendedAccounts.filter((s) => s.active).length > 0 && (
                    <div className="p-3 rounded-2xl bg-[#141417] border border-white/10 space-y-2">
                      <p className="text-[11px] font-bold text-amber-300">
                        Comptes temporairement suspendus ({suspendedAccounts.filter((s) => s.active).length})
                      </p>
                      {suspendedAccounts
                        .filter((s) => s.active)
                        .map((acc) => (
                          <div
                            key={acc.accountId + acc.suspendedAt}
                            className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-bold text-white truncate">{acc.accountName}</p>
                              <p className="text-[10px] text-white/50 truncate">
                                {acc.accountEmail} • {acc.reason}
                              </p>
                            </div>
                            {can('executeProtectionActions') && (
                              <button
                                type="button"
                                onClick={() => requestReactivateAccount(acc)}
                                className="min-h-[36px] px-2.5 rounded-lg bg-emerald-500/15 text-emerald-300 text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                              >
                                <UserCheck className="w-3 h-3" />
                                <span>Réactiver</span>
                              </button>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* =================================================================
              6. PARAMÈTRES, PERMISSIONS & AUDIT PROTÉGÉ
             ================================================================= */}
          {section === 'governance' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setGovernanceTab('settings')}
                  className={`min-h-[40px] rounded-xl border text-[11px] font-bold cursor-pointer ${
                    governanceTab === 'settings'
                      ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-300'
                      : 'bg-white/5 border-white/10 text-white/60'
                  }`}
                >
                  Paramètres
                </button>
                <button
                  type="button"
                  onClick={() => setGovernanceTab('permissions')}
                  className={`min-h-[40px] rounded-xl border text-[11px] font-bold cursor-pointer ${
                    governanceTab === 'permissions'
                      ? 'bg-purple-500/15 border-purple-400/50 text-purple-300'
                      : 'bg-white/5 border-white/10 text-white/60'
                  }`}
                >
                  Permissions
                </button>
                <button
                  type="button"
                  onClick={() => setGovernanceTab('audit')}
                  className={`min-h-[40px] rounded-xl border text-[11px] font-bold cursor-pointer ${
                    governanceTab === 'audit'
                      ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                      : 'bg-white/5 border-white/10 text-white/60'
                  }`}
                >
                  Journaux ({auditLogs.length})
                </button>
              </div>

              {/* 6A. PARAMÈTRES DE SÉCURITÉ */}
              {governanceTab === 'settings' && settingsDraft && (
                <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-white flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Règles appliquées par le serveur</span>
                    </h4>
                    {!can('modifySettings') && (
                      <span className="text-[10px] text-amber-300 font-semibold">Lecture seule</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] text-white/55 block mb-1">Max tentatives connexion</label>
                      <input
                        type="number"
                        min={2}
                        max={20}
                        disabled={!can('modifySettings')}
                        value={settingsDraft.maxLoginAttempts}
                        onChange={(e) =>
                          setSettingsDraft({ ...settingsDraft, maxLoginAttempts: Number(e.target.value) || 5 })
                        }
                        className="w-full rounded-xl bg-black/50 border border-white/15 px-2.5 py-2 text-xs text-white font-mono disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/55 block mb-1">Blocage temporaire (min)</label>
                      <input
                        type="number"
                        min={1}
                        max={1440}
                        disabled={!can('modifySettings')}
                        value={settingsDraft.tempBlockMinutes}
                        onChange={(e) =>
                          setSettingsDraft({ ...settingsDraft, tempBlockMinutes: Number(e.target.value) || 15 })
                        }
                        className="w-full rounded-xl bg-black/50 border border-white/15 px-2.5 py-2 text-xs text-white font-mono disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/55 block mb-1">Limite requêtes / min</label>
                      <input
                        type="number"
                        min={10}
                        max={5000}
                        disabled={!can('modifySettings')}
                        value={settingsDraft.rateLimitPerMinute}
                        onChange={(e) =>
                          setSettingsDraft({ ...settingsDraft, rateLimitPerMinute: Number(e.target.value) || 120 })
                        }
                        className="w-full rounded-xl bg-black/50 border border-white/15 px-2.5 py-2 text-xs text-white font-mono disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/55 block mb-1">Conservation journaux (j)</label>
                      <input
                        type="number"
                        min={30}
                        max={3650}
                        disabled={!can('modifySettings')}
                        value={settingsDraft.logRetentionDays}
                        onChange={(e) =>
                          setSettingsDraft({ ...settingsDraft, logRetentionDays: Number(e.target.value) || 180 })
                        }
                        className="w-full rounded-xl bg-black/50 border border-white/15 px-2.5 py-2 text-xs text-white font-mono disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {(
                      [
                        ['requireTwoFactorAdmins', 'Exiger double authentification (2FA) admins'],
                        ['requireTwoFactorSensitiveActions', 'Exiger 2FA pour actions sensibles'],
                        ['alertsEnabled', 'Activer les alertes de sécurité'],
                        ['notifySuperAdminOnCritical', 'Notifier le Super Admin sur alerte critique'],
                        ['detectSqlInjection', 'Détecter et bloquer les injections SQL'],
                        ['detectXss', 'Détecter et bloquer les scripts XSS'],
                        ['detectBotScanners', 'Bloquer les bots & scanners (sqlmap, nikto...)'],
                        ['detectUnusualDevices', 'Signaler connexions depuis appareils inhabituels'],
                        ['detectMaliciousUploads', 'Filtrer les envois de fichiers exécutables'],
                        ['cloudflareWafConnected', 'Connecteur Webhook Cloudflare WAF actif']
                      ] as Array<[keyof SecuritySettings, string]>
                    ).map(([key, label]) => {
                      const active = Boolean(settingsDraft[key]);
                      return (
                        <div
                          key={key}
                          className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-2"
                        >
                          <span className="text-[11px] font-medium text-white/85">{label}</span>
                          <button
                            type="button"
                            disabled={!can('modifySettings')}
                            onClick={() =>
                              setSettingsDraft({ ...settingsDraft, [key]: !active })
                            }
                            className={`w-11 h-6 rounded-full p-1 transition shrink-0 cursor-pointer disabled:opacity-45 ${
                              active ? 'bg-emerald-500' : 'bg-white/20'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                active ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {can('modifySettings') && (
                    <button
                      type="button"
                      onClick={requestSaveSettings}
                      className="w-full min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black cursor-pointer"
                    >
                      Enregistrer et appliquer sur le serveur
                    </button>
                  )}
                </div>
              )}

              {/* 6B. PERMISSIONS & RÔLES */}
              {governanceTab === 'permissions' && (
                <div className="space-y-2.5">
                  {!can('managePermissions') ? (
                    <div className="p-5 rounded-2xl bg-[#141417] border border-white/10 text-center space-y-1.5">
                      <Lock className="w-6 h-6 text-amber-400 mx-auto" />
                      <p className="text-xs font-bold text-white">Réservé au Super Administrateur</p>
                      <p className="text-[11px] text-white/55">
                        Seul le Super Administrateur (ou un profil avec la permission « Gestion permissions ») peut consulter et modifier la matrice RBAC.
                      </p>
                    </div>
                  ) : (
                    permissionsStaff.map((member) => (
                      <div key={member.id} className="p-3 rounded-2xl bg-[#141417] border border-white/10 space-y-2.5 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-white truncate">{member.name}</p>
                            <p className="text-[10px] text-white/50 truncate">{member.email} • {member.title}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 ${ROLE_BADGE_MAP[member.role].cls}`}>
                            {ROLE_BADGE_MAP[member.role].label}
                          </span>
                        </div>

                        {member.role === 'super_admin' ? (
                          <p className="text-[11px] text-purple-300/90 bg-purple-500/10 rounded-xl p-2">
                            Accès complet non révocable (Super Administrateur).
                          </p>
                        ) : member.role === 'other_agent' ? (
                          <p className="text-[11px] text-rose-300/85 bg-rose-500/10 rounded-xl p-2">
                            Accès refusé côté serveur : ce rôle d’agent n’a aucune permission de sécurité.
                          </p>
                        ) : (
                          <div className="grid grid-cols-2 gap-1.5">
                            {(Object.keys(PERMISSION_LABELS) as SecurityPermissionKey[]).map((permKey) => {
                              const enabled = Boolean(member.permissions[permKey]);
                              return (
                                <button
                                  key={permKey}
                                  type="button"
                                  onClick={() => handleToggleStaffPermission(member, permKey, !enabled)}
                                  className={`min-h-[36px] px-2.5 py-1.5 rounded-xl border text-[10px] font-bold text-left flex items-center justify-between gap-1 cursor-pointer ${
                                    enabled
                                      ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                                      : 'bg-white/[0.03] border-white/10 text-white/50'
                                  }`}
                                >
                                  <span className="truncate">{PERMISSION_LABELS[permKey]}</span>
                                  <span>{enabled ? 'Oui' : 'Non'}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* 6C. JOURNAL D'AUDIT PROTÉGÉ (Inaltérable & Sans suppression) */}
              {governanceTab === 'audit' && (
                <div className="space-y-2.5">
                  <div className="p-3 rounded-2xl bg-[#141417] border border-white/10 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCheck2
                        className={`w-4 h-4 shrink-0 ${
                          auditIntegrity?.valid ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-white">Protection cryptographique des journaux</p>
                        <p className="text-[10px] text-white/50 truncate">
                          Stockage serveur ajout-seul • Aucune modification ni suppression • Secrets masqués
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                        auditIntegrity?.valid
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {auditIntegrity?.valid ? 'Intègre SHA-256' : 'Altération'}
                    </span>
                  </div>

                  {auditLogs.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-[#141417] border border-white/10 text-center text-xs text-white/50">
                      Aucune écriture dans le journal protégé pour le moment. Toute action de protection, examen d’alerte ou modification de règle sera scellée ici.
                    </div>
                  ) : (
                    auditLogs.map((entry) => (
                      <div key={entry.id} className="p-3 rounded-2xl bg-[#141417] border border-white/10 space-y-1.5 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-white">
                            #{entry.seq} • {entry.action}
                          </p>
                          <span className="text-[10px] font-mono text-white/45 shrink-0">
                            {formatDateTime(entry.timestamp)}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/75">
                          Cible : <span className="font-semibold text-white">{entry.target}</span>
                        </p>
                        {(entry.beforeValue || entry.afterValue) && (
                          <div className="p-2 rounded-xl bg-black/40 border border-white/5 text-[10px] font-mono space-y-0.5 text-white/65">
                            {entry.beforeValue && <p className="truncate">Avant : {entry.beforeValue}</p>}
                            {entry.afterValue && <p className="truncate text-emerald-300">Après : {entry.afterValue}</p>}
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 text-[10px] text-white/50 pt-0.5">
                          <span>Par {entry.actorName} ({ROLE_BADGE_MAP[entry.actorRole]?.label})</span>
                          <span className="font-mono truncate max-w-[140px]">Hash: {entry.entryHash.slice(0, 14)}…</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* CONFIRMATION & TARGET HISTORY MODALS */}
      <SecurityConfirmModal pending={pendingConfirm} onClose={() => setPendingConfirm(null)} />
      <SecurityTargetHistoryModal
        target={historyTarget}
        actorId={actorId}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
};
