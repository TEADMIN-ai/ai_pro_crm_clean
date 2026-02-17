// src/lib/deals/recordDealAudit.ts

import type {
  DealAuditActor,
  DealAuditEvent,
  DealAuditEventType,
} from "@/types/deal";

/**
 * Generates a safe unique id for audit entries
 */
function safeId(): string {
  return (
    "audit_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).substring(2, 9)
  );
}

/**
 * Creates a DealAuditEvent object
 */
export function makeDealAuditEvent(params: {
  type: DealAuditEventType;
  actor?: DealAuditActor;
  meta?: Record<string, unknown>;
}): DealAuditEvent {
  return {
    id: safeId(),
    type: params.type,
    timestamp: new Date(),
    actor: params.actor, // ✅ no null
    meta: params.meta ?? {},
  };
}

/**
 * Records an audit event (in-memory)
 */
export function recordDealAudit(
  existing: DealAuditEvent[] | undefined,
  params: {
    type: DealAuditEventType;
    actor?: DealAuditActor;
    meta?: Record<string, unknown>;
  }
): DealAuditEvent[] {
  const event = makeDealAuditEvent(params);

  if (!existing) {
    return [event];
  }

  return [...existing, event];
}

