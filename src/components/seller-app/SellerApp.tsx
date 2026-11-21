import React, { useState, useMemo, lazy, Suspense } from 'react';
import { Store, ShoppingBag, PlusCircle, MessageCircle, UserCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SellerTabType } from '../../types';

const SellerBoutiqueScreen = lazy(() =>
  import('./SellerBoutiqueScreen').then((m) => ({ default: m.SellerBoutiqueScreen }))
);
const SellerOrdersScreen = lazy(() =>
  import('./SellerOrdersScreen').then((m) => ({ default: m.SellerOrdersScreen }))
);
const SellerRevenuesScreen = lazy(() =>
  import('./SellerRevenuesScreen').then((m) => ({ default: m.SellerRevenuesScreen }))
);
const SellerAddScreen = lazy(() =>
  import('./SellerAddScreen').then((m) => ({ default: m.SellerAddScreen }))
);
const SellerDiscussionsScreen = lazy(() =>
  import('./discussions/SellerDiscussionsScreen').then((m) => ({ default: m.SellerDiscussionsScreen }))
);
const SellerProfileScreen = lazy(() =>
  import('./SellerProfileScreen').then((m) => ({ default: m.SellerProfileScreen }))
);
const SellerChatGptScreen = lazy(() =>
  import('./chatgpt/SellerChatGptScreen').then((m) => ({ default: m.SellerChatGptScreen }))
);

const SellerTabFallback = () => (
  <div className="w-full h-full bg-[#0A0A0A] flex items-center justify-center">
    <div className="w-7 h-7 rounded-full border-2 border-white/15 border-t-[#FF6321] animate-spin" />
  </div>
);

export const SellerApp: React.FC = () => {
  const { sellers, products, orders, signOut, currentSellerId, sellerActiveTab, setSellerActiveTab, activeConversationId, userProfile } = useApp();
  const activeTab = sellerActiveTab;
  const setActiveTab = setSellerActiveTab;

  const currentSeller = useMemo(() => {
    const matchedSeller = sellers.find((s) => s.id === currentSellerId) || sellers[0];
    return (
      matchedSeller || {
        id: currentSellerId || userProfile?.id || 'seller-1',
        name: userProfile?.name || 'Ma Boutique DJASSA',
        storeName: userProfile?.name || 'Ma Boutique DJASSA',
        username: userProfile?.username || 'boutique.djassa',
        avatar: userProfile?.avatar || 'https://images.unsplash.com/photo-1589156280159-27698a70f29e?w=200',
        location: userProfile?.deliveryCommune ? `${userProfile.deliveryCommune}, Abidjan` : 'Abidjan, Côte d’Ivoire',
        verified: true,
        rating: 4.8,
        reviewsCount: 0,
        followedCount: 0,
        salesCount: 0,
        bio: userProfile?.bio || 'Boutique officielle partenaire DJASSA.',
        banner: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1000',
        phone: userProfile?.phone || '',
        email: userProfile?.email || '',
        badges: ['Boutique Active']
      }
    );
  }, [sellers, currentSellerId, userProfile]);

  const sellerProducts = useMemo(
    () => products.filter((p) => p.sellerId === currentSeller.id),
    [products, currentSeller.id]
  );

  const sellerProductIds = useMemo(() => new Set(sellerProducts.map((p) => p.id)), [sellerProducts]);

  const sellerOrders = useMemo(
    () =>
      orders.filter((o) =>
        o.items.some((item) => item.sellerId === currentSeller.id || sellerProductIds.has(item.productId))
      ),
    [orders, currentSeller.id, sellerProductIds]
  );

  const totalRevenue = useMemo(
    () => sellerOrders.reduce((sum, o) => sum + o.total, 0),
    [sellerOrders]
  );

  const unreadDiscussionsCount = 3;
  const pendingOrdersCount = useMemo(
    () =>
      sellerOrders.filter(
        (o) => !['cancelled', 'returned', 'damaged'].includes(o.status)
      ).length,
    [sellerOrders]
  );

  const [addInitialTab, setAddInitialTab] = useState<'product' | 'video' | 'ia_creator'>('product');

  return (
    <div id="seller-app-container" className="w-full h-full flex flex-col bg-[#0A0A0A] text-white overflow-hidden select-none">
      <main className="flex-1 min-h-0 overflow-hidden">
        <Suspense fallback={<SellerTabFallback />}>
          {activeTab === 'boutique' && (
            <SellerBoutiqueScreen
              seller={currentSeller}
              products={sellerProducts}
              onGoAdd={() => {
                setAddInitialTab('product');
                setActiveTab('ajouter');
              }}
            />
          )}
          {activeTab === 'commandes' && (
            <SellerOrdersScreen orders={sellerOrders} products={products} />
          )}
          {activeTab === 'revenus' && (
            <SellerRevenuesScreen
              seller={currentSeller}
              products={sellerProducts}
              orders={orders}
              isStandalone={true}
            />
          )}
          {activeTab === 'ajouter' && (
            <SellerAddScreen
              sellerId={currentSeller.id}
              products={sellerProducts}
              initialTab={addInitialTab}
            />
          )}
          {activeTab === 'discussions' && (
            <div className="h-full overflow-hidden">
              <SellerDiscussionsScreen
                seller={currentSeller}
                products={sellerProducts}
                orders={sellerOrders}
              />
            </div>
          )}
          {activeTab === 'profil' && (
            <SellerProfileScreen
              seller={currentSeller}
              products={sellerProducts}
              totalRevenue={totalRevenue}
              productCount={sellerProducts.length}
              onSignOut={signOut}
              onGoAdd={(tab?: 'product' | 'video' | 'ia_creator') => {
                setAddInitialTab(tab || 'ia_creator');
                setActiveTab('ajouter');
              }}
            />
          )}
          {activeTab === 'chatgpt' && (
            <SellerChatGptScreen
              seller={currentSeller}
              products={sellerProducts}
            />
          )}
        </Suspense>
      </main>

      {/* BOTTOM NAVIGATION: Inspired by client home page & TikTok styling */}
      <nav
        id="seller-bottom-navigation"
        className={`shrink-0 h-[64px] border-t border-white/10 bg-[#0A0A0A]/95 backdrop-blur-xl items-center justify-around px-2 pb-safe z-20 ${
          activeTab === 'discussions' && activeConversationId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* 1. Boutique (Solid filled shape with cutouts like Messages button) */}
        <button
          onClick={() => setActiveTab('boutique')}
          aria-label="Boutique"
          aria-current={activeTab === 'boutique' ? 'page' : undefined}
          className={`relative h-full flex flex-col flex-1 items-center justify-center gap-0.5 select-none transition-all duration-200 active:scale-90 ${
            activeTab === 'boutique' ? 'text-[#FF6321] scale-105' : 'text-white/60 hover:text-white/90'
          }`}
        >
          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              className={`w-5 h-5 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] transition-all ${
                activeTab === 'boutique'
                  ? 'text-[#FF6321] fill-[#FF6321]'
                  : 'text-white/60 fill-white/60'
              }`}
            >
              {/* Solid Boutique/House silhouette with door cutout */}
              <path d="M12 2.2a1.5 1.5 0 00-.97.35L2.6 9.42a1.2 1.2 0 00-.4.91V20a2 2 0 002 2h5a1 1 0 001-1v-5a1 1 0 011-1h3.6a1 1 0 011 1v5a1 1 0 001 1h4.2a2 2 0 002-2v-9.67a1.2 1.2 0 00-.4-.91l-8.43-6.87A1.5 1.5 0 0012 2.2z" />
              {/* Circular window cutout matching the Messages button dots */}
              <circle cx="12" cy="7.5" r="1.2" fill="#0A0A0A" />
            </svg>
          </div>
          <span className={`text-[10px] tracking-tight font-medium ${activeTab === 'boutique' ? 'font-black' : ''}`}>
            Boutique
          </span>
          {activeTab === 'boutique' && (
            <span className="w-1 h-1 rounded-full bg-[#FF6321] mt-0.5 shadow-sm shadow-[#FF6321]" />
          )}
        </button>

        {/* 2. Commandes (Solid filled shopping bag with rivets like Messages button) */}
        <button
          onClick={() => setActiveTab('commandes')}
          aria-label="Commandes"
          aria-current={activeTab === 'commandes' ? 'page' : undefined}
          className={`relative h-full flex flex-col flex-1 items-center justify-center gap-0.5 select-none transition-all duration-200 active:scale-90 ${
            activeTab === 'commandes' ? 'text-[#FF6321] scale-105' : 'text-white/60 hover:text-white/90'
          }`}
        >
          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              className={`w-5 h-5 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] transition-all ${
                activeTab === 'commandes'
                  ? 'text-[#FF6321] fill-[#FF6321]'
                  : 'text-white/60 fill-white/60'
              }`}
            >
              {/* Solid Shopping Bag Body + Handle Cutout */}
              <path d="M19 6.5h-2.5C16.5 4 14.5 2 12 2S7.5 4 7.5 6.5H5c-1.1 0-2 .9-2 2v11.5c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8.5c0-1.1-.9-2-2-2zM12 3.8c1.5 0 2.7 1.2 2.7 2.7H9.3c0-1.5 1.2-2.7 2.7-2.7z" />
              {/* Rivet cutouts matching the Messages button dots */}
              <circle cx="9.5" cy="9.5" r="1.1" fill="#0A0A0A" />
              <circle cx="14.5" cy="9.5" r="1.1" fill="#0A0A0A" />
            </svg>
            {pendingOrdersCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#FF6321] text-[10px] font-black text-white flex items-center justify-center shadow-md shadow-[#FF6321]/40 border border-black/40">
                {pendingOrdersCount}
              </span>
            )}
          </div>
          <span className={`text-[10px] tracking-tight font-medium ${activeTab === 'commandes' ? 'font-black' : ''}`}>
            Commandes
          </span>
          {activeTab === 'commandes' && (
            <span className="w-1 h-1 rounded-full bg-[#FF6321] mt-0.5 shadow-sm shadow-[#FF6321]" />
          )}
        </button>


        {/* 3. Central "Ajouter" Button (TikTok-style vibrant create button) */}
        <button
          onClick={() => setActiveTab('ajouter')}
          aria-label="Ajouter un article"
          aria-current={activeTab === 'ajouter' ? 'page' : undefined}
          className="relative h-full flex flex-col flex-1 items-center justify-center group select-none active:scale-90 transition-transform"
        >
          <div className="relative -mt-1 flex items-center justify-center">
            {/* TikTok-style dual-color accent background box */}
            <div className="w-11 h-7.5 rounded-xl bg-gradient-to-r from-[#FF6321] to-[#FF8C53] flex items-center justify-center shadow-lg shadow-[#FF6321]/40 border border-white/20 group-hover:scale-105 transition-transform duration-200">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-white filter drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
            </div>
          </div>
          <span className={`text-[10px] mt-0.5 tracking-tight font-medium ${activeTab === 'ajouter' ? 'text-[#FF6321] font-black' : 'text-white/60'}`}>
            Publier
          </span>
        </button>

        {/* 4. Discussions (TikTok speech bubble icon with 3 dots) */}
        <button
          onClick={() => setActiveTab('discussions')}
          aria-label="Discussions"
          aria-current={activeTab === 'discussions' ? 'page' : undefined}
          className={`relative h-full flex flex-col flex-1 items-center justify-center gap-0.5 select-none transition-all duration-200 active:scale-90 ${
            activeTab === 'discussions' ? 'text-[#FF6321] scale-105' : 'text-white/60 hover:text-white/90'
          }`}
        >
          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              className={`w-5 h-5 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] transition-all ${
                activeTab === 'discussions'
                  ? 'text-[#FF6321] fill-[#FF6321]'
                  : 'text-white/60 fill-white/60'
              }`}
            >
              <path d="M12 2C6.48 2 2 6.03 2 11c0 2.76 1.4 5.23 3.61 6.84-.13.93-.52 2.3-1.63 3.48-.22.24-.07.63.26.65 2.12.14 4.09-.76 5.28-1.57.8.21 1.63.32 2.48.32 5.52 0 10-4.03 10-9s-4.48-9-10-9z" />
              <circle cx="8" cy="11" r="1.2" fill="#0A0A0A" />
              <circle cx="12" cy="11" r="1.2" fill="#0A0A0A" />
              <circle cx="16" cy="11" r="1.2" fill="#0A0A0A" />
            </svg>
            {unreadDiscussionsCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#FF6321] text-[10px] font-black text-white flex items-center justify-center shadow-md shadow-[#FF6321]/40 border border-black/40">
                {unreadDiscussionsCount}
              </span>
            )}
          </div>
          <span className={`text-[10px] tracking-tight font-medium ${activeTab === 'discussions' ? 'font-black' : ''}`}>
            Messages
          </span>
          {activeTab === 'discussions' && (
            <span className="w-1 h-1 rounded-full bg-[#FF6321] mt-0.5 shadow-sm shadow-[#FF6321]" />
          )}
        </button>

        {/* 5. Profil (Solid filled user silhouette with collar cutout like Messages button) */}
        <button
          onClick={() => setActiveTab('profil')}
          aria-label="Profil"
          aria-current={activeTab === 'profil' ? 'page' : undefined}
          className={`relative h-full flex flex-col flex-1 items-center justify-center gap-0.5 select-none transition-all duration-200 active:scale-90 ${
            activeTab === 'profil' ? 'text-[#FF6321] scale-105' : 'text-white/60 hover:text-white/90'
          }`}
        >
          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              className={`w-5 h-5 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] transition-all ${
                activeTab === 'profil'
                  ? 'text-[#FF6321] fill-[#FF6321]'
                  : 'text-white/60 fill-white/60'
              }`}
            >
              {/* Solid Head */}
              <circle cx="12" cy="7" r="4.2" />
              {/* Solid Torso / Shoulders with smooth contour */}
              <path d="M12 13.5c-4.3 0-8 2.2-8 5.2v1.8a1.5 1.5 0 001.5 1.5h13a1.5 1.5 0 001.5-1.5v-1.8c0-3-3.7-5.2-8-5.2z" />
              {/* Neck cutout dot matching the Messages button dots */}
              <circle cx="12" cy="14" r="1" fill="#0A0A0A" />
            </svg>
          </div>
          <span className={`text-[10px] tracking-tight font-medium ${activeTab === 'profil' ? 'font-black' : ''}`}>
            Profil
          </span>
          {activeTab === 'profil' && (
            <span className="w-1 h-1 rounded-full bg-[#FF6321] mt-0.5 shadow-sm shadow-[#FF6321]" />
          )}
        </button>
      </nav>
    </div>
  );
};
