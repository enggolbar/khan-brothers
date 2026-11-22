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
      `VAT: ${formatBDT(sale.vatAmount)}`,
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
              Tax Invoice · Mushak-6.3
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

        {/* Printable 80mm Thermal Sheet */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
          <div
            id="thermal-receipt-sheet"
            className="mx-auto max-w-[330px] bg-white border border-slate-200 rounded-lg p-5 font-mono text-xs text-slate-900 space-y-3"
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
                <span className="text-slate-600">VAT</span>
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
            onClick={() => window.print()}
            className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print 80mm</span>
          </button>
        </div>
      </div>
    </div>
  );
};
