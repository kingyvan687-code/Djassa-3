import React, { useMemo, useState, useEffect } from 'react';
import {
  Search,
  ShoppingBag,
  Package,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  TrendingUp,
  CreditCard,
  Banknote,
  Truck,
} from 'lucide-react';
import { Order, Product, OrderIncident, OrderReceiptDto } from '../../types';
import { useApp } from '../../context/AppContext';
import { formatFCFA } from '../../services/marketServices';
import { commerceService } from '../../services/commerceService';
import { SellerOrderFilter, PaymentMethodFilter, OrderSortOption } from './orders/types';
import { SellerOrderCard } from './orders/SellerOrderCard';
import { SellerOrderDetailModal } from './orders/SellerOrderDetailModal';
import { SellerIncidentsSection } from './orders/SellerIncidentsSection';
import { SellerOrderHistorySection } from './orders/SellerOrderHistorySection';
import { DeclareIncidentModal } from './orders/DeclareIncidentModal';
import { DjassaOfficialReceiptModal } from '../common/DjassaOfficialReceiptModal';

interface Props {
  orders: Order[];
  products: Product[];
}

export const SellerOrdersScreen: React.FC<Props> = ({ orders, products }) => {
  const {
    sellers,
    currentSellerId,
    reportOrderIncident,
    startCall,
    openChatWithClient,
    showToast,
  } = useApp();

  const currentSeller = sellers.find((s) => s.id === currentSellerId) || sellers[0];

  const [mainSection, setMainSection] = useState<'active' | 'incidents' | 'history'>('active');

  const [filter, setFilter] = useState<SellerOrderFilter>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethodFilter>('all');
  const [sortBy, setSortBy] = useState<OrderSortOption>('date_desc');
  const [searchQuery, setSearchQuery] = useState('');

  const [activeDetailOrder, setActiveDetailOrder] = useState<Order | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [receiptDto, setReceiptDto] = useState<OrderReceiptDto | undefined>(undefined);
  const [isDeclareModalOpen, setIsDeclareModalOpen] = useState(false);
  const [declareOrderId, setDeclareOrderId] = useState<string | undefined>(undefined);

  const [photos, setPhotos] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(`djassa_seller_order_photos_${currentSeller?.id}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`djassa_seller_order_photos_${currentSeller?.id}`, JSON.stringify(photos));
    } catch {
      // ignore quota
    }
  }, [photos, currentSeller?.id]);

  const handleUploadPhoto = (orderId: string, photoUrl: string) => {
    setPhotos((prev) => ({ ...prev, [orderId]: photoUrl }));
    showToast('Photo du colis enregistrée !');
  };

  const handleOpenReceipt = async (order: Order) => {
    setReceiptOrder(order);
    setReceiptDto(undefined);
    try {
      const res = await commerceService.getOrderReceipt(order.id);
      if (res?.success && res.receipt) {
        setReceiptDto(res.receipt);
      }
    } catch {
      // Fallback to local order breakdown in DjassaOfficialReceiptModal
    }
  };

  const handleContactClient = (phone: string, name: string, openChat?: boolean) => {
    if (openChat) {
      openChatWithClient(
        phone,
        name,
        activeDetailOrder?.orderNumber,
        `Bonjour ${name}, votre commande #${activeDetailOrder?.orderNumber || ''} est confirmée. Notre boutique prépare votre livraison.`
      );
      return;
    }
    try {
      startCall(name, 'client');
      showToast(`Appel vers ${name} (${phone}) en cours...`);
    } catch {
      showToast(`Contact client : ${name} au ${phone}`);
    }
  };

  const handleOpenDeclareModal = (preselectedOrderId?: string) => {
    setDeclareOrderId(preselectedOrderId);
    setIsDeclareModalOpen(true);
  };

  const handleSubmitIncident = (orderId: string, incident: OrderIncident) => {
    reportOrderIncident(orderId, incident);
    showToast(`Signalement enregistré : ${incident.reason}`);
  };

  const isOrderToday = (o: Order) => {
    if (!o) return false;
    try {
      if (o.createdAt) {
        const d = new Date(o.createdAt);
        const now = new Date();
        if (
          d.getDate() === now.getDate() &&
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        ) {
          return true;
        }
      }
    } catch {}
    return false;
  };

  const getOrderNetRevenue = (o: Order) => {
    const subtotalNetDiscount = Math.max(0, (o.subtotal || o.total || 0) - (o.discount || 0));
    const commission = o.commissionFcfa ?? 150;
    return o.sellerNetFcfa ?? Math.max(0, subtotalNetDiscount - commission);
  };

  const incidentsCount = useMemo(() => {
    return orders.filter(
      (o) => ['damaged', 'returned', 'cancelled'].includes(o.status) || Boolean(o.incident)
    ).length;
  }, [orders]);

  const activeOrdersCount = useMemo(() => {
    return orders.filter((o) => !['returned', 'damaged', 'cancelled'].includes(o.status) && !o.incident).length;
  }, [orders]);

  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const totalVolume = orders.reduce((sum, o) => sum + getOrderNetRevenue(o), 0);

    const todayList = orders.filter((o) => isOrderToday(o));
    const todayOrders = todayList.length;
    const todayVolume = todayList.reduce((sum, o) => sum + getOrderNetRevenue(o), 0);

    const paidCount = orders.filter((o) => o.paymentStatus === 'paid').length;
    const codPendingCount = orders.filter(
      (o) =>
        o.paymentMode === 'cod' ||
        o.paymentMethod === 'cash_on_delivery' ||
        o.paymentStatus === 'cod_pending'
    ).length;

    const returnedOrders = orders.filter(
      (o) => o.status === 'returned' || o.incident?.type === 'returned'
    );
    const damagedCount = orders.filter(
      (o) => o.status === 'damaged' || o.incident?.type === 'damaged'
    ).length;
    const returnedCount = returnedOrders.length;
    const returnRate = totalOrders > 0 ? ((returnedCount / totalOrders) * 100).toFixed(1) : '0';

    return {
      totalOrders,
      totalVolume,
      todayOrders,
      todayVolume,
      paidCount,
      codPendingCount,
      returnedCount,
      damagedCount,
      returnRate,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        const isCod =
          o.paymentMode === 'cod' ||
          o.paymentMethod === 'cash_on_delivery' ||
          o.paymentStatus === 'cod_pending';

        if (filter === 'today' && !isOrderToday(o)) return false;
        if (filter === 'paid' && o.paymentStatus !== 'paid') return false;
        if (filter === 'cod_pending' && !isCod) return false;
        if (filter === 'returned' && o.status !== 'returned' && o.incident?.type !== 'returned') {
          return false;
        }
        if (filter === 'damaged' && o.status !== 'damaged' && o.incident?.type !== 'damaged') {
          return false;
        }

        if (paymentFilter !== 'all' && o.paymentMethod !== paymentFilter) {
          return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesNum = o.orderNumber.toLowerCase().includes(q);
          const matchesClient = o.deliveryAddress.recipientName.toLowerCase().includes(q);
          const matchesPhone = o.deliveryAddress.phone.toLowerCase().includes(q);
          const matchesCommune = o.deliveryAddress.commune.toLowerCase().includes(q);
          const matchesProduct = o.items.some((it) => it.productTitle.toLowerCase().includes(q));
          if (!matchesNum && !matchesClient && !matchesPhone && !matchesCommune && !matchesProduct) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'amount_desc') return (b.total || 0) - (a.total || 0);
        if (sortBy === 'amount_asc') return (a.total || 0) - (b.total || 0);
        if (sortBy === 'date_asc') return (a.createdAt || a.id).localeCompare(b.createdAt || b.id);
        return (b.createdAt || b.id).localeCompare(a.createdAt || a.id);
      });
  }, [orders, filter, paymentFilter, searchQuery, sortBy]);

  const currentDetailOrder = useMemo(() => {
    if (!activeDetailOrder) return null;
    return orders.find((o) => o.id === activeDetailOrder.id) || activeDetailOrder;
  }, [orders, activeDetailOrder]);

  return (
    <div
      id="seller-orders-screen"
      className="w-full h-full bg-[#0A0A0A] text-white flex flex-col overflow-y-auto no-scrollbar pb-24"
    >
      <div className="p-4 space-y-4">
        {/* TOP SECTION NAVIGATION SWITCHER */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              id="seller-tab-btn-active"
              onClick={() => setMainSection('active')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition border flex items-center gap-1.5 ${
                mainSection === 'active'
                  ? 'bg-[#FF6321] text-white border-[#FF6321] shadow-md shadow-orange-600/30'
                  : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Confirmées ({activeOrdersCount})</span>
            </button>

            <button
              id="seller-tab-btn-history"
              onClick={() => setMainSection('history')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition border flex items-center gap-1.5 ${
                mainSection === 'history'
                  ? 'bg-emerald-500 text-black border-emerald-400 font-black shadow-md shadow-emerald-600/30'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Historique ({orders.length})</span>
            </button>

            <button
              id="seller-tab-btn-incidents"
              onClick={() => setMainSection('incidents')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition border flex items-center gap-1.5 ${
                mainSection === 'incidents'
                  ? 'bg-rose-500 text-white border-rose-400 font-black shadow-md shadow-rose-600/30'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Litiges ({incidentsCount})</span>
            </button>
          </div>

          {mainSection !== 'active' && (
            <button
              onClick={() => setMainSection('active')}
              className="text-xs font-bold text-[#FF6321] hover:underline flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg bg-white/5"
            >
              <span>← Retour aux commandes</span>
            </button>
          )}
        </div>

        {/* VIEW 1: CONFIRMED ORDERS */}
        {mainSection === 'active' && (
          <div className="space-y-4">
            {/* Notice: Livraison gérée directement par la boutique */}
            <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center gap-2.5 text-xs">
              <Truck className="w-4 h-4 text-[#FF6321] shrink-0" />
              <p className="text-[11px] text-white/75 leading-snug">
                <strong className="text-white">Livraison gérée par votre boutique :</strong> organisez directement
                l’expédition externe avec les coordonnées client. Statut unique :{' '}
                <span className="text-emerald-400 font-bold">Commande confirmée</span>.
              </p>
            </div>

            {/* DASHBOARD KPI CARDS */}
            <div className="space-y-2.5">
              {/* Row 1 : Revenus nets vendeur */}
              <div
                id="btn-kpi-revenus"
                onClick={() => setSortBy(sortBy === 'amount_desc' ? 'date_desc' : 'amount_desc')}
                className={`p-3.5 sm:p-4 rounded-2xl border text-left cursor-pointer transition-all duration-200 relative overflow-hidden group shadow-lg active:scale-[0.99] ${
                  sortBy === 'amount_desc'
                    ? 'bg-gradient-to-br from-[#0D1C14] via-neutral-900 to-black border-emerald-500 shadow-emerald-600/20 ring-1 ring-emerald-500/40'
                    : 'bg-gradient-to-br from-[#0D1C14]/80 via-neutral-900 to-black border-emerald-500/30 hover:border-emerald-500/70 shadow-emerald-600/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs text-emerald-400 font-black uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span>Revenus nets boutique</span>
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-amber-300 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                    +{formatFCFA(stats.todayVolume)} auj.
                  </span>
                </div>

                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <p className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono leading-none">
                      {formatFCFA(stats.totalVolume)}
                    </p>
                    <span className="text-[11px] text-white/50 block mt-1 font-medium">
                      Après commission fixe DJASSA (150 FCFA / commande)
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-400 font-bold hidden sm:flex items-center gap-1">
                    <span>{sortBy === 'amount_desc' ? 'Tri montants actif' : 'Trier par montants'}</span>
                    <span>→</span>
                  </div>
                </div>
              </div>

              {/* Row 2 : Commandes confirmées & Paiement à la livraison */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div
                  id="btn-kpi-colis"
                  onClick={() => setFilter(filter === 'today' ? 'all' : 'today')}
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition ${
                    filter === 'today'
                      ? 'bg-[#FF6321]/20 border-[#FF6321] shadow-lg'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-[#FF6321] font-bold uppercase">Aujourd’hui</span>
                    <Package className="w-3.5 h-3.5 text-[#FF6321]" />
                  </div>
                  <p className="text-base font-black text-white mt-1 leading-none">{stats.todayOrders}</p>
                  <span className="text-[8px] text-white/40 block mt-1">Commandes du jour</span>
                </div>

                <div
                  onClick={() => setFilter(filter === 'paid' ? 'all' : 'paid')}
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition ${
                    filter === 'paid'
                      ? 'bg-emerald-500/20 border-emerald-500 shadow-lg'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-emerald-300 font-bold uppercase">Payées en ligne</span>
                    <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <p className="text-base font-black text-white mt-1 leading-none">{stats.paidCount}</p>
                  <span className="text-[8px] text-white/40 block mt-1">Wave / Orange Money</span>
                </div>

                <div
                  onClick={() => setFilter(filter === 'cod_pending' ? 'all' : 'cod_pending')}
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition ${
                    filter === 'cod_pending'
                      ? 'bg-amber-500/20 border-amber-500 shadow-lg'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-amber-300 font-bold uppercase">À la livraison</span>
                    <Banknote className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <p className="text-base font-black text-white mt-1 leading-none">{stats.codPendingCount}</p>
                  <span className="text-[8px] text-white/40 block mt-1">Paiement à réception</span>
                </div>

                <div
                  id="btn-kpi-retours"
                  onClick={() => setFilter(filter === 'returned' ? 'all' : 'returned')}
                  className={`p-3 rounded-2xl border text-left cursor-pointer transition ${
                    filter === 'returned'
                      ? 'bg-rose-500/20 border-rose-500 shadow-lg'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-rose-300 font-bold uppercase">Retours / Incidents</span>
                    <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  <p className="text-base font-black text-white mt-1 leading-none">{stats.returnedCount}</p>
                  <span className="text-[8px] text-white/40 block mt-1">Taux : {stats.returnRate}%</span>
                </div>
              </div>
            </div>

            {/* SEARCH BAR & CONTROLS */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-white/40" />
                  <input
                    id="seller-orders-search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="N° commande, client, téléphone, commune, article..."
                    className="w-full p-2.5 pl-10 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-2.5 text-[10px] text-white/50 hover:text-white"
                    >
                      Effacer
                    </button>
                  )}
                </div>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as OrderSortOption)}
                  className="p-2.5 rounded-2xl bg-neutral-900 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                >
                  <option value="date_desc">Plus récentes</option>
                  <option value="date_asc">Plus anciennes</option>
                  <option value="amount_desc">Montant décroissant</option>
                  <option value="amount_asc">Montant croissant</option>
                </select>
              </div>

              {/* Filter Chips */}
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {[
                  { id: 'all', label: 'Toutes confirmées', count: orders.length },
                  { id: 'today', label: "Aujourd'hui", count: stats.todayOrders },
                  { id: 'paid', label: 'Payées en ligne', count: stats.paidCount },
                  { id: 'cod_pending', label: 'Paiement à la livraison', count: stats.codPendingCount },
                  { id: 'returned', label: 'Retours', count: stats.returnedCount },
                  { id: 'damaged', label: 'Endommagées', count: stats.damagedCount },
                ].map((tab) => {
                  const active = filter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      id={`filter-tab-${tab.id}`}
                      onClick={() => setFilter(tab.id as SellerOrderFilter)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                        active
                          ? 'bg-[#FF6321] text-white shadow-md shadow-orange-600/20'
                          : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/5'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          active ? 'bg-black/30 text-white' : 'bg-white/10 text-white/50'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Payment Method Pills */}
              <div className="flex items-center gap-1.5 text-xs overflow-x-auto no-scrollbar">
                <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider mr-1 shrink-0">
                  Paiement :
                </span>
                {[
                  { id: 'all', label: 'Tous' },
                  { id: 'wave', label: 'Wave CI' },
                  { id: 'orange_money', label: 'Orange Money' },
                  { id: 'cash_on_delivery', label: 'À la livraison' },
                ].map((pm) => (
                  <button
                    key={pm.id}
                    onClick={() => setPaymentFilter(pm.id as PaymentMethodFilter)}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition shrink-0 ${
                      paymentFilter === pm.id
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ORDERS LIST */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 pt-1">
              {filteredOrders.length === 0 ? (
                <div className="col-span-2 py-16 text-center text-white/40 space-y-3 bg-white/[0.02] border border-white/5 rounded-3xl p-6">
                  <ShoppingBag className="w-12 h-12 mx-auto text-white/20" />
                  <div>
                    <p className="text-sm font-bold text-white/70">Aucune commande client trouvée</p>
                    <p className="text-xs text-white/40 mt-1 max-w-sm mx-auto">
                      {searchQuery
                        ? 'Aucun résultat pour cette recherche. Essayez un autre mot-clé.'
                        : 'Les commandes confirmées passées sur votre boutique apparaîtront ici avec le mode de paiement et les coordonnées du client.'}
                    </p>
                  </div>
                </div>
              ) : (
                filteredOrders.map((order) => (
                  <SellerOrderCard
                    key={order.id}
                    order={order}
                    parcelPhoto={photos[order.id]}
                    onSelectOrder={(o) => setActiveDetailOrder(o)}
                    onOpenReceipt={handleOpenReceipt}
                    onContactClient={handleContactClient}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* VIEW 2: INCIDENTS */}
        {mainSection === 'incidents' && (
          <SellerIncidentsSection
            orders={orders}
            onSelectOrder={(o) => setActiveDetailOrder(o)}
            onOpenDeclareModal={handleOpenDeclareModal}
            onContactClient={handleContactClient}
          />
        )}

        {/* VIEW 3: HISTORY */}
        {mainSection === 'history' && (
          <SellerOrderHistorySection
            orders={orders}
            onSelectOrder={(o) => setActiveDetailOrder(o)}
            onOpenReceipt={handleOpenReceipt}
          />
        )}
      </div>

      {/* MODALS */}
      {currentDetailOrder && (
        <SellerOrderDetailModal
          order={currentDetailOrder}
          products={products}
          seller={currentSeller}
          parcelPhoto={photos[currentDetailOrder.id]}
          onClose={() => setActiveDetailOrder(null)}
          onOpenReceipt={handleOpenReceipt}
          onUploadParcelPhoto={handleUploadPhoto}
          onContactClient={handleContactClient}
        />
      )}

      {receiptOrder && (
        <DjassaOfficialReceiptModal
          order={receiptOrder}
          seller={currentSeller}
          receiptDto={receiptDto}
          perspective="seller"
          onClose={() => {
            setReceiptOrder(null);
            setReceiptDto(undefined);
          }}
          onShowToast={showToast}
        />
      )}

      {isDeclareModalOpen && (
        <DeclareIncidentModal
          orders={orders}
          preselectedOrderId={declareOrderId}
          onClose={() => {
            setIsDeclareModalOpen(false);
            setDeclareOrderId(undefined);
          }}
          onSubmitIncident={handleSubmitIncident}
        />
      )}
    </div>
  );
};
