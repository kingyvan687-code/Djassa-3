import React, { useState } from 'react';
import {
  X,
  Search,
  ShieldCheck,
  MessageCircle,
  ChevronRight
} from 'lucide-react';
import { Seller } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sellers: Seller[];
  onSelectSeller: (sellerId: string) => void;
  onSelectSupport: () => void;
}

export const NewConversationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  sellers,
  onSelectSeller,
  onSelectSupport
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const filteredSellers = sellers.filter(
    (s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.location.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      id="new-conversation-modal-backdrop"
      className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        id="new-conversation-modal"
        className="w-full max-w-md bg-[#121212] border border-white/10 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#FF6321]/20 text-[#FF6321]">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Nouvelle Discussion</h3>
              <p className="text-[10px] text-white/50">Contactez directement une boutique ou le support DJASSA</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-white/50 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          onClick={() => {
            onSelectSupport();
            onClose();
          }}
          className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-emerald-900/20 to-black border border-emerald-500/30 flex items-center justify-between cursor-pointer hover:border-emerald-500/60 transition group shrink-0"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <b className="text-xs text-white group-hover:text-emerald-300 transition">
                  Assistance & SAV Djassa 24/7
                </b>
                <span className="text-[8px] bg-emerald-500 text-black font-black px-1.5 py-0.2 rounded-full">
                  OFFICIEL
                </span>
              </div>
              <p className="text-[10px] text-white/60 truncate mt-0.5">
                Une question sur une commande ou un paiement ?
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-emerald-400 shrink-0 group-hover:translate-x-0.5 transition" />
        </div>

        <div className="relative shrink-0">
          <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une boutique, commune..."
            className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF6321]"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar pr-0.5">
          {filteredSellers.length > 0 ? (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider block px-1">
                Boutiques Vérifiées ({filteredSellers.length})
              </span>
              {filteredSellers.map((seller) => (
                <div
                  key={seller.id}
                  onClick={() => {
                    onSelectSeller(seller.id);
                    onClose();
                  }}
                  className="p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/10 border border-white/5 transition flex items-center justify-between gap-3 cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative w-10 h-10 rounded-2xl overflow-hidden bg-neutral-900 border border-white/10 shrink-0">
                      <img src={seller.avatar} alt={seller.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <b className="text-xs text-white truncate group-hover:text-[#FF6321] transition">
                          {seller.name}
                        </b>
                        {seller.verified && (
                          <ShieldCheck className="w-3.5 h-3.5 text-[#FF6321] shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] text-white/50 block truncate">
                        {seller.location} • ★ {seller.rating || 4.9}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold text-[#FF6321] bg-[#FF6321]/15 px-2 py-1 rounded-lg shrink-0">
                    Écrire
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-white/40 text-xs">
              Aucune boutique trouvée pour "{query}".
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
