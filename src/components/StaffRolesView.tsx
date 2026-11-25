import React, { useMemo, useState } from 'react';
import { Edit3, Plus, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import {
  RANGAMATI_ROUTES,
  STAFF_ROLES,
  type Branch,
  type Shop,
  type StaffMember,
  type StaffRole,
  formatBDT,
} from '../types/pos';
import {
  deleteStaffMember,
  upsertStaffMember,
  type StaffInput,
} from '../services/operationsService';
import { addShopMarketRoute } from '../services/posService';

interface StaffRolesViewProps {
  shop: Shop;
  branches: Branch[];
  activeBranchName: string;
  staff: StaffMember[];
}

export const StaffRolesView: React.FC<StaffRolesViewProps> = ({
  shop,
  branches,
  activeBranchName,
  staff,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [form, setForm] = useState<StaffInput>({
    name: '',
    phone: '',
    role: 'sr',
    branchName: activeBranchName,
    routeArea: RANGAMATI_ROUTES[0],
    commissionRate: 2.5,
    monthlySalary: 14000,
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [addingRoute, setAddingRoute] = useState(false);
  const [newRouteName, setNewRouteName] = useState('');
  const [savingRoute, setSavingRoute] = useState(false);
  const marketRoutes = Array.from(new Set([...RANGAMATI_ROUTES, ...(shop.marketRoutes || []), ...(form.routeArea ? [form.routeArea] : [])]));

  const handleAddRoute = async () => {
    if (!newRouteName.trim() || savingRoute) return;
    setSavingRoute(true);
    try {
      await addShopMarketRoute(shop.id, marketRoutes, newRouteName);
      setForm((current) => ({ ...current, routeArea: newRouteName.trim() }));
      setNewRouteName('');
      setAddingRoute(false);
    } finally {
      setSavingRoute(false);
    }
  };

  const metrics = useMemo(() => {
    const active = staff.filter((s) => s.isActive);
    const activeSrs = active.filter((s) => s.role === 'sr').length;
    const payroll = active.reduce((sum, s) => sum + s.monthlySalary, 0);
    return { total: staff.length, activeCount: active.length, activeSrs, payroll };
  }, [staff]);

  const openCreate = (presetRole: StaffRole = 'sr') => {
    setEditing(null);
    setForm({
      name: '',
      phone: '',
      role: presetRole,
      branchName: activeBranchName,
      routeArea: presetRole === 'sr' ? RANGAMATI_ROUTES[0] : '',
      commissionRate: presetRole === 'sr' ? 2.5 : 0,
      monthlySalary: 14000,
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEdit = (member: StaffMember) => {
    setEditing(member);
    setForm({
      name: member.name,
      phone: member.phone,
      role: member.role,
      branchName: member.branchName,
      routeArea: member.routeArea || '',
      commissionRate: Number(member.commissionRate || 0),
      monthlySalary: member.monthlySalary,
      isActive: member.isActive,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || saving) return;
    setSaving(true);
    try {
      await upsertStaffMember(shop.id, shop.ownerId, form, editing?.id);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = (r: StaffRole) => STAFF_ROLES.find((x) => x.id === r)?.label || r;

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">
            Staff, Field SRs &amp; Commissions
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Assign Field Sales Representatives (SRs) with market routes and commission rates, plus
            supermarket cashiers and managers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openCreate('cashier')}
            className="min-h-[42px] px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap cursor-pointer"
          >
            + Add Counter Staff
          </button>
          <button
            type="button"
            onClick={() => openCreate('sr')}
            className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Field SR</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 border border-slate-200 bg-white rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-4">
          <p className="text-xs text-slate-500">Total Team</p>
          <p className="mt-1 font-mono text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
            {metrics.total}
          </p>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500">Active Field SRs</p>
          <p className="mt-1 font-mono text-lg sm:text-xl font-bold text-emerald-700 tabular-nums">
            {metrics.activeSrs}
          </p>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500">Active On Duty</p>
          <p className="mt-1 font-mono text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
            {metrics.activeCount}
          </p>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500">Monthly Base Payroll</p>
          <p className="mt-1 font-mono text-lg sm:text-xl font-bold text-slate-900 tabular-nums">
            {formatBDT(metrics.payroll, false)}
          </p>
        </div>
      </div>

      {/* Role Permission Reference */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {STAFF_ROLES.map((r) => (
          <div key={r.id} className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <p className="text-xs font-bold text-slate-900">{r.label}</p>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">{r.permissions}</p>
          </div>
        ))}
      </div>

      {staff.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <Users className="w-9 h-9 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-800">No staff or Field SRs added yet</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Add your Field SRs with their Rangamati market routes and commission %, or add counter
            cashiers for shift reconciliation.
          </p>
          <button
            type="button"
            onClick={() => openCreate('sr')}
            className="min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg cursor-pointer"
          >
            Add First Field SR
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Team Member</th>
                  <th className="py-3 px-4">Role &amp; Route / Branch</th>
                  <th className="py-3 px-4 text-right">Commission</th>
                  <th className="py-3 px-4 text-right">Base Salary</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {staff.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{m.name}</p>
                      <p className="text-xs font-mono text-slate-500">{m.phone}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">
                      <p className="font-semibold text-slate-900">{roleLabel(m.role)}</p>
                      <p className="text-slate-500">
                        {m.role === 'sr' && m.routeArea ? `Route: ${m.routeArea}` : m.branchName}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-emerald-700 font-semibold tabular-nums">
                      {m.role === 'sr' ? `${Number(m.commissionRate || 0)}%` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums">
                      {formatBDT(m.monthlySalary, false)}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold">
                      <span className={m.isActive ? 'text-emerald-700' : 'text-slate-400'}>
                        {m.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(m)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteStaffMember(shop.id, m.id)}
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
                {editing ? 'Edit Team Member' : 'Add Staff / Field SR'}
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
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg"
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
                    placeholder="01811-000000"
                    className="w-full min-h-[42px] px-3 py-2 font-mono text-xs border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}
                    className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                  >
                    {STAFF_ROLES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Branch</label>
                  <select
                    value={form.branchName}
                    onChange={(e) => setForm({ ...form, branchName: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                  >
                    {branches.length > 0 ? (
                      branches.map((b) => (
                        <option key={b.id} value={b.name}>
                          {b.name}
                        </option>
                      ))
                    ) : (
                      <option value={activeBranchName}>{activeBranchName}</option>
                    )}
                  </select>
                </div>
              </div>

              {form.role === 'sr' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Assigned Market Route
                    </label>
                    <select
                      value={form.routeArea || RANGAMATI_ROUTES[0]}
                      onChange={(e) => setForm({ ...form, routeArea: e.target.value })}
                      className="w-full min-h-[40px] px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xs"
                    >
                      {marketRoutes.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => setAddingRoute((open) => !open)} className="mt-1 text-[11px] font-semibold text-emerald-800 hover:underline">{addingRoute ? 'Cancel' : '+ Add market route'}</button>
                    {addingRoute && <div className="mt-1 flex gap-1"><input value={newRouteName} onChange={(e) => setNewRouteName(e.target.value)} maxLength={120} placeholder="New market route" className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs"/><button type="button" disabled={savingRoute || !newRouteName.trim()} onClick={() => void handleAddRoute()} className="rounded-md bg-emerald-700 px-2 text-xs font-semibold text-white disabled:opacity-50">{savingRoute ? 'Saving…' : 'Save'}</button></div>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      SR Commission (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      step="0.25"
                      value={form.commissionRate ?? 2.5}
                      onChange={(e) => setForm({ ...form, commissionRate: Number(e.target.value) })}
                      className="w-full min-h-[40px] px-3 py-1.5 font-mono text-xs bg-white border border-slate-200 rounded-lg tabular-nums"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Monthly Salary (BDT)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={form.monthlySalary}
                    onChange={(e) => setForm({ ...form, monthlySalary: Number(e.target.value) })}
                    className="w-full min-h-[42px] px-3 py-2 font-mono text-xs border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="accent-emerald-700"
                />
                <span>Active team member</span>
              </label>
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
                {saving ? 'Saving...' : 'Save Member'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
