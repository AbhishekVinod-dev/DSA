'use client';

import React, { useMemo, useState } from 'react';
import { BellRing, ChevronDown, ChevronUp, ShieldQuestion } from 'lucide-react';
import { useConsole } from '@/lib/trafficStore';
import { ALERT_TYPE_LABELS, ANALYSIS_CONFIG, buildAlerts } from '@/lib/trafficAnalytics';
import { AlertSeverityBadge, Chip, EmptyState, Notice, Panel, StatCard } from './ui';

type SeverityFilter = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW';
type StatusFilter = 'ALL' | 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED';
type TypeFilter = 'ALL' | 'REPEATED_PATTERN' | 'FREQUENCY_INCREASE' | 'HIGH_RISK' | 'LOCATION_HOTSPOT' | 'IMPROVEMENT_TREND';

export default function AlertsView() {
  const { drivers, violations, now, alertStatus, setAlertStatus } = useConsole();
  const [severity, setSeverity] = useState<SeverityFilter>('ALL');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [type, setType] = useState<TypeFilter>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [limit, setLimit] = useState(15);

  const alerts = useMemo(
    () =>
      buildAlerts(drivers, violations, now).map((a) => ({
        ...a,
        status: alertStatus[a.alertId] ?? a.status,
      })),
    [drivers, violations, now, alertStatus],
  );

  const filtered = useMemo(
    () =>
      alerts.filter(
        (a) =>
          (severity === 'ALL' || a.severity === severity) &&
          (status === 'ALL' || a.status === status) &&
          (type === 'ALL' || a.alertType === type),
      ),
    [alerts, severity, status, type],
  );

  const counts = useMemo(
    () => ({
      HIGH: alerts.filter((a) => a.severity === 'HIGH').length,
      MEDIUM: alerts.filter((a) => a.severity === 'MEDIUM').length,
      LOW: alerts.filter((a) => a.severity === 'LOW').length,
      NEW: alerts.filter((a) => a.status === 'NEW').length,
    }),
    [alerts],
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open alerts" value={counts.NEW} hint="Not yet acknowledged" icon={<BellRing className="h-4 w-4" />} tone="warn" />
        <StatCard label="High severity" value={counts.HIGH} hint="Recommended for early review" icon={<ShieldQuestion className="h-4 w-4" />} tone="alert" />
        <StatCard label="Medium severity" value={counts.MEDIUM} hint="Within normal review flow" />
        <StatCard label="Low severity" value={counts.LOW} hint="Context and improvement notes" />
      </div>

      <Panel
        title="Smart alerts"
        subtitle="Screen 8 — every alert explains the trigger that produced it"
        action={
          <div className="flex flex-wrap gap-1.5">
            {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as SeverityFilter[]).map((s) => (
              <Chip key={s} active={severity === s} onClick={() => setSeverity(s)}>
                {s}
              </Chip>
            ))}
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap gap-1.5">
          {(['ALL', 'NEW', 'ACKNOWLEDGED', 'RESOLVED'] as StatusFilter[]).map((s) => (
            <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
              {s}
            </Chip>
          ))}
          <span className="mx-1 w-px self-stretch bg-[#0E4225]/12" />
          {(['ALL', 'HIGH_RISK', 'REPEATED_PATTERN', 'FREQUENCY_INCREASE', 'LOCATION_HOTSPOT', 'IMPROVEMENT_TREND'] as TypeFilter[]).map(
            (t) => (
              <Chip key={t} active={type === t} onClick={() => setType(t)}>
                {t === 'ALL' ? 'All types' : ALERT_TYPE_LABELS[t]}
              </Chip>
            ),
          )}
        </div>

        <Notice tone="info">
          The review queue is prioritised by risk score, so driver-level alerts are raised for the{' '}
          {ANALYSIS_CONFIG.reviewQueueSize} highest-scoring drivers who have records on file. A driver below that
          cut is not cleared &mdash; their records simply have not been surfaced for review yet. Location, time and
          improvement alerts are always evaluated across the whole dataset.
        </Notice>

        {filtered.length ? (
          <>
            <ul className="space-y-3">
              {filtered.slice(0, limit).map((a) => {
                const open = expanded === a.alertId;
                return (
                  <li key={a.alertId} className="rounded-2xl border border-[#0E4225]/12 bg-white/80 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <AlertSeverityBadge severity={a.severity} />
                      <span className="rounded-md border border-[#0E4225]/18 bg-[#0E4225]/6 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#0E4225]/65">
                        {ALERT_TYPE_LABELS[a.alertType]}
                      </span>
                      <span className="ml-auto font-mono text-[10px] font-bold text-[#0E4225]/45">{a.createdAt}</span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase ${
                          a.status === 'NEW'
                            ? 'border-amber-300 bg-amber-100 text-amber-900'
                            : a.status === 'ACKNOWLEDGED'
                              ? 'border-[#0E4225]/25 bg-[#0E4225]/8 text-[#0E4225]'
                              : 'border-emerald-300 bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {a.status}
                      </span>
                    </div>

                    <h4 className="mt-2 text-sm font-black text-[#0E4225]">{a.title}</h4>
                    <p className="mt-0.5 text-xs font-medium leading-relaxed text-[#0E4225]/75">{a.message}</p>

                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold text-[#0E4225]/60">
                      {a.driverId && (
                        <span className="rounded-lg bg-[#F6EDCC] px-2 py-1 font-mono">driver {a.driverId}</span>
                      )}
                      {a.location && <span className="rounded-lg bg-[#F6EDCC] px-2 py-1">location {a.location}</span>}
                    </div>

                    <button
                      onClick={() => setExpanded(open ? null : a.alertId)}
                      className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#28734A]"
                    >
                      Why was this triggered?
                      {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>

                    {open && (
                      <div className="mt-2 space-y-2 rounded-xl border border-[#0E4225]/12 bg-[#F6EDCC]/50 p-3">
                        <ul className="list-disc space-y-1 pl-4 text-[11px] font-semibold text-[#0E4225]/80">
                          {a.reasons.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                        <p className="border-t border-[#0E4225]/10 pt-2 text-[11px] font-bold text-[#0E4225]">
                          Suggested review: {a.recommendation}
                        </p>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {a.status !== 'NEW' && (
                        <button
                          onClick={() => setAlertStatus(a.alertId, 'NEW')}
                          className="rounded-lg border border-[#0E4225]/20 bg-white px-2.5 py-1 text-[10px] font-black text-[#0E4225]/70 hover:border-[#28734A]"
                        >
                          Reopen
                        </button>
                      )}
                      {a.status === 'NEW' && (
                        <button
                          onClick={() => setAlertStatus(a.alertId, 'ACKNOWLEDGED')}
                          className="rounded-lg border border-[#0E4225]/20 bg-white px-2.5 py-1 text-[10px] font-black text-[#0E4225] hover:border-[#28734A]"
                        >
                          Acknowledge
                        </button>
                      )}
                      {a.status !== 'RESOLVED' && (
                        <button
                          onClick={() => setAlertStatus(a.alertId, 'RESOLVED')}
                          className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-800"
                        >
                          Mark resolved
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {filtered.length > limit && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => setLimit((l) => l + 15)}
                  className="rounded-xl border border-[#0E4225]/20 bg-white/80 px-4 py-2 text-[11px] font-black text-[#0E4225] hover:border-[#28734A]"
                >
                  Show more ({filtered.length - limit} remaining)
                </button>
              </div>
            )}
          </>
        ) : (
          <EmptyState title="No alerts match these filters" hint="Try clearing the type or status filter." />
        )}
      </Panel>

      <Notice tone="ethics" title="Alert design rules">
        Alerts are informational. The wording is deliberately evidence-based — “repeated violation pattern detected in the
        available records” — and never labels a person. Recommendations describe what an authorised officer could review
        next; the system never takes automatic legal or punitive action.
      </Notice>
    </div>
  );
}
