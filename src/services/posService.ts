import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  BD_STARTER_CATALOG,
  type Branch,
  type CartItem,
  type Customer,
  type CustomerType,
  type LedgerPaymentMethod,
  type PaymentMethod,
  type PlanId,
  type Product,
  type Sale,
  type SaleItem,
  type Shop,
  sanitizeStr,
} from '../types/pos';

function mapPaymentToLedgerMethod(method: PaymentMethod): LedgerPaymentMethod {
  if (method === 'cash' || method === 'bkash' || method === 'nagad' || method === 'credit') {
    return method;
  }
  return 'bank';
}

function createSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const stamp = Date.now().toString(36);
  return `${prefix}_${stamp}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function formatInvoiceNumber(counter: number): string {
  const year = new Date().getFullYear();
  return `BG-${year}-${String(counter).padStart(5, '0')}`;
}

export async function createDefaultShop(user: User, customName?: string): Promise<string> {
  const shopId = createSafeId('shop');
  const branchId = createSafeId('br');
  const shopName = sanitizeStr(customName || 'M/S Khan Brothers', 100) || 'M/S Khan Brothers';

  const shopRef = doc(db, 'shops', shopId);
  const branchRef = doc(db, 'shops', shopId, 'branches', branchId);

  try {
    // Create parent shop first so subcollection rules can verify parent existence
    await setDoc(shopRef, {
      ownerId: user.uid,
      name: shopName,
      branchName: 'Mainimukh Bazar — Supermarket & Distribution',
      address: 'Mainimukh Bazar, Dongudu, Rangamati',
      phone: '01700-000000',
      binNumber: '004829104-0203',
      defaultVatRate: 5,
      receiptFooter: 'M/S Khan Brothers — Supermarket & Distributorship, Mainimukh Bazar, Rangamati.',
      plan: 'growth' as PlanId,
      currency: 'BDT',
      invoiceCounter: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(branchRef, {
      shopId,
      ownerId: user.uid,
      name: 'Mainimukh Bazar — Supermarket & Distribution',
      code: 'RNG-01',
      address: 'Mainimukh Bazar, Dongudu, Rangamati',
      phone: '01700-000000',
      managerName: sanitizeStr(user.displayName || 'Proprietor', 80),
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return shopId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `shops/${shopId}`);
  }
}

export async function seedStarterCatalog(shopId: string, ownerId: string): Promise<number> {
  const batch = writeBatch(db);
  const path = `shops/${shopId}/products`;

  for (const item of BD_STARTER_CATALOG) {
    const prodId = createSafeId('prd');
    const ref = doc(db, 'shops', shopId, 'products', prodId);
    batch.set(ref, {
      shopId,
      ownerId,
      name: sanitizeStr(item.name, 120),
      barcode: sanitizeStr(item.barcode, 48),
      sku: sanitizeStr(item.sku, 40),
      category: sanitizeStr(item.category, 50),
      unit: sanitizeStr(item.unit, 20),
      costPrice: Math.max(0, Number(item.costPrice) || 0),
      sellingPrice: Math.max(0, Number(item.sellingPrice) || 0),
      vatRate: Math.min(30, Math.max(0, Number(item.vatRate) || 0)),
      stock: Math.max(0, Number(item.stock) || 0),
      reorderLevel: Math.max(0, Number(item.reorderLevel) || 0),
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    return BD_STARTER_CATALOG.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface ProductInput {
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
  isActive: boolean;
}

export async function upsertProduct(
  shopId: string,
  ownerId: string,
  input: ProductInput,
  existingProductId?: string
): Promise<string> {
  const productId = existingProductId || createSafeId('prd');
  const ref = doc(db, 'shops', shopId, 'products', productId);
  const path = `shops/${shopId}/products/${productId}`;

  const clean = {
    name: sanitizeStr(input.name, 120) || 'Unnamed Item',
    barcode: sanitizeStr(input.barcode, 48) || `894${Date.now().toString().slice(-10)}`,
    sku: sanitizeStr(input.sku, 40) || `SKU-${Date.now().toString(36).toUpperCase()}`,
    category: sanitizeStr(input.category, 50) || 'Groceries',
    unit: sanitizeStr(input.unit, 20) || 'pcs',
    costPrice: Math.min(10000000, Math.max(0, Number(input.costPrice) || 0)),
    sellingPrice: Math.min(10000000, Math.max(0, Number(input.sellingPrice) || 0)),
    vatRate: Math.min(30, Math.max(0, Number(input.vatRate) || 0)),
    stock: Math.min(10000000, Math.max(0, Number(input.stock) || 0)),
    reorderLevel: Math.min(1000000, Math.max(0, Number(input.reorderLevel) || 0)),
    isActive: Boolean(input.isActive),
  };

  try {
    if (existingProductId) {
      await updateDoc(ref, {
        ...clean,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        shopId,
        ownerId,
        ...clean,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return productId;
  } catch (error) {
    handleFirestoreError(error, existingProductId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function adjustProductStock(
  shopId: string,
  productId: string,
  nextStock: number
): Promise<void> {
  const path = `shops/${shopId}/products/${productId}`;
  try {
    await updateDoc(doc(db, 'shops', shopId, 'products', productId), {
      stock: Math.min(10000000, Math.max(0, Math.round(nextStock))),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteProduct(shopId: string, productId: string): Promise<void> {
  const path = `shops/${shopId}/products/${productId}`;
  try {
    await deleteDoc(doc(db, 'shops', shopId, 'products', productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface CheckoutPayload {
  cashierName: string;
  branchName: string;
  customer: Customer | null;
  discountAmount: number;
  paymentMethod: PaymentMethod;
  paymentRef: string;
  paidAmount: number;
  status: 'completed' | 'held';
}

export async function createSaleTransaction(
  shop: Shop,
  cartItems: CartItem[],
  payload: CheckoutPayload
): Promise<Sale> {
  const boundedCart = cartItems.slice(0, 50);
  if (boundedCart.length === 0) {
    throw new Error('Cannot process an empty cart.');
  }

  const saleItems: SaleItem[] = boundedCart.map(({ product, qty }) => {
    const safeQty = Math.max(1, Math.round(qty));
    const lineTotal = Number((product.sellingPrice * safeQty).toFixed(2));
    return {
      productId: product.id,
      name: sanitizeStr(product.name, 120),
      barcode: sanitizeStr(product.barcode, 48),
      unit: sanitizeStr(product.unit, 20),
      qty: safeQty,
      unitPrice: product.sellingPrice,
      costPrice: product.costPrice,
      vatRate: product.vatRate,
      lineTotal,
    };
  });

  const itemCount = saleItems.reduce((sum, i) => sum + i.qty, 0);
  const subtotal = Number(saleItems.reduce((sum, i) => sum + i.lineTotal, 0).toFixed(2));
  const discountAmount = Number(Math.min(subtotal, Math.max(0, payload.discountAmount)).toFixed(2));
  const taxableRatio = subtotal > 0 ? (subtotal - discountAmount) / subtotal : 0;
  const vatAmount = Number(
    saleItems
      .reduce((sum, i) => sum + i.lineTotal * taxableRatio * (i.vatRate / 100), 0)
      .toFixed(2)
  );
  const totalAmount = Number((subtotal - discountAmount + vatAmount).toFixed(2));
  const rawPaid = Number(Math.max(0, Number.isFinite(payload.paidAmount) ? payload.paidAmount : 0).toFixed(2));
  const allowsCredit = Boolean(payload.customer);

  const paidAmount =
    payload.status === 'held'
      ? 0
      : allowsCredit
        ? payload.paymentMethod === 'credit'
          ? Math.min(totalAmount, rawPaid)
          : rawPaid > 0
            ? rawPaid
            : totalAmount
        : Number(Math.max(totalAmount, rawPaid || totalAmount).toFixed(2));

  const dueAmount =
    payload.status === 'held'
      ? 0
      : allowsCredit
        ? Number(Math.max(0, totalAmount - paidAmount).toFixed(2))
        : 0;

  const changeAmount =
    payload.status === 'held' ? 0 : Number(Math.max(0, paidAmount - totalAmount).toFixed(2));

  const nextCounter = shop.invoiceCounter + 1;
  const invoiceNumber = formatInvoiceNumber(nextCounter);
  const saleId = createSafeId('inv');

  const batch = writeBatch(db);
  const saleRef = doc(db, 'shops', shop.id, 'sales', saleId);
  const shopRef = doc(db, 'shops', shop.id);

  const saleDocData = {
    shopId: shop.id,
    ownerId: shop.ownerId,
    invoiceNumber,
    cashierName: sanitizeStr(payload.cashierName, 80) || 'Cashier',
    branchName: sanitizeStr(payload.branchName || shop.branchName, 80) || 'Main Branch',
    customerId: payload.customer ? payload.customer.id : '',
    customerName: payload.customer ? sanitizeStr(payload.customer.name, 100) : 'Walk-in Customer',
    customerPhone: payload.customer ? sanitizeStr(payload.customer.phone, 25) : '',
    items: saleItems,
    itemCount,
    subtotal,
    discountAmount,
    vatAmount,
    totalAmount,
    paidAmount,
    changeAmount,
    dueAmount,
    paymentMethod: payload.paymentMethod,
    paymentRef: sanitizeStr(payload.paymentRef, 60),
    status: payload.status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  batch.set(saleRef, saleDocData);
  batch.update(shopRef, {
    invoiceCounter: nextCounter,
    updatedAt: serverTimestamp(),
  });

  if (payload.status === 'completed') {
    for (const { product, qty } of boundedCart) {
      const nextStock = Math.max(0, Math.round(product.stock - qty));
      const prodRef = doc(db, 'shops', shop.id, 'products', product.id);
      batch.update(prodRef, {
        stock: nextStock,
        updatedAt: serverTimestamp(),
      });
    }

    if (payload.customer) {
      const earnedPoints = Math.floor(totalAmount / 100);
      const prevDue = Number(payload.customer.balanceDue || 0);
      const custRef = doc(db, 'shops', shop.id, 'customers', payload.customer.id);
      batch.update(custRef, {
        loyaltyPoints: payload.customer.loyaltyPoints + earnedPoints,
        totalSpent: Number((payload.customer.totalSpent + totalAmount).toFixed(2)),
        visitCount: payload.customer.visitCount + 1,
        balanceDue: Number((prevDue + dueAmount).toFixed(2)),
        updatedAt: serverTimestamp(),
      });

      if (dueAmount > 0) {
        const today = new Date().toISOString().slice(0, 10);
        const partyLabel = sanitizeStr(
          payload.customer.shopName
            ? `${payload.customer.shopName} (${payload.customer.name})`
            : payload.customer.name,
          100
        );
        const debitEntryId = createSafeId('led');
        batch.set(doc(db, 'shops', shop.id, 'ledgerEntries', debitEntryId), {
          shopId: shop.id,
          ownerId: shop.ownerId,
          partyType: 'customer',
          partyId: payload.customer.id,
          partyName: partyLabel,
          entryType: 'credit_sale',
          amount: totalAmount,
          paymentMethod: 'credit',
          reference: invoiceNumber,
          notes: `POS credit bill (${itemCount} items)`,
          entryDate: today,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const cashPortion = Number(Math.min(totalAmount, paidAmount).toFixed(2));
        if (cashPortion > 0) {
          const creditEntryId = createSafeId('led');
          batch.set(doc(db, 'shops', shop.id, 'ledgerEntries', creditEntryId), {
            shopId: shop.id,
            ownerId: shop.ownerId,
            partyType: 'customer',
            partyId: payload.customer.id,
            partyName: partyLabel,
            entryType: 'customer_collection',
            amount: cashPortion,
            paymentMethod: mapPaymentToLedgerMethod(payload.paymentMethod),
            reference: sanitizeStr(payload.paymentRef || invoiceNumber, 60),
            notes: `Partial payment on POS bill ${invoiceNumber}`,
            entryDate: today,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
    }
  }

  try {
    await batch.commit();
    return {
      ...saleDocData,
      id: saleId,
      createdAt: null,
      updatedAt: null,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `shops/${shop.id}/sales/${saleId}`);
  }
}

export async function completeHeldSale(
  shopId: string,
  sale: Sale,
  productsMap: Map<string, Product>,
  paymentMethod: PaymentMethod,
  paymentRef: string,
  paidAmount: number
): Promise<void> {
  const batch = writeBatch(db);
  const saleRef = doc(db, 'shops', shopId, 'sales', sale.id);
  const safePaid = Number(Math.max(sale.totalAmount, paidAmount || sale.totalAmount).toFixed(2));
  const changeAmount = Number(Math.max(0, safePaid - sale.totalAmount).toFixed(2));

  batch.update(saleRef, {
    status: 'completed',
    paymentMethod,
    paymentRef: sanitizeStr(paymentRef, 60),
    paidAmount: safePaid,
    changeAmount,
    updatedAt: serverTimestamp(),
  });

  for (const item of sale.items) {
    const product = productsMap.get(item.productId);
    if (product) {
      const prodRef = doc(db, 'shops', shopId, 'products', product.id);
      batch.update(prodRef, {
        stock: Math.max(0, Math.round(product.stock - item.qty)),
        updatedAt: serverTimestamp(),
      });
    }
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `shops/${shopId}/sales/${sale.id}`);
  }
}

export async function voidHeldSale(shopId: string, saleId: string): Promise<void> {
  const path = `shops/${shopId}/sales/${saleId}`;
  try {
    await updateDoc(doc(db, 'shops', shopId, 'sales', saleId), {
      status: 'voided',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function refundSaleAndRestock(
  shopId: string,
  sale: Sale,
  productsMap: Map<string, Product>
): Promise<void> {
  const batch = writeBatch(db);
  const saleRef = doc(db, 'shops', shopId, 'sales', sale.id);

  batch.update(saleRef, {
    status: 'refunded',
    updatedAt: serverTimestamp(),
  });

  for (const item of sale.items) {
    const product = productsMap.get(item.productId);
    if (product) {
      const prodRef = doc(db, 'shops', shopId, 'products', product.id);
      batch.update(prodRef, {
        stock: Math.min(10000000, Math.round(product.stock + item.qty)),
        updatedAt: serverTimestamp(),
      });
    }
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `shops/${shopId}/sales/${sale.id}`);
  }
}

export interface CustomerInput {
  name: string;
  shopName?: string;
  marketArea?: string;
  customerType?: CustomerType;
  phone: string;
  address: string;
  creditLimit?: number;
}

export async function upsertCustomer(
  shopId: string,
  ownerId: string,
  input: CustomerInput,
  existingCustomerId?: string
): Promise<string> {
  const customerId = existingCustomerId || createSafeId('cus');
  const path = `shops/${shopId}/customers/${customerId}`;
  const ref = doc(db, 'shops', shopId, 'customers', customerId);

  const clean = {
    name: sanitizeStr(input.name, 100) || 'Customer',
    shopName: sanitizeStr(input.shopName || '', 100),
    marketArea: sanitizeStr(input.marketArea || '', 100),
    customerType: (input.customerType || 'retail') as CustomerType,
    phone: sanitizeStr(input.phone, 25) || '01700-000000',
    address: sanitizeStr(input.address, 200),
    creditLimit: Number(Math.max(0, Number(input.creditLimit) || 0).toFixed(2)),
  };

  try {
    if (existingCustomerId) {
      await updateDoc(ref, {
        ...clean,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        shopId,
        ownerId,
        ...clean,
        loyaltyPoints: 0,
        totalSpent: 0,
        visitCount: 0,
        balanceDue: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return customerId;
  } catch (error) {
    handleFirestoreError(error, existingCustomerId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteCustomer(shopId: string, customerId: string): Promise<void> {
  const path = `shops/${shopId}/customers/${customerId}`;
  try {
    await deleteDoc(doc(db, 'shops', shopId, 'customers', customerId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface ShopProfileInput {
  name: string;
  branchName: string;
  address: string;
  phone: string;
  binNumber: string;
  defaultVatRate: number;
  receiptFooter: string;
}

export async function updateShopProfile(shopId: string, input: ShopProfileInput): Promise<void> {
  const path = `shops/${shopId}`;
  try {
    await updateDoc(doc(db, 'shops', shopId), {
      name: sanitizeStr(input.name, 100) || 'Smart Super Shop',
      branchName: sanitizeStr(input.branchName, 80) || 'Main Branch',
      address: sanitizeStr(input.address, 240),
      phone: sanitizeStr(input.phone, 25),
      binNumber: sanitizeStr(input.binNumber, 40),
      defaultVatRate: Math.min(30, Math.max(0, Number(input.defaultVatRate) || 0)),
      receiptFooter: sanitizeStr(input.receiptFooter, 200),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateShopPlan(shopId: string, plan: PlanId): Promise<void> {
  const path = `shops/${shopId}`;
  try {
    await updateDoc(doc(db, 'shops', shopId), {
      plan,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export interface BranchInput {
  name: string;
  code: string;
  address: string;
  phone: string;
  managerName: string;
  isActive: boolean;
}

export async function upsertBranch(
  shopId: string,
  ownerId: string,
  input: BranchInput,
  existingBranchId?: string
): Promise<string> {
  const branchId = existingBranchId || createSafeId('br');
  const path = `shops/${shopId}/branches/${branchId}`;
  const ref = doc(db, 'shops', shopId, 'branches', branchId);

  const clean = {
    name: sanitizeStr(input.name, 80) || 'Branch',
    code: sanitizeStr(input.code, 20).toUpperCase() || 'BR-01',
    address: sanitizeStr(input.address, 200),
    phone: sanitizeStr(input.phone, 25),
    managerName: sanitizeStr(input.managerName, 80),
    isActive: Boolean(input.isActive),
  };

  try {
    if (existingBranchId) {
      await updateDoc(ref, {
        ...clean,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        shopId,
        ownerId,
        ...clean,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return branchId;
  } catch (error) {
    handleFirestoreError(error, existingBranchId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteBranch(shopId: string, branchId: string): Promise<void> {
  const path = `shops/${shopId}/branches/${branchId}`;
  try {
    await deleteDoc(doc(db, 'shops', shopId, 'branches', branchId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function exportSalesToCsv(sales: Sale[], shopName: string): void {
  const headers = [
    'Invoice Number',
    'Date (BD)',
    'Branch',
    'Cashier',
    'Customer',
    'Customer Phone',
    'Items',
    'Subtotal (BDT)',
    'Discount (BDT)',
    'VAT (BDT)',
    'Total (BDT)',
    'Payment Method',
    'Reference / TrxID',
    'Status',
  ];

  const rows = sales.map((s) => {
    const dt = s.createdAt ? s.createdAt.toDate().toISOString() : '';
    return [
      s.invoiceNumber,
      dt,
      s.branchName,
      s.cashierName,
      s.customerName,
      s.customerPhone,
      String(s.itemCount),
      s.subtotal.toFixed(2),
      s.discountAmount.toFixed(2),
      s.vatAmount.toFixed(2),
      s.totalAmount.toFixed(2),
      s.paymentMethod,
      s.paymentRef,
      s.status,
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-sales-ledger.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
