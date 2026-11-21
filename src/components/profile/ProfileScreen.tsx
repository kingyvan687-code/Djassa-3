import React, { useRef, useState, useMemo } from 'react';
import { 
  Menu, 
  Edit3, 
  Heart, 
  Bookmark, 
  History, 
  ShoppingBag, 
  Play, 
  MapPin, 
  Check, 
  X, 
  Camera,
  LogOut,
  Store,
  Sparkles,
  Trash2,
  UserPlus,
  LogIn
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FollowedSellersModal } from './FollowedSellersModal';
import { ActivityModal } from './ActivityModal';
import { MyDataModal } from './MyDataModal';
import { SettingsModal } from './SettingsModal';
import { SettingsAndPrivacyScreen } from './SettingsAndPrivacyScreen';
import { EditProfileScreen } from './EditProfileScreen';
import { LikedTabContent } from './LikedTabContent';
import { SavedTabContent } from './SavedTabContent';
import { HistoryTabContent } from './HistoryTabContent';
import { PurchasesTabContent } from './PurchasesTabContent';
import { TryOnTabContent } from './TryOnTabContent';
import { PurchasedProductsModal } from './PurchasedProductsModal';
import { formatFCFA, formatMetricCount } from '../../services/marketServices';
import { clientService } from '../../services/clientService';
import { getSecurityToken } from '../../services/securityService';

export const ProfileScreen: React.FC = () => {
  const { 
    userProfile, 
    updateProfile, 
    products, 
    sellers,
    orders, 
    userActivity,
    setSelectedOrder,
    setSelectedProduct,
    openVideoViewer,
    toggleLikeVideo,
    toggleSaveProduct,
    addToCart,
    removeHistoryItem,
    clearHistory,
    setActiveTab,
    showToast,
    signOut,
    tryOnHistory,
    removeTryOnHistoryItem,
    openTryOnModal,
    isAuthenticated,
    visitorQuota,
    openAuthModal,
    requireAuth
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'liked' | 'saved' | 'history' | 'purchases' | 'tryon'>('liked');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isFollowedSellersOpen, setIsFollowedSellersOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isMyDataOpen, setIsMyDataOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPurchasedProductsOpen, setIsPurchasedProductsOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // Edit form state
  const [editName, setEditName] = useState(userProfile.name);
  const [editUsername, setEditUsername] = useState(userProfile.username);
  const [editBio, setEditBio] = useState(userProfile.bio);
  const [editCommune, setEditCommune] = useState(userProfile.deliveryCommune);

  const likedProducts = products.filter((p) => userProfile.likedVideoIds.includes(p.id));
  const savedProducts = products.filter((p) => userProfile.savedItemIds.includes(p.id));
  const historyProducts = useMemo(() => {
    const orderedIds = Array.from(
      new Set([
        ...(userProfile.viewingHistory || []).map((h) => h.videoId),
        ...(userActivity.viewedProductIds || [])
      ])
    );
    const byId = new Map(products.map((p) => [p.id, p]));
    return orderedIds
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
  }, [products, userProfile.viewingHistory, userActivity.viewedProductIds]);
  const purchasedEntries = orders.flatMap((order) =>
    order.items
      .map((item) => ({ order, item, product: products.find((p) => p.id === item.productId) }))
      .filter((entry) => Boolean(entry.product))
  );

  // Colis livrés exclusivement pour l'onglet Histoire (tous livrés, aucun en cours)
  const deliveredOrders = useMemo(() => {
    return orders.filter((o) => o.status === 'delivered');
  }, [orders]);

  // Tous les colis et cartes en cours de livraison pour l'onglet Achats
  const inProgressPurchasedEntries = useMemo(() => {
    return purchasedEntries.filter((e) => e.order.status !== 'delivered');
  }, [purchasedEntries]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = editName.trim();
    const cleanUsername = editUsername.trim().replace(/^@/, '');
    const cleanBio = editBio.trim();
    const cleanCommune = editCommune.trim();

    if (getSecurityToken()) {
      try {
        await clientService.updateAuthProfile({
          name: cleanName,
          username: cleanUsername,
          bio: cleanBio,
          commune: cleanCommune
        });
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde du profil.');
        return;
      }
    }

    updateProfile({
      name: cleanName,
      username: cleanUsername,
      bio: cleanBio,
      commune: cleanCommune
    });
    setIsEditProfileOpen(false);
    showToast('Profil mis à jour avec succès !');
  };

  return (
    <div id="profile-screen" className="with-bottom-nav w-full min-h-0 bg-transparent text-white flex flex-col overflow-y-auto no-scrollbar">
      {/* TOP BAR */}
      <div className="sticky top-0 z-30 bg-[#0A0A0A]/85 backdrop-blur-xl px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('accueil')}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition"
            aria-label="Retour à l'accueil"
          >
            <span className="text-base leading-none">←</span>
          </button>
          <span className="text-sm font-bold text-white">Profil</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="btn-open-profile-menu"
            onClick={() => setIsMenuOpen(true)}
            className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* USER PROFILE HEADER (Social-style) */}
      <div className="p-4 flex flex-col items-center text-center space-y-3">
        {/* Avatar */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#FF6321] shadow-xl shadow-orange-600/20">
            <img
              src={userProfile.avatar}
              alt={userProfile.name}
              className="w-full h-full object-cover"
            />
          </div>
          {isAuthenticated && (
            <>
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#FF6321] text-white shadow border-2 border-neutral-950"
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
                      updateProfile({ avatar: reader.result });
                      showToast('Photo de profil mise à jour !');
                    }
                  };
                  reader.readAsDataURL(file);
                  e.currentTarget.value = '';
                }}
              />
            </>
          )}
        </div>

        {/* Identity */}
        <div>
          <h2 id="profile-display-name" className="text-base font-bold text-white">
            {isAuthenticated ? userProfile.name : 'Visiteur DJASSA'}
          </h2>
          <p className="text-xs text-[#FF6321] font-medium mt-0.5">
            @{isAuthenticated ? userProfile.username : 'visiteur'}
          </p>
        </div>

        {/* Bio */}
        <p className="text-xs text-white/70 max-w-xs leading-relaxed">
          {isAuthenticated
            ? userProfile.bio
            : 'Explorez DJASSA librement, aimez et enregistrez vos coups de cœur avant de créer votre compte.'}
        </p>

        <div className="flex items-center gap-1 text-[11px] text-white/50">
          <MapPin className="w-3.5 h-3.5 text-[#FF6321]" />
          <span>{userProfile.deliveryCommune || 'Cocody'}, Abidjan</span>
        </div>

        {/* STATS ROW (STRICT RULE: CLIENT -> SELLER ONLY. NO CLIENT FOLLOWERS) */}
        <div className="flex items-center justify-center gap-7 pt-1">
          {/* 👥 Vendeurs suivis */}
          <button
            id="btn-stat-followed-sellers"
            onClick={() => {
              if (!requireAuth('follow')) return;
              setIsFollowedSellersOpen(true);
            }}
            className="flex flex-col items-center hover:opacity-80 transition"
          >
            <span className="text-sm font-extrabold text-white">
              {formatMetricCount(isAuthenticated ? userProfile.followedSellerIds.length : 0)}
            </span>
            <span className="text-[11px] text-white/50 font-medium mt-0.5">
              👥 Vendeurs suivis
            </span>
          </button>

          <div className="w-px h-6 bg-white/10" />

          {/* ❤️ J'aime */}
          <div className="flex flex-col items-center">
            <span className="text-sm font-extrabold text-white">
              {formatMetricCount(userProfile.likedVideoIds.length)}
            </span>
            <span className="text-[11px] text-white/50 font-medium mt-0.5">
              ❤️ J'aime
            </span>
          </div>

          <div className="w-px h-6 bg-white/10" />

          {/* 🛍️ Achats effectués */}
          <button
            id="btn-stat-purchases-history"
            onClick={() => {
              if (!requireAuth('orders', { type: 'open_orders' })) return;
              setIsPurchasedProductsOpen(true);
            }}
            className="flex flex-col items-center hover:opacity-80 transition group"
            title="Voir la liste des produits achetés et le nombre d'acheteurs"
          >
            <span className="text-sm font-extrabold text-white group-hover:text-[#FF6321] transition">
              {formatMetricCount(isAuthenticated ? (purchasedEntries.length || deliveredOrders.length) : 0)}
            </span>
            <span className="text-[11px] text-white/50 font-medium mt-0.5 group-hover:text-white/80 transition">
              🛍️ Achats effectués
            </span>
          </button>
        </div>

        {isAuthenticated ? (
          <>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsActivityOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-semibold text-white/70 hover:text-white hover:bg-white/10 transition"
              >
                📊 Activité
              </button>
              <button
                id="btn-profile-logout"
                type="button"
                onClick={signOut}
                className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] font-black text-red-400 hover:bg-red-500/20 transition flex items-center gap-1.5"
              >
                <LogOut className="w-3 h-3" />
                Déconnexion
              </button>
            </div>

            <button
              id="btn-edit-profile"
              onClick={() => setIsEditProfileOpen(true)}
              className="mt-1 py-2 px-6 rounded-xl bg-white/5 hover:bg-white/10 text-white/90 border border-white/10 text-xs font-bold flex items-center gap-2 transition backdrop-blur-md"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#FF6321]" />
              <span>Modifier le profil</span>
            </button>
          </>
        ) : (
          <div className="w-full max-w-xs space-y-2.5 pt-1">
            <div className="flex items-center gap-2">
              <button
                id="btn-visitor-profile-register"
                type="button"
                onClick={() =>
                  openAuthModal('account', {
                    initialMode: 'register',
                    directToAuthForm: true,
                    pendingAction: { type: 'open_profile' }
                  })
                }
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white text-xs font-extrabold shadow-lg shadow-orange-600/25 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Créer un compte</span>
              </button>

              <button
                id="btn-visitor-profile-login"
                type="button"
                onClick={() =>
                  openAuthModal('account', {
                    initialMode: 'login',
                    directToAuthForm: true,
                    pendingAction: { type: 'open_profile' }
                  })
                }
                className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-[#FF854D]" />
                <span>Se connecter</span>
              </button>
            </div>

            <p
              id="visitor-daily-quota-summary"
              className="text-[10.5px] text-white/55 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5"
            >
              Aujourd’hui : {visitorQuota.likes.used}/{visitorQuota.likes.limit} J'aime ·{' '}
              {visitorQuota.favorites.used}/{visitorQuota.favorites.limit} Favoris ·{' '}
              {visitorQuota.ai.used}/{visitorQuota.ai.limit} Questions IA
            </p>
          </div>
        )}

      </div>

      {/* CONTENT TABS: J'aime | Enregistrés | Histoire (Colis livrés) | Achats (En cours de livraison) | Essayages (Photos générées) */}
      <div className="border-t border-b border-white/10 flex bg-[#0A0A0A]/60 backdrop-blur-md text-xs font-bold overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveSubTab('liked')}
          className={`flex-1 min-w-[76px] py-3 px-2 flex items-center justify-center gap-1 transition shrink-0 ${
            activeSubTab === 'liked'
              ? 'text-[#FF6321] border-b-2 border-[#FF6321]'
              : 'text-white/40 hover:text-white/70'
          }`}
          title="Vidéos aimées"
        >
          <Heart className={`w-3.5 h-3.5 ${activeSubTab === 'liked' ? 'fill-[#FF6321]' : ''}`} />
          <span>J'aime ({formatMetricCount(likedProducts.length)})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('saved')}
          className={`flex-1 min-w-[84px] py-3 px-2 flex items-center justify-center gap-1 transition shrink-0 ${
            activeSubTab === 'saved'
              ? 'text-[#FF6321] border-b-2 border-[#FF6321]'
              : 'text-white/40 hover:text-white/70'
          }`}
          title="Produits enregistrés"
        >
          <Bookmark className={`w-3.5 h-3.5 ${activeSubTab === 'saved' ? 'fill-[#FF6321]' : ''}`} />
          <span>Enregistrés ({formatMetricCount(savedProducts.length)})</span>
        </button>

        <button
          id="profile-subtab-history"
          onClick={() => setActiveSubTab('history')}
          className={`flex-1 min-w-[80px] py-3 px-2 flex items-center justify-center gap-1 transition shrink-0 ${
            activeSubTab === 'history'
              ? 'text-[#FF6321] border-b-2 border-[#FF6321]'
              : 'text-white/40 hover:text-white/70'
          }`}
          title={isAuthenticated ? 'Historique de tous les colis livrés' : 'Historique de navigation local'}
        >
          <History className="w-3.5 h-3.5" />
          <span>
            Historique ({formatMetricCount(isAuthenticated ? deliveredOrders.length : historyProducts.length)})
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('purchases')}
          className={`flex-1 min-w-[76px] py-3 px-2 flex items-center justify-center gap-1 transition shrink-0 ${
            activeSubTab === 'purchases'
              ? 'text-[#FF6321] border-b-2 border-[#FF6321]'
              : 'text-white/40 hover:text-white/70'
          }`}
          title="Commandes en cours de livraison"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Achats ({formatMetricCount(inProgressPurchasedEntries.length)})</span>
        </button>

        {/* 5th TAB: Essayages (Photos que le client a essayées / générées comme image) */}
        <button
          id="profile-subtab-tryon"
          onClick={() => setActiveSubTab('tryon')}
          className={`flex-1 min-w-[86px] py-3 px-2 flex items-center justify-center gap-1 transition shrink-0 ${
            activeSubTab === 'tryon'
              ? 'text-[#FF6321] border-b-2 border-[#FF6321]'
              : 'text-white/40 hover:text-white/70'
          }`}
          title="Photos d'essayages virtuels générées par IA"
        >
          <Sparkles className={`w-3.5 h-3.5 ${activeSubTab === 'tryon' ? 'text-[#FF6321]' : ''}`} />
          <span>Essayages ({formatMetricCount(tryOnHistory.length)})</span>
        </button>
      </div>

      {/* TAB CONTENT GRID */}
      <div className="p-3 flex-1">
        {activeSubTab === 'liked' && (
          <LikedTabContent
            likedProducts={likedProducts}
            sellers={sellers}
            onOpenVideoViewer={openVideoViewer}
            onSelectProduct={setSelectedProduct}
            onToggleLike={toggleLikeVideo}
            onAddToCart={(productId) => addToCart(productId, {}, 1)}
            onNavigateFeed={() => setActiveTab('accueil')}
          />
        )}

        {activeSubTab === 'saved' && (
          <SavedTabContent
            savedProducts={savedProducts}
            sellers={sellers}
            onOpenVideoViewer={openVideoViewer}
            onSelectProduct={setSelectedProduct}
            onToggleSave={toggleSaveProduct}
            onAddToCart={(productId) => addToCart(productId, {}, 1)}
            onNavigateExplore={() => setActiveTab('explorer')}
          />
        )}

        {activeSubTab === 'history' &&
          (isAuthenticated ? (
            <HistoryTabContent
              orders={deliveredOrders}
              products={products}
              sellers={sellers}
              onSelectOrder={setSelectedOrder}
              onSelectProduct={setSelectedProduct}
              onNavigateFeed={() => setActiveTab('accueil')}
              onShowToast={showToast}
              onOpenPurchasedProducts={() => setIsPurchasedProductsOpen(true)}
            />
          ) : (
            <div id="visitor-history-tab" className="space-y-3 pb-8">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-extrabold text-white">
                  Historique de navigation ({historyProducts.length})
                </span>
                {historyProducts.length > 0 && (
                  <button
                    type="button"
                    id="btn-clear-visitor-history"
                    onClick={clearHistory}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-white/70 hover:text-white flex items-center gap-1 transition"
                  >
                    <Trash2 className="w-3 h-3 text-rose-400" />
                    <span>Tout effacer</span>
                  </button>
                )}
              </div>

              {historyProducts.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-3xl bg-white/[0.02] border border-white/5 space-y-3">
                  <History className="w-8 h-8 text-[#FF6321] mx-auto" />
                  <p className="text-xs font-bold text-white/80">
                    Aucune vidéo ou fiche produit consultée pour le moment
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('accueil')}
                    className="px-4 py-2 rounded-full bg-[#FF6321] text-white text-xs font-extrabold"
                  >
                    Découvrir le fil
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {historyProducts.map((prod) => (
                    <div
                      key={prod.id}
                      onClick={() => setSelectedProduct(prod)}
                      className="relative rounded-2xl overflow-hidden bg-neutral-900 border border-white/10 aspect-[9/13] flex flex-col justify-end cursor-pointer group"
                    >
                      <img
                        src={prod.images?.[0] || prod.videoPoster}
                        alt={prod.name}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeHistoryItem(prod.id);
                        }}
                        aria-label="Retirer de l'historique"
                        className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-black/70 border border-white/20 text-white/80 hover:text-white flex items-center justify-center"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <div className="relative z-10 p-2.5 space-y-0.5">
                        <p className="text-xs font-extrabold text-white line-clamp-2">{prod.name}</p>
                        <p className="text-xs font-black text-[#FF6321]">{formatFCFA(prod.price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

        {activeSubTab === 'purchases' &&
          (isAuthenticated ? (
            <PurchasesTabContent
              purchasedEntries={inProgressPurchasedEntries}
              sellers={sellers}
              onSelectOrder={setSelectedOrder}
              onSelectProduct={setSelectedProduct}
              onNavigateExplore={() => setActiveTab('explorer')}
              onOpenPurchasedProducts={() => setIsPurchasedProductsOpen(true)}
            />
          ) : (
            <div className="rounded-3xl bg-[#121216] border border-white/10 p-6 text-center space-y-3">
              <ShoppingBag className="w-8 h-8 text-[#FF6321] mx-auto" />
              <h3 className="text-sm font-black text-white">Vos commandes en cours</h3>
              <p className="text-xs text-white/65">
                Connectez-vous ou créez un compte DJASSA pour suivre vos commandes et paiements.
              </p>
              <button
                type="button"
                onClick={() => openAuthModal('orders', { initialMode: 'register', pendingAction: { type: 'open_orders' } })}
                className="px-5 py-2.5 rounded-full bg-[#FF6321] text-white text-xs font-extrabold"
              >
                Créer un compte / Se connecter
              </button>
            </div>
          ))}

        {activeSubTab === 'tryon' &&
          (isAuthenticated ? (
            <TryOnTabContent
              tryOnHistory={tryOnHistory}
              products={products}
              sellers={sellers}
              onSelectProduct={setSelectedProduct}
              onOpenTryOn={openTryOnModal}
              onRemoveItem={removeTryOnHistoryItem}
              onAddToCart={(productId, options) => addToCart(productId, options, 1)}
              onNavigateFeed={() => setActiveTab('accueil')}
            />
          ) : (
            <div className="rounded-3xl bg-[#121216] border border-white/10 p-6 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-[#FF6321] mx-auto" />
              <h3 className="text-sm font-black text-white">Studio Essayage IA</h3>
              <p className="text-xs text-white/65">
                Connectez-vous pour essayer virtuellement des articles sur votre photo et retrouver
                vos looks enregistrés.
              </p>
              <button
                type="button"
                onClick={() => openAuthModal('tryon', { initialMode: 'register' })}
                className="px-5 py-2.5 rounded-full bg-[#FF6321] text-white text-xs font-extrabold"
              >
                Créer un compte / Se connecter
              </button>
            </div>
          ))}
      </div>

      {/* TIKTOK-STYLE EDIT PROFILE SCREEN */}
      <EditProfileScreen
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
      />

      {/* TIKTOK-STYLE SETTINGS AND PRIVACY SCREEN */}
      <SettingsAndPrivacyScreen
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onNavigateHistory={() => setActiveSubTab('history')}
        onNavigatePurchases={() => setActiveSubTab('purchases')}
        onNavigatePurchasedProducts={() => setIsPurchasedProductsOpen(true)}
        onOpenActivity={() => setIsActivityOpen(true)}
      />

      {isPurchasedProductsOpen && (
        <PurchasedProductsModal onClose={() => setIsPurchasedProductsOpen(false)} />
      )}

      {isFollowedSellersOpen && (
        <FollowedSellersModal onClose={() => setIsFollowedSellersOpen(false)} />
      )}

      {isActivityOpen && (
        <ActivityModal onClose={() => setIsActivityOpen(false)} />
      )}

      {isMyDataOpen && (
        <MyDataModal onClose={() => setIsMyDataOpen(false)} />
      )}

      {isSettingsOpen && (
        <SettingsModal onClose={() => setIsSettingsOpen(false)} />
      )}
    </div>
  );
};
