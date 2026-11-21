import React, { useEffect, useRef, useState } from 'react';
import { 
  Menu, 
  Edit3, 
  Camera, 
  MapPin, 
  ShieldCheck, 
  LayoutGrid,
  Video as VideoIcon,
  Star,
  Wallet,
  X,
  Sparkles,
  Phone,
  ShoppingBag,
} from 'lucide-react';
import { Seller, Product } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatFCFA, formatMetricCount } from '../../services/marketServices';
import { SellerVideosTab } from './profile/SellerVideosTab';
import { SellerPhotosTab } from './profile/SellerPhotosTab';
import { SellerCreationsTab } from './profile/SellerCreationsTab';
import { SellerReviewsTab } from './profile/SellerReviewsTab';
import { SellerSalesTab } from './profile/SellerSalesTab';
import { SellerStatsDashboard } from './stats/SellerStatsDashboard';
import { SellerSettingsPrivacyScreen } from './settings/SellerSettingsPrivacyScreen';
import { SellerEditProfileScreen } from './profile/SellerEditProfileScreen';
import { SellerFollowersModal } from './profile/SellerFollowersModal';
import { ChatGptLogo } from './chatgpt/SellerChatGptScreen';

interface Props {
  seller: Seller;
  products: Product[];
  totalRevenue: number;
  productCount: number;
  onSignOut: () => void;
  onGoAdd?: (tab?: 'product' | 'video' | 'ia_creator') => void;
}

type ContentTab = 'photos' | 'videos' | 'creations' | 'achats' | 'avis';

export const SellerProfileScreen: React.FC<Props> = ({
  seller,
  products,
  totalRevenue,
  productCount,
  onSignOut,
  onGoAdd,
}) => {
  const { updateSeller, openVideoViewer, setSelectedProduct, showToast, setSellerActiveTab, sellerCreations } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<ContentTab>('photos');
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFollowersOpen, setIsFollowersOpen] = useState(false);
  const tabsRef = useRef<HTMLDivElement | null>(null);

  // Wallet & Withdrawals state
  const [balance, setBalance] = useState(totalRevenue);
  useEffect(() => {
    setBalance(totalRevenue);
  }, [totalRevenue]);

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawProvider, setWithdrawProvider] = useState<'wave' | 'orange_money'>('wave');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [withdrawals, setWithdrawals] = useState<
    { id: string; amount: number; provider: string; date: string; status: string }[]
  >([
    {
      id: 'w-1',
      amount: 45000,
      provider: 'Wave',
      date: 'Il y a 3 jours',
      status: 'Effectué',
    },
  ]);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  // Filter content
  const photos = products.filter((p) => (p.images && p.images.length > 0) || (p.contentType === 'publication' && p.mediaType !== 'video'));
  const videos = products.filter((p) => p.mediaType === 'video' && p.videoUrl);
  const iaCreations = (sellerCreations || []).filter(
    (c) =>
      (!c.sellerId || c.sellerId === seller.id) &&
      (c.isAiGenerated ||
        c.type === 'ai_video' ||
        c.type === 'ai_photo' ||
        (!c.productId && (c.type === 'video' || c.type === 'photo' || (c as { type: string }).type === 'image')))
  );
  const totalCreationsCount = iaCreations.length;

  const handleRequestWithdrawal = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(withdrawAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      showToast('Montant de retrait invalide.');
      return;
    }
    if (numericAmount > balance) {
      showToast(`Solde insuffisant : ${formatFCFA(balance)} disponible.`);
      return;
    }
    if (!/^\+?225?0?\d{8,10}$/.test(withdrawPhone.replace(/\s|-/g, ''))) {
      showToast('Numéro de téléphone ivoirien invalide.');
      return;
    }

    const providerLabel =
      withdrawProvider === 'wave' ? 'Wave' : 'Orange Money';

    setBalance((prev) => prev - numericAmount);
    setWithdrawals((prev) => [
      {
        id: `w-${Date.now()}`,
        amount: numericAmount,
        provider: providerLabel,
        date: "À l'instant",
        status: 'En traitement',
      },
      ...prev,
    ]);
    setWithdrawAmount('');
    setWithdrawPhone('');
    setIsWithdrawOpen(false);
    showToast(`Demande de retrait de ${formatFCFA(numericAmount)} envoyée vers ${providerLabel} !`);
  };

  if (isAnalyticsOpen) {
    return (
      <SellerStatsDashboard
        seller={seller}
        products={products}
        totalRevenue={totalRevenue}
        balance={balance}
        withdrawals={withdrawals}
        onWithdrawSuccess={(newBalance, newWithdrawal) => {
          setBalance(newBalance);
          setWithdrawals((prev) => [newWithdrawal, ...prev]);
        }}
        onClose={() => setIsAnalyticsOpen(false)}
        onOpenVideoViewer={(prods, prodId) => openVideoViewer(prods, prodId)}
        onSelectProduct={setSelectedProduct}
      />
    );
  }

  return (
    <div
      id="seller-profile-screen"
      className="w-full h-full bg-[#0A0A0A] text-white flex flex-col overflow-y-auto no-scrollbar pb-24"
    >
      {/* 2. BOUTIQUE BANNER (Bannière pleine page avec bouton menu flottant et personnalisation) */}
      <div className="relative w-full h-44 sm:h-52 bg-neutral-900 overflow-hidden shrink-0">
        <img
          src={seller.banner || 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200&auto=format&fit=crop&q=80'}
          alt={`Bannière de ${seller.name}`}
          className="w-full h-full object-cover"
        />
        {/* Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-black/25 to-black/40 pointer-events-none" />

        {/* Menu / Settings Button flottant (Paramètres et confidentialité) */}
        <button
          id="btn-seller-profile-menu"
          onClick={() => setIsSettingsOpen(true)}
          className="absolute top-3 right-3 p-2 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white/90 hover:text-white transition active:scale-95 flex items-center justify-center shadow-lg z-20"
          title="Paramètres et confidentialité"
          aria-label="Paramètres et confidentialité"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Change Banner Button */}
        <button
          onClick={() => bannerInputRef.current?.click()}
          className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-black/65 hover:bg-black/85 backdrop-blur-md border border-white/20 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-lg active:scale-95 transition z-10"
          title="Modifier la bannière de la boutique"
        >
          <Camera className="w-3.5 h-3.5 text-[#FF6321]" />
          <span>Bannière</span>
        </button>
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') {
                updateSeller(seller.id, { banner: reader.result });
                showToast('Bannière de la boutique mise à jour avec succès ! ✨');
              }
            };
            reader.readAsDataURL(file);
            e.currentTarget.value = '';
          }}
        />
      </div>

      {/* 3. USER PROFILE HEADER (Social-style & Centered with avatar overlapping banner) */}
      <div className="px-4 pb-4 -mt-12 flex flex-col items-center text-center space-y-3 relative z-10">
        {/* Avatar */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#0A0A0A] ring-2 ring-[#FF6321] shadow-2xl shadow-orange-600/30 bg-neutral-900">
            <img
              src={seller.avatar}
              alt={seller.name}
              className="w-full h-full object-cover"
            />
          </div>
          <button
            onClick={() => avatarInputRef.current?.click()}
            className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#FF6321] text-white shadow-lg border-2 border-[#0A0A0A] hover:scale-105 transition"
            title="Changer la photo de la boutique"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === 'string') {
                  updateSeller(seller.id, { avatar: reader.result });
                  showToast('Photo de la boutique mise à jour !');
                }
              };
              reader.readAsDataURL(file);
              e.currentTarget.value = '';
            }}
          />
        </div>

        {/* Identity */}
        <div>
          <div className="flex items-center justify-center gap-1.5">
            <h2 className="text-base font-bold text-white">{seller.name}</h2>
            {seller.verified && <ShieldCheck className="w-4 h-4 text-[#FF6321]" />}
          </div>
          <p className="text-xs text-[#FF6321] font-medium mt-0.5">@{seller.username}</p>
        </div>

        {/* Bio */}
        <p className="text-xs text-white/70 max-w-xs leading-relaxed">
          {seller.bio || 'Bienvenue sur la boutique officielle DJASSA ! Découvrez nos collections exclusives.'}
        </p>

        {/* Location & Contact */}
        <div className="flex items-center justify-center gap-3 text-[11px] text-white/50">
          <div className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-[#FF6321]" />
            <span>{seller.location}</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-white/30" />
          <div className="flex items-center gap-1">
            <Phone className="w-3.5 h-3.5 text-white/40" />
            <span>{seller.phone || '+225 07 00 00 00'}</span>
          </div>
        </div>

        {/* STATS ROW (Clickable interactive zones with vertical dividers) */}
        <div className="flex items-center justify-center gap-3 sm:gap-5 pt-1 w-full max-w-sm">
          {/* Abonnés */}
          <button
            id="btn-seller-stat-followers"
            type="button"
            onClick={() => setIsFollowersOpen(true)}
            className="flex flex-col items-center flex-1 p-2 rounded-2xl hover:bg-white/10 active:scale-95 transition cursor-pointer group"
            title="Voir les abonnés de la boutique"
          >
            <span className="text-sm font-extrabold text-white group-hover:text-[#FF6321] transition">
              {formatMetricCount(seller.followedCount)}
            </span>
            <span className="text-[11px] text-white/50 group-hover:text-white/80 font-medium mt-0.5 transition">
              👥 Abonnés
            </span>
          </button>

          <div className="w-px h-6 bg-white/10 shrink-0" />

          {/* Achats / Ventes (Statistique cliquable vers l'évolution de la boutique) */}
          <button
            id="btn-seller-stat-sales"
            type="button"
            onClick={() => setIsAnalyticsOpen(true)}
            className="flex flex-col items-center flex-1 p-2 rounded-2xl hover:bg-white/10 active:scale-95 transition cursor-pointer group"
            title="Voir l'évolution de la boutique au fil des mois et des années"
          >
            <span className="text-sm font-extrabold text-white group-hover:text-[#FF6321] transition">
              {formatMetricCount(seller.salesCount)}
            </span>
            <span className="text-[11px] text-white/50 group-hover:text-white/80 font-medium mt-0.5 transition">
              🛍️ Achats
            </span>
          </button>

          <div className="w-px h-6 bg-white/10 shrink-0" />

          {/* Produits */}
          <button
            id="btn-seller-stat-products"
            type="button"
            onClick={() => {
              setActiveSubTab('photos');
              tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              showToast(`${productCount} produits disponibles dans le catalogue 📦`);
            }}
            className="flex flex-col items-center flex-1 p-2 rounded-2xl hover:bg-white/10 active:scale-95 transition cursor-pointer group"
            title="Voir les produits du catalogue"
          >
            <span className="text-sm font-extrabold text-white group-hover:text-[#FF6321] transition">
              {formatMetricCount(productCount)}
            </span>
            <span className="text-[11px] text-white/50 group-hover:text-white/80 font-medium mt-0.5 transition">
              📦 Produits
            </span>
          </button>

          <div className="w-px h-6 bg-white/10 shrink-0" />

          {/* Note & Avis */}
          <button
            id="btn-seller-stat-reviews"
            type="button"
            onClick={() => {
              setActiveSubTab('avis');
              tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              showToast(`${seller.reviewsCount} avis et notes clients ⭐`);
            }}
            className="flex flex-col items-center flex-1 p-2 rounded-2xl hover:bg-white/10 active:scale-95 transition cursor-pointer group"
            title="Consulter les avis clients"
          >
            <span className="text-sm font-extrabold text-amber-400 group-hover:scale-105 transition">
              {seller.rating} ★
            </span>
            <span className="text-[11px] text-white/50 group-hover:text-white/80 font-medium mt-0.5 transition">
              ⭐ Avis
            </span>
          </button>
        </div>

        {/* Primary Action Buttons: Modifier le profil + ChatGPT Vendeur */}
        <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
          <button
            id="btn-edit-seller-profile"
            onClick={() => setIsEditProfileOpen(true)}
            className="py-2 px-5 rounded-xl bg-white/5 hover:bg-white/10 text-white/90 border border-white/10 text-xs font-bold flex items-center gap-1.5 transition backdrop-blur-md active:scale-95 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-[#FF6321]" />
            <span>Modifier le profil</span>
          </button>

          <button
            id="btn-seller-chatgpt"
            type="button"
            onClick={() => {
              setSellerActiveTab('chatgpt');
              showToast("ChatGPT Vendeur ouvert 🚀");
            }}
            className="py-2 px-4 rounded-xl bg-[#212121] hover:bg-[#282828] text-white border border-[#10A37F]/50 hover:border-[#10A37F] text-xs font-bold flex items-center gap-2 transition backdrop-blur-md active:scale-95 shadow-md shadow-[#10A37F]/15 cursor-pointer group"
            title="Ouvrir ChatGPT pour optimiser vos ventes"
          >
            <div className="w-4.5 h-4.5 rounded-full bg-white text-black flex items-center justify-center p-0.5 shadow">
              <ChatGptLogo className="w-3 h-3" />
            </div>
            <span>ChatGPT</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#10A37F]/25 text-emerald-300 font-extrabold border border-[#10A37F]/40">
              Vendeur
            </span>
          </button>
        </div>
      </div>

      {/* 3. CONTENT TABS: Photos | Vidéos | Mes créations | Achats | Avis */}
      <div
        ref={tabsRef}
        id="seller-profile-tabs-bar"
        className="w-full max-w-full min-w-0 shrink-0 border-t border-b border-white/10 bg-[#0A0A0A]/95 backdrop-blur-xl sticky top-0 z-20 min-h-[48px] flex items-center"
      >
        <div className="w-full min-w-0 flex items-center gap-6 overflow-x-auto no-scrollbar touch-pan-x scroll-smooth text-xs font-bold px-4">
          <button
            id="tab-seller-photos"
            onClick={() => setActiveSubTab('photos')}
            className={`shrink-0 whitespace-nowrap px-2.5 h-[48px] flex items-center justify-center gap-2 transition cursor-pointer ${
              activeSubTab === 'photos'
                ? 'text-[#FF6321] border-b-2 border-[#FF6321]'
                : 'text-white/50 hover:text-white/80 border-b-2 border-transparent'
            }`}
            title="Publications photos"
          >
            <LayoutGrid className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Photos ({photos.length})</span>
          </button>

          <button
            id="tab-seller-videos"
            onClick={() => setActiveSubTab('videos')}
            className={`shrink-0 whitespace-nowrap px-2.5 h-[48px] flex items-center justify-center gap-2 transition cursor-pointer ${
              activeSubTab === 'videos'
                ? 'text-[#FF6321] border-b-2 border-[#FF6321]'
                : 'text-white/50 hover:text-white/80 border-b-2 border-transparent'
            }`}
            title="Vidéos publiées"
          >
            <VideoIcon className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Vidéos ({videos.length})</span>
          </button>

          <button
            id="tab-seller-creations"
            onClick={() => setActiveSubTab('creations')}
            className={`shrink-0 whitespace-nowrap px-2.5 h-[48px] flex items-center justify-center gap-2 transition cursor-pointer ${
              activeSubTab === 'creations'
                ? 'text-[#FF6321] border-b-2 border-[#FF6321]'
                : 'text-white/50 hover:text-white/80 border-b-2 border-transparent'
            }`}
            title="Toutes mes créations photos, vidéos et clips IA"
          >
            <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
            <span className="whitespace-nowrap">Mes créations ({totalCreationsCount})</span>
          </button>

          <button
            id="tab-seller-achats"
            onClick={() => setActiveSubTab('achats')}
            className={`shrink-0 whitespace-nowrap px-2.5 h-[48px] flex items-center justify-center gap-2 transition cursor-pointer ${
              activeSubTab === 'achats'
                ? 'text-[#FF6321] border-b-2 border-[#FF6321]'
                : 'text-white/50 hover:text-white/80 border-b-2 border-transparent'
            }`}
            title="Classement des articles les plus achetés et popularité"
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Achats ({formatMetricCount(seller.salesCount)})</span>
          </button>

          <button
            id="tab-seller-avis"
            onClick={() => setActiveSubTab('avis')}
            className={`shrink-0 whitespace-nowrap px-2.5 h-[48px] flex items-center justify-center gap-2 transition cursor-pointer ${
              activeSubTab === 'avis'
                ? 'text-[#FF6321] border-b-2 border-[#FF6321]'
                : 'text-white/50 hover:text-white/80 border-b-2 border-transparent'
            }`}
            title="Avis et commentaires clients"
          >
            <Star className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">Avis ({seller.reviewsCount})</span>
          </button>
        </div>
      </div>

      {/* 4. TAB CONTENT GRID */}
      <div className="p-3 flex-1">
        {/* PHOTOS TAB */}
        {activeSubTab === 'photos' && (
          <SellerPhotosTab
            photos={photos}
            onSelectProduct={setSelectedProduct}
            onGoAddPhoto={() => onGoAdd?.()}
            showToast={showToast}
          />
        )}

        {/* VIDEOS TAB */}
        {activeSubTab === 'videos' && (
          <SellerVideosTab
            videos={videos}
            onOpenVideoViewer={openVideoViewer}
            onSelectProduct={setSelectedProduct}
            onGoAddVideo={() => onGoAdd?.()}
            showToast={showToast}
          />
        )}

        {/* MES CREATIONS TAB */}
        {activeSubTab === 'creations' && (
          <SellerCreationsTab
            seller={seller}
            photos={photos}
            videos={videos}
            onSelectProduct={setSelectedProduct}
            onOpenVideoViewer={openVideoViewer}
            onGoAddCreation={() => onGoAdd?.('ia_creator')}
            showToast={showToast}
          />
        )}

        {/* ACHATS / POPULARITE TAB */}
        {activeSubTab === 'achats' && (
          <SellerSalesTab
            seller={seller}
            products={products}
            onSelectProduct={setSelectedProduct}
            showToast={showToast}
          />
        )}

        {/* REVIEWS TAB */}
        {activeSubTab === 'avis' && (
          <SellerReviewsTab
            seller={seller}
            products={products}
            isSellerSelf={true}
            onSelectProduct={setSelectedProduct}
            showToast={showToast}
          />
        )}
      </div>

      {/* 5. EDIT PROFILE FULL SCREEN */}
      <SellerEditProfileScreen
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        seller={seller}
      />

      {/* 8. WITHDRAWAL MODAL */}
      {isWithdrawOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#141414] border border-white/10 rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-400" />
                  Retirer mes gains
                </h3>
                <span className="text-[10px] text-white/50">Virement immédiat Mobile Money</span>
              </div>
              <button onClick={() => setIsWithdrawOpen(false)} className="p-1 rounded-full text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Balance Badge */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
              <span className="text-xs text-white/60">Solde disponible</span>
              <b className="text-lg text-[#FF6321]">{formatFCFA(balance)}</b>
            </div>

            <form onSubmit={handleRequestWithdrawal} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">Montant à retirer (FCFA)</label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Ex: 25000"
                  max={balance}
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">Opérateur de retrait</label>
                <select
                  value={withdrawProvider}
                  onChange={(e) => setWithdrawProvider(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl bg-[#1c1c1c] border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                >
                  <option value="wave">Wave Mobile Money</option>
                  <option value="orange_money">Orange Money Côte d'Ivoire</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">Numéro de réception</label>
                <input
                  type="tel"
                  value={withdrawPhone}
                  onChange={(e) => setWithdrawPhone(e.target.value)}
                  placeholder="07 00 00 00 00"
                  className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                  required
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsWithdrawOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-white/70 text-xs font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={balance <= 0}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6321] disabled:opacity-40 text-white text-xs font-black"
                >
                  Confirmer le retrait
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. TIKTOK-STYLE SETTINGS & PRIVACY PAGE */}
      {isSettingsOpen && (
        <SellerSettingsPrivacyScreen
          seller={seller}
          onClose={() => setIsSettingsOpen(false)}
          onSignOut={onSignOut}
        />
      )}

      {/* 12. SELLER FOLLOWERS MODAL (ZONE CLIQUABLE STAT: ABONNÉS) */}
      {isFollowersOpen && (
        <SellerFollowersModal
          seller={seller}
          onClose={() => setIsFollowersOpen(false)}
          onShowToast={showToast}
        />
      )}
    </div>
  );
};
