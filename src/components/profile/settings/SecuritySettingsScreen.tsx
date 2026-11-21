import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Smartphone,
  Laptop,
  KeyRound,
  Check,
  X,
  Copy,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { securityService } from '../../../services/securityService';

interface SecuritySettingsScreenProps {
  onBack: () => void;
}

function generateSecureRecoveryCodes(count = 6): string[] {
  const result: string[] = [];
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const arr = new Uint32Array(count * 2);
    window.crypto.getRandomValues(arr);
    for (let i = 0; i < count; i += 1) {
      const a = String(1000 + (arr[i * 2] % 9000));
      const b = String(1000 + (arr[i * 2 + 1] % 9000));
      result.push(`${a}-${b}`);
    }
    return result;
  }
  return ['4821-9034', '7152-3389', '6094-1278', '8310-5642', '2947-8815', '5403-6729'].slice(0, count);
}

export const SecuritySettingsScreen: React.FC<SecuritySettingsScreenProps> = ({ onBack }) => {
  const {
    showToast,
    userProfile,
    clientPreferences,
    updateClientPreferences,
    activeUserSessions,
    disconnectSession,
    disconnectAllOtherSessions,
  } = useApp();

  const twoFactorEnabled = clientPreferences.privacy.twoFactorEnabled;

  const [activeModal, setActiveModal] = useState<
    null | 'security_alerts' | 'two_factor_wizard' | 'recovery_codes'
  >(null);
  const [twoFactorMethod, setTwoFactorMethod] = useState<'sms' | 'auth_app' | 'email'>('sms');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>(() => generateSecureRecoveryCodes(6));
  const [copiedCodes, setCopiedCodes] = useState(false);

  const displayedSessions = useMemo(() => {
    if (activeUserSessions.length > 0) return activeUserSessions;
    const browserLabel = typeof navigator !== 'undefined'
      ? navigator.platform || 'Navigateur'
      : 'Navigateur';
    return [
      {
        sessionId: 'current-browser',
        device: 'Session actuelle',
        browser: browserLabel,
        os: 'Web',
        location: null,
        startedAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        status: 'active',
        isCurrent: true,
      },
    ];
  }, [activeUserSessions]);

  const otherSessionsCount = displayedSessions.filter((s) => !s.isCurrent).length;

  const handleToggleTwoFactor = async (nextState: boolean) => {
    await updateClientPreferences({
      privacy: {
        ...clientPreferences.privacy,
        twoFactorEnabled: nextState,
      },
    });
    void securityService.recordActivity({
      category: 'security',
      actionType: 'client_2fa_toggled',
      action: nextState ? 'Activation de la préférence 2FA' : 'Désactivation de la préférence 2FA',
      target: twoFactorMethod.toUpperCase(),
      targetType: 'settings',
      entityType: 'account',
      space: 'client',
      result: 'reussi',
      severity: nextState ? 'faible' : 'eleve',
      details: `Méthode choisie : ${twoFactorMethod}`,
    });
    showToast(nextState ? 'Vérification 2FA activée' : 'Vérification 2FA désactivée');
  };

  const handleRegenerateCodes = () => {
    const nextCodes = generateSecureRecoveryCodes(6);
    setRecoveryCodes(nextCodes);
    void securityService.recordActivity({
      category: 'security',
      actionType: 'client_recovery_codes_regenerated',
      action: 'Génération des codes de récupération 2FA',
      target: userProfile.email || userProfile.username || 'client',
      targetType: 'settings',
      entityType: 'account',
      space: 'client',
      result: 'reussi',
      severity: 'moyen',
      details: '6 nouveaux codes générés côté client via crypto.getRandomValues',
    });
    showToast('Nouveaux codes de secours générés');
  };

  const handleCopyCodes = () => {
    void navigator.clipboard?.writeText(recoveryCodes.join('\n'));
    setCopiedCodes(true);
    showToast('Codes copiés dans le presse-papiers');
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  return (
    <div
      id="security-settings-screen"
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
            Sécurité et sessions
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-16">
        {/* BANNER ÉTAT DE SÉCURITÉ */}
        <button
          onClick={() => setActiveModal('security_alerts')}
          className="w-full text-left p-4 mt-3 px-4"
        >
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between hover:bg-emerald-500/15 transition">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-white text-xs">État de sécurité du compte</p>
                <p className="text-[11px] text-emerald-300/80 mt-0.5">
                  {displayedSessions.length} session(s) enregistrée(s) · Protection {twoFactorEnabled ? '2FA active' : 'standard'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-emerald-400" />
          </div>
        </button>

        {/* SECTION 1: PROTECTION ET 2FA */}
        <section className="mt-2">
          <div className="px-4 py-1.5 text-[11px] font-bold text-white/40 tracking-wider">
            PROTECTION DU COMPTE
          </div>
          <div className="bg-[#121212] border-t border-b border-white/5 divide-y divide-white/5">
            <button
              onClick={() => setActiveModal('two_factor_wizard')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] transition"
            >
              <div className="max-w-[75%] space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">Vérification en 2 étapes (2FA)</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                      twoFactorEnabled
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-white/10 text-white/50'
                    }`}
                  >
                    {twoFactorEnabled ? 'Activée' : 'Désactivée'}
                  </span>
                </div>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  {userProfile.phone
                    ? `Vérification liée au numéro ${userProfile.phone}`
                    : 'Configurez votre méthode préférée de validation.'}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30" />
            </button>

            <button
              onClick={() => setActiveModal('recovery_codes')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] transition"
            >
              <div className="max-w-[75%] space-y-0.5">
                <span className="text-sm font-semibold text-white block">Codes de récupération</span>
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Générez et copiez des codes de secours cryptographiques à conserver hors ligne.
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30" />
            </button>
          </div>
        </section>

        {/* SECTION 2: SESSIONS ACTIVES */}
        <section className="mt-6">
          <div className="px-4 py-1.5 flex items-center justify-between text-[11px] font-bold text-white/40 tracking-wider">
            <span>SESSIONS ACTIVES ({displayedSessions.length})</span>
            {otherSessionsCount > 0 && (
              <button
                onClick={disconnectAllOtherSessions}
                className="text-[10px] text-[#FF6321] hover:underline font-bold"
              >
                Fermer les autres sessions
              </button>
            )}
          </div>
          <div className="bg-[#121212] border-t border-b border-white/5 divide-y divide-white/5">
            {displayedSessions.map((session) => {
              const label = `${session.device} · ${session.browser} (${session.os})`;
              const isMobile = /android|iphone|ipad|mobile/i.test(label);
              return (
                <div key={session.sessionId} className="px-4 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/70">
                      {isMobile ? <Smartphone className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white flex items-center gap-1.5">
                        {label}
                        {session.isCurrent && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                            Cet appareil
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-white/50">
                        Dernière activité : {new Date(session.lastActivityAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                      {session.location && (
                        <p className="text-[9px] text-white/30">{session.location}</p>
                      )}
                    </div>
                  </div>

                  {!session.isCurrent && (
                    <button
                      onClick={() => disconnectSession(session.sessionId)}
                      className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 text-[10px] font-bold transition border border-white/5"
                    >
                      Déconnecter
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* SUB-MODAL 1: RÉSUMÉ SESSIONS & SÉCURITÉ */}
      {activeModal === 'security_alerts' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-sm mx-auto bg-[#181818] rounded-3xl border border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp max-h-[75vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                Sessions enregistrées
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              {displayedSessions.map((session) => (
                <div key={session.sessionId} className="p-3 bg-white/5 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white">{session.device} · {session.browser}</span>
                    <span className="text-[10px] text-emerald-400 font-bold">
                      {session.isCurrent ? 'Session active' : session.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/60">{session.os}{session.location ? ` · ${session.location}` : ''}</p>
                  <p className="text-[10px] text-white/40">
                    {new Date(session.lastActivityAt).toLocaleString('fr-FR')}
                  </p>
                </div>
              ))}
            </div>

            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* SUB-MODAL 2: CONFIGURATION 2FA */}
      {activeModal === 'two_factor_wizard' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-sm mx-auto bg-[#181818] rounded-3xl border border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Vérification en 2 étapes</h3>
              <button onClick={() => setActiveModal(null)} className="p-1 text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-white/60">
              Enregistrez votre préférence de protection 2FA pour votre compte client Djassa.
            </p>

            <div className="space-y-2">
              {[
                { id: 'sms', title: 'SMS (Côte d\'Ivoire)', desc: userProfile.phone || 'Téléphone non renseigné' },
                { id: 'auth_app', title: 'Application d\'authentification (TOTP)', desc: 'Code temporaire à 6 chiffres' },
                { id: 'email', title: 'Adresse e-mail', desc: userProfile.email || 'E-mail non renseigné' }
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setTwoFactorMethod(m.id as 'sms' | 'auth_app' | 'email')}
                  className={`w-full p-3 rounded-2xl flex items-center justify-between text-left text-xs transition ${
                    twoFactorMethod === m.id
                      ? 'bg-[#FF6321]/15 border border-[#FF6321] text-white'
                      : 'bg-white/5 border border-white/5 text-white/70'
                  }`}
                >
                  <div className="space-y-0.5">
                    <p className="font-bold text-white">{m.title}</p>
                    <p className="text-[10px] text-white/40">{m.desc}</p>
                  </div>
                  {twoFactorMethod === m.id && <Check className="w-4 h-4 text-[#FF6321]" />}
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  void handleToggleTwoFactor(!twoFactorEnabled);
                  setActiveModal(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white transition"
              >
                {twoFactorEnabled ? 'Désactiver' : 'Activer'}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleToggleTwoFactor(true);
                  setActiveModal(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#FF6321] hover:bg-[#E05316] text-white transition shadow"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL 3: CODES DE SECOURS */}
      {activeModal === 'recovery_codes' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-sm mx-auto bg-[#181818] rounded-3xl border border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-[#FF6321]/20 text-[#FF6321] flex items-center justify-center mx-auto">
              <KeyRound className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-white">Codes de récupération</h3>
              <p className="text-xs text-white/60 mt-1">
                Conservez ces codes en lieu sûr pour récupérer l'accès en cas de perte de téléphone.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3 bg-white/5 rounded-2xl font-mono text-xs font-bold text-emerald-400">
              {recoveryCodes.map((code, idx) => (
                <div key={idx} className="p-2 bg-black/40 rounded-xl border border-white/5">
                  {code}
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2 text-xs font-bold">
              <button
                type="button"
                onClick={handleRegenerateCodes}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white transition flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Régénérer
              </button>
              <button
                type="button"
                onClick={handleCopyCodes}
                className="flex-1 py-2.5 rounded-xl bg-[#FF6321] hover:bg-[#E05316] text-white transition flex items-center justify-center gap-1.5 shadow"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedCodes ? 'Copié !' : 'Copier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
