import { fetchWithTimeout } from './httpClient';
import type {
  ActivityCategory,
  ActivityDetailResponse,
  ActivityLogPageResponse,
  ActivityLogQueryParams,
  ActivityResultStatus,
  ActivitySpace,
  ActorSummaryInfo,
  AdminNotificationDetailResponse,
  AdminNotificationPageResponse,
  AdminNotificationPreferences,
  AdminNotificationQueryParams,
  AdminNotificationRecord,
  AdminNotificationStatus,
  AlertSeverityLevel,
  FinanceLedgerEntry,
  FinancialTraceDetails,
  NotificationChannelsStatus,
  PlatformSpaceRole,
  ProtectedAuditEntry,
  SecurityActiveSession,
  SecurityAlert,
  SecurityBlockedIp,
  SecurityCyberAttackEvent,
  SecurityDashboardSummary,
  SecurityIncidentRecord,
  SecurityIntrusionEvent,
  SecurityLoginLog,
  SecurityPeriodFilter,
  SecurityPermissionKey,
  SecurityRole,
  SecuritySettings,
  SecurityStaffMember,
  SecuritySuspendedAccount,
  SensitiveOperationType
} from '../types/security';

const SESSION_ID_STORAGE_KEY = 'djassa_sec_session_id';
const ACTOR_ID_STORAGE_KEY = 'djassa_sec_actor_id';
const TOKEN_STORAGE_KEY = 'djassa_sec_token';

export function extractSessionIdFromToken(token: string | null | undefined): string | null {
  if (!token || typeof token !== 'string') return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  try {
    const b64 = token.slice(0, dotIdx).replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const json = atob(b64 + pad);
    const parsed = JSON.parse(json) as { sid?: string };
    return typeof parsed?.sid === 'string' && parsed.sid ? parsed.sid : null;
  } catch {
    return null;
  }
}

export function setSecuritySessionId(sessionId: string | null): void {
  try {
    if (sessionId) localStorage.setItem(SESSION_ID_STORAGE_KEY, sessionId);
    else localStorage.removeItem(SESSION_ID_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
}

export function getOrCreateSecuritySessionId(): string {
  try {
    const tokenSid = extractSessionIdFromToken(getSecurityToken());
    if (tokenSid) {
      localStorage.setItem(SESSION_ID_STORAGE_KEY, tokenSid);
      return tokenSid;
    }
    let existing = localStorage.getItem(SESSION_ID_STORAGE_KEY);
    if (!existing) {
      existing = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(SESSION_ID_STORAGE_KEY, existing);
    }
    return existing;
  } catch {
    return `sess-${Date.now()}`;
  }
}

export function resetSecuritySessionId(): string {
  try {
    const next = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return `sess-${Date.now()}`;
  }
}

export function getSecurityToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setSecurityToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      const sid = extractSessionIdFromToken(token);
      if (sid) localStorage.setItem(SESSION_ID_STORAGE_KEY, sid);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage failures
  }
}

export function clearSecurityToken(): void {
  setSecurityToken(null);
}

export function getActiveSecurityActorId(): string {
  try {
    return localStorage.getItem(ACTOR_ID_STORAGE_KEY) || 'sec-super-admin';
  } catch {
    return 'sec-super-admin';
  }
}

export function setActiveSecurityActorId(actorId: string): void {
  try {
    localStorage.setItem(ACTOR_ID_STORAGE_KEY, actorId);
  } catch {
    // ignore storage failures
  }
}

export type SecurityApiError = Error & {
  status?: number;
  code?: string;
  retryAfterSeconds?: number;
};

function getSecurityHeaders(stepUpCode?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  const token = getSecurityToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (stepUpCode) {
    headers['X-Security-Stepup-Code'] = stepUpCode;
  }
  return headers;
}

async function securityFetch<T>(
  url: string,
  options: RequestInit = {},
  _overrideActorId?: string,
  stepUpCode?: string
): Promise<T> {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      ...getSecurityHeaders(stepUpCode),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.message || data?.error || `Erreur sécurité (${response.status})`) as SecurityApiError;
    err.status = response.status;
    err.code = data?.error;
    if (data?.retryAfterSeconds) err.retryAfterSeconds = data.retryAfterSeconds;
    throw err;
  }
  return data as T;
}

export const securityService = {
  // Server-signed session token issuance
  async issueSession(payload: {
    accountId?: string;
    accountName?: string;
    accountEmail: string;
    role?: string | null;
    tenantId?: string;
  }): Promise<{
    success: boolean;
    token?: string;
    session?: SecurityActiveSession;
    staff?: SecurityStaffMember | null;
    error?: string;
    message?: string;
  }> {
    const sessionId = getOrCreateSecuritySessionId();
    const existingToken = getSecurityToken();
    const res = await fetchWithTimeout('/api/security/auth/issue-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(existingToken ? { Authorization: `Bearer ${existingToken}` } : {})
      },
      body: JSON.stringify({ ...payload, sessionId })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.token) {
      setSecurityToken(data.token);
      if (data.session?.sessionId) {
        setSecuritySessionId(data.session.sessionId);
      }
      if (data.staff?.id) {
        setActiveSecurityActorId(data.staff.id);
      }
      return data;
    }
    return {
      success: false,
      error: data?.error,
      message: data?.message || 'Impossible d’émettre le jeton de session.'
    };
  },

  async ensureAdminSessionIfMissing(): Promise<void> {
    // Sécurité stricte : ne jamais émettre de session sans authentification par mot de passe.
    // Si un jeton signé existe déjà suite au login (/api/auth/login ou /api/team/auth/login), il est réutilisé.
    if (getSecurityToken()) return;
  },

  async switchTestRole(staffId: string): Promise<{ success: boolean; token?: string; actor?: SecurityStaffMember }> {
    const res = await securityFetch<{ success: boolean; token: string; actor: SecurityStaffMember; session?: SecurityActiveSession }>(
      '/api/security/auth/switch-test-role',
      { method: 'POST', body: JSON.stringify({ staffId }) }
    );
    if (res.token) {
      setSecurityToken(res.token);
      if (res.session?.sessionId) {
        setSecuritySessionId(res.session.sessionId);
      }
      setActiveSecurityActorId(staffId);
    }
    return res;
  },

  // Public telemetry hooks
  async reportLoginAttempt(payload: {
    accountId?: string;
    accountName?: string;
    accountEmail: string;
    role?: string | null;
    success: boolean;
    reason?: string;
    isWeakCredential?: boolean;
  }): Promise<{
    blocked?: boolean;
    delayed?: boolean;
    retryAfterSeconds?: number;
    reason?: string;
    unusualDevice?: boolean;
  }> {
    try {
      const token = getSecurityToken();
      if (!token) return {};
      const sessionId = payload.success ? getOrCreateSecuritySessionId() : undefined;
      const res = await fetch('/api/security/telemetry/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...payload, sessionId })
      });
      return await res.json();
    } catch {
      return {};
    }
  },

  async sendSessionHeartbeat(payload: {
    userId: string;
    userName: string;
    userEmail: string;
    role: string;
  }): Promise<{ status?: 'active' | 'revoked' | 'reauth_required' | 'suspended' | 'expired'; reason?: string; forcePasswordReset?: boolean }> {
    try {
      const token = getSecurityToken();
      if (!token) return { status: 'revoked', reason: 'Jeton de session absent.' };
      const tokenSid = extractSessionIdFromToken(token);
      const sessionId = tokenSid || getOrCreateSecuritySessionId();
      if (tokenSid) setSecuritySessionId(tokenSid);
      const res = await fetch('/api/security/sessions/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...payload, sessionId })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 401 || res.status === 403) {
          return {
            status: (errData?.status as 'revoked' | 'reauth_required' | 'suspended' | 'expired') || 'revoked',
            reason: errData?.reason || errData?.message || 'Session expirée ou révoquée.'
          };
        }
        return { status: 'active' };
      }
      return await res.json();
    } catch {
      return { status: 'active' };
    }
  },

  async notifyLogout(): Promise<void> {
    try {
      const sessionId = localStorage.getItem(SESSION_ID_STORAGE_KEY);
      if (sessionId) {
        await fetch('/api/security/sessions/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });
      }
    } catch {
      // ignore network error on logout
    } finally {
      clearSecurityToken();
      resetSecuritySessionId();
    }
  },

  async reportProfileChange(payload: { changeType: 'password' | 'email' | 'phone' | 'profile'; targetEmail?: string; details?: string }) {
    return securityFetch<{ success: boolean }>('/api/security/events/profile-change', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // Step-Up MFA for sensitive admin operations
  requestMfaChallenge() {
    return securityFetch<{
      success: boolean;
      expiresInSeconds: number;
      verificationCodePreview: string;
      deliveryNote: string;
    }>('/api/security/mfa/challenge', { method: 'POST', body: JSON.stringify({}) });
  },

  // RBAC identity
  async getMe(overrideActorId?: string) {
    await this.ensureAdminSessionIfMissing();
    return securityFetch<{
      success: boolean;
      authorized: boolean;
      actor: SecurityStaffMember;
      staffDirectory: SecurityStaffMember[];
    }>('/api/security/me', {}, overrideActorId);
  },

  // Dashboard
  getDashboard(period: SecurityPeriodFilter, from?: string, to?: string, overrideActorId?: string) {
    const params = new URLSearchParams({ period });
    if (period === 'custom' && from) params.set('from', from);
    if (period === 'custom' && to) params.set('to', to);
    return securityFetch<{ success: boolean } & SecurityDashboardSummary>(
      `/api/security/dashboard?${params.toString()}`,
      {},
      overrideActorId
    );
  },

  // Login logs
  getLoginLogs(
    filters: { q?: string; accountType?: string; status?: string; period?: SecurityPeriodFilter; from?: string; to?: string },
    overrideActorId?: string
  ) {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.accountType) params.set('accountType', filters.accountType);
    if (filters.status) params.set('status', filters.status);
    if (filters.period) params.set('period', filters.period);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    return securityFetch<{ success: boolean; total: number; logs: SecurityLoginLog[] }>(
      `/api/security/logins?${params.toString()}`,
      {},
      overrideActorId
    );
  },

  // Intrusions & Cyberattacks
  getIntrusions(severity = 'all', status = 'all', overrideActorId?: string) {
    const params = new URLSearchParams({ severity, status });
    return securityFetch<{ success: boolean; total: number; intrusions: SecurityIntrusionEvent[] }>(
      `/api/security/intrusions?${params.toString()}`,
      {},
      overrideActorId
    );
  },

  getCyberAttacks(attackType = 'all', overrideActorId?: string) {
    const params = new URLSearchParams({ attackType });
    return securityFetch<{
      success: boolean;
      total: number;
      cloudflareWafConnected: boolean;
      cyberAttacks: SecurityCyberAttackEvent[];
    }>(`/api/security/cyberattacks?${params.toString()}`, {}, overrideActorId);
  },

  // Alerts
  getAlerts(severity = 'all', status = 'all', overrideActorId?: string) {
    const params = new URLSearchParams({ severity, status });
    return securityFetch<{ success: boolean; total: number; alerts: SecurityAlert[] }>(
      `/api/security/alerts?${params.toString()}`,
      {},
      overrideActorId
    );
  },

  updateAlertStatus(alertId: string, status: 'en_examen' | 'resolue', note?: string, overrideActorId?: string) {
    return securityFetch<{ success: boolean; alert: SecurityAlert }>(
      `/api/security/alerts/${encodeURIComponent(alertId)}/status`,
      {
        method: 'POST',
        body: JSON.stringify({ status, note })
      },
      overrideActorId
    );
  },

  // Sessions & Actions
  getSessionsAndBlocks(overrideActorId?: string) {
    return securityFetch<{
      success: boolean;
      sessions: SecurityActiveSession[];
      blockedIps: SecurityBlockedIp[];
      suspendedAccounts: SecuritySuspendedAccount[];
    }>('/api/security/sessions', {}, overrideActorId);
  },

  blockIp(ipAddress: string, reason: string, durationMinutes?: number, overrideActorId?: string) {
    return securityFetch<{ success: boolean; blockedIp: SecurityBlockedIp }>(
      '/api/security/actions/block-ip',
      { method: 'POST', body: JSON.stringify({ ipAddress, reason, durationMinutes }) },
      overrideActorId
    );
  },

  unblockIp(ipAddress: string, overrideActorId?: string) {
    return securityFetch<{ success: boolean; blockedIp: SecurityBlockedIp }>(
      '/api/security/actions/unblock-ip',
      { method: 'POST', body: JSON.stringify({ ipAddress }) },
      overrideActorId
    );
  },

  suspendAccount(
    payload: {
      accountId?: string;
      accountName?: string;
      accountEmail: string;
      accountType?: string;
      reason: string;
      durationMinutes?: number;
    },
    overrideActorId?: string
  ) {
    return securityFetch<{ success: boolean; suspendedAccount: SecuritySuspendedAccount }>(
      '/api/security/actions/suspend-account',
      { method: 'POST', body: JSON.stringify(payload) },
      overrideActorId
    );
  },

  reactivateAccount(payload: { accountId?: string; accountEmail?: string; note?: string }, overrideActorId?: string) {
    return securityFetch<{ success: boolean; suspendedAccount: SecuritySuspendedAccount }>(
      '/api/security/actions/reactivate-account',
      { method: 'POST', body: JSON.stringify(payload) },
      overrideActorId
    );
  },

  revokeSession(sessionId: string, reason: string, overrideActorId?: string) {
    return securityFetch<{ success: boolean; session: SecurityActiveSession }>(
      '/api/security/actions/revoke-session',
      { method: 'POST', body: JSON.stringify({ sessionId, reason }) },
      overrideActorId
    );
  },

  revokeUserSessions(payload: { userEmail?: string; userId?: string; reason: string }, overrideActorId?: string) {
    return securityFetch<{ success: boolean; revokedCount: number }>(
      '/api/security/actions/revoke-user-sessions',
      { method: 'POST', body: JSON.stringify(payload) },
      overrideActorId
    );
  },

  requireReauth(payload: { userEmail?: string; userId?: string; reason: string }, overrideActorId?: string) {
    return securityFetch<{ success: boolean; updatedCount: number }>(
      '/api/security/actions/require-reauth',
      { method: 'POST', body: JSON.stringify(payload) },
      overrideActorId
    );
  },

  // Incidents
  getIncidents() {
    return securityFetch<{ success: boolean; incidents: SecurityIncidentRecord[] }>('/api/security/incidents');
  },

  reportCompromisedAccount(payload: {
    accountId?: string;
    accountName?: string;
    accountEmail: string;
    accountType?: string;
    summary: string;
    blockedOperations?: SensitiveOperationType[];
    forcePasswordReset?: boolean;
  }) {
    return securityFetch<{ success: boolean; incident: SecurityIncidentRecord }>(
      '/api/security/incidents/compromised',
      { method: 'POST', body: JSON.stringify(payload) }
    );
  },

  forcePasswordReset(payload: { accountId?: string; accountEmail: string; reason: string }) {
    return securityFetch<{ success: boolean; incident: SecurityIncidentRecord }>(
      '/api/security/incidents/force-password-reset',
      { method: 'POST', body: JSON.stringify(payload) }
    );
  },

  // Financial protection
  getFinanceLedger() {
    return securityFetch<{
      success: boolean;
      entries: FinanceLedgerEntry[];
      calculatedBalances: Record<string, number>;
      knownPayoutTargets: Record<string, string[]>;
    }>('/api/finance/ledger');
  },

  validateWithdrawal(payload: {
    accountId?: string;
    amountFcfa: number;
    channel: string;
    payoutTarget: string;
    declaredBalanceFcfa?: number;
    reauthConfirmed?: boolean;
  }) {
    return securityFetch<{
      success: boolean;
      heldForVerification: boolean;
      suspicionReasons: string[];
      entry: FinanceLedgerEntry;
      newBalanceFcfa: number;
      message: string;
    }>('/api/finance/withdraw', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  reviewSuspiciousWithdrawal(entryId: string, decision: 'approve' | 'reject', note: string, stepUpCode?: string) {
    return securityFetch<{ success: boolean; entry: FinanceLedgerEntry }>(
      `/api/finance/suspicious/${encodeURIComponent(entryId)}/review`,
      { method: 'POST', body: JSON.stringify({ decision, note }) },
      undefined,
      stepUpCode
    );
  },

  // Settings
  getSettings(overrideActorId?: string) {
    return securityFetch<{ success: boolean; settings: SecuritySettings }>('/api/security/settings', {}, overrideActorId);
  },

  updateSettings(patch: Partial<SecuritySettings>, overrideActorId?: string, stepUpCode?: string) {
    return securityFetch<{ success: boolean; settings: SecuritySettings }>(
      '/api/security/settings',
      { method: 'PATCH', body: JSON.stringify(patch) },
      overrideActorId,
      stepUpCode
    );
  },

  // Permissions & Staff
  getPermissions(overrideActorId?: string) {
    return securityFetch<{ success: boolean; staff: SecurityStaffMember[] }>('/api/security/permissions', {}, overrideActorId);
  },

  createStaffMember(
    payload: { name: string; email: string; role: SecurityRole; title: string },
    stepUpCode?: string
  ) {
    return securityFetch<{ success: boolean; member: SecurityStaffMember }>(
      '/api/security/staff',
      { method: 'POST', body: JSON.stringify(payload) },
      undefined,
      stepUpCode
    );
  },

  updateStaffPermissions(
    staffId: string,
    payload: { role?: SecurityRole; active?: boolean; permissions?: Partial<Record<SecurityPermissionKey, boolean>> },
    overrideActorId?: string,
    stepUpCode?: string
  ) {
    return securityFetch<{ success: boolean; member: SecurityStaffMember }>(
      `/api/security/permissions/${encodeURIComponent(staffId)}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      overrideActorId,
      stepUpCode
    );
  },

  // Protected Audit Log & Target History
  getAuditLogs(overrideActorId?: string) {
    return securityFetch<{
      success: boolean;
      integrity: { valid: boolean; totalEntries: number; brokenAtSeq?: number; lastHash: string };
      logs: ProtectedAuditEntry[];
    }>('/api/security/audit-logs', {}, overrideActorId);
  },

  // Centralized Activity Log (12 categories, 5 spaces, pagination, detail, export, backup)
  async recordActivity(payload: {
    category: ActivityCategory;
    action: string;
    actionType?: string;
    target: string;
    targetType?: ProtectedAuditEntry['targetType'];
    entityType?: string;
    entityId?: string;
    space?: ActivitySpace;
    actorId?: string;
    actorName?: string;
    actorAccountLabel?: string;
    result?: ActivityResultStatus;
    severity?: AlertSeverityLevel;
    reason?: string;
    beforeValue?: string | null;
    afterValue?: string | null;
    details?: string;
    financialTrace?: FinancialTraceDetails;
    dedupKey?: string;
  }): Promise<{ success: boolean; entry?: ProtectedAuditEntry }> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (payload.dedupKey) {
        headers['X-Idempotency-Key'] = payload.dedupKey;
      }
      const token = getSecurityToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch('/api/activity/log', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      return await res.json().catch(() => ({ success: false }));
    } catch {
      return { success: false };
    }
  },

  async getActivityLogs(filters: ActivityLogQueryParams = {}, overrideActorId?: string): Promise<ActivityLogPageResponse> {
    await this.ensureAdminSessionIfMissing();
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.actor) params.set('actor', filters.actor);
    if (filters.role && filters.role !== 'all') params.set('role', filters.role);
    if (filters.space && filters.space !== 'all') params.set('space', filters.space);
    if (filters.actionType && filters.actionType !== 'all') params.set('actionType', filters.actionType);
    if (filters.category && filters.category !== 'all') params.set('category', filters.category);
    if (filters.severity && filters.severity !== 'all') params.set('severity', filters.severity);
    if (filters.result && filters.result !== 'all') params.set('result', filters.result);
    if (filters.ip) params.set('ip', filters.ip);
    if (filters.refId) params.set('refId', filters.refId);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    return securityFetch<ActivityLogPageResponse>(`/api/activity/logs?${params.toString()}`, {}, overrideActorId);
  },

  async getActivityDetail(id: string): Promise<ActivityDetailResponse> {
    await this.ensureAdminSessionIfMissing();
    return securityFetch<ActivityDetailResponse>(`/api/activity/logs/${encodeURIComponent(id)}`);
  },

  async exportActivityLogs(
    format: 'csv' | 'pdf',
    filters: ActivityLogQueryParams = {}
  ): Promise<{
    success: boolean;
    format: 'csv' | 'pdf';
    filename: string;
    exportedCount: number;
    csvContent?: string;
    generatedAt?: string;
    generatedBy?: string;
    integrity?: { valid: boolean; totalEntries: number; lastHash: string };
    rows?: ProtectedAuditEntry[];
  }> {
    await this.ensureAdminSessionIfMissing();
    return securityFetch('/api/activity/export', {
      method: 'POST',
      body: JSON.stringify({ format, filters })
    });
  },

  async createActivityBackup(): Promise<{
    success: boolean;
    backupFileName: string;
    checksum: string;
    createdAt: string;
    totalEntries: number;
  }> {
    await this.ensureAdminSessionIfMissing();
    return securityFetch('/api/activity/backup', {
      method: 'POST',
      body: JSON.stringify({})
    });
  },

  getTargetHistory(target: string, overrideActorId?: string) {
    return securityFetch<{
      success: boolean;
      actorSummary?: ActorSummaryInfo | null;
      logins: SecurityLoginLog[];
      intrusions: SecurityIntrusionEvent[];
      alerts: SecurityAlert[];
      incidents: SecurityIncidentRecord[];
      finance: FinanceLedgerEntry[];
      audit: ProtectedAuditEntry[];
    }>(`/api/security/target-history?target=${encodeURIComponent(target)}`, {}, overrideActorId);
  },

  // Role space isolation verification helper (for live diagnostics if needed)
  verifySpaceIsolation(space: PlatformSpaceRole, targetId: string) {
    if (space === 'client') return securityFetch(`/api/spaces/client/${encodeURIComponent(targetId)}/account`);
    if (space === 'seller') return securityFetch(`/api/spaces/seller/${encodeURIComponent(targetId)}/wallet`);
    return securityFetch(`/api/security/overview`);
  },

  // =========================================================================
  // CENTRALIZED ADMIN NOTIFICATIONS & REAL-TIME STREAM
  // =========================================================================

  async getAdminNotifications(params: AdminNotificationQueryParams = {}): Promise<AdminNotificationPageResponse> {
    await this.ensureAdminSessionIfMissing();
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.category && params.category !== 'all') qs.set('category', params.category);
    if (params.priority && params.priority !== 'all') qs.set('priority', params.priority);
    if (params.space && params.space !== 'all') qs.set('space', params.space);
    if (params.status && params.status !== 'all') qs.set('status', params.status);
    if (params.unreadOnly) qs.set('unreadOnly', 'true');
    if (params.archived) qs.set('archived', params.archived);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    return securityFetch<AdminNotificationPageResponse>(`/api/admin/notifications?${qs.toString()}`);
  },

  async getAdminNotificationDetail(id: string): Promise<AdminNotificationDetailResponse> {
    await this.ensureAdminSessionIfMissing();
    return securityFetch<AdminNotificationDetailResponse>(`/api/admin/notifications/${encodeURIComponent(id)}`);
  },

  async markAdminNotificationRead(id: string, read = true): Promise<{ success: boolean; notification: AdminNotificationRecord }> {
    await this.ensureAdminSessionIfMissing();
    return securityFetch(`/api/admin/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PATCH',
      body: JSON.stringify({ read })
    });
  },

  async markAllAdminNotificationsRead(): Promise<{ success: boolean; markedCount: number }> {
    await this.ensureAdminSessionIfMissing();
    return securityFetch('/api/admin/notifications/read-all', {
      method: 'POST',
      body: JSON.stringify({})
    });
  },

  async archiveAdminNotification(id: string, archived = true): Promise<{ success: boolean; notification: AdminNotificationRecord }> {
    await this.ensureAdminSessionIfMissing();
    return securityFetch(`/api/admin/notifications/${encodeURIComponent(id)}/archive`, {
      method: 'PATCH',
      body: JSON.stringify({ archived })
    });
  },

  async assignAdminNotification(id: string, assigneeId: string): Promise<{ success: boolean; notification: AdminNotificationRecord }> {
    await this.ensureAdminSessionIfMissing();
    return securityFetch(`/api/admin/notifications/${encodeURIComponent(id)}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assigneeId })
    });
  },

  async updateAdminNotificationStatus(
    id: string,
    payload: { status?: AdminNotificationStatus; comment?: string }
  ): Promise<{ success: boolean; notification: AdminNotificationRecord }> {
    await this.ensureAdminSessionIfMissing();
    return securityFetch(`/api/admin/notifications/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  async escalateAdminNotification(id: string, reason: string): Promise<{ success: boolean; notification: AdminNotificationRecord }> {
    await this.ensureAdminSessionIfMissing();
    return securityFetch(`/api/admin/notifications/${encodeURIComponent(id)}/escalate`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  async getAdminNotificationPreferences(): Promise<{
    success: boolean;
    staffId: string;
    role: SecurityRole;
    criticalSecurityLocked: boolean;
    preferences: AdminNotificationPreferences;
  }> {
    await this.ensureAdminSessionIfMissing();
    return securityFetch('/api/admin/notifications/preferences');
  },

  async updateAdminNotificationPreferences(preferences: Partial<AdminNotificationPreferences>): Promise<{
    success: boolean;
    staffId: string;
    role: SecurityRole;
    criticalSecurityLocked: boolean;
    preferences: AdminNotificationPreferences;
  }> {
    await this.ensureAdminSessionIfMissing();
    return securityFetch('/api/admin/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify({ preferences })
    });
  },

  async getNotificationChannelsStatus(): Promise<{ success: boolean; channels: NotificationChannelsStatus }> {
    await this.ensureAdminSessionIfMissing();
    return securityFetch('/api/admin/notifications/channels-status');
  },

  async registerPushSubscription(endpoint: string): Promise<{
    success: boolean;
    subscriptionsCount: number;
    channels: NotificationChannelsStatus;
  }> {
    await this.ensureAdminSessionIfMissing();
    return securityFetch('/api/admin/notifications/push-subscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint })
    });
  },

  connectAdminNotificationStream(
    onEvent: (event: {
      type: string;
      notification?: AdminNotificationRecord;
      actorId?: string;
      at?: string;
    }) => void,
    onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected') => void
  ): () => void {
    let closedByCaller = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    const connect = async () => {
      if (closedByCaller) return;
      onStatusChange?.('connecting');
      await this.ensureAdminSessionIfMissing();
      const token = getSecurityToken();
      if (!token || closedByCaller) {
        onStatusChange?.('disconnected');
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/admin/notifications/stream?token=${encodeURIComponent(token)}`;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        onStatusChange?.('disconnected');
        return;
      }

      ws.onopen = () => {
        onStatusChange?.('connected');
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          onEvent(data);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        onStatusChange?.('disconnected');
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
        if (!closedByCaller) {
          reconnectTimer = setTimeout(() => {
            void connect();
          }, 3000);
        }
      };

      ws.onerror = () => {
        onStatusChange?.('disconnected');
      };
    };

    void connect();

    return () => {
      closedByCaller = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
    };
  },

  // =========================================================================
  // ADMIN CONTROL PLANE (Settings, Vaulted Providers, Campaigns, Approvals, Quotas)
  // =========================================================================
  getControlPlaneSettings() {
    return securityFetch<{ success: boolean; settings: Record<string, any>; history: any[] }>('/api/admin/control-plane/settings');
  },

  updateControlPlaneSetting(key: string, value: unknown, reason?: string) {
    return securityFetch<{ success: boolean; key: string; setting: any }>('/api/admin/control-plane/settings', {
      method: 'PATCH',
      body: JSON.stringify({ key, value, reason })
    });
  },

  getControlPlaneProviders() {
    return securityFetch<{ success: boolean; providers: any[] }>('/api/admin/control-plane/providers');
  },

  updateControlPlaneProvider(
    providerKey: string,
    payload: {
      displayName?: string;
      serviceType?: string;
      status?: 'disabled' | 'sandbox' | 'active' | 'degraded';
      apiKey?: string;
      publicConfig?: Record<string, unknown>;
      monthlyLimitFcfa?: number | null;
      alertThresholdPercent?: number;
    }
  ) {
    return securityFetch<{ success: boolean; provider: any }>(
      `/api/admin/control-plane/providers/${encodeURIComponent(providerKey)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload)
      }
    );
  },

  getControlPlaneCampaigns() {
    return securityFetch<{ success: boolean; campaigns: any[] }>('/api/admin/control-plane/campaigns');
  },

  createControlPlaneCampaign(payload: {
    campaignType?: 'promotion' | 'advertising';
    name: string;
    status?: string;
    promoCode?: string;
    discountType?: 'fixed' | 'percent';
    discountValue?: number;
    minSubtotalFcfa?: number;
    maxDiscountFcfa?: number;
    budgetFcfa?: number;
    description?: string;
  }) {
    return securityFetch<{ success: boolean; campaign: any }>('/api/admin/control-plane/campaigns', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  updateControlPlaneCampaign(id: string, patch: Record<string, unknown>) {
    return securityFetch<{ success: boolean; campaign: any }>(
      `/api/admin/control-plane/campaigns/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch)
      }
    );
  },

  getControlPlaneApprovals() {
    return securityFetch<{ success: boolean; approvals: any[] }>('/api/admin/control-plane/approvals');
  },

  requestControlPlaneApproval(payload: {
    actionKey: string;
    resourceType: string;
    resourceId: string;
    requestPayload?: Record<string, unknown>;
  }) {
    return securityFetch<{ success: boolean; approval: any }>('/api/admin/control-plane/approvals', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  decideControlPlaneApproval(id: string, decision: 'approved' | 'rejected', reason?: string) {
    return securityFetch<{ success: boolean; approval: any }>(
      `/api/admin/control-plane/approvals/${encodeURIComponent(id)}/decide`,
      {
        method: 'POST',
        body: JSON.stringify({ decision, reason })
      }
    );
  },

  getControlPlaneQuotas() {
    return securityFetch<{ success: boolean; quotas: any }>('/api/admin/control-plane/quotas');
  },

  updateControlPlaneQuotas(patch: Record<string, unknown>) {
    return securityFetch<{ success: boolean; quotas: any }>('/api/admin/control-plane/quotas', {
      method: 'PATCH',
      body: JSON.stringify(patch)
    });
  }
};

