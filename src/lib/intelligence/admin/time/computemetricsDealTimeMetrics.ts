import type { Deal } from "@/types/deal";

/**
 * Safely converts Firestore Timestamp | Date | string | number into Date
 */
function toDateSafe(value: any): Date | undefined {
  if (!value) return undefined;

  // Firestore Timestamp
  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }

  return undefined;
}

function diffHours(a?: Date, b?: Date): number | undefined {
  if (!a || !b) return undefined;
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60);
}

export type DealTimeMetrics = {
  approvalHours?: number;
  submissionHours?: number;
  closeHours?: number;
};

export function computeDealTimeMetrics(deal: Deal): DealTimeMetrics {
  const createdAt = toDateSafe(deal.createdAt);
  const approvedAt = toDateSafe(deal.pricingApprovedAt);
  const submittedAt = toDateSafe(deal.tenderSubmittedAt);
  const closedAt = toDateSafe(deal.closedAt);

  return {
    approvalHours: diffHours(createdAt, approvedAt),
    submissionHours: diffHours(approvedAt, submittedAt),
    closeHours: diffHours(createdAt, closedAt),
  };
}

