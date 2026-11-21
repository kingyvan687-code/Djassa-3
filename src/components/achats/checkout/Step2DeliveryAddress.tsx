import React, { useMemo, useState } from 'react';
import {
  MapPin,
  User,
  Phone,
  Building2,
  Home,
  LocateFixed,
  Pencil,
  Info,
  ShieldCheck,
  Headphones,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Loader2,
  BookmarkCheck,
  Store
} from 'lucide-react';
import { Seller, UserProfile } from '../../../types';
import { ABIDJAN_COMMUNES } from '../../../data/mockData';
import { formatFCFA } from '../../../services/marketServices';
import { getBrowserGeolocation, reverseGeocodeCoords } from '../../../services/geocodingService';
import { ClientAddressMapPickerModal } from './ClientAddressMapPickerModal';
import {
  ABIDJAN_QUARTIERS_BY_COMMUNE,
  CheckoutTheme,
  DeliveryAddressForm,
  getAddressValidationErrors,
  getCheckoutPalette,
  isDeliveryAddressValid,
  resolveSellerDisplay
} from './checkoutTypes';
import {
  DeliverySpeechBubbleIcon,
  LocationPinIcon3D,
  MapButtonIcon,
  SummaryCalculatorIcon,
  VerifiedBlueSeal
} from './PaymentBrandLogos';

interface Step2DeliveryAddressProps {
  theme?: CheckoutTheme;
  form: DeliveryAddressForm;
  onChangeForm: (patch: Partial<DeliveryAddressForm>) => void;
  userProfile: UserProfile;
  seller?: Seller;
  sellerCount?: number;
  subtotal: number;
  totalQuantity: number;
  onBack: () => void;
  onContinue: () => void;
}

export const Step2DeliveryAddress: React.FC<Step2DeliveryAddressProps> = ({
  theme = 'neon',
  form,
  onChangeForm,
  userProfile,
  seller,
  sellerCount = 1,
  subtotal,
  totalQuantity,
  onBack,
  onContinue
}) => {
  const pal = getCheckoutPalette(theme);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsStatusMsg, setGpsStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [showDeliveryInfoTooltip, setShowDeliveryInfoTooltip] = useState(false);

  const sellerDisplay = useMemo(() => resolveSellerDisplay(seller), [seller]);

  const hasSavedProfileAddress = Boolean(
    userProfile.name?.trim() &&
      userProfile.phone?.trim() &&
      (userProfile.deliveryAddressDetails?.trim() ||
        userProfile.address?.trim() ||
        userProfile.deliveryCommune?.trim())
  );

  const errors = useMemo(() => getAddressValidationErrors(form), [form]);
  const addressIsValid = useMemo(() => isDeliveryAddressValid(form), [form]);

  const quartierSuggestions = useMemo(() => {
    return ABIDJAN_QUARTIERS_BY_COMMUNE[form.commune] || [];
  }, [form.commune]);

  const markTouched = (field: string) =>
    setTouchedFields((prev) => ({ ...prev, [field]: true }));

  const showError = (field: string) =>
    (submitAttempted || touchedFields[field]) && errors[field];

  const handleReuseSavedAddress = () => {
    onChangeForm({
      recipientName: userProfile.name || '',
      phone: userProfile.phone || '',
      commune: userProfile.deliveryCommune || 'Cocody',
      quartier: userProfile.deliveryQuartier || 'Angré',
      details: userProfile.deliveryAddressDetails || userProfile.address || ''
    });
    setGpsStatusMsg({ type: 'ok', text: 'Adresse enregistrée appliquée.' });
  };

  const handleDetectMyPosition = async () => {
    setGpsStatusMsg(null);
    setIsLocating(true);
    try {
      const pos = await getBrowserGeolocation();
      const addr = await reverseGeocodeCoords(pos.lat, pos.lng, pos.accuracy);
      onChangeForm({
        commune: addr.commune || form.commune || 'Cocody',
        quartier: addr.quartier || form.quartier,
        details: addr.formattedAddress || form.details,
        gpsCoords: { lat: pos.lat, lng: pos.lng }
      });
      setGpsStatusMsg({
        type: 'ok',
        text: `Position GPS détectée : ${addr.commune}${addr.quartier ? ` (${addr.quartier})` : ''}`
      });
    } catch {
      setGpsStatusMsg({
        type: 'err',
        text: 'Localisation GPS indisponible ou refusée. Utilisez « Carte » ou saisissez votre adresse.'
      });
    } finally {
      setIsLocating(false);
    }
  };

  const handleContinueClick = () => {
    setSubmitAttempted(true);
    if (!addressIsValid) return;
    onContinue();
  };

  return (
    <div className="space-y-3.5 pb-6">
      {/* 1. Delivery Address Form Card */}
      <section className={`${pal.card} p-4 space-y-3.5`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-2xl ${pal.iconBox} flex items-center justify-center shrink-0`}>
              <LocationPinIcon3D accent={pal.svgAccent} className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[16px] font-extrabold text-white leading-tight tracking-tight">
                Adresse de livraison
              </h2>
              <p className="text-xs text-white/60 mt-0.5">
                Indiquez l’adresse exacte à transmettre au vendeur
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsMapOpen(true)}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-full ${pal.outlineAccentBtn} text-xs font-extrabold flex items-center gap-1.5 transition active:scale-95 shrink-0`}
          >
            <MapButtonIcon accent={pal.svgAccent} className="w-4 h-4" />
            <span>Carte</span>
          </button>
        </div>

        {/* Explicit button to reuse saved profile address ONLY on click */}
        {hasSavedProfileAddress && (
          <button
            type="button"
            onClick={handleReuseSavedAddress}
            className={`w-full min-h-[42px] px-3 py-2 rounded-2xl ${pal.outlineAccentBtn} text-xs font-bold flex items-center justify-center gap-2 transition active:scale-[0.99]`}
          >
            <BookmarkCheck className="w-4 h-4 shrink-0" />
            <span>Réutiliser mon adresse enregistrée</span>
          </button>
        )}

        {/* Row 1: Nom complet + Téléphone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className={pal.inputWell}>
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/60 shrink-0">
                <User className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <label className="text-[11px] font-medium text-white/55 flex items-center gap-1 mb-0.5">
                  <span>Nom complet</span>
                  <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.recipientName}
                  onBlur={() => markTouched('recipientName')}
                  onChange={(e) => onChangeForm({ recipientName: e.target.value })}
                  placeholder="Ex : Kouassi Aka"
                  className="w-full bg-transparent text-sm font-bold text-white placeholder:text-white/25 outline-none"
                />
              </div>
            </div>
            {showError('recipientName') && (
              <p className="text-[10px] text-rose-400 mt-1.5 pl-10">{errors.recipientName}</p>
            )}
          </div>

          <div className={pal.inputWell}>
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/60 shrink-0">
                <Phone className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <label className="text-[11px] font-medium text-white/55 flex items-center gap-1 mb-0.5">
                  <span>Téléphone</span>
                  <span className="text-rose-400">*</span>
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onBlur={() => markTouched('phone')}
                  onChange={(e) => onChangeForm({ phone: e.target.value })}
                  placeholder="+225 07 XX XX XX XX"
                  className="w-full bg-transparent text-sm font-bold text-white placeholder:text-white/25 outline-none tabular-nums"
                />
              </div>
            </div>
            {showError('phone') && (
              <p className="text-[10px] text-rose-400 mt-1.5 pl-10">{errors.phone}</p>
            )}
          </div>
        </div>

        {/* Row 2: Commune + Quartier */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className={pal.inputWell}>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/60 shrink-0">
                <Building2 className="w-3.5 h-3.5" />
              </span>
              <div className="flex-1 min-w-0">
                <label className="text-[11px] font-medium text-white/55 flex items-center gap-1 mb-0.5">
                  <span>Commune</span>
                  <span className="text-rose-400">*</span>
                </label>
                <div className="relative flex items-center">
                  <select
                    value={form.commune}
                    onBlur={() => markTouched('commune')}
                    onChange={(e) => onChangeForm({ commune: e.target.value })}
                    className="w-full bg-transparent text-sm font-bold text-white outline-none appearance-none pr-5 cursor-pointer"
                  >
                    <option value="" className="bg-[#111513] text-white/60">
                      Choisir...
                    </option>
                    {ABIDJAN_COMMUNES.map((comm) => (
                      <option key={comm} value={comm} className="bg-[#111513] text-white">
                        {comm}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-white/50 pointer-events-none absolute right-0" />
                </div>
              </div>
            </div>
            {showError('commune') && (
              <p className="text-[10px] text-rose-400 mt-1">{errors.commune}</p>
            )}
          </div>

          <div className={pal.inputWell}>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/60 shrink-0">
                <Building2 className="w-3.5 h-3.5" />
              </span>
              <div className="flex-1 min-w-0">
                <label className="text-[11px] font-medium text-white/55 flex items-center gap-1 mb-0.5">
                  <span>Quartier</span>
                  <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  list="djassa-quartiers-list"
                  value={form.quartier}
                  onBlur={() => markTouched('quartier')}
                  onChange={(e) => onChangeForm({ quartier: e.target.value })}
                  placeholder="Ex : Cocody..."
                  className="w-full bg-transparent text-sm font-bold text-white placeholder:text-white/25 outline-none"
                />
                <datalist id="djassa-quartiers-list">
                  {quartierSuggestions.map((q) => (
                    <option key={q} value={q} />
                  ))}
                </datalist>
              </div>
            </div>
            {showError('quartier') && (
              <p className="text-[10px] text-rose-400 mt-1">{errors.quartier}</p>
            )}
          </div>
        </div>

        {/* Row 3: Adresse détaillée */}
        <div className={pal.inputWell}>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/60 shrink-0">
              <Home className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0">
              <label className="text-[11px] font-medium text-white/55 flex items-center gap-1 mb-0.5">
                <span>Adresse détaillée</span>
                <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={form.details}
                onBlur={() => markTouched('details')}
                onChange={(e) => onChangeForm({ details: e.target.value })}
                placeholder="Ex : II Plateaux, rue des Jardins, immeuble..."
                className="w-full bg-transparent text-sm font-bold text-white placeholder:text-white/25 outline-none"
              />
            </div>
          </div>
          {showError('details') && (
            <p className="text-[10px] text-rose-400 mt-1.5 pl-10">{errors.details}</p>
          )}
        </div>

        {/* Row 4: Repère (facultatif) + Ma position */}
        <div className={`${pal.inputWell} py-2 flex items-center justify-between gap-2`}>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/60 shrink-0">
              <MapPin className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0">
              <label className="text-[11px] font-medium text-white/55 block mb-0.5">
                Repère (facultatif)
              </label>
              <input
                type="text"
                value={form.landmark}
                onChange={(e) => onChangeForm({ landmark: e.target.value })}
                placeholder="Ex : Station Shell..."
                className="w-full bg-transparent text-sm font-bold text-white placeholder:text-white/25 outline-none"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleDetectMyPosition}
            disabled={isLocating}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-full ${pal.outlineAccentBtn} text-xs font-extrabold flex items-center gap-1.5 transition active:scale-95 shrink-0 disabled:opacity-50`}
          >
            {isLocating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LocateFixed className="w-3.5 h-3.5" />
            )}
            <span>{isLocating ? 'GPS...' : 'Ma position'}</span>
          </button>
        </div>

        {gpsStatusMsg && (
          <p
            className={`text-[11px] rounded-xl px-3 py-2 border font-medium ${
              gpsStatusMsg.type === 'ok'
                ? pal.statusOkBox
                : 'bg-amber-500/12 border-amber-500/30 text-amber-300'
            }`}
          >
            {gpsStatusMsg.text}
          </p>
        )}
      </section>

      {/* 2. Consignes pour le vendeur */}
      <section className={`${pal.card} p-4 space-y-3`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl ${pal.iconBox} flex items-center justify-center shrink-0`}>
            <DeliverySpeechBubbleIcon accent={pal.svgAccent} className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-[15.5px] font-extrabold text-white leading-tight tracking-tight">
              Consignes de réception
            </h3>
            <p className="text-xs text-white/60 mt-0.5">
              Précisez vos instructions pour le vendeur (facultatif)
            </p>
          </div>
        </div>

        <div className={`${pal.inputWell} py-3 flex items-center gap-2.5`}>
          <Pencil className="w-4 h-4 text-white/50 shrink-0" />
          <input
            type="text"
            value={form.deliveryInstructions}
            onChange={(e) => onChangeForm({ deliveryInstructions: e.target.value })}
            placeholder="Ex : Appelez avant de passer, disponibilité après 15h..."
            className="w-full bg-transparent text-sm font-medium text-white placeholder:text-white/30 outline-none"
          />
        </div>
      </section>

      {/* 3. Livraison organisée directement par le vendeur */}
      <section className={`${pal.card} p-4 space-y-3`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-2xl ${pal.iconBox} flex items-center justify-center shrink-0`}>
              <Store className={`w-5 h-5 ${pal.accentText}`} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15.5px] font-extrabold text-white leading-tight tracking-tight truncate">
                Livraison gérée par la boutique
              </h3>
              <p className="text-xs text-white/60 mt-0.5">
                {sellerCount > 1
                  ? `${sellerCount} boutiques organisent leurs remises directement`
                  : 'Organisation directe entre vous et le vendeur'}
              </p>
            </div>
          </div>

          <span className={`px-2.5 py-1 rounded-full ${pal.promoAppliedPill} text-[11px] font-extrabold shrink-0`}>
            0 FCFA
          </span>
        </div>

        <div className={`p-3 rounded-2xl ${pal.innerWell} space-y-2 text-xs`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-extrabold text-white truncate">{sellerDisplay.name}</span>
              {sellerDisplay.verified && <VerifiedBlueSeal className="w-4 h-4 shrink-0" />}
            </div>
            {sellerDisplay.phone && (
              <span className="text-[11px] font-mono text-white/75 shrink-0">
                {sellerDisplay.phone}
              </span>
            )}
          </div>
          <p className="text-[11px] text-white/65 leading-relaxed">
            La boutique reçoit votre adresse et votre numéro de téléphone dès validation de la
            commande pour organiser la livraison à l’extérieur de DJASSA. Aucun frais de livraison
            DJASSA n’est ajouté ici.
          </p>
        </div>
      </section>

      {/* 4. Price Summary */}
      <section className={`${pal.card} p-4 space-y-3`}>
        <div className="flex items-center gap-2.5">
          <SummaryCalculatorIcon accent={pal.svgAccent} className="w-6 h-6 shrink-0" />
          <h3 className="text-[15.5px] font-extrabold text-white tracking-tight">
            Résumé du montant
          </h3>
        </div>

        <div className="space-y-2 text-[13px]">
          <div className="flex items-center justify-between text-white/70">
            <span>
              Sous-total ({totalQuantity} article{totalQuantity > 1 ? 's' : ''})
            </span>
            <span className="font-extrabold text-white tabular-nums">{formatFCFA(subtotal)}</span>
          </div>

          <div className="flex items-center justify-between text-white/70">
            <button
              type="button"
              onClick={() => setShowDeliveryInfoTooltip((v) => !v)}
              className="flex items-center gap-1.5 hover:text-white transition"
            >
              <span>Livraison (gérée par la boutique)</span>
              <Info className="w-3.5 h-3.5 text-white/45" />
            </button>
            <span className={`font-extrabold ${pal.accentText} tabular-nums`}>0 FCFA</span>
          </div>

          {showDeliveryInfoTooltip && (
            <p className="text-[11px] text-white/65 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
              Le vendeur organise la remise ou l’expédition directement avec vous. DJASSA ne prélève
              aucun frais de livraison.
            </p>
          )}
        </div>

        <div className="pt-3 border-t border-white/[0.09] flex items-center justify-between">
          <span className="text-[15px] font-extrabold text-white">Sous-total articles</span>
          <span className={`text-xl font-black ${pal.accentText} tabular-nums`}>
            {formatFCFA(subtotal)}
          </span>
        </div>
      </section>

      {/* 5. Bottom Bar */}
      <div className="pt-1 space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2 text-[11px] text-white/80 font-semibold">
            <span className={`w-6 h-6 rounded-full ${pal.iconBox} flex items-center justify-center shrink-0`}>
              <ShieldCheck className={`w-3.5 h-3.5 ${pal.accentText}`} />
            </span>
            <span className="leading-tight">Commande sécurisée DJASSA</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-white/80 font-semibold">
            <span className={`w-6 h-6 rounded-full ${pal.iconBox} flex items-center justify-center shrink-0`}>
              <Headphones className={`w-3.5 h-3.5 ${pal.accentText}`} />
            </span>
            <span className="leading-tight">Assistance 24h/7j</span>
          </div>
        </div>

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
            id="btn-checkout-step2-continue"
            type="button"
            onClick={handleContinueClick}
            disabled={!addressIsValid}
            className={`flex-1 min-h-[54px] py-3.5 px-6 rounded-full ${pal.primaryBtn} disabled:from-white/10 disabled:via-white/10 disabled:to-white/10 disabled:bg-white/10 disabled:text-white/35 font-black text-[16px] flex items-center justify-center gap-2 disabled:shadow-none transition active:scale-[0.98]`}
          >
            <span>Continuer</span>
            <ArrowRight className="w-5 h-5 stroke-[2.6]" />
          </button>
        </div>
      </div>

      {/* Interactive Leaflet Map Picker Modal */}
      {isMapOpen && (
        <ClientAddressMapPickerModal
          theme={theme}
          fullWidth={pal.isClient}
          initialCoords={form.gpsCoords}
          onClose={() => setIsMapOpen(false)}
          onConfirmLocation={(res) => {
            onChangeForm({
              commune: res.commune,
              quartier: res.quartier,
              details: res.details,
              gpsCoords: { lat: res.lat, lng: res.lng }
            });
            setIsMapOpen(false);
            setGpsStatusMsg({
              type: 'ok',
              text: `Point validé sur carte : ${res.commune} (${res.quartier})`
            });
          }}
        />
      )}
    </div>
  );
};
