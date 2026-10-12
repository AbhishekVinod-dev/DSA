import type {
  Driver,
  Officer,
  RegistrationStatus,
  Severity,
  SystemUser,
  Vehicle,
  VehicleType,
  Violation,
  ViolationType,
  // The fallback dataset also feeds the web console, so it is typed against
  // the console's domain types (`web/src/types.ts`), the camelCase mirror of
  // the schema in `backend/schema.sql`.
} from '../web/src/types';

/* ------------------------------------------------------------------ *
 * Reference configuration (FR-05, FR-06, FR-15)
 *
 * Every value in this file is a *project prototype* parameter. They are
 * deliberately kept in one place so an administrator can retune them and
 * so the UI can always explain where a number came from.
 * ------------------------------------------------------------------ */

export const VIOLATION_TYPES: ViolationType[] = [
  'OVERSPEEDING',
  'SIGNAL_JUMP',
  'WRONG_LANE',
  'HELMET_SEATBELT',
  'DRUNK_DRIVING',
  'UNAUTHORIZED_PARKING',
  'MOBILE_PHONE_USE',
  'DOCUMENT_VIOLATION',
];

export const VIOLATION_LABELS: Record<ViolationType, string> = {
  OVERSPEEDING: 'Over-Speeding',
  SIGNAL_JUMP: 'Signal Jump (Red Light)',
  WRONG_LANE: 'Wrong Lane / Lane Discipline',
  HELMET_SEATBELT: 'Helmet & Seatbelt',
  DRUNK_DRIVING: 'Drinking & Driving',
  UNAUTHORIZED_PARKING: 'Unauthorized Parking',
  MOBILE_PHONE_USE: 'Mobile Phone Use While Driving',
  DOCUMENT_VIOLATION: 'Document / Registration Violation',
};

export const SEVERITIES: Severity[] = ['MINOR', 'MEDIUM', 'MAJOR', 'SEVERE'];

export const SEVERITY_LABELS: Record<Severity, string> = {
  MINOR: 'Minor',
  MEDIUM: 'Medium',
  MAJOR: 'Major',
  SEVERE: 'Severe',
};

/** FR-15: project-defined severity weights. */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  MINOR: 25,
  MEDIUM: 50,
  MAJOR: 75,
  SEVERE: 100,
};

/** FR-05: prototype base fine per offence category. */
export const BASE_FINE: Record<ViolationType, number> = {
  OVERSPEEDING: 500,
  SIGNAL_JUMP: 750,
  WRONG_LANE: 400,
  HELMET_SEATBELT: 250,
  DRUNK_DRIVING: 2000,
  UNAUTHORIZED_PARKING: 300,
  MOBILE_PHONE_USE: 350,
  DOCUMENT_VIOLATION: 600,
};

export const SEVERITY_MULTIPLIER: Record<Severity, number> = {
  MINOR: 1,
  MEDIUM: 1.5,
  MAJOR: 2,
  SEVERE: 3,
};

/** FR-05: transparent, project-configured fine calculation. */
export function calculateFine(type: ViolationType, severity: Severity): number {
  const raw = BASE_FINE[type] * SEVERITY_MULTIPLIER[severity];
  return Math.round(raw / 10) * 10;
}

/** Relative likelihood of each offence in the synthetic dataset. */
const TYPE_WEIGHTS: Record<ViolationType, number> = {
  OVERSPEEDING: 30,
  SIGNAL_JUMP: 18,
  WRONG_LANE: 15,
  HELMET_SEATBELT: 13,
  MOBILE_PHONE_USE: 9,
  UNAUTHORIZED_PARKING: 8,
  DOCUMENT_VIOLATION: 4,
  DRUNK_DRIVING: 3,
};

const SEVERITY_BY_TYPE: Record<ViolationType, Severity[]> = {
  OVERSPEEDING: ['MEDIUM', 'MAJOR', 'SEVERE'],
  SIGNAL_JUMP: ['MINOR', 'MEDIUM', 'MAJOR'],
  WRONG_LANE: ['MINOR', 'MEDIUM'],
  HELMET_SEATBELT: ['MINOR', 'MEDIUM'],
  DRUNK_DRIVING: ['MAJOR', 'SEVERE'],
  UNAUTHORIZED_PARKING: ['MINOR'],
  MOBILE_PHONE_USE: ['MINOR', 'MEDIUM'],
  DOCUMENT_VIOLATION: ['MINOR', 'MEDIUM'],
};

export const LOCATIONS: { name: string; city: string; weight: number }[] = [
  { name: 'Anna Nagar', city: 'Chennai', weight: 16 },
  { name: 'T. Nagar', city: 'Chennai', weight: 14 },
  { name: 'Velachery Main Road', city: 'Chennai', weight: 12 },
  { name: 'Adyar Signal', city: 'Chennai', weight: 9 },
  { name: 'Guindy Junction', city: 'Chennai', weight: 8 },
  { name: 'Nungambakkam High Road', city: 'Chennai', weight: 7 },
  { name: 'Ambattur Bypass', city: 'Chennai', weight: 7 },
  { name: 'Porur Link Road', city: 'Chennai', weight: 6 },
  { name: 'Sholinganallur Bypass', city: 'Chennai', weight: 6 },
  { name: 'Tambaram Junction', city: 'Chennai', weight: 6 },
  { name: 'Egmore Multi-Modal Hub', city: 'Chennai', weight: 5 },
  { name: 'Mylapore Beach Road', city: 'Chennai', weight: 4 },
];

export const DAY_PARTS = ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'] as const;
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ------------------------------------------------------------------ *
 * FR-01 demo accounts (synthetic — never real credentials)
 * ------------------------------------------------------------------ */

export const DEMO_USERS: SystemUser[] = [
  {
    id: 'USR-001',
    name: 'R. Balakrishnan',
    username: 'admin',
    passwordHash: 'demo-admin-hash',
    role: 'admin',
    createdAt: '2026-01-04',
  },
  {
    id: 'USR-002',
    name: 'S. Meenakshi',
    username: 'officer',
    passwordHash: 'demo-officer-hash',
    role: 'officer',
    createdAt: '2026-01-04',
  },
  {
    id: 'USR-003',
    name: 'K. Ramesh',
    username: 'analyst',
    passwordHash: 'demo-analyst-hash',
    role: 'analyst',
    createdAt: '2026-01-11',
  },
];

/** Demo password accepted for every seeded account. */
export const DEMO_PASSWORD = 'traffic@2026';

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  officer: 'Traffic Officer',
  analyst: 'Analyst (Read-Only)',
};

export const ROLE_CAPABILITIES: Record<string, string[]> = {
  admin: [
    'Manage officer accounts',
    'Configure offence categories and scoring weights',
    'View every analytics surface',
    'Generate and export all reports',
  ],
  officer: [
    'Register and edit violation records',
    'Search drivers and vehicles',
    'Review explainable risk breakdowns',
    'Acknowledge alerts and generate driver reports',
  ],
  analyst: [
    'Access aggregated analytics',
    'Run historical what-if scenarios',
    'Export reports',
    'Read-only — cannot modify operational records',
  ],
};

/* ------------------------------------------------------------------ *
 * Deterministic synthetic dataset generator
 *
 * PRD §28 asks for 100–500 drivers, 100–500 vehicles and 1,000+
 * violations across multiple locations, offence types and months. The
 * generator is seeded so every reload produces the same numbers, which
 * keeps dashboard values matching the underlying records.
 * ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = [
  'Arun', 'Bhavani', 'Chandru', 'Deepa', 'Ezhil', 'Fathima', 'Ganesh', 'Harini', 'Ilaiyarasan',
  'Jaya', 'Karthik', 'Lakshmi', 'Mani', 'Nandhini', 'Oviya', 'Prakash', 'Radhika', 'Sathish',
  'Thenmozhi', 'Udhayanidhi', 'Vasanthi', 'Vinoth', 'Yamuna', 'Zoya', 'Anitha', 'Balaji',
  'Chitra', 'Dinesh', 'Eswari', 'Gopal', 'Hemant', 'Indira', 'Jagadeesh', 'Kalpana',
  'Lokesh', 'Malathi', 'Naveen', 'Pavithra', 'Ramesh', 'Saranya', 'Tamilarasan', 'Umamaheswari',
  'Vijayakumar', 'Aishwarya', 'Bhuvaneshwari', 'Ganeshraj', 'Kavitha', 'Muthukumar',
];

const LAST_NAMES = [
  'Kumar', 'Rajan', 'Subramanian', 'Muthukumar', 'Chandran', 'Perumal', 'Sundaram', 'Krishnan',
  'Venkatesan', 'Shanmugam', 'Balaji', 'Nagarajan', 'Ramesh', 'Sivakumar', 'Anand', 'Prabhu',
  'Selvaraj', 'Thiruvengadam', 'Varadarajan', 'Yadav', 'Iyer', 'Pillai', 'Naidu', 'Gowri',
  'Sekar', 'Manickam', 'Arunachalam', 'Boopathy', 'Chidambaram', 'Dharani',
];

const VEHICLE_MODELS: Record<VehicleType, string[]> = {
  CAR: ['Maruti Swift', 'Hyundai i20', 'Tata Tiago', 'Honda City', 'Maruti Baleno'],
  TWO_WHEELER: ['Royal Enfield Classic', 'Honda Activa', 'Bajaj Pulsar', 'TVS Jupiter', 'Ola S1'],
  SUV: ['Mahindra XUV700', 'Tata Nexon', 'Maruti Vitara Brezza', 'Toyota Urban Cruiser'],
  TRUCK: ['Ashok Leyland Dost', 'Tata Ace Gold', 'Eicher Pro 2049'],
  BUS: ['Tata Starbus', 'Ashok Leyland Viking', 'Eicher Skyline'],
  AUTO_RICKSHAW: ['Mahindra Supro', 'Piaggio Ape City', 'Atul Tuk-Tuk'],
};

const CITY = 'Chennai';

const DISTRICT_CODES = ['01', '02', '07', '09', '10', '11', '22', '44', '45', '57'];

function districtCode(rng: () => number): string {
  return DISTRICT_CODES[Math.floor(rng() * DISTRICT_CODES.length)];
}

function pickWeighted<T extends string>(rng: () => number, weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

function locationWeights(): Record<string, number> {
  return LOCATIONS.reduce<Record<string, number>>((acc, l) => {
    acc[l.name] = l.weight;
    return acc;
  }, {});
}

/** Weighted hour profile that produces a credible evening/night peak. */
const HOUR_WEIGHTS: Record<number, number> = {
  0: 4, 1: 3, 2: 2, 3: 2, 4: 2, 5: 3, 6: 5, 7: 7, 8: 8, 9: 6, 10: 5,
  11: 5, 12: 6, 13: 6, 14: 5, 15: 5, 16: 6, 17: 9, 18: 12, 19: 13,
  20: 11, 21: 9, 22: 7, 23: 5,
};

function hourWeightsRecord(): Record<string, number> {
  return Object.entries(HOUR_WEIGHTS).reduce<Record<string, number>>((acc, [h, w]) => {
    acc[h] = w;
    return acc;
  }, {});
}

/** Monthly volume multiplier — peaks mid-year then falls, so the
 *  improvement-tracking report has a real signal to describe. */
const MONTH_PROFILE = [0.86, 0.9, 0.95, 1.02, 1.12, 1.24, 1.3, 1.18, 1.06, 0.98, 0.88, 0.8];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

export interface SeedResult {
  officers: Officer[];
  drivers: Driver[];
  vehicles: Vehicle[];
  violations: Violation[];
}

export function generateSeedDataset(now: Date = new Date()): SeedResult {
  const rng = mulberry32(20260928);
  const locW = locationWeights();
  const hourW = hourWeightsRecord();

  /* ---------------------------- officers ---------------------------- */
  const officerSpecs: [string, string, string][] = [
    ['Insp. R. Balakrishnan', 'Sub-Inspector', 'Anna Nagar Beat'],
    ['Insp. S. Meenakshi', 'Sub-Inspector', 'Velachery Beat'],
    ['Insp. M. Dhanasekaran', 'Head Constable', 'T. Nagar Beat'],
    ['Insp. A. Fathima', 'Head Constable', 'Adyar Beat'],
    ['Insp. K. Ramachandran', 'Sub-Inspector', 'Porur Beat'],
    ['Insp. P. Sivasubramanian', 'Head Constable', 'Tambaram Beat'],
  ];

  const officers: Officer[] = officerSpecs.map(([name, rank, beat], i) => ({
    officerId: `OF-${1001 + i}`,
    name,
    rank,
    beat,
    createdAt: '2025-11-01',
  }));

  /* ----------------------------- drivers ---------------------------- */
  const DRIVER_COUNT = 240;
  const drivers: Driver[] = [];
  const driverHomeLocation: string[] = [];
  const driverViolationTarget: number[] = [];
  /** High-volume drivers keep returning to the same offence category. */
  const driverDominantType: ViolationType[] = [];

  for (let i = 0; i < DRIVER_COUNT; i += 1) {
    const driverId = `D${1001 + i}`;
    const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
    const home = pickWeighted(rng, locW);

    drivers.push({
      driverId,
      name: `${first} ${last}`,
      licenseNumber: `TN${districtCode(rng)}-${Math.floor(2015 + rng() * 11)}-${pad(
        Math.floor(rng() * 99999),
        5,
      )}`,
      phone: `9${pad(Math.floor(rng() * 9) + 1)}${pad(Math.floor(rng() * 100000000), 8)}`,
      address: `${Math.floor(1 + rng() * 240)}, ${home}, ${CITY}`,
      city: CITY,
      createdAt: isoDate(new Date(now.getTime() - (400 + rng() * 300) * 86400000)),
    });

    driverHomeLocation.push(home);

    // Behavioural profile: most drivers are low-volume, a minority repeat.
    // PRD section 28 asks for 1,000+ violations in the demonstration
    // dataset, so the long tail is deliberately heavier here.
    const roll = rng();
    let target: number;
    if (roll < 0.44) target = rng() < 0.68 ? 0 : 1 + Math.floor(rng() * 2);
    else if (roll < 0.78) target = 3 + Math.floor(rng() * 7);
    else target = 10 + Math.floor(rng() * 13);
    driverViolationTarget.push(target);

    // Repeat offenders are drawn toward a single dominant offence so the
    // FR-07 repeated-pattern rule has something realistic to detect.
    driverDominantType.push(
      target >= 10
        ? VIOLATION_TYPES[Math.floor(rng() * VIOLATION_TYPES.length)]
        : pickWeighted(rng, TYPE_WEIGHTS as Record<string, number>) as ViolationType,
    );
  }

  /* ---------------------------- vehicles ---------------------------- */
  const VEHICLE_COUNT = 288;
  const vehicles: Vehicle[] = [];
  const typePool: VehicleType[] = ['TWO_WHEELER', 'CAR', 'CAR', 'CAR', 'SUV', 'AUTO_RICKSHAW', 'TRUCK', 'BUS'];

  for (let i = 0; i < VEHICLE_COUNT; i += 1) {
    const type = typePool[Math.floor(rng() * typePool.length)];
    const driverIdx = Math.floor(rng() * drivers.length);
    const prefix =
      type === 'TWO_WHEELER' ? ['TN', 'TN', 'PY'] : type === 'AUTO_RICKSHAW' ? ['TN'] : ['TN', 'TN', 'KA', 'AP'];
    const state = prefix[Math.floor(rng() * prefix.length)];
    const series = type === 'TWO_WHEELER' ? `${Math.floor(10 + rng() * 89)}${String.fromCharCode(65 + Math.floor(rng() * 26))}${String.fromCharCode(65 + Math.floor(rng() * 26))}${Math.floor(1000 + rng() * 8999)}` : `${String.fromCharCode(65 + Math.floor(rng() * 26))}${String.fromCharCode(65 + Math.floor(rng() * 26))}${Math.floor(10 + rng() * 89)}${String.fromCharCode(65 + Math.floor(rng() * 26))}${String.fromCharCode(65 + Math.floor(rng() * 26))}${Math.floor(1000 + rng() * 8999)}`;

    const statusRoll = rng();
    const status: RegistrationStatus = statusRoll < 0.9 ? 'ACTIVE' : statusRoll < 0.97 ? 'EXPIRED' : 'SOLD';

    vehicles.push({
      vehicleId: `V${5001 + i}`,
      vehicleNumber: `${state} ${state === 'KA' || state === 'AP' ? '01' : districtCode(rng)} ${series}`,
      vehicleType: type,
      model: VEHICLE_MODELS[type][Math.floor(rng() * VEHICLE_MODELS[type].length)],
      driverId: drivers[driverIdx].driverId,
      registrationStatus: status,
      createdAt: isoDate(new Date(now.getTime() - (200 + rng() * 600) * 86400000)),
    });
  }

  /* ---------------------------- violations -------------------------- */
  const violations: Violation[] = [];
  const vehiclesByDriver = new Map<string, Vehicle[]>();
  vehicles.forEach((v) => {
    const list = vehiclesByDriver.get(v.driverId) ?? [];
    list.push(v);
    vehiclesByDriver.set(v.driverId, list);
  });

  const WINDOW_DAYS = 365;
  let seq = 1;

  drivers.forEach((driver, idx) => {
    const target = driverViolationTarget[idx];
    const home = driverHomeLocation[idx];
    const owned = vehiclesByDriver.get(driver.driverId) ?? [];
    // 12% of violations belong to a vehicle registered to a different driver.
    const useOtherVehicle = owned.length === 0 || rng() < 0.12;

    const dominant = driverDominantType[idx];
    // Share of this driver's records that land on the dominant offence.
    const dominance = target >= 10 ? 0.62 : target >= 3 ? 0.4 : 0.18;

    for (let k = 0; k < target; k += 1) {
      // Repeat offenders cluster their records toward the present, so the
      // FR-06 recent-activity factor and the FR-07 "rising activity" rule
      // both have something to detect. pow(u, k) with k > 1 pulls daysAgo
      // toward 0; the mild cohort stays roughly uniform.
      const recencySkew = target >= 7 ? Math.pow(rng(), 1.7) : Math.pow(rng(), 1.15);
      const daysAgo = Math.floor(recencySkew * WINDOW_DAYS);
      const date = new Date(now.getTime() - daysAgo * 86400000);
      const month = date.getMonth();
      const monthFactor = MONTH_PROFILE[month];

      // Reject/accept against the monthly profile so the volume trend is shaped.
      if (rng() > monthFactor * 0.86) continue;

      const type =
        rng() < dominance
          ? dominant
          : pickWeighted(rng, TYPE_WEIGHTS as Record<ViolationType, number>);
      const severityOptions = SEVERITY_BY_TYPE[type];
      const severity =
        severityOptions[
          target >= 7
            ? Math.min(severityOptions.length - 1, 1 + Math.floor(rng() * (severityOptions.length - 1)))
            : Math.floor(rng() * severityOptions.length)
        ];

      const location = rng() < 0.68 ? home : pickWeighted(rng, locW);
      const rolledHour = Number(pickWeighted(rng, hourW as unknown as Record<string, number>));
      let hour = rolledHour;
      let minute = Math.floor(rng() * 60);

      // A record dated today must not be timestamped in the future, otherwise
      // reports list a violation after the report's own generation time.
      if (daysAgo === 0) {
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        if (hour * 60 + minute > nowMinutes) {
          if (nowMinutes < 60) {
            hour = 0;
            minute = 0;
          } else {
            hour = Math.floor((nowMinutes - 1) / 60);
            minute = (nowMinutes - 1) % 60;
          }
        }
      }

      const vehicle = useOtherVehicle
        ? vehicles[Math.floor(rng() * vehicles.length)]
        : owned[Math.floor(rng() * owned.length)];

      const paymentRoll = rng();
      const paymentStatus =
        daysAgo < 45 && paymentRoll < 0.55
          ? 'PENDING'
          : paymentRoll < 0.12
            ? 'CHALLENGED'
            : 'PAID';

      violations.push({
        violationId: `VL-${date.getFullYear()}-${pad(seq, 4)}`,
        driverId: driver.driverId,
        vehicleId: vehicle.vehicleId,
        officerId: officers[Math.floor(rng() * officers.length)].officerId,
        violationType: type,
        location,
        violationDate: isoDate(date),
        violationTime: `${pad(hour)}:${pad(minute)}`,
        severity,
        fineAmount: calculateFine(type, severity),
        paymentStatus,
        evidenceReference: rng() < 0.82 ? `CAM-${districtCode(rng)}-${pad(Math.floor(rng() * 9999), 4)}` : undefined,
        createdAt: isoDate(new Date(date.getTime() + 3600000)),
      });
      seq += 1;
    }
  });

  violations.sort((a, b) => (a.violationDate < b.violationDate ? 1 : -1));

  return { officers, drivers, vehicles, violations };
}
