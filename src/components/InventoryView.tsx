import React, { useMemo, useState } from 'react';
import {
  Barcode,
  Edit3,
  ImagePlus,
  PackagePlus,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { BANGLADESH_GROCERY_BRANDS, brandLogoUrl as getCatalogBrandLogo } from '../data/bangladeshBrands';
import { BrandLogo } from './BrandLogo';
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

interface BrandOption {
  name: string;
  logoUrl?: string;
  logoDataUrl?: string;
}

const EMPTY_FORM: ProductInput = {
  name: '',
  brand: '',
  brandLogoDataUrl: '',
  brandLogoUrl: '',
  description: '',
  imageDataUrl: '',
  barcode: '',
  sku: '',
  category: 'Groceries',
  unit: 'pcs',
  unitQuantity: 1,
  secondaryUnit: '',
  secondaryUnitQuantity: 0,
  priceUnit: 'pcs',
  costPrice: 0,
  sellingPrice: 0,
  vatRate: 5,
  stock: 0,
  reorderLevel: 10,
  isActive: true,
};
const CUSTOM_CATEGORY_OPTION = '__add_custom_category__';

export const InventoryView: React.FC<InventoryViewProps> = ({ shop, products }) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductInput>(EMPTY_FORM);
  const [brandPickerOpen, setBrandPickerOpen] = useState(false);
  const [customCategory, setCustomCategory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [restockDelta, setRestockDelta] = useState('10');
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const categories = useMemo(() => {
    const known = new Set<string>(PRODUCT_CATEGORIES);
    const existing = products.map((product) => product.category).filter(Boolean);
    const extra = Array.from(new Set(existing.filter((category) => !known.has(category)))).sort((a, b) => a.localeCompare(b));
    return [...PRODUCT_CATEGORIES, ...extra];
  }, [products]);
  const brandOptions = useMemo(() => {
    const brands = new Map<string, BrandOption>();
    for (const brand of BANGLADESH_GROCERY_BRANDS) {
      brands.set(brand.name.toLocaleLowerCase(), { name: brand.name, logoUrl: getCatalogBrandLogo(brand.domain) });
    }
    for (const product of products) {
      const name = product.brand?.trim();
      if (!name) continue;
      const key = name.toLocaleLowerCase();
      const current = brands.get(key);
      brands.set(key, {
        name: current?.name || name,
        logoUrl: product.brandLogoUrl || current?.logoUrl,
        logoDataUrl: product.brandLogoDataUrl || current?.logoDataUrl,
      });
    }
    return Array.from(brands.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

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
        (p.brand || '').toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      );
    });
  }, [products, search, categoryFilter, stockFilter]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setCustomCategory(false);
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
    setCustomCategory(false);
    setForm({
      name: product.name,
      brand: product.brand || '',
      brandLogoDataUrl: product.brandLogoDataUrl || '',
      brandLogoUrl: product.brandLogoUrl || brandOptions.find((brand) => brand.name.toLocaleLowerCase() === product.brand?.trim().toLocaleLowerCase())?.logoUrl || '',
      description: product.description || '',
      imageDataUrl: product.imageDataUrl || '',
      barcode: product.barcode,
      sku: product.sku,
      category: product.category,
      unit: product.unit,
      unitQuantity: product.unitQuantity || 1,
      secondaryUnit: product.secondaryUnit || '',
      secondaryUnitQuantity: product.secondaryUnitQuantity || 0,
      priceUnit: product.priceUnit || 'unit',
      costPrice: product.priceUnit === 'pcs' ? product.costPrice / (product.unitQuantity || 1) : product.costPrice,
      sellingPrice: product.priceUnit === 'pcs' ? product.sellingPrice / (product.unitQuantity || 1) : product.sellingPrice,
      vatRate: product.vatRate,
      stock: product.stock,
      reorderLevel: product.reorderLevel,
      isActive: product.isActive,
    });
    setModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.category.trim() || saving) return;
    setSaving(true);
    try {
      await upsertProduct(shop.id, shop.ownerId, form, editingProduct?.id);
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleProductImage = async (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      window.alert('JPG, PNG বা WebP ছবি নির্বাচন করুন।');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      window.alert('ছবির আকার ৮ MB-এর কম হতে হবে।');
      return;
    }
    const source = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('ছবি পড়া যায়নি।'));
      reader.readAsDataURL(file);
    });
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('ছবিটি খোলা যায়নি।'));
      element.src = source;
    });
    const scale = Math.min(1, 600 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    setForm((current) => ({ ...current, imageDataUrl: canvas.toDataURL('image/jpeg', 0.78) }));
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
            {categories.map((c) => (
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
                          <div className="flex items-center gap-2.5">
                            {p.imageDataUrl && <img src={p.imageDataUrl} alt="" className="h-10 w-10 rounded-lg border border-slate-200 object-cover" />}
                            <div><p className="font-medium text-slate-900">{p.name}</p>
                              <p className="text-xs font-mono text-slate-500 tabular-nums">{p.brand ? `${p.brand} · ` : ''}{p.barcode} · {p.sku}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {p.category} · {p.secondaryUnit ? `1 ${p.unit} = ${p.secondaryUnitQuantity || 0} ${p.secondaryUnit}` : p.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs text-slate-600 tabular-nums">
                          {formatBDT(p.costPrice)} / {p.unit}{p.secondaryUnit ? <span className="block text-[10px] text-slate-500">{formatBDT(p.costPrice / (p.secondaryUnitQuantity || 1))} / {p.secondaryUnit}</span> : null}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {formatBDT(p.sellingPrice)} / {p.unit}{p.secondaryUnit ? <span className="block text-[10px] text-slate-500">{formatBDT(p.sellingPrice / (p.secondaryUnitQuantity || 1))} / {p.secondaryUnit}</span> : null}
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
                            {p.stock} {p.unit}{p.secondaryUnit ? ` (${Number((p.stock * (p.secondaryUnitQuantity || 0)).toFixed(2))} ${p.secondaryUnit})` : ''}
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
                    {p.imageDataUrl && <img src={p.imageDataUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                      {p.brand && <p className="text-[11px] text-slate-500">{p.brand}</p>}
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
                        aria-label={`Edit ${p.name}`}
                        className="min-h-[36px] px-2.5 py-1 text-slate-700 border border-slate-200 rounded-lg"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(p)}
                        aria-label={`Delete ${p.name}`}
                        title="Delete product"
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-red-600 border border-red-100 bg-red-50 rounded-lg hover:bg-red-100"
                      >
                        <Trash2 className="w-4 h-4" />
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
            className="bg-white w-full sm:max-w-2xl max-h-[92vh] rounded-t-2xl sm:rounded-xl border border-slate-200 flex flex-col overflow-hidden"
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
              <div className="grid grid-cols-1 sm:grid-cols-[132px_1fr] gap-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {form.imageDataUrl ? <img src={form.imageDataUrl} alt="Product preview" className="h-full w-full object-cover" /> : <ImagePlus className="h-8 w-8 text-slate-300" />}
                </div>
                <div className="flex flex-col justify-center gap-2">
                  <label className="text-xs font-semibold text-slate-700">Product photo</label>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void handleProductImage(e.target.files?.[0]).catch(() => window.alert('ছবিটি লোড করা যায়নি।'))} className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-3 file:py-2 file:font-semibold file:text-white" />
                  <p className="text-[11px] text-slate-500">JPG, PNG বা WebP · সর্বোচ্চ ৮ MB; সংরক্ষণের আগে ছোট করা হবে।</p>
                  {form.imageDataUrl && <button type="button" onClick={() => setForm({ ...form, imageDataUrl: '' })} className="self-start text-xs font-semibold text-rose-700">ছবি সরান</button>}
                </div>
              </div>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Brand / Manufacturer <span className="font-normal text-slate-500">· POS brand folder</span></label>
                  <button
                    type="button"
                    onClick={() => setBrandPickerOpen(true)}
                    className="flex min-h-[50px] w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  >
                    {form.brand ? <BrandLogo name={form.brand} imageDataUrl={form.brandLogoDataUrl} logoUrl={form.brandLogoUrl} className="h-8 w-8" /> : <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-dashed border-slate-300 text-slate-400">+</span>}
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{form.brand || 'ব্র্যান্ড নির্বাচন করুন বা নতুন ব্র্যান্ড যোগ করুন'}</span>
                    <span className="text-xs font-semibold text-emerald-700">Select</span>
                  </button>
                  <p className="mt-1 text-[10px] text-slate-500">ব্র্যান্ডের লোগো POS-এর Brand List ফোল্ডারেও দেখাবে।</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Product Description</label>
                  <input type="text" maxLength={500} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="স্বাদ, ধরন বা প্যাকের বিবরণ" className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700" />
                </div>
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
                    value={customCategory ? CUSTOM_CATEGORY_OPTION : form.category}
                    onChange={(e) => {
                      const isCustom = e.target.value === CUSTOM_CATEGORY_OPTION;
                      setCustomCategory(isCustom);
                      if (!isCustom) setForm({ ...form, category: e.target.value });
                      else setForm({ ...form, category: '' });
                    }}
                    className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-emerald-700"
                  >
                    <option value="" disabled>Select a category</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value={CUSTOM_CATEGORY_OPTION}>+ Add custom category…</option>
                  </select>
                  {customCategory && (
                    <input
                      type="text"
                      required
                      maxLength={50}
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      placeholder="Enter grocery category"
                      className="mt-2 w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-emerald-700"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">Unit Table</label>
                  <div className="grid grid-cols-[1fr_110px] gap-2">
                    <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3">
                      {['pcs','unit','carton','packet','pack','dozen','box','case','bag','bottle','can','jar','sachet','pair','set','kg','g','mg','L','ml','meter','cm','roll','tray','bundle'].map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                    </select>
                    <input aria-label="Pieces or units per selected unit" type="number" min="1" step="1" value={form.unitQuantity ?? ''} onChange={(e) => setForm({ ...form, unitQuantity: e.target.value === '' ? '' : Number(e.target.value) })} className="min-h-[42px] rounded-lg border border-slate-200 px-3" />
                  </div>
                  <div className="grid grid-cols-[1fr_110px] gap-2">
                    <select value={form.secondaryUnit || ''} onChange={(e) => setForm({ ...form, secondaryUnit: e.target.value })} className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3">
                      <option value="">Second unit (optional)</option>
                      {['pcs','unit','carton','packet','pack','dozen','box','case','bag','bottle','can','jar','sachet','pair','set','kg','g','mg','L','ml','meter','cm','roll','tray','bundle'].map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                    </select>
                    <input aria-label="Pieces or units per second unit" type="number" min="0" step="1" value={form.secondaryUnitQuantity ?? ''} onChange={(e) => setForm({ ...form, secondaryUnitQuantity: e.target.value === '' ? '' : Number(e.target.value) })} disabled={!form.secondaryUnit} placeholder="Qty" className="min-h-[42px] rounded-lg border border-slate-200 px-3 disabled:bg-slate-100" />
                  </div>
                  <p className="text-[10px] text-slate-500">Enter how many pcs or base units each selected unit contains.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                    onChange={(e) => setForm({ ...form, costPrice: e.target.value === '' ? '' : Number(e.target.value) })}
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
                    onChange={(e) => setForm({ ...form, sellingPrice: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full min-h-[42px] px-3 py-2 font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Price entered per</label>
                  <select value={form.priceUnit || 'pcs'} onChange={(e) => setForm({ ...form, priceUnit: e.target.value as 'pcs' | 'unit' })} className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg bg-white">
                    <option value="pcs">Piece (pcs)</option><option value="unit">Selected unit ({form.unit})</option>
                  </select>
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
                    onChange={(e) => setForm({ ...form, stock: e.target.value === '' ? '' : Number(e.target.value) })}
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
                    onChange={(e) => setForm({ ...form, reorderLevel: e.target.value === '' ? '' : Number(e.target.value) })}
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

      {brandPickerOpen && (
        <BrandPickerModal
          brands={brandOptions}
          onClose={() => setBrandPickerOpen(false)}
          onSelect={(brand) => {
            setForm((current) => ({
              ...current,
              brand: brand.name,
              brandLogoDataUrl: brand.logoDataUrl || '',
              brandLogoUrl: brand.logoUrl || '',
            }));
            setBrandPickerOpen(false);
          }}
        />
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

interface BrandPickerModalProps {
  brands: BrandOption[];
  onClose: () => void;
  onSelect: (brand: BrandOption) => void;
}

const BrandPickerModal: React.FC<BrandPickerModalProps> = ({ brands, onClose, onSelect }) => {
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [brandName, setBrandName] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [logoError, setLogoError] = useState('');
  const filtered = brands.filter((brand) => brand.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  const readLogo = async (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      setLogoError('JPG, PNG বা WebP লোগো দিন; ফাইল ৪ MB-এর কম হতে হবে।');
      return;
    }
    setLogoError('');
    const source = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('লোগো পড়া যায়নি।'));
      reader.readAsDataURL(file);
    });
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('লোগো খোলা যায়নি।'));
      element.src = source;
    });
    const scale = Math.min(1, 160 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    setLogoDataUrl(canvas.toDataURL('image/png'));
  };

  const submitNewBrand = (event: React.FormEvent) => {
    event.preventDefault();
    const name = brandName.trim();
    if (!name) return;
    const existing = brands.find((brand) => brand.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    onSelect(existing
      ? { ...existing, logoDataUrl: logoDataUrl || existing.logoDataUrl, logoUrl: logoDataUrl ? '' : existing.logoUrl }
      : { name, logoDataUrl });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="ব্র্যান্ড নির্বাচন">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900">ব্র্যান্ড নির্বাচন করুন</h3>
            <p className="mt-1 text-xs text-slate-500">বাংলাদেশে প্রচলিত গ্রোসারি ব্র্যান্ড খুঁজুন অথবা নিজে যোগ করুন।</p>
          </div>
          <button type="button" onClick={onClose} aria-label="বন্ধ করুন" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 border-b border-slate-100 p-4">
          <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ব্র্যান্ডের নাম লিখে খুঁজুন…" className="min-h-[42px] w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#0756A5]" />
          <button type="button" onClick={() => setAdding((value) => !value)} className="min-h-[40px] rounded-xl border border-dashed border-[#0756A5]/40 bg-blue-50 px-3 text-xs font-semibold text-[#0756A5] hover:bg-blue-100">
            {adding ? 'ব্র্যান্ড তালিকা থেকে নির্বাচন' : '+ তালিকায় নেই? নতুন ব্র্যান্ড ও লোগো যোগ করুন'}
          </button>
        </div>
        {adding ? (
          <form onSubmit={submitNewBrand} className="space-y-4 overflow-y-auto p-5">
            <label className="block text-xs font-semibold text-slate-700">নতুন ব্র্যান্ডের নাম
              <input autoFocus required maxLength={80} value={brandName} onChange={(event) => setBrandName(event.target.value)} placeholder="যেমন: স্থানীয় বা নতুন ব্র্যান্ড" className="mt-1.5 min-h-[42px] w-full rounded-xl border border-slate-200 px-3 text-sm font-normal outline-none focus:border-[#0756A5]" />
            </label>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              <BrandLogo name={brandName || 'Brand'} imageDataUrl={logoDataUrl} className="h-14 w-14" />
              <div className="min-w-0 flex-1">
                <label className="block text-xs font-semibold text-slate-700">ব্র্যান্ডের লোগো (ঐচ্ছিক)
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void readLogo(event.target.files?.[0]).catch(() => setLogoError('লোগোটি লোড করা যায়নি।'))} className="mt-1.5 block w-full text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-[#0756A5] file:px-3 file:py-2 file:font-semibold file:text-white" />
                </label>
                <p className="mt-1 text-[10px] text-slate-500">লোগো না দিলে নামের আদ্যক্ষর দিয়ে চিহ্ন দেখানো হবে।</p>
                {logoError && <p className="mt-1 text-[10px] text-rose-700">{logoError}</p>}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAdding(false)} className="min-h-[40px] rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-700">ফিরে যান</button>
              <button type="submit" disabled={!brandName.trim()} className="min-h-[40px] rounded-lg bg-[#0756A5] px-4 text-xs font-semibold text-white disabled:opacity-50">ব্র্যান্ড নির্বাচন</button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-2 overflow-y-auto p-4 sm:grid-cols-3">
            {filtered.map((brand) => (
              <button key={brand.name} type="button" onClick={() => onSelect(brand)} className="flex min-h-[62px] items-center gap-2.5 rounded-xl border border-slate-200 p-2.5 text-left hover:border-[#0756A5]/50 hover:bg-blue-50">
                <BrandLogo name={brand.name} imageDataUrl={brand.logoDataUrl} logoUrl={brand.logoUrl} className="h-10 w-10" />
                <span className="truncate text-xs font-semibold text-slate-800">{brand.name}</span>
              </button>
            ))}
            {filtered.length === 0 && <p className="col-span-full py-8 text-center text-sm text-slate-500">কোনো ব্র্যান্ড মেলেনি। উপরের বাটনে নতুন ব্র্যান্ড যোগ করুন।</p>}
          </div>
        )}
      </div>
    </div>
  );
};
