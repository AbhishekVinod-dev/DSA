'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Search, UserPlus, X } from 'lucide-react';
import { useConsole } from '@/lib/trafficStore';
import { calculateRisk, violationLabel } from '@/lib/trafficAnalytics';
import { RISK_LEVEL_BANDS } from '@/lib/trafficAnalytics';
import { DataTable, EmptyState, Field, GhostButton, Notice, Panel, PrimaryButton, RiskBadge, inputClass } from './ui';

type SortKey = 'risk' | 'name' | 'violations' | 'recent';

export default function DriversView({
  onOpenRisk,
}: {
  onOpenRisk: (driverId: string) => void;
}) {
  const { drivers, violations, now, addDriver } = useConsole();
  const [query, setQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('ALL');
  const [sort, setSort] = useState<SortKey>('risk');
  const [showAdd, setShowAdd] = useState(false);
  const [flash, setFlash] = useState('');
  const [form, setForm] = useState({ name: '', licenseNumber: '', phone: '', address: '' });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = drivers
      .map((d) => {
        const risk = calculateRisk(d.driverId, violations, now);
        return { driver: d, risk };
      })
      .filter(({ driver, risk }) => {
        const matchesQuery =
          !q ||
          driver.name.toLowerCase().includes(q) ||
          driver.driverId.toLowerCase().includes(q) ||
          driver.licenseNumber.toLowerCase().includes(q) ||
          driver.phone.includes(q);
        const matchesLevel = levelFilter === 'ALL' || risk.riskLevel === levelFilter;
        return matchesQuery && matchesLevel;
      });

    return list.sort((a, b) => {
      if (sort === 'name') return a.driver.name.localeCompare(b.driver.name);
      if (sort === 'violations') return b.risk.violationCount - a.risk.violationCount;
      if (sort === 'recent') return (a.risk.lastViolationDate ?? '') < (b.risk.lastViolationDate ?? '') ? 1 : -1;
      return b.risk.riskScore - a.risk.riskScore;
    });
  }, [drivers, violations, now, query, levelFilter, sort]);

  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    drivers.forEach((d) => {
      counts.ALL += 1;
      counts[calculateRisk(d.driverId, violations, now).riskLevel] += 1;
    });
    return counts;
  }, [drivers, violations, now]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const created = addDriver(form);
    setFlash(`Driver ${created.driverId} created. Licence ${created.licenseNumber} is searchable immediately.`);
    setForm({ name: '', licenseNumber: '', phone: '', address: '' });
    setShowAdd(false);
  };

  return (
    <div className="space-y-5">
      {flash && <Notice tone="ethics">{flash}</Notice>}

      <Panel
        title="Driver register"
        subtitle="Search by name, driver ID, licence number or phone — FR-02"
        action={
          <PrimaryButton onClick={() => setShowAdd((s) => !s)}>
            {showAdd ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showAdd ? 'Cancel' : 'Add driver'}
          </PrimaryButton>
        }
      >
        {showAdd && (
          <form onSubmit={handleAdd} className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-[#0E4225]/15 bg-[#F6EDCC]/60 p-4 sm:grid-cols-2">
            <Field label="Full name" required>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Karthik Raman"
                className={inputClass}
              />
            </Field>
            <Field label="Licence number" required>
              <input
                required
                value={form.licenseNumber}
                onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                placeholder="TN01-2024-00123"
                className={inputClass}
              />
            </Field>
            <Field label="Phone" required>
              <input
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="98XXXXXXXX"
                className={inputClass}
              />
            </Field>
            <Field label="Address">
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Street, area, Chennai"
                className={inputClass}
              />
            </Field>
            <div className="sm:col-span-2">
              <PrimaryButton type="submit">
                <UserPlus className="h-3.5 w-3.5" /> Save driver record
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
              placeholder="Search driver ID, name, licence number or phone"
              className={`${inputClass} pl-10`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(['ALL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLevelFilter(l)}
                className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition-colors ${
                  levelFilter === l
                    ? 'border-[#0E4225] bg-[#0E4225] text-[#FBF5DD]'
                    : 'border-[#0E4225]/20 bg-white/70 text-[#0E4225]/70 hover:border-[#28734A]'
                }`}
              >
                {l} <span className="font-mono opacity-70">{levelCounts[l]}</span>
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-xl border border-[#0E4225]/20 bg-white/80 px-3 py-2 text-[11px] font-bold text-[#0E4225]"
          >
            <option value="risk">Sort: risk score</option>
            <option value="violations">Sort: violation count</option>
            <option value="recent">Sort: most recent</option>
            <option value="name">Sort: name</option>
          </select>
        </div>

        {rows.length ? (
          <DataTable headers={['Driver', 'Licence', 'Phone', 'City', 'Violations', 'Last recorded', 'Score', 'Level', '']}>
            {rows.slice(0, 200).map(({ driver, risk }) => (
              <tr key={driver.driverId} className="text-xs font-semibold text-[#0E4225] hover:bg-[#F6EDCC]/50">
                <td className="px-3 py-2.5">
                  <span className="font-black">{driver.name}</span>
                  <span className="ml-1.5 font-mono text-[10px] text-[#0E4225]/45">{driver.driverId}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-[#0E4225]/65">
                  {driver.licenseNumber}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-[#0E4225]/65">{driver.phone}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{driver.city}</td>
                <td className="px-3 py-2.5 font-mono">{risk.violationCount}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-[#0E4225]/60">
                  {risk.lastViolationDate ?? '—'}
                </td>
                <td className="px-3 py-2.5 font-mono font-black">{risk.riskScore}</td>
                <td className="px-3 py-2.5">
                  <RiskBadge level={risk.riskLevel} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <GhostButton
                    className="px-2.5 py-1.5 text-[10px]"
                    onClick={() => onOpenRisk(driver.driverId)}
                  >
                    Analyse
                  </GhostButton>
                </td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <EmptyState title="No drivers match this filter" hint="Clear the search box or choose a different risk band." />
        )}

        {rows.length > 200 && (
          <p className="mt-3 text-center text-[11px] font-semibold text-[#0E4225]/50">
            Showing the top 200 of {rows.length} matching drivers. Refine the search to narrow the list.
          </p>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Risk band definitions" subtitle="The score is always shown with its band">
          <ul className="space-y-2">
            {RISK_LEVEL_BANDS.map((b) => (
              <li key={b.level} className="flex items-center gap-3 rounded-xl border border-[#0E4225]/10 bg-white/70 px-3 py-2">
                <RiskBadge level={b.level} />
                <span className="font-mono text-[11px] font-bold text-[#0E4225]/70">
                  {b.min}–{b.max}
                </span>
                <span className="ml-auto text-[11px] font-medium text-[#0E4225]/55">{levelCounts[b.level]} drivers</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Dominant offence categories in the register" subtitle="Across every driver currently listed">
          <ul className="space-y-1.5 text-[11px] font-semibold text-[#0E4225]/70">
            {[...new Set(violations.map((v) => v.violationType))].slice(0, 8).map((type) => {
              const count = violations.filter((v) => v.violationType === type).length;
              const driversAffected = new Set(violations.filter((v) => v.violationType === type).map((v) => v.driverId)).size;
              return (
                <li key={type} className="flex items-center justify-between gap-3 border-b border-[#0E4225]/8 pb-1.5 last:border-0">
                  <span>{violationLabel(type)}</span>
                  <span className="font-mono text-[10px] text-[#0E4225]/55">
                    {count} records · {driversAffected} drivers
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
