import type { Express, Request, Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWriteJsonFile } from './atomicFileStore';
import { encryptSecretValue } from './secretCrypto';
import { registerPgPushToken, upsertPgNotificationPreferences } from './repositories/communicationsPgRepository';
import {
  HMAC_SECRET,
  appendAuditEntry,
  authenticateSessionRequest,
  extractBearerToken,
  getClientIp,
  persistSecurityDb,
  securityDb,
  type AuthenticatedRequestContext
} from './securityModule';
import {
  commerceDb,
  ensureClientSupportConversation,
  persistCommerceDb
} from './commerceModule';
import { VISITOR_QUOTAS, getLocalDateKey } from '../src/config/visitorQuotas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const CLIENT_STATE_FILE = path.join(DATA_DIR, 'client_state.json');

export interface ClientProfileOverlay {
  username?: string;
  bio?: string;
  avatar?: string;
  location?: string;
  commune?: string;
  quartier?: string;
  details?: string;
  updatedAt: string;
}

export interface ClientPreferences {
  privacy: {
    privateAccount: boolean;
    allowMessages: 'everyone' | 'friends' | 'no_one';
    allowComments: 'everyone' | 'friends' | 'no_one';
    allowMentions: 'everyone' | 'friends' | 'no_one';
    showActivityStatus: boolean;
    personalizedAds: boolean;
    twoFactorEnabled: boolean;
    blockedSellerIds: string[];
  };
  notifications: {
    pushEnabled: boolean;
    orderUpdates: boolean;
    promotions: boolean;
    liveStreams: boolean;
    messages: boolean;
    newFollowers: boolean;
    emailDigest: boolean;
    smsAlerts: boolean;
  };
  display: {
    theme: 'dark' | 'light';
    fontSize: 'small' | 'normal' | 'large';
    reduceMotion: boolean;
  };
  language: string;
  dataSaver: {
    enabled: boolean;
    autoplayWifiOnly: boolean;
    videoQuality: 'auto' | 'high' | 'data_saver';
  };
  contentPreferences: {
    favoriteCategories: string[];
    mutedKeywords: string[];
  };
  screenTime: {
    dailyLimitMinutes: number | null;
    sleepReminderEnabled: boolean;
    sleepStartHour: string;
    dailyUsageMinutes: Record<string, number>;
  };
  savedAddresses: Array<{
    id: string;
    label: string;
    commune: string;
    quartier: string;
    details: string;
    recipientName?: string;
    phone?: string;
    isDefault?: boolean;
  }>;
  paymentMethods: Array<{
    id: string;
    type: 'wave' | 'orange_money' | 'mtn_momo' | 'card';
    label: string;
    maskedTarget: string;
    isDefault?: boolean;
  }>;
  searchHistoryEnabled: boolean;
  updatedAt: string;
}

export interface ClientAiMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  attachedImages?: string[];
  products?: Array<Record<string, unknown>>;
  timestamp: string;
}

export interface ClientAiConversation {
  id: string;
  title: string;
  dateLabel: string;
  updatedAt: string;
  messages: ClientAiMessage[];
}

export interface ClientTicketAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
}

export interface ClientSupportTicket {
  id: string;
  userId: string;
  userEmail: string;
  ticketType: 'problem' | 'fraud' | 'claim';
  category: string;
  description: string;
  orderId?: string;
  contactEmail?: string;
  status: 'pending' | 'in_review' | 'resolved';
  attachments: ClientTicketAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface ClientViewingHistoryEntry {
  videoId: string;
  watchedAt: string;
  durationSec: number;
  completed: boolean;
}

export interface ClientInteractions {
  likedVideoIds: string[];
  savedVideoIds: string[];
  followingSellerIds: string[];
  blockedSellerIds: string[];
  taggedItemIds: string[];
  viewingHistory: ClientViewingHistoryEntry[];
  tryOnHistory: Array<Record<string, unknown>>;
  searchHistory: string[];
  updatedAt: string;
}

export interface ClientOrderReview {
  id: string;
  orderId: string;
  orderNumber?: string;
  userId: string;
  sellerId: string;
  productId?: string;
  productTitle?: string;
  productImage?: string;
  clientName?: string;
  clientCommune?: string;
  verifiedPurchase?: boolean;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface ClientPushTokenRecord {
  id: string;
  userId: string;
  platform: 'web' | 'android' | 'ios';
  provider: 'web_push' | 'fcm' | 'apns';
  tokenHash: string;
  secretCiphertext: string;
  secretKeyVersion: string;
  deviceLabel?: string;
  createdAt: string;
}

interface ClientStateStore {
  profiles: Record<string, ClientProfileOverlay>;
  preferences: Record<string, ClientPreferences>;
  aiConversations: Record<string, ClientAiConversation[]>;
  tickets: ClientSupportTicket[];
  interactions: Record<string, ClientInteractions>;
  reviews: ClientOrderReview[];
  pushTokens: Record<string, ClientPushTokenRecord[]>;
  guestAiUsage: Record<string, { dateKey: string; count: number; updatedAt: string }>;
}

const DEFAULT_CLIENT_PREFERENCES: Omit<ClientPreferences, 'updatedAt'> = {
  privacy: {
    privateAccount: false,
    allowMessages: 'everyone',
    allowComments: 'everyone',
    allowMentions: 'everyone',
    showActivityStatus: true,
    personalizedAds: true,
    twoFactorEnabled: false,
    blockedSellerIds: []
  },
  notifications: {
    pushEnabled: true,
    orderUpdates: true,
    promotions: true,
    liveStreams: true,
    messages: true,
    newFollowers: true,
    emailDigest: false,
    smsAlerts: true
  },
  display: {
    theme: 'dark',
    fontSize: 'normal',
    reduceMotion: false
  },
  language: 'fr',
  dataSaver: {
    enabled: false,
    autoplayWifiOnly: false,
    videoQuality: 'auto'
  },
  contentPreferences: {
    favoriteCategories: [],
    mutedKeywords: []
  },
  screenTime: {
    dailyLimitMinutes: null,
    sleepReminderEnabled: false,
    sleepStartHour: '23:00',
    dailyUsageMinutes: {}
  },
  savedAddresses: [],
  paymentMethods: [],
  searchHistoryEnabled: true
};

const DEFAULT_INTERACTIONS: Omit<ClientInteractions, 'updatedAt'> = {
  likedVideoIds: [],
  savedVideoIds: [],
  followingSellerIds: [],
  blockedSellerIds: [],
  taggedItemIds: [],
  viewingHistory: [],
  tryOnHistory: [],
  searchHistory: []
};

let clientStore: ClientStateStore = {
  profiles: {},
  preferences: {},
  aiConversations: {},
  tickets: [],
  interactions: {},
  reviews: [],
  pushTokens: {},
  guestAiUsage: {}
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function persistClientStore() {
  if (!atomicWriteJsonFile(CLIENT_STATE_FILE, clientStore, { context: 'ClientModule' })) {
    console.error('[ClientModule] Failed to persist client_state.json');
  }
}

function loadClientStore() {
  ensureDataDir();
  if (fs.existsSync(CLIENT_STATE_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(CLIENT_STATE_FILE, 'utf8'));
      clientStore = {
        profiles: parsed?.profiles && typeof parsed.profiles === 'object' ? parsed.profiles : {},
        preferences: parsed?.preferences && typeof parsed.preferences === 'object' ? parsed.preferences : {},
        aiConversations:
          parsed?.aiConversations && typeof parsed.aiConversations === 'object' ? parsed.aiConversations : {},
        tickets: Array.isArray(parsed?.tickets) ? parsed.tickets : [],
        interactions: parsed?.interactions && typeof parsed.interactions === 'object' ? parsed.interactions : {},
        reviews: Array.isArray(parsed?.reviews) ? parsed.reviews : [],
        pushTokens: parsed?.pushTokens && typeof parsed.pushTokens === 'object' ? parsed.pushTokens : {},
        guestAiUsage: parsed?.guestAiUsage && typeof parsed.guestAiUsage === 'object' ? parsed.guestAiUsage : {}
      };
    } catch (err) {
      console.error('[ClientModule] Corrupted client_state.json, initializing fresh store:', err);
    }
  }
}

loadClientStore();

function resolveGuestUsageKeys(guestId?: string, ip?: string): { primaryKey: string; ipKey: string | null } {
  const cleanGuest = String(guestId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 80);
  const cleanIp = String(ip || '')
    .trim()
    .replace(/[^a-zA-Z0-9_.:-]/g, '')
    .slice(0, 80);
  if (cleanGuest) {
    return {
      primaryKey: `gid:${cleanGuest}`,
      ipKey: cleanIp ? `ip:${cleanIp}` : null
    };
  }
  return {
    primaryKey: cleanIp ? `ip:${cleanIp}` : 'gid:anonymous',
    ipKey: null
  };
}

export function checkGuestAiQuota(guestId?: string, ip?: string): {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  dateKey: string;
} {
  const today = getLocalDateKey();
  const limit = VISITOR_QUOTAS.dailyAiQuestions;
  const { primaryKey, ipKey } = resolveGuestUsageKeys(guestId, ip);
  const primaryEntry = clientStore.guestAiUsage[primaryKey];
  const used = primaryEntry && primaryEntry.dateKey === today ? Math.max(0, primaryEntry.count) : 0;

  let ipAbuseBlocked = false;
  if (ipKey) {
    const ipEntry = clientStore.guestAiUsage[ipKey];
    const ipUsed = ipEntry && ipEntry.dateKey === today ? Math.max(0, ipEntry.count) : 0;
    if (ipUsed >= limit * 6) {
      ipAbuseBlocked = true;
    }
  }

  return {
    allowed: used < limit && !ipAbuseBlocked,
    used: Math.min(limit, used),
    limit,
    remaining: ipAbuseBlocked ? 0 : Math.max(0, limit - used),
    dateKey: today
  };
}

export function incrementGuestAiQuota(guestId?: string, ip?: string): {
  used: number;
  limit: number;
  remaining: number;
  dateKey: string;
} {
  const today = getLocalDateKey();
  const limit = VISITOR_QUOTAS.dailyAiQuestions;
  const nowIso = new Date().toISOString();
  const { primaryKey, ipKey } = resolveGuestUsageKeys(guestId, ip);

  const prev = clientStore.guestAiUsage[primaryKey];
  const prevCount = prev && prev.dateKey === today ? Math.max(0, prev.count) : 0;
  const nextCount = Math.min(limit, prevCount + 1);
  clientStore.guestAiUsage[primaryKey] = {
    dateKey: today,
    count: nextCount,
    updatedAt: nowIso
  };

  if (ipKey) {
    const prevIp = clientStore.guestAiUsage[ipKey];
    const prevIpCount = prevIp && prevIp.dateKey === today ? Math.max(0, prevIp.count) : 0;
    clientStore.guestAiUsage[ipKey] = {
      dateKey: today,
      count: prevIpCount + 1,
      updatedAt: nowIso
    };
  }

  // Purge stale entries older than today to keep store compact
  for (const [key, entry] of Object.entries(clientStore.guestAiUsage)) {
    if (entry.dateKey !== today) {
      delete clientStore.guestAiUsage[key];
    }
  }

  persistClientStore();
  return {
    used: nextCount,
    limit,
    remaining: Math.max(0, limit - nextCount),
    dateKey: today
  };
}

// Single-use short-lived WebSocket tickets (60s TTL)
const wsTicketStore = new Map<
  string,
  { ticketId: string; uid: string; name: string; spaceRole: string; exp: number; consumed: boolean }
>();

export function createWsTicket(authCtx: AuthenticatedRequestContext): { ticket: string; expiresInSeconds: number } {
  const now = Date.now();
  const ticketId = `wst-${crypto.randomUUID()}`;
  const exp = now + 60_000;
  wsTicketStore.set(ticketId, {
    ticketId,
    uid: authCtx.token.uid,
    name: authCtx.token.name,
    spaceRole: authCtx.token.spaceRole,
    exp,
    consumed: false
  });
  // Purge expired tickets occasionally
  if (wsTicketStore.size > 500) {
    for (const [k, v] of wsTicketStore.entries()) {
      if (v.exp <= now || v.consumed) wsTicketStore.delete(k);
    }
  }
  const encoded = Buffer.from(
    JSON.stringify({ ticketId, uid: authCtx.token.uid, role: authCtx.token.spaceRole, exp }),
    'utf8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', HMAC_SECRET).update(`ws:${encoded}`).digest('base64url');
  return { ticket: `wst-v1.${encoded}.${sig}`, expiresInSeconds: 60 };
}

export function consumeWsTicket(
  rawTicket: string | null | undefined
): { ok: true; uid: string; name: string; spaceRole: string } | { ok: false; reason: string } {
  if (!rawTicket) return { ok: false, reason: 'WS_TICKET_REQUIRED' };
  const parts = String(rawTicket).split('.');
  if (parts.length !== 3 || parts[0] !== 'wst-v1') return { ok: false, reason: 'WS_TICKET_MALFORMED' };
  const [, encoded, sig] = parts;
  const expected = crypto.createHmac('sha256', HMAC_SECRET).update(`ws:${encoded}`).digest('base64url');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'WS_TICKET_INVALID_SIG' };
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      ticketId: string;
      exp: number;
    };
    if (!parsed.ticketId || !parsed.exp || parsed.exp < Date.now()) {
      return { ok: false, reason: 'WS_TICKET_EXPIRED' };
    }
    const entry = wsTicketStore.get(parsed.ticketId);
    if (!entry || entry.consumed || entry.exp < Date.now()) {
      return { ok: false, reason: 'WS_TICKET_ALREADY_USED' };
    }
    entry.consumed = true;
    wsTicketStore.delete(parsed.ticketId);
    return { ok: true, uid: entry.uid, name: entry.name, spaceRole: entry.spaceRole };
  } catch {
    return { ok: false, reason: 'WS_TICKET_PARSE_ERROR' };
  }
}

export function getClientProfileOverlay(uid: string): ClientProfileOverlay | null {
  return clientStore.profiles[uid] || null;
}

export function setClientProfileOverlay(uid: string, patch: Partial<ClientProfileOverlay>): ClientProfileOverlay {
  const prev = clientStore.profiles[uid] || { updatedAt: new Date().toISOString() };
  const next: ClientProfileOverlay = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  clientStore.profiles[uid] = next;
  persistClientStore();
  return next;
}

export function isUsernameTaken(username: string, excludeUid?: string): boolean {
  const norm = username.trim().toLowerCase().replace(/^@+/, '');
  if (!norm) return false;
  for (const [uid, overlay] of Object.entries(clientStore.profiles)) {
    if (excludeUid && uid === excludeUid) continue;
    const candidate = (overlay.username || '').trim().toLowerCase().replace(/^@+/, '');
    if (candidate && candidate === norm) return true;
  }
  return false;
}

export function getOrInitPreferences(uid: string): ClientPreferences {
  const existing = clientStore.preferences[uid];
  if (existing) {
    return {
      ...DEFAULT_CLIENT_PREFERENCES,
      ...existing,
      privacy: { ...DEFAULT_CLIENT_PREFERENCES.privacy, ...(existing.privacy || {}) },
      notifications: { ...DEFAULT_CLIENT_PREFERENCES.notifications, ...(existing.notifications || {}) },
      display: { ...DEFAULT_CLIENT_PREFERENCES.display, ...(existing.display || {}) },
      dataSaver: { ...DEFAULT_CLIENT_PREFERENCES.dataSaver, ...(existing.dataSaver || {}) },
      contentPreferences: {
        ...DEFAULT_CLIENT_PREFERENCES.contentPreferences,
        ...(existing.contentPreferences || {})
      },
      screenTime: { ...DEFAULT_CLIENT_PREFERENCES.screenTime, ...(existing.screenTime || {}) },
      savedAddresses: Array.isArray(existing.savedAddresses) ? existing.savedAddresses : [],
      paymentMethods: Array.isArray(existing.paymentMethods) ? existing.paymentMethods : []
    };
  }
  return { ...DEFAULT_CLIENT_PREFERENCES, updatedAt: new Date().toISOString() };
}

function getOrInitInteractions(uid: string): ClientInteractions {
  const existing = clientStore.interactions[uid];
  if (existing) {
    return {
      ...DEFAULT_INTERACTIONS,
      ...existing,
      likedVideoIds: Array.isArray(existing.likedVideoIds) ? existing.likedVideoIds : [],
      savedVideoIds: Array.isArray(existing.savedVideoIds) ? existing.savedVideoIds : [],
      followingSellerIds: Array.isArray(existing.followingSellerIds) ? existing.followingSellerIds : [],
      blockedSellerIds: Array.isArray(existing.blockedSellerIds) ? existing.blockedSellerIds : [],
      taggedItemIds: Array.isArray(existing.taggedItemIds) ? existing.taggedItemIds : [],
      viewingHistory: Array.isArray(existing.viewingHistory) ? existing.viewingHistory : [],
      tryOnHistory: Array.isArray(existing.tryOnHistory) ? existing.tryOnHistory : [],
      searchHistory: Array.isArray(existing.searchHistory) ? existing.searchHistory : []
    };
  }
  return { ...DEFAULT_INTERACTIONS, updatedAt: new Date().toISOString() };
}

const ALLOWED_ATTACHMENT_MIME_PREFIXES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];
const MAX_ATTACHMENT_DATA_LEN = 2_800_000; // ~2 MB base64

export function installClientRoutes(app: Express) {
  // --------------------------------------------------------------------------
  // GET /api/client/bootstrap — Données persistées complètes pour l'utilisateur connecté
  // --------------------------------------------------------------------------
  app.get('/api/client/bootstrap', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const uid = authCtx.token.uid;
    const emailLower = authCtx.token.email.toLowerCase();
    const profile = getClientProfileOverlay(uid);
    const preferences = getOrInitPreferences(uid);
    const aiConversations = clientStore.aiConversations[uid] || [];
    const tickets = clientStore.tickets.filter((t) => t.userId === uid);
    const interactions = getOrInitInteractions(uid);
    const reviews = clientStore.reviews.filter((r) => r.userId === uid);
    const sessions = securityDb.sessions
      .filter((s) => (s.userId === uid || s.userEmail.toLowerCase() === emailLower) && s.status !== 'revoked')
      .slice(0, 20)
      .map((s) => ({
        sessionId: s.sessionId,
        device: s.device,
        browser: s.browser,
        os: s.os,
        location: s.location,
        startedAt: s.startedAt,
        lastActivityAt: s.lastActivityAt,
        expiresAt: s.expiresAt,
        status: s.status,
        isCurrent: s.sessionId === authCtx.session.sessionId
      }));

    return res.json({
      success: true,
      profile,
      preferences,
      aiConversations,
      tickets,
      interactions,
      reviews,
      sessions
    });
  });

  // --------------------------------------------------------------------------
  // PUT /api/client/preferences — Persistance serveur des paramètres Client
  // --------------------------------------------------------------------------
  app.put('/api/client/preferences', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const uid = authCtx.token.uid;
    const current = getOrInitPreferences(uid);
    const body = req.body || {};

    const next: ClientPreferences = {
      privacy: body.privacy ? { ...current.privacy, ...body.privacy } : current.privacy,
      notifications: body.notifications ? { ...current.notifications, ...body.notifications } : current.notifications,
      display: body.display
        ? {
            theme: body.display.theme === 'light' ? 'light' : 'dark',
            fontSize: ['small', 'normal', 'large'].includes(body.display.fontSize)
              ? body.display.fontSize
              : current.display.fontSize,
            reduceMotion:
              typeof body.display.reduceMotion === 'boolean'
                ? body.display.reduceMotion
                : current.display.reduceMotion
          }
        : current.display,
      language: typeof body.language === 'string' && body.language.trim() ? body.language.trim().slice(0, 12) : current.language,
      dataSaver: body.dataSaver ? { ...current.dataSaver, ...body.dataSaver } : current.dataSaver,
      contentPreferences: body.contentPreferences
        ? {
            favoriteCategories: Array.isArray(body.contentPreferences.favoriteCategories)
              ? body.contentPreferences.favoriteCategories.map(String).slice(0, 30)
              : current.contentPreferences.favoriteCategories,
            mutedKeywords: Array.isArray(body.contentPreferences.mutedKeywords)
              ? body.contentPreferences.mutedKeywords.map(String).slice(0, 50)
              : current.contentPreferences.mutedKeywords
          }
        : current.contentPreferences,
      screenTime: body.screenTime
        ? {
            dailyLimitMinutes:
              body.screenTime.dailyLimitMinutes === null
                ? null
                : typeof body.screenTime.dailyLimitMinutes === 'number'
                ? Math.max(5, Math.min(720, Math.round(body.screenTime.dailyLimitMinutes)))
                : current.screenTime.dailyLimitMinutes,
            sleepReminderEnabled:
              typeof body.screenTime.sleepReminderEnabled === 'boolean'
                ? body.screenTime.sleepReminderEnabled
                : current.screenTime.sleepReminderEnabled,
            sleepStartHour:
              typeof body.screenTime.sleepStartHour === 'string'
                ? body.screenTime.sleepStartHour.slice(0, 5)
                : current.screenTime.sleepStartHour,
            dailyUsageMinutes:
              body.screenTime.dailyUsageMinutes && typeof body.screenTime.dailyUsageMinutes === 'object'
                ? body.screenTime.dailyUsageMinutes
                : current.screenTime.dailyUsageMinutes
          }
        : current.screenTime,
      savedAddresses: Array.isArray(body.savedAddresses) ? body.savedAddresses.slice(0, 20) : current.savedAddresses,
      paymentMethods: Array.isArray(body.paymentMethods) ? body.paymentMethods.slice(0, 20) : current.paymentMethods,
      searchHistoryEnabled:
        typeof body.searchHistoryEnabled === 'boolean' ? body.searchHistoryEnabled : current.searchHistoryEnabled,
      updatedAt: new Date().toISOString()
    };

    clientStore.preferences[uid] = next;
    persistClientStore();
    return res.json({ success: true, preferences: next });
  });

  // --------------------------------------------------------------------------
  // AI CONVERSATIONS HISTORY (Explorer Assistant IA)
  // --------------------------------------------------------------------------
  app.get('/api/client/ai-conversations', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    return res.json({
      success: true,
      conversations: clientStore.aiConversations[authCtx.token.uid] || []
    });
  });

  app.post('/api/client/ai-conversations', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const uid = authCtx.token.uid;
    const { id, title, dateLabel, messages } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ success: false, error: 'INVALID_MESSAGES' });
    }

    const convId = String(id || `ai-conv-${crypto.randomUUID().slice(0, 10)}`);
    const nowIso = new Date().toISOString();
    const sanitizedMessages: ClientAiMessage[] = messages.slice(-100).map((m: any) => ({
      id: String(m?.id || crypto.randomUUID()),
      sender: m?.sender === 'ai' ? 'ai' : 'user',
      text: String(m?.text || '').slice(0, 8000),
      ...(Array.isArray(m?.attachedImages)
        ? { attachedImages: m.attachedImages.filter((s: unknown) => typeof s === 'string').slice(0, 3) }
        : {}),
      ...(Array.isArray(m?.products) ? { products: m.products.slice(0, 12) } : {}),
      timestamp: String(m?.timestamp || nowIso)
    }));

    const existingList = clientStore.aiConversations[uid] || [];
    const idx = existingList.findIndex((c) => c.id === convId);
    const conv: ClientAiConversation = {
      id: convId,
      title: String(title || 'Discussion IA').trim().slice(0, 120) || 'Discussion IA',
      dateLabel: String(dateLabel || "Aujourd'hui"),
      updatedAt: nowIso,
      messages: sanitizedMessages
    };

    if (idx >= 0) {
      existingList[idx] = conv;
    } else {
      existingList.unshift(conv);
    }
    clientStore.aiConversations[uid] = existingList.slice(0, 50);
    persistClientStore();

    return res.status(201).json({ success: true, conversation: conv, conversations: clientStore.aiConversations[uid] });
  });

  app.delete('/api/client/ai-conversations/:id', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const uid = authCtx.token.uid;
    const list = clientStore.aiConversations[uid] || [];
    clientStore.aiConversations[uid] = list.filter((c) => c.id !== req.params.id);
    persistClientStore();
    return res.json({ success: true, conversations: clientStore.aiConversations[uid] });
  });

  // --------------------------------------------------------------------------
  // SUPPORT TICKETS & FRAUD REPORTS WITH REAL FILE ATTACHMENTS
  // --------------------------------------------------------------------------
  app.get('/api/client/tickets', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const tickets =
      authCtx.token.spaceRole === 'admin'
        ? clientStore.tickets
        : clientStore.tickets.filter((t) => t.userId === authCtx.token.uid);
    return res.json({ success: true, tickets });
  });

  app.post('/api/client/tickets', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const {
      ticketType = 'problem',
      category = 'Autre problème',
      description,
      orderId,
      contactEmail,
      attachments = []
    } = req.body || {};

    const cleanDesc = String(description || '').trim();
    if (cleanDesc.length < 5) {
      return res.status(400).json({
        success: false,
        error: 'DESCRIPTION_TOO_SHORT',
        message: 'Veuillez décrire votre demande en au moins 5 caractères.'
      });
    }

    const validAttachments: ClientTicketAttachment[] = [];
    if (Array.isArray(attachments)) {
      for (const att of attachments.slice(0, 4)) {
        const name = String(att?.name || 'piece-jointe').slice(0, 120);
        const mimeType = String(att?.mimeType || '').toLowerCase();
        const dataUrl = String(att?.dataUrl || '');
        const size = Number(att?.size || 0);
        if (!ALLOWED_ATTACHMENT_MIME_PREFIXES.includes(mimeType)) {
          return res.status(400).json({
            success: false,
            error: 'UNSUPPORTED_ATTACHMENT_TYPE',
            message: `Format de fichier non autorisé pour "${name}". Formats acceptés : PNG, JPEG, WEBP, GIF, PDF.`
          });
        }
        if (!dataUrl.startsWith(`data:${mimeType};base64,`) || dataUrl.length > MAX_ATTACHMENT_DATA_LEN) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_ATTACHMENT_PAYLOAD',
            message: `Fichier "${name}" invalide ou trop volumineux (max 2 Mo).`
          });
        }
        validAttachments.push({
          id: `att-${crypto.randomUUID().slice(0, 8)}`,
          name,
          mimeType,
          size: Number.isFinite(size) && size > 0 ? size : Math.round(dataUrl.length * 0.75),
          dataUrl
        });
      }
    }

    const nowIso = new Date().toISOString();
    const resolvedType: ClientSupportTicket['ticketType'] =
      ticketType === 'fraud' || ticketType === 'claim' ? ticketType : 'problem';
    const ticket: ClientSupportTicket = {
      id: `TCK-${crypto.randomInt(100000, 999999)}`,
      userId: authCtx.token.uid,
      userEmail: authCtx.token.email,
      ticketType: resolvedType,
      category: String(category || 'Autre problème').slice(0, 120),
      description: cleanDesc.slice(0, 4000),
      ...(orderId ? { orderId: String(orderId).slice(0, 80) } : {}),
      ...(contactEmail ? { contactEmail: String(contactEmail).slice(0, 120) } : {}),
      status: 'pending',
      attachments: validAttachments,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    clientStore.tickets.unshift(ticket);
    persistClientStore();

    if (resolvedType === 'fraud') {
      appendAuditEntry({
        actorId: authCtx.token.uid,
        actorName: authCtx.token.name,
        actorAccountLabel: authCtx.token.email,
        actorRole: authCtx.token.spaceRole,
        space: 'client',
        category: 'security',
        actionType: 'client_fraud_report',
        action: `Signalement fraude client (${ticket.id})`,
        target: ticket.category,
        targetType: 'incident',
        entityType: 'ticket',
        entityId: ticket.id,
        result: 'reussi',
        severity: 'eleve',
        beforeValue: null,
        afterValue: `Ticket ${ticket.id}`,
        details: cleanDesc.slice(0, 300),
        ipAddress: getClientIp(req)
      });
      persistSecurityDb();
    }

    return res.status(201).json({ success: true, ticket });
  });

  // --------------------------------------------------------------------------
  // POST /api/client/support-chat — Démarre / ouvre la vraie messagerie Support DJASSA
  // --------------------------------------------------------------------------
  app.post('/api/client/support-chat', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const topic = req.body?.topic ? String(req.body.topic).trim().slice(0, 200) : undefined;
    const { conversation, messages } = ensureClientSupportConversation(
      authCtx.token.uid,
      authCtx.token.name,
      topic
    );
    return res.json({ success: true, conversation, messages });
  });

  // --------------------------------------------------------------------------
  // POST /api/client/ws-ticket — Ticket éphémère HMAC (60s, usage unique) pour WebSockets
  // --------------------------------------------------------------------------
  app.post('/api/client/ws-ticket', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const ticketInfo = createWsTicket(authCtx);
    return res.json({ success: true, ...ticketInfo });
  });

  // --------------------------------------------------------------------------
  // PUT /api/client/interactions & DELETE /api/client/viewing-history
  // --------------------------------------------------------------------------
  app.put('/api/client/interactions', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const uid = authCtx.token.uid;
    const current = getOrInitInteractions(uid);
    const body = req.body || {};

    const next: ClientInteractions = {
      likedVideoIds: Array.isArray(body.likedVideoIds) ? body.likedVideoIds.map(String) : current.likedVideoIds,
      savedVideoIds: Array.isArray(body.savedVideoIds) ? body.savedVideoIds.map(String) : current.savedVideoIds,
      followingSellerIds: Array.isArray(body.followingSellerIds)
        ? body.followingSellerIds.map(String)
        : current.followingSellerIds,
      blockedSellerIds: Array.isArray(body.blockedSellerIds)
        ? body.blockedSellerIds.map(String)
        : current.blockedSellerIds,
      taggedItemIds: Array.isArray(body.taggedItemIds) ? body.taggedItemIds.map(String) : current.taggedItemIds,
      viewingHistory: Array.isArray(body.viewingHistory) ? body.viewingHistory.slice(0, 300) : current.viewingHistory,
      tryOnHistory: Array.isArray(body.tryOnHistory) ? body.tryOnHistory.slice(0, 100) : current.tryOnHistory,
      searchHistory: Array.isArray(body.searchHistory) ? body.searchHistory.map(String).slice(0, 50) : current.searchHistory,
      updatedAt: new Date().toISOString()
    };

    clientStore.interactions[uid] = next;
    persistClientStore();
    return res.json({ success: true, interactions: next });
  });

  app.delete('/api/client/viewing-history/:videoId?', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const uid = authCtx.token.uid;
    const current = getOrInitInteractions(uid);
    const videoId = req.params.videoId ? String(req.params.videoId) : null;
    current.viewingHistory = videoId
      ? current.viewingHistory.filter((h) => h.videoId !== videoId)
      : [];
    current.updatedAt = new Date().toISOString();
    clientStore.interactions[uid] = current;
    persistClientStore();
    return res.json({ success: true, viewingHistory: current.viewingHistory });
  });

  // --------------------------------------------------------------------------
  // Avis clients vérifiés (commandes réelles livrées uniquement, 1 avis / cible)
  // --------------------------------------------------------------------------
  const handleCreateVerifiedReview = (
    req: Request,
    res: Response,
    authCtx: AuthenticatedRequestContext,
    options: { expectedSellerId?: string; requireProductAndComment?: boolean }
  ) => {
    const orderId = String(req.params.orderId || req.body?.orderId || '').trim();
    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'ORDER_ID_REQUIRED',
        message: 'Identifiant de commande requis.'
      });
    }

    const order = commerceDb.orders.find((o) => o.id === orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: 'Commande introuvable.'
      });
    }
    if (order.clientId !== authCtx.token.uid) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN_ORDER_REVIEW',
        message: 'Seul le client ayant passé cette commande peut laisser un avis.'
      });
    }

    if (options.expectedSellerId) {
      const belongsToSeller =
        order.sellerId === options.expectedSellerId ||
        order.items.some((item) => item.sellerId === options.expectedSellerId);
      if (!belongsToSeller) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN_SELLER_ORDER',
          message: 'Cette commande ne concerne pas la boutique sélectionnée.'
        });
      }
    }

    if (order.status === 'cancelled') {
      return res.status(403).json({
        success: false,
        error: 'ORDER_CANCELLED_NO_REVIEW',
        message: 'Impossible de déposer un avis sur une commande annulée.'
      });
    }

    if (order.status !== 'delivered' || order.paymentStatus === 'refunded' || order.paymentStatus === 'failed') {
      return res.status(400).json({
        success: false,
        error: 'ORDER_NOT_DELIVERED',
        message: 'Vous pourrez évaluer cette commande une fois qu’elle sera livrée.'
      });
    }

    const requestedProductId = req.body?.productId ? String(req.body.productId).trim() : '';
    if (options.requireProductAndComment && !requestedProductId) {
      return res.status(400).json({
        success: false,
        error: 'PRODUCT_ID_REQUIRED',
        message: 'Veuillez sélectionner un produit commandé dans cette boutique.'
      });
    }

    const targetItem = requestedProductId
      ? order.items.find((i) => i.productId === requestedProductId)
      : order.items[0];

    if (requestedProductId && !targetItem) {
      return res.status(403).json({
        success: false,
        error: 'PRODUCT_NOT_IN_ORDER',
        message: 'Vous ne pouvez évaluer que les produits réellement commandés.'
      });
    }

    const effectiveSellerId = options.expectedSellerId || targetItem?.sellerId || order.sellerId;
    if (options.expectedSellerId && targetItem?.sellerId && targetItem.sellerId !== options.expectedSellerId) {
      return res.status(403).json({
        success: false,
        error: 'SELLER_PRODUCT_MISMATCH',
        message: 'Ce produit n’appartient pas à la boutique sélectionnée.'
      });
    }

    const rawRating = Number(req.body?.rating);
    if (!Number.isFinite(rawRating) || rawRating < 1 || rawRating > 5) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_RATING',
        message: 'Note entre 1 et 5 requise.'
      });
    }
    const rating = Math.round(rawRating);
    const comment = String(req.body?.comment || '').trim().slice(0, 1500);
    if (options.requireProductAndComment && comment.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'COMMENT_REQUIRED',
        message: 'Veuillez saisir un commentaire d’au moins 3 caractères.'
      });
    }

    const targetProductId = targetItem?.productId || requestedProductId || undefined;
    const duplicate = clientStore.reviews.find((r) => {
      if (r.orderId !== order.id || r.userId !== authCtx.token.uid) return false;
      if (targetProductId) {
        return !r.productId || r.productId === targetProductId;
      }
      return true;
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: 'REVIEW_ALREADY_SUBMITTED',
        message: 'Vous avez déjà publié un avis vérifié pour cet article sur cette commande.'
      });
    }

    const review: ClientOrderReview = {
      id: `rev-${crypto.randomUUID().slice(0, 10)}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: authCtx.token.uid,
      sellerId: effectiveSellerId,
      productId: targetProductId,
      productTitle: targetItem?.productTitle,
      productImage: targetItem?.productImage,
      clientName: order.deliveryAddress?.recipientName || order.clientName || authCtx.token.name || 'Client vérifié',
      clientCommune: order.deliveryAddress?.commune ? `${order.deliveryAddress.commune}, Abidjan` : 'Abidjan',
      verifiedPurchase: true,
      rating,
      comment,
      createdAt: new Date().toISOString()
    };

    clientStore.reviews.unshift(review);

    if (targetProductId) {
      const prod = commerceDb.products.find((p) => p.id === targetProductId);
      if (prod) {
        prod.reviewsCount = (prod.reviewsCount || 0) + 1;
      }
    } else {
      for (const item of order.items) {
        const prod = commerceDb.products.find((p) => p.id === item.productId);
        if (prod) {
          prod.reviewsCount = (prod.reviewsCount || 0) + 1;
        }
      }
    }
    persistCommerceDb();
    persistClientStore();

    return res.status(201).json({ success: true, review });
  };

  app.post('/api/client/orders/:orderId/review', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    return handleCreateVerifiedReview(req, res, authCtx, { requireProductAndComment: false });
  });

  app.get('/api/client/sellers/:sellerId/reviews', (req: Request, res: Response) => {
    const sellerId = String(req.params.sellerId || '').trim();
    if (!sellerId) {
      return res.status(400).json({ success: false, error: 'SELLER_ID_REQUIRED' });
    }

    const sellerReviews = clientStore.reviews.filter((r) => r.sellerId === sellerId);
    const token = extractBearerToken(req);
    const activeSession = token
      ? securityDb.sessions.find(
          (s) => s.sessionId === token.sid && s.status !== 'revoked' && s.status !== 'expired'
        )
      : null;

    const orderedProducts: Array<{
      orderId: string;
      orderNumber: string;
      orderDate: string;
      deliveryDate?: string;
      orderStatus: string;
      productId: string;
      productTitle: string;
      productImage: string;
      alreadyReviewed: boolean;
      canReview: boolean;
      ineligibleReason?: string;
      existingReview?: ClientOrderReview;
    }> = [];

    if (token && activeSession) {
      const clientOrders = commerceDb.orders.filter(
        (o) =>
          o.clientId === token.uid &&
          o.status !== 'cancelled' &&
          (o.sellerId === sellerId || o.items.some((item) => item.sellerId === sellerId))
      );

      for (const order of clientOrders) {
        const matchingItems = order.items.filter(
          (item) => (item.sellerId || order.sellerId) === sellerId
        );
        for (const item of matchingItems) {
          const existingReview = clientStore.reviews.find(
            (r) =>
              r.orderId === order.id &&
              r.userId === token.uid &&
              (!r.productId || r.productId === item.productId)
          );
          const alreadyReviewed = Boolean(existingReview);
          const isEligibleOrder =
            order.status !== 'cancelled' &&
            order.paymentStatus !== 'refunded' &&
            order.paymentStatus !== 'failed';
          const canReview = isEligibleOrder && !alreadyReviewed;

          orderedProducts.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            orderDate: order.createdAt,
            deliveryDate: order.updatedAt || order.createdAt,
            orderStatus: 'Commande confirmée',
            productId: item.productId,
            productTitle: item.productTitle,
            productImage: item.productImage || '',
            alreadyReviewed,
            canReview,
            ineligibleReason: alreadyReviewed
              ? 'Avis déjà déposé'
              : !isEligibleOrder
              ? 'Commande non éligible'
              : undefined,
            existingReview
          });
        }
      }
    }

    const avgRating =
      sellerReviews.length > 0
        ? Number(
            (
              sellerReviews.reduce((acc, r) => acc + r.rating, 0) / sellerReviews.length
            ).toFixed(1)
          )
        : null;

    return res.json({
      success: true,
      reviews: sellerReviews,
      summary: {
        count: sellerReviews.length,
        avgRating
      },
      orderedProducts,
      canSubmitReview: orderedProducts.some((item) => item.canReview)
    });
  });

  app.post('/api/client/sellers/:sellerId/reviews', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const sellerId = String(req.params.sellerId || '').trim();
    return handleCreateVerifiedReview(req, res, authCtx, {
      expectedSellerId: sellerId,
      requireProductAndComment: true
    });
  });

  app.get('/api/client/notifications/preferences', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const prefs = getOrInitPreferences(authCtx.token.uid);
    return res.json({ success: true, notifications: prefs.notifications });
  });

  app.patch('/api/client/notifications/preferences', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const uid = authCtx.token.uid;
    const current = getOrInitPreferences(uid);
    const body = req.body || {};
    const nextOrderUpdates =
      typeof body.orderUpdates === 'boolean'
        ? body.orderUpdates
        : typeof body.ordersUpdates === 'boolean'
        ? body.ordersUpdates
        : undefined;
    current.notifications = {
      ...current.notifications,
      ...(typeof body.pushEnabled === 'boolean' ? { pushEnabled: body.pushEnabled } : {}),
      ...(nextOrderUpdates !== undefined ? { orderUpdates: nextOrderUpdates } : {}),
      ...(typeof body.promotions === 'boolean' ? { promotions: body.promotions } : {}),
      ...(typeof body.liveStreams === 'boolean' ? { liveStreams: body.liveStreams } : {}),
      ...(typeof body.messages === 'boolean' ? { messages: body.messages } : {}),
      ...(typeof body.newFollowers === 'boolean' ? { newFollowers: body.newFollowers } : {}),
      ...(typeof body.emailDigest === 'boolean' ? { emailDigest: body.emailDigest } : {}),
      ...(typeof body.smsAlerts === 'boolean' ? { smsAlerts: body.smsAlerts } : {})
    };
    current.updatedAt = new Date().toISOString();
    clientStore.preferences[uid] = current;
    persistClientStore();
    void upsertPgNotificationPreferences(uid, {
      pushEnabled: current.notifications.pushEnabled,
      orderUpdates: current.notifications.orderUpdates,
      deliveryUpdates: typeof body.deliveryAlerts === 'boolean' ? body.deliveryAlerts : current.notifications.orderUpdates,
      messagesEnabled: current.notifications.messages,
      marketingEnabled: current.notifications.promotions
    });
    return res.json({ success: true, notifications: current.notifications });
  });

  app.post('/api/client/push-tokens', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;
    const { token, platform = 'web', provider = 'web_push', deviceLabel } = req.body || {};
    const rawToken = String(token || '').trim();
    if (rawToken.length < 12) {
      return res.status(400).json({ success: false, error: 'INVALID_PUSH_TOKEN' });
    }
    const normPlatform = platform === 'android' || platform === 'ios' ? platform : 'web';
    const normProvider = provider === 'fcm' || provider === 'apns' ? provider : 'web_push';
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const encrypted = encryptSecretValue(rawToken);
    const uid = authCtx.token.uid;
    const list = clientStore.pushTokens[uid] || [];
    const existing = list.find((s) => s.tokenHash === tokenHash);
    if (!existing) {
      list.unshift({
        id: `pt-${crypto.randomUUID().slice(0, 10)}`,
        userId: uid,
        platform: normPlatform,
        provider: normProvider,
        tokenHash,
        secretCiphertext: encrypted.ciphertext,
        secretKeyVersion: encrypted.keyVersion,
        ...(deviceLabel ? { deviceLabel: String(deviceLabel).slice(0, 80) } : {}),
        createdAt: new Date().toISOString()
      });
      if (list.length > 20) list.length = 20;
      clientStore.pushTokens[uid] = list;
      persistClientStore();
    }
    void registerPgPushToken({
      userId: uid,
      platform: normPlatform,
      provider: normProvider,
      rawToken,
      deviceLabel: deviceLabel ? String(deviceLabel).slice(0, 80) : undefined
    });
    return res.status(201).json({
      success: true,
      registered: true,
      tokenHashPrefix: tokenHash.slice(0, 12),
      platform: normPlatform,
      provider: normProvider
    });
  });

  // --------------------------------------------------------------------------
  // VISITOR QUOTA & ATOMIC GUEST -> ACCOUNT MERGE
  // --------------------------------------------------------------------------
  app.get('/api/client/visitor-quota', (req: Request, res: Response) => {
    const guestIdHeader = req.headers['x-guest-id'];
    const guestId =
      typeof guestIdHeader === 'string'
        ? guestIdHeader
        : typeof req.query.guestId === 'string'
        ? req.query.guestId
        : '';
    const aiQuota = checkGuestAiQuota(guestId, getClientIp(req));
    return res.json({
      success: true,
      limits: VISITOR_QUOTAS,
      ai: aiQuota
    });
  });

  app.post('/api/client/guest-merge', (req: Request, res: Response) => {
    const authCtx = authenticateSessionRequest(req, res);
    if (!authCtx) return;

    const uid = authCtx.token.uid;
    const body = req.body || {};
    const nowIso = new Date().toISOString();

    // 1. Merge interactions without duplicates or data loss
    const currentInteractions = getOrInitInteractions(uid);
    const incomingLikes: string[] = Array.isArray(body.likedVideoIds)
      ? body.likedVideoIds.map((id: unknown) => String(id || '').trim()).filter(Boolean).slice(0, 200)
      : [];
    const incomingSaves: string[] = Array.isArray(body.savedVideoIds)
      ? body.savedVideoIds.map((id: unknown) => String(id || '').trim()).filter(Boolean).slice(0, 200)
      : [];
    const incomingSearches: string[] = Array.isArray(body.searchHistory)
      ? body.searchHistory.map((q: unknown) => String(q || '').trim()).filter(Boolean).slice(0, 50)
      : [];

    const mergedLikes = Array.from(new Set([...currentInteractions.likedVideoIds, ...incomingLikes]));
    const mergedSaves = Array.from(new Set([...currentInteractions.savedVideoIds, ...incomingSaves]));
    const mergedSearchLower = new Set(currentInteractions.searchHistory.map((q) => q.toLowerCase()));
    const mergedSearchHistory = [...currentInteractions.searchHistory];
    for (const q of incomingSearches) {
      if (!mergedSearchLower.has(q.toLowerCase())) {
        mergedSearchLower.add(q.toLowerCase());
        mergedSearchHistory.push(q);
      }
    }

    const historyByVideo = new Map<string, ClientViewingHistoryEntry>();
    for (const item of currentInteractions.viewingHistory) {
      if (item?.videoId) historyByVideo.set(item.videoId, item);
    }
    if (Array.isArray(body.viewingHistory)) {
      for (const raw of body.viewingHistory.slice(0, 200)) {
        const videoId = String(raw?.videoId || '').trim();
        if (!videoId) continue;
        const existing = historyByVideo.get(videoId);
        const watchedAt = String(raw?.watchedAt || nowIso);
        const durationSec = Math.max(0, Number(raw?.durationSec) || 0);
        const completed = Boolean(raw?.completed);
        if (!existing) {
          historyByVideo.set(videoId, { videoId, watchedAt, durationSec, completed });
        } else {
          historyByVideo.set(videoId, {
            videoId,
            watchedAt: watchedAt > existing.watchedAt ? watchedAt : existing.watchedAt,
            durationSec: Math.max(existing.durationSec, durationSec),
            completed: existing.completed || completed
          });
        }
      }
    }
    const mergedViewingHistory = Array.from(historyByVideo.values())
      .sort((a, b) => (b.watchedAt > a.watchedAt ? 1 : -1))
      .slice(0, 300);

    const nextInteractions: ClientInteractions = {
      ...currentInteractions,
      likedVideoIds: mergedLikes,
      savedVideoIds: mergedSaves,
      searchHistory: mergedSearchHistory.slice(0, 50),
      viewingHistory: mergedViewingHistory,
      updatedAt: nowIso
    };
    clientStore.interactions[uid] = nextInteractions;

    // 2. Conservatively merge safe preferences (content/display/dataSaver) without overwriting account security/addresses
    const hadExistingPrefs = Boolean(clientStore.preferences[uid]);
    const currentPrefs = getOrInitPreferences(uid);
    const guestPrefs = body.preferences && typeof body.preferences === 'object' ? body.preferences : null;
    if (guestPrefs) {
      const favCats = Array.from(
        new Set([
          ...(currentPrefs.contentPreferences?.favoriteCategories || []),
          ...(Array.isArray(guestPrefs.contentPreferences?.favoriteCategories)
            ? guestPrefs.contentPreferences.favoriteCategories.map(String)
            : [])
        ])
      ).slice(0, 30);
      const mutedKw = Array.from(
        new Set([
          ...(currentPrefs.contentPreferences?.mutedKeywords || []),
          ...(Array.isArray(guestPrefs.contentPreferences?.mutedKeywords)
            ? guestPrefs.contentPreferences.mutedKeywords.map(String)
            : [])
        ])
      ).slice(0, 50);

      clientStore.preferences[uid] = {
        ...currentPrefs,
        ...(!hadExistingPrefs && guestPrefs.display
          ? {
              display: {
                theme: guestPrefs.display.theme === 'light' ? 'light' : 'dark',
                fontSize: ['small', 'normal', 'large'].includes(guestPrefs.display.fontSize)
                  ? guestPrefs.display.fontSize
                  : currentPrefs.display.fontSize,
                reduceMotion:
                  typeof guestPrefs.display.reduceMotion === 'boolean'
                    ? guestPrefs.display.reduceMotion
                    : currentPrefs.display.reduceMotion
              }
            }
          : {}),
        ...(!hadExistingPrefs && typeof guestPrefs.language === 'string' && guestPrefs.language.trim()
          ? { language: guestPrefs.language.trim().slice(0, 12) }
          : {}),
        ...(!hadExistingPrefs && guestPrefs.dataSaver
          ? { dataSaver: { ...currentPrefs.dataSaver, ...guestPrefs.dataSaver } }
          : {}),
        contentPreferences: {
          favoriteCategories: favCats,
          mutedKeywords: mutedKw
        },
        updatedAt: nowIso
      };
    }

    // 3. Idempotent merge of temporary guest AI conversation
    const existingAiList = clientStore.aiConversations[uid] || [];
    const incomingAi = body.aiConversation;
    if (incomingAi && Array.isArray(incomingAi.messages) && incomingAi.messages.length > 0) {
      const convId = String(incomingAi.id || `guest-ai-${uid}`).slice(0, 120);
      const alreadyMerged = existingAiList.some((c) => c.id === convId);
      if (!alreadyMerged) {
        const sanitizedMessages: ClientAiMessage[] = incomingAi.messages.slice(-100).map((m: any) => ({
          id: String(m?.id || crypto.randomUUID()),
          sender: m?.sender === 'ai' ? 'ai' : 'user',
          text: String(m?.text || '').slice(0, 8000),
          ...(Array.isArray(m?.attachedImages)
            ? { attachedImages: m.attachedImages.filter((s: unknown) => typeof s === 'string').slice(0, 3) }
            : {}),
          ...(Array.isArray(m?.products) ? { products: m.products.slice(0, 12) } : {}),
          timestamp: String(m?.timestamp || nowIso)
        }));
        existingAiList.unshift({
          id: convId,
          title: String(incomingAi.title || 'Discussion visiteur').trim().slice(0, 120) || 'Discussion visiteur',
          dateLabel: String(incomingAi.dateLabel || "Aujourd'hui"),
          updatedAt: String(incomingAi.updatedAt || nowIso),
          messages: sanitizedMessages
        });
        clientStore.aiConversations[uid] = existingAiList.slice(0, 50);
      }
    }

    persistClientStore();
    return res.json({
      success: true,
      merged: true,
      interactions: clientStore.interactions[uid],
      preferences: getOrInitPreferences(uid),
      aiConversations: clientStore.aiConversations[uid] || []
    });
  });
}
