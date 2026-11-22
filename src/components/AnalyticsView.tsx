import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  PAYMENT_METHODS,
  type Expense,
  type PaymentMethod,
  type Product,
  type Sale,
  formatBDT,
} from '../types/pos';

interface AnalyticsViewProps {
  sales: Sale[];
  products: Product[];
  expenses: Expense[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  sales,
  products,
  expenses,
}) => {
  const [rangeDays, setRangeDays] = useState<7 | 14>(7);

  const completedSales = useMemo(
    () => sales.filter((s) => s.status === 'completed'),
    [sales]
  );

  const kpis = useMemo(() => {
    let revenue = 0;
    let cogs = 0;
    let vatTotal = 0;
    let discountTotal = 0;

    for (const sale of completedSales) {
      revenue += sale.totalAmount;
      vatTotal += sale.vatAmount;
      discountTotal += sale.discountAmount;
      for (const item of sale.items) {
        cogs += (item.costPrice || 0) * item.qty;
      }
    }

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const taxableBase = Math.max(0, revenue - vatTotal);
    const grossProfit = Math.max(0, taxableBase - cogs);
    const netProfit = grossProfit - totalExpenses;
    const avgBasket = completedSales.length > 0 ? revenue / completedSales.length : 0;

    return {
      revenue,
      taxableBase,
      cogs,
      grossProfit,
      totalExpenses,
      netProfit,
      vatTotal,
      discountTotal,
      invoiceCount: completedSales.length,
      avgBasket,
    };
  }, [completedSales, expenses]);

  const dailyChartData = useMemo(() => {
    const today = new Date();
    const buckets: { key: string; label: string; revenue: number; bills: number }[] = [];
    const map = new Map<string, { revenue: number; bills: number }>();

    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
      }).format(d);
      buckets.push({ key, label, revenue: 0, bills: 0 });
      map.set(key, { revenue: 0, bills: 0 });
    }

    for (const sale of completedSales) {
      const d = sale.createdAt ? sale.createdAt.toDate() : new Date();
      const key = d.toISOString().slice(0, 10);
      const entry = map.get(key);
      if (entry) {
        entry.revenue = Number((entry.revenue + sale.totalAmount).toFixed(2));
        entry.bills += 1;
      }
    }

    return buckets.map((b) => {
      const val = map.get(b.key)!;
      return { ...b, revenue: val.revenue, bills: val.bills };
    });
  }, [completedSales, rangeDays]);

  const paymentBreakdown = useMemo(() => {
    const totals = new Map<PaymentMethod, { amount: number; count: number }>();
    for (const m of PAYMENT_METHODS) {
      totals.set(m.id, { amount: 0, count: 0 });
    }
    for (const sale of completedSales) {
      const entry = totals.get(sale.paymentMethod) || { amount: 0, count: 0 };
      entry.amount += sale.totalAmount;
      entry.count += 1;
      totals.set(sale.paymentMethod, entry);
    }
    return PAYMENT_METHODS.map((m) => {
      const stat = totals.get(m.id)!;
      const pct = kpis.revenue > 0 ? (stat.amount / kpis.revenue) * 100 : 0;
      return {
        ...m,
        amount: stat.amount,
        count: stat.count,
        pct,
      };
    }).sort((a, b) => b.amount - a.amount);
  }, [completedSales, kpis.revenue]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const sale of completedSales) {
      for (const item of sale.items) {
        const prev = map.get(item.productId) || { name: item.name, qty: 0, revenue: 0 };
        prev.qty += item.qty;
        prev.revenue += item.lineTotal;
        map.set(item.productId, prev);
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [completedSales]);

  const reorderList = useMemo(
    () =>
      products
        .filter((p) => p.isActive && p.stock <= p.reorderLevel)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 6),
    [products]
  );

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">
            Reports, P&amp;L &amp; NBR VAT Summary
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time BDT revenue, cost of goods sold, operating expenses, net profit, and Mushak
            output VAT.
          </p>
        </div>
        <div className="inline-flex p-1 bg-slate-200/70 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setRangeDays(7)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
              rangeDays === 7 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Last 7 Days
          </button>
          <button
            type="button"
            onClick={() => setRangeDays(14)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
              rangeDays === 14 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Last 14 Days
          </button>
        </div>
      </div>

      {/* Commercial KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Gross Revenue</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {formatBDT(kpis.revenue, false)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            {kpis.invoiceCount} completed bills
          </p>
        </div>
        <div className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Gross Profit (Excl. VAT)</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            {formatBDT(kpis.grossProfit, false)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            COGS: {formatBDT(kpis.cogs, false)}
          </p>
        </div>
        <div className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Net Profit (After Expenses)</p>
          <p
            className={`mt-1.5 font-mono text-2xl font-bold tabular-nums ${
              kpis.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
          >
            {formatBDT(kpis.netProfit, false)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            Expenses: {formatBDT(kpis.totalExpenses, false)}
          </p>
        </div>
        <div className="p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Output VAT Liability</p>
          <p className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {formatBDT(kpis.vatTotal, false)}
          </p>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            Avg basket: {formatBDT(kpis.avgBasket, false)}
          </p>
        </div>
      </div>

      {/* Profit & Loss + NBR VAT Statement */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5">
        <h2 className="font-display text-base font-bold text-slate-900 mb-3">
          Profit &amp; Loss Statement (BDT)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="divide-y divide-slate-100">
            <div className="py-2 flex justify-between">
              <span className="text-slate-600">Net Sales (Excl. VAT)</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {formatBDT(kpis.taxableBase)}
              </span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-600">Less: Cost of Goods Sold (COGS)</span>
              <span className="font-mono text-red-700 tabular-nums">
                -{formatBDT(kpis.cogs)}
              </span>
            </div>
            <div className="py-2 flex justify-between font-semibold">
              <span className="text-slate-900">Gross Trading Profit</span>
              <span className="font-mono text-emerald-700 tabular-nums">
                {formatBDT(kpis.grossProfit)}
              </span>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            <div className="py-2 flex justify-between">
              <span className="text-slate-600">Less: Operating Expenses</span>
              <span className="font-mono text-red-700 tabular-nums">
                -{formatBDT(kpis.totalExpenses)}
              </span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-slate-600">Customer Discounts Granted</span>
              <span className="font-mono text-slate-700 tabular-nums">
                {formatBDT(kpis.discountTotal)}
              </span>
            </div>
            <div className="py-2 flex justify-between font-bold text-sm">
              <span className="text-slate-900">Net Operating Profit</span>
              <span
                className={`font-mono tabular-nums ${
                  kpis.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {formatBDT(kpis.netProfit)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              Daily Revenue (BDT)
            </h2>
            <p className="text-xs text-slate-500">
              Completed counter sales over the last {rangeDays} days
            </p>
          </div>

          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748B', fontSize: 11 }}
                  axisLine={{ stroke: '#E2E8F0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748B', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `৳${v}`}
                />
                <Tooltip
                  formatter={(value: unknown) => [formatBDT(Number(value) || 0), 'Revenue']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                />
                <Bar dataKey="revenue" fill="#047857" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Method Reconciliation */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              Tender Reconciliation
            </h2>
            <p className="text-xs text-slate-500">Cash vs bKash, Nagad, Rocket &amp; Card</p>
          </div>

          <div className="space-y-3.5">
            {paymentBreakdown.map((row) => (
              <div key={row.id} className="space-y-1.5">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-medium text-slate-800">
                    {row.label} · {row.count} bills
                  </span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {formatBDT(row.amount, false)}
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-700 rounded-full transition-all"
                    style={{ width: `${Math.max(row.amount > 0 ? 4 : 0, row.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom 2-Column Data Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="font-display text-base font-bold text-slate-900">Top Moving SKUs</h2>
            <p className="text-xs text-slate-500">Ranked by gross sales revenue</p>
          </div>
          {topProducts.length === 0 ? (
            <p className="p-6 text-xs text-slate-500">
              Complete your first sale on the POS terminal to see top-performing items.
            </p>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th className="py-2.5 px-5 font-medium">Product</th>
                  <th className="py-2.5 px-4 text-right font-medium">Sold</th>
                  <th className="py-2.5 px-5 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topProducts.map((item) => (
                  <tr key={item.name}>
                    <td className="py-2.5 px-5 font-medium text-slate-900">{item.name}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-600 tabular-nums">
                      {item.qty}
                    </td>
                    <td className="py-2.5 px-5 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                      {formatBDT(item.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="font-display text-base font-bold text-slate-900">
              Low-Stock Reorder Queue
            </h2>
            <p className="text-xs text-slate-500">Items at or below reorder threshold</p>
          </div>
          {reorderList.length === 0 ? (
            <p className="p-6 text-xs text-slate-500">
              All active SKUs are currently above their reorder threshold.
            </p>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th className="py-2.5 px-5 font-medium">Product</th>
                  <th className="py-2.5 px-4 text-right font-medium">Threshold</th>
                  <th className="py-2.5 px-5 text-right font-medium">On Hand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reorderList.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 px-5 font-medium text-slate-900">{p.name}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-500 tabular-nums">
                      {p.reorderLevel} {p.unit}
                    </td>
                    <td
                      className={`py-2.5 px-5 text-right font-mono text-xs font-semibold tabular-nums ${
                        p.stock <= 0 ? 'text-red-700' : 'text-amber-700'
                      }`}
                    >
                      {p.stock} {p.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
