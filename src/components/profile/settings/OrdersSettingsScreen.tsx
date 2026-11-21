import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  CreditCard,
  Plus,
  Trash2,
  ShieldCheck,
  Check,
  X,
  FileText,
  Users
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { securityService } from '../../../services/securityService';
import { Order } from '../../../types';

interface OrdersSettingsScreenProps {
  onBack: () => void;
  onNavigateHistory?: () => void;
  onNavigatePurchases?: () => void;
  onNavigatePurchasedProducts?: () => void;
}

const COMMUNES_ABIDJAN = [
  'Cocody',
  'Yopougon',
  'Plateau',
  'Marcory',
  'Adjamé',
  'Treichville',
  'Koumassi',
  'Port-Bouët',
  'Abobo',
  'Attécoubé',
  'Bingerville',
  'Songon'
];

export const OrdersSettingsScreen: React.FC<OrdersSettingsScreenProps> = ({
  onBack,
  onNavigateHistory,
  onNavigatePurchases,
  onNavigatePurchasedProducts
}) => {
  const {
    orders,
    userProfile,
    updateProfile,
    clientPreferences,
    updateClientPreferences,
    showToast
  } = useApp();

  const [activeTab, setActiveTab] = useState<'all' | 'online' | 'cod' | 'addresses' | 'payments'>('all');
  const [activeModal, setActiveModal] = useState<null | 'add_address' | 'add_payment' | 'order_details'>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Address form
  const [newLabel, setNewLabel] = useState('Domicile');
  const [newCommune, setNewCommune] = useState(userProfile.deliveryCommune || 'Cocody');
  const [newQuartier, setNewQuartier] = useState('');
  const [newDetails, setNewDetails] = useState('');

  // Payment form (Wave & Orange Money only)
  const [paymentProvider, setPaymentProvider] = useState<'wave' | 'orange_money'>('wave');
  const [paymentPhone, setPaymentPhone] = useState(userProfile.phone || '');

  const savedAddresses = clientPreferences.savedAddresses;
  const savedPayments = clientPreferences.paymentMethods;

  const isCodOrder = (o: Order) =>
    o.paymentMode === 'cod' || o.paymentMethod === 'cash_on_delivery' || o.paymentStatus === 'cod_pending';
  const codOrders = orders.filter(isCodOrder);
  const onlineOrders = orders.filter((o) => !isCodOrder(o));

  const filteredOrders =
    activeTab === 'online'
      ? onlineOrders
      : activeTab === 'cod'
      ? codOrders
      : orders;

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuartier.trim()) {
      showToast('Veuillez renseigner le quartier de livraison.');
      return;
    }
    const isFirst = savedAddresses.length === 0;
    const newAddr = {
      id: `addr-${Date.now()}`,
      label: newLabel.trim() || `${newCommune} - ${newQuartier.trim()}`,
      commune: newCommune,
      quartier: newQuartier.trim(),
      details: newDetails.trim() || 'Adresse enregistrée',
      recipientName: userProfile.name,
      phone: userProfile.phone,
      isDefault: isFirst,
    };

    const nextList = [...savedAddresses, newAddr];
    void updateClientPreferences({ savedAddresses: nextList });
    if (isFirst) {
      updateProfile({
        deliveryCommune: newAddr.commune,
        deliveryQuartier: newAddr.quartier,
        deliveryAddressDetails: newAddr.details,
      });
    }

    void securityService.recordActivity({
      category: 'accounts',
      action: `Ajout adresse de livraison (${newCommune})`,
      actionType: 'address_added',
      target: newAddr.label,
      targetType: 'account',
      entityType: 'address',
      entityId: newAddr.id,
      space: 'client',
      actorId: userProfile.id,
      actorName: userProfile.name,
      actorAccountLabel: userProfile.email || userProfile.phone,
      result: 'reussi',
      severity: 'information',
      afterValue: `${newCommune} · ${newQuartier.trim()}`,
      details: `Nouvelle adresse client enregistrée : ${newAddr.label}`
    });
    setActiveModal(null);
    setNewQuartier('');
    setNewDetails('');
    showToast('Nouvelle adresse enregistrée');
  };

  const handleDeleteAddress = (id: string) => {
    const targetAddr = savedAddresses.find((a) => a.id === id);
    const nextList = savedAddresses.filter((a) => a.id !== id);
    if (targetAddr?.isDefault && nextList.length > 0) {
      nextList[0] = { ...nextList[0], isDefault: true };
    }
    void updateClientPreferences({ savedAddresses: nextList });
    showToast('Adresse supprimée');
  };

  const handleSetDefaultAddress = (id: string) => {
    const targetAddr = savedAddresses.find((a) => a.id === id);
    const nextList = savedAddresses.map((a) => ({
      ...a,
      isDefault: a.id === id,
    }));
    void updateClientPreferences({ savedAddresses: nextList });
    if (targetAddr) {
      updateProfile({
        deliveryCommune: targetAddr.commune,
        deliveryQuartier: targetAddr.quartier,
        deliveryAddressDetails: targetAddr.details,
      });
    }
    showToast('Adresse principale mise à jour');
  };

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedTarget = paymentPhone.trim();
    if (!cleanedTarget) {
      showToast('Veuillez saisir le numéro ou libellé associé.');
      return;
    }
    const labels: Record<'wave' | 'orange_money', string> = {
      wave: 'Wave Côte d\'Ivoire',
      orange_money: 'Orange Money CI'
    };
    const maskedTarget =
      cleanedTarget.length > 4 ? `•••• ${cleanedTarget.slice(-4)}` : cleanedTarget;

    const newPay = {
      id: `pay-${Date.now()}`,
      type: paymentProvider,
      label: labels[paymentProvider],
      maskedTarget,
      isDefault: savedPayments.length === 0,
    };

    void updateClientPreferences({
      paymentMethods: [...savedPayments, newPay],
    });
    setActiveModal(null);
    showToast(`${labels[paymentProvider]} enregistré`);
  };

  const handleSetDefaultPayment = (id: string, label: string) => {
    const nextList = savedPayments.map((p) => ({
      ...p,
      isDefault: p.id === id,
    }));
    void updateClientPreferences({ paymentMethods: nextList });
    showToast(`${label} sélectionné par défaut`);
  };

  const handleDeletePayment = (id: string) => {
    const nextList = savedPayments.filter((p) => p.id !== id);
    void updateClientPreferences({ paymentMethods: nextList });
    showToast('Moyen de paiement retiré');
  };

  const handleDownloadReceipt = (order: Order) => {
    const lines = [
      'DJASSA MARKETPLACE — REÇU DE COMMANDE',
      `Commande : #${order.orderNumber || order.id}`,
      `Date : ${order.createdAt ? new Date(order.createdAt).toLocaleString('fr-FR') : 'N/A'}`,
      `Statut commande : Commande confirmée`,
      `Paiement : ${isCodOrder(order) ? 'À payer à la livraison' : order.paymentStatus === 'paid' ? 'Payé' : 'En attente'}`,
      `Adresse : ${order.deliveryAddress?.commune || ''} ${order.deliveryAddress?.quartier || ''}`.trim(),
      '----------------------------------------',
      ...(order.items || []).map(
        (item) =>
          `${item.quantity}x ${item.productTitle} — ${((item.price || 0) * item.quantity).toLocaleString('fr-FR')} FCFA`
      ),
      '----------------------------------------',
      `Livraison (gérée par la boutique) : 0 FCFA`,
      ...((order.clientFeeFcfa ?? order.serviceFee ?? 0) > 0 && !isCodOrder(order)
        ? [`Frais client (6,5% en ligne) : ${(order.clientFeeFcfa ?? order.serviceFee ?? 0).toLocaleString('fr-FR')} FCFA`]
        : []),
      `Total : ${(order.total || 0).toLocaleString('fr-FR')} FCFA`,
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recu-djassa-${order.orderNumber || order.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Reçu téléchargé');
  };

  return (
    <div
      id="orders-settings-screen"
      className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
    >
      {/* Top Header */}
      <header className="sticky top-0 z-20 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/10 px-3 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition active:scale-95"
            aria-label="Retour"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-base font-extrabold text-white tracking-tight">
            Centre de commandes
          </h1>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="flex bg-[#121212] border-b border-white/10 px-2 py-1.5 gap-1 overflow-x-auto no-scrollbar text-xs font-bold">
        {[
          { id: 'all', label: `Toutes (${orders.length})` },
          { id: 'online', label: `En ligne (${onlineOrders.length})` },
          { id: 'cod', label: `À la livraison (${codOrders.length})` },
          { id: 'addresses', label: `Adresses (${savedAddresses.length})` },
          { id: 'payments', label: `Paiements (${savedPayments.length})` }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-3 py-1.5 rounded-full whitespace-nowrap transition active:scale-95 ${
              activeTab === tab.id
                ? 'bg-[#FF6321] text-white font-extrabold shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4 pb-16">
        {onNavigatePurchasedProducts && (
          <button
            onClick={onNavigatePurchasedProducts}
            className="w-full p-3 rounded-2xl bg-gradient-to-r from-orange-500/15 via-[#FF6321]/10 to-transparent border border-[#FF6321]/30 flex items-center justify-between text-left hover:border-[#FF6321]/60 transition group active:scale-[0.99] shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FF6321] text-white flex items-center justify-center font-black shadow-md shadow-orange-600/30">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-black text-white group-hover:text-[#FF6321] transition flex items-center gap-1.5">
                  Produits achetés & Nombre d'acheteurs
                </span>
                <span className="text-[10px] text-white/50 block">
                  Consultez vos articles achetés et les statistiques marchands
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#FF6321] group-hover:translate-x-0.5 transition" />
          </button>
        )}

        {/* TAB: COMMANDES */}
        {(activeTab === 'all' || activeTab === 'online' || activeTab === 'cod') && (
          <div className="space-y-3">
            {filteredOrders.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto text-white/30">
                  <ShoppingBag className="w-7 h-7" />
                </div>
                <p className="text-sm font-bold text-white">Aucune commande trouvée</p>
                <p className="text-xs text-white/50 max-w-xs mx-auto">
                  Vos commandes Djassa apparaîtront ici dès votre premier achat.
                </p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const isCod = isCodOrder(order);
                const itemsCount = order.items?.length || 1;
                const totalAmount = order.total || 0;

                return (
                  <div
                    key={order.id}
                    className="p-4 bg-[#141414] border border-white/5 rounded-2xl space-y-3 hover:border-white/10 transition"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-white">
                          Commande #{order.orderNumber || order.id.slice(-6)}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Commande confirmée
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            order.paymentStatus === 'paid'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                          }`}
                        >
                          {isCod
                            ? 'À payer à la livraison'
                            : order.paymentStatus === 'paid'
                            ? 'Payé'
                            : 'En attente'}
                        </span>
                      </div>
                      <span className="text-[11px] text-white/40">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString('fr-FR') : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white/5 overflow-hidden flex-shrink-0 border border-white/10">
                        {order.items?.[0]?.productImage ? (
                          <img
                            src={order.items[0].productImage}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/40">
                            <ShoppingBag className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">
                          {order.items?.[0]?.productTitle || 'Article Djassa'}
                        </p>
                        <p className="text-[11px] text-white/50">
                          {itemsCount} article{itemsCount > 1 ? 's' : ''} · {totalAmount.toLocaleString('fr-FR')} FCFA
                        </p>
                        <p className="text-[10px] text-white/40 truncate">
                          {order.deliveryAddress?.commune || userProfile.deliveryCommune || 'Abidjan'}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-white/5 text-xs font-bold">
                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setActiveModal('order_details');
                        }}
                        className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition text-center"
                      >
                        Détails & Reçu
                      </button>

                      <button
                        onClick={() => {
                          if (onNavigatePurchases) onNavigatePurchases();
                          onBack();
                        }}
                        className="flex-1 py-2 rounded-xl bg-[#FF6321] hover:bg-[#E05316] text-white transition text-center shadow"
                      >
                        Voir commande
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB: ADRESSES DE LIVRAISON */}
        {activeTab === 'addresses' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
                Adresses enregistrées ({savedAddresses.length})
              </span>
              <button
                onClick={() => setActiveModal('add_address')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FF6321] text-white text-xs font-bold transition active:scale-95 shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter une adresse
              </button>
            </div>

            {savedAddresses.length === 0 ? (
              <div className="p-6 bg-[#121212] border border-white/5 rounded-2xl text-center space-y-1">
                <p className="text-xs font-bold text-white">Aucune adresse enregistrée</p>
                <p className="text-[11px] text-white/50">Ajoutez votre adresse de livraison à Abidjan.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedAddresses.map((addr) => (
                  <div
                    key={addr.id}
                    className={`p-4 rounded-2xl border transition ${
                      addr.isDefault
                        ? 'bg-[#181818] border-[#FF6321]/50'
                        : 'bg-[#121212] border-white/5'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-white">{addr.label}</span>
                          {addr.isDefault && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#FF6321]/20 text-[#FF6321] font-bold border border-[#FF6321]/30">
                              Par défaut
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/80">
                          {addr.commune} · {addr.quartier}
                        </p>
                        <p className="text-[11px] text-white/50">{addr.details}</p>
                      </div>

                      <button
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/5 transition"
                        aria-label="Supprimer cette adresse"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {!addr.isDefault && (
                      <div className="mt-3 pt-2 border-t border-white/5">
                        <button
                          onClick={() => handleSetDefaultAddress(addr.id)}
                          className="text-[11px] text-[#FF6321] hover:underline font-bold"
                        >
                          Définir comme adresse principale
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: MOYENS DE PAIEMENT */}
        {activeTab === 'payments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
                Moyens enregistrés ({savedPayments.length})
              </span>
              <button
                onClick={() => setActiveModal('add_payment')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FF6321] text-white text-xs font-bold transition active:scale-95 shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter un moyen
              </button>
            </div>

            {savedPayments.length === 0 ? (
              <div className="p-6 bg-[#121212] border border-white/5 rounded-2xl text-center space-y-1">
                <p className="text-xs font-bold text-white">Aucun moyen de paiement enregistré</p>
                <p className="text-[11px] text-white/50">Ajoutez un numéro Wave ou Orange Money.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedPayments.map((pay) => (
                  <div
                    key={pay.id}
                    className="p-4 bg-[#141414] border border-white/5 rounded-2xl flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/80">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">{pay.label}</span>
                        <p className="text-[11px] text-white/50">{pay.maskedTarget}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {pay.isDefault ? (
                        <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Principal
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSetDefaultPayment(pay.id, pay.label)}
                          className="text-[10px] text-[#FF6321] font-bold hover:underline"
                        >
                          Sélectionner
                        </button>
                      )}
                      <button
                        onClick={() => handleDeletePayment(pay.id)}
                        className="p-1.5 rounded-lg text-white/40 hover:text-red-400"
                        aria-label="Retirer ce moyen de paiement"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3 text-xs">
              <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white">Protection des paiements</p>
                <p className="text-[11px] text-emerald-300/80 mt-0.5">
                  Les données sensibles (PIN Wave, numéros complets) ne sont jamais stockées en clair dans vos préférences.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: AJOUTER UNE ADRESSE */}
      {activeModal === 'add_address' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-sm mx-auto bg-[#181818] rounded-3xl border border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Ajouter une adresse de livraison</h3>
              <button onClick={() => setActiveModal(null)} className="p-1 text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAddress} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-white/50 block mb-1">Nom de l'adresse</label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Domicile, Bureau..."
                  className="w-full bg-[#121212] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-[#FF6321]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-white/50 block mb-1">Commune d'Abidjan</label>
                <select
                  value={newCommune}
                  onChange={(e) => setNewCommune(e.target.value)}
                  className="w-full bg-[#121212] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-[#FF6321]"
                >
                  {COMMUNES_ABIDJAN.map((c) => (
                    <option key={c} value={c} className="bg-[#121212] text-white">
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-white/50 block mb-1">Quartier précis</label>
                <input
                  type="text"
                  value={newQuartier}
                  onChange={(e) => setNewQuartier(e.target.value)}
                  placeholder="Ex: Riviera 2, Niangon..."
                  className="w-full bg-[#121212] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-[#FF6321]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-white/50 block mb-1">Repère de livraison</label>
                <input
                  type="text"
                  value={newDetails}
                  onChange={(e) => setNewDetails(e.target.value)}
                  placeholder="Ex: Face à la pharmacie..."
                  className="w-full bg-[#121212] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-[#FF6321]"
                />
              </div>

              <div className="flex gap-2 pt-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6321] hover:bg-[#E05316] text-white transition shadow"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: AJOUTER UN MOYEN DE PAIEMENT */}
      {activeModal === 'add_payment' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-sm mx-auto bg-[#181818] rounded-3xl border border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Ajouter un moyen de paiement</h3>
              <button onClick={() => setActiveModal(null)} className="p-1 text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPayment} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-white/50 block mb-1">Opérateur</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'wave' as const, label: 'Wave CI' },
                    { id: 'orange_money' as const, label: 'Orange Money' }
                  ].map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setPaymentProvider(p.id)}
                      className={`p-2.5 rounded-xl text-left border transition ${
                        paymentProvider === p.id
                          ? 'bg-[#FF6321]/20 border-[#FF6321] text-white font-bold'
                          : 'bg-white/5 border-white/10 text-white/70'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-white/50 block mb-1">Numéro ou 4 derniers chiffres</label>
                <input
                  type="text"
                  value={paymentPhone}
                  onChange={(e) => setPaymentPhone(e.target.value)}
                  placeholder="+225 07 00 00 00 00"
                  className="w-full bg-[#121212] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-[#FF6321]"
                />
              </div>

              <div className="flex gap-2 pt-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6321] hover:bg-[#E05316] text-white transition shadow"
                >
                  Confirmer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DÉTAILS DE COMMANDE */}
      {activeModal === 'order_details' && selectedOrder && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-sm mx-auto bg-[#181818] rounded-3xl border border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Bordereau #{selectedOrder.orderNumber || selectedOrder.id.slice(-6)}
                </h3>
                <p className="text-[10px] text-white/40">Djassa · Côte d'Ivoire</p>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1 text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Articles commandés</span>
              {selectedOrder.items?.map((item, idx) => (
                <div key={idx} className="p-2.5 bg-white/5 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate max-w-[70%]">
                    <span className="font-bold text-white">{item.quantity}x</span>
                    <span className="text-white/80 truncate">{item.productTitle || 'Article'}</span>
                  </div>
                  <span className="font-bold text-[#FF6321]">
                    {((item.price || 0) * item.quantity).toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 bg-white/5 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between text-white/60">
                <span>Sous-total</span>
                <span>{(selectedOrder.subtotal || selectedOrder.total || 0).toLocaleString('fr-FR')} FCFA</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>Livraison (gérée par la boutique)</span>
                <span className="text-emerald-400">0 FCFA</span>
              </div>
              {!isCodOrder(selectedOrder) && (selectedOrder.clientFeeFcfa ?? selectedOrder.serviceFee ?? 0) > 0 && (
                <div className="flex justify-between text-white/60">
                  <span>Frais client (6,5% en ligne)</span>
                  <span>
                    {(selectedOrder.clientFeeFcfa ?? selectedOrder.serviceFee ?? 0).toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              )}
              <div className="flex justify-between font-extrabold text-white pt-1 border-t border-white/10 text-sm">
                <span>Total</span>
                <span className="text-[#FF6321]">{(selectedOrder.total || 0).toLocaleString('fr-FR')} FCFA</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => handleDownloadReceipt(selectedOrder)}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white transition flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Télécharger reçu
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveModal(null);
                  if (onNavigatePurchases) onNavigatePurchases();
                  onBack();
                }}
                className="flex-1 py-3 rounded-xl bg-[#FF6321] hover:bg-[#E05316] text-white transition shadow text-center"
              >
                Ouvrir suivi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
