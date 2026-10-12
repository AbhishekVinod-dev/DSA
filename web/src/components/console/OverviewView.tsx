'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Car,
  FileWarning,
  Flame,
  Gauge,
  MapPin,
  ReceiptIndianRupee,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useConsole } from '@/lib/trafficStore';
import {
  ALERT_TYPE_LABELS,
  analyseHotspots,
  analyseTime,
  buildAlerts,
  calculateRisk,
  datasetProfile,
  detectPatterns,
  violationLabel,
} from '@/lib/trafficAnalytics';
import { VIOLATION_TYPES } from '@/lib/trafficData';
import { BarChart, RankedBars, RiskDistributionBar } from './charts';
import {
  AlertSeverityBadge,
  Chip,
  DataTable,
  Notice,
  Panel,
  PaymentBadge,
  RiskBadge,
  SeverityBadge,
  StatCard,
} from './ui';

export default function OverviewView() {
  const { drivers, vehicles, violations, now, alertStatus, setAlertStatus } = useConsole();
  const [alertFilter, setAlertFilter] = useState<'ALL' | 'NEW' | 'ACKNOWLEDGED'>('ALL');

  const profile = useMemo(() => datasetProfile(drivers, vehicles, violations, now), [drivers, vehicles, violations, now]);
  const hotspots = useMemo(() => analyseHotspots(violations, now).slice(0, 8), [violations, now]);
  const time = useMemo(() => analyseTime(violations), [violations]);
  const alerts = useMemo(() => buildAlerts(drivers, violations, now), [drivers, violations, now]);

  const offenceMix = useMemo(
    () =>
      VIOLATION_TYPES.map((type) => ({
        label: violationLabel(type),
        value: violations.filter((v) => v.violationType === type).length,
      }))
        .filter((r) => r.value > 0)
        .sort((a, b) => b.value - a.value),
    [violations],
  );

  const highRiskDrivers = useMemo(
    () =>
      drivers
        .map((d) => ({ driver: d, risk: calculateRisk(d.driverId, violations, now) }))
        .filter((r) => r.risk.riskLevel === 'HIGH' || r.risk.riskLevel === 'CRITICAL')
        .sort((a, b) => b.risk.riskScore - a.risk.riskScore)
        .slice(0, 8),
    [drivers, violations, now],
  );

  const recentViolations = useMemo(() => violations.slice(0, 10), [violations]);
  const volumeSeries = profile.monthlyVolume;

  const visibleAlerts = alerts
    .map((a) => ({ ...a, status: alertStatus[a.alertId] ?? a.status }))
    .filter((a) => (alertFilter === 'ALL' ? true : a.status === alertFilter))
    .slice(0, 8);

  return (
    <div className="space-y-5">
      {/* FR-01 role banner + PRD §11 dashboard metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total drivers"
          value={profile.totalDrivers.toLocaleString('en-IN')}
          hint="Driver records in the dataset"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Total vehicles"
          value={profile.totalVehicles.toLocaleString('en-IN')}
          hint="Registered vehicles linked to a driver"
          icon={<Car className="h-4 w-4" />}
        />
        <StatCard
          label="Total violations"
          value={profile.totalViolations.toLocaleString('en-IN')}
          hint="Records across all offence categories"
          icon={<FileWarning className="h-4 w-4" />}
        />
        <StatCard
          label="Pending fines"
          value={profile.pendingFines.toLocaleString('en-IN')}
          hint={`INR ${profile.pendingFineAmount.toLocaleString('en-IN')} outstanding`}
          icon={<ReceiptIndianRupee className="h-4 w-4" />}
          tone="warn"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel
          title="Headline signals"
          subtitle="The four questions the dashboard must answer at a glance"
          className="xl:col-span-2"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SignalRow
              icon={<Gauge className="h-4 w-4" />}
              label="High-risk drivers"
              value={`${profile.highRiskDrivers}`}
              hint="Score 61 or above (HIGH / CRITICAL band)"
            />
            <SignalRow
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Top violation type"
              value={violationLabel(profile.topViolationType)}
              hint={`${profile.topViolationShare}% of all recorded violations`}
            />
            <SignalRow
              icon={<MapPin className="h-4 w-4" />}
              label="Top hotspot"
              value={profile.topHotspot}
              hint={`${profile.hotspotCount} location(s) above the hotspot threshold`}
            />
            <SignalRow
              icon={<Flame className="h-4 w-4" />}
              label="Peak violation period"
              value={time.peakDayPart}
              hint={`${profile.peakPeriod} · busiest weekday ${time.peakDayOfWeek}`}
            />
          </div>

          <div className="mt-5 border-t border-[#0E4225]/10 pt-5">
            <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-[#0E4225]/55">
              Risk distribution across all drivers (FR-06)
            </p>
            <RiskDistributionBar distribution={profile.riskDistribution} />
          </div>
        </Panel>

        <Panel title="Recorded monthly volume" subtitle="Improvement tracking input (FR-11)">
          <BarChart
            data={volumeSeries.map((p) => ({ label: p.label.split(' ')[0], value: p.count }))}
            highlightIndex={volumeSeries.length - 1}
            height={150}
          />
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[#F6EDCC] px-3 py-2.5 text-[11px] font-bold text-[#0E4225]/80">
            <span className="flex items-center gap-1.5">
              {profile.trend.direction === 'IMPROVING' ? (
                <TrendingDown className="h-3.5 w-3.5 text-emerald-700" />
              ) : (
                <TrendingUp className="h-3.5 w-3.5 text-amber-600" />
              )}
              {profile.trend.previousLabel} → {profile.trend.latestLabel}
            </span>
            <span className="font-mono">
              {profile.trend.previous} → {profile.trend.latest}
              <span className={profile.trend.changePct > 0 ? 'text-amber-700' : 'text-emerald-700'}>
                {' '}
                ({profile.trend.changePct > 0 ? '+' : ''}
                {profile.trend.changePct}%)
              </span>
            </span>
          </div>
          {profile.trend.partialExcluded && (
            <p className="mt-2 text-[10px] font-semibold leading-relaxed text-[#0E4225]/50">
              {profile.trend.partialExcluded} — not compared, because the month is still in progress.
            </p>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Offence mix" subtitle="Records by offence category">
          <RankedBars
            data={offenceMix}
            barClassName={(i) => (i === 0 ? 'bg-[#B45309]' : 'bg-[#28734A]')}
          />
        </Panel>

        <Panel title="Location hotspots" subtitle="Ranked by recorded violation count (FR-08)">
          <RankedBars
            data={hotspots.map((h) => ({
              label: h.location,
              value: h.count,
              hint: `${violationLabel(h.topType)} leads · ${h.trend.toLowerCase()} · ${h.isHotspot ? 'HOTSPOT' : 'below threshold'}`,
            }))}
            barClassName={(i) => (hotspots[i]?.isHotspot ? 'bg-orange-500' : 'bg-[#28734A]')}
          />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel
          title="Highest recorded risk scores"
          subtitle="Explainable scores — open Driver Risk Analysis for the full factor breakdown"
        >
          <DataTable headers={['Driver', 'Licence', 'Violations', 'Score', 'Level', 'Pattern']} minWidth={640}>
            {highRiskDrivers.map(({ driver, risk }) => {
              const pattern = detectPatterns(driver.driverId, violations, now).find(
                (p) => p.type === 'REPEATED_TYPE' || p.type === 'BURST',
              );
              return (
                <tr key={driver.driverId} className="text-xs font-semibold text-[#0E4225]">
                  <td className="px-3 py-2.5">
                    <span className="font-black">{driver.name}</span>
                    <span className="ml-1.5 font-mono text-[10px] text-[#0E4225]/45">{driver.driverId}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-[#0E4225]/65">
                    {driver.licenseNumber}
                  </td>
                  <td className="px-3 py-2.5 font-mono">{risk.violationCount}</td>
                  <td className="px-3 py-2.5 font-mono font-black">{risk.riskScore}</td>
                  <td className="px-3 py-2.5">
                    <RiskBadge level={risk.riskLevel} />
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-[#0E4225]/70">{pattern?.title ?? '—'}</td>
                </tr>
              );
            })}
          </DataTable>
        </Panel>

        <Panel
          title="Latest alerts"
          subtitle="Each alert states the rule that triggered it (FR-10)"
          action={
            <div className="flex gap-1.5">
              {(['ALL', 'NEW', 'ACKNOWLEDGED'] as const).map((f) => (
                <Chip key={f} active={alertFilter === f} onClick={() => setAlertFilter(f)}>
                  {f}
                </Chip>
              ))}
            </div>
          }
        >
          <ul className="space-y-2.5">
            {visibleAlerts.map((a) => (
              <li key={a.alertId} className="rounded-2xl border border-[#0E4225]/12 bg-[#F6EDCC]/50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <AlertSeverityBadge severity={a.severity} />
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#0E4225]/50">
                    {ALERT_TYPE_LABELS[a.alertType]}
                  </span>
                  <span className="ml-auto font-mono text-[10px] text-[#0E4225]/45">{a.createdAt}</span>
                </div>
                <p className="mt-1.5 text-xs font-black text-[#0E4225]">{a.title}</p>
                <p className="mt-0.5 text-[11px] font-medium leading-snug text-[#0E4225]/75">{a.message}</p>
                {a.status === 'NEW' && (
                  <button
                    onClick={() => setAlertStatus(a.alertId, 'ACKNOWLEDGED')}
                    className="mt-2 rounded-lg border border-[#0E4225]/20 bg-white px-2.5 py-1 text-[10px] font-black text-[#0E4225] hover:border-[#28734A] hover:text-[#28734A]"
                  >
                    Acknowledge
                  </button>
                )}
                {a.status === 'ACKNOWLEDGED' && (
                  <button
                    onClick={() => setAlertStatus(a.alertId, 'RESOLVED')}
                    className="mt-2 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-800"
                  >
                    Mark resolved
                  </button>
                )}
                {a.status === 'RESOLVED' && (
                  <span className="mt-2 inline-block rounded-lg bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-800">
                    Resolved
                  </span>
                )}
              </li>
            ))}
            {!visibleAlerts.length && (
              <li className="rounded-2xl border border-dashed border-[#0E4225]/25 p-6 text-center text-xs font-semibold text-[#0E4225]/50">
                No alerts in this filter.
              </li>
            )}
          </ul>
        </Panel>
      </div>

      <Panel title="Most recent violation records" subtitle="Newest entries appear first" dense>
        <DataTable
          headers={['Violation ID', 'Date', 'Time', 'Offence', 'Severity', 'Location', 'Fine (INR)', 'Payment', 'Officer']}
        >
          {recentViolations.map((v) => (
            <tr key={v.violationId} className="text-xs font-semibold text-[#0E4225]">
              <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px]">{v.violationId}</td>
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
              <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-[#0E4225]/60">{v.officerId}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <Notice tone="ethics" title="How to read this dashboard">
        Every number above is computed from the violation records held in the database. Risk scores use
        configurable project weights, fine amounts follow a project prototype rule table, and no figure here
        constitutes an official assessment, a legal finding, or an automatic penalty.
      </Notice>
    </div>
  );
}

function SignalRow({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[#0E4225]/12 bg-white/80 p-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#0E4225]/15 bg-[#0E4225]/8 text-[#0E4225]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-black uppercase tracking-wider text-[#0E4225]/55">{label}</span>
        <span className="block truncate text-base font-black tracking-tight text-[#0E4225]">{value}</span>
        <span className="block text-[10px] font-medium leading-snug text-[#0E4225]/55">{hint}</span>
      </span>
    </div>
  );
}
