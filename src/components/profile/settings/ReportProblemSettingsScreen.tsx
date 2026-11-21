import React, { useRef, useState } from 'react';
import {
  ChevronLeft,
  AlertCircle,
  Camera,
  Send,
  HelpCircle,
  Truck,
  CreditCard,
  Store,
  Smartphone,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';

interface ReportProblemSettingsScreenProps {
  onBack: () => void;
}

interface AttachmentPayload {
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
}

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Impossible de lire le fichier'));
    reader.readAsDataURL(file);
  });
}

export const ReportProblemSettingsScreen: React.FC<ReportProblemSettingsScreenProps> = ({ onBack }) => {
  const { showToast, orders, supportTickets, createSupportTicket, userProfile } = useApp();

  const [activeTab, setActiveTab] = useState<'new' | 'tickets'>('new');
  const [selectedTopic, setSelectedTopic] = useState('Livraison moto & Retard');
  const [description, setDescription] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [attachments, setAttachments] = useState<AttachmentPayload[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [newTicketId, setNewTicketId] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const topics = [
    { id: 'delivery', label: 'Livraison moto & Retard', icon: Truck },
    { id: 'payment', label: 'Paiement Wave / Mobile Money', icon: CreditCard },
    { id: 'product', label: 'Article défectueux ou non conforme', icon: Store },
    { id: 'app', label: 'Bug vidéo ou écran figé', icon: Smartphone },
    { id: 'seller', label: 'Boutique frauduleuse / Contrefaçon', icon: AlertCircle },
    { id: 'other', label: 'Autre préoccupation', icon: HelpCircle }
  ];

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const remaining = 3 - attachments.length;
    if (remaining <= 0) {
      showToast('Maximum 3 captures par signalement.');
      return;
    }

    const accepted: AttachmentPayload[] = [];
    for (const file of files.slice(0, remaining)) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        showToast(`${file.name} : format non supporté (PNG, JPEG, WEBP, GIF).`);
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        showToast(`${file.name} dépasse la limite de 4 Mo.`);
        continue;
      }
      const dataUrl = await readFileAsDataUrl(file);
      accepted.push({
        name: file.name,
        mimeType: file.type,
        size: file.size,
        dataUrl,
      });
    }

    if (accepted.length > 0) {
      setAttachments((prev) => [...prev, ...accepted]);
      showToast(`${accepted.length} capture(s) ajoutée(s)`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      showToast('Veuillez décrire le problème rencontré.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createSupportTicket({
        ticketType: 'problem',
        category: selectedTopic,
        description: description.trim(),
        orderId: selectedOrderId || undefined,
        contactEmail: userProfile.email || undefined,
        attachments,
      });
      if (created) {
        setNewTicketId(created.id);
        setIsSubmitted(true);
        setAttachments([]);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setIsSubmitted(false);
    setDescription('');
    setSelectedOrderId('');
    setAttachments([]);
  };

  return (
    <div
      id="report-problem-settings-screen"
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
            Signaler un problème
          </h1>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex bg-[#121212] border-b border-white/10 px-4 py-2 gap-2 text-xs font-bold">
        <button
          onClick={() => setActiveTab('new')}
          className={`flex-1 py-2 rounded-xl transition ${
            activeTab === 'new'
              ? 'bg-[#FF6321] text-white shadow'
              : 'text-white/50 hover:text-white'
          }`}
        >
          Nouveau signalement
        </button>
        <button
          onClick={() => setActiveTab('tickets')}
          className={`flex-1 py-2 rounded-xl transition ${
            activeTab === 'tickets'
              ? 'bg-[#FF6321] text-white shadow'
              : 'text-white/50 hover:text-white'
          }`}
        >
          Mes tickets ({supportTickets.length})
        </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-5 pb-16">
        {activeTab === 'new' ? (
          isSubmitted ? (
            <div className="p-6 bg-[#141414] border border-white/10 rounded-3xl text-center space-y-4 my-8 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Signalement transmis</h3>
                <p className="text-xs text-[#FF6321] font-mono font-bold mt-1">Ticket #{newTicketId}</p>
                <p className="text-xs text-white/60 mt-2 max-w-xs mx-auto">
                  Votre ticket est enregistré auprès du support client Djassa. Vous pouvez suivre son statut à tout moment dans l'onglet « Mes tickets ».
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleResetForm}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white rounded-2xl text-xs font-bold transition"
                >
                  Nouveau signalement
                </button>
                <button
                  onClick={() => setActiveTab('tickets')}
                  className="flex-1 py-3 bg-[#FF6321] hover:bg-[#E05316] text-white rounded-2xl text-xs font-bold transition shadow"
                >
                  Consulter mes tickets
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Category */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/50 uppercase tracking-wider block">
                  Sélectionnez un sujet
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {topics.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => setSelectedTopic(t.label)}
                        className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition ${
                          selectedTopic === t.label
                            ? 'bg-[#FF6321]/15 border-[#FF6321] text-white font-bold'
                            : 'bg-white/5 border-white/5 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        <Icon className="w-4 h-4 text-[#FF6321] flex-shrink-0 mt-0.5" />
                        <span className="leading-tight text-[11px]">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Related order picker */}
              {orders.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white/50 uppercase tracking-wider block">
                    Commande concernée (facultatif)
                  </label>
                  <select
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    className="w-full bg-[#121212] border border-white/10 rounded-2xl px-3 py-2.5 text-xs text-white outline-none focus:border-[#FF6321]"
                  >
                    <option value="">Sélectionner une commande récente</option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        #{o.orderNumber || o.id.slice(-6)} - {o.items?.[0]?.productTitle || 'Article'} ({(o.total || 0).toLocaleString('fr-FR')} FCFA)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white/50 uppercase tracking-wider">
                    Description détaillée
                  </label>
                  <span className="text-[10px] text-white/40">{description.length}/500</span>
                </div>
                <textarea
                  rows={4}
                  maxLength={500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez avec précision ce qui s'est passé (colis non livré, retard coursier, erreur d'article, remboursement non perçu)..."
                  className="w-full bg-[#121212] border border-white/10 rounded-2xl p-3 text-xs text-white placeholder-white/30 outline-none focus:border-[#FF6321] resize-none"
                />
              </div>

              {/* Real file attachment */}
              <div className="p-3 bg-white/5 rounded-2xl border border-white/5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-xs">
                    <Camera className="w-4 h-4 text-white/60" />
                    <span className="text-white/80">
                      {attachments.length > 0
                        ? `${attachments.length}/3 capture(s) jointe(s)`
                        : 'Joindre une photo ou capture (PNG/JPG, max 4 Mo)'}
                    </span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    multiple
                    className="hidden"
                    onChange={handleFilesSelected}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={attachments.length >= 3}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-xl transition bg-white/10 text-white hover:bg-white/15 disabled:opacity-40"
                  >
                    Parcourir
                  </button>
                </div>

                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((att, index) => (
                      <div
                        key={`${att.name}-${index}`}
                        className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-black"
                      >
                        <img
                          src={att.dataUrl}
                          alt={att.name}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== index))}
                          aria-label={`Retirer ${att.name}`}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/80 text-white flex items-center justify-center hover:bg-red-600 transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-[#FF6321] hover:bg-[#E05316] disabled:opacity-50 text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 transition active:scale-95 shadow-lg shadow-[#FF6321]/30"
              >
                <Send className="w-4 h-4" />
                {isSubmitting ? 'Envoi en cours...' : 'Envoyer le signalement au support'}
              </button>
            </form>
          )
        ) : (
          /* Tickets Tab */
          <div className="space-y-3">
            {supportTickets.length === 0 ? (
              <div className="py-12 text-center bg-[#121212] border border-white/5 rounded-2xl p-6 space-y-2">
                <p className="text-sm font-bold text-white">Aucun ticket enregistré</p>
                <p className="text-xs text-white/50">
                  Vos signalements et litiges apparaîtront ici dès que vous en créerez un.
                </p>
              </div>
            ) : (
              supportTickets.map((t) => (
                <div key={t.id} className="p-4 bg-[#141414] border border-white/5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[#FF6321]">#{t.id}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                        {t.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-white/40">
                      {new Date(t.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-white">{t.category}</p>
                  {t.orderId && <p className="text-[11px] text-white/50">Commande {t.orderId}</p>}
                  <p className="text-xs text-white/75 leading-relaxed">{t.description}</p>

                  {t.attachments && t.attachments.length > 0 && (
                    <div className="flex gap-2 pt-1">
                      {t.attachments.map((att, idx) => (
                        <img
                          key={idx}
                          src={att.dataUrl}
                          alt={att.name}
                          className="w-12 h-12 rounded-lg object-cover border border-white/10"
                        />
                      ))}
                    </div>
                  )}

                  <div className="p-2.5 bg-white/5 rounded-xl text-[11px] text-white/80 border-l-2 border-[#FF6321]">
                    <p className="font-semibold text-white/90">Suivi du ticket :</p>
                    <p className="mt-0.5 text-white/60">
                      {t.status === 'resolved'
                        ? 'Dossier clôturé par le support Djassa.'
                        : t.status === 'in_review'
                        ? 'Dossier en cours d\'analyse par notre équipe.'
                        : 'En attente de prise en charge par le support.'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
};
