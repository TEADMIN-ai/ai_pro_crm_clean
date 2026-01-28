// src/lib/tender/isTenderLocked.ts

import type { Deal } from "@/types/deal";

/**
 * Canonical tender lock guard
 * UI + logic must respect this
 */
export function isTenderLocked(deal: Deal): boolean {
  return deal.isTenderLocked === true;
}