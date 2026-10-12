'use client';

import React, { useMemo, useState } from 'react';
import { Car, Plus, Search, X } from 'lucide-react';
import { useConsole } from '@/lib/trafficStore';
import { calculateRisk, violationLabel } from '@/lib/trafficAnalytics';
import { PaymentBadge, SeverityBadge, DataTable, EmptyState, Field, GhostButton, Notice, Panel, PrimaryButton, inputClass } from './ui';

const VEHICLE_TYPES: { id: string; label: string }[] = [
  { id: 'CAR', label: 'Car' },
  { id: 'TWO_WHEELER', label: 'Two-wheeler' },
  { id: 'SUV', label: 'SUV' },
  { id: 'AUTO_RICKSHAW', label: 'Auto rickshaw' },
  { id: 'TRUCK', label: 'Truck' },
  { id: 'BUS', label: 'Bus' },
];

export default function VehiclesView() {
  const { vehicles, drivers, driverById, violationsForVehicle, violations, now, addVehicle } = useConsole();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [flash, setFlash] = useState('');
  const [form, setForm] = useState({
    vehicleNumber: '',
    vehicleType: 'CAR',
    model: '',
    driverId: drivers[0]?.driverId ?? '',
    registrationStatus: 'ACTIVE',
  });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vehicles
      .filter((v) => {
        const owner = driverById.get(v.driverId);
        const matchesQuery =
          !q ||
          v.vehicleNumber.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q) ||
          v.vehicleId.toLowerCase().includes(q) ||
          (owner ? owner.name.toLowerCase().includes(q) || owner.licenseNumber.toLowerCase().includes(q) : false);
        const matchesType = typeFilter === 'ALL' || v.vehicleType === typeFilter;
        return matchesQuery && matchesType;
      })
      .map((v) => {
        const history = violationsForVehicle(v.vehicleId);
        return {
          vehicle: v,
          owner: driverById.get(v.driverId),
          history,
          totalFine: history.reduce((s, x) => s + x.fineAmount, 0),
          pending: history.filter((x) => x.paymentStatus === 'PENDING').length,
        };
      })
      .sort((a, b) => b.history.length - a.history.length);
  }, [vehicles, driverById, violationsForVehicle, query, typeFilter]);

  const selected = selectedId ? rows.find((r) => r.vehicle.vehicleId === selectedId) ?? null : null;
  const ownerRisk = selected?.owner ? calculateRisk(selected.owner.driverId, violations, now) : null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const created = addVehicle({
      vehicleNumber: form.vehicleNumber,
      vehicleType: form.vehicleType as never,
      model: form.model,
      driverId: form.driverId,
      registrationStatus: form.registrationStatus as never,
    });
    setFlash(`Vehicle ${created.vehicleNumber} registered against ${driverById.get(created.driverId)?.name ?? created.driverId}.`);
    setForm({ ...form, vehicleNumber: '', model: '' });
    setShowAdd(false);
  };

  return (
    <div className="space-y-5">
      {flash && <Notice tone="ethics">{flash}</Notice>}

      <Panel
        title="Vehicle register"
        subtitle="Search by registration number, model, owner name or licence — FR-03"
        action={
          <PrimaryButton onClick={() => setShowAdd((s) => !s)}>
            {showAdd ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showAdd ? 'Cancel' : 'Register vehicle'}
          </PrimaryButton>
        }
      >
        {showAdd && (
          <form onSubmit={handleAdd} className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-[#0E4225]/15 bg-[#F6EDCC]/60 p-4 sm:grid-cols-2">
            <Field label="Registration number" required>
              <input
                required
                value={form.vehicleNumber}
                onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })}
                placeholder="TN 01 AB 1234"
                className={inputClass}
              />
            </Field>
            <Field label="Vehicle type" required>
              <select
                value={form.vehicleType}
                onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
                className={inputClass}
              >
                {VEHICLE_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Model">
              <input
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="e.g. Maruti Swift"
                className={inputClass}
              />
            </Field>
            <Field label="Registered owner" required>
              <select
                required
                value={form.driverId}
                onChange={(e) => setForm({ ...form, driverId: e.target.value })}
                className={inputClass}
              >
                {drivers.map((d) => (
                  <option key={d.driverId} value={d.driverId}>
                    {d.name} — {d.driverId}
                  </option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <PrimaryButton type="submit">
                <Car className="h-3.5 w-3.5" /> Save vehicle record
              </PrimaryButton>
            </div>
          </form>
        )}

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0E4225]/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search registration number, model, owner name or licence"
              className={`${inputClass} pl-10`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {['ALL', ...VEHICLE_TYPES.map((t) => t.id)].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition-colors ${
                  typeFilter === t
                    ? 'border-[#0E4225] bg-[#0E4225] text-[#FBF5DD]'
                    : 'border-[#0E4225]/20 bg-white/70 text-[#0E4225]/70 hover:border-[#28734A]'
                }`}
              >
                {t === 'ALL' ? 'All' : t.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {rows.length ? (
          <DataTable headers={['Registration', 'Type', 'Model', 'Owner', 'Records', 'Pending', 'Fine total (INR)', 'Status', '']}>
            {rows.slice(0, 200).map((r) => (
              <tr key={r.vehicle.vehicleId} className="text-xs font-semibold text-[#0E4225] hover:bg-[#F6EDCC]/50">
                <td className="whitespace-nowrap px-3 py-2.5 font-mono font-black">{r.vehicle.vehicleNumber}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[10px] font-black uppercase tracking-wide text-[#0E4225]/60">
                  {r.vehicle.vehicleType.replace('_', ' ')}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">{r.vehicle.model}</td>
                <td className="px-3 py-2.5">
                  {r.owner ? (
                    <>
                      <span className="font-black">{r.owner.name}</span>
                      <span className="ml-1.5 font-mono text-[10px] text-[#0E4225]/45">{r.owner.licenseNumber}</span>
                    </>
                  ) : (
                    <span className="text-[#0E4225]/40">Unlinked</span>
                  )}
                </td>
                <td className="px-3 py-2.5 font-mono">{r.history.length}</td>
                <td className="px-3 py-2.5 font-mono">{r.pending}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono">{r.totalFine.toLocaleString('en-IN')}</td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span
                    className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${
                      r.vehicle.registrationStatus === 'ACTIVE'
                        ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                        : r.vehicle.registrationStatus === 'EXPIRED'
                          ? 'border-amber-300 bg-amber-100 text-amber-900'
                          : 'border-slate-400 bg-slate-200 text-slate-800'
                    }`}
                  >
                    {r.vehicle.registrationStatus}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <GhostButton className="px-2.5 py-1.5 text-[10px]" onClick={() => setSelectedId(r.vehicle.vehicleId)}>
                    History
                  </GhostButton>
                </td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <EmptyState title="No vehicles match this filter" hint="Try a different registration number, owner name or vehicle type." />
        )}
      </Panel>

      {selected && (
        <Panel
          title={`Violation history — ${selected.vehicle.vehicleNumber}`}
          subtitle={`${selected.vehicle.model} · ${selected.vehicle.vehicleType.replace('_', ' ').toLowerCase()} · ${
            selected.owner?.name ?? 'unlinked'
          }`}
          action={
            <GhostButton onClick={() => setSelectedId(null)}>
              <X className="h-3.5 w-3.5" /> Close
            </GhostButton>
          }
          dense
        >
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[#0E4225]/12 bg-white/80 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#0E4225]/55">Records</p>
              <p className="text-xl font-black text-[#0E4225]">{selected.history.length}</p>
            </div>
            <div className="rounded-xl border border-[#0E4225]/12 bg-white/80 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#0E4225]/55">Fine total</p>
              <p className="text-xl font-black text-[#0E4225]">₹{selected.totalFine.toLocaleString('en-IN')}</p>
            </div>
            <div className="rounded-xl border border-[#0E4225]/12 bg-white/80 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#0E4225]/55">Pending</p>
              <p className="text-xl font-black text-amber-700">{selected.pending}</p>
            </div>
            <div className="rounded-xl border border-[#0E4225]/12 bg-white/80 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#0E4225]/55">Owner risk score</p>
              <p className="text-xl font-black text-[#0E4225]">
                {ownerRisk ? `${ownerRisk.riskScore} · ${ownerRisk.riskLevel}` : '—'}
              </p>
            </div>
          </div>

          {selected.history.length ? (
            <DataTable headers={['Date', 'Time', 'Offence', 'Severity', 'Location', 'Fine (INR)', 'Payment', 'Officer']} minWidth={780}>
              {selected.history.map((v) => (
                <tr key={v.violationId} className="text-xs font-semibold text-[#0E4225]">
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
          ) : (
            <EmptyState
              title="No violations recorded for this vehicle"
              hint="A clean record is the expected starting state for a newly registered vehicle."
            />
          )}
        </Panel>
      )}
    </div>
  );
}
