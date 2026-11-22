import React, { useMemo, useState } from 'react';
import { Edit3, Plus, Search, Trash2, Wallet, X } from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  type Expense,
  type ExpensePaymentMethod,
  type Shop,
  formatBDT,
} from '../types/pos';
import {
  deleteExpense,
  upsertExpense,
  type ExpenseInput,
} from '../services/operationsService';

interface ExpensesViewProps {
  shop: Shop;
  activeBranchName: string;
  expenses: Expense[];
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  shop,
  activeBranchName,
  expenses,
}) => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const currentMonth = todayIso.slice(0, 7);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseInput>({
    title: '',
    category: 'Electricity & DESCO',
    amount: 0,
    paymentMethod: 'cash',
    branchName: activeBranchName,
    reference: '',
    notes: '',
    expenseDate: todayIso,
  });
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (categoryFilter !== 'All' && e.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.reference.toLowerCase().includes(q)
      );
    });
  }, [expenses, search, categoryFilter]);

  const totals = useMemo(() => {
    let todayTotal = 0;
    let monthTotal = 0;
    let cashTotal = 0;
    for (const e of expenses) {
      if (e.expenseDate === todayIso) todayTotal += e.amount;
      if (e.expenseDate.startsWith(currentMonth)) monthTotal += e.amount;
      if (e.paymentMethod === 'cash') cashTotal += e.amount;
    }
    return { todayTotal, monthTotal, cashTotal };
  }, [expenses, todayIso, currentMonth]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: '',
      category: 'Electricity & DESCO',
      amount: 0,
      paymentMethod: 'cash',
      branchName: activeBranchName,
      reference: '',
      notes: '',
      expenseDate: todayIso,
    });
    setModalOpen(true);
  };

  const openEdit = (exp: Expense) => {
    setEditing(exp);
    setForm({
      title: exp.title,
      category: exp.category,
      amount: exp.amount,
      paymentMethod: exp.paymentMethod,
      branchName: exp.branchName,
      reference: exp.reference,
      notes: exp.notes,
      expenseDate: exp.expenseDate,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || form.amount <= 0 || saving) return;
    setSaving(true);
    try {
      await upsertExpense(shop.id, shop.ownerId, form, editing?.id);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const methodLabel = (m: ExpensePaymentMethod) =>
    EXPENSE_PAYMENT_METHODS.find((x) => x.id === m)?.label || m;

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">
            Expenses &amp; Cashbook
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Record shop rent, DESCO utility bills, packaging, transport, and petty cash payouts for
            accurate net profit.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Record Expense</span>
        </button>
      </div>

      <div className="grid grid-cols-3 border border-slate-200 bg-white rounded-xl divide-x divide-slate-200">
        <div className="p-4">
          <p className="text-xs text-slate-500">Today's Expenses</p>
          <p className="mt-1 font-mono text-lg sm:text-xl font-bold text-red-700 tabular-nums">
            {formatBDT(totals.todayTotal, false)}
          </p>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500">This Month</p>
          <p className="mt-1 font-mono text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
            {formatBDT(totals.monthTotal, false)}
          </p>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500">Paid from Cash Drawer</p>
          <p className="mt-1 font-mono text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
            {formatBDT(totals.cashTotal, false)}
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expense title, voucher #, or category..."
            className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-emerald-700"
          />
        </div>
        <select
          aria-label="Filter expense category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="min-h-[40px] px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700"
        >
          <option value="All">All Categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <Wallet className="w-9 h-9 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-800">No expenses logged yet</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Track daily operating payouts so your Smart Dashboard calculates true net profit and
            cash drawer balances.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg cursor-pointer"
          >
            Log First Expense
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Date &amp; Description</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Paid Via</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{exp.title}</p>
                      <p className="text-xs text-slate-500 font-mono">
                        {exp.expenseDate} · {exp.branchName}
                        {exp.reference ? ` · Ref ${exp.reference}` : ''}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">{exp.category}</td>
                    <td className="py-3 px-4 text-xs text-slate-700">
                      {methodLabel(exp.paymentMethod)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-red-700 tabular-nums">
                      -{formatBDT(exp.amount)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(exp)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteExpense(shop.id, exp.id)}
                          className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSave}
            className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border border-slate-200 overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900">
                {editing ? 'Edit Expense' : 'Record Operating Expense'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Expense Title
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Monthly DESCO Electricity Bill"
                  className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount (BDT)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    required
                    value={form.amount || ''}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                    className="w-full min-h-[42px] px-3 py-2 font-mono border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Source
                  </label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) =>
                      setForm({ ...form, paymentMethod: e.target.value as ExpensePaymentMethod })
                    }
                    className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                  >
                    {EXPENSE_PAYMENT_METHODS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={form.expenseDate}
                    onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 font-mono text-xs border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Voucher / TrxID Reference (Optional)
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  placeholder="Voucher # or bKash TrxID"
                  className="w-full min-h-[42px] px-3 py-2 font-mono text-xs border border-slate-200 rounded-lg"
                />
              </div>
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
                disabled={saving}
                className="min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Expense'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
