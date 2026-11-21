import React, { useState } from 'react';
import { X, Settings, HelpCircle, LogOut, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const {
    userProfile,
    updateProfileDetails,
    showToast,
    signOut,
    clientPreferences,
    updateClientPreferences,
    activeUserSessions,
    openSupportChat,
    navigateToDiscussions
  } = useApp();

  const notifications = clientPreferences.notifications;
  const currentSession = activeUserSessions.find((s) => s.isCurrent) || activeUserSessions[0];
  const deviceLabel = currentSession
    ? `${currentSession.device} (${currentSession.browser})`
    : typeof navigator !== 'undefined'
    ? `${navigator.platform || 'Navigateur'} • Session active`
    : 'Session active';

  const [editingAddress, setEditingAddress] = useState(false);
  const [editCommune, setEditCommune] = useState(userProfile.deliveryCommune || '');
  const [editAddress, setEditAddress] = useState(userProfile.address || userProfile.deliveryQuartier || '');
  const [openingSupport, setOpeningSupport] = useState(false);

  const handleDisconnect = () => {
    onClose();
    signOut();
  };

  return (
    <div
      id="settings-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex justify-center items-end sm:items-center animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="settings-container"
        className="bg-[#121212]/95 border-t sm:border border-white/15 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[88vh] flex flex-col shadow-2xl overflow-hidden backdrop-blur-2xl animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-black/40 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#FF6321]" />
            <h3 className="text-sm font-bold text-white">
              Paramètres & Préférences
            </h3>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-1 rounded-full text-white/50 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5 no-scrollbar text-xs">
          {/* 1. NOTIFICATIONS */}
          <div className="space-y-2">
            <h4 className="font-bold text-white/50 uppercase tracking-wider">
              Notifications & Alertes
            </h4>
            <div className="bg-white/5 rounded-2xl divide-y divide-white/10 border border-white/10 backdrop-blur-md">
              <label className="flex items-center justify-between p-3 cursor-pointer">
                <div>
                  <p className="font-bold text-white">Suivi des commandes & livraisons</p>
                  <p className="text-[10px] text-white/50">Notifications de statut en temps réel</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.orderUpdates}
                  onChange={(e) =>
                    void updateClientPreferences({
                      notifications: { ...notifications, orderUpdates: e.target.checked }
                    })
                  }
                  className="accent-[#FF6321] w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-3 cursor-pointer">
                <div>
                  <p className="font-bold text-white">Messages & appels vendeurs</p>
                  <p className="text-[10px] text-white/50">Alertes discussions d'Adjamé</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.messages}
                  onChange={(e) =>
                    void updateClientPreferences({
                      notifications: { ...notifications, messages: e.target.checked }
                    })
                  }
                  className="accent-[#FF6321] w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-3 cursor-pointer">
                <div>
                  <p className="font-bold text-white">Bons plans & réductions flash</p>
                  <p className="text-[10px] text-white/50">Offres personnalisées</p>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.promotions}
                  onChange={(e) =>
                    void updateClientPreferences({
                      notifications: { ...notifications, promotions: e.target.checked }
                    })
                  }
                  className="accent-[#FF6321] w-4 h-4"
                />
              </label>
            </div>
          </div>

          {/* 2. ADRESSE PAR DÉFAUT */}
          <div className="space-y-2">
            <h4 className="font-bold text-white/50 uppercase tracking-wider">
              Adresse de livraison par défaut
            </h4>
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-white">{userProfile.deliveryCommune || 'Abidjan'}, Côte d’Ivoire</p>
                  <p className="text-[10px] text-white/50 truncate">
                    {userProfile.address || userProfile.deliveryQuartier || 'Aucune adresse enregistrée'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingAddress((v) => !v)}
                  className="text-[#FF6321] text-xs font-semibold shrink-0"
                >
                  {editingAddress ? 'Fermer' : 'Modifier'}
                </button>
              </div>
              {editingAddress && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <input
                    value={editCommune}
                    onChange={(e) => setEditCommune(e.target.value)}
                    placeholder="Commune"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-[#FF6321]"
                  />
                  <input
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    placeholder="Quartier / adresse précise"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-[#FF6321]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      updateProfileDetails(
                        userProfile.name,
                        userProfile.bio,
                        userProfile.phone,
                        editCommune.trim(),
                        editAddress.trim(),
                        userProfile.deliveryAddressDetails || ''
                      );
                      setEditingAddress(false);
                      showToast('Adresse par défaut mise à jour.');
                    }}
                    className="w-full py-2.5 rounded-xl bg-[#FF6321] text-white font-black"
                  >
                    Enregistrer l'adresse
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 3. SÉCURITÉ & APPAREILS */}
          <div className="space-y-2">
            <h4 className="font-bold text-white/50 uppercase tracking-wider">
              Appareils & Sessions
            </h4>
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 space-y-2 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">{deviceLabel}</p>
                  <p className="text-[10px] text-emerald-400 font-semibold">
                    {currentSession?.location || 'Abidjan, CI'} • Session active
                  </p>
                </div>
                <span className="text-[10px] text-white/40">En ligne</span>
              </div>
            </div>
          </div>

          {/* 4. AIDE ET SUPPORT */}
          <div className="space-y-2">
            <h4 className="font-bold text-white/50 uppercase tracking-wider">
              Assistance & Légal
            </h4>
            <div className="bg-white/5 rounded-2xl divide-y divide-white/10 border border-white/10 backdrop-blur-md">
              <button
                type="button"
                disabled={openingSupport}
                onClick={async () => {
                  setOpeningSupport(true);
                  try {
                    await openSupportChat('Assistance acheteur DJASSA');
                    onClose();
                    navigateToDiscussions();
                  } finally {
                    setOpeningSupport(false);
                  }
                }}
                className="w-full flex items-center justify-between p-3 hover:bg-white/5 text-left"
              >
                <span className="font-medium text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-[#FF6321]" />
                  {openingSupport ? 'Ouverture de la messagerie...' : 'Contacter l\'assistance acheteur'}
                </span>
                <ChevronRight className="w-4 h-4 text-white/40" />
              </button>
              <div className="flex items-center justify-between p-3 text-white/40 text-[11px]">
                <span>Version de l'application</span>
                <span>DJASSA Web v2.4.0</span>
              </div>
            </div>
          </div>

          {/* DISCONNECT */}
          <button
            onClick={handleDisconnect}
            className="w-full py-3 rounded-2xl bg-white/5 hover:bg-rose-950/40 text-rose-400 font-bold flex items-center justify-center gap-2 border border-rose-900/30 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Fermer la session</span>
          </button>
        </div>
      </div>
    </div>
  );
};
