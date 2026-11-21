import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  TabType, 
  SellerTabType,
  Product, 
  Seller, 
  Order, 
  CartItem, 
  VideoComment, 
  VideoCommentReply,
  Conversation, 
  Message, 
  ActiveCall, 
  UserProfile,
  NotificationItem,
  OrderStatus,
  OrderIncident,
  TrackingEvent,
  AdminUserRecord,
  AdminAuditLog,
  PlatformConfig,
  AiCreditTransaction,
  TryOnHistoryItem,
  SellerCreation
} from '../types';
import { normalizeProductMedia } from '../services/mediaUtils';
import { 
  INITIAL_SELLERS, 
  INITIAL_PRODUCTS, 
  INITIAL_COMMENTS, 
  INITIAL_ORDERS, 
  INITIAL_CONVERSATIONS, 
  INITIAL_MESSAGES, 
  INITIAL_MESSAGES_MAP,
  INITIAL_USER_PROFILE, 
  INITIAL_NOTIFICATIONS, 
  INITIAL_TRY_ON_HISTORY,
  INITIAL_SELLER_CREATIONS
} from '../data/mockData';
import {
  INITIAL_ADMIN_USERS,
  INITIAL_AUDIT_LOGS,
  INITIAL_PLATFORM_CONFIG
} from '../data/adminMockData';
import { formatFCFA } from '../services/marketServices';
import { readShared, writeShared, writeSharedScalar, subscribeSharedChanges, safeStorageGet, safeStorageSet, safeStorageRemove, type DjassaSharedKey } from '../services/sharedDataSync';
import { getSecurityToken, securityService } from '../services/securityService';
import { authService, commerceService, type AuthUserDTO } from '../services/commerceService';
import { creditsService } from '../services/creditsService';
import {
  clientService,
  type ClientAiConversationDTO,
  type ClientPreferencesDTO,
  type ClientSessionDTO,
  type ClientTicketDTO
} from '../services/clientService';
import { VISITOR_QUOTAS } from '../config/visitorQuotas';
import {
  DEFAULT_VISITOR_AVATAR,
  visitorService,
  type GuestQuotaSnapshot
} from '../services/visitorService';

export type GuestAuthGateReason =
  | 'comment'
  | 'ai_quota'
  | 'purchase'
  | 'cart'
  | 'orders'
  | 'messages'
  | 'follow'
  | 'like_limit'
  | 'favorite_limit'
  | 'tryon'
  | 'account';

export type PendingVisitorAction =
  | { type: 'comment'; productId: string }
  | { type: 'buy_direct'; product: Product; variantSelected?: Record<string, string>; quantity?: number }
  | { type: 'add_to_cart'; productId: string; variantSelected: Record<string, string>; quantity?: number }
  | { type: 'follow_seller'; sellerId: string }
  | { type: 'open_orders' }
  | { type: 'open_messages'; sellerId?: string; relatedProductId?: string }
  | { type: 'ai_chat' }
  | { type: 'tryon'; product: Product }
  | { type: 'open_profile' };

export interface VisitorAuthGateState {
  isOpen: boolean;
  reason: GuestAuthGateReason;
  initialMode: 'login' | 'register';
  directToAuthForm: boolean;
  pendingAction: PendingVisitorAction | null;
  openedAt: number;
}

const DEFAULT_CLIENT_PREFERENCES_STATE: ClientPreferencesDTO = {
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

function createGuestUserProfile(): UserProfile {
  const guest = visitorService.getState();
  return {
    id: guest.guestId,
    name: 'Visiteur DJASSA',
    username: 'visiteur',
    avatar: DEFAULT_VISITOR_AVATAR,
    bio: 'Explorez DJASSA librement avant de créer votre compte.',
    phone: '',
    email: '',
    deliveryCommune: 'Cocody',
    deliveryQuartier: '',
    deliveryAddressDetails: '',
    likedVideoIds: guest.likedVideoIds,
    savedItemIds: guest.savedProductIds,
    followedSellerIds: [],
    stats: {
      timeTodayMinutes: 0,
      timeWeekMinutes: 0,
      timeMonthMinutes: 0,
      watchTodayMinutes: 0,
      watchWeekMinutes: 0,
      watchMonthMinutes: 0,
      dailyUsageChart: []
    },
    viewingHistory: guest.viewingHistory,
    searchHistory: guest.searchHistory,
    devices: []
  };
}

interface AppContextType {
  // Authentication / dashboard & Visitor Mode
  isAuthenticated: boolean;
  isVisitor: boolean;
  visitorQuota: GuestQuotaSnapshot;
  refreshVisitorQuota: () => void;
  authGateState: VisitorAuthGateState;
  openAuthModal: (
    reason?: GuestAuthGateReason,
    options?: {
      initialMode?: 'login' | 'register';
      directToAuthForm?: boolean;
      pendingAction?: PendingVisitorAction | null;
    }
  ) => void;
  closeAuthGate: () => void;
  requireAuth: (
    reason: GuestAuthGateReason,
    pendingAction?: PendingVisitorAction | null,
    options?: {
      initialMode?: 'login' | 'register';
      directToAuthForm?: boolean;
    }
  ) => boolean;
  accountRole: 'client' | 'seller' | 'admin' | null;
  setAccountRole: (role: 'client' | 'seller' | 'admin' | null) => void;
  currentSellerId: string;
  setCurrentSellerId: (id: string) => void;
  signIn: (email: string, password: string) => Promise<{ success: boolean; role?: 'client' | 'seller' | 'admin'; message?: string }>;
  signUp: (payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role?: 'client' | 'seller';
  }) => Promise<{ success: boolean; role?: 'client' | 'seller' | 'admin'; message?: string }>;
  signOut: () => void;

  // Navigation
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  sellerActiveTab: SellerTabType;
  setSellerActiveTab: (tab: SellerTabType) => void;
  feedSubTab: 'pour_toi' | 'suivi' | 'promo' | 'live';
  setFeedSubTab: (tab: 'pour_toi' | 'suivi' | 'promo' | 'live') => void;
  feedTargetProductId: string | null;
  setFeedTargetProductId: (id: string | null) => void;
  feedReturnProduct: Product | null;
  setFeedReturnProduct: (product: Product | null) => void;
  navigateToFeedProduct: (productId: string, returnProduct?: Product | null) => void;
  isVoiceModeOpen: boolean;
  setIsVoiceModeOpen: (isOpen: boolean) => void;
  returnToLiveVoiceAvailable: boolean;
  setReturnToLiveVoiceAvailable: (available: boolean) => void;
  liveAiProducts: Product[];
  setLiveAiProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  hideBottomNav: boolean;
  setHideBottomNav: (hide: boolean) => void;
  navigateToDiscussions: (conversationId?: string) => void;
  
  // Data
  products: Product[];
  sellers: Seller[];
  comments: Record<string, VideoComment[]>;
  orders: Order[];
  cart: CartItem[];
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  messages: Record<string, Message[]>;
  setMessages: React.Dispatch<React.SetStateAction<Record<string, Message[]>>>;
  userProfile: UserProfile;
  userActivity: {
    totalMinutesSpent: number;
    watchTimeSeconds: number;
    completedVideosCount: number;
    viewedProductIds: string[];
    commentsCount: number;
    likesCount: number;
    savedCount: number;
    cartAddsCount: number;
    purchasesCount: number;
    followedSellersCount: number;
  };
  notifications: NotificationItem[];

  // Active Modals & Full Views
  selectedProduct: Product | null;
  setSelectedProduct: (product: Product | null) => void;
  /** Product video opened from Explorer (TikTok-style viewer). */
  selectedVideoProduct: Product | null;
  setSelectedVideoProduct: (product: Product | null) => void;
  videoViewerProducts: Product[];
  openVideoViewer: (products: Product[], productId?: string) => void;
  /** Product photo opened for full TikTok-style photo viewing (same as seller photos tab). */
  selectedPhotoProduct: Product | null;
  setSelectedPhotoProduct: (product: Product | null) => void;
  photoViewerProducts: Product[];
  openPhotoViewer: (products: Product[], productId?: string) => void;
  closePhotoViewer: () => void;
  selectedSeller: Seller | null;
  setSelectedSeller: (seller: Seller | null) => void;
  selectedOrder: Order | null;
  setSelectedOrder: (order: Order | null) => void;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  commentBottomSheetProductId: string | null;
  setCommentBottomSheetProductId: (productId: string | null) => void;
  variantModalProduct: Product | null;
  setVariantModalProduct: (product: Product | null) => void;
  isVariantModalDirectBuy: boolean;
  setIsVariantModalDirectBuy: (isDirect: boolean) => void;
  tryOnModalProduct: Product | null;
  setTryOnModalProduct: (product: Product | null) => void;
  openTryOnModal: (product: Product) => void;
  closeTryOnModal: () => void;
  tryOnHistory: TryOnHistoryItem[];
  addTryOnHistoryItem: (item: Omit<TryOnHistoryItem, 'id' | 'createdAt'>) => void;
  removeTryOnHistoryItem: (id: string) => void;
  sellerCreations: SellerCreation[];
  addSellerCreation: (creation: Omit<SellerCreation, 'id' | 'createdAt'>) => void;
  removeSellerCreation: (id: string) => void;
  
  // Kling AI & ChatGPT Credits & Plans System
  aiCredits: number;
  userPlan: string;
  setUserPlan: (plan: string) => void;
  upgradeUserPlan: (plan: string, creditsGranted: number, priceFcfa: number) => void;
  refreshCreditsState: () => Promise<{ balance: number; activePlan: string } | null>;
  spendAiCredits: (amount: number, reason: string, category?: 'chat' | 'image' | 'video') => boolean;
  addAiCredits: (amount: number, reason?: string, category?: 'daily_bonus' | 'pack_purchase') => void;
  claimDailyBonus: () => boolean;
  aiCreditHistory: AiCreditTransaction[];
  isCreditModalOpen: boolean;
  setIsCreditModalOpen: (open: boolean) => void;
  creditModalAudience: 'client' | 'seller' | null;
  setCreditModalAudience: (audience: 'client' | 'seller' | null) => void;
  openCreditModal: (audience?: 'client' | 'seller') => void;
  isAiVideoModalOpen: boolean;
  setIsAiVideoModalOpen: (open: boolean) => void;
  aiVideoInitialData: { name?: string; prompt?: string; image?: string } | null;
  openAiVideoModal: (data?: { name?: string; prompt?: string; image?: string }) => void;
  closeAiVideoModal: () => void;
  
  // VoIP / Call
  activeCall: ActiveCall | null;
  startCall: (
    participantId: string, 
    participantType: 'seller' | 'client',
    meta?: { name?: string; avatar?: string; role?: string; phone?: string; orderNumber?: string }
  ) => void;
  receiveIncomingCall: (
    participantId?: string, 
    participantType?: 'seller' | 'client', 
    customName?: string,
    customRole?: string,
    customAvatar?: string
  ) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  toggleCallMute: () => void;
  toggleCallSpeaker: () => void;
  toggleCallMinimized: () => void;

  // Actions
  toggleFollowSeller: (sellerId: string) => void;
  toggleLikeVideo: (productId: string) => void;
  toggleSaveProduct: (productId: string) => void;
  addToCart: (productId: string, variantSelected: Record<string, string>, quantity?: number) => void;
  removeFromCart: (cartItemId: string) => void;
  updateCartQuantity: (cartItemId: string, newQuantity: number) => void;
  toggleCartItemSelected: (cartItemId: string) => void;
  
  // Checkout & Orders
  createOrder: (
    items: { product: Product; variantSelected: Record<string, string>; quantity: number }[],
    paymentMethod: 'wave' | 'orange_money' | 'cash_on_delivery',
    address: {
      commune: string;
      quartier: string;
      details: string;
      landmark?: string;
      deliveryInstructions?: string;
      gpsCoords?: { lat: number; lng: number };
      recipientName: string;
      phone: string;
    },
    options?: {
      paymentMode?: 'online' | 'cod';
      payerPhone?: string;
      promoCode?: string;
      idempotencyKey?: string;
    }
  ) => Promise<Order & { paymentUrl?: string | null; checkoutUrl?: string | null; providerConfigured?: boolean; paymentTransaction?: any }>;
  createMultiSellerOrders: (
    items: { product: Product; variantSelected: Record<string, string>; quantity: number }[],
    paymentMethod: 'wave' | 'orange_money' | 'cash_on_delivery',
    address: {
      commune: string;
      quartier: string;
      details: string;
      landmark?: string;
      deliveryInstructions?: string;
      gpsCoords?: { lat: number; lng: number };
      recipientName: string;
      phone: string;
    },
    options?: {
      paymentMode?: 'online' | 'cod';
      payerPhone?: string;
      promoCode?: string;
      idempotencyKey?: string;
    }
  ) => Promise<{ checkoutGroupId: string; orders: Order[]; totalAmountFcfa: number; providerConfigured: boolean; paymentUrl?: string | null; checkoutUrl?: string | null }>;
  submitOrderReview: (orderId: string, rating: number, comment: string) => void;
  
  // Messaging
  sendMessage: (
    conversationId: string, 
    content: string, 
    type?: 'text' | 'image' | 'video' | 'audio' | 'product_card' | 'order_card', 
    meta?: any
  ) => void;
  openChatWithSeller: (sellerId: string, relatedProductId?: string) => void;
  openChatWithClient: (clientPhone: string, clientName: string, relatedOrderId?: string, initialMessage?: string) => void;
  openChatWithParticipant: (params: {
    participantId: string;
    participantName: string;
    participantType: 'seller' | 'client';
    participantAvatar?: string;
    participantRoleSubtitle?: string;
    participantVerified?: boolean;
    relatedOrderId?: string;
    relatedProductId?: string;
    initialMessage?: string;
  }) => void;
  markConversationAsRead: (conversationId: string) => void;

  // Comments
  addComment: (
    productId: string, 
    content: string, 
    options?: { audioUrl?: string; audioDuration?: number; gifUrl?: string; transcription?: string }
  ) => void;
  addCommentReply: (
    productId: string, 
    commentId: string, 
    content: string, 
    replyToUserName?: string, 
    options?: { audioUrl?: string; audioDuration?: number; gifUrl?: string; transcription?: string }
  ) => void;
  toggleLikeComment: (productId: string, commentId: string) => void;
  toggleLikeReply: (productId: string, commentId: string, replyId: string) => void;
  deleteComment: (productId: string, commentId: string) => void;

  // Search & History
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  trackVideoWatch: (videoId: string, durationSec: number, completed: boolean) => void;
  removeHistoryItem: (videoId: string) => void;
  clearHistory: () => void;
  clearTransientCache: () => void;
  disconnectSession: (sessionId: string) => void;
  disconnectAllOtherSessions: () => void;
  updateProfileDetails: (name: string, bio: string, phone: string, commune: string, quartier: string, details: string) => void;
  updateProfile: (data: Partial<UserProfile> & { commune?: string }) => void;

  // Client persisted preferences, AI conversations, tickets, sessions & support chat
  clientPreferences: ClientPreferencesDTO;
  updateClientPreferences: (patch: Partial<ClientPreferencesDTO>) => Promise<void>;
  aiConversations: ClientAiConversationDTO[];
  saveAiConversation: (payload: {
    id?: string;
    title: string;
    dateLabel: string;
    messages: ClientAiConversationDTO['messages'];
  }) => Promise<ClientAiConversationDTO | null>;
  deleteAiConversation: (id: string) => Promise<void>;
  supportTickets: ClientTicketDTO[];
  createSupportTicket: (payload: {
    ticketType?: 'problem' | 'fraud' | 'claim';
    category: string;
    description: string;
    orderId?: string;
    contactEmail?: string;
    attachments?: Array<{ name: string; mimeType: string; size: number; dataUrl: string }>;
  }) => Promise<ClientTicketDTO | null>;
  activeUserSessions: ClientSessionDTO[];
  openSupportChat: (topic?: string) => Promise<void>;

  cancelOrder: (orderId: string) => void;
  confirmOrderDelivered: (orderId: string) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  reportOrderIncident: (orderId: string, incident: OrderIncident) => void;
  addPublication: (publication: Partial<Product>) => void;
  updateSeller: (sellerId: string, updates: Partial<Seller>) => void;
  updateProductSeller: (productId: string, updates: Partial<Product>) => void;
  deleteProductSeller: (productId: string) => void;

  // Notifications
  markAllNotificationsRead: () => void;
  unreadNotificationsCount: number;
  unreadMessagesCount: number;

  // Admin Module
  adminUsers: AdminUserRecord[];
  auditLogs: AdminAuditLog[];
  platformConfig: PlatformConfig;
  updatePlatformConfig: (updates: Partial<PlatformConfig>) => void;
  verifyUserKyc: (userId: string) => void;
  toggleUserSuspension: (userId: string) => void;
  deleteUser: (userId: string) => void;
  addAdminUser: (user: AdminUserRecord) => void;
  updateAdminUser: (userId: string, updates: Partial<AdminUserRecord>) => void;
  addAuditLog: (
    action: string,
    target: string,
    category: AdminAuditLog['category'],
    details: string,
    meta?: {
      activityCategory?: import('../types/security').ActivityCategory;
      actionType?: string;
      entityType?: string;
      entityId?: string;
      severity?: import('../types/security').AlertSeverityLevel;
      result?: import('../types/security').ActivityResultStatus;
      beforeValue?: string;
      afterValue?: string;
      financialTrace?: import('../types/security').FinancialTraceDetails;
    }
  ) => void;
  updateProductAdmin: (productId: string, updates: Partial<Product>) => void;
  deleteProductAdmin: (productId: string) => void;

  // UI Toast notification
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialHasAuth = (() => {
    const saved = safeStorageGet('djassa_auth');
    const role = safeStorageGet('djassa_account_role');
    const hasToken = Boolean(getSecurityToken());
    return saved === 'true' && hasToken && ['client', 'seller', 'admin'].includes(role || '');
  })();

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(initialHasAuth);
  const [accountRole, setAccountRole] = useState<'client' | 'seller' | 'admin' | null>(() => {
    if (!initialHasAuth) return null;
    const saved = safeStorageGet('djassa_account_role');
    return (saved === 'client' || saved === 'seller' || saved === 'admin') ? saved : null;
  });

  // Visitor mode quotas & contextual auth gate state
  const [visitorQuota, setVisitorQuota] = useState<GuestQuotaSnapshot>(() => visitorService.getQuotaSnapshot());
  const refreshVisitorQuota = useCallback(() => {
    setVisitorQuota(visitorService.getQuotaSnapshot());
  }, []);

  const [authGateState, setAuthGateState] = useState<VisitorAuthGateState>({
    isOpen: false,
    reason: 'account',
    initialMode: 'register',
    directToAuthForm: false,
    pendingAction: null,
    openedAt: 0
  });
  const pendingAuthActionRef = useRef<PendingVisitorAction | null>(null);

  const openAuthModal = useCallback(
    (
      reason: GuestAuthGateReason = 'account',
      options?: {
        initialMode?: 'login' | 'register';
        directToAuthForm?: boolean;
        pendingAction?: PendingVisitorAction | null;
      }
    ) => {
      if (options && options.pendingAction !== undefined) {
        pendingAuthActionRef.current = options.pendingAction;
      }
      setAuthGateState({
        isOpen: true,
        reason,
        initialMode: options?.initialMode || 'register',
        directToAuthForm: Boolean(options?.directToAuthForm),
        pendingAction: options?.pendingAction ?? null,
        openedAt: Date.now()
      });
    },
    []
  );

  const closeAuthGate = useCallback(() => {
    pendingAuthActionRef.current = null;
    setAuthGateState((prev) => ({
      ...prev,
      isOpen: false,
      pendingAction: null
    }));
  }, []);

  const requireAuth = useCallback(
    (
      reason: GuestAuthGateReason,
      pendingAction?: PendingVisitorAction | null,
      options?: {
        initialMode?: 'login' | 'register';
        directToAuthForm?: boolean;
      }
    ): boolean => {
      if (isAuthenticated) return true;
      openAuthModal(reason, {
        initialMode: options?.initialMode || 'register',
        directToAuthForm: options?.directToAuthForm,
        pendingAction: pendingAction ?? null
      });
      return false;
    },
    [isAuthenticated, openAuthModal]
  );

  // Current active seller ID for seller mode
  const [currentSellerId, setCurrentSellerId] = useState<string>('seller-1');

  // Admin Data & Configuration
  const [adminUsers, setAdminUsers] = useState<AdminUserRecord[]>(() => {
    const loaded = readShared<AdminUserRecord[]>('djassa_admin_users', INITIAL_ADMIN_USERS);
    const existingIds = new Set(loaded.map(u => u.id));
    const missing = INITIAL_ADMIN_USERS.filter(u => !existingIds.has(u.id));
    return missing.length > 0 ? [...loaded, ...missing] : loaded;
  });
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>(() => readShared<AdminAuditLog[]>('djassa_audit_logs', INITIAL_AUDIT_LOGS));
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(() => {
    try {
      const saved = localStorage.getItem('djassa_platform_config');
      const parsed = saved ? JSON.parse(saved) : null;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? { ...INITIAL_PLATFORM_CONFIG, ...parsed }
        : INITIAL_PLATFORM_CONFIG;
    } catch {
      return INITIAL_PLATFORM_CONFIG;
    }
  });

  // Navigation states
  const [activeTab, setActiveTab] = useState<TabType>('accueil');
  const [feedSubTab, setFeedSubTab] = useState<'pour_toi' | 'suivi' | 'promo' | 'live'>('pour_toi');
  const [feedTargetProductId, setFeedTargetProductId] = useState<string | null>(null);
  const [feedReturnProduct, setFeedReturnProduct] = useState<Product | null>(null);
  const [isVoiceModeOpen, setIsVoiceModeOpen] = useState(false);
  const [returnToLiveVoiceAvailable, setReturnToLiveVoiceAvailable] = useState(false);
  const [liveAiProducts, setLiveAiProducts] = useState<Product[]>([]);
  const [hideBottomNav, setHideBottomNav] = useState(false);
  const [sellerActiveTab, setSellerActiveTab] = useState<SellerTabType>('boutique');

  // Client persisted preferences, AI conversations, tickets & sessions
  const [clientPreferences, setClientPreferences] = useState<ClientPreferencesDTO>(() => {
    if (!initialHasAuth) {
      const guestPrefs = visitorService.getState().preferences;
      return guestPrefs
        ? {
            ...DEFAULT_CLIENT_PREFERENCES_STATE,
            ...guestPrefs,
            display: { ...DEFAULT_CLIENT_PREFERENCES_STATE.display, ...(guestPrefs.display || {}) },
            dataSaver: { ...DEFAULT_CLIENT_PREFERENCES_STATE.dataSaver, ...(guestPrefs.dataSaver || {}) },
            contentPreferences: {
              ...DEFAULT_CLIENT_PREFERENCES_STATE.contentPreferences,
              ...(guestPrefs.contentPreferences || {})
            }
          }
        : DEFAULT_CLIENT_PREFERENCES_STATE;
    }
    try {
      const raw = localStorage.getItem('djassa_client_preferences');
      return raw ? { ...DEFAULT_CLIENT_PREFERENCES_STATE, ...JSON.parse(raw) } : DEFAULT_CLIENT_PREFERENCES_STATE;
    } catch {
      return DEFAULT_CLIENT_PREFERENCES_STATE;
    }
  });
  const [aiConversations, setAiConversations] = useState<ClientAiConversationDTO[]>([]);
  const [supportTickets, setSupportTickets] = useState<ClientTicketDTO[]>([]);
  const [activeUserSessions, setActiveUserSessions] = useState<ClientSessionDTO[]>([]);

  // Core Data loaded from localStorage if available
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = safeStorageGet('djassa_products');
      const parsed: Product[] = saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
      return Array.isArray(parsed) ? parsed.map(normalizeProductMedia) : INITIAL_PRODUCTS.map(normalizeProductMedia);
    } catch {
      return INITIAL_PRODUCTS.map(normalizeProductMedia);
    }
  });

  const [sellers, setSellers] = useState<Seller[]>(() => {
    try {
      const saved = localStorage.getItem('djassa_sellers');
      const parsed = saved ? JSON.parse(saved) : INITIAL_SELLERS;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_SELLERS;
    } catch {
      return INITIAL_SELLERS;
    }
  });

  const [comments, setComments] = useState<Record<string, VideoComment[]>>(() => {
    try {
      const saved = localStorage.getItem('djassa_comments');
      const parsed = saved ? JSON.parse(saved) : null;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : INITIAL_COMMENTS;
    } catch {
      return INITIAL_COMMENTS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('djassa_comments', JSON.stringify(comments));
    } catch (e) {
      console.warn('Failed to persist comments', e);
    }
  }, [comments]);

  const [orders, setOrders] = useState<Order[]>(() => {
    if (!initialHasAuth) return [];
    const rawOrders = readShared<Order[]>('djassa_orders', INITIAL_ORDERS);
    const existingIds = new Set(rawOrders.map((o) => o.id));
    const mergedOrders = [...rawOrders];
    for (const initOrder of INITIAL_ORDERS) {
      if (!existingIds.has(initOrder.id)) {
        mergedOrders.push(initOrder);
        existingIds.add(initOrder.id);
      }
    }
    return mergedOrders.map((o) => ({
      ...o,
      visibleStatus: 'Commande confirmée'
    }));
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    if (!initialHasAuth) return [];
    try {
      const saved = localStorage.getItem('djassa_cart');
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fallback to initial cart
    }
    return [
      {
        id: 'cart-init-1',
        productId: 'prod-2',
        variantSelected: { 'Taille': 'L (44-46)', 'Couleur': 'Bleu Nuit & Or' },
        quantity: 1,
        selected: true,
        addedAt: new Date().toISOString()
      }
    ];
  });

  const dedupeConversations = (list: Conversation[]): Conversation[] => {
    const seen = new Set<string>();
    const result: Conversation[] = [];
    for (const c of list) {
      if (c && c.id && !seen.has(c.id)) {
        if (c.participantType === 'client' || c.participantRole === 'client') {
          continue;
        }
        if ((c.participantType as string) === 'driver' || (c.participantType as string) === 'company') {
          continue;
        }
        seen.add(c.id);
        result.push(c);
      }
    }

    for (const initC of INITIAL_CONVERSATIONS) {
      if (!seen.has(initC.id)) {
        result.push(initC);
        seen.add(initC.id);
      }
    }

    return result.length > 0 ? result : INITIAL_CONVERSATIONS;
  };

  const [conversations, setConversationsState] = useState<Conversation[]>(() => {
    if (!initialHasAuth) return [];
    try {
      const saved = localStorage.getItem('djassa_conversations');
      const parsed = saved ? JSON.parse(saved) : INITIAL_CONVERSATIONS;
      return dedupeConversations(Array.isArray(parsed) ? parsed : INITIAL_CONVERSATIONS);
    } catch {
      return dedupeConversations(INITIAL_CONVERSATIONS);
    }
  });

  const setConversations: React.Dispatch<React.SetStateAction<Conversation[]>> = useCallback((action) => {
    setConversationsState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (!getSecurityToken()) {
        return Array.isArray(next) ? next : prev;
      }
      return dedupeConversations(Array.isArray(next) ? next : prev);
    });
  }, []);

  const [messages, setMessages] = useState<Record<string, Message[]>>(() => {
    if (!initialHasAuth) return {};
    try {
      const saved = localStorage.getItem('djassa_messages');
      const parsed = saved ? JSON.parse(saved) : null;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
        return { ...INITIAL_MESSAGES_MAP, ...parsed };
      }
      return INITIAL_MESSAGES_MAP;
    } catch {
      return INITIAL_MESSAGES_MAP;
    }
  });

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    if (!initialHasAuth) {
      return createGuestUserProfile();
    }
    try {
      const saved = localStorage.getItem('djassa_user_profile');
      const parsed = saved ? JSON.parse(saved) : null;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return {
          ...INITIAL_USER_PROFILE,
          ...parsed,
          likedVideoIds: Array.isArray(parsed.likedVideoIds) ? parsed.likedVideoIds : INITIAL_USER_PROFILE.likedVideoIds,
          savedItemIds: Array.isArray(parsed.savedItemIds) ? parsed.savedItemIds : INITIAL_USER_PROFILE.savedItemIds,
          followedSellerIds: Array.isArray(parsed.followedSellerIds) ? parsed.followedSellerIds : INITIAL_USER_PROFILE.followedSellerIds,
          viewingHistory: Array.isArray(parsed.viewingHistory) ? parsed.viewingHistory : INITIAL_USER_PROFILE.viewingHistory,
          searchHistory: Array.isArray(parsed.searchHistory) ? parsed.searchHistory : INITIAL_USER_PROFILE.searchHistory
        };
      }
    } catch {
      // fallback to initial profile
    }
    return INITIAL_USER_PROFILE;
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    initialHasAuth ? readShared<NotificationItem[]>('djassa_notifs', INITIAL_NOTIFICATIONS) : []
  );



  // Active view states
  const [selectedProduct, setSelectedProductState] = useState<Product | null>(null);
  const [selectedVideoProduct, setSelectedVideoProductState] = useState<Product | null>(null);
  const [videoViewerProducts, setVideoViewerProducts] = useState<Product[]>([]);
  const [selectedPhotoProduct, setSelectedPhotoProductState] = useState<Product | null>(null);
  const [photoViewerProducts, setPhotoViewerProducts] = useState<Product[]>([]);

  const setSelectedPhotoProduct = useCallback((product: Product | null) => {
    setSelectedPhotoProductState(product);
    if (!product) {
      setPhotoViewerProducts([]);
      return;
    }
    if (!photoViewerProducts.some((item) => item.id === product.id)) {
      setPhotoViewerProducts([product]);
    }
    if (!isAuthenticated) {
      const guestHist = visitorService.recordGuestView(product.id, 0, 0);
      setUserProfile((prev) => ({ ...prev, viewingHistory: guestHist }));
      return;
    }
    setUserProfile((prev) => {
      const existing = prev.viewingHistory.find((h) => h.videoId === product.id);
      const next = {
        videoId: product.id,
        viewedAt: new Date().toISOString(),
        watchDurationSec: existing?.watchDurationSec || 0,
        completionRate: existing?.completionRate || 0
      };
      return {
        ...prev,
        viewingHistory: [next, ...prev.viewingHistory.filter((h) => h.videoId !== product.id)].slice(0, 200)
      };
    });
  }, [photoViewerProducts, isAuthenticated]);

  const openPhotoViewer = useCallback((viewerProducts: Product[], productId?: string) => {
    const photos = viewerProducts.filter((p) => (p.images && p.images.length > 0) || p.mediaType === 'image');
    if (!photos.length) return;
    const target = (productId && photos.find((p) => p.id === productId)) || photos[0];
    setPhotoViewerProducts(photos);
    setSelectedPhotoProductState(target);
    if (!isAuthenticated) {
      const guestHist = visitorService.recordGuestView(target.id, 0, 0);
      setUserProfile((prev) => ({ ...prev, viewingHistory: guestHist }));
      return;
    }
    setUserProfile((prev) => {
      const existing = prev.viewingHistory.find((h) => h.videoId === target.id);
      const next = {
        videoId: target.id,
        viewedAt: new Date().toISOString(),
        watchDurationSec: existing?.watchDurationSec || 0,
        completionRate: existing?.completionRate || 0
      };
      return {
        ...prev,
        viewingHistory: [next, ...prev.viewingHistory.filter((h) => h.videoId !== target.id)].slice(0, 200)
      };
    });
  }, [isAuthenticated]);

  const closePhotoViewer = useCallback(() => {
    setSelectedPhotoProductState(null);
    setPhotoViewerProducts([]);
  }, []);

  const setSelectedVideoProduct = useCallback((product: Product | null) => {
    setSelectedVideoProductState(product);
    if (!product) {
      setVideoViewerProducts([]);
      return;
    }
    if (!videoViewerProducts.some((item) => item.id === product.id)) {
      setVideoViewerProducts([product]);
    }
    if (!isAuthenticated) {
      const guestHist = visitorService.recordGuestView(product.id, 0, 0);
      setUserProfile((prev) => ({ ...prev, viewingHistory: guestHist }));
      return;
    }
    // A publication opened in the TikTok-style viewer counts as viewed for both
    // videos and image carousels. This keeps Profile > Historique consistent.
    setUserProfile((prev) => {
      const existing = prev.viewingHistory.find((h) => h.videoId === product.id);
      const next = {
        videoId: product.id,
        viewedAt: new Date().toISOString(),
        watchDurationSec: existing?.watchDurationSec || 0,
        completionRate: existing?.completionRate || 0
      };
      return {
        ...prev,
        viewingHistory: [next, ...prev.viewingHistory.filter((h) => h.videoId !== product.id)].slice(0, 200)
      };
    });
  }, [videoViewerProducts, isAuthenticated]);

  const openVideoViewer = useCallback((viewerProducts: Product[], productId?: string) => {
    const videos = viewerProducts.filter((product) => product.mediaType === 'video' && Boolean(product.videoUrl));
    if (!videos.length) return;
    const target = (productId && videos.find((product) => product.id === productId)) || videos[0];
    setVideoViewerProducts(videos);
    setSelectedVideoProductState(target);
    if (!isAuthenticated) {
      const guestHist = visitorService.recordGuestView(target.id, 0, 0);
      setUserProfile((prev) => ({ ...prev, viewingHistory: guestHist }));
      return;
    }
    setUserProfile((prev) => {
      const existing = prev.viewingHistory.find((h) => h.videoId === target.id);
      const next = {
        videoId: target.id,
        viewedAt: new Date().toISOString(),
        watchDurationSec: existing?.watchDurationSec || 0,
        completionRate: existing?.completionRate || 0
      };
      return {
        ...prev,
        viewingHistory: [next, ...prev.viewingHistory.filter((h) => h.videoId !== target.id)].slice(0, 200)
      };
    });
  }, [isAuthenticated]);

  const navigateToFeedProduct = useCallback((productId: string, returnProduct?: Product | null) => {
    setSelectedProductState(null);
    setSelectedPhotoProductState(null);
    setSelectedVideoProductState(null);
    setPhotoViewerProducts([]);
    setVideoViewerProducts([]);
    if (returnProduct) {
      setFeedReturnProduct(returnProduct);
    }
    setFeedSubTab('pour_toi');
    setFeedTargetProductId(productId);
    setActiveTab('accueil');
  }, []);

  const setSelectedProduct = useCallback((product: Product | null) => {
    setSelectedProductState(product);
    if (!product) return;
    if (!isAuthenticated) {
      const guestHist = visitorService.recordGuestView(product.id, 0, 0);
      setUserProfile((prev) => ({ ...prev, viewingHistory: guestHist }));
      return;
    }
    setUserProfile((prev) => {
      const existing = prev.viewingHistory.find((h) => h.videoId === product.id);
      const next = {
        videoId: product.id,
        viewedAt: new Date().toISOString(),
        watchDurationSec: existing?.watchDurationSec || 0,
        completionRate: existing?.completionRate || 0
      };
      return {
        ...prev,
        viewingHistory: [next, ...prev.viewingHistory.filter((h) => h.videoId !== product.id)].slice(0, 200)
      };
    });
  }, [isAuthenticated]);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [commentBottomSheetProductId, setCommentBottomSheetProductId] = useState<string | null>(null);
  const [variantModalProduct, setVariantModalProduct] = useState<Product | null>(null);
  const [isVariantModalDirectBuy, setIsVariantModalDirectBuy] = useState<boolean>(false);
  const [tryOnModalProduct, setTryOnModalProduct] = useState<Product | null>(null);

  const openTryOnModal = useCallback((product: Product) => {
    setTryOnModalProduct(product);
  }, []);

  const closeTryOnModal = useCallback(() => {
    setTryOnModalProduct(null);
  }, []);

  const [tryOnHistory, setTryOnHistory] = useState<TryOnHistoryItem[]>(() => {
    return initialHasAuth ? readShared<TryOnHistoryItem[]>('djassa_tryon_history', INITIAL_TRY_ON_HISTORY) : [];
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    writeShared('djassa_tryon_history', tryOnHistory);
  }, [tryOnHistory, isAuthenticated]);

  const addTryOnHistoryItem = useCallback((item: Omit<TryOnHistoryItem, 'id' | 'createdAt'>) => {
    const newItem: TryOnHistoryItem = {
      ...item,
      id: `tryon-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: 'À l\'instant'
    };
    setTryOnHistory((prev) => [newItem, ...prev]);
  }, []);

  const removeTryOnHistoryItem = useCallback((id: string) => {
    setTryOnHistory((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const [sellerCreations, setSellerCreations] = useState<SellerCreation[]>(() => {
    return readShared<SellerCreation[]>('djassa_seller_creations', INITIAL_SELLER_CREATIONS);
  });

  useEffect(() => {
    writeShared('djassa_seller_creations', sellerCreations);
  }, [sellerCreations]);

  const addSellerCreation = useCallback((creation: Omit<SellerCreation, 'id' | 'createdAt'>) => {
    const newItem: SellerCreation = {
      ...creation,
      id: `creation-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: 'À l\'instant'
    };
    setSellerCreations((prev) => [newItem, ...prev]);
  }, []);

  const removeSellerCreation = useCallback((id: string) => {
    setSellerCreations((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Search state
  const [searchQuery, setSearchQueryState] = useState<string>('');

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    const normalized = query.trim();
    if (!normalized) return;
    if (!isAuthenticated) {
      const nextSearches = visitorService.recordGuestSearch(normalized);
      setUserProfile((prev) => ({
        ...prev,
        searchHistory: nextSearches
      }));
      return;
    }
    setUserProfile((prev) => ({
      ...prev,
      searchHistory: [normalized, ...prev.searchHistory.filter((q) => q.toLowerCase() !== normalized.toLowerCase())].slice(0, 50)
    }));
  }, [isAuthenticated]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tous');

  // Call state
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  }, []);

  // Kling AI & ChatGPT Credits & Plans System
  const [aiCredits, setAiCredits] = useState<number>(() => {
    const saved = safeStorageGet('djassa_ai_credits');
    if (saved === '100' || saved === '50') {
      safeStorageSet('djassa_ai_credits', '10');
      return 10;
    }
    if (saved === null) {
      safeStorageSet('djassa_ai_credits', '10');
      safeStorageSet('djassa_client_free_last_renewal_at', String(Date.now()));
      return 10;
    }
    const parsed = Number(saved);
    return Number.isFinite(parsed) ? parsed : 10;
  });

  const [userPlan, setUserPlanState] = useState<string>(() => {
    const saved = safeStorageGet('djassa_user_plan');
    if (saved === 'go') return 'mini';
    if (saved === 'pro') return 'premium';
    return saved || 'gratuit';
  });

  const setUserPlan = useCallback((plan: string) => {
    setUserPlanState(plan);
    safeStorageSet('djassa_user_plan', plan);
  }, []);

  const [aiCreditHistory, setAiCreditHistory] = useState<AiCreditTransaction[]>(() => {
    const saved = safeStorageGet('djassa_ai_credit_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [
      {
        id: 'cred-init',
        amount: 10,
        type: 'bonus',
        label: 'Plan Gratuit • 10 crédits offerts (renouvellement chaque 24h)',
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        category: 'daily_bonus'
      }
    ];
  });

  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [creditModalAudience, setCreditModalAudience] = useState<'client' | 'seller' | null>(null);

  const openCreditModal = useCallback((audience?: 'client' | 'seller') => {
    if (audience) {
      setCreditModalAudience(audience);
    } else if (accountRole === 'seller') {
      setCreditModalAudience('seller');
    } else {
      setCreditModalAudience('client');
    }
    setIsCreditModalOpen(true);
  }, [accountRole]);

  const [isAiVideoModalOpen, setIsAiVideoModalOpen] = useState(false);
  const [aiVideoInitialData, setAiVideoInitialData] = useState<{ name?: string; prompt?: string; image?: string } | null>(null);

  const openAiVideoModal = useCallback((data?: { name?: string; prompt?: string; image?: string }) => {
    setAiVideoInitialData(data || null);
    setIsAiVideoModalOpen(true);
  }, []);

  const closeAiVideoModal = useCallback(() => {
    setIsAiVideoModalOpen(false);
    setAiVideoInitialData(null);
  }, []);

  const refreshCreditsState = useCallback(async (): Promise<{ balance: number; activePlan: string } | null> => {
    if (!getSecurityToken()) return null;
    try {
      const [balRes, histRes] = await Promise.all([
        creditsService.getBalance().catch(() => null),
        creditsService.getHistory().catch(() => null)
      ]);
      const resolvedBalance = balRes && typeof balRes.balance === 'number' ? balRes.balance : aiCredits;
      const resolvedPlan =
        (typeof balRes?.activePlan === 'string' && balRes.activePlan) ||
        (typeof histRes?.activePlan === 'string' && histRes.activePlan) ||
        userPlan;

      if (balRes && typeof balRes.balance === 'number') {
        setAiCredits(balRes.balance);
        safeStorageSet('djassa_ai_credits', String(balRes.balance));
      }
      if (resolvedPlan && resolvedPlan !== 'gratuit') {
        setUserPlanState(resolvedPlan);
        safeStorageSet('djassa_user_plan', resolvedPlan);
      }
      if (histRes) {
        const mappedRecharges: AiCreditTransaction[] = (histRes.recharges || []).map((r) => ({
          id: r.id,
          amount: r.credits,
          type: 'purchase',
          label: `${r.planName ? `Abonnement ${r.planName}` : 'Recharge crédits'} • ${
            r.status === 'confirmed'
              ? 'Confirmé'
              : r.status === 'failed' || r.status === 'rejected'
              ? 'Échoué'
              : 'En attente'
          }`,
          date: new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          category: 'pack_purchase'
        }));
        const mappedUsages: AiCreditTransaction[] = (histRes.usages || []).map((u) => ({
          id: u.id,
          amount: u.credits,
          type: 'spend',
          label: u.label,
          date: new Date(u.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          category: u.serviceType
        }));
        const mappedRefunds: AiCreditTransaction[] = (histRes.refunds || []).map((rf) => ({
          id: rf.id,
          amount: rf.credits,
          type: 'bonus',
          label: `Remboursement : ${rf.reason}`,
          date: new Date(rf.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          category: 'daily_bonus'
        }));
        const combined = [...mappedRecharges, ...mappedUsages, ...mappedRefunds].slice(0, 50);
        if (combined.length > 0) {
          setAiCreditHistory(combined);
          safeStorageSet('djassa_ai_credit_history', JSON.stringify(combined));
        }
      }
      return { balance: resolvedBalance, activePlan: resolvedPlan };
    } catch {
      return null;
    }
  }, [aiCredits, userPlan]);

  const upgradeUserPlan = useCallback((newPlan: string, _creditsGranted: number, priceFcfa: number) => {
    if (newPlan === 'gratuit' || priceFcfa <= 0) {
      setUserPlanState('gratuit');
      safeStorageSet('djassa_user_plan', 'gratuit');
      showToast('Forfait Gratuit activé.');
      return;
    }
    if (!getSecurityToken()) {
      showToast('Veuillez vous connecter pour souscrire à un forfait payant.');
      return;
    }
    void creditsService.confirmRecharge({
      planId: newPlan,
      purchaseType: 'subscription',
      amountFcfa: priceFcfa,
      paymentMethod: 'wave'
    }).then((res) => {
      if (typeof res.newBalance === 'number') {
        setAiCredits(res.newBalance);
        safeStorageSet('djassa_ai_credits', String(res.newBalance));
      }
      if (!res.pending && res.recharge?.status === 'confirmed') {
        setUserPlan(newPlan);
        showToast(`Forfait ${newPlan.toUpperCase()} confirmé !`);
      } else {
        showToast(
          `Demande de forfait ${newPlan.toUpperCase()} (${priceFcfa} FCFA) enregistrée en attente de confirmation de paiement.`
        );
      }
    }).catch((err: Error) => {
      showToast(err.message || 'Impossible d’initier la souscription côté serveur.');
    });
  }, [setUserPlan, showToast]);

  const spendAiCredits = useCallback((amount: number, reason: string, category: 'chat' | 'image' | 'video' = 'image'): boolean => {
    if (aiCredits < amount) {
      showToast(`Crédits IA RodiumAI insuffisants (${aiCredits}/${amount} crédits requis)`);
      setIsCreditModalOpen(true);
      return false;
    }
    const previousBalance = aiCredits;
    const newBal = aiCredits - amount;
    setAiCredits(newBal);
    safeStorageSet('djassa_ai_credits', String(newBal));

    const txId = 'tx-' + Date.now();
    const newTx: AiCreditTransaction = {
      id: txId,
      amount,
      type: 'spend',
      label: reason,
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      category
    };
    setAiCreditHistory((prev) => {
      const updated = [newTx, ...prev].slice(0, 50);
      safeStorageSet('djassa_ai_credit_history', JSON.stringify(updated));
      return updated;
    });

    if (getSecurityToken()) {
      void creditsService.deductCredits({
        serviceType: category,
        label: reason,
        idempotencyKey: txId
      }).then((res) => {
        if (typeof res.newBalance === 'number') {
          setAiCredits(res.newBalance);
          safeStorageSet('djassa_ai_credits', String(res.newBalance));
        }
      }).catch((err: Error) => {
        setAiCredits(previousBalance);
        safeStorageSet('djassa_ai_credits', String(previousBalance));
        setAiCreditHistory((prev) => {
          const rolledBack = prev.filter((item) => item.id !== txId);
          safeStorageSet('djassa_ai_credit_history', JSON.stringify(rolledBack));
          return rolledBack;
        });
        showToast(err.message || 'Débit de crédits refusé par le serveur.');
      });
    }
    return true;
  }, [aiCredits, showToast]);

  const addAiCredits = useCallback((amount: number, reason: string = 'Recharge de crédits', category: 'daily_bonus' | 'pack_purchase' = 'pack_purchase') => {
    if (getSecurityToken() && category === 'pack_purchase') {
      showToast('Recharge soumise : les crédits sont attribués uniquement après validation serveur du paiement.');
      return;
    }
    setAiCredits((prev) => {
      const newBal = prev + amount;
      safeStorageSet('djassa_ai_credits', String(newBal));
      return newBal;
    });

    const newTx: AiCreditTransaction = {
      id: 'tx-' + Date.now(),
      amount,
      type: category === 'daily_bonus' ? 'bonus' : 'purchase',
      label: reason,
      date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      category
    };
    setAiCreditHistory((prev) => {
      const updated = [newTx, ...prev].slice(0, 50);
      safeStorageSet('djassa_ai_credit_history', JSON.stringify(updated));
      return updated;
    });
    showToast(`+${amount} crédits ajoutés avec succès ! ✨`);
  }, [showToast]);

  // Automatic 24h free renewal checked against authoritative server endpoint when authenticated
  useEffect(() => {
    const RENEWAL_MS = 24 * 60 * 60 * 1000;
    const checkFreeRenewal = () => {
      if (accountRole !== 'client' || !getSecurityToken()) return;
      if (userPlan.startsWith('vendeur') || userPlan.startsWith('flotte')) return;
      const now = Date.now();
      const rawLast = safeStorageGet('djassa_client_free_last_renewal_at');
      const last = rawLast ? Number(rawLast) : 0;
      if (last && Number.isFinite(last) && now - last < RENEWAL_MS) {
        return;
      }
      void creditsService.claimDailyBonus().then((res) => {
        if (res.success && typeof res.newBalance === 'number') {
          safeStorageSet('djassa_client_free_last_renewal_at', String(Date.now()));
          setAiCredits(res.newBalance);
          safeStorageSet('djassa_ai_credits', String(res.newBalance));
          showToast(`+${res.creditsAdded || 10} crédits quotidiens renouvelés ✨`);
        } else {
          safeStorageSet('djassa_client_free_last_renewal_at', String(Date.now()));
        }
      }).catch(() => {});
    };
    checkFreeRenewal();
    const timer = setInterval(checkFreeRenewal, 60000);
    return () => clearInterval(timer);
  }, [accountRole, userPlan, showToast]);

  const claimDailyBonus = useCallback((): boolean => {
    if (!getSecurityToken()) {
      showToast('Connectez-vous pour réclamer vos crédits quotidiens.');
      return false;
    }
    void creditsService.claimDailyBonus().then((res) => {
      if (res.success && typeof res.newBalance === 'number') {
        safeStorageSet('djassa_client_free_last_renewal_at', String(Date.now()));
        setAiCredits(res.newBalance);
        safeStorageSet('djassa_ai_credits', String(res.newBalance));
        showToast(`+${res.creditsAdded || 10} crédits gratuits ajoutés ! ✨`);
      } else if (res.message) {
        showToast(res.message);
      }
    }).catch((err: Error) => {
      showToast(err.message || 'Bonus quotidien indisponible pour le moment.');
    });
    return true;
  }, [showToast]);

  // Save changes to localStorage (isolate private collections so visitor browsing never overwrites authenticated storage)
  useEffect(() => {
    writeShared('djassa_sellers', sellers);
  }, [sellers]);

  useEffect(() => {
    writeShared('djassa_comments', comments);
  }, [comments]);

  useEffect(() => {
    if (!isAuthenticated) return;
    writeShared('djassa_orders', orders);
  }, [orders, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    writeShared('djassa_cart', cart);
  }, [cart, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    writeShared('djassa_conversations', conversations);
  }, [conversations, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    writeShared('djassa_messages', messages);
  }, [messages, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    writeShared('djassa_user_profile', userProfile);
  }, [userProfile, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    writeShared('djassa_notifs', notifications);
  }, [notifications, isAuthenticated]);
  useEffect(() => {
    writeShared('djassa_admin_users', adminUsers);
  }, [adminUsers]);

  useEffect(() => {
    writeShared('djassa_audit_logs', auditLogs);
  }, [auditLogs]);

  useEffect(() => {
    writeShared('djassa_platform_config', platformConfig);
  }, [platformConfig]);

  // Load public catalog & sync visitor AI quota when in Visitor Mode
  useEffect(() => {
    if (isAuthenticated) return;
    let active = true;
    void commerceService
      .getPublicCatalog()
      .then((res) => {
        if (!active || !res?.success) return;
        if (res.platformConfig) {
          setPlatformConfig((prev) => ({ ...prev, ...res.platformConfig }));
        }
        if (Array.isArray(res.products) && res.products.length > 0) {
          setProducts((prev) => {
            const byId = new Map(prev.map((p) => [p.id, p]));
            for (const sp of res.products) {
              const existing = byId.get(sp.id);
              byId.set(
                sp.id,
                normalizeProductMedia({
                  ...(existing || ({} as Product)),
                  id: sp.id,
                  name: sp.name,
                  description: sp.description || existing?.description || '',
                  price: sp.price,
                  originalPrice: sp.originalPrice ?? existing?.originalPrice,
                  discountPercentage: sp.discountPercentage ?? existing?.discountPercentage,
                  stock: sp.stock,
                  inStock: Boolean(sp.inStock),
                  category: sp.category || existing?.category || 'Mode',
                  sellerId: sp.sellerId,
                  location: existing?.location || 'Marché d’Adjamé',
                  rating: existing?.rating || 4.8,
                  salesCount: sp.salesCount ?? existing?.salesCount ?? 0,
                  reviewsCount: sp.reviewsCount ?? existing?.reviewsCount ?? 0,
                  images: (sp.images && sp.images.length > 0 ? sp.images : existing?.images) || [],
                  mediaType: existing?.mediaType || 'image',
                  variants: (Array.isArray(sp.variants) && sp.variants.length > 0 ? sp.variants : existing?.variants) || [],
                  variantStock: sp.variantStock || existing?.variantStock,
                  delivery: existing?.delivery || { estimatedDays: '1-2 jours', fee: 1500, mode: 'Express', location: 'Abidjan' },
                  conditions: existing?.conditions || {
                    isRefundable: true,
                    returnPeriodDays: 3,
                    returnConditions: ['Article sous blister'],
                    refundConditions: ['Sous 24h'],
                    nonRefundableSituations: ['Casse volontaire'],
                    fees: '0 FCFA',
                    procedure: 'Livraison et retour gérés directement par le vendeur'
                  },
                  specs: existing?.specs || {},
                  tags: existing?.tags || ['#Djassa']
                })
              );
            }
            return Array.from(byId.values());
          });
        }
      })
      .catch(() => {});

    const guestId = visitorService.getGuestId();
    void clientService
      .getVisitorQuota(guestId)
      .then((res) => {
        if (!active || !res?.success || !res.ai) return;
        if (res.ai.used > 0) {
          visitorService.recordGuestAiQuestion(res.ai.used);
          setVisitorQuota(visitorService.getQuotaSnapshot());
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const ensureSellerProfile = useCallback((user: AuthUserDTO) => {
    if (user.role === 'seller') {
      const targetSellerId = user.sellerId || user.id;
      setCurrentSellerId(targetSellerId);
      setSellers((prev) => {
        if (prev.some((s) => s.id === targetSellerId || (s.email && s.email.toLowerCase() === user.email.toLowerCase()))) {
          return prev;
        }
        const newSeller: Seller = {
          id: targetSellerId,
          name: user.name || 'Ma Boutique DJASSA',
          storeName: user.name || 'Ma Boutique DJASSA',
          username: (user.email.split('@')[0] || 'boutique').replace(/[^a-zA-Z0-9._]/g, ''),
          avatar: 'https://images.unsplash.com/photo-1589156280159-27698a70f29e?w=200',
          location: 'Abidjan, Côte d’Ivoire',
          verified: Boolean(user.kycVerified),
          rating: 4.8,
          reviewsCount: 0,
          followedCount: 0,
          salesCount: 0,
          bio: 'Boutique officielle partenaire DJASSA.',
          banner: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1000',
          phone: user.phone || '',
          email: user.email,
          badges: ['Boutique Active']
        };
        return [...prev, newSeller];
      });
    }
  }, []);

  const hydrateAuthenticatedUser = useCallback(async (user: AuthUserDTO) => {
    ensureSellerProfile(user);
    if (user.sellerId) setCurrentSellerId(user.sellerId);
    setUserProfile((prev) => ({
      ...prev,
      id: user.id,
      name: user.name || prev.name,
      email: user.email || prev.email,
      phone: user.phone || prev.phone
    }));
    try {
      const [boot, creditsBal, clientBoot] = await Promise.all([
        commerceService.bootstrap().catch(() => null),
        creditsService.getBalance().catch(() => null),
        clientService.bootstrap().catch(() => null)
      ]);
      if (boot?.success) {
        if (boot.platformConfig) {
          setPlatformConfig((prev) => ({ ...prev, ...boot.platformConfig }));
        }
        if (Array.isArray(boot.products) && boot.products.length > 0) {
          setProducts((prev) => {
            const byId = new Map(prev.map((p) => [p.id, p]));
            for (const sp of boot.products) {
              const existing = byId.get(sp.id);
              byId.set(
                sp.id,
                normalizeProductMedia({
                  ...(existing || ({} as Product)),
                  id: sp.id,
                  name: sp.name,
                  description: sp.description || existing?.description || '',
                  price: sp.price,
                  originalPrice: sp.originalPrice ?? existing?.originalPrice,
                  discountPercentage: sp.discountPercentage ?? existing?.discountPercentage,
                  stock: sp.stock,
                  inStock: Boolean(sp.inStock),
                  category: sp.category || existing?.category || 'Mode',
                  sellerId: sp.sellerId,
                  location: existing?.location || 'Marché d’Adjamé',
                  rating: existing?.rating || 4.8,
                  salesCount: sp.salesCount ?? existing?.salesCount ?? 0,
                  reviewsCount: sp.reviewsCount ?? existing?.reviewsCount ?? 0,
                  images: (sp.images && sp.images.length > 0 ? sp.images : existing?.images) || [],
                  mediaType: existing?.mediaType || 'image',
                  variants: (Array.isArray(sp.variants) && sp.variants.length > 0 ? sp.variants : existing?.variants) || [],
                  variantStock: sp.variantStock || existing?.variantStock,
                  delivery: existing?.delivery || { estimatedDays: '1-2 jours', fee: 1500, mode: 'Express', location: 'Abidjan' },
                  conditions: existing?.conditions || {
                    isRefundable: true,
                    returnPeriodDays: 3,
                    returnConditions: ['Article sous blister'],
                    refundConditions: ['Sous 24h'],
                    nonRefundableSituations: ['Casse volontaire'],
                    fees: '0 FCFA',
                    procedure: 'Livraison et retour gérés directement par le vendeur'
                  },
                  specs: existing?.specs || {},
                  tags: existing?.tags || ['#Djassa']
                })
              );
            }
            return Array.from(byId.values());
          });
        }
        if (Array.isArray(boot.orders) && boot.orders.length > 0 && (user.role === 'client' || user.role === 'seller')) {
          setOrders((prev) => {
            const byId = new Map(prev.map((o) => [o.id, o]));
            for (const so of boot.orders as any[]) {
              const existing = byId.get(so.id);
              byId.set(so.id, {
                ...(existing || ({} as Order)),
                id: so.id,
                orderNumber: so.orderNumber,
                items: so.items || existing?.items || [],
                subtotal: so.subtotal,
                discount: so.discount ?? 0,
                serviceFee: so.serviceFee ?? 0,
                clientFeeFcfa: so.clientFeeFcfa ?? so.serviceFee ?? 0,
                commissionFcfa: so.commissionFcfa ?? 150,
                commissionStatus: so.commissionStatus ?? existing?.commissionStatus ?? 'pending',
                sellerNetFcfa: so.sellerNetFcfa ?? Math.max(0, (so.subtotal || 0) - (so.discount ?? 0) - (so.commissionFcfa ?? 150)),
                sellerPayoutStatus: so.sellerPayoutStatus ?? existing?.sellerPayoutStatus,
                sellerPayoutReference: so.sellerPayoutReference ?? existing?.sellerPayoutReference,
                sellerPayoutChannel: so.sellerPayoutChannel ?? existing?.sellerPayoutChannel,
                sellerPayoutPhone: so.sellerPayoutPhone ?? existing?.sellerPayoutPhone,
                deliveryFee: 0,
                total: so.total,
                paymentMode: so.paymentMode || (so.paymentMethod === 'cash_on_delivery' ? 'cod' : 'online'),
                paymentMethod: so.paymentMethod,
                paymentStatus: so.paymentStatus,
                paymentTransactionRef: so.paymentTransactionRef || existing?.paymentTransactionRef,
                status: so.status === 'pending_payment' ? 'passed' : so.status,
                visibleStatus: 'Commande confirmée',
                createdAt: existing?.createdAt || so.createdAt,
                estimatedDelivery: existing?.estimatedDelivery || 'Livraison gérée par le vendeur',
                deliveryAddress: so.deliveryAddress || existing?.deliveryAddress,
                trackingEvents: so.trackingEvents || existing?.trackingEvents || []
              });
            }
            return Array.from(byId.values());
          });
        }
      }
      if (creditsBal && typeof creditsBal.balance === 'number') {
        setAiCredits(creditsBal.balance);
        safeStorageSet('djassa_ai_credits', String(creditsBal.balance));
        if (typeof creditsBal.activePlan === 'string' && creditsBal.activePlan && creditsBal.activePlan !== 'gratuit') {
          setUserPlanState(creditsBal.activePlan);
          safeStorageSet('djassa_user_plan', creditsBal.activePlan);
        }
      }
      if (clientBoot?.success) {
        if (clientBoot.preferences) {
          setClientPreferences(clientBoot.preferences);
          safeStorageSet('djassa_client_preferences', JSON.stringify(clientBoot.preferences));
        }
        if (Array.isArray(clientBoot.aiConversations)) {
          setAiConversations(clientBoot.aiConversations);
        }
        if (Array.isArray(clientBoot.tickets)) {
          setSupportTickets(clientBoot.tickets);
        }
        if (Array.isArray(clientBoot.sessions)) {
          setActiveUserSessions(clientBoot.sessions);
        }
        setUserProfile((prev) => ({
          ...prev,
          id: user.id,
          name: user.name || prev.name,
          email: user.email || prev.email,
          phone: user.phone || prev.phone,
          ...(clientBoot.profile?.username ? { username: clientBoot.profile.username } : {}),
          ...(clientBoot.profile?.bio !== undefined ? { bio: clientBoot.profile.bio } : {}),
          ...(clientBoot.profile?.avatar ? { avatar: clientBoot.profile.avatar } : {}),
          ...(clientBoot.profile?.commune ? { deliveryCommune: clientBoot.profile.commune } : {}),
          ...(clientBoot.profile?.quartier ? { deliveryQuartier: clientBoot.profile.quartier } : {}),
          ...(clientBoot.profile?.details !== undefined ? { deliveryAddressDetails: clientBoot.profile.details } : {}),
          ...(clientBoot.interactions ? {
            likedVideoIds: Array.isArray(clientBoot.interactions.likedVideoIds) && clientBoot.interactions.likedVideoIds.length > 0 ? clientBoot.interactions.likedVideoIds : prev.likedVideoIds,
            savedItemIds: Array.isArray(clientBoot.interactions.savedVideoIds) && clientBoot.interactions.savedVideoIds.length > 0 ? clientBoot.interactions.savedVideoIds : prev.savedItemIds,
            followedSellerIds: Array.isArray(clientBoot.interactions.followingSellerIds) && clientBoot.interactions.followingSellerIds.length > 0 ? clientBoot.interactions.followingSellerIds : prev.followedSellerIds,
            ...(Array.isArray(clientBoot.interactions.blockedSellerIds) ? { blockedSellerIds: clientBoot.interactions.blockedSellerIds } : {}),
            searchHistory: Array.isArray(clientBoot.interactions.searchHistory) && clientBoot.interactions.searchHistory.length > 0 ? clientBoot.interactions.searchHistory : prev.searchHistory
          } : {})
        }));
      }
    } catch {
      // keep existing UI state if offline
    }
  }, []);

  // Real server session validation, heartbeat & revocation/suspension enforcement
  useEffect(() => {
    if (!isAuthenticated || !accountRole) return;
    const tokenAtStart = getSecurityToken();
    if (!tokenAtStart) {
      setIsAuthenticated(false);
      setAccountRole(null);
      safeStorageSet('djassa_auth', 'false');
      safeStorageRemove('djassa_account_role');
      return;
    }

    let cancelled = false;
    void authService.me().then((meRes) => {
      if (cancelled) return;
      if (meRes?.unauthorized) {
        setIsAuthenticated(false);
        setAccountRole(null);
        safeStorageSet('djassa_auth', 'false');
        safeStorageRemove('djassa_account_role');
        safeStorageRemove('djassa_session_email');
        return;
      }
      if (!meRes?.success || !meRes.user) {
        return;
      }
      const rawRole = String(meRes.user.role || '');
      const nextRole: 'client' | 'seller' | 'admin' | null =
        rawRole === 'client' || rawRole === 'seller' || rawRole === 'admin' ? rawRole : null;
      if (!nextRole) {
        setIsAuthenticated(false);
        setAccountRole(null);
        safeStorageSet('djassa_auth', 'false');
        safeStorageRemove('djassa_account_role');
        return;
      }
      setAccountRole(nextRole);
      safeStorageSet('djassa_account_role', nextRole);
      safeStorageSet('djassa_session_email', meRes.user.email);
      void hydrateAuthenticatedUser(meRes.user);
    });

    const beat = async () => {
      if (cancelled) return;
      const currentToken = getSecurityToken();
      if (!currentToken || currentToken !== tokenAtStart) return;
      const email = safeStorageGet('djassa_session_email') || userProfile.email || '';
      const res = await securityService.sendSessionHeartbeat({
        userId: userProfile.id || email,
        userName: userProfile.name || email,
        userEmail: email,
        role: accountRole
      });
      if (cancelled || getSecurityToken() !== tokenAtStart) return;
      if (res?.status === 'revoked' || res?.status === 'reauth_required' || res?.status === 'suspended' || res?.status === 'expired') {
        void authService.logout();
        setIsAuthenticated(false);
        setAccountRole(null);
        safeStorageSet('djassa_auth', 'false');
        safeStorageRemove('djassa_account_role');
        showToast(res.reason || 'Session interrompue par mesure de sécurité.');
      }
    };
    const timer = window.setInterval(() => {
      void beat();
    }, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isAuthenticated, accountRole, hydrateAuthenticatedUser, showToast]);

  // Cross-app demo synchronization.
  // This keeps the four role interfaces coherent when opened under the same
  // browser origin. Separate production domains will use the same contract
  // through the backend/API adapter later.
  useEffect(() => {
    const parseArray = <T,>(key: string, fallback: T[]): T[] => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : fallback;
      } catch { return fallback; }
    };

    const refresh = (key: DjassaSharedKey) => {
      if (key === 'djassa_products') setProducts(parseArray<Product>(key, INITIAL_PRODUCTS).map(normalizeProductMedia));
      if (key === 'djassa_sellers') setSellers(parseArray<Seller>(key, INITIAL_SELLERS));
      if (key === 'djassa_admin_users') setAdminUsers(parseArray<AdminUserRecord>(key, INITIAL_ADMIN_USERS));
      if (key === 'djassa_audit_logs') setAuditLogs(parseArray<AdminAuditLog>(key, INITIAL_AUDIT_LOGS));
      if (key === 'djassa_platform_config') setPlatformConfig(readShared<PlatformConfig>(key, INITIAL_PLATFORM_CONFIG));
      if (!isAuthenticated) return;
      if (key === 'djassa_orders') setOrders(parseArray<Order>(key, INITIAL_ORDERS));
      if (key === 'djassa_conversations') setConversations(parseArray<Conversation>(key, INITIAL_CONVERSATIONS));
      if (key === 'djassa_messages') {
        try {
          const raw = localStorage.getItem(key);
          if (raw) setMessages(JSON.parse(raw));
        } catch {}
      }
      if (key === 'djassa_notifs') setNotifications(parseArray<NotificationItem>(key, INITIAL_NOTIFICATIONS));
    };

    return subscribeSharedChanges(refresh);
  }, [isAuthenticated]);

  // Call timer simulation
  useEffect(() => {
    let timer: any;
    if (activeCall && activeCall.status === 'connected') {
      timer = setInterval(() => {
        setActiveCall((prev) => prev ? { ...prev, durationSeconds: prev.durationSeconds + 1 } : null);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeCall?.status]);

  // Call auto-connect after ringing simulation (outgoing calls only; incoming awaits user action)
  useEffect(() => {
    let ringTimer: any;
    if (activeCall && activeCall.direction === 'outgoing' && (activeCall.status === 'connecting' || activeCall.status === 'ringing')) {
      ringTimer = setTimeout(() => {
        setActiveCall((prev) => prev ? { ...prev, status: 'connected' } : null);
      }, 2500);
    } else if (activeCall && activeCall.direction === 'incoming' && activeCall.status === 'ringing') {
      // Auto-missed call after 30s if not picked up
      ringTimer = setTimeout(() => {
        setActiveCall((prev) => {
          if (!prev) return null;
          return null;
        });
      }, 30000);
    }
    return () => clearTimeout(ringTimer);
  }, [activeCall?.status, activeCall?.direction]);

  // Memoized unread counts
  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );
  const unreadMessagesCount = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [conversations]
  );

  // Toggle follow seller (CLIENT -> SELLER ONLY; auth required)
  const toggleFollowSeller = (sellerId: string) => {
    if (!requireAuth('follow', { type: 'follow_seller', sellerId })) return;
    const isFollowed = userProfile.followedSellerIds.includes(sellerId);
    const updatedFollowed = isFollowed
      ? userProfile.followedSellerIds.filter((id) => id !== sellerId)
      : [...userProfile.followedSellerIds, sellerId];

    setUserProfile((prev) => ({
      ...prev,
      followedSellerIds: updatedFollowed
    }));
    if (getSecurityToken()) {
      void clientService.syncInteractions({ followingSellerIds: updatedFollowed }).catch(() => {});
    }

    setSellers((prev) =>
      prev.map((s) => {
        if (s.id === sellerId) {
          return {
            ...s,
            followedCount: isFollowed ? Math.max(0, s.followedCount - 1) : s.followedCount + 1
          };
        }
        return s;
      })
    );

    const targetSeller = sellers.find((s) => s.id === sellerId);
    showToast(isFollowed ? `Désabonné de ${targetSeller?.name || 'la boutique'}` : `Vous suivez maintenant ${targetSeller?.name || 'la boutique'}`);
  };

  // Toggle like video (allowed for visitors up to VISITOR_QUOTAS.dailyLikes with anti-bypass)
  const toggleLikeVideo = (productId: string) => {
    if (!isAuthenticated) {
      const res = visitorService.toggleGuestLike(productId);
      setVisitorQuota(visitorService.getQuotaSnapshot());
      if (!res.allowed) {
        showToast(`Limite quotidienne de ${VISITOR_QUOTAS.dailyLikes} J'aime atteinte en mode visiteur.`);
        openAuthModal('like_limit', { initialMode: 'register' });
        return;
      }
      setUserProfile((prev) => ({
        ...prev,
        likedVideoIds: res.likedVideoIds
      }));
      return;
    }

    const isLiked = userProfile.likedVideoIds.includes(productId);
    const nextLiked = isLiked
      ? userProfile.likedVideoIds.filter((id) => id !== productId)
      : [...userProfile.likedVideoIds, productId];
    setUserProfile((prev) => ({
      ...prev,
      likedVideoIds: nextLiked
    }));
    if (getSecurityToken()) {
      void clientService.syncInteractions({ likedVideoIds: nextLiked }).catch(() => {});
    }
  };

  // Toggle save product (allowed for visitors up to VISITOR_QUOTAS.dailyFavorites with anti-bypass)
  const toggleSaveProduct = (productId: string) => {
    if (!isAuthenticated) {
      const res = visitorService.toggleGuestFavorite(productId);
      setVisitorQuota(visitorService.getQuotaSnapshot());
      if (!res.allowed) {
        showToast(`Limite quotidienne de ${VISITOR_QUOTAS.dailyFavorites} favoris atteinte en mode visiteur.`);
        openAuthModal('favorite_limit', { initialMode: 'register' });
        return;
      }
      setUserProfile((prev) => ({
        ...prev,
        savedItemIds: res.savedProductIds
      }));
      showToast(res.isSavedNow ? 'Enregistré dans vos favoris visiteur 🔖' : 'Retiré de vos enregistrés');
      return;
    }

    const isSaved = userProfile.savedItemIds.includes(productId);
    const nextSaved = isSaved
      ? userProfile.savedItemIds.filter((id) => id !== productId)
      : [...userProfile.savedItemIds, productId];
    setUserProfile((prev) => ({
      ...prev,
      savedItemIds: nextSaved
    }));
    if (getSecurityToken()) {
      void clientService.syncInteractions({ savedVideoIds: nextSaved }).catch(() => {});
    }
    showToast(isSaved ? 'Retiré de vos enregistrés' : 'Enregistré dans votre profil 🔖');
  };

  // Cart operations (auth required)
  const addToCart = (productId: string, variantSelected: Record<string, string>, quantity: number = 1) => {
    if (!requireAuth('cart', { type: 'add_to_cart', productId, variantSelected, quantity })) return;
    const product = products.find((p) => p.id === productId);
    if (!product || quantity <= 0 || quantity > product.stock || !product.inStock) {
      showToast(product ? `Stock insuffisant pour ${product.name}.` : 'Produit indisponible.');
      return;
    }
    setCart((prev) => {
      const currentQuantity = prev.find((item) => item.productId === productId && JSON.stringify(item.variantSelected) === JSON.stringify(variantSelected))?.quantity || 0;
      if (currentQuantity + quantity > product.stock) {
        showToast(`Stock maximum disponible : ${product.stock}.`);
        return prev;
      }
      const existing = prev.find(
        (item) => item.productId === productId && JSON.stringify(item.variantSelected) === JSON.stringify(variantSelected)
      );
      if (existing) {
        return prev.map((item) =>
          item.id === existing.id ? { ...item, quantity: item.quantity + quantity, selected: true } : item
        );
      } else {
        const newItem: CartItem = {
          id: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          productId,
          variantSelected,
          quantity,
          selected: true,
          addedAt: new Date().toISOString()
        };
        return [newItem, ...prev];
      }
    });
    showToast('Produit ajouté au panier 🛒');
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
    showToast('Article retiré du panier');
  };

  const updateCartQuantity = (cartItemId: string, newQuantity: number) => {
    const cartItem = cart.find((item) => item.id === cartItemId);
    const product = cartItem ? products.find((p) => p.id === cartItem.productId) : undefined;
    if (product && newQuantity > product.stock) {
      showToast(`Stock maximum disponible : ${product.stock}.`);
      return;
    }
    if (newQuantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.id === cartItemId ? { ...item, quantity: newQuantity } : item))
    );
  };

  const toggleCartItemSelected = (cartItemId: string) => {
    setCart((prev) =>
      prev.map((item) => (item.id === cartItemId ? { ...item, selected: !item.selected } : item))
    );
  };

  // Create order (2 payment modes: online 6.5% client fee OR cod 0% client fee; seller manages external delivery; fixed 150 FCFA Djassa commission)
  const createOrder = async (
    items: { product: Product; variantSelected: Record<string, string>; quantity: number }[],
    paymentMethod: 'wave' | 'orange_money' | 'cash_on_delivery',
    address: {
      commune: string;
      quartier: string;
      details: string;
      landmark?: string;
      deliveryInstructions?: string;
      gpsCoords?: { lat: number; lng: number };
      recipientName: string;
      phone: string;
    },
    options?: {
      paymentMode?: 'online' | 'cod';
      payerPhone?: string;
      promoCode?: string;
      idempotencyKey?: string;
    }
  ): Promise<Order & { paymentUrl?: string | null; checkoutUrl?: string | null; providerConfigured?: boolean; paymentTransaction?: any }> => {
    if (!requireAuth('purchase', null)) {
      throw new Error('Connexion requise pour finaliser la commande.');
    }
    const sellerIds = Array.from(new Set(items.map((item) => item.product.sellerId)));
    if (sellerIds.length > 1) {
      throw new Error('Le panier contient des produits de plusieurs vendeurs. Finalisez chaque vendeur séparément.');
    }

    const quantityByProduct = new Map<string, number>();
    for (const item of items) quantityByProduct.set(item.product.id, (quantityByProduct.get(item.product.id) || 0) + item.quantity);
    for (const item of items) {
      const totalRequested = quantityByProduct.get(item.product.id) || 0;
      if (totalRequested <= 0 || totalRequested > item.product.stock) {
        throw new Error(`Stock insuffisant pour ${item.product.name}. Disponible : ${item.product.stock}.`);
      }
      if (item.product.variantStock) {
        const colorVal = item.variantSelected?.['Couleur'] || item.variantSelected?.['Color'] || '';
        const sizeVal = item.variantSelected?.['Taille'] || item.variantSelected?.['Pointure'] || item.variantSelected?.['Size'] || '';
        const comboKeys = [
          colorVal && sizeVal ? `${colorVal}-${sizeVal}` : '',
          colorVal && sizeVal ? `${colorVal} - ${sizeVal}` : ''
        ].filter(Boolean);
        let checkedCombo = false;
        for (const ck of comboKeys) {
          if (item.product.variantStock[ck] !== undefined) {
            checkedCombo = true;
            if (item.quantity > item.product.variantStock[ck]) {
              throw new Error(`Stock insuffisant pour la variante ${ck} (${item.product.variantStock[ck]} restant).`);
            }
          }
        }
        if (!checkedCombo) {
          for (const optVal of Object.values(item.variantSelected || {})) {
            if (optVal && item.product.variantStock[optVal] !== undefined && item.quantity > item.product.variantStock[optVal]) {
              throw new Error(`Stock insuffisant pour "${optVal}" (${item.product.variantStock[optVal]} restant).`);
            }
          }
        }
      }
    }

    const paymentMode: 'online' | 'cod' =
      options?.paymentMode || (paymentMethod === 'cash_on_delivery' ? 'cod' : 'online');

    const serverRes = await commerceService.createOrder({
      items: items.map((it) => ({
        productId: it.product.id,
        quantity: it.quantity,
        variant: it.variantSelected
      })),
      paymentMode,
      paymentMethod,
      ...(options?.payerPhone ? { payerPhone: options.payerPhone } : {}),
      deliveryAddress: {
        commune: address.commune,
        quartier: address.quartier,
        details: address.details,
        ...(address.landmark ? { landmark: address.landmark } : {}),
        ...(address.deliveryInstructions ? { deliveryInstructions: address.deliveryInstructions } : {}),
        ...(address.gpsCoords ? { gpsCoords: address.gpsCoords } : {}),
        recipientName: address.recipientName,
        phone: address.phone
      },
      ...(options?.promoCode ? { promoCode: options.promoCode } : {}),
      idempotencyKey: options?.idempotencyKey || `ord-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    });

    const srvOrder = serverRes.order;
    const now = new Date();
    const orderDateTime = now.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const subtotal = srvOrder.subtotal;
    const discount = srvOrder.discount ?? 0;
    const netMerchandise = Math.max(0, subtotal - discount);
    const clientFeeFcfa = srvOrder.clientFeeFcfa ?? srvOrder.serviceFee ?? (paymentMode === 'online' ? Math.round(netMerchandise * 0.065) : 0);
    const commissionFcfa = srvOrder.commissionFcfa ?? 150;
    const sellerNetFcfa = srvOrder.sellerNetFcfa ?? Math.max(0, netMerchandise - commissionFcfa);
    const total = srvOrder.total;
    const orderNumber = srvOrder.orderNumber;
    const orderId = srvOrder.id;
    const resolvedPaymentStatus = srvOrder.paymentStatus || (paymentMode === 'cod' ? 'cod_pending' : 'pending');
    const isPaymentPaid = resolvedPaymentStatus === 'paid';

    const orderItems = items.map(({ product, variantSelected, quantity }) => {
      const seller = sellers.find((s) => s.id === product.sellerId);
      return {
        productId: product.id,
        productTitle: product.name,
        productImage: product.images[0] || product.videoPoster,
        price: product.price,
        quantity,
        variant: variantSelected,
        sellerId: product.sellerId,
        sellerName: seller?.name || 'Boutique DJASSA'
      };
    });

    const paymentLabel =
      paymentMode === 'cod'
        ? 'Paiement à la livraison'
        : paymentMethod === 'orange_money'
        ? 'Orange Money'
        : 'Wave';

    const newOrder: Order = {
      id: orderId,
      orderNumber,
      items: orderItems,
      subtotal,
      deliveryFee: 0,
      serviceFee: clientFeeFcfa,
      clientFeeFcfa,
      commissionFcfa,
      commissionStatus: srvOrder.commissionStatus || 'pending',
      sellerNetFcfa,
      sellerPayoutStatus: srvOrder.sellerPayoutStatus || (paymentMode === 'online' ? 'pending' : 'not_applicable'),
      sellerPayoutReference: srvOrder.sellerPayoutReference,
      sellerPayoutChannel: srvOrder.sellerPayoutChannel,
      sellerPayoutPhone: srvOrder.sellerPayoutPhone,
      ...(srvOrder.promoCode || options?.promoCode ? { promoCode: srvOrder.promoCode || options?.promoCode } : {}),
      clientAvatar: userProfile.avatar,
      sellerAvatar: sellers.find((s) => s.id === sellerIds[0])?.avatar,
      discount,
      total,
      paymentMode,
      paymentMethod,
      paymentStatus: resolvedPaymentStatus,
      paymentTransactionRef: srvOrder.paymentTransactionRef || serverRes.payment?.id,
      status: 'passed',
      visibleStatus: 'Commande confirmée',
      createdAt: orderDateTime,
      estimatedDelivery: 'Livraison gérée par le vendeur',
      deliveryAddress: address,
      trackingEvents: [
        {
          status: 'passed',
          label: 'Commande confirmée',
          time: orderDateTime,
          done: true,
          description:
            paymentMode === 'cod'
              ? 'Paiement à la livraison. Le vendeur vous contactera pour organiser la livraison.'
              : isPaymentPaid
              ? `Paiement confirmé (${paymentLabel})`
              : `Paiement en ligne en attente de confirmation (${paymentLabel})`
        }
      ]
    };

    const purchasedProductIds = items.map((i) => i.product.id);
    setCart((prev) => prev.filter((c) => !purchasedProductIds.includes(c.productId)));

    setProducts((prev) => prev.map((product) => {
      const requested = quantityByProduct.get(product.id);
      if (!requested) return product;
      const nextStock = Math.max(0, product.stock - requested);
      let nextVariantStock = product.variantStock ? { ...product.variantStock } : undefined;
      if (nextVariantStock) {
        for (const it of items) {
          if (it.product.id !== product.id) continue;
          const colorVal = it.variantSelected?.['Couleur'] || it.variantSelected?.['Color'] || '';
          const sizeVal = it.variantSelected?.['Taille'] || it.variantSelected?.['Pointure'] || it.variantSelected?.['Size'] || '';
          const comboKeys = [
            colorVal && sizeVal ? `${colorVal}-${sizeVal}` : '',
            colorVal && sizeVal ? `${colorVal} - ${sizeVal}` : ''
          ].filter(Boolean);
          let matchedCombo = false;
          for (const ck of comboKeys) {
            if (nextVariantStock[ck] !== undefined) {
              matchedCombo = true;
              nextVariantStock[ck] = Math.max(0, nextVariantStock[ck] - it.quantity);
            }
          }
          if (!matchedCombo) {
            for (const optVal of Object.values(it.variantSelected || {})) {
              if (optVal && nextVariantStock[optVal] !== undefined) {
                nextVariantStock[optVal] = Math.max(0, nextVariantStock[optVal] - it.quantity);
              }
            }
          }
        }
      }
      return {
        ...product,
        stock: nextStock,
        ...(nextVariantStock ? { variantStock: nextVariantStock } : {}),
        inStock: nextStock > 0,
        salesCount: (product.salesCount || 0) + requested
      };
    }));

    setSellers((prev) => prev.map((seller) => {
      if (!sellerIds.includes(seller.id)) return seller;
      const sellerPurchasedQty = items
        .filter((item) => item.product.sellerId === seller.id)
        .reduce((sum, item) => sum + item.quantity, 0);
      return {
        ...seller,
        salesCount: (seller.salesCount || 0) + sellerPurchasedQty
      };
    }));

    setOrders((prev) => [newOrder, ...prev]);

    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: 'Commande confirmée',
      body: `Commande #${orderNumber} (${formatFCFA(total)}) • ${paymentLabel}. Le vendeur gère votre livraison.`,
      time: 'À l’instant',
      read: false,
      type: 'order',
      actionType: 'open_order',
      referenceId: orderId
    };
    setNotifications((prev) => [newNotif, ...prev]);

    return {
      ...newOrder,
      paymentUrl: serverRes.paymentUrl ?? serverRes.checkoutUrl ?? null,
      checkoutUrl: serverRes.checkoutUrl ?? serverRes.paymentUrl ?? null,
      providerConfigured: Boolean(serverRes.providerConfigured),
      paymentTransaction: serverRes.payment
    };
  };

  const createMultiSellerOrders = async (
    items: { product: Product; variantSelected: Record<string, string>; quantity: number }[],
    paymentMethod: 'wave' | 'orange_money' | 'cash_on_delivery',
    address: {
      commune: string;
      quartier: string;
      details: string;
      landmark?: string;
      deliveryInstructions?: string;
      gpsCoords?: { lat: number; lng: number };
      recipientName: string;
      phone: string;
    },
    options?: {
      paymentMode?: 'online' | 'cod';
      payerPhone?: string;
      promoCode?: string;
      idempotencyKey?: string;
    }
  ): Promise<{ checkoutGroupId: string; orders: Order[]; totalAmountFcfa: number; providerConfigured: boolean; paymentUrl?: string | null; checkoutUrl?: string | null }> => {
    if (!requireAuth('purchase', null)) {
      throw new Error('Connexion requise pour finaliser la commande.');
    }
    const paymentMode: 'online' | 'cod' =
      options?.paymentMode || (paymentMethod === 'cash_on_delivery' ? 'cod' : 'online');

    const serverRes = await commerceService.createMultiSellerOrders({
      items: items.map((it) => ({
        productId: it.product.id,
        quantity: it.quantity,
        variant: it.variantSelected
      })),
      paymentMode,
      paymentMethod,
      ...(options?.payerPhone ? { payerPhone: options.payerPhone } : {}),
      deliveryAddress: {
        commune: address.commune,
        quartier: address.quartier,
        details: address.details,
        ...(address.landmark ? { landmark: address.landmark } : {}),
        ...(address.deliveryInstructions ? { deliveryInstructions: address.deliveryInstructions } : {}),
        ...(address.gpsCoords ? { gpsCoords: address.gpsCoords } : {}),
        recipientName: address.recipientName,
        phone: address.phone
      },
      ...(options?.promoCode ? { promoCode: options.promoCode } : {}),
      idempotencyKey: options?.idempotencyKey || `mord-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    });

    const nowDateTime = new Date().toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const createdOrders: Order[] = (serverRes.orders || []).map((srvOrder: any) => {
      const resolvedPaymentStatus = srvOrder.paymentStatus || (paymentMode === 'cod' ? 'cod_pending' : 'pending');
      const netMerch = Math.max(0, (srvOrder.subtotal || 0) - (srvOrder.discount ?? 0));
      const clientFeeFcfa = srvOrder.clientFeeFcfa ?? srvOrder.serviceFee ?? (paymentMode === 'online' ? Math.round(netMerch * 0.065) : 0);
      const commissionFcfa = srvOrder.commissionFcfa ?? 150;
      return {
        id: srvOrder.id,
        orderNumber: srvOrder.orderNumber,
        items: srvOrder.items || [],
        subtotal: srvOrder.subtotal,
        deliveryFee: 0,
        serviceFee: clientFeeFcfa,
        clientFeeFcfa,
        commissionFcfa,
        commissionStatus: srvOrder.commissionStatus || 'pending',
        sellerNetFcfa: srvOrder.sellerNetFcfa ?? Math.max(0, netMerch - commissionFcfa),
        sellerPayoutStatus: srvOrder.sellerPayoutStatus || (paymentMode === 'online' ? 'pending' : 'not_applicable'),
        sellerPayoutReference: srvOrder.sellerPayoutReference,
        sellerPayoutChannel: srvOrder.sellerPayoutChannel,
        sellerPayoutPhone: srvOrder.sellerPayoutPhone,
        ...(srvOrder.promoCode ? { promoCode: srvOrder.promoCode } : {}),
        clientAvatar: userProfile.avatar,
        sellerAvatar: sellers.find((s) => s.id === srvOrder.sellerId)?.avatar,
        discount: srvOrder.discount ?? 0,
        total: srvOrder.total,
        paymentMode,
        paymentMethod,
        paymentStatus: resolvedPaymentStatus,
        paymentTransactionRef: srvOrder.paymentTransactionRef,
        status: 'passed',
        visibleStatus: 'Commande confirmée',
        createdAt: nowDateTime,
        estimatedDelivery: 'Livraison gérée par le vendeur',
        deliveryAddress: address,
        trackingEvents: Array.isArray(srvOrder.trackingEvents) ? srvOrder.trackingEvents : []
      };
    });

    const quantityByProduct = new Map<string, number>();
    for (const item of items) {
      quantityByProduct.set(item.product.id, (quantityByProduct.get(item.product.id) || 0) + item.quantity);
    }
    const purchasedProductIds = items.map((i) => i.product.id);
    setCart((prev) => prev.filter((c) => !purchasedProductIds.includes(c.productId)));

    setProducts((prev) =>
      prev.map((product) => {
        const requested = quantityByProduct.get(product.id);
        if (!requested) return product;
        const nextStock = Math.max(0, product.stock - requested);
        return {
          ...product,
          stock: nextStock,
          inStock: nextStock > 0,
          salesCount: (product.salesCount || 0) + requested
        };
      })
    );

    const sellerIds = Array.from(new Set(items.map((i) => i.product.sellerId)));
    setSellers((prev) =>
      prev.map((seller) => {
        if (!sellerIds.includes(seller.id)) return seller;
        const qty = items.filter((i) => i.product.sellerId === seller.id).reduce((s, i) => s + i.quantity, 0);
        return { ...seller, salesCount: (seller.salesCount || 0) + qty };
      })
    );

    setOrders((prev) => [...createdOrders, ...prev]);

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: `${createdOrders.length} commandes confirmées`,
        body: `Groupe ${serverRes.checkoutGroupId} (${formatFCFA(serverRes.totalAmountFcfa)}) : ${createdOrders.map((o) => `#${o.orderNumber}`).join(', ')}.`,
        time: 'À l’instant',
        read: false,
        type: 'order',
        actionType: 'open_order',
        referenceId: createdOrders[0]?.id
      },
      ...prev
    ]);

    return {
      checkoutGroupId: serverRes.checkoutGroupId,
      orders: createdOrders,
      totalAmountFcfa: serverRes.totalAmountFcfa,
      providerConfigured: Boolean(serverRes.providerConfigured),
      paymentUrl: serverRes.paymentUrl ?? serverRes.checkoutUrl ?? null,
      checkoutUrl: serverRes.checkoutUrl ?? serverRes.paymentUrl ?? null
    };
  };

  const submitOrderReview = (orderId: string, rating: number, comment: string) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          return {
            ...o,
            reviewGiven: {
              rating,
              comment,
              date: 'Aujourd’hui'
            }
          };
        }
        return o;
      })
    );

    if (targetOrder) {
      const sellerId = targetOrder.items[0]?.sellerId;
      if (sellerId) {
        setSellers((prev) =>
          prev.map((s) => {
            if (s.id === sellerId) {
              const prevCount = s.reviewsCount || 0;
              const nextCount = prevCount + 1;
              const nextRating = Number(((s.rating * prevCount + rating) / nextCount).toFixed(1));
              return { ...s, reviewsCount: nextCount, rating: nextRating };
            }
            return s;
          })
        );
      }
      const prodIds = targetOrder.items.map((i) => i.productId);
      setProducts((prev) =>
        prev.map((p) => {
          if (prodIds.includes(p.id)) {
            const prevCount = p.reviewsCount || Math.max(1, Math.round((p.salesCount || 10) * 0.15));
            const nextCount = prevCount + 1;
            const nextRating = Number(((p.rating * prevCount + rating) / nextCount).toFixed(1));
            return { ...p, reviewsCount: nextCount, rating: nextRating };
          }
          return p;
        })
      );
    }
    if (targetOrder) {
      if (getSecurityToken()) {
        void clientService.submitOrderReview(orderId, rating, comment).catch(() => {});
      }
      void securityService.recordActivity({
        category: 'orders',
        actionType: 'order_review_submitted',
        action: `Évaluation commande #${targetOrder.orderNumber} (${rating}★)`,
        target: `#${targetOrder.orderNumber}`,
        targetType: 'order',
        entityType: 'order',
        entityId: orderId,
        space: 'client',
        result: 'reussi',
        severity: 'information',
        beforeValue: null,
        afterValue: `${rating}/5 étoiles`,
        details: comment ? `Avis client : ${comment.slice(0, 120)}` : `Note ${rating}/5 attribuée`
      });
    }
    showToast('Merci ! Votre avis a été publié ⭐');
  };

  // Messaging operations
  const sendMessage = (
    conversationId: string, 
    content: string, 
    type: 'text' | 'image' | 'video' | 'audio' | 'product_card' | 'order_card' = 'text', 
    meta?: any
  ) => {
    if (!requireAuth('messages', { type: 'open_messages' })) return;
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      conversationId,
      senderId: userProfile.id,
      senderType: 'client',
      content,
      type,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'delivered',
      meta
    };

    setMessages((prev) => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), newMessage]
    }));

    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              lastMessage: type === 'audio' ? `🎤 Note vocale (${meta?.audioDuration || '0:10'})` : content,
              lastMessageTime: 'À l’instant',
              unreadCount: 0
            }
          : c
      )
    );

    const isReportOrClaim = Boolean(meta?.isClaim || meta?.isComplaint);
    void securityService.recordActivity({
      category: 'messaging',
      actionType: meta?.isClaim ? 'claim_submitted' : meta?.isComplaint ? 'driver_complaint_submitted' : 'message_sent',
      action: meta?.isClaim
        ? 'Réclamation produit transmise'
        : meta?.isComplaint
        ? 'Plainte / signalement livraison envoyé'
        : `Message envoyé (${type})`,
      target: conversationId,
      targetType: 'message',
      entityType: isReportOrClaim ? 'claim' : 'conversation',
      entityId: conversationId,
      space: (accountRole === 'seller' || accountRole === 'admin') ? accountRole : 'client',
      result: 'reussi',
      severity: isReportOrClaim ? 'moyen' : 'information',
      beforeValue: null,
      afterValue: type === 'audio' ? 'Note vocale' : content.slice(0, 120),
      details: isReportOrClaim ? `Signalement / réclamation enregistré sur ${conversationId}` : `Message ${type} transmis`
    });

    // Persist message on backend when authenticated (no fabricated fake auto-replies)
    const conv = conversations.find((c) => c.id === conversationId);
    if (getSecurityToken()) {
      const payloadBody = type === 'audio' ? `[Note vocale ${meta?.audioDuration || ''}] ${content}`.trim() : content;
      void commerceService
        .sendMessage(conversationId, payloadBody, conv?.participantId, conv?.participantName, {
          type,
          mediaUrl: meta?.mediaUrl || meta?.imageUrl || meta?.videoUrl || meta?.audioUrl,
          meta
        })
        .catch((err: Error) => {
          showToast(err.message || 'Impossible d’envoyer le message au serveur.');
        });
    }
  };

  const openChatWithSeller = (sellerId: string, relatedProductId?: string) => {
    if (!requireAuth('messages', { type: 'open_messages', sellerId, relatedProductId })) return;
    const seller = sellers.find((s) => s.id === sellerId);
    if (!seller) return;

    let existingConv = conversations.find(
      (c) => c.participantId === sellerId && c.participantType === 'seller'
    );

    if (!existingConv) {
      const newConvId = `conv-seller-${sellerId}-${Date.now()}`;
      existingConv = {
        id: newConvId,
        participantId: seller.id,
        participantType: 'seller',
        participantName: seller.name,
        participantAvatar: seller.avatar,
        participantVerified: seller.verified,
        participantRoleSubtitle: seller.location,
        lastMessage: 'Discussion démarrée',
        lastMessageTime: 'À l’instant',
        unreadCount: 0,
        relatedProductId,
        isOnline: true
      };

      setConversations((prev) => [existingConv!, ...prev]);
      setMessages((prev) => ({
        ...prev,
        [newConvId]: [
          {
            id: `msg-welcome-${Date.now()}`,
            conversationId: newConvId,
            senderId: seller.id,
            senderType: 'seller',
            content: `Bonjour et bienvenue chez ${seller.name} ! Comment puis-je vous aider sur nos articles à Adjamé ?`,
            type: 'text',
            timestamp: 'À l’instant',
            status: 'read'
          }
        ]
      }));
    }

    navigateToDiscussions(existingConv.id);
  };

  const navigateToDiscussions = (conversationId?: string) => {
    setActiveTab('discussions');
    setSellerActiveTab('discussions');
    if (conversationId) {
      setActiveConversationId(conversationId);
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
      );
    }
    // Close overlay modals
    setSelectedProductState(null);
    setSelectedSeller(null);
    setSelectedOrder(null);
    setVariantModalProduct(null);
    setSelectedVideoProductState(null);
  };

  const openChatWithParticipant = ({
    participantId,
    participantName,
    participantType,
    participantAvatar,
    participantRoleSubtitle,
    participantVerified = true,
    relatedOrderId,
    relatedProductId,
    initialMessage
  }: {
    participantId: string;
    participantName: string;
    participantType: 'seller' | 'client';
    participantAvatar?: string;
    participantRoleSubtitle?: string;
    participantVerified?: boolean;
    relatedOrderId?: string;
    relatedProductId?: string;
    initialMessage?: string;
  }) => {
    let existingConv = conversations.find(
      (c) => c.participantId === participantId || (relatedOrderId && c.relatedOrderId === relatedOrderId && c.participantType === participantType)
    );

    if (!existingConv) {
      const safeId = (participantId || 'user').replace(/[^a-zA-Z0-9]/g, '_');
      const newConvId = `conv-${participantType}-${safeId}-${Date.now()}`;
      existingConv = {
        id: newConvId,
        participantId,
        participantType,
        participantRole: participantType as any,
        participantName: participantName || (participantType === 'client' ? 'Client Djassa' : 'Boutique Partenaire'),
        participantAvatar: participantAvatar || (participantType === 'seller'
          ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
          : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'),
        participantVerified,
        participantRoleSubtitle: participantRoleSubtitle || (participantType === 'client' ? (relatedOrderId ? `Client • Commande #${relatedOrderId}` : 'Client Djassa') : 'Boutique Partenaire'),
        lastMessage: initialMessage || 'Discussion démarrée',
        lastMessageTime: 'À l’instant',
        unreadCount: 0,
        relatedOrderId,
        relatedProductId,
        isOnline: true,
        online: true
      };

      setConversations((prev) => [existingConv!, ...prev]);

      if (initialMessage) {
        setMessages((prev) => ({
          ...prev,
          [newConvId]: [
            {
              id: `msg-${Date.now()}`,
              conversationId: newConvId,
              senderId: 'current-user',
              senderType: accountRole === 'seller' ? 'seller' : 'client',
              content: initialMessage,
              type: 'text',
              timestamp: 'À l’instant',
              status: 'sent'
            }
          ]
        }));
      }
    } else if (initialMessage) {
      const msgId = `msg-${Date.now()}`;
      const newMsg: Message = {
        id: msgId,
        conversationId: existingConv.id,
        senderId: 'current-user',
        senderType: accountRole === 'seller' ? 'seller' : 'client',
        content: initialMessage,
        type: 'text',
        timestamp: 'À l’instant',
        status: 'sent'
      };
      setMessages((prev) => ({
        ...prev,
        [existingConv!.id]: [...(prev[existingConv!.id] || []), newMsg]
      }));
      setConversations((prev) =>
        prev.map((c) => c.id === existingConv!.id ? { ...c, lastMessage: initialMessage, lastMessageTime: 'À l’instant' } : c)
      );
    }

    navigateToDiscussions(existingConv.id);
  };

  const openChatWithClient = (clientPhone: string, clientName: string, relatedOrderId?: string, initialMessage?: string) => {
    const cleanId = clientPhone ? clientPhone.replace(/[^0-9]/g, '') : `client-${(clientName || 'anonyme').toLowerCase().replace(/\s+/g, '-')}`;
    openChatWithParticipant({
      participantId: cleanId || `client-${Date.now()}`,
      participantName: clientName || 'Client Djassa',
      participantType: 'client',
      participantRoleSubtitle: relatedOrderId ? `Client • Commande #${relatedOrderId}` : (clientPhone ? `Client • ${clientPhone}` : 'Client Djassa'),
      relatedOrderId,
      initialMessage: initialMessage || `Bonjour ${clientName || 'cher client'}, nous vous contactons depuis Djassa concernant votre commande ${relatedOrderId ? '#' + relatedOrderId : ''}.`
    });
  };

  const markConversationAsRead = (conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
    );
  };

  // Call operations (All unified on the Discussions page)
  const startCall = (
    participantId: string, 
    participantType: 'seller' | 'client',
    meta?: { name?: string; avatar?: string; role?: string; phone?: string; orderNumber?: string }
  ) => {
    let participantName = meta?.name || 'Correspondant';
    let participantAvatar = meta?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
    let participantRole = meta?.role || 'Djassa Marketplace';

    if (participantType === 'seller') {
      const seller = sellers.find((s) => s.id === participantId);
      if (seller) {
        participantName = meta?.name || seller.name;
        participantAvatar = meta?.avatar || seller.avatar;
        participantRole = meta?.role || `Vendeur • ${seller.location}`;
      } else {
        participantName = meta?.name || 'Boutique Partenaire';
        participantAvatar = meta?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
        participantRole = meta?.role || 'Vendeur Certifié';
      }
    } else {
      participantName = meta?.name || 'Client Djassa';
      participantRole = meta?.role || (meta?.orderNumber ? `Client Acheteur • Commande #${meta.orderNumber}` : 'Client • Acheteur');
      if (meta?.avatar) participantAvatar = meta.avatar;
    }

    let targetConv = conversations.find(
      (c) => c.participantId === participantId && c.participantType === participantType
    );

    if (!targetConv) {
      const newConvId = `conv-${participantType}-${participantId}-${Date.now()}`;
      targetConv = {
        id: newConvId,
        participantId,
        participantType,
        participantName,
        participantAvatar,
        participantVerified: true,
        participantRoleSubtitle: participantRole,
        lastMessage: 'Appel vocal sortant...',
        lastMessageTime: 'À l’instant',
        unreadCount: 0,
        isOnline: true
      };
      setConversations((prev) => [targetConv!, ...prev]);
    }

    navigateToDiscussions(targetConv.id);

    setActiveCall({
      participantId,
      participantName,
      participantAvatar,
      participantRole,
      participantType,
      direction: 'outgoing',
      conversationId: targetConv.id,
      status: 'ringing',
      durationSeconds: 0,
      isMuted: false,
      isSpeaker: true,
      isMinimized: false
    });
    showToast(`Appel vers ${participantName}... 📞`);
  };

  const receiveIncomingCall = (
    participantId?: string,
    participantType: 'seller' | 'client' = 'client',
    customName?: string,
    customRole?: string,
    customAvatar?: string
  ) => {
    let participantName = customName || (participantType === 'seller' 
      ? 'Boutique Wax & Chic (Vendeur)' 
      : 'Awa Coulibaly (Client)');
    let participantAvatar = customAvatar || (participantType === 'seller' 
      ? (sellers[0]?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150') 
      : 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150');
    let participantRole = customRole || (participantType === 'seller' 
      ? 'Vendeur Certifié • Adjamé Marché' 
      : 'Client • Abidjan Cocody');
    let pId = participantId || (participantType === 'seller' 
      ? sellers[0]?.id || 'seller-1' 
      : 'client-sample-1');

    if (participantType === 'seller' && !customName) {
      const s = sellers.find(sel => sel.id === pId) || sellers[0];
      if (s) {
        pId = s.id;
        participantName = s.name;
        participantAvatar = s.avatar;
        participantRole = `Vendeur • ${s.location}`;
      }
    }

    let targetConv = conversations.find(
      (c) => c.participantId === pId && c.participantType === participantType
    );

    if (!targetConv) {
      const newConvId = `conv-${participantType}-${pId}-${Date.now()}`;
      targetConv = {
        id: newConvId,
        participantId: pId,
        participantType,
        participantName,
        participantAvatar,
        participantVerified: true,
        participantRoleSubtitle: participantRole,
        lastMessage: 'Appel vocal entrant...',
        lastMessageTime: 'À l’instant',
        unreadCount: 1,
        isOnline: true
      };
      setConversations((prev) => [targetConv!, ...prev]);
    }

    // Direct user to discussions page for incoming call
    navigateToDiscussions(targetConv.id);

    setActiveCall({
      participantId: pId,
      participantName,
      participantAvatar,
      participantRole,
      participantType,
      direction: 'incoming',
      conversationId: targetConv.id,
      status: 'ringing',
      durationSeconds: 0,
      isMuted: false,
      isSpeaker: true,
      isMinimized: false
    });
    showToast(`Appel entrant de ${participantName} 📲`);
  };

  const acceptCall = () => {
    setActiveCall((prev) => prev ? { ...prev, status: 'connected', durationSeconds: 0 } : null);
    showToast('Appel décroché 🟢');
  };

  const rejectCall = () => {
    if (activeCall) {
      const convId = activeCall.conversationId || activeConversationId;
      if (convId) {
        const msg = activeCall.direction === 'incoming' 
          ? '📞 Appel entrant manqué / refusé' 
          : '📞 Appel sortant annulé';
        sendMessage(convId, msg, 'text');
      }
    }
    setActiveCall(null);
    showToast('Appel terminé 🔴');
  };

  const endCall = () => {
    if (activeCall) {
      const convId = activeCall.conversationId || activeConversationId;
      if (convId) {
        const sec = activeCall.durationSeconds;
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        const durationFormatted = sec > 0 ? `${m}m ${s < 10 ? '0' : ''}${s}s` : 'quelques secondes';
        const typeLabel = activeCall.direction === 'incoming' ? 'Appel entrant' : 'Appel sortant';
        sendMessage(
          convId,
          `📞 ${typeLabel} terminé • ${durationFormatted}`,
          'text'
        );
      }
    }
    setActiveCall(null);
    showToast('Appel terminé 📴');
  };

  const toggleCallMute = () => {
    setActiveCall((prev) => prev ? { ...prev, isMuted: !prev.isMuted } : null);
  };

  const toggleCallSpeaker = () => {
    setActiveCall((prev) => prev ? { ...prev, isSpeaker: !prev.isSpeaker } : null);
  };

  const toggleCallMinimized = () => {
    setActiveCall((prev) => prev ? { ...prev, isMinimized: !prev.isMinimized } : null);
  };

  // Comments operations (auth required)
  const addComment = (
    productId: string, 
    content: string, 
    options?: { audioUrl?: string; audioDuration?: number; gifUrl?: string; transcription?: string }
  ) => {
    if (!requireAuth('comment', { type: 'comment', productId })) return;
    const newComment: VideoComment = {
      id: `comm-${Date.now()}`,
      videoId: productId,
      userId: userProfile.id,
      userName: userProfile.name,
      userAvatar: userProfile.avatar,
      content,
      timestamp: 'À l’instant',
      likesCount: 0,
      isLikedByMe: false,
      replies: [],
      audioUrl: options?.audioUrl,
      audioDuration: options?.audioDuration,
      gifUrl: options?.gifUrl,
      transcription: options?.transcription
    };

    setComments((prev) => ({
      ...prev,
      [productId]: [newComment, ...(prev[productId] || [])]
    }));
    showToast(options?.audioUrl ? 'Note vocale publiée ! 🎤' : options?.gifUrl ? 'GIF publié ! 🎬' : 'Commentaire publié !');
  };

  const addCommentReply = (
    productId: string, 
    commentId: string, 
    content: string, 
    replyToUserName?: string,
    options?: { audioUrl?: string; audioDuration?: number; gifUrl?: string; transcription?: string }
  ) => {
    if (!requireAuth('comment', { type: 'comment', productId })) return;
    const newReply: VideoCommentReply = {
      id: `rep-${Date.now()}`,
      commentId,
      userId: userProfile.id,
      userName: userProfile.name,
      userAvatar: userProfile.avatar,
      replyToUserName,
      content,
      timestamp: 'À l’instant',
      likesCount: 0,
      isLikedByMe: false,
      audioUrl: options?.audioUrl,
      audioDuration: options?.audioDuration,
      gifUrl: options?.gifUrl,
      transcription: options?.transcription
    };

    setComments((prev) => {
      const productComments = prev[productId] || [];
      const updated = productComments.map((c) => {
        if (c.id === commentId) {
          return {
            ...c,
            replies: [...c.replies, newReply]
          };
        }
        return c;
      });
      return { ...prev, [productId]: updated };
    });
    showToast(options?.audioUrl ? 'Note vocale envoyée en réponse ! 🎤' : 'Réponse envoyée !');
  };

  const toggleLikeComment = (productId: string, commentId: string) => {
    if (!requireAuth('comment', { type: 'comment', productId })) return;
    setComments((prev) => {
      const productComments = prev[productId] || [];
      const updated = productComments.map((c) => {
        if (c.id === commentId) {
          return {
            ...c,
            isLikedByMe: !c.isLikedByMe,
            likesCount: c.isLikedByMe ? Math.max(0, c.likesCount - 1) : c.likesCount + 1
          };
        }
        return c;
      });
      return { ...prev, [productId]: updated };
    });
  };

  const toggleLikeReply = (productId: string, commentId: string, replyId: string) => {
    if (!requireAuth('comment', { type: 'comment', productId })) return;
    setComments((prev) => {
      const productComments = prev[productId] || [];
      const updated = productComments.map((c) => {
        if (c.id === commentId) {
          return {
            ...c,
            replies: c.replies.map((r) => {
              if (r.id === replyId) {
                return {
                  ...r,
                  isLikedByMe: !r.isLikedByMe,
                  likesCount: r.isLikedByMe ? Math.max(0, r.likesCount - 1) : r.likesCount + 1
                };
              }
              return r;
            })
          };
        }
        return c;
      });
      return { ...prev, [productId]: updated };
    });
  };

  const deleteComment = (productId: string, commentId: string) => {
    if (!requireAuth('comment', { type: 'comment', productId })) return;
    setComments((prev) => {
      const productComments = prev[productId] || [];
      return {
        ...prev,
        [productId]: productComments.filter((c) => c.id !== commentId)
      };
    });
    showToast('Commentaire supprimé');
  };

  const trackVideoWatch = useCallback((videoId: string, durationSec: number, completed: boolean) => {
    if (!isAuthenticated) {
      const nextGuestHistory = visitorService.recordGuestView(
        videoId,
        durationSec,
        completed ? 1 : Math.min(1, durationSec / 30)
      );
      setUserProfile((prev) => ({
        ...prev,
        viewingHistory: nextGuestHistory
      }));
      return;
    }

    setUserProfile((prev) => {
      const existingIdx = prev.viewingHistory.findIndex((h) => h.videoId === videoId);
      const newHistoryItem = {
        videoId,
        viewedAt: 'À l’instant',
        watchDurationSec: durationSec,
        completionRate: completed ? 1 : Math.min(1, durationSec / 30)
      };

      let newHistory = [...prev.viewingHistory];
      if (existingIdx >= 0) {
        newHistory[existingIdx] = newHistoryItem;
      } else {
        newHistory = [newHistoryItem, ...newHistory];
      }

      return {
        ...prev,
        viewingHistory: newHistory
      };
    });
  }, [isAuthenticated]);

  const removeHistoryItem = (videoId: string) => {
    if (!isAuthenticated) {
      const nextHistory = visitorService.removeGuestHistoryItem(videoId);
      setUserProfile((prev) => ({ ...prev, viewingHistory: nextHistory }));
      showToast('Élément retiré de l’historique');
      return;
    }
    setUserProfile((prev) => ({
      ...prev,
      viewingHistory: prev.viewingHistory.filter((h) => h.videoId !== videoId)
    }));
    if (getSecurityToken()) {
      void clientService.deleteViewingHistory(videoId).catch(() => {});
    }
    showToast('Élément retiré de l’historique');
  };

  const clearHistory = () => {
    if (!isAuthenticated) {
      visitorService.clearGuestHistory();
      setUserProfile((prev) => ({
        ...prev,
        viewingHistory: [],
        searchHistory: []
      }));
      showToast('Historique visiteur effacé');
      return;
    }
    setUserProfile((prev) => ({
      ...prev,
      viewingHistory: [],
      searchHistory: []
    }));
    if (getSecurityToken()) {
      void clientService.deleteViewingHistory().catch(() => {});
    }
    showToast('Historique effacé');
  };

  const clearTransientCache = useCallback(() => {
    try {
      const transientPrefixes = ['djassa_cache_', 'djassa_temp_', 'djassa_feed_cursor'];
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i);
        if (key && transientPrefixes.some((p) => key.startsWith(p))) {
          localStorage.removeItem(key);
        }
      }
      sessionStorage.clear();
    } catch {}
    showToast('Cache temporaire vidé (historique et données compte préservés) ✨');
  }, [showToast]);

  const disconnectSession = (sessionId: string) => {
    setUserProfile((prev) => ({
      ...prev,
      devices: prev.devices.filter((d) => d.id !== sessionId)
    }));
    setActiveUserSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    if (getSecurityToken()) {
      void clientService.revokeSession(sessionId).catch(() => {});
    }
    void securityService.recordActivity({
      category: 'security',
      actionType: 'device_session_disconnected',
      action: 'Déconnexion d’un appareil connecté',
      target: sessionId,
      targetType: 'session',
      entityType: 'session',
      entityId: sessionId,
      space: (accountRole === 'seller' || accountRole === 'admin') ? accountRole : 'client',
      result: 'reussi',
      severity: 'faible',
      beforeValue: 'Appareil actif',
      afterValue: 'Déconnecté',
      details: `Session appareil ${sessionId} fermée par l’utilisateur`
    });
    showToast('Appareil déconnecté');
  };

  const disconnectAllOtherSessions = () => {
    setUserProfile((prev) => ({
      ...prev,
      devices: prev.devices.filter((d) => d.isCurrent)
    }));
    setActiveUserSessions((prev) => prev.filter((s) => s.isCurrent));
    if (getSecurityToken()) {
      void clientService.revokeOtherSessions().catch(() => {});
    }
    void securityService.recordActivity({
      category: 'security',
      actionType: 'all_other_sessions_disconnected',
      action: 'Fermeture de toutes les autres sessions',
      target: userProfile.email,
      targetType: 'session',
      entityType: 'account',
      entityId: userProfile.id,
      space: (accountRole === 'seller' || accountRole === 'admin') ? accountRole : 'client',
      result: 'reussi',
      severity: 'moyen',
      beforeValue: 'Sessions multiples',
      afterValue: 'Session courante uniquement',
      details: 'Fermeture globale des autres appareils connectés'
    });
    showToast('Toutes les autres sessions ont été fermées');
  };

  const updateClientPreferences = useCallback(async (patch: Partial<ClientPreferencesDTO>) => {
    setClientPreferences((prev) => {
      const merged: ClientPreferencesDTO = {
        ...prev,
        ...patch,
        privacy: patch.privacy ? { ...prev.privacy, ...patch.privacy } : prev.privacy,
        notifications: patch.notifications ? { ...prev.notifications, ...patch.notifications } : prev.notifications,
        display: patch.display ? { ...prev.display, ...patch.display } : prev.display,
        dataSaver: patch.dataSaver ? { ...prev.dataSaver, ...patch.dataSaver } : prev.dataSaver,
        contentPreferences: patch.contentPreferences
          ? { ...prev.contentPreferences, ...patch.contentPreferences }
          : prev.contentPreferences,
        screenTime: patch.screenTime ? { ...prev.screenTime, ...patch.screenTime } : prev.screenTime
      };
      if (isAuthenticated) {
        safeStorageSet('djassa_client_preferences', JSON.stringify(merged));
      } else {
        visitorService.saveGuestPreferences({
          display: merged.display,
          language: merged.language,
          dataSaver: merged.dataSaver,
          contentPreferences: merged.contentPreferences
        });
      }
      return merged;
    });
    if (getSecurityToken()) {
      try {
        const res = await clientService.updatePreferences(patch);
        if (res?.preferences) {
          setClientPreferences(res.preferences);
          safeStorageSet('djassa_client_preferences', JSON.stringify(res.preferences));
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Erreur de sauvegarde des préférences');
      }
    }
  }, [showToast, isAuthenticated]);

  const saveAiConversation = useCallback(async (payload: {
    id?: string;
    title: string;
    dateLabel: string;
    messages: ClientAiConversationDTO['messages'];
  }) => {
    if (!getSecurityToken()) return null;
    try {
      const res = await clientService.saveAiConversation(payload);
      if (Array.isArray(res.conversations)) {
        setAiConversations(res.conversations);
      }
      return res.conversation;
    } catch {
      return null;
    }
  }, []);

  const deleteAiConversation = useCallback(async (id: string) => {
    setAiConversations((prev) => prev.filter((c) => c.id !== id));
    if (getSecurityToken()) {
      await clientService.deleteAiConversation(id).catch(() => {});
    }
  }, []);

  const createSupportTicket = useCallback(async (payload: {
    ticketType?: 'problem' | 'fraud' | 'claim';
    category: string;
    description: string;
    orderId?: string;
    contactEmail?: string;
    attachments?: Array<{ name: string; mimeType: string; size: number; dataUrl: string }>;
  }) => {
    if (!getSecurityToken()) {
      showToast('Veuillez vous connecter pour envoyer un signalement.');
      return null;
    }
    const res = await clientService.createTicket(payload);
    if (res?.ticket) {
      setSupportTickets((prev) => [res.ticket, ...prev]);
      return res.ticket;
    }
    return null;
  }, [showToast]);

  const openSupportChat = useCallback(async (topic?: string) => {
    const convId = `conv-support-${userProfile.id || 'client'}`;
    if (!getSecurityToken()) {
      openAuthModal('messages', { initialMode: 'register' });
      return;
    }
    try {
      const res = await clientService.openSupportChat(topic);
      const srvConv = res.conversation;
      const srvMsgs = Array.isArray(res.messages) ? res.messages : [];
      setConversations((prev) => {
        const filtered = prev.filter((c) => c.id !== srvConv.id);
        return [
          {
            id: srvConv.id,
            participantId: 'support-djassa',
            participantType: 'seller',
            participantName: srvConv.title || 'Support Client DJASSA',
            participantAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
            participantVerified: true,
            participantRoleSubtitle: 'Assistance officielle DJASSA',
            lastMessage: srvConv.lastMessage || 'Support disponible',
            lastMessageTime: 'À l’instant',
            unreadCount: 0,
            isOnline: true
          },
          ...filtered
        ];
      });
      setMessages((prev) => ({
        ...prev,
        [srvConv.id]: srvMsgs.map((m: any) => ({
          id: m.id,
          conversationId: srvConv.id,
          senderId: m.senderId,
          senderType: m.senderRole === 'client' ? 'client' : 'seller',
          content: m.body,
          type: 'text',
          timestamp: 'À l’instant',
          status: 'read'
        }))
      }));
      navigateToDiscussions(srvConv.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur d’ouverture du support');
    }
  }, [setConversations, setMessages, navigateToDiscussions, openAuthModal, showToast]);

  const updateProfileDetails = (
    name: string, 
    bio: string, 
    phone: string, 
    commune: string, 
    quartier: string, 
    details: string
  ) => {
    const prevSummary = `${userProfile.name} | ${userProfile.phone} | ${userProfile.deliveryCommune}`;
    setUserProfile((prev) => ({
      ...prev,
      name,
      bio,
      phone,
      deliveryCommune: commune,
      deliveryQuartier: quartier,
      deliveryAddressDetails: details
    }));
    void securityService.recordActivity({
      category: 'accounts',
      actionType: 'profile_details_updated',
      action: 'Modification du profil et des coordonnées',
      target: userProfile.email,
      targetType: 'account',
      entityType: 'account',
      entityId: userProfile.id,
      space: (accountRole === 'seller' || accountRole === 'admin') ? accountRole : 'client',
      result: 'reussi',
      severity: 'faible',
      beforeValue: prevSummary,
      afterValue: `${name} | ${phone} | ${commune} ${quartier}`,
      details: 'Profil utilisateur et adresse de livraison mis à jour'
    });
    showToast('Profil et coordonnées mis à jour !');
  };

  const userActivity = useMemo(
    () => ({
      totalMinutesSpent: userProfile.stats.timeWeekMinutes,
      watchTimeSeconds: userProfile.viewingHistory.reduce((sum, h) => sum + h.watchDurationSec, 0),
      completedVideosCount: userProfile.viewingHistory.filter((h) => h.completionRate >= 1).length,
      viewedProductIds: Array.from(new Set(userProfile.viewingHistory.map((h) => h.videoId))),
      commentsCount: (Object.values(comments) as VideoComment[][]).flat().filter((c) => c.userId === userProfile.id).length,
      likesCount: userProfile.likedVideoIds.length,
      savedCount: userProfile.savedItemIds.length,
      cartAddsCount: cart.length,
      purchasesCount: orders.filter((o) => o.status === 'delivered').length,
      followedSellersCount: userProfile.followedSellerIds.length
    }),
    [userProfile, comments, cart.length, orders]
  );

  const updateProfile = (data: Partial<UserProfile> & { commune?: string }) => {
    const safeData = { ...data } as Record<string, unknown>;
    delete safeData.role;
    delete safeData.accountRole;
    if (data.email && data.email !== userProfile.email) {
      void securityService.reportProfileChange({
        changeType: 'email',
        targetEmail: data.email,
        details: `Nouvel email demandé : ${data.email}`
      }).catch((err: Error) => {
        showToast(err.message || 'Modification bloquée par la sécurité.');
      });
    }
    if (data.phone && data.phone !== userProfile.phone) {
      void securityService.reportProfileChange({
        changeType: 'phone',
        targetEmail: userProfile.email,
        details: `Nouveau numéro : ${data.phone}`
      }).catch(() => {});
    }
    setUserProfile((prev) => ({
      ...prev,
      ...(safeData as Partial<UserProfile>),
      ...(data.commune !== undefined ? { deliveryCommune: data.commune } : {})
    }));
    void securityService.recordActivity({
      category: 'accounts',
      actionType: 'profile_updated',
      action: 'Mise à jour du profil compte',
      target: userProfile.email,
      targetType: 'account',
      entityType: 'account',
      entityId: userProfile.id,
      space: (accountRole === 'seller' || accountRole === 'admin') ? accountRole : 'client',
      result: 'reussi',
      severity: data.email || data.phone ? 'eleve' : 'information',
      beforeValue: JSON.stringify({ name: userProfile.name, email: userProfile.email, phone: userProfile.phone }),
      afterValue: JSON.stringify(safeData),
      details: `Champs modifiés : ${Object.keys(safeData).join(', ') || 'profil'}`
    });
  };

  const getAllowedNextStatuses = (status: OrderStatus): OrderStatus[] => {
    const transitions: Record<OrderStatus, OrderStatus[]> = {
      pending_payment: ['passed', 'payment_confirmed', 'cancelled'],
      passed: ['payment_confirmed', 'preparing', 'ready_for_pickup', 'in_delivery', 'delivered', 'cancelled', 'damaged'],
      payment_confirmed: ['preparing', 'ready_for_pickup', 'in_delivery', 'delivered', 'cancelled', 'damaged'],
      preparing: ['ready_for_pickup', 'in_delivery', 'delivered', 'cancelled', 'damaged'],
      ready_for_pickup: ['in_delivery', 'delivered', 'cancelled', 'damaged'],
      driver_assigned: ['in_delivery', 'delivered', 'damaged', 'returned', 'cancelled'],
      in_delivery: ['delivered', 'cancelled', 'returned', 'damaged'],
      delivered: ['returned', 'damaged'],
      cancelled: [],
      returned: [],
      damaged: []
    };
    return transitions[status] || [];
  };

  const cancelOrder = (orderId: string) => {
    const target = orders.find((o) => o.id === orderId);
    if (!target || !getAllowedNextStatuses(target.status).includes('cancelled')) {
      void securityService.recordActivity({
        category: 'orders',
        actionType: 'order_cancel_refused',
        action: `Annulation de commande refusée (#${target?.orderNumber || orderId})`,
        target: `#${target?.orderNumber || orderId}`,
        targetType: 'order',
        entityType: 'order',
        entityId: orderId,
        space: accountRole === 'seller' ? 'seller' : 'client',
        result: 'refuse',
        severity: 'faible',
        beforeValue: target?.status || null,
        afterValue: 'Transition non autorisée',
        details: 'Tentative d’annulation impossible au statut actuel'
      });
      showToast('Cette commande ne peut plus être annulée.');
      return;
    }
    updateOrderStatus(orderId, 'cancelled');
  };

  const confirmOrderDelivered = (orderId: string) => {
    const target = orders.find((o) => o.id === orderId);
    if (!target || target.status !== 'in_delivery') {
      showToast('La commande doit être en cours de livraison avant confirmation.');
      return;
    }
    updateOrderStatus(orderId, 'delivered');
    showToast('Réception de la commande confirmée');
  };

  const reportOrderIncident = (orderId: string, incident: OrderIncident) => {
    const statusMap: Record<OrderIncident['type'], OrderStatus> = {
      damaged: 'damaged',
      returned: 'returned',
      cancelled: 'cancelled'
    };
    const targetStatus = statusMap[incident.type];
    const targetOrder = orders.find((o) => o.id === orderId);

    const nowTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const newTrackingEvent = {
          status: targetStatus,
          label: incident.type === 'damaged' 
            ? 'Colis endommagé signalé' 
            : incident.type === 'returned' 
            ? 'Colis en retour enregistré' 
            : 'Commande annulée',
          time: nowTime,
          done: true,
          description: incident.reason + (incident.details ? ` - ${incident.details}` : '')
        };
        return {
          ...o,
          status: targetStatus,
          incident,
          trackingEvents: [...o.trackingEvents, newTrackingEvent]
        };
      })
    );

    void securityService.recordActivity({
      category: 'orders',
      actionType: `order_incident_${incident.type}`,
      action:
        incident.type === 'damaged'
          ? `Signalement colis endommagé (#${targetOrder?.orderNumber || orderId})`
          : incident.type === 'returned'
          ? `Retour de colis enregistré (#${targetOrder?.orderNumber || orderId})`
          : `Incident / annulation commande (#${targetOrder?.orderNumber || orderId})`,
      target: `#${targetOrder?.orderNumber || orderId}`,
      targetType: 'order',
      entityType: 'order',
      entityId: orderId,
      space: (accountRole === 'seller' || accountRole === 'admin') ? accountRole : 'client',
      result: 'reussi',
      severity: incident.type === 'damaged' ? 'eleve' : 'moyen',
      beforeValue: targetOrder?.status || null,
      afterValue: targetStatus,
      details: `${incident.reason}${incident.details ? ` — ${incident.details}` : ''}`
    });

    const message = incident.type === 'damaged'
      ? 'Signalement de colis endommagé enregistré avec succès ⚠️'
      : incident.type === 'returned'
      ? 'Procédure de retour de colis enclenchée 🔄'
      : 'Commande marquée comme annulée ❌';
    showToast(message);
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    const existingOrder = orders.find((o) => o.id === orderId);
    let changed = false;
    setOrders((prev) => prev.map((o) => {
      if (o.id !== orderId || o.status === status) return o;
      if (!getAllowedNextStatuses(o.status).includes(status)) return o;
      changed = true;
      return { ...o, status, visibleStatus: 'Commande confirmée' };
    }));
    if (changed) {
      if (getSecurityToken()) {
        void commerceService.updateOrderStatus(orderId, status).catch((err: Error) => {
          showToast(err.message || 'Synchronisation du statut refusée par le serveur.');
        });
      }
      void securityService.recordActivity({
        category: 'orders',
        actionType: `order_status_${status}`,
        action: `Commande confirmée (#${existingOrder?.orderNumber || orderId})`,
        target: `#${existingOrder?.orderNumber || orderId}`,
        targetType: 'order',
        entityType: 'order',
        entityId: orderId,
        space: (accountRole === 'seller' || accountRole === 'admin') ? accountRole : 'client',
        result: 'reussi',
        severity: status === 'cancelled' ? 'moyen' : 'information',
        beforeValue: existingOrder?.status || null,
        afterValue: status,
        details: `Statut technique commande mis à jour (${status})`
      });
      showToast('Commande confirmée');
    } else if (status !== 'passed') {
      showToast('Mise à jour de commande impossible.');
    }
  };

  const addPublication = (publication: Partial<Product>) => {
    const newProduct: Product = {
      id: `prod-pub-${Date.now()}`,
      name: publication.name || 'Nouvel arrivage Adjamé',
      description: publication.description || '',
      images: publication.images && publication.images.length > 0 ? publication.images : ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=80'],
      price: publication.price ?? 15000,
      stock: publication.stock ?? 12,
      category: publication.category || 'Tech',
      sellerId: publication.sellerId || currentSellerId,
      location: publication.location || 'Marché Black d’Adjamé, Allée 4',
      rating: 5.0,
      salesCount: publication.salesCount || 0,
      reviewsCount: publication.reviewsCount || 0,
      inStock: (publication.stock ?? 12) > 0,
      mediaType: publication.mediaType || 'image',
      videoUrl: publication.videoUrl,
      videoPoster: publication.videoPoster || publication.images?.[0],
      variants: publication.variants || [],
      variantStock: publication.variantStock,
      variantImages: publication.variantImages,
      originalPrice: publication.originalPrice,
      delivery: publication.delivery || {
        estimatedDays: 'Gérée par le vendeur',
        fee: 0,
        mode: 'Vendeur',
        location: 'Abidjan'
      },
      conditions: publication.conditions || {
        isRefundable: true,
        returnPeriodDays: 3,
        returnConditions: ['Article sous blister ou emballage d’origine'],
        refundConditions: ['Remboursement Wave/OM sous 24h'],
        nonRefundableSituations: ['Casse ou dégradation volontaire'],
        fees: '0 FCFA',
        procedure: 'Échange ou retour géré directement avec le vendeur'
      },
      specs: publication.specs || {},
      tags: publication.tags || ['#Djassa', '#Adjamé', '#Nouveauté'],
      contentType: publication.contentType || 'publication'
    };
    setProducts((prev) => [newProduct, ...prev]);
    if (getSecurityToken()) {
      void commerceService.createProduct({
        name: newProduct.name,
        description: newProduct.description,
        price: newProduct.price,
        originalPrice: newProduct.originalPrice,
        stock: newProduct.stock,
        category: newProduct.category,
        images: newProduct.images,
        sellerId: newProduct.sellerId
      }).then((res) => {
        if (res?.product?.id) {
          setProducts((prev) => prev.map((p) => (p.id === newProduct.id ? { ...p, id: res.product.id } : p)));
        }
      }).catch((err: Error) => {
        showToast(err.message || 'Erreur lors de l’enregistrement produit côté serveur.');
      });
    }
    void securityService.recordActivity({
      category: 'products',
      actionType: 'seller_product_created',
      action: `Ajout produit : ${newProduct.name}`,
      target: newProduct.name,
      targetType: 'product',
      entityType: 'product',
      entityId: newProduct.id,
      space: 'seller',
      result: 'reussi',
      severity: 'information',
      beforeValue: null,
      afterValue: `${formatFCFA(newProduct.price)} • Stock ${newProduct.stock}`,
      details: `Produit ajouté dans la boutique ${newProduct.sellerId} (${newProduct.category})`
    });
    showToast(publication.contentType === 'product' ? 'Produit ajouté à votre boutique ! 🎉' : 'Publication mise en ligne dans votre boutique ! 🎉');
  };

  const updateProductSeller = (productId: string, updates: Partial<Product>) => {
    const target = products.find((p) => p.id === productId && p.sellerId === currentSellerId);
    if (!target) {
      void securityService.recordActivity({
        category: 'security',
        actionType: 'unauthorized_product_edit',
        action: 'Modification produit refusée (hors boutique)',
        target: productId,
        targetType: 'product',
        entityType: 'product',
        entityId: productId,
        space: 'seller',
        result: 'refuse',
        severity: 'eleve',
        beforeValue: null,
        afterValue: 'Refusé',
        details: `Tentative d’édition de ${productId} non autorisée`
      });
      showToast('Produit introuvable ou non autorisé.');
      return;
    }
    setProducts((prev) => prev.map((p) => p.id === productId && p.sellerId === currentSellerId
      ? { ...p, ...updates, inStock: updates.stock !== undefined ? updates.stock > 0 : p.inStock }
      : p
    ));
    if (getSecurityToken()) {
      void commerceService.updateProduct(productId, updates as Record<string, unknown>).catch((err: Error) => {
        showToast(err.message || 'Erreur lors de la mise à jour du produit.');
      });
    }
    const isPriceChange = updates.price !== undefined && updates.price !== target.price;
    const isStockChange = updates.stock !== undefined && updates.stock !== target.stock;
    void securityService.recordActivity({
      category: 'products',
      actionType: isPriceChange ? 'product_price_updated' : isStockChange ? 'product_stock_updated' : 'product_updated',
      action: isPriceChange
        ? `Modification prix : ${target.name}`
        : isStockChange
        ? `Modification stock : ${target.name}`
        : `Modification produit : ${target.name}`,
      target: target.name,
      targetType: 'product',
      entityType: 'product',
      entityId: productId,
      space: 'seller',
      result: 'reussi',
      severity: isPriceChange ? 'faible' : 'information',
      beforeValue: JSON.stringify({ price: target.price, stock: target.stock, name: target.name }),
      afterValue: JSON.stringify({
        price: updates.price ?? target.price,
        stock: updates.stock ?? target.stock,
        name: updates.name ?? target.name
      }),
      details: `Champs modifiés : ${Object.keys(updates).join(', ')}`
    });
    showToast('Produit mis à jour ✨');
  };

  const deleteProductSeller = (productId: string) => {
    const target = products.find((p) => p.id === productId && p.sellerId === currentSellerId);
    if (!target) { showToast('Produit introuvable ou non autorisé.'); return; }
    setProducts((prev) => prev.filter((p) => p.id !== productId || p.sellerId !== currentSellerId));
    if (getSecurityToken()) {
      void commerceService.deleteProduct(productId).catch((err: Error) => {
        showToast(err.message || 'Suppression du produit refusée par le serveur.');
      });
    }
    void securityService.recordActivity({
      category: 'products',
      actionType: 'seller_product_deleted',
      action: `Suppression produit : ${target.name}`,
      target: target.name,
      targetType: 'product',
      entityType: 'product',
      entityId: productId,
      space: 'seller',
      result: 'reussi',
      severity: 'moyen',
      beforeValue: `${formatFCFA(target.price)} • Stock ${target.stock}`,
      afterValue: 'Supprimé',
      details: `Produit retiré de la boutique par le vendeur`
    });
    showToast('Produit supprimé de la boutique.');
  };

  const updateSeller = (sellerId: string, updates: Partial<Seller>) => {
    if (accountRole !== 'admin' && sellerId !== currentSellerId) {
      void securityService.recordActivity({
        category: 'security',
        actionType: 'unauthorized_store_edit',
        action: 'Tentative de modification boutique tierce refusée',
        target: sellerId,
        targetType: 'store',
        entityType: 'store',
        entityId: sellerId,
        space: 'seller',
        result: 'refuse',
        severity: 'critique',
        beforeValue: null,
        afterValue: 'Accès refusé',
        details: `Tentative non autorisée sur la boutique ${sellerId}`
      });
      showToast('Accès refusé : vous ne pouvez modifier que votre propre boutique.');
      return;
    }
    const targetSeller = sellers.find((s) => s.id === sellerId);
    setSellers((prev) => prev.map((s) => s.id === sellerId ? { ...s, ...updates } : s));
    void securityService.recordActivity({
      category: 'products',
      actionType: 'seller_store_updated',
      action: 'Modification des informations boutique',
      target: targetSeller?.name || sellerId,
      targetType: 'store',
      entityType: 'store',
      entityId: sellerId,
      space: accountRole === 'admin' ? 'admin' : 'seller',
      result: 'reussi',
      severity: 'faible',
      beforeValue: targetSeller ? JSON.stringify({ name: targetSeller.name, location: targetSeller.location }) : null,
      afterValue: JSON.stringify(updates),
      details: `Boutique ${targetSeller?.name || sellerId} mise à jour`
    });
    showToast('Boutique mise à jour avec succès !');
  };

  const handleSetAccountRole = (role: 'client' | 'seller' | 'admin' | null) => {
    if (role === null) {
      setAccountRole(null);
      safeStorageRemove('djassa_account_role');
      return;
    }
    if (!isAuthenticated) {
      showToast('Veuillez vous connecter pour accéder à cet espace.');
      return;
    }
    if (role !== accountRole) {
      void securityService.recordActivity({
        category: 'security',
        actionType: 'self_role_change_blocked',
        action: 'Tentative d’auto-modification de rôle bloquée',
        target: `${accountRole} -> ${role}`,
        targetType: 'account',
        space: (accountRole === 'seller' || accountRole === 'admin') ? accountRole : 'client',
        result: 'bloque',
        severity: 'critique',
        beforeValue: String(accountRole),
        afterValue: `Rejeté (${role})`,
        details: 'Un utilisateur ne peut jamais modifier son propre rôle'
      });
      showToast('Accès refusé : un utilisateur ne peut pas modifier son propre rôle.');
      return;
    }
    setAccountRole(role);
    safeStorageSet('djassa_account_role', role);
  };

  const updatePlatformConfig = (updates: Partial<PlatformConfig>) => {
    const prevSnapshot = JSON.stringify({
      marketplaceCommissionRate: platformConfig.marketplaceCommissionRate,
      baseDeliveryFee: platformConfig.baseDeliveryFee,
      maintenanceMode: platformConfig.maintenanceMode,
      requireKycForSellers: platformConfig.requireKycForSellers
    });
    setPlatformConfig((prev) => {
      const next = { ...prev, ...updates };
      writeShared('djassa_platform_config', next);
      return next;
    });
    if (getSecurityToken()) {
      void commerceService.updatePlatformConfig(updates as Record<string, unknown>).catch((err: Error) => {
        showToast(err.message || 'Mise à jour de configuration refusée par le serveur.');
      });
    }
    void securityService.recordActivity({
      category: 'system_config',
      actionType: 'platform_config_updated',
      action: 'Modification des paramètres plateforme',
      target: 'platformConfig',
      targetType: 'settings',
      entityType: 'settings',
      entityId: 'djassa_platform_config',
      space: 'admin',
      result: 'reussi',
      severity: 'moyen',
      beforeValue: prevSnapshot,
      afterValue: JSON.stringify(updates),
      details: `Paramètres modifiés : ${Object.keys(updates).join(', ')}`
    });
    showToast('Configuration système mise à jour ⚙️');
  };

  const addAuditLog = (
    action: string,
    target: string,
    category: AdminAuditLog['category'],
    details: string,
    meta?: {
      activityCategory?: import('../types/security').ActivityCategory;
      actionType?: string;
      entityType?: string;
      entityId?: string;
      severity?: import('../types/security').AlertSeverityLevel;
      result?: import('../types/security').ActivityResultStatus;
      beforeValue?: string;
      afterValue?: string;
      financialTrace?: import('../types/security').FinancialTraceDetails;
    }
  ) => {
    const newLog: AdminAuditLog = {
      id: `log-${Date.now()}`,
      adminName: 'Alpha Tchobo (Admin)',
      action,
      target,
      category,
      timestamp: 'À l’instant',
      details
    };
    setAuditLogs((prev) => {
      const updated = [newLog, ...prev];
      writeShared('djassa_audit_logs', updated);
      return updated;
    });

    const catStr = String(category);
    const mappedCategory =
      meta?.activityCategory ||
      (catStr === 'financial' || catStr === 'finance'
        ? 'payments'
        : catStr === 'order'
        ? 'orders'
        : catStr === 'security'
        ? 'security'
        : catStr === 'marketplace'
        ? 'products'
        : catStr === 'system'
        ? (action.toLowerCase().includes('api') || target.toLowerCase().includes('api') ? 'api' : 'system_config')
        : 'admin_mgmt');

    void securityService.recordActivity({
      category: mappedCategory,
      actionType: meta?.actionType,
      action,
      target,
      targetType:
        catStr === 'financial' || catStr === 'finance'
          ? 'finance'
          : catStr === 'order'
          ? 'order'
          : catStr === 'marketplace'
          ? 'product'
          : catStr === 'system'
          ? 'settings'
          : 'account',
      entityType: meta?.entityType,
      entityId: meta?.entityId,
      space: 'admin',
      result: meta?.result || 'reussi',
      severity: meta?.severity || (catStr === 'security' || catStr === 'system' ? 'moyen' : 'faible'),
      beforeValue: meta?.beforeValue,
      afterValue: meta?.afterValue,
      financialTrace: meta?.financialTrace,
      details
    });
  };

  const verifyUserKyc = (userId: string) => {
    setAdminUsers((prev) => {
      const updated = prev.map((u) => u.id === userId ? { ...u, kycVerified: true, status: 'active' as const } : u);
      writeShared('djassa_admin_users', updated);
      return updated;
    });
    const targetUser = adminUsers.find((u) => u.id === userId);
    addAuditLog('Validation KYC / Certification', targetUser?.name || userId, 'user', 'Compte certifié avec badge officiel', {
      activityCategory: 'admin_mgmt',
      actionType: 'admin_kyc_verified',
      entityType: 'account',
      entityId: userId,
      severity: 'moyen',
      beforeValue: targetUser?.kycVerified ? 'Certifié' : 'En attente KYC',
      afterValue: 'Certifié (Actif)'
    });
    showToast(`Utilisateur ${targetUser?.name || ''} certifié avec succès ! 🛡️`);
  };

  const toggleUserSuspension = (userId: string) => {
    const targetUser = adminUsers.find((u) => u.id === userId);
    const newStatus: 'active' | 'suspended' = targetUser?.status === 'suspended' ? 'active' : 'suspended';
    const userName = targetUser?.name || userId;

    setAdminUsers((prev) => {
      const updated = prev.map((u) => u.id === userId ? { ...u, status: newStatus } : u);
      writeShared('djassa_admin_users', updated);
      return updated;
    });

    addAuditLog(
      newStatus === 'suspended' ? 'Suspension de compte' : 'Réactivation de compte',
      userName,
      'security',
      newStatus === 'suspended' ? 'Compte bloqué pour vérification' : 'Accès rétabli',
      {
        activityCategory: 'admin_mgmt',
        actionType: newStatus === 'suspended' ? 'admin_account_suspended' : 'admin_account_reactivated',
        entityType: 'account',
        entityId: userId,
        severity: newStatus === 'suspended' ? 'eleve' : 'moyen',
        beforeValue: targetUser?.status || 'active',
        afterValue: newStatus
      }
    );
    if (accountRole === 'admin' && targetUser) {
      if (newStatus === 'suspended') {
        void securityService.suspendAccount({
          accountId: targetUser.id,
          accountName: targetUser.name,
          accountEmail: targetUser.email,
          accountType: targetUser.role === 'seller' ? 'vendeur' : targetUser.role === 'admin' ? 'administrateur' : 'client',
          reason: 'Compte bloqué pour vérification'
        }).catch(() => {});
      } else {
        void securityService.reactivateAccount({
          accountId: targetUser.id,
          accountEmail: targetUser.email
        }).catch(() => {});
      }
    }
    showToast(`Compte ${userName} ${newStatus === 'suspended' ? 'suspendu 🚫' : 'réactivé ✅'}`);
  };

  const deleteUser = (userId: string) => {
    const targetUser = adminUsers.find((u) => u.id === userId);
    if (!targetUser) { showToast('Utilisateur introuvable.'); return; }
    if (targetUser.role === 'admin') { showToast('Un compte administrateur ne peut pas être supprimé depuis cette session.'); return; }

    const relatedSellerId = targetUser.role === 'seller' ? userId.replace('usr-', '') : undefined;
    if (relatedSellerId) {
      setSellers((prev) => prev.filter((seller) => seller.id !== relatedSellerId));
      setProducts((prev) => prev.filter((product) => product.sellerId !== relatedSellerId));
      setCart((prev) => prev.filter((item) => products.find((p) => p.id === item.productId)?.sellerId !== relatedSellerId));
    }
    setAdminUsers((prev) => {
      const updated = prev.filter((u) => u.id !== userId);
      writeShared('djassa_admin_users', updated);
      return updated;
    });
    addAuditLog('Suppression d’utilisateur', targetUser.name, 'security', 'Compte supprimé avec nettoyage des données directement liées', {
      activityCategory: 'admin_mgmt',
      actionType: 'admin_account_deleted',
      entityType: 'account',
      entityId: userId,
      severity: 'eleve',
      beforeValue: `${targetUser.name} (${targetUser.role})`,
      afterValue: 'Supprimé'
    });
    showToast(`Utilisateur ${targetUser.name} supprimé de la plateforme`);
  };

  const addAdminUser = (newUser: AdminUserRecord) => {
    setAdminUsers((prev) => {
      const updated = [newUser, ...prev];
      writeShared('djassa_admin_users', updated);
      return updated;
    });
    addAuditLog('Création manuelle utilisateur', newUser.name, 'user', `Compte créé avec le rôle ${newUser.role.toUpperCase()}`, {
      activityCategory: 'admin_mgmt',
      actionType: 'admin_account_created',
      entityType: 'account',
      entityId: newUser.id,
      severity: newUser.role === 'admin' ? 'critique' : 'moyen',
      afterValue: `${newUser.name} (${newUser.role})`
    });
    showToast(`Utilisateur ${newUser.name} créé avec succès ! 🎉`);
  };

  const updateAdminUser = (userId: string, updates: Partial<AdminUserRecord>) => {
    const prevUser = adminUsers.find((u) => u.id === userId);
    setAdminUsers((prev) => {
      const updated = prev.map((u) => u.id === userId ? { ...u, ...updates } : u);
      writeShared('djassa_admin_users', updated);
      return updated;
    });
    const roleChanged = Boolean(updates.role && prevUser && updates.role !== prevUser.role);
    addAuditLog(
      roleChanged ? 'Modification rôle utilisateur' : 'Modification profil utilisateur',
      prevUser?.name || userId,
      'user',
      `Champs mis à jour : ${Object.keys(updates).join(', ')}`,
      {
        activityCategory: 'admin_mgmt',
        actionType: roleChanged ? 'admin_user_role_updated' : 'admin_user_updated',
        entityType: 'account',
        entityId: userId,
        severity: roleChanged ? 'eleve' : 'faible',
        beforeValue: roleChanged ? prevUser?.role : undefined,
        afterValue: roleChanged ? updates.role : Object.keys(updates).join(', ')
      }
    );
    showToast('Profil utilisateur mis à jour ! 💾');
  };

  const updateProductAdmin = (productId: string, updates: Partial<Product>) => {
    const target = products.find((p) => p.id === productId);
    if (!target) { showToast('Produit introuvable.'); return; }
    setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, ...updates } : p));
    addAuditLog('Modification produit / modération', target.name, 'marketplace', `Champs modifiés : ${Object.keys(updates).join(', ')}`, {
      activityCategory: 'products',
      actionType: 'admin_product_moderated',
      entityType: 'product',
      entityId: productId,
      severity: 'faible',
      beforeValue: target.price ? `${target.name} (${target.price} F)` : target.name,
      afterValue: updates.price ? `${updates.name || target.name} (${updates.price} F)` : Object.keys(updates).join(', ')
    });
    showToast('Article mis à jour par l’administrateur ✨');
  };

  const deleteProductAdmin = (productId: string) => {
    const target = products.find((p) => p.id === productId);
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    setCart((prev) => prev.filter((item) => item.productId !== productId));
    setUserProfile((prev) => ({ ...prev, savedItemIds: prev.savedItemIds.filter((id) => id !== productId) }));
    addAuditLog('Suppression produit / modération', target?.name || productId, 'marketplace', 'Article retiré de la vente suite à modération', {
      activityCategory: 'products',
      actionType: 'admin_product_deleted',
      entityType: 'product',
      entityId: productId,
      severity: 'moyen',
      beforeValue: target?.name || productId,
      afterValue: 'Retiré du catalogue'
    });
    showToast('Article retiré du catalogue marketplace');
  };

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const executePendingVisitorAction = useCallback(
    (action: PendingVisitorAction | null) => {
      if (!action) return;
      switch (action.type) {
        case 'comment':
          setCommentBottomSheetProductId(action.productId);
          break;
        case 'buy_direct':
          setVariantModalProduct(action.product);
          setIsVariantModalDirectBuy(true);
          break;
        case 'add_to_cart': {
          const target = products.find((p) => p.id === action.productId);
          const qty = action.quantity || 1;
          if (target && target.inStock && target.stock >= qty) {
            setCart((prev) => {
              const existing = prev.find(
                (item) =>
                  item.productId === action.productId &&
                  JSON.stringify(item.variantSelected) === JSON.stringify(action.variantSelected)
              );
              if (existing) {
                return prev.map((item) =>
                  item.id === existing.id
                    ? { ...item, quantity: Math.min(target.stock, item.quantity + qty), selected: true }
                    : item
                );
              }
              return [
                {
                  id: `cart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  productId: action.productId,
                  variantSelected: action.variantSelected,
                  quantity: qty,
                  selected: true,
                  addedAt: new Date().toISOString()
                },
                ...prev
              ];
            });
            showToast('Produit ajouté au panier 🛒');
          }
          break;
        }
        case 'follow_seller': {
          setUserProfile((prev) => {
            if (prev.followedSellerIds.includes(action.sellerId)) return prev;
            const next = [...prev.followedSellerIds, action.sellerId];
            if (getSecurityToken()) {
              void clientService.syncInteractions({ followingSellerIds: next }).catch(() => {});
            }
            return { ...prev, followedSellerIds: next };
          });
          setSellers((prev) =>
            prev.map((s) => (s.id === action.sellerId ? { ...s, followedCount: s.followedCount + 1 } : s))
          );
          const targetSeller = sellers.find((s) => s.id === action.sellerId);
          showToast(`Vous suivez maintenant ${targetSeller?.name || 'la boutique'}`);
          break;
        }
        case 'open_orders':
          setActiveTab('achats');
          break;
        case 'open_messages':
          if (action.sellerId) {
            const seller = sellers.find((s) => s.id === action.sellerId);
            if (seller) {
              const convId = `conv-seller-${seller.id}-${Date.now()}`;
              setConversations((prev) => {
                const existing = prev.find(
                  (c) => c.participantId === seller.id && c.participantType === 'seller'
                );
                if (existing) {
                  setActiveConversationId(existing.id);
                  return prev;
                }
                const created: Conversation = {
                  id: convId,
                  participantId: seller.id,
                  participantType: 'seller',
                  participantName: seller.name,
                  participantAvatar: seller.avatar,
                  participantVerified: seller.verified,
                  participantRoleSubtitle: seller.location,
                  lastMessage: 'Discussion démarrée',
                  lastMessageTime: 'À l’instant',
                  unreadCount: 0,
                  relatedProductId: action.relatedProductId,
                  isOnline: true
                };
                setActiveConversationId(convId);
                return [created, ...prev];
              });
            }
          }
          setActiveTab('discussions');
          break;
        case 'ai_chat':
          setActiveTab('explorer');
          break;
        case 'tryon':
          setTryOnModalProduct(action.product);
          break;
        case 'open_profile':
          setActiveTab('profil');
          break;
      }
    },
    [products, sellers, showToast]
  );

  const mergeGuestSessionForClient = useCallback(
    async (user: AuthUserDTO) => {
      const payload = visitorService.getMergePayload();
      if (payload) {
        try {
          const mergedRes = await clientService.mergeGuestData(payload);
          if (mergedRes?.success) {
            visitorService.clearAfterMerge();
            setVisitorQuota(visitorService.getQuotaSnapshot());
            if (Array.isArray(mergedRes.aiConversations)) {
              setAiConversations(mergedRes.aiConversations);
            }
            if (mergedRes.preferences) {
              setClientPreferences(mergedRes.preferences);
              safeStorageSet('djassa_client_preferences', JSON.stringify(mergedRes.preferences));
            }
          }
        } catch {
          // Best-effort merge; keep going with hydration
        }
      }
      await hydrateAuthenticatedUser(user);
    },
    [hydrateAuthenticatedUser]
  );

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const res = await authService.login(normalizedEmail, password);
      if (!res.success || !res.user) {
        return { success: false, message: res.message || 'Adresse e-mail ou mot de passe incorrect.' };
      }
      const user = res.user;
      const pending = pendingAuthActionRef.current;
      pendingAuthActionRef.current = null;
      setAuthGateState((prev) => ({ ...prev, isOpen: false, pendingAction: null }));

      // Isolate user-scoped private state when switching accounts (C-06)
      setUserProfile({
        ...INITIAL_USER_PROFILE,
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        likedVideoIds: [],
        savedItemIds: [],
        followedSellerIds: [],
        viewingHistory: [],
        searchHistory: []
      });
      setAiConversations([]);
      setSupportTickets([]);
      setActiveUserSessions([]);
      ensureSellerProfile(user);
      const rawLoginRole = String(user.role || '');
      const safeRole: 'client' | 'seller' | 'admin' = rawLoginRole === 'seller' || rawLoginRole === 'admin' ? rawLoginRole : 'client';
      setAccountRole(safeRole);
      setIsAuthenticated(true);
      safeStorageSet('djassa_auth', 'true');
      safeStorageSet('djassa_account_role', safeRole);
      safeStorageSet('djassa_session_email', user.email);

      if (safeRole === 'client') {
        void mergeGuestSessionForClient(user);
      } else {
        void hydrateAuthenticatedUser(user);
      }

      if (safeRole === 'client' && pending) {
        executePendingVisitorAction(pending);
      } else {
        setActiveTab('accueil');
      }

      if (res.unusualDevice) {
        showToast('Alerte sécurité : connexion détectée depuis un nouvel appareil.');
      }
      return { success: true, role: safeRole };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Erreur de connexion au serveur d’authentification.'
      };
    }
  };

  const signUp = async (payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role?: 'client' | 'seller';
  }) => {
    try {
      const res = await authService.register(payload);
      if (!res.success || !res.user) {
        return { success: false, message: res.message || 'Impossible de créer le compte.' };
      }
      const user = res.user;
      const pending = pendingAuthActionRef.current;
      pendingAuthActionRef.current = null;
      setAuthGateState((prev) => ({ ...prev, isOpen: false, pendingAction: null }));

      // Clean fresh profile state for new account (C-06)
      setUserProfile({
        ...INITIAL_USER_PROFILE,
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        likedVideoIds: [],
        savedItemIds: [],
        followedSellerIds: [],
        viewingHistory: [],
        searchHistory: []
      });
      setCart([]);
      setOrders([]);
      setConversations([]);
      setMessages({});
      setNotifications([]);
      setAiConversations([]);
      setSupportTickets([]);
      setActiveUserSessions([]);
      ensureSellerProfile(user);
      const rawSignupRole = String(user.role || '');
      const safeRole: 'client' | 'seller' | 'admin' = rawSignupRole === 'seller' || rawSignupRole === 'admin' ? rawSignupRole : 'client';
      setAccountRole(safeRole);
      setIsAuthenticated(true);
      safeStorageSet('djassa_auth', 'true');
      safeStorageSet('djassa_account_role', safeRole);
      safeStorageSet('djassa_session_email', user.email);

      if (safeRole === 'client') {
        void mergeGuestSessionForClient(user);
      } else {
        void hydrateAuthenticatedUser(user);
      }

      if (safeRole === 'client' && pending) {
        executePendingVisitorAction(pending);
      } else {
        setActiveTab('accueil');
      }

      return { success: true, role: safeRole };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Erreur lors de la création du compte.'
      };
    }
  };

  const signOut = () => {
    void Promise.all([securityService.notifyLogout(), authService.logout()]);
    setIsAuthenticated(false);
    setAccountRole(null);
    safeStorageSet('djassa_auth', 'false');
    safeStorageRemove('djassa_account_role');
    safeStorageRemove('djassa_session_email');
    safeStorageRemove('djassa_client_preferences');
    setUserProfile(createGuestUserProfile());
    setVisitorQuota(visitorService.getQuotaSnapshot());
    setOrders([]);
    setCart([]);
    setConversationsState([]);
    setMessages({});
    setNotifications([]);
    setTryOnHistory([]);
    setClientPreferences(DEFAULT_CLIENT_PREFERENCES_STATE);
    setAiConversations([]);
    setSupportTickets([]);
    setActiveUserSessions([]);
    setActiveConversationId(null);
    setSelectedProductState(null);
    setSelectedVideoProductState(null);
    setSelectedPhotoProductState(null);
    setSelectedSeller(null);
    setSelectedOrder(null);
    setCommentBottomSheetProductId(null);
    setVariantModalProduct(null);
    setTryOnModalProduct(null);
    closeAuthGate();
    setActiveTab('accueil');
    showToast('Déconnexion effectuée — Mode visiteur actif');
  };

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        isVisitor: !isAuthenticated,
        visitorQuota,
        refreshVisitorQuota,
        authGateState,
        openAuthModal,
        closeAuthGate,
        requireAuth,
        accountRole,
        setAccountRole: handleSetAccountRole,
        currentSellerId,
        setCurrentSellerId,
        signIn,
        signUp,
        signOut,
        activeTab,
        setActiveTab,
        sellerActiveTab,
        setSellerActiveTab,
        navigateToDiscussions,
        feedSubTab,
        setFeedSubTab,
        feedTargetProductId,
        setFeedTargetProductId,
        feedReturnProduct,
        setFeedReturnProduct,
        navigateToFeedProduct,
        isVoiceModeOpen,
        setIsVoiceModeOpen,
        returnToLiveVoiceAvailable,
        setReturnToLiveVoiceAvailable,
        liveAiProducts,
        setLiveAiProducts,
        hideBottomNav,
        setHideBottomNav,
        products,
        sellers,
        comments,
        orders,
        cart,
        conversations,
        setConversations,
        messages,
        setMessages,
        userProfile,
        userActivity,
        notifications,
        selectedProduct,
        setSelectedProduct,
        selectedVideoProduct,
        setSelectedVideoProduct,
        videoViewerProducts,
        openVideoViewer,
        selectedPhotoProduct,
        setSelectedPhotoProduct,
        photoViewerProducts,
        openPhotoViewer,
        closePhotoViewer,
        selectedSeller,
        setSelectedSeller,
        selectedOrder,
        setSelectedOrder,
        activeConversationId,
        setActiveConversationId,
        commentBottomSheetProductId,
        setCommentBottomSheetProductId,
        variantModalProduct,
        setVariantModalProduct,
        isVariantModalDirectBuy,
        setIsVariantModalDirectBuy,
        tryOnModalProduct,
        setTryOnModalProduct,
        openTryOnModal,
        closeTryOnModal,
        tryOnHistory,
        addTryOnHistoryItem,
        removeTryOnHistoryItem,
        sellerCreations,
        addSellerCreation,
        removeSellerCreation,
        aiCredits,
        userPlan,
        setUserPlan,
        upgradeUserPlan,
        refreshCreditsState,
        spendAiCredits,
        addAiCredits,
        claimDailyBonus,
        aiCreditHistory,
        isCreditModalOpen,
        setIsCreditModalOpen,
        creditModalAudience,
        setCreditModalAudience,
        openCreditModal,
        isAiVideoModalOpen,
        setIsAiVideoModalOpen,
        aiVideoInitialData,
        openAiVideoModal,
        closeAiVideoModal,
        activeCall,
        startCall,
        receiveIncomingCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleCallMute,
        toggleCallSpeaker,
        toggleCallMinimized,
        toggleFollowSeller,
        toggleLikeVideo,
        toggleSaveProduct,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        toggleCartItemSelected,
        createOrder,
        createMultiSellerOrders,
        submitOrderReview,
        sendMessage,
        openChatWithSeller,
        openChatWithClient,
        openChatWithParticipant,
        markConversationAsRead,
        addComment,
        addCommentReply,
        toggleLikeComment,
        toggleLikeReply,
        deleteComment,
        searchQuery,
        setSearchQuery,
        selectedCategory,
        setSelectedCategory,
        trackVideoWatch,
        removeHistoryItem,
        clearHistory,
        clearTransientCache,
        disconnectSession,
        disconnectAllOtherSessions,
        updateProfileDetails,
        updateProfile,
        clientPreferences,
        updateClientPreferences,
        aiConversations,
        saveAiConversation,
        deleteAiConversation,
        supportTickets,
        createSupportTicket,
        activeUserSessions,
        openSupportChat,
        cancelOrder,
        confirmOrderDelivered,
        updateOrderStatus,
        reportOrderIncident,
        addPublication,
        updateSeller,
        updateProductSeller,
        deleteProductSeller,
        adminUsers,
        auditLogs,
        platformConfig,
        updatePlatformConfig,
        verifyUserKyc,
        toggleUserSuspension,
        deleteUser,
        addAdminUser,
        updateAdminUser,
        addAuditLog,
        updateProductAdmin,
        deleteProductAdmin,
        markAllNotificationsRead,
        unreadNotificationsCount,
        unreadMessagesCount,
        toastMessage,
        showToast
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
