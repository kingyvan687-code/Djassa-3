import React, { useMemo, useState } from 'react';
import {
  Check,
  ShoppingCart,
  Store,
  Percent,
  Wallet,
  Ticket,
  ShieldCheck,
  Lock,
  ArrowRight,
  ArrowLeft,
  Info,
  X,
  Loader2,
  Smartphone,
  Banknote,
  Phone
} from 'lucide-react';
import { formatFCFA } from '../../../services/marketServices';
import { commerceService } from '../../../services/commerceService';
import {
  AppliedPromoState,
  CLIENT_ONLINE_FEE_RATE,
  CheckoutTheme,
  PaymentMethodType,
  PaymentModeType,
  calculateClientOnlineFee,
  getCheckoutPalette
} from './checkoutTypes';
import {
  CashOnDeliveryLogo,
  DjassaSecurityShieldBadge,
  OrangeMoneyLogo,
  PaymentCardGreenIcon,
  PciDssBadgeLogo,
  PromoTagGreenIcon,
  SummaryCalculatorIcon,
  WaveLogo
} from './PaymentBrandLogos';

interface Step3PaymentMethodProps {
  theme?: CheckoutTheme;
  paymentMode: PaymentModeType | null;
  paymentMethod: PaymentMethodType | null;
  payerPhone: string;
  onChangePayerPhone: (phone: string) => void;
  onSelectPaymentChoice: (mode: PaymentModeType, method: PaymentMethodType | null) => void;
  subtotal: number;
  totalQuantity: number;
  appliedPromo: AppliedPromoState | null;
  onApplyPromo: (promo: AppliedPromoState) => void;
  onRemovePromo: () => void;
  onBack: () => void;
  onContinue: () => void;
}

export const Step3PaymentMethod: React.FC<Step3PaymentMethodProps> = ({
  theme = 'neon',
  paymentMode,
  paymentMethod,
  payerPhone,
  onChangePayerPhone,
  onSelectPaymentChoice,
  subtotal,
  totalQuantity,
  appliedPromo,
  onApplyPromo,
  onRemovePromo,
  onBack,
  onContinue
}) => {
  const pal = getCheckoutPalette(theme);
  const [promoInput, setPromoInput] = useState(appliedPromo?.code || '');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [showFeeTooltip, setShowFeeTooltip] = useState(false);

  const discount = appliedPromo?.discountFcfa || 0;
  const merchandiseNet = Math.max(0, subtotal - discount);
  const clientFeeFcfa = useMemo(
    () => calculateClientOnlineFee(merchandiseNet, paymentMode),
    [merchandiseNet, paymentMode]
  );
  const onlineFeePreview = useMemo(
    () => Math.round(merchandiseNet * CLIENT_ONLINE_FEE_RATE),
    [merchandiseNet]
  );
  const totalPayable = merchandiseNet + clientFeeFcfa;

  const isSelectionComplete =
    paymentMode === 'cod'
      ? paymentMethod === 'cash_on_delivery'
      : paymentMode === 'online'
      ? paymentMethod === 'wave' || paymentMethod === 'orange_money'
      : false;

  const handleValidatePromo = async () => {
    const clean = promoInput.trim().toUpperCase();
    if (!clean) {
      setPromoError('Entrez un code promo.');
      return;
    }
    setPromoError('');
    setPromoLoading(true);
    try {
      const res = await commerceService.validatePromoCode(clean, subtotal);
      if (res.valid) {
        onApplyPromo({
          code: res.code,
          discountFcfa: res.discountFcfa,
          label: res.label
        });
        setPromoInput(res.code);
      } else {
        setPromoError('Code promo invalide ou expiré.');
      }
    } catch (err) {
      setPromoError(err instanceof Error ? err.message : 'Code promo invalide ou expiré.');
    } finally {
      setPromoLoading(false);
    }
  };

  return (
    <div className="space-y-3.5 pb-6">
      {/* 1. Payment Mode Selection (NEVER preselected) */}
      <section className={`${pal.card} p-4 space-y-3.5`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl ${pal.iconBox} flex items-center justify-center shrink-0`}>
            <PaymentCardGreenIcon accent={pal.svgAccent} className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-[16px] font-extrabold text-white leading-tight tracking-tight">
              Mode de paiement
            </h2>
            <p className="text-xs text-white/60 mt-0.5">
              Sélectionnez votre mode de règlement (aucune option présélectionnée)
            </p>
          </div>
        </div>

        {/* Option 1: Paiement en ligne (6,5%) */}
        <div className="space-y-2.5">
          <button
            id="btn-payment-mode-online"
            type="button"
            onClick={() => {
              const currentOnlineMethod =
                paymentMethod === 'wave' || paymentMethod === 'orange_money' ? paymentMethod : null;
              onSelectPaymentChoice('online', currentOnlineMethod);
            }}
            className={`w-full p-4 rounded-2xl border text-left transition active:scale-[0.99] space-y-2 ${
              paymentMode === 'online' ? pal.selectedOptionCard : pal.unselectedOptionCard
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-11 h-11 rounded-2xl ${pal.iconBox} flex items-center justify-center shrink-0`}>
                  <Smartphone className={`w-5 h-5 ${pal.accentText}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[15px] font-extrabold text-white">Paiement en ligne</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[10px] font-black">
                      Frais 6,5%
                    </span>
                  </div>
                  <p className="text-xs text-white/65 mt-0.5">
                    Réglez maintenant par Wave ou Orange Money (+{formatFCFA(onlineFeePreview)} de frais client).
                  </p>
                </div>
              </div>

              {paymentMode === 'online' ? (
                <span className={`w-6 h-6 rounded-full ${pal.selectedCheckInline} flex items-center justify-center shrink-0`}>
                  <Check className="w-3.5 h-3.5 stroke-[3.2]" />
                </span>
              ) : (
                <span className="w-5 h-5 rounded-full border-2 border-white/25 bg-black/20 shrink-0" />
              )}
            </div>
          </button>

          {/* Sub-selection: Wave or Orange Money (shown once Paiement en ligne is picked) */}
          {paymentMode === 'online' && (
            <div className={`p-3.5 rounded-2xl ${pal.innerWell} space-y-3`}>
              <p className="text-xs font-bold text-white/85">
                Choisissez votre opérateur de paiement en ligne :
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  id="btn-payment-method-wave"
                  type="button"
                  onClick={() => onSelectPaymentChoice('online', 'wave')}
                  className={`relative p-3 rounded-2xl border text-left flex flex-col justify-between gap-2.5 min-h-[104px] transition active:scale-[0.98] ${
                    paymentMethod === 'wave' ? pal.selectedOptionCard : pal.unselectedOptionCard
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <WaveLogo className="w-11 h-11 shrink-0" />
                    {paymentMethod === 'wave' ? (
                      <span className={`w-5 h-5 rounded-full ${pal.selectedCheckInline} flex items-center justify-center`}>
                        <Check className="w-3 h-3 stroke-[3.2]" />
                      </span>
                    ) : (
                      <span className="w-4 h-4 rounded-full border-2 border-white/25" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-white">Wave</div>
                    <div className="text-[10.5px] text-white/60">Paiement instantané</div>
                  </div>
                </button>

                <button
                  id="btn-payment-method-orange-money"
                  type="button"
                  onClick={() => onSelectPaymentChoice('online', 'orange_money')}
                  className={`relative p-3 rounded-2xl border text-left flex flex-col justify-between gap-2.5 min-h-[104px] transition active:scale-[0.98] ${
                    paymentMethod === 'orange_money' ? pal.selectedOptionCard : pal.unselectedOptionCard
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <OrangeMoneyLogo className="w-11 h-11 shrink-0" />
                    {paymentMethod === 'orange_money' ? (
                      <span className={`w-5 h-5 rounded-full ${pal.selectedCheckInline} flex items-center justify-center`}>
                        <Check className="w-3 h-3 stroke-[3.2]" />
                      </span>
                    ) : (
                      <span className="w-4 h-4 rounded-full border-2 border-white/25" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-white">Orange Money</div>
                    <div className="text-[10.5px] text-white/60">Simple et sécurisé</div>
                  </div>
                </button>
              </div>

              {(paymentMethod === 'wave' || paymentMethod === 'orange_money') && (
                <div className={pal.inputWell}>
                  <div className="flex items-center gap-2.5">
                    <Phone className="w-4 h-4 text-white/55 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <label className="text-[10.5px] font-medium text-white/55 block mb-0.5">
                        Numéro {paymentMethod === 'wave' ? 'Wave' : 'Orange Money'} (facultatif)
                      </label>
                      <input
                        type="tel"
                        value={payerPhone}
                        onChange={(e) => onChangePayerPhone(e.target.value)}
                        placeholder="+225 07 XX XX XX XX"
                        className="w-full bg-transparent text-xs font-bold text-white placeholder:text-white/25 outline-none tabular-nums"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Option 2: Paiement à la livraison (0% client fee) */}
          <button
            id="btn-payment-mode-cod"
            type="button"
            onClick={() => onSelectPaymentChoice('cod', 'cash_on_delivery')}
            className={`w-full p-4 rounded-2xl border text-left transition active:scale-[0.99] space-y-2 ${
              paymentMode === 'cod' ? pal.selectedOptionCard : pal.unselectedOptionCard
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <CashOnDeliveryLogo className="w-11 h-11 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[15px] font-extrabold text-white">Paiement à la livraison</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[10px] font-black">
                      0% frais client
                    </span>
                  </div>
                  <p className="text-xs text-white/65 mt-0.5">
                    Payez directement à la réception de votre commande. Aucun frais supplémentaire (0 FCFA).
                  </p>
                </div>
              </div>

              {paymentMode === 'cod' ? (
                <span className={`w-6 h-6 rounded-full ${pal.selectedCheckInline} flex items-center justify-center shrink-0`}>
                  <Check className="w-3.5 h-3.5 stroke-[3.2]" />
                </span>
              ) : (
                <span className="w-5 h-5 rounded-full border-2 border-white/25 bg-black/20 shrink-0" />
              )}
            </div>
          </button>
        </div>
      </section>

      {/* 2. Détail du paiement */}
      <section className={`${pal.card} p-4 space-y-3`}>
        <div className="flex items-center gap-2.5">
          <SummaryCalculatorIcon accent={pal.svgAccent} className="w-6 h-6 shrink-0" />
          <h3 className="text-[15.5px] font-extrabold text-white tracking-tight">
            Détail du paiement
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
              <span>Code promo ({appliedPromo.code})</span>
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
                  : paymentMode === 'cod'
                  ? 'Frais client (Paiement à la livraison)'
                  : 'Frais client'}
              </span>
              <Info className="w-3.5 h-3.5 text-white/45" />
            </button>
            <span className="font-extrabold text-white tabular-nums">
              {paymentMode === 'online'
                ? `+ ${formatFCFA(clientFeeFcfa)}`
                : paymentMode === 'cod'
                ? '0 FCFA (0%)'
                : 'À déterminer'}
            </span>
          </div>

          {showFeeTooltip && (
            <p className="text-[11px] text-white/65 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
              Le paiement en ligne inclut 6,5% de frais client pour le traitement et le reversement
              sécurisé au vendeur. Le paiement à la livraison est sans frais (0%).
            </p>
          )}
        </div>

        <div className="pt-3 border-t border-white/[0.09] flex items-center justify-between">
          <span className="flex items-center gap-2 text-[15px] font-extrabold text-white">
            <span className={`w-7 h-7 rounded-lg ${pal.iconBox} flex items-center justify-center`}>
              <Wallet className={`w-4 h-4 ${pal.accentText}`} />
            </span>
            <span>{paymentMode === 'cod' ? 'Total à payer à la livraison' : 'Montant total à payer'}</span>
          </span>
          <span className={`text-xl font-black ${pal.accentText} tabular-nums`}>
            {formatFCFA(totalPayable)}
          </span>
        </div>
      </section>

      {/* 3. Code promo (facultatif) */}
      <section className={`${pal.card} p-4 space-y-2.5`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <PromoTagGreenIcon accent={pal.svgAccent} className="w-5 h-5 shrink-0" />
            <h3 className="text-[15px] font-extrabold text-white">
              Code promo <span className="font-normal text-white/55">(facultatif)</span>
            </h3>
          </div>
          {appliedPromo && (
            <span className={`text-[11px] font-extrabold ${pal.promoAppliedPill} px-2.5 py-0.5 rounded-full`}>
              {appliedPromo.code} appliqué
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className={`flex-1 min-h-[48px] ${pal.inputWell} flex items-center gap-2.5`}>
            <Ticket className="w-4 h-4 text-white/50 shrink-0" />
            <input
              type="text"
              value={promoInput}
              disabled={Boolean(appliedPromo)}
              onChange={(e) => {
                setPromoInput(e.target.value.toUpperCase());
                setPromoError('');
              }}
              placeholder="Entrez votre code promo..."
              className="w-full bg-transparent text-sm font-bold text-white placeholder:text-white/30 outline-none uppercase"
            />
          </div>

          {appliedPromo ? (
            <button
              type="button"
              onClick={() => {
                onRemovePromo();
                setPromoInput('');
                setPromoError('');
              }}
              className="min-h-[48px] px-4 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/45 text-rose-300 text-xs font-extrabold flex items-center gap-1 transition shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>Retirer</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={promoLoading}
              onClick={handleValidatePromo}
              className={`min-h-[48px] px-4 rounded-2xl ${pal.outlineAccentBtn} text-xs font-extrabold flex items-center justify-center gap-1.5 transition active:scale-95 shrink-0 disabled:opacity-50`}
            >
              {promoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Appliquer'}
            </button>
          )}
        </div>

        {promoError && <p className="text-[11px] text-rose-400 font-semibold">{promoError}</p>}
      </section>

      {/* 4. Security Assurance Card */}
      <section className={`${pal.securityCard} flex items-center justify-between gap-3`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-2xl ${pal.iconBox} ${pal.accentTextBright} flex items-center justify-center shrink-0`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-white">Paiement sécurisé DJASSA</div>
            <p className="text-[11px] text-white/65 leading-snug mt-0.5">
              Wave & Orange Money via GeniusPay ou règlement direct à la réception.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <PciDssBadgeLogo accent={pal.svgAccent} />
          <DjassaSecurityShieldBadge accent={pal.svgAccent} />
        </div>
      </section>

      {/* 5. CTA Row */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className={`min-h-[54px] px-5 rounded-full ${pal.secondaryBtn} font-bold text-sm flex items-center justify-center gap-1.5 transition active:scale-95 shrink-0`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour</span>
          </button>

          <button
            id="btn-checkout-step3-pay"
            type="button"
            disabled={!isSelectionComplete}
            onClick={onContinue}
            className={`flex-1 min-h-[54px] py-3.5 px-6 rounded-full ${pal.primaryBtn} disabled:from-white/10 disabled:via-white/10 disabled:to-white/10 disabled:bg-white/10 disabled:text-white/35 font-black text-[15.5px] flex items-center justify-center gap-2 disabled:shadow-none transition active:scale-[0.98]`}
          >
            <Lock className="w-4 h-4 stroke-[2.6]" />
            <span>
              {!paymentMode
                ? 'Choisissez un mode de paiement'
                : paymentMode === 'online' && !paymentMethod
                ? 'Choisissez Wave ou Orange Money'
                : 'Continuer'}
            </span>
            {isSelectionComplete && <ArrowRight className="w-5 h-5 stroke-[2.6]" />}
          </button>
        </div>

        <p className="text-[11px] text-white/60 text-center flex items-center justify-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-white/45 shrink-0" />
          <span>Vérifiez votre récapitulatif final à l’étape suivante</span>
        </p>
      </div>
    </div>
  );
};
