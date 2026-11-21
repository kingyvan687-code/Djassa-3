import React, { useState, useMemo, lazy, Suspense } from 'react';
import {
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  ShieldCheck,
  Check,
  ArrowRight,
  Headphones,
  Zap,
  Star,
  Package,
  Info,
  AlertTriangle
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CartService, formatFCFA, formatMetricCount } from '../../services/marketServices';
import {
  getCheckoutPalette,
  getRealPromoPercentage,
  getVariantAvailableStock,
  resolveSellerDisplay
} from './checkout/checkoutTypes';
import {
  DjassaBagLogo,
  SummaryCalculatorIcon,
  VerificationCubeIcon,
  VerifiedBlueSeal
} from './checkout/PaymentBrandLogos';

const CheckoutModal = lazy(() =>
  import('./CheckoutModal').then((m) => ({ default: m.CheckoutModal }))
);

export const CartTab: React.FC = () => {
  const {
    cart,
    products,
    sellers,
    updateCartQuantity,
    removeFromCart,
    toggleCartItemSelected,
    setActiveTab,
    setSelectedProduct,
    setSelectedSeller
  } = useApp();

  const pal = getCheckoutPalette('client');
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [showSummaryInfo, setShowSummaryInfo] = useState(false);

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const sellersById = useMemo(() => new Map(sellers.map((s) => [s.id, s])), [sellers]);

  const cartCalculations = useMemo(
    () => CartService.calculateTotal(cart, products),
    [cart, products]
  );
  const selectedItems = useMemo(() => cart.filter((i) => i.selected), [cart]);
  const allSelected = useMemo(
    () => cart.length > 0 && selectedItems.length === cart.length,
    [cart.length, selectedItems.length]
  );

  const hasStockConflict = useMemo(
    () =>
      selectedItems.some((item) => {
        const product = productsById.get(item.productId);
        if (!product) return true;
        const avail = getVariantAvailableStock(product, item.variantSelected);
        return avail <= 0 || item.quantity > avail;
      }),
    [selectedItems, productsById]
  );

  const totalUnitsInCart = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  // Group cart items by seller in O(n)
  const groupedCart = useMemo(() => {
    const groupsMap = new Map<string, typeof cart>();
    cart.forEach((item) => {
      const product = productsById.get(item.productId);
      const sellerId = product?.sellerId || 'unknown';
      const arr = groupsMap.get(sellerId);
      if (arr) {
        arr.push(item);
      } else {
        groupsMap.set(sellerId, [item]);
      }
    });
    return Array.from(groupsMap.entries()).map(([sellerId, items]) => ({ sellerId, items }));
  }, [cart, productsById]);

  const handleToggleAllSelection = () => {
    const targetSelected = !allSelected;
    cart.forEach((item) => {
      if (Boolean(item.selected) !== targetSelected) {
        toggleCartItemSelected(item.id);
      }
    });
  };

  return (
    <div id="cart-tab" className="relative space-y-3.5 pb-6">
      {/* Subtle atmospheric glow matching the Home "Acheter" client flow */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-75"
        style={{ background: pal.pageGlow }}
      />

      <div className="relative z-10 space-y-3.5">
        {cart.length === 0 ? (
          /* ================================================================= */
          /* EMPTY CART STATE                                                  */
          /* ================================================================= */
          <div className="space-y-3.5 pt-2">
            <section className={`relative overflow-hidden ${pal.card} p-6 text-center space-y-4`}>
              <div
                className="pointer-events-none absolute left-1/2 -top-10 -translate-x-1/2 w-52 h-32 rounded-full opacity-60"
                style={{
                  background:
                    'radial-gradient(circle, rgba(255,99,33,0.24) 0%, rgba(255,99,33,0) 70%)'
                }}
              />

              <div
                className={`relative w-16 h-16 rounded-2xl ${pal.iconBox} flex items-center justify-center mx-auto`}
              >
                <DjassaBagLogo className="w-10 h-10 drop-shadow-[0_4px_12px_rgba(255,99,33,0.45)]" />
              </div>

              <div className="relative space-y-1.5">
                <h3 className="text-[17px] font-extrabold text-white tracking-tight">
                  Votre panier est vide
                </h3>
                <p className="text-xs text-white/60 max-w-xs mx-auto leading-relaxed">
                  Découvrez les produits tendances des boutiques d'Adjamé et ajoutez vos articles
                  favoris pour passer commande.
                </p>
              </div>

              <button
                id="btn-discover-products-cart"
                type="button"
                onClick={() => setActiveTab('explorer')}
                className={`relative w-full min-h-[50px] py-3.5 px-6 rounded-full ${pal.primaryBtn} font-black text-sm flex items-center justify-center gap-2 transition active:scale-[0.98]`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Explorer les produits d'Adjamé</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </section>

            {/* Reassurance Strip */}
            <div className="grid grid-cols-3 gap-2 pt-1 px-0.5">
              <div className="flex items-center gap-2">
                <span
                  className={`w-7 h-7 rounded-full ${pal.iconBox} flex items-center justify-center shrink-0`}
                >
                  <ShieldCheck className={`w-4 h-4 ${pal.accentText}`} />
                </span>
                <span className="text-[10.5px] text-white/80 leading-tight font-semibold">
                  Paiement sécurisé et fiable
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-7 h-7 rounded-full ${pal.iconBox} flex items-center justify-center shrink-0`}
                >
                  <Headphones className={`w-4 h-4 ${pal.accentText}`} />
                </span>
                <span className="text-[10.5px] text-white/80 leading-tight font-semibold">
                  Assistance 24h/7j
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-amber-500/12 border border-amber-400/35 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-amber-400 fill-amber-400/30" />
                </span>
                <span className="text-[10.5px] text-white/80 leading-tight font-semibold">
                  Livraison rapide Abidjan
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* ================================================================= */
          /* CART ITEMS & CHECKOUT SUMMARY                                     */
          /* ================================================================= */
          <>
            {/* 1. Cart Verification Header Card (matching Step 1 Verification Card) */}
            <section
              className={`relative overflow-hidden ${pal.card} p-3.5 flex items-center justify-between gap-3`}
            >
              <div
                className="pointer-events-none absolute -left-6 -top-6 w-28 h-28 rounded-full opacity-55"
                style={{
                  background:
                    'radial-gradient(circle, rgba(255,99,33,0.22) 0%, rgba(255,99,33,0) 70%)'
                }}
              />
              <div className="relative flex items-center gap-3 min-w-0">
                <div
                  className={`w-11 h-11 rounded-2xl ${pal.iconBox} flex items-center justify-center shrink-0`}
                >
                  <VerificationCubeIcon accent="orange" className="w-7 h-7" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[15.5px] font-extrabold text-white leading-tight tracking-tight truncate">
                    Vérification du panier
                  </h2>
                  <p className="text-xs text-white/60 mt-0.5 tabular-nums truncate">
                    {selectedItems.length}/{cart.length} sélectionné
                    {selectedItems.length > 1 ? 's' : ''} · {totalUnitsInCart} unité
                    {totalUnitsInCart > 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <button
                id="btn-toggle-select-all-cart"
                type="button"
                onClick={handleToggleAllSelection}
                className={`relative min-h-[36px] px-3.5 rounded-full text-[11px] font-extrabold whitespace-nowrap shrink-0 transition active:scale-95 ${
                  allSelected ? pal.secondaryBtn : pal.outlineAccentBtn
                }`}
              >
                {allSelected ? 'Tout décocher' : 'Tout cocher'}
              </button>
            </section>

            {/* 2. Seller-grouped Product Cards */}
            <div className="space-y-3.5">
              {groupedCart.map((group) => {
                const seller = sellersById.get(group.sellerId);
                const sellerDisplay = resolveSellerDisplay(seller, 'Boutique Adjamé');
                const groupSelectedCount = group.items.filter((i) => i.selected).length;

                return (
                  <section key={group.sellerId} className={`${pal.card} p-3.5 space-y-3`}>
                    {/* Seller Verification Row (matching Step 1 Seller Verification Card) */}
                    <button
                      type="button"
                      onClick={() => {
                        if (seller) setSelectedSeller(seller);
                      }}
                      className="w-full flex items-center justify-between gap-3 pb-3 border-b border-white/[0.08] text-left group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {sellerDisplay.avatar ? (
                          <img
                            src={sellerDisplay.avatar}
                            alt={sellerDisplay.name}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-full object-cover border-2 border-white/15 bg-[#1B1F1D] shadow-md shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2B66FF] to-[#133EC9] border border-white/20 text-white font-black text-xs flex items-center justify-center shadow-[0_4px_14px_rgba(37,99,235,0.35)] shrink-0">
                            {sellerDisplay.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-extrabold text-white truncate group-hover:text-[#FF6321] transition-colors">
                              {sellerDisplay.name}
                            </span>
                            {sellerDisplay.verified && (
                              <VerifiedBlueSeal className="w-4 h-4 shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-white/55 truncate mt-0.5">
                            {sellerDisplay.verified ? 'Vendeur vérifié' : 'Boutique'} ·{' '}
                            {sellerDisplay.location}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {sellerDisplay.rating > 0 && (
                          <div className="flex items-center justify-end gap-1 text-xs font-black text-white tabular-nums">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.4)]" />
                            <span>{sellerDisplay.rating.toFixed(1)}</span>
                          </div>
                        )}
                        <p className="text-[10.5px] text-white/50 tabular-nums mt-0.5">
                          {sellerDisplay.salesCount > 0
                            ? `${formatMetricCount(sellerDisplay.salesCount)} ventes`
                            : `${groupSelectedCount}/${group.items.length} article${
                                group.items.length > 1 ? 's' : ''
                              }`}
                        </p>
                      </div>
                    </button>

                    {/* Cart Items inside Seller Card */}
                    <div className="space-y-2.5">
                      {group.items.map((item) => {
                        const product = productsById.get(item.productId);
                        if (!product) return null;

                        const availStock = getVariantAvailableStock(product, item.variantSelected);
                        const isOutOfStock = availStock <= 0;
                        const exceedsStock = item.quantity > availStock;
                        const promoPct = getRealPromoPercentage(product);
                        const thumbUrl = product.images?.[0] || product.videoPoster || '';
                        const variantText = Object.entries(item.variantSelected)
                          .filter(([, v]) => Boolean(v))
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ');

                        return (
                          <div
                            key={item.id}
                            className={`p-2.5 rounded-2xl transition flex gap-3 items-start ${
                              isOutOfStock
                                ? 'bg-rose-950/20 border border-rose-500/30 opacity-80'
                                : item.selected
                                ? `${pal.innerWell} border-[#FF6321]/35`
                                : `${pal.innerWell} opacity-75`
                            }`}
                          >
                            {/* Selection Checkbox + Thumbnail */}
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                id={`btn-select-cart-item-${item.id}`}
                                type="button"
                                aria-label={
                                  item.selected ? 'Désélectionner article' : 'Sélectionner article'
                                }
                                onClick={() => toggleCartItemSelected(item.id)}
                                className={`w-6 h-6 rounded-full flex items-center justify-center transition shrink-0 ${
                                  item.selected
                                    ? pal.selectedCheckInline
                                    : 'border border-white/25 bg-white/5 hover:border-white/45'
                                }`}
                              >
                                {item.selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </button>

                              <button
                                type="button"
                                onClick={() => setSelectedProduct(product)}
                                className={`relative w-[84px] h-[90px] rounded-2xl overflow-hidden ${pal.thumbFrame} shrink-0 text-left group`}
                              >
                                {thumbUrl ? (
                                  <img
                                    src={thumbUrl}
                                    alt={product.name}
                                    loading="lazy"
                                    decoding="async"
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-white/30">
                                    <Package className="w-6 h-6" />
                                  </div>
                                )}
                                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                                {promoPct > 0 && (
                                  <span
                                    className={`absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-black tabular-nums ${pal.promoBadge}`}
                                  >
                                    -{promoPct}%
                                  </span>
                                )}
                              </button>
                            </div>

                            {/* Product Info + Stepper Controls */}
                            <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 space-y-0.5">
                                  <h4
                                    onClick={() => setSelectedProduct(product)}
                                    className="text-[13.5px] font-extrabold text-white leading-snug line-clamp-2 cursor-pointer hover:text-[#FF6321] transition-colors"
                                  >
                                    {product.name}
                                  </h4>
                                  {variantText && (
                                    <p className={`text-[11px] font-medium ${pal.accentText} truncate`}>
                                      {variantText}
                                    </p>
                                  )}
                                </div>

                                <button
                                  id={`btn-remove-cart-${item.id}`}
                                  type="button"
                                  aria-label="Retirer du panier"
                                  onClick={() => removeFromCart(item.id)}
                                  className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-rose-500/15 border border-white/[0.08] hover:border-rose-500/35 text-white/45 hover:text-rose-400 flex items-center justify-center transition shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {/* Stock Status */}
                              {isOutOfStock ? (
                                <p className="text-[10.5px] font-bold text-rose-400 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  <span>Rupture de stock</span>
                                </p>
                              ) : exceedsStock ? (
                                <p className="text-[10.5px] font-bold text-amber-400 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  <span>Stock disponible : {availStock} max</span>
                                </p>
                              ) : (
                                <div className="flex items-center gap-1.5 text-[10.5px]">
                                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                    <Check className="w-2.5 h-2.5 stroke-[3.2]" />
                                  </span>
                                  <span className="font-bold text-emerald-400">En stock</span>
                                  <span className="text-white/45 tabular-nums">
                                    · {availStock} disp.
                                  </span>
                                </div>
                              )}

                              {/* Price + Tactile Quantity Well */}
                              <div className="flex items-center justify-between gap-2 pt-0.5">
                                <div className="min-w-0">
                                  <div className="text-[15px] font-black text-white tabular-nums leading-none">
                                    {formatFCFA(product.price * item.quantity)}
                                  </div>
                                  {item.quantity > 1 ? (
                                    <div className="text-[10px] text-white/45 tabular-nums mt-0.5">
                                      {formatFCFA(product.price)} / u
                                    </div>
                                  ) : product.originalPrice &&
                                    product.originalPrice > product.price ? (
                                    <div className="text-[10.5px] text-white/40 line-through tabular-nums mt-0.5">
                                      {formatFCFA(product.originalPrice)}
                                    </div>
                                  ) : null}
                                </div>

                                <div
                                  className={`flex items-center gap-1 ${pal.qtyWell} rounded-xl p-0.5 shrink-0`}
                                >
                                  <button
                                    type="button"
                                    aria-label="Diminuer la quantité"
                                    onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                                    className={`w-7 h-7 rounded-lg ${pal.qtyBtn} flex items-center justify-center text-white transition active:scale-95`}
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="w-6 text-center text-xs font-black text-white tabular-nums">
                                    {item.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label="Augmenter la quantité"
                                    disabled={isOutOfStock || item.quantity >= availStock}
                                    onClick={() =>
                                      updateCartQuantity(
                                        item.id,
                                        Math.min(availStock, item.quantity + 1)
                                      )
                                    }
                                    className={`w-7 h-7 rounded-lg ${pal.qtyBtn} disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition active:scale-95`}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>

            {/* 3. Order Summary Card (matching Step 1 Récapitulatif Card) */}
            <section className={`${pal.card} p-4 space-y-3`}>
              <div className="flex items-center justify-between gap-2 pb-1">
                <div className="flex items-center gap-2.5">
                  <SummaryCalculatorIcon accent="orange" className="w-6 h-6 shrink-0" />
                  <h3 className="text-[15.5px] font-extrabold text-white tracking-tight">
                    Récapitulatif
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-white/55 tabular-nums">
                  {selectedItems.length} ligne{selectedItems.length > 1 ? 's' : ''} sélectionnée
                  {selectedItems.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-2 text-[13px]">
                <div className="flex items-center justify-between text-white/70">
                  <span>
                    Articles sélectionnés ({cartCalculations.itemCount})
                  </span>
                  <span className="font-extrabold text-white tabular-nums">
                    {formatFCFA(cartCalculations.subtotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-white/70">
                  <button
                    type="button"
                    onClick={() => setShowSummaryInfo((v) => !v)}
                    className="flex items-center gap-1.5 hover:text-white transition"
                  >
                    <span>Livraison (gérée par la boutique)</span>
                    <Info className="w-3.5 h-3.5 text-white/45" />
                  </button>
                  <span className="font-extrabold text-emerald-400 tabular-nums">
                    0 FCFA
                  </span>
                </div>

                <div className="flex items-center justify-between text-white/70">
                  <span>Frais de paiement client</span>
                  <span className="text-[11px] font-bold text-white/75">
                    6,5% en ligne · 0% à la livraison
                  </span>
                </div>

                {showSummaryInfo && (
                  <p className="text-[11px] text-white/65 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 leading-relaxed">
                    Chaque vendeur organise sa livraison directement à l’extérieur de DJASSA (0 FCFA
                    de frais de livraison facturés par DJASSA). Vous choisirez à l’étape suivante
                    entre <strong>Paiement en ligne</strong> (+6,5% Wave / Orange Money) et{' '}
                    <strong>Paiement à la livraison</strong> (0% de frais).
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-white/[0.09] flex items-center justify-between">
                <span className="text-[15px] font-extrabold text-white">Sous-total articles</span>
                <span className={`text-xl font-black ${pal.accentText} tabular-nums`}>
                  {formatFCFA(cartCalculations.total)}
                </span>
              </div>

              {hasStockConflict && selectedItems.length > 0 && (
                <div className="p-2.5 rounded-xl bg-rose-500/12 border border-rose-500/35 text-[11px] text-rose-300 font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>
                    Ajustez ou retirez les articles en rupture ou dépassant le stock disponible avant
                    de commander.
                  </span>
                </div>
              )}
            </section>

            {/* 4. Reassurance Strip (matching Step 1 Reassurance Strip) */}
            <div className="grid grid-cols-3 gap-2 pt-0.5 px-0.5">
              <div className="flex items-center gap-2">
                <span
                  className={`w-7 h-7 rounded-full ${pal.iconBox} flex items-center justify-center shrink-0`}
                >
                  <ShieldCheck className={`w-4 h-4 ${pal.accentText}`} />
                </span>
                <span className="text-[10.5px] text-white/80 leading-tight font-semibold">
                  Paiement sécurisé et fiable
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-7 h-7 rounded-full ${pal.iconBox} flex items-center justify-center shrink-0`}
                >
                  <Headphones className={`w-4 h-4 ${pal.accentText}`} />
                </span>
                <span className="text-[10.5px] text-white/80 leading-tight font-semibold">
                  Assistance 24h/7j
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-amber-500/12 border border-amber-400/35 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4 text-amber-400 fill-amber-400/30" />
                </span>
                <span className="text-[10.5px] text-white/80 leading-tight font-semibold">
                  Livraison rapide Abidjan
                </span>
              </div>
            </div>

            {/* 5. Bottom Primary CTA (matching Step 1 Bottom CTA) */}
            <div className="pt-0.5">
              <button
                id="btn-open-checkout-modal"
                type="button"
                aria-label={hasStockConflict ? 'Passer la commande — Stock insuffisant pour continuer' : undefined}
                disabled={selectedItems.length === 0 || hasStockConflict}
                onClick={() => setIsCheckoutOpen(true)}
                className={`w-full min-h-[54px] py-3.5 px-6 rounded-full ${pal.primaryBtn} disabled:from-white/10 disabled:via-white/10 disabled:to-white/10 disabled:bg-white/10 disabled:text-white/35 font-black text-[15px] flex items-center justify-center gap-2 disabled:shadow-none transition active:scale-[0.98]`}
              >
                <span>
                  {selectedItems.length === 0
                    ? 'Sélectionnez un article pour commander'
                    : hasStockConflict
                    ? 'Stock insuffisant pour continuer'
                    : `Passer la commande (${formatFCFA(cartCalculations.total)})`}
                </span>
                {selectedItems.length > 0 && !hasStockConflict && (
                  <ArrowRight className="w-5 h-5 stroke-[2.6]" />
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {isCheckoutOpen && (
        <Suspense fallback={null}>
          <CheckoutModal onClose={() => setIsCheckoutOpen(false)} />
        </Suspense>
      )}
    </div>
  );
};
