import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Store, 
  ShoppingBag, 
  Search, 
  MapPin, 
  Clock, 
  DollarSign, 
  CheckCircle2, 
  Flame, 
  Megaphone, 
  Layers, 
  Zap, 
  Tag, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { AdminBoostCampaign, BoostPlacement, Product, Seller } from '../../../types';
import { ABIDJAN_COMMUNES } from '../../../data/mockData';
import { formatFCFA } from '../../../services/marketServices';

interface AdminCreateBoostModalProps {
  onClose: () => void;
  onCampaignCreated: (campaign: AdminBoostCampaign) => void;
  initialPlacement?: BoostPlacement;
  initialDurationDays?: number;
}

export const AdminCreateBoostModal: React.FC<AdminCreateBoostModalProps> = ({
  onClose,
  onCampaignCreated,
  initialPlacement,
  initialDurationDays
}) => {
  const { sellers, products, showToast } = useApp();

  // Target Type: Seller or Product
  const [targetType, setTargetType] = useState<'seller' | 'product'>('product');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSellerId, setSelectedSellerId] = useState<string>(sellers[0]?.id || '');
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');

  // Boost Type / Placement
  const [placement, setPlacement] = useState<BoostPlacement>(initialPlacement || 'hero_banner');

  // Zones
  const [targetAllZones, setTargetAllZones] = useState(true);
  const [selectedZones, setSelectedZones] = useState<string[]>(['Cocody', 'Adjamé']);

  // Duration & Pricing
  const [durationDays, setDurationDays] = useState<number>(initialDurationDays || 7);
  const [isFreeAdminGrant, setIsFreeAdminGrant] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  // Daily price calculation
  const getDailyRate = (plc: BoostPlacement) => {
    switch (plc) {
      case 'hero_banner': return 5000;
      case 'search_top': return 3500;
      case 'sponsored_badge': return 2500;
      case 'push_notification': return 4000;
      case 'all': return 8500;
    }
  };

  const calculatedBudget = isFreeAdminGrant ? 0 : getDailyRate(placement) * durationDays;

  // Filtered sellers / products for picker
  const filteredSellers = sellers.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.storeName && s.storeName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    s.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedProduct = products.find(p => p.id === selectedProductId) || products[0];
  const selectedSeller = targetType === 'seller'
    ? (sellers.find(s => s.id === selectedSellerId) || sellers[0])
    : (sellers.find(s => s.id === selectedProduct?.sellerId) || sellers[0]);

  const toggleZone = (commune: string) => {
    if (selectedZones.includes(commune)) {
      setSelectedZones(selectedZones.filter(z => z !== commune));
    } else {
      setSelectedZones([...selectedZones, commune]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const now = new Date();
    const endDate = new Date();
    endDate.setDate(now.getDate() + durationDays);

    const generatedTitle = customTitle.trim() || (
      targetType === 'seller'
        ? `Boost Marchand : ${selectedSeller?.storeName || selectedSeller?.name}`
        : `Boost Produit : ${selectedProduct?.name}`
    );

    const newCampaign: AdminBoostCampaign = {
      id: `boost-${Date.now()}`,
      title: generatedTitle,
      targetType,
      targetId: targetType === 'seller' ? selectedSeller.id : selectedProduct.id,
      targetName: targetType === 'seller' ? (selectedSeller.storeName || selectedSeller.name) : selectedProduct.name,
      targetImage: targetType === 'seller' ? selectedSeller.avatar : selectedProduct.images[0],
      targetSubtitle: targetType === 'seller' 
        ? `Marchand • ${selectedSeller.location}` 
        : `${selectedProduct.category} • ${selectedProduct.location}`,
      targetPrice: targetType === 'product' ? selectedProduct.price : undefined,
      sellerId: selectedSeller.id,
      sellerName: selectedSeller.storeName || selectedSeller.name,
      placement,
      targetZones: targetAllZones ? ['Toutes les communes'] : (selectedZones.length > 0 ? selectedZones : ['Adjamé']),
      startDate: now.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      durationDays,
      remainingDays: durationDays,
      budgetFCFA: calculatedBudget,
      isFreeAdminGrant,
      status: 'active',
      impressionsCount: 0,
      clicksCount: 0,
      ordersCount: 0,
      revenueGeneratedFCFA: 0,
      createdAt: now.toISOString(),
      notes: adminNotes || 'Campagne initiée par la console Super Admin.'
    };

    onCampaignCreated(newCampaign);
    showToast(`🚀 Campagne de boost "${generatedTitle}" activée avec succès !`);
    onClose();
  };

  return (
    <div
      id="admin-create-boost-overlay"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="admin-create-boost-modal"
        className="w-full max-w-2xl max-h-[92vh] bg-[#0E0E0E] rounded-3xl border border-white/15 flex flex-col shadow-2xl overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="shrink-0 px-4 py-3.5 border-b border-white/10 bg-[#141414] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-[#FF6321] to-amber-500 text-white shadow-md">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-black text-white">Créer un Nouveau Boost Visibilité</h2>
              <p className="text-[10px] text-white/50">
                Propulsez un vendeur d'Adjamé ou un article vedette en haut de l'application
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* FORM BODY */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 no-scrollbar">
          {/* STEP 1: TARGET TYPE SELECTION (Vendeur vs Produit) */}
          <div className="space-y-2">
            <label className="text-xs font-black text-white uppercase tracking-wider block">
              1. Que souhaitez-vous booster ?
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setTargetType('seller')}
                className={`p-3.5 rounded-2xl border text-left transition flex items-center gap-3 ${
                  targetType === 'seller'
                    ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <span className={`p-2 rounded-xl ${targetType === 'seller' ? 'bg-amber-500 text-black' : 'bg-white/10 text-white'}`}>
                  <Store className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-xs font-black">Booster un Vendeur</p>
                  <p className="text-[10px] text-white/45">Boutique & enseigne d'Adjamé</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTargetType('product')}
                className={`p-3.5 rounded-2xl border text-left transition flex items-center gap-3 ${
                  targetType === 'product'
                    ? 'bg-[#FF6321]/15 border-[#FF6321] text-white shadow-lg'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <span className={`p-2 rounded-xl ${targetType === 'product' ? 'bg-[#FF6321] text-white' : 'bg-white/10 text-white'}`}>
                  <ShoppingBag className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-xs font-black">Booster un Produit</p>
                  <p className="text-[10px] text-white/45">Article vendu spécifique</p>
                </div>
              </button>
            </div>
          </div>

          {/* ITEM PICKER WITH SEARCH */}
          <div className="space-y-2 p-3.5 rounded-2xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white">
                Sélectionnez {targetType === 'seller' ? 'le Vendeur' : "l'Article"} :
              </label>
              <span className="text-[10px] text-white/40">
                {targetType === 'seller' ? `${sellers.length} vendeurs disponibles` : `${products.length} produits disponibles`}
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={targetType === 'seller' ? "Rechercher par nom de boutique..." : "Rechercher par nom de produit..."}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]"
              />
            </div>

            {/* List of candidates */}
            <div className="max-h-36 overflow-y-auto space-y-1.5 no-scrollbar pt-1">
              {targetType === 'seller' ? (
                filteredSellers.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSellerId(s.id)}
                    className={`p-2 rounded-xl flex items-center justify-between cursor-pointer transition ${
                      selectedSellerId === s.id ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-black/30 hover:bg-white/5 border border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img src={s.avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{s.storeName || s.name}</p>
                        <p className="text-[10px] text-white/40">{s.location} • {s.salesCount} ventes</p>
                      </div>
                    </div>
                    {selectedSellerId === s.id && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />}
                  </div>
                ))
              ) : (
                filteredProducts.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedProductId(p.id)}
                    className={`p-2 rounded-xl flex items-center justify-between cursor-pointer transition ${
                      selectedProductId === p.id ? 'bg-[#FF6321]/20 border border-[#FF6321]/40' : 'bg-black/30 hover:bg-white/5 border border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img src={p.images[0]} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{p.name}</p>
                        <p className="text-[10px] text-white/40">{formatFCFA(p.price)} • {p.category}</p>
                      </div>
                    </div>
                    {selectedProductId === p.id && <CheckCircle2 className="w-4 h-4 text-[#FF6321] shrink-0" />}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* STEP 2: EMPLACEMENT DU BOOST */}
          <div className="space-y-2">
            <label className="text-xs font-black text-white uppercase tracking-wider block">
              2. Type d'Emplacement & Intensité
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                {
                  id: 'hero_banner' as BoostPlacement,
                  title: "Bannière d'Accueil & Carrousel",
                  desc: "Position n°1 en tête de page d'accueil",
                  rate: "5 000 FCFA / jour",
                  icon: Layers,
                  color: "text-[#FF6321]"
                },
                {
                  id: 'search_top' as BoostPlacement,
                  title: "Top 1 des Recherches",
                  desc: "Priorité absolue sur les mots-clés",
                  rate: "3 500 FCFA / jour",
                  icon: Search,
                  color: "text-cyan-400"
                },
                {
                  id: 'sponsored_badge' as BoostPlacement,
                  title: "Badge Sponsorisé & Cadre Doré",
                  desc: "Distinction VIP 'Recommandé Djassa'",
                  rate: "2 500 FCFA / jour",
                  icon: ShieldCheck,
                  color: "text-amber-400"
                },
                {
                  id: 'push_notification' as BoostPlacement,
                  title: "Alerte Notification Push",
                  desc: "Envoyée directement sur les téléphones",
                  rate: "4 000 FCFA / jour",
                  icon: Megaphone,
                  color: "text-rose-400"
                },
                {
                  id: 'all' as BoostPlacement,
                  title: "Pack Visibilité Totale 360°",
                  desc: "Bannière + Top Recherche + Push + Badge",
                  rate: "8 500 FCFA / jour",
                  icon: Zap,
                  color: "text-purple-400"
                }
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = placement === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setPlacement(item.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition flex items-start gap-2.5 ${
                      isSelected ? 'bg-white/15 border-white text-white' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${item.color}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-white">{item.title}</p>
                        <span className="text-[10px] text-white/50">{item.rate}</span>
                      </div>
                      <p className="text-[10px] text-white/40">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* STEP 3: COMMUNE TARGETING */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-white uppercase tracking-wider block">
                3. Ciblage Géographique (Abidjan)
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[#FF6321] font-bold">
                <input
                  type="checkbox"
                  checked={targetAllZones}
                  onChange={(e) => setTargetAllZones(e.target.checked)}
                  className="rounded accent-[#FF6321]"
                />
                <span>Toutes les communes ({ABIDJAN_COMMUNES.length})</span>
              </label>
            </div>

            {!targetAllZones && (
              <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-white/5 border border-white/10">
                {ABIDJAN_COMMUNES.map((commune) => {
                  const isChecked = selectedZones.includes(commune);
                  return (
                    <button
                      key={commune}
                      type="button"
                      onClick={() => toggleZone(commune)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                        isChecked ? 'bg-[#FF6321] text-white' : 'bg-black/40 text-white/50 hover:text-white'
                      }`}
                    >
                      <MapPin className="w-3 h-3" />
                      <span>{commune}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* STEP 4: DURATION & BUDGET */}
          <div className="space-y-2">
            <label className="text-xs font-black text-white uppercase tracking-wider block">
              4. Durée & Facturation
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { days: 1, label: '24h' },
                { days: 3, label: '3 Jours' },
                { days: 7, label: '7 Jours' },
                { days: 14, label: '14 Jours' }
              ].map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => setDurationDays(opt.days)}
                  className={`p-2.5 rounded-xl border text-center transition ${
                    durationDays === opt.days ? 'bg-[#FF6321] border-[#FF6321] text-white font-black' : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  <span className="text-xs block">{opt.label}</span>
                </button>
              ))}
            </div>

            <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 flex items-center justify-between mt-2">
              <div>
                <p className="text-xs font-bold text-white">Coût Total Estimé de la Campagne :</p>
                <p className="text-lg font-black text-emerald-400">
                  {isFreeAdminGrant ? '0 FCFA (Offert par l\'Admin)' : formatFCFA(calculatedBudget)}
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer bg-white/5 p-2 rounded-xl border border-white/10 text-xs text-amber-300 font-bold">
                <input
                  type="checkbox"
                  checked={isFreeAdminGrant}
                  onChange={(e) => setIsFreeAdminGrant(e.target.checked)}
                  className="rounded accent-amber-400"
                />
                <span>Offrir gracieusement</span>
              </label>
            </div>
          </div>
        </form>

        {/* FOOTER */}
        <div className="shrink-0 p-4 border-t border-white/10 bg-[#141414] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-bold transition"
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6321] to-amber-500 hover:opacity-95 text-white text-xs font-black flex items-center gap-1.5 shadow-lg transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>Activer le Boost Immédiatement</span>
          </button>
        </div>
      </div>
    </div>
  );
};
