import React from 'react';
import { LayoutDashboard, Users, Megaphone, Flame, MessageSquare, User } from 'lucide-react';
import { AdminTabType } from '../../types';
import { useApp } from '../../context/AppContext';

interface AdminNavProps {
  activeTab: AdminTabType;
  onChangeTab: (tab: AdminTabType) => void;
  pendingKycCount?: number;
  activeOrdersCount?: number;
  activeBoostsCount?: number;
}

export const AdminNav: React.FC<AdminNavProps> = ({ activeTab, onChangeTab, pendingKycCount = 0, activeBoostsCount = 0 }) => {
  const { activeConversationId } = useApp();

  if (activeTab === 'discussions' && activeConversationId) {
    return null;
  }

  const tabs = [
    { id: 'dashboard' as AdminTabType, label: 'Accueil', icon: LayoutDashboard, badge: null },
    { id: 'utilisateurs' as AdminTabType, label: 'Utilisateurs', icon: Users, badge: pendingKycCount || null },
    { id: 'discussions' as AdminTabType, label: 'Discussions', icon: MessageSquare, badge: null },
    { id: 'tendances' as AdminTabType, label: 'Tendances', icon: Flame, badge: null },
    { id: 'profil' as AdminTabType, label: 'Profil', icon: User, badge: null },
  ];

  return (
    <nav id="djassa-admin-bottom-nav" className="shrink-0 h-[68px] bg-[#0E0E0E]/95 backdrop-blur-xl border-t border-purple-500/20 px-2 flex items-center justify-around z-40 select-none">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        return (
          <button key={tab.id} id={`admin-nav-${tab.id}`} type="button" onClick={() => onChangeTab(tab.id)}
            className={`relative flex-1 max-w-[150px] h-full flex flex-col items-center justify-center gap-1 transition-all ${active ? 'text-purple-400' : 'text-white/40 hover:text-white/80'}`}>
            {active && <span className="absolute top-0 w-10 h-1 rounded-b-full bg-purple-500 shadow-[0_0_12px_rgba(168,85,247,.8)]" />}
            <span className="relative">
              <Icon className={`w-5 h-5 ${active ? 'scale-110' : ''}`} />
              {tab.badge && <span className="absolute -top-2 -right-3 min-w-4 h-4 px-1 rounded-full bg-[#FF6321] text-white text-[8px] font-black flex items-center justify-center">{tab.badge}</span>}
            </span>
            <span className="text-[10px] font-bold">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
