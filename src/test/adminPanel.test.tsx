import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminPanel } from '../components/AdminPanel';
import {
  DEFAULT_PRINTER_SETTINGS,
  DEFAULT_STOREFRONT_SETTINGS,
  INITIAL_ADMINS,
  INITIAL_MENU,
} from '../data/initialData';
import { MenuItem, Order } from '../types';

function makeOrder(overrides: Partial<Order>): Order {
  const todayIso = new Date().toISOString();
  return {
    orderId: 'CB-9001',
    timestamp: todayIso,
    items: [
      {
        name: 'Zafran Royal Pistachio',
        nameUrdu: 'زعفران شاہی پستہ',
        size: 'Single',
        vessel: 'Artisan Cup',
        toppings: [],
        quantity: 2,
        unitPrice: 380,
        lineTotal: 760,
      },
    ],
    subtotal: 760,
    taxAmount: 38,
    discountAmount: 0,
    total: 798,
    paymentType: 'Cash',
    orderType: 'Dine-in',
    status: 'Completed',
    adminId: 'ADM-01',
    ...overrides,
  };
}

function renderAdminPanel({
  loggedIn = true,
  orders = [],
  menu = INITIAL_MENU,
  onLoginAdmin = vi.fn(),
  onAdjustStockQty = vi.fn(),
}: {
  loggedIn?: boolean;
  orders?: Order[];
  menu?: MenuItem[];
  onLoginAdmin?: (admin: typeof INITIAL_ADMINS[number]) => void;
  onAdjustStockQty?: (id: string, nextQty: number) => void;
} = {}) {
  return render(
    <AdminPanel
      admins={INITIAL_ADMINS}
      loggedInAdmin={loggedIn ? INITIAL_ADMINS[0] : null}
      onLoginAdmin={onLoginAdmin}
      onLogoutAdmin={vi.fn()}
      menu={menu}
      onUpsertMenuItem={vi.fn()}
      onDeleteMenuItem={vi.fn()}
      onToggleStock={vi.fn()}
      onAdjustStockQty={onAdjustStockQty}
      onReplaceMenuFromGas={vi.fn()}
      orders={orders}
      onUpdateOrderStatus={vi.fn()}
      onReplaceOrdersFromGas={vi.fn()}
      onReplaceAdminsFromGas={vi.fn()}
      onReprintOrder={vi.fn()}
      printerSettings={DEFAULT_PRINTER_SETTINGS}
      onUpdatePrinterSettings={vi.fn()}
      storefrontSettings={DEFAULT_STOREFRONT_SETTINGS}
      onUpdateStorefrontSettings={vi.fn()}
      onResetStorefrontSettings={vi.fn()}
      onBulkUpdateCategoryImage={vi.fn()}
      onUpdateAdmins={vi.fn()}
      gasConfig={{ webAppUrl: '', lastSyncAt: null, autoSyncEnabled: true }}
      onUpdateGasConfig={vi.fn()}
      onOpenSetupGuide={vi.fn()}
    />
  );
}

describe('AdminPanel Authentication, Sales Analytics & Stock Alerts', () => {
  it('authenticates both Owner and Manager PINs and rejects invalid passcodes', async () => {
    const user = userEvent.setup();
    const onLoginAdmin = vi.fn();
    renderAdminPanel({ loggedIn: false, onLoginAdmin });

    const pinInput = screen.getByLabelText(/Passcode \/ PIN/i);
    await user.type(pinInput, '9999');
    await user.click(screen.getByRole('button', { name: /Unlock Admin Dashboard/i }));
    expect(screen.getByText(/Invalid passcode/i)).toBeInTheDocument();
    expect(onLoginAdmin).not.toHaveBeenCalled();

    // Switch to Manager ADM-02 and unlock with 3344
    await user.click(screen.getByRole('button', { name: /Sanaullah Khan/i }));
    await user.clear(pinInput);
    await user.type(pinInput, '3344');
    await user.click(screen.getByRole('button', { name: /Unlock Admin Dashboard/i }));
    expect(onLoginAdmin).toHaveBeenCalledWith(INITIAL_ADMINS[1]);
  });

  it('calculates daily revenue, order count, item breakdown, and renders Daily Sales Trend chart in Sales Analytics tab', async () => {
    const user = userEvent.setup();
    const todayOrders: Order[] = [
      makeOrder({
        orderId: 'CB-5001',
        total: 1000,
        subtotal: 952,
        taxAmount: 48,
        items: [
          {
            name: 'Zafran Royal Pistachio',
            nameUrdu: 'زعفران شاہی پستہ',
            size: 'Single',
            vessel: 'Artisan Cup',
            toppings: [],
            quantity: 2,
            unitPrice: 380,
            lineTotal: 760,
          },
          {
            name: 'Shahi Matka Malai Kulfi',
            nameUrdu: 'شاہی مٹکا ملائی قلفی',
            size: 'Single',
            vessel: 'Artisan Cup',
            toppings: [],
            quantity: 1,
            unitPrice: 192,
            lineTotal: 192,
          },
        ],
      }),
      makeOrder({
        orderId: 'CB-5002',
        total: 500,
        subtotal: 500,
        taxAmount: 0,
        orderType: 'Takeaway',
        paymentType: 'Card',
        items: [
          {
            name: 'Zafran Royal Pistachio',
            nameUrdu: 'زعفران شاہی پستہ',
            size: 'Double',
            vessel: 'Crispy Waffle Cone',
            toppings: ['Crushed Iranian Pistachio'],
            quantity: 1,
            unitPrice: 500,
            lineTotal: 500,
          },
        ],
      }),
    ];

    renderAdminPanel({ loggedIn: true, orders: todayOrders });

    await user.click(screen.getByRole('button', { name: 'Sales Analytics' }));

    expect(screen.getByText('Total Daily Revenue')).toBeInTheDocument();
    expect(screen.getAllByText('PKR 1,500').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('2 Orders')).toBeInTheDocument();
    expect(screen.getByText('4 Items')).toBeInTheDocument();
    expect(screen.getByText('Daily Sales Trend')).toBeInTheDocument();

    // Check itemized breakdown rows
    const breakdownTable = screen.getByRole('table');
    expect(within(breakdownTable).getByText('Zafran Royal Pistachio')).toBeInTheDocument();
    expect(within(breakdownTable).getByText('Shahi Matka Malai Kulfi')).toBeInTheDocument();
    expect(within(breakdownTable).getByText('PKR 1,260')).toBeInTheDocument();
  });

  it('highlights low-stock and depleted items in red and supports proactive restocking', async () => {
    const user = userEvent.setup();
    const onAdjustStockQty = vi.fn();
    const testMenu: MenuItem[] = [
      { ...INITIAL_MENU[0], stockQty: 3, lowStockThreshold: 8, status: 'In Stock' },
      { ...INITIAL_MENU[1], stockQty: 0, lowStockThreshold: 8, status: 'Sold Out' },
      { ...INITIAL_MENU[2], stockQty: 30, lowStockThreshold: 8, status: 'In Stock' },
    ];

    renderAdminPanel({ loggedIn: true, menu: testMenu, onAdjustStockQty });

    await user.click(screen.getByRole('button', { name: 'Menu & Stock' }));

    expect(screen.getByText(/Restock Attention Required · 2 Items/i)).toBeInTheDocument();
    expect(screen.getByText('Low Stock')).toBeInTheDocument();
    expect(screen.getByText('3 left (Min 8)')).toBeInTheDocument();
    expect(screen.getByText('Depleted')).toBeInTheDocument();
    expect(screen.getByText('0 left (Min 8)')).toBeInTheDocument();

    const restockButtons = screen.getAllByRole('button', { name: /\+10 Restock/i });
    await user.click(restockButtons[0]);
    expect(onAdjustStockQty).toHaveBeenCalled();
  });

  it('displays Low Stock Alert dashboard widget highlighting items with stockQty < lowStockThreshold in distinct indicator boxes', async () => {
    const user = userEvent.setup();
    const onAdjustStockQty = vi.fn();
    const testMenu: MenuItem[] = [
      { ...INITIAL_MENU[0], id: 'CB-101', stockQty: 2, lowStockThreshold: 8, status: 'In Stock' },
      { ...INITIAL_MENU[1], id: 'CB-102', stockQty: 8, lowStockThreshold: 8, status: 'In Stock' },
      { ...INITIAL_MENU[2], id: 'CB-103', stockQty: 20, lowStockThreshold: 8, status: 'In Stock' },
    ];

    const { rerender } = renderAdminPanel({ loggedIn: true, menu: testMenu, onAdjustStockQty });

    const widget = screen.getByTestId('low-stock-alert-widget');
    expect(within(widget).getByText('Low Stock Alert')).toBeInTheDocument();
    expect(within(widget).getByText(/1 item has stock quantity below threshold/i)).toBeInTheDocument();
    expect(within(widget).getByTestId('low-stock-indicator-CB-101')).toBeInTheDocument();
    expect(within(widget).queryByTestId('low-stock-indicator-CB-102')).not.toBeInTheDocument();
    expect(within(widget).queryByTestId('low-stock-indicator-CB-103')).not.toBeInTheDocument();

    await user.click(within(widget).getByRole('button', { name: /\+10 Restock/i }));
    expect(onAdjustStockQty).toHaveBeenCalledWith('CB-101', 12);

    // When all items meet or exceed threshold, widget shows healthy indicator state
    const healthyMenu = testMenu.map((m) => ({ ...m, stockQty: 15 }));
    rerender(
      <AdminPanel
        admins={INITIAL_ADMINS}
        loggedInAdmin={INITIAL_ADMINS[0]}
        onLoginAdmin={vi.fn()}
        onLogoutAdmin={vi.fn()}
        menu={healthyMenu}
        onUpsertMenuItem={vi.fn()}
        onDeleteMenuItem={vi.fn()}
        onToggleStock={vi.fn()}
        onAdjustStockQty={onAdjustStockQty}
        onReplaceMenuFromGas={vi.fn()}
        orders={[]}
        onUpdateOrderStatus={vi.fn()}
        onReplaceOrdersFromGas={vi.fn()}
        onReplaceAdminsFromGas={vi.fn()}
        onReprintOrder={vi.fn()}
        printerSettings={DEFAULT_PRINTER_SETTINGS}
        onUpdatePrinterSettings={vi.fn()}
        storefrontSettings={DEFAULT_STOREFRONT_SETTINGS}
        onUpdateStorefrontSettings={vi.fn()}
        onResetStorefrontSettings={vi.fn()}
        onBulkUpdateCategoryImage={vi.fn()}
        onUpdateAdmins={vi.fn()}
        gasConfig={{ webAppUrl: '', lastSyncAt: null, autoSyncEnabled: true }}
        onUpdateGasConfig={vi.fn()}
        onOpenSetupGuide={vi.fn()}
      />
    );
    expect(screen.getByText(/All 3 menu items meet or exceed their low-stock threshold/i)).toBeInTheDocument();
  });
});
