import type { Express, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { atomicWriteJsonFile } from './atomicFileStore';
import {
  authenticateSessionRequest,
  appendAuditEntry,
  getClientIp,
  getSecurityRuntimeSummary,
  getSecurityStaffDirectory,
  getSecurityTelemetrySnapshot,
  redactSensitiveText,
  verifyStepUpMfaForRequest,
  type AuthenticatedRequestContext
} from './securityModule';
import type {
  DataRetentionRuleRecord,
  MaskedUserDataInventoryRecord,
  PrivacyAuditReportEntry,
  PrivacyControlAuditItem,
  PrivacyDataCategoryGroup,
  PrivacyExportRecord,
  PrivacyIncidentRecord,
  PrivacyOverviewResponse,
  PrivacyPermissionKey,
  PrivacyPolicyDocumentRecord,
  PrivacyPolicyStatus,
  PrivacyRequestRecord,
  PrivacyRequestStatus,
  PrivacyRequestType,
  PrivacySettings,
  PrivacyStaffPermissionRow,
  PrivacyUserSpace,
  RevealedPrivacyRecordPayload,
  UserConsentRecord
} from '../src/types/privacy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const PRIVACY_DB_FILE = path.join(DATA_DIR, 'privacy_db.json');
const CREDITS_DB_FILE = path.join(DATA_DIR, 'credits_billing.json');

export const ALL_PRIVACY_PERMISSIONS: PrivacyPermissionKey[] = [
  'viewPersonalData',
  'viewKycDocuments',
  'viewFinancialData',
  'viewOrderData',
  'viewTechnicalLogs',
  'viewOtherAdminsData',
  'processPrivacyRequests',
  'exportUserData',
  'bulkExport',
  'managePrivacyIncidents',
  'managePolicies'
];

interface StoredUserRecord {
  id: string;
  userId: string;
  space: PrivacyUserSpace;
  fullName: string;
  email: string;
  phone: string;
  deliveryAddress: string;
  avatarPresent: boolean;
  shopOrCompanyName: string | null;
  kycStatus: 'verifie' | 'en_attente' | 'non_soumis';
  kycDocSummary: string;
  ordersCount: number;
  deliveriesCount: number;
  hasDeliveryProofs: boolean;
  hasOpenDispute: boolean;
  payoutTarget: string | null;
  commissionsFcfa: number;
  accountStatus: 'actif' | 'suspendu' | 'anonymise';
  anonymized: boolean;
  createdAt: string;
}

interface StoredExportPayload {
  exportId: string;
  token: string;
  expiresAt: string;
  contentType: string;
  filename: string;
  body: string;
}

interface PrivacyDatabase {
  usersDirectory: StoredUserRecord[];
  consents: UserConsentRecord[];
  requests: PrivacyRequestRecord[];
  retentionRules: DataRetentionRuleRecord[];
  exports: PrivacyExportRecord[];
  exportPayloads: Record<string, StoredExportPayload>;
  incidents: PrivacyIncidentRecord[];
  policies: PrivacyPolicyDocumentRecord[];
  auditHistory: PrivacyAuditReportEntry[];
  settings: PrivacySettings;
  staffPermissions: Record<string, Record<PrivacyPermissionKey, boolean>>;
}

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***';
  const [local, domain] = email.split('@');
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

function maskPhone(phone: string): string {
  if (!phone) return 'Non renseigné';
  const digits = phone.replace(/\s+/g, '');
  if (digits.length < 6) return '***';
  return `${digits.slice(0, 6)} ** ** ${digits.slice(-2)}`;
}

function maskName(name: string): string {
  if (!name) return 'Utilisateur';
  const parts = name.trim().split(/\s+/);
  return parts
    .map((p) => (p.length <= 2 ? `${p[0] || '*'}*` : `${p.slice(0, 2)}${'*'.repeat(Math.min(5, p.length - 2))}`))
    .join(' ');
}

function maskAddress(addr: string): string {
  if (!addr) return 'Non renseignée';
  const parts = addr.split(',');
  return parts.length > 1 ? `***, ${parts[parts.length - 1].trim()}` : `${addr.slice(0, 6)}***`;
}

function maskIp(ip: string): string {
  if (!ip) return '***.***.***.***';
  if (ip === '127.0.0.1' || ip === '::1') return '127.0.0.***';
  const seg = ip.split('.');
  if (seg.length === 4) return `${seg[0]}.${seg[1]}.***.***`;
  return `${ip.slice(0, 8)}:***`;
}

function strictMaskSecrets(text: string): string {
  if (!text) return '';
  return redactSensitiveText(String(text))
    .replace(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*\b/g, '[JWT_REDACTED]')
    .replace(/(password|mot_de_passe|otp|code_pin|api_key|secret)\s*[:=]\s*([^\s&;,}]+)/gi, '$1=[REDACTED]')
    .slice(0, 900);
}

function spaceLabel(space: PrivacyUserSpace): string {
  switch (space) {
    case 'client':
      return 'Client';
    case 'seller':
      return 'Vendeur';
    case 'admin':
      return 'Administrateur / Agent';
    default:
      return 'Compte historique';
  }
}

function defaultPermissionsForRole(role: string): Record<PrivacyPermissionKey, boolean> {
  if (role === 'super_admin') {
    return {
      viewPersonalData: true,
      viewKycDocuments: true,
      viewFinancialData: true,
      viewOrderData: true,
      viewTechnicalLogs: true,
      viewOtherAdminsData: true,
      processPrivacyRequests: true,
      exportUserData: true,
      bulkExport: true,
      managePrivacyIncidents: true,
      managePolicies: true
    };
  }
  if (role === 'admin') {
    return {
      viewPersonalData: true,
      viewKycDocuments: true,
      viewFinancialData: false,
      viewOrderData: true,
      viewTechnicalLogs: false,
      viewOtherAdminsData: false,
      processPrivacyRequests: true,
      exportUserData: true,
      bulkExport: false,
      managePrivacyIncidents: true,
      managePolicies: false
    };
  }
  if (role === 'security_agent') {
    return {
      viewPersonalData: false,
      viewKycDocuments: false,
      viewFinancialData: false,
      viewOrderData: false,
      viewTechnicalLogs: true,
      viewOtherAdminsData: false,
      processPrivacyRequests: false,
      exportUserData: false,
      bulkExport: false,
      managePrivacyIncidents: true,
      managePolicies: false
    };
  }
  return {
    viewPersonalData: false,
    viewKycDocuments: false,
    viewFinancialData: false,
    viewOrderData: false,
    viewTechnicalLogs: false,
    viewOtherAdminsData: false,
    processPrivacyRequests: false,
    exportUserData: false,
    bulkExport: false,
    managePrivacyIncidents: false,
    managePolicies: false
  };
}

function buildInitialUsersDirectory(): StoredUserRecord[] {
  const now = Date.now();
  const base: StoredUserRecord[] = [
    {
      id: 'priv-u-client-1',
      userId: 'client-demo-1',
      space: 'client',
      fullName: 'Amina Kouamé',
      email: 'amina.kouame@gmail.com',
      phone: '+225 07 11 22 33 44',
      deliveryAddress: 'Cocody Angré 8ème Tranche, Abidjan',
      avatarPresent: true,
      shopOrCompanyName: null,
      kycStatus: 'verifie',
      kycDocSummary: 'Identité vérifiée (Profil Client)',
      ordersCount: 14,
      deliveriesCount: 14,
      hasDeliveryProofs: true,
      hasOpenDispute: false,
      payoutTarget: null,
      commissionsFcfa: 0,
      accountStatus: 'actif',
      anonymized: false,
      createdAt: new Date(now - 210 * 86400_000).toISOString()
    },
    {
      id: 'priv-u-seller-1',
      userId: 'seller-wax-1',
      space: 'seller',
      fullName: 'Fatoumata Koné',
      email: 'boutique.wax@djassa.ci',
      phone: '+225 05 44 55 66 77',
      deliveryAddress: 'Adjamé Forum, Lot 14, Abidjan',
      avatarPresent: true,
      shopOrCompanyName: 'Boutique Wax & Élégance',
      kycStatus: 'verifie',
      kycDocSummary: 'CNI CI-882910 • RCCM CI-ABJ-2024-A-1182',
      ordersCount: 68,
      deliveriesCount: 65,
      hasDeliveryProofs: true,
      hasOpenDispute: false,
      payoutTarget: 'Wave +225 05 44 55 66 77',
      commissionsFcfa: 142500,
      accountStatus: 'actif',
      anonymized: false,
      createdAt: new Date(now - 180 * 86400_000).toISOString()
    }
  ];

  // Merge real staff accounts from securityModule
  for (const s of getSecurityStaffDirectory()) {
    base.push({
      id: `priv-u-${s.id}`,
      userId: s.id,
      space: 'admin',
      fullName: s.name,
      email: s.email,
      phone: '+225 07 00 11 22 33',
      deliveryAddress: 'Plateau, Siège DJASSA, Abidjan',
      avatarPresent: true,
      shopOrCompanyName: s.title,
      kycStatus: 'verifie',
      kycDocSummary: `Habilitation ${s.role}${s.mfaEnabled ? ' • MFA actif' : ''}`,
      ordersCount: 0,
      deliveriesCount: 0,
      hasDeliveryProofs: false,
      hasOpenDispute: false,
      payoutTarget: null,
      commissionsFcfa: 0,
      accountStatus: s.active ? 'actif' : 'suspendu',
      anonymized: false,
      createdAt: new Date(now - 260 * 86400_000).toISOString()
    });
  }

  return base;
}

function buildInitialConsents(users: StoredUserRecord[]): UserConsentRecord[] {
  const nowIso = new Date().toISOString();
  return users.map((u) => ({
    id: `cns-${u.userId}`,
    userId: u.userId,
    userLabel: maskName(u.fullName),
    space: u.space,
    cguAccepted: true,
    cguVersion: '2.1.0',
    cguAcceptedAt: u.createdAt,
    privacyAccepted: true,
    privacyVersion: '2.1.0',
    privacyAcceptedAt: u.createdAt,
    marketingOptIn: u.space === 'client',
    marketingUpdatedAt: u.space === 'client' ? nowIso : null,
    notificationsOptIn: true,
    notificationsUpdatedAt: u.createdAt,
    mandatoryLegalBasisNote:
      'Traitement des commandes, livraisons, preuves POD et paiements fondé sur l’exécution contractuelle et obligations légales (Loi n° 2013-450 Art. 14). Marketing commercial optionnel par opt-in séparé.',
    history: [
      {
        id: `ch-${crypto.randomUUID().slice(0, 8)}`,
        at: u.createdAt,
        consentType: 'politique_confidentialite',
        action: 'accepte',
        documentVersion: '2.1.0',
        actor: maskName(u.fullName),
        channel: 'Inscription plateforme'
      }
    ]
  }));
}

function buildInitialRetentionRules(): DataRetentionRuleRecord[] {
  const now = new Date();
  const iso = now.toISOString();
  const plusDays = (d: number) => new Date(now.getTime() + d * 86400_000).toISOString();

  return [
    {
      id: 'ret-users',
      categoryKey: 'users',
      label: 'Comptes utilisateurs (Client, Vendeur, Livreur)',
      purpose: 'Gestion du compte, authentification et historique relation commerciale',
      legalReferenceCi: 'Loi n° 2013-450 (Finalité limitée) — 3 ans après dernière activité',
      retentionDays: 1095,
      allowDeletionAfterExpiry: false,
      anonymizeInsteadOfDelete: true,
      legalHoldProtection: true,
      activeRecordsCount: 0,
      oldestRecordDate: iso,
      nextScheduledPurgeAt: plusDays(1095),
      status: 'actif',
      extendedRetentionNote: 'Anonymisation automatique des données identifiantes si aucune commande/litige en cours.',
      updatedAt: iso,
      updatedBy: 'Système'
    },
    {
      id: 'ret-admin-docs',
      categoryKey: 'admin_docs',
      label: 'Documents administratifs & KYC (CNI, RCCM, Permis)',
      purpose: 'Vérification d’identité marchands/livreurs et lutte contre la fraude (LCB-FT)',
      legalReferenceCi: 'Loi n° 2013-450 + Obligations LCB-FT UEMOA (5 ans après fin relation)',
      retentionDays: 1825,
      allowDeletionAfterExpiry: true,
      anonymizeInsteadOfDelete: false,
      legalHoldProtection: true,
      activeRecordsCount: 0,
      oldestRecordDate: iso,
      nextScheduledPurgeAt: plusDays(1825),
      status: 'actif',
      extendedRetentionNote: 'Conservation prolongée si compte suspendu pour fraude ou contrôle réglementaire.',
      updatedAt: iso,
      updatedBy: 'Système'
    },
    {
      id: 'ret-orders',
      categoryKey: 'orders',
      label: 'Commandes & preuves de livraison (POD)',
      purpose: 'Preuve contractuelle d’achat, suivi livraison et résolution des réclamations',
      legalReferenceCi: 'Droit commercial OHADA & preuve transactionnelle (10 ans)',
      retentionDays: 3650,
      allowDeletionAfterExpiry: false,
      anonymizeInsteadOfDelete: true,
      legalHoldProtection: true,
      activeRecordsCount: 0,
      oldestRecordDate: iso,
      nextScheduledPurgeAt: plusDays(3650),
      status: 'actif',
      extendedRetentionNote: 'Suppression stricte bloquée : anonymisation seule possible après expiration légale.',
      updatedAt: iso,
      updatedBy: 'Système'
    },
    {
      id: 'ret-payments',
      categoryKey: 'payments',
      label: 'Paiements & grands livres financiers',
      purpose: 'Traçabilité comptable, fiscale, commissions et rapprochement GeniusPay / Crédits IA',
      legalReferenceCi: 'Acte uniforme OHADA Comptabilité (10 ans obligatoire)',
      retentionDays: 3650,
      allowDeletionAfterExpiry: false,
      anonymizeInsteadOfDelete: false,
      legalHoldProtection: true,
      activeRecordsCount: 0,
      oldestRecordDate: iso,
      nextScheduledPurgeAt: plusDays(3650),
      status: 'actif',
      extendedRetentionNote: 'Conservation comptable obligatoire non supprimable.',
      updatedAt: iso,
      updatedBy: 'Système'
    },
    {
      id: 'ret-withdrawals',
      categoryKey: 'withdrawals',
      label: 'Retraits & reversements vendeurs / livreurs',
      purpose: 'Justification des décaissements Mobile Money / virements',
      legalReferenceCi: 'OHADA & Réglementation financière BCEAO (10 ans)',
      retentionDays: 3650,
      allowDeletionAfterExpiry: false,
      anonymizeInsteadOfDelete: false,
      legalHoldProtection: true,
      activeRecordsCount: 0,
      oldestRecordDate: iso,
      nextScheduledPurgeAt: plusDays(3650),
      status: 'actif',
      extendedRetentionNote: 'Preuves de versement verrouillées contre toute suppression.',
      updatedAt: iso,
      updatedBy: 'Système'
    },
    {
      id: 'ret-disputes',
      categoryKey: 'disputes',
      label: 'Réclamations et litiges',
      purpose: 'Instruction des différends clients/vendeurs/livreurs et recours éventuels',
      legalReferenceCi: 'Garde juridique (Legal Hold) jusqu’à clôture + 5 ans',
      retentionDays: 1825,
      allowDeletionAfterExpiry: false,
      anonymizeInsteadOfDelete: true,
      legalHoldProtection: true,
      activeRecordsCount: 0,
      oldestRecordDate: iso,
      nextScheduledPurgeAt: plusDays(1825),
      status: 'gele_litige',
      extendedRetentionNote: 'Gel automatique actif tant qu’un litige est ouvert.',
      updatedAt: iso,
      updatedBy: 'Système'
    },
    {
      id: 'ret-activity-logs',
      categoryKey: 'activity_logs',
      label: 'Journaux d’activité & piste d’audit',
      purpose: 'Sécurité SOC, traçabilité des accès administrateurs et non-répudiation SHA-256',
      legalReferenceCi: 'Loi n° 2013-451 Cybercriminalité CI & sécurité (12 à 36 mois)',
      retentionDays: 730,
      allowDeletionAfterExpiry: true,
      anonymizeInsteadOfDelete: true,
      legalHoldProtection: true,
      activeRecordsCount: 0,
      oldestRecordDate: iso,
      nextScheduledPurgeAt: plusDays(730),
      status: 'actif',
      extendedRetentionNote: 'Chaînage SHA-256 immuable pendant toute la durée de rétention.',
      updatedAt: iso,
      updatedBy: 'Système'
    },
    {
      id: 'ret-tech-logs',
      categoryKey: 'technical_logs',
      label: 'Journaux techniques & sondes système',
      purpose: 'Diagnostic des pannes, erreurs applicatives et disponibilité',
      legalReferenceCi: 'Minimisation des données — purge/rotation à 90 jours',
      retentionDays: 90,
      allowDeletionAfterExpiry: true,
      anonymizeInsteadOfDelete: false,
      legalHoldProtection: false,
      activeRecordsCount: 0,
      oldestRecordDate: iso,
      nextScheduledPurgeAt: plusDays(90),
      status: 'actif',
      extendedRetentionNote: 'Secrets, mots de passe, OTP et jetons automatiquement masqués.',
      updatedAt: iso,
      updatedBy: 'Système'
    },
    {
      id: 'ret-sessions',
      categoryKey: 'sessions_devices',
      label: 'Sessions actives, appareils & connexions',
      purpose: 'Protection contre la prise de contrôle de compte et révocation de session',
      legalReferenceCi: 'Loi n° 2013-451 (12 mois)',
      retentionDays: 365,
      allowDeletionAfterExpiry: true,
      anonymizeInsteadOfDelete: true,
      legalHoldProtection: false,
      activeRecordsCount: 0,
      oldestRecordDate: iso,
      nextScheduledPurgeAt: plusDays(365),
      status: 'actif',
      extendedRetentionNote: 'Adresses IP masquées dans les vues standard.',
      updatedAt: iso,
      updatedBy: 'Système'
    }
  ];
}

function buildInitialPolicies(): PrivacyPolicyDocumentRecord[] {
  const nowIso = new Date().toISOString();
  return [
    {
      id: 'pol-privacy',
      docType: 'politique_confidentialite',
      title: 'Politique de confidentialité DJASSA',
      currentVersion: '2.1.0',
      publishedAt: nowIso,
      effectiveAt: nowIso,
      validatedBy: 'Super Administrateur (Validation interne — Dossier ARTCI à finaliser)',
      status: 'publie',
      requiresReconsentOnPublish: true,
      summary:
        'Décrit les données collectées sur DJASSA (Client, Vendeur, Livreur, Entreprise), leurs finalités, la base légale sous la Loi n° 2013-450 (Côte d’Ivoire) et les droits d’accès, de rectification et d’anonymisation.',
      contentPreview:
        'Article 1 — Responsable du traitement : DJASSA Marketplace (Abidjan, Côte d’Ivoire). Article 2 — Finalités : Exécution des commandes, livraisons géolocalisées, paiements sécurisés et prévention de fraude...',
      history: [
        {
          version: '2.1.0',
          publishedAt: nowIso,
          validatedBy: 'Amadou Diallo',
          notes: 'Ajout de la réattribution en cas de panne livreur et du registre des consentements.'
        }
      ]
    },
    {
      id: 'pol-cgu',
      docType: 'cgu',
      title: 'Conditions Générales d’Utilisation (CGU)',
      currentVersion: '2.1.0',
      publishedAt: nowIso,
      effectiveAt: nowIso,
      validatedBy: 'Amadou Diallo',
      status: 'publie',
      requiresReconsentOnPublish: true,
      summary: 'Cadre contractuel d’utilisation des 5 espaces DJASSA, responsabilités des vendeurs, livreurs et entreprises de livraison.',
      contentPreview:
        'Les présentes CGU régissent l’accès à la marketplace DJASSA, la vérification KYC des vendeurs/livreurs et le traitement des litiges...',
      history: [
        {
          version: '2.1.0',
          publishedAt: nowIso,
          validatedBy: 'Amadou Diallo',
          notes: 'Mise à jour des règles de preuve de livraison (POD).'
        }
      ]
    },
    {
      id: 'pol-cookies',
      docType: 'politique_cookies',
      title: 'Politique de cookies et traceurs',
      currentVersion: '1.2.0',
      publishedAt: nowIso,
      effectiveAt: nowIso,
      validatedBy: 'Amadou Diallo',
      status: 'publie',
      requiresReconsentOnPublish: false,
      summary: 'Distinction stricte entre jetons techniques essentiels (authentification HMAC, panier) et préférences optionnelles.',
      contentPreview:
        'DJASSA utilise exclusivement des jetons de session nécessaires à la sécurité et à la continuité du service...',
      history: [
        {
          version: '1.2.0',
          publishedAt: nowIso,
          validatedBy: 'Amadou Diallo',
          notes: 'Clarification des traceurs de session admin.'
        }
      ]
    },
    {
      id: 'pol-retention',
      docType: 'politique_conservation',
      title: 'Politique de conservation et d’archivage des données',
      currentVersion: '1.4.0',
      publishedAt: nowIso,
      effectiveAt: nowIso,
      validatedBy: 'Amadou Diallo',
      status: 'publie',
      requiresReconsentOnPublish: false,
      summary: 'Durées de rétention par catégorie (OHADA 10 ans pour paiements/commandes, 90j logs techniques, purge/anonymisation).',
      contentPreview:
        'Les données comptables, paiements et preuves de livraison sont conservées 10 ans conformément aux obligations commerciales...',
      history: [
        {
          version: '1.4.0',
          publishedAt: nowIso,
          validatedBy: 'Amadou Diallo',
          notes: 'Alignement avec la garde juridique (Legal Hold).'
        }
      ]
    },
    {
      id: 'pol-incidents',
      docType: 'procedure_incidents',
      title: 'Procédure de gestion des incidents & violations de données',
      currentVersion: '1.1.0',
      publishedAt: nowIso,
      effectiveAt: nowIso,
      validatedBy: 'Amadou Diallo',
      status: 'publie',
      requiresReconsentOnPublish: false,
      summary: 'Protocole de confinement, investigation, journalisation et évaluation de notification ARTCI-CI / personnes concernées.',
      contentPreview:
        'Tout accès suspect, export massif bloqué ou fuite potentielle déclenche une isolation immédiate et une évaluation réglementaire...',
      history: [
        {
          version: '1.1.0',
          publishedAt: nowIso,
          validatedBy: 'Amadou Diallo',
          notes: 'Validation humaine obligatoire avant toute notification externe ARTCI.'
        }
      ]
    },
    {
      id: 'pol-registre',
      docType: 'registre_traitements',
      title: 'Registre des traitements de données (Loi n° 2013-450)',
      currentVersion: '1.0.0',
      publishedAt: null,
      effectiveAt: null,
      validatedBy: null,
      status: 'brouillon',
      requiresReconsentOnPublish: false,
      summary: 'Inventaire complet des traitements de données personnelles destiné au contrôle de conformité ARTCI Côte d’Ivoire.',
      contentPreview:
        'En cours de revue juridique finale pour dépôt/archivage auprès de l’Autorité de Régulation des Télécommunications/TIC de Côte d’Ivoire (ARTCI).',
      history: []
    }
  ];
}

function buildDefaultSettings(): PrivacySettings {
  return {
    exportLinkTtlMinutes: 15,
    requireMfaForSensitiveReveal: true,
    requireMfaForExport: true,
    requireIdentityCheckForDsar: true,
    maskSensitiveDataByDefault: true,
    dsarSlaDays: 30,
    legalFrameworkLabel: 'Loi n° 2013-450 du 19 juin 2013 (Côte d’Ivoire — ARTCI) & Acte Uniforme OHADA',
    dpoContactEmail: 'dpo-confidentialite@djassa.ci',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Système'
  };
}

function buildDefaultDb(): PrivacyDatabase {
  const usersDirectory = buildInitialUsersDirectory();
  return {
    usersDirectory,
    consents: buildInitialConsents(usersDirectory),
    requests: [],
    retentionRules: buildInitialRetentionRules(),
    exports: [],
    exportPayloads: {},
    incidents: [],
    policies: buildInitialPolicies(),
    auditHistory: [],
    settings: buildDefaultSettings(),
    staffPermissions: {}
  };
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadPrivacyDb(): PrivacyDatabase {
  ensureDataDir();
  if (!fs.existsSync(PRIVACY_DB_FILE)) {
    const seeded = buildDefaultDb();
    try {
      fs.writeFileSync(PRIVACY_DB_FILE, JSON.stringify(seeded, null, 2));
    } catch {
      // memory fallback
    }
    return seeded;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(PRIVACY_DB_FILE, 'utf8')) as Partial<PrivacyDatabase>;
    const usersDirectory =
      Array.isArray(parsed.usersDirectory) && parsed.usersDirectory.length > 0
        ? parsed.usersDirectory
        : buildInitialUsersDirectory();
    return {
      usersDirectory,
      consents:
        Array.isArray(parsed.consents) && parsed.consents.length > 0
          ? parsed.consents
          : buildInitialConsents(usersDirectory),
      requests: Array.isArray(parsed.requests) ? parsed.requests : [],
      retentionRules:
        Array.isArray(parsed.retentionRules) && parsed.retentionRules.length > 0
          ? parsed.retentionRules
          : buildInitialRetentionRules(),
      exports: Array.isArray(parsed.exports) ? parsed.exports : [],
      exportPayloads: parsed.exportPayloads || {},
      incidents: Array.isArray(parsed.incidents) ? parsed.incidents : [],
      policies:
        Array.isArray(parsed.policies) && parsed.policies.length > 0
          ? parsed.policies
          : buildInitialPolicies(),
      auditHistory: Array.isArray(parsed.auditHistory) ? parsed.auditHistory : [],
      settings: { ...buildDefaultSettings(), ...(parsed.settings || {}) },
      staffPermissions: parsed.staffPermissions || {}
    };
  } catch {
    return buildDefaultDb();
  }
}

const privDb: PrivacyDatabase = loadPrivacyDb();

function persistPrivDb() {
  if (!atomicWriteJsonFile(PRIVACY_DB_FILE, privDb, { context: 'PrivacyModule' })) {
    console.error('[PrivacyModule] Failed to persist privacy_db.json');
  }
}

function readCreditsDbSafe(): {
  accounts: Record<string, { balance: number; updatedAt: string }>;
  recharges: Array<{ id: string; userId: string; amountFcfa: number; createdAt: string }>;
  usages: Array<{ id: string; userId: string; amountChargedFcfa: number; createdAt: string }>;
} {
  try {
    if (!fs.existsSync(CREDITS_DB_FILE)) return { accounts: {}, recharges: [], usages: [] };
    const parsed = JSON.parse(fs.readFileSync(CREDITS_DB_FILE, 'utf8'));
    return {
      accounts: parsed.accounts || {},
      recharges: Array.isArray(parsed.recharges) ? parsed.recharges : [],
      usages: Array.isArray(parsed.usages) ? parsed.usages : []
    };
  } catch {
    return { accounts: {}, recharges: [], usages: [] };
  }
}

function getEffectivePermissionsForStaff(staffId: string, role: string): Record<PrivacyPermissionKey, boolean> {
  if (role === 'super_admin') return defaultPermissionsForRole('super_admin');
  if (role === 'other_agent') return defaultPermissionsForRole('other_agent');
  const stored = privDb.staffPermissions[staffId];
  const base = defaultPermissionsForRole(role);
  if (!stored) return base;
  const out = { ...base };
  for (const k of ALL_PRIVACY_PERMISSIONS) {
    if (typeof stored[k] === 'boolean') out[k] = stored[k];
  }
  return out;
}

function buildPermissionsDirectory(): PrivacyStaffPermissionRow[] {
  return getSecurityStaffDirectory().map((s) => ({
    staffId: s.id,
    name: s.name,
    email: s.email,
    role: s.role,
    active: s.active,
    permissions: getEffectivePermissionsForStaff(s.id, s.role)
  }));
}

function appendPrivacyAudit(
  req: Request | null,
  authCtx: AuthenticatedRequestContext | null,
  payload: {
    actionType: string;
    action: string;
    target: string;
    result: 'reussi' | 'bloque' | 'refuse';
    severity: 'information' | 'faible' | 'moyen' | 'eleve' | 'critique';
    details: string;
    entityType?: string;
    entityId?: string;
  }
) {
  const actor = authCtx?.staff;
  const entry: PrivacyAuditReportEntry = {
    id: `paud-${crypto.randomUUID().slice(0, 10)}`,
    at: new Date().toISOString(),
    actorId: actor?.id || 'system-privacy',
    actorName: actor?.name || 'Module Confidentialité',
    actionType: payload.actionType,
    action: payload.action,
    target: strictMaskSecrets(payload.target),
    result: payload.result,
    details: strictMaskSecrets(payload.details)
  };
  privDb.auditHistory.unshift(entry);
  if (privDb.auditHistory.length > 350) privDb.auditHistory = privDb.auditHistory.slice(0, 350);
  persistPrivDb();

  appendAuditEntry({
    actorId: entry.actorId,
    actorName: entry.actorName,
    actorAccountLabel: actor?.email || 'privacy@djassa.ci',
    actorRole: actor?.role || 'system',
    space: 'admin',
    category: 'security',
    actionType: payload.actionType,
    action: payload.action,
    target: entry.target,
    targetType: 'privacy',
    entityType: payload.entityType || 'privacy_governance',
    entityId: payload.entityId,
    result: payload.result === 'reussi' ? 'reussi' : payload.result === 'bloque' ? 'bloque' : 'refuse',
    severity: payload.severity,
    device: authCtx?.session?.device || 'Server',
    os: authCtx?.session?.os || 'Linux',
    browser: authCtx?.session?.browser || 'API',
    sessionId: authCtx?.session?.sessionId,
    details: entry.details,
    ipAddress: req ? getClientIp(req) : '127.0.0.1'
  });
}

function checkLegalHoldForUser(user: StoredUserRecord): { locked: boolean; reason: string | null; confirmedTxCount: number } {
  const creditsDb = readCreditsDbSafe();
  const secSnap = getSecurityTelemetrySnapshot();
  const recharges = creditsDb.recharges.filter((r) => r.userId === user.userId).length;
  const ledgerMatches = secSnap.financeLedger.filter(
    (f) =>
      (f.accountName || '').toLowerCase() === (user.fullName || '').toLowerCase() ||
      (f.accountId || '').toLowerCase() === (user.userId || '').toLowerCase() ||
      (f.payoutTarget || '').toLowerCase().includes((user.userId || '').toLowerCase())
  ).length;
  const confirmedTxCount = recharges + ledgerMatches;

  const reasons: string[] = [];
  if (confirmedTxCount > 0 || user.commissionsFcfa > 0) {
    reasons.push(`Obligation comptable OHADA 10 ans (${confirmedTxCount} transaction(s) / écriture(s) financière(s))`);
  }
  if (user.hasDeliveryProofs || user.ordersCount > 0 || user.deliveriesCount > 0) {
    reasons.push('Preuves contractuelles de commandes/livraisons (POD)');
  }
  if (user.hasOpenDispute) {
    reasons.push('Litige ou réclamation en cours (Legal Hold)');
  }

  return {
    locked: reasons.length > 0,
    reason: reasons.length > 0 ? reasons.join(' • ') : null,
    confirmedTxCount
  };
}

function buildComplianceAuditChecklist(): PrivacyControlAuditItem[] {
  const secSummary = getSecurityRuntimeSummary();
  const hasR2 = Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID);
  const hasFirebase = fs.existsSync(path.join(ROOT_DIR, 'firebase-applet-config.json')) || Boolean(process.env.FIREBASE_PROJECT_ID);
  const registre = privDb.policies.find((p) => p.docType === 'registre_traitements');

  return [
    {
      id: 'ctrl-masking',
      label: 'Masquage par défaut des données personnelles et financières',
      status: privDb.settings.maskSensitiveDataByDefault ? 'actif' : 'partiel',
      details: 'Les emails, téléphones, adresses, IP et identifiants KYC sont masqués dans toutes les vues standard.',
      category: 'technique'
    },
    {
      id: 'ctrl-mfa-reveal',
      label: 'Contrôle d’accès RBAC (11 droits) & MFA step-up pour révélation/export',
      status: secSummary.hmacConfigured && privDb.settings.requireMfaForSensitiveReveal ? 'actif' : 'partiel',
      details: 'Révélation ponctuelle par enregistrement uniquement, jamais en masse, avec journalisation audit SHA-256.',
      category: 'technique'
    },
    {
      id: 'ctrl-log-redaction',
      label: 'Filtrage strict des secrets, mots de passe, OTP et jetons',
      status: 'actif',
      details: 'Aucun mot de passe, OTP, clé API ou Bearer token n’est stocké en clair ou exposé dans les journaux.',
      category: 'technique'
    },
    {
      id: 'ctrl-export-ttl',
      label: 'Liens d’exportation temporaires expirables & blocage export massif',
      status: 'actif',
      details: `Expiration automatique configurée à ${privDb.settings.exportLinkTtlMinutes} minutes ; export massif bloqué sans permission explicite.`,
      category: 'technique'
    },
    {
      id: 'ctrl-at-rest-storage',
      label: 'Chiffrement au repos des fichiers serveur (/server/data/*.json)',
      status: 'partiel',
      details:
        'Les fichiers JSON locaux sont stockés sur le disque serveur sans chiffrement applicatif AES au repos ; privilégier un SGBD chiffré en production.',
      category: 'technique'
    },
    {
      id: 'ctrl-external-storage',
      label: 'Stockage externe chiffré (Cloudflare R2 / Firebase)',
      status: hasR2 || hasFirebase ? 'actif' : 'non_configure',
      details: hasR2 || hasFirebase
        ? 'Connecteur externe détecté dans l’environnement.'
        : 'R2 et Firebase ne sont pas configurés sur cet environnement ; vérification externe non effectuée.',
      category: 'technique'
    },
    {
      id: 'ctrl-artci-ci',
      label: 'Conformité juridique Loi n° 2013-450 (Déclaration / Dossier ARTCI Côte d’Ivoire)',
      status: registre?.status === 'publie' ? 'a_valider_juridique' : 'a_valider_juridique',
      details:
        'Les contrôles techniques sont actifs, mais la conformité réglementaire complète requiert une validation juridique formelle et le dépôt auprès de l’ARTCI-CI.',
      category: 'reglementaire_ci'
    }
  ];
}

function expireOldExports() {
  const nowMs = Date.now();
  let changed = false;
  for (const exp of privDb.exports) {
    if (exp.status === 'disponible' && new Date(exp.expiresAt).getTime() <= nowMs) {
      exp.status = 'expire';
      delete privDb.exportPayloads[exp.id];
      changed = true;
    }
  }
  if (changed) persistPrivDb();
}

function buildOverviewResponse(authCtx: AuthenticatedRequestContext): PrivacyOverviewResponse {
  expireOldExports();
  const actor = authCtx.staff!;
  const myPerms = getEffectivePermissionsForStaff(actor.id, actor.role);
  const creditsDb = readCreditsDbSafe();
  const secSnap = getSecurityTelemetrySnapshot();

  const inventory: MaskedUserDataInventoryRecord[] = privDb.usersDirectory.map((u) => {
    const wallet = creditsDb.accounts[u.userId]?.balance;
    const lock = checkLegalHoldForUser(u);
    const userSessions = secSnap.sessions.filter(
      (s) => s.userId === u.userId || (s.accountEmail || '').toLowerCase() === (u.email || '').toLowerCase()
    );
    const activeSessions = userSessions.filter((s) => s.status === 'active').length;
    const latestSession = userSessions[0];
    const auditCount = secSnap.auditLogs.filter(
      (a) => a.actorId === u.userId || (a.actorAccountLabel || '').toLowerCase() === (u.email || '').toLowerCase()
    ).length;

    return {
      id: u.id,
      userId: u.userId,
      space: u.space,
      spaceLabel: spaceLabel(u.space),
      displayLabel: u.anonymized ? u.fullName : maskName(u.fullName),
      accountStatus: u.accountStatus,
      anonymized: u.anonymized,
      createdAt: u.createdAt,
      hasLegalRetentionLock: lock.locked,
      legalLockReason: lock.reason,
      personalMasked: {
        fullName: u.anonymized ? u.fullName : maskName(u.fullName),
        email: u.anonymized ? 'anonymise@redacted.ci' : maskEmail(u.email),
        phone: u.anonymized ? '+225 ** ** ** **' : maskPhone(u.phone),
        deliveryAddress: u.anonymized ? 'Adresse anonymisée' : maskAddress(u.deliveryAddress),
        avatarPresent: u.avatarPresent && !u.anonymized
      },
      commercialMasked: {
        shopOrCompanyName: u.shopOrCompanyName,
        kycStatus: u.kycStatus,
        kycDocSummary: u.anonymized ? 'Document archivé (anonymisé)' : u.kycDocSummary.replace(/\d{3,}/g, '***'),
        ordersCount: u.ordersCount,
        deliveriesCount: u.deliveriesCount
      },
      financialMasked: {
        walletSummary:
          typeof wallet === 'number'
            ? `${wallet} crédits IA (${(wallet * 10).toLocaleString('fr-FR')} FCFA)`
            : 'Solde masqué (révélation MFA)',
        confirmedTransactionsCount: lock.confirmedTxCount,
        payoutTargetMasked: u.payoutTarget ? maskPhone(u.payoutTarget) : null,
        commissionsSummary: u.commissionsFcfa > 0 ? 'Historique commissions verrouillé OHADA' : 'Aucune commission'
      },
      technicalSummary: {
        activeSessionsCount: activeSessions,
        lastDevice: latestSession ? `${latestSession.device} (${latestSession.os})` : 'Non connecté récemment',
        lastIpMasked: latestSession ? maskIp(latestSession.ipAddress) : '***.***.***.***',
        lastLoginAt: latestSession?.lastSeenAt || null,
        auditActionsCount: auditCount
      }
    };
  });

  // Update dynamic counts on retention rules
  const updatedRules: DataRetentionRuleRecord[] = privDb.retentionRules.map((rule) => {
    let count = rule.activeRecordsCount;
    if (rule.categoryKey === 'users') count = privDb.usersDirectory.length;
    else if (rule.categoryKey === 'admin_docs') count = privDb.usersDirectory.filter((u) => u.space !== 'client').length;
    else if (rule.categoryKey === 'orders') count = privDb.usersDirectory.reduce((s, u) => s + u.ordersCount, 0);
    else if (rule.categoryKey === 'payments') count = creditsDb.recharges.length + secSnap.financeLedger.length;
    else if (rule.categoryKey === 'disputes') count = privDb.usersDirectory.filter((u) => u.hasOpenDispute).length;
    else if (rule.categoryKey === 'activity_logs') count = secSnap.auditLogs.length;
    else if (rule.categoryKey === 'sessions_devices') count = secSnap.sessions.length;
    return {
      ...rule,
      activeRecordsCount: count
    };
  });

  const controlAudit = buildComplianceAuditChecklist();
  const requestsPending = privDb.requests.filter(
    (r) => r.status !== 'traitee' && r.status !== 'refusee'
  ).length;
  const requestsProcessed = privDb.requests.filter(
    (r) => r.status === 'traitee' || r.status === 'refusee'
  ).length;
  const openIncidents = privDb.incidents.filter((i) => i.status !== 'resolu').length;

  let overallStatus: PrivacyOverviewResponse['kpis']['overallStatus'] = 'conforme_partiel';
  let overallStatusLabel = 'Contrôles techniques actifs • Validation juridique ARTCI-CI requise';
  if (privDb.incidents.some((i) => i.severity === 'critique' && i.status !== 'resolu')) {
    overallStatus = 'vigilance_critique';
    overallStatusLabel = 'Incident de confidentialité critique en cours de traitement';
  } else if (openIncidents > 0 || requestsPending > 0) {
    overallStatus = 'action_requise';
    overallStatusLabel = `${requestsPending} demande(s) & ${openIncidents} incident(s) à traiter`;
  }

  // Filter audit logs visible according to permissions
  const visibleAuditHistory = myPerms.viewTechnicalLogs
    ? privDb.auditHistory.slice(0, 120)
    : privDb.auditHistory.filter((a) => !a.actionType.includes('technical')).slice(0, 60);

  return {
    success: true,
    serverTime: new Date().toISOString(),
    kpis: {
      overallStatus,
      overallStatusLabel,
      activeAccountsCount: privDb.usersDirectory.filter((u) => u.accountStatus === 'actif').length,
      requestsTotal: privDb.requests.length,
      requestsPending,
      requestsProcessed,
      privacyIncidentsOpen: openIncidents,
      retentionCategoriesCount: updatedRules.length,
      lastComplianceCheckAt: new Date().toISOString()
    },
    controlAudit,
    inventory,
    consents: privDb.consents,
    requests: privDb.requests.slice(0, 100),
    retentionRules: updatedRules,
    exports: privDb.exports.slice(0, 80).map((e) => ({
      ...e,
      // Never return downloadToken in bulk list; download uses one-time returned token or authenticated stream
      downloadToken: undefined
    })),
    incidents: privDb.incidents.slice(0, 80),
    policies: privDb.policies,
    auditHistory: visibleAuditHistory,
    settings: privDb.settings,
    myPermissions: myPerms,
    permissionsDirectory: buildPermissionsDirectory(),
    myRole: actor.role
  };
}

function requirePrivacyAccess(
  perm?: PrivacyPermissionKey,
  options?: { requireSuperAdmin?: boolean; requireStepUpMfa?: boolean }
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const staff = authCtx.staff;
    if (!staff || !staff.active || staff.role === 'other_agent') {
      return res.status(403).json({
        success: false,
        error: 'ACCESS_DENIED',
        message: 'Accès réservé au personnel administrateur autorisé.'
      });
    }
    if (options?.requireSuperAdmin && staff.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: 'SUPER_ADMIN_REQUIRED',
        message: 'Opération réservée au Super Administrateur.'
      });
    }
    if (perm) {
      const effective = getEffectivePermissionsForStaff(staff.id, staff.role);
      if (!effective[perm]) {
        return res.status(403).json({
          success: false,
          error: 'PERMISSION_DENIED',
          message: `Permission confidentialité requise : ${perm}.`
        });
      }
    }
    if (options?.requireStepUpMfa) {
      const mfaCheck = verifyStepUpMfaForRequest(req, authCtx, true);
      if (!mfaCheck.ok) {
        return res.status(mfaCheck.status).json({
          success: false,
          error: mfaCheck.error,
          message: mfaCheck.message
        });
      }
    }
    (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx = authCtx;
    next();
  };
}

export function installPrivacyRoutes(app: Express) {
  app.get('/api/privacy/overview', requirePrivacyAccess(), (req: Request, res: Response) => {
    const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
    res.json(buildOverviewResponse(authCtx));
  });

  // Sync non-secret directory metadata from live AppContext without exposing passwords/secrets
  app.post('/api/privacy/sync-directory', requirePrivacyAccess(), (req: Request, res: Response) => {
    const incomingUsers = Array.isArray(req.body?.users) ? req.body.users : [];
    let added = 0;
    for (const raw of incomingUsers.slice(0, 60)) {
      if (!raw?.email || !raw?.name) continue;
      const roleStr = String(raw.role || 'client');
      if (roleStr === 'driver' || roleStr === 'company') continue;
      const space: PrivacyUserSpace =
        roleStr === 'seller'
          ? 'seller'
          : roleStr === 'admin'
          ? 'admin'
          : 'client';
      const exists = privDb.usersDirectory.find(
        (u) => u.userId === String(raw.id) || u.email.toLowerCase() === String(raw.email).toLowerCase()
      );
      if (!exists) {
        const rec: StoredUserRecord = {
          id: `priv-u-${String(raw.id || crypto.randomUUID().slice(0, 8))}`,
          userId: String(raw.id || crypto.randomUUID().slice(0, 8)),
          space,
          fullName: String(raw.name),
          email: String(raw.email),
          phone: String(raw.phone || '+225 00 00 00 00'),
          deliveryAddress: String(raw.location || 'Abidjan, Côte d’Ivoire'),
          avatarPresent: Boolean(raw.avatar),
          shopOrCompanyName: raw.shopName ? String(raw.shopName) : null,
          kycStatus: raw.kycVerified ? 'verifie' : 'en_attente',
          kycDocSummary: raw.kycVerified ? 'KYC vérifié' : 'En attente de validation',
          ordersCount: Number(raw.ordersCount || 0),
          deliveriesCount: 0,
          hasDeliveryProofs: Number(raw.ordersCount || 0) > 0,
          hasOpenDispute: false,
          payoutTarget: null,
          commissionsFcfa: Number(raw.totalSpentOrEarned || 0),
          accountStatus: raw.status === 'suspended' ? 'suspendu' : 'actif',
          anonymized: false,
          createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString()
        };
        privDb.usersDirectory.push(rec);
        privDb.consents.push(...buildInitialConsents([rec]));
        added++;
      }
    }
    if (added > 0) persistPrivDb();
    res.json({ success: true, added, total: privDb.usersDirectory.length });
  });

  // Audited single-record reveal (NEVER dumps all cleartext users at once)
  app.post('/api/privacy/records/:id/reveal', requirePrivacyAccess(), (req: Request, res: Response) => {
    const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
    const actor = authCtx.staff!;
    const myPerms = getEffectivePermissionsForStaff(actor.id, actor.role);
    const category = String(req.body?.category || 'personal') as PrivacyDataCategoryGroup;
    const reason = strictMaskSecrets(String(req.body?.reason || '').trim());

    const record = privDb.usersDirectory.find((u) => u.id === req.params.id || u.userId === req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Enregistrement utilisateur introuvable.' });
    }

    if (reason.length < 5) {
      return res.status(400).json({
        success: false,
        error: 'JUSTIFICATION_REQUIRED',
        message: 'Veuillez indiquer un motif professionnel d’au moins 5 caractères pour consulter ces données.'
      });
    }

    // Strict RBAC verification per category
    if (record.space === 'admin' && record.userId !== actor.id && !myPerms.viewOtherAdminsData) {
      appendPrivacyAudit(req, authCtx, {
        actionType: 'privacy_reveal_denied',
        action: 'Tentative refusée de consultation des données d’un autre administrateur',
        target: maskEmail(record.email),
        result: 'bloque',
        severity: 'eleve',
        details: `Motif tenté : ${reason}`
      });
      return res.status(403).json({
        success: false,
        error: 'PERMISSION_DENIED',
        message: 'Vous n’avez pas la permission de consulter les données d’un autre administrateur.'
      });
    }

    const requiredPerm: PrivacyPermissionKey =
      category === 'financial'
        ? 'viewFinancialData'
        : category === 'commercial'
        ? 'viewKycDocuments'
        : category === 'technical'
        ? 'viewTechnicalLogs'
        : 'viewPersonalData';

    if (!myPerms[requiredPerm]) {
      appendPrivacyAudit(req, authCtx, {
        actionType: 'privacy_reveal_denied',
        action: `Consultation ${category} refusée (permission ${requiredPerm} manquante)`,
        target: record.id,
        result: 'bloque',
        severity: 'moyen',
        details: reason
      });
      return res.status(403).json({
        success: false,
        error: 'PERMISSION_DENIED',
        message: `Permission requise pour révéler cette catégorie : ${requiredPerm}.`
      });
    }

    if (privDb.settings.requireMfaForSensitiveReveal) {
      const mfa = verifyStepUpMfaForRequest(req, authCtx, true);
      if (!mfa.ok) {
        return res.status(mfa.status).json({
          success: false,
          error: mfa.error,
          message: mfa.message
        });
      }
    }

    const creditsDb = readCreditsDbSafe();
    const secSnap = getSecurityTelemetrySnapshot();
    const lock = checkLegalHoldForUser(record);
    const walletCredits = creditsDb.accounts[record.userId]?.balance || 0;
    const latestSession = secSnap.sessions.find(
      (s) => s.userId === record.userId || (s.accountEmail || '').toLowerCase() === (record.email || '').toLowerCase()
    );

    const payload: RevealedPrivacyRecordPayload = {
      recordId: record.id,
      revealedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
      revealedBy: actor.name
    };

    if (category === 'personal') {
      payload.personal = {
        fullName: record.fullName,
        email: record.email,
        phone: record.phone,
        deliveryAddress: record.deliveryAddress
      };
    } else if (category === 'commercial') {
      payload.commercial = {
        shopOrCompanyName: record.shopOrCompanyName,
        kycDocSummary: record.kycDocSummary,
        ordersCount: record.ordersCount
      };
    } else if (category === 'financial') {
      payload.financial = {
        walletBalanceFcfa: walletCredits * 10,
        confirmedTransactionsCount: lock.confirmedTxCount,
        payoutTarget: record.payoutTarget
      };
    } else if (category === 'technical') {
      payload.technical = {
        lastIp: latestSession?.ipAddress || 'Aucune session récente',
        lastDevice: latestSession ? `${latestSession.device} (${latestSession.os} / ${latestSession.browser})` : 'N/A',
        activeSessionIds: secSnap.sessions
          .filter((s) => s.userId === record.userId && s.status === 'active')
          .map((s) => s.sessionId)
      };
    }

    appendPrivacyAudit(req, authCtx, {
      actionType: 'privacy_record_revealed',
      action: `Consultation ponctuelle de données (${category})`,
      target: `${record.space} (${record.id})`,
      entityType: 'user_privacy_record',
      entityId: record.id,
      result: 'reussi',
      severity: 'moyen',
      details: `Catégorie=${category} • Motif=${reason}`
    });

    res.json({ success: true, revealed: payload });
  });

  // Consents management
  app.post('/api/privacy/consents/update', requirePrivacyAccess('processPrivacyRequests'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
    const actor = authCtx.staff!;
    const userId = String(req.body?.userId || '').trim();
    const consent = privDb.consents.find((c) => c.userId === userId);
    if (!consent) {
      return res.status(404).json({ success: false, error: 'Registre de consentement introuvable.' });
    }

    const nowIso = new Date().toISOString();
    if (typeof req.body?.marketingOptIn === 'boolean') {
      const nextVal = req.body.marketingOptIn;
      consent.marketingOptIn = nextVal;
      consent.marketingUpdatedAt = nowIso;
      consent.history.unshift({
        id: `ch-${crypto.randomUUID().slice(0, 8)}`,
        at: nowIso,
        consentType: 'marketing_commercial',
        action: nextVal ? 'accepte' : 'retire',
        documentVersion: consent.privacyVersion,
        actor: actor.name,
        channel: 'Console Confidentialité Admin'
      });
    }
    if (typeof req.body?.notificationsOptIn === 'boolean') {
      const nextVal = req.body.notificationsOptIn;
      consent.notificationsOptIn = nextVal;
      consent.notificationsUpdatedAt = nowIso;
      consent.history.unshift({
        id: `ch-${crypto.randomUUID().slice(0, 8)}`,
        at: nowIso,
        consentType: 'notifications_push',
        action: nextVal ? 'accepte' : 'retire',
        documentVersion: consent.cguVersion,
        actor: actor.name,
        channel: 'Console Confidentialité Admin'
      });
    }

    persistPrivDb();

    appendPrivacyAudit(req, authCtx, {
      actionType: 'privacy_consent_updated',
      action: `Consentement mis à jour pour ${consent.userId}`,
      target: consent.userLabel,
      result: 'reussi',
      severity: 'information',
      details: `Marketing=${consent.marketingOptIn ? 'opt-in' : 'retiré'} • Notifications=${consent.notificationsOptIn ? 'opt-in' : 'retirées'}`
    });

    res.json({ success: true, consent });
  });

  // Create DSAR (User Privacy Request)
  app.post('/api/privacy/requests', requirePrivacyAccess('processPrivacyRequests'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
    const actor = authCtx.staff!;
    const userId = String(req.body?.userId || '').trim();
    const type = String(req.body?.type || 'acces_copie') as PrivacyRequestType;
    const identityVerified = Boolean(req.body?.identityVerified);
    const reason = strictMaskSecrets(String(req.body?.reason || '').trim());

    const user = privDb.usersDirectory.find((u) => u.userId === userId || u.id === userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Utilisateur introuvable dans le répertoire.' });
    }

    const lock = checkLegalHoldForUser(user);
    const nowIso = new Date().toISOString();
    const dueIso = new Date(Date.now() + privDb.settings.dsarSlaDays * 86400_000).toISOString();

    const dsar: PrivacyRequestRecord = {
      id: `dsar-${crypto.randomUUID().slice(0, 8)}`,
      userId: user.userId,
      userLabel: maskName(user.fullName),
      userEmailMasked: maskEmail(user.email),
      space: user.space,
      type,
      identityVerified,
      receivedAt: nowIso,
      updatedAt: nowIso,
      dueDate: dueIso,
      status: identityVerified ? 'nouvelle' : 'en_verification',
      responsibleAdminId: actor.id,
      responsibleAdminName: actor.name,
      resolvedAt: null,
      justificationOrReason: reason || `Demande ${type} enregistrée`,
      legalHoldDetected: lock.locked,
      legalHoldDetails: lock.reason,
      anonymizationApplied: false,
      exportId: null,
      history: [
        {
          id: `dh-${crypto.randomUUID().slice(0, 8)}`,
          at: nowIso,
          actorId: actor.id,
          actorName: actor.name,
          action: 'Demande de confidentialité créée',
          statusAfter: identityVerified ? 'nouvelle' : 'en_verification',
          comment: reason || 'Vérification d’identité et analyse légale initialisées.'
        }
      ]
    };

    privDb.requests.unshift(dsar);
    persistPrivDb();

    appendPrivacyAudit(req, authCtx, {
      actionType: 'privacy_dsar_created',
      action: `Demande confidentialité (${type}) créée pour ${dsar.userLabel}`,
      target: dsar.id,
      entityType: 'privacy_request',
      entityId: dsar.id,
      result: 'reussi',
      severity: 'moyen',
      details: lock.locked ? `Verrou légal détecté : ${lock.reason}` : 'Aucun blocage comptable détecté.'
    });

    res.status(201).json({ success: true, request: dsar });
  });

  // Process DSAR with Legal Retention & Financial Protection Enforcement
  app.patch('/api/privacy/requests/:id', requirePrivacyAccess('processPrivacyRequests'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
    const actor = authCtx.staff!;
    const dsar = privDb.requests.find((r) => r.id === req.params.id);
    if (!dsar) {
      return res.status(404).json({ success: false, error: 'Demande introuvable.' });
    }

    const user = privDb.usersDirectory.find((u) => u.userId === dsar.userId);
    const nextStatus = req.body?.status as PrivacyRequestStatus | undefined;
    const identityVerified =
      typeof req.body?.identityVerified === 'boolean' ? req.body.identityVerified : dsar.identityVerified;
    const comment = strictMaskSecrets(String(req.body?.comment || '').trim());
    const mode = String(req.body?.resolutionMode || ''); // 'hard_delete' | 'anonymize' | ''

    if (privDb.settings.requireIdentityCheckForDsar && nextStatus === 'traitee' && !identityVerified) {
      return res.status(400).json({
        success: false,
        error: 'IDENTITY_VERIFICATION_REQUIRED',
        message: 'La vérification d’identité du demandeur est obligatoire avant de finaliser la demande.'
      });
    }

    // CRITICAL LEGAL GUARD: Prevent hard deletion of financial records, POD, or disputes
    if (dsar.type === 'suppression_anonymisation' && nextStatus === 'traitee' && user) {
      const lock = checkLegalHoldForUser(user);
      dsar.legalHoldDetected = lock.locked;
      dsar.legalHoldDetails = lock.reason;

      if (mode === 'hard_delete' && lock.locked) {
        appendPrivacyAudit(req, authCtx, {
          actionType: 'privacy_deletion_blocked',
          action: 'Suppression totale refusée (conservation légale / OHADA / litige)',
          target: dsar.id,
          result: 'bloque',
          severity: 'eleve',
          details: lock.reason || 'Obligation légale de conservation'
        });
        return res.status(409).json({
          success: false,
          error: 'FINANCIAL_LEGAL_RETENTION_LOCK',
          message:
            `Suppression totale interdite : ${lock.reason}. Utilisez le mode « Anonymisation sécurisée » pour protéger les données personnelles tout en conservant les justificatifs financiers et preuves de livraison.`
        });
      }

      if (mode === 'anonymize' || lock.locked) {
        const anonCode = crypto.createHash('sha256').update(user.userId).digest('hex').slice(0, 6).toUpperCase();
        user.fullName = `Utilisateur Anonymisé #${anonCode}`;
        user.email = `anon-${anonCode.toLowerCase()}@anonymized.djassa.local`;
        user.phone = '+225 00 00 00 00';
        user.deliveryAddress = 'Adresse anonymisée conformément à la Loi n° 2013-450';
        user.avatarPresent = false;
        user.anonymized = true;
        user.accountStatus = 'anonymise';
        dsar.anonymizationApplied = true;
      }
    }

    // If retrait_consentement processed, opt user out of marketing automatically
    if (dsar.type === 'retrait_consentement' && nextStatus === 'traitee') {
      const consent = privDb.consents.find((c) => c.userId === dsar.userId);
      if (consent) {
        consent.marketingOptIn = false;
        consent.marketingUpdatedAt = new Date().toISOString();
        consent.history.unshift({
          id: `ch-${crypto.randomUUID().slice(0, 8)}`,
          at: new Date().toISOString(),
          consentType: 'marketing_commercial',
          action: 'retire',
          documentVersion: consent.privacyVersion,
          actor: actor.name,
          channel: `DSAR ${dsar.id}`
        });
      }
    }

    const nowIso = new Date().toISOString();
    const prevStatus = dsar.status;
    dsar.identityVerified = identityVerified;
    if (nextStatus) dsar.status = nextStatus;
    dsar.updatedAt = nowIso;
    dsar.responsibleAdminId = actor.id;
    dsar.responsibleAdminName = actor.name;
    if (comment) dsar.justificationOrReason = comment;
    if (nextStatus === 'traitee' || nextStatus === 'refusee') {
      dsar.resolvedAt = nowIso;
    }

    dsar.history.unshift({
      id: `dh-${crypto.randomUUID().slice(0, 8)}`,
      at: nowIso,
      actorId: actor.id,
      actorName: actor.name,
      action: `Statut : ${prevStatus} → ${dsar.status}${dsar.anonymizationApplied ? ' (Anonymisation appliquée)' : ''}`,
      statusAfter: dsar.status,
      comment: comment || `Traitement validé par ${actor.name}`
    });

    persistPrivDb();

    appendPrivacyAudit(req, authCtx, {
      actionType: 'privacy_dsar_updated',
      action: `Demande ${dsar.id} passée à ${dsar.status}`,
      target: dsar.userLabel,
      entityType: 'privacy_request',
      entityId: dsar.id,
      result: 'reussi',
      severity: 'moyen',
      details: `${dsar.anonymizationApplied ? 'Anonymisation effectuée (données financières intactes). ' : ''}${comment}`
    });

    res.json({ success: true, request: dsar });
  });

  // Retention rules update
  app.patch(
    '/api/privacy/retention-rules/:id',
    requirePrivacyAccess('managePolicies', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
      const actor = authCtx.staff!;
      const rule = privDb.retentionRules.find((r) => r.id === req.params.id);
      if (!rule) {
        return res.status(404).json({ success: false, error: 'Règle de conservation introuvable.' });
      }

      if (typeof req.body?.retentionDays === 'number') {
        const minDays = rule.categoryKey === 'payments' || rule.categoryKey === 'withdrawals' ? 3650 : 30;
        if (req.body.retentionDays < minDays) {
          return res.status(400).json({
            success: false,
            error: 'LEGAL_MIN_RETENTION',
            message: `Durée minimale légale pour cette catégorie : ${minDays} jours.`
          });
        }
        rule.retentionDays = Math.min(7300, req.body.retentionDays);
      }
      if (typeof req.body?.anonymizeInsteadOfDelete === 'boolean') {
        rule.anonymizeInsteadOfDelete = req.body.anonymizeInsteadOfDelete;
      }
      if (typeof req.body?.legalHoldProtection === 'boolean') {
        rule.legalHoldProtection = req.body.legalHoldProtection;
      }
      if (typeof req.body?.extendedRetentionNote === 'string') {
        rule.extendedRetentionNote = strictMaskSecrets(req.body.extendedRetentionNote);
      }
      if (req.body?.status && ['actif', 'gele_litige', 'revision_requise'].includes(req.body.status)) {
        rule.status = req.body.status;
      }

      rule.updatedAt = new Date().toISOString();
      rule.updatedBy = actor.name;
      rule.nextScheduledPurgeAt = new Date(Date.now() + rule.retentionDays * 86400_000).toISOString();
      persistPrivDb();

      appendPrivacyAudit(req, authCtx, {
        actionType: 'privacy_retention_updated',
        action: `Règle de conservation modifiée : ${rule.label}`,
        target: rule.categoryKey,
        result: 'reussi',
        severity: 'moyen',
        details: `Durée=${rule.retentionDays}j • Anonymisation=${rule.anonymizeInsteadOfDelete} • LegalHold=${rule.legalHoldProtection}`
      });

      res.json({ success: true, rule });
    }
  );

  // Secure Data Export (Single User Portability vs Bulk Block)
  app.post('/api/privacy/exports', requirePrivacyAccess('exportUserData'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
    const actor = authCtx.staff!;
    const myPerms = getEffectivePermissionsForStaff(actor.id, actor.role);

    const scope = (req.body?.scope === 'bulk_filtered' ? 'bulk_filtered' : 'single_user') as PrivacyExportRecord['scope'];
    const format = req.body?.format === 'csv' ? 'csv' : 'json';
    const userId = String(req.body?.userId || '').trim();
    const justification = strictMaskSecrets(String(req.body?.justification || '').trim());

    if (justification.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'JUSTIFICATION_REQUIRED',
        message: 'Une justification traçable (min. 8 caractères) est obligatoire pour toute exportation.'
      });
    }

    // Strict check against bulk export without explicit permission
    if (scope === 'bulk_filtered' && !myPerms.bulkExport) {
      const incidentId = `pinc-${crypto.randomUUID().slice(0, 8)}`;
      const nowIso = new Date().toISOString();
      privDb.incidents.unshift({
        id: incidentId,
        detectedAt: nowIso,
        updatedAt: nowIso,
        type: 'export_inhabituel',
        affectedCategories: ['personal', 'commercial'],
        potentiallyAffectedUsersCount: privDb.usersDirectory.length,
        severity: 'eleve',
        origin: `Tentative d’exportation massive sans autorisation par ${actor.name}`,
        measuresTaken: 'Exportation automatiquement bloquée par le contrôle d’accès RBAC serveur.',
        responsibleId: null,
        responsibleName: null,
        status: 'ouvert',
        artciAssessment: {
          requiresArtciNotification: false,
          requiresUserNotification: false,
          adminValidatedNotification: false,
          validatedBy: null,
          validatedAt: null,
          assessmentNotes: 'Export bloqué avant extraction ; aucune donnée sortie.'
        }
      });
      persistPrivDb();

      appendPrivacyAudit(req, authCtx, {
        actionType: 'privacy_bulk_export_blocked',
        action: 'Export massif bloqué (permission bulkExport absente)',
        target: 'Répertoire global',
        entityType: 'privacy_incident',
        entityId: incidentId,
        result: 'bloque',
        severity: 'critique',
        details: `Tentative par ${actor.name} — Motif : ${justification}`
      });

      return res.status(403).json({
        success: false,
        error: 'BULK_EXPORT_FORBIDDEN',
        message: 'Exportation massive bloquée : permission explicite « bulkExport » requise.'
      });
    }

    if (privDb.settings.requireMfaForExport) {
      const mfa = verifyStepUpMfaForRequest(req, authCtx, true);
      if (!mfa.ok) {
        return res.status(mfa.status).json({
          success: false,
          error: mfa.error,
          message: mfa.message
        });
      }
    }

    let payloadBody = '';
    let targetLabel = '';
    let filename = '';

    if (scope === 'single_user') {
      const user = privDb.usersDirectory.find((u) => u.userId === userId || u.id === userId);
      if (!user) {
        return res.status(404).json({ success: false, error: 'Utilisateur cible introuvable.' });
      }
      targetLabel = `${maskName(user.fullName)} (${user.userId})`;
      const consent = privDb.consents.find((c) => c.userId === user.userId);
      const userData = {
        exportedAt: new Date().toISOString(),
        framework: privDb.settings.legalFrameworkLabel,
        exportedBy: actor.name,
        justification,
        userProfile: {
          id: user.userId,
          space: user.space,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          deliveryAddress: user.deliveryAddress,
          shopOrCompanyName: user.shopOrCompanyName,
          accountStatus: user.accountStatus,
          createdAt: user.createdAt
        },
        commercial: {
          ordersCount: user.ordersCount,
          deliveriesCount: user.deliveriesCount,
          kycStatus: user.kycStatus
        },
        consents: consent
          ? {
              cguAccepted: consent.cguAccepted,
              cguVersion: consent.cguVersion,
              privacyAccepted: consent.privacyAccepted,
              privacyVersion: consent.privacyVersion,
              marketingOptIn: consent.marketingOptIn,
              notificationsOptIn: consent.notificationsOptIn
            }
          : null
      };

      if (format === 'csv') {
        payloadBody =
          'userId,space,fullName,email,phone,address,ordersCount,deliveriesCount,marketingOptIn\n' +
          `"${user.userId}","${user.space}","${user.fullName}","${user.email}","${user.phone}","${user.deliveryAddress}",${user.ordersCount},${user.deliveriesCount},${Boolean(consent?.marketingOptIn)}\n`;
      } else {
        payloadBody = JSON.stringify(userData, null, 2);
      }
      filename = `djassa-portabilite-${user.userId}.${format}`;
    } else {
      targetLabel = `Export massif audité (${privDb.usersDirectory.length} comptes — champs pseudonymisés)`;
      const rows = privDb.usersDirectory.map((u) => ({
        userId: u.userId,
        space: u.space,
        nameMasked: maskName(u.fullName),
        emailMasked: maskEmail(u.email),
        accountStatus: u.accountStatus,
        ordersCount: u.ordersCount
      }));
      payloadBody =
        format === 'csv'
          ? 'userId,space,nameMasked,emailMasked,accountStatus,ordersCount\n' +
            rows.map((r) => `"${r.userId}","${r.space}","${r.nameMasked}","${r.emailMasked}","${r.accountStatus}",${r.ordersCount}`).join('\n')
          : JSON.stringify({ exportedAt: new Date().toISOString(), count: rows.length, rows }, null, 2);
      filename = `djassa-export-registre-${new Date().toISOString().slice(0, 10)}.${format}`;
    }

    const expId = `exp-${crypto.randomUUID().slice(0, 10)}`;
    const token = crypto.randomBytes(24).toString('hex');
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + privDb.settings.exportLinkTtlMinutes * 60_000).toISOString();

    const record: PrivacyExportRecord = {
      id: expId,
      createdAt: nowIso,
      expiresAt,
      requestedById: actor.id,
      requestedByName: actor.name,
      scope,
      targetUserId: scope === 'single_user' ? userId : null,
      targetUserLabel: targetLabel,
      format,
      justification,
      status: 'disponible',
      downloadCount: 0,
      downloadToken: token
    };

    privDb.exports.unshift(record);
    privDb.exportPayloads[expId] = {
      exportId: expId,
      token,
      expiresAt,
      contentType: format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      filename,
      body: payloadBody
    };
    persistPrivDb();

    appendPrivacyAudit(req, authCtx, {
      actionType: 'privacy_export_created',
      action: `Exportation sécurisée préparée (${scope}, ${format.toUpperCase()})`,
      target: targetLabel,
      entityType: 'privacy_export',
      entityId: expId,
      result: 'reussi',
      severity: scope === 'bulk_filtered' ? 'eleve' : 'moyen',
      details: `Expiration=${expiresAt} • Motif=${justification}`
    });

    res.status(201).json({ success: true, exportRecord: record });
  });

  // Temporary Token-Gated Export Download
  app.get('/api/privacy/exports/:id/download', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    if (!authCtx.staff || !authCtx.staff.active) {
      return res.status(403).json({ success: false, error: 'ACCESS_DENIED', message: 'Accès administrateur requis.' });
    }
    const exp = privDb.exports.find((e) => e.id === req.params.id);
    const payload = privDb.exportPayloads[req.params.id];
    const token = String(req.query.token || '');

    if (!exp || !payload) {
      return res.status(404).json({ success: false, error: 'Exportation introuvable ou expirée.' });
    }
    if (!token || token !== payload.token) {
      return res.status(403).json({ success: false, error: 'INVALID_DOWNLOAD_TOKEN', message: 'Jeton de téléchargement invalide.' });
    }
    if (new Date(payload.expiresAt).getTime() <= Date.now()) {
      exp.status = 'expire';
      delete privDb.exportPayloads[exp.id];
      persistPrivDb();
      return res.status(410).json({ success: false, error: 'EXPORT_EXPIRED', message: 'Ce lien temporaire a expiré.' });
    }

    exp.downloadCount += 1;
    exp.status = 'telecharge';
    persistPrivDb();

    appendPrivacyAudit(req, authCtx, {
      actionType: 'privacy_export_downloaded',
      action: `Fichier d’exportation téléchargé (${exp.id})`,
      target: exp.targetUserLabel,
      result: 'reussi',
      severity: 'moyen',
      details: `Téléchargement #${exp.downloadCount} par ${authCtx.staff.name}`
    });

    res.setHeader('Content-Type', payload.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${payload.filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(payload.body);
  });

  // Privacy Incidents (Data Breach / Exposure Management)
  app.post('/api/privacy/incidents', requirePrivacyAccess('managePrivacyIncidents'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
    const actor = authCtx.staff!;
    const nowIso = new Date().toISOString();

    const incident: PrivacyIncidentRecord = {
      id: `pinc-${crypto.randomUUID().slice(0, 8)}`,
      detectedAt: nowIso,
      updatedAt: nowIso,
      type: req.body?.type || 'consultation_anormale',
      affectedCategories: Array.isArray(req.body?.affectedCategories) ? req.body.affectedCategories : ['personal'],
      potentiallyAffectedUsersCount: Math.max(0, Number(req.body?.potentiallyAffectedUsersCount || 1)),
      severity: req.body?.severity || 'moyen',
      origin: strictMaskSecrets(String(req.body?.origin || 'Signalement interne administrateur')),
      measuresTaken: strictMaskSecrets(String(req.body?.measuresTaken || 'Analyse et confinement en cours')),
      responsibleId: actor.id,
      responsibleName: actor.name,
      status: 'ouvert',
      artciAssessment: {
        requiresArtciNotification: Boolean(req.body?.requiresArtciNotification),
        requiresUserNotification: Boolean(req.body?.requiresUserNotification),
        adminValidatedNotification: false,
        validatedBy: null,
        validatedAt: null,
        assessmentNotes: strictMaskSecrets(
          String(
            req.body?.assessmentNotes ||
              'Évaluation requise avant toute notification externe à l’ARTCI-CI ou aux personnes concernées.'
          )
        )
      }
    };

    privDb.incidents.unshift(incident);
    persistPrivDb();

    appendPrivacyAudit(req, authCtx, {
      actionType: incident.severity === 'critique' ? 'privacy_incident_critical' : 'privacy_incident_warning',
      action: `Incident de confidentialité déclaré : ${incident.type}`,
      target: incident.id,
      entityType: 'privacy_incident',
      entityId: incident.id,
      result: 'reussi',
      severity: incident.severity === 'critique' ? 'critique' : 'eleve',
      details: `${incident.origin} (${incident.potentiallyAffectedUsersCount} compte(s) concerné(s))`
    });

    res.status(201).json({ success: true, incident });
  });

  app.patch('/api/privacy/incidents/:id', requirePrivacyAccess('managePrivacyIncidents'), (req: Request, res: Response) => {
    const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
    const actor = authCtx.staff!;
    const incident = privDb.incidents.find((i) => i.id === req.params.id);
    if (!incident) {
      return res.status(404).json({ success: false, error: 'Incident introuvable.' });
    }

    const nowIso = new Date().toISOString();
    if (req.body?.status && ['ouvert', 'investigation', 'contenu', 'resolu'].includes(req.body.status)) {
      incident.status = req.body.status;
    }
    if (typeof req.body?.measuresTaken === 'string') {
      incident.measuresTaken = strictMaskSecrets(req.body.measuresTaken);
    }
    if (typeof req.body?.requiresArtciNotification === 'boolean') {
      incident.artciAssessment.requiresArtciNotification = req.body.requiresArtciNotification;
    }
    if (typeof req.body?.requiresUserNotification === 'boolean') {
      incident.artciAssessment.requiresUserNotification = req.body.requiresUserNotification;
    }
    if (typeof req.body?.assessmentNotes === 'string') {
      incident.artciAssessment.assessmentNotes = strictMaskSecrets(req.body.assessmentNotes);
    }
    // Explicit admin validation required before marking ARTCI/user notifications validated
    if (req.body?.adminValidatedNotification === true) {
      if (actor.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'SUPER_ADMIN_REQUIRED',
          message: 'Seul le Super Administrateur peut valider la notification réglementaire ARTCI / utilisateurs.'
        });
      }
      const mfa = verifyStepUpMfaForRequest(req, authCtx, true);
      if (!mfa.ok) {
        return res.status(mfa.status).json({ success: false, error: mfa.error, message: mfa.message });
      }
      incident.artciAssessment.adminValidatedNotification = true;
      incident.artciAssessment.validatedBy = actor.name;
      incident.artciAssessment.validatedAt = nowIso;
    }

    incident.responsibleId = actor.id;
    incident.responsibleName = actor.name;
    incident.updatedAt = nowIso;
    persistPrivDb();

    appendPrivacyAudit(req, authCtx, {
      actionType: 'privacy_incident_updated',
      action: `Incident ${incident.id} mis à jour (${incident.status})`,
      target: incident.id,
      result: 'reussi',
      severity: 'moyen',
      details: incident.measuresTaken
    });

    res.json({ success: true, incident });
  });

  // Official Policies & Governance Documents
  app.patch(
    '/api/privacy/policies/:id',
    requirePrivacyAccess('managePolicies', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
      const actor = authCtx.staff!;
      const doc = privDb.policies.find((p) => p.id === req.params.id);
      if (!doc) {
        return res.status(404).json({ success: false, error: 'Document introuvable.' });
      }

      const nowIso = new Date().toISOString();
      const nextVersion = String(req.body?.currentVersion || doc.currentVersion).trim();
      const nextStatus = (req.body?.status || doc.status) as PrivacyPolicyStatus;
      const notes = strictMaskSecrets(String(req.body?.notes || 'Mise à jour documentaire').trim());

      if (typeof req.body?.summary === 'string') doc.summary = strictMaskSecrets(req.body.summary);
      if (typeof req.body?.contentPreview === 'string') doc.contentPreview = strictMaskSecrets(req.body.contentPreview);
      if (typeof req.body?.requiresReconsentOnPublish === 'boolean') {
        doc.requiresReconsentOnPublish = req.body.requiresReconsentOnPublish;
      }

      doc.currentVersion = nextVersion;
      doc.status = nextStatus;
      if (nextStatus === 'publie') {
        doc.publishedAt = nowIso;
        doc.effectiveAt = nowIso;
        doc.validatedBy = actor.name;
        doc.history.unshift({
          version: nextVersion,
          publishedAt: nowIso,
          validatedBy: actor.name,
          notes
        });
      }

      persistPrivDb();

      appendPrivacyAudit(req, authCtx, {
        actionType: 'privacy_policy_published',
        action: `Document "${doc.title}" (${doc.status}) v${doc.currentVersion}`,
        target: doc.docType,
        result: 'reussi',
        severity: 'moyen',
        details: notes
      });

      res.json({ success: true, policy: doc });
    }
  );

  // Privacy Settings
  app.patch(
    '/api/privacy/settings',
    requirePrivacyAccess('managePolicies', { requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
      const actor = authCtx.staff!;
      const body = req.body || {};

      if (typeof body.exportLinkTtlMinutes === 'number') {
        privDb.settings.exportLinkTtlMinutes = Math.max(5, Math.min(120, body.exportLinkTtlMinutes));
      }
      if (typeof body.requireMfaForSensitiveReveal === 'boolean') {
        privDb.settings.requireMfaForSensitiveReveal = body.requireMfaForSensitiveReveal;
      }
      if (typeof body.requireMfaForExport === 'boolean') {
        privDb.settings.requireMfaForExport = body.requireMfaForExport;
      }
      if (typeof body.requireIdentityCheckForDsar === 'boolean') {
        privDb.settings.requireIdentityCheckForDsar = body.requireIdentityCheckForDsar;
      }
      if (typeof body.dsarSlaDays === 'number') {
        privDb.settings.dsarSlaDays = Math.max(7, Math.min(60, body.dsarSlaDays));
      }
      if (typeof body.dpoContactEmail === 'string' && body.dpoContactEmail.includes('@')) {
        privDb.settings.dpoContactEmail = body.dpoContactEmail.trim();
      }
      privDb.settings.updatedAt = new Date().toISOString();
      privDb.settings.updatedBy = actor.name;
      persistPrivDb();

      appendPrivacyAudit(req, authCtx, {
        actionType: 'privacy_settings_updated',
        action: 'Paramètres Confidentialité & Protection des Données modifiés',
        target: 'privacy_db.json',
        result: 'reussi',
        severity: 'moyen',
        details: `TTL export=${privDb.settings.exportLinkTtlMinutes}m • MFA reveal=${privDb.settings.requireMfaForSensitiveReveal}`
      });

      res.json({ success: true, settings: privDb.settings });
    }
  );

  // Granular Privacy Permissions Matrix (Super Admin + MFA)
  app.patch(
    '/api/privacy/permissions/:staffId',
    requirePrivacyAccess(undefined, { requireSuperAdmin: true, requireStepUpMfa: true }),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx: AuthenticatedRequestContext }).authCtx;
      const actor = authCtx.staff!;
      const targetId = req.params.staffId;
      const targetMember = getSecurityStaffDirectory().find((s) => s.id === targetId);

      if (!targetMember) {
        return res.status(404).json({ success: false, error: 'Collaborateur introuvable.' });
      }
      if (targetMember.role === 'super_admin') {
        return res.status(403).json({
          success: false,
          error: 'SUPER_ADMIN_IMMUTABLE',
          message: 'Les privilèges du Super Administrateur sont totaux et immuables.'
        });
      }
      if (targetMember.role === 'other_agent') {
        return res.status(403).json({
          success: false,
          error: 'NON_ADMIN_AGENT',
          message: 'Un agent non-administrateur ne peut pas recevoir d’accès aux données personnelles.'
        });
      }

      const incoming = req.body?.permissions || {};
      const current = getEffectivePermissionsForStaff(targetId, targetMember.role);
      const nextPerms = { ...current };
      for (const k of ALL_PRIVACY_PERMISSIONS) {
        if (typeof incoming[k] === 'boolean') {
          nextPerms[k] = incoming[k];
        }
      }

      privDb.staffPermissions[targetId] = nextPerms;
      persistPrivDb();

      appendPrivacyAudit(req, authCtx, {
        actionType: 'privacy_permissions_updated',
        action: `Droits Confidentialité modifiés pour ${targetMember.name}`,
        target: `${targetMember.name} (${targetMember.email})`,
        result: 'reussi',
        severity: 'eleve',
        details: `Mis à jour par Super Admin ${actor.name}`
      });

      res.json({
        success: true,
        permissionsDirectory: buildPermissionsDirectory()
      });
    }
  );
}
