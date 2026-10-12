import { Driver, TrafficAlert, Violation } from '@/types';
import {
  ALERT_TYPE_LABELS,
  ANALYSIS_CONFIG,
  RISK_LEVEL_BANDS,
  analyseDriverTrend,
  analyseHotspots,
  analyseTime,
  analyseTrend,
  buildAlerts,
  calculateRisk,
  datasetProfile,
  dayPartLabel,
  detectPatterns,
  violationLabel,
} from './trafficAnalytics';
import { BASE_FINE, SEVERITY_LABELS, SEVERITY_WEIGHT } from './trafficData';

export type ReportId =
  | 'driver'
  | 'summary'
  | 'hotspot'
  | 'time'
  | 'risk'
  | 'improvement';

export interface ReportDefinition {
  id: ReportId;
  title: string;
  description: string;
  scope: 'global' | 'driver';
}

export const REPORTS: ReportDefinition[] = [
  {
    id: 'summary',
    title: 'Violation Summary',
    description: 'Record totals, offence mix, severity mix and payment status across the dataset.',
    scope: 'global',
  },
  {
    id: 'hotspot',
    title: 'Hotspot Report',
    description: 'Ranked locations with dominant offence type, share of dataset and recent direction.',
    scope: 'global',
  },
  {
    id: 'time',
    title: 'Time Analysis Report',
    description: 'Aggregation by hour, day part, weekday and month with the identified peak periods.',
    scope: 'global',
  },
  {
    id: 'risk',
    title: 'Risk Distribution Report',
    description: 'Driver counts per risk band plus the weighting used by the configurable risk model.',
    scope: 'global',
  },
  {
    id: 'improvement',
    title: 'Improvement Report',
    description: 'Period-over-period comparison of recorded volume and severity mix.',
    scope: 'global',
  },
  {
    id: 'driver',
    title: 'Driver Behaviour Report',
    description: 'Driver record, vehicle, history, risk breakdown, detected patterns, trend and alerts.',
    scope: 'driver',
  },
];

export interface GeneratedReport {
  id: ReportId;
  title: string;
  generatedFor: string;
  text: string;
  csv: string;
}

const RULE = '='.repeat(72);
const THIN = '-'.repeat(72);

function header(title: string, subtitle: string, generatedFor: string): string[] {
  return [
    'SMART TRAFFIC ANALYTICS',
    'Smart Traffic Violation Prevention & Management System',
    RULE,
    title,
    subtitle,
    `Generated for: ${generatedFor}`,
    `Generated at: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC`,
    'Project prototype output. Fine rules and scoring weights are configurable',
    'project parameters and are not an official government assessment.',
    RULE,
    '',
  ];
}

function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function pad(label: string, width: number): string {
  return label.length >= width ? label : label + ' '.repeat(width - label.length);
}

export function generateReport(
  id: ReportId,
  ctx: { drivers: Driver[]; violations: Violation[]; driverId?: string },
): GeneratedReport {
  const now = new Date();
  const { drivers, violations } = ctx;

  switch (id) {
    /* -------------------------------------------------- FR-13 driver */
    case 'driver': {
      const driver = drivers.find((d) => d.driverId === ctx.driverId) ?? drivers[0];
      const own = violations.filter((v) => v.driverId === driver.driverId);
      const risk = calculateRisk(driver.driverId, violations, now);
      const patterns = detectPatterns(driver.driverId, violations, now);
      const trend = analyseDriverTrend(driver.driverId, violations, now);
      const alerts = buildAlerts(drivers, violations, now).filter((a) => a.driverId === driver.driverId);

      const text = [
        ...header('Driver Behaviour Report', 'Explainable behavioural summary for one driver', driver.driverId),
        '1. DRIVER INFORMATION',
        THIN,
        `   Driver ID        : ${driver.driverId}`,
        `   Name             : ${driver.name}`,
        `   Licence number   : ${driver.licenseNumber}`,
        `   Contact          : ${driver.phone}`,
        `   Address          : ${driver.address}`,
        `   Record created   : ${driver.createdAt}`,
        '',
        '2. RISK SCORE',
        THIN,
        `   Risk score       : ${risk.riskScore}/100`,
        `   Risk level       : ${risk.riskLevel}`,
        `   Violations on record        : ${risk.violationCount}`,
        `   Violations in 365-day window: ${risk.windowViolationCount}`,
        `   Last recorded violation     : ${risk.lastViolationDate ?? 'none'}`,
        '',
        '3. RISK FACTOR BREAKDOWN',
        THIN,
        ...risk.factors.map(
          (f) =>
            `   ${pad(f.label, 24)} raw ${pad(String(f.value), 5)} weight ${pad(`${Math.round(f.weight * 100)}%`, 6)} -> ${f.weightedValue}   ${f.explanation}`,
        ),
        '',
        '4. DETECTED PATTERNS',
        THIN,
        ...(patterns.length
          ? patterns.map((p) => `   [${p.severity}] ${p.title}\n       ${p.detail}\n       rule: ${p.rule}`)
          : ['   No repeated pattern detected in the available records.']),
        '',
        '5. RECORDED TREND',
        THIN,
        `   Direction        : ${trend.direction}`,
        `   Compared periods : ${trend.previousLabel} (${trend.previous}) -> ${trend.latestLabel} (${trend.latest})`,
        `   Change           : ${trend.changePct}%`,
        `   Severity mix     : ${trend.riskDirection}`,
        trend.partialExcluded ? `   In progress      : ${trend.partialExcluded}` : '',
        `   Note             : ${trend.note}`,
        '',
        '6. VIOLATION HISTORY',
        THIN,
        ...(own.length
          ? own
              .slice(0, 40)
              .map(
                (v) =>
                  `   ${v.violationDate} ${v.violationTime}  ${pad(violationLabel(v.violationType), 34)} ${pad(
                    v.severity,
                    7,
                  )} ${pad(v.location, 24)} INR ${v.fineAmount}  ${v.paymentStatus}`,
              )
          : ['   No violations recorded.']),
        own.length > 40 ? [`   ... ${own.length - 40} further record(s) omitted from this printout.`] : [],
        '',
        '7. ALERTS',
        THIN,
        ...(alerts.length
          ? alerts.map((a) => `   [${a.severity}] ${a.title} (${ALERT_TYPE_LABELS[a.alertType]}) - status ${a.status}`)
          : ['   No alerts raised for this driver.']),
        '',
        RULE,
        'Decision support only. This report does not determine legal guilt, does not',
        'predict accidents, and never applies an automatic penalty or suspension.',
        RULE,
      ].join('\n');

      const csv = toCsv([
        ['violation_date', 'violation_time', 'offence', 'severity', 'location', 'fine_amount_inr', 'payment_status', 'officer_id', 'evidence_reference'],
        ...own.map((v) => [
          v.violationDate,
          v.violationTime,
          violationLabel(v.violationType),
          SEVERITY_LABELS[v.severity],
          v.location,
          v.fineAmount,
          v.paymentStatus,
          v.officerId,
          v.evidenceReference ?? '',
        ]),
      ]);

      return { id, title: 'Driver Behaviour Report', generatedFor: `${driver.driverId} — ${driver.name}`, text, csv };
    }

    /* ------------------------------------------------ FR-13 summary */
    case 'summary': {
      const profile = datasetProfile(drivers, [], violations, now);
      const typeCounts = new Map<string, number>();
      const severityCounts = new Map<string, number>();
      const paymentCounts = new Map<string, number>();
      violations.forEach((v) => {
        typeCounts.set(v.violationType, (typeCounts.get(v.violationType) ?? 0) + 1);
        severityCounts.set(v.severity, (severityCounts.get(v.severity) ?? 0) + 1);
        paymentCounts.set(v.paymentStatus, (paymentCounts.get(v.paymentStatus) ?? 0) + 1);
      });

      const typeRows = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]);
      const text = [
        ...header('Violation Summary', 'Dataset-wide record and offence statistics', 'All drivers'),
        'TOTALS',
        THIN,
        `   Drivers registered        : ${profile.totalDrivers}`,
        `   Vehicles registered       : ${profile.totalVehicles}`,
        `   Violation records         : ${profile.totalViolations}`,
        `   Pending fines             : ${profile.pendingFines} (INR ${profile.pendingFineAmount.toLocaleString('en-IN')})`,
        `   Collected fine amount     : INR ${profile.collectedFineAmount.toLocaleString('en-IN')}`,
        '',
        'OFFENCE MIX',
        THIN,
        ...typeRows.map(
          ([type, count]) =>
            `   ${pad(type, 22)} ${pad(String(count), 6)} ${pad(`${((count / profile.totalViolations) * 100).toFixed(1)}%`, 8)} base fine INR ${BASE_FINE[type as keyof typeof BASE_FINE]}`,
        ),
        '',
        'SEVERITY MIX',
        THIN,
        ...[...severityCounts.entries()].map(
          ([sev, count]) => `   ${pad(sev, 22)} ${pad(String(count), 6)} weight ${SEVERITY_WEIGHT[sev as keyof typeof SEVERITY_WEIGHT]}`,
        ),
        '',
        'PAYMENT STATUS',
        THIN,
        ...[...paymentCounts.entries()].map(([status, count]) => `   ${pad(status, 22)} ${pad(String(count), 6)}`),
        '',
        RULE,
        'Fine amounts follow the configurable project rule table in the prototype.',
        RULE,
      ].join('\n');

      const csv = toCsv([
        ['offence', 'count', 'share_pct', 'prototype_base_fine_inr'],
        ...typeRows.map(([type, count]) => [
          type,
          count,
          ((count / profile.totalViolations) * 100).toFixed(2),
          BASE_FINE[type as keyof typeof BASE_FINE],
        ]),
      ]);

      return { id, title: 'Violation Summary', generatedFor: 'All drivers', text, csv };
    }

    /* ------------------------------------------------ FR-13 hotspot */
    case 'hotspot': {
      const rows = analyseHotspots(violations, now);
      const text = [
        ...header('Hotspot Report', 'Violations aggregated by recorded location', 'All locations'),
        'LOCATION RANKING',
        THIN,
        ...rows.map(
          (r, i) =>
            `   ${pad(`${i + 1}. ${r.location}`, 28)} count ${pad(String(r.count), 5)} share ${pad(
              `${r.share}%`,
              7,
            )} top ${pad(violationLabel(r.topType), 30)} 30d ${pad(String(r.recentCount), 4)} prev 30d ${pad(
              String(r.previousCount),
              4,
            )} ${r.trend}${r.isHotspot ? '  [HOTSPOT]' : ''}`,
        ),
        '',
        'METHOD',
        THIN,
        `   A location is flagged as a hotspot when its recorded count reaches the`,
        `   configured threshold of ${ANALYSIS_CONFIG.hotspotThreshold} violations. The threshold is a`,
        '   project parameter and can be retuned by an administrator.',
        '',
        RULE,
        'A ranked table is used for the JavaFX prototype. Map-based heatmaps remain',
        'future scope for a web or mobile release.',
        RULE,
      ].join('\n');

      const csv = toCsv([
        ['rank', 'location', 'violations', 'share_pct', 'top_offence', 'top_offence_count', 'last_30_days', 'previous_30_days', 'trend', 'is_hotspot'],
        ...rows.map((r, i) => [
          i + 1,
          r.location,
          r.count,
          r.share,
          r.topType,
          r.topTypeCount,
          r.recentCount,
          r.previousCount,
          r.trend,
          r.isHotspot ? 'YES' : 'NO',
        ]),
      ]);

      return { id, title: 'Hotspot Report', generatedFor: 'All locations', text, csv };
    }

    /* ------------------------------------------------- FR-13 time */
    case 'time': {
      const t = analyseTime(violations);
      const text = [
        ...header('Time Analysis Report', 'Recorded violations aggregated by time dimension', 'All records'),
        'PEAK PERIODS',
        THIN,
        `   Peak hour of day   : ${t.peakHour}`,
        `   Peak day part      : ${dayPartLabel(t.peakDayPart)}`,
        `   Peak weekday       : ${t.peakDayOfWeek}`,
        `   Peak month         : ${t.peakMonth}`,
        '',
        'BY DAY PART',
        THIN,
        ...t.byDayPart.map((p) => `   ${pad(p.label, 22)} ${pad(String(p.count), 6)}`),
        '',
        'BY WEEKDAY',
        THIN,
        ...t.byDayOfWeek.map((p) => `   ${pad(p.label, 22)} ${pad(String(p.count), 6)}`),
        '',
        'BY MONTH',
        THIN,
        ...t.byMonth.map((p) => `   ${pad(p.label, 22)} ${pad(String(p.count), 6)}`),
        '',
        'BY HOUR (24 buckets)',
        THIN,
        ...chunk(t.byHour.map((h) => `${h.label}=${h.count}`), 6).map((row) => `   ${row.join('   ')}`),
        '',
        RULE,
        'Peak periods describe concentration in the available records. They do not',
        'establish a cause for any individual violation.',
        RULE,
      ].join('\n');

      const csv = toCsv([
        ['dimension', 'bucket', 'violations'],
        ...t.byDayPart.map((p) => ['day_part', p.label, p.count]),
        ...t.byDayOfWeek.map((p) => ['weekday', p.label, p.count]),
        ...t.byMonth.map((p) => ['month', p.key, p.count]),
        ...t.byHour.map((p) => ['hour', p.label, p.count]),
      ]);

      return { id, title: 'Time Analysis Report', generatedFor: 'All records', text, csv };
    }

    /* ------------------------------------------------- FR-13 risk */
    case 'risk': {
      const profile = datasetProfile(drivers, [], violations, now);
      const text = [
        ...header('Risk Distribution Report', 'Configurable risk model output across all drivers', 'All drivers'),
        'RISK MODEL',
        THIN,
        `   Risk Score = ${ANALYSIS_CONFIG.weights.frequency * 100}% x Violation Frequency`,
        `             + ${ANALYSIS_CONFIG.weights.recent * 100}% x Recent Violation Activity`,
        `             + ${ANALYSIS_CONFIG.weights.repeat * 100}% x Repeat Violation Rate`,
        `             + ${ANALYSIS_CONFIG.weights.severity * 100}% x Severity Factor`,
        '',
        '   Each component is normalised to 0-100 before the weighted sum.',
        `   Frequency normalisation cap : ${ANALYSIS_CONFIG.frequencyCap} violations / ${ANALYSIS_CONFIG.frequencyWindowDays} days`,
        `   Recent window / cap        : ${ANALYSIS_CONFIG.recentWindowDays} days / ${ANALYSIS_CONFIG.recentCap} violations`,
        `   Recency decay half-life    : ${ANALYSIS_CONFIG.recencyDecayDays} days`,
        '',
        'DISTRIBUTION',
        THIN,
        ...profile.riskDistribution.map(
          (d) => `   ${pad(d.level, 10)} ${pad(String(d.count), 6)} ${pad(`${((d.count / drivers.length) * 100).toFixed(1)}%`, 8)}`,
        ),
        '',
        'BANDS',
        THIN,
        ...RISK_LEVEL_BANDS.map((b) => `   ${pad(b.level, 10)} ${b.min}-${b.max}`),
        '',
        `   High-risk drivers (HIGH or CRITICAL): ${profile.highRiskDrivers}`,
        '',
        RULE,
        'The score is a project-configured parameter for academic demonstration.',
        'It is not an official government risk score and carries no legal meaning.',
        RULE,
      ].join('\n');

      const csv = toCsv([
        ['risk_level', 'band_low', 'band_high', 'driver_count', 'share_pct'],
        ...RISK_LEVEL_BANDS.map((b) => {
          const row = profile.riskDistribution.find((d) => d.level === b.level);
          return [b.level, b.min, b.max, row?.count ?? 0, (((row?.count ?? 0) / drivers.length) * 100).toFixed(2)];
        }),
      ]);

      return { id, title: 'Risk Distribution Report', generatedFor: 'All drivers', text, csv };
    }

    /* -------------------------------------------- FR-11 improvement */
    case 'improvement': {
      const trend = analyseTrend(violations, now);
      const text = [
        ...header('Improvement Report', 'Period-over-period comparison of recorded behaviour', 'All drivers'),
        'PERIOD COMPARISON',
        THIN,
        ...trend.points.map((p, i) => {
          const prev = trend.points[i - 1];
          const delta = prev ? `${p.count - prev.count >= 0 ? '+' : ''}${p.count - prev.count}` : '—';
          return `   ${pad(p.label, 10)} ${pad(String(p.count), 6)} change ${pad(delta, 6)}${p.partial ? '  (in progress)' : ''}`;
        }),
        '',
        `   Compared periods  : ${trend.previousLabel} vs ${trend.latestLabel}`,
        `   Previous month    : ${trend.previous}`,
        `   Latest month      : ${trend.latest}`,
        `   Monthly average   : ${trend.average}`,
        `   Change            : ${trend.changePct}%`,
        `   Recorded direction: ${trend.direction}`,
        `   Severity direction: ${trend.riskDirection}`,
        trend.partialExcluded ? `   In progress       : ${trend.partialExcluded}` : '',
        '',
        'INTERPRETATION',
        THIN,
        `   ${trend.note}`,
        '',
        '   A decreasing count means fewer violations are recorded for the compared',
        '   period. It is not proof that driving behaviour changed, because record',
        '   volume also depends on enforcement presence and reporting practice.',
        '',
        RULE,
        RULE,
      ].join('\n');

      const csv = toCsv([
        ['period', 'violations', 'change_vs_previous', 'complete_month'],
        ...trend.points.map((p, i) => [
          p.key,
          p.count,
          i === 0 ? '' : p.count - trend.points[i - 1].count,
          p.partial ? 'no' : 'yes',
        ]),
      ]);

      return { id, title: 'Improvement Report', generatedFor: 'All drivers', text, csv };
    }

    default:
      return { id, title: 'Report', generatedFor: '—', text: 'Unsupported report.', csv: '' };
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/* ------------------------------------------------------------------ *
 * Client-side export helpers (FR-13: text / CSV in the MVP)
 * ------------------------------------------------------------------ */

export function downloadText(filename: string, contents: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function alertSummaryForDriver(alerts: TrafficAlert[], driverId: string): TrafficAlert[] {
  return alerts.filter((a) => a.driverId === driverId);
}
