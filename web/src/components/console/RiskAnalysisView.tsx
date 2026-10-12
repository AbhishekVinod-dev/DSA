'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, GitBranch, Search, TrendingDown, TrendingUp, Waves } from 'lucide-react';
import { DayPart } from '@/types';
import { useConsole } from '@/lib/trafficStore';
import {
  ANALYSIS_CONFIG,
  PATTERN_TYPE_LABELS,
  RISK_LEVEL_BANDS,
  analyseDriverTrend,
  buildAlerts,
  calculateRisk,
  dayPartLabel,
  dayPartOf,
  detectPatterns,
  parseViolationDate,
  violationLabel,
} from '@/lib/trafficAnalytics';
import { BarChart, FactorBar, ScoreGauge } from './charts';
import {
  AlertSeverityBadge,
  DataTable,
  EmptyState,
  Field,
  Notice,
  Panel,
  PaymentBadge,
  RiskBadge,
  SeverityBadge,
  inputClass,
} from './ui';

export default function RiskAnalysisView({
  driverId,
  onSelectDriver,
}: {
  driverId?: string;
  onSelectDriver: (driverId: string) => void;
}) {
  const { drivers, vehicles, violations, now } = useConsole();
  const [selected, setSelected] = useState<string>(driverId ?? '');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (driverId) setSelected(driverId);
  }, [driverId]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [...drivers]
        .sort((a, b) => calculateRisk(b.driverId, violations, now).riskScore - calculateRisk(a.driverId, violations, now).riskScore)
        .slice(0, 8);
    }
    return drivers
      .filter(
        (d) => d.name.toLowerCase().includes(q) || d.driverId.toLowerCase().includes(q) || d.licenseNumber.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [drivers, query, violations, now]);

  const activeId = selected || candidates[0]?.driverId || '';
  const driver = drivers.find((d) => d.driverId === activeId) ?? null;

  const risk = useMemo(() => (driver ? calculateRisk(driver.driverId, violations, now) : null), [driver, violations, now]);
  const patterns = useMemo(() => (driver ? detectPatterns(driver.driverId, violations, now) : []), [driver, violations, now]);
  const trend = useMemo(() => (driver ? analyseDriverTrend(driver.driverId, violations, now) : null), [driver, violations, now]);
  const history = useMemo(
    () => violations.filter((v) => v.driverId === activeId).sort((a, b) => (a.violationDate < b.violationDate ? 1 : -1)),
    [violations, activeId],
  );
  const hourly = useMemo(
    () =>
      Array.from({ length: 24 }, (_, h) => ({
        label: h % 3 === 0 ? String(h).padStart(2, '0') : '',
        value: history.filter((v) => parseViolationDate(v).getHours() === h).length,
      })),
    [history],
  );
  const peakDayPart = useMemo(() => {
    const counts = history.reduce<Record<string, number>>((acc, v) => {
      const part = dayPartOf(parseViolationDate(v).getHours());
      acc[part] = (acc[part] ?? 0) + 1;
      return acc;
    }, {});
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return top ? dayPartLabel(top as DayPart) : 'No records';
  }, [history]);
  const alerts = useMemo(
    () => (driver ? buildAlerts(drivers, violations, now).filter((a) => a.driverId === driver.driverId) : []),
    [driver, drivers, violations, now],
  );
  const driverVehicles = useMemo(
    () => (driver ? vehicles.filter((v) => v.driverId === driver.driverId) : []),
    [driver, vehicles],
  );

  if (!driver || !risk) {
    return (
      <Panel title="Driver Risk Analysis" subtitle="Select a driver to see the explainable score">
        <EmptyState title="No driver selected" hint="Use the search above to pick a driver record." />
      </Panel>
    );
  }

  return (
    <div className="space-y-5">
      {/* Driver picker */}
      <Panel title="Driver Risk Analysis" subtitle="Screen 6 — every score is shown with the factors that produced it">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <Field label="Search driver">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0E4225]/40" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name, driver ID or licence number"
                  className={`${inputClass} pl-10`}
                />
              </div>
            </Field>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {candidates.map((d) => (
              <button
                key={d.driverId}
                onClick={() => {
                  setSelected(d.driverId);
                  onSelectDriver(d.driverId);
                }}
                className={`rounded-xl border px-3 py-1.5 text-left text-[10px] font-black transition-colors ${
                  activeId === d.driverId
                    ? 'border-[#0E4225] bg-[#0E4225] text-[#FBF5DD]'
                    : 'border-[#0E4225]/20 bg-white/70 text-[#0E4225]/75 hover:border-[#28734A]'
                }`}
              >
                {d.name}
                <span className="ml-1 font-mono opacity-60">{calculateRisk(d.driverId, violations, now).riskScore}</span>
              </button>
            ))}
          </div>
        </div>
      </Panel>

      {/* Score header */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-1">
          <div className="flex flex-col items-center gap-3 text-center">
            <ScoreGauge score={risk.riskScore} />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#0E4225]/50">Risk level</p>
              <div className="mt-1.5 flex justify-center">
                <RiskBadge level={risk.riskLevel} score={risk.riskScore} />
              </div>
            </div>
            <p className="text-[11px] font-semibold text-[#0E4225]/65">
              {driver.name} · <span className="font-mono">{driver.driverId}</span> · {driver.licenseNumber}
            </p>
            <p className="text-[10px] font-medium leading-snug text-[#0E4225]/50">
              Band {risk.riskLevel === 'LOW' ? '0–30' : risk.riskLevel === 'MEDIUM' ? '31–60' : risk.riskLevel === 'HIGH' ? '61–80' : '81–100'} ·
              This is a project-configured score, not an official assessment.
            </p>
          </div>
        </Panel>

        <Panel
          className="lg:col-span-2"
          title="Risk factor breakdown"
          subtitle="Frequency 30% · Recent activity 25% · Repeat rate 25% · Severity 20%"
        >
          <ul className="space-y-3.5">
            {risk.factors.map((f) => (
              <FactorBar
                key={f.key}
                label={f.label}
                value={f.value}
                weight={f.weight}
                weighted={f.weightedValue}
                explanation={f.explanation}
              />
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#0E4225]/10 pt-3 text-[10px] font-bold text-[#0E4225]/60">
            <span className="rounded-lg bg-[#F6EDCC] px-2 py-1 font-mono">
              total = {risk.factors.reduce((s, f) => s + f.weightedValue, 0).toFixed(1)} → {risk.riskScore}
            </span>
            <span>caps: frequency {ANALYSIS_CONFIG.frequencyCap}/{ANALYSIS_CONFIG.frequencyWindowDays}d</span>
            <span>recent {ANALYSIS_CONFIG.recentCap}/{ANALYSIS_CONFIG.recentWindowDays}d</span>
            <span>decay {ANALYSIS_CONFIG.recencyDecayDays}d</span>
          </div>
        </Panel>
      </div>

      {/* Detected patterns */}
      <Panel
        title="Detected pattern"
        subtitle="Deterministic rules, not a black-box model — FR-07"
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0E4225]/8 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#0E4225]/70">
            <GitBranch className="h-3 w-3" /> {patterns.length} rule(s) matched
          </span>
        }
      >
        {patterns.length ? (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {patterns.map((p) => (
              <li
                key={`${p.type}-${p.title}`}
                className={`rounded-2xl border p-3.5 ${
                  p.severity === 'REVIEW'
                    ? 'border-orange-300 bg-orange-50'
                    : p.severity === 'WATCH'
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-[#0E4225]/15 bg-white/70'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${
                      p.severity === 'REVIEW'
                        ? 'border-orange-400 bg-orange-100 text-orange-900'
                        : p.severity === 'WATCH'
                          ? 'border-amber-400 bg-amber-100 text-amber-900'
                          : 'border-[#0E4225]/25 bg-[#0E4225]/8 text-[#0E4225]'
                    }`}
                  >
                    {p.severity}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-wider text-[#0E4225]/45">
                    {PATTERN_TYPE_LABELS[p.type]}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-black text-[#0E4225]">{p.title}</p>
                <p className="mt-0.5 text-[11px] font-medium leading-snug text-[#0E4225]/75">{p.detail}</p>
                <p className="mt-1.5 font-mono text-[9px] font-bold text-[#0E4225]/50">rule: {p.rule}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No repeated pattern detected"
            hint={`Fewer than ${ANALYSIS_CONFIG.repeatCountThreshold} repeated offences inside a ${ANALYSIS_CONFIG.repeatWindowDays}-day window, and no burst activity on record.`}
          />
        )}
      </Panel>

      {/* Trend + time profile */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel
          title="Recorded improvement trend"
          subtitle="Month-over-month comparison for this driver — FR-11"
          action={
            trend && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                  trend.direction === 'IMPROVING'
                    ? 'bg-emerald-100 text-emerald-800'
                    : trend.direction === 'DETERIORATING'
                      ? 'bg-red-100 text-red-900'
                      : 'bg-amber-100 text-amber-900'
                }`}
              >
                {trend.direction === 'IMPROVING' ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <TrendingUp className="h-3 w-3" />
                )}
                {trend.direction}
              </span>
            )
          }
        >
          {trend && trend.points.length ? (
            <>
              <BarChart
                data={trend.points.map((p) => ({ label: p.label.split(' ')[0], value: p.count }))}
                height={140}
              />
              {trend.partialExcluded && (
                <p className="mt-2 text-[10px] font-semibold text-[#0E4225]/50">
                  {trend.partialExcluded} — excluded from the comparison below because the month is still in
                  progress.
                </p>
              )}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  { k: `Latest complete · ${trend.latestLabel}`, v: trend.latest },
                  { k: `Previous · ${trend.previousLabel}`, v: trend.previous },
                  { k: 'Change', v: `${trend.changePct}%` },
                ].map((s) => (
                  <div key={s.k} className="rounded-xl border border-[#0E4225]/12 bg-white/70 p-2.5">
                    <p className="text-[9px] font-black uppercase tracking-wider text-[#0E4225]/50">{s.k}</p>
                    <p className="font-mono text-lg font-black text-[#0E4225]">{s.v}</p>
                  </div>
                ))}
              </div>
              <Notice tone="info">{trend.note}</Notice>
            </>
          ) : (
            <EmptyState title="Not enough periods to compare" hint="Improvement tracking needs at least two months of records." />
          )}
        </Panel>

        <Panel
          title="Time-of-day profile"
          subtitle="Where this driver's recorded violations concentrate — FR-09"
          action={
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0E4225]/8 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#0E4225]/70">
              <Waves className="h-3 w-3" /> {peakDayPart}
            </span>
          }
        >
          {history.length ? <BarChart data={hourly} height={140} color="#28734A" /> : <EmptyState title="No records to profile" />}
          <p className="mt-3 text-[10px] font-medium leading-snug text-[#0E4225]/55">
            Hours are shown on a 24-hour axis. Concentration in a time period is a review signal, not a conclusion about
            intent.
          </p>
        </Panel>
      </div>

      {/* Alerts for this driver */}
      {alerts.length > 0 && (
        <Panel title="Alerts raised for this driver" subtitle="Each alert lists the evidence that triggered it — FR-10">
          <ul className="space-y-2.5">
            {alerts.map((a) => (
              <li key={a.alertId} className="rounded-2xl border border-[#0E4225]/12 bg-[#F6EDCC]/50 p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <AlertSeverityBadge severity={a.severity} />
                  <span className="text-sm font-black text-[#0E4225]">{a.title}</span>
                  <span className="ml-auto font-mono text-[10px] text-[#0E4225]/45">{a.createdAt}</span>
                </div>
                <p className="mt-1 text-[11px] font-medium leading-snug text-[#0E4225]/75">{a.message}</p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-[10px] font-black uppercase tracking-wider text-[#28734A]">
                    Why was this triggered?
                  </summary>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[11px] font-medium text-[#0E4225]/70">
                    {a.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </details>
                <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-white/70 p-2 text-[11px] font-semibold text-[#0E4225]">
                  <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-[#28734A]" />
                  {a.recommendation}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* History */}
      <Panel
        title="Violation history"
        subtitle={`${history.length} record(s) · ${driverVehicles.length} vehicle(s) registered to this driver`}
        dense
      >
        {driverVehicles.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {driverVehicles.map((v) => (
              <span
                key={v.vehicleId}
                className="rounded-lg border border-[#0E4225]/18 bg-white/80 px-2.5 py-1 font-mono text-[10px] font-bold text-[#0E4225]"
              >
                {v.vehicleNumber} · {v.vehicleType.replace('_', ' ').toLowerCase()}
              </span>
            ))}
          </div>
        )}

        {history.length ? (
          <DataTable headers={['Date', 'Time', 'Offence', 'Severity', 'Location', 'Fine (INR)', 'Payment', 'Evidence']}>
            {history.map((v) => (
              <tr key={v.violationId} className="text-xs font-semibold text-[#0E4225] hover:bg-[#F6EDCC]/50">
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px]">{v.violationDate}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px]">{v.violationTime}</td>
                <td className="px-3 py-2.5">{violationLabel(v.violationType)}</td>
                <td className="px-3 py-2.5">
                  <SeverityBadge severity={v.severity} />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">{v.location}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono">{v.fineAmount.toLocaleString('en-IN')}</td>
                <td className="px-3 py-2.5">
                  <PaymentBadge status={v.paymentStatus} />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[10px] text-[#0E4225]/55">
                  {v.evidenceReference ?? '—'}
                </td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <EmptyState
            title="No violations on record"
            hint="Scenario 1 in the test plan: a new driver with no violations stays in the LOW band with no repeated pattern."
          />
        )}
      </Panel>

      <Notice tone="ethics" title="Language the system deliberately avoids">
        This screen reports recorded behaviour. It never states that a driver is dangerous, never predicts an accident,
        and never applies a penalty. The score exists to decide what an authorised officer should review next.
      </Notice>

      <details className="rounded-2xl border border-[#0E4225]/15 bg-white/70 p-4">
        <summary className="cursor-pointer text-[10px] font-black uppercase tracking-wider text-[#0E4225]/60">
          Risk band reference
        </summary>
        <ul className="mt-2 space-y-1.5">
          {RISK_LEVEL_BANDS.map((b) => (
            <li key={b.level} className="flex items-center gap-3 text-[11px] font-semibold text-[#0E4225]/70">
              <RiskBadge level={b.level} />
              <span className="font-mono">
                {b.min}–{b.max}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
