import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Printer,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react';
import {
  PAYMENT_METHODS,
  type PaymentMethod,
  type Product,
  type Sale,
  type SaleStatus,
  type Shop,
  formatBDT,
  formatDateTimeBD,
} from '../types/pos';
import {
  completeHeldSale,
  exportSalesToCsv,
  refundSaleAndRestock,
  voidHeldSale,
} from '../services/posService';

interface SalesHistoryViewProps {
  shop: Shop;
  sales: Sale[];
  products: Product[];
  onViewReceipt: (sale: Sale) => void;
}

export const SalesHistoryView: React.FC<SalesHistoryViewProps> = ({
  shop,
  sales,
  products,
  onViewReceipt,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SaleStatus>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | PaymentMethod>('all');
  const [refundTarget, setRefundTarget] = useState<Sale | null>(null);
  const [settleTarget, setSettleTarget] = useState<Sale | null>(null);
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>('cash');
  const [settleRef, setSettleRef] = useState('');
  const [busy, setBusy] = useState(false);

  const productsMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (methodFilter !== 'all' && s.paymentMethod !== methodFilter) return false;
      if (!q) return true;
      return (
        s.invoiceNumber.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q) ||
        s.customerPhone.toLowerCase().includes(q) ||
        s.paymentRef.toLowerCase().includes(q)
      );
    });
  }, [sales, search, statusFilter, methodFilter]);

  const summary = useMemo(() => {
    const completed = filtered.filter((s) => s.status === 'completed');
    const netTotal = completed.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalVat = completed.reduce((acc, s) => acc + s.vatAmount, 0);
    return {
      count: filtered.length,
      completedCount: completed.length,
      netTotal,
      totalVat,
    };
  }, [filtered]);

  const handleConfirmRefund = async () => {
    if (!refundTarget || busy) return;
    setBusy(true);
    try {
      await refundSaleAndRestock(shop.id, refundTarget, productsMap);
      setRefundTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteHeld = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleTarget || busy) return;
    setBusy(true);
    try {
      await completeHeldSale(
        shop.id,
        settleTarget,
        productsMap,
        settleMethod,
        settleRef,
        settleTarget.totalAmount
      );
      const completedPreview: Sale = {
        ...settleTarget,
        status: 'completed',
        paymentMethod: settleMethod,
        paymentRef: settleRef,
        paidAmount: settleTarget.totalAmount,
        changeAmount: 0,
      };
      setSettleTarget(null);
      setSettleRef('');
      onViewReceipt(completedPreview);
    } finally {
      setBusy(false);
    }
  };

  const handleVoidHeld = async (sale: Sale) => {
    if (busy) return;
    setBusy(true);
    try {
      await voidHeldSale(shop.id, sale.id);
    } finally {
      setBusy(false);
    }
  };

  const getMethodLabel = (m: PaymentMethod) =>
    PAYMENT_METHODS.find((x) => x.id === m)?.short || m;

  const getStatusClass = (status: SaleStatus) => {
    switch (status) {
      case 'completed':
        return 'text-emerald-700';
      case 'held':
        return 'text-amber-700';
      case 'refunded':
      case 'voided':
        return 'text-red-700';
    }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">
            Sales Ledger &amp; Receipts
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Reprint 80mm Mushak-6.3 receipts, settle held bills, or process stock-restoring refunds.
          </p>
        </div>

        <button
          type="button"
          disabled={filtered.length === 0}
          onClick={() => exportSalesToCsv(filtered, shop.name)}
          className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg whitespace-nowrap cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Commercial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Filtered Bills</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {summary.count}
          </p>
        </div>
        <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Completed Sales</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-emerald-700 tabular-nums">
            {formatBDT(summary.netTotal, false)}
          </p>
        </div>
        <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">VAT Collected</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {formatBDT(summary.totalVat, false)}
          </p>
        </div>
      </div>

      {/* Search & Segmented Filters */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice #, customer phone, or bKash/Nagad TrxID..."
            className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-emerald-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by payment method"
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as 'all' | PaymentMethod)}
            className="min-h-[40px] px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700"
          >
            <option value="all">All Channels</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>

          <div className="inline-flex p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {(['all', 'completed', 'held', 'refunded'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize whitespace-nowrap cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-800">No invoices found</p>
          <p className="text-xs text-slate-500">
            Completed and held transactions from your POS terminal will appear here in real time.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Ledger Table */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Invoice &amp; Time</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Items</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <p className="font-mono text-xs font-semibold text-slate-900">
                          {sale.invoiceNumber}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDateTimeBD(sale.createdAt)} · {sale.branchName}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-xs font-medium text-slate-900">{sale.customerName}</p>
                        {sale.customerPhone && (
                          <p className="text-xs font-mono text-slate-500">{sale.customerPhone}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        <span>{getMethodLabel(sale.paymentMethod)}</span>
                        {sale.paymentRef && (
                          <p className="font-mono text-[11px] text-slate-500 truncate max-w-[140px]">
                            {sale.paymentRef}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-700 tabular-nums">
                        {sale.itemCount}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {formatBDT(sale.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold capitalize">
                        <span className={getStatusClass(sale.status)}>{sale.status}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onViewReceipt(sale)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                          </button>

                          {sale.status === 'held' && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setSettleTarget(sale);
                                  setSettleMethod('cash');
                                  setSettleRef('');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Settle</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleVoidHeld(sale)}
                                className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-md cursor-pointer"
                                title="Void held bill"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {sale.status === 'completed' && (
                            <button
                              type="button"
                              onClick={() => setRefundTarget(sale)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 rounded-md cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Refund</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Sales Cards */}
          <div className="md:hidden space-y-2.5">
            {filtered.map((sale) => (
              <div
                key={sale.id}
                className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-bold text-slate-900">
                      {sale.invoiceNumber}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDateTimeBD(sale.createdAt)} · {sale.customerName}
                    </p>
                  </div>
                  <p className="font-mono text-base font-bold text-slate-900 tabular-nums">
                    {formatBDT(sale.totalAmount, false)}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="text-slate-600">
                    {getMethodLabel(sale.paymentMethod)} ·{' '}
                    <span className={`font-semibold capitalize ${getStatusClass(sale.status)}`}>
                      {sale.status}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onViewReceipt(sale)}
                      className="min-h-[36px] px-3 py-1 font-medium text-slate-700 border border-slate-200 rounded-lg"
                    >
                      Receipt
                    </button>
                    {sale.status === 'held' && (
                      <button
                        type="button"
                        onClick={() => {
                          setSettleTarget(sale);
                          setSettleMethod('cash');
                        }}
                        className="min-h-[36px] px-3 py-1 font-semibold text-white bg-emerald-700 rounded-lg"
                      >
                        Settle
                      </button>
                    )}
                    {sale.status === 'completed' && (
                      <button
                        type="button"
                        onClick={() => setRefundTarget(sale)}
                        className="min-h-[36px] px-2.5 py-1 font-medium text-red-700"
                      >
                        Refund
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Refund Confirmation Modal */}
      {refundTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full max-w-sm rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900">
              Refund Invoice &amp; Restock?
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Mark <span className="font-mono font-semibold">{refundTarget.invoiceNumber}</span> (
              <span className="font-mono font-semibold">{formatBDT(refundTarget.totalAmount)}</span>
              ) as refunded and automatically add {refundTarget.itemCount} items back into
              inventory?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRefundTarget(null)}
                className="min-h-[40px] px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleConfirmRefund()}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer"
              >
                {busy ? 'Processing...' : 'Confirm Refund'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settle Held Bill Modal */}
      {settleTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleCompleteHeld}
            className="bg-white w-full max-w-sm rounded-xl border border-slate-200 p-5 space-y-4"
          >
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                Complete Held Bill
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {settleTarget.invoiceNumber} · Payable {formatBDT(settleTarget.totalAmount)}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSettleMethod(m.id)}
                  className={`min-h-[38px] text-xs font-semibold rounded-lg border cursor-pointer ${
                    settleMethod === m.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  {m.short}
                </button>
              ))}
            </div>

            {settleMethod !== 'cash' && (
              <input
                type="text"
                placeholder="TrxID / Card approval ref"
                value={settleRef}
                onChange={(e) => setSettleRef(e.target.value)}
                maxLength={60}
                className="w-full min-h-[40px] px-3 py-2 font-mono text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
              />
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSettleTarget(null)}
                className="min-h-[40px] px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
              >
                {busy ? 'Settling...' : 'Complete & Print'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
