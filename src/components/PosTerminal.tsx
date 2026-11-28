import React, { useMemo, useRef, useState } from 'react';
import {
  Barcode,
  ArrowLeft,
  Clock,
  Folder,
  List,
  Minus,
  PackagePlus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { BANGLADESH_GROCERY_BRANDS, brandLogoUrl as getCatalogBrandLogo } from '../data/bangladeshBrands';
import { BrandLogo } from './BrandLogo';
import {
  PAYMENT_METHODS,
  PRODUCT_CATEGORIES,
  type CartItem,
  type Customer,
  type PaymentMethod,
  type Product,
  type Sale,
  type Shop,
  formatBDT,
} from '../types/pos';
import {
  createSaleTransaction,
  seedStarterCatalog,
  upsertCustomer,
} from '../services/posService';

interface PosTerminalProps {
  shop: Shop;
  activeBranchName: string;
  cashierName: string;
  products: Product[];
  customers: Customer[];
  heldSales: Sale[];
  onSaleCompleted: (sale: Sale) => void;
  onResumeHeldSale: (sale: Sale) => void;
  onNavigateInventory: () => void;
}

const QUICK_BDT_NOTES = [100, 500, 1000, 2000, 5000];

export const PosTerminal: React.FC<PosTerminalProps> = ({
  shop,
  activeBranchName,
  cashierName,
  products,
  customers,
  heldSales,
  onSaleCompleted,
  onResumeHeldSale,
  onNavigateInventory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [productView, setProductView] = useState<'products' | 'brands'>('products');
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [discountType, setDiscountType] = useState<'bdt' | 'pct'>('bdt');
  const [discountInput, setDiscountInput] = useState<string>('');
  const vatEnabled = false;
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [paidInput, setPaidInput] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeProducts = useMemo(
    () => products.filter((p) => p.isActive),
    [products]
  );

  const categories = useMemo(() => {
    const present = new Set(activeProducts.map((p) => p.category));
    const ordered = PRODUCT_CATEGORIES.filter((c) => present.has(c));
    const extras = Array.from(present).filter(
      (c) => !(PRODUCT_CATEGORIES as readonly string[]).includes(c)
    );
    return ['All', ...ordered, ...extras];
  }, [activeProducts]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeProducts.filter((p) => {
      if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q)
      );
    });
  }, [activeProducts, searchQuery, selectedCategory]);

  const brandFolders = useMemo(() => {
    const knownLogoByName = new Map(BANGLADESH_GROCERY_BRANDS.map((brand) => [brand.name.toLocaleLowerCase(), getCatalogBrandLogo(brand.domain)]));
    const folders = new Map<string, { name: string; products: Product[]; logoDataUrl?: string; logoUrl?: string }>();
    for (const product of filteredProducts) {
      const name = product.brand?.trim() || 'Unbranded';
      const key = name.toLocaleLowerCase();
      const folder = folders.get(key) || {
        name,
        products: [],
        logoDataUrl: product.brandLogoDataUrl,
        logoUrl: product.brandLogoUrl || knownLogoByName.get(key),
      };
      folder.products.push(product);
      folder.logoDataUrl ||= product.brandLogoDataUrl;
      folder.logoUrl ||= product.brandLogoUrl;
      folders.set(key, folder);
    }
    return Array.from(folders.entries())
      .map(([key, folder]) => ({ key, ...folder }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredProducts]);

  const brandProducts = useMemo(
    () => selectedBrand ? filteredProducts.filter((product) => (product.brand?.trim().toLocaleLowerCase() || 'unbranded') === selectedBrand) : filteredProducts,
    [filteredProducts, selectedBrand]
  );

  const cartMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cart) {
      map.set(item.product.id, item.qty);
    }
    return map;
  }, [cart]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const totals = useMemo(() => {
    const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = Number(
      cart.reduce((sum, item) => sum + item.unitPrice * item.qty, 0).toFixed(2)
    );
    const rawDiscount = Math.max(0, Number(discountInput) || 0);
    const discountAmount =
      discountType === 'pct'
        ? Number(Math.min(subtotal, (subtotal * Math.min(100, rawDiscount)) / 100).toFixed(2))
        : Number(Math.min(subtotal, rawDiscount).toFixed(2));
    const taxableRatio = subtotal > 0 ? (subtotal - discountAmount) / subtotal : 0;
    const vatAmount = Number(
      cart
        .reduce(
          (sum, item) =>
            sum +
            item.unitPrice * item.qty * taxableRatio * (vatEnabled ? item.vatRate / 100 : 0),
          0
        )
        .toFixed(2)
    );
    const grandTotal = Number((subtotal - discountAmount + vatAmount).toFixed(2));
    const tendered =
      paymentMethod === 'cash'
        ? paidInput === ''
          ? grandTotal
          : Math.max(0, Number(paidInput) || 0)
        : paymentMethod === 'credit'
          ? Math.min(grandTotal, Math.max(0, Number(paidInput) || 0))
          : grandTotal;
    const changeDue = Number(Math.max(0, tendered - grandTotal).toFixed(2));
    const dueToAdd =
      paymentMethod === 'credit' ? Number(Math.max(0, grandTotal - tendered).toFixed(2)) : 0;
    const shortAmount =
      paymentMethod === 'cash' ? Number(Math.max(0, grandTotal - tendered).toFixed(2)) : 0;

    return {
      itemCount,
      subtotal,
      discountAmount,
      vatAmount,
      grandTotal,
      tendered,
      changeDue,
      dueToAdd,
      shortAmount,
    };
  }, [cart, discountInput, discountType, paymentMethod, paidInput]);

  const showNotice = (msg: string) => {
    setScanNotice(msg);
    window.setTimeout(() => {
      setScanNotice((prev) => (prev === msg ? null : prev));
    }, 2400);
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      showNotice(`${product.name} is out of stock.`);
      return;
    }
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx >= 0) {
        const currentQty = prev[idx].qty;
        const ratio = prev[idx].saleUnit === product.secondaryUnit ? (product.secondaryUnitQuantity || 1) : 1;
        if ((currentQty + 1) / ratio > product.stock) {
          showNotice(`Only ${product.stock} ${product.unit}${product.secondaryUnit ? ` (${product.stock * (product.secondaryUnitQuantity || 1)} ${product.secondaryUnit})` : ''} available for ${product.name}.`);
          return prev;
        }
        const next = [...prev];
        next[idx] = { ...next[idx], product, qty: currentQty + 1 };
        return next;
      }
      if (prev.length >= 50) {
        showNotice('Maximum 50 distinct SKUs per invoice.');
        return prev;
      }
      return [...prev, { product, qty: 1, unitPrice: product.sellingPrice, vatRate: product.vatRate, saleUnit: product.unit }];
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const nextQty = item.qty + delta;
          if (nextQty <= 0) return null;
          const ratio = item.saleUnit === item.product.secondaryUnit ? (item.product.secondaryUnitQuantity || 1) : 1;
          if (nextQty / ratio > item.product.stock) {
            showNotice(`Max available stock (${item.product.stock}) reached.`);
            return item;
          }
          return { ...item, qty: nextQty };
        })
        .filter((i): i is CartItem => i !== null)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateCartItem = (productId:string, changes:Partial<Pick<CartItem,'unitPrice'|'vatRate'|'qty'|'saleUnit'>>) => {
    setCart((prev)=>prev.map((item)=>item.product.id===productId?{...item,...changes}:item));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountInput('');
    setPaymentRef('');
    setPaidInput('');
    setSelectedCustomerId('');
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    const exactMatch = activeProducts.find(
      (p) =>
        p.barcode.toLowerCase() === trimmed.toLowerCase() ||
        p.sku.toLowerCase() === trimmed.toLowerCase()
    );
    if (exactMatch) {
      addToCart(exactMatch);
      setSearchQuery('');
      showNotice(`Added ${exactMatch.name} (${formatBDT(exactMatch.sellingPrice)})`);
    } else if (filteredProducts.length === 1) {
      addToCart(filteredProducts[0]);
      setSearchQuery('');
      showNotice(`Added ${filteredProducts[0].name}`);
    } else {
      showNotice(`No exact barcode match for "${trimmed}".`);
    }
  };

  const handleSimulateScan = () => {
    const inStock = activeProducts.filter((p) => p.stock > 0);
    if (inStock.length === 0) return;
    const randomProd = inStock[Math.floor(Math.random() * inStock.length)];
    addToCart(randomProd);
    showNotice(`Scanned ${randomProd.barcode} · ${randomProd.name}`);
    searchInputRef.current?.focus();
  };

  const handleSeedCatalog = async () => {
    setSeeding(true);
    try {
      const count = await seedStarterCatalog(shop.id, shop.ownerId);
      showNotice(`Loaded ${count} Bangladesh super shop items.`);
    } finally {
      setSeeding(false);
    }
  };

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) return;
    setSavingCustomer(true);
    try {
      const createdId = await upsertCustomer(shop.id, shop.ownerId, {
        name: newCustName,
        phone: newCustPhone,
        address: '',
      });
      setSelectedCustomerId(createdId);
      setNewCustName('');
      setNewCustPhone('');
      setQuickCustomerOpen(false);
      showNotice('Customer added and attached to bill.');
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleCheckout = async (status: 'completed' | 'held') => {
    if (cart.length === 0 || submitting) return;
    if (status === 'completed' && paymentMethod === 'credit' && !selectedCustomer) {
      showNotice('Select or add a customer account to record a Due / Baki sale.');
      setQuickCustomerOpen(true);
      return;
    }
    if (status === 'completed' && paymentMethod === 'cash' && totals.shortAmount > 0) {
      showNotice(`Amount tendered is short by ${formatBDT(totals.shortAmount)}. Use Due/Baki for credit.`);
      return;
    }

    setSubmitting(true);
    try {
      const createdSale = await createSaleTransaction(shop, cart, {
        cashierName,
        branchName: activeBranchName,
        customer: selectedCustomer,
        discountAmount: totals.discountAmount,
        paymentMethod,
        paymentRef,
        paidAmount: status === 'completed' ? totals.tendered : 0,
        vatEnabled,
        status,
      });

      clearCart();
      setMobileCartOpen(false);
      if (status === 'completed') {
        onSaleCompleted(createdSale);
      } else {
        showNotice(`Bill ${createdSale.invoiceNumber} saved to Held Carts.`);
      }
    } catch (error) {
      showNotice(error instanceof Error ? `Sale was not saved: ${error.message}` : 'Sale was not saved. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentMethodMeta = PAYMENT_METHODS.find((m) => m.id === paymentMethod);

  // Reusable Cart & Payment Panel (used both in desktop right column and mobile bottom sheet)
  const renderCheckoutBody = () => (
    <div className="flex flex-col h-full">
      {/* Customer Row */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 space-y-2">
        <div className="flex items-center gap-2">
          <select
            aria-label="Select customer"
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="flex-1 min-h-[40px] px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-700"
          >
            <option value="">Walk-in Customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shopName ? `${c.shopName} (${c.name})` : c.name} · {c.phone}
                {Number(c.balanceDue || 0) > 0
                  ? ` · Due ${formatBDT(Number(c.balanceDue || 0), false)}`
                  : ` (${c.loyaltyPoints} pts)`}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setQuickCustomerOpen((v) => !v)}
            title="Quick add customer"
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>

        {quickCustomerOpen && (
          <form onSubmit={handleQuickAddCustomer} className="grid grid-cols-12 gap-2 pt-1">
            <input
              type="text"
              required
              placeholder="Customer name"
              value={newCustName}
              onChange={(e) => setNewCustName(e.target.value)}
              className="col-span-5 px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
            />
            <input
              type="tel"
              required
              placeholder="017XX-XXXXXX"
              value={newCustPhone}
              onChange={(e) => setNewCustPhone(e.target.value)}
              className="col-span-5 px-2.5 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
            />
            <button
              type="submit"
              disabled={savingCustomer}
              className="col-span-2 px-2 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              Add
            </button>
          </form>
        )}
      </div>

      {/* Cart Line Items */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {cart.length === 0 ? (
          <div className="h-full min-h-[180px] flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <ShoppingBag className="w-8 h-8 mb-2 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Current basket is empty</p>
            <p className="mt-1 text-xs text-slate-500">
              Tap any product or scan an 894 barcode to begin checkout.
            </p>
          </div>
        ) : (
          cart.map(({ product, qty, unitPrice, saleUnit }) => (
            <div key={product.id} className="px-4 py-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 text-sm font-medium text-slate-900 truncate">{product.name}</p>
                <button
                  type="button"
                  onClick={() => removeFromCart(product.id)}
                  aria-label={`Remove ${product.name}`}
                  className="min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                ><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              <div className="flex items-end gap-2">
                <label className="w-24 text-[10px] font-medium text-slate-500">Sale unit
                  <select value={saleUnit} onChange={(e)=>{const unit=e.target.value;const ratio=unit===product.secondaryUnit?(product.secondaryUnitQuantity||1):1;updateCartItem(product.id,{saleUnit:unit,unitPrice:product.sellingPrice/ratio});}} className="mt-1 w-full min-h-[36px] rounded-lg border border-slate-200 px-1 text-xs text-slate-900">
                    <option value={product.unit}>{product.unit}</option>{product.secondaryUnit && <option value={product.secondaryUnit}>{product.secondaryUnit}</option>}
                  </select>
                </label>
                <label className="min-w-0 flex-1 text-[10px] font-medium text-slate-500">Sell rate (৳)
                  <input type="number" min="0" max="10000000" step="0.01" value={unitPrice} onChange={(e)=>updateCartItem(product.id,{unitPrice:Math.min(10000000,Math.max(0,Number(e.target.value)||0))})} className="mt-1 w-full min-h-[36px] rounded-lg border border-slate-200 px-2 font-mono text-xs text-slate-900 focus:border-emerald-700 focus:outline-none" />
                </label>
                <div className="flex items-center gap-1 shrink-0 pb-0.5">
                <button
                  type="button"
                  onClick={() => updateCartQty(product.id, -1)}
                  aria-label={`Decrease quantity of ${product.name}`}
                  className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input aria-label={`Quantity in ${saleUnit}`} type="number" min="0.01" step="any" value={qty} onChange={(e)=>{const next=Number(e.target.value);const ratio=saleUnit===product.secondaryUnit?(product.secondaryUnitQuantity||1):1;if(next>0 && next/ratio<=product.stock)updateCartItem(product.id,{qty:next});}} className="w-16 min-h-[36px] rounded-lg border border-slate-200 text-center font-mono text-sm" />
                <button
                  type="button"
                  onClick={() => updateCartQty(product.id, 1)}
                  aria-label={`Increase quantity of ${product.name}`}
                  className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                </div>
                <div className="w-[76px] pb-2 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums shrink-0">
                  {formatBDT(unitPrice * qty, false)}
                </div>
              </div>
              <p className="text-[10px] text-slate-500">
                Available: {product.stock} {product.unit}{product.secondaryUnit ? ` · ${Number((product.stock * (product.secondaryUnitQuantity || 0)).toFixed(2))} ${product.secondaryUnit}` : ''}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Totals & Payment Controls */}
      <div className="border-t border-slate-200 bg-white p-4 space-y-3 pb-safe">
        {/* Discount Row */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-600">Discount</span>
          <div className="flex items-center gap-1.5">
            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setDiscountType('bdt')}
                className={`px-2 py-1 text-xs font-mono font-medium rounded-md cursor-pointer ${
                  discountType === 'bdt' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                ৳
              </button>
              <button
                type="button"
                onClick={() => setDiscountType('pct')}
                className={`px-2 py-1 text-xs font-mono font-medium rounded-md cursor-pointer ${
                  discountType === 'pct' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                %
              </button>
            </div>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
              className="w-24 px-2.5 py-1.5 text-right font-mono text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700 tabular-nums"
            />
          </div>
        </div>

        {/* Financial Summary */}
        <div className="space-y-1 text-xs text-slate-600 tabular-nums border-t border-slate-100 pt-2.5">
          <div className="flex justify-between">
            <span>Subtotal ({totals.itemCount} items)</span>
            <span className="font-mono text-slate-900">{formatBDT(totals.subtotal)}</span>
          </div>
          {totals.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-800">
              <span>Discount</span>
              <span className="font-mono">-{formatBDT(totals.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
            <span className="text-sm font-semibold text-slate-900">Net Payable</span>
            <span className="font-mono text-xl font-bold text-slate-900">
              {formatBDT(totals.grandTotal)}
            </span>
          </div>
        </div>

        {/* Payment Method Segmented Selector */}
        <div className="grid grid-cols-4 gap-1.5">
          {PAYMENT_METHODS.map((method) => {
            const active = paymentMethod === method.id;
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => {
                  setPaymentMethod(method.id);
                  if (method.id !== 'cash' && method.id !== 'credit') setPaidInput('');
                  if (method.id === 'credit') setPaidInput('');
                }}
                className={`min-h-[38px] px-1.5 py-1.5 text-[11px] font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? method.id === 'credit'
                      ? 'bg-amber-700 text-white border-amber-700'
                      : 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {method.short}
              </button>
            );
          })}
        </div>

        {/* Cash Tender & Quick BDT Notes OR Credit/Baki Partial Pay OR MFS Reference */}
        {paymentMethod === 'cash' ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="sr-only" htmlFor="cash-received">
                  Cash Received (BDT)
                </label>
                <input
                  id="cash-received"
                  type="number"
                  min="0"
                  step="1"
                  placeholder={`Received (${totals.grandTotal.toFixed(0)})`}
                  value={paidInput}
                  onChange={(e) => setPaidInput(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 font-mono text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700 tabular-nums"
                />
              </div>
              <div className="text-right min-w-[104px]">
                <p className="text-[11px] text-slate-500">
                  {totals.shortAmount > 0 ? 'Short Due' : 'Change Due'}
                </p>
                <p
                  className={`font-mono text-sm font-bold tabular-nums ${
                    totals.shortAmount > 0 ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  {formatBDT(totals.shortAmount > 0 ? totals.shortAmount : totals.changeDue)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setPaidInput(String(Math.ceil(totals.grandTotal)))}
                className="px-2.5 py-1.5 text-xs font-mono font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
              >
                Exact
              </button>
              {QUICK_BDT_NOTES.map((note) => (
                <button
                  key={note}
                  type="button"
                  onClick={() => setPaidInput(String(note))}
                  className="px-2.5 py-1.5 text-xs font-mono font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                >
                  ৳{note}
                </button>
              ))}
            </div>
          </div>
        ) : paymentMethod === 'credit' ? (
          <div className="space-y-2 p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg">
            {!selectedCustomer ? (
              <p className="text-xs font-medium text-amber-900">
                Select a customer above (or click +) to post Due / Baki to their ledger.
              </p>
            ) : (
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-900 font-medium truncate">
                  {selectedCustomer.shopName || selectedCustomer.name}
                </span>
                <span className="font-mono text-amber-900 shrink-0 tabular-nums">
                  Prev Due: {formatBDT(Number(selectedCustomer.balanceDue || 0), false)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max={totals.grandTotal}
                step="1"
                placeholder="Partial Cash Paid (0 for full baki)"
                value={paidInput}
                onChange={(e) => setPaidInput(e.target.value)}
                className="flex-1 min-h-[38px] px-2.5 py-1.5 font-mono text-xs bg-white border border-amber-300 rounded-lg focus:outline-none focus:border-emerald-700 tabular-nums"
              />
              <div className="text-right min-w-[96px]">
                <p className="text-[10px] text-amber-800">Baki Added</p>
                <p className="font-mono text-sm font-bold text-red-700 tabular-nums">
                  {formatBDT(totals.dueToAdd, false)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <input
              type="text"
              placeholder={`${currentMethodMeta?.short || 'Payment'} TrxID / Card Last 4 / Split Note`}
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              maxLength={60}
              className="w-full min-h-[40px] px-3 py-1.5 font-mono text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
            />
          </div>
        )}

        {/* Primary Checkout Actions */}
        <div className="grid grid-cols-12 gap-2 pt-1">
          <button
            type="button"
            disabled={cart.length === 0 || submitting}
            onClick={() => void handleCheckout('held')}
            className="col-span-4 min-h-[46px] px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            Hold Bill
          </button>
          <button
            type="button"
            disabled={cart.length === 0 || submitting}
            onClick={() => void handleCheckout('completed')}
            className={`col-span-8 min-h-[46px] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap font-mono tabular-nums cursor-pointer ${
              paymentMethod === 'credit'
                ? 'bg-amber-700 hover:bg-amber-800'
                : 'bg-emerald-700 hover:bg-emerald-800'
            }`}
          >
            {submitting
              ? 'Processing...'
              : paymentMethod === 'credit'
                ? `Post Baki ${formatBDT(totals.dueToAdd, false)}`
                : `Pay ${formatBDT(totals.grandTotal)}`}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col lg:grid lg:grid-cols-12 lg:gap-6">
      {/* Left Catalog & Scanner Pane */}
      <div className="lg:col-span-7 xl:col-span-8 flex flex-col min-h-0 space-y-4">
        {/* Barcode & Search Toolbar */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-3">
          <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Scan 894 barcode or search product name / SKU..."
                className="w-full min-h-[44px] pl-9 pr-9 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-emerald-700"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleSimulateScan}
              disabled={activeProducts.length === 0}
              title="Simulate barcode scan"
              className="min-h-[44px] inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Barcode className="w-4 h-4 text-emerald-700" />
              <span className="hidden sm:inline">Test Scan</span>
            </button>
          </form>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {scanNotice && (
            <p className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {scanNotice}
            </p>
          )}
        </div>

        {/* Product and brand catalog views */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => { setProductView('products'); setSelectedBrand(null); }}
            aria-pressed={productView === 'products'}
            className={`min-h-[38px] inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${productView === 'products' ? 'border-[#0756A5] bg-[#0756A5] text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            <List className="h-4 w-4" />
            <span>Product List</span>
          </button>
          <button
            type="button"
            onClick={() => { setProductView('brands'); setSelectedBrand(null); }}
            aria-pressed={productView === 'brands'}
            className={`min-h-[38px] inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${productView === 'brands' ? 'border-[#0756A5] bg-[#0756A5] text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            <Folder className="h-4 w-4" />
            <span>Brand List</span>
          </button>
          {productView === 'brands' && selectedBrand && (
            <button
              type="button"
              onClick={() => setSelectedBrand(null)}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-[#0756A5] hover:bg-blue-50"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>All brands · {brandFolders.find((folder) => folder.key === selectedBrand)?.name || 'Brand'}</span>
            </button>
          )}
        </div>

        {/* Held Bills Bar */}
        {heldSales.length > 0 && (
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 overflow-x-auto">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 whitespace-nowrap shrink-0">
              <Clock className="w-4 h-4 text-amber-700" />
              <span>Held Bills ({heldSales.length})</span>
            </div>
            <div className="flex items-center gap-2">
              {heldSales.slice(0, 4).map((held) => (
                <button
                  key={held.id}
                  type="button"
                  onClick={() => onResumeHeldSale(held)}
                  className="px-2.5 py-1.5 text-xs font-mono font-medium bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {held.invoiceNumber} · {formatBDT(held.totalAmount, false)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Product Grid or Empty Catalog Onboarding */}
        {activeProducts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-12 text-center space-y-4">
            <PackagePlus className="w-10 h-10 text-emerald-700 mx-auto" />
            <div className="max-w-md mx-auto space-y-1.5">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Stock your Smart Super Shop catalog
              </h2>
              <p className="text-sm text-slate-600">
                Load 18 authentic Bangladesh super shop products (rice, oil, tea, milk, spices,
                toiletries) with GS1 894 barcodes in one click, or add your own custom SKUs.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={seeding}
                onClick={() => void handleSeedCatalog()}
                className="min-h-[44px] px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
              >
                {seeding ? 'Loading Catalog...' : 'Load 18 BD Starter Products'}
              </button>
              <button
                type="button"
                onClick={onNavigateInventory}
                className="min-h-[44px] px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              >
                Add Product Manually
              </button>
            </div>
          </div>
        ) : productView === 'brands' && !selectedBrand ? (
          brandFolders.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
              No brand folders match the current search or category.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 pb-24 sm:grid-cols-3 xl:grid-cols-4 lg:pb-4">
              {brandFolders.map((folder) => (
                <button
                  key={folder.key}
                  type="button"
                  onClick={() => setSelectedBrand(folder.key)}
                  className="group min-h-[124px] rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-[#0756A5]/40 hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    {folder.name === 'Unbranded'
                      ? <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#0756A5] group-hover:bg-blue-100"><Folder className="h-5 w-5" /></span>
                      : <BrandLogo name={folder.name} imageDataUrl={folder.logoDataUrl} logoUrl={folder.logoUrl} className="h-10 w-10" />}
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-[11px] font-semibold text-slate-600">
                      {folder.products.length}
                    </span>
                  </div>
                  <p className="mt-3 truncate text-sm font-bold text-slate-900">{folder.name}</p>
                  <p className="mt-1 truncate text-[11px] text-slate-500">
                    {folder.products.slice(0, 2).map((product) => product.name).join(' · ')}
                  </p>
                </button>
              ))}
            </div>
          )
        ) : brandProducts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              No products matched "{searchQuery}".
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
              }}
              className="mt-3 px-4 py-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 pb-24 lg:pb-4">
            {brandProducts.map((product) => {
              const inCartQty = cartMap.get(product.id) || 0;
              const outOfStock = product.stock <= 0;
              const lowStock = !outOfStock && product.stock <= product.reorderLevel;

              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={outOfStock}
                  onClick={() => addToCart(product)}
                  className={`text-left p-3.5 rounded-2xl border transition-all duration-150 flex flex-col justify-between min-h-[132px] cursor-pointer active:scale-[0.98] ${
                    outOfStock
                      ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                      : inCartQty > 0
                        ? 'bg-emerald-50/55 border-emerald-700 ring-1 ring-emerald-700/20 shadow-xs'
                        : 'bg-white border-slate-200/90 hover:border-slate-400 hover:-translate-y-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]'
                  }`}
                >
                  <div>
                    {product.imageDataUrl && <img src={product.imageDataUrl} alt="" className="mb-2 h-20 w-full rounded-lg object-cover" />}
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] font-medium text-slate-500 truncate">
                        {product.category} · {product.unit}{product.secondaryUnit ? ` / ${product.secondaryUnit}` : ''}
                      </p>
                      {inCartQty > 0 && (
                        <span className="font-mono text-xs font-bold text-emerald-800 tabular-nums shrink-0">
                          ×{inCartQty}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                      {product.name}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-end justify-between gap-2">
                    <div>
                      <p className="font-mono text-base font-bold text-slate-900 tabular-nums">
                        {formatBDT(product.sellingPrice, false)} / {product.unit}
                        {product.secondaryUnit && <span className="block text-[10px] text-slate-500">{formatBDT(product.sellingPrice/(product.secondaryUnitQuantity||1),false)} / {product.secondaryUnit} · 1 {product.unit} = {product.secondaryUnitQuantity} {product.secondaryUnit}</span>}
                      </p>
                      <p
                        className={`text-[11px] font-medium tabular-nums ${
                          outOfStock
                            ? 'text-red-700'
                            : lowStock
                              ? 'text-amber-700'
                              : 'text-slate-500'
                        }`}
                      >
                        {outOfStock
                          ? 'Out of stock'
                          : lowStock
                            ? `Low · ${product.stock}`
                        : `Stock · ${product.stock} ${product.unit}${product.secondaryUnit ? ` / ${Number((product.stock * (product.secondaryUnitQuantity || 0)).toFixed(2))} ${product.secondaryUnit}` : ''}`}
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 tabular-nums hidden sm:inline">
                      {product.barcode.slice(-5)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop Right Commercial Checkout Register */}
      <aside className="hidden lg:flex lg:col-span-5 xl:col-span-4 flex-col bg-white border border-slate-200/90 rounded-2xl shadow-[0_4px_20px_-6px_rgba(15,23,42,0.12)] overflow-hidden lg:sticky lg:top-20 lg:h-[calc(100vh-6.5rem)]">
        <div className="px-4 py-3.5 bg-[#0B1320] text-white flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-sm font-bold text-white">Checkout Register</h2>
            <p className="text-[11px] text-slate-400 truncate">
              {activeBranchName} · {totals.itemCount} {totals.itemCount === 1 ? 'item' : 'items'}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-mono text-base font-bold text-emerald-400 tabular-nums">
              {formatBDT(totals.grandTotal, false)}
            </span>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-xs font-medium text-red-300 hover:text-red-200 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 min-h-0">{renderCheckoutBody()}</div>
      </aside>

      {/* Mobile Floating Cart Trigger (Positioned cleanly above mobile bottom tab bar) */}
      {cart.length > 0 && !mobileCartOpen && (
        <div className="lg:hidden fixed bottom-[72px] left-4 right-4 z-30">
          <button
            type="button"
            onClick={() => setMobileCartOpen(true)}
            className="w-full min-h-[48px] px-4 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl shadow-lg flex items-center justify-between gap-3 cursor-pointer"
          >
            <span className="text-sm font-semibold">
              Review Basket ({totals.itemCount} {totals.itemCount === 1 ? 'item' : 'items'})
            </span>
            <span className="font-mono text-base font-bold tabular-nums">
              {formatBDT(totals.grandTotal)}
            </span>
          </button>
        </div>
      )}

      {/* Mobile Checkout Bottom Sheet Drawer */}
      {mobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="pt-2.5 pb-1">
              <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto" />
            </div>
            <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  Checkout ({totals.itemCount} items)
                </h2>
                <p className="text-xs text-slate-500">{activeBranchName}</p>
              </div>
              <div className="flex items-center gap-3">
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-xs font-medium text-red-700"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMobileCartOpen(false)}
                  aria-label="Close checkout drawer"
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">{renderCheckoutBody()}</div>
          </div>
        </div>
      )}
    </div>
  );
};
