import type {
  CommissionEntryDto,
  CommissionSettlementDto,
  CommissionSummaryStats,
  OrderPaymentMethod,
  OrderPaymentMode,
  OrderReceiptDto,
  SellerPayoutSettings
} from '../types';
import { apiJsonFetch, fetchWithTimeout, invalidatePublicHttpCache } from './httpClient';
import { getSecurityToken, resetSecuritySessionId, setActiveSecurityActorId, setSecuritySessionId, setSecurityToken } from './securityService';
export {
  VISIBLE_ORDER_STATUS,
  CLIENT_ONLINE_FEE_RATE,
  DJASSA_FIXED_COMMISSION_FCFA,
  calcClientOnlineFee,
  calcOrderFinancials,
  resolveOrderPaymentMode
} from '../utils/commerceCalculations';

export interface AuthUserDTO {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: 'client' | 'seller' | 'admin';
  tenantId: string;
  sellerId?: string;
  kycVerified: boolean;
  status: string;
}

function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  return apiJsonFetch<T>(url, options);
}

export const authService = {
  async login(email: string, password: string): Promise<{
    success: boolean;
    token?: string;
    user?: AuthUserDTO;
    unusualDevice?: boolean;
    message?: string;
  }> {
    const res = await fetchWithTimeout('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.token && data?.user) {
      setSecurityToken(data.token);
      if (data.session?.sessionId) {
        setSecuritySessionId(data.session.sessionId);
      }
      if (data.staff?.id) {
        setActiveSecurityActorId(data.staff.id);
      } else {
        setActiveSecurityActorId(data.user.id);
      }
      return data;
    }
    return {
      success: false,
      message: data?.message || data?.error || 'Adresse e-mail ou mot de passe incorrect.'
    };
  },

  async register(payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role?: 'client' | 'seller';
  }): Promise<{
    success: boolean;
    token?: string;
    user?: AuthUserDTO;
    message?: string;
  }> {
    const res = await fetchWithTimeout('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.token && data?.user) {
      setSecurityToken(data.token);
      if (data.session?.sessionId) {
        setSecuritySessionId(data.session.sessionId);
      }
      setActiveSecurityActorId(data.user.id);
      return data;
    }
    return {
      success: false,
      message: data?.message || data?.error || 'Impossible de créer le compte.'
    };
  },

  async me(): Promise<{ success: boolean; user?: AuthUserDTO; unauthorized?: boolean; transientError?: boolean } | null> {
    const token = getSecurityToken();
    if (!token) return { success: false, unauthorized: true };
    try {
      const data = await apiFetch<{ success: boolean; user: AuthUserDTO }>('/api/auth/me');
      return data;
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403) {
        return { success: false, unauthorized: true };
      }
      return { success: false, transientError: true };
    }
  },

  async logout(): Promise<void> {
    try {
      const token = getSecurityToken();
      if (token) {
        await fetchWithTimeout(
          '/api/auth/logout',
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          },
          5_000
        );
      }
    } catch {
      // ignore network error on logout
    } finally {
      setSecurityToken(null);
      resetSecuritySessionId();
    }
  }
};

export interface CreateOrderDeliveryAddressPayload {
  commune: string;
  quartier: string;
  details: string;
  landmark?: string;
  deliveryInstructions?: string;
  gpsCoords?: { lat: number; lng: number };
  recipientName: string;
  phone: string;
  absencePolicy?: 'return_to_seller_next_day' | 'leave_with_authorized_person';
  absenceRecipientName?: string;
  absenceRecipientPhone?: string;
}

export const commerceService = {
  bootstrap() {
    return apiFetch<{
      success: boolean;
      platformConfig: any;
      products: any[];
      orders: any[];
      wallet: { accountId: string; balanceFcfa: number };
      withdrawals: any[];
      notifications: any[];
      conversations: any[];
    }>('/api/commerce/bootstrap');
  },

  validatePromoCode(code: string, subtotal: number) {
    return apiFetch<{
      success: boolean;
      valid: boolean;
      code: string;
      discountFcfa: number;
      label?: string;
      description?: string;
    }>('/api/commerce/promo/validate', {
      method: 'POST',
      body: JSON.stringify({ code, subtotal })
    });
  },

  createOrder(payload: {
    items: Array<{ productId: string; quantity: number; variant?: Record<string, string> }>;
    paymentMode: OrderPaymentMode;
    paymentMethod: OrderPaymentMethod;
    deliveryAddress: CreateOrderDeliveryAddressPayload;
    payerPhone?: string;
    promoCode?: string;
    idempotencyKey?: string;
  }) {
    return apiFetch<{
      success: boolean;
      isDuplicate?: boolean;
      order: any;
      payment: any;
      providerConfigured: boolean;
      paymentUrl?: string;
      checkoutUrl?: string;
      geniusPay?: Record<string, unknown>;
    }>('/api/commerce/orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  createMultiSellerOrders(payload: {
    items: Array<{ productId: string; quantity: number; variant?: Record<string, string> }>;
    paymentMode: OrderPaymentMode;
    paymentMethod: OrderPaymentMethod;
    deliveryAddress: CreateOrderDeliveryAddressPayload;
    payerPhone?: string;
    promoCode?: string;
    idempotencyKey?: string;
  }) {
    return apiFetch<{
      success: boolean;
      isDuplicate?: boolean;
      checkoutGroupId: string;
      orders: any[];
      payments: any[];
      totalAmountFcfa: number;
      providerConfigured?: boolean;
      paymentUrl?: string;
      checkoutUrl?: string;
    }>('/api/commerce/orders/multi-seller', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  getOrderStatus(orderId: string) {
    return apiFetch<{ success: boolean; order: any; payment: any }>(
      `/api/commerce/orders/${encodeURIComponent(orderId)}`
    );
  },

  retryOrderPayment(orderId: string, paymentMethod?: 'wave' | 'orange_money') {
    return apiFetch<{
      success: boolean;
      alreadyPaid?: boolean;
      order: any;
      payment: any;
      providerConfigured?: boolean;
      paymentUrl?: string;
      checkoutUrl?: string;
    }>(`/api/commerce/orders/${encodeURIComponent(orderId)}/retry-payment`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod })
    });
  },

  updateOrderStatus(orderId: string, status: string) {
    return apiFetch<{ success: boolean; order: any }>(`/api/commerce/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  updatePlatformConfig(patch: Record<string, unknown>) {
    return apiFetch<{ success: boolean; platformConfig: any }>('/api/commerce/config', {
      method: 'PATCH',
      body: JSON.stringify(patch)
    });
  },

  async createProduct(payload: Record<string, unknown>) {
    const res = await apiFetch<{ success: boolean; product: any }>('/api/commerce/products', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    invalidatePublicHttpCache('/api/commerce/products');
    return res;
  },

  async updateProduct(productId: string, patch: Record<string, unknown>) {
    const res = await apiFetch<{ success: boolean; product: any }>(`/api/commerce/products/${encodeURIComponent(productId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch)
    });
    invalidatePublicHttpCache('/api/commerce/products');
    return res;
  },

  async deleteProduct(productId: string) {
    const res = await apiFetch<{ success: boolean; deletedId: string }>(`/api/commerce/products/${encodeURIComponent(productId)}`, {
      method: 'DELETE'
    });
    invalidatePublicHttpCache('/api/commerce/products');
    return res;
  },

  getSellerPayoutSettings(sellerId?: string) {
    const qs = sellerId ? `?sellerId=${encodeURIComponent(sellerId)}` : '';
    return apiFetch<{ success: boolean; settings: SellerPayoutSettings | null }>(
      `/api/commerce/seller/payout-settings${qs}`
    );
  },

  updateSellerPayoutSettings(payload: {
    sellerId?: string;
    preferredChannel: 'wave' | 'orange_money';
    wavePhone?: string;
    orangeMoneyPhone?: string;
    accountHolderName?: string;
  }) {
    return apiFetch<{ success: boolean; settings: SellerPayoutSettings }>('/api/commerce/seller/payout-settings', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  getCommissionsDashboard() {
    return apiFetch<{
      success: boolean;
      summary: CommissionSummaryStats;
      entries: CommissionEntryDto[];
      settlements: CommissionSettlementDto[];
    }>('/api/commerce/commissions');
  },

  settleCodCommission(
    orderId: string,
    payload: {
      channel?: 'wave' | 'orange_money' | 'manual_verified';
      payerPhone?: string;
      verifiedManual?: boolean;
      providerReference?: string;
      notes?: string;
    }
  ) {
    return apiFetch<{
      success: boolean;
      idempotent?: boolean;
      pendingConfirmation?: boolean;
      paymentUrl?: string;
      checkoutUrl?: string;
      order: any;
      settlement?: CommissionSettlementDto;
    }>(`/api/commerce/commissions/${encodeURIComponent(orderId)}/settle`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  getOrderReceipt(orderId: string) {
    return apiFetch<{
      success: boolean;
      perspective: 'client' | 'seller' | 'admin';
      receipt: OrderReceiptDto;
    }>(`/api/commerce/orders/${encodeURIComponent(orderId)}/receipt`);
  },

  getMyWallet() {
    return apiFetch<{
      success: boolean;
      accountId: string;
      balanceFcfa: number;
      withdrawalFeeRate: number;
      ledger: any[];
      withdrawals: any[];
    }>('/api/commerce/wallets/me');
  },

  requestWithdrawal(payload: { amountFcfa: number; channel: string; payoutTarget: string; idempotencyKey?: string }) {
    return apiFetch<{ success: boolean; withdrawal: any; newBalanceFcfa: number; idempotent?: boolean }>('/api/commerce/withdrawals', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  sendMessage(
    conversationId: string,
    body: string,
    recipientId?: string,
    title?: string,
    extra?: { type?: string; mediaUrl?: string; meta?: Record<string, unknown> }
  ) {
    return apiFetch<{ success: boolean; message: any; conversation: any }>(
      `/api/commerce/chat/${encodeURIComponent(conversationId)}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ body, recipientId, title, ...(extra || {}) })
      }
    );
  },

  markAllNotificationsRead() {
    return apiFetch<{ success: boolean }>('/api/commerce/notifications/read-all', { method: 'POST' });
  },

  getSellerStorage(sellerId?: string) {
    const qs = sellerId ? `?sellerId=${encodeURIComponent(sellerId)}` : '';
    return apiFetch<{
      success: boolean;
      storage: {
        sellerId: string;
        usedBytes: number;
        quotaBytes: number;
        remainingBytes: number;
        usagePercent: number;
        productCount: number;
        maxProducts: number;
      };
    }>(`/api/commerce/seller/storage${qs}`);
  },

  getPublicCatalog() {
    return apiFetch<{
      success: boolean;
      platformConfig: any;
      products: any[];
    }>('/api/commerce/public-catalog', {
      cacheTtlMs: 8_000,
      timeoutMs: 8_000
    } as RequestInit & { cacheTtlMs?: number; timeoutMs?: number });
  }
};
