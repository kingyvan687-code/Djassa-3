import React, { useState, useRef, useEffect } from 'react';
import { 
  Menu, 
  SquarePen, 
  Plus, 
  ArrowUp, 
  ChevronDown, 
  Sparkles, 
  Check, 
  Copy, 
  Trash2, 
  X, 
  Search, 
  Headphones,
  LayoutGrid,
  Store,
  Tag,
  Package,
  TrendingUp,
  DollarSign,
  MessageCircle,
  Image as ImageIcon,
  Upload,
  ShoppingBag,
  ExternalLink
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { formatFCFA, formatMetricCount } from '../../../services/marketServices';
import { AI_BILLING_RATES } from '../../../services/aiPricing';
import { creditsService } from '../../../services/creditsService';
import { getSecurityToken } from '../../../services/securityService';
import { Product, Seller } from '../../../types';
import { RealtimeVoiceModal } from '../../explorer/RealtimeVoiceModal';

// The Iconic ChatGPT Emblem SVG (Same as client app)
export const ChatGptLogo: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
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
  attachedProduct?: Product;
  thought?: string;
  suggestedActions?: { label: string; action: () => void }[];
}

interface SellerChatGptScreenProps {
  seller: Seller;
  products: Product[];
}

export const SellerChatGptScreen: React.FC<SellerChatGptScreenProps> = ({
  seller,
  products
}) => {
  const { 
    aiCredits, 
    userPlan, 
    spendAiCredits, 
    setIsCreditModalOpen, 
    openCreditModal,
    showToast,
    setSellerActiveTab,
    setSelectedProduct
  } = useApp();

  // Model & UI states (RodiumAI)
  const [currentModel, setCurrentModel] = useState<'minimax-h3-max-turbo' | 'minimax-m3.1-flash' | 'minimax-h3'>('minimax-h3-max-turbo');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [isVoiceModeOpen, setIsVoiceModeOpen] = useState(false);

  // Chat conversation state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [pendingAttachedImages, setPendingAttachedImages] = useState<string[]>([]);
  const [pendingAttachedProduct, setPendingAttachedProduct] = useState<Product | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Suggested prompt cards tailored for sellers (Exact user requirements)
  const SELLER_PROMPT_CARDS = [
    {
      emoji: '💰',
      title: '« Combien ai-je réellement gagné cette semaine ? »',
      subtitle: 'Calcul du bénéfice net réel, déduction des charges & livraisons',
      query: 'Combien ai-je réellement gagné cette semaine ?'
    },
    {
      emoji: '🏆',
      title: '« Quel produit me rapporte le plus ? »',
      subtitle: 'Classement de vos articles les plus rentables & meilleures marges',
      query: 'Quel produit me rapporte le plus ?'
    },
    {
      emoji: '⚠️',
      title: '« Pourquoi les clients se plaignent-ils ? »',
      subtitle: 'Analyse des retours, délais de livraison, tailles et contestations',
      query: 'Pourquoi les clients se plaignent-ils ?'
    },
    {
      emoji: '🚀',
      title: '« Que dois-je faire demain pour vendre davantage ? »',
      subtitle: 'Plan d\'action concret et immédiat pour doper vos ventes dès demain',
      query: 'Que dois-je faire demain pour vendre davantage ?'
    }
  ];

  // Past chats history for seller sidebar
  const PAST_CHATS = [
    { id: '1', title: 'Idées de promotions fin de mois', date: 'Aujourd\'hui' },
    { id: '2', title: 'Calcul marge robe soirée Bazin', date: 'Hier' },
    { id: '3', title: 'Script négociation grossiste chaussures', date: '7 derniers jours' },
    { id: '4', title: 'Post TikTok viral pour boutique', date: '7 derniers jours' },
    { id: '5', title: 'Optimisation stock & approvisionnement', date: '30 derniers jours' }
  ];

  // Handle image attachment from file system
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
          showToast("Image importée dans l'Assistant IA Vendeur 📸");
        }
      };
      reader.readAsDataURL(file);
    });

    setIsPlusMenuOpen(false);
    e.target.value = '';
  };

  const removePendingImage = (indexToRemove: number) => {
    setPendingAttachedImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Send message to RodiumAI Seller Assistant via real backend proxy
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    const imagesAttached = [...pendingAttachedImages];
    const productAttached = pendingAttachedProduct;

    if (!query && imagesAttached.length === 0 && !productAttached) return;

    if (aiCredits < AI_BILLING_RATES.CHAT_QUESTION) {
      showToast(`Crédits IA insuffisants (${aiCredits}/${AI_BILLING_RATES.CHAT_QUESTION} crédits requis par question)`);
      openCreditModal('seller');
      return;
    }

    const effectivePrompt =
      query ||
      (productAttached
        ? `Comment puis-je maximiser les ventes de cet article : "${productAttached.name}" ?`
        : 'Analyse cette photo pour ma boutique :');

    const userMsgId = 'msg-user-' + Date.now();
    const newUserMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: effectivePrompt,
      attachedImages: imagesAttached.length > 0 ? imagesAttached : undefined,
      attachedProduct: productAttached || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setInputText('');
    setPendingAttachedImages([]);
    setPendingAttachedProduct(null);
    setIsPlusMenuOpen(false);

    if (!getSecurityToken()) {
      showToast('Connectez-vous à votre compte vendeur pour interroger l’assistant IA.');
      return;
    }

    try {
      const res = await creditsService.chatWithAi(
        effectivePrompt,
        `Tu es l’assistant e-commerce DJASSA de la boutique ${seller.name} (Adjamé, Côte d’Ivoire). Produits disponibles : ${products.slice(0, 6).map((p) => `${p.name} (${formatFCFA(p.price)})`).join(', ')}.`,
        imagesAttached.length > 0 ? imagesAttached : undefined,
        currentModel
      );
      spendAiCredits(
        AI_BILLING_RATES.CHAT_QUESTION,
        `Question Vendeur RodiumAI : "${(query || 'Analyse de produit').slice(0, 30)}..."`,
        'chat'
      );
      setMessages((prev) => [
        ...prev,
        {
          id: 'msg-gpt-' + Date.now(),
          sender: 'assistant',
          text: res.text,
          thought: `Modèle ${res.model} • Assistant Boutique ${seller.name}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err: any) {
      const msg = err?.message || 'Service IA non configuré côté serveur.';
      showToast(`${msg} Aucun crédit débité.`);
      setMessages((prev) => [
        ...prev,
        {
          id: 'msg-gpt-err-' + Date.now(),
          sender: 'assistant',
          text: `⚠️ ${msg}\n\nAucun crédit n'a été débité de votre compte.`,
          thought: 'Fournisseur IA non disponible',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedMessageId(id);
    showToast("Message copié dans le presse-papiers");
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleResetChat = () => {
    setMessages([]);
    setInputText('');
    setPendingAttachedProduct(null);
    setPendingAttachedImages([]);
    setIsSidebarOpen(false);
    showToast("Nouvelle discussion RodiumAI Vendeur démarrée");
  };

  return (
    <div 
      id="gpt-seller-screen" 
      className="relative w-full h-full flex flex-col bg-[#212121] text-[#ECECEC] overflow-hidden select-none"
    >
      {/* =========================================================================
          1. TOP APP BAR (EXACT CHATGPT MOBILE / WEB HEADER)
          ========================================================================= */}
      <header 
        id="gpt-seller-top-app-bar"
        className="sticky top-0 z-30 flex items-center justify-between px-3.5 py-2.5 pt-safe bg-[#212121]/95 backdrop-blur-md border-b border-white/[0.06]"
      >
        {/* Left: Sidebar Hamburger Button */}
        <button
          id="btn-gpt-seller-drawer-toggle"
          onClick={() => setIsSidebarOpen(true)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition cursor-pointer"
          title="Ouvrir le menu latéral"
        >
          <Menu className="w-5 h-5 stroke-[2.2]" />
        </button>

        {/* Center: Model Selector Dropdown Pill */}
        <div className="relative">
          <button
            id="btn-gpt-seller-model-dropdown"
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold text-white/90 hover:text-white hover:bg-white/[0.08] active:scale-95 transition cursor-pointer"
          >
            <div className="w-4 h-4 rounded-full bg-[#10A37F] flex items-center justify-center text-white shrink-0">
              <ChatGptLogo className="w-2.5 h-2.5" />
            </div>
            <span>
              {currentModel === 'minimax-h3-max-turbo' ? 'MiniMax H3 Max Turbo' : currentModel === 'minimax-m3.1-flash' ? 'MiniMax M3.1 Flash' : 'MiniMax H3 Boutique'}
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
                className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition cursor-pointer ${
                  currentModel === 'minimax-h3-max-turbo' ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-[#10A37F] text-white flex items-center justify-center shrink-0">
                  <ChatGptLogo className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">MiniMax H3 Max Turbo</span>
                    {currentModel === 'minimax-h3-max-turbo' && <Check className="w-3.5 h-3.5 text-[#10A37F]" />}
                  </div>
                  <p className="text-[10px] text-white/60 leading-tight mt-0.5">
                    RodiumAI — Modèle conversationnel avancé pour la vente & la stratégie
                  </p>
                </div>
              </button>

              <button
                onClick={() => setCurrentModel('minimax-m3.1-flash')}
                className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition mt-1 cursor-pointer ${
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
                    RodiumAI — Analyse rapide & calculs de marges précis
                  </p>
                </div>
              </button>

              <div className="h-px bg-white/10 my-1.5" />

              <button
                onClick={() => setCurrentModel('minimax-h3')}
                className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition cursor-pointer ${
                  currentModel === 'minimax-h3' ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="w-7 h-7 rounded-lg bg-[#FF6321] text-white flex items-center justify-center shrink-0">
                  <Store className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">MiniMax H3 • Boutique</span>
                    {currentModel === 'minimax-h3' && <Check className="w-3.5 h-3.5 text-[#FF6321]" />}
                  </div>
                  <p className="text-[10px] text-white/60 leading-tight mt-0.5">
                    Assistant Boutique Adjamé spécialisé commerce local
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Right: Credits Badge & New Chat Button */}
        <div className="flex items-center gap-1.5">
          <button
            id="btn-kling-credits-seller-chatgpt"
            onClick={() => openCreditModal('seller')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-amber-400/40 text-amber-300 font-extrabold text-xs shadow-md transition active:scale-95 group cursor-pointer"
            title="Consulter et recharger vos crédits IA"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform" />
            <span>{aiCredits}</span>
            <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 ml-0.5">
              {userPlan === 'vendeur_pro' ? 'Pro Marché' : userPlan === 'vendeur_elite' ? 'Élite Studio' : userPlan === 'vendeur_starter' ? 'Starter' : userPlan === 'plus' ? 'Plus' : userPlan === 'go' ? 'Go' : userPlan === 'pro' ? 'Pro' : 'Offres'}
            </span>
          </button>

          <button
            id="btn-gpt-seller-new-chat"
            onClick={handleResetChat}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition cursor-pointer"
            title="Nouvelle discussion"
          >
            <SquarePen className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>
      </header>

      {/* =========================================================================
          2. SIDEBAR DRAWER (CHATGPT STYLE RECENT DISCUSSIONS & SELLER PROFILE)
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
            {/* Sidebar Top: New Chat & Close */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#10A37F] text-white flex items-center justify-center shadow">
                  <ChatGptLogo className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-sm font-bold text-white">RodiumAI Vendeur</span>
                  <p className="text-[10px] text-white/50">Assistant Commerce Pro</p>
                </div>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* New Chat Button */}
            <button
              onClick={handleResetChat}
              className="mt-3 w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-between transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <SquarePen className="w-4 h-4 text-emerald-400" />
                <span>Nouvelle discussion</span>
              </div>
              <span className="text-[10px] text-white/40">Ctrl + N</span>
            </button>

            {/* Past Chats Section */}
            <div className="flex-1 overflow-y-auto no-scrollbar py-4 space-y-4">
              <div>
                <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider px-2">
                  Historique récent
                </span>
                <div className="mt-2 space-y-1">
                  {PAST_CHATS.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => {
                        handleSendMessage(chat.title);
                        setIsSidebarOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-white/80 hover:text-white hover:bg-white/5 transition flex items-center justify-between group cursor-pointer"
                    >
                      <span className="truncate pr-2">{chat.title}</span>
                      <span className="text-[9px] text-white/40 shrink-0 font-mono">{chat.date}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar Bottom: Seller Profile info */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <img 
                  src={seller.avatar} 
                  alt={seller.name} 
                  className="w-8 h-8 rounded-full object-cover border border-white/15"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{seller.name}</p>
                  <p className="text-[10px] text-emerald-400 font-medium">RodiumAI Vendeur Pro</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsSidebarOpen(false);
                  setSellerActiveTab('profil');
                }}
                className="text-[10px] font-bold text-white/60 hover:text-white px-2 py-1 rounded-lg bg-white/5 cursor-pointer"
              >
                Gérer
              </button>
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
            <div className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-2xl shadow-white/10 mb-4 animate-scaleIn">
              <ChatGptLogo className="w-9 h-9" />
            </div>

            {/* Clean greeting tailored for seller */}
            <h1 className="text-2xl font-bold text-white tracking-tight text-center mb-1">
              Bonjour {seller.name}
            </h1>
            <p className="text-xs text-white/60 text-center mb-8">
              En quoi puis-je vous aider à développer votre boutique aujourd'hui ?
            </p>

            {/* 4 Suggestion Prompt Cards */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SELLER_PROMPT_CARDS.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleSendMessage(prompt.query)}
                  className="group flex flex-col text-left p-3.5 rounded-2xl bg-[#2F2F2F]/80 hover:bg-[#383838] border border-white/[0.08] hover:border-emerald-500/30 transition-all duration-200 active:scale-[0.98] shadow-sm cursor-pointer"
                >
                  <div className="flex items-start gap-2.5 mb-1">
                    <span className="text-base shrink-0 mt-0.5">{prompt.emoji}</span>
                    <span className="text-xs sm:text-[13px] font-semibold text-white/95 group-hover:text-white leading-snug">
                      {prompt.title}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/50 group-hover:text-white/75 line-clamp-2 leading-relaxed pl-6">
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
                    {/* Attached Images */}
                    {msg.attachedImages && msg.attachedImages.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {msg.attachedImages.map((img, idx) => (
                          <img
                            key={idx}
                            src={img}
                            alt="Image de stock"
                            className="w-24 h-24 object-cover rounded-2xl border border-white/20 shadow-sm"
                          />
                        ))}
                      </div>
                    )}

                    {/* Attached Product Card */}
                    {msg.attachedProduct && (
                      <div className="p-2 rounded-xl bg-black/40 border border-white/10 flex items-center gap-2 text-left">
                        <img 
                          src={msg.attachedProduct.images?.[0] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100'} 
                          alt="" 
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{msg.attachedProduct.name}</p>
                          <p className="text-[10px] text-[#FF6321] font-extrabold">{formatFCFA(msg.attachedProduct.price)}</p>
                        </div>
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
                          <Sparkles className="w-3 h-3 text-[#10A37F]" />
                          <span>{msg.thought}</span>
                        </div>
                      )}

                      {/* Text */}
                      <div className="text-sm text-white/90 leading-relaxed whitespace-pre-line bg-[#262626]/60 p-3.5 rounded-2xl border border-white/5 shadow-sm">
                        {msg.text}
                      </div>

                      {/* Action tools: Copy & Suggestion */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleCopyMessage(msg.id, msg.text)}
                          className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-semibold text-white/60 hover:text-white flex items-center gap-1 transition cursor-pointer"
                        >
                          {copiedMessageId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copié !</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copier</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>
        )}
      </main>

      {/* =========================================================================
          4. SIGNATURE CHATGPT FLOATING BOTTOM INPUT BAR
          ========================================================================= */}
      <div 
        id="gpt-seller-bottom-input-bar-container"
        className="fixed bottom-[64px] left-0 right-0 z-30 px-3 pb-1"
      >
        <div className="max-w-2xl mx-auto relative">
          {/* Hidden file input for images */}
          <input
            ref={imageFileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageFileSelect}
          />

          {/* Pending attached items preview above the input pill */}
          {(pendingAttachedImages.length > 0 || pendingAttachedProduct) && (
            <div className="mb-2 p-2 rounded-2xl bg-[#242424] border border-white/10 shadow-xl flex items-center gap-2 overflow-x-auto no-scrollbar">
              {pendingAttachedProduct && (
                <div className="relative group shrink-0 flex items-center gap-2 p-1.5 pr-3 rounded-xl bg-black/60 border border-white/20">
                  <img 
                    src={pendingAttachedProduct.images?.[0] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100'} 
                    alt="" 
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-white truncate max-w-[100px]">{pendingAttachedProduct.name}</p>
                    <p className="text-[9px] text-[#FF6321]">{formatFCFA(pendingAttachedProduct.price)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingAttachedProduct(null)}
                    className="w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px] ml-1 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              )}

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
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-md text-xs font-bold transition active:scale-90 cursor-pointer"
                    title="Supprimer cette image"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Plus Menu Popover */}
          {isPlusMenuOpen && (
            <div className="absolute bottom-14 left-2 w-72 p-3 rounded-2xl bg-[#262626] border border-white/15 shadow-2xl z-50 animate-fadeIn space-y-2.5 backdrop-blur-xl">
              <div className="flex items-center justify-between pb-1 border-b border-white/10">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#10A37F]" />
                  <span>Options de discussion</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsPlusMenuOpen(false)}
                  className="w-5 h-5 rounded-full hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center text-xs cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Action 1: Upload image from device */}
              <button
                type="button"
                onClick={() => {
                  imageFileInputRef.current?.click();
                  setIsPlusMenuOpen(false);
                }}
                className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-2.5 transition active:scale-95 cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                <div className="text-left">
                  <p className="text-xs font-bold">Importer photo de stock</p>
                  <p className="text-[10px] text-white/50">Pour description ou analyse visuelle</p>
                </div>
              </button>

              {/* Action 2: Select a product from boutique */}
              <button
                type="button"
                onClick={() => {
                  setIsPlusMenuOpen(false);
                  setIsProductPickerOpen(true);
                }}
                className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center gap-2.5 transition active:scale-95 cursor-pointer"
              >
                <Package className="w-4 h-4 text-[#FF6321]" />
                <div className="text-left">
                  <p className="text-xs font-bold">Choisir un article de ma boutique</p>
                  <p className="text-[10px] text-white/50">{products.length} articles disponibles</p>
                </div>
              </button>
            </div>
          )}

          {/* Floating Pill Input Box */}
          <div className="w-full flex items-center gap-2 p-1.5 pl-3 rounded-full bg-[#2F2F2F] border border-white/[0.12] shadow-2xl backdrop-blur-xl transition-all focus-within:border-white/30">
            {/* Plus / Add Action Button */}
            <button
              id="btn-gpt-seller-input-plus"
              type="button"
              onClick={() => setIsPlusMenuOpen(!isPlusMenuOpen)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 hover:text-white flex items-center justify-center transition shrink-0 cursor-pointer"
              title="Ajouter photo ou produit"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Input Field */}
            <input
              ref={inputRef}
              id="input-gpt-seller-prompt"
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={pendingAttachedProduct ? `Posez une question sur "${pendingAttachedProduct.name}"...` : pendingAttachedImages.length > 0 ? "Posez une question sur ces photos..." : `Message RodiumAI Vendeur... (${AI_BILLING_RATES.CHAT_QUESTION} crédits/q)`}
              className="flex-1 bg-transparent border-none text-sm text-white placeholder-white/40 focus:outline-none focus:ring-0 min-w-0"
            />

            {/* Right Action Buttons */}
            {(inputText.trim().length > 0 || pendingAttachedImages.length > 0 || pendingAttachedProduct) ? (
              /* Solid Circular White Send Button with Black Arrow */
              <button
                id="btn-gpt-seller-send"
                onClick={() => handleSendMessage()}
                className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shrink-0 hover:bg-white/90 active:scale-95 transition shadow-md cursor-pointer"
                title="Envoyer le message"
              >
                <ArrowUp className="w-4 h-4 stroke-[3]" />
              </button>
            ) : (
              /* Voice Mode Headphone Icon */
              <div className="flex items-center gap-1.5 pr-1">
                <button
                  id="btn-gpt-seller-voice-mode"
                  type="button"
                  onClick={() => setIsVoiceModeOpen(true)}
                  className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shrink-0 hover:bg-white/90 active:scale-95 transition shadow cursor-pointer"
                  title="Mode vocal RodiumAI (Live)"
                >
                  <Headphones className="w-4 h-4 stroke-[2.2]" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          5. PRODUCT PICKER MODAL (FOR SELLER ARTICLES)
          ========================================================================= */}
      {isProductPickerOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
          onClick={() => setIsProductPickerOpen(false)}
        >
          <div 
            className="w-full max-w-lg bg-[#181818] border border-white/10 rounded-t-3xl sm:rounded-3xl max-h-[80vh] flex flex-col p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#FF6321]" />
                <h3 className="text-sm font-bold text-white">Sélectionnez un article de votre catalogue</h3>
              </div>
              <button
                onClick={() => setIsProductPickerOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar py-3 space-y-2">
              {products.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setPendingAttachedProduct(p);
                    setIsProductPickerOpen(false);
                    showToast(`Article "${p.name}" attaché à la discussion 📦`);
                  }}
                  className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 flex items-center justify-between cursor-pointer transition active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img 
                      src={p.images?.[0] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100'} 
                      alt="" 
                      className="w-12 h-12 rounded-xl object-cover border border-white/10"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{p.name}</p>
                      <p className="text-[10px] text-[#FF6321] font-extrabold mt-0.5">{formatFCFA(p.price)}</p>
                      <p className="text-[9px] text-white/50">{p.category || 'Mode'}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#10A37F]/20 text-[#10A37F] text-[10px] font-bold border border-[#10A37F]/30 shrink-0">
                    Choisir
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          6. RODIUMAI REALTIME VOICE MODE (AUDIO BIDIRECTIONAL)
          ========================================================================= */}
      <RealtimeVoiceModal
        isOpen={isVoiceModeOpen}
        onClose={() => setIsVoiceModeOpen(false)}
        onUserSpokeText={(spokenText) => {
          handleSendMessage(spokenText);
        }}
      />
    </div>
  );
};
