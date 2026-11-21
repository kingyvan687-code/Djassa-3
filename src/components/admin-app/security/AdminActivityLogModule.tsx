import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Code2,
  CreditCard,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Globe,
  History,
  KeyRound,
  Lock,
  MessageSquare,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Truck,
  User,
  Wallet,
  X
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { formatFCFA } from '../../../services/marketServices';
import { getActiveSecurityActorId, securityService } from '../../../services/securityService';
import type {
  ActivityCategory,
  ActivityDetailResponse,
  ActivityLogPageResponse,
  ActivityLogQueryParams,
  ActivityResultStatus,
  ActivitySpace,
  ActorSummaryInfo,
  AlertSeverityLevel,
  ProtectedAuditEntry
} from '../../../types/security';
import { SecurityTargetHistoryModal } from './SecurityTargetHistoryModal';

const CATEGORY_META: Record<
  ActivityCategory,
  { label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }
> = {
  auth: { label: 'Authentification & sessions', shortLabel: 'Auth', icon: KeyRound },
  accounts: { label: 'Comptes & profils', shortLabel: 'Comptes', icon: User },
  security: { label: 'Sécurité & accès', shortLabel: 'Sécurité', icon: Shield },
  orders: { label: 'Commandes', shortLabel: 'Commandes', icon: ShoppingBag },
  payments: { label: 'Paiements', shortLabel: 'Paiements', icon: CreditCard },
  wallets: { label: 'Portefeuilles & retraits', shortLabel: 'Retraits', icon: Wallet },
  deliveries: { label: 'Livraisons', shortLabel: 'Livraisons', icon: Truck },
  products: { label: 'Produits & boutiques', shortLabel: 'Produits', icon: Package },
  messaging: { label: 'Messagerie & litiges', shortLabel: 'Messages', icon: MessageSquare },
  admin_mgmt: { label: 'Gestion admin', shortLabel: 'Admin', icon: SlidersHorizontal },
  system_config: { label: 'Paramètres système', shortLabel: 'Système', icon: Settings },
  api: { label: 'APIs & services', shortLabel: 'APIs', icon: Code2 }
};

const ALL_CATEGORIES: ActivityCategory[] = [
  'auth',
  'accounts',
  'security',
  'orders',
  'payments',
  'wallets',
  'deliveries',
  'products',
  'messaging',
  'admin_mgmt',
  'system_config',
  'api'
];

const SPACE_LABELS: Record<ActivitySpace, string> = {
  client: 'Client',
  seller: 'Vendeur',
  driver: 'Livreur',
  company: 'Entreprise',
  admin: 'Admin',
  system: 'Système'
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrateur',
  security_agent: 'Agent sécurité',
  other_agent: 'Agent restreint',
  client: 'Client',
  seller: 'Vendeur',
  driver: 'Livreur',
  company: 'Entreprise livraison',
  system: 'Système'
};

const SEVERITY_META: Record<AlertSeverityLevel, { label: string; textClass: string }> = {
  information: { label: 'Information', textClass: 'text-white/55' },
  faible: { label: 'Faible', textClass: 'text-sky-400' },
  moyen: { label: 'Moyen', textClass: 'text-amber-400' },
  eleve: { label: 'Élevé', textClass: 'text-orange-400' },
  critique: { label: 'Critique', textClass: 'text-rose-400 font-bold' }
};

const RESULT_META: Record<string, { label: string; textClass: string }> = {
  reussi: { label: 'Réussi', textClass: 'text-emerald-400' },
  succes: { label: 'Réussi', textClass: 'text-emerald-400' },
  echoue: { label: 'Échoué', textClass: 'text-amber-400' },
  echec: { label: 'Échoué', textClass: 'text-amber-400' },
  refuse: { label: 'Refusé', textClass: 'text-orange-400' },
  bloque: { label: 'Bloqué', textClass: 'text-rose-400 font-bold' }
};

const formatDateTime = (iso: string) => {
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
};

const formatShortDate = (iso: string) => {
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
};

function toWinAnsiPdfLiteral(str: string): string {
  let out = '(';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    let b: number | null = null;
    if (code === 0x2022) b = 0x95; // bullet
    else if (code === 0x2013 || code === 0x2014) b = 0x2d; // hyphen
    else if (code === 0x2019 || code === 0x2018) b = 0x27; // quote
    else if (code === 0x20ac) b = 0x80; // euro
    else if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) b = code;
    else if (code === 0x2192) {
      out += '->';
      continue;
    } else if (code >= 0x20) {
      b = 0x20;
    }
    if (b === null) continue;
    if (b === 0x28 || b === 0x29 || b === 0x5c) {
      out += '\\' + String.fromCharCode(b);
    } else if (b < 0x80) {
      out += String.fromCharCode(b);
    } else {
      out += '\\' + b.toString(8).padStart(3, '0');
    }
  }
  out += ')';
  return out;
}

function buildActivityPdfBlob(params: {
  generatedAt: string;
  generatedBy: string;
  integrityValid: boolean;
  lastHash: string;
  rows: ProtectedAuditEntry[];
}): Blob {
  const lines: string[] = [
    'DJASSA ADMINISTRATEUR - JOURNAL D ACTIVITE OFFICIEL',
    `Date export: ${formatDateTime(params.generatedAt)} | Par: ${params.generatedBy}`,
    `Integrite SHA-256: ${params.integrityValid ? 'VALIDE' : 'ALERTE'} | Entrees: ${params.rows.length} | Hash: ${params.lastHash.slice(0, 24)}...`,
    '------------------------------------------------------------------------------------------'
  ];

  params.rows.forEach((row) => {
    const cat = CATEGORY_META[(row.category as ActivityCategory) || 'security']?.shortLabel || row.category || 'Audit';
    const res = RESULT_META[row.result || 'reussi']?.label || 'Réussi';
    const sev = SEVERITY_META[(row.severity as AlertSeverityLevel) || 'information']?.label || 'Info';
    const headerLine = `#${row.seq} | ${formatShortDate(row.timestamp)} | ${cat} | ${SPACE_LABELS[(row.space as ActivitySpace) || 'system'] || row.space} | ${sev} | ${res}`;
    const bodyLine = `   ${row.actorName} (${row.actorRole}) -> ${row.action} | Cible: ${row.target} | IP: ${row.ipAddress}`;
    lines.push(headerLine.slice(0, 108));
    lines.push(bodyLine.slice(0, 108));
    if (row.financialTrace) {
      lines.push(
        `   [FINANCE] ${row.financialTrace.operationType} | Ref: ${row.financialTrace.transactionId} | ${row.financialTrace.amountFcfa} FCFA | ${row.financialTrace.status}`.slice(
          0,
          108
        )
      );
    }
  });

  const linesPerPage = 48;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push(['Aucune entree exportee.']);

  const objects: string[] = [];
  // 1: Catalog, 2: Pages, 3: Font
  const pageObjIds: number[] = [];
  let nextObjId = 4;

  const pageEntries: Array<{ pageId: number; contentId: number; stream: string }> = pages.map((pageLines, idx) => {
    const pageId = nextObjId++;
    const contentId = nextObjId++;
    pageObjIds.push(pageId);
    const cmds: string[] = ['BT', '/F1 8.5 Tf', '36 806 Td', '15 TL'];
    pageLines.forEach((line, lIdx) => {
      if (lIdx === 0 && idx === 0) {
        cmds.push('/F1 10.5 Tf');
        cmds.push(`${toWinAnsiPdfLiteral(line)} Tj`);
        cmds.push('T*');
        cmds.push('/F1 8.5 Tf');
      } else {
        cmds.push(`${toWinAnsiPdfLiteral(line)} Tj`);
        cmds.push('T*');
      }
    });
    cmds.push(`(Page ${idx + 1}/${pages.length}) Tj`);
    cmds.push('ET');
    return { pageId, contentId, stream: cmds.join('\n') };
  });

  objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjIds.length} >>\nendobj\n`;
  objects[3] = `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`;

  for (const p of pageEntries) {
    objects[p.pageId] = `${p.pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${p.contentId} 0 R >>\nendobj\n`;
    objects[p.contentId] = `${p.contentId} 0 obj\n<< /Length ${p.stream.length} >>\nstream\n${p.stream}\nendstream\nendobj\n`;
  }

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let i = 1; i < nextObjId; i++) {
    offsets[i] = pdf.length;
    pdf += objects[i];
  }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${nextObjId}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < nextObjId; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${nextObjId} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) {
    bytes[i] = pdf.charCodeAt(i) & 0xff;
  }
  return new Blob([bytes], { type: 'application/pdf' });
}

export const AdminActivityLogModule: React.FC = () => {
  const { showToast } = useApp();
  const [actorId] = useState<string>(() => getActiveSecurityActorId());
  const [authDenied, setAuthDenied] = useState<string | null>(null);

  // Filters & query state
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [spaceFilter, setSpaceFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [actorFilter, setActorFilter] = useState<string>('');
  const [ipFilter, setIpFilter] = useState<string>('');
  const [refIdFilter, setRefIdFilter] = useState<string>('');
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Data state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ActivityLogPageResponse | null>(null);

  // Detail page state
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<ActivityDetailResponse | null>(null);
  const [relatedTab, setRelatedTab] = useState<'timeline' | 'actor' | 'entity'>('timeline');
  const [accountDossier, setAccountDossier] = useState<{
    loading: boolean;
    error: string | null;
    summary: ActorSummaryInfo | null;
    targetLabel: string;
  } | null>(null);
  const [historyTarget, setHistoryTarget] = useState<string | null>(null);

  // Export & Backup busy state
  const [exportingFormat, setExportingFormat] = useState<'csv' | 'pdf' | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [lastBackupBanner, setLastBackupBanner] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 220);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (spaceFilter !== 'all') count++;
    if (roleFilter !== 'all') count++;
    if (severityFilter !== 'all') count++;
    if (resultFilter !== 'all') count++;
    if (actorFilter.trim()) count++;
    if (ipFilter.trim()) count++;
    if (refIdFilter.trim()) count++;
    if (actionTypeFilter.trim()) count++;
    if (fromDate) count++;
    if (toDate) count++;
    return count;
  }, [
    spaceFilter,
    roleFilter,
    severityFilter,
    resultFilter,
    actorFilter,
    ipFilter,
    refIdFilter,
    actionTypeFilter,
    fromDate,
    toDate
  ]);

  const currentQueryParams: ActivityLogQueryParams = useMemo(
    () => ({
      q: debouncedSearch || undefined,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      space: spaceFilter !== 'all' ? spaceFilter : undefined,
      role: roleFilter !== 'all' ? roleFilter : undefined,
      severity: severityFilter !== 'all' ? severityFilter : undefined,
      result: resultFilter !== 'all' ? resultFilter : undefined,
      actor: actorFilter.trim() || undefined,
      ip: ipFilter.trim() || undefined,
      refId: refIdFilter.trim() || undefined,
      actionType: actionTypeFilter.trim() || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
      page,
      limit: pageSize
    }),
    [
      debouncedSearch,
      categoryFilter,
      spaceFilter,
      roleFilter,
      severityFilter,
      resultFilter,
      actorFilter,
      ipFilter,
      refIdFilter,
      actionTypeFilter,
      fromDate,
      toDate,
      page
    ]
  );

  const loadLogs = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const me = await securityService.getMe(actorId);
        if (!me.authorized || !me.actor?.permissions?.viewDashboard) {
          setAuthDenied(
            `Accès restreint : le profil "${me.actor?.name || 'Agent'}" ne dispose pas de la permission requise pour consulter le journal d'activité.`
          );
          setLoading(false);
          setRefreshing(false);
          return;
        }
        setAuthDenied(null);
        const res = await securityService.getActivityLogs(currentQueryParams, actorId);
        setResponse(res);
      } catch (err: unknown) {
        const msg = (err as Error)?.message || 'Impossible de charger le journal d’activité serveur.';
        if (msg.toLowerCase().includes('refus') || msg.toLowerCase().includes('autoris')) {
          setAuthDenied(msg);
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [actorId, currentQueryParams]
  );

  useEffect(() => {
    void loadLogs(false);
  }, [loadLogs]);

  const handleResetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setCategoryFilter('all');
    setSpaceFilter('all');
    setRoleFilter('all');
    setSeverityFilter('all');
    setResultFilter('all');
    setActorFilter('');
    setIpFilter('');
    setRefIdFilter('');
    setActionTypeFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const handleOpenDetail = async (id: string) => {
    setDetailLoading(true);
    setAccountDossier(null);
    setRelatedTab('timeline');
    try {
      const detail = await securityService.getActivityDetail(id);
      setSelectedDetail(detail);
    } catch (err: unknown) {
      showToast((err as Error)?.message || 'Erreur lors du chargement du détail.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleInspectAccountDossier = async (entry: ProtectedAuditEntry) => {
    const targetKey = entry.actorAccountLabel || entry.actorId || entry.target;
    setAccountDossier({
      loading: true,
      error: null,
      summary: null,
      targetLabel: targetKey
    });
    try {
      const res = await securityService.getTargetHistory(targetKey, actorId);
      setAccountDossier({
        loading: false,
        error: null,
        summary: res.actorSummary || null,
        targetLabel: targetKey
      });
    } catch (err: unknown) {
      setAccountDossier({
        loading: false,
        error: (err as Error)?.message || 'Impossible de charger la fiche du compte.',
        summary: null,
        targetLabel: targetKey
      });
    }
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExportingFormat(format);
    try {
      const res = await securityService.exportActivityLogs(format, currentQueryParams);
      if (format === 'csv' && res.csvContent) {
        const blob = new Blob([res.csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = res.filename || `djassa_journal_activite_${Date.now()}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        showToast(`Export CSV téléchargé (${res.exportedCount} entrées)`);
      } else if (format === 'pdf' && res.rows) {
        const pdfBlob = buildActivityPdfBlob({
          generatedAt: res.generatedAt || new Date().toISOString(),
          generatedBy: res.generatedBy || 'Administrateur DJASSA',
          integrityValid: res.integrity?.valid ?? true,
          lastHash: res.integrity?.lastHash || '',
          rows: res.rows
        });
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = (res.filename || `djassa_journal_activite_${Date.now()}.pdf`).replace(/\.csv$/i, '.pdf');
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        showToast(`Export PDF téléchargé (${res.exportedCount} entrées)`);
      }
      // Refresh list because every export is itself logged on server
      void loadLogs(true);
    } catch (err: unknown) {
      showToast((err as Error)?.message || 'Erreur lors de l’exportation du journal.');
    } finally {
      setExportingFormat(null);
    }
  };

  const handleCreateBackup = async () => {
    setBackingUp(true);
    try {
      const res = await securityService.createActivityBackup();
      setLastBackupBanner(`${res.backupFileName} · SHA-256 ${res.checksum.slice(0, 14)}…`);
      showToast(`Sauvegarde certifiée créée (${res.totalEntries} entrées)`);
      void loadLogs(true);
    } catch (err: unknown) {
      showToast((err as Error)?.message || 'Impossible de créer la sauvegarde.');
    } finally {
      setBackingUp(false);
    }
  };

  if (authDenied) {
    return (
      <div className="p-5 rounded-2xl bg-[#141417] border border-rose-500/25 text-center space-y-2.5">
        <div className="w-11 h-11 rounded-2xl bg-rose-500/15 text-rose-400 flex items-center justify-center mx-auto">
          <Lock className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold text-white">Accès au journal refusé</h3>
        <p className="text-xs text-white/60 max-w-md mx-auto leading-relaxed">{authDenied}</p>
      </div>
    );
  }

  const kpis = response?.kpis || {
    activitiesToday: 0,
    loginsCount: 0,
    adminActionsCount: 0,
    suspiciousActivitiesCount: 0,
    criticalEventsCount: 0
  };
  const integrity = response?.integrity;
  const retention = response?.retention;
  const logs = response?.logs || [];

  return (
    <div id="admin-activity-log-module" className="space-y-4 text-white">
      {/* Header & Top Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-black tracking-tight text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Journal d’activité centralisé</span>
          </h4>
          <p className="text-[11px] text-white/50 mt-0.5">
            Traçabilité serveur immuable des 5 espaces DJASSA · Chaînage SHA-256
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => void loadLogs(true)}
            disabled={refreshing}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/80 flex items-center gap-1.5 transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>

          <button
            type="button"
            onClick={() => void handleCreateBackup()}
            disabled={backingUp}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-emerald-300 flex items-center gap-1.5 transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{backingUp ? 'Sauvegarde...' : 'Sauvegarder'}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleExport('csv')}
            disabled={exportingFormat !== null}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/85 flex items-center gap-1.5 transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
            <span>{exportingFormat === 'csv' ? 'Export...' : 'CSV'}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleExport('pdf')}
            disabled={exportingFormat !== null}
            className="min-h-[44px] px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exportingFormat === 'pdf' ? 'Export...' : 'PDF'}</span>
          </button>
        </div>
      </div>

      {/* ONLY 5 TOP KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10">
          <p className="text-[11px] text-white/55 truncate">Activités aujourd’hui</p>
          <p className="text-xl font-black text-white tabular-nums mt-1">
            {kpis.activitiesToday.toLocaleString('fr-FR')}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10">
          <p className="text-[11px] text-white/55 truncate">Connexions</p>
          <p className="text-xl font-black text-cyan-300 tabular-nums mt-1">
            {kpis.loginsCount.toLocaleString('fr-FR')}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10">
          <p className="text-[11px] text-white/55 truncate">Actions administratives</p>
          <p className="text-xl font-black text-purple-300 tabular-nums mt-1">
            {kpis.adminActionsCount.toLocaleString('fr-FR')}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10">
          <p className="text-[11px] text-white/55 truncate">Activités suspectes</p>
          <p className="text-xl font-black text-amber-400 tabular-nums mt-1">
            {kpis.suspiciousActivitiesCount.toLocaleString('fr-FR')}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 col-span-2 sm:col-span-1">
          <p className="text-[11px] text-white/55 truncate">Événements critiques</p>
          <p className="text-xl font-black text-rose-400 tabular-nums mt-1">
            {kpis.criticalEventsCount.toLocaleString('fr-FR')}
          </p>
        </div>
      </div>

      {/* Integrity & Retention Status Line (Clean unboxed metadata) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-[#141417] border border-white/10 text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          {integrity?.valid !== false ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span className={integrity?.valid !== false ? 'text-emerald-300 font-semibold' : 'text-rose-300 font-semibold'}>
            {integrity?.valid !== false
              ? `Chaîne SHA-256 intègre · ${integrity?.totalEntries ?? 0} entrées protégées`
              : `Alerte intégrité séquence #${integrity?.brokenAtSeq}`}
          </span>
        </div>

        <div className="flex items-center gap-2 text-white/50 tabular-nums truncate">
          <span>Rétention {retention?.retentionDays ?? 180} jours</span>
          {(lastBackupBanner || retention?.lastBackupAt) && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">
                {lastBackupBanner || `Dernière sauvegarde ${formatShortDate(retention!.lastBackupAt!)}`}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Instant Search + Advanced Filter Toggle */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Rechercher par nom, e-mail, ID compte, IP, commande ou transaction..."
              className="w-full min-h-[44px] pl-10 pr-9 py-2.5 rounded-xl bg-[#141417] border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400 transition"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center text-white/50 hover:text-white cursor-pointer"
                aria-label="Effacer la recherche"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowAdvancedFilters((v) => !v)}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap shrink-0 cursor-pointer ${
              showAdvancedFilters || activeFiltersCount > 0
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-[#141417] border-white/10 text-white/75 hover:text-white'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filtres{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}</span>
            {showAdvancedFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* 12 Categories Quick Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => {
              setCategoryFilter('all');
              setPage(1);
            }}
            className={`min-h-[36px] px-3 py-1.5 rounded-xl text-[11px] font-semibold transition whitespace-nowrap shrink-0 cursor-pointer border ${
              categoryFilter === 'all'
                ? 'bg-amber-500 text-black border-amber-500 font-bold'
                : 'bg-[#141417] text-white/65 border-white/10 hover:text-white'
            }`}
          >
            Toutes catégories
          </button>
          {ALL_CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const Icon = meta.icon;
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setCategoryFilter(cat);
                  setPage(1);
                }}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-[11px] font-semibold transition whitespace-nowrap shrink-0 cursor-pointer border flex items-center gap-1.5 ${
                  active
                    ? 'bg-amber-500 text-black border-amber-500 font-bold'
                    : 'bg-[#141417] text-white/65 border-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{meta.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Collapsible Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="p-4 rounded-2xl bg-[#141417] border border-white/10 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[11px] text-white/50 block mb-1">Espace DJASSA</label>
                <select
                  value={spaceFilter}
                  onChange={(e) => {
                    setSpaceFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="all">Tous les espaces</option>
                  <option value="client">Client</option>
                  <option value="seller">Vendeur</option>
                  <option value="driver">Livreur</option>
                  <option value="company">Entreprise de livraison</option>
                  <option value="admin">Administrateur</option>
                  <option value="system">Système</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-white/50 block mb-1">Rôle</label>
                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="all">Tous les rôles</option>
                  <option value="client">Client</option>
                  <option value="seller">Vendeur</option>
                  <option value="driver">Livreur</option>
                  <option value="company">Entreprise de livraison</option>
                  <option value="super_admin">Super Administrateur</option>
                  <option value="admin">Administrateur</option>
                  <option value="security_agent">Agent de sécurité</option>
                  <option value="system">Système</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-white/50 block mb-1">Niveau de gravité</label>
                <select
                  value={severityFilter}
                  onChange={(e) => {
                    setSeverityFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="all">Toutes gravités</option>
                  <option value="information">Information</option>
                  <option value="faible">Faible</option>
                  <option value="moyen">Moyen</option>
                  <option value="eleve">Élevé</option>
                  <option value="critique">Critique</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-white/50 block mb-1">Résultat de l’action</label>
                <select
                  value={resultFilter}
                  onChange={(e) => {
                    setResultFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="all">Tous les résultats</option>
                  <option value="reussi">Réussi</option>
                  <option value="echoue">Échoué</option>
                  <option value="refuse">Refusé</option>
                  <option value="bloque">Bloqué</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-white/50 block mb-1">Utilisateur ou ID compte</label>
                <input
                  type="text"
                  value={actorFilter}
                  onChange={(e) => {
                    setActorFilter(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Nom, e-mail ou ID..."
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] text-white/50 block mb-1">Type d’action</label>
                <input
                  type="text"
                  value={actionTypeFilter}
                  onChange={(e) => {
                    setActionTypeFilter(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Ex: withdrawal, order_created..."
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] text-white/50 block mb-1">Adresse IP</label>
                <input
                  type="text"
                  value={ipFilter}
                  onChange={(e) => {
                    setIpFilter(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Ex: 41.202..."
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] text-white/50 block mb-1">Réf. commande / transaction</label>
                <input
                  type="text"
                  value={refIdFilter}
                  onChange={(e) => {
                    setRefIdFilter(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Ex: DJ-, VIR-, CRD-..."
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white placeholder-white/30 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] text-white/50 block mb-1">Date de début</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] text-white/50 block mb-1">Date de fin</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={handleResetFilters}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-white/80 flex items-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Réinitialiser les filtres</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Chronological Activity List */}
      <div className="rounded-2xl bg-[#141417] border border-white/10 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-white/50">Chargement du journal d’activité serveur...</div>
        ) : error ? (
          <div className="p-6 text-center space-y-2">
            <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto" />
            <p className="text-xs text-rose-300">{error}</p>
            <button
              type="button"
              onClick={() => void loadLogs(false)}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer"
            >
              Réessayer
            </button>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-2">
            <Activity className="w-7 h-7 text-white/25 mx-auto" />
            <p className="text-xs font-bold text-white/80">Aucune activité enregistrée pour ces critères</p>
            <p className="text-[11px] text-white/45">
              Les actions réelles des 5 espaces apparaîtront ici dès leur exécution côté serveur.
            </p>
            {(activeFiltersCount > 0 || categoryFilter !== 'all' || debouncedSearch) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-2 min-h-[40px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer"
              >
                Effacer les filtres
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {logs.map((entry) => {
              const catKey = (entry.category as ActivityCategory) || 'security';
              const catMeta = CATEGORY_META[catKey] || CATEGORY_META.security;
              const CatIcon = catMeta.icon;
              const sevMeta = SEVERITY_META[(entry.severity as AlertSeverityLevel) || 'information'] || SEVERITY_META.information;
              const resMeta = RESULT_META[entry.result || 'reussi'] || RESULT_META.reussi;
              const roleLabel = ROLE_LABELS[entry.actorRole] || entry.actorRole;

              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => void handleOpenDetail(entry.id)}
                  className="w-full min-h-[60px] px-3.5 py-3 flex items-center justify-between gap-3 text-left hover:bg-white/[0.04] active:bg-white/[0.07] transition cursor-pointer"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-white/80 shrink-0 mt-0.5">
                      <CatIcon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white leading-snug truncate">{entry.action}</p>
                      <div className="flex items-center gap-1.5 text-[11px] text-white/50 mt-0.5 flex-wrap">
                        <span className="font-medium text-white/75 truncate max-w-[160px]">{entry.actorName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{roleLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums font-mono">{formatDateTime(entry.timestamp)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right text-[11px] leading-tight">
                      <div className={sevMeta.textClass}>{sevMeta.label}</div>
                      <div className={`${resMeta.textClass} mt-0.5`}>{resMeta.label}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/30" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Server Pagination Footer */}
        {response && response.total > 0 && (
          <div className="px-3.5 py-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-[11px] text-white/50 tabular-nums">
              Page {response.page} / {response.totalPages} · {response.total.toLocaleString('fr-FR')} événement(s)
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={response.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-35 text-xs font-semibold text-white flex items-center gap-1 transition cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Précédent</span>
              </button>
              <button
                type="button"
                disabled={response.page >= response.totalPages}
                onClick={() => setPage((p) => Math.min(response.totalPages, p + 1))}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-35 text-xs font-semibold text-white flex items-center gap-1 transition cursor-pointer disabled:cursor-not-allowed"
              >
                <span>Suivant</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Loading Indicator for Detail Fetch */}
      {detailLoading && (
        <div className="fixed inset-0 z-[65] bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="px-5 py-3 rounded-2xl bg-[#141417] border border-white/15 text-xs text-white font-semibold">
            Chargement de la fiche d’activité...
          </div>
        </div>
      )}

      {/* Full-Screen Android Activity Detail Page */}
      {selectedDetail && (
        <div className="fixed inset-0 z-[65] bg-[#0A0A0A] flex flex-col">
          {/* Sticky Top Mobile App Bar */}
          <header className="px-3.5 py-3 bg-[#111114] border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setSelectedDetail(null);
                setAccountDossier(null);
              }}
              className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white flex items-center gap-1 cursor-pointer shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Retour</span>
            </button>

            <div className="min-w-0 flex-1 px-1">
              <p className="text-[10px] text-white/45 font-mono tabular-nums truncate">
                {selectedDetail.entry.id} · #{selectedDetail.entry.seq}
              </p>
              <h3 className="text-xs sm:text-sm font-black text-white truncate">
                Détail de l’activité
              </h3>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedDetail(null);
                setAccountDossier(null);
              }}
              className="min-w-[40px] min-h-[40px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/75 shrink-0 cursor-pointer"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          {/* Scrollable Detail Content */}
          <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-3 text-xs max-w-3xl w-full mx-auto">
            {/* Action Header Card */}
            {(() => {
              const entry = selectedDetail.entry;
              const catKey = (entry.category as ActivityCategory) || 'security';
              const catMeta = CATEGORY_META[catKey] || CATEGORY_META.security;
              const CatIcon = catMeta.icon;
              const sevMeta =
                SEVERITY_META[(entry.severity as AlertSeverityLevel) || 'information'] || SEVERITY_META.information;
              const resMeta = RESULT_META[entry.result || 'reussi'] || RESULT_META.reussi;

              return (
                <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-2.5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-amber-400 shrink-0">
                      <CatIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-semibold">
                        <span className="text-white/60">{catMeta.label}</span>
                        <span className="text-white/25">·</span>
                        <span className={sevMeta.textClass}>{sevMeta.label}</span>
                        <span className="text-white/25">·</span>
                        <span className={resMeta.textClass}>{resMeta.label}</span>
                      </div>
                      <h4 className="text-sm sm:text-base font-black text-white mt-0.5 leading-snug">
                        {entry.action}
                      </h4>
                      <p className="text-[11px] font-mono text-white/45 mt-1 tabular-nums">
                        {formatDateTime(entry.timestamp)}
                        {entry.actionType ? ` · Type: ${entry.actionType}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Identity, Role, Space & Affected Element Card */}
            <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <span className="text-[11px] text-white/45 block">Identité de l’acteur</span>
                <span className="font-semibold text-white block">
                  {selectedDetail.entry.actorName}{' '}
                  {selectedDetail.entry.actorAccountLabel ? `(${selectedDetail.entry.actorAccountLabel})` : ''}
                </span>
                <span className="block text-[11px] font-mono text-white/45">{selectedDetail.entry.actorId}</span>
              </div>

              <div>
                <span className="text-[11px] text-white/45 block">Rôle & espace DJASSA</span>
                <span className="font-semibold text-white">
                  {ROLE_LABELS[selectedDetail.entry.actorRole] || selectedDetail.entry.actorRole} ·{' '}
                  {SPACE_LABELS[(selectedDetail.entry.space as ActivitySpace) || 'system'] ||
                    selectedDetail.entry.space}
                </span>
              </div>

              <div>
                <span className="text-[11px] text-white/45 block">Compte ou élément concerné</span>
                <span className="font-semibold text-white break-words">
                  {selectedDetail.entry.target}
                  {selectedDetail.entry.entityId ? ` (${selectedDetail.entry.entityId})` : ''}
                </span>
                {selectedDetail.entry.entityType && (
                  <span className="block text-[11px] text-white/45">
                    Type d’élément : {selectedDetail.entry.entityType}
                  </span>
                )}
              </div>

              <div>
                <span className="text-[11px] text-white/45 block">Appareil & adresse IP</span>
                <span className="font-mono text-white/90 block">{selectedDetail.entry.ipAddress}</span>
                <span className="block text-[11px] text-white/55">
                  {[selectedDetail.entry.device, selectedDetail.entry.os, selectedDetail.entry.browser]
                    .filter(Boolean)
                    .join(' · ') || 'Informations appareil non fournies'}
                </span>
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-white/10">
                <span className="text-[11px] text-white/45 block">Informations techniques</span>
                <span className="font-mono text-[11px] text-white/65 break-all">
                  Session : {selectedDetail.entry.sessionId || 'N/A'} · Requête :{' '}
                  {selectedDetail.entry.requestId || 'N/A'} · Séquence : #{selectedDetail.entry.seq}
                </span>
              </div>
            </div>

            {/* Description, Reason & Before / After Card */}
            {(selectedDetail.entry.reason ||
              selectedDetail.entry.details ||
              selectedDetail.entry.beforeValue ||
              selectedDetail.entry.afterValue) && (
              <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-3">
                {selectedDetail.entry.reason && (
                  <div>
                    <span className="text-[11px] text-rose-400 font-semibold block">Motif / Raison</span>
                    <p className="text-xs text-white/90 mt-0.5">{selectedDetail.entry.reason}</p>
                  </div>
                )}

                {selectedDetail.entry.details && (
                  <div>
                    <span className="text-[11px] text-white/45 block">
                      Description détaillée (données sensibles masquées)
                    </span>
                    <p className="text-xs text-white/85 leading-relaxed whitespace-pre-wrap break-words mt-0.5">
                      {selectedDetail.entry.details}
                    </p>
                  </div>
                )}

                {(selectedDetail.entry.beforeValue || selectedDetail.entry.afterValue) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-white/10">
                    <div>
                      <span className="text-[11px] text-white/45 block mb-1">Ancienne valeur</span>
                      <div className="p-2.5 rounded-xl bg-white/[0.04] text-xs text-white/75 break-words font-mono">
                        {selectedDetail.entry.beforeValue || '—'}
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] text-white/45 block mb-1">Nouvelle valeur</span>
                      <div className="p-2.5 rounded-xl bg-white/[0.06] text-xs text-emerald-300 break-words font-mono">
                        {selectedDetail.entry.afterValue || '—'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Read-only Financial Trace Card */}
            {selectedDetail.entry.financialTrace && (
              <div className="p-3.5 rounded-2xl bg-[#141417] border border-emerald-500/25 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <Wallet className="w-4 h-4" />
                    <span>Traçabilité financière</span>
                  </span>
                  <span className="text-[11px] text-white/50">Lecture seule · Non modifiable</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                  <div>
                    <span className="text-white/45 block">Opération</span>
                    <span className="text-white font-semibold">{selectedDetail.entry.financialTrace.operationType}</span>
                  </div>
                  <div>
                    <span className="text-white/45 block">Identifiant transaction</span>
                    <span className="text-white font-mono">{selectedDetail.entry.financialTrace.transactionId}</span>
                  </div>
                  <div>
                    <span className="text-white/45 block">Acteur à l’origine</span>
                    <span className="text-white">{selectedDetail.entry.financialTrace.initiatorName}</span>
                  </div>
                  <div>
                    <span className="text-white/45 block">Compte bénéficiaire</span>
                    <span className="text-white break-words">
                      {selectedDetail.entry.financialTrace.beneficiaryAccount}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/45 block">Montant</span>
                    <span className="text-emerald-300 font-bold tabular-nums font-mono">
                      {formatFCFA(selectedDetail.entry.financialTrace.amountFcfa)}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/45 block">Frais & commissions</span>
                    <span className="text-white tabular-nums font-mono">
                      {formatFCFA(
                        (selectedDetail.entry.financialTrace.feesFcfa || 0) +
                          (selectedDetail.entry.financialTrace.commissionFcfa || 0)
                      )}
                    </span>
                  </div>
                  {selectedDetail.entry.financialTrace.previousBalanceFcfa !== undefined &&
                    selectedDetail.entry.financialTrace.previousBalanceFcfa !== null && (
                      <div>
                        <span className="text-white/45 block">Ancien solde</span>
                        <span className="text-white/80 tabular-nums font-mono">
                          {formatFCFA(selectedDetail.entry.financialTrace.previousBalanceFcfa)}
                        </span>
                      </div>
                    )}
                  {selectedDetail.entry.financialTrace.newBalanceFcfa !== undefined &&
                    selectedDetail.entry.financialTrace.newBalanceFcfa !== null && (
                      <div>
                        <span className="text-white/45 block">Nouveau solde</span>
                        <span className="text-white font-bold tabular-nums font-mono">
                          {formatFCFA(selectedDetail.entry.financialTrace.newBalanceFcfa)}
                        </span>
                      </div>
                    )}
                  <div>
                    <span className="text-white/45 block">Statut & validation</span>
                    <span className="text-white font-semibold">
                      {selectedDetail.entry.financialTrace.status} ·{' '}
                      {selectedDetail.entry.financialTrace.validationResult}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/45 block">Date & heure financières</span>
                    <span className="text-white/75 tabular-nums font-mono">
                      {formatDateTime(selectedDetail.entry.financialTrace.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Required Investigation Shortcuts */}
            <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-2.5">
              <p className="text-[11px] font-bold text-white/55 uppercase tracking-wider">
                Raccourcis d’investigation
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void handleInspectAccountDossier(selectedDetail.entry)}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-semibold text-amber-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Consulter le compte concerné</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActorFilter(selectedDetail.entry.actorId);
                    setShowAdvancedFilters(true);
                    setPage(1);
                    setSelectedDetail(null);
                  }}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Son historique d’activité</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRefIdFilter(selectedDetail.entry.entityId || selectedDetail.entry.target);
                    setShowAdvancedFilters(true);
                    setPage(1);
                    setSelectedDetail(null);
                  }}
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Filtrer l’élément ciblé</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setHistoryTarget(
                      selectedDetail.entry.actorAccountLabel ||
                        selectedDetail.entry.target ||
                        selectedDetail.entry.actorId
                    )
                  }
                  className="min-h-[42px] px-3 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-xs font-semibold text-purple-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Dossier sécurité complet</span>
                </button>
              </div>

              {/* Inline Account Dossier Panel when "Consulter le compte concerné" is clicked */}
              {accountDossier && (
                <div className="mt-2 p-3 rounded-xl bg-[#0B0B0D] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-amber-300">
                      Fiche du compte : {accountDossier.targetLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAccountDossier(null)}
                      className="text-[11px] text-white/50 hover:text-white cursor-pointer"
                    >
                      Fermer
                    </button>
                  </div>

                  {accountDossier.loading && (
                    <p className="text-[11px] text-white/50">Chargement de la fiche serveur...</p>
                  )}
                  {accountDossier.error && (
                    <p className="text-[11px] text-rose-300">{accountDossier.error}</p>
                  )}
                  {!accountDossier.loading && !accountDossier.error && accountDossier.summary && (
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-white/45 block">Nom & statut</span>
                        <span className="text-white font-semibold">
                          {accountDossier.summary.name} ·{' '}
                          <span className={accountDossier.summary.isSuspended ? 'text-rose-400' : 'text-emerald-400'}>
                            {accountDossier.summary.isSuspended ? 'Suspendu' : 'Actif'}
                          </span>
                        </span>
                      </div>
                      <div>
                        <span className="text-white/45 block">Rôle & espace</span>
                        <span className="text-white">
                          {ROLE_LABELS[accountDossier.summary.role] || accountDossier.summary.role} ·{' '}
                          {SPACE_LABELS[(accountDossier.summary.space as ActivitySpace) || 'system'] ||
                            accountDossier.summary.space}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/45 block">Solde serveur</span>
                        <span className="text-emerald-300 font-mono font-bold tabular-nums">
                          {accountDossier.summary.serverBalanceFcfa !== null
                            ? formatFCFA(accountDossier.summary.serverBalanceFcfa)
                            : 'Non applicable'}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/45 block">Événements (Total / Échecs / Critiques)</span>
                        <span className="text-white font-mono tabular-nums">
                          {accountDossier.summary.totalEvents} /{' '}
                          <span className="text-amber-300">{accountDossier.summary.failedOrBlockedEvents}</span> /{' '}
                          <span className="text-rose-400">{accountDossier.summary.criticalEvents}</span>
                        </span>
                      </div>
                    </div>
                  )}
                  {!accountDossier.loading && !accountDossier.error && !accountDossier.summary && (
                    <p className="text-[11px] text-white/55">Aucun résumé de compte supplémentaire trouvé.</p>
                  )}
                </div>
              )}
            </div>

            {/* Associated Events (Chronology, Same Actor, Same Entity) */}
            <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 space-y-2.5">
              <p className="text-[11px] font-bold text-white/55 uppercase tracking-wider">
                Événements associés
              </p>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setRelatedTab('timeline')}
                  className={`min-h-[36px] px-3 py-1.5 rounded-xl text-[11px] font-semibold border whitespace-nowrap cursor-pointer ${
                    relatedTab === 'timeline'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                      : 'bg-white/[0.03] border-white/10 text-white/65'
                  }`}
                >
                  Avant / Pendant / Après ({selectedDetail.beforeEvents.length + selectedDetail.afterEvents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRelatedTab('actor')}
                  className={`min-h-[36px] px-3 py-1.5 rounded-xl text-[11px] font-semibold border whitespace-nowrap cursor-pointer ${
                    relatedTab === 'actor'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                      : 'bg-white/[0.03] border-white/10 text-white/65'
                  }`}
                >
                  Même acteur ({selectedDetail.relatedByActor?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setRelatedTab('entity')}
                  className={`min-h-[36px] px-3 py-1.5 rounded-xl text-[11px] font-semibold border whitespace-nowrap cursor-pointer ${
                    relatedTab === 'entity'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                      : 'bg-white/[0.03] border-white/10 text-white/65'
                  }`}
                >
                  Même élément ({selectedDetail.relatedByEntity?.length || 0})
                </button>
              </div>

              {relatedTab === 'timeline' && (
                <div className="divide-y divide-white/5 rounded-2xl bg-white/[0.02] border border-white/10">
                  {selectedDetail.beforeEvents.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => void handleOpenDetail(ev.id)}
                      className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-white/5 transition cursor-pointer"
                    >
                      <div className="min-w-0">
                        <span className="text-[10px] text-white/40 block">Avant · #{ev.seq} · {ev.actorName}</span>
                        <span className="text-xs text-white/80 truncate block">{ev.action}</span>
                      </div>
                      <span className="text-[10px] font-mono text-white/45 tabular-nums shrink-0">
                        {formatShortDate(ev.timestamp)}
                      </span>
                    </button>
                  ))}

                  <div className="px-3 py-2.5 bg-amber-500/10 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] text-amber-300 font-bold block">
                        Pendant · Événement #{selectedDetail.entry.seq}
                      </span>
                      <span className="text-xs font-bold text-white truncate block">{selectedDetail.entry.action}</span>
                    </div>
                    <span className="text-[10px] font-mono text-amber-200 tabular-nums shrink-0">
                      {formatShortDate(selectedDetail.entry.timestamp)}
                    </span>
                  </div>

                  {selectedDetail.afterEvents.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => void handleOpenDetail(ev.id)}
                      className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-white/5 transition cursor-pointer"
                    >
                      <div className="min-w-0">
                        <span className="text-[10px] text-white/40 block">Après · #{ev.seq} · {ev.actorName}</span>
                        <span className="text-xs text-white/80 truncate block">{ev.action}</span>
                      </div>
                      <span className="text-[10px] font-mono text-white/45 tabular-nums shrink-0">
                        {formatShortDate(ev.timestamp)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {relatedTab === 'actor' && (
                <div className="divide-y divide-white/5 rounded-2xl bg-white/[0.02] border border-white/10">
                  {(!selectedDetail.relatedByActor || selectedDetail.relatedByActor.length === 0) ? (
                    <p className="px-3 py-4 text-[11px] text-white/45 text-center">
                      Aucun autre événement trouvé pour cet acteur.
                    </p>
                  ) : (
                    selectedDetail.relatedByActor.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => void handleOpenDetail(ev.id)}
                        className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-white/5 transition cursor-pointer"
                      >
                        <div className="min-w-0">
                          <span className="text-[10px] text-white/40 block">
                            #{ev.seq} · {CATEGORY_META[(ev.category as ActivityCategory) || 'security']?.shortLabel || ev.category}
                          </span>
                          <span className="text-xs text-white/85 truncate block">{ev.action}</span>
                        </div>
                        <span className="text-[10px] font-mono text-white/45 tabular-nums shrink-0">
                          {formatShortDate(ev.timestamp)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {relatedTab === 'entity' && (
                <div className="divide-y divide-white/5 rounded-2xl bg-white/[0.02] border border-white/10">
                  {(!selectedDetail.relatedByEntity || selectedDetail.relatedByEntity.length === 0) ? (
                    <p className="px-3 py-4 text-[11px] text-white/45 text-center">
                      Aucun autre événement lié à cet élément.
                    </p>
                  ) : (
                    selectedDetail.relatedByEntity.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => void handleOpenDetail(ev.id)}
                        className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-white/5 transition cursor-pointer"
                      >
                        <div className="min-w-0">
                          <span className="text-[10px] text-white/40 block">
                            #{ev.seq} · {ev.actorName}
                          </span>
                          <span className="text-xs text-white/85 truncate block">{ev.action}</span>
                        </div>
                        <span className="text-[10px] font-mono text-white/45 tabular-nums shrink-0">
                          {formatShortDate(ev.timestamp)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Cryptographic Chain Verification Footer */}
            <div className="p-3.5 rounded-2xl bg-[#141417] border border-white/10 text-[10px] font-mono text-white/45 space-y-1 break-all">
              <div>Hash SHA-256 : {selectedDetail.entry.entryHash}</div>
              <div>Hash précédent : {selectedDetail.entry.prevHash}</div>
            </div>
          </div>
        </div>
      )}

      {/* Linked Security Target History Modal */}
      <SecurityTargetHistoryModal
        target={historyTarget}
        actorId={actorId}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
};
