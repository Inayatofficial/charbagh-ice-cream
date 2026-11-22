import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  ChevronUp,
  Cloud,
  Delete,
  Download,
  Edit3,
  Image as ImageIcon,
  Lock,
  LogOut,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  AdminUser,
  Category,
  GasConfig,
  MenuItem,
  Order,
  OrderStatus,
  PrinterSettings,
  StorefrontSettings,
} from '../types';
import { CATEGORIES, PRESET_IMAGE_GALLERY } from '../data/initialData';
import { ReceiptSlipContent } from './ThermalReceiptModal';
import {
  pingGasEndpoint,
  pullAllFromGas,
  seedMenuToGas,
} from '../utils/gasApi';
import { readAndResizeImageFile } from '../utils/imageUpload';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface AdminPanelProps {
  admins: AdminUser[];
  loggedInAdmin: AdminUser | null;
  onLoginAdmin: (admin: AdminUser) => void;
  onLogoutAdmin: () => void;
  menu: MenuItem[];
  onUpsertMenuItem: (item: MenuItem) => void;
  onDeleteMenuItem: (id: string) => void;
  onToggleStock: (id: string) => void;
  onAdjustStockQty: (id: string, nextQty: number) => void;
  onReplaceMenuFromGas: (items: MenuItem[]) => void;
  orders: Order[];
  onUpdateOrderStatus: (orderId: string, status: OrderStatus) => void;
  onReplaceOrdersFromGas: (orders: Order[]) => void;
  onReplaceAdminsFromGas: (admins: AdminUser[]) => void;
  onReprintOrder: (order: Order) => void;
  printerSettings: PrinterSettings;
  onUpdatePrinterSettings: (settings: PrinterSettings) => void;
  storefrontSettings: StorefrontSettings;
  onUpdateStorefrontSettings: (settings: StorefrontSettings) => void;
  onResetStorefrontSettings: () => void;
  onBulkUpdateCategoryImage: (category: Category, imageUrl: string) => void;
  onUpdateAdmins: (admins: AdminUser[]) => void;
  gasConfig: GasConfig;
  onUpdateGasConfig: (config: GasConfig) => void;
  onOpenSetupGuide: () => void;
}

type AdminTab = 'orders' | 'analytics' | 'menu' | 'storefront' | 'printer' | 'sync';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  admins,
  loggedInAdmin,
  onLoginAdmin,
  onLogoutAdmin,
  menu,
  onUpsertMenuItem,
  onDeleteMenuItem,
  onToggleStock,
  onAdjustStockQty,
  onReplaceMenuFromGas,
  orders,
  onUpdateOrderStatus,
  onReplaceOrdersFromGas,
  onReplaceAdminsFromGas,
  onReprintOrder,
  printerSettings,
  onUpdatePrinterSettings,
  storefrontSettings,
  onUpdateStorefrontSettings,
  onResetStorefrontSettings,
  onBulkUpdateCategoryImage,
  onUpdateAdmins,
  gasConfig,
  onUpdateGasConfig,
  onOpenSetupGuide,
}) => {
  const [selectedAdminId, setSelectedAdminId] = useState<string>(admins[0]?.adminId || 'ADM-01');
  const [pinInput, setPinInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<AdminTab>('orders');

  // Menu Editor & Stock filter state
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isNewItem, setIsNewItem] = useState<boolean>(false);
  const [menuSearch, setMenuSearch] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'healthy' | 'soldout'>('all');

  // Orders & Daily Income filter state
  const todayIso = new Date().toISOString().slice(0, 10);
  const [orderStatusFilter, setOrderStatusFilter] = useState<'All' | OrderStatus>('All');
  const [orderDateFilter, setOrderDateFilter] = useState<string>(todayIso);
  const [orderSearch, setOrderSearch] = useState<string>('');
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});

  // Sales Analytics tab state
  const [analyticsDateFilter, setAnalyticsDateFilter] = useState<string>(todayIso);
  const [analyticsItemSort, setAnalyticsItemSort] = useState<'revenue' | 'qty'>('revenue');

  // Frontend & Pictures Editor state
  const [bulkCategory, setBulkCategory] = useState<Category>('Scoops');
  const [bulkCategoryUrl, setBulkCategoryUrl] = useState<string>(PRESET_IMAGE_GALLERY[0].url);
  const [bulkMessage, setBulkMessage] = useState<string>('');

  // GAS Sync state
  const [gasUrlDraft, setGasUrlDraft] = useState<string>(gasConfig.webAppUrl);
  const [syncMessage, setSyncMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const handlePinKey = (digit: string) => {
    setLoginError('');
    if (pinInput.length < 8) {
      setPinInput((p) => p + digit);
    }
  };

  const handlePinSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const matched = admins.find(
      (a) => a.adminId === selectedAdminId && a.passcode === pinInput.trim()
    );
    if (!matched) {
      setLoginError('Invalid passcode for the selected admin account.');
      return;
    }
    setPinInput('');
    setLoginError('');
    onLoginAdmin(matched);
  };

  const stockSummary = useMemo(() => {
    const depleted = menu.filter((m) => m.status === 'Sold Out' || m.stockQty <= 0).length;
    const nearDepletion = menu.filter(
      (m) => m.status !== 'Sold Out' && m.stockQty > 0 && m.stockQty <= m.lowStockThreshold
    ).length;
    const healthy = menu.length - depleted - nearDepletion;
    return { depleted, nearDepletion, needsAttention: depleted + nearDepletion, healthy };
  }, [menu]);

  const lowStockAlertItems = useMemo(() => {
    return menu
      .filter((m) => m.stockQty < m.lowStockThreshold)
      .sort((a, b) => a.stockQty - b.stockQty);
  }, [menu]);

  // Filtered menu for manager, prioritizing low-stock / depleted items first
  const filteredMenu = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return menu
      .filter((m) => {
        if (q) {
          const matches =
            m.name.toLowerCase().includes(q) ||
            m.category.toLowerCase().includes(q) ||
            m.id.toLowerCase().includes(q);
          if (!matches) return false;
        }
        const isDepleted = m.status === 'Sold Out' || m.stockQty <= 0;
        const isLow = !isDepleted && m.stockQty <= m.lowStockThreshold;
        if (stockFilter === 'low') return isLow || isDepleted;
        if (stockFilter === 'soldout') return isDepleted;
        if (stockFilter === 'healthy') return !isLow && !isDepleted;
        return true;
      })
      .sort((a, b) => {
        const score = (item: MenuItem) => {
          if (item.status === 'Sold Out' || item.stockQty <= 0) return 0;
          if (item.stockQty <= item.lowStockThreshold) return 1;
          return 2;
        };
        const diff = score(a) - score(b);
        return diff !== 0 ? diff : a.stockQty - b.stockQty;
      });
  }, [menu, menuSearch, stockFilter]);

  // Filtered orders & daily analytics
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (orderStatusFilter !== 'All' && o.status !== orderStatusFilter) return false;
      if (orderDateFilter) {
        const orderDay = new Date(o.timestamp).toISOString().slice(0, 10);
        if (orderDay !== orderDateFilter) return false;
      }
      if (orderSearch.trim()) {
        const q = orderSearch.trim().toLowerCase();
        if (!o.orderId.toLowerCase().includes(q) && !o.paymentType.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [orders, orderStatusFilter, orderDateFilter, orderSearch]);

  const analytics = useMemo(() => {
    const scopeOrders = orderDateFilter
      ? orders.filter((o) => new Date(o.timestamp).toISOString().slice(0, 10) === orderDateFilter)
      : orders;

    const grossIncome = scopeOrders.reduce((s, o) => s + o.total, 0);
    const subtotalSum = scopeOrders.reduce((s, o) => s + o.subtotal, 0);
    const discountSum = scopeOrders.reduce((s, o) => s + o.discountAmount, 0);
    const taxSum = scopeOrders.reduce((s, o) => s + o.taxAmount, 0);
    const netSales = Math.max(0, subtotalSum - discountSum);
    const avgOrder = scopeOrders.length ? Math.round(grossIncome / scopeOrders.length) : 0;
    const pendingCount = orders.filter(
      (o) => o.status === 'Pending' || o.status === 'Preparing'
    ).length;

    const cashOrders = scopeOrders.filter((o) => o.paymentType === 'Cash');
    const cardOrders = scopeOrders.filter((o) => o.paymentType === 'Card');
    const walletOrders = scopeOrders.filter((o) => o.paymentType === 'Digital Wallet');
    const dineInCount = scopeOrders.filter((o) => o.orderType === 'Dine-in').length;
    const takeawayCount = scopeOrders.filter((o) => o.orderType === 'Takeaway').length;

    const paymentSplit = {
      Cash: cashOrders.reduce((s, o) => s + o.total, 0),
      CashCount: cashOrders.length,
      Card: cardOrders.reduce((s, o) => s + o.total, 0),
      CardCount: cardOrders.length,
      Wallet: walletOrders.reduce((s, o) => s + o.total, 0),
      WalletCount: walletOrders.length,
    };

    // Top selling items for the selected date/scope
    const itemStats: Record<string, { name: string; qty: number; revenue: number }> = {};
    scopeOrders.forEach((o) => {
      o.items.forEach((line) => {
        if (!itemStats[line.name]) {
          itemStats[line.name] = { name: line.name, qty: 0, revenue: 0 };
        }
        itemStats[line.name].qty += line.quantity;
        itemStats[line.name].revenue += line.lineTotal;
      });
    });
    const topItems = Object.values(itemStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Day-by-Day Income History across all recorded orders
    const dayMap: Record<
      string,
      {
        date: string;
        orders: number;
        cash: number;
        card: number;
        wallet: number;
        tax: number;
        discounts: number;
        totalIncome: number;
      }
    > = {};

    orders.forEach((o) => {
      const day = new Date(o.timestamp).toISOString().slice(0, 10);
      if (!dayMap[day]) {
        dayMap[day] = {
          date: day,
          orders: 0,
          cash: 0,
          card: 0,
          wallet: 0,
          tax: 0,
          discounts: 0,
          totalIncome: 0,
        };
      }
      dayMap[day].orders += 1;
      if (o.paymentType === 'Cash') dayMap[day].cash += o.total;
      if (o.paymentType === 'Card') dayMap[day].card += o.total;
      if (o.paymentType === 'Digital Wallet') dayMap[day].wallet += o.total;
      dayMap[day].tax += o.taxAmount;
      dayMap[day].discounts += o.discountAmount;
      dayMap[day].totalIncome += o.total;
    });

    const dailyLedger = Object.values(dayMap).sort((a, b) => b.date.localeCompare(a.date));

    return {
      grossIncome,
      netSales,
      taxSum,
      discountSum,
      count: scopeOrders.length,
      avgOrder,
      pendingCount,
      dineInCount,
      takeawayCount,
      paymentSplit,
      topItems,
      dailyLedger,
    };
  }, [orders, orderDateFilter]);

  // Dedicated Sales Analytics derived directly from `orders` state
  const salesAnalytics = useMemo(() => {
    const getDayKey = (timestamp: string) => new Date(timestamp).toISOString().slice(0, 10);

    const todayOrders = orders.filter((o) => getDayKey(o.timestamp) === todayIso);
    const todayRevenue = todayOrders.reduce((s, o) => s + o.total, 0);
    const todayUnitsSold = todayOrders.reduce(
      (s, o) => s + o.items.reduce((itemSum, line) => itemSum + line.quantity, 0),
      0
    );

    const scopeOrders = analyticsDateFilter
      ? orders.filter((o) => getDayKey(o.timestamp) === analyticsDateFilter)
      : orders;

    const totalRevenue = scopeOrders.reduce((s, o) => s + o.total, 0);
    const subtotalRevenue = scopeOrders.reduce((s, o) => s + o.subtotal, 0);
    const totalDiscounts = scopeOrders.reduce((s, o) => s + o.discountAmount, 0);
    const totalTax = scopeOrders.reduce((s, o) => s + o.taxAmount, 0);
    const netRevenue = Math.max(0, subtotalRevenue - totalDiscounts);
    const orderCount = scopeOrders.length;
    const avgOrderValue = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;

    const statusCounts = {
      Completed: scopeOrders.filter((o) => o.status === 'Completed').length,
      Preparing: scopeOrders.filter((o) => o.status === 'Preparing').length,
      Pending: scopeOrders.filter((o) => o.status === 'Pending').length,
    };

    const channelCounts = {
      dineInOrders: scopeOrders.filter((o) => o.orderType === 'Dine-in').length,
      dineInRevenue: scopeOrders
        .filter((o) => o.orderType === 'Dine-in')
        .reduce((s, o) => s + o.total, 0),
      takeawayOrders: scopeOrders.filter((o) => o.orderType === 'Takeaway').length,
      takeawayRevenue: scopeOrders
        .filter((o) => o.orderType === 'Takeaway')
        .reduce((s, o) => s + o.total, 0),
    };

    const paymentBreakdown = (['Cash', 'Card', 'Digital Wallet'] as const).map((method) => {
      const matched = scopeOrders.filter((o) => o.paymentType === method);
      const revenue = matched.reduce((s, o) => s + o.total, 0);
      return {
        method,
        orders: matched.length,
        revenue,
        sharePct: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0,
      };
    });

    const menuLookup = new Map<string, MenuItem>();
    menu.forEach((m) => menuLookup.set(m.name.toLowerCase(), m));

    const itemMap: Record<
      string,
      {
        name: string;
        nameUrdu: string;
        category: string;
        ordersSet: Set<string>;
        unitsSold: number;
        singleUnits: number;
        doubleUnits: number;
        revenue: number;
      }
    > = {};

    const categoryMap: Record<string, { category: string; unitsSold: number; revenue: number }> = {};
    const vesselMap: Record<string, { vessel: string; unitsSold: number; revenue: number }> = {};
    const toppingMap: Record<string, { topping: string; count: number }> = {};

    let totalUnitsSold = 0;
    let totalItemizedRevenue = 0;

    scopeOrders.forEach((order) => {
      order.items.forEach((line) => {
        totalUnitsSold += line.quantity;
        totalItemizedRevenue += line.lineTotal;

        const matchedMenu = menuLookup.get(line.name.toLowerCase());
        const category = matchedMenu?.category || 'Custom / Other';

        if (!itemMap[line.name]) {
          itemMap[line.name] = {
            name: line.name,
            nameUrdu: line.nameUrdu || matchedMenu?.nameUrdu || '',
            category,
            ordersSet: new Set<string>(),
            unitsSold: 0,
            singleUnits: 0,
            doubleUnits: 0,
            revenue: 0,
          };
        }

        itemMap[line.name].ordersSet.add(order.orderId);
        itemMap[line.name].unitsSold += line.quantity;
        if (line.size === 'Double') {
          itemMap[line.name].doubleUnits += line.quantity;
        } else {
          itemMap[line.name].singleUnits += line.quantity;
        }
        itemMap[line.name].revenue += line.lineTotal;

        if (!categoryMap[category]) {
          categoryMap[category] = { category, unitsSold: 0, revenue: 0 };
        }
        categoryMap[category].unitsSold += line.quantity;
        categoryMap[category].revenue += line.lineTotal;

        const vesselName = line.vessel || 'Standard';
        if (!vesselMap[vesselName]) {
          vesselMap[vesselName] = { vessel: vesselName, unitsSold: 0, revenue: 0 };
        }
        vesselMap[vesselName].unitsSold += line.quantity;
        vesselMap[vesselName].revenue += line.lineTotal;

        line.toppings.forEach((top) => {
          if (!toppingMap[top]) {
            toppingMap[top] = { topping: top, count: 0 };
          }
          toppingMap[top].count += line.quantity;
        });
      });
    });

    const itemBreakdown = Object.values(itemMap)
      .map((entry) => ({
        name: entry.name,
        nameUrdu: entry.nameUrdu,
        category: entry.category,
        ordersCount: entry.ordersSet.size,
        unitsSold: entry.unitsSold,
        singleUnits: entry.singleUnits,
        doubleUnits: entry.doubleUnits,
        revenue: entry.revenue,
        avgUnitPrice: entry.unitsSold > 0 ? Math.round(entry.revenue / entry.unitsSold) : 0,
        revenueSharePct:
          totalItemizedRevenue > 0 ? Math.round((entry.revenue / totalItemizedRevenue) * 100) : 0,
      }))
      .sort((a, b) =>
        analyticsItemSort === 'qty'
          ? b.unitsSold - a.unitsSold || b.revenue - a.revenue
          : b.revenue - a.revenue || b.unitsSold - a.unitsSold
      );

    const categoryBreakdown = Object.values(categoryMap)
      .map((c) => ({
        ...c,
        sharePct: totalItemizedRevenue > 0 ? Math.round((c.revenue / totalItemizedRevenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    const vesselBreakdown = Object.values(vesselMap).sort((a, b) => b.unitsSold - a.unitsSold);
    const toppingBreakdown = Object.values(toppingMap).sort((a, b) => b.count - a.count);

    // Daily trend across all recorded days in `orders`
    const dailyMap: Record<
      string,
      { date: string; orderCount: number; unitsSold: number; revenue: number }
    > = {};
    orders.forEach((o) => {
      const day = getDayKey(o.timestamp);
      if (!dailyMap[day]) {
        dailyMap[day] = { date: day, orderCount: 0, unitsSold: 0, revenue: 0 };
      }
      dailyMap[day].orderCount += 1;
      dailyMap[day].revenue += o.total;
      dailyMap[day].unitsSold += o.items.reduce((s, l) => s + l.quantity, 0);
    });
    const dailySeries = Object.values(dailyMap).sort((a, b) => b.date.localeCompare(a.date));
    const maxDailyRevenue = dailySeries.reduce((m, d) => Math.max(m, d.revenue), 0);

    // Continuous 7-day chronological series ending today for the Recharts 'Daily Sales Trend' chart
    const [yr, mo, dy] = todayIso.split('-').map(Number);
    const past7DaysTrend = Array.from({ length: 7 }, (_, idx) => {
      const offsetDays = 6 - idx;
      const d = new Date(Date.UTC(yr, mo - 1, dy - offsetDays));
      const iso = d.toISOString().slice(0, 10);
      const dayEntry = dailyMap[iso];
      const shortLabel =
        iso === todayIso
          ? 'Today'
          : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      return {
        date: iso,
        shortLabel,
        revenue: dayEntry ? dayEntry.revenue : 0,
        orderCount: dayEntry ? dayEntry.orderCount : 0,
        unitsSold: dayEntry ? dayEntry.unitsSold : 0,
      };
    });
    const past7DaysRevenue = past7DaysTrend.reduce((s, d) => s + d.revenue, 0);
    const past7DaysOrders = past7DaysTrend.reduce((s, d) => s + d.orderCount, 0);

    return {
      todayRevenue,
      todayOrderCount: todayOrders.length,
      todayUnitsSold,
      totalRevenue,
      netRevenue,
      totalTax,
      totalDiscounts,
      orderCount,
      avgOrderValue,
      totalUnitsSold,
      totalItemizedRevenue,
      statusCounts,
      channelCounts,
      paymentBreakdown,
      itemBreakdown,
      categoryBreakdown,
      vesselBreakdown,
      toppingBreakdown,
      dailySeries,
      maxDailyRevenue,
      past7DaysTrend,
      past7DaysRevenue,
      past7DaysOrders,
    };
  }, [orders, menu, analyticsDateFilter, analyticsItemSort, todayIso]);

  const handleExportSalesBreakdownCsv = () => {
    const rows = [
      ['DateScope', 'ItemName', 'Category', 'OrdersAppeared', 'UnitsSold', 'SingleUnits', 'DoubleUnits', 'AvgUnitPricePKR', 'ItemRevenuePKR', 'RevenueSharePct'],
      ...salesAnalytics.itemBreakdown.map((item) => [
        analyticsDateFilter || 'All Time',
        item.name,
        item.category,
        String(item.ordersCount),
        String(item.unitsSold),
        String(item.singleUnits),
        String(item.doubleUnits),
        String(item.avgUnitPrice),
        String(item.revenue),
        `${item.revenueSharePct}%`,
      ]),
    ];
    const csvContent = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `charbagh-sales-analytics-${analyticsDateFilter || 'all-dates'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportIncomeCsv = () => {
    const rows = [
      ['OrderID', 'Timestamp', 'OrderType', 'PaymentType', 'Status', 'AdminID', 'Subtotal', 'Discount', 'Tax', 'Total', 'Items'],
      ...filteredOrders.map((o) => [
        o.orderId,
        o.timestamp,
        o.orderType,
        o.paymentType,
        o.status,
        o.adminId,
        String(o.subtotal),
        String(o.discountAmount),
        String(o.taxAmount),
        String(o.total),
        o.items.map((i) => `${i.quantity}x ${i.name} (${i.size}/${i.vessel})`).join(' | '),
      ]),
    ];
    const csvContent = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `charbagh-income-${orderDateFilter || 'all-dates'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openNewItemModal = () => {
    setIsNewItem(true);
    setEditingItem({
      id: `CB-${Math.floor(100 + Math.random() * 899)}`,
      name: '',
      nameUrdu: '',
      category: 'Scoops',
      price: 380,
      imageUrl: PRESET_IMAGE_GALLERY[0].url,
      status: 'In Stock',
      stockQty: 20,
      lowStockThreshold: 8,
      description: '',
      descriptionUrdu: '',
      tag: '',
    });
  };

  const handleSaveMenuModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editingItem.name.trim()) return;
    onUpsertMenuItem(editingItem);
    setEditingItem(null);
  };

  const handleTestGas = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    onUpdateGasConfig({ ...gasConfig, webAppUrl: gasUrlDraft.trim() });
    const res = await pingGasEndpoint(gasUrlDraft);
    setSyncMessage({ ok: res.ok, text: res.message });
    setIsSyncing(false);
  };

  const handlePullGas = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    onUpdateGasConfig({ ...gasConfig, webAppUrl: gasUrlDraft.trim() });
    const res = await pullAllFromGas(gasUrlDraft);
    if (!res.ok) {
      setSyncMessage({ ok: false, text: res.error || 'Pull failed.' });
    } else {
      if (res.menu) onReplaceMenuFromGas(res.menu);
      if (res.orders) onReplaceOrdersFromGas(res.orders);
      if (res.admins) onReplaceAdminsFromGas(res.admins);
      onUpdateGasConfig({
        ...gasConfig,
        webAppUrl: gasUrlDraft.trim(),
        lastSyncAt: new Date().toISOString(),
      });
      setSyncMessage({
        ok: true,
        text: `Pulled ${res.menu?.length ?? 0} menu items and ${res.orders?.length ?? 0} orders from Google Sheets.`,
      });
    }
    setIsSyncing(false);
  };

  const handleSeedMenuToGas = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    onUpdateGasConfig({ ...gasConfig, webAppUrl: gasUrlDraft.trim() });
    const res = await seedMenuToGas(gasUrlDraft, menu);
    setSyncMessage({
      ok: res.ok,
      text: res.ok
        ? `Pushed all ${menu.length} menu items to the Google Sheets Menu tab.`
        : res.error || 'Failed to push menu.',
    });
    setIsSyncing(false);
  };

  // =========================================================================
  // AUTHENTICATION GATE (DUAL ADMIN: OWNER + MANAGER)
  // =========================================================================
  if (!loggedInAdmin) {
    return (
      <section className="mx-auto max-w-xl px-4 py-10 sm:py-16">
        <div className="rounded-3xl border border-[#211a15]/10 bg-white p-6 shadow-[0_12px_32px_-8px_rgba(41,34,29,0.1)] sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f9ebe3] text-[#8d4b00]">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold text-[#211a15]">
                Staff & Admin Portal
              </h1>
              <p className="text-sm text-[#554336]">
                Select Owner or Manager profile and enter passcode
              </p>
            </div>
          </div>

          {/* 2 Distinct Admin Selector Cards */}
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {admins.map((admin) => {
              const active = selectedAdminId === admin.adminId;
              return (
                <button
                  key={admin.adminId}
                  type="button"
                  onClick={() => {
                    setSelectedAdminId(admin.adminId);
                    setLoginError('');
                  }}
                  className={`flex min-h-[72px] cursor-pointer items-center justify-between rounded-2xl border-2 p-4 text-left transition-all ${
                    active
                      ? 'border-[#d97706] bg-[#fffbeb]'
                      : 'border-[#dbc2b0]/70 bg-[#fff8f5] hover:border-[#8d4b00]/40'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-[#8d4b00]">
                      {admin.role} · {admin.adminId}
                    </div>
                    <div className="font-display text-base font-bold text-[#211a15]">
                      {admin.name}
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

          {/* Passcode Display + Touch Keypad */}
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <label htmlFor="admin-pin-input" className="mb-1.5 block text-xs font-bold text-[#554336]">
                Passcode / PIN
              </label>
              <input
                id="admin-pin-input"
                type="password"
                inputMode="numeric"
                value={pinInput}
                onChange={(e) => {
                  setLoginError('');
                  setPinInput(e.target.value);
                }}
                placeholder="Enter PIN (e.g. 1122 or 3344)"
                className="font-receipt h-14 w-full rounded-xl border-2 border-[#dbc2b0] bg-[#fff8f5] px-4 text-center text-xl font-bold tracking-[0.35em] text-[#211a15] focus:border-[#d97706] focus:outline-none"
              />
            </div>

            {loginError && (
              <p className="rounded-xl bg-[#ffdad6] px-4 py-2.5 text-center text-sm font-semibold text-[#93000a]">
                {loginError}
              </p>
            )}

            {/* Touch Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Clear', '0', 'Del'].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (key === 'Clear') {
                      setPinInput('');
                      setLoginError('');
                    } else if (key === 'Del') {
                      setPinInput((p) => p.slice(0, -1));
                    } else {
                      handlePinKey(key);
                    }
                  }}
                  className="font-display flex min-h-[54px] cursor-pointer items-center justify-center rounded-xl border border-[#dbc2b0]/70 bg-[#fff8f5] text-lg font-bold text-[#211a15] transition-colors hover:bg-[#f3e6dd] active:scale-[0.97]"
                >
                  {key === 'Del' ? <Delete className="h-5 w-5" /> : key}
                </button>
              ))}
            </div>

            <button
              type="submit"
              className="font-display flex min-h-[60px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#d97706] text-base font-extrabold text-white shadow-md transition-all hover:bg-[#b15f00] active:scale-[0.98]"
            >
              <ShieldCheck className="h-5 w-5" />
              Unlock Admin Dashboard
            </button>

            <p className="text-center text-xs text-[#554336]">
              Demo Passcodes · Owner (ADM-01): <span className="font-receipt font-bold">1122</span> · Manager (ADM-02): <span className="font-receipt font-bold">3344</span>
            </p>
          </form>
        </div>
      </section>
    );
  }

  // =========================================================================
  // AUTHENTICATED ADMIN DASHBOARD
  // =========================================================================
  return (
    <section className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Admin Header Strip */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#211a15]/10 bg-white px-5 py-4 shadow-sm">
        <div>
          <div className="text-xs font-bold text-[#2d6a4f]">
            Signed in as {loggedInAdmin.role} · {loggedInAdmin.adminId}
          </div>
          <h1 className="font-display text-2xl font-extrabold text-[#211a15]">
            {loggedInAdmin.name} — Operations Console
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-[#f3e6dd] p-1">
            {(
              [
                { id: 'orders', label: 'Daily Income & Orders' },
                { id: 'analytics', label: 'Sales Analytics' },
                { id: 'menu', label: 'Menu & Stock' },
                { id: 'storefront', label: 'Frontend & Pictures' },
                { id: 'printer', label: 'Thermal Receipt' },
                { id: 'sync', label: 'Google Sheets Sync' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[42px] shrink-0 cursor-pointer rounded-lg px-3.5 text-xs font-bold whitespace-nowrap transition-all sm:text-sm ${
                  activeTab === tab.id
                    ? 'bg-white text-[#211a15] shadow-sm'
                    : 'text-[#554336] hover:text-[#211a15]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onLogoutAdmin}
            className="flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#dbc2b0] bg-white px-3.5 text-xs font-bold text-[#ba1a1a] hover:bg-[#ffdad6]/40"
          >
            <LogOut className="h-4 w-4" />
            Lock
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* LOW STOCK ALERT DASHBOARD WIDGET (stockQty < lowStockThreshold)    */}
      {/* ================================================================= */}
      {lowStockAlertItems.length > 0 ? (
        <div
          role="region"
          aria-label="Low Stock Alert"
          data-testid="low-stock-alert-widget"
          className="mb-6 rounded-2xl border-2 border-[#ba1a1a]/65 bg-gradient-to-br from-[#ffdad6]/55 via-[#fff4f2] to-[#fff8f5] p-5 shadow-sm"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ba1a1a] text-white shadow-xs">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-base font-extrabold text-[#93000a]">
                  Low Stock Alert
                </h2>
                <p className="tabular-nums text-xs font-semibold text-[#93000a]/90">
                  {lowStockAlertItems.length}{' '}
                  {lowStockAlertItems.length === 1 ? 'item has' : 'items have'} stock quantity
                  below threshold
                </p>
              </div>
            </div>

            {activeTab !== 'menu' && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('menu');
                  setStockFilter('low');
                }}
                className="min-h-[40px] shrink-0 cursor-pointer rounded-xl bg-[#ba1a1a] px-4 text-xs font-bold whitespace-nowrap text-white transition-colors hover:bg-[#93000a]"
              >
                Open Stock Manager
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {lowStockAlertItems.map((item) => {
              const pctOfThreshold =
                item.lowStockThreshold > 0
                  ? Math.max(4, Math.min(100, Math.round((item.stockQty / item.lowStockThreshold) * 100)))
                  : 0;
              return (
                <div
                  key={item.id}
                  data-testid={`low-stock-indicator-${item.id}`}
                  className="flex flex-col justify-between gap-3 rounded-xl border-2 border-[#ba1a1a]/45 bg-white p-3.5 shadow-xs"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className={`h-12 w-12 shrink-0 rounded-lg bg-[#f3e6dd] object-cover ${
                        item.stockQty <= 0 ? 'grayscale' : ''
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold text-[#211a15]">{item.name}</div>
                      <div className="text-[11px] font-medium text-[#554336]">
                        {item.id} · {item.category}
                      </div>
                      <div className="tabular-nums mt-1 flex items-center gap-1.5 text-xs font-extrabold text-[#ba1a1a]">
                        <span>Qty: {item.stockQty}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-[#93000a]/85">
                          Threshold: {item.lowStockThreshold}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#ffdad6]">
                      <div
                        className="h-full rounded-full bg-[#ba1a1a]"
                        style={{ width: `${item.stockQty <= 0 ? 0 : pctOfThreshold}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="tabular-nums text-[11px] font-bold text-[#93000a]">
                        {item.stockQty <= 0
                          ? 'Out of stock'
                          : `${item.lowStockThreshold - item.stockQty} below min`}
                      </span>
                      <button
                        type="button"
                        onClick={() => onAdjustStockQty(item.id, item.stockQty + 10)}
                        className="tabular-nums min-h-[32px] cursor-pointer rounded-lg bg-[#2d6a4f] px-2.5 text-[11px] font-bold text-white transition-colors hover:bg-[#0e5138]"
                      >
                        +10 Restock
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          role="region"
          aria-label="Low Stock Alert"
          data-testid="low-stock-alert-widget"
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#2d6a4f]/35 bg-[#aeeecb]/20 px-5 py-3.5"
        >
          <div className="flex items-center gap-2.5 text-xs font-bold text-[#0e5138]">
            <Check className="h-4 w-4 shrink-0" />
            <span>
              Low Stock Alert · All {menu.length} menu items meet or exceed their low-stock threshold.
            </span>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 1: DAILY INCOME, ANALYTICS & ORDER DETAILS                     */}
      {/* ================================================================= */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {/* Date Scope Bar + Export */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#211a15]/10 bg-white px-5 py-3.5">
            <div>
              <h2 className="font-display text-lg font-extrabold text-[#211a15]">
                Daily Income & Transaction Details
              </h2>
              <p className="text-xs text-[#554336]">
                {orderDateFilter
                  ? `Showing financial breakdown for ${orderDateFilter}`
                  : 'Showing cumulative financial breakdown across all dates'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setOrderDateFilter(todayIso)}
                className={`min-h-[40px] cursor-pointer rounded-xl px-3.5 text-xs font-bold ${
                  orderDateFilter === todayIso
                    ? 'bg-[#211a15] text-white'
                    : 'bg-[#f3e6dd] text-[#554336] hover:text-[#211a15]'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setOrderDateFilter('')}
                className={`min-h-[40px] cursor-pointer rounded-xl px-3.5 text-xs font-bold ${
                  orderDateFilter === ''
                    ? 'bg-[#211a15] text-white'
                    : 'bg-[#f3e6dd] text-[#554336] hover:text-[#211a15]'
                }`}
              >
                All Time
              </button>
              <input
                type="date"
                value={orderDateFilter}
                onChange={(e) => setOrderDateFilter(e.target.value)}
                aria-label="Filter income and orders by date"
                className="h-10 rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-xs font-bold text-[#211a15] focus:border-[#d97706] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleExportIncomeCsv}
                className="flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#2d6a4f] bg-white px-3.5 text-xs font-bold text-[#2d6a4f] hover:bg-[#aeeecb]/20"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
            </div>
          </div>

          {/* 4-column Detailed Income KPI Strip */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#211a15]/10 bg-white p-5">
              <div className="text-xs font-bold text-[#554336]">
                {orderDateFilter ? 'Daily Gross Income' : 'Total Gross Income'}
              </div>
              <div className="font-display tabular-nums mt-1 text-2xl font-extrabold text-[#211a15]">
                PKR {analytics.grossIncome.toLocaleString()}
              </div>
              <div className="tabular-nums mt-1 text-xs font-medium text-[#2d6a4f]">
                Net Sales: PKR {analytics.netSales.toLocaleString()} · Tax: PKR {analytics.taxSum.toLocaleString()}
              </div>
            </div>

            <div className="rounded-2xl border border-[#211a15]/10 bg-white p-5">
              <div className="text-xs font-bold text-[#554336]">Payment Channel Income</div>
              <div className="tabular-nums mt-1.5 space-y-0.5 text-xs font-bold text-[#211a15]">
                <div className="flex justify-between">
                  <span>Cash ({analytics.paymentSplit.CashCount})</span>
                  <span>PKR {analytics.paymentSplit.Cash.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Card ({analytics.paymentSplit.CardCount})</span>
                  <span>PKR {analytics.paymentSplit.Card.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Digital Wallet ({analytics.paymentSplit.WalletCount})</span>
                  <span>PKR {analytics.paymentSplit.Wallet.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#211a15]/10 bg-white p-5">
              <div className="text-xs font-bold text-[#554336]">Orders & Average Ticket</div>
              <div className="font-display tabular-nums mt-1 text-2xl font-extrabold text-[#211a15]">
                {analytics.count} Orders
              </div>
              <div className="tabular-nums mt-1 text-xs text-[#554336]">
                Avg: PKR {analytics.avgOrder.toLocaleString()} · Dine-in {analytics.dineInCount} · Takeaway {analytics.takeawayCount}
              </div>
            </div>

            <div className="rounded-2xl border border-[#211a15]/10 bg-white p-5">
              <div className="text-xs font-bold text-[#554336]">Discounts & Kitchen Queue</div>
              <div className="font-display tabular-nums mt-1 text-2xl font-extrabold text-[#d97706]">
                {analytics.pendingCount} Active
              </div>
              <div className="tabular-nums mt-1 text-xs text-[#554336]">
                Discounts Given: PKR {analytics.discountSum.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Day-by-Day Daily Income Ledger & Top Selling Flavors */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="rounded-2xl border border-[#211a15]/10 bg-white p-5 lg:col-span-8">
              <h3 className="font-display mb-3 text-base font-extrabold text-[#211a15]">
                Daily Income Ledger (Click a date to inspect)
              </h3>
              {analytics.dailyLedger.length === 0 ? (
                <p className="text-sm text-[#554336]">No income entries recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#dbc2b0]/70 text-[#554336]">
                        <th className="py-2 pr-3 font-bold">Date</th>
                        <th className="py-2 pr-3 font-bold">Orders</th>
                        <th className="py-2 pr-3 font-bold">Cash</th>
                        <th className="py-2 pr-3 font-bold">Card</th>
                        <th className="py-2 pr-3 font-bold">Wallet</th>
                        <th className="py-2 pr-3 font-bold">Tax</th>
                        <th className="py-2 text-right font-bold">Daily Total</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums divide-y divide-[#dbc2b0]/40">
                      {analytics.dailyLedger.map((row) => {
                        const selected = orderDateFilter === row.date;
                        return (
                          <tr
                            key={row.date}
                            onClick={() => setOrderDateFilter(row.date)}
                            className={`cursor-pointer transition-colors ${
                              selected ? 'bg-[#fffbeb] font-bold' : 'hover:bg-[#fff8f5]'
                            }`}
                          >
                            <td className="py-2.5 pr-3 text-[#211a15]">
                              {row.date === todayIso ? `${row.date} (Today)` : row.date}
                            </td>
                            <td className="py-2.5 pr-3">{row.orders}</td>
                            <td className="py-2.5 pr-3">PKR {row.cash.toLocaleString()}</td>
                            <td className="py-2.5 pr-3">PKR {row.card.toLocaleString()}</td>
                            <td className="py-2.5 pr-3">PKR {row.wallet.toLocaleString()}</td>
                            <td className="py-2.5 pr-3">PKR {row.tax.toLocaleString()}</td>
                            <td className="py-2.5 text-right font-extrabold text-[#2d6a4f]">
                              PKR {row.totalIncome.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#211a15]/10 bg-white p-5 lg:col-span-4">
              <h3 className="font-display mb-3 text-base font-extrabold text-[#211a15]">
                Top Selling Items
              </h3>
              {analytics.topItems.length === 0 ? (
                <p className="text-sm text-[#554336]">No items sold in selected period.</p>
              ) : (
                <ul className="tabular-nums divide-y divide-[#dbc2b0]/40 text-xs">
                  {analytics.topItems.map((it) => (
                    <li key={it.name} className="flex items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate font-bold text-[#211a15]">{it.name}</div>
                        <div className="text-[#554336]">{it.qty} units sold</div>
                      </div>
                      <div className="shrink-0 font-extrabold text-[#8d4b00]">
                        PKR {it.revenue.toLocaleString()}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Order Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#211a15]/10 bg-white p-4">
            <div className="flex flex-wrap items-center gap-1 rounded-xl bg-[#f3e6dd] p-1">
              {(['All', 'Pending', 'Preparing', 'Completed'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setOrderStatusFilter(status)}
                  className={`min-h-[40px] cursor-pointer rounded-lg px-3.5 text-xs font-bold whitespace-nowrap transition-all ${
                    orderStatusFilter === status
                      ? 'bg-white text-[#211a15] shadow-sm'
                      : 'text-[#554336] hover:text-[#211a15]'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px] flex-1 max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#887364]" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Search Order ID or payment..."
                className="h-11 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] pr-3 pl-9 text-sm text-[#211a15] focus:border-[#d97706] focus:outline-none"
              />
            </div>
          </div>

          {/* Detailed Orders List */}
          {filteredOrders.length === 0 ? (
            <div className="rounded-2xl border border-[#211a15]/10 bg-white p-12 text-center">
              <BarChart3 className="mx-auto mb-2 h-10 w-10 text-[#887364]" />
              <p className="font-display text-lg font-bold text-[#211a15]">No matching orders</p>
              <p className="mt-1 text-sm text-[#554336]">
                Adjust your status or date filter, or place a new kiosk order.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const nextStatus: OrderStatus | null =
                  order.status === 'Pending'
                    ? 'Preparing'
                    : order.status === 'Preparing'
                      ? 'Completed'
                      : null;
                const isExpanded = Boolean(expandedOrderIds[order.orderId]);

                return (
                  <div
                    key={order.orderId}
                    className="rounded-2xl border border-[#211a15]/10 bg-white p-5"
                  >
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                          <span className="font-receipt text-base font-bold text-[#211a15]">
                            {order.orderId}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#554336]">
                            {new Date(order.timestamp).toLocaleString()}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#8d4b00]">{order.orderType}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#2d6a4f]">{order.paymentType}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#554336]">By {order.adminId}</span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              order.status === 'Completed'
                                ? 'text-[#2d6a4f]'
                                : order.status === 'Preparing'
                                  ? 'text-[#d97706]'
                                  : 'text-[#ba0035]'
                            }
                          >
                            {order.status}
                          </span>
                        </div>

                        <div className="text-sm text-[#554336]">
                          {order.items
                            .map((i) => `${i.quantity}x ${i.name} (${i.size})`)
                            .join(' · ')}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="font-display tabular-nums mr-1 text-lg font-extrabold text-[#211a15]">
                          PKR {order.total.toLocaleString()}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedOrderIds((prev) => ({
                              ...prev,
                              [order.orderId]: !prev[order.orderId],
                            }))
                          }
                          className="flex min-h-[44px] cursor-pointer items-center gap-1 rounded-xl border border-[#dbc2b0] bg-white px-3 text-xs font-bold text-[#554336] hover:bg-[#fff8f5]"
                        >
                          {isExpanded ? (
                            <>
                              Hide Details <ChevronUp className="h-3.5 w-3.5" />
                            </>
                          ) : (
                            <>
                              View Details <ChevronDown className="h-3.5 w-3.5" />
                            </>
                          )}
                        </button>

                        {nextStatus && (
                          <button
                            type="button"
                            onClick={() => onUpdateOrderStatus(order.orderId, nextStatus)}
                            className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl bg-[#2d6a4f] px-4 text-xs font-bold text-white transition-colors hover:bg-[#0e5138]"
                          >
                            Mark {nextStatus}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onReprintOrder(order)}
                          className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-4 text-xs font-bold text-[#211a15] hover:bg-[#f3e6dd]"
                        >
                          <Printer className="h-4 w-4 text-[#8d4b00]" />
                          Reprint Receipt
                        </button>
                      </div>
                    </div>

                    {/* Full Expandable Itemized & Financial Breakdown */}
                    {isExpanded && (
                      <div className="tabular-nums mt-4 rounded-xl border border-[#dbc2b0]/60 bg-[#fff8f5] p-4 text-xs">
                        <div className="mb-2 font-bold text-[#211a15]">Itemized Breakdown</div>
                        <div className="divide-y divide-[#dbc2b0]/50">
                          {order.items.map((line, idx) => (
                            <div key={idx} className="flex flex-wrap items-center justify-between gap-2 py-2">
                              <div>
                                <span className="font-bold text-[#211a15]">
                                  {line.quantity}x {line.name}
                                </span>{' '}
                                <span className="text-[#554336]">
                                  ({line.size} · {line.vessel}
                                  {line.secondFlavor ? ` · 2nd: ${line.secondFlavor}` : ''}
                                  {line.toppings.length > 0
                                    ? ` · Toppings: ${line.toppings.join(', ')}`
                                    : ''}
                                  )
                                </span>
                              </div>
                              <div className="font-bold text-[#211a15]">
                                PKR {line.unitPrice.toLocaleString()} × {line.quantity} = PKR{' '}
                                {line.lineTotal.toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-end gap-5 border-t border-dashed border-[#211a15]/25 pt-2.5 text-xs font-bold text-[#554336]">
                          <span>Subtotal: PKR {order.subtotal.toLocaleString()}</span>
                          <span>Discount: -PKR {order.discountAmount.toLocaleString()}</span>
                          <span>Tax: PKR {order.taxAmount.toLocaleString()}</span>
                          <span className="text-sm text-[#211a15]">
                            Grand Total: PKR {order.total.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: SALES ANALYTICS (REVENUE, ORDER COUNT & ITEMS SOLD)        */}
      {/* ================================================================= */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Date Filter & Export Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#211a15]/10 bg-white px-5 py-4">
            <div>
              <h2 className="font-display text-lg font-extrabold text-[#211a15]">
                Sales Analytics & Item Breakdown
              </h2>
              <p className="text-xs text-[#554336]">
                {analyticsDateFilter
                  ? `Calculated from live orders for ${analyticsDateFilter === todayIso ? `${analyticsDateFilter} (Today)` : analyticsDateFilter}`
                  : 'Calculated across all recorded orders'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setAnalyticsDateFilter(todayIso)}
                className={`min-h-[40px] shrink-0 cursor-pointer rounded-xl px-3.5 text-xs font-bold whitespace-nowrap ${
                  analyticsDateFilter === todayIso
                    ? 'bg-[#211a15] text-white'
                    : 'bg-[#f3e6dd] text-[#554336] hover:text-[#211a15]'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setAnalyticsDateFilter('')}
                className={`min-h-[40px] shrink-0 cursor-pointer rounded-xl px-3.5 text-xs font-bold whitespace-nowrap ${
                  analyticsDateFilter === ''
                    ? 'bg-[#211a15] text-white'
                    : 'bg-[#f3e6dd] text-[#554336] hover:text-[#211a15]'
                }`}
              >
                All Dates
              </button>
              <input
                type="date"
                value={analyticsDateFilter}
                onChange={(e) => setAnalyticsDateFilter(e.target.value)}
                aria-label="Filter sales analytics by date"
                className="h-10 rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-xs font-bold text-[#211a15] focus:border-[#d97706] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleExportSalesBreakdownCsv}
                className="flex min-h-[40px] shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-[#2d6a4f] bg-white px-3.5 text-xs font-bold whitespace-nowrap text-[#2d6a4f] hover:bg-[#aeeecb]/20"
              >
                <Download className="h-3.5 w-3.5" />
                Export Breakdown CSV
              </button>
            </div>
          </div>

          {/* Primary KPI Cards: Daily Revenue, Order Count, Items Sold, Average Order */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#211a15]/10 bg-white p-5">
              <div className="text-xs font-bold text-[#554336]">
                {analyticsDateFilter ? 'Total Daily Revenue' : 'Cumulative Revenue'}
              </div>
              <div className="font-display tabular-nums mt-1.5 text-2xl font-extrabold text-[#2d6a4f]">
                PKR {salesAnalytics.totalRevenue.toLocaleString()}
              </div>
              <div className="tabular-nums mt-1.5 text-xs text-[#554336]">
                Net: PKR {salesAnalytics.netRevenue.toLocaleString()} · Tax: PKR{' '}
                {salesAnalytics.totalTax.toLocaleString()}
              </div>
              {analyticsDateFilter !== todayIso && (
                <div className="tabular-nums mt-1 text-[11px] font-bold text-[#8d4b00]">
                  Today&apos;s Revenue: PKR {salesAnalytics.todayRevenue.toLocaleString()}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#211a15]/10 bg-white p-5">
              <div className="text-xs font-bold text-[#554336]">
                {analyticsDateFilter ? 'Daily Order Count' : 'Total Order Count'}
              </div>
              <div className="font-display tabular-nums mt-1.5 text-2xl font-extrabold text-[#211a15]">
                {salesAnalytics.orderCount} Orders
              </div>
              <div className="tabular-nums mt-1.5 text-xs text-[#554336]">
                Completed {salesAnalytics.statusCounts.Completed} · Preparing{' '}
                {salesAnalytics.statusCounts.Preparing} · Pending {salesAnalytics.statusCounts.Pending}
              </div>
              {analyticsDateFilter !== todayIso && (
                <div className="tabular-nums mt-1 text-[11px] font-bold text-[#8d4b00]">
                  Today: {salesAnalytics.todayOrderCount} Orders
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#211a15]/10 bg-white p-5">
              <div className="text-xs font-bold text-[#554336]">Total Units Sold</div>
              <div className="font-display tabular-nums mt-1.5 text-2xl font-extrabold text-[#211a15]">
                {salesAnalytics.totalUnitsSold} Items
              </div>
              <div className="tabular-nums mt-1.5 text-xs text-[#554336]">
                Across {salesAnalytics.itemBreakdown.length} distinct menu flavors
              </div>
            </div>

            <div className="rounded-2xl border border-[#211a15]/10 bg-white p-5">
              <div className="text-xs font-bold text-[#554336]">Average Order Value</div>
              <div className="font-display tabular-nums mt-1.5 text-2xl font-extrabold text-[#8d4b00]">
                PKR {salesAnalytics.avgOrderValue.toLocaleString()}
              </div>
              <div className="tabular-nums mt-1.5 text-xs text-[#554336]">
                Discounts: PKR {salesAnalytics.totalDiscounts.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Daily Sales Trend (Past 7 Days) — Recharts Line Chart */}
          <div className="rounded-2xl border border-[#211a15]/10 bg-white p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-extrabold text-[#211a15]">
                  Daily Sales Trend
                </h3>
                <p className="text-xs text-[#554336]">
                  Total daily revenue across the past 7 days based on recorded orders
                </p>
              </div>
              <div className="tabular-nums text-right text-xs">
                <div className="font-extrabold text-[#2d6a4f]">
                  7-Day Total: PKR {salesAnalytics.past7DaysRevenue.toLocaleString()}
                </div>
                <div className="text-[#554336]">
                  {salesAnalytics.past7DaysOrders} orders over 7 days
                </div>
              </div>
            </div>

            <div className="h-[280px] w-full min-w-0">
              <ResponsiveContainer width="100%" height={280} minWidth={0}>
                <LineChart
                  data={salesAnalytics.past7DaysTrend}
                  margin={{ top: 12, right: 16, left: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#dbc2b0"
                    strokeOpacity={0.55}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="shortLabel"
                    tick={{ fontSize: 12, fill: '#554336', fontWeight: 600 }}
                    axisLine={{ stroke: '#dbc2b0' }}
                    tickLine={false}
                    dy={6}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#554336' }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                    tickFormatter={(val: number) =>
                      val >= 1000
                        ? `Rs ${Number((val / 1000).toFixed(val % 1000 === 0 ? 0 : 1))}k`
                        : `Rs ${val}`
                    }
                  />
                  <Tooltip
                    cursor={{ stroke: '#dbc2b0', strokeWidth: 1, strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const point = payload[0].payload as {
                        date: string;
                        shortLabel: string;
                        revenue: number;
                        orderCount: number;
                        unitsSold: number;
                      };
                      return (
                        <div className="tabular-nums rounded-xl border border-[#dbc2b0] bg-white px-3.5 py-2.5 text-xs shadow-md">
                          <div className="font-bold text-[#211a15]">
                            {point.date} {point.shortLabel === 'Today' ? '(Today)' : ''}
                          </div>
                          <div className="mt-1 font-extrabold text-[#2d6a4f]">
                            Revenue: PKR {point.revenue.toLocaleString()}
                          </div>
                          <div className="mt-0.5 text-[#554336]">
                            {point.orderCount} orders · {point.unitsSold} items sold
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Daily Revenue"
                    stroke="#d97706"
                    strokeWidth={3}
                    dot={{ r: 4.5, fill: '#fff8f5', stroke: '#d97706', strokeWidth: 2.5 }}
                    activeDot={{ r: 6.5, fill: '#2d6a4f', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Complete Breakdown of Items Sold */}
          <div className="rounded-2xl border border-[#211a15]/10 bg-white p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-extrabold text-[#211a15]">
                  Breakdown of Items Sold
                </h3>
                <p className="tabular-nums text-xs text-[#554336]">
                  Every item sold in {salesAnalytics.orderCount} orders ·{' '}
                  {salesAnalytics.totalUnitsSold} total units · PKR{' '}
                  {salesAnalytics.totalItemizedRevenue.toLocaleString()} itemized subtotal
                </p>
              </div>

              <div className="flex items-center gap-1 rounded-xl bg-[#f3e6dd] p-1">
                <button
                  type="button"
                  onClick={() => setAnalyticsItemSort('revenue')}
                  className={`min-h-[36px] cursor-pointer rounded-lg px-3 text-xs font-bold whitespace-nowrap ${
                    analyticsItemSort === 'revenue'
                      ? 'bg-white text-[#211a15] shadow-sm'
                      : 'text-[#554336] hover:text-[#211a15]'
                  }`}
                >
                  Sort by Revenue
                </button>
                <button
                  type="button"
                  onClick={() => setAnalyticsItemSort('qty')}
                  className={`min-h-[36px] cursor-pointer rounded-lg px-3 text-xs font-bold whitespace-nowrap ${
                    analyticsItemSort === 'qty'
                      ? 'bg-white text-[#211a15] shadow-sm'
                      : 'text-[#554336] hover:text-[#211a15]'
                  }`}
                >
                  Sort by Units Sold
                </button>
              </div>
            </div>

            {salesAnalytics.itemBreakdown.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#dbc2b0] bg-[#fff8f5] p-8 text-center">
                <BarChart3 className="mx-auto mb-2 h-8 w-8 text-[#887364]" />
                <p className="font-display text-sm font-bold text-[#211a15]">
                  No items sold for this date filter
                </p>
                <p className="mt-1 text-xs text-[#554336]">
                  Switch to All Dates or place an order from the Kiosk Menu to see itemized sales.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#dbc2b0]/70 text-[#554336]">
                      <th className="py-2.5 pr-3 font-bold">#</th>
                      <th className="py-2.5 pr-3 font-bold">Item Name</th>
                      <th className="py-2.5 pr-3 font-bold">Category</th>
                      <th className="py-2.5 pr-3 text-right font-bold">Orders</th>
                      <th className="py-2.5 pr-3 text-right font-bold">Single / Double</th>
                      <th className="py-2.5 pr-3 text-right font-bold">Units Sold</th>
                      <th className="py-2.5 pr-3 text-right font-bold">Avg Price</th>
                      <th className="py-2.5 pr-3 text-right font-bold">Revenue</th>
                      <th className="py-2.5 text-right font-bold">Share</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums divide-y divide-[#dbc2b0]/40">
                    {salesAnalytics.itemBreakdown.map((item, idx) => (
                      <tr key={item.name} className="hover:bg-[#fff8f5]">
                        <td className="py-3 pr-3 font-bold text-[#887364]">{idx + 1}</td>
                        <td className="py-3 pr-3">
                          <div className="font-bold text-[#211a15]">{item.name}</div>
                          {item.nameUrdu && (
                            <div className="font-urdu text-xs text-[#554336]">{item.nameUrdu}</div>
                          )}
                        </td>
                        <td className="py-3 pr-3 font-semibold text-[#554336]">{item.category}</td>
                        <td className="py-3 pr-3 text-right text-[#554336]">{item.ordersCount}</td>
                        <td className="py-3 pr-3 text-right text-[#554336]">
                          {item.singleUnits} / {item.doubleUnits}
                        </td>
                        <td className="py-3 pr-3 text-right font-extrabold text-[#211a15]">
                          {item.unitsSold}
                        </td>
                        <td className="py-3 pr-3 text-right text-[#554336]">
                          PKR {item.avgUnitPrice.toLocaleString()}
                        </td>
                        <td className="py-3 pr-3 text-right font-extrabold text-[#2d6a4f]">
                          PKR {item.revenue.toLocaleString()}
                        </td>
                        <td className="py-3 text-right">
                          <div className="ml-auto flex w-24 items-center justify-end gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#f3e6dd]">
                              <div
                                className="h-full rounded-full bg-[#d97706]"
                                style={{ width: `${Math.min(100, item.revenueSharePct)}%` }}
                              />
                            </div>
                            <span className="w-8 font-bold text-[#211a15]">
                              {item.revenueSharePct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="tabular-nums border-t-2 border-[#dbc2b0] bg-[#fff8f5] font-extrabold text-[#211a15]">
                      <td colSpan={5} className="py-3 pr-3">
                        Total Itemized Sales ({salesAnalytics.itemBreakdown.length} Items)
                      </td>
                      <td className="py-3 pr-3 text-right">{salesAnalytics.totalUnitsSold}</td>
                      <td className="py-3 pr-3 text-right">—</td>
                      <td className="py-3 pr-3 text-right text-[#2d6a4f]">
                        PKR {salesAnalytics.totalItemizedRevenue.toLocaleString()}
                      </td>
                      <td className="py-3 text-right">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Secondary Analytics Grid: Category Share, Payment Channels & Order Types, Daily Revenue History */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Category & Serving Vessel Summary */}
            <div className="space-y-5 rounded-2xl border border-[#211a15]/10 bg-white p-5 lg:col-span-5">
              <div>
                <h3 className="font-display mb-3 text-base font-extrabold text-[#211a15]">
                  Revenue by Category
                </h3>
                {salesAnalytics.categoryBreakdown.length === 0 ? (
                  <p className="text-xs text-[#554336]">No category sales in selected period.</p>
                ) : (
                  <div className="tabular-nums space-y-3">
                    {salesAnalytics.categoryBreakdown.map((cat) => (
                      <div key={cat.category} className="space-y-1 text-xs">
                        <div className="flex items-center justify-between font-bold text-[#211a15]">
                          <span>
                            {cat.category}{' '}
                            <span className="font-normal text-[#554336]">
                              ({cat.unitsSold} units)
                            </span>
                          </span>
                          <span>
                            PKR {cat.revenue.toLocaleString()} ({cat.sharePct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[#f3e6dd]">
                          <div
                            className="h-full rounded-full bg-[#2d6a4f]"
                            style={{ width: `${Math.min(100, cat.sharePct)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-[#dbc2b0]/50 pt-4">
                <h3 className="font-display mb-2.5 text-sm font-extrabold text-[#211a15]">
                  Order Channels & Payment Methods
                </h3>
                <div className="tabular-nums mb-3 grid grid-cols-2 gap-2.5 text-xs">
                  <div className="rounded-xl bg-[#fff8f5] p-3">
                    <div className="font-bold text-[#554336]">Dine-in Orders</div>
                    <div className="mt-0.5 text-sm font-extrabold text-[#211a15]">
                      {salesAnalytics.channelCounts.dineInOrders} · PKR{' '}
                      {salesAnalytics.channelCounts.dineInRevenue.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#fff8f5] p-3">
                    <div className="font-bold text-[#554336]">Takeaway Orders</div>
                    <div className="mt-0.5 text-sm font-extrabold text-[#211a15]">
                      {salesAnalytics.channelCounts.takeawayOrders} · PKR{' '}
                      {salesAnalytics.channelCounts.takeawayRevenue.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="tabular-nums space-y-2 text-xs">
                  {salesAnalytics.paymentBreakdown.map((pm) => (
                    <div
                      key={pm.method}
                      className="flex items-center justify-between rounded-lg border border-[#dbc2b0]/50 px-3 py-2"
                    >
                      <span className="font-bold text-[#211a15]">
                        {pm.method}{' '}
                        <span className="font-normal text-[#554336]">({pm.orders} orders)</span>
                      </span>
                      <span className="font-extrabold text-[#8d4b00]">
                        PKR {pm.revenue.toLocaleString()} · {pm.sharePct}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Daily Revenue History & Vessel/Topping Popularity */}
            <div className="space-y-5 rounded-2xl border border-[#211a15]/10 bg-white p-5 lg:col-span-7">
              <div>
                <h3 className="font-display mb-1 text-base font-extrabold text-[#211a15]">
                  Daily Revenue Comparison (All Recorded Days)
                </h3>
                <p className="mb-3 text-xs text-[#554336]">
                  Click any day to inspect its revenue, order count, and itemized breakdown above.
                </p>

                {salesAnalytics.dailySeries.length === 0 ? (
                  <p className="text-xs text-[#554336]">No order dates recorded yet.</p>
                ) : (
                  <div className="tabular-nums space-y-2.5">
                    {salesAnalytics.dailySeries.map((day) => {
                      const pct =
                        salesAnalytics.maxDailyRevenue > 0
                          ? Math.round((day.revenue / salesAnalytics.maxDailyRevenue) * 100)
                          : 0;
                      const isSelected = analyticsDateFilter === day.date;
                      return (
                        <button
                          key={day.date}
                          type="button"
                          onClick={() => setAnalyticsDateFilter(day.date)}
                          className={`w-full cursor-pointer rounded-xl border p-3 text-left transition-colors ${
                            isSelected
                              ? 'border-[#d97706] bg-[#fffbeb]'
                              : 'border-[#dbc2b0]/50 bg-[#fff8f5] hover:border-[#211a15]/30'
                          }`}
                        >
                          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-bold text-[#211a15]">
                              {day.date === todayIso ? `${day.date} (Today)` : day.date}
                            </span>
                            <span className="text-[#554336]">
                              {day.orderCount} orders · {day.unitsSold} items sold
                            </span>
                            <span className="font-extrabold text-[#2d6a4f]">
                              PKR {day.revenue.toLocaleString()}
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-[#f3e6dd]">
                            <div
                              className="h-full rounded-full bg-[#d97706]"
                              style={{ width: `${Math.max(4, pct)}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {(salesAnalytics.vesselBreakdown.length > 0 ||
                salesAnalytics.toppingBreakdown.length > 0) && (
                <div className="grid grid-cols-1 gap-4 border-t border-[#dbc2b0]/50 pt-4 sm:grid-cols-2">
                  <div>
                    <h4 className="mb-2 text-xs font-extrabold text-[#211a15]">
                      Serving Vessels Used
                    </h4>
                    <ul className="tabular-nums space-y-1.5 text-xs">
                      {salesAnalytics.vesselBreakdown.map((v) => (
                        <li
                          key={v.vessel}
                          className="flex items-center justify-between text-[#554336]"
                        >
                          <span className="font-semibold text-[#211a15]">{v.vessel}</span>
                          <span>{v.unitsSold} units</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="mb-2 text-xs font-extrabold text-[#211a15]">
                      Add-on Toppings Selected
                    </h4>
                    {salesAnalytics.toppingBreakdown.length === 0 ? (
                      <p className="text-xs text-[#554336]">No extra toppings in selected orders.</p>
                    ) : (
                      <ul className="tabular-nums space-y-1.5 text-xs">
                        {salesAnalytics.toppingBreakdown.map((t) => (
                          <li
                            key={t.topping}
                            className="flex items-center justify-between text-[#554336]"
                          >
                            <span className="font-semibold text-[#211a15]">{t.topping}</span>
                            <span>{t.count}× added</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: MENU & REAL-TIME STOCK MANAGER                              */}
      {/* ================================================================= */}
      {activeTab === 'menu' && (
        <div className="space-y-5">
          {/* Proactive Low-Stock Summary Banner */}
          {stockSummary.needsAttention > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-[#ba1a1a]/50 bg-[#ffdad6]/35 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ba1a1a] text-white">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-display text-base font-extrabold text-[#93000a]">
                    Restock Attention Required · {stockSummary.needsAttention} Items
                  </h2>
                  <p className="tabular-nums text-xs font-semibold text-[#93000a]/90">
                    {stockSummary.nearDepletion} near depletion · {stockSummary.depleted} sold out / depleted · {stockSummary.healthy} healthy stock
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
                className="min-h-[42px] cursor-pointer rounded-xl bg-[#ba1a1a] px-4 text-xs font-bold text-white transition-colors hover:bg-[#93000a]"
              >
                {stockFilter === 'low' ? 'Show All Stock' : 'Filter Low & Depleted Only'}
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#211a15]/10 bg-white p-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#887364]" />
                <input
                  type="text"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="Search menu items by name, category, or ID..."
                  className="h-12 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] pr-4 pl-10 text-sm text-[#211a15] focus:border-[#d97706] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1 rounded-xl bg-[#f3e6dd] p-1">
                {(
                  [
                    { id: 'all', label: `All (${menu.length})` },
                    { id: 'low', label: `Low / Depleted (${stockSummary.needsAttention})` },
                    { id: 'healthy', label: `Healthy (${stockSummary.healthy})` },
                    { id: 'soldout', label: `Sold Out (${stockSummary.depleted})` },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStockFilter(f.id)}
                    className={`tabular-nums min-h-[38px] cursor-pointer rounded-lg px-3 text-xs font-bold whitespace-nowrap transition-all ${
                      stockFilter === f.id
                        ? f.id === 'low' || f.id === 'soldout'
                          ? 'bg-[#ba1a1a] text-white shadow-sm'
                          : 'bg-white text-[#211a15] shadow-sm'
                        : 'text-[#554336] hover:text-[#211a15]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={openNewItemModal}
              className="font-display flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl bg-[#d97706] px-5 text-sm font-extrabold text-white shadow-sm hover:bg-[#b15f00]"
            >
              <Plus className="h-4 w-4" />
              Add Ice Cream Item
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredMenu.map((item) => {
              const isDepleted = item.status === 'Sold Out' || item.stockQty <= 0;
              const isNearDepletion = !isDepleted && item.stockQty <= item.lowStockThreshold;
              const isAlertState = isDepleted || isNearDepletion;
              const inStock = item.status === 'In Stock' && item.stockQty > 0;

              return (
                <div
                  key={item.id}
                  className={`flex flex-col justify-between gap-3.5 rounded-2xl p-4 transition-colors ${
                    isAlertState
                      ? 'border-2 border-[#ba1a1a]/65 bg-[#ffdad6]/25'
                      : 'border border-[#211a15]/10 bg-white'
                  }`}
                >
                  <div className="flex gap-4">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className={`h-20 w-20 shrink-0 rounded-xl bg-[#f3e6dd] object-cover ${
                        isDepleted ? 'grayscale' : ''
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#554336]">
                          {item.id} · {item.category}
                        </span>
                        {isAlertState && (
                          <span className="tabular-nums inline-flex items-center gap-1 text-xs font-extrabold text-[#ba1a1a]">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            {isDepleted ? 'Depleted' : 'Low Stock'}
                          </span>
                        )}
                      </div>
                      <h3 className="font-display truncate text-base font-bold text-[#211a15]">
                        {item.name}
                      </h3>
                      <div className="font-urdu truncate text-sm text-[#8d4b00]">
                        {item.nameUrdu}
                      </div>
                      <div className="tabular-nums mt-1 flex items-center gap-2 text-sm">
                        <span className="font-extrabold text-[#211a15]">
                          PKR {item.price.toLocaleString()}
                        </span>
                        <span aria-hidden="true" className="text-[#887364]">·</span>
                        <span
                          className={`font-bold ${
                            isAlertState ? 'text-[#93000a]' : 'text-[#2d6a4f]'
                          }`}
                        >
                          {item.stockQty} left (Min {item.lowStockThreshold})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Live Quantity Adjuster & Proactive Restock Row */}
                  <div
                    className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${
                      isAlertState
                        ? 'border border-[#ba1a1a]/30 bg-[#fff8f5]'
                        : 'border border-[#dbc2b0]/50 bg-[#fff8f5]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onAdjustStockQty(item.id, item.stockQty - 1)}
                        aria-label={`Decrease stock for ${item.name}`}
                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[#dbc2b0] bg-white text-[#211a15] active:scale-95"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span
                        className={`tabular-nums w-9 text-center text-sm font-extrabold ${
                          isAlertState ? 'text-[#ba1a1a]' : 'text-[#211a15]'
                        }`}
                      >
                        {item.stockQty}
                      </span>
                      <button
                        type="button"
                        onClick={() => onAdjustStockQty(item.id, item.stockQty + 1)}
                        aria-label={`Increase stock for ${item.name}`}
                        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[#dbc2b0] bg-white text-[#211a15] active:scale-95"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onAdjustStockQty(item.id, item.stockQty + 10)}
                      className={`min-h-[38px] cursor-pointer rounded-xl px-3.5 text-xs font-extrabold transition-colors ${
                        isAlertState
                          ? 'bg-[#ba1a1a] text-white hover:bg-[#93000a]'
                          : 'bg-[#2d6a4f] text-white hover:bg-[#0e5138]'
                      }`}
                    >
                      +10 Restock
                    </button>
                  </div>

                  <div
                    className={`flex items-center justify-between gap-2 border-t pt-3 ${
                      isAlertState ? 'border-[#ba1a1a]/20' : 'border-[#211a15]/8'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onToggleStock(item.id)}
                      className={`min-h-[42px] cursor-pointer rounded-xl px-3.5 text-xs font-bold transition-colors ${
                        inStock
                          ? isNearDepletion
                            ? 'bg-[#ffdad6] text-[#93000a] hover:bg-[#ffb3b6]'
                            : 'bg-[#aeeecb] text-[#002114] hover:bg-[#95d4b3]'
                          : 'bg-[#ba1a1a] text-white hover:bg-[#93000a]'
                      }`}
                    >
                      {inStock
                        ? isNearDepletion
                          ? 'Low Stock · Mark Sold Out'
                          : 'In Stock · Mark Sold Out'
                        : 'Sold Out · Restore Stock'}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsNewItem(false);
                          setEditingItem({ ...item });
                        }}
                        aria-label={`Edit ${item.name}`}
                        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-[#dbc2b0] bg-[#fff8f5] text-[#211a15] hover:bg-[#f3e6dd]"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteMenuItem(item.id)}
                        aria-label={`Delete ${item.name}`}
                        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-[#ffdad6] bg-[#fff8f5] text-[#ba1a1a] hover:bg-[#ffdad6]/60"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 3: FRONTEND PICTURES, STOREFRONT CMS & CUSTOMIZATION PRICING   */}
      {/* ================================================================= */}
      {activeTab === 'storefront' && (
        <div className="space-y-6">
          {/* 1. Frontend Hero Banner Picture & Brand Logo */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-5 rounded-2xl border border-[#211a15]/10 bg-white p-6 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-extrabold text-[#211a15]">
                    Frontend Pictures & Brand Appearance
                  </h2>
                  <p className="text-xs text-[#554336]">
                    Upload photos from your device, paste an image URL, or pick from studio photography.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onResetStorefrontSettings}
                  className="flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-xs font-bold text-[#554336] hover:text-[#211a15]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset Defaults
                </button>
              </div>

              {/* Hero Image Controls */}
              <div className="space-y-3 rounded-2xl border border-[#dbc2b0]/70 bg-[#fff8f5] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-bold text-[#211a15]">
                    Frontend Hero Banner Picture
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateStorefrontSettings({
                        ...storefrontSettings,
                        showHeroImage: !storefrontSettings.showHeroImage,
                      })
                    }
                    className={`min-h-[34px] cursor-pointer rounded-lg px-3 text-xs font-bold ${
                      storefrontSettings.showHeroImage
                        ? 'bg-[#aeeecb] text-[#002114]'
                        : 'bg-[#e5d7cf] text-[#554336]'
                    }`}
                  >
                    {storefrontSettings.showHeroImage ? 'Visible on Kiosk' : 'Hidden'}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={storefrontSettings.heroImageUrl}
                    onChange={(e) =>
                      onUpdateStorefrontSettings({
                        ...storefrontSettings,
                        heroImageUrl: e.target.value,
                      })
                    }
                    placeholder="Paste Hero Image URL..."
                    className="h-11 min-w-[200px] flex-1 rounded-xl border border-[#dbc2b0] bg-white px-3 text-xs text-[#211a15]"
                  />
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl bg-[#211a15] px-4 text-xs font-bold text-white hover:bg-[#372f2a]">
                    <Upload className="h-3.5 w-3.5" />
                    Upload Photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const dataUrl = await readAndResizeImageFile(file);
                        onUpdateStorefrontSettings({
                          ...storefrontSettings,
                          heroImageUrl: dataUrl,
                        });
                      }}
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  {PRESET_IMAGE_GALLERY.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() =>
                        onUpdateStorefrontSettings({
                          ...storefrontSettings,
                          heroImageUrl: preset.url,
                        })
                      }
                      className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                        storefrontSettings.heroImageUrl === preset.url
                          ? 'border-[#d97706] bg-[#fffbeb]'
                          : 'border-[#dbc2b0] bg-white'
                      }`}
                    >
                      <img src={preset.url} alt={preset.label} className="h-5 w-5 rounded object-cover" />
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Brand Logo Emblem */}
              <div className="space-y-3 rounded-2xl border border-[#dbc2b0]/70 bg-[#fff8f5] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-bold text-[#211a15]">
                    Brand Logo / Emblem (Optional)
                  </span>
                  {storefrontSettings.logoImageUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateStorefrontSettings({ ...storefrontSettings, logoImageUrl: '' })
                      }
                      className="text-xs font-bold text-[#ba1a1a] hover:underline"
                    >
                      Remove Logo
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={storefrontSettings.logoImageUrl}
                    onChange={(e) =>
                      onUpdateStorefrontSettings({
                        ...storefrontSettings,
                        logoImageUrl: e.target.value,
                      })
                    }
                    placeholder="Paste Logo URL or upload emblem..."
                    className="h-11 min-w-[200px] flex-1 rounded-xl border border-[#dbc2b0] bg-white px-3 text-xs text-[#211a15]"
                  />
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#2d6a4f] bg-white px-4 text-xs font-bold text-[#2d6a4f] hover:bg-[#aeeecb]/20">
                    <Upload className="h-3.5 w-3.5" />
                    Upload Logo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const dataUrl = await readAndResizeImageFile(file, 320);
                        onUpdateStorefrontSettings({
                          ...storefrontSettings,
                          logoImageUrl: dataUrl,
                        });
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Live Frontend Hero Preview + Category Picture Updater */}
            <div className="space-y-5 lg:col-span-5">
              <div className="rounded-2xl border border-[#211a15]/10 bg-white p-5">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold text-[#554336]">
                  <ImageIcon className="h-4 w-4 text-[#8d4b00]" />
                  Live Hero Preview
                </div>
                <div className="overflow-hidden rounded-2xl border border-[#dbc2b0]/70 bg-[#fff8f5]">
                  {storefrontSettings.showHeroImage && storefrontSettings.heroImageUrl && (
                    <img
                      src={storefrontSettings.heroImageUrl}
                      alt="Hero Preview"
                      referrerPolicy="no-referrer"
                      className="h-40 w-full object-cover"
                    />
                  )}
                  <div className="p-4">
                    <div className="flex items-center gap-2">
                      {storefrontSettings.logoImageUrl && (
                        <img
                          src={storefrontSettings.logoImageUrl}
                          alt="Logo Preview"
                          className="h-8 w-8 rounded-lg object-cover"
                        />
                      )}
                      <span className="text-[11px] font-bold text-[#2d6a4f]">
                        {storefrontSettings.heroKickerEn}
                      </span>
                    </div>
                    <div className="font-display mt-1 text-lg font-extrabold text-[#211a15]">
                      {storefrontSettings.heroTitleEn}
                    </div>
                    <div className="mt-1 text-xs text-[#554336]">
                      {storefrontSettings.heroSubtitleEn}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bulk Update Category Pictures */}
              <div className="space-y-3 rounded-2xl border border-[#211a15]/10 bg-white p-5">
                <h3 className="font-display text-base font-extrabold text-[#211a15]">
                  Change All Pictures by Category
                </h3>
                <select
                  value={bulkCategory}
                  onChange={(e) => setBulkCategory(e.target.value as Category)}
                  className="h-11 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-sm font-semibold"
                >
                  {CATEGORIES.filter((c) => c.id !== 'All').map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.en}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={bulkCategoryUrl}
                    onChange={(e) => setBulkCategoryUrl(e.target.value)}
                    placeholder="Image URL for category..."
                    className="h-11 min-w-[160px] flex-1 rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-xs"
                  />
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-xs font-bold text-[#211a15]">
                    <Upload className="h-3.5 w-3.5" />
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const dataUrl = await readAndResizeImageFile(file);
                        setBulkCategoryUrl(dataUrl);
                      }}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!bulkCategoryUrl.trim()) return;
                    onBulkUpdateCategoryImage(bulkCategory, bulkCategoryUrl.trim());
                    setBulkMessage(`Updated all ${bulkCategory} item pictures.`);
                    setTimeout(() => setBulkMessage(''), 3000);
                  }}
                  className="min-h-[44px] w-full cursor-pointer rounded-xl bg-[#d97706] text-xs font-extrabold text-white hover:bg-[#b15f00]"
                >
                  Apply Picture to All {bulkCategory} Items
                </button>
                {bulkMessage && (
                  <p className="text-xs font-bold text-[#2d6a4f]">{bulkMessage}</p>
                )}
              </div>
            </div>
          </div>

          {/* 2. Bilingual Storefront Headlines & Copy */}
          <div className="space-y-4 rounded-2xl border border-[#211a15]/10 bg-white p-6">
            <h3 className="font-display text-lg font-extrabold text-[#211a15]">
              Frontend Brand & Hero Text (English & اردو)
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-[#554336]">Brand Name (EN)</label>
                <input
                  type="text"
                  value={storefrontSettings.brandNameEn}
                  onChange={(e) =>
                    onUpdateStorefrontSettings({ ...storefrontSettings, brandNameEn: e.target.value })
                  }
                  className="h-11 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-sm font-semibold"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[#554336]">Brand Name (UR)</label>
                <input
                  dir="rtl"
                  type="text"
                  value={storefrontSettings.brandNameUr}
                  onChange={(e) =>
                    onUpdateStorefrontSettings({ ...storefrontSettings, brandNameUr: e.target.value })
                  }
                  className="font-urdu h-11 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[#554336]">Hero Kicker (EN)</label>
                <input
                  type="text"
                  value={storefrontSettings.heroKickerEn}
                  onChange={(e) =>
                    onUpdateStorefrontSettings({ ...storefrontSettings, heroKickerEn: e.target.value })
                  }
                  className="h-11 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[#554336]">Hero Kicker (UR)</label>
                <input
                  dir="rtl"
                  type="text"
                  value={storefrontSettings.heroKickerUr}
                  onChange={(e) =>
                    onUpdateStorefrontSettings({ ...storefrontSettings, heroKickerUr: e.target.value })
                  }
                  className="font-urdu h-11 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[#554336]">Hero Headline (EN)</label>
                <input
                  type="text"
                  value={storefrontSettings.heroTitleEn}
                  onChange={(e) =>
                    onUpdateStorefrontSettings({ ...storefrontSettings, heroTitleEn: e.target.value })
                  }
                  className="h-11 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-sm font-semibold"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[#554336]">Hero Headline (UR)</label>
                <input
                  dir="rtl"
                  type="text"
                  value={storefrontSettings.heroTitleUr}
                  onChange={(e) =>
                    onUpdateStorefrontSettings({ ...storefrontSettings, heroTitleUr: e.target.value })
                  }
                  className="font-urdu h-11 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[#554336]">Hero Subtitle (EN)</label>
                <input
                  type="text"
                  value={storefrontSettings.heroSubtitleEn}
                  onChange={(e) =>
                    onUpdateStorefrontSettings({ ...storefrontSettings, heroSubtitleEn: e.target.value })
                  }
                  className="h-11 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[#554336]">Hero Subtitle (UR)</label>
                <input
                  dir="rtl"
                  type="text"
                  value={storefrontSettings.heroSubtitleUr}
                  onChange={(e) =>
                    onUpdateStorefrontSettings({ ...storefrontSettings, heroSubtitleUr: e.target.value })
                  }
                  className="font-urdu h-11 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-sm"
                />
              </div>
            </div>
          </div>

          {/* 3. Customization Pricing (Double Scoop, Vessels, Toppings) & Admin PINs */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-[#211a15]/10 bg-white p-6">
              <h3 className="font-display text-lg font-extrabold text-[#211a15]">
                Add-On, Vessel & Topping Pricing (PKR)
              </h3>
              <div>
                <label className="mb-1 block text-xs font-bold text-[#554336]">
                  Double Scoop Upgrade Price (PKR)
                </label>
                <input
                  type="number"
                  min={0}
                  value={storefrontSettings.doubleScoopPrice}
                  onChange={(e) =>
                    onUpdateStorefrontSettings({
                      ...storefrontSettings,
                      doubleScoopPrice: Number(e.target.value) || 0,
                    })
                  }
                  className="tabular-nums h-11 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-sm font-bold"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-[#554336]">Serving Vessels</div>
                {storefrontSettings.vessels.map((v, idx) => (
                  <div key={v.id} className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={v.name}
                      onChange={(e) => {
                        const next = [...storefrontSettings.vessels];
                        next[idx] = { ...v, name: e.target.value };
                        onUpdateStorefrontSettings({ ...storefrontSettings, vessels: next });
                      }}
                      className="col-span-2 h-10 rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-xs font-semibold"
                    />
                    <input
                      type="number"
                      min={0}
                      value={v.price}
                      onChange={(e) => {
                        const next = [...storefrontSettings.vessels];
                        next[idx] = { ...v, price: Number(e.target.value) || 0 };
                        onUpdateStorefrontSettings({ ...storefrontSettings, vessels: next });
                      }}
                      className="tabular-nums h-10 rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-xs font-bold"
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-[#554336]">Artisanal Toppings</div>
                {storefrontSettings.toppings.map((t, idx) => (
                  <div key={t.id} className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={t.name}
                      onChange={(e) => {
                        const next = [...storefrontSettings.toppings];
                        next[idx] = { ...t, name: e.target.value };
                        onUpdateStorefrontSettings({ ...storefrontSettings, toppings: next });
                      }}
                      className="col-span-2 h-10 rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-xs font-semibold"
                    />
                    <input
                      type="number"
                      min={0}
                      value={t.price}
                      onChange={(e) => {
                        const next = [...storefrontSettings.toppings];
                        next[idx] = { ...t, price: Number(e.target.value) || 0 };
                        onUpdateStorefrontSettings({ ...storefrontSettings, toppings: next });
                      }}
                      className="tabular-nums h-10 rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-xs font-bold"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-[#211a15]/10 bg-white p-6">
              <h3 className="font-display text-lg font-extrabold text-[#211a15]">
                Dual Admin Accounts & Passcodes
              </h3>
              <p className="text-xs text-[#554336]">
                Manage names and PIN passcodes for Owner (Admin 1) and Manager (Admin 2).
              </p>

              <div className="space-y-3">
                {admins.map((adm, idx) => (
                  <div
                    key={adm.adminId}
                    className="space-y-2 rounded-xl border border-[#dbc2b0]/70 bg-[#fff8f5] p-3.5"
                  >
                    <div className="text-xs font-bold text-[#8d4b00]">
                      {adm.role} · {adm.adminId}
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        type="text"
                        value={adm.name}
                        disabled={loggedInAdmin.role !== 'Owner'}
                        onChange={(e) => {
                          const next = [...admins];
                          next[idx] = { ...adm, name: e.target.value };
                          onUpdateAdmins(next);
                        }}
                        placeholder="Admin Name"
                        className="h-10 rounded-xl border border-[#dbc2b0] bg-white px-3 text-xs font-bold disabled:opacity-60"
                      />
                      <input
                        type="text"
                        value={adm.passcode}
                        disabled={loggedInAdmin.role !== 'Owner'}
                        onChange={(e) => {
                          const next = [...admins];
                          next[idx] = { ...adm, passcode: e.target.value };
                          onUpdateAdmins(next);
                        }}
                        placeholder="PIN Passcode"
                        className="font-receipt h-10 rounded-xl border border-[#dbc2b0] bg-white px-3 text-xs font-bold disabled:opacity-60"
                      />
                    </div>
                  </div>
                ))}
              </div>
              {loggedInAdmin.role !== 'Owner' && (
                <p className="text-xs text-[#554336]">
                  Only the Owner profile can modify admin passcodes.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 4: THERMAL RECEIPT & PRINTER SETTINGS                          */}
      {/* ================================================================= */}
      {activeTab === 'printer' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-5 rounded-2xl border border-[#211a15]/10 bg-white p-6 lg:col-span-7">
            <h2 className="font-display text-xl font-extrabold text-[#211a15]">
              Thermal Printer & Receipt Customization
            </h2>

            {/* Paper Width & Toggles */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold text-[#554336]">
                  Thermal Paper Width
                </label>
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#f3e6dd] p-1">
                  {(['58mm', '80mm'] as const).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() =>
                        onUpdatePrinterSettings({ ...printerSettings, paperWidth: w })
                      }
                      className={`min-h-[44px] cursor-pointer rounded-lg text-sm font-bold ${
                        printerSettings.paperWidth === w
                          ? 'bg-white text-[#211a15] shadow-sm'
                          : 'text-[#554336]'
                      }`}
                    >
                      {w} Roll
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold text-[#554336]">
                  Thermal Printer Stream
                </label>
                <button
                  type="button"
                  onClick={() =>
                    onUpdatePrinterSettings({
                      ...printerSettings,
                      autoPrintOnOrder: !printerSettings.autoPrintOnOrder,
                    })
                  }
                  className={`flex min-h-[52px] w-full cursor-pointer items-center justify-between rounded-xl border-2 px-4 text-sm font-bold ${
                    printerSettings.autoPrintOnOrder
                      ? 'border-[#2d6a4f] bg-[#aeeecb]/25 text-[#002114]'
                      : 'border-[#dbc2b0] bg-[#fff8f5] text-[#554336]'
                  }`}
                >
                  <span>Auto-Print on Order</span>
                  <span>{printerSettings.autoPrintOnOrder ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#554336]">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={printerSettings.taxRatePercent}
                  onChange={(e) =>
                    onUpdatePrinterSettings({
                      ...printerSettings,
                      taxRatePercent: Number(e.target.value) || 0,
                    })
                  }
                  className="h-12 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-4 text-sm font-bold text-[#211a15]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#554336]">
                  Default Discount (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={printerSettings.defaultDiscountPercent}
                  onChange={(e) =>
                    onUpdatePrinterSettings({
                      ...printerSettings,
                      defaultDiscountPercent: Number(e.target.value) || 0,
                    })
                  }
                  className="h-12 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-4 text-sm font-bold text-[#211a15]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#554336]">
                Shop Header Subtitle
              </label>
              <input
                type="text"
                value={printerSettings.shopHeaderSubtitle}
                onChange={(e) =>
                  onUpdatePrinterSettings({
                    ...printerSettings,
                    shopHeaderSubtitle: e.target.value,
                  })
                }
                className="h-12 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-4 text-sm text-[#211a15]"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#554336]">
                  Shop Address Line
                </label>
                <input
                  type="text"
                  value={printerSettings.shopAddress}
                  onChange={(e) =>
                    onUpdatePrinterSettings({
                      ...printerSettings,
                      shopAddress: e.target.value,
                    })
                  }
                  className="h-12 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-4 text-sm text-[#211a15]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#554336]">
                  Shop Contact Number
                </label>
                <input
                  type="text"
                  value={printerSettings.shopPhone}
                  onChange={(e) =>
                    onUpdatePrinterSettings({
                      ...printerSettings,
                      shopPhone: e.target.value,
                    })
                  }
                  className="h-12 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-4 text-sm text-[#211a15]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#554336]">
                Thank You Footer Message
              </label>
              <input
                type="text"
                value={printerSettings.thankYouNote}
                onChange={(e) =>
                  onUpdatePrinterSettings({
                    ...printerSettings,
                    thankYouNote: e.target.value,
                  })
                }
                className="h-12 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-4 text-sm text-[#211a15]"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                const sample: Order = orders[0] || {
                  orderId: 'TEST-001',
                  timestamp: new Date().toISOString(),
                  items: [
                    {
                      name: 'Zafran Royal Pistachio',
                      nameUrdu: 'زعفران شاہی پستہ',
                      size: 'Single',
                      vessel: 'Artisan Cup',
                      toppings: ['Crushed Iranian Pistachio'],
                      quantity: 1,
                      unitPrice: 470,
                      lineTotal: 470,
                    },
                  ],
                  subtotal: 470,
                  taxAmount: 24,
                  discountAmount: 0,
                  total: 494,
                  paymentType: 'Cash',
                  orderType: 'Dine-in',
                  status: 'Completed',
                  adminId: loggedInAdmin.adminId,
                };
                onReprintOrder(sample);
              }}
              className="font-display flex min-h-[56px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#d97706] text-sm font-extrabold text-white shadow-sm hover:bg-[#b15f00]"
            >
              <Printer className="h-5 w-5" />
              Test Thermal Print Layout
            </button>
          </div>

          {/* Live Receipt Preview */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#211a15]/10 bg-[#eee0d8]/70 p-6 lg:col-span-5">
            <div className="mb-3 text-xs font-bold text-[#554336]">
              Live {printerSettings.paperWidth} Receipt Preview
            </div>
            <div className="shadow-md">
              <div className="receipt-edge-top h-3 w-full" />
              <ReceiptSlipContent
                order={
                  orders[0] || {
                    orderId: 'CB-1001',
                    timestamp: new Date().toISOString(),
                    items: [
                      {
                        name: 'Zafran Royal Pistachio',
                        nameUrdu: 'زعفران شاہی پستہ',
                        size: 'Single',
                        vessel: 'Artisan Cup',
                        toppings: [],
                        quantity: 1,
                        unitPrice: 380,
                        lineTotal: 380,
                      },
                    ],
                    subtotal: 380,
                    taxAmount: 19,
                    discountAmount: 0,
                    total: 399,
                    paymentType: 'Cash',
                    orderType: 'Dine-in',
                    status: 'Completed',
                    adminId: loggedInAdmin.adminId,
                  }
                }
                settings={printerSettings}
              />
              <div className="receipt-edge-bottom h-3 w-full" />
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 4: GOOGLE APPS SCRIPT & LIVE SHEETS SYNC                       */}
      {/* ================================================================= */}
      {activeTab === 'sync' && (
        <div className="rounded-2xl border border-[#211a15]/10 bg-white p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-extrabold text-[#211a15]">
                Google Apps Script Live Backend Sync
              </h2>
              <p className="mt-1 text-sm text-[#554336]">
                Plug in your deployed Google Apps Script Web App URL to sync Menu, Orders, and Admins with Google Sheets in real time.
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenSetupGuide}
              className="min-h-[44px] cursor-pointer rounded-xl border-2 border-[#2d6a4f] px-4 text-xs font-bold text-[#2d6a4f] hover:bg-[#aeeecb]/20"
            >
              View Code.gs & Setup Guide
            </button>
          </div>

          <div>
            <label htmlFor="gas-url-input" className="mb-1.5 block text-xs font-bold text-[#554336]">
              Deployed Google Apps Script Web App URL
            </label>
            <input
              id="gas-url-input"
              type="url"
              value={gasUrlDraft}
              onChange={(e) => setGasUrlDraft(e.target.value)}
              placeholder="https://script.google.com/macros/s/AKfycb.../exec"
              className="font-receipt h-13 w-full rounded-xl border-2 border-[#dbc2b0] bg-[#fff8f5] px-4 text-sm text-[#211a15] focus:border-[#d97706] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleTestGas}
              className="flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl bg-[#211a15] px-5 text-sm font-bold text-white hover:bg-[#372f2a] disabled:opacity-50"
            >
              <Cloud className="h-4 w-4" />
              Save & Test Connection
            </button>

            <button
              type="button"
              disabled={isSyncing}
              onClick={handlePullGas}
              className="flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl bg-[#2d6a4f] px-5 text-sm font-bold text-white hover:bg-[#0e5138] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              Pull Data from Google Sheets
            </button>

            <button
              type="button"
              disabled={isSyncing}
              onClick={handleSeedMenuToGas}
              className="flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl bg-[#d97706] px-5 text-sm font-bold text-white hover:bg-[#b15f00] disabled:opacity-50"
            >
              Push Current Menu to Sheet
            </button>
          </div>

          {syncMessage && (
            <div
              className={`rounded-xl px-4 py-3 text-sm font-semibold ${
                syncMessage.ok
                  ? 'bg-[#aeeecb]/50 text-[#002114]'
                  : 'bg-[#ffdad6] text-[#93000a]'
              }`}
            >
              {syncMessage.text}
            </div>
          )}

          {gasConfig.lastSyncAt && (
            <p className="text-xs text-[#554336]">
              Last synced at: {new Date(gasConfig.lastSyncAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* ADD / EDIT MENU ITEM MODAL                                         */}
      {/* ================================================================= */}
      {editingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#211a15]/50 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveMenuModal}
            className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-[#fffdf7] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#dbc2b0] px-6 py-4">
              <h3 className="font-display text-lg font-extrabold text-[#211a15]">
                {isNewItem ? 'Add New Ice Cream Item' : `Edit ${editingItem.name}`}
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-[#f3e6dd] text-[#211a15]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="kiosk-scroll flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#554336]">Item ID</label>
                  <input
                    required
                    type="text"
                    value={editingItem.id}
                    disabled={!isNewItem}
                    onChange={(e) => setEditingItem({ ...editingItem, id: e.target.value })}
                    className="font-receipt h-11 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-sm disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#554336]">Category</label>
                  <select
                    value={editingItem.category}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, category: e.target.value as Category })
                    }
                    className="h-11 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-sm font-semibold"
                  >
                    {CATEGORIES.filter((c) => c.id !== 'All').map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.en}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#554336]">
                    Name (English)
                  </label>
                  <input
                    required
                    type="text"
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    className="h-11 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#554336]">
                    Name (Urdu — اردو)
                  </label>
                  <input
                    dir="rtl"
                    type="text"
                    value={editingItem.nameUrdu}
                    onChange={(e) => setEditingItem({ ...editingItem, nameUrdu: e.target.value })}
                    className="font-urdu h-11 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#554336]">
                    Price (PKR)
                  </label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={editingItem.price}
                    onChange={(e) =>
                      setEditingItem({ ...editingItem, price: Number(e.target.value) || 0 })
                    }
                    className="tabular-nums h-11 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#554336]">Status</label>
                  <select
                    value={editingItem.status}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        status: e.target.value as MenuItem['status'],
                      })
                    }
                    className="h-11 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-sm font-semibold"
                  >
                    <option value="In Stock">In Stock</option>
                    <option value="Sold Out">Sold Out</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#554336]">
                    Current Stock Quantity
                  </label>
                  <input
                    required
                    type="number"
                    min={0}
                    value={editingItem.stockQty}
                    onChange={(e) => {
                      const qty = Math.max(0, Number(e.target.value) || 0);
                      setEditingItem({
                        ...editingItem,
                        stockQty: qty,
                        status: qty === 0 ? 'Sold Out' : 'In Stock',
                      });
                    }}
                    className="tabular-nums h-11 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#554336]">
                    Low-Stock Alert Threshold
                  </label>
                  <input
                    required
                    type="number"
                    min={1}
                    value={editingItem.lowStockThreshold}
                    onChange={(e) =>
                      setEditingItem({
                        ...editingItem,
                        lowStockThreshold: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    className="tabular-nums h-11 w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-sm font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#554336]">
                  Item Picture (Upload, URL, or Preset)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {editingItem.imageUrl && (
                    <img
                      src={editingItem.imageUrl}
                      alt={editingItem.name || 'Preview'}
                      referrerPolicy="no-referrer"
                      className="h-11 w-11 shrink-0 rounded-xl border border-[#dbc2b0] object-cover"
                    />
                  )}
                  <input
                    type="text"
                    value={editingItem.imageUrl}
                    onChange={(e) => setEditingItem({ ...editingItem, imageUrl: e.target.value })}
                    placeholder="Paste Image URL..."
                    className="h-11 min-w-[160px] flex-1 rounded-xl border border-[#dbc2b0] bg-[#fff8f5] px-3 text-sm"
                  />
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl bg-[#211a15] px-3.5 text-xs font-bold text-white hover:bg-[#372f2a]">
                    <Upload className="h-3.5 w-3.5" />
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const dataUrl = await readAndResizeImageFile(file);
                        setEditingItem((prev) => (prev ? { ...prev, imageUrl: dataUrl } : prev));
                      }}
                    />
                  </label>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRESET_IMAGE_GALLERY.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => setEditingItem({ ...editingItem, imageUrl: preset.url })}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold ${
                        editingItem.imageUrl === preset.url
                          ? 'border-[#d97706] bg-[#fffbeb]'
                          : 'border-[#dbc2b0] bg-white'
                      }`}
                    >
                      <img
                        src={preset.url}
                        alt={preset.label}
                        className="h-5 w-5 rounded object-cover"
                      />
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#554336]">
                  Description (English)
                </label>
                <textarea
                  rows={2}
                  value={editingItem.description}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  className="w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] p-3 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-[#554336]">
                  Description (Urdu — اردو)
                </label>
                <textarea
                  dir="rtl"
                  rows={2}
                  value={editingItem.descriptionUrdu}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, descriptionUrdu: e.target.value })
                  }
                  className="font-urdu w-full rounded-xl border border-[#dbc2b0] bg-[#fff8f5] p-3 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#dbc2b0] bg-[#fff8f5] px-6 py-4">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="min-h-[48px] cursor-pointer rounded-xl border border-[#dbc2b0] bg-white px-5 text-sm font-bold text-[#554336]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="font-display min-h-[48px] cursor-pointer rounded-xl bg-[#d97706] px-6 text-sm font-extrabold text-white hover:bg-[#b15f00]"
              >
                Save Menu Item
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
