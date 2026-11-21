import React, { useState, useRef } from 'react';
import {
  X,
  Phone,
  MapPin,
  Copy,
  Check,
  Receipt,
  Camera,
  ShoppingBag,
  MessageCircle,
  CheckCircle2,
  CreditCard,
  Banknote,
  Truck,
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import { Order, Product, Seller } from '../../../types';
import {
  formatFCFA,
  OrderService,
  formatOrderDate,
  formatOrderTime,
} from '../../../services/marketServices';

interface Props {
  order: Order;
  products: Product[];
  seller?: Seller;
  parcelPhoto?: string;
  onClose: () => void;
  onOpenReceipt: (order: Order) => void;
  onUploadParcelPhoto?: (orderId: string, photoDataUrl: string) => void;
  onContactClient: (phone: string, name: string, openChat?: boolean) => void;
}

export const SellerOrderDetailModal: React.FC<Props> = ({
  order,
  products,
  seller,
  parcelPhoto,
  onClose,
  onOpenReceipt,
  onUploadParcelPhoto,
  onContactClient,
}) => {
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedOrderNum, setCopiedOrderNum] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const statusBadge = OrderService.getStatusBadge(order.status);
  const paymentMode =
    order.paymentMode ||
    (order.paymentMethod === 'cash_on_delivery' || order.paymentStatus === 'cod_pending'
      ? 'cod'
      : 'online');
  const isCod = paymentMode === 'cod';
  const paymentBadge = OrderService.getPaymentStatusBadge(order.paymentStatus, paymentMode);

  const subtotal =
    order.subtotal ?? order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = order.discount || 0;
  const clientFeeFcfa = isCod ? 0 : order.clientFeeFcfa ?? order.serviceFee ?? 0;
  const commissionFcfa = order.commissionFcfa ?? 150;
  const sellerNetFcfa =
    order.sellerNetFcfa ?? Math.max(0, subtotal - discount - commissionFcfa);

  const paymentMethodLabel = isCod
    ? 'Paiement à la livraison (Espèces / Direct)'
    : order.paymentMethod === 'orange_money'
    ? 'Paiement en ligne — Orange Money CI'
    : 'Paiement en ligne — Wave CI';

  const handleCopyText = (text: string, type: 'phone' | 'order') => {
    navigator.clipboard?.writeText?.(text);
    if (type === 'phone') {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } else {
      setCopiedOrderNum(true);
      setTimeout(() => setCopiedOrderNum(false), 2000);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadParcelPhoto) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onUploadParcelPhoto(order.id, reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div
      id="order-detail-modal-backdrop"
      className="fixed inset-0 z-[140] bg-[#0A0A0A] flex flex-col overflow-hidden animate-fadeIn"
    >
      {/* Top Bar */}
      <header className="px-4 sm:px-6 py-3.5 border-b border-white/10 bg-[#121212] flex items-center justify-between gap-3 shrink-0 shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition shrink-0"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-black text-white font-mono truncate">
                Commande #{order.orderNumber}
              </h2>
              <button
                onClick={() => handleCopyText(order.orderNumber, 'order')}
                className="text-white/40 hover:text-white transition"
                title="Copier le n° de commande"
              >
                {copiedOrderNum ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${statusBadge.bgColor} ${statusBadge.color}`}
              >
                {statusBadge.label}
              </span>
            </div>
            <p className="text-[11px] text-white/50 truncate mt-0.5">
              Enregistrée le {formatOrderDate(order.createdAt)} à {formatOrderTime(order.createdAt)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpenReceipt(order)}
          className="px-3.5 py-2 rounded-xl bg-[#FF6321] hover:bg-[#ff7438] text-white font-black text-xs transition flex items-center gap-1.5 shadow-lg shadow-[#FF6321]/25 shrink-0"
        >
          <Receipt className="w-4 h-4" />
          <span className="hidden sm:inline">Reçu officiel vendeur</span>
          <span className="sm:hidden">Reçu</span>
        </button>
      </header>

      {/* Scrollable Body */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl w-full mx-auto space-y-5 no-scrollbar pb-28">
        {/* 1. PAYMENT MODE & STATUS CALLOUT */}
        <section
          className={`p-4 sm:p-5 rounded-3xl border space-y-3 ${
            isCod
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-emerald-500/10 border-emerald-500/30'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  isCod ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                }`}
              >
                {isCod ? <Banknote className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-white/60">
                  MODE DE PAIEMENT
                </p>
                <h3 className="text-sm font-black text-white">{paymentMethodLabel}</h3>
              </div>
            </div>

            <span
              className={`px-3 py-1 rounded-full text-[11px] font-black border ${paymentBadge.bgColor} ${paymentBadge.color}`}
            >
              {paymentBadge.label}
            </span>
          </div>

          {isCod ? (
            <div className="p-3 rounded-2xl bg-black/40 border border-amber-500/20 text-xs text-amber-200 space-y-1">
              <p className="font-bold">
                Le client paiera directement à la réception — Montant à encaisser :{' '}
                <span className="font-mono text-white">{formatFCFA(order.total)}</span>
              </p>
              <p className="text-[11px] text-white/60">
                Commission DJASSA due sur cette commande :{' '}
                <span className="font-mono font-bold text-[#FF6321]">
                  {formatFCFA(commissionFcfa)}
                </span>{' '}
                (statut : {order.commissionStatus || 'pending'})
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-black/40 border border-emerald-500/20 text-xs text-white/80 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-white/50 block">Référence transaction :</span>
                <span className="font-mono font-bold text-white">
                  {order.paymentId || `TXN-${order.orderNumber}`}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-white/50 block">Reversement vendeur :</span>
                <span className="font-bold text-emerald-300 uppercase">
                  {order.sellerPayoutStatus || 'pending'}
                  {order.sellerPayoutReference ? ` • ${order.sellerPayoutReference}` : ''}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* 2. CLIENT & SELLER-MANAGED EXTERNAL DELIVERY */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 sm:p-5 rounded-3xl bg-[#141414] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                Client & Adresse de livraison
              </span>
              <button
                type="button"
                onClick={() => handleCopyText(order.deliveryAddress.phone, 'phone')}
                className="text-[10px] text-white/60 hover:text-white flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg"
              >
                {copiedPhone ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{order.deliveryAddress.phone}</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <img
                src={OrderService.getClientAvatar(order)}
                alt={order.deliveryAddress.recipientName}
                className="w-12 h-12 rounded-2xl object-cover border border-cyan-400/40 shrink-0"
              />
              <div className="min-w-0">
                <h4 className="text-sm font-black text-white truncate">
                  {order.deliveryAddress.recipientName}
                </h4>
                <p className="text-xs text-white/70 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-[#FF6321] shrink-0" />
                  <span>
                    {order.deliveryAddress.commune}
                    {order.deliveryAddress.quartier ? ` • ${order.deliveryAddress.quartier}` : ''}
                  </span>
                </p>
                {order.deliveryAddress.details && (
                  <p className="text-[11px] text-white/50 mt-1">{order.deliveryAddress.details}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() =>
                  onContactClient(order.deliveryAddress.phone, order.deliveryAddress.recipientName, true)
                }
                className="flex-1 py-2.5 rounded-xl bg-[#FF6321]/15 hover:bg-[#FF6321]/25 text-[#FF6321] border border-[#FF6321]/30 font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Chat DJASSA</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onContactClient(order.deliveryAddress.phone, order.deliveryAddress.recipientName, false)
                }
                className="py-2.5 px-4 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Appeler</span>
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-3xl bg-[#141414] border border-white/10 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[#FF6321]">
                <Truck className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-wider">
                  Livraison externe gérée par votre boutique
                </span>
              </div>
              <p className="text-xs text-white/75 leading-relaxed">
                Sur DJASSA, votre boutique organise librement l&apos;expédition et la remise au client à
                l&apos;extérieur de la plateforme. Aucun livreur ni frais de livraison DJASSA (0 FCFA)
                ne s&apos;ajoute.
              </p>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-[11px] text-emerald-300 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Statut commande : Commande confirmée</span>
              </div>
            </div>

            {seller && (
              <div className="pt-2 border-t border-white/5 text-[11px] text-white/50 flex items-center justify-between">
                <span>Boutique expéditrice :</span>
                <strong className="text-white">{seller.storeName || seller.name}</strong>
              </div>
            )}
          </div>
        </section>

        {/* 3. INCIDENT BANNER IF APPLICABLE */}
        {order.incident && (
          <section className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-black text-rose-300">
                Signalement enregistré ({order.incident.type})
              </p>
              <p className="text-white/80">{order.incident.reason}</p>
            </div>
          </section>
        )}

        {/* 4. ORDERED ITEMS */}
        <section className="p-4 sm:p-5 rounded-3xl bg-[#141414] border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#FF6321]" />
              <span>Articles commandés ({order.items.length})</span>
            </h3>
          </div>

          <div className="space-y-2.5">
            {order.items.map((item, idx) => {
              const matchedProd = products.find((p) => p.id === item.productId);
              return (
                <div
                  key={`${item.productId}-${idx}`}
                  className="p-3 rounded-2xl bg-black/40 border border-white/10 flex items-center gap-3"
                >
                  <img
                    src={
                      item.productImage ||
                      matchedProd?.images?.[0] ||
                      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300'
                    }
                    alt={item.productTitle}
                    className="w-14 h-14 rounded-xl object-cover border border-white/10 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                      {item.productTitle}
                    </h4>
                    {item.variant && Object.keys(item.variant).length > 0 && (
                      <p className="text-[10px] text-white/50 mt-0.5">
                        {Object.entries(item.variant)
                          .filter(([, v]) => Boolean(v))
                          .map(([k, v]) => `${k} : ${v}`)
                          .join(' • ')}
                      </p>
                    )}
                    <p className="text-[11px] text-white/60 mt-1">
                      {item.quantity} × {formatFCFA(item.price)}
                    </p>
                  </div>
                  <div className="text-right font-mono font-black text-xs sm:text-sm text-[#FF6321] shrink-0">
                    {formatFCFA(item.price * item.quantity)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 5. FINANCIAL SUMMARY */}
        <section className="p-4 sm:p-5 rounded-3xl bg-[#141414] border border-white/10 space-y-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-black text-white">Récapitulatif Financier</h3>
          </div>

          <div className="space-y-2 text-xs text-white/75">
            <div className="flex justify-between">
              <span>Sous-total articles :</span>
              <span className="font-mono text-white">{formatFCFA(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Remise promotionnelle :</span>
                <span className="font-mono">-{formatFCFA(discount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Frais de livraison DJASSA :</span>
              <span className="font-mono text-emerald-400 font-bold">0 FCFA</span>
            </div>
            {!isCod && clientFeeFcfa > 0 && (
              <div className="flex justify-between">
                <span>Frais de paiement en ligne payés par le client (6,5%) :</span>
                <span className="font-mono text-white">+{formatFCFA(clientFeeFcfa)}</span>
              </div>
            )}
            <div className="flex justify-between text-purple-300 font-semibold">
              <span>Commission fixe DJASSA :</span>
              <span className="font-mono">-{formatFCFA(commissionFcfa)}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] text-white/50 uppercase font-bold block">
                {isCod ? 'Montant à encaisser à la réception' : 'Total payé par le client'}
              </span>
              <span className="text-lg font-black text-white font-mono">
                {formatFCFA(order.total)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-emerald-400 uppercase font-black block">
                Net vendeur après commission (150 F)
              </span>
              <span className="text-xl font-black text-emerald-400 font-mono">
                {formatFCFA(sellerNetFcfa)}
              </span>
            </div>
          </div>
        </section>

        {/* 6. OPTIONAL PARCEL PHOTO */}
        {onUploadParcelPhoto && (
          <section className="p-4 sm:p-5 rounded-3xl bg-[#141414] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#FF6321]" />
                <h3 className="text-sm font-black text-white">Photo du colis préparé (optionnel)</h3>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white transition"
              >
                {parcelPhoto ? 'Changer la photo' : 'Ajouter une photo'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            {parcelPhoto ? (
              <img
                src={parcelPhoto}
                alt="Preuve de préparation du colis"
                className="w-full max-h-56 object-cover rounded-2xl border border-white/10"
              />
            ) : (
              <p className="text-[11px] text-white/45">
                Ajoutez une photo du colis emballé avant l&apos;expédition organisée par votre boutique.
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
};
