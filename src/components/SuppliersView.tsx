import React, { useMemo, useState } from 'react';
import { Edit3, Plus, Search, Trash2, Truck, X } from 'lucide-react';
import { PRODUCT_CATEGORIES, type Shop, type Supplier, formatBDT } from '../types/pos';
import {
  deleteSupplier,
  seedBangladeshSuppliers,
  settleSupplierBalance,
  upsertSupplier,
  type SupplierInput,
} from '../services/operationsService';

interface SuppliersViewProps {
  shop: Shop;
  suppliers: Supplier[];
}

const EMPTY_SUPPLIER: SupplierInput = {
  name: '',
  company: '',
  phone: '',
  address: '',
  category: 'Groceries',
};

export const SuppliersView: React.FC<SuppliersViewProps> = ({ shop, suppliers }) => {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierInput>(EMPTY_SUPPLIER);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [payTarget, setPayTarget] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.company.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
    );
  }, [suppliers, search]);

  const totals = useMemo(() => {
    let purchased = 0;
    let due = 0;
    for (const s of suppliers) {
      purchased += s.totalPurchased;
      due += s.balanceDue;
    }
    return { purchased, due };
  }, [suppliers]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || saving) return;
    setSaving(true);
    try {
      await upsertSupplier(shop.id, shop.ownerId, form, editing?.id);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handlePayDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTarget) return;
    const amt = Number(payAmount) || 0;
    if (amt <= 0) return;
    await settleSupplierBalance(shop.id, payTarget, amt);
    setPayTarget(null);
    setPayAmount('');
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedBangladeshSuppliers(shop.id, shop.ownerId);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">
            Suppliers &amp; Distributors
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage FMCG wholesalers, delivery contacts, purchase totals, and payable dues in BDT.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {suppliers.length === 0 && (
            <button
              type="button"
              disabled={seeding}
              onClick={() => void handleSeed()}
              className="min-h-[42px] px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap cursor-pointer"
            >
              {seeding ? 'Loading...' : 'Load BD Distributors'}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setForm(EMPTY_SUPPLIER);
              setModalOpen(true);
            }}
            className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Active Suppliers</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {suppliers.length}
          </p>
        </div>
        <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Total Purchased</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {formatBDT(totals.purchased, false)}
          </p>
        </div>
        <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Payable Balance Due</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-amber-700 tabular-nums">
            {formatBDT(totals.due, false)}
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search distributor company, contact person, or phone..."
            className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-emerald-700"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <Truck className="w-9 h-9 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-800">No suppliers added yet</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Add wholesale distributors to raise Purchase Orders and track payable dues.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <button
              type="button"
              disabled={seeding}
              onClick={() => void handleSeed()}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
            >
              Load Sample BD Distributors
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Distributor &amp; Contact</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4 text-right">Purchased</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{s.company || s.name}</p>
                      <p className="text-xs text-slate-500">
                        {s.name}
                        {s.address ? ` · ${s.address}` : ''}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">{s.category}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700">{s.phone}</td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-slate-800 tabular-nums">
                      {formatBDT(s.totalPurchased, false)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums ${
                        s.balanceDue > 0 ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {formatBDT(s.balanceDue, false)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {s.balanceDue > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setPayTarget(s);
                              setPayAmount(String(s.balanceDue));
                            }}
                            className="px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md cursor-pointer"
                          >
                            Pay Due
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(s);
                            setForm({
                              name: s.name,
                              company: s.company,
                              phone: s.phone,
                              address: s.address,
                              category: s.category,
                            });
                            setModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(s)}
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
                {editing ? 'Edit Supplier' : 'Add Supplier'}
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
                  Company / Distributor Name
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="e.g. ACI Consumer Distribution"
                  className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    maxLength={25}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="01711-000000"
                    className="w-full min-h-[42px] px-3 py-2 font-mono text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  {PRODUCT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Warehouse / Market Address
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="e.g. Moulvibazar, Old Dhaka"
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
                {saving ? 'Saving...' : 'Save Supplier'}
              </button>
            </div>
          </form>
        </div>
      )}

      {payTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handlePayDue}
            className="bg-white w-full max-w-sm rounded-xl border border-slate-200 p-5 space-y-4"
          >
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                Record Supplier Payment
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {payTarget.company || payTarget.name} · Current Due:{' '}
                {formatBDT(payTarget.balanceDue)}
              </p>
            </div>
            <input
              type="number"
              min="1"
              max={payTarget.balanceDue}
              step="0.01"
              required
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 font-mono text-sm border border-slate-200 rounded-lg tabular-nums"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPayTarget(null)}
                className="min-h-[40px] px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg cursor-pointer"
              >
                Confirm Payment
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
            <h3 className="font-display text-base font-bold text-slate-900">Delete Supplier?</h3>
            <p className="text-sm text-slate-600">
              Remove <span className="font-semibold">{deleteTarget.company || deleteTarget.name}</span>{' '}
              from your supplier directory?
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
                onClick={() => {
                  void deleteSupplier(shop.id, deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-red-700 rounded-lg cursor-pointer"
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
