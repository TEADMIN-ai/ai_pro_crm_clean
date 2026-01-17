// src/lib/deals/status.ts

export const DEAL_STATUSES = [
  "draft",
  "in_review",
  "submitted",
  "awarded",
  "lost",
] as const;

export type DealStatus = (typeof DEAL_STATUSES)[number];

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  draft: "Draft",
  in_review: "In Review",
  submitted: "Submitted",
  awarded: "Awarded",
  lost: "Lost",
};
