import React, { useState, useMemo } from 'react';
import {
  X,
  Package,
  MapPin,
  Phone,
  MessageCircle,
  Check,
  ShieldCheck,
  Copy,
  ShoppingBag,
  Maximize2,
  Minimize2,
  Store,
  Info,
  Printer,
  User,
  Home,
  Star,
  Percent,
  ShoppingCart,
  CreditCard,
  RefreshCw,
  Loader2,
  ExternalLink,
  Banknote
} from 'lucide-react';
import { Order } from '../../types';
import { useApp } from '../../context/AppContext';
import { commerceService } from '../../services/commerceService';
import { ClientOrderReceiptModal } from './ClientOrderReceiptModal';
import {
  OrderService,
  formatFCFA,
  formatMetricCount,
  formatOrderFullDateTime
} from '../../services/marketServices';
import { getCheckoutPalette } from './checkout/checkoutTypes';
import {
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

interface OrderDetailModalProps {
  order: Order;
  onClose: () => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ order, onClose }) => {
  const {
    cancelOrder,
    startCall,
    openChatWithSeller,
    showToast,
    submitOrderReview,
    sellers,
    setSelectedSeller,
    setSelectedOrder
  } = useApp();

  const [liveOrder, setLiveOrder] = useState<Order>(order);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [showFeeTooltip, setShowFeeTooltip] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const [isRefreshingPayment, setIsRefreshingPayment] = useState(false);
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);
  const [retryMethod, setRetryMethod] = useState<'wave' | 'orange_money'>(
    order.paymentMethod === 'orange_money' ? 'orange_money' : 'wave'
  );
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  // Review states
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isReviewSubmitted, setIsReviewSubmitted] = useState(false);

  const pal = useMemo(() => getCheckoutPalette('client'), []);
  const paymentInfo = useMemo(() => getPaymentMethodInfo(liveOrder.paymentMethod), [liveOrder.paymentMethod]);
  const paymentBadge = useMemo(
    () => OrderService.getPaymentStatusBadge(liveOrder.paymentStatus, liveOrder.paymentMode),
    [liveOrder.paymentStatus, liveOrder.paymentMode]
  );

  const isCod =
    liveOrder.paymentMode === 'cod' ||
    liveOrder.paymentMethod === 'cash_on_delivery' ||
    liveOrder.paymentStatus === 'cod_pending';
  const isPaid = liveOrder.paymentStatus === 'paid';
  const clientOnlineFee = liveOrder.clientFeeFcfa ?? liveOrder.serviceFee ?? 0;

  const totalItemsQuantity = useMemo(
    () => liveOrder.items.reduce((sum, it) => sum + (it.quantity || 1), 0),
    [liveOrder.items]
  );

  const primarySellerId = liveOrder.items[0]?.sellerId;
  const primarySellerName = liveOrder.items[0]?.sellerName || 'Boutique DJASSA';
  const seller = useMemo(() => {
    return (
      sellers.find(
        (s) =>
          s.id === primarySellerId ||
          s.name === primarySellerName ||
          s.storeName === primarySellerName
      ) || null
    );
  }, [sellers, primarySellerId, primarySellerName]);

  const sellerDisplayName = seller?.storeName || seller?.name || primarySellerName;
  const sellerAddress = seller?.location || 'Abidjan, Côte d’Ivoire';
  const sellerAvatar =
    seller?.avatar ||
    liveOrder.sellerAvatar ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200';

  const creationFullDateTime = formatOrderFullDateTime(liveOrder.createdAt);

  const handleCopyOrderNumber = () => {
    navigator.clipboard?.writeText?.(liveOrder.orderNumber);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2000);
    showToast('Numéro de commande copié !');
  };

  const handleRefreshPayment = async () => {
    setIsRefreshingPayment(true);
    try {
      const res = await commerceService.getOrderStatus(liveOrder.id);
      if (res?.order) {
        const nextStatus = res.payment?.status || res.order.paymentStatus || liveOrder.paymentStatus;
        if (res.payment?.checkoutUrl || res.payment?.paymentUrl) {
          setCheckoutUrl(res.payment.checkoutUrl || res.payment.paymentUrl);
        }
        const updated: Order = {
          ...liveOrder,
          paymentStatus: nextStatus,
          paymentMethod: res.order.paymentMethod || liveOrder.paymentMethod,
          paymentTransactionRef: res.order.paymentTransactionRef || liveOrder.paymentTransactionRef,
          visibleStatus: 'Commande confirmée'
        };
        setLiveOrder(updated);
        setSelectedOrder(updated);
        showToast(
          nextStatus === 'paid'
            ? 'Paiement confirmé par le serveur.'
            : 'Statut de paiement actualisé.'
        );
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de l’actualisation.');
    } finally {
      setIsRefreshingPayment(false);
    }
  };

  const handleRetryOnlinePayment = async () => {
    setIsRetryingPayment(true);
    try {
      const res = await commerceService.retryOrderPayment(liveOrder.id, retryMethod);
      const nextStatus = res.payment?.status || res.order?.paymentStatus || 'pending';
      const url = res.paymentUrl || res.checkoutUrl || res.payment?.checkoutUrl || null;
      if (url) setCheckoutUrl(url);
      const updated: Order = {
        ...liveOrder,
        paymentMode: 'online',
        paymentMethod: retryMethod,
        paymentStatus: nextStatus,
        visibleStatus: 'Commande confirmée'
      };
      setLiveOrder(updated);
      setSelectedOrder(updated);
      showToast(
        res.alreadyPaid
          ? 'Commande déjà réglée.'
          : url
          ? 'Lien de paiement GeniusPay prêt ci-dessous.'
          : 'Nouvelle tentative initialisée.'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Impossible de relancer le paiement.');
    } finally {
      setIsRetryingPayment(false);
    }
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitOrderReview(liveOrder.id, reviewRating, reviewComment.trim());
    setIsReviewSubmitted(true);
    showToast('Avis enregistré avec succès ! Merci pour votre retour');
  };

  return (
    <div
      id="order-detail-backdrop"
      className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-md flex justify-center items-end sm:items-center p-0 sm:p-3 animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="order-detail-container"
        className={`bg-[#0E0E11] text-white border-t sm:border border-white/15 w-full flex flex-col shadow-2xl overflow-hidden transition-all duration-300 ${
          isFullscreen
            ? 'h-full max-h-full rounded-none'
            : 'max-w-2xl h-[95vh] max-h-[95vh] rounded-t-3xl sm:rounded-3xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <header className="px-4 py-3 bg-[#141418] border-b border-white/10 shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-[#FF6321]/15 border border-[#FF6321]/30 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-[#FF6321]" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xs sm:text-sm font-black text-white font-mono truncate">
                  #{liveOrder.orderNumber}
                </h2>
                <button
                  onClick={handleCopyOrderNumber}
                  className="text-white/40 hover:text-white transition p-0.5"
                  title="Copier le numéro"
                >
                  {copiedNumber ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full border bg-emerald-500/15 border-emerald-500/35 text-emerald-400">
                  Commande confirmée
                </span>
              </div>
              <p className="text-[10px] text-white/50 truncate flex items-center gap-1.5 mt-0.5">
                <span>{creationFullDateTime}</span>
                <span>•</span>
                <span className="text-[#FF6321] font-bold">{formatFCFA(liveOrder.total)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsReceiptOpen(true)}
              className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-[#FF6321] text-white text-xs font-bold transition flex items-center gap-1 active:scale-95 group/rec"
              title="Voir le reçu client"
            >
              <Printer className="w-3.5 h-3.5 text-[#FF6321] group-hover/rec:text-white transition" />
              <span>Reçu</span>
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition"
              title={isFullscreen ? 'Réduire' : 'Plein écran'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              id="btn-close-order-detail"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* CONTENT */}
        <div className={`relative flex-1 overflow-y-auto ${pal.pageBg} no-scrollbar`}>
          <div className="pointer-events-none sticky top-0 inset-x-0 h-0 z-0">
            <div className="w-full h-[360px]" style={{ background: pal.pageGlow }} />
          </div>

          <div className="relative z-10 px-4 pt-4 pb-8 space-y-3.5">
            {/* 1. EN-TÊTE & ARTICLES COMMANDÉS */}
            <section className={`${pal.card} p-4 space-y-3.5`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-2xl ${pal.iconBox} flex items-center justify-center shrink-0`}
                  >
                    <VerificationCubeIcon accent="orange" className="w-7 h-7" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-[16px] font-extrabold text-white leading-tight tracking-tight truncate">
                      Commande confirmée
                    </h2>
                    <p className="text-xs text-white/60 mt-0.5 truncate">
                      #{liveOrder.orderNumber} • {creationFullDateTime}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsReceiptOpen(true)}
                  className={`min-h-[34px] px-3.5 py-1 rounded-full ${pal.outlineAccentBtn} text-xs font-extrabold flex items-center gap-1.5 transition active:scale-95 shrink-0`}
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Reçu</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {liveOrder.items.map((item, idx) => {
                  const variantEntries = Object.entries(item.variant || {}).filter(([, v]) => Boolean(v));
                  const thumb =
                    item.productImage ||
                    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=160';

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl ${pal.innerWell} flex items-center gap-3.5`}
                    >
                      <div
                        className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden ${pal.thumbFrame} shrink-0`}
                      >
                        <img
                          src={thumb}
                          alt={item.productTitle}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                        <span
                          className={`absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-black tabular-nums ${pal.promoBadge}`}
                        >
                          x{item.quantity}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <h3 className="text-[14.5px] font-extrabold text-white truncate">
                          {item.productTitle}
                        </h3>
                        <div className="flex items-center gap-1.5 text-[11.5px] text-white/70">
                          <span className="truncate">
                            Boutique : {item.sellerName || sellerDisplayName}
                          </span>
                          {seller?.verified && <VerifiedBlueSeal className="w-3.5 h-3.5 shrink-0" />}
                        </div>
                        <div className="text-[11px] text-white/55 tabular-nums">
                          Prix unitaire : <strong className="text-white/85">{formatFCFA(item.price)}</strong>
                        </div>
                        {variantEntries.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                            {variantEntries.map(([k, v]) => (
                              <span
                                key={k}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.07] border border-white/12 text-white/85 font-medium"
                              >
                                {k} : <strong className="text-white">{v}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className={`text-[15px] font-black ${pal.accentText} tabular-nums pt-0.5`}>
                          {formatFCFA(item.price * item.quantity)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 2. LIVRAISON ORGANISÉE PAR LA BOUTIQUE (EXTERNE) + CONTACT VENDEUR */}
            <section className={`${pal.card} p-4 space-y-3`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={sellerAvatar}
                    alt={sellerDisplayName}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-full object-cover border-2 border-white/15 bg-[#1B1F1D] shadow-md shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[15px] font-extrabold text-white truncate">
                        {sellerDisplayName}
                      </span>
                      {seller?.verified && <VerifiedBlueSeal className="w-4 h-4 shrink-0" />}
                    </div>
                    <p className="text-xs text-white/60 truncate mt-0.5">
                      Livraison gérée directement par la boutique • {sellerAddress}
                    </p>
                    {seller?.phone && (
                      <p className="text-[11px] text-white/75 font-mono mt-0.5">{seller.phone}</p>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="flex items-center justify-end gap-1 text-sm font-black text-white tabular-nums">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span>{seller?.rating ? seller.rating.toFixed(1) : '4.9'}</span>
                  </div>
                  {(seller?.salesCount ?? 0) > 0 && (
                    <p className="text-[11px] text-white/55 tabular-nums mt-0.5">
                      ({formatMetricCount(seller?.salesCount || 0)} ventes)
                    </p>
                  )}
                </div>
              </div>

              <div className={`p-3 rounded-2xl ${pal.innerWell} text-xs text-white/75 leading-relaxed`}>
                La livraison est organisée directement par <strong>{sellerDisplayName}</strong> à
                l’extérieur de DJASSA (0 FCFA de frais DJASSA). Contactez la boutique pour tout
                ajustement d’horaire ou de remise.
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  id="btn-call-seller-details"
                  type="button"
                  onClick={() => startCall(seller?.id || primarySellerId || 'seller-1', 'seller')}
                  className={`flex-1 min-h-[40px] px-3 rounded-full ${pal.outlineAccentBtn} text-xs font-extrabold flex items-center justify-center gap-1.5 transition active:scale-95`}
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Appeler</span>
                </button>
                <button
                  id="btn-chat-seller-details"
                  type="button"
                  onClick={() => {
                    onClose();
                    openChatWithSeller(
                      seller?.id || primarySellerId || 'seller-1',
                      liveOrder.items[0]?.productId
                    );
                  }}
                  className={`flex-1 min-h-[40px] px-3 rounded-full ${pal.secondaryBtn} text-xs font-extrabold flex items-center justify-center gap-1.5 transition active:scale-95`}
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Message</span>
                </button>
                {seller && (
                  <button
                    id="btn-view-seller-profile"
                    type="button"
                    onClick={() => {
                      onClose();
                      setSelectedSeller(seller);
                    }}
                    className={`min-h-[40px] px-3.5 rounded-full ${pal.secondaryBtn} text-xs font-extrabold flex items-center justify-center gap-1.5 transition active:scale-95 shrink-0`}
                  >
                    <Store className="w-3.5 h-3.5 text-[#FF6321]" />
                    <span>Boutique</span>
                  </button>
                )}
              </div>
            </section>

            {/* 3. ADRESSE DE LIVRAISON CLIENT */}
            <section className={`${pal.card} p-4 space-y-3`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <LocationPinIcon3D accent="orange" className="w-6 h-6 shrink-0" />
                  <h3 className="text-[15.5px] font-extrabold text-white tracking-tight">
                    Adresse de livraison
                  </h3>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full ${pal.promoAppliedPill} text-[11px] font-extrabold`}
                >
                  {liveOrder.deliveryAddress.commune}
                </span>
              </div>

              <div className="space-y-2 text-xs text-white/85 pl-0.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-white/55" />
                  </span>
                  <span className="font-bold text-white">
                    {liveOrder.deliveryAddress.recipientName}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
                    <Phone className="w-3.5 h-3.5 text-white/55" />
                  </span>
                  <span className="tabular-nums font-medium">{liveOrder.deliveryAddress.phone}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-white/55" />
                  </span>
                  <span>
                    Abidjan, {liveOrder.deliveryAddress.commune} — {liveOrder.deliveryAddress.quartier}
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                    <Home className="w-3.5 h-3.5 text-white/55" />
                  </span>
                  <span className="leading-relaxed">
                    {liveOrder.deliveryAddress.details}
                    {liveOrder.deliveryAddress.landmark
                      ? ` (Repère : ${liveOrder.deliveryAddress.landmark})`
                      : ''}
                  </span>
                </div>
                {liveOrder.deliveryAddress.deliveryInstructions && (
                  <p className="text-[11px] text-white/60 pl-8 italic">
                    Consigne : {liveOrder.deliveryAddress.deliveryInstructions}
                  </p>
                )}
              </div>
            </section>

            {/* 4. MODE & STATUT DE PAIEMENT */}
            <section className={`${pal.card} p-4 space-y-3`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <PaymentWalletGreenIcon accent="orange" className="w-6 h-6 shrink-0" />
                  <h3 className="text-[15.5px] font-extrabold text-white tracking-tight">
                    Paiement
                  </h3>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${paymentBadge.bgColor} ${paymentBadge.color}`}
                >
                  {paymentBadge.label}
                </span>
              </div>

              <div className="flex items-center gap-3 pt-0.5">
                <PaymentMethodBadge method={liveOrder.paymentMethod} className="w-11 h-11 shrink-0" />
                <div>
                  <div className="text-sm font-extrabold text-white">
                    {isCod ? 'Paiement à la livraison' : `Paiement en ligne • ${paymentInfo.label}`}
                  </div>
                  <div className="text-xs text-white/60">
                    {isCod
                      ? 'Vous paierez directement au vendeur à la réception (0% de frais client).'
                      : paymentInfo.shortSubtitle}
                  </div>
                </div>
              </div>

              {liveOrder.paymentTransactionRef && (
                <div className={`p-2.5 rounded-xl ${pal.innerWell} flex items-center justify-between text-[11px]`}>
                  <span className="text-white/60">Référence transaction</span>
                  <span className="font-mono font-bold text-white/90">
                    {liveOrder.paymentTransactionRef}
                  </span>
                </div>
              )}

              {checkoutUrl && !isPaid && !isCod && (
                <a
                  href={checkoutUrl}
                  target="_top"
                  rel="noopener noreferrer"
                  className={`w-full min-h-[44px] px-4 py-2.5 rounded-full ${pal.primaryBtn} text-xs font-black flex items-center justify-center gap-2 transition`}
                >
                  <span>Finaliser le paiement sur GeniusPay</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              {!isCod && !isPaid && (
                <div className="pt-1 space-y-2 border-t border-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-white/70 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-[#FF6321]" />
                      <span>Vérifier ou relancer le paiement en ligne</span>
                    </span>
                    <button
                      type="button"
                      disabled={isRefreshingPayment}
                      onClick={handleRefreshPayment}
                      className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/15 text-[11px] font-bold flex items-center gap-1"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${isRefreshingPayment ? 'animate-spin' : ''}`}
                      />
                      <span>Actualiser</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={retryMethod}
                      onChange={(e) => setRetryMethod(e.target.value as 'wave' | 'orange_money')}
                      className={`flex-1 min-h-[38px] px-3 rounded-xl ${pal.innerWell} text-xs font-bold text-white outline-none`}
                    >
                      <option value="wave">Wave</option>
                      <option value="orange_money">Orange Money</option>
                    </select>
                    <button
                      type="button"
                      disabled={isRetryingPayment}
                      onClick={handleRetryOnlinePayment}
                      className={`min-h-[38px] px-4 rounded-xl ${pal.outlineAccentBtn} text-xs font-extrabold flex items-center gap-1.5`}
                    >
                      {isRetryingPayment && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Payer</span>
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* 5. RÉCAPITULATIF FINANCIER */}
            <section className={`${pal.card} p-4 space-y-3`}>
              <div className="flex items-center gap-2.5">
                <SummaryCalculatorIcon accent="orange" className="w-6 h-6 shrink-0" />
                <h3 className="text-[15.5px] font-extrabold text-white tracking-tight">
                  Récapitulatif financier
                </h3>
              </div>

              <div className="space-y-2.5 text-[13px]">
                <div className="flex items-center justify-between text-white/75">
                  <span className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
                      <ShoppingCart className="w-3.5 h-3.5 text-white/55" />
                    </span>
                    <span>Articles ({totalItemsQuantity})</span>
                  </span>
                  <span className="font-extrabold text-white tabular-nums">
                    {formatFCFA(liveOrder.subtotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-white/75">
                  <span className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
                      <Banknote className="w-3.5 h-3.5 text-white/55" />
                    </span>
                    <span>Livraison (gérée par la boutique)</span>
                  </span>
                  <span className="font-extrabold text-emerald-400 tabular-nums">0 FCFA</span>
                </div>

                {!isCod && clientOnlineFee > 0 && (
                  <div className="flex items-center justify-between text-white/75">
                    <button
                      type="button"
                      onClick={() => setShowFeeTooltip((v) => !v)}
                      className="flex items-center gap-2.5 hover:text-white transition"
                    >
                      <span className="w-6 h-6 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
                        <Percent className="w-3.5 h-3.5 text-white/55" />
                      </span>
                      <span>Frais client (6,5% en ligne)</span>
                      <Info className="w-3.5 h-3.5 text-white/45" />
                    </button>
                    <span className="font-extrabold text-white tabular-nums">
                      + {formatFCFA(clientOnlineFee)}
                    </span>
                  </div>
                )}

                {showFeeTooltip && !isCod && (
                  <p className="text-[11px] text-white/65 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
                    Frais de paiement en ligne de 6,5% appliqués uniquement aux règlements par Wave
                    ou Orange Money. Aucun frais client pour le paiement à la livraison.
                  </p>
                )}

                {liveOrder.discount > 0 && (
                  <div className={`flex items-center justify-between ${pal.accentTextBright} font-bold`}>
                    <span>Réduction{liveOrder.promoCode ? ` (${liveOrder.promoCode})` : ''}</span>
                    <span className="font-extrabold tabular-nums">
                      - {formatFCFA(liveOrder.discount)}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-white/[0.09] flex items-center justify-between">
                <span className="text-[15px] font-extrabold text-white">
                  {isCod ? 'Total à payer à la livraison' : 'Total commande'}
                </span>
                <span className={`text-xl font-black ${pal.accentText} tabular-nums`}>
                  {formatFCFA(liveOrder.total)}
                </span>
              </div>
            </section>

            {/* 6. BANNIÈRE SÉCURITÉ */}
            <section className={`${pal.securityCard} flex items-center justify-between gap-2`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl ${pal.iconBox} ${pal.accentTextBright} flex items-center justify-center shrink-0`}
                >
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-white">Paiement transparent DJASSA</div>
                  <div className="text-[10.5px] text-white/60 truncate">
                    {isCod
                      ? 'Zéro frais en ligne • Règlement direct au vendeur'
                      : 'Reversement direct vérifié vers le compte marchand Wave / OM'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <WaveLogo className="w-7 h-7" />
                <OrangeMoneyLogo className="w-7 h-7" />
              </div>
            </section>

            {/* 7. AVIS CLIENT */}
            <section className={`${pal.card} p-4 space-y-3`}>
              <h4 className="text-sm font-extrabold text-white">Noter votre expérience</h4>
              {!isReviewSubmitted ? (
                <form onSubmit={handleReviewSubmit} className="space-y-3">
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className="text-xl transition hover:scale-110 active:scale-95"
                      >
                        {star <= reviewRating ? '⭐' : '☆'}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Partagez votre avis sur le produit et la boutique..."
                    rows={2}
                    className={`w-full ${pal.innerWell} text-white rounded-2xl p-3 text-xs outline-none focus:border-[#FF6321] placeholder:text-white/30`}
                  />
                  <button
                    type="submit"
                    className={`w-full min-h-[44px] px-6 rounded-full ${pal.secondaryBtn} font-extrabold text-xs transition`}
                  >
                    Envoyer mon avis
                  </button>
                </form>
              ) : (
                <p className="text-xs text-emerald-300 font-semibold">
                  ✓ Votre avis de {reviewRating} étoiles a bien été enregistré. Merci !
                </p>
              )}
            </section>

            {/* 8. ANNULATION SI NON PAYÉE */}
            {OrderService.canCancelOrder(liveOrder) && (
              <div className="pt-1">
                {confirmCancelOpen ? (
                  <div className={`${pal.card} p-4 border-rose-500/35 space-y-3`}>
                    <p className="text-xs text-rose-200 font-semibold text-center">
                      Confirmer l’annulation de la commande #{liveOrder.orderNumber} ?
                    </p>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setConfirmCancelOpen(false)}
                        className={`flex-1 min-h-[46px] rounded-full ${pal.secondaryBtn} font-bold text-xs transition`}
                      >
                        Retour
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          cancelOrder(liveOrder.id);
                          onClose();
                        }}
                        className="flex-1 min-h-[46px] rounded-full bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition"
                      >
                        Confirmer l’annulation
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmCancelOpen(true)}
                    className="w-full min-h-[48px] rounded-full bg-rose-500/12 hover:bg-rose-500/20 text-rose-400 border border-rose-500/35 font-extrabold text-xs transition"
                  >
                    Annuler la commande
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {isReceiptOpen && (
        <ClientOrderReceiptModal
          order={liveOrder}
          seller={seller || undefined}
          onClose={() => setIsReceiptOpen(false)}
          onShowToast={showToast}
        />
      )}
    </div>
  );
};
