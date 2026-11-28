import React, { useMemo } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Barcode,
  BookOpenCheck,
  Boxes,
  ClipboardList,
  MapPin,
  Printer,
  ShoppingCart,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  PAYMENT_METHODS,
  type Customer,
  type Expense,
  type PaymentMethod,
  type Product,
  type PurchaseOrder,
  type Sale,
  type Shift,
  type Shop,
  type SrOrder,
  type Supplier,
  type WorkspaceTab,
  formatBDT,
  formatDateTimeBD,
} from '../types/pos';

interface SmartDashboardViewProps {
  shop: Shop;
  activeBranchName: string;
  products: Product[];
  sales: Sale[];
  customers: Customer[];
  expenses: Expense[];
  purchases: PurchaseOrder[];
  suppliers: Supplier[];
  shifts: Shift[];
  srOrders: SrOrder[];
  onNavigate: (tab: WorkspaceTab) => void;
  onViewReceipt: (sale: Sale) => void;
}

export const SmartDashboardView: React.FC<SmartDashboardViewProps> = ({
  shop,
  activeBranchName,
  products,
  sales,
  customers,
  expenses,
  purchases,
  suppliers,
  shifts,
  srOrders,
  onNavigate,
  onViewReceipt,
}) => {
  const todayIso = new Date().toISOString().slice(0, 10);

  const completedSales = useMemo(
    () => sales.filter((s) => s.status === 'completed'),
    [sales]
  );

  const openShift = useMemo(
    () => shifts.find((s) => s.status === 'open') || null,
    [shifts]
  );

  const todayStats = useMemo(() => {
    let salesTotal = 0;
    let cashSales = 0;
    let mfsCardSales = 0;
    let cogs = 0;
    let vatTotal = 0;
    let billCount = 0;

    for (const s of completedSales) {
      const dt = (s.createdAt ? s.createdAt.toDate() : new Date()).toISOString().slice(0, 10);
      if (dt === todayIso) {
        salesTotal += s.totalAmount;
        vatTotal += s.vatAmount;
        billCount += 1;
        if (s.paymentMethod === 'cash') cashSales += s.totalAmount;
        else mfsCardSales += s.totalAmount;
        for (const item of s.items) {
          cogs += (item.costPrice || 0) * item.qty;
        }
      }
    }

    const todayExpenses = expenses
      .filter((e) => e.expenseDate === todayIso)
      .reduce((sum, e) => sum + e.amount, 0);

    const todayCashExpenses = expenses
      .filter((e) => e.expenseDate === todayIso && e.paymentMethod === 'cash')
      .reduce((sum, e) => sum + e.amount, 0);

    const estGrossProfit = Math.max(0, salesTotal - vatTotal - cogs);
    const estNetProfit = estGrossProfit - todayExpenses;

    return {
      salesTotal,
      cashSales,
      mfsCardSales,
      billCount,
      todayExpenses,
      todayCashExpenses,
      estNetProfit,
    };
  }, [completedSales, expenses, todayIso]);

  const inventoryAlerts = useMemo(() => {
    const low = products.filter((p) => p.isActive && p.stock > 0 && p.stock <= p.reorderLevel);
    const out = products.filter((p) => p.isActive && p.stock <= 0);
    return { low, out };
  }, [products]);

  const totalSupplierDue = useMemo(
    () => suppliers.reduce((sum, s) => sum + s.balanceDue, 0),
    [suppliers]
  );

  const totalCustomerDue = useMemo(
    () => customers.reduce((sum, c) => sum + Number(c.balanceDue || 0), 0),
    [customers]
  );

  const srStats = useMemo(() => {
    const pending = srOrders.filter((o) => o.status === 'pending' || o.status === 'approved');
    const delivered = srOrders.filter((o) => o.status === 'delivered');
    const deliveredTotal = delivered.reduce((sum, o) => sum + o.totalAmount, 0);
    const commissionTotal = delivered.reduce((sum, o) => sum + o.commissionAmount, 0);
    return { pending, deliveredTotal, commissionTotal, deliveredCount: delivered.length };
  }, [srOrders]);

  const pendingPos = useMemo(
    () => purchases.filter((p) => p.status === 'ordered' || p.status === 'partially_received'),
    [purchases]
  );

  const trendData = useMemo(() => {
    const today = new Date();
    const rows: { key: string; label: string; revenue: number; expenses: number }[] = [];
    const revMap = new Map<string, number>();
    const expMap = new Map<string, number>();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(d);
      rows.push({ key, label, revenue: 0, expenses: 0 });
      revMap.set(key, 0);
      expMap.set(key, 0);
    }

    for (const s of completedSales) {
      const key = (s.createdAt ? s.createdAt.toDate() : new Date()).toISOString().slice(0, 10);
      if (revMap.has(key)) {
        revMap.set(key, Number(((revMap.get(key) || 0) + s.totalAmount).toFixed(2)));
      }
    }

    for (const e of expenses) {
      if (expMap.has(e.expenseDate)) {
        expMap.set(e.expenseDate, Number(((expMap.get(e.expenseDate) || 0) + e.amount).toFixed(2)));
      }
    }

    return rows.map((r) => ({
      ...r,
      revenue: revMap.get(r.key) || 0,
      expenses: expMap.get(r.key) || 0,
    }));
  }, [completedSales, expenses]);

  const channelMix = useMemo(() => {
    const map = new Map<PaymentMethod, number>();
    for (const m of PAYMENT_METHODS) map.set(m.id, 0);
    let total = 0;
    for (const s of completedSales) {
      map.set(s.paymentMethod, (map.get(s.paymentMethod) || 0) + s.totalAmount);
      total += s.totalAmount;
    }
    return PAYMENT_METHODS.map((m) => {
      const amount = map.get(m.id) || 0;
      return {
        ...m,
        amount,
        pct: total > 0 ? (amount / total) * 100 : 0,
      };
    }).sort((a, b) => b.amount - a.amount);
  }, [completedSales]);

  const liveDrawerCash = openShift
    ? openShift.openingCash + todayStats.cashSales - todayStats.todayCashExpenses
    : 0;

  const totalCombinedVolume = todayStats.salesTotal + srStats.deliveredTotal;

  const formattedBdDate = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Executive Commercial Command Banner */}
      <section className="rounded-2xl bg-[#0B1320] text-white p-5 sm:p-6 border border-slate-800 shadow-[0_4px_20px_-6px_rgba(15,23,42,0.28)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0">
            <img
              src="/assets/aistudio/M_S_Khan_Brothers_Gold-Blue_Badge_cceec1db.png"
              alt="M/S Khan Brothers Official Badge"
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white object-contain p-1 ring-2 ring-amber-400/50 shadow-md shrink-0"
            />
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{shop.address}</span>
                </span>
                <span aria-hidden="true">·</span>
                <span>{formattedBdDate}</span>
                <span aria-hidden="true">·</span>
                <span className={openShift ? 'text-emerald-400' : 'text-amber-300'}>
                  {openShift ? `Register Open (${formatBDT(liveDrawerCash, false)})` : 'Shift Closed'}
                </span>
              </div>

              <h1 className="font-display text-2xl sm:text-[1.7rem] font-bold tracking-tight text-white truncate">
                {shop.name}
              </h1>

              <p className="text-xs sm:text-sm text-slate-400">
                {activeBranchName} · Counter &amp; Distribution Volume{' '}
                <span className="font-mono font-semibold text-white tabular-nums">
                  {formatBDT(totalCombinedVolume, false)}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('sr-orders')}
              className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-100 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              <Truck className="w-4 h-4 text-emerald-400" />
              <span>New SR Field Order</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('pos')}
              className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Open POS Register</span>
            </button>
          </div>
        </div>
      </section>

      {/* 4 Commercial Executive KPI Cards (Dashboard Stickers) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('sales')}
          className="group text-left bg-white border border-slate-200/90 hover:border-emerald-600/60 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150 hover:-translate-y-0.5 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-700 transition-colors" />
          </div>
          <p className="mt-4 text-xs font-medium text-slate-500">Today's Counter POS Sales</p>
          <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
            {formatBDT(todayStats.salesTotal, false)}
          </p>
          <p className="mt-2 pt-2.5 border-t border-slate-100 text-xs text-slate-500 tabular-nums flex items-center justify-between gap-2">
            <span>{todayStats.billCount} bills completed</span>
            <span className="font-mono font-medium text-emerald-700">
              Net {formatBDT(todayStats.estNetProfit, false)}
            </span>
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('ledger')}
          className="group text-left bg-white border border-slate-200/90 hover:border-red-500/50 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150 hover:-translate-y-0.5 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-700 flex items-center justify-center shrink-0">
              <BookOpenCheck className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-red-700 transition-colors" />
          </div>
          <p className="mt-4 text-xs font-medium text-slate-500">Customer Due (Market Baki)</p>
          <p className="mt-1 font-mono text-2xl font-bold text-red-700 tabular-nums tracking-tight">
            {formatBDT(totalCustomerDue, false)}
          </p>
          <p className="mt-2 pt-2.5 border-t border-slate-100 text-xs text-slate-500 tabular-nums flex items-center justify-between gap-2">
            <span>Supplier Payable</span>
            <span className="font-mono font-semibold text-amber-800">
              {formatBDT(totalSupplierDue, false)}
            </span>
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('sr-orders')}
          className="group text-left bg-white border border-slate-200/90 hover:border-emerald-600/60 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150 hover:-translate-y-0.5 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-700 transition-colors" />
          </div>
          <p className="mt-4 text-xs font-medium text-slate-500">SR Distribution Delivered</p>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-700 tabular-nums tracking-tight">
            {formatBDT(srStats.deliveredTotal, false)}
          </p>
          <p className="mt-2 pt-2.5 border-t border-slate-100 text-xs text-slate-500 tabular-nums flex items-center justify-between gap-2">
            <span>{srStats.pending.length} open SR orders</span>
            <span className="font-mono font-medium text-slate-800">
              Comm {formatBDT(srStats.commissionTotal, false)}
            </span>
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('inventory')}
          className="group text-left bg-white border border-slate-200/90 hover:border-amber-500/60 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150 hover:-translate-y-0.5 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-amber-700 transition-colors" />
          </div>
          <p className="mt-4 text-xs font-medium text-slate-500">Stock &amp; Purchase Attention</p>
          <p className="mt-1 font-mono text-2xl font-bold text-amber-700 tabular-nums tracking-tight">
            {inventoryAlerts.low.length + inventoryAlerts.out.length} SKUs
          </p>
          <p className="mt-2 pt-2.5 border-t border-slate-100 text-xs text-slate-500 tabular-nums flex items-center justify-between gap-2">
            <span>{products.length} total catalog items</span>
            <span className="font-mono font-medium text-slate-800">
              {pendingPos.length} open PO
            </span>
          </p>
        </button>
      </section>

      {/* Commercial Workflow Launchpad Tiles */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {(
          [
            {
              tab: 'pos',
              label: 'New POS Bill',
              sub: 'Cash, MFS & Baki',
              icon: ShoppingCart,
            },
            {
              tab: 'sr-orders',
              label: 'SR Field Order',
              sub: 'Route & Challan',
              icon: Truck,
            },
            {
              tab: 'ledger',
              label: 'Due / Baki Book',
              sub: 'Collect & Pay',
              icon: BookOpenCheck,
            },
            {
              tab: 'purchases',
              label: 'Receive Stock',
              sub: 'Supplier POs',
              icon: ClipboardList,
            },
            {
              tab: 'expenses',
              label: 'Log Expense',
              sub: 'Rent & SR TA/DA',
              icon: Wallet,
            },
            {
              tab: 'barcodes',
              label: 'Shelf Stickers',
              sub: '894 Price Tags',
              icon: Barcode,
            },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => onNavigate(item.tab)}
              className="group p-3.5 bg-white border border-slate-200/90 hover:border-emerald-700 rounded-2xl text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-150 hover:-translate-y-0.5 flex flex-col justify-between min-h-[92px] cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-emerald-700 text-emerald-700 group-hover:text-white flex items-center justify-center transition-colors">
                <Icon className="w-4 h-4" />
              </div>
              <div className="mt-2.5">
                <p className="text-xs font-bold text-slate-900">{item.label}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{item.sub}</p>
              </div>
            </button>
          );
        })}
      </section>

      {/* Revenue vs Expense Cashflow Chart + Payment Channel Mix */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                7-Day Commercial Cashflow
              </h2>
              <p className="text-xs text-slate-500">
                Completed counter revenue vs operating expenses in BDT
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-700" />
                Revenue
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-600" />
                Expenses
              </span>
              <button
                type="button"
                onClick={() => onNavigate('analytics')}
                className="font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <span>Reports</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="bgRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#047857" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#047857" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="bgExpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D97706" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#D97706" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
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
                  formatter={(value: unknown, name: unknown) => [
                    formatBDT(Number(value) || 0),
                    name === 'revenue' ? 'Sales Revenue' : 'Expenses',
                  ]}
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 8px 20px -6px rgba(15, 23, 42, 0.14)',
                    fontSize: '12px',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#047857"
                  strokeWidth={2.25}
                  fill="url(#bgRevGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stroke="#D97706"
                  strokeWidth={2}
                  fill="url(#bgExpGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col justify-between space-y-4">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              Payment Channel Share
            </h2>
            <p className="text-xs text-slate-500">
              Cash, MFS (bKash/Nagad/Rocket), Card &amp; Due mix
            </p>
          </div>

          <div className="space-y-3.5 flex-1 flex flex-col justify-center">
            {channelMix.map((row) => (
              <div key={row.id} className="space-y-1.5">
                <div className="flex items-baseline justify-between text-xs gap-2">
                  <span className="font-semibold text-slate-700">{row.label}</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {formatBDT(row.amount, false)}{' '}
                    <span className="text-[11px] font-normal text-slate-400">
                      ({row.pct.toFixed(0)}%)
                    </span>
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      row.id === 'credit' ? 'bg-amber-600' : 'bg-emerald-700'
                    }`}
                    style={{ width: `${Math.max(row.amount > 0 ? 4 : 0, row.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3 Actionable Commercial Queues */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Counter Invoices */}
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-slate-900">Recent Counter Bills</h2>
            <button
              type="button"
              onClick={() => onNavigate('sales')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
            >
              View all
            </button>
          </div>
          {sales.length === 0 ? (
            <div className="p-6 text-xs text-slate-500">
              No counter bills yet. Complete your first sale on the POS Terminal.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sales.slice(0, 5).map((sale) => (
                <div
                  key={sale.id}
                  className="px-5 py-3 flex items-center justify-between gap-2 text-xs hover:bg-slate-50/70 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-mono font-semibold text-slate-900 truncate">
                      {sale.invoiceNumber}
                    </p>
                    <p className="text-slate-500 truncate mt-0.5">
                      {sale.customerName} · {formatDateTimeBD(sale.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {formatBDT(sale.totalAmount, false)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onViewReceipt(sale)}
                      aria-label={`Print ${sale.invoiceNumber}`}
                      className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending SR Dispatch & Supplier POs */}
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-slate-900">
              Pending SR Orders &amp; POs
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('sr-orders')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
            >
              SR Dispatch
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {srStats.pending.slice(0, 3).map((ord) => (
              <button
                key={ord.id}
                type="button"
                onClick={() => onNavigate('sr-orders')}
                className="w-full text-left px-5 py-3 flex items-center justify-between gap-2 text-xs hover:bg-slate-50/70 transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="font-mono font-semibold text-emerald-800 truncate">
                    {ord.orderNumber} · {ord.srName}
                  </p>
                  <p className="text-slate-500 truncate mt-0.5">
                    {ord.retailerShopName} · {ord.routeArea}
                  </p>
                </div>
                <span className="font-mono font-bold text-slate-900 tabular-nums shrink-0">
                  {formatBDT(ord.totalAmount, false)}
                </span>
              </button>
            ))}
            {pendingPos.slice(0, 2).map((po) => (
              <button
                key={po.id}
                type="button"
                onClick={() => onNavigate('purchases')}
                className="w-full text-left px-5 py-3 flex items-center justify-between gap-2 text-xs hover:bg-slate-50/70 transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="font-mono font-semibold text-amber-800 truncate">
                    {po.poNumber} · Supplier PO
                  </p>
                  <p className="text-slate-500 truncate mt-0.5">{po.supplierName}</p>
                </div>
                <span className="font-mono font-bold text-slate-900 tabular-nums shrink-0">
                  {formatBDT(po.totalCost, false)}
                </span>
              </button>
            ))}
            {srStats.pending.length === 0 && pendingPos.length === 0 && (
              <div className="p-6 text-xs text-slate-500">
                No pending SR field orders or supplier POs waiting for dispatch.
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Alert Queue */}
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-slate-900">
              Reorder Stock Alerts
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('purchases')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
            >
              Order stock
            </button>
          </div>
          {inventoryAlerts.low.length + inventoryAlerts.out.length === 0 ? (
            <div className="p-6 text-xs text-slate-500">
              All active SKUs are currently above their reorder threshold.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {[...inventoryAlerts.out, ...inventoryAlerts.low].slice(0, 5).map((p) => {
                const pct =
                  p.reorderLevel > 0 ? Math.min(100, Math.round((p.stock / p.reorderLevel) * 100)) : 0;
                return (
                  <div key={p.id} className="px-5 py-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                        <p className="text-slate-500 font-mono text-[11px]">
                          {p.sku} · Reorder at {p.reorderLevel}
                        </p>
                      </div>
                      <span
                        className={`font-mono font-bold tabular-nums shrink-0 ${
                          p.stock <= 0 ? 'text-red-700' : 'text-amber-700'
                        }`}
                      >
                        {p.stock} {p.unit}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          p.stock <= 0 ? 'bg-red-600' : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.max(p.stock > 0 ? 12 : 4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
