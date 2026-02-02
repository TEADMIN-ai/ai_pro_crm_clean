"use server";

import { Deal, DealStage } from "@/types/deal";

/**
 * SAFE server action
 * Replace console.log with Firestore update later
 */
export async function updateDealStage(
  dealId: string,
  stage: DealStage
): Promise<Deal> {
  // 🔒 Persistence stub (safe)
  console.log("Persisting deal stage:", { dealId, stage });

  // TODO (F3/F4):
  // await updateDoc(doc(db, "deals", dealId), { stage });

  // Return updated deal shape (mock-safe)
  return {
    id: dealId,
    title: "Updated Deal",
    stage,
    value: 0,
    currency: "ZAR",
    isTenderLocked: stage === "submitted",
    documents: [],
  };
}