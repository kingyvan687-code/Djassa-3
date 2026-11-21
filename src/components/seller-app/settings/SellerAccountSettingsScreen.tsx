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
  Check,
  X,
  Eye,
  EyeOff,
  Store,
  MapPin,
  Fingerprint,
  ShieldCheck,
  Clock,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { Seller } from '../../../types';
import { useApp } from '../../../context/AppContext';

interface SellerAccountSettingsScreenProps {
  seller: Seller;
  onBack: () => void;
  onSignOut: () => void;
}

export const SellerAccountSettingsScreen: React.FC<SellerAccountSettingsScreenProps> = ({
  seller,
  onBack,
  onSignOut
}) => {
  const { updateSeller, showToast, products, orders } = useApp();

  // Active sub-modal / bottom sheet
  const [activeModal, setActiveModal] = useState<
    | null
    | 'store_identity'
    | 'phone'
    | 'email'
    | 'billing_email'
    | 'location'
    | 'region'
    | 'password'
    | 'passkey'
    | 'two_factor'
    | 'pin'
    | 'download_data'
    | 'deactivate_or_delete'
    | 'confirm_deactivate'
    | 'confirm_delete'
  >(null);

  // Profile fields state
  const [storeNameInput, setStoreNameInput] = useState(seller.name);
  const [usernameInput, setUsernameInput] = useState(seller.username);
  const [phoneInput, setPhoneInput] = useState(seller.phone || '+225 07 48 99 12 34');
  const [emailInput, setEmailInput] = useState(seller.email || 'boutique.wax@djassa.ci');
  const [billingEmailInput, setBillingEmailInput] = useState(seller.email || 'facturation@djassa.ci');
  const [locationInput, setLocationInput] = useState(seller.location || 'Marché d\'Adjamé, Forum box 42');
  const [regionInput, setRegionInput] = useState('Côte d\'Ivoire (Abidjan)');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Passkey & 2FA
  const [passkeyEnabled, setPasskeyEnabled] = useState(true);
  const [twoFactorAuth, setTwoFactorAuth] = useState(true);
  const [twoFactorMethod, setTwoFactorMethod] = useState<'sms' | 'email' | 'app'>('sms');
  const [sellerPin, setSellerPin] = useState('2026');

  // Download data state
  const [downloadFormat, setDownloadFormat] = useState<'json' | 'csv' | 'txt'>('json');
  const [hasRequestedData, setHasRequestedData] = useState(false);
  const [downloadActiveTab, setDownloadActiveTab] = useState<'request' | 'download'>('request');
  const [isExporting, setIsExporting] = useState(false);

  // Delete / deactivate state
  const [deleteReason, setDeleteReason] = useState('Je souhaite faire une pause dans mes ventes');
  const [deletePasswordConfirm, setDeletePasswordConfirm] = useState('');

  // Handlers
  const handleSaveStoreIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeNameInput.trim()) {
      showToast('Veuillez renseigner le nom de la boutique.');
      return;
    }
    updateSeller(seller.id, {
      name: storeNameInput.trim(),
      username: usernameInput.trim().replace(/^@/, '')
    });
    showToast('Identité de la boutique mise à jour ! ✨');
    setActiveModal(null);
  };

  const handleSavePhone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim()) {
      showToast('Veuillez entrer un numéro de téléphone valide.');
      return;
    }
    updateSeller(seller.id, { phone: phoneInput.trim() });
    showToast('Numéro de téléphone professionnel enregistré 📱');
    setActiveModal(null);
  };

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !emailInput.includes('@')) {
      showToast('Veuillez renseigner une adresse e-mail valide.');
      return;
    }
    updateSeller(seller.id, { email: emailInput.trim() });
    showToast('Adresse e-mail mise à jour avec succès ✉️');
    setActiveModal(null);
  };

  const handleSaveBillingEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!billingEmailInput.trim() || !billingEmailInput.includes('@')) {
      showToast('Veuillez renseigner une adresse e-mail valide.');
      return;
    }
    showToast('E-mail de facturation et reçus enregistré 🧾');
    setActiveModal(null);
  };

  const handleSaveLocation = (loc: string) => {
    setLocationInput(loc);
    updateSeller(seller.id, { location: loc, marketLocation: loc });
    showToast(`Emplacement mis à jour : ${loc} 📍`);
    setActiveModal(null);
  };

  const handleSaveRegion = (reg: string) => {
    setRegionInput(reg);
    showToast(`Région configurée : ${reg} 🇨🇮`);
    setActiveModal(null);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      showToast('Veuillez saisir votre mot de passe actuel.');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Le nouveau mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (!/\d/.test(newPassword)) {
      showToast('Le nouveau mot de passe doit contenir au moins un chiffre.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Les mots de passe ne correspondent pas.');
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    showToast('Mot de passe de la boutique modifié avec succès 🔒');
    setActiveModal(null);
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (sellerPin.length !== 4) {
      showToast('Le code PIN doit comporter 4 chiffres.');
      return;
    }
    showToast('Nouveau code PIN marchand enregistré ! 🛡️');
    setActiveModal(null);
  };

  const handleDownloadSellerData = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      const sellerProducts = products.filter((p) => p.sellerId === seller.id);
      const sellerOrders = orders.filter((o) => o.items.some((it) => it.sellerId === seller.id));

      const payload = {
        boutique: {
          id: seller.id,
          name: storeNameInput,
          username: usernameInput,
          email: emailInput,
          billingEmail: billingEmailInput,
          phone: phoneInput,
          location: locationInput,
          region: regionInput,
          rating: seller.rating,
          verified: seller.verified,
          registrationDate: '15 mars 2023',
          stats: {
            followedCount: seller.followedCount,
            salesCount: seller.salesCount,
            reviewsCount: seller.reviewsCount
          }
        },
        produits: sellerProducts.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          category: p.category,
          stock: p.stock,
          salesCount: p.salesCount
        })),
        commandes: sellerOrders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          total: o.total,
          status: o.status,
          date: o.createdAt
        })),
        dateExport: new Date().toISOString()
      };

      let blob: Blob;
      let filename = `djassa_boutique_${usernameInput}_donnees.${downloadFormat}`;

      if (downloadFormat === 'csv') {
        const csvLines = [
          'Catégorie;Titre / Réf;Prix (FCFA);Stock;Statut',
          ...sellerProducts.map((p) => `Article;${p.name};${p.price};${p.stock};Disponible`),
          ...sellerOrders.map((o) => `Commande;${o.orderNumber};${o.total};1;${o.status}`)
        ];
        blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      } else if (downloadFormat === 'txt') {
        const textContent = `
=== EXPORT BOUTIQUE DJASSA OFFICIEL ===
Nom de la boutique: ${storeNameInput} (@${usernameInput})
E-mail: ${emailInput}
Téléphone: ${phoneInput}
Emplacement: ${locationInput}
Total articles en vente: ${sellerProducts.length}
Commandes traitées: ${sellerOrders.length}
Généré le: ${new Date().toLocaleString('fr-FR')}
=======================================
`;
        blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
      } else {
        blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      }

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setHasRequestedData(true);
      showToast(`Archive ${downloadFormat.toUpperCase()} téléchargée avec succès 📦`);
    }, 600);
  };

  const handleDeactivateStore = () => {
    setActiveModal(null);
    onBack();
    showToast('Boutique mise en pause temporaire (Mode Vacances activé). Vos articles restent enregistrés.');
  };

  const handleDeleteStorePermanent = () => {
    setActiveModal(null);
    onBack();
    onSignOut();
    showToast('Votre demande de clôture de boutique a été enregistrée (Délai légal de 30 jours).');
  };

  return (
    <div
      id="seller-account-settings-screen"
      className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
    >
      {/* 1. TIKTOK TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-20 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/10 px-3 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition active:scale-95"
            aria-label="Retour"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold text-white tracking-tight">
              Compte
            </h1>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#FF6321]/20 text-[#FF6321] border border-[#FF6321]/30">
              Vendeur Pro
            </span>
          </div>
        </div>
      </header>

      {/* 2. SCROLLABLE SETTINGS CONTENT (AUTHENTIQUE STYLE TIKTOK COMPTE) */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-16">
        {/* SECTION 1: INFORMATIONS SUR LE COMPTE */}
        <section className="mt-4">
          <div className="px-4 py-1.5 text-[11px] font-bold text-white/40 tracking-wider uppercase">
            Informations sur le compte
          </div>
          <div className="bg-[#121212] border-t border-b border-white/5 divide-y divide-white/5">
            {/* Nom & Identifiant de la boutique */}
            <button
              onClick={() => setActiveModal('store_identity')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Store className="w-4 h-4 text-white/70 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-white block">Nom de la boutique</span>
                  <span className="text-[11px] text-white/50 block truncate mt-0.5">
                    {storeNameInput} · @{usernameInput}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {seller.verified && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-[#FF6321] border border-[#FF6321]/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Vérifié
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
            </button>

            {/* Numéro de téléphone */}
            <button
              onClick={() => setActiveModal('phone')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Phone className="w-4 h-4 text-white/70 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-white block">Numéro de téléphone</span>
                  <span className="text-[11px] text-white/50 block truncate mt-0.5">
                    Utilisé pour les alertes commandes et le contact clients
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="text-xs text-white/70 font-medium">{phoneInput}</span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
            </button>

            {/* E-mail professionnel */}
            <button
              onClick={() => setActiveModal('email')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Mail className="w-4 h-4 text-white/70 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-white block">Adresse E-mail</span>
                  <span className="text-[11px] text-white/50 block truncate mt-0.5">
                    {emailInput}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Vérifié
                </span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
            </button>

            {/* E-mail de facturation & reçus */}
            <button
              onClick={() => setActiveModal('billing_email')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-white/70 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-white block">E-mail de facturation</span>
                  <span className="text-[11px] text-white/50 block truncate mt-0.5">
                    Reçus Wave, Orange Money et bordereaux
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="text-xs text-white/50 truncate max-w-[130px]">{billingEmailInput}</span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
            </button>

            {/* Emplacement & Marché physique */}
            <button
              onClick={() => setActiveModal('location')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <MapPin className="w-4 h-4 text-white/70 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-white block">Emplacement physique</span>
                  <span className="text-[11px] text-white/50 block truncate mt-0.5">
                    Marché ou point de retrait de la boutique
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="text-xs text-white/70 truncate max-w-[140px]">{locationInput}</span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
            </button>

            {/* Date d'immatriculation */}
            <div className="w-full px-4 py-3.5 flex items-center justify-between text-left opacity-90">
              <div className="flex items-center gap-3 min-w-0">
                <Calendar className="w-4 h-4 text-white/70 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-white block">Date d'inscription</span>
                  <span className="text-[11px] text-white/50 block mt-0.5">
                    Boutique enregistrée sur Djassa
                  </span>
                </div>
              </div>
              <span className="text-xs text-white/50 font-medium">15 mars 2023</span>
            </div>

            {/* Région du compte */}
            <button
              onClick={() => setActiveModal('region')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Globe className="w-4 h-4 text-white/70 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-white block">Région du compte</span>
                  <span className="text-[11px] text-white/50 block mt-0.5">Zone commerciale principale</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="text-xs text-white/70 font-medium">{regionInput}</span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
            </button>
          </div>
        </section>

        {/* SECTION 2: SÉCURITÉ DU COMPTE (MOT DE PASSE, PASSKEYS, PIN, 2FA) */}
        <section className="mt-6">
          <div className="px-4 py-1.5 text-[11px] font-bold text-white/40 tracking-wider uppercase">
            Sécurité du compte
          </div>
          <div className="bg-[#121212] border-t border-b border-white/5 divide-y divide-white/5">
            {/* Mot de passe */}
            <button
              onClick={() => setActiveModal('password')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-white block">Mot de passe</span>
                  <span className="text-[11px] text-white/50 block mt-0.5">
                    Dernière modification : il y a 2 semaines
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="text-xs text-white/40 tracking-widest font-mono">••••••••</span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
            </button>

            {/* Clés d'accès (Passkeys) */}
            <button
              onClick={() => setActiveModal('passkey')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Fingerprint className="w-4 h-4 text-cyan-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-white block">Clés d'accès (Passkeys)</span>
                  <span className="text-[11px] text-white/50 block mt-0.5">
                    Connexion biométrique par Face ID ou capteur d'empreinte
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  passkeyEnabled ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-white/10 text-white/50'
                }`}>
                  {passkeyEnabled ? 'Activé' : 'Désactivé'}
                </span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
            </button>

            {/* Double authentification 2FA */}
            <button
              onClick={() => setActiveModal('two_factor')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-white block">Double authentification (2FA)</span>
                  <span className="text-[11px] text-white/50 block mt-0.5">
                    {twoFactorAuth ? `Protégé via ${twoFactorMethod.toUpperCase()}` : 'Non configuré'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  twoFactorAuth ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/10 text-white/50'
                }`}>
                  {twoFactorAuth ? 'Actif' : 'Inactif'}
                </span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
            </button>

            {/* Code PIN marchand */}
            <button
              onClick={() => setActiveModal('pin')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <KeyRound className="w-4 h-4 text-[#FF6321] shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-white block">Code PIN Marchand</span>
                  <span className="text-[11px] text-white/50 block mt-0.5">
                    Sécurise les retraits Wave / Orange Money
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="text-xs font-mono text-white/60">••••</span>
                <ChevronRight className="w-4 h-4 text-white/30" />
              </div>
            </button>
          </div>
        </section>

        {/* SECTION 3: DONNÉES DU COMPTE */}
        <section className="mt-6">
          <div className="px-4 py-1.5 text-[11px] font-bold text-white/40 tracking-wider uppercase">
            Données du compte
          </div>
          <div className="bg-[#121212] border-t border-b border-white/5 divide-y divide-white/5">
            <button
              onClick={() => setActiveModal('download_data')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Download className="w-4 h-4 text-[#FF6321] shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-white block">Télécharger tes données</span>
                  <span className="text-[11px] text-white/50 block mt-0.5">
                    Copie complète des articles, ventes et bilans (JSON / CSV)
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30 shrink-0 ml-3" />
            </button>
          </div>
        </section>

        {/* SECTION 4: CONTRÔLE DU COMPTE */}
        <section className="mt-6">
          <div className="px-4 py-1.5 text-[11px] font-bold text-white/40 tracking-wider uppercase">
            Contrôle du compte
          </div>
          <div className="bg-[#121212] border-t border-b border-white/5 divide-y divide-white/5">
            {/* Basculer vers l'espace Acheteur */}
            <button
              onClick={() => {
                showToast('Basculement vers l\'espace Client / Acheteur...');
                onSignOut();
              }}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Store className="w-4 h-4 text-cyan-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-white block">Basculer vers l'espace Acheteur</span>
                  <span className="text-[11px] text-white/50 block mt-0.5">
                    Acheter et explorer les boutiques d'Abidjan en tant que client
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-white/30 shrink-0 ml-3" />
            </button>

            {/* Désactiver ou fermer la boutique */}
            <button
              onClick={() => setActiveModal('deactivate_or_delete')}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition text-red-400"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-red-400 block">Désactiver ou supprimer la boutique</span>
                  <span className="text-[11px] text-red-400/60 block mt-0.5">
                    Mettre en pause ou clôturer définitivement votre espace marchand
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-red-400/50 shrink-0 ml-3" />
            </button>
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* SUB-MODALS / BOTTOM SHEETS (AUTHENTIQUE TIKTOK)                           */}
      {/* ========================================================================= */}

      {/* A. MODAL NOM ET IDENTIFIANT BOUTIQUE */}
      {activeModal === 'store_identity' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-h-[85vh] bg-[#161616] rounded-t-3xl border-t border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-sm font-bold text-white">Identité de la boutique</h2>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStoreIdentity} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] text-white/40 block mb-1 font-bold uppercase">Nom commercial officiel</label>
                <input
                  type="text"
                  value={storeNameInput}
                  onChange={(e) => setStoreNameInput(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:border-[#FF6321] text-xs font-semibold"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-white/40 block mb-1 font-bold uppercase">Identifiant unique (@username)</label>
                <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white">
                  <span className="text-[#FF6321] font-bold mr-1 text-xs">@</span>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value.replace(/[^a-zA-Z0-9._]/g, ''))}
                    className="w-full bg-transparent outline-none text-white text-xs font-semibold"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white font-bold text-xs shadow-lg transition active:scale-95"
              >
                Enregistrer l'identité
              </button>
            </form>
          </div>
        </div>
      )}

      {/* B. MODAL NUMÉRO DE TÉLÉPHONE */}
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
              <h2 className="text-sm font-bold text-white">Numéro de téléphone professionnel</h2>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePhone} className="space-y-4 text-xs">
              <p className="text-white/60 text-[11px] leading-relaxed">
                Ce numéro est utilisé pour vos alertes SMS 2FA et pour coordonner directement vos livraisons avec vos acheteurs.
              </p>

              <div>
                <label className="text-[10px] text-white/40 block mb-1 font-bold uppercase">Numéro Mobile (Côte d'Ivoire)</label>
                <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white">
                  <span className="text-[#FF6321] font-bold mr-2 text-xs">🇨🇮 +225</span>
                  <input
                    type="tel"
                    value={phoneInput.replace('+225', '').trim()}
                    onChange={(e) => setPhoneInput(`+225 ${e.target.value.replace('+225', '').trim()}`)}
                    placeholder="07 48 99 12 34"
                    className="w-full bg-transparent outline-none text-white text-xs font-semibold"
                    required
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

      {/* C. MODAL E-MAIL DU COMPTE */}
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
              <h2 className="text-sm font-bold text-white">Adresse e-mail professionnelle</h2>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmail} className="space-y-4 text-xs">
              <p className="text-white/60 text-[11px] leading-relaxed">
                Votre adresse e-mail permet de récupérer votre compte marchand et de recevoir les notifications officielles de Djassa Pro.
              </p>

              <div>
                <label className="text-[10px] text-white/40 block mb-1 font-bold uppercase">Adresse e-mail du compte</label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-white/40 absolute left-3 pointer-events-none" />
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="boutique@djassa.ci"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white outline-none focus:border-[#FF6321] text-xs font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Adresse e-mail protégée et vérifiée</span>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white font-bold text-xs shadow-lg transition active:scale-95"
              >
                Mettre à jour l'e-mail
              </button>
            </form>
          </div>
        </div>
      )}

      {/* D. MODAL E-MAIL DE FACTURATION */}
      {activeModal === 'billing_email' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-h-[85vh] bg-[#161616] rounded-t-3xl border-t border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-sm font-bold text-white">E-mail de facturation & reçus</h2>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBillingEmail} className="space-y-4 text-xs">
              <p className="text-white/60 text-[11px] leading-relaxed">
                Cet e-mail reçoit les relevés de commissions fixes (150 FCFA/cmd), les attestations et les preuves de virements Wave / Orange Money.
              </p>

              <div>
                <label className="text-[10px] text-white/40 block mb-1 font-bold uppercase">E-mail comptabilité / facturation</label>
                <input
                  type="email"
                  value={billingEmailInput}
                  onChange={(e) => setBillingEmailInput(e.target.value)}
                  placeholder="comptabilite@votre-boutique.ci"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:border-[#FF6321] text-xs font-semibold"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white font-bold text-xs shadow-lg transition active:scale-95"
              >
                Enregistrer l'e-mail de facturation
              </button>
            </form>
          </div>
        </div>
      )}

      {/* E. MODAL EMPLACEMENT PHYSIQUE */}
      {activeModal === 'location' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-h-[85vh] bg-[#161616] rounded-t-3xl border-t border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-sm font-bold text-white">Emplacement & Marché physique</h2>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-white/60 text-[11px]">
                Indiquez le repère précis de votre boutique pour vos clients :
              </p>

              <div className="space-y-2">
                {[
                  'Marché d\'Adjamé, Forum des Marchés (Box 42)',
                  'Marché de Treichville, Avenue 8 (Étage 1)',
                  'Cocody Angré, 8ème Tranche (Carrefour Bluetooth)',
                  'Marcory Zone 4, Rue du Canal',
                  'Yopougon Siporex, Face Pharmacie de la Gare',
                  'Plateau, Rue du Commerce'
                ].map((loc) => (
                  <button
                    key={loc}
                    onClick={() => handleSaveLocation(loc)}
                    className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition ${
                      locationInput === loc
                        ? 'bg-[#FF6321]/15 text-[#FF6321] border border-[#FF6321]/30 font-bold'
                        : 'bg-white/5 text-white/80 hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#FF6321]" />
                      <span>{loc}</span>
                    </div>
                    {locationInput === loc && <Check className="w-4 h-4 text-[#FF6321]" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* F. MODAL RÉGION DU COMPTE */}
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
                Sélectionnez votre zone de distribution prioritaire :
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
                    regionInput === reg
                      ? 'bg-[#FF6321]/15 text-[#FF6321] border border-[#FF6321]/30 font-bold'
                      : 'bg-white/5 text-white/80 hover:bg-white/10 border border-transparent'
                  }`}
                >
                  <span>{reg}</span>
                  {regionInput === reg && <Check className="w-4 h-4 text-[#FF6321]" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* G. MODAL MODIFIER MOT DE PASSE (AUTHENTIQUE TIKTOK) */}
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

            <form onSubmit={handleChangePassword} className="space-y-3.5 text-xs">
              <div>
                <label className="text-[10px] text-white/40 block mb-1 font-bold uppercase">Mot de passe actuel</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:border-[#FF6321]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/40 block mb-1 font-bold uppercase">Nouveau mot de passe</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 caractères"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:border-[#FF6321]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/40 block mb-1 font-bold uppercase">Confirmer le nouveau mot de passe</label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Répétez le mot de passe"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none focus:border-[#FF6321]"
                  required
                />
              </div>

              {/* Critères dynamiques TikTok */}
              <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-[10px] space-y-1 text-white/50">
                <div className={`flex items-center gap-1.5 ${newPassword.length >= 6 ? 'text-emerald-400 font-bold' : ''}`}>
                  <Check className="w-3 h-3" />
                  <span>Au moins 6 caractères</span>
                </div>
                <div className={`flex items-center gap-1.5 ${/\d/.test(newPassword) ? 'text-emerald-400 font-bold' : ''}`}>
                  <Check className="w-3 h-3" />
                  <span>Contient au moins un chiffre</span>
                </div>
                <div className={`flex items-center gap-1.5 ${newPassword && newPassword === confirmPassword ? 'text-emerald-400 font-bold' : ''}`}>
                  <Check className="w-3 h-3" />
                  <span>Les deux mots de passe correspondent</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white font-bold text-xs shadow-lg transition active:scale-95"
              >
                Mettre à jour le mot de passe
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => showToast(`Un code SMS de réinitialisation a été envoyé au ${phoneInput} 📲`)}
                  className="text-xs text-[#FF6321] hover:underline font-bold"
                >
                  Mot de passe oublié ? Réinitialiser par SMS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* H. MODAL PASSKEYS BIOMÉTRIQUE */}
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

            <div className="w-16 h-16 rounded-full bg-cyan-500/15 text-cyan-400 flex items-center justify-center mx-auto my-2">
              <Fingerprint className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-white">Connexion biométrique ultra-sécurisée</h3>
              <p className="text-xs text-white/60 mt-1 max-w-xs mx-auto leading-relaxed">
                Connectez-vous à votre espace marchand Djassa instantanément avec l'empreinte Touch ID, Face ID ou Windows Hello.
              </p>
            </div>

            <button
              onClick={() => {
                setPasskeyEnabled(!passkeyEnabled);
                showToast(passkeyEnabled ? 'Clé d\'accès désactivée.' : 'Clé d\'accès Face ID enregistrée sur cet appareil ✨');
                setActiveModal(null);
              }}
              className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs shadow-lg transition active:scale-95"
            >
              {passkeyEnabled ? 'Désactiver la clé biométrique' : 'Activer une clé d\'accès sur cet appareil'}
            </button>
          </div>
        </div>
      )}

      {/* I. MODAL DOUBLE AUTHENTIFICATION 2FA */}
      {activeModal === 'two_factor' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-h-[85vh] bg-[#161616] rounded-t-3xl border-t border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-sm font-bold text-white">Vérification en deux étapes (2FA)</h2>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10">
                <div>
                  <span className="font-bold text-white block">Activer la protection 2FA</span>
                  <span className="text-[10px] text-white/50 block mt-0.5">Exige un code de confirmation à la connexion</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTwoFactorAuth(!twoFactorAuth);
                    showToast(twoFactorAuth ? '2FA désactivé.' : 'Protection 2FA activée ! 🛡️');
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                    twoFactorAuth ? 'bg-[#FF6321]' : 'bg-white/20'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${twoFactorAuth ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {twoFactorAuth && (
                <div className="space-y-2">
                  <label className="text-[10px] text-white/40 block font-bold uppercase">Méthode de réception du code</label>
                  <div className="space-y-2">
                    {[
                      { id: 'sms', label: 'SMS / Appel téléphonique', desc: phoneInput },
                      { id: 'email', label: 'E-mail professionnel', desc: emailInput },
                      { id: 'app', label: 'Application Authenticator', desc: 'Google Authenticator ou Microsoft Authenticator' }
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setTwoFactorMethod(m.id as any);
                          showToast(`Méthode 2FA sélectionnée : ${m.label}`);
                        }}
                        className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition ${
                          twoFactorMethod === m.id
                            ? 'bg-[#FF6321]/15 text-white border border-[#FF6321] font-bold'
                            : 'bg-white/5 text-white/70 hover:bg-white/10 border border-transparent'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-white">{m.label}</p>
                          <p className="text-[10px] text-white/50">{m.desc}</p>
                        </div>
                        {twoFactorMethod === m.id && <Check className="w-4 h-4 text-[#FF6321]" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* J. MODAL CODE PIN MARCHAND */}
      {activeModal === 'pin' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-h-[85vh] bg-[#161616] rounded-t-3xl border-t border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-sm font-bold text-white">Code PIN Marchand</h2>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePin} className="space-y-4 text-xs">
              <p className="text-white/60 text-[11px] leading-relaxed">
                Ce code secret à 4 chiffres est exigé avant chaque virement Wave, Orange Money ou MTN MoMo depuis votre solde.
              </p>

              <div>
                <label className="text-[10px] text-white/40 block mb-1 font-bold uppercase">Nouveau code secret (4 chiffres)</label>
                <input
                  type="password"
                  maxLength={4}
                  value={sellerPin}
                  onChange={(e) => setSellerPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-center text-lg font-mono tracking-widest text-white outline-none focus:border-[#FF6321]"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white font-bold text-xs shadow-lg transition active:scale-95"
              >
                Valider le code PIN
              </button>
            </form>
          </div>
        </div>
      )}

      {/* K. MODAL TÉLÉCHARGER TOUTES TES DONNÉES (AUTHENTIQUE TIKTOK 2 ONGLETS) */}
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
              <h2 className="text-sm font-bold text-white">Télécharger les données de la boutique</h2>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Segmented control tabs (Demander des données | Données prêtes) */}
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
                  Votre archive marchande comprend le catalogue complet de vos articles, les prix, les historiques de ventes, les factures et les commissions Djassa.
                </p>

                {/* Données incluses */}
                <div className="space-y-2">
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Données incluses</span>
                  <div className="bg-white/5 rounded-2xl border border-white/5 divide-y divide-white/5 p-1">
                    <div className="p-2.5 flex items-center justify-between">
                      <span className="font-semibold text-white">Informations de la boutique & profil</span>
                      <Check className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="p-2.5 flex items-center justify-between">
                      <span className="font-semibold text-white">Catalogue produits & stocks</span>
                      <Check className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="p-2.5 flex items-center justify-between">
                      <span className="font-semibold text-white">Commandes clients & bordereaux d'expédition</span>
                      <Check className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="p-2.5 flex items-center justify-between">
                      <span className="font-semibold text-white">Relevés de retraits Wave / Orange Money</span>
                      <Check className="w-4 h-4 text-emerald-400" />
                    </div>
                  </div>
                </div>

                {/* Format selection */}
                <div className="space-y-2">
                  <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Sélectionner le format de fichier</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'json', label: 'JSON', desc: 'Sauvegarde technique' },
                      { id: 'csv', label: 'CSV / Excel', desc: 'Gestion comptable' },
                      { id: 'txt', label: 'Texte TXT', desc: 'Lecture mobile' }
                    ].map((fmt) => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setDownloadFormat(fmt.id as any)}
                        className={`p-3 rounded-2xl border text-left transition ${
                          downloadFormat === fmt.id
                            ? 'bg-[#FF6321]/15 border-[#FF6321] text-white font-bold'
                            : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                        }`}
                      >
                        <p className="text-xs font-bold">{fmt.label}</p>
                        <p className="text-[9px] text-white/50 mt-1">{fmt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadSellerData}
                  disabled={isExporting}
                  className="w-full py-3.5 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white font-bold text-xs shadow-lg transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>{isExporting ? 'Génération de l\'archive en cours...' : `Télécharger l'archive (${downloadFormat.toUpperCase()})`}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {hasRequestedData ? (
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white text-xs">Archive Djassa Marchand ({downloadFormat.toUpperCase()})</p>
                      <p className="text-[10px] text-emerald-400 font-semibold mt-0.5">Prêt au téléchargement</p>
                      <p className="text-[10px] text-white/40 mt-1">Généré le {new Date().toLocaleDateString('fr-FR')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadSellerData}
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

      {/* L. MODAL DÉSACTIVER OU SUPPRIMER LA BOUTIQUE */}
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
              <h2 className="text-sm font-bold text-white">Désactiver ou fermer la boutique</h2>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-full text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-white/60 leading-relaxed">
              Si vous partez en vacances ou souhaitez suspendre vos ventes, vous pouvez désactiver temporairement votre boutique ou demander sa suppression définitive.
            </p>

            <div className="space-y-3 pt-1">
              {/* Option 1: Désactiver temporairement */}
              <button
                type="button"
                onClick={() => setActiveModal('confirm_deactivate')}
                className="w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-left transition flex items-center justify-between"
              >
                <div className="max-w-[85%] space-y-1">
                  <p className="font-bold text-white text-xs">Mettre la boutique en pause (Mode vacances)</p>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    Votre vitrine reste accessible en lecture mais les clients ne pourront pas passer de commande. Vous pouvez la réactiver à tout moment sans perte de vos vidéos ni de vos abonnés.
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/40 flex-shrink-0" />
              </button>

              {/* Option 2: Supprimer définitivement */}
              <button
                type="button"
                onClick={() => setActiveModal('confirm_delete')}
                className="w-full p-4 rounded-2xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-left transition flex items-center justify-between"
              >
                <div className="max-w-[85%] space-y-1">
                  <p className="font-bold text-red-400 text-xs">Fermer définitivement la boutique</p>
                  <p className="text-[11px] text-red-300/60 leading-relaxed">
                    Votre compte vendeur, vos articles et votre historique seront clôturés de manière permanente après un délai légal de réflexion de 30 jours.
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-red-400 flex-shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* M. CONFIRMATION MISE EN PAUSE */}
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
              <h3 className="text-base font-bold text-white">Mettre votre boutique en pause ?</h3>
              <p className="text-xs text-white/60 mt-1 leading-relaxed">
                Votre boutique <span className="text-white font-semibold">@{usernameInput}</span> passera en mode vacances. Vos gains en attente restent protégés.
              </p>
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
                onClick={handleDeactivateStore}
                className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-lg transition active:scale-95"
              >
                Confirmer la pause
              </button>
            </div>
          </div>
        </div>
      )}

      {/* N. CONFIRMATION FERMETURE DÉFINITIVE */}
      {activeModal === 'confirm_delete' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
          onClick={() => setActiveModal(null)}
        >
          <div
            className="w-full max-w-sm mx-auto bg-[#181818] rounded-3xl border border-red-500/20 p-5 space-y-4 shadow-2xl animate-slideUp text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Clôturer définitivement la boutique</h3>
              <p className="text-xs text-white/60 mt-1 leading-relaxed">
                Entrez votre mot de passe pour confirmer la demande de suppression de votre espace commerçant <span className="text-white font-semibold">@{usernameInput}</span>.
              </p>
            </div>

            <div className="space-y-3 text-xs text-left">
              <div>
                <label className="text-[10px] text-white/40 block mb-1 uppercase font-bold">Raison principale</label>
                <select
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-[#FF6321]"
                >
                  <option value="Pause dans mes ventes">Pause dans mes ventes</option>
                  <option value="Changement d'activité">Changement d'activité commerciale</option>
                  <option value="Création d'un autre compte">Création d'un autre compte</option>
                  <option value="Autre motif">Autre motif</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-white/40 block mb-1 uppercase font-bold">Mot de passe de confirmation</label>
                <input
                  type="password"
                  value={deletePasswordConfirm}
                  onChange={(e) => setDeletePasswordConfirm(e.target.value)}
                  placeholder="Votre mot de passe"
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-red-500"
                />
              </div>
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
                onClick={handleDeleteStorePermanent}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg transition active:scale-95"
              >
                Clôturer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
