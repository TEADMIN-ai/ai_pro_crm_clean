// src/lib/tender/submitTender.ts

import { doc, updateDoc, serverTimestamp, arrayUnion } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Deal } from "@/types/deal";

export type TenderSubmissionRecord = {
  submittedAt: Date;
  submittedBy: string;
  snapshot: {
    stage: Deal["stage"];
    value: Deal["value"];
    currency?: Deal["currency"];
  };
};

/**
 * 🔒 Submits a deal as a tender
 * - Locks the deal (read-only)
 * - Records immutable audit trail
 * - Prevents further edits
 */
export async function submitTenderDeal(params: {
  dealId: string;
  userId: string;
  deal: Deal;
}): Promise<void> {
  const { dealId, userId, deal } = params;

  if (!dealId) throw new Error("Missing dealId");
  if (!userId) throw new Error("Missing userId");

  const dealRef = doc(db, "deals", dealId);

  const submission: TenderSubmissionRecord = {
    submittedAt: new Date(),
    submittedBy: userId,
    snapshot: {
      stage: deal.stage,
      value: deal.value,
      currency: deal.currency,
    },
  };

  await updateDoc(dealRef, {
    // 🔒 Lock flags
    tenderSubmitted: true,
    tenderLocked: true,

    // 🔁 Force stage
    stage: "tender",

    // 🧾 Immutable audit log
    tenderAudit: arrayUnion(submission),

    // 🔐 System timestamps
    tenderSubmittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}