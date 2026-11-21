export const VISIBLE_ORDER_STATUS = 'Commande confirmée' as const;
export const CLIENT_ONLINE_FEE_RATE = 0.065;
export const DJASSA_FIXED_COMMISSION_FCFA = 150;

export type OrderPaymentMode = 'online' | 'cod';
export type OnlineOrderPaymentMethod = 'wave' | 'orange_money';
export type OrderPaymentMethod = OnlineOrderPaymentMethod | 'cash_on_delivery';
export type CommissionStatus = 'pending' | 'collected' | 'paid' | 'cancelled';
export type SellerPayoutStatus =
  | 'not_applicable'
  | 'pending_payment'
  | 'pending_config'
  | 'pending_seller_account'
  | 'initiated'
  | 'completed'
  | 'failed';

export function resolveOrderPaymentMode(order: {
  paymentMode?: string | null;
  paymentMethod?: string | null;
}): OrderPaymentMode {
  if (order.paymentMode === 'cod' || order.paymentMethod === 'cash_on_delivery') {
    return 'cod';
  }
  return 'online';
}

export function calcClientOnlineFee(subtotalAfterDiscount: number): number {
  const base = Math.max(0, Math.round(Number(subtotalAfterDiscount || 0)));
  return Math.round(base * CLIENT_ONLINE_FEE_RATE);
}

export function calcOrderFinancials(params: {
  subtotal: number;
  discount?: number;
  paymentMode: OrderPaymentMode;
}) {
  const subtotal = Math.max(0, Math.round(Number(params.subtotal || 0)));
  const discount = Math.max(0, Math.min(subtotal, Math.round(Number(params.discount || 0))));
  const merchandiseNet = Math.max(0, subtotal - discount);
  const clientFeeFcfa = params.paymentMode === 'online' ? calcClientOnlineFee(merchandiseNet) : 0;
  const total = merchandiseNet + clientFeeFcfa;
  const commissionFcfa = DJASSA_FIXED_COMMISSION_FCFA;
  const sellerNetFcfa = Math.max(0, merchandiseNet - commissionFcfa);
  return {
    subtotal,
    discount,
    merchandiseNet,
    deliveryFee: 0,
    clientFeeFcfa,
    serviceFee: clientFeeFcfa,
    total,
    commissionFcfa,
    sellerNetFcfa
  };
}

export function getPaymentModeLabel(mode?: string | null, paymentMethod?: string | null): string {
  const resolved = resolveOrderPaymentMode({ paymentMode: mode, paymentMethod });
  return resolved === 'cod' ? 'Paiement à la livraison' : 'Paiement en ligne';
}

export function getPaymentMethodLabel(paymentMethod?: string | null, paymentMode?: string | null): string {
  const resolved = resolveOrderPaymentMode({ paymentMode, paymentMethod });
  if (resolved === 'cod') return 'Paiement à la livraison (espèces ou transfert direct au vendeur)';
  if (paymentMethod === 'wave') return 'Wave';
  if (paymentMethod === 'orange_money') return 'Orange Money';
  return 'Paiement en ligne';
}

export function getPaymentStatusLabel(paymentStatus?: string | null, paymentMode?: string | null): {
  label: string;
  tone: 'emerald' | 'amber' | 'rose' | 'slate';
} {
  if (paymentStatus === 'paid') {
    return { label: 'Payé en ligne', tone: 'emerald' };
  }
  if (paymentStatus === 'refunded') {
    return { label: 'Remboursé', tone: 'slate' };
  }
  if (paymentStatus === 'failed') {
    return { label: 'Paiement échoué', tone: 'rose' };
  }
  if (paymentStatus === 'cod_pending' || paymentMode === 'cod') {
    return { label: 'À régler à la livraison', tone: 'amber' };
  }
  return { label: 'En attente de paiement', tone: 'amber' };
}

export function getCommissionStatusLabel(status?: string | null): {
  label: string;
  tone: 'emerald' | 'amber' | 'rose' | 'blue';
} {
  switch (status) {
    case 'collected':
      return { label: 'Encaissée', tone: 'emerald' };
    case 'paid':
      return { label: 'Payée', tone: 'blue' };
    case 'cancelled':
      return { label: 'Annulée', tone: 'rose' };
    default:
      return { label: 'En attente', tone: 'amber' };
  }
}

export function getSellerPayoutStatusLabel(status?: string | null): {
  label: string;
  tone: 'emerald' | 'amber' | 'rose' | 'slate';
} {
  switch (status) {
    case 'completed':
      return { label: 'Reversé au vendeur', tone: 'emerald' };
    case 'initiated':
      return { label: 'Reversement initié', tone: 'amber' };
    case 'pending_seller_account':
      return { label: 'Compte Wave/OM vendeur requis', tone: 'amber' };
    case 'pending_config':
      return { label: 'Reversement en attente config GeniusPay', tone: 'amber' };
    case 'failed':
      return { label: 'Échec reversement', tone: 'rose' };
    case 'not_applicable':
      return { label: 'Encaissement direct vendeur (COD)', tone: 'slate' };
    default:
      return { label: 'En attente de paiement client', tone: 'slate' };
  }
}
