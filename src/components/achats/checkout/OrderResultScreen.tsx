import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  Navigation,
  CreditCard,
  Loader2,
  MapPin,
  Store,
  ExternalLink,
  FileText,
  Banknote
} from 'lucide-react';
import { Order, Seller } from '../../../types';
import { formatFCFA } from '../../../services/marketServices';
import { commerceService } from '../../../services/commerceService';
import { PaymentMethodBadge, getPaymentMethodInfo } from './PaymentBrandLogos';
import { CheckoutTheme, getCheckoutPalette } from './checkoutTypes';
import { ClientOrderReceiptModal } from '../ClientOrderReceiptModal';

interface OrderResultScreenProps {
  theme?: CheckoutTheme;
  order: Order;
  orders?: Order[];
  seller?: Seller;
  checkoutGroupId?: string;
  totalAmountFcfa?: number;
  providerConfigured: boolean;
  paymentUrl?: string | null;
  onOrderUpdated: (updated: Order) => void;
  onTrackOrder: (order: Order) => void;
  onClose: () => void;
}

export const OrderResultScreen: React.FC<OrderResultScreenProps> = ({
  theme = 'neon',
  order,
  orders,
  seller,
  checkoutGroupId,
  totalAmountFcfa,
  providerConfigured,
  paymentUrl: initialPaymentUrl,
  onOrderUpdated,
  onTrackOrder,
  onClose
}) => {
  const pal = getCheckoutPalette(theme);
  const [liveOrder, setLiveOrder] = useState<Order>(order);
  const [paymentStatusRaw, setPaymentStatusRaw] = useState<string>(order.paymentStatus);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(initialPaymentUrl || null);
  const [copiedOrderNum, setCopiedOrderNum] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);
  const [selectedRetryMethod, setSelectedRetryMethod] = useState<'wave' | 'orange_money'>(
    order.paymentMethod === 'orange_money' ? 'orange_money' : 'wave'
  );
  const [statusNotice, setStatusNotice] = useState('');
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const isCod =
    liveOrder.paymentMode === 'cod' ||
    liveOrder.paymentMethod === 'cash_on_delivery' ||
    paymentStatusRaw === 'cod_pending';
  const isPaid = paymentStatusRaw === 'paid';
  const isFailed = paymentStatusRaw === 'failed';

  const paymentInfo = getPaymentMethodInfo(liveOrder.paymentMethod);
  const sellerDisplayName =
    seller?.storeName || seller?.name || liveOrder.items?.[0]?.sellerName || 'Boutique Partenaire';

  const handleCopyOrderNumber = () => {
    navigator.clipboard?.writeText?.(liveOrder.orderNumber);
    setCopiedOrderNum(true);
    setTimeout(() => setCopiedOrderNum(false), 1800);
  };

  const handleRefreshStatus = async () => {
    setIsRefreshing(true);
    setStatusNotice('');
    try {
      const res = await commerceService.getOrderStatus(liveOrder.id);
      if (res?.order) {
        const srv = res.order;
        const nextPaymentStatus = res.payment?.status || srv.paymentStatus || liveOrder.paymentStatus;
        setPaymentStatusRaw(nextPaymentStatus);
        if (res.payment?.checkoutUrl || res.payment?.paymentUrl) {
          setPaymentUrl(res.payment.checkoutUrl || res.payment.paymentUrl);
        }
        const updated: Order = {
          ...liveOrder,
          paymentStatus: nextPaymentStatus,
          paymentMethod: srv.paymentMethod || liveOrder.paymentMethod,
          paymentTransactionRef: srv.paymentTransactionRef || liveOrder.paymentTransactionRef,
          sellerPayoutStatus: srv.sellerPayoutStatus || liveOrder.sellerPayoutStatus,
          sellerPayoutReference: srv.sellerPayoutReference || liveOrder.sellerPayoutReference,
          commissionStatus: srv.commissionStatus || liveOrder.commissionStatus,
          visibleStatus: 'Commande confirmée'
        };
        setLiveOrder(updated);
        onOrderUpdated(updated);
        setStatusNotice(
          nextPaymentStatus === 'paid'
            ? 'Paiement confirmé par GeniusPay et enregistré côté serveur.'
            : nextPaymentStatus === 'cod_pending'
            ? 'Commande confirmée — Paiement prévu directement à la livraison.'
            : nextPaymentStatus === 'failed'
            ? 'Le paiement a échoué. Vous pouvez relancer via Wave ou Orange Money ci-dessous.'
            : 'Statut vérifié : en attente de confirmation de l’opérateur.'
        );
      }
    } catch (err) {
      setStatusNotice(
        err instanceof Error ? err.message : 'Impossible de joindre le serveur pour vérifier.'
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRetryPayment = async () => {
    setIsRetryingPayment(true);
    setStatusNotice('');
    try {
      const res = await commerceService.retryOrderPayment(liveOrder.id, selectedRetryMethod);
      const nextStatus = res.payment?.status || res.order?.paymentStatus || 'pending';
      setPaymentStatusRaw(nextStatus);
      const nextUrl = res.paymentUrl || res.checkoutUrl || res.payment?.checkoutUrl || null;
      if (nextUrl) setPaymentUrl(nextUrl);

      const updated: Order = {
        ...liveOrder,
        paymentMode: 'online',
        paymentMethod: selectedRetryMethod,
        paymentStatus: nextStatus,
        visibleStatus: 'Commande confirmée'
      };
      setLiveOrder(updated);
      onOrderUpdated(updated);
      setStatusNotice(
        res.alreadyPaid
          ? 'Cette commande est déjà réglée.'
          : nextUrl
          ? `Lien de paiement ${getPaymentMethodInfo(selectedRetryMethod).label} généré ci-dessous.`
          : res.providerConfigured
          ? `Demande de paiement ${getPaymentMethodInfo(selectedRetryMethod).label} initialisée.`
          : `Demande mise à jour (${getPaymentMethodInfo(selectedRetryMethod).label}) — en attente de confirmation.`
      );
    } catch (err) {
      setStatusNotice(
        err instanceof Error ? err.message : 'Impossible de relancer le paiement.'
      );
    } finally {
      setIsRetryingPayment(false);
    }
  };

  const paymentBadgeLabel = isCod
    ? 'À payer à la livraison'
    : isPaid
    ? 'Payé'
    : isFailed
    ? 'Échoué'
    : 'En attente';

  return (
    <div className="space-y-4 py-2 pb-8">
      {/* Status Banner */}
      <section
        className={`p-5 rounded-3xl border text-center space-y-3.5 shadow-[0_16px_38px_rgba(0,0,0,0.65)] ${
          isPaid || isCod
            ? 'bg-gradient-to-b from-[#113320] via-[#0B2014] to-[#08130D] border-[#1EEB7A]/55'
            : isFailed
            ? 'bg-gradient-to-b from-rose-950/55 via-[#180C0F] to-[#0B0D0C] border-rose-500/45'
            : 'bg-gradient-to-b from-[#1F1A0F] via-[#131513] to-[#0B0E0C] border-amber-500/40'
        }`}
      >
        <div
          className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center border-2 shadow-lg ${
            isPaid || isCod
              ? 'bg-[#16E575]/20 border-[#1EEB7A] text-[#2BFF91] shadow-[0_0_24px_rgba(22,229,117,0.35)]'
              : isFailed
              ? 'bg-rose-500/20 border-rose-400 text-rose-400'
              : 'bg-amber-500/15 border-amber-400 text-amber-400 shadow-[0_0_22px_rgba(251,191,36,0.2)]'
          }`}
        >
          {isPaid || isCod ? (
            <CheckCircle2 className="w-8 h-8" />
          ) : isFailed ? (
            <AlertTriangle className="w-8 h-8" />
          ) : (
            <Clock className="w-8 h-8" />
          )}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="inline-block px-3.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider border bg-[#16E575]/15 border-[#1EEB7A]/40 text-[#2BFF91]">
              Commande confirmée
            </span>
            <span
              className={`inline-block px-3 py-1 rounded-full text-[11px] font-extrabold border ${
                isPaid
                  ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                  : isCod
                  ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                  : isFailed
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
              }`}
            >
              Paiement : {paymentBadgeLabel}
            </span>
          </div>

          <h2 className="text-lg font-black text-white">
            {isCod
              ? 'Commande confirmée — Paiement à la livraison'
              : isPaid
              ? 'Merci pour votre commande !'
              : isFailed
              ? 'Votre commande attend un paiement valide'
              : 'Finalisez votre paiement en ligne'}
          </h2>

          <p className="text-xs text-white/70 max-w-xl mx-auto leading-relaxed">
            {isCod
              ? `${sellerDisplayName} a bien reçu votre commande et organisera votre livraison directement. Vous réglerez à la réception (${formatFCFA(liveOrder.total)}).`
              : isPaid
              ? `Votre paiement en ligne est confirmé. ${sellerDisplayName} prépare votre colis et organisera la livraison directement.`
              : isFailed
              ? 'La transaction n’a pas abouti. Relancez le paiement en ligne via Wave ou Orange Money.'
              : providerConfigured
              ? `Finalisez le règlement via le lien ${paymentInfo.label} (GeniusPay) ci-dessous puis actualisez le statut.`
              : `Commande enregistrée avec stock réservé (${paymentInfo.label}). Utilisez le lien de paiement ou actualisez après validation.`}
          </p>
        </div>

        {/* Direct GeniusPay checkout link if online & not paid */}
        {!isCod && !isPaid && paymentUrl && (
          <div className="pt-1">
            <a
              href={paymentUrl}
              target="_top"
              rel="noopener noreferrer"
              className={`inline-flex items-center justify-center gap-2 min-h-[46px] px-6 py-2.5 rounded-full ${pal.primaryBtn} text-xs font-black transition`}
            >
              <span>Finaliser le paiement sur GeniusPay</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </section>

      {/* Order Details Card */}
      <section className={`${pal.card} p-4 space-y-3 text-xs`}>
        <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
          <span className="text-white/65">Numéro de commande</span>
          <button
            type="button"
            onClick={handleCopyOrderNumber}
            className={`flex items-center gap-1.5 font-mono font-black text-sm ${pal.accentText}`}
          >
            <span>#{liveOrder.orderNumber}</span>
            {copiedOrderNum ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-white/50" />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
          <span className="text-white/65">Statut commande</span>
          <span className="font-extrabold text-emerald-400">Commande confirmée</span>
        </div>

        <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
          <span className="text-white/65">Date & heure</span>
          <span className="font-bold text-white tabular-nums">{liveOrder.createdAt}</span>
        </div>

        <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
          <span className="text-white/65">Mode & moyen de paiement</span>
          <span className="flex items-center gap-2 font-extrabold text-white">
            <PaymentMethodBadge method={liveOrder.paymentMethod} className="w-6 h-6" />
            <span>{paymentInfo.label}</span>
          </span>
        </div>

        {(liveOrder.clientFeeFcfa ?? liveOrder.serviceFee ?? 0) > 0 && (
          <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
            <span className="text-white/65">Frais client (6,5% en ligne)</span>
            <span className="font-bold text-white tabular-nums">
              {formatFCFA(liveOrder.clientFeeFcfa ?? liveOrder.serviceFee ?? 0)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
          <span className="text-white/65">Frais de livraison DJASSA</span>
          <span className="font-bold text-emerald-400 tabular-nums">0 FCFA</span>
        </div>

        <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
          <span className="text-white/65">Total</span>
          <span className="text-sm font-black text-white tabular-nums">
            {formatFCFA(
              typeof totalAmountFcfa === 'number' && orders && orders.length > 1
                ? totalAmountFcfa
                : liveOrder.total
            )}
          </span>
        </div>

        {orders && orders.length > 1 && (
          <div className="pb-2.5 border-b border-white/[0.08] space-y-2">
            <div className="flex items-center justify-between text-[11px] text-white/60">
              <span>Commandes par boutique ({orders.length})</span>
              {checkoutGroupId && <span className="font-mono text-white/50">{checkoutGroupId}</span>}
            </div>
            <div className="space-y-1.5">
              {orders.map((subOrd) => (
                <div
                  key={subOrd.id}
                  className={`p-2.5 rounded-xl ${pal.innerWell} flex items-center justify-between gap-2`}
                >
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate">
                      #{subOrd.orderNumber} • {subOrd.items?.[0]?.sellerName || 'Boutique'}
                    </div>
                    <div className="text-[10px] text-white/55">
                      Commande confirmée • Total : {formatFCFA(subOrd.total)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <span className="text-white/65 flex items-center gap-1.5 shrink-0">
            <MapPin className={`w-3.5 h-3.5 ${pal.accentText}`} />
            <span>Adresse de livraison</span>
          </span>
          <span className="text-right text-white font-semibold">
            {liveOrder.deliveryAddress.commune} — {liveOrder.deliveryAddress.quartier}
          </span>
        </div>

        <div className={`p-3 rounded-2xl ${pal.innerWell} flex items-start gap-2.5`}>
          {isCod ? (
            <Banknote className={`w-4 h-4 ${pal.accentText} shrink-0 mt-0.5`} />
          ) : (
            <Store className={`w-4 h-4 ${pal.accentText} shrink-0 mt-0.5`} />
          )}
          <div className="text-[11px] leading-relaxed">
            <div className="font-extrabold text-white">
              Livraison gérée directement par {sellerDisplayName}
            </div>
            <div className="text-white/60">
              {seller?.phone
                ? `Contact boutique : ${seller.phone}. `
                : ''}
              Le vendeur vous contactera pour organiser la remise à l’extérieur de DJASSA.
            </div>
          </div>
        </div>
      </section>

      {statusNotice && (
        <div className={`p-3 rounded-2xl ${pal.innerWell} text-xs text-white/90 font-medium`}>
          {statusNotice}
        </div>
      )}

      {/* Refresh / Retry Payment Actions (Online pending/failed only) */}
      {!isCod && !isPaid && (
        <section className={`${pal.card} p-4 space-y-3`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-white flex items-center gap-1.5">
              <CreditCard className={`w-4 h-4 ${pal.accentText}`} />
              <span>Suivi ou relance du paiement en ligne</span>
            </span>

            <button
              type="button"
              disabled={isRefreshing}
              onClick={handleRefreshStatus}
              className="min-h-[38px] px-3.5 py-1.5 rounded-full bg-white/[0.07] hover:bg-white/[0.12] border border-white/12 text-xs font-bold text-white flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Actualiser</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedRetryMethod}
              onChange={(e) => setSelectedRetryMethod(e.target.value as 'wave' | 'orange_money')}
              className={`flex-1 min-h-[44px] px-3 rounded-2xl ${pal.innerWell} text-xs font-bold text-white outline-none`}
            >
              <option value="wave">Wave</option>
              <option value="orange_money">Orange Money</option>
            </select>

            <button
              type="button"
              disabled={isRetryingPayment}
              onClick={handleRetryPayment}
              className={`min-h-[44px] px-4 rounded-2xl ${pal.outlineAccentBtn} text-xs font-extrabold flex items-center gap-1.5 transition shrink-0 disabled:opacity-50`}
            >
              {isRetryingPayment ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>Réessayer</span>
            </button>
          </div>
        </section>
      )}

      {/* Primary Action CTAs */}
      <div className="space-y-2.5 pt-1">
        <button
          id="btn-view-order-receipt"
          type="button"
          onClick={() => setShowReceiptModal(true)}
          className={`w-full min-h-[50px] py-3 px-6 rounded-full ${pal.outlineAccentBtn} font-extrabold text-sm flex items-center justify-center gap-2 transition active:scale-[0.98]`}
        >
          <FileText className="w-4 h-4" />
          <span>Voir mon reçu client</span>
        </button>

        <button
          id="btn-track-order-direct"
          type="button"
          onClick={() => onTrackOrder(liveOrder)}
          className={`w-full min-h-[54px] py-3.5 px-6 rounded-full ${pal.primaryBtn} font-black text-[15.5px] flex items-center justify-center gap-2 transition active:scale-[0.98]`}
        >
          <Navigation className="w-4 h-4 stroke-[2.6]" />
          <span>Voir ma commande</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          className={`w-full min-h-[50px] py-3 rounded-full ${pal.secondaryBtn} text-white/90 font-bold text-sm transition`}
        >
          Fermer
        </button>
      </div>

      {showReceiptModal && (
        <ClientOrderReceiptModal
          order={liveOrder}
          seller={seller}
          onClose={() => setShowReceiptModal(false)}
        />
      )}
    </div>
  );
};
