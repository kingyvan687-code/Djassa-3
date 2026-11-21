import React, { useMemo, useState } from 'react';
import { Order, OrderReceiptDto, Seller } from '../../types';
import { OrderService, formatFCFA } from '../../services/marketServices';
import { DJASSA_FIXED_COMMISSION_FCFA } from '../achats/checkout/checkoutTypes';

export type ReceiptPerspective = 'client' | 'seller' | 'admin';

export interface ReceiptFinancialBreakdown {
  subtotal?: number;
  clientFeeFcfa?: number;
  total?: number;
  djassaCommission?: number;
  sellerNetGain?: number;
  providerFeesFcfa?: number;
  discount?: number;
  paymentMode?: 'online' | 'cod';
  paymentMethod?: string;
  paymentStatus?: string;
}

export interface DjassaOfficialReceiptModalProps {
  order: Order;
  seller?: Seller;
  receiptDto?: OrderReceiptDto;
  perspective?: ReceiptPerspective;
  customBadge?: string;
  customTitle?: string;
  financialBreakdown?: ReceiptFinancialBreakdown;
  onClose: () => void;
  onShowToast?: (message: string) => void;
}

export const DjassaOfficialReceiptModal: React.FC<DjassaOfficialReceiptModalProps> = ({
  order,
  seller,
  receiptDto,
  perspective = 'seller',
  customBadge,
  customTitle,
  financialBreakdown,
  onClose,
  onShowToast
}) => {
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const showNotification = (msg: string) => {
    onShowToast?.(msg);
  };

  const orderDateObj = useMemo(() => {
    const raw = receiptDto?.date || order.createdAt;
    return raw ? new Date(raw) : new Date();
  }, [receiptDto?.date, order.createdAt]);

  const orderDateFormatted = useMemo(() => {
    if (!isNaN(orderDateObj.getTime())) {
      const day = String(orderDateObj.getDate()).padStart(2, '0');
      const month = String(orderDateObj.getMonth() + 1).padStart(2, '0');
      const year = orderDateObj.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return order.createdAt || 'Date confirmée';
  }, [orderDateObj, order.createdAt]);

  const orderTimeFormatted = useMemo(() => {
    return !isNaN(orderDateObj.getTime())
      ? orderDateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : '';
  }, [orderDateObj]);

  const paymentMode: 'online' | 'cod' =
    financialBreakdown?.paymentMode ||
    receiptDto?.paymentMode ||
    order.paymentMode ||
    (order.paymentMethod === 'cash_on_delivery' || order.paymentStatus === 'cod_pending'
      ? 'cod'
      : 'online');
  const isCod = paymentMode === 'cod';

  const paymentMethod =
    financialBreakdown?.paymentMethod ||
    receiptDto?.paymentMethod ||
    order.paymentMethod ||
    (isCod ? 'cash_on_delivery' : 'wave');

  const paymentStatus =
    financialBreakdown?.paymentStatus ||
    receiptDto?.paymentStatus ||
    order.paymentStatus ||
    (isCod ? 'cod_pending' : 'pending');

  const subtotal =
    financialBreakdown?.subtotal ??
    receiptDto?.subtotal ??
    order.subtotal ??
    order.items.reduce((s, it) => s + it.price * it.quantity, 0);
  const discount = financialBreakdown?.discount ?? receiptDto?.discount ?? order.discount ?? 0;
  const clientFeeFcfa = isCod
    ? 0
    : financialBreakdown?.clientFeeFcfa ??
      receiptDto?.clientFeeFcfa ??
      order.clientFeeFcfa ??
      order.serviceFee ??
      0;
  const totalAmount =
    financialBreakdown?.total ??
    receiptDto?.totalPaidByClient ??
    order.total ??
    Math.max(0, subtotal - discount + clientFeeFcfa);
  const djassaCommission =
    financialBreakdown?.djassaCommission ??
    receiptDto?.commissionFcfa ??
    order.commissionFcfa ??
    DJASSA_FIXED_COMMISSION_FCFA;
  const sellerNetGain =
    financialBreakdown?.sellerNetGain ??
    receiptDto?.sellerNetFcfa ??
    order.sellerNetFcfa ??
    Math.max(0, subtotal - discount - djassaCommission);
  const providerFeesFcfa =
    financialBreakdown?.providerFeesFcfa ?? receiptDto?.providerFeeFcfa;

  const paymentBadge = OrderService.getPaymentStatusBadge(paymentStatus, paymentMode);

  const paymentMethodLabel =
    {
      wave: 'Wave CI',
      orange_money: 'Orange Money CI',
      cash_on_delivery: 'Paiement à la livraison (Espèces / Direct)',
      mtn_momo: 'MTN Mobile Money CI',
      card: 'Carte Bancaire'
    }[paymentMethod] || String(paymentMethod).toUpperCase();

  const paymentModeLabel = isCod ? 'Paiement à la livraison' : 'Paiement en ligne';

  const txReference =
    receiptDto?.providerReference ||
    receiptDto?.transactionNumber ||
    order.paymentId ||
    (isCod ? `COD-${order.orderNumber}` : `TXN-${order.orderNumber}`);

  const sellerDisplayName =
    receiptDto?.seller?.name ||
    seller?.storeName ||
    seller?.name ||
    order.items[0]?.sellerName ||
    'Boutique Partenaire';

  const handlePrint = () => {
    window.print?.();
  };

  const handleCopyOrderNumber = () => {
    navigator.clipboard?.writeText?.(order.orderNumber);
    setCopiedNumber(true);
    showNotification(`Numéro de commande #${order.orderNumber} copié !`);
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  const handleDownload = () => {
    setIsDownloading(true);
    setTimeout(() => {
      setIsDownloading(false);
      showNotification(`Reçu officiel #${order.orderNumber} téléchargé avec succès !`);
    }, 600);
  };

  const handleShare = () => {
    const textToShare = `Reçu Officiel DJASSA (${perspective.toUpperCase()}) - #${order.orderNumber} (${formatFCFA(totalAmount)}) - ${orderDateFormatted}`;
    if (navigator.share) {
      navigator
        .share({
          title: `Reçu DJASSA - #${order.orderNumber}`,
          text: textToShare,
          url: window.location.href
        })
        .catch(() => showNotification('Détails du reçu prêts à être partagés.'));
    } else {
      navigator.clipboard?.writeText?.(textToShare);
      showNotification('Détails du reçu copiés dans le presse-papier !');
    }
  };

  const badgeLabel =
    customBadge ||
    {
      client: 'REÇU CLIENT',
      seller: 'REÇU VENDEUR',
      admin: 'REÇU ADMIN'
    }[perspective];

  const modalTitle =
    customTitle ||
    {
      client: 'Reçu Client Officiel',
      seller: 'Reçu de Vente Marchand',
      admin: 'Reçu Administrateur — Supervision & Reversement'
    }[perspective];

  return (
    <div
      id="djassa-official-receipt-modal-overlay"
      className="fixed inset-0 z-[3200] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="djassa-official-receipt-modal-content"
        className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-3xl bg-[#141414] border border-white/10 shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-3.5 sm:p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02] gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="px-2.5 py-1 rounded-lg bg-[#FF6321] text-white font-black text-[10px] uppercase tracking-wider shrink-0">
              {badgeLabel}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white leading-tight truncate">{modalTitle}</h3>
              <p className="text-[10px] text-white/50 font-mono mt-0.5 truncate">
                #{order.orderNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-[#FF6321] hover:bg-[#ff773b] text-white text-xs font-bold transition active:scale-95"
            >
              Imprimer
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="hidden sm:inline-block px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition active:scale-95"
            >
              Partager
            </button>
            <button
              type="button"
              id="btn-close-official-receipt"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition active:scale-95"
            >
              Fermer
            </button>
          </div>
        </div>

        {/* Printable Voucher Paper */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 no-scrollbar bg-neutral-900/60 select-text">
          <div
            id="printable-official-receipt-voucher"
            className="bg-white text-black p-4 sm:p-5 rounded-2xl shadow-xl space-y-3.5 text-xs font-sans border border-neutral-300"
          >
            {/* Brand & Top Refs */}
            <div className="border-b-2 border-black pb-3 flex justify-between items-start gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-black tracking-tight text-[#FF6321]">DJASSA</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-black text-white px-1.5 py-0.5 rounded">
                    MARKETPLACE
                  </span>
                </div>
                <p className="text-[9.5px] text-neutral-600 mt-0.5">{modalTitle}</p>
                <p className="text-[8.5px] font-mono text-neutral-500">
                  Statut commande : Commande confirmée
                </p>
              </div>

              <div className="text-right space-y-1">
                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                  <span className="text-[11px] font-mono font-black">#{order.orderNumber}</span>
                  <button
                    type="button"
                    onClick={handleCopyOrderNumber}
                    className="text-[9px] font-bold text-neutral-600 underline hover:text-black"
                  >
                    {copiedNumber ? 'Copié' : 'Copier'}
                  </button>
                </div>
                <div className="text-[9.5px] font-mono text-neutral-700">
                  Date : {orderDateFormatted}
                  {orderTimeFormatted ? ` à ${orderTimeFormatted}` : ''}
                </div>
                <span className="inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Commande confirmée
                </span>
              </div>
            </div>

            {/* MODE DE PAIEMENT CALLOUT (Mandatory clear display for Seller & Admin) */}
            <div
              className={`p-3 rounded-xl border text-[11px] space-y-1 ${
                isCod
                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-950'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-black uppercase tracking-wide text-[10px]">
                  MODE DE PAIEMENT : {paymentModeLabel}
                </span>
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-white/80 border border-black/10">
                  {paymentBadge.label}
                </span>
              </div>

              {isCod ? (
                <p className="text-[11px] font-semibold">
                  {perspective === 'client'
                    ? `À payer directement au vendeur à la réception : ${formatFCFA(totalAmount)}.`
                    : `Le client paiera directement à la réception — Montant à encaisser : ${formatFCFA(totalAmount)}.`}
                </p>
              ) : (
                <div className="text-[10.5px] space-y-0.5">
                  <p>
                    <strong>Moyen utilisé :</strong> {paymentMethodLabel} ·{' '}
                    <strong>Réf. transaction :</strong>{' '}
                    <span className="font-mono">{txReference}</span>
                  </p>
                  <p>
                    <strong>Statut réel du paiement :</strong> {paymentBadge.label}
                  </p>
                </div>
              )}
            </div>

            {/* Vendeur & Client */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                <span className="text-[9px] font-black uppercase tracking-wider text-neutral-500 block mb-1">
                  1. BOUTIQUE / VENDEUR
                </span>
                <p className="font-bold text-neutral-900">{sellerDisplayName}</p>
                <p className="text-[11px] text-neutral-700">
                  {seller?.location || 'Abidjan, Côte d’Ivoire'}
                </p>
                {seller?.phone && (
                  <p className="text-[11px] font-mono text-neutral-700">{seller.phone}</p>
                )}
                <p className="text-[9.5px] text-neutral-600 mt-1">
                  Livraison organisée directement par le vendeur (externe DJASSA).
                </p>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                <span className="text-[9px] font-black uppercase tracking-wider text-neutral-500 block mb-1">
                  2. CLIENT & ADRESSE DE LIVRAISON
                </span>
                <p className="font-bold text-neutral-900">
                  {receiptDto?.client?.name || order.deliveryAddress?.recipientName || 'Client DJASSA'}
                </p>
                <p className="text-[11px] text-neutral-700">
                  {order.deliveryAddress?.commune || 'Abidjan'},{' '}
                  {order.deliveryAddress?.quartier || ''}
                </p>
                <p className="text-[11px] font-mono text-neutral-700">
                  {receiptDto?.client?.phone || order.deliveryAddress?.phone || 'Non renseigné'}
                </p>
                {order.deliveryAddress?.details && (
                  <p className="text-[10px] text-neutral-600 mt-1">
                    {order.deliveryAddress.details}
                  </p>
                )}
              </div>
            </div>

            {/* Articles Table */}
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-neutral-500 block mb-1.5">
                3. ARTICLES COMMANDÉS ({order.items.length})
              </span>
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-neutral-300 text-neutral-600 text-left">
                    <th className="py-1">Article</th>
                    <th className="py-1 text-center">Qté</th>
                    <th className="py-1 text-right">Prix unit.</th>
                    <th className="py-1 text-right">Sous-total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-neutral-200">
                      <td className="py-1.5 pr-2">
                        <p className="font-medium text-neutral-900">{item.productTitle}</p>
                        {item.variant && Object.keys(item.variant).length > 0 && (
                          <p className="text-[9px] text-neutral-500">
                            {Object.entries(item.variant)
                              .filter(([, v]) => Boolean(v))
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' · ')}
                          </p>
                        )}
                      </td>
                      <td className="py-1.5 text-center font-bold">{item.quantity}</td>
                      <td className="py-1.5 text-right text-neutral-700">
                        {formatFCFA(item.price)}
                      </td>
                      <td className="py-1.5 text-right font-bold text-neutral-900">
                        {formatFCFA(item.price * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Breakdown */}
            <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-200 space-y-1.5">
              <div className="space-y-1 text-[11px] text-neutral-700">
                <div className="flex justify-between">
                  <span>Sous-total articles :</span>
                  <span className="font-mono text-neutral-900">{formatFCFA(subtotal)}</span>
                </div>

                <div className="flex justify-between">
                  <span>Livraison (gérée par la boutique) :</span>
                  <span className="font-mono text-emerald-700 font-bold">0 FCFA</span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Remise promotionnelle :</span>
                    <span className="font-mono">-{formatFCFA(discount)}</span>
                  </div>
                )}

                {!isCod && clientFeeFcfa > 0 && (
                  <div className="flex justify-between">
                    <span>Frais client (6,5% paiement en ligne) :</span>
                    <span className="font-mono text-neutral-900">+{formatFCFA(clientFeeFcfa)}</span>
                  </div>
                )}

                {(perspective === 'seller' || perspective === 'admin') && (
                  <div className="flex justify-between text-purple-700 font-semibold">
                    <span>
                      Commission DJASSA ({order.commissionStatus || receiptDto?.commissionStatus || 'pending'}) :
                    </span>
                    <span className="font-mono">-{formatFCFA(djassaCommission)}</span>
                  </div>
                )}

                {perspective === 'admin' && typeof providerFeesFcfa === 'number' && (
                  <div className="flex justify-between text-neutral-600">
                    <span>Frais opérateur GeniusPay :</span>
                    <span className="font-mono">{formatFCFA(providerFeesFcfa)}</span>
                  </div>
                )}
              </div>

              {/* Totals & Seller/Admin Net */}
              <div className="pt-2 border-t border-neutral-300 flex justify-between items-baseline gap-2">
                <div>
                  <span className="text-[9px] text-neutral-500 uppercase font-bold block">
                    {isCod ? 'Total à payer à la livraison' : 'Montant total client'}
                  </span>
                  <span className="text-base font-black text-neutral-900 font-mono">
                    {formatFCFA(totalAmount)}
                  </span>
                </div>

                {(perspective === 'seller' || perspective === 'admin') && (
                  <div className="text-right">
                    <span className="text-[9px] text-emerald-700 uppercase font-black block">
                      {isCod
                        ? 'Net vendeur après commission (150 F)'
                        : perspective === 'admin'
                        ? 'Montant reversé / dû au vendeur'
                        : 'Montant net vendeur'}
                    </span>
                    <span className="text-base font-black text-emerald-700 font-mono">
                      {formatFCFA(sellerNetGain)}
                    </span>
                  </div>
                )}
              </div>

              {/* Payout details for Seller / Admin when online */}
              {(perspective === 'seller' || perspective === 'admin') && !isCod && (
                <div className="pt-2 border-t border-neutral-200 text-[10px] text-neutral-700 space-y-0.5">
                  <div className="flex justify-between">
                    <span>Statut reversement vendeur :</span>
                    <span className="font-bold uppercase">
                      {receiptDto?.sellerPayoutStatus || order.sellerPayoutStatus || 'pending'}
                    </span>
                  </div>
                  {(receiptDto?.sellerPayoutReference || order.sellerPayoutReference) && (
                    <div className="flex justify-between">
                      <span>Référence transfert vendeur :</span>
                      <span className="font-mono font-bold">
                        {receiptDto?.sellerPayoutReference || order.sellerPayoutReference}
                      </span>
                    </div>
                  )}
                  {(receiptDto?.sellerPayoutChannel || order.sellerPayoutChannel) && (
                    <div className="flex justify-between">
                      <span>Compte destinataire :</span>
                      <span className="font-mono">
                        {(receiptDto?.sellerPayoutChannel || order.sellerPayoutChannel || '').toUpperCase()}{' '}
                        {order.sellerPayoutPhone || ''}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Admin Operation History */}
            {perspective === 'admin' && (
              <div className="p-3 rounded-xl border border-neutral-200 bg-neutral-50 space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-neutral-500 block">
                  4. TRAÇABILITÉ & HISTORIQUE D’OPÉRATION
                </span>
                <div className="text-[10px] font-mono text-neutral-700 space-y-0.5">
                  <p>N° Transaction : {txReference}</p>
                  <p>État transaction : {paymentBadge.label} ({paymentStatus})</p>
                  {(receiptDto?.history || order.trackingEvents || []).length > 0 && (
                    <ul className="list-disc pl-4 pt-1 space-y-0.5">
                      {(receiptDto?.history || order.trackingEvents || []).map((ev: any, idx: number) => (
                        <li key={idx}>
                          {ev.time || ev.at || ''} — {ev.label || ev.event || ev.status}
                          {ev.description ? ` (${ev.description})` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Authentic Reference Seal */}
            <div className="pt-2 text-center space-y-0.5 border-t border-neutral-200">
              <p className="text-[8.5px] font-mono text-neutral-500 uppercase tracking-wider">
                DOCUMENT OFFICIEL DJASSA • STATUT : COMMANDE CONFIRMÉE
              </p>
              <p className="text-[8px] font-mono text-neutral-400 tracking-widest">
                #{order.orderNumber} · {txReference}
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 bg-black/40 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <span className="text-[10px] text-white/50 text-center sm:text-left">
            Document conforme • Archive officielle DJASSA.
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF6321] to-[#ff773b] hover:brightness-110 active:scale-95 text-white font-black text-xs transition disabled:opacity-50"
            >
              {isDownloading ? 'Téléchargement...' : 'Télécharger'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition active:scale-95"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
