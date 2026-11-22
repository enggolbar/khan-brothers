import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  Plus,
  Printer,
  Search,
  Sparkles,
  Trash2,
  Truck,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import {
  RANGAMATI_ROUTES,
  type Customer,
  type Product,
  type Shop,
  type SrOrder,
  type SrOrderItem,
  type SrOrderPaymentMethod,
  type SrOrderStatus,
  type StaffMember,
  formatBDT,
  formatDateTimeBD,
} from '../types/pos';
import {
  approveSrOrder,
  cancelSrOrder,
  createSrOrder,
  deliverSrOrderBatch,
  seedRangamatiDistributionData,
} from '../services/operationsService';
import { upsertCustomer } from '../services/posService';

interface SrOrdersViewProps {
  shop: Shop;
  activeBranchName: string;
  products: Product[];
  customers: Customer[];
  staff: StaffMember[];
  srOrders: SrOrder[];
  onNavigateStaff: () => void;
}

const DELIVERY_METHODS: { id: SrOrderPaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'bkash', label: 'bKash' },
  { id: 'nagad', label: 'Nagad' },
  { id: 'rocket', label: 'Rocket' },
  { id: 'card', label: 'Bank / Card' },
  { id: 'credit', label: 'Full Due (Baki)' },
];

export const SrOrdersView: React.FC<SrOrdersViewProps> = ({
  shop,
  activeBranchName,
  products,
  customers,
  staff,
  srOrders,
  onNavigateStaff,
}) => {
  const [subTab, setSubTab] = useState<'orders' | 'performance'>('orders');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SrOrderStatus>('all');
  const [srFilter, setSrFilter] = useState<string>('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedSrId, setSelectedSrId] = useState('');
  const [customSrName, setCustomSrName] = useState('');
  const [routeArea, setRouteArea] = useState<string>(RANGAMATI_ROUTES[0]);
  const [commissionRate, setCommissionRate] = useState<number>(2.5);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [quickRetailerOpen, setQuickRetailerOpen] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [savingRetailer, setSavingRetailer] = useState(false);

  const [pickerProductId, setPickerProductId] = useState('');
  const [pickerQty, setPickerQty] = useState('1');
  const [pickerPrice, setPickerPrice] = useState('');
  const [orderItems, setOrderItems] = useState<SrOrderItem[]>([]);
  const [discountInput, setDiscountInput] = useState('');
  const [advanceInput, setAdvanceInput] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [deliverTarget, setDeliverTarget] = useState<SrOrder | null>(null);
  const [deliverPaidInput, setDeliverPaidInput] = useState('');
  const [deliverMethod, setDeliverMethod] = useState<SrOrderPaymentMethod>('cash');
  const [deliverNotes, setDeliverNotes] = useState('');
  const [delivering, setDelivering] = useState(false);

  const [challanOrder, setChallanOrder] = useState<SrOrder | null>(null);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const srStaff = useMemo(
    () => staff.filter((s) => s.role === 'sr' && s.isActive),
    [staff]
  );

  const productsMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const customersMap = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const c of customers) map.set(c.id, c);
    return map;
  }, [customers]);

  const showToast = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => {
      setNotice((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const kpis = useMemo(() => {
    const pending = srOrders.filter((o) => o.status === 'pending').length;
    const approved = srOrders.filter((o) => o.status === 'approved').length;
    const deliveredOrders = srOrders.filter((o) => o.status === 'delivered');
    const deliveredSales = deliveredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const deliveredCollected = deliveredOrders.reduce((sum, o) => sum + o.paidAmount, 0);
    const deliveredDue = deliveredOrders.reduce((sum, o) => sum + o.dueAmount, 0);
    const commissionEarned = deliveredOrders.reduce((sum, o) => sum + o.commissionAmount, 0);
    return {
      total: srOrders.length,
      pending,
      approved,
      deliveredCount: deliveredOrders.length,
      deliveredSales,
      deliveredCollected,
      deliveredDue,
      commissionEarned,
    };
  }, [srOrders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return srOrders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (srFilter !== 'all' && o.srName !== srFilter) return false;
      if (!q) return true;
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.srName.toLowerCase().includes(q) ||
        o.routeArea.toLowerCase().includes(q) ||
        o.retailerShopName.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q)
      );
    });
  }, [srOrders, search, statusFilter, srFilter]);

  const distinctSrNames = useMemo(() => {
    const set = new Set<string>();
    for (const s of srStaff) set.add(s.name);
    for (const o of srOrders) if (o.srName) set.add(o.srName);
    return Array.from(set).sort();
  }, [srStaff, srOrders]);

  const srScorecards = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        phone: string;
        routeArea: string;
        commissionRate: number;
        pendingOrders: number;
        deliveredOrders: number;
        deliveredSales: number;
        cashCollected: number;
        marketDue: number;
        commissionEarned: number;
      }
    >();

    for (const s of srStaff) {
      map.set(s.name, {
        name: s.name,
        phone: s.phone,
        routeArea: s.routeArea || 'Mainimukh Bazar',
        commissionRate: Number(s.commissionRate || 0),
        pendingOrders: 0,
        deliveredOrders: 0,
        deliveredSales: 0,
        cashCollected: 0,
        marketDue: 0,
        commissionEarned: 0,
      });
    }

    for (const o of srOrders) {
      const existing = map.get(o.srName) || {
        name: o.srName,
        phone: '—',
        routeArea: o.routeArea,
        commissionRate: o.commissionRate,
        pendingOrders: 0,
        deliveredOrders: 0,
        deliveredSales: 0,
        cashCollected: 0,
        marketDue: 0,
        commissionEarned: 0,
      };

      if (o.status === 'pending' || o.status === 'approved') {
        existing.pendingOrders += 1;
      } else if (o.status === 'delivered') {
        existing.deliveredOrders += 1;
        existing.deliveredSales += o.totalAmount;
        existing.cashCollected += o.paidAmount;
        existing.marketDue += o.dueAmount;
        existing.commissionEarned += o.commissionAmount;
      }
      map.set(o.srName, existing);
    }

    return Array.from(map.values()).sort((a, b) => b.deliveredSales - a.deliveredSales);
  }, [srStaff, srOrders]);

  const draftTotals = useMemo(() => {
    const subtotal = Number(orderItems.reduce((sum, i) => sum + i.lineTotal, 0).toFixed(2));
    const discount = Number(Math.min(subtotal, Math.max(0, Number(discountInput) || 0)).toFixed(2));
    const netTotal = Number(Math.max(0, subtotal - discount).toFixed(2));
    const advance = Number(Math.min(netTotal, Math.max(0, Number(advanceInput) || 0)).toFixed(2));
    const due = Number(Math.max(0, netTotal - advance).toFixed(2));
    const comm = Number(((netTotal * Math.max(0, commissionRate)) / 100).toFixed(2));
    return { subtotal, discount, netTotal, advance, due, comm };
  }, [orderItems, discountInput, advanceInput, commissionRate]);

  const openCreateModal = () => {
    const defaultSr = srStaff[0];
    setSelectedSrId(defaultSr ? defaultSr.id : '');
    setCustomSrName(defaultSr ? defaultSr.name : '');
    setRouteArea(defaultSr?.routeArea || RANGAMATI_ROUTES[0]);
    setCommissionRate(defaultSr?.commissionRate ?? 2.5);
    setSelectedCustomerId(customers[0]?.id || '');
    setOrderItems([]);
    setPickerProductId(products[0]?.id || '');
    setPickerQty('1');
    setPickerPrice(products[0] ? String(products[0].sellingPrice) : '');
    setDiscountInput('');
    setAdvanceInput('');
    setOrderNotes('');
    setQuickRetailerOpen(false);
    setCreateOpen(true);
  };

  const handleSrChange = (srId: string) => {
    setSelectedSrId(srId);
    const found = srStaff.find((s) => s.id === srId);
    if (found) {
      setCustomSrName(found.name);
      if (found.routeArea) setRouteArea(found.routeArea);
      setCommissionRate(found.commissionRate ?? 2.5);
    }
  };

  const handleProductPickChange = (prodId: string) => {
    setPickerProductId(prodId);
    const p = productsMap.get(prodId);
    if (p) setPickerPrice(String(p.sellingPrice));
  };

  const handleAddLineItem = () => {
    const prod = productsMap.get(pickerProductId);
    if (!prod) return;
    const qty = Math.max(1, Math.round(Number(pickerQty) || 1));
    const unitPrice = Math.max(0, Number(pickerPrice) || prod.sellingPrice);
    const lineTotal = Number((qty * unitPrice).toFixed(2));

    setOrderItems((prev) => {
      const idx = prev.findIndex((i) => i.productId === prod.id);
      if (idx >= 0) {
        const next = [...prev];
        const nextQty = next[idx].qty + qty;
        next[idx] = {
          ...next[idx],
          qty: nextQty,
          unitPrice,
          lineTotal: Number((nextQty * unitPrice).toFixed(2)),
        };
        return next;
      }
      if (prev.length >= 50) return prev;
      return [
        ...prev,
        {
          productId: prod.id,
          name: prod.name,
          sku: prod.sku,
          unit: prod.unit,
          qty,
          unitPrice,
          costPrice: prod.costPrice,
          lineTotal,
        },
      ];
    });
    setPickerQty('1');
  };

  const handleQuickAddRetailer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOwnerName.trim() || !newPhone.trim() || savingRetailer) return;
    setSavingRetailer(true);
    try {
      const newId = await upsertCustomer(shop.id, shop.ownerId, {
        name: newOwnerName,
        shopName: newShopName || newOwnerName,
        marketArea: routeArea,
        customerType: 'wholesale',
        phone: newPhone,
        address: `${routeArea}, Rangamati`,
        creditLimit: 50000,
      });
      setSelectedCustomerId(newId);
      setNewShopName('');
      setNewOwnerName('');
      setNewPhone('');
      setQuickRetailerOpen(false);
      showToast('Retailer shop added and attached to SR order.');
    } finally {
      setSavingRetailer(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0 || submitting) return;
    const srObj = srStaff.find((s) => s.id === selectedSrId);
    const srName = srObj ? srObj.name : customSrName.trim() || 'Field SR';
    const customerObj = customersMap.get(selectedCustomerId);

    setSubmitting(true);
    try {
      await createSrOrder(shop.id, shop.ownerId, {
        srId: srObj?.id || '',
        srName,
        routeArea,
        customerId: customerObj?.id || '',
        customerName: customerObj?.name || 'Walk-in Retailer',
        retailerShopName: customerObj?.shopName || customerObj?.name || 'Local Shop',
        customerPhone: customerObj?.phone || '',
        items: orderItems,
        discountAmount: draftTotals.discount,
        paidAmount: draftTotals.advance,
        commissionRate,
        paymentMethod: draftTotals.advance > 0 ? 'cash' : 'credit',
        notes: orderNotes,
      });
      setCreateOpen(false);
      showToast(`SR Field Order submitted by ${srName}.`);
    } finally {
      setSubmitting(false);
    }
  };

  const openDeliverModal = (order: SrOrder) => {
    setDeliverTarget(order);
    setDeliverPaidInput(order.paidAmount > 0 ? String(order.paidAmount) : '');
    setDeliverMethod(order.paidAmount > 0 ? order.paymentMethod : 'cash');
    setDeliverNotes(order.notes);
  };

  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliverTarget || delivering) return;
    setDelivering(true);
    try {
      const collected =
        deliverMethod === 'credit'
          ? 0
          : deliverPaidInput === ''
            ? 0
            : Math.max(0, Number(deliverPaidInput) || 0);
      const cust = deliverTarget.customerId ? customersMap.get(deliverTarget.customerId) || null : null;
      await deliverSrOrderBatch(
        shop.id,
        shop.ownerId,
        deliverTarget,
        collected,
        deliverMethod,
        deliverNotes,
        productsMap,
        cust
      );
      const updatedOrder: SrOrder = {
        ...deliverTarget,
        status: 'delivered',
        paidAmount: Math.min(deliverTarget.totalAmount, collected),
        dueAmount: Math.max(0, deliverTarget.totalAmount - collected),
        paymentMethod: deliverMethod,
        notes: deliverNotes,
      };
      setDeliverTarget(null);
      setChallanOrder(updatedOrder);
      showToast(`Delivered ${updatedOrder.orderNumber}. Stock & retailer baki updated.`);
    } finally {
      setDelivering(false);
    }
  };

  const handleSeedDistributionDemo = async () => {
    setSeedingDemo(true);
    try {
      await seedRangamatiDistributionData(shop.id, shop.ownerId, activeBranchName);
      showToast('Added 3 Rangamati Field SRs and 3 wholesale retailer shops.');
    } finally {
      setSeedingDemo(false);
    }
  };

  const statusColor = (status: SrOrderStatus) => {
    if (status === 'delivered') return 'text-emerald-700';
    if (status === 'approved') return 'text-blue-700';
    if (status === 'cancelled') return 'text-red-700';
    return 'text-amber-700';
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">
            SR Field Orders &amp; Distribution
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Capture shop orders from field SRs across Rangamati routes, dispatch stock, print
            challans, and track commissions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {srStaff.length === 0 && (
            <button
              type="button"
              disabled={seedingDemo}
              onClick={() => void handleSeedDistributionDemo()}
              className="min-h-[42px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-700" />
              <span>{seedingDemo ? 'Loading...' : 'Load Sample SRs & Shops'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={openCreateModal}
            className="min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New SR Field Order</span>
          </button>
        </div>
      </div>

      {notice && (
        <p className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5">
          {notice}
        </p>
      )}

      {/* 4-Column Commercial KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Field Orders</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {kpis.total}
          </p>
          <p className="mt-1.5 text-[11px] text-amber-700 font-medium">
            {kpis.pending} pending · {kpis.approved} approved
          </p>
        </div>
        <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Delivered Distribution</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-emerald-700 tabular-nums">
            {formatBDT(kpis.deliveredSales, false)}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500 tabular-nums">
            {kpis.deliveredCount} challans dispatched
          </p>
        </div>
        <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">Delivery Collection vs Due</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {formatBDT(kpis.deliveredCollected, false)}
          </p>
          <p className="mt-1.5 text-[11px] text-red-700 font-mono tabular-nums">
            Market Baki: {formatBDT(kpis.deliveredDue, false)}
          </p>
        </div>
        <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-medium text-slate-500">SR Commission Earned</p>
          <p className="mt-1.5 font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
            {formatBDT(kpis.commissionEarned, false)}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500">
            {srStaff.length} active field SRs
          </p>
        </div>
      </div>

      {/* Sub-view Segmented Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-slate-200/70 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setSubTab('orders')}
            className={`min-h-[36px] px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              subTab === 'orders' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            Orders &amp; Dispatch ({srOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('performance')}
            className={`min-h-[36px] px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              subTab === 'performance' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            SR Performance &amp; Commission ({srScorecards.length})
          </button>
        </div>

        <button
          type="button"
          onClick={onNavigateStaff}
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 self-start sm:self-auto cursor-pointer"
        >
          Manage SR Roster &amp; Commission % →
        </button>
      </div>

      {subTab === 'orders' ? (
        <>
          {/* Filter Bar */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order #, retailer shop, SR name, route, or phone..."
                className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-700"
              />
            </div>

            <select
              aria-label="Filter by SR"
              value={srFilter}
              onChange={(e) => setSrFilter(e.target.value)}
              className="min-h-[40px] px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700"
            >
              <option value="all">All Field SRs</option>
              {distinctSrNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-1 overflow-x-auto">
              {(['all', 'pending', 'approved', 'delivered', 'cancelled'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-xl capitalize whitespace-nowrap cursor-pointer ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Table */}
          {filteredOrders.length === 0 ? (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-10 text-center space-y-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <Truck className="w-9 h-9 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-800">No SR field orders yet</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Your SRs can open this portal on their phone while visiting shops in Mainimukh
                Bazar, Dongudu, or Baghaichhari to submit orders directly into your dispatch queue.
              </p>
              <button
                type="button"
                onClick={openCreateModal}
                className="min-h-[42px] px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer"
              >
                Create First SR Field Order
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4">Order &amp; SR</th>
                      <th className="py-3 px-4">Retailer Shop &amp; Route</th>
                      <th className="py-3 px-4 text-right">Order Total</th>
                      <th className="py-3 px-4 text-right">Paid / Due</th>
                      <th className="py-3 px-4 text-right">Commission</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4">
                          <p className="font-mono text-xs font-bold text-slate-900">
                            {order.orderNumber}
                          </p>
                          <p className="text-xs text-slate-700 font-medium">{order.srName}</p>
                          <p className="text-[11px] text-slate-500">
                            {formatDateTimeBD(order.createdAt)}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">
                            {order.retailerShopName || order.customerName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {order.customerName}
                            {order.customerPhone ? ` · ${order.customerPhone}` : ''}
                          </p>
                          <p className="text-[11px] text-emerald-800 inline-flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            <span>{order.routeArea}</span>
                          </p>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          <p className="font-semibold text-slate-900">
                            {formatBDT(order.totalAmount, false)}
                          </p>
                          <p className="text-[11px] text-slate-500">{order.itemCount} units</p>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                          <p className="text-emerald-700">
                            Paid {formatBDT(order.paidAmount, false)}
                          </p>
                          {order.dueAmount > 0 && (
                            <p className="font-semibold text-red-700">
                              Due {formatBDT(order.dueAmount, false)}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                          <p className="font-semibold text-slate-900">
                            {formatBDT(order.commissionAmount, false)}
                          </p>
                          <p className="text-[11px] text-slate-500">{order.commissionRate}%</p>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-xs font-semibold capitalize ${statusColor(order.status)}`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {order.status === 'pending' && (
                              <button
                                type="button"
                                onClick={() => void approveSrOrder(shop.id, order)}
                                title="Approve Order"
                                className="min-h-[32px] px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md cursor-pointer"
                              >
                                Approve
                              </button>
                            )}
                            {(order.status === 'pending' || order.status === 'approved') && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openDeliverModal(order)}
                                  className="min-h-[32px] inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Deliver</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void cancelSrOrder(shop.id, order)}
                                  title="Cancel Order"
                                  className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-md cursor-pointer"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => setChallanOrder(order)}
                              title="Print Delivery Challan"
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                            >
                              <Printer className="w-4 h-4" />
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
        </>
      ) : (
        /* SR Performance & Commission Tab */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {srScorecards.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <ClipboardCheck className="w-9 h-9 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-800">No SR performance records yet</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Add Field SRs under Staff &amp; Roles or click "Load Sample SRs &amp; Shops" to
                track route targets and commissions.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Field SR</th>
                    <th className="py-3 px-4">Assigned Route</th>
                    <th className="py-3 px-4 text-right">Open / Delivered</th>
                    <th className="py-3 px-4 text-right">Delivered Sales</th>
                    <th className="py-3 px-4 text-right">Cash Collected</th>
                    <th className="py-3 px-4 text-right">Market Due</th>
                    <th className="py-3 px-4 text-right">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {srScorecards.map((sr) => (
                    <tr key={sr.name} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{sr.name}</p>
                        <p className="text-xs font-mono text-slate-500">{sr.phone}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">{sr.routeArea}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                        <span className="text-amber-700">{sr.pendingOrders} open</span> ·{' '}
                        <span className="text-emerald-700 font-semibold">
                          {sr.deliveredOrders} done
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {formatBDT(sr.deliveredSales, false)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-emerald-700 tabular-nums">
                        {formatBDT(sr.cashCollected, false)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-red-700 tabular-nums">
                        {formatBDT(sr.marketDue, false)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <p className="font-bold text-emerald-800">
                          {formatBDT(sr.commissionEarned, false)}
                        </p>
                        <p className="text-[11px] text-slate-500">{sr.commissionRate}% rate</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create SR Field Order Modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleCreateOrder}
            className="bg-white w-full sm:max-w-2xl max-h-[92vh] rounded-t-2xl sm:rounded-xl border border-slate-200 flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  New SR Field Sales Order
                </h2>
                <p className="text-xs text-slate-500">
                  Enter market shop order for dispatch from {shop.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
              {/* SR & Route Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Field SR
                  </label>
                  {srStaff.length > 0 ? (
                    <select
                      value={selectedSrId}
                      onChange={(e) => handleSrChange(e.target.value)}
                      className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                    >
                      {srStaff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.commissionRate ?? 0}%)
                        </option>
                      ))}
                      <option value="">Other / Custom SR</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      maxLength={100}
                      placeholder="SR Name"
                      value={customSrName}
                      onChange={(e) => setCustomSrName(e.target.value)}
                      className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg text-xs"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Market / Route Area
                  </label>
                  <select
                    value={routeArea}
                    onChange={(e) => setRouteArea(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                  >
                    {RANGAMATI_ROUTES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
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
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(Number(e.target.value))}
                    className="w-full min-h-[42px] px-3 py-2 font-mono text-xs border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
              </div>

              {srStaff.length > 0 && !selectedSrId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Custom SR Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    placeholder="Enter SR full name"
                    value={customSrName}
                    onChange={(e) => setCustomSrName(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              )}

              {/* Retailer Shop Selection + Quick Add */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Retailer Shop / Customer Account
                  </label>
                  <button
                    type="button"
                    onClick={() => setQuickRetailerOpen((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{quickRetailerOpen ? 'Close' : '+ New Shop'}</span>
                  </button>
                </div>

                <select
                  required
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
                >
                  <option value="">-- Select Retailer Shop / Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.shopName ? `${c.shopName} (${c.name})` : c.name} · {c.phone}
                      {c.balanceDue ? ` · Due ${formatBDT(c.balanceDue, false)}` : ''}
                    </option>
                  ))}
                </select>

                {quickRetailerOpen && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <input
                      type="text"
                      placeholder="Shop Name (e.g. Bhai Bhai Store)"
                      value={newShopName}
                      onChange={(e) => setNewShopName(e.target.value)}
                      className="sm:col-span-4 px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      placeholder="Owner Name *"
                      value={newOwnerName}
                      onChange={(e) => setNewOwnerName(e.target.value)}
                      className="sm:col-span-3 px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                    <input
                      type="tel"
                      placeholder="018XX-XXXXXX *"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="sm:col-span-3 px-2.5 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg"
                    />
                    <button
                      type="button"
                      disabled={savingRetailer}
                      onClick={(ev) => void handleQuickAddRetailer(ev)}
                      className="sm:col-span-2 px-3 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>

              {/* Add Product Line */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <p className="text-xs font-semibold text-slate-700">Add Distribution Items</p>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <select
                    value={pickerProductId}
                    onChange={(e) => handleProductPickChange(e.target.value)}
                    className="sm:col-span-6 min-h-[40px] px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                  >
                    <option value="">Select Product SKU...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stock: {p.stock} {p.unit} · ৳{p.sellingPrice})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={pickerQty}
                    onChange={(e) => setPickerQty(e.target.value)}
                    className="sm:col-span-2 min-h-[40px] px-2.5 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg tabular-nums"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="Rate ৳"
                    value={pickerPrice}
                    onChange={(e) => setPickerPrice(e.target.value)}
                    className="sm:col-span-2 min-h-[40px] px-2.5 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="sm:col-span-2 min-h-[40px] px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                  >
                    + Add
                  </button>
                </div>

                {orderItems.length > 0 && (
                  <div className="divide-y divide-slate-200 border-t border-slate-200 pt-2">
                    {orderItems.map((item) => (
                      <div
                        key={item.productId}
                        className="py-2 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{item.name}</p>
                          <p className="font-mono text-slate-500 tabular-nums">
                            {item.qty} {item.unit} × {formatBDT(item.unitPrice)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-bold text-slate-900 tabular-nums">
                            {formatBDT(item.lineTotal, false)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setOrderItems((prev) =>
                                prev.filter((i) => i.productId !== item.productId)
                              )
                            }
                            className="p-1 text-slate-400 hover:text-red-700 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Financial Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Wholesale Discount (৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    placeholder="0"
                    className="w-full min-h-[40px] px-3 py-2 font-mono text-xs border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Advance Cash Paid (৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={advanceInput}
                    onChange={(e) => setAdvanceInput(e.target.value)}
                    placeholder="0"
                    className="w-full min-h-[40px] px-3 py-2 font-mono text-xs border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Order Notes
                  </label>
                  <input
                    type="text"
                    maxLength={240}
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Deliver by morning van"
                    className="w-full min-h-[40px] px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Summary Strip */}
              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl grid grid-cols-3 gap-2 text-xs tabular-nums">
                <div>
                  <p className="text-slate-600">Net Order Value</p>
                  <p className="font-mono text-base font-bold text-slate-900">
                    {formatBDT(draftTotals.netTotal, false)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-600">Est. Remaining Due</p>
                  <p className="font-mono text-base font-bold text-red-700">
                    {formatBDT(draftTotals.due, false)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-600">SR Commission ({commissionRate}%)</p>
                  <p className="font-mono text-base font-bold text-emerald-800">
                    {formatBDT(draftTotals.comm, false)}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 pb-safe">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="min-h-[42px] px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || orderItems.length === 0 || !selectedCustomerId}
                className="min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-lg cursor-pointer"
              >
                {submitting ? 'Submitting...' : 'Submit SR Field Order'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Deliver & Collect Modal */}
      {deliverTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleConfirmDelivery}
            className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border border-slate-200 overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  Deliver Order &amp; Update Baki
                </h2>
                <p className="text-xs font-mono text-slate-500">
                  {deliverTarget.orderNumber} · {deliverTarget.retailerShopName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeliverTarget(null)}
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <span className="text-xs text-slate-600">Order Net Total</span>
                <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                  {formatBDT(deliverTarget.totalAmount)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Collection Method
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {DELIVERY_METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setDeliverMethod(m.id);
                        if (m.id === 'credit') setDeliverPaidInput('0');
                      }}
                      className={`min-h-[36px] px-2 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                        deliverMethod === m.id
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {deliverMethod !== 'credit' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Amount Collected Now (৳)
                    </label>
                    <button
                      type="button"
                      onClick={() => setDeliverPaidInput(String(deliverTarget.totalAmount))}
                      className="text-xs font-semibold text-emerald-700 cursor-pointer"
                    >
                      Full Cash ({formatBDT(deliverTarget.totalAmount, false)})
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={deliverTarget.totalAmount}
                    step="1"
                    value={deliverPaidInput}
                    onChange={(e) => setDeliverPaidInput(e.target.value)}
                    placeholder="0 for full credit / baki"
                    className="w-full min-h-[42px] px-3 py-2 font-mono text-sm border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
              )}

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs">
                <span className="font-medium text-amber-900">
                  Due / Baki to add to retailer account:
                </span>
                <span className="font-mono font-bold text-red-700 tabular-nums">
                  {formatBDT(
                    Math.max(
                      0,
                      deliverTarget.totalAmount -
                        (deliverMethod === 'credit' ? 0 : Number(deliverPaidInput) || 0)
                    )
                  )}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Delivery / Van Note
                </label>
                <input
                  type="text"
                  maxLength={240}
                  value={deliverNotes}
                  onChange={(e) => setDeliverNotes(e.target.value)}
                  placeholder="Optional van or receiver note"
                  className="w-full min-h-[40px] px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 pb-safe">
              <button
                type="button"
                onClick={() => setDeliverTarget(null)}
                className="min-h-[42px] px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={delivering}
                className="min-h-[42px] px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
              >
                {delivering ? 'Dispatching...' : 'Confirm Delivery & Deduct Stock'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Printable Delivery Challan Modal */}
      {challanOrder && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full sm:max-w-2xl max-h-[92vh] rounded-t-2xl sm:rounded-xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900">
                Distribution Delivery Challan · {challanOrder.orderNumber}
              </h2>
              <button
                type="button"
                onClick={() => setChallanOrder(null)}
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
              <div
                id="sr-challan-print-sheet"
                className="bg-white border border-slate-200 rounded-lg p-6 space-y-5 text-slate-900"
              >
                <div className="flex items-start justify-between gap-4 border-b border-slate-300 pb-4">
                  <div className="flex items-center gap-3">
                    <img
                      src="/assets/aistudio/M_S_Khan_Brothers_Gold-Blue_Badge_cceec1db.png"
                      alt="M/S Khan Brothers Logo"
                      className="w-12 h-12 rounded-full object-contain shrink-0"
                    />
                    <div>
                      <p className="font-display text-lg font-bold uppercase">{shop.name}</p>
                      <p className="text-xs text-slate-600">{shop.address}</p>
                      <p className="text-xs text-slate-600 font-mono">
                        Tel: {shop.phone} · BIN: {shop.binNumber}
                      </p>
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs shrink-0">
                    <p className="font-bold text-sm uppercase">Delivery Challan</p>
                    <p>{challanOrder.orderNumber}</p>
                    <p className="text-slate-600">{formatDateTimeBD(challanOrder.createdAt)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="font-semibold text-slate-500 uppercase">Retailer / Party</p>
                    <p className="font-bold text-sm text-slate-900">
                      {challanOrder.retailerShopName || challanOrder.customerName}
                    </p>
                    <p className="text-slate-600">Prop: {challanOrder.customerName}</p>
                    {challanOrder.customerPhone && (
                      <p className="font-mono text-slate-600">{challanOrder.customerPhone}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-500 uppercase">Field SR &amp; Route</p>
                    <p className="font-bold text-sm text-slate-900">{challanOrder.srName}</p>
                    <p className="text-slate-600">Route: {challanOrder.routeArea}</p>
                    <p className="capitalize font-semibold text-slate-700">
                      Status: {challanOrder.status}
                    </p>
                  </div>
                </div>

                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-y border-slate-300 bg-slate-50">
                      <th className="py-2 px-2">Item</th>
                      <th className="py-2 px-2 text-right">Qty</th>
                      <th className="py-2 px-2 text-right">Rate</th>
                      <th className="py-2 px-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                    {challanOrder.items.map((item, idx) => (
                      <tr key={`${item.productId}-${idx}`}>
                        <td className="py-2 px-2 font-sans font-medium">{item.name}</td>
                        <td className="py-2 px-2 text-right">
                          {item.qty} {item.unit}
                        </td>
                        <td className="py-2 px-2 text-right">{formatBDT(item.unitPrice)}</td>
                        <td className="py-2 px-2 text-right font-semibold">
                          {formatBDT(item.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-end">
                  <div className="w-60 space-y-1 text-xs font-mono tabular-nums">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Subtotal:</span>
                      <span>{formatBDT(challanOrder.subtotal)}</span>
                    </div>
                    {challanOrder.discountAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Discount:</span>
                        <span>-{formatBDT(challanOrder.discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-sm border-t border-slate-300 pt-1">
                      <span>Net Total:</span>
                      <span>{formatBDT(challanOrder.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-800">
                      <span>Collected:</span>
                      <span>{formatBDT(challanOrder.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-red-700">
                      <span>Due / Baki:</span>
                      <span>{formatBDT(challanOrder.dueAmount)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6 pt-10 text-center text-[11px] text-slate-600">
                  <div className="border-t border-slate-400 pt-1">Prepared By</div>
                  <div className="border-t border-slate-400 pt-1">SR / Delivery Van</div>
                  <div className="border-t border-slate-400 pt-1">Retailer Signature</div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-2 pb-safe">
              <button
                type="button"
                onClick={() => setChallanOrder(null)}
                className="min-h-[42px] px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[42px] inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Challan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
