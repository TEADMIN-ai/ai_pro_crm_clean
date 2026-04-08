// src/lib/kpis/dealKpis.ts

import type { Deal, DealStage } from "@/types/deal";

/* ---------------------------------- */
/* Stage Weight Mapping               */
/* ---------------------------------- */

export const stageWeights: Record<DealStage, number> = {
  draft: 0.05,
  lead: 0.1,
  in_review: 0.45,
  pricing: 0.3,
  manager_review: 0.6,
  submitted: 0.8,
  awarded: 1,
  won: 1,
  rejected: 0,
  lost: 0,
  closed: 1,
};

/* ---------------------------------- */
/* Revenue Projection                 */
/* ---------------------------------- */

export function computeProjectedRevenue(deals: Deal[]): number {
  return deals.reduce((total, deal) => {
    const weight = stageWeights[deal.stage] ?? 0;
    const value = deal.value ?? 0;
    return total + value * weight;
  }, 0);
}

