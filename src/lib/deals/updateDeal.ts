// src/lib/deals/updateDeal.ts

import type {
  Deal,
  DealAuditActor,
  DealAuditEventType,
} from "@/types/deal";

import { isTenderLocked } from "@/lib/tender/isTenderLocked";
import { makeDealAuditEvent } from "@/lib/deals/recordDealAudit";

export async function updateDeal(
  dealId: string,
  updates: Partial<Deal>,
  currentDeal?: Deal,
  opts?: {
    actor?: DealAuditActor;
    type?: DealAuditEventType;
    meta?: Record<string, unknown>;
  }
): Promise<void> {
  if (!dealId) {
    throw new Error("updateDeal: dealId is required");
  }

  if (currentDeal && isTenderLocked(currentDeal)) {
    throw new Error("Deal is tender-locked and cannot be modified.");
  }

  // 🔐 Audit logging (aligned to your exact function signature)
  if (opts?.type) {
    makeDealAuditEvent({
      type: opts.type,
      actor: opts.actor,
      meta: opts.meta,
    });
  }

  // NOTE:
  // This function currently only handles domain + audit.
  // Firestore update logic should be handled in updateDealStage.ts or similar.
}