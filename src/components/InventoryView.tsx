import React, { useMemo, useState } from 'react';
import {
  Barcode,
  Edit3,
  PackagePlus,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
  type Product,
  type Shop,
  formatBDT,
  generateBdBarcode,
} from '../types/pos';
import {
  adjustProductStock,
  deleteProduct,
  seedStarterCatalog,
  upsertProduct,
  type ProductInput,
} from '../services/posService';

interface InventoryViewProps {
  shop: Shop;
  products: Product[];
}

const EMPTY_FORM: ProductInput = {
  name: '',
  barcode: '',
  sku: '',
  category: 'Groceries',
  unit: 'pcs',
  costPrice: 0,
  sellingPrice: 0,
  vatRate: 5,
  stock: 0,
  reorderLevel: 10,
  isActive: true,
};

export const InventoryView: React.FC<InventoryViewProps> = ({ shop, products }) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [restockDelta, setRestockDelta] = useState('10');
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const metrics = useMemo(() => {
    let costValue = 0;
    let retailValue = 0;
    let lowCount = 0;
    let outCount = 0;
    for (const p of products) {
      costValue += p.costPrice * p.stock;
      retailValue += p.sellingPrice * p.stock;
      if (p.stock <= 0) outCount++;
      else if (p.stock <= p.reorderLevel) lowCount++;
    }
    return {
      totalSkus: products.length,
      costValue,
      retailValue,
      lowCount,
      outCount,
    };
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
      if (stockFilter === 'low' && !(p.stock > 0 && p.stock <= p.reorderLevel)) return false;
      if (stockFilter === 'out' && p.stock > 0) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      );
    });
  }, [products, search, categoryFilter, stockFilter]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setForm({
      ...EMPTY_FORM,
      barcode: generateBdBarcode(),
      sku: `SKU-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      vatRate: shop.defaultVatRate,
    });
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      barcode: product.barcode,
      sku: product.sku,
      category: product.category,
      unit: product.unit,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      vatRate: product.vatRate,
      stock: product.stock,
      reorderLevel: product.reorderLevel,
      isActive: product.isActive,
    });
    setModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || saving) return;
    setSaving(true);
    try {
      await upsertProduct(shop.id, shop.ownerId, form, editingProduct?.id);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockTarget) return;
    const delta = Number(restockDelta) || 0;
    const nextStock = Math.max(0, restockTarget.stock + delta);
    await adjustProductStock(shop.id, restockTarget.id, nextStock);
    setRestockTarget(null);
    setRestockDelta('10');
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteProduct(shop.id, deleteTarget.id);
    setDeleteTarget(null);
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedStarterCatalog(shop.id, shop.ownerId);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">Inventory &amp; Stock</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage SKUs, GS1 894 barcodes, VAT rates, and stock levels in BDT.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {products.length === 0 && (
            <button
              type="button"
              disabled={seeding}
              onClick={() => void handleSeed()}
              className="min-h-[42px] px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap cursor-pointer"
            >
              {seeding ? 'Loading...' : 'Load 18 BD Items'}
            </button>
          )}
          <button
            type="button"
            onClick={openCreateModal}
            className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Commercial KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Total SKUs</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {metrics.totalSkus}
          </p>
        </div>
        <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Stock Value (Cost)</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {formatBDT(metrics.costValue, false)}
          </p>
        </div>
        <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Retail Value</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-emerald-700 tabular-nums">
            {formatBDT(metrics.retailValue, false)}
          </p>
        </div>
        <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Reorder Alerts</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold tabular-nums text-amber-700">
            {metrics.lowCount} low · {metrics.outCount} out
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by product name, SKU, or 894 barcode..."
            className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-emerald-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="min-h-[40px] px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-emerald-700"
          >
            <option value="All">All Categories</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <div className="inline-flex p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'low', label: 'Low Stock' },
                { id: 'out', label: 'Out of Stock' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStockFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  stockFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Empty State */}
      {products.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <PackagePlus className="w-9 h-9 text-emerald-700 mx-auto" />
          <h2 className="font-display text-base font-bold text-slate-900">No products in inventory</h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Add your first super shop item or seed 18 popular Bangladesh retail SKUs to get started.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              disabled={seeding}
              onClick={() => void handleSeed()}
              className="min-h-[44px] px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
            >
              {seeding ? 'Loading Catalog...' : 'Load 18 BD Starter Products'}
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              Create Custom SKU
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop High-Density Table */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Product &amp; Barcode</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-right">Cost</th>
                    <th className="py-3 px-4 text-right">Sell Price</th>
                    <th className="py-3 px-4 text-right">VAT</th>
                    <th className="py-3 px-4 text-right">Stock</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((p) => {
                    const isOut = p.stock <= 0;
                    const isLow = !isOut && p.stock <= p.reorderLevel;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">{p.name}</p>
                          <p className="text-xs font-mono text-slate-500 tabular-nums">
                            {p.barcode} · {p.sku}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {p.category} · {p.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-slate-600 tabular-nums">
                          {formatBDT(p.costPrice)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {formatBDT(p.sellingPrice)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-slate-600 tabular-nums">
                          {p.vatRate}%
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs font-semibold tabular-nums">
                          <span
                            className={
                              isOut
                                ? 'text-red-700'
                                : isLow
                                  ? 'text-amber-700'
                                  : 'text-emerald-700'
                            }
                          >
                            {p.stock} {p.unit}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setRestockTarget(p);
                                setRestockDelta('10');
                              }}
                              className="px-2.5 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md cursor-pointer"
                            >
                              Restock
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(p)}
                              aria-label={`Edit ${p.name}`}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(p)}
                              aria-label={`Delete ${p.name}`}
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

          {/* Mobile Responsive Product Cards */}
          <div className="md:hidden space-y-2.5">
            {filtered.map((p) => {
              const isOut = p.stock <= 0;
              const isLow = !isOut && p.stock <= p.reorderLevel;
              return (
                <div
                  key={p.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        {p.barcode} · {p.category}
                      </p>
                    </div>
                    <p className="font-mono text-base font-bold text-slate-900 tabular-nums shrink-0">
                      {formatBDT(p.sellingPrice, false)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span
                      className={`font-mono font-semibold tabular-nums ${
                        isOut ? 'text-red-700' : isLow ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {isOut ? 'Out of stock' : `${p.stock} ${p.unit} in stock`} · VAT {p.vatRate}%
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRestockTarget(p);
                          setRestockDelta('10');
                        }}
                        className="min-h-[36px] px-3 py-1 font-semibold text-emerald-800 bg-emerald-50 rounded-lg"
                      >
                        Restock
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(p)}
                        className="min-h-[36px] px-2.5 py-1 text-slate-700 border border-slate-200 rounded-lg"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add / Edit Product Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveProduct}
            className="bg-white w-full sm:max-w-lg max-h-[92vh] rounded-t-2xl sm:rounded-xl border border-slate-200 flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Aarong Miniket Rice 5 kg"
                  className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Barcode (GS1 894)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      maxLength={48}
                      value={form.barcode}
                      onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                      className="flex-1 min-h-[42px] px-3 py-2 font-mono text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, barcode: generateBdBarcode() })}
                      title="Generate GS1 894 barcode"
                      className="min-h-[42px] px-2.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      <Barcode className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">SKU</label>
                  <input
                    type="text"
                    required
                    maxLength={40}
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 font-mono text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-emerald-700"
                  >
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
                  <input
                    type="text"
                    required
                    maxLength={20}
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="pcs / kg / L / pack"
                    className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cost (৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.costPrice}
                    onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })}
                    className="w-full min-h-[42px] px-3 py-2 font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sell Price (৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.sellingPrice}
                    onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })}
                    className="w-full min-h-[42px] px-3 py-2 font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">VAT (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    step="0.5"
                    required
                    value={form.vatRate}
                    onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) })}
                    className="w-full min-h-[42px] px-3 py-2 font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700 tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                    className="w-full min-h-[42px] px-3 py-2 font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Low-Stock Alert At
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={form.reorderLevel}
                    onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })}
                    className="w-full min-h-[42px] px-3 py-2 font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700 tabular-nums"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3 pb-safe">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-h-[42px] px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[42px] px-5 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg cursor-pointer"
              >
                {saving ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Restock Modal */}
      {restockTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleConfirmRestock}
            className="bg-white w-full max-w-sm rounded-xl border border-slate-200 p-5 space-y-4"
          >
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">Adjust Stock</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {restockTarget.name} · Current: {restockTarget.stock} {restockTarget.unit}
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quantity to add (use negative to deduct)
              </label>
              <input
                type="number"
                required
                value={restockDelta}
                onChange={(e) => setRestockDelta(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 font-mono text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700 tabular-nums"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestockTarget(null)}
                className="min-h-[40px] px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
              >
                Update Stock
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full max-w-sm rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900">Delete SKU?</h3>
            <p className="text-sm text-slate-600">
              Remove <span className="font-semibold text-slate-900">{deleteTarget.name}</span> from
              active inventory? Past invoices will remain intact.
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
                onClick={() => void handleConfirmDelete()}
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
