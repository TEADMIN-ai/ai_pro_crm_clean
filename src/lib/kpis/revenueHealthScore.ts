import type { Deal } from "@/types/deal";

export function computeRevenueHealthScore(deals: Deal[]): number {
  if (!deals.length) return 0;

  const totalPipeline = deals.reduce(
    (sum, d) => sum + (d.value ?? 0),
    0
  );

  const weightedRevenue = deals.reduce((sum, d) => {
    const value = d.value ?? 0;

    const stageWeight: Record<string, number> = {
      draft: 0.1,
      pricing: 0.25,
      manager_review: 0.5,
      submitted: 0.75,
      won: 1,
      lost: 0,
    };

    const weight = stageWeight[d.stage ?? "draft"] ?? 0;
    return sum + value * weight;
  }, 0);

  // Ready-to-submit logic (based on approval state, not fake stage)
  const readyToSubmitDeals = deals.filter(
    (d) =>
      d.pricingStatus === "manager_approved" &&
      d.stage !== "submitted"
  );

  const approvalRatio =
    readyToSubmitDeals.length / deals.length;

  const pipelineStrength =
    totalPipeline > 0
      ? weightedRevenue / totalPipeline
      : 0;

  const healthScore =
    pipelineStrength * 70 + approvalRatio * 30;

  return Math.max(0, Math.min(100, healthScore * 100));
}