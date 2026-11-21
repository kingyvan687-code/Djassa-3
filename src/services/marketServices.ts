import { CartItem, Product, Order, OrderStatus } from '../types';

export const formatFCFA = (amount: number = 0): string => {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(amount || 0))} FCFA`;
};

/**
 * Formats social & commerce metric numbers:
 * - 0 to 999: displayed as exact integer ("0", "1", "3", "383", "999")
 * - 1,000 to 9,999: "1k", "1.2k", "2k", etc.
 * - 10,000 to 99,999: "10k", "11k", "15.4k", etc.
 * - 100,000 to 999,999: "100k", "500k", etc.
 * - 1,000,000+: "1M", "1.2M", etc.
 * Applies to comments, likes, saves/bookmarks, views, and shares.
 */
export const formatMetricCount = (count: number | string | undefined | null): string => {
  if (count === undefined || count === null || count === '') return '0';
  
  if (typeof count === 'string') {
    if (/[kKmMbB]/.test(count)) return count;
    const parsed = parseFloat(count.replace(/\s/g, '').replace(',', '.'));
    if (isNaN(parsed)) return count;
    count = parsed;
  }

  if (isNaN(count) || count <= 0) return '0';
  
  // 0 to 999: display exact number
  if (count < 1000) {
    return Math.floor(count).toString();
  }
  
  // 1,000 to 9,999: 1k, 1.2k, 2k, 3k, etc.
  if (count < 10000) {
    const val = count / 1000;
    const formatted = val.toFixed(1).replace(/\.0$/, '');
    return `${formatted}k`;
  }
  
  // 10,000 to 99,999: 10k, 11k, 15.4k, etc.
  if (count < 100000) {
    const val = count / 1000;
    const formatted = val.toFixed(1).replace(/\.0$/, '');
    return `${formatted}k`;
  }
  
  // 100,000 to 999,999: 100k, 250k, 999k
  if (count < 1000000) {
    return `${Math.floor(count / 1000)}k`;
  }
  
  // 1,000,000 to 99,999,999: 1M, 1.2M, etc.
  if (count < 100000000) {
    const val = count / 1000000;
    const formatted = val.toFixed(1).replace(/\.0$/, '');
    return `${formatted}M`;
  }
  
  return `${Math.floor(count / 1000000)}M`;
};


export const formatOrderDate = (dateInput?: string): string => {
  if (!dateInput) return 'Date non renseignée';
  try {
    const d = new Date(dateInput);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).format(d);
    }
  } catch {}
  return dateInput.split('T')[0] || dateInput;
};

export const formatOrderTime = (dateInput?: string): string => {
  if (!dateInput) return '--:--';
  try {
    const d = new Date(dateInput);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      }).format(d);
    }
  } catch {}
  return dateInput.includes(':') ? dateInput : '--:--';
};

export const formatOrderFullDateTime = (dateInput?: string): string => {
  if (!dateInput) return 'Date et heure non renseignées';
  try {
    const d = new Date(dateInput);
    if (!isNaN(d.getTime())) {
      const datePart = new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }).format(d);
      const timePart = new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      }).format(d);
      return `${datePart.charAt(0).toUpperCase() + datePart.slice(1)} à ${timePart}`;
    }
  } catch {}
  return dateInput;
};

export const CartService = {
  calculateTotal(cart: CartItem[], products: Product[]) {
    const selectedItems = cart.filter((item) => item.selected);
    const subtotal = selectedItems.reduce((acc, item) => {
      const prod = products.find((p) => p.id === item.productId);
      const price = prod ? prod.price : 0;
      return acc + price * item.quantity;
    }, 0);

    const deliveryFee = 0;
    const total = subtotal;

    return {
      subtotal,
      deliveryFee,
      total,
      itemCount: selectedItems.reduce((acc, item) => acc + item.quantity, 0)
    };
  }
};

export const OrderService = {
  getStatusBadge(_status?: OrderStatus | string) {
    return {
      label: 'Commande confirmée',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/20'
    };
  },

  getPaymentStatusBadge(paymentStatus?: string, paymentMode?: string) {
    if (paymentStatus === 'paid') {
      return { label: 'Payé', color: 'text-emerald-400', bgColor: 'bg-emerald-500/15 border-emerald-500/35' };
    }
    if (paymentStatus === 'cod_pending' || paymentMode === 'cod') {
      return { label: 'À payer à la livraison', color: 'text-amber-300', bgColor: 'bg-amber-500/15 border-amber-500/35' };
    }
    if (paymentStatus === 'failed') {
      return { label: 'Échoué', color: 'text-rose-400', bgColor: 'bg-rose-500/15 border-rose-500/35' };
    }
    if (paymentStatus === 'refunded') {
      return { label: 'Remboursé', color: 'text-cyan-300', bgColor: 'bg-cyan-500/15 border-cyan-500/35' };
    }
    return { label: 'En attente', color: 'text-amber-300', bgColor: 'bg-amber-500/15 border-amber-500/35' };
  },

  canCancelOrder(order: Order): boolean {
    return order.status === 'passed' && order.paymentStatus !== 'paid';
  },

  getClientAvatar(order: { clientAvatar?: string; deliveryAddress?: { recipientName?: string } }): string {
    if (order.clientAvatar) return order.clientAvatar;
    const sampleAvatars = [
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
      'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200',
      'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=200',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200'
    ];
    const name = order.deliveryAddress?.recipientName || 'Client';
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return sampleAvatars[hash % sampleAvatars.length];
  }
};
