import type { Deal } from "@/types/deal";

/**
 * Single source of truth for "tender is locked".
 * Locked if:
 *  - deal.isTenderLocked is true (explicit flag)
 *  - OR stage is "submitted" (canonical end state)
 */
export function isTenderLocked(deal: Deal): boolean {
  if (!deal) return false;

  if (deal.isTenderLocked === true) return true;

  // Canonical lock stage
  if (deal.stage === "submitted") return true;

  return false;
}

