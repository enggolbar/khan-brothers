import React, { useCallback, useEffect, useState } from 'react';
import { Check, Clock3, LogOut, RefreshCw, ShieldCheck, Store, X } from 'lucide-react';
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

interface Props {
  user: AppUser;
  onSignOut: () => void;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json' } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'অনুরোধটি সম্পন্ন করা যায়নি।');
  return body as T;
}

export const AdminApprovalPanel: React.FC<Props> = ({ user, onSignOut }) => {
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try { setRequests(await api<SignupRequest[]>('/api/admin/signup-requests')); }
    catch (e) { setError(e instanceof Error ? e.message : 'অনুরোধগুলো লোড করা যায়নি।'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const decide = async (id: number, decision: 'approve' | 'reject') => {
    setBusyId(id);
    setError('');
    try {
      await api(`/api/admin/signup-requests/${id}/${decision}`, { method: 'POST' });
      setRequests((current) => current.filter((request) => request.id !== id));
    } catch (e) { setError(e instanceof Error ? e.message : 'সিদ্ধান্তটি সংরক্ষণ করা যায়নি।'); }
    finally { setBusyId(null); }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><ShieldCheck className="h-5 w-5" /></span>
            <div><p className="font-display text-sm font-bold">Super Admin</p><p className="text-xs text-slate-500">{user.email}</p></div>
          </div>
          <button type="button" onClick={() => void onSignOut()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><LogOut className="h-4 w-4" /> সাইন আউট</button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Account management</p>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">সাইনআপ অনুমোদন</h1>
            <p className="mt-2 text-sm text-slate-500">অনুমোদনের পর ব্যবহারকারী এই ইমেইল ও পাসওয়ার্ড দিয়ে POS-এ প্রবেশ করতে পারবেন।</p>
          </div>
          <button type="button" onClick={() => { setLoading(true); void refresh(); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> রিফ্রেশ</button>
        </div>

        {error && <p role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
        <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-amber-600" /><h2 className="text-sm font-bold">অপেক্ষমাণ অনুরোধ</h2></div>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{requests.length}</span>
          </div>
          {loading ? <div className="p-10 text-center text-sm text-slate-500">অনুরোধ লোড হচ্ছে…</div> : requests.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-14 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Store className="h-5 w-5" /></span><p className="mt-4 text-sm font-semibold text-slate-700">এখন কোনো অনুরোধ নেই</p><p className="mt-1 text-xs text-slate-500">নতুন সাইনআপ এলে এখানে দেখাবে।</p></div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {requests.map((request) => (
                <li key={request.id} className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{request.display_name} · {request.business_name}</p>
                    <p className="mt-1 truncate text-sm text-slate-600">{request.email} · {request.phone}</p>
                    <p className="mt-1 text-xs text-slate-500">{request.business_type} · {request.address}, {request.district}</p>
                    <p className="mt-1 text-xs text-slate-400">আবেদন: {new Date(request.requested_at).toLocaleString('bn-BD')}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" disabled={busyId !== null} onClick={() => void decide(request.id, 'reject')} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"><X className="h-4 w-4" /> বাতিল</button>
                    <button type="button" disabled={busyId !== null} onClick={() => void decide(request.id, 'approve')} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-50"><Check className="h-4 w-4" /> {busyId === request.id ? 'অপেক্ষা…' : 'অনুমোদন'}</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
};
