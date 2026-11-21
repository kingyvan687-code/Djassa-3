import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  Clock,
  Copy,
  Download,
  Home,
  Loader2,
  Package,
  Phone,
  Printer,
  Share2,
  ShieldCheck,
  Store,
  User
} from 'lucide-react';
import { Order, Seller } from '../../types';
import { OrderService, formatFCFA } from '../../services/marketServices';
import { getCheckoutPalette } from './checkout/checkoutTypes';
import {
  CashOnDeliveryLogo,
  ConfirmationCheckOrb,
  DjassaBagLogo,
  LocationPinIcon3D,
  OrangeMoneyLogo,
  PaymentMethodBadge,
  PaymentWalletGreenIcon,
  SummaryCalculatorIcon,
  VerificationCubeIcon,
  VerifiedBlueSeal,
  WaveLogo,
  getPaymentMethodInfo
} from './checkout/PaymentBrandLogos';

export interface ClientOrderReceiptModalProps {
  order: Order;
  seller?: Seller;
  onClose: () => void;
  onShowToast?: (message: string) => void;
}

export const ClientOrderReceiptModal: React.FC<ClientOrderReceiptModalProps> = ({
  order,
  seller,
  onClose,
  onShowToast
}) => {
  const pal = getCheckoutPalette('client');
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const notify = (msg: string) => {
    onShowToast?.(msg);
  };

  const orderDateObj = useMemo(() => {
    return order.createdAt ? new Date(order.createdAt) : new Date();
  }, [order.createdAt]);

  const orderDateFormatted = useMemo(() => {
    if (!isNaN(orderDateObj.getTime())) {
      const day = String(orderDateObj.getDate()).padStart(2, '0');
      const month = String(orderDateObj.getMonth() + 1).padStart(2, '0');
      const year = orderDateObj.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return order.createdAt || 'Date confirmée';
  }, [orderDateObj, order.createdAt]);

  const orderTimeFormatted = useMemo(() => {
    return !isNaN(orderDateObj.getTime())
      ? orderDateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : '';
  }, [orderDateObj]);

  const totalQuantity = useMemo(
    () => order.items.reduce((sum, it) => sum + Math.max(1, it.quantity || 1), 0),
    [order.items]
  );

  const isCod =
    order.paymentMode === 'cod' ||
    order.paymentMethod === 'cash_on_delivery' ||
    order.paymentStatus === 'cod_pending';
  const subtotal =
    order.subtotal ?? order.items.reduce((sum, it) => sum + it.price * it.quantity, 0);
  const discount = order.discount ?? 0;
  const clientOnlineFee = !isCod ? order.clientFeeFcfa ?? order.serviceFee ?? 0 : 0;
  const totalAmount =
    order.total ?? Math.max(0, subtotal - discount + clientOnlineFee);

  const paymentBadge = OrderService.getPaymentStatusBadge(order.paymentStatus, order.paymentMode);
  const paymentInfo = getPaymentMethodInfo(order.paymentMethod);

  const sellerName =
    seller?.storeName || seller?.name || order.items[0]?.sellerName || 'Boutique DJASSA';

  const handleCopyOrderNumber = () => {
    navigator.clipboard?.writeText?.(order.orderNumber);
    setCopiedNumber(true);
    notify(`Numéro de commande #${order.orderNumber} copié !`);
    setTimeout(() => setCopiedNumber(false), 1800);
  };

  const handlePrint = () => {
    window.print?.();
  };

  const handleDownload = () => {
    setIsDownloading(true);
    setTimeout(() => {
      setIsDownloading(false);
      notify(`Reçu client #${order.orderNumber} téléchargé avec succès !`);
    }, 600);
  };

  const handleShare = () => {
    const textToShare = `Reçu Client DJASSA - #${order.orderNumber} (${formatFCFA(totalAmount)}) - Statut : Commande confirmée - ${orderDateFormatted}`;
    if (navigator.share) {
      navigator
        .share({
          title: `Reçu DJASSA - #${order.orderNumber}`,
          text: textToShare,
          url: window.location.href
        })
        .catch(() => {
          notify('Détails du reçu prêts à être partagés.');
        });
    } else {
      navigator.clipboard?.writeText?.(textToShare);
      notify('Détails du reçu copiés dans le presse-papier !');
    }
  };

  return (
    <div
      id="djassa-official-receipt-modal-overlay"
      className={`fixed inset-0 z-[3100] ${pal.pageBg} text-white flex flex-col overflow-hidden`}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: pal.pageGlow }}
      />

      <div
        id="djassa-official-receipt-modal-content"
        className="relative z-10 flex flex-col flex-1 min-h-0"
      >
        {/* HEADER */}
        <header className={`sticky top-0 z-30 ${pal.headerBg} shrink-0`}>
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-80"
            style={{ background: pal.headerGlow }}
          />
          <div className="relative max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-2">
            <button
              id="btn-close-official-receipt"
              type="button"
              onClick={onClose}
              aria-label="Retour"
              className={`w-11 h-11 rounded-full ${pal.headerIconBtn} flex items-center justify-center text-white transition active:scale-95 shrink-0`}
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.4]" />
            </button>

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-full bg-[#FF6321]/30 blur-md" />
                <DjassaBagLogo className="relative w-9 h-9 drop-shadow-[0_4px_12px_rgba(255,99,33,0.45)]" />
              </div>
              <div className="min-w-0">
                <div className="text-[18px] font-black tracking-wide text-white leading-none">
                  DJASSA
                </div>
                <div className="text-[10.5px] font-medium text-white/65 leading-tight mt-0.5 truncate">
                  Reçu client officiel
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleShare}
                aria-label="Partager le reçu"
                className={`w-11 h-11 rounded-full ${pal.headerIconBtn} flex items-center justify-center text-white/90 transition active:scale-95`}
                title="Partager"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handlePrint}
                aria-label="Imprimer le reçu"
                className={`w-11 h-11 rounded-full ${pal.outlineAccentBtn} flex items-center justify-center transition active:scale-95`}
                title="Imprimer"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main className="flex-1 overflow-y-auto no-scrollbar select-text">
          <div className="max-w-lg mx-auto px-4 pt-4 pb-8 space-y-3.5">
            {/* A. STATUT COMMANDE & RÉFÉRENCES */}
            <section
              id="printable-official-receipt-voucher"
              className={`${pal.card} p-4 space-y-3.5`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <ConfirmationCheckOrb accent="orange" className="w-11 h-11 shrink-0" />
                  <div className="min-w-0">
                    <h1 className="text-[16px] font-extrabold text-white leading-tight tracking-tight truncate">
                      Commande confirmée
                    </h1>
                    <p className="text-xs text-white/60 mt-0.5 truncate">
                      {isCod ? 'Paiement à la livraison' : `Paiement en ligne • ${paymentInfo.label}`}
                    </p>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-[10.5px] font-extrabold border shrink-0 ${paymentBadge.bgColor} ${paymentBadge.color}`}
                >
                  {paymentBadge.label}
                </span>
              </div>

              <div className={`p-3 rounded-2xl ${pal.innerWell} space-y-2.5 text-xs`}>
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/[0.08]">
                  <span className="text-white/60">Numéro de commande</span>
                  <button
                    type="button"
                    onClick={handleCopyOrderNumber}
                    className={`flex items-center gap-1.5 font-mono font-black text-sm ${pal.accentText} transition active:scale-95`}
                  >
                    <span>#{order.orderNumber}</span>
                    {copiedNumber ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-white/55" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-white/60 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-white/45" />
                    <span>Date & heure</span>
                  </span>
                  <span className="font-bold text-white tabular-nums">
                    {orderDateFormatted}
                    {orderTimeFormatted ? ` · ${orderTimeFormatted}` : ''}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-white/60">Statut commande</span>
                  <span className="font-extrabold text-emerald-400">Commande confirmée</span>
                </div>
              </div>
            </section>

            {/* B. ARTICLES */}
            <section className={`${pal.card} p-4 space-y-3`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <VerificationCubeIcon accent="orange" className="w-7 h-7 shrink-0" />
                  <h2 className="text-[15px] font-extrabold text-white tracking-tight">
                    Produits commandés ({totalQuantity})
                  </h2>
                </div>
                <span className="text-xs font-bold text-white/60 tabular-nums">
                  {order.items.length} réf.
                </span>
              </div>

              <div className="space-y-2.5">
                {order.items.map((item, idx) => {
                  const variantEntries = item.variant
                    ? Object.entries(item.variant).filter(([, v]) => Boolean(v))
                    : [];

                  return (
                    <div
                      key={`${item.productId}-${idx}`}
                      className={`p-3 rounded-2xl ${pal.innerWell} flex items-center gap-3`}
                    >
                      <div
                        className={`relative w-18 h-18 rounded-2xl overflow-hidden ${pal.thumbFrame} shrink-0`}
                      >
                        {item.productImage ? (
                          <img
                            src={item.productImage}
                            alt={item.productTitle}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/30">
                            <Package className="w-6 h-6" />
                          </div>
                        )}
                        <span
                          className={`absolute top-1 left-1 px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums ${pal.promoBadge}`}
                        >
                          x{item.quantity}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <h3 className="text-[13.5px] font-extrabold text-white truncate">
                          {item.productTitle}
                        </h3>

                        <div className="flex items-center gap-1.5 text-[11px] text-white/65">
                          <span className="truncate">{item.sellerName || sellerName}</span>
                          {seller?.verified && <VerifiedBlueSeal className="w-3.5 h-3.5 shrink-0" />}
                        </div>

                        {variantEntries.length > 0 && (
                          <p className="text-[10.5px] text-white/55 truncate">
                            {variantEntries.map(([k, v]) => `${k}: ${v}`).join(' · ')}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-0.5 text-xs tabular-nums">
                          <span className="text-white/50">{formatFCFA(item.price)} / u</span>
                          <span className="font-black text-white">
                            {formatFCFA(item.price * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* C. BOUTIQUE & ADRESSE CLIENT (LIVRAISON GÉRÉE PAR LE VENDEUR) */}
            <section className={`${pal.card} p-4 space-y-3`}>
              <div className="flex items-center gap-2.5">
                <LocationPinIcon3D accent="orange" className="w-6 h-6 shrink-0" />
                <h2 className="text-[15px] font-extrabold text-white tracking-tight">
                  Boutique & Livraison
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className={`p-3 rounded-2xl ${pal.innerWell} space-y-1.5 text-xs`}>
                  <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold text-white/55">
                    <Store className={`w-3.5 h-3.5 ${pal.accentText}`} />
                    <span>Vendeur / Boutique</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-extrabold text-white">
                    <span className="truncate">{sellerName}</span>
                    {seller?.verified && <VerifiedBlueSeal className="w-3.5 h-3.5 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-white/65 truncate">
                    {seller?.location || 'Abidjan, Côte d’Ivoire'}
                  </p>
                  {seller?.phone && (
                    <p className="text-[11px] text-white/75 tabular-nums flex items-center gap-1.5">
                      <Phone className="w-3 h-3 text-white/45 shrink-0" />
                      <span>{seller.phone}</span>
                    </p>
                  )}
                </div>

                <div className={`p-3 rounded-2xl ${pal.innerWell} space-y-1.5 text-xs`}>
                  <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold text-white/55">
                    <User className={`w-3.5 h-3.5 ${pal.accentText}`} />
                    <span>Client / Destinataire</span>
                  </div>
                  <div className="font-extrabold text-white truncate">
                    {order.deliveryAddress?.recipientName || 'Client DJASSA'}
                  </div>
                  <p className="text-[11px] text-white/65 truncate">
                    {order.deliveryAddress?.commune || 'Abidjan'} —{' '}
                    {order.deliveryAddress?.quartier || ''}
                  </p>
                  <p className="text-[11px] text-white/75 tabular-nums flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-white/45 shrink-0" />
                    <span>{order.deliveryAddress?.phone || 'Non renseigné'}</span>
                  </p>
                </div>
              </div>

              <div className={`p-3 rounded-2xl ${pal.innerWell} space-y-1 text-xs`}>
                <div className="flex items-start gap-2 text-white/85">
                  <Home className="w-3.5 h-3.5 text-white/50 shrink-0 mt-0.5" />
                  <span className="leading-snug">
                    {order.deliveryAddress?.details || 'Adresse de livraison client'}
                    {order.deliveryAddress?.landmark
                      ? ` (Repère : ${order.deliveryAddress.landmark})`
                      : ''}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-400/90 pl-5 font-semibold">
                  Livraison organisée directement par le vendeur à l’extérieur de DJASSA (0 FCFA).
                </p>
              </div>
            </section>

            {/* D. RÉCAPITULATIF FINANCIER */}
            <section className={`${pal.card} p-4 space-y-3.5`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <SummaryCalculatorIcon accent="orange" className="w-6 h-6 shrink-0" />
                  <h2 className="text-[15px] font-extrabold text-white tracking-tight">
                    Détail du paiement
                  </h2>
                </div>
                <span className={`text-xs font-extrabold ${paymentBadge.color}`}>
                  {paymentBadge.label}
                </span>
              </div>

              <div className={`p-3 rounded-2xl ${pal.innerWell} flex items-center justify-between gap-3`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <PaymentMethodBadge method={order.paymentMethod} className="w-10 h-10 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-white truncate">
                      {isCod ? 'Paiement à la livraison' : `Paiement en ligne • ${paymentInfo.label}`}
                    </div>
                    <div className="text-[10.5px] text-white/55 truncate">
                      {isCod ? '0% frais client — Règlement direct à réception' : paymentInfo.shortSubtitle}
                    </div>
                  </div>
                </div>
                <PaymentWalletGreenIcon accent="orange" className="w-5 h-5 shrink-0 opacity-85" />
              </div>

              <div className="space-y-2 text-[13px]">
                <div className="flex items-center justify-between text-white/75">
                  <span>Sous-total articles ({totalQuantity})</span>
                  <span className="font-extrabold text-white tabular-nums">
                    {formatFCFA(subtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-white/75">
                  <span>Frais de livraison DJASSA</span>
                  <span className="font-extrabold text-emerald-400 tabular-nums">0 FCFA</span>
                </div>
                {!isCod && clientOnlineFee > 0 && (
                  <div className="flex items-center justify-between text-white/75">
                    <span>Frais client (6,5% en ligne)</span>
                    <span className="font-extrabold text-white tabular-nums">
                      + {formatFCFA(clientOnlineFee)}
                    </span>
                  </div>
                )}
                {discount > 0 && (
                  <div className={`flex items-center justify-between font-bold ${pal.accentText}`}>
                    <span>Réduction{order.promoCode ? ` (${order.promoCode})` : ''}</span>
                    <span className="font-extrabold tabular-nums">- {formatFCFA(discount)}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-white/[0.09] flex items-center justify-between">
                <span className="text-[15px] font-extrabold text-white">
                  {isCod ? 'Montant à payer à la réception' : 'Montant total'}
                </span>
                <span className={`text-xl font-black ${pal.accentText} tabular-nums`}>
                  {formatFCFA(totalAmount)}
                </span>
              </div>
            </section>

            {/* E. SCEAU D'AUTHENTICITÉ */}
            <section className={`${pal.securityCard} flex items-center justify-between gap-2`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl ${pal.iconBox} ${pal.accentTextBright} flex items-center justify-center shrink-0`}
                >
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-white">Reçu certifié DJASSA</div>
                  <div className="text-[10.5px] text-white/60 font-mono truncate">
                    #{order.orderNumber}
                    {order.paymentTransactionRef ? ` · ${order.paymentTransactionRef}` : ''}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <WaveLogo className="w-6 h-6" />
                <OrangeMoneyLogo className="w-6 h-6" />
                <CashOnDeliveryLogo className="w-6 h-6" />
              </div>
            </section>

            {/* ACTIONS */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className={`min-h-[52px] px-5 rounded-full ${pal.secondaryBtn} font-bold text-sm flex items-center justify-center transition active:scale-95 shrink-0`}
                >
                  Fermer
                </button>

                <button
                  type="button"
                  disabled={isDownloading}
                  onClick={handleDownload}
                  className={`flex-1 min-h-[52px] py-3 px-6 rounded-full ${pal.primaryBtn} font-black text-[15px] flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-60`}
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Téléchargement...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 stroke-[2.5]" />
                      <span>Télécharger le reçu</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
