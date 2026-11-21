import type { Express, NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { atomicWriteJsonFile } from './atomicFileStore';
import {
  appendAuditEntry,
  authenticateSessionRequest,
  createVerifiedStaffSessionInSecurityDb,
  getAdminTeamSecurityTelemetry,
  getClientIp,
  parseUserAgent,
  recordFailedAdminLoginInSecurityDb,
  redactSensitiveText,
  revokeSessionsForStaffInSecurityDb,
  setStaffActiveStateInSecurityDb,
  syncStaffMemberInSecurityDb,
  verifyStepUpMfaForRequest,
  type AuthenticatedRequestContext,
  type SecurityPermissionKey,
  type SecurityRole
} from './securityModule';
import type {
  AdminTeamRoleKey,
  TeamAccountStatus,
  TeamActivityJournalEntry,
  TeamAdminMemberPublic,
  TeamDashboardKpis,
  TeamFinancialValidationRequest,
  TeamInvitationPublic,
  TeamMemberDetailResponse,
  TeamModuleKey,
  TeamModuleSettings,
  TeamNotificationItem,
  TeamNotificationType,
  TeamOverviewResponse,
  TeamPermissionLevel,
  TeamPermissionsMatrix,
  TeamRoleDefinition,
  TeamSpecialPermissions
} from '../src/types/team';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const TEAM_DB_FILE = path.join(DATA_DIR, 'team_db.json');
const DJASSA_DB_FILE = path.join(DATA_DIR, 'db.json');

export const TEAM_MODULES_META: { key: TeamModuleKey; label: string; group: string }[] = [
  { key: 'dashboard', label: 'Tableau de bord', group: 'Supervision' },
  { key: 'users', label: 'Utilisateurs', group: 'Acteurs' },
  { key: 'sellers', label: 'Vendeurs', group: 'Acteurs' },
  { key: 'drivers', label: 'Livreurs', group: 'Acteurs' },
  { key: 'companies', label: 'Entreprises de livraison', group: 'Acteurs' },
  { key: 'orders', label: 'Commandes', group: 'Opérations' },
  { key: 'deliveries', label: 'Livraisons', group: 'Opérations' },
  { key: 'disputes', label: 'Réclamations', group: 'Support & Litiges' },
  { key: 'refunds', label: 'Remboursements', group: 'Finance' },
  { key: 'transactions', label: 'Transactions', group: 'Finance' },
  { key: 'wallets', label: 'Portefeuilles', group: 'Finance' },
  { key: 'withdrawals', label: 'Retraits', group: 'Finance' },
  { key: 'finances', label: 'Finances', group: 'Finance' },
  { key: 'security', label: 'Sécurité', group: 'Sécurité & Audit' },
  { key: 'activity_log', label: 'Journal d’activité', group: 'Sécurité & Audit' },
  { key: 'api_providers', label: 'API et fournisseurs', group: 'Technique' },
  { key: 'maintenance', label: 'Maintenance et versions', group: 'Technique' },
  { key: 'backups', label: 'Sauvegardes', group: 'Technique' },
  { key: 'notifications', label: 'Notifications', group: 'Administration' },
  { key: 'settings', label: 'Paramètres', group: 'Administration' }
];

export const PERMISSION_LEVEL_RANK: Record<TeamPermissionLevel, number> = {
  none: 0,
  read: 1,
  write: 2,
  approve: 3,
  admin: 4
};

export const PERMISSION_LEVELS_META: {
  key: TeamPermissionLevel;
  rank: number;
  label: string;
  description: string;
}[] = [
  { key: 'none', rank: 0, label: 'Aucun accès', description: 'Module invisible et requêtes API bloquées' },
  { key: 'read', rank: 1, label: 'Consultation uniquement', description: 'Lecture des données et rapports sans écriture' },
  { key: 'write', rank: 2, label: 'Consultation et modification', description: 'Lecture, création et mise à jour standard' },
  { key: 'approve', rank: 3, label: 'Validation et approbation', description: 'Approbation des dossiers et opérations sous seuil' },
  { key: 'admin', rank: 4, label: 'Administration du module', description: 'Contrôle total et configuration du module' }
];

function buildMatrix(overrides: Partial<TeamPermissionsMatrix>, fallback: TeamPermissionLevel = 'none'): TeamPermissionsMatrix {
  const base = {} as TeamPermissionsMatrix;
  for (const mod of TEAM_MODULES_META) {
    base[mod.key] = overrides[mod.key] ?? fallback;
  }
  return base;
}

export const TEAM_ROLE_DEFINITIONS: TeamRoleDefinition[] = [
  {
    key: 'super_admin',
    label: 'Super Administrateur',
    shortLabel: 'Super Admin',
    department: 'Direction Générale DJASSA',
    description:
      'Contrôle global exclusif de DJASSA : gestion de l’équipe admin, permissions, finances sensibles, sécurité et paramètres généraux. Réservé au propriétaire principal.',
    reservedToOwner: true,
    securityRoleMapped: 'super_admin',
    defaultMatrix: buildMatrix({}, 'admin'),
    defaultSpecial: {
      canManageTeam: true,
      canApproveAboveThreshold: true,
      canRevokeSessions: true,
      canExportSensitiveData: true,
      canManageSecurityRules: true
    }
  },
  {
    key: 'general_admin',
    label: 'Administrateur général',
    shortLabel: 'Admin Général',
    department: 'Direction des Opérations',
    description:
      'Supervision globale des activités, tableaux de bord, suivi des services, coordination des opérations administratives et des équipes.',
    reservedToOwner: false,
    securityRoleMapped: 'admin',
    defaultMatrix: buildMatrix({
      dashboard: 'admin',
      users: 'write',
      sellers: 'write',
      drivers: 'write',
      companies: 'write',
      orders: 'approve',
      deliveries: 'approve',
      disputes: 'approve',
      refunds: 'read',
      transactions: 'read',
      wallets: 'read',
      withdrawals: 'read',
      finances: 'read',
      security: 'read',
      activity_log: 'read',
      api_providers: 'read',
      maintenance: 'read',
      backups: 'read',
      notifications: 'write',
      settings: 'read'
    }),
    defaultSpecial: {
      canManageTeam: false,
      canApproveAboveThreshold: false,
      canRevokeSessions: false,
      canExportSensitiveData: true,
      canManageSecurityRules: false
    }
  },
  {
    key: 'finance_admin',
    label: 'Administrateur financier',
    shortLabel: 'Admin Financier',
    department: 'Finance & Trésorerie',
    description:
      'Gestion des transactions, commissions, portefeuilles, retraits, remboursements, indemnisations, historique financier et rapports de revenus.',
    reservedToOwner: false,
    securityRoleMapped: 'admin',
    defaultMatrix: buildMatrix({
      dashboard: 'read',
      users: 'read',
      sellers: 'read',
      drivers: 'read',
      companies: 'read',
      orders: 'read',
      deliveries: 'none',
      disputes: 'read',
      refunds: 'approve',
      transactions: 'approve',
      wallets: 'write',
      withdrawals: 'approve',
      finances: 'admin',
      security: 'none',
      activity_log: 'read',
      api_providers: 'read',
      maintenance: 'none',
      backups: 'none',
      notifications: 'write',
      settings: 'read'
    }),
    defaultSpecial: {
      canManageTeam: false,
      canApproveAboveThreshold: false,
      canRevokeSessions: false,
      canExportSensitiveData: true,
      canManageSecurityRules: false
    }
  },
  {
    key: 'orders_admin',
    label: 'Administrateur des commandes',
    shortLabel: 'Admin Commandes',
    department: 'Logistique & Commandes',
    description:
      'Gestion des commandes, colis, suivi des livraisons, annulations, incidents de livraison et suivi opérationnel des vendeurs et livreurs impliqués.',
    reservedToOwner: false,
    securityRoleMapped: 'admin',
    defaultMatrix: buildMatrix({
      dashboard: 'read',
      users: 'read',
      sellers: 'read',
      drivers: 'write',
      companies: 'write',
      orders: 'admin',
      deliveries: 'admin',
      disputes: 'write',
      refunds: 'read',
      transactions: 'read',
      wallets: 'none',
      withdrawals: 'none',
      finances: 'none',
      security: 'none',
      activity_log: 'read',
      api_providers: 'none',
      maintenance: 'none',
      backups: 'none',
      notifications: 'write',
      settings: 'none'
    }),
    defaultSpecial: {
      canManageTeam: false,
      canApproveAboveThreshold: false,
      canRevokeSessions: false,
      canExportSensitiveData: false,
      canManageSecurityRules: false
    }
  },
  {
    key: 'disputes_admin',
    label: 'Administrateur des réclamations',
    shortLabel: 'Admin Réclamations',
    department: 'Médiation & Litiges',
    description:
      'Traitement des réclamations et litiges, investigation, vérification des preuves, médiation et coordination des remboursements avec le service financier.',
    reservedToOwner: false,
    securityRoleMapped: 'other_agent',
    defaultMatrix: buildMatrix({
      dashboard: 'read',
      users: 'read',
      sellers: 'read',
      drivers: 'read',
      companies: 'read',
      orders: 'read',
      deliveries: 'read',
      disputes: 'admin',
      refunds: 'write',
      transactions: 'read',
      wallets: 'none',
      withdrawals: 'none',
      finances: 'none',
      security: 'none',
      activity_log: 'read',
      api_providers: 'none',
      maintenance: 'none',
      backups: 'none',
      notifications: 'write',
      settings: 'none'
    }),
    defaultSpecial: {
      canManageTeam: false,
      canApproveAboveThreshold: false,
      canRevokeSessions: false,
      canExportSensitiveData: false,
      canManageSecurityRules: false
    }
  },
  {
    key: 'users_admin',
    label: 'Administrateur des utilisateurs',
    shortLabel: 'Admin Utilisateurs',
    department: 'Conformité & KYC',
    description:
      'Gestion des comptes clients, vendeurs, livreurs et entreprises de livraison, vérification des profils KYC et suspension/réactivation selon permissions.',
    reservedToOwner: false,
    securityRoleMapped: 'admin',
    defaultMatrix: buildMatrix({
      dashboard: 'read',
      users: 'admin',
      sellers: 'admin',
      drivers: 'admin',
      companies: 'admin',
      orders: 'read',
      deliveries: 'read',
      disputes: 'read',
      refunds: 'none',
      transactions: 'none',
      wallets: 'none',
      withdrawals: 'none',
      finances: 'none',
      security: 'read',
      activity_log: 'read',
      api_providers: 'none',
      maintenance: 'none',
      backups: 'none',
      notifications: 'write',
      settings: 'none'
    }),
    defaultSpecial: {
      canManageTeam: false,
      canApproveAboveThreshold: false,
      canRevokeSessions: false,
      canExportSensitiveData: false,
      canManageSecurityRules: false
    }
  },
  {
    key: 'security_admin',
    label: 'Administrateur de sécurité',
    shortLabel: 'Admin Sécurité',
    department: 'Cybersécurité & SOC',
    description:
      'Surveillance des connexions, détection des anomalies et fraudes, gestion des alertes de sécurité, révocation des sessions et blocage d’accès à risque.',
    reservedToOwner: false,
    securityRoleMapped: 'security_agent',
    defaultMatrix: buildMatrix({
      dashboard: 'read',
      users: 'read',
      sellers: 'read',
      drivers: 'read',
      companies: 'read',
      orders: 'read',
      deliveries: 'read',
      disputes: 'read',
      refunds: 'read',
      transactions: 'read',
      wallets: 'read',
      withdrawals: 'read',
      finances: 'read',
      security: 'admin',
      activity_log: 'admin',
      api_providers: 'read',
      maintenance: 'read',
      backups: 'read',
      notifications: 'admin',
      settings: 'read'
    }),
    defaultSpecial: {
      canManageTeam: false,
      canApproveAboveThreshold: false,
      canRevokeSessions: true,
      canExportSensitiveData: true,
      canManageSecurityRules: true
    }
  },
  {
    key: 'tech_admin',
    label: 'Administrateur technique',
    shortLabel: 'Admin Technique',
    department: 'Ingénierie & Infrastructure',
    description:
      'Surveillance système, état des services et API fournisseurs, gestion de la maintenance et des versions, contrôle des sauvegardes et diagnostics.',
    reservedToOwner: false,
    securityRoleMapped: 'admin',
    defaultMatrix: buildMatrix({
      dashboard: 'read',
      users: 'none',
      sellers: 'none',
      drivers: 'none',
      companies: 'none',
      orders: 'none',
      deliveries: 'none',
      disputes: 'none',
      refunds: 'none',
      transactions: 'none',
      wallets: 'none',
      withdrawals: 'none',
      finances: 'none',
      security: 'read',
      activity_log: 'read',
      api_providers: 'admin',
      maintenance: 'admin',
      backups: 'admin',
      notifications: 'write',
      settings: 'write'
    }),
    defaultSpecial: {
      canManageTeam: false,
      canApproveAboveThreshold: false,
      canRevokeSessions: false,
      canExportSensitiveData: false,
      canManageSecurityRules: false
    }
  }
];

interface StoredTeamAdminMember {
  id: string;
  professionalId: string;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  role: AdminTeamRoleKey;
  department: string;
  status: TeamAccountStatus;
  mfaEnabled: boolean;
  mustSetPassword: boolean;
  passwordHash: string | null;
  passwordSalt: string | null;
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
}

interface StoredTeamInvitation {
  id: string;
  adminId: string;
  professionalId: string;
  fullName: string;
  email: string;
  role: AdminTeamRoleKey;
  department: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  tokenHash: string;
  tokenPreview: string;
  createdAt: string;
  sentAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdById: string;
  createdByName: string;
}

interface TeamDatabase {
  admins: StoredTeamAdminMember[];
  invitations: StoredTeamInvitation[];
  journal: TeamActivityJournalEntry[];
  notifications: TeamNotificationItem[];
  financialValidations: TeamFinancialValidationRequest[];
  settings: TeamModuleSettings;
}

const DEFAULT_TEAM_SETTINGS: TeamModuleSettings = {
  standardFinancialApprovalLimitFcfa: 25000,
  superAdminRequiredAboveFcfa: 25000,
  invitationValidityHours: 72,
  requireMfaForSensitiveTeamActions: true,
  blockSelfPermissionEscalation: true,
  updatedAt: new Date().toISOString(),
  updatedBy: 'Kouassi Yves (Super Administrateur)'
};

function hashPassword(plainPassword: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(plainPassword: string, storedHash: string, storedSalt: string): boolean {
  try {
    const derived = crypto.scryptSync(plainPassword, storedSalt, 64);
    const stored = Buffer.from(storedHash, 'hex');
    if (derived.length !== stored.length) return false;
    return crypto.timingSafeEqual(derived, stored);
  } catch {
    return false;
  }
}

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function validateStrongPassword(password: string): { ok: boolean; message: string } {
  if (typeof password !== 'string' || password.length < 8) {
    return { ok: false, message: 'Le mot de passe doit contenir au moins 8 caractères.' };
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return {
      ok: false,
      message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.'
    };
  }
  return { ok: true, message: '' };
}

function getRoleDefinition(roleKey: AdminTeamRoleKey): TeamRoleDefinition {
  return TEAM_ROLE_DEFINITIONS.find((r) => r.key === roleKey) || TEAM_ROLE_DEFINITIONS[1];
}

function computeSecurityPermissionsFromTeam(
  roleKey: AdminTeamRoleKey,
  matrix: TeamPermissionsMatrix,
  special: TeamSpecialPermissions
): Record<SecurityPermissionKey, boolean> {
  if (roleKey === 'super_admin') {
    return {
      viewDashboard: true,
      viewLoginLogs: true,
      viewIntrusions: true,
      viewCyberattacks: true,
      manageAlerts: true,
      executeProtectionActions: true,
      manageSessions: true,
      modifySettings: true,
      managePermissions: true,
      manageFinanceProtection: true,
      manageIncidents: true
    };
  }
  const secRank = PERMISSION_LEVEL_RANK[matrix.security || 'none'];
  const finRank = Math.max(
    PERMISSION_LEVEL_RANK[matrix.finances || 'none'],
    PERMISSION_LEVEL_RANK[matrix.refunds || 'none'],
    PERMISSION_LEVEL_RANK[matrix.withdrawals || 'none']
  );
  return {
    viewDashboard: PERMISSION_LEVEL_RANK[matrix.dashboard || 'none'] >= 1 || secRank >= 1,
    viewLoginLogs: secRank >= 1 || PERMISSION_LEVEL_RANK[matrix.activity_log || 'none'] >= 1,
    viewIntrusions: secRank >= 1,
    viewCyberattacks: secRank >= 2,
    manageAlerts: secRank >= 2 || PERMISSION_LEVEL_RANK[matrix.notifications || 'none'] >= 2,
    executeProtectionActions: secRank >= 3 || special.canManageSecurityRules,
    manageSessions: secRank >= 3 || special.canRevokeSessions,
    modifySettings: PERMISSION_LEVEL_RANK[matrix.settings || 'none'] >= 4,
    managePermissions: false, // STRICTLY reserved to Super Admin
    manageFinanceProtection: finRank >= 2 || secRank >= 2,
    manageIncidents: secRank >= 2
  };
}

function buildSeedAdmins(): StoredTeamAdminMember[] {
  const now = Date.now();
  const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();

  const superDef = getRoleDefinition('super_admin');
  const genDef = getRoleDefinition('general_admin');
  const secDef = getRoleDefinition('security_admin');
  const dispDef = getRoleDefinition('disputes_admin');
  const finDef = getRoleDefinition('finance_admin');

  // Seed initial team aligned with securityDb DEFAULT_STAFF (never auto-creating extra super_admins)
  const superPass = hashPassword(crypto.randomBytes(18).toString('hex'));
  const awaPass = hashPassword(crypto.randomBytes(18).toString('hex'));
  const bambaPass = hashPassword(crypto.randomBytes(18).toString('hex'));
  const mamadouPass = hashPassword(crypto.randomBytes(18).toString('hex'));
  const financePass = hashPassword(crypto.randomBytes(18).toString('hex'));

  return [
    {
      id: 'sec-super-admin',
      professionalId: 'ADM-ROOT-001',
      fullName: 'Kouassi Yves',
      email: 'admin@djassa.ci',
      phone: '+225 07 00 12 34 56',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
      role: 'super_admin',
      department: superDef.department,
      status: 'active',
      mfaEnabled: true,
      mustSetPassword: false,
      passwordHash: superPass.hash,
      passwordSalt: superPass.salt,
      permissions: { ...superDef.defaultMatrix },
      specialPermissions: { ...superDef.defaultSpecial },
      permissionsUpdatedAt: iso(-30 * 86_400_000),
      permissionsUpdatedBy: 'Système DJASSA (Propriétaire)',
      createdAt: iso(-90 * 86_400_000),
      createdById: 'system',
      createdByName: 'Initialisation DJASSA',
      activatedAt: iso(-90 * 86_400_000),
      lastLoginAt: iso(-900_000),
      lastLoginIp: '127.0.0.1',
      lastLoginDevice: 'Ordinateur (Chrome / Linux)',
      suspendedAt: null,
      suspendedUntil: null,
      suspensionReason: null,
      deactivatedAt: null,
      deactivatedReason: null
    },
    {
      id: 'sec-admin-ops',
      professionalId: 'ADM-OPS-002',
      fullName: 'Awa Traoré',
      email: 'awa.traore@djassa.ci',
      phone: '+225 07 48 22 10 90',
      avatarUrl: null,
      role: 'general_admin',
      department: genDef.department,
      status: 'active',
      mfaEnabled: true,
      mustSetPassword: false,
      passwordHash: awaPass.hash,
      passwordSalt: awaPass.salt,
      permissions: { ...genDef.defaultMatrix },
      specialPermissions: { ...genDef.defaultSpecial },
      permissionsUpdatedAt: iso(-15 * 86_400_000),
      permissionsUpdatedBy: 'Kouassi Yves',
      createdAt: iso(-60 * 86_400_000),
      createdById: 'sec-super-admin',
      createdByName: 'Kouassi Yves',
      activatedAt: iso(-60 * 86_400_000),
      lastLoginAt: iso(-7200_000),
      lastLoginIp: '41.202.219.14',
      lastLoginDevice: 'Ordinateur (Edge / Windows)',
      suspendedAt: null,
      suspendedUntil: null,
      suspensionReason: null,
      deactivatedAt: null,
      deactivatedReason: null
    },
    {
      id: 'sec-agent-soc',
      professionalId: 'ADM-SEC-003',
      fullName: 'Bamba Issouf',
      email: 'bamba.sec@djassa.ci',
      phone: '+225 05 64 11 88 20',
      avatarUrl: null,
      role: 'security_admin',
      department: secDef.department,
      status: 'active',
      mfaEnabled: true,
      mustSetPassword: false,
      passwordHash: bambaPass.hash,
      passwordSalt: bambaPass.salt,
      permissions: { ...secDef.defaultMatrix },
      specialPermissions: { ...secDef.defaultSpecial },
      permissionsUpdatedAt: iso(-10 * 86_400_000),
      permissionsUpdatedBy: 'Kouassi Yves',
      createdAt: iso(-45 * 86_400_000),
      createdById: 'sec-super-admin',
      createdByName: 'Kouassi Yves',
      activatedAt: iso(-45 * 86_400_000),
      lastLoginAt: iso(-3600_000),
      lastLoginIp: '154.68.42.19',
      lastLoginDevice: 'Ordinateur (Firefox / Linux)',
      suspendedAt: null,
      suspendedUntil: null,
      suspensionReason: null,
      deactivatedAt: null,
      deactivatedReason: null
    },
    {
      id: 'sec-other-support',
      professionalId: 'ADM-DSP-004',
      fullName: 'Mamadou Diabaté',
      email: 'mamadou.d@djassa.ci',
      phone: '+225 01 42 78 33 11',
      avatarUrl: null,
      role: 'disputes_admin',
      department: dispDef.department,
      status: 'active',
      mfaEnabled: false,
      mustSetPassword: false,
      passwordHash: mamadouPass.hash,
      passwordSalt: mamadouPass.salt,
      permissions: { ...dispDef.defaultMatrix },
      specialPermissions: { ...dispDef.defaultSpecial },
      permissionsUpdatedAt: iso(-5 * 86_400_000),
      permissionsUpdatedBy: 'Kouassi Yves',
      createdAt: iso(-30 * 86_400_000),
      createdById: 'sec-super-admin',
      createdByName: 'Kouassi Yves',
      activatedAt: iso(-30 * 86_400_000),
      lastLoginAt: iso(-18000_000),
      lastLoginIp: '41.202.219.88',
      lastLoginDevice: 'Smartphone Mobile (Chrome / Android)',
      suspendedAt: null,
      suspendedUntil: null,
      suspensionReason: null,
      deactivatedAt: null,
      deactivatedReason: null
    },
    {
      id: 'adm-finance-005',
      professionalId: 'ADM-FIN-005',
      fullName: 'Mariam Koné',
      email: 'mariam.finance@djassa.ci',
      phone: '+225 07 89 45 12 03',
      avatarUrl: null,
      role: 'finance_admin',
      department: finDef.department,
      status: 'active',
      mfaEnabled: true,
      mustSetPassword: false,
      passwordHash: financePass.hash,
      passwordSalt: financePass.salt,
      permissions: { ...finDef.defaultMatrix },
      specialPermissions: { ...finDef.defaultSpecial },
      permissionsUpdatedAt: iso(-3 * 86_400_000),
      permissionsUpdatedBy: 'Kouassi Yves',
      createdAt: iso(-20 * 86_400_000),
      createdById: 'sec-super-admin',
      createdByName: 'Kouassi Yves',
      activatedAt: iso(-20 * 86_400_000),
      lastLoginAt: iso(-10800_000),
      lastLoginIp: '41.202.219.55',
      lastLoginDevice: 'Ordinateur (Chrome / Windows)',
      suspendedAt: null,
      suspendedUntil: null,
      suspensionReason: null,
      deactivatedAt: null,
      deactivatedReason: null
    }
  ];
}

function buildSeedDatabase(): TeamDatabase {
  const admins = buildSeedAdmins();
  const nowIso = new Date().toISOString();
  const db: TeamDatabase = {
    admins,
    invitations: [],
    journal: [
      {
        id: `tjr-${crypto.randomUUID().slice(0, 10)}`,
        seq: 1,
        timestamp: nowIso,
        actorId: 'sec-super-admin',
        actorName: 'Kouassi Yves',
        actorProfessionalId: 'ADM-ROOT-001',
        actorRole: 'super_admin',
        actionType: 'team_module_initialized',
        action: 'Initialisation du registre sécurisé de l’équipe administrateur',
        module: 'team',
        targetName: 'Équipe DJASSA Administrateur',
        result: 'reussi',
        severity: 'information',
        ipAddress: '127.0.0.1',
        device: 'Serveur DJASSA',
        beforeValue: null,
        afterValue: `${admins.length} administrateurs vérifiés`,
        details: 'Registre interne initialisé avec contrôle RBAC 8 rôles × 20 modules.',
        immutableHash: crypto.createHash('sha256').update(`INIT:${nowIso}:${admins.length}`).digest('hex')
      }
    ],
    notifications: [
      {
        id: `tnt-${crypto.randomUUID().slice(0, 10)}`,
        type: 'admin_created',
        priority: 'information',
        title: 'Module Équipe Administrateur opérationnel',
        message: 'La gestion hiérarchique et sécurisée des 8 rôles administratifs est active.',
        timestamp: nowIso,
        actorName: 'Système DJASSA',
        read: false,
        readAt: null
      }
    ],
    financialValidations: [
      {
        id: 'finval-demo-001',
        reference: 'FIN-RBT-2026-089',
        operationType: 'remboursement',
        title: 'Remboursement client commande #CMD-88412 (Montant élevé > seuil)',
        amountFcfa: 68500,
        thresholdAppliedFcfa: DEFAULT_TEAM_SETTINGS.standardFinancialApprovalLimitFcfa,
        requiresSuperAdmin: true,
        preparedById: 'adm-finance-005',
        preparedByName: 'Mariam Koné',
        preparedByRole: 'finance_admin',
        preparedAt: new Date(Date.now() - 5400_000).toISOString(),
        approvedStandardById: null,
        approvedStandardByName: null,
        approvedStandardAt: null,
        finalValidatedById: null,
        finalValidatedByName: null,
        finalValidatedAt: null,
        status: 'awaiting_super_admin',
        note: 'Préparé par Finance Admin — requiert validation finale Super Administrateur (> 25 000 FCFA).',
        history: [
          {
            at: new Date(Date.now() - 5400_000).toISOString(),
            actorId: 'adm-finance-005',
            actorName: 'Mariam Koné',
            actorRole: 'finance_admin',
            action: 'Opération financière préparée et soumise',
            note: 'Montant supérieur au seuil standard : escaladé au Super Administrateur.'
          }
        ]
      }
    ],
    settings: { ...DEFAULT_TEAM_SETTINGS }
  };
  return db;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadTeamDb(): TeamDatabase {
  ensureDataDir();
  if (fs.existsSync(TEAM_DB_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(TEAM_DB_FILE, 'utf8'));
      const admins: StoredTeamAdminMember[] = Array.isArray(parsed.admins) && parsed.admins.length > 0
        ? parsed.admins
        : buildSeedAdmins();
      return {
        admins,
        invitations: Array.isArray(parsed.invitations) ? parsed.invitations : [],
        journal: Array.isArray(parsed.journal) ? parsed.journal : [],
        notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
        financialValidations: Array.isArray(parsed.financialValidations) ? parsed.financialValidations : [],
        settings: { ...DEFAULT_TEAM_SETTINGS, ...(parsed.settings || {}) }
      };
    } catch (err) {
      console.error('[TeamModule] Failed to parse team_db.json, resetting:', err);
    }
  }
  const seeded = buildSeedDatabase();
  persistTeamDb(seeded);
  return seeded;
}

function persistTeamDb(dbObj: TeamDatabase = teamDb) {
  if (!atomicWriteJsonFile(TEAM_DB_FILE, dbObj, { context: 'TeamModule' })) {
    console.error('[TeamModule] Persist failed');
  }
}

let teamDb: TeamDatabase = loadTeamDb();

// Sync all non-seed custom team admins into securityDb.staff on startup so single auth directory stays cohesive
function syncAllTeamAdminsToSecurityStaff() {
  for (const admin of teamDb.admins) {
    const roleDef = getRoleDefinition(admin.role);
    syncStaffMemberInSecurityDb({
      id: admin.id,
      name: admin.fullName,
      email: admin.email,
      role: roleDef.securityRoleMapped,
      title: `${roleDef.label} • ${admin.department}`,
      active: admin.status === 'active',
      mfaEnabled: admin.mfaEnabled,
      permissions: computeSecurityPermissionsFromTeam(admin.role, admin.permissions, admin.specialPermissions),
      createdAt: admin.createdAt
    });
  }
}

syncAllTeamAdminsToSecurityStaff();

function expireOutdatedInvitations(): StoredTeamInvitation[] {
  const now = Date.now();
  const newlyExpired: StoredTeamInvitation[] = [];
  for (const inv of teamDb.invitations) {
    if (inv.status === 'pending' && new Date(inv.expiresAt).getTime() <= now) {
      inv.status = 'expired';
      newlyExpired.push(inv);
    }
  }
  if (newlyExpired.length > 0) {
    for (const inv of newlyExpired) {
      pushTeamNotification({
        type: 'invitation_expired',
        priority: 'moyen',
        title: `Invitation expirée (${inv.fullName})`,
        message: `L’invitation administrateur envoyée à ${inv.email} a expiré sans activation.`,
        actorName: 'Système DJASSA',
        targetAdminId: inv.adminId,
        targetName: inv.fullName
      });
    }
    persistTeamDb();
  }
  return newlyExpired;
}

function appendTeamJournal(params: {
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
}): TeamActivityJournalEntry {
  const prev = teamDb.journal[0];
  const seq = (prev?.seq || 0) + 1;
  const timestamp = new Date().toISOString();
  const rawString = JSON.stringify({
    seq,
    timestamp,
    prevHash: prev?.immutableHash || 'GENESIS',
    actorId: params.actorId,
    actionType: params.actionType,
    target: params.targetName,
    result: params.result
  });
  const entry: TeamActivityJournalEntry = {
    id: `tjr-${crypto.randomUUID().slice(0, 12)}`,
    seq,
    timestamp,
    actorId: params.actorId,
    actorName: params.actorName,
    actorProfessionalId: params.actorProfessionalId,
    actorRole: params.actorRole,
    actionType: params.actionType,
    action: redactSensitiveText(params.action),
    module: params.module,
    targetAdminId: params.targetAdminId,
    targetName: redactSensitiveText(params.targetName),
    result: params.result,
    severity: params.severity,
    ipAddress: params.ipAddress,
    device: params.device,
    sessionId: params.sessionId,
    beforeValue: params.beforeValue ? redactSensitiveText(params.beforeValue) : null,
    afterValue: params.afterValue ? redactSensitiveText(params.afterValue) : null,
    details: redactSensitiveText(params.details),
    immutableHash: crypto.createHash('sha256').update(rawString).digest('hex')
  };
  teamDb.journal.unshift(entry);
  if (teamDb.journal.length > 2500) {
    teamDb.journal = teamDb.journal.slice(0, 2500);
  }
  return entry;
}

function pushTeamNotification(params: {
  type: TeamNotificationType;
  priority: 'information' | 'moyen' | 'eleve' | 'critique';
  title: string;
  message: string;
  actorName: string;
  targetAdminId?: string;
  targetName?: string;
}): TeamNotificationItem {
  const item: TeamNotificationItem = {
    id: `tnt-${crypto.randomUUID().slice(0, 12)}`,
    type: params.type,
    priority: params.priority,
    title: redactSensitiveText(params.title),
    message: redactSensitiveText(params.message),
    timestamp: new Date().toISOString(),
    actorName: params.actorName,
    targetAdminId: params.targetAdminId,
    targetName: params.targetName,
    read: false,
    readAt: null
  };
  teamDb.notifications.unshift(item);
  if (teamDb.notifications.length > 500) {
    teamDb.notifications = teamDb.notifications.slice(0, 500);
  }
  return item;
}

function serializeTeamAdmin(
  admin: StoredTeamAdminMember,
  activeSessionsList: { userId: string; userEmail: string; status: string }[]
): TeamAdminMemberPublic {
  const roleDef = getRoleDefinition(admin.role);
  const emailNorm = admin.email.toLowerCase();
  const matchingSessions = activeSessionsList.filter(
    (s) =>
      (s.status === 'active' || s.status === 'suspect') &&
      (s.userId.toLowerCase() === admin.id.toLowerCase() || s.userEmail.toLowerCase() === emailNorm)
  );
  const pendingInv = teamDb.invitations.find(
    (inv) => inv.adminId === admin.id && inv.status === 'pending'
  );
  // NEVER return passwordHash, passwordSalt, or raw tokenHash
  return {
    id: admin.id,
    professionalId: admin.professionalId,
    fullName: admin.fullName,
    email: admin.email,
    phone: admin.phone,
    avatarUrl: admin.avatarUrl,
    role: admin.role,
    roleLabel: roleDef.label,
    department: admin.department,
    status: admin.status,
    mfaEnabled: admin.mfaEnabled,
    mustSetPassword: admin.mustSetPassword,
    hasPasswordSet: Boolean(admin.passwordHash && admin.passwordSalt),
    permissions: { ...admin.permissions },
    specialPermissions: { ...admin.specialPermissions },
    permissionsUpdatedAt: admin.permissionsUpdatedAt,
    permissionsUpdatedBy: admin.permissionsUpdatedBy,
    createdAt: admin.createdAt,
    createdById: admin.createdById,
    createdByName: admin.createdByName,
    activatedAt: admin.activatedAt,
    lastLoginAt: admin.lastLoginAt,
    lastLoginIp: admin.lastLoginIp,
    lastLoginDevice: admin.lastLoginDevice,
    suspendedAt: admin.suspendedAt,
    suspendedUntil: admin.suspendedUntil,
    suspensionReason: admin.suspensionReason,
    deactivatedAt: admin.deactivatedAt,
    deactivatedReason: admin.deactivatedReason,
    activeSessionsCount: matchingSessions.length,
    isCurrentlyConnected: matchingSessions.length > 0,
    pendingInvitation: pendingInv
      ? {
          id: pendingInv.id,
          expiresAt: pendingInv.expiresAt,
          sentAt: pendingInv.sentAt,
          status: pendingInv.status,
          tokenPreview: pendingInv.tokenPreview
        }
      : null
  };
}

function serializeInvitation(inv: StoredTeamInvitation): TeamInvitationPublic {
  const roleDef = getRoleDefinition(inv.role);
  return {
    id: inv.id,
    adminId: inv.adminId,
    professionalId: inv.professionalId,
    fullName: inv.fullName,
    email: inv.email,
    role: inv.role,
    roleLabel: roleDef.label,
    department: inv.department,
    status: inv.status,
    createdAt: inv.createdAt,
    sentAt: inv.sentAt,
    expiresAt: inv.expiresAt,
    acceptedAt: inv.acceptedAt,
    createdByName: inv.createdByName,
    tokenPreview: inv.tokenPreview
  };
}

function resolveTeamMemberFromAuthCtx(authCtx: AuthenticatedRequestContext): StoredTeamAdminMember | null {
  const emailNorm = (authCtx.token.email || authCtx.staff?.email || '').trim().toLowerCase();
  const staffId = authCtx.staff?.id || authCtx.token.staffId || authCtx.token.uid;
  const found = teamDb.admins.find(
    (a) => a.id === staffId || a.email.toLowerCase() === emailNorm
  );
  if (found) return found;

  // Fallback mapping only for an existing active security staff member without team record yet
  if (authCtx.staff && authCtx.staff.active) {
    const mappedRole: AdminTeamRoleKey =
      authCtx.staff.role === 'super_admin'
        ? 'super_admin'
        : authCtx.staff.role === 'security_agent'
        ? 'security_admin'
        : authCtx.staff.role === 'other_agent'
        ? 'disputes_admin'
        : 'general_admin';
    const def = getRoleDefinition(mappedRole);
    return {
      id: authCtx.staff.id,
      professionalId: `ADM-SEC-${authCtx.staff.id.slice(-4).toUpperCase()}`,
      fullName: authCtx.staff.name,
      email: authCtx.staff.email,
      phone: '',
      avatarUrl: null,
      role: mappedRole,
      department: def.department,
      status: authCtx.staff.active ? 'active' : 'suspended',
      mfaEnabled: authCtx.staff.mfaEnabled,
      mustSetPassword: false,
      passwordHash: null,
      passwordSalt: null,
      permissions: { ...def.defaultMatrix },
      specialPermissions: { ...def.defaultSpecial },
      permissionsUpdatedAt: authCtx.staff.createdAt,
      permissionsUpdatedBy: 'Système',
      createdAt: authCtx.staff.createdAt,
      createdById: 'system',
      createdByName: 'Système',
      activatedAt: authCtx.staff.createdAt,
      lastLoginAt: null,
      lastLoginIp: null,
      lastLoginDevice: null,
      suspendedAt: null,
      suspendedUntil: null,
      suspensionReason: null,
      deactivatedAt: null,
      deactivatedReason: null
    };
  }
  return null;
}

export function hasTeamModulePermission(
  admin: Pick<StoredTeamAdminMember, 'role' | 'status' | 'permissions'> | null | undefined,
  moduleKey: TeamModuleKey,
  minLevel: TeamPermissionLevel
): boolean {
  if (!admin || admin.status !== 'active') return false;
  if (admin.role === 'super_admin') return true;
  const currentLevel = admin.permissions[moduleKey] || 'none';
  return PERMISSION_LEVEL_RANK[currentLevel] >= PERMISSION_LEVEL_RANK[minLevel];
}

function generateNextProfessionalId(): string {
  const year = new Date().getFullYear();
  const count = teamDb.admins.length + 1;
  return `ADM-${year}-${String(count).padStart(3, '0')}`;
}

function isEmailUsedByNonAdminMarketplaceAccount(emailNorm: string): string | null {
  try {
    if (!fs.existsSync(DJASSA_DB_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(DJASSA_DB_FILE, 'utf8')) as Record<string, unknown>;
    const checks: { col: string; label: string }[] = [
      { col: 'users', label: 'Client' },
      { col: 'sellers', label: 'Vendeur' },
      { col: 'drivers', label: 'Livreur' },
      { col: 'companies', label: 'Entreprise de livraison' }
    ];
    for (const c of checks) {
      const arr = raw[c.col];
      if (Array.isArray(arr)) {
        const hit = arr.find(
          (item: Record<string, unknown>) =>
            typeof item?.email === 'string' && item.email.trim().toLowerCase() === emailNorm
        );
        if (hit) return c.label;
      }
    }
  } catch {
    // ignore read failures
  }
  return null;
}

function requireTeamAuth(
  req: Request,
  res: Response,
  options?: {
    requireSuperAdmin?: boolean;
    moduleKey?: TeamModuleKey;
    minLevel?: TeamPermissionLevel;
    requireMfa?: boolean;
  }
): { authCtx: AuthenticatedRequestContext; actorAdmin: StoredTeamAdminMember } | null {
  const authCtx = authenticateSessionRequest(req, res);
  if (!authCtx) return null;

  const ip = getClientIp(req);
  const ua = parseUserAgent(req.header('user-agent'));
  const actorAdmin = resolveTeamMemberFromAuthCtx(authCtx);

  if (!actorAdmin || authCtx.token.spaceRole !== 'admin') {
    res.status(403).json({
      success: false,
      error: 'ADMIN_ACCOUNT_REQUIRED',
      message: 'Accès refusé : compte administrateur DJASSA requis.'
    });
    return null;
  }

  if (actorAdmin.status === 'suspended' || actorAdmin.status === 'deactivated' || actorAdmin.status === 'invited') {
    res.status(403).json({
      success: false,
      error: 'ADMIN_INACTIVE',
      message: `Accès refusé : statut du compte administrateur "${actorAdmin.status}".`
    });
    return null;
  }

  if (options?.requireSuperAdmin && actorAdmin.role !== 'super_admin') {
    appendTeamJournal({
      actorId: actorAdmin.id,
      actorName: actorAdmin.fullName,
      actorProfessionalId: actorAdmin.professionalId,
      actorRole: actorAdmin.role,
      actionType: 'super_admin_only_blocked',
      action: `Action réservée Super Admin refusée (${req.method} ${req.originalUrl})`,
      module: options.moduleKey || 'team',
      targetName: req.originalUrl,
      result: 'refuse',
      severity: 'critique',
      ipAddress: ip,
      device: `${ua.device} (${ua.browser})`,
      sessionId: authCtx.session.sessionId,
      details: `${actorAdmin.fullName} (${actorAdmin.role}) a tenté une opération réservée au Super Administrateur.`
    });
    pushTeamNotification({
      type: 'unauthorized_access',
      priority: 'critique',
      title: 'Tentative d’action Super Admin bloquée',
      message: `${actorAdmin.fullName} (${actorAdmin.role}) a tenté d’exécuter ${req.originalUrl}.`,
      actorName: actorAdmin.fullName,
      targetAdminId: actorAdmin.id,
      targetName: actorAdmin.fullName
    });
    appendAuditEntry({
      actorId: actorAdmin.id,
      actorName: actorAdmin.fullName,
      actorAccountLabel: actorAdmin.email,
      actorRole: actorAdmin.role,
      space: 'admin',
      category: 'security',
      actionType: 'team_super_admin_only_blocked',
      action: 'Action Équipe réservée Super Administrateur bloquée',
      target: req.originalUrl,
      targetType: 'permissions',
      result: 'refuse',
      severity: 'critique',
      details: `Rôle ${actorAdmin.role} bloqué sur ${req.originalUrl}`,
      ipAddress: ip
    });
    persistTeamDb();
    res.status(403).json({
      success: false,
      error: 'SUPER_ADMIN_ONLY',
      message: 'Accès refusé : seul le Super Administrateur principal peut exécuter cette opération.'
    });
    return null;
  }

  if (
    options?.moduleKey &&
    options?.minLevel &&
    !hasTeamModulePermission(actorAdmin, options.moduleKey, options.minLevel)
  ) {
    appendTeamJournal({
      actorId: actorAdmin.id,
      actorName: actorAdmin.fullName,
      actorProfessionalId: actorAdmin.professionalId,
      actorRole: actorAdmin.role,
      actionType: 'module_permission_denied',
      action: `Permission refusée sur module ${options.moduleKey} (requis: ${options.minLevel})`,
      module: options.moduleKey,
      targetName: req.originalUrl,
      result: 'refuse',
      severity: 'eleve',
      ipAddress: ip,
      device: `${ua.device} (${ua.browser})`,
      sessionId: authCtx.session.sessionId,
      beforeValue: actorAdmin.permissions[options.moduleKey],
      afterValue: `Requis: ${options.minLevel}`,
      details: `${actorAdmin.fullName} (${actorAdmin.role}) bloqué faute de permission "${options.minLevel}" sur "${options.moduleKey}".`
    });
    pushTeamNotification({
      type: 'unauthorized_access',
      priority: 'eleve',
      title: 'Accès module refusé',
      message: `${actorAdmin.fullName} n’a pas le niveau "${options.minLevel}" sur le module "${options.moduleKey}".`,
      actorName: actorAdmin.fullName,
      targetAdminId: actorAdmin.id,
      targetName: actorAdmin.fullName
    });
    persistTeamDb();
    res.status(403).json({
      success: false,
      error: 'PERMISSION_DENIED',
      message: `Accès refusé : niveau "${options.minLevel}" requis sur le module "${options.moduleKey}".`
    });
    return null;
  }

  if (options?.requireMfa && teamDb.settings.requireMfaForSensitiveTeamActions) {
    const mfaRes = verifyStepUpMfaForRequest(req, authCtx, true);
    if (!mfaRes.ok) {
      res.status(mfaRes.status).json({
        success: false,
        error: mfaRes.error,
        message: mfaRes.message
      });
      return null;
    }
  }

  return { authCtx, actorAdmin };
}

export function installTeamRoutes(app: Express) {
  // 1. OVERVIEW / DASHBOARD / LIST / ROLES / JOURNAL / NOTIFICATIONS / SETTINGS
  app.get('/api/team/overview', (req: Request, res: Response) => {
    const guard = requireTeamAuth(req, res);
    if (!guard) return;
    const { actorAdmin } = guard;

    expireOutdatedInvitations();

    const adminIds = teamDb.admins.map((a) => a.id);
    const adminEmails = teamDb.admins.map((a) => a.email);
    const secTelemetry = getAdminTeamSecurityTelemetry(adminIds, adminEmails);

    const activeSessions = secTelemetry.sessions
      .filter((s) => s.status === 'active' || s.status === 'suspect')
      .map((s) => ({
        id: s.id,
        sessionId: s.sessionId,
        userId: s.userId,
        userName: s.userName,
        userEmail: s.userEmail,
        device: s.device,
        browser: s.browser,
        os: s.os,
        location: s.location,
        ipAddress: s.ipAddress,
        startedAt: s.startedAt,
        lastActivityAt: s.lastActivityAt,
        expiresAt: s.expiresAt,
        status: s.status,
        isNewDevice: s.isNewDevice
      }));

    const serializedAdmins = teamDb.admins.map((a) => serializeTeamAdmin(a, activeSessions));

    const kpis: TeamDashboardKpis = {
      totalAdmins: serializedAdmins.length,
      superAdminsCount: serializedAdmins.filter((a) => a.role === 'super_admin').length,
      activeAdmins: serializedAdmins.filter((a) => a.status === 'active').length,
      suspendedAdmins: serializedAdmins.filter((a) => a.status === 'suspended').length,
      deactivatedAdmins: serializedAdmins.filter((a) => a.status === 'deactivated').length,
      pendingInvitations: teamDb.invitations.filter((inv) => inv.status === 'pending').length,
      currentlyConnectedAdmins: serializedAdmins.filter((a) => a.isCurrentlyConnected).length,
      activeAdminSessions: activeSessions.length,
      pendingFinancialValidations: teamDb.financialValidations.filter(
        (v) => v.status === 'prepared' || v.status === 'awaiting_super_admin'
      ).length,
      unreadTeamNotifications: teamDb.notifications.filter((n) => !n.read).length
    };

    const payload: TeamOverviewResponse = {
      success: true,
      currentActor: {
        id: actorAdmin.id,
        name: actorAdmin.fullName,
        email: actorAdmin.email,
        securityRole: getRoleDefinition(actorAdmin.role).securityRoleMapped,
        teamRole: actorAdmin.role,
        permissions: { ...actorAdmin.permissions },
        specialPermissions: { ...actorAdmin.specialPermissions }
      },
      kpis,
      admins: serializedAdmins,
      invitations: teamDb.invitations.map(serializeInvitation),
      roles: TEAM_ROLE_DEFINITIONS,
      modulesMeta: TEAM_MODULES_META,
      permissionLevelsMeta: PERMISSION_LEVELS_META,
      latestLogins: secTelemetry.loginLogs.slice(0, 40),
      activeSessions,
      recentActivities: teamDb.journal.slice(0, 120),
      notifications: teamDb.notifications.slice(0, 80),
      financialValidations: teamDb.financialValidations.slice(0, 60),
      settings: teamDb.settings
    };

    return res.json(payload);
  });

  // 2. ADMIN DETAIL SHEET
  app.get('/api/team/members/:id', (req: Request, res: Response) => {
    const guard = requireTeamAuth(req, res);
    if (!guard) return;
    expireOutdatedInvitations();

    const admin = teamDb.admins.find((a) => a.id === req.params.id);
    if (!admin) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Administrateur introuvable.' });
    }

    const telemetry = getAdminTeamSecurityTelemetry([admin.id], [admin.email]);
    const activeSessions = telemetry.sessions
      .filter((s) => s.status === 'active' || s.status === 'suspect')
      .map((s) => ({
        id: s.id,
        sessionId: s.sessionId,
        userId: s.userId,
        userName: s.userName,
        userEmail: s.userEmail,
        device: s.device,
        browser: s.browser,
        os: s.os,
        location: s.location,
        ipAddress: s.ipAddress,
        startedAt: s.startedAt,
        lastActivityAt: s.lastActivityAt,
        expiresAt: s.expiresAt,
        status: s.status,
        isNewDevice: s.isNewDevice
      }));

    const devicesMap = new Map<
      string,
      { device: string; browser: string; os: string; lastIp: string; lastSeenAt: string }
    >();
    for (const s of [...telemetry.sessions, ...telemetry.loginLogs]) {
      const key = `${s.device}|${s.browser}|${s.os}`;
      const ts = 'lastActivityAt' in s ? s.lastActivityAt : s.timestamp;
      const existing = devicesMap.get(key);
      if (!existing || new Date(ts).getTime() > new Date(existing.lastSeenAt).getTime()) {
        devicesMap.set(key, {
          device: s.device,
          browser: s.browser,
          os: s.os,
          lastIp: s.ipAddress,
          lastSeenAt: ts
        });
      }
    }

    const activities = teamDb.journal.filter(
      (j) => j.actorId === admin.id || j.targetAdminId === admin.id
    );

    const financialDecisions = teamDb.financialValidations.filter(
      (f) =>
        f.preparedById === admin.id ||
        f.approvedStandardById === admin.id ||
        f.finalValidatedById === admin.id ||
        f.rejectedById === admin.id
    );

    const invitationsHistory = teamDb.invitations
      .filter((inv) => inv.adminId === admin.id)
      .map(serializeInvitation);

    const detail: TeamMemberDetailResponse = {
      success: true,
      admin: serializeTeamAdmin(admin, activeSessions),
      loginHistory: telemetry.loginLogs.slice(0, 40),
      activeSessions,
      devicesUsed: Array.from(devicesMap.values()),
      activities: activities.slice(0, 60),
      financialDecisions,
      invitationsHistory
    };

    return res.json(detail);
  });

  // 3. CREATE ADMIN + GENERATE SECURE INVITATION (SUPER ADMIN ONLY + MFA STEP-UP)
  app.post('/api/team/members', (req: Request, res: Response) => {
    const guard = requireTeamAuth(req, res, { requireSuperAdmin: true, requireMfa: true });
    if (!guard) return;
    const { authCtx, actorAdmin } = guard;
    const ip = getClientIp(req);
    const ua = parseUserAgent(req.header('user-agent'));

    const {
      fullName,
      email,
      phone,
      avatarUrl,
      professionalId,
      role,
      department,
      permissions,
      specialPermissions,
      mfaEnabled = true,
      accountSpace = 'admin'
    } = req.body || {};

    // Strict Admin-only boundary: never allow clients/sellers/drivers/companies in Équipe
    if (accountSpace && accountSpace !== 'admin') {
      return res.status(400).json({
        success: false,
        error: 'ADMIN_ONLY_SPACE',
        message: 'L’onglet Équipe est strictement réservé aux administrateurs internes de DJASSA.'
      });
    }

    const cleanName = redactSensitiveText(String(fullName || '').trim());
    const emailNorm = String(email || '').trim().toLowerCase();
    const cleanPhone = redactSensitiveText(String(phone || '').trim());

    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ success: false, error: 'INVALID_NAME', message: 'Nom complet requis.' });
    }
    if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return res.status(400).json({ success: false, error: 'INVALID_EMAIL', message: 'Adresse email professionnelle valide requise.' });
    }

    // Strict Super Admin protection: never create an additional super_admin via team creation
    if (role === 'super_admin') {
      appendTeamJournal({
        actorId: actorAdmin.id,
        actorName: actorAdmin.fullName,
        actorProfessionalId: actorAdmin.professionalId,
        actorRole: actorAdmin.role,
        actionType: 'super_admin_creation_blocked',
        action: 'Tentative de création d’un Super Administrateur supplémentaire bloquée',
        module: 'team',
        targetName: emailNorm,
        result: 'bloque',
        severity: 'critique',
        ipAddress: ip,
        device: `${ua.device} (${ua.browser})`,
        sessionId: authCtx.session.sessionId,
        details: 'Règle de sécurité : le rôle Super Administrateur est exclusivement réservé au propriétaire principal.'
      });
      persistTeamDb();
      return res.status(403).json({
        success: false,
        error: 'SUPER_ADMIN_PROTECTED',
        message: 'Création refusée : le rôle Super Administrateur est strictement réservé au propriétaire principal de DJASSA.'
      });
    }

    const validRole = TEAM_ROLE_DEFINITIONS.find((r) => r.key === role && r.key !== 'super_admin');
    if (!validRole) {
      return res.status(400).json({ success: false, error: 'INVALID_ROLE', message: 'Rôle administratif invalide.' });
    }

    // Prevent mixing clients/sellers/drivers/companies accounts into Admin Team
    const nonAdminRoleMatch = isEmailUsedByNonAdminMarketplaceAccount(emailNorm);
    if (nonAdminRoleMatch) {
      return res.status(409).json({
        success: false,
        error: 'NON_ADMIN_EMAIL_CONFLICT',
        message: `Cet email est associé à un compte ${nonAdminRoleMatch}. Utilisez un email administratif dédié.`
      });
    }

    if (teamDb.admins.some((a) => a.email.toLowerCase() === emailNorm)) {
      return res.status(409).json({
        success: false,
        error: 'EMAIL_EXISTS',
        message: 'Un compte administrateur existe déjà avec cette adresse email.'
      });
    }

    const nowIso = new Date().toISOString();
    const adminId = `adm-${crypto.randomUUID().slice(0, 10)}`;
    const proId = String(professionalId || '').trim() || generateNextProfessionalId();
    const resolvedDepartment = String(department || '').trim() || validRole.department;

    const mergedMatrix: TeamPermissionsMatrix = { ...validRole.defaultMatrix };
    if (permissions && typeof permissions === 'object') {
      for (const mod of TEAM_MODULES_META) {
        const candidate = (permissions as Record<string, unknown>)[mod.key];
        if (typeof candidate === 'string' && candidate in PERMISSION_LEVEL_RANK) {
          mergedMatrix[mod.key] = candidate as TeamPermissionLevel;
        }
      }
    }

    const mergedSpecial: TeamSpecialPermissions = {
      ...validRole.defaultSpecial,
      ...(specialPermissions && typeof specialPermissions === 'object' ? specialPermissions : {}),
      canManageTeam: false, // Never allow delegated team takeover
      canApproveAboveThreshold: false // Above-threshold financial approval reserved strictly to Super Admin
    };

    const newAdmin: StoredTeamAdminMember = {
      id: adminId,
      professionalId: proId,
      fullName: cleanName,
      email: emailNorm,
      phone: cleanPhone || '+225 00 00 00 00 00',
      avatarUrl: typeof avatarUrl === 'string' && avatarUrl.trim() ? avatarUrl.trim() : null,
      role: validRole.key,
      department: resolvedDepartment,
      status: 'invited',
      mfaEnabled: Boolean(mfaEnabled),
      mustSetPassword: true,
      passwordHash: null,
      passwordSalt: null,
      permissions: mergedMatrix,
      specialPermissions: mergedSpecial,
      permissionsUpdatedAt: nowIso,
      permissionsUpdatedBy: actorAdmin.fullName,
      createdAt: nowIso,
      createdById: actorAdmin.id,
      createdByName: actorAdmin.fullName,
      activatedAt: null,
      lastLoginAt: null,
      lastLoginIp: null,
      lastLoginDevice: null,
      suspendedAt: null,
      suspendedUntil: null,
      suspensionReason: null,
      deactivatedAt: null,
      deactivatedReason: null
    };

    const rawInvitationToken = `djinv_${crypto.randomBytes(24).toString('hex')}`;
    const validHours = Math.max(1, Number(teamDb.settings.invitationValidityHours) || 72);
    const expiresAt = new Date(Date.now() + validHours * 3600_000).toISOString();

    const invitation: StoredTeamInvitation = {
      id: `inv-${crypto.randomUUID().slice(0, 10)}`,
      adminId: newAdmin.id,
      professionalId: newAdmin.professionalId,
      fullName: newAdmin.fullName,
      email: newAdmin.email,
      role: newAdmin.role,
      department: newAdmin.department,
      status: 'pending',
      tokenHash: hashToken(rawInvitationToken),
      tokenPreview: `${rawInvitationToken.slice(0, 12)}...${rawInvitationToken.slice(-6)}`,
      createdAt: nowIso,
      sentAt: nowIso,
      expiresAt,
      acceptedAt: null,
      createdById: actorAdmin.id,
      createdByName: actorAdmin.fullName
    };

    teamDb.admins.unshift(newAdmin);
    teamDb.invitations.unshift(invitation);

    // Sync into securityDb.staff with active=false until password activation completes
    syncStaffMemberInSecurityDb({
      id: newAdmin.id,
      name: newAdmin.fullName,
      email: newAdmin.email,
      role: validRole.securityRoleMapped,
      title: `${validRole.label} • ${newAdmin.department}`,
      active: false,
      mfaEnabled: newAdmin.mfaEnabled,
      permissions: computeSecurityPermissionsFromTeam(newAdmin.role, mergedMatrix, mergedSpecial),
      createdAt: nowIso
    });

    appendTeamJournal({
      actorId: actorAdmin.id,
      actorName: actorAdmin.fullName,
      actorProfessionalId: actorAdmin.professionalId,
      actorRole: actorAdmin.role,
      actionType: 'admin_created_and_invited',
      action: `Création du compte admin ${newAdmin.fullName} (${validRole.label}) et émission d’invitation sécurisée`,
      module: 'team',
      targetAdminId: newAdmin.id,
      targetName: `${newAdmin.fullName} (${newAdmin.professionalId})`,
      result: 'reussi',
      severity: 'eleve',
      ipAddress: ip,
      device: `${ua.device} (${ua.browser})`,
      sessionId: authCtx.session.sessionId,
      beforeValue: null,
      afterValue: `${validRole.label} • Statut: invited`,
      details: `Compte créé par ${actorAdmin.fullName}. Jeton d’invitation valide ${validHours}h généré sans mot de passe en clair.`
    });

    pushTeamNotification({
      type: 'admin_created',
      priority: 'eleve',
      title: `Nouvel administrateur invité : ${newAdmin.fullName}`,
      message: `${actorAdmin.fullName} a créé le compte ${newAdmin.professionalId} (${validRole.label}). Invitation sécurisée envoyée à ${newAdmin.email}.`,
      actorName: actorAdmin.fullName,
      targetAdminId: newAdmin.id,
      targetName: newAdmin.fullName
    });

    appendAuditEntry({
      actorId: actorAdmin.id,
      actorName: actorAdmin.fullName,
      actorAccountLabel: actorAdmin.email,
      actorRole: actorAdmin.role,
      space: 'admin',
      category: 'admin_mgmt',
      actionType: 'team_admin_created',
      action: `Création administrateur DJASSA (${validRole.label})`,
      target: `${newAdmin.fullName} (${newAdmin.email})`,
      targetType: 'account',
      entityType: 'admin_account',
      entityId: newAdmin.id,
      result: 'reussi',
      severity: 'eleve',
      beforeValue: null,
      afterValue: `${newAdmin.professionalId} • ${validRole.label}`,
      details: `Invitation sécurisée générée (expiration ${validHours}h)`,
      ipAddress: ip
    });

    persistTeamDb();

    return res.status(201).json({
      success: true,
      message: `Administrateur ${newAdmin.fullName} créé et invitation sécurisée émise.`,
      admin: serializeTeamAdmin(newAdmin, []),
      invitation: serializeInvitation(invitation),
      // One-time secure invitation token & activation link for secure delivery to recipient
      invitationToken: rawInvitationToken,
      activationPath: `/admin-invitation?token=${rawInvitationToken}`
    });
  });

  // 4. ACCEPT INVITATION & DEFINE OWN PASSWORD (PUBLIC WITH CRYPTO TOKEN)
  app.post('/api/team/invitations/accept', (req: Request, res: Response) => {
    expireOutdatedInvitations();
    const ip = getClientIp(req);
    const ua = parseUserAgent(req.header('user-agent'));
    const { token, password } = req.body || {};

    const cleanToken = String(token || '').trim();
    if (!cleanToken) {
      return res.status(400).json({ success: false, error: 'TOKEN_REQUIRED', message: 'Jeton d’invitation requis.' });
    }

    const tokenHash = hashToken(cleanToken);
    const invitation = teamDb.invitations.find((inv) => inv.tokenHash === tokenHash);
    if (!invitation) {
      return res.status(404).json({ success: false, error: 'INVALID_INVITATION', message: 'Jeton d’invitation invalide.' });
    }
    if (invitation.status === 'accepted') {
      return res.status(400).json({ success: false, error: 'INVITATION_ALREADY_USED', message: 'Cette invitation a déjà été utilisée.' });
    }
    if (invitation.status === 'revoked') {
      return res.status(403).json({ success: false, error: 'INVITATION_REVOKED', message: 'Cette invitation a été annulée par le Super Administrateur.' });
    }
    if (invitation.status === 'expired' || new Date(invitation.expiresAt).getTime() <= Date.now()) {
      invitation.status = 'expired';
      persistTeamDb();
      return res.status(410).json({ success: false, error: 'INVITATION_EXPIRED', message: 'Cette invitation a expiré. Demandez un renvoi au Super Administrateur.' });
    }

    const pwdCheck = validateStrongPassword(String(password || ''));
    if (!pwdCheck.ok) {
      return res.status(400).json({ success: false, error: 'WEAK_PASSWORD', message: pwdCheck.message });
    }

    const admin = teamDb.admins.find((a) => a.id === invitation.adminId);
    if (!admin) {
      return res.status(404).json({ success: false, error: 'ADMIN_NOT_FOUND', message: 'Compte administrateur associé introuvable.' });
    }
    if (admin.status === 'deactivated') {
      return res.status(403).json({ success: false, error: 'ACCOUNT_DEACTIVATED', message: 'Ce compte administrateur est désactivé.' });
    }

    const nowIso = new Date().toISOString();
    const { hash, salt } = hashPassword(String(password));
    admin.passwordHash = hash;
    admin.passwordSalt = salt;
    admin.mustSetPassword = false;
    admin.status = 'active';
    admin.activatedAt = nowIso;
    admin.lastLoginAt = nowIso;
    admin.lastLoginIp = ip;
    admin.lastLoginDevice = `${ua.device} (${ua.browser} / ${ua.os})`;

    invitation.status = 'accepted';
    invitation.acceptedAt = nowIso;

    const roleDef = getRoleDefinition(admin.role);
    const staffMember = syncStaffMemberInSecurityDb({
      id: admin.id,
      name: admin.fullName,
      email: admin.email,
      role: roleDef.securityRoleMapped,
      title: `${roleDef.label} • ${admin.department}`,
      active: true,
      mfaEnabled: admin.mfaEnabled,
      permissions: computeSecurityPermissionsFromTeam(admin.role, admin.permissions, admin.specialPermissions),
      createdAt: admin.createdAt
    });

    const sessionResult = createVerifiedStaffSessionInSecurityDb(req, staffMember);

    appendTeamJournal({
      actorId: admin.id,
      actorName: admin.fullName,
      actorProfessionalId: admin.professionalId,
      actorRole: admin.role,
      actionType: 'invitation_accepted_activated',
      action: `Invitation acceptée et compte activé par ${admin.fullName}`,
      module: 'team',
      targetAdminId: admin.id,
      targetName: `${admin.fullName} (${admin.professionalId})`,
      result: 'reussi',
      severity: 'moyen',
      ipAddress: ip,
      device: `${ua.device} (${ua.browser})`,
      sessionId: sessionResult.session.sessionId,
      beforeValue: 'Statut: invited',
      afterValue: 'Statut: active (mot de passe défini & haché)',
      details: `Mot de passe fort défini (scrypt salé). Compte activé et session ouverte.`
    });

    pushTeamNotification({
      type: 'invitation_accepted',
      priority: 'moyen',
      title: `Compte admin activé : ${admin.fullName}`,
      message: `${admin.fullName} (${roleDef.label}) a accepté son invitation, défini son mot de passe et activé son compte.`,
      actorName: admin.fullName,
      targetAdminId: admin.id,
      targetName: admin.fullName
    });

    appendAuditEntry({
      actorId: admin.id,
      actorName: admin.fullName,
      actorAccountLabel: admin.email,
      actorRole: admin.role,
      space: 'admin',
      category: 'auth',
      actionType: 'team_invitation_accepted',
      action: 'Activation de compte administrateur après invitation',
      target: admin.email,
      targetType: 'account',
      entityType: 'admin_account',
      entityId: admin.id,
      result: 'reussi',
      severity: 'moyen',
      details: `Compte activé et première session ouverte`,
      ipAddress: ip
    });

    persistTeamDb();

    return res.json({
      success: true,
      message: 'Compte administrateur activé avec succès.',
      token: sessionResult.token,
      session: sessionResult.session,
      admin: serializeTeamAdmin(admin, [sessionResult.session])
    });
  });

  // 5. INDEPENDENT ADMIN LOGIN (INTEGRATED WITH EXISTING SECURITY SESSION SYSTEM)
  app.post('/api/team/auth/login', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const ua = parseUserAgent(req.header('user-agent'));
    const { email, password } = req.body || {};
    const emailNorm = String(email || '').trim().toLowerCase();

    if (!emailNorm || !password) {
      return res.status(400).json({
        success: false,
        error: 'CREDENTIALS_REQUIRED',
        message: 'Email professionnel et mot de passe requis.'
      });
    }

    const admin = teamDb.admins.find((a) => a.email.toLowerCase() === emailNorm);
    if (!admin) {
      recordFailedAdminLoginInSecurityDb(req, {
        accountId: emailNorm,
        accountName: emailNorm,
        accountEmail: emailNorm,
        reason: 'Compte administrateur inconnu'
      });
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Identifiants administrateur incorrects.'
      });
    }

    if (admin.status === 'invited' || !admin.passwordHash || !admin.passwordSalt) {
      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_NOT_ACTIVATED',
        message: 'Compte en attente d’activation. Veuillez accepter votre invitation sécurisée pour définir votre mot de passe.'
      });
    }

    if (admin.status === 'suspended') {
      recordFailedAdminLoginInSecurityDb(req, {
        accountId: admin.id,
        accountName: admin.fullName,
        accountEmail: admin.email,
        reason: `Tentative de connexion sur compte suspendu (${admin.suspensionReason || 'Sécurité'})`,
        isSuspect: true
      });
      appendTeamJournal({
        actorId: admin.id,
        actorName: admin.fullName,
        actorProfessionalId: admin.professionalId,
        actorRole: admin.role,
        actionType: 'suspended_admin_login_blocked',
        action: 'Connexion bloquée (compte administrateur suspendu)',
        module: 'security',
        targetAdminId: admin.id,
        targetName: admin.fullName,
        result: 'bloque',
        severity: 'eleve',
        ipAddress: ip,
        device: `${ua.device} (${ua.browser})`,
        details: `Tentative de connexion refusée : compte suspendu (${admin.suspensionReason || 'non précisé'}).`
      });
      persistTeamDb();
      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_SUSPENDED',
        message: `Compte administrateur suspendu : ${admin.suspensionReason || 'Contactez le Super Administrateur.'}`
      });
    }

    if (admin.status === 'deactivated') {
      recordFailedAdminLoginInSecurityDb(req, {
        accountId: admin.id,
        accountName: admin.fullName,
        accountEmail: admin.email,
        reason: 'Tentative de connexion sur compte désactivé définitivement',
        isSuspect: true
      });
      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_DEACTIVATED',
        message: 'Ce compte administrateur a été désactivé définitivement.'
      });
    }

    const ok = verifyPassword(String(password), admin.passwordHash, admin.passwordSalt);
    if (!ok) {
      recordFailedAdminLoginInSecurityDb(req, {
        accountId: admin.id,
        accountName: admin.fullName,
        accountEmail: admin.email,
        reason: 'Mot de passe administrateur incorrect'
      });
      appendTeamJournal({
        actorId: admin.id,
        actorName: admin.fullName,
        actorProfessionalId: admin.professionalId,
        actorRole: admin.role,
        actionType: 'admin_login_failed',
        action: 'Échec de connexion administrateur (mot de passe invalide)',
        module: 'security',
        targetAdminId: admin.id,
        targetName: admin.fullName,
        result: 'echoue',
        severity: 'moyen',
        ipAddress: ip,
        device: `${ua.device} (${ua.browser})`,
        details: 'Mot de passe rejeté lors de la vérification scrypt.'
      });
      persistTeamDb();
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Identifiants administrateur incorrects.'
      });
    }

    const roleDef = getRoleDefinition(admin.role);
    const staffMember = syncStaffMemberInSecurityDb({
      id: admin.id,
      name: admin.fullName,
      email: admin.email,
      role: roleDef.securityRoleMapped,
      title: `${roleDef.label} • ${admin.department}`,
      active: true,
      mfaEnabled: admin.mfaEnabled,
      permissions: computeSecurityPermissionsFromTeam(admin.role, admin.permissions, admin.specialPermissions),
      createdAt: admin.createdAt
    });

    const sessionRes = createVerifiedStaffSessionInSecurityDb(req, staffMember);
    const nowIso = new Date().toISOString();
    admin.lastLoginAt = nowIso;
    admin.lastLoginIp = ip;
    admin.lastLoginDevice = `${ua.device} (${ua.browser} / ${ua.os})`;

    appendTeamJournal({
      actorId: admin.id,
      actorName: admin.fullName,
      actorProfessionalId: admin.professionalId,
      actorRole: admin.role,
      actionType: 'admin_login_success',
      action: sessionRes.isNewDevice
        ? `Connexion administrateur depuis un nouvel appareil (${ua.device})`
        : `Connexion administrateur réussie (${roleDef.label})`,
      module: 'security',
      targetAdminId: admin.id,
      targetName: admin.fullName,
      result: 'reussi',
      severity: sessionRes.isNewDevice ? 'eleve' : 'information',
      ipAddress: ip,
      device: `${ua.device} (${ua.browser})`,
      sessionId: sessionRes.session.sessionId,
      details: `Session ${sessionRes.session.sessionId} ouverte sur l’espace Administrateur DJASSA.`
    });

    if (sessionRes.isNewDevice) {
      pushTeamNotification({
        type: 'suspicious_login',
        priority: 'eleve',
        title: `Connexion inhabituelle détectée : ${admin.fullName}`,
        message: `${admin.fullName} s’est connecté depuis un nouvel appareil (${ua.device} / ${ua.browser}, IP ${ip}).`,
        actorName: admin.fullName,
        targetAdminId: admin.id,
        targetName: admin.fullName
      });
    }

    persistTeamDb();

    return res.json({
      success: true,
      message: 'Connexion administrateur réussie.',
      token: sessionRes.token,
      session: sessionRes.session,
      isNewDevice: sessionRes.isNewDevice,
      admin: serializeTeamAdmin(admin, [sessionRes.session])
    });
  });

  // 6. UPDATE ADMIN INFO / ROLE / PERMISSIONS (STRICT SUPER ADMIN + ANTI-ESCALATION + MFA STEP-UP)
  app.patch('/api/team/members/:id', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const ip = getClientIp(req);
    const ua = parseUserAgent(req.header('user-agent'));
    const actorAdmin = resolveTeamMemberFromAuthCtx(authCtx);
    const targetAdmin = teamDb.admins.find((a) => a.id === req.params.id);

    if (!actorAdmin || authCtx.token.spaceRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'ADMIN_REQUIRED', message: 'Compte administrateur requis.' });
    }
    if (!targetAdmin) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Administrateur introuvable.' });
    }

    const { fullName, phone, department, avatarUrl, role, permissions, specialPermissions, mfaEnabled } = req.body || {};

    // STRICT GUARD 1: Prevent self permission/role escalation even BEFORE other checks
    if (
      actorAdmin.id === targetAdmin.id &&
      (role !== undefined && role !== actorAdmin.role || permissions !== undefined || specialPermissions !== undefined)
    ) {
      if (actorAdmin.role !== 'super_admin' || (role && role !== 'super_admin')) {
        appendTeamJournal({
          actorId: actorAdmin.id,
          actorName: actorAdmin.fullName,
          actorProfessionalId: actorAdmin.professionalId,
          actorRole: actorAdmin.role,
          actionType: 'self_privilege_escalation_blocked',
          action: 'Tentative d’auto-modification de rôle ou permissions bloquée',
          module: 'security',
          targetAdminId: targetAdmin.id,
          targetName: targetAdmin.fullName,
          result: 'bloque',
          severity: 'critique',
          ipAddress: ip,
          device: `${ua.device} (${ua.browser})`,
          sessionId: authCtx.session.sessionId,
          details: 'Aucun administrateur ne peut modifier ses propres permissions pour s’octroyer plus de droits.'
        });
        pushTeamNotification({
          type: 'unauthorized_access',
          priority: 'critique',
          title: 'Tentative d’escalade de privilèges bloquée',
          message: `${actorAdmin.fullName} a tenté de modifier ses propres permissions/rôle.`,
          actorName: actorAdmin.fullName,
          targetAdminId: actorAdmin.id,
          targetName: actorAdmin.fullName
        });
        persistTeamDb();
        return res.status(403).json({
          success: false,
          error: 'SELF_ESCALATION_FORBIDDEN',
          message: 'Interdit : un administrateur ne peut jamais modifier ses propres permissions ou son rôle.'
        });
      }
    }

    // STRICT GUARD 2: Ordinary admin CANNOT alter Super Admin or assign Super Admin role
    if (actorAdmin.role !== 'super_admin') {
      appendTeamJournal({
        actorId: actorAdmin.id,
        actorName: actorAdmin.fullName,
        actorProfessionalId: actorAdmin.professionalId,
        actorRole: actorAdmin.role,
        actionType: 'unauthorized_team_modification',
        action: `Tentative de modification du compte ${targetAdmin.fullName} refusée`,
        module: 'team',
        targetAdminId: targetAdmin.id,
        targetName: targetAdmin.fullName,
        result: 'refuse',
        severity: 'critique',
        ipAddress: ip,
        device: `${ua.device} (${ua.browser})`,
        sessionId: authCtx.session.sessionId,
        details: 'Seul le Super Administrateur principal peut modifier les rôles et permissions de l’équipe.'
      });
      pushTeamNotification({
        type: 'unauthorized_access',
        priority: 'critique',
        title: 'Modification d’équipe non autorisée bloquée',
        message: `${actorAdmin.fullName} (${actorAdmin.role}) a tenté de modifier ${targetAdmin.fullName}.`,
        actorName: actorAdmin.fullName,
        targetAdminId: targetAdmin.id,
        targetName: targetAdmin.fullName
      });
      persistTeamDb();
      return res.status(403).json({
        success: false,
        error: 'SUPER_ADMIN_ONLY',
        message: 'Accès refusé : seul le Super Administrateur peut modifier les comptes et permissions de l’équipe.'
      });
    }

    // STRICT GUARD 3: Promote another admin to super_admin is forbidden
    if (role === 'super_admin' && targetAdmin.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'SUPER_ADMIN_PROTECTED',
        message: 'Le rôle Super Administrateur ne peut pas être attribué à un autre compte.'
      });
    }

    // STRICT GUARD 4: Super Admin root cannot be downgraded from super_admin
    if (targetAdmin.role === 'super_admin' && role && role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'SUPER_ADMIN_IMMUTABLE',
        message: 'Le rôle du Super Administrateur principal est inaltérable.'
      });
    }

    // MFA step-up required when altering role, permissions, or MFA
    const sensitiveEdit = role !== undefined || permissions !== undefined || specialPermissions !== undefined || mfaEnabled !== undefined;
    if (sensitiveEdit && teamDb.settings.requireMfaForSensitiveTeamActions) {
      const mfaRes = verifyStepUpMfaForRequest(req, authCtx, true);
      if (!mfaRes.ok) {
        return res.status(mfaRes.status).json({
          success: false,
          error: mfaRes.error,
          message: mfaRes.message
        });
      }
    }

    const nowIso = new Date().toISOString();
    const prevRole = targetAdmin.role;
    const prevSnapshot = `${getRoleDefinition(prevRole).label} • ${targetAdmin.department}`;

    if (typeof fullName === 'string' && fullName.trim()) {
      targetAdmin.fullName = redactSensitiveText(fullName.trim());
    }
    if (typeof phone === 'string' && phone.trim()) {
      targetAdmin.phone = redactSensitiveText(phone.trim());
    }
    if (typeof department === 'string' && department.trim()) {
      targetAdmin.department = redactSensitiveText(department.trim());
    }
    if (avatarUrl !== undefined) {
      targetAdmin.avatarUrl = typeof avatarUrl === 'string' && avatarUrl.trim() ? avatarUrl.trim() : null;
    }
    if (typeof mfaEnabled === 'boolean' && targetAdmin.role !== 'super_admin') {
      targetAdmin.mfaEnabled = mfaEnabled;
    }

    let roleChanged = false;
    if (typeof role === 'string' && role !== targetAdmin.role) {
      const def = TEAM_ROLE_DEFINITIONS.find((r) => r.key === role);
      if (!def) {
        return res.status(400).json({ success: false, error: 'INVALID_ROLE', message: 'Rôle administratif inconnu.' });
      }
      targetAdmin.role = def.key;
      if (!department) targetAdmin.department = def.department;
      // Apply new role defaults unless caller also supplied explicit permissions
      if (!permissions) {
        targetAdmin.permissions = { ...def.defaultMatrix };
      }
      if (!specialPermissions) {
        targetAdmin.specialPermissions = { ...def.defaultSpecial };
      }
      roleChanged = true;
    }

    let permsChanged = false;
    if (permissions && typeof permissions === 'object' && targetAdmin.role !== 'super_admin') {
      for (const mod of TEAM_MODULES_META) {
        const lvl = (permissions as Record<string, unknown>)[mod.key];
        if (typeof lvl === 'string' && lvl in PERMISSION_LEVEL_RANK && targetAdmin.permissions[mod.key] !== lvl) {
          targetAdmin.permissions[mod.key] = lvl as TeamPermissionLevel;
          permsChanged = true;
        }
      }
    }

    if (specialPermissions && typeof specialPermissions === 'object' && targetAdmin.role !== 'super_admin') {
      targetAdmin.specialPermissions = {
        ...targetAdmin.specialPermissions,
        ...specialPermissions,
        canManageTeam: false,
        canApproveAboveThreshold: false
      };
      permsChanged = true;
    }

    if (roleChanged || permsChanged) {
      targetAdmin.permissionsUpdatedAt = nowIso;
      targetAdmin.permissionsUpdatedBy = actorAdmin.fullName;
    }

    const updatedRoleDef = getRoleDefinition(targetAdmin.role);
    syncStaffMemberInSecurityDb({
      id: targetAdmin.id,
      name: targetAdmin.fullName,
      email: targetAdmin.email,
      role: updatedRoleDef.securityRoleMapped,
      title: `${updatedRoleDef.label} • ${targetAdmin.department}`,
      active: targetAdmin.status === 'active',
      mfaEnabled: targetAdmin.mfaEnabled,
      permissions: computeSecurityPermissionsFromTeam(targetAdmin.role, targetAdmin.permissions, targetAdmin.specialPermissions),
      createdAt: targetAdmin.createdAt
    });

    if (roleChanged) {
      pushTeamNotification({
        type: 'role_changed',
        priority: 'eleve',
        title: `Rôle modifié : ${targetAdmin.fullName}`,
        message: `${actorAdmin.fullName} a changé le rôle de ${targetAdmin.fullName} de "${getRoleDefinition(prevRole).label}" vers "${updatedRoleDef.label}".`,
        actorName: actorAdmin.fullName,
        targetAdminId: targetAdmin.id,
        targetName: targetAdmin.fullName
      });
    } else if (permsChanged) {
      pushTeamNotification({
        type: 'permissions_changed',
        priority: 'moyen',
        title: `Permissions modifiées : ${targetAdmin.fullName}`,
        message: `${actorAdmin.fullName} a mis à jour la matrice d’accès granulaire de ${targetAdmin.fullName}.`,
        actorName: actorAdmin.fullName,
        targetAdminId: targetAdmin.id,
        targetName: targetAdmin.fullName
      });
    }

    appendTeamJournal({
      actorId: actorAdmin.id,
      actorName: actorAdmin.fullName,
      actorProfessionalId: actorAdmin.professionalId,
      actorRole: actorAdmin.role,
      actionType: roleChanged ? 'admin_role_updated' : permsChanged ? 'admin_permissions_updated' : 'admin_profile_updated',
      action: roleChanged
        ? `Changement de rôle pour ${targetAdmin.fullName}`
        : permsChanged
        ? `Mise à jour des permissions pour ${targetAdmin.fullName}`
        : `Mise à jour fiche professionnelle ${targetAdmin.fullName}`,
      module: 'team',
      targetAdminId: targetAdmin.id,
      targetName: `${targetAdmin.fullName} (${targetAdmin.professionalId})`,
      result: 'reussi',
      severity: roleChanged || permsChanged ? 'eleve' : 'faible',
      ipAddress: ip,
      device: `${ua.device} (${ua.browser})`,
      sessionId: authCtx.session.sessionId,
      beforeValue: prevSnapshot,
      afterValue: `${updatedRoleDef.label} • ${targetAdmin.department}`,
      details: `Modification validée par Super Administrateur (${actorAdmin.fullName}).`
    });

    appendAuditEntry({
      actorId: actorAdmin.id,
      actorName: actorAdmin.fullName,
      actorAccountLabel: actorAdmin.email,
      actorRole: actorAdmin.role,
      space: 'admin',
      category: 'admin_mgmt',
      actionType: 'team_admin_updated',
      action: `Mise à jour collaborateur admin (${targetAdmin.fullName})`,
      target: targetAdmin.email,
      targetType: 'permissions',
      entityType: 'admin_account',
      entityId: targetAdmin.id,
      result: 'reussi',
      severity: roleChanged || permsChanged ? 'eleve' : 'moyen',
      beforeValue: prevSnapshot,
      afterValue: `${updatedRoleDef.label} • ${targetAdmin.department}`,
      details: `Rôle/Permissions synchronisés`,
      ipAddress: ip
    });

    persistTeamDb();
    const telemetry = getAdminTeamSecurityTelemetry([targetAdmin.id], [targetAdmin.email]);
    return res.json({
      success: true,
      message: `Compte administrateur ${targetAdmin.fullName} mis à jour.`,
      admin: serializeTeamAdmin(targetAdmin, telemetry.sessions)
    });
  });

  // 7. TEMPORARILY SUSPEND ADMIN (SUPER ADMIN + MFA + BLOCKS SUPER ADMIN TARGET)
  app.post('/api/team/members/:id/suspend', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const ip = getClientIp(req);
    const ua = parseUserAgent(req.header('user-agent'));
    const actorAdmin = resolveTeamMemberFromAuthCtx(authCtx);
    const targetAdmin = teamDb.admins.find((a) => a.id === req.params.id);

    if (!actorAdmin || authCtx.token.spaceRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'ADMIN_REQUIRED', message: 'Compte administrateur requis.' });
    }
    if (!targetAdmin) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Administrateur introuvable.' });
    }
    if (actorAdmin.role !== 'super_admin') {
      appendTeamJournal({
        actorId: actorAdmin.id,
        actorName: actorAdmin.fullName,
        actorProfessionalId: actorAdmin.professionalId,
        actorRole: actorAdmin.role,
        actionType: 'unauthorized_suspension_blocked',
        action: `Tentative de suspension non autorisée sur ${targetAdmin.fullName}`,
        module: 'security',
        targetAdminId: targetAdmin.id,
        targetName: targetAdmin.fullName,
        result: 'refuse',
        severity: 'critique',
        ipAddress: ip,
        device: `${ua.device} (${ua.browser})`,
        details: 'Seul le Super Administrateur peut suspendre un compte administrateur.'
      });
      persistTeamDb();
      return res.status(403).json({
        success: false,
        error: 'SUPER_ADMIN_ONLY',
        message: 'Accès refusé : seul le Super Administrateur peut suspendre un administrateur.'
      });
    }
    if (targetAdmin.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'SUPER_ADMIN_IMMUTABLE',
        message: 'Le compte Super Administrateur principal ne peut pas être suspendu.'
      });
    }
    if (teamDb.settings.requireMfaForSensitiveTeamActions) {
      const mfaRes = verifyStepUpMfaForRequest(req, authCtx, true);
      if (!mfaRes.ok) return res.status(mfaRes.status).json({ success: false, error: mfaRes.error, message: mfaRes.message });
    }

    const reason = redactSensitiveText(String(req.body?.reason || 'Suspension administrative temporaire').trim());
    const durationDays = Number(req.body?.durationDays || 0);
    const nowIso = new Date().toISOString();

    targetAdmin.status = 'suspended';
    targetAdmin.suspendedAt = nowIso;
    targetAdmin.suspensionReason = reason;
    targetAdmin.suspendedUntil = durationDays > 0 ? new Date(Date.now() + durationDays * 86_400_000).toISOString() : null;

    const { revokedSessions } = setStaffActiveStateInSecurityDb(targetAdmin.id, false, actorAdmin.fullName, reason);

    appendTeamJournal({
      actorId: actorAdmin.id,
      actorName: actorAdmin.fullName,
      actorProfessionalId: actorAdmin.professionalId,
      actorRole: actorAdmin.role,
      actionType: 'admin_suspended',
      action: `Suspension temporaire de ${targetAdmin.fullName}`,
      module: 'security',
      targetAdminId: targetAdmin.id,
      targetName: `${targetAdmin.fullName} (${targetAdmin.professionalId})`,
      result: 'reussi',
      severity: 'eleve',
      ipAddress: ip,
      device: `${ua.device} (${ua.browser})`,
      sessionId: authCtx.session.sessionId,
      beforeValue: 'active',
      afterValue: `suspended (${revokedSessions} session(s) révoquée(s))`,
      details: `Motif : ${reason}`
    });

    pushTeamNotification({
      type: 'account_suspended',
      priority: 'eleve',
      title: `Administrateur suspendu : ${targetAdmin.fullName}`,
      message: `${actorAdmin.fullName} a suspendu ${targetAdmin.fullName} (${reason}). ${revokedSessions} session(s) coupée(s).`,
      actorName: actorAdmin.fullName,
      targetAdminId: targetAdmin.id,
      targetName: targetAdmin.fullName
    });

    persistTeamDb();
    return res.json({
      success: true,
      message: `${targetAdmin.fullName} suspendu. ${revokedSessions} session(s) active(s) révoquée(s).`,
      revokedSessions,
      admin: serializeTeamAdmin(targetAdmin, [])
    });
  });

  // 8. REACTIVATE SUSPENDED ADMIN
  app.post('/api/team/members/:id/reactivate', (req: Request, res: Response) => {
    const guard = requireTeamAuth(req, res, { requireSuperAdmin: true, requireMfa: true });
    if (!guard) return;
    const { authCtx, actorAdmin } = guard;
    const ip = getClientIp(req);
    const ua = parseUserAgent(req.header('user-agent'));

    const targetAdmin = teamDb.admins.find((a) => a.id === req.params.id);
    if (!targetAdmin) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Administrateur introuvable.' });
    }
    if (targetAdmin.status === 'deactivated') {
      return res.status(400).json({
        success: false,
        error: 'DEACTIVATED_PERMANENTLY',
        message: 'Ce compte a été désactivé définitivement et ne peut pas être réactivé.'
      });
    }

    const prevStatus = targetAdmin.status;
    targetAdmin.status = targetAdmin.mustSetPassword ? 'invited' : 'active';
    targetAdmin.suspendedAt = null;
    targetAdmin.suspendedUntil = null;
    targetAdmin.suspensionReason = null;

    setStaffActiveStateInSecurityDb(targetAdmin.id, targetAdmin.status === 'active', actorAdmin.fullName, 'Réactivation administrateur');

    appendTeamJournal({
      actorId: actorAdmin.id,
      actorName: actorAdmin.fullName,
      actorProfessionalId: actorAdmin.professionalId,
      actorRole: actorAdmin.role,
      actionType: 'admin_reactivated',
      action: `Réactivation du compte administrateur ${targetAdmin.fullName}`,
      module: 'security',
      targetAdminId: targetAdmin.id,
      targetName: `${targetAdmin.fullName} (${targetAdmin.professionalId})`,
      result: 'reussi',
      severity: 'moyen',
      ipAddress: ip,
      device: `${ua.device} (${ua.browser})`,
      sessionId: authCtx.session.sessionId,
      beforeValue: prevStatus,
      afterValue: targetAdmin.status,
      details: `Compte réactivé par ${actorAdmin.fullName}.`
    });

    pushTeamNotification({
      type: 'account_reactivated',
      priority: 'moyen',
      title: `Administrateur réactivé : ${targetAdmin.fullName}`,
      message: `${actorAdmin.fullName} a réactivé le compte ${targetAdmin.fullName}.`,
      actorName: actorAdmin.fullName,
      targetAdminId: targetAdmin.id,
      targetName: targetAdmin.fullName
    });

    persistTeamDb();
    return res.json({
      success: true,
      message: `Compte ${targetAdmin.fullName} réactivé avec succès.`,
      admin: serializeTeamAdmin(targetAdmin, [])
    });
  });

  // 9. REVOKE ALL ACTIVE SESSIONS FOR AN ADMIN
  app.post('/api/team/members/:id/revoke-sessions', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const ip = getClientIp(req);
    const ua = parseUserAgent(req.header('user-agent'));
    const actorAdmin = resolveTeamMemberFromAuthCtx(authCtx);
    const targetAdmin = teamDb.admins.find((a) => a.id === req.params.id);

    if (!actorAdmin || authCtx.token.spaceRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'ADMIN_REQUIRED', message: 'Compte administrateur requis.' });
    }
    if (!targetAdmin) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Administrateur introuvable.' });
    }
    if (actorAdmin.role !== 'super_admin' && !actorAdmin.specialPermissions.canRevokeSessions) {
      return res.status(403).json({ success: false, error: 'PERMISSION_DENIED', message: 'Permission de révocation de session requise.' });
    }
    if (targetAdmin.role === 'super_admin' && actorAdmin.id !== targetAdmin.id) {
      return res.status(403).json({
        success: false,
        error: 'SUPER_ADMIN_IMMUTABLE',
        message: 'Seul le Super Administrateur peut révoquer ses propres sessions.'
      });
    }
    if (teamDb.settings.requireMfaForSensitiveTeamActions) {
      const mfaRes = verifyStepUpMfaForRequest(req, authCtx, true);
      if (!mfaRes.ok) return res.status(mfaRes.status).json({ success: false, error: mfaRes.error, message: mfaRes.message });
    }

    const reason = String(req.body?.reason || 'Révocation administrative des sessions actives').trim();
    const revokedCount = revokeSessionsForStaffInSecurityDb(
      targetAdmin.id,
      targetAdmin.email,
      actorAdmin.fullName,
      reason
    );

    appendTeamJournal({
      actorId: actorAdmin.id,
      actorName: actorAdmin.fullName,
      actorProfessionalId: actorAdmin.professionalId,
      actorRole: actorAdmin.role,
      actionType: 'admin_sessions_revoked',
      action: `Révocation de toutes les sessions de ${targetAdmin.fullName}`,
      module: 'security',
      targetAdminId: targetAdmin.id,
      targetName: `${targetAdmin.fullName} (${targetAdmin.professionalId})`,
      result: 'reussi',
      severity: 'eleve',
      ipAddress: ip,
      device: `${ua.device} (${ua.browser})`,
      sessionId: authCtx.session.sessionId,
      beforeValue: 'Sessions actives',
      afterValue: `${revokedCount} session(s) révoquée(s)`,
      details: `Motif : ${reason}`
    });

    pushTeamNotification({
      type: 'session_revoked',
      priority: 'eleve',
      title: `Sessions révoquées : ${targetAdmin.fullName}`,
      message: `${revokedCount} session(s) active(s) coupée(s) immédiatement par ${actorAdmin.fullName}.`,
      actorName: actorAdmin.fullName,
      targetAdminId: targetAdmin.id,
      targetName: targetAdmin.fullName
    });

    persistTeamDb();
    return res.json({
      success: true,
      message: `${revokedCount} session(s) révoquée(s) pour ${targetAdmin.fullName}.`,
      revokedCount
    });
  });

  // 10. RESEND INVITATION
  app.post('/api/team/members/:id/resend-invitation', (req: Request, res: Response) => {
    const guard = requireTeamAuth(req, res, { requireSuperAdmin: true });
    if (!guard) return;
    const { authCtx, actorAdmin } = guard;
    const ip = getClientIp(req);
    const ua = parseUserAgent(req.header('user-agent'));

    const targetAdmin = teamDb.admins.find((a) => a.id === req.params.id);
    if (!targetAdmin) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Administrateur introuvable.' });
    }
    if (targetAdmin.status !== 'invited') {
      return res.status(400).json({
        success: false,
        error: 'ALREADY_ACTIVATED',
        message: 'Cet administrateur a déjà activé son compte.'
      });
    }

    // Revoke older pending invitations
    for (const inv of teamDb.invitations) {
      if (inv.adminId === targetAdmin.id && inv.status === 'pending') {
        inv.status = 'revoked';
      }
    }

    const nowIso = new Date().toISOString();
    const rawToken = `djinv_${crypto.randomBytes(24).toString('hex')}`;
    const validHours = Math.max(1, Number(teamDb.settings.invitationValidityHours) || 72);
    const newInv: StoredTeamInvitation = {
      id: `inv-${crypto.randomUUID().slice(0, 10)}`,
      adminId: targetAdmin.id,
      professionalId: targetAdmin.professionalId,
      fullName: targetAdmin.fullName,
      email: targetAdmin.email,
      role: targetAdmin.role,
      department: targetAdmin.department,
      status: 'pending',
      tokenHash: hashToken(rawToken),
      tokenPreview: `${rawToken.slice(0, 12)}...${rawToken.slice(-6)}`,
      createdAt: nowIso,
      sentAt: nowIso,
      expiresAt: new Date(Date.now() + validHours * 3600_000).toISOString(),
      acceptedAt: null,
      createdById: actorAdmin.id,
      createdByName: actorAdmin.fullName
    };
    teamDb.invitations.unshift(newInv);

    appendTeamJournal({
      actorId: actorAdmin.id,
      actorName: actorAdmin.fullName,
      actorProfessionalId: actorAdmin.professionalId,
      actorRole: actorAdmin.role,
      actionType: 'invitation_resent',
      action: `Renvoi d’invitation sécurisée à ${targetAdmin.fullName}`,
      module: 'team',
      targetAdminId: targetAdmin.id,
      targetName: `${targetAdmin.fullName} (${targetAdmin.email})`,
      result: 'reussi',
      severity: 'faible',
      ipAddress: ip,
      device: `${ua.device} (${ua.browser})`,
      sessionId: authCtx.session.sessionId,
      details: `Nouveau jeton généré (expiration ${validHours}h).`
    });

    pushTeamNotification({
      type: 'invitation_sent',
      priority: 'information',
      title: `Invitation renvoyée : ${targetAdmin.fullName}`,
      message: `${actorAdmin.fullName} a émis un nouveau lien d’invitation sécurisé pour ${targetAdmin.email}.`,
      actorName: actorAdmin.fullName,
      targetAdminId: targetAdmin.id,
      targetName: targetAdmin.fullName
    });

    persistTeamDb();
    return res.json({
      success: true,
      message: `Nouvelle invitation sécurisée générée pour ${targetAdmin.email}.`,
      invitation: serializeInvitation(newInv),
      invitationToken: rawToken,
      activationPath: `/admin-invitation?token=${rawToken}`
    });
  });

  // 11. PERMANENT DEACTIVATION (PRESERVES ALL HISTORICAL & FINANCIAL TRACES)
  app.post('/api/team/members/:id/deactivate', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const ip = getClientIp(req);
    const ua = parseUserAgent(req.header('user-agent'));
    const actorAdmin = resolveTeamMemberFromAuthCtx(authCtx);
    const targetAdmin = teamDb.admins.find((a) => a.id === req.params.id);

    if (!actorAdmin || authCtx.token.spaceRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'ADMIN_REQUIRED', message: 'Compte administrateur requis.' });
    }
    if (!targetAdmin) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Administrateur introuvable.' });
    }
    if (actorAdmin.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'SUPER_ADMIN_ONLY',
        message: 'Seul le Super Administrateur peut désactiver définitivement un compte administrateur.'
      });
    }
    if (targetAdmin.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'SUPER_ADMIN_IMMUTABLE',
        message: 'Le compte Super Administrateur principal ne peut jamais être désactivé.'
      });
    }
    if (teamDb.settings.requireMfaForSensitiveTeamActions) {
      const mfaRes = verifyStepUpMfaForRequest(req, authCtx, true);
      if (!mfaRes.ok) return res.status(mfaRes.status).json({ success: false, error: mfaRes.error, message: mfaRes.message });
    }

    const reason = redactSensitiveText(
      String(req.body?.reason || 'Fin de mission administrative (historique intégralement conservé)').trim()
    );
    const nowIso = new Date().toISOString();
    const prevStatus = targetAdmin.status;

    targetAdmin.status = 'deactivated';
    targetAdmin.deactivatedAt = nowIso;
    targetAdmin.deactivatedReason = reason;

    for (const inv of teamDb.invitations) {
      if (inv.adminId === targetAdmin.id && inv.status === 'pending') {
        inv.status = 'revoked';
      }
    }

    const { revokedSessions } = setStaffActiveStateInSecurityDb(targetAdmin.id, false, actorAdmin.fullName, reason);

    appendTeamJournal({
      actorId: actorAdmin.id,
      actorName: actorAdmin.fullName,
      actorProfessionalId: actorAdmin.professionalId,
      actorRole: actorAdmin.role,
      actionType: 'admin_permanently_deactivated',
      action: `Désactivation définitive du compte ${targetAdmin.fullName} (traces conservées)`,
      module: 'security',
      targetAdminId: targetAdmin.id,
      targetName: `${targetAdmin.fullName} (${targetAdmin.professionalId})`,
      result: 'reussi',
      severity: 'critique',
      ipAddress: ip,
      device: `${ua.device} (${ua.browser})`,
      sessionId: authCtx.session.sessionId,
      beforeValue: prevStatus,
      afterValue: 'deactivated (historique préservé)',
      details: `Compte désactivé définitivement (${revokedSessions} session(s) coupée(s)). Toutes les traces d’audit et décisions financières demeurent archivées.`
    });

    persistTeamDb();
    return res.json({
      success: true,
      message: `Compte ${targetAdmin.fullName} désactivé définitivement avec conservation intégrale des traces.`,
      admin: serializeTeamAdmin(targetAdmin, [])
    });
  });

  // 12. REAL SERVER-SIDE PERMISSION VERIFICATION & MODULE ENFORCEMENT ENDPOINT
  app.post('/api/team/permissions/check', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const actorAdmin = resolveTeamMemberFromAuthCtx(authCtx);
    if (!actorAdmin || authCtx.token.spaceRole !== 'admin') {
      return res.status(403).json({ success: false, allowed: false, error: 'ADMIN_REQUIRED' });
    }

    const { moduleKey, minLevel = 'read' } = req.body || {};
    if (!TEAM_MODULES_META.some((m) => m.key === moduleKey)) {
      return res.status(400).json({ success: false, error: 'INVALID_MODULE', message: 'Module inconnu.' });
    }
    if (!(String(minLevel) in PERMISSION_LEVEL_RANK)) {
      return res.status(400).json({ success: false, error: 'INVALID_LEVEL', message: 'Niveau d’accès inconnu.' });
    }

    const mod = moduleKey as TeamModuleKey;
    const lvl = minLevel as TeamPermissionLevel;
    const allowed = hasTeamModulePermission(actorAdmin, mod, lvl);
    const currentLevel = actorAdmin.role === 'super_admin' ? 'admin' : actorAdmin.permissions[mod] || 'none';

    if (!allowed) {
      const ip = getClientIp(req);
      const ua = parseUserAgent(req.header('user-agent'));
      appendTeamJournal({
        actorId: actorAdmin.id,
        actorName: actorAdmin.fullName,
        actorProfessionalId: actorAdmin.professionalId,
        actorRole: actorAdmin.role,
        actionType: 'module_access_blocked',
        action: `Accès bloqué sur "${mod}" (niveau actuel "${currentLevel}" < requis "${lvl}")`,
        module: mod,
        targetName: mod,
        result: 'refuse',
        severity: 'eleve',
        ipAddress: ip,
        device: `${ua.device} (${ua.browser})`,
        sessionId: authCtx.session.sessionId,
        beforeValue: currentLevel,
        afterValue: `Refusé (${lvl} requis)`,
        details: `Contrôle serveur RBAC : ${actorAdmin.fullName} (${actorAdmin.role}) bloqué sur le module ${mod}.`
      });
      pushTeamNotification({
        type: 'unauthorized_access',
        priority: 'eleve',
        title: `Tentative d’accès refusée (${mod})`,
        message: `${actorAdmin.fullName} a tenté un accès "${lvl}" sur "${mod}" (droit actuel : "${currentLevel}").`,
        actorName: actorAdmin.fullName,
        targetAdminId: actorAdmin.id,
        targetName: actorAdmin.fullName
      });
      persistTeamDb();
      return res.status(403).json({
        success: false,
        allowed: false,
        error: 'PERMISSION_DENIED',
        moduleKey: mod,
        requiredLevel: lvl,
        currentLevel,
        message: `Accès refusé : le rôle "${getRoleDefinition(actorAdmin.role).label}" dispose de "${currentLevel}" sur "${mod}", alors que "${lvl}" est requis.`
      });
    }

    return res.json({
      success: true,
      allowed: true,
      moduleKey: mod,
      requiredLevel: lvl,
      currentLevel,
      actorRole: actorAdmin.role
    });
  });

  // 13. SENSITIVE FINANCIAL VALIDATIONS COORDINATION (ROLES + THRESHOLDS + NON-BYPASS)
  app.post('/api/team/financial-validations', (req: Request, res: Response) => {
    // Requires at least 'write' on 'refunds', 'withdrawals', or 'finances'
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const actorAdmin = resolveTeamMemberFromAuthCtx(authCtx);
    if (!actorAdmin || authCtx.token.spaceRole !== 'admin' || actorAdmin.status !== 'active') {
      return res.status(403).json({ success: false, error: 'ADMIN_REQUIRED', message: 'Compte administrateur actif requis.' });
    }

    const { operationType = 'remboursement', title, reference, amountFcfa, note } = req.body || {};
    const targetModule: TeamModuleKey =
      operationType === 'retrait_vendeur'
        ? 'withdrawals'
        : operationType === 'remboursement' || operationType === 'indemnisation'
        ? 'refunds'
        : 'finances';

    if (!hasTeamModulePermission(actorAdmin, targetModule, 'write')) {
      return res.status(403).json({
        success: false,
        error: 'PERMISSION_DENIED',
        message: `Accès refusé : permission "write" requise sur "${targetModule}" pour préparer cette opération financière.`
      });
    }

    const amount = Math.max(0, Math.round(Number(amountFcfa) || 0));
    if (amount <= 0) {
      return res.status(400).json({ success: false, error: 'INVALID_AMOUNT', message: 'Montant financier valide requis (> 0 FCFA).' });
    }

    const threshold = teamDb.settings.standardFinancialApprovalLimitFcfa;
    const requiresSuperAdmin = amount > threshold;
    const nowIso = new Date().toISOString();
    const ip = getClientIp(req);
    const ua = parseUserAgent(req.header('user-agent'));

    const item: TeamFinancialValidationRequest = {
      id: `finval-${crypto.randomUUID().slice(0, 10)}`,
      reference: String(reference || `FIN-${Date.now().toString().slice(-6)}`).trim(),
      operationType,
      title: redactSensitiveText(String(title || `Opération ${operationType} (${amount.toLocaleString('fr-FR')} FCFA)`).trim()),
      amountFcfa: amount,
      thresholdAppliedFcfa: threshold,
      requiresSuperAdmin,
      preparedById: actorAdmin.id,
      preparedByName: actorAdmin.fullName,
      preparedByRole: actorAdmin.role,
      preparedAt: nowIso,
      status: requiresSuperAdmin ? 'awaiting_super_admin' : 'prepared',
      note: redactSensitiveText(String(note || '').trim()),
      history: [
        {
          at: nowIso,
          actorId: actorAdmin.id,
          actorName: actorAdmin.fullName,
          actorRole: actorAdmin.role,
          action: 'Préparation opération financière',
          note: requiresSuperAdmin
            ? `Montant ${amount} FCFA > seuil ${threshold} FCFA : validation finale Super Administrateur requise.`
            : `Montant ${amount} FCFA ≤ seuil ${threshold} FCFA : éligible à validation administrateur autorisé.`
        }
      ]
    };

    teamDb.financialValidations.unshift(item);

    appendTeamJournal({
      actorId: actorAdmin.id,
      actorName: actorAdmin.fullName,
      actorProfessionalId: actorAdmin.professionalId,
      actorRole: actorAdmin.role,
      actionType: 'financial_operation_prepared',
      action: `Préparation opération financière ${item.reference} (${amount} FCFA)`,
      module: targetModule,
      targetName: item.reference,
      result: 'reussi',
      severity: requiresSuperAdmin ? 'eleve' : 'moyen',
      ipAddress: ip,
      device: `${ua.device} (${ua.browser})`,
      sessionId: authCtx.session.sessionId,
      afterValue: `${item.status} (${amount} FCFA)`,
      details: item.title
    });

    persistTeamDb();
    return res.status(201).json({ success: true, validation: item });
  });

  app.post('/api/team/financial-validations/:id/approve', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const actorAdmin = resolveTeamMemberFromAuthCtx(authCtx);
    if (!actorAdmin || authCtx.token.spaceRole !== 'admin' || actorAdmin.status !== 'active') {
      return res.status(403).json({ success: false, error: 'ADMIN_REQUIRED', message: 'Compte administrateur actif requis.' });
    }

    const item = teamDb.financialValidations.find((v) => v.id === req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Opération financière introuvable.' });
    }
    if (item.status === 'approved' || item.status === 'rejected') {
      return res.status(400).json({ success: false, error: 'ALREADY_DECIDED', message: `Opération déjà clôturée (${item.status}).` });
    }

    const ip = getClientIp(req);
    const ua = parseUserAgent(req.header('user-agent'));
    const targetModule: TeamModuleKey =
      item.operationType === 'retrait_vendeur'
        ? 'withdrawals'
        : item.operationType === 'remboursement' || item.operationType === 'indemnisation'
        ? 'refunds'
        : 'finances';

    // Non-bypass Rule 1: Must hold 'approve' permission on module
    if (!hasTeamModulePermission(actorAdmin, targetModule, 'approve')) {
      appendTeamJournal({
        actorId: actorAdmin.id,
        actorName: actorAdmin.fullName,
        actorProfessionalId: actorAdmin.professionalId,
        actorRole: actorAdmin.role,
        actionType: 'financial_approval_denied_permission',
        action: `Tentative d’approbation financière sans permission "approve" (${item.reference})`,
        module: targetModule,
        targetName: item.reference,
        result: 'refuse',
        severity: 'critique',
        ipAddress: ip,
        device: `${ua.device} (${ua.browser})`,
        details: `Niveau "approve" requis sur ${targetModule}.`
      });
      persistTeamDb();
      return res.status(403).json({
        success: false,
        error: 'PERMISSION_DENIED',
        message: `Validation refusée : niveau "approve" requis sur "${targetModule}".`
      });
    }

    // Non-bypass Rule 2: Preparer cannot self-approve unless Super Admin
    if (item.preparedById === actorAdmin.id && actorAdmin.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'DUAL_CONTROL_SELF_APPROVAL_BLOCKED',
        message: 'Règle de double contrôle : l’administrateur préparateur ne peut pas auto-valider sa propre opération.'
      });
    }

    // Non-bypass Rule 3: Above threshold -> STRICTLY Super Admin required
    if (item.requiresSuperAdmin && actorAdmin.role !== 'super_admin') {
      appendTeamJournal({
        actorId: actorAdmin.id,
        actorName: actorAdmin.fullName,
        actorProfessionalId: actorAdmin.professionalId,
        actorRole: actorAdmin.role,
        actionType: 'financial_threshold_bypass_blocked',
        action: `Contournement de seuil bloqué sur ${item.reference} (${item.amountFcfa} FCFA > ${item.thresholdAppliedFcfa} FCFA)`,
        module: 'finances',
        targetName: item.reference,
        result: 'bloque',
        severity: 'critique',
        ipAddress: ip,
        device: `${ua.device} (${ua.browser})`,
        details: `Montant supérieur au seuil (${item.thresholdAppliedFcfa} FCFA) : validation finale réservée au Super Administrateur.`
      });
      pushTeamNotification({
        type: 'financial_validation',
        priority: 'critique',
        title: `Seuil financier dépassé (${item.reference})`,
        message: `${actorAdmin.fullName} a tenté de valider ${item.amountFcfa.toLocaleString('fr-FR')} FCFA sans validation Super Admin.`,
        actorName: actorAdmin.fullName,
        targetAdminId: actorAdmin.id,
        targetName: item.reference
      });
      persistTeamDb();
      return res.status(403).json({
        success: false,
        error: 'SUPER_ADMIN_APPROVAL_REQUIRED',
        message: `Validation bloquée : montant (${item.amountFcfa.toLocaleString('fr-FR')} FCFA) supérieur au seuil de ${item.thresholdAppliedFcfa.toLocaleString('fr-FR')} FCFA. Seul le Super Administrateur peut effectuer la validation finale.`
      });
    }

    // MFA required when Super Admin approves high-value threshold
    if (item.requiresSuperAdmin && teamDb.settings.requireMfaForSensitiveTeamActions) {
      const mfaRes = verifyStepUpMfaForRequest(req, authCtx, true);
      if (!mfaRes.ok) return res.status(mfaRes.status).json({ success: false, error: mfaRes.error, message: mfaRes.message });
    }

    const nowIso = new Date().toISOString();
    const comment = redactSensitiveText(String(req.body?.note || 'Validation financière confirmée').trim());

    if (actorAdmin.role === 'super_admin') {
      item.finalValidatedById = actorAdmin.id;
      item.finalValidatedByName = actorAdmin.fullName;
      item.finalValidatedAt = nowIso;
    } else {
      item.approvedStandardById = actorAdmin.id;
      item.approvedStandardByName = actorAdmin.fullName;
      item.approvedStandardAt = nowIso;
    }
    item.status = 'approved';
    item.history.push({
      at: nowIso,
      actorId: actorAdmin.id,
      actorName: actorAdmin.fullName,
      actorRole: actorAdmin.role,
      action: item.requiresSuperAdmin ? 'Validation finale Super Administrateur' : 'Approbation standard (sous seuil)',
      note: comment
    });

    appendTeamJournal({
      actorId: actorAdmin.id,
      actorName: actorAdmin.fullName,
      actorProfessionalId: actorAdmin.professionalId,
      actorRole: actorAdmin.role,
      actionType: 'financial_operation_approved',
      action: `Approbation opération financière ${item.reference} (${item.amountFcfa} FCFA)`,
      module: targetModule,
      targetName: item.reference,
      result: 'reussi',
      severity: item.requiresSuperAdmin ? 'eleve' : 'moyen',
      ipAddress: ip,
      device: `${ua.device} (${ua.browser})`,
      sessionId: authCtx.session.sessionId,
      beforeValue: 'pending',
      afterValue: `approved par ${actorAdmin.fullName}`,
      details: comment
    });

    pushTeamNotification({
      type: 'financial_validation',
      priority: 'moyen',
      title: `Opération financière validée : ${item.reference}`,
      message: `${actorAdmin.fullName} a validé ${item.amountFcfa.toLocaleString('fr-FR')} FCFA (${item.operationType}).`,
      actorName: actorAdmin.fullName,
      targetName: item.reference
    });

    persistTeamDb();
    return res.json({ success: true, message: 'Opération financière validée et tracée.', validation: item });
  });

  app.post('/api/team/financial-validations/:id/reject', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const actorAdmin = resolveTeamMemberFromAuthCtx(authCtx);
    if (!actorAdmin || authCtx.token.spaceRole !== 'admin' || actorAdmin.status !== 'active') {
      return res.status(403).json({ success: false, error: 'ADMIN_REQUIRED', message: 'Compte administrateur requis.' });
    }

    const item = teamDb.financialValidations.find((v) => v.id === req.params.id);
    if (!item) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Opération introuvable.' });

    if (!hasTeamModulePermission(actorAdmin, 'finances', 'approve') && !hasTeamModulePermission(actorAdmin, 'refunds', 'approve')) {
      return res.status(403).json({ success: false, error: 'PERMISSION_DENIED', message: 'Permission d’approbation requise pour refuser.' });
    }

    const reason = redactSensitiveText(String(req.body?.reason || 'Rejeté lors du contrôle financier').trim());
    const nowIso = new Date().toISOString();
    item.status = 'rejected';
    item.rejectedById = actorAdmin.id;
    item.rejectedByName = actorAdmin.fullName;
    item.rejectedAt = nowIso;
    item.rejectionReason = reason;
    item.history.push({
      at: nowIso,
      actorId: actorAdmin.id,
      actorName: actorAdmin.fullName,
      actorRole: actorAdmin.role,
      action: 'Opération refusée',
      note: reason
    });

    appendTeamJournal({
      actorId: actorAdmin.id,
      actorName: actorAdmin.fullName,
      actorProfessionalId: actorAdmin.professionalId,
      actorRole: actorAdmin.role,
      actionType: 'financial_operation_rejected',
      action: `Refus opération financière ${item.reference}`,
      module: 'finances',
      targetName: item.reference,
      result: 'reussi',
      severity: 'eleve',
      ipAddress: getClientIp(req),
      device: parseUserAgent(req.header('user-agent')).device,
      details: reason
    });

    persistTeamDb();
    return res.json({ success: true, message: 'Opération financière refusée.', validation: item });
  });

  // 14. UPDATE TEAM & THRESHOLD SETTINGS (SUPER ADMIN + MFA)
  app.patch('/api/team/settings', (req: Request, res: Response) => {
    const guard = requireTeamAuth(req, res, { requireSuperAdmin: true, requireMfa: true });
    if (!guard) return;
    const { actorAdmin, authCtx } = guard;
    const patch = req.body || {};

    if (typeof patch.standardFinancialApprovalLimitFcfa === 'number' && patch.standardFinancialApprovalLimitFcfa >= 0) {
      teamDb.settings.standardFinancialApprovalLimitFcfa = Math.round(patch.standardFinancialApprovalLimitFcfa);
      teamDb.settings.superAdminRequiredAboveFcfa = Math.round(patch.standardFinancialApprovalLimitFcfa);
    }
    if (typeof patch.invitationValidityHours === 'number' && patch.invitationValidityHours >= 1) {
      teamDb.settings.invitationValidityHours = Math.round(patch.invitationValidityHours);
    }
    if (typeof patch.requireMfaForSensitiveTeamActions === 'boolean') {
      teamDb.settings.requireMfaForSensitiveTeamActions = patch.requireMfaForSensitiveTeamActions;
    }
    teamDb.settings.updatedAt = new Date().toISOString();
    teamDb.settings.updatedBy = actorAdmin.fullName;

    appendTeamJournal({
      actorId: actorAdmin.id,
      actorName: actorAdmin.fullName,
      actorProfessionalId: actorAdmin.professionalId,
      actorRole: actorAdmin.role,
      actionType: 'team_settings_updated',
      action: 'Mise à jour des seuils et paramètres de gouvernance Équipe',
      module: 'settings',
      targetName: 'Paramètres Équipe',
      result: 'reussi',
      severity: 'eleve',
      ipAddress: getClientIp(req),
      device: parseUserAgent(req.header('user-agent')).device,
      sessionId: authCtx.session.sessionId,
      afterValue: JSON.stringify({
        seuilFcfa: teamDb.settings.standardFinancialApprovalLimitFcfa,
        mfaStrict: teamDb.settings.requireMfaForSensitiveTeamActions
      }),
      details: 'Paramètres de validation financière et sécurité mis à jour.'
    });

    persistTeamDb();
    return res.json({ success: true, settings: teamDb.settings });
  });

  // 15. IMMUTABLE TEAM ACTIVITY JOURNAL PROTECTION (BLOCKS DELETE/PATCH)
  app.delete('/api/team/journal/:id', (req: Request, res: Response) => {
    const guard = requireTeamAuth(req, res);
    if (!guard) return;
    const { actorAdmin } = guard;
    const ip = getClientIp(req);
    const ua = parseUserAgent(req.header('user-agent'));

    appendTeamJournal({
      actorId: actorAdmin.id,
      actorName: actorAdmin.fullName,
      actorProfessionalId: actorAdmin.professionalId,
      actorRole: actorAdmin.role,
      actionType: 'journal_tamper_blocked',
      action: `Tentative de suppression du journal d’équipe bloquée (${req.params.id})`,
      module: 'activity_log',
      targetName: req.params.id,
      result: 'bloque',
      severity: 'critique',
      ipAddress: ip,
      device: `${ua.device} (${ua.browser})`,
      details: 'Le journal d’activité de l’équipe est strictement immuable.'
    });
    pushTeamNotification({
      type: 'unauthorized_access',
      priority: 'critique',
      title: 'Tentative d’altération du journal bloquée',
      message: `${actorAdmin.fullName} a tenté de supprimer l’entrée ${req.params.id} du journal d’équipe.`,
      actorName: actorAdmin.fullName,
      targetAdminId: actorAdmin.id
    });
    persistTeamDb();
    return res.status(403).json({
      success: false,
      error: 'JOURNAL_IMMUTABLE',
      message: 'Opération interdite : le journal d’activité de l’équipe administrateur est immuable.'
    });
  });

  app.patch('/api/team/journal/:id', (req: Request, res: Response) => {
    const guard = requireTeamAuth(req, res);
    if (!guard) return;
    return res.status(403).json({
      success: false,
      error: 'JOURNAL_IMMUTABLE',
      message: 'Opération interdite : le journal d’activité est en lecture seule.'
    });
  });

  // 16. MARK TEAM NOTIFICATION READ
  app.post('/api/team/notifications/:id/read', (req: Request, res: Response) => {
    const guard = requireTeamAuth(req, res);
    if (!guard) return;
    const notif = teamDb.notifications.find((n) => n.id === req.params.id);
    if (!notif) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Notification introuvable.' });
    notif.read = true;
    notif.readAt = new Date().toISOString();
    persistTeamDb();
    return res.json({ success: true, notification: notif });
  });

  app.post('/api/team/notifications/read-all', (req: Request, res: Response) => {
    const guard = requireTeamAuth(req, res);
    if (!guard) return;
    const nowIso = new Date().toISOString();
    teamDb.notifications.forEach((n) => {
      if (!n.read) {
        n.read = true;
        n.readAt = nowIso;
      }
    });
    persistTeamDb();
    return res.json({ success: true });
  });
}
