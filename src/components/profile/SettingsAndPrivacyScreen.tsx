import React, { useMemo, useState } from 'react';
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
  X,
  Shield,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AccountSettingsScreen } from './AccountSettingsScreen';
import { PrivacySettingsScreen } from './settings/PrivacySettingsScreen';
import { SecuritySettingsScreen } from './settings/SecuritySettingsScreen';
import { QrCodeSettingsScreen } from './settings/QrCodeSettingsScreen';
import { OrdersSettingsScreen } from './settings/OrdersSettingsScreen';
import { NotificationsSettingsScreen } from './settings/NotificationsSettingsScreen';
import { ScreenTimeSettingsScreen } from './settings/ScreenTimeSettingsScreen';
import { ContentPreferencesSettingsScreen } from './settings/ContentPreferencesSettingsScreen';
import { LanguageSettingsScreen } from './settings/LanguageSettingsScreen';
import { DisplaySettingsScreen } from './settings/DisplaySettingsScreen';
import { FreeUpSpaceSettingsScreen } from './settings/FreeUpSpaceSettingsScreen';
import { DataSaverSettingsScreen } from './settings/DataSaverSettingsScreen';
import { ReportProblemSettingsScreen } from './settings/ReportProblemSettingsScreen';
import { HelpCenterSettingsScreen } from './settings/HelpCenterSettingsScreen';
import { SafetyCenterSettingsScreen } from './settings/SafetyCenterSettingsScreen';
import { TermsSettingsScreen } from './settings/TermsSettingsScreen';
import { SwitchAccountSettingsScreen } from './settings/SwitchAccountSettingsScreen';

interface SettingsAndPrivacyScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateHistory?: () => void;
  onNavigatePurchases?: () => void;
  onNavigatePurchasedProducts?: () => void;
  onOpenActivity?: () => void;
}

function measureLocalStorageCacheMb(): number {
  if (typeof window === 'undefined') return 0;
  let bytes = 0;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('djassa_cache_')) {
        const val = window.localStorage.getItem(key) || '';
        bytes += (key.length + val.length) * 2;
      }
    }
  } catch {
    return 0;
  }
  return Number((bytes / (1024 * 1024)).toFixed(2));
}

export const SettingsAndPrivacyScreen: React.FC<SettingsAndPrivacyScreenProps> = ({
  isOpen,
  onClose,
  onNavigateHistory,
  onNavigatePurchases,
  onNavigatePurchasedProducts,
}) => {
  const {
    userProfile,
    orders,
    signOut,
    clientPreferences,
    activeUserSessions,
    supportTickets,
    isAuthenticated,
    openAuthModal,
    requireAuth
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);

  const [activeSheet, setActiveSheet] = useState<
    | null
    | 'account'
    | 'privacy'
    | 'security'
    | 'qrcode'
    | 'orders'
    | 'notifications'
    | 'screen_time'
    | 'content_prefs'
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
  >(null);

  const cacheSizeMb = useMemo(() => measureLocalStorageCacheMb(), [activeSheet, isOpen]);

  if (!isOpen) return null;

  const deliveredOrdersCount = orders.filter((o) => o.status === 'delivered').length;
  const inProgressOrdersCount = orders.filter((o) => o.status !== 'delivered').length;
  const weekMinutesTotal = Object.values(clientPreferences.screenTime.dailyUsageMinutes || {}).reduce(
    (sum, val) => sum + (Number(val) || 0),
    0
  );

  const languageLabels: Record<string, string> = {
    'fr-CI': 'Français (CI)',
    'fr-FR': 'Français',
    'en-US': 'English',
  };

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
          subtitle: isAuthenticated ? 'Informations, e-mail, téléphone' : 'Connectez-vous pour gérer votre compte',
          action: () => {
            if (!requireAuth('account', { type: 'open_profile' })) return;
            setActiveSheet('account');
          },
        },
        {
          id: 'privacy',
          icon: Lock,
          title: 'Confidentialité',
          subtitle: clientPreferences.privacy.privateAccount ? 'Compte privé' : 'Public',
          action: () => {
            if (!requireAuth('account', { type: 'open_profile' })) return;
            setActiveSheet('privacy');
          },
        },
        {
          id: 'security',
          icon: ShieldCheck,
          title: 'Sécurité et autorisations',
          subtitle: isAuthenticated ? `${activeUserSessions.length || 1} session(s) active(s)` : 'Session visiteur locale',
          action: () => {
            if (!requireAuth('account', { type: 'open_profile' })) return;
            setActiveSheet('security');
          },
        },
        {
          id: 'qrcode',
          icon: QrCode,
          title: 'Code QR et profil',
          subtitle: 'Partager le lien du profil',
          action: () => {
            if (!requireAuth('account', { type: 'open_profile' })) return;
            setActiveSheet('qrcode');
          },
        },
        {
          id: 'orders_purchases',
          icon: ShoppingBag,
          title: 'Commandes et achats',
          subtitle: isAuthenticated
            ? `${deliveredOrdersCount} livré(s) · ${inProgressOrdersCount} en cours`
            : 'Connectez-vous pour suivre vos commandes',
          badge: isAuthenticated && inProgressOrdersCount > 0 ? `${inProgressOrdersCount} en cours` : undefined,
          action: () => {
            if (!requireAuth('orders', { type: 'open_orders' })) return;
            setActiveSheet('orders');
          },
        },
      ],
    },
    {
      sectionKey: 'content_display',
      title: 'CONTENU ET AFFICHAGE',
      items: [
        {
          id: 'notifications',
          icon: Bell,
          title: 'Notifications',
          subtitle: clientPreferences.notifications.pushEnabled ? 'Notifications activées' : 'Notifications désactivées',
          action: () => setActiveSheet('notifications'),
        },
        {
          id: 'screen_time',
          icon: Clock,
          title: 'Temps d\'écran',
          subtitle: `${weekMinutesTotal} min enregistrées`,
          action: () => setActiveSheet('screen_time'),
        },
        {
          id: 'content_prefs',
          icon: Sliders,
          title: 'Préférences de contenu',
          subtitle: 'Mots-clés, centres d\'intérêt',
          action: () => setActiveSheet('content_prefs'),
        },
        {
          id: 'language',
          icon: Globe,
          title: 'Langue',
          value: languageLabels[clientPreferences.language] || clientPreferences.language || 'Français',
          action: () => setActiveSheet('language'),
        },
        {
          id: 'display',
          icon: Moon,
          title: 'Mode sombre / Affichage',
          value: clientPreferences.display.theme === 'light' ? 'Clair' : 'Sombre',
          action: () => setActiveSheet('display'),
        },
      ],
    },
    {
      sectionKey: 'cache_data',
      title: 'CACHE ET CELLULAIRE',
      items: [
        {
          id: 'free_cache',
          icon: Trash2,
          title: 'Libérer de l\'espace',
          value: `${cacheSizeMb.toFixed(2)} Mo`,
          action: () => setActiveSheet('free_cache'),
        },
        {
          id: 'data_saver',
          icon: Wifi,
          title: 'Économiseur de données',
          value: clientPreferences.dataSaver.enabled ? 'Activé' : 'Désactivé',
          action: () => setActiveSheet('data_saver'),
        },
      ],
    },
    {
      sectionKey: 'support_about',
      title: 'ASSISTANCE ET À PROPOS',
      items: [
        {
          id: 'report_problem',
          icon: AlertCircle,
          title: 'Signaler un problème',
          subtitle: isAuthenticated && supportTickets.length > 0 ? `${supportTickets.length} ticket(s) ouvert(s)` : 'Aide commandes, livraison, bug',
          action: () => {
            if (!requireAuth('account')) return;
            setActiveSheet('report_problem');
          },
        },
        {
          id: 'help_center',
          icon: HelpCircle,
          title: 'Centre d\'aide',
          subtitle: 'FAQ, appel support, chat direct',
          action: () => setActiveSheet('help_center'),
        },
        {
          id: 'safety_center',
          icon: Shield,
          title: 'Centre de sécurité',
          subtitle: 'Règles communautaires Djassa',
          action: () => setActiveSheet('safety_center'),
        },
        {
          id: 'terms_legal',
          icon: FileText,
          title: 'Conditions d\'utilisation',
          subtitle: 'Politique de confidentialité',
          action: () => setActiveSheet('terms'),
        },
      ],
    },
    {
      sectionKey: 'login',
      title: 'CONNEXION',
      items: isAuthenticated
        ? [
            {
              id: 'switch_account',
              icon: Users,
              title: 'Changer de compte',
              subtitle: 'Basculer ou associer un profil',
              action: () => setActiveSheet('switch_account'),
            },
            {
              id: 'logout',
              icon: LogOut,
              title: 'Déconnexion',
              subtitle: `@${userProfile.username}`,
              action: () => setActiveSheet('logout_confirm'),
            },
          ]
        : [
            {
              id: 'visitor_register',
              icon: User,
              title: 'Créer un compte DJASSA',
              subtitle: 'Sauvegardez vos favoris, panier et discussions',
              action: () => {
                onClose();
                openAuthModal('account', {
                  initialMode: 'register',
                  directToAuthForm: true,
                  pendingAction: { type: 'open_profile' }
                });
              },
            },
            {
              id: 'switch_account',
              icon: Users,
              title: 'Se connecter à un compte',
              subtitle: 'Client, Vendeur ou Administrateur',
              action: () => {
                onClose();
                openAuthModal('account', {
                  initialMode: 'login',
                  directToAuthForm: true,
                  pendingAction: { type: 'open_profile' }
                });
              },
            },
          ],
    },
  ];

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
      id="settings-and-privacy-view"
      className="fixed inset-0 z-50 bg-[#000000] text-white flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
    >
      {/* TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-20 bg-[#0F0F0F]/95 backdrop-blur-md border-b border-white/10 px-3 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            id="btn-back-settings"
            onClick={onClose}
            className="p-1.5 -ml-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition active:scale-95"
            aria-label="Retour au profil"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-base font-extrabold text-white tracking-tight">
            Paramètres et confidentialité
          </h1>
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

      {/* SEARCH BAR */}
      {isSearchActive && (
        <div className="px-4 py-2.5 bg-[#141414] border-b border-white/10 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-white/40 absolute left-3 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un paramètre (sécurité, langue...)"
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

      {/* SETTINGS LISTS */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-12">
        {filteredSections.length === 0 ? (
          <div className="p-8 text-center text-white/50 text-xs">
            Aucun paramètre correspondant à « {searchQuery} »
          </div>
        ) : (
          filteredSections.map((section) => (
            <section key={section.sectionKey} className="mt-4">
              <div className="px-4 py-1.5 text-[11px] font-bold text-white/40 tracking-wider">
                {section.title}
              </div>

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

        <div className="px-4 pt-8 pb-4 text-center space-y-1">
          <p className="text-[11px] font-semibold text-white/30">
            Djassa Marketplace · Côte d'Ivoire
          </p>
          <p className="text-[10px] text-white/20">
            © 2026 Djassa Marketplace · Tous droits réservés
          </p>
        </div>
      </main>

      {activeSheet === 'account' && (
        <AccountSettingsScreen onBack={() => setActiveSheet(null)} />
      )}

      {activeSheet === 'privacy' && (
        <PrivacySettingsScreen onBack={() => setActiveSheet(null)} />
      )}

      {activeSheet === 'security' && (
        <SecuritySettingsScreen onBack={() => setActiveSheet(null)} />
      )}

      {activeSheet === 'qrcode' && (
        <QrCodeSettingsScreen onBack={() => setActiveSheet(null)} />
      )}

      {activeSheet === 'orders' && (
        <OrdersSettingsScreen
          onBack={() => setActiveSheet(null)}
          onNavigateHistory={() => {
            setActiveSheet(null);
            onClose();
            if (onNavigateHistory) onNavigateHistory();
          }}
          onNavigatePurchases={() => {
            setActiveSheet(null);
            onClose();
            if (onNavigatePurchases) onNavigatePurchases();
          }}
          onNavigatePurchasedProducts={() => {
            setActiveSheet(null);
            onClose();
            if (onNavigatePurchasedProducts) onNavigatePurchasedProducts();
          }}
        />
      )}

      {activeSheet === 'notifications' && (
        <NotificationsSettingsScreen onBack={() => setActiveSheet(null)} />
      )}

      {activeSheet === 'screen_time' && (
        <ScreenTimeSettingsScreen onBack={() => setActiveSheet(null)} />
      )}

      {activeSheet === 'content_prefs' && (
        <ContentPreferencesSettingsScreen onBack={() => setActiveSheet(null)} />
      )}

      {activeSheet === 'language' && (
        <LanguageSettingsScreen onBack={() => setActiveSheet(null)} />
      )}

      {activeSheet === 'display' && (
        <DisplaySettingsScreen onBack={() => setActiveSheet(null)} />
      )}

      {activeSheet === 'free_cache' && (
        <FreeUpSpaceSettingsScreen onBack={() => setActiveSheet(null)} />
      )}

      {activeSheet === 'data_saver' && (
        <DataSaverSettingsScreen onBack={() => setActiveSheet(null)} />
      )}

      {activeSheet === 'report_problem' && (
        <ReportProblemSettingsScreen onBack={() => setActiveSheet(null)} />
      )}

      {activeSheet === 'help_center' && (
        <HelpCenterSettingsScreen
          onBack={() => setActiveSheet(null)}
          onNavigateToMessages={() => {
            setActiveSheet(null);
            onClose();
          }}
        />
      )}

      {activeSheet === 'safety_center' && (
        <SafetyCenterSettingsScreen onBack={() => setActiveSheet(null)} />
      )}

      {activeSheet === 'terms' && (
        <TermsSettingsScreen onBack={() => setActiveSheet(null)} />
      )}

      {activeSheet === 'switch_account' && (
        <SwitchAccountSettingsScreen onBack={() => setActiveSheet(null)} onCloseSettings={onClose} />
      )}

      {activeSheet === 'logout_confirm' && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end p-4 animate-fadeIn"
          onClick={() => setActiveSheet(null)}
        >
          <div
            className="w-full max-w-sm mx-auto bg-[#181818] rounded-3xl border border-white/10 p-5 space-y-4 shadow-2xl animate-slideUp text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
              <LogOut className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Déconnexion</h3>
              <p className="text-xs text-white/60 mt-1">
                Voulez-vous vraiment vous déconnecter de votre compte <span className="text-white font-semibold">@{userProfile.username}</span> ?
              </p>
            </div>

            <div className="flex gap-2 pt-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveSheet(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white transition active:scale-95"
              >
                Annuler
              </button>
              <button
                type="button"
                id="btn-confirm-logout-tiktok"
                onClick={() => {
                  setActiveSheet(null);
                  onClose();
                  void signOut();
                }}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 transition active:scale-95"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
