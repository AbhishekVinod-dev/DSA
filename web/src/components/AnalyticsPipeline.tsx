'use client';

import React from 'react';
import { motion } from 'framer-motion';
import StackingCards from '@/components/ui/stacking-card';
import { ANALYSIS_CONFIG, RISK_LEVEL_BANDS } from '@/lib/trafficAnalytics';

/**
 * Landing section: the analytics pipeline.
 *
 * Replaces the old "How It Works" stack. Each card pairs a PRD step with a
 * small hand-built mock-up of what that layer produces.
 */

const tableRows = [
  ['VL-2041', 'D1042', 'OVERSPEEDING', 'MAJOR'],
  ['VL-2042', 'D0388', 'SIGNAL_JUMP', 'MEDIUM'],
  ['VL-2043', 'D1042', 'WRONG_LANE', 'MINOR'],
  ['VL-2044', 'D0611', 'UNAUTHORIZED_PARKING', 'MINOR'],
];

function ViolationRowVisual() {
  return (
    <div className="flex h-full items-center justify-center bg-white/5 p-4">
      <div className="w-full overflow-hidden rounded-xl border border-white/15 bg-[#0b341d] font-mono text-[10px] text-emerald-50">
        <div className="grid grid-cols-4 gap-2 border-b border-white/15 bg-white/5 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-emerald-300/80">
          <span>violation_id</span>
          <span>driver</span>
          <span>type</span>
          <span>severity</span>
        </div>
        {tableRows.map((row) => (
          <div key={row[0]} className="grid grid-cols-4 gap-2 border-b border-white/8 px-3 py-1.5 last:border-0">
            {row.map((cell, i) => (
              <span key={i} className="truncate">
                {cell}
              </span>
            ))}
          </div>
        ))}
        <div className="border-t border-white/15 px-3 py-1.5 text-[9px] text-emerald-300/70">violations · 1,214 rows</div>
      </div>
    </div>
  );
}

function ServiceLayerVisual() {
  const services = [
    'ViolationService',
    'RiskAnalysisService',
    'PatternDetectionService',
    'HotspotAnalysisService',
    'TrendAnalysisService',
    'AlertService',
    'ReportService',
  ];
  return (
    <div className="flex h-full flex-col justify-center gap-1.5 bg-white/5 p-4">
      <div className="mb-1 text-center text-[9px] font-bold uppercase tracking-[0.25em] text-emerald-300/70">
        Service layer
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {services.map((s) => (
          <motion.div
            key={s}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35 }}
            className="rounded-lg border border-white/15 bg-[#0b341d] px-2 py-1.5 text-center font-mono text-[9px] font-bold text-emerald-50"
          >
            {s.replace('Service', '')}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function RiskEngineVisual() {
  return (
    <div className="flex h-full flex-col justify-center gap-3 bg-white/5 p-4">
      <div className="text-center text-[9px] font-bold uppercase tracking-[0.25em] text-emerald-300/70">
        Risk = weighted sum, normalised 0–100
      </div>
      <div className="space-y-1.5">
        {Object.entries(ANALYSIS_CONFIG.weights).map(([key, weight]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="w-16 text-[9px] font-bold capitalize text-emerald-100/80">{key}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <span
                className="block h-full rounded-full bg-emerald-400"
                style={{ width: `${weight * 100}%` }}
              />
            </span>
            <span className="w-8 text-right font-mono text-[9px] font-black text-emerald-200">
              {Math.round(weight * 100)}%
            </span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1 border-t border-white/15 pt-2 text-center font-mono text-[8px] font-bold uppercase text-emerald-100/60">
        {RISK_LEVEL_BANDS.map((b) => (
          <span key={b.level}>
            {b.level}
            <span className="block text-emerald-300/80">
              {b.min}–{b.max}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function AlertVisual() {
  const alerts = [
    ['HIGH', 'Repeated pattern', 'D1042 · 3× overspeeding in 60 days'],
    ['MEDIUM', 'Frequency increase', 'D0611 · +60% vs previous month'],
    ['MEDIUM', 'Location hotspot', 'Anna Salai · 148 records'],
  ];
  const tone: Record<string, string> = {
    HIGH: 'bg-red-400/90 text-red-950',
    MEDIUM: 'bg-amber-300/90 text-amber-950',
    LOW: 'bg-emerald-300/90 text-emerald-950',
  };
  return (
    <div className="flex h-full flex-col justify-center gap-2 bg-white/5 p-4">
      {alerts.map(([sev, title, body]) => (
        <motion.div
          key={title}
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.35 }}
          className="rounded-lg border border-white/15 bg-[#0b341d] p-2.5"
        >
          <div className="flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[8px] font-black uppercase ${tone[sev]}`}>{sev}</span>
            <span className="text-[10px] font-bold text-emerald-50">{title}</span>
          </div>
          <p className="mt-1 text-[9px] font-medium text-emerald-100/60">{body}</p>
        </motion.div>
      ))}
      <p className="pt-1 text-center text-[9px] font-semibold text-emerald-200/70">
        Recommendation only — never an automatic action
      </p>
    </div>
  );
}

const STEPS = [
  {
    tag: 'FR-02 → FR-05',
    title: 'Record the violation',
    description:
      'An officer registers a driver, a vehicle and a violation: offence type, location, date, time and severity. The fine is derived from a configurable rule table and written to MySQL through the DAO layer.',
    footnote: 'ViolationService · ViolationDAO · violations table',
    color: '#0E4225',
    visual: <ViolationRowVisual />,
  },
  {
    tag: 'FR-06 → FR-11',
    title: 'Precompute the analytics',
    description:
      'A background job re-runs the full pipeline after every insert: driver risk scores, repeated-pattern detection, hotspot aggregation, time-of-day analysis and period-over-period trend comparison.',
    footnote: 'Every result is cached with the score it was derived from',
    color: '#165431',
    visual: <ServiceLayerVisual />,
  },
  {
    tag: 'FR-06',
    title: 'Score each driver',
    description:
      'The risk engine combines violation frequency, recent activity, repeat rate and severity into a single 0–100 score. The interface shows the raw value, the weight and the explanation for every factor.',
    footnote: 'LOW 0–30 · MEDIUM 31–60 · HIGH 61–80 · CRITICAL 81–100',
    color: '#1E6B40',
    visual: <RiskEngineVisual />,
  },
  {
    tag: 'FR-10',
    title: 'Raise explainable alerts',
    description:
      'When a rule fires — a repeated offence type, a month-over-month increase, a critical score or a location crossing the hotspot threshold — the system suggests a review. It never acts on its own.',
    footnote: 'Alerts are informational, never automatic penalties',
    color: '#28734A',
    visual: <AlertVisual />,
  },
];

export default function AnalyticsPipeline() {
  return (
    <section id="pipeline" className="relative border-y border-[#0E4225]/10 bg-[#FBF5DD] py-28">
      <div className="relative z-10 mx-auto mb-8 max-w-7xl px-4 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="mb-3 block text-xs font-semibold uppercase tracking-widest text-[#28734A]">
            How the analytics works
          </span>
          <h2 className="text-4xl font-black tracking-tight text-[#0E4225] sm:text-6xl">
            Four layers, one explanation
          </h2>
          <p className="mt-4 text-base font-medium text-[#0E4225]/70 sm:text-lg">
            Records in, documented rules out. Scroll to move through the pipeline.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4">
        <StackingCards projects={STEPS} />
      </div>
    </section>
  );
}
