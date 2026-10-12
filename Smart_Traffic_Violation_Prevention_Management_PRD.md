# Product Requirements Document (PRD)
# Smart Traffic Violation Prevention & Management System

**Version:** 1.1  
**Date:** October 2026  
**Project Type:** Academic / Java Advanced Programming Project  
**Primary Stack:** Java, JavaFX, MySQL, JDBC  
**Revision history:** see [§32](#32-revision-history) for everything that changed after v1.0

---

## 1. Executive Summary

The **Smart Traffic Violation Prevention & Management System** is a Java-based decision-support application for managing traffic violations and extracting behavioral and traffic-pattern insights from violation history.

Traditional traffic enforcement platforms already digitize important functions such as challan creation, violation history, penalty calculation, location capture, dashboards, reports, alerts, and payment workflows. India's official eChallan platform, for example, supports automatic location logging, vehicle/driver lookup, offence-history access, automatic challan calculation, evidence collection, alerts, searchable challan history, dashboards, analytics, and geo-tagging. Therefore, this project should **not** position itself as simply replacing eChallan or as the first system to digitize traffic fines. [1][2]

The project's differentiating academic contribution is a focused **behavioral and preventive analytics layer**. It takes recorded violations and produces:

- an explainable Driver Risk Score;
- repeated-violation and temporal pattern detection;
- location hotspot analysis;
- time-of-day analysis;
- risk and violation trend tracking;
- improvement tracking;
- evidence-backed alerts and recommendations; and
- historical-data-based what-if analysis.

The system does not automatically punish, suspend, or legally classify drivers. It provides information to authorized personnel for review and decision support.

---

# 2. What Is This Project About?

At its core, the project answers this question:

> **How can historical traffic violation data be converted into actionable insights that help authorities identify repeated risky behavior and support preventive traffic-management decisions?**

The system follows this lifecycle:

```text
Violation Occurs
      ↓
Violation Recorded
      ↓
Driver / Vehicle History Updated
      ↓
Analytics Engine
      ↓
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

---

# 3. Problem Statement

Traffic violations are not only isolated administrative events. Repeated violations can reveal behavioral patterns, while clusters of violations can reveal locations or periods that deserve additional attention.

A basic violation-management application may answer:

- Who committed the violation?
- What violation occurred?
- How much is the fine?
- Was it paid?

The proposed system additionally asks:

- Is this driver repeatedly committing the same type of violation?
- Are violations becoming more frequent recently?
- Which violation types dominate this driver's history?
- Which locations have unusually high violation counts in the project's dataset?
- During which periods are violations concentrated?
- Is the driver's recorded behavior improving or worsening over time?
- What information should an authorized officer review next?

This is particularly relevant because road-safety data shows that traffic-rule violations are associated with a substantial share of crashes. MoRTH's *Road Accidents in India 2023* reports that, among million-plus cities in 2023, over-speeding accounted for 63.7% of reported accidents and 60.8% of persons killed in the traffic-rule-violation classification shown in its table. [3]

A 2026 peer-reviewed study also treats traffic violations as recurrent events and reports a strong relationship between traffic violations and crashes, reinforcing the value of analyzing violation histories rather than treating every event as completely independent. [4]

**Important scope limitation:** the project does not claim that a violation automatically causes a crash or that its risk score predicts crashes. The project analyzes violation behavior and provides decision support.

---

# 4. Research Findings

## 4.1 Existing Government Enforcement Infrastructure

India already has a mature digital traffic-enforcement ecosystem.

The official eChallan documentation lists capabilities including:

- GPS-based location logging;
- vehicle/driver lookup through Vahan/Sarathi;
- access to challan history;
- automatic penalty calculation;
- evidence collection;
- online/offline synchronization;
- alerts and notifications;
- officer search and workflow support;
- dashboards and dynamic reports;
- analytics;
- geo-tagging of challan locations; and
- searchable offence history. [1][2]

Therefore, the project should **not** claim:

> "Existing systems only store fines."

That would be inaccurate.

Instead, the project should say:

> "Existing platforms provide extensive digital enforcement and reporting capabilities; this project focuses specifically on an explainable behavioral analytics and prevention-support layer suitable for an academic prototype."

## 4.2 Traffic-Safety Need

MoRTH's *Road Accidents in India 2023* provides evidence that speeding is a major traffic-rule-violation category associated with accidents in the reported dataset. [3]

Research published in *Transport Policy* in 2026 examines repeated traffic violations as recurrent events and their relationship with accidents. [4]

Research on AI-powered traffic enforcement in Kerala has also examined spatial-temporal violation behavior and driver segments, indicating that modern traffic systems can move beyond simple enforcement toward behavior-oriented analysis. [5]

## 4.3 Research Gap for This Academic Project

The gap is **not** that digital traffic enforcement does not exist.

The project gap is the creation of a compact, transparent, explainable prototype that demonstrates how historical violation records can be transformed into a structured behavioral-risk and prevention workflow.

The system should emphasize:

1. **Explainability** — show why a risk score changed.
2. **Pattern visibility** — show repeated violation types and clusters.
3. **Temporal reasoning** — analyze recent and historical behavior.
4. **Spatial analysis** — identify high-count locations in the dataset.
5. **Improvement tracking** — show whether violation frequency changes over time.
6. **Human review** — recommendations support officers rather than replacing their judgment.

---

# 5. Existing System vs Proposed System

| Area | Existing Digital Enforcement | Proposed Academic System |
|---|---|---|
| Violation recording | Yes | Yes |
| Challan/fine management | Yes | Yes, simplified for prototype |
| Driver/vehicle history | Yes | Yes |
| Dashboards/reports | Yes | Yes |
| Location information | Yes | Yes |
| Alerts | Yes | Yes |
| Behavioral risk score | Not claimed as a core official eChallan feature | **Core project feature** |
| Explainable risk factors | Project focus | **Core project feature** |
| Repeated-pattern analysis | Project focus | **Core project feature** |
| Improvement trend | Project focus | **Core project feature** |
| What-if historical scenario | Project feature | **Core project feature** |
| Automatic legal action | Out of scope | **Never automatic** |

The comparison is intentionally conservative: the project differentiates itself by **focus and implementation**, not by claiming that existing government systems have no analytics.

---

# 6. Product Vision

Build a transparent traffic analytics application that turns raw violation records into understandable behavioral and traffic-pattern insights that authorized personnel can use for review, awareness, monitoring, and preventive planning.

---

# 7. Goals

### Primary Goals

- Centralize driver, vehicle, officer, violation, and fine information.
- Analyze driver violation history.
- Calculate a transparent risk score.
- Detect repeated violation patterns.
- Analyze violation locations.
- Analyze violation time periods.
- Track changes in driver behavior over time.
- Generate actionable but non-binding recommendations.
- Provide dashboards and reports.

### Secondary Goals

- Demonstrate advanced Java programming concepts.
- Demonstrate database connectivity using JDBC.
- Demonstrate object-oriented architecture.
- Demonstrate analytical algorithms using Java Collections.
- Provide a polished JavaFX GUI.

---

# 8. Non-Goals

The first version will **not**:

- automatically issue real government challans;
- connect to government databases without authorization;
- automatically suspend a driving licence;
- determine legal guilt;
- automatically punish a driver;
- predict that a specific driver will cause an accident;
- claim that the risk score is an official government score;
- use facial recognition or biometric identification;
- replace human traffic-authority judgment.

---

# 9. Target Users

## 9.1 Administrator

Responsibilities:

- Manage officers.
- Manage system configuration.
- View all analytics.
- Manage violation categories and scoring weights.
- Generate reports.

## 9.2 Traffic Officer

Responsibilities:

- Register violations.
- Search drivers and vehicles.
- View violation history.
- Review risk explanations.
- View alerts.
- Review hotspots and time trends.
- Generate driver reports.

## 9.3 Optional Future User: Analyst

A read-only user who can access aggregated analytics without modifying operational records.

---

# 10. Core Functional Requirements

## FR-01 Authentication

The system shall provide secure login for authorized users.

Features:

- Username/password authentication.
- Role-based access.
- Logout.
- Session handling.
- Passwords stored as secure hashes rather than plaintext.

## FR-02 Driver Management

The system shall allow authorized users to:

- create a driver record;
- update driver information;
- search by driver ID/license number;
- view driver history;
- view current risk information.

## FR-03 Vehicle Management

The system shall allow users to:

- register vehicles;
- associate vehicles with drivers;
- update vehicle information;
- search by registration number;
- view vehicle violation history.

## FR-04 Violation Management

Each violation shall contain:

- violation ID;
- driver/vehicle;
- violation type;
- date;
- time;
- location;
- severity;
- fine amount;
- payment status;
- officer ID;
- optional evidence/reference field.

## FR-05 Fine Calculation

The system shall calculate a project-configured fine based on violation type and severity.

Fine rules must be configurable and clearly labelled as **prototype/project rules**, unless sourced from an authorized current legal schedule.

## FR-06 Risk Score

The system shall calculate a score from 0–100 using transparent project-defined factors.

Suggested model:

```text
Risk Score =
    30% × Violation Frequency
  + 25% × Recent Violation Activity
  + 25% × Repeat Violation Rate
  + 20% × Severity Factor
```

Each component is normalized to 0–100 before the weighted calculation.

Suggested display:

| Score | Level |
|---:|---|
| 0–30 | Low |
| 31–60 | Medium |
| 61–80 | High |
| 81–100 | Critical |

The UI must show the component values so users can understand why the score changed.

## FR-07 Pattern Detection

The system shall detect:

- repeated violation types;
- multiple violations within configurable time windows;
- increasing recent violation frequency;
- recurring violation combinations;
- concentration by location;
- concentration by time period.

Example:

```text
3 overspeeding violations within 30 days
→ Repeated overspeeding pattern detected
```

## FR-08 Hotspot Analysis

The system shall aggregate violations by location.

Outputs:

- top locations by violation count;
- violation type by location;
- recent location trend;
- optional heatmap in a future web/mobile version.

For the JavaFX prototype, a ranked table and chart are sufficient.

## FR-09 Time Analysis

The system shall aggregate violations by:

- hour;
- morning/afternoon/evening/night;
- day of week;
- month.

The system shall identify periods with higher recorded violation counts in the dataset.

## FR-10 Smart Alerts

The system shall generate informational alerts such as:

- repeated violation detected;
- recent violation frequency increased;
- high risk score;
- location hotspot detected;
- improvement trend detected.

Alerts shall explain their trigger.

## FR-11 Improvement Tracking

The system shall compare historical periods and show:

- violation count trend;
- repeated-violation trend;
- risk-score trend;
- improvement or deterioration in recorded behavior.

Example:

```text
January: 5 violations
February: 4
March: 2
April: 1

Trend: Recorded violation frequency decreased
```

The system must avoid claiming that this proves a change in actual driving behavior beyond the available records.

## FR-12 What-If Analysis

The system shall allow an analyst/officer to select a location or scenario and view a historical-data-based estimate.

Example:

```text
Location: Anna Nagar
Historical violation count: 42

Scenario:
Additional monitoring

Output:
Estimated historical-pattern range: 10–15% reduction
```

This must be clearly labelled **scenario analysis / estimate**, not a guaranteed prediction.

## FR-13 Reports

The system shall generate:

- driver behavior report;
- violation summary;
- hotspot report;
- time analysis report;
- risk distribution report;
- improvement report.

Reports may be exported as PDF/CSV in a future enhancement or as text/printable reports in the MVP.

---

# 11. User Experience / Frontend Requirements

The application will use **JavaFX**.

## Screen 1 — Login

```text
SMART TRAFFIC ANALYTICS

Username
Password

[ Login ]
```

## Screen 2 — Dashboard

Show:

- total drivers;
- total vehicles;
- total violations;
- pending fines;
- high-risk drivers;
- top violation;
- top hotspot;
- peak violation period;
- risk distribution chart.

## Screen 3 — Drivers

- searchable table;
- add/edit driver;
- driver details;
- violation history;
- risk score.

## Screen 4 — Vehicles

- vehicle search;
- owner information;
- violation history.

## Screen 5 — Record Violation

Form for entering violation details.

## Screen 6 — Driver Risk Analysis

Display:

```text
Risk Score: 78/100
Risk Level: HIGH

Frequency       70
Recent Activity 80
Repeat Rate     90
Severity        65

Detected Pattern:
Repeated Overspeeding
```

## Screen 7 — Traffic Analytics

Tabs:

- Violations by type;
- Violations by location;
- Violations by time;
- Risk distribution;
- Trends.

## Screen 8 — Alerts

Show alerts with:

- trigger;
- severity;
- affected driver/location;
- date;
- recommendation;
- status.

## Screen 9 — Reports

Allow users to generate and export reports.

---

# 12. Backend Architecture

Recommended architecture:

```text
┌───────────────────────────────┐
│           JavaFX UI           │
└───────────────┬───────────────┘
                ↓
┌───────────────────────────────┐
│       Controller Layer        │
└───────────────┬───────────────┘
                ↓
┌───────────────────────────────┐
│        Service Layer          │
│                               │
│ DriverService                 │
│ VehicleService                │
│ ViolationService              │
│ RiskAnalysisService           │
│ PatternDetectionService       │
│ HotspotAnalysisService        │
│ ReportService                 │
└───────────────┬───────────────┘
                ↓
┌───────────────────────────────┐
│       Repository / DAO        │
└───────────────┬───────────────┘
                ↓
┌───────────────────────────────┐
│        JDBC / Database        │
└───────────────┬───────────────┘
                ↓
             MySQL
```

---

# 13. Recommended Java Package Structure

```text
src/
├── model/
│   ├── Driver.java
│   ├── Vehicle.java
│   ├── Violation.java
│   ├── Officer.java
│   ├── Fine.java
│   ├── RiskAnalysis.java
│   └── Alert.java
│
├── controller/
│   ├── LoginController.java
│   ├── DashboardController.java
│   ├── DriverController.java
│   ├── VehicleController.java
│   ├── ViolationController.java
│   └── AnalyticsController.java
│
├── service/
│   ├── AuthService.java
│   ├── DriverService.java
│   ├── VehicleService.java
│   ├── ViolationService.java
│   ├── RiskAnalysisService.java
│   ├── PatternDetectionService.java
│   ├── HotspotAnalysisService.java
│   ├── TrendAnalysisService.java
│   ├── AlertService.java
│   └── ReportService.java
│
├── repository/
│   ├── DriverDAO.java
│   ├── VehicleDAO.java
│   ├── ViolationDAO.java
│   ├── RiskDAO.java
│   └── AlertDAO.java
│
├── analytics/
│   ├── RiskCalculator.java
│   ├── PatternDetector.java
│   ├── HotspotAnalyzer.java
│   └── TimeAnalyzer.java
│
├── database/
│   └── DBConnection.java
│
├── util/
│   ├── ValidationUtil.java
│   ├── PasswordUtil.java
│   └── DateUtil.java
│
└── Main.java
```

---

# 14. Database Design

## `users`

```sql
id
name
username
password_hash
role
created_at
```

## `drivers`

```sql
driver_id
name
license_number
phone
address
created_at
```

## `vehicles`

```sql
vehicle_id
vehicle_number
vehicle_type
model
driver_id
registration_status
created_at
```

## `violations`

```sql
violation_id
driver_id
vehicle_id
officer_id
violation_type
location
violation_date
violation_time
severity
fine_amount
payment_status
evidence_reference
created_at
```

## `risk_analysis`

```sql
analysis_id
driver_id
risk_score
risk_level
frequency_factor
recent_factor
repeat_factor
severity_factor
analysis_date
```

## `alerts`

```sql
alert_id
driver_id
alert_type
message
severity
created_at
status
```

---

# 15. Analytics Engine

The analytics engine is the main differentiating component.

## Pipeline

```text
Raw Violation Records
        ↓
Data Validation
        ↓
Feature Calculation
        ↓
Risk Calculation
        ↓
Pattern Detection
        ↓
Spatial Aggregation
        ↓
Temporal Aggregation
        ↓
Trend Analysis
        ↓
Alert Generation
```

## Risk Features

### Violation Frequency

Measures the number of violations within a configurable period.

### Recency

Recent violations contribute more to the recent-activity factor than older records.

### Repeat Rate

Measures how often the driver repeats the same violation category.

### Severity

Uses project-defined severity weights.

Example:

```text
Minor   = 25
Medium  = 50
Major   = 75
Severe  = 100
```

These values are prototype parameters and should be configurable.

---

# 16. Pattern Detection Logic

The MVP should use deterministic rules rather than an unexplained AI model.

Example rules:

```text
IF same_violation_count >= 3
AND time_window <= 30 days
THEN repeated_pattern = TRUE
```

```text
IF violations_in_last_30_days > previous_30_day_average
THEN recent_activity = INCREASING
```

```text
IF location_violation_count > configured_threshold
THEN hotspot = TRUE
```

```text
IF current_period_count < previous_period_count
THEN recorded_violation_trend = IMPROVING
```

This makes the system easy to explain during a viva.

---

# 17. Why Not Use AI/ML in the MVP?

The project does not need AI to demonstrate its core innovation.

A transparent rule-based analytics engine is preferable for the first version because:

- the project can explain every score;
- the dataset may be small;
- no large training dataset is required;
- there is less risk of unsupported predictions;
- Java programming concepts remain central;
- deterministic testing is easier.

### Future ML Version

If a sufficiently large, validated dataset becomes available, future versions could explore:

- anomaly detection;
- clustering of driver behavior;
- time-series forecasting;
- violation-risk prediction;
- spatial clustering.

Any predictive model would require proper validation and careful handling of bias and privacy.

---

# 18. Smart Alert Design

Alerts should be explainable.

### Example

```text
HIGH-RISK REVIEW ALERT

Driver: D1024
Risk Score: 78

Why was this triggered?
• 3 overspeeding violations in 30 days
• 6 total violations
• Recent violation frequency increased

Suggested review:
Review recent violation history.
```

The system should never say:

> "This driver is dangerous."

Prefer:

> "Repeated violation pattern detected in the available records."

This keeps the system evidence-based.

### Prioritization

Alerts accumulate, so the API serves them in order of a computed 0–100 priority instead
of insertion order:

```text
priority = 50% severity weight + 30% driver risk score + 20% urgency
```

- **Severity weight** — `Info 10 · Low 25 · Medium 50 · High 75 · Critical 100`.
- **Driver risk score** — the driver's explainable 0–100 risk at the time of the call.
- **Urgency** — an *Open* alert grows more urgent the longer it stays unanswered
  (`40 + 8/day`, capped at 100); a *Reviewed* alert fades quickly (`15 + 3/day`).

The backend pushes each alert onto a `java.util.PriorityQueue` ordered by a
`Comparator` (descending priority, newest first on ties) and drains it with `poll()`,
so a CRITICAL repeated-violation alert is returned before an informational hotspot
alert. Every response row also carries `priority`, `priority_label`, `risk_score` and
`urgency`, so the client can display or re-sort the list. This is the collections
requirement (Heap / PriorityQueue / Comparator) expressed in the product. See §32.1.

---

# 19. What-If Analysis

The MVP can implement a simple historical scenario engine.

Input:

```text
Location: Anna Nagar
Scenario: Additional monitoring
```

The system compares historical periods or similar periods in the dataset and provides:

```text
Historical baseline: 42 violations
Comparable monitored periods: 36–39
Estimated historical range: 7–14% lower
```

The output must clearly state:

> **Historical-data-based estimate; not a guaranteed prediction.**

---

# 20. Reports

### Driver Report

```text
Driver information
Vehicle information
Violation history
Risk score
Risk-factor breakdown
Detected patterns
Trend
Alerts
```

### Location Report

```text
Location
Total violations
Top violation types
Peak times
Trend
```

### Authority Dashboard Report

```text
Total violations
Risk distribution
Top violation types
Top locations
Peak periods
Recent trends
```

---

# 21. Security Requirements

- Store password hashes, never plaintext passwords.
- Use parameterized SQL / PreparedStatement.
- Validate all form inputs.
- Apply role-based authorization.
- Avoid exposing sensitive driver information unnecessarily.
- Keep audit information for important administrative changes.
- Use synthetic/demo data for the academic prototype unless authorized real data is available.

---

# 22. Privacy and Ethical Requirements

Traffic and driver information can contain sensitive personal data.

The prototype should:

- use fictional/sample identities during demonstrations;
- minimize stored personal information;
- restrict access based on user role;
- avoid unnecessary personal data;
- clearly distinguish analytical estimates from official decisions;
- avoid automated legal or punitive decisions.

---

# 23. Functional Requirements Summary

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Authentication | Must Have |
| FR-02 | Driver Management | Must Have |
| FR-03 | Vehicle Management | Must Have |
| FR-04 | Violation Recording | Must Have |
| FR-05 | Fine Calculation | Must Have |
| FR-06 | Risk Score | Must Have |
| FR-07 | Pattern Detection | Must Have |
| FR-08 | Hotspot Analysis | Must Have |
| FR-09 | Time Analysis | Must Have |
| FR-10 | Smart Alerts | Must Have |
| FR-11 | Improvement Tracking | Should Have |
| FR-12 | What-If Analysis | Should Have |
| FR-13 | Reports | Must Have |

---

# 24. MVP Scope

The minimum working version should contain:

1. Login
2. Driver management
3. Vehicle management
4. Violation recording
5. MySQL database
6. Fine calculation
7. Driver history
8. Risk score
9. Pattern detection
10. Hotspot analysis
11. Time analysis
12. Dashboard
13. Alerts
14. Basic reports

This is enough for a complete academic project.

---

# 25. Future Enhancements

Possible future versions could include:

- Web/mobile interface.
- Map-based visualization.
- Real-time camera integration.
- Automatic number-plate recognition.
- Authorized integration with government systems.
- SMS/email notifications.
- Advanced ML models.
- Crash-data correlation.
- GIS heatmaps.
- Multi-city analytics.
- Predictive traffic-safety analytics.

These should remain future scope unless the necessary data, APIs, permissions, and validation are available.

---

# 26. Testing Strategy

## Unit Testing

Test:

- fine calculation;
- risk calculation;
- pattern detection;
- hotspot counting;
- time aggregation;
- validation.

## Integration Testing

Test:

```text
JavaFX → Service → DAO → JDBC → MySQL
```

## Scenario Testing

### Scenario 1
New driver with no violations.

Expected:

```text
Risk: Low
No repeated pattern
```

### Scenario 2
Three repeated violations within 30 days.

Expected:

```text
Repeated pattern detected
Risk increases
Alert generated
```

### Scenario 3
Violations decline over four periods.

Expected:

```text
Recorded violation trend: Decreasing
```

---

# 27. Success Criteria

The project is successful if:

- users can record and retrieve violations reliably;
- driver and vehicle history is correctly maintained;
- risk scores are reproducible and explainable;
- repeated patterns are detected correctly;
- location and time aggregations are accurate;
- alerts correspond to defined rules;
- dashboard values match database records;
- reports can be generated;
- the complete workflow can be demonstrated end-to-end.

---

# 28. Demonstration Scenario

For the final presentation, create synthetic data for approximately:

- 100–500 drivers;
- 100–500 vehicles;
- 1,000+ violations;
- multiple locations;
- multiple violation types;
- multiple months.

Then demonstrate:

```text
1. Officer logs in
        ↓
2. Searches a vehicle
        ↓
3. Views driver history
        ↓
4. Adds a new violation
        ↓
5. System recalculates risk
        ↓
6. Pattern is detected
        ↓
7. Alert is generated
        ↓
8. Dashboard updates
        ↓
9. Officer opens hotspot analytics
        ↓
10. Officer generates report
```

This gives the evaluator a clear end-to-end story.

---

# 29. Final Project Differentiation

The strongest way to describe the project is:

> **This project does not attempt to replace India's existing digital challan infrastructure. Instead, it demonstrates an explainable behavioral analytics layer that can sit on top of traffic-violation records to identify repeated patterns, quantify configurable risk factors, analyze spatial and temporal trends, track improvement, and support human decision-making.**

The central transformation is:

```text
                 TRADITIONAL VIEW

Violation → Fine → Record

                         ↓

                 PROPOSED VIEW

Violation
    ↓
History
    ↓
Analysis
    ↓
Risk Factors
    ↓
Patterns
    ↓
Spatial + Temporal Insights
    ↓
Alerts
    ↓
Human Review
    ↓
Improvement Tracking
```

---

# 30. Research References

**[1] Ministry of Road Transport & Highways / National Informatics Centre — eChallan Digital Traffic/Transport Enforcement Solution.** Official platform and current service information.

**[2] Ministry of Road Transport & Highways / National Informatics Centre — eChallan User Manual.** Documents GPS/location logging, Vahan/Sarathi lookup, challan history, automatic penalty calculation, evidence, alerts, officer search and related workflows.

**[3] Ministry of Road Transport & Highways — Road Accidents in India 2023.** Official accident statistics, including traffic-rule-violation classifications and over-speeding statistics.

**[4] Transport Policy (2026) — “Reconsidering the relationships between different types of traffic violations and traffic accidents involving the same driver from multivariate joint survival models.”** Research treating violations as recurrent events and examining their relationship with crashes.

**[5] Case Studies on Transport Policy (2025) — “Can AI-powered traffic enforcement system augment road safety by influencing driver behavior and perception?”** Study of AI-powered traffic enforcement in Kerala, including spatial-temporal violation behavior and driver segments.

### Source URLs

- https://parivahan.gov.in/echallan/
- https://parivahan.gov.in/sites/default/files/FAQDOCS/Echallan/echallan-user-manual.pdf
- https://morth.nic.in/sites/default/files/Road-Accident-in-India-2023-Publications.pdf
- https://www.sciencedirect.com/science/article/abs/pii/S0967070X2500469X
- https://www.sciencedirect.com/science/article/pii/S2213624X25002032

---

# 31. Final One-Paragraph Description

The **Smart Traffic Violation Prevention & Management System** is a Java and MySQL-based decision-support application that manages drivers, vehicles, violations and fines while adding an explainable analytics layer. Whenever a violation is recorded, the system updates the driver's history, analyzes violation frequency, recency, repetition and severity, calculates a configurable risk score, detects repeated patterns, analyzes violation hotspots and peak periods, generates evidence-based alerts, and tracks changes over time. The system is designed to support authorized traffic personnel rather than automatically punish drivers, and its main academic contribution is demonstrating how ordinary violation records can be transformed into transparent behavioral and traffic-pattern insights using Java, OOP, JDBC, database design, collections, algorithms, JavaFX and reporting.

---

## Important Positioning Note

For a project presentation, avoid saying:

> “Existing traffic systems only record fines and do not have analytics.”

A more accurate statement is:

> **“Existing digital enforcement systems already provide substantial record management, dashboards, history, location and reporting capabilities. Our project focuses specifically on demonstrating an explainable, configurable behavioral-risk and prevention-support analytics layer as a Java academic prototype.”**

---

# 32. Revision History

## v1.1 — October 2026 (current)

This revision records what changed in the repository after v1.0 was published.
The product scope — FR-01 … FR-13, the nine screens, and the deterministic analytics
rules in §15–§19 — is unchanged. The changes are packaging, the reference server
implementations, and **one new collections-based feature** (alert prioritization).

| Change | Where | Summary |
|---|---|---|
| Smart alert prioritization | `backend/RoadwiseServer.java`, `/api/alerts` | Heap + Comparator scoring; response is priority-first (§32.1) |
| Backend folder | `backend/` | `shared/` folded into `backend/`; `RoadwiseServer.java` moved in (§32.2) |
| Native C backend | `backend/RoadwiseServer.c` | HTTP + SQLite port of the Java server (§32.3) |
| Web console wiring | `web/next.config.mjs`, `web/tsconfig.json` | repo-root Turbopack root; `@shared/*` → `@backend/*` (§32.4) |
| Legacy cleanup | `mobile/`, `problemui/`, `Logo/` | previous-project leftovers removed (§32.5) |
| Persistence | `backend/traffic.db` | reference servers run on SQLite; MySQL/JDBC stays the desktop target (§32.6) |
| Documentation | `README.md` | layout updated and §5.6 added (§32.7) |

### 32.1 Smart Alert Prioritization (new — Heap / PriorityQueue / Comparator)

`/api/alerts` no longer returns alerts in raw insertion order. Every alert is scored
0–100 and the most important ones are served first:

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
informational hotspot alert. The response rows gain `priority`, `priority_label`,
`risk_score` and `urgency`. This is the collections requirement (Heap / PriorityQueue
/ Comparator) expressed in the product, and it complements the explainable-alert rules
in §18. (The C backend implements the same max-heap with an explicit comparator — §32.3.)

### 32.2 Repository layout — `shared/` folded into `backend/`

| Before (v1.0) | After (v1.1) |
|---|---|
| `shared/schema.sql` | `backend/schema.sql` |
| `shared/types.ts` | `backend/types.ts` |
| `web/src/lib/trafficData.ts` (dataset) | `backend/trafficData.ts`; `web/src/lib/trafficData.ts` now re-exports it |
| `RoadwiseServer.java` (repo root) | `backend/RoadwiseServer.java` |

### 32.3 New native C backend — `backend/RoadwiseServer.c`

A direct C port of `RoadwiseServer.java` that mirrors its API: a native HTTP/1.1 server
on BSD-style sockets (no framework), SQLite (`traffic.db`) through the bundled
amalgamation, and PBKDF2-HMAC-SHA256 password hashing with an embedded SHA-256 (no
OpenSSL). It implements the same prioritized `/api/alerts` heap. Build:

```bash
gcc -O2 -std=c99 RoadwiseServer.c sqlite/sqlite3.c -o RoadwiseServer.exe -lws2_32 -lm
```

### 32.4 Web console wiring

- `web/next.config.mjs` — Turbopack's workspace root is now the repository root, because
  the console imports the fallback dataset from the sibling `backend/` folder.
- `web/tsconfig.json` — the `@shared/*` path alias was replaced with `@backend/*`.
- `web/src/types.ts` and `web/src/lib/trafficAnalytics.ts` — comments now point at
  `backend/schema.sql`.

### 32.5 Legacy directories removed

`mobile/` (an old React Native app), `problemui/` and `Logo/` were removed; they
belonged to a previous project and are not part of this build.

### 32.6 Reference server persistence

The Java and C reference servers persist to **SQLite** (`traffic.db`) so they can run
without a database service. The **MySQL 8 + JDBC** design in §12–§14 remains the
delivery target of the desktop application; the schema in `backend/schema.sql` stays
the single source of truth.

### 32.7 README

`README.md` was updated to match this revision: the new `backend/` layout, the
`@backend` import path, and a new §5.6 *Smart alert prioritization
(Heap / PriorityQueue / Comparator)*.

### 32.8 Working-tree note

`backend/schema.sql` is tracked in the repository index but is currently **absent from
the working tree** (`git status` shows it as deleted after the `shared/ → backend/`
move). Restore it before applying the MySQL schema, since §14 and the README still
reference it.
