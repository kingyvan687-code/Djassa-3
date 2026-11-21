import { getSecurityToken, securityService, setSecurityToken, setActiveSecurityActorId, type SecurityApiError } from './securityService';
import type {
  AdminTeamRoleKey,
  TeamAdminMemberPublic,
  TeamFinancialValidationRequest,
  TeamInvitationPublic,
  TeamMemberDetailResponse,
  TeamModuleKey,
  TeamModuleSettings,
  TeamOverviewResponse,
  TeamPermissionLevel,
  TeamPermissionsMatrix,
  TeamSpecialPermissions
} from '../types/team';

export type TeamApiError = SecurityApiError & {
  requiresMfa?: boolean;
  requiresReauth?: boolean;
};

async function teamFetch<T>(
  url: string,
  options: RequestInit = {},
  stepUpCode?: string,
  skipEnsureSession = false
): Promise<T> {
  if (!skipEnsureSession) {
    await securityService.ensureAdminSessionIfMissing();
  }
  const token = getSecurityToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined)
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (stepUpCode) headers['X-Security-Stepup-Code'] = stepUpCode;

  const res = await fetch(url, { ...options, headers });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const err = new Error(body?.message || body?.error || `Erreur serveur (${res.status})`) as TeamApiError;
    err.status = res.status;
    err.code = body?.error;
    err.requiresMfa = res.status === 428 || body?.error === 'MFA_STEPUP_REQUIRED';
    err.requiresReauth = res.status === 401;
    throw err;
  }
  return body as T;
}

export const teamService = {
  getOverview: () => teamFetch<TeamOverviewResponse>('/api/team/overview'),

  getMemberDetail: (adminId: string) =>
    teamFetch<TeamMemberDetailResponse>(`/api/team/members/${encodeURIComponent(adminId)}`),

  createAdminMember: (
    payload: {
      fullName: string;
      email: string;
      phone: string;
      avatarUrl?: string | null;
      professionalId?: string;
      role: AdminTeamRoleKey;
      department?: string;
      permissions?: Partial<TeamPermissionsMatrix>;
      specialPermissions?: Partial<TeamSpecialPermissions>;
      mfaEnabled?: boolean;
    },
    stepUpCode?: string
  ) =>
    teamFetch<{
      success: boolean;
      message: string;
      admin: TeamAdminMemberPublic;
      invitation: TeamInvitationPublic;
      invitationToken: string;
      activationPath: string;
    }>(
      '/api/team/members',
      { method: 'POST', body: JSON.stringify(payload) },
      stepUpCode
    ),

  acceptInvitation: async (payload: { token: string; password: string }) => {
    const res = await teamFetch<{
      success: boolean;
      message: string;
      token: string;
      session: any;
      admin: TeamAdminMemberPublic;
    }>(
      '/api/team/invitations/accept',
      { method: 'POST', body: JSON.stringify(payload) },
      undefined,
      true
    );
    return res;
  },

  loginAdminMember: async (payload: { email: string; password: string }, applyAsCurrentSession = false) => {
    const res = await teamFetch<{
      success: boolean;
      message: string;
      token: string;
      session: any;
      isNewDevice: boolean;
      admin: TeamAdminMemberPublic;
    }>(
      '/api/team/auth/login',
      { method: 'POST', body: JSON.stringify(payload) },
      undefined,
      true
    );
    if (applyAsCurrentSession && res.token) {
      setSecurityToken(res.token);
      setActiveSecurityActorId(res.admin.id);
    }
    return res;
  },

  updateAdminMember: (
    adminId: string,
    payload: {
      fullName?: string;
      phone?: string;
      department?: string;
      avatarUrl?: string | null;
      role?: AdminTeamRoleKey;
      permissions?: Partial<TeamPermissionsMatrix>;
      specialPermissions?: Partial<TeamSpecialPermissions>;
      mfaEnabled?: boolean;
    },
    stepUpCode?: string
  ) =>
    teamFetch<{ success: boolean; message: string; admin: TeamAdminMemberPublic }>(
      `/api/team/members/${encodeURIComponent(adminId)}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      stepUpCode
    ),

  suspendAdminMember: (adminId: string, payload: { reason: string; durationDays?: number }, stepUpCode?: string) =>
    teamFetch<{ success: boolean; message: string; revokedSessions: number; admin: TeamAdminMemberPublic }>(
      `/api/team/members/${encodeURIComponent(adminId)}/suspend`,
      { method: 'POST', body: JSON.stringify(payload) },
      stepUpCode
    ),

  reactivateAdminMember: (adminId: string, stepUpCode?: string) =>
    teamFetch<{ success: boolean; message: string; admin: TeamAdminMemberPublic }>(
      `/api/team/members/${encodeURIComponent(adminId)}/reactivate`,
      { method: 'POST', body: JSON.stringify({}) },
      stepUpCode
    ),

  revokeAdminSessions: (adminId: string, reason?: string, stepUpCode?: string) =>
    teamFetch<{ success: boolean; message: string; revokedCount: number }>(
      `/api/team/members/${encodeURIComponent(adminId)}/revoke-sessions`,
      { method: 'POST', body: JSON.stringify({ reason }) },
      stepUpCode
    ),

  resendInvitation: (adminId: string) =>
    teamFetch<{
      success: boolean;
      message: string;
      invitation: TeamInvitationPublic;
      invitationToken: string;
      activationPath: string;
    }>(`/api/team/members/${encodeURIComponent(adminId)}/resend-invitation`, {
      method: 'POST',
      body: JSON.stringify({})
    }),

  deactivateAdminMember: (adminId: string, reason: string, stepUpCode?: string) =>
    teamFetch<{ success: boolean; message: string; admin: TeamAdminMemberPublic }>(
      `/api/team/members/${encodeURIComponent(adminId)}/deactivate`,
      { method: 'POST', body: JSON.stringify({ reason }) },
      stepUpCode
    ),

  checkPermission: (moduleKey: TeamModuleKey, minLevel: TeamPermissionLevel) =>
    teamFetch<{
      success: boolean;
      allowed: boolean;
      moduleKey: TeamModuleKey;
      requiredLevel: TeamPermissionLevel;
      currentLevel: TeamPermissionLevel;
      actorRole: AdminTeamRoleKey;
    }>('/api/team/permissions/check', {
      method: 'POST',
      body: JSON.stringify({ moduleKey, minLevel })
    }),

  createFinancialValidation: (payload: {
    operationType: 'remboursement' | 'indemnisation' | 'retrait_vendeur' | 'ajustement_financier';
    title: string;
    reference?: string;
    amountFcfa: number;
    note?: string;
  }) =>
    teamFetch<{ success: boolean; validation: TeamFinancialValidationRequest }>('/api/team/financial-validations', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  approveFinancialValidation: (id: string, note?: string, stepUpCode?: string) =>
    teamFetch<{ success: boolean; message: string; validation: TeamFinancialValidationRequest }>(
      `/api/team/financial-validations/${encodeURIComponent(id)}/approve`,
      { method: 'POST', body: JSON.stringify({ note }) },
      stepUpCode
    ),

  rejectFinancialValidation: (id: string, reason: string) =>
    teamFetch<{ success: boolean; message: string; validation: TeamFinancialValidationRequest }>(
      `/api/team/financial-validations/${encodeURIComponent(id)}/reject`,
      { method: 'POST', body: JSON.stringify({ reason }) }
    ),

  updateSettings: (
    patch: Partial<{
      standardFinancialApprovalLimitFcfa: number;
      invitationValidityHours: number;
      requireMfaForSensitiveTeamActions: boolean;
    }>,
    stepUpCode?: string
  ) =>
    teamFetch<{ success: boolean; settings: TeamModuleSettings }>(
      '/api/team/settings',
      { method: 'PATCH', body: JSON.stringify(patch) },
      stepUpCode
    ),

  markNotificationRead: (notifId: string) =>
    teamFetch<{ success: boolean }>(`/api/team/notifications/${encodeURIComponent(notifId)}/read`, {
      method: 'POST',
      body: JSON.stringify({})
    }),

  markAllNotificationsRead: () =>
    teamFetch<{ success: boolean }>('/api/team/notifications/read-all', {
      method: 'POST',
      body: JSON.stringify({})
    })
};
