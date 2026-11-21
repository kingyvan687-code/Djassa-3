import React from 'react';
import { Product } from '../../types';
import { DjassaOrderFlow } from '../achats/checkout/DjassaOrderFlow';

interface VariantSelectionModalProps {
  product: Product;
  isDirectBuy?: boolean;
  onClose: () => void;
}

export const VariantSelectionModal: React.FC<VariantSelectionModalProps> = ({
  product,
  onClose
}) => {
  return <DjassaOrderFlow mode="direct" initialProduct={product} onClose={onClose} />;
};
