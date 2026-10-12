/**
 * The synthetic fallback dataset (and its reference configuration) now lives
 * in the backend workspace: `backend/trafficData.ts`.
 *
 * This module re-exports it so the console's existing `@/lib/trafficData`
 * imports keep resolving without touching every call site.
 */
export * from '../../../backend/trafficData';
