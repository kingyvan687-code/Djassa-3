import type { Express, Request, Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteJsonFile } from './atomicFileStore';
import { encryptSecretValue, maskSecretValue } from './secretCrypto';
import { validateSafeOutboundUrl } from './urlSafety';
import {
  appendAuditEntry,
  authenticateSessionRequest,
  getClientIp,
  requireSecurityPermission,
  type AuthenticatedRequestContext,
  type PlatformSpaceRole
} from './securityModule';
import {
  syncPgAdminSetting,
  syncPgApiProviderSecret,
  syncPgApprovalRequest
} from './repositories/adminPgRepository';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const CONTROL_PLANE_FILE = path.join(DATA_DIR, 'admin_control_plane.json');

export type ServiceProviderType =
  | 'payments'
  | 'ai_text'
  | 'ai_image'
  | 'ai_video'
  | 'maps'
  | 'storage'
  | 'messaging'
  | 'analytics'
  | 'other';

export interface ControlPlaneSettingHistoryEntry {
  id: string;
  key: string;
  previousValue: unknown;
  newValue: unknown;
  changedById: string;
  changedByEmail: string;
  reason: string;
  at: string;
}

export interface ControlPlaneApiProviderRecord {
  providerKey: string;
  displayName: string;
  serviceType: ServiceProviderType;
  status: 'disabled' | 'sandbox' | 'active' | 'degraded';
  secretCiphertext?: string;
  secretKeyVersion?: string;
  secretMasked: string;
  publicConfig: Record<string, unknown>;
  monthlyLimitFcfa: number | null;
  alertThresholdPercent: number;
  lastHealthCheckAt: string | null;
  lastHealthStatus: 'ok' | 'warning' | 'failed' | null;
  updatedBy: string;
  updatedAt: string;
}

export interface ControlPlaneCampaignRecord {
  id: string;
  campaignType: 'promotion' | 'advertising';
  name: string;
  status: 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
  startsAt?: string;
  endsAt?: string;
  budgetFcfa?: number;
  spentFcfa: number;
  discountType?: 'fixed' | 'percent';
  discountValue?: number;
  maxDiscountFcfa?: number;
  minSubtotalFcfa?: number;
  promoCode?: string;
  description?: string;
  targeting?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ControlPlaneApprovalRequest {
  id: string;
  actionKey: string;
  resourceType: string;
  resourceId: string;
  requestedById: string;
  requestedByEmail: string;
  approvedById?: string;
  approvedByEmail?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'executed';
  requestPayload: Record<string, unknown>;
  decisionReason?: string;
  expiresAt: string;
  decidedAt?: string;
  createdAt: string;
}

export interface AppSpaceQuotaConfig {
  maxProductsPerSeller: number;
  maxSellerStorageBytes: number;
  maxAiRequestsPerDay: Record<'gratuit' | 'pro' | 'entreprise', number>;
  maxDriversPerCompany: number;
  maxDailyWithdrawalFcfa: number;
  requireTwoPersonApprovalAboveFcfa: number;
}

export interface ControlPlaneDatabase {
  settings: Record<string, { value: unknown; version: number; updatedBy: string; updatedAt: string }>;
  settingHistory: ControlPlaneSettingHistoryEntry[];
  providers: ControlPlaneApiProviderRecord[];
  campaigns: ControlPlaneCampaignRecord[];
  approvals: ControlPlaneApprovalRequest[];
  quotas: AppSpaceQuotaConfig;
}

export const SELLER_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024; // 5 Go exact

function buildDefaultControlPlaneDb(): ControlPlaneDatabase {
  const nowIso = new Date().toISOString();
  return {
    settings: {
      platform_currency: { value: 'XOF', version: 1, updatedBy: 'system@djassa.ci', updatedAt: nowIso },
      reservation_window_minutes: { value: 15, version: 1, updatedBy: 'system@djassa.ci', updatedAt: nowIso },
      gps_retention_days: { value: 30, version: 1, updatedBy: 'system@djassa.ci', updatedAt: nowIso },
      seller_storage_quota_bytes: { value: SELLER_STORAGE_QUOTA_BYTES, version: 1, updatedBy: 'system@djassa.ci', updatedAt: nowIso }
    },
    settingHistory: [],
    providers: [
      {
        providerKey: 'geniuspay',
        displayName: 'GeniusPay (Wave, Orange Money, MTN MoMo, Carte)',
        serviceType: 'payments',
        status: process.env.GENIUSPAY_API_KEY ? 'active' : 'disabled',
        secretMasked: maskSecretValue(process.env.GENIUSPAY_API_KEY),
        publicConfig: { baseUrl: process.env.GENIUSPAY_BASE_URL || 'https://api.geniuspay.ci/v1', currency: 'XOF' },
        monthlyLimitFcfa: null,
        alertThresholdPercent: 80,
        lastHealthCheckAt: null,
        lastHealthStatus: null,
        updatedBy: 'system@djassa.ci',
        updatedAt: nowIso
      },
      {
        providerKey: 'rodiumai',
        displayName: 'RodiumAI (MiniMax & Qwen Image 2.1 Turbo)',
        serviceType: 'ai_text',
        status: process.env.RODIUMAI_API_KEY ? 'active' : 'disabled',
        secretMasked: maskSecretValue(process.env.RODIUMAI_API_KEY),
        publicConfig: {
          models: ['MiniMax M3.1 Flash', 'Qwen Image 2.1 Turbo', 'MiniMax H3 Max Turbo', 'MiniMax H3']
        },
        monthlyLimitFcfa: 500_000,
        alertThresholdPercent: 80,
        lastHealthCheckAt: null,
        lastHealthStatus: null,
        updatedBy: 'system@djassa.ci',
        updatedAt: nowIso
      },
      {
        providerKey: 'google_maps',
        displayName: 'Google Maps Platform (Cartes, Routes v2, Géocodage)',
        serviceType: 'maps',
        status: process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY ? 'active' : 'disabled',
        secretMasked: maskSecretValue(process.env.GOOGLE_MAPS_API_KEY),
        publicConfig: { region: 'CI' },
        monthlyLimitFcfa: 300_000,
        alertThresholdPercent: 80,
        lastHealthCheckAt: null,
        lastHealthStatus: null,
        updatedBy: 'system@djassa.ci',
        updatedAt: nowIso
      }
    ],
    campaigns: [
      {
        id: 'cmp-adjame10',
        campaignType: 'promotion',
        name: 'Promo Adjamé Grand Marché',
        status: 'active',
        discountType: 'fixed',
        discountValue: 2000,
        minSubtotalFcfa: 10000,
        promoCode: 'ADJAME10',
        description: 'Réduction immédiate de 2 000 FCFA dès 10 000 FCFA d’achats.',
        spentFcfa: 0,
        createdBy: 'system@djassa.ci',
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: 'cmp-djassa',
        campaignType: 'promotion',
        name: 'Bon Privilège DJASSA',
        status: 'active',
        discountType: 'fixed',
        discountValue: 5000,
        minSubtotalFcfa: 20000,
        promoCode: 'DJASSA',
        description: 'Bon privilège DJASSA de 5 000 FCFA dès 20 000 FCFA d’achats.',
        spentFcfa: 0,
        createdBy: 'system@djassa.ci',
        createdAt: nowIso,
        updatedAt: nowIso
      },
      {
        id: 'cmp-bienvenue',
        campaignType: 'promotion',
        name: 'Offre Bienvenue Client',
        status: 'active',
        discountType: 'percent',
        discountValue: 10,
        maxDiscountFcfa: 5000,
        minSubtotalFcfa: 5000,
        promoCode: 'BIENVENUE',
        description: '10% de remise (jusqu’à 5 000 FCFA) sur votre commande.',
        spentFcfa: 0,
        createdBy: 'system@djassa.ci',
        createdAt: nowIso,
        updatedAt: nowIso
      }
    ],
    approvals: [],
    quotas: {
      maxProductsPerSeller: 2000,
      maxSellerStorageBytes: SELLER_STORAGE_QUOTA_BYTES,
      maxAiRequestsPerDay: {
        gratuit: 30,
        pro: 250,
        entreprise: 2000
      },
      maxDriversPerCompany: 500,
      maxDailyWithdrawalFcfa: 5_000_000,
      requireTwoPersonApprovalAboveFcfa: 250_000
    }
  };
}

function loadControlPlaneDb(): ControlPlaneDatabase {
  const defaults = buildDefaultControlPlaneDb();
  if (!fs.existsSync(CONTROL_PLANE_FILE)) {
    atomicWriteJsonFile(CONTROL_PLANE_FILE, defaults, { context: 'AdminControlPlane' });
    return defaults;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(CONTROL_PLANE_FILE, 'utf8')) as Partial<ControlPlaneDatabase>;
    return {
      settings: parsed.settings && typeof parsed.settings === 'object' ? { ...defaults.settings, ...parsed.settings } : defaults.settings,
      settingHistory: Array.isArray(parsed.settingHistory) ? parsed.settingHistory : [],
      providers: Array.isArray(parsed.providers) && parsed.providers.length > 0 ? parsed.providers : defaults.providers,
      campaigns: Array.isArray(parsed.campaigns) && parsed.campaigns.length > 0 ? parsed.campaigns : defaults.campaigns,
      approvals: Array.isArray(parsed.approvals) ? parsed.approvals : [],
      quotas: {
        ...defaults.quotas,
        ...(parsed.quotas || {}),
        maxAiRequestsPerDay: {
          ...defaults.quotas.maxAiRequestsPerDay,
          ...(parsed.quotas?.maxAiRequestsPerDay || {})
        }
      }
    };
  } catch {
    return defaults;
  }
}

export let controlPlaneDb: ControlPlaneDatabase = loadControlPlaneDb();

export function persistControlPlaneDb(): boolean {
  return atomicWriteJsonFile(CONTROL_PLANE_FILE, controlPlaneDb, { context: 'AdminControlPlane' });
}

export function getControlPlaneQuotas(): AppSpaceQuotaConfig {
  return controlPlaneDb.quotas;
}

export function validatePromoFromControlPlane(rawCode: string, subtotal: number): {
  found: boolean;
  valid: boolean;
  code: string;
  discountFcfa: number;
  label?: string;
  description?: string;
  error?: string;
  message?: string;
} {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) {
    return { found: false, valid: false, code: '', discountFcfa: 0, error: 'EMPTY_PROMO_CODE', message: 'Veuillez saisir un code promo.' };
  }
  const cmp = controlPlaneDb.campaigns.find(
    (c) => c.promoCode && c.promoCode.toUpperCase() === code
  );
  if (!cmp) {
    return { found: false, valid: false, code, discountFcfa: 0, error: 'INVALID_PROMO_CODE', message: 'Code promo invalide ou expiré.' };
  }
  const now = Date.now();
  if (cmp.status !== 'active') {
    return { found: true, valid: false, code, discountFcfa: 0, error: 'INACTIVE_PROMO_CODE', message: 'Ce code promo n’est plus actif.' };
  }
  if (cmp.startsAt && now < Date.parse(cmp.startsAt)) {
    return { found: true, valid: false, code, discountFcfa: 0, error: 'PROMO_NOT_STARTED', message: 'Cette campagne promotionnelle n’a pas encore démarré.' };
  }
  if (cmp.endsAt && now > Date.parse(cmp.endsAt)) {
    return { found: true, valid: false, code, discountFcfa: 0, error: 'EXPIRED_PROMO_CODE', message: 'Ce code promo a expiré.' };
  }
  const minSub = cmp.minSubtotalFcfa || 0;
  if (subtotal < minSub) {
    return {
      found: true,
      valid: false,
      code,
      discountFcfa: 0,
      error: 'PROMO_MIN_SUBTOTAL',
      message: `Ce code requiert un sous-total minimum de ${minSub.toLocaleString('fr-FR')} FCFA.`
    };
  }
  const val = cmp.discountValue || 0;
  const rawDiscount = cmp.discountType === 'fixed' ? val : Math.round((subtotal * val) / 100);
  const capped = cmp.maxDiscountFcfa ? Math.min(rawDiscount, cmp.maxDiscountFcfa) : rawDiscount;
  const discountFcfa = Math.min(subtotal, Math.max(0, capped));
  return {
    found: true,
    valid: true,
    code,
    discountFcfa,
    label: cmp.discountType === 'fixed' ? `${code} (-${val.toLocaleString('fr-FR')} FCFA)` : `${code} (-${val}%)`,
    description: cmp.description || cmp.name
  };
}

function sanitizeProviderForPublic(p: ControlPlaneApiProviderRecord) {
  return {
    providerKey: p.providerKey,
    displayName: p.displayName,
    serviceType: p.serviceType,
    status: p.status,
    secretMasked: p.secretMasked,
    hasEncryptedSecret: Boolean(p.secretCiphertext),
    secretKeyVersion: p.secretKeyVersion || null,
    publicConfig: p.publicConfig,
    monthlyLimitFcfa: p.monthlyLimitFcfa,
    alertThresholdPercent: p.alertThresholdPercent,
    lastHealthCheckAt: p.lastHealthCheckAt,
    lastHealthStatus: p.lastHealthStatus,
    updatedBy: p.updatedBy,
    updatedAt: p.updatedAt
  };
}

export function installAdminControlPlaneRoutes(app: Express) {
  app.get(
    '/api/admin/control-plane/settings',
    requireSecurityPermission('viewDashboard'),
    (_req: Request, res: Response) => {
      return res.json({
        success: true,
        settings: controlPlaneDb.settings,
        history: controlPlaneDb.settingHistory.slice(0, 100)
      });
    }
  );

  app.patch(
    '/api/admin/control-plane/settings',
    requireSecurityPermission('modifySettings'),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
      const { key, value, reason = 'Mise à jour administration' } = req.body || {};
      const cleanKey = String(key || '').trim();
      if (!cleanKey || !/^[a-z0-9_.-]{2,80}$/i.test(cleanKey)) {
        return res.status(400).json({ success: false, error: 'INVALID_SETTING_KEY' });
      }
      const nowIso = new Date().toISOString();
      const prev = controlPlaneDb.settings[cleanKey];
      const nextVersion = (prev?.version || 0) + 1;
      controlPlaneDb.settings[cleanKey] = {
        value,
        version: nextVersion,
        updatedBy: authCtx?.token.email || 'admin@djassa.ci',
        updatedAt: nowIso
      };
      controlPlaneDb.settingHistory.unshift({
        id: `sh-${crypto.randomUUID().slice(0, 10)}`,
        key: cleanKey,
        previousValue: prev?.value ?? null,
        newValue: value,
        changedById: authCtx?.token.uid || 'admin',
        changedByEmail: authCtx?.token.email || 'admin@djassa.ci',
        reason: String(reason).slice(0, 200),
        at: nowIso
      });
      if (controlPlaneDb.settingHistory.length > 500) {
        controlPlaneDb.settingHistory.length = 500;
      }
      persistControlPlaneDb();
      void syncPgAdminSetting({
        key: cleanKey,
        value,
        changedByUserId: authCtx?.token.uid || 'admin',
        reason: String(reason).slice(0, 200)
      });
      appendAuditEntry({
        actorId: authCtx?.token.uid || 'admin',
        actorName: authCtx?.token.name || 'Administrateur',
        actorAccountLabel: authCtx?.token.email || 'admin@djassa.ci',
        actorRole: 'admin',
        space: 'admin',
        category: 'system_config',
        actionType: 'control_plane_setting_updated',
        action: `Paramètre versionné modifié : ${cleanKey} (v${nextVersion})`,
        target: cleanKey,
        targetType: 'settings',
        result: 'reussi',
        severity: 'moyen',
        beforeValue: prev ? `v${prev.version}` : null,
        afterValue: `v${nextVersion}`,
        details: String(reason).slice(0, 200),
        ipAddress: getClientIp(req)
      });
      return res.json({ success: true, setting: controlPlaneDb.settings[cleanKey], key: cleanKey });
    }
  );

  app.get(
    '/api/admin/control-plane/providers',
    requireSecurityPermission('viewDashboard'),
    (_req: Request, res: Response) => {
      return res.json({
        success: true,
        providers: controlPlaneDb.providers.map(sanitizeProviderForPublic)
      });
    }
  );

  app.patch(
    '/api/admin/control-plane/providers/:providerKey',
    requireSecurityPermission('modifySettings'),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
      const providerKey = String(req.params.providerKey || '').trim().toLowerCase();
      if (!/^[a-z0-9_-]{2,50}$/.test(providerKey)) {
        return res.status(400).json({ success: false, error: 'INVALID_PROVIDER_KEY' });
      }
      const {
        displayName,
        serviceType = 'other',
        status = 'disabled',
        apiKey,
        publicConfig = {},
        monthlyLimitFcfa,
        alertThresholdPercent
      } = req.body || {};

      if (publicConfig?.webhookUrl || publicConfig?.baseUrl) {
        const checkTarget = String(publicConfig.webhookUrl || publicConfig.baseUrl);
        const urlValidation = validateSafeOutboundUrl(checkTarget);
        if (!urlValidation.safe) {
          return res.status(400).json({
            success: false,
            error: 'UNSAFE_PROVIDER_URL',
            message: urlValidation.reason || 'URL fournisseur bloquée par la politique anti-SSRF.'
          });
        }
      }

      const nowIso = new Date().toISOString();
      const idx = controlPlaneDb.providers.findIndex((p) => p.providerKey === providerKey);
      const existing = idx >= 0 ? controlPlaneDb.providers[idx] : null;
      let secretCiphertext = existing?.secretCiphertext;
      let secretKeyVersion = existing?.secretKeyVersion;
      let secretMasked = existing?.secretMasked || 'Non configuré';

      if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
        const encrypted = encryptSecretValue(apiKey.trim());
        secretCiphertext = encrypted.ciphertext;
        secretKeyVersion = encrypted.keyVersion;
        secretMasked = maskSecretValue(apiKey.trim());
      }

      const updated: ControlPlaneApiProviderRecord = {
        providerKey,
        displayName: String(displayName || existing?.displayName || providerKey).slice(0, 100),
        serviceType: (['payments', 'ai_text', 'ai_image', 'ai_video', 'maps', 'storage', 'messaging', 'analytics', 'other'].includes(serviceType)
          ? serviceType
          : existing?.serviceType || 'other') as ServiceProviderType,
        status: ['disabled', 'sandbox', 'active', 'degraded'].includes(status) ? status : existing?.status || 'disabled',
        ...(secretCiphertext ? { secretCiphertext } : {}),
        ...(secretKeyVersion ? { secretKeyVersion } : {}),
        secretMasked,
        publicConfig: typeof publicConfig === 'object' && publicConfig ? { ...(existing?.publicConfig || {}), ...publicConfig } : existing?.publicConfig || {},
        monthlyLimitFcfa:
          monthlyLimitFcfa === null
            ? null
            : typeof monthlyLimitFcfa === 'number' && monthlyLimitFcfa >= 0
            ? Math.round(monthlyLimitFcfa)
            : existing?.monthlyLimitFcfa ?? null,
        alertThresholdPercent:
          typeof alertThresholdPercent === 'number' && alertThresholdPercent >= 1 && alertThresholdPercent <= 100
            ? Math.round(alertThresholdPercent)
            : existing?.alertThresholdPercent ?? 80,
        lastHealthCheckAt: existing?.lastHealthCheckAt || null,
        lastHealthStatus: existing?.lastHealthStatus || null,
        updatedBy: authCtx?.token.email || 'admin@djassa.ci',
        updatedAt: nowIso
      };

      if (idx >= 0) {
        controlPlaneDb.providers[idx] = updated;
      } else {
        controlPlaneDb.providers.push(updated);
      }
      persistControlPlaneDb();

      void syncPgApiProviderSecret({
        providerKey: updated.providerKey,
        displayName: updated.displayName,
        serviceType: updated.serviceType,
        status: updated.status,
        ...(typeof apiKey === 'string' && apiKey.trim() ? { plaintextSecret: apiKey.trim() } : {}),
        publicConfig: updated.publicConfig,
        monthlyLimitFcfa: updated.monthlyLimitFcfa,
        alertThresholdPercent: updated.alertThresholdPercent,
        updatedByUserId: authCtx?.token.uid || 'admin'
      });

      appendAuditEntry({
        actorId: authCtx?.token.uid || 'admin',
        actorName: authCtx?.token.name || 'Administrateur',
        actorAccountLabel: authCtx?.token.email || 'admin@djassa.ci',
        actorRole: 'admin',
        space: 'admin',
        category: 'api',
        actionType: 'api_provider_updated',
        action: `Configuration fournisseur API mise à jour : ${updated.providerKey}`,
        target: updated.providerKey,
        targetType: 'api',
        result: 'reussi',
        severity: 'eleve',
        beforeValue: existing ? existing.status : null,
        afterValue: `${updated.status} (secret ${updated.secretMasked})`,
        details: 'Clé secrète chiffrée AES-256-GCM (jamais exposée en clair)',
        ipAddress: getClientIp(req)
      });

      return res.json({ success: true, provider: sanitizeProviderForPublic(updated) });
    }
  );

  app.get(
    '/api/admin/control-plane/campaigns',
    requireSecurityPermission('viewDashboard'),
    (_req: Request, res: Response) => {
      return res.json({ success: true, campaigns: controlPlaneDb.campaigns });
    }
  );

  app.post(
    '/api/admin/control-plane/campaigns',
    requireSecurityPermission('modifySettings'),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
      const {
        campaignType = 'promotion',
        name,
        status = 'active',
        startsAt,
        endsAt,
        budgetFcfa,
        discountType,
        discountValue,
        maxDiscountFcfa,
        minSubtotalFcfa,
        promoCode,
        description
      } = req.body || {};

      if (!name || String(name).trim().length < 2) {
        return res.status(400).json({ success: false, error: 'INVALID_CAMPAIGN_NAME' });
      }
      const cleanCode = promoCode ? String(promoCode).trim().toUpperCase() : undefined;
      if (cleanCode && controlPlaneDb.campaigns.some((c) => c.promoCode?.toUpperCase() === cleanCode)) {
        return res.status(409).json({ success: false, error: 'PROMO_CODE_ALREADY_EXISTS' });
      }
      if (discountType === 'percent' && Number(discountValue) > 100) {
        return res.status(400).json({ success: false, error: 'PERCENT_DISCOUNT_OVER_100' });
      }
      const nowIso = new Date().toISOString();
      const created: ControlPlaneCampaignRecord = {
        id: `cmp-${crypto.randomUUID().slice(0, 10)}`,
        campaignType: campaignType === 'advertising' ? 'advertising' : 'promotion',
        name: String(name).trim().slice(0, 120),
        status: ['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'].includes(status) ? status : 'active',
        ...(startsAt ? { startsAt: String(startsAt) } : {}),
        ...(endsAt ? { endsAt: String(endsAt) } : {}),
        ...(budgetFcfa !== undefined ? { budgetFcfa: Math.max(0, Number(budgetFcfa) || 0) } : {}),
        spentFcfa: 0,
        ...(discountType === 'fixed' || discountType === 'percent' ? { discountType } : {}),
        ...(discountValue !== undefined ? { discountValue: Math.max(0, Number(discountValue) || 0) } : {}),
        ...(maxDiscountFcfa !== undefined ? { maxDiscountFcfa: Math.max(0, Number(maxDiscountFcfa) || 0) } : {}),
        ...(minSubtotalFcfa !== undefined ? { minSubtotalFcfa: Math.max(0, Number(minSubtotalFcfa) || 0) } : {}),
        ...(cleanCode ? { promoCode: cleanCode } : {}),
        ...(description ? { description: String(description).slice(0, 300) } : {}),
        createdBy: authCtx?.token.email || 'admin@djassa.ci',
        createdAt: nowIso,
        updatedAt: nowIso
      };
      controlPlaneDb.campaigns.unshift(created);
      persistControlPlaneDb();
      return res.status(201).json({ success: true, campaign: created });
    }
  );

  app.patch(
    '/api/admin/control-plane/campaigns/:id',
    requireSecurityPermission('modifySettings'),
    (req: Request, res: Response) => {
      const cmp = controlPlaneDb.campaigns.find((c) => c.id === req.params.id);
      if (!cmp) return res.status(404).json({ success: false, error: 'CAMPAIGN_NOT_FOUND' });
      const patch = req.body || {};
      if (patch.status && ['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'].includes(patch.status)) {
        cmp.status = patch.status;
      }
      if (typeof patch.name === 'string' && patch.name.trim().length >= 2) cmp.name = patch.name.trim().slice(0, 120);
      if (patch.discountValue !== undefined) cmp.discountValue = Math.max(0, Number(patch.discountValue) || 0);
      if (patch.minSubtotalFcfa !== undefined) cmp.minSubtotalFcfa = Math.max(0, Number(patch.minSubtotalFcfa) || 0);
      cmp.updatedAt = new Date().toISOString();
      persistControlPlaneDb();
      return res.json({ success: true, campaign: cmp });
    }
  );

  app.get(
    '/api/admin/control-plane/approvals',
    requireSecurityPermission('viewDashboard'),
    (_req: Request, res: Response) => {
      return res.json({ success: true, approvals: controlPlaneDb.approvals });
    }
  );

  app.post(
    '/api/admin/control-plane/approvals',
    requireSecurityPermission('viewDashboard'),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
      if (!authCtx) return;
      const { actionKey, resourceType, resourceId, requestPayload = {} } = req.body || {};
      if (!actionKey || !resourceType || !resourceId) {
        return res.status(400).json({ success: false, error: 'MISSING_APPROVAL_FIELDS' });
      }
      const nowIso = new Date().toISOString();
      const item: ControlPlaneApprovalRequest = {
        id: `apr-${crypto.randomUUID().slice(0, 10)}`,
        actionKey: String(actionKey).slice(0, 80),
        resourceType: String(resourceType).slice(0, 60),
        resourceId: String(resourceId).slice(0, 100),
        requestedById: authCtx.token.uid,
        requestedByEmail: authCtx.token.email,
        status: 'pending',
        requestPayload: typeof requestPayload === 'object' && requestPayload ? requestPayload : {},
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        createdAt: nowIso
      };
      controlPlaneDb.approvals.unshift(item);
      persistControlPlaneDb();
      void syncPgApprovalRequest({
        id: item.id,
        actionKey: item.actionKey,
        resourceType: item.resourceType,
        resourceId: item.resourceId,
        requestedByUserId: item.requestedById,
        status: item.status,
        requestPayload: item.requestPayload
      });
      return res.status(201).json({ success: true, approval: item });
    }
  );

  app.post(
    '/api/admin/control-plane/approvals/:id/decide',
    requireSecurityPermission('executeProtectionActions'),
    async (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
      if (!authCtx) return;
      const item = controlPlaneDb.approvals.find((a) => a.id === req.params.id);
      if (!item) return res.status(404).json({ success: false, error: 'APPROVAL_NOT_FOUND' });
      if (item.status !== 'pending') {
        return res.status(409).json({ success: false, error: 'APPROVAL_ALREADY_DECIDED' });
      }
      if (Date.now() > Date.parse(item.expiresAt)) {
        item.status = 'expired';
        persistControlPlaneDb();
        return res.status(409).json({ success: false, error: 'APPROVAL_EXPIRED' });
      }
      // Enforce strict two-person separation (mirrors PG CHECK approved_by <> requested_by)
      if (
        item.requestedById === authCtx.token.uid ||
        item.requestedByEmail.toLowerCase() === authCtx.token.email.toLowerCase()
      ) {
        return res.status(409).json({
          success: false,
          error: 'SELF_APPROVAL_FORBIDDEN',
          message: 'Double validation requise : un second administrateur différent du demandeur doit approuver cette action.'
        });
      }
      const { decision, reason = '' } = req.body || {};
      if (decision !== 'approved' && decision !== 'rejected') {
        return res.status(400).json({ success: false, error: 'INVALID_DECISION' });
      }

      const executor = approvalExecutors.get(item.resourceType);
      let executionResult: Record<string, unknown> | undefined;
      if (executor) {
        try {
          executionResult = await executor(item, decision, {
            uid: authCtx.token.uid,
            email: authCtx.token.email,
            reason: String(reason).slice(0, 300)
          });
        } catch (err) {
          return res.status(409).json({
            success: false,
            error: 'APPROVAL_EXECUTION_FAILED',
            message: (err as Error)?.message || 'Exécution de la décision refusée.'
          });
        }
      }

      item.status = decision;
      item.approvedById = authCtx.token.uid;
      item.approvedByEmail = authCtx.token.email;
      item.decisionReason = String(reason).slice(0, 300);
      item.decidedAt = new Date().toISOString();
      persistControlPlaneDb();
      void syncPgApprovalRequest({
        id: item.id,
        actionKey: item.actionKey,
        resourceType: item.resourceType,
        resourceId: item.resourceId,
        requestedByUserId: item.requestedById,
        approvedByUserId: item.approvedById,
        status: item.status,
        requestPayload: item.requestPayload,
        decisionReason: item.decisionReason
      });
      return res.json({ success: true, approval: item, ...(executionResult ? { executionResult } : {}) });
    }
  );

  app.get('/api/admin/control-plane/quotas', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    return res.json({ success: true, quotas: controlPlaneDb.quotas });
  });

  app.patch(
    '/api/admin/control-plane/quotas',
    requireSecurityPermission('modifySettings'),
    (req: Request, res: Response) => {
      const authCtx = (req as Request & { authCtx?: AuthenticatedRequestContext }).authCtx;
      const patch = req.body || {};
      controlPlaneDb.quotas = {
        ...controlPlaneDb.quotas,
        ...(typeof patch.maxProductsPerSeller === 'number' && patch.maxProductsPerSeller >= 1
          ? { maxProductsPerSeller: Math.round(patch.maxProductsPerSeller) }
          : {}),
        ...(typeof patch.maxSellerStorageBytes === 'number' && patch.maxSellerStorageBytes >= 1024 * 1024
          ? { maxSellerStorageBytes: Math.round(patch.maxSellerStorageBytes) }
          : {}),
        ...(typeof patch.maxDriversPerCompany === 'number' && patch.maxDriversPerCompany >= 1
          ? { maxDriversPerCompany: Math.round(patch.maxDriversPerCompany) }
          : {}),
        ...(typeof patch.maxDailyWithdrawalFcfa === 'number' && patch.maxDailyWithdrawalFcfa >= 1000
          ? { maxDailyWithdrawalFcfa: Math.round(patch.maxDailyWithdrawalFcfa) }
          : {}),
        ...(typeof patch.requireTwoPersonApprovalAboveFcfa === 'number' && patch.requireTwoPersonApprovalAboveFcfa >= 0
          ? { requireTwoPersonApprovalAboveFcfa: Math.round(patch.requireTwoPersonApprovalAboveFcfa) }
          : {}),
        maxAiRequestsPerDay: {
          ...controlPlaneDb.quotas.maxAiRequestsPerDay,
          ...(patch.maxAiRequestsPerDay || {})
        }
      };
      persistControlPlaneDb();
      void syncPgAdminSetting({
        key: 'app_quotas',
        value: controlPlaneDb.quotas,
        changedByUserId: authCtx?.token.uid || 'admin',
        reason: 'Mise à jour quotas par espace et formule'
      });
      return res.json({ success: true, quotas: controlPlaneDb.quotas });
    }
  );
}

type TwoPersonApprovalExecutor = (
  approval: ControlPlaneApprovalRequest,
  decision: 'approved' | 'rejected',
  actor: { uid: string; email: string; reason?: string }
) => Promise<Record<string, unknown> | undefined> | Record<string, unknown> | undefined;

const approvalExecutors = new Map<string, TwoPersonApprovalExecutor>();

export function registerTwoPersonApprovalExecutor(resourceType: string, executor: TwoPersonApprovalExecutor): void {
  approvalExecutors.set(resourceType, executor);
}

export function enqueueTwoPersonApprovalRequest(input: {
  actionKey: string;
  resourceType: string;
  resourceId: string;
  requestedById: string;
  requestedByEmail: string;
  requestPayload?: Record<string, unknown>;
}): ControlPlaneApprovalRequest {
  const existing = controlPlaneDb.approvals.find(
    (a) =>
      a.resourceType === input.resourceType &&
      a.resourceId === input.resourceId &&
      a.status === 'pending'
  );
  if (existing) return existing;

  const item: ControlPlaneApprovalRequest = {
    id: `apr-${crypto.randomUUID().slice(0, 10)}`,
    actionKey: String(input.actionKey).slice(0, 80),
    resourceType: String(input.resourceType).slice(0, 60),
    resourceId: String(input.resourceId).slice(0, 100),
    requestedById: input.requestedById,
    requestedByEmail: input.requestedByEmail,
    status: 'pending',
    requestPayload: input.requestPayload || {},
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString()
  };
  controlPlaneDb.approvals.unshift(item);
  persistControlPlaneDb();
  void syncPgApprovalRequest({
    id: item.id,
    actionKey: item.actionKey,
    resourceType: item.resourceType,
    resourceId: item.resourceId,
    requestedByUserId: item.requestedById,
    status: item.status,
    requestPayload: item.requestPayload
  });
  return item;
}

export function getSpaceQuotaSummary(spaceRole: PlatformSpaceRole) {
  return {
    spaceRole,
    quotas: controlPlaneDb.quotas
  };
}

