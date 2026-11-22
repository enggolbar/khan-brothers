import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from './mysqlDataStore';
import { getCurrentUser, requestSignup, signIn, signInWithSrPin, signOut, type AppUser, type SignupFormData } from './authClient';
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
import { db, handleDataError, OperationType } from './dataClient';
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
import { AdminApprovalPanel } from './components/AdminApprovalPanel';

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
const SR_NAV_GROUPS = NAV_GROUPS.filter((g) => g.title === 'Distribution & Due');

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
  const [user, setUser] = useState<AppUser | null>(null);
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
    let active = true;
    void getCurrentUser().then((nextUser) => {
      if (!active) return;
      setUser(nextUser);
      if(nextUser?.role==='sr') setActiveTab('sr-orders');
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
    }).catch((error: unknown) => {
      if (!active) return;
      setAuthError(error instanceof Error ? error.message : 'সেশন যাচাই করা যায়নি।');
      setAuthReady(true);
    });
    return () => { active = false; };
  }, []);

  // Subscribe to owner's cloud shops
  useEffect(() => {
    if (!authReady || !user || user.role === 'super_admin') return;
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

        if (list.length === 0 && user.role !== 'sr' && !provisioningRef.current) {
          provisioningRef.current = true;
          void createDefaultShop(user, user.businessName || undefined)
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
          handleDataError(error, OperationType.LIST, path);
        } catch (err) {
          setRuntimeError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    );

    return () => unsub();
  }, [authReady, user]);

  // Subscribe to all operational subcollections for the active shop
  useEffect(() => {
    if (!authReady || !user || user.role === 'super_admin' || !activeShopId) return;

    const uid = user.uid;
    const reportErr = (error: unknown, path: string) => {
      try {
        handleDataError(error, OperationType.LIST, path);
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
    const allowed = user?.role === 'sr' ? SR_NAV_GROUPS.flatMap((group) => group.items) : ALL_NAV_ITEMS;
    if (!q) return allowed;
    return allowed.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.shortLabel.toLowerCase().includes(q)
    );
  }, [quickJumpQuery, user?.role]);

  const getAuthErrorMessage = (error: unknown) => {
    const code = (error as { code?: string })?.code || '';
    const messages: Record<string, string> = {
      signup_pending: 'আপনার সাইনআপ অনুরোধ সুপার অ্যাডমিনের অনুমোদনের অপেক্ষায় আছে।',
      signup_rejected: 'সাইনআপ অনুরোধ অনুমোদিত হয়নি। সুপার অ্যাডমিনের সাথে যোগাযোগ করুন।',
      email_exists: 'এই ইমেইলে আগে থেকেই অ্যাকাউন্ট আছে। সাইন ইন করুন।',
      invalid_signup: 'নাম, সঠিক ইমেইল এবং কমপক্ষে ৮ অক্ষরের পাসওয়ার্ড দিন।',
    };
    return messages[code] || (error instanceof Error ? error.message : 'সাইন ইন করা যায়নি। আবার চেষ্টা করুন।');
  };

  const runAuthAction = async (action: () => Promise<void>) => {
    setAuthError(null);
    setSigningIn(true);
    try {
      await action();
    } catch (error) {
      setAuthError(getAuthErrorMessage(error));
      throw error;
    } finally {
      setSigningIn(false);
    }
  };

  const handleEmailSignIn = (email: string, password: string) => runAuthAction(async () => {
    const nextUser = await signIn(email, password);
    setUser(nextUser);
  });

  const handleSrPinSignIn = (businessPhone:string,staffPhone:string,pin:string) => runAuthAction(async () => {
    const nextUser=await signInWithSrPin(businessPhone,staffPhone,pin);
    setUser(nextUser);
    setActiveTab('sr-orders');
  });

  const handleSignUp = (details: SignupFormData) => runAuthAction(async () => {
    await requestSignup(details);
  });

  const handleSignOut = async () => {
    setMobileMenuOpen(false);
    setQuickJumpOpen(false);
    await signOut();
    setUser(null);
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
  };

  const handleCreateAdditionalShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.isDemo || !newShopName.trim() || creatingShop) return;
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
        onEmailSignIn={handleEmailSignIn}
      onSrPinSignIn={handleSrPinSignIn}
        onSignUp={handleSignUp}
        onClearError={() => setAuthError(null)}
        signingIn={signingIn}
        authError={authError}
      />
    );
  }

  if (user.role === 'super_admin') {
    return <AdminApprovalPanel user={user} onSignOut={handleSignOut} />;
  }

  if (!shopsLoaded || !activeShop) {
    return (
      <div className="min-h-screen bg-[#EAF5FF] flex items-center justify-center p-6">
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

  const visibleNavGroups = user.role==='sr' ? SR_NAV_GROUPS : NAV_GROUPS;
  const visibleNavItems = visibleNavGroups.flatMap((group)=>group.items);
  const activeNavMeta = visibleNavItems.find((i) => i.id === activeTab) || visibleNavItems[0] || ALL_NAV_ITEMS[0];
  const activeBranchName = activeBranch?.name || activeShop.branchName;
  const cashierName = user.displayName || user.email?.split('@')[0] || 'Cashier';
  const cashierInitials = cashierName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');

  return (
      <div className="min-h-screen bg-[#EAF5FF] text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Commercial Dark Navigation Rail */}
      <aside
        className={`hidden lg:flex lg:shrink-0 lg:flex-col bg-[#0756A5]/90 text-blue-50 border border-white/25 shadow-2xl shadow-blue-950/20 backdrop-blur-2xl lg:sticky lg:top-3 lg:my-3 lg:ml-3 lg:mr-1.5 lg:h-[calc(100vh-24px)] rounded-3xl overflow-hidden transition-[width] duration-200 ${
          sidebarCompact ? 'lg:w-[76px]' : 'lg:w-[264px]'
        }`}
      >
        {/* Brand Header */}
        <div className="h-14 px-4 border-b border-white/15 flex items-center justify-between gap-2">
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
              className="min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded-xl text-blue-100/70 hover:text-white hover:bg-white/15 transition-colors cursor-pointer shrink-0"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Multi-Tenant Store Switcher */}
        {sidebarCompact ? (
          <div className="p-3 border-b border-white/15 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarCompact(false)}
              title="Expand sidebar"
              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-xl bg-white/10 border border-white/20 text-blue-50 hover:text-white hover:bg-white/20 cursor-pointer"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="p-3.5 border-b border-white/15 space-y-2">
            <div className="flex items-center gap-1.5">
              <select
                aria-label="Select shop tenant"
                value={activeShop.id}
                onChange={(e) => setActiveShopId(e.target.value)}
                className="flex-1 min-w-0 min-h-[38px] px-2.5 py-1.5 text-xs font-semibold text-white bg-blue-950/35 border border-white/20 rounded-xl focus:outline-none focus:border-sky-200/70 truncate cursor-pointer"
              >
                {shops.map((s) => (
                  <option key={s.id} value={s.id} className="bg-blue-900 text-white">
                    {s.name}
                  </option>
                ))}
              </select>
              {!user.isDemo && <button
                type="button"
                onClick={() => setNewShopModalOpen(true)}
                title="Create new cloud shop"
                className="min-h-[38px] min-w-[38px] inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 text-blue-50 hover:text-white hover:bg-white/20 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>}
            </div>
            <div className="flex items-center justify-between gap-2 px-0.5 text-[11px] text-slate-400">
              <span className="truncate text-blue-100/80">{activeBranchName}</span>
              <span className="font-mono text-sky-200 capitalize shrink-0">
                {activeShop.plan}
              </span>
            </div>
          </div>
        )}

        {/* Grouped Commercial Navigation Menus */}
        <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto commercial-scroll-dark">
          {visibleNavGroups.map((group) => (
            <div key={group.title} className="space-y-0.5">
              {!sidebarCompact && (
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sky-100/60">
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
                    } py-2 text-[13px] font-medium rounded-2xl flex items-center gap-2 transition-all duration-200 whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-white/20 text-white font-semibold ring-1 ring-inset ring-white/25 shadow-lg shadow-blue-950/10'
                        : 'text-blue-50/80 hover:bg-white/12 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          active ? 'text-sky-100' : 'text-blue-100/65'
                        }`}
                      />
                      {!sidebarCompact && <span className="truncate">{item.label}</span>}
                    </span>
                    {!sidebarCompact && countHint && (
                      <span
                        className={`font-mono text-[11px] font-semibold shrink-0 tabular-nums ${
                          active ? 'text-sky-100' : 'text-amber-200'
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
        <div className="p-3 border-t border-white/15 flex items-center justify-between gap-2">
          {!sidebarCompact && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-white/15 border border-white/20 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">
                {cashierInitials || 'KB'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{cashierName}</p>
                <p className="text-[11px] text-blue-100/70 truncate">{user.email}</p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => void handleSignOut()}
            title="Sign out"
            className={`${
              sidebarCompact ? 'mx-auto' : ''
            } min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-xl text-blue-100/70 hover:text-white hover:bg-rose-500/25 transition-colors cursor-pointer shrink-0`}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#EAF5FF]">
        {/* Commercial Top Command Header (52px mobile / 56px desktop) */}
        <header className="sticky top-0 lg:top-3 z-30 h-[52px] lg:h-14 bg-white/75 backdrop-blur-xl border border-white/80 shadow-sm shadow-blue-900/5 rounded-none lg:rounded-2xl mx-0 lg:mx-4 px-4 lg:px-5 flex items-center justify-between gap-3">
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
            {user.isDemo && <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-800 sm:text-[10px]"><span className="sm:hidden">DEMO</span><span className="hidden sm:inline">{user.localDemo ? 'DEMO · LOCAL ONLY' : 'DEMO · VIEW ONLY'}</span></span>}
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
              className="hidden md:inline-flex items-center justify-between gap-3 min-h-[36px] w-52 px-3 py-1.5 text-xs text-slate-600 bg-white/70 hover:bg-white border border-white/90 rounded-xl transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center gap-2 truncate">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Jump to menu...</span>
              </span>
              <span className="font-mono text-[10px] text-slate-400">Ctrl K</span>
            </button>

            {user.role!=='sr' && branches.length > 1 && (
              <select
                aria-label="Active register branch"
                value={activeBranch?.id || ''}
                onChange={(e) => setActiveBranchId(e.target.value)}
                className="hidden sm:block min-h-[36px] px-2.5 py-1 text-xs font-medium bg-white/75 border border-white rounded-xl text-slate-700 focus:outline-none focus:border-sky-500 cursor-pointer"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            )}

            {user.role!=='sr' && activeTab !== 'pos' && (
              <button
                type="button"
                onClick={() => navigateTo('pos')}
                className="min-h-[36px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0756A5] hover:bg-[#06498E] rounded-xl shadow-sm shadow-blue-900/20 transition-colors whitespace-nowrap cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>POS Terminal</span>
              </button>
            )}
          </div>
        </header>

        {/* Active Module Viewport */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1640px] w-full mx-auto bg-[#EAF5FF]">
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
              isSrPortal={user.role==='sr'}
            />
          )}

          {activeTab === 'ledger' && (
            <DueLedgerView
              shop={activeShop}
              customers={customers}
              suppliers={suppliers}
              ledgerEntries={ledgerEntries}
              isSrPortal={user.role==='sr'}
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
              isSrPortal={user.role==='sr'}
              srRouteArea={user.routeArea}
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
        className="lg:hidden fixed bottom-3 left-3 right-3 z-40 bg-[#0756A5]/90 text-white backdrop-blur-2xl border border-white/25 rounded-2xl shadow-2xl shadow-blue-950/25 pb-safe overflow-hidden"
      >
        <div className={`grid ${user.role==='sr' ? 'grid-cols-4' : 'grid-cols-5'} h-16 p-1`}>
          {(
            user.role==='sr' ? [
              { id: 'sr-orders', label: 'Orders', icon: Truck },
              { id: 'ledger', label: 'Due/Baki', icon: BookOpenCheck },
              { id: 'customers', label: 'Retailers', icon: Users },
            ] as const : [
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
                className={`relative flex flex-col items-center justify-center gap-1 min-h-[48px] rounded-xl transition-colors ${
                  active ? 'bg-white/20 text-white font-semibold' : 'text-blue-50/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] leading-none">{item.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className={`relative flex flex-col items-center justify-center gap-1 min-h-[48px] rounded-xl transition-colors ${
              mobileMenuOpen ||
              (user.role==='sr' ? !['sr-orders','ledger','customers'].includes(activeTab) : !['dashboard', 'pos', 'sr-orders', 'ledger'].includes(activeTab))
                ? 'bg-white/20 text-white font-semibold'
                : 'text-blue-50/75 hover:bg-white/10 hover:text-white'
            }`}
          >
            {(mobileMenuOpen ||
              (user.role==='sr' ? !['sr-orders','ledger','customers'].includes(activeTab) : !['dashboard', 'pos', 'sr-orders', 'ledger'].includes(activeTab))) && (
              <span className="absolute inset-1 rounded-xl ring-1 ring-inset ring-white/15 pointer-events-none" />
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
            <div className="bg-[#0756A5] text-white px-5 pt-3 pb-4">
              <div className="w-10 h-1 bg-white/35 rounded-full mx-auto mb-3" />
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
                    <p className="text-xs text-blue-100/75 truncate">
                      {activeShop.address}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menus"
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-white/80 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

              <div className="p-4 overflow-y-auto space-y-5 pb-safe bg-[#EAF5FF]">
              {/* Mobile Shop Switcher */}
              <div className="flex items-center gap-2">
                <select
                  aria-label="Switch shop"
                  value={activeShop.id}
                  onChange={(e) => setActiveShopId(e.target.value)}
                  className="flex-1 min-h-[42px] px-3 py-2 text-xs font-semibold bg-white/85 border border-white rounded-xl text-slate-800 shadow-sm"
                >
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {!user.isDemo && user.role!=='sr' && <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setNewShopModalOpen(true);
                  }}
                  className="min-h-[42px] px-3.5 py-2 text-xs font-semibold text-white bg-[#0756A5] rounded-xl whitespace-nowrap shadow-sm"
                >
                  + New Shop
                </button>}
              </div>

              {visibleNavGroups.map((group) => (
                <div key={group.title} className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0756A5]/70 px-1">
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
                          className={`min-h-[54px] px-3 py-2.5 rounded-2xl border text-left flex items-center gap-2.5 text-xs font-semibold transition-colors ${
                            active
                              ? 'bg-[#0756A5] border-[#0756A5] text-white shadow-md shadow-blue-900/15'
                              : 'bg-white/80 border-white text-slate-800 hover:bg-white'
                          }`}
                        >
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              active ? 'text-sky-100' : 'text-[#0756A5]'
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
