import { getSecurityToken, securityService, type SecurityApiError } from './securityService';
import type {
  AnomalyStatus,
  DetectedAnomalyRecord,
  SurveillancePermissionKey,
  SurveillanceSettings,
  SurveillanceStaffPermissionRow,
  SystemSurveillanceOverviewResponse,
  TechnicalAlertRecord,
  TechnicalLogEntry
} from '../types/systemSurveillance';

async function survFetch<T>(url: string, options: RequestInit = {}, stepUpCode?: string): Promise<T> {
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
    const err = new Error(data?.message || data?.error || `Erreur surveillance (${response.status})`) as SecurityApiError;
    err.status = response.status;
    err.code = data?.error;
    throw err;
  }
  return data as T;
}

export const systemSurveillanceService = {
  getOverview(probe = false): Promise<SystemSurveillanceOverviewResponse> {
    return survFetch<SystemSurveillanceOverviewResponse>(
      `/api/surveillance/overview${probe ? '?probe=1' : ''}`
    );
  },

  runManualCheck(): Promise<SystemSurveillanceOverviewResponse> {
    return survFetch<SystemSurveillanceOverviewResponse>('/api/surveillance/check', {
      method: 'POST',
      body: JSON.stringify({})
    });
  },

  updateAnomaly(
    id: string,
    payload: { status?: AnomalyStatus; comment?: string; takeOwnership?: boolean }
  ): Promise<{ success: boolean; anomaly: DetectedAnomalyRecord }> {
    return survFetch(`/api/surveillance/anomalies/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  acknowledgeAlert(id: string): Promise<{ success: boolean; alert: TechnicalAlertRecord }> {
    return survFetch(`/api/surveillance/alerts/${encodeURIComponent(id)}/ack`, {
      method: 'POST',
      body: JSON.stringify({})
    });
  },

  queryLogs(filters: {
    appId?: string;
    serviceId?: string;
    severity?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    q?: string;
  }): Promise<{ success: boolean; logs: TechnicalLogEntry[] }> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    const qs = params.toString();
    return survFetch(`/api/surveillance/logs${qs ? `?${qs}` : ''}`);
  },

  updateSettings(
    patch: Partial<SurveillanceSettings>,
    stepUpCode: string
  ): Promise<{ success: boolean; settings: SurveillanceSettings }> {
    return survFetch(
      '/api/surveillance/settings',
      {
        method: 'PATCH',
        body: JSON.stringify(patch)
      },
      stepUpCode
    );
  },

  updateStaffPermissions(
    staffId: string,
    permissions: Partial<Record<SurveillancePermissionKey, boolean>>,
    stepUpCode: string
  ): Promise<{ success: boolean; permissionsDirectory: SurveillanceStaffPermissionRow[] }> {
    return survFetch(
      `/api/surveillance/permissions/${encodeURIComponent(staffId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ permissions })
      },
      stepUpCode
    );
  }
};
