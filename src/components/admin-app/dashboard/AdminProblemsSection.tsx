import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  RotateCcw, 
  ShieldAlert, 
  ShieldCheck,
  Send, 
  Plus, 
  ChevronRight, 
  Filter, 
  Phone,
  User,
  Store,
  Bike,
  Search,
  MessageCircle,
  Copy,
  Check,
  MapPin,
  CreditCard,
  FileText,
  Sparkles,
  RefreshCw,
  X,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  Truck,
  DollarSign,
  Zap,
  Info
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { formatFCFA } from '../../../services/marketServices';

// =============================================================================
// TYPES & DATA STRUCTURES
// =============================================================================

export type ProblemType = 
  | 'livraison_retard' 
  | 'produit_non_conforme' 
  | 'client_injoignable' 
  | 'litige_paiement' 
  | 'panne_livreur'
  | 'annulation_abusive'
  | 'colis_endommage';

export type ProblemStatus = 
  | 'pending' 
  | 'investigating' 
  | 'resolved' 
  | 'refunded' 
  | 'reassigned';

export interface AdminProblemIncident {
  id: string;
  title: string;
  orderNumber: string;
  clientName: string;
  clientPhone: string;
  sellerName: string;
  sellerPhone?: string;
  driverName?: string;
  driverPhone?: string;
  commune: string;
  amount: number;
  type: ProblemType;
  severity: 'high' | 'medium' | 'low';
  status: ProblemStatus;
  description: string;
  createdAt: string;
  resolutionNote?: string;
  evidence?: {
    type: 'image' | 'gps' | 'payment_log' | 'call_log';
    label: string;
    detail: string;
  };
  clientStatement?: string;
  sellerStatement?: string;
  driverStatement?: string;
  escrowStatus: 'locked' | 'refunded' | 'released' | 'partial';
}

const INITIAL_PROBLEMS: AdminProblemIncident[] = [
  {
    id: 'INC-2026-01',
    title: 'Colis non livré après 3h d’attente au point relais',
    orderNumber: 'DJA-9821',
    clientName: 'Sarah Konan',
    clientPhone: '+225 07 77 88 99 00',
    sellerName: 'Boutique Wax & Élégance (Adjamé Marché)',
    sellerPhone: '+225 01 23 45 67 89',
    driverName: 'Kouamé Sylvain',
    driverPhone: '+225 05 98 76 54 32',
    commune: 'Cocody Vallon',
    amount: 32000,
    type: 'livraison_retard',
    severity: 'high',
    status: 'pending',
    description: 'La cliente attend son ensemble pagne Wax pour une cérémonie prévue à 14h. Le motard indique être bloqué dans un carambolage au Carrefour Indénié depuis 50 min.',
    createdAt: 'Il y a 35 min',
    evidence: {
      type: 'gps',
      label: 'Trace Télémétrie GPS',
      detail: 'Motard stationnaire vitesse 0 km/h au Carrefour Indénié depuis 11h15'
    },
    clientStatement: 'J’ai déjà payé 32 000 FCFA par Wave. Si le colis n’arrive pas avant 13h30, je souhaite un remboursement immédiat.',
    sellerStatement: 'Le colis a été remis au motard à 10h45 en parfait état devant le marché Gouro.',
    driverStatement: 'Embouteillage monstre avec la police qui dévie la voie. Je fais le maximum pour passer par Williamsville.',
    escrowStatus: 'locked'
  },
  {
    id: 'INC-2026-02',
    title: 'Produit défectueux / Ourlet et tissu déchiré au déballage',
    orderNumber: 'DJA-8714',
    clientName: 'Marcelle Bamba',
    clientPhone: '+225 05 12 34 56 78',
    sellerName: 'Élégance Féminine Abidjan',
    sellerPhone: '+225 07 11 22 33 44',
    driverName: 'Moussa Bakayoko',
    driverPhone: '+225 07 33 44 55 66',
    commune: 'Marcory Zone 4',
    amount: 18500,
    type: 'produit_non_conforme',
    severity: 'high',
    status: 'investigating',
    description: 'La cliente a réceptionné la robe mais la couture de l’ourlet gauche est déchirée sur 10 cm. Elle refuse l’article et exige un échange express ou remboursement.',
    createdAt: 'Il y a 1h 40 min',
    evidence: {
      type: 'image',
      label: 'Photo constatation cliente',
      detail: 'Photo transmise au support : déchirure nette le long de l’ourlet latéral'
    },
    clientStatement: 'Impossible de porter une robe déchirée. Le livreur est témoin que j’ai ouvert devant lui.',
    sellerStatement: 'La robe est sortie impeccable de mon atelier. Le tissu a dû être accroché pendant le transport dans le sac de livraison.',
    driverStatement: 'Le paquet plastique était déjà froissé quand la vendeuse me l’a donné.',
    escrowStatus: 'locked'
  },
  {
    id: 'INC-2026-03',
    title: 'Client injoignable au point de rendez-vous convenu',
    orderNumber: 'DJA-9830',
    clientName: 'Ibrahim Touré',
    clientPhone: '+225 07 99 11 22 33',
    sellerName: 'Adjamé High-Tech Store',
    sellerPhone: '+225 01 99 88 77 66',
    driverName: 'Kouamé Sylvain',
    driverPhone: '+225 05 98 76 54 32',
    commune: 'Yopougon Duncan',
    amount: 45000,
    type: 'client_injoignable',
    severity: 'medium',
    status: 'pending',
    description: 'Le motard est sur place au Carrefour Duncan depuis 30 minutes avec des écouteurs sans fil. Le téléphone du client sonne sans réponse.',
    createdAt: 'Il y a 55 min',
    evidence: {
      type: 'call_log',
      label: 'Journal d’appels livreur',
      detail: '4 appels sortants vers +225 07 99 11 22 33 restés sans réponse entre 11h40 et 12h05'
    },
    clientStatement: 'Client injoignable (boîte vocale ou sonne dans le vide).',
    sellerStatement: 'Commande confirmée ce matin à 9h par SMS.',
    driverStatement: 'J’ai déjà attendu 30 minutes. Si je reste plus longtemps, mes autres livraisons de la journée seront en retard.',
    escrowStatus: 'locked'
  },
  {
    id: 'INC-2026-04',
    title: 'Double débit Wave / Séquestre plateforme non validé',
    orderNumber: 'DJA-9902',
    clientName: 'Ange Brou',
    clientPhone: '+225 01 44 55 66 77',
    sellerName: 'Parfums de Luxe Plateau',
    sellerPhone: '+225 07 55 66 77 88',
    commune: 'Plateau',
    amount: 27000,
    type: 'litige_paiement',
    severity: 'high',
    status: 'pending',
    description: 'Le client a été débité 27 000 FCFA sur son compte Wave (Réf: WV-991280), mais la passerelle a retourné un timeout et la commande est restée en attente.',
    createdAt: 'Il y a 2h 10 min',
    evidence: {
      type: 'payment_log',
      label: 'Preuve webhook Wave Money',
      detail: 'Transaction #WV-991280 avec statut SUCCESS côté Wave, confirmation requise'
    },
    clientStatement: 'Mon solde Wave a diminué de 27 000 FCFA. Voici le SMS de reçu reçu de Wave CI.',
    sellerStatement: 'Je n’ai pas encore préparé la commande car le statut indiquait impayé.',
    escrowStatus: 'locked'
  },
  {
    id: 'INC-2026-05',
    title: 'Panne mécanique moto livreur (crevaison pneu arrière)',
    orderNumber: 'DJA-9799',
    clientName: 'Aline Zadi',
    clientPhone: '+225 01 02 03 04 05',
    sellerName: 'Chaussures Adjamé Chic',
    sellerPhone: '+225 05 55 44 33 22',
    driverName: 'Moussa Bakayoko',
    driverPhone: '+225 07 33 44 55 66',
    commune: 'Treichville Boulevard',
    amount: 15000,
    type: 'panne_livreur',
    severity: 'medium',
    status: 'reassigned',
    description: 'Crevaison brutale du pneu moto à la sortie du Pont Général De Gaulle. Course transférée avec succès à un motard relais.',
    createdAt: 'Hier à 16:20',
    resolutionNote: 'Course reprise par Amara Diomandé en 10 minutes. Colis livré à la cliente avec 25 min de décalage.',
    evidence: {
      type: 'gps',
      label: 'Rapport Dispatch Flotte',
      detail: 'Relais assuré à Treichville. Client informée par notification SMS.'
    },
    escrowStatus: 'released'
  },
  {
    id: 'INC-2026-06',
    title: 'Annulation abusive après chargement du colis au marché',
    orderNumber: 'DJA-9740',
    clientName: 'David Koffi',
    clientPhone: '+225 07 20 30 40 50',
    sellerName: 'Adjamé Textile Grossiste',
    sellerPhone: '+225 07 88 99 00 11',
    driverName: 'Bakary Sangaré',
    driverPhone: '+225 05 11 22 33 44',
    commune: 'Abobo Gare',
    amount: 52000,
    type: 'annulation_abusive',
    severity: 'low',
    status: 'resolved',
    description: 'Le client a cliqué sur annuler alors que le motard avait déjà récupéré le rouleau de tissu et roulait vers Abobo.',
    createdAt: 'Hier à 11:15',
    resolutionNote: 'Arbitrage rendu : Colis retourné au vendeur. Frais de retour de 2 000 FCFA déduits de l’avoir de commande pour dédommager le livreur.',
    escrowStatus: 'released'
  }
];

export const AdminProblemsSection: React.FC = () => {
  const { 
    addAuditLog, 
    showToast, 
    startCall, 
    openChatWithParticipant,
    orders 
  } = useApp();

  const [problems, setProblems] = useState<AdminProblemIncident[]>(() => {
    try {
      const saved = localStorage.getItem('djassa_admin_problems_v2');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : INITIAL_PROBLEMS;
    } catch {
      return INITIAL_PROBLEMS;
    }
  });

  // Filters state
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'investigating' | 'resolved' | 'reassigned'>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCommune, setFilterCommune] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Selected problem for full arbitration modal
  const [selectedProblem, setSelectedProblem] = useState<AdminProblemIncident | null>(null);
  const [arbitrationDecision, setArbitrationDecision] = useState<'refund_client' | 'release_seller' | 'split_50_50'>('refund_client');
  const [arbitrationNote, setArbitrationNote] = useState('');

  // Modal to add new incident
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newOrderNum, setNewOrderNum] = useState('');
  const [newClient, setNewClient] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('+225 ');
  const [newSeller, setNewSeller] = useState('');
  const [newCommune, setNewCommune] = useState('Cocody');
  const [newAmount, setNewAmount] = useState('20000');
  const [newType, setNewType] = useState<ProblemType>('livraison_retard');
  const [newSeverity, setNewSeverity] = useState<'high' | 'medium' | 'low'>('high');
  const [newDesc, setNewDesc] = useState('');

  const saveProblems = (next: AdminProblemIncident[]) => {
    setProblems(next);
    localStorage.setItem('djassa_admin_problems_v2', JSON.stringify(next));
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    showToast(`Réf ${text} copiée ! 📋`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 1. Rembourser le client depuis le séquestre Djassa
  const handleRefundClient = (item: AdminProblemIncident, customNote?: string) => {
    const note = customNote || `Remboursement intégral Wave/OM de ${formatFCFA(item.amount)} déclenché vers l'acheteur ${item.clientName}. Litige clôturé.`;
    const next = problems.map((p) =>
      p.id === item.id 
        ? { 
            ...p, 
            status: 'refunded' as const, 
            escrowStatus: 'refunded' as const,
            resolutionNote: note 
          } 
        : p
    );
    saveProblems(next);
    addAuditLog(
      'Litige Résolu / Remboursement Client',
      item.orderNumber || item.id,
      'financial',
      `Arbitrage faveur client : Remboursement de ${formatFCFA(item.amount)} approuvé pour ${item.clientName}. ${note}`
    );
    showToast(`Remboursement de ${formatFCFA(item.amount)} exécuté vers ${item.clientName} 💸`);
    if (selectedProblem?.id === item.id) setSelectedProblem(null);
  };

  // 2. Débloquer les fonds en faveur du marchand
  const handleReleaseFundsToSeller = (item: AdminProblemIncident, customNote?: string) => {
    const note = customNote || `Arbitrage en faveur de la boutique ${item.sellerName}. Fonds du séquestre (${formatFCFA(item.amount)}) débloqués et versés sur son solde disponible.`;
    const next = problems.map((p) =>
      p.id === item.id 
        ? { 
            ...p, 
            status: 'resolved' as const, 
            escrowStatus: 'released' as const,
            resolutionNote: note 
          } 
        : p
    );
    saveProblems(next);
    addAuditLog(
      'Litige Résolu / Faveur Marchand',
      item.orderNumber || item.id,
      'order',
      `Arbitrage faveur marchand : ${item.sellerName} crédité de ${formatFCFA(item.amount)}. ${note}`
    );
    showToast(`Fonds de ${formatFCFA(item.amount)} débloqués pour ${item.sellerName} ✅`);
    if (selectedProblem?.id === item.id) setSelectedProblem(null);
  };

  // 3. Mettre sous enquête approfondie
  const handleSetInvestigating = (item: AdminProblemIncident) => {
    const next = problems.map((p) =>
      p.id === item.id ? { ...p, status: 'investigating' as const } : p
    );
    saveProblems(next);
    addAuditLog(
      'Ouverture Enquête Litige',
      item.orderNumber || item.id,
      'order',
      `Enquête ouverte par l'administrateur Djassa. Délai d'instruction fixé à 24h.`
    );
    showToast(`Dossier #${item.id} mis sous instruction & expertise 🔍`);
    if (selectedProblem?.id === item.id) {
      setSelectedProblem({ ...selectedProblem, status: 'investigating' });
    }
  };

  // 4. Arbitrage 50/50 (Partage de responsabilité)
  const handleSplit5050 = (item: AdminProblemIncident) => {
    const half = Math.round(item.amount / 2);
    const note = `Arbitrage de conciliation 50/50 : ${formatFCFA(half)} remboursés au client, ${formatFCFA(half)} versés à la boutique avec garantie Djassa.`;
    const next = problems.map((p) =>
      p.id === item.id 
        ? { 
            ...p, 
            status: 'resolved' as const, 
            escrowStatus: 'partial' as const,
            resolutionNote: note 
          } 
        : p
    );
    saveProblems(next);
    addAuditLog(
      'Arbitrage Conciliation 50/50',
      item.orderNumber || item.id,
      'financial',
      note
    );
    showToast(`Conciliation 50/50 validée (${formatFCFA(half)} chacun) ⚖️`);
    if (selectedProblem?.id === item.id) setSelectedProblem(null);
  };

  // 5. Enregistrer un nouvel incident
  const handleCreateIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newIncident: AdminProblemIncident = {
      id: `INC-2026-${Math.floor(10 + Math.random() * 90)}`,
      title: newTitle,
      orderNumber: newOrderNum.trim() ? (newOrderNum.startsWith('DJA-') ? newOrderNum : `DJA-${newOrderNum}`) : `DJA-${Math.floor(1000 + Math.random() * 9000)}`,
      clientName: newClient || 'Client Acheteur',
      clientPhone: newClientPhone || '+225 07 00 00 00 00',
      sellerName: newSeller || 'Boutique Partenaire',
      commune: newCommune,
      amount: parseInt(newAmount) || 15000,
      type: newType,
      severity: newSeverity,
      status: 'pending',
      description: newDesc || 'Incident enregistré manuellement par le support d’arbitrage Djassa.',
      createdAt: 'À l’instant',
      escrowStatus: 'locked'
    };

    saveProblems([newIncident, ...problems]);
    addAuditLog(
      'Déclaration Incident Support',
      newIncident.orderNumber,
      'order',
      `Ouverture litige #${newIncident.id} (${newIncident.title}) pour un montant de ${formatFCFA(newIncident.amount)}`
    );
    showToast(`Litige #${newIncident.id} ouvert et consigné au registre 🚨`);
    setIsAddModalOpen(false);
    setNewTitle('');
    setNewOrderNum('');
    setNewClient('');
    setNewSeller('');
    setNewDesc('');
  };

  // Validation du modal d'arbitrage
  const handleExecuteArbitration = () => {
    if (!selectedProblem) return;
    if (arbitrationDecision === 'refund_client') {
      handleRefundClient(selectedProblem, arbitrationNote);
    } else if (arbitrationDecision === 'release_seller') {
      handleReleaseFundsToSeller(selectedProblem, arbitrationNote);
    } else if (arbitrationDecision === 'split_50_50') {
      handleSplit5050(selectedProblem);
    }
  };

  // Calculs KPI
  const lockedEscrowTotal = useMemo(() => {
    return problems
      .filter((p) => p.status === 'pending' || p.status === 'investigating')
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [problems]);

  const urgentCount = useMemo(() => {
    return problems.filter((p) => p.severity === 'high' && (p.status === 'pending' || p.status === 'investigating')).length;
  }, [problems]);

  const pendingCount = useMemo(() => {
    return problems.filter((p) => p.status === 'pending').length;
  }, [problems]);

  const resolvedCount = useMemo(() => {
    return problems.filter((p) => p.status === 'resolved' || p.status === 'refunded').length;
  }, [problems]);

  // Filtrage combiné
  const filteredProblems = useMemo(() => {
    return problems.filter((p) => {
      // Filter status
      if (filterStatus === 'pending' && p.status !== 'pending') return false;
      if (filterStatus === 'investigating' && p.status !== 'investigating') return false;
      if (filterStatus === 'resolved' && (p.status !== 'resolved' && p.status !== 'refunded')) return false;
      if (filterStatus === 'reassigned' && p.status !== 'reassigned') return false;

      // Filter type
      if (filterType !== 'all' && p.type !== filterType) return false;

      // Filter commune
      if (filterCommune !== 'all' && !p.commune.toLowerCase().includes(filterCommune.toLowerCase())) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = p.title.toLowerCase().includes(q);
        const matchClient = p.clientName.toLowerCase().includes(q);
        const matchSeller = p.sellerName.toLowerCase().includes(q);
        const matchDriver = p.driverName?.toLowerCase().includes(q);
        const matchOrder = p.orderNumber.toLowerCase().includes(q);
        const matchId = p.id.toLowerCase().includes(q);
        const matchCommune = p.commune.toLowerCase().includes(q);
        if (!matchTitle && !matchClient && !matchSeller && !matchDriver && !matchOrder && !matchId && !matchCommune) {
          return false;
        }
      }

      return true;
    });
  }, [problems, filterStatus, filterType, filterCommune, searchQuery]);

  const communesList = [
    'Toutes',
    'Cocody',
    'Adjamé',
    'Yopougon',
    'Marcory',
    'Plateau',
    'Treichville',
    'Koumassi',
    'Abobo',
    'Port-Bouët'
  ];

  const typeLabels: Record<ProblemType, { label: string; icon: string; badgeColor: string }> = {
    livraison_retard: { label: 'Retard / Livreur Bloqué', icon: '🛵', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    produit_non_conforme: { label: 'Produit Défectueux / Déchiré', icon: '👗', badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
    client_injoignable: { label: 'Client Injoignable', icon: '📞', badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
    litige_paiement: { label: 'Séquestre / Paiement Wave', icon: '💳', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    panne_livreur: { label: 'Panne Moto / Logistique', icon: '⚙️', badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
    annulation_abusive: { label: 'Annulation Abusive', icon: '🛑', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
    colis_endommage: { label: 'Colis Endommagé', icon: '📦', badgeColor: 'bg-red-500/20 text-red-300 border-red-500/30' }
  };

  return (
    <div className="space-y-4 pb-12 select-none">
      {/* 1. EN-TÊTE OFFICIEL DE LA CELLULE D'ARBITRAGE */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-neutral-900 via-[#161616] to-neutral-900 border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#FE2C55]/15 via-orange-500/10 to-transparent blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-[#FE2C55]/20 border border-[#FE2C55]/40 text-[#FE2C55] text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FE2C55] animate-ping" />
                <span>Cellule Arbitrage & SAV Djassa</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-extrabold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                <span>Garantie Séquestre 100% Active</span>
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#FE2C55]" />
              <span>Gestion des Litiges, Réclamations & SAV</span>
            </h1>
            <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
              Médiation centralisée entre acheteurs, marchands et motards à Abidjan. Arbitrage officiel des remboursements Wave/Orange Money et dispatch de secours.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
            <button
              type="button"
              onClick={() => {
                showToast('Audit du compte séquestre synchronisé avec Wave & OM ⚡');
                saveProblems([...problems]);
              }}
              className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              title="Rafraîchir les flux"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Actualiser</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-3.5 py-2.5 bg-gradient-to-r from-[#FF6321] to-[#ff7d47] hover:from-[#e55317] hover:to-[#FF6321] text-white text-xs font-black rounded-2xl shadow-lg shadow-orange-950/40 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Ouvrir un Litige</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. BAROMÈTRE FINANCIER & STATISTIQUES SÉQUESTRE */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Card 1: Fonds sous séquestre */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-neutral-900 to-[#141414] border border-white/10 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Fonds Séquestrés</span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-1.5">
            <p className="text-base sm:text-lg font-black text-amber-400 font-mono tracking-tight">
              {formatFCFA(lockedEscrowTotal)}
            </p>
          </div>
          <p className="text-[10px] text-white/40 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>Gelés en attente d'arbitrage</span>
          </p>
        </div>

        {/* Card 2: Urgences & Alerte Rouge */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-rose-950/40 via-neutral-900 to-[#141414] border border-rose-500/30 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-rose-300 font-bold uppercase tracking-wider">Urgences 24h</span>
            <div className="w-7 h-7 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-3.5 h-3.5 animate-pulse" />
            </div>
          </div>
          <div className="my-1.5">
            <p className="text-base sm:text-lg font-black text-rose-400">
              {urgentCount} <span className="text-xs font-normal text-white/50">litige(s)</span>
            </p>
          </div>
          <p className="text-[10px] text-rose-300 font-medium truncate">
            {urgentCount > 0 ? '🚨 Priorité d’action immédiate' : '✓ Aucune urgence bloquante'}
          </p>
        </div>

        {/* Card 3: Délai moyen de résolution */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-neutral-900 to-[#141414] border border-white/10 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Délai Moyen Conciliation</span>
            <div className="w-7 h-7 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-1.5">
            <p className="text-base sm:text-lg font-black text-cyan-300 font-mono">
              18 min <span className="text-[11px] font-sans text-white/50">/ litige</span>
            </p>
          </div>
          <p className="text-[10px] text-emerald-400 font-medium">
            ⚡ Fast-arbitrage Abidjan
          </p>
        </div>

        {/* Card 4: Taux de résolution amiable */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-neutral-900 to-[#141414] border border-white/10 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Taux de Résolution</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-1.5">
            <p className="text-base sm:text-lg font-black text-emerald-400">
              96.2% <span className="text-xs font-normal text-white/50">({resolvedCount} clos)</span>
            </p>
          </div>
          <p className="text-[10px] text-emerald-400/90 font-medium">
            ✓ Zéro perte pour les parties
          </p>
        </div>
      </div>

      {/* 3. BARRE DE RECHERCHE & FILTRAGE AVANCÉ */}
      <div className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-3">
        {/* Ligne 1: Champ de recherche */}
        <div className="relative">
          <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par référence (#INC-01, #DJA-9821), client, boutique, motard ou commune..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-8 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FE2C55] transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Ligne 2: Filtres par statut */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              filterStatus === 'all'
                ? 'bg-white text-black shadow-md'
                : 'bg-white/5 text-white/60 hover:text-white border border-white/5'
            }`}
          >
            <span>Tous les Litiges</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 font-black">
              {problems.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              filterStatus === 'pending'
                ? 'bg-[#FE2C55] text-white shadow-md shadow-[#FE2C55]/30'
                : 'bg-white/5 text-white/60 hover:text-white border border-white/5'
            }`}
          >
            <span>🚨 En Attente ({pendingCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('investigating')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              filterStatus === 'investigating'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/30'
                : 'bg-white/5 text-white/60 hover:text-white border border-white/5'
            }`}
          >
            <span>🔍 Sous Enquête</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('reassigned')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              filterStatus === 'reassigned'
                ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30'
                : 'bg-white/5 text-white/60 hover:text-white border border-white/5'
            }`}
          >
            <span>🛵 Relais / Réassignés</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('resolved')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              filterStatus === 'resolved'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'bg-white/5 text-white/60 hover:text-white border border-white/5'
            }`}
          >
            <span>✅ Clos & Remboursés ({resolvedCount})</span>
          </button>
        </div>

        {/* Ligne 3: Filtre par motif & par commune */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/50 font-medium shrink-0">Motif :</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-[#FE2C55]"
            >
              <option value="all">Tous les motifs</option>
              <option value="livraison_retard">🛵 Retard / Livreur Bloqué</option>
              <option value="produit_non_conforme">👗 Produit Non Conforme / Déchiré</option>
              <option value="client_injoignable">📞 Client Injoignable</option>
              <option value="litige_paiement">💳 Paiement / Séquestre Wave</option>
              <option value="panne_livreur">⚙️ Panne Moto / Incident</option>
              <option value="annulation_abusive">🛑 Annulation Abusive</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/50 font-medium shrink-0">Commune :</span>
            <select
              value={filterCommune}
              onChange={(e) => setFilterCommune(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-[#FE2C55]"
            >
              {communesList.map((comm) => (
                <option key={comm} value={comm === 'Toutes' ? 'all' : comm}>
                  {comm === 'Toutes' ? 'Toutes les communes d’Abidjan' : `📍 ${comm}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. LISTE PRINCIPALE DES LITIGES AVEC CARTES MULTI-ACTIONS */}
      <div className="space-y-3">
        {filteredProblems.length === 0 ? (
          <div className="p-8 rounded-3xl bg-[#141414] border border-white/10 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-white">Aucun litige correspondant trouvé</p>
            <p className="text-xs text-white/50">Tous les flux et transactions sur ce filtre sont fluides et opérationnels.</p>
          </div>
        ) : (
          filteredProblems.map((item) => {
            const typeInfo = typeLabels[item.type] || { label: item.type, icon: '⚠️', badgeColor: 'bg-white/10 text-white' };
            const isResolved = item.status === 'resolved' || item.status === 'refunded';

            return (
              <div
                key={item.id}
                className={`p-3.5 sm:p-4 rounded-3xl border transition duration-200 space-y-3.5 shadow-xl bg-gradient-to-br from-[#141414] via-[#101010] to-[#161616] ${
                  item.severity === 'high' && !isResolved
                    ? 'border-rose-500/40 hover:border-rose-500/70 shadow-rose-950/20'
                    : isResolved
                    ? 'border-emerald-500/25 hover:border-emerald-500/40'
                    : 'border-white/10 hover:border-white/20'
                }`}
              >
                {/* LIGNE 1 : HEADER FICHE LITIGE (RÉFÉRENCES, BADGES ET MONTANT SÉQUESTRÉ) */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-1.5">
                      {/* Réf Litige */}
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/60 border border-white/15 text-white font-mono font-bold text-[10px]">
                        <span>#{item.id}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.id, item.id)}
                          className="text-white/50 hover:text-white"
                          title="Copier la référence litige"
                        >
                          {copiedId === item.id ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                        </button>
                      </div>

                      {/* N° Commande */}
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono font-bold text-[10px]">
                        <span>Cmd #{item.orderNumber}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.orderNumber, item.orderNumber)}
                          className="text-purple-300/60 hover:text-purple-200"
                          title="Copier la référence commande"
                        >
                          {copiedId === item.orderNumber ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                        </button>
                      </div>

                      {/* Gravité */}
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        item.severity === 'high' 
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse' 
                          : item.severity === 'medium'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}>
                        {item.severity === 'high' ? '🚨 Critique 24h' : item.severity === 'medium' ? '⚠️ Modéré' : 'ℹ️ Standard'}
                      </span>

                      {/* Statut du litige */}
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                        item.status === 'pending'
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          : item.status === 'investigating'
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : item.status === 'refunded'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : item.status === 'reassigned'
                          ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                          : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                      }`}>
                        {item.status === 'pending' && 'En attente d’arbitrage'}
                        {item.status === 'investigating' && '🔍 Enquête active'}
                        {item.status === 'refunded' && '💸 Remboursé acheteur'}
                        {item.status === 'reassigned' && '🛵 Relais motard actif'}
                        {item.status === 'resolved' && '✅ Validé marchand'}
                      </span>

                      {/* Motif */}
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${typeInfo.badgeColor} inline-flex items-center gap-1`}>
                        <span>{typeInfo.icon}</span>
                        <span>{typeInfo.label}</span>
                      </span>

                      {/* Commune */}
                      <span className="text-[10px] text-white/50 flex items-center gap-0.5 font-medium">
                        <MapPin className="w-3 h-3 text-[#FF6321]" />
                        <span>{item.commune}</span>
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-black text-white leading-snug">
                      {item.title}
                    </h3>
                  </div>

                  {/* Bloc Montant Séquestré & Date */}
                  <div className="text-left sm:text-right shrink-0 bg-black/40 sm:bg-transparent p-2 sm:p-0 rounded-xl sm:rounded-none border border-white/5 sm:border-none">
                    <span className="text-[10px] text-white/40 block">Montant Sous Séquestre</span>
                    <p className="text-base sm:text-lg font-black text-[#FF6321] font-mono tracking-tight">
                      {formatFCFA(item.amount)}
                    </p>
                    <span className="text-[9px] text-white/50 flex items-center sm:justify-end gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{item.createdAt}</span>
                    </span>
                  </div>
                </div>

                {/* LIGNE 2 : EXPLICATION SYNTHÉTIQUE DU LITIGE */}
                <div className="p-3 rounded-2xl bg-black/50 border border-white/5 text-xs text-white/80 leading-relaxed">
                  <p>{item.description}</p>

                  {/* Preuve attachée si existante */}
                  {item.evidence && (
                    <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center gap-2 text-[11px] text-white/70">
                      <span className="font-bold text-[#FF6321] flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        <span>{item.evidence.label} :</span>
                      </span>
                      <span className="text-white/60 truncate">{item.evidence.detail}</span>
                    </div>
                  )}
                </div>

                {/* LIGNE 3 : LES 3 ACTEURS IMPLIQUÉS (CLIENT, VENDEUR, LIVREUR) AVEC ACTIONS TÉL & CHAT DIRECTES */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Acteur 1: Client / Acheteur */}
                  <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <span className="text-[9px] text-white/40 block font-bold uppercase">Client Acheteur</span>
                        <p className="text-xs font-bold text-white truncate">{item.clientName}</p>
                        <p className="text-[9px] text-white/50 font-mono truncate">{item.clientPhone}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            startCall(item.clientPhone, 'client');
                          } catch {
                            showToast(`Appel vers la cliente ${item.clientName}... 📞`);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 transition"
                        title="Appeler l'acheteur"
                      >
                        <Phone className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          openChatWithParticipant({
                            participantId: item.id,
                            participantName: item.clientName,
                            participantType: 'client',
                            participantRoleSubtitle: `Litige #${item.orderNumber} • ${item.title}`
                          });
                          showToast(`Discussion litige ouverte avec ${item.clientName} 💬`);
                        }}
                        className="p-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 transition"
                        title="Chat support avec le client"
                      >
                        <MessageCircle className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Acteur 2: Vendeur / Marchand */}
                  <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 flex items-center justify-center shrink-0">
                        <Store className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <span className="text-[9px] text-white/40 block font-bold uppercase">Boutique Vendeuse</span>
                        <p className="text-xs font-bold text-white truncate">{item.sellerName}</p>
                        <p className="text-[9px] text-amber-400 font-bold truncate">Marché Adjamé / Plateau</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            startCall(item.sellerPhone || '+225 01 02 03 04 05', 'seller');
                          } catch {
                            showToast(`Appel vers la boutique ${item.sellerName}... 📞`);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 transition"
                        title="Appeler la boutique"
                      >
                        <Phone className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          openChatWithParticipant({
                            participantId: item.id + '-seller',
                            participantName: item.sellerName,
                            participantType: 'seller',
                            participantRoleSubtitle: `Arbitrage #${item.orderNumber}`
                          });
                          showToast(`Chat ouvert avec la boutique ${item.sellerName} 💬`);
                        }}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 transition"
                        title="Chat avec le vendeur"
                      >
                        <MessageCircle className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Acteur 3: Livraison gérée par le vendeur */}
                  <div className="p-2.5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 flex items-center justify-center shrink-0">
                        <Truck className="w-3.5 h-3.5" />
                      </div>
                      <div className="truncate">
                        <span className="text-[9px] text-white/40 block font-bold uppercase">Livraison Vendeur</span>
                        <p className="text-xs font-bold text-white truncate">Organisée hors DJASSA</p>
                        <p className="text-[9px] text-cyan-400 font-bold truncate">Suivi direct avec {item.sellerName}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* LIGNE 4 : NOTE OFFICIELLE DE RÉSOLUTION SI CLÔTURÉ */}
                {item.resolutionNote && (
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black text-emerald-300 block mb-0.5">Décision d’arbitrage enregistrée :</span>
                      <p className="text-emerald-200/90 leading-relaxed">{item.resolutionNote}</p>
                    </div>
                  </div>
                )}

                {/* LIGNE 5 : TOOLBAR DES ACTIONS D'ARBITRAGE RAPIDE */}
                {!isResolved && (
                  <div className="pt-2 border-t border-white/5 flex items-center flex-wrap gap-2">
                    {/* Bouton 1: Rembourser le client */}
                    <button
                      type="button"
                      onClick={() => handleRefundClient(item)}
                      className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transition active:scale-95 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Rembourser Client ({formatFCFA(item.amount)})</span>
                    </button>

                    {/* Bouton 2: Valider et verser au vendeur */}
                    <button
                      type="button"
                      onClick={() => handleReleaseFundsToSeller(item)}
                      className="px-3 py-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-md shadow-purple-950/40 transition active:scale-95 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Libérer Fonds Vendeur</span>
                    </button>

                    {/* Bouton 3: Mettre sous enquête */}
                    {item.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleSetInvestigating(item)}
                        className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Mettre sous Enquête</span>
                      </button>
                    )}

                    {/* Bouton 4: Contacter la boutique au sujet de la livraison */}
                    {(item.type === 'livraison_retard' || item.type === 'panne_livreur' || item.type === 'client_injoignable') && (
                      <button
                        type="button"
                        onClick={() => {
                          openChatWithParticipant({
                            participantId: item.id + '-seller',
                            participantName: item.sellerName,
                            participantType: 'seller',
                            participantRoleSubtitle: `Suivi livraison #${item.orderNumber}`
                          });
                          showToast(`Relance livraison envoyée à ${item.sellerName}`);
                        }}
                        className="px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Relancer Vendeur</span>
                      </button>
                    )}

                    {/* Bouton 6: Ouvrir le dossier complet */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProblem(item);
                        setArbitrationNote('');
                      }}
                      className="ml-auto px-3.5 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#FF6321]" />
                      <span>Dossier Complet & Arbitrage</span>
                      <ChevronRight className="w-3.5 h-3.5 text-white/50" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 5. GRAND MODAL D'ARBITRAGE JURIDIQUE & CONCILIATION DJASSA */}
      {selectedProblem && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#141414] border border-white/15 rounded-3xl w-full max-w-2xl p-5 sm:p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-[#FE2C55]/20 border border-[#FE2C55]/40 text-[#FE2C55] flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    Arbitrage Judiciaire Djassa • Dossier #{selectedProblem.id}
                  </h3>
                  <p className="text-xs text-white/50">
                    Commande #{selectedProblem.orderNumber} • Montant séquestré : {formatFCFA(selectedProblem.amount)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedProblem(null)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            {/* Confrontation des 3 versions */}
            <div className="space-y-2">
              <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider block">
                Confrontation des versions & Témoignages
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                {/* Version Cliente */}
                <div className="p-3 rounded-2xl bg-purple-950/20 border border-purple-500/20 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-purple-300 text-[11px]">
                    <User className="w-3.5 h-3.5" />
                    <span>Acheteur ({selectedProblem.clientName})</span>
                  </div>
                  <p className="text-white/80 text-[11px] leading-relaxed italic">
                    "{selectedProblem.clientStatement || selectedProblem.description}"
                  </p>
                </div>

                {/* Version Marchand */}
                <div className="p-3 rounded-2xl bg-amber-950/20 border border-amber-500/20 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300 text-[11px]">
                    <Store className="w-3.5 h-3.5" />
                    <span>Vendeur ({selectedProblem.sellerName})</span>
                  </div>
                  <p className="text-white/80 text-[11px] leading-relaxed italic">
                    "{selectedProblem.sellerStatement || 'Le colis a été remis au livreur scellé et complet.'}"
                  </p>
                </div>

                {/* Livraison externe */}
                <div className="p-3 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-cyan-300 text-[11px]">
                    <Truck className="w-3.5 h-3.5" />
                    <span>Logistique Vendeur</span>
                  </div>
                  <p className="text-white/80 text-[11px] leading-relaxed italic">
                    "Livraison organisée directement par le vendeur à l’extérieur de DJASSA."
                  </p>
                </div>
              </div>
            </div>

            {/* Choix de la sentence d'arbitrage */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <label className="text-[11px] text-white/70 font-bold block">
                Sentence & Verdict de l’Administrateur :
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setArbitrationDecision('refund_client')}
                  className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                    arbitrationDecision === 'refund_client'
                      ? 'bg-emerald-500/20 border-emerald-400 text-white ring-1 ring-emerald-400'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <RotateCcw className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-emerald-300 block">1. Remboursement Client (100%)</span>
                    <span className="text-[10px] text-white/50 block">Débit Wave/OM vers l’acheteur</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setArbitrationDecision('release_seller')}
                  className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                    arbitrationDecision === 'release_seller'
                      ? 'bg-purple-500/20 border-purple-400 text-white ring-1 ring-purple-400'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-purple-300 block">2. Libération au Vendeur (100%)</span>
                    <span className="text-[10px] text-white/50 block">Rejet réclamation, solde marchand confirmé</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setArbitrationDecision('split_50_50')}
                  className={`p-3 rounded-2xl border text-left transition flex items-start gap-2.5 ${
                    arbitrationDecision === 'split_50_50'
                      ? 'bg-amber-500/20 border-amber-400 text-white ring-1 ring-amber-400'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-300 block">3. Conciliation Amiable 50/50</span>
                    <span className="text-[10px] text-white/50 block">Partage des responsabilités équitablement</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Note d'arbitrage */}
            <div className="space-y-1">
              <label className="text-[11px] text-white/70 font-bold block">
                Rapport officiel d’arbitrage (sera notifié aux parties) :
              </label>
              <textarea
                rows={2}
                placeholder="Indiquez les motifs de la décision (ex: Constat d'ourlet déchiré avéré après examen photo, remboursement intégral ordonné sous garantie Djassa)..."
                value={arbitrationNote}
                onChange={(e) => setArbitrationNote(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-2xl p-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#FE2C55]"
              />
            </div>

            {/* Footer boutons */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setSelectedProblem(null)}
                className="px-4 py-2 text-xs text-white/60 hover:text-white transition"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={handleExecuteArbitration}
                className="px-5 py-2.5 bg-gradient-to-r from-[#FE2C55] to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white text-xs font-black rounded-xl shadow-lg shadow-rose-950/40 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Rendre le Verdict & Clôturer</span>
              </button>
            </div>
          </div>
        </div>
      )}



      {/* 7. MODAL DE DÉCLARATION MANUELLE D'UN NOUVEL INCIDENT */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#141414] border border-white/15 rounded-3xl w-full max-w-lg p-5 sm:p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#FE2C55]" />
                <span>Ouvrir un Litige / Réclamation Support</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-white/40 hover:text-white text-base"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="space-y-3">
              <div>
                <label className="text-[10px] text-white/60 font-bold block mb-1">
                  Intitulé du Litige *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Tissu déchiré, livreur injoignable au Plateau, retard de 2h..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#FE2C55]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-white/60 font-bold block mb-1">N° Commande (optionnel)</label>
                  <input
                    type="text"
                    placeholder="Ex: DJA-9821"
                    value={newOrderNum}
                    onChange={(e) => setNewOrderNum(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FE2C55]"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-white/60 font-bold block mb-1">Commune d’Abidjan</label>
                  <select
                    value={newCommune}
                    onChange={(e) => setNewCommune(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#FE2C55]"
                  >
                    {communesList.filter(c => c !== 'Toutes').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-white/60 font-bold block mb-1">Nom Client</label>
                  <input
                    type="text"
                    placeholder="Nom complet acheteur"
                    value={newClient}
                    onChange={(e) => setNewClient(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FE2C55]"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-white/60 font-bold block mb-1">Téléphone Client</label>
                  <input
                    type="text"
                    placeholder="+225 07..."
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FE2C55]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/60 font-bold block mb-1">Boutique Marchande</label>
                <input
                  type="text"
                  placeholder="Boutique Wax / High-Tech"
                  value={newSeller}
                  onChange={(e) => setNewSeller(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FE2C55]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-white/60 font-bold block mb-1">Montant Séquestré (F)</label>
                  <input
                    type="number"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FE2C55]"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-white/60 font-bold block mb-1">Catégorie</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as ProblemType)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-2 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#FE2C55]"
                  >
                    <option value="livraison_retard">🛵 Retard</option>
                    <option value="produit_non_conforme">👗 Non-conforme</option>
                    <option value="client_injoignable">📞 Injoignable</option>
                    <option value="litige_paiement">💳 Paiement</option>
                    <option value="panne_livreur">⚙️ Panne</option>
                    <option value="annulation_abusive">🛑 Annulation</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-white/60 font-bold block mb-1">Urgence</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as any)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-2 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#FE2C55]"
                  >
                    <option value="high">🚨 Critique</option>
                    <option value="medium">⚠️ Modéré</option>
                    <option value="low">ℹ️ Standard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/60 font-bold block mb-1">Explication des Faits</label>
                <textarea
                  rows={2}
                  placeholder="Détails de la réclamation ou du constat..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FE2C55]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-white/60 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-[#FE2C55] to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white text-xs font-black rounded-xl shadow-lg transition active:scale-95"
                >
                  Enregistrer & Ouvrir le Dossier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
