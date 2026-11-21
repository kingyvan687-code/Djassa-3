import React, { useState, lazy, Suspense } from 'react';
import { ShoppingBag, ShoppingCart, Package, ShieldCheck, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CartTab } from './CartTab';

const OrdersTab = lazy(() =>
  import('./OrdersTab').then((m) => ({ default: m.OrdersTab }))
);
const OrderDetailModal = lazy(() =>
  import('./OrderDetailModal').then((m) => ({ default: m.OrderDetailModal }))
);

export const AchatsScreen: React.FC = () => {
  const {
    cart,
    orders,
    selectedOrder,
    setSelectedOrder,
    isAuthenticated,
    openAuthModal,
    setActiveTab
  } = useApp();
  const [activeSubTab, setActiveSubTab] = useState<'cart' | 'orders'>('cart');
  const cartTotalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (!isAuthenticated) {
    return (
      <div
        id="achats-screen"
        className="with-bottom-nav w-full min-h-0 h-full bg-transparent text-white flex flex-col overflow-y-auto no-scrollbar"
      >
        <div className="sticky top-0 z-30 bg-[#0A0A0A]/85 backdrop-blur-xl p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#FF6321]" />
            <h1 className="text-base font-bold text-white">Achats</h1>
          </div>
          <span className="text-[11px] text-[#FF854D] font-semibold bg-orange-500/10 px-2.5 py-1 rounded-full border border-[#FF6321]/30">
            Mode visiteur
          </span>
        </div>

        <div className="flex-1 flex items-center justify-center p-5">
          <div
            id="visitor-achats-gate"
            className="w-full max-w-sm rounded-3xl bg-[#121216] border border-white/15 p-6 text-center space-y-5 shadow-2xl"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#FF6321]/15 border border-[#FF6321]/30 flex items-center justify-center mx-auto shadow-lg shadow-orange-600/15">
              <ShoppingCart className="w-8 h-8 text-[#FF6321]" />
            </div>

            <div className="space-y-2">
              <span className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-[#FF854D]">
                Panier & Commandes sécurisés
              </span>
              <h2 className="text-lg font-black text-white leading-snug">
                Accédez à vos achats et commandes
              </h2>
              <p className="text-xs text-white/70 leading-relaxed">
                Connectez-vous ou créez un compte DJASSA pour remplir votre panier, payer avec Wave,
                Orange Money ou à la livraison, et suivre vos colis en direct.
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                id="btn-achats-visitor-register"
                onClick={() =>
                  openAuthModal('orders', {
                    initialMode: 'register',
                    directToAuthForm: true,
                    pendingAction: { type: 'open_orders' }
                  })
                }
                className="w-full py-3.5 px-4 rounded-2xl bg-[#FF6321] hover:bg-[#ff7538] text-white font-extrabold text-sm shadow-xl shadow-orange-600/30 transition cursor-pointer"
              >
                Créer un compte
              </button>

              <button
                type="button"
                id="btn-achats-visitor-login"
                onClick={() =>
                  openAuthModal('orders', {
                    initialMode: 'login',
                    directToAuthForm: true,
                    pendingAction: { type: 'open_orders' }
                  })
                }
                className="w-full py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs transition cursor-pointer"
              >
                Se connecter
              </button>

              <button
                type="button"
                id="btn-achats-visitor-explore"
                onClick={() => setActiveTab('accueil')}
                className="w-full py-2.5 px-4 rounded-2xl text-white/65 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <span>Continuer à explorer</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="pt-1 flex items-center justify-center gap-1.5 text-[11px] text-white/45">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Paiement protégé DJASSA</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="achats-screen" className="with-bottom-nav w-full min-h-0 bg-transparent text-white flex flex-col overflow-y-auto no-scrollbar">
      <div className="sticky top-0 z-30 bg-[#0A0A0A]/85 backdrop-blur-xl p-4 border-b border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#FF6321]" />
            <h1 className="text-base font-bold text-white">Achats</h1>
          </div>
          <span className="text-[11px] text-[#FF6321] font-semibold bg-orange-500/10 px-2.5 py-1 rounded-full border border-[#FF6321]/30">
            Panier + Commandes
          </span>
        </div>

        <div className="grid grid-cols-2 p-1 bg-white/5 rounded-2xl border border-white/10">
          <button
            id="tab-sub-panier"
            onClick={() => setActiveSubTab('cart')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeSubTab === 'cart'
                ? 'bg-[#FF6321] text-white shadow-lg shadow-orange-600/30'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Panier {cartTotalItems > 0 && `(${cartTotalItems})`}</span>
          </button>

          <button
            id="tab-sub-commandes"
            onClick={() => setActiveSubTab('orders')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
              activeSubTab === 'orders'
                ? 'bg-[#FF6321] text-white shadow-lg shadow-orange-600/30'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Commandes ({orders.length})</span>
          </button>
        </div>
      </div>

      <div className="p-4 flex-1">
        {activeSubTab === 'cart' ? (
          <CartTab />
        ) : (
          <Suspense fallback={<div className="py-12 text-center text-xs text-white/50">Chargement des commandes...</div>}>
            <OrdersTab />
          </Suspense>
        )}
      </div>

      {selectedOrder && (
        <Suspense fallback={null}>
          <OrderDetailModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
          />
        </Suspense>
      )}
    </div>
  );
};