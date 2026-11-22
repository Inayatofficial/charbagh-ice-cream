import React from 'react';
import { Banknote, CreditCard, Minus, Plus, Printer, ShoppingBag, Smartphone, Trash2, UtensilsCrossed } from 'lucide-react';
import { CartItem, Language, OrderType, PaymentMethod } from '../types';
import { UI_COPY } from '../data/initialData';

interface CartSidebarProps {
  cart: CartItem[];
  language: Language;
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  taxRatePercent: number;
  discountPercent: number;
  onChangeOrderType: (type: OrderType) => void;
  onChangePaymentMethod: (method: PaymentMethod) => void;
  onChangeDiscountPercent: (pct: number) => void;
  onUpdateQuantity: (cartLineId: string, delta: number) => void;
  onRemoveItem: (cartLineId: string) => void;
  onClearCart: () => void;
  onConfirmOrder: () => void;
  isSubmitting: boolean;
}

export const CartSidebar: React.FC<CartSidebarProps> = ({
  cart,
  language,
  orderType,
  paymentMethod,
  taxRatePercent,
  discountPercent,
  onChangeOrderType,
  onChangePaymentMethod,
  onChangeDiscountPercent,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onConfirmOrder,
  isSubmitting,
}) => {
  const copy = UI_COPY[language];
  const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
  const discountAmount = Math.round((subtotal * discountPercent) / 100);
  const taxableBase = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.round((taxableBase * taxRatePercent) / 100);
  const grandTotal = taxableBase + taxAmount;
  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-3xl border border-[#211a15]/10 bg-white shadow-[0_8px_28px_-4px_rgba(41,34,29,0.08)]">
      {/* Cart Header */}
      <div className="flex items-center justify-between border-b border-[#dbc2b0]/60 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <ShoppingBag className="h-5 w-5 text-[#8d4b00]" />
          <h2 className="font-display text-lg font-extrabold text-[#211a15]">
            {copy.yourOrder}
          </h2>
          {totalQty > 0 && (
            <span className="tabular-nums text-sm font-bold text-[#8d4b00]">
              · {totalQty} {copy.itemsCount}
            </span>
          )}
        </div>
        {cart.length > 0 && (
          <button
            type="button"
            onClick={onClearCart}
            className="min-h-[40px] cursor-pointer rounded-lg px-2.5 text-xs font-bold text-[#ba1a1a] transition-colors hover:bg-[#ffdad6]/50"
          >
            {copy.clearCart}
          </button>
        )}
      </div>

      {/* Order Type Toggle: Dine-in / Takeaway */}
      <div className="border-b border-[#dbc2b0]/50 px-5 py-3">
        <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[#f3e6dd] p-1">
          {(['Dine-in', 'Takeaway'] as const).map((type) => {
            const active = orderType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => onChangeOrderType(type)}
                className={`flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                  active
                    ? 'bg-white text-[#211a15] shadow-sm'
                    : 'text-[#554336] hover:text-[#211a15]'
                }`}
              >
                <UtensilsCrossed className="h-4 w-4" />
                {type === 'Dine-in' ? copy.dineIn : copy.takeaway}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cart Items Scroll Area */}
      <div className="kiosk-scroll flex-1 overflow-y-auto px-5 py-4">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#f9ebe3] text-[#8d4b00]">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <p className="font-display text-base font-bold text-[#211a15]">{copy.emptyCartTitle}</p>
            <p className="mt-1 max-w-[24ch] text-sm text-[#554336]">{copy.emptyCartSub}</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#dbc2b0]/50">
            {cart.map((line) => (
              <li key={line.cartLineId} className="py-3.5 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-sm font-bold text-[#211a15]">
                      {language === 'ur' && line.nameUrdu ? line.nameUrdu : line.name}
                    </div>
                    <div className="mt-0.5 text-xs text-[#554336]">
                      {line.size} · {line.vessel.name}
                      {line.secondFlavor ? ` · +${line.secondFlavor}` : ''}
                    </div>
                    {line.toppings.length > 0 && (
                      <div className="mt-0.5 text-xs text-[#2d6a4f]">
                        + {line.toppings.map((t) => t.name).join(', ')}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveItem(line.cartLineId)}
                    aria-label={`Remove ${line.name}`}
                    className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#887364] hover:bg-[#ffdad6]/50 hover:text-[#ba1a1a]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(line.cartLineId, -1)}
                      aria-label="Decrease item quantity"
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#dbc2b0] bg-[#fff8f5] text-[#211a15] active:scale-95"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="tabular-nums w-7 text-center text-sm font-bold text-[#211a15]">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(line.cartLineId, 1)}
                      aria-label="Increase item quantity"
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-[#dbc2b0] bg-[#fff8f5] text-[#211a15] active:scale-95"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="tabular-nums text-right">
                    <div className="text-sm font-extrabold text-[#211a15]">
                      PKR {line.lineTotal.toLocaleString()}
                    </div>
                    {line.quantity > 1 && (
                      <div className="text-[11px] text-[#554336]">
                        PKR {line.unitPrice.toLocaleString()} ea
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Payment, Totals & Confirm */}
      <div className="border-t border-[#dbc2b0]/70 bg-[#fff8f5] p-5">
        {/* Payment Method Selector */}
        <div className="mb-4">
          <div className="mb-2 text-xs font-bold text-[#554336]">{copy.paymentMethod}</div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'Cash', label: copy.cash, Icon: Banknote },
                { id: 'Card', label: copy.card, Icon: CreditCard },
                { id: 'Digital Wallet', label: copy.wallet, Icon: Smartphone },
              ] as const
            ).map(({ id, label, Icon }) => {
              const active = paymentMethod === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChangePaymentMethod(id)}
                  className={`flex min-h-[52px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-1.5 text-center transition-all ${
                    active
                      ? 'border-[#2d6a4f] bg-[#aeeecb]/30 text-[#002114]'
                      : 'border-[#dbc2b0]/70 bg-white text-[#554336] hover:border-[#2d6a4f]/40'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-[11px] font-bold leading-tight whitespace-nowrap">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Promo / Discount Selector */}
        <div className="mb-3 flex items-center justify-between text-xs">
          <span className="font-semibold text-[#554336]">{copy.discount} (%)</span>
          <div className="flex items-center gap-1">
            {[0, 5, 10, 15].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => onChangeDiscountPercent(pct)}
                className={`tabular-nums min-h-[30px] cursor-pointer rounded-md px-2 text-xs font-bold transition-colors ${
                  discountPercent === pct
                    ? 'bg-[#211a15] text-white'
                    : 'bg-[#f3e6dd] text-[#554336] hover:bg-[#e5d7cf]'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Receipt-style Live Calculation Summary */}
        <div className="font-receipt tabular-nums mb-4 space-y-1.5 rounded-xl border border-dashed border-[#211a15]/25 bg-[#f7f2e8] p-3 text-xs text-[#1c1613]">
          <div className="flex justify-between">
            <span>{copy.subtotal}</span>
            <span>PKR {subtotal.toLocaleString()}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-[#2d6a4f]">
              <span>
                {copy.discount} ({discountPercent}%)
              </span>
              <span>-PKR {discountAmount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>
              {copy.tax} ({taxRatePercent}%)
            </span>
            <span>PKR {taxAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-t border-dashed border-[#1c1613]/25 pt-1.5 text-sm font-bold">
            <span>{copy.grandTotal}</span>
            <span>PKR {grandTotal.toLocaleString()}</span>
          </div>
        </div>

        {/* 64px Primary Confirmation CTA */}
        <button
          type="button"
          disabled={cart.length === 0 || isSubmitting}
          onClick={onConfirmOrder}
          className="font-display flex min-h-[64px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-[#d97706] px-5 text-base font-extrabold text-white shadow-[0_10px_24px_-6px_rgba(217,119,6,0.45)] transition-all hover:bg-[#b15f00] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#e5d7cf] disabled:text-[#887364] disabled:shadow-none"
        >
          <Printer className="h-5 w-5" />
          <span>{isSubmitting ? 'Processing...' : copy.confirmPrint}</span>
        </button>
      </div>
    </aside>
  );
};
