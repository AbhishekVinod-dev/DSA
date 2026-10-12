'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  AlertStatus,
  Driver,
  Officer,
  PaymentStatus,
  Session,
  Severity,
  Vehicle,
  Violation,
  ViolationType,
} from '@/types';
import { calculateFine, generateSeedDataset } from '@/lib/trafficData';

/* ------------------------------------------------------------------ *
 * Console store
 *
 * A prototype of the Service + DAO layer. The JavaFX build keeps this
 * state in MySQL through JDBC; the web demonstration keeps it in
 * localStorage so a new violation immediately re-runs the whole
 * analytics pipeline the same way the desktop build would.
 * ------------------------------------------------------------------ */

/* The key carries a version suffix. Bump it whenever the seed shape changes,
 * so a reviewer with an older console state in localStorage is re-seeded from
 * the current generator instead of seeing stale records. */
const STORAGE_KEY = 'smarttraffic.console.v2';

interface PersistedState {
  violations: Violation[];
  drivers: Driver[];
  vehicles: Vehicle[];
  alertStatus: Record<string, AlertStatus>;
}

export interface NewViolationInput {
  driverId: string;
  vehicleId: string;
  violationType: ViolationType;
  location: string;
  violationDate: string;
  violationTime: string;
  severity: Severity;
  paymentStatus: PaymentStatus;
  evidenceReference?: string;
  officerId: string;
}

export interface NewDriverInput {
  name: string;
  licenseNumber: string;
  phone: string;
  address: string;
}

export interface NewVehicleInput {
  vehicleNumber: string;
  vehicleType: Vehicle['vehicleType'];
  model: string;
  driverId: string;
  registrationStatus: Vehicle['registrationStatus'];
}

interface ConsoleContextValue {
  ready: boolean;
  now: Date;
  officers: Officer[];
  drivers: Driver[];
  vehicles: Vehicle[];
  violations: Violation[];
  alertStatus: Record<string, AlertStatus>;
  vehicleById: Map<string, Vehicle>;
  driverById: Map<string, Driver>;
  violationsForDriver: (driverId: string) => Violation[];
  violationsForVehicle: (vehicleId: string) => Violation[];
  recordViolation: (input: NewViolationInput) => Violation;
  addDriver: (input: NewDriverInput) => Driver;
  addVehicle: (input: NewVehicleInput) => Vehicle;
  setAlertStatus: (alertId: string, status: AlertStatus) => void;
  resetDataset: () => void;
}

const ConsoleContext = createContext<ConsoleContextValue | null>(null);

function loadPersisted(): PersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!Array.isArray(parsed.violations) || !Array.isArray(parsed.drivers)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function ConsoleProvider({ children }: { children: React.ReactNode }) {
  const seed = useMemo(() => generateSeedDataset(), []);
  const [ready, setReady] = useState(false);
  const [violations, setViolations] = useState<Violation[]>(seed.violations);
  const [drivers, setDrivers] = useState<Driver[]>(seed.drivers);
  const [vehicles, setVehicles] = useState<Vehicle[]>(seed.vehicles);
  const [alertStatus, setAlertStatusMap] = useState<Record<string, AlertStatus>>({});

  /* Hydrate from localStorage once on the client. */
  useEffect(() => {
    const stored = loadPersisted();
    if (stored) {
      setViolations(stored.violations);
      setDrivers(stored.drivers);
      setVehicles(stored.vehicles ?? []);
      setAlertStatusMap(stored.alertStatus ?? {});
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ violations, drivers, vehicles, alertStatus } satisfies PersistedState),
      );
    } catch {
      /* Quota or private mode — the console still works in memory. */
    }
  }, [ready, violations, drivers, vehicles, alertStatus]);

  const recordViolation = useCallback((input: NewViolationInput): Violation => {
    const record: Violation = {
      violationId: `VL-NEW-${Date.now().toString(36).toUpperCase()}`,
      driverId: input.driverId,
      vehicleId: input.vehicleId,
      officerId: input.officerId,
      violationType: input.violationType,
      location: input.location,
      violationDate: input.violationDate,
      violationTime: input.violationTime,
      severity: input.severity,
      fineAmount: calculateFine(input.violationType, input.severity),
      paymentStatus: input.paymentStatus,
      evidenceReference: input.evidenceReference?.trim() || undefined,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setViolations((prev) => [record, ...prev]);
    return record;
  }, []);

  const addDriver = useCallback((input: NewDriverInput): Driver => {
    const numeric = drivers.reduce((max, d) => Math.max(max, Number(d.driverId.replace(/\D/g, '')) || 0), 1000);
    const driver: Driver = {
      driverId: `D${numeric + 1}`,
      name: input.name.trim(),
      licenseNumber: input.licenseNumber.trim(),
      phone: input.phone.trim(),
      address: input.address.trim(),
      city: 'Chennai',
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setDrivers((prev) => [driver, ...prev]);
    return driver;
  }, [drivers]);

  const addVehicle = useCallback((input: NewVehicleInput): Vehicle => {
    const numeric = vehicles.reduce((max, v) => Math.max(max, Number(v.vehicleId.replace(/\D/g, '')) || 0), 5000);
    const vehicle: Vehicle = {
      vehicleId: `V${numeric + 1}`,
      vehicleNumber: input.vehicleNumber.trim().toUpperCase(),
      vehicleType: input.vehicleType,
      model: input.model.trim(),
      driverId: input.driverId,
      registrationStatus: input.registrationStatus,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    setVehicles((prev) => [vehicle, ...prev]);
    return vehicle;
  }, [vehicles]);

  const setAlertStatus = useCallback((alertId: string, status: AlertStatus) => {
    setAlertStatusMap((prev) => ({ ...prev, [alertId]: status }));
  }, []);

  const resetDataset = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const fresh = generateSeedDataset();
    setViolations(fresh.violations);
    setDrivers(fresh.drivers);
    setVehicles(fresh.vehicles);
    setAlertStatusMap({});
  }, []);

  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.vehicleId, v])), [vehicles]);
  const driverById = useMemo(() => new Map(drivers.map((d) => [d.driverId, d])), [drivers]);

  const violationsByDriver = useMemo(() => {
    const map = new Map<string, Violation[]>();
    violations.forEach((v) => {
      const list = map.get(v.driverId) ?? [];
      list.push(v);
      map.set(v.driverId, list);
    });
    map.forEach((list) => list.sort((a, b) => (a.violationDate < b.violationDate ? 1 : -1)));
    return map;
  }, [violations]);

  const violationsByVehicle = useMemo(() => {
    const map = new Map<string, Violation[]>();
    violations.forEach((v) => {
      const list = map.get(v.vehicleId) ?? [];
      list.push(v);
      map.set(v.vehicleId, list);
    });
    return map;
  }, [violations]);

  const value = useMemo<ConsoleContextValue>(
    () => ({
      ready,
      now: new Date(),
      officers: seed.officers,
      drivers,
      vehicles,
      violations,
      alertStatus,
      vehicleById,
      driverById,
      violationsForDriver: (driverId: string) => violationsByDriver.get(driverId) ?? [],
      violationsForVehicle: (vehicleId: string) => violationsByVehicle.get(vehicleId) ?? [],
      recordViolation,
      addDriver,
      addVehicle,
      setAlertStatus,
      resetDataset,
    }),
    [
      ready,
      seed.officers,
      drivers,
      vehicles,
      violations,
      alertStatus,
      vehicleById,
      driverById,
      violationsByDriver,
      violationsByVehicle,
      recordViolation,
      addDriver,
      addVehicle,
      setAlertStatus,
      resetDataset,
    ],
  );

  return <ConsoleContext.Provider value={value}>{children}</ConsoleContext.Provider>;
}

export function useConsole(): ConsoleContextValue {
  const ctx = useContext(ConsoleContext);
  if (!ctx) throw new Error('useConsole must be used inside <ConsoleProvider>');
  return ctx;
}

/* ------------------------------------------------------------------ *
 * FR-01 — session handling (mock of AuthService)
 * ------------------------------------------------------------------ */

const SESSION_KEY = 'smarttraffic.session.v1';

export const readSession = (): Session | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
};

export const writeSession = (session: Session | null): void => {
  if (typeof window === 'undefined') return;
  try {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
};
