'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, ShieldCheck, User } from 'lucide-react';
import { BrandLockup } from '@/components/Brand';
import { DEMO_PASSWORD, DEMO_USERS, ROLE_CAPABILITIES, ROLE_LABELS } from '@/lib/trafficData';
import { readSession, writeSession } from '@/lib/trafficStore';
import { Field, GhostButton, Notice, inputClass } from '@/components/console/ui';

/**
 * Screen 1 — Login (FR-01).
 *
 * The PRD specifies username + password with role-based access and no
 * self-service registration: accounts are created by an administrator.
 * The demo build authenticates against the local `DEMO_USERS` table.
 */
export default function AuthPage() {
  const router = useRouter();
  const [username, setUsername] = useState('officer');
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (readSession()) router.replace('/dashboard');
  }, [router]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);

    const user = DEMO_USERS.find(
      (u) => u.username.toLowerCase() === username.trim().toLowerCase() && password === DEMO_PASSWORD,
    );

    if (!user) {
      setError('Those credentials are not recognised. Use one of the demonstration accounts below.');
      setBusy(false);
      return;
    }

    writeSession({
      userId: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      signedInAt: new Date().toISOString(),
    });
    router.push('/dashboard');
  };

  const useAccount = (name: string) => {
    setUsername(name);
    setPassword(DEMO_PASSWORD);
    setError('');
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#FBF5DD] text-[#0E4225]">
      <div className="pointer-events-none absolute -left-32 top-1/4 h-[420px] w-[420px] rounded-full bg-emerald-300/20 blur-[150px]" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-[380px] w-[380px] rounded-full bg-[#EBE0BA]/60 blur-[130px]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="shrink-0">
            <BrandLockup />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#0E4225]/20 bg-white/80 px-3 py-2 text-[11px] font-black text-[#0E4225]/70 hover:border-[#28734A] hover:text-[#28734A]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to site
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_420px]">
          {/* ------------------------------------------- context */}
          <div className="order-2 lg:order-1">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-[#28734A]">
              Screen 1 · PRD § 11
            </p>
            <h1 className="mt-3 text-3xl font-black leading-[1.1] tracking-tight sm:text-5xl">
              An explainable analytics layer on top of violation records.
            </h1>
            <p className="mt-4 max-w-xl text-sm font-medium leading-relaxed text-[#0E4225]/75">
              Smart Traffic Violation Prevention &amp; Management System is a JavaFX desktop application backed by
              MySQL. Every score, pattern and alert it produces is derived from recorded violations through documented,
              configurable rules — and every output shows the rule that produced it.
            </p>

            <ul className="mt-7 grid max-w-xl gap-3 sm:grid-cols-2">
              {(['officer', 'admin', 'analyst'] as const).map((role) => (
                <li key={role} className="rounded-2xl border border-[#0E4225]/12 bg-white/80 p-4">
                  <p className="text-xs font-black">{ROLE_LABELS[role]}</p>
                  <ul className="mt-1.5 space-y-1">
                    {ROLE_CAPABILITIES[role].map((cap) => (
                      <li key={cap} className="text-[11px] font-medium leading-snug text-[#0E4225]/65">
                        · {cap}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>

            <div className="mt-7 max-w-xl">
              <Notice tone="ethics" title="Positioning">
                This project is not a replacement for eChallan or any existing enforcement system. It is a decision
                support layer: it summarises and explains recorded data. It never issues a challan, never applies an
                automatic penalty, and never determines legal guilt.
              </Notice>
            </div>
          </div>

          {/* -------------------------------------------- login */}
          <div className="order-1 lg:order-2">
            <div className="rounded-[36px] border border-[#0E4225]/15 bg-white/90 p-7 shadow-[0_30px_70px_-40px_rgba(14,66,37,0.55)] backdrop-blur-sm sm:p-8">
              <div className="text-center">
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-[#0E4225]/45">
                  SmartTraffic Analytics
                </p>
                <h2 className="mt-2 text-xl font-black tracking-tight">Officer console sign-in</h2>
                <p className="mt-1 text-[11px] font-medium text-[#0E4225]/60">
                  Accounts are issued by an administrator. There is no public sign-up.
                </p>
              </div>

              <form onSubmit={submit} className="mt-6 space-y-4">
                <Field label="Username" required>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0E4225]/35" />
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      required
                      className={`${inputClass} pl-10`}
                      placeholder="officer"
                    />
                  </div>
                </Field>

                <Field label="Password" required>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0E4225]/35" />
                    <input
                      type={reveal ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      className={`${inputClass} px-10`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setReveal((r) => !r)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0E4225]/40 hover:text-[#0E4225]"
                      aria-label={reveal ? 'Hide password' : 'Show password'}
                    >
                      {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>

                {error && (
                  <p className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-[11px] font-bold text-amber-900">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0E4225] py-3.5 text-sm font-black text-[#FBF5DD] shadow-lg transition-all hover:-translate-y-0.5 hover:bg-[#1a663b] active:scale-[0.99] disabled:opacity-50"
                >
                  Login <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-[#0E4225]/12" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0E4225]/40">
                  Demo accounts
                </span>
                <span className="h-px flex-1 bg-[#0E4225]/12" />
              </div>

              <ul className="space-y-2">
                {DEMO_USERS.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => useAccount(u.username)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-[#0E4225]/12 bg-[#F6EDCC]/60 px-3.5 py-2.5 text-left transition-colors hover:border-[#28734A] hover:bg-[#F6EDCC]"
                    >
                      <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" />
                      <span className="min-w-0">
                        <span className="block text-[11px] font-black">
                          {u.username} · {ROLE_LABELS[u.role]}
                        </span>
                        <span className="block truncate text-[10px] font-medium text-[#0E4225]/60">
                          {u.name} — password {DEMO_PASSWORD}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <GhostButton className="mt-4 w-full" onClick={() => router.push('/')}>
                Continue to the project overview
              </GhostButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
