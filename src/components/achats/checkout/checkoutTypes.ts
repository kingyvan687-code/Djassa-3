import { Order, PaymentMethod, PaymentMode, Product, Seller } from '../../../types';

export type CheckoutStep = 1 | 2 | 3 | 4;

export type CheckoutTheme = 'neon' | 'client';

export type PaymentModeType = PaymentMode;
export type PaymentMethodType = PaymentMethod;

export const CLIENT_ONLINE_FEE_RATE = 0.065;
export const DJASSA_FIXED_COMMISSION_FCFA = 150;

export function calculateClientOnlineFee(
  merchandiseNet: number,
  paymentMode: PaymentModeType | null | undefined
): number {
  if (paymentMode !== 'online') return 0;
  if (!Number.isFinite(merchandiseNet) || merchandiseNet <= 0) return 0;
  return Math.round(merchandiseNet * CLIENT_ONLINE_FEE_RATE);
}

/** @deprecated Kept for legacy references — returns 0 in simplified DJASSA pricing */
export function calculateServiceFee(_subtotal: number): number {
  return 0;
}

export function getCheckoutPalette(theme: CheckoutTheme = 'neon') {
  const isClient = theme === 'client';
  return {
    isClient,
    svgAccent: (isClient ? 'orange' : 'green') as 'orange' | 'green',
    pageBg: isClient ? 'bg-[#0A0A0A]' : 'bg-[#050706]',
    pageGlow: isClient
      ? 'radial-gradient(90% 42% at 50% 6%, rgba(255, 99, 33, 0.14) 0%, rgba(255, 99, 33, 0.04) 45%, rgba(10, 10, 10, 0) 80%), radial-gradient(80% 35% at 50% 98%, rgba(255, 99, 33, 0.07) 0%, rgba(10, 10, 10, 0) 70%)'
      : 'radial-gradient(90% 42% at 50% 6%, rgba(22, 229, 117, 0.13) 0%, rgba(16, 185, 129, 0.04) 45%, rgba(5, 7, 6, 0) 80%), radial-gradient(80% 35% at 50% 98%, rgba(22, 229, 117, 0.07) 0%, rgba(5, 7, 6, 0) 70%)',
    headerBg: isClient
      ? 'bg-[#0A0A0A]/90 backdrop-blur-xl border-b border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.45)]'
      : 'bg-[#060908]/90 backdrop-blur-2xl border-b border-white/[0.08] shadow-[0_10px_30px_rgba(0,0,0,0.45)]',
    headerGlow: isClient
      ? 'radial-gradient(75% 110% at 50% -10%, rgba(255, 99, 33, 0.2) 0%, rgba(255, 99, 33, 0.06) 45%, rgba(10, 10, 10, 0) 100%)'
      : 'radial-gradient(75% 110% at 50% -10%, rgba(22, 229, 117, 0.22) 0%, rgba(16, 185, 129, 0.08) 45%, rgba(6, 9, 8, 0) 100%)',
    headerIconBtn: isClient
      ? 'bg-white/10 hover:bg-white/15 border border-white/10 shadow-md'
      : 'bg-gradient-to-b from-[#1C221F] to-[#111513] hover:from-[#232A26] hover:to-[#151A17] border border-white/[0.13] shadow-[0_4px_14px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]',
    cartBadge: isClient
      ? 'bg-[#FF6321] border-2 border-[#0A0A0A] shadow-md shadow-orange-600/40'
      : 'bg-gradient-to-b from-[#FF5628] to-[#E6350C] border-2 border-[#060908] shadow-[0_2px_10px_rgba(255,69,26,0.65)]',
    stepperFill: isClient
      ? 'bg-gradient-to-r from-[#FF6321] to-[#ff7d45] shadow-[0_0_12px_rgba(255,99,33,0.65)]'
      : 'bg-gradient-to-r from-[#16E575] to-[#34FF93] shadow-[0_0_12px_rgba(22,229,117,0.75)]',
    stepperActive: isClient
      ? 'bg-gradient-to-b from-[#ff7d45] to-[#FF6321] text-white ring-4 ring-[#FF6321]/25 shadow-[0_0_18px_rgba(255,99,33,0.6)]'
      : 'bg-gradient-to-b from-[#34FF93] to-[#14D86B] text-[#04140B] ring-4 ring-[#16E575]/25 shadow-[0_0_20px_rgba(22,229,117,0.65)]',
    stepperCompleted: isClient
      ? 'bg-gradient-to-b from-[#ff7d45] to-[#FF6321] text-white shadow-[0_0_12px_rgba(255,99,33,0.35)]'
      : 'bg-gradient-to-b from-[#2CF588] to-[#14D86B] text-[#04140B] shadow-[0_0_12px_rgba(22,229,117,0.35)]',
    stepperPending: isClient
      ? 'bg-white/10 text-white/60 border border-white/15'
      : 'bg-gradient-to-b from-[#2A302D] to-[#1C201E] text-white/65 border border-white/[0.14] shadow-inner',
    card: isClient
      ? 'rounded-[22px] bg-[#141414] border border-white/10 shadow-xl'
      : 'rounded-[22px] bg-gradient-to-b from-[#171D1A] via-[#111513] to-[#0B0E0C] border border-white/[0.11] shadow-[0_14px_34px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.06)]',
    cardMuted: isClient
      ? 'p-4 rounded-[22px] bg-[#121212] border border-dashed border-white/15'
      : 'p-4 rounded-[22px] bg-gradient-to-b from-[#131815] to-[#0B0E0C] border border-dashed border-white/18',
    inputWell: isClient
      ? 'rounded-2xl bg-white/5 border border-white/10 px-3 py-2.5 focus-within:border-[#FF6321] focus-within:shadow-[0_0_0_3px_rgba(255,99,33,0.14)] transition'
      : 'rounded-2xl bg-[#080B09] border border-white/[0.09] shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] px-3 py-2.5 focus-within:border-[#1EEB7A]/65 focus-within:shadow-[0_0_0_3px_rgba(22,229,117,0.12)] transition',
    innerWell: isClient ? 'bg-[#0E0E0E] border border-white/10' : 'bg-[#080B09] border border-white/[0.08]',
    qtyWell: isClient
      ? 'bg-white/5 border border-white/10'
      : 'bg-[#080B09] border border-white/[0.1] shadow-[inset_0_2px_6px_rgba(0,0,0,0.65)]',
    qtyBtn: isClient
      ? 'bg-white/10 hover:bg-white/15 border border-white/10'
      : 'bg-gradient-to-b from-[#232926] to-[#171B19] hover:from-[#2B322E] hover:to-[#1E2320] border border-white/[0.08]',
    iconBox: isClient
      ? 'bg-[#FF6321]/15 border border-[#FF6321]/35 shadow-[0_0_16px_rgba(255,99,33,0.18)]'
      : 'bg-[#0D2719] border border-[#1EEB7A]/35 shadow-[0_0_18px_rgba(22,229,117,0.2)]',
    thumbFrame: isClient
      ? 'bg-[#121212] border border-white/10 shadow-lg'
      : 'bg-gradient-to-br from-[#0F3320] via-[#131B17] to-[#0A0D0B] border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_8px_22px_rgba(0,0,0,0.5)]',
    accentText: isClient ? 'text-[#FF6321]' : 'text-[#1EEB7A]',
    accentTextBright: isClient ? 'text-[#FF6321]' : 'text-[#2BFF91]',
    promoBadge: isClient
      ? 'bg-[#FF6321] text-white shadow-md shadow-orange-600/30'
      : 'bg-gradient-to-r from-[#2BFF91] to-[#13CC68] text-[#04140B] shadow-[0_3px_10px_rgba(22,229,117,0.45)]',
    primaryBtn: isClient
      ? 'bg-gradient-to-r from-[#FF6321] to-[#ff7d45] hover:brightness-105 text-white shadow-lg shadow-orange-600/30'
      : 'bg-gradient-to-r from-[#2BFF91] via-[#16E575] to-[#11C962] hover:brightness-105 text-[#04140B] shadow-[0_10px_28px_rgba(22,229,117,0.38),inset_0_1px_0_rgba(255,255,255,0.45)]',
    secondaryBtn: isClient
      ? 'bg-white/10 hover:bg-white/15 border border-white/15 text-white shadow-md'
      : 'bg-gradient-to-b from-[#1A201D] to-[#101412] hover:from-[#212825] hover:to-[#141916] border border-white/[0.14] text-white shadow-[0_6px_18px_rgba(0,0,0,0.45)]',
    outlineAccentBtn: isClient
      ? 'bg-[#FF6321]/15 hover:bg-[#FF6321]/25 border border-[#FF6321]/55 text-[#FF6321] shadow-[0_0_14px_rgba(255,99,33,0.15)]'
      : 'bg-gradient-to-b from-[#133823] to-[#0B2215] hover:brightness-110 border border-[#1EEB7A]/60 text-[#2BFF91] shadow-[0_0_16px_rgba(22,229,117,0.2)]',
    selectedOptionCard: isClient
      ? 'bg-[#FF6321]/12 border-[#FF6321] shadow-[0_0_20px_rgba(255,99,33,0.22)]'
      : 'bg-gradient-to-b from-[#113320] via-[#0B2014] to-[#08150D] border-[#1EEB7A] shadow-[0_0_24px_rgba(22,229,117,0.25),inset_0_1px_0_rgba(52,255,147,0.22)]',
    unselectedOptionCard: isClient
      ? 'bg-white/[0.04] border-white/10 hover:border-white/25'
      : 'bg-gradient-to-b from-[#141916] to-[#0B0E0C] border-white/[0.1] hover:border-white/25',
    selectedCheckBadge: isClient
      ? 'bg-[#FF6321] text-white border-2 border-[#0A0A0A] shadow-md'
      : 'bg-gradient-to-b from-[#34FF93] to-[#13CC68] text-[#04140B] border-2 border-[#050706] shadow-[0_2px_10px_rgba(22,229,117,0.5)]',
    selectedCheckInline: isClient
      ? 'bg-[#FF6321] text-white shadow-md'
      : 'bg-gradient-to-b from-[#34FF93] to-[#13CC68] text-[#04140B] shadow-[0_2px_10px_rgba(22,229,117,0.5)]',
    unitPill: isClient
      ? 'bg-[#FF6321]/15 border border-[#FF6321]/50 text-[#FF6321]'
      : 'bg-gradient-to-b from-[#0F2C1B] to-[#0A1D12] border border-[#1EEB7A]/55 text-[#2BFF91] shadow-[0_0_16px_rgba(22,229,117,0.16)]',
    variantActive: isClient
      ? 'bg-[#FF6321]/15 border-[#FF6321] text-[#FF6321]'
      : 'bg-[#0E2C1B] border-[#1EEB7A] text-[#2BFF91] shadow-[0_0_14px_rgba(22,229,117,0.2)]',
    variantIdle: isClient
      ? 'bg-white/5 border-white/10 text-white/80 hover:border-white/25'
      : 'bg-[#090C0A] border-white/[0.09] text-white/80 hover:border-white/25',
    thumbRingActive: isClient
      ? 'border-[#FF6321] ring-2 ring-[#FF6321]/35'
      : 'border-[#1EEB7A] ring-2 ring-[#16E575]/35 shadow-[0_0_12px_rgba(22,229,117,0.25)]',
    colorRingActive: isClient
      ? 'ring-2 ring-[#FF6321] ring-offset-2 ring-offset-[#141414] scale-105'
      : 'ring-2 ring-[#1EEB7A] ring-offset-2 ring-offset-[#121614] shadow-[0_0_12px_rgba(22,229,117,0.45)] scale-105',
    securityCard: isClient
      ? 'p-3.5 rounded-[22px] bg-gradient-to-r from-[#FF6321]/12 via-[#141414] to-[#121212] border border-[#FF6321]/30 shadow-xl'
      : 'p-3.5 rounded-[22px] bg-gradient-to-r from-[#0E2819] via-[#101814] to-[#0B0E0C] border border-[#1EEB7A]/30 shadow-[0_8px_24px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(52,255,147,0.12)]',
    promoAppliedPill: isClient
      ? 'text-[#FF6321] bg-[#FF6321]/15 border border-[#FF6321]/45'
      : 'text-[#2BFF91] bg-[#0D2719] border border-[#1EEB7A]/45',
    statusOkBox: isClient
      ? 'bg-[#FF6321]/12 border-[#FF6321]/35 text-[#FF6321]'
      : 'bg-[#16E575]/12 border-[#1EEB7A]/35 text-[#2BFF91]',
  };
}

export interface CheckoutLineItem {
  cartItemId?: string;
  product: Product;
  variantSelected: Record<string, string>;
  quantity: number;
}

export interface DeliveryAddressForm {
  recipientName: string;
  phone: string;
  commune: string;
  quartier: string;
  details: string;
  landmark: string;
  deliveryInstructions: string;
  gpsCoords?: { lat: number; lng: number };
}

export interface AppliedPromoState {
  code: string;
  discountFcfa: number;
  label?: string;
}

export interface OrderSubmissionResult {
  order: Order;
  orders?: Order[];
  checkoutGroupId?: string;
  totalAmountFcfa?: number;
  providerConfigured: boolean;
  paymentUrl?: string | null;
  checkoutUrl?: string | null;
}

export const ABIDJAN_QUARTIERS_BY_COMMUNE: Record<string, string[]> = {
  Cocody: [
    'Angré 7e Tranche',
    'Angré 8e Tranche',
    'Deux-Plateaux Vallons',
    'Deux-Plateaux Aghien',
    'Riviera Palmeraie',
    'Riviera Golf',
    'Riviera Faya',
    'Saint-Jean / Danga',
    'Blockhauss',
    'Ambassades'
  ],
  Yopougon: [
    'Siporex',
    'Selmer',
    'Maroc',
    'Niangon Sud',
    'Niangon Nord',
    'Sideci',
    'Toit Rouge',
    'Ananeraie',
    'Wassakara',
    'Port-Bouët 2'
  ],
  Adjamé: [
    'Forum des Marchés',
    'Adjamé Roxy',
    '220 Logements',
    'Liberté',
    'Williamsville',
    'Bracodi',
    'Gare Nord'
  ],
  Plateau: [
    'Centre des Affaires',
    'Commerce',
    'Cité Administrative',
    'Indénié',
    'Avenue Chardy'
  ],
  Marcory: [
    'Zone 4C',
    'Biétry',
    'Marcory Résidentiel',
    'Anoumabo',
    'Champroux',
    'Remblais Marcory'
  ],
  Koumassi: [
    'Remblais',
    'Grand Campement',
    'Grand Carrefour',
    'Prodomo',
    'Sicogi Koumassi',
    'Zone Industrielle'
  ],
  Treichville: [
    'Avenue 16',
    'Gare de Bassam',
    'Arras',
    'Belleville',
    'Zone 3'
  ],
  'Port-Bouët': [
    'Vridi',
    'Vridi Canal',
    'Aéroport FHB',
    'Gonzagueville',
    'Jean-Folly'
  ],
  Abobo: [
    'Abobo Gare / Mairie',
    'Samaké',
    'Abobo Baoulé',
    'Pk 18',
    'N’Dotré',
    'Anonkoua Kouté'
  ],
  Attécoubé: [
    'Agban',
    'Boribana',
    'Locodjro',
    'Santé',
    'Mossikro'
  ],
  Bingerville: [
    'Centre-ville Bingerville',
    'Feh Kessé',
    'Akandjé',
    'Cité Marina'
  ],
  Songon: [
    'Songon Kassemblé',
    'Songon Agban',
    'Adiake-Carrefour',
    'KM 17'
  ]
};

export function getVariantAvailableStock(
  product: Product,
  variantSelected: Record<string, string>
): number {
  const baseStock = Math.max(0, Number(product.stock || 0));
  if (!product.variantStock) return baseStock;

  const colorVal = variantSelected['Couleur'] || variantSelected['Color'] || '';
  const sizeVal =
    variantSelected['Taille'] || variantSelected['Pointure'] || variantSelected['Size'] || '';

  const comboKeys = [
    colorVal && sizeVal ? `${colorVal}-${sizeVal}` : '',
    colorVal && sizeVal ? `${colorVal} - ${sizeVal}` : ''
  ].filter(Boolean);

  for (const key of comboKeys) {
    if (product.variantStock[key] !== undefined) {
      return Math.min(baseStock, Math.max(0, product.variantStock[key]));
    }
  }

  let matchedIndividual: number | undefined;
  for (const val of Object.values(variantSelected)) {
    if (val && product.variantStock[val] !== undefined) {
      const s = Math.max(0, product.variantStock[val]);
      matchedIndividual = matchedIndividual === undefined ? s : Math.min(matchedIndividual, s);
    }
  }

  if (matchedIndividual !== undefined) {
    return Math.min(baseStock, matchedIndividual);
  }
  return baseStock;
}

export function isPhoneValid(phone: string): boolean {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length >= 8;
}

export function getAddressValidationErrors(form: DeliveryAddressForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.recipientName.trim() || form.recipientName.trim().length < 2) {
    errors.recipientName = 'Nom complet requis (min. 2 caractères)';
  }
  if (!isPhoneValid(form.phone)) {
    errors.phone = 'Numéro joignable requis (min. 8 chiffres)';
  }
  if (!form.commune.trim()) {
    errors.commune = 'Sélectionnez une commune';
  }
  if (!form.quartier.trim() || form.quartier.trim().length < 2) {
    errors.quartier = 'Indiquez votre quartier';
  }
  if (!form.details.trim() || form.details.trim().length < 4) {
    errors.details = 'Précisez votre adresse détaillée';
  }
  return errors;
}

export function isDeliveryAddressValid(form: DeliveryAddressForm): boolean {
  return Object.keys(getAddressValidationErrors(form)).length === 0;
}

export function getRealPromoPercentage(product: Product): number {
  if (product.discountPercentage && product.discountPercentage > 0) {
    return Math.round(product.discountPercentage);
  }
  if (product.originalPrice && product.originalPrice > product.price) {
    return Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
  }
  return 0;
}

export function resolveSellerDisplay(seller?: Seller, fallbackName?: string): {
  name: string;
  location: string;
  phone?: string;
  verified: boolean;
  rating: number;
  salesCount: number;
  avatar?: string;
} {
  return {
    name: seller?.storeName || seller?.name || fallbackName || 'Boutique Partenaire',
    location: seller?.location || 'Abidjan, Côte d’Ivoire',
    phone: seller?.phone,
    verified: Boolean(seller?.verified),
    rating: typeof seller?.rating === 'number' ? seller.rating : 0,
    salesCount: seller?.salesCount || 0,
    avatar: seller?.avatar
  };
}
