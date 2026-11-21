import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Check,
  Star,
  MapPin,
  User,
  Phone,
  Home,
  Pencil,
  Store,
  ShoppingCart,
  Percent,
  ShieldCheck,
  ArrowLeft,
  Info,
  Loader2,
  Package,
  Banknote
} from 'lucide-react';
import { Seller } from '../../../types';
import { formatFCFA, formatMetricCount } from '../../../services/marketServices';
import {
  AppliedPromoState,
  CheckoutLineItem,
  CheckoutTheme,
  DeliveryAddressForm,
  PaymentMethodType,
  PaymentModeType,
  calculateClientOnlineFee,
  getCheckoutPalette,
  resolveSellerDisplay
} from './checkoutTypes';
import {
  CashOnDeliveryLogo,
  ConfirmationCheckOrb,
  LocationPinIcon3D,
  OrangeMoneyLogo,
  PaymentMethodBadge,
  PaymentWalletGreenIcon,
  SummaryCalculatorIcon,
  VerifiedBlueSeal,
  WaveLogo,
  getPaymentMethodInfo
} from './PaymentBrandLogos';

interface Step4OrderValidationProps {
  theme?: CheckoutTheme;
  items: CheckoutLineItem[];
  seller?: Seller;
  address: DeliveryAddressForm;
  sellerCount?: number;
  paymentMode: PaymentModeType;
  paymentMethod: PaymentMethodType;
  payerPhone?: string;
  appliedPromo: AppliedPromoState | null;
  isSubmitting: boolean;
  submitError: string;
  onEditAddress: () => void;
  onEditPayment: () => void;
  onBack: () => void;
  onConfirmOrder: () => void;
}

export const Step4OrderValidation: React.FC<Step4OrderValidationProps> = ({
  theme = 'neon',
  items,
  seller,
  address,
  sellerCount = 1,
  paymentMode,
  paymentMethod,
  payerPhone,
  appliedPromo,
  isSubmitting,
  submitError,
  onEditAddress,
  onEditPayment,
  onBack,
  onConfirmOrder
}) => {
  const pal = getCheckoutPalette(theme);
  const [showFeeTooltip, setShowFeeTooltip] = useState(false);

  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + it.product.price * it.quantity, 0),
    [items]
  );
  const totalQuantity = useMemo(
    () => items.reduce((sum, it) => sum + it.quantity, 0),
    [items]
  );
  const discount = appliedPromo?.discountFcfa || 0;
  const merchandiseNet = Math.max(0, subtotal - discount);
  const clientFeeFcfa = useMemo(
    () => calculateClientOnlineFee(merchandiseNet, paymentMode),
    [merchandiseNet, paymentMode]
  );
  const totalPayable = merchandiseNet + clientFeeFcfa;

  const sellerInfo = resolveSellerDisplay(seller);
  const paymentInfo = getPaymentMethodInfo(paymentMethod);

  return (
    <div className="space-y-3.5 pb-6">
      {/* 1. Confirmation Header + Product Summary Card(s) */}
      <section className={`${pal.card} p-4 space-y-3.5`}>
        <div className="flex items-center gap-3">
          <ConfirmationCheckOrb accent={pal.svgAccent} className="w-11 h-11 shrink-0" />
          <div>
            <h2 className="text-[16px] font-extrabold text-white leading-tight tracking-tight">
              Confirmation de votre commande
            </h2>
            <p className="text-xs text-white/60 mt-0.5">
              Vérifiez bien vos informations avant de confirmer
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {items.map((item, idx) => {
            const variantEntries = Object.entries(item.variantSelected).filter(([, v]) => Boolean(v));
            const thumb = item.product.images?.[0] || item.product.videoPoster || '';

            return (
              <div
                key={item.cartItemId || `${item.product.id}-${idx}`}
                className={
                  pal.isClient
                    ? 'p-3 rounded-2xl bg-[#0E0E0E] border border-white/10 flex items-center gap-3.5'
                    : 'p-3 rounded-2xl bg-gradient-to-br from-[#0F2A1A]/75 via-[#0B110E] to-[#080B09] border border-white/[0.09] shadow-inner flex items-center gap-3.5'
                }
              >
                <div className={`relative w-22 h-22 sm:w-24 sm:h-24 rounded-2xl overflow-hidden ${pal.thumbFrame} shrink-0`}>
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={item.product.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/30">
                      <Package className="w-6 h-6" />
                    </div>
                  )}
                  <span className={`absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-black tabular-nums ${pal.promoBadge}`}>
                    x{item.quantity}
                  </span>
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <h3 className="text-[14.5px] font-extrabold text-white truncate">
                    {item.product.name}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[11.5px] text-white/70">
                    <span className="truncate">Boutique : {sellerInfo.name}</span>
                    {sellerInfo.verified && <VerifiedBlueSeal className="w-3.5 h-3.5 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-white/65 tabular-nums">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span className="font-extrabold text-amber-300">
                      {(item.product.rating || 4.8).toFixed(1)}
                    </span>
                    {item.product.reviewsCount && item.product.reviewsCount > 0 ? (
                      <span>({formatMetricCount(item.product.reviewsCount)} avis)</span>
                    ) : null}
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
                  <div className="text-[15px] font-black text-white tabular-nums pt-0.5">
                    {formatFCFA(item.product.price * item.quantity)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Adresse de livraison */}
      <section className={`${pal.card} p-4 space-y-3`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <LocationPinIcon3D accent={pal.svgAccent} className="w-6 h-6 shrink-0" />
            <h3 className="text-[15.5px] font-extrabold text-white tracking-tight">
              Adresse de livraison
            </h3>
          </div>
          <button
            type="button"
            onClick={onEditAddress}
            className={`min-h-[34px] px-3.5 py-1 rounded-full ${pal.outlineAccentBtn} text-xs font-extrabold flex items-center gap-1.5 transition active:scale-95`}
          >
            <Pencil className="w-3 h-3" />
            <span>Modifier</span>
          </button>
        </div>

        <div className="space-y-2 text-xs text-white/85 pl-0.5">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5 text-white/55" />
            </span>
            <span className="font-bold text-white">{address.recipientName}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
              <Phone className="w-3.5 h-3.5 text-white/55" />
            </span>
            <span className="tabular-nums font-medium">{address.phone}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
              <MapPin className="w-3.5 h-3.5 text-white/55" />
            </span>
            <span>
              Abidjan, {address.commune} — {address.quartier}
            </span>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="w-6 h-6 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
              <Home className="w-3.5 h-3.5 text-white/55" />
            </span>
            <span className="leading-relaxed">
              {address.details}
              {address.landmark ? ` (Repère : ${address.landmark})` : ''}
            </span>
          </div>
          {address.deliveryInstructions && (
            <p className="text-[11px] text-white/60 pl-8 italic">
              Consigne : {address.deliveryInstructions}
            </p>
          )}
        </div>
      </section>

      {/* 3. Livraison gérée par la boutique */}
      <section className={`${pal.card} p-4 space-y-2.5`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-xl ${pal.iconBox} flex items-center justify-center shrink-0`}>
              <Store className={`w-4 h-4 ${pal.accentText}`} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-extrabold text-white tracking-tight truncate">
                Livraison gérée par la boutique
              </h3>
              <p className="text-[11px] text-white/60 truncate">
                {sellerCount > 1
                  ? `${sellerCount} vendeurs organisent leurs livraisons`
                  : `${sellerInfo.name}${sellerInfo.phone ? ` • ${sellerInfo.phone}` : ''}`}
              </p>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full ${pal.promoAppliedPill} text-[11px] font-extrabold flex items-center gap-1 shrink-0`}>
            <CheckCircle2 className="w-3 h-3" />
            <span>0 FCFA</span>
          </span>
        </div>
      </section>

      {/* 4. Mode de paiement choisi */}
      <section className={`${pal.card} p-4 space-y-3`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <PaymentWalletGreenIcon accent={pal.svgAccent} className="w-6 h-6 shrink-0" />
            <h3 className="text-[15.5px] font-extrabold text-white tracking-tight">
              Mode de paiement
            </h3>
          </div>
          <button
            type="button"
            onClick={onEditPayment}
            className={`min-h-[34px] px-3.5 py-1 rounded-full ${pal.outlineAccentBtn} text-xs font-extrabold flex items-center gap-1.5 transition active:scale-95`}
          >
            <Pencil className="w-3 h-3" />
            <span>Modifier</span>
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-3 min-w-0">
            <PaymentMethodBadge method={paymentMethod} className="w-11 h-11 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-white">
                {paymentMode === 'online' ? `Paiement en ligne — ${paymentInfo.label}` : 'Paiement à la livraison'}
              </div>
              <div className="text-xs text-white/60 truncate">
                {paymentMode === 'online'
                  ? `Frais client 6,5% (+${formatFCFA(clientFeeFcfa)})${payerPhone ? ` • ${payerPhone}` : ''}`
                  : '0% frais client • Réglé directement à la réception'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Récapitulatif final */}
      <section className={`${pal.card} p-4 space-y-3`}>
        <div className="flex items-center gap-2.5">
          <SummaryCalculatorIcon accent={pal.svgAccent} className="w-6 h-6 shrink-0" />
          <h3 className="text-[15.5px] font-extrabold text-white tracking-tight">
            Récapitulatif de votre commande
          </h3>
        </div>

        <div className="space-y-2.5 text-[13px]">
          <div className="flex items-center justify-between text-white/75">
            <span className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
                <ShoppingCart className="w-3.5 h-3.5 text-white/55" />
              </span>
              <span>Articles ({totalQuantity})</span>
            </span>
            <span className="font-extrabold text-white tabular-nums">{formatFCFA(subtotal)}</span>
          </div>

          <div className="flex items-center justify-between text-white/75">
            <span className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
                <Store className="w-3.5 h-3.5 text-white/55" />
              </span>
              <span>Livraison (gérée par la boutique)</span>
            </span>
            <span className="font-extrabold text-emerald-400 tabular-nums">0 FCFA</span>
          </div>

          {discount > 0 && appliedPromo && (
            <div className={`flex items-center justify-between ${pal.accentTextBright} font-bold`}>
              <span>Réduction ({appliedPromo.code})</span>
              <span className="font-extrabold tabular-nums">- {formatFCFA(discount)}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-white/75">
            <button
              type="button"
              onClick={() => setShowFeeTooltip((v) => !v)}
              className="flex items-center gap-2.5 hover:text-white transition"
            >
              <span className="w-6 h-6 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
                {paymentMode === 'cod' ? (
                  <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Percent className="w-3.5 h-3.5 text-white/55" />
                )}
              </span>
              <span>
                {paymentMode === 'online'
                  ? 'Frais paiement en ligne (6,5%)'
                  : 'Frais client (Paiement à la livraison)'}
              </span>
              <Info className="w-3.5 h-3.5 text-white/45" />
            </button>
            <span className="font-extrabold text-white tabular-nums">
              {paymentMode === 'online' ? `+ ${formatFCFA(clientFeeFcfa)}` : '0 FCFA (0%)'}
            </span>
          </div>

          {showFeeTooltip && (
            <p className="text-[11px] text-white/65 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
              {paymentMode === 'online'
                ? 'Frais client de 6,5% appliqués uniquement au paiement en ligne.'
                : 'Aucun frais supplémentaire appliqué pour le paiement à la livraison.'}
            </p>
          )}
        </div>

        <div className="pt-3 border-t border-white/[0.09] flex items-center justify-between">
          <span className="text-[15px] font-extrabold text-white">
            {paymentMode === 'cod' ? 'Total à payer à la livraison' : 'Montant total à payer'}
          </span>
          <span className={`text-xl font-black ${pal.accentText} tabular-nums`}>
            {formatFCFA(totalPayable)}
          </span>
        </div>
      </section>

      {/* 6. Security Footer Strip */}
      <section className={`${pal.securityCard} flex items-center justify-between gap-2`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-9 h-9 rounded-xl ${pal.iconBox} ${pal.accentTextBright} flex items-center justify-center shrink-0`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-white">Commande protégée DJASSA</div>
            <div className="text-[10.5px] text-white/60 truncate">
              {paymentMode === 'online'
                ? 'Reversement sécurisé via GeniusPay au vendeur'
                : 'Paiement direct au vendeur à la remise du colis'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <WaveLogo className="w-7 h-7" />
          <OrangeMoneyLogo className="w-7 h-7" />
          <CashOnDeliveryLogo className="w-7 h-7" />
        </div>
      </section>

      {submitError && (
        <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/45 text-xs text-rose-200 font-semibold">
          {submitError}
        </div>
      )}

      {/* 7. Action Buttons */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onBack}
            className={`min-h-[54px] px-5 rounded-full ${pal.secondaryBtn} font-bold text-sm flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40 shrink-0`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour</span>
          </button>

          <button
            id="btn-checkout-step4-confirm"
            type="button"
            disabled={isSubmitting}
            onClick={onConfirmOrder}
            className={`flex-1 min-h-[54px] py-3.5 px-6 rounded-full ${pal.primaryBtn} disabled:opacity-65 font-black text-[15.5px] flex items-center justify-center gap-2 transition active:scale-[0.98]`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Confirmation en cours...</span>
              </>
            ) : (
              <>
                <Check className="w-5 h-5 stroke-[3.2]" />
                <span>Confirmer ma commande</span>
              </>
            )}
          </button>
        </div>

        <p className="text-[11px] text-white/60 text-center flex items-center justify-center gap-1.5 leading-snug px-2">
          <Info className="w-3.5 h-3.5 text-white/45 shrink-0" />
          <span>
            Votre commande passera directement au statut « Commande confirmée » et sera transmise à la boutique.
          </span>
        </p>
      </div>
    </div>
  );
};
