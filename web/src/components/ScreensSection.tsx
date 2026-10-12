'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, MonitorPlay, Sparkles } from 'lucide-react';
import { ANALYSIS_CONFIG, RISK_LEVEL_BANDS } from '@/lib/trafficAnalytics';

/* ------------------------------------------------------------------ *
 * Nine tiny mock-ups, one per screen in PRD § 11.
 * ------------------------------------------------------------------ */

const bar = (w: string, tone = 'bg-emerald-600') => (
  <span className="block h-1.5 rounded-full bg-[#0E4225]/10">
    <span className={`block h-full rounded-full ${tone}`} style={{ width: w }} />
  </span>
);

const cell = (h: string, w = 'h-2.5 w-16') => <span className={`block ${w} rounded bg-[#0E4225]/12`} />;
const cellWide = (h: string, w = 'h-2.5 w-24') => <span className={`block ${w} rounded bg-[#0E4225]/12`} />;

function LoginMock() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 p-4">
      <div className="h-7 w-7 rounded-xl bg-[#0E4225]" />
      <span className="font-mono text-[9px] font-black uppercase tracking-[0.25em] text-[#0E4225]/40">
        SmartTraffic Analytics
      </span>
      <div className="mt-1 w-40 space-y-1.5">
        <span className="block h-6 rounded-lg border border-[#0E4225]/15 bg-white" />
        <span className="block h-6 rounded-lg border border-[#0E4225]/15 bg-white" />
        <span className="block h-6 rounded-lg bg-[#0E4225]" />
      </div>
    </div>
  );
}

function DashboardMock() {
  return (
    <div className="space-y-2.5 p-3">
      <div className="grid grid-cols-3 gap-1.5">
        {['240', '288', '1,295'].map((v) => (
          <div key={v} className="rounded-lg border border-[#0E4225]/12 bg-white p-1.5">
            <span className="block h-1 w-8 rounded bg-[#0E4225]/15" />
            <span className="mt-1 block font-mono text-[11px] font-black text-[#0E4225]">{v}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1">
        {['Low', 'Med', 'High', 'Crit', ''].map((l, i) => (
          <div key={i} className="space-y-0.5">
            {bar(`${[30, 45, 70, 90, 55][i]}%`, ['bg-emerald-500', 'bg-amber-400', 'bg-orange-500', 'bg-red-500', 'bg-emerald-500'][i])}
            <span className="block text-center text-[7px] font-bold text-[#0E4225]/40">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DriversMock() {
  return (
    <div className="space-y-1.5 p-3">
      <span className="block h-5 w-full rounded-lg border border-[#0E4225]/15 bg-white" />
      {['D1042', 'D0388', 'D0611', 'D0203', 'D0917'].map((id, i) => (
        <div key={id} className="flex items-center gap-2 rounded-lg border border-[#0E4225]/10 bg-white px-2 py-1.5">
          <span className="font-mono text-[8px] font-black text-[#0E4225]/50">{id}</span>
          {cell('', 'h-1.5 flex-1')}
          <span
            className={`rounded px-1 py-0.5 text-[7px] font-black uppercase ${
              ['bg-orange-100 text-orange-800', 'bg-red-100 text-red-800', 'bg-amber-100 text-amber-800', 'bg-emerald-100 text-emerald-800', 'bg-amber-100 text-amber-800'][i]
            }`}
          >
            {['HIGH', 'CRITICAL', 'MEDIUM', 'LOW', 'MEDIUM'][i]}
          </span>
        </div>
      ))}
    </div>
  );
}

function VehiclesMock() {
  return (
    <div className="space-y-1.5 p-3">
      <div className="grid grid-cols-4 gap-1.5">
        {['TN 09 AB 1234', 'TN 07 MZ 8871', 'TN 10 CR 4520'].map((v) => (
          <div key={v} className="rounded-lg border border-[#0E4225]/10 bg-white p-1.5">
            <span className="block font-mono text-[7px] font-black text-[#0E4225]">{v}</span>
            {bar('55%')}
          </div>
        ))}
      </div>
      <div className="space-y-1 rounded-lg border border-[#0E4225]/10 bg-white p-2">
        {bar('78%', 'bg-orange-500')}
        {bar('46%', 'bg-amber-400')}
        {bar('22%', 'bg-emerald-500')}
      </div>
    </div>
  );
}

function ViolationMock() {
  return (
    <div className="space-y-1.5 p-3">
      <div className="grid grid-cols-2 gap-1.5">
        {['Driver', 'Vehicle', 'Offence', 'Location'].map((l) => (
          <div key={l} className="rounded-lg border border-[#0E4225]/12 bg-white p-1.5">
            <span className="block text-[7px] font-black uppercase tracking-wider text-[#0E4225]/40">{l}</span>
            <span className="mt-0.5 block h-1.5 rounded bg-[#0E4225]/12" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-lg bg-[#0E4225] px-2 py-1.5">
        <span className="text-[8px] font-black text-[#FBF5DD]">Fine ₹2,000 · MAJOR</span>
        <span className="text-[7px] font-bold text-[#FBF5DD]/60">calculated</span>
      </div>
    </div>
  );
}

function RiskMock() {
  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 60 34" className="w-20 shrink-0">
          <path d="M5 32a25 25 0 0 1 50 0" fill="none" stroke="#0E4225" strokeOpacity="0.12" strokeWidth="6" strokeLinecap="round" />
          <path
            d="M5 32a25 25 0 0 1 50 0"
            fill="none"
            stroke="#f97316"
            strokeWidth="6"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="76 100"
          />
          <text x="30" y="29" textAnchor="middle" fontSize="11" fontWeight="900" fill="#0E4225">
            76
          </text>
        </svg>
        <div className="flex-1 space-y-1">
          {[['Freq', '82'], ['Recent', '61'], ['Repeat', '77'], ['Sever', '55']].map(([l, v]) => (
            <div key={l} className="flex items-center gap-1.5">
              <span className="w-9 text-[7px] font-bold text-[#0E4225]/50">{l}</span>
              {bar(`${v}%`)}
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-[#0E4225]/10 bg-white p-2 text-[7px] font-bold text-[#0E4225]/55">
        Rule: 3 overspeeding records in 60 days → repeated pattern
      </div>
    </div>
  );
}

function AnalyticsMock() {
  return (
    <div className="space-y-2 p-3">
      <div className="flex h-16 items-end gap-1">
        {[34, 48, 40, 62, 55, 70, 58, 76, 64, 50, 44, 60].map((h, i) => (
          <span key={i} className="flex-1 rounded-t bg-emerald-500/80" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {['Hotspot', 'Time', 'Trend'].map((t) => (
          <span key={t} className="rounded bg-[#F6EDCC] py-1 text-center text-[7px] font-black text-[#0E4225]/60">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function AlertsMock() {
  return (
    <div className="space-y-1.5 p-3">
      {[
        ['HIGH', 'Repeated pattern detected', 'bg-red-100 text-red-800'],
        ['MED', 'Frequency increase this month', 'bg-amber-100 text-amber-800'],
        ['LOW', 'Improvement trend observed', 'bg-emerald-100 text-emerald-800'],
      ].map(([sev, text, tone]) => (
        <div key={text} className="rounded-lg border border-[#0E4225]/10 bg-white p-1.5">
          <div className="flex items-center gap-1.5">
            <span className={`rounded px-1 py-0.5 text-[7px] font-black uppercase ${tone}`}>{sev}</span>
            {cell('', 'h-1.5 flex-1')}
          </div>
          <span className="mt-1 block text-[7px] font-bold text-[#0E4225]/55">{text}</span>
        </div>
      ))}
    </div>
  );
}

function ReportsMock() {
  return (
    <div className="space-y-1.5 p-3">
      <div className="flex gap-1.5">
        {['Summary', 'Hotspot', 'Time', 'Risk', 'Driver'].map((t, i) => (
          <span
            key={t}
            className={`flex-1 rounded py-1 text-center text-[7px] font-black ${
              i === 4 ? 'bg-[#0E4225] text-[#FBF5DD]' : 'bg-white text-[#0E4225]/50'
            }`}
          >
            {t}
          </span>
        ))}
      </div>
      <div className="space-y-1 rounded-lg border border-[#0E4225]/10 bg-white p-2 font-mono text-[7px] leading-relaxed text-[#0E4225]/50">
        <span className="block">SMART TRAFFIC ANALYTICS</span>
        {cellWide('', 'h-1 w-full')}
        {cellWide('', 'h-1 w-4/5')}
        {cellWide('', 'h-1 w-3/5')}
        <span className="mt-1 block text-[#0E4225]/35">Decision support only.</span>
      </div>
    </div>
  );
}

const SCREENS = [
  { n: 1, id: 'login', name: 'Login', fr: 'FR-01', mock: <LoginMock />, blurb: 'Username and password, role-based access, no public sign-up.' },
  { n: 2, id: 'dashboard', name: 'Dashboard', fr: 'FR-12', mock: <DashboardMock />, blurb: 'Totals, pending fines, high-risk count, top offence, top hotspot, peak period, risk distribution.' },
  { n: 3, id: 'drivers', name: 'Drivers', fr: 'FR-02', mock: <DriversMock />, blurb: 'Searchable registry, add or edit a driver, open the full violation history and risk score.' },
  { n: 4, id: 'vehicles', name: 'Vehicles', fr: 'FR-03', mock: <VehiclesMock />, blurb: 'Search by number, link a vehicle to a driver, review its record and registration status.' },
  { n: 5, id: 'violation', name: 'Record Violation', fr: 'FR-04', mock: <ViolationMock />, blurb: 'Single entry form. The fine comes from the rule table and the analytics pipeline re-runs.' },
  { n: 6, id: 'risk', name: 'Risk Analysis', fr: 'FR-06', mock: <RiskMock />, blurb: 'Score, band, factor-by-factor arithmetic and the detected-pattern rules behind it.' },
  { n: 7, id: 'analytics', name: 'Analytics', fr: 'FR-08', mock: <AnalyticsMock />, blurb: 'Hotspots, time-of-day and weekday concentration, trend comparison, scenario estimates.' },
  { n: 8, id: 'alerts', name: 'Alerts', fr: 'FR-10', mock: <AlertsMock />, blurb: 'Trigger, severity, affected driver or location, date, recommendation and status.' },
  { n: 9, id: 'reports', name: 'Reports', fr: 'FR-13', mock: <ReportsMock />, blurb: 'Six report types, previewed on screen and exportable as text or CSV.' },
];

export default function ScreensSection() {
  const [active, setActive] = useState(6);
  const screen = SCREENS[active];

  return (
    <section id="screens" className="relative overflow-hidden border-t border-[#0E4225]/10 py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <span className="mb-3 block text-xs font-semibold uppercase tracking-widest text-[#28734A]">
            Screen tour
          </span>
          <h2 className="text-4xl font-black tracking-tight text-[#0E4225] sm:text-6xl">Nine screens, end to end</h2>
          <p className="mt-4 text-base font-medium text-[#0E4225]/70 sm:text-lg">
            Pick a screen to preview it. Sign in to use the real thing instead of the mock-up.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* ------------------------------------------- console mockup */}
          <div className="order-2 lg:order-1">
            <div className="overflow-hidden rounded-3xl border border-[#0E4225]/15 bg-white shadow-[0_28px_60px_-40px_rgba(14,66,37,0.6)]">
              <div className="flex items-center gap-2 border-b border-[#0E4225]/10 bg-[#F6EDCC]/70 px-4 py-2.5">
                <span className="flex gap-1.5">
                  {['bg-red-400', 'bg-amber-400', 'bg-emerald-500'].map((c) => (
                    <span key={c} className={`h-2.5 w-2.5 rounded-full ${c}`} />
                  ))}
                </span>
                <span className="mx-auto rounded-md bg-white/80 px-3 py-1 font-mono text-[10px] font-bold text-[#0E4225]/50">
                  SmartTraffic-Console — Screen {screen.n}
                </span>
                <span className="hidden rounded-md border border-[#0E4225]/15 px-2 py-0.5 font-mono text-[9px] font-black uppercase text-[#0E4225]/50 sm:inline-block">
                  {screen.fr}
                </span>
              </div>

              <div className="flex min-h-[380px] flex-col sm:flex-row">
                {/* sidebar */}
                <div className="hidden w-40 shrink-0 space-y-1 border-r border-[#0E4225]/10 bg-[#FBF5DD] p-3 sm:block">
                  {SCREENS.map((s) => (
                    <div
                      key={s.n}
                      className={`rounded-lg px-2 py-1.5 text-[10px] font-black ${
                        s.n === screen.n ? 'bg-[#0E4225] text-[#FBF5DD]' : 'text-[#0E4225]/40'
                      }`}
                    >
                      {s.n}. {s.name}
                    </div>
                  ))}
                </div>

                {/* content */}
                <div className="min-w-0 flex-1 bg-[#FBF5DD]">
                  <div className="flex items-center justify-between border-b border-[#0E4225]/10 px-4 py-2.5">
                    <span className="text-xs font-black tracking-tight text-[#0E4225]">{screen.name}</span>
                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[#0E4225]/35">
                      {screen.fr}
                    </span>
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={screen.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                      className="min-h-[300px]"
                    >
                      {screen.mock}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>

          {/* --------------------------------------------- screen picker */}
          <div className="order-1 lg:order-2">
            <div className="rounded-3xl border border-[#0E4225]/12 bg-white/80 p-5">
              <div className="flex items-center gap-2">
                <MonitorPlay className="h-4 w-4 text-[#28734A]" />
                <h3 className="text-sm font-black tracking-tight text-[#0E4225]">Select a screen</h3>
              </div>

              <ul className="mt-4 space-y-1.5">
                {SCREENS.map((s) => (
                  <li key={s.n}>
                    <button
                      onClick={() => setActive(s.n - 1)}
                      className={`flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                        s.n === screen.n
                          ? 'border-[#0E4225] bg-[#0E4225] text-[#FBF5DD]'
                          : 'border-[#0E4225]/12 bg-white hover:border-[#28734A]'
                      }`}
                    >
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg font-mono text-[10px] font-black ${
                          s.n === screen.n ? 'bg-white/15 text-[#FBF5DD]' : 'bg-[#0E4225]/8 text-[#0E4225]/55'
                        }`}
                      >
                        {s.n}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-black">{s.name}</span>
                        <span
                          className={`block font-mono text-[9px] font-bold uppercase tracking-wider ${
                            s.n === screen.n ? 'text-[#FBF5DD]/55' : 'text-[#0E4225]/40'
                          }`}
                        >
                          {s.fr}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-4 rounded-2xl border border-[#0E4225]/12 bg-[#F6EDCC]/60 p-3">
                <p className="text-[11px] font-black text-[#0E4225]">{screen.name}</p>
                <p className="mt-1 text-[11px] font-medium leading-relaxed text-[#0E4225]/70">{screen.blurb}</p>
              </div>

              <Link
                href="/auth"
                className="group mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#28734A] py-3 text-xs font-black text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[#1E5A38]"
              >
                Open the real console
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            <div className="mt-4 rounded-3xl border border-[#0E4225]/12 bg-[#0E4225] p-5 text-[#FBF5DD]">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" /> Model parameters
              </p>
              <ul className="mt-3 space-y-1.5 text-[11px] font-semibold text-[#FBF5DD]/75">
                {Object.entries(ANALYSIS_CONFIG.weights).map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between border-b border-white/10 pb-1 last:border-0">
                    <span className="capitalize">{k} weight</span>
                    <span className="font-mono font-black text-emerald-300">{Math.round(v * 100)}%</span>
                  </li>
                ))}
                <li className="flex items-center justify-between">
                  <span>Risk bands</span>
                  <span className="font-mono font-black text-emerald-300">
                    {RISK_LEVEL_BANDS.map((b) => b.level[0]).join(' · ')}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
