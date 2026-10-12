'use client';

import React, { useMemo, useState } from 'react';
import { FlaskConical, Info } from 'lucide-react';
import { useConsole } from '@/lib/trafficStore';
import {
  ANALYSIS_CONFIG,
  WHAT_IF_DISCLAIMER,
  WHAT_IF_SCENARIOS,
  analyseHotspots,
  analyseTime,
  analyseTrend,
  buildTrendPoints,
  calculateRisk,
  datasetProfile,
  runWhatIf,
  violationLabel,
} from '@/lib/trafficAnalytics';
import { VIOLATION_TYPES } from '@/lib/trafficData';
import { BarChart, RankedBars, RiskDistributionBar } from './charts';
import { Chip, DataTable, EmptyState, Field, Notice, Panel, inputClass } from './ui';

type TabId = 'TYPE' | 'LOCATION' | 'TIME' | 'RISK' | 'TREND' | 'WHATIF';

const TABS: { id: TabId; label: string }[] = [
  { id: 'TYPE', label: 'Violations by type' },
  { id: 'LOCATION', label: 'Violations by location' },
  { id: 'TIME', label: 'Violations by time' },
  { id: 'RISK', label: 'Risk distribution' },
  { id: 'TREND', label: 'Trends' },
  { id: 'WHATIF', label: 'What-if scenarios' },
];

export default function AnalyticsView() {
  const { drivers, vehicles, violations, now } = useConsole();
  const [tab, setTab] = useState<TabId>('TYPE');

  const profile = useMemo(() => datasetProfile(drivers, vehicles, violations, now), [drivers, vehicles, violations, now]);
  const hotspots = useMemo(() => analyseHotspots(violations, now), [violations, now]);
  const time = useMemo(() => analyseTime(violations), [violations]);

  const offenceMix = useMemo(
    () =>
      VIOLATION_TYPES.map((type) => ({
        type,
        label: violationLabel(type),
        value: violations.filter((v) => v.violationType === type).length,
        severe: violations.filter((v) => v.violationType === type && (v.severity === 'MAJOR' || v.severity === 'SEVERE')).length,
      }))
        .filter((r) => r.value > 0)
        .sort((a, b) => b.value - a.value),
    [violations],
  );

  return (
    <div className="space-y-5">
      <Panel title="Traffic Analytics" subtitle="Screen 7 — the five analytics dimensions plus historical what-if">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </Chip>
          ))}
        </div>
      </Panel>

      {tab === 'TYPE' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
          <Panel className="xl:col-span-3" title="Offence category mix" subtitle="Ranked by recorded count">
            <RankedBars
              data={offenceMix.map((r) => ({
                label: r.label,
                value: r.value,
                hint: `${r.severe} major or severe record(s) · ${((r.value / Math.max(1, profile.totalViolations)) * 100).toFixed(1)}% of dataset`,
              }))}
              barClassName={(i) => (i === 0 ? 'bg-[#B45309]' : 'bg-[#28734A]')}
            />
          </Panel>
          <Panel className="xl:col-span-2" title="Detail" subtitle="Severity split per category">
            <DataTable headers={['Offence', 'Total', 'Major+', 'Share']} minWidth={420}>
              {offenceMix.map((r) => (
                <tr key={r.type} className="text-xs font-semibold text-[#0E4225]">
                  <td className="px-3 py-2.5">{r.label}</td>
                  <td className="px-3 py-2.5 font-mono font-black">{r.value}</td>
                  <td className="px-3 py-2.5 font-mono">{r.severe}</td>
                  <td className="px-3 py-2.5 font-mono">
                    {((r.value / Math.max(1, profile.totalViolations)) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </DataTable>
            <Notice tone="info" title="Reading this chart">
              {violationLabel(profile.topViolationType)} leads the dataset at {profile.topViolationShare}%. Concentration in a
              category is an input to where enforcement and awareness effort may be directed — it is not a statement about
              any individual driver.
            </Notice>
          </Panel>
        </div>
      )}

      {tab === 'LOCATION' && (
        <Panel title="Hotspot analysis" subtitle="FR-08 — aggregation by recorded location, threshold based">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RankedBars
              data={hotspots.map((h) => ({
                label: h.location,
                value: h.count,
                hint: `${h.share}% of dataset · ${h.trend.toLowerCase()}`,
              }))}
              barClassName={(i) => (hotspots[i]?.isHotspot ? 'bg-orange-500' : 'bg-[#28734A]')}
            />
            <DataTable headers={['Location', 'Count', 'Top offence', '30d', 'Prev 30d', 'Flag']} minWidth={620}>
              {hotspots.map((h) => (
                <tr key={h.location} className="text-xs font-semibold text-[#0E4225]">
                  <td className="px-3 py-2.5 font-black">{h.location}</td>
                  <td className="px-3 py-2.5 font-mono">{h.count}</td>
                  <td className="px-3 py-2.5 text-[11px]">{violationLabel(h.topType)}</td>
                  <td className="px-3 py-2.5 font-mono">{h.recentCount}</td>
                  <td className="px-3 py-2.5 font-mono">{h.previousCount}</td>
                  <td className="px-3 py-2.5">
                    {h.isHotspot ? (
                      <span className="rounded-md border border-orange-400 bg-orange-100 px-2 py-0.5 text-[9px] font-black uppercase text-orange-900">
                        Hotspot
                      </span>
                    ) : (
                      <span className="rounded-md border border-[#0E4225]/20 bg-white px-2 py-0.5 text-[9px] font-black uppercase text-[#0E4225]/50">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
          <Notice tone="info" title="Threshold">
            A location is flagged when its recorded count reaches {ANALYSIS_CONFIG.hotspotThreshold} violations. The
            prototype shows a ranked table and bar chart; a GIS heatmap is future scope for a web or mobile release.
          </Notice>
        </Panel>
      )}

      {tab === 'TIME' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Panel className="xl:col-span-2" title="Violations by hour" subtitle="FR-09 — 24-hour aggregation">
              <BarChart
                data={time.byHour.map((h) => ({ label: h.label, value: h.count }))}
                height={190}
                highlightIndex={Number(time.peakHour.slice(0, 2))}
              />
            </Panel>
            <Panel title="Identified peaks" subtitle="Periods with the highest recorded counts">
              <ul className="space-y-2">
                {[
                  { k: 'Peak hour', v: time.peakHour },
                  { k: 'Peak day part', v: time.peakDayPart },
                  { k: 'Peak weekday', v: time.peakDayOfWeek },
                  { k: 'Peak month', v: time.peakMonth },
                ].map((row) => (
                  <li key={row.k} className="flex items-center justify-between rounded-xl border border-[#0E4225]/12 bg-white/70 px-3 py-2.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#0E4225]/55">{row.k}</span>
                    <span className="text-xs font-black text-[#0E4225]">{row.v}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Panel title="By day part" subtitle="Morning · Afternoon · Evening · Night">
              <RankedBars
                data={time.byDayPart.map((p) => ({ label: p.label, value: p.count }))}
                barClassName={() => 'bg-[#28734A]'}
              />
            </Panel>
            <Panel title="By weekday">
              <RankedBars
                data={time.byDayOfWeek.map((p) => ({ label: p.label, value: p.count }))}
                barClassName={() => 'bg-teal-600'}
              />
            </Panel>
          </div>
          <Panel title="By month" subtitle="Long-run volume shape used by the improvement report">
            <BarChart data={time.byMonth.map((m) => ({ label: m.label.split(' ')[0], value: m.count }))} height={170} />
          </Panel>
        </div>
      )}

      {tab === 'RISK' && (
        <div className="space-y-5">
          <Panel title="Risk distribution" subtitle="FR-06 — configurable 0–100 score bucketed into bands">
            <RiskDistributionBar distribution={profile.riskDistribution} />
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#0E4225]/12 bg-[#F6EDCC]/50 p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#0E4225]/55">Model</p>
                <pre className="mt-2 overflow-x-auto font-mono text-[11px] font-bold leading-relaxed text-[#0E4225]">
{`Risk Score =
    30% x Violation Frequency
  + 25% x Recent Violation Activity
  + 25% x Repeat Violation Rate
  + 20% x Severity Factor`}
                </pre>
              </div>
              <div className="rounded-2xl border border-[#0E4225]/12 bg-white/70 p-4 text-[11px] font-semibold leading-relaxed text-[#0E4225]/75">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#0E4225]/55">Normalisation</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>Frequency: violations in {ANALYSIS_CONFIG.frequencyWindowDays} days, cap {ANALYSIS_CONFIG.frequencyCap}.</li>
                  <li>Recent: {ANALYSIS_CONFIG.recentWindowDays}-day volume blended with a {ANALYSIS_CONFIG.recencyDecayDays}-day decay.</li>
                  <li>Repeat rate: share of records repeating an offence category already seen.</li>
                  <li>Severity: mean of project weights — Minor 25, Medium 50, Major 75, Severe 100.</li>
                </ul>
              </div>
            </div>
          </Panel>

          <Panel title="Highest and lowest scored drivers" subtitle="Compare the two ends of the distribution" dense>
            {(() => {
              const scored = drivers
                .map((d) => ({ d, r: calculateRisk(d.driverId, violations, now) }))
                .sort((a, b) => b.r.riskScore - a.r.riskScore);
              const top = scored.slice(0, 10);
              const bottom = scored.filter((x) => x.r.violationCount > 0).slice(-10).reverse();
              return (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#0E4225]/55">Highest scores</p>
                    <RankedBars
                      data={top.map((x) => ({ label: `${x.d.name} (${x.d.driverId})`, value: x.r.riskScore }))}
                      max={100}
                      barClassName={() => 'bg-orange-500'}
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#0E4225]/55">
                      Lowest scores among drivers with records
                    </p>
                    <RankedBars
                      data={bottom.map((x) => ({ label: `${x.d.name} (${x.d.driverId})`, value: x.r.riskScore }))}
                      max={100}
                      barClassName={() => 'bg-emerald-500'}
                    />
                  </div>
                </div>
              );
            })()}
          </Panel>
        </div>
      )}

      {tab === 'TREND' && (
        <TrendTab violations={violations} />
      )}

      {tab === 'WHATIF' && <WhatIfTab violations={violations} hotspots={hotspots} />}
    </div>
  );
}

function TrendTab({ violations }: { violations: ReturnType<typeof useConsole>['violations'] }) {
  const { now } = useConsole();
  const monthly = useMemo(() => buildTrendPoints(violations, now), [violations, now]);
  const trend = useMemo(() => analyseTrend(violations, now), [violations, now]);

  const severityByMonth = useMemo(() => {
    const map = new Map<string, { total: number; majorPlus: number }>();
    violations.forEach((v) => {
      const key = v.violationDate.slice(0, 7);
      const cur = map.get(key) ?? { total: 0, majorPlus: 0 };
      cur.total += 1;
      if (v.severity === 'MAJOR' || v.severity === 'SEVERE') cur.majorPlus += 1;
      map.set(key, cur);
    });
    return map;
  }, [violations]);

  return (
    <div className="space-y-5">
      <Panel title="Volume trend" subtitle="FR-11 — recorded violations per month across the dataset">
        {monthly.length ? (
          <>
            <BarChart
              data={monthly.map((p) => ({ label: p.label.split(' ')[0], value: p.count }))}
              height={190}
              highlightIndex={monthly.length - 1}
            />
            {trend.partialExcluded && (
              <p className="mt-2 text-[10px] font-semibold text-[#0E4225]/50">
                {trend.partialExcluded} — the month is still in progress, so its bar is a running total rather than a
                full month.
              </p>
            )}
          </>
        ) : (
          <EmptyState title="No monthly data" />
        )}
      </Panel>

      <Panel
        title="Period comparison"
        subtitle={`Complete months only — ${trend.previousLabel} compared with ${trend.latestLabel}`}
        dense
      >
        <DataTable headers={['Period', 'Violations', 'Change vs previous', 'Major + severe', 'Direction']}>
          {monthly.map((p, i) => {
            const prev = i > 0 ? monthly[i - 1].count : null;
            /* An in-progress month is not comparable, so no delta or
             * direction is reported for it. */
            const comparable = prev !== null && !p.partial;
            const delta = comparable ? p.count - prev : null;
            const dir =
              !comparable || delta === null || prev === null
                ? '—'
                : delta <= -Math.round(prev * 0.15)
                  ? 'IMPROVING'
                  : delta >= Math.round(prev * 0.15)
                    ? 'DETERIORATING'
                    : 'STABLE';
            return (
              <tr key={p.key} className={`text-xs font-semibold text-[#0E4225]${p.partial ? ' opacity-60' : ''}`}>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono">
                  {p.key}
                  {p.partial && <span className="ml-1.5 text-[9px] uppercase">in progress</span>}
                </td>
                <td className="px-3 py-2.5 font-mono font-black">{p.count}</td>
                <td className="px-3 py-2.5 font-mono">
                  {delta === null || p.partial ? '—' : `${delta >= 0 ? '+' : ''}${delta}`}
                </td>
                <td className="px-3 py-2.5 font-mono">{severityByMonth.get(p.key)?.majorPlus ?? 0}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase ${
                      dir === 'IMPROVING'
                        ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                        : dir === 'DETERIORATING'
                          ? 'border-red-300 bg-red-100 text-red-900'
                          : 'border-amber-300 bg-amber-100 text-amber-900'
                    }`}
                  >
                    {dir}
                  </span>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </Panel>

      <Notice tone="info" title="Important limitation">
        A falling count describes the records held by the system for the compared periods. It is not proof that driving
        behaviour changed, because record volume also depends on enforcement presence, camera uptime and reporting
        practice.
      </Notice>
    </div>
  );
}

function WhatIfTab({
  violations,
  hotspots,
}: {
  violations: ReturnType<typeof useConsole>['violations'];
  hotspots: ReturnType<typeof analyseHotspots>;
}) {
  const { now } = useConsole();
  const [location, setLocation] = useState(hotspots[0]?.location ?? '');
  const [scenarioId, setScenarioId] = useState(WHAT_IF_SCENARIOS[0].id);
  const scenario = WHAT_IF_SCENARIOS.find((s) => s.id === scenarioId) ?? WHAT_IF_SCENARIOS[0];
  const result = useMemo(() => runWhatIf(location, scenario, violations, now), [location, scenario, violations, now]);

  if (!location) {
    return (
      <Panel title="What-if analysis">
        <EmptyState title="No locations with recorded violations" />
      </Panel>
    );
  }

  return (
    <div className="space-y-5">
      <Panel title="What-if scenario engine" subtitle="FR-12 — historical-data-based estimate, clearly labelled as such">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Location" required>
            <select value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass}>
              {hotspots.map((h) => (
                <option key={h.location} value={h.location}>
                  {h.location} — {h.count} record(s)
                </option>
              ))}
            </select>
          </Field>
          <Field label="Scenario" required>
            <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} className={inputClass}>
              {WHAT_IF_SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="mt-3 text-[11px] font-medium leading-relaxed text-[#0E4225]/65">{scenario.description}</p>
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Historical baseline" subtitle="What the dataset already contains for this location">
          <div className="rounded-2xl border border-[#0E4225]/15 bg-[#F6EDCC]/60 p-4">
            <p className="text-3xl font-black tracking-tight text-[#0E4225]">{result.baseline}</p>
            <p className="text-[11px] font-semibold text-[#0E4225]/70">recorded violations at {result.location}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-semibold text-[#0E4225]/75">
              <div className="rounded-lg bg-white/70 px-2.5 py-2">
                <dt className="text-[9px] font-black uppercase tracking-wider text-[#0E4225]/50">Months observed</dt>
                <dd className="font-mono text-base font-black text-[#0E4225]">{result.monthsObserved}</dd>
              </div>
              <div className="rounded-lg bg-white/70 px-2.5 py-2">
                <dt className="text-[9px] font-black uppercase tracking-wider text-[#0E4225]/50">Mean per month</dt>
                <dd className="font-mono text-base font-black text-[#0E4225]">{result.meanMonthly}</dd>
              </div>
              <div className="rounded-lg bg-white/70 px-2.5 py-2">
                <dt className="text-[9px] font-black uppercase tracking-wider text-[#0E4225]/50">Dominant offence</dt>
                <dd className="text-xs font-black text-[#0E4225]">{violationLabel(result.dominantType)}</dd>
              </div>
              <div className="rounded-lg bg-white/70 px-2.5 py-2">
                <dt className="text-[9px] font-black uppercase tracking-wider text-[#0E4225]/50">Peak hour here</dt>
                <dd className="font-mono text-base font-black text-[#0E4225]">{result.peakHour}</dd>
              </div>
            </dl>
          </div>
        </Panel>

        <Panel
          title="Estimated historical range"
          subtitle="Comparable low months at this location, expressed against the baseline"
          action={
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0E4225]/8 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#0E4225]/70">
              <FlaskConical className="h-3 w-3" /> Scenario estimate
            </span>
          }
        >
          <div className="space-y-3">
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                Estimated reduction range vs baseline
              </p>
              <p className="mt-1 text-3xl font-black tracking-tight text-amber-900">
                {result.reductionRange[0]}–{result.reductionRange[1]}%
              </p>
              <p className="mt-1 text-[11px] font-semibold text-amber-900/80">
                Equivalent to between {result.estimatedRange[0]} and {result.estimatedRange[1]} violations across the
                observed months.
              </p>
            </div>
            <ul className="space-y-1.5 text-[11px] font-semibold text-[#0E4225]/75">
              <li className="flex items-center justify-between rounded-xl border border-[#0E4225]/12 bg-white/70 px-3 py-2">
                <span>Historical baseline</span>
                <span className="font-mono font-black">{result.baseline} violations</span>
              </li>
              <li className="flex items-center justify-between rounded-xl border border-[#0E4225]/12 bg-white/70 px-3 py-2">
                <span>Comparable low months at this location</span>
                <span className="font-mono font-black">
                  {result.lowBand[0]}–{result.lowBand[1]} per month
                </span>
              </li>
              <li className="flex items-center justify-between rounded-xl border border-[#0E4225]/12 bg-white/70 px-3 py-2">
                <span>Dominant offence share</span>
                <span className="font-mono font-black">{result.dominantShare}%</span>
              </li>
            </ul>
          </div>
        </Panel>
      </div>

      <Panel title="How this estimate is derived" subtitle="Deterministic, inspectable and reproducible">
        <ol className="space-y-2 text-[11px] font-semibold leading-relaxed text-[#0E4225]/75">
          <li>1. Take every violation recorded at {result.location} and group them by calendar month.</li>
          <li>2. Compute the mean monthly count ({result.meanMonthly}) across the {result.monthsObserved} month(s) observed.</li>
          <li>3. Find the lowest observed months — the 25th and 10th percentile of the monthly counts.</li>
          <li>4. Express the gap between the mean and those low months as a percentage band.</li>
          <li>5. Apply the band to the historical baseline to produce the estimated range shown above.</li>
        </ol>
        <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-[#F6EDCC] p-3 text-[11px] font-semibold text-[#0E4225]/80">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {result.note}
        </p>
      </Panel>

      <Notice tone="warn" title="Required disclaimer">
        <strong className="font-black">{WHAT_IF_DISCLAIMER}</strong> This output is scenario analysis for review
        purposes. It must not be presented as a guaranteed prediction, and it does not justify any automatic action.
      </Notice>

      <Panel title="Compare a different scenario" subtitle="Same location, same data, different review focus">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {WHAT_IF_SCENARIOS.map((s) => {
            const r = runWhatIf(location, s, violations);
            return (
              <button
                key={s.id}
                onClick={() => setScenarioId(s.id)}
                className={`rounded-2xl border p-3 text-left transition-colors ${
                  s.id === scenarioId
                    ? 'border-[#0E4225] bg-[#F6EDCC]'
                    : 'border-[#0E4225]/15 bg-white/70 hover:border-[#28734A]'
                }`}
              >
                <p className="text-[10px] font-black uppercase tracking-wider text-[#0E4225]/55">{s.label}</p>
                <p className="mt-1 font-mono text-lg font-black text-[#0E4225]">
                  {r.reductionRange[0]}–{r.reductionRange[1]}%
                </p>
                <p className="text-[10px] font-medium text-[#0E4225]/55">{s.reviewFocus}</p>
              </button>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
