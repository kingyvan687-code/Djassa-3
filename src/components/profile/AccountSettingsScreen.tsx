import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  Calendar,
  Globe,
  KeyRound,
  Download,
  Trash2,
  AlertTriangle,
  Check,
  X,
  Eye,
  EyeOff,
  Store,
  FileText,
  Clock,
  ShieldAlert,
  Fingerprint
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getSecurityToken, securityService } from '../../services/securityService';
import { clientService } from '../../services/clientService';

interface AccountSettingsScreenProps {
  onBack: () => void;
}

export const AccountSettingsScreen: React.FC<AccountSettingsScreenProps> = ({ onBack }) => {
  const { userProfile, updateProfile, signOut, showToast, orders } = useApp();

  // Sub-dialogs state
  const [activeModal, setActiveModal] = useState<
    | null
    | 'phone'
    | 'email'
    | 'birthdate'
    | 'region'
    | 'password'
    | 'passkey'
    | 'download_data'
    | 'deactivate_or_delete'
    | 'confirm_deactivate'
    | 'confirm_delete'
  >(null);

  // Form states
  const [phoneInput, setPhoneInput] = useState(userProfile.phone || '+225 07 11 22 33 44');
  const [emailInput, setEmailInput] = useState(userProfile.email || 'client@djassa.ci');
  const [birthDateInput, setBirthDateInput] = useState(userProfile.birthDate || '1998-05-14');
  const [regionInput, setRegionInput] = useState(userProfile.accountRegion || 'Côte d\'Ivoire (Abidjan)');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Download data state
  const [downloadFormat, setDownloadFormat] = useState<'json' | 'txt'>('json');
  const [hasRequestedData, setHasRequestedData] = useState(false);
  const [downloadActiveTab, setDownloadActiveTab] = useState<'request' | 'download'>('request');

  // Account deletion/deactivation reason & password confirmation
  const [deleteReason, setDeleteReason] = useState('Je passe trop de temps sur l\'application');
  const [deletePasswordConfirm, setDeletePasswordConfirm] = useState('');
  const [deactivatePasswordConfirm, setDeactivatePasswordConfirm] = useState('');
  const [isAccountActionLoading, setIsAccountActionLoading] = useState(false);

  // Format birthdate for display (e.g. 14 mai 1998)
  const formatBirthDateDisplay = (isoDate: string) => {
    try {
      const d = new Date(isoDate);
      if (isNaN(d.getTime())) return isoDate;
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return isoDate;
    }
  };

  // Handlers
  const handleSavePhone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim()) {
      showToast('Veuillez renseigner un numéro valide.');
      return;
    }
    updateProfile({ phone: phoneInput.trim() } as any);
    showToast('Numéro de téléphone mis à jour avec succès 📱');
    setActiveModal(null);
  };

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !emailInput.includes('@')) {
      showToast('Veuillez renseigner une adresse e-mail valide.');
      return;
    }
    updateProfile({ email: emailInput.trim() } as any);
    showToast('Adresse e-mail mise à jour avec succès ✉️');
    setActiveModal(null);
  };

  const handleSaveBirthDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!birthDateInput) {
      showToast('Veuillez sélectionner une date valide.');
      return;
    }
    updateProfile({ birthDate: birthDateInput } as any);
    showToast('Date de naissance mise à jour 🎂');
    setActiveModal(null);
  };

  const handleSaveRegion = (regionName: string) => {
    setRegionInput(regionName);
    updateProfile({ accountRegion: regionName } as any);
    showToast(`Région configurée : ${regionName} 🇨🇮`);
    setActiveModal(null);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      showToast('Veuillez saisir votre mot de passe actuel.');
      return;
    }
    if (newPassword.length < 8) {
      showToast('Le nouveau mot de passe doit comporter au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Les mots de passe ne correspondent pas.');
      return;
    }
    setIsAccountActionLoading(true);
    try {
      if (getSecurityToken()) {
        await clientService.changePassword(currentPassword, newPassword);
      }
      showToast('Mot de passe modifié avec succès.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setActiveModal(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Mot de passe actuel incorrect ou erreur serveur.');
    } finally {
      setIsAccountActionLoading(false);
    }
  };

  const handleDownloadUserData = () => {
    const exportPayload = {
      profile: {
        id: userProfile.id,
        name: userProfile.name,
        username: userProfile.username,
        email: userProfile.email,
        phone: userProfile.phone,
        birthDate: userProfile.birthDate || birthDateInput,
        region: userProfile.accountRegion || regionInput,
        deliveryCommune: userProfile.deliveryCommune,
        deliveryQuartier: userProfile.deliveryQuartier,
        bio: userProfile.bio
      },
      stats: userProfile.stats,
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        total: o.total,
        status: o.status,
        date: o.createdAt,
        itemsCount: o.items.length
      })),
      favorites: {
        likedVideoCount: userProfile.likedVideoIds.length,
        savedProductsCount: userProfile.savedItemIds.length,
        followedSellersCount: userProfile.followedSellerIds.length
      },
      exportedAt: new Date().toISOString()
    };

    let contentBlob: Blob;
    let fileName: string;

    if (downloadFormat === 'json') {
      contentBlob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      fileName = `djassa_donnees_${userProfile.username}.json`;
    } else {
      const textSummary = `=== DONNÉES DU COMPTE DJASSA ===\n` +
        `Nom: ${userProfile.name} (@${userProfile.username})\n` +
        `Email: ${userProfile.email}\n` +
        `Téléphone: ${userProfile.phone}\n` +
        `Date de naissance: ${userProfile.birthDate || birthDateInput}\n` +
        `Région: ${userProfile.accountRegion || regionInput}\n` +
        `Total commandes passées: ${orders.length}\n` +
        `Boutiques suivies: ${userProfile.followedSellerIds.length}\n` +
        `Date de téléchargement: ${new Date().toLocaleString('fr-FR')}\n`;
      contentBlob = new Blob([textSummary], { type: 'text/plain;charset=utf-8' });
      fileName = `djassa_donnees_${userProfile.username}.txt`;
    }

    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(contentBlob);
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();

    void securityService.recordActivity({
      category: 'accounts',
      action: `Export des données personnelles client (${downloadFormat.toUpperCase()})`,
      actionType: 'data_export',
      target: userProfile.email || userProfile.id,
      targetType: 'account',
      entityType: 'account',
      entityId: userProfile.id,
      space: 'client',
      actorId: userProfile.id,
      actorName: userProfile.name,
      actorAccountLabel: userProfile.email || userProfile.phone,
      result: 'reussi',
      severity: 'faible',
      details: `Téléchargement archive ${fileName} (${orders.length} commandes)`
    });

    setHasRequestedData(true);
    showToast(`Téléchargement de vos données lancé (${fileName}) 📦`);
  };

  const handleDeactivateAccount = async () => {
    if (!deactivatePasswordConfirm.trim()) {
      showToast('Veuillez confirmer avec votre mot de passe.');
      return;
    }
    setIsAccountActionLoading(true);
    try {
      if (getSecurityToken()) {
        await clientService.updateAccountStatus('deactivate', deactivatePasswordConfirm);
      }
      setDeactivatePasswordConfirm('');
      setActiveModal(null);
      onBack();
      signOut();
      showToast('Votre compte a été désactivé.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Mot de passe incorrect ou erreur serveur.');
    } finally {
      setIsAccountActionLoading(false);
    }
  };

  const handleDeleteAccountPermanent = async () => {
    if (!deletePasswordConfirm.trim()) {
      showToast('Veuillez confirmer avec votre mot de passe.');
      return;
    }
    setIsAccountActionLoading(true);
    try {
      if (getSecurityToken()) {
        await clientService.updateAccountStatus('delete', deletePasswordConfirm);
      }
      setDeletePasswordConfirm('');
      setActiveModal(null);
      onBack();
      signOut();
      showToast('Votre demande de suppression a été enregistrée.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Mot de passe incorrect ou erreur serveur.');
    } finally {
      setIsAccountActionLoading(false);
    }
  };

  return (
    <div
      id="account-settings-screen"
      className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
    >
      {/* 1. TOP HEADER (TIKTOK COMPTE HEADER) */}
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
            Compte
          </h1>
        </div>
      </header>

      {/* 2. SCROLLABLE SETTINGS CONTENT */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-16">
        {/* SECTION 1: INFORMATIONS SUR LE COMPTE */}
        <section className="mt-4">
          <div className="px-4 py-1.5 text-[11px] font-bold text-white/40 tracking-wider">
            INFORMATIONS SUR LE COMPTE
          </div>
          <div className="bg-[#121212] border-t border-b border-white/5 divide-y divide-white/5">
            {/* Numéro de téléphone */}
            <button
              onClick={() => setActiveModal('phone')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition"
            >
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-white/70" />
                <span className="text-sm font-semibold text-white">Numéro de téléphone</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50">{userProfile.phone || phoneInput}</span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
            </button>

            {/* E-mail */}
            <button
              onClick={() => setActiveModal('email')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition"
            >
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-white/70" />
                <span className="text-sm font-semibold text-white">E-mail</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50">{userProfile.email || emailInput}</span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
            </button>

            {/* Date de naissance */}
            <button
              onClick={() => setActiveModal('birthdate')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition"
            >
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-white/70" />
                <span className="text-sm font-semibold text-white">Date de naissance</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50">
                  {formatBirthDateDisplay(userProfile.birthDate || birthDateInput)}
                </span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
            </button>

            {/* Région du compte */}
            <button
              onClick={() => setActiveModal('region')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition"
            >
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-white/70" />
                <span className="text-sm font-semibold text-white">Région du compte</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50">{userProfile.accountRegion || regionInput}</span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
            </button>
          </div>
        </section>

        {/* SECTION 2: SÉCURITÉ DU COMPTE */}
        <section className="mt-6">
          <div className="px-4 py-1.5 text-[11px] font-bold text-white/40 tracking-wider">
            SÉCURITÉ DU COMPTE
          </div>
          <div className="bg-[#121212] border-t border-b border-white/5 divide-y divide-white/5">
            {/* Mot de passe */}
            <button
              onClick={() => setActiveModal('password')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition"
            >
              <div className="flex items-center gap-3">
                <KeyRound className="w-4 h-4 text-white/70" />
                <span className="text-sm font-semibold text-white">Mot de passe</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/40 tracking-widest">••••••••</span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
            </button>

            {/* Clés d'accès Passkeys */}
            <button
              onClick={() => setActiveModal('passkey')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition"
            >
              <div className="flex items-center gap-3">
                <Fingerprint className="w-4 h-4 text-white/70" />
                <div>
                  <span className="text-sm font-semibold text-white">Clés d'accès (Passkeys)</span>
                  <p className="text-[11px] text-white/40">Connexion biométrique avec Face ID / Empreinte</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30" />
            </button>
          </div>
        </section>

        {/* SECTION 3: DONNÉES DU COMPTE */}
        <section className="mt-6">
          <div className="px-4 py-1.5 text-[11px] font-bold text-white/40 tracking-wider">
            DONNÉES DU COMPTE
          </div>
          <div className="bg-[#121212] border-t border-b border-white/5 divide-y divide-white/5">
            {/* Télécharger tes données */}
            <button
              onClick={() => setActiveModal('download_data')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition"
            >
              <div className="flex items-center gap-3">
                <Download className="w-4 h-4 text-[#FF6321]" />
                <div>
                  <span className="text-sm font-semibold text-white">Télécharger tes données</span>
                  <p className="text-[11px] text-white/50">Obtenir une copie complète de tes données Djassa</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30" />
            </button>
          </div>
        </section>

        {/* SECTION 4: GESTION DU COMPTE */}
        <section className="mt-6">
          <div className="px-4 py-1.5 text-[11px] font-bold text-white/40 tracking-wider">
            CONTRÔLE DU COMPTE
          </div>
          <div className="bg-[#121212] border-t border-b border-white/5 divide-y divide-white/5">
            {/* Basculer vers un compte Vendeur */}
            <button
              onClick={() => showToast('Pour ouvrir une boutique officielle à Adjamé, contactez le support marchand.')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition"
            >
              <div className="flex items-center gap-3">
                <Store className="w-4 h-4 text-white/70" />
                <span className="text-sm font-semibold text-white">Passer à un compte Entreprise / Vendeur</span>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30" />
            </button>

            {/* Désactiver ou supprimer le compte */}
            <button
              onClick={() => setActiveModal('deactivate_or_delete')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition text-red-400"
            >
              <div className="flex items-center gap-3">
                <Trash2 className="w-4 h-4 text-red-400" />
                <span className="text-sm font-semibold text-red-400">Désactiver ou supprimer le compte</span>
              </div>
              <ChevronRight className="w-4 h-4 text-red-400/50" />
            </button>
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* SUB-MODALS (TIKTOK STYLE)                                                */}
      {/* ========================================================================= */}

      {/* A. MODAL MODIFIER NUMÉRO */}
      {activeModal === 'phone' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-h-[85vh] bg-[#161616] rounded-t-3xl border-t border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-sm font-bold text-white">Numéro de téléphone</h2>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePhone} className="space-y-4 text-xs">
              <p className="text-white/60 text-[11px]">
                Ce numéro est utilisé pour recevoir les appels des coursiers moto et les notifications de commande.
              </p>

              <div>
                <label className="text-[10px] text-white/40 block mb-1 font-bold uppercase">Numéro de mobile (Côte d'Ivoire)</label>
                <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white">
                  <span className="text-[#FF6321] font-bold mr-2 text-xs">🇨🇮 +225</span>
                  <input
                    type="tel"
                    value={phoneInput.replace('+225', '').trim()}
                    onChange={(e) => setPhoneInput(`+225 ${e.target.value.replace('+225', '').trim()}`)}
                    placeholder="07 11 22 33 44"
                    className="w-full bg-transparent outline-none text-white text-xs font-semibold"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white font-bold text-xs shadow-lg transition active:scale-95"
              >
                Enregistrer le numéro
              </button>
            </form>
          </div>
        </div>
      )}

      {/* B. MODAL MODIFIER E-MAIL */}
      {activeModal === 'email' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-h-[85vh] bg-[#161616] rounded-t-3xl border-t border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-sm font-bold text-white">Adresse e-mail</h2>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmail} className="space-y-4 text-xs">
              <p className="text-white/60 text-[11px]">
                Votre adresse e-mail permet de récupérer votre compte et de recevoir les reçus de paiement Wave ou Orange Money.
              </p>

              <div>
                <label className="text-[10px] text-white/40 block mb-1 font-bold uppercase">Adresse e-mail</label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="nom@exemple.ci"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:border-[#FF6321] text-xs font-semibold"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white font-bold text-xs shadow-lg transition active:scale-95"
              >
                Enregistrer l'e-mail
              </button>
            </form>
          </div>
        </div>
      )}

      {/* C. MODAL MODIFIER DATE DE NAISSANCE */}
      {activeModal === 'birthdate' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-h-[85vh] bg-[#161616] rounded-t-3xl border-t border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-sm font-bold text-white">Date de naissance</h2>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBirthDate} className="space-y-4 text-xs">
              <p className="text-white/60 text-[11px]">
                Comme sur TikTok, votre date de naissance n'est pas affichée publiquement. Elle sert à adapter les recommandations et garantir la sécurité légale.
              </p>

              <div>
                <label className="text-[10px] text-white/40 block mb-1 font-bold uppercase">Date de naissance</label>
                <input
                  type="date"
                  value={birthDateInput}
                  onChange={(e) => setBirthDateInput(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:border-[#FF6321] text-xs font-semibold"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white font-bold text-xs shadow-lg transition active:scale-95"
              >
                Confirmer la date
              </button>
            </form>
          </div>
        </div>
      )}

      {/* D. MODAL RÉGION DU COMPTE */}
      {activeModal === 'region' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-h-[85vh] bg-[#161616] rounded-t-3xl border-t border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-sm font-bold text-white">Région du compte</h2>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-white/50 text-[11px] mb-2">
                Sélectionnez votre zone géographique principale en Côte d'Ivoire :
              </p>
              {[
                'Côte d\'Ivoire (Abidjan)',
                'Côte d\'Ivoire (Yamoussoukro)',
                'Côte d\'Ivoire (Bouaké)',
                'Côte d\'Ivoire (San Pedro)',
                'Côte d\'Ivoire (Korhogo)'
              ].map((reg) => (
                <button
                  key={reg}
                  onClick={() => handleSaveRegion(reg)}
                  className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition ${
                    (userProfile.accountRegion || regionInput) === reg
                      ? 'bg-[#FF6321]/15 text-[#FF6321] border border-[#FF6321]/30 font-bold'
                      : 'bg-white/5 text-white/80 hover:bg-white/10 border border-transparent'
                  }`}
                >
                  <span>{reg}</span>
                  {(userProfile.accountRegion || regionInput) === reg && (
                    <Check className="w-4 h-4 text-[#FF6321]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* E. MODAL MOT DE PASSE */}
      {activeModal === 'password' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-h-[85vh] bg-[#161616] rounded-t-3xl border-t border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-sm font-bold text-white">Modifier le mot de passe</h2>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-white/40 block mb-1 font-bold uppercase">Mot de passe actuel</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:border-[#FF6321]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/40 block mb-1 font-bold uppercase">Nouveau mot de passe</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 caractères"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:border-[#FF6321]"
                />
              </div>

              <div>
                <label className="text-[10px] text-white/40 block mb-1 font-bold uppercase">Confirmer le nouveau mot de passe</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Répétez le mot de passe"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:border-[#FF6321]"
                />
              </div>

              <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-[10px] text-white/50 space-y-0.5">
                <p>• Au moins 6 caractères</p>
                <p>• Incluez chiffres et lettres pour sécuriser votre compte</p>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white font-bold text-xs shadow-lg transition active:scale-95"
              >
                Mettre à jour le mot de passe
              </button>
            </form>
          </div>
        </div>
      )}

      {/* F. MODAL CLÉS D'ACCÈS PASSKEYS */}
      {activeModal === 'passkey' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-h-[85vh] bg-[#161616] rounded-t-3xl border-t border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp overflow-y-auto no-scrollbar text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-sm font-bold text-white">Clés d'accès (Passkeys)</h2>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-16 h-16 rounded-full bg-[#FF6321]/15 text-[#FF6321] flex items-center justify-center mx-auto my-2">
              <Fingerprint className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-white">Connexion rapide et sans mot de passe</h3>
              <p className="text-xs text-white/60 mt-1 max-w-xs mx-auto">
                Connectez-vous à Djassa simplement avec l'empreinte Touch ID ou Face ID de votre smartphone.
              </p>
            </div>

            <button
              onClick={() => {
                showToast('WebAuthn / Passkeys nécessite une configuration FIDO2 côté serveur.');
                setActiveModal(null);
              }}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition active:scale-95"
            >
              Compris
            </button>
          </div>
        </div>
      )}

      {/* G. MODAL TÉLÉCHARGER TOUTES TES DONNÉES (AUTHENTIQUE TIKTOK) */}
      {activeModal === 'download_data' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-h-[90vh] bg-[#161616] rounded-t-3xl border-t border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-sm font-bold text-white">Télécharger les données TikTok / Djassa</h2>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Segmented control tabs (Demander des données | Télécharger) */}
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 text-xs font-bold">
              <button
                type="button"
                onClick={() => setDownloadActiveTab('request')}
                className={`flex-1 py-2 rounded-lg transition ${
                  downloadActiveTab === 'request'
                    ? 'bg-[#FF6321] text-white'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                Demander des données
              </button>
              <button
                type="button"
                onClick={() => setDownloadActiveTab('download')}
                className={`flex-1 py-2 rounded-lg transition ${
                  downloadActiveTab === 'download'
                    ? 'bg-[#FF6321] text-white'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                Données prêtes ({hasRequestedData ? '1' : '0'})
              </button>
            </div>

            {downloadActiveTab === 'request' ? (
              <div className="space-y-4 text-xs">
                <p className="text-white/70 text-[11px] leading-relaxed">
                  Ta demande inclut tes informations de profil, ton historique de visionnage de vidéos d'Adjamé, tes commandes passées, tes commentaires et tes enregistrements.
                </p>

                {/* Data categories breakdown */}
                <div className="space-y-2">
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Données incluses</span>
                  <div className="bg-white/5 rounded-2xl border border-white/5 divide-y divide-white/5 p-1">
                    <div className="p-2.5 flex items-center justify-between">
                      <span className="font-semibold text-white">Profil & Coordonnées</span>
                      <Check className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="p-2.5 flex items-center justify-between">
                      <span className="font-semibold text-white">Historique des achats & factures</span>
                      <Check className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="p-2.5 flex items-center justify-between">
                      <span className="font-semibold text-white">Vidéos aimées & enregistrées</span>
                      <Check className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="p-2.5 flex items-center justify-between">
                      <span className="font-semibold text-white">Boutiques & vendeurs suivis</span>
                      <Check className="w-4 h-4 text-emerald-400" />
                    </div>
                  </div>
                </div>

                {/* Format selection */}
                <div className="space-y-2">
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Sélectionner le format de fichier</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDownloadFormat('json')}
                      className={`p-3 rounded-2xl border text-left transition ${
                        downloadFormat === 'json'
                          ? 'bg-[#FF6321]/15 border-[#FF6321] text-white font-bold'
                          : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                      }`}
                    >
                      <p className="text-xs font-bold">Fichier JSON</p>
                      <p className="text-[10px] text-white/50 mt-1">Recommandé pour machine / sauvegarde complète</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDownloadFormat('txt')}
                      className={`p-3 rounded-2xl border text-left transition ${
                        downloadFormat === 'txt'
                          ? 'bg-[#FF6321]/15 border-[#FF6321] text-white font-bold'
                          : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                      }`}
                    >
                      <p className="text-xs font-bold">Fichier texte TXT</p>
                      <p className="text-[10px] text-white/50 mt-1">Facile à lire sur votre téléphone</p>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadUserData}
                  className="w-full py-3.5 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white font-bold text-xs shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Télécharger les données maintenant
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {hasRequestedData ? (
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white text-xs">Archive Djassa ({downloadFormat.toUpperCase()})</p>
                      <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">Prêt au téléchargement</p>
                      <p className="text-[10px] text-white/40 mt-1">Généré le {new Date().toLocaleDateString('fr-FR')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadUserData}
                      className="px-3 py-2 rounded-xl bg-[#FF6321] text-white font-bold text-xs flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> Re-télécharger
                    </button>
                  </div>
                ) : (
                  <div className="p-8 text-center text-white/40 space-y-1">
                    <FileText className="w-8 h-8 mx-auto text-white/20 mb-2" />
                    <p className="text-xs font-bold text-white/60">Aucune archive en attente</p>
                    <p className="text-[11px]">Rendez-vous dans l'onglet "Demander des données" pour générer votre fichier.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* H. DÉSACTIVER OU SUPPRIMER LE COMPTE (CHOIX TIKTOK) */}
      {activeModal === 'deactivate_or_delete' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-h-[85vh] bg-[#161616] rounded-t-3xl border-t border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-sm font-bold text-white">Désactiver ou supprimer le compte</h2>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-white/60">
              Si vous souhaitez faire une pause sur Djassa, vous pouvez désactiver votre compte ou demander sa suppression définitive.
            </p>

            <div className="space-y-3 pt-1">
              {/* Option 1: Désactiver */}
              <button
                type="button"
                onClick={() => setActiveModal('confirm_deactivate')}
                className="w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-left transition flex items-center justify-between"
              >
                <div className="max-w-[85%] space-y-1">
                  <p className="font-bold text-white text-xs">Désactiver le compte</p>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    Personne ne pourra voir votre profil ni vos vidéos. Vous pourrez réactiver votre compte et restaurer toutes vos données à tout moment en vous reconnectant.
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/40 flex-shrink-0" />
              </button>

              {/* Option 2: Supprimer */}
              <button
                type="button"
                onClick={() => setActiveModal('confirm_delete')}
                className="w-full p-4 rounded-2xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-left transition flex items-center justify-between"
              >
                <div className="max-w-[85%] space-y-1">
                  <p className="font-bold text-red-400 text-xs">Supprimer définitivement le compte</p>
                  <p className="text-[11px] text-red-300/60 leading-relaxed">
                    Votre compte et vos données seront supprimés de manière permanente après un délai de réflexion légal de 30 jours.
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-red-400 flex-shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* I. CONFIRMATION DÉSACTIVATION */}
      {activeModal === 'confirm_deactivate' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-sm mx-auto bg-[#181818] rounded-3xl border border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Désactiver votre compte ?</h3>
              <p className="text-xs text-white/60 mt-1 leading-relaxed">
                Votre profil <span className="text-white font-semibold">@{userProfile.username}</span> sera immédiatement masqué. Vos commandes passées restent enregistrées.
              </p>
            </div>

            <div className="text-left space-y-1 text-xs">
              <label className="text-[10px] text-white/40 block font-bold uppercase">Mot de passe actuel (obligatoire)</label>
              <input
                type="password"
                value={deactivatePasswordConfirm}
                onChange={(e) => setDeactivatePasswordConfirm(e.target.value)}
                placeholder="Saisissez votre mot de passe"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex gap-2 pt-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white transition active:scale-95"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isAccountActionLoading}
                onClick={handleDeactivateAccount}
                className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-lg transition active:scale-95 disabled:opacity-50"
              >
                {isAccountActionLoading ? 'En cours...' : 'Désactiver'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* J. CONFIRMATION SUPPRESSION DÉFINITIVE */}
      {activeModal === 'confirm_delete' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-sm mx-auto bg-[#181818] rounded-3xl border border-red-500/30 p-5 space-y-4 shadow-2xl animate-slideUp text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Supprimer définitivement ?</h3>
              <p className="text-xs text-white/60 mt-1 leading-relaxed">
                Cette action est irréversible. Un délai de grâce de 30 jours commence maintenant. Après ce délai, toutes vos données seront effacées.
              </p>
            </div>

            <div className="text-left space-y-2 text-xs">
              <label className="text-[10px] text-white/40 block font-bold uppercase">Raison principale</label>
              <select
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-white outline-none focus:border-red-500 cursor-pointer"
              >
                <option value="Je passe trop de temps sur l'application" className="bg-[#181818] text-white">Je passe trop de temps sur l'application</option>
                <option value="Problème de confidentialité" className="bg-[#181818] text-white">Problème de confidentialité</option>
                <option value="J'ai créé un autre compte" className="bg-[#181818] text-white">J'ai créé un autre compte</option>
                <option value="Autre raison" className="bg-[#181818] text-white">Autre raison</option>
              </select>
            </div>

            <div className="text-left space-y-1 text-xs">
              <label className="text-[10px] text-white/40 block font-bold uppercase">Mot de passe actuel (obligatoire)</label>
              <input
                type="password"
                value={deletePasswordConfirm}
                onChange={(e) => setDeletePasswordConfirm(e.target.value)}
                placeholder="Saisissez votre mot de passe"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:border-red-500"
              />
            </div>

            <div className="flex gap-2 pt-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white transition active:scale-95"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isAccountActionLoading}
                onClick={handleDeleteAccountPermanent}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 transition active:scale-95 disabled:opacity-50"
              >
                {isAccountActionLoading ? 'En cours...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
