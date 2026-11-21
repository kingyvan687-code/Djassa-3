import React, { useState } from 'react';
import { Search, ShoppingBag, MapPin, Store, Receipt, CreditCard } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Order, OrderReceiptDto } from '../../../types';
import { formatFCFA, OrderService } from '../../../services/marketServices';
import { securityService } from '../../../services/securityService';
import { commerceService } from '../../../services/commerceService';
import { getPaymentModeLabel, resolveOrderPaymentMode } from '../../../utils/commerceCalculations';
import { DjassaOfficialReceiptModal } from '../../common/DjassaOfficialReceiptModal';

interface CommandesTabProps {
  onSelectOrder: (order: Order) => void;
}

export const CommandesTab: React.FC<CommandesTabProps> = ({ onSelectOrder }) => {
  const { orders, sellers, showToast } = useApp();
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | 'online_paid' | 'online_pending' | 'cod' | 'cancelled'>('all');
  const [receiptOrder, setReceiptOrder] = useState<{ order: Order; dto?: OrderReceiptDto } | null>(null);

  const filteredOrders = orders.filter((o) => {
    const mode = resolveOrderPaymentMode(o);
    const matchesMode =
      modeFilter === 'all'
        ? true
        : modeFilter === 'online_paid'
        ? mode === 'online' && o.paymentStatus === 'paid'
        : modeFilter === 'online_pending'
        ? mode === 'online' && o.paymentStatus !== 'paid' && o.status !== 'cancelled'
        : modeFilter === 'cod'
        ? mode === 'cod'
        : o.status === 'cancelled';

    const matchesSearch =
      !search.trim() ||
      o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      o.deliveryAddress.recipientName.toLowerCase().includes(search.toLowerCase()) ||
      o.deliveryAddress.commune.toLowerCase().includes(search.toLowerCase()) ||
      o.items.some((it) => it.sellerName?.toLowerCase().includes(search.toLowerCase()));

    return matchesMode && matchesSearch;
  });

  const handleOpenReceipt = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    setReceiptOrder({ order });
    try {
      const res = await commerceService.getOrderReceipt(order.id);
      if (res?.receipt) {
        setReceiptOrder({ order, dto: res.receipt });
      }
    } catch {
      // fallback to local order data
    }
  };

  const receiptSeller = receiptOrder
    ? sellers.find(
        (s) =>
          s.id === receiptOrder.order.sellerId ||
          s.id === receiptOrder.order.items[0]?.sellerId ||
          s.name.toLowerCase() === (receiptOrder.order.items[0]?.sellerName || '').toLowerCase()
      )
    : undefined;

  return (
    <div id="admin-tab-commandes" className="w-full h-full overflow-y-auto no-scrollbar p-4 space-y-4 pb-20">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-black text-white">Supervision des Commandes</h2>
            <p className="text-[11px] text-white/50">
              Statut unique « Commande confirmée » · Livraison organisée par chaque vendeur
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono font-bold text-white/80">
            {orders.length} cmd
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par numéro, client, commune ou boutique..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/10 rounded-2xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]"
          />
        </div>

        {/* Mode & payment filters */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {[
            { id: 'all', label: 'Toutes' },
            { id: 'online_paid', label: 'En ligne · Payées' },
            { id: 'online_pending', label: 'En ligne · En attente' },
            { id: 'cod', label: 'À la livraison (COD)' },
            { id: 'cancelled', label: 'Annulées / Litiges' }
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setModeFilter(f.id as typeof modeFilter)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition border cursor-pointer ${
                modeFilter === f.id
                  ? 'bg-[#FF6321] border-[#FF6321] text-white'
                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-2.5">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-xs text-white/40 space-y-2">
            <ShoppingBag className="w-7 h-7 mx-auto text-white/25" />
            <p>Aucune commande trouvée.</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const statusBadge = OrderService.getStatusBadge(order.status);
            const paymentBadge = OrderService.getPaymentStatusBadge(order.paymentStatus, order.paymentMode);
            const modeLabel = getPaymentModeLabel(order.paymentMode, order.paymentMethod);
            const sellerName = order.items[0]?.sellerName || 'Boutique DJASSA';

            return (
              <div
                key={order.id}
                onClick={() => {
                  void securityService.recordActivity({
                    category: 'orders',
                    actionType: 'admin_order_viewed',
                    action: `Consultation dossier commande #${order.orderNumber}`,
                    target: `#${order.orderNumber} (${order.deliveryAddress.recipientName})`,
                    targetType: 'order',
                    entityType: 'order',
                    entityId: order.orderNumber || order.id,
                    space: 'admin',
                    result: 'reussi',
                    severity: 'information',
                    details: `Supervision admin commande ${order.orderNumber} • ${statusBadge.label} • ${paymentBadge.label}`
                  });
                  onSelectOrder(order);
                }}
                className="p-4 bg-white/5 rounded-2xl border border-white/10 hover:border-[#FF6321]/40 cursor-pointer transition space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-white">#{order.orderNumber}</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-black text-xs text-[#FF6321]">{formatFCFA(order.total)}</span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${statusBadge.color} ${statusBadge.bgColor}`}>
                      {statusBadge.label}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${paymentBadge.color} ${paymentBadge.bgColor}`}>
                      {paymentBadge.label}
                    </span>
                  </div>
                </div>

                {/* Client & Boutique (livraison gérée par le vendeur) */}
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={OrderService.getClientAvatar(order)}
                      alt={order.deliveryAddress.recipientName}
                      className="w-7 h-7 rounded-full object-cover border border-cyan-400/50 shrink-0"
                    />
                    <div className="truncate min-w-0">
                      <p className="text-[11px] font-bold text-white truncate">{order.deliveryAddress.recipientName}</p>
                      <p className="text-[9px] text-cyan-300 truncate">Client • {order.deliveryAddress.commune}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0">
                      <Store className="w-3.5 h-3.5 text-[#FF6321]" />
                    </div>
                    <div className="truncate min-w-0">
                      <p className="text-[11px] font-bold text-white truncate">{sellerName}</p>
                      <p className="text-[9px] text-amber-300 truncate flex items-center gap-1">
                        <CreditCard className="w-2.5 h-2.5 shrink-0" />
                        <span>{modeLabel}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-white/50 pt-1 border-t border-white/5 gap-2">
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-[#FF6321] shrink-0" />
                    <span className="truncate">
                      {order.deliveryAddress.commune} ({order.deliveryAddress.quartier || 'Centre'})
                    </span>
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => void handleOpenReceipt(e, order)}
                      className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <Receipt className="w-3 h-3 text-[#FF6321]" />
                      <span>Reçu</span>
                    </button>
                    <span>{order.createdAt}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {receiptOrder && (
        <DjassaOfficialReceiptModal
          order={receiptOrder.order}
          seller={receiptSeller}
          receiptDto={receiptOrder.dto}
          perspective="admin"
          onClose={() => setReceiptOrder(null)}
          onShowToast={showToast}
        />
      )}
    </div>
  );
};
