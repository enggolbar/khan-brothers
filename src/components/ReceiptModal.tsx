import React, { useState } from 'react';
import { Check, Copy, Printer, X } from 'lucide-react';
import {
  PAYMENT_METHODS,
  type Sale,
  type Shop,
  formatBDT,
  formatDateTimeBD,
} from '../types/pos';

interface ReceiptModalProps {
  sale: Sale;
  shop: Shop;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, shop, onClose }) => {
  const [copied, setCopied] = useState(false);
  const paymentLabel =
    PAYMENT_METHODS.find((m) => m.id === sale.paymentMethod)?.label || sale.paymentMethod;

  const handlePrintInvoice = () => {
    const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
    const money = (value: number) => formatBDT(value).replace(/^৳\s*/, '৳ ');
    const rows = sale.items.map((item, index) => `<tr><td>${index + 1}</td><td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.barcode)}${item.vatRate > 0 ? ` · VAT ${item.vatRate}%` : ''}</small></td><td class="center">${escapeHtml(item.unit)}</td><td class="num">${item.qty}</td><td class="num">${money(item.unitPrice)}</td><td class="num">${money(item.lineTotal)}</td></tr>`).join('');
    const dueAmount = Number(sale.dueAmount || 0);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${escapeHtml(sale.invoiceNumber)}</title><style>
      @page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;color:#172033;font:12px Arial,sans-serif}.sheet{min-height:269mm;position:relative;padding:5mm 7mm 8mm}.rule{height:5px;background:#1457e8;margin:-5mm -7mm 18px}.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #dbe3ef;padding-bottom:16px}.brand{display:flex;align-items:center;gap:12px}.brand img{width:58px;height:58px;object-fit:contain}.brand h1{font-size:21px;margin:0 0 5px;color:#143c8c}.muted{color:#64748b;line-height:1.55}.title{text-align:right}.title h2{font-size:26px;color:#1457e8;margin:0 0 8px;text-transform:uppercase}.title b{font-family:monospace}.meta{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:18px 0}.box{border:1px solid #dbe3ef;border-top:3px solid #2563eb;border-radius:7px;background:#f8fafc;padding:12px;line-height:1.7}.box h3{font-size:10px;letter-spacing:.08em;color:#2563eb;margin:0 0 6px}.box .row{display:flex;justify-content:space-between;gap:12px}.box .row span:last-child{text-align:right}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#111a30;color:white;font-size:10px;text-transform:uppercase;padding:10px 8px;text-align:left}td{padding:10px 8px;border-bottom:1px solid #dbe3ef}td small{display:block;color:#64748b;margin-top:4px}.center{text-align:center}.num{text-align:right;font-variant-numeric:tabular-nums}.totals{width:300px;margin:18px 0 0 auto;border:1px solid #dbe3ef;border-radius:7px;overflow:hidden}.totals div{display:flex;justify-content:space-between;padding:9px 12px;border-bottom:1px solid #e2e8f0}.totals .grand{background:#111a30;color:white;font-weight:bold;font-size:15px;border:0}.notes{margin-top:18px;padding:12px;border:1px solid #dbe3ef;border-radius:7px;background:#f8fafc}.sign{display:flex;justify-content:space-between;align-items:end;margin:58px 24px 0}.sign div{width:190px;text-align:center;border-top:1px solid #94a3b8;padding-top:8px;color:#475569}.foot{position:absolute;bottom:0;left:7mm;right:7mm;border-top:1px solid #dbe3ef;padding-top:8px;text-align:center;color:#64748b;font-size:10px}@media print{.sheet{break-inside:avoid}}
    </style></head><body><main class="sheet"><div class="rule"></div><header class="head"><div class="brand"><img src="${window.location.origin}/assets/aistudio/M_S_Khan_Brothers_Gold-Blue_Badge_cceec1db.png" alt=""><div><h1>${escapeHtml(shop.name)}</h1><div class="muted">${escapeHtml(sale.branchName || shop.branchName)}${shop.address ? `<br>${escapeHtml(shop.address)}` : ''}${shop.phone ? `<br>Tel: ${escapeHtml(shop.phone)}` : ''}${shop.binNumber ? `<br>VAT BIN: ${escapeHtml(shop.binNumber)}` : ''}</div></div></div><div class="title"><h2>Invoice</h2><b>${escapeHtml(sale.invoiceNumber)}</b><div class="muted">${escapeHtml(formatDateTimeBD(sale.createdAt))}</div></div></header><section class="meta"><div class="box"><h3>BILL TO</h3><strong>${escapeHtml(sale.customerName || 'Walk-in Customer')}</strong>${sale.customerPhone ? `<br>${escapeHtml(sale.customerPhone)}` : ''}</div><div class="box"><h3>TRANSACTION DETAILS</h3><div class="row"><span>Invoice No.</span><b>${escapeHtml(sale.invoiceNumber)}</b></div><div class="row"><span>Cashier</span><span>${escapeHtml(sale.cashierName)}</span></div><div class="row"><span>Payment</span><span>${escapeHtml(paymentLabel)}</span></div>${sale.paymentRef ? `<div class="row"><span>Reference</span><span>${escapeHtml(sale.paymentRef)}</span></div>` : ''}</div></section><table><thead><tr><th>#</th><th>Description</th><th>Unit</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead><tbody>${rows}</tbody></table><section class="totals"><div><span>Subtotal</span><b>${money(sale.subtotal)}</b></div>${sale.discountAmount > 0 ? `<div><span>Discount</span><b>− ${money(sale.discountAmount)}</b></div>` : ''}<div><span>VAT / Tax${sale.vatEnabled === false ? ' (Off)' : ''}</span><b>${money(sale.vatAmount)}</b></div><div class="grand"><span>NET PAYABLE</span><b>${money(sale.totalAmount)}</b></div><div><span>Amount Paid</span><b>${money(sale.paidAmount)}</b></div>${dueAmount > 0 ? `<div><span>Balance Due</span><b>${money(dueAmount)}</b></div>` : ''}${sale.changeAmount > 0 ? `<div><span>Change</span><b>${money(sale.changeAmount)}</b></div>` : ''}</section>${shop.receiptFooter ? `<section class="notes"><strong>Notes</strong><br>${escapeHtml(shop.receiptFooter)}</section>` : ''}<section class="sign"><div>Authorized Signature</div><div>Received By</div></section><footer class="foot">${escapeHtml(shop.name)} · ${escapeHtml(sale.branchName || shop.branchName)} · ${escapeHtml(sale.invoiceNumber)}</footer></main><script>window.onload=()=>window.print()</script></body></html>`;
    const win = window.open('', '_blank');
    if (!win) { window.alert('Allow pop-ups to print or save the invoice as PDF.'); return; }
    win.document.write(html);
    win.document.close();
  };

  const handleCopySummary = async () => {
    const lines = [
      `${shop.name} (${sale.branchName})`,
      shop.binNumber ? `VAT BIN: ${shop.binNumber}` : '',
      `Invoice: ${sale.invoiceNumber}`,
      `Date: ${formatDateTimeBD(sale.createdAt)}`,
      `Customer: ${sale.customerName}${sale.customerPhone ? ` (${sale.customerPhone})` : ''}`,
      '---',
      ...sale.items.map(
        (item) => `${item.name} x${item.qty} = ${formatBDT(item.lineTotal)}`
      ),
      '---',
      `Subtotal: ${formatBDT(sale.subtotal)}`,
      sale.discountAmount > 0 ? `Discount: -${formatBDT(sale.discountAmount)}` : '',
      `VAT/TAX${sale.vatEnabled === false ? ' (OFF)' : ''}: ${formatBDT(sale.vatAmount)}`,
      `Grand Total: ${formatBDT(sale.totalAmount)}`,
      `Paid (${paymentLabel}): ${formatBDT(sale.paidAmount)}`,
      Number(sale.dueAmount || 0) > 0
        ? `Due / Baki Added: ${formatBDT(Number(sale.dueAmount || 0))}`
        : '',
      sale.changeAmount > 0 ? `Change: ${formatBDT(sale.changeAmount)}` : '',
      sale.paymentRef ? `Ref/TrxID: ${sale.paymentRef}` : '',
      shop.receiptFooter,
    ].filter(Boolean);

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="POS Receipt Preview"
    >
      <div className="bg-white w-full sm:max-w-md max-h-[92vh] rounded-t-2xl sm:rounded-xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Invoice
            </h2>
            <p className="text-xs text-slate-500 font-mono">{sale.invoiceNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt"
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable A4 invoice sheet */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
          <div
            id="thermal-receipt-sheet"
            className="mx-auto w-full max-w-[190mm] min-h-[260mm] bg-white border border-slate-200 rounded-lg p-8 font-mono text-xs text-slate-900 space-y-3"
          >
            <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-3">
              <img
                src="/assets/aistudio/M_S_Khan_Brothers_Gold-Blue_Badge_cceec1db.png"
                alt="M/S Khan Brothers Logo"
                className="w-12 h-12 rounded-full mx-auto object-contain mb-1"
              />
              <p className="text-sm font-bold tracking-tight uppercase">{shop.name}</p>
              <p className="text-[11px] text-slate-700">{sale.branchName}</p>
              {shop.address && <p className="text-[11px] text-slate-600">{shop.address}</p>}
              {shop.phone && <p className="text-[11px] text-slate-600">Tel: {shop.phone}</p>}
              {shop.binNumber && (
                <p className="text-[11px] font-semibold text-slate-800">
                  VAT BIN: {shop.binNumber} · Mushak-6.3
                </p>
              )}
            </div>

            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice:</span>
                <span className="font-semibold">{sale.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span>{formatDateTimeBD(sale.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cashier:</span>
                <span>{sale.cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="truncate max-w-[180px] text-right">{sale.customerName}</span>
              </div>
              {sale.customerPhone && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone:</span>
                  <span>{sale.customerPhone}</span>
                </div>
              )}
              {sale.status !== 'completed' && (
                <div className="flex justify-between pt-1 font-bold text-red-700">
                  <span>Status:</span>
                  <span className="uppercase">{sale.status}</span>
                </div>
              )}
            </div>

            {/* Line Items */}
            <div className="border-b border-dashed border-slate-300 pb-3">
              <div className="grid grid-cols-12 text-[10px] font-semibold text-slate-500 pb-1.5 border-b border-slate-200">
                <span className="col-span-6">Item</span>
                <span className="col-span-2 text-right">Qty</span>
                <span className="col-span-4 text-right">Amount</span>
              </div>
              <div className="divide-y divide-slate-100">
                {sale.items.map((item, idx) => (
                  <div key={`${item.productId}-${idx}`} className="py-1.5">
                    <div className="grid grid-cols-12 items-start gap-1">
                      <span className="col-span-6 leading-snug break-words">{item.name}</span>
                      <span className="col-span-2 text-right tabular-nums">{item.qty}</span>
                      <span className="col-span-4 text-right tabular-nums font-medium">
                        {item.lineTotal.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 tabular-nums">
                      @ {formatBDT(item.unitPrice)}/{item.unit}
                      {item.vatRate > 0 ? ` · VAT ${item.vatRate}%` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3 tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal ({sale.itemCount} items)</span>
                <span>{formatBDT(sale.subtotal)}</span>
              </div>
              {sale.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-800">
                  <span>Discount</span>
                  <span>-{formatBDT(sale.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">VAT/TAX{sale.vatEnabled === false ? ' (Off)' : ''}</span>
                <span>{formatBDT(sale.vatAmount)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-slate-200">
                <span>NET PAYABLE</span>
                <span>{formatBDT(sale.totalAmount)}</span>
              </div>
            </div>

            {/* Payment Details */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3 tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-600">Payment Mode</span>
                <span className="font-semibold">{paymentLabel}</span>
              </div>
              {sale.paymentRef && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Ref / TrxID</span>
                  <span className="font-semibold">{sale.paymentRef}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">Amount Paid</span>
                <span>{formatBDT(sale.paidAmount)}</span>
              </div>
              {Number(sale.dueAmount || 0) > 0 && (
                <div className="flex justify-between font-bold text-red-700">
                  <span>Due / Baki Added</span>
                  <span>{formatBDT(Number(sale.dueAmount || 0))}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600">Change Due</span>
                <span>{formatBDT(sale.changeAmount)}</span>
              </div>
            </div>

            {/* Footer & Barcode representation */}
            <div className="text-center space-y-2 pt-1">
              {shop.receiptFooter && (
                <p className="text-[10px] text-slate-600 leading-relaxed">{shop.receiptFooter}</p>
              )}
              <div className="pt-1">
                <div
                  className="mx-auto h-7 w-44"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(90deg, #0f172a 0 2px, transparent 2px 4px, #0f172a 4px 5px, transparent 5px 8px, #0f172a 8px 11px, transparent 11px 13px)',
                  }}
                />
                <p className="mt-1 text-[10px] tracking-widest text-slate-600">
                  {sale.invoiceNumber}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-white flex items-center gap-3 pb-safe">
          <button
            type="button"
            onClick={() => void handleCopySummary()}
            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied' : 'Copy Text'}</span>
          </button>
          <button
            type="button"
            onClick={handlePrintInvoice}
            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save A4 PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
