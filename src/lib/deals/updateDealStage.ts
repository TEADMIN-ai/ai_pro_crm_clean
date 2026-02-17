// src/lib/deals/updateDealStage.ts

import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DealStage } from "@/types/deal";

export async function updateDealStage(
  dealId: string,
  nextStage: DealStage
): Promise<void> {
  if (!dealId) {
    throw new Error("updateDealStage: dealId is required");
  }

  const dealRef = doc(db, "deals", dealId);

  await updateDoc(dealRef, {
    stage: nextStage,
    updatedAt: serverTimestamp(),
  });
}