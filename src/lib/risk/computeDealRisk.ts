import type { Deal } from "@/types/deal";

export function computeDealRisk(deal: Deal) {
  let score = 0;

  // No assignment = risk
  if (!deal.assignedTo) score += 30;

  // Not pricing approved
  if (deal.pricingStatus !== "manager_approved") score += 25;

  // In review stage too long
  if (deal.stage === "manager_review") score += 20;

  // No value
  if (!deal.value || deal.value <= 0) score += 15;

  // Locked but not won
  if (deal.isTenderLocked && deal.stage !== "won") score += 10;

  const level =
    score < 30
      ? "LOW"
      : score < 60
      ? "MEDIUM"
      : "HIGH";

  return {
    score,
    level,
  };
}