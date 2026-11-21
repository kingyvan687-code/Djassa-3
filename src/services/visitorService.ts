import { VISITOR_QUOTAS, getLocalDateKey } from '../config/visitorQuotas';
import type { ClientAiConversationDTO, ClientPreferencesDTO } from './clientService';

const GUEST_STORAGE_KEY = 'djassa_guest_session_v1';

export const DEFAULT_VISITOR_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#FF6321"/><stop offset="100%" stop-color="#1E1E24"/>' +
      '</linearGradient></defs>' +
      '<rect width="120" height="120" rx="60" fill="url(#g)"/>' +
      '<circle cx="60" cy="45" r="20" fill="#FFFFFF" fill-opacity="0.92"/>' +
      '<path d="M24 104c4-22 20-32 36-32s32 10 36 32" fill="#FFFFFF" fill-opacity="0.92"/>' +
    '</svg>'
  );

export interface GuestViewingHistoryItem {
  videoId: string;
  viewedAt: string;
  watchDurationSec: number;
  completionRate: number;
}

export interface GuestAiMessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  attachedImages?: string[];
  matchedProductIds?: string[];
  matchedSellerIds?: string[];
  thought?: string;
}

export interface GuestSessionState {
  guestId: string;
  dateKey: string;
  likedVideoIds: string[];
  dailyLikeConsumedIds: string[];
  savedProductIds: string[];
  dailyFavoriteConsumedIds: string[];
  viewingHistory: GuestViewingHistoryItem[];
  searchHistory: string[];
  aiQuestionsUsedToday: number;
  aiConversation: {
    id: string;
    title: string;
    updatedAt: string;
    messages: GuestAiMessageItem[];
  } | null;
  preferences: Partial<ClientPreferencesDTO> | null;
  updatedAt: string;
}

export interface GuestQuotaSnapshot {
  dateKey: string;
  likes: { used: number; limit: number; remaining: number };
  favorites: { used: number; limit: number; remaining: number };
  ai: { used: number; limit: number; remaining: number };
}

function generateGuestId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `guest-${crypto.randomUUID()}`;
    }
  } catch {
    // ignore fallback
  }
  return `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createInitialGuestState(existingGuestId?: string): GuestSessionState {
  const nowIso = new Date().toISOString();
  return {
    guestId: existingGuestId || generateGuestId(),
    dateKey: getLocalDateKey(),
    likedVideoIds: [],
    dailyLikeConsumedIds: [],
    savedProductIds: [],
    dailyFavoriteConsumedIds: [],
    viewingHistory: [],
    searchHistory: [],
    aiQuestionsUsedToday: 0,
    aiConversation: null,
    preferences: null,
    updatedAt: nowIso
  };
}

function readRawGuestState(): GuestSessionState {
  const today = getLocalDateKey();
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createInitialGuestState();
    }
    const raw = window.localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) {
      const fresh = createInitialGuestState();
      writeRawGuestState(fresh);
      return fresh;
    }
    const parsed = JSON.parse(raw) as Partial<GuestSessionState>;
    const guestId =
      typeof parsed?.guestId === 'string' && parsed.guestId.startsWith('guest-')
        ? parsed.guestId
        : generateGuestId();

    const isSameDay = parsed?.dateKey === today;
    const normalized: GuestSessionState = {
      guestId,
      dateKey: today,
      likedVideoIds: Array.isArray(parsed?.likedVideoIds) ? Array.from(new Set(parsed.likedVideoIds.map(String))) : [],
      dailyLikeConsumedIds: isSameDay && Array.isArray(parsed?.dailyLikeConsumedIds)
        ? Array.from(new Set(parsed.dailyLikeConsumedIds.map(String)))
        : [],
      savedProductIds: Array.isArray(parsed?.savedProductIds)
        ? Array.from(new Set(parsed.savedProductIds.map(String)))
        : [],
      dailyFavoriteConsumedIds: isSameDay && Array.isArray(parsed?.dailyFavoriteConsumedIds)
        ? Array.from(new Set(parsed.dailyFavoriteConsumedIds.map(String)))
        : [],
      viewingHistory: Array.isArray(parsed?.viewingHistory) ? parsed.viewingHistory.slice(0, 200) : [],
      searchHistory: Array.isArray(parsed?.searchHistory) ? parsed.searchHistory.map(String).slice(0, 50) : [],
      aiQuestionsUsedToday:
        isSameDay && typeof parsed?.aiQuestionsUsedToday === 'number' && Number.isFinite(parsed.aiQuestionsUsedToday)
          ? Math.max(0, Math.min(VISITOR_QUOTAS.dailyAiQuestions, Math.floor(parsed.aiQuestionsUsedToday)))
          : 0,
      aiConversation: parsed?.aiConversation && Array.isArray(parsed.aiConversation.messages)
        ? {
            id: String(parsed.aiConversation.id || `guest-ai-${guestId}`),
            title: String(parsed.aiConversation.title || 'Discussion visiteur'),
            updatedAt: String(parsed.aiConversation.updatedAt || new Date().toISOString()),
            messages: parsed.aiConversation.messages.slice(-100)
          }
        : null,
      preferences: parsed?.preferences && typeof parsed.preferences === 'object' ? parsed.preferences : null,
      updatedAt: String(parsed?.updatedAt || new Date().toISOString())
    };
    if (!isSameDay || normalized.guestId !== parsed?.guestId) {
      writeRawGuestState(normalized);
    }
    return normalized;
  } catch {
    const fresh = createInitialGuestState();
    writeRawGuestState(fresh);
    return fresh;
  }
}

function writeRawGuestState(state: GuestSessionState): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        GUEST_STORAGE_KEY,
        JSON.stringify({
          ...state,
          updatedAt: new Date().toISOString()
        })
      );
    }
  } catch {
    // ignore storage quota errors
  }
}

export const visitorService = {
  getState(): GuestSessionState {
    return readRawGuestState();
  },

  getGuestId(): string {
    return readRawGuestState().guestId;
  },

  getQuotaSnapshot(): GuestQuotaSnapshot {
    const s = readRawGuestState();
    const likesUsed = s.dailyLikeConsumedIds.length;
    const favsUsed = s.dailyFavoriteConsumedIds.length;
    const aiUsed = s.aiQuestionsUsedToday;
    return {
      dateKey: s.dateKey,
      likes: {
        used: likesUsed,
        limit: VISITOR_QUOTAS.dailyLikes,
        remaining: Math.max(0, VISITOR_QUOTAS.dailyLikes - likesUsed)
      },
      favorites: {
        used: favsUsed,
        limit: VISITOR_QUOTAS.dailyFavorites,
        remaining: Math.max(0, VISITOR_QUOTAS.dailyFavorites - favsUsed)
      },
      ai: {
        used: aiUsed,
        limit: VISITOR_QUOTAS.dailyAiQuestions,
        remaining: Math.max(0, VISITOR_QUOTAS.dailyAiQuestions - aiUsed)
      }
    };
  },

  /**
   * Like/Unlike visiteur avec anti-contournement strict :
   * - Unliker un produit NE libère JAMAIS un slot journalier déjà consommé.
   * - Dépasser 10 likes distincts/actions sur la journée est bloqué.
   */
  toggleGuestLike(productId: string): {
    allowed: boolean;
    isLikedNow: boolean;
    likedVideoIds: string[];
    used: number;
    limit: number;
    remaining: number;
  } {
    const s = readRawGuestState();
    const currentlyLiked = s.likedVideoIds.includes(productId);

    if (currentlyLiked) {
      const nextLiked = s.likedVideoIds.filter((id) => id !== productId);
      const nextState: GuestSessionState = {
        ...s,
        likedVideoIds: nextLiked
      };
      writeRawGuestState(nextState);
      return {
        allowed: true,
        isLikedNow: false,
        likedVideoIds: nextLiked,
        used: nextState.dailyLikeConsumedIds.length,
        limit: VISITOR_QUOTAS.dailyLikes,
        remaining: Math.max(0, VISITOR_QUOTAS.dailyLikes - nextState.dailyLikeConsumedIds.length)
      };
    }

    const alreadyConsumedToday = s.dailyLikeConsumedIds.includes(productId);
    const usedCount = s.dailyLikeConsumedIds.length;
    if (!alreadyConsumedToday && usedCount >= VISITOR_QUOTAS.dailyLikes) {
      return {
        allowed: false,
        isLikedNow: false,
        likedVideoIds: s.likedVideoIds,
        used: usedCount,
        limit: VISITOR_QUOTAS.dailyLikes,
        remaining: 0
      };
    }

    const nextLiked = Array.from(new Set([...s.likedVideoIds, productId]));
    const nextConsumed = alreadyConsumedToday
      ? s.dailyLikeConsumedIds
      : [...s.dailyLikeConsumedIds, productId];
    const nextState: GuestSessionState = {
      ...s,
      likedVideoIds: nextLiked,
      dailyLikeConsumedIds: nextConsumed
    };
    writeRawGuestState(nextState);
    return {
      allowed: true,
      isLikedNow: true,
      likedVideoIds: nextLiked,
      used: nextConsumed.length,
      limit: VISITOR_QUOTAS.dailyLikes,
      remaining: Math.max(0, VISITOR_QUOTAS.dailyLikes - nextConsumed.length)
    };
  },

  /**
   * Favoris / Enregistrés visiteur avec anti-contournement strict (max 5/jour).
   */
  toggleGuestFavorite(productId: string): {
    allowed: boolean;
    isSavedNow: boolean;
    savedProductIds: string[];
    used: number;
    limit: number;
    remaining: number;
  } {
    const s = readRawGuestState();
    const currentlySaved = s.savedProductIds.includes(productId);

    if (currentlySaved) {
      const nextSaved = s.savedProductIds.filter((id) => id !== productId);
      const nextState: GuestSessionState = {
        ...s,
        savedProductIds: nextSaved
      };
      writeRawGuestState(nextState);
      return {
        allowed: true,
        isSavedNow: false,
        savedProductIds: nextSaved,
        used: nextState.dailyFavoriteConsumedIds.length,
        limit: VISITOR_QUOTAS.dailyFavorites,
        remaining: Math.max(0, VISITOR_QUOTAS.dailyFavorites - nextState.dailyFavoriteConsumedIds.length)
      };
    }

    const alreadyConsumedToday = s.dailyFavoriteConsumedIds.includes(productId);
    const usedCount = s.dailyFavoriteConsumedIds.length;
    if (!alreadyConsumedToday && usedCount >= VISITOR_QUOTAS.dailyFavorites) {
      return {
        allowed: false,
        isSavedNow: false,
        savedProductIds: s.savedProductIds,
        used: usedCount,
        limit: VISITOR_QUOTAS.dailyFavorites,
        remaining: 0
      };
    }

    const nextSaved = Array.from(new Set([...s.savedProductIds, productId]));
    const nextConsumed = alreadyConsumedToday
      ? s.dailyFavoriteConsumedIds
      : [...s.dailyFavoriteConsumedIds, productId];
    const nextState: GuestSessionState = {
      ...s,
      savedProductIds: nextSaved,
      dailyFavoriteConsumedIds: nextConsumed
    };
    writeRawGuestState(nextState);
    return {
      allowed: true,
      isSavedNow: true,
      savedProductIds: nextSaved,
      used: nextConsumed.length,
      limit: VISITOR_QUOTAS.dailyFavorites,
      remaining: Math.max(0, VISITOR_QUOTAS.dailyFavorites - nextConsumed.length)
    };
  },

  canAskAi(): { allowed: boolean; used: number; limit: number; remaining: number } {
    const s = readRawGuestState();
    const used = s.aiQuestionsUsedToday;
    return {
      allowed: used < VISITOR_QUOTAS.dailyAiQuestions,
      used,
      limit: VISITOR_QUOTAS.dailyAiQuestions,
      remaining: Math.max(0, VISITOR_QUOTAS.dailyAiQuestions - used)
    };
  },

  recordGuestAiQuestion(forcedServerUsed?: number): { used: number; limit: number; remaining: number } {
    const s = readRawGuestState();
    const nextUsed =
      typeof forcedServerUsed === 'number' && Number.isFinite(forcedServerUsed)
        ? Math.max(s.aiQuestionsUsedToday, Math.min(VISITOR_QUOTAS.dailyAiQuestions, Math.floor(forcedServerUsed)))
        : Math.min(VISITOR_QUOTAS.dailyAiQuestions, s.aiQuestionsUsedToday + 1);
    writeRawGuestState({
      ...s,
      aiQuestionsUsedToday: nextUsed
    });
    return {
      used: nextUsed,
      limit: VISITOR_QUOTAS.dailyAiQuestions,
      remaining: Math.max(0, VISITOR_QUOTAS.dailyAiQuestions - nextUsed)
    };
  },

  markGuestAiExhausted(): void {
    const s = readRawGuestState();
    writeRawGuestState({
      ...s,
      aiQuestionsUsedToday: VISITOR_QUOTAS.dailyAiQuestions
    });
  },

  getGuestAiConversation() {
    return readRawGuestState().aiConversation;
  },

  saveGuestAiConversation(title: string, messages: GuestAiMessageItem[]): void {
    const s = readRawGuestState();
    writeRawGuestState({
      ...s,
      aiConversation: {
        id: s.aiConversation?.id || `guest-ai-${s.guestId}`,
        title: title.trim().slice(0, 120) || 'Discussion visiteur',
        updatedAt: new Date().toISOString(),
        messages: messages.slice(-100)
      }
    });
  },

  clearGuestAiConversation(): void {
    const s = readRawGuestState();
    writeRawGuestState({
      ...s,
      aiConversation: null
    });
  },

  recordGuestView(videoId: string, watchDurationSec: number, completionRate: number): GuestViewingHistoryItem[] {
    const s = readRawGuestState();
    const existing = s.viewingHistory.find((h) => h.videoId === videoId);
    const nextEntry: GuestViewingHistoryItem = {
      videoId,
      viewedAt: new Date().toISOString(),
      watchDurationSec: Math.max(existing?.watchDurationSec || 0, watchDurationSec),
      completionRate: Math.max(existing?.completionRate || 0, completionRate)
    };
    const nextHistory = [nextEntry, ...s.viewingHistory.filter((h) => h.videoId !== videoId)].slice(0, 200);
    writeRawGuestState({
      ...s,
      viewingHistory: nextHistory
    });
    return nextHistory;
  },

  removeGuestHistoryItem(videoId: string): GuestViewingHistoryItem[] {
    const s = readRawGuestState();
    const nextHistory = s.viewingHistory.filter((h) => h.videoId !== videoId);
    writeRawGuestState({
      ...s,
      viewingHistory: nextHistory
    });
    return nextHistory;
  },

  clearGuestHistory(): void {
    const s = readRawGuestState();
    writeRawGuestState({
      ...s,
      viewingHistory: [],
      searchHistory: []
    });
  },

  recordGuestSearch(query: string): string[] {
    const normalized = query.trim();
    const s = readRawGuestState();
    if (!normalized) return s.searchHistory;
    const nextSearches = [
      normalized,
      ...s.searchHistory.filter((q) => q.toLowerCase() !== normalized.toLowerCase())
    ].slice(0, 50);
    writeRawGuestState({
      ...s,
      searchHistory: nextSearches
    });
    return nextSearches;
  },

  saveGuestPreferences(prefs: Partial<ClientPreferencesDTO>): void {
    const s = readRawGuestState();
    writeRawGuestState({
      ...s,
      preferences: prefs
    });
  },

  getMergePayload(): {
    guestId: string;
    likedVideoIds: string[];
    savedVideoIds: string[];
    viewingHistory: Array<{ videoId: string; watchedAt: string; durationSec: number; completed: boolean }>;
    searchHistory: string[];
    preferences: Partial<ClientPreferencesDTO> | null;
    aiConversation: ClientAiConversationDTO | null;
  } | null {
    const s = readRawGuestState();
    const hasAi = Boolean(s.aiConversation && s.aiConversation.messages.length > 0);
    const hasData =
      s.likedVideoIds.length > 0 ||
      s.savedProductIds.length > 0 ||
      s.viewingHistory.length > 0 ||
      s.searchHistory.length > 0 ||
      Boolean(s.preferences) ||
      hasAi;

    if (!hasData) return null;

    return {
      guestId: s.guestId,
      likedVideoIds: s.likedVideoIds,
      savedVideoIds: s.savedProductIds,
      viewingHistory: s.viewingHistory.map((h) => ({
        videoId: h.videoId,
        watchedAt: h.viewedAt,
        durationSec: h.watchDurationSec,
        completed: h.completionRate >= 0.85
      })),
      searchHistory: s.searchHistory,
      preferences: s.preferences,
      aiConversation: hasAi && s.aiConversation
        ? {
            id: s.aiConversation.id,
            title: s.aiConversation.title,
            dateLabel: "Aujourd'hui",
            updatedAt: s.aiConversation.updatedAt,
            messages: s.aiConversation.messages.map((m) => ({
              id: m.id,
              sender: m.sender === 'user' ? 'user' : 'ai',
              text: m.text,
              attachedImages: m.attachedImages,
              products: (m.matchedProductIds || []).map((id) => ({ id })),
              timestamp: m.timestamp
            }))
          }
        : null
    };
  },

  clearAfterMerge(): void {
    const prev = readRawGuestState();
    writeRawGuestState(createInitialGuestState(prev.guestId));
  }
};
