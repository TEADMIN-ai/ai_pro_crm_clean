import type { Deal, DealStage } from "../../../types/deal";

type AdminMetrics = {
  totalDeals: number;
  stageCounts: Record<DealStage, number>;
  totalPipelineValue: number;
  weightedRevenue: number;
  lockedDeals: number;
  unassignedDeals: number;
};

const STAGE_WEIGHTS: Record<DealStage, number> = {
  draft: 0.1,
  pricing: 0.3,
  manager_review: 0.5,
  submitted: 0.7,
  won: 1,
  lost: 0,
};

export function computeAdminMetrics(deals: Deal[]): AdminMetrics {
  const stageCounts: Record<DealStage, number> = {
    draft: 0,
    pricing: 0,
    manager_review: 0,
    submitted: 0,
    won: 0,
    lost: 0,
  };

  let totalPipelineValue = 0;
  let weightedRevenue = 0;
  let lockedDeals = 0;
  let unassignedDeals = 0;

  for (const deal of deals) {
    stageCounts[deal.stage]++;

    const value = deal.value ?? 0;
    totalPipelineValue += value;

    const weight = STAGE_WEIGHTS[deal.stage];
    weightedRevenue += value * weight;

    if (deal.isTenderLocked) lockedDeals++;
    if (!deal.assignedTo) unassignedDeals++;
  }

  return {
    totalDeals: deals.length,
    stageCounts,
    totalPipelineValue,
    weightedRevenue,
    lockedDeals,
    unassignedDeals,
  };
}