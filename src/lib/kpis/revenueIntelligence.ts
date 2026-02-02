// src/lib/kpis/revenueIntelligence.ts

import { DealStage, Deal } from "@/types/deal";

export const STAGE_WEIGHTS: Record<DealStage, number> = {
  lead: 0.1,
  tender: 0.3, // Added tender
  submitted: 0.5, // Added submitted
  proposal: 0.6,
  negotiation: 0.7,
  won: 1.0,
  lost: 0,
};

export function computeRevenueIntelligence(deals: Deal[]) {
  let total = 0;
  let weighted = 0;

  for (const deal of deals) {
    const value = deal.value ?? 0;
    total += value;
    weighted += value * STAGE_WEIGHTS[deal.stage];
  }

  return { total, weighted };
}