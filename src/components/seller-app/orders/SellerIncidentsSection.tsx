import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  RotateCcw,
  XCircle,
  Search,
  Plus,
  Camera,
  Phone,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ChevronRight,
  MapPin,
  FileText,
} from 'lucide-react';
import { Order, OrderIncident } from '../../../types';
import {
  formatFCFA,
  formatOrderDate,
  formatOrderTime,
  OrderService,
} from '../../../services/marketServices';
import { IncidentFilter } from './types';

interface Props {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
  onOpenDeclareModal: (preselectedOrderId?: string) => void;
  onContactClient: (phone: string, name: string) => void;
}

export const SellerIncidentsSection: React.FC<Props> = ({
  orders,
  onSelectOrder,
  onOpenDeclareModal,
  onContactClient,
}) => {
  const [filter, setFilter] = useState<IncidentFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  const incidentOrders = useMemo(() => {
    return orders.filter((o) => {
      const isIncidentStatus = ['damaged', 'returned', 'cancelled'].includes(o.status);
      return isIncidentStatus || Boolean(o.incident);
    });
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return incidentOrders.filter((o) => {
      const effectiveType: OrderIncident['type'] =
        o.incident?.type ||
        (o.status === 'damaged' ? 'damaged' : o.status === 'returned' ? 'returned' : 'cancelled');

      if (filter === 'damaged' && effectiveType !== 'damaged') return false;
      if (filter === 'returned' && effectiveType !== 'returned') return false;
      if (filter === 'cancelled' && effectiveType !== 'cancelled') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNum = o.orderNumber.toLowerCase().includes(q);
        const matchClient = o.deliveryAddress.recipientName.toLowerCase().includes(q);
        const matchPhone = o.deliveryAddress.phone.toLowerCase().includes(q);
        const matchCommune = o.deliveryAddress.commune.toLowerCase().includes(q);
        const matchReason = o.incident?.reason?.toLowerCase().includes(q);
        const matchProduct = o.items.some((i) => i.productTitle.toLowerCase().includes(q));
        if (!matchNum && !matchClient && !matchPhone && !matchCommune && !matchReason && !matchProduct) {
          return false;
        }
      }

      return true;
    });
  }, [incidentOrders, filter, searchQuery]);

  const stats = useMemo(() => {
    const damagedCount = incidentOrders.filter(
      (o) => o.status === 'damaged' || o.incident?.type === 'damaged'
    ).length;
    const returnedCount = incidentOrders.filter(
      (o) => o.status === 'returned' || o.incident?.type === 'returned'
    ).length;
    const cancelledCount = incidentOrders.filter(
      (o) => o.status === 'cancelled' || o.incident?.type === 'cancelled'
    ).length;
    const totalAmount = incidentOrders.reduce((sum, o) => sum + (o.total || 0), 0);

    return {
      damagedCount,
      returnedCount,
      cancelledCount,
      totalCount: incidentOrders.length,
      totalAmount,
    };
  }, [incidentOrders]);

  const getLiabilityLabel = (liability?: OrderIncident['liability']) => {
    switch (liability) {
      case 'seller':
        return {
          label: 'Responsabilité : Boutique (Livraison / Emballage)',
          color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
        };
      case 'client':
        return {
          label: 'Responsabilité : Client (Absent / Refus)',
          color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
        };
      default:
        return {
          label: 'Litige en instruction',
          color: 'text-white/60 bg-white/5 border-white/10',
        };
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="p-4 rounded-3xl bg-gradient-to-r from-rose-950/40 via-neutral-900 to-amber-950/20 border border-rose-500/30 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                <span>Signalements, Retours & Litiges Boutique</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                  {stats.totalCount} dossier{stats.totalCount > 1 ? 's' : ''}
                </span>
              </h3>
              <p className="text-[11px] text-white/50">
                Suivi des réclamations clients et incidents déclarés par la boutique
              </p>
            </div>
          </div>

          <button
            onClick={() => onOpenDeclareModal()}
            className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-black text-xs shadow-lg shadow-rose-700/25 transition flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Signaler un litige</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <div
            onClick={() => setFilter('damaged')}
            className={`p-3 rounded-2xl border text-left cursor-pointer transition ${
              filter === 'damaged'
                ? 'bg-rose-500/25 border-rose-500'
                : 'bg-black/40 border-white/10 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-rose-300 uppercase">Colis Endommagés</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <p className="text-lg font-black text-white mt-1 leading-none">{stats.damagedCount}</p>
          </div>

          <div
            onClick={() => setFilter('returned')}
            className={`p-3 rounded-2xl border text-left cursor-pointer transition ${
              filter === 'returned'
                ? 'bg-amber-500/25 border-amber-500'
                : 'bg-black/40 border-white/10 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-amber-300 uppercase">Retours</span>
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <p className="text-lg font-black text-white mt-1 leading-none">{stats.returnedCount}</p>
          </div>

          <div
            onClick={() => setFilter('cancelled')}
            className={`p-3 rounded-2xl border text-left cursor-pointer transition ${
              filter === 'cancelled'
                ? 'bg-red-500/25 border-red-500'
                : 'bg-black/40 border-white/10 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-red-300 uppercase">Réclamations</span>
              <XCircle className="w-3.5 h-3.5 text-red-400" />
            </div>
            <p className="text-lg font-black text-white mt-1 leading-none">{stats.cancelledCount}</p>
          </div>

          <div className="p-3 rounded-2xl bg-black/40 border border-white/10 text-left">
            <span className="text-[9px] font-bold text-white/50 uppercase">Montant concerné</span>
            <p className="text-sm sm:text-base font-black text-[#FF6321] mt-1 font-mono leading-none">
              {formatFCFA(stats.totalAmount)}
            </p>
          </div>
        </div>
      </div>

      {/* SEARCH */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un litige par n°, motif, client, commune..."
            className="w-full p-2.5 pl-10 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-rose-500"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: 'all', label: 'Tous', count: stats.totalCount },
            { id: 'damaged', label: 'Endommagés', count: stats.damagedCount },
            { id: 'returned', label: 'Retours', count: stats.returnedCount },
            { id: 'cancelled', label: 'Annulations / Litiges', count: stats.cancelledCount },
          ].map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as IncidentFilter)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                  active
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/5'
                }`}
              >
                <span>{tab.label}</span>
                <span className="text-[10px] px-1.5 rounded-full font-bold bg-black/25">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* INCIDENTS GRID */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 pt-1">
        {filteredOrders.length === 0 ? (
          <div className="col-span-2 py-16 text-center text-white/40 space-y-3 bg-white/[0.02] border border-white/5 rounded-3xl p-6">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400/40" />
            <div>
              <p className="text-sm font-bold text-white/70">Aucun litige ou retour signalé</p>
              <p className="text-xs text-white/40 mt-1 max-w-sm mx-auto">
                Tout est en ordre sur vos commandes confirmées.
              </p>
            </div>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const incident = order.incident || {
              type: (order.status === 'damaged'
                ? 'damaged'
                : order.status === 'returned'
                ? 'returned'
                : 'cancelled') as OrderIncident['type'],
              reason: 'Incident signalé sur la commande',
              reportedAt: order.createdAt,
              reportedBy: 'seller' as const,
              liability: 'seller' as const,
            };

            const firstItem = order.items[0];
            const liabilityBadge = getLiabilityLabel(incident.liability);

            return (
              <div
                key={order.id}
                id={`incident-card-${order.id}`}
                className="rounded-2xl sm:rounded-3xl bg-[#141414] hover:bg-[#181818] border border-rose-500/20 hover:border-rose-500/40 transition-all flex flex-col justify-between shadow-xl overflow-hidden group"
              >
                <div>
                  <div
                    onClick={() => onSelectOrder(order)}
                    className="relative w-full h-40 sm:h-52 overflow-hidden bg-neutral-900 cursor-pointer"
                  >
                    <img
                      src={
                        firstItem?.productImage ||
                        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'
                      }
                      alt={firstItem?.productTitle || 'Produit concerné'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    <div className="absolute inset-x-0 top-0 p-2 sm:p-3 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-start justify-between gap-1 sm:gap-2">
                      <div className="px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl bg-black/80 backdrop-blur-md border border-white/10 font-mono text-[10px] sm:text-xs font-black text-white">
                        {order.orderNumber}
                      </div>

                      <span className="px-2 py-0.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black border backdrop-blur-md bg-rose-500/30 text-rose-200 border-rose-500/50">
                        {incident.type === 'damaged'
                          ? 'Endommagé'
                          : incident.type === 'returned'
                          ? 'En retour'
                          : 'Litige'}
                      </span>
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-2 sm:p-3 bg-gradient-to-t from-black/95 via-black/50 to-transparent flex items-end justify-between gap-1">
                      {incident.photoProof ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewPhotoUrl(incident.photoProof!);
                          }}
                          className="px-2 py-1 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-[9px] sm:text-[10px] text-white font-black flex items-center gap-1"
                        >
                          <Camera className="w-3 h-3" />
                          <span>Preuve</span>
                        </button>
                      ) : (
                        <span className="text-[9px] text-white/60 bg-black/60 px-1.5 py-0.5 rounded font-medium">
                          {OrderService.getStatusBadge(order.status).label}
                        </span>
                      )}

                      <span className="px-2 py-0.5 rounded-lg bg-black/80 border border-white/15 text-[11px] sm:text-xs font-black text-[#FF6321] font-mono">
                        {formatFCFA(order.total)}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 sm:p-4 space-y-2.5">
                    <div onClick={() => onSelectOrder(order)} className="cursor-pointer">
                      <h4 className="text-xs sm:text-sm font-black text-white line-clamp-1">
                        {firstItem?.productTitle}
                      </h4>
                      <p className="text-[9px] sm:text-[10px] text-white/50 mt-0.5 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5 text-white/40" />
                        <span>
                          {formatOrderDate(incident.reportedAt)} à {formatOrderTime(incident.reportedAt)}
                        </span>
                      </p>
                    </div>

                    <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs">
                      <p className="text-[10px] sm:text-[11px] font-bold text-rose-200 line-clamp-2">
                        {incident.reason}
                      </p>
                    </div>

                    <div className={`px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold border truncate ${liabilityBadge.color}`}>
                      {liabilityBadge.label}
                    </div>

                    {/* Client contact */}
                    <div className="p-2 rounded-xl bg-black/60 border border-white/10 flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={OrderService.getClientAvatar(order)}
                          alt={order.deliveryAddress.recipientName}
                          className="w-7 h-7 rounded-full object-cover border border-cyan-400"
                        />
                        <div className="truncate min-w-0">
                          <span className="text-white font-bold text-[10px] block truncate">
                            {order.deliveryAddress.recipientName}
                          </span>
                          <span className="text-white/40 text-[9px] flex items-center gap-0.5 truncate">
                            <MapPin className="w-2 h-2 text-[#FF6321]" />
                            {order.deliveryAddress.commune}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onContactClient(order.deliveryAddress.phone, order.deliveryAddress.recipientName);
                        }}
                        className="p-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/20"
                      >
                        <Phone className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-2 sm:p-3 bg-black/40 border-t border-white/10 flex items-center gap-1.5">
                  <button
                    onClick={() => onSelectOrder(order)}
                    className="flex-1 py-2 rounded-lg sm:rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-[10px] sm:text-xs transition flex items-center justify-center gap-1"
                  >
                    <FileText className="w-3 h-3 text-[#FF6321]" />
                    <span className="truncate">Détails commande</span>
                  </button>
                  <button
                    onClick={() => onSelectOrder(order)}
                    className="p-2 rounded-lg sm:rounded-xl bg-white/5 hover:bg-white/10 text-white transition"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-[#FF6321]" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {previewPhotoUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-xl w-full bg-neutral-900 border border-white/20 rounded-3xl overflow-hidden shadow-2xl p-2">
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-rose-400" />
                <span>Preuve photographique</span>
              </span>
              <button
                onClick={() => setPreviewPhotoUrl(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-2">
              <img
                src={previewPhotoUrl}
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
