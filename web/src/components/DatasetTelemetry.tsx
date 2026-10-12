'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CalendarRange, Database, MapPin, ShieldAlert, Users } from 'lucide-react';
import { generateSeedDataset } from '@/lib/trafficData';
import { ANALYSIS_CONFIG, datasetProfile, violationLabel } from '@/lib/trafficAnalytics';

/**
 * Landing section: dataset telemetry.
 *
 * The numbers below are produced by the same deterministic seed generator
 * that powers the console, so the marketing page can never drift from what a
 * reviewer actually sees after signing in.
 */
export default function DatasetTelemetry() {
  const stats = useMemo(() => {
    const seed = generateSeedDataset();
    const now = new Date();
    const profile = datasetProfile(seed.drivers, seed.vehicles, seed.violations, now);

    const typeCounts = new Map<string, number>();
    seed.violations.forEach((v) => typeCounts.set(v.violationType, (typeCounts.get(v.violationType) ?? 0) + 1));
    const topTypes = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]);

    const severityCounts = new Map<string, number>();
    seed.violations.forEach((v) => severityCounts.set(v.severity, (severityCounts.get(v.severity) ?? 0) + 1));

    return {
      profile,
      topTypes,
      severityCounts: [...severityCounts.entries()].sort(
        (a, b) => (a[0] < b[0] ? -1 : 1),
      ),
      officers: seed.officers.length,
      locations: new Set(seed.violations.map((v) => v.location)).size,
      window: ANALYSIS_CONFIG.frequencyWindowDays,
    };
  }, []);

  const p = stats.profile;

  const headline = [
    { label: 'Drivers on record', value: p.totalDrivers, icon: <Users className="h-4 w-4" /> },
    { label: 'Vehicles on record', value: p.totalVehicles, icon: <Database className="h-4 w-4" /> },
    { label: 'Violations analysed', value: p.totalViolations, icon: <CalendarRange className="h-4 w-4" /> },
    { label: 'Junctions covered', value: stats.locations, icon: <MapPin className="h-4 w-4" /> },
  ];

  const severityTone: Record<string, string> = {
    MINOR: 'bg-slate-300',
    MEDIUM: 'bg-amber-400',
    MAJOR: 'bg-orange-500',
    SEVERE: 'bg-red-500',
  };

  return (
    <section id="dataset" className="relative border-t border-[#0E4225]/10 bg-[#F6EDCC]/40 py-28">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <span className="mb-3 block text-xs font-semibold uppercase tracking-widest text-[#28734A]">
            Demonstration dataset
          </span>
          <h2 className="text-4xl font-black tracking-tight text-[#0E4225] sm:text-6xl">
            Thirteen months of synthetic records
          </h2>
          <p className="mt-4 text-base font-medium text-[#0E4225]/70 sm:text-lg">
            Generated once from a fixed seed so every run of the project produces identical analytics — and no personal
            data of any real person is involved.
          </p>
        </div>

        {/* --------------------------------------------- headline stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {headline.map((h, i) => (
            <motion.div
              key={h.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="rounded-3xl border border-[#0E4225]/12 bg-white/85 p-5 shadow-[0_18px_40px_-30px_rgba(14,66,37,0.5)]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#0E4225]/55">{h.label}</span>
                <span className="grid h-8 w-8 place-items-center rounded-xl border border-[#0E4225]/12 bg-[#F6EDCC] text-[#28734A]">
                  {h.icon}
                </span>
              </div>
              <p className="mt-2 text-3xl font-black tracking-tight text-[#0E4225]">
                {h.value.toLocaleString('en-IN')}
              </p>
            </motion.div>
          ))}
        </div>

        {/* ------------------------------------------ mix + distribution */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-[#0E4225]/12 bg-white/85 p-6 lg:col-span-2">
            <h3 className="text-sm font-black tracking-tight text-[#0E4225]">Offence mix</h3>
            <p className="mt-0.5 text-[11px] font-medium text-[#0E4225]/55">
              Share of all {p.totalViolations.toLocaleString('en-IN')} records, by offence category
            </p>
            <ul className="mt-5 space-y-2.5">
              {stats.topTypes.map(([type, count], i) => {
                const share = (count / p.totalViolations) * 100;
                return (
                  <li key={type} className="flex items-center gap-3">
                    <span className="w-6 shrink-0 font-mono text-[10px] font-black text-[#0E4225]/35">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="w-40 shrink-0 truncate text-[11px] font-bold text-[#0E4225] sm:w-52">
                      {violationLabel(type as never)}
                    </span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#0E4225]/8">
                      <motion.span
                        initial={{ width: 0 }}
                        whileInView={{ width: `${share}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, delay: i * 0.05 }}
                        className="block h-full rounded-full bg-emerald-600"
                      />
                    </span>
                    <span className="w-16 shrink-0 text-right font-mono text-[10px] font-bold text-[#0E4225]/55">
                      {count} · {share.toFixed(1)}%
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 border-t border-[#0E4225]/10 pt-4">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-[#0E4225]/55">Severity mix</h4>
              <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-[#0E4225]/8">
                {stats.severityCounts.map(([sev, count]) => (
                  <motion.span
                    key={sev}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${(count / p.totalViolations) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7 }}
                    className={severityTone[sev] ?? 'bg-slate-300'}
                    title={`${sev}: ${count}`}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {stats.severityCounts.map(([sev, count]) => (
                  <span key={sev} className="flex items-center gap-1.5 text-[10px] font-bold text-[#0E4225]/60">
                    <span className={`h-2 w-2 rounded-full ${severityTone[sev] ?? 'bg-slate-300'}`} />
                    {sev} · {count}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[#0E4225]/12 bg-white/85 p-6">
            <h3 className="text-sm font-black tracking-tight text-[#0E4225]">What the console derives</h3>
            <ul className="mt-4 space-y-3 text-[11px] font-semibold text-[#0E4225]/70">
              {[
                ['High-risk drivers', `${p.highRiskDrivers} of ${p.totalDrivers} score 61 or above`],
                ['Repeated-pattern cases', `${p.repeatPatternCases} drivers trigger at least one pattern rule`],
                ['Hotspot locations', `${p.hotspotCount} locations cross the configured threshold`],
                ['Top hotspot', p.topHotspot],
                ['Peak period', p.peakPeriod],
                ['Pending fines', `₹${p.pendingFineAmount.toLocaleString('en-IN')} across ${p.pendingFines} records`],
              ].map(([label, value]) => (
                <li key={label} className="border-b border-[#0E4225]/8 pb-2 last:border-0">
                  <span className="block text-[10px] font-black uppercase tracking-wider text-[#0E4225]/45">{label}</span>
                  <span className="mt-0.5 block leading-snug">{value}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-2xl border border-[#0E4225]/12 bg-[#F6EDCC]/60 p-3 text-[10px] font-medium leading-relaxed text-[#0E4225]/70">
              {stats.officers} officers, {stats.locations} junctions and a {stats.window}-day window feed every figure
              above. Change one record in the console and all of it recalculates.
            </p>
          </div>
        </div>

        {/* ------------------------------------------------ ethics bar */}
        <div className="mt-6 flex items-start gap-3 rounded-3xl border border-emerald-300 bg-emerald-50 p-5">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <div>
            <p className="text-xs font-black text-emerald-950">Why this data is synthetic, and why the wording is careful</p>
            <p className="mt-1 text-[11px] font-medium leading-relaxed text-emerald-950/75">
              Every driver, licence number, phone number and address in this build is machine-generated. No real person
              is described, scored or pictured. The system describes <em>records</em> — “repeated violation pattern
              detected in the available records” — never a person, and it never applies an automatic penalty, licence
              suspension or legal consequence. Scores and estimates are configurable project parameters, not official
              government assessments.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
