import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';

export interface PendingConfirmation {
  title: string;
  description: string;
  targetLabel?: string;
  confirmLabel: string;
  tone?: 'danger' | 'warning' | 'primary';
  requireReason?: boolean;
  defaultReason?: string;
  reasonPlaceholder?: string;
  onConfirm: (reason: string) => Promise<void> | void;
}

interface SecurityConfirmModalProps {
  pending: PendingConfirmation | null;
  onClose: () => void;
}

export const SecurityConfirmModal: React.FC<SecurityConfirmModalProps> = ({ pending, onClose }) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pending) {
      setReason(pending.defaultReason || '');
      setError(null);
      setSubmitting(false);
    }
  }, [pending]);

  if (!pending) return null;

  const tone = pending.tone || 'danger';
  const confirmButtonClass =
    tone === 'danger'
      ? 'bg-rose-600 hover:bg-rose-500 text-white'
      : tone === 'warning'
      ? 'bg-amber-500 hover:bg-amber-400 text-black'
      : 'bg-emerald-500 hover:bg-emerald-400 text-black';

  const handleConfirm = async () => {
    if (pending.requireReason && !reason.trim()) {
      setError('Veuillez saisir un motif pour la traçabilité du journal d’audit.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await pending.onConfirm(reason.trim());
      onClose();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Erreur lors de l’exécution de l’action.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-[#141417] border border-white/15 p-4 space-y-3.5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                tone === 'danger'
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  : tone === 'warning'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {tone === 'primary' ? <ShieldCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            </div>
            <div>
              <h4 className="text-sm font-bold text-white leading-tight">{pending.title}</h4>
              {pending.targetLabel && (
                <p className="text-[11px] font-mono text-white/60 mt-0.5 break-all">{pending.targetLabel}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[36px] min-h-[36px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-white/75 leading-relaxed">{pending.description}</p>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-white/65 block">
            Motif / Note d’audit {pending.requireReason ? '(obligatoire)' : '(recommandé)'}
          </label>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={pending.reasonPlaceholder || 'Précisez la raison de cette intervention de sécurité...'}
            className="w-full rounded-xl bg-black/50 border border-white/10 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-purple-400 resize-none"
          />
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-[11px] text-rose-300">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white/80 cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleConfirm}
            className={`flex-1 min-h-[44px] rounded-xl text-xs font-black transition cursor-pointer disabled:opacity-50 ${confirmButtonClass}`}
          >
            {submitting ? 'Traitement...' : pending.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
