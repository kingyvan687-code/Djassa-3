import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Database,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  FileText,
  History,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  X
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { privacyService } from '../../../services/privacyService';
import { securityService } from '../../../services/securityService';
import type {
  DataRetentionRuleRecord,
  MaskedUserDataInventoryRecord,
  PrivacyDataCategoryGroup,
  PrivacyExportRecord,
  PrivacyIncidentRecord,
  PrivacyIncidentSeverity,
  PrivacyIncidentStatus,
  PrivacyOverviewResponse,
  PrivacyPermissionKey,
  PrivacyPolicyDocumentRecord,
  PrivacyRequestRecord,
  PrivacyRequestStatus,
  PrivacyRequestType,
  PrivacyUserSpace,
  RevealedPrivacyRecordPayload
} from '../../../types/privacy';

type SectionKey =
  | 'overview'
  | 'inventory'
  | 'consents'
  | 'requests'
  | 'retention'
  | 'access'
  | 'exports'
  | 'incidents'
  | 'policies'
  | 'history'
  | 'settings';

interface AdminPrivacyProtectionModuleProps {
  onOpenNotifications?: () => void;
  onOpenAudit?: () => void;
}

const SECTION_NAV: Array<{ id: SectionKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Vue générale', icon: Activity },
  { id: 'inventory', label: 'Données utilisateurs', icon: Users },
  { id: 'consents', label: 'Consentements', icon: UserCheck },
  { id: 'requests', label: 'Demandes (DSAR)', icon: FileCheck2 },
  { id: 'retention', label: 'Conservation', icon: Database },
  { id: 'access', label: 'Accès aux données', icon: Shield },
  { id: 'exports', label: 'Exportations', icon: Download },
  { id: 'incidents', label: 'Incidents', icon: ShieldAlert },
  { id: 'policies', label: 'Politiques & docs', icon: FileText },
  { id: 'history', label: 'Historique & rapports', icon: History },
  { id: 'settings', label: 'Paramètres', icon: Settings }
];

const PRIVACY_PERMISSION_LABELS: Record<PrivacyPermissionKey, { label: string; desc: string }> = {
  viewPersonalData: { label: 'Voir données personnelles', desc: 'Révélation ponctuelle identité, email, téléphone et adresse (avec MFA)' },
  viewKycDocuments: { label: 'Voir documents KYC', desc: 'Consultation CNI, RCCM, permis et justificatifs professionnels' },
  viewFinancialData: { label: 'Voir données financières', desc: 'Soldes, coordonnées de paiement et commissions détaillées' },
  viewOrderData: { label: 'Voir données commandes', desc: 'Historique des commandes et preuves de livraison' },
  viewTechnicalLogs: { label: 'Voir journaux techniques', desc: 'IP masquées, sessions et traçabilité technique confidentielle' },
  viewOtherAdminsData: { label: 'Voir données autres admins', desc: 'Accès audité aux fiches des autres administrateurs' },
  processPrivacyRequests: { label: 'Traiter demandes DSAR', desc: 'Vérification, anonymisation et traitement des demandes d’accès/suppression' },
  exportUserData: { label: 'Exporter données utilisateur', desc: 'Portabilité individuelle sécurisée avec lien temporaire' },
  bulkExport: { label: 'Exportation massive (Restreint)', desc: 'Droit exceptionnel d’export groupé avec motif tracé et MFA' },
  managePrivacyIncidents: { label: 'Gérer incidents confidentialité', desc: 'Déclaration, investigation et évaluation ARTCI-CI des fuites/expositions' },
  managePolicies: { label: 'Gérer politiques & rétention', desc: 'Publication politiques officielles, durée de conservation et paramètres' }
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function controlBadge(status: 'actif' | 'partiel' | 'non_configure' | 'a_valider_juridique') {
  switch (status) {
    case 'actif':
      return { label: 'Actif', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    case 'partiel':
      return { label: 'Partiel', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    case 'non_configure':
      return { label: 'Non configuré', cls: 'bg-white/10 text-white/60 border-white/15' };
    case 'a_valider_juridique':
      return { label: 'Validation juridique requise', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
  }
}

function dsarStatusBadge(st: PrivacyRequestStatus) {
  switch (st) {
    case 'nouvelle':
      return { label: 'Nouvelle', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
    case 'en_verification':
      return { label: 'En vérification', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    case 'en_traitement':
      return { label: 'En traitement', cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30' };
    case 'en_attente_infos':
      return { label: 'En attente d’infos', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' };
    case 'traitee':
      return { label: 'Traitée', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    case 'refusee':
      return { label: 'Refusée avec justification', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
  }
}

function dsarTypeLabel(t: PrivacyRequestType): string {
  switch (t) {
    case 'acces_copie':
      return 'Copie / Accès aux données';
    case 'rectification':
      return 'Rectification';
    case 'suppression_anonymisation':
      return 'Suppression / Anonymisation';
    case 'retrait_consentement':
      return 'Retrait de consentement';
    case 'information_traitement':
      return 'Information sur l’utilisation';
  }
}

export const AdminPrivacyProtectionModule: React.FC<AdminPrivacyProtectionModuleProps> = ({
  onOpenNotifications,
  onOpenAudit
}) => {
  const { adminUsers, showToast } = useApp();
  const [section, setSection] = useState<SectionKey>('overview');
  const [data, setData] = useState<PrivacyOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Inventory filter & audited single-record reveal
  const [spaceFilter, setSpaceFilter] = useState<PrivacyUserSpace | 'all'>('all');
  const [inventorySearch, setInventorySearch] = useState('');
  const [revealTarget, setRevealTarget] = useState<{
    record: MaskedUserDataInventoryRecord;
    category: PrivacyDataCategoryGroup;
  } | null>(null);
  const [revealReason, setRevealReason] = useState('');
  const [revealedPayload, setRevealedPayload] = useState<RevealedPrivacyRecordPayload | null>(null);

  // Consents history modal
  const [selectedConsentUserId, setSelectedConsentUserId] = useState<string | null>(null);

  // New DSAR modal & process modal
  const [showNewDsar, setShowNewDsar] = useState(false);
  const [newDsarUserId, setNewDsarUserId] = useState('');
  const [newDsarType, setNewDsarType] = useState<PrivacyRequestType>('acces_copie');
  const [newDsarVerified, setNewDsarVerified] = useState(true);
  const [newDsarReason, setNewDsarReason] = useState('');
  const [selectedDsar, setSelectedDsar] = useState<PrivacyRequestRecord | null>(null);
  const [dsarComment, setDsarComment] = useState('');

  // Retention editing
  const [editingRule, setEditingRule] = useState<DataRetentionRuleRecord | null>(null);
  const [ruleDays, setRuleDays] = useState(365);
  const [ruleAnonymize, setRuleAnonymize] = useState(true);
  const [ruleNote, setRuleNote] = useState('');

  // Export state
  const [exportScope, setExportScope] = useState<'single_user' | 'bulk_filtered'>('single_user');
  const [exportUserId, setExportUserId] = useState('');
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [exportJustification, setExportJustification] = useState('');
  const [latestDownloadableExport, setLatestDownloadableExport] = useState<PrivacyExportRecord | null>(null);

  // Incidents modal
  const [showNewIncident, setShowNewIncident] = useState(false);
  const [incType, setIncType] = useState<PrivacyIncidentRecord['type']>('acces_non_autorise');
  const [incSeverity, setIncSeverity] = useState<PrivacyIncidentSeverity>('moyen');
  const [incAffectedCount, setIncAffectedCount] = useState(1);
  const [incOrigin, setIncOrigin] = useState('');
  const [incMeasures, setIncMeasures] = useState('');
  const [selectedIncident, setSelectedIncident] = useState<PrivacyIncidentRecord | null>(null);
  const [incStatusEdit, setIncStatusEdit] = useState<PrivacyIncidentStatus>('investigation');
  const [incMeasuresEdit, setIncMeasuresEdit] = useState('');

  // Policy editing
  const [editingPolicy, setEditingPolicy] = useState<PrivacyPolicyDocumentRecord | null>(null);
  const [polVersion, setPolVersion] = useState('');
  const [polSummary, setPolSummary] = useState('');
  const [polNotes, setPolNotes] = useState('');

  // Settings form
  const [setExportTtl, setSetExportTtl] = useState(15);
  const [setDsarSla, setSetDsarSla] = useState(30);
  const [setMfaReveal, setSetMfaReveal] = useState(true);
  const [setMfaExport, setSetMfaExport] = useState(true);
  const [setIdentityCheck, setSetIdentityCheck] = useState(true);
  const [setDpoEmail, setSetDpoEmail] = useState('dpo-confidentialite@djassa.ci');

  // MFA Modal
  const [mfaPrompt, setMfaPrompt] = useState<{
    title: string;
    description: string;
    previewCode?: string;
    onVerified: (code: string) => Promise<void>;
  } | null>(null);
  const [mfaInput, setMfaInput] = useState('');
  const [mfaSubmitting, setMfaSubmitting] = useState(false);

  const loadData = useCallback(async (syncUsers = false) => {
    try {
      if (syncUsers && adminUsers.length > 0) {
        await privacyService.syncDirectory(
          adminUsers.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            role: u.role,
            status: u.status,
            location: u.location,
            ordersCount: u.ordersCount,
            totalSpentOrEarned: u.totalSpentOrEarned,
            kycVerified: u.kycVerified,
            avatar: u.avatar,
            createdAt: u.createdAt
          }))
        ).catch(() => {});
      }
      const res = await privacyService.getOverview();
      setData(res);
      setSetExportTtl(res.settings.exportLinkTtlMinutes);
      setSetDsarSla(res.settings.dsarSlaDays);
      setSetMfaReveal(res.settings.requireMfaForSensitiveReveal);
      setSetMfaExport(res.settings.requireMfaForExport);
      setSetIdentityCheck(res.settings.requireIdentityCheckForDsar);
      setSetDpoEmail(res.settings.dpoContactEmail);
      if (res.inventory.length > 0 && !newDsarUserId) {
        setNewDsarUserId(res.inventory[0].userId);
        setExportUserId(res.inventory[0].userId);
      }
    } catch (err) {
      showToast((err as Error)?.message || 'Erreur chargement confidentialité');
    } finally {
      setLoading(false);
    }
  }, [adminUsers, newDsarUserId, showToast]);

  useEffect(() => {
    void loadData(true);
  }, [loadData]);

  // Auto-hide revealed cleartext after expiry
  useEffect(() => {
    if (!revealedPayload) return;
    const msLeft = new Date(revealedPayload.expiresAt).getTime() - Date.now();
    if (msLeft <= 0) {
      setRevealedPayload(null);
      return;
    }
    const t = setTimeout(() => setRevealedPayload(null), msLeft);
    return () => clearTimeout(t);
  }, [revealedPayload]);

  const requestMfaChallenge = async (
    title: string,
    description: string,
    onVerified: (code: string) => Promise<void>
  ) => {
    try {
      const challenge = await securityService.requestMfaChallenge();
      setMfaInput('');
      setMfaPrompt({
        title,
        description,
        previewCode: challenge.verificationCodePreview,
        onVerified
      });
    } catch (err) {
      showToast((err as Error)?.message || 'Impossible de préparer la vérification MFA');
    }
  };

  const handleConfirmReveal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revealTarget || revealReason.trim().length < 5) {
      showToast('Indiquez un motif professionnel d’au moins 5 caractères');
      return;
    }
    const target = revealTarget;
    const reason = revealReason.trim();
    if (data?.settings.requireMfaForSensitiveReveal) {
      await requestMfaChallenge(
        'Vérification MFA — Accès donnée sensible',
        `Révélation auditée (${target.category}) pour un seul compte. Cette consultation est enregistrée.`,
        async (code) => {
          const res = await privacyService.revealRecord(target.record.id, { category: target.category, reason }, code);
          setRevealedPayload(res.revealed);
          setRevealTarget(null);
          setRevealReason('');
          showToast('Données révélées temporairement (120s) et journalisées');
          await loadData(false);
        }
      );
    } else {
      try {
        const res = await privacyService.revealRecord(target.record.id, { category: target.category, reason });
        setRevealedPayload(res.revealed);
        setRevealTarget(null);
        setRevealReason('');
        await loadData(false);
      } catch (err) {
        showToast((err as Error)?.message || 'Accès refusé');
      }
    }
  };

  const handleCreateDsar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await privacyService.createPrivacyRequest({
        userId: newDsarUserId,
        type: newDsarType,
        identityVerified: newDsarVerified,
        reason: newDsarReason.trim()
      });
      setShowNewDsar(false);
      setNewDsarReason('');
      showToast('Demande de confidentialité enregistrée');
      await loadData(false);
    } catch (err) {
      showToast((err as Error)?.message || 'Erreur création demande');
    }
  };

  const handleProcessDsar = async (
    dsar: PrivacyRequestRecord,
    status: PrivacyRequestStatus,
    resolutionMode: 'anonymize' | 'hard_delete' | '' = ''
  ) => {
    try {
      const res = await privacyService.updatePrivacyRequest(dsar.id, {
        status,
        identityVerified: true,
        comment: dsarComment.trim() || undefined,
        resolutionMode
      });
      setSelectedDsar(res.request);
      setDsarComment('');
      showToast(
        res.request.anonymizationApplied
          ? 'Anonymisation appliquée (justificatifs financiers conservés)'
          : `Demande mise à jour : ${status}`
      );
      await loadData(false);
    } catch (err) {
      showToast((err as Error)?.message || 'Action impossible sur cette demande');
    }
  };

  const handleCreateExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (exportJustification.trim().length < 8) {
      showToast('Motif traçable d’au moins 8 caractères requis');
      return;
    }
    const execExport = async (code?: string) => {
      const res = await privacyService.createExport(
        {
          scope: exportScope,
          userId: exportScope === 'single_user' ? exportUserId : undefined,
          format: exportFormat,
          justification: exportJustification.trim()
        },
        code
      );
      setLatestDownloadableExport(res.exportRecord);
      setExportJustification('');
      showToast('Export sécurisé généré avec lien temporaire');
      await loadData(false);
    };

    if (data?.settings.requireMfaForExport) {
      await requestMfaChallenge(
        'Vérification MFA — Exportation de données',
        `Confirmez la génération de l’export (${exportScope === 'bulk_filtered' ? 'export massif audité' : 'portabilité utilisateur'}).`,
        async (code) => {
          await execExport(code);
        }
      );
    } else {
      try {
        await execExport();
      } catch (err) {
        showToast((err as Error)?.message || 'Export refusé');
        await loadData(false);
      }
    }
  };

  const handleSaveRetention = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    await requestMfaChallenge(
      'Modification règle de conservation',
      `Confirmez la mise à jour de « ${editingRule.label} ».`,
      async (code) => {
        await privacyService.updateRetentionRule(
          editingRule.id,
          {
            retentionDays: Number(ruleDays),
            anonymizeInsteadOfDelete: ruleAnonymize,
            extendedRetentionNote: ruleNote
          },
          code
        );
        setEditingRule(null);
        showToast('Règle de conservation mise à jour');
        await loadData(false);
      }
    );
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await privacyService.createIncident({
        type: incType,
        affectedCategories: ['personal'],
        potentiallyAffectedUsersCount: Number(incAffectedCount),
        severity: incSeverity,
        origin: incOrigin.trim(),
        measuresTaken: incMeasures.trim()
      });
      setShowNewIncident(false);
      setIncOrigin('');
      setIncMeasures('');
      showToast('Incident de confidentialité enregistré');
      await loadData(false);
    } catch (err) {
      showToast((err as Error)?.message || 'Erreur enregistrement incident');
    }
  };

  const handleUpdateIncident = async (validateArtciNotification = false) => {
    if (!selectedIncident) return;
    if (validateArtciNotification) {
      await requestMfaChallenge(
        'Validation Super Admin — Notification ARTCI-CI',
        'Cette validation autorise officiellement la notification réglementaire ARTCI-CI / personnes concernées.',
        async (code) => {
          const res = await privacyService.updateIncident(
            selectedIncident.id,
            {
              status: incStatusEdit,
              measuresTaken: incMeasuresEdit,
              requiresArtciNotification: true,
              adminValidatedNotification: true
            },
            code
          );
          setSelectedIncident(res.incident);
          showToast('Notification ARTCI-CI validée par Super Admin');
          await loadData(false);
        }
      );
    } else {
      try {
        const res = await privacyService.updateIncident(selectedIncident.id, {
          status: incStatusEdit,
          measuresTaken: incMeasuresEdit
        });
        setSelectedIncident(res.incident);
        showToast('Incident mis à jour');
        await loadData(false);
      } catch (err) {
        showToast((err as Error)?.message || 'Erreur mise à jour incident');
      }
    }
  };

  const handlePublishPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPolicy) return;
    await requestMfaChallenge(
      'Publication document officiel (MFA)',
      `Confirmez la publication de « ${editingPolicy.title} » v${polVersion}.`,
      async (code) => {
        await privacyService.updatePolicy(
          editingPolicy.id,
          {
            currentVersion: polVersion,
            status: 'publie',
            summary: polSummary,
            notes: polNotes
          },
          code
        );
        setEditingPolicy(null);
        showToast('Document officiel publié et historisé');
        await loadData(false);
      }
    );
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await requestMfaChallenge(
      'Paramètres Confidentialité (MFA)',
      'Confirmez la modification des paramètres de protection des données.',
      async (code) => {
        await privacyService.updateSettings(
          {
            exportLinkTtlMinutes: Number(setExportTtl),
            dsarSlaDays: Number(setDsarSla),
            requireMfaForSensitiveReveal: setMfaReveal,
            requireMfaForExport: setMfaExport,
            requireIdentityCheckForDsar: setIdentityCheck,
            dpoContactEmail: setDpoEmail
          },
          code
        );
        showToast('Paramètres confidentialité enregistrés');
        await loadData(false);
      }
    );
  };

  const handleTogglePermission = async (
    staffId: string,
    key: PrivacyPermissionKey,
    val: boolean
  ) => {
    await requestMfaChallenge(
      'Modification droits Confidentialité',
      `Confirmez la modification de « ${PRIVACY_PERMISSION_LABELS[key].label} ».`,
      async (code) => {
        await privacyService.updateStaffPermissions(staffId, { [key]: val }, code);
        showToast('Permission confidentialité mise à jour');
        await loadData(false);
      }
    );
  };

  if (loading && !data) {
    return (
      <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center space-y-2">
        <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
        <p className="text-xs font-bold text-white/70">Chargement du module Confidentialité & données...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
        Impossible de charger les données de confidentialité.
      </div>
    );
  }

  const perms = data.myPermissions;
  const isSuperAdmin = data.myRole === 'super_admin';
  const filteredInventory = data.inventory.filter((u) => {
    if (spaceFilter !== 'all' && u.space !== spaceFilter) return false;
    if (inventorySearch.trim()) {
      const q = inventorySearch.toLowerCase();
      return (
        u.displayLabel.toLowerCase().includes(q) ||
        u.userId.toLowerCase().includes(q) ||
        u.spaceLabel.toLowerCase().includes(q) ||
        (u.commercialMasked.shopOrCompanyName || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedConsent = data.consents.find((c) => c.userId === selectedConsentUserId) || null;

  return (
    <div className="space-y-3.5 text-xs">
      {/* Header Banner */}
      <div className="p-3.5 rounded-2xl bg-[#111318] border border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <h3 className="text-sm font-black text-white">Confidentialité & protection des données</h3>
            <span className="px-2 py-0.5 rounded-lg border border-sky-500/30 bg-sky-500/15 text-sky-300 text-[10px] font-black">
              Loi n° 2013-450 CI
            </span>
          </div>
          <p className="text-[11px] text-white/55">{data.kpis.overallStatusLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadData(false)}
            className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Actualiser</span>
          </button>
          {onOpenAudit && (
            <button
              type="button"
              onClick={onOpenAudit}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-amber-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Journal d'activité</span>
            </button>
          )}
        </div>
      </div>

      {/* Horizontal 11-Section Sub-Navigation */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {SECTION_NAV.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`shrink-0 px-3 py-2 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition ${
                active
                  ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                  : 'bg-white/[0.03] border-white/10 text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{item.label}</span>
              {item.id === 'requests' && data.kpis.requestsPending > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px]">
                  {data.kpis.requestsPending}
                </span>
              )}
              {item.id === 'incidents' && data.kpis.privacyIncidentsOpen > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[10px]">
                  {data.kpis.privacyIncidentsOpen}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          1. VUE GÉNÉRALE
         ========================================================================= */}
      {section === 'overview' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
              <p className="text-[10px] text-white/50 font-bold uppercase">Comptes actifs suivis</p>
              <p className="text-base font-black text-white font-mono">{data.kpis.activeAccountsCount}</p>
              <p className="text-[10px] text-white/45">5 espaces DJASSA (masqués par défaut)</p>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
              <p className="text-[10px] text-white/50 font-bold uppercase">Demandes (DSAR)</p>
              <p className="text-base font-black text-amber-300 font-mono">
                {data.kpis.requestsPending} en attente <span className="text-white/40 text-xs">/ {data.kpis.requestsProcessed} traitées</span>
              </p>
              <p className="text-[10px] text-white/45">Total : {data.kpis.requestsTotal}</p>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
              <p className="text-[10px] text-white/50 font-bold uppercase">Incidents & rétention</p>
              <p className={`text-base font-black font-mono ${data.kpis.privacyIncidentsOpen > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                {data.kpis.privacyIncidentsOpen} incident(s) ouvert(s)
              </p>
              <p className="text-[10px] text-white/45">{data.kpis.retentionCategoriesCount} catégories de conservation</p>
            </div>
          </div>

          {/* Honest Technical & Legal Audit Checklist */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-black text-white">Contrôles techniques vs conformité réglementaire (Côte d’Ivoire)</h4>
              <span className="text-[10px] text-white/45 font-mono">{fmtDate(data.kpis.lastComplianceCheckAt)}</span>
            </div>
            <div className="space-y-1.5">
              {data.controlAudit.map((ctrl) => {
                const b = controlBadge(ctrl.status);
                return (
                  <div key={ctrl.id} className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-white text-[11px]">{ctrl.label}</span>
                      <span className={`px-2 py-0.5 rounded border text-[9px] font-black ${b.cls}`}>{b.label}</span>
                    </div>
                    <p className="text-[10px] text-white/60">{ctrl.details}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          2. DONNÉES DES UTILISATEURS (MASQUÉES PAR DÉFAUT + RÉVÉLATION AUDITÉE MFA)
         ========================================================================= */}
      {section === 'inventory' && (
        <div className="space-y-2.5 animate-in fade-in duration-150">
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] text-white/70 flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Toutes les données sensibles sont masquées par défaut. L’affichage en clair est limité à un seul dossier, avec justification obligatoire, MFA et journalisation.
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['all', 'Tous'],
                ['client', 'Clients'],
                ['seller', 'Vendeurs'],
                ['driver', 'Livreurs'],
                ['company', 'Entreprises'],
                ['admin', 'Admins & Agents']
              ] as const
            ).map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                onClick={() => setSpaceFilter(k)}
                className={`px-2.5 py-1.5 rounded-xl border text-[10px] font-bold cursor-pointer ${
                  spaceFilter === k
                    ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                    : 'bg-white/5 border-white/10 text-white/60'
                }`}
              >
                {lbl}
              </button>
            ))}
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-2" />
              <input
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                placeholder="Filtrer par ID, espace, boutique..."
                className="w-full pl-8 pr-2.5 py-1.5 rounded-xl bg-black/50 border border-white/10 text-white text-[11px]"
              />
            </div>
          </div>

          {/* Temporarily Revealed Banner */}
          {revealedPayload && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/35 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-black text-amber-200 text-xs flex items-center gap-1.5">
                  <Eye className="w-4 h-4" />
                  <span>Consultation ponctuelle autorisée (auto-masquage à {fmtDate(revealedPayload.expiresAt)})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setRevealedPayload(null)}
                  className="px-2 py-1 rounded-lg bg-black/40 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <EyeOff className="w-3 h-3" />
                  <span>Masquer</span>
                </button>
              </div>
              <pre className="p-2.5 rounded-xl bg-black/60 text-[10px] font-mono text-white/90 overflow-x-auto">
                {JSON.stringify(
                  {
                    personal: revealedPayload.personal,
                    commercial: revealedPayload.commercial,
                    financial: revealedPayload.financial,
                    technical: revealedPayload.technical
                  },
                  null,
                  2
                )}
              </pre>
            </div>
          )}

          <div className="space-y-2">
            {filteredInventory.map((rec) => (
              <div key={rec.id} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[9px] font-black">
                        {rec.spaceLabel}
                      </span>
                      <span className="font-black text-white text-xs">{rec.personalMasked.fullName}</span>
                      {rec.anonymized && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-black">
                          ANONYMISÉ
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-white/45">ID : {rec.userId} • Créé : {fmtDate(rec.createdAt)}</p>
                  </div>
                  {rec.hasLegalRetentionLock && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-200 text-[9px] font-bold">
                      Conservation légale verrouillée
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                  <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-white/70 uppercase">Données personnelles</span>
                      <button
                        type="button"
                        onClick={() => {
                          setRevealTarget({ record: rec, category: 'personal' });
                          setRevealReason('');
                        }}
                        className="text-sky-300 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> Révéler (MFA)
                      </button>
                    </div>
                    <p className="text-white/70">Email : {rec.personalMasked.email}</p>
                    <p className="text-white/70">Tél : {rec.personalMasked.phone}</p>
                    <p className="text-white/55">Adresse : {rec.personalMasked.deliveryAddress}</p>
                  </div>

                  <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-white/70 uppercase">Commercial & KYC</span>
                      <button
                        type="button"
                        onClick={() => {
                          setRevealTarget({ record: rec, category: 'commercial' });
                          setRevealReason('');
                        }}
                        className="text-sky-300 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> Révéler (MFA)
                      </button>
                    </div>
                    <p className="text-white/70">{rec.commercialMasked.shopOrCompanyName || 'Compte particulier'}</p>
                    <p className="text-white/70">KYC ({rec.commercialMasked.kycStatus}) : {rec.commercialMasked.kycDocSummary}</p>
                    <p className="text-white/55">{rec.commercialMasked.ordersCount} cmd • {rec.commercialMasked.deliveriesCount} livr.</p>
                  </div>

                  <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-white/70 uppercase">Données financières</span>
                      <button
                        type="button"
                        onClick={() => {
                          setRevealTarget({ record: rec, category: 'financial' });
                          setRevealReason('');
                        }}
                        className="text-sky-300 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> Révéler (MFA)
                      </button>
                    </div>
                    <p className="text-white/70">{rec.financialMasked.walletSummary}</p>
                    <p className="text-white/70">Transactions confirmées : {rec.financialMasked.confirmedTransactionsCount}</p>
                    {rec.financialMasked.payoutTargetMasked && (
                      <p className="text-white/55">Compte versement : {rec.financialMasked.payoutTargetMasked}</p>
                    )}
                  </div>

                  <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-white/70 uppercase">Données techniques</span>
                      <button
                        type="button"
                        onClick={() => {
                          setRevealTarget({ record: rec, category: 'technical' });
                          setRevealReason('');
                        }}
                        className="text-sky-300 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> Révéler (MFA)
                      </button>
                    </div>
                    <p className="text-white/70">Sessions actives : {rec.technicalSummary.activeSessionsCount}</p>
                    <p className="text-white/70">Appareil : {rec.technicalSummary.lastDevice}</p>
                    <p className="text-white/55">IP masquée : {rec.technicalSummary.lastIpMasked}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          3. CONSENTEMENTS
         ========================================================================= */}
      {section === 'consents' && (
        <div className="space-y-2.5 animate-in fade-in duration-150">
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] text-white/70">
            Distinction stricte entre les traitements <strong>nécessaires au fonctionnement du service</strong> (commandes, paiements, preuves POD) et les traitements <strong>optionnels soumis au consentement</strong> (prospection commerciale, push marketing).
          </div>

          <div className="space-y-2">
            {data.consents.map((c) => (
              <div key={c.id} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-black text-white text-xs">{c.userLabel} ({c.space})</p>
                    <p className="text-[10px] text-white/50">CGU v{c.cguVersion} • Politique confidentialité v{c.privacyVersion}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedConsentUserId(selectedConsentUserId === c.userId ? null : c.userId)}
                    className="px-2.5 py-1 rounded-xl bg-white/10 text-white font-bold text-[10px] cursor-pointer"
                  >
                    Historique ({c.history.length})
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                  <label className="p-2 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                    <span>Communications commerciales (Optionnel)</span>
                    <input
                      type="checkbox"
                      disabled={!perms.processPrivacyRequests}
                      checked={c.marketingOptIn}
                      onChange={async (e) => {
                        await privacyService.updateConsent({ userId: c.userId, marketingOptIn: e.target.checked });
                        showToast('Consentement marketing mis à jour');
                        await loadData(false);
                      }}
                      className="accent-emerald-500 w-4 h-4"
                    />
                  </label>
                  <label className="p-2 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                    <span>Notifications applicatives</span>
                    <input
                      type="checkbox"
                      disabled={!perms.processPrivacyRequests}
                      checked={c.notificationsOptIn}
                      onChange={async (e) => {
                        await privacyService.updateConsent({ userId: c.userId, notificationsOptIn: e.target.checked });
                        showToast('Préférence notifications mise à jour');
                        await loadData(false);
                      }}
                      className="accent-emerald-500 w-4 h-4"
                    />
                  </label>
                </div>

                {selectedConsent?.userId === c.userId && (
                  <div className="p-2.5 rounded-xl bg-black/50 border border-white/10 space-y-1.5">
                    <p className="text-[10px] font-bold text-white/60">Journal des modifications de consentement</p>
                    {c.history.map((h) => (
                      <div key={h.id} className="flex justify-between text-[10px] text-white/75 border-b border-white/5 pb-1">
                        <span>{h.consentType} → <strong>{h.action}</strong> (v{h.documentVersion}) par {h.actor}</span>
                        <span className="font-mono text-white/45">{fmtDate(h.at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          4. DEMANDES DES UTILISATEURS (DSAR) & ANONYMISATION SÉCURISÉE
         ========================================================================= */}
      {section === 'requests' && (
        <div className="space-y-2.5 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-white/65">
              Règle légale : les paiements, factures et preuves de livraison (POD) ne sont jamais supprimés ; l’anonymisation protège l’identité.
            </p>
            {perms.processPrivacyRequests && (
              <button
                type="button"
                onClick={() => setShowNewDsar(true)}
                className="px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-black text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouvelle demande DSAR</span>
              </button>
            )}
          </div>

          {data.requests.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center text-white/55">
              Aucune demande d’accès, rectification ou suppression enregistrée.
            </div>
          ) : (
            <div className="space-y-2">
              {data.requests.map((r) => {
                const st = dsarStatusBadge(r.status);
                return (
                  <div key={r.id} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded border text-[9px] font-black ${st.cls}`}>{st.label}</span>
                          <span className="text-[10px] font-mono text-white/45">{r.id}</span>
                          {r.anonymizationApplied && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-black">
                              ANONYMISATION APPLIQUÉE
                            </span>
                          )}
                        </div>
                        <p className="font-black text-white text-xs mt-1">
                          {dsarTypeLabel(r.type)} — {r.userLabel} ({r.space})
                        </p>
                        <p className="text-[11px] text-white/65">{r.justificationOrReason}</p>
                      </div>
                      {perms.processPrivacyRequests && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDsar(r);
                            setDsarComment('');
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-[10px] cursor-pointer"
                        >
                          Traiter
                        </button>
                      )}
                    </div>
                    {r.legalHoldDetected && (
                      <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[10px] text-amber-200">
                        Verrou légal détecté : {r.legalHoldDetails}
                      </div>
                    )}
                    <p className="text-[10px] text-white/45">
                      Reçue : {fmtDate(r.receivedAt)} • Échéance légale : {fmtDate(r.dueDate)}
                      {r.responsibleAdminName ? ` • Resp : ${r.responsibleAdminName}` : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          5. CONSERVATION DES DONNÉES (9 CATÉGORIES OBLIGATOIRES)
         ========================================================================= */}
      {section === 'retention' && (
        <div className="space-y-2 animate-in fade-in duration-150">
          {data.retentionRules.map((rule) => (
            <div key={rule.id} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-white text-xs">{rule.label}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                        rule.status === 'gele_litige' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {rule.status === 'gele_litige' ? 'Gel litige actif' : 'Actif'}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/60 mt-0.5">{rule.purpose}</p>
                </div>
                {perms.managePolicies && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRule(rule);
                      setRuleDays(rule.retentionDays);
                      setRuleAnonymize(rule.anonymizeInsteadOfDelete);
                      setRuleNote(rule.extendedRetentionNote);
                    }}
                    className="px-2.5 py-1 rounded-xl bg-white/10 text-white font-bold text-[10px] cursor-pointer"
                  >
                    Configurer
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                <div className="p-1.5 rounded-lg bg-black/35">
                  <span className="text-white/45 block">Durée définie</span>
                  <span className="font-mono font-bold text-white">{rule.retentionDays} jours</span>
                </div>
                <div className="p-1.5 rounded-lg bg-black/35">
                  <span className="text-white/45 block">Enregistrements</span>
                  <span className="font-mono font-bold text-white">{rule.activeRecordsCount}</span>
                </div>
                <div className="p-1.5 rounded-lg bg-black/35">
                  <span className="text-white/45 block">Mode fin de vie</span>
                  <span className="font-bold text-white/85">
                    {rule.anonymizeInsteadOfDelete ? 'Anonymisation' : rule.allowDeletionAfterExpiry ? 'Purge' : 'Conservation légale'}
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-black/35">
                  <span className="text-white/45 block">Prochaine échéance</span>
                  <span className="font-mono text-white/75">{fmtDate(rule.nextScheduledPurgeAt)}</span>
                </div>
              </div>
              <p className="text-[10px] text-sky-300/80">{rule.legalReferenceCi}</p>
            </div>
          ))}
        </div>
      )}

      {/* =========================================================================
          6. ACCÈS AUX DONNÉES (RBAC 11 DROITS)
         ========================================================================= */}
      {section === 'access' && (
        <div className="space-y-2.5 animate-in fade-in duration-150">
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] text-white/65">
            Contrôle granulaire appliqué côté serveur sur chaque révélation et exportation. Seul le Super Administrateur peut modifier ces habilitations (avec MFA).
          </div>
          {data.permissionsDirectory.map((member) => {
            const isMemberSuper = member.role === 'super_admin';
            const isOther = member.role === 'other_agent';
            return (
              <div key={member.staffId} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-black text-white text-xs">{member.name}</p>
                    <p className="text-[10px] text-white/50 font-mono">{member.email} • {member.role}</p>
                  </div>
                  {isMemberSuper && (
                    <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] font-black">
                      SUPER ADMIN (TOUS DROITS)
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {(Object.keys(PRIVACY_PERMISSION_LABELS) as PrivacyPermissionKey[]).map((key) => {
                    const checked = member.permissions[key];
                    const editable = isSuperAdmin && !isMemberSuper && !isOther;
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={!editable}
                        onClick={() => void handleTogglePermission(member.staffId, key, !checked)}
                        className={`p-2 rounded-xl border text-left flex items-center justify-between gap-2 ${
                          checked ? 'bg-emerald-500/10 border-emerald-500/30 text-white' : 'bg-white/[0.02] border-white/10 text-white/45'
                        } ${editable ? 'cursor-pointer hover:bg-white/10' : 'opacity-75 cursor-default'}`}
                      >
                        <div>
                          <p className="text-[10px] font-bold">{PRIVACY_PERMISSION_LABELS[key].label}</p>
                          <p className="text-[9px] text-white/45">{PRIVACY_PERMISSION_LABELS[key].desc}</p>
                        </div>
                        <span
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                            checked ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/30'
                          }`}
                        >
                          {checked ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <X className="w-3 h-3" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          7. EXPORTATIONS & PORTABILITÉ SÉCURISÉE
         ========================================================================= */}
      {section === 'exports' && (
        <div className="space-y-3 animate-in fade-in duration-150">
          {perms.exportUserData && (
            <form onSubmit={(e) => void handleCreateExport(e)} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
              <h4 className="font-black text-white flex items-center gap-1.5">
                <Download className="w-4 h-4 text-sky-400" />
                <span>Préparer une exportation sécurisée</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={exportScope}
                  onChange={(e) => setExportScope(e.target.value as 'single_user' | 'bulk_filtered')}
                  className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-[11px]"
                >
                  <option value="single_user">Portabilité individuelle (1 compte)</option>
                  <option value="bulk_filtered">Export massif (permission bulkExport requise)</option>
                </select>
                {exportScope === 'single_user' && (
                  <select
                    value={exportUserId}
                    onChange={(e) => setExportUserId(e.target.value)}
                    className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-[11px]"
                  >
                    {data.inventory.map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.displayLabel} ({u.spaceLabel})
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as 'json' | 'csv')}
                  className="px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-[11px]"
                >
                  <option value="json">Format JSON structuré</option>
                  <option value="csv">Format CSV lisible</option>
                </select>
              </div>
              <input
                value={exportJustification}
                onChange={(e) => setExportJustification(e.target.value)}
                required
                placeholder="Motif traçable (ex: Réponse demande d'accès utilisateur #dsar-xxx)..."
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-[11px]"
              />
              <button
                type="submit"
                className="w-full py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-black text-xs cursor-pointer"
              >
                Générer l’exportation avec lien temporaire ({data.settings.exportLinkTtlMinutes} min)
              </button>
            </form>
          )}

          {latestDownloadableExport?.downloadToken && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-black text-emerald-300 text-xs">Fichier prêt : {latestDownloadableExport.targetUserLabel}</p>
                <p className="text-[10px] text-white/65">Expire à {fmtDate(latestDownloadableExport.expiresAt)}</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  void privacyService
                    .downloadExportFile(
                      latestDownloadableExport.id,
                      latestDownloadableExport.downloadToken!,
                      latestDownloadableExport.format
                    )
                    .then(() => {
                      showToast('Fichier téléchargé');
                      void loadData(false);
                    })
                    .catch((e) => showToast((e as Error)?.message || 'Lien expiré'))
                }
                className="px-3 py-2 rounded-xl bg-emerald-500 text-black font-black text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger ({latestDownloadableExport.format.toUpperCase()})</span>
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            {data.exports.map((exp) => (
              <div key={exp.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-white text-[11px]">{exp.targetUserLabel} • {exp.format.toUpperCase()}</p>
                  <p className="text-[10px] text-white/50">
                    Par {exp.requestedByName} • {exp.justification}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded bg-white/10 text-white/75 text-[10px] font-bold uppercase">
                  {exp.status} ({exp.downloadCount}×)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          8. INCIDENTS DE CONFIDENTIALITÉ & NOTIFICATION ARTCI-CI
         ========================================================================= */}
      {section === 'incidents' && (
        <div className="space-y-2.5 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-white/65">
              Aucune notification réglementaire ARTCI-CI ou aux utilisateurs n’est envoyée automatiquement sans validation explicite du Super Administrateur.
            </p>
            {perms.managePrivacyIncidents && (
              <button
                type="button"
                onClick={() => setShowNewIncident(true)}
                className="px-3 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Déclarer un incident</span>
              </button>
            )}
          </div>

          {data.incidents.length === 0 ? (
            <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-center text-white/70">
              Aucun incident de confidentialité ou violation de données enregistré.
            </div>
          ) : (
            data.incidents.map((inc) => (
              <div key={inc.id} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[9px] font-black uppercase">
                        {inc.severity}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/75 text-[9px] font-bold uppercase">
                        {inc.status}
                      </span>
                      <span className="text-[10px] font-mono text-white/45">{inc.id}</span>
                    </div>
                    <p className="font-black text-white text-xs mt-1">{inc.origin}</p>
                    <p className="text-[11px] text-white/65">{inc.measuresTaken}</p>
                  </div>
                  {perms.managePrivacyIncidents && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIncident(inc);
                        setIncStatusEdit(inc.status);
                        setIncMeasuresEdit(inc.measuresTaken);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-white/10 text-white font-bold text-[10px] cursor-pointer"
                    >
                      Gérer
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-white/50">
                  Comptes potentiellement touchés : {inc.potentiallyAffectedUsersCount} • Validation ARTCI :{' '}
                  {inc.artciAssessment.adminValidatedNotification
                    ? `Validée par ${inc.artciAssessment.validatedBy}`
                    : 'En attente de validation manuelle'}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* =========================================================================
          9. POLITIQUES & DOCUMENTS OFFICIELS
         ========================================================================= */}
      {section === 'policies' && (
        <div className="space-y-2 animate-in fade-in duration-150">
          {data.policies.map((doc) => (
            <div key={doc.id} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-white text-xs">{doc.title}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                        doc.status === 'publie' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {doc.status} • v{doc.currentVersion}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/65 mt-0.5">{doc.summary}</p>
                </div>
                {perms.managePolicies && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPolicy(doc);
                      setPolVersion(doc.currentVersion);
                      setPolSummary(doc.summary);
                      setPolNotes('');
                    }}
                    className="px-2.5 py-1 rounded-xl bg-white/10 text-white font-bold text-[10px] cursor-pointer"
                  >
                    Mettre à jour / Publier
                  </button>
                )}
              </div>
              <p className="text-[10px] text-white/45">
                Entrée en vigueur : {fmtDate(doc.effectiveAt)} • Validateur : {doc.validatedBy || 'En attente'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* =========================================================================
          10. HISTORIQUE & RAPPORTS
         ========================================================================= */}
      {section === 'history' && (
        <div className="space-y-2 animate-in fade-in duration-150">
          <div className="flex flex-wrap gap-2">
            {onOpenAudit && (
              <button
                type="button"
                onClick={onOpenAudit}
                className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-amber-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Journal d'activité complet</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
            {onOpenNotifications && (
              <button
                type="button"
                onClick={onOpenNotifications}
                className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[#FF6321] font-bold text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Notifications & alertes</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {data.auditHistory.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center text-white/55">
              Aucune action enregistrée dans ce module.
            </div>
          ) : (
            data.auditHistory.map((h) => (
              <div key={h.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="font-bold text-white">{h.action}</span>
                  <span className="font-mono text-white/45">{fmtDate(h.at)}</span>
                </div>
                <p className="text-[10px] text-white/60">
                  Par {h.actorName} • Cible : {h.target} • Résultat : <strong>{h.result}</strong>
                </p>
                <p className="text-[10px] text-white/50">{h.details}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* =========================================================================
          11. PARAMÈTRES CONFIDENTIALITÉ
         ========================================================================= */}
      {section === 'settings' && (
        <form onSubmit={(e) => void handleSaveSettings(e)} className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-3 animate-in fade-in duration-150">
          <h4 className="font-black text-white">Paramètres généraux de protection des données</h4>
          <p className="text-[10px] text-sky-300">{data.settings.legalFrameworkLabel}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
              <label className="text-[10px] text-white/50 block">Durée liens d’export temporaires (minutes)</label>
              <input
                type="number"
                min={5}
                max={120}
                disabled={!perms.managePolicies}
                value={setExportTtl}
                onChange={(e) => setSetExportTtl(Number(e.target.value))}
                className="w-full mt-1 px-2 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white font-mono"
              />
            </div>

            <div className="p-2.5 rounded-xl bg-black/40 border border-white/10">
              <label className="text-[10px] text-white/50 block">Délai de traitement DSAR (jours)</label>
              <input
                type="number"
                min={7}
                max={60}
                disabled={!perms.managePolicies}
                value={setDsarSla}
                onChange={(e) => setSetDsarSla(Number(e.target.value))}
                className="w-full mt-1 px-2 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white font-mono"
              />
            </div>

            <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 sm:col-span-2">
              <label className="text-[10px] text-white/50 block">Contact DPO / Correspondant Confidentialité</label>
              <input
                type="email"
                disabled={!perms.managePolicies}
                value={setDpoEmail}
                onChange={(e) => setSetDpoEmail(e.target.value)}
                className="w-full mt-1 px-2 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white"
              />
            </div>

            <label className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
              <span>MFA obligatoire pour révéler des données</span>
              <input
                type="checkbox"
                disabled={!perms.managePolicies}
                checked={setMfaReveal}
                onChange={(e) => setSetMfaReveal(e.target.checked)}
                className="accent-emerald-500 w-4 h-4"
              />
            </label>

            <label className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
              <span>MFA obligatoire pour toute exportation</span>
              <input
                type="checkbox"
                disabled={!perms.managePolicies}
                checked={setMfaExport}
                onChange={(e) => setSetMfaExport(e.target.checked)}
                className="accent-emerald-500 w-4 h-4"
              />
            </label>

            <label className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between sm:col-span-2">
              <span>Vérification d’identité requise avant clôture DSAR</span>
              <input
                type="checkbox"
                disabled={!perms.managePolicies}
                checked={setIdentityCheck}
                onChange={(e) => setSetIdentityCheck(e.target.checked)}
                className="accent-emerald-500 w-4 h-4"
              />
            </label>
          </div>

          {perms.managePolicies && (
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs cursor-pointer"
            >
              Enregistrer les paramètres (Validation MFA)
            </button>
          )}
        </form>
      )}

      {/* Modal: Justification before Audited Single-Record Reveal */}
      {revealTarget && (
        <div className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setRevealTarget(null)}>
          <form onSubmit={(e) => void handleConfirmReveal(e)} className="w-full max-w-sm rounded-2xl bg-[#141418] border border-white/15 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="font-black text-white text-sm">Consultation auditée ({revealTarget.category})</h4>
              <button type="button" onClick={() => setRevealTarget(null)} className="text-white/50 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-white/65">
              Dossier : <strong>{revealTarget.record.displayLabel}</strong> ({revealTarget.record.spaceLabel}). Cet accès sera enregistré dans le journal d’audit.
            </p>
            <textarea
              required
              rows={2}
              value={revealReason}
              onChange={(e) => setRevealReason(e.target.value)}
              placeholder="Motif légitime (ex: Vérification litige commande #...)"
              className="w-full p-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-xs"
            />
            <button type="submit" className="w-full py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-black text-xs cursor-pointer">
              Continuer vers vérification MFA
            </button>
          </form>
        </div>
      )}

      {/* Modal: New DSAR */}
      {showNewDsar && (
        <div className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowNewDsar(false)}>
          <form onSubmit={(e) => void handleCreateDsar(e)} className="w-full max-w-md rounded-2xl bg-[#141418] border border-white/15 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="font-black text-white text-sm">Enregistrer une demande DSAR</h4>
              <button type="button" onClick={() => setShowNewDsar(false)} className="text-white/50 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <select value={newDsarUserId} onChange={(e) => setNewDsarUserId(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-xs">
              {data.inventory.map((u) => (
                <option key={u.userId} value={u.userId}>{u.displayLabel} ({u.spaceLabel})</option>
              ))}
            </select>
            <select value={newDsarType} onChange={(e) => setNewDsarType(e.target.value as PrivacyRequestType)} className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-xs">
              <option value="acces_copie">Accès / copie des données</option>
              <option value="rectification">Rectification</option>
              <option value="suppression_anonymisation">Suppression / anonymisation</option>
              <option value="retrait_consentement">Retrait de consentement</option>
              <option value="information_traitement">Information sur le traitement</option>
            </select>
            <label className="flex items-center gap-2 text-xs text-white/80">
              <input type="checkbox" checked={newDsarVerified} onChange={(e) => setNewDsarVerified(e.target.checked)} className="accent-emerald-500" />
              <span>Identité du demandeur vérifiée</span>
            </label>
            <textarea required rows={2} value={newDsarReason} onChange={(e) => setNewDsarReason(e.target.value)} placeholder="Précisions de la demande..." className="w-full p-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-xs" />
            <button type="submit" className="w-full py-2.5 rounded-xl bg-sky-500 text-black font-black text-xs cursor-pointer">Créer la demande</button>
          </form>
        </div>
      )}

      {/* Modal: Process DSAR */}
      {selectedDsar && (
        <div className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedDsar(null)}>
          <div className="w-full max-w-md rounded-2xl bg-[#141418] border border-white/15 p-4 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h4 className="font-black text-white text-sm">{dsarTypeLabel(selectedDsar.type)} — {selectedDsar.userLabel}</h4>
              <button type="button" onClick={() => setSelectedDsar(null)} className="text-white/50 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            {selectedDsar.legalHoldDetected && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200">
                <strong>Protection légale active :</strong> {selectedDsar.legalHoldDetails}. La suppression totale est bloquée ; utilisez l’anonymisation sécurisée.
              </div>
            )}
            <textarea value={dsarComment} onChange={(e) => setDsarComment(e.target.value)} rows={2} placeholder="Décision / justification..." className="w-full p-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-xs" />
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => void handleProcessDsar(selectedDsar, 'en_traitement')} className="py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-200 font-bold text-[10px] cursor-pointer">
                En traitement
              </button>
              <button type="button" onClick={() => void handleProcessDsar(selectedDsar, 'en_attente_infos')} className="py-2 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-200 font-bold text-[10px] cursor-pointer">
                Attente d’infos
              </button>
              <button
                type="button"
                onClick={() =>
                  void handleProcessDsar(
                    selectedDsar,
                    'traitee',
                    selectedDsar.type === 'suppression_anonymisation' ? 'anonymize' : ''
                  )
                }
                className="py-2 rounded-xl bg-emerald-500 text-black font-black text-[10px] cursor-pointer"
              >
                {selectedDsar.type === 'suppression_anonymisation' ? 'Anonymiser & clôturer' : 'Marquer traitée'}
              </button>
              <button type="button" onClick={() => void handleProcessDsar(selectedDsar, 'refusee')} className="py-2 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-200 font-bold text-[10px] cursor-pointer">
                Refuser (justifié)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Retention Rule */}
      {editingRule && (
        <div className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingRule(null)}>
          <form onSubmit={(e) => void handleSaveRetention(e)} className="w-full max-w-md rounded-2xl bg-[#141418] border border-white/15 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="font-black text-white text-sm">{editingRule.label}</h4>
              <button type="button" onClick={() => setEditingRule(null)} className="text-white/50 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <label className="text-[10px] text-white/55 block">Durée de conservation (jours)</label>
              <input type="number" value={ruleDays} onChange={(e) => setRuleDays(Number(e.target.value))} className="w-full mt-1 px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-mono" />
            </div>
            <label className="flex items-center gap-2 text-xs text-white/80">
              <input type="checkbox" checked={ruleAnonymize} onChange={(e) => setRuleAnonymize(e.target.checked)} className="accent-emerald-500" />
              <span>Anonymiser au lieu de supprimer (statistiques/archives)</span>
            </label>
            <textarea rows={2} value={ruleNote} onChange={(e) => setRuleNote(e.target.value)} className="w-full p-2 rounded-xl bg-black/50 border border-white/15 text-white text-xs" />
            <button type="submit" className="w-full py-2.5 rounded-xl bg-emerald-500 text-black font-black text-xs cursor-pointer">Enregistrer (MFA)</button>
          </form>
        </div>
      )}

      {/* Modal: New Incident */}
      {showNewIncident && (
        <div className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowNewIncident(false)}>
          <form onSubmit={(e) => void handleCreateIncident(e)} className="w-full max-w-md rounded-2xl bg-[#141418] border border-white/15 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="font-black text-white text-sm">Déclarer un incident de confidentialité</h4>
              <button type="button" onClick={() => setShowNewIncident(false)} className="text-white/50 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <select value={incType} onChange={(e) => setIncType(e.target.value as PrivacyIncidentRecord['type'])} className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-xs">
              <option value="acces_non_autorise">Accès non autorisé</option>
              <option value="export_inhabituel">Export inhabituel</option>
              <option value="exposition_document">Exposition accidentelle de document</option>
              <option value="fuite_donnees">Fuite de données</option>
              <option value="erreur_permission">Erreur de permission</option>
              <option value="consultation_anormale">Consultation anormale de compte</option>
              <option value="appareil_perdu_vole">Appareil perdu ou volé</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select value={incSeverity} onChange={(e) => setIncSeverity(e.target.value as PrivacyIncidentSeverity)} className="px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-xs">
                <option value="faible">Faible</option>
                <option value="moyen">Moyen</option>
                <option value="eleve">Élevé</option>
                <option value="critique">Critique</option>
              </select>
              <input type="number" min={1} value={incAffectedCount} onChange={(e) => setIncAffectedCount(Number(e.target.value))} placeholder="Comptes concernés" className="px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-mono text-xs" />
            </div>
            <input required value={incOrigin} onChange={(e) => setIncOrigin(e.target.value)} placeholder="Origine / description..." className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-xs" />
            <textarea required rows={2} value={incMeasures} onChange={(e) => setIncMeasures(e.target.value)} placeholder="Mesures prises..." className="w-full p-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-xs" />
            <button type="submit" className="w-full py-2.5 rounded-xl bg-rose-500 text-white font-black text-xs cursor-pointer">Enregistrer l’incident</button>
          </form>
        </div>
      )}

      {/* Modal: Manage Incident */}
      {selectedIncident && (
        <div className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelectedIncident(null)}>
          <div className="w-full max-w-md rounded-2xl bg-[#141418] border border-white/15 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="font-black text-white text-sm">Incident {selectedIncident.id}</h4>
              <button type="button" onClick={() => setSelectedIncident(null)} className="text-white/50 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <select value={incStatusEdit} onChange={(e) => setIncStatusEdit(e.target.value as PrivacyIncidentStatus)} className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-xs">
              <option value="ouvert">Ouvert</option>
              <option value="investigation">En investigation</option>
              <option value="contenu">Contenu</option>
              <option value="resolu">Résolu</option>
            </select>
            <textarea rows={2} value={incMeasuresEdit} onChange={(e) => setIncMeasuresEdit(e.target.value)} className="w-full p-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-xs" />
            <div className="flex gap-2">
              <button type="button" onClick={() => void handleUpdateIncident(false)} className="flex-1 py-2 rounded-xl bg-white/10 text-white font-bold text-xs cursor-pointer">
                Mettre à jour
              </button>
              {isSuperAdmin && !selectedIncident.artciAssessment.adminValidatedNotification && (
                <button type="button" onClick={() => void handleUpdateIncident(true)} className="flex-1 py-2 rounded-xl bg-amber-500 text-black font-black text-xs cursor-pointer">
                  Valider notif ARTCI (MFA)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Publish Policy */}
      {editingPolicy && (
        <div className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingPolicy(null)}>
          <form onSubmit={(e) => void handlePublishPolicy(e)} className="w-full max-w-md rounded-2xl bg-[#141418] border border-white/15 p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="font-black text-white text-sm">{editingPolicy.title}</h4>
              <button type="button" onClick={() => setEditingPolicy(null)} className="text-white/50 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <input required value={polVersion} onChange={(e) => setPolVersion(e.target.value)} placeholder="Version (ex: 2.2.0)" className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-mono text-xs" />
            <textarea required rows={2} value={polSummary} onChange={(e) => setPolSummary(e.target.value)} className="w-full p-2.5 rounded-xl bg-black/50 border border-white/15 text-white text-xs" />
            <input value={polNotes} onChange={(e) => setPolNotes(e.target.value)} placeholder="Notes de révision..." className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white text-xs" />
            <button type="submit" className="w-full py-2.5 rounded-xl bg-emerald-500 text-black font-black text-xs cursor-pointer">Publier cette version (MFA)</button>
          </form>
        </div>
      )}

      {/* Step-Up MFA Modal */}
      {mfaPrompt && (
        <div className="fixed inset-0 z-[85] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setMfaPrompt(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-[#141418] border border-amber-500/35 p-4 space-y-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h4 className="text-sm font-black text-white">{mfaPrompt.title}</h4>
              </div>
              <button type="button" onClick={() => setMfaPrompt(null)} className="text-white/50 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-white/75">{mfaPrompt.description}</p>
            {mfaPrompt.previewCode && (
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200 font-mono">
                Code de vérification MFA émis : <strong>{mfaPrompt.previewCode}</strong>
              </div>
            )}
            <input
              value={mfaInput}
              onChange={(e) => setMfaInput(e.target.value)}
              placeholder="Saisissez le code à 6 chiffres"
              className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/15 text-white font-mono text-center tracking-widest"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setMfaPrompt(null)} className="flex-1 py-2 rounded-xl bg-white/10 text-white/80 font-bold cursor-pointer">Annuler</button>
              <button
                type="button"
                disabled={mfaSubmitting || !mfaInput.trim()}
                onClick={async () => {
                  setMfaSubmitting(true);
                  try {
                    await mfaPrompt.onVerified(mfaInput.trim());
                    setMfaPrompt(null);
                  } catch (err) {
                    showToast((err as Error)?.message || 'Code MFA invalide');
                  } finally {
                    setMfaSubmitting(false);
                  }
                }}
                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black cursor-pointer disabled:opacity-50"
              >
                {mfaSubmitting ? 'Vérification...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
