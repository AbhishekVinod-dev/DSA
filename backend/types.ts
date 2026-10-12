/**
 * Shared domain types for the Smart Traffic Violation Prevention &
 * Management System.
 *
 * These mirror the MySQL design in `backend/schema.sql` and the functional
 * requirements (FR-01 ... FR-13) of the product requirements document.
 *
 * The desktop build maps these onto JDBC row objects; the web console
 * (`web/src/types.ts`) keeps a camelCase copy of the same shape so the
 * demonstration UI and the schema never drift apart.
 */

/* ------------------------------------------------------ FR-01 users */

export type UserRole = 'ADMIN' | 'OFFICER' | 'ANALYST';

export interface SystemUser {
  id: string;
  name: string;
  username: string;
  /** SHA-256 or BCrypt hash. Plain text passwords are never stored. */
  passwordHash: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface Officer {
  officerId: string;
  /** Optional link back to the login account that owns this officer. */
  userId: string | null;
  name: string;
  rank: string;
  beat: string;
  createdAt: string;
}

/* -------------------------------------------- FR-02 / FR-03 registries */

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

/* --------------------------------------- FR-04 / FR-05 violations */

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
  /** 24h clock, e.g. 19:42 */
  violationTime: string;
  severity: Severity;
  fineAmount: number;
  paymentStatus: PaymentStatus;
  evidenceReference: string | null;
  createdAt: string;
}

/* ------------------------------------------------------- FR-06 risk */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskAnalysis {
  analysisId: string;
  driverId: string;
  /** 0-100, the weighted sum of the four normalised factors. */
  riskScore: number;
  riskLevel: RiskLevel;
  /** Every factor is normalised to 0-100 before weighting. */
  frequencyFactor: number;
  recentFactor: number;
  repeatFactor: number;
  severityFactor: number;
  violationCount: number;
  lastViolationDate: string | null;
  analysisDate: string;
}

/* ------------------------------------------------- FR-07 to FR-09 */

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
  /** The literal rule text that fired, so the result stays explainable. */
  rule: string;
}

export type DayPart = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'NIGHT';

export interface HotspotRow {
  location: string;
  count: number;
  share: number;
  topType: ViolationType;
  recentCount: number;
  previousCount: number;
  trend: 'RISING' | 'STEADY' | 'FALLING';
  isHotspot: boolean;
}

export interface TimeAnalysis {
  byHour: { label: string; count: number }[];
  byDayPart: { label: string; count: number }[];
  byDayOfWeek: { label: string; count: number }[];
  byMonth: { label: string; count: number }[];
  peakHour: string;
  peakDayPart: DayPart;
  peakDayOfWeek: string;
  peakMonth: string;
}

/* ------------------------------------- FR-10 alerts / FR-11 trend */

export type AlertType =
  | 'REPEATED_PATTERN'
  | 'FREQUENCY_INCREASE'
  | 'HIGH_RISK'
  | 'LOCATION_HOTSPOT'
  | 'IMPROVEMENT_TREND';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

/** Workflow marker for a human reviewer. The system never acts on it. */
export type AlertStatus = 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface TrafficAlert {
  alertId: string;
  driverId: string | null;
  location: string | null;
  alertType: AlertType;
  title: string;
  message: string;
  /** Evidence lines shown when the reviewer asks why this fired. */
  reasons: string[];
  recommendation: string;
  severity: AlertSeverity;
  status: AlertStatus;
  createdAt: string;
}

export type TrendDirection = 'IMPROVING' | 'STABLE' | 'DETERIORATING';

export interface TrendPoint {
  key: string;
  label: string;
  count: number;
  /** True while the month is still in progress; excluded from comparison. */
  partial?: boolean;
}

export interface TrendResult {
  period: string;
  previousPeriod: string;
  current: number;
  previous: number;
  changePct: number;
  direction: TrendDirection;
  severityDirection: TrendDirection;
  /** Records the caveat that a lower count is not proof of better driving. */
  note: string;
  /** Human-readable labels for the two compared periods. */
  latestLabel: string;
  previousLabel: string;
  /** Set when an in-progress month was held out of the comparison. */
  partialExcluded: string | null;
}

/* ------------------------------------------- configurable parameters */

export interface AppConfig {
  riskWeightFrequency: number;
  riskWeightRecent: number;
  riskWeightRepeat: number;
  riskWeightSeverity: number;
  riskWindowDays: number;
  riskFrequencyCap: number;
  riskRecentWindowDays: number;
  riskRecentCap: number;
  riskRecencyDecayDays: number;
  severityWeightMinor: number;
  severityWeightMedium: number;
  severityWeightMajor: number;
  severityWeightSevere: number;
  hotspotThreshold: number;
  patternRepeatCount: number;
  patternRepeatDays: number;
}

/**
 * Disclaimer attached to every score, report and scenario estimate.
 * The system is decision support, never an enforcement decision.
 */
export const DECISION_SUPPORT_DISCLAIMER =
  'Decision support only. This project does not issue a challan, does not predict crashes, ' +
  'does not determine legal guilt and never applies an automatic penalty or licence suspension. ' +
  'Risk weights, fine rules and hotspot thresholds are configurable project parameters, not official government values.';
