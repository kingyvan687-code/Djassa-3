import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  Store, 
  User, 
  Phone, 
  Send, 
  Paperclip, 
  Mic, 
  Image as ImageIcon, 
  Package, 
  Check, 
  CheckCheck, 
  ArrowLeft, 
  Sparkles, 
  Plus, 
  X, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  Play, 
  Pause, 
  RotateCcw,  
  MapPin, 
  Navigation,
  ShieldCheck,
  ShieldAlert,
  Headphones,
  Copy,
  SlidersHorizontal,
  MessageSquare,
  Zap,
  DollarSign
} from 'lucide-react';
import { Order, Seller, AdminTabType } from '../../../types';
import { useApp } from '../../../context/AppContext';
import { formatFCFA } from '../../../services/marketServices';
import { audioService } from '../../../services/audioService';
import { VoipCallModal } from '../../chat/VoipCallModal';

export interface AdminDiscussionsTabProps {
  onSelectOrder?: (order: Order) => void;
  onNavigateTab?: (tab: AdminTabType) => void;
}

export type AdminFilterTab = 
  | 'all' 
  | 'unread' 
  | 'sellers' 
  | 'clients' 
  | 'disputes';

export interface AdminChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'admin' | 'seller' | 'client' | 'support';
  content: string;
  type: 'text' | 'image' | 'audio' | 'order_card' | 'location' | 'otp' | 'system_alert';
  timestamp: string;
  status: 'delivered' | 'read';
  meta?: {
    audioUrl?: string;
    audioDuration?: string;
    imageUrl?: string;
    orderId?: string;
    orderNumber?: string;
    productTitle?: string;
    deliveryFee?: number;
    destination?: string;
    disputeReason?: string;
  };
}

export interface AdminConversation {
  id: string;
  participantId: string;
  participantType: 'seller' | 'client' | 'dispute';
  participantRole: string;
  participantName: string;
  participantAvatar: string;
  participantVerified: boolean;
  participantRoleSubtitle: string;
  phone: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isOnline: boolean;
  relatedOrderId?: string;
  order?: Order;
}

export const AdminDiscussionsTab: React.FC<AdminDiscussionsTabProps> = ({
  onSelectOrder,
  onNavigateTab
}) => {
  const { 
    sellers,
    orders,
    adminUsers,
    startCall, 
    activeCall, 
    showToast,
    activeConversationId,
    setActiveConversationId
  } = useApp();

  // Initial seed conversations synthesized from real platform data
  const initialConversations = useMemo<AdminConversation[]>(() => {
    const list: AdminConversation[] = [];

    // 1. Arbitrage & Litige Urgent (Arbitrage Prioritaire Djassa)
    const disputeOrder = orders.find(o => o.status === 'cancelled' || o.status === 'returned' || o.status === 'damaged') || orders[0];
    list.push({
      id: 'aconv-dispute-urgent',
      participantId: 'dispute-hub-01',
      participantType: 'dispute',
      participantRole: 'Arbitrage Litige',
      participantName: `Litige #${disputeOrder ? disputeOrder.orderNumber : 'CMD-94821'} • Suivi commande`,
      participantAvatar: 'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?w=200',
      participantVerified: true,
      participantRoleSubtitle: 'Médiation acheteur-vendeur · Paiement vérifié',
      phone: '+225 07 09 88 77 66',
      lastMessage: 'Le client demande une vérification de livraison avec la boutique.',
      lastMessageTime: '14:42',
      unreadCount: 2,
      isOnline: true,
      relatedOrderId: disputeOrder?.orderNumber || '94821',
      order: disputeOrder
    });

    // 2. Boutiques & Marchands Partenaires (from real sellers)
    sellers.slice(0, 3).forEach((seller, idx) => {
      const sellerOrder = orders.find(o => o.items.some(i => i.sellerId === seller.id || i.sellerName === seller.name));
      const messagesPreset = [
        `Bonjour Direction Djassa, nous avons validé notre inventaire boutique. Nos documents KYC sont à jour.`,
        `Demande de virement des commissions sur notre compte Wave CI pour les ventes d'hier.`,
        `Bonjour, pouvons-nous sponsoriser notre nouvelle collection dans le carrousel d'accueil ?`
      ];

      list.push({
        id: `aconv-seller-${seller.id}`,
        participantId: seller.id,
        participantType: 'seller',
        participantRole: 'Boutique Marchand',
        participantName: seller.name,
        participantAvatar: seller.avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
        participantVerified: true,
        participantRoleSubtitle: `Boutique vérifiée • ${seller.location || 'Adjamé'} (${seller.category || 'Mode'})`,
        phone: seller.phone || '+225 07 48 33 22 11',
        lastMessage: messagesPreset[idx % messagesPreset.length],
        lastMessageTime: idx === 0 ? '13:50' : '11:15',
        unreadCount: idx === 0 ? 1 : 0,
        isOnline: true,
        relatedOrderId: sellerOrder?.orderNumber,
        order: sellerOrder
      });
    });

    // 3. Client Final (from real orders)
    const clientOrder = orders[0];
    if (clientOrder?.deliveryAddress?.phone) {
      list.push({
        id: `aconv-client-${clientOrder.id}`,
        participantId: `client-${clientOrder.id}`,
        participantType: 'client',
        participantRole: 'Client Destinataire',
        participantName: clientOrder.deliveryAddress.recipientName || 'Client Djassa',
        participantAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
        participantVerified: true,
        participantRoleSubtitle: `Client Acheteur • ${clientOrder.deliveryAddress.commune || 'Abidjan'}`,
        phone: clientOrder.deliveryAddress.phone,
        lastMessage: `Bonjour, commande #${clientOrder.orderNumber} bien confirmée.`,
        lastMessageTime: '10:15',
        unreadCount: 0,
        isOnline: true,
        relatedOrderId: clientOrder.orderNumber,
        order: clientOrder
      });
    }

    return list;
  }, [sellers, orders]);

  // Messages dictionary mapped by conversation ID
  const initialMessagesMap = useMemo<Record<string, AdminChatMessage[]>>(() => {
    const map: Record<string, AdminChatMessage[]> = {};

    // Dispute thread
    map['aconv-dispute-urgent'] = [
      {
        id: 'msg-dsp-1',
        conversationId: 'aconv-dispute-urgent',
        senderId: 'client-support',
        senderType: 'client',
        content: "Bonjour l'administration, ma commande #CMD-94821 devait arriver à 13h00 à Cocody Angré. Je souhaite contacter la boutique.",
        type: 'text',
        timestamp: '14:20',
        status: 'read'
      },
      {
        id: 'msg-dsp-2',
        conversationId: 'aconv-dispute-urgent',
        senderId: 'admin-central',
        senderType: 'admin',
        content: "Bonjour. La Centrale Djassa examine le dossier de votre commande confirmée et coordonne avec le vendeur.",
        type: 'text',
        timestamp: '14:25',
        status: 'read'
      }
    ];

    return map;
  }, []);

  // Persistent states
  const [conversations, setConversations] = useState<AdminConversation[]>(() => {
    try {
      const saved = localStorage.getItem('djassa_admin_conversations_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return initialConversations;
  });

  const [messages, setMessages] = useState<Record<string, AdminChatMessage[]>>(() => {
    try {
      const saved = localStorage.getItem('djassa_admin_messages_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {}
    return initialMessagesMap;
  });

  useEffect(() => {
    try {
      localStorage.setItem('djassa_admin_conversations_v3', JSON.stringify(conversations));
    } catch {}
  }, [conversations]);

  useEffect(() => {
    try {
      localStorage.setItem('djassa_admin_messages_v3', JSON.stringify(messages));
    } catch {}
  }, [messages]);

  // Active chat state
  const [activeChatId, setActiveChatId] = useState<string | null>(activeConversationId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<AdminFilterTab>('all');
  const [inputText, setInputText] = useState('');
  const [showAttachmentsMenu, setShowAttachmentsMenu] = useState(false);
  const [isNewDiscussionModalOpen, setIsNewDiscussionModalOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [newChatFilter, setNewChatFilter] = useState<'all' | 'sellers' | 'clients'>('all');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [copiedOrderNumber, setCopiedOrderNumber] = useState<string | null>(null);

  // Audio recording & playback state (audioService)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveVoiceLevels, setLiveVoiceLevels] = useState<number[]>([15, 25, 30, 20, 35, 25, 40, 20, 30, 15]);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioSpeed, setAudioSpeed] = useState<number>(1);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recordingTimerRef = useRef<any>(null);

  // Active conversation object
  const activeConversation = conversations.find((c) => c.id === activeChatId) || null;
  const activeMessages = activeChatId ? (messages[activeChatId] || []) : [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeChatId) {
      scrollToBottom();
    }
  }, [activeChatId, activeMessages.length]);

  const handleSelectConversation = (conv: AdminConversation) => {
    setActiveChatId(conv.id);
    setActiveConversationId(conv.id);
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
    );
  };

  const handleBackToList = () => {
    setActiveChatId(null);
    setActiveConversationId(null);
  };

  const handleCopyOrderNumber = (e: React.MouseEvent, num: string) => {
    e.stopPropagation();
    navigator.clipboard?.writeText?.(num);
    setCopiedOrderNumber(num);
    showToast(`Numéro #${num} copié ! 📋`);
    setTimeout(() => setCopiedOrderNumber(null), 2000);
  };

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (filterTab === 'unread' && (!c.unreadCount || c.unreadCount <= 0)) return false;
      if (filterTab === 'sellers' && c.participantType !== 'seller') return false;
      if (filterTab === 'clients' && c.participantType !== 'client') return false;
      if (filterTab === 'disputes' && c.participantType !== 'dispute') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match = 
          c.participantName.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.participantRoleSubtitle.toLowerCase().includes(q) ||
          (c.relatedOrderId && c.relatedOrderId.toLowerCase().includes(q)) ||
          c.lastMessage.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [conversations, filterTab, searchQuery]);

  // Counts for tabs
  const counts = useMemo(() => {
    return {
      all: conversations.length,
      unread: conversations.filter((c) => c.unreadCount > 0).length,
      sellers: conversations.filter((c) => c.participantType === 'seller').length,
      clients: conversations.filter((c) => c.participantType === 'client').length,
      disputes: conversations.filter((c) => c.participantType === 'dispute').length,
    };
  }, [conversations]);

  // Send message
  const handleSendMessage = (
    textToSend?: string,
    messageType: AdminChatMessage['type'] = 'text',
    metaObj?: AdminChatMessage['meta']
  ) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text && messageType === 'text') return;
    if (!activeChatId) return;

    const now = new Date();
    const timeFormatted = `${now.getHours()}:${now.getMinutes() < 10 ? '0' : ''}${now.getMinutes()}`;

    const newMsg: AdminChatMessage = {
      id: `amsg-${Date.now()}`,
      conversationId: activeChatId,
      senderId: 'admin-central',
      senderType: 'admin',
      content: text,
      type: messageType,
      timestamp: timeFormatted,
      status: 'delivered',
      meta: metaObj,
    };

    setMessages((prev) => ({
      ...prev,
      [activeChatId]: [...(prev[activeChatId] || []), newMsg],
    }));

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeChatId
          ? {
              ...c,
              lastMessage: text,
              lastMessageTime: timeFormatted,
            }
          : c
      )
    );

    if (textToSend === undefined) {
      setInputText('');
    }
  };

  // Audio voice note recording & playback state (audioService)
  const handleStartVoiceRecording = async () => {
    setIsRecordingVoice(true);
    setRecordingSeconds(0);

    const started = await audioService.startRecording();
    if (started.success) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
        setLiveVoiceLevels([
          Math.floor(Math.random() * 40) + 10,
          Math.floor(Math.random() * 50) + 15,
          Math.floor(Math.random() * 60) + 20,
          Math.floor(Math.random() * 45) + 15,
          Math.floor(Math.random() * 70) + 25,
          Math.floor(Math.random() * 55) + 20,
          Math.floor(Math.random() * 65) + 25,
          Math.floor(Math.random() * 40) + 15,
          Math.floor(Math.random() * 50) + 10,
          Math.floor(Math.random() * 30) + 10,
        ]);
      }, 300);
      showToast('Enregistrement note vocale admin en cours... 🎙️');
    } else {
      showToast('Microphone inaccessible sur ce navigateur');
      setIsRecordingVoice(false);
    }
  };

  const handleCancelVoiceRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    audioService.cancelRecording();
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
  };

  const handleSendVoiceNote = async () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    const audioRes = await audioService.stopRecording(recordingSeconds);
    setIsRecordingVoice(false);

    const durationStr = audioRes?.durationFormatted || `0:${recordingSeconds < 10 ? '0' : ''}${recordingSeconds || 4}`;

    handleSendMessage('Note vocale Direction Djassa 🎙️', 'audio', {
      audioUrl: audioRes?.audioUrl,
      audioDuration: durationStr,
    });

    setRecordingSeconds(0);
    showToast(`Note vocale (${durationStr}) transmise avec succès 🎙️`);
  };

  const handleTogglePlayAudio = (msg: AdminChatMessage) => {
    if (playingAudioId === msg.id) {
      audioService.stopPlayback();
      setPlayingAudioId(null);
    } else {
      setPlayingAudioId(msg.id);
      audioService.playAudio(
        msg.id,
        msg.meta?.audioUrl,
        msg.content || 'Note vocale officielle Djassa',
        audioSpeed,
        undefined,
        () => {
          setPlayingAudioId(null);
        }
      );
    }
  };

  // Quick reply presets
  const quickReplies = useMemo(() => {
    if (!activeConversation) return [];
    if (activeConversation.participantType === 'dispute') {
      return [
        'Dossier pris en charge par la Direction Djassa.',
        'Séquestre financier activé : vérification sous 30 min.',
        'Remboursement Wave validé pour le client.'
      ];
    }
    if (activeConversation.participantType === 'seller') {
      return [
        'Documents KYC examinés et certifiés.',
        'Reversement Wave / Orange Money en cours.',
        'Votre boutique est mise en avant sur le flux.'
      ];
    }
    return ['Bien reçu !', 'La régulation Djassa examine la demande.', 'Merci pour votre confiance !'];
  }, [activeConversation]);

  // Start new conversation modal
  const handleStartNewConversationWith = (target: {
    id: string;
    type: 'seller' | 'client';
    name: string;
    avatar: string;
    phone: string;
    subtitle: string;
    order?: Order;
  }) => {
    const existing = conversations.find(
      (c) => c.participantId === target.id || (c.phone === target.phone && c.participantType === target.type)
    );

    if (existing) {
      handleSelectConversation(existing);
      setIsNewDiscussionModalOpen(false);
      return;
    }

    const newConv: AdminConversation = {
      id: `aconv-${target.type}-${target.id}`,
      participantId: target.id,
      participantType: target.type,
      participantRole: target.type === 'seller' ? 'Boutique Marchand' : 'Client Acheteur',
      participantName: target.name,
      participantAvatar: target.avatar,
      participantVerified: true,
      participantRoleSubtitle: target.subtitle,
      phone: target.phone,
      lastMessage: 'Discussion ouverte par la Direction Générale Djassa.',
      lastMessageTime: 'À l’instant',
      unreadCount: 0,
      isOnline: true,
      order: target.order,
      relatedOrderId: target.order?.orderNumber
    };

    setConversations((prev) => [newConv, ...prev]);
    setMessages((prev) => ({
      ...prev,
      [newConv.id]: [
        {
          id: `amsg-${Date.now()}`,
          conversationId: newConv.id,
          senderId: 'admin-central',
          senderType: 'admin',
          content: `Bonjour ${target.name}, vous êtes en contact direct avec la Direction de la Plateforme Djassa Abidjan.`,
          type: 'text',
          timestamp: 'À l’instant',
          status: 'delivered'
        }
      ]
    }));

    handleSelectConversation(newConv);
    setIsNewDiscussionModalOpen(false);
    showToast(`Discussion démarrée avec ${target.name} ✨`);
  };

  return (
    <div id="admin-discussions-tab-hub" className="w-full h-full flex flex-col bg-[#0A0A0A] text-white relative isolate select-none">
      {/* 0. IN-APP VOIP CALL OVERLAY */}
      {activeCall && <VoipCallModal />}

      {/* 1. MAIN SPLIT VIEW (Inspired by Delivery Company WhatsApp dark style) */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* LEFT COLUMN: CONVERSATION LIST */}
        <div
          className={`h-full w-full md:w-80 lg:w-96 shrink-0 flex-col border-r border-white/10 bg-[#0E0E0E] ${
            activeChatId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Header WhatsApp Dark Style with Platform Admin Brand */}
          <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-black/60 backdrop-blur-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/25 border border-purple-400/30 shrink-0">
                <ShieldCheck className="w-5 h-5 filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-xs font-black text-white truncate">Messagerie Centrale</h2>
                </div>
                <p className="text-[10px] text-white/60 truncate max-w-[150px] sm:max-w-[200px]">
                  Régulation & Arbitrage Abidjan
                </p>
              </div>
            </div>
          </div>

          {/* Search bar - WhatsApp Dark Style */}
          <div className="p-2.5 border-b border-white/[0.06] bg-[#0E0E0E]">
            <div className="relative">
              <Search className="w-4 h-4 text-[#8696A0] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="input-search-conversations-admin"
                type="text"
                placeholder="Rechercher marchand, client, litige #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#202C33] text-xs text-white placeholder-[#8696A0] focus:outline-none focus:ring-1 focus:ring-purple-400/50 border border-transparent transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Chips - WhatsApp Clean Pills */}
          <div className="px-3 py-2 border-b border-white/[0.06] flex gap-2 overflow-x-auto no-scrollbar bg-[#0E0E0E]">
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1 rounded-full text-xs shrink-0 transition-all select-none ${
                filterTab === 'all'
                  ? 'bg-purple-950/60 text-purple-300 border border-purple-500/40 font-semibold shadow-sm'
                  : 'bg-[#202C33] text-[#8696A0] hover:text-white hover:bg-[#2A3942] border border-transparent font-medium'
              }`}
            >
              Toutes ({counts.all})
            </button>

            {counts.unread > 0 && (
              <button
                type="button"
                onClick={() => setFilterTab('unread')}
                className={`px-3 py-1 rounded-full text-xs shrink-0 transition-all select-none flex items-center gap-1.5 ${
                  filterTab === 'unread'
                    ? 'bg-purple-950/60 text-purple-300 border border-purple-500/40 font-semibold shadow-sm'
                    : 'bg-[#202C33] text-[#8696A0] hover:text-white hover:bg-[#2A3942] border border-transparent font-medium'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                <span>Non lues ({counts.unread})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setFilterTab('sellers')}
              className={`px-3 py-1 rounded-full text-xs shrink-0 transition-all select-none flex items-center gap-1.5 ${
                filterTab === 'sellers'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold shadow-sm'
                  : 'bg-[#202C33] text-[#8696A0] hover:text-white hover:bg-[#2A3942] border border-transparent font-medium'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Marchands ({counts.sellers})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterTab('clients')}
              className={`px-3 py-1 rounded-full text-xs shrink-0 transition-all select-none flex items-center gap-1.5 ${
                filterTab === 'clients'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold shadow-sm'
                  : 'bg-[#202C33] text-[#8696A0] hover:text-white hover:bg-[#2A3942] border border-transparent font-medium'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Clients ({counts.clients})</span>
            </button>
          </div>

          {/* Conversation list stream */}
          <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-white/[0.04]">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-white/40 space-y-2">
                <MessageSquare className="w-8 h-8 mx-auto text-white/20" />
                <p className="text-xs">Aucune discussion trouvée</p>
                <p className="text-[10px] text-white/30">Modifiez vos filtres ou lancez un nouveau message</p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === activeChatId;
                const hasUnread = conv.unreadCount > 0;

                const roleColorClass = 
                  conv.participantType === 'dispute' ? 'text-rose-400 bg-rose-500/15 border-rose-500/30' :
                  conv.participantType === 'seller' ? 'text-amber-400 bg-amber-500/15 border-amber-500/30' :
                  'text-emerald-400 bg-emerald-500/15 border-emerald-500/30';

                return (
                  <div
                    key={conv.id}
                    id={`admin-conv-item-${conv.id}`}
                    onClick={() => handleSelectConversation(conv)}
                    className={`p-3 cursor-pointer transition flex items-center gap-3 select-none relative group ${
                      isSelected
                        ? 'bg-[#2A3942]/60 border-l-4 border-purple-500'
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    {/* Avatar with status indicator */}
                    <div className="relative shrink-0">
                      <img
                        src={conv.participantAvatar}
                        alt={conv.participantName}
                        className="w-12 h-12 rounded-full object-cover border border-white/10"
                      />
                      {conv.isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#25D366] border-2 border-[#0E0E0E]" />
                      )}
                    </div>

                    {/* Metadata & Preview */}
                    <div className="flex-1 min-w-0 space-y-1">
                      {/* Line 1: Name + Role + Timestamp */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h4 className="text-[13px] font-bold text-white truncate">
                            {conv.participantName}
                          </h4>
                          {conv.participantVerified && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                          )}
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${roleColorClass}`}>
                            {conv.participantRole}
                          </span>
                        </div>

                        <span
                          className={`text-[11px] shrink-0 transition-colors ${
                            hasUnread ? 'text-purple-400 font-bold' : 'text-white/45 font-normal'
                          }`}
                        >
                          {conv.lastMessageTime}
                        </span>
                      </div>

                      {/* Line 2: Message preview + Unread badge */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          {!hasUnread && (
                            <CheckCheck className="w-4 h-4 text-[#53bdeb] shrink-0" />
                          )}
                          <p
                            className={`text-[12px] truncate leading-snug ${
                              hasUnread ? 'text-white font-medium' : 'text-white/60 font-normal'
                            }`}
                          >
                            {conv.lastMessage}
                          </p>
                        </div>

                        {/* Direct Call Button and Unread Count */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              startCall(conv.phone, conv.participantType as any, {
                                name: conv.participantName,
                                role: conv.participantRoleSubtitle,
                                phone: conv.phone,
                                orderNumber: conv.relatedOrderId,
                                avatar: conv.participantAvatar
                              });
                            }}
                            className="p-1 rounded-full text-white/40 hover:text-purple-400 hover:bg-purple-500/10 transition"
                            title={`Appeler ${conv.participantName}`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </button>

                          {hasUnread && (
                            <span className="min-w-[18px] h-4 px-1 rounded-full bg-purple-500 text-white font-black text-[10px] flex items-center justify-center shrink-0 shadow-sm animate-in zoom-in-75 duration-150">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE CHAT OR WELCOME SCREEN */}
        <div
          className={`flex-1 h-full min-w-0 flex-col bg-[#0A0A0A] ${
            !activeChatId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {activeConversation ? (
            /* ACTIVE CHAT INTERFACE */
            <div className="w-full h-full flex flex-col overflow-hidden">
              {/* Top Header */}
              <div className="shrink-0 h-16 px-4 border-b border-white/10 bg-[#0E0E0E]/95 backdrop-blur-md flex items-center justify-between z-10">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Back button on mobile */}
                  <button
                    type="button"
                    onClick={handleBackToList}
                    className="md:hidden p-1.5 -ml-1 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  {/* Avatar with online status */}
                  <div className="relative shrink-0">
                    <img
                      src={activeConversation.participantAvatar}
                      alt={activeConversation.participantName}
                      className="w-10 h-10 rounded-full object-cover border border-white/10"
                    />
                    {activeConversation.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#25D366] border-2 border-[#0E0E0E]" />
                    )}
                  </div>

                  {/* Name and subtitle */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold text-white truncate">
                        {activeConversation.participantName}
                      </h3>
                      {activeConversation.participantVerified && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-white/60 truncate max-w-[200px] sm:max-w-xs">
                        {activeConversation.participantRoleSubtitle}
                      </span>
                      <span className="text-white/30">•</span>
                      <span className="text-purple-400 font-bold">
                        {activeConversation.isOnline ? 'En ligne' : 'Actif'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Call & Fast Actions */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      startCall(activeConversation.phone, activeConversation.participantType as any, {
                        name: activeConversation.participantName,
                        role: activeConversation.participantRoleSubtitle,
                        phone: activeConversation.phone,
                        orderNumber: activeConversation.relatedOrderId,
                        avatar: activeConversation.participantAvatar
                      })
                    }
                    className="px-3.5 py-1.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-lg shadow-emerald-500/20 select-none"
                    title={`Appeler ${activeConversation.participantName}`}
                  >
                    <Phone className="w-3.5 h-3.5 fill-emerald-400" />
                    <span className="hidden sm:inline">Appel Direct</span>
                  </button>
                </div>
              </div>

              {/* Messages Thread Container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar bg-[#0B141A]/50">
                {/* Messages Bubbles Stream */}
                {activeMessages.map((msg) => {
                  const isAdmin = msg.senderType === 'admin';

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-md rounded-2xl p-3 shadow-md relative space-y-1.5 ${
                          isAdmin
                            ? 'bg-gradient-to-r from-purple-900/90 to-indigo-900/90 text-white rounded-br-xs border border-purple-500/30'
                            : 'bg-[#202C33] text-white rounded-bl-xs border border-white/5'
                        }`}
                      >
                        {/* Sender Label for clarity */}
                        <div className="flex items-center justify-between gap-2 text-[10px]">
                          <span className={`font-bold ${isAdmin ? 'text-purple-300' : 'text-cyan-300'}`}>
                            {isAdmin ? 'Direction Générale Djassa' : activeConversation.participantName}
                          </span>
                          <span className="text-white/40">{msg.timestamp}</span>
                        </div>

                        {/* Text Message */}
                        {msg.type === 'text' && (
                          <p className="text-xs sm:text-[13px] leading-relaxed break-words whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        )}

                        {/* Order Card Message */}
                        {msg.type === 'order_card' && (
                          <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white">Commande #{msg.meta?.orderNumber || '09412'}</span>
                              <span className="text-[10px] text-[#FF6321] font-bold">
                                {formatFCFA(msg.meta?.deliveryFee || 2500)}
                              </span>
                            </div>
                            <p className="text-[10px] text-white/60">{msg.meta?.productTitle || 'Colis vérifié'}</p>
                            <p className="text-[10px] text-emerald-400 font-medium">📍 {msg.meta?.destination || 'Abidjan'}</p>
                          </div>
                        )}

                        {/* Voice Note Player */}
                        {msg.type === 'audio' && (
                          <div className="flex items-center gap-2.5 py-1">
                            <button
                              type="button"
                              onClick={() => handleTogglePlayAudio(msg)}
                              className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center shrink-0 shadow-md hover:scale-105 active:scale-95 transition"
                            >
                              {playingAudioId === msg.id ? (
                                <Pause className="w-4 h-4 fill-current" />
                              ) : (
                                <Play className="w-4 h-4 fill-current ml-0.5" />
                              )}
                            </button>
                            <div className="flex-1 space-y-1">
                              <div className="h-4 flex items-center gap-0.5">
                                {[20, 45, 60, 30, 80, 50, 90, 40, 70, 30, 60, 20, 50, 35].map((lvl, i) => (
                                  <div
                                    key={i}
                                    style={{ height: `${lvl}%` }}
                                    className={`w-1 rounded-full ${
                                      playingAudioId === msg.id ? 'bg-purple-400 animate-pulse' : 'bg-white/40'
                                    }`}
                                  />
                                ))}
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-white/50">
                                <span>{msg.meta?.audioDuration || '0:05'}</span>
                                <button
                                  type="button"
                                  onClick={() => setAudioSpeed(s => s === 1 ? 1.5 : s === 1.5 ? 2 : 1)}
                                  className="px-1 rounded bg-white/10 hover:bg-white/20 text-white text-[9px] font-bold"
                                >
                                  {audioSpeed}x
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Delivery Status Indicator */}
                        <div className="flex items-center justify-end gap-1 text-[10px] text-white/50 pt-0.5">
                          {isAdmin && (
                            <CheckCheck className={`w-3.5 h-3.5 ${msg.status === 'read' ? 'text-purple-300' : 'text-white/40'}`} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Bottom Input Area */}
              <div className="p-3 border-t border-white/10 bg-[#0E0E0E] relative">
                {/* Voice Note Recording Overlay */}
                {isRecordingVoice ? (
                  <div className="flex items-center justify-between gap-3 bg-rose-950/40 border border-rose-500/40 p-2 rounded-2xl animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                      <span className="text-xs font-mono font-bold text-rose-300">
                        {Math.floor(recordingSeconds / 60)}:
                        {recordingSeconds % 60 < 10 ? '0' : ''}
                        {recordingSeconds % 60}
                      </span>
                    </div>

                    <div className="flex-1 flex items-center justify-center gap-1 h-6">
                      {liveVoiceLevels.map((lvl, idx) => (
                        <div
                          key={idx}
                          style={{ height: `${lvl}%` }}
                          className="w-1 bg-rose-400 rounded-full transition-all duration-100"
                        />
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCancelVoiceRecording}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition"
                        title="Annuler"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={handleSendVoiceNote}
                        className="p-2 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/40 transition active:scale-95"
                        title="Envoyer le vocal"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {/* Attachments button */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowAttachmentsMenu(!showAttachmentsMenu)}
                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition active:scale-95"
                        title="Pièces jointes"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>

                      {showAttachmentsMenu && (
                        <div className="absolute bottom-12 left-0 w-48 rounded-2xl bg-[#1C2833] border border-white/15 p-2 shadow-2xl space-y-1 z-30 animate-in zoom-in-95 duration-150">
                          <button
                            type="button"
                            onClick={() => {
                              setShowAttachmentsMenu(false);
                              handleSendMessage('Rapport officiel transmis', 'text');
                              showToast('Rapport officiel transmis dans la discussion');
                            }}
                            className="w-full px-3 py-2 rounded-xl text-left text-xs font-medium text-white hover:bg-white/10 flex items-center gap-2 transition"
                          >
                            <ShieldCheck className="w-4 h-4 text-purple-400" />
                            <span>Rapport Régulation</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAttachmentsMenu(false);
                              handleSendMessage('Point GPS Direction Générale Plateau', 'location');
                              showToast('Coordonnées Siège Plateau transmises');
                            }}
                            className="w-full px-3 py-2 rounded-xl text-left text-xs font-medium text-white hover:bg-white/10 flex items-center gap-2 transition"
                          >
                            <MapPin className="w-4 h-4 text-emerald-400" />
                            <span>Siège Plateau Djassa</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Text input */}
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Tapez votre message officiel..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#202C33] text-xs text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-purple-400/50 border border-transparent transition"
                      />
                    </div>

                    {/* Mic or Send button */}
                    {inputText.trim() ? (
                      <button
                        type="button"
                        onClick={() => handleSendMessage()}
                        className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/30 transition active:scale-95"
                        title="Envoyer"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartVoiceRecording}
                        className="p-2.5 rounded-xl bg-white/5 hover:bg-purple-600/20 text-white/70 hover:text-purple-300 border border-white/10 transition active:scale-95"
                        title="Enregistrer une note vocale"
                      >
                        <Mic className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* WELCOME / EMPTY STATE SCREEN */
            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-purple-500/20 via-indigo-500/10 to-transparent border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-2xl">
                <ShieldCheck className="w-10 h-10" />
              </div>
              <div className="max-w-md space-y-2">
                <h3 className="text-base font-black text-white">Centrale de Messagerie Admin</h3>
                <p className="text-xs text-white/50 leading-relaxed">
                  Supervisez en direct les échanges avec les marchands certifiés, les acheteurs clients et les dossiers de litiges en cours à Abidjan.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewDiscussionModalOpen(true)}
                  className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white text-xs font-black shadow-lg shadow-purple-600/25 flex items-center gap-2 transition active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nouvelle Discussion</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. MODAL NOUVELLE DISCUSSION */}
      {isNewDiscussionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#141414] border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Nouvelle Discussion Officielle</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewDiscussionModalOpen(false)}
                className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Chips */}
            <div className="p-3 border-b border-white/5 flex gap-2 overflow-x-auto no-scrollbar">
              {(['all', 'sellers', 'clients'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setNewChatFilter(tab)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                    newChatFilter === tab
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {tab === 'all' && 'Tous les profils'}
                  {tab === 'sellers' && 'Marchands'}
                  {tab === 'clients' && 'Clients'}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-white/5">
              <div className="relative">
                <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher nom, boutique ou téléphone..."
                  value={newChatSearch}
                  onChange={(e) => setNewChatSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 text-xs text-white placeholder-white/40 border border-white/10 focus:outline-none focus:ring-1 focus:ring-purple-400 transition"
                />
              </div>
            </div>

            {/* Profiles List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
              {/* Marchands */}
              {(newChatFilter === 'all' || newChatFilter === 'sellers') &&
                sellers
                  .filter((s) => s.name.toLowerCase().includes(newChatSearch.toLowerCase()))
                  .map((seller) => (
                    <div
                      key={`seller-${seller.id}`}
                      onClick={() =>
                        handleStartNewConversationWith({
                          id: seller.id,
                          type: 'seller',
                          name: seller.name,
                          avatar: seller.avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
                          phone: seller.phone || '+225 07 00 11 22 33',
                          subtitle: `Boutique vérifiée • ${seller.location || 'Adjamé'}`
                        })
                      }
                      className="p-3 rounded-2xl bg-white/5 hover:bg-purple-600/15 border border-white/5 hover:border-purple-500/30 flex items-center justify-between cursor-pointer transition group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={seller.avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200'}
                          alt={seller.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate group-hover:text-purple-300">
                            {seller.name}
                          </p>
                          <p className="text-[10px] text-white/50 truncate">
                            Boutique • {seller.location || 'Abidjan'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-purple-400 group-hover:translate-x-0.5 transition" />
                    </div>
                  ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
