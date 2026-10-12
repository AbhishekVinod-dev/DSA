'use client';

import React from 'react';
import {
  AlertCircle,
  BarChart3,
  BellRing,
  Clock,
  Database,
  FileText,
  Gauge,
  Layers,
  MapPin,
  Scale,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { ANALYSIS_CONFIG } from '@/lib/trafficAnalytics';

interface BentoCard {
  badge: string;
  title: string;
  description: string;
  bgClass: string;
  textClass: string;
  badgeBg: string;
  colSpan: string;
  icon: React.ComponentType<{ className?: string }>;
}

const storyCards: BentoCard[] = [
  {
    badge: 'The problem',
    title: 'A violation is not an isolated event',
    description:
      'Repeated records can reveal behavioural patterns, and clusters of records can reveal locations or periods that deserve additional attention. A register that only stores fines cannot surface either.',
    bgClass: 'bg-white',
    textClass: 'text-[#0E4225]',
    badgeBg: 'bg-[#0E4225]/10 text-[#0E4225]',
    colSpan: 'lg:col-span-2',
    icon: AlertCircle,
  },
  {
    badge: 'Positioning · § 1',
    title: 'Not a replacement for eChallan',
    description:
      'Existing enforcement platforms already digitise challans, payments, lookup and reporting. This project is an additional analytics layer, not a claim that those systems lack analytics.',
    bgClass: 'bg-[#0E4225]',
    textClass: 'text-white',
    badgeBg: 'bg-[#28734A] text-white',
    colSpan: 'lg:col-span-2',
    icon: Scale,
  },
  {
    badge: 'FR-02 · FR-03',
    title: 'Driver and vehicle registry',
    description:
      'Driver identity, licence number, contact and address, linked to a vehicle with its type, model and registration status. Searchable from every screen.',
    bgClass: 'bg-white',
    textClass: 'text-[#0E4225]',
    badgeBg: 'bg-emerald-100 text-emerald-800',
    colSpan: 'lg:col-span-1',
    icon: Users,
  },
  {
    badge: 'FR-04 · FR-05',
    title: 'Violation capture',
    description:
      'Offence type, location, date, time, severity, officer and payment status. The fine is derived from a configurable rule table rather than typed in by hand.',
    bgClass: 'bg-[#165431]',
    textClass: 'text-white',
    badgeBg: 'bg-white/10 text-emerald-200',
    colSpan: 'lg:col-span-1',
    icon: Database,
  },
  {
    badge: 'FR-06',
    title: 'Explainable risk score',
    description: `Risk Score = ${Math.round(
      ANALYSIS_CONFIG.weights.frequency * 100,
    )}% frequency + ${Math.round(ANALYSIS_CONFIG.weights.recent * 100)}% recent + ${Math.round(
      ANALYSIS_CONFIG.weights.repeat * 100,
    )}% repeat + ${Math.round(ANALYSIS_CONFIG.weights.severity * 100)}% severity, each normalised to 0–100 and banded LOW, MEDIUM, HIGH or CRITICAL.`,
    bgClass: 'bg-[#0E4225]',
    textClass: 'text-white',
    badgeBg: 'bg-[#28734A] text-white',
    colSpan: 'lg:col-span-1',
    icon: Gauge,
  },
  {
    badge: 'FR-07',
    title: 'Repeated-pattern detection',
    description:
      'Rules look for a repeated offence type, a burst inside a short window, a recurring type-and-location combination and rising activity — each reported with the rule text that fired it.',
    bgClass: 'bg-[#FBF5DD]',
    textClass: 'text-[#0E4225]',
    badgeBg: 'bg-[#0E4225]/10 text-[#0E4225]',
    colSpan: 'lg:col-span-2',
    icon: Layers,
  },
  {
    badge: 'FR-08',
    title: 'Hotspot analysis',
    description:
      'Locations are ranked by recorded count and share of the dataset, with the dominant offence type, the last-30-day direction and a configurable threshold that flags a hotspot.',
    bgClass: 'bg-[#1E6B40]',
    textClass: 'text-white',
    badgeBg: 'bg-emerald-900 text-emerald-200',
    colSpan: 'lg:col-span-1',
    icon: MapPin,
  },
  {
    badge: 'FR-09',
    title: 'Time-of-day analysis',
    description:
      'Violations are aggregated into 24 hourly buckets, four day parts, seven weekdays and twelve months, so an officer can see when records concentrate before planning deployment.',
    bgClass: 'bg-white',
    textClass: 'text-[#0E4225]',
    badgeBg: 'bg-emerald-100 text-emerald-800',
    colSpan: 'lg:col-span-2',
    icon: Clock,
  },
  {
    badge: 'FR-10',
    title: 'Evidence-backed alerts',
    description:
      'Every alert carries a trigger, severity, affected driver or location, a recommended next review and a status. Alerts suggest; they never act on their own.',
    bgClass: 'bg-[#28734A]',
    textClass: 'text-white',
    badgeBg: 'bg-black/20 text-white',
    colSpan: 'lg:col-span-1',
    icon: BellRing,
  },
  {
    badge: 'FR-11 · FR-12',
    title: 'Trend and improvement tracking',
    description:
      'Period-over-period comparison of recorded volume and severity mix, so a sustained change is visible — with the caveat that a lower count can also mean lower enforcement presence.',
    bgClass: 'bg-[#0A301B]',
    textClass: 'text-white',
    badgeBg: 'bg-[#28734A] text-white',
    colSpan: 'lg:col-span-1',
    icon: BarChart3,
  },
  {
    badge: 'Scope limit · § 3',
    title: 'Decision support, never enforcement',
    description:
      'The system does not claim a violation causes a crash, does not predict accidents, does not classify guilt and never applies an automatic penalty or licence suspension.',
    bgClass: 'bg-[#EBE0BA]',
    textClass: 'text-[#0E4225]',
    badgeBg: 'bg-[#0E4225]/12 text-[#0E4225]',
    colSpan: 'lg:col-span-2',
    icon: ShieldCheck,
  },
  {
    badge: 'FR-13',
    title: 'Six report types',
    description:
      'Driver behaviour, violation summary, hotspot, time analysis, risk distribution and improvement reports — generated on demand and exportable as text or CSV in the MVP.',
    bgClass: 'bg-white',
    textClass: 'text-[#0E4225]',
    badgeBg: 'bg-emerald-100 text-emerald-800',
    colSpan: 'lg:col-span-1',
    icon: FileText,
  },
];

export default function AboutSection() {
  return (
    <section id="about" className="relative overflow-hidden border-t border-emerald-950/10 bg-[#EBE0BA] py-32">
      <div className="relative z-10 mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mx-auto mb-20 max-w-3xl text-center">
          <span className="rounded-full border border-emerald-200 bg-emerald-100/80 px-3.5 py-1.5 text-xs font-bold uppercase tracking-widest text-[#28734A]">
            What the project covers
          </span>
          <h2 className="mb-4 mt-5 text-4xl font-black tracking-tight text-[#0E4225] sm:text-6xl">
            About this project
          </h2>
          <p className="text-base font-medium text-[#0E4225]/75 sm:text-lg">
            The question behind the project: how can historical violation data be turned into insights that help
            authorities review repeated behaviour and plan prevention?
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {storyCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.4, delay: (idx % 3) * 0.07 }}
                className={`flex flex-col justify-between rounded-2xl border border-emerald-950/10 p-6 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl sm:rounded-3xl sm:p-8 ${card.bgClass} ${card.textClass} ${card.colSpan}`}
              >
                <div>
                  <div className="mb-6 flex items-center justify-between">
                    <span
                      className={`rounded-full border border-white/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider ${card.badgeBg}`}
                    >
                      {card.badge}
                    </span>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>

                  <h3 className="mb-3 text-2xl font-black leading-tight tracking-tight sm:text-3xl">{card.title}</h3>

                  <p className="text-sm font-normal leading-relaxed opacity-90 sm:text-base">{card.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
