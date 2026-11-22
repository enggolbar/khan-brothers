import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from '../mysqlDataStore';
import { db, handleDataError, OperationType } from '../dataClient';
import {
  type Customer,
  type ExpensePaymentMethod,
  type LedgerPaymentMethod,
  type Product,
  type PurchaseItem,
  type PurchaseOrder,
  type Shift,
  type SrOrder,
  type SrOrderItem,
  type SrOrderPaymentMethod,
  type StaffRole,
  type Supplier,
  sanitizeStr,
} from '../types/pos';

function createSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const stamp = Date.now().toString(36);
  return `${prefix}_${stamp}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function mapSrMethodToLedger(method: SrOrderPaymentMethod): LedgerPaymentMethod {
  if (method === 'cash' || method === 'bkash' || method === 'nagad' || method === 'credit') {
    return method;
  }
  return 'bank';
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------
export interface SupplierInput {
  name: string;
  company: string;
  phone: string;
  address: string;
  category: string;
}

export async function upsertSupplier(
  shopId: string,
  ownerId: string,
  input: SupplierInput,
  existingId?: string
): Promise<string> {
  const supplierId = existingId || createSafeId('sup');
  const path = `shops/${shopId}/suppliers/${supplierId}`;
  const ref = doc(db, 'shops', shopId, 'suppliers', supplierId);

  const clean = {
    name: sanitizeStr(input.name, 100) || 'Supplier',
    company: sanitizeStr(input.company, 100),
    phone: sanitizeStr(input.phone, 25) || '01700-000000',
    address: sanitizeStr(input.address, 200),
    category: sanitizeStr(input.category, 50) || 'Groceries',
  };

  try {
    if (existingId) {
      await updateDoc(ref, {
        ...clean,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        shopId,
        ownerId,
        ...clean,
        totalPurchased: 0,
        balanceDue: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return supplierId;
  } catch (error) {
    handleDataError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function settleSupplierBalance(
  shopId: string,
  supplier: Supplier,
  paymentAmount: number,
  paymentMethod: LedgerPaymentMethod = 'cash',
  reference = '',
  notes = ''
): Promise<void> {
  const safePay = Number(Math.max(0, paymentAmount).toFixed(2));
  if (safePay <= 0) return;

  const path = `shops/${shopId}/suppliers/${supplier.id}`;
  const nextDue = Number(Math.max(0, supplier.balanceDue - safePay).toFixed(2));
  const batch = writeBatch(db);

  batch.update(doc(db, 'shops', shopId, 'suppliers', supplier.id), {
    balanceDue: nextDue,
    updatedAt: serverTimestamp(),
  });

  const entryId = createSafeId('led');
  batch.set(doc(db, 'shops', shopId, 'ledgerEntries', entryId), {
    shopId,
    ownerId: supplier.ownerId,
    partyType: 'supplier',
    partyId: supplier.id,
    partyName: sanitizeStr(supplier.company || supplier.name, 100),
    entryType: 'supplier_payment',
    amount: safePay,
    paymentMethod: paymentMethod === 'credit' ? 'cash' : paymentMethod,
    reference: sanitizeStr(reference || `PAY-${Date.now().toString().slice(-5)}`, 60),
    notes: sanitizeStr(notes || 'Supplier due payment', 200),
    entryDate: new Date().toISOString().slice(0, 10),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleDataError(error, OperationType.UPDATE, path);
  }
}

export async function addManualSupplierDue(
  shopId: string,
  supplier: Supplier,
  amount: number,
  reference = '',
  notes = ''
): Promise<void> {
  const safeAmt = Number(Math.max(0, amount).toFixed(2));
  if (safeAmt <= 0) return;

  const path = `shops/${shopId}/suppliers/${supplier.id}`;
  const batch = writeBatch(db);

  batch.update(doc(db, 'shops', shopId, 'suppliers', supplier.id), {
    balanceDue: Number((supplier.balanceDue + safeAmt).toFixed(2)),
    updatedAt: serverTimestamp(),
  });

  const entryId = createSafeId('led');
  batch.set(doc(db, 'shops', shopId, 'ledgerEntries', entryId), {
    shopId,
    ownerId: supplier.ownerId,
    partyType: 'supplier',
    partyId: supplier.id,
    partyName: sanitizeStr(supplier.company || supplier.name, 100),
    entryType: 'opening_due',
    amount: safeAmt,
    paymentMethod: 'credit',
    reference: sanitizeStr(reference || 'OPEN-DUE', 60),
    notes: sanitizeStr(notes || 'Opening / previous supplier due balance', 200),
    entryDate: new Date().toISOString().slice(0, 10),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleDataError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSupplier(shopId: string, supplierId: string): Promise<void> {
  const path = `shops/${shopId}/suppliers/${supplierId}`;
  try {
    await deleteDoc(doc(db, 'shops', shopId, 'suppliers', supplierId));
  } catch (error) {
    handleDataError(error, OperationType.DELETE, path);
  }
}

export async function seedBangladeshSuppliers(shopId: string, ownerId: string): Promise<void> {
  const starters: SupplierInput[] = [
    {
      name: 'Kamrul Islam',
      company: 'ACI Logistics & Consumer Distribution',
      phone: '01711-204501',
      address: 'Khatunganj & Chittagong Depot',
      category: 'Groceries',
    },
    {
      name: 'Sajjad Hossain',
      company: 'City Group Edible Oil & Flour Depot',
      phone: '01819-334910',
      address: 'Chaktai Wholesale Market, Chattogram',
      category: 'Oil & Spices',
    },
    {
      name: 'Mahfuzur Rahman',
      company: 'PRAN-RFL Dairy & Beverages Hub',
      phone: '01911-885420',
      address: 'Rangamati Regional Distribution Point',
      category: 'Beverages',
    },
  ];
  const batch = writeBatch(db);
  for (const s of starters) {
    const id = createSafeId('sup');
    batch.set(doc(db, 'shops', shopId, 'suppliers', id), {
      shopId,
      ownerId,
      ...s,
      totalPurchased: 0,
      balanceDue: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  try {
    await batch.commit();
  } catch (error) {
    handleDataError(error, OperationType.WRITE, `shops/${shopId}/suppliers`);
  }
}

// ---------------------------------------------------------------------------
// Purchase Orders (Atomic Stock Receive & Supplier Ledger Sync)
// ---------------------------------------------------------------------------
export interface CreatePurchaseInput {
  supplier: Supplier;
  branchName: string;
  items: PurchaseItem[];
  paidAmount: number;
  receiveImmediately: boolean;
  notes: string;
}

export async function createPurchaseOrder(
  shopId: string,
  ownerId: string,
  input: CreatePurchaseInput,
  productsMap: Map<string, Product>
): Promise<string> {
  const boundedItems = input.items.slice(0, 50);
  if (boundedItems.length === 0) {
    throw new Error('Purchase order requires at least one product line.');
  }

  const poId = createSafeId('po');
  const poNumber = `PO-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
  const itemCount = boundedItems.reduce((sum, i) => sum + i.qty, 0);
  const totalCost = Number(boundedItems.reduce((sum, i) => sum + i.lineTotal, 0).toFixed(2));
  const paidAmount = Number(Math.min(totalCost, Math.max(0, input.paidAmount)).toFixed(2));
  const status = input.receiveImmediately ? 'received' : 'ordered';
  const supplierLabel = sanitizeStr(input.supplier.company || input.supplier.name, 100);

  const batch = writeBatch(db);
  const poRef = doc(db, 'shops', shopId, 'purchases', poId);

  batch.set(poRef, {
    shopId,
    ownerId,
    poNumber,
    supplierId: input.supplier.id,
    supplierName: supplierLabel,
    branchName: sanitizeStr(input.branchName, 80) || 'Main Branch',
    items: boundedItems,
    itemCount,
    totalCost,
    paidAmount,
    status,
    notes: sanitizeStr(input.notes, 200),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (input.receiveImmediately) {
    for (const item of boundedItems) {
      const existing = productsMap.get(item.productId);
      if (existing) {
        const prodRef = doc(db, 'shops', shopId, 'products', existing.id);
        batch.update(prodRef, {
          stock: Math.min(10000000, Math.round(existing.stock + item.qty)),
          costPrice: Math.min(10000000, Math.max(0, item.unitCost)),
          updatedAt: serverTimestamp(),
        });
      }
    }

    const dueDelta = Math.max(0, totalCost - paidAmount);
    const supRef = doc(db, 'shops', shopId, 'suppliers', input.supplier.id);
    batch.update(supRef, {
      totalPurchased: Number((input.supplier.totalPurchased + totalCost).toFixed(2)),
      balanceDue: Number((input.supplier.balanceDue + dueDelta).toFixed(2)),
      updatedAt: serverTimestamp(),
    });

    const today = new Date().toISOString().slice(0, 10);
    if (totalCost > 0) {
      batch.set(doc(db, 'shops', shopId, 'ledgerEntries', createSafeId('led')), {
        shopId,
        ownerId,
        partyType: 'supplier',
        partyId: input.supplier.id,
        partyName: supplierLabel,
        entryType: 'purchase_due',
        amount: totalCost,
        paymentMethod: 'credit',
        reference: poNumber,
        notes: `Stock received (${itemCount} units)`,
        entryDate: today,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    if (paidAmount > 0) {
      batch.set(doc(db, 'shops', shopId, 'ledgerEntries', createSafeId('led')), {
        shopId,
        ownerId,
        partyType: 'supplier',
        partyId: input.supplier.id,
        partyName: supplierLabel,
        entryType: 'supplier_payment',
        amount: paidAmount,
        paymentMethod: 'cash',
        reference: poNumber,
        notes: `Cash paid on PO ${poNumber}`,
        entryDate: today,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  try {
    await batch.commit();
    return poId;
  } catch (error) {
    handleDataError(error, OperationType.WRITE, `shops/${shopId}/purchases/${poId}`);
  }
}

export async function receivePurchaseOrder(
  shopId: string,
  po: PurchaseOrder,
  paidAmount: number,
  productsMap: Map<string, Product>,
  supplier: Supplier | null
): Promise<void> {
  const safePaid = Number(Math.min(po.totalCost, Math.max(0, paidAmount)).toFixed(2));
  const batch = writeBatch(db);
  const poRef = doc(db, 'shops', shopId, 'purchases', po.id);

  batch.update(poRef, {
    status: 'received',
    paidAmount: safePaid,
    updatedAt: serverTimestamp(),
  });

  for (const item of po.items) {
    const existing = productsMap.get(item.productId);
    if (existing) {
      const prodRef = doc(db, 'shops', shopId, 'products', existing.id);
      batch.update(prodRef, {
        stock: Math.min(10000000, Math.round(existing.stock + item.qty)),
        costPrice: Math.min(10000000, Math.max(0, item.unitCost)),
        updatedAt: serverTimestamp(),
      });
    }
  }

  if (supplier) {
    const dueDelta = Math.max(0, po.totalCost - safePaid);
    const supRef = doc(db, 'shops', shopId, 'suppliers', supplier.id);
    batch.update(supRef, {
      totalPurchased: Number((supplier.totalPurchased + po.totalCost).toFixed(2)),
      balanceDue: Number((supplier.balanceDue + dueDelta).toFixed(2)),
      updatedAt: serverTimestamp(),
    });

    const today = new Date().toISOString().slice(0, 10);
    const supplierLabel = sanitizeStr(supplier.company || supplier.name, 100);
    if (po.totalCost > 0) {
      batch.set(doc(db, 'shops', shopId, 'ledgerEntries', createSafeId('led')), {
        shopId,
        ownerId: supplier.ownerId,
        partyType: 'supplier',
        partyId: supplier.id,
        partyName: supplierLabel,
        entryType: 'purchase_due',
        amount: po.totalCost,
        paymentMethod: 'credit',
        reference: po.poNumber,
        notes: `Received PO ${po.poNumber} (${po.itemCount} units)`,
        entryDate: today,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    if (safePaid > 0) {
      batch.set(doc(db, 'shops', shopId, 'ledgerEntries', createSafeId('led')), {
        shopId,
        ownerId: supplier.ownerId,
        partyType: 'supplier',
        partyId: supplier.id,
        partyName: supplierLabel,
        entryType: 'supplier_payment',
        amount: safePaid,
        paymentMethod: 'cash',
        reference: po.poNumber,
        notes: `Cash paid on PO ${po.poNumber}`,
        entryDate: today,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  try {
    await batch.commit();
  } catch (error) {
    handleDataError(error, OperationType.UPDATE, `shops/${shopId}/purchases/${po.id}`);
  }
}

export async function cancelPurchaseOrder(shopId: string, po: PurchaseOrder): Promise<void> {
  const path = `shops/${shopId}/purchases/${po.id}`;
  try {
    await updateDoc(doc(db, 'shops', shopId, 'purchases', po.id), {
      status: 'cancelled',
      paidAmount: po.paidAmount,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleDataError(error, OperationType.UPDATE, path);
  }
}

export async function payPurchaseOrderBalance(
  shopId: string,
  po: PurchaseOrder,
  supplier: Supplier | null
): Promise<void> {
  const remaining = Number(Math.max(0, po.totalCost - po.paidAmount).toFixed(2));
  if (remaining <= 0) return;

  const batch = writeBatch(db);
  batch.update(doc(db, 'shops', shopId, 'purchases', po.id), {
    paidAmount: po.totalCost,
    updatedAt: serverTimestamp(),
  });

  if (supplier) {
    batch.update(doc(db, 'shops', shopId, 'suppliers', supplier.id), {
      balanceDue: Number(Math.max(0, supplier.balanceDue - remaining).toFixed(2)),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'shops', shopId, 'ledgerEntries', createSafeId('led')), {
      shopId,
      ownerId: supplier.ownerId,
      partyType: 'supplier',
      partyId: supplier.id,
      partyName: sanitizeStr(supplier.company || supplier.name, 100),
      entryType: 'supplier_payment',
      amount: remaining,
      paymentMethod: 'cash',
      reference: po.poNumber,
      notes: `Settled remaining balance for ${po.poNumber}`,
      entryDate: new Date().toISOString().slice(0, 10),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleDataError(error, OperationType.UPDATE, `shops/${shopId}/purchases/${po.id}`);
  }
}

// ---------------------------------------------------------------------------
// Customer Due / Baki Ledger Operations
// ---------------------------------------------------------------------------
export async function collectCustomerDue(
  shopId: string,
  customer: Customer,
  amount: number,
  paymentMethod: LedgerPaymentMethod = 'cash',
  reference = '',
  notes = ''
): Promise<void> {
  const safePay = Number(Math.max(0, amount).toFixed(2));
  if (safePay <= 0) return;

  const path = `shops/${shopId}/customers/${customer.id}`;
  const prevDue = Number(customer.balanceDue || 0);
  const nextDue = Number(Math.max(0, prevDue - safePay).toFixed(2));
  const partyLabel = sanitizeStr(
    customer.shopName ? `${customer.shopName} (${customer.name})` : customer.name,
    100
  );

  const batch = writeBatch(db);
  batch.update(doc(db, 'shops', shopId, 'customers', customer.id), {
    balanceDue: nextDue,
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'shops', shopId, 'ledgerEntries', createSafeId('led')), {
    shopId,
    ownerId: customer.ownerId,
    partyType: 'customer',
    partyId: customer.id,
    partyName: partyLabel,
    entryType: 'customer_collection',
    amount: safePay,
    paymentMethod: paymentMethod === 'credit' ? 'cash' : paymentMethod,
    reference: sanitizeStr(reference || `COL-${Date.now().toString().slice(-5)}`, 60),
    notes: sanitizeStr(notes || 'Customer due / baki collection', 200),
    entryDate: new Date().toISOString().slice(0, 10),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleDataError(error, OperationType.UPDATE, path);
  }
}

export async function addManualCustomerDue(
  shopId: string,
  customer: Customer,
  amount: number,
  reference = '',
  notes = ''
): Promise<void> {
  const safeAmt = Number(Math.max(0, amount).toFixed(2));
  if (safeAmt <= 0) return;

  const path = `shops/${shopId}/customers/${customer.id}`;
  const prevDue = Number(customer.balanceDue || 0);
  const partyLabel = sanitizeStr(
    customer.shopName ? `${customer.shopName} (${customer.name})` : customer.name,
    100
  );

  const batch = writeBatch(db);
  batch.update(doc(db, 'shops', shopId, 'customers', customer.id), {
    balanceDue: Number((prevDue + safeAmt).toFixed(2)),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'shops', shopId, 'ledgerEntries', createSafeId('led')), {
    shopId,
    ownerId: customer.ownerId,
    partyType: 'customer',
    partyId: customer.id,
    partyName: partyLabel,
    entryType: 'opening_due',
    amount: safeAmt,
    paymentMethod: 'credit',
    reference: sanitizeStr(reference || 'OPEN-BAKI', 60),
    notes: sanitizeStr(notes || 'Opening / previous baki balance added', 200),
    entryDate: new Date().toISOString().slice(0, 10),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleDataError(error, OperationType.UPDATE, path);
  }
}

// ---------------------------------------------------------------------------
// Field SR Sales Orders & Commission Distribution
// ---------------------------------------------------------------------------
export interface CreateSrOrderInput {
  srId: string;
  srName: string;
  routeArea: string;
  customerId: string;
  customerName: string;
  retailerShopName: string;
  customerPhone: string;
  items: SrOrderItem[];
  discountAmount: number;
  paidAmount: number;
  commissionRate: number;
  paymentMethod: SrOrderPaymentMethod;
  notes: string;
}

export async function createSrOrder(
  shopId: string,
  ownerId: string,
  input: CreateSrOrderInput
): Promise<string> {
  const boundedItems = input.items.slice(0, 50);
  if (boundedItems.length === 0) {
    throw new Error('SR order requires at least one product line.');
  }

  const orderId = createSafeId('sro');
  const orderNumber = `SR-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
  const itemCount = boundedItems.reduce((sum, i) => sum + i.qty, 0);
  const subtotal = Number(boundedItems.reduce((sum, i) => sum + i.lineTotal, 0).toFixed(2));
  const discountAmount = Number(Math.min(subtotal, Math.max(0, input.discountAmount || 0)).toFixed(2));
  const totalAmount = Number(Math.max(0, subtotal - discountAmount).toFixed(2));
  const paidAmount = Number(Math.min(totalAmount, Math.max(0, input.paidAmount || 0)).toFixed(2));
  const dueAmount = Number(Math.max(0, totalAmount - paidAmount).toFixed(2));
  const commissionRate = Number(Math.min(50, Math.max(0, input.commissionRate || 0)).toFixed(2));
  const commissionAmount = Number(((totalAmount * commissionRate) / 100).toFixed(2));

  const path = `shops/${shopId}/srOrders/${orderId}`;
  try {
    await setDoc(doc(db, 'shops', shopId, 'srOrders', orderId), {
      shopId,
      ownerId,
      orderNumber,
      srId: sanitizeStr(input.srId, 128),
      srName: sanitizeStr(input.srName, 100) || 'Field SR',
      routeArea: sanitizeStr(input.routeArea, 100) || 'Mainimukh Bazar',
      customerId: sanitizeStr(input.customerId, 128),
      customerName: sanitizeStr(input.customerName, 100) || 'Retail Shop',
      retailerShopName: sanitizeStr(input.retailerShopName, 100),
      customerPhone: sanitizeStr(input.customerPhone, 25),
      items: boundedItems,
      itemCount,
      subtotal,
      discountAmount,
      totalAmount,
      paidAmount,
      dueAmount,
      commissionRate,
      commissionAmount,
      paymentMethod: input.paymentMethod,
      status: 'pending',
      notes: sanitizeStr(input.notes, 240),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return orderId;
  } catch (error) {
    handleDataError(error, OperationType.CREATE, path);
  }
}

export async function approveSrOrder(shopId: string, order: SrOrder): Promise<void> {
  const path = `shops/${shopId}/srOrders/${order.id}`;
  try {
    await updateDoc(doc(db, 'shops', shopId, 'srOrders', order.id), {
      status: 'approved',
      paidAmount: order.paidAmount,
      dueAmount: order.dueAmount,
      paymentMethod: order.paymentMethod,
      notes: order.notes,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleDataError(error, OperationType.UPDATE, path);
  }
}

export async function cancelSrOrder(shopId: string, order: SrOrder): Promise<void> {
  const path = `shops/${shopId}/srOrders/${order.id}`;
  try {
    await updateDoc(doc(db, 'shops', shopId, 'srOrders', order.id), {
      status: 'cancelled',
      paidAmount: order.paidAmount,
      dueAmount: order.dueAmount,
      paymentMethod: order.paymentMethod,
      notes: order.notes,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleDataError(error, OperationType.UPDATE, path);
  }
}

export async function deliverSrOrderBatch(
  shopId: string,
  ownerId: string,
  order: SrOrder,
  collectedAmount: number,
  paymentMethod: SrOrderPaymentMethod,
  deliveryNotes: string,
  productsMap: Map<string, Product>,
  customer: Customer | null
): Promise<void> {
  const safePaid = Number(Math.min(order.totalAmount, Math.max(0, collectedAmount || 0)).toFixed(2));
  const dueAmount = Number(Math.max(0, order.totalAmount - safePaid).toFixed(2));
  const batch = writeBatch(db);

  batch.update(doc(db, 'shops', shopId, 'srOrders', order.id), {
    status: 'delivered',
    paidAmount: safePaid,
    dueAmount,
    paymentMethod,
    notes: sanitizeStr(deliveryNotes || order.notes, 240),
    updatedAt: serverTimestamp(),
  });

  // Deduct distributed stock atomically
  for (const item of order.items) {
    const product = productsMap.get(item.productId);
    if (product) {
      batch.update(doc(db, 'shops', shopId, 'products', product.id), {
        stock: Math.max(0, Math.round(product.stock - item.qty)),
        updatedAt: serverTimestamp(),
      });
    }
  }

  // Update retailer / customer account & immutable Baki ledger
  if (customer) {
    const prevDue = Number(customer.balanceDue || 0);
    const earnedPoints = Math.floor(order.totalAmount / 100);
    batch.update(doc(db, 'shops', shopId, 'customers', customer.id), {
      loyaltyPoints: customer.loyaltyPoints + earnedPoints,
      totalSpent: Number((customer.totalSpent + order.totalAmount).toFixed(2)),
      visitCount: customer.visitCount + 1,
      balanceDue: Number((prevDue + dueAmount).toFixed(2)),
      updatedAt: serverTimestamp(),
    });

    const today = new Date().toISOString().slice(0, 10);
    const partyLabel = sanitizeStr(
      order.retailerShopName ? `${order.retailerShopName} (${order.customerName})` : order.customerName,
      100
    );

    if (order.totalAmount > 0) {
      batch.set(doc(db, 'shops', shopId, 'ledgerEntries', createSafeId('led')), {
        shopId,
        ownerId,
        partyType: 'customer',
        partyId: customer.id,
        partyName: partyLabel,
        entryType: 'sr_delivery',
        amount: order.totalAmount,
        paymentMethod: 'credit',
        reference: order.orderNumber,
        notes: `SR ${order.srName} delivery — ${order.routeArea}`,
        entryDate: today,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (safePaid > 0) {
      batch.set(doc(db, 'shops', shopId, 'ledgerEntries', createSafeId('led')), {
        shopId,
        ownerId,
        partyType: 'customer',
        partyId: customer.id,
        partyName: partyLabel,
        entryType: 'customer_collection',
        amount: safePaid,
        paymentMethod: mapSrMethodToLedger(paymentMethod),
        reference: order.orderNumber,
        notes: `Cash/MFS collected on SR delivery (${order.srName})`,
        entryDate: today,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  try {
    await batch.commit();
  } catch (error) {
    handleDataError(error, OperationType.UPDATE, `shops/${shopId}/srOrders/${order.id}`);
  }
}

export async function seedRangamatiDistributionData(
  shopId: string,
  ownerId: string,
  branchName: string
): Promise<void> {
  const batch = writeBatch(db);

  const sampleSrs = [
    {
      name: 'Md. Rafiqul Islam',
      phone: '01815-412090',
      routeArea: 'Mainimukh Bazar & Dongudu',
      commissionRate: 2.5,
      monthlySalary: 14000,
      pinCode: '1101',
    },
    {
      name: 'Sujon Chakma',
      phone: '01718-654210',
      routeArea: 'Baghaichhari & Marishya Bazar',
      commissionRate: 3.0,
      monthlySalary: 15000,
      pinCode: '1102',
    },
    {
      name: 'Tanvir Ahmed',
      phone: '01914-882340',
      routeArea: 'Rangamati Sadar & Naniarchar',
      commissionRate: 2.5,
      monthlySalary: 14500,
      pinCode: '1103',
    },
  ];

  for (const sr of sampleSrs) {
    batch.set(doc(db, 'shops', shopId, 'staff', createSafeId('stf')), {
      shopId,
      ownerId,
      name: sr.name,
      phone: sr.phone,
      role: 'sr',
      branchName: sanitizeStr(branchName, 80) || 'Mainimukh Bazar',
      routeArea: sr.routeArea,
      commissionRate: sr.commissionRate,
      monthlySalary: sr.monthlySalary,
      pinCode: sr.pinCode,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const sampleRetailers = [
    {
      name: 'Haji Abdul Karim',
      shopName: 'Bismillah General Store',
      marketArea: 'Mainimukh Bazar',
      phone: '01812-304115',
      address: 'Station Road, Mainimukh Bazar, Rangamati',
      creditLimit: 50000,
    },
    {
      name: 'Ripon Tripura',
      shopName: 'Hill View Traders',
      marketArea: 'Dongudu & Langadu',
      phone: '01714-908221',
      address: 'Dongudu Bazar, Langadu, Rangamati',
      creditLimit: 35000,
    },
    {
      name: 'Nizam Uddin',
      shopName: 'Madina Variety & Grocery',
      marketArea: 'Marishya Bazar',
      phone: '01829-554120',
      address: 'Main Market, Baghaichhari, Rangamati',
      creditLimit: 40000,
    },
  ];

  for (const r of sampleRetailers) {
    batch.set(doc(db, 'shops', shopId, 'customers', createSafeId('cus')), {
      shopId,
      ownerId,
      name: r.name,
      shopName: r.shopName,
      marketArea: r.marketArea,
      customerType: 'wholesale',
      phone: r.phone,
      address: r.address,
      loyaltyPoints: 0,
      totalSpent: 0,
      visitCount: 0,
      balanceDue: 0,
      creditLimit: r.creditLimit,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleDataError(error, OperationType.WRITE, `shops/${shopId}/staff`);
  }
}

// ---------------------------------------------------------------------------
// Operating Expenses & Cashbook
// ---------------------------------------------------------------------------
export interface ExpenseInput {
  title: string;
  category: string;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  branchName: string;
  reference: string;
  notes: string;
  expenseDate: string;
}

export async function upsertExpense(
  shopId: string,
  ownerId: string,
  input: ExpenseInput,
  existingId?: string
): Promise<string> {
  const expenseId = existingId || createSafeId('exp');
  const path = `shops/${shopId}/expenses/${expenseId}`;
  const ref = doc(db, 'shops', shopId, 'expenses', expenseId);

  const clean = {
    title: sanitizeStr(input.title, 120) || 'Operating Expense',
    category: sanitizeStr(input.category, 50) || 'Other Operating',
    amount: Number(Math.min(100000000, Math.max(0.01, Number(input.amount) || 0)).toFixed(2)),
    paymentMethod: input.paymentMethod,
    branchName: sanitizeStr(input.branchName, 80) || 'Main Branch',
    reference: sanitizeStr(input.reference, 60),
    notes: sanitizeStr(input.notes, 200),
    expenseDate: sanitizeStr(input.expenseDate, 20) || new Date().toISOString().slice(0, 10),
  };

  try {
    if (existingId) {
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
    return expenseId;
  } catch (error) {
    handleDataError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteExpense(shopId: string, expenseId: string): Promise<void> {
  const path = `shops/${shopId}/expenses/${expenseId}`;
  try {
    await deleteDoc(doc(db, 'shops', shopId, 'expenses', expenseId));
  } catch (error) {
    handleDataError(error, OperationType.DELETE, path);
  }
}

// ---------------------------------------------------------------------------
// Cash Register Shifts (Open / Close X-Z Report)
// ---------------------------------------------------------------------------
export async function openCashShift(
  shopId: string,
  ownerId: string,
  branchName: string,
  cashierName: string,
  openingCash: number,
  notes: string
): Promise<string> {
  const shiftId = createSafeId('shf');
  const path = `shops/${shopId}/shifts/${shiftId}`;
  const safeOpen = Number(Math.max(0, openingCash).toFixed(2));

  try {
    await setDoc(doc(db, 'shops', shopId, 'shifts', shiftId), {
      shopId,
      ownerId,
      branchName: sanitizeStr(branchName, 80) || 'Main Branch',
      cashierName: sanitizeStr(cashierName, 80) || 'Cashier',
      openingCash: safeOpen,
      cashSalesTotal: 0,
      mfsCardSalesTotal: 0,
      cashExpensesTotal: 0,
      expectedCash: safeOpen,
      countedCash: 0,
      variance: 0,
      status: 'open',
      notes: sanitizeStr(notes, 200),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return shiftId;
  } catch (error) {
    handleDataError(error, OperationType.CREATE, path);
  }
}

export interface CloseShiftSummary {
  cashSalesTotal: number;
  mfsCardSalesTotal: number;
  cashExpensesTotal: number;
  countedCash: number;
  notes: string;
}

export async function closeCashShift(
  shopId: string,
  shift: Shift,
  summary: CloseShiftSummary
): Promise<void> {
  const path = `shops/${shopId}/shifts/${shift.id}`;
  const cashSalesTotal = Number(Math.max(0, summary.cashSalesTotal).toFixed(2));
  const mfsCardSalesTotal = Number(Math.max(0, summary.mfsCardSalesTotal).toFixed(2));
  const cashExpensesTotal = Number(Math.max(0, summary.cashExpensesTotal).toFixed(2));
  const expectedCash = Number(
    (shift.openingCash + cashSalesTotal - cashExpensesTotal).toFixed(2)
  );
  const countedCash = Number(Math.max(0, summary.countedCash).toFixed(2));
  const variance = Number((countedCash - expectedCash).toFixed(2));

  try {
    await updateDoc(doc(db, 'shops', shopId, 'shifts', shift.id), {
      cashSalesTotal,
      mfsCardSalesTotal,
      cashExpensesTotal,
      expectedCash,
      countedCash,
      variance,
      status: 'closed',
      notes: sanitizeStr(summary.notes, 200),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleDataError(error, OperationType.UPDATE, path);
  }
}

// ---------------------------------------------------------------------------
// Staff, Roles & Field SRs
// ---------------------------------------------------------------------------
export interface StaffInput {
  name: string;
  phone: string;
  role: StaffRole;
  branchName: string;
  routeArea?: string;
  commissionRate?: number;
  monthlySalary: number;
  isActive: boolean;
}

export async function upsertStaffMember(
  shopId: string,
  ownerId: string,
  input: StaffInput,
  existingId?: string
): Promise<string> {
  const staffId = existingId || createSafeId('stf');
  const path = `shops/${shopId}/staff/${staffId}`;
  const ref = doc(db, 'shops', shopId, 'staff', staffId);

  const clean = {
    name: sanitizeStr(input.name, 100) || 'Staff Member',
    phone: sanitizeStr(input.phone, 25) || '01700-000000',
    role: input.role,
    branchName: sanitizeStr(input.branchName, 80) || 'Main Branch',
    routeArea: sanitizeStr(input.routeArea || '', 100),
    commissionRate: Number(Math.min(50, Math.max(0, Number(input.commissionRate) || 0)).toFixed(2)),
    monthlySalary: Number(Math.min(10000000, Math.max(0, Number(input.monthlySalary) || 0)).toFixed(2)),
    isActive: Boolean(input.isActive),
  };

  try {
    if (existingId) {
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
    return staffId;
  } catch (error) {
    handleDataError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteStaffMember(shopId: string, staffId: string): Promise<void> {
  const path = `shops/${shopId}/staff/${staffId}`;
  try {
    await deleteDoc(doc(db, 'shops', shopId, 'staff', staffId));
  } catch (error) {
    handleDataError(error, OperationType.DELETE, path);
  }
}
