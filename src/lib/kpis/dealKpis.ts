import type { DealStage } from "../../types/deal";

export const STAGE_WEIGHTS: Record<DealStage, number> = {
  draft: 0.1,
  pricing: 0.3,
  manager_review: 0.5,
  submitted: 0.7,
  won: 1,
  lost: 0,
};