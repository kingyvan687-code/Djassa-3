import { getSecurityToken, securityService, type SecurityApiError } from './securityService';
import type {
  CompensationBeneficiaryRole,
  CompensationFundingSource,
  CompensationReasonKey,
  CompensationRecord,
  PaymentProviderChannelId,
  RefundEvidenceItem,
  RefundModuleSettings,
  RefundOriginType,
  RefundOverviewResponse,
  RefundPermissionKey,
  RefundRecord,
  RefundType
} from '../types/refunds';

export type RefundApiError = SecurityApiError & {
  requiresMfa?: boolean;
  requiresReauth?: boolean;
};

async function refundFetch<T>(
  url: string,
  options: RequestInit = {},
  stepUpCode?: string,
  idempotencyKey?: string
): Promise<T> {
  await securityService.ensureAdminSessionIfMissing();
  const token = getSecurityToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined)
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (stepUpCode) headers['X-Security-Stepup-Code'] = stepUpCode;
  if (idempotencyKey) headers['X-Idempotency-Key'] = idempotencyKey;

  const res = await fetch(url, { ...options, headers });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const err = new Error(body?.message || body?.error || `Erreur serveur (${res.status})`) as RefundApiError;
    err.status = res.status;
    err.code = body?.error;
    err.requiresMfa = res.status === 428 || body?.error === 'MFA_STEPUP_REQUIRED';
    err.requiresReauth = res.status === 401;
    throw err;
  }
  return body as T;
}

export const refundsService = {
  getOverview: () => refundFetch<RefundOverviewResponse>('/api/refunds/overview'),

  syncFromOrdersAndDisputes: (payload: { orders: any[]; sellers: any[]; drivers?: any[] }) =>
    refundFetch<{ success: boolean; importedRefunds: number; importedIds: string[] }>('/api/refunds/sync', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  createRefund: (
    payload: {
      refundType: RefundType;
      origin?: RefundOriginType;
      orderNumber: string;
      orderId?: string;
      order?: any;
      initialTransactionRef?: string;
      initialPaymentMethod?: string;
      reasonCategory: string;
      reasonDetail: string;
      targetChannel?: PaymentProviderChannelId | string;
      beneficiaryPayoutAccount?: string;
      beneficiaryTitularityChecked?: boolean;
      clientId?: string;
      clientName?: string;
      clientPhone?: string;
      clientCommune?: string;
      clientAvatar?: string;
      seller?: any;
      driver?: any;
      company?: any;
      deliveryFeeFcfa?: number;
      discountFcfa?: number;
      initialPaidFcfa?: number;
      disputedAmountFcfa?: number;
      requestedAmountFcfa?: number;
      customAdjustedAmountFcfa?: number;
      items?: Array<{
        productId: string;
        productTitle: string;
        productImage?: string;
        orderedQuantity: number;
        refundQuantity: number;
        unitPriceFcfa: number;
        selectedForRefund: boolean;
        sellerId?: string;
        sellerName?: string;
      }>;
      linkedDisputeId?: string;
      linkedDisputeCode?: string;
      evidence?: Array<{
        title: string;
        kind: RefundEvidenceItem['kind'];
        urlOrData?: string;
      }>;
    },
    idempotencyKey?: string
  ) =>
    refundFetch<{ success: boolean; refund: RefundRecord; idempotentDuplicate?: boolean }>(
      '/api/refunds',
      { method: 'POST', body: JSON.stringify(payload) },
      undefined,
      idempotencyKey
    ),

  verifyRefund: (
    id: string,
    payload: {
      verifyTransaction?: boolean;
      verifyTitularity?: boolean;
      evidenceTitle?: string;
      evidenceUrl?: string;
      note?: string;
    }
  ) =>
    refundFetch<{ success: boolean; refund: RefundRecord }>(`/api/refunds/${encodeURIComponent(id)}/verify`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  requestEvidence: (
    id: string,
    payload: { message: string; targetRole: 'client' | 'seller' | 'driver' | 'company' }
  ) =>
    refundFetch<{ success: boolean; refund: RefundRecord }>(
      `/api/refunds/${encodeURIComponent(id)}/request-evidence`,
      { method: 'POST', body: JSON.stringify(payload) }
    ),

  holdRefund: (id: string, note: string) =>
    refundFetch<{ success: boolean; refund: RefundRecord }>(`/api/refunds/${encodeURIComponent(id)}/hold`, {
      method: 'POST',
      body: JSON.stringify({ note })
    }),

  approveRefund: (id: string, note: string, stepUpCode?: string) =>
    refundFetch<{ success: boolean; refund: RefundRecord }>(
      `/api/refunds/${encodeURIComponent(id)}/approve`,
      { method: 'POST', body: JSON.stringify({ note }) },
      stepUpCode
    ),

  superValidateRefund: (id: string, note: string, stepUpCode?: string) =>
    refundFetch<{ success: boolean; refund: RefundRecord }>(
      `/api/refunds/${encodeURIComponent(id)}/super-validate`,
      { method: 'POST', body: JSON.stringify({ note }) },
      stepUpCode
    ),

  rejectRefund: (id: string, reason: string, stepUpCode?: string) =>
    refundFetch<{ success: boolean; refund: RefundRecord }>(
      `/api/refunds/${encodeURIComponent(id)}/reject`,
      { method: 'POST', body: JSON.stringify({ reason }) },
      stepUpCode
    ),

  cancelRefund: (id: string, reason: string) =>
    refundFetch<{ success: boolean; refund: RefundRecord }>(`/api/refunds/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    }),

  executeRefund: (
    id: string,
    payload: {
      channel?: PaymentProviderChannelId;
      amountFcfa?: number;
      simulateFailure?: boolean;
    },
    stepUpCode?: string,
    idempotencyKey?: string
  ) =>
    refundFetch<{
      success: boolean;
      refund: RefundRecord;
      awaitingProviderConfirmation?: boolean;
      message?: string;
    }>(
      `/api/refunds/${encodeURIComponent(id)}/execute`,
      { method: 'POST', body: JSON.stringify(payload) },
      stepUpCode,
      idempotencyKey
    ),

  confirmProviderRefund: (
    id: string,
    payload: { providerReference: string; proofNote?: string },
    stepUpCode?: string
  ) =>
    refundFetch<{ success: boolean; refund: RefundRecord }>(
      `/api/refunds/${encodeURIComponent(id)}/confirm-provider`,
      { method: 'POST', body: JSON.stringify(payload) },
      stepUpCode
    ),

  markRefundFailed: (id: string, errorMessage: string) =>
    refundFetch<{ success: boolean; refund: RefundRecord }>(
      `/api/refunds/${encodeURIComponent(id)}/mark-failed`,
      { method: 'POST', body: JSON.stringify({ errorMessage }) }
    ),

  retryRefund: (id: string, channel?: PaymentProviderChannelId, stepUpCode?: string) =>
    refundFetch<{ success: boolean; refund: RefundRecord }>(
      `/api/refunds/${encodeURIComponent(id)}/retry`,
      { method: 'POST', body: JSON.stringify({ channel }) },
      stepUpCode
    ),

  archiveRefund: (id: string) =>
    refundFetch<{ success: boolean; refund: RefundRecord }>(`/api/refunds/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: JSON.stringify({})
    }),

  createCompensation: (payload: {
    beneficiaryRole: CompensationBeneficiaryRole;
    beneficiaryId?: string;
    beneficiaryName: string;
    beneficiaryPhone?: string;
    beneficiaryPayoutAccount?: string;
    commune?: string;
    reason: CompensationReasonKey;
    incidentDescription: string;
    orderId?: string;
    orderNumber?: string;
    linkedDisputeId?: string;
    linkedDisputeCode?: string;
    fundingSource: CompensationFundingSource;
    requestedAmountFcfa: number;
    targetChannel?: PaymentProviderChannelId;
  }) =>
    refundFetch<{ success: boolean; compensation: CompensationRecord }>('/api/refunds/compensations', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  runCompensationAction: (
    compId: string,
    payload: {
      action:
        | 'verify'
        | 'hold'
        | 'approve'
        | 'super_validate'
        | 'reject'
        | 'cancel'
        | 'retry'
        | 'execute'
        | 'confirm_provider';
      approvedAmountFcfa?: number;
      reason?: string;
      providerReference?: string;
      channel?: PaymentProviderChannelId;
      simulateFailure?: boolean;
    },
    stepUpCode?: string
  ) =>
    refundFetch<{
      success: boolean;
      compensation: CompensationRecord;
      awaitingProviderConfirmation?: boolean;
    }>(
      `/api/refunds/compensations/${encodeURIComponent(compId)}/action`,
      { method: 'POST', body: JSON.stringify(payload) },
      stepUpCode
    ),

  markNotificationRead: (notifId: string) =>
    refundFetch<{ success: boolean }>(`/api/refunds/notifications/${encodeURIComponent(notifId)}/read`, {
      method: 'POST',
      body: JSON.stringify({})
    }),

  updateSettings: (patch: Partial<RefundModuleSettings>, stepUpCode?: string) =>
    refundFetch<{ success: boolean; settings: RefundModuleSettings }>(
      '/api/refunds/settings',
      { method: 'PATCH', body: JSON.stringify(patch) },
      stepUpCode
    ),

  updatePermissions: (
    staffId: string,
    permissions: Partial<Record<RefundPermissionKey, boolean>>,
    stepUpCode?: string
  ) =>
    refundFetch<{ success: boolean; staffId: string; permissions: Record<RefundPermissionKey, boolean> }>(
      `/api/refunds/permissions/${encodeURIComponent(staffId)}`,
      { method: 'PATCH', body: JSON.stringify({ permissions }) },
      stepUpCode
    )
};
