import React, { useState, useMemo } from 'react';
import { Package } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ClientOrderCard } from './ClientOrderCard';

export const OrdersTab: React.FC = () => {
  const { orders, setSelectedOrder } = useApp();
  const [filter, setFilter] = useState<'all' | 'online_paid' | 'online_pending' | 'cod'>('all');

  const counts = useMemo(() => {
    let onlinePaid = 0;
    let onlinePending = 0;
    let cod = 0;

    orders.forEach((order) => {
      const isCod =
        order.paymentMode === 'cod' ||
        order.paymentMethod === 'cash_on_delivery' ||
        order.paymentStatus === 'cod_pending';
      if (isCod) {
        cod++;
      } else if (order.paymentStatus === 'paid') {
        onlinePaid++;
      } else {
        onlinePending++;
      }
    });

    return { onlinePaid, onlinePending, cod, all: orders.length };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const isCod =
        order.paymentMode === 'cod' ||
        order.paymentMethod === 'cash_on_delivery' ||
        order.paymentStatus === 'cod_pending';
      if (filter === 'cod') return isCod;
      if (filter === 'online_paid') return !isCod && order.paymentStatus === 'paid';
      if (filter === 'online_pending') return !isCod && order.paymentStatus !== 'paid';
      return true;
    });
  }, [orders, filter]);

  return (
    <div id="orders-tab" className="space-y-4">
      {/* FILTER PILLS BY PAYMENT STATUS (Order status is uniformly Commande confirmée) */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'all', label: `Toutes (${counts.all})` },
          { id: 'online_paid', label: `Payées en ligne (${counts.onlinePaid})` },
          { id: 'cod', label: `À payer à la livraison (${counts.cod})` },
          { id: 'online_pending', label: `En attente paiement (${counts.onlinePending})` }
        ].map((tab) => (
          <button
            key={tab.id}
            id={`orders-tab-btn-${tab.id}`}
            onClick={() => setFilter(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition border ${
              filter === tab.id
                ? 'bg-[#FF6321] text-white border-[#FF6321] font-bold shadow-md shadow-orange-600/30'
                : 'bg-white/5 text-white/60 border-white/10 hover:text-white hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ORDERS LIST */}
      {filteredOrders.length === 0 ? (
        <div className="col-span-2 text-center py-16 text-white/50">
          <Package className="w-12 h-12 mx-auto mb-2 text-white/20" />
          <p className="text-sm font-semibold text-white/80">Aucune commande trouvée.</p>
          <p className="text-xs text-white/40 mt-1">Vos achats sur Djassa apparaîtront ici.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
          {filteredOrders.map((order) => (
            <ClientOrderCard
              key={order.id}
              order={order}
              onSelectOrder={setSelectedOrder}
            />
          ))}
        </div>
      )}
    </div>
  );
};
