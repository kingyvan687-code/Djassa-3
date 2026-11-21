import { getSecurityToken, securityService, type SecurityApiError } from './securityService';
import type {
  DisputeActorRoleType,
  DisputeCategoryKey,
  DisputeEvidenceKind,
  DisputeFinancialApprovalRequest,
  DisputeModuleSettings,
  DisputeOverviewResponse,
  DisputePermissionKey,
  DisputePriority,
  DisputeRecord,
  DisputeStatus
} from '../types/disputes';

export type DisputeApiError = SecurityApiError & {
  requiresMfa?: boolean;
  requiresReauth?: boolean;
};

async function disputeFetch<T>(
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
    const err = new Error(body?.message || body?.error || `Erreur serveur (${res.status})`) as DisputeApiError;
    err.status = res.status;
    err.code = body?.error;
    err.requiresMfa = res.status === 428 || body?.error === 'MFA_STEPUP_REQUIRED';
    err.requiresReauth = res.status === 401;
    throw err;
  }
  return body as T;
}

export const disputesService = {
  getOverview: () => disputeFetch<DisputeOverviewResponse>('/api/disputes/overview'),

  syncFromOrders: (payload: {
    orders: any[];
    messages: any[];
    sellers: any[];
    drivers?: any[];
  }) =>
    disputeFetch<{ success: boolean; importedCount: number; importedIds: string[] }>('/api/disputes/sync-from-orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  createDispute: (
    payload: {
      category: DisputeCategoryKey;
      subject: string;
      description: string;
      orderNumber: string;
      order?: any;
      declarant?: any;
      accusedActor?: any;
      actors?: any;
      amountFcfa?: number;
      priority?: DisputePriority;
      assignedAgentId?: string;
      initialEvidence?: {
        kind: DisputeEvidenceKind;
        title: string;
        description?: string;
        urlOrData?: string;
        mimeType?: string;
      }[];
    },
    idempotencyKey?: string
  ) =>
    disputeFetch<{ success: boolean; dispute: DisputeRecord; idempotentDuplicate?: boolean }>(
      '/api/disputes',
      { method: 'POST', body: JSON.stringify(payload) },
      undefined,
      idempotencyKey
    ),

  takeCharge: (id: string) =>
    disputeFetch<{ success: boolean; dispute: DisputeRecord }>(`/api/disputes/${encodeURIComponent(id)}/take-charge`, {
      method: 'POST',
      body: JSON.stringify({})
    }),

  assignToAgent: (id: string, agentId: string) =>
    disputeFetch<{ success: boolean; dispute: DisputeRecord }>(`/api/disputes/${encodeURIComponent(id)}/assign`, {
      method: 'POST',
      body: JSON.stringify({ agentId })
    }),

  updatePriority: (id: string, priority: DisputePriority, reason?: string) =>
    disputeFetch<{ success: boolean; dispute: DisputeRecord }>(`/api/disputes/${encodeURIComponent(id)}/priority`, {
      method: 'PATCH',
      body: JSON.stringify({ priority, reason })
    }),

  updateStatus: (id: string, payload: { status: DisputeStatus; reason?: string; confirmed?: boolean }) =>
    disputeFetch<{ success: boolean; dispute: DisputeRecord }>(`/api/disputes/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),

  postMessageOrNote: (
    id: string,
    payload: {
      kind: 'admin_to_actor' | 'internal_note' | 'evidence_request' | 'actor_message';
      message: string;
      targetActorRole?: DisputeActorRoleType | 'all_actors';
      actorResponseMode?: DisputeActorRoleType;
      switchStatusToAwaitingEvidence?: boolean;
    }
  ) =>
    disputeFetch<{ success: boolean; dispute: DisputeRecord }>(`/api/disputes/${encodeURIComponent(id)}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  addEvidence: (
    id: string,
    payload: {
      kind: DisputeEvidenceKind;
      title: string;
      description?: string;
      urlOrData?: string;
      mimeType?: string;
      fileSizeBytes?: number;
      submittedByRole?: DisputeActorRoleType;
    }
  ) =>
    disputeFetch<{ success: boolean; dispute: DisputeRecord }>(`/api/disputes/${encodeURIComponent(id)}/evidence`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  runMediation: (
    id: string,
    payload: {
      action: 'start' | 'update';
      proposedSettlement?: string;
      outcome?: 'en_cours' | 'accord_trouve' | 'echec_arbitrage_admin';
      outcomeNote?: string;
      clientAccepted?: boolean;
      sellerAccepted?: boolean;
    }
  ) =>
    disputeFetch<{ success: boolean; dispute: DisputeRecord }>(`/api/disputes/${encodeURIComponent(id)}/mediation`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  blockFunds: (
    id: string,
    payload: { amountFcfa: number; mode: string; reason: string },
    stepUpCode?: string
  ) =>
    disputeFetch<{ success: boolean; dispute: DisputeRecord }>(
      `/api/disputes/${encodeURIComponent(id)}/financial/block`,
      { method: 'POST', body: JSON.stringify(payload) },
      stepUpCode
    ),

  requestRefund: (
    id: string,
    payload: {
      amountFcfa: number;
      channel: string;
      reason: string;
      confirmationText: string;
      externalProviderReference?: string;
    },
    stepUpCode?: string
  ) =>
    disputeFetch<{
      success: boolean;
      dispute: DisputeRecord;
      dualValidationRequired?: boolean;
      awaitingProviderConfirmation?: boolean;
      approvalRequest?: DisputeFinancialApprovalRequest;
      message?: string;
    }>(
      `/api/disputes/${encodeURIComponent(id)}/financial/refund`,
      { method: 'POST', body: JSON.stringify(payload) },
      stepUpCode
    ),

  confirmExternalRefund: (
    id: string,
    payload: { providerReceiptRef: string; proofNote?: string },
    stepUpCode?: string
  ) =>
    disputeFetch<{ success: boolean; dispute: DisputeRecord }>(
      `/api/disputes/${encodeURIComponent(id)}/financial/confirm-external`,
      { method: 'POST', body: JSON.stringify(payload) },
      stepUpCode
    ),

  releaseFunds: (
    id: string,
    payload: { reason: string; confirmationText: string },
    stepUpCode?: string
  ) =>
    disputeFetch<{ success: boolean; dispute: DisputeRecord }>(
      `/api/disputes/${encodeURIComponent(id)}/financial/release`,
      { method: 'POST', body: JSON.stringify(payload) },
      stepUpCode
    ),

  decideFinancialRequest: (
    reqId: string,
    decision: 'approve' | 'reject' | 'cancel',
    note: string,
    stepUpCode?: string
  ) =>
    disputeFetch<{ success: boolean; approvalRequest: DisputeFinancialApprovalRequest; dispute?: DisputeRecord }>(
      `/api/disputes/financial-requests/${encodeURIComponent(reqId)}/decide`,
      { method: 'POST', body: JSON.stringify({ decision, note }) },
      stepUpCode
    ),

  applySanction: (
    id: string,
    payload: {
      targetRole: DisputeActorRoleType;
      sanctionType: 'avertissement' | 'blocage_retraits' | 'restriction_commandes' | 'suspension_temporaire' | 'suspension_permanente';
      reason: string;
      durationDays?: number;
      confirmationText: string;
    },
    stepUpCode?: string
  ) =>
    disputeFetch<{ success: boolean; dispute: DisputeRecord }>(
      `/api/disputes/${encodeURIComponent(id)}/sanction`,
      { method: 'POST', body: JSON.stringify(payload) },
      stepUpCode
    ),

  markNotificationRead: (notifId: string) =>
    disputeFetch<{ success: boolean }>(`/api/disputes/notifications/${encodeURIComponent(notifId)}/read`, {
      method: 'POST',
      body: JSON.stringify({})
    }),

  updateSettings: (patch: Partial<DisputeModuleSettings>, stepUpCode?: string) =>
    disputeFetch<{ success: boolean; settings: DisputeModuleSettings }>(
      '/api/disputes/settings',
      { method: 'PATCH', body: JSON.stringify(patch) },
      stepUpCode
    ),

  updatePermissions: (staffId: string, permissions: Partial<Record<DisputePermissionKey, boolean>>, stepUpCode?: string) =>
    disputeFetch<{ success: boolean; staffId: string; permissions: Record<DisputePermissionKey, boolean> }>(
      `/api/disputes/permissions/${encodeURIComponent(staffId)}`,
      { method: 'PATCH', body: JSON.stringify({ permissions }) },
      stepUpCode
    )
};
