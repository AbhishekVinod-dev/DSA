'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, LayoutDashboard, Menu, X } from 'lucide-react';
import { BrandLockup } from '@/components/Brand';

const LINKS = [
  { id: 'pipeline', label: 'Analytics Pipeline' },
  { id: 'roles', label: 'Who It Serves' },
  { id: 'dataset', label: 'Dataset' },
  { id: 'screens', label: 'Screens' },
  { id: 'about', label: 'About' },
];

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const elem = document.getElementById(id);
    if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileMenuOpen(false);
  };

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-[#0E4225]/10 bg-[#FBF5DD]/85 px-4 py-3.5 backdrop-blur-xl lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <Link href="/" className="group shrink-0 py-0.5">
          <BrandLockup />
        </Link>

        <div className="hidden flex-1 items-center justify-center gap-8 text-sm font-medium text-[#0E4225]/80 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              onClick={(e) => handleSmoothScroll(e, l.id)}
              className="cursor-pointer transition-colors hover:text-[#28734A]"
            >
              {l.label}
            </a>
          ))}
        </div>

        <button
          onClick={() => setMobileMenuOpen((o) => !o)}
          className="ml-auto rounded-lg border border-[#0E4225]/15 bg-[#EBE0BA]/60 p-2 text-[#0E4225] lg:hidden"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <div className="hidden shrink-0 items-center gap-3 lg:flex">
          <a
            href="#screens"
            onClick={(e) => handleSmoothScroll(e, 'screens')}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[#0E4225]/15 bg-[#EBE0BA]/70 px-4 py-2 text-xs font-semibold text-[#0E4225] shadow-2xs transition-all hover:bg-[#EBE0BA]"
          >
            <LayoutDashboard className="h-3.5 w-3.5 text-[#28734A]" />
            <span>Screen Tour</span>
          </a>
          <Link
            href="/auth"
            className="group flex items-center gap-1.5 rounded-full bg-[#28734A] px-5 py-2 text-xs font-semibold text-white shadow-md transition-all hover:bg-[#1E5A38]"
          >
            <span>Launch Console</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="mt-4 flex flex-col gap-2 border-t border-[#0E4225]/10 pb-3 pt-4 lg:hidden">
          {LINKS.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              onClick={(e) => handleSmoothScroll(e, l.id)}
              className="rounded-lg px-2 py-1.5 text-sm font-medium text-[#0E4225] hover:bg-[#EBE0BA]/40"
            >
              {l.label}
            </a>
          ))}
          <div className="mt-1 flex flex-col gap-2 border-t border-[#0E4225]/10 pt-3 sm:flex-row">
            <a
              href="#screens"
              onClick={(e) => handleSmoothScroll(e, 'screens')}
              className="w-full rounded-xl bg-[#EBE0BA] py-2.5 text-center text-xs font-semibold text-[#0E4225] sm:w-auto sm:px-5"
            >
              Screen Tour
            </a>
            <Link
              href="/auth"
              className="w-full rounded-xl bg-[#28734A] py-2.5 text-center text-xs font-semibold text-white shadow-sm sm:w-auto sm:px-5"
            >
              Launch Console
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
