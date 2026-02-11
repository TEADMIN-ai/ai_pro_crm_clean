import type { Deal } from "@/types/deal";
import { computeDealRisk } from "@/lib/risk/computeDealRisk";

export function computeRevenueHealthScore(deals: Deal[]): number {
  if (!deals || deals.length === 0) return 0;

  const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);

  if (totalValue === 0) return 0;

  const pricingApprovedDeals = deals.filter(
    (d) => d.pricingStatus === "manager_approved"
  );

  const readyToSubmitDeals = deals.filter(
    (d) => d.stage === "ready_for_submission"
  );

  const pricingRatio = pricingApprovedDeals.length / deals.length;
  const readinessRatio = readyToSubmitDeals.length / deals.length;

  // Risk adjustment
  const riskScores = deals.map((d) => computeDealRisk(d).score);
  const avgRisk =
    riskScores.reduce((a, b) => a + b, 0) / riskScores.length;

  // Convert risk into penalty (higher risk = lower health)
  const riskPenalty = avgRisk / 100;

  // Weighted formula
  const rawScore =
    pricingRatio * 40 +
    readinessRatio * 40 +
    (1 - riskPenalty) * 20;

  // Normalize to 0–100
  const normalizedScore = Math.max(0, Math.min(100, rawScore));

  return Number(normalizedScore.toFixed(1));
}