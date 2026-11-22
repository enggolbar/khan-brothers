import React, { useState } from 'react';
import {
  ArrowRight,
  Barcode,
  Check,
  Printer,
  Smartphone,
  Store,
  TrendingUp,
} from 'lucide-react';
import { SAAS_PLANS, formatBDT } from '../types/pos';

interface LandingAuthProps {
  onSignIn: () => Promise<void>;
  signingIn: boolean;
  authError: string | null;
}

export const LandingAuth: React.FC<LandingAuthProps> = ({
  onSignIn,
  signingIn,
  authError,
}) => {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [catalogImgFailed, setCatalogImgFailed] = useState(false);
  const [avatarImgFailed, setAvatarImgFailed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: Exactly 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="inline-flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            <img
              src="/assets/aistudio/M_S_Khan_Brothers_Gold-Blue_Badge_cceec1db.png"
              alt="M/S Khan Brothers Logo"
              className="w-8 h-8 rounded-full bg-white object-contain border border-slate-200 shrink-0"
            />
            <span>M/S Khan Brothers</span>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a
              href="#capabilities"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <a
              href="#bangladesh"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Bangladesh Ready
            </a>
            <a
              href="#pricing"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Pricing
            </a>
            <a
              href="#customers"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Stores
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => void onSignIn()}
              disabled={signingIn}
              className="min-h-[40px] px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {signingIn ? 'Signing in...' : 'Sign in with Google'}
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Balanced 2-Column Hero */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12 lg:pt-16 lg:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <p className="text-xs font-medium text-slate-500">
                Cloud Super Shop POS &amp; Distribution ERP · Mobile &amp; Desktop Browser
              </p>

              <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.85rem] font-bold tracking-tight text-slate-900 leading-[1.12] [text-wrap:balance]">
                Smart checkout, SR field orders, and due ledgers for modern Bangladeshi retail &amp;
                distribution.
              </h1>

              <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                Run barcode billing, bKash and Nagad tenders, Mushak-6.3 VAT receipts, field SR
                market order entry, commission tracking, and customer/supplier due (baki) ledgers
                from any phone or PC browser.
              </p>

              {authError && (
                <div className="p-3.5 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg">
                  {authError}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={() => void onSignIn()}
                  disabled={signingIn}
                  className="min-h-[48px] inline-flex items-center justify-center gap-2.5 px-6 py-3 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <span>{signingIn ? 'Opening Google Sign-In...' : 'Launch Your Cloud Store'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="#pricing"
                  className="min-h-[48px] inline-flex items-center justify-center px-5 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
                >
                  Compare BDT Plans
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-1">
                <span>GS1 894 Barcode Ready</span>
                <span aria-hidden="true">·</span>
                <span>80mm Thermal Print</span>
                <span aria-hidden="true">·</span>
                <span>No hardware lock-in</span>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[280px] sm:min-h-[380px] rounded-2xl overflow-hidden border border-slate-200/90 bg-slate-100 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.18)]">
                {!heroImgFailed ? (
                  <img
                    src="/src/assets/images/hero_smart_pos_1795278225917.jpg"
                    alt="Modern Bangladeshi super shop checkout counter with touchscreen POS terminal and barcode scanner"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-slate-100 to-emerald-50">
                    <Store className="w-10 h-10 text-emerald-700 mb-3" />
                    <p className="font-display font-semibold text-slate-800">
                      BazarGrid Smart Checkout Terminal
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4-Column Commercial Metrics Strip */}
          <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 bg-[#0B1320] text-white border border-slate-800 rounded-2xl divide-y sm:divide-y-0 sm:divide-x divide-slate-800 shadow-[0_8px_24px_-10px_rgba(15,23,42,0.3)]">
            <div className="p-5">
              <p className="font-mono text-2xl font-bold text-emerald-400 tabular-nums">&lt; 2.4s</p>
              <p className="mt-1 text-xs text-slate-400">Average barcode scan-to-receipt checkout</p>
            </div>
            <div className="p-5">
              <p className="font-mono text-2xl font-bold text-white tabular-nums">7 Tenders</p>
              <p className="mt-1 text-xs text-slate-400">Cash, bKash, Nagad, Rocket, Card, Split &amp; Baki</p>
            </div>
            <div className="p-5">
              <p className="font-mono text-2xl font-bold text-white tabular-nums">SR &amp; Ledger</p>
              <p className="mt-1 text-xs text-slate-400">Field order routes, challans &amp; due book</p>
            </div>
            <div className="p-5">
              <p className="font-mono text-2xl font-bold text-white tabular-nums">100% Web</p>
              <p className="mt-1 text-xs text-slate-400">Works on Android, iOS, tablet &amp; PC browsers</p>
            </div>
          </div>
        </section>

        {/* Capabilities Section */}
        <section id="capabilities" className="border-t border-slate-200 bg-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
                Built for high-footfall grocery counters and on-the-go store owners
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
                Every workflow connects counter speed directly to accurate accounting and real-time
                stock visibility.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-6 border border-slate-200 rounded-xl bg-slate-50/50 space-y-3">
                <Barcode className="w-5 h-5 text-emerald-700" />
                <h3 className="font-display text-base font-semibold text-slate-900">
                  USB &amp; Bluetooth Barcode Billing
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Scan standard 894 Bangladesh EAN-13 barcodes directly in the browser with instant
                  line totals, held carts, and quick BDT note tender keys.
                </p>
              </div>

              <div className="p-6 border border-slate-200 rounded-xl bg-slate-50/50 space-y-3">
                <Smartphone className="w-5 h-5 text-emerald-700" />
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Mobile &amp; Desktop Ready
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Cashiers check out on desktop counters while managers restock aisles, check
                  bKash totals, or ring up queues from any smartphone browser.
                </p>
              </div>

              <div className="p-6 border border-slate-200 rounded-xl bg-slate-50/50 space-y-3">
                <Printer className="w-5 h-5 text-emerald-700" />
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Mushak-6.3 Thermal Receipts
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Print 80mm thermal receipts with your NBR BIN number, item-level VAT calculation,
                  bKash TrxID reference, and change due—or copy SMS summaries.
                </p>
              </div>

              <div className="p-6 border border-slate-200 rounded-xl bg-slate-50/50 space-y-3">
                <TrendingUp className="w-5 h-5 text-emerald-700" />
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Live Stock &amp; Profit Ledger
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Every sale deducts stock atomically and every refund restores inventory. Track
                  low-stock alerts, daily revenue, and gross margins in BDT.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Bangladesh Retail Fit + Attributable Testimonial */}
        <section id="bangladesh" className="border-t border-slate-200 bg-slate-50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
              <div className="lg:col-span-5">
                <div className="h-full min-h-[260px] rounded-xl overflow-hidden border border-slate-200 bg-white">
                  {!catalogImgFailed ? (
                    <img
                      src="/src/assets/images/category_grocery_staples_1795278225878.jpg"
                      alt="Fresh grocery staples including rice, cooking oil, tea, and greens"
                      referrerPolicy="no-referrer"
                      onError={() => setCatalogImgFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-500 text-sm">
                      Bangladesh Grocery Catalog Ready
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
                  Pre-configured for Dhaka, Chattogram, and nationwide retail operations
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="p-4 bg-white border border-slate-200 rounded-lg">
                    <p className="text-sm font-semibold text-slate-900">One-Click BD Starter Catalog</p>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      Load 18 essential Bangladeshi super shop SKUs (rice, oil, tea, milk, spices,
                      toiletries) with 894 barcodes in one click to start testing immediately.
                    </p>
                  </div>
                  <div className="p-4 bg-white border border-slate-200 rounded-lg">
                    <p className="text-sm font-semibold text-slate-900">MFS &amp; Cash Reconciliation</p>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      Record bKash, Nagad, and Rocket transaction references per invoice and review
                      exact end-of-day tender totals by payment channel.
                    </p>
                  </div>
                </div>

                {/* Attributable Customer Testimonial */}
                <div
                  id="customers"
                  className="p-5 bg-white border border-slate-200 rounded-xl flex items-start gap-4"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                    {!avatarImgFailed ? (
                      <img
                        src="/src/assets/images/avatar_shop_owner_1795278225981.jpg"
                        alt="Farhana Rahman, Managing Partner at Uttara Fresh Mart"
                        referrerPolicy="no-referrer"
                        onError={() => setAvatarImgFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-slate-600">
                        FR
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      “Before switching to BazarGrid, evening rush queues backed up whenever our
                      cashier checked bKash screenshots manually. Cutting checkout time under 15
                      seconds per basket lifted our peak-hour throughput by 34% across two Uttara
                      outlets.”
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-900">Farhana Rahman</span> ·
                      Managing Partner, Uttara Fresh Mart, Dhaka
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SaaS Pricing in BDT */}
        <section id="pricing" className="border-t border-slate-200 bg-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Transparent monthly SaaS plans in BDT
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Start immediately with your Google account. Switch plans anytime inside Shop
                Settings as your branch count grows.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
              {SAAS_PLANS.map((plan) => {
                const isPopular = plan.id === 'growth';
                return (
                  <div
                    key={plan.id}
                    className={`p-6 rounded-xl border flex flex-col justify-between ${
                      isPopular
                        ? 'border-emerald-700 bg-emerald-50/30'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="font-display text-lg font-bold text-slate-900">
                          {plan.name}
                        </h3>
                        {isPopular && (
                          <span className="text-xs font-semibold text-emerald-700">
                            Most chosen
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{plan.audience}</p>

                      <div className="mt-5 pb-5 border-b border-slate-200">
                        <span className="font-mono text-3xl font-bold text-slate-900 tabular-nums">
                          {formatBDT(plan.monthlyPriceBdt, false)}
                        </span>
                        <span className="text-xs text-slate-500"> / month</span>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-600 pb-4 border-b border-slate-100">
                        <div>
                          <p className="font-mono font-semibold text-slate-900 tabular-nums">
                            {plan.maxSkus.toLocaleString()}
                          </p>
                          <p className="text-slate-500">SKUs</p>
                        </div>
                        <div>
                          <p className="font-mono font-semibold text-slate-900 tabular-nums">
                            {plan.maxBranches}
                          </p>
                          <p className="text-slate-500">Branches</p>
                        </div>
                        <div>
                          <p className="font-mono font-semibold text-slate-900 tabular-nums">
                            {(plan.maxMonthlyInvoices / 1000).toFixed(0)}k
                          </p>
                          <p className="text-slate-500">Bills/mo</p>
                        </div>
                      </div>

                      <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
                        {plan.highlights.map((item) => (
                          <li key={item} className="flex items-start gap-2.5">
                            <Check className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() => void onSignIn()}
                      disabled={signingIn}
                      className={`mt-6 w-full min-h-[44px] px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors cursor-pointer ${
                        isPopular
                          ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      Start with {plan.name}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p className="inline-flex items-center gap-2">
            <img
              src="/assets/aistudio/M_S_Khan_Brothers_Gold-Blue_Badge_cceec1db.png"
              alt="M/S Khan Brothers"
              className="w-5 h-5 rounded-full object-contain"
            />
            <span>© {new Date().getFullYear()} M/S Khan Brothers · Mainimukh Bazar, Dongudu, Rangamati</span>
          </p>
          <p>BDT Currency · Mushak-6.3 VAT Ready · Mobile &amp; Desktop Browser POS</p>
        </div>
      </footer>
    </div>
  );
};
