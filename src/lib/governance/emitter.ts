import { buildGovernanceAnalyticsEvents } from "@/lib/governance/analytics";
import { persistGovernanceEmission } from "@/lib/governance/persistence";
import { recordGovernanceEvent } from "@/lib/governance/store";
import type { GovernanceEvent } from "@/lib/governance/types";

function createEventId(): string {
  return crypto.randomUUID();
}

function normalizeEvent(event: GovernanceEvent): GovernanceEvent {
  return {
    ...event,
    eventId: event.eventId || createEventId(),
    eventVersion: "v1",
    governance: {
      failOpen: true,
      ...event.governance,
    },
  };
}

export function emitGovernanceEvent(event: GovernanceEvent): void {
  try {
    const normalizedEvent = normalizeEvent(event);

    queueMicrotask(() => {
      try {
        recordGovernanceEvent(normalizedEvent);
        console.info("[governance]", normalizedEvent);

        const analyticsEvents = buildGovernanceAnalyticsEvents(normalizedEvent);
        for (const analyticsEvent of analyticsEvents) {
          const normalizedAnalyticsEvent = normalizeEvent(analyticsEvent);
          recordGovernanceEvent(normalizedAnalyticsEvent);
          console.info("[governance]", normalizedAnalyticsEvent);
        }

        persistGovernanceEmission(normalizedEvent, analyticsEvents.map((analyticsEvent) => normalizeEvent(analyticsEvent)));
      } catch (error) {
        console.warn("[governance_emit_failed]", {
          reason: error instanceof Error ? error.message : "Unknown emitter failure",
          eventType: event.eventType,
          category: event.category,
        });
      }
    });
  } catch (error) {
    console.warn("[governance_emit_failed]", {
      reason: error instanceof Error ? error.message : "Unknown emitter failure",
      eventType: event.eventType,
      category: event.category,
    });
  }
}
