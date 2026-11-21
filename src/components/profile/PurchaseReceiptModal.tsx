import React from 'react';
import { Order, Seller } from '../../types';
import { DjassaOfficialReceiptModal } from '../common/DjassaOfficialReceiptModal';

export interface PurchaseReceiptModalProps {
  order: Order;
  seller?: Seller;
  onClose: () => void;
  onShowToast: (message: string) => void;
}

export const PurchaseReceiptModal: React.FC<PurchaseReceiptModalProps> = ({
  order,
  seller,
  onClose,
  onShowToast
}) => {
  return (
    <DjassaOfficialReceiptModal
      order={order}
      seller={seller}
      perspective="client"
      customBadge="REÇU D’ACHAT"
      customTitle="Reçu Officiel d’Achat / Quittance Numérique"
      onClose={onClose}
      onShowToast={onShowToast}
    />
  );
};
