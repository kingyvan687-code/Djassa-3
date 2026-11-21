import React, { useState } from 'react';
import {
  ShoppingBag,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  MapPin,
  Phone,
  Eye,
  Store,
  CreditCard,
  Receipt
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Order, OrderReceiptDto } from '../../../types';
import { formatFCFA, OrderService } from '../../../services/marketServices';
import { commerceService } from '../../../services/commerceService';
import {
  calcOrderFinancials,
  DJASSA_FIXED_COMMISSION_FCFA,
  getPaymentMethodLabel,
  getPaymentModeLabel,
  resolveOrderPaymentMode
} from '../../../utils/commerceCalculations';
import { DjassaOfficialReceiptModal } from '../../common/DjassaOfficialReceiptModal';

interface AdminOrdersSectionProps {
  onSelectOrder?: (order: Order) => void;
}

export const AdminOrdersSection: React.FC<AdminOrdersSectionProps> = ({ onSelectOrder }) => {
  const { orders, sellers, updateOrderStatus, addAuditLog, showToast } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'online_paid' | 'online_pending' | 'cod' | 'cancelled'>('all');
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);
  const [receiptTarget, setReceiptTarget] = useState<{ order: Order; dto?: OrderReceiptDto } | null>(null);

  const totalOrdersCount = orders.length;
  const onlinePaidCount = orders.filter((o) => resolveOrderPaymentMode(o) === 'online' && o.paymentStatus === 'paid').length;
  const codCount = orders.filter((o) => resolveOrderPaymentMode(o) === 'cod').length;
  const cancelledCount = orders.filter((o) => o.status === 'cancelled').length;
  const totalVolume = orders.reduce((sum, o) => sum + (o.total || 0), 0);

  const filteredOrders = orders.filter((order) => {
    const mode = resolveOrderPaymentMode(order);
    if (filterMode === 'online_paid' && !(mode === 'online' && order.paymentStatus === 'paid')) return false;
    if (filterMode === 'online_pending' && !(mode === 'online' && order.paymentStatus !== 'paid' && order.status !== 'cancelled')) return false;
    if (filterMode === 'cod' && mode !== 'cod') return false;
    if (filterMode === 'cancelled' && order.status !== 'cancelled') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = order.orderNumber.toLowerCase().includes(q);
      const matchClient = order.deliveryAddress.recipientName.toLowerCase().includes(q);
      const matchCommune = order.deliveryAddress.commune.toLowerCase().includes(q);
      const matchItem = order.items.some(
        (i) => i.productTitle.toLowerCase().includes(q) || i.sellerName.toLowerCase().includes(q)
      );
      return matchNum || matchClient || matchCommune || matchItem;
    }
    return true;
  });

  const handleOpenOfficialReceipt = async (order: Order) => {
    setReceiptTarget({ order });
    try {
      const res = await commerceService.getOrderReceipt(order.id);
      if (res?.receipt) {
        setReceiptTarget({ order, dto: res.receipt });
      }
    } catch {
      // Fallback to local order financials
    }
  };

  const handleCancelOrder = (order: Order) => {
    updateOrderStatus(order.id, 'cancelled');
    addAuditLog(
      'Annulation administrative commande',
      order.orderNumber,
      'order',
      `Commande #${order.orderNumber} annulée par l'administration`
    );
    showToast(`Commande #${order.orderNumber} annulée`);
    if (selectedOrderDetail?.id === order.id) {
      setSelectedOrderDetail({ ...selectedOrderDetail, status: 'cancelled' });
    }
  };

  const receiptSeller = receiptTarget
    ? sellers.find(
        (s) =>
          s.id === receiptTarget.order.sellerId ||
          s.id === receiptTarget.order.items[0]?.sellerId ||
          s.name.toLowerCase() === (receiptTarget.order.items[0]?.sellerName || '').toLowerCase()
      )
    : undefined;

  return (
    <div id="admin-orders-management-section" className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-orange-500/20 text-[#FF6321] border border-orange-500/30">
            <ShoppingBag className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-base font-black text-white">Supervision des Commandes</h2>
            <p className="text-xs text-white/50">
              Statut unique « Commande confirmée » · Livraison directe vendeur · Commission fixe {DJASSA_FIXED_COMMISSION_FCFA} FCFA
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60">Volume total :</span>
          <span className="text-sm font-black text-emerald-400">{formatFCFA(totalVolume)}</span>
        </div>
      </div>

      {/* KPI METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div
          onClick={() => setFilterMode('all')}
          className={`p-3 rounded-xl border transition cursor-pointer ${
            filterMode === 'all' ? 'bg-orange-950/35 border-[#FF6321]/50' : 'bg-white/5 border-white/10 hover:bg-white/10'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-white/50 mb-1">
            <span>Total Commandes</span>
            <ShoppingBag className="w-3.5 h-3.5 text-white/70" />
          </div>
          <p className="text-lg font-black text-white">{totalOrdersCount}</p>
          <span className="text-[10px] text-white/40">Commande confirmée</span>
        </div>

        <div
          onClick={() => setFilterMode('online_paid')}
          className={`p-3 rounded-xl border transition cursor-pointer ${
            filterMode === 'online_paid' ? 'bg-emerald-950/40 border-emerald-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-white/50 mb-1">
            <span>Payées en ligne</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <p className="text-lg font-black text-emerald-400">{onlinePaidCount}</p>
          <span className="text-[10px] text-emerald-400/80 font-bold">Wave / Orange Money</span>
        </div>

        <div
          onClick={() => setFilterMode('cod')}
          className={`p-3 rounded-xl border transition cursor-pointer ${
            filterMode === 'cod' ? 'bg-amber-950/40 border-amber-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-white/50 mb-1">
            <span>Paiement livraison</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <p className="text-lg font-black text-amber-400">{codCount}</p>
          <span className="text-[10px] text-amber-300 font-bold">0% frais client (COD)</span>
        </div>

        <div
          onClick={() => setFilterMode('cancelled')}
          className={`p-3 rounded-xl border transition cursor-pointer ${
            filterMode === 'cancelled' ? 'bg-rose-950/40 border-rose-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-white/50 mb-1">
            <span>Annulées / Litiges</span>
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <p className="text-lg font-black text-rose-400">{cancelledCount}</p>
          <span className="text-[10px] text-rose-400/80 font-bold">Clôture admin</span>
        </div>
      </div>

      {/* SEARCH AND FILTER */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par N° commande, client, boutique, commune..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]/60"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: 'all', label: `Toutes (${orders.length})` },
            { id: 'online_paid', label: `Payées en ligne (${onlinePaidCount})` },
            { id: 'online_pending', label: 'En ligne en attente' },
            { id: 'cod', label: `À la livraison (${codCount})` },
            { id: 'cancelled', label: `Annulées (${cancelledCount})` }
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setFilterMode(btn.id as typeof filterMode)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                filterMode === btn.id ? 'bg-[#FF6321] text-white' : 'bg-white/5 text-white/60 hover:text-white'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* ORDERS LIST */}
      <div className="space-y-2.5">
        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/10 space-y-2">
            <ShoppingBag className="w-8 h-8 text-white/30 mx-auto" />
            <p className="text-sm font-bold text-white">Aucune commande trouvée</p>
            <p className="text-xs text-white/50">Modifiez la recherche ou le filtre.</p>
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
                className="p-3.5 bg-white/5 rounded-2xl border border-white/10 hover:border-[#FF6321]/30 transition space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-black text-[#FF6321] bg-[#FF6321]/10 px-2 py-0.5 rounded-lg border border-[#FF6321]/25">
                      #{order.orderNumber}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge.color} ${statusBadge.bgColor}`}>
                      {statusBadge.label}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${paymentBadge.color} ${paymentBadge.bgColor}`}>
                      {paymentBadge.label}
                    </span>
                    <span className="text-[10px] text-white/40">{order.createdAt}</span>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <span className="text-xs font-black text-white">{formatFCFA(order.total)}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-white/10 text-white/75 font-semibold">
                      {modeLabel}
                    </span>
                  </div>
                </div>

                {/* DETAILS ROW */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <p className="font-bold text-white">{order.deliveryAddress.recipientName}</p>
                    <p className="text-[11px] text-white/60 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#FF6321]" />
                      {order.deliveryAddress.commune} ({order.deliveryAddress.quartier || 'Centre'})
                    </p>
                    <p className="text-[10px] text-white/40 flex items-center gap-1">
                      <Phone className="w-2.5 h-2.5" />
                      {order.deliveryAddress.phone}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2 overflow-hidden">
                      {order.items.slice(0, 3).map((item, idx) => (
                        <img
                          key={idx}
                          src={item.productImage}
                          alt={item.productTitle}
                          className="inline-block h-8 w-8 rounded-lg object-cover ring-2 ring-[#121212]"
                        />
                      ))}
                    </div>
                    <div className="text-[11px] text-white/70 max-w-[190px]">
                      <p className="truncate font-semibold text-white">
                        {order.items[0]?.productTitle} {order.items.length > 1 && `+ ${order.items.length - 1}`}
                      </p>
                      <p className="text-[10px] text-white/45 flex items-center gap-1 truncate">
                        <Store className="w-3 h-3 text-[#FF6321] shrink-0" />
                        <span>{sellerName}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleOpenOfficialReceipt(order)}
                      className="px-3 py-1.5 bg-[#FF6321]/15 hover:bg-[#FF6321]/25 text-[#FF6321] border border-[#FF6321]/30 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Reçu officiel</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectOrder) {
                          onSelectOrder(order);
                        } else {
                          setSelectedOrderDetail(order);
                        }
                      }}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Détails</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ORDER DETAIL MODAL */}
      {selectedOrderDetail && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#141414] border border-white/10 rounded-2xl p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex items-start justify-between border-b border-white/10 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-black text-[#FF6321] bg-[#FF6321]/15 px-2 py-0.5 rounded-lg">
                    #{selectedOrderDetail.orderNumber}
                  </span>
                  <span className="text-sm font-bold text-white">Supervision Commande</span>
                </div>
                <p className="text-[11px] text-white/50 mt-0.5">Créée le {selectedOrderDetail.createdAt}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderDetail(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            {(() => {
              const mode = resolveOrderPaymentMode(selectedOrderDetail);
              const fin = calcOrderFinancials({
                subtotal: selectedOrderDetail.subtotal || selectedOrderDetail.items.reduce((s, i) => s + i.price * i.quantity, 0),
                discount: selectedOrderDetail.discount || 0,
                paymentMode: mode
              });
              const payBadge = OrderService.getPaymentStatusBadge(selectedOrderDetail.paymentStatus, selectedOrderDetail.paymentMode);

              return (
                <>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Statut visible commande :</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold text-[10px]">
                        Commande confirmée
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Mode & moyen de paiement :</span>
                      <span className="font-bold text-white flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5 text-[#FF6321]" />
                        <span>{getPaymentMethodLabel(selectedOrderDetail.paymentMethod, selectedOrderDetail.paymentMode)}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Statut réel du paiement :</span>
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${payBadge.color} ${payBadge.bgColor}`}>
                        {payBadge.label}
                      </span>
                    </div>
                  </div>

                  {/* DESTINATAIRE & LIVRAISON */}
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1.5 text-xs text-white/80">
                    <p className="text-[10px] text-white/40 uppercase font-bold">Client & Livraison organisée par la boutique</p>
                    <div className="flex justify-between">
                      <span className="text-white font-bold">{selectedOrderDetail.deliveryAddress.recipientName}</span>
                      <a href={`tel:${selectedOrderDetail.deliveryAddress.phone}`} className="text-[#FF6321] font-bold hover:underline">
                        {selectedOrderDetail.deliveryAddress.phone}
                      </a>
                    </div>
                    <p className="text-[11px] text-white/60">
                      {selectedOrderDetail.deliveryAddress.commune} • {selectedOrderDetail.deliveryAddress.quartier}
                    </p>
                    {selectedOrderDetail.deliveryAddress.details && (
                      <p className="text-[10px] text-white/40 italic">Repères : {selectedOrderDetail.deliveryAddress.details}</p>
                    )}
                    <p className="text-[10px] text-emerald-400">
                      Livraison externe organisée directement par le vendeur (0 FCFA frais DJASSA).
                    </p>
                  </div>

                  {/* ITEMS */}
                  <div className="space-y-1.5 max-h-40 overflow-y-auto no-scrollbar">
                    {selectedOrderDetail.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 text-xs">
                        <div className="flex items-center gap-2">
                          <img src={item.productImage} alt={item.productTitle} className="w-9 h-9 rounded-lg object-cover" />
                          <div>
                            <p className="text-white font-medium max-w-[200px] truncate">{item.productTitle}</p>
                            <p className="text-[10px] text-white/40">Boutique : {item.sellerName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-bold">{formatFCFA(item.price)} × {item.quantity}</p>
                          <p className="text-[10px] text-emerald-400 font-bold">{formatFCFA(item.price * item.quantity)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* FINANCIALS */}
                  <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-1 text-xs">
                    <div className="flex justify-between text-white/60">
                      <span>Sous-total articles :</span>
                      <span>{formatFCFA(fin.subtotal)}</span>
                    </div>
                    {fin.discount > 0 && (
                      <div className="flex justify-between text-emerald-400 font-bold">
                        <span>Réduction promo :</span>
                        <span>-{formatFCFA(fin.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-white/60">
                      <span>Frais livraison DJASSA :</span>
                      <span className="text-emerald-400 font-bold">0 FCFA</span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span>Frais paiement client ({mode === 'online' ? '6,5%' : '0% COD'}) :</span>
                      <span>{formatFCFA(selectedOrderDetail.clientFeeFcfa ?? fin.clientFeeFcfa)}</span>
                    </div>
                    <div className="flex justify-between text-purple-300 font-semibold">
                      <span>Commission fixe DJASSA :</span>
                      <span>{formatFCFA(selectedOrderDetail.commissionFcfa ?? DJASSA_FIXED_COMMISSION_FCFA)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-400 font-bold">
                      <span>Net vendeur après commission :</span>
                      <span>{formatFCFA(selectedOrderDetail.sellerNetFcfa ?? fin.sellerNetFcfa)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-white pt-1 border-t border-white/10">
                      <span>Total client :</span>
                      <span className="text-[#FF6321]">{formatFCFA(selectedOrderDetail.total || fin.total)}</span>
                    </div>
                  </div>
                </>
              );
            })()}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => void handleOpenOfficialReceipt(selectedOrderDetail)}
                className="flex-1 py-2.5 bg-[#FF6321] hover:bg-[#ff773b] text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Receipt className="w-4 h-4" />
                <span>Reçu officiel (Admin)</span>
              </button>
              {selectedOrderDetail.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => handleCancelOrder(selectedOrderDetail)}
                  className="px-3.5 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Annuler
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedOrderDetail(null)}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {receiptTarget && (
        <DjassaOfficialReceiptModal
          order={receiptTarget.order}
          seller={receiptSeller}
          receiptDto={receiptTarget.dto}
          perspective="admin"
          onClose={() => setReceiptTarget(null)}
          onShowToast={showToast}
        />
      )}
    </div>
  );
};
