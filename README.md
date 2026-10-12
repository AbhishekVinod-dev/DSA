# 🚦 SmartTraffic Analytics

> **From violation records to explainable risk.**  
> A traffic-violation decision-support prototype that turns recorded offences into
> reviewable behavioural, spatial and temporal insight.

**Project type:** Academic / Java Advanced Programming project
**Primary stack (PRD target):** Java 17, JavaFX, MySQL 8, JDBC
**Web console in this repo:** Next.js 16 · React 19 · TypeScript · Tailwind CSS

---

## 1. What this project is

The system answers one question:

> **How can historical traffic-violation data be converted into actionable insights that
> help authorized personnel identify repeated risky behavior and support preventive
> traffic-management decisions?**

```text
Violation Occurs
      ↓
Violation Recorded
      ↓
Driver / Vehicle History Updated
      ↓
Analytics Engine
┌──────────────┬───────────────┬──────────────┐
│ Risk Score   │ Pattern       │ Hotspot      │
│ Calculation  │ Detection     │ Analysis     │
└──────────────┴───────────────┴──────────────┘
      ↓
Time Analysis + Trend Analysis
      ↓
Smart Alert / Recommendation
      ↓
Officer Dashboard
      ↓
Follow-up + Improvement Tracking
```

The central transformation:

```text
           TRADITIONAL VIEW                 PROPOSED VIEW

Violation → Fine → Record            Violation → History → Analysis
                                             → Risk Factors → Patterns
                                             → Spatial + Temporal Insight
                                             → Alerts → Human Review
                                             → Improvement Tracking
```

---

## 2. Positioning and ethics — read this first

Traffic-rule violations are associated with a substantial share of road crashes
(MoRTH, *Road Accidents in India 2023*, reports over-speeding at 63.7% of reported
accidents in million-plus cities in 2023). That is the motivation for analysing
violation *histories* rather than treating every event as an isolated administrative
entry.

Three boundaries are non-negotiable in this build, and they are enforced in the
product copy, not just documented:

| The system **does** | The system **never** does |
|---|---|
| Describe patterns in the available records | Label, accuse or profile a person |
| Produce a configurable, explainable 0–100 score | Issue a challan, penalty or licence suspension |
| Show evidence lines for every alert and factor | Determine legal guilt or predict that a driver will crash |
| Give a historical-data-based estimate | Present that estimate as a guaranteed prediction |
| Support an authorized reviewer's judgment | Replace human traffic-authority judgment |

Copy rules followed throughout the UI:

- Prefer **“repeated violation pattern detected in the available records”** over
  **“this driver is dangerous.”**
- Fine rules, risk weights, severity weights and hotspot thresholds are labelled
  **project parameters**, not statutory or government values.
- Every what-if result carries
  `Historical-data-based estimate; not a guaranteed prediction.`
- All demonstration data is synthetic. No real person is described, scored or pictured.
- No facial recognition, no biometrics, no unauthorised government-database connection.

**On existing systems.** India's eChallan platform already provides GPS location
logging, Vahan/Sarathi vehicle and driver lookup, challan history, automatic penalty
calculation, evidence collection, alerts, officer search, dashboards, reports,
analytics and geo-tagging. This project therefore does **not** claim that existing
systems only store fines, and does not position itself as a replacement. Its
contribution is narrow and specific:

> an explainable, configurable behavioral analytics and prevention-support layer
> suitable for an academic prototype.

---

## 3. Repository layout

```text
.
├── README.md
├── Smart_Traffic_Violation_Prevention_Management_PRD.md   # source of truth
├── backend/               # server, schema, shared types + fallback dataset
│   ├── RoadwiseServer.java # Java HTTP API backend (Roadwise)
│   ├── schema.sql          # MySQL 8 schema (PRD §14) + seeded app_config
│   ├── types.ts            # shared domain types mirroring the schema
│   └── trafficData.ts      # synthetic fallback dataset + demo accounts
└── web/                   # browser console — a port of the JavaFX screens
    ├── public/            # icons, manifest, robots, sitemap
    ├── scripts/
    │   └── generate-assets.cjs   # regenerates every raster icon / OG image
    └── src/
        ├── app/
        │   ├── page.tsx              # landing / product page
        │   ├── auth/page.tsx         # Screen 1 — login
        │   └── dashboard/page.tsx    # console shell, screens 2–9
        ├── components/
        │   ├── Brand.tsx             # inline SVG wordmark
        │   ├── AnalyticsPipeline.tsx
        │   ├── DatasetTelemetry.tsx
        │   ├── ScreensSection.tsx
        │   ├── Features.tsx
        │   ├── AboutSection.tsx
        │   ├── Navbar.tsx / Hero.tsx / Footer.tsx
        │   └── console/              # 8 console views + shared ui.tsx, charts.tsx
        ├── lib/
        │   ├── trafficData.ts        # re-exports backend/trafficData.ts
        │   ├── trafficAnalytics.ts   # the analytics engine
        │   ├── trafficReports.ts     # 6 report generators
        │   └── trafficStore.tsx      # localStorage-backed console state
        └── types.ts
```

### What `web/` is, precisely

`web/` is a **working demonstration console**, not the delivery target. It runs the
complete analytics pipeline over the synthetic dataset in the browser and reproduces
all nine PRD screens so the analytics, the wording and the report output can be
reviewed and demonstrated end-to-end without a JVM toolchain.

The PRD's target architecture — JavaFX → controller → service → DAO → JDBC → MySQL —
is specified in §12 and §13 of the PRD and is what the desktop application follows.
The TypeScript analytics in `web/src/lib/` is a one-to-one port of the intended Java
`analytics` package, so the two can be compared rule by rule.

---

## 4. Functional requirements

| ID | Requirement | Priority | Where it lives |
|---|---|---|---|
| FR-01 | Authentication, role-based access, logout | Must Have | `web/src/app/auth/page.tsx`, `dashboard/page.tsx` |
| FR-02 | Driver management + history | Must Have | `console/DriversView.tsx` |
| FR-03 | Vehicle management + history | Must Have | `console/VehiclesView.tsx` |
| FR-04 | Violation recording | Must Have | `console/RecordViolationView.tsx` |
| FR-05 | Fine calculation | Must Have | `backend/trafficData.ts` → `calculateFine()` |
| FR-06 | Risk score (explainable) | Must Have | `trafficAnalytics.ts` → `calculateRisk()` |
| FR-07 | Pattern detection | Must Have | `trafficAnalytics.ts` → `detectPatterns()` |
| FR-08 | Hotspot analysis | Must Have | `trafficAnalytics.ts` → `analyseHotspots()` |
| FR-09 | Time analysis | Must Have | `trafficAnalytics.ts` → `analyseTime()` |
| FR-10 | Smart alerts with triggers | Must Have | `trafficAnalytics.ts` → `buildAlerts()`, `console/AlertsView.tsx` |
| FR-11 | Improvement tracking | Should Have | `analyseTrend()`, `analyseDriverTrend()` |
| FR-12 | What-if analysis | Should Have | `runWhatIf()` + `WHAT_IF_DISCLAIMER` |
| FR-13 | Reports | Must Have | `trafficReports.ts`, `console/ReportsView.tsx` |

### Roles (FR-01)

| Role | Capabilities |
|---|---|
| **Administrator** | Manage officer accounts, configure offence categories and scoring weights, view every analytics surface, generate and export all reports |
| **Traffic Officer** | Register and edit violation records, search drivers and vehicles, review explainable risk breakdowns, acknowledge alerts, generate driver reports |
| **Analyst** | Access aggregated analytics, run historical what-if scenarios, export reports — **read-only**, write views are disabled |

---

## 5. Analytics engine

### 5.1 Risk score (FR-06)

Each factor is normalised to 0–100 **before** weighting, and the UI always shows the
component values so a reviewer can see why a score moved.

```text
Risk Score =
    30% × Violation Frequency     count in the 365-day window ÷ cap (14)
  + 25% × Recent Activity        65% volume in the 90-day window ÷ cap (5)
                                  + 35% exponential recency decay, e-folding 180 days
  + 25% × Repeat Violation Rate  share of records repeating an earlier offence category
  + 20% × Severity Factor        mean of the project severity weights
```

| Score | Level |
|---:|---|
| 0–30 | LOW |
| 31–60 | MEDIUM |
| 61–80 | HIGH |
| 81–100 | CRITICAL |

Severity weights are prototype parameters: `MINOR 25 · MEDIUM 50 · MAJOR 75 · SEVERE 100`.

### 5.2 Pattern detection (FR-07)

Deterministic rules, not a model — the point is that every result can be explained
during a viva.

| Rule | Condition |
|---|---|
| Repeated type | ≥ 3 records of the same offence inside 30 days |
| Burst | ≥ 4 records of any offence inside 30 days |
| Rising activity | violations in the last 30 days > the previous 30-day average |
| Recurring combination | the same offence pair repeats ≥ 3 times |
| Location concentration | ≥ 3 records at one location for the driver |
| Time concentration | ≥ 3 records in the same day-part |

Each detected pattern carries the literal rule text that fired, so the reviewer can
audit the decision rather than trust it.

### 5.3 Hotspots (FR-08), time (FR-09), trend (FR-11)

- **Hotspots** — aggregate by location; report count, share, dominant offence, recent
  vs previous 30-day counts, direction, and a hotspot flag at the configured threshold
  (`130` in the web build, seeded as `hotspot.threshold` in `app_config`).
- **Time** — by hour, day-part, day of week and month; the peak of each is surfaced.
- **Trend** — the most recent month is still in progress, so its count is not
  comparable with a full month. The period comparison is therefore anchored on the last
  two **complete** months, and the in-progress month is reported separately and
  labelled. The caveat travels with the result: a lower recorded count is *not* proof
  of better driving.

### 5.4 What-if analysis (FR-12)

Select a location and a scenario; the engine compares that location's own monthly
counts and reports the low band, the implied reduction range and the estimated
absolute range. Only **complete** months feed the baseline, so an in-progress month
cannot inflate the estimated reduction. Every output carries:

> Historical-data-based estimate; not a guaranteed prediction. Derived only from months
> already present in the dataset.

### 5.5 Why there is no ML in this version

An explainable rule engine is the right choice at this stage: every score can be
justified, the dataset is small, no training corpus is required, unsupported
predictions are avoided, the Java programming concepts stay central, and the results
are deterministically testable. ML is listed in PRD §25 as future scope, contingent on
a large validated dataset and proper bias/privacy handling.

### 5.6 Smart alert prioritization (Heap / PriorityQueue / Comparator)

The Java backend (`backend/RoadwiseServer.java`, `/api/alerts`) scores every alert
0–100 and serves the most important ones first:

```text
priority = 50% severity weight + 30% driver risk score + 20% urgency
```

- **Severity weight** — `Info 10 · Low 25 · Medium 50 · High 75 · Critical 100`.
- **Driver risk score** — the driver's explainable 0–100 risk at the time of the call.
- **Urgency** — an *Open* alert grows more urgent the longer it stays unanswered
  (`40 + 8/day`, capped at 100); a *Reviewed* alert fades quickly (`15 + 3/day`).

Each alert is pushed onto a `java.util.PriorityQueue` configured with a `Comparator`
that orders by descending priority (newest first on ties), then the queue is drained
with `poll()`, so a CRITICAL repeated-violation alert is returned before an
informational hotspot alert. Every response row carries `priority`, `priority_label`,
`risk_score` and `urgency` so the client can display or re-sort the list.

---

## 6. Database

`backend/schema.sql` is a MySQL 8 script. Every table is written by a DAO through plain
JDBC — no ORM. Enum-like columns are `VARCHAR` + `CHECK` so values stay readable and
extendable without an `ALTER`.

| Table | Purpose |
|---|---|
| `users` | login, role, password hash (never plaintext) |
| `officers` | the officer who recorded a violation; optional link to a login |
| `drivers` | driver identity and licence number |
| `vehicles` | registration, type, owning driver, registration status |
| `violations` | the record: type, date, time, location, severity, fine, payment status, officer, evidence reference |
| `risk_analysis` | cached score plus the four factor values, so a score can be re-explained later |
| `alerts` | evidence-backed review alerts with a workflow status marker |
| `app_config` | every configurable project parameter, seeded |

`app_config` is the important one for the ethics story: the risk weights, windows,
caps, bands, severity weights, hotspot threshold and pattern thresholds all live in the
database so an administrator can retune them, and the UI can always explain where a
number came from.

Indexes cover the analytics access paths — `(driver_id, violation_date)`,
`(location)`, `(violation_type, violation_date)`, `(violation_date)`,
`(driver_id, analysis_date)` and `(risk_level)`.

Apply it with:

```bash
mysql -u root -p < backend/schema.sql
```

---

## 7. Java desktop architecture (PRD §12–§13)

The delivery target is a layered desktop application:

```text
JavaFX UI → Controller → Service → Repository / DAO → JDBC → MySQL
```

```text
src/
├── model/        Driver, Vehicle, Violation, Officer, Fine, RiskAnalysis, Alert
├── controller/   Login, Dashboard, Driver, Vehicle, Violation, Analytics
├── service/      Auth, Driver, Vehicle, Violation, RiskAnalysis, PatternDetection,
│                 HotspotAnalysis, TrendAnalysis, Alert, Report
├── repository/   DriverDAO, VehicleDAO, ViolationDAO, RiskDAO, AlertDAO
├── analytics/    RiskCalculator, PatternDetector, HotspotAnalyzer, TimeAnalyzer
├── database/     DBConnection
├── util/         ValidationUtil, PasswordUtil, DateUtil
└── Main.java
```

`backend/types.ts` mirrors `backend/schema.sql` field for field, and `web/src/types.ts`
keeps a camelCase copy of the same shapes, so the schema, the desktop model and the
demonstration UI cannot drift apart.

---

## 8. Screens (PRD §11)

| # | Screen | Web route / view |
|---:|---|---|
| 1 | Login | `/auth` |
| 2 | Dashboard | console → Dashboard |
| 3 | Drivers | console → Drivers |
| 4 | Vehicles | console → Vehicles |
| 5 | Record Violation | console → Record Violation |
| 6 | Driver Risk Analysis | console → Risk Analysis |
| 7 | Traffic Analytics (type / location / time / risk / trends + what-if) | console → Analytics |
| 8 | Alerts | console → Alerts |
| 9 | Reports | console → Reports |

Six report types are generated: violation summary, hotspot, time analysis, risk
distribution, improvement, and a per-driver behaviour report. Each can be previewed,
copied, printed or downloaded as text/CSV.

---

## 9. Running the web console

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo accounts (FR-01)

| Username | Password | Role |
|---|---|---|
| `admin` | `traffic@2026` | Administrator |
| `officer` | `traffic@2026` | Traffic Officer |
| `analyst` | `traffic@2026` | Analyst (read-only) |

Username and password only — no social login, no self sign-up. Passwords are stored
as hashes (`demo-*-hash` placeholders in the seed data; replace them before any real
deployment).

### Demonstration dataset

Generated by a seeded PRNG (`mulberry32`, seed `20260928`) so every run produces
identical figures, and persisted to `localStorage` so a violation you record
re-runs the entire analytics pipeline immediately.

| | |
|---|---:|
| Officers | 6 |
| Drivers | 240 |
| Vehicles | 288 |
| Violations | ~1,290 |
| Junctions / locations | 12 |
| Months covered | 13 (last one in progress) |
| Window | 365 days |

The behavioural mix is deliberate: most drivers are low-volume, a minority repeat
heavily, and the heaviest cohort clusters recent records on a single dominant offence
— which is what gives the repeated-pattern, rising-activity and high-risk rules
something realistic to detect. The resulting risk distribution spans all four bands
(LOW, MEDIUM, HIGH, CRITICAL), so no band is dead weight in a demonstration.

### Other commands

```bash
npm run typecheck             # tsc --noEmit
npm run build                 # production build
npm run assets                # regenerate icons + OG image from Brand.tsx geometry
```

### Tech stack

- [Next.js 16](https://nextjs.org/) App Router, [React 19](https://react.dev/),
  [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) on a cream/emerald palette
  (`#FBF5DD` page, `#0E4225` ink, `#28734A` primary, `#F6EDCC` / `#EBE0BA` surfaces)
- [Framer Motion](https://motion.dev/) for transitions
- [Lucide React](https://lucide.dev/) for icons
- Charts are hand-rolled SVG in `components/console/charts.tsx` — no chart library
  dependency, so the visual language is fully controlled

---

## 10. Security requirements

- Passwords are hashed, never stored in plaintext.
- All SQL is parameterised via `PreparedStatement`; no string-built queries.
- Every form input is validated before it reaches a DAO.
- Role-based authorisation is enforced per view, not only in the UI.
- Sensitive driver fields are shown only where the role requires them.
- Administrative changes keep audit information.
- Synthetic data is used unless authorised real data is available.

---

## 11. Testing

**Unit** — fine calculation, risk calculation, pattern detection, hotspot counting,
time aggregation, validation.

**Integration** — `JavaFX → Service → DAO → JDBC → MySQL`.

**Scenarios**

| Scenario | Expected result |
|---|---|
| New driver, no violations | Risk LOW, no pattern, no alert |
| Three repeated violations within 30 days | Repeated pattern detected, risk increases, alert raised |
| Violations decline across four periods | Trend reported as *decreasing*, with the caveat that this is not proof of changed behaviour |
| Analyst attempts a write view | Write actions disabled; record is unchanged |
| What-if scenario run | Output shows the estimate plus the disclaimer |

---

## 12. MVP scope (PRD §24)

1. Login 2. Driver management 3. Vehicle management 4. Violation recording
5. MySQL database 6. Fine calculation 7. Driver history 8. Risk score
9. Pattern detection 10. Hotspot analysis 11. Time analysis 12. Dashboard
13. Alerts 14. Basic reports

---

## 13. End-to-end demonstration script (PRD §28)

```text
1.  Officer logs in
2.  Searches a vehicle
3.  Views driver history
4.  Adds a new violation
5.  System recalculates risk
6.  Pattern is detected
7.  Alert is generated
8.  Dashboard updates
9.  Officer opens hotspot analytics
10. Officer generates a report
```

Every step is available in `web/` today, against the 240-driver / ~1,295-violation
synthetic dataset.

---

## 14. References

1. MoRTH / NIC — *eChallan Digital Traffic/Transport Enforcement Solution.*
   <https://parivahan.gov.in/echallan/>
2. MoRTH / NIC — *eChallan User Manual.*
   <https://parivahan.gov.in/sites/default/files/FAQDOCS/Echallan/echallan-user-manual.pdf>
3. MoRTH — *Road Accidents in India 2023.*
   <https://morth.nic.in/sites/default/files/Road-Accident-in-India-2023-Publications.pdf>
4. *Transport Policy* (2026) — violations and accidents involving the same driver,
   multivariate joint survival models.
   <https://www.sciencedirect.com/science/article/abs/pii/S0967070X2500469X>
5. *Case Studies on Transport Policy* (2025) — AI-powered traffic enforcement and
   driver behaviour in Kerala.
   <https://www.sciencedirect.com/science/article/pii/S2213624X25002032>

Full requirement text lives in
[`Smart_Traffic_Violation_Prevention_Management_PRD.md`](./Smart_Traffic_Violation_Prevention_Management_PRD.md).

---

## 15. License and academic notice

This is an academic prototype built for coursework. It is **not** an official
government system, it does not issue challans, and it holds no authorised connection to
any government database. All identities, licence numbers, phone numbers, addresses and
violation records in the demonstration dataset are machine-generated. Fine rules, risk
weights, severity weights and hotspot thresholds are configurable project parameters,
not statutory values.
