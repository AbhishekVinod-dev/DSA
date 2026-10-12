import React from 'react';

/**
 * Brand mark for SmartTraffic Analytics.
 * Inline SVG so the wordmark stays crisp, themeable and dependency-free.
 */
export function BrandMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="SmartTraffic Analytics mark">
      <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="#0E4225" />
      <path d="M11 34h26" stroke="#EBE0BA" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 5" />
      <path d="M24 9.5 12.5 15v10.5c0 6 4.6 10.4 11.5 13 6.9-2.6 11.5-7 11.5-13V15L24 9.5Z" fill="#28734A" stroke="#F6EDCC" strokeWidth="1.8" strokeLinejoin="round" />
      <rect x="18.5" y="20" width="11" height="11" rx="2.5" fill="#F6EDCC" />
      <path d="M18.5 24.2h11M22.2 20v11" stroke="#28734A" strokeWidth="1.6" />
    </svg>
  );
}

export function BrandLockup({
  className = '',
  tone = 'dark',
  subtitle,
  compact = false,
}: {
  className?: string;
  tone?: 'dark' | 'light';
  subtitle?: string;
  /** Tighter sizing for the console header and other dense surfaces. */
  compact?: boolean;
}) {
  return (
    <span className={`inline-flex items-center ${compact ? 'gap-2' : 'gap-2.5'} ${className}`}>
      <BrandMark className={compact ? 'h-8 w-8' : 'h-9 w-9 sm:h-10 sm:w-10'} />
      <span className="flex flex-col leading-none">
        <span
          className={`font-black tracking-tight ${
            compact ? 'text-sm' : 'text-base sm:text-lg'
          } ${tone === 'dark' ? 'text-[#0E4225]' : 'text-[#FBF5DD]'}`}
        >
          SmartTraffic
        </span>
        <span
          className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.22em] ${
            tone === 'dark' ? 'text-[#28734A]' : 'text-emerald-300/80'
          }`}
        >
          {subtitle ?? 'Violation Analytics'}
        </span>
      </span>
    </span>
  );
}
