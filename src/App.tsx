import React, { Suspense, lazy, useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { BottomNav } from './components/navigation/BottomNav';
import { VisitorAuthGateModal } from './components/auth/VisitorAuthGateModal';
import { maintenanceService } from './services/maintenanceService';
import type { DjassaAppId, MaintenanceWindowRecord, PublicMaintenanceStatusResponse } from './types/maintenance';
import { Wrench, Clock, ShieldCheck } from 'lucide-react';
import { PWAStatusAndInstall } from './components/common/PWAStatusAndInstall';

const FeedScreen = lazy(() => import('./components/feed/FeedScreen').then((m) => ({ default: m.FeedScreen })));
const ExplorerScreen = lazy(() => import('./components/explorer/ExplorerScreen').then((m) => ({ default: m.ExplorerScreen })));
const DiscussionsScreen = lazy(() => import('./components/chat/DiscussionsScreen').then((m) => ({ default: m.DiscussionsScreen })));
const AchatsScreen = lazy(() => import('./components/achats/AchatsScreen').then((m) => ({ default: m.AchatsScreen })));
const ProfileScreen = lazy(() => import('./components/profile/ProfileScreen').then((m) => ({ default: m.ProfileScreen })));
const OrderDetailModal = lazy(() => import('./components/achats/OrderDetailModal').then((m) => ({ default: m.OrderDetailModal })));
const ProductDetailModal = lazy(() => import('./components/product/ProductDetailModal').then((m) => ({ default: m.ProductDetailModal })));
const SellerProfileModal = lazy(() => import('./components/seller/SellerProfileModal').then((m) => ({ default: m.SellerProfileModal })));
const VariantSelectionModal = lazy(() => import('./components/feed/VariantSelectionModal').then((m) => ({ default: m.VariantSelectionModal })));
const ExplorerVideoViewer = lazy(() => import('./components/feed/ExplorerVideoViewer').then((m) => ({ default: m.ExplorerVideoViewer })));
const PhotoDetailModal = lazy(() => import('./components/feed/PhotoDetailModal').then((m) => ({ default: m.PhotoDetailModal })));
const GoogleShoppingTryOnModal = lazy(() => import('./components/try-on/GoogleShoppingTryOnModal').then((m) => ({ default: m.GoogleShoppingTryOnModal })));
const KlingAiCreditsModal = lazy(() => import('./components/credits/KlingAiCreditsModal').then((m) => ({ default: m.KlingAiCreditsModal })));
const KlingAiVideoModal = lazy(() => import('./components/video-ai/KlingAiVideoModal').then((m) => ({ default: m.KlingAiVideoModal })));
const SellerApp = lazy(() => import('./components/seller-app/SellerApp').then((m) => ({ default: m.SellerApp })));
const AdminApp = lazy(() => import('./components/admin-app/AdminApp').then((m) => ({ default: m.AdminApp })));

const SpaceLoadingFallback: React.FC = () => (
  <div className="flex-1 w-full h-full flex flex-col items-center justify-center bg-[#0A0A0A] text-white gap-3">
    <div className="w-8 h-8 rounded-full border-2 border-[#FF6321]/30 border-t-[#FF6321] animate-spin" />
    <span className="text-xs text-white/50 font-medium">Chargement de l’espace DJASSA...</span>
  </div>
);

const MainShell = () => {
  const {
    activeTab,
    accountRole,
    isAuthenticated,
    selectedProduct,
    setSelectedProduct,
    selectedSeller,
    setSelectedSeller,
    toastMessage,
    variantModalProduct,
    isVariantModalDirectBuy,
    selectedOrder,
    setSelectedOrder,
    setVariantModalProduct,
    tryOnModalProduct,
    closeTryOnModal,
    selectedVideoProduct,
    selectedPhotoProduct,
    closePhotoViewer,
    photoViewerProducts,
    showToast,
    products,
    sellers,
    clientPreferences,
    isAiVideoModalOpen,
    closeAiVideoModal,
    aiVideoInitialData,
    isCreditModalOpen,
    signOut
  } = useApp();

  const [maintStatus, setMaintStatus] = useState<PublicMaintenanceStatusResponse | null>(null);
  const [maintNowMs, setMaintNowMs] = useState(() => Date.now());

  const currentAppId: DjassaAppId =
    accountRole === 'seller' || accountRole === 'admin'
      ? accountRole
      : 'client';

  // Real runtime frontend error forwarding to Maintenance & Versions module
  useEffect(() => {
    const onError = (evt: ErrorEvent) => {
      void maintenanceService.reportClientError({
        appId: currentAppId,
        serviceId: `frontend_${currentAppId}`,
        serviceName: `Frontend DJASSA ${currentAppId}`,
        errorType: 'frontend',
        severity: 'eleve',
        description: evt.message || 'Erreur JS frontend',
        rawLog: `${evt.filename || 'app'}:${evt.lineno || 0} ${evt.error?.stack || evt.message || ''}`
      });
    };
    const onUnhandled = (evt: PromiseRejectionEvent) => {
      const msg =
        evt.reason instanceof Error
          ? evt.reason.message
          : typeof evt.reason === 'string'
          ? evt.reason
          : 'Rejet de promesse non géré';
      void maintenanceService.reportClientError({
        appId: currentAppId,
        serviceId: `frontend_${currentAppId}`,
        serviceName: `Frontend DJASSA ${currentAppId}`,
        errorType: 'frontend',
        severity: 'moyen',
        description: msg,
        rawLog: evt.reason instanceof Error ? evt.reason.stack || msg : msg
      });
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandled);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandled);
    };
  }, [currentAppId]);

  // Real maintenance status polling
  useEffect(() => {
    let active = true;
    const poll = () => {
      maintenanceService
        .getPublicStatus()
        .then((res) => {
          if (active && res?.success) setMaintStatus(res);
        })
        .catch(() => {});
    };
    poll();
    const timer = setInterval(poll, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const activeWindowForCurrentApp: MaintenanceWindowRecord | null = (() => {
    if (!maintStatus) return null;
    if (isAuthenticated && currentAppId === 'admin') {
      // Admin console cannot be locked out by global maintenance; only explicit individual maintenance if any
      return null;
    }
    return maintStatus.appMaintenances?.[currentAppId] || maintStatus.globalMaintenance || null;
  })();

  useEffect(() => {
    if (!activeWindowForCurrentApp) return;
    const t = setInterval(() => setMaintNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activeWindowForCurrentApp?.id]);

  const formatMaintCountdown = (endAt: string | null) => {
    if (!endAt) return 'En cours';
    const diff = new Date(endAt).getTime() - maintNowMs;
    if (diff <= 0) return 'Fin imminente...';
    const sec = Math.floor(diff / 1000);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h > 0 ? `${String(h).padStart(2, '0')}h ` : ''}${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  };

  // Deep-link handling for shared URLs (?product=<id> or ?seller=<id|username>)
  useEffect(() => {
    if (currentAppId !== 'client' || products.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const productParam = params.get('product');
    const sellerParam = params.get('seller');
    if (productParam) {
      const matched = products.find((p) => p.id === productParam);
      if (matched) {
        setSelectedProduct(matched);
      }
      params.delete('product');
      const nextSearch = params.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`);
    } else if (sellerParam && sellers.length > 0) {
      const matchedSeller = sellers.find((s) => s.id === sellerParam || s.username === sellerParam);
      if (matchedSeller) {
        setSelectedSeller(matchedSeller);
      }
      params.delete('seller');
      const nextSearch = params.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`);
    }
  }, [currentAppId, products, sellers, setSelectedProduct, setSelectedSeller]);

  const displayPrefs = clientPreferences?.display;
  const fontScaleClass =
    displayPrefs?.fontSize === 'small'
      ? 'djassa-font-small'
      : displayPrefs?.fontSize === 'large'
      ? 'djassa-font-large'
      : 'djassa-font-normal';
  const motionClass = displayPrefs?.reduceMotion ? 'djassa-reduce-motion' : '';
  const themeClass = displayPrefs?.theme === 'light' && currentAppId === 'client' ? 'bg-[#141418] text-white' : 'bg-[#0A0A0A] text-white';

  return (
    <div className={`relative isolate w-full h-[100dvh] ${themeClass} ${fontScaleClass} ${motionClass} flex flex-col overflow-hidden`}>
      {activeWindowForCurrentApp ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#0A0A0A]">
          <div className="w-full max-w-sm rounded-3xl bg-white/5 border border-amber-500/30 p-6 space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
              <Wrench className="w-7 h-7" />
            </div>
            <div>
              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                {activeWindowForCurrentApp.scope === 'globale' ? 'Maintenance Globale DJASSA' : `Maintenance DJASSA ${currentAppId}`}
              </span>
              <h2 className="text-base font-black text-white mt-2">Service momentanément suspendu</h2>
              <p className="text-xs text-white/75 mt-1.5 leading-relaxed">
                {activeWindowForCurrentApp.customMessage}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-black/50 border border-white/10 space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-white/60">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Reprise estimée dans</span>
              </div>
              <p className="text-lg font-mono font-black text-amber-300">
                {formatMaintCountdown(activeWindowForCurrentApp.endAt)}
              </p>
              {activeWindowForCurrentApp.estimatedDurationMinutes && (
                <p className="text-[10px] text-white/45">
                  Durée estimée : {activeWindowForCurrentApp.estimatedDurationMinutes} minutes
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={signOut}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white/85 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Accès Administrateur / Changer de compte</span>
            </button>
          </div>
        </div>
      ) : isAuthenticated && accountRole === 'seller' ? (
        <Suspense fallback={<SpaceLoadingFallback />}>
          <SellerApp />
        </Suspense>
      ) : isAuthenticated && accountRole === 'admin' ? (
        <Suspense fallback={<SpaceLoadingFallback />}>
          <AdminApp />
        </Suspense>
      ) : (
        <>
          <div className="absolute -top-32 -left-32 w-80 h-80 bg-[#FF6321] opacity-15 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute top-1/2 -right-32 w-80 h-80 bg-[#FF6321] opacity-10 blur-[140px] rounded-full pointer-events-none" />
          <div className="absolute -bottom-32 left-1/4 w-80 h-80 bg-[#FF6321] opacity-10 blur-[120px] rounded-full pointer-events-none" />

          <main className="app-main-content flex-1 min-h-0 w-full overflow-hidden relative">
            <Suspense fallback={<SpaceLoadingFallback />}>
              {activeTab === 'accueil' && <FeedScreen />}
              {activeTab === 'explorer' && <ExplorerScreen />}
              {activeTab === 'discussions' && <DiscussionsScreen />}
              {activeTab === 'achats' && <AchatsScreen />}
              {activeTab === 'profil' && <ProfileScreen />}
            </Suspense>
          </main>

          <BottomNav />

          {selectedVideoProduct && (
            <Suspense fallback={null}>
              <ExplorerVideoViewer />
            </Suspense>
          )}
        </>
      )}

      {selectedPhotoProduct && (
        <Suspense fallback={null}>
          <PhotoDetailModal
            product={selectedPhotoProduct}
            allProducts={photoViewerProducts.length > 0 ? photoViewerProducts : products.filter((p) => (p.images && p.images.length > 0) || p.mediaType === 'image')}
            onClose={closePhotoViewer}
            onSelectProduct={(p) => setSelectedProduct(p)}
            showToast={showToast}
          />
        </Suspense>
      )}

      {selectedProduct && (
        <Suspense fallback={null}>
          <ProductDetailModal
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
          />
        </Suspense>
      )}

      {selectedSeller && (
        <Suspense fallback={null}>
          <SellerProfileModal
            seller={selectedSeller}
            onClose={() => {
              setSelectedSeller(null);
              setSelectedProduct(null);
            }}
          />
        </Suspense>
      )}

      {variantModalProduct && (
        <Suspense fallback={null}>
          <VariantSelectionModal
            product={variantModalProduct}
            isDirectBuy={isVariantModalDirectBuy}
            onClose={() => setVariantModalProduct(null)}
          />
        </Suspense>
      )}

      {selectedOrder && (
        <Suspense fallback={null}>
          <OrderDetailModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
          />
        </Suspense>
      )}

      {tryOnModalProduct && (
        <Suspense fallback={null}>
          <GoogleShoppingTryOnModal
            product={tryOnModalProduct}
            onClose={closeTryOnModal}
          />
        </Suspense>
      )}

      {isCreditModalOpen && (
        <Suspense fallback={null}>
          <KlingAiCreditsModal />
        </Suspense>
      )}

      {isAiVideoModalOpen && (
        <Suspense fallback={null}>
          <KlingAiVideoModal
            isOpen={isAiVideoModalOpen}
            onClose={closeAiVideoModal}
            initialPrompt={aiVideoInitialData?.prompt}
            initialProductName={aiVideoInitialData?.name}
            initialImage={aiVideoInitialData?.image}
          />
        </Suspense>
      )}

      {toastMessage && (
        <div
          id="global-toast-notification"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-[130] bg-[#121212]/90 border border-white/20 text-white text-xs font-semibold px-5 py-2.5 rounded-full shadow-2xl backdrop-blur-xl animate-slideDown max-w-[90vw] text-center flex items-center gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-[#FF6321] animate-ping" />
          {toastMessage}
        </div>
      )}
      <VisitorAuthGateModal />
      <PWAStatusAndInstall />
    </div>
  );
};

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error?.message || 'Erreur inattendue' };
  }

  componentDidCatch(error: Error) {
    void maintenanceService.reportClientError({
      appId: 'client',
      serviceId: 'frontend_shell',
      serviceName: 'Frontend DJASSA',
      errorType: 'frontend',
      severity: 'critique',
      description: error?.message || 'Erreur de rendu React',
      rawLog: error?.stack || error?.message || ''
    });
  }

  handleResetCacheAndReload = () => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('djassa_')) keysToRemove.push(k);
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore storage errors
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-[100dvh] bg-[#0A0A0A] text-white flex items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-3xl bg-white/5 border border-white/10 p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <Wrench className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-black text-white">Impossible d’afficher l’interface</h2>
              <p className="text-xs text-white/60 leading-relaxed">
                Une erreur d’affichage ou de cache local s’est produite. Vous pouvez recharger l’application ou réinitialiser le cache local.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full py-2.5 px-4 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white text-xs font-extrabold cursor-pointer"
              >
                Recharger l’application
              </button>
              <button
                type="button"
                onClick={this.handleResetCacheAndReload}
                className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white/80 text-xs font-bold cursor-pointer"
              >
                Réinitialiser le cache et recharger
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppProvider>
        <MainShell />
      </AppProvider>
    </AppErrorBoundary>
  );
}
