import React, { useState } from 'react';
import { X, AlertTriangle, AlertCircle, Package, Camera, DollarSign, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Product, Order } from '../../../types';
import { BoutiqueIssue, IssueType, IssuePriority } from './types';
import { formatFCFA } from '../../../services/marketServices';

interface Props {
  products: Product[];
  orders?: Order[];
  preselectedProduct?: Product | null;
  onClose: () => void;
  onSubmit: (issue: BoutiqueIssue) => void;
}

export const ReportIssueModal: React.FC<Props> = ({
  products,
  orders = [],
  preselectedProduct,
  onClose,
  onSubmit,
}) => {
  const [type, setType] = useState<IssueType>(
    preselectedProduct ? 'damaged_stock' : 'client_claim'
  );
  const [selectedProductId, setSelectedProductId] = useState<string>(
    preselectedProduct?.id || ''
  );
  const [orderNumber, setOrderNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [title, setTitle] = useState(
    preselectedProduct ? `Incident sur : ${preselectedProduct.name}` : ''
  );
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<IssuePriority>('urgent');
  const [financialImpact, setFinancialImpact] = useState<string>(
    preselectedProduct ? String(preselectedProduct.price) : ''
  );
  const [liability, setLiability] = useState<'seller' | 'client'>('seller');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [proofPhoto, setProofPhoto] = useState<string | null>(null);

  const selectedProd = products.find((p) => p.id === selectedProductId);
  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const finalOrderNumber = selectedOrder?.orderNumber || orderNumber.trim() || undefined;
    const finalClientName = selectedOrder?.deliveryAddress.recipientName || clientName.trim() || undefined;
    const finalClientPhone = selectedOrder?.deliveryAddress.phone || clientPhone.trim() || undefined;
    const finalClientCommune = selectedOrder?.deliveryAddress.commune || undefined;

    const newIssue: BoutiqueIssue = {
      id: `issue-${Date.now()}`,
      type,
      title: title.trim(),
      reference: `#INC-${Math.floor(1000 + Math.random() * 9000)}`,
      description: description.trim() || 'Aucune description fournie.',
      productId: selectedProd?.id || selectedOrder?.items[0]?.productId,
      productTitle: selectedProd?.name || selectedOrder?.items[0]?.productTitle,
      productImage: proofPhoto || selectedProd?.images[0] || selectedOrder?.items[0]?.productImage,
      orderId: selectedOrder?.id,
      orderNumber: finalOrderNumber,
      clientName: finalClientName,
      clientPhone: finalClientPhone,
      clientCommune: finalClientCommune,
      priority,
      status: 'pending',
      financialImpact: Math.max(0, Number(financialImpact) || selectedOrder?.total || 0),
      createdAt: "Aujourd'hui, " + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      liability,
      photoProof: proofPhoto || undefined,
      djassaClaimStatus: 'not_claimed',
    };

    onSubmit(newIssue);
    onClose();
  };

  return (
    <div
      id="report-issue-modal-backdrop"
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        id="report-issue-modal"
        className="w-full max-w-md bg-[#121212] border border-white/10 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Signaler un incident boutique</h3>
              <p className="text-[10px] text-white/50">Marchandises défectueuses, litiges & retours</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-white/50 hover:text-white"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-3.5">
          {/* Issue Type */}
          <div>
            <label className="text-xs font-bold text-white/80 block mb-1.5">
              Type d'incident ou problème
            </label>
            <select
              id="select-issue-type"
              value={type}
              onChange={(e) => setType(e.target.value as IssueType)}
              className="w-full p-2.5 rounded-xl bg-[#1c1c1c] border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
            >
              <option value="client_claim">🚨 Réclamation client (Non conforme / Taille / Qualité)</option>
              <option value="damaged_stock">💥 Marchandise endommagée / Colis cassé</option>
              <option value="order_return">🔄 Retour colis boutique (Client absent / Refus)</option>
              <option value="delivery_issue">🚚 Difficulté ou retard de livraison boutique</option>
              <option value="inventory_shortage">📉 Rupture imprévue / Écart de stock</option>
              <option value="order_cancellation">❌ Annulation de commande avant livraison</option>
              <option value="factory_defect">⚠️ Défaut de fabrication / Lot altéré</option>
            </select>
          </div>

          {/* Associated Order (if available) */}
          {orders.length > 0 && (
            <div>
              <label className="text-xs font-bold text-white/80 block mb-1">
                Commande associée (optionnel)
              </label>
              <select
                id="select-issue-order"
                value={selectedOrderId}
                onChange={(e) => {
                  const ordId = e.target.value;
                  setSelectedOrderId(ordId);
                  const ord = orders.find((o) => o.id === ordId);
                  if (ord) {
                    setOrderNumber(ord.orderNumber);
                    setClientName(ord.deliveryAddress.recipientName);
                    setClientPhone(ord.deliveryAddress.phone);
                    if (!title) setTitle(`Litige sur commande #${ord.orderNumber}`);
                    if (!financialImpact) setFinancialImpact(String(ord.total));
                  }
                }}
                className="w-full p-2.5 rounded-xl bg-[#1c1c1c] border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
              >
                <option value="">-- Aucune commande spécifique --</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.orderNumber} - {o.deliveryAddress.recipientName} ({formatFCFA(o.total)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Associated Merchandise */}
          <div>
            <label className="text-xs font-bold text-white/80 block mb-1">
              Marchandise concernée (optionnel)
            </label>
            <select
              id="select-issue-product"
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(e.target.value);
                const p = products.find((prod) => prod.id === e.target.value);
                if (p && !title) {
                  setTitle(`Problème sur : ${p.name}`);
                  setFinancialImpact(String(p.price));
                }
              }}
              className="w-full p-2.5 rounded-xl bg-[#1c1c1c] border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
            >
              <option value="">-- Aucune marchandise spécifique --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Stock: {p.stock})
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-bold text-white/80 block mb-1">
              Titre résumé de l'incident
            </label>
            <input
              id="input-issue-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Robe tachée reçue par la cliente d'Angré"
              className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#FF6321]"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-white/80 block mb-1">
              Description détaillée du problème
            </label>
            <textarea
              id="textarea-issue-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Expliquez ce qui s'est passé, les échanges avec le client ou le constat en magasin..."
              className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[#FF6321] resize-none"
              required
            />
          </div>

          {/* Client & Order details if client claim */}
          {(type === 'client_claim' || type === 'delivery_issue') && (
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
              <span className="text-[10px] text-[#FF6321] uppercase font-bold tracking-wider block">
                Informations commande & client
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-white/60 block mb-1">N° Commande</label>
                  <input
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="Ex : CMD-8420"
                    className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/60 block mb-1">Nom du client</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex : Sarah K."
                    className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-white/60 block mb-1">Téléphone client</label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="Ex : 07 12 34 56 78"
                  className="w-full p-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                />
              </div>
            </div>
          )}

          {/* Priority & Financial Impact */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-white/80 block mb-1">Priorité</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as IssuePriority)}
                className="w-full p-2.5 rounded-xl bg-[#1c1c1c] border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
              >
                <option value="urgent">🔴 Critique / Urgent</option>
                <option value="medium">🟠 Modérée</option>
                <option value="low">🟢 Faible</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-white/80 block mb-1">Valeur / Coût (FCFA)</label>
              <input
                type="number"
                min={0}
                value={financialImpact}
                onChange={(e) => setFinancialImpact(e.target.value)}
                placeholder="Ex : 15 000"
                className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
              />
            </div>
          </div>

          {/* Responsibility / Liability */}
          <div>
            <label className="text-xs font-bold text-white/80 block mb-1">
              Responsabilité constatée
            </label>
            <select
              value={liability}
              onChange={(e) => setLiability(e.target.value as any)}
              className="w-full p-2.5 rounded-xl bg-[#1c1c1c] border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
            >
              <option value="seller">🏪 Boutique (Livraison / Emballage / Stock défaillant)</option>
              <option value="client">👤 Client (Injoignable / Absent / Refus injustifié)</option>
            </select>
          </div>

          {/* Proof Photo Upload */}
          <div>
            <label className="text-xs font-bold text-white/80 block mb-1.5">
              Photo du constat ou du produit défectueux (optionnel)
            </label>
            {proofPhoto ? (
              <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-white/20">
                <img src={proofPhoto} alt="Preuve" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setProofPhoto(null)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-white/20 bg-white/5 hover:bg-white/10 cursor-pointer text-xs text-white/60">
                <Camera className="w-4 h-4 text-[#FF6321]" />
                <span>Ajouter une photo de preuve</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === 'string') setProofPhoto(reader.result);
                      };
                      reader.readAsDataURL(f);
                    }
                  }}
                />
              </label>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white/70 text-xs font-bold transition"
            >
              Annuler
            </button>
            <button
              id="btn-submit-report-issue"
              type="submit"
              className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg shadow-rose-600/20 transition flex items-center justify-center gap-1.5"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Enregistrer l'incident</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
