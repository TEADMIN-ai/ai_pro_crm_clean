import type { DealStage } from "@/types/deal";

/**
 * KPI counters by deal stage
 * Used for pipeline + dashboard summaries
 */
export const DEAL_STAGE_KPIS: Record<DealStage, number> = {
  lead: 0,
  tender: 0,
  proposal: 0,
  negotiation: 0,
  won: 0,
  lost: 0,
};

/**
 * Helper to safely increment a stage counter
 */
export function incrementDealStage(
  kpis: Record<DealStage, number>,
  stage: DealStage
) {
  kpis[stage] += 1;
}