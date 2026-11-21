/**
 * Service Client pour la Gestion des Crédits et la Facturation des API DJASSA
 * 
 * Règles métier :
 * - 1 crédit = 10 FCFA.
 * - Recharge minimale : 3 500 FCFA pour 350 crédits.
 * - Packs : 3 500 FCFA (350 crédits), 5 000 FCFA (500 crédits), 10 000 FCFA (1 000 crédits).
 * - Confirmation de paiement côté serveur avant de créditer le compte.
 * - Tarifs :
 *   * Discussion avec l'IA : 5 crédits par question.
 *   * Génération image RodiumAI (Qwen Image 2.1 Turbo) : 10 crédits par image.
 *   * Génération vidéo 5 secondes (MiniMax H3 Max Turbo) : 60 crédits.
 * - Débit et Remboursements :
 *   * Vérification du solde avant chaque utilisation.
 *   * Débit unique avec clé d'idempotence pour empêcher les doubles débits.
 *   * Remboursement automatique en cas d'échec de génération fournisseur.
 * - Rentabilité & Administration :
 *   * Enregistrement du modèle, crédits, coût réel d'API en FCFA, bénéfice brut et net.
 *   * Signalement explicite des estimations vs coûts réels fournisseur.
 */

import { apiJsonFetch, fetchWithTimeout, invalidatePublicHttpCache } from './httpClient';
import { getSecurityToken } from './securityService';
import { safeStorageGet, safeStorageSet } from './sharedDataSync';
import { visitorService } from './visitorService';

function getAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getSecurityToken();
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export interface ServicePricingInfo {
  name: string;
  credits: number;
  model: string;
  apiCostFcfa: number;
  isEstimate: boolean;
  costSource: string;
  provider: string;
}

export interface CreditConfig {
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
  pricing: {
    chat: ServicePricingInfo;
    image: ServicePricingInfo;
    video: ServicePricingInfo;
  };
}

export interface UsageLog {
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
}

export interface RechargeLog {
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
}

export interface AiStatusResponse {
  success: boolean;
  providers: {
    rodiumAi: { configured: boolean; envVar: string; authorizedModels?: string[] };
    googleMaps: { configured: boolean; envVar: string };
    cloudflareR2: { configured: boolean; envVar: string };
    fcm: { configured: boolean; envVar: string };
    geniusPay: { configured: boolean; envVar: string };
    supabase: { configured: boolean; dbConfigured?: boolean; connected: boolean; apiConfigured?: boolean; url?: string | null };
  };
  usagesCount?: number;
}

export interface RefundLog {
  id: string;
  originalUsageId: string;
  userId: string;
  credits: number;
  amountFcfa: number;
  reason: string;
  createdAt: string;
}

export interface FinancialStats {
  totalRechargesFcfa: number;
  totalRechargesCount: number;
  totalCreditsGranted: number;
  totalPaymentFeesFcfa: number;
  totalCreditsConsumed: number;
  totalConsumedRevenueFcfa: number;
  totalRealApiCostFcfa: number;
  totalGrossProfitFcfa: number;
  grossMarginPercent: number;
  totalRefundsCount: number;
  totalRefundsFcfa: number;
  totalCreditsRefunded: number;
  netProfitFcfa: number;
}

export interface AdminStatsResponse {
  financials: FinancialStats;
  breakdown: {
    chat: { usagesCount: number; credits: number; revenueFcfa: number; apiCostFcfa: number; grossProfitFcfa: number };
    image: { usagesCount: number; credits: number; revenueFcfa: number; apiCostFcfa: number; grossProfitFcfa: number };
    video: { usagesCount: number; credits: number; revenueFcfa: number; apiCostFcfa: number; grossProfitFcfa: number };
  };
  config: CreditConfig;
  recentUsages: UsageLog[];
  recentRecharges: RechargeLog[];
  recentRefunds: RefundLog[];
}

// In-flight locks to prevent accidental duplicate clicks
const activePendingLocks = new Set<string>();

class CreditsService {
  private fallbackConfig: CreditConfig = {
    creditValueFcfa: 10,
    minRechargeFcfa: 3500,
    paymentFeeRate: 0.015,
    packs: [
      { id: 'pack-3500', name: 'Pack Starter (Minimum)', priceFcfa: 3500, credits: 350, badge: 'Recharge Minimale' },
      { id: 'pack-5000', name: 'Pack Confort', priceFcfa: 5000, credits: 500, badge: 'Populaire', isPopular: true },
      { id: 'pack-10000', name: 'Pack Pro / Illimité', priceFcfa: 10000, credits: 1000, badge: 'Meilleure Offre' }
    ],
    pricing: {
      chat: {
        name: "Discussion avec l'IA",
        credits: 5,
        model: "MiniMax M3.1 Flash / MiniMax H3 (RodiumAI)",
        apiCostFcfa: 1.2,
        isEstimate: true,
        costSource: "Estimation signalée (~1.5k tokens via RodiumAI)",
        provider: "RodiumAI"
      },
      image: {
        name: "Génération d'une image RodiumAI",
        credits: 10,
        model: "Qwen Image 2.1 Turbo (RodiumAI)",
        apiCostFcfa: 12.5,
        isEstimate: false,
        costSource: "Tarif fournisseur RodiumAI Qwen Image 2.1 Turbo",
        provider: "RodiumAI"
      },
      video: {
        name: "Génération d'une vidéo de 5 secondes",
        credits: 60,
        model: "MiniMax H3 Max Turbo (RodiumAI)",
        apiCostFcfa: 175.0,
        isEstimate: false,
        costSource: "Tarif fournisseur RodiumAI MiniMax H3 Max Turbo",
        provider: "RodiumAI"
      }
    }
  };

  /**
   * Récupère la configuration des tarifs et modèles depuis le serveur
   */
  async getConfig(): Promise<CreditConfig> {
    try {
      const data = await apiJsonFetch<{ config?: CreditConfig }>('/api/credits/config', {
        cacheTtlMs: 30_000,
        timeoutMs: 10_000
      });
      if (data?.config) return data.config;
    } catch (e) {
      console.warn('Utilisation de la config locale de secours:', e);
    }
    return this.fallbackConfig;
  }

  /**
   * Met à jour la configuration des tarifs depuis l'administration
   */
  async updateConfig(patch: Partial<CreditConfig>): Promise<CreditConfig> {
    const res = await fetchWithTimeout('/api/credits/config', {
      method: 'PATCH',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(patch)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || 'Erreur lors de la mise à jour des tarifs');
    }
    const data = await res.json();
    invalidatePublicHttpCache('/api/credits/config');
    return data.config;
  }

  /**
   * Récupère le solde et le forfait confirmés côté serveur
   */
  async getBalance(userId?: string): Promise<{ balance: number; balanceFcfa: number; activePlan?: string }> {
    try {
      const endpoint = userId ? `/api/credits/balance/${encodeURIComponent(userId)}` : '/api/credits/balance';
      const res = await fetchWithTimeout(endpoint, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.balance === 'number') {
          safeStorageSet('djassa_ai_credits', String(data.balance));
        }
        if (typeof data.activePlan === 'string' && data.activePlan) {
          safeStorageSet('djassa_user_plan', data.activePlan);
        }
        return {
          balance: data.balance,
          balanceFcfa: data.balanceFcfa,
          activePlan: data.activePlan
        };
      }
    } catch (e) {
      console.warn('Erreur lecture solde serveur:', e);
    }
    const local = Number(safeStorageGet('djassa_ai_credits') || 0);
    return { balance: local, balanceFcfa: local * 10, activePlan: safeStorageGet('djassa_user_plan') || 'gratuit' };
  }

  async getHistory(): Promise<{ activePlan?: string; recharges: RechargeLog[]; usages: UsageLog[]; refunds: RefundLog[] }> {
    const res = await fetchWithTimeout('/api/credits/history', {
      headers: getAuthHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Impossible de charger l’historique des crédits');
    }
    return {
      activePlan: typeof data.activePlan === 'string' ? data.activePlan : undefined,
      recharges: Array.isArray(data.recharges) ? data.recharges : [],
      usages: Array.isArray(data.usages) ? data.usages : [],
      refunds: Array.isArray(data.refunds) ? data.refunds : []
    };
  }

  async claimDailyBonus(): Promise<{ success: boolean; creditsAdded?: number; newBalance?: number; message?: string }> {
    const res = await fetchWithTimeout('/api/credits/claim-daily-bonus', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, message: data?.message || 'Bonus quotidien indisponible.' };
    }
    if (typeof data.newBalance === 'number') {
      safeStorageSet('djassa_ai_credits', String(data.newBalance));
    }
    return data;
  }

  /**
   * Initie un abonnement client ou une recharge de crédits côté serveur.
   * Reste strictement en attente tant que GeniusPay n'a pas confirmé le paiement.
   */
  async confirmRecharge(params: {
    userId?: string;
    amountFcfa?: number;
    planId?: string;
    packId?: string;
    purchaseType?: 'subscription' | 'pack' | 'custom';
    paymentMethod: 'wave' | 'orange_money' | 'mtn_momo' | 'card' | string;
    phoneNumber?: string;
  }): Promise<{
    success: boolean;
    pending?: boolean;
    status?: 'pending' | 'confirmed' | 'failed' | 'rejected';
    checkoutUrl?: string;
    providerConfigured?: boolean;
    providerStatus?: string;
    newBalance: number;
    activePlan?: string;
    recharge: RechargeLog;
    message: string;
  }> {
    const { userId, amountFcfa, planId, packId, purchaseType, paymentMethod, phoneNumber } = params;

    const normalizedMethod = String(paymentMethod || '').trim().toLowerCase();
    if (!['wave', 'orange_money', 'mtn_momo', 'card'].includes(normalizedMethod)) {
      throw new Error('Moyen de paiement incompatible avec GeniusPay (wave, orange_money, mtn_momo ou card requis).');
    }

    const isSubscription = Boolean(planId) || purchaseType === 'subscription';
    if (!isSubscription && (typeof amountFcfa !== 'number' || amountFcfa < 3500)) {
      throw new Error("La recharge minimale est de 3 500 FCFA (pour 350 crédits).");
    }

    const res = await fetchWithTimeout('/api/credits/recharge/confirm', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        ...(userId ? { userId } : {}),
        ...(typeof amountFcfa === 'number' ? { amountFcfa } : {}),
        ...(planId ? { planId } : {}),
        ...(packId ? { packId } : {}),
        ...(purchaseType ? { purchaseType } : {}),
        paymentMethod: normalizedMethod,
        ...(phoneNumber ? { phoneNumber } : {})
      })
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(result.message || result.error || 'Échec de l’initialisation serveur du paiement');
    }

    if (typeof result.newBalance === 'number') {
      safeStorageSet('djassa_ai_credits', String(result.newBalance));
    }
    return result;
  }

  /**
   * Consulte le statut actuel d'une transaction de recharge/abonnement côté serveur
   */
  async checkRechargeStatus(rechargeId: string): Promise<{
    success: boolean;
    status: 'pending' | 'confirmed' | 'failed' | 'rejected';
    pending: boolean;
    confirmed: boolean;
    newBalance: number;
    activePlan?: string;
    recharge: RechargeLog;
  }> {
    const res = await fetchWithTimeout(`/api/credits/recharge/${encodeURIComponent(rechargeId)}/status`, {
      headers: getAuthHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Impossible de vérifier le statut de la transaction.');
    }
    if (data.confirmed && typeof data.newBalance === 'number') {
      safeStorageSet('djassa_ai_credits', String(data.newBalance));
      if (typeof data.activePlan === 'string' && data.activePlan) {
        safeStorageSet('djassa_user_plan', data.activePlan);
      }
    }
    return data;
  }

  /**
   * Interroge GeniusPay côté serveur pour vérifier et finaliser atomiquement une transaction en attente
   */
  async verifyProviderRecharge(rechargeId: string): Promise<{
    success: boolean;
    pending?: boolean;
    status?: 'pending' | 'confirmed' | 'failed' | 'rejected';
    newBalance?: number;
    activePlan?: string;
    recharge?: RechargeLog;
    message?: string;
    error?: string;
  }> {
    const res = await fetchWithTimeout(`/api/credits/recharge/${encodeURIComponent(rechargeId)}/verify-provider`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' })
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409 && data.error === 'GENIUSPAY_NOT_CONFIGURED') {
      return {
        success: false,
        pending: data.status === 'pending',
        status: data.status || 'pending',
        newBalance: data.newBalance,
        recharge: data.recharge,
        error: data.error,
        message: data.message
      };
    }
    if (!res.ok) {
      return {
        success: false,
        pending: false,
        status: data.status || 'failed',
        newBalance: data.newBalance,
        recharge: data.recharge,
        error: data.error,
        message: data.message || 'Le paiement n’a pas encore été confirmé par GeniusPay.'
      };
    }
    if (!data.pending && typeof data.newBalance === 'number') {
      safeStorageSet('djassa_ai_credits', String(data.newBalance));
      if (typeof data.activePlan === 'string' && data.activePlan) {
        safeStorageSet('djassa_user_plan', data.activePlan);
      }
    }
    return data;
  }

  /**
   * Débit sécurisé côté serveur avec idempotence
   */
  async deductCredits(params: {
    userId?: string;
    serviceType: 'chat' | 'image' | 'video';
    label?: string;
    idempotencyKey?: string;
  }): Promise<{
    success: boolean;
    newBalance: number;
    usage?: UsageLog;
    refunded?: boolean;
    creditsRefunded?: number;
    costDetail?: any;
    message?: string;
  }> {
    const {
      serviceType,
      label,
      idempotencyKey = 'req-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
    } = params;

    if (activePendingLocks.has(idempotencyKey)) {
      throw new Error("Une transaction est déjà en cours de traitement.");
    }
    activePendingLocks.add(idempotencyKey);

    try {
      const res = await fetchWithTimeout('/api/credits/deduct', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          serviceType,
          label,
          idempotencyKey
        })
      });

      if (res.status === 402) {
        const data = await res.json();
        throw new Error(data.message || 'Solde insuffisant pour cette opération.');
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || 'Erreur lors du débit des crédits');
      }

      const result = await res.json();
      safeStorageSet('djassa_ai_credits', String(result.newBalance));
      return result;
    } finally {
      activePendingLocks.delete(idempotencyKey);
    }
  }

  /**
   * Remboursement d'un usage (Admin uniquement)
   */
  async requestRefund(usageId: string, reason?: string): Promise<{ success: boolean; newBalance: number; message: string }> {
    const res = await fetchWithTimeout('/api/credits/refund', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ usageId, reason })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || data.error || 'Impossible de traiter le remboursement');
    }
    const result = await res.json();
    if (typeof result.newBalance === 'number') {
      safeStorageSet('djassa_ai_credits', String(result.newBalance));
    }
    return result;
  }

  /**
   * Récupère les données d'administration financière & rentabilité
   */
  async getAdminStats(): Promise<AdminStatsResponse> {
    const res = await fetchWithTimeout('/api/credits/admin/stats', {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      throw new Error('Erreur lors du chargement des statistiques administratives');
    }
    return res.json();
  }

  /**
   * Liste les demandes de recharges en attente de validation serveur/admin
   */
  async getPendingRecharges(): Promise<{ success: boolean; pendingRecharges: RechargeLog[] }> {
    const res = await fetchWithTimeout('/api/credits/recharges/pending', {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || 'Impossible de charger les recharges en attente');
    }
    return res.json();
  }

  /**
   * Valide une recharge en attente côté serveur (Admin uniquement)
   */
  async verifyRecharge(
    rechargeId: string,
    providerReference?: string
  ): Promise<{ success: boolean; idempotent?: boolean; newBalance: number; recharge: RechargeLog; message: string }> {
    const res = await fetchWithTimeout(`/api/credits/recharge/${encodeURIComponent(rechargeId)}/verify`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(providerReference ? { providerReference } : {})
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Impossible de valider cette recharge');
    }
    return data;
  }

  /**
   * Vérifie la configuration réelle des API externes côté serveur (sans exposer les clés)
   */
  async getAiStatus(): Promise<AiStatusResponse> {
    const res = await fetchWithTimeout('/api/ai/status', {
      headers: getAuthHeaders()
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Impossible de lire le statut des fournisseurs');
    }
    return data;
  }

  async getAiCapabilities(): Promise<{ rodiumAi: boolean; chat: boolean; image: boolean; video: boolean }> {
    try {
      const data = await apiJsonFetch<{
        capabilities?: { rodiumAi?: boolean; chat?: boolean; image?: boolean; video?: boolean };
      }>('/api/ai/capabilities', { cacheTtlMs: 30_000, timeoutMs: 8_000 });
      return {
        rodiumAi: Boolean(data?.capabilities?.rodiumAi),
        chat: Boolean(data?.capabilities?.chat),
        image: Boolean(data?.capabilities?.image),
        video: Boolean(data?.capabilities?.video)
      };
    } catch {
      return { rodiumAi: false, chat: false, image: false, video: false };
    }
  }

  /**
   * Appel réel à l'assistant IA DJASSA via le proxy backend sécurisé (/api/ai/chat) - RodiumAI
   */
  async chatWithAi(
    prompt: string,
    systemInstruction?: string,
    images?: string[],
    model?: 'minimax-m3.1-flash' | 'minimax-h3-max-turbo' | 'minimax-h3'
  ): Promise<{
    success: boolean;
    text: string;
    model: string;
    wordCount?: number;
    maxWords?: number;
    guestQuota?: { used: number; limit: number; remaining: number; dateKey: string };
  }> {
    const token = getSecurityToken();
    const extraHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!token) {
      extraHeaders['x-guest-id'] = visitorService.getGuestId();
    }
    const res = await fetchWithTimeout(
      '/api/ai/chat',
      {
        method: 'POST',
        headers: getAuthHeaders(extraHeaders),
        body: JSON.stringify({ prompt, systemInstruction, images, model })
      },
      45_000
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || data.error || 'Fournisseur IA indisponible') as Error & {
        status?: number;
        code?: string;
        quota?: { used: number; limit: number; remaining: number; dateKey: string };
      };
      err.status = res.status;
      err.code = data.error;
      if (data.quota) err.quota = data.quota;
      throw err;
    }
    return data;
  }

  async generateTryOn(params: {
    userPhoto: string;
    productImage: string;
    productName: string;
    productCategory?: string;
    modelId?: string;
    modelName?: string;
    modelGender?: 'female' | 'male';
    morphology?: string;
    morphologyDetail?: string;
    size?: string;
    color?: string;
    viewAngle?: string;
    drapeFitNotes?: string;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; imageDataUrl: string; newBalance: number }> {
    const res = await fetchWithTimeout(
      '/api/ai/try-on',
      {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(params)
      },
      45_000
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || data.error || 'Essayage IA indisponible') as Error & {
        status?: number;
        code?: string;
      };
      err.status = res.status;
      err.code = data.error;
      throw err;
    }
    if (typeof data.newBalance === 'number') {
      safeStorageSet('djassa_ai_credits', String(data.newBalance));
    }
    return data;
  }

  async generateVideo(params: {
    prompt: string;
    mode?: 'text' | 'image';
    sourceImage?: string;
  }): Promise<{ success: boolean; taskId: string | null; videoUrl: string | null }> {
    const res = await fetchWithTimeout(
      '/api/ai/video',
      {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(params)
      },
      45_000
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || data.error || 'Génération vidéo indisponible') as Error & {
        status?: number;
        code?: string;
      };
      err.status = res.status;
      err.code = data.error;
      throw err;
    }
    return data;
  }
}

export const creditsService = new CreditsService();
