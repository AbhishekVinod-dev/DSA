'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronDown, Gauge, MapPin, ShieldCheck, TrendingUp } from 'lucide-react';

/* Deterministic demo figures so the marketing hero matches the console. */
const RISK_FACTORS = [
  { label: 'Frequency', weight: '30%', value: 78 },
  { label: 'Recency', weight: '25%', value: 64 },
  { label: 'Repeat rate', weight: '25%', value: 71 },
  { label: 'Severity', weight: '20%', value: 58 },
];

const HOTSPOTS = [
  { rank: 1, place: 'Anna Salai Junction', count: 148, top: 'Signal jump' },
  { rank: 2, place: 'Velachery Main Road', count: 121, top: 'Overspeeding' },
  { rank: 3, place: 'OMR IT Corridor', count: 96, top: 'Lane discipline' },
];

export default function Hero() {
  return (
    <section className="relative flex min-h-[96vh] flex-col justify-center overflow-hidden bg-gradient-to-b from-[#FBF5DD] via-[#FBF5DD] to-[#FBF5DD] pb-28 pt-36">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/15 blur-[160px]" />

      {/* --------------------------------------- ambient background */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Road centre-line motif */}
        <motion.div
          animate={{ y: [0, -18, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute left-[6%] top-28 text-emerald-800/20"
        >
          <svg className="h-14 w-14 sm:h-16 sm:w-16" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round">
            <path d="M50 10v80" strokeDasharray="10 12" />
          </svg>
        </motion.div>

        <motion.div
          animate={{ y: [0, 16, 0], rotate: [0, -12, 0] }}
          transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
          className="absolute right-[8%] top-32 text-amber-700/25"
        >
          <svg className="h-12 w-12" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round">
            <path d="M50 12 62 38 88 50 62 62 50 88 38 62 12 50 38 38Z" />
          </svg>
        </motion.div>

        <motion.div
          animate={{ y: [0, -14, 0], rotate: [-6, 6, -6] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-28 left-[10%] hidden text-emerald-700/20 sm:block"
        >
          <svg className="h-16 w-16" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
            <path d="M20 80C20 50 40 24 50 24s30 26 30 56" />
            <path d="M34 60h32" />
          </svg>
        </motion.div>

        <motion.div
          animate={{ y: [0, 12, 0] }}
          transition={{ duration: 7.5, repeat: Infinity, ease: 'easeInOut', delay: 1.4 }}
          className="absolute bottom-24 right-[14%] hidden text-teal-800/20 sm:block"
        >
          <svg className="h-14 w-14" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
            <circle cx="50" cy="50" r="30" />
            <path d="M50 32v20l14 10" />
          </svg>
        </motion.div>
      </div>

      {/* --------------------------------- floating analytics cards */}
      <div className="pointer-events-none absolute inset-0 z-0 mx-auto hidden max-w-7xl lg:block">
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 1280 800" preserveAspectRatio="none">
          <defs>
            <filter id="heroGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <path
            d="M 300 250 C 560 250, 700 560, 980 560"
            fill="none"
            stroke="#28734A"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="2 12"
            className="opacity-70"
          />
          <circle r="8" fill="#328A59" filter="url(#heroGlow)">
            <animateMotion path="M 300 250 C 560 250, 700 560, 980 560" dur="3.4s" repeatCount="indefinite" />
          </circle>
          <circle r="3" fill="#FFFFFF">
            <animateMotion path="M 300 250 C 560 250, 700 560, 980 560" dur="3.4s" repeatCount="indefinite" />
          </circle>
        </svg>

        {/* Risk score breakdown card */}
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-auto absolute left-4 top-40 w-72 rounded-2xl border border-emerald-900/10 bg-white/90 p-5 shadow-xl backdrop-blur-xl xl:left-8"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
              <Gauge className="h-5 w-5" />
            </div>
            <div>
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Risk 76 · HIGH
              </span>
              <h4 className="mt-0.5 text-sm font-bold text-[#0E4225]">Driver D1042</h4>
            </div>
          </div>
          <p className="mb-3 text-xs font-medium text-[#0E4225]/60">
            Repeated violation pattern detected in the available records
          </p>
          <ul className="space-y-1.5">
            {RISK_FACTORS.map((f) => (
              <li key={f.label} className="flex items-center gap-2">
                <span className="w-16 text-[10px] font-bold text-[#0E4225]/60">{f.label}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#0E4225]/10">
                  <span className="block h-full rounded-full bg-emerald-600" style={{ width: `${f.value}%` }} />
                </span>
                <span className="w-9 text-right font-mono text-[9px] font-bold text-[#0E4225]/45">{f.weight}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Hotspot ranking card */}
        <motion.div
          animate={{ y: [0, 12, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
          className="pointer-events-auto absolute bottom-32 right-4 w-72 rounded-2xl border border-emerald-900/10 bg-white/90 p-5 shadow-xl backdrop-blur-xl xl:right-8"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Hotspot · FR-08
              </span>
              <h4 className="mt-0.5 text-sm font-bold text-[#0E4225]">Chennai · 12 junctions</h4>
            </div>
          </div>
          <ol className="space-y-2">
            {HOTSPOTS.map((h) => (
              <li key={h.place} className="flex items-center gap-2 border-b border-[#0E4225]/8 pb-1.5 last:border-0">
                <span className="grid h-5 w-5 place-items-center rounded-md bg-[#0E4225]/8 font-mono text-[10px] font-black text-[#0E4225]">
                  {h.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-bold text-[#0E4225]">{h.place}</span>
                  <span className="block text-[10px] font-medium text-[#0E4225]/50">{h.top}</span>
                </span>
                <span className="font-mono text-[11px] font-black text-emerald-700">{h.count}</span>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 p-2">
            <TrendingUp className="h-3.5 w-3.5 text-white" />
            <span className="text-[11px] font-bold text-white">Prioritised for review</span>
          </div>
        </motion.div>
      </div>

      {/* --------------------------------------------- main headline */}
      <div className="relative z-10 mx-auto max-w-5xl px-4 text-center sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-9 inline-flex items-center gap-2.5 rounded-full border border-emerald-900/10 bg-white px-4 py-2 text-xs font-semibold text-[#0E4225] shadow-sm"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
          </span>
          <span className="font-bold tracking-tight text-emerald-800">ACADEMIC PROJECT PROTOTYPE</span>
          <span className="text-gray-300">•</span>
          <span className="text-gray-600">JavaFX · MySQL · 9 screens</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl font-black leading-[1.05] tracking-tight text-[#0E4225] sm:text-7xl lg:text-8xl"
        >
          Turn violation records into{' '}
          <span className="relative inline-block text-emerald-600">
            explained patterns.
            <svg
              className="absolute -bottom-2 left-0 -z-10 h-3 w-full text-emerald-200"
              viewBox="0 0 100 20"
              preserveAspectRatio="none"
            >
              <path d="M0,15 Q50,0 100,15" fill="none" stroke="currentColor" strokeWidth="8" />
            </svg>
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto mt-8 max-w-2xl text-lg font-normal leading-relaxed text-gray-600 sm:text-xl"
        >
          Smart Traffic Violation Prevention &amp; Management System — an explainable analytics layer that scores
          repeat behaviour, ranks hotspots, reads time patterns and raises review alerts. Every output shows the rule
          that produced it.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mx-auto mt-12 flex w-full max-w-2xl flex-col items-center justify-center gap-3 px-4 sm:flex-row sm:gap-4 sm:px-0"
        >
          <Link
            href="/auth"
            className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-600 px-8 py-4 text-xs font-bold text-white shadow-xl shadow-emerald-600/20 transition-all hover:-translate-y-0.5 hover:bg-emerald-500 sm:text-sm"
          >
            Launch the console
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#pipeline"
            className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-emerald-900/15 bg-white px-8 py-4 text-xs font-bold text-[#0E4225] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-gray-50 sm:text-sm"
          >
            <ChevronDown className="h-4 w-4 text-emerald-600" />
            See how it works
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-20 flex flex-wrap items-center justify-center gap-8 border-t border-emerald-900/10 pt-10 text-xs font-semibold text-gray-500 sm:gap-12"
        >
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-emerald-100 p-1 text-emerald-700">
              <Gauge className="h-3.5 w-3.5" />
            </div>
            <span>Weighted 0–100 risk score</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-teal-100 p-1 text-teal-700">
              <MapPin className="h-3.5 w-3.5" />
            </div>
            <span>Ranked hotspot analysis</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-green-100 p-1 text-green-700">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
            <span>Every output explains its rule</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
