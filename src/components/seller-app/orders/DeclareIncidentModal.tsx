import React, { useState, useRef } from 'react';
import {
  X,
  AlertTriangle,
  Camera,
  RotateCcw,
  XCircle,
  Check,
  ShieldAlert,
} from 'lucide-react';
import { Order, OrderIncident } from '../../../types';
import { formatFCFA } from '../../../services/marketServices';

interface Props {
  orders: Order[];
  preselectedOrderId?: string;
  onClose: () => void;
  onSubmitIncident: (orderId: string, incident: OrderIncident) => void;
}

export const DeclareIncidentModal: React.FC<Props> = ({
  orders,
  preselectedOrderId,
  onClose,
  onSubmitIncident,
}) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    preselectedOrderId || orders[0]?.id || ''
  );
  const [incidentType, setIncidentType] = useState<OrderIncident['type']>('damaged');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [liability, setLiability] = useState<'seller' | 'client'>('seller');
  const [details, setDetails] = useState('');
  const [photoProof, setPhotoProof] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  const damagedReasons = [
    'Article endommagé pendant l’expédition externe',
    'Colis abîmé ou mouillé à la réception',
    'Emballage percé ou défaut constaté',
    'Autre dommage physique',
  ];

  const returnedReasons = [
    'Client injoignable lors de la livraison organisée par la boutique',
    'Refus du client à la réception',
    'Adresse incomplète ou secteur inaccessible',
    'Autre motif de retour',
  ];

  const cancelledReasons = [
    'Demande d’annulation du client',
    'Rupture imprévue de stock en boutique',
    'Erreur d’article ou de taille dans la commande',
    'Autre motif',
  ];

  const currentReasons =
    incidentType === 'damaged'
      ? damagedReasons
      : incidentType === 'returned'
      ? returnedReasons
      : cancelledReasons;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoProof(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) return;

    const finalReason =
      reason === 'Autre dommage physique' || reason.startsWith('Autre')
        ? customReason.trim() || reason
        : reason || currentReasons[0];

    const incident: OrderIncident = {
      type: incidentType,
      reason: finalReason,
      reportedAt: new Date().toISOString(),
      reportedBy: 'seller',
      photoProof: photoProof || undefined,
      details: details.trim() || undefined,
      compensationStatus: incidentType === 'cancelled' ? 'refunded' : 'pending',
      compensationAmount: selectedOrder?.total || 0,
      liability,
    };

    onSubmitIncident(selectedOrderId, incident);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-[#121212] border border-white/15 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col my-auto max-h-[92vh]">
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white">
                Signaler un Incident Boutique
              </h3>
              <p className="text-[11px] text-white/50">
                Déclaration de dommage, retour ou réclamation client
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar">
          <div>
            <label className="block text-xs font-bold text-white/70 mb-2">Type d&apos;incident :</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setIncidentType('damaged');
                  setReason(damagedReasons[0]);
                }}
                className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                  incidentType === 'damaged'
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300 font-bold'
                    : 'bg-white/5 border-white/10 text-white/60'
                }`}
              >
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span className="text-xs">Endommagé</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIncidentType('returned');
                  setReason(returnedReasons[0]);
                }}
                className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                  incidentType === 'returned'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                    : 'bg-white/5 border-white/10 text-white/60'
                }`}
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <span className="text-xs">Retour</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIncidentType('cancelled');
                  setReason(cancelledReasons[0]);
                }}
                className={`p-2.5 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                  incidentType === 'cancelled'
                    ? 'bg-red-500/20 border-red-500 text-red-300 font-bold'
                    : 'bg-white/5 border-white/10 text-white/60'
                }`}
              >
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-xs">Litige / Refus</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-white/70 mb-1.5">Commande concernée :</label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-neutral-900 border border-white/15 text-xs text-white focus:outline-none focus:border-[#FF6321]"
            >
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.orderNumber} • {o.items[0]?.productTitle?.slice(0, 30)} ({formatFCFA(o.total)}) -{' '}
                  {o.deliveryAddress.recipientName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-white/70 mb-1.5">Motif principal :</label>
            <select
              value={reason || currentReasons[0]}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-neutral-900 border border-white/15 text-xs text-white focus:outline-none focus:border-[#FF6321]"
            >
              {currentReasons.map((r, i) => (
                <option key={i} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {(reason.startsWith('Autre') || reason === 'Autre dommage physique') && (
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Précisez le motif..."
                className="w-full mt-2 p-2.5 rounded-xl bg-neutral-900 border border-white/15 text-xs text-white"
              />
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-white/70 mb-1.5">
              Responsabilité constatée :
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { id: 'seller', label: 'Boutique (Emballage / Livraison externe)' },
                { id: 'client', label: 'Client (Absent / Refus)' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLiability(opt.id as 'seller' | 'client')}
                  className={`p-2 rounded-xl border text-center transition font-semibold ${
                    liability === opt.id
                      ? 'bg-[#FF6321]/20 border-[#FF6321] text-white'
                      : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-white/70 mb-1.5">Photo de preuve :</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            {photoProof ? (
              <div className="relative rounded-2xl overflow-hidden border border-emerald-500/30 max-h-40 bg-black/60">
                <img src={photoProof} alt="Preuve" className="w-full h-36 object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotoProof('')}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-4 rounded-2xl border-2 border-dashed border-white/15 hover:border-white/30 bg-white/[0.02] flex flex-col items-center justify-center gap-1.5 transition text-white/60 hover:text-white"
              >
                <Camera className="w-6 h-6 text-[#FF6321]" />
                <span className="text-xs font-bold">Ajouter une photo de preuve</span>
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-white/70 mb-1.5">Explications :</label>
            <textarea
              rows={2}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Décrivez les circonstances..."
              className="w-full p-2.5 rounded-xl bg-neutral-900 border border-white/15 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]"
            />
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs border border-white/10"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 font-black text-xs text-white flex items-center justify-center gap-2 shadow-lg"
            >
              <Check className="w-4 h-4" />
              <span>Enregistrer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
