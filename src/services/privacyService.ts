import { getSecurityToken, securityService, type SecurityApiError } from './securityService';
import type {
  DataRetentionRuleRecord,
  PrivacyDataCategoryGroup,
  PrivacyExportRecord,
  PrivacyIncidentRecord,
  PrivacyIncidentSeverity,
  PrivacyIncidentStatus,
  PrivacyOverviewResponse,
  PrivacyPermissionKey,
  PrivacyPolicyDocumentRecord,
  PrivacyPolicyStatus,
  PrivacyRequestRecord,
  PrivacyRequestStatus,
  PrivacyRequestType,
  PrivacySettings,
  PrivacyStaffPermissionRow,
  RevealedPrivacyRecordPayload,
  UserConsentRecord
} from '../types/privacy';

async function privFetch<T>(url: string, options: RequestInit = {}, stepUpCode?: string): Promise<T> {
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
    const err = new Error(data?.message || data?.error || `Erreur confidentialité (${response.status})`) as SecurityApiError;
    err.status = response.status;
    err.code = data?.error;
    throw err;
  }
  return data as T;
}

export const privacyService = {
  getOverview(): Promise<PrivacyOverviewResponse> {
    return privFetch<PrivacyOverviewResponse>('/api/privacy/overview');
  },

  syncDirectory(users: unknown[]): Promise<{ success: boolean; added: number; total: number }> {
    return privFetch('/api/privacy/sync-directory', {
      method: 'POST',
      body: JSON.stringify({ users })
    });
  },

  revealRecord(
    recordId: string,
    payload: { category: PrivacyDataCategoryGroup; reason: string },
    stepUpCode?: string
  ): Promise<{ success: boolean; revealed: RevealedPrivacyRecordPayload }> {
    return privFetch(
      `/api/privacy/records/${encodeURIComponent(recordId)}/reveal`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      },
      stepUpCode
    );
  },

  updateConsent(payload: {
    userId: string;
    marketingOptIn?: boolean;
    notificationsOptIn?: boolean;
  }): Promise<{ success: boolean; consent: UserConsentRecord }> {
    return privFetch('/api/privacy/consents/update', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  createPrivacyRequest(payload: {
    userId: string;
    type: PrivacyRequestType;
    identityVerified: boolean;
    reason: string;
  }): Promise<{ success: boolean; request: PrivacyRequestRecord }> {
    return privFetch('/api/privacy/requests', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  updatePrivacyRequest(
    id: string,
    payload: {
      status?: PrivacyRequestStatus;
      identityVerified?: boolean;
      comment?: string;
      resolutionMode?: 'anonymize' | 'hard_delete' | '';
    }
  ): Promise<{ success: boolean; request: PrivacyRequestRecord }> {
    return privFetch(`/api/privacy/requests/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  updateRetentionRule(
    id: string,
    patch: Partial<Pick<DataRetentionRuleRecord, 'retentionDays' | 'anonymizeInsteadOfDelete' | 'legalHoldProtection' | 'extendedRetentionNote' | 'status'>>,
    stepUpCode: string
  ): Promise<{ success: boolean; rule: DataRetentionRuleRecord }> {
    return privFetch(
      `/api/privacy/retention-rules/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch)
      },
      stepUpCode
    );
  },

  createExport(
    payload: {
      scope: 'single_user' | 'bulk_filtered';
      userId?: string;
      format: 'json' | 'csv';
      justification: string;
    },
    stepUpCode?: string
  ): Promise<{ success: boolean; exportRecord: PrivacyExportRecord }> {
    return privFetch(
      '/api/privacy/exports',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      },
      stepUpCode
    );
  },

  async downloadExportFile(exportId: string, token: string, format: 'json' | 'csv') {
    await securityService.ensureAdminSessionIfMissing();
    const bearer = getSecurityToken();
    const res = await fetch(`/api/privacy/exports/${encodeURIComponent(exportId)}/download?token=${encodeURIComponent(token)}`, {
      headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.message || data?.error || `Téléchargement refusé (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `djassa-export-${exportId}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  createIncident(payload: {
    type: PrivacyIncidentRecord['type'];
    affectedCategories: PrivacyDataCategoryGroup[];
    potentiallyAffectedUsersCount: number;
    severity: PrivacyIncidentSeverity;
    origin: string;
    measuresTaken: string;
    requiresArtciNotification?: boolean;
    requiresUserNotification?: boolean;
    assessmentNotes?: string;
  }): Promise<{ success: boolean; incident: PrivacyIncidentRecord }> {
    return privFetch('/api/privacy/incidents', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  updateIncident(
    id: string,
    payload: {
      status?: PrivacyIncidentStatus;
      measuresTaken?: string;
      requiresArtciNotification?: boolean;
      requiresUserNotification?: boolean;
      assessmentNotes?: string;
      adminValidatedNotification?: boolean;
    },
    stepUpCode?: string
  ): Promise<{ success: boolean; incident: PrivacyIncidentRecord }> {
    return privFetch(
      `/api/privacy/incidents/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload)
      },
      stepUpCode
    );
  },

  updatePolicy(
    id: string,
    payload: {
      currentVersion?: string;
      status?: PrivacyPolicyStatus;
      summary?: string;
      contentPreview?: string;
      requiresReconsentOnPublish?: boolean;
      notes?: string;
    },
    stepUpCode: string
  ): Promise<{ success: boolean; policy: PrivacyPolicyDocumentRecord }> {
    return privFetch(
      `/api/privacy/policies/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload)
      },
      stepUpCode
    );
  },

  updateSettings(patch: Partial<PrivacySettings>, stepUpCode: string): Promise<{ success: boolean; settings: PrivacySettings }> {
    return privFetch(
      '/api/privacy/settings',
      {
        method: 'PATCH',
        body: JSON.stringify(patch)
      },
      stepUpCode
    );
  },

  updateStaffPermissions(
    staffId: string,
    permissions: Partial<Record<PrivacyPermissionKey, boolean>>,
    stepUpCode: string
  ): Promise<{ success: boolean; permissionsDirectory: PrivacyStaffPermissionRow[] }> {
    return privFetch(
      `/api/privacy/permissions/${encodeURIComponent(staffId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ permissions })
      },
      stepUpCode
    );
  }
};
