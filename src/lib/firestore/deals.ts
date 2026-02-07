// src/lib/firestore/deals.ts

import { db } from "../firebase";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { isValidTransition } from "../deals/statusTransitions";

export type PricingStatus =
  | "not_started"
  | "ai_generated"
  | "manager_approved"
  | "contractor_signed_off";

/**
 * Central gateway for updating deal stage.
 * All stage transitions must pass through this function.
 */
export async function updateDealStage(
  dealId: string,
  nextStage: string,
  role: string
) {
  const dealRef = doc(db, "deals", dealId);
  const snap = await getDoc(dealRef);

  if (!snap.exists()) {
    throw new Error("Deal not found");
  }

  const deal = snap.data();

  const currentStage = deal.stage as string;
  const pricingStatus = deal.pricingStatus as PricingStatus;

  // 🔐 Role-based transition validation
  const allowed = isValidTransition(
    role as any,
    currentStage as any,
    nextStage as any
  );

  if (!allowed) {
    throw new Error(
      `Invalid transition from ${currentStage} to ${nextStage} for role ${role}`
    );
  }

  // 💰 Pricing approval gate
  if (nextStage === "approved") {
    if (pricingStatus !== "contractor_signed_off") {
      throw new Error(
        "Deal cannot be approved until contractor signs off pricing."
      );
    }
  }

  await updateDoc(dealRef, {
    stage: nextStage,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Manager approves AI-generated pricing.
 */
export async function approvePricingByManager(
  dealId: string,
  managerUid: string
) {
  const dealRef = doc(db, "deals", dealId);
  const snap = await getDoc(dealRef);

  if (!snap.exists()) {
    throw new Error("Deal not found");
  }

  const deal = snap.data();

  if (deal.pricingStatus !== "ai_generated") {
    throw new Error(
      "Pricing must be AI generated before manager approval."
    );
  }

  await updateDoc(dealRef, {
    pricingStatus: "manager_approved",
    pricingApprovedBy: managerUid,
    pricingApprovedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Contractor signs off approved pricing.
 */
export async function signOffPricingByContractor(
  dealId: string,
  contractorUid: string
) {
  const dealRef = doc(db, "deals", dealId);
  const snap = await getDoc(dealRef);

  if (!snap.exists()) {
    throw new Error("Deal not found");
  }

  const deal = snap.data();

  if (deal.pricingStatus !== "manager_approved") {
    throw new Error(
      "Manager must approve pricing before contractor sign-off."
    );
  }

  if (deal.contractorSignedOffAt) {
    throw new Error("Pricing already signed off.");
  }

  await updateDoc(dealRef, {
    pricingStatus: "contractor_signed_off",
    contractorSignedOffBy: contractorUid,
    contractorSignedOffAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}