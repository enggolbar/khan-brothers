import React, { useEffect, useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import {
  SAAS_PLANS,
  type Branch,
  type PlanId,
  type Shop,
  formatBDT,
} from '../types/pos';
import {
  deleteBranch,
  updateShopPlan,
  updateShopProfile,
  upsertBranch,
  type BranchInput,
  type ShopProfileInput,
} from '../services/posService';

interface ShopSettingsViewProps {
  shop: Shop;
  branches: Branch[];
  activeBranchId: string;
  productCount: number;
  saleCount: number;
  onSelectBranch: (branchId: string) => void;
}

export const ShopSettingsView: React.FC<ShopSettingsViewProps> = ({
  shop,
  branches,
  activeBranchId,
  productCount,
  saleCount,
  onSelectBranch,
}) => {
  const [profile, setProfile] = useState<ShopProfileInput>({
    name: shop.name,
    branchName: shop.branchName,
    address: shop.address,
    phone: shop.phone,
    binNumber: shop.binNumber,
    defaultVatRate: shop.defaultVatRate,
    receiptFooter: shop.receiptFooter,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [updatingPlan, setUpdatingPlan] = useState<PlanId | null>(null);

  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [branchForm, setBranchForm] = useState<BranchInput>({
    name: '',
    code: '',
    address: '',
    phone: '',
    managerName: '',
    isActive: true,
  });
  const [savingBranch, setSavingBranch] = useState(false);

  useEffect(() => {
    setProfile({
      name: shop.name,
      branchName: shop.branchName,
      address: shop.address,
      phone: shop.phone,
      binNumber: shop.binNumber,
      defaultVatRate: shop.defaultVatRate,
      receiptFooter: shop.receiptFooter,
    });
  }, [shop]);

  const activePlan = SAAS_PLANS.find((p) => p.id === shop.plan) || SAAS_PLANS[1];

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateShopProfile(shop.id, profile);
      setSavedNotice(true);
      window.setTimeout(() => setSavedNotice(false), 2400);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSwitchPlan = async (planId: PlanId) => {
    if (planId === shop.plan || updatingPlan) return;
    setUpdatingPlan(planId);
    try {
      await updateShopPlan(shop.id, planId);
    } finally {
      setUpdatingPlan(null);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm.name.trim() || !branchForm.code.trim() || savingBranch) return;
    setSavingBranch(true);
    try {
      const createdId = await upsertBranch(shop.id, shop.ownerId, branchForm);
      onSelectBranch(createdId);
      setBranchModalOpen(false);
      setBranchForm({
        name: '',
        code: '',
        address: '',
        phone: '',
        managerName: '',
        isActive: true,
      });
    } finally {
      setSavingBranch(false);
    }
  };

  const handleDeleteBranch = async (branch: Branch) => {
    if (branches.length <= 1) return;
    await deleteBranch(shop.id, branch.id);
    if (branch.id === activeBranchId) {
      const next = branches.find((b) => b.id !== branch.id);
      if (next) onSelectBranch(next.id);
    }
  };

  const branchLimitReached = branches.length >= activePlan.maxBranches;

  return (
    <div className="space-y-8 pb-20 lg:pb-8">
      <div>
        <h1 className="font-display text-xl font-bold text-slate-900">
          Shop Profile, Branches &amp; SaaS Plan
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure Mushak-6.3 VAT details, manage retail outlets, and monitor SaaS subscription
          quotas.
        </p>
      </div>

      {/* Store Identity & VAT Configuration */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              Store Identity &amp; Receipt Settings
            </h2>
            <p className="text-xs text-slate-500">
              Printed on every 80mm thermal tax invoice &amp; SR Delivery Challan
            </p>
          </div>
          <div className="flex items-center gap-3">
            {profile.name !== 'M/S Khan Brothers' && (
              <button
                type="button"
                onClick={() =>
                  setProfile((prev) => ({
                    ...prev,
                    name: 'M/S Khan Brothers',
                    branchName: 'Mainimukh Bazar — Supermarket & Distribution',
                    address: 'Mainimukh Bazar, Dongudu, Rangamati',
                    receiptFooter:
                      'M/S Khan Brothers — Supermarket & Distributorship, Mainimukh Bazar, Rangamati.',
                  }))
                }
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg cursor-pointer"
              >
                Fill M/S Khan Brothers Details
              </button>
            )}
            {savedNotice && (
              <span className="text-xs font-semibold text-emerald-700">Changes saved</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Super Shop Name
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Primary Branch Label
            </label>
            <input
              type="text"
              required
              maxLength={80}
              value={profile.branchName}
              onChange={(e) => setProfile({ ...profile, branchName: e.target.value })}
              className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              NBR VAT BIN Number (Mushak-6.3)
            </label>
            <input
              type="text"
              maxLength={40}
              value={profile.binNumber}
              onChange={(e) => setProfile({ ...profile, binNumber: e.target.value })}
              placeholder="004829104-0203"
              className="w-full min-h-[42px] px-3 py-2 font-mono text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Contact Phone
              </label>
              <input
                type="tel"
                maxLength={25}
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="w-full min-h-[42px] px-3 py-2 font-mono text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default VAT (%)
              </label>
              <input
                type="number"
                min="0"
                max="30"
                step="0.5"
                value={profile.defaultVatRate}
                onChange={(e) =>
                  setProfile({ ...profile, defaultVatRate: Number(e.target.value) })
                }
                className="w-full min-h-[42px] px-3 py-2 font-mono text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700 tabular-nums"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Store Street Address
            </label>
            <input
              type="text"
              maxLength={240}
              value={profile.address}
              onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Receipt Footer Note
            </label>
            <input
              type="text"
              maxLength={200}
              value={profile.receiptFooter}
              onChange={(e) => setProfile({ ...profile, receiptFooter: e.target.value })}
              className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={savingProfile}
            className="min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg cursor-pointer"
          >
            {savingProfile ? 'Saving...' : 'Save Store Profile'}
          </button>
        </div>
      </form>

      {/* Multi-Branch Outlets */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              Branches &amp; Counter Terminals
            </h2>
            <p className="text-xs text-slate-500">
              Using {branches.length} of {activePlan.maxBranches} branch slots on {activePlan.name}
            </p>
          </div>
          <button
            type="button"
            disabled={branchLimitReached}
            onClick={() => setBranchModalOpen(true)}
            className="min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{branchLimitReached ? 'Plan Branch Limit Reached' : 'Add Branch'}</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {branches.map((branch) => {
            const isSelected = branch.id === activeBranchId;
            return (
              <div
                key={branch.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {branch.name}{' '}
                    <span className="font-mono text-xs text-slate-500">· {branch.code}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {branch.address || 'No address'} · Manager: {branch.managerName || 'Unassigned'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectBranch(branch.id)}
                    className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {isSelected ? 'Active Register' : 'Switch Register'}
                  </button>
                  {branches.length > 1 && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteBranch(branch)}
                      aria-label={`Delete ${branch.name}`}
                      className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-slate-400 hover:text-red-700 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SaaS Plan & Quota Metering */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="font-display text-base font-bold text-slate-900">
            SaaS Subscription &amp; Usage Quotas
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Current Plan: <span className="font-semibold text-slate-900">{activePlan.name}</span> ·{' '}
            {formatBDT(activePlan.monthlyPriceBdt, false)}/month
          </p>
        </div>

        {/* Live Usage Bars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Active SKUs', used: productCount, max: activePlan.maxSkus },
            { label: 'Synced Branches', used: branches.length, max: activePlan.maxBranches },
            { label: 'Invoices Logged', used: saleCount, max: activePlan.maxMonthlyInvoices },
          ].map((meter) => {
            const pct = Math.min(100, Math.round((meter.used / meter.max) * 100));
            return (
              <div key={meter.label} className="p-4 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-medium text-slate-700">{meter.label}</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {meter.used.toLocaleString()} / {meter.max.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-700 rounded-full"
                    style={{ width: `${Math.max(meter.used > 0 ? 3 : 0, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Plan Switcher Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SAAS_PLANS.map((plan) => {
            const isCurrent = plan.id === shop.plan;
            return (
              <div
                key={plan.id}
                className={`p-5 rounded-xl border flex flex-col justify-between ${
                  isCurrent ? 'border-emerald-700 bg-emerald-50/30' : 'border-slate-200 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-display text-base font-bold text-slate-900">{plan.name}</h3>
                    {isCurrent && (
                      <span className="text-xs font-semibold text-emerald-700">Active</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{plan.audience}</p>
                  <p className="mt-3 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {formatBDT(plan.monthlyPriceBdt, false)}
                    <span className="text-xs font-sans font-normal text-slate-500"> /mo</span>
                  </p>
                  <ul className="mt-3 space-y-2 text-xs text-slate-700">
                    {plan.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  disabled={isCurrent || updatingPlan !== null}
                  onClick={() => void handleSwitchPlan(plan.id)}
                  className={`mt-5 w-full min-h-[40px] px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-500 cursor-default'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {isCurrent
                    ? 'Current Plan'
                    : updatingPlan === plan.id
                      ? 'Updating...'
                      : `Switch to ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Branch Modal */}
      {branchModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleCreateBranch}
            className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border border-slate-200 overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900">Add Retail Branch</h3>
              <button
                type="button"
                onClick={() => setBranchModalOpen(false)}
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Branch Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={branchForm.name}
                  onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                  placeholder="e.g. Uttara Sector 11 Outlet"
                  className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Branch Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={20}
                    value={branchForm.code}
                    onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })}
                    placeholder="DHK-02"
                    className="w-full min-h-[42px] px-3 py-2 font-mono text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Manager Name
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={branchForm.managerName}
                    onChange={(e) => setBranchForm({ ...branchForm, managerName: e.target.value })}
                    placeholder="e.g. Mahmudul Hasan"
                    className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                <input
                  type="tel"
                  maxLength={25}
                  value={branchForm.phone}
                  onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                  placeholder="01811-000000"
                  className="w-full min-h-[42px] px-3 py-2 font-mono text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  maxLength={200}
                  value={branchForm.address}
                  onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                  placeholder="Sonargaon Janapath, Uttara, Dhaka"
                  className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 pb-safe">
              <button
                type="button"
                onClick={() => setBranchModalOpen(false)}
                className="min-h-[42px] px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingBranch}
                className="min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
              >
                {savingBranch ? 'Creating...' : 'Add Branch'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
