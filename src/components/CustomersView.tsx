import React, { useMemo, useState } from 'react';
import { Edit3, Plus, Search, Trash2, Users, X } from 'lucide-react';
import {
  RANGAMATI_ROUTES,
  type Customer,
  type CustomerType,
  type Shop,
  formatBDT,
} from '../types/pos';
import { deleteCustomer, upsertCustomer, type CustomerInput } from '../services/posService';

interface CustomersViewProps {
  shop: Shop;
  customers: Customer[];
  onNavigateLedger?: () => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  shop,
  customers,
  onNavigateLedger,
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | CustomerType>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerInput>({
    name: '',
    shopName: '',
    marketArea: RANGAMATI_ROUTES[0],
    customerType: 'retail',
    phone: '',
    address: '',
    creditLimit: 0,
  });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      const cType = c.customerType || 'retail';
      if (typeFilter !== 'all' && cType !== typeFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.shopName || '').toLowerCase().includes(q) ||
        (c.marketArea || '').toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
      );
    });
  }, [customers, search, typeFilter]);

  const metrics = useMemo(() => {
    const totalPoints = customers.reduce((sum, c) => sum + c.loyaltyPoints, 0);
    const totalSpend = customers.reduce((sum, c) => sum + c.totalSpent, 0);
    const totalDue = customers.reduce((sum, c) => sum + Number(c.balanceDue || 0), 0);
    const wholesaleCount = customers.filter((c) => c.customerType === 'wholesale').length;
    return { totalPoints, totalSpend, totalDue, wholesaleCount };
  }, [customers]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      shopName: '',
      marketArea: RANGAMATI_ROUTES[0],
      customerType: 'wholesale',
      phone: '',
      address: '',
      creditLimit: 25000,
    });
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name,
      shopName: c.shopName || '',
      marketArea: c.marketArea || '',
      customerType: c.customerType || 'retail',
      phone: c.phone,
      address: c.address,
      creditLimit: Number(c.creditLimit || 0),
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || saving) return;
    setSaving(true);
    try {
      await upsertCustomer(shop.id, shop.ownerId, form, editing?.id);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteCustomer(shop.id, deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">
            Customers, Retailers &amp; Credit Accounts
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage supermarket loyalty members and wholesale retailer shops with market routes and
            baki balances.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onNavigateLedger && (
            <button
              type="button"
              onClick={onNavigateLedger}
              className="min-h-[42px] px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap cursor-pointer"
            >
              Open Due Ledger
            </button>
          )}
          <button
            type="button"
            onClick={openCreate}
            className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer / Shop</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Total Accounts</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {customers.length}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">{metrics.wholesaleCount} wholesale shops</p>
        </div>
        <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Total Billed Sales</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-emerald-700 tabular-nums">
            {formatBDT(metrics.totalSpend, false)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">POS + SR deliveries</p>
        </div>
        <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Total Due (Baki)</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-red-700 tabular-nums">
            {formatBDT(metrics.totalDue, false)}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">Market receivables</p>
        </div>
        <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Loyalty Points</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {metrics.totalPoints.toLocaleString()}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">1 pt per ৳100</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by shop name, customer name, market route, or phone..."
            className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-emerald-700"
          />
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'wholesale', 'retail'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg capitalize cursor-pointer ${
                typeFilter === t
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t === 'wholesale' ? 'Retailer Shops' : t}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <Users className="w-9 h-9 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-800">No customers or retailer shops yet</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Add regular shoppers or wholesale retailer shops to attach them to POS bills, SR field
            orders, and Due/Baki ledgers.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
          >
            Add First Customer / Retailer
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Shop / Customer</th>
                  <th className="py-3 px-4">Market &amp; Phone</th>
                  <th className="py-3 px-4 text-right">Orders</th>
                  <th className="py-3 px-4 text-right">Lifetime Sales</th>
                  <th className="py-3 px-4 text-right">Due (Baki)</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((c) => {
                  const due = Number(c.balanceDue || 0);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">
                          {c.shopName ? c.shopName : c.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {c.shopName ? `${c.name} · ` : ''}
                          {c.customerType === 'wholesale' ? 'Wholesale Retailer' : 'Supermarket Member'}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <p className="text-slate-700">{c.marketArea || c.address || '—'}</p>
                        <p className="font-mono text-slate-500">{c.phone}</p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-700 tabular-nums">
                        {c.visitCount}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {formatBDT(c.totalSpent, false)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                        <span className={due > 0 ? 'text-red-700' : 'text-emerald-700'}>
                          {due > 0 ? formatBDT(due, false) : '৳ 0'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          {due > 0 && onNavigateLedger && (
                            <button
                              type="button"
                              onClick={onNavigateLedger}
                              className="px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md cursor-pointer"
                            >
                              Collect
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEdit(c)}
                            aria-label={`Edit ${c.name}`}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(c)}
                            aria-label={`Delete ${c.name}`}
                            className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-md cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
                {editing ? 'Edit Customer / Shop' : 'Add Customer or Retailer Shop'}
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
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'wholesale', label: 'Wholesale Retailer Shop' },
                    { id: 'retail', label: 'Supermarket Customer' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setForm({ ...form, customerType: opt.id })}
                    className={`min-h-[38px] px-2.5 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                      form.customerType === opt.id
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {form.customerType === 'wholesale' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Retailer Shop Name
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={form.shopName || ''}
                    onChange={(e) => setForm({ ...form, shopName: e.target.value })}
                    placeholder="e.g. Bismillah General Store"
                    className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Proprietor / Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Haji Abdul Karim"
                    className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={25}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="01812-000000"
                    className="w-full min-h-[42px] px-3 py-2 font-mono text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Market / Route Area
                  </label>
                  <select
                    value={form.marketArea || ''}
                    onChange={(e) => setForm({ ...form, marketArea: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                  >
                    <option value="">Local / Walk-in</option>
                    {RANGAMATI_ROUTES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Credit Limit (BDT)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={form.creditLimit || 0}
                    onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) })}
                    className="w-full min-h-[42px] px-3 py-2 font-mono text-xs border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Address (Optional)
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="e.g. Mainimukh Bazar, Dongudu, Rangamati"
                  className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
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
                {saving ? 'Saving...' : 'Save Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full max-w-sm rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900">Delete Account?</h3>
            <p className="text-sm text-slate-600">
              Remove <span className="font-semibold text-slate-900">{deleteTarget.name}</span> from
              the directory?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="min-h-[40px] px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
