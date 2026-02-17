// src/lib/deals/normalizeDealStage.ts

import type { DealStage } from "@/types/deal";

/**
 * Normalize or coerce an input string into a valid deal stage.
 * Falls back to "lead" for anything unrecognized.
 */
export function normalizeDealStage(input: unknown): DealStage {
  if (typeof input !== "string") {
    return "lead";
  }

  const value = input.trim().toLowerCase();

  switch (value) {
    case "lead":
      return "lead";

    case "pricing":
      return "pricing";

    case "manager_review":
      return "manager_review";

    case "submitted":
      return "submitted";

    case "won":
      return "won";

    case "lost":
      return "lost";

    case "closed":
      return "closed";

    default:
      // any unknown stage is treated as "lead" by default
      return "lead";
  }
}

