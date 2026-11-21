import {
  Conversation,
  Message,
  NotificationItem,
  Order,
  Product,
  Seller,
  SellerCreation,
  TryOnHistoryItem,
  UserProfile,
  VideoComment
} from '../types';

export const ABIDJAN_COMMUNES: string[] = [
  'Cocody',
  'Adjamé',
  'Plateau',
  'Marcory',
  'Treichville',
  'Yopougon',
  'Koumassi',
  'Abobo',
  'Port-Bouët',
  'Attécoubé',
  'Bingerville',
  'Anyama',
  'Songon',
  'Grand-Bassam'
];

export const INITIAL_SELLERS: Seller[] = [
  {
    id: 'seller-1',
    name: 'Boutique Wax & Élégance',
    storeName: 'Boutique Wax & Élégance',
    username: '@wax_elegance_ci',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
    banner: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=900',
    location: 'Adjamé Forum des Marchés, Abidjan',
    marketLocation: 'Adjamé Forum, Allée C',
    verified: true,
    rating: 4.9,
    reviewsCount: 312,
    followedCount: 4820,
    salesCount: 6180,
    bio: 'Maison de couture & pagnes Uniwax, Baoulé tissé et prêt-à-porter chic livrés partout à Abidjan.',
    phone: '+225 05 44 22 11 00',
    whatsapp: '+225 05 44 22 11 00',
    email: 'vendeur@djassa.ci',
    category: 'Mode & Habillement',
    openingHours: 'Lun - Sam • 08h00 - 19h30',
    badges: ['Vendeur Vérifié', 'Top Boutique Abidjan', 'Livraison gérée par la boutique']
  },
  {
    id: 'seller-2',
    name: 'HighTech Abidjan Express',
    storeName: 'HighTech Abidjan Express',
    username: '@hightech_abidjan',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    banner: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=900',
    location: 'Cocody Angré 8e Tranche, Abidjan',
    marketLocation: 'Cocody Angré',
    verified: true,
    rating: 4.8,
    reviewsCount: 146,
    followedCount: 2340,
    salesCount: 1890,
    bio: 'Accessoires audio Bluetooth, gadgets connectés et équipements maison testés et garantis.',
    phone: '+225 07 55 33 22 11',
    whatsapp: '+225 07 55 33 22 11',
    email: 'hightech@djassa.ci',
    category: 'Électronique & High-Tech',
    openingHours: 'Lun - Dim • 09h00 - 20h00',
    badges: ['Garantie 6 Mois', 'Livraison Vendeur']
  },
  {
    id: 'seller-3',
    name: 'Kaba & Souliers Chic',
    storeName: 'Kaba & Souliers Chic',
    username: '@kaba_souliers',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
    banner: 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=900',
    location: 'Marcory Zone 4, Abidjan',
    marketLocation: 'Marcory Zone 4',
    verified: true,
    rating: 4.85,
    reviewsCount: 118,
    followedCount: 1950,
    salesCount: 1420,
    bio: 'Mocassins cuir faits main, sneakers streetwear et maroquinerie haut de gamme.',
    phone: '+225 01 22 33 44 55',
    whatsapp: '+225 01 22 33 44 55',
    email: 'kaba@djassa.ci',
    category: 'Chaussures & Maroquinerie',
    openingHours: 'Lun - Sam • 09h00 - 19h00',
    badges: ['Qualité Cuir Certifiée']
  }
];

const DEFAULT_RETURN_CONDITIONS = {
  isRefundable: true,
  returnPeriodDays: 7,
  returnConditions: ['Article non porté ni lavé', 'Étiquette et emballage d’origine intacts'],
  refundConditions: ['Produit non conforme ou défaut avéré à réception'],
  nonRefundableSituations: ['Article personnalisé ou abîmé par le client après remise OTP'],
  fees: 'Retour gratuit en cas d’erreur vendeur',
  procedure: 'Signaler dans Mes Achats sous 7 jours avec photo justificative.'
};

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    sellerId: 'seller-1',
    name: 'Robe Wax Moderne Africaine Stylée',
    description:
      'Magnifique ensemble robe wax taillée sur mesure, tissu 100% coton véritable Uniwax. Idéale pour vos cérémonies et sorties chics à Abidjan.',
    images: [
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600'
    ],
    mediaType: 'image',
    price: 18500,
    originalPrice: 25000,
    discountPercentage: 26,
    stock: 24,
    variants: [
      { type: 'Couleur', options: ['Orange / Bleu', 'Vert Émeraude', 'Jaune Soleil'] },
      { type: 'Taille', options: ['S', 'M', 'L', 'XL'] }
    ],
    variantStock: {
      'Orange / Bleu': 8,
      'Vert Émeraude': 8,
      'Jaune Soleil': 8,
      S: 4,
      M: 8,
      L: 6,
      XL: 6
    },
    category: 'Mode & Habillement',
    location: 'Adjamé, Abidjan',
    rating: 4.9,
    salesCount: 1420,
    reviewsCount: 128,
    likesCount: 940,
    viewsCount: 14200,
    savesCount: 310,
    sharesCount: 185,
    inStock: true,
    isPromotion: true,
    promoBadge: '-26%',
    delivery: { estimatedDays: 'Sous 24h', fee: 1500, mode: 'Express Abidjan', location: 'Adjamé' },
    conditions: DEFAULT_RETURN_CONDITIONS,
    specs: { Matière: '100% Coton Uniwax', Origine: 'Confection Abidjan' },
    tags: ['wax', 'robe', 'mode', 'abidjan'],
    contentType: 'product'
  },
  {
    id: 'prod-2',
    sellerId: 'seller-2',
    name: 'Écouteurs Bluetooth Pro 5.3 Stéréo',
    description:
      'Écouteurs intra-auriculaires autonomie 28h avec boîtier numérique LED, réduction de bruit active et son bass puissant.',
    images: [
      'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600',
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600'
    ],
    mediaType: 'image',
    price: 12000,
    originalPrice: 16000,
    discountPercentage: 25,
    stock: 50,
    variants: [{ type: 'Couleur', options: ['Noir Mat', 'Blanc Perle'] }],
    variantStock: { 'Noir Mat': 30, 'Blanc Perle': 20 },
    category: 'Électronique & High-Tech',
    location: 'Cocody Angré, Abidjan',
    rating: 4.8,
    salesCount: 220,
    reviewsCount: 64,
    likesCount: 410,
    viewsCount: 6800,
    savesCount: 125,
    sharesCount: 74,
    inStock: true,
    isPromotion: true,
    promoBadge: '-25%',
    delivery: { estimatedDays: 'Sous 24h', fee: 1500, mode: 'Express Abidjan', location: 'Cocody' },
    conditions: DEFAULT_RETURN_CONDITIONS,
    specs: { Bluetooth: '5.3 Low Latency', Autonomie: '28 heures' },
    tags: ['bluetooth', 'ecouteurs', 'hightech'],
    contentType: 'product'
  },
  {
    id: 'prod-3',
    sellerId: 'seller-3',
    name: 'Mocassins Cuir Homme Faits Main',
    description:
      'Chaussures mocassins confortables en cuir pleine fleur cousues main. Semelle antidérapante souple et durable pour le travail ou les cérémonies.',
    images: [
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600',
      'https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=600'
    ],
    mediaType: 'image',
    price: 24500,
    originalPrice: 32000,
    discountPercentage: 23,
    stock: 15,
    variants: [
      { type: 'Taille', options: ['40', '41', '42', '43', '44', '45'] },
      { type: 'Couleur', options: ['Marron Cognac', 'Noir Profond'] }
    ],
    variantStock: {
      '40': 2,
      '41': 3,
      '42': 4,
      '43': 3,
      '44': 2,
      '45': 1,
      'Marron Cognac': 9,
      'Noir Profond': 6
    },
    category: 'Chaussures & Maroquinerie',
    location: 'Marcory Zone 4, Abidjan',
    rating: 4.85,
    salesCount: 95,
    reviewsCount: 38,
    likesCount: 285,
    viewsCount: 4100,
    savesCount: 92,
    sharesCount: 41,
    inStock: true,
    delivery: { estimatedDays: 'Sous 24h', fee: 1500, mode: 'Express Abidjan', location: 'Marcory' },
    conditions: DEFAULT_RETURN_CONDITIONS,
    specs: { Matière: 'Cuir véritable', Semelle: 'Gomme antidérapante' },
    tags: ['chaussures', 'mocassins', 'cuir'],
    contentType: 'product'
  },
  {
    id: 'prod-4',
    sellerId: 'seller-1',
    name: 'Sac à Main Cuir & Pagne Baoulé Tissé',
    description:
      'Sac artisanal haut de gamme confectionné à la main avec empiècements en pagne Baoulé traditionnel d’Ahougnansou et cuir noble.',
    images: [
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600',
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600'
    ],
    mediaType: 'image',
    price: 26000,
    originalPrice: 35000,
    discountPercentage: 25,
    stock: 18,
    variants: [{ type: 'Couleur', options: ['Bleu Indigo Royal', 'Ocre Solaire'] }],
    variantStock: { 'Bleu Indigo Royal': 10, 'Ocre Solaire': 8 },
    category: 'Sacs & Maroquinerie',
    location: 'Adjamé, Abidjan',
    rating: 4.9,
    salesCount: 1100,
    reviewsCount: 94,
    likesCount: 720,
    viewsCount: 9600,
    savesCount: 245,
    sharesCount: 112,
    inStock: true,
    isPromotion: true,
    promoBadge: '-25%',
    delivery: { estimatedDays: 'Sous 24h', fee: 1500, mode: 'Express Abidjan', location: 'Adjamé' },
    conditions: DEFAULT_RETURN_CONDITIONS,
    specs: { Textile: 'Pagne Baoulé tissé main', Finition: 'Cuir pleine fleur' },
    tags: ['sac', 'baoule', 'maroquinerie'],
    contentType: 'product'
  },
  {
    id: 'prod-5',
    sellerId: 'seller-1',
    name: 'Ensemble Boubou Bazin Riche Brodé',
    description:
      'Ensemble traditionnel en Bazin riche teinté à l’indigo naturel avec broderies royales dorées au fil de soie.',
    images: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600'
    ],
    mediaType: 'image',
    price: 45000,
    originalPrice: 60000,
    discountPercentage: 25,
    stock: 12,
    variants: [{ type: 'Taille', options: ['M', 'L', 'XL', 'XXL'] }],
    variantStock: { M: 3, L: 4, XL: 3, XXL: 2 },
    category: 'Mode & Cérémonie',
    location: 'Adjamé, Abidjan',
    rating: 4.95,
    salesCount: 2300,
    reviewsCount: 152,
    likesCount: 1320,
    viewsCount: 18400,
    savesCount: 420,
    sharesCount: 240,
    inStock: true,
    delivery: { estimatedDays: 'Sous 24h', fee: 1500, mode: 'Express Abidjan', location: 'Adjamé' },
    conditions: DEFAULT_RETURN_CONDITIONS,
    specs: { Tissu: 'Bazin Riche 1er choix', Broderie: 'Fil de soie doré' },
    tags: ['bazin', 'boubou', 'ceremonie'],
    contentType: 'product'
  },
  {
    id: 'prod-6',
    sellerId: 'seller-1',
    name: 'Combinaison Pantalon Wax Ankara Chic',
    description:
      'Combinaison élégante cintrée à la taille avec ceinture amovible et poches italiennes. Tissu Wax hollandais garanti grand teint.',
    images: [
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600'
    ],
    mediaType: 'image',
    price: 22000,
    originalPrice: 28000,
    discountPercentage: 21,
    stock: 16,
    variants: [
      { type: 'Taille', options: ['S', 'M', 'L', 'XL'] },
      { type: 'Modèle', options: ['Fleurs de Mariage', 'Écailles Royales'] }
    ],
    variantStock: { S: 4, M: 5, L: 4, XL: 3, 'Fleurs de Mariage': 9, 'Écailles Royales': 7 },
    category: 'Mode & Habillement',
    location: 'Adjamé, Abidjan',
    rating: 4.88,
    salesCount: 1000,
    reviewsCount: 81,
    likesCount: 640,
    viewsCount: 8900,
    savesCount: 198,
    sharesCount: 95,
    inStock: true,
    delivery: { estimatedDays: 'Sous 24h', fee: 1500, mode: 'Express Abidjan', location: 'Adjamé' },
    conditions: DEFAULT_RETURN_CONDITIONS,
    specs: { Coupe: 'Cintrée taille haute', Tissu: 'Wax hollandais' },
    tags: ['wax', 'combinaison', 'ankara'],
    contentType: 'product'
  }
];

export const INITIAL_COMMENTS: Record<string, VideoComment[]> = {
  'prod-1': [
    {
      id: 'cmt-1',
      videoId: 'prod-1',
      userId: 'client-demo-2',
      userName: 'Awa Konaté',
      userAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
      content: 'Le tissu Uniwax est magnifique ! Livraison reçue à Cocody en moins d’une heure.',
      timestamp: 'Il y a 2h',
      likesCount: 14,
      isLikedByMe: false,
      replies: []
    }
  ]
};

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-demo-106',
    orderNumber: 'CMD-9820',
    items: [
      {
        productId: 'prod-1',
        productTitle: 'Robe Wax Moderne Africaine Stylée',
        productImage: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600',
        price: 18500,
        quantity: 1,
        variant: { Couleur: 'Orange / Bleu', Taille: 'M' },
        sellerId: 'seller-1',
        sellerName: 'Boutique Wax & Élégance'
      }
    ],
    sellerId: 'seller-1',
    sellerName: 'Boutique Wax & Élégance',
    sellerPhone: '+225 05 44 22 11 00',
    subtotal: 18500,
    deliveryFee: 0,
    deliveryMode: 'seller_managed',
    discount: 0,
    serviceFee: 1203,
    clientFeeFcfa: 1203,
    commissionFcfa: 150,
    commissionStatus: 'collected',
    sellerNetFcfa: 18350,
    sellerPayoutStatus: 'completed',
    total: 19703,
    paymentMode: 'online',
    paymentMethod: 'wave',
    paymentStatus: 'paid',
    visibleStatus: 'Commande confirmée',
    status: 'passed',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    deliveryAddress: {
      commune: 'Cocody',
      quartier: 'Angré 8e Tranche',
      details: 'Immeuble Azur, Porte 4',
      recipientName: 'Koffi Mariam',
      phone: '+225 07 08 09 10 11'
    },
    trackingEvents: [
      {
        status: 'passed',
        label: 'Commande confirmée',
        time: 'J-2 • 10:15',
        done: true,
        description: 'Paiement en ligne confirmé • Livraison organisée par Boutique Wax & Élégance'
      }
    ]
  }
];

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-client-seller-1',
    participantId: 'seller-1',
    participantType: 'seller',
    participantRole: 'seller',
    participantName: 'Boutique Wax & Élégance',
    participantAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
    participantVerified: true,
    participantRoleSubtitle: 'Boutique Adjamé Forum',
    lastMessage: 'Bonjour ! Tous nos modèles Wax sont disponibles en stock à Adjamé.',
    lastMessageTime: '10:30',
    unreadCount: 1,
    relatedProductId: 'prod-1',
    isOnline: true
  }
];

export const INITIAL_MESSAGES: Message[] = [
  {
    id: 'msg-init-1',
    conversationId: 'conv-client-seller-1',
    senderId: 'seller-1',
    senderType: 'seller',
    content: 'Bonjour ! Tous nos modèles Wax sont disponibles en stock à Adjamé.',
    type: 'text',
    timestamp: '10:30',
    status: 'delivered'
  }
];

export const INITIAL_MESSAGES_MAP: Record<string, Message[]> = {
  'conv-client-seller-1': INITIAL_MESSAGES
};

export const INITIAL_USER_PROFILE: UserProfile = {
  id: 'client-demo-1',
  name: 'Koffi Mariam',
  username: 'koffi_mariam',
  avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
  bio: 'Passionnée de mode ivoirienne et de belles trouvailles sur Abidjan.',
  phone: '+225 07 08 09 10 11',
  email: 'client@djassa.ci',
  aiCredits: 0,
  deliveryCommune: 'Cocody',
  deliveryQuartier: 'Angré 8e Tranche',
  deliveryAddressDetails: 'Près du carrefour prière, résidence Azur',
  followedSellerIds: ['seller-1'],
  likedVideoIds: ['prod-1'],
  savedItemIds: ['prod-1', 'prod-4'],
  viewingHistory: [],
  searchHistory: ['Robe Wax', 'Sac Baoulé'],
  devices: [
    {
      id: 'dev-1',
      name: 'Navigateur Web DJASSA',
      type: 'android',
      lastActive: 'En ligne',
      isCurrent: true
    }
  ],
  stats: {
    timeTodayMinutes: 18,
    timeWeekMinutes: 94,
    timeMonthMinutes: 340,
    watchTodayMinutes: 12,
    watchWeekMinutes: 60,
    watchMonthMinutes: 210,
    dailyUsageChart: [
      { day: 'Lun', minutes: 15 },
      { day: 'Mar', minutes: 22 },
      { day: 'Mer', minutes: 14 },
      { day: 'Jeu', minutes: 19 },
      { day: 'Ven', minutes: 12 },
      { day: 'Sam', minutes: 8 },
      { day: 'Dim', minutes: 18 }
    ]
  }
};

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Bienvenue sur DJASSA Abidjan',
    body: 'Découvrez les nouveautés Wax et profitez de la livraison express.',
    time: 'Aujourd’hui',
    read: false,
    type: 'promo'
  }
];

export const INITIAL_TRY_ON_HISTORY: TryOnHistoryItem[] = [];

export const INITIAL_SELLER_CREATIONS: SellerCreation[] = [];
