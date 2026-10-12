'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Lightweight SVG charts. Hand-rolled so the console has no charting
 * runtime dependency and stays deterministic in size (no measurement
 * pass, no hydration mismatch).
 */

export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

export interface BarDatum {
  label: string;
  value: number;
  hint?: string;
}

/** Vertical bar chart with an optional highlighted bar. */
export function BarChart({
  data,
  highlightIndex,
  height = 180,
  color = '#28734A',
  highlightColor = '#B45309',
  formatValue = (v: number) => String(v),
}: {
  data: BarDatum[];
  highlightIndex?: number;
  height?: number;
  color?: string;
  highlightColor?: string;
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="w-full">
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d, i) => {
          const isHighlight = highlightIndex === i;
          const pct = (d.value / max) * 100;
          return (
            <div key={`${d.label}-${i}`} className="group relative flex h-full flex-1 flex-col justify-end">
              <div
                className="w-full rounded-t-md transition-all duration-700 group-hover:opacity-80"
                style={{
                  height: `${Math.max(2, pct)}%`,
                  backgroundColor: isHighlight ? highlightColor : color,
                  opacity: isHighlight ? 1 : 0.28 + 0.62 * (d.value / max),
                }}
              />
              <span className="pointer-events-none absolute -top-6 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[#0E4225] px-2 py-1 text-[10px] font-bold text-[#FBF5DD] shadow-lg group-hover:block">
                {d.label} · {formatValue(d.value)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5">
        {data.map((d, i) => (
          <span
            key={`t-${d.label}-${i}`}
            className={cn(
              'flex-1 truncate text-center text-[9px] font-bold uppercase tracking-tight',
              highlightIndex === i ? 'text-[#0E4225]' : 'text-[#0E4225]/45',
            )}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Ranked horizontal bars — used for hotspots and offence mix. */
export function RankedBars({
  data,
  max: providedMax,
  barClassName,
  labelWidth = 'w-32 sm:w-44',
}: {
  data: BarDatum[];
  max?: number;
  barClassName?: (index: number) => string;
  labelWidth?: string;
}) {
  const max = providedMax ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2.5">
      {data.map((d, i) => (
        <li key={`${d.label}-${i}`} className="group">
          <div className="flex items-center justify-between gap-3 text-[11px] font-bold">
            <span className={cn('truncate text-[#0E4225]', labelWidth)} title={d.label}>
              {d.label}
            </span>
            <span className="font-mono text-[#0E4225]/70">{d.value}</span>
          </div>
          <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-[#0E4225]/8">
            <div
              className={cn('h-full rounded-full transition-[width] duration-700', barClassName?.(i) ?? 'bg-[#28734A]')}
              style={{ width: `${Math.max(1.5, (d.value / max) * 100)}%` }}
            />
          </div>
          {d.hint && <p className="mt-0.5 text-[10px] font-medium text-[#0E4225]/50">{d.hint}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Segmented risk-distribution bar with a legend. */
export function RiskDistributionBar({
  distribution,
}: {
  distribution: { level: string; count: number }[];
}) {
  const total = Math.max(1, distribution.reduce((s, d) => s + d.count, 0));
  const colors: Record<string, string> = {
    LOW: 'bg-emerald-500',
    MEDIUM: 'bg-amber-500',
    HIGH: 'bg-orange-500',
    CRITICAL: 'bg-red-500',
  };
  return (
    <div>
      <div className="flex h-9 w-full overflow-hidden rounded-xl border border-[#0E4225]/12">
        {distribution.map((d) => (
          <div
            key={d.level}
            className={cn('flex items-center justify-center transition-[width] duration-700', colors[d.level])}
            style={{ width: `${(d.count / total) * 100}%` }}
            title={`${d.level}: ${d.count}`}
          >
            {d.count / total > 0.1 && (
              <span className="text-[10px] font-black text-white drop-shadow">{d.count}</span>
            )}
          </div>
        ))}
      </div>
      <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        {distribution.map((d) => (
          <li key={d.level} className="flex items-center gap-1.5 text-[10px] font-bold text-[#0E4225]/70">
            <span className={cn('h-2.5 w-2.5 rounded-sm', colors[d.level])} />
            <span className="uppercase tracking-wide">{d.level}</span>
            <span className="ml-auto font-mono">{d.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Compact gauge for the driver risk score. */
export function ScoreGauge({ score, size = 168 }: { score: number; size?: number }) {
  const animated = useCountUp(score, 1100);
  const radius = size / 2 - 14;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, animated)) / 100;
  const stroke = score >= 81 ? '#DC2626' : score >= 61 ? '#EA580C' : score >= 31 ? '#D97706' : '#059669';

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#0E4225" strokeOpacity={0.1} strokeWidth={12} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-200"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-4xl font-black tracking-tight text-[#0E4225]">{animated}</p>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0E4225]/45">out of 100</p>
      </div>
    </div>
  );
}

/** Factor bar with its weight and raw value, mirroring Screen 6. */
export function FactorBar({
  label,
  value,
  weight,
  weighted,
  explanation,
}: {
  label: string;
  value: number;
  weight: number;
  weighted: number;
  explanation: string;
}) {
  const stroke = value >= 61 ? '#EA580C' : value >= 31 ? '#D97706' : '#059669';
  return (
    <li className="group">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-black text-[#0E4225]">{label}</span>
        <span className="font-mono text-[11px] font-bold text-[#0E4225]/60">
          {value} <span className="opacity-60">× {Math.round(weight * 100)}% = {weighted}</span>
        </span>
      </div>
      <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[#0E4225]/8">
        <div
          className="h-full rounded-full transition-[width] duration-1000"
          style={{ width: `${Math.max(1.5, value)}%`, backgroundColor: stroke }}
        />
      </div>
      <p className="mt-1 text-[10px] font-medium leading-snug text-[#0E4225]/55">{explanation}</p>
    </li>
  );
}
