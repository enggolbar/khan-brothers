import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  BarChart3,
  Barcode,
  BookOpenCheck,
  Boxes,
  Building2,
  ChevronRight,
  ClipboardList,
  Clock,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  Store,
  Truck,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  type Branch,
  type Customer,
  type Expense,
  type LedgerEntry,
  type Product,
  type PurchaseOrder,
  type Sale,
  type Shift,
  type Shop,
  type SrOrder,
  type StaffMember,
  type Supplier,
  type WorkspaceTab,
} from './types/pos';
import { createDefaultShop, updateShopProfile } from './services/posService';
import { LandingAuth } from './components/LandingAuth';
import { SmartDashboardView } from './components/SmartDashboardView';
import { PosTerminal } from './components/PosTerminal';
import { SrOrdersView } from './components/SrOrdersView';
import { DueLedgerView } from './components/DueLedgerView';
import { InventoryView } from './components/InventoryView';
import { SalesHistoryView } from './components/SalesHistoryView';
import { ShiftsView } from './components/ShiftsView';
import { CustomersView } from './components/CustomersView';
import { SuppliersView } from './components/SuppliersView';
import { PurchaseOrdersView } from './components/PurchaseOrdersView';
import { BarcodeLabelsView } from './components/BarcodeLabelsView';
import { ExpensesView } from './components/ExpensesView';
import { StaffRolesView } from './components/StaffRolesView';
import { AnalyticsView } from './components/AnalyticsView';
import { ShopSettingsView } from './components/ShopSettingsView';
import { ReceiptModal } from './components/ReceiptModal';

interface NavGroup {
  title: string;
  items: {
    id: WorkspaceTab;
    label: string;
    shortLabel: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Command',
    items: [
      {
        id: 'dashboard',
        label: 'Smart Dashboard',
        shortLabel: 'Home',
        description: 'Live revenue, baki, SR & stock KPIs',
        icon: LayoutDashboard,
      },
      {
        id: 'pos',
        label: 'POS Terminal',
        shortLabel: 'POS',
        description: 'Barcode checkout, MFS & 80mm print',
        icon: ShoppingCart,
      },
    ],
  },
  {
    title: 'Distribution & Due',
    items: [
      {
        id: 'sr-orders',
        label: 'SR Field Orders',
        shortLabel: 'SR Orders',
        description: 'Route orders, dispatch & commissions',
        icon: Truck,
      },
      {
        id: 'ledger',
        label: 'Due / Baki Ledger',
        shortLabel: 'Due Ledger',
        description: 'Customer receivables & supplier payables',
        icon: BookOpenCheck,
      },
      {
        id: 'customers',
        label: 'Customers & Retailers',
        shortLabel: 'Retailers',
        description: 'Retail shoppers & wholesale shops',
        icon: Users,
      },
    ],
  },
  {
    title: 'Counter Operations',
    items: [
      {
        id: 'sales',
        label: 'Sales & Receipts',
        shortLabel: 'Sales',
        description: 'Invoices, refunds & held bills',
        icon: ReceiptText,
      },
      {
        id: 'shifts',
        label: 'Cash Register Shifts',
        shortLabel: 'Shifts',
        description: 'Open/close drawer & cash variance',
        icon: Clock,
      },
    ],
  },
  {
    title: 'Inventory & Supply',
    items: [
      {
        id: 'inventory',
        label: 'Products & Stock',
        shortLabel: 'Stock',
        description: 'SKU pricing, VAT & stock counts',
        icon: Boxes,
      },
      {
        id: 'suppliers',
        label: 'Suppliers',
        shortLabel: 'Suppliers',
        description: 'Wholesale vendors & payables',
        icon: Store,
      },
      {
        id: 'purchases',
        label: 'Purchase Orders',
        shortLabel: 'Purchases',
        description: 'Restock orders & goods receipt',
        icon: ClipboardList,
      },
      {
        id: 'barcodes',
        label: 'Barcode & Shelf Stickers',
        shortLabel: 'Stickers',
        description: 'GS1 894 barcodes & shelf price tags',
        icon: Barcode,
      },
    ],
  },
  {
    title: 'Finance & Admin',
    items: [
      {
        id: 'expenses',
        label: 'Expenses & Cashbook',
        shortLabel: 'Expenses',
        description: 'Rent, salary, SR TA/DA & utility',
        icon: Wallet,
      },
      {
        id: 'staff',
        label: 'Staff & Field SRs',
        shortLabel: 'Staff/SR',
        description: 'Cashiers, managers & SR routes',
        icon: UserCheck,
      },
      {
        id: 'analytics',
        label: 'Reports & VAT',
        shortLabel: 'Reports',
        description: 'Profit, Mushak-6.3 VAT & CSV',
        icon: BarChart3,
      },
      {
        id: 'settings',
        label: 'Shop & SaaS Plan',
        shortLabel: 'Shop',
        description: 'Store profile, BIN, branches & plan',
        icon: Building2,
      },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

const STORE_LOGO_URL = '/assets/aistudio/M_S_Khan_Brothers_Gold-Blue_Badge_cceec1db.png';

const BrandMark: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <span className="inline-flex items-center gap-2.5 min-w-0">
    <img
      src={STORE_LOGO_URL}
      alt="M/S Khan Brothers Logo"
      className="w-8 h-8 rounded-full bg-white object-contain p-0.5 ring-1 ring-amber-400/50 shrink-0"
    />
    {!compact && (
      <span className="min-w-0 flex flex-col leading-tight text-left">
        <span className="font-display text-[15px] font-bold tracking-tight text-white truncate">
          M/S Khan Brothers
        </span>
        <span className="text-[10px] font-medium text-emerald-400 truncate">
          BazarGrid POS Cloud
        </span>
      </span>
    )}
  </span>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [shops, setShops] = useState<Shop[]>([]);
  const [shopsLoaded, setShopsLoaded] = useState(false);
  const [activeShopId, setActiveShopId] = useState<string>('');
  const [activeBranchId, setActiveBranchId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [quickJumpOpen, setQuickJumpOpen] = useState(false);
  const [quickJumpQuery, setQuickJumpQuery] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [srOrders, setSrOrders] = useState<SrOrder[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);

  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const [newShopModalOpen, setNewShopModalOpen] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [creatingShop, setCreatingShop] = useState(false);
  const [runtimeError, setRuntimeError] = useState<Error | null>(null);

  const provisioningRef = useRef(false);
  const migratedKhanRef = useRef(false);
  const quickJumpInputRef = useRef<HTMLInputElement>(null);

  if (runtimeError) {
    throw runtimeError;
  }

  // Ctrl+K / Cmd+K Quick Menu Jump shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickJumpOpen((prev) => !prev);
        setQuickJumpQuery('');
      } else if (e.key === 'Escape') {
        setQuickJumpOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (quickJumpOpen) {
      window.setTimeout(() => quickJumpInputRef.current?.focus(), 20);
    }
  }, [quickJumpOpen]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setShops([]);
        setShopsLoaded(false);
        setActiveShopId('');
        setActiveBranchId('');
        setProducts([]);
        setSales([]);
        setCustomers([]);
        setBranches([]);
        setSuppliers([]);
        setPurchases([]);
        setExpenses([]);
        setShifts([]);
        setStaff([]);
        setSrOrders([]);
        setLedgerEntries([]);
        provisioningRef.current = false;
        migratedKhanRef.current = false;
      }
    });
    return () => unsub();
  }, []);

  // Subscribe to owner's cloud shops
  useEffect(() => {
    if (!authReady || !user) return;
    const path = 'shops';
    const q = query(collection(db, 'shops'), where('ownerId', '==', user.uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Shop[] = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Shop, 'id'>) }))
          .sort((a, b) => {
            const ta = a.createdAt ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt ? b.createdAt.toMillis() : 0;
            return ta - tb;
          });

        setShops(list);
        setShopsLoaded(true);

        if (list.length === 0 && !provisioningRef.current) {
          provisioningRef.current = true;
          void createDefaultShop(user)
            .then((createdId) => {
              setActiveShopId(createdId);
            })
            .catch((err: unknown) => {
              provisioningRef.current = false;
              setRuntimeError(err instanceof Error ? err : new Error(String(err)));
            });
        } else if (list.length > 0) {
          setActiveShopId((prev) => (prev && list.some((s) => s.id === prev) ? prev : list[0].id));
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, path);
        } catch (err) {
          setRuntimeError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    );

    return () => unsub();
  }, [authReady, user]);

  // Subscribe to all operational subcollections for the active shop
  useEffect(() => {
    if (!authReady || !user || !activeShopId) return;

    const uid = user.uid;
    const reportErr = (error: unknown, path: string) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (err) {
        setRuntimeError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    const productsPath = `shops/${activeShopId}/products`;
    const salesPath = `shops/${activeShopId}/sales`;
    const customersPath = `shops/${activeShopId}/customers`;
    const branchesPath = `shops/${activeShopId}/branches`;
    const suppliersPath = `shops/${activeShopId}/suppliers`;
    const purchasesPath = `shops/${activeShopId}/purchases`;
    const expensesPath = `shops/${activeShopId}/expenses`;
    const shiftsPath = `shops/${activeShopId}/shifts`;
    const staffPath = `shops/${activeShopId}/staff`;
    const srOrdersPath = `shops/${activeShopId}/srOrders`;
    const ledgerPath = `shops/${activeShopId}/ledgerEntries`;

    const unsubs = [
      onSnapshot(
        query(collection(db, productsPath), where('ownerId', '==', uid)),
        (snap) => {
          setProducts(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Product, 'id'>) }))
              .sort((a, b) => a.name.localeCompare(b.name))
          );
        },
        (e) => reportErr(e, productsPath)
      ),
      onSnapshot(
        query(collection(db, salesPath), where('ownerId', '==', uid)),
        (snap) => {
          setSales(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Sale, 'id'>) }))
              .sort((a, b) => {
                const ta = a.createdAt ? a.createdAt.toMillis() : Date.now();
                const tb = b.createdAt ? b.createdAt.toMillis() : Date.now();
                return tb - ta;
              })
          );
        },
        (e) => reportErr(e, salesPath)
      ),
      onSnapshot(
        query(collection(db, customersPath), where('ownerId', '==', uid)),
        (snap) => {
          setCustomers(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Customer, 'id'>) }))
              .sort((a, b) => b.totalSpent - a.totalSpent)
          );
        },
        (e) => reportErr(e, customersPath)
      ),
      onSnapshot(
        query(collection(db, branchesPath), where('ownerId', '==', uid)),
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, 'id'>) }))
            .sort((a, b) => a.code.localeCompare(b.code));
          setBranches(list);
          setActiveBranchId((prev) =>
            prev && list.some((b) => b.id === prev) ? prev : list[0]?.id || ''
          );
        },
        (e) => reportErr(e, branchesPath)
      ),
      onSnapshot(
        query(collection(db, suppliersPath), where('ownerId', '==', uid)),
        (snap) => {
          setSuppliers(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Supplier, 'id'>) }))
              .sort((a, b) => (a.company || a.name).localeCompare(b.company || b.name))
          );
        },
        (e) => reportErr(e, suppliersPath)
      ),
      onSnapshot(
        query(collection(db, purchasesPath), where('ownerId', '==', uid)),
        (snap) => {
          setPurchases(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<PurchaseOrder, 'id'>) }))
              .sort((a, b) => {
                const ta = a.createdAt ? a.createdAt.toMillis() : Date.now();
                const tb = b.createdAt ? b.createdAt.toMillis() : Date.now();
                return tb - ta;
              })
          );
        },
        (e) => reportErr(e, purchasesPath)
      ),
      onSnapshot(
        query(collection(db, expensesPath), where('ownerId', '==', uid)),
        (snap) => {
          setExpenses(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Expense, 'id'>) }))
              .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate))
          );
        },
        (e) => reportErr(e, expensesPath)
      ),
      onSnapshot(
        query(collection(db, shiftsPath), where('ownerId', '==', uid)),
        (snap) => {
          setShifts(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<Shift, 'id'>) }))
              .sort((a, b) => {
                const ta = a.createdAt ? a.createdAt.toMillis() : Date.now();
                const tb = b.createdAt ? b.createdAt.toMillis() : Date.now();
                return tb - ta;
              })
          );
        },
        (e) => reportErr(e, shiftsPath)
      ),
      onSnapshot(
        query(collection(db, staffPath), where('ownerId', '==', uid)),
        (snap) => {
          setStaff(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<StaffMember, 'id'>) }))
              .sort((a, b) => a.name.localeCompare(b.name))
          );
        },
        (e) => reportErr(e, staffPath)
      ),
      onSnapshot(
        query(collection(db, srOrdersPath), where('ownerId', '==', uid)),
        (snap) => {
          setSrOrders(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<SrOrder, 'id'>) }))
              .sort((a, b) => {
                const ta = a.createdAt ? a.createdAt.toMillis() : Date.now();
                const tb = b.createdAt ? b.createdAt.toMillis() : Date.now();
                return tb - ta;
              })
          );
        },
        (e) => reportErr(e, srOrdersPath)
      ),
      onSnapshot(
        query(collection(db, ledgerPath), where('ownerId', '==', uid)),
        (snap) => {
          setLedgerEntries(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<LedgerEntry, 'id'>) }))
              .sort((a, b) => {
                const ta = a.createdAt ? a.createdAt.toMillis() : Date.now();
                const tb = b.createdAt ? b.createdAt.toMillis() : Date.now();
                return tb - ta;
              })
          );
        },
        (e) => reportErr(e, ledgerPath)
      ),
    ];

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [authReady, user, activeShopId]);

  const activeShop = useMemo(
    () => shops.find((s) => s.id === activeShopId) || null,
    [shops, activeShopId]
  );

  // Auto-update previously generated placeholder shop to M/S Khan Brothers (Rangamati)
  useEffect(() => {
    if (!activeShop || migratedKhanRef.current) return;
    if (activeShop.address === 'House 24, Road 7, Dhanmondi, Dhaka 1205') {
      migratedKhanRef.current = true;
      void updateShopProfile(activeShop.id, {
        name: 'M/S Khan Brothers',
        branchName: 'Mainimukh Bazar — Supermarket & Distribution',
        address: 'Mainimukh Bazar, Dongudu, Rangamati',
        phone: activeShop.phone,
        binNumber: activeShop.binNumber,
        defaultVatRate: activeShop.defaultVatRate,
        receiptFooter:
          'M/S Khan Brothers — Supermarket & Distributorship, Mainimukh Bazar, Rangamati.',
      });
    }
  }, [activeShop]);

  const activeBranch = useMemo(
    () => branches.find((b) => b.id === activeBranchId) || branches[0] || null,
    [branches, activeBranchId]
  );

  const heldSales = useMemo(
    () => sales.filter((s) => s.status === 'held'),
    [sales]
  );

  const lowStockCount = useMemo(
    () => products.filter((p) => p.isActive && p.stock <= p.reorderLevel).length,
    [products]
  );

  const openSrCount = useMemo(
    () => srOrders.filter((o) => o.status === 'pending' || o.status === 'approved').length,
    [srOrders]
  );

  const customerDueCount = useMemo(
    () => customers.filter((c) => Number(c.balanceDue || 0) > 0).length,
    [customers]
  );

  const filteredQuickMenus = useMemo(() => {
    const q = quickJumpQuery.trim().toLowerCase();
    if (!q) return ALL_NAV_ITEMS;
    return ALL_NAV_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.shortLabel.toLowerCase().includes(q)
    );
  }, [quickJumpQuery]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Unable to sign in with Google right now.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError(msg);
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    setMobileMenuOpen(false);
    setQuickJumpOpen(false);
    await signOut(auth);
  };

  const handleCreateAdditionalShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newShopName.trim() || creatingShop) return;
    setCreatingShop(true);
    try {
      const createdId = await createDefaultShop(user, newShopName.trim());
      setActiveShopId(createdId);
      setNewShopName('');
      setNewShopModalOpen(false);
      setActiveTab('dashboard');
    } finally {
      setCreatingShop(false);
    }
  };

  const navigateTo = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    setQuickJumpOpen(false);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#0B1320] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <BrandMark />
          </div>
          <p className="text-xs text-slate-400">Connecting to cloud POS workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LandingAuth
        onSignIn={handleGoogleSignIn}
        signingIn={signingIn}
        authError={authError}
      />
    );
  }

  if (!shopsLoaded || !activeShop) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-2 shadow-xs">
          <p className="font-display text-base font-bold text-slate-900">
            Setting up M/S Khan Brothers Workspace
          </p>
          <p className="text-xs text-slate-500">
            Initializing your cloud register, Rangamati distribution routes, and VAT profile...
          </p>
        </div>
      </div>
    );
  }

  const activeNavMeta = ALL_NAV_ITEMS.find((i) => i.id === activeTab) || ALL_NAV_ITEMS[0];
  const activeBranchName = activeBranch?.name || activeShop.branchName;
  const cashierName = user.displayName || user.email?.split('@')[0] || 'Cashier';
  const cashierInitials = cashierName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Commercial Dark Navigation Rail */}
      <aside
        className={`hidden lg:flex lg:shrink-0 lg:flex-col bg-[#0B1320] text-slate-300 border-r border-slate-800/80 lg:sticky lg:top-0 lg:h-screen transition-[width] duration-200 ${
          sidebarCompact ? 'lg:w-[76px]' : 'lg:w-[264px]'
        }`}
      >
        {/* Brand Header */}
        <div className="h-14 px-4 border-b border-slate-800/90 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navigateTo('dashboard')}
            className="flex items-center min-w-0 cursor-pointer"
            title="BazarGrid Smart Dashboard"
          >
            <BrandMark compact={sidebarCompact} />
          </button>

          {!sidebarCompact && (
            <button
              type="button"
              onClick={() => setSidebarCompact(true)}
              title="Collapse sidebar"
              className="min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer shrink-0"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Multi-Tenant Store Switcher */}
        {sidebarCompact ? (
          <div className="p-3 border-b border-slate-800/90 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarCompact(false)}
              title="Expand sidebar"
              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 cursor-pointer"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="p-3.5 border-b border-slate-800/90 space-y-2">
            <div className="flex items-center gap-1.5">
              <select
                aria-label="Select shop tenant"
                value={activeShop.id}
                onChange={(e) => setActiveShopId(e.target.value)}
                className="flex-1 min-w-0 min-h-[38px] px-2.5 py-1.5 text-xs font-semibold text-white bg-slate-900 border border-slate-700/80 rounded-lg focus:outline-none focus:border-emerald-500 truncate cursor-pointer"
              >
                {shops.map((s) => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setNewShopModalOpen(true)}
                title="Create new cloud shop"
                className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900 text-slate-300 hover:text-white hover:border-emerald-500/60 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 px-0.5 text-[11px] text-slate-400">
              <span className="truncate">{activeBranchName}</span>
              <span className="font-mono text-emerald-400 capitalize shrink-0">
                {activeShop.plan}
              </span>
            </div>
          </div>
        )}

        {/* Grouped Commercial Navigation Menus */}
        <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto commercial-scroll-dark">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-0.5">
              {!sidebarCompact && (
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {group.title}
                </p>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                const countHint =
                  item.id === 'sr-orders' && openSrCount > 0
                    ? `${openSrCount}`
                    : item.id === 'inventory' && lowStockCount > 0
                      ? `${lowStockCount}`
                      : item.id === 'sales' && heldSales.length > 0
                        ? `${heldSales.length}`
                        : item.id === 'ledger' && customerDueCount > 0
                          ? `${customerDueCount}`
                          : null;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateTo(item.id)}
                    title={sidebarCompact ? item.label : undefined}
                    className={`w-full min-h-[38px] ${
                      sidebarCompact ? 'px-0 justify-center' : 'px-3 justify-between'
                    } py-2 text-[13px] font-medium rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-emerald-500/15 text-emerald-300 font-semibold ring-1 ring-inset ring-emerald-500/30'
                        : 'text-slate-300 hover:bg-slate-800/75 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          active ? 'text-emerald-400' : 'text-slate-400'
                        }`}
                      />
                      {!sidebarCompact && <span className="truncate">{item.label}</span>}
                    </span>
                    {!sidebarCompact && countHint && (
                      <span
                        className={`font-mono text-[11px] font-semibold shrink-0 tabular-nums ${
                          active ? 'text-emerald-300' : 'text-amber-400'
                        }`}
                      >
                        {countHint}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Merchant Profile Footer */}
        <div className="p-3 border-t border-slate-800/90 flex items-center justify-between gap-2">
          {!sidebarCompact && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-700/50 text-emerald-300 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                {cashierInitials || 'KB'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{cashierName}</p>
                <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => void handleSignOut()}
            title="Sign out"
            className={`${
              sidebarCompact ? 'mx-auto' : ''
            } min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-950/60 transition-colors cursor-pointer shrink-0`}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Commercial Top Command Header (52px mobile / 56px desktop) */}
        <header className="sticky top-0 z-30 h-[52px] lg:h-14 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 lg:px-6 flex items-center justify-between gap-3">
          {/* Left Breadcrumb Trail */}
          <div className="min-w-0 flex items-center gap-2 text-sm">
            <img
              src={STORE_LOGO_URL}
              alt="M/S Khan Brothers Logo"
              className="lg:hidden w-7 h-7 rounded-full bg-white object-contain p-0.5 border border-slate-200 shrink-0"
            />
            <span className="font-display font-bold text-slate-900 truncate max-w-[140px] sm:max-w-[240px]">
              {activeShop.name}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <span className="font-semibold text-emerald-800 truncate">{activeNavMeta.label}</span>
          </div>

          {/* Right Quick Command Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Menu Jump Trigger */}
            <button
              type="button"
              onClick={() => {
                setQuickJumpQuery('');
                setQuickJumpOpen(true);
              }}
              className="hidden md:inline-flex items-center justify-between gap-3 min-h-[36px] w-52 px-3 py-1.5 text-xs text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center gap-2 truncate">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Jump to menu...</span>
              </span>
              <span className="font-mono text-[10px] text-slate-400">Ctrl K</span>
            </button>

            {branches.length > 1 && (
              <select
                aria-label="Active register branch"
                value={activeBranch?.id || ''}
                onChange={(e) => setActiveBranchId(e.target.value)}
                className="hidden sm:block min-h-[36px] px-2.5 py-1 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-emerald-700 cursor-pointer"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            )}

            {activeTab !== 'pos' && (
              <button
                type="button"
                onClick={() => navigateTo('pos')}
                className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition-colors whitespace-nowrap cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>POS Terminal</span>
              </button>
            )}
          </div>
        </header>

        {/* Active Module Viewport */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1640px] w-full mx-auto">
          {activeTab === 'dashboard' && (
            <SmartDashboardView
              shop={activeShop}
              activeBranchName={activeBranchName}
              products={products}
              sales={sales}
              customers={customers}
              expenses={expenses}
              purchases={purchases}
              suppliers={suppliers}
              shifts={shifts}
              srOrders={srOrders}
              onNavigate={navigateTo}
              onViewReceipt={(sale) => setReceiptSale(sale)}
            />
          )}

          {activeTab === 'pos' && (
            <PosTerminal
              shop={activeShop}
              activeBranchName={activeBranchName}
              cashierName={cashierName}
              products={products}
              customers={customers}
              heldSales={heldSales}
              onSaleCompleted={(sale) => setReceiptSale(sale)}
              onResumeHeldSale={() => navigateTo('sales')}
              onNavigateInventory={() => navigateTo('inventory')}
            />
          )}

          {activeTab === 'sr-orders' && (
            <SrOrdersView
              shop={activeShop}
              activeBranchName={activeBranchName}
              products={products}
              customers={customers}
              staff={staff}
              srOrders={srOrders}
              onNavigateStaff={() => navigateTo('staff')}
            />
          )}

          {activeTab === 'ledger' && (
            <DueLedgerView
              shop={activeShop}
              customers={customers}
              suppliers={suppliers}
              ledgerEntries={ledgerEntries}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryView shop={activeShop} products={products} />
          )}

          {activeTab === 'sales' && (
            <SalesHistoryView
              shop={activeShop}
              sales={sales}
              products={products}
              onViewReceipt={(sale) => setReceiptSale(sale)}
            />
          )}

          {activeTab === 'shifts' && (
            <ShiftsView
              shop={activeShop}
              activeBranchName={activeBranchName}
              cashierName={cashierName}
              shifts={shifts}
              sales={sales}
              expenses={expenses}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersView
              shop={activeShop}
              customers={customers}
              onNavigateLedger={() => navigateTo('ledger')}
            />
          )}

          {activeTab === 'suppliers' && (
            <SuppliersView shop={activeShop} suppliers={suppliers} />
          )}

          {activeTab === 'purchases' && (
            <PurchaseOrdersView
              shop={activeShop}
              activeBranchName={activeBranchName}
              products={products}
              suppliers={suppliers}
              purchases={purchases}
              onNavigateSuppliers={() => navigateTo('suppliers')}
            />
          )}

          {activeTab === 'barcodes' && (
            <BarcodeLabelsView shop={activeShop} products={products} />
          )}

          {activeTab === 'expenses' && (
            <ExpensesView
              shop={activeShop}
              activeBranchName={activeBranchName}
              expenses={expenses}
            />
          )}

          {activeTab === 'staff' && (
            <StaffRolesView
              shop={activeShop}
              branches={branches}
              activeBranchName={activeBranchName}
              staff={staff}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsView sales={sales} products={products} expenses={expenses} />
          )}

          {activeTab === 'settings' && (
            <ShopSettingsView
              shop={activeShop}
              branches={branches}
              activeBranchId={activeBranch?.id || ''}
              productCount={products.length}
              saleCount={sales.length}
              onSelectBranch={(id) => setActiveBranchId(id)}
            />
          )}
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (64px height; combined with 52px header <= 14% viewport) */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
      >
        <div className="grid grid-cols-5 h-16">
          {(
            [
              { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
              { id: 'pos', label: 'POS', icon: ShoppingCart },
              { id: 'sr-orders', label: 'SR Orders', icon: Truck },
              { id: 'ledger', label: 'Due/Baki', icon: BookOpenCheck },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id && !mobileMenuOpen;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTo(item.id)}
                className={`relative flex flex-col items-center justify-center gap-1 min-h-[48px] transition-colors ${
                  active ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-3 right-3 h-0.5 bg-emerald-700 rounded-b-full" />
                )}
                <Icon className="w-5 h-5" />
                <span className="text-[10px] leading-none">{item.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className={`relative flex flex-col items-center justify-center gap-1 min-h-[48px] transition-colors ${
              mobileMenuOpen ||
              !['dashboard', 'pos', 'sr-orders', 'ledger'].includes(activeTab)
                ? 'text-emerald-700 font-semibold'
                : 'text-slate-500'
            }`}
          >
            {(mobileMenuOpen ||
              !['dashboard', 'pos', 'sr-orders', 'ledger'].includes(activeTab)) && (
              <span className="absolute top-0 left-3 right-3 h-0.5 bg-emerald-700 rounded-b-full" />
            )}
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[10px] leading-none">Menus</span>
          </button>
        </div>
      </nav>

      {/* Mobile All-Menus Bottom Sheet Drawer */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="All POS Menus"
        >
          <div className="bg-white rounded-t-3xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="bg-[#0B1320] text-white px-5 pt-3 pb-4">
              <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={STORE_LOGO_URL}
                    alt="M/S Khan Brothers Logo"
                    className="w-10 h-10 rounded-full bg-white object-contain p-0.5 ring-1 ring-amber-400/50 shrink-0"
                  />
                  <div className="min-w-0">
                    <h2 className="font-display text-base font-bold text-white truncate">
                      {activeShop.name}
                    </h2>
                    <p className="text-xs text-slate-400 truncate">
                      {activeShop.address}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menus"
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-300 hover:text-white bg-slate-800/80"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-5 pb-safe bg-[#F4F6F9]">
              {/* Mobile Shop Switcher */}
              <div className="flex items-center gap-2">
                <select
                  aria-label="Switch shop"
                  value={activeShop.id}
                  onChange={(e) => setActiveShopId(e.target.value)}
                  className="flex-1 min-h-[42px] px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl"
                >
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setNewShopModalOpen(true);
                  }}
                  className="min-h-[42px] px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-xl whitespace-nowrap"
                >
                  + New Shop
                </button>
              </div>

              {NAV_GROUPS.map((group) => (
                <div key={group.title} className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-1">
                    {group.title}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => navigateTo(item.id)}
                          className={`min-h-[54px] px-3 py-2.5 rounded-xl border text-left flex items-center gap-2.5 text-xs font-semibold transition-colors ${
                            active
                              ? 'bg-emerald-700 border-emerald-700 text-white'
                              : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        >
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              active ? 'text-emerald-200' : 'text-emerald-700'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">{cashierName}</p>
                  <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 bg-white border border-red-200 rounded-xl"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Menu Jump Modal (Ctrl+K) */}
      {quickJumpOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-start justify-center pt-[12vh] p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Quick Menu Jump"
          onClick={() => setQuickJumpOpen(false)}
        >
          <div
            className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2.5">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                ref={quickJumpInputRef}
                type="text"
                value={quickJumpQuery}
                onChange={(e) => setQuickJumpQuery(e.target.value)}
                placeholder="Type module name (POS, SR, Baki, Barcode, Stock, VAT)..."
                className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setQuickJumpOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 p-2">
              {filteredQuickMenus.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-500">
                  No workspace modules match "{quickJumpQuery}".
                </p>
              ) : (
                filteredQuickMenus.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigateTo(item.id)}
                      className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                        active ? 'bg-emerald-50 text-emerald-900' : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{item.label}</p>
                          <p className="text-xs text-slate-500 truncate">{item.description}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Thermal Receipt Print Modal */}
      {receiptSale && (
        <ReceiptModal
          sale={receiptSale}
          shop={activeShop}
          onClose={() => setReceiptSale(null)}
        />
      )}

      {/* Create New Cloud Shop Modal */}
      {newShopModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleCreateAdditionalShop}
            className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900">
                Create New Cloud Shop
              </h2>
              <button
                type="button"
                onClick={() => setNewShopModalOpen(false)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Super Shop / Distributorship Name
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={newShopName}
                onChange={(e) => setNewShopName(e.target.value)}
                placeholder="e.g. M/S Khan Brothers — Branch 2"
                className="w-full min-h-[42px] px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
              />
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewShopModalOpen(false)}
                className="min-h-[40px] px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingShop}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
              >
                {creatingShop ? 'Creating...' : 'Create Shop'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
