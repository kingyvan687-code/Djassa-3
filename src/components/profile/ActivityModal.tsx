import React from 'react';
import { X, Clock, Eye, Heart, ShoppingBag, MessageCircle, Bookmark, Flame } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface ActivityModalProps {
  onClose: () => void;
}

export const ActivityModal: React.FC<ActivityModalProps> = ({ onClose }) => {
  const { userActivity } = useApp();

  const formatSeconds = (sec: number) => {
    const minutes = Math.floor(sec / 60);
    return `${minutes} min ${sec % 60} s`;
  };

  const stats = [
    { label: 'Temps passé', value: `${userActivity.totalMinutesSpent} min`, icon: Clock, color: 'text-amber-400' },
    { label: 'Vidéos vues', value: `${userActivity.completedVideosCount}`, icon: Eye, color: 'text-blue-400' },
    { label: 'Likes donnés', value: `${userActivity.likesCount}`, icon: Heart, color: 'text-rose-400' },
    { label: 'Commentaires', value: `${userActivity.commentsCount}`, icon: MessageCircle, color: 'text-emerald-400' },
    { label: 'Enregistrements', value: `${userActivity.savedCount}`, icon: Bookmark, color: 'text-purple-400' },
    { label: 'Achats réalisés', value: `${userActivity.purchasesCount}`, icon: ShoppingBag, color: 'text-[#FF6321]' }
  ];

  return (
    <div
      id="activity-modal-overlay"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end"
      onClick={onClose}
    >
      <div
        id="activity-modal-sheet"
        className="w-full max-h-[85vh] bg-[#141414] rounded-t-3xl border-t border-white/15 p-5 flex flex-col shadow-2xl animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#FF6321]" />
            <h2 className="text-sm font-extrabold text-white">Mon Activité</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 text-white/70 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4 no-scrollbar">
          <div className="grid grid-cols-2 gap-3">
            {stats.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-1">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${item.color}`} />
                    <span className="text-[11px] text-white/60">{item.label}</span>
                  </div>
                  <p className="text-base font-black text-white pl-6">{item.value}</p>
                </div>
              );
            })}
          </div>

          <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-1">
            <h3 className="text-xs font-bold text-white">Temps de visionnage vidéo</h3>
            <p className="text-xs text-white/60">
              Total cumulé : <span className="text-[#FF6321] font-bold">{formatSeconds(userActivity.watchTimeSeconds)}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
