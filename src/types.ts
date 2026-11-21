export type TabType = 'accueil' | 'explorer' | 'discussions' | 'achats' | 'profil';
export type SellerTabType = 'boutique' | 'commandes' | 'revenus' | 'ajouter' | 'discussions' | 'profil' | 'chatgpt';
export type AdminTabType = 'dashboard' | 'utilisateurs' | 'publicite' | 'tendances' | 'revenus' | 'administration' | 'commandes' | 'discussions' | 'profil';

export type OrderPaymentMode = 'online' | 'cod';
export type PaymentMode = OrderPaymentMode;
export type OnlineOrderPaymentMethod = 'wave' | 'orange_money';
export type OrderPaymentMethod = OnlineOrderPaymentMethod | 'cash_on_delivery';
export type PaymentMethod = OrderPaymentMethod;
export type OrderCommissionStatus = 'pending' | 'collected' | 'paid' | 'cancelled';
export type SellerPayoutStatus =
  | 'not_applicable'
  | 'pending_payment'
  | 'pending_config'
  | 'pending_seller_account'
  | 'initiated'
  | 'completed'
  | 'failed';

export interface SellerPayoutSettings {
  sellerId: string;
  preferredChannel: 'wave' | 'orange_money';
  wavePhone?: string;
  orangeMoneyPhone?: string;
  accountHolderName?: string;
  updatedAt: string;
}

export interface CommissionSummaryStats {
  totalOrdersCount: number;
  generatedFcfa: number;
  collectedFcfa: number;
  pendingFcfa: number;
  paidFcfa: number;
  cancelledFcfa: number;
}

export interface CommissionEntryDto {
  orderId: string;
  orderNumber: string;
  sellerId: string;
  sellerName: string;
  clientId: string;
  clientName: string;
  paymentMode: OrderPaymentMode;
  paymentMethod: OrderPaymentMethod | string;
  paymentStatus: string;
  subtotal: number;
  discount: number;
  clientFeeFcfa: number;
  total: number;
  commissionFcfa: number;
  commissionStatus: OrderCommissionStatus;
  sellerNetFcfa: number;
  sellerPayoutStatus: SellerPayoutStatus;
  sellerPayoutReference?: string | null;
  createdAt: string;
}

export interface CommissionSettlementDto {
  id: string;
  orderId: string;
  orderNumber: string;
  sellerId: string;
  sellerName: string;
  amountFcfa: number;
  channel: string;
  providerReference?: string | null;
  status: 'pending_provider' | 'paid' | 'failed';
  settledBy?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface OrderReceiptDto {
  orderId: string;
  orderNumber: string;
  transactionNumber: string;
  providerReference?: string | null;
  date: string;
  visibleStatus: string;
  paymentMode: OrderPaymentMode;
  paymentModeLabel: string;
  paymentMethod: string;
  paymentStatus: string;
  client: {
    id: string;
    name: string;
    phone: string;
  };
  seller: {
    id: string;
    name: string;
  };
  items: OrderItem[];
  subtotal: number;
  discount: number;
  merchandiseNet: number;
  clientFeeFcfa: number;
  clientFeeRatePercent: number;
  totalPaidByClient: number;
  commissionFcfa: number;
  commissionStatus: OrderCommissionStatus;
  sellerNetFcfa: number;
  sellerPayoutStatus: SellerPayoutStatus;
  sellerPayoutReference?: string | null;
  sellerPayoutChannel?: 'wave' | 'orange_money' | null;
  providerFeeFcfa?: number | null;
  codSellerNotice?: string;
  deliveryAddress: Order['deliveryAddress'];
  history?: TrackingEvent[];
}

export interface Seller {
  id: string;
  name: string;
  storeName?: string;
  username: string;
  avatar: string;
  location: string;
  verified: boolean;
  rating: number;
  reviewsCount: number;
  followedCount: number; // Number of clients following this seller
  salesCount: number;
  bio: string;
  banner: string;
  phone: string;
  badges: string[];
  marketLocation?: string;
  whatsapp?: string;
  email?: string;
  category?: string;
  openingHours?: string;
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  website?: string;
}

export interface VariantItem {
  type: string;
  options: string[];
}

export interface ProductCondition {
  isRefundable: boolean;
  returnPeriodDays: number;
  returnConditions: string[];
  refundConditions: string[];
  nonRefundableSituations: string[];
  fees: string;
  procedure: string;
  refundSteps?: string[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  images: string[];
  /** Optional product photos associated with variant options (for example each colour). */
  variantImages?: Record<string, string[]>;
  /** Publication media type. This describes the post media only; seller/user avatars are never part of it. */
  mediaType?: 'video' | 'image';
  videoUrl?: string;
  videoPoster?: string;
  price: number;
  originalPrice?: number;
  discountPercentage?: number;
  stock: number;
  variants: {
    type: 'Taille' | 'Couleur' | 'Modèle' | 'Capacité' | 'Option';
    options: string[];
  }[];
  /** Stock quantity remaining per variant option (e.g. { "S": 5, "M": 12, "L": 2 }). */
  variantStock?: Record<string, number>;
  category: string;
  sellerId: string;
  location: string;
  rating: number;
  salesCount: number;
  reviewsCount?: number;
  /** Social commerce metrics displayed on product/video grids. */
  likesCount?: number;
  viewsCount?: number;
  videoLikesCount?: number;
  videoViewsCount?: number;
  savesCount?: number;
  sharesCount?: number;
  inStock: boolean;
  delivery: {
    estimatedDays: string;
    fee: number;
    mode: string;
    location: string;
  };
  conditions: ProductCondition;
  specs: Record<string, string>;
  tags: string[];
  isPromotion?: boolean;
  promoBadge?: string;
  promoEndDate?: string;
  promoType?: string;
  promoStockLimit?: number;
  promoNotifyFollowers?: boolean;
  promoShowCountdown?: boolean;
  /** Distinguishes a catalog product from a social publication in seller content. */
  contentType?: 'product' | 'publication';
}

export interface VideoCommentReply {
  id: string;
  commentId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  replyToUserName?: string;
  content: string;
  timestamp: string;
  likesCount: number;
  isLikedByMe: boolean;
  audioUrl?: string;
  audioDuration?: number;
  gifUrl?: string;
  transcription?: string;
}

export interface VideoComment {
  id: string;
  videoId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  timestamp: string;
  likesCount: number;
  isLikedByMe: boolean;
  replies: VideoCommentReply[];
  audioUrl?: string;
  audioDuration?: number;
  gifUrl?: string;
  transcription?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  variantSelected: Record<string, string>;
  quantity: number;
  selected: boolean;
  addedAt: string;
}

export type OrderStatus =
  | 'pending_payment'
  | 'passed'
  | 'payment_confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'driver_assigned'
  | 'in_delivery'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'damaged';

export interface OrderIncident {
  type: 'damaged' | 'returned' | 'cancelled';
  reason: string;
  reportedAt: string;
  reportedBy: 'seller' | 'client';
  photoProof?: string;
  details?: string;
  compensationStatus?: 'pending' | 'approved' | 'refunded' | 'rejected';
  compensationAmount?: number;
  liability?: 'seller' | 'client';
}

export interface OrderItem {
  productId: string;
  productTitle: string;
  productImage: string;
  price: number;
  quantity: number;
  variant?: Record<string, string>;
  sellerId: string;
  sellerName: string;
}

export interface TrackingEvent {
  status: string;
  label: string;
  time: string;
  done: boolean;
  description: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  deliveryMode?: 'seller_managed' | 'normal' | 'express';
  discount: number;
  serviceFee?: number;
  clientFeeFcfa?: number;
  commissionFcfa?: number;
  commissionStatus?: OrderCommissionStatus;
  sellerNetFcfa?: number;
  sellerPayoutStatus?: SellerPayoutStatus;
  sellerPayoutReference?: string | null;
  sellerPayoutChannel?: 'wave' | 'orange_money' | null;
  sellerPayoutPhone?: string | null;
  providerFeeFcfa?: number | null;
  promoCode?: string;
  total: number;
  paymentMode?: OrderPaymentMode;
  paymentMethod: OrderPaymentMethod | 'mtn_momo' | 'card';
  paymentStatus: 'paid' | 'pending' | 'processing' | 'cod_pending' | 'failed' | 'refunded';
  paymentId?: string;
  paymentTransactionRef?: string;
  visibleStatus?: string;
  status: OrderStatus;
  sellerId?: string;
  sellerName?: string;
  sellerPhone?: string;
  clientId?: string;
  clientName?: string;
  createdAt: string;
  updatedAt?: string;
  estimatedDelivery?: string;
  clientAvatar?: string;
  sellerAvatar?: string;
  deliveryAddress: {
    commune: string;
    quartier: string;
    details: string;
    landmark?: string;
    deliveryInstructions?: string;
    gpsCoords?: { lat: number; lng: number };
    recipientName: string;
    phone: string;
    absencePolicy?: 'return_to_seller_next_day' | 'leave_with_authorized_person';
    absenceRecipientName?: string;
    absenceRecipientPhone?: string;
  };
  trackingEvents: TrackingEvent[];
  reviewGiven?: {
    rating: number;
    comment: string;
    date: string;
  };
  incident?: OrderIncident;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'client' | 'seller';
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'product_card' | 'order_card';
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
  meta?: {
    productId?: string;
    productTitle?: string;
    productPrice?: number;
    productImage?: string;
    videoUrl?: string;
    videoPoster?: string;
    videoDuration?: string;
    mediaName?: string;
    mediaSize?: string;
    mediaCaption?: string;
    orderId?: string;
    orderNumber?: string;
    orderTitle?: string;
    orderStatus?: string;
    audioDuration?: string;
    // Claims, Returns & Refunds
    isClaim?: boolean;
    claimNumber?: string;
    claimType?: 'exchange' | 'refund' | string;
    claimReason?: string;
    claimStatus?: 'pending' | 'in_review' | 'approved' | 'rejected' | string;
    claimResolution?: string;
    proofPhoto?: string;
    details?: string;
    // Damaged package
    isDamageAlert?: boolean;
    deliveryDate?: string;
    fee?: number;
    status?: string;
    [key: string]: any;
  };
}

export interface Conversation {
  id: string;
  participantId: string;
  participantType: 'seller' | 'client';
  participantRole?: 'client' | 'seller';
  participantName: string;
  participantAvatar: string;
  participantVerified: boolean;
  participantRoleSubtitle: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  relatedProductId?: string;
  relatedOrderId?: string;
  isOnline: boolean;
  online?: boolean;
}

export interface ActiveCall {
  participantId: string;
  participantName: string;
  participantAvatar: string;
  participantRole: string;
  participantType: 'seller' | 'client';
  status: 'connecting' | 'ringing' | 'connected' | 'ended';
  durationSeconds: number;
  isMuted: boolean;
  isSpeaker: boolean;
  direction: 'incoming' | 'outgoing';
  conversationId?: string;
  isMinimized?: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  type: 'order' | 'message' | 'promo' | 'seller';
  actionType?: 'open_order' | 'open_chat' | 'open_product';
  referenceId?: string;
}

export interface AiCreditTransaction {
  id: string;
  amount: number;
  type: 'spend' | 'earn' | 'bonus' | 'purchase' | 'refund';
  label: string;
  date: string;
  category: 'chat' | 'image' | 'video' | 'daily_bonus' | 'pack_purchase' | 'refund';
  amountFcfa?: number;
  modelUsed?: string;
  apiCostFcfa?: number;
  isEstimate?: boolean;
  costSource?: string;
  grossProfitFcfa?: number;
  status?: 'success' | 'failed' | 'refunded';
  idempotencyKey?: string;
  feeFcfa?: number;
}

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  avatar: string;
  bio: string;
  phone: string;
  email: string;
  aiCredits?: number;
  deliveryCommune: string;
  deliveryQuartier: string;
  deliveryAddressDetails: string;
  address?: string;
  birthDate?: string;
  accountRegion?: string;
  coverImage?: string;
  profileVideo?: string;
  pronouns?: string;
  instagram?: string;
  youtube?: string;
  tiktok?: string;
  website?: string;
  whatsapp?: string;
  preferredPaymentMethod?: string;
  favoriteCategories?: string[];
  shoeSize?: string;
  clothingSize?: string;
  gender?: string;
  showCommuneOnProfile?: boolean;
  showBuyerBadge?: boolean;
  showLikedVideos?: boolean;
  allowPersonalizedOffers?: boolean;
  followedSellerIds: string[];
  likedVideoIds: string[];
  savedItemIds: string[];
  viewingHistory: {
    videoId: string;
    viewedAt: string;
    watchDurationSec: number;
    completionRate: number;
  }[];
  searchHistory: string[];
  devices: {
    id: string;
    name: string;
    type: 'iphone' | 'android' | 'windows';
    lastActive: string;
    isCurrent: boolean;
  }[];
  stats: {
    timeTodayMinutes: number;
    timeWeekMinutes: number;
    timeMonthMinutes: number;
    watchTodayMinutes: number;
    watchWeekMinutes: number;
    watchMonthMinutes: number;
    dailyUsageChart: { day: string; minutes: number }[];
  };
}

export interface TryOnHistoryItem {
  id: string;
  productId: string;
  productName: string;
  productPrice: number;
  productOriginalPrice?: number;
  productImage: string;
  sellerId?: string;
  sellerName?: string;
  generatedImageUrl: string;
  modelName: string;
  size: string;
  color: string;
  angle: 'front' | 'side' | 'back';
  createdAt: string;
}

export interface SellerCreation {
  id: string;
  sellerId: string;
  title: string;
  type: 'photo' | 'video' | 'ai_video' | 'ai_photo';
  mediaUrl: string;
  thumbnailUrl?: string;
  posterUrl?: string;
  productId?: string;
  productName?: string;
  price?: number;
  prompt?: string;
  viewsCount?: number;
  likesCount?: number;
  sharesCount?: number;
  duration?: string;
  createdAt: string;
  isAiGenerated?: boolean;
  aspectRatio?: '9:16' | '1:1' | '16:9' | '4/5';
  status?: 'published' | 'draft' | 'featured';
}

export interface AdminUserPurchase {
  id: string;
  orderNumber: string;
  date: string;
  storeName: string;
  items: string;
  total: number;
  status: 'delivered' | 'in_delivery' | 'preparing' | 'cancelled';
}

export interface AdminUserLike {
  id: string;
  productTitle: string;
  storeName: string;
  image: string;
  price: number;
  likedAt: string;
}

export interface AdminUserComment {
  id: string;
  targetTitle: string;
  comment: string;
  rating?: number;
  date: string;
}

export interface AdminUserDiscussion {
  id: string;
  withName: string;
  withRole: 'seller' | 'client' | 'admin';
  avatar: string;
  lastMessage: string;
  date: string;
  unreadCount?: number;
}

export interface AdminUserRecord {
  id: string;
  name: string;
  username?: string;
  email: string;
  phone: string;
  role: 'client' | 'seller' | 'admin';
  status: 'active' | 'suspended' | 'pending_verification';
  avatar: string;
  createdAt: string;
  registeredDaysAgo?: number;
  isNew?: boolean;
  location: string;
  ordersCount: number;
  totalSpentOrEarned: number;
  kycVerified: boolean;
  storeName?: string;
  bio?: string;
  deliveryCommune?: string;
  followedSellerIds?: string[];
  banner?: string;
  dailyAverageMinutes?: number;
  timeTodayMinutes?: number;
  weeklyUsage?: { day: string; minutes: number }[];
  purchases?: AdminUserPurchase[];
  likes?: AdminUserLike[];
  comments?: AdminUserComment[];
  discussions?: AdminUserDiscussion[];
  kycDocument?: {
    type: 'cni' | 'passport' | 'rccm' | 'permis';
    number: string;
    submittedAt: string;
    documentUrl?: string;
  };
}

export interface AdminAuditLog {
  id: string;
  adminName: string;
  action: string;
  target: string;
  category: 'user' | 'order' | 'marketplace' | 'security' | 'financial';
  timestamp: string;
  details: string;
}

export interface PlatformConfig {
  marketplaceCommissionRate: number;
  sellerCommissionRate?: number;
  clientOnlineFeeRate?: number;
  withdrawalFeeRate?: number;
  baseDeliveryFee: number;
  minWithdrawalAmount: number;
  maintenanceMode: boolean;
  globalBannerMessage: string;
  enableWavePayments: boolean;
  enableOrangeMoney: boolean;
  enableMtnMomo?: boolean;
  requireKycForSellers: boolean;
}

export type BoostPlacement = 
  | 'hero_banner' 
  | 'search_top' 
  | 'sponsored_badge' 
  | 'push_notification' 
  | 'all';

export interface AdminBoostCampaign {
  id: string;
  title: string;
  targetType: 'seller' | 'product';
  targetId: string;
  targetName: string;
  targetImage: string;
  targetSubtitle?: string;
  targetPrice?: number;
  sellerId: string;
  sellerName: string;
  placement: BoostPlacement;
  targetZones: string[];
  startDate: string;
  endDate: string;
  durationDays: number;
  remainingDays: number;
  budgetFCFA: number;
  isFreeAdminGrant: boolean;
  status: 'active' | 'paused' | 'scheduled' | 'completed';
  impressionsCount: number;
  clicksCount: number;
  cartAdditionsCount?: number;
  ordersCount: number;
  revenueGeneratedFCFA: number;
  createdAt: string;
  notes?: string;
}

