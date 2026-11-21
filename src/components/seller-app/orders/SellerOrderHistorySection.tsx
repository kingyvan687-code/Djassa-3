import React, { useState, useMemo } from 'react';
import {
  History,
  Calendar,
  Search,
  CheckCircle2,
  MapPin,
  Receipt,
  Printer,
  PackageCheck,
  Wallet,
  ChevronRight,
  CreditCard,
  Banknote,
} from 'lucide-react';
import { Order } from '../../../types';
import {
  formatFCFA,
  formatOrderDate,
  formatOrderTime,
  OrderService,
} from '../../../services/marketServices';

interface Props {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
  onOpenReceipt: (order: Order) => void;
}

export const SellerOrderHistorySection: React.FC<Props> = ({
  orders,
  onSelectOrder,
  onOpenReceipt,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'online' | 'cod'>('all');

  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        const mode = o.paymentMode || (o.paymentMethod === 'cash_on_delivery' ? 'cod' : 'online');
        if (paymentFilter === 'online' && mode !== 'online') return false;
        if (paymentFilter === 'cod' && mode !== 'cod') return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchNum = o.orderNumber.toLowerCase().includes(q);
          const matchClient = o.deliveryAddress.recipientName.toLowerCase().includes(q);
          const matchCommune = o.deliveryAddress.commune.toLowerCase().includes(q);
          const matchPhone = o.deliveryAddress.phone.toLowerCase().includes(q);
          const matchProduct = o.items.some((i) => i.productTitle.toLowerCase().includes(q));
          if (!matchNum && !matchClient && !matchCommune && !matchPhone && !matchProduct) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => b.id.localeCompare(a.id));
  }, [orders, searchQuery, paymentFilter]);

  const groupedOrders = useMemo(() => {
    const groups: { [dateLabel: string]: Order[] } = {};
    filteredOrders.forEach((o) => {
      const dateLabel = formatOrderDate(o.createdAt);
      if (!groups[dateLabel]) groups[dateLabel] = [];
      groups[dateLabel].push(o);
    });
    return Object.entries(groups);
  }, [filteredOrders]);

  const analytics = useMemo(() => {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => {
      const sub = Math.max(0, (o.subtotal || 0) - (o.discount || 0));
      const comm = o.commissionFcfa ?? 150;
      return sum + (o.sellerNetFcfa ?? Math.max(0, sub - comm));
    }, 0);
    const avgBasket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const onlineCount = orders.filter(
      (o) => (o.paymentMode || (o.paymentMethod === 'cash_on_delivery' ? 'cod' : 'online')) === 'online'
    ).length;

    return { totalOrders, totalRevenue, avgBasket, onlineCount };
  }, [orders]);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* 1. HISTORY HEADER & METRICS BANNER */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-neutral-900 via-[#181818] to-neutral-900 border border-white/10 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-[#FF6321]/20 border border-[#FF6321]/30 text-[#FF6321]">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                <span>Archives & Historique des Ventes</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/80 font-bold border border-white/10">
                  {analytics.totalOrders} au total
                </span>
              </h3>
              <p className="text-[11px] text-white/50">
                Journal chronologique de vos commandes confirmées, paiements et reçus vendeurs
              </p>
            </div>
          </div>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 hover:text-white font-bold text-xs transition flex items-center gap-1.5"
            title="Imprimer l'historique"
          >
            <Printer className="w-3.5 h-3.5 text-[#FF6321]" />
            <span>Imprimer</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="relative overflow-hidden p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#1C130D] via-neutral-900 to-black border border-[#FF6321]/30 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1 min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-[#FF6321]">
                  Total Commandes Confirmées
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white font-mono">
                    {analytics.totalOrders}
                  </span>
                  <span className="text-xs font-bold text-white/70">
                    ({analytics.onlineCount} en ligne)
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Livraison gérée par la boutique</span>
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#FF6321]/15 border border-[#FF6321]/30 flex items-center justify-center text-[#FF6321] shrink-0">
                <PackageCheck className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#0D1C14] via-neutral-900 to-black border border-emerald-500/30 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1 min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
                  Revenus Nets Vendeur
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono truncate">
                    {formatFCFA(analytics.totalRevenue)}
                  </span>
                </div>
                <span className="text-[10px] text-white/50 block">
                  Après commission DJASSA (150 F / cmd) • Panier moyen : {formatFCFA(analytics.avgBasket)}
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Wallet className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SEARCH & FILTERS */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher (N° commande, client, article, commune...)"
            className="w-full p-2.5 pl-10 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: 'all', label: 'Toutes les commandes', count: orders.length },
            { id: 'online', label: 'Paiement en ligne', count: analytics.onlineCount },
            { id: 'cod', label: 'Paiement à la livraison', count: orders.length - analytics.onlineCount },
          ].map((tab) => {
            const active = paymentFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setPaymentFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                  active
                    ? 'bg-[#FF6321] text-white shadow-md shadow-orange-600/30'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/5'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 rounded-full font-bold ${
                    active ? 'bg-black/30 text-white' : 'bg-white/10 text-white/50'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. CHRONOLOGICAL GROUPS */}
      {groupedOrders.length === 0 ? (
        <div className="py-16 text-center text-white/40 space-y-3 bg-white/[0.02] border border-white/5 rounded-3xl p-6">
          <History className="w-12 h-12 mx-auto text-white/20" />
          <p className="text-sm font-bold text-white/70">Aucune commande trouvée dans les archives</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedOrders.map(([dateLabel, dateOrders]) => (
            <div key={dateLabel} className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <div className="flex items-center gap-1.5 text-xs font-black text-white/80 uppercase tracking-wider bg-white/5 px-2.5 py-1 rounded-xl border border-white/10">
                  <Calendar className="w-3.5 h-3.5 text-[#FF6321]" />
                  <span>{dateLabel}</span>
                </div>
                <div className="h-[1px] flex-1 bg-white/10" />
                <span className="text-[10px] text-white/40 font-bold">
                  {dateOrders.length} commande{dateOrders.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                {dateOrders.map((order) => {
                  const statusBadge = OrderService.getStatusBadge(order.status);
                  const mode =
                    order.paymentMode ||
                    (order.paymentMethod === 'cash_on_delivery' ? 'cod' : 'online');
                  const payBadge = OrderService.getPaymentStatusBadge(order.paymentStatus, mode);
                  const firstItem = order.items[0];
                  const sub = Math.max(0, (order.subtotal || 0) - (order.discount || 0));
                  const comm = order.commissionFcfa ?? 150;
                  const netSeller = order.sellerNetFcfa ?? Math.max(0, sub - comm);

                  return (
                    <div
                      key={order.id}
                      id={`history-order-card-${order.id}`}
                      className="rounded-2xl sm:rounded-3xl bg-[#141414] hover:bg-[#181818] border border-white/10 hover:border-white/25 transition-all flex flex-col justify-between shadow-xl overflow-hidden group"
                    >
                      <div>
                        <div
                          onClick={() => onSelectOrder(order)}
                          className="relative w-full h-36 sm:h-52 overflow-hidden bg-neutral-900 cursor-pointer"
                        >
                          <img
                            src={
                              firstItem?.productImage ||
                              'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'
                            }
                            alt={firstItem?.productTitle}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />

                          <div className="absolute inset-x-0 top-0 p-2 sm:p-3 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-start justify-between gap-1">
                            <span className="px-1.5 sm:px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 font-mono text-[10px] sm:text-xs font-black text-white">
                              {order.orderNumber}
                            </span>

                            <span
                              className={`px-2 py-0.5 rounded-lg text-[9px] sm:text-[10px] font-black border backdrop-blur-md ${statusBadge.bgColor} ${statusBadge.color}`}
                            >
                              {statusBadge.label}
                            </span>
                          </div>

                          <div className="absolute inset-x-0 bottom-0 p-2 sm:p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-end justify-between gap-1">
                            <span className="text-[9px] sm:text-[10px] text-white/70 font-semibold truncate bg-black/60 px-1.5 py-0.5 rounded-md">
                              {formatOrderTime(order.createdAt)}
                            </span>
                            <span className="px-2 py-0.5 rounded-lg bg-black/80 backdrop-blur-md border border-white/15 text-[11px] sm:text-xs font-black text-[#FF6321] font-mono">
                              {formatFCFA(order.total)}
                            </span>
                          </div>
                        </div>

                        <div className="p-2.5 sm:p-4 space-y-2">
                          <div onClick={() => onSelectOrder(order)} className="cursor-pointer">
                            <div className="flex items-start justify-between gap-1">
                              <h4 className="text-xs sm:text-sm font-black text-white line-clamp-1 group-hover:text-[#FF6321] transition">
                                {firstItem?.productTitle}
                              </h4>
                              <span className="text-[10px] font-bold text-white/70 shrink-0">
                                ×{firstItem?.quantity}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-1 mt-1 text-[9px] sm:text-[10px]">
                              <span className="text-white/60 flex items-center gap-1 truncate">
                                {mode === 'cod' ? (
                                  <Banknote className="w-3 h-3 text-amber-400 shrink-0" />
                                ) : (
                                  <CreditCard className="w-3 h-3 text-cyan-400 shrink-0" />
                                )}
                                <span className="truncate">
                                  {mode === 'cod' ? 'À la livraison' : 'En ligne'}
                                </span>
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded-md font-bold border shrink-0 ${payBadge.bgColor} ${payBadge.color}`}
                              >
                                {payBadge.label}
                              </span>
                            </div>
                          </div>

                          <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-1 text-[10px]">
                            <div className="flex items-center gap-1.5 truncate">
                              <img
                                src={OrderService.getClientAvatar(order)}
                                alt=""
                                className="w-5 h-5 rounded-full object-cover border border-cyan-400/40 shrink-0"
                              />
                              <div className="truncate">
                                <span className="text-white font-bold block truncate">
                                  {order.deliveryAddress.recipientName}
                                </span>
                                <span className="text-white/40 text-[9px] flex items-center gap-0.5 truncate">
                                  <MapPin className="w-2.5 h-2.5 text-[#FF6321]" />
                                  <span>{order.deliveryAddress.commune}</span>
                                </span>
                              </div>
                            </div>
                            <div className="pt-1 border-t border-white/5 flex items-center justify-between text-[9px]">
                              <span className="text-white/50">Net vendeur :</span>
                              <strong className="text-emerald-400 font-mono">
                                {formatFCFA(netSeller)}
                              </strong>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-2 sm:p-3 bg-black/40 border-t border-white/10 flex items-center gap-1.5">
                        <button
                          onClick={() => onOpenReceipt(order)}
                          className="flex-1 py-1.5 sm:py-2 px-2 rounded-lg sm:rounded-xl bg-[#FF6321]/15 hover:bg-[#FF6321] text-[#FF6321] hover:text-white border border-[#FF6321]/30 font-black text-[10px] sm:text-xs transition flex items-center justify-center gap-1.5"
                        >
                          <Receipt className="w-3 h-3 shrink-0" />
                          <span className="truncate">Reçu vendeur</span>
                        </button>

                        <button
                          onClick={() => onSelectOrder(order)}
                          className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition"
                          title="Voir détails"
                        >
                          <ChevronRight className="w-3.5 h-3.5 text-[#FF6321]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
