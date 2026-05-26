import { FieldValue } from "firebase-admin/firestore";
import { ROUTE_CLASSIFICATIONS, type RouteClassification } from "@/lib/governance/classification";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import type { GovernanceAlert } from "@/lib/governance/alerts";
import type { GovernanceVisibilitySnapshot } from "@/lib/governance/visibility";
import {
  GOVERNANCE_COLLECTIONS,
  GOVERNANCE_RETENTION,
  createHourlySnapshotId,
  encodeFirestoreId,
  shouldPersistGovernanceEvent,
} from "@/lib/governance/storage";
import type { GovernanceEvent } from "@/lib/governance/types";

const lastPrunedAtByCollection = new Map<string, number>();

function nowIso(): string {
  return new Date().toISOString();
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function compactEventDocument(event: GovernanceEvent) {
  return {
    eventId: event.eventId,
    eventVersion: event.eventVersion,
    occurredAt: event.occurredAt,
    category: event.category,
    eventType: event.eventType,
    correlation: {
      correlationId: event.correlation.correlationId,
      requestId: event.correlation.requestId,
    },
    source: {
      sourceType: event.source.sourceType,
      sourceName: event.source.sourceName,
      routePath: event.source.routePath ?? null,
      method: event.source.method ?? null,
      sourceClassification: event.source.sourceClassification ?? null,
    },
    entity: {
      entityType: event.entity?.entityType ?? null,
      entityId: event.entity?.entityId ?? null,
      contractorId: event.entity?.contractorId ?? null,
      dealId: event.entity?.dealId ?? null,
      documentType: event.entity?.documentType ?? null,
    },
    mutation: {
      mutationType: event.mutation?.mutationType ?? null,
      mutatedFields: event.mutation?.mutatedFields ?? [],
    },
    governance: {
      routeClassification: event.governance.routeClassification ?? null,
      sourceClassification: event.governance.sourceClassification ?? null,
      authorityClassification: event.governance.authorityClassification ?? null,
      latencyMs: event.governance.latencyMs ?? null,
      failOpen: event.governance.failOpen ?? true,
    },
    comparison: event.comparison
      ? {
          comparedFields: event.comparison.comparedFields ?? [],
          divergenceFields: event.comparison.divergenceFields ?? [],
          divergenceClassification: event.comparison.divergenceClassification ?? null,
          staleStateDetected: event.comparison.staleStateDetected ?? false,
          changedState: event.comparison.changedState ?? false,
        }
      : null,
    analytics: event.analytics
      ? {
          counterName: event.analytics.counterName ?? null,
          counterValue: event.analytics.counterValue ?? null,
          eventCategory: event.analytics.eventCategory ?? null,
          summaryType: event.analytics.summaryType ?? null,
          aggregationKey: event.analytics.aggregationKey ?? null,
          aggregatedAt: event.analytics.aggregatedAt ?? null,
        }
      : null,
    persistedAt: nowIso(),
  };
}

function toRouteClassification(value: string | null | undefined): RouteClassification | null {
  if (
    value === ROUTE_CLASSIFICATIONS.CANONICAL ||
    value === ROUTE_CLASSIFICATIONS.LEGACY ||
    value === ROUTE_CLASSIFICATIONS.HYBRID ||
    value === ROUTE_CLASSIFICATIONS.OBSERVER_ONLY
  ) {
    return value;
  }

  return null;
}

async function pruneCollectionIfNeeded(params: {
  collectionName: string;
  dateField: string;
  cutoffIso: string;
}) {
  const lastPrunedAt = lastPrunedAtByCollection.get(params.collectionName) ?? 0;
  if (Date.now() - lastPrunedAt < GOVERNANCE_RETENTION.PRUNE_THROTTLE_MS) {
    return;
  }

  lastPrunedAtByCollection.set(params.collectionName, Date.now());

  const db = getFirebaseAdmin();
  const staleDocs = await db
    .collection(params.collectionName)
    .where(params.dateField, "<", params.cutoffIso)
    .limit(GOVERNANCE_RETENTION.PRUNE_BATCH_SIZE)
    .get();

  if (staleDocs.empty) {
    return;
  }

  const batch = db.batch();
  for (const doc of staleDocs.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
}

export async function persistGovernanceEvent(event: GovernanceEvent): Promise<void> {
  if (!shouldPersistGovernanceEvent(event)) {
    return;
  }

  const db = getFirebaseAdmin();
  await db
    .collection(GOVERNANCE_COLLECTIONS.EVENTS)
    .doc(encodeFirestoreId(event.eventId))
    .set(compactEventDocument(event), { merge: true });

  await pruneCollectionIfNeeded({
    collectionName: GOVERNANCE_COLLECTIONS.EVENTS,
    dateField: "persistedAt",
    cutoffIso: daysAgoIso(GOVERNANCE_RETENTION.EVENT_RETENTION_DAYS),
  });
}

export async function persistGovernanceCounter(event: GovernanceEvent): Promise<void> {
  if (event.category !== "analytics_summary" || !event.analytics?.counterName || !event.analytics.aggregationKey) {
    return;
  }

  const db = getFirebaseAdmin();
  await db
    .collection(GOVERNANCE_COLLECTIONS.COUNTERS)
    .doc(encodeFirestoreId(event.analytics.aggregationKey))
    .set(
      {
        counterName: event.analytics.counterName,
        aggregationKey: event.analytics.aggregationKey,
        counterValue: event.analytics.counterValue ?? 0,
        eventCategory: event.analytics.eventCategory ?? null,
        summaryType: event.analytics.summaryType ?? null,
        contractorId: event.entity?.contractorId ?? null,
        dealId: event.entity?.dealId ?? null,
        sourceName: event.source.sourceName,
        routePath: event.source.routePath ?? null,
        routeClassification:
          event.governance.routeClassification ?? event.source.sourceClassification ?? null,
        sourceClassification: event.governance.sourceClassification ?? null,
        updatedAt: event.analytics.aggregatedAt ?? event.occurredAt,
        samples: FieldValue.increment(1),
      },
      { merge: true }
    );
}

function toGovernanceAlertEvent(alert: GovernanceAlert): GovernanceEvent {
  const routeClassification = toRouteClassification(alert.routeClassification);

  return {
    eventId: crypto.randomUUID(),
    eventVersion: "v1",
    occurredAt: alert.observedAt,
    category: "governance_alert",
    eventType: "governance_alert_generated",
    correlation: {
      correlationId: `governance-alert:${alert.id}`,
      requestId: `governance-alert:${alert.id}`,
    },
    source: {
      sourceType: "service",
      sourceName: "governance_alerts",
      routePath: alert.routePath ?? null,
      method: null,
      sourceClassification: routeClassification,
    },
    entity: {
      entityType: alert.dealId ? "deal" : alert.contractorId ? "contractor" : "telemetry",
      entityId: alert.dealId ?? alert.contractorId ?? alert.id,
      contractorId: alert.contractorId ?? null,
      dealId: alert.dealId ?? null,
    },
    governance: {
      routeClassification,
      sourceClassification: routeClassification,
      failOpen: true,
    },
    analytics: {
      counterName: alert.alertType,
      counterValue: 1,
      eventCategory: "governance_alert",
      summaryType: "activity",
      aggregationKey: alert.id,
      aggregatedAt: alert.observedAt,
    },
  };
}

export async function persistGovernanceAlert(alert: GovernanceAlert): Promise<void> {
  const db = getFirebaseAdmin();
  await db
    .collection(GOVERNANCE_COLLECTIONS.ALERTS)
    .doc(encodeFirestoreId(alert.id))
    .set(
      {
        alertType: alert.alertType,
        severity: alert.severity,
        title: alert.title,
        summary: alert.summary,
        sourceName: alert.sourceName ?? null,
        routePath: alert.routePath ?? null,
        contractorId: alert.contractorId ?? null,
        dealId: alert.dealId ?? null,
        routeClassification: alert.routeClassification ?? null,
        metrics: alert.metrics,
        latestObservedAt: alert.observedAt,
        visibilityState: "visible",
        occurrences: FieldValue.increment(1),
        updatedAt: nowIso(),
      },
      { merge: true }
    );

  await persistGovernanceEvent(toGovernanceAlertEvent(alert));

  await pruneCollectionIfNeeded({
    collectionName: GOVERNANCE_COLLECTIONS.ALERTS,
    dateField: "updatedAt",
    cutoffIso: daysAgoIso(GOVERNANCE_RETENTION.ALERT_RETENTION_DAYS),
  });
}

export async function persistGovernanceSnapshot(
  snapshot: GovernanceVisibilitySnapshot,
  alerts: GovernanceAlert[]
): Promise<void> {
  const db = getFirebaseAdmin();
  const snapshotId = createHourlySnapshotId(snapshot.capturedAt);

  await db
    .collection(GOVERNANCE_COLLECTIONS.SNAPSHOTS)
    .doc(snapshotId)
    .set(
      {
        snapshotId,
        capturedAt: snapshot.capturedAt,
        canonicalActivityRatio: snapshot.canonicalActivityRatio,
        legacyActivityRatio: snapshot.legacyActivityRatio,
        routeRiskSummaries: snapshot.routeMetrics.slice(0, 5).map((route) => ({
          sourceName: route.sourceName,
          routePath: route.routePath,
          routeClassification: route.routeClassification,
          activityFrequency: route.activityFrequency,
          divergenceFrequency: route.divergenceFrequency,
          staleStateCompensationFrequency: route.staleStateCompensationFrequency,
          canonicalCorrectionFrequency: route.canonicalCorrectionFrequency,
        })),
        driftIndicators: snapshot.driftIndicators,
        kpis: snapshot.kpis.map((kpi) => ({
          label: kpi.label,
          value: kpi.value,
          tone: kpi.tone,
        })),
        alertSummary: alerts.slice(0, 6).map((alert) => ({
          alertType: alert.alertType,
          severity: alert.severity,
          sourceName: alert.sourceName ?? null,
          routePath: alert.routePath ?? null,
        })),
        alertCount: alerts.length,
        updatedAt: nowIso(),
        samples: FieldValue.increment(1),
      },
      { merge: true }
    );

  await pruneCollectionIfNeeded({
    collectionName: GOVERNANCE_COLLECTIONS.SNAPSHOTS,
    dateField: "updatedAt",
    cutoffIso: daysAgoIso(GOVERNANCE_RETENTION.SNAPSHOT_RETENTION_DAYS),
  });
}

export function persistGovernanceEmission(event: GovernanceEvent, analyticsEvents: GovernanceEvent[]): void {
  queueMicrotask(() => {
    void (async () => {
      try {
        const persistableEvents = [event, ...analyticsEvents];
        for (const candidate of persistableEvents) {
          await persistGovernanceEvent(candidate);
          await persistGovernanceCounter(candidate);
        }
      } catch (error) {
        console.warn("[governance_persistence_failed]", {
          reason: error instanceof Error ? error.message : "Unknown governance persistence failure",
          eventType: event.eventType,
          category: event.category,
        });
      }
    })();
  });
}

export function persistGovernanceVisibility(snapshot: GovernanceVisibilitySnapshot, alerts: GovernanceAlert[]): void {
  queueMicrotask(() => {
    void (async () => {
      try {
        await persistGovernanceSnapshot(snapshot, alerts);
        for (const alert of alerts) {
          await persistGovernanceAlert(alert);
        }
      } catch (error) {
        console.warn("[governance_visibility_persistence_failed]", {
          reason: error instanceof Error ? error.message : "Unknown governance visibility persistence failure",
          capturedAt: snapshot.capturedAt,
          alertCount: alerts.length,
        });
      }
    })();
  });
}
