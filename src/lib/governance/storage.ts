import type { GovernanceEvent } from "@/lib/governance/types";

export const GOVERNANCE_COLLECTIONS = {
  EVENTS: "governanceEvents",
  COUNTERS: "governanceCounters",
  ALERTS: "governanceAlerts",
  SNAPSHOTS: "governanceSnapshots",
  WORKFLOW_STATE: "governanceWorkflowState",
} as const;

export const GOVERNANCE_RETENTION = {
  EVENT_RETENTION_DAYS: 14,
  ALERT_RETENTION_DAYS: 30,
  SNAPSHOT_RETENTION_DAYS: 14,
  PRUNE_BATCH_SIZE: 10,
  PRUNE_THROTTLE_MS: 1000 * 60 * 15,
} as const;

const PERSISTED_EVENT_CATEGORIES = new Set<GovernanceEvent["category"]>([
  "divergence_observation",
  "analytics_summary",
  "governance_alert",
]);

const PERSISTED_EVENT_TYPES = new Set<string>([
  "canonical_overwrite_after_legacy_write_observed",
  "stale_state_compensation_observed",
  "deals_get_stale_state_compensation_observed",
  "deals_get_canonical_correction_observed",
  "inventory_sync_started",
  "inventory_sync_succeeded",
  "inventory_sync_failed",
  "inventory_vehicle_created",
  "inventory_vehicle_updated",
]);

export function shouldPersistGovernanceEvent(event: GovernanceEvent): boolean {
  return PERSISTED_EVENT_CATEGORIES.has(event.category) || PERSISTED_EVENT_TYPES.has(event.eventType);
}

export function encodeFirestoreId(value: string): string {
  return encodeURIComponent(value);
}

export function createHourlySnapshotId(occurredAt: string): string {
  const bucket = new Date(occurredAt);
  bucket.setMinutes(0, 0, 0);
  return bucket.toISOString().replace(/[-:.]/g, "").slice(0, 13);
}
