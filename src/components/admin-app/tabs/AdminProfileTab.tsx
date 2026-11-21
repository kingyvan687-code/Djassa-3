import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import {
  ShieldCheck,
  Camera,
  Check,
  MapPin,
  Users,
  Store,
  Package,
  Wallet,
  Edit3,
  LogOut,
  Sliders,
  Bell,
  Lock,
  Globe,
  Database,
  Moon,
  Smartphone,
  ChevronRight,
  X,
  AlertTriangle,
  RotateCw,
  Clock,
  Sparkles,
  Menu,
  Shield,
  FileText,
  Key,
  CheckCircle2,
  Mail,
  Building,
  Plus,
  Wrench,
  Activity,
  ShieldAlert,
  Archive
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { formatFCFA } from '../../../services/marketServices';
import { AdminTabType } from '../../../types';
import { securityService } from '../../../services/securityService';

const AdminSecuritySurveillanceModule = lazy(() =>
  import('../security/AdminSecuritySurveillanceModule').then((m) => ({
    default: m.AdminSecuritySurveillanceModule
  }))
);
const AdminSecurityAccessCenter = lazy(() =>
  import('../security/AdminSecurityAccessCenter').then((m) => ({ default: m.AdminSecurityAccessCenter }))
);
const AdminActivityLogModule = lazy(() =>
  import('../security/AdminActivityLogModule').then((m) => ({ default: m.AdminActivityLogModule }))
);
const AdminNotificationsCenterModule = lazy(() =>
  import('../security/AdminNotificationsCenterModule').then((m) => ({
    default: m.AdminNotificationsCenterModule
  }))
);
const AdminMaintenanceVersionsModule = lazy(() =>
  import('../maintenance/AdminMaintenanceVersionsModule').then((m) => ({
    default: m.AdminMaintenanceVersionsModule
  }))
);
const AdminSystemSurveillanceModule = lazy(() =>
  import('../surveillance/AdminSystemSurveillanceModule').then((m) => ({
    default: m.AdminSystemSurveillanceModule
  }))
);
const AdminPrivacyProtectionModule = lazy(() =>
  import('../privacy/AdminPrivacyProtectionModule').then((m) => ({
    default: m.AdminPrivacyProtectionModule
  }))
);
const AdminFinancialFraudModule = lazy(() =>
  import('../fraud/AdminFinancialFraudModule').then((m) => ({ default: m.AdminFinancialFraudModule }))
);
const AdminBackupRestoreModule = lazy(() =>
  import('../backup/AdminBackupRestoreModule').then((m) => ({ default: m.AdminBackupRestoreModule }))
);
const AdminTeamModule = lazy(() =>
  import('../team/AdminTeamModule').then((m) => ({ default: m.AdminTeamModule }))
);

const AdminModuleFallback = () => (
  <div className="p-6 rounded-2xl bg-[#141417] border border-white/10 flex items-center justify-center gap-2 text-xs text-white/60">
    <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-emerald-400 animate-spin" />
    <span>Chargement du module...</span>
  </div>
);

interface AdminProfileTabProps {
  onNavigateTab?: (tab: AdminTabType) => void;
  onSignOut?: () => void;
}

export const AdminProfileTab: React.FC<AdminProfileTabProps> = ({ onNavigateTab, onSignOut }) => {
  const { 
    adminUsers, 
    orders, 
    sellers, 
    platformConfig, 
    auditLogs, 
    signOut, 
    showToast,
    addAuditLog 
  } = useApp();

  // Sub-tab selection
  const [activeSubTab, setActiveSubTab] = useState<
    | 'securite'
    | 'equipe'
    | 'notifications'
    | 'audit'
    | 'preferences'
    | 'surveillance'
    | 'maintenance'
    | 'system_surveillance'
    | 'privacy'
    | 'fraud'
    | 'backups'
  >('securite');
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  useEffect(() => {
    let active = true;
    securityService
      .getAdminNotifications({ limit: 5 })
      .then((res) => {
        if (active) setUnreadNotifCount(res.kpis.unreadCount);
      })
      .catch(() => {});

    const disconnect = securityService.connectAdminNotificationStream((event) => {
      if (
        event.type === 'notification:created' ||
        event.type === 'notification:updated' ||
        event.type === 'notification:read_all'
      ) {
        securityService
          .getAdminNotifications({ limit: 5 })
          .then((res) => {
            if (active) setUnreadNotifCount(res.kpis.unreadCount);
          })
          .catch(() => {});
      }
    });

    return () => {
      active = false;
      disconnect();
    };
  }, []);

  // Modals state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Team state & add member modal
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'super_admin' | 'moderator' | 'support' | 'finance'>('moderator');
  const [teamMembers, setTeamMembers] = useState([
    { id: 'admin-1', name: 'Kouassi Yves', email: 'yves.kouassi@djassa.ci', role: 'Super Administrateur', badge: 'Accès Total', color: 'text-purple-400 bg-purple-500/20' },
    { id: 'admin-2', name: 'Awa Traoré', email: 'awa.traore@djassa.ci', role: 'Modératrice KYC & Marchands', badge: 'KYC & Audit', color: 'text-cyan-400 bg-cyan-500/20' },
    { id: 'admin-3', name: 'Mamadou Diabaté', email: 'mamadou.d@djassa.ci', role: 'Responsable Conflits & Support', badge: 'Médiation', color: 'text-amber-400 bg-amber-500/20' }
  ]);

  const handleAddTeamMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberEmail.trim()) return;
    const roleLabels = {
      super_admin: { role: 'Super Administrateur', badge: 'Accès Total', color: 'text-purple-400 bg-purple-500/20' },
      moderator: { role: 'Modérateur KYC & Annonces', badge: 'KYC & Audit', color: 'text-cyan-400 bg-cyan-500/20' },
      support: { role: 'Support Client & Litiges', badge: 'Médiation', color: 'text-amber-400 bg-amber-500/20' },
      finance: { role: 'Auditeur Financier', badge: 'Caisse & Audit', color: 'text-emerald-400 bg-emerald-500/20' }
    };
    const selectedRole = roleLabels[newMemberRole];
    const newMember = {
      id: `admin-${Date.now()}`,
      name: newMemberName.trim(),
      email: newMemberEmail.trim(),
      role: selectedRole.role,
      badge: selectedRole.badge,
      color: selectedRole.color
    };
    setTeamMembers(prev => [...prev, newMember]);
    void securityService.recordActivity({
      category: 'admin_mgmt',
      actionType: 'admin_collaborator_created',
      action: `Création compte collaborateur admin (${newMember.name})`,
      target: `${newMember.name} (${newMember.email})`,
      targetType: 'account',
      entityType: 'admin_account',
      entityId: newMember.id,
      space: 'admin',
      result: 'reussi',
      severity: newMemberRole === 'super_admin' ? 'critique' : 'eleve',
      afterValue: `${newMember.role} (${newMember.badge})`,
      details: `Nouveau membre d'administration ajouté : ${newMember.role}`
    });
    setNewMemberName('');
    setNewMemberEmail('');
    setIsAddMemberModalOpen(false);
    showToast(`Nouveau collaborateur ${newMember.name} invité ! 🎉`);
  };

  // Avatar state
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [adminAvatar, setAdminAvatar] = useState<string>('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80');

  // Admin Profile editable fields
  const [adminName, setAdminName] = useState('Super Administrateur');
  const [adminEmail, setAdminEmail] = useState('admin.direction@djassa.ci');
  const [adminPhone, setAdminPhone] = useState('+225 07 00 12 34 56');
  const [adminRoleTitle, setAdminRoleTitle] = useState('Directeur Général & Contrôleur Systèmes');
  const [adminBio, setAdminBio] = useState('Direction générale et supervision de la plateforme Djassa Marketplace. Contrôle des boutiques vendeurs, surveillance des flux financiers Wave & Orange Money et contrôle de conformité.');

  // Settings & preferences toggles
  const [twoFactorAuth, setTwoFactorAuth] = useState(true);
  const [highSecurityMode, setHighSecurityMode] = useState(true);
  const [autoApproveVerified, setAutoApproveVerified] = useState(false);
  const [adminLang, setAdminLang] = useState('Français (CI)');
  const [adminTimezone, setAdminTimezone] = useState('Africa/Abidjan (GMT+0)');
  const [compactTables, setCompactTables] = useState(false);
  const [autoReportExport, setAutoReportExport] = useState(true);
  const [rolePermissions, setRolePermissions] = useState<Record<string, Record<string, boolean>>>({
    super_admin: { kyc: true, finance: true, moderation: true, system: true },
    moderator: { kyc: true, finance: false, moderation: true, system: false },
    support: { kyc: false, finance: false, moderation: true, system: false },
    finance: { kyc: false, finance: true, moderation: false, system: false }
  });

  // Key stats
  const totalUsersCount = adminUsers.length || 148;
  const totalSellersCount = sellers.length || 32;
  const totalOrdersCount = orders.length || 1240;
  const totalCommissions = 1850000;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAdminAvatar(url);
      void securityService.recordActivity({
        category: 'accounts',
        actionType: 'admin_avatar_updated',
        action: 'Mise à jour photo de profil Super Admin',
        target: adminEmail,
        targetType: 'account',
        entityType: 'admin_account',
        entityId: 'DJASSA-ROOT-001',
        space: 'admin',
        result: 'reussi',
        severity: 'information',
        details: `Photo de profil administrateur modifiée (${file.name})`
      });
      showToast('Photo de profil administrateur mise à jour');
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditProfileOpen(false);
    showToast('Profil administrateur enregistré avec succès !');
    if (addAuditLog) {
      addAuditLog(
        'Mise à jour du profil Super Admin',
        adminEmail,
        'security',
        `Mise à jour du profil : ${adminName} (${adminRoleTitle})`
      );
    }
  };

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    if (onSignOut) {
      onSignOut();
    } else {
      signOut();
    }
  };

  return (
    <div id="admin-profile-screen" className="w-full min-h-0 bg-transparent text-white flex flex-col overflow-y-auto no-scrollbar pb-28 select-none">
      
      {/* =========================================================================
          SOCIAL-STYLE HERO HEADER
          ========================================================================= */}
      <div className="p-4 flex flex-col items-center text-center space-y-3">
        {/* Avatar with Camera Button & Badge */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-purple-500 shadow-xl shadow-purple-500/20 bg-black">
            <img
              src={adminAvatar}
              alt={adminName}
              className="w-full h-full object-cover"
            />
          </div>
          <button
            onClick={() => avatarInputRef.current?.click()}
            className="absolute bottom-0 right-0 p-1.5 rounded-full bg-purple-500 text-white shadow-lg border-2 border-[#0A0A0A] hover:bg-purple-400 transition cursor-pointer"
            title="Changer la photo de profil"
          >
            <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        {/* Identity & Registered Role */}
        <div>
          <div className="flex items-center justify-center gap-1.5">
            <h2 className="text-base font-black text-white">{adminName}</h2>
            <span className="p-0.5 rounded-full bg-purple-500 text-white shrink-0" title="Super Admin Accrédité">
              <Check className="w-3 h-3 stroke-[3]" />
            </span>
          </div>
          <p className="text-xs text-purple-400 font-bold mt-0.5">{adminRoleTitle}</p>
          <p className="text-[10px] text-white/45 font-mono mt-0.5">ID: DJASSA-ROOT-001 • {adminEmail}</p>
        </div>

        {/* Actions (Modifier profil + Déconnexion) */}
        <div className="flex items-center gap-2 pt-1 flex-wrap justify-center">
          <button
            id="btn-edit-admin-profile"
            onClick={() => setIsEditProfileOpen(true)}
            className="py-2 px-5 rounded-2xl bg-white/5 hover:bg-white/10 text-white/90 border border-white/10 text-xs font-bold flex items-center gap-2 transition backdrop-blur-md cursor-pointer active:scale-95"
          >
            <Edit3 className="w-3.5 h-3.5 text-purple-400" />
            <span>Modifier le profil administrateur</span>
          </button>

          <button
            id="btn-admin-profile-logout"
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="py-2 px-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs font-black text-rose-400 hover:bg-rose-500/20 transition flex items-center gap-1.5 backdrop-blur-md cursor-pointer active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          4. CONTENT TABS: 7 ONGLETS ADMIN
          ========================================================================= */}
      <div className="border-t border-b border-white/10 flex bg-[#0A0A0A]/70 backdrop-blur-md text-xs font-bold sticky top-0 z-20 overflow-x-auto no-scrollbar">
        <button
          id="tab-admin-securite"
          onClick={() => setActiveSubTab('securite')}
          className={`shrink-0 px-3.5 py-3 flex items-center justify-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'securite'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-white/40 hover:text-white/70'
          }`}
          title="Sécurité et accès"
        >
          <Lock className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>Sécurité et accès</span>
        </button>

        <button
          id="tab-admin-equipe"
          onClick={() => setActiveSubTab('equipe')}
          className={`shrink-0 px-3.5 py-3 flex items-center justify-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'equipe'
              ? 'text-cyan-400 border-b-2 border-cyan-400'
              : 'text-white/40 hover:text-white/70'
          }`}
          title="Équipe Administrateur"
        >
          <Users className="w-4 h-4 shrink-0 text-cyan-400" />
          <span>Équipe</span>
        </button>

        <button
          id="tab-admin-notifications"
          onClick={() => setActiveSubTab('notifications')}
          className={`shrink-0 px-3.5 py-3 flex items-center justify-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'notifications'
              ? 'text-[#FF6321] border-b-2 border-[#FF6321]'
              : 'text-white/40 hover:text-white/70'
          }`}
          title="Notifications"
        >
          <Bell className="w-4 h-4 shrink-0 text-[#FF6321]" />
          <span>Notifications</span>
          {unreadNotifCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-md bg-[#FF6321] text-white text-[10px] font-black leading-none font-mono tabular-nums">
              {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
            </span>
          )}
        </button>

        <button
          id="tab-admin-audit"
          onClick={() => setActiveSubTab('audit')}
          className={`shrink-0 px-3.5 py-3 flex items-center justify-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'audit'
              ? 'text-amber-400 border-b-2 border-amber-400'
              : 'text-white/40 hover:text-white/70'
          }`}
          title="Journal d'activité"
        >
          <Clock className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Journal d'activité</span>
        </button>

        <button
          id="tab-admin-preferences"
          onClick={() => setActiveSubTab('preferences')}
          className={`shrink-0 px-3.5 py-3 flex items-center justify-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'preferences'
              ? 'text-sky-400 border-b-2 border-sky-400'
              : 'text-white/40 hover:text-white/70'
          }`}
          title="Préférences"
        >
          <Sliders className="w-4 h-4 shrink-0 text-sky-400" />
          <span>Préférences</span>
        </button>

        <button
          id="tab-admin-security-surveillance"
          onClick={() => setActiveSubTab('surveillance')}
          className={`shrink-0 px-3.5 py-3 flex items-center justify-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'surveillance'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-white/40 hover:text-white/70'
          }`}
          title="Sécurité & surveillance"
        >
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>Sécurité & surveillance</span>
        </button>

        <button
          id="tab-admin-maintenance-versions"
          onClick={() => setActiveSubTab('maintenance')}
          className={`shrink-0 px-3.5 py-3 flex items-center justify-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'maintenance'
              ? 'text-amber-400 border-b-2 border-amber-400'
              : 'text-white/40 hover:text-white/70'
          }`}
          title="Maintenance & gestion des versions"
        >
          <Wrench className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Maintenance & versions</span>
        </button>

        <button
          id="tab-admin-system-surveillance"
          onClick={() => setActiveSubTab('system_surveillance')}
          className={`shrink-0 px-3.5 py-3 flex items-center justify-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'system_surveillance'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-white/40 hover:text-white/70'
          }`}
          title="Surveillance technique du système"
        >
          <Activity className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>Surveillance technique</span>
        </button>

        <button
          id="tab-admin-privacy-protection"
          onClick={() => setActiveSubTab('privacy')}
          className={`shrink-0 px-3.5 py-3 flex items-center justify-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'privacy'
              ? 'text-sky-400 border-b-2 border-sky-400'
              : 'text-white/40 hover:text-white/70'
          }`}
          title="Confidentialité & protection des données"
        >
          <ShieldCheck className="w-4 h-4 shrink-0 text-sky-400" />
          <span>Confidentialité & données</span>
        </button>

        <button
          id="tab-admin-financial-fraud"
          onClick={() => setActiveSubTab('fraud')}
          className={`shrink-0 px-3.5 py-3 flex items-center justify-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'fraud'
              ? 'text-amber-400 border-b-2 border-amber-400'
              : 'text-white/40 hover:text-white/70'
          }`}
          title="Détection des fraudes financières"
        >
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Fraudes financières</span>
        </button>

        <button
          id="tab-admin-backups-restore"
          onClick={() => setActiveSubTab('backups')}
          className={`shrink-0 px-3.5 py-3 flex items-center justify-center gap-1.5 transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'backups'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-white/40 hover:text-white/70'
          }`}
          title="Sauvegardes & restauration"
        >
          <Archive className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>Sauvegardes & restauration</span>
        </button>
      </div>

      {/* =========================================================================
          5. TAB CONTENT PANELS
          ========================================================================= */}
      <div className="p-3 sm:p-4 flex-1 space-y-4">
        <Suspense fallback={<AdminModuleFallback />}>
          {/* TAB: JOURNAL D'AUDIT */}
          {activeSubTab === 'audit' && (
            <div className="animate-in fade-in duration-200">
              <AdminActivityLogModule />
            </div>
          )}

          {/* TAB: SÉCURITÉ ET ACCÈS */}
          {activeSubTab === 'securite' && (
            <div className="animate-in fade-in duration-200">
              <AdminSecurityAccessCenter />
            </div>
          )}

          {/* TAB: ÉQUIPE */}
          {activeSubTab === 'equipe' && (
            <div className="animate-in fade-in duration-200">
              <AdminTeamModule />
            </div>
          )}

          {/* TAB: NOTIFICATIONS */}
          {activeSubTab === 'notifications' && (
            <div className="animate-in fade-in duration-200">
              <AdminNotificationsCenterModule
                onNavigateTab={onNavigateTab}
                onOpenAuditSubTab={() => setActiveSubTab('audit')}
                onUnreadCountChange={setUnreadNotifCount}
              />
            </div>
          )}

          {/* TAB: PRÉFÉRENCES */}
          {activeSubTab === 'preferences' && (
            <div className="space-y-3.5 animate-in fade-in duration-200">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Préférences de l'Espace Admin</span>
                </h4>
                <p className="text-[11px] text-white/50 mt-0.5">Personnalisation régionale et affichage</p>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-sky-400" />
                    <div>
                      <p className="font-bold text-white">Langue du panneau</p>
                      <p className="text-[10px] text-white/50">Langue d'affichage principale</p>
                    </div>
                  </div>
                  <select
                    value={adminLang}
                    onChange={(e) => {
                      const prevLang = adminLang;
                      const nextLang = e.target.value;
                      setAdminLang(nextLang);
                      void securityService.recordActivity({
                        category: 'system_config',
                        actionType: 'admin_language_changed',
                        action: 'Modification langue panneau administrateur',
                        target: 'Panneau Admin',
                        targetType: 'settings',
                        entityType: 'admin_settings',
                        space: 'admin',
                        result: 'reussi',
                        severity: 'information',
                        beforeValue: prevLang,
                        afterValue: nextLang,
                        details: `Langue d'administration définie sur ${nextLang}`
                      });
                      showToast(`Langue définie sur ${nextLang}`);
                    }}
                    className="bg-black/60 border border-white/15 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-white focus:outline-none focus:border-sky-400"
                  >
                    <option value="Français (CI)">Français (CI)</option>
                    <option value="English (Intl)">English (Intl)</option>
                  </select>
                </div>

                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <div>
                      <p className="font-bold text-white">Fuseau horaire</p>
                      <p className="text-[10px] text-white/50">Horodatage des journaux et commandes</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-white/10 text-[11px] font-bold text-white/90">
                    {adminTimezone}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    <div>
                      <p className="font-bold text-white">Devise de référence</p>
                      <p className="text-[10px] text-white/50">Affichage financier et commissions</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-black">
                    FCFA (XOF)
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white">Affichage compact des listes</p>
                    <p className="text-[10px] text-white/50">Plus d'éléments visibles par écran</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !compactTables;
                      setCompactTables(nextVal);
                      void securityService.recordActivity({
                        category: 'system_config',
                        actionType: 'admin_compact_mode_toggled',
                        action: 'Modification affichage listes administrateur',
                        target: 'Mode compact',
                        targetType: 'settings',
                        entityType: 'admin_settings',
                        space: 'admin',
                        result: 'reussi',
                        severity: 'information',
                        beforeValue: compactTables ? 'Compact' : 'Standard',
                        afterValue: nextVal ? 'Compact' : 'Standard',
                        details: `Affichage panneau admin : ${nextVal ? 'Compact' : 'Standard'}`
                      });
                      showToast(nextVal ? 'Mode compact activé' : 'Mode standard activé');
                    }}
                    className={`w-11 h-6 rounded-full transition p-1 cursor-pointer ${
                      compactTables ? 'bg-sky-500' : 'bg-white/20'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      compactTables ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white">Export automatique des bilans</p>
                    <p className="text-[10px] text-white/50">Archivage hebdomadaire des rapports PDF/CSV</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !autoReportExport;
                      setAutoReportExport(nextVal);
                      void securityService.recordActivity({
                        category: 'system_config',
                        actionType: 'admin_auto_export_toggled',
                        action: 'Modification export automatique des bilans admin',
                        target: 'Export bilans PDF/CSV',
                        targetType: 'settings',
                        entityType: 'admin_settings',
                        space: 'admin',
                        result: 'reussi',
                        severity: 'faible',
                        beforeValue: autoReportExport ? 'Activé' : 'Désactivé',
                        afterValue: nextVal ? 'Activé' : 'Désactivé',
                        details: `Archivage hebdomadaire automatique ${nextVal ? 'activé' : 'désactivé'}`
                      });
                      showToast(nextVal ? 'Export automatique activé' : 'Export automatique désactivé');
                    }}
                    className={`w-11 h-6 rounded-full transition p-1 cursor-pointer ${
                      autoReportExport ? 'bg-sky-500' : 'bg-white/20'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      autoReportExport ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SÉCURITÉ & SURVEILLANCE */}
          {activeSubTab === 'surveillance' && (
            <div className="animate-in fade-in duration-200">
              <AdminSecuritySurveillanceModule />
            </div>
          )}

          {/* TAB: MAINTENANCE & GESTION DES VERSIONS */}
          {activeSubTab === 'maintenance' && (
            <div className="animate-in fade-in duration-200">
              <AdminMaintenanceVersionsModule />
            </div>
          )}

          {/* TAB: SURVEILLANCE TECHNIQUE DU SYSTÈME */}
          {activeSubTab === 'system_surveillance' && (
            <div className="animate-in fade-in duration-200">
              <AdminSystemSurveillanceModule
                onOpenMaintenance={() => setActiveSubTab('maintenance')}
                onOpenNotifications={() => setActiveSubTab('notifications')}
                onOpenAudit={() => setActiveSubTab('audit')}
              />
            </div>
          )}

          {/* TAB: CONFIDENTIALITÉ & PROTECTION DES DONNÉES */}
          {activeSubTab === 'privacy' && (
            <div className="animate-in fade-in duration-200">
              <AdminPrivacyProtectionModule
                onOpenNotifications={() => setActiveSubTab('notifications')}
                onOpenAudit={() => setActiveSubTab('audit')}
              />
            </div>
          )}

          {/* TAB: DÉTECTION DES FRAUDES FINANCIÈRES */}
          {activeSubTab === 'fraud' && (
            <div className="animate-in fade-in duration-200">
              <AdminFinancialFraudModule
                onOpenNotifications={() => setActiveSubTab('notifications')}
                onOpenAudit={() => setActiveSubTab('audit')}
              />
            </div>
          )}

          {/* TAB: SAUVEGARDES & RESTAURATION */}
          {activeSubTab === 'backups' && (
            <div className="animate-in fade-in duration-200">
              <AdminBackupRestoreModule
                onOpenNotifications={() => setActiveSubTab('notifications')}
                onOpenAudit={() => setActiveSubTab('audit')}
              />
            </div>
          )}
        </Suspense>
      </div>

      {/* =========================================================================
          6. MODAL: MODIFIER LE PROFIL ADMIN
          ========================================================================= */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#141414] border border-white/15 w-full max-w-md rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-purple-400" />
                <span>Modifier le profil Super Admin</span>
              </h3>
              <button
                onClick={() => setIsEditProfileOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] text-white/60 font-bold block mb-1">Nom complet</label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold focus:border-purple-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-white/60 font-bold block mb-1">Titre & Fonction</label>
                <input
                  type="text"
                  value={adminRoleTitle}
                  onChange={(e) => setAdminRoleTitle(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold focus:border-purple-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-white/60 font-bold block mb-1">Adresse Email Sécurisée</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold focus:border-purple-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-white/60 font-bold block mb-1">Téléphone d'urgence</label>
                <input
                  type="tel"
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold focus:border-purple-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-white/60 font-bold block mb-1">Notice de mission (Bio)</label>
                <textarea
                  rows={3}
                  value={adminBio}
                  onChange={(e) => setAdminBio(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-medium focus:border-purple-500 outline-none resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black shadow-lg shadow-purple-600/30"
                >
                  Sauvegarder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          7. DRAWER: MENU PARAMÈTRES & CONFIDENTIALITÉ
          ========================================================================= */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex justify-end animate-in fade-in"
          onClick={() => setIsMenuOpen(false)}
        >
          <div 
            className="w-full max-w-sm h-full bg-[#111111] border-l border-white/15 p-5 flex flex-col justify-between overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-400" />
                  <h3 className="text-sm font-black text-white">Paramètres et Sécurité</h3>
                </div>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Menu items */}
              <div className="space-y-1.5 text-xs">
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsEditProfileOpen(true);
                  }}
                  className="w-full p-3 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-between transition text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Edit3 className="w-4 h-4 text-purple-400" />
                    <span className="font-bold text-white">Modifier informations personnelles</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/40" />
                </button>

                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setActiveSubTab('audit');
                  }}
                  className="w-full p-3 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-between transition text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white">Sécurité du compte & Journal</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/40" />
                </button>

                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    setActiveSubTab('audit');
                  }}
                  className="w-full p-3 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-between transition text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-white">Journal d'audit & sessions actives</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/40" />
                </button>

                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    showToast("Base de données synchronisée avec succès !");
                  }}
                  className="w-full p-3 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-between transition text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <Database className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-white">Synchronisation de la base</span>
                  </div>
                  <RotateCw className="w-4 h-4 text-white/40" />
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setShowLogoutConfirm(true);
                }}
                className="w-full py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs font-black text-rose-400 hover:bg-rose-500/20 transition flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Se déconnecter</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          8. MODAL CONFIRMATION DÉCONNEXION
          ========================================================================= */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#161616] border border-white/15 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center">
              <LogOut className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-black text-white">Déconnexion Super Admin</h4>
              <p className="text-xs text-white/60 mt-1">
                Êtes-vous sûr de vouloir vous déconnecter du panneau d'administration Djassa ?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 text-xs font-bold transition"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmLogout}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition shadow-lg shadow-rose-600/30"
              >
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          9. MODAL: INVITER UN MEMBRE ADMIN
          ========================================================================= */}
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#141414] border border-white/15 w-full max-w-md rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-black text-white">Ajouter un Collaborateur Admin</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddMemberModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTeamMember} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[11px] text-white/60 font-bold block mb-1">Nom complet du collaborateur</label>
                <input
                  type="text"
                  placeholder="Ex: Ibrahim Coulibaly"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold focus:border-cyan-400 outline-none placeholder-white/30"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-white/60 font-bold block mb-1">Adresse Email professionnelle</label>
                <input
                  type="email"
                  placeholder="Ex: ibrahim.c@djassa.ci"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold focus:border-cyan-400 outline-none placeholder-white/30"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-white/60 font-bold block mb-1.5">Rôle & Privilèges assignés</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'moderator', title: 'Modérateur KYC', desc: 'Validation marchands & cours' },
                    { id: 'support', title: 'Médiateur Litiges', desc: 'Gestion réclamations & SAV' },
                    { id: 'finance', title: 'Auditeur Finance', desc: 'Surveillance caisse & retraits' },
                    { id: 'super_admin', title: 'Super Admin', desc: 'Contrôle total système' }
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setNewMemberRole(r.id as any)}
                      className={`p-2.5 rounded-xl text-left border transition cursor-pointer ${
                        newMemberRole === r.id
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      <p className="text-xs font-bold">{r.title}</p>
                      <p className="text-[10px] text-white/40 mt-0.5">{r.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddMemberModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black shadow-lg shadow-cyan-500/30"
                >
                  Confirmer l'accès
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
