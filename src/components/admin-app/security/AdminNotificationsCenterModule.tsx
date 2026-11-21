import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Ban,
  Bell,
  BellOff,
  Building2,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Code2,
  CreditCard,
  ExternalLink,
  Filter,
  History,
  Lock,
  Mail,
  Megaphone,
  MessageSquarePlus,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShoppingBag,
  Sliders,
  Smartphone,
  Store,
  Truck,
  UserCog,
  Users,
  Wallet,
  Wifi,
  WifiOff,
  X
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { AdminTabType } from '../../../types';
import { getActiveSecurityActorId, securityService, type SecurityApiError } from '../../../services/securityService';
import type {
  ActivitySpace,
  AdminNotificationCategory,
  AdminNotificationChannel,
  AdminNotificationDetailResponse,
  AdminNotificationPageResponse,
  AdminNotificationPreferences,
  AdminNotificationPriority,
  AdminNotificationRecord,
  AdminNotificationStatus,
  NotificationChannelsStatus,
  SecurityRole
} from '../../../types/security';
import { SecurityTargetHistoryModal } from './SecurityTargetHistoryModal';

interface AdminNotificationsCenterModuleProps {
  onNavigateTab?: (tab: AdminTabType) => void;
  onOpenAuditSubTab?: () => void;
  onUnreadCountChange?: (count: number) => void;
}

const CATEGORY_META: Record<
  AdminNotificationCategory,
  { label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }
> = {
  securite: { label: 'Sécurité et surveillance', shortLabel: 'Sécurité', icon: ShieldAlert },
  comptes: { label: 'Gestion des comptes', shortLabel: 'Comptes', icon: Users },
  commandes: { label: 'Commandes', shortLabel: 'Commandes', icon: ShoppingBag },
  paiements: { label: 'Paiements', shortLabel: 'Paiements', icon: CreditCard },
  retraits: { label: 'Retraits et portefeuilles', shortLabel: 'Retraits', icon: Wallet },
  livraisons: { label: 'Livraisons', shortLabel: 'Livraisons', icon: Truck },
  vendeurs: { label: 'Vendeurs', shortLabel: 'Vendeurs', icon: Store },
  livreurs: { label: 'Livreurs', shortLabel: 'Livreurs', icon: Truck },
  entreprises: { label: 'Entreprises de livraison', shortLabel: 'Entreprises', icon: Building2 },
  equipe_admin: { label: 'Équipe administrative', shortLabel: 'Équipe Admin', icon: UserCog },
  api: { label: 'Fournisseurs API', shortLabel: 'API', icon: Code2 },
  infrastructure: { label: 'Infrastructure et système', shortLabel: 'Système', icon: Server },
  publicite: { label: 'Publicité et promotions', shortLabel: 'Publicité', icon: Megaphone }
};

const ALL_CATEGORIES: AdminNotificationCategory[] = [
  'securite',
  'comptes',
  'commandes',
  'paiements',
  'retraits',
  'livraisons',
  'vendeurs',
  'livreurs',
  'entreprises',
  'equipe_admin',
  'api',
  'infrastructure',
  'publicite'
];

const PRIORITY_META: Record<
  AdminNotificationPriority,
  { label: string; badgeClass: string; dotClass: string; borderClass: string }
> = {
  critique: {
    label: 'Critique',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/35',
    dotClass: 'bg-rose-500',
    borderClass: 'border-l-2 border-l-rose-500'
  },
  eleve: {
    label: 'Élevé',
    badgeClass: 'bg-orange-500/15 text-orange-400 border-orange-500/35',
    dotClass: 'bg-orange-400',
    borderClass: 'border-l-2 border-l-orange-400'
  },
  moyen: {
    label: 'Moyen',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    dotClass: 'bg-amber-400',
    borderClass: 'border-l-2 border-l-amber-400'
  },
  information: {
    label: 'Information',
    badgeClass: 'bg-white/10 text-white/70 border-white/15',
    dotClass: 'bg-sky-400',
    borderClass: 'border-l-2 border-l-white/20'
  }
};

const STATUS_META: Record<AdminNotificationStatus, { label: string; cls: string }> = {
  nouvelle: { label: 'Nouvelle', cls: 'bg-[#FF6321]/15 text-[#FF6321] border-[#FF6321]/30' },
  en_cours: { label: 'En cours', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  resolue: { label: 'Résolue', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  escaladee: { label: 'Escaladée Super Admin', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40' }
};

const SPACE_LABELS: Record<ActivitySpace, string> = {
  client: 'Client',
  seller: 'Vendeur',
  driver: 'Livreur',
  company: 'Entreprise de livraison',
  admin: 'Administrateur',
  system: 'Système / Backend'
};

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return iso;
  }
}

function formatShortDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

export const AdminNotificationsCenterModule: React.FC<AdminNotificationsCenterModuleProps> = ({
  onNavigateTab,
  onOpenAuditSubTab,
  onUnreadCountChange
}) => {
  const { showToast } = useApp();

  // Feed & query state
  const [data, setData] = useState<AdminNotificationPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [streamStatus, setStreamStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'unread' | 'pending' | 'archived'>('all');
  const [categoryFilter, setCategoryFilter] = useState<AdminNotificationCategory | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<AdminNotificationPriority | 'all'>('all');
  const [spaceFilter, setSpaceFilter] = useState<ActivitySpace | 'all'>('all');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [page, setPage] = useState(1);

  // Detail & workflow modals
  const [selectedNotifId, setSelectedNotifId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<AdminNotificationDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [escalateReason, setEscalateReason] = useState('');
  const [showEscalateBox, setShowEscalateBox] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  // Protection inline confirmation modal
  const [protectionModal, setProtectionModal] = useState<{
    type: 'revoke_sessions' | 'block_withdrawals' | 'suspend_account';
    target: string;
    targetId?: string;
    space?: ActivitySpace;
  } | null>(null);
  const [protectionReason, setProtectionReason] = useState('');

  // Target account history inspection modal
  const [inspectTarget, setInspectTarget] = useState<string | null>(null);

  // Preferences & channels drawer
  const [showPrefsModal, setShowPrefsModal] = useState(false);
  const [prefs, setPrefs] = useState<AdminNotificationPreferences | null>(null);
  const [prefsRole, setPrefsRole] = useState<SecurityRole>('admin');
  const [criticalLocked, setCriticalLocked] = useState(true);
  const [channelsStatus, setChannelsStatus] = useState<NotificationChannelsStatus | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? window.Notification.permission : 'unsupported'
  );

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
      setPage(1);
    }, 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchNotifications = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await securityService.getAdminNotifications({
          q: debouncedQuery || undefined,
          category: categoryFilter,
          priority: priorityFilter,
          space: spaceFilter,
          status: viewMode === 'pending' ? 'pending' : 'all',
          unreadOnly: viewMode === 'unread',
          archived: viewMode === 'archived' ? 'true' : 'false',
          page,
          limit: 20
        });
        setData(res);
        onUnreadCountChange?.(res.kpis.unreadCount);
      } catch (err: unknown) {
        const apiErr = err as SecurityApiError;
        if (!silent) {
          showToast(apiErr?.message || 'Impossible de charger les notifications.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [debouncedQuery, categoryFilter, priorityFilter, spaceFilter, viewMode, page, showToast, onUnreadCountChange]
  );

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  // Ref to read latest selected notification ID inside WS handler without reconnecting
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedNotifId;
  const fetchRef = useRef(fetchNotifications);
  fetchRef.current = fetchNotifications;

  // Browser local notification trigger (only if granted & SW registered, strictly sanitized payload)
  const triggerLocalBrowserPushIfAllowed = useCallback((notif: AdminNotificationRecord) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (window.Notification.permission !== 'granted') return;
    if (notif.priority !== 'critique' && notif.priority !== 'eleve') return;
    const catLabel = CATEGORY_META[notif.category]?.shortLabel || notif.category;
    const title = `DJASSA [${PRIORITY_META[notif.priority].label.toUpperCase()}] • ${catLabel}`;
    const body = `Nouvel événement ${catLabel} (${notif.id}). Ouvrez DJASSA Admin pour consulter.`;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => {
          void reg.showNotification(title, {
            body,
            tag: notif.id,
            renotify: notif.priority === 'critique',
            data: { notificationId: notif.id, url: '/' }
          } as NotificationOptions);
        })
        .catch(() => {
          // ignore
        });
    }
  }, []);

  // Real-time WebSocket stream subscription & cross-device sync
  useEffect(() => {
    const disconnect = securityService.connectAdminNotificationStream(
      (event) => {
        if (event.type === 'notification:created' && event.notification) {
          triggerLocalBrowserPushIfAllowed(event.notification);
          void fetchRef.current(true);
        } else if (
          event.type === 'notification:updated' ||
          event.type === 'notification:read_all' ||
          event.type === 'notification:prefs_updated'
        ) {
          void fetchRef.current(true);
          if (selectedIdRef.current && event.notification?.id === selectedIdRef.current) {
            void securityService
              .getAdminNotificationDetail(selectedIdRef.current)
              .then((res) => setDetailData(res))
              .catch(() => {});
          }
        }
      },
      (st) => setStreamStatus(st)
    );

    return () => disconnect();
  }, [triggerLocalBrowserPushIfAllowed]);

  // Open detail panel
  const openDetail = async (notif: AdminNotificationRecord) => {
    setSelectedNotifId(notif.id);
    setDetailLoading(true);
    setShowEscalateBox(false);
    setCommentText('');
    setEscalateReason('');
    try {
      if (!notif.isRead) {
        await securityService.markAdminNotificationRead(notif.id, true).catch(() => {});
      }
      const res = await securityService.getAdminNotificationDetail(notif.id);
      setDetailData(res);
      void fetchNotifications(true);
    } catch (err: unknown) {
      showToast((err as Error)?.message || 'Erreur lors du chargement du détail.');
    } finally {
      setDetailLoading(false);
    }
  };

  const openPreferencesDrawer = async () => {
    setShowPrefsModal(true);
    try {
      const [prefRes, chRes] = await Promise.all([
        securityService.getAdminNotificationPreferences(),
        securityService.getNotificationChannelsStatus()
      ]);
      setPrefs(prefRes.preferences);
      setPrefsRole(prefRes.role);
      setCriticalLocked(prefRes.criticalSecurityLocked);
      setChannelsStatus(chRes.channels);
    } catch (err: unknown) {
      showToast((err as Error)?.message || 'Impossible de charger les préférences.');
    }
  };

  const handleEnableBrowserPush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showToast('Ce navigateur ne supporte pas les notifications Push.');
      return;
    }
    try {
      const permission = await window.Notification.requestPermission();
      setPushPermission(permission);
      if (permission !== 'granted') {
        showToast('Autorisation de notification refusée par le navigateur.');
        return;
      }
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register('/sw.js');
      }
      const res = await securityService.registerPushSubscription(
        `sw-local://${getActiveSecurityActorId()}/${window.location.origin}`
      );
      setChannelsStatus(res.channels);
      showToast('Notifications navigateur & Service Worker activés.');
    } catch (err: unknown) {
      showToast((err as Error)?.message || 'Erreur d’activation Push navigateur.');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await securityService.markAllAdminNotificationsRead();
      showToast(`${res.markedCount} notification(s) marquée(s) comme lues.`);
      void fetchNotifications(true);
    } catch (err: unknown) {
      showToast((err as Error)?.message || 'Action impossible.');
    }
  };

  const handleToggleRead = async (notif: AdminNotificationRecord, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await securityService.markAdminNotificationRead(notif.id, !notif.isRead);
      if (selectedNotifId === notif.id) {
        const refreshed = await securityService.getAdminNotificationDetail(notif.id);
        setDetailData(refreshed);
      }
      void fetchNotifications(true);
    } catch (err: unknown) {
      showToast((err as Error)?.message || 'Erreur mise à jour lecture.');
    }
  };

  const handleToggleArchive = async (notif: AdminNotificationRecord, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await securityService.archiveAdminNotification(notif.id, !notif.archived);
      showToast(
        notif.archived
          ? 'Notification restaurée dans le flux principal.'
          : 'Notification archivée (événement sécurité original conservé).'
      );
      if (selectedNotifId === notif.id) {
        setSelectedNotifId(null);
        setDetailData(null);
      }
      void fetchNotifications(true);
    } catch (err: unknown) {
      showToast((err as Error)?.message || 'Erreur lors de l’archivage.');
    }
  };

  const handleAssign = async (assigneeId: string) => {
    if (!detailData) return;
    setActionBusy(true);
    try {
      await securityService.assignAdminNotification(detailData.notification.id, assigneeId);
      const refreshed = await securityService.getAdminNotificationDetail(detailData.notification.id);
      setDetailData(refreshed);
      void fetchNotifications(true);
      showToast('Affectation mise à jour.');
    } catch (err: unknown) {
      showToast((err as Error)?.message || 'Erreur lors de l’affectation.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleStatusUpdate = async (status?: AdminNotificationStatus, comment?: string) => {
    if (!detailData) return;
    setActionBusy(true);
    try {
      await securityService.updateAdminNotificationStatus(detailData.notification.id, { status, comment });
      setCommentText('');
      const refreshed = await securityService.getAdminNotificationDetail(detailData.notification.id);
      setDetailData(refreshed);
      void fetchNotifications(true);
      showToast(status === 'resolue' ? 'Alerte marquée résolue.' : status === 'en_cours' ? 'Alerte passée en cours.' : 'Commentaire interne enregistré.');
    } catch (err: unknown) {
      showToast((err as Error)?.message || 'Erreur lors de la mise à jour.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleEscalate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailData) return;
    setActionBusy(true);
    try {
      await securityService.escalateAdminNotification(
        detailData.notification.id,
        escalateReason.trim() || 'Escalade prioritaire vers Super Administrateur'
      );
      setShowEscalateBox(false);
      setEscalateReason('');
      const refreshed = await securityService.getAdminNotificationDetail(detailData.notification.id);
      setDetailData(refreshed);
      void fetchNotifications(true);
      showToast('Alerte escaladée vers le Super Administrateur.');
    } catch (err: unknown) {
      showToast((err as Error)?.message || 'Impossible d’escalader l’alerte.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSavePreferenceToggle = async (
    category: AdminNotificationCategory,
    channel: AdminNotificationChannel
  ) => {
    if (!prefs) return;
    const nextVal = !prefs[category][channel];
    if (criticalLocked && category === 'securite' && !nextVal) {
      showToast('Verrouillé : un administrateur ordinaire ne peut pas désactiver les alertes critiques de sécurité.');
      return;
    }
    const optimistic: AdminNotificationPreferences = {
      ...prefs,
      [category]: {
        ...prefs[category],
        [channel]: nextVal
      }
    };
    setPrefs(optimistic);
    setSavingPrefs(true);
    try {
      const res = await securityService.updateAdminNotificationPreferences(optimistic);
      setPrefs(res.preferences);
      showToast('Préférence enregistrée côté serveur.');
    } catch (err: unknown) {
      const apiErr = err as SecurityApiError;
      setPrefs(prefs);
      showToast(apiErr?.message || 'Modification refusée par la politique serveur.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleConfirmProtectionAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!protectionModal) return;
    const reason = protectionReason.trim() || 'Mesure de protection déclenchée depuis le Centre de Notifications';
    setActionBusy(true);
    try {
      if (protectionModal.type === 'revoke_sessions') {
        const revoked = await securityService.revokeUserSessions({
          userEmail: protectionModal.target,
          userId: protectionModal.targetId,
          reason
        });
        if (revoked.revokedCount === 0) {
          showToast('Aucune session active trouvée pour ce compte.');
        } else {
          showToast(`${revoked.revokedCount} session(s) révoquée(s) immédiatement.`);
        }
      } else if (protectionModal.type === 'block_withdrawals') {
        await securityService.reportCompromisedAccount({
          accountId: protectionModal.targetId || protectionModal.target,
          accountName: protectionModal.target,
          accountEmail: protectionModal.target,
          accountType:
            protectionModal.space === 'seller'
              ? 'vendeur'
              : protectionModal.space === 'driver'
              ? 'livreur'
              : protectionModal.space === 'company'
              ? 'entreprise de livraison'
              : 'client',
          summary: reason,
          blockedOperations: ['withdrawals', 'profile_changes', 'api_writes'],
          forcePasswordReset: false
        });
        showToast('Retraits et opérations financières sensibles bloqués pour ce compte.');
      } else if (protectionModal.type === 'suspend_account') {
        await securityService.suspendAccount({
          accountId: protectionModal.targetId || protectionModal.target,
          accountName: protectionModal.target,
          accountEmail: protectionModal.target,
          accountType:
            protectionModal.space === 'seller'
              ? 'vendeur'
              : protectionModal.space === 'driver'
              ? 'livreur'
              : protectionModal.space === 'company'
              ? 'entreprise de livraison'
              : 'client',
          reason,
          durationMinutes: 1440
        });
        showToast('Compte temporairement suspendu (24h) après vérification.');
      }
      if (detailData) {
        await securityService.updateAdminNotificationStatus(detailData.notification.id, {
          status: 'en_cours',
          comment: `Protection exécutée : ${protectionModal.type} (${reason})`
        });
        const refreshed = await securityService.getAdminNotificationDetail(detailData.notification.id);
        setDetailData(refreshed);
      }
      setProtectionModal(null);
      setProtectionReason('');
      void fetchNotifications(true);
    } catch (err: unknown) {
      const apiErr = err as SecurityApiError;
      showToast(apiErr?.message || 'Permission insuffisante ou erreur d’exécution.');
    } finally {
      setActionBusy(false);
    }
  };

  const notifications = useMemo(() => {
    const raw = data?.notifications || [];
    if (viewMode === 'pending') {
      // Server filter sent status='nouvelle' above; also include client-side filter if statusFilter needed
      return raw;
    }
    return raw;
  }, [data, viewMode]);

  return (
    <div className="space-y-3 text-white">
      {/* HEADER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-[#FF6321] flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            <span>Notifications & Alertes Centralisées</span>
          </h4>
          <p className="text-[11px] text-white/50 mt-0.5">
            Flux temps réel des 5 espaces, finance, livraisons, API et sécurité
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Live Stream Badge */}
          <span
            className={`px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 ${
              streamStatus === 'connected'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : streamStatus === 'connecting'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            {streamStatus === 'connected' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span>
              {streamStatus === 'connected' ? 'Temps réel' : streamStatus === 'connecting' ? 'Synchro…' : 'Hors ligne'}
            </span>
          </span>

          <button
            type="button"
            onClick={() => void fetchNotifications(true)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/75 transition cursor-pointer"
            title="Actualiser"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleMarkAllRead}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-white/85 flex items-center gap-1 transition cursor-pointer"
          >
            <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Tout lire</span>
          </button>

          <button
            type="button"
            onClick={() => void openPreferencesDrawer()}
            className="px-2.5 py-1.5 rounded-lg bg-[#14161c] hover:bg-white/10 border border-white/15 text-[10px] font-bold text-white flex items-center gap-1 transition cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-[#FF6321]" />
            <span>Préférences & Canaux</span>
          </button>
        </div>
      </div>

      {/* TOP 4 KPIS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2.5 rounded-xl bg-[#12141a] border border-white/10">
          <span className="text-[10px] text-white/50 block">Total aujourd’hui</span>
          <span className="text-base font-black text-white font-mono tabular-nums mt-0.5 block">
            {data?.kpis.totalToday ?? 0}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-[#12141a] border border-white/10">
          <span className="text-[10px] text-white/50 block">Non lues</span>
          <span className="text-base font-black text-[#FF6321] font-mono tabular-nums mt-0.5 block">
            {data?.kpis.unreadCount ?? 0}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-[#12141a] border border-rose-500/20">
          <span className="text-[10px] text-rose-300/70 block">Critiques actives</span>
          <span className="text-base font-black text-rose-400 font-mono tabular-nums mt-0.5 block">
            {data?.kpis.criticalCount ?? 0}
          </span>
        </div>
        <div className="p-2.5 rounded-xl bg-[#12141a] border border-white/10">
          <span className="text-[10px] text-white/50 block">En attente</span>
          <span className="text-base font-black text-amber-300 font-mono tabular-nums mt-0.5 block">
            {data?.kpis.pendingCount ?? 0}
          </span>
        </div>
      </div>

      {/* SEARCH + VIEW TABS + FILTER TOGGLE */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Rechercher par titre, utilisateur, ID notification, événement ou IP…"
              className="w-full pl-8 pr-8 py-2 rounded-xl bg-[#12141a] border border-white/10 text-xs text-white placeholder-white/35 focus:outline-none focus:border-[#FF6321]/60"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowFiltersPanel((v) => !v)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              showFiltersPanel || categoryFilter !== 'all' || priorityFilter !== 'all' || spaceFilter !== 'all'
                ? 'bg-[#FF6321]/15 border-[#FF6321]/40 text-[#FF6321]'
                : 'bg-[#12141a] border-white/10 text-white/75 hover:text-white'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filtres</span>
          </button>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'Toutes' },
            { id: 'unread', label: `Non lues (${data?.kpis.unreadCount ?? 0})` },
            { id: 'pending', label: `En attente (${data?.kpis.pendingCount ?? 0})` },
            { id: 'archived', label: 'Archivées' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setViewMode(tab.id as typeof viewMode);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition whitespace-nowrap cursor-pointer ${
                viewMode === tab.id
                  ? 'bg-white/10 border-white/25 text-white'
                  : 'bg-[#12141a] border-white/5 text-white/50 hover:text-white/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Multi-Filter Panel */}
        {showFiltersPanel && (
          <div className="p-3 rounded-xl bg-[#12141a] border border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <label className="text-[10px] text-white/50 font-bold block mb-1">Catégorie (13)</label>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value as AdminNotificationCategory | 'all');
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0A0A0A] border border-white/15 text-xs text-white focus:outline-none"
              >
                <option value="all">Toutes les catégories</option>
                {ALL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_META[cat].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-white/50 font-bold block mb-1">Priorité (4 niveaux)</label>
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value as AdminNotificationPriority | 'all');
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0A0A0A] border border-white/15 text-xs text-white focus:outline-none"
              >
                <option value="all">Toutes priorités</option>
                <option value="critique">Critique</option>
                <option value="eleve">Élevé</option>
                <option value="moyen">Moyen</option>
                <option value="information">Information</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-white/50 font-bold block mb-1">Espace DJASSA</label>
              <select
                value={spaceFilter}
                onChange={(e) => {
                  setSpaceFilter(e.target.value as ActivitySpace | 'all');
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#0A0A0A] border border-white/15 text-xs text-white focus:outline-none"
              >
                <option value="all">Tous les espaces</option>
                <option value="client">Client</option>
                <option value="seller">Vendeur</option>
                <option value="driver">Livreur</option>
                <option value="company">Entreprise de livraison</option>
                <option value="admin">Administrateur</option>
                <option value="system">Système / Backend / API</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* NOTIFICATION LIST */}
      {loading ? (
        <div className="p-8 rounded-2xl bg-[#12141a] border border-white/10 text-center text-xs text-white/50">
          Chargement du centre de notifications…
        </div>
      ) : notifications.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#12141a] border border-white/10 text-center space-y-2">
          <BellOff className="w-7 h-7 text-white/25 mx-auto" />
          <p className="text-xs font-bold text-white/75">Aucune notification pour ces filtres</p>
          <p className="text-[11px] text-white/45 max-w-sm mx-auto">
            Toutes les notifications sont générées uniquement à partir des événements réels de la plateforme DJASSA.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const cat = CATEGORY_META[notif.category] || CATEGORY_META.infrastructure;
            const prio = PRIORITY_META[notif.priority] || PRIORITY_META.information;
            const status = STATUS_META[notif.status] || STATUS_META.nouvelle;
            const CatIcon = cat.icon;

            return (
              <div
                key={notif.id}
                onClick={() => void openDetail(notif)}
                className={`p-3 rounded-xl border transition cursor-pointer ${prio.borderClass} ${
                  notif.isRead
                    ? 'bg-[#12141a]/75 border-white/10 hover:border-white/20'
                    : 'bg-[#171923] border-white/20 hover:border-[#FF6321]/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                      <CatIcon className="w-4 h-4 text-white/80" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-[#FF6321] shrink-0" title="Non lue" />
                        )}
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase border ${prio.badgeClass}`}>
                          {prio.label}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-bold text-white/70">
                          {cat.shortLabel}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] font-semibold text-white/60">
                          {SPACE_LABELS[notif.space] || notif.space}
                        </span>
                        {notif.duplicateCount > 1 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[9px] font-mono font-bold text-amber-300">
                            ×{notif.duplicateCount}
                          </span>
                        )}
                      </div>

                      <p className={`text-xs leading-snug ${notif.isRead ? 'font-semibold text-white/85' : 'font-black text-white'}`}>
                        {notif.title}
                      </p>
                      <p className="text-[11px] text-white/55 line-clamp-2">{notif.description}</p>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-white/45 pt-0.5">
                        <span className="font-mono">{formatShortDate(notif.lastOccurrenceAt || notif.createdAt)}</span>
                        <span className="truncate max-w-[180px]">Compte : {notif.targetUser}</span>
                        {notif.assignedToName && (
                          <span className="text-sky-300 font-semibold">Assignée : {notif.assignedToName}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`px-2 py-0.5 rounded-md border text-[9px] font-bold ${status.cls}`}>
                      {status.label}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => void handleToggleRead(notif, e)}
                        className="p-1 rounded-md bg-white/5 hover:bg-white/15 text-white/60 hover:text-white cursor-pointer"
                        title={notif.isRead ? 'Marquer non lue' : 'Marquer comme lue'}
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => void handleToggleArchive(notif, e)}
                        className="p-1 rounded-md bg-white/5 hover:bg-white/15 text-white/60 hover:text-white cursor-pointer"
                        title={notif.archived ? 'Restaurer' : 'Archiver'}
                      >
                        {notif.archived ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PAGINATION */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between pt-1 text-[11px] text-white/60">
          <span>
            Page {data.page} / {data.totalPages} • {data.total} notification(s)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 disabled:opacity-35 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 disabled:opacity-35 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          DETAIL MODAL
          ===================================================================== */}
      {selectedNotifId && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
          onClick={() => {
            setSelectedNotifId(null);
            setDetailData(null);
          }}
        >
          <div
            className="w-full max-w-2xl max-h-[92vh] bg-[#101116] border border-white/15 rounded-2xl flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-white/10 bg-[#14161e] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-mono text-white/45 block truncate">
                  {detailData?.notification.id || selectedNotifId}
                </span>
                <h3 className="text-sm font-black text-white truncate">
                  Détail de la notification
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedNotifId(null);
                  setDetailData(null);
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/75 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {detailLoading || !detailData ? (
                <div className="py-12 text-center text-white/50">Chargement des détails…</div>
              ) : (
                <>
                  {/* Main Summary Card */}
                  <div className="p-3.5 rounded-xl bg-[#161820] border border-white/10 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                          PRIORITY_META[detailData.notification.priority].badgeClass
                        }`}
                      >
                        {PRIORITY_META[detailData.notification.priority].label}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-bold text-white/80">
                        {CATEGORY_META[detailData.notification.category]?.label}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-semibold text-white/70">
                        Espace : {SPACE_LABELS[detailData.notification.space]}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                          STATUS_META[detailData.notification.status].cls
                        }`}
                      >
                        {STATUS_META[detailData.notification.status].label}
                      </span>
                    </div>

                    <h4 className="text-sm font-black text-white">{detailData.notification.title}</h4>
                    <p className="text-xs text-white/75 leading-relaxed">{detailData.notification.description}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-white/10 text-[11px]">
                      <div>
                        <span className="text-white/45 block">Date et heure</span>
                        <span className="font-mono text-white/90">{formatDateTime(detailData.notification.createdAt)}</span>
                      </div>
                      <div>
                        <span className="text-white/45 block">Utilisateur / Cible</span>
                        <span className="font-bold text-white">{detailData.notification.targetUser}</span>
                      </div>
                      <div>
                        <span className="text-white/45 block">ID événement source</span>
                        <span className="font-mono text-white/85">{detailData.notification.sourceEventId}</span>
                      </div>
                      <div>
                        <span className="text-white/45 block">Administrateur responsable</span>
                        <span className="font-bold text-sky-300">
                          {detailData.notification.assignedToName || 'Non affectée'}
                        </span>
                      </div>
                      {detailData.notification.sourceIp && (
                        <div>
                          <span className="text-white/45 block">Adresse IP source</span>
                          <span className="font-mono text-white/80">{detailData.notification.sourceIp}</span>
                        </div>
                      )}
                      {detailData.notification.entityId && (
                        <div>
                          <span className="text-white/45 block">Élément concerné</span>
                          <span className="font-mono text-white/80">
                            {detailData.notification.entityType} • {detailData.notification.entityId}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CONTEXTUAL QUICK NAVIGATION & PROTECTIONS */}
                  <div className="p-3 rounded-xl bg-[#14161e] border border-white/10 space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-white/50 block">
                      Actions contextuelles & Sécurité
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setInspectTarget(detailData.notification.targetUser)}
                        className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Consulter le compte</span>
                      </button>

                      {onOpenAuditSubTab && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedNotifId(null);
                            onOpenAuditSubTab();
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5 text-amber-400" />
                          <span>Ouvrir Journal d’activité</span>
                        </button>
                      )}

                      {onNavigateTab && (
                        <button
                          type="button"
                          onClick={() => {
                            const cat = detailData.notification.category;
                            const targetTab: AdminTabType =
                              cat === 'comptes' || cat === 'vendeurs' || cat === 'livreurs' || cat === 'entreprises'
                                ? 'utilisateurs'
                                : 'dashboard';
                            setSelectedNotifId(null);
                            onNavigateTab(targetTab);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-[#FF6321]" />
                          <span>Accéder à l’espace concerné</span>
                        </button>
                      )}

                      {/* Critical response actions */}
                      {(detailData.notification.category === 'securite' ||
                        detailData.notification.category === 'retraits' ||
                        detailData.notification.priority === 'critique') && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setProtectionReason('');
                              setProtectionModal({
                                type: 'revoke_sessions',
                                target: detailData.notification.targetUser,
                                targetId: detailData.notification.targetUserId,
                                space: detailData.notification.space
                              });
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/35 text-[11px] font-bold text-amber-300 flex items-center gap-1 cursor-pointer"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Révoquer sessions</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setProtectionReason('');
                              setProtectionModal({
                                type: 'block_withdrawals',
                                target: detailData.notification.targetUser,
                                targetId: detailData.notification.targetUserId,
                                space: detailData.notification.space
                              });
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/35 text-[11px] font-bold text-orange-300 flex items-center gap-1 cursor-pointer"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Bloquer opérations sensibles</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setProtectionReason('');
                              setProtectionModal({
                                type: 'suspend_account',
                                target: detailData.notification.targetUser,
                                targetId: detailData.notification.targetUserId,
                                space: detailData.notification.space
                              });
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-[11px] font-bold text-rose-300 flex items-center gap-1 cursor-pointer"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Suspendre temporairement</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* WORKFLOW CONTROLS: ASSIGN, STATUS, COMMENT, ESCALATE */}
                  <div className="p-3.5 rounded-xl bg-[#14161e] border border-white/10 space-y-3">
                    <span className="text-[10px] font-black uppercase tracking-wider text-white/50 block">
                      Traitement de l’alerte
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        disabled={actionBusy}
                        value={detailData.notification.assignedToId || ''}
                        onChange={(e) => void handleAssign(e.target.value)}
                        className="flex-1 min-w-[190px] px-2.5 py-1.5 rounded-lg bg-[#0A0A0A] border border-white/15 text-xs text-white focus:outline-none"
                      >
                        <option value="">Affecter à un administrateur…</option>
                        {(data?.staffAssignees || []).map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.name}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => void handleStatusUpdate('en_cours')}
                        className="px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-xs font-bold text-sky-300 cursor-pointer"
                      >
                        En cours
                      </button>

                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => void handleStatusUpdate('resolue', commentText.trim() || undefined)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-xs font-bold text-emerald-300 cursor-pointer"
                      >
                        Résoudre
                      </button>

                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => setShowEscalateBox((v) => !v)}
                        className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-xs font-bold text-rose-300 cursor-pointer"
                      >
                        Escalader Super Admin
                      </button>
                    </div>

                    {showEscalateBox && (
                      <form onSubmit={handleEscalate} className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={escalateReason}
                          onChange={(e) => setEscalateReason(e.target.value)}
                          placeholder="Motif d’escalade vers Super Administrateur…"
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#0A0A0A] border border-rose-500/35 text-xs text-white placeholder-white/40 focus:outline-none"
                          required
                        />
                        <button
                          type="submit"
                          disabled={actionBusy}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-black cursor-pointer"
                        >
                          Confirmer
                        </button>
                      </form>
                    )}

                    {/* Internal comment */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Ajouter un commentaire interne de suivi…"
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#0A0A0A] border border-white/15 text-xs text-white placeholder-white/35 focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={actionBusy || !commentText.trim()}
                        onClick={() => void handleStatusUpdate(undefined, commentText.trim())}
                        className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-xs font-bold text-white flex items-center gap-1 cursor-pointer"
                      >
                        <MessageSquarePlus className="w-3.5 h-3.5" />
                        <span>Noter</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px] text-white/45">
                      <span>L’archivage ne supprime jamais l’événement original du journal d’activité.</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleToggleRead(detailData.notification)}
                          className="text-white/75 hover:text-white font-bold cursor-pointer"
                        >
                          {detailData.notification.isRead ? 'Marquer non lue' : 'Marquer lue'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleArchive(detailData.notification)}
                          className="text-white/75 hover:text-white font-bold cursor-pointer"
                        >
                          {detailData.notification.archived ? 'Désarchiver' : 'Archiver'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* CHANNELS DELIVERY STATUS */}
                  <div className="p-3.5 rounded-xl bg-[#14161e] border border-white/10 space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-white/50 block">
                      Canaux de diffusion
                    </span>
                    <div className="space-y-1.5">
                      {detailData.notification.deliveries.map((dlv) => (
                        <div
                          key={dlv.id}
                          className="p-2 rounded-lg bg-[#0c0d12] border border-white/5 flex items-center justify-between gap-2 text-[11px]"
                        >
                          <div>
                            <span className="font-bold text-white uppercase text-[10px] mr-2">{dlv.channel}</span>
                            <span className="text-white/60">{dlv.details}</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                              dlv.status === 'sent'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : dlv.status === 'not_configured'
                                ? 'bg-amber-500/15 text-amber-300'
                                : dlv.status === 'failed'
                                ? 'bg-rose-500/15 text-rose-400'
                                : 'bg-white/10 text-white/60'
                            }`}
                          >
                            {dlv.status === 'sent'
                              ? 'Délivrée'
                              : dlv.status === 'not_configured'
                              ? 'Non configuré'
                              : dlv.status === 'failed'
                              ? 'Échec'
                              : dlv.status === 'retrying'
                              ? 'Nouvelle tentative'
                              : 'Ignorée (préf.)'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* PROCESSING HISTORY TIMELINE */}
                  <div className="p-3.5 rounded-xl bg-[#14161e] border border-white/10 space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-white/50 block">
                      Historique de traitement ({detailData.notification.history.length})
                    </span>
                    <div className="space-y-1.5">
                      {detailData.notification.history.map((h) => (
                        <div key={h.id} className="p-2 rounded-lg bg-[#0c0d12] border border-white/5 text-[11px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-white">{h.action}</span>
                            <span className="font-mono text-[10px] text-white/45">{formatDateTime(h.at)}</span>
                          </div>
                          <p className="text-[10px] text-white/55 mt-0.5">Par : {h.actorName}</p>
                          {h.comment && (
                            <p className="text-[11px] text-amber-200/90 mt-1 bg-white/5 rounded px-2 py-1">
                              « {h.comment} »
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PREFERENCES & CHANNELS MODAL
          ===================================================================== */}
      {showPrefsModal && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
          onClick={() => setShowPrefsModal(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[92vh] bg-[#101116] border border-white/15 rounded-2xl flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-white/10 bg-[#14161e] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#FF6321]" />
                <h3 className="text-sm font-black text-white">Préférences & Canaux de diffusion</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPrefsModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/75 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {/* Channels Diagnostics */}
              {channelsStatus && (
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-white/50 block">
                    État réel des canaux sur ce serveur
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="p-3 rounded-xl bg-[#14161e] border border-emerald-500/25 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white flex items-center gap-1">
                          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                          Interne (WS)
                        </span>
                        <span className="text-[10px] font-bold text-emerald-400">Actif</span>
                      </div>
                      <p className="text-[10px] text-white/55">
                        {channelsStatus.interne.activeConnections} session(s) connectée(s)
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-[#14161e] border border-white/10 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white flex items-center gap-1">
                          <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                          Push Navigateur
                        </span>
                        <span
                          className={`text-[10px] font-bold ${
                            channelsStatus.push.externalRelayConfigured || pushPermission === 'granted'
                              ? 'text-emerald-400'
                              : 'text-amber-300'
                          }`}
                        >
                          {channelsStatus.push.externalRelayConfigured
                            ? 'Relais actif'
                            : pushPermission === 'granted'
                            ? 'SW local actif'
                            : 'Non autorisé'}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/55 leading-snug">{channelsStatus.push.message}</p>
                      {pushPermission !== 'granted' && pushPermission !== 'unsupported' && (
                        <button
                          type="button"
                          onClick={() => void handleEnableBrowserPush()}
                          className="w-full py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-[10px] font-bold text-sky-300 cursor-pointer"
                        >
                          Activer Push sur ce navigateur
                        </button>
                      )}
                    </div>

                    <div className="p-3 rounded-xl bg-[#14161e] border border-white/10 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-amber-400" />
                          E-mail critique
                        </span>
                        <span
                          className={`text-[10px] font-bold ${
                            channelsStatus.email.configured ? 'text-emerald-400' : 'text-amber-300'
                          }`}
                        >
                          {channelsStatus.email.configured ? 'Configuré' : 'Non configuré'}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/55 leading-snug">{channelsStatus.email.message}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Lock banner for ordinary admins */}
              {criticalLocked && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-[11px] text-amber-200">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Rôle <strong className="font-bold">{prefsRole}</strong> : les notifications critiques de sécurité sont obligatoires et verrouillées.
                  </span>
                </div>
              )}

              {/* Preferences Table */}
              {prefs && (
                <div className="rounded-xl border border-white/10 overflow-hidden">
                  <div className="grid grid-cols-[1fr_64px_64px_64px] bg-[#14161e] px-3 py-2 text-[10px] font-black uppercase text-white/50">
                    <span>Catégorie</span>
                    <span className="text-center">Interne</span>
                    <span className="text-center">Push</span>
                    <span className="text-center">E-mail</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {ALL_CATEGORIES.map((cat) => {
                      const row = prefs[cat];
                      const meta = CATEGORY_META[cat];
                      const lockedRow = criticalLocked && cat === 'securite';
                      return (
                        <div
                          key={cat}
                          className="grid grid-cols-[1fr_64px_64px_64px] items-center px-3 py-2 bg-[#101116]"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-semibold text-white truncate">{meta.label}</span>
                            {lockedRow && <Lock className="w-3 h-3 text-amber-400 shrink-0" />}
                          </div>
                          {(['interne', 'push', 'email'] as AdminNotificationChannel[]).map((ch) => (
                            <div key={ch} className="flex justify-center">
                              <button
                                type="button"
                                disabled={savingPrefs || lockedRow}
                                onClick={() => void handleSavePreferenceToggle(cat, ch)}
                                className={`w-9 h-5 rounded-full p-0.5 transition cursor-pointer disabled:opacity-60 ${
                                  row[ch] ? 'bg-[#FF6321]' : 'bg-white/15'
                                }`}
                              >
                                <div
                                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                    row[ch] ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          INLINE PROTECTION ACTION CONFIRMATION MODAL
          ===================================================================== */}
      {protectionModal && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setProtectionModal(null)}
        >
          <div
            className="w-full max-w-md bg-[#14161e] border border-white/15 rounded-2xl p-4 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>
                {protectionModal.type === 'revoke_sessions'
                  ? 'Révoquer les sessions actives'
                  : protectionModal.type === 'block_withdrawals'
                  ? 'Bloquer les opérations sensibles'
                  : 'Suspension temporaire (24h)'}
              </span>
            </h4>
            <p className="text-xs text-white/65">
              Cible : <strong className="text-white">{protectionModal.target}</strong>
            </p>
            <form onSubmit={handleConfirmProtectionAction} className="space-y-3 text-xs">
              <textarea
                rows={3}
                value={protectionReason}
                onChange={(e) => setProtectionReason(e.target.value)}
                placeholder="Motif de vérification et d’intervention sécurité…"
                className="w-full p-2.5 rounded-xl bg-[#0A0A0A] border border-white/15 text-white placeholder-white/35 focus:outline-none"
                required
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setProtectionModal(null)}
                  className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/15 font-bold cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={actionBusy}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black cursor-pointer"
                >
                  Exécuter la protection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          ACCOUNT HISTORY MODAL
          ===================================================================== */}
      {inspectTarget && (
        <SecurityTargetHistoryModal
          target={inspectTarget}
          actorId={getActiveSecurityActorId()}
          onClose={() => setInspectTarget(null)}
        />
      )}
    </div>
  );
};
