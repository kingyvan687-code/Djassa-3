import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import express, { type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import { countWords, GPT_CLIENT_MAX_WORDS } from './src/services/aiWordLimit.ts';

import {
  authenticateAdminWebSocket,
  authenticateSessionRequest,
  getClientIp,
  installSecurityMiddleware,
  installSecurityRoutes,
  requireSecurityPermission,
  registerAdminNotificationStreamHub,
  verifySignedToken
} from './server/securityModule.ts';
import { installAuthRoutes, listAuthUsersPublic } from './server/authModule.ts';
import { installPostgresAuthRoutes } from './server/postgresAuthRoutes.ts';
import { installCommerceRoutes, registerCreditRechargeWebhookHandler } from './server/commerceModule.ts';
import { installDisputesRoutes } from './server/disputesModule.ts';
import { installFraudRoutes } from './server/fraudModule.ts';
import { installRefundsRoutes } from './server/refundsModule.ts';
import { installPrivacyRoutes } from './server/privacyModule.ts';
import { installBackupRoutes } from './server/backupModule.ts';
import { installMaintenanceRoutes } from './server/maintenanceModule.ts';
import { installSystemSurveillanceRoutes } from './server/systemSurveillanceModule.ts';
import { installTeamRoutes } from './server/teamModule.ts';
import { commerceDb } from './server/commerceModule.ts';
import {
  checkGuestAiQuota,
  consumeWsTicket,
  incrementGuestAiQuota,
  installClientRoutes
} from './server/clientModule.ts';
import { VISITOR_AI_EXHAUSTED_MESSAGE } from './src/config/visitorQuotas.ts';
import { databaseHealth } from './server/database.ts';
import { atomicWriteJsonFile } from './server/atomicFileStore.ts';
import { installAdminControlPlaneRoutes } from './server/adminControlPlaneModule.ts';
import {
  fetchGeniusPayDepositStatus,
  getGeniusPayConfig,
  initiateGeniusPayDeposit
} from './server/geniusPayService.ts';
import {
  callRodiumChat,
  callRodiumImageGeneration,
  callRodiumVideoGeneration,
  getRodiumAiConfig,
  RODIUM_AUTHORIZED_MODELS
} from './server/rodiumAiService.ts';
import { getR2StorageConfig } from './server/r2StorageService.ts';
import { getFcmConfig } from './server/fcmService.ts';
import { getGoogleMapsConfig, installGoogleMapsRoutes } from './server/googleMapsService.ts';
import { probeSupabaseHealth } from './server/supabaseService.ts';
import {
  recordPgAiCreditTransaction,
  syncPgAiCreditAccount,
  syncPgAiCreditRecharge
} from './server/repositories/financePgRepository.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const CREDITS_DB_PATH = path.join(__dirname, 'server', 'data', 'credits_billing.json');

interface CreditsBillingDb {
  config: {
    creditValueFcfa: number;
    minRechargeFcfa: number;
    paymentFeeRate: number;
    packs: Array<{
      id: string;
      name: string;
      priceFcfa: number;
      credits: number;
      badge?: string;
      isPopular?: boolean;
    }>;
    pricing: Record<
      'chat' | 'image' | 'video',
      {
        name: string;
        credits: number;
        model: string;
        apiCostFcfa: number;
        isEstimate: boolean;
        costSource: string;
        provider: string;
      }
    >;
  };
  accounts: Record<
    string,
    {
      balance: number;
      updatedAt: string;
      lastBonusDate?: string;
      lastBonusAt?: string;
      activePlan?: string;
      activePlanUpdatedAt?: string;
    }
  >;
  recharges: Array<{
    id: string;
    userId: string;
    amountFcfa: number;
    credits: number;
    planId?: string;
    planName?: string;
    packId?: string;
    purchaseType?: 'subscription' | 'pack' | 'custom';
    paymentMethod: string;
    phoneNumber?: string;
    paymentFeeFcfa: number;
    netRevenueFcfa: number;
    status: 'pending' | 'confirmed' | 'failed' | 'rejected';
    providerReference?: string;
    providerStatus?: string;
    providerError?: string;
    checkoutUrl?: string;
    verifiedAt?: string;
    verifiedBy?: string;
    createdAt: string;
  }>;
  usages: Array<{
    id: string;
    idempotencyKey?: string;
    userId: string;
    serviceType: 'chat' | 'image' | 'video';
    model: string;
    credits: number;
    amountChargedFcfa: number;
    apiCostFcfa: number;
    isEstimate: boolean;
    costSource: string;
    grossProfitFcfa: number;
    status: 'success' | 'failed' | 'refunded';
    label: string;
    createdAt: string;
    failureReason?: string;
  }>;
  refunds: Array<{
    id: string;
    originalUsageId: string;
    userId: string;
    credits: number;
    amountFcfa: number;
    reason: string;
    createdAt: string;
  }>;
  processedKeys: Record<string, unknown>;
}

function buildDefaultCreditsDb(): CreditsBillingDb {
  return {
    config: {
      creditValueFcfa: 10,
      minRechargeFcfa: 3500,
      paymentFeeRate: 0.015,
      packs: [
        { id: 'pack-350', name: 'Pack Découverte', priceFcfa: 3500, credits: 350, badge: 'Starter' },
        { id: 'pack-500', name: 'Pack Croissance', priceFcfa: 5000, credits: 500, badge: 'Populaire', isPopular: true },
        { id: 'pack-1000', name: 'Pack Pro', priceFcfa: 10000, credits: 1000, badge: 'Pro' }
      ],
      pricing: {
        chat: {
          name: 'Discussion & analyse avec l’IA',
          credits: 5,
          model: 'minimax-m3.1-flash',
          apiCostFcfa: 8,
          isEstimate: true,
          costSource: 'Tarif estimé RodiumAI',
          provider: 'RodiumAI (MiniMax M3.1 Flash)'
        },
        image: {
          name: 'Génération image IA',
          credits: 10,
          model: 'qwen-image-2.1-turbo',
          apiCostFcfa: 25,
          isEstimate: true,
          costSource: 'Tarif estimé RodiumAI',
          provider: 'RodiumAI (Qwen Image 2.1 Turbo)'
        },
        video: {
          name: 'Génération vidéo 5s',
          credits: 60,
          model: 'qwen-image-2.1-turbo',
          apiCostFcfa: 210,
          isEstimate: true,
          costSource: 'Tarif estimé RodiumAI',
          provider: 'RodiumAI Studio'
        }
      }
    },
    accounts: {},
    recharges: [],
    usages: [],
    refunds: [],
    processedKeys: {}
  };
}

function readCreditsDb(): CreditsBillingDb {
  const defaults = buildDefaultCreditsDb();
  if (!fs.existsSync(CREDITS_DB_PATH)) {
    atomicWriteJsonFile(CREDITS_DB_PATH, defaults, { context: 'CreditsBilling' });
    return defaults;
  }
  try {
    const raw = fs.readFileSync(CREDITS_DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<CreditsBillingDb>;
    return {
      config: {
        ...defaults.config,
        ...(parsed.config || {}),
        packs: Array.isArray(parsed.config?.packs) && parsed.config.packs.length > 0
          ? parsed.config.packs
          : defaults.config.packs,
        pricing: {
          ...defaults.config.pricing,
          ...(parsed.config?.pricing || {})
        }
      },
      accounts: parsed.accounts && typeof parsed.accounts === 'object' ? parsed.accounts : {},
      recharges: Array.isArray(parsed.recharges) ? parsed.recharges : [],
      usages: Array.isArray(parsed.usages) ? parsed.usages : [],
      refunds: Array.isArray(parsed.refunds) ? parsed.refunds : [],
      processedKeys: parsed.processedKeys && typeof parsed.processedKeys === 'object' ? parsed.processedKeys : {}
    };
  } catch (err) {
    console.error('[CreditsBilling] Failed to read credits_billing.json, using defaults:', err);
    return defaults;
  }
}

function writeCreditsDb(db: CreditsBillingDb): void {
  if (!atomicWriteJsonFile(CREDITS_DB_PATH, db, { context: 'CreditsBilling' })) {
    throw new Error('FAILED_TO_PERSIST_CREDITS_DB');
  }
}

function runCreditsPgSync(label: string, fn: () => Promise<void>): void {
  void fn().catch((err) => {
    console.warn(`[CreditsBilling][PG] ${label}:`, (err as Error)?.message || err);
  });
}

interface ServerCreditPlanDef {
  id: string;
  name: string;
  audience: 'client' | 'seller';
  priceFcfa: number;
  credits: number;
}

export const SERVER_CREDIT_PLANS: Record<string, ServerCreditPlanDef> = {
  mini: { id: 'mini', name: 'DJASSA Mini', audience: 'client', priceFcfa: 300, credits: 30 },
  plus: { id: 'plus', name: 'DJASSA Plus', audience: 'client', priceFcfa: 600, credits: 60 },
  premium: { id: 'premium', name: 'DJASSA Premium', audience: 'client', priceFcfa: 1200, credits: 120 },
  vendeur_starter: { id: 'vendeur_starter', name: 'Vendeur Starter', audience: 'seller', priceFcfa: 4500, credits: 450 },
  vendeur_pro: { id: 'vendeur_pro', name: 'Vendeur Pro Marché', audience: 'seller', priceFcfa: 8900, credits: 900 },
  vendeur_elite: { id: 'vendeur_elite', name: 'Vendeur Élite Studio', audience: 'seller', priceFcfa: 16900, credits: 1800 }
};

export const SERVER_CREDIT_PACKS: Record<string, { id: string; name: string; priceFcfa: number; credits: number }> = {
  'pack-350': { id: 'pack-350', name: 'Pack Découverte', priceFcfa: 3500, credits: 350 },
  'pack-3500': { id: 'pack-3500', name: 'Pack Découverte (Min.)', priceFcfa: 3500, credits: 350 },
  'pack-500': { id: 'pack-500', name: 'Pack Croissance', priceFcfa: 5000, credits: 500 },
  'pack-5000': { id: 'pack-5000', name: 'Pack Populaire', priceFcfa: 5000, credits: 500 },
  'pack-1000': { id: 'pack-1000', name: 'Pack Pro', priceFcfa: 10000, credits: 1000 },
  'pack-10000': { id: 'pack-10000', name: 'Pack Créateur', priceFcfa: 10000, credits: 1000 },
  'pack-20000': { id: 'pack-20000', name: 'Pack Mega VIP', priceFcfa: 20000, credits: 2000 }
};

const VALID_GENIUSPAY_METHODS = new Set(['wave', 'orange_money', 'mtn_momo', 'card']);

export function applyCreditsRechargeWebhookEvent(input: {
  rechargeId: string;
  reference?: string;
  status: 'confirmed' | 'failed';
  providerReference?: string;
  providerStatus?: string;
  paidAmountFcfa?: number;
  expectedUserId?: string;
  verifiedBy?: string;
}): {
  found: boolean;
  idempotent?: boolean;
  rejected?: boolean;
  error?: string;
  message?: string;
  newBalance?: number;
  activePlan?: string;
  recharge?: CreditsBillingDb['recharges'][number];
} {
  const db = readCreditsDb();
  const recharge = db.recharges.find(
    (r) =>
      r.id === input.rechargeId ||
      (input.reference && r.id === input.reference) ||
      (input.providerReference && r.providerReference && r.providerReference === input.providerReference)
  );
  if (!recharge) return { found: false };

  const idempotencyKey = `credit-recharge:${recharge.id}`;
  const alreadyProcessed = recharge.status === 'confirmed' || Boolean(db.processedKeys[idempotencyKey]);
  if (alreadyProcessed) {
    return {
      found: true,
      idempotent: true,
      newBalance: db.accounts[recharge.userId]?.balance ?? 0,
      activePlan: db.accounts[recharge.userId]?.activePlan,
      recharge
    };
  }

  // Verify user ownership if metadata.userId was supplied
  if (input.expectedUserId && String(input.expectedUserId).trim() !== recharge.userId) {
    return {
      found: true,
      rejected: true,
      error: 'USER_MISMATCH',
      message: 'Le propriétaire de la transaction ne correspond pas au compte utilisateur.',
      newBalance: db.accounts[recharge.userId]?.balance ?? 0,
      recharge
    };
  }

  // Verify transaction reference consistency if providerReference already set
  if (
    recharge.providerReference &&
    input.providerReference &&
    recharge.providerReference !== input.providerReference &&
    input.rechargeId !== recharge.id &&
    input.reference !== recharge.id
  ) {
    return {
      found: true,
      rejected: true,
      error: 'REFERENCE_MISMATCH',
      message: 'Référence fournisseur incompatible avec cette transaction.',
      newBalance: db.accounts[recharge.userId]?.balance ?? 0,
      recharge
    };
  }

  // Verify paid amount matches exact plan/pack price
  if (input.status === 'confirmed' && input.paidAmountFcfa !== undefined && Number.isFinite(input.paidAmountFcfa)) {
    if (Math.round(input.paidAmountFcfa) !== Math.round(recharge.amountFcfa)) {
      return {
        found: true,
        rejected: true,
        error: 'AMOUNT_MISMATCH',
        message: `Montant payé (${input.paidAmountFcfa} FCFA) différent du tarif officiel (${recharge.amountFcfa} FCFA).`,
        newBalance: db.accounts[recharge.userId]?.balance ?? 0,
        recharge
      };
    }
  }

  const nowIso = new Date().toISOString();
  if (input.providerReference && !recharge.providerReference) {
    recharge.providerReference = input.providerReference;
  }
  if (input.providerStatus) {
    recharge.providerStatus = input.providerStatus;
  }

  if (input.status === 'confirmed') {
    if (recharge.status === 'failed' || recharge.status === 'rejected') {
      return {
        found: true,
        idempotent: true,
        newBalance: db.accounts[recharge.userId]?.balance ?? 0,
        activePlan: db.accounts[recharge.userId]?.activePlan,
        recharge
      };
    }
    recharge.status = 'confirmed';
    recharge.verifiedAt = nowIso;
    recharge.verifiedBy = input.verifiedBy || 'geniuspay_webhook';

    const prev = db.accounts[recharge.userId]?.balance ?? 0;
    const newBalance = prev + recharge.credits;
    const nextPlan = recharge.planId || db.accounts[recharge.userId]?.activePlan;
    db.accounts[recharge.userId] = {
      ...(db.accounts[recharge.userId] || {}),
      balance: newBalance,
      updatedAt: nowIso,
      ...(nextPlan ? { activePlan: nextPlan, activePlanUpdatedAt: nowIso } : {})
    };
    db.processedKeys[idempotencyKey] = {
      at: nowIso,
      rechargeId: recharge.id,
      userId: recharge.userId,
      credits: recharge.credits,
      amountFcfa: recharge.amountFcfa,
      verifiedBy: recharge.verifiedBy
    };
    writeCreditsDb(db);
    runCreditsPgSync('webhook-confirm', async () => {
      await syncPgAiCreditRecharge(recharge);
      await syncPgAiCreditAccount({ userId: recharge.userId, balanceCredits: newBalance });
      await recordPgAiCreditTransaction({
        id: `tx-rch-${recharge.id}`,
        userId: recharge.userId,
        txType: 'recharge',
        creditsDelta: recharge.credits,
        amountFcfa: recharge.amountFcfa,
        status: 'confirmed',
        idempotencyKey,
        metadata: {
          providerReference: recharge.providerReference || null,
          verifiedBy: recharge.verifiedBy,
          planId: recharge.planId || null,
          packId: recharge.packId || null
        }
      });
    });
    return { found: true, newBalance, activePlan: nextPlan, recharge };
  }

  if (recharge.status === 'pending') {
    recharge.status = 'failed';
    recharge.verifiedAt = nowIso;
    recharge.verifiedBy = input.verifiedBy || 'geniuspay_webhook';
    writeCreditsDb(db);
    runCreditsPgSync('webhook-fail', async () => {
      await syncPgAiCreditRecharge(recharge);
    });
  }
  return {
    found: true,
    newBalance: db.accounts[recharge.userId]?.balance ?? 0,
    activePlan: db.accounts[recharge.userId]?.activePlan,
    recharge
  };
}

function registerCreditsAndAiRoutes(app: express.Express) {
  registerCreditRechargeWebhookHandler(applyCreditsRechargeWebhookEvent);
  app.get('/api/credits/config', (_req: Request, res: Response) => {
    try {
      const db = readCreditsDb();
      res.json({
        success: true,
        config: db.config,
        clientPlans: [SERVER_CREDIT_PLANS.mini, SERVER_CREDIT_PLANS.plus, SERVER_CREDIT_PLANS.premium]
      });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.patch('/api/credits/config', requireSecurityPermission('modifySettings'), (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    if (authCtx.token.spaceRole !== 'admin') {
      res.status(403).json({ success: false, message: 'Accès administrateur requis.' });
      return;
    }
    try {
      const db = readCreditsDb();
      const patch = req.body || {};
      db.config = {
        ...db.config,
        ...patch,
        pricing: {
          ...db.config.pricing,
          ...(patch.pricing || {})
        }
      };
      writeCreditsDb(db);
      res.json({ success: true, config: db.config });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.get('/api/credits/balance', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    try {
      const db = readCreditsDb();
      const userId = authCtx.token.uid;
      const account = db.accounts[userId] || { balance: 0, updatedAt: new Date().toISOString() };
      res.json({
        success: true,
        userId,
        balance: account.balance,
        balanceFcfa: account.balance * (db.config.creditValueFcfa || 10),
        activePlan: account.activePlan || 'gratuit'
      });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.get('/api/credits/balance/:userId', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    try {
      const requestedUserId = String(req.params.userId || '').trim();
      const isSelf =
        requestedUserId === authCtx.token.uid ||
        requestedUserId === authCtx.token.email ||
        (authCtx.token.staffId && requestedUserId === authCtx.token.staffId);
      if (!isSelf && authCtx.token.spaceRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN_CREDITS_ACCESS',
          message: 'Vous ne pouvez consulter que votre propre solde de crédits.'
        });
        return;
      }
      const userId = isSelf ? authCtx.token.uid : requestedUserId;
      const db = readCreditsDb();
      const account = db.accounts[userId] || { balance: 0, updatedAt: new Date().toISOString() };
      res.json({
        success: true,
        userId,
        balance: account.balance,
        balanceFcfa: account.balance * (db.config.creditValueFcfa || 10),
        activePlan: account.activePlan || 'gratuit'
      });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.get('/api/credits/history', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    try {
      const db = readCreditsDb();
      const userId = authCtx.token.uid;
      res.json({
        success: true,
        activePlan: db.accounts[userId]?.activePlan || 'gratuit',
        recharges: db.recharges.filter((r) => r.userId === userId).slice(0, 50),
        usages: db.usages.filter((u) => u.userId === userId).slice(0, 50),
        refunds: db.refunds.filter((r) => r.userId === userId).slice(0, 50)
      });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.post('/api/credits/claim-daily-bonus', (req: Request, res: Response) => {
    try {
      const authCtx = authenticateSessionRequest(req, res);
      if (!authCtx) return;
      const userId = authCtx.token.uid;
      const db = readCreditsDb();
      const now = new Date();
      const nowIso = now.toISOString();
      const today = nowIso.slice(0, 10);
      const current = db.accounts[userId] || { balance: 0, updatedAt: nowIso };
      const lastBonusTime = current.lastBonusAt ? Date.parse(current.lastBonusAt) : NaN;
      const elapsedMs = Number.isFinite(lastBonusTime) ? now.getTime() - lastBonusTime : Number.POSITIVE_INFINITY;
      const legacySameDayClaim = !current.lastBonusAt && current.lastBonusDate === today;
      if (elapsedMs < 24 * 60 * 60 * 1000 || legacySameDayClaim) {
        const retryAfterSeconds = Number.isFinite(elapsedMs)
          ? Math.max(1, Math.ceil((24 * 60 * 60 * 1000 - elapsedMs) / 1000))
          : undefined;
        res.status(429).json({
          success: false,
          error: 'DAILY_BONUS_COOLDOWN',
          message: 'Le prochain bonus sera disponible 24 heures après le précédent.',
          ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
          newBalance: current.balance
        });
        return;
      }
      const creditsAdded = 10;
      const nextBalance = current.balance + creditsAdded;
      db.accounts[userId] = {
        ...current,
        balance: nextBalance,
        updatedAt: nowIso,
        lastBonusDate: today,
        lastBonusAt: nowIso
      };
      writeCreditsDb(db);
      runCreditsPgSync('daily-bonus', async () => {
        await syncPgAiCreditAccount({
          userId,
          balanceCredits: nextBalance,
          lastDailyBonusAt: nowIso
        });
        await recordPgAiCreditTransaction({
          id: `tx-bonus-${userId}-${now.getTime()}`,
          userId,
          txType: 'bonus',
          creditsDelta: creditsAdded,
          amountFcfa: 0,
          status: 'confirmed',
          idempotencyKey: `daily-bonus:${userId}:${today}:${now.getTime()}`
        });
      });
      res.json({
        success: true,
        creditsAdded,
        newBalance: nextBalance,
        message: `+${creditsAdded} crédits quotidiens ajoutés !`
      });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.post('/api/credits/recharge/confirm', async (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    try {
      const initialDb = readCreditsDb();
      const { amountFcfa, paymentMethod = 'wave', phoneNumber, planId, packId, purchaseType } = req.body || {};
      const targetUserId =
        authCtx.token.spaceRole === 'admin' && req.body?.userId ? String(req.body.userId) : authCtx.token.uid;

      const methodStr = String(paymentMethod || '').trim().toLowerCase();
      if (!VALID_GENIUSPAY_METHODS.has(methodStr)) {
        res.status(400).json({
          success: false,
          error: 'INVALID_PAYMENT_METHOD',
          message: 'Moyen de paiement non supporté. Utilisez wave, orange_money, mtn_momo ou card.'
        });
        return;
      }
      const normalizedMethod = methodStr as 'wave' | 'orange_money' | 'mtn_momo' | 'card';

      const cleanPlanId = typeof planId === 'string' ? planId.trim().toLowerCase() : '';
      const cleanPackId = typeof packId === 'string' ? packId.trim() : '';

      let authoritativeAmount = 0;
      let authoritativeCredits = 0;
      let resolvedPlanId: string | undefined;
      let resolvedPlanName: string | undefined;
      let resolvedPackId: string | undefined;
      let resolvedPurchaseType: 'subscription' | 'pack' | 'custom' = 'custom';

      if (cleanPlanId || purchaseType === 'subscription') {
        const planDef = SERVER_CREDIT_PLANS[cleanPlanId];
        if (!planDef) {
          res.status(400).json({
            success: false,
            error: 'INVALID_SUBSCRIPTION_PLAN',
            message: 'Forfait d’abonnement invalide ou inconnu.'
          });
          return;
        }
        if (amountFcfa !== undefined && Number(amountFcfa) !== planDef.priceFcfa) {
          res.status(400).json({
            success: false,
            error: 'PLAN_PRICE_MISMATCH',
            message: `Le tarif officiel du forfait ${planDef.name} est de ${planDef.priceFcfa} FCFA.`
          });
          return;
        }
        authoritativeAmount = planDef.priceFcfa;
        authoritativeCredits = planDef.credits;
        resolvedPlanId = planDef.id;
        resolvedPlanName = planDef.name;
        resolvedPurchaseType = 'subscription';
      } else if (cleanPackId) {
        const packDef =
          SERVER_CREDIT_PACKS[cleanPackId] ||
          initialDb.config.packs.find((p) => p.id === cleanPackId);
        if (!packDef) {
          res.status(400).json({
            success: false,
            error: 'INVALID_CREDIT_PACK',
            message: 'Pack de crédits invalide ou inconnu.'
          });
          return;
        }
        if (amountFcfa !== undefined && Number(amountFcfa) !== packDef.priceFcfa) {
          res.status(400).json({
            success: false,
            error: 'PACK_PRICE_MISMATCH',
            message: `Le tarif officiel de ce pack est de ${packDef.priceFcfa} FCFA.`
          });
          return;
        }
        if (packDef.priceFcfa < initialDb.config.minRechargeFcfa) {
          res.status(400).json({
            success: false,
            error: 'MIN_RECHARGE_REQUIRED',
            message: `La recharge minimale est de ${initialDb.config.minRechargeFcfa} FCFA.`
          });
          return;
        }
        authoritativeAmount = packDef.priceFcfa;
        authoritativeCredits = packDef.credits;
        resolvedPackId = packDef.id;
        resolvedPurchaseType = 'pack';
      } else {
        const amount = Number(amountFcfa || 0);
        if (!Number.isFinite(amount) || amount < initialDb.config.minRechargeFcfa) {
          res.status(400).json({
            success: false,
            error: 'MIN_RECHARGE_REQUIRED',
            message: `La recharge minimale est de ${initialDb.config.minRechargeFcfa} FCFA.`
          });
          return;
        }
        authoritativeAmount = Math.round(amount);
        authoritativeCredits = Math.floor(authoritativeAmount / (initialDb.config.creditValueFcfa || 10));
        resolvedPurchaseType = 'custom';
      }

      const gpCfg = getGeniusPayConfig();
      const cleanPhone = phoneNumber ? String(phoneNumber).trim() : '';
      if (gpCfg.configured && normalizedMethod !== 'card' && !cleanPhone) {
        res.status(400).json({
          success: false,
          error: 'PHONE_REQUIRED',
          message: 'Numéro de téléphone Mobile Money requis pour ce mode de paiement.'
        });
        return;
      }

      const paymentFeeFcfa = Math.round(authoritativeAmount * (initialDb.config.paymentFeeRate || 0.015));
      const netRevenueFcfa = Math.max(0, authoritativeAmount - paymentFeeFcfa);
      const rechargeId = `rch-${crypto.randomUUID()}`;

      let providerReference: string | undefined;
      let providerStatus: string | undefined;
      let providerError: string | undefined;
      let checkoutUrl: string | undefined;
      let initialStatus: 'pending' | 'failed' = 'pending';

      if (gpCfg.configured && (cleanPhone || normalizedMethod === 'card')) {
        const initRes = await initiateGeniusPayDeposit({
          depositId: rechargeId,
          amountFcfa: authoritativeAmount,
          provider: normalizedMethod,
          payerPhone: cleanPhone || undefined,
          statementDescription: resolvedPlanName ? `DJASSA ${resolvedPlanName}` : 'DJASSA CREDITS IA',
          metadata: {
            rechargeId,
            userId: targetUserId,
            ...(resolvedPlanId ? { planId: resolvedPlanId } : {}),
            ...(resolvedPackId ? { packId: resolvedPackId } : {})
          }
        });
        if (initRes.ok && initRes.depositId) {
          providerReference = initRes.depositId;
          providerStatus = initRes.status;
          if (initRes.checkoutUrl) {
            checkoutUrl = initRes.checkoutUrl;
          }
        } else {
          providerError = initRes.error || 'GENIUSPAY_INITIATION_FAILED';
          providerStatus = initRes.status;
          if (initRes.status === 'failed') {
            initialStatus = 'failed';
          }
        }
      }

      // Re-read credits DB after network call to avoid overwriting concurrent updates; NEVER credit here.
      const db = readCreditsDb();
      const recharge: CreditsBillingDb['recharges'][number] = {
        id: rechargeId,
        userId: targetUserId,
        amountFcfa: authoritativeAmount,
        credits: authoritativeCredits,
        ...(resolvedPlanId ? { planId: resolvedPlanId } : {}),
        ...(resolvedPlanName ? { planName: resolvedPlanName } : {}),
        ...(resolvedPackId ? { packId: resolvedPackId } : {}),
        purchaseType: resolvedPurchaseType,
        paymentMethod: normalizedMethod,
        phoneNumber: cleanPhone || undefined,
        ...(providerReference ? { providerReference } : {}),
        ...(providerStatus ? { providerStatus } : {}),
        ...(providerError ? { providerError } : {}),
        ...(checkoutUrl ? { checkoutUrl } : {}),
        paymentFeeFcfa,
        netRevenueFcfa,
        status: initialStatus,
        createdAt: new Date().toISOString()
      };
      db.recharges.unshift(recharge);
      writeCreditsDb(db);
      runCreditsPgSync('recharge-create', async () => {
        await syncPgAiCreditRecharge(recharge);
      });
      const currentBalance = db.accounts[recharge.userId]?.balance ?? 0;
      if (initialStatus === 'failed') {
        res.status(502).json({
          success: false,
          error: 'GENIUSPAY_DEPOSIT_REJECTED',
          status: 'failed',
          providerConfigured: gpCfg.configured,
          providerStatus,
          newBalance: currentBalance,
          recharge,
          message: providerError || 'GeniusPay a refusé l’initiation de la recharge.'
        });
        return;
      }
      res.status(202).json({
        success: true,
        pending: true,
        status: 'pending',
        providerConfigured: gpCfg.configured,
        ...(checkoutUrl ? { checkoutUrl } : {}),
        ...(providerStatus ? { providerStatus } : {}),
        ...(providerError ? { providerError } : {}),
        newBalance: currentBalance,
        recharge,
        message: checkoutUrl
          ? 'Paiement initié : finalisez le règlement sur la page sécurisée GeniusPay puis attendez la confirmation.'
          : 'Demande de paiement enregistrée et en attente de confirmation GeniusPay.'
      });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.get('/api/credits/recharge/:rechargeId/status', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    try {
      const db = readCreditsDb();
      const rechargeId = String(req.params.rechargeId);
      const recharge = db.recharges.find((r) => r.id === rechargeId);
      if (!recharge) {
        res.status(404).json({ success: false, message: 'Recharge introuvable.' });
        return;
      }
      if (recharge.userId !== authCtx.token.uid && authCtx.token.spaceRole !== 'admin') {
        res.status(403).json({ success: false, error: 'FORBIDDEN_CREDITS_ACCESS', message: 'Accès refusé.' });
        return;
      }
      const account = db.accounts[recharge.userId];
      res.json({
        success: true,
        status: recharge.status,
        pending: recharge.status === 'pending',
        confirmed: recharge.status === 'confirmed',
        newBalance: account?.balance ?? 0,
        activePlan: account?.activePlan || 'gratuit',
        recharge
      });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.post('/api/credits/recharge/:rechargeId/verify-provider', async (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    try {
      const db = readCreditsDb();
      const rechargeId = String(req.params.rechargeId);
      const recharge = db.recharges.find((r) => r.id === rechargeId);
      if (!recharge) {
        res.status(404).json({ success: false, message: 'Recharge introuvable.' });
        return;
      }
      if (recharge.userId !== authCtx.token.uid && authCtx.token.spaceRole !== 'admin') {
        res.status(403).json({ success: false, error: 'FORBIDDEN_CREDITS_ACCESS', message: 'Accès refusé.' });
        return;
      }
      if (recharge.status === 'confirmed') {
        res.json({
          success: true,
          idempotent: true,
          status: 'confirmed',
          newBalance: db.accounts[recharge.userId]?.balance ?? 0,
          activePlan: db.accounts[recharge.userId]?.activePlan || 'gratuit',
          recharge
        });
        return;
      }
      const cfg = getGeniusPayConfig();
      if (!cfg.configured) {
        res.status(409).json({
          success: false,
          error: 'GENIUSPAY_NOT_CONFIGURED',
          status: recharge.status,
          newBalance: db.accounts[recharge.userId]?.balance ?? 0,
          recharge,
          message: 'Clé GeniusPay non configurée sur le serveur.'
        });
        return;
      }
      const statusRes = await fetchGeniusPayDepositStatus(recharge.providerReference || recharge.id);
      if (!statusRes.found) {
        res.status(502).json({
          success: false,
          error: 'GENIUSPAY_STATUS_CHECK_FAILED',
          message: statusRes.error || 'Vérification GeniusPay impossible.'
        });
        return;
      }
      const metaUserId =
        statusRes.metadata && typeof statusRes.metadata.userId === 'string'
          ? statusRes.metadata.userId
          : undefined;
      if (statusRes.djassaStatus === 'confirmed') {
        const applied = applyCreditsRechargeWebhookEvent({
          rechargeId: recharge.id,
          reference: statusRes.reference,
          status: 'confirmed',
          providerReference: recharge.providerReference || recharge.id,
          providerStatus: statusRes.providerStatus,
          ...(statusRes.amountFcfa !== undefined ? { paidAmountFcfa: statusRes.amountFcfa } : {}),
          ...(metaUserId ? { expectedUserId: metaUserId } : {}),
          verifiedBy: `geniuspay_poll:${authCtx.token.email}`
        });
        if (applied.rejected) {
          res.status(409).json({
            success: false,
            error: applied.error || 'RECHARGE_VERIFICATION_FAILED',
            message: applied.message || 'Vérification GeniusPay refusée.',
            newBalance: applied.newBalance,
            recharge: applied.recharge
          });
          return;
        }
        res.json({
          success: true,
          status: 'confirmed',
          newBalance: applied.newBalance,
          activePlan: applied.activePlan || 'gratuit',
          recharge: applied.recharge
        });
        return;
      }
      if (statusRes.djassaStatus === 'failed' || statusRes.djassaStatus === 'cancelled') {
        const applied = applyCreditsRechargeWebhookEvent({
          rechargeId: recharge.id,
          status: 'failed',
          providerReference: recharge.providerReference || recharge.id,
          providerStatus: statusRes.providerStatus,
          verifiedBy: `geniuspay_poll:${authCtx.token.email}`
        });
        res.status(402).json({
          success: false,
          error: 'RECHARGE_PAYMENT_FAILED',
          status: 'failed',
          newBalance: applied.newBalance,
          recharge: applied.recharge,
          message: 'Le paiement de la recharge a échoué chez GeniusPay.'
        });
        return;
      }
      res.status(202).json({
        success: true,
        pending: true,
        status: 'pending',
        providerStatus: statusRes.providerStatus || statusRes.djassaStatus || 'pending',
        newBalance: db.accounts[recharge.userId]?.balance ?? 0,
        recharge
      });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.get('/api/credits/recharges/pending', requireSecurityPermission('manageFinanceProtection'), (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    if (authCtx.token.spaceRole !== 'admin') {
      res.status(403).json({ success: false, message: 'Accès administrateur requis.' });
      return;
    }
    try {
      const db = readCreditsDb();
      const pendingRecharges = db.recharges.filter((r) => r.status === 'pending');
      res.json({ success: true, pendingRecharges });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.post('/api/credits/recharge/:rechargeId/verify', requireSecurityPermission('manageFinanceProtection'), (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    if (authCtx.token.spaceRole !== 'admin') {
      res.status(403).json({ success: false, message: 'Accès administrateur requis.' });
      return;
    }
    try {
      const rechargeId = String(req.params.rechargeId);
      const applied = applyCreditsRechargeWebhookEvent({
        rechargeId,
        status: 'confirmed',
        providerReference: req.body?.providerReference ? String(req.body.providerReference) : undefined,
        verifiedBy: authCtx.token.email
      });
      if (!applied.found) {
        res.status(404).json({ success: false, message: 'Recharge introuvable.' });
        return;
      }
      if (applied.idempotent) {
        res.json({
          success: true,
          idempotent: true,
          newBalance: applied.newBalance,
          activePlan: applied.activePlan,
          recharge: applied.recharge,
          message: 'Recharge déjà validée.'
        });
        return;
      }
      res.json({
        success: true,
        newBalance: applied.newBalance,
        activePlan: applied.activePlan,
        recharge: applied.recharge,
        message: 'Recharge confirmée et crédits ajoutés.'
      });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.post('/api/credits/deduct', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    try {
      const db = readCreditsDb();
      const { serviceType = 'chat', label, idempotencyKey } = req.body || {};
      // A user-facing debit endpoint can only ever debit the authenticated account.
      // Administrative adjustments must use a dedicated, permission-checked workflow.
      const userId = authCtx.token.uid;
      const normalizedIdempotencyKey = typeof idempotencyKey === 'string'
        ? idempotencyKey.trim().slice(0, 128)
        : '';
      if (idempotencyKey && !normalizedIdempotencyKey) {
        res.status(400).json({ success: false, error: 'INVALID_IDEMPOTENCY_KEY' });
        return;
      }
      const svc = db.config.pricing[serviceType as 'chat' | 'image' | 'video'];
      if (!svc) {
        res.status(400).json({ success: false, message: 'Type de service IA invalide.' });
        return;
      }
      // Idempotency keys are scoped to the authenticated user. A key used by
      // another account must never reveal that account's usage record.
      const existingUsage = normalizedIdempotencyKey
        ? db.usages.find((u) => u.userId === userId && u.idempotencyKey === normalizedIdempotencyKey)
        : undefined;
      if (existingUsage) {
        const balance = db.accounts[userId]?.balance ?? 0;
        res.json({ success: true, isDuplicate: true, newBalance: balance, usage: existingUsage });
        return;
      }
      const current = db.accounts[userId]?.balance ?? 0;
      if (current < svc.credits) {
        res.status(402).json({
          success: false,
          message: `Solde insuffisant (${current}/${svc.credits} crédits requis).`
        });
        return;
      }
      const newBalance = current - svc.credits;
      db.accounts[userId] = {
        ...(db.accounts[userId] || {}),
        balance: newBalance,
        updatedAt: new Date().toISOString()
      };
      const amountChargedFcfa = svc.credits * (db.config.creditValueFcfa || 10);
      const usage = {
        id: `usg-${crypto.randomUUID()}`,
        idempotencyKey: normalizedIdempotencyKey || undefined,
        userId,
        serviceType: serviceType as 'chat' | 'image' | 'video',
        model: svc.model,
        credits: svc.credits,
        amountChargedFcfa,
        apiCostFcfa: svc.apiCostFcfa,
        isEstimate: svc.isEstimate,
        costSource: svc.costSource,
        grossProfitFcfa: Math.round((amountChargedFcfa - svc.apiCostFcfa) * 100) / 100,
        status: 'success' as const,
        label: label ? String(label) : svc.name,
        createdAt: new Date().toISOString()
      };
      db.usages.unshift(usage);
      if (normalizedIdempotencyKey) {
        db.processedKeys[`${userId}:${normalizedIdempotencyKey}`] = usage.id;
      }
      writeCreditsDb(db);
      runCreditsPgSync('deduct', async () => {
        await syncPgAiCreditAccount({ userId, balanceCredits: newBalance });
        await recordPgAiCreditTransaction({
          id: usage.id,
          userId,
          txType: 'deduct',
          creditsDelta: -usage.credits,
          amountFcfa: usage.amountChargedFcfa,
          status: 'success',
          idempotencyKey: usage.idempotencyKey || usage.id,
          metadata: { serviceType: usage.serviceType, label: usage.label }
        });
      });
      res.json({ success: true, newBalance, usage });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.post('/api/credits/refund', requireSecurityPermission('manageFinanceProtection'), (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    if (authCtx.token.spaceRole !== 'admin') {
      res.status(403).json({ success: false, message: 'Accès administrateur requis.' });
      return;
    }
    try {
      const db = readCreditsDb();
      const { usageId, reason = 'Remboursement manuel administrateur' } = req.body || {};
      const usage = db.usages.find((u) => u.id === usageId);
      if (!usage) {
        res.status(404).json({ success: false, message: 'Usage introuvable.' });
        return;
      }
      if (usage.status === 'refunded') {
        const balance = db.accounts[usage.userId]?.balance ?? 0;
        res.status(409).json({
          success: false,
          error: 'ALREADY_REFUNDED',
          newBalance: balance,
          message: 'Usage déjà remboursé.'
        });
        return;
      }
      usage.status = 'refunded';
      usage.apiCostFcfa = 0;
      usage.grossProfitFcfa = 0;
      const prev = db.accounts[usage.userId]?.balance ?? 0;
      const newBalance = prev + usage.credits;
      db.accounts[usage.userId] = {
        ...(db.accounts[usage.userId] || {}),
        balance: newBalance,
        updatedAt: new Date().toISOString()
      };
      const refundRec = {
        id: `ref-${crypto.randomUUID()}`,
        originalUsageId: usage.id,
        userId: usage.userId,
        credits: usage.credits,
        amountFcfa: usage.amountChargedFcfa,
        reason: String(reason),
        createdAt: new Date().toISOString()
      };
      db.refunds.unshift(refundRec);
      writeCreditsDb(db);
      runCreditsPgSync('refund', async () => {
        await syncPgAiCreditAccount({ userId: usage.userId, balanceCredits: newBalance });
        await recordPgAiCreditTransaction({
          id: refundRec.id,
          userId: usage.userId,
          txType: 'refund',
          creditsDelta: usage.credits,
          amountFcfa: usage.amountChargedFcfa,
          status: 'refunded',
          idempotencyKey: `credit-refund:${usage.id}`,
          metadata: { originalUsageId: usage.id, reason: refundRec.reason }
        });
      });
      res.json({ success: true, newBalance, message: 'Remboursement effectué avec succès.' });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.get('/api/credits/admin/stats', requireSecurityPermission('manageFinanceProtection'), (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    if (authCtx.token.spaceRole !== 'admin') {
      res.status(403).json({ success: false, message: 'Accès administrateur requis.' });
      return;
    }
    try {
      const db = readCreditsDb();
      const confirmedRecharges = db.recharges.filter((r) => r.status === 'confirmed');
      const totalRechargesFcfa = confirmedRecharges.reduce((s, r) => s + r.amountFcfa, 0);
      const totalCreditsGranted = confirmedRecharges.reduce((s, r) => s + r.credits, 0);
      const totalPaymentFeesFcfa = confirmedRecharges.reduce((s, r) => s + r.paymentFeeFcfa, 0);

      const successfulUsages = db.usages.filter((u) => u.status === 'success');
      const totalCreditsConsumed = successfulUsages.reduce((s, u) => s + u.credits, 0);
      const totalConsumedRevenueFcfa = successfulUsages.reduce((s, u) => s + u.amountChargedFcfa, 0);
      const totalRealApiCostFcfa = successfulUsages.reduce((s, u) => s + u.apiCostFcfa, 0);
      const totalGrossProfitFcfa = successfulUsages.reduce((s, u) => s + u.grossProfitFcfa, 0);

      const totalRefundsFcfa = db.refunds.reduce((s, r) => s + r.amountFcfa, 0);
      const totalCreditsRefunded = db.refunds.reduce((s, r) => s + r.credits, 0);
      const netProfitFcfa = totalGrossProfitFcfa - totalPaymentFeesFcfa;
      const grossMarginPercent =
        totalConsumedRevenueFcfa > 0
          ? Math.round((totalGrossProfitFcfa / totalConsumedRevenueFcfa) * 1000) / 10
          : 0;

      const calcBreakdown = (type: 'chat' | 'image' | 'video') => {
        const list = successfulUsages.filter((u) => u.serviceType === type);
        return {
          usagesCount: list.length,
          credits: list.reduce((s, u) => s + u.credits, 0),
          revenueFcfa: list.reduce((s, u) => s + u.amountChargedFcfa, 0),
          apiCostFcfa: list.reduce((s, u) => s + u.apiCostFcfa, 0),
          grossProfitFcfa: list.reduce((s, u) => s + u.grossProfitFcfa, 0)
        };
      };

      res.json({
        financials: {
          totalRechargesFcfa,
          totalRechargesCount: confirmedRecharges.length,
          totalCreditsGranted,
          totalPaymentFeesFcfa,
          totalCreditsConsumed,
          totalConsumedRevenueFcfa,
          totalRealApiCostFcfa,
          totalGrossProfitFcfa,
          grossMarginPercent,
          totalRefundsCount: db.refunds.length,
          totalRefundsFcfa,
          totalCreditsRefunded,
          netProfitFcfa
        },
        breakdown: {
          chat: calcBreakdown('chat'),
          image: calcBreakdown('image'),
          video: calcBreakdown('video')
        },
        config: db.config,
        recentUsages: db.usages.slice(0, 50),
        recentRecharges: db.recharges.slice(0, 50),
        recentRefunds: db.refunds.slice(0, 50)
      });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.get('/api/ai/status', async (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    try {
      const db = readCreditsDb();
      const rodiumCfg = getRodiumAiConfig();
      const gpCfg = getGeniusPayConfig();
      const mapsCfg = getGoogleMapsConfig();
      const r2Cfg = getR2StorageConfig();
      const fcmCfg = getFcmConfig();
      const supabaseStatus = await probeSupabaseHealth();
      res.json({
        success: true,
        providers: {
          rodiumAi: {
            configured: rodiumCfg.configured,
            envVar: 'RODIUMAI_API_KEY',
            authorizedModels: Object.values(RODIUM_AUTHORIZED_MODELS)
          },
          googleMaps: {
            configured: mapsCfg.configured,
            envVar: mapsCfg.envVar
          },
          cloudflareR2: {
            configured: r2Cfg.configured,
            envVar: 'R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_BUCKET'
          },
          fcm: {
            configured: fcmCfg.configured,
            envVar: fcmCfg.envVar
          },
          geniusPay: {
            configured: gpCfg.configured,
            envVar: 'GENIUSPAY_API_KEY'
          },
          supabase: supabaseStatus
        },
        usagesCount: db.usages.length
      });
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  app.get('/api/ai/capabilities', (_req: Request, res: Response) => {
    const rodiumCfg = getRodiumAiConfig();
    res.json({
      success: true,
      provider: 'RodiumAI',
      models: Object.values(RODIUM_AUTHORIZED_MODELS),
      capabilities: {
        rodiumAi: rodiumCfg.configured,
        chat: rodiumCfg.configured,
        image: rodiumCfg.configured,
        video: rodiumCfg.configured
      }
    });
  });

  app.post('/api/ai/chat', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const hasBearerHeader = typeof authHeader === 'string' && authHeader.trim().toLowerCase().startsWith('bearer ');
    let isGuestRequest = !hasBearerHeader;
    let guestId = '';
    const clientIp = getClientIp(req);

    if (hasBearerHeader) {
      const authCtx = authenticateSessionRequest(req, res);
      if (!authCtx) return;
      isGuestRequest = false;
    } else {
      guestId = typeof req.headers['x-guest-id'] === 'string' ? req.headers['x-guest-id'].trim() : '';
      const quotaStatus = checkGuestAiQuota(guestId, clientIp);
      if (!quotaStatus.allowed) {
        res.status(429).json({
          success: false,
          error: 'GUEST_AI_QUOTA_REACHED',
          message: VISITOR_AI_EXHAUSTED_MESSAGE,
          quota: quotaStatus
        });
        return;
      }
    }

    const prompt = String(req.body?.prompt || '').trim();
    const systemInstruction = req.body?.systemInstruction ? String(req.body.systemInstruction) : undefined;
    const requestedModel = req.body?.model ? String(req.body.model) : undefined;
    const images: string[] = Array.isArray(req.body?.images)
      ? req.body.images.filter((s: unknown) => typeof s === 'string').slice(0, 3)
      : [];
    if (!prompt && images.length === 0) {
      res.status(400).json({ success: false, error: 'PROMPT_REQUIRED', message: 'Prompt ou image requis.' });
      return;
    }

    const promptWordCount = countWords(prompt);
    if (promptWordCount > GPT_CLIENT_MAX_WORDS) {
      res.status(400).json({
        success: false,
        error: 'PROMPT_WORD_LIMIT_EXCEEDED',
        wordCount: promptWordCount,
        maxWords: GPT_CLIENT_MAX_WORDS,
        message: `Message trop long : ${promptWordCount} mots utilisés sur un maximum autorisé de ${GPT_CLIENT_MAX_WORDS} mots.`
      });
      return;
    }

    const result = await callRodiumChat({
      prompt,
      systemInstruction,
      images,
      model: requestedModel,
      enforceWordLimit: true
    });
    if (!result.configured) {
      res.status(503).json({
        success: false,
        error: 'RODIUMAI_NOT_CONFIGURED',
        message: result.message
      });
      return;
    }
    if (!result.ok) {
      res.status(502).json({
        success: false,
        error: result.error || 'RODIUMAI_CALL_FAILED',
        message: result.message || 'Erreur lors de la requête RodiumAI.'
      });
      return;
    }

    const updatedGuestQuota = isGuestRequest ? incrementGuestAiQuota(guestId, clientIp) : undefined;
    res.json({
      success: true,
      text: result.text,
      wordCount: result.wordCount,
      maxWords: result.maxWords,
      model: result.model,
      ...(updatedGuestQuota ? { guestQuota: updatedGuestQuota } : {})
    });
  });

  const resolveLocalAssetToDataUrl = (rawImg: string): string => {
    const clean = String(rawImg || '').trim();
    if (!clean || clean.startsWith('data:image/') || /^https?:\/\//i.test(clean)) {
      return clean;
    }
    const cleanPath = clean.split('?')[0].replace(/^\/+/, '');
    const candidateDirs = [
      path.resolve(__dirname, 'src', 'assets'),
      path.resolve(__dirname, 'dist', 'assets'),
      path.resolve(__dirname, 'public', 'assets')
    ];
    for (const baseDir of candidateDirs) {
      const candidate = path.resolve(__dirname, cleanPath);
      if (candidate.startsWith(baseDir + path.sep) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        const ext = path.extname(candidate).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        return `data:${mime};base64,${fs.readFileSync(candidate).toString('base64')}`;
      }
    }
    return clean;
  };

  app.post('/api/ai/try-on', async (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const {
      userPhoto,
      productImage,
      productName = 'Article DJASSA',
      productCategory = 'Mode',
      modelName,
      modelGender,
      morphology,
      morphologyDetail,
      size,
      color,
      viewAngle,
      drapeFitNotes,
      idempotencyKey
    } = req.body || {};
    if (!userPhoto || !productImage) {
      res.status(400).json({ success: false, error: 'IMAGES_REQUIRED', message: 'Photo client et image produit requises.' });
      return;
    }
    const rodiumCfg = getRodiumAiConfig();
    if (!rodiumCfg.configured) {
      res.status(503).json({
        success: false,
        error: 'RODIUMAI_NOT_CONFIGURED',
        message: 'Essayage IA RodiumAI (Qwen Image 2.1 Turbo) indisponible : clé RODIUMAI_API_KEY absente côté serveur.'
      });
      return;
    }
    const db = readCreditsDb();
    const userId = authCtx.token.uid;
    const svc = db.config.pricing.image;
    const currentBalance = db.accounts[userId]?.balance ?? 0;
    if (currentBalance < svc.credits) {
      res.status(402).json({
        success: false,
        error: 'INSUFFICIENT_CREDITS',
        message: `Solde insuffisant (${currentBalance}/${svc.credits} crédits requis).`
      });
      return;
    }

    const genRes = await callRodiumImageGeneration({
      userPhoto: resolveLocalAssetToDataUrl(String(userPhoto)),
      productImage: resolveLocalAssetToDataUrl(String(productImage)),
      productName: String(productName),
      productCategory: String(productCategory),
      ...(modelName ? { modelName: String(modelName) } : {}),
      ...(modelGender === 'female' || modelGender === 'male' ? { modelGender } : {}),
      ...(morphology ? { morphology: String(morphology) } : {}),
      ...(morphologyDetail ? { morphologyDetail: String(morphologyDetail) } : {}),
      ...(size ? { size: String(size) } : {}),
      ...(color ? { color: String(color) } : {}),
      ...(viewAngle ? { viewAngle: String(viewAngle) } : {}),
      ...(drapeFitNotes ? { drapeFitNotes: String(drapeFitNotes) } : {})
    });

    if (!genRes.ok || !genRes.imageDataUrl) {
      res.status(502).json({
        success: false,
        error: genRes.error || 'TRY_ON_PROVIDER_ERROR',
        message: genRes.message || 'Erreur lors de la génération image RodiumAI (Qwen Image 2.1 Turbo).'
      });
      return;
    }

    const latestDb = readCreditsDb();
    const latestBalance = latestDb.accounts[userId]?.balance ?? 0;
    if (latestBalance < svc.credits) {
      res.status(402).json({
        success: false,
        error: 'INSUFFICIENT_CREDITS',
        message: `Solde insuffisant (${latestBalance}/${svc.credits} crédits requis).`
      });
      return;
    }
    const nextBalance = latestBalance - svc.credits;
    latestDb.accounts[userId] = {
      ...(latestDb.accounts[userId] || {}),
      balance: nextBalance,
      updatedAt: new Date().toISOString()
    };
    const amountChargedFcfa = svc.credits * (latestDb.config.creditValueFcfa || 10);
    latestDb.usages.unshift({
      id: `usg-${crypto.randomUUID()}`,
      idempotencyKey: idempotencyKey ? String(idempotencyKey) : undefined,
      userId,
      serviceType: 'image',
      model: 'qwen-image-2.1-turbo',
      credits: svc.credits,
      amountChargedFcfa,
      apiCostFcfa: svc.apiCostFcfa,
      isEstimate: svc.isEstimate,
      costSource: svc.costSource,
      grossProfitFcfa: Math.round((amountChargedFcfa - svc.apiCostFcfa) * 100) / 100,
      status: 'success',
      label: `Essayage IA : ${String(productName).slice(0, 50)}${morphology ? ` (${String(morphology)})` : ''}`,
      createdAt: new Date().toISOString()
    });
    writeCreditsDb(latestDb);

    res.json({
      success: true,
      model: genRes.model,
      imageDataUrl: genRes.imageDataUrl,
      newBalance: nextBalance
    });
  });

  app.post('/api/ai/video', async (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const { prompt, mode = 'text', sourceImage } = req.body || {};
    if (!prompt && !sourceImage) {
      res.status(400).json({ success: false, error: 'PROMPT_REQUIRED', message: 'Description ou image source requise.' });
      return;
    }
    const videoRes = await callRodiumVideoGeneration({
      prompt: prompt ? String(prompt) : undefined,
      mode: mode === 'image' ? 'image' : 'text',
      sourceImage: sourceImage ? String(sourceImage) : undefined
    });
    if (!videoRes.configured) {
      res.status(503).json({
        success: false,
        error: 'RODIUMAI_NOT_CONFIGURED',
        message: videoRes.message
      });
      return;
    }
    if (!videoRes.ok) {
      res.status(502).json({
        success: false,
        error: videoRes.error || 'RODIUMAI_VIDEO_ERROR',
        message: videoRes.message
      });
      return;
    }
    res.json({
      success: true,
      taskId: videoRes.taskId,
      videoUrl: videoRes.videoUrl,
      raw: videoRes.raw
    });
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      ok: true,
      service: 'djassa-api',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/api/health/database', async (_req: Request, res: Response) => {
    const health = await databaseHealth();
    if (!health.configured || !health.connected) {
      res.status(503).json({
        success: false,
        configured: health.configured,
        connected: health.connected,
        error: health.configured ? 'DATABASE_UNREACHABLE' : 'DATABASE_NOT_CONFIGURED'
      });
      return;
    }
    res.json({
      success: true,
      configured: true,
      connected: true
    });
  });

  const RAW_COLLECTIONS_DB_PATH = path.join(__dirname, 'server', 'data', 'db.json');
  const ALLOWED_RAW_COLLECTIONS = new Set(['users', 'sellers', 'stores', 'products', 'orders']);

  const readRawCollectionsDb = (): Record<string, Array<Record<string, unknown>>> => {
    try {
      const raw = fs.readFileSync(RAW_COLLECTIONS_DB_PATH, 'utf8');
      return JSON.parse(raw) as Record<string, Array<Record<string, unknown>>>;
    } catch {
      return { sellers: [], stores: [], products: [], orders: [] };
    }
  };

  const writeRawCollectionsDb = (data: Record<string, Array<Record<string, unknown>>>) => {
    if (!atomicWriteJsonFile(RAW_COLLECTIONS_DB_PATH, data, { context: 'RawCollectionsDb' })) {
      throw new Error('FAILED_TO_PERSIST_RAW_COLLECTIONS_DB');
    }
  };

  app.all('/api/:collection/:id?', (req: Request, res: Response, next) => {
    const collection = String(req.params.collection || '').trim();
    if (!ALLOWED_RAW_COLLECTIONS.has(collection)) {
      return next();
    }
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    if (authCtx.token.spaceRole !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'ADMIN_ONLY_COLLECTION',
        message: 'Accès brut aux collections réservé aux administrateurs.'
      });
      return;
    }

    const id = req.params.id ? String(req.params.id).trim() : '';
    if (collection === 'users') {
      const users = listAuthUsersPublic();
      if (req.method === 'GET') {
        res.json(id ? users.find((u) => u.id === id) || null : users);
        return;
      }
      res.status(405).json({ success: false, error: 'METHOD_NOT_ALLOWED' });
      return;
    }

    const rawDb = readRawCollectionsDb();
    const list = Array.isArray(rawDb[collection]) ? rawDb[collection] : [];
    if (req.method === 'GET') {
      res.json(id ? list.find((item) => String(item.id || '') === id) || null : list);
      return;
    }
    if (req.method === 'POST') {
      const created = { id: `${collection.slice(0, 3)}-${crypto.randomUUID().slice(0, 8)}`, ...(req.body || {}) };
      list.push(created);
      rawDb[collection] = list;
      writeRawCollectionsDb(rawDb);
      res.status(201).json(created);
      return;
    }
    if (req.method === 'PATCH' && id) {
      const idx = list.findIndex((item) => String(item.id || '') === id);
      if (idx < 0) {
        res.status(404).json({ success: false, error: 'NOT_FOUND' });
        return;
      }
      list[idx] = { ...list[idx], ...(req.body || {}) };
      rawDb[collection] = list;
      writeRawCollectionsDb(rawDb);
      res.json(list[idx]);
      return;
    }
    if (req.method === 'DELETE' && id) {
      rawDb[collection] = list.filter((item) => String(item.id || '') !== id);
      writeRawCollectionsDb(rawDb);
      res.status(204).end();
      return;
    }
    res.status(405).json({ success: false, error: 'METHOD_NOT_ALLOWED' });
  });

  app.get('/api/events', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    const keepAlive = setInterval(() => {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    }, 25000);
    req.on('close', () => {
      clearInterval(keepAlive);
    });
  });
}

function setupWebSockets(httpServer: http.Server) {
  const adminWss = new WebSocketServer({ noServer: true });
  const liveStreamWss = new WebSocketServer({ noServer: true });
  const liveVoiceWss = new WebSocketServer({ noServer: true });

  const adminClients = new Set<WebSocket>();
  registerAdminNotificationStreamHub({
    broadcast: (payload) => {
      const serialized = JSON.stringify(payload);
      for (const client of adminClients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(serialized);
        }
      }
    },
    getConnectionCount: () => adminClients.size
  });

  adminWss.on('connection', (ws) => {
    adminClients.add(ws);
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg?.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', at: new Date().toISOString() }));
        }
      } catch {
        // ignore malformed frames
      }
    });
    ws.on('close', () => {
      adminClients.delete(ws);
    });
  });

  const liveStreamClients = new Set<WebSocket>();
  let liveLikeCount = 0;
  let livePinnedProduct: unknown = null;
  const liveMessages: Array<{ id: string; user: string; text: string; badge?: string; time?: string }> = [];

  liveStreamWss.on('connection', (ws, request) => {
    const wsAuth = (request as http.IncomingMessage & { wsUser?: { uid: string; name: string; spaceRole: string } }).wsUser;
    liveStreamClients.add(ws);
    const broadcast = (payload: Record<string, unknown>, exclude?: WebSocket) => {
      const data = JSON.stringify(payload);
      for (const c of liveStreamClients) {
        if (c !== exclude && c.readyState === WebSocket.OPEN) {
          c.send(data);
        }
      }
    };
    ws.send(
      JSON.stringify({
        type: 'init',
        viewerCount: liveStreamClients.size,
        likeCount: liveLikeCount,
        messages: liveMessages.slice(-40),
        pinnedProduct: livePinnedProduct
      })
    );
    broadcast({ type: 'viewer_count', viewerCount: liveStreamClients.size });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'chat') {
          if (!wsAuth) {
            ws.send(JSON.stringify({ type: 'error', error: 'UNAUTHORIZED', message: 'Connexion requise pour commenter.' }));
            return;
          }
          const textContent = String(msg.text || msg.message?.text || msg.message || '').trim();
          if (!textContent) return;
          const normalized =
            msg.message && typeof msg.message === 'object'
              ? msg.message
              : {
                  id: `lc-${crypto.randomUUID().slice(0, 8)}`,
                  user: String(wsAuth.name || msg.user || 'Client DJASSA').slice(0, 60),
                  text: textContent.slice(0, 400),
                  ...(msg.badge ? { badge: String(msg.badge) } : {}),
                  time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                };
          liveMessages.push(normalized);
          if (liveMessages.length > 60) liveMessages.shift();
          broadcast({ type: 'chat', message: normalized });
        } else if (msg.type === 'like') {
          liveLikeCount += 1;
          broadcast({ type: 'like', likeCount: liveLikeCount });
        } else if (msg.type === 'gift') {
          if (!wsAuth) {
            ws.send(JSON.stringify({ type: 'error', error: 'UNAUTHORIZED', message: 'Connexion requise pour envoyer un cadeau.' }));
            return;
          }
          liveLikeCount += 5;
          const giftMsg = msg.message || {
            id: `lg-${crypto.randomUUID().slice(0, 8)}`,
            user: String(wsAuth.name || msg.user || 'Client DJASSA'),
            text: `a envoyé ${msg.giftEmoji || '🎁'} ${msg.giftName || 'Cadeau'}`,
            badge: 'Cadeau'
          };
          liveMessages.push(giftMsg);
          if (liveMessages.length > 60) liveMessages.shift();
          broadcast({ type: 'gift', message: giftMsg, likeCount: liveLikeCount });
        } else if (msg.type === 'pin_product') {
          if (!wsAuth) {
            ws.send(JSON.stringify({ type: 'error', error: 'UNAUTHORIZED', message: 'Authentification requise.' }));
            return;
          }
          if (wsAuth.spaceRole !== 'seller' && wsAuth.spaceRole !== 'admin') {
            ws.send(JSON.stringify({ type: 'error', error: 'FORBIDDEN', message: 'Réservé aux vendeurs et administrateurs.' }));
            return;
          }
          livePinnedProduct = msg.product;
          broadcast({ type: 'pin_product', product: msg.product });
        } else if (msg.type === 'video_chunk' && msg.chunk) {
          if (!wsAuth) {
            ws.send(JSON.stringify({ type: 'error', error: 'UNAUTHORIZED', message: 'Authentification requise.' }));
            return;
          }
          if (wsAuth.spaceRole !== 'seller' && wsAuth.spaceRole !== 'admin') {
            ws.send(JSON.stringify({ type: 'error', error: 'FORBIDDEN', message: 'Réservé aux vendeurs et administrateurs.' }));
            return;
          }
          broadcast({ type: 'video_chunk', chunk: msg.chunk }, ws);
        }
      } catch {
        // ignore invalid live stream payload
      }
    });

    ws.on('close', () => {
      liveStreamClients.delete(ws);
      broadcast({ type: 'viewer_count', viewerCount: liveStreamClients.size });
    });
  });

  liveVoiceWss.on('connection', (ws) => {
    const rodiumCfg = getRodiumAiConfig();
    if (!rodiumCfg.configured) {
      ws.send(
        JSON.stringify({
          type: 'error',
          error: 'Assistant vocal indisponible : clé RodiumAI non configurée côté serveur.'
        })
      );
      ws.close(1008, 'RODIUMAI_NOT_CONFIGURED');
      return;
    }
    ws.send(JSON.stringify({ type: 'ready' }));
    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        const userText = String(msg?.text || msg?.prompt || '').trim();
        if (!userText) return;
        const terms = userText.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
        const matchedProducts = commerceDb.products
          .filter((p) => p.status === 'published')
          .filter((p) => {
            const haystack = `${p.name} ${p.category} ${p.description} ${p.sellerName}`.toLowerCase();
            return terms.length === 0 || terms.some((t) => haystack.includes(t));
          })
          .slice(0, 4);

        const catalogContext = matchedProducts
          .map((p) => `- ${p.name} (${p.price} FCFA, stock: ${p.stock}, boutique: ${p.sellerName})`)
          .join('\n');

        const aiResult = await callRodiumChat({
          model: 'minimax-h3-max-turbo',
          enforceWordLimit: false,
          prompt: `Demande client : ${userText}\n\nProduits trouvés dans le catalogue DJASSA :\n${catalogContext || 'Aucun produit exact trouvé.'}`,
          systemInstruction:
            "Tu es l'assistant vocal shopping DJASSA en Côte d'Ivoire. Réponds brièvement en français clair et utile en te basant uniquement sur les produits fournis."
        });
        if (!aiResult.ok) {
          ws.send(JSON.stringify({ type: 'error', error: aiResult.message || 'Erreur assistant vocal.' }));
          return;
        }
        ws.send(
          JSON.stringify({
            type: 'ai_response',
            text: aiResult.text ?? '',
            products: matchedProducts
          })
        );
      } catch (err) {
        ws.send(
          JSON.stringify({
            type: 'error',
            error: (err as Error).message || 'Erreur assistant vocal.'
          })
        );
      }
    });
  });

  httpServer.on('upgrade', (request, socket, head) => {
    const rawUrl = request.url || '/';
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl, 'http://localhost');
    } catch {
      return;
    }
    const pathname = parsedUrl.pathname;

    if (pathname === '/api/admin/notifications/stream') {
      const auth = authenticateAdminWebSocket(rawUrl, request.headers);
      if (!auth.ok) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      adminWss.handleUpgrade(request, socket, head, (ws) => {
        adminWss.emit('connection', ws, request);
      });
      return;
    }

    if (pathname === '/api/live-stream') {
      const ticket = parsedUrl.searchParams.get('ticket');
      const queryToken = parsedUrl.searchParams.get('token');
      const authHeader = typeof request.headers['authorization'] === 'string' ? request.headers['authorization'] : '';
      const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      const rawToken = (queryToken || bearer || '').trim();

      if (ticket) {
        const verified = consumeWsTicket(ticket);
        if (!verified.ok) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        (request as http.IncomingMessage & { wsUser?: { uid: string; name: string; spaceRole: string } }).wsUser = {
          uid: verified.uid,
          name: verified.name,
          spaceRole: verified.spaceRole
        };
      } else if (rawToken) {
        const verifiedToken = verifySignedToken(rawToken);
        if (!verifiedToken) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        (request as http.IncomingMessage & { wsUser?: { uid: string; name: string; spaceRole: string } }).wsUser = {
          uid: verifiedToken.uid,
          name: verifiedToken.name,
          spaceRole: verifiedToken.spaceRole
        };
      }
      liveStreamWss.handleUpgrade(request, socket, head, (ws) => {
        liveStreamWss.emit('connection', ws, request);
      });
      return;
    }

    if (pathname === '/api/live-voice') {
      const ticket = parsedUrl.searchParams.get('ticket');
      const queryToken = parsedUrl.searchParams.get('token');
      const authHeader = typeof request.headers['authorization'] === 'string' ? request.headers['authorization'] : '';
      const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      const rawToken = (queryToken || bearer || '').trim();

      if (ticket) {
        const verified = consumeWsTicket(ticket);
        if (!verified.ok) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
      } else if (rawToken) {
        const verifiedToken = verifySignedToken(rawToken);
        if (!verifiedToken) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
      } else {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      liveVoiceWss.handleUpgrade(request, socket, head, (ws) => {
        liveVoiceWss.emit('connection', ws, request);
      });
    }
  });
}

export async function createApp(options?: { attachVite?: boolean }) {
  const app = express();
  const httpServer = http.createServer(app);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self)');
    next();
  });

  // Zero-dependency Gzip compression for JSON/HTML/JS/CSS responses >= 1 KB (skips SSE, WebSockets, images/videos)
  app.use((req: Request, res: Response, next) => {
    const acceptEncoding = String(req.headers['accept-encoding'] || '').toLowerCase();
    if (
      req.method === 'HEAD' ||
      req.headers.upgrade ||
      req.path.startsWith('/api/events') ||
      !acceptEncoding.includes('gzip')
    ) {
      return next();
    }

    res.vary('Accept-Encoding');

    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);
    const origWriteHead = res.writeHead.bind(res);

    let decided = false;
    let gzip: zlib.Gzip | null = null;
    let ended = false;

    const isCompressibleType = (contentType: string): boolean => {
      const ct = contentType.toLowerCase();
      if (!ct || ct.includes('text/event-stream')) return false;
      return (
        ct.includes('application/json') ||
        ct.includes('text/html') ||
        ct.includes('text/css') ||
        ct.includes('text/plain') ||
        ct.includes('javascript') ||
        ct.includes('image/svg+xml') ||
        ct.includes('application/manifest+json')
      );
    };

    const decide = (initialChunkBytes?: number) => {
      if (decided) return;
      decided = true;

      if (
        res.headersSent ||
        res.statusCode === 204 ||
        res.statusCode === 304 ||
        res.getHeader('Content-Encoding') ||
        String(res.getHeader('Cache-Control') || '').includes('no-transform')
      ) {
        return;
      }

      const ct = String(res.getHeader('Content-Type') || '');
      if (!isCompressibleType(ct)) return;

      const contentLength = Number(res.getHeader('Content-Length') || 0);
      const estimatedLength = contentLength || initialChunkBytes || 0;
      if (estimatedLength > 0 && estimatedLength < 1024) {
        return;
      }

      res.removeHeader('Content-Length');
      res.setHeader('Content-Encoding', 'gzip');

      gzip = zlib.createGzip({ level: zlib.constants.Z_BEST_SPEED });
      gzip.on('data', (chunk: Buffer) => {
        origWrite(chunk);
      });
      gzip.on('end', () => {
        if (!ended) {
          ended = true;
          origEnd();
        }
      });
      gzip.on('error', () => {
        if (!ended) {
          ended = true;
          origEnd();
        }
      });
    };

    res.on('close', () => {
      if (gzip) {
        try {
          gzip.destroy();
        } catch {
          // ignore stream cleanup errors
        }
      }
    });

    (res as any).writeHead = function patchedWriteHead(statusCode: number, ...rest: any[]) {
      res.statusCode = statusCode;
      if (typeof rest[0] === 'object' && rest[0] !== null) {
        for (const [k, v] of Object.entries(rest[0])) {
          if (v !== undefined) res.setHeader(k, v as any);
        }
      } else if (typeof rest[1] === 'object' && rest[1] !== null) {
        for (const [k, v] of Object.entries(rest[1])) {
          if (v !== undefined) res.setHeader(k, v as any);
        }
      }
      decide(undefined);
      if (gzip) {
        res.removeHeader('Content-Length');
        return origWriteHead(statusCode);
      }
      return (origWriteHead as any)(statusCode, ...rest);
    };

    (res as any).write = function patchedWrite(chunk: any, encoding?: any, cb?: any) {
      if (typeof encoding === 'function') {
        cb = encoding;
        encoding = undefined;
      }
      const byteLen =
        chunk === undefined || chunk === null
          ? 0
          : Buffer.isBuffer(chunk)
          ? chunk.length
          : Buffer.byteLength(String(chunk), typeof encoding === 'string' ? (encoding as BufferEncoding) : 'utf8');
      decide(byteLen || undefined);
      if (gzip) {
        return gzip.write(chunk, encoding, cb);
      }
      return origWrite(chunk, encoding, cb);
    };

    (res as any).end = function patchedEnd(chunk?: any, encoding?: any, cb?: any) {
      if (typeof chunk === 'function') {
        cb = chunk;
        chunk = undefined;
        encoding = undefined;
      } else if (typeof encoding === 'function') {
        cb = encoding;
        encoding = undefined;
      }

      const byteLen =
        chunk === undefined || chunk === null
          ? 0
          : Buffer.isBuffer(chunk)
          ? chunk.length
          : Buffer.byteLength(String(chunk), typeof encoding === 'string' ? (encoding as BufferEncoding) : 'utf8');

      decide(byteLen);
      if (gzip) {
        if (typeof cb === 'function') {
          gzip.once('end', cb);
        }
        gzip.end(chunk, encoding);
        return res;
      }
      return origEnd(chunk, encoding, cb);
    };

    next();
  });

  app.use('/api', (req: Request, res: Response, next) => {
    const contentLen = Number(req.header('content-length') || 0);
    const sensitivePath =
      req.path.startsWith('/auth/') ||
      req.path.startsWith('/commerce/withdrawals') ||
      req.path.startsWith('/commerce/payments');
    if (sensitivePath && Number.isFinite(contentLen) && contentLen > 262_144) {
      res.status(413).json({
        success: false,
        error: 'PAYLOAD_TOO_LARGE',
        message: 'Charge JSON trop volumineuse pour cette route sensible (max 256 Ko).'
      });
      return;
    }
    next();
  });

  app.use(
    express.json({
      limit: '25mb',
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      }
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  app.use('/api', (req: Request, res: Response, next) => {
    const origin = req.header('origin');
    if (origin) {
      const reqHost = req.header('host') || '';
      let isAllowed = false;
      try {
        const parsed = new URL(origin);
        const envOrigins = (
          process.env.ALLOWED_ORIGINS ||
          process.env.ALLOWED_CORS_ORIGINS ||
          process.env.DJASSA_ALLOWED_ORIGINS ||
          ''
        )
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean);
        isAllowed =
          parsed.host === reqHost ||
          parsed.hostname === 'localhost' ||
          parsed.hostname === '127.0.0.1' ||
          envOrigins.includes(origin);
      } catch {
        isAllowed = false;
      }
      if (!isAllowed) {
        if (req.method === 'OPTIONS') {
          res.status(403).json({
            success: false,
            error: 'CORS_ORIGIN_FORBIDDEN',
            message: 'Origine CORS non autorisée.'
          });
          return;
        }
        next();
        return;
      }
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Idempotency-Key, X-Djassa-Webhook-Signature, X-GeniusPay-Signature'
      );
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    }
    next();
  });

  installSecurityMiddleware(app);

  // PostgreSQL auth is opt-in until the production database/import is verified.
  installPostgresAuthRoutes(app);
  installAuthRoutes(app);
  installClientRoutes(app);
  installSecurityRoutes(app);
  installCommerceRoutes(app);
  installAdminControlPlaneRoutes(app);
  installDisputesRoutes(app);
  installFraudRoutes(app);
  installRefundsRoutes(app);
  installPrivacyRoutes(app);
  installBackupRoutes(app);
  installMaintenanceRoutes(app);
  installSystemSurveillanceRoutes(app);
  installTeamRoutes(app);
  installGoogleMapsRoutes(app);

  registerCreditsAndAiRoutes(app);
  setupWebSockets(httpServer);

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'API_NOT_FOUND',
      message: 'Route API introuvable.'
    });
  });

  const attachVite = options?.attachVite ?? (process.env.NODE_ENV !== 'test' && !process.env.VITEST);
  if (attachVite) {
    const isProd = process.env.NODE_ENV === 'production';
    if (!isProd) {
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: false
        },
        appType: 'spa'
      });
      app.use(vite.middlewares);
    } else {
      const distDir = path.join(__dirname, 'dist');
      app.use(
        express.static(distDir, {
          setHeaders: (res, filePath) => {
            if (filePath.includes(`${path.sep}assets${path.sep}`)) {
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            } else if (
              filePath.endsWith('.html') ||
              filePath.endsWith('sw.js') ||
              filePath.endsWith('manifest.webmanifest')
            ) {
              res.setHeader('Cache-Control', 'no-cache');
            }
          }
        })
      );
      app.get('*', (req: Request, res: Response, next) => {
        if (req.path.startsWith('/api/')) return next();
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  return { app, httpServer };
}

async function startServer() {
  const { httpServer } = await createApp({ attachVite: true });
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[DJASSA] Server running on http://0.0.0.0:${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  startServer().catch((err) => {
    console.error('[DJASSA] Failed to start server:', err);
    process.exit(1);
  });
}
