import React, { useMemo, useState } from 'react';
import {
  Crown,
  User,
  CheckCircle2,
  Clock,
  Calendar,
  CreditCard,
  Download,
  Search,
  Receipt,
  X,
  Check,
  Sparkles,
  Image as ImageIcon,
  MessageSquare,
  Wallet
} from 'lucide-react';
import { AdminUserRecord } from '../../../types';
import { formatFCFA } from '../../../services/marketServices';

export interface ClientPaidSubscriptionItem {
  id: string;
  planId: 'mini' | 'plus' | 'premium';
  planName: string;
  badgeLabel: string;
  amountPaidFCFA: number;
  paymentMethod: 'Wave' | 'Orange Money' | 'MTN MoMo' | 'Carte Bancaire';
  reference: string;
  paidAtDate: string;
  paidAtTime: string;
  periodStart: string;
  periodEnd: string;
  creditsTotal: number;
  creditsRemaining: number;
  questionsQuota: number;
  imagesQuota: number;
  status: 'active' | 'renewed' | 'expired';
  autoRenew: boolean;
  features: string[];
}

interface StoredClientSubscriberShape {
  id: string;
  name: string;
  role: 'client' | 'seller';
  phone: string;
  planId: string;
  planName: string;
  startDate: string;
  purchaseTime?: string;
  renewalDate: string;
  amountPaid: number;
  paymentMethod: 'Wave' | 'Orange Money' | 'MTN MoMo' | 'Carte Bancaire';
  creditsTotal: number;
  creditsRemaining: number;
  status: 'active' | 'expiring_soon' | 'completed' | 'overdue';
  autoRenew: boolean;
}

interface ClientPlanSpec {
  planId: 'mini' | 'plus' | 'premium';
  planName: string;
  badgeLabel: string;
  amountPaidFCFA: number;
  creditsTotal: number;
  questionsQuota: number;
  imagesQuota: number;
  features: string[];
}

const CLIENT_PLAN_SPECS: Record<'mini' | 'plus' | 'premium', ClientPlanSpec> = {
  mini: {
    planId: 'mini',
    planName: 'DJASSA Mini',
    badgeLabel: 'Découverte',
    amountPaidFCFA: 300,
    creditsTotal: 30,
    questionsQuota: 30,
    imagesQuota: 2,
    features: [
      '30 crédits IA Luna inclus',
      '30 questions posées à l’assistant shopping',
      '2 créations d’images générées par l’IA',
      'Cumul automatique avec les crédits quotidiens gratuits'
    ]
  },
  plus: {
    planId: 'plus',
    planName: 'DJASSA Plus',
    badgeLabel: 'Le Plus Populaire',
    amountPaidFCFA: 600,
    creditsTotal: 60,
    questionsQuota: 60,
    imagesQuota: 5,
    features: [
      '60 crédits IA Luna inclus',
      '60 questions & conseils shopping personnalisés',
      '5 créations d’images & essayages IA',
      'Priorité standard sur les recommandations boutiques'
    ]
  },
  premium: {
    planId: 'premium',
    planName: 'DJASSA Premium',
    badgeLabel: 'VIP Shopping',
    amountPaidFCFA: 1200,
    creditsTotal: 120,
    questionsQuota: 120,
    imagesQuota: 12,
    features: [
      '120 crédits IA haute vitesse inclus',
      '120 questions assistant IA & styliste dédié',
      '12 créations d’images HD & essayages virtuels VIP',
      'Traitement prioritaire & support client VIP'
    ]
  }
};

const normalizePhone = (value?: string): string => (value || '').replace(/\D/g, '');
const normalizeText = (value?: string): string =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const resolveClientPlanKey = (planId?: string, planName?: string, amount?: number): 'mini' | 'plus' | 'premium' => {
  const nName = normalizeText(planName);
  if (planId === 'premium' || nName.includes('premium') || amount === 1200) return 'premium';
  if (planId === 'plus' || nName.includes('plus') || amount === 600) return 'plus';
  if (planId === 'mini' || nName.includes('mini') || amount === 300) return 'mini';
  return 'plus';
};

export const useClientBillingHistoryData = (
  user: AdminUserRecord
): ClientPaidSubscriptionItem[] => {
  return useMemo<ClientPaidSubscriptionItem[]>(() => {
    const cleanPhone = normalizePhone(user.phone);
    const cleanNames = [user.name, user.username]
      .map(normalizeText)
      .filter(Boolean);

    let storedSubs: StoredClientSubscriberShape[] = [];
    try {
      const raw = localStorage.getItem('djassa_admin_subscriber_profiles');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) storedSubs = parsed;
      }
    } catch {
      storedSubs = [];
    }

    const matchedStored = storedSubs.filter((sub) => {
      if (sub.role !== 'client') return false;
      if (cleanPhone && normalizePhone(sub.phone) === cleanPhone) return true;
      const subName = normalizeText(sub.name);
      return cleanNames.some((n) => n && (subName.includes(n) || n.includes(subName)));
    });

    const mappedFromStorage: ClientPaidSubscriptionItem[] = matchedStored.map((sub, idx) => {
      const planKey = resolveClientPlanKey(sub.planId, sub.planName, sub.amountPaid);
      const spec = CLIENT_PLAN_SPECS[planKey];
      const isEnded = sub.status === 'completed' || sub.status === 'overdue';
      return {
        id: `client-sub-live-${sub.id}-${idx}`,
        planId: spec.planId,
        planName: spec.planName,
        badgeLabel: spec.badgeLabel,
        amountPaidFCFA: spec.amountPaidFCFA,
        paymentMethod: sub.paymentMethod,
        reference: `CLI-SUB-${sub.id.toUpperCase().replace(/[^A-Z0-9]/g, '')}-2026`,
        paidAtDate: sub.startDate,
        paidAtTime: sub.purchaseTime || '10:15',
        periodStart: sub.startDate,
        periodEnd: sub.renewalDate,
        creditsTotal: spec.creditsTotal,
        creditsRemaining: isEnded ? 0 : Math.min(spec.creditsTotal, sub.creditsRemaining),
        questionsQuota: spec.questionsQuota,
        imagesQuota: spec.imagesQuota,
        status: isEnded ? 'expired' : 'active',
        autoRenew: sub.autoRenew,
        features: spec.features
      };
    });

    const defaultPlanKey: 'mini' | 'plus' | 'premium' = (() => {
      if (mappedFromStorage[0]) return mappedFromStorage[0].planId;
      const nameNorm = normalizeText(user.name);
      if ((user.ordersCount ?? 0) >= 20 || nameNorm.includes('aminata') || nameNorm.includes('fatou') || nameNorm.includes('david')) {
        return 'premium';
      }
      if ((user.ordersCount ?? 0) <= 5 || nameNorm.includes('salimata') || nameNorm.includes('yao')) {
        return 'mini';
      }
      return 'plus';
    })();

    const currentSpec = CLIENT_PLAN_SPECS[defaultPlanKey];
    const seedCode = (user.id || 'CLI').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-4) || '001';

    const isRecentClient = user.status === 'pending_verification' && (user.registeredDaysAgo ?? 0) <= 30;
    if (isRecentClient && mappedFromStorage.length === 0) {
      return [
        {
          id: `client-sub-init-${user.id}`,
          planId: 'mini',
          planName: CLIENT_PLAN_SPECS.mini.planName,
          badgeLabel: CLIENT_PLAN_SPECS.mini.badgeLabel,
          amountPaidFCFA: 300,
          paymentMethod: 'Wave',
          reference: `WAV-CLI-${seedCode}-1105`,
          paidAtDate: '05 Nov 2026',
          paidAtTime: '14:20',
          periodStart: '05 Nov 2026',
          periodEnd: '05 Déc 2026',
          creditsTotal: 30,
          creditsRemaining: 24,
          questionsQuota: 30,
          imagesQuota: 2,
          status: 'active',
          autoRenew: true,
          features: CLIENT_PLAN_SPECS.mini.features
        }
      ];
    }

    const baseCycles: ClientPaidSubscriptionItem[] = [
      ...(mappedFromStorage.length > 0
        ? []
        : [
            {
              id: `client-sub-curr-${user.id}`,
              planId: currentSpec.planId,
              planName: currentSpec.planName,
              badgeLabel: currentSpec.badgeLabel,
              amountPaidFCFA: currentSpec.amountPaidFCFA,
              paymentMethod: 'Wave' as const,
              reference: `WAV-CLI-${seedCode}-1101`,
              paidAtDate: '01 Nov 2026',
              paidAtTime: '10:15',
              periodStart: '01 Nov 2026',
              periodEnd: '01 Déc 2026',
              creditsTotal: currentSpec.creditsTotal,
              creditsRemaining: Math.round(currentSpec.creditsTotal * 0.8),
              questionsQuota: currentSpec.questionsQuota,
              imagesQuota: currentSpec.imagesQuota,
              status: 'active' as const,
              autoRenew: true,
              features: currentSpec.features
            }
          ]),
      {
        id: `client-sub-hist-1-${user.id}`,
        planId: currentSpec.planId,
        planName: currentSpec.planName,
        badgeLabel: currentSpec.badgeLabel,
        amountPaidFCFA: currentSpec.amountPaidFCFA,
        paymentMethod: 'Orange Money',
        reference: `OM-CLI-${seedCode}-1001`,
        paidAtDate: '01 Oct 2026',
        paidAtTime: '15:42',
        periodStart: '01 Oct 2026',
        periodEnd: '01 Nov 2026',
        creditsTotal: currentSpec.creditsTotal,
        creditsRemaining: 0,
        questionsQuota: currentSpec.questionsQuota,
        imagesQuota: currentSpec.imagesQuota,
        status: 'renewed',
        autoRenew: true,
        features: currentSpec.features
      },
      {
        id: `client-sub-hist-2-${user.id}`,
        planId: 'plus',
        planName: CLIENT_PLAN_SPECS.plus.planName,
        badgeLabel: CLIENT_PLAN_SPECS.plus.badgeLabel,
        amountPaidFCFA: CLIENT_PLAN_SPECS.plus.amountPaidFCFA,
        paymentMethod: 'Wave',
        reference: `WAV-CLI-${seedCode}-0901`,
        paidAtDate: '01 Sept 2026',
        paidAtTime: '18:05',
        periodStart: '01 Sept 2026',
        periodEnd: '01 Oct 2026',
        creditsTotal: CLIENT_PLAN_SPECS.plus.creditsTotal,
        creditsRemaining: 0,
        questionsQuota: CLIENT_PLAN_SPECS.plus.questionsQuota,
        imagesQuota: CLIENT_PLAN_SPECS.plus.imagesQuota,
        status: 'expired',
        autoRenew: false,
        features: CLIENT_PLAN_SPECS.plus.features
      },
      {
        id: `client-sub-hist-3-${user.id}`,
        planId: 'mini',
        planName: CLIENT_PLAN_SPECS.mini.planName,
        badgeLabel: CLIENT_PLAN_SPECS.mini.badgeLabel,
        amountPaidFCFA: CLIENT_PLAN_SPECS.mini.amountPaidFCFA,
        paymentMethod: 'MTN MoMo',
        reference: `MTN-CLI-${seedCode}-0801`,
        paidAtDate: '01 Août 2026',
        paidAtTime: '12:30',
        periodStart: '01 Août 2026',
        periodEnd: '01 Sept 2026',
        creditsTotal: CLIENT_PLAN_SPECS.mini.creditsTotal,
        creditsRemaining: 0,
        questionsQuota: CLIENT_PLAN_SPECS.mini.questionsQuota,
        imagesQuota: CLIENT_PLAN_SPECS.mini.imagesQuota,
        status: 'expired',
        autoRenew: false,
        features: CLIENT_PLAN_SPECS.mini.features
      }
    ];

    return [...mappedFromStorage, ...baseCycles];
  }, [user]);
};

interface ClientBillingHistoryTabProps {
  user: AdminUserRecord;
  onShowToast: (msg: string) => void;
}

export const ClientBillingHistoryTab: React.FC<ClientBillingHistoryTabProps> = ({
  user,
  onShowToast
}) => {
  const initialSubscriptions = useClientBillingHistoryData(user);

  const [extraSubs, setExtraSubs] = useState<ClientPaidSubscriptionItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'ended'>('all');
  const [tierFilter, setTierFilter] = useState<'all' | 'mini' | 'plus' | 'premium'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<ClientPaidSubscriptionItem | null>(null);
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantPlanId, setGrantPlanId] = useState<'mini' | 'plus' | 'premium'>('plus');

  const subscriptions = useMemo(
    () => [...extraSubs, ...initialSubscriptions],
    [extraSubs, initialSubscriptions]
  );

  const totalPaidFCFA = useMemo(
    () => subscriptions.reduce((sum, s) => sum + s.amountPaidFCFA, 0),
    [subscriptions]
  );

  const activeSubscription = subscriptions.find((s) => s.status === 'active') || subscriptions[0];

  const filteredSubscriptions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return subscriptions.filter((sub) => {
      if (statusFilter === 'active' && sub.status !== 'active') return false;
      if (statusFilter === 'ended' && sub.status === 'active') return false;
      if (tierFilter !== 'all' && sub.planId !== tierFilter) return false;
      if (!q) return true;
      return (
        sub.planName.toLowerCase().includes(q) ||
        sub.badgeLabel.toLowerCase().includes(q) ||
        sub.reference.toLowerCase().includes(q) ||
        sub.paymentMethod.toLowerCase().includes(q) ||
        sub.paidAtDate.toLowerCase().includes(q)
      );
    });
  }, [subscriptions, statusFilter, tierFilter, searchQuery]);

  const handleExportCsv = () => {
    const headers = [
      'Client',
      'Telephone',
      'Formule',
      'Montant_FCFA',
      'Moyen_Paiement',
      'Reference',
      'Date_Paiement',
      'Heure_Paiement',
      'Periode',
      'Credits_IA',
      'Images_IA',
      'Statut'
    ];
    const rows = subscriptions.map((s) => [
      user.name,
      user.phone || '',
      s.planName,
      String(s.amountPaidFCFA),
      s.paymentMethod,
      s.reference,
      s.paidAtDate,
      s.paidAtTime,
      `${s.periodStart} - ${s.periodEnd}`,
      `${s.creditsRemaining}/${s.creditsTotal}`,
      `${s.imagesQuota}`,
      s.status === 'active' ? 'Actif' : s.status === 'renewed' ? 'Renouvelé' : 'Expiré'
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `abonnements_client_${(user.username || 'client').replace(/[^a-z0-9_]/gi, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('Historique des abonnements client exporté en CSV');
  };

  const handleConfirmGrantSubscription = () => {
    const spec = CLIENT_PLAN_SPECS[grantPlanId];
    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const newSub: ClientPaidSubscriptionItem = {
      id: `client-sub-grant-${Date.now()}`,
      planId: spec.planId,
      planName: spec.planName,
      badgeLabel: spec.badgeLabel,
      amountPaidFCFA: spec.amountPaidFCFA,
      paymentMethod: 'Wave',
      reference: `ADM-CLI-${Date.now().toString().slice(-6)}`,
      paidAtDate: dateStr,
      paidAtTime: timeStr,
      periodStart: dateStr,
      periodEnd: nextMonth,
      creditsTotal: spec.creditsTotal,
      creditsRemaining: spec.creditsTotal,
      questionsQuota: spec.questionsQuota,
      imagesQuota: spec.imagesQuota,
      status: 'active',
      autoRenew: false,
      features: spec.features
    };

    setExtraSubs((prev) => [newSub, ...prev]);
    setShowGrantModal(false);
    onShowToast(`Abonnement ${spec.planName} activé pour ${user.name}`);
  };

  const handleDownloadReceipt = (sub: ClientPaidSubscriptionItem) => {
    const lines = [
      'DJASSA MARKETPLACE — REÇU ABONNEMENT CLIENT',
      '===========================================',
      `Client : ${user.name}`,
      `Téléphone : ${user.phone || 'Non renseigné'}`,
      `Commune : ${user.location || user.deliveryCommune || 'Abidjan'}`,
      `Formule : ${sub.planName} (${sub.badgeLabel})`,
      `Référence : ${sub.reference}`,
      `Date et heure de paiement : ${sub.paidAtDate} à ${sub.paidAtTime}`,
      `Période de validité : Du ${sub.periodStart} au ${sub.periodEnd}`,
      `Moyen de paiement : ${sub.paymentMethod}`,
      `Montant payé : ${formatFCFA(sub.amountPaidFCFA)}`,
      `Crédits IA Luna inclus : ${sub.creditsTotal} crédits`,
      `Quotas inclus : ${sub.questionsQuota} questions IA / ${sub.imagesQuota} créations d'images`,
      `Statut : ${sub.status === 'active' ? 'Actif' : sub.status === 'renewed' ? 'Renouvelé' : 'Expiré'}`
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recu_${sub.reference}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    onShowToast('Reçu téléchargé');
  };

  return (
    <div id="client-billing-history-page" className="space-y-5 max-w-5xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#141417] border border-white/10 rounded-3xl p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-white">
              Historique des Abonnements — Client DJASSA
            </h3>
            <p className="text-xs text-white/50 flex items-center gap-1.5 flex-wrap">
              <span>{user.name}</span>
              {user.phone && (
                <>
                  <span>•</span>
                  <span className="font-mono text-amber-300/80">{user.phone}</span>
                </>
              )}
              {(user.location || user.deliveryCommune) && (
                <>
                  <span>•</span>
                  <span>{user.location || user.deliveryCommune}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Exporter CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowGrantModal(true)}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-amber-500/10"
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Activer un Abonnement</span>
          </button>
        </div>
      </div>

      {/* KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#141417] border border-white/10">
          <div className="flex items-center justify-between text-[11px] text-white/60 font-semibold">
            <span>Total payé par le client</span>
            <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-400 font-mono mt-1">
            {formatFCFA(totalPaidFCFA)}
          </div>
          <span className="text-[10px] text-white/45 block mt-0.5">
            {subscriptions.length} paiement{subscriptions.length > 1 ? 's' : ''} enregistré{subscriptions.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#141417] border border-white/10">
          <div className="flex items-center justify-between text-[11px] text-white/60 font-semibold">
            <span>Formule active</span>
            <Crown className="w-4 h-4 text-amber-400 shrink-0" />
          </div>
          <div className="text-sm sm:text-base font-black text-white mt-1 truncate">
            {activeSubscription ? activeSubscription.planName : 'Aucune'}
          </div>
          <span className="text-[10px] text-amber-300 font-semibold block mt-0.5">
            {activeSubscription ? activeSubscription.badgeLabel : '—'}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#141417] border border-white/10">
          <div className="flex items-center justify-between text-[11px] text-white/60 font-semibold">
            <span>Crédits IA Luna</span>
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
          </div>
          <div className="text-base sm:text-lg font-black text-purple-300 font-mono mt-1">
            {activeSubscription
              ? `${activeSubscription.creditsRemaining} / ${activeSubscription.creditsTotal}`
              : '0 / 0'}
          </div>
          <span className="text-[10px] text-white/45 block mt-0.5">
            Solde du cycle en cours
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#141417] border border-white/10">
          <div className="flex items-center justify-between text-[11px] text-white/60 font-semibold">
            <span>Quotas IA inclus</span>
            <ImageIcon className="w-4 h-4 text-cyan-400 shrink-0" />
          </div>
          <div className="text-base sm:text-lg font-black text-white font-mono mt-1">
            {activeSubscription
              ? `${activeSubscription.questionsQuota} Q • ${activeSubscription.imagesQuota} Img`
              : '0 Q • 0 Img'}
          </div>
          <span className="text-[10px] text-white/45 block mt-0.5">
            Questions & créations IA
          </span>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-[#141417] border border-white/10 rounded-2xl p-3 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'all' as const, label: 'Toutes les formules' },
            { id: 'mini' as const, label: 'DJASSA Mini (300 F)' },
            { id: 'plus' as const, label: 'DJASSA Plus (600 F)' },
            { id: 'premium' as const, label: 'DJASSA Premium (1 200 F)' }
          ].map((tier) => (
            <button
              key={tier.id}
              type="button"
              onClick={() => setTierFilter(tier.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                tierFilter === tier.id
                  ? 'bg-amber-500 text-black font-black'
                  : 'bg-white/5 text-white/65 hover:text-white hover:bg-white/10'
              }`}
            >
              {tier.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl p-1">
            {[
              { id: 'all' as const, label: 'Tous' },
              { id: 'active' as const, label: 'Actifs' },
              { id: 'ended' as const, label: 'Renouvelés / Expirés' }
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  statusFilter === st.id
                    ? 'bg-white/15 text-white'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher référence, moyen, date..."
              className="w-full sm:w-56 pl-8 pr-7 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-white/40 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SUBSCRIPTIONS HISTORY LIST */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-black text-white flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400" />
            <span>Historique chronologique des paiements d'abonnements client</span>
          </h4>
          <span className="text-xs font-mono text-amber-300 font-bold">
            {filteredSubscriptions.length} abonnement{filteredSubscriptions.length > 1 ? 's' : ''}
          </span>
        </div>

        {filteredSubscriptions.length === 0 ? (
          <div className="p-6 text-center rounded-2xl bg-[#141417] border border-white/10 text-xs text-white/50">
            Aucun abonnement client ne correspond aux filtres sélectionnés.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredSubscriptions.map((sub) => (
              <div
                key={sub.id}
                className="bg-[#141417] border border-white/10 hover:border-amber-400/40 rounded-3xl p-4 space-y-3.5 transition"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono block">
                      {sub.badgeLabel}
                    </span>
                    <h5 className="text-sm font-black text-white truncate mt-0.5">
                      {sub.planName}
                    </h5>
                    <span className="text-[11px] text-white/45 font-mono block">
                      Réf : {sub.reference}
                    </span>
                  </div>

                  {sub.status === 'active' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      Actif
                    </span>
                  ) : sub.status === 'renewed' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shrink-0">
                      <Check className="w-3 h-3" />
                      Renouvelé
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-white/10 text-white/60 border border-white/15 shrink-0">
                      <Clock className="w-3 h-3" />
                      Expiré
                    </span>
                  )}
                </div>

                {/* Amount & Payment Method */}
                <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-black/40 border border-white/5 text-xs">
                  <div>
                    <span className="text-[10px] text-white/45 block">Montant payé</span>
                    <span className="text-sm font-black text-emerald-400 font-mono">
                      {formatFCFA(sub.amountPaidFCFA)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/45 block">Paiement</span>
                    <span className="text-xs font-bold text-white flex items-center gap-1 mt-0.5">
                      <CreditCard className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate">{sub.paymentMethod}</span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-white/45 block">Crédits IA</span>
                    <span className="text-xs font-black text-purple-300 font-mono">
                      {sub.creditsRemaining}/{sub.creditsTotal}
                    </span>
                  </div>
                </div>

                {/* Quotas included */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[10px] text-white/45 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-amber-400" />
                      Questions IA Luna
                    </span>
                    <span className="font-mono font-black text-white block mt-0.5">
                      {sub.questionsQuota} questions incluses
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5">
                    <span className="text-[10px] text-white/45 flex items-center gap-1">
                      <ImageIcon className="w-3 h-3 text-cyan-400" />
                      Créations d'images IA
                    </span>
                    <span className="font-mono font-black text-white block mt-0.5">
                      {sub.imagesQuota} images incluses
                    </span>
                  </div>
                </div>

                {/* Features summary */}
                <div className="space-y-1 text-[11px] text-white/65">
                  {sub.features.slice(0, 2).map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="truncate">{feat}</span>
                    </div>
                  ))}
                </div>

                {/* Payment Date & Validity Period */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/60 font-mono">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-white/40" />
                    Payé le {sub.paidAtDate} à {sub.paidAtTime}
                  </span>
                  <span className="text-white/45">
                    Période : {sub.periodStart} → {sub.periodEnd}
                  </span>
                </div>

                {/* Footer */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[10px] text-white/45">
                    Renouvellement auto : {sub.autoRenew ? 'Activé' : 'Désactivé'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedReceipt(sub)}
                    className="px-3 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Voir reçu</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL REÇU DE PAIEMENT CLIENT */}
      {selectedReceipt && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            className="w-full max-w-md bg-[#141417] border border-white/15 rounded-3xl p-5 space-y-4 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h4 className="text-sm font-black text-white">
                  Reçu d'Abonnement Client
                </h4>
                <p className="text-[11px] text-white/50 font-mono">
                  Réf : {selectedReceipt.reference}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/50">Client</span>
                <span className="font-bold text-white text-right">{user.name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/50">Téléphone</span>
                <span className="font-mono text-white text-right">
                  {user.phone || 'Non renseigné'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/50">Formule souscrite</span>
                <span className="font-bold text-amber-300 text-right">
                  {selectedReceipt.planName} ({selectedReceipt.badgeLabel})
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/50">Date et heure de paiement</span>
                <span className="font-mono text-white">
                  {selectedReceipt.paidAtDate} à {selectedReceipt.paidAtTime}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/50">Période de validité</span>
                <span className="font-mono text-white">
                  {selectedReceipt.periodStart} → {selectedReceipt.periodEnd}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/50">Quotas IA inclus</span>
                <span className="font-mono text-white">
                  {selectedReceipt.questionsQuota} questions • {selectedReceipt.imagesQuota} images
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/50">Crédits Luna inclus</span>
                <span className="font-mono text-white">{selectedReceipt.creditsTotal} crédits</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/50">Moyen de paiement</span>
                <span className="font-bold text-white">{selectedReceipt.paymentMethod}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-white/70 font-bold">Montant total payé</span>
                <span className="text-base font-black text-emerald-400 font-mono">
                  {formatFCFA(selectedReceipt.amountPaidFCFA)}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleDownloadReceipt(selectedReceipt)}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger le reçu</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ACTIVATION FORFAIT CLIENT */}
      {showGrantModal && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowGrantModal(false)}
        >
          <div
            className="w-full max-w-md bg-[#141417] border border-white/15 rounded-3xl p-5 space-y-4 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h4 className="text-sm font-black text-white">
                  Activer un Abonnement Client
                </h4>
                <p className="text-[11px] text-white/50">{user.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowGrantModal(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {(['mini', 'plus', 'premium'] as const).map((key) => {
                const spec = CLIENT_PLAN_SPECS[key];
                const selected = grantPlanId === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setGrantPlanId(key)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                      selected
                        ? 'bg-amber-500/15 border-amber-400'
                        : 'bg-white/5 border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-black text-white block">
                        {spec.planName} — {spec.badgeLabel}
                      </span>
                      <span className="text-[11px] text-white/55 block">
                        {spec.creditsTotal} crédits IA • {spec.questionsQuota} questions • {spec.imagesQuota} images IA
                      </span>
                    </div>
                    <span className="text-xs font-black font-mono text-emerald-400 shrink-0">
                      {formatFCFA(spec.amountPaidFCFA)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowGrantModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmGrantSubscription}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition cursor-pointer"
              >
                Confirmer l'activation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
