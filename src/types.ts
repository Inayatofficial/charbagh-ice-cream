export type Language = 'en' | 'ur';

export type Category =
  | 'Scoops'
  | 'Sundaes'
  | 'Kulfi'
  | 'Cones'
  | 'Family Packs'
  | 'Shakes';

export type CategoryFilter = 'All' | Category;

export type StockStatus = 'In Stock' | 'Sold Out';

export type OrderType = 'Dine-in' | 'Takeaway';

export type PaymentMethod = 'Cash' | 'Card' | 'Digital Wallet';

export type OrderStatus = 'Pending' | 'Preparing' | 'Completed';

export interface MenuItem {
  id: string;
  name: string;
  nameUrdu: string;
  category: Category;
  price: number;
  imageUrl: string;
  status: StockStatus;
  stockQty: number;
  lowStockThreshold: number;
  description: string;
  descriptionUrdu: string;
  tag?: string;
}

export interface ToppingOption {
  id: string;
  name: string;
  nameUrdu: string;
  price: number;
}

export interface VesselOption {
  id: string;
  name: string;
  nameUrdu: string;
  price: number;
}

export interface CartItem {
  cartLineId: string;
  menuItemId: string;
  name: string;
  nameUrdu: string;
  category: Category;
  imageUrl: string;
  basePrice: number;
  size: 'Single' | 'Double';
  sizeAddon: number;
  secondFlavor?: string;
  vessel: VesselOption;
  toppings: ToppingOption[];
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderItemSnapshot {
  name: string;
  nameUrdu: string;
  size: 'Single' | 'Double';
  vessel: string;
  secondFlavor?: string;
  toppings: string[];
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  orderId: string;
  timestamp: string;
  items: OrderItemSnapshot[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paymentType: PaymentMethod;
  orderType: OrderType;
  status: OrderStatus;
  adminId: string;
  syncedToGas?: boolean;
}

export interface AdminUser {
  adminId: string;
  name: string;
  passcode: string;
  role: 'Owner' | 'Manager';
}

export interface PrinterSettings {
  paperWidth: '58mm' | '80mm';
  autoPrintOnOrder: boolean;
  thermalPrinterEnabled: boolean;
  shopHeaderSubtitle: string;
  shopAddress: string;
  shopPhone: string;
  thankYouNote: string;
  taxRatePercent: number;
  defaultDiscountPercent: number;
}

export interface GasConfig {
  webAppUrl: string;
  lastSyncAt: string | null;
  autoSyncEnabled: boolean;
}

export interface StorefrontSettings {
  brandNameEn: string;
  brandNameUr: string;
  heroKickerEn: string;
  heroKickerUr: string;
  heroTitleEn: string;
  heroTitleUr: string;
  heroSubtitleEn: string;
  heroSubtitleUr: string;
  heroImageUrl: string;
  logoImageUrl: string;
  showHeroImage: boolean;
  doubleScoopPrice: number;
  vessels: VesselOption[];
  toppings: ToppingOption[];
}

