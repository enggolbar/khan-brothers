import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpenCheck,
  Download,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  type Customer,
  type LedgerEntry,
  type LedgerEntryType,
  type LedgerPaymentMethod,
  type Shop,
  type Supplier,
  formatBDT,
} from '../types/pos';
import {
  addManualCustomerDue,
  addManualSupplierDue,
  collectCustomerDue,
  settleSupplierBalance,
} from '../services/operationsService';

interface DueLedgerViewProps {
  shop: Shop;
  customers: Customer[];
  suppliers: Supplier[];
  ledgerEntries: LedgerEntry[];
  isSrPortal?: boolean;
}

const PAY_METHODS: { id: LedgerPaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'bkash', label: 'bKash' },
  { id: 'nagad', label: 'Nagad' },
  { id: 'bank', label: 'Bank Transfer' },
];

const ENTRY_TYPE_LABELS: Record<LedgerEntryType, { label: string; direction: 'debit' | 'credit' }> = {
  credit_sale: { label: 'POS Credit Sale', direction: 'debit' },
  sr_delivery: { label: 'SR Delivery Bill', direction: 'debit' },
  customer_collection: { label: 'Customer Collection', direction: 'credit' },
  purchase_due: { label: 'Supplier Purchase Bill', direction: 'debit' },
  supplier_payment: { label: 'Supplier Payment', direction: 'credit' },
  opening_due: { label: 'Opening / Previous Due', direction: 'debit' },
};

export const DueLedgerView: React.FC<DueLedgerViewProps> = ({
  shop,
  customers,
  suppliers,
  ledgerEntries,
  isSrPortal = false,
}) => {
  const [tab, setTab] = useState<'customers' | 'suppliers' | 'statement'>('customers');
  const [search, setSearch] = useState('');
  const [onlyWithDue, setOnlyWithDue] = useState(false);
  const [marketFilter, setMarketFilter] = useState('all');
  const [statementPartyFilter, setStatementPartyFilter] = useState<string>('all');

  const markets = useMemo(
    () => [...new Set(customers.map((c) => c.marketArea?.trim()).filter((market): market is string => Boolean(market)))].sort((a, b) => a.localeCompare(b)),
    [customers]
  );

  const [actionModal, setActionModal] = useState<{
    mode: 'collect_customer' | 'add_customer_due' | 'pay_supplier' | 'add_supplier_due';
    customer?: Customer;
    supplier?: Supplier;
  } | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [method, setMethod] = useState<LedgerPaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => {
      setNotice((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const summary = useMemo(() => {
    const customerReceivable = customers.reduce((sum, c) => sum + Number(c.balanceDue || 0), 0);
    const customerDueCount = customers.filter((c) => Number(c.balanceDue || 0) > 0).length;
    const supplierPayable = suppliers.reduce((sum, s) => sum + Number(s.balanceDue || 0), 0);
    const supplierDueCount = suppliers.filter((s) => Number(s.balanceDue || 0) > 0).length;
    const totalCollected = ledgerEntries
      .filter((e) => e.entryType === 'customer_collection')
      .reduce((sum, e) => sum + e.amount, 0);
    const totalSupplierPaid = ledgerEntries
      .filter((e) => e.entryType === 'supplier_payment')
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      customerReceivable,
      customerDueCount,
      supplierPayable,
      supplierDueCount,
      netPosition: customerReceivable - supplierPayable,
      totalCollected,
      totalSupplierPaid,
    };
  }, [customers, suppliers, ledgerEntries]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter((c) => {
        if (marketFilter !== 'all' && c.marketArea?.trim() !== marketFilter) return false;
        if (onlyWithDue && Number(c.balanceDue || 0) <= 0) return false;
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          (c.shopName || '').toLowerCase().includes(q) ||
          (c.marketArea || '').toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => Number(b.balanceDue || 0) - Number(a.balanceDue || 0));
  }, [customers, search, onlyWithDue, marketFilter]);

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return suppliers
      .filter((s) => {
        if (marketFilter !== 'all' && !(s.address || '').toLowerCase().includes(marketFilter.toLowerCase())) return false;
        if (onlyWithDue && s.balanceDue <= 0) return false;
        if (!q) return true;
        return (
          s.name.toLowerCase().includes(q) ||
          s.company.toLowerCase().includes(q) ||
          s.phone.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.balanceDue - a.balanceDue);
  }, [suppliers, search, onlyWithDue, marketFilter]);

  const filteredStatement = useMemo(() => {
    const q = search.trim().toLowerCase();
    const customerMarkets = new Map(customers.map((customer) => [customer.id, customer.marketArea?.trim() || '']));
    return ledgerEntries.filter((entry) => {
      if (marketFilter !== 'all') {
        if (entry.partyType !== 'customer' || customerMarkets.get(entry.partyId) !== marketFilter) return false;
      }
      if (statementPartyFilter === 'customers' && entry.partyType !== 'customer') return false;
      if (statementPartyFilter === 'suppliers' && entry.partyType !== 'supplier') return false;
      if (
        statementPartyFilter !== 'all' &&
        statementPartyFilter !== 'customers' &&
        statementPartyFilter !== 'suppliers' &&
        entry.partyId !== statementPartyFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        entry.partyName.toLowerCase().includes(q) ||
        entry.reference.toLowerCase().includes(q) ||
        entry.notes.toLowerCase().includes(q)
      );
    });
  }, [ledgerEntries, statementPartyFilter, search, marketFilter, customers]);

  const marketSupplierDueCount = filteredSuppliers.filter((s) => s.balanceDue > 0).length;

  const openModal = (
    mode: 'collect_customer' | 'add_customer_due' | 'pay_supplier' | 'add_supplier_due',
    party: { customer?: Customer; supplier?: Supplier }
  ) => {
    setActionModal({ mode, ...party });
    setAmountInput('');
    setMethod('cash');
    setReference('');
    setNotes('');
  };

  const handleSubmitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionModal || saving) return;
    const amount = Number(amountInput) || 0;
    if (amount <= 0) return;

    setSaving(true);
    try {
      if (actionModal.mode === 'collect_customer' && actionModal.customer) {
        await collectCustomerDue(shop.id, actionModal.customer, amount, method, reference, notes);
        showToast(
          `Collected ${formatBDT(amount)} from ${actionModal.customer.shopName || actionModal.customer.name}.`
        );
      } else if (actionModal.mode === 'add_customer_due' && actionModal.customer) {
        await addManualCustomerDue(shop.id, actionModal.customer, amount, reference, notes);
        showToast(
          `Added ${formatBDT(amount)} opening due to ${actionModal.customer.shopName || actionModal.customer.name}.`
        );
      } else if (actionModal.mode === 'pay_supplier' && actionModal.supplier) {
        await settleSupplierBalance(shop.id, actionModal.supplier, amount, method, reference, notes);
        showToast(
          `Paid ${formatBDT(amount)} to ${actionModal.supplier.company || actionModal.supplier.name}.`
        );
      } else if (actionModal.mode === 'add_supplier_due' && actionModal.supplier) {
        await addManualSupplierDue(shop.id, actionModal.supplier, amount, reference, notes);
        showToast(
          `Recorded ${formatBDT(amount)} payable due for ${actionModal.supplier.company || actionModal.supplier.name}.`
        );
      }
      setActionModal(null);
    } finally {
      setSaving(false);
    }
  };

  const handleExportLedgerCsv = () => {
    const headers = [
      'Date',
      'Party Type',
      'Party Name',
      'Entry Type',
      'Payment Method',
      'Reference',
      'Amount (BDT)',
      'Notes',
    ];
    const rows = filteredStatement.map((e) =>
      [
        e.entryDate,
        e.partyType,
        e.partyName,
        ENTRY_TYPE_LABELS[e.entryType]?.label || e.entryType,
        e.paymentMethod,
        e.reference,
        e.amount.toFixed(2),
        e.notes,
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${shop.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-due-baki-ledger.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const viewPartyStatement = (partyId: string) => {
    setStatementPartyFilter(partyId);
    setTab('statement');
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">
            Due &amp; Baki Ledger (Customer &amp; Supplier)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isSrPortal ? 'আপনার নির্ধারিত রুটের খুচরা বিক্রেতাদের বাকি দেখুন।' : 'Track market customer/retailer credit balances, supplier payables, cash/MFS settlements, and full audit statements.'}
          </p>
        </div>

        {!isSrPortal && <button
          type="button"
          onClick={handleExportLedgerCsv}
          disabled={filteredStatement.length === 0}
          className="min-h-[40px] inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-lg whitespace-nowrap cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Export Statement CSV</span>
        </button>}
      </div>

      {notice && (
        <p className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
          {notice}
        </p>
      )}

      {/* 4-Column Commercial KPI Cards */}
      <div className={`grid grid-cols-2 ${isSrPortal ? 'lg:grid-cols-2' : 'lg:grid-cols-4'} gap-4`}>
        <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Customer Due (Receivable)</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-red-700 tabular-nums">
            {formatBDT(summary.customerReceivable, false)}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500">
            {summary.customerDueCount} accounts with baki
          </p>
        </div>
        {!isSrPortal && <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Supplier Due (Payable)</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-amber-700 tabular-nums">
            {formatBDT(summary.supplierPayable, false)}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500">
            {summary.supplierDueCount} suppliers pending
          </p>
        </div>}
        <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Cash Collected (Market)</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-emerald-700 tabular-nums">
            {formatBDT(summary.totalCollected, false)}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500">Recorded collections</p>
        </div>
        {!isSrPortal && <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Paid to Suppliers</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {formatBDT(summary.totalSupplierPaid, false)}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500">Cash, bKash, Nagad &amp; Bank</p>
        </div>}
      </div>

      {/* Tab Switcher + Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-slate-200/70 rounded-lg self-start overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setTab('customers')}
            className={`min-h-[36px] px-3.5 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap cursor-pointer ${
              tab === 'customers' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Customer Due ({marketFilter === 'all' ? summary.customerDueCount : filteredCustomers.filter((c) => Number(c.balanceDue || 0) > 0).length})
          </button>
          {!isSrPortal && <button
            type="button"
            onClick={() => setTab('suppliers')}
            className={`min-h-[36px] px-3.5 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap cursor-pointer ${
              tab === 'suppliers' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Supplier Cash &amp; Due ({marketFilter === 'all' ? summary.supplierDueCount : marketSupplierDueCount})
          </button>}
          {!isSrPortal && <button
            type="button"
            onClick={() => setTab('statement')}
            className={`min-h-[36px] px-3.5 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap cursor-pointer ${
              tab === 'statement' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Full Statement ({filteredStatement.length})
          </button>}
        </div>

        <div className="flex items-center gap-2 flex-1 md:max-w-3xl">
          <label className="sr-only" htmlFor="ledger-market-filter">Filter by market</label>
          <select
            id="ledger-market-filter"
            value={marketFilter}
            onChange={(e) => setMarketFilter(e.target.value)}
            className="min-h-[38px] max-w-[180px] px-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
          >
            <option value="all">All Markets</option>
            {markets.map((market) => <option key={market} value={market}>{market}</option>)}
          </select>
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shop, party, route, phone, or ref..."
              className="w-full min-h-[38px] pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
            />
          </div>

          {tab !== 'statement' && (
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 whitespace-nowrap cursor-pointer">
              <input
                type="checkbox"
                checked={onlyWithDue}
                onChange={(e) => setOnlyWithDue(e.target.checked)}
                className="accent-emerald-700"
              />
              <span>Due only</span>
            </label>
          )}
        </div>
      </div>

      {/* Customer Due Tab */}
      {(tab === 'customers' || isSrPortal) && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          {filteredCustomers.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <BookOpenCheck className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-800">No matching customer accounts</p>
              <p className="text-xs text-slate-500">
                Add customers or wholesale retailers to start tracking credit sales and baki
                collections.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Customer / Retailer Shop</th>
                    <th className="py-3 px-4">Market &amp; Phone</th>
                    <th className="py-3 px-4 text-right">Total Billed</th>
                    <th className="py-3 px-4 text-right">Current Due (Baki)</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredCustomers.map((c) => {
                    const due = Number(c.balanceDue || 0);
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">
                            {c.shopName ? c.shopName : c.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {c.shopName ? `${c.name} · ` : ''}
                            {c.customerType === 'wholesale' ? 'Wholesale Retailer' : 'Retail Shopper'}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <p className="text-slate-700">{c.marketArea || c.address || '—'}</p>
                          <p className="font-mono text-slate-500">{c.phone}</p>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-slate-700 tabular-nums">
                          {formatBDT(c.totalSpent, false)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          <span
                            className={`font-bold ${due > 0 ? 'text-red-700' : 'text-emerald-700'}`}
                          >
                            {due > 0 ? formatBDT(due) : 'Settled'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {!isSrPortal && due > 0 && (
                              <button
                                type="button"
                                onClick={() => openModal('collect_customer', { customer: c })}
                                className="min-h-[32px] px-2.5 py-1 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md cursor-pointer"
                              >
                                Collect Due
                              </button>
                            )}
                            {!isSrPortal && <button
                              type="button"
                              onClick={() => openModal('add_customer_due', { customer: c })}
                              title="Add opening / previous baki"
                              className="min-h-[32px] inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-100 rounded-md cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Due</span>
                            </button>}
                            {!isSrPortal && <button
                              type="button"
                              onClick={() => viewPartyStatement(c.id)}
                              className="min-h-[32px] px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                            >
                              History
                            </button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Supplier Cash & Due Tab */}
      {!isSrPortal && tab === 'suppliers' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
          {filteredSuppliers.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <BookOpenCheck className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-800">No matching supplier accounts</p>
              <p className="text-xs text-slate-500">
                Add distributors or wholesale companies in Suppliers to track cash &amp; credit
                purchases.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Supplier / Company</th>
                    <th className="py-3 px-4">Category &amp; Phone</th>
                    <th className="py-3 px-4 text-right">Total Purchased</th>
                    <th className="py-3 px-4 text-right">Payable Due (Baki)</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredSuppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{s.company || s.name}</p>
                        <p className="text-xs text-slate-500">
                          {s.name}
                          {s.address ? ` · ${s.address}` : ''}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <p className="text-slate-700">{s.category}</p>
                        <p className="font-mono text-slate-500">{s.phone}</p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-700 tabular-nums">
                        {formatBDT(s.totalPurchased, false)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <span
                          className={`font-bold ${
                            s.balanceDue > 0 ? 'text-amber-700' : 'text-emerald-700'
                          }`}
                        >
                          {s.balanceDue > 0 ? formatBDT(s.balanceDue) : 'Settled'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {s.balanceDue > 0 && (
                            <button
                              type="button"
                              onClick={() => openModal('pay_supplier', { supplier: s })}
                              className="min-h-[32px] px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
                            >
                              Pay Supplier
                            </button>
                          )}
                          {!isSrPortal && <button
                            type="button"
                            onClick={() => openModal('add_supplier_due', { supplier: s })}
                            title="Add opening supplier payable"
                            className="min-h-[32px] inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-100 rounded-md cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Due</span>
                          </button>}
                          <button
                            type="button"
                            onClick={() => viewPartyStatement(s.id)}
                            className="min-h-[32px] px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            History
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Full Statement Tab */}
      {!isSrPortal && tab === 'statement' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'customers', 'suppliers'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatementPartyFilter(f)}
                className={`min-h-[34px] px-3 py-1 text-xs font-semibold rounded-lg capitalize cursor-pointer ${
                  statementPartyFilter === f
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                {f === 'all' ? 'All Entries' : f}
              </button>
            ))}
            {!['all', 'customers', 'suppliers'].includes(statementPartyFilter) && (
              <button
                type="button"
                onClick={() => setStatementPartyFilter('all')}
                className="min-h-[34px] inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg cursor-pointer"
              >
                <span>Filtered Party</span>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
            {filteredStatement.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                No ledger transactions recorded yet. Credit POS sales, SR deliveries, PO receipts,
                and cash/bKash settlements appear here automatically.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Party</th>
                      <th className="py-3 px-4">Transaction</th>
                      <th className="py-3 px-4">Mode &amp; Ref</th>
                      <th className="py-3 px-4 text-right">Due Added (+)</th>
                      <th className="py-3 px-4 text-right">Paid / Collected (-)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredStatement.map((entry) => {
                      const meta = ENTRY_TYPE_LABELS[entry.entryType];
                      const isCredit = meta?.direction === 'credit';
                      return (
                        <tr key={entry.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                            {entry.entryDate}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-medium text-slate-900">{entry.partyName}</p>
                            <p className="text-[11px] text-slate-500 capitalize">
                              {entry.partyType}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <p className="font-semibold text-slate-800 inline-flex items-center gap-1">
                              {isCredit ? (
                                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-700" />
                              ) : (
                                <ArrowUpRight className="w-3.5 h-3.5 text-amber-700" />
                              )}
                              <span>{meta?.label || entry.entryType}</span>
                            </p>
                            {entry.notes && (
                              <p className="text-slate-500 truncate max-w-xs">{entry.notes}</p>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-slate-600">
                            <span className="uppercase">{entry.paymentMethod}</span>
                            {entry.reference ? ` · ${entry.reference}` : ''}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-amber-800 tabular-nums">
                            {!isCredit ? formatBDT(entry.amount) : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                            {isCredit ? formatBDT(entry.amount) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Modal (Collect / Pay / Opening Due) */}
      {actionModal && (!isSrPortal || actionModal.mode === 'collect_customer') && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSubmitAction}
            className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border border-slate-200 overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  {actionModal.mode === 'collect_customer'
                    ? 'Collect Customer Due (Baki)'
                    : actionModal.mode === 'add_customer_due'
                      ? 'Add Previous Customer Due'
                      : actionModal.mode === 'pay_supplier'
                        ? 'Pay Supplier Cash / MFS'
                        : 'Add Opening Supplier Payable'}
                </h2>
                <p className="text-xs text-slate-500">
                  {actionModal.customer
                    ? actionModal.customer.shopName || actionModal.customer.name
                    : actionModal.supplier?.company || actionModal.supplier?.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                <span className="text-slate-600">Current Balance Due</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {formatBDT(
                    actionModal.customer
                      ? Number(actionModal.customer.balanceDue || 0)
                      : Number(actionModal.supplier?.balanceDue || 0)
                  )}
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Amount (BDT)</label>
                  {(actionModal.mode === 'collect_customer' || actionModal.mode === 'pay_supplier') && (
                    <button
                      type="button"
                      onClick={() =>
                        setAmountInput(
                          String(
                            actionModal.customer
                              ? Number(actionModal.customer.balanceDue || 0)
                              : Number(actionModal.supplier?.balanceDue || 0)
                          )
                        )
                      }
                      className="text-xs font-semibold text-emerald-700 cursor-pointer"
                    >
                      Settle Full Balance
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.5"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="Enter BDT amount"
                  className="w-full min-h-[42px] px-3 py-2 font-mono text-sm border border-slate-200 rounded-lg tabular-nums"
                />
              </div>

              {(actionModal.mode === 'collect_customer' || actionModal.mode === 'pay_supplier') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {PAY_METHODS.map((pm) => (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setMethod(pm.id)}
                        className={`min-h-[36px] px-2 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                          method === pm.id
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        {pm.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reference / TrxID
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. bKash TrxID / Slip #"
                    className="w-full min-h-[40px] px-3 py-2 font-mono text-xs border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Note (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Collected by SR / Cash"
                    className="w-full min-h-[40px] px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 pb-safe">
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="min-h-[42px] px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
              >
                {saving ? 'Recording...' : 'Record Ledger Entry'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
