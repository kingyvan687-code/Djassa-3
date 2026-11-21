import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  Store, 
  User, 
  ShieldCheck, 
  Phone, 
  Send, 
  Paperclip, 
  Mic, 
  MicOff, 
  Image as ImageIcon, 
  Package, 
  Check, 
  CheckCheck, 
  ArrowLeft, 
  Sparkles, 
  PhoneCall, 
  Plus, 
  X, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  Play, 
  Pause, 
  Volume2, 
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  Headphones
} from 'lucide-react';
import { Seller, Product, Order, Conversation, Message } from '../../../types';
import { useApp } from '../../../context/AppContext';
import { formatFCFA } from '../../../services/marketServices';
import { audioService } from '../../../services/audioService';
import { SELLER_INITIAL_CONVERSATIONS, SELLER_INITIAL_MESSAGES } from './sellerDiscussionsData';
import { SellerProductShareModal } from './SellerProductShareModal';
import { SellerNewDiscussionModal } from './SellerNewDiscussionModal';
import { VoipCallModal } from '../../chat/VoipCallModal';

interface Props {
  seller: Seller;
  products: Product[];
  orders: Order[];
}

export type SellerFilterType = 'all' | 'clients' | 'support' | 'unread';

export const SellerDiscussionsScreen: React.FC<Props> = ({
  seller,
  products,
  orders,
}) => {
  const { 
    showToast, 
    startCall, 
    receiveIncomingCall, 
    activeCall,
    setActiveConversationId 
  } = useApp();

  // Load conversations and messages from local storage or fallback to initial seller data
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = localStorage.getItem('djassa_seller_conversations');
      return saved ? JSON.parse(saved) : SELLER_INITIAL_CONVERSATIONS;
    } catch {
      return SELLER_INITIAL_CONVERSATIONS;
    }
  });

  const [messages, setMessages] = useState<Record<string, Message[]>>(() => {
    try {
      const saved = localStorage.getItem('djassa_seller_messages');
      return saved ? JSON.parse(saved) : SELLER_INITIAL_MESSAGES;
    } catch {
      return SELLER_INITIAL_MESSAGES;
    }
  });

  // Save to localStorage whenever state updates
  useEffect(() => {
    try {
      localStorage.setItem('djassa_seller_conversations', JSON.stringify(conversations));
    } catch (e) {
      console.error(e);
    }
  }, [conversations]);

  useEffect(() => {
    try {
      localStorage.setItem('djassa_seller_messages', JSON.stringify(messages));
    } catch (e) {
      console.error(e);
    }
  }, [messages]);

  // Active chat state
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<SellerFilterType>('all');
  const [inputText, setInputText] = useState('');
  const [showAttachmentsMenu, setShowAttachmentsMenu] = useState(false);
  const [isProductShareModalOpen, setIsProductShareModalOpen] = useState(false);
  const [isNewDiscussionModalOpen, setIsNewDiscussionModalOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Audio recording & playback state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveVoiceLevels, setLiveVoiceLevels] = useState<number[]>([15, 25, 30, 20, 35, 25, 40, 20, 30, 15]);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [playbackTime, setPlaybackTime] = useState<Record<string, number>>({});
  const [audioSpeed, setAudioSpeed] = useState<number>(1);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recordingTimerRef = useRef<any>(null);

  // Active conversation object
  const activeConversation = conversations.find((c) => c.id === activeChatId) || null;
  const activeMessages = activeChatId ? (messages[activeChatId] || []) : [];

  // Scroll to bottom smoothly
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeChatId) {
      scrollToBottom();
    }
  }, [activeChatId, activeMessages.length]);

  // Sync activeConversationId with AppContext so SellerApp bottom navigation hides on mobile!
  const handleSelectConversation = (conv: Conversation) => {
    setActiveChatId(conv.id);
    setActiveConversationId(conv.id);
    // Mark as read
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
    );
  };

  const handleBackToList = () => {
    setActiveChatId(null);
    setActiveConversationId(null);
  };

  // Open official Djassa Seller Support Chat
  const handleOpenSupport = () => {
    const existing = conversations.find(
      (c) =>
        c.id === 'sconv-support-1' ||
        c.participantId === 'support-djassa' ||
        c.participantName.toLowerCase().includes('support')
    );
    if (existing) {
      handleSelectConversation(existing);
      showToast('Support Marchands Djassa ouvert 🎧');
    } else {
      const supportConv: Conversation = {
        id: 'sconv-support-1',
        participantId: 'support-djassa',
        participantType: 'seller',
        participantRole: 'seller',
        participantName: 'Support Marchands Djassa',
        participantAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200',
        participantVerified: true,
        participantRoleSubtitle: 'Pôle Partenaires & Versements Séquestre',
        lastMessage: 'Bonjour ! Comment pouvons-nous vous assister sur votre boutique ?',
        lastMessageTime: 'À l’instant',
        unreadCount: 0,
        isOnline: true,
        online: true,
      };
      setConversations((prev) => [supportConv, ...prev]);
      handleSelectConversation(supportConv);
      showToast('Support Marchands Djassa ouvert 🎧');
    }
  };

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (c.participantType !== 'client' && c.participantType !== 'seller') return false;
      if (filterTab === 'clients' && c.participantType !== 'client') return false;
      if (filterTab === 'support' && c.participantType !== 'seller') return false;
      if (filterTab === 'unread' && (!c.unreadCount || c.unreadCount <= 0)) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.participantName.toLowerCase().includes(q);
        const matchesSubtitle = c.participantRoleSubtitle.toLowerCase().includes(q);
        const matchesMsg = c.lastMessage.toLowerCase().includes(q);
        const matchesOrder = c.relatedOrderId?.toLowerCase().includes(q);
        return matchesName || matchesSubtitle || matchesMsg || matchesOrder;
      }
      return true;
    });
  }, [conversations, filterTab, searchQuery]);

  // Counts
  const clientsCount = conversations.filter((c) => c.participantType === 'client').length;
  const unreadTotal = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  // Send message as the SELLER
  const handleSendMessage = (
    content: string,
    type: 'text' | 'image' | 'video' | 'audio' | 'product_card' | 'order_card' = 'text',
    meta?: any
  ) => {
    if (!activeChatId || !content.trim()) return;

    const newMsg: Message = {
      id: `smsg-${Date.now()}`,
      conversationId: activeChatId,
      senderId: seller.id || 'seller-current',
      senderType: 'seller', // THE SENDER IS THE SELLER!
      content,
      type,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'delivered',
      meta,
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
              lastMessage: type === 'audio' ? `🎤 Note vocale (${meta?.audioDuration || '0:10'})` : content,
              lastMessageTime: 'À l’instant',
              unreadCount: 0,
            }
          : c
      )
    );

    setInputText('');
    setShowAttachmentsMenu(false);

    // Realistic auto-reply from client, driver, or delivery company
    const conv = activeConversation;
    if (conv) {
      setTimeout(() => {
        let replyContent = 'Bien reçu, merci !';
        if (conv.participantType === 'client') {
          const clientReplies = [
            'Merci beaucoup pour votre réactivité ! Je prépare la réception de ma commande.',
            'Super, c’est parfait ! J’ai hâte de recevoir ma commande.',
            'Très bien noté ! Merci pour vos précieux conseils sur la taille.',
            'Merci pour la confirmation, je reste disponible au téléphone pour la livraison.',
          ];
          replyContent = clientReplies[Math.floor(Math.random() * clientReplies.length)];
        } else {
          replyContent = 'Merci pour votre message. Le pôle support partenaires Djassa reste à vos côtés.';
        }

        const autoMsg: Message = {
          id: `smsg-reply-${Date.now()}`,
          conversationId: conv.id,
          senderId: conv.participantId,
          senderType: conv.participantType,
          content: replyContent,
          type: 'text',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'read',
        };

        setMessages((prev) => ({
          ...prev,
          [conv.id]: [...(prev[conv.id] || []), autoMsg],
        }));

        setConversations((prev) =>
          prev.map((c) =>
            c.id === conv.id
              ? {
                  ...c,
                  lastMessage: replyContent,
                  lastMessageTime: 'À l’instant',
                }
              : c
          )
        );
      }, 2000);
    }
  };

  // Real microphone audio recording
  const handleStartVoiceRecording = async () => {
    setIsRecordingVoice(true);
    setRecordingSeconds(0);
    setLiveVoiceLevels([20, 30, 25, 35, 20, 40, 25, 30, 20, 25]);

    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);

    const res = await audioService.startRecording(
      (level, freqData) => {
        if (freqData && freqData.length > 0) {
          setLiveVoiceLevels(freqData.slice(0, 12));
        } else {
          setLiveVoiceLevels([
            Math.max(15, Math.min(100, level * 0.8)),
            Math.max(20, Math.min(100, level * 1.2)),
            Math.max(15, Math.min(100, level * 0.9)),
            Math.max(25, Math.min(100, level * 1.4)),
            Math.max(15, Math.min(100, level * 0.7)),
            Math.max(30, Math.min(100, level * 1.5)),
            Math.max(20, Math.min(100, level * 1.1)),
            Math.max(15, Math.min(100, level * 0.6)),
          ]);
        }
      },
      () => {}
    );

    if (res.isSimulated && res.error) {
      showToast('Microphone : mode interactif actif 🎙️');
    }
  };

  const handleCancelVoiceRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    audioService.cancelRecording();
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
    showToast('Enregistrement vocal annulé ✕');
  };

  const handleSendVoiceNote = async () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    const durationSec = recordingSeconds || 1;
    const res = await audioService.stopRecording(durationSec);

    setIsRecordingVoice(false);
    setRecordingSeconds(0);

    const durationStr = res?.durationFormatted || `0:${durationSec < 10 ? '0' : ''}${durationSec}`;
    const audioUrl = res?.audioUrl || undefined;

    handleSendMessage(`🎤 Note vocale (${durationStr})`, 'audio', {
      audioUrl,
      audioDuration: durationStr,
      audioSeconds: durationSec,
      transcription: 'Note vocale envoyée par la Boutique Vendeur.',
    });
    showToast('Note vocale envoyée 🎙️');
  };

  // Play audio note
  const handleTogglePlayAudio = (msg: Message) => {
    if (playingAudioId === msg.id) {
      audioService.stopPlayback();
      setPlayingAudioId(null);
      return;
    }

    let speechFallback = 'Bonjour ! Votre message a bien été pris en compte.';
    if (msg.senderType === 'seller') {
      speechFallback = 'Bonjour ! Tout est disponible et prêt dans notre boutique.';
    } else if (msg.senderType === 'client') {
      speechFallback = 'Bonjour, merci beaucoup pour votre disponibilité.';
    }

    setPlayingAudioId(msg.id);

    audioService.playAudio(
      msg.id,
      msg.meta?.audioUrl,
      speechFallback,
      audioSpeed,
      (curr) => {
        setPlaybackTime((prev) => ({ ...prev, [msg.id]: curr }));
      },
      () => {
        setPlayingAudioId(null);
        setPlaybackTime((prev) => ({ ...prev, [msg.id]: 0 }));
      }
    );
  };

  // Send photo
  const handleSendSamplePhoto = (sampleUrl?: string) => {
    const url =
      sampleUrl ||
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600';
    handleSendMessage('📷 Photo du colis / article', 'image', {
      productImage: url,
    });
    showToast('Photo envoyée dans le chat 📸');
  };

  // Send product card
  const handleSendProduct = (p: Product) => {
    const imgUrl = (p as any).media?.[0]?.url || p.images?.[0] || 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600';
    handleSendMessage(`Article recommandé : ${p.name}`, 'product_card', {
      productId: p.id,
      productTitle: p.name,
      productPrice: p.price,
      productImage: imgUrl,
    });
    showToast('Fiche article partagée avec succès ✨');
  };

  // Contextual quick reply pills
  const quickReplies = useMemo(() => {
    if (!activeConversation) return [];
    if (activeConversation.participantType === 'client') {
      return [
        '✅ Oui, disponible en boutique !',
        '📦 Commande confirmée par la boutique',
        '🚚 Livraison en cours d’organisation par la boutique',
        '🎁 Emballage soigné offert',
        '📐 Guide des tailles envoyé',
      ];
    }
    return [
      '💳 Question sur un reversement Wave / Orange Money',
      '🛡️ Question garantie boutique',
      '⭐ Assistance compte Vendeur',
    ];
  }, [activeConversation]);

  // Order linked to current chat (if any)
  const linkedOrder = useMemo(() => {
    if (!activeConversation?.relatedOrderId) return null;
    return orders.find(
      (o) =>
        o.id === activeConversation.relatedOrderId ||
        o.id.includes(activeConversation.relatedOrderId!) ||
        activeConversation.relatedOrderId!.includes(o.id)
    ) || {
      id: activeConversation.relatedOrderId,
      total: 24500,
      status: 'pending',
      items: [
        {
          productId: 'prod-6',
          productName: 'Combinaison Pantalon Wax Ankara Chic',
          quantity: 1,
          price: 24500,
        },
      ],
      customer: {
        name: activeConversation.participantName,
        phone: '+225 07 48 92 11 04',
        address: 'Cocody Riviera 3, Abidjan',
      },
    };
  }, [activeConversation, orders]);

  return (
    <div
      id="seller-discussions-screen-root"
      className="relative w-full h-full flex flex-col bg-[#0A0A0A] overflow-hidden select-none"
    >
      {/* 1. TOP MINIMIZED CALL BAR */}
      {activeCall?.isMinimized && <VoipCallModal />}

      {/* 2. MAIN SPLIT VIEW */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* LEFT COLUMN: CONVERSATION LIST */}
        <div
          className={`h-full w-full md:w-80 lg:w-96 shrink-0 flex-col border-r border-white/10 bg-[#0E0E0E] ${
            activeChatId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Header */}
          <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-black/50 backdrop-blur-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF6321] to-[#FF8C53] text-white flex items-center justify-center shadow-lg shadow-[#FF6321]/35 border border-white/20 shrink-0">
                <Store className="w-5 h-5 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-xs font-black text-white truncate">Messagerie Vendeur</h2>
                  <span className="px-1.5 py-0.5 rounded-md bg-[#FF6321]/20 border border-[#FF6321]/30 text-[#FF6321] text-[9px] font-black shrink-0">
                    PRO
                  </span>
                </div>
                <p className="text-[10px] text-white/60 truncate max-w-[150px] sm:max-w-[180px]">
                  {seller.name || 'Boutique Wax Ivoire'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleOpenSupport}
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md border border-white/15 hover:border-[#FF6321]/40 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-md group select-none"
                title="Contacter le Support Marchands Djassa"
              >
                <Headphones className="w-3.5 h-3.5 text-[#FF6321] group-hover:scale-110 transition-transform filter drop-shadow-[0_1px_2px_rgba(255,99,33,0.5)]" />
                <span className="hidden sm:inline">Support</span>
              </button>
            </div>
          </div>

          {/* Search bar - WhatsApp Dark Style */}
          <div className="p-2.5 border-b border-white/[0.06] bg-[#0E0E0E]">
            <div className="relative">
              <Search className="w-4 h-4 text-[#8696A0] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher ou démarrer une discussion..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#202C33] text-xs text-white placeholder-[#8696A0] focus:outline-none focus:ring-1 focus:ring-[#25D366]/50 border border-transparent transition"
              />
            </div>
          </div>

          {/* Category Filter Chips - WhatsApp Clean Pills */}
          <div className="px-3 py-2 border-b border-white/[0.06] flex gap-2 overflow-x-auto no-scrollbar bg-[#0E0E0E]">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1 rounded-full text-xs shrink-0 transition-all select-none ${
                filterTab === 'all'
                  ? 'bg-[#103629] text-[#25D366] border border-[#25D366]/40 font-semibold shadow-sm'
                  : 'bg-[#202C33] text-[#8696A0] hover:text-white hover:bg-[#2A3942] border border-transparent font-medium'
              }`}
            >
              Toutes ({conversations.length})
            </button>

            {unreadTotal > 0 && (
              <button
                onClick={() => setFilterTab('unread')}
                className={`px-3 py-1 rounded-full text-xs shrink-0 transition-all select-none flex items-center gap-1.5 ${
                  filterTab === 'unread'
                    ? 'bg-[#103629] text-[#25D366] border border-[#25D366]/40 font-semibold shadow-sm'
                    : 'bg-[#202C33] text-[#8696A0] hover:text-white hover:bg-[#2A3942] border border-transparent font-medium'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#25D366]" />
                <span>Non lues ({unreadTotal})</span>
              </button>
            )}

            <button
              onClick={() => setFilterTab('clients')}
              className={`px-3 py-1 rounded-full text-xs shrink-0 transition-all select-none ${
                filterTab === 'clients'
                  ? 'bg-[#103629] text-[#25D366] border border-[#25D366]/40 font-semibold shadow-sm'
                  : 'bg-[#202C33] text-[#8696A0] hover:text-white hover:bg-[#2A3942] border border-transparent font-medium'
              }`}
            >
              Clients ({clientsCount})
            </button>

            <button
              onClick={() => setFilterTab('support')}
              className={`px-3 py-1 rounded-full text-xs shrink-0 transition-all select-none ${
                filterTab === 'support'
                  ? 'bg-[#103629] text-[#25D366] border border-[#25D366]/40 font-semibold shadow-sm'
                  : 'bg-[#202C33] text-[#8696A0] hover:text-white hover:bg-[#2A3942] border border-transparent font-medium'
              }`}
            >
              Support
            </button>
          </div>

          {/* Conversation List - WhatsApp Inspired Design */}
          <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-white/[0.06]">
            {filteredConversations.length === 0 ? (
              <div className="py-20 text-center text-white/40 text-xs">
                Aucune discussion dans cette catégorie
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === activeChatId;
                const isClient = conv.participantType === 'client';
                const hasUnread = conv.unreadCount > 0;

                const roleLabel = isClient ? 'Client' : 'Support';

                const roleColorClass = isClient ? 'text-emerald-400' : 'text-amber-400';

                return (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`px-3.5 sm:px-4 py-3 flex items-center gap-3.5 cursor-pointer transition-colors relative select-none ${
                      isSelected
                        ? 'bg-[#182229] border-l-4 border-[#25D366]'
                        : 'hover:bg-white/[0.04] active:bg-white/[0.08]'
                    }`}
                  >
                    {/* WhatsApp Circular Avatar with Online Beacon */}
                    <div className="relative shrink-0">
                      <img
                        src={conv.participantAvatar}
                        alt={conv.participantName}
                        className="w-12 h-12 sm:w-[50px] sm:h-[50px] rounded-full object-cover border border-white/10 shadow-sm"
                      />
                      {conv.isOnline && (
                        <span
                          className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#25D366] border-2 border-[#0E0E0E] shadow"
                          title="En ligne"
                        />
                      )}
                    </div>

                    {/* WhatsApp Two-Line Chat Content */}
                    <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
                      {/* Line 1: Name + Verified + Role + Timestamp */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h4 className="text-[14.5px] sm:text-[15px] font-semibold text-white truncate tracking-tight">
                            {conv.participantName}
                          </h4>
                          {conv.participantVerified && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                          )}
                          <span className={`text-[10px] font-medium shrink-0 opacity-80 ${roleColorClass}`}>
                            • {roleLabel}
                          </span>
                        </div>

                        {/* Timestamp: WhatsApp Green if unread, muted gray otherwise */}
                        <span
                          className={`text-[11.5px] shrink-0 transition-colors ${
                            hasUnread ? 'text-[#25D366] font-semibold' : 'text-white/45 font-normal'
                          }`}
                        >
                          {conv.lastMessageTime}
                        </span>
                      </div>

                      {/* Line 2: WhatsApp Double Check + Message Preview + Green Unread Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          {!hasUnread && (
                            <CheckCheck className="w-4 h-4 text-[#53bdeb] shrink-0" />
                          )}
                          <p
                            className={`text-[12.5px] sm:text-[13px] truncate leading-snug ${
                              hasUnread ? 'text-white font-medium' : 'text-white/60 font-normal'
                            }`}
                          >
                            {conv.lastMessage}
                          </p>
                        </div>

                        {/* Signature WhatsApp Green Pill Badge */}
                        {hasUnread && (
                          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#25D366] text-[#0B141A] font-bold text-[11px] flex items-center justify-center shrink-0 shadow-sm ml-1.5 animate-in zoom-in-75 duration-150">
                            {conv.unreadCount}
                          </span>
                        )}
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
                  <button
                    onClick={handleBackToList}
                    className="p-2 -ml-1 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md border border-white/15 text-white/80 hover:text-white md:hidden transition active:scale-90 shadow-md"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div className="relative shrink-0">
                    <img
                      src={activeConversation.participantAvatar}
                      alt={activeConversation.participantName}
                      className="w-10 h-10 rounded-full object-cover border-2 border-[#FF6321]/40 shadow-md"
                    />
                    {activeConversation.isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-black shadow-sm" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-xs font-bold text-white truncate">
                        {activeConversation.participantName}
                      </h3>
                      {activeConversation.participantVerified && (
                        <span className="w-3.5 h-3.5 rounded-full bg-[#FF6321] text-white text-[9px] font-black flex items-center justify-center drop-shadow-sm shrink-0">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span
                        className={`font-bold ${
                          activeConversation.participantType === 'client'
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {activeConversation.participantType === 'client'
                          ? 'Client Acheteur'
                          : 'Support Marchand'}
                      </span>
                      <span className="text-white/30">•</span>
                      <span className="text-white/50">
                        {activeConversation.isOnline ? 'En ligne' : 'Vu récemment'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Call & Actions - Styled with Home Page glassmorphism and rich icons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsProductShareModalOpen(true)}
                    className="px-3 py-1.5 rounded-full bg-[#FF6321]/15 hover:bg-[#FF6321]/25 border border-[#FF6321]/30 text-[#FF6321] text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-[#FF6321]/15 select-none"
                    title="Partager un article de ma boutique"
                  >
                    <Sparkles className="w-3.5 h-3.5 filter drop-shadow-[0_1px_2px_rgba(255,99,33,0.5)]" />
                    <span className="hidden sm:inline">Article</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      startCall(
                        activeConversation.participantId,
                        activeConversation.participantType
                      )
                    }
                    className="px-3.5 py-1.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-lg shadow-emerald-500/20 select-none"
                    title={`Appeler ${activeConversation.participantName}`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-3.5 h-3.5 fill-emerald-400 filter drop-shadow-[0_1px_3px_rgba(16,185,129,0.5)]"
                    >
                      <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                    </svg>
                    <span className="hidden sm:inline">Appel Direct</span>
                  </button>
                </div>
              </div>

              {/* Messages Thread Container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
                {activeMessages.map((msg) => {
                  const isMine = msg.senderType === 'seller';
                  const isAudio = msg.type === 'audio';
                  const isImage = msg.type === 'image';
                  const isProduct = msg.type === 'product_card';

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-end gap-2 max-w-[85%] md:max-w-[70%]">
                        {!isMine && (
                          <img
                            src={activeConversation.participantAvatar}
                            alt=""
                            className="w-7 h-7 rounded-lg object-cover mb-1 shrink-0 border border-white/10"
                          />
                        )}

                        <div
                          className={`rounded-2xl p-3 shadow-md relative ${
                            isMine
                              ? 'bg-gradient-to-r from-[#FF6321] to-[#E05316] text-white rounded-br-none'
                              : 'bg-white/10 border border-white/10 text-white rounded-bl-none backdrop-blur-md'
                          }`}
                        >
                          {/* Sender Label */}
                          <div className="text-[10px] opacity-75 font-bold mb-1 flex items-center justify-between gap-3">
                            <span>{isMine ? 'Vous (Vendeur)' : activeConversation.participantName}</span>
                            <span className="text-[9px] font-normal opacity-70">{msg.timestamp}</span>
                          </div>

                          {/* Text Message */}
                          {(!msg.type || msg.type === 'text') && (
                            <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          )}

                          {/* Audio Voice Note */}
                          {isAudio && (
                            <div className="space-y-1.5 min-w-[200px]">
                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleTogglePlayAudio(msg)}
                                  className={`w-8 h-8 rounded-full flex items-center justify-center transition active:scale-95 ${
                                    isMine ? 'bg-white text-[#FF6321]' : 'bg-[#FF6321] text-white'
                                  }`}
                                >
                                  {playingAudioId === msg.id ? (
                                    <Pause className="w-4 h-4 fill-current" />
                                  ) : (
                                    <Play className="w-4 h-4 fill-current ml-0.5" />
                                  )}
                                </button>

                                {/* Waveform graphic */}
                                <div className="flex items-center gap-0.5 h-6 flex-1 px-1">
                                  {[30, 60, 95, 45, 80, 100, 55, 85, 65, 90, 45, 75].map((h, i) => (
                                    <div
                                      key={i}
                                      className={`w-1 rounded-full ${
                                        isMine ? 'bg-white/80' : 'bg-[#FF6321]'
                                      }`}
                                      style={{ height: `${Math.max(8, (h / 100) * 22)}px` }}
                                    />
                                  ))}
                                </div>

                                <span className="text-[10px] font-mono opacity-80 shrink-0">
                                  {msg.meta?.audioDuration || '0:10'}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Image Message */}
                          {isImage && (
                            <div className="space-y-1.5 pt-1">
                              <img
                                src={msg.meta?.productImage || 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600'}
                                alt="Photo"
                                onClick={() => setPreviewImage(msg.meta?.productImage || 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600')}
                                className="w-full max-h-56 object-cover rounded-xl border border-white/10 cursor-pointer hover:opacity-95 transition"
                              />
                              {msg.content && msg.content !== '📷 Photo du colis / article' && (
                                <p className="text-xs pt-0.5">{msg.content}</p>
                              )}
                            </div>
                          )}

                          {/* Product Card Message */}
                          {isProduct && msg.meta && (
                            <div className="space-y-2 pt-1">
                              <div className="p-2 rounded-xl bg-black/40 border border-white/10 flex items-center gap-2.5">
                                {msg.meta.productImage && (
                                  <img
                                    src={msg.meta.productImage}
                                    alt={msg.meta.productTitle}
                                    className="w-12 h-12 rounded-lg object-cover shrink-0 border border-white/10"
                                  />
                                )}
                                <div className="min-w-0">
                                  <h5 className="text-xs font-bold text-white truncate">
                                    {msg.meta.productTitle}
                                  </h5>
                                  <p className="text-xs font-black text-amber-300">
                                    {formatFCFA(msg.meta.productPrice || 0)}
                                  </p>
                                </div>
                              </div>
                              <p className="text-xs">{msg.content}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Read tick */}
                      {isMine && (
                        <div className="flex items-center gap-1 pr-1 pt-0.5 text-[9px] text-white/40">
                          <span>Envoyé</span>
                          <CheckCheck className="w-3 h-3 text-[#FF6321]" />
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Contextual Quick Reply Pills - Frosted glass pills inspired by Home Page */}
              <div className="px-4 py-2 border-t border-white/5 bg-[#0E0E0E]/90 flex gap-2 overflow-x-auto no-scrollbar">
                {quickReplies.map((pill, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(pill, 'text')}
                    className="px-3.5 py-1.5 rounded-full bg-black/50 hover:bg-[#FF6321]/20 border border-white/10 hover:border-[#FF6321]/40 text-xs font-semibold text-white/90 hover:text-white shrink-0 transition-all backdrop-blur-md active:scale-95 shadow-sm"
                  >
                    {pill}
                  </button>
                ))}
              </div>

              {/* Input Action Bar */}
              <div className="shrink-0 p-3 border-t border-white/10 bg-[#0E0E0E] relative">
                {/* Attachments dropdown with rich colorful circular icon containers */}
                {showAttachmentsMenu && (
                  <div className="absolute bottom-16 left-4 z-30 p-2.5 rounded-3xl bg-[#141414]/95 backdrop-blur-xl border border-white/15 shadow-2xl space-y-1.5 animate-fadeIn min-w-[240px]">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAttachmentsMenu(false);
                        setIsProductShareModalOpen(true);
                      }}
                      className="w-full p-2 rounded-2xl hover:bg-white/10 text-left text-xs font-bold text-white flex items-center gap-3 transition group select-none"
                    >
                      <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#FF6321]/30 to-[#FF8C53]/15 text-[#FF6321] border border-[#FF6321]/30 flex items-center justify-center shadow-md shadow-[#FF6321]/20 group-hover:scale-105 transition-transform">
                        <Sparkles className="w-4 h-4 filter drop-shadow-[0_1px_2px_rgba(255,99,33,0.5)]" />
                      </div>
                      <div>
                        <div className="font-bold text-white">Article de boutique</div>
                        <div className="text-[10px] text-white/50">Fiche produit & prix officiel</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowAttachmentsMenu(false);
                        handleSendSamplePhoto();
                      }}
                      className="w-full p-2 rounded-2xl hover:bg-white/10 text-left text-xs font-bold text-white flex items-center gap-3 transition group select-none"
                    >
                      <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-500/30 to-emerald-400/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                        <ImageIcon className="w-4 h-4 filter drop-shadow-[0_1px_2px_rgba(16,185,129,0.5)]" />
                      </div>
                      <div>
                        <div className="font-bold text-white">Photo du colis prêt</div>
                        <div className="text-[10px] text-white/50">Partager une photo au client</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowAttachmentsMenu(false);
                        handleSendMessage(
                          '📋 Votre commande est confirmée et notre boutique organise votre livraison.',
                          'text'
                        );
                      }}
                      className="w-full p-2 rounded-2xl hover:bg-white/10 text-left text-xs font-bold text-white flex items-center gap-3 transition group select-none"
                    >
                      <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cyan-500/30 to-cyan-400/15 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
                        <Package className="w-4 h-4 filter drop-shadow-[0_1px_2px_rgba(6,182,212,0.5)]" />
                      </div>
                      <div>
                        <div className="font-bold text-white">Confirmation boutique</div>
                        <div className="text-[10px] text-white/50">Message de confirmation client</div>
                      </div>
                    </button>
                  </div>
                )}

                {/* Live Voice Recording Overlay */}
                {isRecordingVoice ? (
                  <div className="flex items-center gap-2 p-2 rounded-full bg-rose-500/15 border border-rose-500/30">
                    <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping shrink-0 ml-2" />
                    <span className="text-xs font-mono font-black text-rose-300">
                      0:{recordingSeconds < 10 ? '0' : ''}{recordingSeconds}
                    </span>

                    {/* Waveform */}
                    <div className="flex-1 flex items-center gap-0.5 px-2">
                      {liveVoiceLevels.map((lvl, i) => (
                        <div
                          key={i}
                          className="w-1 bg-rose-400 rounded-full transition-all duration-75"
                          style={{ height: `${Math.max(6, (lvl / 100) * 22)}px` }}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleCancelVoiceRecording}
                      className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white/70 hover:text-white transition active:scale-90"
                      title="Annuler"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={handleSendVoiceNote}
                      className="px-4 py-2 rounded-full bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white text-xs font-bold shadow-lg shadow-rose-500/30 flex items-center gap-1.5 transition active:scale-95"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Envoyer</span>
                    </button>
                  </div>
                ) : (
                  /* Standard Input Bar with Home-Page Circular Frosted Action Buttons */
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAttachmentsMenu((prev) => !prev)}
                      className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white border border-white/15 hover:border-[#FF6321]/40 backdrop-blur-md flex items-center justify-center transition active:scale-90 shadow-md shrink-0 select-none"
                      title="Pièces jointes"
                    >
                      <Paperclip className="w-4 h-4 filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
                    </button>

                    <button
                      type="button"
                      onClick={handleStartVoiceRecording}
                      className="w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-[#FF6321] border border-white/15 hover:border-[#FF6321]/40 backdrop-blur-md flex items-center justify-center transition active:scale-90 shadow-md shrink-0 select-none"
                      title="Enregistrer note vocale"
                    >
                      <Mic className="w-4 h-4 filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
                    </button>

                    <input
                      type="text"
                      placeholder={`Écrire à ${activeConversation.participantName}...`}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSendMessage(inputText);
                        }
                      }}
                      className="flex-1 min-w-0 px-4 py-2.5 rounded-full bg-black/40 backdrop-blur-md border border-white/15 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321] shadow-inner transition"
                    />

                    <button
                      type="button"
                      disabled={!inputText.trim()}
                      onClick={() => handleSendMessage(inputText)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition active:scale-90 shrink-0 select-none border ${
                        inputText.trim()
                          ? 'bg-gradient-to-tr from-[#FF6321] to-[#FF8C53] text-white shadow-lg shadow-[#FF6321]/40 border-white/20 hover:scale-105'
                          : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                      }`}
                    >
                      <Send className="w-4 h-4 filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* DESKTOP WELCOME SCREEN */
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#0C0C0C] relative overflow-y-auto no-scrollbar">
              <div className="max-w-lg space-y-6">
                <div className="w-16 h-16 rounded-3xl bg-[#FF6321]/15 text-[#FF6321] flex items-center justify-center mx-auto border border-[#FF6321]/20 shadow-xl shadow-[#FF6321]/10">
                  <Store className="w-8 h-8" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-lg font-black text-white">
                    Messagerie Marchand Djassa
                  </h3>
                  <p className="text-xs text-white/60 leading-relaxed max-w-md mx-auto">
                    Vous êtes connecté en tant que <b>{seller.name || 'Vendeur Pro'}</b>. Échangez directement avec vos clients pour confirmer leurs commandes, convenir de la livraison et partager vos articles, ou contactez le Support Marchand DJASSA.
                  </p>
                </div>

                {/* 2 Interactive Pillar Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                  <div
                    onClick={() => setFilterTab('clients')}
                    className="p-3.5 rounded-2xl bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition">
                        <User className="w-4 h-4" />
                      </span>
                      <h4 className="text-xs font-black text-white">Clients ({clientsCount})</h4>
                    </div>
                    <p className="text-[10px] text-white/50 leading-snug">
                      Questions sur les articles, confirmation des adresses et organisation de votre livraison.
                    </p>
                  </div>

                  <div
                    onClick={() => setFilterTab('support')}
                    className="p-3.5 rounded-2xl bg-white/5 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/30 transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400 group-hover:scale-110 transition">
                        <Headphones className="w-4 h-4" />
                      </span>
                      <h4 className="text-xs font-black text-white">Support Marchand</h4>
                    </div>
                    <p className="text-[10px] text-white/50 leading-snug">
                      Assistance sur vos reversements directs Wave / Orange Money et questions boutique.
                    </p>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                  <button
                    onClick={() => setIsNewDiscussionModalOpen(true)}
                    className="flex-1 py-3 px-4 rounded-2xl bg-[#FF6321] hover:bg-[#ff753b] text-white text-xs font-black shadow-xl shadow-[#FF6321]/25 transition active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nouvelle discussion</span>
                  </button>

                  <button
                    onClick={() => setFilterTab('clients')}
                    className="flex-1 py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/80 text-xs font-bold border border-white/10 transition flex items-center justify-center gap-2"
                  >
                    <User className="w-4 h-4 text-emerald-400" />
                    <span>Voir les clients</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. FULL EMBEDDED CALL SCREEN */}
      {activeCall && !activeCall.isMinimized && <VoipCallModal />}

      {/* MODALS */}
      <SellerProductShareModal
        isOpen={isProductShareModalOpen}
        onClose={() => setIsProductShareModalOpen(false)}
        products={products}
        onSelectProduct={handleSendProduct}
      />

      <SellerNewDiscussionModal
        isOpen={isNewDiscussionModalOpen}
        onClose={() => setIsNewDiscussionModalOpen(false)}
        orders={orders}
        onStartConversation={(newConv) => {
          const conv: Conversation = {
            id: newConv.id || `sconv-${Date.now()}`,
            participantId: newConv.participantId || 'unknown',
            participantType: newConv.participantType || 'client',
            participantRole: newConv.participantRole || 'client',
            participantName: newConv.participantName || 'Nouveau contact',
            participantAvatar: newConv.participantAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
            participantVerified: true,
            participantRoleSubtitle: newConv.participantRoleSubtitle || 'Discussion ouverte',
            lastMessage: newConv.lastMessage || 'Discussion initialisée',
            lastMessageTime: 'À l’instant',
            unreadCount: 0,
            isOnline: true,
            online: true,
            relatedOrderId: newConv.relatedOrderId,
          };

          setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)]);
          handleSelectConversation(conv);
          showToast(`Discussion ouverte avec ${conv.participantName} 💬`);
        }}
      />

      {/* Fullscreen Photo Viewer */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/15"
          />
        </div>
      )}
    </div>
  );
};
