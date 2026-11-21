import React from 'react';
import { SettingsAndPrivacyScreen } from './SettingsAndPrivacyScreen';

interface ProfileMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFollowedSellers?: () => void;
  onOpenActivity?: () => void;
  onOpenMyData?: () => void;
  onOpenSettings?: () => void;
}

export const ProfileMenuDrawer: React.FC<ProfileMenuDrawerProps> = ({
  isOpen,
  onClose,
  onOpenActivity,
}) => {
  return (
    <SettingsAndPrivacyScreen
      isOpen={isOpen}
      onClose={onClose}
      onOpenActivity={onOpenActivity}
    />
  );
};
