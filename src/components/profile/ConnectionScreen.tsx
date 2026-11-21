import React, { useEffect, useState } from 'react';
import { ShoppingBag, Lock, Mail, ArrowRight, ShieldCheck, Store, Shield, User, Phone, X, ArrowLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export interface ConnectionScreenProps {
  initialMode?: 'login' | 'register';
  onClose?: () => void;
  contextMessage?: string;
  showExploreReturnButton?: boolean;
}

export const ConnectionScreen: React.FC<ConnectionScreenProps> = ({
  initialMode = 'login',
  onClose,
  contextMessage,
  showExploreReturnButton = false
}) => {
  const { signIn, signUp } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [registerRole, setRegisterRole] = useState<'client' | 'seller'>('client');
  const [email, setEmail] = useState(import.meta.env.DEV ? 'client@djassa.ci' : '');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setErrorMsg('');
  }, [initialMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await signIn(email.trim(), password);
        if (!res.success) {
          setErrorMsg(res.message || 'Identifiants invalides.');
        }
      } else {
        const res = await signUp({
          name: name.trim(),
          email: email.trim(),
          password,
          phone: phone.trim(),
          role: registerRole
        });
        if (!res.success) {
          setErrorMsg(res.message || 'Impossible de créer le compte.');
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur réseau lors de la connexion.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (demoEmail: string, demoPass: string) => {
    setMode('login');
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMsg('');
  };

  return (
    <div id="connection-screen" className="relative w-full h-full flex flex-col justify-between p-6 bg-[#0A0A0A] text-white overflow-y-auto no-scrollbar">
      {/* BACKGROUND GLOW */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-72 h-72 bg-[#FF6321] opacity-20 blur-[130px] rounded-full pointer-events-none" />

      {onClose && (
        <div className="flex items-center justify-between z-20 -mt-1 mb-2">
          <button
            type="button"
            id="btn-auth-continue-exploring"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-white/75 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{showExploreReturnButton ? 'Continuer à explorer' : 'Retour'}</span>
          </button>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TOP BRANDING */}
      <div className={`${onClose ? 'pt-2' : 'pt-8'} flex flex-col items-center text-center space-y-3 z-10`}>
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#FF6321] to-[#FF854D] flex items-center justify-center shadow-2xl shadow-orange-600/40">
          <ShoppingBag className="w-8 h-8 text-white stroke-[2.5]" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">DJASSA</h1>
          <p className="text-xs text-[#FF6321] font-bold tracking-wider uppercase mt-0.5">
            Le marché d'Adjamé en direct vidéo
          </p>
        </div>
        <p className="text-xs text-white/60 max-w-xs leading-relaxed">
          {contextMessage ||
            (mode === 'login'
              ? "Connectez-vous pour acheter auprès des commerçants d'Adjamé avec livraison express à Abidjan."
              : 'Créez votre compte DJASSA sécurisé en quelques secondes.')}
        </p>
      </div>

      {/* FORM */}
      <div className="w-full max-w-sm mx-auto my-5 z-10 space-y-4">
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-white/5 border border-white/10">
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMsg(''); }}
            className={`py-2 rounded-xl text-xs font-bold transition ${
              mode === 'login' ? 'bg-[#FF6321] text-white shadow' : 'text-white/60 hover:text-white'
            }`}
          >
            Connexion
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setErrorMsg(''); setPassword(''); }}
            className={`py-2 rounded-xl text-xs font-bold transition ${
              mode === 'register' ? 'bg-[#FF6321] text-white shadow' : 'text-white/60 hover:text-white'
            }`}
          >
            Créer un compte
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold text-center">
              {errorMsg}
            </div>
          )}

          {mode === 'register' && (
            <>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-white/70">Nom complet</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Kouassi Amenan"
                    required
                    minLength={2}
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/15 rounded-2xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-white/70">Téléphone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+225 07..."
                      className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/15 rounded-2xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-white/70">Espace</label>
                  <select
                    value={registerRole}
                    onChange={(e) => setRegisterRole(e.target.value as 'client' | 'seller')}
                    className="w-full px-3 py-2.5 bg-[#151518] border border-white/15 rounded-2xl text-xs text-white focus:outline-none focus:border-[#FF6321]"
                  >
                    <option value="client">Client</option>
                    <option value="seller">Vendeur</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-white/70">Adresse e-mail</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                id="input-login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre-email@djassa.ci"
                required
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/15 rounded-2xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-white/70">Mot de passe</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                id="input-login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={mode === 'register' ? 8 : 4}
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/15 rounded-2xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF6321]"
              />
            </div>
          </div>

          <button
            id="btn-login-submit"
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-[#FF6321] hover:bg-[#ff7538] text-white font-extrabold text-sm shadow-xl shadow-orange-600/30 transition flex items-center justify-center gap-2"
          >
            <span>
              {loading
                ? (mode === 'login' ? 'Connexion en cours...' : 'Création en cours...')
                : (mode === 'login' ? 'Se connecter' : 'Créer mon compte')}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* DEMO ACCOUNTS HELPER (DEV ENVIRONMENTS ONLY) */}
        {import.meta.env.DEV && (
          <div className="pt-4 border-t border-white/10 space-y-2">
            <span className="text-[11px] font-bold text-white/50 block text-center uppercase tracking-wider">
              Comptes de test (Environnement DEV)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillCredentials('client@djassa.ci', 'Client123')}
                className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-[#FF6321] text-left transition flex items-center gap-2"
              >
                <div className="p-1.5 rounded-lg bg-orange-500/20 text-[#FF6321]">
                  <ShoppingBag className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Client</p>
                  <p className="text-[9px] text-white/40">client@djassa.ci</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => fillCredentials('vendeur@djassa.ci', 'Vendeur123')}
                className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-purple-400 text-left transition flex items-center gap-2"
              >
                <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                  <Store className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Vendeur</p>
                  <p className="text-[9px] text-white/40">vendeur@djassa.ci</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => fillCredentials('admin@djassa.ci', 'Admin123')}
                className="col-span-2 p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-400 text-left transition flex items-center gap-2"
              >
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Shield className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Administrateur</p>
                  <p className="text-[9px] text-white/40">admin@djassa.ci</p>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="pb-4 text-center z-10 flex items-center justify-center gap-1.5 text-[10px] text-white/40">
        <ShieldCheck className="w-3.5 h-3.5 text-[#FF6321]" />
        <span>Plateforme certifiée Djassa • Abidjan, Côte d'Ivoire</span>
      </div>
    </div>
  );
};
