import { apiJsonFetch, fetchWithTimeout } from './httpClient';
import { getSecurityToken, securityService, type SecurityApiError } from './securityService';
import type {
  AppEnvironment,
  AppVersionRecord,
  DeploymentChannel,
  DeploymentRecord,
  DjassaAppId,
  MaintenanceOverviewResponse,
  MaintenancePermissionKey,
  MaintenanceScope,
  MaintenanceStaffPermissionRow,
  MaintenanceWindowRecord,
  PublicMaintenanceStatusResponse,
  RollbackPreflightResult,
  ServiceHealthRecord,
  TechnicalErrorRecord,
  TechnicalErrorSeverity,
  TechnicalErrorStatus,
  TechnicalErrorType,
  TechnicalMaintenanceSettings,
  VersionPublicationStatus
} from '../types/maintenance';

async function maintenanceFetch<T>(url: string, options: RequestInit = {}, stepUpCode?: string): Promise<T> {
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

  const response = await fetchWithTimeout(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.message || data?.error || `Erreur maintenance (${response.status})`) as SecurityApiError;
    err.status = response.status;
    err.code = data?.error;
    throw err;
  }
  return data as T;
}

export const maintenanceService = {
  getPublicStatus(): Promise<PublicMaintenanceStatusResponse> {
    return apiJsonFetch<PublicMaintenanceStatusResponse>('/api/maintenance/public-status', {
      cacheTtlMs: 5_000,
      timeoutMs: 8_000
    });
  },

  async reportClientError(payload: {
    appId?: DjassaAppId | 'all';
    serviceId?: string;
    serviceName?: string;
    errorType?: TechnicalErrorType;
    severity?: TechnicalErrorSeverity;
    description: string;
    rawLog?: string;
  }): Promise<{ success: boolean; errorId?: string }> {
    try {
      const res = await fetchWithTimeout(
        '/api/maintenance/errors/report',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        },
        5_000
      );
      return await res.json().catch(() => ({ success: false }));
    } catch {
      return { success: false };
    }
  },

  getOverview(probe = false): Promise<MaintenanceOverviewResponse> {
    return maintenanceFetch<MaintenanceOverviewResponse>(`/api/maintenance/overview${probe ? '?probe=1' : ''}`);
  },

  createVersion(payload: {
    appId: DjassaAppId;
    version: string;
    buildNumber?: string;
    targetEnv: AppEnvironment;
    description: string;
    bugFixes: string[];
    newFeatures: string[];
    securityImprovements: string[];
    compatibilityNotes?: string;
    apiVersion?: string;
    dbSchemaVersion?: string;
    migrationVersion?: string;
    rollbackEligible?: boolean;
  }): Promise<{ success: boolean; version: AppVersionRecord }> {
    return maintenanceFetch('/api/maintenance/versions', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  updateVersionStatus(
    versionId: string,
    status: VersionPublicationStatus
  ): Promise<{ success: boolean; version: AppVersionRecord }> {
    return maintenanceFetch(`/api/maintenance/versions/${encodeURIComponent(versionId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  prepareDeployment(payload: {
    versionId: string;
    targetEnv: AppEnvironment;
    rolloutMode: 'standard' | 'progressif';
    deployChannel: DeploymentChannel;
  }): Promise<{ success: boolean; deployment: DeploymentRecord }> {
    return maintenanceFetch('/api/maintenance/deployments/prepare', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  validateDeployment(deploymentId: string, stepUpCode?: string): Promise<{ success: boolean; deployment: DeploymentRecord }> {
    return maintenanceFetch(
      `/api/maintenance/deployments/${encodeURIComponent(deploymentId)}/validate`,
      { method: 'POST', body: JSON.stringify({}) },
      stepUpCode
    );
  },

  executeDeployment(
    deploymentId: string,
    options: { advanceStage?: 'next' | 'full' } = {},
    stepUpCode?: string
  ): Promise<{ success: boolean; deployment: DeploymentRecord; progressiveStage?: number }> {
    return maintenanceFetch(
      `/api/maintenance/deployments/${encodeURIComponent(deploymentId)}/execute`,
      { method: 'POST', body: JSON.stringify(options) },
      stepUpCode
    );
  },

  cancelDeployment(deploymentId: string, reason?: string): Promise<{ success: boolean; deployment: DeploymentRecord }> {
    return maintenanceFetch(`/api/maintenance/deployments/${encodeURIComponent(deploymentId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  createMaintenanceWindow(payload: {
    scope: MaintenanceScope;
    appIds: DjassaAppId[];
    activateNow: boolean;
    startAt?: string;
    endAt?: string;
    estimatedDurationMinutes?: number;
    customMessage: string;
    reason?: string;
  }): Promise<{ success: boolean; maintenance: MaintenanceWindowRecord }> {
    return maintenanceFetch('/api/maintenance/windows', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  stopMaintenanceWindow(id: string): Promise<{ success: boolean; maintenance: MaintenanceWindowRecord }> {
    return maintenanceFetch(`/api/maintenance/windows/${encodeURIComponent(id)}/stop`, {
      method: 'POST',
      body: JSON.stringify({})
    });
  },

  runServiceChecks(): Promise<{ success: boolean; services: ServiceHealthRecord[]; lastProbeAt: string }> {
    return maintenanceFetch('/api/maintenance/services/check', {
      method: 'POST',
      body: JSON.stringify({})
    });
  },

  updateTechnicalErrorStatus(
    errorId: string,
    status: TechnicalErrorStatus,
    note?: string
  ): Promise<{ success: boolean; errorRecord: TechnicalErrorRecord }> {
    return maintenanceFetch(`/api/maintenance/errors/${encodeURIComponent(errorId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note })
    });
  },

  rollbackPreflight(appId: DjassaAppId, targetVersionId?: string): Promise<{ success: boolean; preflight: RollbackPreflightResult }> {
    return maintenanceFetch('/api/maintenance/rollbacks/preflight', {
      method: 'POST',
      body: JSON.stringify({ appId, targetVersionId })
    });
  },

  executeRollback(
    payload: {
      appId: DjassaAppId;
      targetVersionId: string;
      confirmPhrase: string;
      reason: string;
    },
    stepUpCode?: string
  ): Promise<{ success: boolean; deployment: DeploymentRecord }> {
    return maintenanceFetch(
      '/api/maintenance/rollbacks/execute',
      { method: 'POST', body: JSON.stringify(payload) },
      stepUpCode
    );
  },

  updateTechnicalSettings(
    patch: Partial<TechnicalMaintenanceSettings>,
    stepUpCode?: string
  ): Promise<{ success: boolean; settings: TechnicalMaintenanceSettings }> {
    return maintenanceFetch(
      '/api/maintenance/settings',
      { method: 'PATCH', body: JSON.stringify(patch) },
      stepUpCode
    );
  },

  updateStaffMaintenancePermissions(
    staffId: string,
    permissions: Partial<Record<MaintenancePermissionKey, boolean>>,
    stepUpCode?: string
  ): Promise<{ success: boolean; permissionsDirectory: MaintenanceStaffPermissionRow[] }> {
    return maintenanceFetch(
      `/api/maintenance/permissions/${encodeURIComponent(staffId)}`,
      { method: 'PATCH', body: JSON.stringify({ permissions }) },
      stepUpCode
    );
  }
};
