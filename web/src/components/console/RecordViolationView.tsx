'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, FilePlus2, Info } from 'lucide-react';
import { useConsole } from '@/lib/trafficStore';
import {
  BASE_FINE,
  LOCATIONS,
  SEVERITIES,
  SEVERITY_LABELS,
  SEVERITY_MULTIPLIER,
  SEVERITY_WEIGHT,
  VIOLATION_LABELS,
  VIOLATION_TYPES,
  calculateFine,
} from '@/lib/trafficData';
import { calculateRisk, detectPatterns } from '@/lib/trafficAnalytics';
import { DataTable, Field, Notice, Panel, PrimaryButton, RiskBadge, inputClass } from './ui';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function RecordViolationView() {
  const { drivers, vehicles, officers, recordViolation, violations, now } = useConsole();
  const [form, setForm] = useState({
    driverQuery: '',
    driverId: '',
    vehicleId: '',
    violationType: 'OVERSPEEDING' as keyof typeof VIOLATION_LABELS,
    location: LOCATIONS[0].name,
    violationDate: todayISO(),
    violationTime: '12:00',
    severity: 'MEDIUM' as keyof typeof SEVERITY_LABELS,
    paymentStatus: 'PENDING' as 'PENDING' | 'PAID' | 'CHALLENGED',
    evidenceReference: '',
    officerId: officers[0]?.officerId ?? 'OF-1001',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<{ id: string; fine: number; score: number; level: string; patterns: string[] } | null>(null);

  const matchedDrivers = useMemo(() => {
    const q = form.driverQuery.trim().toLowerCase();
    if (!q) return drivers.slice(0, 8);
    return drivers
      .filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.driverId.toLowerCase().includes(q) ||
          d.licenseNumber.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [drivers, form.driverQuery]);

  const selectedDriver = drivers.find((d) => d.driverId === form.driverId) ?? null;
  const ownerVehicles = useMemo(
    () => vehicles.filter((v) => v.driverId === form.driverId),
    [vehicles, form.driverId],
  );

  const fine = calculateFine(form.violationType as never, form.severity as never);

  const validate = (): string[] => {
    const list: string[] = [];
    if (!form.driverId) list.push('Select a driver — every violation must be attributable to a driver record.');
    if (!form.vehicleId) list.push('Select the vehicle involved.');
    if (!form.location.trim()) list.push('Location is required for hotspot analysis.');
    if (!form.violationDate) list.push('Violation date is required.');
    if (form.violationDate > todayISO()) list.push('Violation date cannot be in the future.');
    if (!/^\d{2}:\d{2}$/.test(form.violationTime)) list.push('Time must use the 24-hour HH:MM format.');
    return list;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (found.length) return;

    const record = recordViolation({
      driverId: form.driverId,
      vehicleId: form.vehicleId,
      violationType: form.violationType as never,
      location: form.location,
      violationDate: form.violationDate,
      violationTime: form.violationTime,
      severity: form.severity as never,
      paymentStatus: form.paymentStatus,
      evidenceReference: form.evidenceReference,
      officerId: form.officerId,
    });

    /* Immediately re-run the analytics pipeline for the affected driver. */
    const projected = [record, ...violations];
    const risk = calculateRisk(form.driverId, projected, now);
    const patterns = detectPatterns(form.driverId, projected, now);

    setReceipt({
      id: record.violationId,
      fine: record.fineAmount,
      score: risk.riskScore,
      level: risk.riskLevel,
      patterns: patterns.filter((p) => p.severity !== 'INFO').map((p) => p.title),
    });
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
      <div className="xl:col-span-3">
        <Panel
          title="Record a violation"
          subtitle="FR-04 record fields — every field feeds a specific analytics feature"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Driver search */}
            <div>
              <Field label="Find driver" hint="Search by name, driver ID or licence number, then pick the record.">
                <input
                  value={form.driverQuery}
                  onChange={(e) => setForm({ ...form, driverQuery: e.target.value, driverId: '', vehicleId: '' })}
                  placeholder="e.g. D1024 or Karthik"
                  className={inputClass}
                />
              </Field>
              <ul className="mt-2 space-y-1.5">
                {matchedDrivers.map((d) => (
                  <li key={d.driverId}>
                    <button
                      type="button"
                      onClick={() => {
                        const first = vehicles.find((v) => v.driverId === d.driverId);
                        setForm({ ...form, driverId: d.driverId, vehicleId: first?.vehicleId ?? '' });
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-xs font-bold transition-colors ${
                        form.driverId === d.driverId
                          ? 'border-[#28734A] bg-[#F6EDCC] text-[#0E4225]'
                          : 'border-[#0E4225]/15 bg-white/70 text-[#0E4225]/75 hover:border-[#28734A]'
                      }`}
                    >
                      <span>
                        {d.name} <span className="font-mono text-[10px] opacity-60">{d.driverId}</span>
                      </span>
                      <span className="font-mono text-[10px] opacity-60">{d.licenseNumber}</span>
                    </button>
                  </li>
                ))}
                {!matchedDrivers.length && (
                  <li className="rounded-xl border border-dashed border-[#0E4225]/25 p-3 text-[11px] font-semibold text-[#0E4225]/50">
                    No driver matches. Add the driver in the Drivers screen first.
                  </li>
                )}
              </ul>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Vehicle" required>
                <select
                  value={form.vehicleId}
                  onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Select vehicle</option>
                  {ownerVehicles.map((v) => (
                    <option key={v.vehicleId} value={v.vehicleId}>
                      {v.vehicleNumber} — {v.model}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reporting officer" required>
                <select
                  value={form.officerId}
                  onChange={(e) => setForm({ ...form, officerId: e.target.value })}
                  className={inputClass}
                >
                  {officers.map((o) => (
                    <option key={o.officerId} value={o.officerId}>
                      {o.name} — {o.beat}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Violation type" required>
                <select
                  value={form.violationType}
                  onChange={(e) => setForm({ ...form, violationType: e.target.value as never })}
                  className={inputClass}
                >
                  {VIOLATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {VIOLATION_LABELS[t]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Location" required hint="Free text or pick a known corridor.">
                <input
                  list="location-options"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className={inputClass}
                />
                <datalist id="location-options">
                  {LOCATIONS.map((l) => (
                    <option key={l.name} value={l.name} />
                  ))}
                </datalist>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Date" required>
                <input
                  type="date"
                  value={form.violationDate}
                  onChange={(e) => setForm({ ...form, violationDate: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Time (24h)" required>
                <input
                  type="time"
                  value={form.violationTime}
                  onChange={(e) => setForm({ ...form, violationTime: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Payment status" required>
                <select
                  value={form.paymentStatus}
                  onChange={(e) => setForm({ ...form, paymentStatus: e.target.value as never })}
                  className={inputClass}
                >
                  <option value="PENDING">Pending</option>
                  <option value="PAID">Paid</option>
                  <option value="CHALLENGED">Challenged</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Severity" required hint="Drives the severity factor of the risk model.">
                <select
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value as never })}
                  className={inputClass}
                >
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {SEVERITY_LABELS[s]} (weight {SEVERITY_WEIGHT[s]})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Evidence reference" hint="Optional camera, challan or diary reference.">
                <input
                  value={form.evidenceReference}
                  onChange={(e) => setForm({ ...form, evidenceReference: e.target.value })}
                  placeholder="CAM-01-0042"
                  className={inputClass}
                />
              </Field>
            </div>

            {errors.length > 0 && (
              <Notice tone="warn" title="Fix before saving">
                <ul className="list-disc space-y-0.5 pl-4">
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </Notice>
            )}

            <PrimaryButton type="submit" className="w-full py-3">
              <FilePlus2 className="h-4 w-4" /> Save violation &amp; re-run analytics
            </PrimaryButton>
          </form>
        </Panel>
      </div>

      <div className="space-y-5 xl:col-span-2">
        {/* FR-05 live fine calculation */}
        <Panel title="Calculated fine" subtitle="FR-05 — configurable prototype rule">
          <div className="rounded-2xl border border-[#0E4225]/15 bg-[#F6EDCC]/60 p-4">
            <p className="text-3xl font-black tracking-tight text-[#0E4225]">₹{fine.toLocaleString('en-IN')}</p>
            <p className="mt-1 text-[11px] font-semibold text-[#0E4225]/65">
              {VIOLATION_LABELS[form.violationType as never]} × {SEVERITY_MULTIPLIER[form.severity as never]} severity
              multiplier
            </p>
            <p className="mt-2 font-mono text-[10px] font-bold text-[#0E4225]/55">
              base ₹{BASE_FINE[form.violationType as never]} × {SEVERITY_MULTIPLIER[form.severity as never]} = ₹
              {BASE_FINE[form.violationType as never] * SEVERITY_MULTIPLIER[form.severity as never]}, rounded to the
              nearest ₹10
            </p>
          </div>
          <Notice tone="info" title="Prototype rule table">
            These amounts are project configuration for academic demonstration. They are not a legal penalty schedule.
          </Notice>
        </Panel>

        {/* Post-save pipeline receipt */}
        {receipt ? (
          <Panel title="Pipeline result" subtitle={`Record ${receipt.id} accepted`}>
            <ul className="space-y-2 text-xs font-semibold text-[#0E4225]">
              <li className="flex items-center gap-2 rounded-xl bg-emerald-50 p-2.5 text-emerald-900">
                <CheckCircle2 className="h-4 w-4 shrink-0" /> Violation saved and driver history updated.
              </li>
              <li className="flex items-center justify-between rounded-xl border border-[#0E4225]/12 p-2.5">
                <span>Recalculated risk score</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono font-black">{receipt.score}/100</span>
                  <RiskBadge level={receipt.level as never} />
                </span>
              </li>
              <li className="flex items-center justify-between rounded-xl border border-[#0E4225]/12 p-2.5">
                <span>Fine recorded</span>
                <span className="font-mono font-black">₹{receipt.fine.toLocaleString('en-IN')}</span>
              </li>
              <li className="rounded-xl border border-[#0E4225]/12 p-2.5">
                <span className="block text-[10px] font-black uppercase tracking-wider text-[#0E4225]/55">
                  Patterns after this record
                </span>
                {receipt.patterns.length ? (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-[#0E4225]/75">
                    {receipt.patterns.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[11px] text-[#0E4225]/60">No repeated pattern detected yet.</p>
                )}
              </li>
            </ul>
          </Panel>
        ) : (
          <Panel title="What happens on save" subtitle="The PRD pipeline, step by step">
            <ol className="space-y-2 text-[11px] font-semibold text-[#0E4225]/75">
              {[
                'Record is written to the violations table with the calculated fine.',
                'Driver and vehicle history are updated from the new record.',
                'Frequency, recency, repeat rate and severity are recomputed for that driver.',
                'Pattern rules are evaluated against the updated history.',
                'Location and time aggregations are refreshed for the whole dataset.',
                'Alerts are regenerated and the dashboard totals are updated.',
              ].map((step, i) => (
                <li key={step} className="flex gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#0E4225] text-[9px] font-black text-[#FBF5DD]">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </Panel>
        )}

        {selectedDriver && (
          <Panel title="Selected driver context" subtitle={`${selectedDriver.name} — ${selectedDriver.address}`}>
            <DataTable headers={['Driver ID', 'Licence', 'Existing records', 'Current score']} minWidth={420}>
              <tr className="text-xs font-semibold text-[#0E4225]">
                <td className="px-3 py-2.5 font-mono">{selectedDriver.driverId}</td>
                <td className="px-3 py-2.5 font-mono text-[11px]">{selectedDriver.licenseNumber}</td>
                <td className="px-3 py-2.5 font-mono">
                  {violations.filter((v) => v.driverId === selectedDriver.driverId).length}
                </td>
                <td className="px-3 py-2.5">
                  <RiskBadge
                    level={calculateRisk(selectedDriver.driverId, violations, now).riskLevel}
                    score={calculateRisk(selectedDriver.driverId, violations, now).riskScore}
                  />
                </td>
              </tr>
            </DataTable>
            <p className="mt-3 flex items-start gap-1.5 text-[10px] font-medium leading-snug text-[#0E4225]/55">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              Saving a record changes the score because the analytics engine reads the updated history — not because a
              penalty has been applied.
            </p>
          </Panel>
        )}

        <p className="flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-[#0E4225]/40">
          <ClipboardCheck className="h-3 w-3" /> Form validation mirrors the ValidationUtil utility
        </p>
      </div>
    </div>
  );
}
