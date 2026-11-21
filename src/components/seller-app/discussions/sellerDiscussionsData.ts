import { Conversation, Message } from '../../../types';

export interface SellerConversationMeta {
  orderNumber?: string;
  orderTotal?: number;
  orderStatus?: 'Commande confirmée';
  productName?: string;
  productPrice?: number;
  productImage?: string;
  clientLocation?: string;
  clientPhone?: string;
}

export const SELLER_INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'sconv-client-1',
    participantId: 'client-aminata',
    participantType: 'client',
    participantRole: 'client',
    participantName: 'Aminata Traoré',
    participantAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
    participantVerified: true,
    participantRoleSubtitle: 'Cliente Cocody Riviera 3 • Commande #DJ-2026-09412',
    lastMessage: 'Bonjour Mme Kouamé ! Est-ce que la Combinaison Pantalon Wax Ankara Chic taille grand ou normal ?',
    lastMessageTime: '14:22',
    unreadCount: 1,
    isOnline: true,
    online: true,
    relatedOrderId: 'DJ-2026-09412',
    relatedProductId: 'prod-6'
  },
  {
    id: 'sconv-client-2',
    participantId: 'client-ibrahim',
    participantType: 'client',
    participantRole: 'client',
    participantName: 'Ibrahim Koné',
    participantAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    participantVerified: true,
    participantRoleSubtitle: 'Client Plateau • Commande #DJ-2026-08831',
    lastMessage: 'Bonsoir, j’ai bien validé mon paiement Wave. Pouvez-vous organiser la remise dans l’après-midi svp ?',
    lastMessageTime: 'Hier 17:45',
    unreadCount: 0,
    isOnline: false,
    online: false,
    relatedOrderId: 'DJ-2026-08831',
    relatedProductId: 'prod-1'
  },
  {
    id: 'sconv-client-3',
    participantId: 'client-fatou',
    participantType: 'client',
    participantRole: 'client',
    participantName: 'Fatou Bamba',
    participantAvatar: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=200',
    participantVerified: true,
    participantRoleSubtitle: 'Cliente Yopougon Maroc • Négociation gros',
    lastMessage: 'Bonjour la boutique ! Si je prends 3 pièces de tissu wax pour un mariage, faites-vous une remise ?',
    lastMessageTime: 'Hier 10:15',
    unreadCount: 0,
    isOnline: true,
    online: true,
    relatedProductId: 'prod-1'
  },
  {
    id: 'sconv-support-1',
    participantId: 'support-djassa',
    participantType: 'seller',
    participantRole: 'seller',
    participantName: 'Support Marchands Djassa',
    participantAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200',
    participantVerified: true,
    participantRoleSubtitle: 'Pôle Partenaires & Reversements Wave / Orange Money',
    lastMessage: 'Félicitations pour vos ventes ! Votre reversement de 148 500 FCFA a été validé sur votre compte Wave.',
    lastMessageTime: '23 Sep',
    unreadCount: 0,
    isOnline: true,
    online: true
  }
];

export const SELLER_INITIAL_MESSAGES: Record<string, Message[]> = {
  'sconv-client-1': [
    {
      id: 'smsg-c1-1',
      conversationId: 'sconv-client-1',
      senderId: 'client-aminata',
      senderType: 'client',
      content: 'Bonjour Mme Kouamé ! Je suis très intéressée par la Combinaison Pantalon Wax Ankara Chic que j’ai vue dans votre boutique.',
      type: 'text',
      timestamp: '14:15',
      status: 'read'
    },
    {
      id: 'smsg-c1-2',
      conversationId: 'sconv-client-1',
      senderId: 'seller-current',
      senderType: 'seller',
      content: 'Bonjour Aminata ! Merci pour votre intérêt ✨ C’est une de nos créations phares, taillée dans un wax premium 100% coton qui tient parfaitement la forme.',
      type: 'text',
      timestamp: '14:18',
      status: 'read'
    },
    {
      id: 'smsg-c1-3',
      conversationId: 'sconv-client-1',
      senderId: 'client-aminata',
      senderType: 'client',
      content: 'Bonjour Mme Kouamé ! Est-ce que la Combinaison Pantalon Wax Ankara Chic taille grand ou normal ? J’hésite entre la taille M et la taille L.',
      type: 'text',
      timestamp: '14:22',
      status: 'delivered'
    }
  ],
  'sconv-client-2': [
    {
      id: 'smsg-c2-1',
      conversationId: 'sconv-client-2',
      senderId: 'client-ibrahim',
      senderType: 'client',
      content: 'Bonsoir, j’ai bien validé mon paiement Wave pour la commande #DJ-2026-08831.',
      type: 'text',
      timestamp: 'Hier 17:40',
      status: 'read'
    },
    {
      id: 'smsg-c2-2',
      conversationId: 'sconv-client-2',
      senderId: 'client-ibrahim',
      senderType: 'client',
      content: 'Bonsoir, j’ai bien validé mon paiement Wave. Pouvez-vous faire un emballage cadeau soigné svp ? C’est pour l’anniversaire de mon épouse.',
      type: 'text',
      timestamp: 'Hier 17:45',
      status: 'read'
    },
    {
      id: 'smsg-c2-3',
      conversationId: 'sconv-client-2',
      senderId: 'seller-current',
      senderType: 'seller',
      content: 'Bonsoir M. Koné ! C’est un honneur, nous ajoutons un nœud satiné et organisons la remise cet après-midi au Plateau ✨',
      type: 'text',
      timestamp: 'Hier 17:48',
      status: 'read'
    }
  ],
  'sconv-client-3': [
    {
      id: 'smsg-c3-1',
      conversationId: 'sconv-client-3',
      senderId: 'client-fatou',
      senderType: 'client',
      content: 'Bonjour la boutique ! Si je prends 3 pièces de tissu wax pour un mariage, faites-vous une remise ?',
      type: 'text',
      timestamp: 'Hier 10:15',
      status: 'read'
    },
    {
      id: 'smsg-c3-2',
      conversationId: 'sconv-client-3',
      senderId: 'seller-current',
      senderType: 'seller',
      content: 'Bonjour Fatou ! Oui absolument, pour 3 pièces nous vous accordons une remise et organisons la livraison sans frais.',
      type: 'text',
      timestamp: 'Hier 10:20',
      status: 'read'
    }
  ],
  'sconv-support-1': [
    {
      id: 'smsg-s1-1',
      conversationId: 'sconv-support-1',
      senderId: 'support-djassa',
      senderType: 'seller',
      content: 'Félicitations pour vos ventes ! Votre reversement de 148 500 FCFA a été validé sur votre compte Wave.',
      type: 'text',
      timestamp: '23 Sep',
      status: 'read'
    },
    {
      id: 'smsg-s1-2',
      conversationId: 'sconv-support-1',
      senderId: 'seller-current',
      senderType: 'seller',
      content: 'Merci au support Djassa pour la rapidité du reversement Wave ! Tout fonctionne parfaitement.',
      type: 'text',
      timestamp: '23 Sep',
      status: 'read'
    }
  ]
};
