import { apiJsonFetch } from './httpClient';

export interface ClientPreferencesDTO {
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
  updatedAt?: string;
}

export interface ClientAiConversationDTO {
  id: string;
  title: string;
  dateLabel: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    sender: 'user' | 'ai';
    text: string;
    attachedImages?: string[];
    products?: Array<Record<string, unknown>>;
    timestamp: string;
  }>;
}

export interface ClientTicketDTO {
  id: string;
  userId: string;
  userEmail: string;
  ticketType: 'problem' | 'fraud' | 'claim';
  category: string;
  description: string;
  orderId?: string;
  contactEmail?: string;
  status: 'pending' | 'in_review' | 'resolved';
  attachments: Array<{
    id: string;
    name: string;
    mimeType: string;
    size: number;
    dataUrl: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ClientSessionDTO {
  sessionId: string;
  device: string;
  browser: string;
  os: string;
  location: string | null;
  startedAt: string;
  lastActivityAt: string;
  expiresAt: string;
  status: string;
  isCurrent: boolean;
}

export interface ClientBootstrapDTO {
  success: boolean;
  profile: {
    username?: string;
    bio?: string;
    avatar?: string;
    location?: string;
    commune?: string;
    quartier?: string;
    details?: string;
  } | null;
  preferences: ClientPreferencesDTO;
  aiConversations: ClientAiConversationDTO[];
  tickets: ClientTicketDTO[];
  interactions: {
    likedVideoIds: string[];
    savedVideoIds: string[];
    followingSellerIds: string[];
    blockedSellerIds: string[];
    taggedItemIds: string[];
    viewingHistory: Array<{ videoId: string; watchedAt: string; durationSec: number; completed: boolean }>;
    tryOnHistory: Array<Record<string, unknown>>;
    searchHistory: string[];
  };
  sessions: ClientSessionDTO[];
}

function apiJson<T>(url: string, options?: RequestInit): Promise<T> {
  return apiJsonFetch<T>(url, options);
}

export const clientService = {
  async bootstrap(): Promise<ClientBootstrapDTO> {
    return apiJson<ClientBootstrapDTO>('/api/client/bootstrap');
  },

  async updatePreferences(patch: Partial<ClientPreferencesDTO>): Promise<{ success: boolean; preferences: ClientPreferencesDTO }> {
    return apiJson('/api/client/preferences', {
      method: 'PUT',
      body: JSON.stringify(patch)
    });
  },

  async saveAiConversation(payload: {
    id?: string;
    title: string;
    dateLabel: string;
    messages: ClientAiConversationDTO['messages'];
  }): Promise<{ success: boolean; conversation: ClientAiConversationDTO; conversations: ClientAiConversationDTO[] }> {
    return apiJson('/api/client/ai-conversations', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async deleteAiConversation(id: string): Promise<{ success: boolean; conversations: ClientAiConversationDTO[] }> {
    return apiJson(`/api/client/ai-conversations/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  },

  async createTicket(payload: {
    ticketType?: 'problem' | 'fraud' | 'claim';
    category: string;
    description: string;
    orderId?: string;
    contactEmail?: string;
    attachments?: Array<{ name: string; mimeType: string; size: number; dataUrl: string }>;
  }): Promise<{ success: boolean; ticket: ClientTicketDTO }> {
    return apiJson('/api/client/tickets', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async openSupportChat(topic?: string): Promise<{ success: boolean; conversation: any; messages: any[] }> {
    return apiJson('/api/client/support-chat', {
      method: 'POST',
      body: JSON.stringify({ topic })
    });
  },

  async createWsTicket(): Promise<{ success: boolean; ticket: string; expiresInSeconds: number }> {
    return apiJson('/api/client/ws-ticket', {
      method: 'POST',
      body: JSON.stringify({})
    });
  },

  async syncInteractions(payload: Partial<ClientBootstrapDTO['interactions']>): Promise<{ success: boolean }> {
    return apiJson('/api/client/interactions', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async deleteViewingHistory(videoId?: string): Promise<{ success: boolean }> {
    const suffix = videoId ? `/${encodeURIComponent(videoId)}` : '';
    return apiJson(`/api/client/viewing-history${suffix}`, {
      method: 'DELETE'
    });
  },

  async submitOrderReview(orderId: string, rating: number, comment: string, productId?: string): Promise<{ success: boolean; review: any }> {
    return apiJson(`/api/client/orders/${encodeURIComponent(orderId)}/review`, {
      method: 'POST',
      body: JSON.stringify({ rating, comment, ...(productId ? { productId } : {}) })
    });
  },

  async getSellerReviewsAndEligibility(sellerId: string): Promise<{
    success: boolean;
    reviews: any[];
    summary: { count: number; avgRating: number | null };
    orderedProducts: Array<{
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
      existingReview?: any;
    }>;
    canSubmitReview: boolean;
  }> {
    return apiJson(`/api/client/sellers/${encodeURIComponent(sellerId)}/reviews`);
  },

  async submitVerifiedSellerReview(
    sellerId: string,
    payload: { orderId: string; productId: string; rating: number; comment: string }
  ): Promise<{ success: boolean; review: any }> {
    return apiJson(`/api/client/sellers/${encodeURIComponent(sellerId)}/reviews`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateAuthProfile(payload: {
    name?: string;
    phone?: string;
    username?: string;
    bio?: string;
    avatar?: string;
    location?: string;
    commune?: string;
    quartier?: string;
    details?: string;
  }): Promise<{ success: boolean; user: any; profile: any }> {
    return apiJson('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return apiJson('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  },

  async updateAccountStatus(action: 'deactivate' | 'delete', password: string): Promise<{ success: boolean; message: string }> {
    return apiJson('/api/auth/account-status', {
      method: 'POST',
      body: JSON.stringify({ action, password })
    });
  },

  async revokeSession(sessionId: string): Promise<{ success: boolean; revokedSessionId: string }> {
    return apiJson('/api/auth/sessions/revoke-mine', {
      method: 'POST',
      body: JSON.stringify({ sessionId })
    });
  },

  async revokeOtherSessions(): Promise<{ success: boolean; revokedCount: number }> {
    return apiJson('/api/auth/sessions/revoke-others', {
      method: 'POST',
      body: JSON.stringify({})
    });
  },

  async getVisitorQuota(guestId: string): Promise<{
    success: boolean;
    limits: { dailyLikes: number; dailyFavorites: number; dailyAiQuestions: number };
    ai: { allowed: boolean; used: number; limit: number; remaining: number; dateKey: string };
  }> {
    return apiJson(`/api/client/visitor-quota?guestId=${encodeURIComponent(guestId)}`);
  },

  async mergeGuestData(payload: {
    guestId: string;
    likedVideoIds: string[];
    savedVideoIds: string[];
    viewingHistory: Array<{ videoId: string; watchedAt: string; durationSec: number; completed: boolean }>;
    searchHistory: string[];
    preferences: Partial<ClientPreferencesDTO> | null;
    aiConversation: ClientAiConversationDTO | null;
  }): Promise<{
    success: boolean;
    merged: boolean;
    interactions: ClientBootstrapDTO['interactions'];
    preferences: ClientPreferencesDTO;
    aiConversations: ClientAiConversationDTO[];
  }> {
    return apiJson('/api/client/guest-merge', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
};
