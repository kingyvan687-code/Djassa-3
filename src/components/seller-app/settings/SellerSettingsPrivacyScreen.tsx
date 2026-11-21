import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  User,
  Lock,
  ShieldCheck,
  QrCode,
  ShoppingBag,
  Bell,
  Clock,
  Sliders,
  Globe,
  Moon,
  Trash2,
  Wifi,
  HelpCircle,
  AlertCircle,
  FileText,
  Users,
  LogOut,
  Check,
  X,
  Share2,
  Smartphone,
  Shield,
  Sparkles,
  Wallet,
  Truck,
  Store,
  MessageSquare,
  Filter,
  CheckCircle2,
  Copy,
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  Info,
  Calendar,
  DollarSign,
  KeyRound,
  Download,
  AlertTriangle,
  Fingerprint,
  Eye,
  EyeOff,
  Laptop
} from 'lucide-react';
import { Seller, Product } from '../../../types';
import { useApp } from '../../../context/AppContext';
import { formatFCFA, formatMetricCount } from '../../../services/marketServices';
import { securityService } from '../../../services/securityService';
import { commerceService, DJASSA_FIXED_COMMISSION_FCFA } from '../../../services/commerceService';

// Reusing shared sub-screens for consistency
import { LanguageSettingsScreen } from '../../profile/settings/LanguageSettingsScreen';
import { DisplaySettingsScreen } from '../../profile/settings/DisplaySettingsScreen';
import { DataSaverSettingsScreen } from '../../profile/settings/DataSaverSettingsScreen';
import { SafetyCenterSettingsScreen } from '../../profile/settings/SafetyCenterSettingsScreen';
import { TermsSettingsScreen } from '../../profile/settings/TermsSettingsScreen';
import { SwitchAccountSettingsScreen } from '../../profile/settings/SwitchAccountSettingsScreen';
import { FreeUpSpaceSettingsScreen } from '../../profile/settings/FreeUpSpaceSettingsScreen';
import { SellerAccountSettingsScreen } from './SellerAccountSettingsScreen';

interface Props {
  seller: Seller;
  onClose: () => void;
  onSignOut: () => void;
}

export type SellerSheetType =
  | null
  | 'account'
  | 'email_phone'
  | 'password'
  | 'privacy'
  | 'security'
  | 'qrcode'
  | 'orders'
  | 'wallet'
  | 'store_hours'
  | 'notifications'
  | 'comments_filter'
  | 'content_prefs'
  | 'download_data'
  | 'language'
  | 'display'
  | 'free_cache'
  | 'data_saver'
  | 'report_problem'
  | 'help_center'
  | 'safety_center'
  | 'terms'
  | 'switch_account'
  | 'logout_confirm'
  | 'deactivate_store';

export const SellerSettingsPrivacyScreen: React.FC<Props> = ({
  seller,
  onClose,
  onSignOut,
}) => {
  const { 
    updateSeller, 
    orders, 
    products, 
    showToast, 
    clearHistory 
  } = useApp();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);

  // Active sub-sheet
  const [activeSheet, setActiveSheet] = useState<SellerSheetType>(null);

  // Seller account & credentials state
  const [storeName, setStoreName] = useState(seller.name);
  const [username, setUsername] = useState(seller.username);
  const [sellerEmail, setSellerEmail] = useState(seller.email || 'wax.elegance@djassa.ci');
  const [billingEmail, setBillingEmail] = useState(seller.email || 'facturation@wax-elegance.ci');
  const [phone, setPhone] = useState(seller.phone || '+225 07 48 99 12 34');
  const [location, setLocation] = useState(seller.location || 'Adjamé Forum des Marchés');
  const [bio, setBio] = useState(seller.bio || '');

  // Password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passkeyEnabled, setPasskeyEnabled] = useState(true);

  // Privacy toggles
  const [isStockVisible, setIsStockVisible] = useState(true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(true);
  const [allowDirectMessages, setAllowDirectMessages] = useState<'everyone' | 'customers' | 'nobody'>('everyone');
  const [hideSalesStats, setHideSalesStats] = useState(false);

  // Security & 2FA
  const [twoFactorAuth, setTwoFactorAuth] = useState(true);
  const [twoFactorMethod, setTwoFactorMethod] = useState<'sms' | 'email' | 'app'>('sms');
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [saveLoginInfo, setSaveLoginInfo] = useState(true);
  const [sellerPin, setSellerPin] = useState('2026');

  // Connected devices
  const [devices, setDevices] = useState([
    {
      id: 'dev-1',
      name: 'iPhone 14 Pro',
      location: 'Abidjan, Cocody',
      ip: '160.154.120.45',
      active: 'En ligne maintenant',
      isCurrent: true,
      type: 'phone'
    },
    {
      id: 'dev-2',
      name: 'MacBook Air M2',
      location: 'Abidjan, Plateau',
      ip: '160.154.88.12',
      active: 'Connecté il y a 2 jours',
      isCurrent: false,
      type: 'laptop'
    },
    {
      id: 'dev-3',
      name: 'Samsung Galaxy A54',
      location: 'Abidjan, Yopougon',
      ip: '41.202.219.74',
      active: 'Connecté il y a 1 semaine',
      isCurrent: false,
      type: 'phone'
    }
  ]);

  // Notifications
  const [notifNewOrders, setNotifNewOrders] = useState(true);
  const [notifOrderUpdates, setNotifOrderUpdates] = useState(true);
  const [notifCustomerMessages, setNotifCustomerMessages] = useState(true);
  const [notifLowStock, setNotifLowStock] = useState(true);

  // Content preferences & moderation
  const [autoFilterProfanity, setAutoFilterProfanity] = useState(true);
  const [customKeywords, setCustomKeywords] = useState<string[]>([
    'arnaque',
    'faux',
    'voleur',
    'brouteur',
    'mensonge'
  ]);
  const [newKeyword, setNewKeyword] = useState('');
  const [videoHdUpload, setVideoHdUpload] = useState(true);
  const [watermarkDjassa, setWatermarkDjassa] = useState(true);

  // Store status & hours
  const [isStoreOpen, setIsStoreOpen] = useState(true);
  const [vacationMode, setVacationMode] = useState(false);
  const [openTime, setOpenTime] = useState('08:00');
  const [closeTime, setCloseTime] = useState('19:00');

  // Wallet
  const [walletBalance, setWalletBalance] = useState(485000);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawProvider, setWithdrawProvider] = useState<'wave' | 'orange_money'>('wave');
  const [withdrawPhone, setWithdrawPhone] = useState(phone);
  const [withdrawalsHistory, setWithdrawalsHistory] = useState([
    { id: 'ret-1', amount: 85000, provider: 'Wave', date: 'Aujourd\'hui 08:30', status: 'Confirmé' },
    { id: 'ret-2', amount: 150000, provider: 'Orange Money', date: 'Hier 14:15', status: 'Confirmé' },
    { id: 'ret-3', amount: 50000, provider: 'Wave', date: 'Il y a 3 jours', status: 'Confirmé' }
  ]);

  // Report problem
  const [reportSubject, setReportSubject] = useState('Commande & Expédition');
  const [reportText, setReportText] = useState('');

  // Download data
  const [downloadFormat, setDownloadFormat] = useState<'json' | 'csv'>('json');
  const [isDownloadingData, setIsDownloadingData] = useState(false);

  // Seller orders calculations
  const sellerOrders = useMemo(() => {
    return orders.filter((o) => o.items.some((it) => it.sellerId === seller.id));
  }, [orders, seller.id]);

  const confirmedOrdersCount = sellerOrders.length;
  const paidOnlineCount = sellerOrders.filter((o) => o.paymentStatus === 'paid').length;
  const codPendingCount = sellerOrders.filter((o) => o.paymentMode === 'cod' || o.paymentStatus === 'cod_pending').length;

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const prevSummary = `${seller.name} | ${seller.location}`;
    const nextSummary = `${storeName.trim()} | ${location.trim()}`;
    updateSeller(seller.id, {
      name: storeName.trim(),
      username: username.trim().replace(/^@/, ''),
      phone: phone.trim(),
      location: location.trim(),
      bio: bio.trim(),
      email: sellerEmail.trim()
    });
    void securityService.recordActivity({
      category: 'products',
      actionType: 'seller_store_updated',
      action: `Modification fiche boutique (${storeName.trim()})`,
      target: storeName.trim(),
      targetType: 'store',
      entityType: 'store',
      entityId: seller.id,
      space: 'seller',
      result: 'reussi',
      severity: 'faible',
      beforeValue: prevSummary,
      afterValue: nextSummary,
      details: `Mise à jour des informations boutique par @${username.trim().replace(/^@/, '')}`
    });
    showToast('Profil boutique mis à jour avec succès ! ✨');
    setActiveSheet(null);
  };

  const handleSaveEmailPhone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerEmail.trim() || !sellerEmail.includes('@')) {
      void securityService.recordActivity({
        category: 'accounts',
        actionType: 'seller_contact_update_failed',
        action: 'Échec modification coordonnées vendeur (e-mail invalide)',
        target: seller.name,
        targetType: 'account',
        entityType: 'account',
        entityId: seller.id,
        space: 'seller',
        result: 'echoue',
        severity: 'faible',
        details: 'Adresse e-mail invalide saisie lors de la mise à jour vendeur'
      });
      showToast('Veuillez entrer une adresse e-mail valide.');
      return;
    }
    const prevContact = `${seller.email || ''} · ${seller.phone || ''}`;
    updateSeller(seller.id, {
      email: sellerEmail.trim(),
      phone: phone.trim()
    });
    void securityService.recordActivity({
      category: 'accounts',
      actionType: 'seller_contact_updated',
      action: `Modification e-mail et téléphone vendeur (${seller.name})`,
      target: sellerEmail.trim(),
      targetType: 'account',
      entityType: 'account',
      entityId: seller.id,
      space: 'seller',
      result: 'reussi',
      severity: 'moyen',
      beforeValue: prevContact,
      afterValue: `${sellerEmail.trim()} · ${phone.trim()}`,
      details: 'Mise à jour des coordonnées principales du compte vendeur'
    });
    showToast('Coordonnées & E-mail enregistrés ! ✉️');
    setActiveSheet(null);
  };

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword) {
      showToast('Veuillez entrer votre mot de passe actuel.');
      return;
    }
    if (newPassword.length < 6) {
      void securityService.recordActivity({
        category: 'auth',
        actionType: 'seller_password_change_failed',
        action: 'Échec changement mot de passe vendeur (trop court)',
        target: sellerEmail,
        targetType: 'session',
        entityType: 'account',
        entityId: seller.id,
        space: 'seller',
        result: 'echoue',
        severity: 'faible',
        details: 'Mot de passe refusé (moins de 6 caractères)'
      });
      showToast('Le nouveau mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      void securityService.recordActivity({
        category: 'auth',
        actionType: 'seller_password_change_failed',
        action: 'Échec changement mot de passe vendeur (non concordant)',
        target: sellerEmail,
        targetType: 'session',
        entityType: 'account',
        entityId: seller.id,
        space: 'seller',
        result: 'echoue',
        severity: 'faible',
        details: 'Confirmation de mot de passe non concordante'
      });
      showToast('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    void securityService.recordActivity({
      category: 'auth',
      actionType: 'seller_password_changed',
      action: `Changement mot de passe vendeur (${seller.name})`,
      target: sellerEmail,
      targetType: 'session',
      entityType: 'account',
      entityId: seller.id,
      space: 'seller',
      result: 'reussi',
      severity: 'moyen',
      details: 'Mot de passe vendeur renouvelé avec succès (valeur non journalisée)'
    });
    showToast('Mot de passe mis à jour avec succès ! 🔒');
    setActiveSheet(null);
  };

  const handleDisconnectDevice = (id: string, name: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== id));
    void securityService.recordActivity({
      category: 'security',
      actionType: 'seller_device_disconnected',
      action: `Déconnexion appareil vendeur (${name})`,
      target: name,
      targetType: 'session',
      entityType: 'device',
      entityId: id,
      space: 'seller',
      result: 'reussi',
      severity: 'moyen',
      details: `Appareil ${name} déconnecté du compte vendeur ${seller.name}`
    });
    showToast(`Appareil « ${name} » déconnecté avec succès.`);
  };

  const handleExportData = () => {
    setIsDownloadingData(true);
    setTimeout(() => {
      setIsDownloadingData(false);
      const dataPayload = {
        store: {
          name: seller.name,
          username: seller.username,
          email: sellerEmail,
          phone: phone,
          location: seller.location,
          rating: seller.rating,
          verified: seller.verified
        },
        productsCount: products.filter(p => p.sellerId === seller.id).length,
        ordersCount: sellerOrders.length,
        exportedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(dataPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `djassa_boutique_${seller.username}_donnees.${downloadFormat}`;
      a.click();
      URL.revokeObjectURL(url);
      void securityService.recordActivity({
        category: 'accounts',
        actionType: 'seller_data_exported',
        action: `Export données boutique (${downloadFormat.toUpperCase()})`,
        target: seller.name,
        targetType: 'account',
        entityType: 'account',
        entityId: seller.id,
        space: 'seller',
        result: 'reussi',
        severity: 'faible',
        details: `Archive ${downloadFormat.toUpperCase()} téléchargée (${sellerOrders.length} commandes)`
      });
      showToast(`Export ${downloadFormat.toUpperCase()} téléchargé avec succès ! 📦`);
    }, 700);
  };

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newKeyword.trim().toLowerCase();
    if (!clean) return;
    if (customKeywords.includes(clean)) {
      showToast('Ce mot-clé est déjà présent.');
      return;
    }
    setCustomKeywords([...customKeywords, clean]);
    setNewKeyword('');
    showToast(`Mot-clé « ${clean} » ajouté au filtre anti-arnaque.`);
  };

  const handleRemoveKeyword = (kw: string) => {
    setCustomKeywords(customKeywords.filter((k) => k !== kw));
    showToast('Mot-clé retiré.');
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(withdrawAmount);
    const maskedPhone = withdrawPhone.length > 4 ? `***${withdrawPhone.slice(-4)}` : '***';
    const provName = withdrawProvider === 'wave' ? 'Wave' : 'Orange Money';
    if (!val || val <= 0) {
      showToast('Montant invalide.');
      return;
    }
    if (val > walletBalance) {
      void securityService.recordActivity({
        category: 'wallets',
        actionType: 'seller_withdrawal_failed',
        action: 'Échec demande retrait vendeur (solde insuffisant)',
        target: `${seller.name} • ${formatFCFA(val)}`,
        targetType: 'finance',
        entityType: 'wallet',
        entityId: seller.id,
        space: 'seller',
        result: 'echoue',
        severity: 'moyen',
        beforeValue: formatFCFA(walletBalance),
        afterValue: formatFCFA(walletBalance),
        details: `Montant demandé ${formatFCFA(val)} > solde ${formatFCFA(walletBalance)}`
      });
      showToast('Solde insuffisant.');
      return;
    }
    const prevBal = walletBalance;
    try {
      const result = await commerceService.requestWithdrawal({
        amountFcfa: val,
        channel: provName,
        payoutTarget: withdrawPhone
      });
      const txRef = result.withdrawal?.id || `RET-VND-${Date.now()}`;
      const nextBal = typeof result.newBalanceFcfa === 'number' ? result.newBalanceFcfa : Math.max(0, prevBal - val);
      const statusLabel = result.withdrawal?.status === 'completed' ? 'Confirmé' : 'En attente';
      setWalletBalance(nextBal);
      setWithdrawalsHistory((prev) => [
        { id: txRef, amount: val, provider: provName, date: 'À l\'instant', status: statusLabel },
        ...prev
      ]);
      setWithdrawAmount('');
      void securityService.recordActivity({
        category: 'wallets',
        actionType: 'seller_withdrawal_requested',
        action: `Demande de retrait vendeur (${formatFCFA(val)})`,
        target: `${seller.name} • ${provName}`,
        targetType: 'finance',
        entityType: 'withdrawal',
        entityId: txRef,
        space: 'seller',
        result: 'reussi',
        severity: val >= 200000 ? 'moyen' : 'faible',
        beforeValue: formatFCFA(prevBal),
        afterValue: formatFCFA(nextBal),
        details: `Virement ${provName} vers ${maskedPhone}`,
        financialTrace: {
          operationType: 'Retrait portefeuille vendeur',
          transactionId: txRef,
          initiatorName: seller.name,
          initiatorId: seller.id,
          beneficiaryAccount: `${provName} (${maskedPhone})`,
          amountFcfa: val,
          previousBalanceFcfa: prevBal,
          newBalanceFcfa: nextBal,
          status: statusLabel,
          timestamp: new Date().toISOString(),
          validationResult: 'Validé côté serveur',
          channel: provName
        }
      });
      showToast(`Retrait de ${formatFCFA(val)} enregistré vers ${provName} (${withdrawPhone}).`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Retrait refusé par le serveur.');
    }
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportText.trim()) {
      showToast('Veuillez décrire le problème rencontré.');
      return;
    }
    const ticketRef = `TKT-VND-${Date.now().toString().slice(-5)}`;
    void securityService.recordActivity({
      category: 'messaging',
      actionType: 'seller_problem_reported',
      action: `Signalement vendeur (${reportSubject})`,
      target: `#${ticketRef}`,
      targetType: 'system',
      entityType: 'ticket',
      entityId: ticketRef,
      space: 'seller',
      result: 'reussi',
      severity: 'faible',
      details: `${reportSubject} : ${reportText.trim().slice(0, 140)}`
    });
    showToast('Ticket vendeur transmis au support Djassa Marchand. Merci ! 📬');
    setReportText('');
    setActiveSheet(null);
  };

  // Structured TikTok-style sections
  interface SettingItem {
    id: string;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    subtitle?: string;
    value?: string;
    badge?: string;
    action: () => void;
  }

  interface SettingSection {
    sectionKey: string;
    title: string;
    items: SettingItem[];
  }

  const sections: SettingSection[] = [
    {
      sectionKey: 'compte',
      title: 'COMPTE',
      items: [
        {
          id: 'account_info',
          icon: User,
          title: 'Compte',
          subtitle: 'Informations, e-mail, mot de passe, etc.',
          action: () => setActiveSheet('account'),
        },
        {
          id: 'email_phone_item',
          icon: Mail,
          title: 'E-mail et téléphone',
          subtitle: `${sellerEmail} · ${phone}`,
          value: 'Vérifié',
          action: () => setActiveSheet('email_phone'),
        },
        {
          id: 'password_item',
          icon: KeyRound,
          title: 'Mot de passe & Clé d\'accès',
          subtitle: passkeyEnabled ? 'Protégé par mot de passe & Biométrie' : 'Modifier le mot de passe',
          action: () => setActiveSheet('password'),
        },
        {
          id: 'privacy',
          icon: Lock,
          title: 'Confidentialité',
          subtitle: isStockVisible ? 'Stock en temps réel public' : 'Stock masqué',
          action: () => setActiveSheet('privacy'),
        },
        {
          id: 'security',
          icon: ShieldCheck,
          title: 'Sécurité et autorisations',
          subtitle: twoFactorAuth ? '2FA activé · Appareils protégés' : '3 appareils connectés · Alertes actives',
          badge: 'Important',
          action: () => setActiveSheet('security'),
        },
        {
          id: 'qrcode',
          icon: QrCode,
          title: 'Code QR et profil',
          subtitle: 'Partager le lien direct Djassa',
          action: () => setActiveSheet('qrcode'),
        },
        {
          id: 'orders_overview',
          icon: ShoppingBag,
          title: 'Commandes et expéditions',
          subtitle: `${confirmedOrdersCount} commande(s) confirmée(s) · ${paidOnlineCount} en ligne · ${codPendingCount} à la livraison`,
          badge: confirmedOrdersCount > 0 ? `${confirmedOrdersCount} confirmée(s)` : undefined,
          action: () => setActiveSheet('orders'),
        },
        {
          id: 'download_data_item',
          icon: Download,
          title: 'Télécharger tes données',
          subtitle: 'Catalogue, ventes et historiques en JSON / CSV',
          action: () => setActiveSheet('download_data'),
        },
      ],
    },
    {
      sectionKey: 'finances_commerce',
      title: 'FINANCES ET COMMERCE',
      items: [
        {
          id: 'wallet_withdrawals',
          icon: Wallet,
          title: 'Portefeuille & Reversements',
          subtitle: 'Reversements directs Wave et Orange Money',
          value: formatFCFA(walletBalance),
          action: () => setActiveSheet('wallet'),
        },
        {
          id: 'store_hours',
          icon: Store,
          title: 'Horaires & Statut de la boutique',
          subtitle: vacationMode ? 'Mode congés activé' : isStoreOpen ? `Ouvert de ${openTime} à ${closeTime}` : 'Fermé temporairement',
          value: vacationMode ? 'En pause' : isStoreOpen ? 'Ouvert' : 'Fermé',
          action: () => setActiveSheet('store_hours'),
        },
      ],
    },
    {
      sectionKey: 'contenu_notifications',
      title: 'CONTENU ET NOTIFICATIONS',
      items: [
        {
          id: 'notifications',
          icon: Bell,
          title: 'Notifications Vendeur',
          subtitle: 'Alertes commandes, reversements Wave/Orange Money, avis',
          action: () => setActiveSheet('notifications'),
        },
        {
          id: 'comments_filter',
          icon: MessageSquare,
          title: 'Filtre des commentaires & Modération',
          subtitle: `${customKeywords.length} mot(s)-clé(s) anti-arnaque`,
          action: () => setActiveSheet('comments_filter'),
        },
        {
          id: 'content_prefs',
          icon: Sliders,
          title: 'Préférences de publication',
          subtitle: 'Qualité vidéo HD, filigrane Djassa, sons',
          action: () => setActiveSheet('content_prefs'),
        },
        {
          id: 'language',
          icon: Globe,
          title: 'Langue',
          value: 'Français (CI)',
          action: () => setActiveSheet('language'),
        },
        {
          id: 'display',
          icon: Moon,
          title: 'Mode sombre / Affichage',
          value: 'Sombre AMOLED',
          action: () => setActiveSheet('display'),
        },
      ],
    },
    {
      sectionKey: 'cache_cellulaire',
      title: 'CACHE ET CELLULAIRE',
      items: [
        {
          id: 'free_cache',
          icon: Trash2,
          title: 'Libérer de l\'espace',
          subtitle: 'Cache des vidéos produits et miniatures',
          action: () => setActiveSheet('free_cache'),
        },
        {
          id: 'data_saver',
          icon: Wifi,
          title: 'Économiseur de données',
          subtitle: 'Réduire l\'usage mobile 4G/3G',
          action: () => setActiveSheet('data_saver'),
        },
      ],
    },
    {
      sectionKey: 'assistance_conformite',
      title: 'ASSISTANCE ET CONFORMITÉ MARCHAND',
      items: [
        {
          id: 'report_problem',
          icon: AlertCircle,
          title: 'Signaler un problème commerçant',
          subtitle: 'Litige commande, paiement ou incident technique',
          action: () => setActiveSheet('report_problem'),
        },
        {
          id: 'help_center',
          icon: HelpCircle,
          title: 'Centre d\'aide Vendeur',
          subtitle: `Guide vendeur, commission fixe ${DJASSA_FIXED_COMMISSION_FCFA} F, expéditions`,
          action: () => setActiveSheet('help_center'),
        },
        {
          id: 'safety_center',
          icon: Shield,
          title: 'Centre de sécurité marchands',
          subtitle: 'Lutte anti-fraude et conformité des articles',
          action: () => setActiveSheet('safety_center'),
        },
        {
          id: 'terms_legal',
          icon: FileText,
          title: 'Conditions générales de vente & Mentions',
          subtitle: 'Contrat marchand officiel Djassa',
          action: () => setActiveSheet('terms'),
        },
      ],
    },
    {
      sectionKey: 'connexion',
      title: 'CONNEXION',
      items: [
        {
          id: 'switch_account',
          icon: Users,
          title: 'Changer de compte',
          subtitle: 'Basculer vers client ou administrateur',
          action: () => setActiveSheet('switch_account'),
        },
        {
          id: 'logout',
          icon: LogOut,
          title: 'Déconnexion',
          subtitle: `@${seller.username}`,
          action: () => setActiveSheet('logout_confirm'),
        },
      ],
    },
  ];

  // Filter sections by search query
  const filteredSections = sections
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((item) =>
        searchQuery.trim() === ''
          ? true
          : item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.subtitle && item.subtitle.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    }))
    .filter((sec) => sec.items.length > 0);

  return (
    <div
      id="seller-settings-and-privacy-view"
      className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
    >
      {/* 1. TIKTOK-STYLE TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-20 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/10 px-3 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            id="btn-back-seller-settings"
            onClick={onClose}
            className="p-1.5 -ml-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition active:scale-95"
            aria-label="Retour au profil boutique"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold text-white tracking-tight">
              Paramètres et confidentialité
            </h1>
            <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full bg-[#FF6321]/20 text-[#FF6321] border border-[#FF6321]/30">
              Vendeur
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            setIsSearchActive(!isSearchActive);
            if (isSearchActive) setSearchQuery('');
          }}
          className={`p-2 rounded-full transition active:scale-95 ${
            isSearchActive ? 'bg-[#FF6321] text-white' : 'hover:bg-white/10 text-white/80'
          }`}
          aria-label="Rechercher des paramètres"
          title="Rechercher des paramètres"
        >
          <Search className="w-4 h-4" />
        </button>
      </header>

      {/* 2. OPTIONAL EXPANDABLE SEARCH BAR */}
      {isSearchActive && (
        <div className="px-4 py-2.5 bg-[#141414] border-b border-white/10 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-white/40 absolute left-3 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un paramètre vendeur (email, mot de passe, sécurité, stock...)"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-white/40 outline-none focus:border-[#FF6321]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 p-1 text-white/40 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. SCROLLABLE SETTINGS CONTENT (TIKTOK GROUPED LISTS) */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-12">
        {filteredSections.length === 0 ? (
          <div className="p-8 text-center text-white/50 text-xs">
            Aucun paramètre correspondant à « {searchQuery} »
          </div>
        ) : (
          filteredSections.map((section) => (
            <section key={section.sectionKey} className="mt-4">
              {/* Section Header (Quiet uppercase TikTok style) */}
              <div className="px-4 py-1.5 text-[11px] font-bold text-white/40 tracking-wider">
                {section.title}
              </div>

              {/* Section Card / Rows */}
              <div className="bg-[#121212] border-t border-b border-white/5 divide-y divide-white/5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isLogout = item.id === 'logout';
                  return (
                    <button
                      key={item.id}
                      onClick={item.action}
                      className={`w-full px-4 py-3.5 flex items-center justify-between text-left transition hover:bg-white/[0.04] active:bg-white/[0.08] ${
                        isLogout ? 'text-red-400' : 'text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isLogout ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-white/80'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-semibold truncate ${isLogout ? 'text-red-400' : 'text-white'}`}>
                            {item.title}
                          </p>
                          {item.subtitle && (
                            <p className="text-[11px] text-white/50 truncate mt-0.5">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        {item.badge && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FF6321]/20 text-[#FF6321] border border-[#FF6321]/30">
                            {item.badge}
                          </span>
                        )}
                        {item.value && (
                          <span className="text-xs text-white/50 font-medium">
                            {item.value}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-white/30" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}

        {/* 4. FOOTER APP VERSION (TIKTOK STYLE) */}
        <div className="px-4 pt-8 pb-4 text-center space-y-1">
          <p className="text-[11px] font-semibold text-white/30">
            Djassa Vendeur Pro v35.4.0 (Build CI-Abidjan)
          </p>
          <p className="text-[10px] text-white/20">
            © 2026 Djassa Marketplace · Espace Commerçant Officiel
          </p>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* SUB-MODALS & FULL TIKTOK-STYLE SHEETS                                    */}
      {/* ========================================================================= */}

      {/* 1. COMPTE (PAGE COMPLÈTE STYLE TIKTOK COMME L'APPLICATION CLIENT AVEC INFORMATIONS, EMAIL, MOT DE PASSE, PASSKEYS, TÉLÉCHARGEMENT DONNÉES, DÉSACTIVATION) */}
      {activeSheet === 'account' && (
        <SellerAccountSettingsScreen
          seller={seller}
          onBack={() => setActiveSheet(null)}
          onSignOut={onSignOut}
        />
      )}

      {/* 2. E-MAIL ET COORDONNÉES */}
      {activeSheet === 'email_phone' && (
        <div className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
          <header className="sticky top-0 z-20 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/10 px-3 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveSheet(null)}
                className="p-1.5 -ml-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-base font-extrabold text-white">E-mail et Coordonnées</h2>
            </div>
            <button
              onClick={handleSaveEmailPhone}
              className="px-3.5 py-1.5 rounded-full bg-[#FF6321] text-xs font-bold text-white shadow-md shadow-orange-600/30"
            >
              Sauvegarder
            </button>
          </header>

          <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
            <form onSubmit={handleSaveEmailPhone} className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <span className="text-xs font-bold text-white block">Adresse E-mail du compte</span>
                <p className="text-[11px] text-white/50">
                  Cette adresse sert à la connexion, à la récupération de votre compte et aux notifications critiques.
                </p>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-white/40 absolute left-3" />
                  <input
                    type="email"
                    value={sellerEmail}
                    onChange={(e) => setSellerEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 p-3 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                    required
                  />
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Adresse e-mail vérifiée par Djassa</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <span className="text-xs font-bold text-white block">E-mail de facturation & Reçus</span>
                <p className="text-[11px] text-white/50">
                  Reçoit les bordereaux de commissions et les synthèses des virements Wave/Orange.
                </p>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-white/40 absolute left-3" />
                  <input
                    type="email"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 p-3 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <span className="text-xs font-bold text-white block">Numéro de téléphone principal</span>
                <p className="text-[11px] text-white/50">
                  Utilisé pour les alertes SMS 2FA et le contact direct des clients pour vos livraisons.
                </p>
                <div className="relative flex items-center">
                  <Phone className="w-4 h-4 text-white/40 absolute left-3" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 p-3 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-[#FF6321] text-white text-xs font-black shadow-lg shadow-orange-600/30 hover:bg-[#ff7538] transition"
              >
                Mettre à jour mes coordonnées
              </button>
            </form>
          </main>
        </div>
      )}

      {/* 3. MOT DE PASSE & CLÉ D'ACCÈS */}
      {activeSheet === 'password' && (
        <div className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
          <header className="sticky top-0 z-20 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/10 px-3 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveSheet(null)}
                className="p-1.5 -ml-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-base font-extrabold text-white">Mot de passe & Clé d'accès</h2>
            </div>
            <button
              onClick={handleSavePassword}
              className="px-3.5 py-1.5 rounded-full bg-[#FF6321] text-xs font-bold text-white shadow-md shadow-orange-600/30"
            >
              Valider
            </button>
          </header>

          <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
            <form onSubmit={handleSavePassword} className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <span className="text-xs font-bold text-white block">Modifier votre mot de passe</span>
                <p className="text-[11px] text-white/50">
                  Choisissez un mot de passe robuste combinant des lettres, des chiffres et des symboles.
                </p>

                <div>
                  <label className="text-[11px] text-white/60 block mb-1">Mot de passe actuel</label>
                  <div className="relative flex items-center">
                    <input
                      type={showOldPassword ? 'text' : 'password'}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 pr-10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-3 text-white/40 hover:text-white"
                    >
                      {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-white/60 block mb-1">Nouveau mot de passe</label>
                  <div className="relative flex items-center">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Au moins 6 caractères"
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 pr-10 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 text-white/40 hover:text-white"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-white/60 block mb-1">Confirmer le nouveau mot de passe</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Répétez le nouveau mot de passe"
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                    required
                  />
                </div>

                {/* Critères de validation */}
                <div className="pt-2 text-[10px] space-y-1 text-white/50">
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
                  className="w-full mt-2 py-3 rounded-2xl bg-[#FF6321] text-white text-xs font-black shadow-lg shadow-orange-600/30 hover:bg-[#ff7538] transition"
                >
                  Changer le mot de passe
                </button>
              </div>

              {/* Clé d'accès / Passkey / Biométrie */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0 mt-0.5">
                    <Fingerprint className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Clé d'accès biométrique (Passkey)</span>
                    <span className="text-[10px] text-white/50 block mt-0.5">
                      Connectez-vous instantanément avec Face ID, Touch ID ou le capteur d'empreinte sans taper votre mot de passe.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPasskeyEnabled(!passkeyEnabled);
                    showToast(passkeyEnabled ? 'Clé d\'accès désactivée.' : 'Face ID / Passkey configuré avec succès ! 🛡️');
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                    passkeyEnabled ? 'bg-cyan-400' : 'bg-white/20'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${passkeyEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="p-3 text-center">
                <button
                  type="button"
                  onClick={() => showToast(`Un lien de réinitialisation sécurisé a été envoyé par SMS au ${phone}. 📲`)}
                  className="text-xs text-[#FF6321] hover:underline font-bold"
                >
                  Mot de passe oublié ? Réinitialiser par SMS
                </button>
              </div>
            </form>
          </main>
        </div>
      )}

      {/* 4. CONFIDENTIALITÉ & VISIBILITÉ */}
      {activeSheet === 'privacy' && (
        <div className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
          <header className="sticky top-0 z-20 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/10 px-3 py-3 flex items-center">
            <button
              onClick={() => setActiveSheet(null)}
              className="p-1.5 -ml-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-base font-extrabold text-white ml-2">Confidentialité & Visibilité</h2>
          </header>

          <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">Stock visible en temps réel</span>
                <span className="text-[10px] text-white/50 block mt-0.5">
                  Affiche les quantités restantes aux acheteurs pour stimuler les commandes d'urgence.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsStockVisible(!isStockVisible);
                  showToast(isStockVisible ? 'Quantités de stock masquées.' : 'Stock affiché en temps réel.');
                }}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  isStockVisible ? 'bg-[#FF6321]' : 'bg-white/20'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${isStockVisible ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">Statut « En ligne » de la boutique</span>
                <span className="text-[10px] text-white/50 block mt-0.5">
                  Indique aux clients que vous répondez immédiatement aux messages et appels VOIP.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowOnlineStatus(!showOnlineStatus);
                  showToast(showOnlineStatus ? 'Statut en ligne désactivé.' : 'Statut en ligne visible.');
                }}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  showOnlineStatus ? 'bg-[#FF6321]' : 'bg-white/20'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${showOnlineStatus ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">Masquer le compteur de ventes totales</span>
                <span className="text-[10px] text-white/50 block mt-0.5">
                  Garde le volume d'affaires et nombre de ventes confidentiel.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHideSalesStats(!hideSalesStats);
                  showToast(hideSalesStats ? 'Chiffres de ventes affichés.' : 'Chiffres de ventes masqués.');
                }}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  hideSalesStats ? 'bg-[#FF6321]' : 'bg-white/20'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${hideSalesStats ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <span className="text-xs font-bold text-white block">Qui peut m'écrire en message direct ?</span>
              <div className="space-y-1.5 pt-1">
                {(['everyone', 'customers', 'nobody'] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      setAllowDirectMessages(opt);
                      showToast('Permission de message mise à jour.');
                    }}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition ${
                      allowDirectMessages === opt
                        ? 'border-[#FF6321] bg-[#FF6321]/15 text-white font-bold'
                        : 'border-white/5 bg-white/5 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    <span>
                      {opt === 'everyone' && 'Tout le monde (Recommandé pour maximiser les ventes)'}
                      {opt === 'customers' && 'Clients ayant déjà commandé uniquement'}
                      {opt === 'nobody' && 'Personne (Messagerie temporairement désactivée)'}
                    </span>
                    {allowDirectMessages === opt && <Check className="w-4 h-4 text-[#FF6321]" />}
                  </button>
                ))}
              </div>
            </div>
          </main>
        </div>
      )}

      {/* 5. SÉCURITÉ ET AUTORISATIONS (Complet style TikTok demandé) */}
      {activeSheet === 'security' && (
        <div className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
          <header className="sticky top-0 z-20 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/10 px-3 py-3 flex items-center">
            <button
              onClick={() => setActiveSheet(null)}
              className="p-1.5 -ml-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-base font-extrabold text-white ml-2">Sécurité et autorisations</h2>
          </header>

          <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
            {/* Banner Statut de Sécurité */}
            <div className="p-4 rounded-3xl bg-gradient-to-r from-emerald-500/20 via-teal-500/10 to-transparent border border-emerald-500/30 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-black text-white block">Votre boutique est parfaitement protégée</span>
                <p className="text-[10px] text-emerald-400 mt-0.5 font-medium">
                  Aucun incident ni tentative d'intrusion détectée · Analyse Djassa Shield active
                </p>
              </div>
            </div>

            {/* Identifiants & Mot de passe */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <span className="text-xs font-bold text-white block">Identifiants de sécurité</span>

              <div className="divide-y divide-white/5 text-xs">
                <div 
                  onClick={() => setActiveSheet('email_phone')}
                  className="py-2.5 flex items-center justify-between cursor-pointer hover:opacity-80 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <Mail className="w-4 h-4 text-[#FF6321]" />
                    <div>
                      <span className="text-white font-semibold block">E-mail du compte</span>
                      <span className="text-[10px] text-white/50">{sellerEmail}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-emerald-400 font-bold">Vérifié</span>
                    <ChevronRight className="w-4 h-4 text-white/30" />
                  </div>
                </div>

                <div 
                  onClick={() => setActiveSheet('email_phone')}
                  className="py-2.5 flex items-center justify-between cursor-pointer hover:opacity-80 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <Phone className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="text-white font-semibold block">Numéro de téléphone 2FA</span>
                      <span className="text-[10px] text-white/50">{phone}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/30" />
                </div>

                <div 
                  onClick={() => setActiveSheet('password')}
                  className="py-2.5 flex items-center justify-between cursor-pointer hover:opacity-80 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    <div>
                      <span className="text-white font-semibold block">Mot de passe</span>
                      <span className="text-[10px] text-white/50">•••••••••••• (Modifié récemment)</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/30" />
                </div>
              </div>
            </div>

            {/* 2FA Toggle & Méthode */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-white block">Vérification en deux étapes (2FA)</span>
                  <span className="text-[10px] text-white/50 block mt-0.5">
                    Exige un code de validation à chaque nouvelle connexion et pour chaque retrait.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTwoFactorAuth(!twoFactorAuth);
                    showToast(twoFactorAuth ? '2FA désactivé.' : 'Double authentification 2FA activée ! 🛡️');
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                    twoFactorAuth ? 'bg-[#FF6321]' : 'bg-white/20'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${twoFactorAuth ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {twoFactorAuth && (
                <div className="pt-2 border-t border-white/5 grid grid-cols-3 gap-2">
                  {[
                    { id: 'sms', label: 'SMS / Appel' },
                    { id: 'email', label: 'E-mail' },
                    { id: 'app', label: 'App Authenticator' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setTwoFactorMethod(m.id as any);
                        showToast(`Méthode 2FA : ${m.label}`);
                      }}
                      className={`py-2 px-1 rounded-xl text-[10px] font-bold border transition text-center ${
                        twoFactorMethod === m.id
                          ? 'border-[#FF6321] bg-[#FF6321]/20 text-white'
                          : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Code PIN Marchand */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Code PIN marchand secret</span>
                  <p className="text-[10px] text-white/50 mt-0.5">
                    Sécurise les retraits Mobile Money et la modification de vos comptes bancaires.
                  </p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FF6321]/20 text-[#FF6321] font-bold">
                  4 chiffres
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="password"
                  maxLength={4}
                  value={sellerPin}
                  onChange={(e) => setSellerPin(e.target.value.replace(/\D/g, ''))}
                  className="bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-center text-sm font-mono tracking-widest text-white w-28 focus:outline-none focus:border-[#FF6321]"
                />
                <button
                  onClick={() => showToast('Nouveau code PIN marchand enregistré ! 🔒')}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
                >
                  Mettre à jour le PIN
                </button>
              </div>
            </div>

            {/* Appareils connectés */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white block">Vos appareils connectés ({devices.length})</span>
                <span className="text-[10px] text-white/40">Gérer les sessions</span>
              </div>

              <div className="divide-y divide-white/5">
                {devices.map((d) => (
                  <div key={d.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      {d.type === 'phone' ? (
                        <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Laptop className="w-4 h-4 text-cyan-400 shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-bold">{d.name}</span>
                          {d.isCurrent && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                              Cet appareil
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-white/50">{d.location} · {d.ip}</p>
                        <p className="text-[9px] text-white/40">{d.active}</p>
                      </div>
                    </div>

                    {!d.isCurrent && (
                      <button
                        type="button"
                        onClick={() => handleDisconnectDevice(d.id, d.name)}
                        className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold border border-red-500/20 transition"
                      >
                        Déconnecter
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Enregistrer les infos de connexion */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">Enregistrer les infos de connexion</span>
                <span className="text-[10px] text-white/50 block mt-0.5">
                  Mémorise votre session pour éviter de retaper votre identifiant sur cet iPhone.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSaveLoginInfo(!saveLoginInfo);
                  showToast(saveLoginInfo ? 'Mémorisation désactivée.' : 'Identifiants mémorisés en toute sécurité.');
                }}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  saveLoginInfo ? 'bg-[#FF6321]' : 'bg-white/20'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${saveLoginInfo ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </main>
        </div>
      )}

      {/* 6. TÉLÉCHARGER LES DONNÉES DE LA BOUTIQUE */}
      {activeSheet === 'download_data' && (
        <div className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
          <header className="sticky top-0 z-20 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/10 px-3 py-3 flex items-center">
            <button
              onClick={() => setActiveSheet(null)}
              className="p-1.5 -ml-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-base font-extrabold text-white ml-2">Télécharger vos données</h2>
          </header>

          <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <span className="text-xs font-bold text-white block">Export officiel des données marchandes</span>
              <p className="text-[11px] text-white/60 leading-relaxed">
                Obtenez une copie complète de vos articles, prix, descriptions, historiques de commandes clients et bilans financiers.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <span className="text-xs font-bold text-white block">Sélectionner le format d'export</span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setDownloadFormat('json')}
                  className={`p-3 rounded-xl border text-left transition ${
                    downloadFormat === 'json'
                      ? 'border-[#FF6321] bg-[#FF6321]/15 text-white'
                      : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
                  }`}
                >
                  <b className="block text-sm font-bold">JSON</b>
                  <span className="text-[10px] text-white/50">Pour sauvegarde technique et développeurs</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDownloadFormat('csv')}
                  className={`p-3 rounded-xl border text-left transition ${
                    downloadFormat === 'csv'
                      ? 'border-[#FF6321] bg-[#FF6321]/15 text-white'
                      : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
                  }`}
                >
                  <b className="block text-sm font-bold">CSV / Excel</b>
                  <span className="text-[10px] text-white/50">Pour gestion comptable et tableur</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleExportData}
                disabled={isDownloadingData}
                className="w-full py-3 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white text-xs font-black shadow-lg shadow-orange-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{isDownloadingData ? 'Génération de l\'archive...' : `Télécharger les données (.${downloadFormat})`}</span>
              </button>
            </div>
          </main>
        </div>
      )}

      {/* 7. CODE QR DE LA BOUTIQUE */}
      {activeSheet === 'qrcode' && (
        <div className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
          <header className="sticky top-0 z-20 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/10 px-3 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveSheet(null)}
                className="p-1.5 -ml-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-base font-extrabold text-white">Code QR de la boutique</h2>
            </div>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(`https://djassa.ci/@${seller.username}`);
                showToast('Lien de la boutique copié ! 🔗');
              }}
              className="p-2 rounded-full hover:bg-white/10 text-white/80"
              title="Copier le lien"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </header>

          <main className="flex-1 overflow-y-auto no-scrollbar p-6 flex flex-col items-center justify-center text-center space-y-6">
            <div className="p-6 bg-white rounded-3xl shadow-2xl text-black flex flex-col items-center space-y-3 max-w-xs w-full">
              <div className="flex items-center gap-2">
                <img src={seller.avatar} alt={seller.name} className="w-10 h-10 rounded-full object-cover border-2 border-[#FF6321]" />
                <div className="text-left">
                  <h3 className="font-black text-sm text-neutral-900 leading-tight">{seller.name}</h3>
                  <p className="text-[11px] text-[#FF6321] font-bold">@{seller.username}</p>
                </div>
              </div>

              {/* QR Canvas / Illustration */}
              <div className="w-52 h-52 bg-neutral-100 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 p-3">
                <QrCode className="w-40 h-40 text-neutral-900" />
              </div>

              <p className="text-[11px] text-neutral-600 font-medium leading-tight">
                Scannez avec un smartphone pour ouvrir la boutique sur Djassa Côte d'Ivoire.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full max-w-xs">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(`https://djassa.ci/@${seller.username}`);
                  showToast('Lien copié dans le presse-papiers !');
                }}
                className="flex-1 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Copy className="w-4 h-4" />
                <span>Copier le lien</span>
              </button>

              <button
                onClick={() => {
                  const shareMsg = `Découvrez ma boutique officielle ${seller.name} sur Djassa : https://djassa.ci/@${seller.username}`;
                  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareMsg)}`, '_blank');
                }}
                className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-950/60 transition flex items-center justify-center gap-1.5"
              >
                <span>WhatsApp</span>
              </button>
            </div>
          </main>
        </div>
      )}

      {/* 8. COMMANDES & EXPÉDITIONS */}
      {activeSheet === 'orders' && (
        <div className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
          <header className="sticky top-0 z-20 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/10 px-3 py-3 flex items-center">
            <button
              onClick={() => setActiveSheet(null)}
              className="p-1.5 -ml-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-base font-extrabold text-white ml-2">Commandes & Expéditions</h2>
          </header>

          <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
                <span className="text-base font-black text-emerald-400 block">{confirmedOrdersCount}</span>
                <span className="text-[10px] text-white/50 font-bold block mt-0.5">Confirmées</span>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
                <span className="text-base font-black text-cyan-400 block">{paidOnlineCount}</span>
                <span className="text-[10px] text-white/50 font-bold block mt-0.5">En ligne</span>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
                <span className="text-base font-black text-amber-400 block">{codPendingCount}</span>
                <span className="text-[10px] text-white/50 font-bold block mt-0.5">À la livraison</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Règles d'expédition Djassa Marchand</h3>
              <ul className="text-[11px] text-white/70 space-y-2 leading-relaxed">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Préparation et coordination directe avec l'acheteur dès la commande confirmée.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Emballage soigné et reçu officiel Djassa généré automatiquement (0 F frais de livraison Djassa).</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>La boutique organise librement la remise ou l'expédition externe avec son client.</span>
                </li>
              </ul>
            </div>
          </main>
        </div>
      )}

      {/* 9. PORTEFEUILLE & REVERSEMENTS */}
      {activeSheet === 'wallet' && (
        <div className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
          <header className="sticky top-0 z-20 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/10 px-3 py-3 flex items-center">
            <button
              onClick={() => setActiveSheet(null)}
              className="p-1.5 -ml-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-base font-extrabold text-white ml-2">Portefeuille & Reversements</h2>
          </header>

          <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
            <div className="p-5 rounded-3xl bg-gradient-to-br from-[#FF6321]/20 via-[#181818] to-emerald-500/10 border border-[#FF6321]/30 space-y-2">
              <span className="text-xs text-white/60 font-semibold">Solde vendeur disponible</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-white tracking-tight">{formatFCFA(walletBalance)}</span>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Prêt au virement
                </span>
              </div>
              <p className="text-[10px] text-white/40">Commission fixe Djassa : {formatFCFA(DJASSA_FIXED_COMMISSION_FCFA)} par commande.</p>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3.5">
              <h3 className="text-xs font-bold text-white">Demander un virement immédiat</h3>

              <div>
                <label className="text-[11px] text-white/60 block mb-1">Moyen de paiement Mobile Money</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['wave', 'orange_money'] as const).map((prov) => (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => setWithdrawProvider(prov)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border text-center transition ${
                        withdrawProvider === prov
                          ? 'border-[#FF6321] bg-[#FF6321]/20 text-white'
                          : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
                      }`}
                    >
                      {prov === 'wave' ? 'Wave' : 'Orange Money'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] text-white/60 block mb-1">Numéro bénéficiaire</label>
                <input
                  type="tel"
                  value={withdrawPhone}
                  onChange={(e) => setWithdrawPhone(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                  placeholder="+225 07..."
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-white/60 block mb-1">Montant à retirer (FCFA)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    max={walletBalance}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                    placeholder={`Max ${walletBalance}`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setWithdrawAmount(String(walletBalance))}
                    className="px-3 rounded-xl bg-white/10 text-[10px] font-bold text-white/80 hover:text-white"
                  >
                    Tout
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#FF6321] hover:bg-[#ff7538] text-white text-xs font-black shadow-lg shadow-orange-600/30 transition active:scale-95"
              >
                Valider le retrait immédiat
              </button>
            </form>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Historique récent des virements</h3>
              <div className="divide-y divide-white/5">
                {withdrawalsHistory.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white block">{item.provider}</span>
                      <span className="text-[10px] text-white/40 block">{item.date}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-emerald-400 block">+{formatFCFA(item.amount)}</span>
                      <span className="text-[9px] text-white/50">{item.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>
      )}



      {/* 11. HORAIRES & STATUT DE LA BOUTIQUE */}
      {activeSheet === 'store_hours' && (
        <div className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
          <header className="sticky top-0 z-20 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/10 px-3 py-3 flex items-center">
            <button
              onClick={() => setActiveSheet(null)}
              className="p-1.5 -ml-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-base font-extrabold text-white ml-2">Horaires & Statut de la boutique</h2>
          </header>

          <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">Statut immédiat : {isStoreOpen ? 'Boutique Ouverte' : 'Boutique Fermée'}</span>
                <span className="text-[10px] text-white/50 block mt-0.5">
                  Quand vous fermez, les clients sont prévenus et les commandes sont programmées.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsStoreOpen(!isStoreOpen);
                  showToast(isStoreOpen ? 'Boutique fermée temporairement.' : 'Boutique ouverte sur Djassa ! 🔥');
                }}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  isStoreOpen ? 'bg-emerald-500' : 'bg-white/20'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${isStoreOpen ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">Mode congés / vacances</span>
                <span className="text-[10px] text-white/50 block mt-0.5">
                  Désactive temporairement le panier tout en gardant vos publications visibles.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setVacationMode(!vacationMode);
                  showToast(vacationMode ? 'Mode vacances désactivé.' : 'Mode vacances activé.');
                }}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  vacationMode ? 'bg-[#FF6321]' : 'bg-white/20'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${vacationMode ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <span className="text-xs font-bold text-white block">Créneaux d'ouverture habituels</span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[10px] text-white/50 block mb-1">Ouverture</label>
                  <input
                    type="time"
                    value={openTime}
                    onChange={(e) => setOpenTime(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-white/50 block mb-1">Fermeture</label>
                  <input
                    type="time"
                    value={closeTime}
                    onChange={(e) => setCloseTime(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                  />
                </div>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* 12. NOTIFICATIONS VENDEUR */}
      {activeSheet === 'notifications' && (
        <div className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
          <header className="sticky top-0 z-20 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/10 px-3 py-3 flex items-center">
            <button
              onClick={() => setActiveSheet(null)}
              className="p-1.5 -ml-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-base font-extrabold text-white ml-2">Notifications Vendeur</h2>
          </header>

          <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3.5">
            {[
              {
                title: 'Nouvelles commandes passées',
                sub: 'Alerte sonore et push instantané pour préparer le colis sans délai.',
                checked: notifNewOrders,
                set: setNotifNewOrders
              },
              {
                title: 'Confirmations de paiement en ligne',
                sub: 'Notification dès qu\'un reversement Wave ou Orange Money est validé.',
                checked: notifOrderUpdates,
                set: setNotifOrderUpdates
              },
              {
                title: 'Messages et questions acheteurs',
                sub: 'Alerte dès qu\'un client demande des détails sur une taille ou couleur.',
                checked: notifCustomerMessages,
                set: setNotifCustomerMessages
              },
              {
                title: 'Alerte de rupture de stock imminente',
                sub: 'Prévenu dès qu\'un article passe sous le seuil critique de 3 pièces.',
                checked: notifLowStock,
                set: setNotifLowStock
              },
            ].map((n, i) => (
              <div key={i} className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-white block">{n.title}</span>
                  <span className="text-[10px] text-white/50 block mt-0.5">{n.sub}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    n.set(!n.checked);
                    showToast('Préférence de notification mise à jour.');
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                    n.checked ? 'bg-[#FF6321]' : 'bg-white/20'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${n.checked ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            ))}
          </main>
        </div>
      )}

      {/* 13. FILTRE DE COMMENTAIRES & MODÉRATION */}
      {activeSheet === 'comments_filter' && (
        <div className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
          <header className="sticky top-0 z-20 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/10 px-3 py-3 flex items-center">
            <button
              onClick={() => setActiveSheet(null)}
              className="p-1.5 -ml-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-base font-extrabold text-white ml-2">Filtre des commentaires</h2>
          </header>

          <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">Filtrage automatique des injures et arnaques</span>
                <span className="text-[10px] text-white/50 block mt-0.5">
                  Masque instantanément les messages insultants et tentatives d'hameçonnage sous vos vidéos.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAutoFilterProfanity(!autoFilterProfanity);
                  showToast(autoFilterProfanity ? 'Modération automatique coupée.' : 'Modération automatique active.');
                }}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  autoFilterProfanity ? 'bg-[#FF6321]' : 'bg-white/20'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${autoFilterProfanity ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <span className="text-xs font-bold text-white block">Mots-clés interdits personnalisés</span>
              <p className="text-[10px] text-white/50 leading-relaxed">
                Les commentaires contenant ces termes seront automatiquement cachés du public.
              </p>

              <form onSubmit={handleAddKeyword} className="flex gap-2">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Ajouter un mot (ex: voleur, brouteur...)"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-[#FF6321] text-xs font-bold text-white hover:bg-[#ff7538] transition"
                >
                  Ajouter
                </button>
              </form>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {customKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-xs text-white"
                  >
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(kw)}
                      className="text-white/40 hover:text-rose-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </main>
        </div>
      )}

      {/* 14. PRÉFÉRENCES DE PUBLICATION */}
      {activeSheet === 'content_prefs' && (
        <div className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
          <header className="sticky top-0 z-20 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/10 px-3 py-3 flex items-center">
            <button
              onClick={() => setActiveSheet(null)}
              className="p-1.5 -ml-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-base font-extrabold text-white ml-2">Préférences de publication</h2>
          </header>

          <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3.5">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">Mise en ligne vidéo haute définition (HD 1080p)</span>
                <span className="text-[10px] text-white/50 block mt-0.5">
                  Garde une netteté maximale sur les tissus, coutures et détails vestimentaires.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setVideoHdUpload(!videoHdUpload);
                  showToast(videoHdUpload ? 'Qualité standard activée.' : 'Haute Définition 1080p activée.');
                }}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  videoHdUpload ? 'bg-[#FF6321]' : 'bg-white/20'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${videoHdUpload ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-white block">Filigrane officiel Djassa Marketplace</span>
                <span className="text-[10px] text-white/50 block mt-0.5">
                  Appose automatiquement le logo certifié Djassa sur vos créations pour protéger votre droit d'auteur.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setWatermarkDjassa(!watermarkDjassa);
                  showToast(watermarkDjassa ? 'Filigrane désactivé.' : 'Filigrane protecteur activé.');
                }}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                  watermarkDjassa ? 'bg-[#FF6321]' : 'bg-white/20'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${watermarkDjassa ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </main>
        </div>
      )}

      {/* 15. LANGUE */}
      {activeSheet === 'language' && (
        <LanguageSettingsScreen onBack={() => setActiveSheet(null)} />
      )}

      {/* 16. DISPLAY / MODE SOMBRE */}
      {activeSheet === 'display' && (
        <DisplaySettingsScreen onBack={() => setActiveSheet(null)} />
      )}

      {/* 17. LIBÉRER DE L'ESPACE */}
      {activeSheet === 'free_cache' && (
        <FreeUpSpaceSettingsScreen onBack={() => setActiveSheet(null)} />
      )}

      {/* 18. ÉCONOMISEUR DE DONNÉES */}
      {activeSheet === 'data_saver' && (
        <DataSaverSettingsScreen onBack={() => setActiveSheet(null)} />
      )}

      {/* 19. SIGNALER UN PROBLÈME COMMERÇANT */}
      {activeSheet === 'report_problem' && (
        <div className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
          <header className="sticky top-0 z-20 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/10 px-3 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveSheet(null)}
                className="p-1.5 -ml-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <h2 className="text-base font-extrabold text-white">Signaler un problème commerçant</h2>
            </div>
            <button
              onClick={handleReportSubmit}
              className="px-3.5 py-1.5 rounded-full bg-[#FF6321] text-xs font-bold text-white shadow-md shadow-orange-600/30"
            >
              Envoyer
            </button>
          </header>

          <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
            <form onSubmit={handleReportSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">Motif de l'incident</label>
                <select
                  value={reportSubject}
                  onChange={(e) => setReportSubject(e.target.value)}
                  className="w-full bg-[#181818] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#FF6321]"
                >
                  <option value="Commande & Expédition">Commande & Expédition (adresse client, remise, colis)</option>
                  <option value="Litige Client">Litige Client (contestation de conformité)</option>
                  <option value="Reversement Mobile Money">Reversement Wave / Orange Money non reçu</option>
                  <option value="Stock & Boutique">Bug technique sur la boutique / ajout produit</option>
                  <option value="Autre incident">Autre demande spécifique au support marchand</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">Description détaillée</label>
                <textarea
                  rows={5}
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#FF6321] resize-none"
                  placeholder="Décrivez précisément votre problème (référence commande, n° téléphone concerné...)"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-[#FF6321] hover:bg-[#ff7538] text-white text-xs font-black shadow-lg shadow-orange-600/30 transition"
              >
                Transmettre l'incident au support
              </button>
            </form>
          </main>
        </div>
      )}

      {/* 20. CENTRE D'AIDE MARCHAND (FAQ) */}
      {activeSheet === 'help_center' && (
        <div className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
          <header className="sticky top-0 z-20 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/10 px-3 py-3 flex items-center">
            <button
              onClick={() => setActiveSheet(null)}
              className="p-1.5 -ml-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-base font-extrabold text-white ml-2">Centre d'aide Vendeur</h2>
          </header>

          <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3.5">
            {[
              {
                q: 'Quand mes gains sont-ils disponibles ?',
                a: `Sur les commandes payées en ligne (Wave / Orange Money), le montant net (après prélèvement de la commission fixe de ${DJASSA_FIXED_COMMISSION_FCFA} FCFA par commande) est reversé directement sur votre compte configuré dès confirmation du paiement.`
              },
              {
                q: 'Comment s\'organise la livraison de mes commandes ?',
                a: 'Le vendeur organise librement la livraison avec son client à l\'extérieur de Djassa (0 F frais de livraison Djassa), à l\'aide des coordonnées et de l\'adresse indiquées sur le reçu.'
              },
              {
                q: 'Comment fonctionne le paiement à la livraison ?',
                a: 'Aucun frais de service en ligne n\'est facturé au client. Vous encaissez le client directement à la remise du colis, puis la commission fixe de 150 FCFA est régularisée auprès de Djassa.'
              },
              {
                q: 'Comment modifier mon mot de passe ou sécuriser mon compte ?',
                a: 'Dans les paramètres de la boutique, accédez à « Sécurité et autorisations » ou « Mot de passe » pour changer vos identifiants ou activer la double authentification par SMS.'
              },
              {
                q: 'Comment booster mes articles pour être en tête du flux vidéo ?',
                a: 'Utilisez le bouton « Booster » sous chaque publication pour lancer une campagne sponsorisée Djassa Ads ciblée sur les communes de Cocody, Yopougon ou Marcory.'
              }
            ].map((faq, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="text-[#FF6321]">Q.</span> {faq.q}
                </h4>
                <p className="text-[11px] text-white/60 leading-relaxed pl-4">
                  {faq.a}
                </p>
              </div>
            ))}
          </main>
        </div>
      )}

      {/* 21. SÉCURITÉ MARCHANDS */}
      {activeSheet === 'safety_center' && (
        <SafetyCenterSettingsScreen onBack={() => setActiveSheet(null)} />
      )}

      {/* 22. CONDITIONS GÉNÉRALES MARCHANDS */}
      {activeSheet === 'terms' && (
        <TermsSettingsScreen onBack={() => setActiveSheet(null)} />
      )}

      {/* 23. CHANGER DE COMPTE */}
      {activeSheet === 'switch_account' && (
        <SwitchAccountSettingsScreen
          onBack={() => setActiveSheet(null)}
          onCloseSettings={onClose}
        />
      )}

      {/* 24. MODAL CONFIRMATION DÉCONNEXION */}
      {activeSheet === 'logout_confirm' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#141414] border border-white/10 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-red-500/10 text-red-400">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Déconnexion de la boutique</h3>
                <p className="text-[11px] text-white/50">@{seller.username}</p>
              </div>
            </div>

            <p className="text-xs text-white/60 leading-relaxed">
              Êtes-vous certain de vouloir vous déconnecter de votre espace vendeur ? Vos commandes et articles restent sécurisés sur Djassa.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveSheet(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveSheet(null);
                  onClose();
                  onSignOut();
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-xs font-black text-white shadow-lg shadow-red-600/30 transition"
              >
                Me déconnecter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
