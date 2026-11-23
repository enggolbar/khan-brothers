import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Building2, Check, Clock3, Database, LogOut, RefreshCw, ShieldCheck, Store, Users, X } from 'lucide-react';
import type { AppUser } from '../authClient';

interface SignupRequest {
  id: number;
  display_name: string;
  email: string;
  status: 'pending';
  requested_at: string;
  phone: string;
  business_name: string;
  business_type: string;
  address: string;
  district: string;
}

interface Overview {
  total_owners: number;
  active_owners: number;
  disabled_owners: number;
  total_shops: number;
  pending_signups: number;
  total_products: number;
  total_sales: number;
  total_customers: number;
  total_branches: number;
}

interface ShopRow {
  id: string;
  owner_id: string;
  name: string;
  branch_name: string;
  phone: string;
  plan: 'starter' | 'growth' | 'enterprise';
  updated_at: string;
  owner_name: string;
  owner_email: string;
  owner_status: 'active' | 'disabled';
  products: number;
  sales: number;
  customers: number;
  branches: number;
}

interface OwnerRow {
  id: string;
  display_name: string;
  email: string;
  status: 'active' | 'disabled';
  created_at: string;
  shops: number;
}

type AdminTab = 'overview' | 'signups' | 'businesses' | 'accounts';

interface Props {
  user: AppUser;
  onSignOut: () => void;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'অনুরোধটি সম্পন্ন করা যায়নি।');
  return body as T;
}

const number = (value: number | string | undefined) => Number(value || 0).toLocaleString('bn-BD');
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('bn-BD') : '—';

export const AdminApprovalPanel: React.FC<Props> = ({ user, onSignOut }) => {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [planDrafts, setPlanDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [nextOverview, nextRequests, nextShops, nextOwners] = await Promise.all([
        api<Overview>('/api/admin/overview'),
        api<SignupRequest[]>('/api/admin/signup-requests'),
        api<ShopRow[]>('/api/admin/shops'),
        api<OwnerRow[]>('/api/admin/users'),
      ]);
      setOverview(nextOverview);
      setRequests(nextRequests);
      setShops(nextShops);
      setOwners(nextOwners);
      setPlanDrafts(Object.fromEntries(nextShops.map((shop) => [shop.id, shop.plan])));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'অ্যাডমিন তথ্য লোড করা যায়নি।');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const decide = async (id: number, decision: 'approve' | 'reject') => {
    setBusyKey(`signup-${id}`);
    setError('');
    try {
      await api(`/api/admin/signup-requests/${id}/${decision}`, { method: 'POST' });
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'সিদ্ধান্তটি সংরক্ষণ করা যায়নি।'); }
    finally { setBusyKey(null); }
  };

  const setOwnerStatus = async (owner: OwnerRow) => {
    const status = owner.status === 'active' ? 'disabled' : 'active';
    const action = status === 'disabled' ? 'এই মালিকের সব লগইন বন্ধ' : 'এই মালিকের অ্যাকাউন্ট চালু';
    if (!window.confirm(`${action} করবেন?`)) return;
    setBusyKey(`owner-${owner.id}`);
    setError('');
    try {
      await api(`/api/admin/users/${owner.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'অ্যাকাউন্ট আপডেট করা যায়নি।'); }
    finally { setBusyKey(null); }
  };

  const savePlan = async (shop: ShopRow) => {
    const plan = planDrafts[shop.id] || shop.plan;
    if (plan === shop.plan) return;
    setBusyKey(`plan-${shop.id}`);
    setError('');
    try {
      await api(`/api/admin/shops/${shop.id}/plan`, { method: 'PATCH', body: JSON.stringify({ plan }) });
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'প্ল্যান আপডেট করা যায়নি।'); }
    finally { setBusyKey(null); }
  };

  const nav: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { id: 'overview', label: 'সিস্টেম সারাংশ', icon: Activity },
    { id: 'signups', label: 'সাইনআপ অনুরোধ', icon: Clock3, count: requests.length },
    { id: 'businesses', label: 'ব্যবসা ও প্ল্যান', icon: Store },
    { id: 'accounts', label: 'মালিক অ্যাকাউন্ট', icon: Users },
  ];

  const filteredShops = shops.filter((shop) => `${shop.name} ${shop.owner_name} ${shop.owner_email} ${shop.phone}`.toLowerCase().includes(query.toLowerCase()));
  const filteredOwners = owners.filter((owner) => `${owner.display_name} ${owner.email}`.toLowerCase().includes(query.toLowerCase()));
  const heading = nav.find((item) => item.id === tab)?.label || 'সিস্টেম সারাংশ';
  const metrics = overview ? [
    { label: 'মালিক অ্যাকাউন্ট', value: overview.total_owners, detail: `${number(overview.active_owners)} সক্রিয় · ${number(overview.disabled_owners)} বন্ধ`, icon: Users, color: 'blue' },
    { label: 'দোকান / ব্যবসা', value: overview.total_shops, detail: `${number(overview.total_branches)} শাখা`, icon: Store, color: 'emerald' },
    { label: 'অপেক্ষমাণ সাইনআপ', value: overview.pending_signups, detail: 'অনুমোদনের অপেক্ষায়', icon: Clock3, color: 'amber' },
    { label: 'প্রডাক্ট ক্যাটালগ', value: overview.total_products, detail: 'সব দোকান মিলিয়ে', icon: Database, color: 'violet' },
    { label: 'রেকর্ডকৃত বিক্রি', value: overview.total_sales, detail: `${number(overview.total_customers)} ক্রেতা রেকর্ড`, icon: Activity, color: 'cyan' },
  ] : [];

  return (
    <main className="min-h-screen bg-[#eef6ff] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-blue-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-800"><ShieldCheck className="h-5 w-5" /></span>
            <div><p className="font-display text-sm font-bold">AnZ-Soft Control Center</p><p className="text-xs text-slate-500">{user.email}</p></div>
          </div>
          <button type="button" onClick={() => void onSignOut()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><LogOut className="h-4 w-4" /> সাইন আউট</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-blue-100 bg-white p-3 shadow-sm lg:sticky lg:top-[82px]">
          <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Admin tools</p>
          <nav className="grid grid-cols-2 gap-1 lg:grid-cols-1">
            {nav.map((item) => {
              const Icon = item.icon;
              return <button key={item.id} type="button" onClick={() => { setTab(item.id); setQuery(''); }} className={`flex min-h-10 items-center gap-2 rounded-xl px-3 text-left text-xs font-semibold transition ${tab === item.id ? 'bg-blue-800 text-white shadow-sm' : 'text-slate-600 hover:bg-blue-50 hover:text-blue-800'}`}><Icon className="h-4 w-4 shrink-0" /><span className="flex-1">{item.label}</span>{item.count ? <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${tab === item.id ? 'bg-white/20' : 'bg-amber-50 text-amber-700'}`}>{number(item.count)}</span> : null}</button>;
            })}
          </nav>
          <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-[11px] leading-5 text-emerald-800"><p className="font-bold">POS Database</p><p>এই কন্ট্রোল প্যানেল শুধু AnZ-Soft-এর `kb_*` ডেটা ও অ্যাকাউন্ট পরিচালনা করে।</p></div>
        </aside>

        <section className="min-w-0">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">Platform administration</p><h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">{heading}</h1><p className="mt-1 text-sm text-slate-500">অ্যাকাউন্ট, ব্যবসা, ব্যবহার ও অনুমোদন এক জায়গা থেকে পরিচালনা করুন।</p></div>
            <button type="button" disabled={loading} onClick={() => { setLoading(true); void refresh(); }} className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-blue-100 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-blue-50 disabled:opacity-50 sm:self-auto"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> রিফ্রেশ</button>
          </div>

          {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
          {loading && !overview ? <div className="mt-6 rounded-2xl border border-blue-100 bg-white p-12 text-center text-sm text-slate-500">সিস্টেমের তথ্য লোড হচ্ছে…</div> : <>
            {tab === 'overview' && <>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {metrics.map((metric) => {
                  const Icon = metric.icon;
                  return <article key={metric.label} className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-slate-500">{metric.label}</p><p className="mt-2 font-mono text-3xl font-bold tabular-nums text-slate-900">{number(metric.value)}</p></div><span className="rounded-xl bg-blue-50 p-2.5 text-blue-800"><Icon className="h-5 w-5" /></span></div><p className="mt-2 text-[11px] text-slate-500">{metric.detail}</p></article>;
                })}
              </div>
              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <article className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-amber-600" /><h2 className="text-sm font-bold">সাম্প্রতিক সাইনআপ অনুরোধ</h2></div><p className="mt-2 text-sm text-slate-500">এখন {number(requests.length)}টি অনুরোধ অপেক্ষমাণ।</p><button type="button" onClick={() => setTab('signups')} className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100">অনুরোধ পর্যালোচনা করুন</button></article>
                <article className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-emerald-700" /><h2 className="text-sm font-bold">ব্যবসা ও প্ল্যান</h2></div><p className="mt-2 text-sm text-slate-500">{number(shops.length)}টি POS workspace-এর প্ল্যান ও ব্যবহার পর্যালোচনা করুন।</p><button type="button" onClick={() => setTab('businesses')} className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100">ব্যবসার তালিকা খুলুন</button></article>
              </div>
            </>}

            {tab === 'signups' && <div className="mt-6 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-amber-600" /><h2 className="text-sm font-bold">অপেক্ষমাণ অনুরোধ</h2></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{number(requests.length)}</span></div>
              {requests.length === 0 ? <div className="flex flex-col items-center px-5 py-14 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Store className="h-5 w-5" /></span><p className="mt-4 text-sm font-semibold text-slate-700">এখন কোনো অনুরোধ নেই</p><p className="mt-1 text-xs text-slate-500">নতুন সাইনআপ এলে এখানে দেখাবে।</p></div> : <ul className="divide-y divide-slate-100">{requests.map((request) => <li key={request.id} className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{request.display_name} · {request.business_name}</p><p className="mt-1 truncate text-sm text-slate-600">{request.email} · {request.phone}</p><p className="mt-1 text-xs text-slate-500">{request.business_type} · {request.address}, {request.district}</p><p className="mt-1 text-xs text-slate-400">আবেদন: {new Date(request.requested_at).toLocaleString('bn-BD')}</p></div><div className="flex shrink-0 gap-2"><button type="button" disabled={busyKey !== null} onClick={() => void decide(request.id, 'reject')} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><X className="h-4 w-4" /> বাতিল</button><button type="button" disabled={busyKey !== null} onClick={() => void decide(request.id, 'approve')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"><Check className="h-4 w-4" /> {busyKey === `signup-${request.id}` ? 'অপেক্ষা…' : 'অনুমোদন'}</button></div></li>)}</ul>}
            </div>}

            {tab === 'businesses' && <div className="mt-6 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold">POS ব্যবসা ও ব্যবহার</h2><p className="mt-1 text-xs text-slate-500">প্রডাক্ট, বিক্রি, ক্রেতা, শাখা ও সাবস্ক্রিপশন প্ল্যান</p></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="দোকান, মালিক বা ইমেইল খুঁজুন" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-600 sm:max-w-xs" /></div>
              <div className="overflow-x-auto"><table className="min-w-[920px] w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">ব্যবসা</th><th className="px-4 py-3">মালিক</th><th className="px-4 py-3">ব্যবহার</th><th className="px-4 py-3">প্ল্যান</th><th className="px-4 py-3">অবস্থা</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredShops.map((shop) => <tr key={shop.id} className="align-top"><td className="px-4 py-4"><p className="font-bold text-slate-900">{shop.name}</p><p className="mt-1 text-slate-500">{shop.branch_name || 'শাখা নির্ধারিত নয়'} · {shop.phone || 'ফোন নেই'}</p><p className="mt-1 font-mono text-[10px] text-slate-400">{shop.id}</p></td><td className="px-4 py-4"><p className="font-semibold text-slate-800">{shop.owner_name}</p><p className="mt-1 text-slate-500">{shop.owner_email}</p></td><td className="px-4 py-4 leading-5 text-slate-600">{number(shop.products)} পণ্য · {number(shop.sales)} বিক্রি<br />{number(shop.customers)} ক্রেতা · {number(shop.branches)} শাখা</td><td className="px-4 py-4"><div className="flex items-center gap-2"><select aria-label={`${shop.name} প্ল্যান`} value={planDrafts[shop.id] || shop.plan} onChange={(event) => setPlanDrafts((current) => ({ ...current, [shop.id]: event.target.value }))} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"><option value="starter">Starter</option><option value="growth">Growth</option><option value="enterprise">Enterprise</option></select><button type="button" disabled={busyKey !== null || (planDrafts[shop.id] || shop.plan) === shop.plan} onClick={() => void savePlan(shop)} className="rounded-lg bg-blue-800 px-2.5 py-2 font-bold text-white disabled:bg-slate-200 disabled:text-slate-500">{busyKey === `plan-${shop.id}` ? '…' : 'Save'}</button></div></td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 font-semibold ${shop.owner_status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{shop.owner_status === 'active' ? 'সক্রিয়' : 'বন্ধ'}</span><p className="mt-2 text-[10px] text-slate-400">আপডেট {date(shop.updated_at)}</p></td></tr>)}</tbody></table>{filteredShops.length === 0 && <p className="p-8 text-center text-sm text-slate-500">কোনো ব্যবসা পাওয়া যায়নি।</p>}</div>
            </div>}

            {tab === 'accounts' && <div className="mt-6 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold">মালিক অ্যাকাউন্ট পরিচালনা</h2><p className="mt-1 text-xs text-slate-500">অ্যাকাউন্ট বন্ধ করলে মালিকের সব POS workspace-এ প্রবেশ বন্ধ হবে।</p></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="নাম বা ইমেইল খুঁজুন" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-600 sm:max-w-xs" /></div>
              <div className="overflow-x-auto"><table className="min-w-[680px] w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">মালিক</th><th className="px-4 py-3">POS workspace</th><th className="px-4 py-3">তৈরি</th><th className="px-4 py-3">অবস্থা</th><th className="px-4 py-3 text-right">কন্ট্রোল</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredOwners.map((owner) => <tr key={owner.id}><td className="px-4 py-4"><p className="font-bold text-slate-900">{owner.display_name}</p><p className="mt-1 text-slate-500">{owner.email}</p></td><td className="px-4 py-4">{number(owner.shops)}টি</td><td className="px-4 py-4 text-slate-500">{date(owner.created_at)}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 font-semibold ${owner.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{owner.status === 'active' ? 'সক্রিয়' : 'বন্ধ'}</span></td><td className="px-4 py-4 text-right"><button type="button" disabled={busyKey !== null} onClick={() => void setOwnerStatus(owner)} className={`rounded-lg px-3 py-2 font-bold disabled:opacity-50 ${owner.status === 'active' ? 'border border-rose-200 text-rose-700 hover:bg-rose-50' : 'bg-emerald-700 text-white hover:bg-emerald-800'}`}>{busyKey === `owner-${owner.id}` ? 'অপেক্ষা…' : owner.status === 'active' ? 'Suspend' : 'Activate'}</button></td></tr>)}</tbody></table>{filteredOwners.length === 0 && <p className="p-8 text-center text-sm text-slate-500">কোনো অ্যাকাউন্ট পাওয়া যায়নি।</p>}</div>
            </div>}
          </>}
        </section>
      </div>
    </main>
  );
};
