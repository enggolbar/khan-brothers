import React, { useMemo, useState } from 'react';
import { Barcode, Minus, Plus, Printer, Search } from 'lucide-react';
import { type Product, type Shop, formatBDT } from '../types/pos';

interface BarcodeLabelsViewProps {
  shop: Shop;
  products: Product[];
}

type StickerTemplate = 'thermal' | 'shelf' | 'carton';

// Deterministic visual bar pattern derived from EAN-13/SKU string
function renderBarcodeBars(code: string): number[] {
  const widths: number[] = [2, 1, 2];
  for (let i = 0; i < code.length; i++) {
    const n = code.charCodeAt(i) % 4;
    widths.push(n === 0 ? 1 : n === 1 ? 2 : n === 2 ? 3 : 1);
    widths.push((n % 2) + 1);
  }
  widths.push(2, 1, 2);
  return widths;
}

export const BarcodeLabelsView: React.FC<BarcodeLabelsViewProps> = ({ shop, products }) => {
  const [search, setSearch] = useState('');
  const [labelCounts, setLabelCounts] = useState<Record<string, number>>({});
  const [template, setTemplate] = useState<StickerTemplate>('shelf');
  const [showShopName, setShowShopName] = useState(true);
  const [showSku, setShowSku] = useState(true);
  const [showVatNote, setShowVatNote] = useState(true);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      );
    });
  }, [products, search]);

  const queueItems = useMemo(() => {
    const list: Product[] = [];
    for (const p of products) {
      const count = labelCounts[p.id] || 0;
      for (let i = 0; i < count; i++) {
        list.push(p);
      }
    }
    return list;
  }, [products, labelCounts]);

  const setCount = (productId: string, next: number) => {
    const clamped = Math.max(0, Math.min(48, next));
    setLabelCounts((prev) => ({ ...prev, [productId]: clamped }));
  };

  const handleAutoFillSample = () => {
    const next: Record<string, number> = {};
    for (const p of products.slice(0, 6)) {
      next[p.id] = 2;
    }
    setLabelCounts(next);
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">
            Commercial Barcode &amp; Shelf Sticker Studio
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Print GS1 894 thermal barcodes, supermarket shelf price talkers, and wholesale carton
            stickers branded for {shop.name}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {products.length > 0 && queueItems.length === 0 && (
            <button
              type="button"
              onClick={handleAutoFillSample}
              className="min-h-[42px] px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl whitespace-nowrap cursor-pointer"
            >
              Auto-Fill 12 Stickers
            </button>
          )}
          <button
            type="button"
            disabled={queueItems.length === 0}
            onClick={() => window.print()}
            className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-xl shadow-xs whitespace-nowrap cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Sticker Sheet ({queueItems.length})</span>
          </button>
        </div>
      </div>

      {/* Template Selector + Print Options Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="inline-flex p-1 bg-slate-100 rounded-xl self-start overflow-x-auto max-w-full">
          {(
            [
              { id: 'shelf', label: 'Shelf Price Tag' },
              { id: 'thermal', label: 'Thermal Barcode (38×25mm)' },
              { id: 'carton', label: 'Wholesale Carton Sticker' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTemplate(opt.id)}
              className={`min-h-[36px] px-3.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                template === opt.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showShopName}
              onChange={(e) => setShowShopName(e.target.checked)}
              className="accent-emerald-700"
            />
            <span>Store Branding</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showSku}
              onChange={(e) => setShowSku(e.target.checked)}
              className="accent-emerald-700"
            />
            <span>Show SKU &amp; Unit</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showVatNote}
              onChange={(e) => setShowVatNote(e.target.checked)}
              className="accent-emerald-700"
            />
            <span>VAT Note</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left SKU Picker */}
        <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search SKU, product name, or 894 barcode..."
                className="w-full min-h-[40px] pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-700"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto commercial-scroll">
            {filtered.length === 0 ? (
              <p className="p-6 text-xs text-slate-500 text-center">
                No products available. Add items in Products &amp; Stock first.
              </p>
            ) : (
              filtered.map((p) => {
                const count = labelCounts[p.id] || 0;
                return (
                  <div
                    key={p.id}
                    className={`px-4 py-3 flex items-center justify-between gap-3 text-xs transition-colors ${
                      count > 0 ? 'bg-emerald-50/40' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                      <p className="font-mono text-slate-500 mt-0.5 tabular-nums">
                        {p.barcode} · {formatBDT(p.sellingPrice, false)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setCount(p.id, count - 1)}
                        className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-100 cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center font-mono font-bold tabular-nums">
                        {count}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCount(p.id, count + 1)}
                        className="min-h-[34px] min-w-[34px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-100 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Printable Commercial Sticker Preview Sheet */}
        <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900">
                Live Print Sheet Preview
              </h2>
              <p className="text-xs text-slate-500">
                {queueItems.length} sticker{queueItems.length === 1 ? '' : 's'} queued ·{' '}
                {template === 'shelf'
                  ? 'Super Shop Shelf Price Tag'
                  : template === 'carton'
                    ? 'Wholesale Distribution Carton Label'
                    : 'Compact 38×25mm Thermal Barcode'}
              </p>
            </div>
            {queueItems.length > 0 && (
              <button
                type="button"
                onClick={() => setLabelCounts({})}
                className="text-xs font-semibold text-red-700 hover:text-red-800 cursor-pointer"
              >
                Clear Queue
              </button>
            )}
          </div>

          {queueItems.length === 0 ? (
            <div className="min-h-[300px] flex flex-col items-center justify-center text-center text-slate-500 space-y-2.5">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <Barcode className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-800">No stickers queued yet</p>
              <p className="text-xs max-w-xs">
                Use the + buttons on the left or click Auto-Fill 12 Stickers to preview and print
                shelf price tags or barcode labels.
              </p>
            </div>
          ) : (
            <div
              id="barcode-print-sheet"
              className={`grid gap-3 bg-slate-50 p-3.5 rounded-xl border border-dashed border-slate-300 ${
                template === 'thermal'
                  ? 'grid-cols-2 sm:grid-cols-3'
                  : template === 'shelf'
                    ? 'grid-cols-1 sm:grid-cols-2'
                    : 'grid-cols-1 sm:grid-cols-2'
              }`}
            >
              {queueItems.map((item, idx) => {
                const bars = renderBarcodeBars(item.barcode);

                if (template === 'shelf') {
                  return (
                    <div
                      key={`${item.id}-${idx}`}
                      className="bg-white border-2 border-slate-900 rounded-lg overflow-hidden break-inside-avoid flex flex-col justify-between"
                    >
                      {showShopName && (
                        <div className="bg-slate-900 text-white px-2.5 py-1.5 flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 min-w-0">
                            <img
                              src="/assets/aistudio/M_S_Khan_Brothers_Gold-Blue_Badge_cceec1db.png"
                              alt="M/S Khan Brothers"
                              className="w-4 h-4 rounded-full bg-white object-contain shrink-0"
                            />
                            <span className="text-[10px] font-bold uppercase tracking-wider truncate">
                              {shop.name}
                            </span>
                          </span>
                          <span className="font-mono text-[9px] text-emerald-300 shrink-0">
                            BDT MRP
                          </span>
                        </div>
                      )}
                      <div className="p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                            {item.name}
                          </p>
                          {showSku && (
                            <p className="font-mono text-[10px] text-slate-500 truncate">
                              {item.sku} · {item.unit}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0 pl-2 border-l border-slate-200">
                          <p className="font-mono text-lg font-extrabold text-slate-900 tabular-nums leading-none">
                            {formatBDT(item.sellingPrice, false)}
                          </p>
                          {showVatNote && item.vatRate > 0 && (
                            <p className="text-[9px] font-medium text-slate-500 mt-1">
                              +{item.vatRate}% VAT
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="px-3 pb-2.5 pt-1 border-t border-slate-100 flex items-center justify-between gap-2">
                        <div className="flex items-stretch h-6 overflow-hidden">
                          {bars.map((w, bIdx) => (
                            <div
                              key={bIdx}
                              style={{
                                width: `${w * 1.15}px`,
                                backgroundColor: bIdx % 2 === 0 ? '#0f172a' : 'transparent',
                              }}
                            />
                          ))}
                        </div>
                        <span className="font-mono text-[9px] tracking-wider text-slate-700 tabular-nums shrink-0">
                          {item.barcode}
                        </span>
                      </div>
                    </div>
                  );
                }

                if (template === 'carton') {
                  return (
                    <div
                      key={`${item.id}-${idx}`}
                      className="bg-white border-2 border-slate-900 rounded-lg p-3 space-y-2 break-inside-avoid"
                    >
                      {showShopName && (
                        <div className="border-b border-slate-900 pb-1.5 flex items-center gap-2">
                          <img
                            src="/assets/aistudio/M_S_Khan_Brothers_Gold-Blue_Badge_cceec1db.png"
                            alt="M/S Khan Brothers"
                            className="w-7 h-7 rounded-full object-contain shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-900 truncate">
                              {shop.name}
                            </p>
                            <p className="text-[9px] text-slate-600 truncate">{shop.address}</p>
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-slate-900 leading-tight">
                          {item.name}
                        </p>
                        {showSku && (
                          <p className="font-mono text-[10px] text-slate-600 mt-0.5">
                            SKU: {item.sku} · UNIT: {item.unit.toUpperCase()} · CAT: {item.category}
                          </p>
                        )}
                      </div>
                      <div className="flex items-end justify-between gap-3 pt-1">
                        <div className="space-y-0.5">
                          <div className="flex items-stretch h-9 overflow-hidden">
                            {bars.map((w, bIdx) => (
                              <div
                                key={bIdx}
                                style={{
                                  width: `${w * 1.25}px`,
                                  backgroundColor: bIdx % 2 === 0 ? '#0f172a' : 'transparent',
                                }}
                              />
                            ))}
                          </div>
                          <p className="font-mono text-[9px] tracking-widest text-slate-700 tabular-nums">
                            {item.barcode}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[9px] uppercase font-bold text-slate-500">
                            Unit MRP
                          </p>
                          <p className="font-mono text-base font-extrabold text-slate-900 tabular-nums">
                            {formatBDT(item.sellingPrice, false)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Compact Thermal Barcode (38x25mm)
                return (
                  <div
                    key={`${item.id}-${idx}`}
                    className="bg-white border border-slate-300 rounded-lg p-2.5 text-center space-y-1 break-inside-avoid"
                  >
                    {showShopName && (
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600 truncate">
                        {shop.name}
                      </p>
                    )}
                    <p className="text-[11px] font-semibold text-slate-900 leading-tight line-clamp-2 min-h-[28px]">
                      {item.name}
                    </p>
                    <div className="flex items-stretch justify-center h-9 px-1 pt-0.5 overflow-hidden">
                      {bars.map((w, bIdx) => (
                        <div
                          key={bIdx}
                          style={{
                            width: `${w * 1.35}px`,
                            backgroundColor: bIdx % 2 === 0 ? '#0f172a' : 'transparent',
                          }}
                        />
                      ))}
                    </div>
                    <p className="font-mono text-[9px] tracking-widest text-slate-700 tabular-nums">
                      {item.barcode}
                    </p>
                    <p className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                      MRP {formatBDT(item.sellingPrice, false)}
                      {showVatNote && item.vatRate > 0 ? (
                        <span className="text-[9px] font-normal text-slate-500"> +VAT</span>
                      ) : null}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
