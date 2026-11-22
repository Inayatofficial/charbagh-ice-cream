import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomizerModal } from '../components/CustomizerModal';
import { CartSidebar } from '../components/CartSidebar';
import { INITIAL_MENU, TOPPING_OPTIONS, VESSEL_OPTIONS } from '../data/initialData';
import { CartItem } from '../types';

describe('Touch Kiosk Customizer & Interactive Cart', () => {
  it('calculates Double scoop, Crispy Waffle Cone vessel, toppings, and quantity in CustomizerModal', async () => {
    const user = userEvent.setup();
    const onAddToCart = vi.fn();
    const onClose = vi.fn();
    const scoopItem = INITIAL_MENU[0]; // Zafran Royal Pistachio, base price 380

    render(
      <CustomizerModal
        item={scoopItem}
        allMenu={INITIAL_MENU}
        language="en"
        vessels={VESSEL_OPTIONS}
        toppings={TOPPING_OPTIONS}
        doubleScoopPrice={180}
        onClose={onClose}
        onAddToCart={onAddToCart}
      />
    );

    // Select Double (+180)
    await user.click(screen.getByRole('button', { name: /Double\s*\+PKR 180/i }));
    // Select Crispy Waffle Cone (+70)
    await user.click(screen.getByRole('button', { name: /Crispy Waffle Cone/i }));
    // Select Crushed Iranian Pistachio (+90)
    await user.click(screen.getByRole('button', { name: /Crushed Iranian Pistachio/i }));
    // Increase quantity to 2
    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));

    // Unit price: 380 + 180 + 70 + 90 = 720; Qty 2 => 1,440
    const addBtn = screen.getByRole('button', { name: /Add to Order/i });
    expect(addBtn).toHaveTextContent('PKR 1,440');

    await user.click(addBtn);
    expect(onAddToCart).toHaveBeenCalledTimes(1);
    const addedItem = onAddToCart.mock.calls[0][0] as CartItem;
    expect(addedItem.size).toBe('Double');
    expect(addedItem.vessel.id).toBe('waffle');
    expect(addedItem.toppings.map((t) => t.id)).toEqual(['pista']);
    expect(addedItem.quantity).toBe(2);
    expect(addedItem.unitPrice).toBe(720);
    expect(addedItem.lineTotal).toBe(1440);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('computes live subtotal, discount, tax, and grand total in CartSidebar and triggers confirmation', async () => {
    const user = userEvent.setup();
    const onConfirmOrder = vi.fn();
    const onChangeOrderType = vi.fn();
    const onChangePaymentMethod = vi.fn();
    const onChangeDiscountPercent = vi.fn();

    const sampleCart: CartItem[] = [
      {
        cartLineId: 'line-1',
        menuItemId: INITIAL_MENU[0].id,
        name: INITIAL_MENU[0].name,
        nameUrdu: INITIAL_MENU[0].nameUrdu,
        category: INITIAL_MENU[0].category,
        imageUrl: INITIAL_MENU[0].imageUrl,
        basePrice: 380,
        size: 'Single',
        sizeAddon: 0,
        vessel: VESSEL_OPTIONS[0],
        toppings: [],
        quantity: 2,
        unitPrice: 500,
        lineTotal: 1000,
      },
    ];

    render(
      <CartSidebar
        cart={sampleCart}
        language="en"
        orderType="Dine-in"
        paymentMethod="Cash"
        taxRatePercent={5}
        discountPercent={10}
        onChangeOrderType={onChangeOrderType}
        onChangePaymentMethod={onChangePaymentMethod}
        onChangeDiscountPercent={onChangeDiscountPercent}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onClearCart={vi.fn()}
        onConfirmOrder={onConfirmOrder}
        isSubmitting={false}
      />
    );

    // Subtotal 1000, 10% discount = -100, taxable = 900, 5% tax = 45, Grand Total = 945
    expect(screen.getAllByText('PKR 1,000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('-PKR 100')).toBeInTheDocument();
    expect(screen.getByText('PKR 45')).toBeInTheDocument();
    expect(screen.getByText('PKR 945')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Takeaway' }));
    expect(onChangeOrderType).toHaveBeenCalledWith('Takeaway');

    await user.click(screen.getByRole('button', { name: 'Card' }));
    expect(onChangePaymentMethod).toHaveBeenCalledWith('Card');

    await user.click(screen.getByRole('button', { name: '15%' }));
    expect(onChangeDiscountPercent).toHaveBeenCalledWith(15);

    await user.click(screen.getByRole('button', { name: /Confirm & Print Receipt/i }));
    expect(onConfirmOrder).toHaveBeenCalledTimes(1);
  });

  it('disables confirmation button when cart is empty and supports Urdu labels', () => {
    render(
      <CartSidebar
        cart={[]}
        language="ur"
        orderType="Dine-in"
        paymentMethod="Cash"
        taxRatePercent={5}
        discountPercent={0}
        onChangeOrderType={vi.fn()}
        onChangePaymentMethod={vi.fn()}
        onChangeDiscountPercent={vi.fn()}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onClearCart={vi.fn()}
        onConfirmOrder={vi.fn()}
        isSubmitting={false}
      />
    );

    const confirmBtn = screen.getByRole('button', { name: /آرڈر کنفرم اور پرنٹ کریں/i });
    expect(confirmBtn).toBeDisabled();
  });
});
