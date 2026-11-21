import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  Phone, 
  RefreshCw, 
  DollarSign, 
  Package, 
  X, 
  ChevronRight, 
  ShieldCheck, 
  Check, 
  Search, 
  RotateCcw, 
  XCircle, 
  MessageSquare, 
  MessageCircle, 
  Camera,
  User, 
  ArrowRight, 
  FileText, 
  Sparkles, 
  ExternalLink, 
  SlidersHorizontal, 
  Send, 
  HelpCircle, 
  Info,
  Plus,
  Copy,
  MapPin,
  Eye,
  ArrowLeft
} from 'lucide-react';
import { BoutiqueIssue, IssuePriority, IssueStatus, ResolutionAction, IssueActivityNote } from './types';
import { Product } from '../../../types';
import { formatFCFA, formatOrderDate, formatOrderTime } from '../../../services/marketServices';
import { useApp } from '../../../context/AppContext';
import { IssueDetailPage } from './IssueDetailPage';

interface Props {
  issues: BoutiqueIssue[];
  products?: Product[];
  onOpenReportModal: () => void;
  onResolveIssue: (
    issueId: string, 
    action: ResolutionAction, 
    details?: {
      notes?: string;
      refundAmount?: number;
      exchangedProductId?: string;
      restockQty?: number;
    }
  ) => void;
  onAddNote?: (issueId: string, noteText: string) => void;
  onClaimDjassaProtection?: (issueId: string) => void;
  onContactClient?: (phone?: string, name?: string) => void;
}

export const IssuesDisputesTab: React.FC<Props> = ({
  issues,
  products = [],
  onOpenReportModal,
  onResolveIssue,
  onAddNote,
  onClaimDjassaProtection,
  onContactClient,
}) => {
  // Main filter state
  const [filter, setFilter] = useState<
    'all' | 'urgent' | 'damaged' | 'returns' | 'claims' | 'stock' | 'cancelled' | 'resolved'
  >('all');
  
  // Search query & Product filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>('all');

  // Selected issue for detail view modal / full page
  const [detailIssue, setDetailIssue] = useState<BoutiqueIssue | null>(null);
  const [detailInternalNote, setDetailInternalNote] = useState('');

  // Selected issue for action resolution modal
  const [activeIssue, setActiveIssue] = useState<BoutiqueIssue | null>(null);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  // In-app discussion integration (No WhatsApp outside communication)
  const { openChatWithClient, navigateToDiscussions, showToast } = useApp();

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return 'Date non renseignée';
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return `${formatOrderDate(dateStr)} • ${formatOrderTime(dateStr)}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const handleCopyRef = (e: React.MouseEvent, refText: string) => {
    e.stopPropagation();
    navigator.clipboard?.writeText?.(refText);
    setCopiedRef(refText);
    showToast?.('Référence copiée dans le presse-papier !');
    setTimeout(() => setCopiedRef(null), 2000);
  };

  // Form states in Action Center Modal
  const [actionType, setActionType] = useState<ResolutionAction>('refunded');
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [selectedExchangeProduct, setSelectedExchangeProduct] = useState<string>('');
  const [resolutionComment, setResolutionComment] = useState('');
  const [newActivityNote, setNewActivityNote] = useState('');

  // Photo preview modal (lightbox)
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string } | null>(null);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = issues.length;
    const urgent = issues.filter(
      (i) => i.priority === 'urgent' && i.status !== 'resolved' && i.status !== 'refunded'
    ).length;
    const damaged = issues.filter((i) => 
      i.type === 'damaged_stock' || 
      i.title.toLowerCase().includes('cass') || 
      i.title.toLowerCase().includes('endommag')
    ).length;
    const returns = issues.filter((i) => 
      ['order_return', 'delivery_issue'].includes(i.type) || 
      i.title.toLowerCase().includes('retour')
    ).length;
    const claims = issues.filter((i) => i.type === 'client_claim').length;
    const stockIssues = issues.filter((i) => 
      ['inventory_shortage', 'factory_defect'].includes(i.type)
    ).length;
    const cancelled = issues.filter((i) => i.type === 'order_cancellation').length;
    const resolved = issues.filter((i) => i.status === 'resolved' || i.status === 'refunded').length;
    
    // Total financial value currently under dispute (excluding already resolved)
    const pendingAmount = issues
      .filter((i) => i.status !== 'resolved' && i.status !== 'refunded')
      .reduce((sum, i) => sum + (i.financialImpact || 0), 0);

    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 100;

    return {
      total,
      urgent,
      damaged,
      returns,
      claims,
      stockIssues,
      cancelled,
      resolved,
      pendingAmount,
      resolutionRate,
    };
  }, [issues]);

  // Filtered issues list
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const isResolved = issue.status === 'resolved' || issue.status === 'refunded';

      // Product filter
      if (selectedProductFilter !== 'all') {
        const prodMatch = issue.productId === selectedProductFilter;
        const targetProd = products.find((p) => p.id === selectedProductFilter);
        const nameMatch = targetProd && issue.productTitle?.toLowerCase().includes(targetProd.name.toLowerCase());
        if (!prodMatch && !nameMatch) return false;
      }

      // Primary tab filter
      if (filter === 'urgent') {
        if (issue.priority !== 'urgent' || isResolved) return false;
      } else if (filter === 'damaged') {
        const isDamaged = issue.type === 'damaged_stock' ||
          issue.title.toLowerCase().includes('cass') ||
          issue.title.toLowerCase().includes('endommag');
        if (!isDamaged) return false;
      } else if (filter === 'returns') {
        const isReturn = ['order_return', 'delivery_issue'].includes(issue.type) ||
          issue.title.toLowerCase().includes('retour');
        if (!isReturn) return false;
      } else if (filter === 'claims') {
        if (issue.type !== 'client_claim') return false;
      } else if (filter === 'stock') {
        if (!['inventory_shortage', 'factory_defect'].includes(issue.type)) return false;
      } else if (filter === 'cancelled') {
        if (issue.type !== 'order_cancellation') return false;
      } else if (filter === 'resolved') {
        if (!isResolved) return false;
      }

      // Search matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchRef = issue.reference?.toLowerCase().includes(q);
        const matchOrder = issue.orderNumber?.toLowerCase().includes(q);
        const matchTitle = issue.title?.toLowerCase().includes(q);
        const matchDesc = issue.description?.toLowerCase().includes(q);
        const matchClient = issue.clientName?.toLowerCase().includes(q) || issue.clientPhone?.includes(q);
        const matchProd = issue.productTitle?.toLowerCase().includes(q);
        if (!matchRef && !matchOrder && !matchTitle && !matchDesc && !matchClient && !matchProd) {
          return false;
        }
      }

      return true;
    });
  }, [issues, filter, searchQuery, selectedProductFilter, products]);

  // Products with active issues summary
  const productsWithIssues = useMemo(() => {
    const map = new Map<string, { product?: Product; title: string; count: number; urgentCount: number }>();
    issues.forEach((issue) => {
      const prod = products.find((p) => p.id === issue.productId || p.name === issue.productTitle);
      const key = prod?.id || issue.productId || issue.productTitle || 'other';
      const existing = map.get(key) || {
        product: prod,
        title: prod?.name || issue.productTitle || 'Produit non spécifié',
        count: 0,
        urgentCount: 0,
      };
      existing.count += 1;
      if (issue.priority === 'urgent' && issue.status !== 'resolved' && issue.status !== 'refunded') {
        existing.urgentCount += 1;
      }
      map.set(key, existing);
    });
    return Array.from(map.entries()).map(([id, data]) => ({ id, ...data }));
  }, [issues, products]);

  // Open Action Center modal with prefilled data
  const handleOpenActionModal = (issue: BoutiqueIssue, defaultAction?: ResolutionAction) => {
    setActiveIssue(issue);
    setActionType(defaultAction || (issue.type === 'order_return' ? 'restocked' : 'refunded'));
    setRefundAmount(issue.financialImpact || 0);
    setSelectedExchangeProduct(issue.productId || products[0]?.id || '');
    setResolutionComment('');
    setNewActivityNote('');
  };

  // Submit resolution from modal
  const handleConfirmResolution = () => {
    if (!activeIssue) return;

    onResolveIssue(activeIssue.id, actionType, {
      notes: resolutionComment.trim() || undefined,
      refundAmount: actionType === 'refunded' ? refundAmount : undefined,
      exchangedProductId: actionType === 'exchanged' ? selectedExchangeProduct : undefined,
      restockQty: actionType === 'restocked' ? 1 : undefined,
    });

    setActiveIssue(null);
  };

  // Add internal activity note
  const handleSendActivityNote = () => {
    if (!activeIssue || !newActivityNote.trim()) return;
    onAddNote?.(activeIssue.id, newActivityNote.trim());
    setNewActivityNote('');
  };

  // Internal Discussion navigation (Strictly within Djassa, no WhatsApp)
  const handleOpenDiscussion = (phone?: string, name?: string, orderNum?: string, title?: string) => {
    if (phone) {
      openChatWithClient(
        phone,
        name || 'Client Djassa',
        orderNum,
        `Bonjour ${name || 'cher client'}, la boutique vous contacte concernant votre réclamation / problème ${orderNum ? '#' + orderNum : ''}${title ? ` ("${title}")` : ''}. Nous prenons votre demande en charge immédiatement sur Djassa.`
      );
    } else {
      navigateToDiscussions();
    }
  };

  // Helper badges
  const getStatusBadge = (status: IssueStatus) => {
    switch (status) {
      case 'pending':
        return { label: 'En attente d\'action', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
      case 'in_progress':
        return { label: 'Traitement en cours', color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' };
      case 'refunded':
        return { label: '✓ Remboursé Wave/OM', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
      case 'resolved':
        return { label: '✓ Litige Résolu', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
      default:
        return { label: 'Statut inconnu', color: 'bg-white/10 text-white/50 border-white/10' };
    }
  };

  const getTypeInfo = (type: string) => {
    switch (type) {
      case 'client_claim':
        return { label: 'Réclamation Client', color: 'text-rose-400 bg-rose-500/10 border-rose-500/25' };
      case 'damaged_stock':
        return { label: 'Colis / Article Cassé', color: 'text-amber-400 bg-amber-500/10 border-amber-500/25' };
      case 'delivery_issue':
        return { label: 'Problème de Livraison', color: 'text-blue-400 bg-blue-500/10 border-blue-500/25' };
      case 'order_return':
        return { label: 'Retour Colis Boutique', color: 'text-purple-400 bg-purple-500/10 border-purple-500/25' };
      case 'order_cancellation':
        return { label: 'Annulation Commande', color: 'text-red-400 bg-red-500/10 border-red-500/25' };
      case 'factory_defect':
        return { label: 'Défaut de Fabrication', color: 'text-orange-400 bg-orange-500/10 border-orange-500/25' };
      case 'inventory_shortage':
        return { label: 'Rupture d\'Inventaire', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25' };
      default:
        return { label: 'Incident Boutique', color: 'text-white/70 bg-white/5 border-white/10' };
    }
  };

  const getPriorityBadge = (priority: IssuePriority) => {
    switch (priority) {
      case 'urgent':
        return { label: '🔴 Urgent', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-black' };
      case 'medium':
        return { label: '🟠 Modéré', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold' };
      case 'low':
      default:
        return { label: '🟢 Faible', color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' };
    }
  };

  const getLiabilityBadge = (liability?: BoutiqueIssue['liability']) => {
    switch (liability) {
      case 'client':
        return { label: 'Responsable : Client (Absent / Refus)', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
      case 'seller':
        return { label: 'Responsable : Boutique (Emballage / Livraison)', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
      default:
        return { label: 'Responsabilité en cours d\'arbitrage', color: 'text-white/50 bg-white/5 border-white/10' };
    }
  };

  return (
    <div id="boutique-issues-tab-hub" className="space-y-4">
      {/* 1. TOP HEADER SUMMARY & KPI METRICS */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-rose-950/40 via-neutral-900 to-black border border-rose-500/30 shadow-2xl space-y-3.5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-white">
                  Centre de Gestion des Problèmes Produits
                </h3>
                {stats.urgent > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-300 font-black text-[10px] border border-rose-500/50 animate-pulse">
                    {stats.urgent} urgent{stats.urgent > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white/60 mt-0.5">
                Gérez retours, articles cassés, remboursements Wave/OM, réclamations et assurance Djassa
              </p>
            </div>
          </div>
        </div>

        {/* 4 Interactive Dashboard Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <div 
            onClick={() => setFilter('urgent')}
            className={`p-3 rounded-2xl border text-left cursor-pointer transition ${
              filter === 'urgent'
                ? 'bg-rose-500/20 border-rose-500 shadow-md shadow-rose-900/20'
                : 'bg-black/50 border-white/10 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-rose-300 uppercase">Urgences à régler</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <p className="text-lg font-black text-white mt-1 leading-none">
              {stats.urgent}
            </p>
            <span className="text-[8px] text-white/40 block mt-1">Nécessite action rapide</span>
          </div>

          <div 
            onClick={() => setFilter('returns')}
            className={`p-3 rounded-2xl border text-left cursor-pointer transition ${
              filter === 'returns'
                ? 'bg-purple-500/20 border-purple-500 shadow-md shadow-purple-900/20'
                : 'bg-black/50 border-white/10 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-purple-300 uppercase">Retours & Non livrés</span>
              <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <p className="text-lg font-black text-white mt-1 leading-none">
              {stats.returns}
            </p>
            <span className="text-[8px] text-purple-300/70 block mt-1">Colis à réintégrer</span>
          </div>

          <div 
            onClick={() => setFilter('damaged')}
            className={`p-3 rounded-2xl border text-left cursor-pointer transition ${
              filter === 'damaged'
                ? 'bg-amber-500/20 border-amber-500 shadow-md shadow-amber-900/20'
                : 'bg-black/50 border-white/10 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-amber-300 uppercase">Casse & Dommages</span>
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-lg font-black text-white mt-1 leading-none">
              {stats.damaged}
            </p>
            <span className="text-[8px] text-emerald-400 block mt-1">Garantie Djassa active</span>
          </div>

          <div className="p-3 rounded-2xl bg-black/50 border border-white/10 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-white/50 uppercase">Montant en Litige</span>
              <DollarSign className="w-3.5 h-3.5 text-[#FF6321]" />
            </div>
            <p className="text-sm sm:text-base font-black text-[#FF6321] mt-1 font-mono leading-none">
              {formatFCFA(stats.pendingAmount)}
            </p>
            <span className="text-[8px] text-white/40 block mt-1">
              Résolution : {stats.resolutionRate}%
            </span>
          </div>
        </div>
      </div>

      {/* 2. SEARCH & DYNAMIC FILTER PILLS */}
      <div className="space-y-2.5">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par n° litige (#LIT-...), commande (#CMD-...), client, produit..."
            className="w-full p-2.5 pl-10 pr-20 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/35 focus:outline-none focus:border-rose-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 px-2 py-0.5 rounded-lg bg-white/10 text-[10px] text-white/60 hover:text-white"
            >
              Effacer
            </button>
          )}
        </div>

        {/* Filter Pills with real counts */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: 'all', label: 'Tous', count: stats.total },
            { id: 'urgent', label: '🔴 Urgents', count: stats.urgent },
            { id: 'damaged', label: '💥 Casse & Avaries', count: stats.damaged },
            { id: 'returns', label: '🔄 Retours Colis', count: stats.returns },
            { id: 'claims', label: '⚖️ Réclamations Clients', count: stats.claims },
            { id: 'stock', label: '📉 Ruptures & Défauts', count: stats.stockIssues },
            { id: 'cancelled', label: '❌ Annulations', count: stats.cancelled },
            { id: 'resolved', label: '🟢 Résolus & Clôturés', count: stats.resolved },
          ].map((pill) => {
            const isActive = filter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setFilter(pill.id as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-rose-600 border-rose-500 text-white shadow-md shadow-rose-600/30'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span>{pill.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive ? 'bg-black/30 text-white' : 'bg-white/10 text-white/50'
                }`}>
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Product Specific Filter Bar */}
        {products.length > 0 && (
          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#FF6321]" />
                <span className="text-xs font-bold text-white">Filtrer par produit concerné :</span>
              </div>
              <select
                id="select-filter-by-product"
                value={selectedProductFilter}
                onChange={(e) => setSelectedProductFilter(e.target.value)}
                className="w-full sm:w-auto min-w-[220px] p-2 rounded-xl bg-[#1c1c1c] border border-white/10 text-xs text-white focus:outline-none focus:border-rose-500 font-medium"
              >
                <option value="all">📦 Tous les produits ({issues.length} incidents)</option>
                {products.map((p) => {
                  const pIssues = issues.filter((i) => i.productId === p.id || i.productTitle?.toLowerCase() === p.name.toLowerCase());
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} ({pIssues.length} incident{pIssues.length > 1 ? 's' : ''})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Quick Chips for Products with active issues */}
            {productsWithIssues.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold shrink-0">
                  Par produit :
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedProductFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 transition ${
                    selectedProductFilter === 'all'
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-white/5 text-white/50 hover:text-white'
                  }`}
                >
                  Tous ({issues.length})
                </button>
                {productsWithIssues.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedProductFilter(item.id)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 transition flex items-center gap-1 border ${
                      selectedProductFilter === item.id
                        ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-sm'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    <span>{item.title}</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[9px]">
                      {item.count}
                    </span>
                    {item.urgentCount > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. ISSUES LIST */}
      {filteredIssues.length === 0 ? (
        <div className="p-10 text-center rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
          <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400/50" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white">Aucun problème trouvé pour cette sélection</h4>
            <p className="text-xs text-white/50 max-w-sm mx-auto">
              {searchQuery || selectedProductFilter !== 'all'
                ? 'Aucun incident ne correspond à vos critères de recherche ou produit sélectionné.'
                : 'Toutes les commandes et marchandises associées sont conformes et sans litige !'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredIssues.map((issue) => {
            const isResolved = issue.status === 'resolved' || issue.status === 'refunded';
            const statusInfo = getStatusBadge(issue.status);
            const typeInfo = getTypeInfo(issue.type);
            const priorityInfo = getPriorityBadge(issue.priority);
            const liabilityInfo = getLiabilityBadge(issue.liability);
            const matchedProduct = products.find(
              (p) => p.id === issue.productId || (issue.productTitle && p.name.toLowerCase() === issue.productTitle.toLowerCase())
            );

            return (
              <div
                key={issue.id}
                id={`issue-card-${issue.id}`}
                className={`rounded-2xl sm:rounded-3xl border transition-all duration-300 shadow-xl overflow-hidden group flex flex-col justify-between ${
                  isResolved
                    ? 'bg-white/[0.03] border-white/10 opacity-80'
                    : issue.priority === 'urgent'
                    ? 'bg-[#141414] hover:bg-[#181818] border-rose-500/40 hover:border-rose-500/60 shadow-rose-950/20'
                    : 'bg-[#141414] hover:bg-[#181818] border-white/10 hover:border-white/20'
                }`}
              >
                <div>
                  {/* 1. LARGE HERO PHOTO WITH OVERLAYS (IDENTIQUE AUX CARTES DE LA PAGE COMMANDES) */}
                  <div 
                    onClick={() => {
                      if (issue.photoProof) {
                        setLightboxPhoto({ url: issue.photoProof, title: issue.title });
                      } else if (issue.productImage) {
                        setLightboxPhoto({ url: issue.productImage, title: issue.productTitle || issue.title });
                      }
                    }}
                    className="relative w-full h-40 sm:h-52 overflow-hidden bg-neutral-900 cursor-pointer"
                  >
                    <img
                      src={
                        issue.photoProof || 
                        issue.productImage || 
                        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'
                      }
                      alt={issue.productTitle || issue.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    {/* Top Gradient Overlay : Reference # avec bouton copier & Badges statut */}
                    <div className="absolute inset-x-0 top-0 p-2 sm:p-3 bg-gradient-to-b from-black/90 via-black/50 to-transparent flex items-start justify-between gap-1.5 sm:gap-2">
                      {/* Référence litige avec bouton Copier */}
                      <div className="flex items-center gap-1 bg-black/75 backdrop-blur-md px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl border border-white/15">
                        <span className="font-mono text-[10px] sm:text-xs font-black text-white">
                          {issue.reference}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleCopyRef(e, issue.reference)}
                          className="text-white/50 hover:text-white transition p-0.5"
                          title="Copier la référence"
                        >
                          {copiedRef === issue.reference ? (
                            <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          )}
                        </button>
                      </div>

                      {/* Badges d'état (Type d'incident, Priorité, Statut d'action) */}
                      <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-end">
                        <span className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black border backdrop-blur-md ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                        <span className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black border backdrop-blur-md ${priorityInfo.color}`}>
                          {priorityInfo.label}
                        </span>
                        <span className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black border backdrop-blur-md ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>

                    {/* Floating pill: Client sur l'image */}
                    {issue.clientName && (
                      <div className="absolute top-10 sm:top-12 left-2 z-10 flex items-center gap-1.5 bg-black/80 backdrop-blur-md px-2 py-0.5 sm:py-1 rounded-full border border-white/20 shadow-lg">
                        <div
                          className="w-5 h-5 sm:w-6 sm:h-6 rounded-full overflow-hidden border border-cyan-400 shrink-0 bg-cyan-950 flex items-center justify-center text-[8px] font-black text-cyan-300"
                          title={`Client: ${issue.clientName}`}
                        >
                          {issue.clientAvatar ? (
                            <img src={issue.clientAvatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            issue.clientName.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <span className="text-[9px] font-bold text-white/80 hidden sm:inline">
                          Client
                        </span>
                      </div>
                    )}

                    {/* Bottom overlay: Photo preuve de dégâts (si dispo) & Montant du litige */}
                    <div className="absolute inset-x-0 bottom-0 p-2 sm:p-3 bg-gradient-to-t from-black/95 via-black/50 to-transparent flex items-end justify-between gap-1 sm:gap-2">
                      <div>
                        {issue.photoProof ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxPhoto({ url: issue.photoProof!, title: issue.title });
                            }}
                            className="px-2 py-1 rounded-lg bg-rose-600/90 hover:bg-rose-500 backdrop-blur-md border border-rose-400 text-[9px] sm:text-[10px] text-white font-black flex items-center gap-1 transition shadow-lg active:scale-95"
                          >
                            <Camera className="w-3 h-3" />
                            <span>Preuve dégâts 📸</span>
                          </button>
                        ) : issue.productTitle ? (
                          <span className="text-[9px] sm:text-[10px] text-white/70 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/10 font-medium truncate max-w-[150px] sm:max-w-xs block">
                            📦 {issue.productTitle}
                          </span>
                        ) : null}
                      </div>

                      {issue.financialImpact > 0 && (
                        <div className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl bg-black/85 backdrop-blur-md border border-white/20 text-right shadow-lg">
                          <span className="text-[11px] sm:text-xs font-black text-[#FF6321] font-mono block">
                            {formatFCFA(issue.financialImpact)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2. CARD ESSENTIAL CONTENT (CALQUÉ SUR SELLER ORDER CARD) */}
                  <div className="p-2.5 sm:p-4 space-y-2 sm:space-y-3">
                    {/* Titre & Date / Heure formatées */}
                    <div>
                      <div className="flex items-start justify-between gap-1.5">
                        <h4 className="text-xs sm:text-sm font-black text-white line-clamp-1 group-hover:text-[#FF6321] transition">
                          {issue.title}
                        </h4>
                        {matchedProduct && (
                          <span className="px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg bg-white/10 text-white/80 font-bold text-[9px] sm:text-[10px] shrink-0">
                            Stock : {matchedProduct.stock}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-1 text-[9px] sm:text-[10px] text-white/50 mt-1">
                        <span className="flex items-center gap-1 text-white/60 truncate">
                          <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#FF6321] shrink-0" />
                          <span className="truncate">{formatDateDisplay(issue.createdAt)}</span>
                        </span>
                        {issue.orderNumber && (
                          <span className="font-mono text-white/60 bg-white/5 px-1.5 sm:px-2 py-0.5 rounded-md border border-white/5 shrink-0">
                            Commande #{issue.orderNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Motif / Description en boîte stylisée callout */}
                    <div className="p-2 sm:p-2.5 rounded-xl bg-black/40 border border-white/5 text-[10px] sm:text-xs text-white/80 leading-relaxed italic">
                      "{issue.description}"
                    </div>

                    {/* CLIENT COMPACT STRIP */}
                    {issue.clientName && (
                      <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-black/40 border border-white/5 space-y-1.5 sm:space-y-2">
                        <div className="flex items-center justify-between gap-1.5 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="relative shrink-0">
                              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full overflow-hidden border border-cyan-400/50 bg-cyan-950 flex items-center justify-center font-bold text-[10px] text-cyan-300">
                                {issue.clientAvatar ? (
                                  <img src={issue.clientAvatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  issue.clientName.slice(0, 2).toUpperCase()
                                )}
                              </div>
                              <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400 border border-black" />
                            </div>
                            <div className="truncate min-w-0">
                              <p className="text-white font-bold text-[10px] sm:text-[11px] truncate">
                                {issue.clientName}
                              </p>
                              <p className="text-white/40 text-[9px] sm:text-[10px] truncate flex items-center gap-0.5">
                                <MapPin className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-[#FF6321] shrink-0" />
                                <span>Client • {issue.clientCommune || 'Abidjan'}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenDiscussion(issue.clientPhone, issue.clientName, issue.orderNumber, issue.title)}
                              className="py-1 px-2 rounded-lg sm:rounded-xl bg-[#FF6321]/15 hover:bg-[#FF6321]/25 text-[#FF6321] border border-[#FF6321]/30 transition flex items-center gap-1 text-[9px] sm:text-[10px] font-bold active:scale-95"
                              title="Discussion avec le client"
                            >
                              <MessageSquare className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                              <span>Discussion</span>
                            </button>
                            {issue.clientPhone && (
                              <button
                                type="button"
                                onClick={() => onContactClient?.(issue.clientPhone, issue.clientName)}
                                className="p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 transition shrink-0"
                                title="Appeler le client"
                              >
                                <Phone className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Liability & Djassa Protection Strip with Détails Button */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border truncate ${liabilityInfo.color}`}>
                          {liabilityInfo.label}
                        </span>

                        {issue.djassaClaimStatus === 'approved' ? (
                          <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            <span className="hidden sm:inline">Assurance Djassa validée ✓</span>
                            <span className="sm:hidden">Djassa ✓</span>
                          </span>
                        ) : issue.djassaClaimStatus === 'claimed' ? (
                          <span className="text-[9px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0">
                            <ShieldAlert className="w-3 h-3 text-amber-400" />
                            <span className="hidden sm:inline">Garantie Djassa en cours</span>
                            <span className="sm:hidden">Garantie...</span>
                          </span>
                        ) : null}
                      </div>

                      {/* Bouton Détails pour voir le problème */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailIssue(issue);
                        }}
                        className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-[10px] sm:text-xs transition flex items-center gap-1.5 border border-white/15 shadow-sm shrink-0"
                        title="Voir tous les détails du problème"
                      >
                        <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#FF6321]" />
                        <span>Détails</span>
                        <ChevronRight className="w-3 h-3 text-white/40" />
                      </button>
                    </div>

                    {/* Already resolved notification if resolved */}
                    {isResolved && (
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-[11px]">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>
                            {issue.resolutionAction === 'refunded'
                              ? 'Client indemnisé et remboursé avec succès.'
                              : issue.resolutionAction === 'exchanged'
                              ? 'Nouvel article expédié en remplacement.'
                              : issue.resolutionAction === 'restocked'
                              ? 'Colis retourné et réintégré dans le stock boutique.'
                              : issue.resolutionAction === 'djassa_guarantee_claimed'
                              ? "Dédommagement garanti par l'assurance Djassa."
                              : 'Incident vérifié et clôturé.'}
                          </span>
                        </div>
                        {issue.resolutionNotes && (
                          <p className="text-[10px] text-white/70 italic pl-5">
                            "{issue.resolutionNotes}"
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. PAGE COMPLÈTE DE DÉTAILS DU PROBLÈME / LITIGE */}
      {detailIssue && (
        <IssueDetailPage
          issue={detailIssue}
          copiedRef={copiedRef}
          onClose={() => setDetailIssue(null)}
          onCopyRef={handleCopyRef}
          onOpenActionModal={handleOpenActionModal}
          onOpenDiscussion={handleOpenDiscussion}
          onContactClient={onContactClient}
          onSetLightboxPhoto={(photo) => setLightboxPhoto(photo)}
          formatDateDisplay={formatDateDisplay}
          getTypeInfo={getTypeInfo}
          getPriorityBadge={getPriorityBadge}
          getStatusBadge={getStatusBadge}
          getLiabilityBadge={getLiabilityBadge}
        />
      )}

      {/* 5. ACTION CENTER MODAL (FULL ISSUE RESOLUTION WORKFLOW) */}
      {activeIssue && (
        <div 
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setActiveIssue(null)}
        >
          <div 
            className="w-full max-w-lg bg-[#141414] border border-white/15 rounded-3xl p-5 space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span>Résolution du litige {activeIssue.reference}</span>
                  </h3>
                  <p className="text-[10px] text-white/50">
                    Choisissez la solution appropriée pour satisfaire le client ou régulariser le stock
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveIssue(null)}
                className="p-1 rounded-full text-white/50 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Issue Summary */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
              <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">
                Motif signalé
              </span>
              <p className="text-xs font-bold text-white">{activeIssue.title}</p>
              <p className="text-[11px] text-white/70 italic">"{activeIssue.description}"</p>
              <div className="flex items-center justify-between text-[10px] text-white/50 pt-1 border-t border-white/5 mt-1">
                <span>Impact financier : {formatFCFA(activeIssue.financialImpact)}</span>
                {activeIssue.orderNumber && <span>Commande #{activeIssue.orderNumber}</span>}
              </div>
            </div>

            {/* Resolution Selector Options */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/90 block">
                Sélectionnez l'action de résolution
              </label>

              <div className="grid grid-cols-2 gap-2">
                {/* 1. Remboursement */}
                <button
                  type="button"
                  onClick={() => setActionType('refunded')}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                    actionType === 'refunded'
                      ? 'bg-rose-500/25 border-rose-500 text-white'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">💰 Rembourser</span>
                    {actionType === 'refunded' && <Check className="w-3.5 h-3.5 text-rose-400" />}
                  </div>
                  <span className="text-[10px] text-white/50 mt-1">
                    Déduit de la caisse boutique
                  </span>
                </button>

                {/* 2. Échange */}
                <button
                  type="button"
                  onClick={() => setActionType('exchanged')}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                    actionType === 'exchanged'
                      ? 'bg-blue-500/25 border-blue-500 text-white'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">🔄 Remplacer</span>
                    {actionType === 'exchanged' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                  </div>
                  <span className="text-[10px] text-white/50 mt-1">
                    Décrémente le stock d'1 unité
                  </span>
                </button>

                {/* 3. Réintégration stock */}
                <button
                  type="button"
                  onClick={() => setActionType('restocked')}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                    actionType === 'restocked'
                      ? 'bg-purple-500/25 border-purple-500 text-white'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">📦 Réintégrer stock</span>
                    {actionType === 'restocked' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                  </div>
                  <span className="text-[10px] text-white/50 mt-1">
                    Colis remis en rayon (+1)
                  </span>
                </button>

                {/* 4. Prise en charge Djassa */}
                <button
                  type="button"
                  onClick={() => setActionType('djassa_guarantee_claimed')}
                  className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                    actionType === 'djassa_guarantee_claimed'
                      ? 'bg-emerald-500/25 border-emerald-500 text-white'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">🛡️ Assurance Djassa</span>
                    {actionType === 'djassa_guarantee_claimed' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <span className="text-[10px] text-white/50 mt-1">
                    Protection boutique activée
                  </span>
                </button>
              </div>
            </div>

            {/* Dynamic settings based on selected actionType */}
            {actionType === 'refunded' && (
              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-rose-400" />
                  Paramètres du remboursement client
                </span>
                <div>
                  <label className="text-[11px] text-white/70 block mb-1">Montant à rembourser (FCFA)</label>
                  <input
                    type="number"
                    min={0}
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(Math.max(0, Number(e.target.value)))}
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono font-bold text-white focus:outline-none focus:border-rose-500"
                  />
                  <span className="text-[10px] text-white/40 block mt-1">
                    Ce montant sera déduit de votre solde caisse et crédité au client sur Wave/OM.
                  </span>
                </div>
              </div>
            )}

            {actionType === 'exchanged' && (
              <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4 text-blue-400" />
                  Sélectionner l'article de rechange en stock
                </span>
                <div>
                  <select
                    value={selectedExchangeProduct}
                    onChange={(e) => setSelectedExchangeProduct(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#1c1c1c] border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stock actuel: {p.stock} unités - {formatFCFA(p.price)})
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-blue-300/80 block mt-1">
                    1 unité sera automatiquement déduite de votre catalogue boutique.
                  </span>
                </div>
              </div>
            )}

            {actionType === 'restocked' && (
              <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-1.5">
                <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <Package className="w-4 h-4" />
                  Confirmation de remise en stock
                </span>
                <p className="text-[11px] text-white/70">
                  Vous confirmez avoir reçu le colis retourné en parfait état. Le stock de l'article 
                  <b> "{activeIssue.productTitle || 'Produit'}"</b> sera réincrémenté de +1 unité.
                </p>
              </div>
            )}

            {actionType === 'djassa_guarantee_claimed' && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1.5">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Garantie Protection Livraisons Djassa
                </span>
                <p className="text-[11px] text-white/70">
                  L'indemnisation éligible de {formatFCFA(activeIssue.financialImpact)} est étudiée par le support DJASSA selon la garantie applicable.
                </p>
              </div>
            )}

            {/* Resolution Comment / Justification */}
            <div>
              <label className="text-xs font-bold text-white/80 block mb-1">
                Commentaire de clôture (justification)
              </label>
              <textarea
                rows={2}
                value={resolutionComment}
                onChange={(e) => setResolutionComment(e.target.value)}
                placeholder="Ex : Remboursement Wave effectué, cliente satisfaite / Colis vérifié en magasin..."
                className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-rose-500 resize-none"
              />
            </div>

            {/* Validation Buttons */}
            <div className="flex gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setActiveIssue(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 text-xs font-bold transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmResolution}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Valider la solution</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. LIGHTBOX MODAL FOR DAMAGE / RETURN PHOTO PROOF */}
      {lightboxPhoto && (
        <div 
          className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div 
            className="max-w-xl w-full bg-[#121212] border border-white/20 rounded-3xl overflow-hidden shadow-2xl p-2 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-2.5 border-b border-white/10">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-rose-400" />
                <span>Photo de preuve : {lightboxPhoto.title}</span>
              </span>
              <button
                onClick={() => setLightboxPhoto(null)}
                className="p-1 rounded-full text-white/60 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-2">
              <img
                src={lightboxPhoto.url}
                alt="Preuve"
                className="w-full max-h-[70vh] object-contain rounded-2xl bg-black"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
