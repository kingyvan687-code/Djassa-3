import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientPreferencesDTO, ClientTicketDTO } from '../src/services/clientService';

function createDefaultPrefs(): ClientPreferencesDTO {
  return {
    privacy: {
      privateAccount: false,
      allowMessages: 'everyone',
      allowComments: 'everyone',
      allowMentions: 'everyone',
      showActivityStatus: true,
      personalizedAds: false,
      twoFactorEnabled: false,
      blockedSellerIds: [],
    },
    notifications: {
      pushEnabled: true,
      orderUpdates: true,
      promotions: false,
      liveStreams: true,
      messages: true,
      newFollowers: true,
      emailDigest: false,
      smsAlerts: false,
    },
    display: {
      theme: 'dark',
      fontSize: 'normal',
      reduceMotion: false,
    },
    language: 'fr-CI',
    dataSaver: {
      enabled: false,
      autoplayWifiOnly: false,
      videoQuality: 'auto',
    },
    contentPreferences: {
      favoriteCategories: [],
      mutedKeywords: [],
    },
    screenTime: {
      dailyLimitMinutes: null,
      sleepReminderEnabled: false,
      sleepStartHour: '22:30',
      dailyUsageMinutes: {},
    },
    savedAddresses: [],
    paymentMethods: [],
    searchHistoryEnabled: true,
  };
}

const mockState = vi.hoisted(() => ({
  showToast: vi.fn(),
  clearTransientCache: vi.fn(),
  updateClientPreferences: vi.fn(async () => undefined),
  createSupportTicket: vi.fn(async (payload: { category: string; description: string; ticketType?: string }): Promise<ClientTicketDTO> => ({
    id: 'TCK-104920',
    ticketType: (payload.ticketType as ClientTicketDTO['ticketType']) || 'problem',
    category: payload.category,
    description: payload.description,
    status: 'pending',
    attachments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })),
  openSupportChat: vi.fn(async () => undefined),
  updateProfile: vi.fn(),
  updateCartQuantity: vi.fn(),
  removeFromCart: vi.fn(),
  toggleCartItemSelected: vi.fn(),
  setActiveTab: vi.fn(),
  setSelectedProduct: vi.fn(),
  setSelectedSeller: vi.fn(),
  addToCart: vi.fn(),
  setSelectedOrder: vi.fn(),
  createOrder: vi.fn(async () => ({
    id: 'ord-9999',
    orderNumber: 'ADJ99999',
    items: [],
    subtotal: 25000,
    deliveryFee: 0,
    serviceFee: 1495,
    clientFeeFcfa: 1495,
    commissionFcfa: 150,
    sellerNetFcfa: 22850,
    discount: 2000,
    total: 24495,
    deliveryMode: 'seller_managed' as const,
    paymentMode: 'online' as const,
    paymentMethod: 'orange_money' as const,
    paymentStatus: 'pending' as const,
    status: 'pending_payment' as const,
    visibleStatus: 'Commande confirmée',
    createdAt: '17/11/2026 15:07',
    estimatedDelivery: 'Organisée directement par la boutique',
    deliveryAddress: {
      commune: 'Cocody',
      quartier: 'Riviera',
      details: 'Près pharmacie',
      recipientName: 'Kouassi Aya',
      phone: '+225 07 01 02 03 04',
    },
    trackingEvents: [],
  })),
  validatePromoCode: vi.fn(async (code: string, subtotal: number) => {
    if (code === 'ADJAME10' && subtotal >= 10000) {
      return {
        success: true,
        valid: true,
        code: 'ADJAME10',
        discountFcfa: 2000,
        label: 'ADJAME10 (-2 000 FCFA)',
      };
    }
    throw new Error('Code promo invalide ou expiré.');
  }),
  clientPreferences: null as unknown as ClientPreferencesDTO,
  cart: [] as Array<{ id: string; productId: string; quantity: number; variantSelected: Record<string, string>; selected: boolean }>,
  products: [] as Array<Record<string, unknown>>,
  aiCredits: 25,
  userPlan: 'gratuit',
  isCreditModalOpen: true,
  setIsCreditModalOpen: vi.fn(),
  upgradeUserPlan: vi.fn(),
  addAiCredits: vi.fn(),
  spendAiCredits: vi.fn(() => true),
  claimDailyBonus: vi.fn(),
  openAiVideoModal: vi.fn(),
  openTryOnModal: vi.fn(),
  openCreditModal: vi.fn(),
  setVariantModalProduct: vi.fn(),
  addTryOnHistoryItem: vi.fn(),
  refreshCreditsState: vi.fn(async () => ({ balance: 55, activePlan: 'mini' })),
  confirmRecharge: vi.fn(async () => ({
    success: true,
    pending: true,
    status: 'pending' as const,
    checkoutUrl: 'https://pay.genius.ci/checkout/dep_test_mini',
    providerConfigured: true,
    newBalance: 25,
    recharge: {
      id: 'rch-mini-1',
      userId: 'client-1',
      amountFcfa: 300,
      credits: 30,
      paymentMethod: 'orange_money',
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    },
    message: 'Paiement en attente de confirmation GeniusPay.',
  })),
  checkRechargeStatus: vi.fn(async () => ({
    success: true,
    status: 'confirmed' as const,
    pending: false,
    confirmed: true,
    newBalance: 55,
    activePlan: 'mini',
    recharge: {
      id: 'rch-mini-1',
      userId: 'client-1',
      amountFcfa: 300,
      credits: 30,
      paymentMethod: 'orange_money',
      status: 'confirmed' as const,
      createdAt: new Date().toISOString(),
    },
  })),
  verifyProviderRecharge: vi.fn(async () => ({
    success: true,
    status: 'confirmed' as const,
    pending: false,
    newBalance: 55,
    activePlan: 'mini',
  })),
  getAiCapabilities: vi.fn(async () => ({ chat: true, image: true, video: false })),
  generateTryOn: vi.fn(async () => ({
    success: true,
    imageDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    creditsDeducted: 10,
    newBalance: 15,
  })),
}));

vi.mock('../src/services/securityService', () => ({
  getSecurityToken: () => 'mock-client-token',
}));

vi.mock('../src/services/creditsService', () => ({
  creditsService: {
    confirmRecharge: (...args: unknown[]) => mockState.confirmRecharge(...(args as [])),
    checkRechargeStatus: (...args: unknown[]) => mockState.checkRechargeStatus(...(args as [])),
    verifyProviderRecharge: (...args: unknown[]) => mockState.verifyProviderRecharge(...(args as [])),
    getAiCapabilities: () => mockState.getAiCapabilities(),
    generateTryOn: (...args: unknown[]) => mockState.generateTryOn(...(args as [])),
    getBalance: vi.fn(async () => ({ balance: mockState.aiCredits, balanceFcfa: mockState.aiCredits * 10, activePlan: mockState.userPlan })),
    getHistory: vi.fn(async () => ({ recharges: [], usages: [], refunds: [] })),
  },
}));

vi.mock('../src/services/commerceService', () => ({
  commerceService: {
    validatePromoCode: (...args: [string, number]) => mockState.validatePromoCode(...args),
    getOrderStatus: vi.fn(async (orderId: string) => ({
      success: true,
      order: { id: orderId, paymentStatus: 'pending', paymentMethod: 'orange_money' },
      payment: { status: 'pending' },
    })),
    retryOrderPayment: vi.fn(async (orderId: string, method?: string) => ({
      success: true,
      order: { id: orderId, paymentStatus: 'pending', paymentMethod: method || 'wave' },
      payment: { status: 'pending' },
      providerConfigured: false,
    })),
  },
}));

vi.mock('../src/context/AppContext', () => ({
  useApp: () => ({
    showToast: mockState.showToast,
    clearTransientCache: mockState.clearTransientCache,
    clientPreferences: mockState.clientPreferences,
    updateClientPreferences: mockState.updateClientPreferences,
    supportTickets: [],
    createSupportTicket: mockState.createSupportTicket,
    openSupportChat: mockState.openSupportChat,
    userProfile: {
      id: 'client-1',
      name: 'Kouassi Aya',
      username: 'kouassi_aya',
      email: 'aya@djassa.ci',
      phone: '+225 07 01 02 03 04',
      avatar: 'https://example.com/avatar.png',
      deliveryCommune: 'Cocody',
      deliveryQuartier: 'Riviera',
      deliveryAddressDetails: 'Près pharmacie',
    },
    updateProfile: mockState.updateProfile,
    sellers: [
      {
        id: 's-1',
        name: 'Boutique TechPlus',
        storeName: 'Boutique TechPlus',
        location: 'Adjamé, Abidjan',
        verified: true,
        rating: 4.8,
        salesCount: 1200,
        partnerCompanyIds: ['comp-ivoire-express', 'comp-adjame-flash'],
      },
    ],
    orders: [
      {
        id: 'ord-1001',
        orderNumber: '1001',
        status: 'pending',
        total: 16500,
        subtotal: 15000,
        deliveryFee: 1500,
        createdAt: '2026-04-01T10:00:00Z',
        deliveryAddress: { commune: 'Cocody', quartier: 'Riviera' },
        items: [{ productId: 'p-1', productTitle: 'Baskets Blanches', quantity: 1, price: 15000 }],
      },
    ],
    cart: mockState.cart,
    products: mockState.products,
    updateCartQuantity: mockState.updateCartQuantity,
    removeFromCart: mockState.removeFromCart,
    toggleCartItemSelected: mockState.toggleCartItemSelected,
    setActiveTab: mockState.setActiveTab,
    setSelectedProduct: mockState.setSelectedProduct,
    setSelectedSeller: mockState.setSelectedSeller,
    addToCart: mockState.addToCart,
    setSelectedOrder: mockState.setSelectedOrder,
    createOrder: mockState.createOrder,
    aiCredits: mockState.aiCredits,
    userPlan: mockState.userPlan,
    upgradeUserPlan: mockState.upgradeUserPlan,
    addAiCredits: mockState.addAiCredits,
    spendAiCredits: mockState.spendAiCredits,
    claimDailyBonus: mockState.claimDailyBonus,
    aiCreditHistory: [],
    isCreditModalOpen: mockState.isCreditModalOpen,
    setIsCreditModalOpen: mockState.setIsCreditModalOpen,
    openAiVideoModal: mockState.openAiVideoModal,
    openTryOnModal: mockState.openTryOnModal,
    openCreditModal: mockState.openCreditModal,
    setVariantModalProduct: mockState.setVariantModalProduct,
    addTryOnHistoryItem: mockState.addTryOnHistoryItem,
    refreshCreditsState: mockState.refreshCreditsState,
    accountRole: 'client',
    creditModalAudience: 'client',
    isAuthenticated: true,
    isVisitor: false,
    openAuthModal: vi.fn(),
    requireAuth: () => true,
  }),
}));

import { FreeUpSpaceSettingsScreen } from '../src/components/profile/settings/FreeUpSpaceSettingsScreen';
import { ReportProblemSettingsScreen } from '../src/components/profile/settings/ReportProblemSettingsScreen';
import { PrivacySettingsScreen } from '../src/components/profile/settings/PrivacySettingsScreen';
import { NotificationsSettingsScreen } from '../src/components/profile/settings/NotificationsSettingsScreen';
import { HelpCenterSettingsScreen } from '../src/components/profile/settings/HelpCenterSettingsScreen';
import { SafetyCenterSettingsScreen } from '../src/components/profile/settings/SafetyCenterSettingsScreen';
import { QrCodeSettingsScreen } from '../src/components/profile/settings/QrCodeSettingsScreen';
import { OrdersSettingsScreen } from '../src/components/profile/settings/OrdersSettingsScreen';
import { CartTab } from '../src/components/achats/CartTab';
import { DjassaOrderFlow } from '../src/components/achats/checkout/DjassaOrderFlow';
import { KlingAiCreditsModal } from '../src/components/credits/KlingAiCreditsModal';
import { GoogleShoppingTryOnModal } from '../src/components/try-on/GoogleShoppingTryOnModal';
import { FEMALE_TRY_ON_MODELS, MALE_TRY_ON_MODELS } from '../src/components/try-on/tryOnModelsData';
import type { Product } from '../src/types';

describe('DJASSA Client UI Regression & Feature Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockState.clientPreferences = createDefaultPrefs();
    mockState.cart = [];
    mockState.products = [];
  });

  it('clears real djassa_cache_ storage keys and calls clearTransientCache without fake 43.8 Mo', async () => {
    window.localStorage.setItem('djassa_cache_videos', 'x'.repeat(2048));
    render(<FreeUpSpaceSettingsScreen onBack={vi.fn()} />);

    expect(screen.queryByText(/43\.8/)).not.toBeInTheDocument();

    const clearButtons = screen.getAllByRole('button', { name: /^Effacer$/i });
    fireEvent.click(clearButtons[0]);

    const confirmButtons = await screen.findAllByRole('button', { name: /^Effacer$/i });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(mockState.clearTransientCache).toHaveBeenCalledTimes(1);
    });
    expect(window.localStorage.getItem('djassa_cache_videos')).toBeNull();
  });

  it('submits a real support ticket via createSupportTicket and hides fake ticket DJS-94821', async () => {
    render(<ReportProblemSettingsScreen onBack={vi.fn()} />);

    expect(screen.queryByText(/DJS-94821/)).not.toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/Décrivez avec précision/i);
    fireEvent.change(textarea, { target: { value: 'Le livreur n\'a pas encore scanné mon colis.' } });

    const submitBtn = screen.getByRole('button', { name: /Envoyer le signalement au support/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockState.createSupportTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          ticketType: 'problem',
          description: 'Le livreur n\'a pas encore scanné mon colis.',
        })
      );
    });
  });

  it('persists privacy and notification toggles to updateClientPreferences', () => {
    const { unmount } = render(<PrivacySettingsScreen onBack={vi.fn()} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    expect(mockState.updateClientPreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        privacy: expect.objectContaining({ privateAccount: true }),
      })
    );
    unmount();

    render(<NotificationsSettingsScreen onBack={vi.fn()} />);
    const notifCheckboxes = screen.getAllByRole('checkbox');
    fireEvent.click(notifCheckboxes[0]);

    expect(mockState.updateClientPreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        notifications: expect.objectContaining({ pushEnabled: false }),
      })
    );
  });

  it('provides real tel: link and triggers openSupportChat from HelpCenterSettingsScreen', async () => {
    render(<HelpCenterSettingsScreen onBack={vi.fn()} />);

    const telLink = screen.getByRole('link', { name: /Appeler le support/i });
    expect(telLink).toHaveAttribute('href', 'tel:+2252720000000');

    const chatBtn = screen.getByRole('button', { name: /Chat direct/i });
    fireEvent.click(chatBtn);

    await waitFor(() => {
      expect(mockState.openSupportChat).toHaveBeenCalledTimes(1);
    });
  });

  it('submits urgent fraud alert ticket from SafetyCenterSettingsScreen', async () => {
    render(<SafetyCenterSettingsScreen onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /^Alerter$/i }));
    const textarea = await screen.findByPlaceholderText(/Demande de code Wave/i);
    fireEvent.change(textarea, { target: { value: 'Un faux vendeur demande mon code Wave par appel.' } });

    fireEvent.click(screen.getByRole('button', { name: /Transmettre/i }));

    await waitFor(() => {
      expect(mockState.createSupportTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          ticketType: 'fraud',
          category: 'Alerte fraude urgente',
        })
      );
    });
  });

  it('renders deterministic SVG QR matrix for user profile URL', () => {
    render(<QrCodeSettingsScreen onBack={vi.fn()} />);
    const qrSvg = screen.getByRole('img', { name: /Code QR pour https:\/\/djassa\.ci\/@kouassi_aya/i });
    expect(qrSvg).toBeInTheDocument();
  });

  it('blocks checkout when cart quantity exceeds available stock', () => {
    mockState.products = [
      {
        id: 'p-stock-low',
        sellerId: 's-1',
        title: 'Casque Audio',
        price: 12000,
        stock: 1,
        images: ['https://example.com/p.jpg'],
        variants: [],
      },
    ];
    mockState.cart = [
      {
        id: 'c-1',
        productId: 'p-stock-low',
        quantity: 3,
        variantSelected: {},
        selected: true,
      },
    ];

    render(<CartTab />);
    const checkoutBtn = screen.getByRole('button', { name: /Passer la commande/i });
    expect(checkoutBtn).toBeDisabled();
    expect(screen.getByText(/dépassant le stock disponible/i)).toBeInTheDocument();
  });

  it('generates and triggers real Blob receipt download in OrdersSettingsScreen', () => {
    const createObjectURL = vi.fn(() => 'blob:mock-receipt');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, writable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, writable: true });

    render(<OrdersSettingsScreen onBack={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Détails & Reçu/i }));
    const downloadBtn = screen.getByRole('button', { name: /Télécharger reçu/i });
    fireEvent.click(downloadBtn);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-receipt');
  });

  it('completes the full 4-step DJASSA checkout flow with empty-by-default address, seller-managed delivery (0 FCFA), online 6.5% / COD 0% pricing, promo validation, and honest order result', async () => {
    const sampleProduct: Product = {
      id: 'prod-casque-1',
      name: 'Casque Bluetooth Sans Fil',
      description: 'Casque haute fidélité',
      images: ['https://example.com/casque.jpg'],
      price: 25000,
      originalPrice: 35000,
      discountPercentage: 29,
      stock: 10,
      variants: [
        { type: 'Couleur', options: ['Noir', 'Blanc'] },
        { type: 'Taille', options: ['Unique'] },
      ],
      variantStock: { Noir: 6, Blanc: 4, Unique: 10 },
      category: 'Électronique',
      sellerId: 's-1',
      location: 'Adjamé',
      rating: 4.8,
      salesCount: 320,
      reviewsCount: 45,
      inStock: true,
      delivery: { estimatedDays: '1-2 jours', fee: 0, mode: 'Standard', location: 'Adjamé' },
      conditions: {
        isRefundable: true,
        returnPeriodDays: 7,
        returnConditions: [],
        refundConditions: [],
        nonRefundableSituations: [],
        fees: '',
        procedure: '',
      },
      specs: { Unité: 'Pièce' },
      tags: [],
    };
    mockState.products = [sampleProduct as unknown as Record<string, unknown>];

    render(<DjassaOrderFlow mode="direct" initialProduct={sampleProduct} onClose={vi.fn()} />);

    // Step 1: Product Verification
    expect(screen.getByText(/Vérification du produit/i)).toBeInTheDocument();
    expect(screen.getByText(/Selon mode choisi/i)).toBeInTheDocument();
    expect(screen.getByText(/6 pièces restantes/i)).toBeInTheDocument();

    fireEvent.click(document.getElementById('btn-checkout-step1-continue')!);

    // Step 2: Delivery Address — starts empty, seller-managed delivery at 0 FCFA
    expect(screen.getByText(/Adresse de livraison/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ex : Kouassi Aka/i)).toHaveValue('');
    expect(screen.queryByText(/Ivoire Express Flotte Pro/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Livraison gérée par la boutique/i).length).toBeGreaterThan(0);

    // Explicit button fills saved profile address
    fireEvent.click(screen.getByRole('button', { name: /Réutiliser mon adresse enregistrée/i }));
    expect(screen.getByPlaceholderText(/Ex : Kouassi Aka/i)).toHaveValue('Kouassi Aya');

    fireEvent.click(document.getElementById('btn-checkout-step2-continue')!);

    // Step 3: Payment Mode (Online 6.5% vs COD 0%) + Promo Code — nothing preselected
    expect(await screen.findByRole('heading', { name: /Mode de paiement/i })).toBeInTheDocument();
    expect(document.getElementById('btn-checkout-step3-pay')).toBeDisabled();

    // Check COD 0% option first
    fireEvent.click(document.getElementById('btn-payment-mode-cod')!);
    expect(screen.getByText(/0 FCFA \(0%\)/i)).toBeInTheDocument();

    // Switch to Online Payment and pick Orange Money (6.5% client fee)
    fireEvent.click(document.getElementById('btn-payment-mode-online')!);
    fireEvent.click(document.getElementById('btn-payment-method-orange-money')!);
    expect(screen.getByText(/Frais paiement en ligne \(6,5%\)/i)).toBeInTheDocument();

    const promoInput = screen.getByPlaceholderText(/Entrez votre code promo/i);
    fireEvent.change(promoInput, { target: { value: 'BADCODE' } });
    fireEvent.click(screen.getByRole('button', { name: /^Appliquer$/i }));
    expect(await screen.findByText(/Code promo invalide ou expiré/i)).toBeInTheDocument();

    fireEvent.change(promoInput, { target: { value: 'ADJAME10' } });
    fireEvent.click(screen.getByRole('button', { name: /^Appliquer$/i }));
    expect(await screen.findByText(/ADJAME10 appliqué/i)).toBeInTheDocument();

    fireEvent.click(document.getElementById('btn-checkout-step3-pay')!);

    // Step 4: Order Validation + Submit
    expect(await screen.findByText(/Confirmation de votre commande/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Livraison gérée par la boutique/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Paiement en ligne — Orange Money/i)).toBeInTheDocument();

    fireEvent.click(document.getElementById('btn-checkout-step4-confirm')!);

    await waitFor(() => {
      expect(mockState.createOrder).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ quantity: 1 })]),
        'orange_money',
        expect.objectContaining({ commune: 'Cocody', quartier: 'Riviera' }),
        expect.objectContaining({
          paymentMode: 'online',
          promoCode: 'ADJAME10',
        })
      );
    });

    // Honest result screen (pending until verified payment webhook, no legacy OTP)
    expect(await screen.findByText(/Finalisez votre paiement en ligne/i)).toBeInTheDocument();
    expect(screen.getByText(/#ADJ99999/)).toBeInTheDocument();
    expect(screen.getAllByText(/Commande confirmée/i).length).toBeGreaterThan(0);
  });

  it('prevents Step 1 progression when selected variant has zero stock', () => {
    const oosProduct: Product = {
      id: 'prod-oos',
      name: 'Article Épuisé',
      description: 'Test rupture',
      images: ['https://example.com/oos.jpg'],
      price: 15000,
      stock: 5,
      variants: [{ type: 'Couleur', options: ['Rouge', 'Vert'] }],
      variantStock: { Rouge: 0, Vert: 0 },
      category: 'Mode',
      sellerId: 's-1',
      location: 'Adjamé',
      rating: 0,
      salesCount: 0,
      inStock: true,
      delivery: { estimatedDays: '1-2 jours', fee: 1500, mode: 'Standard', location: 'Adjamé' },
      conditions: {
        isRefundable: true,
        returnPeriodDays: 7,
        returnConditions: [],
        refundConditions: [],
        nonRefundableSituations: [],
        fees: '',
        procedure: '',
      },
      specs: {},
      tags: [],
    };
    mockState.products = [oosProduct as unknown as Record<string, unknown>];

    render(<DjassaOrderFlow mode="direct" initialProduct={oosProduct} onClose={vi.fn()} />);
    const continueBtn = document.getElementById('btn-checkout-step1-continue') as HTMLButtonElement;
    expect(continueBtn).toBeDisabled();
    expect(screen.getByText(/Variante épuisée/i)).toBeInTheDocument();
  });

  it('renders client subscriptions (300/600/1200 FCFA), uses strict GeniusPay methods, shows honest pending checkoutUrl without fake success, and refreshes state when confirmed', async () => {
    render(<KlingAiCreditsModal />);

    expect(screen.getByRole('heading', { name: /DJASSA Mini/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /DJASSA Plus/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /DJASSA Premium/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Passer à DJASSA Mini/i }));

    // Only strict GeniusPay methods (Wave, Orange Money, MTN MoMo, Carte Bancaire) — no incompatible Moov Money
    expect(screen.getByRole('button', { name: /^Wave$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Orange Money$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^MTN MoMo$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Carte Bancaire$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Moov Money/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Orange Money$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Payer 300 FCFA/i }));

    await waitFor(() => {
      expect(mockState.confirmRecharge).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: 'mini',
          purchaseType: 'subscription',
          amountFcfa: 300,
          paymentMethod: 'orange_money',
        })
      );
    });

    // Honest pending status + checkoutUrl link rendered; NEVER claims "Achat réussi"
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Paiement en attente de confirmation/i })).toBeInTheDocument();
    });
    const gpLink = screen.getByRole('link', { name: /Finaliser le paiement sur GeniusPay/i });
    expect(gpLink).toHaveAttribute('href', 'https://pay.genius.ci/checkout/dep_test_mini');
    expect(screen.queryByText(/Achat réussi/i)).not.toBeInTheDocument();

    // Clicking verification checks status and refreshes state upon confirmation
    fireEvent.click(screen.getByRole('button', { name: /Vérifier le statut du paiement/i }));
    await waitFor(() => {
      expect(mockState.checkRechargeStatus).toHaveBeenCalledWith('rch-mini-1');
      expect(mockState.refreshCreditsState).toHaveBeenCalled();
    });
  });

  it('displays 4 distinct full-body Femme and 4 distinct full-body Homme morphologies separated cleanly without cropping and sends morphology metadata on try-on', async () => {
    expect(FEMALE_TRY_ON_MODELS).toHaveLength(4);
    expect(MALE_TRY_ON_MODELS).toHaveLength(4);
    expect(FEMALE_TRY_ON_MODELS.map((m) => m.morphologyLabel)).toEqual(['Fine', 'Moyenne', 'Ronde', 'Grande taille']);
    expect(MALE_TRY_ON_MODELS.map((m) => m.morphologyLabel)).toEqual(['Mince', 'Moyenne', 'Athlétique', 'Corpulente']);

    const fashionProduct: Product = {
      id: 'prod-robe-1',
      name: 'Robe Wax Chic',
      description: 'Robe ajustée',
      images: ['https://example.com/robe.jpg'],
      price: 18000,
      stock: 5,
      variants: [{ type: 'Couleur', options: ['Orange Terracotta', 'Bleu Indigo'] }],
      category: 'Mode Femme',
      sellerId: 's-1',
      location: 'Adjamé',
      rating: 4.9,
      salesCount: 80,
      inStock: true,
      delivery: { estimatedDays: '1-2 jours', fee: 1500, mode: 'Standard', location: 'Adjamé' },
      conditions: {
        isRefundable: true,
        returnPeriodDays: 7,
        returnConditions: [],
        refundConditions: [],
        nonRefundableSituations: [],
        fees: '',
        procedure: '',
      },
      specs: {},
      tags: [],
    };

    render(<GoogleShoppingTryOnModal product={fashionProduct} onClose={vi.fn()} />);

    // Femmes active by default: all 4 female morphologies visible, male names absent
    expect(screen.getByRole('button', { name: /Mannequin Awa - Fine \(S\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mannequin Kadiatou - Moyenne \(M\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mannequin Fatou - Ronde \(L\/XL\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mannequin Aminata - Grande taille \(XXL\)/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mannequin Malik/i })).not.toBeInTheDocument();

    // Select Fatou (Ronde L/XL) -> full-body preview uses object-contain and updates immediately
    fireEvent.click(screen.getByRole('button', { name: /Mannequin Fatou - Ronde \(L\/XL\)/i }));
    const heroImg = screen.getByAltText(/Fatou \(Ronde - Taille L\/XL\)/i);
    expect(heroImg.className).toContain('object-contain');

    // Launch AI Try-On -> verifies morphology + size + color are transmitted
    fireEvent.click(document.getElementById('btn-launch-try-on')!);
    await waitFor(() => {
      expect(mockState.generateTryOn).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: 'Fatou',
          modelGender: 'female',
          morphology: 'Ronde',
          size: 'L/XL',
          productName: 'Robe Wax Chic',
        })
      );
    });

    // Switch to Hommes tab -> displays only 4 Male morphologies cleanly separated
    fireEvent.click(screen.getByRole('button', { name: /^Hommes$/i }));
    expect(screen.getByRole('button', { name: /Mannequin Yao - Mince \(S\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mannequin Koffi - Moyenne \(M\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mannequin Malik - Athlétique \(L\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mannequin Ibrahim - Corpulente \(XL\/XXL\)/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mannequin Fatou/i })).not.toBeInTheDocument();
  });
});
