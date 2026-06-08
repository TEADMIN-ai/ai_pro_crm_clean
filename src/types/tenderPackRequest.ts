export const TENDER_PACK_REQUEST_STATUSES = [
  "pending",
  "under_review",
  "approved",
  "generated",
  "rejected",
] as const;

export type TenderPackRequestStatus = (typeof TENDER_PACK_REQUEST_STATUSES)[number];

export type TenderPackRequestAuditEvent = {
  action: "created" | "status_changed" | "generated";
  actorId: string;
  actorEmail?: string | null;
  actorRole?: string | null;
  at: string;
  fromStatus?: TenderPackRequestStatus | null;
  toStatus?: TenderPackRequestStatus;
  note?: string | null;
  packId?: string | null;
};

export type TenderPackRequest = {
  id: string;
  contractorId: string;
  contractorName?: string | null;
  dealId?: string | null;
  dealTitle?: string | null;
  status: TenderPackRequestStatus;
  requestedBy: string;
  requestedByEmail?: string | null;
  requestedAt: string;
  updatedAt: string;
  reviewedBy?: string | null;
  reviewedByEmail?: string | null;
  reviewedAt?: string | null;
  generatedBy?: string | null;
  generatedByEmail?: string | null;
  generatedAt?: string | null;
  packId?: string | null;
  downloadURL?: string | null;
  rejectionReason?: string | null;
  note?: string | null;
  auditTrail: TenderPackRequestAuditEvent[];
};
