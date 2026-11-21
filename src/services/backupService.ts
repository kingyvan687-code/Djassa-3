import { getSecurityToken, securityService, type SecurityApiError } from './securityService';
import type {
  BackupDataDomainKey,
  BackupDestinationType,
  BackupOverviewResponse,
  BackupPermissionKey,
  BackupRecord,
  BackupRestoreOperationRequest,
  BackupRestoreTestReport,
  BackupRetentionSettings,
  BackupScheduleRule,
  BackupSpaceKey,
  BackupType
} from '../types/backup';

async function backupFetch<T>(url: string, options: RequestInit = {}, stepUpCode?: string): Promise<T> {
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
    const err = new Error(data?.message || data?.error || `Erreur sauvegarde (${response.status})`) as SecurityApiError;
    err.status = response.status;
    err.code = data?.error;
    throw err;
  }
  return data as T;
}

export const backupService = {
  getOverview(): Promise<BackupOverviewResponse> {
    return backupFetch<BackupOverviewResponse>('/api/backups/overview');
  },

  runBackup(payload: {
    type: BackupType;
    spacesCovered: BackupSpaceKey[];
    domainsCovered: BackupDataDomainKey[];
    destination: BackupDestinationType;
    note?: string;
  }): Promise<{ success: boolean; backup: BackupRecord }> {
    return backupFetch('/api/backups/run', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  verifyIntegrity(backupId: string): Promise<{ success: boolean; backup: BackupRecord; message: string }> {
    return backupFetch(`/api/backups/${encodeURIComponent(backupId)}/verify-integrity`, {
      method: 'POST'
    });
  },

  getDetails(backupId: string): Promise<{ success: boolean; backup: BackupRecord }> {
    return backupFetch(`/api/backups/${encodeURIComponent(backupId)}/details`);
  },

  async downloadEncryptedArchive(backupId: string, stepUpCode: string): Promise<void> {
    await securityService.ensureAdminSessionIfMissing();
    const token = getSecurityToken();
    const res = await fetch(`/api/backups/${encodeURIComponent(backupId)}/download`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'X-Security-Stepup-Code': stepUpCode
      }
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.message || data?.error || `Téléchargement refusé (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${backupId}.djassa.enc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  toggleLegalHold(backupId: string, legalHold: boolean, legalHoldReason?: string): Promise<{ success: boolean; backup: BackupRecord }> {
    return backupFetch(`/api/backups/${encodeURIComponent(backupId)}/legal-hold`, {
      method: 'PATCH',
      body: JSON.stringify({ legalHold, legalHoldReason })
    });
  },

  deleteBackup(backupId: string, stepUpCode: string): Promise<{ success: boolean; deletedId: string }> {
    return backupFetch(
      `/api/backups/${encodeURIComponent(backupId)}`,
      { method: 'DELETE' },
      stepUpCode
    );
  },

  runRestoreTest(backupId: string): Promise<{ success: boolean; report: BackupRestoreTestReport; backup: BackupRecord }> {
    return backupFetch(`/api/backups/${encodeURIComponent(backupId)}/test-restore`, {
      method: 'POST'
    });
  },

  requestRestore(
    backupId: string,
    payload: {
      targetEnv: 'test_env' | 'production';
      restoreMode: 'complete' | 'perimetre' | 'metier' | 'medias';
      spacesSelected: BackupSpaceKey[];
      domainsSelected: BackupDataDomainKey[];
      reason: string;
      confirmationText: string;
    },
    stepUpCode: string
  ): Promise<{ success: boolean; restoreRequest: BackupRestoreOperationRequest }> {
    return backupFetch(
      `/api/backups/${encodeURIComponent(backupId)}/restore`,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      },
      stepUpCode
    );
  },

  decideRestoreRequest(
    reqId: string,
    decision: 'approve' | 'reject' | 'cancel',
    stepUpCode: string
  ): Promise<{ success: boolean; restoreRequest: BackupRestoreOperationRequest }> {
    return backupFetch(
      `/api/backups/restore-requests/${encodeURIComponent(reqId)}/decide`,
      {
        method: 'POST',
        body: JSON.stringify({ decision })
      },
      stepUpCode
    );
  },

  updateSchedule(
    scheduleId: string,
    patch: Partial<Pick<BackupScheduleRule, 'enabled' | 'frequency' | 'executionTimeHHMM' | 'timezone' | 'destination' | 'retainCount' | 'backupType'>>,
    stepUpCode: string
  ): Promise<{ success: boolean; schedule: BackupScheduleRule }> {
    return backupFetch(
      `/api/backups/schedules/${encodeURIComponent(scheduleId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch)
      },
      stepUpCode
    );
  },

  updateRetentionSettings(
    patch: Partial<BackupRetentionSettings>,
    stepUpCode: string
  ): Promise<{ success: boolean; retentionSettings: BackupRetentionSettings }> {
    return backupFetch(
      '/api/backups/retention',
      {
        method: 'PATCH',
        body: JSON.stringify(patch)
      },
      stepUpCode
    );
  },

  updateStaffPermissions(
    staffId: string,
    permissions: Partial<Record<BackupPermissionKey, boolean>>,
    stepUpCode: string
  ): Promise<{ success: boolean }> {
    return backupFetch(
      `/api/backups/permissions/${encodeURIComponent(staffId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ permissions })
      },
      stepUpCode
    );
  }
};
