'use client';

import React from 'react';
import { ArrowUpRight, Gauge, LineChart, ScrollText, ShieldCheck } from 'lucide-react';
import {
  CardCurtainReveal,
  CardCurtainRevealBody,
  CardCurtainRevealDescription,
  CardCurtainRevealFooter,
  CardCurtainRevealTitle,
  CardCurtain,
} from '@/components/ui/card-curtain-reveal';
import { Button } from '@/components/ui/button';
import { ROLE_CAPABILITIES, ROLE_LABELS } from '@/lib/trafficData';

/** Cream/emerald mini-mock-ups shown when the curtain lifts. */
const visualClass = 'flex h-full w-full flex-col justify-center gap-1.5 bg-[#0B341D] p-5';

const VISUALS: Record<string, React.ReactNode> = {
  risk: (
    <div className={visualClass}>
      <svg viewBox="0 0 120 68" className="w-full">
        <path d="M12 62a48 48 0 0 1 96 0" fill="none" stroke="#28734A" strokeWidth="9" strokeLinecap="round" />
        <path
          d="M12 62a48 48 0 0 1 96 0"
          fill="none"
          stroke="#34D399"
          strokeWidth="9"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="76 100"
        />
        <text x="60" y="56" textAnchor="middle" className="fill-emerald-50" fontSize="19" fontWeight="900">
          76
        </text>
      </svg>
      <div className="space-y-1">
        {[
          ['Frequency', 78],
          ['Recency', 64],
          ['Repeat', 71],
          ['Severity', 58],
        ].map(([label, value]) => (
          <div key={label as string} className="flex items-center gap-2">
            <span className="w-14 text-[9px] font-bold text-emerald-100/70">{label}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full rounded-full bg-emerald-400" style={{ width: `${value}%` }} />
            </span>
          </div>
        ))}
      </div>
    </div>
  ),
  officer: (
    <div className={visualClass}>
      {[
        ['Driver', 'D1042 · Meenakshi S.'],
        ['Vehicle', 'TN 09 AB 1234'],
        ['Offence', 'Overspeeding'],
        ['Location', 'Anna Salai'],
        ['Severity', 'MAJOR · ₹2,000'],
      ].map(([label, value]) => (
        <div
          key={label}
          className="flex items-center justify-between gap-2 rounded-lg border border-white/12 bg-white/5 px-2.5 py-1.5"
        >
          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-300/70">{label}</span>
          <span className="font-mono text-[9px] font-bold text-emerald-50">{value}</span>
        </div>
      ))}
    </div>
  ),
  admin: (
    <div className={visualClass}>
      <div className="flex items-center gap-2 rounded-lg border border-white/12 bg-white/5 px-3 py-2">
        <ShieldCheck className="h-4 w-4 text-emerald-400" />
        <span className="text-[10px] font-bold text-emerald-50">Administrator</span>
      </div>
      {[
        ['Frequency weight', 30],
        ['Recent weight', 25],
        ['Repeat weight', 25],
        ['Severity weight', 20],
      ].map(([label, value]) => (
        <div key={label as string} className="flex items-center gap-2">
          <span className="w-24 text-[9px] font-bold text-emerald-100/70">{label}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <span className="block h-full rounded-full bg-emerald-400" style={{ width: `${(value as number) * 2.4}%` }} />
          </span>
        </div>
      ))}
      <p className="pt-1 text-[9px] font-semibold text-emerald-200/70">Hotspot threshold 80 · all reports exportable</p>
    </div>
  ),
  analyst: (
    <div className={visualClass}>
      <div className="flex h-24 items-end gap-1.5">
        {[38, 52, 44, 66, 58, 74, 61, 82, 70, 55, 48, 63].map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-t bg-emerald-400/80"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <p className="text-[9px] font-semibold text-emerald-200/70">
        12-month volume · read-only access to every surface
      </p>
    </div>
  ),
};

const ROLES = [
  {
    key: 'risk',
    title: 'The Risk Engine',
    subtitle: 'FR-06 · FR-07',
    icon: Gauge,
    desc: 'A weighted model scores every driver 0–100 from frequency, recency, repeat rate and severity — and the screen always shows the arithmetic behind the number.',
    points: [
      '30% frequency · 25% recent · 25% repeat · 20% severity',
      'Bands: LOW, MEDIUM, HIGH, CRITICAL',
      'Every factor shows its raw value, weight and explanation',
    ],
  },
  {
    key: 'officer',
    title: 'The Traffic Officer',
    subtitle: 'FR-04 · FR-05',
    icon: ScrollText,
    desc: 'Register a violation in a single form. The fine comes from the project rule table, the record is stored, and the analytics pipeline re-runs immediately.',
    points: [
      'Search drivers and vehicles before entry',
      'Severity and payment status captured at the scene',
      'Generate a driver behaviour report on the spot',
    ],
  },
  {
    key: 'admin',
    title: 'The Administrator',
    subtitle: 'FR-01 · Configuration',
    icon: ShieldCheck,
    desc: 'Issues officer accounts and tunes the model. Weights, hotspot thresholds and offence categories are project parameters, not fixed law.',
    points: [
      'Create and disable officer accounts',
      'Adjust weights, caps and hotspot thresholds',
      'Full access to all reports and exports',
    ],
  },
  {
    key: 'analyst',
    title: 'The Analyst',
    subtitle: 'FR-12 · Transparency',
    icon: LineChart,
    desc: 'A read-only role for review and audit. Every aggregated surface is visible, with the scenario analysis clearly labelled as an estimate rather than a prediction.',
    points: [
      'Hotspot, time and trend analytics',
      'Scenario / what-if estimates, never a guarantee',
      'No write access to any record',
    ],
  },
];

export default function Features() {
  return (
    <section id="roles" className="relative border-t border-[#0E4225]/10 bg-[#FBF5DD] py-32">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mx-auto mb-20 max-w-2xl text-center">
          <span className="mb-3 block text-xs font-semibold uppercase tracking-widest text-[#28734A]">
            Roles and responsibilities
          </span>
          <h2 className="text-4xl font-black tracking-tight text-[#0E4225] sm:text-6xl">
            One system, three kinds of access
          </h2>
          <p className="mt-4 text-base font-medium text-[#0E4225]/70 sm:text-lg">
            Hover a card to reveal the surface that role actually works with.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <CardCurtainReveal
                key={role.key}
                className="h-[540px] w-full overflow-hidden rounded-3xl border border-[#0E4225]/20 bg-[#0E4225] text-white shadow-xl transition-all hover:border-[#28734A] hover:shadow-2xl"
              >
                <CardCurtainRevealBody className="relative z-10 flex flex-col justify-between">
                  <div>
                    <div className="mb-5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                        <Icon className="h-3 w-3" />
                        {role.subtitle}
                      </span>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="ml-2 h-9 w-9 shrink-0 rounded-full bg-white text-[#0E4225] shadow-md hover:bg-emerald-200"
                        tabIndex={-1}
                        aria-hidden
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </div>

                    <CardCurtainRevealTitle className="text-2xl font-black leading-tight tracking-tight sm:text-3xl">
                      {role.title}
                    </CardCurtainRevealTitle>

                    <CardCurtainRevealDescription className="mt-4 text-sm font-normal leading-relaxed text-emerald-100/80">
                      <p>{role.desc}</p>
                    </CardCurtainRevealDescription>

                    <ul className="mt-4 space-y-1.5">
                      {role.points.map((p) => (
                        <li key={p} className="flex gap-2 text-[11px] font-semibold text-emerald-100/65">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                          {p}
                        </li>
                      ))}
                    </ul>

                    <p className="mt-4 border-t border-white/10 pt-3 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300/70">
                      {ROLE_LABELS[role.key === 'risk' ? 'officer' : role.key]}
                    </p>
                  </div>

                  <CardCurtain className="bg-emerald-300/30" />
                </CardCurtainRevealBody>

                <CardCurtainRevealFooter className="relative mt-auto h-[210px] w-full overflow-hidden">
                  {VISUALS[role.key]}
                </CardCurtainRevealFooter>
              </CardCurtainReveal>
            );
          })}
        </div>

        <div className="mt-12 rounded-3xl border border-[#0E4225]/12 bg-white/70 p-5 text-center">
          <p className="text-xs font-bold text-[#0E4225]">
            Access is role-based and enforced in the interface: the analyst session can read every screen but cannot
            write a record, edit a registry entry or acknowledge an alert.
          </p>
          <p className="mt-1 text-[11px] font-medium text-[#0E4225]/60">
            Officer permissions: {ROLE_CAPABILITIES.officer.join(' · ')}
          </p>
        </div>
      </div>
    </section>
  );
}
