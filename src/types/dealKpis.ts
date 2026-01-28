import { DealStage } from "@/types/deal";

export const DEAL_STAGE_COUNTS: Record<DealStage, number> = {
  lead: 0,
  tender: 0,
  proposal: 0,
  negotiation: 0,
  won: 0,
  lost: 0,
};