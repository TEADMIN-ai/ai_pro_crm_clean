// src/lib/deals/recordDealAudit.ts

import type { DealAuditActor, DealAuditEvent, DealAuditEventType } from "@/types/deal";

function safeId(): string {
  // safe unique-enough id (no extra deps)
  return `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function makeDealAuditEvent(params: {
  type: DealAuditEventType;
  actor?: DealAuditActor;
  meta?: Record<string, unknown>;
}): DealAuditEvent {
  return {
    id: safeId(),
    type: params.type,
    at: new Date(),
    actor: params.actor,
    meta: params.meta ?? {},
  };
}