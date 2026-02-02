import type { DealStage } from "@/types/deal";

/**
 * Normalize external / legacy stage values
 */
export function normalizeDealStage(input: string): DealStage {
  switch (input) {
    case "proposal":
    case "negotiation":
    case "won":
    case "lost":
      return input;

    case "tender":
    case "submitted":
      return "proposal"; // canonical mapping

    default:
      return "lead";
  }
}