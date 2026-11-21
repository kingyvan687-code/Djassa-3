import React from 'react';
import { X, Store, MapPin, Check, Plus, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface FollowedSellersModalProps {
  onClose: () => void;
}

export const FollowedSellersModal: React.FC<FollowedSellersModalProps> = ({ onClose }) => {
  const { sellers, userProfile, toggleFollowSeller, setSelectedSeller } = useApp();

  const followedSellers = sellers.filter((s) => userProfile.followedSellerIds.includes(s.id));

  return (
    <div
      id="followed-sellers-modal-overlay"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end"
      onClick={onClose}
    >
      <div
        id="followed-sellers-sheet"
        className="w-full max-h-[85vh] bg-[#141414] rounded-t-3xl border-t border-white/15 p-5 flex flex-col shadow-2xl animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h2 className="text-sm font-extrabold text-white">Boutiques Suivies</h2>
            <p className="text-[11px] text-white/50">{followedSellers.length} vendeurs d'Adjamé</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 text-white/70 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-3 no-scrollbar max-h-96">
          {followedSellers.length === 0 ? (
            <div className="text-center py-12 text-white/40 text-xs">
              Vous ne suivez encore aucune boutique. Découvrez les vendeurs dans le flux ou l'explorateur !
            </div>
          ) : (
            followedSellers.map((seller) => (
              <div
                key={seller.id}
                className="p-3 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between hover:bg-white/10 transition"
              >
                <div
                  onClick={() => {
                    onClose();
                    setSelectedSeller(seller);
                  }}
                  className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                >
                  <img
                    src={seller.avatar}
                    alt={seller.name}
                    className="w-11 h-11 rounded-full object-cover border border-[#FF6321]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-white truncate">{seller.name}</span>
                      {seller.verified && (
                        <span className="bg-[#FF6321] text-white text-[8px] font-black rounded-full px-1">✓</span>
                      )}
                    </div>
                    <p className="text-[10px] text-white/50 flex items-center gap-0.5 mt-0.5">
                      <MapPin className="w-3 h-3 text-[#FF6321]" /> {seller.location}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => toggleFollowSeller(seller.id)}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500/20 text-white/80 hover:text-rose-400 text-xs font-semibold transition border border-white/10 ml-2"
                >
                  Désabonner
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
