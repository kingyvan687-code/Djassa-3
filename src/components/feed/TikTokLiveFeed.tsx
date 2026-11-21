import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Heart, 
  Send, 
  Gift, 
  Share2, 
  ShoppingBag, 
  Users, 
  Sparkles, 
  Radio, 
  X, 
  Volume2, 
  VolumeX, 
  Flame, 
  Award,
  Video,
  VideoOff,
  SwitchCamera,
  Pin,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatFCFA, formatMetricCount } from '../../services/marketServices';
import { getSecurityToken } from '../../services/securityService';
import { clientService } from '../../services/clientService';
import { Product } from '../../types';

interface LiveMessage {
  id: string;
  user: string;
  text: string;
  badge?: string;
  isHost?: boolean;
  isSuperGift?: boolean;
}

export const TikTokLiveFeed: React.FC = () => {
  const { 
    products, 
    sellers, 
    setSelectedProduct, 
    setSelectedSeller, 
    setVariantModalProduct, 
    setIsVariantModalDirectBuy, 
    userProfile, 
    toggleFollowSeller,
    showToast
  } = useApp();

  // Real-time server states
  const [isConnected, setIsConnected] = useState(false);
  const [viewerCount, setViewerCount] = useState(1);
  const [likeCount, setLikeCount] = useState(0);
  const [liveMessages, setLiveMessages] = useState<LiveMessage[]>([]);
  const [pinnedProduct, setPinnedProduct] = useState<Product | null>(null);
  const [streamVideoError, setStreamVideoError] = useState(false);

  // Host Mode states (allows the user to go live with their camera as a vendor)
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Viewer controls
  const [isMuted, setIsMuted] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [floatingHearts, setFloatingHearts] = useState<Array<{ id: number; left: number; color: string }>>([]);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showProductDrawer, setShowProductDrawer] = useState(false);

  // Video and WebSocket references
  const wsRef = useRef<WebSocket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const broadcastIntervalRef = useRef<any>(null);

  const activeSeller = sellers[0];
  const isFollowed = activeSeller ? userProfile.followedSellerIds.includes(activeSeller.id) : false;

  // Real-time WebSocket connection to /api/live-stream via short-lived WS ticket
  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;

    const connectLive = async () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const token = getSecurityToken();
      let wsTicket = '';
      if (token) {
        const t = await clientService.createWsTicket().catch(() => null);
        if (t?.ticket) wsTicket = t.ticket;
      }
      if (cancelled) return;

      const query = wsTicket
        ? `?ticket=${encodeURIComponent(wsTicket)}`
        : token
        ? `?token=${encodeURIComponent(token)}`
        : '';
      ws = new WebSocket(`${protocol}//${window.location.host}/api/live-stream${query}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        ws?.send(JSON.stringify({
          type: 'join',
          userName: userProfile.name || 'Client',
          isHost: false
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'init') {
            setViewerCount(data.viewerCount ?? 1);
            setLikeCount(data.likeCount ?? 0);
            if (data.messages) setLiveMessages(data.messages);
            if (data.pinnedProduct) setPinnedProduct(data.pinnedProduct);
          } else if (data.type === 'viewer_count') {
            setViewerCount(data.viewerCount ?? 1);
          } else if (data.type === 'chat' && data.message) {
            setLiveMessages((prev) => [...prev.slice(-40), data.message]);
          } else if (data.type === 'gift') {
            if (data.message) setLiveMessages((prev) => [...prev.slice(-40), data.message]);
            if (typeof data.likeCount === 'number') setLikeCount(data.likeCount);
            spawnHeart();
            spawnHeart();
          } else if (data.type === 'like') {
            if (typeof data.likeCount === 'number') setLikeCount(data.likeCount);
            spawnHeart();
          } else if (data.type === 'pin_product') {
            setPinnedProduct(data.product);
          } else if (data.type === 'video_chunk' && data.chunk) {
            renderRemoteFrame(data.chunk);
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
      };
    };

    void connectLive();

    return () => {
      cancelled = true;
      stopBroadcasting();
      ws?.close();
    };
  }, [userProfile.name]);

  // Set default pinned product if none is pinned yet
  useEffect(() => {
    if (!pinnedProduct && products.length > 0) {
      setPinnedProduct(products[0]);
    }
  }, [products, pinnedProduct]);

  // Render incoming video frame onto canvas for spectators
  const renderRemoteFrame = (base64Chunk: string) => {
    if (!remoteCanvasRef.current) return;
    const canvas = remoteCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    };
    img.src = base64Chunk;
  };

  // Launch REAL camera live broadcast as Host
  const startBroadcasting = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true
      });
      mediaStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      setIsCameraActive(true);
      setIsBroadcasting(true);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'join',
          isHost: true,
          userName: userProfile.name || 'Vendeur Pro',
          sellerName: activeSeller?.name || 'Boutique Adjamé Live',
          title: '🔥 Live Vente en Direct du Marché d\'Adjamé !'
        }));
      }

      // Stream frames at ~10 FPS to all connected viewers over WebSocket
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 360;
      tempCanvas.height = 640;
      const ctx = tempCanvas.getContext('2d');

      broadcastIntervalRef.current = setInterval(() => {
        if (!localVideoRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        if (localVideoRef.current.videoWidth > 0 && ctx) {
          ctx.drawImage(localVideoRef.current, 0, 0, tempCanvas.width, tempCanvas.height);
          const chunk = tempCanvas.toDataURL('image/jpeg', 0.6);
          wsRef.current.send(JSON.stringify({
            type: 'video_chunk',
            chunk
          }));
        }
      }, 100);

      showToast("🔴 Vous êtes EN DIRECT ! Votre caméra diffuse pour tous les clients.");
    } catch (err: any) {
      console.error('[Live Host] Camera error:', err);
      showToast("Impossible d'accéder à la caméra : " + (err.message || 'Permission refusée'));
    }
  };

  const stopBroadcasting = () => {
    if (broadcastIntervalRef.current) {
      clearInterval(broadcastIntervalRef.current);
      broadcastIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
    setIsBroadcasting(false);
  };

  const switchCameraFacing = async () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    if (isBroadcasting) {
      stopBroadcasting();
      setTimeout(startBroadcasting, 200);
    }
  };

  // Floating heart generation
  const spawnHeart = () => {
    const colors = ['#FF2D55', '#FF6321', '#FFD700', '#A855F7', '#38BDF8'];
    const newHeart = {
      id: Date.now() + Math.random(),
      left: 65 + Math.random() * 25,
      color: colors[Math.floor(Math.random() * colors.length)]
    };
    setFloatingHearts((prev) => [...prev.slice(-15), newHeart]);
  };

  // Send real-time like
  const handleLike = () => {
    spawnHeart();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'like', count: 1 }));
    }
  };

  // Send real-time chat message
  const handleSendComment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commentInput.trim()) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat',
        text: commentInput.trim(),
        user: userProfile.name || 'Client',
        badge: isBroadcasting ? 'Vendeur' : 'Acheteur'
      }));
    }
    setCommentInput('');
    spawnHeart();
  };

  // Send real-time gift
  const handleSendGift = (giftName: string, icon: string, points: number) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'gift',
        giftName,
        icon,
        points,
        user: userProfile.name || 'Client'
      }));
    }
    setShowGiftModal(false);
    showToast(`Cadeau "${giftName}" envoyé en direct ! 🎉`);
  };

  // Host pins product
  const handlePinProduct = (prod: Product) => {
    setPinnedProduct(prod);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'pin_product',
        product: prod
      }));
    }
    setShowProductDrawer(false);
    showToast(`Produit "${prod.name}" épinglé sur le live !`);
  };

  return (
    <div 
      id="tiktok-live-container"
      className="relative w-full h-full bg-black overflow-hidden"
    >
      {/* =========================================================================
          1. REAL-TIME VIDEO FEED (CAMERA BROADCAST OR STREAM CANVAS OR FALLBACK)
          ========================================================================= */}
      <div 
        className="absolute inset-0 z-0 bg-neutral-900"
        onDoubleClick={handleLike}
      >
        {/* If user is broadcasting, show their real camera stream */}
        {isCameraActive ? (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        ) : (
          /* Real-time remote broadcast canvas with video stream fallback */
          <>
            <canvas
              ref={remoteCanvasRef}
              className="w-full h-full object-cover absolute inset-0 z-1"
            />
            {streamVideoError ? (
              <img
                src={products[0]?.images?.[0] || 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=1080&q=80'}
                alt="Direct DJASSA"
                className="w-full h-full object-cover z-0"
              />
            ) : (
              <video
                src={products.find(p => p.videoUrl)?.videoUrl || 'https://assets.mixkit.co/videos/preview/mixkit-fashion-model-showing-clothes-in-a-studio-34388-large.mp4'}
                poster={products[0]?.images?.[0] || 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=1080&q=80'}
                autoPlay
                loop
                muted={isMuted}
                playsInline
                onError={() => setStreamVideoError(true)}
                className="w-full h-full object-cover z-0"
              />
            )}
          </>
        )}

        {/* Cinematic dark gradients for TikTok Live overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-transparent to-black/95 pointer-events-none z-10" />
      </div>

      {/* Floating Animated Hearts Column */}
      <div className="absolute bottom-28 right-4 w-24 h-80 pointer-events-none z-30 overflow-hidden">
        {floatingHearts.map((h) => (
          <div
            key={h.id}
            className="absolute bottom-4 animate-floatUpHeart"
            style={{ left: `${h.left}%` }}
          >
            <Heart 
              className="w-7 h-7 drop-shadow-lg" 
              style={{ fill: h.color, color: h.color }} 
            />
          </div>
        ))}
      </div>

      {/* =========================================================================
          2. TOP BAR (TIKTOK LIVE SIGNATURE HEADER)
          ========================================================================= */}
      <div className="absolute top-14 sm:top-16 left-3 right-3 z-30 flex items-center justify-between gap-2">
        {/* Host Pill */}
        <div className="flex items-center gap-2 bg-black/55 backdrop-blur-md p-1 pr-2.5 rounded-full border border-white/10 max-w-[65%]">
          <img
            src={activeSeller?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80'}
            alt="Host"
            onClick={() => activeSeller && setSelectedSeller(activeSeller)}
            className="w-9 h-9 rounded-full object-cover border border-[#FF6321] cursor-pointer shrink-0"
          />
          <div 
            onClick={() => activeSeller && setSelectedSeller(activeSeller)}
            className="truncate cursor-pointer"
          >
            <div className="flex items-center gap-1">
              <span className="text-xs font-black text-white truncate">
                {isBroadcasting ? (userProfile.name || 'Mon Live Vendeur') : (activeSeller?.name || 'Moussa Frip Adjamé')}
              </span>
              <span className="w-3.5 h-3.5 rounded-full bg-[#FF6321] text-white text-[9px] font-black flex items-center justify-center shrink-0">✓</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-white/70">
              <span className="flex items-center gap-0.5 text-amber-300 font-bold">
                <Flame className="w-3 h-3 fill-amber-300" />
                {formatMetricCount(likeCount)}
              </span>
              <span>•</span>
              <span className="truncate">Adjamé Black Market</span>
            </div>
          </div>

          {/* Follow button if spectator */}
          {!isBroadcasting && activeSeller && (
            <button
              onClick={() => toggleFollowSeller(activeSeller.id)}
              className={`ml-1 px-3 py-1 rounded-full text-[11px] font-black transition active:scale-90 shrink-0 cursor-pointer ${
                isFollowed 
                  ? 'bg-white/15 text-white' 
                  : 'bg-[#FE2C55] hover:bg-[#ff1e49] text-white shadow-md'
              }`}
            >
              {isFollowed ? 'Abonné' : '+ Suivre'}
            </button>
          )}
        </div>

        {/* Viewers Pill & Stream Mode Toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Live Viewers Pill */}
          <div className="flex items-center gap-1 bg-black/55 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-white/10 text-xs font-black text-white">
            <Users className="w-3.5 h-3.5 text-rose-400" />
            <span>{formatMetricCount(viewerCount)}</span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="w-8 h-8 rounded-full bg-black/55 backdrop-blur-md flex items-center justify-center text-white border border-white/10 active:scale-95 cursor-pointer"
            title={isMuted ? 'Activer le son' : 'Couper le son'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-white/60" /> : <Volume2 className="w-4 h-4 text-[#FF6321]" />}
          </button>

          {/* Start/Stop Real Camera Live Button */}
          {isBroadcasting ? (
            <div className="flex items-center gap-1">
              <button
                onClick={switchCameraFacing}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white border border-white/20 cursor-pointer"
                title="Tourner la caméra"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
              <button
                onClick={stopBroadcasting}
                className="px-2.5 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black flex items-center gap-1 shadow-md cursor-pointer"
                title="Arrêter la diffusion"
              >
                <VideoOff className="w-3.5 h-3.5" />
                <span>Quitter</span>
              </button>
            </div>
          ) : (
            <button
              onClick={startBroadcasting}
              className="px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FE2C55] to-[#FF6321] hover:opacity-95 text-white text-[11px] font-black flex items-center gap-1 shadow-lg active:scale-95 cursor-pointer ring-1 ring-white/30"
              title="Lancer mon propre live caméra en direct"
            >
              <Video className="w-3.5 h-3.5 animate-pulse" />
              <span>Passer en Live</span>
            </button>
          )}
        </div>
      </div>

      {/* Top Banner Tag / Rank */}
      <div className="absolute top-28 left-4 z-20 flex items-center gap-2">
        <span className="px-2.5 py-0.5 rounded-full bg-[#FE2C55] text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md">
          <Radio className="w-3 h-3 animate-ping" />
          <span>EN DIRECT</span>
        </span>
        <span className="px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-emerald-400 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          <span>WebSocket Connecté</span>
        </span>
      </div>

      {/* =========================================================================
          3. BOTTOM LIVE STREAM OVERLAY (PINNED PRODUCT + REAL CHAT + ACTIONS)
          ========================================================================= */}
      <div className="absolute bottom-16 sm:bottom-4 left-3 right-3 z-30 space-y-2 pointer-events-auto">
        
        {/* Pinned Product Card (Shop in Live) */}
        {pinnedProduct && (
          <div 
            onClick={() => setSelectedProduct(pinnedProduct)}
            className="flex items-center gap-3 p-2 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/15 max-w-sm shadow-2xl cursor-pointer hover:border-[#FF6321]/50 transition group"
          >
            <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-neutral-800">
              <img
                src={(pinnedProduct.images && pinnedProduct.images[0]) || ''}
                alt={pinnedProduct.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              <span className="absolute top-1 left-1 px-1 rounded bg-[#FE2C55] text-white text-[9px] font-black">
                1
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider block">
                ✦ En vedette sur le live
              </span>
              <h4 className="text-xs font-black text-white truncate group-hover:text-[#FF6321] transition">
                {pinnedProduct.name}
              </h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-black text-[#FF6321]">
                  {formatFCFA(pinnedProduct.price)}
                </span>
                {pinnedProduct.originalPrice && (
                  <span className="text-[10px] text-white/40 line-through">
                    {formatFCFA(pinnedProduct.originalPrice)}
                  </span>
                )}
              </div>
            </div>

            {/* Direct Buy CTA */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setVariantModalProduct(pinnedProduct);
                setIsVariantModalDirectBuy(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-[#FE2C55] hover:bg-[#ff1e49] text-white text-xs font-black shrink-0 shadow-lg active:scale-95 transition cursor-pointer"
            >
              Acheter
            </button>
          </div>
        )}

        {/* Real-Time Live Comments Stream Box */}
        <div className="h-32 sm:h-36 overflow-y-auto no-scrollbar space-y-1.5 max-w-sm">
          {liveMessages.map((m) => (
            <div 
              key={m.id}
              className={`text-xs px-2.5 py-1 rounded-xl backdrop-blur-md max-w-[95%] inline-block transition-all ${
                m.isSuperGift
                  ? 'bg-gradient-to-r from-amber-500/35 to-rose-500/35 border border-amber-400/50 text-amber-200 font-bold'
                  : m.isHost
                  ? 'bg-[#FF6321]/30 border border-[#FF6321]/50 text-white font-semibold'
                  : 'bg-black/55 text-white/95 border border-white/10'
              }`}
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-[#FE2C55]">{m.user}</span>
                {m.badge && (
                  <span className="text-[9px] px-1 rounded bg-white/15 text-white/80 font-bold">
                    {m.badge}
                  </span>
                )}
                <span className="text-white/90">{m.text}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Interactive Bottom Actions Bar (Input + Gifts + Heart + Bag + Share) */}
        <div className="flex items-center gap-2 pt-1">
          {/* Real-time comment input form */}
          <form 
            onSubmit={handleSendComment}
            className="flex-1 flex items-center gap-1 bg-black/65 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/15"
          >
            <input
              type="text"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder="Commenter en direct..."
              className="w-full bg-transparent text-xs text-white placeholder-white/40 focus:outline-none"
            />
            {commentInput.trim() && (
              <button 
                type="submit" 
                className="text-[#FE2C55] hover:text-white p-1 transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Bag button (Catalogue live & Pinning) */}
          <button
            onClick={() => setShowProductDrawer(true)}
            className="relative w-10 h-10 rounded-full bg-black/65 backdrop-blur-md border border-white/15 text-white flex items-center justify-center hover:bg-black/80 transition active:scale-95 shrink-0 cursor-pointer"
            title="Articles du live"
          >
            <ShoppingBag className="w-4 h-4 text-amber-300" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FE2C55] text-white text-[9px] font-black flex items-center justify-center shadow">
              {products.length}
            </span>
          </button>

          {/* Gift Button */}
          <button
            onClick={() => setShowGiftModal(true)}
            className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-lg active:scale-95 transition shrink-0 cursor-pointer"
            title="Envoyer un cadeau en direct"
          >
            <Gift className="w-4 h-4 animate-bounce" />
          </button>

          {/* Like Heart Button */}
          <button
            onClick={handleLike}
            className="w-10 h-10 rounded-full bg-[#FE2C55] text-white flex items-center justify-center shadow-lg active:scale-90 transition shrink-0 cursor-pointer"
            title="Envoyer des cœurs"
          >
            <Heart className="w-5 h-5 fill-white" />
          </button>

          {/* Share Button */}
          <button
            onClick={() => {
              const liveUrl = activeSeller
                ? `${window.location.origin}/?seller=${encodeURIComponent(activeSeller.id)}`
                : window.location.origin;
              if (navigator.share) {
                navigator.share({
                  title: 'Live Djassa en direct',
                  text: 'Rejoins le direct en temps réel sur Djassa !',
                  url: liveUrl
                }).catch(() => {});
              } else {
                navigator.clipboard?.writeText(liveUrl).catch(() => {});
                showToast("Lien du live copié dans le presse-papier !");
              }
            }}
            className="w-10 h-10 rounded-full bg-black/65 backdrop-blur-md border border-white/15 text-white flex items-center justify-center hover:bg-black/80 transition active:scale-95 shrink-0 cursor-pointer"
            title="Partager le live"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* =========================================================================
          4. GIFTS MODAL BOTTOM SHEET
          ========================================================================= */}
      {showGiftModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end justify-center animate-fadeIn"
          onClick={() => setShowGiftModal(false)}
        >
          <div 
            className="w-full max-w-md bg-[#181818] rounded-t-3xl border-t border-white/10 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black text-white">Envoyer un cadeau en direct</h3>
              </div>
              <button 
                onClick={() => setShowGiftModal(false)}
                className="text-white/60 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {[
                { name: 'Rose', icon: '🌹', cost: '100 F', points: 10 },
                { name: 'Chapeau', icon: '🤠', cost: '500 F', points: 50 },
                { name: 'Cœur Or', icon: '💛', cost: '1 000 F', points: 100 },
                { name: 'Lion Adjamé', icon: '🦁', cost: '5 000 F', points: 500 },
                { name: 'Fusée', icon: '🚀', cost: '2 500 F', points: 250 },
                { name: 'Diamant', icon: '💎', cost: '10 000 F', points: 1000 },
                { name: 'Couronne', icon: '👑', cost: '15 000 F', points: 1500 },
                { name: 'Boutique Pro', icon: '🏬', cost: '25 000 F', points: 2500 }
              ].map((g, i) => (
                <button
                  key={i}
                  onClick={() => handleSendGift(g.name, g.icon, g.points)}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 hover:bg-white/15 border border-white/5 hover:border-amber-400/40 transition active:scale-95 group cursor-pointer"
                >
                  <span className="text-2xl group-hover:scale-125 transition-transform">{g.icon}</span>
                  <span className="text-[11px] font-bold text-white mt-1">{g.name}</span>
                  <span className="text-[10px] text-amber-300 font-semibold">{g.cost}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          5. PRODUCT DRAWER (SHOPPING & PINNING ARTICLES EN DIRECT)
          ========================================================================= */}
      {showProductDrawer && (
        <div 
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end justify-center animate-fadeIn"
          onClick={() => setShowProductDrawer(false)}
        >
          <div 
            className="w-full max-w-md max-h-[75vh] bg-[#161616] rounded-t-3xl border-t border-white/10 p-5 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#FE2C55]" />
                <h3 className="text-sm font-black text-white">Articles présentés dans le live</h3>
              </div>
              <button 
                onClick={() => setShowProductDrawer(false)}
                className="text-white/60 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 py-3">
              {products.slice(0, 6).map((p, idx) => (
                <div 
                  key={p.id}
                  className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition"
                >
                  <span className="w-5 text-center text-xs font-black text-[#FE2C55]">
                    {idx + 1}
                  </span>
                  <img
                    src={(p.images && p.images[0]) || ''}
                    alt={p.name}
                    className="w-14 h-14 rounded-xl object-cover border border-white/10"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-white truncate">{p.name}</h4>
                    <span className="text-xs font-black text-[#FF6321] block mt-0.5">
                      {formatFCFA(p.price)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* If host, allow pinning product */}
                    {isBroadcasting && (
                      <button
                        onClick={() => handlePinProduct(p)}
                        className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Épingler en vedette"
                      >
                        <Pin className="w-3.5 h-3.5" />
                        <span>Épingler</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setShowProductDrawer(false);
                        setVariantModalProduct(p);
                        setIsVariantModalDirectBuy(true);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-[#FE2C55] hover:bg-[#ff1e49] text-white text-xs font-black shadow active:scale-95 cursor-pointer"
                    >
                      Acheter
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
