// src/lib/deals/getDealsForUser.ts

import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Deal } from "@/types/deal";

function normalizeNumber(value: any): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function normalizeStage(stage: any): Deal["stage"] {
  const allowed = [
    "lead",
    "manager_review",
    "manager_approved",
    "submitted",
    "won",
    "lost",
    "closed",
  ];

  return allowed.includes(stage) ? stage : "lead";
}

function normalizePricingStatus(status: any): Deal["pricingStatus"] {
  const allowed = [
    "not_started",
    "in_progress",
    "manager_approved",
    "rejected",
  ];

  return allowed.includes(status) ? status : "not_started";
}

export async function getDealsForUser(): Promise<Deal[]> {
  const q = query(collection(db, "deals"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc: any) => {
    const data = doc.data();

    return {
      id: doc.id,
      title: data.title ?? "Untitled",
      companyId: data.companyId ?? "unknown",

      stage: normalizeStage(data.stage),
      pricingStatus: normalizePricingStatus(data.pricingStatus),

      value: normalizeNumber(data.value),

      assignedTo: data.assignedTo ?? null,

      createdAt: data.createdAt,
      updatedAt: data.updatedAt,

      firstResponseAt: data.firstResponseAt,
      managerApprovedAt: data.managerApprovedAt,
      submittedAt: data.submittedAt,
      closedAt: data.closedAt,

      isTenderLocked: data.isTenderLocked ?? false,
      tenderSubmittedAt: data.tenderSubmittedAt,
      tenderSubmittedBy: data.tenderSubmittedBy,
    };
  });
}

