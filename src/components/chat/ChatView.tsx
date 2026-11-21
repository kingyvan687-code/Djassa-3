import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  Phone, 
  Send, 
  Paperclip, 
  Mic, 
  MicOff, 
  Image as ImageIcon, 
  Video,
  ShoppingBag, 
  MapPin, 
  Check, 
  CheckCheck, 
  ShieldCheck, 
  Play, 
  Pause, 
  ExternalLink, 
  MoreVertical, 
  Package, 
  Clock, 
  X, 
  Sparkles,
  ChevronRight,
  Info,
  RotateCcw,
  DollarSign,
  AlertTriangle,
  Building2,
  Truck,
  AlertOctagon,
  Gift,
  CheckCircle2,
  RefreshCw,
  Store,
  Bike,
  Volume2
} from 'lucide-react';
import { Conversation, Message, Product, Order } from '../../types';
import { formatFCFA } from '../../services/marketServices';
import { audioService } from '../../services/audioService';
import { useApp } from '../../context/AppContext';
import { ImageViewerModal } from './ImageViewerModal';
import { MediaAttachmentModal } from './MediaAttachmentModal';
import { ProductShareModal } from './ProductShareModal';
import { ProductReturnClaimModal } from './ProductReturnClaimModal';

interface Props {
  conversation: Conversation;
  messages: Message[];
  onBack: () => void;
  onSendMessage: (
    content: string, 
    type?: 'text' | 'image' | 'video' | 'audio' | 'product_card' | 'order_card', 
    meta?: any
  ) => void;
  onStartCall: () => void;
  products: Product[];
  orders: Order[];
  onOpenProduct?: (product: Product) => void;
  showToast: (msg: string) => void;
}

export const ChatView: React.FC<Props> = ({
  conversation,
  messages,
  onBack,
  onSendMessage,
  onStartCall,
  products,
  orders,
  onOpenProduct,
  showToast,
}) => {
  const { sellers, setSelectedSeller } = useApp();
  const [inputText, setInputText] = useState('');
  const [showAttachments, setShowAttachments] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [liveVoiceLevels, setLiveVoiceLevels] = useState<number[]>([15, 25, 30, 20, 35, 25, 40, 20, 30, 15]);
  const [liveTranscription, setLiveTranscription] = useState<string>('');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [playbackTime, setPlaybackTime] = useState<Record<string, number>>({});
  const [audioSpeed, setAudioSpeed] = useState<number>(1);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [isProductShareOpen, setIsProductShareOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimDefaultResolution, setClaimDefaultResolution] = useState<'exchange' | 'refund'>('exchange');
  const [videoErrorIds, setVideoErrorIds] = useState<Record<string, boolean>>({});

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const recordingTimerRef = useRef<any>(null);

  // Clean container-only scroll to bottom without scrolling window or parent ancestors
  const scrollToBottom = (smooth = false) => {
    const el = messagesContainerRef.current;
    if (!el) return;
    if (smooth) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: 'smooth',
      });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  };

  // On conversation switch or initial mount:
  // Reset any ancestor window/body scroll to zero so header is never pushed off screen
  useEffect(() => {
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;

    scrollToBottom(false);

    // Ensure layout calculations are settled on next frame
    const timer = setTimeout(() => {
      scrollToBottom(false);
      window.scrollTo(0, 0);
    }, 40);

    return () => clearTimeout(timer);
  }, [conversation.id]);

  // Auto scroll to bottom only when new message is added and user is near bottom
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(true);
    }
  }, [messages.length]);

  // Voice recording timer
  useEffect(() => {
    if (isRecordingVoice) {
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecordingVoice]);

  // Cleanup audio playback & recording on chat change or unmount
  useEffect(() => {
    return () => {
      audioService.stopPlayback();
      audioService.cancelRecording();
      setPlayingAudioId(null);
    };
  }, [conversation.id]);

  // Handle Send text message
  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text) return;
    onSendMessage(text, 'text');
    setInputText('');
    setShowAttachments(false);
  };

  // Dynamic Quick Reply Suggestions based on conversation role
  const quickReplies = conversation.participantType === 'seller'
    ? [
        'Est-ce toujours disponible ? 🛍️',
        'Où en est ma livraison ? 📦',
        'Je souhaite un échange (produit en panne) 🔄',
        'Demande de remboursement Wave 💰',
        'Paiement à la réception ou Wave 🌊',
        'Merci beaucoup ! ✨',
      ]
    : [
        'Bonjour, j’ai une question sur ma commande 🛍️',
        'Pouvez-vous m’aider pour un retour ? 🔄',
        'Merci pour votre assistance rapide ! 🛡️',
      ];

  const handleQuickReply = (text: string) => {
    onSendMessage(text, 'text');
  };

  // Open Claim modal with specific resolution (exchange or refund)
  const handleOpenClaimModal = (resolution: 'exchange' | 'refund' = 'exchange') => {
    setClaimDefaultResolution(resolution);
    setIsClaimModalOpen(true);
  };

  // Submit Claim (Exchange product / Refund)
  const handleClaimSubmitted = (claimData: {
    orderNumber: string;
    productTitle: string;
    productImage: string;
    productPrice: number;
    issueType: 'broken' | 'damaged' | 'wrong_item' | 'missing_item';
    issueLabel: string;
    resolution: 'exchange' | 'refund';
    resolutionLabel: string;
    details: string;
    proofPhotoUrl: string;
  }) => {
    const claimNumber = `REC-${Math.floor(1000 + Math.random() * 9000)}`;
    const isExchange = claimData.resolution === 'exchange';

    const summaryText = isExchange
      ? `🔄 DEMANDE DE RETOUR & ÉCHANGE (Produit défectueux / en panne)\nArticle : ${claimData.productTitle} (${formatFCFA(claimData.productPrice)})\nMotif : ${claimData.issueLabel}\nSolution : Échange à neuf sans frais\nPrécisions : ${claimData.details}`
      : `💰 DEMANDE DE REMBOURSEMENT (Produit défectueux / non conforme)\nArticle : ${claimData.productTitle} (${formatFCFA(claimData.productPrice)})\nMotif : ${claimData.issueLabel}\nSolution : Remboursement intégral Wave / OM\nPrécisions : ${claimData.details}`;

    // 1. Post message with rich metadata
    onSendMessage(summaryText, 'order_card', {
      claimNumber,
      orderNumber: claimData.orderNumber,
      claimType: claimData.resolution,
      claimReason: claimData.issueLabel,
      productTitle: claimData.productTitle,
      productPrice: claimData.productPrice,
      productImage: claimData.productImage,
      claimStatus: 'in_review',
      claimResolution: claimData.resolutionLabel,
      proofPhoto: claimData.proofPhotoUrl,
      details: claimData.details,
    });

    showToast(isExchange ? 'Demande d’échange envoyée au vendeur 🔄' : 'Demande de remboursement transmise 💰');

    // 2. Automated seller confirmation response
    setTimeout(() => {
      const sellerReply = isExchange
        ? `✅ Bonjour, nous accusons réception de votre réclamation concernant "${claimData.productTitle}". Notre boutique organise l'échange de votre article directement avec vous sans frais supplémentaires.`
        : `✅ Bonjour, votre demande de remboursement pour "${claimData.productTitle}" a été prise en charge. Montant concerné : ${formatFCFA(claimData.productPrice)}.`;

      onSendMessage(sellerReply, 'text');
    }, 1400);
  };

  // 1. Start Real Microphone Voice Recording
  const handleStartRecording = async () => {
    setIsRecordingVoice(true);
    setRecordingSeconds(0);
    setLiveTranscription('');
    setLiveVoiceLevels([20, 30, 25, 35, 20, 40, 25, 30, 20, 25]);

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
      (transcript) => {
        setLiveTranscription(transcript);
      }
    );

    if (res.isSimulated && res.error) {
      showToast('Microphone : mode interactif actif 🎙️');
    }
  };

  // 2. Cancel Voice Recording
  const handleCancelVoiceRecording = () => {
    audioService.cancelRecording();
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
    setLiveTranscription('');
    showToast('Enregistrement vocal annulé ✕');
  };

  // 3. Stop and Send Voice Note
  const handleSendVoiceNote = async () => {
    const durationSec = recordingSeconds || 1;
    const res = await audioService.stopRecording(durationSec);

    setIsRecordingVoice(false);
    setRecordingSeconds(0);

    const durationStr = res?.durationFormatted || `0:${durationSec < 10 ? '0' : ''}${durationSec}`;
    const audioUrl = res?.audioUrl || undefined;
    const transcription = res?.transcription || liveTranscription || undefined;

    setLiveTranscription('');

    onSendMessage(`🎤 Note vocale (${durationStr})`, 'audio', {
      audioUrl: audioUrl,
      audioDuration: durationStr,
      audioSeconds: durationSec,
      transcription: transcription,
    });
    showToast('Note vocale envoyée 🎙️');
  };

  // 4. Toggle Play/Pause Voice Note
  const handleTogglePlayAudio = (msg: Message) => {
    if (playingAudioId === msg.id) {
      audioService.stopPlayback();
      setPlayingAudioId(null);
      return;
    }

    // Determine fallback text if message is a pre-existing mock without a saved audio recording
    let fallbackSpeech = 'Bonjour ! Votre message vocal a bien été pris en compte sur Djassa.';
    if (msg.senderId === 'seller-1' || msg.senderType === 'seller') {
      fallbackSpeech = "Bonjour Mme Kouamé ! Tout est disponible et prêt à la boutique. Votre commande est bien confirmée.";
    } else if (msg.senderType === 'client' || msg.senderId === 'client-current') {
      fallbackSpeech = msg.meta?.transcription || "Bonjour, je vous ai transmis une note vocale concernant ma commande Djassa.";
    }

    setPlayingAudioId(msg.id);

    audioService.playAudio(
      msg.id,
      msg.meta?.audioUrl,
      fallbackSpeech,
      audioSpeed,
      (currentTime) => {
        setPlaybackTime((prev) => ({
          ...prev,
          [msg.id]: currentTime,
        }));
      },
      () => {
        setPlayingAudioId(null);
        setPlaybackTime((prev) => ({
          ...prev,
          [msg.id]: 0,
        }));
      }
    );
  };

  // 5. Change Audio Speed
  const handleCycleAudioSpeed = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextSpeed = audioSpeed === 1 ? 1.5 : audioSpeed === 1.5 ? 2 : 1;
    setAudioSpeed(nextSpeed);
    audioService.setPlaybackSpeed(nextSpeed);
  };

  // Send Preset Photo
  const handleSendSamplePhoto = (sampleUrl?: string) => {
    const url =
      sampleUrl ||
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600';
    onSendMessage('📷 Photo de l’article / colis', 'image', {
      productImage: url,
    });
    setShowAttachments(false);
    showToast('Photo envoyée dans le chat 📸');
  };

  // Send Imported Media (Image or Video)
  const handleSendMedia = (
    type: 'image' | 'video',
    mediaUrl: string,
    caption?: string,
    meta?: any
  ) => {
    if (type === 'video') {
      onSendMessage(caption || '🎥 Vidéo partagée', 'video', {
        videoUrl: mediaUrl,
        ...meta,
      });
      showToast('Vidéo importée & envoyée dans la discussion 🎥');
    } else {
      onSendMessage(caption || '📷 Photo partagée', 'image', {
        productImage: mediaUrl,
        ...meta,
      });
      showToast('Photo importée & envoyée dans la discussion 📸');
    }
    setShowAttachments(false);
  };

  // Send Product Card
  const handleSendProductCard = (prod: Product) => {
    onSendMessage(`🛍️ ${prod.name} (${formatFCFA(prod.price)})`, 'product_card', {
      productId: prod.id,
      productTitle: prod.name,
      productPrice: prod.price,
      productImage: prod.videoPoster || prod.images[0],
    });
    showToast(`Fiche de ${prod.name} partagée 🛍️`);
  };

  // Share Delivery Location
  const handleShareLocation = () => {
    onSendMessage(
      '📍 Position de livraison : Cocody Angré 8ème Tranche, près de la pharmacie du Soleil.',
      'text'
    );
    setShowAttachments(false);
    showToast('Repère de livraison partagé 📍');
  };

  // In-app secure discussion guarantee
  const handleSecurityInfo = () => {
    showToast('Toutes les discussions et réclamations sont sécurisées et protégées sur Djassa 🛡️');
  };

  // Related product or order context
  const relatedProduct = conversation.relatedProductId
    ? products.find((p) => p.id === conversation.relatedProductId)
    : null;

  const relatedOrder = conversation.relatedOrderId
    ? orders.find((o) => o.id === conversation.relatedOrderId)
    : null;

  // Resolve seller if conversation participant is a merchant
  const chatSeller = useMemo(() => {
    if (conversation.participantType === 'seller' || conversation.participantRole === 'seller') {
      return sellers.find(
        (s) => s.id === conversation.participantId || s.name.toLowerCase() === conversation.participantName.toLowerCase()
      ) || sellers[0] || null;
    }
    return null;
  }, [conversation, sellers]);

  return (
    <div id="active-chat-view-container" className="w-full h-full flex flex-col bg-[#0A0A0A] overflow-hidden relative">
      {/* 1. TOP HEADER BAR */}
      <div className="sticky top-0 pt-3 px-4 pb-3 border-b border-white/10 bg-[#0F0F0F] flex items-center justify-between gap-3 shrink-0 shadow-md z-20">
        <div 
          className={`flex items-center gap-3 min-w-0 ${chatSeller ? 'cursor-pointer hover:opacity-90' : ''}`}
          onClick={() => {
            if (chatSeller) {
              setSelectedSeller(chatSeller);
            }
          }}
          title={chatSeller ? "Cliquer pour voir le profil du vendeur" : undefined}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBack();
            }}
            className="p-1.5 -ml-1.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition"
            aria-label="Retour à la liste"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="relative shrink-0">
            <img
              src={conversation.participantAvatar}
              alt={conversation.participantName}
              className="w-10 h-10 rounded-2xl object-cover border border-white/10"
            />
            {conversation.isOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0F0F0F]" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs sm:text-sm font-black text-white truncate">
                {conversation.participantName}
              </h2>
              {conversation.participantVerified && (
                <ShieldCheck className="w-3.5 h-3.5 text-[#FF6321] shrink-0" />
              )}
            </div>
            <p className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{conversation.isOnline ? 'En ligne • Répond en < 5 min' : 'Vu récemment'}</span>
            </p>
          </div>
        </div>

        {/* Action buttons: Voir profil & VoIP Call */}
        <div className="flex items-center gap-1.5 shrink-0">
          {chatSeller && (
            <button
              id="btn-chat-view-seller-profile"
              onClick={() => setSelectedSeller(chatSeller)}
              className="px-2.5 py-2 rounded-xl bg-[#FF6321]/20 hover:bg-[#FF6321]/30 text-[#FF6321] hover:text-white border border-[#FF6321]/35 transition shadow-md active:scale-95 text-xs font-bold flex items-center gap-1.5"
              title="Voir le profil du vendeur"
            >
              <Store className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Voir profil</span>
            </button>
          )}

          <button
            id="btn-chat-audio-call"
            onClick={onStartCall}
            className="p-2.5 rounded-xl bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 transition shadow-md active:scale-95"
            title="Appel vocal crypté Djassa"
          >
            <Phone className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. MESSAGES FEED */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3.5 no-scrollbar overscroll-contain"
      >
        {/* Date separator */}
        <div className="flex items-center justify-center my-2">
          <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/50 font-bold uppercase tracking-wider">
            Aujourd'hui • Échanges Sécurisés Djassa
          </span>
        </div>

        {messages.map((msg) => {
          const isMine = msg.senderId === 'client-current' || msg.senderType === 'client';
          const isAudio = msg.type === 'audio';
          const isImage = msg.type === 'image';
          const isVideo = msg.type === 'video';
          const isProductCard = msg.type === 'product_card';

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[70%] rounded-3xl p-3 shadow-lg transition ${
                  isMine
                    ? 'bg-gradient-to-br from-[#FF6321] to-[#e04f12] text-white rounded-tr-xs'
                    : 'bg-[#181818] text-white rounded-tl-xs border border-white/10'
                }`}
              >
                {/* 3A. Standard Text Message */}
                {msg.type === 'text' && (
                  <p className="text-xs leading-relaxed whitespace-pre-wrap select-text">
                    {msg.content}
                  </p>
                )}

                {/* 3B. Voice Audio Note */}
                {isAudio && (
                  <div className="space-y-2 py-0.5 min-w-[200px] sm:min-w-[240px]">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleTogglePlayAudio(msg)}
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center transition shadow-md shrink-0 active:scale-95 ${
                          isMine
                            ? 'bg-white text-[#FF6321] hover:bg-white/90'
                            : 'bg-[#FF6321] text-white hover:bg-[#ff753b]'
                        }`}
                        title={playingAudioId === msg.id ? 'Pause' : 'Écouter'}
                      >
                        {playingAudioId === msg.id ? (
                          <Pause className="w-4 h-4 fill-current" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </button>

                      {/* Waveform graphic with progressive fill */}
                      <div className="flex items-center gap-1 h-7 flex-1 px-1">
                        {[30, 60, 95, 45, 80, 100, 55, 85, 65, 90, 45, 75, 50, 85, 40, 70].map((h, i) => {
                          const isPlaying = playingAudioId === msg.id;
                          const totalBars = 16;
                          const currentSec = playbackTime[msg.id] || 0;
                          const totalSec = msg.meta?.audioSeconds || 10;
                          const progressRatio = totalSec > 0 ? currentSec / totalSec : 0;
                          const barRatio = i / totalBars;
                          const hasPassed = barRatio <= progressRatio;

                          return (
                            <div
                              key={i}
                              className={`w-1 rounded-full transition-all duration-100 ${
                                isMine
                                  ? hasPassed
                                    ? 'bg-white shadow-sm'
                                    : 'bg-white/40'
                                  : hasPassed
                                  ? 'bg-[#FF6321]'
                                  : 'bg-white/30'
                              } ${isPlaying && hasPassed ? 'brightness-125' : ''}`}
                              style={{
                                height: `${Math.max(16, (h / 100) * 26)}px`,
                              }}
                            />
                          );
                        })}
                      </div>

                      {/* Speed toggle */}
                      <button
                        type="button"
                        onClick={handleCycleAudioSpeed}
                        className={`text-[9px] font-black px-2 py-1 rounded-xl border transition active:scale-95 shrink-0 ${
                          isMine 
                            ? 'border-white/30 bg-white/10 hover:bg-white/20 text-white' 
                            : 'border-white/20 bg-white/5 hover:bg-white/15 text-white/90'
                        }`}
                        title="Vitesse de lecture"
                      >
                        {audioSpeed}x
                      </button>
                    </div>

                    {/* Transcription if available */}
                    {msg.meta?.transcription && (
                      <div className={`p-2 rounded-xl text-[11px] leading-relaxed italic ${
                        isMine ? 'bg-black/20 text-white/95' : 'bg-white/5 text-white/80'
                      }`}>
                        « {msg.meta.transcription} »
                      </div>
                    )}

                    {/* Progress duration display */}
                    <div className="flex items-center justify-between text-[10px] font-medium opacity-80 pt-0.5">
                      <span className="font-mono">
                        {playingAudioId === msg.id
                          ? `${Math.floor((playbackTime[msg.id] || 0) / 60)}:${
                              Math.floor((playbackTime[msg.id] || 0) % 60) < 10 ? '0' : ''
                            }${Math.floor((playbackTime[msg.id] || 0) % 60)} / ${msg.meta?.audioDuration || '0:10'}`
                          : msg.meta?.audioDuration || '0:10'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Volume2 className="w-3 h-3" />
                        <span>Note vocale</span>
                      </span>
                    </div>
                  </div>
                )}

                {/* 3C. Image Message */}
                {isImage && (
                  <div className="space-y-1.5">
                    <div
                      onClick={() => setPreviewMedia({ url: msg.meta?.productImage || 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600', type: 'image' })}
                      className="rounded-2xl overflow-hidden cursor-pointer group relative border border-white/10"
                    >
                      <img
                        src={msg.meta?.productImage || 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600'}
                        alt="Photo envoyée"
                        className="w-full max-h-56 object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition" />
                    </div>
                    {msg.content && msg.content !== '📷 Photo partagée' && msg.content !== '📷 Photo de l’article / colis' && (
                      <p className="text-xs pt-1">{msg.content}</p>
                    )}
                  </div>
                )}

                {/* 3C-bis. Video Message */}
                {isVideo && (
                  <div className="space-y-1.5">
                    <div className="rounded-2xl overflow-hidden relative border border-white/15 bg-black/70 shadow-lg group">
                      {videoErrorIds[msg.id] ? (
                        <div className="p-6 text-center text-xs text-white/60 space-y-1.5 bg-neutral-900">
                          <Video className="w-6 h-6 mx-auto text-white/35" />
                          <p>Vidéo indisponible ou format non supporté.</p>
                        </div>
                      ) : (
                        <video
                          src={msg.meta?.videoUrl}
                          controls
                          playsInline
                          poster={msg.meta?.videoPoster}
                          onError={() => setVideoErrorIds((prev) => ({ ...prev, [msg.id]: true }))}
                          className="w-full max-h-60 object-contain rounded-xl bg-black"
                        />
                      )}
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[9px] font-black text-purple-300 flex items-center gap-1 border border-white/10 pointer-events-none">
                        <Video className="w-3 h-3 text-purple-400" />
                        <span>Vidéo</span>
                      </div>
                    </div>
                    {msg.content && msg.content !== '🎥 Vidéo partagée' && (
                      <p className="text-xs pt-1">{msg.content}</p>
                    )}
                  </div>
                )}

                {/* 3D. Product Card Message */}
                {isProductCard && msg.meta && (
                  <div className="space-y-2">
                    <div className="p-2 rounded-2xl bg-black/40 border border-white/10 flex items-center gap-2.5">
                      {msg.meta.productImage && (
                        <img
                          src={msg.meta.productImage}
                          alt={msg.meta.productTitle}
                          className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <b className="text-xs text-white block truncate">{msg.meta.productTitle}</b>
                        <span className="text-xs font-black text-amber-300 block">
                          {formatFCFA(msg.meta.productPrice || 0)}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs">{msg.content}</p>
                  </div>
                )}

                {/* 3E. Damaged Package Incident Card */}
                {msg.meta?.isDamageAlert && (
                  <div className="space-y-2.5 my-1">
                    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/20 via-rose-500/10 to-black/60 border border-amber-500/40 shadow-xl space-y-2.5">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
                          <AlertTriangle className="w-5 h-5 text-amber-400 animate-bounce" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">
                            Incident Flotte • Flash Express
                          </span>
                          <h4 className="text-xs font-black text-white">
                            Colis endommagé durant la livraison
                          </h4>
                        </div>
                      </div>

                      <p className="text-xs text-white/90 leading-relaxed whitespace-pre-wrap select-text">
                        {msg.content}
                      </p>

                      {/* Incident Details Summary Box */}
                      <div className="p-2.5 rounded-xl bg-black/50 border border-white/10 space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between text-white/70">
                          <span>Commande concernée :</span>
                          <span className="font-mono font-bold text-white">#{msg.meta.orderNumber || 'N/A'}</span>
                        </div>
                        <div className="flex items-center justify-between text-white/70">
                          <span>Article réapprovisionné :</span>
                          <span className="font-bold text-white truncate max-w-[160px]">{msg.meta.orderTitle || 'Article commandé'}</span>
                        </div>
                        <div className="flex items-center justify-between text-white/70">
                          <span>Nouvelle livraison :</span>
                          <span className="font-bold text-emerald-400">Demain dès 9h00 (Prioritaire)</span>
                        </div>
                      </div>

                      {/* 100% Free Shipping Compensation Badge */}
                      <div className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-500/25 via-emerald-600/20 to-teal-500/25 border border-emerald-500/40 flex items-center justify-between gap-2 shadow-lg">
                        <div className="flex items-center gap-2">
                          <Gift className="w-5 h-5 text-emerald-400 shrink-0" />
                          <div>
                            <span className="text-[10px] font-black text-emerald-300 uppercase tracking-wide block">
                              Dédommagement imprévu
                            </span>
                            <span className="text-xs font-black text-white">
                              LIVRAISON 100% GRATUITE
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-black text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-full border border-emerald-500/40">
                          0 FCFA
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3F. Product Return / Claim / Refund Ticket Card */}
                {(msg.meta?.claimType || msg.meta?.claimNumber) && !msg.meta?.isDamageAlert && (
                  <div className="space-y-2.5 my-1">
                    <div className="p-3.5 rounded-2xl bg-black/50 border border-amber-500/40 shadow-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400">
                            {msg.meta.claimType === 'refund' ? (
                              <DollarSign className="w-4 h-4 text-cyan-400" />
                            ) : (
                              <RotateCcw className="w-4 h-4 text-emerald-400" />
                            )}
                          </span>
                          <div>
                            <span className="text-[9px] font-black uppercase text-amber-400 tracking-wider block">
                              Garantie Client Djassa • #{msg.meta.claimNumber || 'REC-2026'}
                            </span>
                            <h4 className="text-xs font-black text-white">
                              {msg.meta.claimType === 'refund'
                                ? 'Demande de Remboursement Intégral'
                                : 'Demande de Retour & Échange (En panne)'}
                            </h4>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {msg.meta.claimStatus === 'approved' ? 'Validé ✓' : 'Transmis au vendeur'}
                        </span>
                      </div>

                      {/* Product details */}
                      <div className="p-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5">
                        {msg.meta.productImage && (
                          <img
                            src={msg.meta.productImage}
                            alt={msg.meta.productTitle}
                            className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0 cursor-pointer"
                            onClick={() => setPreviewMedia({ url: msg.meta.productImage, type: 'image' })}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <b className="text-xs text-white block truncate">{msg.meta.productTitle}</b>
                          <span className="text-xs font-black text-amber-300 block">
                            {formatFCFA(msg.meta.productPrice || 0)}
                          </span>
                          {msg.meta.orderNumber && (
                            <span className="text-[9px] text-white/50 font-mono">
                              Commande #{msg.meta.orderNumber}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="text-white/80">
                          <strong className="text-white">Motif : </strong>
                          <span className="text-amber-200">{msg.meta.claimReason}</span>
                        </div>
                        {msg.meta.claimResolution && (
                          <div className="text-white/80">
                            <strong className="text-white">Solution demandée : </strong>
                            <span className="text-emerald-300 font-semibold">{msg.meta.claimResolution}</span>
                          </div>
                        )}
                      </div>

                      {/* Proof photo thumbnail if attached */}
                      {msg.meta.proofPhoto && (
                        <div className="pt-1">
                          <span className="text-[10px] text-white/50 block mb-1">Photo justificative du produit :</span>
                          <div 
                            onClick={() => setPreviewMedia({ url: msg.meta.proofPhoto, type: 'image' })}
                            className="inline-block rounded-xl overflow-hidden border border-white/20 cursor-pointer hover:opacity-90 transition"
                          >
                            <img src={msg.meta.proofPhoto} alt="Preuve" className="w-20 h-16 object-cover" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3G. Driver Complaint Card */}
                {msg.meta?.isDriverComplaint && (
                  <div className="space-y-2.5 my-1">
                    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-rose-950/40 via-[#181818] to-black border border-rose-500/40 shadow-xl space-y-2.5">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
                          <AlertOctagon className="w-5 h-5 text-rose-400" />
                        </div>
                        <div>
                          <span className="text-[9px] font-black uppercase text-rose-400 tracking-wider block">
                            Dossier de Signalement • #{msg.meta.complaintNumber || 'PL-441'}
                          </span>
                          <h4 className="text-xs font-black text-white">
                            Plainte sur livreur transmise à la flotte
                          </h4>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1 text-xs">
                        <div className="flex items-center justify-between text-white/70">
                          <span>Coursier :</span>
                          <span className="font-bold text-white">{msg.meta.driverName}</span>
                        </div>
                        <div className="flex items-center justify-between text-white/70">
                          <span>Commande :</span>
                          <span className="font-mono text-white">#{msg.meta.orderNumber}</span>
                        </div>
                        <div className="pt-1 text-white/80">
                          <strong className="text-rose-300">Motif : </strong>
                          <span>{msg.meta.reason}</span>
                        </div>
                        {msg.meta.details && (
                          <p className="text-[11px] text-white/60 italic pt-0.5">
                            « {msg.meta.details} »
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] text-rose-300 font-medium">
                        <Clock className="w-3 h-3 text-rose-400" />
                        <span>En cours de traitement par la direction logistique</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3H. Generic Order Card Fallback */}
                {msg.type === 'order_card' && !msg.meta?.isDamageAlert && !msg.meta?.claimType && !msg.meta?.claimNumber && !msg.meta?.isDriverComplaint && (
                  <div className="p-3 rounded-2xl bg-black/40 border border-white/15 space-y-2">
                    <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                  </div>
                )}

                {/* Bubble Timestamp & Status */}
                <div
                  className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${
                    isMine ? 'text-white/80' : 'text-white/40'
                  }`}
                >
                  <span>{msg.timestamp}</span>
                  {isMine && (
                    <CheckCheck className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 6. INPUT BAR (TEXT OR VOICE RECORDING) */}
      <div className="p-3 border-t border-white/10 bg-[#0F0F0F] shrink-0 pb-safe">
        {isRecordingVoice ? (
          /* Live Voice Recording Active State */
          <div className="flex flex-col gap-2 p-2 bg-[#181818] rounded-2xl border border-white/10 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              {/* Left: pulsating recording badge, timer, and live dynamic waveform */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="relative flex items-center justify-center shrink-0">
                  <div className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping absolute" />
                  <div className="w-3 h-3 rounded-full bg-rose-500 relative z-10" />
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-mono font-black text-white">
                    0:{recordingSeconds < 10 ? '0' : ''}{recordingSeconds}
                  </span>
                  <span className="text-[9px] text-rose-400 font-semibold uppercase tracking-wider truncate">
                    Enregistrement micro...
                  </span>
                </div>

                {/* Dynamic live voice waveform reacting to actual microphone sound */}
                <div className="flex items-center gap-0.5 h-6 flex-1 max-w-[150px] px-1 overflow-hidden">
                  {liveVoiceLevels.map((lvl, idx) => (
                    <div
                      key={idx}
                      className="w-1.5 bg-gradient-to-t from-rose-500 via-amber-400 to-[#FF6321] rounded-full transition-all duration-75"
                      style={{
                        height: `${Math.max(5, Math.min(24, (lvl / 100) * 24))}px`,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Right: Cancel & Send Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCancelVoiceRecording}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500/20 text-white/80 hover:text-rose-300 text-xs font-bold transition flex items-center gap-1 active:scale-95"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Annuler</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendVoiceNote}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#FF6321] to-[#ff7e47] hover:from-[#ff753b] hover:to-[#ff8d5c] text-white text-xs font-black shadow-lg shadow-[#FF6321]/30 transition flex items-center gap-1.5 active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Envoyer</span>
                </button>
              </div>
            </div>

            {/* Live speech transcription display while talking */}
            {liveTranscription && (
              <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/90 flex items-center gap-2 animate-fadeIn">
                <span className="text-[10px] text-amber-400 font-bold uppercase shrink-0">🗣️ Détecté :</span>
                <span className="truncate italic">« {liveTranscription} »</span>
              </div>
            )}
          </div>
        ) : (
          /* Normal Message Input Bar */
          <form onSubmit={handleSendText} className="flex items-center gap-2">
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => setShowAttachments(true)}
              className={`p-2.5 rounded-xl transition border ${
                showAttachments
                  ? 'bg-[#FF6321] text-white border-[#FF6321]'
                  : 'bg-white/5 text-white/60 hover:text-white border-white/10'
              }`}
              title="Pièces jointes & options"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Input field */}
            <input
              id="input-chat-message"
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                conversation.participantType === 'seller'
                  ? 'Écrire un message à la boutique...'
                  : 'Écrire un message au support Djassa...'
              }
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF6321] transition"
            />

            {/* Voice Note Trigger if empty, Send button if text */}
            {inputText.trim() ? (
              <button
                type="submit"
                className="p-2.5 rounded-xl bg-[#FF6321] hover:bg-[#ff753b] text-white shadow-lg shadow-[#FF6321]/30 transition active:scale-95 shrink-0"
                title="Envoyer"
              >
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartRecording}
                className="p-2.5 rounded-xl bg-[#FF6321]/15 hover:bg-[#FF6321] text-[#FF6321] hover:text-white border border-[#FF6321]/30 transition active:scale-95 shrink-0 group flex items-center justify-center shadow-sm"
                title="Enregistrer une note vocale au micro"
              >
                <Mic className="w-4 h-4 group-hover:scale-110 transition" />
              </button>
            )}
          </form>
        )}
      </div>

      {/* 7. MODALS */}
      <MediaAttachmentModal
        isOpen={showAttachments}
        onClose={() => setShowAttachments(false)}
        onSendMedia={handleSendMedia}
        onOpenProductShare={() => setIsProductShareOpen(true)}
        onShareLocation={handleShareLocation}
        participantName={conversation.participantName}
      />

      <ImageViewerModal
        mediaUrl={previewMedia?.url || null}
        mediaType={previewMedia?.type || 'image'}
        onClose={() => setPreviewMedia(null)}
      />

      <ProductShareModal
        isOpen={isProductShareOpen}
        onClose={() => setIsProductShareOpen(false)}
        products={products}
        onSelectProduct={handleSendProductCard}
      />

      {/* Modal for Product Returns / Claims / Refunds (when chatting with Seller) */}
      <ProductReturnClaimModal
        isOpen={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
        sellerName={conversation.participantName}
        sellerId={conversation.participantId}
        orders={orders}
        products={products}
        defaultOrderId={conversation.relatedOrderId}
        defaultProductId={conversation.relatedProductId}
        defaultResolution={claimDefaultResolution}
        onSubmitClaim={handleClaimSubmitted}
      />
    </div>
  );
};
