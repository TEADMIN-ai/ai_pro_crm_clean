import type { Deal, DealStage } from "../../types/deal";

/**
 * Revenue weighting model for Tender lifecycle.
 */
export const STAGE_WEIGHTS: Record<DealStage, number> = {
  lead: 0.1,
  pricing: 0.3,
  manager_review: 0.5,
  submitted: 0.7,
  won: 1,
  lost: 0,
  closed: 1,
};

/**
 * Compute revenue intelligence aligned with existing component expectations.
 */
export function computeRevenueIntelligence(deals: Deal[]) {
  let total = 0;
  let weighted = 0;

  for (const deal of deals) {
    const value = deal.value ?? 0;
    total += value;

    const weight = STAGE_WEIGHTS[deal.stage] ?? 0;
    weighted += value * weight;
  }

  return {
    total,
    weighted,
  };
}

