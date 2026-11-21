import React from 'react';
import { Product } from '../../../types';
import { VideoBoostModal } from '../profile/VideoBoostModal';

interface Props {
  product: Product;
  onClose: () => void;
  onBoostSuccess?: () => void;
}

export const PublicationBoostModal: React.FC<Props> = ({
  product,
  onClose,
  onBoostSuccess,
}) => {
  return (
    <VideoBoostModal
      product={product}
      onClose={onClose}
      onBoostConfirm={() => {
        if (onBoostSuccess) onBoostSuccess();
      }}
    />
  );
};
