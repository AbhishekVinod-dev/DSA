'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  BellRing,
  Car,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  PlusCircle,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { Session, UserRole } from '@/types';
import { BrandLockup } from '@/components/Brand';
import { ROLE_LABELS } from '@/lib/trafficData';
import { ConsoleProvider, readSession, writeSession } from '@/lib/trafficStore';
import { GhostButton, Notice } from '@/components/console/ui';
import OverviewView from '@/components/console/OverviewView';
import DriversView from '@/components/console/DriversView';
import VehiclesView from '@/components/console/VehiclesView';
import RecordViolationView from '@/components/console/RecordViolationView';
import RiskAnalysisView from '@/components/console/RiskAnalysisView';
import AnalyticsView from '@/components/console/AnalyticsView';
import AlertsView from '@/components/console/AlertsView';
import ReportsView from '@/components/console/ReportsView';

type ViewId =
  | 'overview'
  | 'drivers'
  | 'vehicles'
  | 'record'
  | 'risk'
  | 'analytics'
  | 'alerts'
  | 'reports';

/** PRD § 11 — screens 2 to 9. */
const NAV: { id: ViewId; label: string; screen: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Dashboard', screen: 'Screen 2', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'drivers', label: 'Drivers', screen: 'Screen 3', icon: <Users className="h-4 w-4" /> },
  { id: 'vehicles', label: 'Vehicles', screen: 'Screen 4', icon: <Car className="h-4 w-4" /> },
  { id: 'record', label: 'Record Violation', screen: 'Screen 5', icon: <PlusCircle className="h-4 w-4" /> },
  { id: 'risk', label: 'Risk Analysis', screen: 'Screen 6', icon: <Gauge className="h-4 w-4" /> },
  { id: 'analytics', label: 'Analytics', screen: 'Screen 7', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'alerts', label: 'Alerts', screen: 'Screen 8', icon: <BellRing className="h-4 w-4" /> },
  { id: 'reports', label: 'Reports', screen: 'Screen 9', icon: <FileText className="h-4 w-4" /> },
];

/** FR-01 — the analyst role is read-only across the console. */
const WRITE_VIEWS: ViewId[] = ['drivers', 'vehicles', 'record'];

const VIEW_TITLES: Record<ViewId, string> = {
  overview: 'Authority dashboard',
  drivers: 'Driver registry',
  vehicles: 'Vehicle registry',
  record: 'Record a violation',
  risk: 'Risk analysis',
  analytics: 'Pattern, hotspot, time and trend analytics',
  alerts: 'Smart alerts',
  reports: 'Report generation',
};

function ConsoleShell() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
  const [view, setView] = useState<ViewId>('overview');
  const [riskDriverId, setRiskDriverId] = useState<string | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const stored = readSession();
    if (!stored) {
      router.replace('/auth');
      return;
    }
    setSession(stored);
    setChecked(true);
  }, [router]);

  const role: UserRole = session?.role ?? 'officer';
  const readOnly = role === 'analyst';

  const openRisk = useMemo(
    () => (driverId: string) => {
      setRiskDriverId(driverId);
      setView('risk');
      setMenuOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [],
  );

  const selectView = (id: ViewId) => {
    if (readOnly && WRITE_VIEWS.includes(id)) return;
    setView(id);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const switchRole = (next: UserRole) => {
    if (!session) return;
    const updated: Session = { ...session, role: next };
    writeSession(updated);
    setSession(updated);
    if (next === 'analyst' && WRITE_VIEWS.includes(view)) setView('overview');
  };

  const logout = () => {
    writeSession(null);
    router.replace('/auth');
  };

  if (!checked || !session) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#FBF5DD] px-6 text-center text-[#0E4225]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-[#0E4225]/50">SmartTraffic Analytics</p>
          <p className="mt-2 text-sm font-bold">Verifying session…</p>
        </div>
      </div>
    );
  }

  const current = NAV.find((n) => n.id === view) ?? NAV[0];

  return (
    <div className="min-h-screen bg-[#FBF5DD] text-[#0E4225] selection:bg-emerald-600 selection:text-white">
      {/* ---------------------------------------------------- top bar */}
      <header className="sticky top-0 z-40 border-b border-[#0E4225]/15 bg-[#FBF5DD]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 lg:px-8">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[#0E4225]/20 bg-white/80 lg:hidden"
            aria-label="Toggle navigation"
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>

          <Link href="/" className="shrink-0">
            <BrandLockup compact />
          </Link>

          <span className="ml-2 hidden rounded-lg border border-[#0E4225]/20 bg-[#0E4225]/8 px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-wider text-[#0E4225]/70 sm:inline-block">
            Console
          </span>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-1 rounded-2xl border border-[#0E4225]/20 bg-[#F6EDCC] p-1 md:flex">
              {(['officer', 'admin', 'analyst'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => switchRole(r)}
                  title={`Switch the demonstration session to ${ROLE_LABELS[r]}`}
                  className={`rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${
                    role === r ? 'bg-[#0E4225] text-[#FBF5DD] shadow' : 'text-[#0E4225]/60 hover:text-[#0E4225]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <span className="hidden items-center gap-2 rounded-2xl border border-[#0E4225]/20 bg-white/80 px-3 py-1.5 sm:flex">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
              <span className="text-[11px] font-black">
                {session.name}
                <span className="ml-1 font-bold text-[#0E4225]/50">· {ROLE_LABELS[role]}</span>
              </span>
            </span>

            <button
              onClick={logout}
              className="grid h-9 w-9 place-items-center rounded-xl border border-[#0E4225]/20 bg-white/80 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
              title="Sign out (FR-01)"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ------------------------------------------- mobile nav */}
        {menuOpen && (
          <nav className="border-t border-[#0E4225]/10 bg-[#FBF5DD] px-4 py-3 lg:hidden">
            <div className="mb-3 flex items-center gap-1 rounded-2xl border border-[#0E4225]/20 bg-[#F6EDCC] p-1 md:hidden">
              {(['officer', 'admin', 'analyst'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => switchRole(r)}
                  className={`flex-1 rounded-xl px-2 py-1.5 text-[10px] font-black uppercase tracking-wider ${
                    role === r ? 'bg-[#0E4225] text-[#FBF5DD]' : 'text-[#0E4225]/60'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <ul className="grid grid-cols-2 gap-1.5">
              {NAV.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => selectView(n.id)}
                    disabled={readOnly && WRITE_VIEWS.includes(n.id)}
                    className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-[11px] font-black transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      view === n.id
                        ? 'border-[#0E4225] bg-[#0E4225] text-[#FBF5DD]'
                        : 'border-[#0E4225]/15 bg-white/80 hover:border-[#28734A]'
                    }`}
                  >
                    {n.icon}
                    {n.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-6 lg:px-8">
        {/* --------------------------------------------- side nav */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <nav className="sticky top-24 space-y-1">
            <p className="px-3 pb-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#0E4225]/45">Screens</p>
            {NAV.map((n) => {
              const disabled = readOnly && WRITE_VIEWS.includes(n.id);
              return (
                <button
                  key={n.id}
                  onClick={() => selectView(n.id)}
                  disabled={disabled}
                  title={disabled ? 'Read-only role — the analyst cannot write records' : n.screen}
                  className={`flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    view === n.id
                      ? 'border-[#0E4225] bg-[#0E4225] text-[#FBF5DD] shadow-md'
                      : 'border-transparent hover:border-[#0E4225]/15 hover:bg-white/70'
                  }`}
                >
                  <span className={view === n.id ? 'text-[#FBF5DD]' : 'text-[#28734A]'}>{n.icon}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-black">{n.label}</span>
                    <span
                      className={`block text-[9px] font-bold uppercase tracking-wider ${
                        view === n.id ? 'text-[#FBF5DD]/60' : 'text-[#0E4225]/40'
                      }`}
                    >
                      {n.screen}
                    </span>
                  </span>
                </button>
              );
            })}

            <div className="pt-3">
              <Link href="/">
                <GhostButton className="w-full">Back to project site</GhostButton>
              </Link>
            </div>
          </nav>
        </aside>

        {/* -------------------------------------------- main views */}
        <main className="min-w-0 flex-1 space-y-5">
          <div>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.25em] text-[#0E4225]/40">
              {current.screen} · PRD § 11
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{VIEW_TITLES[view]}</h1>
          </div>

          {view === 'overview' && <OverviewView />}
          {view === 'drivers' && <DriversView onOpenRisk={openRisk} />}
          {view === 'vehicles' && <VehiclesView />}
          {view === 'record' && <RecordViolationView />}
          {view === 'risk' && <RiskAnalysisView driverId={riskDriverId} onSelectDriver={setRiskDriverId} />}
          {view === 'analytics' && <AnalyticsView />}
          {view === 'alerts' && <AlertsView />}
          {view === 'reports' && <ReportsView />}

          {readOnly && (
            <Notice tone="ethics" title="Read-only session">
              You are signed in as an analyst. Every screen is visible for transparency, but record entry, registry
              edits and alert acknowledgement are reserved for authorised officers and administrators.
            </Notice>
          )}
        </main>
      </div>

      <footer className="border-t border-[#0E4225]/12 px-4 py-6 lg:px-8">
        <div className="mx-auto max-w-[1400px] space-y-1">
          <p className="text-[11px] font-black text-[#0E4225]">SmartTraffic Analytics — academic project prototype</p>
          <p className="max-w-3xl text-[10px] font-medium leading-relaxed text-[#0E4225]/55">
            Demonstration data is generated locally for this project. Fine rules, hotspot thresholds and risk weights
            are configurable project parameters, not official government values. Output is decision support only.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ConsoleProvider>
      <ConsoleShell />
    </ConsoleProvider>
  );
}
