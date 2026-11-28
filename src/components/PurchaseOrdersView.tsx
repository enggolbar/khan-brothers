import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Printer,
  Plus,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import {
  type Product,
  type PurchaseItem,
  type PurchaseOrder,
  type Shop,
  type Supplier,
  formatBDT,
  formatDateTimeBD,
} from '../types/pos';
import {
  cancelPurchaseOrder,
  createPurchaseOrder,
  payPurchaseOrderBalance,
  receivePurchaseOrder,
} from '../services/operationsService';

interface PurchaseOrdersViewProps {
  shop: Shop;
  activeBranchName: string;
  products: Product[];
  suppliers: Supplier[];
  purchases: PurchaseOrder[];
  onNavigateSuppliers: () => void;
}

export const PurchaseOrdersView: React.FC<PurchaseOrdersViewProps> = ({
  shop,
  activeBranchName,
  products,
  suppliers,
  purchases,
  onNavigateSuppliers,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [lineQty, setLineQty] = useState('20');
  const [lineCost, setLineCost] = useState('');
  const [poItems, setPoItems] = useState<PurchaseItem[]>([]);
  const [notes, setNotes] = useState('');
  const [receivingPo, setReceivingPo] = useState<PurchaseOrder | null>(null);
  const [receiveInputs, setReceiveInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const productsMap = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const suppliersMap = useMemo(() => {
    const m = new Map<string, Supplier>();
    for (const s of suppliers) m.set(s.id, s);
    return m;
  }, [suppliers]);

  const poTotal = useMemo(
    () => Number(poItems.reduce((sum, i) => sum + i.lineTotal, 0).toFixed(2)),
    [poItems]
  );

  const stats = useMemo(() => {
    let receivedValue = 0;
    let openCount = 0;
    let unpaidTotal = 0;
    for (const po of purchases) {
      if (po.status === 'ordered' || po.status === 'partially_received') openCount++;
      receivedValue += po.receivedCost ?? (po.status === 'received' ? po.totalCost : 0);
      unpaidTotal += Math.max(0, (po.receivedCost ?? (po.status === 'received' ? po.totalCost : 0)) - po.paidAmount);
    }
    return { receivedValue, openCount, unpaidTotal };
  }, [purchases]);

  const handleProductPick = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = productsMap.get(prodId);
    if (prod) setLineCost(String(prod.costPrice));
  };

  const handleAddLine = () => {
    const prod = productsMap.get(selectedProductId);
    const qty = Math.max(1, Math.round(Number(lineQty) || 0));
    const unitCost = Math.max(0, Number(lineCost) || 0);
    if (!prod) return;

    setPoItems((prev) => {
      const idx = prev.findIndex((i) => i.productId === prod.id);
      if (idx >= 0) {
        const next = [...prev];
        const nextQty = next[idx].qty + qty;
        next[idx] = {
          ...next[idx],
          qty: nextQty,
          unitCost,
          lineTotal: Number((nextQty * unitCost).toFixed(2)),
        };
        return next;
      }
      return [
        ...prev,
        {
          productId: prod.id,
          name: prod.name,
          sku: prod.sku,
          unit: prod.unit,
          qty,
          unitCost,
          lineTotal: Number((qty * unitCost).toFixed(2)),
        },
      ];
    });
    setSelectedProductId('');
    setLineQty('20');
    setLineCost('');
  };

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    const supplier = suppliersMap.get(supplierId);
    if (!supplier || poItems.length === 0 || saving) return;

    setSaving(true);
    try {
      await createPurchaseOrder(
        shop.id,
        shop.ownerId,
        {
          supplier,
          branchName: activeBranchName,
          items: poItems,
          notes,
        }
      );
      setModalOpen(false);
      setPoItems([]);
      setNotes('');
    } finally {
      setSaving(false);
    }
  };

  const handleReceive = async (po: PurchaseOrder) => {
    const quantities = Object.fromEntries(po.items.map((item) => [item.productId, Number(receiveInputs[item.productId]) || 0]));
    setBusyId(po.id);
    try {
      await receivePurchaseOrder(
        shop.id,
        po,
        quantities,
        productsMap,
        suppliersMap.get(po.supplierId) || null
      );
      setReceivingPo(null);
      setReceiveInputs({});
    } finally {
      setBusyId(null);
    }
  };

  const handlePayFull = async (po: PurchaseOrder) => {
    setBusyId(po.id);
    try {
      await payPurchaseOrderBalance(shop.id, po, suppliersMap.get(po.supplierId) || null);
    } finally {
      setBusyId(null);
    }
  };

  const openReceiveModal = (po: PurchaseOrder) => {
    setReceivingPo(po);
    setReceiveInputs(Object.fromEntries(po.items.map((item) => [item.productId, '0'])));
  };

  const handlePrintBill = (po: PurchaseOrder) => {
    const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
    const money = (value: number) => formatBDT(value).replace(/^à§³\s*/, 'à§³ ');
    const rows = po.items
      .filter((item) => (item.receivedQty || 0) > 0 || po.status === 'received')
      .map((item, index) => {
        const receivedQty = item.receivedQty ?? (po.status === 'received' ? item.qty : 0);
        const amount = Number((receivedQty * item.unitCost).toFixed(2));
        return `<tr><td>${index + 1}</td><td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.sku)}</small></td><td class="num">${item.qty} ${escapeHtml(item.unit)}</td><td class="num">${receivedQty} ${escapeHtml(item.unit)}</td><td class="num">${money(item.unitCost)}</td><td class="num">${money(amount)}</td></tr>`;
      }).join('');
    const billTotal = po.receivedCost ?? (po.status === 'received' ? po.totalCost : 0);
    const due = Math.max(0, billTotal - po.paidAmount);
    const supplier = suppliersMap.get(po.supplierId);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Purchase Bill ${escapeHtml(po.poNumber)}</title><style>
      @page{size:A4;margin:16mm}*{box-sizing:border-box}body{margin:0;color:#172033;font:12px Arial,sans-serif}.sheet{max-width:190mm;margin:auto}.head{display:flex;justify-content:space-between;border-bottom:2px solid #143c8c;padding-bottom:14px}.brand{display:flex;align-items:center;gap:12px}.brand img{width:64px;height:64px;object-fit:contain}.head h1{font-size:21px;color:#143c8c;margin:0 0 5px}.muted{color:#64748b;line-height:1.6}.title{text-align:right}.title h2{font-size:23px;margin:0 0 6px;text-transform:uppercase}.meta{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:18px 0}.box{border:1px solid #dbe3ef;border-radius:6px;background:#f8fafc;padding:11px;line-height:1.7}.box h3{font-size:10px;color:#2563eb;margin:0 0 5px;text-transform:uppercase}table{width:100%;border-collapse:collapse;margin-top:18px}th{background:#111a30;color:white;text-align:left;padding:9px 7px;font-size:10px}td{padding:9px 7px;border-bottom:1px solid #dbe3ef}td small{display:block;color:#64748b;margin-top:3px}.num{text-align:right;font-variant-numeric:tabular-nums}.totals{width:280px;margin:18px 0 0 auto}.totals div{display:flex;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #e2e8f0}.totals .grand{font-size:15px;font-weight:bold;background:#111a30;color:white}.sign{display:flex;justify-content:space-between;margin:65px 18px 0}.sign span{width:190px;border-top:1px solid #64748b;text-align:center;padding-top:7px}.foot{margin-top:32px;padding-top:9px;border-top:1px solid #dbe3ef;text-align:center;color:#64748b;font-size:10px}
    </style></head><body><main class="sheet"><header class="head"><div class="brand"><img src="${window.location.origin}/assets/aistudio/M_S_Khan_Brothers_Gold-Blue_Badge_cceec1db.png" alt="${escapeHtml(shop.name)} logo"><div><h1>${escapeHtml(shop.name)}</h1><div class="muted">${escapeHtml(po.branchName || shop.branchName)}${shop.address ? `<br>${escapeHtml(shop.address)}` : ''}${shop.phone ? `<br>Tel: ${escapeHtml(shop.phone)}` : ''}</div></div></div><div class="title"><h2>Purchase Bill</h2><strong>${escapeHtml(po.poNumber)}</strong><div class="muted">${escapeHtml(formatDateTimeBD(po.createdAt))}</div></div></header><section class="meta"><div class="box"><h3>Supplier</h3><strong>${escapeHtml(po.supplierName)}</strong>${supplier?.phone ? `<br>${escapeHtml(supplier.phone)}` : ''}</div><div class="box"><h3>Delivery & payment</h3><div>Branch: ${escapeHtml(po.branchName)}</div><div>Received: ${po.receivedItemCount ?? po.items.reduce((sum, item) => sum + (item.receivedQty || 0), 0)} of ${po.itemCount} units</div><div>Status: ${due > 0 ? 'Unpaid' : 'Paid'}</div></div></section><table><thead><tr><th>#</th><th>Product</th><th class="num">Ordered</th><th class="num">Received</th><th class="num">Unit cost</th><th class="num">Amount</th></tr></thead><tbody>${rows}</tbody></table><section class="totals"><div class="grand"><span>Received Bill Total</span><strong>${money(billTotal)}</strong></div><div><span>Paid</span><strong>${money(po.paidAmount)}</strong></div><div><span>Balance Due</span><strong>${money(due)}</strong></div></section>${po.notes ? `<p class="muted">Note: ${escapeHtml(po.notes)}</p>` : ''}<section class="sign"><span>Authorized Signature</span><span>Supplier Signature</span></section><footer class="foot">${escapeHtml(shop.name)} Â· ${escapeHtml(po.poNumber)}</footer></main><script>window.onload=()=>{window.focus();window.print()}</script></body></html>`;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { window.alert('Allow pop-ups to print or save this bill as PDF.'); return; }
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintOrder = (po: PurchaseOrder) => {
    const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
    const money = (value: number) => formatBDT(value).replace(/^à§³\s*/, 'à§³ ');
    const rows = po.items.map((item, index) => {
      const received = item.receivedQty ?? (po.status === 'received' ? item.qty : 0);
      return `<tr><td>${index + 1}</td><td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.sku)}</small></td><td>${escapeHtml(item.unit)}</td><td class="num">${item.qty}</td><td class="num">${money(item.unitCost)}</td><td class="num">${money(item.lineTotal)}</td><td class="num">${received} / ${item.qty}</td></tr>`;
    }).join('');
    const supplier = suppliersMap.get(po.supplierId);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Purchase Order ${escapeHtml(po.poNumber)}</title><style>
      @page{size:A4;margin:16mm}*{box-sizing:border-box}body{margin:0;color:#172033;font:12px Arial,sans-serif}.sheet{max-width:190mm;margin:auto}.head{display:flex;justify-content:space-between;border-bottom:2px solid #143c8c;padding-bottom:14px}.brand{display:flex;align-items:center;gap:12px}.brand img{width:64px;height:64px;object-fit:contain}.head h1{font-size:21px;color:#143c8c;margin:0 0 5px}.muted{color:#64748b;line-height:1.6}.title{text-align:right}.title h2{font-size:23px;margin:0 0 6px;text-transform:uppercase}.meta{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:18px 0}.box{border:1px solid #dbe3ef;border-radius:6px;background:#f8fafc;padding:11px;line-height:1.7}.box h3{font-size:10px;color:#2563eb;margin:0 0 5px;text-transform:uppercase}table{width:100%;border-collapse:collapse;margin-top:18px}th{background:#111a30;color:white;text-align:left;padding:9px 7px;font-size:10px}td{padding:9px 7px;border-bottom:1px solid #dbe3ef}td small{display:block;color:#64748b;margin-top:3px}.num{text-align:right;font-variant-numeric:tabular-nums}.total{width:280px;margin:18px 0 0 auto;padding:12px;background:#111a30;color:white;display:flex;justify-content:space-between;font-size:15px;font-weight:bold}.sign{display:flex;justify-content:space-between;margin:65px 18px 0}.sign span{width:190px;border-top:1px solid #64748b;text-align:center;padding-top:7px}.foot{margin-top:32px;padding-top:9px;border-top:1px solid #dbe3ef;text-align:center;color:#64748b;font-size:10px}
    </style></head><body><main class="sheet"><header class="head"><div class="brand"><img src="${window.location.origin}/assets/aistudio/M_S_Khan_Brothers_Gold-Blue_Badge_cceec1db.png" alt="${escapeHtml(shop.name)} logo"><div><h1>${escapeHtml(shop.name)}</h1><div class="muted">${escapeHtml(po.branchName || shop.branchName)}${shop.address ? `<br>${escapeHtml(shop.address)}` : ''}${shop.phone ? `<br>Tel: ${escapeHtml(shop.phone)}` : ''}</div></div></div><div class="title"><h2>Purchase Order</h2><strong>${escapeHtml(po.poNumber)}</strong><div class="muted">${escapeHtml(formatDateTimeBD(po.createdAt))}</div></div></header><section class="meta"><div class="box"><h3>Supplier</h3><strong>${escapeHtml(po.supplierName)}</strong>${supplier?.phone ? `<br>${escapeHtml(supplier.phone)}` : ''}</div><div class="box"><h3>Order details</h3><div>Branch: ${escapeHtml(po.branchName)}</div><div>Status: ${escapeHtml(po.status.replace('_', ' '))}</div><div>Received: ${po.receivedItemCount ?? po.items.reduce((sum, item) => sum + (item.receivedQty || 0), 0)} / ${po.itemCount} units</div></div></section><table><thead><tr><th>#</th><th>Product</th><th>Unit</th><th class="num">Order qty</th><th class="num">Unit cost</th><th class="num">Amount</th><th class="num">Received / ordered</th></tr></thead><tbody>${rows}</tbody></table><div class="total"><span>Order Total</span><strong>${money(po.totalCost)}</strong></div>${po.notes ? `<p class="muted">Note: ${escapeHtml(po.notes)}</p>` : ''}<section class="sign"><span>Authorized Signature</span><span>Supplier Signature</span></section><footer class="foot">${escapeHtml(shop.name)} Â· ${escapeHtml(po.poNumber)}</footer></main><script>window.onload=()=>{window.focus();window.print()}</script></body></html>`;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { window.alert('Allow pop-ups to print or save this purchase order as PDF.'); return; }
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleCancel = async (po: PurchaseOrder) => {
    setBusyId(po.id);
    try {
      await cancelPurchaseOrder(shop.id, po);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">
            Purchase Orders &amp; Stock-In
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Raise distributor orders and receive deliveries to automatically increment inventory and
            update cost prices.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (suppliers.length > 0 && !supplierId) setSupplierId(suppliers[0].id);
            setModalOpen(true);
          }}
          className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Purchase Order</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Pending Deliveries</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-amber-700 tabular-nums">
            {stats.openCount}
          </p>
        </div>
        <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Received Stock Value</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-emerald-700 tabular-nums">
            {formatBDT(stats.receivedValue, false)}
          </p>
        </div>
        <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Unpaid PO Dues</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-red-700 tabular-nums">
            {formatBDT(stats.unpaidTotal, false)}
          </p>
        </div>
      </div>

      {purchases.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-10 text-center space-y-3">
          <ClipboardList className="w-9 h-9 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-800">No purchase orders created yet</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {suppliers.length === 0
              ? 'First add a distributor in Suppliers, then create stock-in purchase orders.'
              : 'Create your first purchase order to restock multiple super shop SKUs in one atomic batch.'}
          </p>
          <div className="pt-1">
            {suppliers.length === 0 ? (
              <button
                type="button"
                onClick={onNavigateSuppliers}
                className="min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg cursor-pointer"
              >
                Go to Suppliers
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSupplierId(suppliers[0].id);
                  setModalOpen(true);
                }}
                className="min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg cursor-pointer"
              >
                Create Purchase Order
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">PO # &amp; Date</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4 text-right">Units</th>
                  <th className="py-3 px-4 text-right">Received Bill / Order</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {purchases.map((po) => {
                  const receivedCost = po.receivedCost ?? (po.status === 'received' ? po.totalCost : 0);
                  const due = Math.max(0, receivedCost - po.paidAmount);
                  const receivedUnits = po.receivedItemCount ?? (po.status === 'received' ? po.itemCount : po.items.reduce((sum, item) => sum + (item.receivedQty || 0), 0));
                  return (
                    <tr key={po.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <p className="font-mono text-xs font-semibold text-slate-900">
                          {po.poNumber}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDateTimeBD(po.createdAt)} Â· {po.branchName}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-xs font-medium text-slate-900">{po.supplierName}</p>
                        <p className="text-[11px] text-slate-500 truncate max-w-[200px]">
                          {po.items.map((i) => `${i.name} (${i.qty})`).join(', ')}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                        <span>{receivedUnits} / {po.itemCount}</span>
                        {po.itemCount > receivedUnits && <span className="block text-[10px] text-amber-700">{po.itemCount - receivedUnits} pending</span>}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                        <span>{formatBDT(receivedCost, false)}</span>
                        <span className="block text-[10px] font-normal text-slate-500">of {formatBDT(po.totalCost, false)}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                        <span className={due > 0 ? 'text-amber-700 font-semibold' : 'text-emerald-700'}>
                          {formatBDT(po.paidAmount, false)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold capitalize">
                        <span
                          className={
                            po.status === 'received'
                              ? 'text-emerald-700'
                              : po.status === 'ordered' || po.status === 'partially_received'
                                ? 'text-amber-700'
                                : 'text-red-700'
                          }
                        >
                          {po.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handlePrintOrder(po)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-md cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>PO / PDF</span>
                          </button>
                          {receivedCost > 0 && (
                            <button
                              type="button"
                              onClick={() => handlePrintBill(po)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Bill / PDF</span>
                            </button>
                          )}
                          {(po.status === 'ordered' || po.status === 'partially_received') && (
                            <>
                              <button
                                type="button"
                                disabled={busyId === po.id}
                                onClick={() => openReceiveModal(po)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Receive Stock</span>
                              </button>
                              <button
                                type="button"
                                disabled={busyId === po.id}
                                onClick={() => void handleCancel(po)}
                                className="p-1.5 text-slate-400 hover:text-red-700 rounded-md cursor-pointer"
                                title="Cancel PO"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {receivedCost > po.paidAmount && due > 0 && (
                            <button
                              type="button"
                              disabled={busyId === po.id}
                              onClick={() => void handlePayFull(po)}
                              className="px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md cursor-pointer"
                            >
                              Mark Paid
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Purchase Order Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleCreatePo}
            className="bg-white w-full sm:max-w-xl max-h-[92vh] rounded-t-2xl sm:rounded-xl border border-slate-200 flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900">
                Create Purchase Order
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-sm">
              {suppliers.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                  Add at least one supplier before creating a purchase order.
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Select Supplier
                    </label>
                    <select
                      required
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                      className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="">Choose distributor...</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.company || s.name} ({s.phone})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Add SKU Line Builder */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                    <p className="text-xs font-semibold text-slate-700">Add Stock Line Item</p>
                    <div className="grid grid-cols-12 gap-2">
                      <select
                        value={selectedProductId}
                        onChange={(e) => handleProductPick(e.target.value)}
                        className="col-span-12 sm:col-span-6 min-h-[40px] px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      >
                        <option value="">Select product...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (Stock: {p.stock})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={lineQty}
                        onChange={(e) => setLineQty(e.target.value)}
                        className="col-span-4 sm:col-span-2 min-h-[40px] px-2.5 py-1.5 font-mono text-xs bg-white border border-slate-200 rounded-lg tabular-nums"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Unit à§³"
                        value={lineCost}
                        onChange={(e) => setLineCost(e.target.value)}
                        className="col-span-5 sm:col-span-2 min-h-[40px] px-2.5 py-1.5 font-mono text-xs bg-white border border-slate-200 rounded-lg tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={handleAddLine}
                        disabled={!selectedProductId}
                        className="col-span-3 sm:col-span-2 min-h-[40px] text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 rounded-lg cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Added PO Items */}
                  {poItems.length > 0 && (
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {poItems.map((item) => (
                        <div
                          key={item.productId}
                          className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{item.name}</p>
                            <p className="font-mono text-slate-500 tabular-nums">
                              {item.qty} {item.unit} Ã— {formatBDT(item.unitCost)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-semibold text-slate-900 tabular-nums">
                              {formatBDT(item.lineTotal)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setPoItems((prev) =>
                                  prev.filter((x) => x.productId !== item.productId)
                                )
                              }
                              className="text-slate-400 hover:text-red-700 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="px-3.5 py-2.5 bg-slate-50 flex justify-between text-xs font-bold">
                        <span>Total Order Value</span>
                        <span className="font-mono tabular-nums">{formatBDT(poTotal)}</span>
                      </div>
                    </div>
                  )}

                  <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Delivery Note
                      </label>
                      <input
                        type="text"
                        maxLength={200}
                        placeholder="Challan / Memo ref"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full min-h-[42px] px-3 py-2 text-xs border border-slate-200 rounded-lg"
                      />
                    </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 pb-safe">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-h-[42px] px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || poItems.length === 0 || !supplierId}
                className="min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-lg cursor-pointer"
              >
                {saving ? 'Saving...' : 'Create Pending PO'}
              </button>
            </div>
          </form>
        </div>
      )}

      {receivingPo && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
          <form
            onSubmit={(event) => { event.preventDefault(); void handleReceive(receivingPo); }}
            className="bg-white w-full sm:max-w-lg max-h-[90vh] rounded-t-2xl sm:rounded-xl border border-slate-200 flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">Receive Purchase Order</h2>
                <p className="text-xs text-slate-500">{receivingPo.poNumber} Â· enter quantities received now</p>
              </div>
              <button type="button" onClick={() => setReceivingPo(null)} className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 overflow-y-auto divide-y divide-slate-100">
              {receivingPo.items.map((item) => {
                const received = item.receivedQty || 0;
                const remaining = Math.max(0, item.qty - received);
                return (
                  <div key={item.productId} className="py-3 first:pt-0 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">Received {received} / {item.qty} {item.unit} Â· {remaining} pending</p>
                    </div>
                    <label className="w-28 text-[10px] font-medium text-slate-500">Receive now
                      <input type="number" min="0" max={remaining} step="1" value={receiveInputs[item.productId] ?? '0'} onChange={(e) => setReceiveInputs((current) => ({ ...current, [item.productId]: e.target.value }))} className="mt-1 w-full min-h-[38px] px-2 font-mono text-sm border border-slate-200 rounded-lg" />
                    </label>
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button type="button" onClick={() => setReceivingPo(null)} className="min-h-[42px] px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg cursor-pointer">Cancel</button>
              <button type="submit" disabled={busyId === receivingPo.id || !Object.values(receiveInputs).some((value) => Number(value) > 0)} className="min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-lg cursor-pointer">{busyId === receivingPo.id ? 'Receiving...' : 'Confirm Received Stock'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
