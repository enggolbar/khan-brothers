import React, { useMemo, useState } from 'react';
import { Clock, Lock, Unlock } from 'lucide-react';
import {
  type Expense,
  type Sale,
  type Shift,
  type Shop,
  formatBDT,
  formatDateTimeBD,
} from '../types/pos';
import { closeCashShift, openCashShift } from '../services/operationsService';

interface ShiftsViewProps {
  shop: Shop;
  activeBranchName: string;
  cashierName: string;
  shifts: Shift[];
  sales: Sale[];
  expenses: Expense[];
}

export const ShiftsView: React.FC<ShiftsViewProps> = ({
  shop,
  activeBranchName,
  cashierName,
  shifts,
  sales,
  expenses,
}) => {
  const [openingCashInput, setOpeningCashInput] = useState('5000');
  const [openNotes, setOpenNotes] = useState('');
  const [countedCashInput, setCountedCashInput] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const openShift = useMemo(
    () => shifts.find((s) => s.status === 'open') || null,
    [shifts]
  );

  // Live X-Report calculations for currently open shift
  const liveMetrics = useMemo(() => {
    if (!openShift) return null;
    const openedMs = openShift.createdAt ? openShift.createdAt.toMillis() : 0;
    const openedDateIso = (openShift.createdAt ? openShift.createdAt.toDate() : new Date())
      .toISOString()
      .slice(0, 10);

    let cashSales = 0;
    let mfsCardSales = 0;
    let invoiceCount = 0;

    for (const sale of sales) {
      if (sale.status !== 'completed') continue;
      const saleMs = sale.createdAt ? sale.createdAt.toMillis() : Date.now();
      if (saleMs >= openedMs) {
        invoiceCount++;
        if (sale.paymentMethod === 'cash') cashSales += sale.totalAmount;
        else mfsCardSales += sale.totalAmount;
      }
    }

    const cashExpenses = expenses
      .filter((e) => e.paymentMethod === 'cash' && e.expenseDate >= openedDateIso)
      .reduce((sum, e) => sum + e.amount, 0);

    const expectedCash = openShift.openingCash + cashSales - cashExpenses;
    return { cashSales, mfsCardSales, cashExpenses, expectedCash, invoiceCount };
  }, [openShift, sales, expenses]);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || openShift) return;
    setBusy(true);
    try {
      await openCashShift(
        shop.id,
        shop.ownerId,
        activeBranchName,
        cashierName,
        Number(openingCashInput) || 0,
        openNotes
      );
      setOpenNotes('');
    } finally {
      setBusy(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !openShift || !liveMetrics) return;
    setBusy(true);
    try {
      const counted =
        countedCashInput === ''
          ? liveMetrics.expectedCash
          : Math.max(0, Number(countedCashInput) || 0);
      await closeCashShift(shop.id, openShift, {
        cashSalesTotal: liveMetrics.cashSales,
        mfsCardSalesTotal: liveMetrics.mfsCardSales,
        cashExpensesTotal: liveMetrics.cashExpenses,
        countedCash: counted,
        notes: closeNotes,
      });
      setCountedCashInput('');
      setCloseNotes('');
    } finally {
      setBusy(false);
    }
  };

  const liveVariance =
    liveMetrics && countedCashInput !== ''
      ? (Number(countedCashInput) || 0) - liveMetrics.expectedCash
      : 0;

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      <div>
        <h1 className="font-display text-xl font-bold text-slate-900">
          Cash Register Shifts &amp; Z-Reports
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Open counter shifts with an opening cash float, track live X-Report drawer balances, and
          close with counted variance reconciliation.
        </p>
      </div>

      {/* Active Shift Card or Open Shift Form */}
      {!openShift ? (
        <form
          onSubmit={handleOpenShift}
          className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 max-w-xl space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <Unlock className="w-5 h-5 text-emerald-700" />
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Open New Register Shift
              </h2>
              <p className="text-xs text-slate-500">
                {activeBranchName} · Cashier: {cashierName}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Opening Cash Float (BDT)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={openingCashInput}
                onChange={(e) => setOpeningCashInput(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 font-mono border border-slate-200 rounded-lg tabular-nums focus:outline-none focus:border-emerald-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Shift Note (Optional)
              </label>
              <input
                type="text"
                maxLength={200}
                value={openNotes}
                onChange={(e) => setOpenNotes(e.target.value)}
                placeholder="Morning Counter 1"
                className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="min-h-[44px] px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
          >
            {busy ? 'Opening Register...' : 'Open Cash Register'}
          </button>
        </form>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Active Shift — Live X-Report
              </h2>
              <p className="text-xs text-slate-500">
                {openShift.branchName} · Cashier: {openShift.cashierName} · Opened{' '}
                {formatDateTimeBD(openShift.createdAt)}
              </p>
            </div>
            <span className="text-xs font-semibold text-emerald-700">Shift Open</span>
          </div>

          {liveMetrics && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-[11px] text-slate-500">Opening Float</p>
                  <p className="mt-1 font-mono text-base font-bold text-slate-900 tabular-nums">
                    {formatBDT(openShift.openingCash, false)}
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-[11px] text-slate-500">Cash Sales</p>
                  <p className="mt-1 font-mono text-base font-bold text-emerald-700 tabular-nums">
                    +{formatBDT(liveMetrics.cashSales, false)}
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-[11px] text-slate-500">bKash / Nagad / Card</p>
                  <p className="mt-1 font-mono text-base font-bold text-slate-900 tabular-nums">
                    {formatBDT(liveMetrics.mfsCardSales, false)}
                  </p>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-[11px] text-slate-500">Cash Payouts</p>
                  <p className="mt-1 font-mono text-base font-bold text-red-700 tabular-nums">
                    -{formatBDT(liveMetrics.cashExpenses, false)}
                  </p>
                </div>
                <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-lg">
                  <p className="text-[11px] text-emerald-900 font-medium">Expected Cash Drawer</p>
                  <p className="mt-1 font-mono text-lg font-bold text-emerald-800 tabular-nums">
                    {formatBDT(liveMetrics.expectedCash)}
                  </p>
                </div>
              </div>

              <form
                onSubmit={handleCloseShift}
                className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
              >
                <div className="md:col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Counted Physical Cash (BDT)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder={liveMetrics.expectedCash.toFixed(2)}
                    value={countedCashInput}
                    onChange={(e) => setCountedCashInput(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 font-mono text-sm border border-slate-200 rounded-lg tabular-nums focus:outline-none focus:border-emerald-700"
                  />
                </div>
                <div className="md:col-span-5">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Closing Handover Note
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    placeholder={
                      countedCashInput !== ''
                        ? `Variance: ${liveVariance >= 0 ? '+' : ''}${formatBDT(liveVariance)}`
                        : 'Counted notes verified by manager'
                    }
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="md:col-span-3">
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{busy ? 'Closing...' : 'Close Shift (Z-Report)'}</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}

      {/* Closed Shift Z-Report History */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-display text-base font-bold text-slate-900">
            Shift History &amp; Cash Variance Log
          </h2>
        </div>

        {shifts.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 space-y-2">
            <Clock className="w-8 h-8 text-slate-300 mx-auto" />
            <p>No shifts recorded yet. Open a shift above before starting counter sales.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Branch &amp; Cashier</th>
                  <th className="py-3 px-4 text-right">Opening</th>
                  <th className="py-3 px-4 text-right">Cash Sales</th>
                  <th className="py-3 px-4 text-right">MFS / Card</th>
                  <th className="py-3 px-4 text-right">Expected</th>
                  <th className="py-3 px-4 text-right">Counted</th>
                  <th className="py-3 px-4 text-right">Variance</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {shifts.map((sh) => (
                  <tr key={sh.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <p className="text-xs font-semibold text-slate-900">{sh.cashierName}</p>
                      <p className="text-xs text-slate-500">
                        {sh.branchName} · {formatDateTimeBD(sh.createdAt)}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                      {formatBDT(sh.openingCash, false)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                      {formatBDT(sh.cashSalesTotal, false)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                      {formatBDT(sh.mfsCardSalesTotal, false)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                      {formatBDT(sh.expectedCash, false)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums">
                      {sh.status === 'closed' ? formatBDT(sh.countedCash, false) : '—'}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums ${
                        sh.status === 'open'
                          ? 'text-slate-400'
                          : sh.variance === 0
                            ? 'text-emerald-700'
                            : sh.variance < 0
                              ? 'text-red-700'
                              : 'text-amber-700'
                      }`}
                    >
                      {sh.status === 'closed'
                        ? `${sh.variance >= 0 ? '+' : ''}${formatBDT(sh.variance, false)}`
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold capitalize">
                      <span className={sh.status === 'open' ? 'text-emerald-700' : 'text-slate-600'}>
                        {sh.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
