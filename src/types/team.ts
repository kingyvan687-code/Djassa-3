export type AdminTeamRoleKey =
  | 'super_admin'
  | 'general_admin'
  | 'finance_admin'
  | 'orders_admin'
  | 'disputes_admin'
  | 'users_admin'
  | 'security_admin'
  | 'tech_admin';

export type TeamPermissionLevel = 'none' | 'read' | 'write' | 'approve' | 'admin';

export type TeamModuleKey =
  | 'dashboard'
  | 'users'
  | 'sellers'
  | 'drivers'
  | 'companies'
  | 'orders'
  | 'deliveries'
  | 'disputes'
  | 'refunds'
  | 'transactions'
  | 'wallets'
  | 'withdrawals'
  | 'finances'
  | 'security'
  | 'activity_log'
  | 'api_providers'
  | 'maintenance'
  | 'backups'
  | 'notifications'
  | 'settings';

export type TeamAccountStatus = 'active' | 'invited' | 'suspended' | 'deactivated';

export interface TeamSpecialPermissions {
  canManageTeam: boolean;
  canApproveAboveThreshold: boolean;
  canRevokeSessions: boolean;
  canExportSensitiveData: boolean;
  canManageSecurityRules: boolean;
}

export type TeamPermissionsMatrix = Record<TeamModuleKey, TeamPermissionLevel>;

export interface TeamRoleDefinition {
  key: AdminTeamRoleKey;
  label: string;
  shortLabel: string;
  department: string;
  description: string;
  reservedToOwner: boolean;
  securityRoleMapped: 'super_admin' | 'admin' | 'security_agent' | 'other_agent';
  defaultMatrix: TeamPermissionsMatrix;
  defaultSpecial: TeamSpecialPermissions;
}

export interface TeamAdminMemberPublic {
  id: string;
  professionalId: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  role: AdminTeamRoleKey;
  roleLabel: string;
  department: string;
  status: TeamAccountStatus;
  mfaEnabled: boolean;
  mustSetPassword: boolean;
  hasPasswordSet: boolean;
  permissions: TeamPermissionsMatrix;
  specialPermissions: TeamSpecialPermissions;
  permissionsUpdatedAt: string;
  permissionsUpdatedBy: string;
  createdAt: string;
  createdById: string;
  createdByName: string;
  activatedAt: string | null;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  lastLoginDevice: string | null;
  suspendedAt: string | null;
  suspendedUntil: string | null;
  suspensionReason: string | null;
  deactivatedAt: string | null;
  deactivatedReason: string | null;
  activeSessionsCount: number;
  isCurrentlyConnected: boolean;
  pendingInvitation?: {
    id: string;
    expiresAt: string;
    sentAt: string;
    status: 'pending' | 'accepted' | 'expired' | 'revoked';
    tokenPreview?: string;
  } | null;
}

export interface TeamInvitationPublic {
  id: string;
  adminId: string;
  professionalId: string;
  fullName: string;
  email: string;
  role: AdminTeamRoleKey;
  roleLabel: string;
  department: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  createdAt: string;
  sentAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdByName: string;
  tokenPreview: string;
}

export interface TeamActivityJournalEntry {
  id: string;
  seq: number;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorProfessionalId: string;
  actorRole: AdminTeamRoleKey | 'system';
  actionType: string;
  action: string;
  module: TeamModuleKey | 'team';
  targetAdminId?: string;
  targetName: string;
  result: 'reussi' | 'refuse' | 'bloque' | 'echoue';
  severity: 'information' | 'faible' | 'moyen' | 'eleve' | 'critique';
  ipAddress: string;
  device: string;
  sessionId?: string;
  beforeValue?: string | null;
  afterValue?: string | null;
  details: string;
  immutableHash: string;
}

export type TeamNotificationType =
  | 'admin_created'
  | 'invitation_sent'
  | 'invitation_accepted'
  | 'invitation_expired'
  | 'role_changed'
  | 'permissions_changed'
  | 'suspicious_login'
  | 'account_suspended'
  | 'account_reactivated'
  | 'session_revoked'
  | 'unauthorized_access'
  | 'financial_validation';

export interface TeamNotificationItem {
  id: string;
  type: TeamNotificationType;
  priority: 'information' | 'moyen' | 'eleve' | 'critique';
  title: string;
  message: string;
  timestamp: string;
  actorName: string;
  targetAdminId?: string;
  targetName?: string;
  read: boolean;
  readAt: string | null;
}

export interface TeamFinancialValidationRequest {
  id: string;
  reference: string;
  operationType: 'remboursement' | 'indemnisation' | 'retrait_vendeur' | 'ajustement_financier';
  title: string;
  amountFcfa: number;
  thresholdAppliedFcfa: number;
  requiresSuperAdmin: boolean;
  preparedById: string;
  preparedByName: string;
  preparedByRole: AdminTeamRoleKey;
  preparedAt: string;
  approvedStandardById?: string | null;
  approvedStandardByName?: string | null;
  approvedStandardAt?: string | null;
  finalValidatedById?: string | null;
  finalValidatedByName?: string | null;
  finalValidatedAt?: string | null;
  rejectedById?: string | null;
  rejectedByName?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  status: 'prepared' | 'awaiting_super_admin' | 'approved' | 'rejected';
  note: string;
  history: {
    at: string;
    actorId: string;
    actorName: string;
    actorRole: string;
    action: string;
    note: string;
  }[];
}

export interface TeamModuleSettings {
  standardFinancialApprovalLimitFcfa: number;
  superAdminRequiredAboveFcfa: number;
  invitationValidityHours: number;
  requireMfaForSensitiveTeamActions: boolean;
  blockSelfPermissionEscalation: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface TeamDashboardKpis {
  totalAdmins: number;
  superAdminsCount: number;
  activeAdmins: number;
  suspendedAdmins: number;
  deactivatedAdmins: number;
  pendingInvitations: number;
  currentlyConnectedAdmins: number;
  activeAdminSessions: number;
  pendingFinancialValidations: number;
  unreadTeamNotifications: number;
}

export interface TeamLoginLogItem {
  id: string;
  accountId: string;
  accountName: string;
  accountEmail: string;
  ipAddress: string;
  device: string;
  browser: string;
  os: string;
  location: string | null;
  timestamp: string;
  status: 'reussite' | 'echec' | 'suspect';
  isNewDevice?: boolean;
  reason?: string;
}

export interface TeamActiveSessionItem {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  device: string;
  browser: string;
  os: string;
  location: string | null;
  ipAddress: string;
  startedAt: string;
  lastActivityAt: string;
  expiresAt: string;
  status: string;
  isNewDevice?: boolean;
}

export interface TeamOverviewResponse {
  success: boolean;
  currentActor: {
    id: string;
    name: string;
    email: string;
    securityRole: string;
    teamRole: AdminTeamRoleKey;
    permissions: TeamPermissionsMatrix;
    specialPermissions: TeamSpecialPermissions;
  };
  kpis: TeamDashboardKpis;
  admins: TeamAdminMemberPublic[];
  invitations: TeamInvitationPublic[];
  roles: TeamRoleDefinition[];
  modulesMeta: { key: TeamModuleKey; label: string; group: string }[];
  permissionLevelsMeta: { key: TeamPermissionLevel; rank: number; label: string; description: string }[];
  latestLogins: TeamLoginLogItem[];
  activeSessions: TeamActiveSessionItem[];
  recentActivities: TeamActivityJournalEntry[];
  notifications: TeamNotificationItem[];
  financialValidations: TeamFinancialValidationRequest[];
  settings: TeamModuleSettings;
}

export interface TeamMemberDetailResponse {
  success: boolean;
  admin: TeamAdminMemberPublic;
  loginHistory: TeamLoginLogItem[];
  activeSessions: TeamActiveSessionItem[];
  devicesUsed: { device: string; browser: string; os: string; lastIp: string; lastSeenAt: string }[];
  activities: TeamActivityJournalEntry[];
  financialDecisions: TeamFinancialValidationRequest[];
  invitationsHistory: TeamInvitationPublic[];
}
