import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  Store,
} from 'lucide-react';
import type { SignupFormData } from '../authClient';

type AuthMode = 'login' | 'signup';
type LoginType = 'owner' | 'sr';

interface LandingAuthProps {
  onEmailSignIn: (email: string, password: string) => Promise<void>;
  onSrPhoneSignIn: (phone:string) => Promise<void>;
  onSignUp: (details: SignupFormData) => Promise<void>;
  onClearError: () => void;
  signingIn: boolean;
  authError: string | null;
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10';

export const LandingAuth: React.FC<LandingAuthProps> = ({
  onEmailSignIn,
  onSrPhoneSignIn,
  onSignUp,
  onClearError,
  signingIn,
  authError,
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [loginType, setLoginType] = useState<LoginType>('owner');
  const [srPhone, setSrPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('grocery');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice('');
    setFormError('');
    try {
      if (mode === 'signup') {
        if (password !== confirmPassword) {
          setFormError('দুটি পাসওয়ার্ড মিলছে না।');
          return;
        }
        await onSignUp({
          name: name.trim(), email: email.trim(), phone: phone.trim(),
          businessName: businessName.trim(), businessType, address: address.trim(),
          district: district.trim(), password,
        });
        setPassword('');
        setConfirmPassword('');
        setNotice('সাইনআপ অনুরোধ পাঠানো হয়েছে। সুপার অ্যাডমিন অনুমোদন করলে এই ইমেইল ও পাসওয়ার্ড দিয়ে সাইন ইন করতে পারবেন।');
      } else if(loginType==='sr') await onSrPhoneSignIn(srPhone.trim());
      else await onEmailSignIn(email.trim(), password);
    } catch {
      // The parent translates API errors and displays them in this form.
    }
  };

  const heading = mode === 'signup' ? 'অ্যাকাউন্টের অনুরোধ পাঠান' : 'স্বাগতম';
  const subheading = mode === 'signup'
    ? 'আপনার ও দোকানের তথ্য দিন। সুপার অ্যাডমিন যাচাই করে অ্যাকাউন্ট চালু করবেন।'
    : loginType==='sr' ? 'আপনার নিবন্ধিত SR মোবাইল নম্বর ব্যবহার করুন।' : 'আপনার অনুমোদিত অ্যাকাউন্ট দিয়ে সাইন ইন করুন।';

  return (
    <main className="min-h-screen bg-[#f4f7f6] text-slate-900 lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#0b1820] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute inset-0 opacity-25">
          <img src="/src/assets/images/hero_smart_pos_1795278225917.jpg" alt="" className="h-full w-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b1820]/95 via-[#102a2a]/85 to-emerald-950/70" />

        <div className="relative z-10 flex items-center gap-3">
          <img
            src="/assets/aistudio/M_S_Khan_Brothers_Gold-Blue_Badge_cceec1db.png"
            alt="M/S Khan Brothers"
            className="h-11 w-11 rounded-full border border-white/20 bg-white object-contain"
          />
          <div>
            <p className="font-display text-sm font-bold tracking-wide">M/S Khan Brothers</p>
            <p className="mt-0.5 text-xs text-emerald-100/70">SMART POS · RANGAMATI</p>
          </div>
        </div>

        <div className="relative z-10 max-w-xl py-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-200/10 px-3 py-1.5 text-xs font-medium text-emerald-100">
            <ShieldCheck className="h-3.5 w-3.5" /> আপনার ব্যবসা, এক নিরাপদ workspace
          </span>
          <h1 className="mt-7 font-display text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            দোকানের হিসাব রাখুন,
            <span className="block text-emerald-300">সহজ ও স্মার্টভাবে।</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-200/80">
            বিক্রি, স্টক, বাকি খাতা এবং শাখার কাজ—সব এক জায়গায়। সাইন ইন করলেই আপনার POS workspace প্রস্তুত।
          </p>
          <div className="mt-10 grid max-w-lg grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
              <Store className="h-5 w-5 text-emerald-300" />
              <p className="mt-3 text-sm font-semibold">দ্রুত POS বিলিং</p>
              <p className="mt-1 text-xs leading-5 text-slate-300/70">বারকোড, BDT পেমেন্ট ও রসিদ</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
              <BarChart3 className="h-5 w-5 text-emerald-300" />
              <p className="mt-3 text-sm font-semibold">লাইভ ব্যবসার হিসাব</p>
              <p className="mt-1 text-xs leading-5 text-slate-300/70">স্টক, বিক্রি ও বাকি এক নজরে</p>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-slate-300/55">© {new Date().getFullYear()} M/S Khan Brothers · Mainimukh Bazar, Rangamati</p>
      </section>

      <section className={`flex min-h-screen justify-center px-4 py-8 sm:px-8 lg:px-10 ${mode === 'signup' ? 'items-start lg:py-10' : 'items-center'}`}>
        <div className="w-full max-w-[440px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/assets/aistudio/M_S_Khan_Brothers_Gold-Blue_Badge_cceec1db.png" alt="M/S Khan Brothers" className="h-10 w-10 rounded-full border border-slate-200 bg-white object-contain" />
            <div>
              <p className="font-display text-sm font-bold">M/S Khan Brothers</p>
              <p className="text-[11px] text-slate-500">SMART POS · RANGAMATI</p>
            </div>
          </div>

          <div className="rounded-[28px] border border-white bg-white p-6 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.24)] sm:p-9">
            {mode !== 'login' && (
              <button type="button" onClick={() => { setMode('login'); setNotice(''); onClearError(); }} className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900">
                <ArrowLeft className="h-4 w-4" /> লগইনে ফিরে যান
              </button>
            )}

            <div className="mb-7">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Store className="h-5 w-5" />
              </div>
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-950">{heading}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{subheading}</p>
            </div>

            {mode==='login' && <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              <button type="button" onClick={()=>setLoginType('owner')} className={`min-h-10 rounded-lg text-xs font-semibold ${loginType==='owner'?'bg-white text-emerald-800 shadow-sm':'text-slate-500'}`}>মালিক / Admin</button>
              <button type="button" onClick={()=>setLoginType('sr')} className={`min-h-10 rounded-lg text-xs font-semibold ${loginType==='sr'?'bg-white text-emerald-800 shadow-sm':'text-slate-500'}`}>SR Mobile Login</button>
            </div>}

            <form onSubmit={(event) => void submit(event)} className="space-y-4">
              {mode === 'signup' && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-700">আপনার নাম</span>
                  <span className="relative block">
                    <Store className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input className={inputClass} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="নাম লিখুন" required />
                  </span>
                </label>
              )}

              {mode==='login' && loginType==='sr' && <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">SR-এর নিবন্ধিত মোবাইল নম্বর</span><span className="relative block"><Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input className={inputClass} type="tel" inputMode="tel" autoComplete="tel" value={srPhone} onChange={(e)=>setSrPhone(e.target.value)} placeholder="SR-এর মোবাইল নম্বর" required/></span></label>}

              {(mode==='signup' || (mode==='login' && loginType==='owner')) && <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">ইমেইল</span>
                <span className="relative block">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input className={inputClass} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                </span>
              </label>}

              {mode === 'signup' && (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-slate-700">মোবাইল নম্বর</span>
                      <input className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" required />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-slate-700">দোকান/প্রতিষ্ঠানের নাম</span>
                      <input className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10" autoComplete="organization" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="আপনার দোকানের নাম" required />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-slate-700">ব্যবসার ধরন</span>
                      <select className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10" value={businessType} onChange={(e) => setBusinessType(e.target.value)} required>
                        <option value="grocery">মুদি/গ্রোসারি</option><option value="supermarket">সুপারশপ</option><option value="wholesale">পাইকারি/ডিস্ট্রিবিউশন</option><option value="pharmacy">ফার্মেসি</option><option value="other">অন্যান্য</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-slate-700">জেলা</span>
                      <input className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10" autoComplete="address-level1" value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="জেলার নাম" required />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-700">দোকানের ঠিকানা</span>
                    <textarea className="min-h-[76px] w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10" autoComplete="street-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="বাজার/এলাকা, উপজেলা" required />
                  </label>
                </>
              )}

              {(mode==='signup' || (mode==='login' && loginType==='owner')) && <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-700">পাসওয়ার্ড</span>
                  <span className="relative block">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input className={`${inputClass} pr-12`} type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="কমপক্ষে ৮ অক্ষর" required />
                    <button type="button" aria-label={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখান'} onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </span>
                </label>}

              {mode === 'signup' && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-700">পাসওয়ার্ড নিশ্চিত করুন</span>
                  <span className="relative block">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input className={inputClass} type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="পাসওয়ার্ড আবার লিখুন" required />
                  </span>
                </label>
              )}

              {formError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs text-rose-700">{formError}</p>}
              {authError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs leading-5 text-rose-700">{authError}</p>}
              {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-xs leading-5 text-emerald-800">{notice}</p>}

              <button type="submit" disabled={signingIn} className="group flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white shadow-[0_8px_18px_-8px_rgba(4,120,87,0.7)] transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60">
                {signingIn ? 'অপেক্ষা করুন…' : mode === 'signup' ? 'অনুমোদনের অনুরোধ পাঠান' : 'সাইন ইন করুন'}
                {!signingIn && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
              </button>
            </form>

            {mode === 'login' && loginType==='owner' && (
              <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-xs font-bold text-emerald-900">ডেমো লগইন</p><p className="mt-1 text-[11px] leading-5 text-emerald-800">demo@kbshop.example · Demo@12345</p><p className="text-[10px] text-emerald-700">এই ডেমো ব্রাউজারেই চলে; ডাটাবেজ লাগে না।</p></div>
                  <button type="button" disabled={signingIn} onClick={() => { setEmail('demo@kbshop.example'); setPassword('Demo@12345'); void onEmailSignIn('demo@kbshop.example','Demo@12345').catch(() => undefined); }} className="shrink-0 rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-bold text-white hover:bg-emerald-800 disabled:opacity-50">ডেমো চালান</button>
                </div>
              </div>
            )}

            <p className="mt-6 text-center text-sm text-slate-500">
                {mode === 'signup' ? 'আগে থেকেই অ্যাকাউন্ট আছে?' : loginType==='sr' ? 'ব্যবসার মালিক?' : 'নতুন এখানে?'}{' '}
                <button type="button" onClick={() => { if(loginType==='sr' && mode==='login') setLoginType('owner'); else { setMode(mode === 'signup' ? 'login' : 'signup'); setLoginType('owner'); } setNotice(''); onClearError(); }} className="font-semibold text-emerald-700 hover:text-emerald-800">
                  {mode === 'signup' ? 'সাইন ইন করুন' : loginType==='sr' ? 'মালিক লগইন' : 'অ্যাকাউন্ট তৈরি করুন'}
                </button>
            </p>
          </div>
          <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">সাইন ইন করলে আপনার POS workspace-এর নিরাপদ প্রবেশাধিকার চালু হবে।</p>
          <a
            href="https://anzhitech.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block text-center text-[11px] font-medium text-slate-500 transition hover:text-emerald-700 hover:underline"
          >
            Design &amp; Developed By Eng GH Shrabon, AnZ Hi-Tech Soultion
          </a>
        </div>
      </section>
    </main>
  );
};
