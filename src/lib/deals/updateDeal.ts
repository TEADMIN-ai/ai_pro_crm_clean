// src/lib/deals/updateDeal.ts

import type { Deal, DealAuditActor, DealAuditEventType } from "@/types/deal";
import { isTenderLocked } from "@/lib/tender/isTenderLocked";
import { makeDealAuditEvent } from "@/lib/deals/recordDealAudit";

export async function updateDeal(
  dealId: string,
  updates: Partial<Deal>,
  currentDeal?: Deal,
  opts?: {
    actor?: DealAuditActor;
    auditType?: DealAuditEventType;
    auditMeta?: Record<string, unknown>;
  }
): Promise<void> {
  // If we have the current deal, enforce lock
  if (currentDeal && isTenderLocked(currentDeal)) {
    throw new Error("Deal is tender-locked and cannot be modified.");
  }

  // Never allow unlocking once locked (even if currentDeal missing)
  if (updates.isTenderLocked === false) {
    throw new Error("Tender lock cannot be reverted.");
  }

  // Optional audit append (safe, local)
  let nextAuditTrail = currentDeal?.auditTrail ?? undefined;
  if (opts?.auditType) {
    const evt = makeDealAuditEvent({
      type: opts.auditType,
      actor: opts.actor,
      meta: opts.auditMeta,
    });

    nextAuditTrail = [...(currentDeal?.auditTrail ?? []), evt];
    updates = { ...updates, auditTrail: nextAuditTrail };
  }

  // TODO: Replace this with Firestore update (authoritative write)
  console.log("✅ updateDeal (authoritative)", {
    dealId,
    updates,
  });

  return;
}