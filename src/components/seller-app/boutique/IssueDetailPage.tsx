import React, { useState } from 'react';
import {
  ArrowLeft,
  X,
  Copy,
  Check,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Phone,
  Package,
  Camera,
  Eye,
  User,
  Truck,
  MessageSquare,
  ChevronRight,
  FileText,
  MapPin,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  CheckCheck
} from 'lucide-react';
import { BoutiqueIssue, IssuePriority, IssueStatus, ResolutionAction } from './types';
import { formatFCFA } from '../../../services/marketServices';

interface IssueDetailPageProps {
  issue: BoutiqueIssue;
  copiedRef: string | null;
  onClose: () => void;
  onCopyRef: (e: React.MouseEvent, refText: string) => void;
  onOpenActionModal: (issue: BoutiqueIssue, defaultAction?: ResolutionAction) => void;
  onOpenDiscussion: (phone?: string, name?: string, orderNum?: string, title?: string) => void;
  onContactClient?: (phone?: string, name?: string) => void;
  onSetLightboxPhoto: (photo: { url: string; title: string }) => void;
  formatDateDisplay: (dateStr?: string) => string;
  getTypeInfo: (type: string) => { label: string; color: string };
  getPriorityBadge: (priority: IssuePriority) => { label: string; color: string };
  getStatusBadge: (status: IssueStatus) => { label: string; color: string };
  getLiabilityBadge: (liability?: string) => { label: string; color: string };
}

export const IssueDetailPage: React.FC<IssueDetailPageProps> = ({
  issue,
  copiedRef,
  onClose,
  onCopyRef,
  onOpenActionModal,
  onOpenDiscussion,
  onContactClient,
  onSetLightboxPhoto,
  formatDateDisplay,
  getTypeInfo,
  getPriorityBadge,
  getStatusBadge,
  getLiabilityBadge
}) => {
  return (
    <div
      id="issue-detail-full-page"
      className="fixed inset-0 z-[140] bg-[#0A0A0A] overflow-y-auto flex flex-col animate-in fade-in duration-200"
    >
      {/* 1. TOP STICKY APP-BAR */}
      <header className="sticky top-0 z-40 bg-[#121212]/95 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shadow-2xl">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs border border-white/10 transition active:scale-95 shrink-0"
            title="Revenir aux litiges"
          >
            <ArrowLeft className="w-4 h-4 text-[#FF6321]" />
            <span className="hidden sm:inline">Retour aux litiges</span>
            <span className="sm:hidden">Retour</span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-black text-white truncate">
                Dossier Réclamations #{issue.reference}
              </h1>
              <button
                type="button"
                onClick={(e) => onCopyRef(e, issue.reference)}
                className="px-2 py-0.5 rounded-lg bg-black/60 border border-white/15 text-[10px] font-mono text-[#FF6321] hover:text-white transition flex items-center gap-1 shrink-0"
                title="Copier la référence du dossier"
              >
                <span>{issue.reference}</span>
                {copiedRef === issue.reference ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 text-white/50" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-white/50 truncate">
              Signalé le {formatDateDisplay(issue.createdAt)} • {issue.title}
            </p>
          </div>
        </div>

        {/* Badges & Close action */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`hidden md:inline-flex px-2.5 py-1 rounded-xl text-[10px] font-black border ${getPriorityBadge(issue.priority).color}`}>
            {getPriorityBadge(issue.priority).label}
          </span>
          <span className={`hidden sm:inline-flex px-2.5 py-1 rounded-xl text-[10px] font-black border ${getStatusBadge(issue.status).color}`}>
            {getStatusBadge(issue.status).label}
          </span>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 2. SCROLLABLE BODY */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-3 sm:px-6 py-5 sm:py-7 space-y-6">
        
        {/* HERO INCIDENT BANNER */}
        <section className="relative p-5 sm:p-7 rounded-3xl bg-gradient-to-br from-rose-950/35 via-[#151213] to-black border border-rose-500/30 shadow-2xl overflow-hidden space-y-5">
          <div className="absolute top-0 right-0 w-80 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${getTypeInfo(issue.type).color}`}>
                  {getTypeInfo(issue.type).label}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${getPriorityBadge(issue.priority).color}`}>
                  {getPriorityBadge(issue.priority).label}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${getStatusBadge(issue.status).color}`}>
                  {getStatusBadge(issue.status).label}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getLiabilityBadge(issue.liability).color}`}>
                  {getLiabilityBadge(issue.liability).label}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {issue.title}
              </h2>

              <p className="text-xs sm:text-sm text-white/70 max-w-2xl leading-relaxed">
                Incident enregistré sous le dossier <b className="font-mono text-white">#{issue.reference}</b>
                {issue.orderNumber ? ` associé à la commande boutique #${issue.orderNumber}` : ''}.
              </p>
            </div>

            {/* Financial Stake Card */}
            {issue.financialImpact > 0 && (
              <div className="p-4 rounded-2xl bg-black/60 border border-rose-500/30 text-center sm:text-right shrink-0">
                <span className="text-[10px] text-white/50 block font-bold uppercase tracking-wider">
                  Montant en jeu
                </span>
                <span className="text-xl sm:text-2xl font-black text-[#FF6321] font-mono block mt-0.5">
                  {formatFCFA(issue.financialImpact)}
                </span>
                <span className="text-[10px] text-emerald-400 font-bold block mt-1">
                  🛡️ Garantie Djassa Active
                </span>
              </div>
            )}
          </div>

          {/* Stepper Resolution Timeline */}
          <div className="pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs relative z-10">
            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Étape 1 : Constat</span>
              </span>
              <p className="text-[11px] text-white/80 font-medium">Signalement reçu</p>
              <span className="text-[9px] text-white/40 block">Horodaté sur Djassa</span>
            </div>

            <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Étape 2 : Justificatif</span>
              </span>
              <p className="text-[11px] text-white/80 font-medium">Photo & déclarations</p>
              <span className="text-[9px] text-white/40 block">Dossier complété</span>
            </div>

            <div className={`p-3 rounded-2xl border space-y-1 ${
              issue.liability ? 'bg-white/[0.03] border-white/10' : 'bg-amber-500/10 border-amber-500/30'
            }`}>
              <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Étape 3 : Responsabilité</span>
              </span>
              <p className="text-[11px] text-white font-medium truncate">
                {issue.liability ? getLiabilityBadge(issue.liability).label.replace('Responsable : ', '') : 'En arbitrage'}
              </p>
              <span className="text-[9px] text-white/40 block">Règlement amiable</span>
            </div>

            <div className={`p-3 rounded-2xl border space-y-1 ${
              issue.status === 'resolved' || issue.status === 'refunded'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-white/[0.02] border-white/5 opacity-70'
            }`}>
              <span className="text-[10px] font-bold flex items-center gap-1">
                {issue.status === 'resolved' || issue.status === 'refunded' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-white/40" />
                )}
                <span>Étape 4 : Dédommagement</span>
              </span>
              <p className="text-[11px] font-medium">
                {issue.status === 'resolved' || issue.status === 'refunded' ? 'Dossier clôturé' : 'Action requise'}
              </p>
              <span className="text-[9px] opacity-60 block">Remboursement / Échange</span>
            </div>
          </div>
        </section>

        {/* PRODUCT & ORDER CONTEXT CARD */}
        <section className="p-5 sm:p-6 rounded-3xl bg-[#141414] border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-[#FF6321]" />
              <span>Article & Commande Concernés</span>
            </h3>
            {issue.orderNumber && (
              <span className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-white/80">
                Commande #{issue.orderNumber}
              </span>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex flex-col sm:flex-row items-center sm:items-start gap-4">
            {issue.productImage ? (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-white/15 bg-neutral-900 shrink-0">
                <img 
                  src={issue.productImage} 
                  alt={issue.productTitle || 'Produit'} 
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30 shrink-0">
                <Package className="w-8 h-8" />
              </div>
            )}

            <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h4 className="text-base font-black text-white">
                  {issue.productTitle || issue.title}
                </h4>
                {issue.stockRemaining !== undefined && (
                  <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-bold">
                    Stock boutique : {issue.stockRemaining} restant(s)
                  </span>
                )}
              </div>

              <p className="text-xs text-white/60 leading-relaxed">
                Article réclamé ou faisant l'objet d'un retour au magasin du Forum des Marchés d'Adjamé.
              </p>

              <div className="flex items-center justify-center sm:justify-start gap-3 pt-1 text-xs text-white/50 flex-wrap">
                {issue.financialImpact > 0 && (
                  <span>Montant de l'article : <b className="text-[#FF6321]">{formatFCFA(issue.financialImpact)}</b></span>
                )}
                <span>•</span>
                <span>Adjamé Forum</span>
                <span>•</span>
                <span className="text-emerald-400 font-medium">✓ Emballage d'origine</span>
              </div>
            </div>
          </div>
        </section>

        {/* STATEMENT OF FACTS & PHOTO EVIDENCE */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Detailed Statement */}
          <div className="p-5 sm:p-6 rounded-3xl bg-[#141414] border border-white/10 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-rose-400">
                <FileText className="w-4 h-4" />
                <h3 className="text-sm font-black text-white">Explication & Motif Signalé</h3>
              </div>

              <p className="text-xs text-white/50">
                Description exacte transmise lors de l'enregistrement de l'incident :
              </p>

              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 italic text-white/90 text-xs sm:text-sm leading-relaxed">
                "{issue.description}"
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-black/40 border border-white/5 text-[11px] text-white/50 space-y-1">
              <div className="flex items-center justify-between">
                <span>Date de déclaration :</span>
                <b className="text-white">{formatDateDisplay(issue.createdAt)}</b>
              </div>
              <div className="flex items-center justify-between">
                <span>Attribution responsabilité :</span>
                <b className="text-[#FF6321]">{getLiabilityBadge(issue.liability).label}</b>
              </div>
            </div>
          </div>

          {/* Photo Evidence with Lightbox */}
          <div className="p-5 sm:p-6 rounded-3xl bg-[#141414] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#FF6321]">
                <Camera className="w-4 h-4" />
                <h3 className="text-sm font-black text-white">Preuve Photographique</h3>
              </div>
              <span className="text-[10px] text-white/50">Cliquer pour agrandir</span>
            </div>

            {(issue.photoProof || issue.productImage) ? (
              <div 
                onClick={() => {
                  const url = issue.photoProof || issue.productImage;
                  if (url) {
                    onSetLightboxPhoto({ url, title: issue.title });
                  }
                }}
                className="relative w-full h-48 sm:h-52 rounded-2xl bg-neutral-900 border border-white/15 overflow-hidden cursor-pointer group shadow-inner"
              >
                <img 
                  src={issue.photoProof || issue.productImage} 
                  alt={issue.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex items-end justify-between p-3.5">
                  <span className="px-2.5 py-1 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 text-[11px] text-white font-bold flex items-center gap-1.5 shadow-lg">
                    <Eye className="w-3.5 h-3.5 text-[#FF6321]" />
                    <span>{issue.photoProof ? 'Photo preuve de dégâts' : 'Photo de l\'article'}</span>
                  </span>

                  <span className="px-2 py-0.5 rounded-lg bg-[#FF6321]/20 border border-[#FF6321]/40 text-[#FF6321] text-[10px] font-bold">
                    Agrandir
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-full h-48 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col items-center justify-center text-center p-4 space-y-2">
                <Camera className="w-8 h-8 text-white/20" />
                <p className="text-xs text-white/50">Aucune preuve photo supplémentaire requise.</p>
              </div>
            )}
          </div>
        </section>

        {/* INVOLVED PARTIES (CLIENT & BOUTIQUE DELIVERY) */}
        <section className="p-5 sm:p-6 rounded-3xl bg-[#141414] border border-white/10 space-y-4">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <User className="w-4 h-4 text-[#FF6321]" />
            <span>Intervenants & Contacts Directs</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Client Card */}
            {issue.clientName ? (
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden border border-cyan-400/40 bg-cyan-950/60 flex items-center justify-center font-bold text-sm text-cyan-300 shrink-0">
                    {issue.clientAvatar ? (
                      <img src={issue.clientAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      issue.clientName.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-cyan-400 uppercase font-black tracking-wider block">
                      Client Acheteur
                    </span>
                    <h4 className="text-sm font-black text-white truncate">{issue.clientName}</h4>
                    <p className="text-xs text-white/50 flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 text-[#FF6321]" />
                      <span>{issue.clientCommune || 'Abidjan'}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => onOpenDiscussion(issue.clientPhone, issue.clientName, issue.orderNumber, issue.title)}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#FF6321]/15 hover:bg-[#FF6321]/25 text-[#FF6321] border border-[#FF6321]/30 transition flex items-center justify-center gap-1.5 text-xs font-bold active:scale-95 shadow"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Discussion Djassa</span>
                  </button>

                  {issue.clientPhone && (
                    <button
                      type="button"
                      onClick={() => onContactClient?.(issue.clientPhone, issue.clientName)}
                      className="py-2 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 transition flex items-center gap-1.5 text-xs font-bold shrink-0 active:scale-95"
                      title="Appeler le client"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Appeler</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-black/20 border border-white/5 text-center text-xs text-white/40 flex items-center justify-center">
                Aucun client directement associé à cet incident
              </div>
            )}

            {/* Seller-Managed Delivery Info Card */}
            <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-[#FF6321]">
                <Truck className="w-4 h-4" />
                <span className="text-[10px] uppercase font-black tracking-wider">
                  Livraison gérée par la boutique
                </span>
              </div>
              <p className="text-xs text-white/70 leading-relaxed">
                La livraison est organisée directement par votre boutique à l&apos;extérieur de DJASSA. Contactez directement le client pour convenir de l&apos;échange ou de la résolution.
              </p>
            </div>
          </div>
        </section>

        {/* RESOLUTION WORKFLOW OPTIONS */}
        <section className="p-5 sm:p-6 rounded-3xl bg-[#141414] border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Statut & Clôture du Litige</span>
            </h3>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${getStatusBadge(issue.status).color}`}>
              {getStatusBadge(issue.status).label}
            </span>
          </div>

          {issue.status === 'resolved' || issue.status === 'refunded' ? (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-2">
              <div className="flex items-center gap-2 font-black text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  Litige résolu avec succès : {
                    issue.resolutionAction === 'refunded'
                      ? 'Client intégralement remboursé par Wave / Orange Money'
                      : issue.resolutionAction === 'exchanged'
                      ? 'Nouvel article expédié en remplacement'
                      : issue.resolutionAction === 'restocked'
                      ? 'Colis réintégré dans le stock physique du magasin'
                      : issue.resolutionAction === 'djassa_guarantee_claimed'
                      ? 'Indemnisation versée par le Fonds de Garantie Djassa'
                      : 'Dossier vérifié et clôturé d\'un commun accord'
                  }
                </span>
              </div>

              {issue.resolutionNotes && (
                <p className="text-xs text-white/80 italic pl-7 leading-relaxed">
                  "{issue.resolutionNotes}"
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-white/60">
                Sélectionnez la solution appropriée pour clore ce litige et régulariser vos comptes :
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {/* Option 1: Rembourser */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenActionModal(issue, 'refunded');
                  }}
                  className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-rose-500/15 border border-white/10 hover:border-rose-500/40 text-left transition flex flex-col justify-between group active:scale-95"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-rose-400 transition">
                      💰 Rembourser le client
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-white/30 group-hover:text-rose-400 transition" />
                  </div>
                  <span className="text-[10px] text-white/50 mt-2 block">
                    Versement direct Wave / OM {issue.financialImpact ? `(${formatFCFA(issue.financialImpact)})` : ''}
                  </span>
                </button>

                {/* Option 2: Échanger */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenActionModal(issue, 'exchanged');
                  }}
                  className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-blue-500/15 border border-white/10 hover:border-blue-500/40 text-left transition flex flex-col justify-between group active:scale-95"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-blue-400 transition">
                      🔄 Remplacer l'article
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-white/30 group-hover:text-blue-400 transition" />
                  </div>
                  <span className="text-[10px] text-white/50 mt-2 block">
                    Expédier une nouvelle pièce sans frais
                  </span>
                </button>

                {/* Option 3: Réintégrer au stock */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenActionModal(issue, 'restocked');
                  }}
                  className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-purple-500/15 border border-white/10 hover:border-purple-500/40 text-left transition flex flex-col justify-between group active:scale-95"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-purple-400 transition">
                      📦 Réintégrer au stock
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-white/30 group-hover:text-purple-400 transition" />
                  </div>
                  <span className="text-[10px] text-white/50 mt-2 block">
                    Colis retourné en bon état (+1 en magasin)
                  </span>
                </button>

                {/* Option 4: Garantie Djassa */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenActionModal(issue, 'djassa_guarantee_claimed');
                  }}
                  className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/40 text-left transition flex flex-col justify-between group active:scale-95"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition">
                      🛡️ Garantie Djassa
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-white/30 group-hover:text-emerald-400 transition" />
                  </div>
                  <span className="text-[10px] text-white/50 mt-2 block">
                    Incident de transport ou perte prise en charge
                  </span>
                </button>

                {/* Option 5: Clôturer sans frais */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenActionModal(issue, 'closed');
                  }}
                  className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-amber-500/15 border border-white/10 hover:border-amber-500/40 text-left transition flex flex-col justify-between group active:scale-95"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-amber-400 transition">
                      ✅ Clôturer sans frais
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-white/30 group-hover:text-amber-400 transition" />
                  </div>
                  <span className="text-[10px] text-white/50 mt-2 block">
                    Accord amiable ou fausse alerte réglée
                  </span>
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* 3. BOTTOM STICKY ACTION BAR */}
      <footer className="sticky bottom-0 z-40 bg-[#121212]/95 backdrop-blur-xl border-t border-white/10 px-4 sm:px-6 py-3.5 shadow-2xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 hidden sm:block">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-white">Dossier #{issue.reference}</span>
              <span className="text-[10px] text-white/50 hidden sm:inline">• {getTypeInfo(issue.type).label}</span>
            </div>
            {issue.financialImpact > 0 && (
              <span className="text-[11px] font-bold text-[#FF6321] font-mono">
                Impact : {formatFCFA(issue.financialImpact)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-bold transition active:scale-95"
          >
            Fermer
          </button>

          {issue.status !== 'resolved' && issue.status !== 'refunded' && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenActionModal(issue);
              }}
              className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-rose-600 to-[#FF6321] hover:brightness-110 text-white font-black text-xs transition flex items-center gap-2 shadow-xl shadow-rose-950/50 active:scale-95"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Résoudre ce litige</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
