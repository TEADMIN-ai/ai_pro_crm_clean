import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase"; // adjust path if needed

import {
  DealStatus,
  UserRole,
  isValidTransition
} from "./statusTransitions";

export type PricingStatus =
  | "not_started"
  | "ai_generated"
  | "manager_approved"
  | "contractor_signed_off";

interface UpdateDealStatusParams {
  dealId: string;
  nextStatus: DealStatus;
  role: UserRole;
}

export async function updateDealStatus({
  dealId,
  nextStatus,
  role
}: UpdateDealStatusParams) {
  const dealRef = doc(db, "deals", dealId);
  const snap = await getDoc(dealRef);

  if (!snap.exists()) {
    throw new Error("Deal not found");
  }

  const deal = snap.data();

  const currentStatus = deal.status as DealStatus;
  const pricingStatus = deal.pricingStatus as PricingStatus;

  // 1️⃣ Role-based transition validation
  const allowed = isValidTransition(role, currentStatus, nextStatus);

  if (!allowed) {
    throw new Error(
      `Invalid transition from ${currentStatus} to ${nextStatus} for role ${role}`
    );
  }

  // 2️⃣ Pricing gate
  if (nextStatus === "awarded" || nextStatus === "won") {
    if (pricingStatus !== "contractor_signed_off") {
      throw new Error(
        "Deal cannot be approved until contractor signs off pricing."
      );
    }
  }

  // 3️⃣ Perform update
  await updateDoc(dealRef, {
    status: nextStatus,
    updatedAt: new Date()
  });
}

