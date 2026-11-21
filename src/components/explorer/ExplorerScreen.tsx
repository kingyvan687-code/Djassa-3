import React, { useState, useMemo, useRef, useEffect, useDeferredValue, lazy, Suspense } from 'react';
import { 
  Search, 
  Play, 
  Tag, 
  MapPin, 
  Sparkles, 
  Filter, 
  X, 
  Store, 
  Star, 
  ShoppingBag, 
  Heart, 
  Bookmark, 
  Zap, 
  Clock, 
  CheckCircle2, 
  ChevronRight,
  ChevronDown,
  ArrowUp,
  Compass,
  Camera,
  Layers,
  LayoutGrid,
  Menu,
  SquarePen,
  Headphones,
  Paperclip,
  Globe,
  Plus,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Copy,
  Check,
  Share2,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  History,
  MessageSquare,
  Image as ImageIcon,
  Upload,
  Trash2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { creditsService } from '../../services/creditsService';
import { getSecurityToken } from '../../services/securityService';
import { visitorService } from '../../services/visitorService';
import { VISITOR_QUOTAS } from '../../config/visitorQuotas';
import { formatFCFA, formatMetricCount } from '../../services/marketServices';
import { AI_BILLING_RATES } from '../../services/aiPricing';
import { countWords, enforceMaxWordsReply, GPT_CLIENT_MAX_WORDS } from '../../services/aiWordLimit';
import { Product, Seller } from '../../types';

const RealtimeVoiceModal = lazy(() =>
  import('./RealtimeVoiceModal').then((m) => ({ default: m.RealtimeVoiceModal }))
);

const SUGGESTED_PROMPTS = [
  {
    title: "Trouver des baskets tendance",
    subtitle: "Sneakers streetwear, mocassins et livraison express",
    emoji: "👟",
    query: "Montre-moi les meilleures baskets streetwear et sneakers disponibles aujourd'hui"
  },
  {
    title: "Robes & tenues wax élégantes",
    subtitle: "Créations originales et collections chic d'Adjamé",
    emoji: "👗",
    query: "Je cherche des robes en wax chic et des tenues traditionnelles pour une occasion"
  },
  {
    title: "Smartphones & promos High-Tech",
    subtitle: "Comparer les prix, écouteurs bluetooth et promotions",
    emoji: "📱",
    query: "Quelles sont les promotions High-Tech, smartphones et écouteurs au marché ?"
  },
  {
    title: "Boutiques certifiées à proximité",
    subtitle: "Commerçants vérifiés avec livraison en moins de 2h",
    emoji: "⭐",
    query: "Affiche-moi les commerçants certifiés les mieux notés avec livraison rapide"
  }
];

// The Iconic ChatGPT Emblem SVG
const ChatGptLogo: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    aria-hidden="true"
  >
    <path d="M22.28 9.87a5.98 5.98 0 00-.51-4.88 6.05 6.05 0 00-6.51-2.9 6.07 6.07 0 00-4.64-2.09 6.07 6.07 0 00-5.77 4.19 6.04 6.04 0 00-4.06 2.94 6.03 6.03 0 00.74 7.07 5.98 5.98 0 00.51 4.88 6.05 6.05 0 006.51 2.9 6.07 6.07 0 004.64 2.09 6.07 6.07 0 005.77-4.19 6.04 6.04 0 004.06-2.94 6.03 6.03 0 00-.74-7.07zm-9.03 12.18a4.57 4.57 0 01-2.94-1.07l.14-.08 4.88-2.82a.76.76 0 00.38-.66v-6.9l2.08 1.2a.08.08 0 01.04.06v5.71a4.6 4.6 0 01-4.58 4.56zm-8.62-4.1a4.56 4.56 0 01-.58-3.09l.15.09 4.88 2.82c.24.14.38.39.38.66v2.39l-2.08-1.2a.08.08 0 01-.04-.06l-2.71-1.61zm-1.5-9.15a4.58 4.58 0 012.36-2.02v5.82a.75.75 0 00.38.65l4.88 2.82-2.08 1.2a.08.08 0 01-.07 0l-4.95-2.86a4.59 4.59 0 01-.52-5.61zm14.54 3.75l-4.88-2.82a.75.75 0 00-.76 0l-4.88 2.82-2.08-1.2a.08.08 0 010-.07l4.95-2.86a4.59 4.59 0 016.94 2.45l.71 1.68zm2.63 4.14l-.15-.09-4.88-2.82a.76.76 0 00-.38-.66v-2.39l2.08 1.2a.08.08 0 01.04.06l2.71 1.61a4.56 4.56 0 01.58 3.09zm-3.01 4.74a4.58 4.58 0 01-2.36 2.02v-5.82a.75.75 0 00-.38-.65l-4.88-2.82 2.08-1.2a.08.08 0 01.07 0l4.95 2.86a4.59 4.59 0 01.52 5.61z" />
  </svg>
);

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  attachedImages?: string[];
  matchedProducts?: Product[];
  matchedSellers?: Seller[];
  thought?: string;
  isStreaming?: boolean;
}

export const ExplorerScreen: React.FC = () => {
  const { 
    isAuthenticated,
    requireAuth,
    openAuthModal,
    visitorQuota,
    refreshVisitorQuota,
    products, 
    sellers,
    userProfile,
    setSelectedProduct,
    setSelectedSeller,
    setVariantModalProduct,
    setIsVariantModalDirectBuy,
    openVideoViewer,
    openPhotoViewer,
    navigateToFeedProduct,
    showToast,
    aiCredits,
    userPlan,
    spendAiCredits,
    setIsCreditModalOpen,
    openCreditModal,
    setCreditModalAudience,
    openAiVideoModal,
    openTryOnModal,
    isVoiceModeOpen,
    setIsVoiceModeOpen,
    aiConversations,
    saveAiConversation,
    deleteAiConversation
  } = useApp();

  // Model & Mode states (RodiumAI)
  const [currentModel, setCurrentModel] = useState<'minimax-h3-max-turbo' | 'minimax-m3.1-flash' | 'catalog'>('minimax-h3-max-turbo');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const deferredHistorySearch = useDeferredValue(historySearch);
  const [activeAiConversationId, setActiveAiConversationId] = useState<string | null>(null);
  const sellersById = useMemo(() => new Map(sellers.map((s) => [s.id, s])), [sellers]);

  // Chat conversation state & attached images for import (restore persisted guest chat in Visitor Mode)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (getSecurityToken()) return [];
    const savedGuestConv = visitorService.getGuestAiConversation();
    if (!savedGuestConv || !Array.isArray(savedGuestConv.messages)) return [];
    const productsMap = new Map(products.map((p) => [p.id, p]));
    const sellersMap = new Map(sellers.map((s) => [s.id, s]));
    return savedGuestConv.messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      timestamp: m.timestamp,
      attachedImages: m.attachedImages,
      thought: m.thought,
      matchedProducts: (m.matchedProductIds || [])
        .map((id) => productsMap.get(id))
        .filter((p): p is Product => Boolean(p)),
      matchedSellers: (m.matchedSellerIds || [])
        .map((id) => sellersMap.get(id))
        .filter((s): s is Seller => Boolean(s))
    }));
  });
  const [inputText, setInputText] = useState('');
  const [pendingAttachedImages, setPendingAttachedImages] = useState<string[]>([]);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  const promptWordCount = useMemo(() => countWords(inputText), [inputText]);
  const isPromptTooLong = promptWordCount > GPT_CLIENT_MAX_WORDS;

  // Vocal Recording State for #btn-gpt-mic (Faire des vocales)
  const [isRecordingVocal, setIsRecordingVocal] = useState(false);
  const [vocalSeconds, setVocalSeconds] = useState(0);
  const [vocalTranscript, setVocalTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const vocalTimerRef = useRef<any>(null);

  // Start Vocal Recording
  const startVocalRecording = async () => {
    try {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
      } catch (err) {
        console.warn('[Microphone permission error]', err);
      }

      setIsRecordingVocal(true);
      setVocalSeconds(0);
      setVocalTranscript('');

      vocalTimerRef.current = setInterval(() => {
        setVocalSeconds((prev) => prev + 1);
      }, 1000);

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = 'fr-FR';

          rec.onresult = (event: any) => {
            let full = '';
            for (let i = 0; i < event.results.length; i++) {
              full += event.results[i][0].transcript + ' ';
            }
            setVocalTranscript(full.trim());
          };

          rec.onerror = (e: any) => {
            console.warn('[SpeechRecognition error]', e);
          };

          rec.start();
          recognitionRef.current = rec;
        } catch (e) {
          console.warn('[SpeechRecognition start error]', e);
        }
      }

      showToast("🎙️ Enregistrement vocal démarré • Parlez dans le micro...");
    } catch (e: any) {
      showToast("Erreur accès micro : " + (e.message || 'Non autorisé'));
    }
  };

  // Stop Vocal Recording (Send or Cancel)
  const stopVocalRecording = (shouldSend: boolean = true) => {
    if (vocalTimerRef.current) {
      clearInterval(vocalTimerRef.current);
      vocalTimerRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    const durationMin = Math.floor(vocalSeconds / 60);
    const durationSec = (vocalSeconds % 60).toString().padStart(2, '0');
    const durationFormatted = `${durationMin}:${durationSec}`;
    const recognizedText = vocalTranscript.trim();

    setIsRecordingVocal(false);

    if (shouldSend) {
      const queryToSend = recognizedText 
        ? `🎙️ [Message vocal ${durationFormatted}] : « ${recognizedText} »`
        : `🎙️ [Message vocal ${durationFormatted}] : Recherche d'articles et tendances au marché d'Adjamé`;
      
      handleSendMessage(queryToSend);
      showToast(`🎙️ Message vocal (${durationFormatted}) envoyé avec succès !`);
    } else {
      showToast("Enregistrement vocal annulé.");
    }

    setVocalSeconds(0);
    setVocalTranscript('');
  };

  // Cleanup vocal recording on unmount
  useEffect(() => {
    return () => {
      if (vocalTimerRef.current) clearInterval(vocalTimerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Quick filters for conversational search
  const [selectedBudget, setSelectedBudget] = useState<number | null>(null);
  const [webSearchActive, setWebSearchActive] = useState(true);

  // Video and photo products for viewer
  const videoProducts = useMemo(() => products.filter((p) => p.mediaType === 'video' && p.videoUrl), [products]);
  const photoProducts = useMemo(() => products.filter((p) => (p.images && p.images.length > 0) || p.mediaType === 'image'), [products]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Filtered & grouped persisted AI conversations from AppContext (C-05)
  const groupedAiConversations = useMemo(() => {
    const q = deferredHistorySearch.trim().toLowerCase();
    const list = (aiConversations || []).filter((conv) => {
      if (!q) return true;
      return (
        conv.title.toLowerCase().includes(q) ||
        conv.messages.some((m) => m.text.toLowerCase().includes(q))
      );
    });
    const groups: Array<{ group: string; items: typeof list }> = [];
    list.forEach((conv) => {
      const label = conv.dateLabel || "Récent";
      let g = groups.find((x) => x.group === label);
      if (!g) {
        g = { group: label, items: [] };
        groups.push(g);
      }
      g.items.push(conv);
    });
    return groups;
  }, [aiConversations, deferredHistorySearch]);

  // Image file picker handler for "+" button
  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        showToast("Veuillez sélectionner uniquement des images.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setPendingAttachedImages((prev) => [...prev, result]);
          showToast("Image importée avec succès");
        }
      };
      reader.readAsDataURL(file);
    });

    setIsPlusMenuOpen(false);
    // Reset file input value so same image can be reselected
    e.target.value = '';
  };

  const removePendingImage = (indexToRemove: number) => {
    setPendingAttachedImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Real RodiumAI chat via backend proxy + local catalog retrieval without charging unconfigured provider calls
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    const imagesAttached = [...pendingAttachedImages];

    if (!query && imagesAttached.length === 0) return;

    const queryWordCount = countWords(query);
    if (queryWordCount > GPT_CLIENT_MAX_WORDS) {
      showToast(
        `Message trop long : ${queryWordCount} mots utilisés sur un maximum de ${GPT_CLIENT_MAX_WORDS} mots.`
      );
      return;
    }

    if (!isAuthenticated) {
      const guestQuota = visitorService.canAskAi();
      if (!guestQuota.allowed) {
        openAuthModal('ai_quota', {
          initialMode: 'register',
          pendingAction: { type: 'ai_chat' }
        });
        return;
      }
    } else if (aiCredits < AI_BILLING_RATES.CHAT_QUESTION) {
      showToast(`Crédits IA insuffisants (${aiCredits}/${AI_BILLING_RATES.CHAT_QUESTION} crédits requis par question)`);
      openCreditModal('client');
      return;
    }

    const effectiveQuery = query || (imagesAttached.length > 0 ? "Trouve des articles similaires à cette image au marché d'Adjamé :" : "");
    const userMsgId = 'msg-user-' + Date.now();
    const newUserMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: effectiveQuery,
      attachedImages: imagesAttached.length > 0 ? imagesAttached : undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const previousMessages = messages;
    setMessages((prev) => [...prev, newUserMsg]);
    setInputText('');
    setPendingAttachedImages([]);
    setIsPlusMenuOpen(false);

    const qLower = (query || "mode tenue chaussure").toLowerCase();
    let matched = products.filter((p) => {
      const nameMatch = p.name.toLowerCase().includes(qLower);
      const descMatch = p.description.toLowerCase().includes(qLower);
      const catMatch = (p.category || '').toLowerCase().includes(qLower);
      const tagMatch = p.tags && p.tags.some((t) => t.toLowerCase().includes(qLower));

      const isShoeQuery = /basket|sneaker|chaussure|mocassin|soulier|talon/i.test(qLower);
      const isDressQuery = /robe|wax|habit|vetement|chemise|pantalon|tenue/i.test(qLower);
      const isTechQuery = /phone|smartphone|tech|ecouteur|iphone|samsung|audio/i.test(qLower);
      const isBeautyQuery = /parfum|beaute|cosmetique|soin|meche/i.test(qLower);
      const isPromoQuery = /promo|solde|reduction|remise|pas cher/i.test(qLower);

      if (isShoeQuery && /chaussure|basket|soulier|sandale/i.test(p.category + p.name)) return true;
      if (isDressQuery && /habit|vetement|robe|mode|wax/i.test(p.category + p.name + p.description)) return true;
      if (isTechQuery && /tech|electronique|audio|phone/i.test(p.category + p.name)) return true;
      if (isBeautyQuery && /beaute|parfum|cosmetique/i.test(p.category + p.name)) return true;
      if (isPromoQuery && (p.isPromotion || (p.discountPercentage && p.discountPercentage > 0))) return true;

      return nameMatch || descMatch || catMatch || tagMatch;
    });

    if (selectedBudget) {
      matched = matched.filter((p) => p.price <= selectedBudget);
    }
    matched = matched.slice(0, 6);

    const matchedS = sellers
      .filter((s) => s.name.toLowerCase().includes(qLower) || (s.bio && s.bio.toLowerCase().includes(qLower)))
      .slice(0, 2);

    const recentContext = previousMessages
      .slice(-6)
      .map((m) => `${m.sender === 'user' ? 'Client' : 'Assistant'}: ${m.text.slice(0, 160)}`)
      .join(' | ');

    const systemInstruction = `Tu es l’assistant shopping DJASSA (Abidjan, Côte d’Ivoire). ${
      recentContext ? `Contexte récent : ${recentContext}. ` : ''
    }Articles correspondants : ${
      matched.length > 0
        ? matched.map((p) => `${p.name} (${p.price} FCFA)`).join(', ')
        : 'Aucun article correspondant exact en rayon pour cette requête.'
    }`;

    let aiText = '';
    let aiThought = `Catalogue local DJASSA • ${matched.length} article(s)`;
    const modelToUse = currentModel === 'minimax-m3.1-flash' ? 'minimax-m3.1-flash' : 'minimax-h3-max-turbo';

    try {
      const res = await creditsService.chatWithAi(
        effectiveQuery,
        systemInstruction,
        imagesAttached.length > 0 ? imagesAttached : undefined,
        modelToUse
      );
      if (res.text) {
        aiText = enforceMaxWordsReply(res.text, GPT_CLIENT_MAX_WORDS);
        if (!isAuthenticated) {
          const updatedQuota = visitorService.recordGuestAiQuestion(res.guestQuota?.used);
          refreshVisitorQuota();
          aiThought = `Mode visiteur • ${updatedQuota.remaining}/${updatedQuota.limit} questions restantes aujourd'hui`;
        } else {
          spendAiCredits(AI_BILLING_RATES.CHAT_QUESTION, `Question IA : "${(query || 'Recherche par image').slice(0, 30)}..."`, 'chat');
          aiThought = `Modèle ${res.model} • ${matched.length} article(s) trouvés`;
        }
      }
    } catch (err: any) {
      if (!isAuthenticated && (err?.code === 'GUEST_AI_QUOTA_REACHED' || err?.status === 429)) {
        visitorService.markGuestAiExhausted();
        refreshVisitorQuota();
        setMessages(previousMessages);
        openAuthModal('ai_quota', {
          initialMode: 'register',
          pendingAction: { type: 'ai_chat' }
        });
        return;
      }
      aiText = `⚠️ ${err?.message || 'Service IA RodiumAI non configuré côté serveur.'}\n\n📦 **Résultats du catalogue local DJASSA (${matched.length} articles, aucun crédit débité) :**`;
    }

    const assistantMsg: ChatMessage = {
      id: 'msg-gpt-' + Date.now(),
      sender: 'assistant',
      text: aiText,
      thought: aiThought,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      matchedProducts: matched,
      matchedSellers: matchedS.length > 0 ? matchedS : undefined
    };

    const nextMessages = [...previousMessages, newUserMsg, assistantMsg];
    setMessages(nextMessages);

    if (getSecurityToken()) {
      const convId = activeAiConversationId || `ai-conv-${Date.now()}`;
      const title =
        aiConversations.find((c) => c.id === activeAiConversationId)?.title ||
        (query || 'Recherche par image').slice(0, 48);
      const saved = await saveAiConversation({
        id: convId,
        title,
        dateLabel: "Aujourd'hui",
        messages: nextMessages.map((m) => ({
          id: m.id,
          sender: m.sender === 'user' ? 'user' : 'ai',
          text: m.text,
          attachedImages: m.attachedImages,
          products: m.matchedProducts?.map((p) => ({ id: p.id, name: p.name, price: p.price })),
          timestamp: m.timestamp
        }))
      });
      if (saved?.id) setActiveAiConversationId(saved.id);
    } else {
      visitorService.saveGuestAiConversation(
        (query || 'Discussion visiteur').slice(0, 48),
        nextMessages.map((m) => ({
          id: m.id,
          sender: m.sender,
          text: m.text,
          timestamp: m.timestamp,
          attachedImages: m.attachedImages,
          matchedProductIds: m.matchedProducts?.map((p) => p.id),
          matchedSellerIds: m.matchedSellers?.map((s) => s.id),
          thought: m.thought
        }))
      );
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedMessageId(id);
    showToast("Message copié dans le presse-papiers");
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleResetChat = () => {
    setActiveAiConversationId(null);
    setMessages([]);
    setInputText('');
    if (!isAuthenticated) {
      visitorService.clearGuestAiConversation();
    }
    setIsSidebarOpen(false);
  };

  const handleLoadSavedConversation = (conv: (typeof aiConversations)[number]) => {
    setActiveAiConversationId(conv.id);
    setMessages(
      (conv.messages || []).map((m) => {
        const productIds = new Set((m.products || []).map((x: any) => String(x.id || '')));
        const restoredProducts = productIds.size > 0 ? products.filter((p) => productIds.has(p.id)) : [];
        return {
          id: m.id,
          sender: m.sender === 'user' ? 'user' : 'assistant',
          text: m.text,
          attachedImages: m.attachedImages,
          matchedProducts: restoredProducts,
          timestamp: m.timestamp
        };
      })
    );
    setIsSidebarOpen(false);
  };

  const handleCardClick = (product: Product) => {
    navigateToFeedProduct(product.id);
  };

  return (
    <div 
      id="gpt-home-screen" 
      className="relative w-full h-full flex flex-col bg-[#212121] text-[#ECECEC] overflow-hidden"
    >
      {/* =========================================================================
          1. TOP APP BAR (EXACT CHATGPT MOBILE / WEB HEADER)
          ========================================================================= */}
      <header 
        id="gpt-top-app-bar"
        className="sticky top-0 z-30 flex items-center justify-between px-3.5 py-2.5 pt-safe bg-[#212121]/95 backdrop-blur-md border-b border-white/[0.06]"
      >
        {/* Left: Sidebar Hamburger Button */}
        <button
          id="btn-gpt-drawer-toggle"
          onClick={() => setIsSidebarOpen(true)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition"
          title="Ouvrir le menu latéral"
        >
          <Menu className="w-5 h-5 stroke-[2.2]" />
        </button>

        {/* Center: Model Selector Dropdown Pill */}
        <div className="relative">
          <button
            id="btn-gpt-model-dropdown"
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-semibold text-white/90 hover:text-white hover:bg-white/[0.08] active:scale-95 transition"
          >
            <span>
              {currentModel === 'minimax-h3-max-turbo' ? 'MiniMax H3 Max Turbo' : currentModel === 'minimax-m3.1-flash' ? 'MiniMax M3.1 Flash' : 'Catalogue Adjamé'}
            </span>
            <ChevronDown className="w-4 h-4 text-white/60 ml-0.5" />
          </button>

          {/* Model Switcher Popover Menu (RodiumAI) */}
          {isModelDropdownOpen && (
            <div 
              className="absolute left-1/2 -translate-x-1/2 top-11 w-64 p-1.5 rounded-2xl bg-[#2F2F2F] border border-white/10 shadow-2xl z-50 animate-fadeIn"
              onClick={() => setIsModelDropdownOpen(false)}
            >
              <button
                onClick={() => setCurrentModel('minimax-h3-max-turbo')}
                className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition ${
                  currentModel === 'minimax-h3-max-turbo' ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-[#FF6321] text-white flex items-center justify-center shrink-0">
                  <ChatGptLogo className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">MiniMax H3 Max Turbo</span>
                    {currentModel === 'minimax-h3-max-turbo' && <Check className="w-3.5 h-3.5 text-[#FF6321]" />}
                  </div>
                  <p className="text-[10px] text-white/60 leading-tight mt-0.5">
                    RodiumAI — Le modèle conversationnel avancé pour vos achats & pépites
                  </p>
                </div>
              </button>

              <button
                onClick={() => setCurrentModel('minimax-m3.1-flash')}
                className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition mt-1 ${
                  currentModel === 'minimax-m3.1-flash' ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-teal-500 text-white flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">MiniMax M3.1 Flash</span>
                    {currentModel === 'minimax-m3.1-flash' && <Check className="w-3.5 h-3.5 text-teal-400" />}
                  </div>
                  <p className="text-[10px] text-white/60 leading-tight mt-0.5">
                    RodiumAI — Analyse rapide & filtres précis
                  </p>
                </div>
              </button>

              <div className="h-px bg-white/10 my-1.5" />

              <button
                onClick={() => setCurrentModel('catalog')}
                className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition ${
                  currentModel === 'catalog' ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-purple-500 text-white flex items-center justify-center shrink-0">
                  <LayoutGrid className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Mode Catalogue</span>
                    {currentModel === 'catalog' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                  </div>
                  <p className="text-[10px] text-white/60 leading-tight mt-0.5">
                    Vue classique par rayons & stories
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Right: Credits Badge (or Visitor Free Quota Badge) & New Chat Button */}
        <div className="flex items-center gap-1.5">
          {isAuthenticated ? (
            <button
              id="btn-kling-credits-explorer"
              onClick={() => openCreditModal('client')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-amber-400/40 text-amber-300 font-extrabold text-xs shadow-md transition active:scale-95 group cursor-pointer"
              title="Voir les offres et gérer vos crédits IA RodiumAI"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform" />
              <span>{aiCredits}</span>
              <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 ml-0.5">
                {userPlan === 'plus'
                  ? 'Plus'
                  : userPlan === 'mini' || userPlan === 'go'
                  ? 'Mini'
                  : userPlan === 'premium' || userPlan === 'pro'
                  ? 'Premium'
                  : userPlan === 'gratuit'
                  ? 'Gratuit'
                  : 'Offres'}
              </span>
            </button>
          ) : (
            <button
              id="btn-visitor-ai-quota"
              onClick={() => openAuthModal('ai_quota', { initialMode: 'register', pendingAction: { type: 'ai_chat' } })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-extrabold text-xs shadow-md transition active:scale-95 cursor-pointer ${
                visitorQuota.ai.remaining === 0
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  : 'bg-white/10 hover:bg-white/15 border-amber-400/40 text-amber-300'
              }`}
              title={`Questions IA gratuites restantes aujourd'hui : ${visitorQuota.ai.remaining}/${VISITOR_QUOTAS.dailyAiQuestions}`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {visitorQuota.ai.remaining}/{visitorQuota.ai.limit} gratuit
              </span>
            </button>
          )}

          <button
            id="btn-gpt-new-chat"
            onClick={handleResetChat}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition"
            title="Nouvelle discussion"
          >
            <SquarePen className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>
      </header>

      {/* =========================================================================
          2. SIDEBAR DRAWER (CHATGPT STYLE RECENT DISCUSSIONS & PROFILE)
          ========================================================================= */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        >
          <div 
            className="w-72 max-w-[85vw] h-full bg-[#171717] border-r border-white/10 flex flex-col p-3 shadow-2xl animate-slideRight"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top row */}
            <div className="flex items-center justify-between pb-3 pt-safe">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white/10 text-white flex items-center justify-center">
                  <ChatGptLogo className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-white">Assistant RodiumAI</span>
              </div>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="w-8 h-8 rounded-lg text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* New Chat Button */}
            <button
              onClick={() => {
                handleResetChat();
                setIsSidebarOpen(false);
              }}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.07] hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition active:scale-95"
            >
              <Plus className="w-4 h-4 text-[#FF6321]" />
              <span>Nouvelle discussion</span>
            </button>

            {/* Search chats */}
            <div className="relative mt-2.5 mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Rechercher des discussions..."
                className="w-full pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-white/20"
              />
            </div>

            {/* History List */}
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 py-2">
              {groupedAiConversations.length === 0 ? (
                <div className="px-2 py-6 text-center text-xs text-white/45 space-y-1">
                  <MessageSquare className="w-5 h-5 mx-auto text-white/25" />
                  <p>{historySearch ? 'Aucune discussion correspondante.' : 'Aucune discussion enregistrée.'}</p>
                </div>
              ) : (
                groupedAiConversations.map((group) => (
                  <div key={group.group} className="space-y-1">
                    <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider px-2">
                      {group.group}
                    </span>
                    {group.items.map((conv) => (
                      <div
                        key={conv.id}
                        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs transition ${
                          activeAiConversationId === conv.id
                            ? 'bg-white/12 text-white'
                            : 'text-white/80 hover:text-white hover:bg-white/[0.07]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleLoadSavedConversation(conv)}
                          className="flex-1 min-w-0 flex items-center gap-2 text-left truncate"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-white/40 shrink-0" />
                          <span className="truncate">{conv.title}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void deleteAiConversation(conv.id);
                            if (activeAiConversationId === conv.id) {
                              setActiveAiConversationId(null);
                              setMessages([]);
                            }
                          }}
                          aria-label="Supprimer la discussion"
                          className="p-1 rounded-lg text-white/35 hover:text-rose-400 hover:bg-rose-500/10 shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>

            {/* Bottom User Profile Section */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between pb-safe">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={userProfile?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                  alt="Profile"
                  className="w-8 h-8 rounded-full object-cover border border-white/20 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{userProfile?.name || 'Acheteur VIP'}</p>
                  <p className="text-[10px] text-emerald-400 font-medium">RodiumAI Shopping</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          3. MAIN VIEW (CENTER EMPTY STATE OR SCROLLABLE CHAT FEED)
          ========================================================================= */}
      <main className="flex-1 overflow-y-auto no-scrollbar relative flex flex-col pb-36">
        {messages.length === 0 ? (
          /* -------------------------------------------------------------------
             EMPTY / PRISTINE HOME STATE (THE ICONIC CHATGPT GREETING & CARDS)
             ------------------------------------------------------------------- */
          <div className="flex-1 flex flex-col items-center justify-center px-4 max-w-xl mx-auto w-full my-auto py-8">
            {/* Iconic ChatGPT Circular Emblem */}
            <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-2xl shadow-white/10 mb-4 animate-scaleIn">
              <ChatGptLogo className="w-8 h-8" />
            </div>

            {/* Clean greeting */}
            <h1 className="text-2xl font-semibold text-white tracking-tight text-center mb-8">
              En quoi puis-je vous aider ?
            </h1>

            {/* 4 Suggestion Prompt Cards */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SUGGESTED_PROMPTS.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleSendMessage(prompt.query)}
                  className="group flex flex-col text-left p-3.5 rounded-2xl bg-[#2F2F2F]/80 hover:bg-[#383838] border border-white/[0.08] hover:border-white/20 transition-all duration-200 active:scale-[0.98] shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base">{prompt.emoji}</span>
                    <span className="text-xs font-semibold text-white/90 group-hover:text-white">
                      {prompt.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/50 group-hover:text-white/70 line-clamp-2 leading-relaxed">
                    {prompt.subtitle}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* -------------------------------------------------------------------
             ACTIVE CHAT FEED (STREAM WITH RICH INTERACTIVE PRODUCT CARDS)
             ------------------------------------------------------------------- */
          <div className="w-full max-w-2xl mx-auto px-4 py-4 space-y-6">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                {/* User Message Bubble */}
                {msg.sender === 'user' ? (
                  <div className="max-w-[85%] bg-[#2F2F2F] text-white px-4 py-2.5 rounded-3xl text-sm leading-relaxed border border-white/5 shadow-md space-y-2">
                    {msg.attachedImages && msg.attachedImages.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {msg.attachedImages.map((img, idx) => (
                          <img
                            key={idx}
                            src={img}
                            alt="Image importée"
                            className="w-24 h-24 object-cover rounded-2xl border border-white/20 shadow-sm"
                          />
                        ))}
                      </div>
                    )}
                    {msg.text && <p>{msg.text}</p>}
                  </div>
                ) : (
                  /* Assistant Message Bubble */
                  <div className="w-full flex items-start gap-3">
                    {/* ChatGPT Mini Avatar */}
                    <div className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center shrink-0 mt-0.5 shadow-md">
                      <ChatGptLogo className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Thought banner if applicable */}
                      {msg.thought && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-white/60">
                          <Sparkles className="w-3 h-3 text-[#FF6321]" />
                          <span>{msg.thought}</span>
                        </div>
                      )}

                      {/* Text */}
                      <div className="text-sm text-white/90 leading-relaxed whitespace-pre-line">
                        {msg.text}
                      </div>

                      {/* Embedded Product Cards Grid or Honest Empty Result */}
                      {msg.matchedProducts && msg.matchedProducts.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2.5 pt-1">
                          {msg.matchedProducts.map((p) => {
                            const seller = sellersById.get(p.sellerId);
                            const imgUrl = (p.images && p.images[0]) || p.videoPoster || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80';
                            const outOfStock = (p.stock ?? 0) <= 0;

                            return (
                              <div
                                key={p.id}
                                onClick={() => handleCardClick(p)}
                                className="group relative rounded-2xl bg-[#1C1C1E] border border-white/10 overflow-hidden cursor-pointer hover:border-[#FF6321]/50 transition-all hover:scale-[1.01] shadow-lg flex flex-col"
                              >
                                {/* Media Thumbnail */}
                                <div className="relative aspect-square w-full bg-neutral-900 overflow-hidden">
                                  <img
                                    src={imgUrl}
                                    alt={p.name}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                  />
                                  {p.mediaType === 'video' && (
                                    <div className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur-md text-white">
                                      <Play className="w-3 h-3 fill-white" />
                                    </div>
                                  )}
                                  {Boolean(p.discountPercentage && p.discountPercentage > 0) && (
                                    <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-[#FF6321] text-[10px] font-black text-white shadow">
                                      -{p.discountPercentage}%
                                    </span>
                                  )}
                                </div>

                                {/* Content */}
                                <div className="p-2.5 flex-1 flex flex-col justify-between">
                                  <div>
                                    <h3 className="text-xs font-bold text-white truncate group-hover:text-[#FF6321] transition">
                                      {p.name}
                                    </h3>
                                    <p className="text-[10px] text-white/50 truncate mt-0.5">
                                      {seller?.name || 'Commerçant Adjamé'}
                                    </p>
                                  </div>

                                  <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                                    <span className="text-xs font-black text-[#FF6321]">
                                      {formatFCFA(p.price)}
                                    </span>
                                    <button
                                      disabled={outOfStock}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (outOfStock) return;
                                        if (!requireAuth('purchase', { type: 'buy_direct', product: p })) return;
                                        setVariantModalProduct(p);
                                        setIsVariantModalDirectBuy(true);
                                      }}
                                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                                        outOfStock
                                          ? 'bg-white/10 text-white/40 cursor-not-allowed'
                                          : 'bg-[#FF6321] hover:bg-[#ff753a] text-white shadow-md shadow-orange-600/20 active:scale-95'
                                      }`}
                                    >
                                      {outOfStock ? 'Épuisé' : 'Acheter'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : msg.matchedProducts && msg.matchedProducts.length === 0 ? (
                        <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 text-xs text-white/60">
                          Aucun article correspondant trouvé dans le catalogue pour cette recherche. Essayez un autre mot-clé ou explorez le mode Catalogue.
                        </div>
                      ) : null}

                      {/* Action Bar (Copy, Thumbs Up, Regenerate) */}
                      <div className="flex items-center gap-3 pt-1 text-white/40">
                        <button
                          onClick={() => handleCopyMessage(msg.id, msg.text)}
                          className="hover:text-white p-1 rounded-md hover:bg-white/5 transition"
                          title="Copier le message"
                        >
                          {copiedMessageId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button 
                          onClick={() => showToast("Merci pour votre retour !")}
                          className="hover:text-white p-1 rounded-md hover:bg-white/5 transition"
                          title="Bonne réponse"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => showToast("Retour enregistré")}
                          className="hover:text-white p-1 rounded-md hover:bg-white/5 transition"
                          title="Mauvaise réponse"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleSendMessage(messages[messages.length - 2]?.text || "Rechercher")}
                          className="hover:text-white p-1 rounded-md hover:bg-white/5 transition"
                          title="Régénérer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* =========================================================================
          4. SIGNATURE CHATGPT FLOATING BOTTOM INPUT BAR
          ========================================================================= */}
      <div 
        id="gpt-bottom-input-bar-container"
        className="fixed bottom-[60px] left-0 right-0 z-30 px-3 pb-1"
      >
        <div className="max-w-2xl mx-auto relative">
          {/* Hidden file input strictly for images */}
          <input
            ref={imageFileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageFileSelect}
          />

          {/* Pending attached images preview above the input pill */}
          {pendingAttachedImages.length > 0 && (
            <div className="mb-2 p-2 rounded-2xl bg-[#242424] border border-white/10 shadow-xl flex items-center gap-2 overflow-x-auto no-scrollbar">
              {pendingAttachedImages.map((img, idx) => (
                <div key={idx} className="relative group shrink-0">
                  <img
                    src={img}
                    alt={`Aperçu ${idx + 1}`}
                    className="w-14 h-14 object-cover rounded-xl border border-white/20 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removePendingImage(idx)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-md text-xs font-bold transition active:scale-90"
                    title="Supprimer cette image"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => imageFileInputRef.current?.click()}
                className="w-14 h-14 rounded-xl border-2 border-dashed border-white/20 hover:border-[#FF6321] text-white/50 hover:text-white flex flex-col items-center justify-center gap-1 transition text-[10px] shrink-0"
                title="Ajouter d'autres images"
              >
                <Plus className="w-4 h-4 text-[#FF6321]" />
                <span>Ajouter</span>
              </button>
            </div>
          )}

          {/* Plus button attachment menu sheet: Exclusively for Importing Images */}
          {isPlusMenuOpen && (
            <div className="absolute bottom-14 left-2 w-72 p-3 rounded-2xl bg-[#262626] border border-white/15 shadow-2xl z-50 animate-fadeIn space-y-2.5 backdrop-blur-xl">
              <div className="flex items-center justify-between pb-1 border-b border-white/10">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-[#FF6321]" />
                  <span>Importer des images</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsPlusMenuOpen(false)}
                  className="w-5 h-5 rounded-full hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-[11px] text-white/60 leading-snug">
                Sélectionnez une ou plusieurs photos depuis votre appareil (JPG, PNG, WEBP) pour rechercher des articles ou analyser des tenues.
              </p>

              {/* Action: Open file browser directly */}
              <button
                type="button"
                onClick={() => {
                  imageFileInputRef.current?.click();
                  setIsPlusMenuOpen(false);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-[#FF6321] hover:bg-[#ff753a] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition active:scale-95 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Choisir des images sur l'appareil</span>
              </button>
            </div>
          )}

          {/* Floating Pill Input Box */}
          <div className="w-full flex items-center gap-2 p-1.5 pl-3 rounded-full bg-[#2F2F2F] border border-white/[0.12] shadow-2xl backdrop-blur-xl transition-all focus-within:border-white/30">
            {/* Plus / Add Action Button: Open Image Importer */}
            <button
              id="btn-gpt-input-plus"
              type="button"
              onClick={() => {
                // If user clicks plus, directly trigger image picker or menu
                if (imageFileInputRef.current) {
                  imageFileInputRef.current.click();
                } else {
                  setIsPlusMenuOpen(!isPlusMenuOpen);
                }
              }}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 hover:text-white flex items-center justify-center transition shrink-0 cursor-pointer"
              title="Importer des images"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Vocal Recording Active UI vs Standard Input */}
            {isRecordingVocal ? (
              <div className="flex-1 flex items-center justify-between gap-2 px-1 min-w-0 animate-fadeIn">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative flex items-center justify-center shrink-0">
                    <span className="w-3 h-3 rounded-full bg-red-500 animate-ping absolute" />
                    <span className="w-3 h-3 rounded-full bg-red-500 relative" />
                  </div>

                  <span className="text-xs font-mono font-bold text-red-400 shrink-0">
                    {Math.floor(vocalSeconds / 60)}:{(vocalSeconds % 60).toString().padStart(2, '0')}
                  </span>

                  {/* Sound Wave Animation */}
                  <div className="flex items-center gap-0.5 h-4 shrink-0">
                    <span className="w-1 bg-[#FF6321] rounded-full animate-pulse h-3" />
                    <span className="w-1 bg-[#FF6321] rounded-full animate-bounce h-5" />
                    <span className="w-1 bg-[#FF6321] rounded-full animate-pulse h-2" />
                    <span className="w-1 bg-[#FF6321] rounded-full animate-bounce h-4" />
                    <span className="w-1 bg-[#FF6321] rounded-full animate-pulse h-3" />
                  </div>

                  {/* Transcript live preview */}
                  <span className="text-xs text-white/90 truncate italic font-medium">
                    {vocalTranscript ? `« ${vocalTranscript} »` : "Enregistrement vocal en cours... Parlez..."}
                  </span>
                </div>

                {/* Cancel and Send Vocal buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => stopVocalRecording(false)}
                    className="p-1.5 rounded-full bg-white/10 hover:bg-rose-500/20 text-white/60 hover:text-rose-400 transition cursor-pointer"
                    title="Annuler le message vocal"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => stopVocalRecording(true)}
                    className="px-3 py-1.5 rounded-full bg-[#FF6321] hover:bg-[#ff7538] text-white font-extrabold text-xs flex items-center gap-1 shadow-lg shadow-orange-600/30 active:scale-95 transition cursor-pointer"
                    title="Envoyer le message vocal"
                  >
                    <span>Envoyer</span>
                    <ArrowUp className="w-3.5 h-3.5 stroke-[3]" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Input Field */}
                <input
                  ref={inputRef}
                  id="input-gpt-prompt"
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={
                    pendingAttachedImages.length > 0
                      ? 'Posez une question sur ces images...'
                      : !isAuthenticated
                      ? visitorQuota.ai.remaining === 0
                        ? 'Limite gratuite atteinte (0/5) • Connectez-vous pour continuer'
                        : `Posez votre question (${visitorQuota.ai.remaining}/${visitorQuota.ai.limit} gratuites aujourd'hui)...`
                      : `Message RodiumAI... (${AI_BILLING_RATES.CHAT_QUESTION} crédits/question)`
                  }
                  className="flex-1 bg-transparent border-none text-sm text-white placeholder-white/40 focus:outline-none focus:ring-0 min-w-0"
                />

                {/* Right Action Button */}
                {(inputText.trim().length > 0 || pendingAttachedImages.length > 0) && (
                  /* Solid Circular Send Button */
                  <button
                    id="btn-gpt-send"
                    type="button"
                    disabled={isPromptTooLong}
                    onClick={() => handleSendMessage()}
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition shadow-md ${
                      isPromptTooLong
                        ? 'bg-rose-500/30 text-rose-200 cursor-not-allowed'
                        : 'bg-white text-black hover:bg-white/90 active:scale-95 cursor-pointer'
                    }`}
                    title={
                      isPromptTooLong
                        ? `Maximum ${GPT_CLIENT_MAX_WORDS} mots autorisés`
                        : 'Envoyer le message'
                    }
                  >
                    <ArrowUp className="w-4 h-4 stroke-[3]" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Real-time 30-word counter & strict client warning */}
          {!isRecordingVocal && (
            <div className="px-3 pt-1 flex items-center justify-between gap-2 text-[10px]">
              {isPromptTooLong ? (
                <span
                  id="gpt-word-limit-warning"
                  role="alert"
                  className="text-rose-400 font-bold truncate"
                >
                  Limite dépassée : {promptWordCount} mots utilisés sur {GPT_CLIENT_MAX_WORDS} max.
                </span>
              ) : (
                <span className="text-white/40 truncate">
                  Questions courtes : {GPT_CLIENT_MAX_WORDS} mots maximum par message
                </span>
              )}
              <span
                id="gpt-word-counter"
                className={`font-extrabold tabular-nums shrink-0 ${
                  isPromptTooLong
                    ? 'text-rose-400'
                    : promptWordCount >= 25
                    ? 'text-amber-400'
                    : 'text-white/55'
                }`}
              >
                {promptWordCount}/{GPT_CLIENT_MAX_WORDS} mots
              </span>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          5. RODIUMAI REALTIME VOICE MODE (AUDIO BIDIRECTIONAL)
          ========================================================================= */}
      {isVoiceModeOpen && (
        <Suspense fallback={null}>
          <RealtimeVoiceModal
            isOpen={isVoiceModeOpen}
            onClose={() => setIsVoiceModeOpen(false)}
            onUserSpokeText={(spokenText) => {
              handleSendMessage(spokenText);
            }}
          />
        </Suspense>
      )}

      {/* =========================================================================
          6. CLASSIC CATALOG GRID FALLBACK (IF USER SELECTS "MODE CATALOGUE")
          ========================================================================= */}
      {currentModel === 'catalog' && (
        <div className="fixed inset-0 z-40 bg-[#0B0B0C] flex flex-col overflow-y-auto no-scrollbar pb-32 pt-safe">
          {/* Header to return back to RodiumAI Mode */}
          <div className="p-3 bg-neutral-900 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Mode Catalogue Complet</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF6321]/20 text-[#FF6321] font-bold">
                {products.length} articles
              </span>
            </div>
            <button
              onClick={() => setCurrentModel('minimax-h3-max-turbo')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FF6321] text-white text-xs font-bold shadow-md hover:bg-[#ff753a] transition active:scale-95"
            >
              <ChatGptLogo className="w-3.5 h-3.5" />
              <span>Retour Assistant IA</span>
            </button>
          </div>

          {/* Catalog grid */}
          <div className="p-3 grid grid-cols-2 gap-3">
            {products.map((p) => {
              const imgUrl = (p.images && p.images[0]) || p.videoPoster || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80';
              return (
                <div
                  key={p.id}
                  onClick={() => handleCardClick(p)}
                  className="rounded-2xl bg-neutral-900 border border-white/10 overflow-hidden flex flex-col"
                >
                  <img
                    src={imgUrl}
                    alt={p.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full aspect-square object-cover"
                  />
                  <div className="p-2.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white truncate">{p.name}</h4>
                      <p className="text-[10px] text-white/50">{p.category}</p>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs font-black text-[#FF6321]">{formatFCFA(p.price)}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!requireAuth('purchase', { type: 'buy_direct', product: p })) return;
                          setVariantModalProduct(p);
                          setIsVariantModalDirectBuy(true);
                        }}
                        className="px-2 py-1 rounded-lg bg-[#FF6321] text-white text-[10px] font-bold"
                      >
                        Acheter
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
