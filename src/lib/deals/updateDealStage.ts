import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/config";
import type { DealStage } from "@/types/deal";

export async function updateDealStage(
  dealId: string,
  nextStage: DealStage
) {
  if (!dealId) {
    throw new Error("Missing dealId");
  }

  try {
    await updateDoc(doc(db, "deals", dealId), {
      stage: nextStage,
      stageUpdatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to update deal stage:", error);
    throw error;
  }
}