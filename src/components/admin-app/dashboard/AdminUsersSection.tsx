import React, { useState } from 'react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Store, 
  Search, 
  Filter, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Phone, 
  Mail, 
  MapPin, 
  Sparkles, 
  UserPlus, 
  AlertTriangle,
  ChevronRight,
  Eye,
  RefreshCw,
  ShoppingBag
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { AdminUserRecord } from '../../../types';
import { formatFCFA } from '../../../services/marketServices';
import { AdminUserDetailModal } from '../modals/AdminUserDetailModal';
import { securityService } from '../../../services/securityService';

interface AdminUsersSectionProps {
  onSelectUser?: (user: AdminUserRecord) => void;
}

export const AdminUsersSection: React.FC<AdminUsersSectionProps> = ({ onSelectUser }) => {
  const { 
    adminUsers, 
    verifyUserKyc, 
    toggleUserSuspension, 
    deleteUser, 
    addAuditLog, 
    showToast,
    sellers
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'new' | 'pending_kyc' | 'seller' | 'client'>('all');
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserRecord | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUserData, setNewUserData] = useState({
    name: '',
    role: 'seller' as 'client' | 'seller' | 'admin',
    phone: '+225 ',
    email: '',
    location: 'Adjamé, Abidjan',
    storeName: ''
  });

  // Calculate stats (strictly 3 roles)
  const scopedAdminUsers = adminUsers.filter(u => u.role === 'client' || u.role === 'seller' || u.role === 'admin');
  const totalUsers = scopedAdminUsers.length;
  const pendingKycList = scopedAdminUsers.filter(u => u.status === 'pending_verification' || !u.kycVerified);
  const sellersCount = scopedAdminUsers.filter(u => u.role === 'seller').length;
  
  // "Nouveaux utilisateurs" = Registered recently or with ID user-new-* or marked new
  const isNewUser = (u: AdminUserRecord) => {
    return u.id.includes('new') || u.createdAt.includes('2026-09') || u.status === 'pending_verification';
  };
  const newUsersCount = scopedAdminUsers.filter(isNewUser).length;

  // Filtered users
  const filteredUsers = scopedAdminUsers.filter(u => {
    // Role/Category filter
    if (roleFilter === 'new' && !isNewUser(u)) return false;
    if (roleFilter === 'pending_kyc' && (u.status !== 'pending_verification' && u.kycVerified)) return false;
    if (roleFilter === 'seller' && u.role !== 'seller') return false;
    if (roleFilter === 'client' && u.role !== 'client') return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = u.name.toLowerCase().includes(q);
      const matchPhone = u.phone.toLowerCase().includes(q);
      const matchEmail = u.email.toLowerCase().includes(q);
      const matchStore = u.storeName?.toLowerCase().includes(q);
      const matchLoc = u.location.toLowerCase().includes(q);
      return matchName || matchPhone || matchEmail || matchStore || matchLoc;
    }

    return true;
  });

  const handleValidateKyc = (user: AdminUserRecord) => {
    verifyUserKyc(user.id);
    addAuditLog('Validation KYC', user.name, 'user', `Dossier d'identité validé par l'administrateur.`);
    showToast(`✅ Dossier KYC validé pour ${user.name}`);
    if (selectedUserDetail?.id === user.id) {
      setSelectedUserDetail({ ...user, kycVerified: true, status: 'active' });
    }
  };

  const handleToggleSuspend = (user: AdminUserRecord) => {
    toggleUserSuspension(user.id);
    const willSuspend = user.status === 'active';
    addAuditLog(
      willSuspend ? 'Suspension compte' : 'Réactivation compte', 
      user.name, 
      'security', 
      willSuspend ? 'Compte temporairement bloqué.' : 'Accès réactivé.'
    );
    showToast(willSuspend ? `⚠️ Compte suspendu pour ${user.name}` : `🟢 Compte réactivé pour ${user.name}`);
    if (selectedUserDetail?.id === user.id) {
      setSelectedUserDetail({ ...user, status: willSuspend ? 'suspended' : 'active' });
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserData.name.trim() || !newUserData.phone.trim()) {
      showToast('Veuillez renseigner au moins le nom et le numéro de téléphone.');
      return;
    }

    const newUser: AdminUserRecord = {
      id: `user-new-${Date.now()}`,
      name: newUserData.name.trim(),
      email: newUserData.email.trim() || `${newUserData.name.toLowerCase().replace(/\s+/g, '.')}@djassa.ci`,
      phone: newUserData.phone.trim(),
      role: newUserData.role,
      status: 'active',
      avatar: newUserData.role === 'seller' 
        ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'
        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
      createdAt: '2026-09-12',
      location: newUserData.location.trim() || 'Abidjan',
      ordersCount: 0,
      totalSpentOrEarned: 0,
      kycVerified: true,
      storeName: newUserData.role === 'seller' ? (newUserData.storeName || newUserData.name) : undefined
    };

    // Save user in AppContext state via simulated event
    adminUsers.unshift(newUser);
    localStorage.setItem('djassa_admin_users', JSON.stringify(adminUsers));
    addAuditLog('Création manuelle utilisateur', newUser.name, 'user', `Nouveau compte ${newUser.role} créé.`);
    showToast(`🎉 Nouvel utilisateur créé : ${newUser.name} (${newUser.role})`);
    setShowAddModal(false);
    setNewUserData({
      name: '',
      role: 'seller',
      phone: '+225 ',
      email: '',
      location: 'Adjamé, Abidjan',
      storeName: ''
    });
  };

  return (
    <div id="admin-users-management-section" className="space-y-4">
      {/* HEADER WITH TITLE & ACTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Users className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-black text-white">Gestion des Utilisateurs & Nouveaux Inscrits</h2>
              <p className="text-xs text-white/50">Marchands, acheteurs clients et administrateurs Djassa</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-purple-600/30 transition active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>Créer un compte</span>
        </button>
      </div>

      {/* KPI METRICS OVERVIEW */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div 
          onClick={() => setRoleFilter('all')}
          className={`p-3 rounded-xl border transition cursor-pointer ${
            roleFilter === 'all' ? 'bg-purple-900/30 border-purple-500/40 text-purple-300' : 'bg-white/5 border-white/10 hover:bg-white/10'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-white/50 mb-1">
            <span>Total Comptes</span>
            <Users className="w-3.5 h-3.5 text-white/70" />
          </div>
          <p className="text-lg font-black text-white">{totalUsers}</p>
          <span className="text-[10px] text-white/40">Tous profils</span>
        </div>

        <div 
          onClick={() => setRoleFilter('new')}
          className={`p-3 rounded-xl border transition cursor-pointer ${
            roleFilter === 'new' ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300' : 'bg-white/5 border-white/10 hover:bg-white/10'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-white/50 mb-1">
            <span>Nouveaux Inscrits</span>
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-lg font-black text-emerald-400">+{newUsersCount}</p>
          <span className="text-[10px] text-emerald-400/80 font-bold">Récents</span>
        </div>

        <div 
          onClick={() => setRoleFilter('pending_kyc')}
          className={`p-3 rounded-xl border transition cursor-pointer ${
            roleFilter === 'pending_kyc' ? 'bg-amber-950/40 border-amber-500/50 text-amber-300' : 'bg-white/5 border-white/10 hover:bg-white/10'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-white/50 mb-1">
            <span>En attente KYC</span>
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p className="text-lg font-black text-amber-400">{pendingKycList.length}</p>
          <span className="text-[10px] text-amber-300 font-bold">À vérifier</span>
        </div>

        <div 
          onClick={() => setRoleFilter('seller')}
          className={`p-3 rounded-xl border transition cursor-pointer ${
            roleFilter === 'seller' ? 'bg-orange-950/40 border-orange-500/50 text-orange-300' : 'bg-white/5 border-white/10 hover:bg-white/10'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-white/50 mb-1">
            <span>Boutiques Vendeurs</span>
            <Store className="w-3.5 h-3.5 text-[#FF6321]" />
          </div>
          <p className="text-lg font-black text-white">{sellersCount || sellers.length}</p>
          <span className="text-[10px] text-white/40">Adjamé & Abidjan</span>
        </div>
      </div>

      {/* SEARCH AND FILTER BAR */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par nom, téléphone, boutique, commune..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-purple-500/50 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* ROLE TABS */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              roleFilter === 'all' ? 'bg-purple-600 text-white shadow-md' : 'bg-white/5 text-white/60 hover:text-white'
            }`}
          >
            Tous ({adminUsers.length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('new')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              roleFilter === 'new' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white/5 text-emerald-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Nouveaux ({newUsersCount})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('pending_kyc')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              roleFilter === 'pending_kyc' ? 'bg-amber-600 text-white shadow-md' : 'bg-white/5 text-amber-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            KYC en attente ({pendingKycList.length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('seller')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              roleFilter === 'seller' ? 'bg-[#FF6321] text-white shadow-md' : 'bg-white/5 text-white/60 hover:text-white'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            Vendeurs ({sellersCount || sellers.length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('client')}
            className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              roleFilter === 'client' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white/5 text-white/60 hover:text-white'
            }`}
          >
            Clients
          </button>
        </div>
      </div>

      {/* USER LIST CARDS */}
      <div className="space-y-2.5">
        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/10 space-y-2">
            <Users className="w-8 h-8 text-white/30 mx-auto" />
            <p className="text-sm font-bold text-white">Aucun utilisateur trouvé</p>
            <p className="text-xs text-white/50">Essayez un autre mot-clé ou réinitialisez les filtres.</p>
          </div>
        ) : (
          filteredUsers.map((user) => {
            const isPending = user.status === 'pending_verification' || !user.kycVerified;
            const isSuspended = user.status === 'suspended';
            const isNew = isNewUser(user);

            return (
              <div
                key={user.id}
                className={`p-3.5 rounded-2xl border transition ${
                  isSuspended 
                    ? 'bg-rose-950/20 border-rose-500/20 opacity-80' 
                    : isPending
                    ? 'bg-amber-950/20 border-amber-500/30'
                    : 'bg-white/5 border-white/10 hover:border-purple-500/30'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* USER INFO */}
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-11 h-11 rounded-full object-cover border border-white/10"
                      />
                      {user.role === 'seller' && (
                        <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#FF6321] text-white flex items-center justify-center text-[10px]">
                          <Store className="w-3 h-3" />
                        </span>
                      )}
                      {user.role === 'admin' && (
                        <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center text-[10px]">
                          <ShieldCheck className="w-3 h-3" />
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{user.name}</span>
                        {isNew && (
                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[9px] font-black border border-emerald-500/30">
                            NOUVEAU
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                          user.role === 'seller' ? 'bg-[#FF6321]/20 text-[#FF6321]' :
                          user.role === 'admin' ? 'bg-purple-500/20 text-purple-300' :
                          'bg-white/10 text-white/70'
                        }`}>
                          {user.role === 'seller' ? 'Marchand' : user.role === 'admin' ? 'Admin' : 'Client'}
                        </span>

                        {isPending ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-bold border border-amber-500/30">
                            KYC En attente
                          </span>
                        ) : isSuspended ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[9px] font-bold border border-rose-500/30">
                            Suspendu
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">
                            Actif
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/50">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-white/40" />
                          {user.phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-white/40" />
                          {user.location}
                        </span>
                        {user.storeName && (
                          <span className="text-purple-300 font-medium">
                            Boutique: {user.storeName}
                          </span>
                        )}
                      </div>

                      {user.ordersCount !== undefined && (
                        <div className="text-[10px] text-white/40 pt-0.5">
                          {user.role === 'client' ? 'Commandes effectuées' : 'Ventes'}: <span className="text-white font-bold">{user.ordersCount}</span> • Volume: <span className="text-emerald-400 font-bold">{formatFCFA(user.totalSpentOrEarned || 0)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* QUICK ACTIONS BUTTONS */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    {isPending && (
                      <button
                        type="button"
                        onClick={() => handleValidateKyc(user)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition active:scale-95"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Valider KYC
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleSuspend(user)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition ${
                        isSuspended 
                          ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30' 
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-300 hover:bg-rose-500/20'
                      }`}
                    >
                      {isSuspended ? 'Réactiver' : 'Suspendre'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUserDetail(user);
                        void securityService.recordActivity({
                          category: 'admin_mgmt',
                          action: `Consultation dossier utilisateur (${user.name})`,
                          actionType: 'admin_view_user_dossier',
                          target: user.email || user.id,
                          targetType: 'account',
                          entityType: 'user',
                          entityId: user.id,
                          space: 'admin',
                          result: 'reussi',
                          severity: 'information',
                          details: `Ouverture dossier ${user.role} — ${user.name}`
                        });
                      }}
                      className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs transition"
                      title="Voir détails"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* USER DETAIL MODAL */}
      {selectedUserDetail && (
        <AdminUserDetailModal
          user={selectedUserDetail}
          onClose={() => setSelectedUserDetail(null)}
        />
      )}

      {/* CREATE USER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#121212] border border-purple-500/30 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Nouveau Compte Utilisateur</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-white/70 mb-1">Rôle</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['seller', 'client', 'admin'] as const).map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setNewUserData({ ...newUserData, role: r })}
                      className={`py-2 rounded-xl text-xs font-bold capitalize transition border ${
                        newUserData.role === r
                          ? 'bg-purple-600 text-white border-purple-500'
                          : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {r === 'seller' ? 'Marchand' : r === 'admin' ? 'Admin' : 'Client'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-white/70 mb-1">Nom complet *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Kouamé Jean-Marc"
                  value={newUserData.name}
                  onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1">Téléphone *</label>
                  <input
                    type="text"
                    required
                    placeholder="+225 07..."
                    value={newUserData.phone}
                    onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/70 mb-1">Commune / Zone</label>
                  <input
                    type="text"
                    placeholder="Adjamé, Cocody..."
                    value={newUserData.location}
                    onChange={(e) => setNewUserData({ ...newUserData, location: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {newUserData.role === 'seller' && (
                <div>
                  <label className="block text-xs font-bold text-[#FF6321] mb-1">Nom de la boutique</label>
                  <input
                    type="text"
                    placeholder="Ex: Wax & Élégance Marché Adjamé"
                    value={newUserData.storeName}
                    onChange={(e) => setNewUserData({ ...newUserData, storeName: e.target.value })}
                    className="w-full px-3 py-2 bg-white/5 border border-[#FF6321]/30 rounded-xl text-xs text-white focus:outline-none focus:border-[#FF6321]"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-purple-600/30"
                >
                  Créer et Valider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
