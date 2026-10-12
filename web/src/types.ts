/**
 * Domain types for the Smart Traffic Violation Prevention & Management System.
 *
 * Mirrors the database design in `backend/schema.sql` and the functional
 * requirements (FR-01 ... FR-13) of the product requirements document.
 */

/* ------------------------------------------------------------------ *
 * FR-01 Authentication
 * ------------------------------------------------------------------ */

export type UserRole = 'admin' | 'officer' | 'analyst';

export interface SystemUser {
  id: string;
  name: string;
  username: string;
  /** Demo build only: the real implementation stores `passwordHash`. */
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}

export interface Session {
  userId: string;
  name: string;
  username: string;
  role: UserRole;
  signedInAt: string;
}

/* ------------------------------------------------------------------ *
 * FR-02 / FR-03 Driver and vehicle management
 * ------------------------------------------------------------------ */

export interface Driver {
  driverId: string;
  name: string;
  licenseNumber: string;
  phone: string;
  address: string;
  city: string;
  createdAt: string;
}

export type VehicleType = 'CAR' | 'TWO_WHEELER' | 'SUV' | 'TRUCK' | 'BUS' | 'AUTO_RICKSHAW';

export type RegistrationStatus = 'ACTIVE' | 'EXPIRED' | 'SOLD';

export interface Vehicle {
  vehicleId: string;
  vehicleNumber: string;
  vehicleType: VehicleType;
  model: string;
  driverId: string;
  registrationStatus: RegistrationStatus;
  createdAt: string;
}

/* ------------------------------------------------------------------ *
 * FR-04 Violation management
 * ------------------------------------------------------------------ */

export type ViolationType =
  | 'OVERSPEEDING'
  | 'SIGNAL_JUMP'
  | 'WRONG_LANE'
  | 'HELMET_SEATBELT'
  | 'DRUNK_DRIVING'
  | 'UNAUTHORIZED_PARKING'
  | 'MOBILE_PHONE_USE'
  | 'DOCUMENT_VIOLATION';

export type Severity = 'MINOR' | 'MEDIUM' | 'MAJOR' | 'SEVERE';

export type PaymentStatus = 'PENDING' | 'PAID' | 'CHALLENGED';

export interface Violation {
  violationId: string;
  driverId: string;
  vehicleId: string;
  officerId: string;
  violationType: ViolationType;
  location: string;
  /** ISO date, e.g. 2026-04-17 */
  violationDate: string;
  /** 24h clock string, e.g. "19:42" */
  violationTime: string;
  severity: Severity;
  fineAmount: number;
  paymentStatus: PaymentStatus;
  evidenceReference?: string;
  createdAt: string;
}

export interface Officer {
  officerId: string;
  name: string;
  rank: string;
  beat: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ *
 * FR-06 Risk analysis
 * ------------------------------------------------------------------ */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskFactor {
  key: 'frequency' | 'recent' | 'repeat' | 'severity';
  label: string;
  weight: number;
  value: number;
  weightedValue: number;
  explanation: string;
}

export interface RiskAnalysis {
  driverId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  factors: RiskFactor[];
  violationCount: number;
  windowViolationCount: number;
  lastViolationDate: string | null;
  analysedAt: string;
}

/* ------------------------------------------------------------------ *
 * FR-07 Pattern detection
 * ------------------------------------------------------------------ */

export type PatternType =
  | 'REPEATED_TYPE'
  | 'BURST'
  | 'RISING_ACTIVITY'
  | 'RECURRING_COMBINATION'
  | 'LOCATION_CONCENTRATION'
  | 'TIME_CONCENTRATION';

export type PatternSeverity = 'INFO' | 'WATCH' | 'REVIEW';

export interface DetectedPattern {
  type: PatternType;
  title: string;
  detail: string;
  severity: PatternSeverity;
  rule: string;
}

/* ------------------------------------------------------------------ *
 * FR-08 Hotspot analysis
 * ------------------------------------------------------------------ */

export interface HotspotRow {
  location: string;
  count: number;
  share: number;
  topType: ViolationType;
  topTypeCount: number;
  recentCount: number;
  previousCount: number;
  trend: 'RISING' | 'STEADY' | 'FALLING';
  isHotspot: boolean;
}

/* ------------------------------------------------------------------ *
 * FR-09 Time analysis
 * ------------------------------------------------------------------ */

export type DayPart = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';

export interface TimeAnalysis {
  byHour: { label: string; count: number }[];
  byDayPart: { label: string; count: number }[];
  byDayOfWeek: { label: string; count: number }[];
  byMonth: { label: string; key: string; count: number }[];
  peakHour: string;
  peakDayPart: DayPart;
  peakDayOfWeek: string;
  peakMonth: string;
}

/* ------------------------------------------------------------------ *
 * FR-11 Improvement tracking
 * ------------------------------------------------------------------ */

export type TrendDirection = 'IMPROVING' | 'STABLE' | 'DETERIORATING';

export interface TrendPoint {
  key: string;
  label: string;
  count: number;
  /**
   * True when the month is still in progress. Its count is therefore not
   * comparable with a full month, so period-over-period analysis skips it.
   */
  partial?: boolean;
}

export interface TrendResult {
  points: TrendPoint[];
  /** Most recent COMPLETE month, so the comparison is like-for-like. */
  latest: number;
  previous: number;
  average: number;
  changePct: number;
  direction: TrendDirection;
  riskDirection: TrendDirection;
  /** Human-readable label of the month the comparison is anchored on. */
  latestLabel: string;
  previousLabel: string;
  /** Set when an in-progress month was excluded from the comparison. */
  partialExcluded: string | null;
  note: string;
}

/* ------------------------------------------------------------------ *
 * FR-10 Smart alerts
 * ------------------------------------------------------------------ */

export type AlertType =
  | 'REPEATED_PATTERN'
  | 'FREQUENCY_INCREASE'
  | 'HIGH_RISK'
  | 'LOCATION_HOTSPOT'
  | 'IMPROVEMENT_TREND';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export type AlertStatus = 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface TrafficAlert {
  alertId: string;
  driverId: string | null;
  location: string | null;
  alertType: AlertType;
  title: string;
  message: string;
  severity: AlertSeverity;
  reasons: string[];
  recommendation: string;
  createdAt: string;
  status: AlertStatus;
}

/* ------------------------------------------------------------------ *
 * Dashboard aggregates
 * ------------------------------------------------------------------ */

export interface DatasetProfile {
  totalDrivers: number;
  totalVehicles: number;
  totalViolations: number;
  pendingFines: number;
  pendingFineAmount: number;
  collectedFineAmount: number;
  highRiskDrivers: number;
  repeatPatternCases: number;
  hotspotCount: number;
  topViolationType: ViolationType;
  topViolationShare: number;
  topHotspot: string;
  peakPeriod: string;
  riskDistribution: { level: RiskLevel; count: number }[];
  monthlyVolume: TrendPoint[];
  /** Like-for-like period comparison, already excluding any in-progress month. */
  trend: TrendResult;
}
