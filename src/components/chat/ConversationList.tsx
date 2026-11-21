import React from 'react';
import {
  Search,
  Store,
  RotateCcw,
  ShieldCheck,
  Mic,
  Camera,
  X,
  MessageSquare,
  Headphones
} from 'lucide-react';
import { Conversation } from '../../types';

export type FilterTabType = 'all' | 'sellers' | 'claims' | 'unread';

interface Props {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (conv: Conversation) => void;
  onOpenNewConversation?: () => void;
  onReportProblem?: () => void;
  onOpenClaim?: () => void;
  onOpenReturnExchange?: () => void;
  onOpenSupport?: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterTab: FilterTabType;
  setFilterTab: (tab: FilterTabType) => void;
}

export const ConversationList: React.FC<Props> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onOpenSupport,
  searchQuery,
  setSearchQuery,
  filterTab,
  setFilterTab
}) => {
  const isClaimOrIncident = (c: Conversation) => {
    const text = `${c.participantName} ${c.lastMessage} ${c.participantRoleSubtitle || ''} ${c.id}`.toLowerCase();
    return (
      text.includes('échange') ||
      text.includes('echange') ||
      text.includes('retour') ||
      text.includes('remboursement') ||
      text.includes('panne') ||
      text.includes('endommagé') ||
      text.includes('endommage') ||
      text.includes('incident') ||
      text.includes('réclamation') ||
      text.includes('reclamation') ||
      text.includes('problème') ||
      text.includes('plainte')
    );
  };

  const visibleConversations = conversations.filter(
    (c) =>
      c &&
      c.id &&
      (c.participantType as string) !== 'driver' &&
      (c.participantType as string) !== 'company'
  );

  const unreadTotal = visibleConversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
  const sellersCount = visibleConversations.filter((c) => c.participantType === 'seller').length;
  const claimsCount = visibleConversations.filter(isClaimOrIncident).length;

  const seenFilteredIds = new Set<string>();
  const filtered = visibleConversations.filter((c) => {
    if (seenFilteredIds.has(c.id)) return false;

    if (filterTab === 'sellers' && c.participantType !== 'seller') return false;
    if (filterTab === 'claims' && !isClaimOrIncident(c)) return false;
    if (filterTab === 'unread' && (!c.unreadCount || c.unreadCount <= 0)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        c.participantName.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q) ||
        (c.participantRoleSubtitle && c.participantRoleSubtitle.toLowerCase().includes(q));
      if (!match) return false;
    }

    seenFilteredIds.add(c.id);
    return true;
  });

  return (
    <div id="conversation-list-panel" className="w-full h-full flex flex-col bg-[#0F0F0F] border-r border-white/10">
      {/* Header */}
      <div className="pt-3 px-4 pb-3 border-b border-white/10 bg-[#0F0F0F] space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
              Discussions
            </h1>
            {unreadTotal > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#FF6321] text-white shadow-md shadow-[#FF6321]/30 shrink-0">
                {unreadTotal} non lu{unreadTotal > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {onOpenSupport && (
            <button
              id="btn-open-customer-service"
              type="button"
              onClick={onOpenSupport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#FF6321] to-[#ff7e47] hover:from-[#ff753b] hover:to-[#ff8d5c] text-white text-xs font-black shadow-md shadow-[#FF6321]/25 border border-[#FF6321]/40 transition active:scale-95 shrink-0 group"
              title="Parler avec le Service Client Djassa"
            >
              <Headphones className="w-3.5 h-3.5 group-hover:scale-110 transition shrink-0" />
              <span>Service Client</span>
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/50 filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
          <input
            id="input-search-conversations"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher vendeur, boutique ou message..."
            className="w-full pl-9 pr-8 py-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-[#FF6321] shadow-inner transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {[
            { id: 'all', label: 'Tous', count: visibleConversations.length },
            { id: 'sellers', label: 'Vendeurs', icon: Store, count: sellersCount },
            { id: 'claims', label: 'Retours & SAV', icon: RotateCcw, count: claimsCount, highlight: claimsCount > 0 },
            { id: 'unread', label: 'Non lus', count: unreadTotal, highlight: unreadTotal > 0 }
          ].map((tab) => {
            const isActive = filterTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                id={`filter-tab-${tab.id}`}
                onClick={() => setFilterTab(tab.id as FilterTabType)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold shrink-0 transition-all flex items-center gap-1.5 active:scale-95 backdrop-blur-md ${
                  isActive
                    ? 'bg-[#FF6321] text-white shadow-md shadow-[#FF6321]/40'
                    : 'bg-black/50 text-white/70 hover:text-white border border-white/10'
                }`}
              >
                {Icon ? (
                  <Icon className="w-3.5 h-3.5 filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                ) : (
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                    <path d="M12 2C6.48 2 2 6.03 2 11c0 2.76 1.4 5.23 3.61 6.84-.13.93-.52 2.3-1.63 3.48-.22.24-.07.63.26.65 2.12.14 4.09-.76 5.28-1.57.8.21 1.63.32 2.48.32 5.52 0 10-4.03 10-9s-4.48-9-10-9z" />
                  </svg>
                )}
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                      isActive
                        ? 'bg-black/40 text-white'
                        : tab.highlight
                        ? 'bg-[#FF6321] text-white'
                        : 'bg-white/15 text-white/80'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/5 no-scrollbar pb-24">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-xs space-y-3">
            <MessageSquare className="w-8 h-8 mx-auto text-white/20" />
            <p className="font-medium text-white/60">Aucune discussion trouvée.</p>
            <p className="text-[10px] text-white/40">
              {searchQuery
                ? 'Essayez un autre mot-clé'
                : 'Vos échanges avec les vendeurs et le support Djassa apparaîtront ici.'}
            </p>
          </div>
        ) : (
          filtered.map((conv) => {
            const isSelected = conv.id === activeConversationId;
            const isSupport = conv.id.includes('support') || conv.participantId === 'support-djassa';
            const isSeller = conv.participantType === 'seller';

            const isAudio = conv.lastMessage.toLowerCase().includes('note vocale');
            const isPhoto = conv.lastMessage.toLowerCase().includes('photo');

            return (
              <div
                key={conv.id}
                id={`conversation-item-${conv.id}`}
                onClick={() => onSelectConversation(conv)}
                className={`p-3.5 flex items-center gap-3 cursor-pointer transition border-l-4 ${
                  isSelected
                    ? 'bg-white/10 border-l-[#FF6321]'
                    : 'border-l-transparent hover:bg-white/5'
                }`}
              >
                <div className="relative shrink-0">
                  <img
                    src={conv.participantAvatar}
                    alt={conv.participantName}
                    className="w-12 h-12 rounded-2xl object-cover border border-white/10"
                  />
                  {conv.isOnline && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0F0F0F] shadow" />
                  )}
                  <div
                    className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] border border-[#0F0F0F] ${
                      isSupport
                        ? 'bg-emerald-500 text-black'
                        : isSeller
                        ? 'bg-[#FF6321] text-white'
                        : 'bg-purple-500 text-white'
                    }`}
                  >
                    {isSupport ? '🛡️' : isSeller ? '🏪' : '👤'}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-bold text-white truncate">
                        {conv.participantName}
                      </span>
                      {conv.participantVerified && (
                        <ShieldCheck className="w-3.5 h-3.5 text-[#FF6321] shrink-0" />
                      )}
                    </div>
                    <span className="text-[10px] text-white/40 whitespace-nowrap shrink-0">
                      {conv.lastMessageTime}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-white/60 truncate mt-1">
                    {isAudio ? (
                      <span className="flex items-center gap-1 text-[#FF6321] font-medium">
                        <Mic className="w-3 h-3" />
                        <span>{conv.lastMessage}</span>
                      </span>
                    ) : isPhoto ? (
                      <span className="flex items-center gap-1 text-cyan-400 font-medium">
                        <Camera className="w-3 h-3" />
                        <span>{conv.lastMessage}</span>
                      </span>
                    ) : (
                      <span className="truncate">{conv.lastMessage}</span>
                    )}
                  </div>
                </div>

                {conv.unreadCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-[#FF6321] text-white font-extrabold text-[10px] flex items-center justify-center shrink-0 shadow-md shadow-[#FF6321]/30">
                    {conv.unreadCount}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
