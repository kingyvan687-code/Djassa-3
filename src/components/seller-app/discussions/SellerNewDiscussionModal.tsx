import React, { useState } from 'react';
import { X, Search, User, ShieldCheck, ChevronRight, Plus } from 'lucide-react';
import { Order, Conversation } from '../../../types';
import { formatFCFA } from '../../../services/marketServices';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  onStartConversation: (conv: Partial<Conversation>) => void;
}

export const SellerNewDiscussionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  orders,
  onStartConversation,
}) => {
  const [activeTab, setActiveTab] = useState<'clients' | 'support'>('clients');
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const clientContacts = orders.map((o) => ({
    id: `client-${o.deliveryAddress?.phone || o.id}`,
    name: o.deliveryAddress?.recipientName || o.clientName || 'Client Djassa',
    phone: o.deliveryAddress?.phone || '+225 07 00 00 00 00',
    location: o.deliveryAddress?.commune
      ? `${o.deliveryAddress.commune}${o.deliveryAddress.quartier ? `, ${o.deliveryAddress.quartier}` : ''}`
      : 'Abidjan',
    orderId: o.orderNumber || o.id,
    orderTotal: o.total,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
  }));

  const filteredClients = clientContacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.orderId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#121212] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#FF6321]/15 text-[#FF6321] flex items-center justify-center border border-[#FF6321]/20">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Nouvelle discussion marchand</h3>
              <p className="text-[11px] text-white/50">Contactez un client pour organiser la livraison ou le support Djassa</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher: strictly Clients & Support Marchands */}
        <div className="p-3 border-b border-white/5 flex gap-2 overflow-x-auto no-scrollbar bg-white/[0.02]">
          <button
            onClick={() => setActiveTab('clients')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              activeTab === 'clients'
                ? 'bg-[#FF6321] text-white shadow-lg shadow-[#FF6321]/20'
                : 'bg-white/5 text-white/60 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Mes Clients</span>
          </button>

          <button
            onClick={() => setActiveTab('support')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
              activeTab === 'support'
                ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                : 'bg-white/5 text-white/60 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Support Marchands</span>
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-white/5 bg-white/[0.01]">
          <div className="relative">
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher par nom, téléphone, commande..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FF6321]"
            />
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 no-scrollbar">
          {activeTab === 'clients' && (
            <>
              {filteredClients.length === 0 ? (
                <div className="py-12 text-center text-white/40 text-xs">
                  Aucun client trouvé dans vos commandes récentes
                </div>
              ) : (
                filteredClients.map((c, i) => (
                  <div
                    key={`${c.id}-${i}`}
                    onClick={() => {
                      onStartConversation({
                        id: `sconv-client-${Date.now()}`,
                        participantId: c.id,
                        participantType: 'client',
                        participantRole: 'client',
                        participantName: c.name,
                        participantAvatar: c.avatar,
                        participantVerified: true,
                        participantRoleSubtitle: `Client • Commande #${c.orderId}`,
                        lastMessage: `Conversation ouverte avec ${c.name}`,
                        lastMessageTime: 'À l’instant',
                        unreadCount: 0,
                        isOnline: true,
                        online: true,
                        relatedOrderId: c.orderId,
                      });
                      onClose();
                    }}
                    className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-[#FF6321]/40 flex items-center justify-between cursor-pointer transition group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-500/20">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white truncate">{c.name}</h4>
                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[9px] font-bold">
                            Client
                          </span>
                        </div>
                        <p className="text-[11px] text-white/50 truncate">{c.location} • {c.phone}</p>
                        <span className="text-[10px] text-[#FF6321] font-bold">Commande #{c.orderId} ({formatFCFA(c.orderTotal)})</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white transition" />
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === 'support' && (
            <div
              onClick={() => {
                onStartConversation({
                  id: `sconv-support-${Date.now()}`,
                  participantId: 'support-djassa',
                  participantType: 'seller',
                  participantRole: 'seller',
                  participantName: 'Support Marchands Djassa',
                  participantAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200',
                  participantVerified: true,
                  participantRoleSubtitle: 'Assistance Vendeurs, Reversements Wave/OM & Litiges',
                  lastMessage: 'Bonjour ! Comment pouvons-nous vous assister sur votre boutique ?',
                  lastMessageTime: 'À l’instant',
                  unreadCount: 0,
                  isOnline: true,
                  online: true,
                });
                onClose();
              }}
              className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-amber-500/40 flex items-center justify-between cursor-pointer transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-black text-white">Assistance Vendeur Pro Djassa</h4>
                    <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-[9px] font-bold">
                      24/7
                    </span>
                  </div>
                  <p className="text-[11px] text-white/50">Reversements Wave/Orange Money, réclamations clients & certification</p>
                  <span className="text-[10px] text-amber-400 font-bold">Temps de réponse moyen: &lt; 5 min</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white transition" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
