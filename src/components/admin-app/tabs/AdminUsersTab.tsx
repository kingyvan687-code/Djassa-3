import React, { useState, useMemo } from 'react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Store, 
  User, 
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
  ShoppingBag,
  Ban,
  MessageSquare,
  Trash2,
  Copy,
  Check,
  CheckCheck,
  SlidersHorizontal,
  ArrowUpDown
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { AdminUserRecord, AdminTabType } from '../../../types';
import { formatFCFA } from '../../../services/marketServices';
import { securityService } from '../../../services/securityService';
import { AdminUserDetailModal } from '../modals/AdminUserDetailModal';
import { AdminAddUserModal } from '../modals/AdminAddUserModal';

interface AdminUsersTabProps {
  onNavigateTab?: (tab: AdminTabType) => void;
}

type UserFilterCategory = 'all' | 'pending_kyc' | 'sellers' | 'clients' | 'suspended';
type SortOption = 'recent' | 'name' | 'revenue' | 'orders';

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({ onNavigateTab }) => {
  const { 
    adminUsers, 
    verifyUserKyc, 
    toggleUserSuspension, 
    deleteUser, 
    showToast,
    setActiveConversationId
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<UserFilterCategory>('all');
  const [communeFilter, setCommuneFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  
  // Modals state
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserRecord | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AdminUserRecord | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  // Exclude Super Admin profile card (user-admin-1) from the users management list
  const visibleUsers = useMemo(() => {
    return adminUsers.filter(u => u.id !== 'user-admin-1');
  }, [adminUsers]);

  // Quick stats (strictly 3 roles: client, seller, admin)
  const scopedUsers = useMemo(
    () => visibleUsers.filter((u) => u.role === 'client' || u.role === 'seller' || u.role === 'admin'),
    [visibleUsers]
  );
  const totalCount = scopedUsers.length;
  const pendingKycUsers = useMemo(() => {
    return scopedUsers.filter(u => u.status === 'pending_verification' || !u.kycVerified);
  }, [scopedUsers]);
  const sellersCount = useMemo(() => scopedUsers.filter(u => u.role === 'seller').length, [scopedUsers]);
  const clientsCount = useMemo(() => scopedUsers.filter(u => u.role === 'client').length, [scopedUsers]);
  const suspendedCount = useMemo(() => scopedUsers.filter(u => u.status === 'suspended').length, [scopedUsers]);

  // List of unique communes for filter dropdown
  const availableCommunes = useMemo(() => {
    const set = new Set<string>();
    adminUsers.forEach(u => {
      if (u.location) {
        const clean = u.location.split(',')[0].trim();
        if (clean) set.add(clean);
      }
    });
    return Array.from(set);
  }, [adminUsers]);

  // Copy helper
  const handleCopy = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    navigator.clipboard?.writeText?.(text);
    setCopiedPhone(text);
    showToast(`Numéro ${text} copié ! 📋`);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  // Direct Contact via Discussions tab
  const handleOpenChatWithUser = (user: AdminUserRecord) => {
    setActiveConversationId(`aconv-${user.role}-${user.id}`);
    onNavigateTab?.('discussions');
    showToast(`Ouverture de la messagerie avec ${user.name} 💬`);
  };

  const handleInspectUser = (user: AdminUserRecord) => {
    setSelectedUserDetail(user);
    void securityService.recordActivity({
      category: 'admin_mgmt',
      actionType: 'admin_user_inspected',
      action: `Consultation fiche compte utilisateur (${user.name})`,
      target: `${user.name} (${user.email || user.phone})`,
      targetType: 'account',
      entityType: 'account',
      entityId: user.id,
      space: 'admin',
      result: 'reussi',
      severity: 'information',
      details: `Consultation du dossier compte (${user.role} • statut ${user.status})`
    });
  };

  // Filtered & sorted users
  const filteredUsers = useMemo(() => {
    return scopedUsers
      .filter((u) => {
        // Category filter
        if (filterCategory === 'pending_kyc' && (u.status !== 'pending_verification' && u.kycVerified)) return false;
        if (filterCategory === 'sellers' && u.role !== 'seller') return false;
        if (filterCategory === 'clients' && u.role !== 'client') return false;
        if (filterCategory === 'suspended' && u.status !== 'suspended') return false;

        // Commune filter
        if (communeFilter !== 'all') {
          if (!u.location || !u.location.toLowerCase().includes(communeFilter.toLowerCase())) return false;
        }

        // Search text
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = u.name.toLowerCase().includes(q);
          const matchPhone = u.phone.toLowerCase().includes(q);
          const matchEmail = u.email.toLowerCase().includes(q);
          const matchStore = u.storeName?.toLowerCase().includes(q);
          const matchLoc = u.location.toLowerCase().includes(q);
          const matchRole = u.role.toLowerCase().includes(q);
          if (!matchName && !matchPhone && !matchEmail && !matchStore && !matchLoc && !matchRole) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'revenue') return (b.totalSpentOrEarned || 0) - (a.totalSpentOrEarned || 0);
        if (sortBy === 'orders') return (b.ordersCount || 0) - (a.ordersCount || 0);
        // 'recent' default
        return (b.registeredDaysAgo ?? 999) - (a.registeredDaysAgo ?? 999);
      });
  }, [scopedUsers, filterCategory, communeFilter, searchQuery, sortBy]);

  return (
    <div id="admin-users-page-root" className="w-full h-full flex flex-col bg-[#0A0A0A] text-white select-none overflow-y-auto no-scrollbar pb-24">
      <div className="max-w-7xl mx-auto w-full p-3 sm:p-5 space-y-4">
        {/* 2. KPI METRICS CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Card: Total */}
          <div 
            onClick={() => setFilterCategory('all')}
            className={`col-span-full p-3 rounded-2xl border transition cursor-pointer ${
              filterCategory === 'all' 
                ? 'bg-purple-950/40 border-purple-500 shadow-md shadow-purple-500/10' 
                : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
            }`}
          >
            <div className="flex items-center justify-between text-white/50 mb-1">
              <span className="text-[11px] font-bold">Total Inscrits</span>
              <Users className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <p className="text-xl font-black text-white">{totalCount}</p>
            <p className="text-[9px] text-white/40 mt-0.5">Tous les profils</p>
          </div>

          {/* Card: Pending KYC */}
          <div 
            onClick={() => setFilterCategory('pending_kyc')}
            className={`p-3 rounded-2xl border transition cursor-pointer relative overflow-hidden ${
              filterCategory === 'pending_kyc' 
                ? 'bg-amber-950/40 border-amber-500 shadow-md shadow-amber-500/10' 
                : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
            }`}
          >
            {pendingKycUsers.length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
            <div className="flex items-center justify-between text-white/50 mb-1">
              <span className="text-[11px] font-bold text-amber-300">KYC en Attente</span>
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-xl font-black text-amber-400">{pendingKycUsers.length}</p>
            <p className="text-[9px] text-amber-300/70 mt-0.5">Vérification requise</p>
          </div>

          {/* Card: Sellers */}
          <div 
            onClick={() => setFilterCategory('sellers')}
            className={`p-3 rounded-2xl border transition cursor-pointer ${
              filterCategory === 'sellers' 
                ? 'bg-amber-950/40 border-[#FF6321] shadow-md shadow-[#FF6321]/10' 
                : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
            }`}
          >
            <div className="flex items-center justify-between text-white/50 mb-1">
              <span className="text-[11px] font-bold">Vendeurs</span>
              <Store className="w-3.5 h-3.5 text-[#FF6321]" />
            </div>
            <p className="text-xl font-black text-white">{sellersCount}</p>
            <p className="text-[9px] text-white/40 mt-0.5">Boutiques actives</p>
          </div>

          {/* Card: Clients */}
          <div 
            onClick={() => setFilterCategory('clients')}
            className={`p-3 rounded-2xl border transition cursor-pointer ${
              filterCategory === 'clients' 
                ? 'bg-emerald-950/40 border-emerald-400 shadow-md shadow-emerald-400/10' 
                : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
            }`}
          >
            <div className="flex items-center justify-between text-white/50 mb-1">
              <span className="text-[11px] font-bold">Clients</span>
              <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <p className="text-xl font-black text-white">{clientsCount}</p>
            <p className="text-[9px] text-white/40 mt-0.5">Acheteurs Djassa</p>
          </div>

          {/* Card: Suspended */}
          <div 
            onClick={() => setFilterCategory('suspended')}
            className={`p-3 rounded-2xl border transition cursor-pointer ${
              filterCategory === 'suspended' 
                ? 'bg-rose-950/40 border-rose-500 shadow-md shadow-rose-500/10' 
                : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
            }`}
          >
            <div className="flex items-center justify-between text-white/50 mb-1">
              <span className="text-[11px] font-bold text-rose-300">Suspendus</span>
              <Ban className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <p className="text-xl font-black text-rose-400">{suspendedCount}</p>
            <p className="text-[9px] text-rose-300/70 mt-0.5">Accès restreints</p>
          </div>
        </div>

        {/* 4. SEARCH & FILTER CONTROLS */}
        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher par nom, téléphone (+225...), email, boutique, commune..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#161616] text-xs text-white placeholder-white/40 border border-white/10 focus:outline-none focus:ring-1 focus:ring-purple-400/50 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs font-bold"
              >
                Effacer
              </button>
            )}
          </div>
        </div>

        {/* 5. USER LIST / CARDS */}
        {filteredUsers.length === 0 ? (
          <div className="py-16 text-center text-white/40 space-y-3 bg-white/[0.02] border border-white/5 rounded-3xl p-8">
            <Users className="w-12 h-12 mx-auto text-white/20" />
            <p className="text-sm font-bold text-white/60">Aucun utilisateur ne correspond à ces critères</p>
            <p className="text-xs text-white/40 max-w-sm mx-auto">
              Modifiez vos filtres de recherche ou réinitialisez la sélection pour afficher tous les profils.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterCategory('all');
                setCommuneFilter('all');
              }}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((user) => {
              const isKycPending = user.status === 'pending_verification' || !user.kycVerified;
              const isSuspended = user.status === 'suspended';

              const roleLabel = {
                seller: 'Marchand',
                client: 'Client Acheteur',
                admin: 'Super Admin'
              }[user.role] || user.role;

              const roleBadgeColor = {
                seller: 'bg-[#FF6321]/20 text-[#FF6321] border-[#FF6321]/40',
                client: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                admin: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              }[user.role] || 'bg-white/10 text-white/70 border-white/20';

              const RoleIcon = {
                seller: Store,
                client: User,
                admin: ShieldCheck
              }[user.role] || User;

              return (
                <div
                  key={user.id}
                  id={`admin-user-card-${user.id}`}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-150 bg-[#121212] hover:bg-[#161616] flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isSuspended
                      ? 'border-rose-500/40 opacity-75'
                      : isKycPending
                      ? 'border-amber-500/40 shadow-sm shadow-amber-500/5'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Left: Avatar & Identity details */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                    {/* Avatar with Role Badge & Online indicator */}
                    <div className="relative shrink-0">
                      <img
                        src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                        alt={user.name}
                        className="w-13 h-13 rounded-2xl object-cover border border-white/10 shadow-sm"
                      />
                      <div className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-lg flex items-center justify-center border border-black shadow-sm ${roleBadgeColor}`}>
                        <RoleIcon className="w-3 h-3" />
                      </div>
                      {!isSuspended && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#25D366] border-2 border-[#121212]" title="En ligne" />
                      )}
                    </div>

                    {/* Metadata column */}
                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Name + Verified + Badges */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="text-sm font-bold text-white truncate hover:text-purple-300 cursor-pointer" onClick={() => handleInspectUser(user)}>
                          {user.name}
                        </h3>
                        {user.kycVerified && (
                          <span title="Identité certifiée KYC">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                          </span>
                        )}

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${roleBadgeColor}`}>
                          {roleLabel}
                        </span>

                        {isSuspended ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 shrink-0 flex items-center gap-1">
                            <Ban className="w-3 h-3" />
                            <span>Suspendu</span>
                          </span>
                        ) : isKycPending ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>KYC en attente</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                            Actif
                          </span>
                        )}
                      </div>

                      {/* Location */}
                      {user.location && (
                        <div className="flex items-center gap-1 text-xs text-white/50">
                          <MapPin className="w-3 h-3 text-white/40" />
                          <span>{user.location}</span>
                        </div>
                      )}

                      {/* Date d'inscription */}
                      <div className="text-[11px] text-white/40 pt-0.5">
                        <span>Inscrit : {user.createdAt || 'Récemment'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Quick Action Controls */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/5 justify-end">
                    {/* KYC Quick Validate Button */}
                    {isKycPending && (
                      <button
                        type="button"
                        onClick={() => verifyUserKyc(user.id)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1 shadow-md transition active:scale-95"
                        title="Valider immédiatement le dossier KYC"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Valider KYC</span>
                      </button>
                    )}

                    {/* Suspension Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleUserSuspension(user.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1 transition active:scale-95 ${
                        isSuspended
                          ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                          : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                      }`}
                      title={isSuspended ? 'Réactiver le compte' : 'Suspendre le compte'}
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>{isSuspended ? 'Réactiver' : 'Suspendre'}</span>
                    </button>

                    {/* Open Direct Discussion */}
                    <button
                      type="button"
                      onClick={() => handleOpenChatWithUser(user)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-purple-600/20 text-white/70 hover:text-purple-300 border border-white/10 transition active:scale-95"
                      title="Envoyer un message officiel"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>

                    {/* Inspect Full Profile Modal */}
                    <button
                      type="button"
                      onClick={() => handleInspectUser(user)}
                      className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-bold flex items-center gap-1 transition active:scale-95"
                      title="Inspecter le profil complet et l'activité"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspecter</span>
                    </button>

                    {/* Delete User */}
                    {user.role !== 'admin' && (
                      <button
                        type="button"
                        onClick={() => setUserToDelete(user)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 border border-white/10 transition active:scale-95"
                        title="Supprimer définitivement l'utilisateur"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. MODAL DETAILS UTILISATEUR */}
      {selectedUserDetail && (
        <AdminUserDetailModal
          user={selectedUserDetail}
          onClose={() => setSelectedUserDetail(null)}
          onNavigateTab={onNavigateTab}
        />
      )}

      {/* 7. MODAL AJOUT UTILISATEUR */}
      {isAddModalOpen && (
        <AdminAddUserModal
          onClose={() => setIsAddModalOpen(false)}
        />
      )}

      {/* 8. CONFIRMATION DE SUPPRESSION */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
          <div className="w-full max-w-md bg-[#161616] border border-rose-500/40 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Confirmer la suppression</h3>
                <p className="text-xs text-rose-300/80">Cette action est irréversible.</p>
              </div>
            </div>

            <p className="text-xs text-white/70 leading-relaxed">
              Voulez-vous vraiment supprimer le compte de <strong className="text-white">{userToDelete.name}</strong> ({userToDelete.email || userToDelete.phone}) ? Toutes ses données associées seront supprimées.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteUser(userToDelete.id);
                  setUserToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition active:scale-95"
              >
                Supprimer le compte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
