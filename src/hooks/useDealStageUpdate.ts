"use client";

import { Deal, DealStage } from "@/types/deal";
import { updateDealStage } from "@/lib/deals/updateDealStage";

export function useDealStageUpdate() {
  async function changeStage(deal: Deal, stage: DealStage) {
    return await updateDealStage(deal.id, stage);
  }

  return { changeStage };
}