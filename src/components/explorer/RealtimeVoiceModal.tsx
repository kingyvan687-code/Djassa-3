import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getSecurityToken } from '../../services/securityService';
import { clientService } from '../../services/clientService';
import { 
  X, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Coins, 
  ShoppingBag, 
  Zap, 
  Store, 
  ExternalLink,
  ChevronRight,
  Tag,
  Play
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AI_BILLING_RATES } from '../../services/aiPricing';
import { formatFCFA } from '../../services/marketServices';
import { Product } from '../../types';

interface RealtimeVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserSpokeText?: (text: string) => void;
}

// Convert Float32Array to 16-bit PCM ArrayBuffer then Base64
function floatTo16BitPCMBase64(float32Array: Float32Array): string {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); // little-endian
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert base64 24kHz PCM to AudioBuffer
function base64ToAudioBuffer(base64: string, ctx: AudioContext): AudioBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768.0;
  }
  const buffer = ctx.createBuffer(1, float32.length, 24000);
  buffer.copyToChannel(float32, 0);
  return buffer;
}

export const RealtimeVoiceModal: React.FC<RealtimeVoiceModalProps> = ({
  isOpen,
  onClose,
  onUserSpokeText
}) => {
  const { 
    products, 
    sellers,
    aiCredits, 
    spendAiCredits, 
    showToast, 
    setIsCreditModalOpen, 
    openCreditModal, 
    setSelectedProduct,
    setVariantModalProduct,
    setIsVariantModalDirectBuy,
    openPhotoViewer,
    openVideoViewer,
    navigateToFeedProduct,
    setReturnToLiveVoiceAvailable,
    liveAiProducts,
    setLiveAiProducts,
    setHideBottomNav
  } = useApp();

  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'speaking' | 'listening' | 'error'>('connecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);

  // Time-based credit billing: 10 credits per minute (60 seconds)
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [billedMinutesCount, setBilledMinutesCount] = useState(0);

  // Interactive Live Product Cards presented by AI
  const [liveProducts, setLiveProducts] = useState<Product[]>(() => (liveAiProducts && liveAiProducts.length > 0 ? liveAiProducts : []));
  const [liveComment, setLiveComment] = useState<string>('');

  useEffect(() => {
    if (liveAiProducts && liveAiProducts.length > 0 && liveProducts.length === 0) {
      setLiveProducts(liveAiProducts);
    }
  }, [liveAiProducts, liveProducts.length]);

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isMutedRef = useRef(false);
  const timerIntervalRef = useRef<any>(null);

  isMutedRef.current = isMuted;

  // Stop playback on interruption
  const stopAllPlayback = useCallback(() => {
    activeSourcesRef.current.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (_) {}
    });
    activeSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
  }, []);

  // Play audio chunk sequentially at 24kHz
  const playChunk = useCallback((base64Audio: string) => {
    if (!outputAudioCtxRef.current) return;
    const ctx = outputAudioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    try {
      const audioBuffer = base64ToAudioBuffer(base64Audio, ctx);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const currentTime = ctx.currentTime;
      if (nextStartTimeRef.current < currentTime) {
        nextStartTimeRef.current = currentTime + 0.05; // tiny buffer
      }

      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += audioBuffer.duration;

      activeSourcesRef.current.push(source);
      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
        if (activeSourcesRef.current.length === 0) {
          setConnectionStatus('listening');
        }
      };

      setConnectionStatus('speaking');
    } catch (e: any) {
      console.error('[Voice] Error playing audio chunk:', e);
    }
  }, []);

  // Matching helper to find products based on AI search term
  const findMatchingProducts = useCallback((term: string): Product[] => {
    const list = productsRef.current;
    const qLower = term.toLowerCase().trim();
    if (!qLower) return [];

    const matched = list.filter((p) => {
      const nameMatch = p.name.toLowerCase().includes(qLower);
      const descMatch = p.description.toLowerCase().includes(qLower);
      const catMatch = (p.category || '').toLowerCase().includes(qLower);
      const tagMatch = p.tags && p.tags.some((t) => t.toLowerCase().includes(qLower));

      const isShoe = /basket|sneaker|chaussure|mocassin|soulier|talon/i.test(qLower) && /chaussure|basket|soulier|sandale/i.test(p.category + p.name);
      const isDress = /robe|wax|habit|vetement|chemise|pantalon|tenue/i.test(qLower) && /habit|vetement|robe|mode|wax/i.test(p.category + p.name + p.description);
      const isTech = /phone|smartphone|tech|ecouteur|iphone|samsung|audio/i.test(qLower) && /tech|electronique|audio|phone/i.test(p.category + p.name);
      const isBeauty = /parfum|beaute|cosmetique|soin|meche/i.test(qLower) && /beaute|parfum|cosmetique/i.test(p.category + p.name);
      const isPromo = /promo|solde|reduction|remise|pas cher/i.test(qLower) && (p.isPromotion || (p.discountPercentage && p.discountPercentage > 0));

      return nameMatch || descMatch || catMatch || tagMatch || isShoe || isDress || isTech || isBeauty || isPromo;
    });

    return matched.slice(0, 4);
  }, []);

  // Refs for callbacks and dynamic values to prevent re-render loops
  const spendAiCreditsRef = useRef(spendAiCredits);
  spendAiCreditsRef.current = spendAiCredits;

  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const setIsCreditModalOpenRef = useRef(setIsCreditModalOpen);
  setIsCreditModalOpenRef.current = setIsCreditModalOpen;

  const openCreditModalRef = useRef(openCreditModal);
  openCreditModalRef.current = openCreditModal;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const aiCreditsRef = useRef(aiCredits);
  aiCreditsRef.current = aiCredits;

  const productsRef = useRef(products);
  productsRef.current = products;

  // Cleanup all audio, timer and sockets
  const cleanup = useCallback(() => {
    stopAllPlayback();

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch (_) {}
      scriptProcessorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (inputAudioCtxRef.current) {
      try {
        inputAudioCtxRef.current.close();
      } catch (_) {}
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current) {
      try {
        outputAudioCtxRef.current.close();
      } catch (_) {}
      outputAudioCtxRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (_) {}
      wsRef.current = null;
    }
  }, [stopAllPlayback]);

  // Billing loop: 10 credits upfront for minute 1, then 10 credits every 60 seconds
  useEffect(() => {
    if (!isOpen) return;

    // Check credits before starting
    const ratePerMinute = AI_BILLING_RATES.LIVE_VOICE_PER_MINUTE; // 10 credits
    if (aiCreditsRef.current < ratePerMinute) {
      showToastRef.current(`Crédits IA insuffisants : ${aiCreditsRef.current}/${ratePerMinute} crédits requis pour démarrer la discussion live.`);
      openCreditModalRef.current('client');
      onCloseRef.current();
      return;
    }

    // Deduct initial 10 credits for minute 1
    const deducted = spendAiCreditsRef.current(ratePerMinute, "Discussion live IA (Minute 1)", 'chat');
    if (!deducted) {
      onCloseRef.current();
      return;
    }
    setBilledMinutesCount(1);
    setSessionSeconds(0);

    // Timer every second
    timerIntervalRef.current = setInterval(() => {
      setSessionSeconds(prevSec => {
        const nextSec = prevSec + 1;
        // Every 60 seconds, check and deduct 10 credits
        if (nextSec > 0 && nextSec % 60 === 0) {
          const nextMinute = (nextSec / 60) + 1;
          const success = spendAiCreditsRef.current(ratePerMinute, `Discussion live IA (Minute ${nextMinute})`, 'chat');
          if (!success) {
            showToastRef.current("Solde de crédits épuisé (10 crédits/min requis). Fin de l'appel live.");
            openCreditModalRef.current('client');
            onCloseRef.current();
          } else {
            setBilledMinutesCount(m => m + 1);
            showToastRef.current(`Discussion live : -${ratePerMinute} crédits (Minute ${nextMinute} entamée)`);
          }
        }
        return nextSec;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isOpen]);

  // Connect websocket and start audio capture
  useEffect(() => {
    if (!isOpen) {
      cleanup();
      return;
    }

    setConnectionStatus('connecting');
    setErrorMessage(null);
    if (!liveAiProducts || liveAiProducts.length === 0) {
      setLiveProducts([]);
      setLiveComment('');
    } else {
      setLiveProducts(liveAiProducts);
    }

    let isMounted = true;

    async function initSession() {
      try {
        // Output audio context at 24kHz for RodiumAI MiniMax H3 Max Turbo voice output
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000
        });
        outputAudioCtxRef.current = outputCtx;
        nextStartTimeRef.current = outputCtx.currentTime;

        // Input audio context at 16kHz for RodiumAI audio input
        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 16000
        });
        inputAudioCtxRef.current = inputCtx;

        // Microphone access
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 16000
          }
        });
        mediaStreamRef.current = stream;

        // Protocol determination via short-lived single-use WS ticket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const authToken = getSecurityToken();
        if (!authToken) {
          setErrorMessage('Connexion requise pour utiliser l’assistant vocal en direct.');
          setConnectionStatus('error');
          return;
        }
        const ticketRes = await clientService.createWsTicket();
        if (!isMounted) return;
        const wsUrl = `${protocol}//${window.location.host}/api/live-voice?ticket=${encodeURIComponent(ticketRes.ticket)}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setConnectionStatus('listening');
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'ready') {
              setConnectionStatus('listening');
            } else if (data.type === 'audio' && data.audio) {
              playChunk(data.audio);
            } else if (data.type === 'ai_response' && data.text) {
              setLiveComment(data.text);
              setConnectionStatus('listening');
            } else if (data.type === 'show_products') {
              const matched = findMatchingProducts(data.searchTerm || '');
              setLiveProducts(matched);
              setLiveAiProducts(matched);
              setLiveComment(
                matched.length > 0
                  ? (data.comment || `Articles recommandés pour : "${data.searchTerm}"`)
                  : `Aucun article trouvé pour "${data.searchTerm || ''}".`
              );
            } else if (data.type === 'interrupted') {
              stopAllPlayback();
              setConnectionStatus('listening');
            } else if (data.type === 'error') {
              setErrorMessage(data.error);
              setConnectionStatus('error');
            }
          } catch (err: any) {
            console.error('[Live Voice] JSON parse error:', err);
          }
        };

        ws.onerror = (e) => {
          console.error('[Live Voice WS Error]', e);
          if (isMounted) {
            setErrorMessage("Erreur de connexion au serveur vocal en direct.");
            setConnectionStatus('error');
          }
        };

        ws.onclose = () => {
          console.log('[Live Voice WS Closed]');
          if (isMounted && connectionStatus !== 'error') {
            setConnectionStatus('connecting');
          }
        };

        // Mic stream processing
        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        scriptProcessorRef.current = processor;

        source.connect(processor);
        processor.connect(inputCtx.destination);

        processor.onaudioprocess = (e) => {
          if (isMutedRef.current) return;
          const channelData = e.inputBuffer.getChannelData(0);

          // Calculate simple volume level for visualization
          let sum = 0;
          for (let i = 0; i < channelData.length; i += 16) {
            sum += Math.abs(channelData[i]);
          }
          const avg = sum / (channelData.length / 16);
          setVolumeLevel(Math.min(1, avg * 8));

          // Send to server if WS is open
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const base64 = floatTo16BitPCMBase64(channelData);
            wsRef.current.send(JSON.stringify({ audio: base64 }));
          }
        };

      } catch (err: any) {
        console.error('[Live Voice Init Error]', err);
        if (isMounted) {
          setErrorMessage(err.message || "Impossible d'accéder au microphone.");
          setConnectionStatus('error');
        }
      }
    }

    initSession();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, [isOpen, cleanup, playChunk, stopAllPlayback, findMatchingProducts]);

  // Format seconds mm:ss
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Open product directly on the actual client home page feed with only proposed products
  const handleOpenProductInFeed = (p: Product) => {
    const listToPropose = liveProducts.length > 0 ? [...liveProducts] : [p];
    const targetIdx = listToPropose.findIndex((item) => item.id === p.id);
    let reordered: Product[];
    if (targetIdx > 0) {
      reordered = [listToPropose[targetIdx], ...listToPropose.filter((_, i) => i !== targetIdx)];
    } else if (targetIdx === -1) {
      reordered = [p, ...listToPropose];
    } else {
      reordered = listToPropose;
    }
    setLiveAiProducts(reordered);
    setReturnToLiveVoiceAvailable(true);
    setHideBottomNav(true);
    onClose();
    navigateToFeedProduct(p.id);
  };

  if (!isOpen) return null;

  return (
    <div 
      id="modal-realtime-voice-mode"
      className="fixed inset-0 z-50 bg-[#0d0d0d] flex flex-col justify-between p-4 sm:p-6 animate-fadeIn text-white overflow-hidden"
    >
      {/* 1. Header with Active Billing & Timer */}
      <div className="flex items-center justify-between pt-safe shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center font-black shadow-md">
            <Sparkles className="w-4 h-4 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-white tracking-tight">Djassa Live IA</span>
              {/* Billing Rate Badge: 10 Crédits / minute */}
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <Coins className="w-3 h-3 text-amber-400" />
                <span>10 crédits / min</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/10 font-mono">
                ⏱ {formatTimer(sessionSeconds)}
              </span>
            </div>
            <p className="text-[11px] text-white/50">
              Solde : {aiCredits} crédits restants • {billedMinutesCount} min facturée(s)
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-95 cursor-pointer"
          title="Fermer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Fluid Liquid Orb & Voice Status */}
      <div className="flex flex-col items-center justify-center my-auto space-y-4 sm:space-y-6 shrink-0 py-2">
        <div className="relative flex items-center justify-center">
          {/* Dynamic Glow Ripples */}
          <div 
            className={`absolute rounded-full transition-all duration-300 ${
              connectionStatus === 'speaking'
                ? 'w-48 sm:w-56 h-48 sm:h-56 bg-gradient-to-r from-blue-500/30 via-indigo-500/30 to-purple-500/30 blur-3xl animate-pulse'
                : connectionStatus === 'listening'
                ? 'w-40 sm:w-48 h-40 sm:h-48 bg-gradient-to-r from-cyan-400/20 via-blue-500/20 to-teal-400/20 blur-2xl'
                : 'w-32 h-32 bg-white/10 blur-xl'
            }`} 
            style={{
              transform: `scale(${1 + volumeLevel * 0.4})`
            }}
          />

          <div 
            className={`w-28 sm:w-32 h-28 sm:h-32 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${
              connectionStatus === 'speaking'
                ? 'bg-gradient-to-tr from-[#3b82f6] via-[#8b5cf6] to-[#ec4899] shadow-purple-500/40 animate-pulse'
                : connectionStatus === 'listening'
                ? 'bg-gradient-to-tr from-[#06b6d4] via-[#3b82f6] to-[#6366f1] shadow-cyan-500/30'
                : connectionStatus === 'error'
                ? 'bg-gradient-to-tr from-rose-600 to-amber-600 shadow-rose-500/30'
                : 'bg-white/20'
            }`}
            style={{
              transform: `scale(${1 + volumeLevel * 0.2})`
            }}
          >
            <div className="w-20 sm:w-22 h-20 sm:h-22 rounded-full bg-white/95 backdrop-blur-md flex items-center justify-center shadow-inner">
              {connectionStatus === 'speaking' ? (
                <Volume2 className="w-8 sm:w-9 h-8 sm:h-9 text-neutral-900 animate-pulse" />
              ) : connectionStatus === 'listening' ? (
                <Mic className="w-8 sm:w-9 h-8 sm:h-9 text-cyan-600 animate-bounce" />
              ) : (
                <Sparkles className="w-8 sm:w-9 h-8 sm:h-9 text-neutral-800" />
              )}
            </div>
          </div>
        </div>

        {/* Text feedback based on state */}
        <div className="text-center space-y-1 max-w-sm px-4">
          <p className="text-base sm:text-lg font-black text-white tracking-tight">
            {connectionStatus === 'connecting' && "Connexion au modèle vocal direct..."}
            {connectionStatus === 'listening' && "À votre écoute en direct..."}
            {connectionStatus === 'speaking' && "L'IA vous répond..."}
            {connectionStatus === 'error' && "Connexion interrompue"}
          </p>

          <p className="text-xs text-white/60 leading-relaxed">
            {connectionStatus === 'listening' && (
              isMuted 
                ? "Microphone en sourdine. Cliquez sur le micro pour parler." 
                : "Demandez n'importe quel article (chaussures, tenues, smartphones) : l'IA affichera les cartes produits à l'écran !"
            )}
            {connectionStatus === 'speaking' && "L'IA vous parle. Vous pouvez l'interrompre à tout moment en prenant la parole."}
            {connectionStatus === 'connecting' && "Initialisation audio bidirectionnelle..."}
            {connectionStatus === 'error' && (errorMessage || "Vérifiez votre microphone ou votre connexion Internet.")}
          </p>
        </div>
      </div>

      {/* 3. INTERACTIVE LIVE PRODUCT CARDS PRESENTED BY AI */}
      {liveProducts.length > 0 && (
        <div className="w-full max-w-xl mx-auto my-2 animate-fadeIn bg-[#18181A]/90 border border-white/10 rounded-2xl p-3 shadow-2xl backdrop-blur-md shrink-0">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-1.5 min-w-0">
              <ShoppingBag className="w-4 h-4 text-[#FF6321] shrink-0" />
              <span className="text-xs font-bold text-white truncate">
                {liveComment || "Articles présentés par l'IA en direct"}
              </span>
            </div>
            <span className="text-[10px] font-black bg-[#FF6321]/20 text-[#FF6321] px-2 py-0.5 rounded-full shrink-0">
              {liveProducts.length} articles
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-2 max-h-[38vh] overflow-y-auto no-scrollbar">
            {liveProducts.map((p) => {
              const seller = sellers.find(s => s.id === p.sellerId);
              const imgUrl = (p.images && p.images[0]) || p.videoPoster || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80';

              return (
                <div
                  key={p.id}
                  onClick={() => handleOpenProductInFeed(p)}
                  className="group relative rounded-2xl bg-[#1C1C1E] border border-white/10 overflow-hidden cursor-pointer hover:border-[#FF6321]/60 transition-all duration-300 shadow-xl flex flex-col hover:scale-[1.01]"
                >
                  {/* Media Thumbnail */}
                  <div className="relative aspect-square w-full bg-neutral-900 overflow-hidden">
                    <img
                      src={imgUrl}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {p.mediaType === 'video' && (
                      <div className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 backdrop-blur-md text-white">
                        <Play className="w-3 h-3 fill-white" />
                      </div>
                    )}
                    {Boolean(p.discountPercentage && p.discountPercentage > 0) && (
                      <span className="absolute top-2 left-2 flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-rose-500/90 text-white text-[10px] font-black shadow-md backdrop-blur-md">
                        <Tag className="w-2.5 h-2.5" /> -{p.discountPercentage}%
                      </span>
                    )}
                    {/* Category badge */}
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[9px] font-bold text-white/90 border border-white/10">
                      {p.category}
                    </span>

                    {/* Seller Chip Overlay at bottom of thumbnail */}
                    <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none">
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/65 backdrop-blur-md border border-white/15 text-white">
                        <Store className="w-3 h-3 text-[#FF6321]" />
                        <span className="text-[10px] font-bold truncate max-w-[80px]">@{seller?.username || 'vendeur'}</span>
                        {seller?.verified && (
                          <span className="w-3 h-3 rounded-full bg-[#FF6321] text-white text-[8px] font-black flex items-center justify-center">
                            ✓
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Content & Actions */}
                  <div className="p-2.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-white truncate group-hover:text-[#FF6321] transition" title={p.name}>
                        {p.name}
                      </h3>
                      {p.description && (
                        <p className="text-[10px] text-white/60 line-clamp-1 mt-0.5">
                          {p.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between gap-1 flex-wrap">
                      {/* Price Display */}
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs font-black text-[#FF6321]">
                          {formatFCFA(p.price)}
                        </span>
                        {p.originalPrice && p.originalPrice > p.price && (
                          <span className="text-[9px] text-white/40 line-through">
                            {formatFCFA(p.originalPrice)}
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenProductInFeed(p);
                          }}
                          className="px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/75 text-white border border-white/20 font-extrabold text-xs shadow-lg transition flex items-center gap-1 active:scale-95 cursor-pointer"
                          title="Voir produit sur la page d'accueil client"
                        >
                          <span>Voir produit</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                            setVariantModalProduct(p);
                            setIsVariantModalDirectBuy(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#FF6321] hover:bg-[#ff753a] text-white text-[10px] font-black shadow-md shadow-orange-600/20 active:scale-95 transition cursor-pointer flex items-center gap-0.5"
                          title="Acheter maintenant"
                        >
                          <Zap className="w-3 h-3" />
                          <span>Acheter</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Quick query buttons if no products yet */}
      {liveProducts.length === 0 && connectionStatus !== 'error' && (
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto py-1 shrink-0">
          {[
            "Montre-moi des sneakers en promo",
            "Quelles sont les robes wax chics ?",
            "Affiche les iPhones disponibles"
          ].map((query, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({ text: query }));
                  setConnectionStatus('speaking');
                } else {
                  const matched = findMatchingProducts(query);
                  setLiveProducts(matched);
                  setLiveAiProducts(matched);
                  setLiveComment(`Articles suggérés pour : "${query}"`);
                }
              }}
              className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-xs text-white/90 transition active:scale-95 cursor-pointer"
            >
              "{query}"
            </button>
          ))}
        </div>
      )}

      {/* 5. Bottom Call Controls */}
      <div className="flex items-center justify-center gap-6 pb-safe pt-2 shrink-0">
        {/* Mute/Unmute Mic Button */}
        <button
          type="button"
          onClick={() => setIsMuted(prev => !prev)}
          className={`w-13 h-13 rounded-full flex items-center justify-center transition active:scale-95 shadow-md cursor-pointer ${
            isMuted 
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' 
              : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
          }`}
          title={isMuted ? "Réactiver le micro" : "Couper le micro"}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Interrupt / Stop speaking button if AI is talking */}
        {connectionStatus === 'speaking' && (
          <button
            type="button"
            onClick={stopAllPlayback}
            className="w-13 h-13 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center justify-center transition active:scale-95 shadow-md cursor-pointer"
            title="Interrompre la réponse"
          >
            <VolumeX className="w-5 h-5" />
          </button>
        )}

        {/* End Call Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-xl shadow-red-900/30 active:scale-95 transition cursor-pointer"
          title="Raccrocher et quitter"
        >
          <X className="w-6 h-6 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
