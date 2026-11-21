import React from 'react';
import { ChevronLeft, ShoppingCart, Check } from 'lucide-react';
import { CheckoutStep, CheckoutTheme, getCheckoutPalette } from './checkoutTypes';
import { DjassaBagLogo } from './PaymentBrandLogos';

interface CheckoutHeaderStepperProps {
  currentStep: CheckoutStep;
  maxReachedStep: CheckoutStep;
  cartCount: number;
  onBack: () => void;
  onSelectStep: (step: CheckoutStep) => void;
  onOpenCart?: () => void;
  showStepper?: boolean;
  theme?: CheckoutTheme;
  fullWidth?: boolean;
}

const STEPS: Array<{ step: CheckoutStep; label: string }> = [
  { step: 1, label: 'Produit' },
  { step: 2, label: 'Livraison' },
  { step: 3, label: 'Paiement' },
  { step: 4, label: 'Validation' }
];

export const CheckoutHeaderStepper: React.FC<CheckoutHeaderStepperProps> = ({
  currentStep,
  maxReachedStep,
  cartCount,
  onBack,
  onSelectStep,
  onOpenCart,
  showStepper = true,
  theme = 'neon',
  fullWidth = false
}) => {
  const pal = getCheckoutPalette(theme);

  return (
    <header className={`sticky top-0 z-30 ${pal.headerBg} shrink-0`}>
      {/* Subtle top atmospheric glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-80"
        style={{
          background: pal.headerGlow
        }}
      />

      <div
        className={`relative ${
          fullWidth ? 'w-full' : 'max-w-lg mx-auto'
        } px-4 pt-3 pb-3.5 space-y-3.5`}
      >
        {/* Top Row: Back Button | DJASSA Brand | Cart Badge */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Retour"
            className={`w-11 h-11 rounded-full ${pal.headerIconBtn} flex items-center justify-center text-white transition active:scale-95 shrink-0`}
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.4]" />
          </button>

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-full bg-[#FF6321]/30 blur-md" />
              <DjassaBagLogo className="relative w-10 h-10 drop-shadow-[0_4px_12px_rgba(255,99,33,0.45)]" />
            </div>
            <div className="min-w-0">
              <div className="text-[20px] font-black tracking-wide text-white leading-none">
                DJASSA
              </div>
              <div className="text-[10.5px] font-medium text-white/65 leading-tight mt-0.5 truncate">
                Marketplace sociale ivoirienne
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenCart}
            aria-label={`Panier (${cartCount})`}
            className={`relative w-11 h-11 rounded-full ${pal.headerIconBtn} flex items-center justify-center text-white/95 transition active:scale-95 shrink-0`}
          >
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span
                className={`absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full ${pal.cartBadge} text-white text-[10px] font-black flex items-center justify-center tabular-nums`}
              >
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </button>
        </div>

        {/* 4-Step Progress Bar */}
        {showStepper && (
          <nav aria-label="Étapes de commande" className="relative pt-0.5 px-1">
            {/* Background track behind step bubbles */}
            <div className="absolute top-[17px] left-[12.5%] right-[12.5%] h-[3px] bg-white/[0.1] rounded-full" />
            {/* Completed progress fill */}
            <div
              className={`absolute top-[17px] left-[12.5%] h-[3px] ${pal.stepperFill} rounded-full transition-all duration-300`}
              style={{
                width: `${((currentStep - 1) / 3) * 75}%`
              }}
            />

            <div className="relative grid grid-cols-4 gap-1">
              {STEPS.map(({ step, label }) => {
                const isCompleted = step < currentStep;
                const isActive = step === currentStep;
                const isClickable = step <= maxReachedStep && step !== currentStep;

                return (
                  <button
                    key={step}
                    type="button"
                    disabled={!isClickable}
                    onClick={() => isClickable && onSelectStep(step)}
                    className={`flex flex-col items-center gap-1.5 group focus:outline-none ${
                      isClickable ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black tabular-nums transition-all duration-200 ${
                        isActive
                          ? pal.stepperActive
                          : isCompleted
                          ? pal.stepperCompleted
                          : pal.stepperPending
                      }`}
                    >
                      {isCompleted ? <Check className="w-4 h-4 stroke-[3.2]" /> : step}
                    </div>
                    <span
                      className={`text-[11px] tracking-tight transition-colors ${
                        isActive
                          ? 'text-white font-extrabold'
                          : isCompleted
                          ? 'text-white/90 font-semibold'
                          : 'text-white/45 font-medium'
                      }`}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};
