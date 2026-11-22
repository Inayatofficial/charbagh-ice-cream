import React, { useMemo, useState } from 'react';
import { Check, Minus, Plus, X } from 'lucide-react';
import { CartItem, Language, MenuItem, ToppingOption, VesselOption } from '../types';
import { TOPPING_OPTIONS, UI_COPY, VESSEL_OPTIONS } from '../data/initialData';

interface CustomizerModalProps {
  item: MenuItem;
  allMenu: MenuItem[];
  language: Language;
  vessels?: VesselOption[];
  toppings?: ToppingOption[];
  doubleScoopPrice?: number;
  onClose: () => void;
  onAddToCart: (cartItem: CartItem) => void;
}

export const CustomizerModal: React.FC<CustomizerModalProps> = ({
  item,
  allMenu,
  language,
  vessels = VESSEL_OPTIONS,
  toppings = TOPPING_OPTIONS,
  doubleScoopPrice = 180,
  onClose,
  onAddToCart,
}) => {
  const copy = UI_COPY[language];
  const isScoopOrConeOrSundae = ['Scoops', 'Cones', 'Sundaes', 'Kulfi'].includes(item.category);

  const [size, setSize] = useState<'Single' | 'Double'>('Single');
  const [vessel, setVessel] = useState<VesselOption>(vessels[0] || VESSEL_OPTIONS[0]);
  const [secondFlavor, setSecondFlavor] = useState<string>('');
  const [selectedToppings, setSelectedToppings] = useState<ToppingOption[]>([]);
  const [quantity, setQuantity] = useState<number>(1);

  const otherFlavors = useMemo(
    () =>
      allMenu.filter(
        (m) =>
          m.id !== item.id &&
          m.status === 'In Stock' &&
          (m.category === 'Scoops' || m.category === 'Kulfi')
      ),
    [allMenu, item.id]
  );

  const sizeAddon = size === 'Double' ? doubleScoopPrice : 0;
  const vesselAddon = isScoopOrConeOrSundae ? vessel.price : 0;
  const toppingsTotal = selectedToppings.reduce((sum, t) => sum + t.price, 0);
  const unitPrice = item.price + sizeAddon + vesselAddon + toppingsTotal;
  const lineTotal = unitPrice * quantity;

  const toggleTopping = (topping: ToppingOption) => {
    setSelectedToppings((prev) =>
      prev.some((t) => t.id === topping.id)
        ? prev.filter((t) => t.id !== topping.id)
        : [...prev, topping]
    );
  };

  const handleConfirm = () => {
    const newCartItem: CartItem = {
      cartLineId: `${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      menuItemId: item.id,
      name: item.name,
      nameUrdu: item.nameUrdu,
      category: item.category,
      imageUrl: item.imageUrl,
      basePrice: item.price,
      size,
      sizeAddon,
      secondFlavor: size === 'Double' && secondFlavor ? secondFlavor : undefined,
      vessel: isScoopOrConeOrSundae ? vessel : vessels[0] || VESSEL_OPTIONS[0],
      toppings: selectedToppings,
      quantity,
      unitPrice,
      lineTotal,
    };
    onAddToCart(newCartItem);
    onClose();
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-end justify-center bg-[#211a15]/50 p-0 backdrop-blur-md sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customizer-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-white/60 bg-[#fffdf7]/95 shadow-[0_24px_48px_-12px_rgba(41,34,29,0.28)] sm:rounded-3xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#dbc2b0]/60 px-6 py-5">
          <div className="flex items-center gap-4">
            <img
              src={item.imageUrl}
              alt={item.name}
              referrerPolicy="no-referrer"
              className="h-16 w-16 shrink-0 rounded-2xl object-cover shadow-sm"
            />
            <div>
              <p className="text-xs font-semibold text-[#2d6a4f]">{item.category}</p>
              <h2
                id="customizer-title"
                className="font-display text-xl font-extrabold text-[#211a15] sm:text-2xl"
              >
                {language === 'ur' && item.nameUrdu ? item.nameUrdu : item.name}
              </h2>
              <p className="text-sm font-medium text-[#8d4b00]">
                {language === 'ur' ? item.name : item.nameUrdu}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={copy.cancel}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#f3e6dd] text-[#211a15] transition-colors hover:bg-[#e5d7cf]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Customization Options */}
        <div className="kiosk-scroll flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* 1. Size Selection */}
          <div>
            <h3 className="font-display mb-3 text-base font-bold text-[#211a15]">
              {language === 'ur' ? 'سائز منتخب کریں' : 'Portion Size'}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {(['Single', 'Double'] as const).map((option) => {
                const active = size === option;
                const label = option === 'Single' ? copy.single : copy.double;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSize(option)}
                    className={`flex min-h-[60px] cursor-pointer items-center justify-between rounded-2xl border-2 px-4 py-3 text-left transition-all ${
                      active
                        ? 'border-[#d97706] bg-[#fffbeb] shadow-[0_8px_20px_-6px_rgba(217,119,6,0.2)]'
                        : 'border-[#dbc2b0]/70 bg-white hover:border-[#8d4b00]/40'
                    }`}
                  >
                    <div>
                      <div className="font-display text-base font-bold text-[#211a15]">{label}</div>
                      <div className="tabular-nums text-xs font-medium text-[#554336]">
                        {option === 'Single' ? 'Standard' : `+PKR ${doubleScoopPrice}`}
                      </div>
                    </div>
                    {active && (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#d97706] text-white">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Optional 2nd Scoop Flavor when Double is selected */}
          {size === 'Double' && otherFlavors.length > 0 && (
            <div>
              <h3 className="font-display mb-3 text-base font-bold text-[#211a15]">
                {copy.secondFlavor}
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSecondFlavor('')}
                  className={`flex min-h-[48px] cursor-pointer items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
                    secondFlavor === ''
                      ? 'border-2 border-[#2d6a4f] bg-[#aeeecb]/30 text-[#0e5138]'
                      : 'border-[#dbc2b0] bg-white text-[#211a15]'
                  }`}
                >
                  <span>{copy.sameFlavor}</span>
                  {secondFlavor === '' && <Check className="h-4 w-4" />}
                </button>
                {otherFlavors.map((flav) => {
                  const selected = secondFlavor === flav.name;
                  return (
                    <button
                      key={flav.id}
                      type="button"
                      onClick={() => setSecondFlavor(flav.name)}
                      className={`flex min-h-[48px] cursor-pointer items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
                        selected
                          ? 'border-2 border-[#2d6a4f] bg-[#aeeecb]/30 text-[#0e5138]'
                          : 'border-[#dbc2b0] bg-white text-[#211a15]'
                      }`}
                    >
                      <span className="truncate">
                        {language === 'ur' && flav.nameUrdu ? flav.nameUrdu : flav.name}
                      </span>
                      {selected && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Base / Vessel Selection */}
          {isScoopOrConeOrSundae && (
            <div>
              <h3 className="font-display mb-3 text-base font-bold text-[#211a15]">
                {copy.chooseVessel}
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {vessels.map((v) => {
                  const active = vessel.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVessel(v)}
                      className={`flex min-h-[60px] cursor-pointer flex-col justify-between rounded-2xl border-2 p-3.5 text-left transition-all ${
                        active
                          ? 'border-[#d97706] bg-[#fffbeb]'
                          : 'border-[#dbc2b0]/70 bg-white hover:border-[#8d4b00]/40'
                      }`}
                    >
                      <span className="text-sm font-bold text-[#211a15]">
                        {language === 'ur' ? v.nameUrdu : v.name}
                      </span>
                      <span className="tabular-nums mt-1 text-xs font-semibold text-[#554336]">
                        {v.price === 0 ? 'Included' : `+PKR ${v.price}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Toppings Selection */}
          <div>
            <h3 className="font-display mb-3 text-base font-bold text-[#211a15]">
              {copy.chooseToppings}
            </h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {toppings.map((topping) => {
                const active = selectedToppings.some((t) => t.id === topping.id);
                return (
                  <button
                    key={topping.id}
                    type="button"
                    onClick={() => toggleTopping(topping)}
                    className={`flex min-h-[54px] cursor-pointer items-center justify-between rounded-xl border-2 px-4 py-2.5 text-left transition-all ${
                      active
                        ? 'border-[#2d6a4f] bg-[#aeeecb]/25 text-[#002114]'
                        : 'border-[#dbc2b0]/70 bg-white text-[#211a15] hover:border-[#2d6a4f]/40'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-bold">
                        {language === 'ur' ? topping.nameUrdu : topping.name}
                      </div>
                      <div className="tabular-nums text-xs text-[#554336]">
                        +PKR {topping.price}
                      </div>
                    </div>
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                        active
                          ? 'border-[#2d6a4f] bg-[#2d6a4f] text-white'
                          : 'border-[#dbc2b0] bg-[#fff8f5]'
                      }`}
                    >
                      {active && <Check className="h-4 w-4" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer with 48px circular stepper and 64px primary CTA */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#dbc2b0]/70 bg-[#fff8f5] px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
              className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border-2 border-[#2d6a4f] bg-white text-[#2d6a4f] transition-transform active:scale-95"
            >
              <Minus className="h-5 w-5" />
            </button>
            <span className="tabular-nums font-display w-9 text-center text-2xl font-extrabold text-[#211a15]">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              aria-label="Increase quantity"
              className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border-2 border-[#2d6a4f] bg-white text-[#2d6a4f] transition-transform active:scale-95"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            className="font-display tabular-nums flex min-h-[64px] flex-1 cursor-pointer items-center justify-center gap-3 rounded-2xl bg-[#d97706] px-6 text-base font-extrabold text-white shadow-[0_10px_24px_-6px_rgba(217,119,6,0.4)] transition-all hover:bg-[#b15f00] active:scale-[0.98] sm:min-w-[260px] sm:flex-initial"
          >
            <span>{copy.addToOrder}</span>
            <span aria-hidden="true">·</span>
            <span>PKR {lineTotal.toLocaleString()}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
