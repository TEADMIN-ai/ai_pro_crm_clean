// src/lib/tender/isTenderLocked.ts

import type { Deal } from "@/types/deal";

/**
 * A deal becomes read-only once it has been submitted as a tender.
 * This is a pure rule function — no UI, no Firebase.
 */
export function isTenderLocked(deal: Deal): boolean {
  if (!deal) return false;

  // Explicit lock flag (preferred)
  if ((deal as any).tenderLocked === true) {
    return true;
  }

  // Fallback: stage-based lock
  if (deal.stage === "tender" || deal.stage === "submitted") {
    return true;
  }

  return false;
}