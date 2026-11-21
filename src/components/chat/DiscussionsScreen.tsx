import React, { useState } from 'react';
import {
  ShieldCheck,
  MessageSquare,
  Store,
  Lock,
  PhoneCall,
  Plus
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Conversation } from '../../types';
import { ConversationList, FilterTabType } from './ConversationList';
import { ChatView } from './ChatView';
import { NewConversationModal } from './NewConversationModal';
import { VoipCallModal } from './VoipCallModal';

export const DiscussionsScreen: React.FC = () => {
  const {
    conversations,
    messages,
    activeConversationId,
    setActiveConversationId,
    sendMessage,
    startCall,
    receiveIncomingCall,
    activeCall,
    markConversationAsRead,
    sellers,
    products,
    orders,
    showToast,
    openChatWithSeller,
    setSelectedProduct,
    setActiveTab,
    openSupportChat,
    isAuthenticated,
    openAuthModal
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTabType>('all');
  const [isNewConvModalOpen, setIsNewConvModalOpen] = useState(false);

  if (!isAuthenticated) {
    return (
      <div
        id="discussions-main-screen"
        className="with-bottom-nav relative w-full h-full flex flex-col bg-[#0A0A0A] text-white overflow-y-auto no-scrollbar"
      >
        <div className="sticky top-0 z-20 bg-[#0A0A0A]/85 backdrop-blur-xl p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#FF6321]" />
            <h1 className="text-base font-bold text-white">Messages</h1>
          </div>
          <span className="text-[11px] text-[#FF854D] font-semibold bg-orange-500/10 px-2.5 py-1 rounded-full border border-[#FF6321]/30">
            Mode visiteur
          </span>
        </div>

        <div className="flex-1 flex items-center justify-center p-5">
          <div
            id="visitor-discussions-gate"
            className="w-full max-w-sm rounded-3xl bg-[#121216] border border-white/15 p-6 text-center space-y-5 shadow-2xl"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#FF6321]/15 border border-[#FF6321]/30 flex items-center justify-center mx-auto shadow-lg shadow-orange-600/15">
              <MessageSquare className="w-8 h-8 text-[#FF6321]" />
            </div>

            <div className="space-y-2">
              <span className="inline-block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-[#FF854D]">
                Messagerie directe DJASSA
              </span>
              <h2 className="text-lg font-black text-white leading-snug">
                Discutez avec les vendeurs d’Adjamé
              </h2>
              <p className="text-xs text-white/70 leading-relaxed">
                Connectez-vous ou créez un compte DJASSA pour envoyer des messages aux boutiques,
                poser vos questions sur les tailles et suivre vos échanges.
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                id="btn-messages-visitor-register"
                onClick={() =>
                  openAuthModal('messages', {
                    initialMode: 'register',
                    directToAuthForm: true,
                    pendingAction: { type: 'open_messages' }
                  })
                }
                className="w-full py-3.5 px-4 rounded-2xl bg-[#FF6321] hover:bg-[#ff7538] text-white font-extrabold text-sm shadow-xl shadow-orange-600/30 transition cursor-pointer"
              >
                Créer un compte
              </button>

              <button
                type="button"
                id="btn-messages-visitor-login"
                onClick={() =>
                  openAuthModal('messages', {
                    initialMode: 'login',
                    directToAuthForm: true,
                    pendingAction: { type: 'open_messages' }
                  })
                }
                className="w-full py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs transition cursor-pointer"
              >
                Se connecter
              </button>

              <button
                type="button"
                id="btn-messages-visitor-explore"
                onClick={() => setActiveTab('accueil')}
                className="w-full py-2.5 px-4 rounded-2xl text-white/65 hover:text-white text-xs font-semibold transition cursor-pointer"
              >
                Continuer à explorer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const activeMessages = activeConversation ? messages[activeConversation.id] || [] : [];

  const handleSelectConversation = (conv: Conversation) => {
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    setActiveConversationId(conv.id);
    markConversationAsRead(conv.id);
  };

  const handleBackFromChat = () => {
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    setActiveConversationId(null);
  };

  const handleOpenSupport = () => {
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    void openSupportChat();
  };

  const handleOpenReturnExchange = () => {
    const sellerConv =
      conversations.find(
        (c) =>
          c.participantType === 'seller' &&
          (c.relatedOrderId || c.id === 'conv-seller-2' || c.id === 'conv-seller-1')
      ) ||
      conversations.find((c) => c.participantType === 'seller') ||
      conversations[0];

    if (sellerConv) {
      handleSelectConversation(sellerConv);
      showToast('Espace discussion & SAV vendeur ouvert');
    }
  };

  return (
    <div
      id="discussions-main-screen"
      className="relative w-full h-full flex flex-col bg-[#0A0A0A] overflow-hidden"
    >
      {activeCall?.isMinimized && <VoipCallModal />}

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* LEFT COLUMN: CONVERSATION LIST */}
        <div
          className={`h-full w-full md:w-80 lg:w-96 shrink-0 ${
            activeConversation ? 'hidden md:flex' : 'flex'
          }`}
        >
          <ConversationList
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            onOpenNewConversation={() => setIsNewConvModalOpen(true)}
            onOpenReturnExchange={handleOpenReturnExchange}
            onOpenSupport={handleOpenSupport}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filterTab={filterTab}
            setFilterTab={setFilterTab}
          />
        </div>

        {/* RIGHT COLUMN: ACTIVE CHAT OR EMPTY STATE */}
        <div
          className={`flex-1 h-full min-w-0 ${
            !activeConversation ? 'hidden md:flex' : 'flex'
          }`}
        >
          {activeConversation ? (
            <ChatView
              conversation={activeConversation}
              messages={activeMessages}
              onBack={handleBackFromChat}
              onSendMessage={(content, type, meta) =>
                sendMessage(activeConversation.id, content, type, meta)
              }
              onStartCall={() =>
                startCall(
                  activeConversation.participantId,
                  activeConversation.participantType === 'client' ? 'client' : 'seller'
                )
              }
              products={products}
              orders={orders}
              onOpenProduct={(p) => {
                setSelectedProduct(p);
                setActiveTab('explorer');
              }}
              showToast={showToast}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 lg:p-8 text-center bg-[#0C0C0C] relative overflow-y-auto no-scrollbar">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#FF6321]/5 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-lg space-y-5">
                <div className="w-16 h-16 rounded-3xl bg-[#FF6321]/15 text-[#FF6321] flex items-center justify-center mx-auto border border-[#FF6321]/20 shadow-xl shadow-[#FF6321]/10">
                  <MessageSquare className="w-8 h-8" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-lg font-black text-white">
                    Messagerie & Gestion Commandes Djassa
                  </h3>
                  <p className="text-xs text-white/60 leading-relaxed max-w-md mx-auto">
                    Échangez directement avec les boutiques vendeuses pour organiser la remise de
                    vos colis, poser vos questions produits ou contacter le Service Client Djassa.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                  <div
                    onClick={handleOpenReturnExchange}
                    className="p-3.5 rounded-2xl bg-white/5 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/30 transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400 group-hover:scale-110 transition">
                        <Store className="w-4 h-4" />
                      </span>
                      <h4 className="text-xs font-black text-white">Boutiques & Vendeurs</h4>
                    </div>
                    <p className="text-[10.5px] text-white/55 leading-snug">
                      Organisez la livraison avec le vendeur, demandez des précisions article ou
                      gérez un échange.
                    </p>
                  </div>

                  <div
                    onClick={handleOpenSupport}
                    className="p-3.5 rounded-2xl bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 group-hover:scale-110 transition">
                        <ShieldCheck className="w-4 h-4" />
                      </span>
                      <h4 className="text-xs font-black text-white">Support & Médiation</h4>
                    </div>
                    <p className="text-[10.5px] text-white/55 leading-snug">
                      Assistance sur vos commandes confirmées, paiements Wave / Orange Money et
                      réclamations.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    onClick={() => setIsNewConvModalOpen(true)}
                    className="flex-1 py-2.5 px-4 rounded-2xl bg-[#FF6321] hover:bg-[#ff753b] text-white text-xs font-black shadow-xl shadow-[#FF6321]/25 transition active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nouvelle discussion</span>
                  </button>

                  <button
                    onClick={handleOpenSupport}
                    className="flex-1 py-2.5 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/80 text-xs font-bold border border-white/10 transition flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Service Client 24/7</span>
                  </button>

                  <button
                    onClick={() => receiveIncomingCall(undefined, 'seller')}
                    className="py-2.5 px-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/20 transition flex items-center justify-center gap-1.5 active:scale-95 shrink-0"
                    title="Simuler un appel entrant d'un vendeur sur la page discussion"
                  >
                    <PhoneCall className="w-3.5 h-3.5 animate-pulse" />
                    <span>Test Appel</span>
                  </button>
                </div>

                <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-white/40">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Paiements Wave & Orange Money sécurisés Djassa</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {activeCall && !activeCall.isMinimized && <VoipCallModal />}

      <NewConversationModal
        isOpen={isNewConvModalOpen}
        onClose={() => setIsNewConvModalOpen(false)}
        sellers={sellers}
        onSelectSeller={(sellerId) => {
          openChatWithSeller(sellerId);
          setIsNewConvModalOpen(false);
        }}
        onSelectSupport={handleOpenSupport}
      />
    </div>
  );
};
