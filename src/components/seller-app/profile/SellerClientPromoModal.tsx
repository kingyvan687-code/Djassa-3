import React, { useState, useMemo } from 'react';
import {
  X,
  Tag,
  Percent,
  DollarSign,
  Truck,
  Gift,
  Calendar,
  Clock,
  Sparkles,
  MessageCircle,
  Phone,
  Send,
  CheckCircle2,
  Copy,
  ChevronDown,
  ShoppingBag,
  Zap,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Heart
} from 'lucide-react';
import { Seller, Product } from '../../../types';
import { formatFCFA } from '../../../services/marketServices';
import { useApp } from '../../../context/AppContext';

export interface FollowerClientData {
  id: string;
  name: string;
  username: string;
  avatar: string;
  commune: string;
  quartier?: string;
  ordersPlacedCount: number;
  followedSince: string;
  isVip?: boolean;
  lastPurchaseDate?: string;
  totalSpent?: number;
  phone?: string;
}

interface SellerClientPromoModalProps {
  client: FollowerClientData;
  seller: Seller;
  products: Product[];
  onClose: () => void;
  onShowToast: (message: string) => void;
  onOpenChat?: (clientName: string, initialMessage?: string) => void;
}

type PromoDiscountType = 'percentage' | 'fixed' | 'free_shipping' | 'gift';

export const SellerClientPromoModal: React.FC<SellerClientPromoModalProps> = ({
  client,
  seller,
  products,
  onClose,
  onShowToast,
  onOpenChat
}) => {
  const { openChatWithParticipant, startCall, currentSellerId } = useApp();

  // Products from this seller
  const sellerProducts = useMemo(() => {
    return products.filter((p) => p.sellerId === seller.id);
  }, [products, seller.id]);

  // Form State
  const [discountType, setDiscountType] = useState<PromoDiscountType>('percentage');
  const [percentageValue, setPercentageValue] = useState<number>(20);
  const [fixedAmountValue, setFixedAmountValue] = useState<number>(5000);
  const [scope, setScope] = useState<'all' | 'specific'>('all');
  const [selectedProductId, setSelectedProductId] = useState<string>(
    sellerProducts[0]?.id || ''
  );
  const [validityDays, setValidityDays] = useState<number>(7);
  const [minOrderAmount, setMinOrderAmount] = useState<number>(15000);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Auto-generate a clean personalized coupon code
  const generatedCode = useMemo(() => {
    const cleanFirstName = client.name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '') || 'VIP';
    if (discountType === 'percentage') {
      return `${cleanFirstName}-${percentageValue}`;
    }
    if (discountType === 'fixed') {
      return `${cleanFirstName}-${Math.round(fixedAmountValue / 1000)}K`;
    }
    if (discountType === 'free_shipping') {
      return `${cleanFirstName}-LIVRAISON`;
    }
    return `${cleanFirstName}-CADEAU`;
  }, [client.name, discountType, percentageValue, fixedAmountValue]);

  const [customCode, setCustomCode] = useState<string>('');
  const activeCouponCode = customCode.trim() ? customCode.trim().toUpperCase() : generatedCode;

  // Selected product object if scope is specific
  const selectedProduct = useMemo(() => {
    return sellerProducts.find((p) => p.id === selectedProductId) || sellerProducts[0];
  }, [sellerProducts, selectedProductId]);

  // Dynamic promo description text
  const promoSummaryText = useMemo(() => {
    let disc = '';
    if (discountType === 'percentage') disc = `-${percentageValue}% de réduction`;
    else if (discountType === 'fixed') disc = `-${formatFCFA(fixedAmountValue)} de remise`;
    else if (discountType === 'free_shipping') disc = `Livraison offerte 🎁`;
    else disc = `Cadeau VIP offert pour votre commande`;

    const target =
      scope === 'specific' && selectedProduct
        ? `sur l'article « ${selectedProduct.name} »`
        : `valable sur toute la boutique ${seller.name}`;

    return `${disc} ${target}`;
  }, [discountType, percentageValue, fixedAmountValue, scope, selectedProduct, seller.name]);

  // Pre-filled personalized chat message
  const defaultMessage = useMemo(() => {
    return `Bonjour ${client.name.split(' ')[0]} ! ✨ En tant que client privilégié de notre boutique ${seller.name}, je vous offre une réduction exclusive : ${promoSummaryText}.\n\nUtilisez le code promo : ${activeCouponCode} (valable ${validityDays} jours dès ${formatFCFA(minOrderAmount)} d'achat).\n\nN'hésitez pas si vous avez la moindre question ou besoin d'un conseil taille/couleur ! 🛍️`;
  }, [client.name, seller.name, promoSummaryText, activeCouponCode, validityDays, minOrderAmount]);

  const [chatMessage, setChatMessage] = useState<string>(defaultMessage);

  // Quick message template presets
  const applyPresetMessage = (type: 'fidelity' | 'exclusive' | 'flash' | 'gift') => {
    const firstName = client.name.split(' ')[0];
    if (type === 'fidelity') {
      setChatMessage(
        `Bonjour ${firstName} ! Merci infiniment pour votre fidélité (${client.ordersPlacedCount} commandes chez nous). Voici votre code privilège : ${activeCouponCode} pour profiter de ${promoSummaryText}. Au plaisir de vous servir ! 💖`
      );
    } else if (type === 'exclusive') {
      setChatMessage(
        `Chère ${firstName}, nous venons de recevoir de nouvelles pièces exclusives et avons pensé à vous ! Profitez de votre réduction ${promoSummaryText} avec le code ${activeCouponCode}. Discutons-en ici ! ✨`
      );
    } else if (type === 'flash') {
      setChatMessage(
        `⚡ Vente Flash privée pour ${firstName} : ${promoSummaryText} avec le code secret ${activeCouponCode}. Valable uniquement pendant ${validityDays} jours ! Ne ratez pas ça 🎁`
      );
    } else {
      setChatMessage(
        `Bonjour ${firstName} ! Nous sommes ravis de vous compter parmi nos abonnés préférés. Profitez dès maintenant de ${promoSummaryText} grâce au coupon ${activeCouponCode}.`
      );
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeCouponCode);
    setIsCopied(true);
    onShowToast(`Code promo « ${activeCouponCode} » copié !`);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Send promo & open discussion directly with client
  const handleSendPromoAndChat = () => {
    // 1. Open discussion with client
    openChatWithParticipant({
      participantId: client.id,
      participantName: client.name,
      participantType: 'client',
      participantAvatar: client.avatar,
      participantRoleSubtitle: `Client • ${client.commune} • ${client.ordersPlacedCount} commandes`,
      participantVerified: true,
      initialMessage: chatMessage
    });

    onShowToast(`Offre promotionnelle envoyée à ${client.name} dans la discussion ! 💬🎟️`);
    onClose();

    if (onOpenChat) {
      onOpenChat(client.name, chatMessage);
    }
  };

  // Direct Call to client
  const handleCallClient = () => {
    startCall(client.id, 'client', {
      name: client.name,
      avatar: client.avatar,
      role: `Client • ${client.commune}`,
      phone: client.phone || '+225 07 00 00 00'
    });
  };

  return (
    <div
      id="seller-client-promo-modal-overlay"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-end sm:justify-center sm:items-center animate-fadeIn p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        id="seller-client-promo-sheet"
        className="w-full sm:max-w-xl h-[92vh] sm:h-[86vh] bg-[#141414] rounded-t-3xl sm:rounded-3xl border border-white/15 flex flex-col shadow-2xl animate-slideUp overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="sticky top-0 z-20 bg-[#181818]/95 backdrop-blur-xl px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF6321] to-amber-500 text-white flex items-center justify-center shadow-md shadow-orange-600/30">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <span>Créer une Promo Client</span>
                <span className="px-2 py-0.5 rounded-full bg-[#FF6321]/20 text-[#FF6321] text-[10px] font-black border border-[#FF6321]/30">
                  Sur-Mesure
                </span>
              </h2>
              <p className="text-[11px] text-white/50">
                Offrez un avantage privé et engagez la conversation
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {/* 1. TARGET CLIENT PROFILE CARD */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-white/[0.07] via-white/[0.04] to-transparent border border-white/15 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-[#FF6321] shrink-0 shadow-md">
                <img
                  src={client.avatar}
                  alt={client.name}
                  className="w-full h-full object-cover"
                />
                {client.isVip && (
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-amber-400 rounded-full border border-black flex items-center justify-center text-[8px] font-black text-black">
                    ★
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-bold text-white truncate">{client.name}</h3>
                  {client.isVip && (
                    <span className="px-1.5 py-0.2 rounded-md bg-amber-400/20 text-amber-300 text-[9px] font-black border border-amber-400/30">
                      VIP
                    </span>
                  )}
                  <span className="text-[10px] text-white/40">@{client.username}</span>
                </div>

                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/60 flex-wrap">
                  <span className="flex items-center gap-0.5">
                    <MapPin className="w-2.5 h-2.5 text-[#FF6321]" />
                    {client.commune}
                  </span>
                  <span>•</span>
                  <span className="text-emerald-400 font-bold">
                    {client.ordersPlacedCount} commande{client.ordersPlacedCount > 1 ? 's' : ''}
                  </span>
                  {client.totalSpent && (
                    <>
                      <span>•</span>
                      <span className="text-white/70 font-mono font-semibold">
                        {formatFCFA(client.totalSpent)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Quick direct chat / call buttons */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleCallClient}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition"
                title="Appeler le client"
              >
                <Phone className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  openChatWithParticipant({
                    participantId: client.id,
                    participantName: client.name,
                    participantType: 'client',
                    participantAvatar: client.avatar,
                    participantRoleSubtitle: `Client • ${client.commune}`,
                    participantVerified: true,
                    initialMessage: `Bonjour ${client.name.split(' ')[0]} ! Comment allez-vous ? Je suis à votre écoute si vous souhaitez des informations sur notre boutique.`
                  });
                  onClose();
                }}
                className="p-2 rounded-xl bg-[#FF6321] text-white hover:bg-orange-600 transition shadow-sm"
                title="Discuter directement"
              >
                <MessageCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 2. CHOOSE PROMOTION TYPE */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-white block">
              1. Type d'avantage à accorder :
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setDiscountType('percentage')}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  discountType === 'percentage'
                    ? 'bg-[#FF6321]/15 border-[#FF6321] text-white shadow-sm'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                <Percent className={`w-4 h-4 ${discountType === 'percentage' ? 'text-[#FF6321]' : 'text-white/40'}`} />
                <span className="text-xs font-bold mt-2 block">Pourcentage</span>
                <span className="text-[10px] opacity-70 block">-10%, -20%, etc.</span>
              </button>

              <button
                type="button"
                onClick={() => setDiscountType('fixed')}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  discountType === 'fixed'
                    ? 'bg-[#FF6321]/15 border-[#FF6321] text-white shadow-sm'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                <DollarSign className={`w-4 h-4 ${discountType === 'fixed' ? 'text-[#FF6321]' : 'text-white/40'}`} />
                <span className="text-xs font-bold mt-2 block">Montant Fixe</span>
                <span className="text-[10px] opacity-70 block">-5 000 FCFA</span>
              </button>

              <button
                type="button"
                onClick={() => setDiscountType('free_shipping')}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  discountType === 'free_shipping'
                    ? 'bg-[#FF6321]/15 border-[#FF6321] text-white shadow-sm'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                <Truck className={`w-4 h-4 ${discountType === 'free_shipping' ? 'text-[#FF6321]' : 'text-white/40'}`} />
                <span className="text-xs font-bold mt-2 block">Livraison</span>
                <span className="text-[10px] opacity-70 block">Offerte à 100%</span>
              </button>

              <button
                type="button"
                onClick={() => setDiscountType('gift')}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  discountType === 'gift'
                    ? 'bg-[#FF6321]/15 border-[#FF6321] text-white shadow-sm'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                <Gift className={`w-4 h-4 ${discountType === 'gift' ? 'text-[#FF6321]' : 'text-white/40'}`} />
                <span className="text-xs font-bold mt-2 block">Cadeau VIP</span>
                <span className="text-[10px] opacity-70 block">Surprise incluse</span>
              </button>
            </div>

            {/* Discount Value Selectors */}
            {discountType === 'percentage' && (
              <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/70 font-medium">Pourcentage de remise :</span>
                  <span className="text-[#FF6321] font-black text-sm">-{percentageValue}%</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[10, 15, 20, 25, 30, 50].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setPercentageValue(val)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        percentageValue === val
                          ? 'bg-[#FF6321] text-white shadow'
                          : 'bg-white/10 text-white/70 hover:text-white'
                      }`}
                    >
                      -{val}%
                    </button>
                  ))}
                </div>
              </div>
            )}

            {discountType === 'fixed' && (
              <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/70 font-medium">Montant de la remise :</span>
                  <span className="text-[#FF6321] font-black text-sm font-mono">
                    -{formatFCFA(fixedAmountValue)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[2000, 3000, 5000, 10000, 15000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFixedAmountValue(val)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition font-mono ${
                        fixedAmountValue === val
                          ? 'bg-[#FF6321] text-white shadow'
                          : 'bg-white/10 text-white/70 hover:text-white'
                      }`}
                    >
                      -{formatFCFA(val)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. APPLICABLE PRODUCTS SCOPE */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-white block">
              2. Produits concernés :
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition text-left flex items-center gap-2 ${
                  scope === 'all'
                    ? 'bg-[#FF6321]/15 border-[#FF6321] text-white'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                <ShoppingBag className="w-4 h-4 text-[#FF6321]" />
                <div>
                  <span className="block">Toute la boutique</span>
                  <span className="text-[10px] text-white/40 font-normal">Sur tout le catalogue</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScope('specific')}
                className={`p-2.5 rounded-xl border text-xs font-bold transition text-left flex items-center gap-2 ${
                  scope === 'specific'
                    ? 'bg-[#FF6321]/15 border-[#FF6321] text-white'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                <Tag className="w-4 h-4 text-[#FF6321]" />
                <div>
                  <span className="block">Produit spécifique</span>
                  <span className="text-[10px] text-white/40 font-normal">Sur un modèle choisi</span>
                </div>
              </button>
            </div>

            {/* Product Selector if specific */}
            {scope === 'specific' && (
              <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                <span className="text-[11px] text-white/60 block">Sélectionnez l'article ciblé :</span>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full bg-[#181818] border border-white/15 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                >
                  {sellerProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatFCFA(p.price)}
                    </option>
                  ))}
                </select>

                {selectedProduct && (
                  <div className="p-2 rounded-xl bg-white/5 flex items-center gap-2.5 mt-2">
                    <img
                      src={selectedProduct.images?.[0] || 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=200'}
                      alt={selectedProduct.name}
                      className="w-10 h-10 rounded-lg object-cover bg-neutral-900 border border-white/10 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-white block truncate">
                        {selectedProduct.name}
                      </span>
                      <span className="text-[10px] text-[#FF6321] font-mono font-bold block">
                        Prix normal : {formatFCFA(selectedProduct.price)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. COUPON CODE & VALIDITY */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1.5">
              <label className="text-[11px] font-bold text-white/70 block">
                Code Coupon Exclusif :
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={activeCouponCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  placeholder="EX: FATOU-VIP"
                  className="w-full bg-white/10 border border-white/15 rounded-xl px-2.5 py-1.5 text-xs font-black text-amber-400 font-mono tracking-wider focus:outline-none focus:border-[#FF6321]"
                />
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition"
                  title="Copier le code"
                >
                  {isCopied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1.5">
              <label className="text-[11px] font-bold text-white/70 block">
                Validité de l'offre :
              </label>
              <div className="flex items-center gap-1">
                {[2, 7, 15, 30].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setValidityDays(days)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${
                      validityDays === days
                        ? 'bg-[#FF6321] text-white shadow'
                        : 'bg-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    {days}j
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 5. DIRECT DISCUSSION & CHAT MESSAGE (PARLER AVEC LE CLIENT) */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-[#FF6321]/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#FF6321] text-white">
                  <MessageCircle className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-white">
                    Message Direct pour {client.name}
                  </h4>
                  <p className="text-[10px] text-white/50">
                    Sera envoyé directement dans votre discussion
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                Chat en temps réel
              </span>
            </div>

            {/* Quick Template Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => applyPresetMessage('fidelity')}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-white/80 font-medium shrink-0 flex items-center gap-1"
              >
                <Heart className="w-2.5 h-2.5 text-rose-400" />
                Fidélité VIP
              </button>
              <button
                type="button"
                onClick={() => applyPresetMessage('flash')}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-white/80 font-medium shrink-0 flex items-center gap-1"
              >
                <Zap className="w-2.5 h-2.5 text-amber-400" />
                Flash 48h
              </button>
              <button
                type="button"
                onClick={() => applyPresetMessage('exclusive')}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-white/80 font-medium shrink-0 flex items-center gap-1"
              >
                <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                Nouvel arrivage
              </button>
            </div>

            {/* Message Textarea */}
            <textarea
              rows={3}
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              className="w-full bg-black/40 border border-white/15 rounded-xl p-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321] transition leading-relaxed resize-none"
              placeholder="Écrivez un message personnel pour le client..."
            />
          </div>
        </div>

        {/* FOOTER ACTION BUTTONS */}
        <div className="p-3 bg-[#181818] border-t border-white/10 flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 text-xs font-bold transition"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={handleSendPromoAndChat}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#FF6321] to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-black transition flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30 active:scale-95 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Envoyer la promo & Ouvrir la discussion</span>
          </button>
        </div>
      </div>
    </div>
  );
};
