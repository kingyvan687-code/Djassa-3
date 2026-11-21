import React, { useState } from 'react';
import {
  ChevronLeft,
  Users,
  Check,
  Plus,
  Shield,
  Store,
  X,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';

interface SwitchAccountSettingsScreenProps {
  onBack: () => void;
  onCloseSettings: () => void;
}

export const SwitchAccountSettingsScreen: React.FC<SwitchAccountSettingsScreenProps> = ({
  onBack,
  onCloseSettings
}) => {
  const { signIn, showToast, accountRole, userProfile } = useApp();

  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDev = import.meta.env.DEV;

  const devQuickAccounts = isDev
    ? [
        {
          name: 'Amina Kouamé',
          role: 'Client Acheteur',
          roleKey: 'client',
          email: 'client@djassa.ci',
          avatar: userProfile.avatar || '',
          icon: Users
        },
        {
          name: 'Boutique Wax & Élégance',
          role: 'Marchand Vendeur Adjamé',
          roleKey: 'seller',
          email: 'vendeur@djassa.ci',
          avatar: '',
          icon: Store
        },
        {
          name: 'Régulateur Central',
          role: 'Administrateur Marché',
          roleKey: 'admin',
          email: 'admin@djassa.ci',
          avatar: '',
          icon: Shield
        }
      ]
    : [];

  const handleOpenManualLogin = (prefillEmail = '') => {
    setNewEmail(prefillEmail);
    setNewPassword('');
    setIsAddAccountOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newPassword.trim()) {
      showToast('Veuillez renseigner un e-mail et un mot de passe.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await signIn(newEmail.trim(), newPassword.trim());
      if (res.success) {
        showToast('Connecté avec succès');
        setIsAddAccountOpen(false);
        onCloseSettings();
      } else {
        showToast(res.message || 'Identifiants incorrects.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="switch-account-settings-screen"
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
            Changer de compte
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4 pb-16">
        {/* CURRENT SESSION CARD */}
        <div className="p-4 rounded-3xl bg-[#121212] border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            {userProfile.avatar ? (
              <img
                src={userProfile.avatar}
                alt={userProfile.name}
                className="w-12 h-12 rounded-full object-cover border border-white/10"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white/70">
                <Users className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white">{userProfile.name}</p>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#FF6321]/20 text-[#FF6321] font-bold">
                  Actif
                </span>
              </div>
              <p className="text-xs text-white/50">@{userProfile.username}</p>
              {userProfile.email && (
                <p className="text-[10px] text-white/30">{userProfile.email}</p>
              )}
            </div>
          </div>
          <div className="w-7 h-7 rounded-full bg-[#FF6321] flex items-center justify-center text-white shadow">
            <Check className="w-4 h-4" />
          </div>
        </div>

        {isDev && devQuickAccounts.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-wider px-1">
              Comptes de test (Environnement de développement)
            </p>
            <div className="bg-[#121212] border border-white/5 rounded-3xl divide-y divide-white/5 overflow-hidden">
              {devQuickAccounts.map((acc) => {
                const isCurrent = accountRole === acc.roleKey;
                const Icon = acc.icon;
                return (
                  <button
                    key={acc.email}
                    onClick={() => handleOpenManualLogin(acc.email)}
                    className={`w-full p-4 flex items-center justify-between text-left transition ${
                      isCurrent ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-[#FF6321] border border-white/10">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{acc.name}</p>
                        <p className="text-xs text-white/50">{acc.role}</p>
                        <p className="text-[10px] text-white/30">{acc.email}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ADD ACCOUNT BUTTON */}
        <button
          onClick={() => handleOpenManualLogin('')}
          className="w-full p-4 rounded-3xl bg-[#121212] border border-dashed border-white/20 hover:border-[#FF6321] flex items-center justify-center gap-2 text-xs font-bold text-white transition active:scale-98"
        >
          <Plus className="w-4 h-4 text-[#FF6321]" />
          Se connecter à un autre compte
        </button>
      </main>

      {/* MODAL: CONNEXION */}
      {isAddAccountOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
          onClick={() => setIsAddAccountOpen(false)}
        >
          <div
            className="w-full max-w-sm mx-auto bg-[#181818] rounded-3xl border border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Connexion à un autre compte</h3>
              <button onClick={() => setIsAddAccountOpen(false)} className="p-1 text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-white/50 block mb-1">E-mail ou identifiant</label>
                <input
                  type="text"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="nom@djassa.ci"
                  className="w-full bg-[#121212] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-[#FF6321]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-white/50 block mb-1">Mot de passe</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#121212] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-[#FF6321]"
                />
              </div>

              <div className="flex gap-2 pt-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setIsAddAccountOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6321] hover:bg-[#E05316] disabled:opacity-50 text-white transition shadow"
                >
                  {isSubmitting ? 'Connexion...' : 'Se connecter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
