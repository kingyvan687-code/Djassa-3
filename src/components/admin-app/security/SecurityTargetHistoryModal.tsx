import React, { useEffect, useState } from 'react';
import {
  History,
  X,
  ShieldAlert,
  LogIn,
  AlertTriangle,
  FileCheck2,
  User,
  Wallet,
  ShieldCheck,
  ShieldOff,
  ClipboardList
} from 'lucide-react';
import { formatFCFA } from '../../../services/marketServices';
import { securityService } from '../../../services/securityService';
import type {
  ActorSummaryInfo,
  FinanceLedgerEntry,
  ProtectedAuditEntry,
  SecurityAlert,
  SecurityIncidentRecord,
  SecurityIntrusionEvent,
  SecurityLoginLog
} from '../../../types/security';

interface SecurityTargetHistoryModalProps {
  target: string | null;
  actorId: string;
  onClose: () => void;
}

export const SecurityTargetHistoryModal: React.FC<SecurityTargetHistoryModalProps> = ({
  target,
  actorId,
  onClose
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    actorSummary: ActorSummaryInfo | null;
    logins: SecurityLoginLog[];
    intrusions: SecurityIntrusionEvent[];
    alerts: SecurityAlert[];
    incidents: SecurityIncidentRecord[];
    finance: FinanceLedgerEntry[];
    audit: ProtectedAuditEntry[];
  }>({
    actorSummary: null,
    logins: [],
    intrusions: [],
    alerts: [],
    incidents: [],
    finance: [],
    audit: []
  });

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    securityService
      .getTargetHistory(target, actorId)
      .then((res) => {
        if (!cancelled) {
          setData({
            actorSummary: res.actorSummary || null,
            logins: res.logins || [],
            intrusions: res.intrusions || [],
            alerts: res.alerts || [],
            incidents: res.incidents || [],
            finance: res.finance || [],
            audit: res.audit || []
          });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError((err as Error)?.message || 'Impossible de charger l’historique.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [target, actorId]);

  if (!target) return null;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

  const summary = data.actorSummary;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[88dvh] rounded-t-3xl sm:rounded-2xl bg-[#141417] border border-white/15 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <History className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-white truncate">Dossier & historique du compte</h4>
              <p className="text-[11px] font-mono text-white/55 truncate">{target}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {loading && <p className="text-white/50 text-center py-6">Chargement du dossier et de l’historique...</p>}
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300">{error}</div>
          )}

          {!loading && !error && (
            <>
              {summary && (
                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{summary.name}</p>
                        <p className="text-[11px] font-mono text-white/55 truncate">{summary.accountLabel}</p>
                      </div>
                    </div>

                    {summary.isSuspended ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-[10px] font-bold text-rose-300 shrink-0">
                        <ShieldOff className="w-3 h-3" />
                        Suspendu
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-300 shrink-0">
                        <ShieldCheck className="w-3 h-3" />
                        Actif
                      </span>
                    )}
                  </div>

                  {summary.isSuspended && summary.suspensionReason && (
                    <p className="text-[11px] text-rose-300 bg-rose-500/10 rounded-xl px-2.5 py-1.5 border border-rose-500/20">
                      Motif : {summary.suspensionReason}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-white/10">
                    <div>
                      <span className="text-white/45 block">Rôle & espace</span>
                      <span className="text-white font-semibold">
                        {summary.role} · {summary.space}
                      </span>
                    </div>
                    <div>
                      <span className="text-white/45 block">Solde serveur</span>
                      <span className="text-emerald-300 font-bold font-mono tabular-nums">
                        {summary.serverBalanceFcfa !== null ? formatFCFA(summary.serverBalanceFcfa) : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-white/45 block">Activités / Échecs / Critiques</span>
                      <span className="text-white font-mono tabular-nums">
                        {summary.totalEvents} ·{' '}
                        <span className="text-amber-300">{summary.failedOrBlockedEvents}</span> ·{' '}
                        <span className="text-rose-400">{summary.criticalEvents}</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-white/45 block">Dernier appareil & IP</span>
                      <span className="text-white/80 font-mono truncate block">
                        {summary.lastIp || '—'}
                      </span>
                      <span className="text-[10px] text-white/50 truncate block">
                        {[summary.lastDevice, summary.lastOs, summary.lastBrowser].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Intrusions ({data.intrusions.length})</span>
                </p>
                {data.intrusions.length === 0 ? (
                  <p className="text-[11px] text-white/40 bg-white/[0.03] rounded-xl p-2.5">Aucune intrusion enregistrée.</p>
                ) : (
                  data.intrusions.map((item) => (
                    <div key={item.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white">{item.threatLabel}</span>
                        <span className="text-[10px] font-mono text-white/45">{formatDate(item.timestamp)}</span>
                      </div>
                      <p className="text-[11px] text-white/65">{item.details}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Alertes ({data.alerts.length})</span>
                </p>
                {data.alerts.length === 0 ? (
                  <p className="text-[11px] text-white/40 bg-white/[0.03] rounded-xl p-2.5">Aucune alerte liée.</p>
                ) : (
                  data.alerts.map((al) => (
                    <div key={al.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white">{al.title}</span>
                        <span className="text-[10px] text-white/50">{al.status}</span>
                      </div>
                      <p className="text-[11px] text-white/65">{al.description}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>Incidents & suspensions ({data.incidents.length})</span>
                </p>
                {data.incidents.length === 0 ? (
                  <p className="text-[11px] text-white/40 bg-white/[0.03] rounded-xl p-2.5">Aucun incident lié.</p>
                ) : (
                  data.incidents.map((inc) => (
                    <div key={inc.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white">{inc.summary}</span>
                        <span className="text-[10px] font-mono text-white/45">{formatDate(inc.createdAt)}</span>
                      </div>
                      <p className="text-[10px] text-white/55">
                        {inc.type} · Statut: {inc.status} · Gravité: {inc.severity}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Opérations financières ({data.finance.length})</span>
                </p>
                {data.finance.length === 0 ? (
                  <p className="text-[11px] text-white/40 bg-white/[0.03] rounded-xl p-2.5">Aucune opération financière liée.</p>
                ) : (
                  data.finance.map((fin) => (
                    <div key={fin.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white">
                          {fin.type.toUpperCase()} · {formatFCFA(fin.amountFcfa)}
                        </span>
                        <span className="text-[10px] font-mono text-white/45">{formatDate(fin.createdAt)}</span>
                      </div>
                      <p className="text-[10px] text-white/60">
                        Réf: {fin.reference} · {fin.channel} · Statut: {fin.status}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Connexions récentes ({data.logins.length})</span>
                </p>
                {data.logins.length === 0 ? (
                  <p className="text-[11px] text-white/40 bg-white/[0.03] rounded-xl p-2.5">Aucune connexion correspondante.</p>
                ) : (
                  data.logins.map((l) => (
                    <div key={l.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">{l.accountEmail} · {l.status}</p>
                        <p className="text-[10px] text-white/50">{l.device} • {l.browser} / {l.os}</p>
                      </div>
                      <span className="text-[10px] font-mono text-white/45 shrink-0">{formatDate(l.timestamp)}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>Actions d’audit ({data.audit.length})</span>
                </p>
                {data.audit.length === 0 ? (
                  <p className="text-[11px] text-white/40 bg-white/[0.03] rounded-xl p-2.5">Aucune action enregistrée.</p>
                ) : (
                  data.audit.map((aud) => (
                    <div key={aud.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white">{aud.action}</span>
                        <span className="text-[10px] font-mono text-white/45">{formatDate(aud.timestamp)}</span>
                      </div>
                      <p className="text-[11px] text-white/60">Par {aud.actorName} — {aud.details}</p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
