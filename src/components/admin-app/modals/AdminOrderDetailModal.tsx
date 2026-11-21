import React, { useState } from 'react';
import {
  X,
  ShoppingBag,
  User,
  Store,
  MapPin,
  Phone,
  AlertTriangle,
  Receipt,
  CreditCard
} from 'lucide-react';
import { Order, OrderReceiptDto } from '../../../types';
import { formatFCFA, OrderService } from '../../../services/marketServices';
import { useApp } from '../../../context/AppContext';
import { securityService } from '../../../services/securityService';
import { commerceService } from '../../../services/commerceService';
import {
  calcOrderFinancials,
  DJASSA_FIXED_COMMISSION_FCFA,
  getCommissionStatusLabel,
  getPaymentMethodLabel,
  getPaymentModeLabel,
  getSellerPayoutStatusLabel,
  resolveOrderPaymentMode
} from '../../../utils/commerceCalculations';
import { DjassaOfficialReceiptModal } from '../../common/DjassaOfficialReceiptModal';

interface AdminOrderDetailModalProps {
  order: Order;
  onClose: () => void;
}

export const AdminOrderDetailModal: React.FC<AdminOrderDetailModalProps> = ({ order, onClose }) => {
  const { updateOrderStatus, sellers, showToast } = useApp();
  const [confirmingRefund, setConfirmingRefund] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptDto, setReceiptDto] = useState<OrderReceiptDto | undefined>(undefined);

  const paymentMode = resolveOrderPaymentMode(order);
  const subtotal = order.subtotal ?? order.items.reduce((sum, it) => sum + it.price * it.quantity, 0);
  const discount = order.discount ?? 0;
  const financials = calcOrderFinancials({ subtotal, discount, paymentMode });

  const clientFeeFcfa = paymentMode === 'cod' ? 0 : order.clientFeeFcfa ?? order.serviceFee ?? financials.clientFeeFcfa;
  const commissionFcfa = order.commissionFcfa ?? DJASSA_FIXED_COMMISSION_FCFA;
  const sellerPayout = order.sellerNetFcfa ?? financials.sellerNetFcfa;

  const statusBadge = OrderService.getStatusBadge(order.status);
  const paymentBadge = OrderService.getPaymentStatusBadge(order.paymentStatus, order.paymentMode);
  const commissionBadge = getCommissionStatusLabel(order.commissionStatus);
  const sellerPayoutBadge = getSellerPayoutStatusLabel(order.sellerPayoutStatus);

  const matchedSeller = sellers.find(
    (s) =>
      s.id === order.sellerId ||
      s.id === order.items[0]?.sellerId ||
      s.name.toLowerCase() === (order.items[0]?.sellerName || '').toLowerCase()
  );

  const handleOpenOfficialReceipt = async () => {
    setReceiptOpen(true);
    try {
      const res = await commerceService.getOrderReceipt(order.id);
      if (res?.receipt) {
        setReceiptDto(res.receipt);
      }
    } catch {
      // Fallback to local order financials inside DjassaOfficialReceiptModal
    }
  };

  const handleRefund = () => {
    const txId = `RBT-${order.orderNumber || order.id}-${Date.now().toString().slice(-4)}`;
    updateOrderStatus(order.id, 'cancelled');
    void securityService.recordActivity({
      category: 'payments',
      actionType: 'admin_order_refund',
      action: `Remboursement litige commande #${order.orderNumber}`,
      target: `#${order.orderNumber} • ${order.deliveryAddress.recipientName}`,
      targetType: 'finance',
      entityType: 'order',
      entityId: order.orderNumber || order.id,
      space: 'admin',
      result: 'reussi',
      severity: 'eleve',
      beforeValue: order.status,
      afterValue: 'cancelled (remboursée)',
      details: `Remboursement intégral de ${formatFCFA(order.total)} validé par l'administration`,
      financialTrace: {
        operationType: 'Remboursement commande client',
        transactionId: txId,
        initiatorName: 'Administrateur DJASSA',
        beneficiaryAccount: order.deliveryAddress.recipientName,
        amountFcfa: order.total,
        commissionFcfa,
        status: 'rembourse',
        timestamp: new Date().toISOString(),
        validationResult: 'Approuvé par supervision admin',
        channel: getPaymentMethodLabel(order.paymentMethod, order.paymentMode)
      }
    });
    showToast(`Remboursement de ${formatFCFA(order.total)} enregistré pour #${order.orderNumber}`);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in select-none">
        <div className="w-full max-w-md bg-[#121212] border border-[#FF6321]/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
          {/* HEADER */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#FF6321]" />
              <h2 className="text-sm font-black text-white">Supervision Commande #{order.orderNumber}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* BODY */}
          <div className="p-5 overflow-y-auto space-y-4 no-scrollbar">
            {/* STATUS & PAYMENT STATUS */}
            <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-white/5 border border-white/10">
              <div>
                <span className="text-[10px] text-white/50 block">Date de création</span>
                <span className="text-xs font-bold text-white">{order.createdAt}</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${statusBadge.color} ${statusBadge.bgColor}`}>
                  {statusBadge.label}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${paymentBadge.color} ${paymentBadge.bgColor}`}>
                  {paymentBadge.label}
                </span>
              </div>
            </div>

            {/* CLIENT & RECIPIENT */}
            <div className="p-3.5 rounded-2xl bg-[#181818] border border-sky-500/25 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Client & Adresse de livraison
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Client
                </span>
              </div>

              <div className="flex items-center gap-3">
                <img
                  src={OrderService.getClientAvatar(order)}
                  alt={order.deliveryAddress.recipientName}
                  className="w-11 h-11 rounded-2xl object-cover border-2 border-sky-400/40 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white text-xs truncate">{order.deliveryAddress.recipientName}</p>
                  <p className="text-white/60 text-[11px] font-mono">{order.deliveryAddress.phone}</p>
                  <p className="text-sky-300 text-[10px] truncate flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span>{order.deliveryAddress.commune}, {order.deliveryAddress.quartier}</span>
                  </p>
                </div>
                <a
                  href={`tel:${order.deliveryAddress.phone}`}
                  className="p-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 transition shrink-0"
                  title="Appeler le client"
                >
                  <Phone className="w-3.5 h-3.5" />
                </a>
              </div>

              {order.deliveryAddress.details && (
                <p className="text-[10px] text-white/50 bg-black/40 p-2 rounded-xl border border-white/5 italic">
                  Repères : {order.deliveryAddress.details}
                </p>
              )}
            </div>

            {/* BOUTIQUE / LIVRAISON EXTERNE ORGANISEE PAR LE VENDEUR */}
            <div className="p-3.5 rounded-2xl bg-[#181818] border border-orange-500/25 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-[#FF6321] uppercase tracking-wider flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5" />
                  Boutique & Livraison externe
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Gérée par le vendeur
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-white truncate">
                    {matchedSeller?.storeName || matchedSeller?.name || order.items[0]?.sellerName || 'Boutique DJASSA'}
                  </p>
                  <p className="text-[10px] text-white/60">
                    {matchedSeller?.location || 'Abidjan'} · Frais livraison DJASSA : 0 FCFA
                  </p>
                </div>
                {matchedSeller?.phone && (
                  <a
                    href={`tel:${matchedSeller.phone}`}
                    className="p-2 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-[#FF6321] transition shrink-0"
                    title="Appeler la boutique"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* ITEMS */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-xs">
              <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider block">
                Articles commandés ({order.items.length})
              </span>
              <div className="space-y-2 divide-y divide-white/5">
                {order.items.map((item, idx) => {
                  const title = item.productTitle || (item as any).product?.name || 'Produit';
                  const unitPrice = item.price ?? (item as any).product?.price ?? 0;
                  return (
                    <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-white">{title}</p>
                        <p className="text-white/40 text-[10px]">Qté : {item.quantity}</p>
                      </div>
                      <span className="font-mono text-white font-bold">{formatFCFA(unitPrice * item.quantity)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* FINANCIAL AUDIT */}
            <div className="p-3.5 rounded-2xl bg-[#181818] border border-purple-500/30 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">
                  Audit Financier DJASSA
                </span>
                <span className="text-[10px] text-white/70 flex items-center gap-1 font-semibold">
                  <CreditCard className="w-3 h-3 text-[#FF6321]" />
                  {getPaymentModeLabel(order.paymentMode, order.paymentMethod)}
                </span>
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-white/60">Sous-total articles :</span>
                  <span className="text-white">{formatFCFA(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Remise promo :</span>
                    <span>-{formatFCFA(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-white/60">Livraison externe vendeur :</span>
                  <span className="text-emerald-400 font-bold">0 FCFA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">
                    Frais client ({paymentMode === 'online' ? '6,5% en ligne' : '0% COD'}) :
                  </span>
                  <span className="text-white">{formatFCFA(clientFeeFcfa)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Total client :</span>
                  <span className="text-white font-bold">{formatFCFA(order.total || financials.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-purple-400">
                    Commission DJASSA ({commissionBadge.label}) :
                  </span>
                  <span className="text-purple-300 font-bold">{formatFCFA(commissionFcfa)}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-1">
                  <span className="text-emerald-400 font-bold">Net vendeur :</span>
                  <span className="text-emerald-400 font-bold">{formatFCFA(sellerPayout)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-white/60 pt-1">
                  <span>Reversement vendeur :</span>
                  <span className="font-bold text-white/85">{sellerPayoutBadge.label}</span>
                </div>
              </div>
            </div>

            {/* ADMINISTRATIVE CONTROLS */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => void handleOpenOfficialReceipt()}
                className="w-full py-2.5 rounded-xl bg-[#FF6321] hover:bg-[#ff773b] text-white font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Receipt className="w-4 h-4" />
                <span>Reçu officiel (Admin)</span>
              </button>

              {!confirmingRefund ? (
                <button
                  type="button"
                  onClick={() => setConfirmingRefund(true)}
                  className="w-full py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>Rembourser le client (Règlement litige)</span>
                </button>
              ) : (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2.5 text-xs">
                  <p className="text-rose-200 font-semibold leading-snug">
                    Confirmer le remboursement intégral de {formatFCFA(order.total)} à {order.deliveryAddress.recipientName} ?
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmingRefund(false)}
                      className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white font-bold transition"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleRefund}
                      className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition"
                    >
                      Confirmer remboursement
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {receiptOpen && (
        <DjassaOfficialReceiptModal
          order={order}
          seller={matchedSeller}
          receiptDto={receiptDto}
          perspective="admin"
          onClose={() => setReceiptOpen(false)}
          onShowToast={showToast}
        />
      )}
    </>
  );
};
