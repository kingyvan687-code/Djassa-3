import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  MessageCircle,
  AtSign,
  Heart,
  Users,
  ShieldAlert,
  Check,
  X
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import type { ClientPreferencesDTO } from '../../../services/clientService';

interface PrivacySettingsScreenProps {
  onBack: () => void;
}

type PermissionScope = ClientPreferencesDTO['privacy']['allowComments'];

export const PrivacySettingsScreen: React.FC<PrivacySettingsScreenProps> = ({ onBack }) => {
  const { showToast, clientPreferences, updateClientPreferences, sellers } = useApp();

  const privacy = clientPreferences.privacy;
  const isPrivateAccount = privacy.privateAccount;
  const showActivityStatus = privacy.showActivityStatus;
  const personalizedAds = privacy.personalizedAds;
  const commentPermission = privacy.allowComments;
  const tagPermission = privacy.allowMentions;
  const directMessages = privacy.allowMessages;
  const blockedSellerIds = privacy.blockedSellerIds || [];

  const [likedVideosVisibility, setLikedVideosVisibility] = useState<'only_me' | 'everyone'>('only_me');
  const [followingListVisibility, setFollowingListVisibility] = useState<'everyone' | 'only_me'>('everyone');

  const [activeSubModal, setActiveSubModal] = useState<
    null | 'comments' | 'tags' | 'dms' | 'liked_videos' | 'following' | 'blocked_users'
  >(null);

  const updatePrivacy = async (patch: Partial<ClientPreferencesDTO['privacy']>, message?: string) => {
    await updateClientPreferences({
      privacy: {
        ...privacy,
        ...patch
      }
    });
    if (message) showToast(message);
  };

  const formatScopeLabel = (scope: PermissionScope) => {
    if (scope === 'friends') return 'Boutiques suivies';
    if (scope === 'no_one') return 'Personne';
    return 'Tout le monde';
  };

  const handleUnblock = async (sellerId: string, sellerName: string) => {
    await updatePrivacy(
      { blockedSellerIds: blockedSellerIds.filter((id) => id !== sellerId) },
      `${sellerName} a été débloqué`
    );
  };

  return (
    <div
      id="privacy-settings-screen"
      className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
    >
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
            Confidentialité
          </h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar pb-16">
        <section className="mt-4">
          <div className="px-4 py-1.5 text-[11px] font-bold text-white/40 tracking-wider">
            VISIBILITÉ DU COMPTE
          </div>
          <div className="bg-[#121212] border-t border-b border-white/5 divide-y divide-white/5">
            <div className="px-4 py-3.5 flex items-center justify-between">
              <div className="max-w-[80%] space-y-0.5">
                <span className="text-sm font-semibold text-white block">Compte privé</span>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Avec un compte privé, seules les personnes que vous approuvez peuvent voir votre profil public et vos interactions.
                </p>
              </div>
              <input
                type="checkbox"
                aria-label="Compte privé"
                checked={isPrivateAccount}
                onChange={(e) => {
                  const checked = e.target.checked;
                  void updatePrivacy(
                    { privateAccount: checked },
                    checked ? 'Compte privé activé' : 'Compte public réactivé'
                  );
                }}
                className="accent-[#FF6321] w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="px-4 py-3.5 flex items-center justify-between">
              <div className="max-w-[80%] space-y-0.5">
                <span className="text-sm font-semibold text-white block">Statut d'activité</span>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Permet aux vendeurs et coursiers d'Adjamé de voir quand vous êtes en ligne pour préparer votre commande.
                </p>
              </div>
              <input
                type="checkbox"
                aria-label="Statut d'activité"
                checked={showActivityStatus}
                onChange={(e) => {
                  const checked = e.target.checked;
                  void updatePrivacy(
                    { showActivityStatus: checked },
                    checked ? 'Statut en ligne activé' : 'Statut en ligne masqué'
                  );
                }}
                className="accent-[#FF6321] w-4 h-4 cursor-pointer"
              />
            </div>

            <div className="px-4 py-3.5 flex items-center justify-between">
              <div className="max-w-[80%] space-y-0.5">
                <span className="text-sm font-semibold text-white block">Offres personnalisées</span>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Adapter les promotions et suggestions de boutiques selon vos centres d'intérêt sur Djassa.
                </p>
              </div>
              <input
                type="checkbox"
                aria-label="Offres personnalisées"
                checked={personalizedAds}
                onChange={(e) => {
                  const checked = e.target.checked;
                  void updatePrivacy(
                    { personalizedAds: checked },
                    checked ? 'Offres personnalisées activées' : 'Offres génériques activées'
                  );
                }}
                className="accent-[#FF6321] w-4 h-4 cursor-pointer"
              />
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="px-4 py-1.5 text-[11px] font-bold text-white/40 tracking-wider">
            INTERACTIONS & PERMISSIONS
          </div>
          <div className="bg-[#121212] border-t border-b border-white/5 divide-y divide-white/5">
            <button
              onClick={() => setActiveSubModal('comments')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] transition"
            >
              <div className="flex items-center gap-3">
                <MessageCircle className="w-4 h-4 text-white/70" />
                <span className="text-sm font-semibold text-white">Commentaires</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50">{formatScopeLabel(commentPermission)}</span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
            </button>

            <button
              onClick={() => setActiveSubModal('tags')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] transition"
            >
              <div className="flex items-center gap-3">
                <AtSign className="w-4 h-4 text-white/70" />
                <span className="text-sm font-semibold text-white">Mentions et tags</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50">{formatScopeLabel(tagPermission)}</span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
            </button>

            <button
              onClick={() => setActiveSubModal('dms')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] transition"
            >
              <div className="flex items-center gap-3">
                <Lock className="w-4 h-4 text-white/70" />
                <span className="text-sm font-semibold text-white">Messages directs</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50">{formatScopeLabel(directMessages)}</span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
            </button>

            <button
              onClick={() => setActiveSubModal('liked_videos')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] transition"
            >
              <div className="flex items-center gap-3">
                <Heart className="w-4 h-4 text-white/70" />
                <span className="text-sm font-semibold text-white">Vidéos aimées</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50">
                  {likedVideosVisibility === 'only_me' ? 'Moi uniquement' : 'Tout le monde'}
                </span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
            </button>

            <button
              onClick={() => setActiveSubModal('following')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] transition"
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-white/70" />
                <span className="text-sm font-semibold text-white">Liste des abonnements</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50">
                  {followingListVisibility === 'everyone' ? 'Tout le monde' : 'Moi uniquement'}
                </span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
            </button>
          </div>
        </section>

        <section className="mt-6">
          <div className="px-4 py-1.5 text-[11px] font-bold text-white/40 tracking-wider">
            SÉCURITÉ & BLOCAGE
          </div>
          <div className="bg-[#121212] border-t border-b border-white/5 divide-y divide-white/5">
            <button
              onClick={() => setActiveSubModal('blocked_users')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] transition"
            >
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-4 h-4 text-white/70" />
                <span className="text-sm font-semibold text-white">Comptes bloqués</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50">{blockedSellerIds.length}</span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
            </button>
          </div>
        </section>
      </main>

      {(activeSubModal === 'comments' || activeSubModal === 'tags' || activeSubModal === 'dms') && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
          onClick={() => setActiveSubModal(null)}
        >
          <div
            className="w-full max-w-sm mx-auto bg-[#181818] rounded-3xl border border-white/10 p-5 space-y-3 shadow-2xl animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">
                {activeSubModal === 'comments'
                  ? 'Qui peut commenter ?'
                  : activeSubModal === 'tags'
                  ? 'Qui peut vous mentionner ?'
                  : 'Qui peut vous envoyer des messages ?'}
              </h3>
              <button onClick={() => setActiveSubModal(null)} className="p-1 text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            {(
              [
                { id: 'everyone', label: 'Tout le monde' },
                { id: 'friends', label: 'Boutiques & vendeurs suivis' },
                { id: 'no_one', label: 'Personne' }
              ] as Array<{ id: PermissionScope; label: string }>
            ).map((opt) => {
              const currentValue =
                activeSubModal === 'comments'
                  ? commentPermission
                  : activeSubModal === 'tags'
                  ? tagPermission
                  : directMessages;
              const isSelected = currentValue === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    const patch =
                      activeSubModal === 'comments'
                        ? { allowComments: opt.id }
                        : activeSubModal === 'tags'
                        ? { allowMentions: opt.id }
                        : { allowMessages: opt.id };
                    void updatePrivacy(patch, 'Paramètre mis à jour');
                    setActiveSubModal(null);
                  }}
                  className={`w-full p-3 rounded-2xl flex items-center justify-between text-left text-xs transition ${
                    isSelected
                      ? 'bg-[#FF6321]/15 text-[#FF6321] border border-[#FF6321]/40 font-bold'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <span>{opt.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-[#FF6321]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(activeSubModal === 'liked_videos' || activeSubModal === 'following') && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
          onClick={() => setActiveSubModal(null)}
        >
          <div
            className="w-full max-w-sm mx-auto bg-[#181818] rounded-3xl border border-white/10 p-5 space-y-3 shadow-2xl animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">
                {activeSubModal === 'liked_videos' ? 'Visibilité des vidéos aimées' : 'Liste des abonnements'}
              </h3>
              <button onClick={() => setActiveSubModal(null)} className="p-1 text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            {[
              { id: 'only_me', label: 'Moi uniquement (Privé)' },
              { id: 'everyone', label: 'Tout le monde (Public)' }
            ].map((opt) => {
              const current = activeSubModal === 'liked_videos' ? likedVideosVisibility : followingListVisibility;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    if (activeSubModal === 'liked_videos') setLikedVideosVisibility(opt.id as 'only_me' | 'everyone');
                    else setFollowingListVisibility(opt.id as 'only_me' | 'everyone');
                    setActiveSubModal(null);
                    showToast('Visibilité mise à jour');
                  }}
                  className={`w-full p-3 rounded-2xl flex items-center justify-between text-left text-xs transition ${
                    current === opt.id
                      ? 'bg-[#FF6321]/15 text-[#FF6321] border border-[#FF6321]/40 font-bold'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <span>{opt.label}</span>
                  {current === opt.id && <Check className="w-4 h-4 text-[#FF6321]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeSubModal === 'blocked_users' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
          onClick={() => setActiveSubModal(null)}
        >
          <div
            className="w-full max-w-sm mx-auto bg-[#181818] rounded-3xl border border-white/10 p-5 space-y-3 shadow-2xl animate-slideUp max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Comptes bloqués ({blockedSellerIds.length})</h3>
              <button onClick={() => setActiveSubModal(null)} className="p-1 text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            {blockedSellerIds.length === 0 ? (
              <p className="text-xs text-white/50 py-4 text-center">Aucun compte bloqué.</p>
            ) : (
              blockedSellerIds.map((sellerId) => {
                const seller = sellers.find((s) => s.id === sellerId);
                const label = seller?.name || sellerId;
                return (
                  <div key={sellerId} className="p-3 bg-white/5 rounded-2xl flex items-center justify-between text-xs">
                    <span className="font-semibold text-white truncate max-w-[65%]">{label}</span>
                    <button
                      onClick={() => void handleUnblock(sellerId, label)}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-[#FF6321] text-white font-bold text-[11px] transition active:scale-95"
                    >
                      Débloquer
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
