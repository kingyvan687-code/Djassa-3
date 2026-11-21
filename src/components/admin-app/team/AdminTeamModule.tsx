import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Ban,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  Eye,
  FileCheck,
  Filter,
  Key,
  Laptop,
  Lock,
  LogIn,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Unlock,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  Wallet,
  X
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { securityService } from '../../../services/securityService';
import { teamService, type TeamApiError } from '../../../services/teamService';
import type {
  AdminTeamRoleKey,
  TeamAccountStatus,
  TeamAdminMemberPublic,
  TeamMemberDetailResponse,
  TeamModuleKey,
  TeamOverviewResponse,
  TeamPermissionLevel,
  TeamPermissionsMatrix
} from '../../../types/team';
import { formatFCFA } from '../../../services/marketServices';

type TeamSubView = 'dashboard' | 'membres' | 'roles' | 'finances' | 'journal' | 'notifications';

const STATUS_BADGE: Record<TeamAccountStatus, { label: string; cls: string }> = {
  active: { label: 'Actif', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  invited: { label: 'Invité', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  suspended: { label: 'Suspendu', cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  deactivated: { label: 'Désactivé', cls: 'bg-white/10 text-white/50 border-white/15' }
};

const LEVEL_BADGE: Record<TeamPermissionLevel, { label: string; cls: string }> = {
  none: { label: 'Aucun accès', cls: 'bg-white/5 text-white/35 border-white/10' },
  read: { label: 'Consultation', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  write: { label: 'Modification', cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  approve: { label: 'Validation', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  admin: { label: 'Administration', cls: 'bg-purple-500/20 text-purple-300 border-purple-500/40' }
};

const ROLE_COLORS: Record<AdminTeamRoleKey, string> = {
  super_admin: 'bg-purple-500/20 text-purple-300 border-purple-500/35',
  general_admin: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  finance_admin: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  orders_admin: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  disputes_admin: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  users_admin: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  security_admin: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  tech_admin: 'bg-teal-500/15 text-teal-300 border-teal-500/30'
};

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export const AdminTeamModule: React.FC = () => {
  const { showToast } = useApp();

  const [subView, setSubView] = useState<TeamSubView>('dashboard');
  const [overview, setOverview] = useState<TeamOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Detail modal
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<TeamMemberDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'info' | 'security' | 'permissions' | 'activity'>('info');

  // Edit detail draft
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editRole, setEditRole] = useState<AdminTeamRoleKey>('general_admin');
  const [editMatrix, setEditMatrix] = useState<TeamPermissionsMatrix | null>(null);
  const [savingDetail, setSavingDetail] = useState(false);

  // Create Admin Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFullName, setCreateFullName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createProId, setCreateProId] = useState('');
  const [createDepartment, setCreateDepartment] = useState('');
  const [createRole, setCreateRole] = useState<AdminTeamRoleKey>('finance_admin');
  const [createMfaEnabled, setCreateMfaEnabled] = useState(true);
  const [createCustomizePerms, setCreateCustomizePerms] = useState(false);
  const [createMatrix, setCreateMatrix] = useState<Partial<TeamPermissionsMatrix>>({});
  const [createdInviteResult, setCreatedInviteResult] = useState<{
    token: string;
    activationPath: string;
    email: string;
    fullName: string;
  } | null>(null);

  // Auth / Invitation Acceptance Modal (allows inviting & logging in cleanly without breaking existing auth)
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'accept' | 'login'>('accept');
  const [inviteTokenInput, setInviteTokenInput] = useState('');
  const [invitePasswordInput, setInvitePasswordInput] = useState('');
  const [loginEmailInput, setLoginEmailInput] = useState('');
  const [loginPasswordInput, setLoginPasswordInput] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  // Confirmation + Action Reason Modal (Suspend / Deactivate)
  const [confirmAction, setConfirmAction] = useState<{
    type: 'suspend' | 'deactivate' | 'revoke';
    admin: TeamAdminMemberPublic;
  } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [suspendDays, setSuspendDays] = useState(7);

  // MFA Step-Up Dialog
  const [mfaPrompt, setMfaPrompt] = useState<{
    title: string;
    previewCode: string;
    code: string;
    onConfirm: (code: string) => Promise<void>;
  } | null>(null);
  const [mfaBusy, setMfaBusy] = useState(false);

  // Financial validation form & settings
  const [finOpType, setFinOpType] = useState<'remboursement' | 'indemnisation' | 'retrait_vendeur' | 'ajustement_financier'>('remboursement');
  const [finTitle, setFinTitle] = useState('');
  const [finAmount, setFinAmount] = useState('45000');
  const [finNote, setFinNote] = useState('');
  const [thresholdDraft, setThresholdDraft] = useState('25000');

  // Permission tester
  const [testModule, setTestModule] = useState<TeamModuleKey>('finances');
  const [testLevel, setTestLevel] = useState<TeamPermissionLevel>('approve');
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const loadOverview = async () => {
    try {
      setErrorMsg(null);
      const res = await teamService.getOverview();
      setOverview(res);
      setThresholdDraft(String(res.settings.standardFinancialApprovalLimitFcfa));
    } catch (err: any) {
      setErrorMsg(err?.message || 'Impossible de charger le module Équipe.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  const loadMemberDetail = async (adminId: string) => {
    setSelectedAdminId(adminId);
    setDetailLoading(true);
    try {
      const res = await teamService.getMemberDetail(adminId);
      setDetailData(res);
      setEditFullName(res.admin.fullName);
      setEditPhone(res.admin.phone);
      setEditDepartment(res.admin.department);
      setEditRole(res.admin.role);
      setEditMatrix({ ...res.admin.permissions });
    } catch (err: any) {
      showToast(err?.message || 'Erreur chargement fiche administrateur');
    } finally {
      setDetailLoading(false);
    }
  };

  const runWithMfa = async (title: string, fn: (stepUpCode?: string) => Promise<void>) => {
    try {
      await fn(undefined);
    } catch (err: any) {
      const apiErr = err as TeamApiError;
      if (apiErr.requiresMfa) {
        try {
          const ch = await securityService.requestMfaChallenge();
          setMfaPrompt({
            title,
            previewCode: ch.verificationCodePreview,
            code: ch.verificationCodePreview,
            onConfirm: async (code: string) => {
              await fn(code);
            }
          });
        } catch (chErr: any) {
          showToast(chErr?.message || 'Erreur initialisation MFA');
        }
        return;
      }
      showToast(err?.message || 'Opération refusée');
    }
  };

  const isCurrentSuperAdmin = overview?.currentActor.teamRole === 'super_admin';

  const filteredAdmins = useMemo(() => {
    if (!overview) return [];
    const q = searchQuery.trim().toLowerCase();
    return overview.admins
      .filter((a) => {
        if (filterRole !== 'all' && a.role !== filterRole) return false;
        if (filterStatus !== 'all' && a.status !== filterStatus) return false;
        if (q) {
          const hay = `${a.fullName} ${a.professionalId} ${a.email} ${a.department}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return sortOrder === 'newest' ? -diff : diff;
      });
  }, [overview, searchQuery, filterRole, filterStatus, sortOrder]);

  const handleSelectCreateRole = (rKey: AdminTeamRoleKey) => {
    if (rKey === 'super_admin') return;
    setCreateRole(rKey);
    const def = overview?.roles.find((r) => r.key === rKey);
    if (def) {
      setCreateDepartment(def.department);
      setCreateMatrix({ ...def.defaultMatrix });
    }
  };

  const handleCreateAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runWithMfa('Validation MFA : Création d’un administrateur', async (stepUpCode) => {
      const res = await teamService.createAdminMember(
        {
          fullName: createFullName,
          email: createEmail,
          phone: createPhone,
          professionalId: createProId || undefined,
          role: createRole,
          department: createDepartment || undefined,
          mfaEnabled: createMfaEnabled,
          permissions: createCustomizePerms ? createMatrix : undefined
        },
        stepUpCode
      );
      setCreatedInviteResult({
        token: res.invitationToken,
        activationPath: res.activationPath,
        email: res.admin.email,
        fullName: res.admin.fullName
      });
      setCreateFullName('');
      setCreateEmail('');
      setCreatePhone('');
      setCreateProId('');
      showToast(res.message);
      await loadOverview();
    });
  };

  const handleSaveDetailChanges = async () => {
    if (!detailData) return;
    setSavingDetail(true);
    await runWithMfa(`Validation MFA : Modification ${detailData.admin.fullName}`, async (stepUpCode) => {
      const res = await teamService.updateAdminMember(
        detailData.admin.id,
        {
          fullName: editFullName,
          phone: editPhone,
          department: editDepartment,
          role: editRole !== detailData.admin.role ? editRole : undefined,
          permissions: editMatrix || undefined
        },
        stepUpCode
      );
      showToast(res.message);
      await loadOverview();
      await loadMemberDetail(detailData.admin.id);
    });
    setSavingDetail(false);
  };

  const handleExecuteConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, admin } = confirmAction;
    const label =
      type === 'suspend'
        ? `Suspendre ${admin.fullName}`
        : type === 'deactivate'
        ? `Désactiver définitivement ${admin.fullName}`
        : `Révoquer les sessions de ${admin.fullName}`;

    await runWithMfa(`Validation MFA : ${label}`, async (stepUpCode) => {
      if (type === 'suspend') {
        const res = await teamService.suspendAdminMember(
          admin.id,
          { reason: actionReason || 'Suspension administrative temporaire', durationDays: suspendDays },
          stepUpCode
        );
        showToast(res.message);
      } else if (type === 'deactivate') {
        const res = await teamService.deactivateAdminMember(
          admin.id,
          actionReason || 'Désactivation définitive (traces conservées)',
          stepUpCode
        );
        showToast(res.message);
      } else {
        const res = await teamService.revokeAdminSessions(
          admin.id,
          actionReason || 'Révocation administrative immédiate',
          stepUpCode
        );
        showToast(res.message);
      }
      setConfirmAction(null);
      setActionReason('');
      await loadOverview();
      if (selectedAdminId === admin.id) {
        await loadMemberDetail(admin.id);
      }
    });
  };

  const handleReactivateAdmin = async (admin: TeamAdminMemberPublic) => {
    await runWithMfa(`Validation MFA : Réactivation ${admin.fullName}`, async (stepUpCode) => {
      const res = await teamService.reactivateAdminMember(admin.id, stepUpCode);
      showToast(res.message);
      await loadOverview();
      if (selectedAdminId === admin.id) await loadMemberDetail(admin.id);
    });
  };

  const handleResendInvitation = async (admin: TeamAdminMemberPublic) => {
    try {
      const res = await teamService.resendInvitation(admin.id);
      setCreatedInviteResult({
        token: res.invitationToken,
        activationPath: res.activationPath,
        email: admin.email,
        fullName: admin.fullName
      });
      setShowCreateModal(true);
      showToast(res.message);
      await loadOverview();
    } catch (err: any) {
      showToast(err?.message || 'Erreur lors du renvoi');
    }
  };

  const handleAcceptInvitationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    try {
      const res = await teamService.acceptInvitation({
        token: inviteTokenInput,
        password: invitePasswordInput
      });
      showToast(res.message);
      setInvitePasswordInput('');
      setLoginEmailInput(res.admin.email);
      setAuthModalTab('login');
      await loadOverview();
    } catch (err: any) {
      showToast(err?.message || 'Impossible de valider l’invitation');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleIndependentLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    try {
      const res = await teamService.loginAdminMember(
        { email: loginEmailInput, password: loginPasswordInput },
        true
      );
      showToast(`Connecté en tant que ${res.admin.fullName} (${res.admin.roleLabel})`);
      setShowAuthModal(false);
      setLoginPasswordInput('');
      await loadOverview();
    } catch (err: any) {
      showToast(err?.message || 'Connexion refusée');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRestoreSuperAdminSession = async () => {
    setLoginEmailInput('admin@djassa.ci');
    setLoginPasswordInput('');
    setShowAuthModal(true);
    showToast('Saisissez votre mot de passe Super Administrateur pour valider la session');
  };

  const handleCheckPermissionTest = async () => {
    try {
      const res = await teamService.checkPermission(testModule, testLevel);
      setTestResult({
        ok: true,
        msg: `AUTORISÉ — Niveau actuel "${res.currentLevel}" ≥ "${res.requiredLevel}" sur ${res.moduleKey}.`
      });
    } catch (err: any) {
      setTestResult({
        ok: false,
        msg: `BLOQUÉ (HTTP ${err?.status || 403}) — ${err?.message || 'Permission insuffisante'}`
      });
      await loadOverview();
    }
  };

  const handleSubmitFinancialValidation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await teamService.createFinancialValidation({
        operationType: finOpType,
        title: finTitle || `Validation ${finOpType}`,
        amountFcfa: Number(finAmount) || 0,
        note: finNote
      });
      setFinTitle('');
      setFinNote('');
      showToast('Opération financière soumise au circuit de validation.');
      await loadOverview();
    } catch (err: any) {
      showToast(err?.message || 'Création refusée');
    }
  };

  const handleApproveFinVal = async (id: string, title: string) => {
    await runWithMfa(`Validation MFA : ${title}`, async (stepUpCode) => {
      const res = await teamService.approveFinancialValidation(id, 'Validation financière confirmée', stepUpCode);
      showToast(res.message);
      await loadOverview();
    });
  };

  const handleSaveSettingsThreshold = async () => {
    await runWithMfa('Validation MFA : Mise à jour seuil financier Équipe', async (stepUpCode) => {
      await teamService.updateSettings(
        { standardFinancialApprovalLimitFcfa: Number(thresholdDraft) || 25000 },
        stepUpCode
      );
      showToast('Seuil de validation financière mis à jour');
      await loadOverview();
    });
  };

  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-[#141414] border border-white/10 text-center space-y-2">
        <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin mx-auto" />
        <p className="text-xs text-white/60 font-bold">Chargement du module Équipe Administrateur...</p>
      </div>
    );
  }

  if (errorMsg || !overview) {
    return (
      <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 space-y-2">
        <p className="font-black">Erreur chargement Équipe</p>
        <p>{errorMsg}</p>
        <button
          onClick={() => void loadOverview()}
          className="px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 font-bold hover:bg-rose-500/30"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div id="admin-team-module" className="space-y-4 text-white">
      {/* Header Banner: Admin-only policy + current actor context */}
      <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-white">Équipe DJASSA Administrateur</h3>
              <span className="px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-[10px] font-black text-purple-300">
                Administrateurs internes uniquement
              </span>
            </div>
            <p className="text-[11px] text-white/55 mt-0.5">
              Connecté : <strong className="text-white">{overview.currentActor.name}</strong> (
              <span className="text-cyan-300">{overview.currentActor.teamRole}</span>)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isCurrentSuperAdmin && (
            <button
              onClick={handleRestoreSuperAdminSession}
              className="px-3 py-1.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-[11px] font-bold text-purple-200 hover:bg-purple-500/30 flex items-center gap-1.5 cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Revenir Super Admin</span>
            </button>
          )}
          <button
            id="btn-team-auth-portal"
            onClick={() => setShowAuthModal(true)}
            className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[11px] font-bold text-white/80 hover:bg-white/10 flex items-center gap-1.5 cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5 text-emerald-400" />
            <span>Activer invitation / Connexion</span>
          </button>
          {isCurrentSuperAdmin && (
            <button
              id="btn-team-add-admin"
              onClick={() => {
                setCreatedInviteResult(null);
                handleSelectCreateRole('finance_admin');
                setShowCreateModal(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-[11px] font-black flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Ajouter un administrateur</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Tabs Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'dashboard', label: 'Tableau de bord', icon: Activity },
          { id: 'membres', label: `Administrateurs (${overview.admins.length})`, icon: Users },
          { id: 'roles', label: '8 Rôles & Permissions', icon: ShieldCheck },
          {
            id: 'finances',
            label: 'Validations financières',
            icon: Wallet,
            badge: overview.kpis.pendingFinancialValidations
          },
          { id: 'journal', label: 'Journal équipe', icon: Clock },
          {
            id: 'notifications',
            label: 'Notifications',
            icon: Bell,
            badge: overview.kpis.unreadTeamNotifications
          }
        ].map((tab) => {
          const Icon = tab.icon;
          const active = subView === tab.id;
          return (
            <button
              key={tab.id}
              id={`team-subtab-${tab.id}`}
              onClick={() => setSubView(tab.id as TeamSubView)}
              className={`shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                active
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-[#141414] border-white/10 text-white/60 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-rose-500 text-white text-[9px] font-black">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          1. TABLEAU DE BORD ÉQUIPE
         ========================================================================= */}
      {subView === 'dashboard' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {[
              { label: 'Total admins', value: overview.kpis.totalAdmins, tone: 'text-white' },
              { label: 'Super Admins', value: overview.kpis.superAdminsCount, tone: 'text-purple-400' },
              { label: 'Admins actifs', value: overview.kpis.activeAdmins, tone: 'text-emerald-400' },
              { label: 'Suspendus', value: overview.kpis.suspendedAdmins, tone: 'text-rose-400' },
              { label: 'Invitations en attente', value: overview.kpis.pendingInvitations, tone: 'text-amber-300' },
              { label: 'Connectés maintenant', value: overview.kpis.currentlyConnectedAdmins, tone: 'text-cyan-400' }
            ].map((kpi) => (
              <div key={kpi.label} className="p-3 rounded-2xl bg-[#141414] border border-white/10">
                <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">{kpi.label}</p>
                <p className={`text-lg font-black mt-1 font-mono tabular-nums ${kpi.tone}`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {/* Dernières connexions */}
            <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                  <Laptop className="w-4 h-4 text-emerald-400" />
                  <span>Dernières connexions administrateurs</span>
                </h4>
                <span className="text-[10px] text-white/40">{overview.activeSessions.length} session(s) active(s)</span>
              </div>
              {overview.latestLogins.length === 0 ? (
                <p className="text-[11px] text-white/45 py-4 text-center">Aucune connexion enregistrée récemment.</p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {overview.latestLogins.slice(0, 6).map((lgn) => (
                    <div
                      key={lgn.id}
                      className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-white truncate">{lgn.accountName}</p>
                        <p className="text-[10px] text-white/50 truncate">
                          {lgn.device} • {lgn.browser} • {lgn.ipAddress}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[9px] font-black border ${
                            lgn.status === 'reussite'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : lgn.status === 'suspect'
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {lgn.status}
                        </span>
                        <p className="text-[9px] text-white/40 mt-0.5">{fmtDate(lgn.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Activités récentes */}
            <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Activités récentes de l’équipe</span>
                </h4>
                <button
                  onClick={() => setSubView('journal')}
                  className="text-[10px] text-cyan-400 font-bold hover:underline cursor-pointer"
                >
                  Tout voir →
                </button>
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {overview.recentActivities.slice(0, 6).map((act) => (
                  <div
                    key={act.id}
                    className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-white truncate">{act.action}</p>
                      <p className="text-[10px] text-white/50 truncate">
                        {act.actorName} ({act.actorProfessionalId}) • {act.module}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[9px] font-black border ${
                          act.result === 'reussi'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {act.result}
                      </span>
                      <p className="text-[9px] text-white/40 mt-0.5">{fmtDate(act.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          2. LISTE DES ADMINISTRATEURS (ADMIN-ONLY)
         ========================================================================= */}
      {subView === 'membres' && (
        <div className="space-y-3">
          {/* Search & filters */}
          <div className="p-3 rounded-2xl bg-[#141414] border border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher nom, ID pro, email..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder-white/35 focus:border-cyan-400 outline-none"
              />
            </div>

            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:border-cyan-400 outline-none"
            >
              <option value="all">Tous les 8 rôles admin</option>
              {overview.roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:border-cyan-400 outline-none"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actifs</option>
              <option value="invited">Invités (en attente)</option>
              <option value="suspended">Suspendus</option>
              <option value="deactivated">Désactivés</option>
            </select>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
              className="px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:border-cyan-400 outline-none"
            >
              <option value="newest">Tri : Plus récents d’abord</option>
              <option value="oldest">Tri : Plus anciens d’abord</option>
            </select>
          </div>

          {/* Admins List */}
          <div className="space-y-2">
            {filteredAdmins.map((admin) => {
              const st = STATUS_BADGE[admin.status];
              return (
                <div
                  key={admin.id}
                  onClick={() => void loadMemberDetail(admin.id)}
                  className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 hover:border-cyan-500/40 transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500/30 to-cyan-500/20 border border-white/15 overflow-hidden flex items-center justify-center shrink-0">
                      {admin.avatarUrl ? (
                        <img src={admin.avatarUrl} alt={admin.fullName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-black text-white">
                          {admin.fullName
                            .split(' ')
                            .map((w) => w[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-black text-white">{admin.fullName}</p>
                        <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                          {admin.professionalId}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${ROLE_COLORS[admin.role]}`}>
                          {admin.roleLabel}
                        </span>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${st.cls}`}>
                          {st.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/55 mt-1 truncate">
                        {admin.email} • {admin.phone} • {admin.department}
                      </p>
                      <p className="text-[10px] text-white/40 mt-0.5">
                        Créé : {fmtDate(admin.createdAt)} • Dernière connexion : {fmtDate(admin.lastLoginAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {admin.isCurrentlyConnected && (
                      <span className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-300">
                        En ligne ({admin.activeSessionsCount})
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void loadMemberDetail(admin.id);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-white flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Fiche</span>
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredAdmins.length === 0 && (
              <div className="p-6 rounded-2xl bg-[#141414] border border-white/10 text-center text-xs text-white/50">
                Aucun administrateur ne correspond à votre recherche.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          3. LES 8 RÔLES & CONTRÔLE RBAC SERVEUR
         ========================================================================= */}
      {subView === 'roles' && (
        <div className="space-y-4">
          {/* Interactive Server RBAC Checker */}
          <div className="p-4 rounded-2xl bg-[#141414] border border-cyan-500/30 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span>Vérification réelle des permissions côté serveur (20 modules × 5 niveaux)</span>
                </h4>
                <p className="text-[11px] text-white/55">
                  Teste la session active (<strong className="text-white">{overview.currentActor.name}</strong>) contre les règles backend non contournables.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={testModule}
                onChange={(e) => setTestModule(e.target.value as TeamModuleKey)}
                className="px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-white"
              >
                {overview.modulesMeta.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label} ({m.key})
                  </option>
                ))}
              </select>
              <select
                value={testLevel}
                onChange={(e) => setTestLevel(e.target.value as TeamPermissionLevel)}
                className="px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-xs text-white"
              >
                {overview.permissionLevelsMeta.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.label} ({l.key})
                  </option>
                ))}
              </select>
              <button
                onClick={() => void handleCheckPermissionTest()}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black cursor-pointer"
              >
                Vérifier l’accès serveur
              </button>
            </div>

            {testResult && (
              <div
                className={`p-2.5 rounded-xl border text-xs font-bold ${
                  testResult.ok
                    ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                    : 'bg-rose-500/15 border-rose-500/35 text-rose-300'
                }`}
              >
                {testResult.msg}
              </div>
            )}
          </div>

          {/* 8 Roles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {overview.roles.map((r) => (
              <div key={r.key} className="p-4 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${ROLE_COLORS[r.key]}`}>
                        {r.label}
                      </span>
                      {r.reservedToOwner && (
                        <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 border border-purple-500/40 text-[10px] font-black text-purple-200 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Réservé au propriétaire
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/50 mt-1">{r.department}</p>
                  </div>
                </div>
                <p className="text-[11px] text-white/75 leading-relaxed">{r.description}</p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {overview.modulesMeta
                    .filter((m) => r.defaultMatrix[m.key] !== 'none')
                    .slice(0, 8)
                    .map((m) => (
                      <span
                        key={m.key}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                          LEVEL_BADGE[r.defaultMatrix[m.key]].cls
                        }`}
                      >
                        {m.label}: {LEVEL_BADGE[r.defaultMatrix[m.key]].label}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          4. COORDINATION DES VALIDATIONS FINANCIÈRES SENSIBLES
         ========================================================================= */}
      {subView === 'finances' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {/* Threshold config */}
            <div className="p-4 rounded-2xl bg-[#141414] border border-white/10 space-y-3">
              <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-purple-400" />
                <span>Seuils de validation financière hiérarchique</span>
              </h4>
              <p className="text-[11px] text-white/60">
                Tout remboursement, indemnisation ou retrait supérieur à ce seuil exige obligatoirement la validation finale du <strong className="text-purple-300">Super Administrateur</strong> avec MFA.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={thresholdDraft}
                  onChange={(e) => setThresholdDraft(e.target.value)}
                  disabled={!isCurrentSuperAdmin}
                  className="flex-1 px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white font-mono"
                />
                {isCurrentSuperAdmin && (
                  <button
                    onClick={() => void handleSaveSettingsThreshold()}
                    className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black cursor-pointer"
                  >
                    Mettre à jour
                  </button>
                )}
              </div>
            </div>

            {/* Submit Financial Validation */}
            <form
              onSubmit={handleSubmitFinancialValidation}
              className="p-4 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5"
            >
              <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <span>Préparer une opération financière sensible</span>
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={finOpType}
                  onChange={(e) => setFinOpType(e.target.value as any)}
                  className="px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white"
                >
                  <option value="remboursement">Remboursement</option>
                  <option value="indemnisation">Indemnisation</option>
                  <option value="retrait_vendeur">Retrait vendeur</option>
                  <option value="ajustement_financier">Ajustement financier</option>
                </select>
                <input
                  type="number"
                  value={finAmount}
                  onChange={(e) => setFinAmount(e.target.value)}
                  placeholder="Montant FCFA"
                  className="px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white font-mono"
                  required
                />
              </div>
              <input
                type="text"
                value={finTitle}
                onChange={(e) => setFinTitle(e.target.value)}
                placeholder="Libellé de l'opération (ex: Remboursement commande #CMD-904)"
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white"
                required
              />
              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black cursor-pointer"
              >
                Soumettre au circuit de validation
              </button>
            </form>
          </div>

          {/* Financial Validation Requests List */}
          <div className="space-y-2">
            {overview.financialValidations.map((fv) => (
              <div key={fv.id} className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono text-cyan-300">{fv.reference}</span>
                      <span className="text-xs font-black text-white">{fv.title}</span>
                      {fv.requiresSuperAdmin && (
                        <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 border border-purple-500/35 text-[10px] font-black text-purple-300">
                          Super Admin requis (&gt; {formatFCFA(fv.thresholdAppliedFcfa)})
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/55 mt-1">
                      Montant : <strong className="text-white">{formatFCFA(fv.amountFcfa)}</strong> • Préparé par{' '}
                      <strong>{fv.preparedByName}</strong> ({fmtDate(fv.preparedAt)})
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black border ${
                        fv.status === 'approved'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : fv.status === 'rejected'
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {fv.status}
                    </span>

                    {(fv.status === 'prepared' || fv.status === 'awaiting_super_admin') && (
                      <>
                        <button
                          onClick={() => void handleApproveFinVal(fv.id, fv.reference)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-black cursor-pointer"
                        >
                          Valider
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await teamService.rejectFinancialValidation(fv.id, 'Refusé après vérification');
                              showToast('Opération refusée');
                              await loadOverview();
                            } catch (e: any) {
                              showToast(e?.message || 'Refus impossible');
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[11px] font-bold cursor-pointer"
                        >
                          Refuser
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          5. JOURNAL IMMUABLE DE L'ÉQUIPE
         ========================================================================= */}
      {subView === 'journal' && (
        <div className="space-y-2.5">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center gap-2 text-[11px] text-amber-200">
            <Lock className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Journal d’audit administrateur immuable chaîné par empreinte SHA-256 — aucune modification ni suppression possible.</span>
          </div>
          <div className="space-y-2">
            {overview.recentActivities.map((entry) => (
              <div key={entry.id} className="p-3 rounded-2xl bg-[#141414] border border-white/10 space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-white/40">#{entry.seq}</span>
                    <span className="text-xs font-black text-white">{entry.action}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                      entry.result === 'reussi'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    {entry.result}
                  </span>
                </div>
                <p className="text-[11px] text-white/65">{entry.details}</p>
                <p className="text-[10px] text-white/40 font-mono">
                  {entry.actorName} ({entry.actorProfessionalId}) • {entry.module} • IP {entry.ipAddress} • {entry.device} • {fmtDate(entry.timestamp)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          6. NOTIFICATIONS D'ÉQUIPE
         ========================================================================= */}
      {subView === 'notifications' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-white">Alertes & notifications de gouvernance d’équipe</h4>
            <button
              onClick={async () => {
                await teamService.markAllNotificationsRead();
                await loadOverview();
              }}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-white cursor-pointer"
            >
              Tout marquer comme lu
            </button>
          </div>
          <div className="space-y-2">
            {overview.notifications.map((n) => (
              <div
                key={n.id}
                onClick={async () => {
                  if (!n.read) {
                    await teamService.markNotificationRead(n.id);
                    await loadOverview();
                  }
                }}
                className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                  n.read
                    ? 'bg-[#141414]/60 border-white/5 text-white/65'
                    : 'bg-[#181818] border-cyan-500/35 text-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black">{n.title}</p>
                  <span className="text-[10px] text-white/45">{fmtDate(n.timestamp)}</span>
                </div>
                <p className="text-[11px] text-white/70 mt-1">{n.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CRÉER UN ADMINISTRATEUR + INVITATION SÉCURISÉE
         ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#141414] border border-white/15 w-full max-w-2xl rounded-3xl p-5 shadow-2xl space-y-4 my-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-black text-white">Ajouter un administrateur DJASSA</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdInviteResult && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/35 space-y-2.5">
                <p className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Invitation sécurisée générée pour {createdInviteResult.fullName}</span>
                </p>
                <p className="text-[11px] text-white/70">
                  Aucun mot de passe en clair n’est créé. Transmettez ce jeton unique à usage sécurisé afin que{' '}
                  <strong>{createdInviteResult.email}</strong> définisse son mot de passe personnel :
                </p>
                <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 flex items-center justify-between gap-2">
                  <code className="text-[11px] text-cyan-300 font-mono break-all">{createdInviteResult.token}</code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(createdInviteResult.token);
                      showToast('Jeton d’invitation copié');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 text-[10px] font-bold shrink-0"
                  >
                    <Copy className="w-3.5 h-3.5 inline mr-1" /> Copier
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInviteTokenInput(createdInviteResult.token);
                    setShowCreateModal(false);
                    setAuthModalTab('accept');
                    setShowAuthModal(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500 text-black text-[11px] font-black cursor-pointer"
                >
                  Ouvrir l’écran d’activation avec ce jeton →
                </button>
              </div>
            )}

            <form onSubmit={handleCreateAdminSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-white/60 font-bold block mb-1">Nom complet *</label>
                  <input
                    type="text"
                    value={createFullName}
                    onChange={(e) => setCreateFullName(e.target.value)}
                    placeholder="Ex: Kouakou Marc"
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] text-white/60 font-bold block mb-1">Email professionnel *</label>
                  <input
                    type="email"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="Ex: marc.k@djassa.ci"
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] text-white/60 font-bold block mb-1">Téléphone</label>
                  <input
                    type="text"
                    value={createPhone}
                    onChange={(e) => setCreatePhone(e.target.value)}
                    placeholder="+225 07 00 00 00 00"
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-white/60 font-bold block mb-1">Identifiant professionnel (optionnel)</label>
                  <input
                    type="text"
                    value={createProId}
                    onChange={(e) => setCreateProId(e.target.value)}
                    placeholder="Auto (ex: ADM-2026-006)"
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-white/60 font-bold block mb-1.5">Rôle administratif (parmi les 8 rôles)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {overview.roles.map((r) => {
                    const locked = r.reservedToOwner;
                    const selected = createRole === r.key;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        disabled={locked}
                        onClick={() => handleSelectCreateRole(r.key)}
                        className={`p-2.5 rounded-xl text-left border transition ${
                          locked
                            ? 'bg-black/30 border-white/5 opacity-45 cursor-not-allowed'
                            : selected
                            ? 'bg-cyan-500/20 border-cyan-400 text-white cursor-pointer'
                            : 'bg-white/5 border-white/10 text-white/75 hover:bg-white/10 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-black text-[11px]">{r.label}</span>
                          {locked && <Lock className="w-3 h-3 text-purple-300" />}
                        </div>
                        <p className="text-[10px] text-white/50 mt-0.5 line-clamp-2">{r.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                <label className="flex items-center gap-2 text-[11px] text-white/75 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createMfaEnabled}
                    onChange={(e) => setCreateMfaEnabled(e.target.checked)}
                  />
                  <span>Exiger la 2FA (MFA) pour cet administrateur</span>
                </label>

                <button
                  type="button"
                  onClick={() => setCreateCustomizePerms((v) => !v)}
                  className="text-[11px] font-bold text-cyan-400 hover:underline cursor-pointer"
                >
                  {createCustomizePerms ? 'Masquer matrice 20 modules ▲' : 'Personnaliser les 20 modules ▼'}
                </button>
              </div>

              {createCustomizePerms && (
                <div className="max-h-52 overflow-y-auto rounded-2xl bg-black/50 border border-white/10 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {overview.modulesMeta.map((m) => (
                    <div key={m.key} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-white/80 truncate">{m.label}</span>
                      <select
                        value={createMatrix[m.key] || 'none'}
                        onChange={(e) =>
                          setCreateMatrix((prev) => ({
                            ...prev,
                            [m.key]: e.target.value as TeamPermissionLevel
                          }))
                        }
                        className="px-2 py-1 rounded-lg bg-[#181818] border border-white/15 text-[10px] text-white"
                      >
                        {overview.permissionLevelsMeta.map((l) => (
                          <option key={l.key} value={l.key}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold"
                >
                  Fermer
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black cursor-pointer"
                >
                  Créer & envoyer l’invitation sécurisée
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ACCEPTER INVITATION / CONNEXION INDÉPENDANTE ADMIN
         ========================================================================= */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-white/15 w-full max-w-md rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-black text-white">Portail d’activation & connexion admin</h3>
              <button
                onClick={() => setShowAuthModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setAuthModalTab('accept')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border ${
                  authModalTab === 'accept'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-white/5 border-white/10 text-white/60'
                }`}
              >
                Accepter invitation
              </button>
              <button
                onClick={() => setAuthModalTab('login')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border ${
                  authModalTab === 'login'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                    : 'bg-white/5 border-white/10 text-white/60'
                }`}
              >
                Connexion administrateur
              </button>
            </div>

            {authModalTab === 'accept' ? (
              <form onSubmit={handleAcceptInvitationSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="text-[11px] text-white/60 font-bold block mb-1">Jeton d’invitation sécurisé</label>
                  <input
                    type="text"
                    value={inviteTokenInput}
                    onChange={(e) => setInviteTokenInput(e.target.value)}
                    placeholder="djinv_..."
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] text-white/60 font-bold block mb-1">
                    Définir votre mot de passe personnel (8+ car., majuscule, chiffre)
                  </label>
                  <input
                    type="password"
                    value={invitePasswordInput}
                    onChange={(e) => setInvitePasswordInput(e.target.value)}
                    placeholder="••••••••••"
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={authBusy}
                  className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black cursor-pointer"
                >
                  {authBusy ? 'Activation...' : 'Activer le compte administrateur'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleIndependentLoginSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="text-[11px] text-white/60 font-bold block mb-1">Email professionnel</label>
                  <input
                    type="email"
                    value={loginEmailInput}
                    onChange={(e) => setLoginEmailInput(e.target.value)}
                    placeholder="admin@djassa.ci"
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] text-white/60 font-bold block mb-1">Mot de passe</label>
                  <input
                    type="password"
                    value={loginPasswordInput}
                    onChange={(e) => setLoginPasswordInput(e.target.value)}
                    placeholder="••••••••••"
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={authBusy}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black cursor-pointer"
                >
                  {authBusy ? 'Vérification...' : 'Ouvrir session avec cet administrateur'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: FICHE DÉTAILLÉE D'UN ADMINISTRATEUR
         ========================================================================= */}
      {selectedAdminId && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-[#141414] border border-white/15 w-full max-w-3xl rounded-3xl p-5 shadow-2xl space-y-4 my-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 sticky top-0 bg-[#141414] z-10">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-black text-white">
                    {detailData ? detailData.admin.fullName : 'Chargement...'}
                  </h3>
                  {detailData && (
                    <p className="text-[10px] text-white/50 font-mono">
                      {detailData.admin.professionalId} • {detailData.admin.roleLabel}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedAdminId(null);
                  setDetailData(null);
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {detailLoading || !detailData ? (
              <div className="py-12 text-center text-xs text-white/50">Chargement des détails sécurisés...</div>
            ) : (
              <>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {[
                    { id: 'info', label: 'Infos pro' },
                    { id: 'security', label: 'Sécurité & Sessions' },
                    { id: 'permissions', label: 'Permissions (20 modules)' },
                    { id: 'activity', label: 'Activité & Finances' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setDetailTab(t.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border whitespace-nowrap cursor-pointer ${
                        detailTab === t.id
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                          : 'bg-white/5 border-white/10 text-white/60'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* DETAIL TAB 1: INFOS PRO */}
                {detailTab === 'info' && (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-white/50 font-bold block mb-1">Nom complet</label>
                        <input
                          type="text"
                          value={editFullName}
                          disabled={!isCurrentSuperAdmin}
                          onChange={(e) => setEditFullName(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-white/50 font-bold block mb-1">Téléphone</label>
                        <input
                          type="text"
                          value={editPhone}
                          disabled={!isCurrentSuperAdmin}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-white/50 font-bold block mb-1">Département / Service</label>
                        <input
                          type="text"
                          value={editDepartment}
                          disabled={!isCurrentSuperAdmin}
                          onChange={(e) => setEditDepartment(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-white/50 font-bold block mb-1">Rôle administratif</label>
                        <select
                          value={editRole}
                          disabled={!isCurrentSuperAdmin || detailData.admin.role === 'super_admin'}
                          onChange={(e) => setEditRole(e.target.value as AdminTeamRoleKey)}
                          className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white"
                        >
                          {overview.roles.map((r) => (
                            <option
                              key={r.key}
                              value={r.key}
                              disabled={r.key === 'super_admin' && detailData.admin.role !== 'super_admin'}
                            >
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-black/40 border border-white/10 text-[11px] text-white/70 space-y-1">
                      <p>Email professionnel : <strong className="text-white">{detailData.admin.email}</strong></p>
                      <p>Créé par : <strong>{detailData.admin.createdByName}</strong> le {fmtDate(detailData.admin.createdAt)}</p>
                      <p>Dernière modification permissions : {fmtDate(detailData.admin.permissionsUpdatedAt)} ({detailData.admin.permissionsUpdatedBy})</p>
                    </div>

                    {isCurrentSuperAdmin && detailData.admin.status !== 'deactivated' && (
                      <button
                        onClick={() => void handleSaveDetailChanges()}
                        disabled={savingDetail}
                        className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black cursor-pointer"
                      >
                        {savingDetail ? 'Enregistrement...' : 'Enregistrer les modifications (MFA)'}
                      </button>
                    )}
                  </div>
                )}

                {/* DETAIL TAB 2: SÉCURITÉ & SESSIONS */}
                {detailTab === 'security' && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <p className="text-[10px] text-white/45">Statut</p>
                        <p className="font-black text-white mt-0.5">{STATUS_BADGE[detailData.admin.status].label}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/45">2FA (MFA)</p>
                        <p className="font-black text-emerald-400 mt-0.5">{detailData.admin.mfaEnabled ? 'Activée' : 'Désactivée'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/45">Sessions actives</p>
                        <p className="font-black text-cyan-400 mt-0.5">{detailData.activeSessions.length}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/45">Dernière connexion</p>
                        <p className="font-bold text-white/85 mt-0.5">{fmtDate(detailData.admin.lastLoginAt)}</p>
                      </div>
                    </div>

                    {/* Action Controls */}
                    {isCurrentSuperAdmin && detailData.admin.role !== 'super_admin' && (
                      <div className="flex flex-wrap gap-2">
                        {detailData.admin.status === 'invited' && (
                          <button
                            onClick={() => void handleResendInvitation(detailData.admin)}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 font-bold cursor-pointer flex items-center gap-1"
                          >
                            <Send className="w-3.5 h-3.5" /> Renvoyer l’invitation
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setActionReason('');
                            setConfirmAction({ type: 'revoke', admin: detailData.admin });
                          }}
                          className="px-3 py-1.5 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-200 font-bold cursor-pointer"
                        >
                          Révoquer toutes les sessions
                        </button>
                        {detailData.admin.status === 'active' && (
                          <button
                            onClick={() => {
                              setActionReason('');
                              setConfirmAction({ type: 'suspend', admin: detailData.admin });
                            }}
                            className="px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 font-bold cursor-pointer"
                          >
                            Suspendre temporairement
                          </button>
                        )}
                        {detailData.admin.status === 'suspended' && (
                          <button
                            onClick={() => void handleReactivateAdmin(detailData.admin)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 font-bold cursor-pointer"
                          >
                            Réactiver le compte
                          </button>
                        )}
                        {detailData.admin.status !== 'deactivated' && (
                          <button
                            onClick={() => {
                              setActionReason('');
                              setConfirmAction({ type: 'deactivate', admin: detailData.admin });
                            }}
                            className="px-3 py-1.5 rounded-xl bg-white/10 border border-rose-500/40 text-rose-300 font-bold cursor-pointer"
                          >
                            Désactiver définitivement
                          </button>
                        )}
                      </div>
                    )}

                    {/* Sessions & Devices */}
                    <div className="space-y-2">
                      <h5 className="text-[11px] font-black text-white/80">Appareils & historique des connexions</h5>
                      {detailData.loginHistory.length === 0 ? (
                        <p className="text-[11px] text-white/40">Aucune connexion enregistrée pour cet administrateur.</p>
                      ) : (
                        detailData.loginHistory.slice(0, 8).map((lgn) => (
                          <div key={lgn.id} className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex justify-between gap-2 text-[11px]">
                            <span>{lgn.device} • {lgn.browser} ({lgn.ipAddress})</span>
                            <span className="text-white/50">{fmtDate(lgn.timestamp)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* DETAIL TAB 3: PERMISSIONS GRANULAIRES */}
                {detailTab === 'permissions' && editMatrix && (
                  <div className="space-y-3 text-xs">
                    {detailData.admin.role === 'super_admin' && (
                      <div className="p-3 rounded-xl bg-purple-500/15 border border-purple-500/35 text-purple-200 text-[11px] font-bold">
                        Protection Super Administrateur : accès total immuable sur l’ensemble des 20 modules DJASSA.
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {overview.modulesMeta.map((m) => (
                        <div
                          key={m.key}
                          className="p-2.5 rounded-xl bg-black/45 border border-white/10 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-white truncate">{m.label}</p>
                            <p className="text-[9px] text-white/40">{m.group}</p>
                          </div>
                          <select
                            value={editMatrix[m.key]}
                            disabled={!isCurrentSuperAdmin || detailData.admin.role === 'super_admin' || detailData.admin.status === 'deactivated'}
                            onChange={(e) =>
                              setEditMatrix((prev) =>
                                prev ? { ...prev, [m.key]: e.target.value as TeamPermissionLevel } : prev
                              )
                            }
                            className="px-2 py-1 rounded-lg bg-[#181818] border border-white/15 text-[10px] text-white font-bold"
                          >
                            {overview.permissionLevelsMeta.map((l) => (
                              <option key={l.key} value={l.key}>
                                {l.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>

                    {isCurrentSuperAdmin && detailData.admin.role !== 'super_admin' && detailData.admin.status !== 'deactivated' && (
                      <button
                        onClick={() => void handleSaveDetailChanges()}
                        disabled={savingDetail}
                        className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black cursor-pointer"
                      >
                        Appliquer les permissions (MFA)
                      </button>
                    )}
                  </div>
                )}

                {/* DETAIL TAB 4: ACTIVITÉ & DÉCISIONS FINANCIÈRES */}
                {detailTab === 'activity' && (
                  <div className="space-y-3 text-xs">
                    <h5 className="text-[11px] font-black text-white/80">
                      Actions & décisions conservées ({detailData.activities.length})
                    </h5>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {detailData.activities.map((act) => (
                        <div key={act.id} className="p-2.5 rounded-xl bg-black/45 border border-white/5">
                          <div className="flex justify-between gap-2">
                            <span className="font-bold text-white">{act.action}</span>
                            <span className="text-[10px] text-white/45">{fmtDate(act.timestamp)}</span>
                          </div>
                          <p className="text-[10px] text-white/55 mt-0.5">{act.details}</p>
                        </div>
                      ))}
                    </div>

                    {detailData.financialDecisions.length > 0 && (
                      <>
                        <h5 className="text-[11px] font-black text-emerald-300 pt-2">
                          Opérations financières impliquées ({detailData.financialDecisions.length})
                        </h5>
                        {detailData.financialDecisions.map((fv) => (
                          <div key={fv.id} className="p-2.5 rounded-xl bg-black/45 border border-white/10">
                            <p className="font-bold text-white">{fv.reference} — {fv.title}</p>
                            <p className="text-[10px] text-white/55">
                              {formatFCFA(fv.amountFcfa)} • Statut : {fv.status}
                            </p>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CONFIRMATION SUSPENSION / DÉSACTIVATION / RÉVOCATION
         ========================================================================= */}
      {confirmAction && (
        <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#161616] border border-rose-500/30 w-full max-w-md rounded-3xl p-5 shadow-2xl space-y-3.5 text-xs">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="text-sm font-black">
                {confirmAction.type === 'suspend'
                  ? 'Confirmation : Suspension temporaire'
                  : confirmAction.type === 'deactivate'
                  ? 'Confirmation : Désactivation définitive'
                  : 'Confirmation : Révocation des sessions'}
              </h4>
            </div>
            <p className="text-white/70">
              Cible : <strong className="text-white">{confirmAction.admin.fullName}</strong> ({confirmAction.admin.professionalId}).
              {confirmAction.type === 'deactivate' &&
                ' L’historique complet des actions et validations financières sera intégralement préservé.'}
            </p>
            <input
              type="text"
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="Motif obligatoire pour le journal d’audit..."
              className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-white"
            />
            {confirmAction.type === 'suspend' && (
              <div>
                <label className="text-[10px] text-white/50 block mb-1">Durée (jours)</label>
                <input
                  type="number"
                  min={1}
                  value={suspendDays}
                  onChange={(e) => setSuspendDays(Number(e.target.value) || 7)}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-white font-mono"
                />
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-bold"
              >
                Annuler
              </button>
              <button
                onClick={() => void handleExecuteConfirmAction()}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black cursor-pointer"
              >
                Confirmer (MFA)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: VÉRIFICATION STEP-UP MFA
         ========================================================================= */}
      {mfaPrompt && (
        <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#161616] border border-purple-500/40 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-3.5 text-xs">
            <div className="flex items-center gap-2 text-purple-300">
              <Key className="w-5 h-5" />
              <h4 className="text-sm font-black">{mfaPrompt.title}</h4>
            </div>
            <p className="text-white/70">
              Code de confirmation MFA émis : <strong className="font-mono text-cyan-300">{mfaPrompt.previewCode}</strong>
            </p>
            <input
              type="text"
              value={mfaPrompt.code}
              onChange={(e) => setMfaPrompt((prev) => (prev ? { ...prev, code: e.target.value } : prev))}
              placeholder="Saisir le code MFA"
              className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white font-mono text-center tracking-widest"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setMfaPrompt(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-bold"
              >
                Annuler
              </button>
              <button
                disabled={mfaBusy}
                onClick={async () => {
                  setMfaBusy(true);
                  try {
                    const cb = mfaPrompt.onConfirm;
                    const code = mfaPrompt.code;
                    setMfaPrompt(null);
                    await cb(code);
                  } catch (e: any) {
                    showToast(e?.message || 'Vérification MFA refusée');
                  } finally {
                    setMfaBusy(false);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black cursor-pointer"
              >
                {mfaBusy ? 'Vérification...' : 'Valider MFA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
