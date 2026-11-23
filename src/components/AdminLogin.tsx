import React, { useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';

interface Props {
  onSignIn: (email: string, password: string) => Promise<void>;
  signingIn: boolean;
  error: string | null;
}

export const AdminLogin: React.FC<Props> = ({ onSignIn, signingIn, error }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await onSignIn(email.trim(), password);
    } catch {
      // Parent displays the translated authentication error.
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eaf5ff] px-4 py-10 text-slate-900">
      <section className="w-full max-w-md rounded-[28px] border border-white bg-white p-7 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.28)] sm:p-10">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-800">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">AnZ-Soft · Secure console</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">সুপার অ্যাডমিন লগইন</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">এই প্যানেল শুধু অনুমোদিত সফটওয়্যার অ্যাডমিনের জন্য।</p>

        <form onSubmit={(event) => void submit(event)} className="mt-7 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">অ্যাডমিন ইমেইল</span>
            <span className="relative block">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" required />
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">পাসওয়ার্ড</span>
            <span className="relative block">
              <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-12 text-sm outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              <button type="button" aria-label={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখান'} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>
          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-700">{error}</p>}
          <button type="submit" disabled={signingIn} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-800 px-4 text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-900 disabled:cursor-wait disabled:opacity-60">
            {signingIn ? 'যাচাই হচ্ছে…' : 'অ্যাডমিন প্যানেলে প্রবেশ'}
          </button>
        </form>
        <p className="mt-6 text-center text-[11px] text-slate-400">ব্যবসার মালিক হলে মূল ডোমেইনের লগইন ব্যবহার করুন।</p>
      </section>
    </main>
  );
};
