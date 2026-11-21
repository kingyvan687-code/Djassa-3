import React from 'react';
import { PaymentMethodType } from './checkoutTypes';

export const DjassaBagLogo: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
    <path
      d="M16 15V12C16 7.58172 19.5817 4 24 4C28.4183 4 32 7.58172 32 12V15"
      stroke="#FF8D52"
      strokeWidth="3.6"
      strokeLinecap="round"
    />
    <path
      d="M8.5 16.2C8.7 14.3 10.3 13 12.2 13H35.8C37.7 13 39.3 14.3 39.5 16.2L41.8 38.4C42.1 41.3 39.8 43.8 36.9 43.8H11.1C8.2 43.8 5.9 41.3 6.2 38.4L8.5 16.2Z"
      fill="url(#djassaBagGrad)"
    />
    <path
      d="M11.5 17H36.5"
      stroke="#FFA26B"
      strokeOpacity="0.45"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
    <path
      d="M19.5 21.5H24.2C27.9 21.5 30.4 24 30.4 27.6C30.4 31.2 27.9 33.7 24.2 33.7H19.5V21.5ZM22.9 24.4V30.8H24.1C26.1 30.8 27.2 29.6 27.2 27.6C27.2 25.6 26.1 24.4 24.1 24.4H22.9Z"
      fill="#FFFFFF"
    />
    <defs>
      <linearGradient id="djassaBagGrad" x1="8" y1="13" x2="40" y2="44" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FF8238" />
        <stop offset="1" stopColor="#EB460E" />
      </linearGradient>
    </defs>
  </svg>
);

export const VerificationCubeIcon: React.FC<{ className?: string; accent?: 'green' | 'orange' }> = ({
  className = 'w-9 h-9',
  accent = 'green'
}) => {
  const stroke = accent === 'orange' ? '#FF6321' : '#1EEB7A';
  const fill = accent === 'orange' ? '#2A140A' : '#0D2C1B';
  const accentSoft = accent === 'orange' ? '#FF8238' : '#16E575';
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden="true">
      <path
        d="M20 5L33 12.5V27.5L20 35L7 27.5V12.5L20 5Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M7 12.5L20 20L33 12.5" stroke={stroke} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M20 20V35" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M13.5 8.75L26.5 16.25" stroke={accentSoft} strokeOpacity="0.65" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="26.5" cy="16.25" r="2.2" fill={stroke} />
    </svg>
  );
};

export const LocationPinIcon3D: React.FC<{ className?: string; accent?: 'green' | 'orange' }> = ({
  className = 'w-8 h-8',
  accent = 'green'
}) => {
  const gradId = accent === 'orange' ? 'pinGradOrange' : 'pinGrad';
  return (
    <svg viewBox="0 0 36 36" className={className} fill="none" aria-hidden="true">
      <path
        d="M18 3C11.92 3 7 7.82 7 13.78C7 21.85 18 33 18 33C18 33 29 21.85 29 13.78C29 7.82 24.08 3 18 3Z"
        fill={`url(#${gradId})`}
      />
      <circle cx="18" cy="13.5" r="4.5" fill={accent === 'orange' ? '#140A05' : '#06140C'} />
      <circle
        cx="16.8"
        cy="12.2"
        r="1.3"
        fill={accent === 'orange' ? '#FF8238' : '#1EEB7A'}
        fillOpacity="0.55"
      />
      <defs>
        <linearGradient id={gradId} x1="10" y1="3" x2="26" y2="33" gradientUnits="userSpaceOnUse">
          <stop stopColor={accent === 'orange' ? '#FF8D52' : '#34FF93'} />
          <stop offset="1" stopColor={accent === 'orange' ? '#FF6321' : '#0EC460'} />
        </linearGradient>
      </defs>
    </svg>
  );
};

export const MapButtonIcon: React.FC<{ className?: string; accent?: 'green' | 'orange' }> = ({
  className = 'w-4 h-4',
  accent = 'green'
}) => {
  const main = accent === 'orange' ? '#FF6321' : '#16E575';
  const stroke = accent === 'orange' ? '#FF8238' : '#1EEB7A';
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M3 6.2L9 3.5L15 6.2L21 3.5V17.8L15 20.5L9 17.8L3 20.5V6.2Z" fill={main} fillOpacity="0.22" />
      <path d="M9 3.5V17.8M15 6.2V20.5" stroke={main} strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M3 6.2L9 3.5L15 6.2L21 3.5V17.8L15 20.5L9 17.8L3 20.5V6.2Z"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const DeliverySpeechBubbleIcon: React.FC<{ className?: string; accent?: 'green' | 'orange' }> = ({
  className = 'w-8 h-8',
  accent = 'green'
}) => {
  const gradId = accent === 'orange' ? 'speechGradOrange' : 'speechGrad';
  const dot = accent === 'orange' ? '#140A05' : '#06160D';
  return (
    <svg viewBox="0 0 36 36" className={className} fill="none" aria-hidden="true">
      <path
        d="M18 5C10.27 5 4 10.37 4 17C4 20.23 5.49 23.16 7.92 25.31L6.2 30.8L12.1 28.42C13.94 28.8 15.92 29 18 29C25.73 29 32 23.63 32 17C32 10.37 25.73 5 18 5Z"
        fill={`url(#${gradId})`}
      />
      <circle cx="12.5" cy="17" r="2" fill={dot} />
      <circle cx="18" cy="17" r="2" fill={dot} />
      <circle cx="23.5" cy="17" r="2" fill={dot} />
      <defs>
        <linearGradient id={gradId} x1="6" y1="5" x2="29" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor={accent === 'orange' ? '#FF8D52' : '#34FF93'} />
          <stop offset="1" stopColor={accent === 'orange' ? '#FF6321' : '#10C864'} />
        </linearGradient>
      </defs>
    </svg>
  );
};

export const DeliveryTruckIconGreen: React.FC<{ className?: string; accent?: 'green' | 'orange' }> = ({
  className = 'w-9 h-7',
  accent = 'green'
}) => {
  const gradId = accent === 'orange' ? 'truckBodyGradOrange' : 'truckBodyGrad';
  const stroke = accent === 'orange' ? '#FF8238' : '#1EEB7A';
  const cab = accent === 'orange' ? '#EB460E' : '#10C864';
  const dark = accent === 'orange' ? '#140A05' : '#06160D';
  return (
    <svg viewBox="0 0 42 30" className={className} fill="none" aria-hidden="true">
      <path d="M2 10H8M1 15H6M3 20H9" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
      <rect x="10" y="6" width="18" height="15" rx="3" fill={`url(#${gradId})`} />
      <path
        d="M28 11H34.2C35.3 11 36.3 11.6 36.9 12.6L39.5 17.2C39.8 17.7 40 18.3 40 18.9V21H28V11Z"
        fill={cab}
      />
      <path d="M30.5 13H34.8L37 16.8H30.5V13Z" fill={dark} />
      <circle cx="16" cy="22.5" r="3.4" fill={dark} stroke={stroke} strokeWidth="1.8" />
      <circle cx="33.5" cy="22.5" r="3.4" fill={dark} stroke={stroke} strokeWidth="1.8" />
      <defs>
        <linearGradient id={gradId} x1="10" y1="6" x2="28" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor={accent === 'orange' ? '#FF8D52' : '#34FF93'} />
          <stop offset="1" stopColor={accent === 'orange' ? '#FF6321' : '#12CD67'} />
        </linearGradient>
      </defs>
    </svg>
  );
};

export const DeliveryScooterIllustration: React.FC<{ className?: string; accent?: 'green' | 'orange' }> = ({
  className = 'w-12 h-12',
  accent = 'green'
}) => {
  const gradId = accent === 'orange' ? 'scooterBodyOrange' : 'scooterBody';
  const primary = accent === 'orange' ? '#FF6321' : '#1EEB7A';
  const bright = accent === 'orange' ? '#FF8238' : '#16E575';
  const deep = accent === 'orange' ? '#DC4B0E' : '#0EC460';
  const wheelBg = accent === 'orange' ? '#140A05' : '#06120B';
  return (
    <svg viewBox="0 0 56 56" className={className} fill="none" aria-hidden="true">
      {/* Delivery box */}
      <rect x="8" y="18" width="13" height="11" rx="2.5" fill={primary} stroke="#140A05" strokeWidth="1.4" />
      <path d="M11 22H18M11 25H16" stroke="#140A05" strokeWidth="1.5" strokeLinecap="round" />
      {/* Scooter chassis & windshield */}
      <path
        d="M10 34C10 30.8 12.5 29 16 29H27L31 21H37L40 28C43.5 28.5 46 31.2 46 35H38C36.8 32 32 31.8 30 35H19C17.2 32 13 32 10 34Z"
        fill={`url(#${gradId})`}
      />
      {/* Rider */}
      <circle cx="27" cy="14" r="4.2" fill="#FFF7ED" />
      <path d="M23.5 13C24 10.5 26 9.5 28.5 9.8C30.2 10 31.2 11.4 31 13H23.5Z" fill={deep} />
      <path
        d="M23 19.5C23 18 24.4 17 26.2 17H28.8C30.5 17 31.6 18.2 31.6 20V25H23V19.5Z"
        fill={bright}
      />
      {/* Handlebars & light */}
      <path d="M34 19L39 17.5" stroke="#FED7AA" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="42.5" cy="24.5" r="2" fill="#FEF08A" />
      {/* Wheels */}
      <circle cx="15.5" cy="39" r="5.5" fill={wheelBg} stroke={primary} strokeWidth="2.2" />
      <circle cx="15.5" cy="39" r="1.8" fill={primary} />
      <circle cx="40.5" cy="39" r="5.5" fill={wheelBg} stroke={primary} strokeWidth="2.2" />
      <circle cx="40.5" cy="39" r="1.8" fill={primary} />
      {/* Ground speed line */}
      <path d="M6 46.5H47" stroke={bright} strokeOpacity="0.35" strokeWidth="1.6" strokeLinecap="round" />
      <defs>
        <linearGradient id={gradId} x1="12" y1="21" x2="45" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor={accent === 'orange' ? '#FF8D52' : '#2BFF91'} />
          <stop offset="1" stopColor={accent === 'orange' ? '#D9480F' : '#0CA852'} />
        </linearGradient>
      </defs>
    </svg>
  );
};

export const ExpressRocketIllustration: React.FC<{ className?: string }> = ({
  className = 'w-12 h-12'
}) => (
  <svg viewBox="0 0 56 56" className={className} fill="none" aria-hidden="true">
    {/* Flame plume */}
    <path
      d="M17 39C12.5 40 9.5 43.5 9 47.5C13 47 16.5 44 17.5 39.5L17 39Z"
      fill="url(#rocketFlame)"
    />
    <path d="M18.5 37.5C15.5 38.3 13.5 40.5 13 43C15.8 42.5 18 40.5 18.8 37.8L18.5 37.5Z" fill="#FEF08A" />
    {/* Left & Bottom Fins */}
    <path d="M23 23L15 24.5L19.5 31L23 23Z" fill="#FF4B1F" />
    <path d="M33 33L31.5 41L25 36.5L33 33Z" fill="#FF4B1F" />
    {/* Rocket Body */}
    <path
      d="M44 12C35 12.2 26.8 16.4 20.5 23.8L17.5 33.5L22.5 38.5L32.2 35.5C39.6 29.2 43.8 21 44 12Z"
      fill="url(#rocketHull)"
    />
    {/* Nose cone */}
    <path d="M44 12C39.8 12.1 35.9 13.2 32.5 15L41 23.5C42.8 20.1 43.9 16.2 44 12Z" fill="#FF6321" />
    {/* Porthole */}
    <circle cx="30" cy="26" r="4.5" fill="#0B1320" stroke="#FF9B54" strokeWidth="1.8" />
    <circle cx="29" cy="25" r="1.4" fill="#7DD3FC" />
    {/* Sparkle stars */}
    <circle cx="15" cy="14" r="1.4" fill="#FBBF24" />
    <circle cx="44" cy="39" r="1.2" fill="#FB923C" />
    <defs>
      <linearGradient id="rocketHull" x1="19" y1="36" x2="43" y2="13" gradientUnits="userSpaceOnUse">
        <stop stopColor="#E2E8F0" />
        <stop offset="1" stopColor="#FFFFFF" />
      </linearGradient>
      <linearGradient id="rocketFlame" x1="17" y1="39" x2="9" y2="47" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FF7A18" />
        <stop offset="1" stopColor="#EF4444" />
      </linearGradient>
    </defs>
  </svg>
);

export const SummaryCalculatorIcon: React.FC<{ className?: string; accent?: 'green' | 'orange' }> = ({
  className = 'w-6 h-6',
  accent = 'green'
}) => {
  const fillBg = accent === 'orange' ? '#2A140A' : '#0E301D';
  const stroke = accent === 'orange' ? '#FF6321' : '#1EEB7A';
  return (
    <svg viewBox="0 0 28 28" className={className} fill="none" aria-hidden="true">
      <rect x="4" y="2.5" width="20" height="23" rx="4.5" fill={fillBg} stroke={stroke} strokeWidth="1.8" />
      <rect x="7.5" y="6" width="13" height="4.5" rx="1.2" fill={stroke} />
      <circle cx="9.2" cy="14.2" r="1.3" fill={stroke} />
      <circle cx="14" cy="14.2" r="1.3" fill={stroke} />
      <circle cx="18.8" cy="14.2" r="1.3" fill={stroke} />
      <circle cx="9.2" cy="18.2" r="1.3" fill={stroke} />
      <circle cx="14" cy="18.2" r="1.3" fill={stroke} />
      <rect x="17.5" y="17" width="2.6" height="5.5" rx="1.2" fill={stroke} />
      <circle cx="9.2" cy="21.8" r="1.3" fill={stroke} />
      <circle cx="14" cy="21.8" r="1.3" fill={stroke} />
    </svg>
  );
};

export const PaymentCardGreenIcon: React.FC<{ className?: string; accent?: 'green' | 'orange' }> = ({
  className = 'w-8 h-8',
  accent = 'green'
}) => {
  const gradId = accent === 'orange' ? 'payCardOrange' : 'payCardGreen';
  return (
    <svg viewBox="0 0 36 36" className={className} fill="none" aria-hidden="true">
      <rect x="3" y="8" width="30" height="20" rx="4.5" fill={`url(#${gradId})`} />
      <rect x="3" y="13" width="30" height="4.2" fill="#120A05" />
      <rect x="7" y="20.5" width="8" height="3.2" rx="1" fill="#1E0E07" />
      <circle cx="26.5" cy="22" r="2.2" fill={accent === 'orange' ? '#FED7AA' : '#A7F3D0'} fillOpacity="0.85" />
      <defs>
        <linearGradient id={gradId} x1="3" y1="8" x2="33" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor={accent === 'orange' ? '#FF8D52' : '#34FF93'} />
          <stop offset="1" stopColor={accent === 'orange' ? '#FF6321' : '#10C864'} />
        </linearGradient>
      </defs>
    </svg>
  );
};

export const PaymentWalletGreenIcon: React.FC<{ className?: string; accent?: 'green' | 'orange' }> = ({
  className = 'w-7 h-7',
  accent = 'green'
}) => {
  const gradId = accent === 'orange' ? 'walletOrangeGrad' : 'walletGreenGrad';
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <path
        d="M5 9C5 7.34 6.34 6 8 6H23C24.1 6 25 6.9 25 8V10H8C6.34 10 5 11.34 5 13V9Z"
        fill={accent === 'orange' ? '#EB460E' : '#10B981'}
      />
      <rect x="4" y="9" width="24" height="17" rx="4" fill={`url(#${gradId})`} />
      <rect x="19" y="14.5" width="9" height="6" rx="2.5" fill={accent === 'orange' ? '#210D05' : '#062011'} />
      <circle cx="22" cy="17.5" r="1.4" fill={accent === 'orange' ? '#FF8238' : '#1EEB7A'} />
      <defs>
        <linearGradient id={gradId} x1="4" y1="9" x2="28" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor={accent === 'orange' ? '#FF8D52' : '#34FF93'} />
          <stop offset="1" stopColor={accent === 'orange' ? '#FF6321' : '#0DC561'} />
        </linearGradient>
      </defs>
    </svg>
  );
};

export const PromoTagGreenIcon: React.FC<{ className?: string; accent?: 'green' | 'orange' }> = ({
  className = 'w-6 h-6',
  accent = 'green'
}) => {
  const gradId = accent === 'orange' ? 'tagGradOrange' : 'tagGrad';
  return (
    <svg viewBox="0 0 28 28" className={className} fill="none" aria-hidden="true">
      <path
        d="M14.6 3.8L23.2 4.6C23.8 4.65 24.35 5.2 24.4 5.8L25.2 14.4C25.26 15.05 25.02 15.7 24.55 16.17L14.5 26.2C13.68 27.02 12.35 27.02 11.53 26.2L2.8 17.47C1.98 16.65 1.98 15.32 2.8 14.5L12.83 4.45C13.3 3.98 13.95 3.74 14.6 3.8Z"
        fill={`url(#${gradId})`}
      />
      <circle cx="19.5" cy="9.5" r="2" fill="#140A05" />
      <defs>
        <linearGradient id={gradId} x1="3" y1="16" x2="25" y2="5" gradientUnits="userSpaceOnUse">
          <stop stopColor={accent === 'orange' ? '#FF6321' : '#0DC561'} />
          <stop offset="1" stopColor={accent === 'orange' ? '#FF8D52' : '#34FF93'} />
        </linearGradient>
      </defs>
    </svg>
  );
};

export const ConfirmationCheckOrb: React.FC<{ className?: string; accent?: 'green' | 'orange' }> = ({
  className = 'w-11 h-11',
  accent = 'green'
}) => {
  const gradId = accent === 'orange' ? 'confirmOrbGradOrange' : 'confirmOrbGrad';
  const stroke = accent === 'orange' ? '#FF6321' : '#1EEB7A';
  return (
    <svg viewBox="0 0 44 44" className={className} fill="none" aria-hidden="true">
      <circle cx="22" cy="22" r="20" fill={stroke} fillOpacity="0.14" stroke={stroke} strokeWidth="2.2" />
      <circle cx="22" cy="22" r="14.5" fill={`url(#${gradId})`} />
      <path
        d="M15.8 22.3L19.8 26.3L28.5 17.5"
        stroke={accent === 'orange' ? '#FFFFFF' : '#04150B'}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id={gradId} x1="10" y1="8" x2="34" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor={accent === 'orange' ? '#FF8D52' : '#34FF93'} />
          <stop offset="1" stopColor={accent === 'orange' ? '#FF6321' : '#12CD67'} />
        </linearGradient>
      </defs>
    </svg>
  );
};

export const VerifiedBlueSeal: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden="true">
    <path
      d="M10 1.2L12.3 2.8L15.1 2.5L16.1 5.1L18.6 6.4L18.1 9.2L19.4 11.7L17.4 13.7L17.2 16.5L14.5 17L12.8 19.2L10 18.2L7.2 19.2L5.5 17L2.8 16.5L2.6 13.7L0.6 11.7L1.9 9.2L1.4 6.4L3.9 5.1L4.9 2.5L7.7 2.8L10 1.2Z"
      fill="#268BFF"
    />
    <path
      d="M6.6 10.3L8.9 12.6L13.6 7.8"
      stroke="#FFFFFF"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const WaveLogo: React.FC<{ className?: string }> = ({ className = 'w-12 h-12' }) => (
  <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
    <circle cx="24" cy="24" r="22" fill="url(#waveBgGrad)" />
    <ellipse cx="24" cy="25" rx="9" ry="11.2" fill="#0A1929" />
    <ellipse cx="24" cy="27" rx="5.5" ry="7.6" fill="#FFFFFF" />
    <circle cx="21.5" cy="19.2" r="1.4" fill="#FFFFFF" />
    <circle cx="26.5" cy="19.2" r="1.4" fill="#FFFFFF" />
    <circle cx="21.6" cy="19.2" r="0.6" fill="#0A1929" />
    <circle cx="26.6" cy="19.2" r="0.6" fill="#0A1929" />
    <path d="M22.2 21.2L24 23.4L25.8 21.2H22.2Z" fill="#FFB800" />
    <ellipse cx="15" cy="24.8" rx="2.4" ry="5" transform="rotate(18 15 24.8)" fill="#0A1929" />
    <ellipse cx="33" cy="24.8" rx="2.4" ry="5" transform="rotate(-18 33 24.8)" fill="#0A1929" />
    <text x="24" y="41.8" textAnchor="middle" fill="#FFFFFF" fontSize="6" fontWeight="800" fontFamily="sans-serif">
      wave
    </text>
    <defs>
      <linearGradient id="waveBgGrad" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2CD1FF" />
        <stop offset="1" stopColor="#0D9EE6" />
      </linearGradient>
    </defs>
  </svg>
);

export const MtnMomoLogo: React.FC<{ className?: string }> = ({ className = 'w-12 h-12' }) => (
  <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
    <circle cx="24" cy="24" r="22" fill="url(#mtnBgGrad)" />
    <ellipse cx="24" cy="24" rx="17" ry="10.2" fill="#004F71" stroke="#FFE14D" strokeWidth="1.5" />
    <text
      x="24"
      y="27"
      textAnchor="middle"
      fill="#FFFFFF"
      fontSize="9.5"
      fontWeight="900"
      fontFamily="sans-serif"
      letterSpacing="0.5"
    >
      MTN
    </text>
    <defs>
      <linearGradient id="mtnBgGrad" x1="10" y1="6" x2="38" y2="42" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFD92E" />
        <stop offset="1" stopColor="#F5B800" />
      </linearGradient>
    </defs>
  </svg>
);

export const OrangeMoneyLogo: React.FC<{ className?: string }> = ({ className = 'w-12 h-12' }) => (
  <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
    <rect x="3" y="3" width="42" height="42" rx="12" fill="url(#omBgGrad)" />
    <path
      d="M14 29L22 21M22 21H15M22 21V28"
      stroke="#FFFFFF"
      strokeWidth="3.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M34 19L26 27M26 27H33M26 27V20"
      stroke="#FFFFFF"
      strokeWidth="3.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <defs>
      <linearGradient id="omBgGrad" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FF7A1A" />
        <stop offset="1" stopColor="#EA580C" />
      </linearGradient>
    </defs>
  </svg>
);

export const CardPaymentLogo: React.FC<{ className?: string }> = ({ className = 'w-12 h-12' }) => (
  <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
    <rect x="4" y="10" width="32" height="22" rx="4.5" fill="#1E3A8A" />
    <rect x="10" y="16" width="34" height="22" rx="4.5" fill="url(#cardGrad)" stroke="#7DD3FC" strokeWidth="1.2" />
    <rect x="14" y="21" width="7" height="5" rx="1.2" fill="#FBBF24" />
    <rect x="14" y="30" width="12" height="2.2" rx="1.1" fill="#BAE6FD" fillOpacity="0.65" />
    <circle cx="34" cy="31" r="3.4" fill="#EF4444" fillOpacity="0.95" />
    <circle cx="38.2" cy="31" r="3.4" fill="#F59E0B" fillOpacity="0.9" />
    <defs>
      <linearGradient id="cardGrad" x1="10" y1="16" x2="44" y2="38" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2563EB" />
        <stop offset="1" stopColor="#0284C7" />
      </linearGradient>
    </defs>
  </svg>
);

export const PciDssBadgeLogo: React.FC<{ className?: string; accent?: 'green' | 'orange' }> = ({
  className = 'h-8',
  accent = 'green'
}) => (
  <div
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.06] border border-white/15 shadow-inner ${className}`}
    title="Standard sécurité PCI DSS"
  >
    <span className="text-[10px] font-black tracking-tight text-white">PCI</span>
    <span
      className={`text-[10px] font-black tracking-tight ${
        accent === 'orange' ? 'text-[#FF6321]' : 'text-[#1EEB7A]'
      }`}
    >
      DSS
    </span>
  </div>
);

export const DjassaSecurityShieldBadge: React.FC<{ className?: string; accent?: 'green' | 'orange' }> = ({
  className = 'h-8',
  accent = 'green'
}) => {
  const stroke = accent === 'orange' ? '#FF6321' : '#1EEB7A';
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl ${
        accent === 'orange'
          ? 'bg-[#FF6321]/15 border border-[#FF6321]/40 shadow-[0_0_14px_rgba(255,99,33,0.12)]'
          : 'bg-[#0E2A1A] border border-[#1EEB7A]/40 shadow-[0_0_14px_rgba(22,229,117,0.12)]'
      } ${className}`}
      title="Protection & Séquestre DJASSA"
    >
      <svg viewBox="0 0 20 22" className="w-3.5 h-3.5 shrink-0" fill="none" aria-hidden="true">
        <path
          d="M10 1.5L17.5 4.5V10.5C17.5 15.2 14.3 19.2 10 20.5C5.7 19.2 2.5 15.2 2.5 10.5V4.5L10 1.5Z"
          fill={stroke}
          fillOpacity="0.22"
          stroke={stroke}
          strokeWidth="1.7"
        />
        <path d="M7 11L9 13L13 9" stroke={stroke} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[9.5px] font-black tracking-wider text-white">DJASSA</span>
    </div>
  );
};

export const CashOnDeliveryLogo: React.FC<{ className?: string }> = ({ className = 'w-12 h-12' }) => (
  <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
    <rect x="4" y="10" width="40" height="28" rx="8" fill="url(#codBgGrad)" stroke="#6EE7B7" strokeWidth="1.4" />
    <rect x="9" y="15" width="30" height="18" rx="4" stroke="#A7F3D0" strokeOpacity="0.65" strokeWidth="1.2" strokeDasharray="3 2" />
    <circle cx="24" cy="24" r="6" fill="#064E3B" stroke="#34D399" strokeWidth="1.5" />
    <text x="24" y="26.8" textAnchor="middle" fill="#ECFDF5" fontSize="8" fontWeight="900" fontFamily="sans-serif">
      F
    </text>
    <defs>
      <linearGradient id="codBgGrad" x1="4" y1="10" x2="44" y2="38" gradientUnits="userSpaceOnUse">
        <stop stopColor="#10B981" />
        <stop offset="1" stopColor="#047857" />
      </linearGradient>
    </defs>
  </svg>
);

export const PaymentMethodBadge: React.FC<{ method: string; className?: string }> = ({
  method,
  className = 'w-12 h-12'
}) => {
  switch (method) {
    case 'wave':
      return <WaveLogo className={className} />;
    case 'orange_money':
      return <OrangeMoneyLogo className={className} />;
    case 'cash_on_delivery':
    case 'cash':
      return <CashOnDeliveryLogo className={className} />;
    case 'mtn_momo':
      return <MtnMomoLogo className={className} />;
    case 'card':
      return <CardPaymentLogo className={className} />;
    default:
      return <WaveLogo className={className} />;
  }
};

export function getPaymentMethodInfo(method: string): {
  label: string;
  subtitle: string;
  shortSubtitle: string;
} {
  switch (method) {
    case 'wave':
      return { label: 'Wave', subtitle: 'Paiement mobile rapide', shortSubtitle: 'Paiement en ligne Wave' };
    case 'orange_money':
      return { label: 'Orange Money', subtitle: 'Simple et sécurisé', shortSubtitle: 'Paiement en ligne Orange Money' };
    case 'cash_on_delivery':
    case 'cash':
      return {
        label: 'Paiement à la livraison',
        subtitle: '0% frais client • Réglé à la réception',
        shortSubtitle: 'Règlement direct au vendeur à la réception'
      };
    case 'mtn_momo':
      return { label: 'MTN MoMo', subtitle: 'Archive paiement', shortSubtitle: 'Paiement mobile' };
    case 'card':
      return { label: 'Carte Bancaire', subtitle: 'Archive paiement', shortSubtitle: 'Carte sécurisée' };
    default:
      return { label: 'Wave', subtitle: 'Paiement mobile', shortSubtitle: 'Paiement en ligne' };
  }
}
