import React from 'react';
import { Home, Compass, MessageCircle, ShoppingBag, User } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TabType } from '../../types';

export const BottomNav: React.FC = () => {
  const { 
    activeTab, 
    setActiveTab, 
    cart, 
    unreadMessagesCount, 
    activeConversationId,
    hideBottomNav,
    returnToLiveVoiceAvailable
  } = useApp();

  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const tabs: {
    id: TabType;
    label: string;
    badge?: number;
    renderIcon: (isActive: boolean) => React.ReactNode;
  }[] = [
    {
      id: 'accueil',
      label: 'Accueil',
      renderIcon: (isActive) => (
        <svg
          viewBox="0 0 24 24"
          className={`w-5 h-5 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] transition-all ${
            isActive ? 'text-[#FF6321] fill-[#FF6321]' : 'text-white/60 fill-white/60'
          }`}
        >
          <path d="M12 2.2a1.5 1.5 0 00-.97.35L2.6 9.42a1.2 1.2 0 00-.4.91V20a2 2 0 002 2h5a1 1 0 001-1v-5a1 1 0 011-1h3.6a1 1 0 011 1v5a1 1 0 001 1h4.2a2 2 0 002-2v-9.67a1.2 1.2 0 00-.4-.91l-8.43-6.87A1.5 1.5 0 0012 2.2z" />
          <circle cx="12" cy="7.5" r="1.2" fill="#0A0A0A" />
        </svg>
      ),
    },
    {
      id: 'explorer',
      label: 'Assistant IA',
      renderIcon: (isActive) => (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={`w-5 h-5 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] transition-all ${
            isActive ? 'text-[#FF6321]' : 'text-white/60'
          }`}
        >
          <path d="M22.28 9.87a5.98 5.98 0 00-.51-4.88 6.05 6.05 0 00-6.51-2.9 6.07 6.07 0 00-4.64-2.09 6.07 6.07 0 00-5.77 4.19 6.04 6.04 0 00-4.06 2.94 6.03 6.03 0 00.74 7.07 5.98 5.98 0 00.51 4.88 6.05 6.05 0 006.51 2.9 6.07 6.07 0 004.64 2.09 6.07 6.07 0 005.77-4.19 6.04 6.04 0 004.06-2.94 6.03 6.03 0 00-.74-7.07zm-9.03 12.18a4.57 4.57 0 01-2.94-1.07l.14-.08 4.88-2.82a.76.76 0 00.38-.66v-6.9l2.08 1.2a.08.08 0 01.04.06v5.71a4.6 4.6 0 01-4.58 4.56zm-8.62-4.1a4.56 4.56 0 01-.58-3.09l.15.09 4.88 2.82c.24.14.38.39.38.66v2.39l-2.08-1.2a.08.08 0 01-.04-.06l-2.71-1.61zm-1.5-9.15a4.58 4.58 0 012.36-2.02v5.82a.75.75 0 00.38.65l4.88 2.82-2.08 1.2a.08.08 0 01-.07 0l-4.95-2.86a4.59 4.59 0 01-.52-5.61zm14.54 3.75l-4.88-2.82a.75.75 0 00-.76 0l-4.88 2.82-2.08-1.2a.08.08 0 010-.07l4.95-2.86a4.59 4.59 0 016.94 2.45l.71 1.68zm2.63 4.14l-.15-.09-4.88-2.82a.76.76 0 00-.38-.66v-2.39l2.08 1.2a.08.08 0 01.04.06l2.71 1.61a4.56 4.56 0 01.58 3.09zm-3.01 4.74a4.58 4.58 0 01-2.36 2.02v-5.82a.75.75 0 00-.38-.65l-4.88-2.82 2.08-1.2a.08.08 0 01.07 0l4.95 2.86a4.59 4.59 0 01.52 5.61z" />
        </svg>
      ),
    },
    {
      id: 'achats',
      label: 'Achats',
      badge: cartItemsCount,
      renderIcon: (isActive) => (
        <svg
          viewBox="0 0 24 24"
          className={`w-5 h-5 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] transition-all ${
            isActive ? 'text-[#FF6321] fill-[#FF6321]' : 'text-white/60 fill-white/60'
          }`}
        >
          <path d="M19 6.5h-2.5C16.5 4 14.5 2 12 2S7.5 4 7.5 6.5H5c-1.1 0-2 .9-2 2v11.5c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8.5c0-1.1-.9-2-2-2zM12 3.8c1.5 0 2.7 1.2 2.7 2.7H9.3c0-1.5 1.2-2.7 2.7-2.7z" />
          <circle cx="9.5" cy="9.5" r="1.1" fill="#0A0A0A" />
          <circle cx="14.5" cy="9.5" r="1.1" fill="#0A0A0A" />
        </svg>
      ),
    },
    {
      id: 'discussions',
      label: 'Messages',
      badge: unreadMessagesCount,
      renderIcon: (isActive) => (
        <svg
          viewBox="0 0 24 24"
          className={`w-5 h-5 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] transition-all ${
            isActive ? 'text-[#FF6321] fill-[#FF6321]' : 'text-white/60 fill-white/60'
          }`}
        >
          <path d="M12 2C6.48 2 2 6.03 2 11c0 2.76 1.4 5.23 3.61 6.84-.13.93-.52 2.3-1.63 3.48-.22.24-.07.63.26.65 2.12.14 4.09-.76 5.28-1.57.8.21 1.63.32 2.48.32 5.52 0 10-4.03 10-9s-4.48-9-10-9z" />
          <circle cx="8" cy="11" r="1.2" fill="#0A0A0A" />
          <circle cx="12" cy="11" r="1.2" fill="#0A0A0A" />
          <circle cx="16" cy="11" r="1.2" fill="#0A0A0A" />
        </svg>
      ),
    },
    {
      id: 'profil',
      label: 'Profil',
      renderIcon: (isActive) => (
        <svg
          viewBox="0 0 24 24"
          className={`w-5 h-5 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] transition-all ${
            isActive ? 'text-[#FF6321] fill-[#FF6321]' : 'text-white/60 fill-white/60'
          }`}
        >
          <circle cx="12" cy="7" r="4.2" />
          <path d="M12 13.5c-4.3 0-8 2.2-8 5.2v1.8a1.5 1.5 0 001.5 1.5h13a1.5 1.5 0 001.5-1.5v-1.8c0-3-3.7-5.2-8-5.2z" />
          <circle cx="12" cy="14" r="1" fill="#0A0A0A" />
        </svg>
      ),
    },
  ];

  return (
    <nav
      id="bottom-navigation-bar"
      className={`fixed bottom-0 left-0 right-0 z-50 bg-[#0F0F0F]/95 backdrop-blur-xl border-t border-white/10 px-2 py-1.5 pb-safe items-center justify-around transition-transform duration-300 shadow-[0_-4px_25px_rgba(0,0,0,0.6)] ${
        (activeTab === 'discussions' && activeConversationId) || hideBottomNav || returnToLiveVoiceAvailable
          ? 'translate-y-full opacity-0 pointer-events-none hidden'
          : 'translate-y-0 opacity-100 flex pointer-events-auto'
      }`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            id={`btn-nav-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-200 select-none active:scale-90 ${
              isActive ? 'text-[#FF6321] scale-105' : 'text-white/60 hover:text-white/90'
            }`}
          >
            <div className="relative">
              {tab.renderIcon(isActive)}
              {Boolean(tab.badge && tab.badge > 0) && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#FF6321] text-[10px] font-extrabold text-white flex items-center justify-center shadow-md shadow-[#FF6321]/40 border border-black/40">
                  {tab.badge! > 99 ? '99+' : tab.badge}
                </span>
              )}
            </div>
            <span className={`text-[10px] mt-1 font-medium tracking-tight ${isActive ? 'font-bold' : ''}`}>
              {tab.label}
            </span>
            {isActive && (
              <span className="w-1 h-1 rounded-full bg-[#FF6321] mt-0.5 shadow-sm shadow-[#FF6321]" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
