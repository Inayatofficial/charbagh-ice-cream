import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, ShoppingBag, X } from 'lucide-react';
import {
  AdminUser,
  CartItem,
  CategoryFilter,
  GasConfig,
  Language,
  MenuItem,
  Order,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PrinterSettings,
  StorefrontSettings,
} from './types';
import {
  CATEGORIES,
  DEFAULT_PRINTER_SETTINGS,
  DEFAULT_STOREFRONT_SETTINGS,
  INITIAL_ADMINS,
  INITIAL_MENU,
  INITIAL_SAMPLE_ORDERS,
  UI_COPY,
} from './data/initialData';
import { TopBar, AppView } from './components/TopBar';
import { MenuCard } from './components/MenuCard';
import { CustomizerModal } from './components/CustomizerModal';
import { CartSidebar } from './components/CartSidebar';
import { ReceiptSlipContent, ThermalReceiptModal } from './components/ThermalReceiptModal';
import { AdminPanel } from './components/AdminPanel';
import { SetupGuide } from './components/SetupGuide';
import {
  deleteMenuItemFromGas,
  pullAllFromGas,
  pushAdminsToGas,
  pushMenuItemToGas,
  pushOrderStatusToGas,
  pushOrderToGas,
} from './utils/gasApi';

const STORAGE_KEYS = {
  MENU: 'charbagh_menu_v1',
  ORDERS: 'charbagh_orders_v1',
  ADMINS: 'charbagh_admins_v1',
  PRINTER: 'charbagh_printer_v1',
  STOREFRONT: 'charbagh_storefront_v1',
  GAS: 'charbagh_gas_v1',
  LANG: 'charbagh_lang_v1',
};

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('kiosk');
  const [language, setLanguage] = useState<Language>(() => loadStored(STORAGE_KEYS.LANG, 'en'));

  // Core App State
  const [menu, setMenu] = useState<MenuItem[]>(() => {
    const stored = loadStored<MenuItem[]>(STORAGE_KEYS.MENU, INITIAL_MENU);
    return stored.map((item) => {
      const fallback = INITIAL_MENU.find((m) => m.id === item.id);
      return {
        ...item,
        stockQty:
          typeof item.stockQty === 'number'
            ? item.stockQty
            : item.status === 'Sold Out'
              ? 0
              : fallback?.stockQty ?? 20,
        lowStockThreshold:
          typeof item.lowStockThreshold === 'number'
            ? item.lowStockThreshold
            : fallback?.lowStockThreshold ?? 8,
      };
    });
  });
  const [orders, setOrders] = useState<Order[]>(() =>
    loadStored(STORAGE_KEYS.ORDERS, INITIAL_SAMPLE_ORDERS)
  );
  const [admins, setAdmins] = useState<AdminUser[]>(() =>
    loadStored(STORAGE_KEYS.ADMINS, INITIAL_ADMINS)
  );
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>(() =>
    loadStored(STORAGE_KEYS.PRINTER, DEFAULT_PRINTER_SETTINGS)
  );
  const [storefrontSettings, setStorefrontSettings] = useState<StorefrontSettings>(() => ({
    ...DEFAULT_STOREFRONT_SETTINGS,
    ...loadStored<Partial<StorefrontSettings>>(STORAGE_KEYS.STOREFRONT, {}),
  }));
  const [gasConfig, setGasConfig] = useState<GasConfig>(() =>
    loadStored(STORAGE_KEYS.GAS, {
      webAppUrl: '',
      lastSyncAt: null,
      autoSyncEnabled: true,
    })
  );

  // Kiosk Interactive State
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('Dine-in');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [discountPercent, setDiscountPercent] = useState<number>(
    printerSettings.defaultDiscountPercent || 0
  );
  const [isMobileCartOpen, setIsMobileCartOpen] = useState<boolean>(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);

  // Receipt & Print State
  const [activeReceiptOrder, setActiveReceiptOrder] = useState<Order | null>(null);

  // Dual Admin Session State
  const [loggedInAdmin, setLoggedInAdmin] = useState<AdminUser | null>(null);

  const copy = UI_COPY[language];

  // Persist changes to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(menu));
  }, [menu]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(admins));
  }, [admins]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRINTER, JSON.stringify(printerSettings));
  }, [printerSettings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STOREFRONT, JSON.stringify(storefrontSettings));
  }, [storefrontSettings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.GAS, JSON.stringify(gasConfig));
  }, [gasConfig]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LANG, JSON.stringify(language));
  }, [language]);

  // Initial silent sync from Google Apps Script if configured
  useEffect(() => {
    if (!gasConfig.webAppUrl) return;
    let cancelled = false;
    pullAllFromGas(gasConfig.webAppUrl).then((res) => {
      if (cancelled || !res.ok) return;
      if (res.menu) setMenu(res.menu);
      if (res.orders) setOrders(res.orders);
      if (res.admins) setAdmins(res.admins);
      setGasConfig((prev) => ({ ...prev, lastSyncAt: new Date().toISOString() }));
    });
    return () => {
      cancelled = true;
    };
  }, [gasConfig.webAppUrl]);

  const filteredMenu = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return menu.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.nameUrdu.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [menu, selectedCategory, searchQuery]);

  const cartItemCountByMenuId = useMemo(() => {
    const counts: Record<string, number> = {};
    cart.forEach((c) => {
      counts[c.menuItemId] = (counts[c.menuItemId] || 0) + c.quantity;
    });
    return counts;
  }, [cart]);

  const cartTotals = useMemo(() => {
    const subtotal = cart.reduce((sum, line) => sum + line.lineTotal, 0);
    const discountAmount = Math.round((subtotal * discountPercent) / 100);
    const taxableBase = Math.max(0, subtotal - discountAmount);
    const taxAmount = Math.round((taxableBase * printerSettings.taxRatePercent) / 100);
    const total = taxableBase + taxAmount;
    const qty = cart.reduce((sum, line) => sum + line.quantity, 0);
    return { subtotal, discountAmount, taxAmount, total, qty };
  }, [cart, discountPercent, printerSettings.taxRatePercent]);

  const triggerThermalPrint = useCallback(() => {
    setTimeout(() => {
      window.print();
    }, 150);
  }, []);

  const handleAddToCart = (newCartItem: CartItem) => {
    setCart((prev) => [...prev, newCartItem]);
  };

  const handleUpdateCartQuantity = (cartLineId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((line) => {
          if (line.cartLineId !== cartLineId) return line;
          const nextQty = line.quantity + delta;
          if (nextQty <= 0) return null;
          return {
            ...line,
            quantity: nextQty,
            lineTotal: line.unitPrice * nextQty,
          };
        })
        .filter((x): x is CartItem => x !== null)
    );
  };

  const handleRemoveCartItem = (cartLineId: string) => {
    setCart((prev) => prev.filter((line) => line.cartLineId !== cartLineId));
  };

  const handleConfirmOrder = async () => {
    if (cart.length === 0 || isSubmittingOrder) return;
    setIsSubmittingOrder(true);

    const nextSeq = 1001 + orders.length;
    const orderId = `CB-${nextSeq}`;
    const newOrder: Order = {
      orderId,
      timestamp: new Date().toISOString(),
      items: cart.map((line) => ({
        name: line.name,
        nameUrdu: line.nameUrdu,
        size: line.size,
        vessel: line.vessel.name,
        secondFlavor: line.secondFlavor,
        toppings: line.toppings.map((t) => t.name),
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      })),
      subtotal: cartTotals.subtotal,
      taxAmount: cartTotals.taxAmount,
      discountAmount: cartTotals.discountAmount,
      total: cartTotals.total,
      paymentType: paymentMethod,
      orderType,
      status: 'Pending',
      adminId: loggedInAdmin?.adminId || 'KIOSK',
      syncedToGas: false,
    };

    // Deduct ordered quantities from stock automatically
    const qtyByMenuId: Record<string, number> = {};
    cart.forEach((line) => {
      qtyByMenuId[line.menuItemId] = (qtyByMenuId[line.menuItemId] || 0) + line.quantity;
    });
    const updatedForGas: MenuItem[] = [];
    setMenu((prev) =>
      prev.map((m) => {
        const orderedQty = qtyByMenuId[m.id];
        if (!orderedQty) return m;
        const nextQty = Math.max(0, m.stockQty - orderedQty);
        const updated: MenuItem = {
          ...m,
          stockQty: nextQty,
          status: nextQty === 0 ? 'Sold Out' : m.status,
        };
        updatedForGas.push(updated);
        return updated;
      })
    );

    setOrders((prev) => [newOrder, ...prev]);
    setCart([]);
    setIsMobileCartOpen(false);
    setDiscountPercent(printerSettings.defaultDiscountPercent || 0);
    setActiveReceiptOrder(newOrder);
    setIsSubmittingOrder(false);

    if (printerSettings.thermalPrinterEnabled && printerSettings.autoPrintOnOrder) {
      triggerThermalPrint();
    }

    if (gasConfig.webAppUrl) {
      updatedForGas.forEach((item) => {
        pushMenuItemToGas(gasConfig.webAppUrl, item);
      });
    }

    if (gasConfig.webAppUrl) {
      const res = await pushOrderToGas(gasConfig.webAppUrl, newOrder);
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.orderId === orderId ? { ...o, syncedToGas: true } : o))
        );
        setActiveReceiptOrder((prev) =>
          prev && prev.orderId === orderId ? { ...prev, syncedToGas: true } : prev
        );
      }
    }
  };

  // Admin Menu & Order Mutations (synced to GAS when configured)
  const handleUpsertMenuItem = (item: MenuItem) => {
    setMenu((prev) => {
      const exists = prev.some((m) => m.id === item.id);
      return exists ? prev.map((m) => (m.id === item.id ? item : m)) : [item, ...prev];
    });
    if (gasConfig.webAppUrl) {
      pushMenuItemToGas(gasConfig.webAppUrl, item);
    }
  };

  const handleDeleteMenuItem = (id: string) => {
    setMenu((prev) => prev.filter((m) => m.id !== id));
    if (gasConfig.webAppUrl) {
      deleteMenuItemFromGas(gasConfig.webAppUrl, id);
    }
  };

  const handleToggleStock = (id: string) => {
    let updatedItem: MenuItem | undefined;
    setMenu((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const nextStatus = m.status === 'In Stock' ? 'Sold Out' : 'In Stock';
        const nextQty =
          nextStatus === 'Sold Out'
            ? 0
            : m.stockQty > 0
              ? m.stockQty
              : Math.max(15, m.lowStockThreshold + 8);
        updatedItem = {
          ...m,
          status: nextStatus,
          stockQty: nextQty,
        };
        return updatedItem;
      })
    );
    if (gasConfig.webAppUrl && updatedItem) {
      pushMenuItemToGas(gasConfig.webAppUrl, updatedItem);
    }
  };

  const handleAdjustStockQty = (id: string, nextQty: number) => {
    const safeQty = Math.max(0, Math.round(nextQty));
    let updatedItem: MenuItem | undefined;
    setMenu((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        updatedItem = {
          ...m,
          stockQty: safeQty,
          status: safeQty === 0 ? 'Sold Out' : 'In Stock',
        };
        return updatedItem;
      })
    );
    if (gasConfig.webAppUrl && updatedItem) {
      pushMenuItemToGas(gasConfig.webAppUrl, updatedItem);
    }
  };

  const handleBulkUpdateCategoryImage = (category: MenuItem['category'], imageUrl: string) => {
    const updatedItems: MenuItem[] = [];
    setMenu((prev) =>
      prev.map((m) => {
        if (m.category !== category) return m;
        const updated = { ...m, imageUrl };
        updatedItems.push(updated);
        return updated;
      })
    );
    if (gasConfig.webAppUrl) {
      updatedItems.forEach((item) => {
        pushMenuItemToGas(gasConfig.webAppUrl, item);
      });
    }
  };

  const handleUpdateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders((prev) => prev.map((o) => (o.orderId === orderId ? { ...o, status } : o)));
    if (gasConfig.webAppUrl) {
      pushOrderStatusToGas(gasConfig.webAppUrl, orderId, status);
    }
  };

  const handleUpdateAdmins = (nextAdmins: AdminUser[]) => {
    setAdmins(nextAdmins);
    if (gasConfig.webAppUrl) {
      pushAdminsToGas(gasConfig.webAppUrl, nextAdmins);
    }
  };

  const handleReprintOrder = (order: Order) => {
    setActiveReceiptOrder(order);
    triggerThermalPrint();
  };

  return (
    <>
      <div id="app-shell-ui" className="no-print flex min-h-screen flex-col bg-[#fff8f5]">
        <TopBar
          activeView={activeView}
          onSelectView={setActiveView}
          language={language}
          onToggleLanguage={setLanguage}
          brandTitle={
            language === 'ur' ? storefrontSettings.brandNameUr : storefrontSettings.brandNameEn
          }
        />

        {/* =============================================================== */}
        {/* KIOSK & POS ORDERING VIEW                                       */}
        {/* =============================================================== */}
        {activeView === 'kiosk' && (
          <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:pb-8">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left 8 Columns: Hero, Category Tabs & Menu Grid */}
              <div className="space-y-6 lg:col-span-8">
                {/* Editorial Bilingual Hero Header with Admin-Editable Showcase Picture */}
                <section className="overflow-hidden rounded-3xl border border-[#211a15]/8 bg-gradient-to-br from-[#fff1e9] via-[#fff8f5] to-[#f9ebe3]">
                  <div className="grid grid-cols-1 items-stretch md:grid-cols-12">
                    <div
                      dir={language === 'ur' ? 'rtl' : 'ltr'}
                      className={`flex flex-col justify-between gap-4 p-6 sm:p-7 ${
                        storefrontSettings.showHeroImage && storefrontSettings.heroImageUrl
                          ? 'md:col-span-7'
                          : 'md:col-span-12'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-3">
                          {storefrontSettings.logoImageUrl && (
                            <img
                              src={storefrontSettings.logoImageUrl}
                              alt={storefrontSettings.brandNameEn}
                              referrerPolicy="no-referrer"
                              className="h-11 w-11 shrink-0 rounded-xl border border-[#dbc2b0] object-cover shadow-xs"
                            />
                          )}
                          <p className="text-xs font-bold tracking-wide text-[#2d6a4f]">
                            {language === 'ur'
                              ? storefrontSettings.heroKickerUr
                              : storefrontSettings.heroKickerEn}
                          </p>
                        </div>
                        <h1 className="font-display mt-2 text-2xl font-extrabold tracking-tight text-balance text-[#211a15] sm:text-3xl xl:text-4xl">
                          {language === 'ur'
                            ? storefrontSettings.heroTitleUr
                            : storefrontSettings.heroTitleEn}
                        </h1>
                        <p className="mt-2 text-sm leading-relaxed text-[#554336] sm:text-base">
                          {language === 'ur'
                            ? storefrontSettings.heroSubtitleUr
                            : storefrontSettings.heroSubtitleEn}
                        </p>
                      </div>

                      {/* Touch-Friendly Search Input */}
                      <div className="relative w-full max-w-md">
                        <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#887364]" />
                        <input
                          type="search"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={copy.searchPlaceholder}
                          className="h-12 w-full rounded-2xl border border-[#dbc2b0] bg-white pr-4 pl-10 text-sm font-medium text-[#211a15] shadow-xs focus:border-[#d97706] focus:outline-none"
                        />
                      </div>
                    </div>

                    {storefrontSettings.showHeroImage && storefrontSettings.heroImageUrl && (
                      <div className="relative min-h-[200px] md:col-span-5">
                        <img
                          src={storefrontSettings.heroImageUrl}
                          alt={storefrontSettings.brandNameEn}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover md:min-h-full"
                        />
                      </div>
                    )}
                  </div>
                </section>

                {/* Category Segmented Filter Tabs */}
                <div
                  role="tablist"
                  aria-label="Ice Cream Categories"
                  className="flex items-center gap-2 overflow-x-auto pb-1"
                >
                  {CATEGORIES.map((cat) => {
                    const active = selectedCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        role="tab"
                        aria-selected={active}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`min-h-[48px] shrink-0 cursor-pointer rounded-2xl px-5 py-2.5 text-sm font-bold whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-[#d97706] ${
                          active
                            ? 'bg-[#211a15] text-white shadow-sm'
                            : 'border border-[#dbc2b0]/70 bg-white text-[#554336] hover:border-[#8d4b00]/40 hover:text-[#211a15]'
                        }`}
                      >
                        {language === 'ur' ? cat.ur : cat.en}
                      </button>
                    );
                  })}
                </div>

                {/* Product Grid */}
                {filteredMenu.length === 0 ? (
                  <div className="rounded-3xl border border-[#211a15]/10 bg-white p-12 text-center">
                    <p className="font-display text-lg font-bold text-[#211a15]">
                      No flavors match your search
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('All');
                        setSearchQuery('');
                      }}
                      className="mt-3 min-h-[44px] cursor-pointer rounded-xl bg-[#f3e6dd] px-5 text-sm font-bold text-[#211a15]"
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredMenu.map((item) => (
                      <MenuCard
                        key={item.id}
                        item={item}
                        language={language}
                        inCartCount={cartItemCountByMenuId[item.id] || 0}
                        onSelect={setCustomizingItem}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Right 4 Columns: Persistent POS / Kiosk Cart Rail on Desktop */}
              <div className="hidden lg:col-span-4 lg:block">
                <div className="sticky top-20 h-[calc(100vh-6.5rem)]">
                  <CartSidebar
                    cart={cart}
                    language={language}
                    orderType={orderType}
                    paymentMethod={paymentMethod}
                    taxRatePercent={printerSettings.taxRatePercent}
                    discountPercent={discountPercent}
                    onChangeOrderType={setOrderType}
                    onChangePaymentMethod={setPaymentMethod}
                    onChangeDiscountPercent={setDiscountPercent}
                    onUpdateQuantity={handleUpdateCartQuantity}
                    onRemoveItem={handleRemoveCartItem}
                    onClearCart={() => setCart([])}
                    onConfirmOrder={handleConfirmOrder}
                    isSubmitting={isSubmittingOrder}
                  />
                </div>
              </div>
            </div>

            {/* Mobile / Tablet Portrait Compact Bottom Cart Bar (<= 15% height) */}
            <div className="fixed right-0 bottom-0 left-0 z-30 border-t border-[#dbc2b0] bg-[#fff8f5]/95 px-4 py-3 backdrop-blur-md lg:hidden">
              <button
                type="button"
                onClick={() => setIsMobileCartOpen(true)}
                className="font-display tabular-nums flex min-h-[56px] w-full cursor-pointer items-center justify-between rounded-2xl bg-[#d97706] px-5 text-white shadow-lg active:scale-[0.99]"
              >
                <span className="flex items-center gap-2.5 text-sm font-extrabold">
                  <ShoppingBag className="h-5 w-5" />
                  <span>
                    {copy.yourOrder} ({cartTotals.qty})
                  </span>
                </span>
                <span className="text-base font-extrabold">
                  PKR {cartTotals.total.toLocaleString()}
                </span>
              </button>
            </div>
          </main>
        )}

        {/* =============================================================== */}
        {/* DUAL ADMIN PANEL                                                */}
        {/* =============================================================== */}
        {activeView === 'admin' && (
          <main className="flex-1 pb-12">
            <AdminPanel
              admins={admins}
              loggedInAdmin={loggedInAdmin}
              onLoginAdmin={setLoggedInAdmin}
              onLogoutAdmin={() => setLoggedInAdmin(null)}
              menu={menu}
              onUpsertMenuItem={handleUpsertMenuItem}
              onDeleteMenuItem={handleDeleteMenuItem}
              onToggleStock={handleToggleStock}
              onAdjustStockQty={handleAdjustStockQty}
              onReplaceMenuFromGas={setMenu}
              orders={orders}
              onUpdateOrderStatus={handleUpdateOrderStatus}
              onReplaceOrdersFromGas={setOrders}
              onReplaceAdminsFromGas={setAdmins}
              onReprintOrder={handleReprintOrder}
              printerSettings={printerSettings}
              onUpdatePrinterSettings={setPrinterSettings}
              storefrontSettings={storefrontSettings}
              onUpdateStorefrontSettings={setStorefrontSettings}
              onResetStorefrontSettings={() => setStorefrontSettings(DEFAULT_STOREFRONT_SETTINGS)}
              onBulkUpdateCategoryImage={handleBulkUpdateCategoryImage}
              onUpdateAdmins={handleUpdateAdmins}
              gasConfig={gasConfig}
              onUpdateGasConfig={setGasConfig}
              onOpenSetupGuide={() => setActiveView('setup')}
            />
          </main>
        )}

        {/* =============================================================== */}
        {/* GOOGLE APPS SCRIPT & THERMAL SETUP GUIDE                        */}
        {/* =============================================================== */}
        {activeView === 'setup' && (
          <main className="flex-1 pb-12">
            <SetupGuide onGoToAdminSync={() => setActiveView('admin')} />
          </main>
        )}

        {/* =============================================================== */}
        {/* MOBILE / PORTRAIT SLIDE-UP CART SHEET                           */}
        {/* =============================================================== */}
        {isMobileCartOpen && (
          <div
            className="fixed inset-0 z-50 flex flex-col justify-end bg-[#211a15]/50 backdrop-blur-sm lg:hidden"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex max-h-[88vh] flex-col overflow-hidden rounded-t-3xl bg-[#fff8f5]">
              <div className="flex items-center justify-between border-b border-[#dbc2b0] px-5 py-3">
                <span className="font-display text-base font-extrabold text-[#211a15]">
                  {copy.yourOrder}
                </span>
                <button
                  type="button"
                  onClick={() => setIsMobileCartOpen(false)}
                  aria-label="Close cart drawer"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f3e6dd] text-[#211a15]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                <CartSidebar
                  cart={cart}
                  language={language}
                  orderType={orderType}
                  paymentMethod={paymentMethod}
                  taxRatePercent={printerSettings.taxRatePercent}
                  discountPercent={discountPercent}
                  onChangeOrderType={setOrderType}
                  onChangePaymentMethod={setPaymentMethod}
                  onChangeDiscountPercent={setDiscountPercent}
                  onUpdateQuantity={handleUpdateCartQuantity}
                  onRemoveItem={handleRemoveCartItem}
                  onClearCart={() => setCart([])}
                  onConfirmOrder={handleConfirmOrder}
                  isSubmitting={isSubmittingOrder}
                />
              </div>
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* CUSTOMIZER MODAL                                                */}
        {/* =============================================================== */}
        {customizingItem && (
          <CustomizerModal
            item={customizingItem}
            allMenu={menu}
            language={language}
            vessels={storefrontSettings.vessels}
            toppings={storefrontSettings.toppings}
            doubleScoopPrice={storefrontSettings.doubleScoopPrice}
            onClose={() => setCustomizingItem(null)}
            onAddToCart={handleAddToCart}
          />
        )}

        {/* =============================================================== */}
        {/* THERMAL RECEIPT PREVIEW & PRINT MODAL                           */}
        {/* =============================================================== */}
        {activeReceiptOrder && (
          <ThermalReceiptModal
            order={activeReceiptOrder}
            settings={printerSettings}
            onClose={() => setActiveReceiptOrder(null)}
            onPrint={triggerThermalPrint}
          />
        )}
      </div>

      {/* ================================================================= */}
      {/* DEDICATED @media print THERMAL PAPER PORTAL (58mm / 80mm)          */}
      {/* ================================================================= */}
      <div id="thermal-print-portal" className="hidden print:block">
        {activeReceiptOrder && (
          <ReceiptSlipContent
            order={activeReceiptOrder}
            settings={printerSettings}
            isPrintTarget
          />
        )}
      </div>
    </>
  );
}
