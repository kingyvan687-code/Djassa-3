import React, { useState, useMemo } from 'react';
import {
  Clock,
  Search,
  Filter,
  ShieldCheck,
  DollarSign,
  UserCheck,
  ShoppingBag,
  Layers,
  Download,
  Plus,
  RefreshCw,
  CheckCircle2,
  Calendar,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { AdminAuditLog } from '../../../types';

export const AdminHistorySection: React.FC = () => {
  const { auditLogs, showToast, addAuditLog } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [newLogModalOpen, setNewLogModalOpen] = useState(false);
  const [newAction, setNewAction] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newCategory, setNewCategory] = useState<AdminAuditLog['category']>('financial');
  const [newDetails, setNewDetails] = useState('');

  // Filter logs
  const filteredLogs = useMemo(() => {
    return (auditLogs || []).filter((log) => {
      const matchCategory = selectedCategory === 'all' || log.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        log.action?.toLowerCase().includes(q) ||
        log.target?.toLowerCase().includes(q) ||
        log.adminName?.toLowerCase().includes(q) ||
        log.details?.toLowerCase().includes(q);
      return matchCategory && matchSearch;
    });
  }, [auditLogs, selectedCategory, searchQuery]);

  // Metrics
  const stats = useMemo(() => {
    const total = auditLogs?.length || 0;
    const financial = auditLogs?.filter((l) => l.category === 'financial').length || 0;
    const security = auditLogs?.filter((l) => l.category === 'security').length || 0;
    const users = auditLogs?.filter((l) => l.category === 'user').length || 0;
    const orders = auditLogs?.filter((l) => l.category === 'order').length || 0;
    return { total, financial, security, users, orders };
  }, [auditLogs]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Date & Heure', 'Opérateur', 'Catégorie', 'Action', 'Cible', 'Détails'];
    const rows = (auditLogs || []).map((l) => [
      l.id,
      l.timestamp,
      `"${(l.adminName || '').replace(/"/g, '""')}"`,
      l.category,
      `"${(l.action || '').replace(/"/g, '""')}"`,
      `"${(l.target || '').replace(/"/g, '""')}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Djassa_Historique_Audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('📜 Journal d\'historique exporté en CSV');
  };

  const handleCreateLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAction.trim() || !newTarget.trim()) {
      showToast('⚠️ Veuillez renseigner l\'action et la cible');
      return;
    }

    addAuditLog(newAction.trim(), newTarget.trim(), newCategory, newDetails.trim() || 'Action manuelle enregistrée.');
    showToast('✅ Événement ajouté au journal d\'historique');
    setNewAction('');
    setNewTarget('');
    setNewDetails('');
    setNewLogModalOpen(false);
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'financial':
        return {
          label: 'Finances',
          color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          icon: <DollarSign className="w-3 h-3 text-emerald-400" />
        };
      case 'security':
        return {
          label: 'Sécurité',
          color: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
          icon: <ShieldCheck className="w-3 h-3 text-purple-400" />
        };
      case 'user':
        return {
          label: 'Utilisateurs',
          color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
          icon: <UserCheck className="w-3 h-3 text-cyan-400" />
        };
      case 'order':
        return {
          label: 'Commandes',
          color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          icon: <ShoppingBag className="w-3 h-3 text-amber-400" />
        };
      default:
        return {
          label: 'Système',
          color: 'bg-white/10 text-white/70 border-white/10',
          icon: <Layers className="w-3 h-3 text-white/50" />
        };
    }
  };

  return (
    <div id="admin-history-management-section" className="space-y-4 text-white animate-in fade-in duration-200">
      {/* 1. HERO SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {/* Total Événements */}
        <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-purple-950/40 via-[#151518] to-[#101012] border border-purple-500/30 space-y-1">
          <div className="flex items-center justify-between text-xs text-purple-300">
            <span className="font-bold flex items-center gap-1.5 truncate">
              <Clock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>Total Événements</span>
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">
            {stats.total}
          </div>
          <p className="text-[10px] text-white/50">Actions tracées</p>
        </div>

        {/* Audit Financier */}
        <div className="p-3 sm:p-4 rounded-2xl bg-[#141417] border border-emerald-500/20 space-y-1">
          <div className="flex items-center justify-between text-xs text-emerald-300">
            <span className="font-bold flex items-center gap-1.5 truncate">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Opérations Caisse</span>
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-300 font-mono">
            {stats.financial}
          </div>
          <p className="text-[10px] text-white/50">Commissions & retraits</p>
        </div>

        {/* KYC & Comptes */}
        <div className="p-3 sm:p-4 rounded-2xl bg-[#141417] border border-cyan-500/20 space-y-1">
          <div className="flex items-center justify-between text-xs text-cyan-300">
            <span className="font-bold flex items-center gap-1.5 truncate">
              <UserCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Comptes & KYC</span>
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-cyan-300 font-mono">
            {stats.users}
          </div>
          <p className="text-[10px] text-white/50">Vérifications marchands</p>
        </div>

        {/* Sécurité */}
        <div className="p-3 sm:p-4 rounded-2xl bg-[#141417] border border-purple-500/20 space-y-1">
          <div className="flex items-center justify-between text-xs text-purple-300">
            <span className="font-bold flex items-center gap-1.5 truncate">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>Contrôle & Règles</span>
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-300 font-mono">
            {stats.security}
          </div>
          <p className="text-[10px] text-white/50">Mises à jour système</p>
        </div>
      </div>

      {/* 2. SUBTABS / HORIZONTAL ONGLETS (Exact Seller Boutique & Dashboard Style) */}
      <div className="border-t border-b border-white/10 flex bg-[#0A0A0A]/95 backdrop-blur-md sticky top-12 z-10 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-3.5 py-3 text-xs font-bold flex items-center justify-center gap-2 transition whitespace-nowrap shrink-0 group ${
            selectedCategory === 'all'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-white/45 hover:text-white/75 border-b-2 border-transparent'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Tout ({stats.total})</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedCategory('financial')}
          className={`px-3.5 py-3 text-xs font-bold flex items-center justify-center gap-2 transition whitespace-nowrap shrink-0 group ${
            selectedCategory === 'financial'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-white/45 hover:text-white/75 border-b-2 border-transparent'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Finances & Caisse ({stats.financial})</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedCategory('user')}
          className={`px-3.5 py-3 text-xs font-bold flex items-center justify-center gap-2 transition whitespace-nowrap shrink-0 group ${
            selectedCategory === 'user'
              ? 'text-cyan-400 border-b-2 border-cyan-400'
              : 'text-white/45 hover:text-white/75 border-b-2 border-transparent'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Utilisateurs & KYC ({stats.users})</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedCategory('security')}
          className={`px-3.5 py-3 text-xs font-bold flex items-center justify-center gap-2 transition whitespace-nowrap shrink-0 group ${
            selectedCategory === 'security'
              ? 'text-purple-400 border-b-2 border-purple-400'
              : 'text-white/45 hover:text-white/75 border-b-2 border-transparent'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Sécurité ({stats.security})</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedCategory('order')}
          className={`px-3.5 py-3 text-xs font-bold flex items-center justify-center gap-2 transition whitespace-nowrap shrink-0 group ${
            selectedCategory === 'order'
              ? 'text-amber-400 border-b-2 border-amber-400'
              : 'text-white/45 hover:text-white/75 border-b-2 border-transparent'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Commandes ({stats.orders})</span>
        </button>
      </div>

      {/* 3. CONTROLS: SEARCH & ACTIONS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par action, cible, opérateur ou détails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#141417] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold flex items-center justify-center gap-1.5 transition text-white/80 hover:text-white cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-purple-400" />
            <span>Exporter CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setNewLogModalOpen(true)}
            className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold flex items-center justify-center gap-1.5 transition text-white shadow-lg shadow-purple-950/50 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter Note</span>
          </button>
        </div>
      </div>

      {/* 4. AUDIT TIMELINE LIST */}
      <div className="space-y-2.5">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center bg-[#121316] rounded-2xl border border-white/5 space-y-2">
            <Clock className="w-8 h-8 text-white/20 mx-auto" />
            <p className="text-sm font-semibold text-white/60">Aucun enregistrement trouvé</p>
            <p className="text-xs text-white/30">Essayez de modifier vos filtres ou termes de recherche</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const badge = getCategoryBadge(log.category);
            return (
              <div
                key={log.id}
                className="p-3.5 sm:p-4 rounded-2xl bg-[#141417] border border-white/5 hover:border-purple-500/30 transition group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${badge.color}`}
                    >
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>

                    <h4 className="font-bold text-sm text-white group-hover:text-purple-300 transition truncate">
                      {log.action}
                    </h4>

                    {log.target && (
                      <span className="text-xs font-mono text-white/60 bg-white/5 px-2 py-0.5 rounded-md border border-white/10 shrink-0">
                        → {log.target}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-white/70 leading-relaxed">
                    {log.details}
                  </p>

                  <div className="flex items-center gap-3 text-[10px] text-white/40 pt-0.5">
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3 text-white/30" />
                      {log.timestamp}
                    </span>
                    <span>•</span>
                    <span className="text-purple-300/80 font-medium">
                      Par : {log.adminName || 'Admin Principal'}
                    </span>
                  </div>
                </div>

                <div className="sm:self-center shrink-0">
                  <span className="text-[10px] font-mono px-2 py-1 rounded bg-white/5 text-white/40 border border-white/5">
                    #{log.id}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. ADD LOG MODAL */}
      {newLogModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#151518] border border-white/10 rounded-3xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-base text-white">Ajouter au Journal d'Audit</h3>
              </div>
              <button
                type="button"
                onClick={() => setNewLogModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLog} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-white/70 block mb-1">
                  Catégorie
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full bg-[#101012] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="financial">Finances & Caisse</option>
                  <option value="user">Utilisateurs & KYC</option>
                  <option value="security">Sécurité & Règles</option>
                  <option value="order">Commandes & Litiges</option>
                  <option value="marketplace">Marketplace</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-white/70 block mb-1">
                  Intitulé de l'Action *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Validation manuelle retrait Wave"
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  className="w-full bg-[#101012] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-white/70 block mb-1">
                  Cible / Élément concerné *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Boutique Wax Prestige / Commande #DJ-9433"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  className="w-full bg-[#101012] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-white/70 block mb-1">
                  Détails & Justification
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex: Vérification pièce d'identité effectuée avec succès après échange téléphonique..."
                  value={newDetails}
                  onChange={(e) => setNewDetails(e.target.value)}
                  className="w-full bg-[#101012] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewLogModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white/70"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white shadow-lg shadow-purple-950/50"
                >
                  Enregistrer l'action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
