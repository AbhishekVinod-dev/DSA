'use client';

import React from 'react';
import { AlertSeverity, RiskLevel } from '@/types';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ *
 * Shared console primitives — the JavaFX screens mapped to components.
 * ------------------------------------------------------------------ */

export function Panel({
  title,
  subtitle,
  action,
  className,
  children,
  dense,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  dense?: boolean;
}) {
  return (
    <section
      className={cn(
        'rounded-3xl border border-[#0E4225]/15 bg-white/85 backdrop-blur-sm shadow-[0_18px_40px_-28px_rgba(14,66,37,0.45)]',
        className,
      )}
    >
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#0E4225]/10 px-5 py-4">
          <div>
            {title && <h3 className="text-sm font-black tracking-tight text-[#0E4225] sm:text-base">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-[11px] font-medium text-[#0E4225]/60 sm:text-xs">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={dense ? 'p-3 sm:p-4' : 'p-5'}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: 'default' | 'warn' | 'alert';
}) {
  const tones: Record<string, string> = {
    default: 'bg-[#0E4225]/8 text-[#0E4225] border-[#0E4225]/15',
    warn: 'bg-amber-100 text-amber-900 border-amber-300',
    alert: 'bg-red-100 text-red-900 border-red-300',
  };
  return (
    <div className="rounded-2xl border border-[#0E4225]/12 bg-white/90 p-4 shadow-[0_12px_30px_-24px_rgba(14,66,37,0.5)]">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-wider text-[#0E4225]/60">{label}</span>
        {icon && (
          <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-xl border', tones[tone])}>{icon}</span>
        )}
      </div>
      <p className="mt-2 text-2xl font-black tracking-tight text-[#0E4225] sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-[11px] font-medium leading-snug text-[#0E4225]/60">{hint}</p>}
    </div>
  );
}

const RISK_STYLES: Record<RiskLevel, string> = {
  LOW: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  MEDIUM: 'bg-amber-100 text-amber-900 border-amber-300',
  HIGH: 'bg-orange-100 text-orange-900 border-orange-300',
  CRITICAL: 'bg-red-100 text-red-900 border-red-300',
};

const RISK_BAR: Record<RiskLevel, string> = {
  LOW: 'bg-emerald-500',
  MEDIUM: 'bg-amber-500',
  HIGH: 'bg-orange-500',
  CRITICAL: 'bg-red-500',
};

export function RiskBadge({ level, score }: { level: RiskLevel; score?: number }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider',
        RISK_STYLES[level],
      )}
    >
      {score !== undefined && <span className="font-mono">{score}</span>}
      {level}
    </span>
  );
}

export function RiskBar({ score, level }: { score: number; level: RiskLevel }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#0E4225]/10">
      <div
        className={cn('h-full rounded-full transition-[width] duration-700', RISK_BAR[level])}
        style={{ width: `${Math.max(2, Math.min(100, score))}%` }}
      />
    </div>
  );
}

const SEVERITY_STYLES: Record<string, string> = {
  MINOR: 'bg-slate-100 text-slate-700 border-slate-300',
  MEDIUM: 'bg-amber-100 text-amber-900 border-amber-300',
  MAJOR: 'bg-orange-100 text-orange-900 border-orange-300',
  SEVERE: 'bg-red-100 text-red-900 border-red-300',
};

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.MINOR,
      )}
    >
      {severity}
    </span>
  );
}

const ALERT_STYLES: Record<AlertSeverity, string> = {
  HIGH: 'bg-red-100 text-red-900 border-red-300',
  MEDIUM: 'bg-amber-100 text-amber-900 border-amber-300',
  LOW: 'bg-emerald-100 text-emerald-800 border-emerald-300',
};

export function AlertSeverityBadge({ severity }: { severity: AlertSeverity }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide',
        ALERT_STYLES[severity],
      )}
    >
      {severity}
    </span>
  );
}

const PAYMENT_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-900 border-amber-300',
  PAID: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  CHALLENGED: 'bg-slate-200 text-slate-800 border-slate-400',
};

export function PaymentBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        PAYMENT_STYLES[status] ?? PAYMENT_STYLES.PENDING,
      )}
    >
      {status}
    </span>
  );
}

export function Chip({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}) {
  const Element = onClick ? 'button' : 'span';
  return (
    <Element
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title}
      className={cn(
        'rounded-full border px-3 py-1 text-[11px] font-bold transition-colors',
        active
          ? 'border-[#0E4225] bg-[#0E4225] text-[#FBF5DD]'
          : 'border-[#0E4225]/20 bg-white/70 text-[#0E4225]/75 hover:border-[#28734A] hover:text-[#28734A]',
        onClick && 'cursor-pointer',
      )}
    >
      {children}
    </Element>
  );
}

export function Field({
  label,
  hint,
  children,
  required,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[#0E4225]/70">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[10px] font-medium text-[#0E4225]/50">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-[#0E4225]/20 bg-white px-3.5 py-2.5 text-sm font-semibold text-[#0E4225] shadow-inner outline-none transition-colors placeholder:font-medium placeholder:text-[#0E4225]/35 focus:border-[#28734A] focus:ring-2 focus:ring-[#28734A]/15';

export const selectClass = `${inputClass} appearance-none bg-[length:0] pr-8`;

export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl bg-[#0E4225] px-4 py-2.5 text-xs font-black text-[#FBF5DD] shadow-md transition-all hover:-translate-y-0.5 hover:bg-[#1a663b] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl border border-[#0E4225]/20 bg-white/80 px-4 py-2.5 text-xs font-black text-[#0E4225] transition-all hover:-translate-y-0.5 hover:border-[#28734A] hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function DataTable({
  headers,
  children,
  minWidth = 860,
}: {
  headers: string[];
  children: React.ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full border-collapse text-left" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-[#0E4225]/12">
            {headers.map((h) => (
              <th
                key={h}
                className="whitespace-nowrap px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-[#0E4225]/55"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#0E4225]/8">{children}</tbody>
      </table>
    </div>
  );
}

export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warn' | 'ethics';
  title?: string;
  children: React.ReactNode;
}) {
  const tones = {
    info: 'bg-[#F6EDCC] border-[#0E4225]/15 text-[#0E4225]',
    warn: 'bg-amber-50 border-amber-300 text-amber-950',
    ethics: 'bg-emerald-50 border-emerald-300 text-emerald-950',
  } as const;
  return (
    <div className={cn('rounded-2xl border p-4 text-xs font-medium leading-relaxed', tones[tone])}>
      {title && <p className="mb-1 text-[10px] font-black uppercase tracking-wider opacity-70">{title}</p>}
      {children}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#0E4225]/25 bg-white/60 p-10 text-center">
      <p className="text-sm font-black text-[#0E4225]/70">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-md text-xs font-medium text-[#0E4225]/50">{hint}</p>}
    </div>
  );
}
