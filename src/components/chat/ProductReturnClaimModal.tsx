import React, { useState } from 'react';
import { 
  X, 
  AlertTriangle, 
  RotateCcw, 
  DollarSign, 
  Package, 
  Camera, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';
import { Order, Product } from '../../types';
import { formatFCFA } from '../../services/marketServices';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sellerName: string;
  sellerId: string;
  orders: Order[];
  products: Product[];
  defaultOrderId?: string;
  defaultProductId?: string;
  defaultResolution?: 'exchange' | 'refund';
  onSubmitClaim: (claimData: {
    orderNumber: string;
    productTitle: string;
    productImage: string;
    productPrice: number;
    issueType: 'broken' | 'damaged' | 'wrong_item' | 'missing_item';
    issueLabel: string;
    resolution: 'exchange' | 'refund';
    resolutionLabel: string;
    details: string;
    proofPhotoUrl: string;
  }) => void;
}

const ISSUE_TYPES = [
  {
    id: 'broken' as const,
    label: 'Ne fonctionne pas / En panne',
    description: 'Le produit ne s’allume pas, présente une panne ou un défaut technique.',
    icon: '⚡',
  },
  {
    id: 'damaged' as const,
    label: 'Produit ou colis endommagé',
    description: 'L’article est arrivé cassé, fissuré ou écrasé lors du transport.',
    icon: '💥',
  },
  {
    id: 'wrong_item' as const,
    label: 'Non conforme (taille / couleur incorrecte)',
    description: 'Vous avez reçu un modèle, une taille ou une couleur différente de votre choix.',
    icon: '📏',
  },
  {
    id: 'missing_item' as const,
    label: 'Pièce ou accessoire manquant',
    description: 'Un élément, un câble ou un article de la commande est manquant dans le colis.',
    icon: '📦',
  },
];

const SAMPLE_PROOF_PHOTOS = [
  {
    id: 'photo-1',
    label: 'Écouteurs ne chargeant pas',
    url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600',
  },
  {
    id: 'photo-2',
    label: 'Emballage perforé / fissuré',
    url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600',
  },
  {
    id: 'photo-3',
    label: 'Défaut couture / accroc tissu',
    url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600',
  },
];

export const ProductReturnClaimModal: React.FC<Props> = ({
  isOpen,
  onClose,
  sellerName,
  sellerId,
  orders,
  products,
  defaultOrderId,
  defaultProductId,
  defaultResolution = 'exchange',
  onSubmitClaim,
}) => {
  // Find applicable items from client orders with this seller
  const sellerOrders = orders.filter((o) =>
    o.items.some((it) => it.sellerId === sellerId || it.sellerName === sellerName)
  );

  const availableItems = sellerOrders.flatMap((o) =>
    o.items.map((it) => ({
      orderNumber: o.orderNumber,
      productId: it.productId,
      title: it.productTitle,
      image: it.productImage,
      price: it.price,
      orderId: o.id,
    }))
  );

  const initialItem = availableItems.find(
    (it) => it.orderId === defaultOrderId || it.productId === defaultProductId
  ) || availableItems[0] || null;

  const [selectedItem, setSelectedItem] = useState(initialItem);
  const [selectedIssue, setSelectedIssue] = useState<'broken' | 'damaged' | 'wrong_item' | 'missing_item'>('broken');
  const [resolution, setResolution] = useState<'exchange' | 'refund'>(defaultResolution);

  React.useEffect(() => {
    setSelectedItem(
      availableItems.find((it) => it.orderId === defaultOrderId || it.productId === defaultProductId) ||
        availableItems[0] ||
        null
    );
  }, [orders.length, sellerId, isOpen]);

  // Sync default resolution when prop changes
  React.useEffect(() => {
    if (defaultResolution) {
      setResolution(defaultResolution);
    }
  }, [defaultResolution, isOpen]);
  const [details, setDetails] = useState('');
  const [proofPhotoUrl, setProofPhotoUrl] = useState(SAMPLE_PROOF_PHOTOS[0].url);
  const [customProofPreview, setCustomProofPreview] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (dataUrl) {
        setCustomProofPreview(dataUrl);
        setProofPhotoUrl(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const issueObj = ISSUE_TYPES.find((t) => t.id === selectedIssue);
    const issueLabel = issueObj?.label || 'Problème produit';
    const resolutionLabel =
      resolution === 'exchange'
        ? 'Échange à neuf (reprise coursier gratuite)'
        : 'Remboursement intégral (Wave / Mobile Money)';

    onSubmitClaim({
      orderNumber: selectedItem.orderNumber,
      productTitle: selectedItem.title,
      productImage: selectedItem.image,
      productPrice: selectedItem.price,
      issueType: selectedIssue,
      issueLabel,
      resolution,
      resolutionLabel,
      details: details.trim() || `Demande de prise en charge pour : ${issueLabel}`,
      proofPhotoUrl,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div 
        className="w-full max-w-lg bg-[#141414] border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 px-5 border-b border-white/10 bg-[#1A1A1A] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white">
                Signaler un Problème / Retour & Échange
              </h2>
              <p className="text-[11px] text-white/50">
                Garantie Djassa auprès de <span className="text-[#FF6321] font-bold">{sellerName}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
          {/* 1. Article / Commande concerné */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase text-white/50 tracking-wider">
              1. Article concerné par le problème
            </label>
            {availableItems.length === 0 ? (
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-white/60">
                Aucune commande éligible trouvée auprès de {sellerName}. Passez une commande pour pouvoir ouvrir un retour.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {availableItems.map((it, idx) => {
                  const isSelected = selectedItem?.orderNumber === it.orderNumber && selectedItem?.productId === it.productId;
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedItem(it)}
                      className={`p-2.5 rounded-2xl border cursor-pointer flex items-center gap-3 transition ${
                        isSelected
                          ? 'bg-[#FF6321]/15 border-[#FF6321] text-white'
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      <img
                        src={it.image}
                        alt={it.title}
                        className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-[#FF6321] font-bold uppercase">
                            Commande #{it.orderNumber}
                          </span>
                          <span className="text-xs font-black text-white">
                            {formatFCFA(it.price)}
                          </span>
                        </div>
                        <p className="text-xs font-bold truncate text-white">{it.title}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Motif du problème */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase text-white/50 tracking-wider">
              2. Quel est le problème rencontré ?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ISSUE_TYPES.map((issue) => {
                const isSelected = selectedIssue === issue.id;
                return (
                  <button
                    key={issue.id}
                    type="button"
                    onClick={() => setSelectedIssue(issue.id)}
                    className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg'
                        : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{issue.icon}</span>
                      <span className="text-xs font-bold text-white">{issue.label}</span>
                    </div>
                    <p className="text-[10px] text-white/50 leading-snug">
                      {issue.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Solution souhaitée (Échange ou Remboursement) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase text-white/50 tracking-wider">
              3. Quelle solution demandez-vous au vendeur ?
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setResolution('exchange')}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1.5 transition ${
                  resolution === 'exchange'
                    ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-black text-white">🔄 Retour & Échange</span>
                </div>
                <p className="text-[10px] text-white/60 leading-snug">
                  Le vendeur envoie un coursier pour échanger le produit contre un exemplaire neuf fonctionnel.
                </p>
                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full self-start">
                  Recommandé & Rapide
                </span>
              </button>

              <button
                type="button"
                onClick={() => setResolution('refund')}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1.5 transition ${
                  resolution === 'refund'
                    ? 'bg-cyan-500/20 border-cyan-500 text-white shadow-lg shadow-cyan-500/10'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-black text-white">💰 Remboursement</span>
                </div>
                <p className="text-[10px] text-white/60 leading-snug">
                  Remboursement intégral du montant versé sur votre compte Wave ou Orange Money.
                </p>
                <span className="text-[9px] font-bold text-cyan-400 bg-cyan-500/20 px-2 py-0.5 rounded-full self-start">
                  Garantie Djassa Wave
                </span>
              </button>
            </div>
          </div>

          {/* 4. Description détaillée */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase text-white/50 tracking-wider">
              4. Précisez le problème rencontré
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Expliquez ce qui ne va pas (ex: l'écouteur gauche ne charge pas du tout, la taille reçue est du 38 au lieu du 42, etc.)..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF6321] transition resize-none"
            />
          </div>

          {/* 5. Photo de preuve */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black uppercase text-white/50 tracking-wider flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-[#FF6321]" />
                <span>5. Photo de preuve du produit</span>
              </label>
              <label className="text-[10px] text-[#FF6321] hover:underline font-bold cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleProofUpload} />
                + Importer ma photo
              </label>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              {customProofPreview && (
                <div
                  onClick={() => setProofPhotoUrl(customProofPreview)}
                  className={`rounded-xl overflow-hidden border-2 cursor-pointer relative group transition ${
                    proofPhotoUrl === customProofPreview ? 'border-[#FF6321] ring-2 ring-[#FF6321]/30' : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <img src={customProofPreview} alt="Ma preuve" className="w-full h-16 object-cover" />
                  <div className="p-1 bg-black/80 text-[8px] text-emerald-400 truncate text-center">
                    Votre photo ✓
                  </div>
                </div>
              )}
              {SAMPLE_PROOF_PHOTOS.map((sp) => {
                const isSelected = proofPhotoUrl === sp.url;
                return (
                  <div
                    key={sp.id}
                    onClick={() => setProofPhotoUrl(sp.url)}
                    className={`rounded-xl overflow-hidden border-2 cursor-pointer relative group transition ${
                      isSelected ? 'border-[#FF6321] ring-2 ring-[#FF6321]/30' : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    <img src={sp.url} alt={sp.label} className="w-full h-16 object-cover" />
                    <div className="p-1 bg-black/80 text-[8px] text-white/80 truncate text-center">
                      {sp.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Garantie Djassa */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-2.5 text-xs text-white/70">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <p className="text-[10px] leading-relaxed">
              <strong>Protection Acheteur Djassa :</strong> Le vendeur dispose de 24h pour vous répondre. En cas d'absence de solution, Djassa débloque votre remboursement sans négociation.
            </p>
          </div>

          {/* Submit Action */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!selectedItem}
              className="flex-1 py-3 px-4 rounded-2xl bg-[#FF6321] hover:bg-[#ff753b] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs transition shadow-lg shadow-[#FF6321]/30 flex items-center justify-center gap-2 active:scale-95"
            >
              <span>Envoyer la réclamation au vendeur</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
