import type { GovernanceCounterSnapshot } from "@/lib/governance/counters";
import { incrementGovernanceCounter } from "@/lib/governance/counters";
import type { GovernanceEvent, GovernanceEventCategory } from "@/lib/governance/types";

const SUMMARY_EVENT_TYPES = new Set([
  "governance_activity_summary",
  "governance_divergence_summary",
  "governance_correction_summary",
  "governance_route_activity_summary",
]);

const COUNTER_NAMES = {
  STALE_STATE_COMPENSATION_FREQUENCY: "stale_state_compensation_frequency",
  LEGACY_MUTATION_FREQUENCY: "legacy_mutation_frequency",
  CANONICAL_CORRECTION_FREQUENCY: "canonical_correction_frequency",
  NOOP_RECOMPUTE_FREQUENCY: "noop_recompute_frequency",
  DIVERGENCE_FREQUENCY: "divergence_frequency",
  ROUTE_LEVEL_GOVERNANCE_ACTIVITY: "route_level_governance_activity",
} as const;

function isAnalyticsSummaryEvent(event: GovernanceEvent): boolean {
  return event.category === "analytics_summary" || SUMMARY_EVENT_TYPES.has(event.eventType);
}

function makeSummaryEvent(params: {
  sourceEvent: GovernanceEvent;
  eventType:
    | "governance_activity_summary"
    | "governance_divergence_summary"
    | "governance_correction_summary"
    | "governance_route_activity_summary";
  summaryType: "activity" | "divergence" | "correction" | "route_activity";
  snapshot: GovernanceCounterSnapshot;
}): GovernanceEvent {
  const dealId =
    params.sourceEvent.entity?.dealId ??
    (params.sourceEvent.entity?.entityType === "deal" ? params.sourceEvent.entity.entityId ?? null : null);

  return {
    eventId: crypto.randomUUID(),
    eventVersion: "v1",
    occurredAt: params.snapshot.aggregatedAt,
    category: "analytics_summary",
    eventType: params.eventType,
    correlation: {
      correlationId: params.sourceEvent.correlation.correlationId,
      requestId: params.sourceEvent.correlation.requestId,
    },
    source: {
      sourceType: params.sourceEvent.source.sourceType,
      sourceName: params.sourceEvent.source.sourceName,
      routePath: params.sourceEvent.source.routePath ?? null,
      method: params.sourceEvent.source.method ?? null,
      sourceClassification: params.sourceEvent.source.sourceClassification ?? null,
    },
    entity: {
      entityType: params.sourceEvent.entity?.entityType ?? null,
      entityId: params.sourceEvent.entity?.entityId ?? null,
      contractorId: params.sourceEvent.entity?.contractorId ?? null,
      dealId,
      documentType: params.sourceEvent.entity?.documentType ?? null,
    },
    governance: {
      routeClassification:
        params.sourceEvent.governance.routeClassification ??
        params.sourceEvent.source.sourceClassification ??
        null,
      sourceClassification: params.sourceEvent.governance.sourceClassification ?? null,
      authorityClassification: params.sourceEvent.governance.authorityClassification ?? null,
      failOpen: true,
    },
    analytics: {
      counterName: params.snapshot.counterName,
      counterValue: params.snapshot.counterValue,
      eventCategory: params.sourceEvent.category,
      summaryType: params.summaryType,
      aggregationKey: params.snapshot.aggregationKey,
      aggregatedAt: params.snapshot.aggregatedAt,
    },
  };
}

function incrementForEvent(
  event: GovernanceEvent,
  counterName: string,
  eventCategory: GovernanceEventCategory
): GovernanceCounterSnapshot {
  const dealId =
    event.entity?.dealId ??
    (event.entity?.entityType === "deal" ? event.entity.entityId ?? null : null);

  return incrementGovernanceCounter({
    counterName,
    routeClassification:
      event.governance.routeClassification ?? event.source.sourceClassification ?? null,
    sourceName: event.source.sourceName,
    routePath: event.source.routePath ?? null,
    eventCategory,
    contractorId: event.entity?.contractorId ?? null,
    dealId,
  });
}

export function buildGovernanceAnalyticsEvents(event: GovernanceEvent): GovernanceEvent[] {
  if (isAnalyticsSummaryEvent(event)) {
    return [];
  }

  const summaryEvents: GovernanceEvent[] = [];

  summaryEvents.push(
    makeSummaryEvent({
      sourceEvent: event,
      eventType: "governance_route_activity_summary",
      summaryType: "route_activity",
      snapshot: incrementForEvent(
        event,
        COUNTER_NAMES.ROUTE_LEVEL_GOVERNANCE_ACTIVITY,
        event.category
      ),
    })
  );

  if (event.category === "legacy_mutation") {
    summaryEvents.push(
      makeSummaryEvent({
        sourceEvent: event,
        eventType: "governance_activity_summary",
        summaryType: "activity",
        snapshot: incrementForEvent(
          event,
          COUNTER_NAMES.LEGACY_MUTATION_FREQUENCY,
          event.category
        ),
      })
    );
  }

  if (event.category === "divergence_observation") {
    summaryEvents.push(
      makeSummaryEvent({
        sourceEvent: event,
        eventType: "governance_divergence_summary",
        summaryType: "divergence",
        snapshot: incrementForEvent(
          event,
          COUNTER_NAMES.DIVERGENCE_FREQUENCY,
          event.category
        ),
      })
    );
  }

  if (
    event.eventType === "stale_state_compensation_observed" ||
    event.eventType === "deals_get_stale_state_compensation_observed"
  ) {
    summaryEvents.push(
      makeSummaryEvent({
        sourceEvent: event,
        eventType: "governance_divergence_summary",
        summaryType: "divergence",
        snapshot: incrementForEvent(
          event,
          COUNTER_NAMES.STALE_STATE_COMPENSATION_FREQUENCY,
          event.category
        ),
      })
    );
  }

  if (
    event.eventType === "canonical_overwrite_after_legacy_write_observed" ||
    event.eventType === "deals_get_canonical_correction_observed"
  ) {
    summaryEvents.push(
      makeSummaryEvent({
        sourceEvent: event,
        eventType: "governance_correction_summary",
        summaryType: "correction",
        snapshot: incrementForEvent(
          event,
          COUNTER_NAMES.CANONICAL_CORRECTION_FREQUENCY,
          event.category
        ),
      })
    );
  }

  if (event.eventType === "deals_get_noop_recompute_observed") {
    summaryEvents.push(
      makeSummaryEvent({
        sourceEvent: event,
        eventType: "governance_activity_summary",
        summaryType: "activity",
        snapshot: incrementForEvent(
          event,
          COUNTER_NAMES.NOOP_RECOMPUTE_FREQUENCY,
          event.category
        ),
      })
    );
  }

  return summaryEvents;
}
