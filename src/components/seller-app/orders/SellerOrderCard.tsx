import React, { useState } from 'react';
import {
  MapPin,
  Phone,
  Clock,
  Receipt,
  ChevronRight,
  Copy,
  Check,
  Truck,
  AlertCircle,
  CreditCard,
  Banknote,
} from 'lucide-react';
import { Order } from '../../../types';
import {
  formatFCFA,
  OrderService,
  formatOrderDate,
  formatOrderTime,
} from '../../../services/marketServices';

interface Props {
  order: Order;
  parcelPhoto?: string;
  onSelectOrder: (order: Order) => void;
  onOpenReceipt: (order: Order) => void;
  onContactClient: (phone: string, name: string) => void;
}

export const SellerOrderCard: React.FC<Props> = ({
  order,
  onSelectOrder,
  onOpenReceipt,
  onContactClient,
}) => {
  const [copied, setCopied] = useState(false);

  const badge = OrderService.getStatusBadge(order.status);
  const paymentMode =
    order.paymentMode || (order.paymentMethod === 'cash_on_delivery' ? 'cod' : 'online');
  const paymentBadge = OrderService.getPaymentStatusBadge(order.paymentStatus, paymentMode);
  const firstItem = order.items[0];
  const otherItemsCount = Math.max(0, order.items.length - 1);

  const subtotalNetDiscount = Math.max(0, (order.subtotal || 0) - (order.discount || 0));
  const commissionFcfa = order.commissionFcfa ?? 150;
  const sellerNetFcfa = order.sellerNetFcfa ?? Math.max(0, subtotalNetDiscount - commissionFcfa);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText?.(order.orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id={`order-card-${order.id}`}
      className="rounded-2xl sm:rounded-3xl bg-[#141414] hover:bg-[#181818] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between shadow-xl overflow-hidden group"
    >
      <div>
        {/* 1. PRODUCT PHOTO WITH OVERLAYS */}
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

          {/* Top Gradient Overlay with Order # and strict single order status */}
          <div className="absolute inset-x-0 top-0 p-2 sm:p-3 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-start justify-between gap-1 sm:gap-2">
            <div className="flex items-center gap-1 bg-black/70 backdrop-blur-md px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl border border-white/10">
              <span className="font-mono text-[10px] sm:text-xs font-black text-white">
                {order.orderNumber}
              </span>
              <button
                onClick={handleCopy}
                className="text-white/50 hover:text-white transition p-0.5"
                title="Copier le numéro"
              >
                {copied ? (
                  <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                )}
              </button>
            </div>

            <span
              className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-black border backdrop-blur-md ${badge.bgColor} ${badge.color}`}
            >
              {badge.label}
            </span>
          </div>

          {/* Bottom Overlay with Net Seller Amount and Multi-Item indicator */}
          <div className="absolute inset-x-0 bottom-0 p-2 sm:p-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-end justify-between gap-1 sm:gap-2">
            <div>
              {otherItemsCount > 0 ? (
                <span className="px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg bg-[#FF6321] text-white text-[9px] sm:text-[10px] font-black shadow-md">
                  +{otherItemsCount}
                </span>
              ) : (
                <span className="text-[9px] sm:text-[10px] text-white/70 font-medium hidden sm:inline">
                  {firstItem?.variant && Object.keys(firstItem.variant).length > 0
                    ? Object.values(firstItem.variant).join(' • ')
                    : '1 article'}
                </span>
              )}
            </div>

            <div className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl bg-black/80 backdrop-blur-md border border-white/15 text-right">
              <span className="text-[11px] sm:text-xs font-black text-[#FF6321] font-mono">
                {formatFCFA(order.total)}
              </span>
            </div>
          </div>
        </div>

        {/* 2. CARD CONTENT */}
        <div className="p-2.5 sm:p-4 space-y-2 sm:space-y-3">
          {/* Product Title & Date/Hour */}
          <div onClick={() => onSelectOrder(order)} className="cursor-pointer">
            <div className="flex items-start justify-between gap-1.5">
              <h4 className="text-xs sm:text-sm font-black text-white line-clamp-1 group-hover:text-[#FF6321] transition">
                {firstItem?.productTitle}
              </h4>
              <span className="text-[10px] sm:text-xs font-bold text-white/80 shrink-0">
                ×{firstItem?.quantity}
              </span>
            </div>

            <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-white/50 mt-1 gap-1">
              <span className="flex items-center gap-1 text-white/60 truncate">
                <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#FF6321] shrink-0" />
                <span className="truncate">
                  {formatOrderDate(order.createdAt)} • {formatOrderTime(order.createdAt)}
                </span>
              </span>
            </div>
          </div>

          {/* PAYMENT MODE & SEPARATE PAYMENT STATUS */}
          <div className="p-2 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5 text-[10px]">
            <div className="flex items-center justify-between gap-1.5">
              <span className="flex items-center gap-1 font-bold text-white/80 truncate">
                {paymentMode === 'cod' ? (
                  <Banknote className="w-3 h-3 text-amber-400 shrink-0" />
                ) : (
                  <CreditCard className="w-3 h-3 text-cyan-400 shrink-0" />
                )}
                <span className="truncate">
                  {paymentMode === 'cod'
                    ? 'À la livraison'
                    : order.paymentMethod === 'orange_money'
                    ? 'En ligne • Orange Money'
                    : 'En ligne • Wave'}
                </span>
              </span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[9px] font-black border shrink-0 ${paymentBadge.bgColor} ${paymentBadge.color}`}
              >
                {paymentBadge.label}
              </span>
            </div>

            <div className="flex items-center justify-between text-[9px] text-white/60">
              <span>Net vendeur (com. {formatFCFA(commissionFcfa)}) :</span>
              <strong className="text-emerald-400 font-mono">{formatFCFA(sellerNetFcfa)}</strong>
            </div>
          </div>

          {/* CLIENT & SELLER-MANAGED DELIVERY STRIP */}
          <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-black/40 border border-white/5 space-y-1.5 sm:space-y-2">
            {/* Client Destinataire */}
            <div className="flex items-center justify-between gap-1.5 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <img
                  src={OrderService.getClientAvatar(order)}
                  alt={order.deliveryAddress.recipientName}
                  className="w-5 h-5 sm:w-7 sm:h-7 rounded-full object-cover border border-cyan-400/40 shrink-0"
                />
                <div className="truncate min-w-0">
                  <p className="text-white font-bold text-[10px] sm:text-[11px] truncate">
                    {order.deliveryAddress.recipientName}
                  </p>
                  <p className="text-white/40 text-[9px] sm:text-[10px] truncate flex items-center gap-0.5">
                    <MapPin className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-[#FF6321] shrink-0" />
                    <span>
                      {order.deliveryAddress.commune}
                      {order.deliveryAddress.quartier ? ` • ${order.deliveryAddress.quartier}` : ''}
                    </span>
                  </p>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onContactClient(order.deliveryAddress.phone, order.deliveryAddress.recipientName);
                }}
                className="p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 transition shrink-0"
                title="Appeler le client"
              >
                <Phone className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </button>
            </div>

            {/* Livraison externe gérée par la boutique */}
            <div className="pt-1.5 border-t border-white/5 flex items-center gap-1.5 text-[9px] sm:text-[10px] text-white/60 truncate">
              <Truck className="w-3 h-3 text-[#FF6321] shrink-0" />
              <span className="truncate">Livraison organisée par votre boutique (0 F DJASSA)</span>
            </div>
          </div>

          {/* INCIDENT ALERT STRIP IF RECORDED */}
          {order.incident && (
            <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center gap-1.5 sm:gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <div className="flex-1 min-w-0 text-[9px] sm:text-[10px]">
                <span className="text-rose-300 font-bold block truncate">
                  {order.incident.type === 'damaged'
                    ? 'Signalement : colis endommagé'
                    : order.incident.type === 'returned'
                    ? 'Signalement : colis retourné'
                    : 'Signalement client'}
                </span>
                <span className="text-white/50 truncate block">{order.incident.reason}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. CARD ACTION FOOTER */}
      <div className="p-2 sm:p-3 bg-black/40 border-t border-white/10 flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenReceipt(order);
          }}
          className="flex-1 py-2 px-2.5 rounded-lg sm:rounded-xl bg-[#FF6321]/15 hover:bg-[#FF6321] text-[#FF6321] hover:text-white border border-[#FF6321]/30 font-black text-[10px] sm:text-xs transition flex items-center justify-center gap-1.5 truncate"
          title="Afficher le reçu vendeur"
        >
          <Receipt className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
          <span className="truncate">Reçu vendeur</span>
        </button>

        <button
          onClick={() => onSelectOrder(order)}
          className="p-2 rounded-lg sm:rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition flex items-center shrink-0"
          title="Détails complets de la commande"
        >
          <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF6321]" />
        </button>
      </div>
    </div>
  );
};
