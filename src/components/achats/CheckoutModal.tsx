import React from 'react';
import { DjassaOrderFlow } from './checkout/DjassaOrderFlow';

interface CheckoutModalProps {
  onClose: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ onClose }) => {
  return <DjassaOrderFlow mode="cart" onClose={onClose} onOpenCart={onClose} />;
};
