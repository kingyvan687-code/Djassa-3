import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { Order, Product } from '../../../types';
import { CheckoutHeaderStepper } from './CheckoutHeaderStepper';
import { Step1ProductVerification } from './Step1ProductVerification';
import { Step2DeliveryAddress } from './Step2DeliveryAddress';
import { Step3PaymentMethod } from './Step3PaymentMethod';
import { Step4OrderValidation } from './Step4OrderValidation';
import { OrderResultScreen } from './OrderResultScreen';
import { commerceService } from '../../../services/commerceService';
import {
  AppliedPromoState,
  CheckoutLineItem,
  CheckoutStep,
  CheckoutTheme,
  DeliveryAddressForm,
  OrderSubmissionResult,
  PaymentMethodType,
  PaymentModeType,
  getCheckoutPalette,
  getVariantAvailableStock,
  isDeliveryAddressValid
} from './checkoutTypes';

interface DjassaOrderFlowProps {
  mode: 'direct' | 'cart';
  initialProduct?: Product;
  onClose: () => void;
  onOpenCart?: () => void;
}

const EMPTY_ADDRESS_FORM: DeliveryAddressForm = {
  recipientName: '',
  phone: '',
  commune: '',
  quartier: '',
  details: '',
  landmark: '',
  deliveryInstructions: '',
  gpsCoords: undefined
};

export const DjassaOrderFlow: React.FC<DjassaOrderFlowProps> = ({
  mode,
  initialProduct,
  onClose,
  onOpenCart
}) => {
  const {
    cart,
    products,
    sellers,
    userProfile,
    createOrder,
    createMultiSellerOrders,
    addToCart,
    updateCartQuantity,
    setSelectedOrder,
    setActiveTab,
    showToast
  } = useApp();

  // Direct purchase item state (single product with customizable variants & qty, preferring in-stock options)
  const [directVariantSelected, setDirectVariantSelected] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (initialProduct?.variants) {
      for (const group of initialProduct.variants) {
        if (group.options && group.options.length > 0) {
          initial[group.type] = group.options[0];
        }
      }
      if (getVariantAvailableStock(initialProduct, initial) <= 0) {
        for (const group of initialProduct.variants) {
          const firstInStockOpt = (group.options || []).find(
            (opt) => getVariantAvailableStock(initialProduct, { ...initial, [group.type]: opt }) > 0
          );
          if (firstInStockOpt) {
            initial[group.type] = firstInStockOpt;
            if (getVariantAvailableStock(initialProduct, initial) > 0) break;
          }
        }
      }
    }
    return initial;
  });
  const [directQuantity, setDirectQuantity] = useState<number>(1);

  const liveDirectProduct = useMemo(() => {
    if (!initialProduct) return undefined;
    return products.find((p) => p.id === initialProduct.id) || initialProduct;
  }, [products, initialProduct]);

  const lineItems: CheckoutLineItem[] = useMemo(() => {
    if (mode === 'direct' && liveDirectProduct) {
      return [
        {
          product: liveDirectProduct,
          variantSelected: directVariantSelected,
          quantity: directQuantity
        }
      ];
    }
    return cart
      .filter((c) => c.selected)
      .map((c) => {
        const prod = products.find((p) => p.id === c.productId);
        if (!prod) return null;
        return {
          cartItemId: c.id,
          product: prod,
          variantSelected: c.variantSelected || {},
          quantity: c.quantity
        } as CheckoutLineItem;
      })
      .filter((x): x is CheckoutLineItem => x !== null);
  }, [mode, liveDirectProduct, directVariantSelected, directQuantity, cart, products]);

  const primarySeller = useMemo(() => {
    const sid = lineItems[0]?.product.sellerId;
    return sid ? sellers.find((s) => s.id === sid) : undefined;
  }, [lineItems, sellers]);

  const sellerIdsInFlow = useMemo(
    () => Array.from(new Set(lineItems.map((it) => it.product.sellerId))),
    [lineItems]
  );

  // Stepper navigation state
  const [currentStep, setCurrentStep] = useState<CheckoutStep>(1);
  const [maxReachedStep, setMaxReachedStep] = useState<CheckoutStep>(1);

  // Step 2: Delivery form (starts EMPTY — client enters or loads saved address)
  const [addressForm, setAddressForm] = useState<DeliveryAddressForm>(EMPTY_ADDRESS_FORM);

  // Step 3: Payment mode & method (NEVER preselected — explicit user choice required)
  const [paymentMode, setPaymentMode] = useState<PaymentModeType | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType | null>(null);
  const [payerPhone, setPayerPhone] = useState<string>('');
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromoState | null>(null);

  // Step 4: Submission + double-submit protection
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [orderResult, setOrderResult] = useState<OrderSubmissionResult | null>(null);
  const idempotencyKeyRef = useRef<string>(
    `djassa-ord-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollContainerRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' });
  }, [currentStep, orderResult]);

  const subtotal = useMemo(
    () => lineItems.reduce((sum, it) => sum + it.product.price * it.quantity, 0),
    [lineItems]
  );
  const totalQuantity = useMemo(
    () => lineItems.reduce((sum, it) => sum + it.quantity, 0),
    [lineItems]
  );

  useEffect(() => {
    if (!appliedPromo?.code) return;
    let cancelled = false;
    commerceService
      .validatePromoCode(appliedPromo.code, subtotal)
      .then((res) => {
        if (cancelled) return;
        if (res.valid) {
          if (res.discountFcfa !== appliedPromo.discountFcfa) {
            setAppliedPromo({
              code: res.code,
              discountFcfa: res.discountFcfa,
              label: res.label
            });
          }
        } else {
          setAppliedPromo(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAppliedPromo(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [subtotal, appliedPromo?.code]);

  const cartBadgeCount = useMemo(
    () => cart.reduce((sum, c) => sum + (c.quantity || 1), 0),
    [cart]
  );

  const goToStep = (next: CheckoutStep) => {
    setCurrentStep(next);
    setMaxReachedStep((prev) => (next > prev ? next : prev));
  };

  // Handlers for Step 1
  const handleUpdateVariant = (_index: number, type: string, option: string) => {
    if (mode !== 'direct' || !liveDirectProduct) return;
    setDirectVariantSelected((prev) => {
      const next = { ...prev, [type]: option };
      const avail = getVariantAvailableStock(liveDirectProduct, next);
      if (avail > 0 && directQuantity > avail) {
        setDirectQuantity(avail);
      }
      return next;
    });
  };

  const handleUpdateQuantity = (index: number, nextQuantity: number) => {
    const target = lineItems[index];
    if (!target) return;
    const maxAvail = getVariantAvailableStock(target.product, target.variantSelected);
    const clamped = Math.max(1, Math.min(Math.max(1, maxAvail), nextQuantity));
    if (mode === 'direct') {
      setDirectQuantity(clamped);
    } else if (target.cartItemId) {
      updateCartQuantity(target.cartItemId, clamped);
    }
  };

  const handleAddToCartDirect = () => {
    if (!liveDirectProduct) return;
    addToCart(liveDirectProduct.id, directVariantSelected, directQuantity);
    showToast(`${directQuantity}x "${liveDirectProduct.name}" ajouté au panier`);
  };

  const handleStep1Continue = () => {
    goToStep(2);
  };

  const handleStep2Continue = () => {
    if (!isDeliveryAddressValid(addressForm)) {
      return;
    }
    goToStep(3);
  };

  const isPaymentSelectionComplete =
    (paymentMode === 'cod' && paymentMethod === 'cash_on_delivery') ||
    (paymentMode === 'online' &&
      (paymentMethod === 'wave' || paymentMethod === 'orange_money'));

  const handleStep3Continue = () => {
    if (!isPaymentSelectionComplete) return;
    goToStep(4);
  };

  const handleConfirmOrder = async () => {
    if (isSubmitting || !paymentMode || !paymentMethod || !isPaymentSelectionComplete) return;

    setSubmitError('');
    setIsSubmitting(true);

    const formattedAddress = {
      recipientName: addressForm.recipientName.trim(),
      phone: addressForm.phone.trim(),
      commune: addressForm.commune,
      quartier: addressForm.quartier.trim(),
      details: addressForm.details.trim(),
      ...(addressForm.landmark.trim() ? { landmark: addressForm.landmark.trim() } : {}),
      ...(addressForm.deliveryInstructions.trim()
        ? { deliveryInstructions: addressForm.deliveryInstructions.trim() }
        : {}),
      ...(addressForm.gpsCoords ? { gpsCoords: addressForm.gpsCoords } : {})
    };

    try {
      const normalizedMethod: 'wave' | 'orange_money' | 'cash_on_delivery' =
        paymentMode === 'cod'
          ? 'cash_on_delivery'
          : paymentMethod === 'orange_money'
          ? 'orange_money'
          : 'wave';

      if (sellerIdsInFlow.length > 1 && typeof createMultiSellerOrders === 'function') {
        const multiRes = await createMultiSellerOrders(
          lineItems.map((it) => ({
            product: it.product,
            variantSelected: it.variantSelected,
            quantity: it.quantity
          })),
          normalizedMethod,
          formattedAddress,
          {
            paymentMode,
            ...(paymentMode === 'online' && payerPhone.trim()
              ? { payerPhone: payerPhone.trim() }
              : {}),
            ...(appliedPromo?.code ? { promoCode: appliedPromo.code } : {}),
            idempotencyKey: idempotencyKeyRef.current
          }
        );
        const primaryOrder = multiRes.orders[0];
        setOrderResult({
          order: primaryOrder,
          orders: multiRes.orders,
          checkoutGroupId: multiRes.checkoutGroupId,
          totalAmountFcfa: multiRes.totalAmountFcfa,
          providerConfigured: multiRes.providerConfigured,
          paymentUrl: multiRes.paymentUrl ?? multiRes.checkoutUrl ?? null
        });
      } else {
        const createdOrder = await createOrder(
          lineItems.map((it) => ({
            product: it.product,
            variantSelected: it.variantSelected,
            quantity: it.quantity
          })),
          normalizedMethod,
          formattedAddress,
          {
            paymentMode,
            ...(paymentMode === 'online' && payerPhone.trim()
              ? { payerPhone: payerPhone.trim() }
              : {}),
            ...(appliedPromo?.code ? { promoCode: appliedPromo.code } : {}),
            idempotencyKey: idempotencyKeyRef.current
          }
        );

        setOrderResult({
          order: createdOrder,
          providerConfigured: Boolean(createdOrder.providerConfigured ?? createdOrder.paymentStatus === 'paid'),
          paymentUrl: createdOrder.paymentUrl ?? createdOrder.checkoutUrl ?? null
        });
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Une erreur est survenue lors de l’enregistrement de la commande.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHeaderBack = () => {
    if (orderResult) {
      onClose();
      return;
    }
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev > 1 ? ((prev - 1) as CheckoutStep) : 1));
    } else {
      onClose();
    }
  };

  const handleCartShortcut = () => {
    if (onOpenCart) {
      onOpenCart();
      return;
    }
    setActiveTab('achats');
    onClose();
  };

  const handleTrackOrder = (ord: Order) => {
    setSelectedOrder(ord);
    setActiveTab('achats');
    onClose();
  };

  const activeTheme: CheckoutTheme = mode === 'direct' ? 'client' : 'neon';
  const isFullWidth = mode === 'direct';
  const pal = getCheckoutPalette(activeTheme);

  return (
    <div
      id={mode === 'cart' ? 'checkout-page-overlay' : 'direct-buy-modal-overlay'}
      className={`fixed inset-0 z-[70] ${pal.pageBg} text-white flex flex-col overflow-hidden`}
    >
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: pal.pageGlow }}
      />

      <div className="relative z-10 flex flex-col flex-1 min-h-0">
        <CheckoutHeaderStepper
          currentStep={currentStep}
          maxReachedStep={maxReachedStep}
          cartCount={cartBadgeCount}
          showStepper={!orderResult}
          onBack={handleHeaderBack}
          onSelectStep={(step) => setCurrentStep(step)}
          onOpenCart={handleCartShortcut}
          theme={activeTheme}
          fullWidth={isFullWidth}
        />

        <main ref={scrollContainerRef} className="flex-1 overflow-y-auto no-scrollbar">
          <div className={`${isFullWidth ? 'w-full' : 'max-w-lg mx-auto'} px-4 pt-4 pb-8`}>
            {orderResult ? (
              <OrderResultScreen
                order={orderResult.order}
                orders={orderResult.orders}
                seller={primarySeller}
                checkoutGroupId={orderResult.checkoutGroupId}
                totalAmountFcfa={orderResult.totalAmountFcfa}
                providerConfigured={orderResult.providerConfigured}
                paymentUrl={orderResult.paymentUrl}
                onOrderUpdated={(updated) =>
                  setOrderResult((prev) => (prev ? { ...prev, order: updated } : prev))
                }
                onTrackOrder={handleTrackOrder}
                onClose={onClose}
                theme={activeTheme}
              />
            ) : currentStep === 1 ? (
              <div className="space-y-3">
                {sellerIdsInFlow.length > 1 && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/12 border border-emerald-500/35 text-xs text-emerald-200 leading-relaxed shadow-lg">
                    Panier multi-boutiques : <strong>{sellerIdsInFlow.length} commandes distinctes</strong> seront créées et suivies séparément.
                  </div>
                )}
                <Step1ProductVerification
                  mode={mode}
                  items={lineItems}
                  seller={primarySeller}
                  onUpdateVariant={mode === 'direct' ? handleUpdateVariant : undefined}
                  onUpdateQuantity={handleUpdateQuantity}
                  onAddToCart={mode === 'direct' ? handleAddToCartDirect : undefined}
                  onContinue={handleStep1Continue}
                  theme={activeTheme}
                />
              </div>
            ) : currentStep === 2 ? (
              <Step2DeliveryAddress
                form={addressForm}
                onChangeForm={(patch) => setAddressForm((prev) => ({ ...prev, ...patch }))}
                userProfile={userProfile}
                seller={primarySeller}
                sellerCount={Math.max(1, sellerIdsInFlow.length)}
                subtotal={subtotal}
                totalQuantity={totalQuantity}
                onBack={() => setCurrentStep(1)}
                onContinue={handleStep2Continue}
                theme={activeTheme}
              />
            ) : currentStep === 3 ? (
              <Step3PaymentMethod
                paymentMode={paymentMode}
                paymentMethod={paymentMethod}
                payerPhone={payerPhone}
                onChangePayerPhone={setPayerPhone}
                onSelectPaymentChoice={(m, meth) => {
                  setPaymentMode(m);
                  setPaymentMethod(meth);
                }}
                subtotal={subtotal}
                totalQuantity={totalQuantity}
                appliedPromo={appliedPromo}
                onApplyPromo={(promo) => setAppliedPromo(promo)}
                onRemovePromo={() => setAppliedPromo(null)}
                onBack={() => setCurrentStep(2)}
                onContinue={handleStep3Continue}
                theme={activeTheme}
              />
            ) : isPaymentSelectionComplete && paymentMode && paymentMethod ? (
              <Step4OrderValidation
                items={lineItems}
                seller={primarySeller}
                address={addressForm}
                sellerCount={Math.max(1, sellerIdsInFlow.length)}
                paymentMode={paymentMode}
                paymentMethod={paymentMethod}
                payerPhone={payerPhone}
                appliedPromo={appliedPromo}
                isSubmitting={isSubmitting}
                submitError={submitError}
                onEditAddress={() => setCurrentStep(2)}
                onEditPayment={() => setCurrentStep(3)}
                onBack={() => setCurrentStep(3)}
                onConfirmOrder={handleConfirmOrder}
                theme={activeTheme}
              />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
};
