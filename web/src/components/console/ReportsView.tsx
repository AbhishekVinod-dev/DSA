'use client';

import React, { useMemo, useState } from 'react';
import { FileText, FileSpreadsheet, Printer, Search, ShieldAlert } from 'lucide-react';
import { useConsole } from '@/lib/trafficStore';
import { REPORTS, ReportId, downloadText, generateReport } from '@/lib/trafficReports';
import { Chip, Field, GhostButton, Notice, Panel, PrimaryButton, inputClass, selectClass } from './ui';

/**
 * Screen 9 — Reports.
 *
 * FR-13: the console can generate all six report types and export them.
 * The MVP exports plain text and CSV; PDF export is listed as future scope
 * in the PRD, so nothing here claims a PDF button exists.
 */
export default function ReportsView() {
  const { drivers, violations } = useConsole();
  const [selected, setSelected] = useState<ReportId>('summary');
  const [driverId, setDriverId] = useState<string>('');
  const [driverQuery, setDriverQuery] = useState('');

  const active = REPORTS.find((r) => r.id === selected) ?? REPORTS[0];
  const needsDriver = active.scope === 'driver';

  const effectiveDriverId = driverId || drivers[0]?.driverId || '';

  const report = useMemo(
    () => generateReport(selected, { drivers, violations, driverId: effectiveDriverId }),
    [selected, drivers, violations, effectiveDriverId],
  );

  const driverOptions = useMemo(() => {
    const q = driverQuery.trim().toLowerCase();
    const list = q
      ? drivers.filter(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            d.driverId.toLowerCase().includes(q) ||
            d.licenseNumber.toLowerCase().includes(q),
        )
      : drivers;
    return list.slice(0, 60);
  }, [drivers, driverQuery]);

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

  return (
    <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
      {/* ------------------------------------------------ report picker */}
      <div className="space-y-5">
        <Panel title="Report builder" subtitle="Screen 9 — six report types (FR-13)" dense>
          <ul className="space-y-2">
            {REPORTS.map((r) => {
              const on = r.id === selected;
              return (
                <li key={r.id}>
                  <button
                    onClick={() => setSelected(r.id)}
                    className={`w-full rounded-2xl border p-3 text-left transition-colors ${
                      on
                        ? 'border-[#28734A] bg-[#0E4225] text-[#FBF5DD]'
                        : 'border-[#0E4225]/12 bg-white/80 text-[#0E4225] hover:border-[#28734A]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      <span className="text-xs font-black">{r.title}</span>
                      {r.scope === 'driver' && (
                        <span
                          className={`ml-auto rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase ${
                            on ? 'border-[#FBF5DD]/40 text-[#FBF5DD]/80' : 'border-[#0E4225]/20 text-[#0E4225]/55'
                          }`}
                        >
                          per driver
                        </span>
                      )}
                    </span>
                    <span className={`mt-1 block text-[11px] font-medium leading-snug ${on ? 'text-[#FBF5DD]/75' : 'text-[#0E4225]/65'}`}>
                      {r.description}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        {needsDriver && (
          <Panel title="Select driver" subtitle="Required for the behaviour report" dense>
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#0E4225]/35" />
                <input
                  value={driverQuery}
                  onChange={(e) => setDriverQuery(e.target.value)}
                  placeholder="Name, ID or licence number"
                  className={`${inputClass} pl-8`}
                />
              </div>
              <Field label="Driver">
                <select value={effectiveDriverId} onChange={(e) => setDriverId(e.target.value)} className={selectClass}>
                  {driverOptions.map((d) => (
                    <option key={d.driverId} value={d.driverId}>
                      {d.driverId} — {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              {driverOptions.length === 0 && (
                <p className="text-[11px] font-semibold text-[#0E4225]/55">No driver matches “{driverQuery}”.</p>
              )}
            </div>
          </Panel>
        )}

        <Panel title="Export" subtitle="Plain text and CSV ship with the MVP" dense>
          <div className="space-y-2">
            <PrimaryButton
              className="w-full"
              onClick={() => downloadText(`smarttraffic-${active.id}-${stamp}.txt`, report.text)}
            >
              <FileText className="h-3.5 w-3.5" /> Download .txt
            </PrimaryButton>
            <PrimaryButton
              className="w-full"
              onClick={() =>
                downloadText(`smarttraffic-${active.id}-${stamp}.csv`, report.csv, 'text/csv;charset=utf-8')
              }
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Download .csv
            </PrimaryButton>
            <GhostButton className="w-full" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> Print this view
            </GhostButton>
            <button
              onClick={() => navigator.clipboard?.writeText(report.text)}
              className="w-full rounded-xl px-4 py-2 text-[11px] font-black text-[#28734A] hover:underline"
            >
              Copy report to clipboard
            </button>
          </div>
          <p className="mt-3 text-[10px] font-medium leading-relaxed text-[#0E4225]/55">
            PDF export is future scope in the PRD. A printable text report is the MVP deliverable.
          </p>
        </Panel>
      </div>

      {/* --------------------------------------------------- preview */}
      <div className="space-y-5">
        <Panel
          title={report.title}
          subtitle={`Generated for ${report.generatedFor} · ${active.description}`}
          action={
            <div className="flex flex-wrap gap-1.5">
              {(REPORTS.map((r) => r.id) as ReportId[]).map((id) => (
                <Chip key={id} active={selected === id} onClick={() => setSelected(id)}>
                  {REPORTS.find((r) => r.id === id)?.title.split(' ')[0]}
                </Chip>
              ))}
            </div>
          }
        >
          <pre className="max-h-[620px] overflow-auto whitespace-pre rounded-2xl border border-[#0E4225]/12 bg-[#FBF5DD] p-4 font-mono text-[11px] leading-relaxed text-[#0E4225] sm:text-xs">
            {report.text}
          </pre>
        </Panel>

        <Panel title="CSV preview" subtitle="First 20 rows of the machine-readable export" dense>
          {report.csv ? (
            <pre className="max-h-56 overflow-auto whitespace-pre rounded-2xl border border-[#0E4225]/12 bg-white/70 p-3 font-mono text-[10px] leading-relaxed text-[#0E4225]/80">
              {report.csv.split('\n').slice(0, 20).join('\n')}
            </pre>
          ) : (
            <p className="text-xs font-semibold text-[#0E4225]/55">No tabular data for this report.</p>
          )}
        </Panel>

        <Notice tone="warn" title="How to read a report">
          <span className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Every report carries the project disclaimer in its header. Counts describe violations that were
              <em> recorded</em>; a lower count can also mean lower enforcement presence or different reporting
              practice, not necessarily better driving. Reports are decision support for an authorised reviewer and
              carry no legal determination.
            </span>
          </span>
        </Notice>
      </div>
    </div>
  );
}
