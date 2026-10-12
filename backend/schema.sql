-- =====================================================================
-- Smart Traffic Violation Prevention & Management System
-- MySQL 8 schema (PRD section 14)
--
-- Design notes
--   * Every table is written by a DAO through plain JDBC; no ORM.
--   * Enum-like columns use VARCHAR + CHECK so the values stay readable
--     in a viva and can be extended without an ALTER on an ENUM column.
--   * fine_amount, the risk weights, the severity weights and the
--     hotspot threshold are PROJECT PARAMETERS, not statutory values.
--     They live in app_config so an administrator can retune them.
--   * The system never stores a penalty decision. It stores records,
--     derived scores and review alerts only.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS smart_traffic_analytics
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE smart_traffic_analytics;

-- ---------------------------------------------------------------------
-- users ΓÇö FR-01 authentication and role based access
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(20)  NOT NULL,
  name          VARCHAR(120) NOT NULL,
  username      VARCHAR(60)  NOT NULL,
  -- SHA-256 (or BCrypt) hash. Plain text passwords are never stored.
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL,
  active        BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    DATE         NOT NULL,
  CONSTRAINT pk_users PRIMARY KEY (id),
  CONSTRAINT uq_users_username UNIQUE (username),
  CONSTRAINT chk_users_role CHECK (role IN ('ADMIN', 'OFFICER', 'ANALYST'))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- officers ΓÇö FR-04/FR-05 the officer who recorded a violation
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS officers (
  officer_id VARCHAR(20)  NOT NULL,
  user_id    VARCHAR(20)  NULL,
  name       VARCHAR(120) NOT NULL,
  rank       VARCHAR(60)  NOT NULL,
  beat       VARCHAR(120) NOT NULL,
  created_at DATE         NOT NULL,
  CONSTRAINT pk_officers PRIMARY KEY (officer_id),
  CONSTRAINT fk_officers_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- drivers ΓÇö FR-02
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drivers (
  driver_id      VARCHAR(20)  NOT NULL,
  name           VARCHAR(120) NOT NULL,
  license_number VARCHAR(40)  NOT NULL,
  phone          VARCHAR(20)  NOT NULL,
  address        VARCHAR(255) NOT NULL,
  city           VARCHAR(80)  NOT NULL DEFAULT 'Chennai',
  created_at     DATE         NOT NULL,
  CONSTRAINT pk_drivers PRIMARY KEY (driver_id),
  CONSTRAINT uq_drivers_license UNIQUE (license_number)
) ENGINE = InnoDB;

CREATE INDEX idx_drivers_name ON drivers (name);

-- ---------------------------------------------------------------------
-- vehicles ΓÇö FR-03
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicles (
  vehicle_id          VARCHAR(20)  NOT NULL,
  vehicle_number      VARCHAR(20)  NOT NULL,
  vehicle_type        VARCHAR(20)  NOT NULL,
  model               VARCHAR(80)  NOT NULL,
  driver_id           VARCHAR(20)  NOT NULL,
  registration_status VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
  created_at          DATE         NOT NULL,
  CONSTRAINT pk_vehicles PRIMARY KEY (vehicle_id),
  CONSTRAINT uq_vehicles_number UNIQUE (vehicle_number),
  CONSTRAINT fk_vehicles_driver FOREIGN KEY (driver_id) REFERENCES drivers (driver_id) ON DELETE CASCADE,
  CONSTRAINT chk_vehicles_type
    CHECK (vehicle_type IN ('CAR', 'TWO_WHEELER', 'SUV', 'TRUCK', 'BUS', 'AUTO_RICKSHAW')),
  CONSTRAINT chk_vehicles_status CHECK (registration_status IN ('ACTIVE', 'EXPIRED', 'SOLD'))
) ENGINE = InnoDB;

CREATE INDEX idx_vehicles_driver ON vehicles (driver_id);

-- ---------------------------------------------------------------------
-- violations ΓÇö FR-04 / FR-05
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS violations (
  violation_id      VARCHAR(24)  NOT NULL,
  driver_id         VARCHAR(20)  NOT NULL,
  vehicle_id        VARCHAR(20)  NOT NULL,
  officer_id        VARCHAR(20)  NOT NULL,
  violation_type    VARCHAR(30)  NOT NULL,
  location          VARCHAR(160) NOT NULL,
  violation_date    DATE         NOT NULL,
  violation_time    TIME         NOT NULL,
  severity          VARCHAR(10)  NOT NULL,
  fine_amount       INT          NOT NULL,
  payment_status    VARCHAR(15)  NOT NULL DEFAULT 'PENDING',
  evidence_reference VARCHAR(160) NULL,
  created_at        DATE         NOT NULL,
  CONSTRAINT pk_violations PRIMARY KEY (violation_id),
  CONSTRAINT fk_violations_driver FOREIGN KEY (driver_id) REFERENCES drivers (driver_id) ON DELETE CASCADE,
  CONSTRAINT fk_violations_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles (vehicle_id) ON DELETE CASCADE,
  CONSTRAINT fk_violations_officer FOREIGN KEY (officer_id) REFERENCES officers (officer_id),
  CONSTRAINT chk_violations_type
    CHECK (violation_type IN
      ('OVERSPEEDING', 'SIGNAL_JUMP', 'WRONG_LANE', 'HELMET_SEATBELT',
       'DRUNK_DRIVING', 'UNAUTHORIZED_PARKING', 'MOBILE_PHONE_USE', 'DOCUMENT_VIOLATION')),
  CONSTRAINT chk_violations_severity CHECK (severity IN ('MINOR', 'MEDIUM', 'MAJOR', 'SEVERE')),
  CONSTRAINT chk_violations_payment CHECK (payment_status IN ('PENDING', 'PAID', 'CHALLENGED')),
  CONSTRAINT chk_violations_fine CHECK (fine_amount >= 0)
) ENGINE = InnoDB;

-- Analytics reads almost always filter or group by these columns.
CREATE INDEX idx_violations_driver_date ON violations (driver_id, violation_date);
CREATE INDEX idx_violations_location     ON violations (location);
CREATE INDEX idx_violations_type         ON violations (violation_type, violation_date);
CREATE INDEX idx_violations_date         ON violations (violation_date);

-- ---------------------------------------------------------------------
-- risk_analysis ΓÇö FR-06 cached result of the weighted risk model
--   Risk Score = 30% frequency + 25% recent + 25% repeat + 20% severity
--   Each factor is normalised to 0-100 before the weighted sum.
--   The weights, caps, windows and bands live in app_config below, so an
--   administrator can retune the model without touching this table.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS risk_analysis (
  analysis_id       VARCHAR(24)  NOT NULL,
  driver_id         VARCHAR(20)  NOT NULL,
  risk_score        DECIMAL(5, 2) NOT NULL,
  risk_level        VARCHAR(10)  NOT NULL,
  frequency_factor  DECIMAL(5, 2) NOT NULL,
  recent_factor     DECIMAL(5, 2) NOT NULL,
  repeat_factor     DECIMAL(5, 2) NOT NULL,
  severity_factor   DECIMAL(5, 2) NOT NULL,
  violation_count   INT          NOT NULL DEFAULT 0,
  last_violation_date DATE       NULL,
  analysis_date     DATETIME     NOT NULL,
  CONSTRAINT pk_risk_analysis PRIMARY KEY (analysis_id),
  CONSTRAINT fk_risk_driver FOREIGN KEY (driver_id) REFERENCES drivers (driver_id) ON DELETE CASCADE,
  CONSTRAINT chk_risk_level CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  CONSTRAINT chk_risk_score CHECK (risk_score >= 0 AND risk_score <= 100)
) ENGINE = InnoDB;

CREATE INDEX idx_risk_driver ON risk_analysis (driver_id, analysis_date);
CREATE INDEX idx_risk_level  ON risk_analysis (risk_level);

-- ---------------------------------------------------------------------
-- alerts ΓÇö FR-10 evidence backed review alerts
--   Status is a workflow marker only. The system never executes an action.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
  alert_id        VARCHAR(24)  NOT NULL,
  driver_id       VARCHAR(20)  NULL,
  location        VARCHAR(160) NULL,
  alert_type      VARCHAR(30)  NOT NULL,
  title           VARCHAR(160) NOT NULL,
  message         VARCHAR(400) NOT NULL,
  reasons         TEXT         NOT NULL,
  recommendation  VARCHAR(400) NOT NULL,
  severity        VARCHAR(10)  NOT NULL,
  status          VARCHAR(15)  NOT NULL DEFAULT 'NEW',
  created_at      DATETIME     NOT NULL,
  CONSTRAINT pk_alerts PRIMARY KEY (alert_id),
  CONSTRAINT fk_alert_driver FOREIGN KEY (driver_id) REFERENCES drivers (driver_id) ON DELETE CASCADE,
  CONSTRAINT chk_alert_type CHECK (alert_type IN
    ('REPEATED_PATTERN', 'FREQUENCY_INCREASE', 'HIGH_RISK', 'LOCATION_HOTSPOT', 'IMPROVEMENT_TREND')),
  CONSTRAINT chk_alert_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
  CONSTRAINT chk_alert_status CHECK (status IN ('NEW', 'ACKNOWLEDGED', 'RESOLVED'))
) ENGINE = InnoDB;

CREATE INDEX idx_alerts_status   ON alerts (status, severity);
CREATE INDEX idx_alerts_driver   ON alerts (driver_id, created_at);
CREATE INDEX idx_alerts_location ON alerts (location);

-- ---------------------------------------------------------------------
-- app_config ΓÇö configurable project parameters (FR-06, FR-08, FR-12)
--   The prototype seeds every value; an administrator may retune them.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_config (
  config_key   VARCHAR(60) NOT NULL,
  config_value VARCHAR(80) NOT NULL,
  description  VARCHAR(255) NOT NULL,
  updated_at   DATETIME    NOT NULL,
  CONSTRAINT pk_app_config PRIMARY KEY (config_key)
) ENGINE = InnoDB;

INSERT IGNORE INTO app_config (config_key, config_value, description, updated_at) VALUES
  ('risk.weight.frequency',  '0.30', 'Weight of the violation frequency factor',      NOW()),
  ('risk.weight.recent',     '0.25', 'Weight of the recent activity factor',          NOW()),
  ('risk.weight.repeat',     '0.25', 'Weight of the repeat violation rate factor',    NOW()),
  ('risk.weight.severity',   '0.20', 'Weight of the severity factor',                NOW()),
  ('risk.window.days',       '365',  'Window used to normalise violation frequency', NOW()),
  ('risk.frequency.cap',     '14',   'Violations inside the window that score 100',  NOW()),
  ('risk.recent.window.days','90',   'Window used for recent activity',               NOW()),
  ('risk.recent.cap',        '5',    'Recent violations that saturate the factor',   NOW()),
  ('risk.recency.decay.days','180',  'E-folding time of the recency decay',           NOW()),
  ('risk.band.medium',       '31',   'Lower bound of the MEDIUM band',               NOW()),
  ('risk.band.high',         '61',   'Lower bound of the HIGH band',                 NOW()),
  ('risk.band.critical',     '81',   'Lower bound of the CRITICAL band',             NOW()),
  ('severity.weight.minor',  '25',   'Severity weight used by the severity factor',  NOW()),
  ('severity.weight.medium', '50',   'Severity weight used by the severity factor',  NOW()),
  ('severity.weight.major',  '75',   'Severity weight used by the severity factor',  NOW()),
  ('severity.weight.severe', '100',  'Severity weight used by the severity factor',  NOW()),
  ('hotspot.threshold',      '130',  'Recorded count at which a location is flagged', NOW()),
  ('pattern.repeat.count',   '3',    'Same offence count inside the window for FR-07',NOW()),
  ('pattern.repeat.days',    '30',   'Window used by the repeated pattern rule',     NOW());

-- ---------------------------------------------------------------------
-- Officer (admin | officer | analyst) accounts for the prototype.
-- The hash below is a demo placeholder ΓÇö replace it before any real use.
-- ---------------------------------------------------------------------
INSERT IGNORE INTO users (id, name, username, password_hash, role, active, created_at) VALUES
  ('USR-001', 'R. Balakrishnan',   'admin',   'demo-admin-hash',   'ADMIN',   TRUE, '2026-01-04'),
  ('USR-002', 'S. Meenakshi',      'officer', 'demo-officer-hash', 'OFFICER', TRUE, '2026-01-04'),
  ('USR-003', 'K. Ramesh',         'analyst', 'demo-analyst-hash', 'ANALYST', TRUE, '2026-01-11');