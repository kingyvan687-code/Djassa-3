import React, { useMemo } from 'react';
import {
  FileText,
  ChevronRight,
  Receipt
} from 'lucide-react';
import { Order } from '../../types';
import { OrderService, formatFCFA } from '../../services/marketServices';
import { useApp } from '../../context/AppContext';

interface ClientOrderCardProps {
  order: Order;
  onSelectOrder: (order: Order) => void;
}

export const ClientOrderCard: React.FC<ClientOrderCardProps> = ({
  order,
  onSelectOrder
}) => {
  const { products, setSelectedProduct } = useApp();

  const firstItem = order.items[0];
  const otherItemsCount = order.items.length - 1;

  const matchedProduct = useMemo(() => {
    if (!firstItem?.productId || !products?.length) return undefined;
    return products.find((p) => p.id === firstItem.productId);
  }, [products, firstItem?.productId]);

  const paymentBadge = OrderService.getPaymentStatusBadge(order.paymentStatus, order.paymentMode);

  const fallbackImage = 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600';
  const imageUrl =
    firstItem?.productImage ||
    matchedProduct?.images[0] ||
    matchedProduct?.videoPoster ||
    fallbackImage;
  const productTitle = firstItem?.productTitle || matchedProduct?.name || 'Article commandé';

  return (
    <div
      id={`client-order-card-${order.id}`}
      onClick={() => onSelectOrder(order)}
      className="relative group rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-900 border border-white/10 hover:border-emerald-500/60 transition-all duration-200 cursor-pointer shadow-xl flex flex-col justify-between aspect-[9/13.5]"
    >
      {/* Background Product Image */}
      <img
        src={imageUrl}
        alt={productTitle}
        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
        loading="lazy"
      />

      {/* Dark gradient for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-black/55 pointer-events-none" />

      {/* TOP BAR OVERLAY */}
      <div className="relative z-10 p-2.5 flex items-start justify-between gap-1.5">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="px-2 py-1 rounded-full bg-emerald-500 text-white text-[8.5px] font-black uppercase tracking-wider shadow-lg shadow-emerald-950/60 flex items-center gap-1 backdrop-blur-md">
            <span>✓</span>
            <span>Commande confirmée</span>
          </span>
          {otherItemsCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#FF6321] text-white text-[9px] font-black shadow-md">
              +{otherItemsCount}
            </span>
          )}
        </div>

        {/* Top-right: Receipt / Details button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectOrder(order);
          }}
          className="w-7 h-7 rounded-full bg-black/60 backdrop-blur-md border border-white/20 hover:bg-emerald-500 hover:text-black flex items-center justify-center text-white/80 active:scale-75 transition shadow-lg shrink-0"
          title="Détails & reçu"
          aria-label="Détails & reçu"
        >
          <Receipt className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* BOTTOM CONTENT OVERLAY */}
      <div className="relative z-10 p-2.5 sm:p-3 space-y-1.5">
        {/* Product Title */}
        <h3 className="font-extrabold text-white leading-tight drop-shadow-md break-words text-xs line-clamp-2">
          {productTitle}
        </h3>

        {/* Price and "Voir produit" button */}
        <div className="flex items-center justify-between gap-1.5 pt-0.5">
          <span className="font-black text-[#FF6321] drop-shadow-sm text-xs">
            {formatFCFA(order.total)}
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (matchedProduct) {
                setSelectedProduct(matchedProduct);
              } else {
                onSelectOrder(order);
              }
            }}
            className="shrink-0 px-2.5 py-1 rounded-full bg-[#FF6321] hover:bg-[#ff7538] active:scale-95 text-white text-[9px] font-extrabold shadow-md shadow-orange-600/30 transition"
          >
            Voir produit
          </button>
        </div>

        {/* Order number & Independent Payment Status */}
        <div className="flex items-center justify-between gap-1 text-[9px] pt-0.5">
          <span className="text-white/60 truncate font-medium">
            #{order.orderNumber}
          </span>

          <span
            className={`px-1.5 py-0.5 rounded-md text-[8.5px] font-bold border shrink-0 ${paymentBadge.bgColor} ${paymentBadge.color}`}
          >
            {paymentBadge.label}
          </span>
        </div>

        {/* Quick Detail Link */}
        <div className="pt-1 flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectOrder(order);
            }}
            className="w-full py-1 px-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 text-[9px] font-bold flex items-center justify-center gap-1 border border-white/10 transition"
          >
            <FileText className="w-3 h-3 text-emerald-400" />
            <span>Détails & Reçu</span>
            <ChevronRight className="w-2.5 h-2.5 text-white/50 ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
