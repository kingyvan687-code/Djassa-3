import crypto from 'node:crypto';

export type DjassaPaymentProvider = 'wave' | 'orange_money' | 'mtn_momo' | 'card';

export interface GeniusPayInitResult {
  configured: boolean;
  ok: boolean;
  depositId?: string;
  payoutId?: string;
  refundId?: string;
  status: string;
  channel?: string;
  checkoutUrl?: string;
  error?: string;
  message?: string;
  providerPayload?: Record<string, unknown>;
}

const DEFAULT_GENIUSPAY_BASE_URL = 'https://api.geniuspay.ci/v1';

export function getGeniusPayConfig() {
  const apiKey = (process.env.GENIUSPAY_API_KEY || '').trim();
  const webhookSecret = (process.env.GENIUSPAY_WEBHOOK_SECRET || process.env.DJASSA_PAYMENT_WEBHOOK_SECRET || '').trim();
  const baseUrl = (process.env.GENIUSPAY_BASE_URL || DEFAULT_GENIUSPAY_BASE_URL).trim().replace(/\/+$/, '');
  return {
    configured: apiKey.length >= 8,
    apiKey,
    webhookSecret,
    baseUrl
  };
}

export function mapProviderToGeniusPayChannel(provider: DjassaPaymentProvider): string {
  switch (provider) {
    case 'wave':
      return 'WAVE_CI';
    case 'orange_money':
      return 'ORANGE_MONEY_CI';
    case 'mtn_momo':
      return 'MTN_MOMO_CI';
    case 'card':
      return 'CARD';
    default:
      return 'WAVE_CI';
  }
}

export function normalizeCiMsisdn(rawPhone: string): string | null {
  const digits = String(rawPhone || '').replace(/[^\d]/g, '');
  if (!digits) return null;
  if (digits.startsWith('225') && digits.length >= 11 && digits.length <= 13) {
    return digits;
  }
  if (digits.length === 10 && digits.startsWith('0')) {
    return `225${digits}`;
  }
  if (digits.length >= 8 && digits.length <= 15) {
    return digits;
  }
  return null;
}

export function maskPhoneNumber(rawPhone: string): string {
  const clean = String(rawPhone || '').trim();
  if (!clean) return 'N/A';
  if (clean.length <= 4) return '****';
  return `***${clean.slice(-4)}`;
}

export function verifyWebhookHmacSignature(params: {
  rawBody: Buffer | string;
  providedSignature: string;
  secret: string;
}): boolean {
  const secret = (params.secret || '').trim();
  const providedRaw = (params.providedSignature || '').trim();
  if (!secret || !providedRaw) return false;

  const cleanProvided = providedRaw.replace(/^sha256=/i, '').trim();
  const rawBuffer = Buffer.isBuffer(params.rawBody) ? params.rawBody : Buffer.from(params.rawBody || '', 'utf8');

  const expectedHex = crypto.createHmac('sha256', secret).update(rawBuffer).digest('hex');
  const expectedBase64 = crypto.createHmac('sha256', secret).update(rawBuffer).digest('base64');

  const tryEqual = (expected: string) => {
    const a = Buffer.from(cleanProvided, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  };

  return tryEqual(expectedHex) || tryEqual(expectedBase64);
}

export function redactWebhookPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }
  const copy: Record<string, unknown> = {};
  const blockedKeys = new Set([
    'secret',
    'apiKey',
    'api_key',
    'token',
    'password',
    'pin',
    'authorization',
    'signature'
  ]);
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if (blockedKeys.has(k)) {
      copy[k] = '[REDACTED]';
    } else if (/phone|msisdn|destination|target/i.test(k) && typeof v === 'string') {
      copy[k] = maskPhoneNumber(v);
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      copy[k] = redactWebhookPayload(v);
    } else {
      copy[k] = v;
    }
  }
  return copy;
}

export function mapGeniusPayStatusToDjassa(
  providerStatus: string
): 'pending' | 'processing' | 'confirmed' | 'failed' | 'cancelled' {
  const s = String(providerStatus || '').toUpperCase();
  if (s === 'COMPLETED' || s === 'CONFIRMED' || s === 'PAID' || s === 'SUCCEEDED' || s === 'SUCCESS') {
    return 'confirmed';
  }
  if (s === 'FAILED' || s === 'REJECTED' || s === 'DECLINED' || s === 'ERROR') {
    return 'failed';
  }
  if (s === 'CANCELLED' || s === 'EXPIRED') {
    return 'cancelled';
  }
  if (s === 'ACCEPTED' || s === 'SUBMITTED' || s === 'PROCESSING' || s === 'IN_RECONCILIATION') {
    return 'processing';
  }
  return 'pending';
}

export async function initiateGeniusPayDeposit(input: {
  depositId: string;
  amountFcfa: number;
  provider: DjassaPaymentProvider;
  payerPhone?: string;
  statementDescription: string;
  metadata?: Record<string, string>;
}): Promise<GeniusPayInitResult> {
  const cfg = getGeniusPayConfig();
  const channel = mapProviderToGeniusPayChannel(input.provider);

  if (!cfg.configured) {
    return {
      configured: false,
      ok: false,
      status: 'pending',
      channel,
      error: 'GENIUSPAY_NOT_CONFIGURED',
      message: 'GENIUSPAY_API_KEY non configuré sur le serveur : paiement en attente de validation réelle.'
    };
  }

  let msisdn: string | null = null;
  if (input.provider !== 'card') {
    msisdn = normalizeCiMsisdn(input.payerPhone || '');
    if (!msisdn) {
      return {
        configured: true,
        ok: false,
        status: 'failed',
        channel,
        error: 'INVALID_PAYER_PHONE',
        message: 'Numéro Mobile Money invalide pour GeniusPay.'
      };
    }
  }

  try {
    const response = await fetch(`${cfg.baseUrl}/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reference: input.depositId,
        amount: Math.round(input.amountFcfa),
        currency: 'XOF',
        channel,
        payment_method: input.provider,
        ...(msisdn ? { customerPhone: msisdn } : {}),
        description: input.statementDescription.slice(0, 60),
        metadata: input.metadata || {}
      }),
      signal: AbortSignal.timeout(12_000)
    });

    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return {
        configured: true,
        ok: false,
        depositId: input.depositId,
        channel,
        status: 'failed',
        error: String(data.errorCode || data.code || `HTTP_${response.status}`),
        message: String(data.errorMessage || data.message || `Erreur GeniusPay HTTP ${response.status}`),
        providerPayload: redactWebhookPayload(data)
      };
    }

    const nestedData =
      data.data && typeof data.data === 'object' && !Array.isArray(data.data)
        ? (data.data as Record<string, unknown>)
        : data;
    const rawStatus = String(nestedData.status || data.status || 'ACCEPTED');
    const candidateCheckoutUrls = [
      nestedData.checkoutUrl,
      nestedData.checkout_url,
      nestedData.paymentUrl,
      nestedData.payment_url,
      nestedData.redirectUrl,
      nestedData.redirect_url,
      nestedData.url,
      data.checkoutUrl,
      data.checkout_url,
      data.paymentUrl,
      data.payment_url
    ];
    const checkoutUrl = candidateCheckoutUrls.find(
      (candidate): candidate is string =>
        typeof candidate === 'string' && /^https?:\/\//i.test(candidate.trim())
    )?.trim();

    return {
      configured: true,
      ok: true,
      depositId: String(nestedData.id || nestedData.reference || data.id || data.reference || input.depositId),
      channel,
      ...(checkoutUrl ? { checkoutUrl } : {}),
      status: mapGeniusPayStatusToDjassa(rawStatus),
      providerPayload: redactWebhookPayload(data)
    };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      depositId: input.depositId,
      channel,
      status: 'pending',
      error: 'GENIUSPAY_NETWORK_ERROR',
      message: (err as Error).message || 'Erreur réseau lors de l’appel GeniusPay.'
    };
  }
}

export async function fetchGeniusPayDepositStatus(depositId: string): Promise<{
  configured: boolean;
  found: boolean;
  providerStatus?: string;
  djassaStatus?: 'pending' | 'processing' | 'confirmed' | 'failed' | 'cancelled';
  amountFcfa?: number;
  reference?: string;
  metadata?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  error?: string;
}> {
  const cfg = getGeniusPayConfig();
  if (!cfg.configured) {
    return { configured: false, found: false, error: 'GENIUSPAY_NOT_CONFIGURED' };
  }
  try {
    const response = await fetch(`${cfg.baseUrl}/payments/${encodeURIComponent(depositId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      signal: AbortSignal.timeout(10_000)
    });
    const raw = await response.json().catch(() => ({}));
    const rawObj = Array.isArray(raw) ? raw[0] : raw;
    const record =
      rawObj && typeof rawObj === 'object' && 'data' in rawObj && rawObj.data && typeof rawObj.data === 'object'
        ? (rawObj.data as Record<string, unknown>)
        : (rawObj as Record<string, unknown>);
    if (!response.ok || !record || typeof record !== 'object') {
      return { configured: true, found: false, error: `HTTP_${response.status}` };
    }
    const providerStatus = String(record.status || 'UNKNOWN');
    const rawAmount = record.amount ?? record.amountFcfa ?? record.amount_fcfa;
    const parsedAmount = typeof rawAmount === 'number' ? rawAmount : Number(rawAmount);
    const amountFcfa = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : undefined;
    const reference = typeof record.reference === 'string' ? record.reference : undefined;
    const metadata =
      record.metadata && typeof record.metadata === 'object' && !Array.isArray(record.metadata)
        ? (record.metadata as Record<string, unknown>)
        : undefined;
    return {
      configured: true,
      found: true,
      providerStatus,
      djassaStatus: mapGeniusPayStatusToDjassa(providerStatus),
      ...(amountFcfa !== undefined ? { amountFcfa } : {}),
      ...(reference ? { reference } : {}),
      ...(metadata ? { metadata } : {}),
      payload: redactWebhookPayload(record)
    };
  } catch (err) {
    return { configured: true, found: false, error: (err as Error).message };
  }
}

export async function initiateGeniusPayPayout(input: {
  payoutId: string;
  amountFcfa: number;
  provider: DjassaPaymentProvider;
  recipientPhone: string;
  statementDescription: string;
}): Promise<GeniusPayInitResult> {
  const cfg = getGeniusPayConfig();
  const channel = mapProviderToGeniusPayChannel(input.provider);
  if (!cfg.configured) {
    return {
      configured: false,
      ok: false,
      status: 'pending',
      channel,
      error: 'GENIUSPAY_NOT_CONFIGURED',
      message: 'GENIUSPAY_API_KEY non configuré : décaissement non transmis au fournisseur.'
    };
  }
  const msisdn = normalizeCiMsisdn(input.recipientPhone);
  if (!msisdn && input.provider !== 'card') {
    return {
      configured: true,
      ok: false,
      status: 'failed',
      channel,
      error: 'INVALID_RECIPIENT_PHONE',
      message: 'Numéro bénéficiaire invalide pour GeniusPay.'
    };
  }
  try {
    const response = await fetch(`${cfg.baseUrl}/payouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reference: input.payoutId,
        amount: Math.round(input.amountFcfa),
        currency: 'XOF',
        channel,
        ...(msisdn ? { recipientPhone: msisdn } : {}),
        description: input.statementDescription.slice(0, 60)
      }),
      signal: AbortSignal.timeout(12_000)
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return {
        configured: true,
        ok: false,
        payoutId: input.payoutId,
        channel,
        status: 'failed',
        error: String(data.errorCode || data.code || `HTTP_${response.status}`),
        message: String(data.errorMessage || data.message || `Erreur payout GeniusPay HTTP ${response.status}`),
        providerPayload: redactWebhookPayload(data)
      };
    }
    const rawStatus = String(data.status || 'ACCEPTED');
    return {
      configured: true,
      ok: true,
      payoutId: String(data.id || data.reference || input.payoutId),
      channel,
      status: mapGeniusPayStatusToDjassa(rawStatus),
      providerPayload: redactWebhookPayload(data)
    };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      payoutId: input.payoutId,
      channel,
      status: 'processing',
      error: 'GENIUSPAY_NETWORK_ERROR',
      message: (err as Error).message || 'Erreur réseau GeniusPay payout.'
    };
  }
}

export async function fetchGeniusPayPayoutStatus(payoutId: string): Promise<{
  configured: boolean;
  found: boolean;
  providerStatus?: string;
  djassaStatus?: 'pending' | 'processing' | 'confirmed' | 'failed' | 'cancelled';
  payload?: Record<string, unknown>;
  error?: string;
}> {
  const cfg = getGeniusPayConfig();
  if (!cfg.configured) return { configured: false, found: false, error: 'GENIUSPAY_NOT_CONFIGURED' };
  try {
    const response = await fetch(`${cfg.baseUrl}/payouts/${encodeURIComponent(payoutId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      signal: AbortSignal.timeout(10_000)
    });
    const raw = await response.json().catch(() => ({}));
    const record = Array.isArray(raw) ? raw[0] : raw;
    if (!response.ok || !record || typeof record !== 'object') {
      return { configured: true, found: false, error: `HTTP_${response.status}` };
    }
    const providerStatus = String((record as Record<string, unknown>).status || 'UNKNOWN');
    return {
      configured: true,
      found: true,
      providerStatus,
      djassaStatus: mapGeniusPayStatusToDjassa(providerStatus),
      payload: redactWebhookPayload(record)
    };
  } catch (err) {
    return { configured: true, found: false, error: (err as Error).message };
  }
}

export async function initiateGeniusPayRefund(input: {
  refundId: string;
  depositId: string;
  amountFcfa?: number;
}): Promise<GeniusPayInitResult> {
  const cfg = getGeniusPayConfig();
  if (!cfg.configured) {
    return {
      configured: false,
      ok: false,
      refundId: input.refundId,
      status: 'pending',
      error: 'GENIUSPAY_NOT_CONFIGURED',
      message: 'GENIUSPAY_API_KEY non configuré sur le serveur.'
    };
  }
  try {
    const response = await fetch(`${cfg.baseUrl}/refunds`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reference: input.refundId,
        paymentReference: input.depositId,
        ...(input.amountFcfa ? { amount: Math.round(input.amountFcfa) } : {})
      }),
      signal: AbortSignal.timeout(12_000)
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return {
        configured: true,
        ok: false,
        refundId: input.refundId,
        status: 'failed',
        error: String(data.errorCode || data.code || `HTTP_${response.status}`),
        message: String(data.errorMessage || data.message || `Erreur remboursement GeniusPay HTTP ${response.status}`),
        providerPayload: redactWebhookPayload(data)
      };
    }
    return {
      configured: true,
      ok: true,
      refundId: String(data.id || data.reference || input.refundId),
      status: mapGeniusPayStatusToDjassa(String(data.status || 'ACCEPTED')),
      providerPayload: redactWebhookPayload(data)
    };
  } catch (err) {
    return {
      configured: true,
      ok: false,
      refundId: input.refundId,
      status: 'pending',
      error: 'GENIUSPAY_NETWORK_ERROR',
      message: (err as Error).message
    };
  }
}
