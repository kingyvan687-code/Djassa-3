import React, { useState } from 'react';
import { X, Wallet, ArrowDownToLine, CheckCircle2, ShieldCheck, Phone, AlertCircle, Clock } from 'lucide-react';
import { formatFCFA } from '../../../services/marketServices';
import { securityService } from '../../../services/securityService';
import { commerceService } from '../../../services/commerceService';
import { useApp } from '../../../context/AppContext';
import { SellerTransaction } from './types';

interface Props {
  balance: number;
  onClose: () => void;
  onSuccess: (transaction: SellerTransaction) => void;
  sellerPhone?: string;
  sellerName?: string;
}

export type PaymentProviderType = 'wave' | 'orange_money';

interface ProviderConfig {
  id: PaymentProviderType;
  name: string;
  category: 'mobile_money';
  shortDesc: string;
  badgeColor: string;
  iconBg: string;
  textColor: string;
  borderColor: string;
  prefixHelper?: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'wave',
    name: 'Wave CI',
    category: 'mobile_money',
    shortDesc: 'Virement direct • Instantané',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    iconBg: 'bg-cyan-500 text-black',
    textColor: 'text-cyan-400',
    borderColor: 'border-cyan-500/60 bg-cyan-500/10',
    prefixHelper: 'Numéro Wave (+225)',
  },
  {
    id: 'orange_money',
    name: 'Orange Money',
    category: 'mobile_money',
    shortDesc: '#144# • Reversement direct',
    badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    iconBg: 'bg-[#FF7900] text-white',
    textColor: 'text-orange-400',
    borderColor: 'border-orange-500/60 bg-orange-500/10',
    prefixHelper: 'Numéro Orange Money (+225)',
  },
];

export const WithdrawEarningsModal: React.FC<Props> = ({
  balance,
  onClose,
  onSuccess,
  sellerPhone = '',
  sellerName = '',
}) => {
  const { currentSellerId } = useApp();
  const [amount, setAmount] = useState('');
  const [provider, setProvider] = useState<PaymentProviderType>('wave');
  const [phone, setPhone] = useState(sellerPhone || '07 48 99 12 34');

  const [error, setError] = useState<string | null>(null);
  const [holdNotice, setHoldNotice] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successTx, setSuccessTx] = useState<SellerTransaction | null>(null);

  const selectedProviderConfig = PROVIDERS.find((p) => p.id === provider) || PROVIDERS[0];
  const quickAmounts = [10000, 25000, 50000, 100000].filter((a) => a <= balance);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setHoldNotice(null);
    const numAmount = Number(amount);

    const maskedTarget = `${selectedProviderConfig.name} • ***${phone.slice(-4)}`;

    if (!numAmount || numAmount <= 0) {
      void securityService.recordActivity({
        category: 'wallets',
        action: 'Tentative de retrait vendeur invalide',
        actionType: 'seller_withdrawal_request',
        target: currentSellerId,
        targetType: 'finance',
        entityType: 'wallet',
        entityId: currentSellerId,
        space: 'seller',
        actorId: currentSellerId,
        actorName: sellerName || 'Vendeur DJASSA',
        result: 'refuse',
        severity: 'faible',
        reason: 'Montant saisi invalide'
      });
      setError('Veuillez saisir un montant de retrait valide.');
      return;
    }
    if (numAmount < 1000) {
      setError('Le montant minimum de retrait est de 1 000 FCFA.');
      return;
    }
    if (numAmount > balance) {
      void securityService.recordActivity({
        category: 'wallets',
        action: 'Demande de retrait vendeur refusée (solde insuffisant)',
        actionType: 'seller_withdrawal_request',
        target: currentSellerId,
        targetType: 'finance',
        entityType: 'wallet',
        entityId: currentSellerId,
        space: 'seller',
        actorId: currentSellerId,
        actorName: sellerName || 'Vendeur DJASSA',
        result: 'refuse',
        severity: 'moyen',
        reason: `Solde disponible (${balance} FCFA) inférieur au montant demandé (${numAmount} FCFA)`
      });
      setError(`Solde insuffisant. Vous disposez de ${formatFCFA(balance)}.`);
      return;
    }

    if (!phone.trim() || phone.replace(/\D/g, '').length < 8) {
      setError('Veuillez renseigner un numéro de téléphone mobile money ivoirien valide.');
      return;
    }

    setIsProcessing(true);

    try {
      const channel = selectedProviderConfig.name;
      const payoutTarget = phone;
      const serverCheck = await commerceService.requestWithdrawal({
        amountFcfa: numAmount,
        channel,
        payoutTarget
      });

      const refCode = serverCheck.withdrawal?.id || `VIR-${Date.now().toString().slice(-6)}`;
      const isHeld = serverCheck.withdrawal?.status !== 'completed';
      if (isHeld) {
        setHoldNotice('Demande de retrait enregistrée en attente de validation bancaire/opérateur côté serveur.');
      }

      const newBalance = typeof serverCheck.newBalanceFcfa === 'number'
        ? serverCheck.newBalanceFcfa
        : Math.max(0, balance - numAmount);

      void securityService.recordActivity({
        category: 'wallets',
        action: isHeld ? 'Demande de retrait vendeur enregistrée' : 'Retrait vendeur validé',
        actionType: 'seller_withdrawal',
        target: refCode,
        targetType: 'finance',
        entityType: 'withdrawal',
        entityId: refCode,
        space: 'seller',
        actorId: currentSellerId,
        actorName: sellerName || 'Vendeur DJASSA',
        result: 'reussi',
        severity: isHeld ? 'eleve' : 'moyen',
        beforeValue: `${balance.toLocaleString('fr-FR')} FCFA`,
        afterValue: `${newBalance.toLocaleString('fr-FR')} FCFA`,
        details: `Canal ${maskedTarget} — Réf ${refCode}`,
        financialTrace: {
          operationType: 'Retrait vendeur',
          transactionId: refCode,
          initiatorName: sellerName || 'Vendeur DJASSA',
          initiatorId: currentSellerId,
          beneficiaryAccount: maskedTarget,
          amountFcfa: numAmount,
          feesFcfa: Number(serverCheck.withdrawal?.feeFcfa || 0),
          commissionFcfa: 0,
          previousBalanceFcfa: balance,
          newBalanceFcfa: newBalance,
          status: isHeld ? 'En attente de versement opérateur' : 'Validé',
          timestamp: new Date().toISOString(),
          validationResult: 'Validé serveur',
          channel
        }
      });

      const newTx: SellerTransaction = {
        id: serverCheck.withdrawal?.id || `wt-${Date.now()}`,
        type: 'withdrawal',
        amount: numAmount,
        description: `Retrait vers ${selectedProviderConfig.name} (${phone})`,
        date: 'À l\'instant',
        status: isHeld ? 'pending' : 'completed',
        provider,
        phone,
        reference: refCode,
        grossAmount: numAmount,
        platformFee: Number(serverCheck.withdrawal?.feeFcfa || 0),
        netAmount: Number(serverCheck.withdrawal?.netFcfa || numAmount),
      };

      setSuccessTx(newTx);
      onSuccess(newTx);
    } catch (err: unknown) {
      const reasonMsg = (err as Error)?.message || 'Opération bloquée par le contrôle financier de sécurité.';
      void securityService.recordActivity({
        category: 'wallets',
        action: 'Retrait vendeur bloqué par le contrôle financier',
        actionType: 'seller_withdrawal_blocked',
        target: currentSellerId,
        targetType: 'finance',
        entityType: 'withdrawal',
        entityId: currentSellerId,
        space: 'seller',
        actorId: currentSellerId,
        actorName: sellerName || 'Vendeur DJASSA',
        result: 'bloque',
        severity: 'eleve',
        reason: reasonMsg,
        details: `Tentative de retrait de ${numAmount.toLocaleString('fr-FR')} FCFA vers ${maskedTarget}`,
        financialTrace: {
          operationType: 'Tentative retrait vendeur',
          transactionId: `BLK-${Date.now().toString().slice(-6)}`,
          initiatorName: sellerName || 'Vendeur DJASSA',
          initiatorId: currentSellerId,
          beneficiaryAccount: maskedTarget,
          amountFcfa: numAmount,
          feesFcfa: 0,
          commissionFcfa: 0,
          previousBalanceFcfa: balance,
          newBalanceFcfa: balance,
          status: 'Bloqué sécurité',
          timestamp: new Date().toISOString(),
          validationResult: reasonMsg,
          channel: selectedProviderConfig.name
        }
      });
      setError(reasonMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="withdraw-earnings-modal-backdrop"
      className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        id="withdraw-earnings-modal"
        className="w-full max-w-lg bg-[#121212] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Retrait des Sommes Gagnées</h3>
              <p className="text-[11px] text-white/50">Reversement direct vers Wave CI ou Orange Money</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success or Hold screen */}
        {successTx ? (
          <div className="py-4 text-center space-y-4">
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center shadow-lg border ${
              holdNotice
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-amber-500/20'
                : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-emerald-500/20'
            }`}>
              {holdNotice ? <Clock className="w-9 h-9" /> : <CheckCircle2 className="w-9 h-9" />}
            </div>
            <div>
              <h4 className="text-lg font-black text-white">
                {holdNotice ? 'Retrait mis en vérification de sécurité' : 'Virement Confirmé & Enregistré'}
              </h4>
              <p className="text-xs text-white/60 mt-1 max-w-xs mx-auto">
                {holdNotice
                  ? holdNotice
                  : 'La somme a été validée côté serveur et enregistrée dans votre historique de caisse.'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-left space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-white/50">Somme retirée :</span>
                <b className="text-emerald-400 text-sm font-black">{formatFCFA(successTx.amount)}</b>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/50">Moyen de paiement :</span>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${selectedProviderConfig.badgeColor}`}>
                  {selectedProviderConfig.name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/50">Bénéficiaire :</span>
                <span className="text-white font-medium">
                  {successTx.phone}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/50">Référence unique :</span>
                <span className="font-mono text-white/80 font-bold">{successTx.reference}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-white/10">
                <span className="text-white/50">Nouveau solde disponible :</span>
                <b className="text-white font-black">{formatFCFA(Math.max(0, balance - successTx.amount))}</b>
              </div>
            </div>

            <button
              id="btn-close-withdraw-success"
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl bg-[#FF6321] hover:bg-[#ff753b] text-white text-xs font-black transition active:scale-95 shadow-xl shadow-[#FF6321]/20"
            >
              Fermer et Consulter les Revenus
            </button>
          </div>
        ) : (
          /* Withdrawal Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Balance Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-[#131d18] to-transparent border border-emerald-500/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block">
                  Argent disponible à retirer
                </span>
                <p className="text-2xl font-black text-emerald-400 mt-0.5">{formatFCFA(balance)}</p>
              </div>
              <div className="text-right text-[10px] text-white/60">
                <span className="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                  <ShieldCheck className="w-3.5 h-3.5" /> 0 FCFA de frais
                </span>
                <p className="mt-1">Délai : Immédiat ⚡</p>
              </div>
            </div>

            {/* Provider Selector */}
            <div>
              <label className="text-xs font-bold text-white/90 block mb-2">
                Sélectionnez le moyen de paiement pour recevoir l'argent
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PROVIDERS.map((p) => {
                  const isSelected = provider === p.id;
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setProvider(p.id)}
                      className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? `${p.borderColor} ring-1 ring-white/40 shadow-lg`
                          : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-black text-white">{p.name}</span>
                        {isSelected && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                      </div>
                      <span className="text-[9px] text-white/50 leading-tight">
                        {p.shortDesc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-white/90">Montant à retirer (FCFA)</label>
                <button
                  type="button"
                  onClick={() => setAmount(String(balance))}
                  className="text-[11px] text-[#FF6321] font-bold hover:underline"
                >
                  Tout retirer ({formatFCFA(balance)})
                </button>
              </div>
              <div className="relative">
                <input
                  id="input-withdraw-amount"
                  type="number"
                  min={1000}
                  max={balance}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Ex : 50 000"
                  className="w-full p-3.5 pr-14 rounded-2xl bg-white/5 border border-white/10 text-base font-black text-white placeholder:text-white/20 focus:outline-none focus:border-[#FF6321] transition"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-white/40">
                  FCFA
                </span>
              </div>

              {/* Quick Amount Pills */}
              {quickAmounts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {quickAmounts.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setAmount(String(q))}
                      className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-[10px] font-bold text-white/80 transition"
                    >
                      +{formatFCFA(q)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Recipient Details */}
            <div>
              <label className="text-xs font-bold text-white/90 block mb-1.5">
                Numéro de téléphone récepteur ({selectedProviderConfig.name})
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input-withdraw-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Ex : +225 07 48 99 12 34"
                  className="w-full p-3.5 pl-10 rounded-2xl bg-white/5 border border-white/10 text-xs sm:text-sm font-medium text-white placeholder:text-white/25 focus:outline-none focus:border-[#FF6321] transition"
                />
              </div>
              <span className="text-[10px] text-white/40 block mt-1.5">
                Reversement direct sur votre compte {selectedProviderConfig.name}.
              </span>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Buttons */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white/70 text-xs font-bold transition active:scale-95"
              >
                Annuler
              </button>
              <button
                id="btn-confirm-withdraw-submit"
                type="submit"
                disabled={isProcessing || balance <= 0}
                className="flex-1 py-3.5 rounded-2xl bg-[#FF6321] hover:bg-[#ff753b] disabled:opacity-40 text-white text-xs font-black shadow-lg shadow-orange-600/30 transition flex items-center justify-center gap-2 active:scale-95"
              >
                <ArrowDownToLine className="w-4 h-4" />
                <span>{isProcessing ? 'Transfert en cours...' : 'Valider le Retrait'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
