// src/lib/firestore/deals.ts

import { db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import type { DealStage } from "@/types/deal";
import { normalizeDealStage } from "@/lib/deals/normalizeDealStage";

export async function updateDealStage(
  dealId: string,
  nextStage: DealStage | string
) {
  const stage = normalizeDealStage(nextStage);

  await updateDoc(doc(db, "deals", dealId), {
    stage,
    updatedAt: serverTimestamp(),
  });
}