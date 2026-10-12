'use client';

import React from 'react';
import Link from 'next/link';
import { Github, Scale } from 'lucide-react';
import { BrandLockup } from '@/components/Brand';
import { ANALYSIS_CONFIG } from '@/lib/trafficAnalytics';

const LINKS = [
  { id: 'pipeline', label: 'Analytics Pipeline' },
  { id: 'roles', label: 'Who It Serves' },
  { id: 'dataset', label: 'Dataset' },
  { id: 'screens', label: 'Screens' },
  { id: 'about', label: 'About' },
];

export default function Footer() {
  return (
    <footer className="border-t border-emerald-900 bg-[#0E4225] pb-12 pt-16 text-sm text-emerald-100/75">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-8 border-b border-emerald-900/80 pb-12 md:flex-row">
          <div className="py-2">
            <BrandLockup tone="light" subtitle="Violation Analytics" />
            <p className="mt-3 max-w-xs text-[11px] font-medium leading-relaxed text-emerald-100/55">
              An academic JavaFX + MySQL project that turns recorded traffic violations into explainable, reviewable
              insights.
            </p>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm font-bold">
            {LINKS.map((l) => (
              <a key={l.id} href={`#${l.id}`} className="transition-colors hover:text-emerald-300">
                {l.label}
              </a>
            ))}
            <Link href="/auth" className="text-emerald-400 underline underline-offset-4 hover:text-emerald-300">
              Console login
            </Link>
          </nav>

          <div className="flex items-center gap-3.5">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-emerald-800 bg-emerald-900/60 p-3 text-emerald-200 shadow-sm transition-colors hover:bg-emerald-800 hover:text-white"
              aria-label="Source repository"
            >
              <Github className="h-4 w-4" />
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-emerald-800 bg-emerald-900/60 p-3 text-emerald-200 shadow-sm transition-colors hover:bg-emerald-800 hover:text-white"
              aria-label="Project documentation"
            >
              <Scale className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="mt-8 grid gap-6 rounded-2xl border border-emerald-800/70 bg-emerald-900/40 p-5 sm:grid-cols-2">
          <p className="text-[11px] font-medium leading-relaxed text-emerald-100/60">
            <span className="font-black uppercase tracking-wider text-emerald-300/80">Decision support only.</span> This
            project does not issue challans, does not predict crashes, does not determine legal guilt and never applies
            an automatic penalty or licence suspension. Risk weights, fine rules and hotspot thresholds are
            configurable project parameters, not official government values.
          </p>
          <p className="text-[11px] font-medium leading-relaxed text-emerald-100/60">
            <span className="font-black uppercase tracking-wider text-emerald-300/80">Demo data.</span> Every driver,
            licence number and address shown in the console is machine-generated for demonstration. No real person is
            described or scored. Risk model in use:{' '}
            {Object.entries(ANALYSIS_CONFIG.weights)
              .map(([k, v]) => `${k} ${Math.round(v * 100)}%`)
              .join(' · ')}
            .
          </p>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 pt-8 text-xs font-semibold text-emerald-200/60 sm:flex-row">
          <p>© {new Date().getFullYear()} SmartTraffic Analytics — academic project prototype.</p>
          <div className="flex items-center gap-6">
            <span className="transition-colors hover:text-emerald-300">Responsible use</span>
            <span className="transition-colors hover:text-emerald-300">Data handling</span>
            <span className="transition-colors hover:text-emerald-300">Ethics</span>
          </div>
          <p className="flex items-center gap-1.5 text-emerald-300/80">Built with JavaFX · MySQL · Next.js</p>
        </div>
      </div>
    </footer>
  );
}
