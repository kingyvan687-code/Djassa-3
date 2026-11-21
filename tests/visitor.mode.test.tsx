// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  VISITOR_AI_EXHAUSTED_MESSAGE,
  VISITOR_COMMENTS_GATE_MESSAGE,
  VISITOR_QUOTAS,
} from '../src/config/visitorQuotas';
import { DEFAULT_VISITOR_AVATAR, visitorService } from '../src/services/visitorService';

describe('VisitorService Quotas & Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a persistent guestId across calls and enforces anti-bypass on likes (10/day)', () => {
    const firstState = visitorService.getState();
    expect(firstState.guestId).toMatch(/^guest-/);
    expect(visitorService.getState().guestId).toBe(firstState.guestId);

    // Like 10 distinct products
    for (let i = 1; i <= VISITOR_QUOTAS.dailyLikes; i += 1) {
      const res = visitorService.toggleGuestLike(`prod-${i}`);
      expect(res.allowed).toBe(true);
      expect(res.isLikedNow).toBe(true);
    }

    // Unlike prod-1 and try to like a new prod-11 -> MUST stay blocked (anti-bypass)
    const unlikeRes = visitorService.toggleGuestLike('prod-1');
    expect(unlikeRes.allowed).toBe(true);
    expect(unlikeRes.isLikedNow).toBe(false);

    const bypassAttempt = visitorService.toggleGuestLike('prod-11');
    expect(bypassAttempt.allowed).toBe(false);
    expect(bypassAttempt.remaining).toBe(0);

    // Re-liking prod-1 (already consumed today) IS allowed
    const relikeRes = visitorService.toggleGuestLike('prod-1');
    expect(relikeRes.allowed).toBe(true);
    expect(relikeRes.isLikedNow).toBe(true);
  });

  it('enforces anti-bypass on favorites (5/day) and 5/day AI quota with clearAfterMerge', () => {
    for (let i = 1; i <= VISITOR_QUOTAS.dailyFavorites; i += 1) {
      const res = visitorService.toggleGuestFavorite(`fav-${i}`);
      expect(res.allowed).toBe(true);
      expect(res.isSavedNow).toBe(true);
    }

    // Unsave fav-1 then try fav-6 -> blocked
    visitorService.toggleGuestFavorite('fav-1');
    const favBypass = visitorService.toggleGuestFavorite('fav-6');
    expect(favBypass.allowed).toBe(false);
    expect(favBypass.remaining).toBe(0);

    // AI questions: 5/day
    for (let i = 1; i <= VISITOR_QUOTAS.dailyAiQuestions; i += 1) {
      expect(visitorService.canAskAi().allowed).toBe(true);
      visitorService.recordGuestAiQuestion();
    }
    expect(visitorService.canAskAi().allowed).toBe(false);
    expect(visitorService.getQuotaSnapshot().ai.remaining).toBe(0);

    visitorService.recordGuestView('vid-9', 15, 1);
    visitorService.recordGuestSearch('sneakers');
    const payload = visitorService.getMergePayload();
    expect(payload).not.toBeNull();
    expect(payload!.viewingHistory).toHaveLength(1);
    expect(payload!.searchHistory).toContain('sneakers');

    visitorService.clearAfterMerge();
    const after = visitorService.getState();
    expect(after.likedVideoIds).toHaveLength(0);
    expect(after.savedProductIds).toHaveLength(0);
    expect(after.viewingHistory).toHaveLength(0);
    expect(DEFAULT_VISITOR_AVATAR).toMatch(/^data:image\/svg\+xml/);
  });
});

// UI tests for visitor gates and isolated screens
const visitorMock = vi.hoisted(() => ({
  isAuthenticated: false,
  activeTab: 'accueil',
  authGateState: {
    isOpen: true,
    reason: 'comment' as
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
      | 'account',
    initialMode: 'register' as 'login' | 'register',
    directToAuthForm: false,
    pendingAction: null,
    openedAt: 1,
  },
  visitorQuota: {
    likes: { used: 3, remaining: 7, limit: 10 },
    favorites: { used: 1, remaining: 4, limit: 5 },
    ai: { used: 2, remaining: 3, limit: 5 },
  },
  closeAuthGate: vi.fn(),
  openAuthModal: vi.fn(),
  requireAuth: vi.fn(() => false),
  setActiveTab: vi.fn(),
  signIn: vi.fn(async () => ({ success: false, message: 'err' })),
  signUp: vi.fn(async () => ({ success: false, message: 'err' })),
  signOut: vi.fn(),
  showToast: vi.fn(),
  removeHistoryItem: vi.fn(),
  clearHistory: vi.fn(),
}));

vi.mock('../src/context/AppContext', () => ({
  useApp: () => ({
    isAuthenticated: visitorMock.isAuthenticated,
    isVisitor: !visitorMock.isAuthenticated,
    accountRole: null,
    authGateState: visitorMock.authGateState,
    openAuthModal: visitorMock.openAuthModal,
    closeAuthGate: visitorMock.closeAuthGate,
    requireAuth: visitorMock.requireAuth,
    visitorQuota: visitorMock.visitorQuota,
    setActiveTab: visitorMock.setActiveTab,
    signIn: visitorMock.signIn,
    signUp: visitorMock.signUp,
    signOut: visitorMock.signOut,
    showToast: visitorMock.showToast,
    userProfile: {
      id: 'guest_test',
      name: 'Visiteur DJASSA',
      username: 'visiteur',
      avatar: DEFAULT_VISITOR_AVATAR,
      bio: 'Explorez DJASSA librement avant de créer votre compte.',
      phone: '',
      email: '',
      deliveryAddress: '',
      deliveryCommune: 'Cocody',
      deliveryQuartier: '',
      deliveryAddressDetails: '',
      likedVideoIds: ['p-1'],
      savedItemIds: [],
      followedSellerIds: [],
      blockedSellerIds: [],
      taggedItemIds: [],
      stats: { viewsCount: 1, timeTodayMinutes: 0, likesGiven: 1, purchasesCount: 0 },
      viewingHistory: [{ videoId: 'p-1', watchedAt: new Date().toISOString(), durationSec: 12, completionRate: 0.4 }],
      searchHistory: [],
    },
    updateProfile: vi.fn(),
    products: [
      {
        id: 'p-1',
        name: 'Sneakers Wax Abidjan',
        price: 15000,
        images: ['https://example.com/p1.jpg'],
        sellerId: 's-1',
        category: 'Chaussures',
        stock: 5,
        inStock: true,
        rating: 4.9,
        likesCount: 12,
        viewsCount: 100,
        commentsCount: 2,
      },
    ],
    sellers: [{ id: 's-1', name: 'Boutique Adjamé', username: 'boutique_adjame', avatar: '', location: 'Adjamé', verified: true, rating: 4.8 }],
    orders: [],
    cart: [],
    conversations: [],
    messages: {},
    tryOnHistory: [],
    userActivity: { viewedProductIds: ['p-1'], totalMinutesSpent: 0, completedVideosCount: 0, likesCount: 1, commentsCount: 0, savedCount: 0, purchasesCount: 0, watchTimeSeconds: 0 },
    clientPreferences: {
      privacy: { privateAccount: false, allowMessages: 'everyone', allowComments: 'everyone', allowMentions: 'everyone', showActivityStatus: true, personalizedAds: true, twoFactorEnabled: false, blockedSellerIds: [] },
      notifications: { pushEnabled: true, orderUpdates: true, promotions: true, liveStreams: true, messages: true, newFollowers: true, emailDigest: false, smsAlerts: true },
      display: { theme: 'dark', fontSize: 'normal', reduceMotion: false },
      language: 'fr',
      dataSaver: { enabled: false, autoplayWifiOnly: false, videoQuality: 'auto' },
      contentPreferences: { favoriteCategories: [], mutedKeywords: [] },
      screenTime: { dailyLimitMinutes: null, sleepReminderEnabled: false, sleepStartHour: '23:00', dailyUsageMinutes: {} },
      savedAddresses: [],
      paymentMethods: [],
      searchHistoryEnabled: true,
    },
    activeUserSessions: [],
    supportTickets: [],
    activeCall: null,
    activeConversationId: null,
    selectedOrder: null,
    setSelectedOrder: vi.fn(),
    setSelectedProduct: vi.fn(),
    openVideoViewer: vi.fn(),
    toggleLikeVideo: vi.fn(),
    toggleSaveProduct: vi.fn(),
    addToCart: vi.fn(),
    removeHistoryItem: visitorMock.removeHistoryItem,
    clearHistory: visitorMock.clearHistory,
    removeTryOnHistoryItem: vi.fn(),
    openTryOnModal: vi.fn(),
    setActiveConversationId: vi.fn(),
    sendMessage: vi.fn(),
    startCall: vi.fn(),
    receiveIncomingCall: vi.fn(),
    markConversationAsRead: vi.fn(),
    openChatWithSeller: vi.fn(),
    openSupportChat: vi.fn(),
  }),
}));

import { VisitorAuthGateModal } from '../src/components/auth/VisitorAuthGateModal';
import { AchatsScreen } from '../src/components/achats/AchatsScreen';
import { DiscussionsScreen } from '../src/components/chat/DiscussionsScreen';
import { ProfileScreen } from '../src/components/profile/ProfileScreen';

describe('Visitor Mode UI Components & Required Gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    visitorMock.isAuthenticated = false;
  });

  it('displays exact required French copy for comments gate and dismisses cleanly', () => {
    visitorMock.authGateState.reason = 'comment';
    visitorMock.authGateState.isOpen = true;

    render(<VisitorAuthGateModal />);

    expect(screen.getByText(VISITOR_COMMENTS_GATE_MESSAGE)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Créer un compte' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeTruthy();

    const dismissBtn = screen.getByRole('button', { name: 'Continuer à explorer' });
    fireEvent.click(dismissBtn);
    expect(visitorMock.closeAuthGate).toHaveBeenCalledTimes(1);
  });

  it('displays exact required French copy for exhausted AI quota gate', () => {
    visitorMock.authGateState.reason = 'ai_quota';
    visitorMock.authGateState.isOpen = true;

    render(<VisitorAuthGateModal />);

    expect(screen.getByText(VISITOR_AI_EXHAUSTED_MESSAGE)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Créer un compte' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Revenir plus tard' })).toBeTruthy();
  });

  it('isolates Achats and Discussions screens behind clean visitor gates', () => {
    const { unmount } = render(<AchatsScreen />);
    expect(screen.getByText('Accédez à vos achats et commandes')).toBeTruthy();
    fireEvent.click(screen.getByText('Continuer à explorer'));
    expect(visitorMock.setActiveTab).toHaveBeenCalledWith('accueil');
    unmount();

    render(<DiscussionsScreen />);
    expect(screen.getByText('Discutez avec les vendeurs d’Adjamé')).toBeTruthy();
    fireEvent.click(screen.getByText('Créer un compte'));
    expect(visitorMock.openAuthModal).toHaveBeenCalledWith(
      'messages',
      expect.objectContaining({ initialMode: 'register', directToAuthForm: true })
    );
  });

  it('renders clean Visiteur DJASSA profile without demo orders/edit controls and supports local history', () => {
    render(<ProfileScreen />);

    expect(screen.getByText('Visiteur DJASSA')).toBeTruthy();
    expect(screen.getByText('@visiteur')).toBeTruthy();
    expect(screen.queryByText('Modifier le profil')).toBeNull();
    expect(screen.queryByText('Déconnexion')).toBeNull();
    expect(screen.getByText(/3\/10 J'aime · 1\/5 Favoris · 2\/5 Questions IA/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Historique/i }));
    expect(screen.getByText('Sneakers Wax Abidjan')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Tout effacer/i }));
    expect(visitorMock.clearHistory).toHaveBeenCalledTimes(1);
  });
});
