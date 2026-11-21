import { getSecurityToken, securityService, type SecurityApiError } from './securityService';
import type {
  FraudAccountWatchRecord,
  FraudAlertRecord,
  FraudAlertStatus,
  FraudDetectionRule,
  FraudLinkedAccountsCluster,
  FraudOrderAnomalyRecord,
  FraudOverviewResponse,
  FraudPaymentRecord,
  FraudPermissionKey,
  FraudSensitiveActionRequest,
  FraudSettings,
  SensitiveFinanceActionType
} from '../types/fraud';

async function fraudFetch<T>(url: string, options: RequestInit = {}, stepUpCode?: string): Promise<T> {
  await securityService.ensureAdminSessionIfMissing();
  const token = getSecurityToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined)
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (stepUpCode) {
    headers['X-Security-Stepup-Code'] = stepUpCode;
  }

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.message || data?.error || `Erreur anti-fraude (${response.status})`) as SecurityApiError;
    err.status = response.status;
    err.code = data?.error;
    throw err;
  }
  return data as T;
}

export const fraudService = {
  getOverview(): Promise<FraudOverviewResponse> {
    return fraudFetch<FraudOverviewResponse>('/api/fraud/overview');
  },

  verifyPayment(payload: {
    transactionRef: string;
    orderId?: string;
    accountId: string;
    space?: string;
    channel: string;
    expectedAmountFcfa: number;
    paidAmountFcfa: number;
    clientClaimedSuccess?: boolean;
    screenshotOnly?: boolean;
    failedAttemptsRecent?: number;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; payment: FraudPaymentRecord; alert: FraudAlertRecord | null }> {
    return fraudFetch('/api/fraud/payments/verify', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  verifyOrderAnomaly(payload: {
    orderId: string;
    transactionRef?: string;
    buyerId?: string;
    sellerId?: string;
    driverOrCompanyId?: string;
    amountFcfa: number;
    expectedAmountFcfa?: number;
    commissionFcfa?: number;
    paymentStatus?: string;
    deliveryStatus?: string;
    hasDeliveryProof?: boolean;
    deliveryProofHash?: string;
    postPaymentModified?: boolean;
    unjustifiedRefund?: boolean;
    repeatedPostPaymentCancel?: boolean;
  }): Promise<{ success: boolean; orderAnomaly: FraudOrderAnomalyRecord; alert: FraudAlertRecord | null }> {
    return fraudFetch('/api/fraud/orders/verify', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  updateAlert(
    alertId: string,
    payload: {
      status?: FraudAlertStatus;
      note?: string;
      assignedToId?: string | null;
      justificatifRequestNote?: string;
      evidenceSummary?: string;
      confirmedLossFcfa?: number;
      closureReason?: string;
    }
  ): Promise<{ success: boolean; alert: FraudAlertRecord }> {
    return fraudFetch(`/api/fraud/alerts/${encodeURIComponent(alertId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  updateAccountWatch(
    accountId: string,
    payload: { watchStatus: FraudAccountWatchRecord['watchStatus']; watchReason: string }
  ): Promise<{ success: boolean }> {
    return fraudFetch(`/api/fraud/accounts/${encodeURIComponent(accountId)}/watch`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  updateLinkedCluster(
    clusterId: string,
    payload: { verificationStatus: FraudLinkedAccountsCluster['verificationStatus']; note?: string }
  ): Promise<{ success: boolean }> {
    return fraudFetch(`/api/fraud/linked-clusters/${encodeURIComponent(clusterId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  requestSensitiveAction(
    payload: {
      actionType: SensitiveFinanceActionType;
      targetId: string;
      accountId: string;
      amountFcfa?: number;
      reason: string;
      payloadSummary?: string;
      payoutTarget?: string;
      idempotencyKey?: string;
    },
    stepUpCode: string
  ): Promise<{ success: boolean; request: FraudSensitiveActionRequest }> {
    return fraudFetch(
      '/api/fraud/sensitive-actions',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      },
      stepUpCode
    );
  },

  decideSensitiveAction(
    requestId: string,
    payload: { decision: 'approve' | 'reject' | 'cancel'; note?: string },
    stepUpCode: string
  ): Promise<{ success: boolean; request: FraudSensitiveActionRequest }> {
    return fraudFetch(
      `/api/fraud/sensitive-actions/${encodeURIComponent(requestId)}/decide`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      },
      stepUpCode
    );
  },

  updateRule(
    ruleId: string,
    patch: Partial<Pick<FraudDetectionRule, 'enabled' | 'weight' | 'thresholdValue' | 'autoAction'>>,
    stepUpCode: string
  ): Promise<{ success: boolean; rule: FraudDetectionRule }> {
    return fraudFetch(
      `/api/fraud/rules/${encodeURIComponent(ruleId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch)
      },
      stepUpCode
    );
  },

  updateSettings(patch: Partial<FraudSettings>, stepUpCode: string): Promise<{ success: boolean; settings: FraudSettings }> {
    return fraudFetch(
      '/api/fraud/settings',
      {
        method: 'PATCH',
        body: JSON.stringify(patch)
      },
      stepUpCode
    );
  },

  updateStaffPermissions(
    staffId: string,
    permissions: Partial<Record<FraudPermissionKey, boolean>>,
    stepUpCode: string
  ): Promise<{ success: boolean }> {
    return fraudFetch(
      `/api/fraud/permissions/${encodeURIComponent(staffId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ permissions })
      },
      stepUpCode
    );
  }
};
