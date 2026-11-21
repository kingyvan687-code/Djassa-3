import React, { useState, useMemo } from 'react';
import { 
  ArrowDownLeft, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Filter, 
  Download, 
  DollarSign, 
  Percent, 
  Store,
  Smartphone,
  ShieldCheck, 
  RefreshCw, 
  ArrowLeft,
  ChevronRight,
  TrendingUp,
  CreditCard,
  FileText,
  Printer,
  Copy,
  Check,
  X,
  Share2,
  ShoppingBag,
  RotateCcw,
  History,
  Eye,
  ExternalLink
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { formatFCFA } from '../../../services/marketServices';
import { AdminUserRecord } from '../../../types';
import { AdminUserDetailModal } from '../modals/AdminUserDetailModal';

export interface WithdrawalRequest {
  id: string;
  name: string;
  role: 'seller';
  amount: number;             // Montant brut demandé
  feeAmount: number;          // Frais de retrait (6,6% + 150 F fixe)
  netAmount: number;          // Montant net reversé
  phone: string;
  network: 'Wave' | 'Orange Money' | 'MTN MoMo' | 'Moov Money';
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  reference?: string;
  rejectionReason?: string;
  accountBalance?: number;    // Argent total du compte
  apiCost?: number;           // Coûts API de retrait
  avatar?: string;            // Photo de profil
}

export const calculateWithdrawalFee = (amount: number): { feeAmount: number; netAmount: number } => {
  const feeAmount = Math.round(amount * 0.066) + 150;
  const netAmount = Math.max(0, amount - feeAmount);
  return { feeAmount, netAmount };
};

// Taxes de la passerelle de paiement GeniusPay : 4,5% proportionnels + 100 F fixe par transaction
export const calculateGeniusPayFee = (amount: number): number => {
  return Math.round(amount * 0.045) + 100;
};

const INITIAL_WITHDRAWALS: WithdrawalRequest[] = [
  // 1. VENDEURS
  {
    id: 'WTH-8823',
    name: 'Super Marché Treichville Délices',
    role: 'seller',
    amount: 110000,
    feeAmount: 7410,     // 6,6% (7 260 F) + 150 F fixe
    netAmount: 102590,   // Montant net reversé
    phone: '+225 07 99 88 11 22',
    network: 'Wave',
    date: 'Aujourd’hui 16:30',
    status: 'pending',
    reference: 'WAVE-PEND-01',
    accountBalance: 350000,
    apiCost: 150,
    avatar: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200'
  },
  {
    id: 'WTH-8821',
    name: 'Boutique Wax & Élégance (Adjamé)',
    role: 'seller',
    amount: 150000,
    feeAmount: 10050,    // 6,6% (9 900 F) + 150 F fixe
    netAmount: 139950,   // Montant net reversé
    phone: '+225 07 48 99 12 34',
    network: 'Wave',
    date: 'Aujourd’hui 14:12',
    status: 'approved',
    reference: 'WAVE-CI-7712',
    accountBalance: 420000,
    apiCost: 150,
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200'
  },
  {
    id: 'WTH-8819',
    name: 'Adjamé High-Tech Store',
    role: 'seller',
    amount: 320000,
    feeAmount: 21270,    // 6,6% (21 120 F) + 150 F fixe
    netAmount: 298730,   // Montant net reversé
    phone: '+225 05 55 44 33 22',
    network: 'Orange Money',
    date: 'Hier 18:45',
    status: 'approved',
    reference: 'OM-CI-9901',
    accountBalance: 850000,
    apiCost: 200,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200'
  },
  {
    id: 'WTH-8817',
    name: 'Kouassi Cuir & Chaussures',
    role: 'seller',
    amount: 180000,
    feeAmount: 12030,    // 6,6% (11 880 F) + 150 F fixe
    netAmount: 167970,   // Montant net reversé
    phone: '+225 07 12 34 56 78',
    network: 'Moov Money',
    date: '14 Oct 16:30',
    status: 'approved',
    reference: 'MOOV-CI-7705',
    accountBalance: 510000,
    apiCost: 150,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200'
  },
  {
    id: 'WTH-8815',
    name: 'Marcory Bazin VIP',
    role: 'seller',
    amount: 95000,
    feeAmount: 6420,     // 6,6% (6 270 F) + 150 F fixe
    netAmount: 88580,    // Montant net reversé
    phone: '+225 07 77 88 99 00',
    network: 'MTN MoMo',
    date: '12 Oct 15:40',
    status: 'rejected',
    reference: 'MTN-CI-3319',
    rejectionReason: 'Numéro Mobile Money non concordant avec le compte KYC',
    accountBalance: 290000,
    apiCost: 100,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'
  },

];

export interface AdminWithdrawalsSectionProps {
  onBack?: () => void;
}

export type WithdrawalActorTab = 'vendeur';

export const AdminWithdrawalsSection: React.FC<AdminWithdrawalsSectionProps> = ({ onBack }) => {
  const { showToast, addAuditLog, adminUsers, sellers } = useApp();

  // State: Selected user profile to display in AdminUserDetailModal
  const [selectedUserProfile, setSelectedUserProfile] = useState<AdminUserRecord | null>(null);

  // Withdrawals list persisted
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>(() => {
    try {
      const saved = localStorage.getItem('djassa_admin_withdrawals');
      if (saved) {
        const parsed: any[] = JSON.parse(saved);
        // Map and filter to seller withdrawals only while preserving exact status
        const sanitized: WithdrawalRequest[] = parsed
          .filter((item) => item && item.role === 'seller')
          .map(item => {
            const { feeAmount, netAmount } = calculateWithdrawalFee(item.amount);
            const normalizedStatus: WithdrawalRequest['status'] =
              item.status === 'rejected' ? 'rejected' : item.status === 'pending' ? 'pending' : 'approved';
            return {
              ...item,
              role: 'seller' as const,
              feeAmount,
              netAmount,
              status: normalizedStatus
            };
          });
        if (sanitized.length > 0) return sanitized;
      }
    } catch {
      // fallback
    }
    return INITIAL_WITHDRAWALS;
  });

  // Selected withdrawal for invoice/receipt modal
  const [selectedInvoiceItem, setSelectedInvoiceItem] = useState<WithdrawalRequest | null>(null);
  const [copiedInvoiceRef, setCopiedInvoiceRef] = useState(false);

  // Onglet principal unique : 'vendeur'
  const [activeTab] = useState<WithdrawalActorTab>('vendeur');

  // Onglet de statut : 'history' (Historique)
  const [statusTab, setStatusTab] = useState<'pending' | 'approved' | 'rejected' | 'history'>('history');

  // Inline rejection modal state (no native prompt)
  const [rejectModalItem, setRejectModalItem] = useState<WithdrawalRequest | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('Numéro Mobile Money ou informations invalides');

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');

  // Save helper
  const saveWithdrawals = (next: WithdrawalRequest[]) => {
    setWithdrawals(next);
    localStorage.setItem('djassa_admin_withdrawals', JSON.stringify(next));
  };

  const maskPhoneTail = (phone: string) => {
    const cleaned = (phone || '').replace(/\s+/g, '');
    return cleaned.length > 4 ? `***${cleaned.slice(-4)}` : '***';
  };

  // Approve withdrawal
  const handleApproveWithdrawal = (item: WithdrawalRequest) => {
    const next = withdrawals.map(w => w.id === item.id ? { ...w, status: 'approved' as const } : w);
    saveWithdrawals(next);
    showToast(`✅ Retrait ${item.id} approuvé ! 10% de frais (${formatFCFA(item.feeAmount)}) encaissés.`);
    const maskedPhone = maskPhoneTail(item.phone);
    addAuditLog(
      'Validation Retrait & Encaissement Frais',
      `${item.name} (${item.id})`,
      'financial',
      `Retrait ${formatFCFA(item.amount)} · Frais: ${formatFCFA(item.feeAmount)} · Net transféré: ${formatFCFA(item.netAmount)} via ${item.network} (${maskedPhone})`,
      {
        activityCategory: 'wallets',
        actionType: 'admin_withdrawal_approved',
        entityType: 'withdrawal',
        entityId: item.id,
        severity: 'moyen',
        result: 'reussi',
        beforeValue: 'Statut: En attente',
        afterValue: 'Statut: Approuvé',
        financialTrace: {
          operationType: 'Validation retrait admin',
          transactionId: item.id,
          initiatorName: 'Administrateur DJASSA',
          beneficiaryAccount: `${item.name} · ${item.network} (${maskedPhone})`,
          amountFcfa: item.amount,
          feesFcfa: item.feeAmount,
          status: 'approuve',
          timestamp: new Date().toISOString(),
          validationResult: 'Approuvé par administrateur',
          channel: item.network
        }
      }
    );
  };

  // Open inline reject modal
  const handleRejectWithdrawal = (item: WithdrawalRequest) => {
    setRejectReasonInput('Numéro Mobile Money ou informations invalides');
    setRejectModalItem(item);
  };

  const confirmRejectWithdrawal = () => {
    if (!rejectModalItem) return;
    const item = rejectModalItem;
    const reason = rejectReasonInput.trim();
    const next = withdrawals.map(w => w.id === item.id ? { ...w, status: 'rejected' as const, rejectionReason: reason } : w);
    saveWithdrawals(next);
    setRejectModalItem(null);
    showToast(`❌ Retrait ${item.id} rejeté. Le solde est restitué.`);
    const maskedPhone = maskPhoneTail(item.phone);
    addAuditLog(
      'Rejet Demande Retrait',
      `${item.name} (${item.id})`,
      'financial',
      `Motif: ${reason || 'Non précisé'} · Montant restitué: ${formatFCFA(item.amount)} (${item.network} ${maskedPhone})`,
      {
        activityCategory: 'wallets',
        actionType: 'admin_withdrawal_rejected',
        entityType: 'withdrawal',
        entityId: item.id,
        severity: 'moyen',
        result: 'refuse',
        beforeValue: 'Statut: En attente',
        afterValue: `Statut: Rejeté (${reason || 'Non précisé'})`,
        financialTrace: {
          operationType: 'Rejet retrait admin',
          transactionId: item.id,
          initiatorName: 'Administrateur DJASSA',
          beneficiaryAccount: `${item.name} · ${item.network} (${maskedPhone})`,
          amountFcfa: item.amount,
          feesFcfa: item.feeAmount,
          status: 'rejete',
          timestamp: new Date().toISOString(),
          validationResult: `Rejeté: ${reason || 'Non précisé'}`,
          channel: item.network
        }
      }
    );
  };

  // Helper to obtain the best avatar photo for an actor
  const getActorAvatar = (item: WithdrawalRequest): string => {
    if (item.avatar) return item.avatar;
    const cleanItemPhone = item.phone.replace(/\D/g, '');
    const cleanItemName = item.name.toLowerCase();

    const matchedAdmin = adminUsers.find(u => {
      const cleanUserPhone = u.phone.replace(/\D/g, '');
      if (cleanItemPhone && cleanUserPhone && cleanItemPhone === cleanUserPhone) return true;
      if (u.name.toLowerCase() === cleanItemName) return true;
      if (u.storeName && cleanItemName.includes(u.storeName.toLowerCase())) return true;
      return false;
    });
    if (matchedAdmin?.avatar) return matchedAdmin.avatar;

    const matchedSeller = sellers.find(s => cleanItemName.includes(s.name.toLowerCase()) || (s.storeName && cleanItemName.includes(s.storeName.toLowerCase())));
    if (matchedSeller?.avatar) return matchedSeller.avatar;
    return 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200';
  };

  // Open complete profile for any seller
  const handleOpenUserProfile = (item: WithdrawalRequest) => {
    const cleanItemPhone = item.phone.replace(/\D/g, '');
    const cleanItemName = item.name.toLowerCase();

    // 1. Check existing record in adminUsers
    const matchedUser = adminUsers.find(u => {
      const cleanUserPhone = u.phone.replace(/\D/g, '');
      if (cleanItemPhone && cleanUserPhone && cleanItemPhone === cleanUserPhone) return true;
      if (u.name.toLowerCase() === cleanItemName) return true;
      if (u.storeName && cleanItemName.includes(u.storeName.toLowerCase())) return true;
      if (cleanItemName.includes(u.name.toLowerCase())) return true;
      return false;
    });

    if (matchedUser) {
      setSelectedUserProfile(matchedUser);
      showToast(`Profil de ${matchedUser.name} ouvert 👤`);
      return;
    }

    // 2. Build complete AdminUserRecord for Seller
    const matchedSeller = sellers.find(s => 
      cleanItemName.includes(s.name.toLowerCase()) || 
      (s.storeName && cleanItemName.includes(s.storeName.toLowerCase())) ||
      s.phone.replace(/\D/g, '') === cleanItemPhone
    );

    const generatedSellerUser: AdminUserRecord = {
      id: `user-seller-${matchedSeller?.id || item.id}`,
      name: matchedSeller?.name || item.name.replace(/\s*\(.*?\)/g, ''),
      username: matchedSeller?.username || item.name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 18),
      email: matchedSeller?.email || `contact.${item.id.toLowerCase()}@djassa.ci`,
      phone: item.phone,
      role: 'seller',
      status: 'active',
      avatar: matchedSeller?.avatar || getActorAvatar(item),
      createdAt: '2026-01-15',
      registeredDaysAgo: 240,
      location: matchedSeller?.location || 'Adjamé Forum des Marchés, Allée C-12, Abidjan',
      ordersCount: matchedSeller?.salesCount || 340,
      totalSpentOrEarned: item.accountBalance || (item.amount * 3.5),
      kycVerified: true,
      storeName: matchedSeller?.storeName || item.name,
      bio: matchedSeller?.bio || `Boutique certifiée sur Djassa Marketplace. Ventes régulières et encaissements sécurisés.`,
      banner: matchedSeller?.banner || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800',
      dailyAverageMinutes: 195,
      timeTodayMinutes: 140,
      weeklyUsage: [
        { day: 'Lun', minutes: 190 },
        { day: 'Mar', minutes: 210 },
        { day: 'Mer', minutes: 180 },
        { day: 'Jeu', minutes: 230 },
        { day: 'Ven', minutes: 240 },
        { day: 'Sam', minutes: 260 },
        { day: 'Dim', minutes: 140 }
      ],
      kycDocument: {
        type: 'rccm',
        number: 'CI-ABJ-2024-B-48902',
        submittedAt: '2026-01-16',
        documentUrl: 'https://djassa.ci/docs/kyc-rccm.pdf'
      },
      discussions: [
        {
          id: `disc-${item.id}-1`,
          withName: 'Service Financier Djassa',
          withRole: 'admin',
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
          lastMessage: `Votre virement ${item.network} de ${formatFCFA(item.netAmount)} a été traité.`,
          date: item.date
        }
      ]
    };

    setSelectedUserProfile(generatedSellerUser);
    showToast(`Profil du vendeur ${generatedSellerUser.name} ouvert 👤`);
  };

  // Calculations for global metrics
  const calculations = useMemo(() => {
    const totalVolume = withdrawals.reduce((acc, w) => acc + (w.amount || 0), 0);
    const approvedWithdrawals = withdrawals.filter(w => w.status === 'approved');
    const totalFeesCollected = approvedWithdrawals.reduce((acc, w) => acc + (w.feeAmount || 0), 0);
    const totalGeniusPayTaxes = approvedWithdrawals.reduce((acc, w) => acc + calculateGeniusPayFee(w.amount), 0);
    const totalNetProfit = Math.max(0, totalFeesCollected - totalGeniusPayTaxes);
    const totalNetDisbursed = approvedWithdrawals.reduce((acc, w) => acc + (w.netAmount || 0), 0);
    const rejectedWithdrawals = withdrawals.filter(w => w.status === 'rejected');
    const rejectedAmount = rejectedWithdrawals.reduce((acc, w) => acc + (w.amount || 0), 0);

    return {
      totalCount: withdrawals.length,
      approvedCount: approvedWithdrawals.length,
      rejectedCount: rejectedWithdrawals.length,
      rejectedAmount,
      totalVolume,
      totalFeesCollected,
      totalGeniusPayTaxes,
      totalNetProfit,
      totalNetDisbursed,
      pendingCount: 0,
      pendingAmount: 0,
      pendingFeesToCollect: 0
    };
  }, [withdrawals]);

  // Statistics per tab (Vendeurs uniquement)
  const tabStats = useMemo(() => {
    const sellerWithdrawals = withdrawals.filter(w => w.role === 'seller');

    return {
      vendeur: {
        total: sellerWithdrawals.length,
        approved: sellerWithdrawals.filter(w => w.status === 'approved').length,
        pending: sellerWithdrawals.filter(w => w.status === 'pending').length,
        rejected: sellerWithdrawals.filter(w => w.status === 'rejected').length,
        volume: sellerWithdrawals.reduce((s, w) => s + w.amount, 0),
        fees: sellerWithdrawals.filter(w => w.status === 'approved').reduce((s, w) => s + w.feeAmount, 0)
      }
    };
  }, [withdrawals]);

  // Statistics for the 3 Status Tabs: En cours, Terminé, Remboursé
  const statusStats = useMemo(() => {
    const currentCategoryWithdrawals = withdrawals.filter(w => w.role === 'seller');

    const pendingList = currentCategoryWithdrawals.filter(w => w.status === 'pending');
    const approvedList = currentCategoryWithdrawals.filter(w => w.status === 'approved');
    const rejectedList = currentCategoryWithdrawals.filter(w => w.status === 'rejected');

    return {
      pending: {
        count: pendingList.length,
        earned: pendingList.reduce((s, w) => s + w.feeAmount, 0),
        label: 'En cours',
        badge: 'En attente',
        color: 'text-amber-400',
        borderColor: 'border-amber-500/40',
        bgGradient: 'from-amber-950/70 via-[#1c1712] to-[#101012]'
      },
      approved: {
        count: approvedList.length,
        earned: approvedList.reduce((s, w) => s + w.feeAmount, 0),
        label: 'Terminé',
        badge: 'Effectué (6,6% + 150 F Encaissé)',
        color: 'text-emerald-400',
        borderColor: 'border-emerald-500/40',
        bgGradient: 'from-emerald-950/70 via-[#101b13] to-[#101012]'
      },
      rejected: {
        count: rejectedList.length,
        earned: 0,
        label: 'Remboursé',
        badge: 'Échoué / Rejeté',
        color: 'text-rose-400',
        borderColor: 'border-rose-500/40',
        bgGradient: 'from-rose-950/70 via-[#1c1214] to-[#101012]'
      },
      history: {
        count: currentCategoryWithdrawals.length,
        earned: approvedList.reduce((s, w) => s + w.feeAmount, 0),
        label: 'Historique',
        badge: 'Toutes demandes',
        color: 'text-sky-400',
        borderColor: 'border-sky-500/40',
        bgGradient: 'from-sky-950/70 via-[#101824] to-[#101012]'
      }
    };
  }, [withdrawals]);

  // Filtered seller withdrawals
  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter(w => {
      if (w.role !== 'seller') return false;

      // Status tab filter
      if (statusTab !== 'history' && w.status !== statusTab) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = w.name.toLowerCase().includes(q);
        const matchPhone = w.phone.toLowerCase().includes(q);
        const matchRef = (w.reference || w.id).toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchRef) return false;
      }

      return true;
    });
  }, [withdrawals, statusTab, searchQuery]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'ID Demande',
      'Bénéficiaire',
      'Rôle',
      'Montant Brut (FCFA)',
      'Frais Retrait 6,6% + 150 F (FCFA)',
      'Montant Net Versé (FCFA)',
      'Réseau Mobile Money',
      'Téléphone',
      'Date',
      'Statut',
      'Référence'
    ];

    const rows = withdrawals.map(w => [
      w.id,
      `"${w.name.replace(/"/g, '""')}"`,
      'Vendeur',
      w.amount,
      w.feeAmount,
      w.netAmount,
      w.network,
      w.phone,
      w.date,
      w.status,
      w.reference || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Djassa_Revenus_Retraits_6_6pourcent_150F_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('📊 Journal des retraits et frais (6,6% + 150 F) exporté en CSV');
  };

  // Partage officiel du reçu de paiement
  const handleShareInvoice = async (item: WithdrawalRequest) => {
    const geniusPayTax = calculateGeniusPayFee(item.amount);
    const netProfitDjassa = Math.max(0, item.feeAmount - geniusPayTax);
    const currentBalance = item.accountBalance ?? Math.round(item.amount * 2.5);
    const remainingBalance = Math.max(0, currentBalance - item.amount);

    const shareText = `FACTURE DE DÉCAISSEMENT DJASSA\n` +
      `--------------------------------\n` +
      `Montant: ${formatFCFA(item.amount)}\n` +
      `Destinataire: ${item.name} (${item.phone})\n` +
      `Montant reçu: ${formatFCFA(item.netAmount)}\n` +
      `Statut: ${item.status === 'approved' ? 'Effectué' : 'Échoué'}\n` +
      `Frais de retrait Djassa (6,6% + 150 F fixe): ${formatFCFA(item.feeAmount)}\n` +
      `Taxes API GeniusPay (4,5% + 100 F fixe): ${formatFCFA(geniusPayTax)}\n` +
      `Marge nette plateforme Djassa: ${formatFCFA(netProfitDjassa)}\n` +
      `Date et heure: ${item.date}\n` +
      `Nouveau solde: ${formatFCFA(remainingBalance)}\n` +
      `ID de transaction: ${item.reference || item.id}\n` +
      `Passerelle & Opérateur: GeniusPay (${item.network})\n` +
      `--------------------------------\n` +
      `Certifié par Djassa Finance CI`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Reçu DJASSA - ${item.reference || item.id}`,
          text: shareText
        });
        showToast('Reçu partagé avec succès 📲');
        return;
      } catch (e) {
        // Fallback to clipboard
      }
    }

    navigator.clipboard.writeText(shareText);
    showToast('Reçu copié dans le presse-papier pour partage 📋');
  };

  return (
    <div id="admin-withdrawals-section" className="space-y-4 text-white animate-in fade-in duration-200">
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Metric 1: Nombre de Retraits */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-[#151518] to-[#101012] border border-indigo-500/30 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-indigo-300">
            <span className="font-bold flex items-center gap-1.5 truncate">
              <ArrowDownLeft className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="truncate">Nombre de Retraits</span>
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 font-black text-indigo-300 shrink-0">
              Total
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-black text-indigo-300 font-mono tracking-tight">
            {calculations.totalCount}
          </div>
          <div className="flex items-center justify-between text-[10px] text-white/50 pt-0.5">
            <span className="truncate">{calculations.approvedCount} effectués</span>
            <span className="text-rose-400 font-bold shrink-0">{calculations.rejectedCount} échecs</span>
          </div>
        </div>

        {/* Metric 2: Frais Retraits Encaissés (6,6% + 150 F fixe) */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-[#151518] to-[#101012] border border-cyan-500/30 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-cyan-300">
            <span className="font-bold flex items-center gap-1.5 truncate">
              <Percent className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">Frais Encaissés (6,6% + 150 F)</span>
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 font-black text-cyan-300 shrink-0">
              Djassa
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-black text-cyan-400 font-mono tracking-tight truncate">
            {formatFCFA(calculations.totalFeesCollected)}
          </div>
          <div className="flex items-center justify-between text-[10px] text-white/50 pt-0.5">
            <span className="truncate">Prélevé sur les retraits</span>
            <span className="text-cyan-400 font-bold shrink-0">6,6% + 150 F</span>
          </div>
        </div>

        {/* Metric 3: Taxes GeniusPay Payées (4,5% + 100 F fixe) */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-950/40 via-[#181512] to-[#101012] border border-amber-500/30 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-amber-300">
            <span className="font-bold flex items-center gap-1.5 truncate">
              <CreditCard className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">Taxes GeniusPay (4,5% + 100 F)</span>
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 font-black text-amber-300 shrink-0">
              Passerelle
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-black text-amber-400 font-mono tracking-tight truncate">
            {formatFCFA(calculations.totalGeniusPayTaxes)}
          </div>
          <div className="flex items-center justify-between text-[10px] text-white/50 pt-0.5">
            <span className="truncate">Coûts API GeniusPay</span>
            <span className="text-amber-400 font-bold shrink-0">4,5% + 100 F</span>
          </div>
        </div>

        {/* Metric 4: Marge Nette Bénéfice Djassa (+2,1% + 50 F fixe) */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-[#101814] to-[#101012] border border-emerald-500/30 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-emerald-300">
            <span className="font-bold flex items-center gap-1.5 truncate">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="truncate">Marge Nette Djassa</span>
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 font-black text-emerald-300 shrink-0">
              +2,1% + 50 F
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-black text-emerald-400 font-mono tracking-tight truncate">
            +{formatFCFA(calculations.totalNetProfit)}
          </div>
          <div className="flex items-center justify-between text-[10px] text-white/50 pt-0.5">
            <span className="truncate">Bénéfice après taxes</span>
            <span className="text-emerald-400 font-bold shrink-0">100% Net</span>
          </div>
        </div>
      </div>

      {/* =======================================================================
          ESPACE VENDEURS & BOUTIQUES + RECHERCHE & FILTRES
          ======================================================================= */}
      <div className="rounded-2xl border border-white/10 bg-[#0E0E12] shadow-xl overflow-hidden">
        {/* En-tête unique Vendeurs */}
        <div className="border-b border-white/10 bg-[#0A0A0A]/95 backdrop-blur-md px-3 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
            <Store className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Retraits des Vendeurs &amp; Boutiques</span>
          </div>
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {tabStats.vendeur.total}
          </span>
        </div>

        {/* 1 ONGLET DE STATUT : HISTORIQUE */}
        <div 
          id="admin-withdrawals-status-tabs"
          className="border-b border-white/10 bg-[#121215]/90 backdrop-blur-md overflow-hidden sticky top-0 z-10"
        >
          <div className="grid grid-cols-1">
            {/* Onglet: Historique */}
            <button
              id="tab-btn-wth-history"
              type="button"
              onClick={() => setStatusTab('history')}
              className={`py-2.5 px-3 sm:px-4 text-xs font-bold flex flex-col justify-between transition group cursor-pointer ${
                statusTab === 'history'
                  ? 'text-sky-400 border-b-2 border-sky-400 bg-sky-500/10'
                  : 'text-white/60 hover:text-white border-b-2 border-transparent hover:bg-white/[0.02]'
              }`}
            >
              <div className="w-full flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1.5 truncate">
                  <History className={`w-3.5 h-3.5 shrink-0 ${statusTab === 'history' ? 'text-sky-400' : 'text-current'}`} />
                  <span className="truncate">Historique</span>
                </div>
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold shrink-0 ${
                  statusTab === 'history'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                    : 'bg-white/10 text-white/50'
                }`}>
                  {statusStats.history.count}
                </span>
              </div>
              <div className="w-full grid grid-cols-2 gap-1 pt-1 border-t border-white/10 text-[10px]">
                <div className="text-left">
                  <div className="text-white/40 text-[9px] uppercase font-semibold">Achats</div>
                  <div className="font-mono font-black text-white text-xs sm:text-sm">
                    {statusStats.history.count}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white/40 text-[9px] uppercase font-semibold">Gagné</div>
                  <div className="font-mono font-black text-sky-400 text-xs sm:text-sm">
                    {formatFCFA(statusStats.history.earned)}
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* 2 CARTES DE L'ONGLET ACTIF : NOMBRE DE RETRAITS ET ARGENT GAGNÉ (6,6% + 150 F FIXE) */}
        <div className="p-3 sm:p-4 border-b border-white/10">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 animate-in fade-in duration-200">
            {/* CARTE 1: NOMBRE DE RETRAITS */}
            <div className={`p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-br ${statusStats[statusTab].bgGradient} border ${statusStats[statusTab].borderColor} shadow-xl relative overflow-hidden group transition duration-300 flex flex-col justify-between`}>
              <div>
                <div className="flex items-center justify-between mb-1.5 sm:mb-2 gap-1">
                  <span className="text-[11px] sm:text-xs font-bold text-white/70 uppercase tracking-wider truncate">
                    Nombre d'achats ({statusStats[statusTab].label})
                  </span>
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-lg sm:rounded-xl bg-white/10 ${statusStats[statusTab].color} flex items-center justify-center font-black`}>
                    <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                </div>
                <div className="text-base sm:text-2xl font-black text-white font-mono tracking-tight truncate">
                  {statusStats[statusTab].count} <span className="text-xs sm:text-sm font-semibold opacity-70">retraits</span>
                </div>
              </div>
              <div className="mt-2 sm:mt-2.5 flex items-center justify-between text-[10px] sm:text-[11px] pt-1.5 sm:pt-2 border-t border-white/5 gap-1">
                <span className="text-white/50 truncate">Statut : {statusStats[statusTab].label}</span>
                <span className={`px-1.5 sm:px-2 py-0.5 rounded-full bg-white/10 ${statusStats[statusTab].color} font-bold text-[9px] sm:text-[10px] shrink-0`}>
                  {statusStats[statusTab].badge}
                </span>
              </div>
            </div>

            {/* CARTE 2: ARGENT GAGNÉ (6,6% + 150 F FIXE ENCAISSÉS) */}
            <div className={`p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-br ${statusStats[statusTab].bgGradient} border ${statusStats[statusTab].borderColor} shadow-xl relative overflow-hidden group transition duration-300 flex flex-col justify-between`}>
              <div>
                <div className="flex items-center justify-between mb-1.5 sm:mb-2 gap-1">
                  <span className="text-[11px] sm:text-xs font-bold text-white/70 uppercase tracking-wider truncate">
                    Argent gagné ({statusStats[statusTab].label})
                  </span>
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-lg sm:rounded-xl bg-white/10 ${statusStats[statusTab].color} flex items-center justify-center font-black`}>
                    <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                </div>
                <div className={`text-base sm:text-2xl font-black ${statusStats[statusTab].color} font-mono tracking-tight truncate`}>
                  {formatFCFA(statusStats[statusTab].earned)}
                </div>
              </div>
              <div className="mt-2 sm:mt-2.5 flex items-center justify-between text-[10px] sm:text-[11px] pt-1.5 sm:pt-2 border-t border-white/5 gap-1">
                <span className="text-white/50 truncate">Frais : 6,6% + 150 F fixe au retrait</span>
                <span className={`px-1.5 sm:px-2 py-0.5 rounded-full bg-white/10 ${statusStats[statusTab].color} font-bold text-[9px] sm:text-[10px] shrink-0`}>
                  {statusTab === 'approved' ? 'Encaissé' : statusTab === 'pending' ? 'En attente' : statusTab === 'rejected' ? 'Remboursé' : 'Total cumulé'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sous-barre descriptive avec indicateur de retraits, échecs, volume & recherche */}
        <div className="p-3 sm:p-4 bg-[#141417]/70 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 text-xs">
            {/* Catégorie active */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white/40 font-medium">Catégorie :</span>
              <span className="font-bold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                Boutiques &amp; Marchands certifiés
              </span>
            </div>

            {/* Statistiques clés : Retraits, Retraits Validés, Échecs & Volume - Disposés deux par deux */}
            <div className="grid grid-cols-2 gap-2 sm:gap-2.5 w-full md:w-auto">
              {/* 1. Total Retraits (Cliquable -> Tout afficher / Historique) */}
              <button
                type="button"
                onClick={() => setStatusTab('history')}
                aria-pressed={statusTab === 'history'}
                title="Afficher tous les retraits"
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-indigo-300 cursor-pointer active:scale-[0.98] transition ${
                  statusTab === 'history'
                    ? 'bg-indigo-500/25 border-indigo-400 ring-1 ring-indigo-400/60 shadow-sm shadow-indigo-500/20'
                    : 'bg-indigo-500/15 border-indigo-500/30 hover:bg-indigo-500/25 hover:border-indigo-400/60'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="text-white/75 text-[11px] font-medium truncate">Total retraits</span>
                </div>
                <span className="font-bold font-mono text-white text-xs shrink-0">
                  {tabStats[activeTab].total}
                </span>
              </button>

              {/* 2. Retraits Effectués (Cliquable -> Filtrer Effectués) */}
              <button
                type="button"
                onClick={() => setStatusTab((prev) => (prev === 'approved' ? 'history' : 'approved'))}
                aria-pressed={statusTab === 'approved'}
                title="Filtrer les retraits effectués"
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-emerald-300 cursor-pointer active:scale-[0.98] transition ${
                  statusTab === 'approved'
                    ? 'bg-emerald-500/25 border-emerald-400 ring-1 ring-emerald-400/60 shadow-sm shadow-emerald-500/20'
                    : 'bg-emerald-500/15 border-emerald-500/30 hover:bg-emerald-500/25 hover:border-emerald-400/60'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-white/75 text-[11px] font-medium truncate">Effectué</span>
                </div>
                <span className="font-bold font-mono text-emerald-300 text-xs shrink-0">
                  {tabStats[activeTab].approved}
                </span>
              </button>

              {/* 3. Retraits Échoués / Échecs (Cliquable -> Filtrer Échecs) */}
              <button
                type="button"
                onClick={() => setStatusTab((prev) => (prev === 'rejected' ? 'history' : 'rejected'))}
                aria-pressed={statusTab === 'rejected'}
                title="Filtrer les retraits échoués"
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border cursor-pointer active:scale-[0.98] transition ${
                  statusTab === 'rejected'
                    ? 'bg-rose-500/30 border-rose-400 text-rose-200 ring-1 ring-rose-400/60 shadow-sm shadow-rose-500/20'
                    : tabStats[activeTab].rejected > 0
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30 hover:border-rose-400/60'
                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:border-white/25'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <XCircle
                    className={`w-3.5 h-3.5 shrink-0 ${
                      statusTab === 'rejected' || tabStats[activeTab].rejected > 0 ? 'text-rose-400' : 'text-white/40'
                    }`}
                  />
                  <span className="text-white/75 text-[11px] font-medium truncate">Échecs</span>
                </div>
                <span
                  className={`font-bold font-mono text-xs shrink-0 ${
                    statusTab === 'rejected' || tabStats[activeTab].rejected > 0 ? 'text-rose-300' : 'text-white/50'
                  }`}
                >
                  {tabStats[activeTab].rejected}
                </span>
              </button>

              {/* 4. Volume Sollicité */}
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white/70">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-white/60 text-[11px] font-medium truncate">Volume</span>
                </div>
                <span className="font-mono font-bold text-xs shrink-0 text-amber-300">
                  {formatFCFA(tabStats.vendeur.volume)}
                </span>
              </div>
            </div>
          </div>

          {/* Barre de Recherche */}
          <div className="relative w-full">
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Rechercher un vendeur, boutique, téléphone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-500 transition"
            />
          </div>
        </div>
      </div>

      {/* =======================================================================
          WITHDRAWALS LIST CARDS
          ======================================================================= */}
      <div className="space-y-2.5">
        {filteredWithdrawals.length === 0 ? (
          <div className="p-8 text-center bg-[#141417] rounded-3xl border border-white/10 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/5 text-white/40 mx-auto flex items-center justify-center">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white">Aucune demande de retrait trouvée</h3>
            <p className="text-xs text-white/50 max-w-sm mx-auto">
              Modifiez vos critères de recherche ou réinitialisez les filtres pour afficher l'ensemble des décaissements.
            </p>
          </div>
        ) : (
          filteredWithdrawals.map((item) => {
            return (
              <div
                key={item.id}
                className={`p-4 sm:p-5 rounded-3xl border transition-all duration-300 shadow-xl space-y-3.5 relative overflow-hidden group ${
                  item.status === 'approved'
                    ? 'bg-gradient-to-br from-[#121614] via-[#131317] to-[#101014] border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-emerald-950/20'
                    : 'bg-[#121215] border-rose-500/20 hover:border-rose-500/35 hover:shadow-rose-950/20'
                }`}
              >
                {/* 1. BENEFICIARY HEADER & STATUS */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    {/* Role Avatar with photo + distinctive badge - Clickable to open full profile */}
                    <div
                      onClick={() => handleOpenUserProfile(item)}
                      className="relative cursor-pointer group/avatar shrink-0"
                      title={`Voir le profil complet de ${item.name}`}
                    >
                      <img
                        src={getActorAvatar(item)}
                        alt={item.name}
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl object-cover shrink-0 border shadow-md transition group-hover/avatar:scale-105 group-hover/avatar:ring-2 border-amber-500/40 ring-amber-400"
                      />
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg flex items-center justify-center border text-[10px] shadow-sm bg-amber-500 text-black border-amber-300">
                        <Store className="w-3 h-3" />
                      </div>
                    </div>

                    {/* Beneficiary Details */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleOpenUserProfile(item)}
                          className="text-sm sm:text-base font-black text-white hover:text-cyan-300 tracking-tight truncate flex items-center gap-1.5 transition text-left cursor-pointer group/name"
                          title={`Ouvrir le profil complet de ${item.name}`}
                        >
                          <span className="truncate group-hover/name:underline">{item.name}</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover/name:opacity-100 transition shrink-0 text-cyan-400" />
                        </button>

                        {/* Role Badge */}
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border shrink-0 bg-amber-500/20 text-amber-300 border-amber-500/30">
                          Vendeur
                        </span>

                        {/* Network Badge */}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1 ${
                            item.network === 'Wave'
                              ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                              : item.network === 'Orange Money'
                              ? 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                              : item.network === 'MTN MoMo'
                              ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
                              : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                          }`}
                        >
                          <Smartphone className="w-3 h-3 shrink-0" />
                          <span>{item.network}</span>
                        </span>

                      </div>

                      {/* Meta Info Row */}
                      <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-white/50 flex-wrap">
                        <span className="font-mono text-white/70">{item.phone}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <span>Réf :</span>
                          <strong className="font-mono text-white/80">{item.reference || item.id}</strong>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(item.reference || item.id);
                              showToast('Référence copiée 📋');
                            }}
                            className="p-0.5 text-white/40 hover:text-white transition"
                            title="Copier la référence"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </span>
                        <span>•</span>
                        <span className="text-white/40">{item.date}</span>
                      </div>
                    </div>
                  </div>

                  {/* Statut Effectué ou Échoué (uniquement 2 options) */}
                  {item.status === 'approved' && (
                    <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 flex items-center gap-1.5 shrink-0 self-start sm:self-center shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Effectué</span>
                    </span>
                  )}
                  {item.status === 'rejected' && (
                    <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/35 flex items-center gap-1.5 shrink-0 self-start sm:self-center shadow-sm">
                      <XCircle className="w-3.5 h-3.5 text-rose-400" />
                      <span>Échoué</span>
                    </span>
                  )}
                </div>

                {/* 2. MONTANT DU RETRAIT */}
                <div className="p-3 sm:p-3.5 rounded-2xl bg-black/45 border border-white/5 flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-white/60">
                    Montant du retrait
                  </span>
                  <div className="text-base sm:text-lg font-black text-cyan-300 font-mono truncate">
                    {formatFCFA(item.amount)}
                  </div>
                </div>


                {/* 3. ACTIONS TOOLBAR: FACTURE + CERTIFICATION */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5 gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedInvoiceItem(item)}
                    className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs border border-white/10 hover:border-cyan-500/40 transition flex items-center gap-2 cursor-pointer active:scale-95 shadow-sm"
                  >
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span>Voir la Facture</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {item.status === 'approved' ? (
                      <span className="text-[11px] text-emerald-400/80 font-mono font-medium flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>Décaissement certifié {item.network}</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-rose-400/80 font-mono font-medium flex items-center gap-1.5">
                        <XCircle className="w-4 h-4 text-rose-400" />
                        <span>Échec du transfert {item.network}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* =======================================================================
          MODAL FACTURE OFFICIELLE DE DÉCAISSEMENT
          ======================================================================= */}
      {selectedInvoiceItem && (() => {
        const realApiCost = selectedInvoiceItem.apiCost ?? (selectedInvoiceItem.network === 'Wave' ? 150 : selectedInvoiceItem.network === 'Orange Money' ? 200 : 100);
        const currentBalance = selectedInvoiceItem.accountBalance ?? Math.round(selectedInvoiceItem.amount * 2.5);
        const remainingBalance = Math.max(0, currentBalance - selectedInvoiceItem.amount);

        return (
          <div
            id="withdrawal-invoice-fullscreen-modal"
            className="fixed inset-0 z-[3000] w-full h-[100dvh] bg-[#EEF1F6] text-gray-900 flex flex-col overflow-hidden animate-in fade-in duration-200"
          >
            {/* Barre supérieure sticky (100% largeur) */}
            <header className="shrink-0 h-14 px-4 sm:px-6 bg-[#EEF1F6]/95 backdrop-blur-md border-b border-gray-300/80 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedInvoiceItem(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-gray-700 hover:text-gray-900 hover:bg-gray-200/80 transition cursor-pointer"
              >
                Annuler
              </button>
              <span className="text-xs font-black uppercase tracking-wider text-gray-600 truncate">
                Reçu de Transaction
              </span>
              <button
                type="button"
                onClick={() => handleShareInvoice(selectedInvoiceItem)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-cyan-700 bg-cyan-100 hover:bg-cyan-200/80 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 text-cyan-700" />
                <span>Partager</span>
              </button>
            </header>

            {/* Contenu scrollable occupant 100% de l'espace disponible */}
            <main className="flex-1 min-h-0 overflow-y-auto w-full p-4 sm:p-6 space-y-4">
              {/* Montant et Destinataire centrés (pleine largeur) */}
              <div className="w-full bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-200/80 text-center space-y-1.5">
                <div className="mx-auto w-12 h-12 rounded-full bg-[#EEF1F6] shadow-sm border border-gray-200 flex items-center justify-center text-gray-800 mb-2">
                  <Store className="w-6 h-6 text-amber-500" />
                </div>

                <div className="text-3xl sm:text-4xl font-extrabold text-gray-900 font-mono tracking-tight">
                  {formatFCFA(selectedInvoiceItem.amount)}
                </div>

                <div className="text-sm sm:text-base font-bold text-gray-800 pt-0.5">
                  {selectedInvoiceItem.name}
                </div>
                <div className="text-xs text-gray-500 font-medium">
                  {selectedInvoiceItem.phone} • Vendeur Marchand
                </div>
              </div>

              {/* Carte blanche avec les détails complets (100% largeur) */}
              <div className="w-full bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-200/80 space-y-3 text-xs sm:text-sm">
                {/* 1. Montant reçu */}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 font-medium">Montant reçu</span>
                  <span className="font-mono font-bold text-emerald-600 text-sm sm:text-base">
                    {formatFCFA(selectedInvoiceItem.netAmount)}
                  </span>
                </div>

                {/* 2. Statut */}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 font-medium">Statut</span>
                  <div>
                    {selectedInvoiceItem.status === 'approved' ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Effectué</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Échoué</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* 3. Frais de transaction facturés par Djassa */}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 font-medium">Frais de retrait Djassa (6,6% + 150 F fixe)</span>
                  <span className="font-mono font-bold text-emerald-600">
                    +{formatFCFA(selectedInvoiceItem.feeAmount)}
                  </span>
                </div>

                {/* 4. Taxes passerelle GeniusPay */}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <div className="text-left">
                    <span className="text-gray-700 font-semibold block">Taxes GeniusPay (4,5% + 100 F fixe)</span>
                    <span className="text-[11px] text-gray-400">Passerelle {selectedInvoiceItem.network}</span>
                  </div>
                  <span className="font-mono font-bold text-amber-700">
                    -{formatFCFA(calculateGeniusPayFee(selectedInvoiceItem.amount))}
                  </span>
                </div>

                {/* 4B. Marge nette Djassa */}
                <div className="flex items-center justify-between py-2.5 border-b border-gray-100 bg-emerald-50/70 px-3 rounded-xl">
                  <span className="text-emerald-800 font-bold">Marge nette Djassa (2,1% + 50 F)</span>
                  <span className="font-mono font-black text-emerald-700 text-sm sm:text-base">
                    +{formatFCFA(Math.max(0, selectedInvoiceItem.feeAmount - calculateGeniusPayFee(selectedInvoiceItem.amount)))}
                  </span>
                </div>

                {/* 5. Date et heure */}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 font-medium">Date et heure</span>
                  <span className="font-medium text-gray-700">
                    {selectedInvoiceItem.date}
                  </span>
                </div>

                {/* 6. Nouveau solde */}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500 font-medium">Nouveau solde</span>
                  <span className="font-mono font-bold text-gray-900">
                    {formatFCFA(remainingBalance)}
                  </span>
                </div>

                {/* 7. ID de transaction */}
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-500 font-medium">ID de transaction</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-gray-700 text-xs truncate max-w-[200px] sm:max-w-none">
                      {selectedInvoiceItem.reference || selectedInvoiceItem.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedInvoiceItem.reference || selectedInvoiceItem.id);
                        showToast('ID de transaction copié 📋');
                      }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition cursor-pointer"
                      title="Copier l'identifiant"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Partenaire de paiement (100% largeur) */}
              <div className="w-full bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-200/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${
                    selectedInvoiceItem.network === 'Wave'
                      ? 'bg-sky-500 text-white shadow-sm'
                      : selectedInvoiceItem.network === 'Orange Money'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : selectedInvoiceItem.network === 'MTN MoMo'
                      ? 'bg-yellow-400 text-black shadow-sm'
                      : 'bg-blue-600 text-white shadow-sm'
                  }`}>
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-gray-900">
                      {selectedInvoiceItem.network === 'Wave'
                        ? "Wave Côte d'Ivoire"
                        : selectedInvoiceItem.network === 'Orange Money'
                        ? "Orange Money CI"
                        : selectedInvoiceItem.network === 'MTN MoMo'
                        ? "MTN Mobile Money CI"
                        : "Moov Money CI (Flooz)"}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Partenaire de paiement officiel
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Sécurisé</span>
                </div>
              </div>
            </main>

            {/* Barre d'actions inférieure sticky (100% largeur) */}
            <footer className="shrink-0 px-4 sm:px-6 py-3.5 bg-white/95 backdrop-blur-md border-t border-gray-300/80 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedInvoiceItem(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs sm:text-sm transition cursor-pointer text-center"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={() => handleShareInvoice(selectedInvoiceItem)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Partager</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  showToast('Facture officielle téléchargée en PDF 📄');
                  window.print?.();
                }}
                className="p-2.5 sm:px-4 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition cursor-pointer flex items-center gap-1.5 text-xs sm:text-sm font-bold"
                title="Imprimer / Télécharger"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Imprimer</span>
              </button>
            </footer>
          </div>
        );
      })()}

      {/* =======================================================================
          MODAL REJET RETRAIT (SANS PROMPT NATIF)
          ======================================================================= */}
      {rejectModalItem && (
        <div
          className="fixed inset-0 z-[75] bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setRejectModalItem(null)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-[#141417] border border-white/15 p-4 space-y-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-white">Rejeter le retrait {rejectModalItem.id}</h4>
                <p className="text-[11px] text-white/55">
                  {rejectModalItem.name} · {formatFCFA(rejectModalItem.amount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalItem(null)}
                className="min-w-[36px] min-h-[36px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-white/65 block">Motif du rejet (facultatif)</label>
              <textarea
                rows={3}
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
                placeholder="Ex : Numéro Mobile Money ou informations invalides"
                className="w-full rounded-xl bg-[#0B0B0D] border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRejectModalItem(null)}
                className="min-h-[40px] px-4 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/80 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmRejectWithdrawal}
                className="min-h-[40px] px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white cursor-pointer"
              >
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL DÉTAILS PROFIL COMPLET VENDEUR
          ======================================================================= */}
      {selectedUserProfile && (
        <AdminUserDetailModal
          user={selectedUserProfile}
          onClose={() => setSelectedUserProfile(null)}
        />
      )}
    </div>
  );
};
