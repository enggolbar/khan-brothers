import type { DbTimestamp as Timestamp } from '../mysqlDataStore';

export type PlanId = 'starter' | 'growth' | 'enterprise';
export type PaymentMethod = 'cash' | 'bkash' | 'nagad' | 'rocket' | 'card' | 'split' | 'credit';
export type SaleStatus = 'completed' | 'held' | 'refunded' | 'voided';
export type ExpensePaymentMethod = 'cash' | 'bkash' | 'nagad' | 'bank';
export type PurchaseStatus = 'ordered' | 'received' | 'cancelled';
export type ShiftStatus = 'open' | 'closed';
export type StaffRole = 'manager' | 'cashier' | 'inventory' | 'accountant' | 'sr';
export type CustomerType = 'retail' | 'wholesale';
export type SrOrderStatus = 'pending' | 'approved' | 'delivered' | 'cancelled';
export type SrOrderPaymentMethod = 'cash' | 'bkash' | 'nagad' | 'rocket' | 'card' | 'credit';
export type LedgerPartyType = 'customer' | 'supplier';
export type LedgerEntryType =
  | 'credit_sale'
  | 'sr_delivery'
  | 'customer_collection'
  | 'purchase_due'
  | 'supplier_payment'
  | 'opening_due';
export type LedgerPaymentMethod = 'cash' | 'bkash' | 'nagad' | 'bank' | 'credit';

export type WorkspaceTab =
  | 'dashboard'
  | 'pos'
  | 'sr-orders'
  | 'ledger'
  | 'inventory'
  | 'sales'
  | 'shifts'
  | 'customers'
  | 'suppliers'
  | 'purchases'
  | 'barcodes'
  | 'expenses'
  | 'staff'
  | 'analytics'
  | 'settings';

export interface Shop {
  id: string;
  ownerId: string;
  name: string;
  branchName: string;
  address: string;
  phone: string;
  binNumber: string;
  defaultVatRate: number;
  receiptFooter: string;
  marketRoutes?: string[];
  plan: PlanId;
  currency: 'BDT';
  invoiceCounter: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Product {
  id: string;
  shopId: string;
  ownerId: string;
  name: string;
  barcode: string;
  sku: string;
  category: string;
  brand?: string;
  brandLogoDataUrl?: string;
  brandLogoUrl?: string;
  description?: string;
  imageDataUrl?: string;
  unit: string;
  unitQuantity?: number;
  secondaryUnit?: string;
  secondaryUnitQuantity?: number;
  priceUnit?: 'pcs' | 'unit';
  costPrice: number;
  sellingPrice: number;
  vatRate: number;
  stock: number;
  reorderLevel: number;
  isActive: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface SaleItem {
  productId: string;
  name: string;
  barcode: string;
  unit: string;
  qty: number;
  unitPrice: number;
  costPrice: number;
  vatRate: number;
  lineTotal: number;
}

export interface Sale {
  id: string;
  shopId: string;
  ownerId: string;
  invoiceNumber: string;
  cashierName: string;
  branchName: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  items: SaleItem[];
  itemCount: number;
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  vatEnabled?: boolean;
  totalAmount: number;
  paidAmount: number;
  changeAmount: number;
  dueAmount?: number;
  paymentMethod: PaymentMethod;
  paymentRef: string;
  status: SaleStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Customer {
  id: string;
  shopId: string;
  ownerId: string;
  name: string;
  shopName?: string;
  marketArea?: string;
  customerType?: CustomerType;
  phone: string;
  address: string;
  loyaltyPoints: number;
  totalSpent: number;
  visitCount: number;
  balanceDue?: number;
  creditLimit?: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Branch {
  id: string;
  shopId: string;
  ownerId: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  managerName: string;
  isActive: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Supplier {
  id: string;
  shopId: string;
  ownerId: string;
  name: string;
  company: string;
  phone: string;
  address: string;
  category: string;
  totalPurchased: number;
  balanceDue: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface PurchaseItem {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  qty: number;
  unitCost: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  id: string;
  shopId: string;
  ownerId: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  branchName: string;
  items: PurchaseItem[];
  itemCount: number;
  totalCost: number;
  paidAmount: number;
  status: PurchaseStatus;
  notes: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Expense {
  id: string;
  shopId: string;
  ownerId: string;
  title: string;
  category: string;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  branchName: string;
  reference: string;
  notes: string;
  expenseDate: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Shift {
  id: string;
  shopId: string;
  ownerId: string;
  branchName: string;
  cashierName: string;
  openingCash: number;
  cashSalesTotal: number;
  mfsCardSalesTotal: number;
  cashExpensesTotal: number;
  expectedCash: number;
  countedCash: number;
  variance: number;
  status: ShiftStatus;
  notes: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface StaffMember {
  id: string;
  shopId: string;
  ownerId: string;
  name: string;
  phone: string;
  role: StaffRole;
  branchName: string;
  routeArea?: string;
  commissionRate?: number;
  monthlySalary: number;
  pinCode: string;
  isActive: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface SrOrderItem {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  qty: number;
  unitPrice: number;
  costPrice: number;
  lineTotal: number;
}

export interface SrOrder {
  id: string;
  shopId: string;
  ownerId: string;
  orderNumber: string;
  srId: string;
  srName: string;
  routeArea: string;
  customerId: string;
  customerName: string;
  retailerShopName: string;
  customerPhone: string;
  items: SrOrderItem[];
  itemCount: number;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  commissionRate: number;
  commissionAmount: number;
  paymentMethod: SrOrderPaymentMethod;
  status: SrOrderStatus;
  notes: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface LedgerEntry {
  id: string;
  shopId: string;
  ownerId: string;
  partyType: LedgerPartyType;
  partyId: string;
  partyName: string;
  entryType: LedgerEntryType;
  amount: number;
  paymentMethod: LedgerPaymentMethod;
  reference: string;
  notes: string;
  entryDate: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export const RANGAMATI_ROUTES = [
  'Mainimukh Bazar',
  'Longodu,baittapara',
  'Bairagi Bazar',
  'Islamabad, Sonai 5No,3bridge,Korlachhari',
  'Rashidpur,Chumoni,Shibir bazar,Kalapakujya',
  'Mahilya',
  'Bhai bon chora',
  'Challatuli,VhashinnaAdam bazar',
  'Ghulshakhali,chumoni,Rajgong',
] as const;

export const EXPENSE_CATEGORIES = [
  'Shop Rent',
  'Electricity & DESCO',
  'Staff Salary & Bonus',
  'SR Commission & TA/DA',
  'Packaging & Polybags',
  'Transport & Van',
  'Generator & Fuel',
  'Cleaning & Maintenance',
  'Internet & POS Utilities',
  'Other Operating',
] as const;

export const EXPENSE_PAYMENT_METHODS: { id: ExpensePaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash Drawer' },
  { id: 'bkash', label: 'bKash' },
  { id: 'nagad', label: 'Nagad' },
  { id: 'bank', label: 'Bank Transfer' },
];

export const STAFF_ROLES: { id: StaffRole; label: string; permissions: string }[] = [
  { id: 'sr', label: 'Field SR (Sales Rep)', permissions: 'Field Order Entry, Market Routes, Retailer Visits, Collections' },
  { id: 'manager', label: 'Branch Manager', permissions: 'POS, SR Dispatch, Inventory, Purchases, Shifts, Reports' },
  { id: 'cashier', label: 'Counter Cashier', permissions: 'POS Terminal, Receipts, Held Bills, Shift Count' },
  { id: 'inventory', label: 'Inventory Officer', permissions: 'Products, Stock Adjust, Suppliers, Barcode Labels' },
  { id: 'accountant', label: 'Accounts & VAT', permissions: 'Due Ledger, Sales, Expenses, VAT Reports, CSV Exports' },
];

export interface CartItem {
  product: Product;
  qty: number;
  unitPrice: number;
  vatRate: number;
  saleUnit: string;
}

export interface SaasPlanSpec {
  id: PlanId;
  name: string;
  audience: string;
  monthlyPriceBdt: number;
  maxSkus: number;
  maxBranches: number;
  maxMonthlyInvoices: number;
  highlights: string[];
}

export const SAAS_PLANS: SaasPlanSpec[] = [
  {
    id: 'starter',
    name: 'Starter',
    audience: 'For single-counter mini marts',
    monthlyPriceBdt: 1490,
    maxSkus: 500,
    maxBranches: 1,
    maxMonthlyInvoices: 3000,
    highlights: [
      'Up to 500 active SKUs & barcode scanning',
      '1 retail outlet & counter terminal',
      '80mm Mushak-6.3 VAT thermal receipts',
      'Cash, bKash, Nagad, Rocket & Card tracking',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    audience: 'For busy neighborhood super shops',
    monthlyPriceBdt: 3490,
    maxSkus: 5000,
    maxBranches: 5,
    maxMonthlyInvoices: 25000,
    highlights: [
      'Up to 5,000 SKUs & low-stock alerts',
      'Up to 5 synced branches & registers',
      'Customer phone directory & loyalty points',
      'Daily profit, VAT & MFS settlement analytics',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    audience: 'For multi-city super shop chains',
    monthlyPriceBdt: 7990,
    maxSkus: 50000,
    maxBranches: 25,
    maxMonthlyInvoices: 250000,
    highlights: [
      'Up to 50,000 SKUs across central catalog',
      'Up to 25 outlets with real-time cloud sync',
      'CSV accounting ledger exports & audit logs',
      'Priority Dhaka onboarding & hardware setup',
    ],
  },
];

export const PRODUCT_CATEGORIES = [
  'Groceries',
  'Rice & Grains',
  'Pulses & Lentils',
  'Flour & Baking',
  'Oil & Spices',
  'Cooking Oil',
  'Salt & Sugar',
  'Spices & Seasonings',
  'Pickles & Chutneys',
  'Sauces & Condiments',
  'Tea & Coffee',
  'Dairy & Bakery',
  'Dairy',
  'Bakery',
  'Eggs',
  'Beverages',
  'Bottled Water',
  'Snacks',
  'Biscuits & Cookies',
  'Sweets & Confectionery',
  'Chocolate & Candy',
  'Instant Foods & Noodles',
  'Snacks & Confectionery',
  'Frozen Foods',
  'Meat & Fish',
  'Fruits & Vegetables',
  'Canned & Packaged Foods',
  'Personal Care',
  'Oral Care',
  'Hair Care & Cosmetics',
  'Feminine Care',
  'Baby Care',
  'Baby Food & Formula',
  'Household',
  'Household Cleaning',
  'Laundry & Dishwashing',
  'Paper & Tissue',
  'Kitchenware',
  'Disposable Items',
  'Stationery & Books',
  'Mobile Recharge & Accessories',
  'Medicines & Health Care',
  'Tobacco & Smoking',
  'Pet Food & Supplies',
  'Religious Items',
  'Seasonal Products',
  'Other',
] as const;

export const PAYMENT_METHODS: { id: PaymentMethod; label: string; short: string; needsRef: boolean }[] = [
  { id: 'cash', label: 'Cash (BDT)', short: 'Cash', needsRef: false },
  { id: 'bkash', label: 'bKash', short: 'bKash', needsRef: true },
  { id: 'nagad', label: 'Nagad', short: 'Nagad', needsRef: true },
  { id: 'rocket', label: 'Rocket', short: 'Rocket', needsRef: true },
  { id: 'card', label: 'Card / POS', short: 'Card', needsRef: true },
  { id: 'credit', label: 'Due / Baki', short: 'Due/Baki', needsRef: false },
  { id: 'split', label: 'Split Tender', short: 'Split', needsRef: true },
];

export interface StarterProductSeed {
  name: string;
  barcode: string;
  sku: string;
  category: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  vatRate: number;
  stock: number;
  reorderLevel: number;
}

// Authentic Bangladesh Super Shop catalog using GS1 Bangladesh prefix (894)
export const BD_STARTER_CATALOG: StarterProductSeed[] = [
  {
    name: 'Aarong Miniket Rice 5 kg',
    barcode: '8941100500012',
    sku: 'GRC-RICE-5K',
    category: 'Groceries',
    unit: 'bag',
    costPrice: 365,
    sellingPrice: 415,
    vatRate: 0,
    stock: 48,
    reorderLevel: 12,
  },
  {
    name: 'Chinigura Aromatic Rice 1 kg',
    barcode: '8941100500029',
    sku: 'GRC-CHIN-1K',
    category: 'Groceries',
    unit: 'pack',
    costPrice: 138,
    sellingPrice: 165,
    vatRate: 0,
    stock: 34,
    reorderLevel: 10,
  },
  {
    name: 'Rupchanda Soyabean Oil 5 L',
    barcode: '8941100500036',
    sku: 'OIL-RUP-5L',
    category: 'Oil & Spices',
    unit: 'bottle',
    costPrice: 785,
    sellingPrice: 845,
    vatRate: 5,
    stock: 26,
    reorderLevel: 8,
  },
  {
    name: 'Teer Fortified Soyabean Oil 2 L',
    barcode: '8941100500043',
    sku: 'OIL-TER-2L',
    category: 'Oil & Spices',
    unit: 'bottle',
    costPrice: 322,
    sellingPrice: 348,
    vatRate: 5,
    stock: 32,
    reorderLevel: 10,
  },
  {
    name: 'ACI Pure Vacuum Salt 1 kg',
    barcode: '8941100500050',
    sku: 'GRC-SALT-1K',
    category: 'Groceries',
    unit: 'pack',
    costPrice: 34,
    sellingPrice: 42,
    vatRate: 0,
    stock: 85,
    reorderLevel: 20,
  },
  {
    name: 'Fresh Refined Sugar 1 kg',
    barcode: '8941100500067',
    sku: 'GRC-SUGR-1K',
    category: 'Groceries',
    unit: 'pack',
    costPrice: 124,
    sellingPrice: 140,
    vatRate: 0,
    stock: 54,
    reorderLevel: 15,
  },
  {
    name: 'Radhuni Red Chili Powder 200 g',
    barcode: '8941100500074',
    sku: 'SPC-CHIL-200',
    category: 'Oil & Spices',
    unit: 'pack',
    costPrice: 105,
    sellingPrice: 128,
    vatRate: 5,
    stock: 42,
    reorderLevel: 12,
  },
  {
    name: 'Radhuni Turmeric Powder 200 g',
    barcode: '8941100500081',
    sku: 'SPC-TURM-200',
    category: 'Oil & Spices',
    unit: 'pack',
    costPrice: 82,
    sellingPrice: 102,
    vatRate: 5,
    stock: 7,
    reorderLevel: 10,
  },
  {
    name: 'Aarong Pasteurized Milk 1 L',
    barcode: '8941100500098',
    sku: 'DRY-MILK-1L',
    category: 'Dairy & Bakery',
    unit: 'pack',
    costPrice: 84,
    sellingPrice: 95,
    vatRate: 0,
    stock: 22,
    reorderLevel: 10,
  },
  {
    name: 'Farm Fresh Brown Eggs 12 pcs',
    barcode: '8941100500104',
    sku: 'DRY-EGG-12',
    category: 'Dairy & Bakery',
    unit: 'box',
    costPrice: 148,
    sellingPrice: 170,
    vatRate: 0,
    stock: 19,
    reorderLevel: 8,
  },
  {
    name: 'Ispahani Mirzapore Tea 400 g',
    barcode: '8941100500111',
    sku: 'BEV-TEA-400',
    category: 'Beverages',
    unit: 'pack',
    costPrice: 195,
    sellingPrice: 230,
    vatRate: 5,
    stock: 38,
    reorderLevel: 10,
  },
  {
    name: 'Nescafe Classic Coffee Jar 100 g',
    barcode: '8941100500128',
    sku: 'BEV-COF-100',
    category: 'Beverages',
    unit: 'jar',
    costPrice: 370,
    sellingPrice: 430,
    vatRate: 7.5,
    stock: 14,
    reorderLevel: 6,
  },
  {
    name: 'Pran Frooto Mango Drink 1 L',
    barcode: '8941100500135',
    sku: 'BEV-MANG-1L',
    category: 'Beverages',
    unit: 'bottle',
    costPrice: 82,
    sellingPrice: 100,
    vatRate: 5,
    stock: 46,
    reorderLevel: 15,
  },
  {
    name: 'Maggi 2-Minute Noodles 8-Pack',
    barcode: '8941100500142',
    sku: 'SNK-MAGG-8P',
    category: 'Snacks',
    unit: 'pack',
    costPrice: 146,
    sellingPrice: 170,
    vatRate: 5,
    stock: 60,
    reorderLevel: 15,
  },
  {
    name: 'Olympic Energy Plus Biscuit 150 g',
    barcode: '8941100500159',
    sku: 'SNK-BISC-150',
    category: 'Snacks',
    unit: 'pack',
    costPrice: 28,
    sellingPrice: 35,
    vatRate: 5,
    stock: 72,
    reorderLevel: 20,
  },
  {
    name: 'Dettol Original Antiseptic Soap 125 g',
    barcode: '8941100500166',
    sku: 'PRC-SOAP-125',
    category: 'Personal Care',
    unit: 'pcs',
    costPrice: 58,
    sellingPrice: 70,
    vatRate: 7.5,
    stock: 52,
    reorderLevel: 15,
  },
  {
    name: 'Lifebuoy Total Handwash 200 ml',
    barcode: '8941100500173',
    sku: 'PRC-HND-200',
    category: 'Personal Care',
    unit: 'bottle',
    costPrice: 108,
    sellingPrice: 130,
    vatRate: 7.5,
    stock: 5,
    reorderLevel: 10,
  },
  {
    name: 'Vim Dishwash Liquid 500 ml',
    barcode: '8941100500180',
    sku: 'HSH-VIM-500',
    category: 'Household',
    unit: 'bottle',
    costPrice: 132,
    sellingPrice: 160,
    vatRate: 7.5,
    stock: 30,
    reorderLevel: 10,
  },
];

export function formatBDT(amount: number, showDecimals = true): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(safe);
  return `৳ ${formatted}`;
}

export function formatDateTimeBD(ts: Timestamp | Date | null | undefined): string {
  if (!ts) return 'Just now';
  const date = ts instanceof Date ? ts : ts.toDate();
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function sanitizeStr(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function generateBdBarcode(): string {
  const randomDigits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
  const base12 = `894${randomDigits}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(base12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${base12}${checkDigit}`;
}
