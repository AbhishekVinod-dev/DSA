import {
  AlertSeverity,
  AlertType,
  DatasetProfile,
  DayPart,
  DetectedPattern,
  Driver,
  HotspotRow,
  PatternType,
  RiskAnalysis,
  RiskLevel,
  TimeAnalysis,
  TrafficAlert,
  TrendDirection,
  TrendPoint,
  TrendResult,
  Violation,
  ViolationType,
  Vehicle,
} from '@/types';
import { SEVERITY_WEIGHT, VIOLATION_LABELS, LOCATIONS, DAY_NAMES } from './trafficData';

/* ------------------------------------------------------------------ *
 * Analysis configuration (FR-06, FR-07, FR-08, FR-11)
 * ------------------------------------------------------------------ */

export const ANALYSIS_CONFIG = {
  /** FR-06 — weighted risk model. */
  weights: {
    frequency: 0.3,
    recent: 0.25,
    repeat: 0.25,
    severity: 0.2,
  },
  /** Violations inside this window that normalise the frequency factor to 100. */
  frequencyWindowDays: 365,
  frequencyCap: 14,
  /** FR-06 — recency factor. */
  recentWindowDays: 90,
  recentCap: 5,
  /** E-folding time of the recency decay: exp(-ageDays / 180). */
  recencyDecayDays: 180,
  /** FR-07 — pattern rules. */
  repeatCountThreshold: 3,
  repeatWindowDays: 30,
  burstCountThreshold: 4,
  burstWindowDays: 30,
  risingWindowDays: 30,
  locationConcentrationThreshold: 3,
  timeConcentrationThreshold: 3,
  /**
   * FR-08 — a location is a hotspot at or above this recorded count.
   * Mirrors `hotspot.threshold` in backend/schema.sql.
   */
  hotspotThreshold: 130,
  /**
   * FR-10 — the review queue is prioritised by risk score, so only this many
   * drivers are considered for driver-level alerts. It is a review-queue size,
   * not a threshold: a driver outside the queue simply has not been surfaced
   * for review yet.
   */
  reviewQueueSize: 45,
} as const;

export const RISK_LEVEL_BANDS: { level: RiskLevel; min: number; max: number }[] = [
  { level: 'LOW', min: 0, max: 30 },
  { level: 'MEDIUM', min: 31, max: 60 },
  { level: 'HIGH', min: 61, max: 80 },
  { level: 'CRITICAL', min: 81, max: 100 },
];

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

export const DAY_MS = 86400000;

export function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function parseViolationDate(v: Violation): Date {
  const [h, m] = v.violationTime.split(':').map((n) => parseInt(n, 10) || 0);
  return new Date(`${v.violationDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_SHORT[m - 1]} ${String(y).slice(2)}`;
}

export function dayPartOf(hour: number): DayPart {
  if (hour >= 5 && hour <= 11) return 'MORNING';
  if (hour >= 12 && hour <= 16) return 'AFTERNOON';
  if (hour >= 17 && hour <= 20) return 'EVENING';
  return 'NIGHT';
}

export function dayPartLabel(part: DayPart): string {
  return (
    {
      MORNING: 'Morning (05–11)',
      AFTERNOON: 'Afternoon (12–16)',
      EVENING: 'Evening (17–20)',
      NIGHT: 'Night (21–04)',
    } as Record<DayPart, string>
  )[part];
}

export function riskLevelFor(score: number): RiskLevel {
  return (RISK_LEVEL_BANDS.find((b) => score >= b.min && score <= b.max) ?? RISK_LEVEL_BANDS[0]).level;
}

export function violationLabel(type: ViolationType): string {
  return VIOLATION_LABELS[type];
}

/* ------------------------------------------------------------------ *
 * FR-06 — Explainable Driver Risk Score
 * ------------------------------------------------------------------ */

export function calculateRisk(
  driverId: string,
  violations: Violation[],
  now: Date = new Date(),
): RiskAnalysis {
  const own = violations
    .filter((v) => v.driverId === driverId)
    .sort((a, b) => (a.violationDate < b.violationDate ? 1 : -1));

  const windowStart = daysAgo(now, ANALYSIS_CONFIG.frequencyWindowDays).getTime();
  const recentStart = daysAgo(now, ANALYSIS_CONFIG.recentWindowDays).getTime();

  const inWindow = own.filter((v) => parseViolationDate(v).getTime() >= windowStart);

  if (own.length === 0) {
    return {
      driverId,
      riskScore: 0,
      riskLevel: 'LOW',
      violationCount: 0,
      windowViolationCount: 0,
      lastViolationDate: null,
      analysedAt: now.toISOString(),
      factors: [
        {
          key: 'frequency',
          label: 'Violation Frequency',
          weight: ANALYSIS_CONFIG.weights.frequency,
          value: 0,
          weightedValue: 0,
          explanation: 'No violations on record for this driver in the analysis window.',
        },
        {
          key: 'recent',
          label: 'Recent Activity',
          weight: ANALYSIS_CONFIG.weights.recent,
          value: 0,
          weightedValue: 0,
          explanation: 'No violations recorded in the last 90 days.',
        },
        {
          key: 'repeat',
          label: 'Repeat Violation Rate',
          weight: ANALYSIS_CONFIG.weights.repeat,
          value: 0,
          weightedValue: 0,
          explanation: 'No repeated offence category found.',
        },
        {
          key: 'severity',
          label: 'Severity Factor',
          weight: ANALYSIS_CONFIG.weights.severity,
          value: 0,
          weightedValue: 0,
          explanation: 'No severity-weighted records available.',
        },
      ],
    };
  }

  /* Frequency — normalised against a configurable cap. */
  const frequencyValue = clamp((inWindow.length / ANALYSIS_CONFIG.frequencyCap) * 100);

  /* Recency — recent count blended with an exponential recency weight. */
  const recentCount = own.filter((v) => parseViolationDate(v).getTime() >= recentStart).length;
  const recencyWeight =
    own.reduce((sum, v) => {
      const ageDays = (now.getTime() - parseViolationDate(v).getTime()) / DAY_MS;
      return sum + Math.exp(-Math.max(0, ageDays) / ANALYSIS_CONFIG.recencyDecayDays);
    }, 0) / own.length;
  const recentValue = clamp(
    0.65 * clamp((recentCount / ANALYSIS_CONFIG.recentCap) * 100) + 0.35 * recencyWeight * 100,
  );

  /* Repeat rate — share of records that repeat an offence category. */
  const seen = new Set<ViolationType>();
  let repeats = 0;
  const ordered = [...inWindow].sort((a, b) => (a.violationDate < b.violationDate ? -1 : 1));
  ordered.forEach((v) => {
    if (seen.has(v.violationType)) repeats += 1;
    else seen.add(v.violationType);
  });
  const repeatValue = inWindow.length ? clamp((repeats / inWindow.length) * 100) : 0;

  /* Severity — mean of project severity weights. */
  const severityValue = inWindow.length
    ? clamp(inWindow.reduce((sum, v) => sum + SEVERITY_WEIGHT[v.severity], 0) / inWindow.length)
    : 0;

  const factors = [
    {
      key: 'frequency' as const,
      label: 'Violation Frequency',
      weight: ANALYSIS_CONFIG.weights.frequency,
      value: Math.round(frequencyValue),
      weightedValue: round1(frequencyValue * ANALYSIS_CONFIG.weights.frequency),
      explanation: `${inWindow.length} violation(s) in the last ${ANALYSIS_CONFIG.frequencyWindowDays} days, normalised against a cap of ${ANALYSIS_CONFIG.frequencyCap}.`,
    },
    {
      key: 'recent' as const,
      label: 'Recent Activity',
      weight: ANALYSIS_CONFIG.weights.recent,
      value: Math.round(recentValue),
      weightedValue: round1(recentValue * ANALYSIS_CONFIG.weights.recent),
      explanation: `${recentCount} violation(s) in the last ${ANALYSIS_CONFIG.recentWindowDays} days, blended 65% volume and 35% recency decay (e-folding time ${ANALYSIS_CONFIG.recencyDecayDays} days).`,
    },
    {
      key: 'repeat' as const,
      label: 'Repeat Violation Rate',
      weight: ANALYSIS_CONFIG.weights.repeat,
      value: Math.round(repeatValue),
      weightedValue: round1(repeatValue * ANALYSIS_CONFIG.weights.repeat),
      explanation: `${repeats} of ${inWindow.length} record(s) repeat an offence category already seen for this driver.`,
    },
    {
      key: 'severity' as const,
      label: 'Severity Factor',
      weight: ANALYSIS_CONFIG.weights.severity,
      value: Math.round(severityValue),
      weightedValue: round1(severityValue * ANALYSIS_CONFIG.weights.severity),
      explanation: 'Mean of project severity weights (Minor 25, Medium 50, Major 75, Severe 100).',
    },
  ];

  const score = Math.round(
    factors.reduce((sum, f) => sum + f.value * f.weight, 0),
  );

  return {
    driverId,
    riskScore: clamp(score),
    riskLevel: riskLevelFor(score),
    violationCount: own.length,
    windowViolationCount: inWindow.length,
    lastViolationDate: own[0]?.violationDate ?? null,
    analysedAt: now.toISOString(),
    factors,
  };
}

/* ------------------------------------------------------------------ *
 * FR-07 — Deterministic pattern detection
 * ------------------------------------------------------------------ */

function maxCountInWindow(dates: number[], windowDays: number): { count: number; start: string; end: string } {
  let best = { count: 0, start: '', end: '' };
  for (const anchor of dates) {
    const from = anchor - windowDays * DAY_MS;
    const inWindow = dates.filter((d) => d <= anchor && d >= from);
    if (inWindow.length > best.count) {
      best = {
        count: inWindow.length,
        start: new Date(Math.min(...inWindow)).toISOString().slice(0, 10),
        end: new Date(anchor).toISOString().slice(0, 10),
      };
    }
  }
  return best;
}

export function detectPatterns(
  driverId: string,
  violations: Violation[],
  now: Date = new Date(),
): DetectedPattern[] {
  const own = violations.filter((v) => v.driverId === driverId);
  if (own.length < 2) return [];

  const patterns: DetectedPattern[] = [];
  const stamps = own.map((v) => parseViolationDate(v).getTime());
  const cfg = ANALYSIS_CONFIG;

  /* Rule 1 — repeated offence category inside the time window. */
  const byType = new Map<ViolationType, number[]>();
  own.forEach((v) => {
    const list = byType.get(v.violationType) ?? [];
    list.push(parseViolationDate(v).getTime());
    byType.set(v.violationType, list);
  });

  byType.forEach((dates, type) => {
    const cluster = maxCountInWindow(dates, cfg.repeatWindowDays);
    if (cluster.count >= cfg.repeatCountThreshold) {
      patterns.push({
        type: 'REPEATED_TYPE',
        title: `Repeated ${violationLabel(type)}`,
        detail: `${cluster.count} ${violationLabel(type).toLowerCase()} records between ${cluster.start} and ${cluster.end}.`,
        severity: cluster.count >= 5 ? 'REVIEW' : 'WATCH',
        rule: `same_violation_count >= ${cfg.repeatCountThreshold} AND time_window <= ${cfg.repeatWindowDays} days`,
      });
    }
  });

  /* Rule 2 — burst of any offences inside the window. */
  const burst = maxCountInWindow(stamps, cfg.burstWindowDays);
  if (burst.count >= cfg.burstCountThreshold) {
    patterns.push({
      type: 'BURST',
      title: 'Multiple Violations In One Window',
      detail: `${burst.count} total violations recorded between ${burst.start} and ${burst.end}.`,
      severity: burst.count >= 7 ? 'REVIEW' : 'WATCH',
      rule: `violations_in_${cfg.burstWindowDays}_day_window >= ${cfg.burstCountThreshold}`,
    });
  }

  /* Rule 3 — recent frequency above the previous comparable period. */
  const recentStart = daysAgo(now, cfg.risingWindowDays).getTime();
  const previousStart = daysAgo(now, cfg.risingWindowDays * 2).getTime();
  const recentCount = stamps.filter((t) => t >= recentStart).length;
  const previousCount = stamps.filter((t) => t >= previousStart && t < recentStart).length;
  if (recentCount > previousCount) {
    patterns.push({
      type: 'RISING_ACTIVITY',
      title: 'Recent Violation Frequency Increased',
      detail: `${recentCount} violation(s) in the last ${cfg.risingWindowDays} days versus ${previousCount} in the preceding ${cfg.risingWindowDays} days.`,
      severity: recentCount >= previousCount * 2 && recentCount >= 3 ? 'REVIEW' : 'WATCH',
      rule: `violations_in_last_${cfg.risingWindowDays}_days > previous_${cfg.risingWindowDays}_day_count`,
    });
  }

  /* Rule 4 — recurring combination of two offence categories. */
  const typeList = [...byType.keys()];
  let combinationFound = false;
  for (let i = 0; i < typeList.length && !combinationFound; i += 1) {
    for (let j = i + 1; j < typeList.length && !combinationFound; j += 1) {
      const a = byType.get(typeList[i]) ?? [];
      const b = byType.get(typeList[j]) ?? [];
      const merged = [...a, ...b].sort((x, y) => x - y);
      const cluster = maxCountInWindow(merged, cfg.repeatWindowDays * 2);
      if (cluster.count >= 4) {
        patterns.push({
          type: 'RECURRING_COMBINATION',
          title: 'Recurring Violation Combination',
          detail: `${violationLabel(typeList[i])} and ${violationLabel(typeList[j])} co-occur ${cluster.count} times in a ${cfg.repeatWindowDays * 2}-day window.`,
          severity: 'WATCH',
          rule: `paired_offence_count >= 4 within ${cfg.repeatWindowDays * 2} days`,
        });
        combinationFound = true;
      }
    }
  }

  /* Rule 5 — concentration by location. */
  const byLocation = new Map<string, number>();
  own.forEach((v) => byLocation.set(v.location, (byLocation.get(v.location) ?? 0) + 1));
  byLocation.forEach((count, location) => {
    if (count >= cfg.locationConcentrationThreshold) {
      patterns.push({
        type: 'LOCATION_CONCENTRATION',
        title: 'Location Concentration',
        detail: `${count} violations recorded at ${location}.`,
        severity: 'WATCH',
        rule: `violations_at_single_location >= ${cfg.locationConcentrationThreshold}`,
      });
    }
  });

  /* Rule 6 — concentration by time period. */
  const byPart = new Map<DayPart, number>();
  own.forEach((v) => {
    const part = dayPartOf(parseInt(v.violationTime.split(':')[0], 10));
    byPart.set(part, (byPart.get(part) ?? 0) + 1);
  });
  byPart.forEach((count, part) => {
    if (count >= cfg.timeConcentrationThreshold) {
      patterns.push({
        type: 'TIME_CONCENTRATION',
        title: 'Time-Period Concentration',
        detail: `${count} violations recorded during ${dayPartLabel(part).toLowerCase()}.`,
        severity: 'INFO',
        rule: `violations_in_day_part >= ${cfg.timeConcentrationThreshold}`,
      });
    }
  });

  const order: Record<DetectedPattern['severity'], number> = { REVIEW: 0, WATCH: 1, INFO: 2 };
  return patterns.sort((a, b) => order[a.severity] - order[b.severity]);
}

/* ------------------------------------------------------------------ *
 * FR-08 — Hotspot analysis
 * ------------------------------------------------------------------ */

export function analyseHotspots(
  violations: Violation[],
  now: Date = new Date(),
): HotspotRow[] {
  const total = violations.length;
  if (!total) return [];

  const recentStart = daysAgo(now, 30).getTime();
  const previousStart = daysAgo(now, 60).getTime();

  const grouped = new Map<string, Violation[]>();
  violations.forEach((v) => {
    const list = grouped.get(v.location) ?? [];
    list.push(v);
    grouped.set(v.location, list);
  });

  const rows: HotspotRow[] = [...grouped.entries()].map(([location, list]) => {
    const typeCounts = new Map<ViolationType, number>();
    list.forEach((v) => typeCounts.set(v.violationType, (typeCounts.get(v.violationType) ?? 0) + 1));
    const [topType, topTypeCount] = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    const recentCount = list.filter((v) => {
      const t = parseViolationDate(v).getTime();
      return t >= recentStart;
    }).length;
    const previousCount = list.filter((v) => {
      const t = parseViolationDate(v).getTime();
      return t >= previousStart && t < recentStart;
    }).length;

    return {
      location,
      count: list.length,
      share: round1((list.length / total) * 100),
      topType,
      topTypeCount,
      recentCount,
      previousCount,
      trend:
        recentCount > previousCount ? ('RISING' as const) : recentCount < previousCount ? ('FALLING' as const) : ('STEADY' as const),
      isHotspot: list.length >= ANALYSIS_CONFIG.hotspotThreshold,
    };
  });

  return rows.sort((a, b) => b.count - a.count);
}

/* ------------------------------------------------------------------ *
 * FR-09 — Time analysis
 * ------------------------------------------------------------------ */

export function analyseTime(violations: Violation[]): TimeAnalysis {
  const hours = Array.from({ length: 24 }, () => 0);
  const parts: Record<DayPart, number> = { MORNING: 0, AFTERNOON: 0, EVENING: 0, NIGHT: 0 };
  const weekdays = Array.from({ length: 7 }, () => 0);
  const months = new Map<string, number>();

  violations.forEach((v) => {
    const date = parseViolationDate(v);
    const hour = date.getHours();
    hours[hour] += 1;
    parts[dayPartOf(hour)] += 1;
    weekdays[date.getDay()] += 1;
    const key = monthKey(v.violationDate);
    months.set(key, (months.get(key) ?? 0) + 1);
  });

  const byHour = hours.map((count, hour) => ({
    label: `${String(hour).padStart(2, '0')}:00`,
    count,
  }));
  const byDayPart = (Object.keys(parts) as DayPart[]).map((p) => ({ label: dayPartLabel(p), count: parts[p] }));
  const byDayOfWeek = DAY_NAMES.map((label, i) => ({ label, count: weekdays[i] }));
  const byMonth = [...months.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, count]) => ({ key, label: monthLabel(key), count }));

  const peakHourEntry = byHour.reduce((best, cur) => (cur.count > best.count ? cur : best), byHour[0]);
  const peakPartEntry = byDayPart.reduce((best, cur) => (cur.count > best.count ? cur : best), byDayPart[0]);
  const peakWeekEntry = byDayOfWeek.reduce((best, cur) => (cur.count > best.count ? cur : best), byDayOfWeek[0]);
  const peakMonthEntry = byMonth.length
    ? byMonth.reduce((best, cur) => (cur.count > best.count ? cur : best), byMonth[0])
    : { label: 'n/a', key: '', count: 0 };

  const peakPart = (Object.keys(parts) as DayPart[]).find((p) => dayPartLabel(p) === peakPartEntry.label) ?? 'EVENING';

  return {
    byHour,
    byDayPart,
    byDayOfWeek,
    byMonth,
    peakHour: peakHourEntry?.label ?? 'n/a',
    peakDayPart: peakPart,
    peakDayOfWeek: peakWeekEntry?.label ?? 'n/a',
    peakMonth: peakMonthEntry?.label ?? 'n/a',
  };
}

/* ------------------------------------------------------------------ *
 * FR-11 — Improvement tracking
 * ------------------------------------------------------------------ */

function trendDirection(changePct: number): TrendDirection {
  if (changePct <= -15) return 'IMPROVING';
  if (changePct >= 15) return 'DETERIORATING';
  return 'STABLE';
}

const TREND_NOTE =
  'Trend is computed from recorded violations in the compared periods. It describes the data held by the system, not verified change in real driving behaviour.';

export function buildTrendPoints(
  violations: Violation[],
  now: Date = new Date(),
): TrendPoint[] {
  const months = new Map<string, number>();
  violations.forEach((v) => {
    const key = monthKey(v.violationDate);
    months.set(key, (months.get(key) ?? 0) + 1);
  });
  const currentMonth = monthKey(now.toISOString());
  return [...months.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, count]) => ({ key, label: monthLabel(key), count, partial: key === currentMonth }));
}

const PARTIAL_MONTH_NOTE =
  'The most recent month is still in progress, so its count is not comparable with a complete month. It is excluded from the period comparison and reported separately.';

export function analyseTrend(violations: Violation[], now: Date = new Date()): TrendResult {
  const points = buildTrendPoints(violations, now);

  /* Compare like-for-like: an in-progress month cannot be set against a
   * complete one, so the comparison is anchored on the last complete month. */
  const complete = points.filter((p) => !p.partial);
  const anchor = complete.length ? complete[complete.length - 1] : points[points.length - 1];
  const prior = complete.length > 1 ? complete[complete.length - 2] : null;

  const latest = anchor?.count ?? 0;
  const previous = prior?.count ?? 0;
  const average = points.length ? round1(points.reduce((s, p) => s + p.count, 0) / points.length) : 0;
  const changePct = previous === 0 ? (latest === 0 ? 0 : 100) : Math.round(((latest - previous) / previous) * 100);

  /* Independent signal: severity mix of the last 90 days vs the prior 90. */
  const recentStart = daysAgo(now, 90).getTime();
  const previousStart = daysAgo(now, 180).getTime();
  const recent = violations.filter((v) => parseViolationDate(v).getTime() >= recentStart);
  const prior90 = violations.filter((v) => {
    const t = parseViolationDate(v).getTime();
    return t >= previousStart && t < recentStart;
  });
  const meanSeverity = (list: Violation[]) =>
    list.length ? list.reduce((s, v) => s + SEVERITY_WEIGHT[v.severity], 0) / list.length : 0;
  const severityDelta = meanSeverity(recent) - meanSeverity(prior90);
  const riskDirection: TrendDirection =
    recent.length === 0 ? 'IMPROVING' : severityDelta < -4 ? 'IMPROVING' : severityDelta > 4 ? 'DETERIORATING' : 'STABLE';

  const partialPoint = points.find((p) => p.partial);

  return {
    points,
    latest,
    previous,
    average,
    changePct,
    direction: trendDirection(changePct),
    riskDirection,
    latestLabel: anchor?.label ?? '—',
    previousLabel: prior?.label ?? '—',
    partialExcluded: partialPoint ? `${partialPoint.label} — ${partialPoint.count} recorded so far` : null,
    note: partialPoint ? `${TREND_NOTE} ${PARTIAL_MONTH_NOTE}` : TREND_NOTE,
  };
}

export function analyseDriverTrend(
  driverId: string,
  violations: Violation[],
  now: Date = new Date(),
): TrendResult {
  return analyseTrend(
    violations.filter((v) => v.driverId === driverId),
    now,
  );
}

/* ------------------------------------------------------------------ *
 * FR-10 — Evidence-backed smart alerts
 * ------------------------------------------------------------------ */

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

export function buildAlerts(
  drivers: Driver[],
  violations: Violation[],
  now: Date = new Date(),
): TrafficAlert[] {
  const alerts: TrafficAlert[] = [];
  const hotspots = analyseHotspots(violations, now);
  const time = analyseTime(violations);
  const driverName = new Map(drivers.map((d) => [d.driverId, d.name]));

  /* Driver-level alerts, strongest first. The queue is capped so the review
   * list stays actionable; a driver below the cut is not cleared, just not
   * surfaced yet. */
  const scored = drivers
    .map((d) => ({ driver: d, risk: calculateRisk(d.driverId, violations, now) }))
    .filter((entry) => entry.risk.violationCount > 0)
    .sort((a, b) => b.risk.riskScore - a.risk.riskScore)
    .slice(0, ANALYSIS_CONFIG.reviewQueueSize);

  scored.forEach(({ driver, risk }) => {
    if (risk.riskLevel === 'HIGH' || risk.riskLevel === 'CRITICAL') {
      const severity: AlertSeverity = risk.riskLevel === 'CRITICAL' ? 'HIGH' : 'MEDIUM';
      alerts.push({
        alertId: `AL-RISK-${driver.driverId}`,
        driverId: driver.driverId,
        location: null,
        alertType: 'HIGH_RISK',
        title: 'High-Risk Review Alert',
        message: `${driver.name} (${driver.driverId}) has a configurable risk score of ${risk.riskScore}/100 (${risk.riskLevel}).`,
        severity,
        reasons: risk.factors.map((f) => `${f.label}: ${f.value}/100 (weight ${Math.round(f.weight * 100)}%)`),
        recommendation:
          'Review the violation history and confirm the record before any further action. The score is a project parameter, not an official assessment.',
        createdAt: risk.lastViolationDate ?? risk.analysedAt.slice(0, 10),
        status: 'NEW',
      });
    }

    const patterns = detectPatterns(driver.driverId, violations, now);
    const repeated = patterns.filter((p) => p.type === 'REPEATED_TYPE' || p.type === 'BURST');
    if (repeated.length) {
      alerts.push({
        alertId: `AL-PAT-${driver.driverId}`,
        driverId: driver.driverId,
        location: null,
        alertType: 'REPEATED_PATTERN',
        title: 'Repeated Violation Pattern',
        message: `${repeated.length} repeated pattern(s) detected in the records available for ${driver.name}.`,
        severity: repeated.some((p) => p.severity === 'REVIEW') ? 'HIGH' : 'MEDIUM',
        reasons: repeated.map((p) => `${p.title} — ${p.detail} [rule: ${p.rule}]`),
        recommendation: 'Recommended next step: verify the repeated records with the reporting officer and consider a documented awareness review.',
        createdAt: risk.lastViolationDate ?? risk.analysedAt.slice(0, 10),
        status: 'NEW',
      });
    }

    if (patterns.some((p) => p.type === 'RISING_ACTIVITY')) {
      const rising = patterns.find((p) => p.type === 'RISING_ACTIVITY')!;
      alerts.push({
        alertId: `AL-RISE-${driver.driverId}`,
        driverId: driver.driverId,
        location: null,
        alertType: 'FREQUENCY_INCREASE',
        title: 'Recent Frequency Above Previous Period',
        message: `Recent recorded frequency is higher than the preceding comparable window for ${driver.name}.`,
        severity: 'MEDIUM',
        reasons: [rising.detail, `rule: ${rising.rule}`],
        recommendation: 'Compare the recent records against the earlier period and confirm whether the change reflects driving behaviour or record-keeping.',
        createdAt: risk.lastViolationDate ?? risk.analysedAt.slice(0, 10),
        status: 'NEW',
      });
    }

    const driverTrend = analyseDriverTrend(driver.driverId, violations, now);
    if (driverTrend.direction === 'IMPROVING' && driverTrend.points.length >= 3) {
      alerts.push({
        alertId: `AL-IMP-${driver.driverId}`,
        driverId: driver.driverId,
        location: null,
        alertType: 'IMPROVEMENT_TREND',
        title: 'Improving Recorded Trend',
        message: `Recorded violation frequency fell ${Math.abs(driverTrend.changePct)}% between the two most recent months for ${driver.name}.`,
        severity: 'LOW',
        reasons: [
          `${driverTrend.points[driverTrend.points.length - 2]?.label}: ${driverTrend.previous} → ${driverTrend.points[driverTrend.points.length - 1]?.label}: ${driverTrend.latest}`,
          driverTrend.note,
        ],
        recommendation: 'Record the improvement in the follow-up log so the trend remains visible across periods.',
        createdAt: now.toISOString().slice(0, 10),
        status: 'NEW',
      });
    }
  });

  /* Location hotspot alerts. */
  hotspots
    .filter((h) => h.isHotspot)
    .slice(0, 5)
    .forEach((h) => {
      alerts.push({
        alertId: `AL-HOT-${h.location.replace(/\s+/g, '-').toUpperCase()}`,
        driverId: null,
        location: h.location,
        alertType: 'LOCATION_HOTSPOT',
        title: 'Location Hotspot Detected',
        message: `${h.location} accounts for ${h.count} recorded violations (${h.share}% of the dataset).`,
        severity: h.count >= 25 ? 'HIGH' : 'MEDIUM',
        reasons: [
          `Most frequent offence here: ${violationLabel(h.topType)} (${h.topTypeCount} records).`,
          `Last 30 days: ${h.recentCount} · previous 30 days: ${h.previousCount} · trend ${h.trend.toLowerCase()}.`,
          `rule: location_violation_count >= ${ANALYSIS_CONFIG.hotspotThreshold}`,
        ],
        recommendation:
          'Consider additional monitoring, signage review or enforcement planning for this corridor. Analyse the time-of-day split before deciding.',
        createdAt: now.toISOString().slice(0, 10),
        status: 'NEW',
      });
    });

  /* Dataset-level period note so the officer sees the overall shape. */
  const datasetTrend = analyseTrend(violations, now);
  if (datasetTrend.points.length >= 3) {
    alerts.push({
      alertId: 'AL-IMP-DATASET',
      driverId: null,
      location: null,
      alertType: 'IMPROVEMENT_TREND',
      title: 'Dataset-Wide Recorded Trend',
      message: `Dataset volume moved ${datasetTrend.changePct >= 0 ? 'up' : 'down'} ${Math.abs(datasetTrend.changePct)}% between ${datasetTrend.points[datasetTrend.points.length - 2]?.label} and ${datasetTrend.points[datasetTrend.points.length - 1]?.label}.`,
      severity: 'LOW',
      reasons: [
        `Peak recorded period: ${time.peakDayPart.toLowerCase()} (${time.peakHour}).`,
        datasetTrend.note,
      ],
      recommendation: 'Include this context in the monthly summary so period comparisons are not read in isolation.',
      createdAt: now.toISOString().slice(0, 10),
      status: 'NEW',
    });
  }

  const sevOrder: Record<AlertSeverity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return alerts.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity] || (a.createdAt < b.createdAt ? 1 : -1));
}

/* ------------------------------------------------------------------ *
 * FR-12 — Historical what-if analysis
 * ------------------------------------------------------------------ */

export interface WhatIfScenario {
  id: string;
  label: string;
  description: string;
  reviewFocus: string;
}

export const WHAT_IF_SCENARIOS: WhatIfScenario[] = [
  {
    id: 'monitoring',
    label: 'Additional monitoring',
    description: 'Extra patrol or camera presence on the corridor for one comparable period.',
    reviewFocus: 'Compare the monitored period against the corridor\u2019s own lowest observed months.',
  },
  {
    id: 'speed_enforcement',
    label: 'Speed enforcement point',
    description: 'Fixed speed observation at the dominant offence point on this corridor.',
    reviewFocus: 'Cross-check the over-speeding share of records for this location first.',
  },
  {
    id: 'signal_retiming',
    label: 'Signal retiming review',
    description: 'Review junction timings against the recorded evening and night concentration.',
    reviewFocus: 'Weigh the signal-jump share and the peak-period split for this location.',
  },
  {
    id: 'lane_audit',
    label: 'Lane marking & signage audit',
    description: 'Refresh lane discipline markings and signages along the corridor.',
    reviewFocus: 'Check whether wrong-lane records cluster in specific hours.',
  },
  {
    id: 'night_patrol',
    label: 'Night patrol redeployment',
    description: 'Shift patrol effort toward the hours with the highest recorded counts.',
    reviewFocus: 'Use the location time-of-day split to target the redeployment window.',
  },
];

export interface WhatIfResult {
  location: string;
  scenario: WhatIfScenario;
  baseline: number;
  monthsObserved: number;
  meanMonthly: number;
  lowBand: [number, number];
  reductionRange: [number, number];
  estimatedRange: [number, number];
  dominantType: ViolationType;
  dominantShare: number;
  peakHour: string;
  note: string;
}

export function runWhatIf(
  location: string,
  scenario: WhatIfScenario,
  violations: Violation[],
  now: Date = new Date(),
): WhatIfResult {
  const scoped = violations.filter((v) => v.location === location);
  const all = buildTrendPoints(scoped, now);
  /* The historical baseline is built from complete months only — an
   * in-progress month would drag the mean down and overstate the
   * estimated reduction. */
  const months = all.filter((m) => !m.partial);
  const counts = months.map((m) => m.count).sort((a, b) => a - b);
  const baseline = scoped.length;
  const meanMonthly = months.length ? baseline / months.length : 0;

  const q25 = quantile(counts, 0.25);
  const q10 = quantile(counts, 0.1);
  const lowBand: [number, number] = [Math.round(q10), Math.round(q25)];

  const reductionRange: [number, number] = meanMonthly
    ? [
        Math.max(0, Math.round((1 - q25 / meanMonthly) * 100)),
        Math.max(0, Math.round((1 - q10 / meanMonthly) * 100)),
      ]
    : [0, 0];

  const estimatedRange: [number, number] = [
    Math.max(0, Math.round(baseline * (1 - reductionRange[1] / 100))),
    Math.max(0, Math.round(baseline * (1 - reductionRange[0] / 100))),
  ];

  const typeCounts = new Map<ViolationType, number>();
  scoped.forEach((v) => typeCounts.set(v.violationType, (typeCounts.get(v.violationType) ?? 0) + 1));
  const [dominantType, dominantCount] = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [
    'OVERSPEEDING' as ViolationType,
    0,
  ];

  const hours = Array.from({ length: 24 }, () => 0);
  scoped.forEach((v) => {
    hours[parseInt(v.violationTime.split(':')[0], 10)] += 1;
  });
  const peakIndex = hours.indexOf(Math.max(...hours));

  return {
    location,
    scenario,
    baseline,
    monthsObserved: months.length,
    meanMonthly: round1(meanMonthly),
    lowBand,
    reductionRange,
    estimatedRange,
    dominantType,
    dominantShare: baseline ? round1((dominantCount / baseline) * 100) : 0,
    peakHour: `${String(peakIndex).padStart(2, '0')}:00`,
    note: `Computed from ${months.length} observed month(s) at this location. ${scenario.reviewFocus}`,
  };
}

export const WHAT_IF_DISCLAIMER =
  'Historical-data-based estimate; not a guaranteed prediction. Derived only from months already present in the dataset.';

/* ------------------------------------------------------------------ *
 * Dashboard aggregates
 * ------------------------------------------------------------------ */

export function datasetProfile(
  drivers: Driver[],
  vehicles: Vehicle[],
  violations: Violation[],
  now: Date = new Date(),
): DatasetProfile {
  const time = analyseTime(violations);
  const hotspots = analyseHotspots(violations, now);
  const trends = analyseTrend(violations, now);

  const typeCounts = new Map<ViolationType, number>();
  violations.forEach((v) => typeCounts.set(v.violationType, (typeCounts.get(v.violationType) ?? 0) + 1));
  const [topViolationType, topCount] = [...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [
    'OVERSPEEDING' as ViolationType,
    0,
  ];

  const riskBuckets: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  let highRiskDrivers = 0;
  let repeatPatternCases = 0;
  drivers.forEach((d) => {
    const risk = calculateRisk(d.driverId, violations, now);
    riskBuckets[risk.riskLevel] += 1;
    if (risk.riskLevel === 'HIGH' || risk.riskLevel === 'CRITICAL') highRiskDrivers += 1;
    if (violations.some((v) => v.driverId === d.driverId)) {
      const patterns = detectPatterns(d.driverId, violations, now);
      if (patterns.some((p) => p.type === 'REPEATED_TYPE' || p.type === 'BURST')) repeatPatternCases += 1;
    }
  });

  const pending = violations.filter((v) => v.paymentStatus === 'PENDING');

  return {
    totalDrivers: drivers.length,
    totalVehicles: vehicles.length,
    totalViolations: violations.length,
    pendingFines: pending.length,
    pendingFineAmount: pending.reduce((s, v) => s + v.fineAmount, 0),
    collectedFineAmount: violations
      .filter((v) => v.paymentStatus === 'PAID')
      .reduce((s, v) => s + v.fineAmount, 0),
    highRiskDrivers,
    repeatPatternCases,
    hotspotCount: hotspots.filter((h) => h.isHotspot).length,
    topViolationType,
    topViolationShare: violations.length ? round1((topCount / violations.length) * 100) : 0,
    topHotspot: hotspots[0]?.location ?? LOCATIONS[0].name,
    peakPeriod: `${dayPartLabel(time.peakDayPart)} · peak hour ${time.peakHour}`,
    riskDistribution: RISK_LEVEL_BANDS.map((b) => ({ level: b.level, count: riskBuckets[b.level] })),
    monthlyVolume: trends.points,
    trend: trends,
  };
}

/* ------------------------------------------------------------------ *
 * Grouping helpers used across the console views
 * ------------------------------------------------------------------ */

export function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  items.forEach((item) => {
    const k = key(item);
    const list = map.get(k) ?? [];
    list.push(item);
    map.set(k, list);
  });
  return map;
}

export function countBy<T, K extends string>(items: T[], key: (item: T) => K): Map<K, number> {
  const map = new Map<K, number>();
  items.forEach((item) => {
    const k = key(item);
    map.set(k, (map.get(k) ?? 0) + 1);
  });
  return map;
}

export const PATTERN_TYPE_LABELS: Record<PatternType, string> = {
  REPEATED_TYPE: 'Repeated offence type',
  BURST: 'Multiple violations in one window',
  RISING_ACTIVITY: 'Rising recent activity',
  RECURRING_COMBINATION: 'Recurring offence combination',
  LOCATION_CONCENTRATION: 'Location concentration',
  TIME_CONCENTRATION: 'Time-period concentration',
};

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  REPEATED_PATTERN: 'Repeated pattern',
  FREQUENCY_INCREASE: 'Frequency increase',
  HIGH_RISK: 'High risk score',
  LOCATION_HOTSPOT: 'Location hotspot',
  IMPROVEMENT_TREND: 'Improvement trend',
};
