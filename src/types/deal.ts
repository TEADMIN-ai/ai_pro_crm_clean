// src/types/deal.ts

export type DealStage =
  | "draft"
  | "pricing"
  | "manager_review"
  | "submitted"
  | "won"
  | "lost";

export type DealAuditActor = {
  uid: string;
  email?: string | null;
  name?: string | null;
};

export type DealAuditEventType =
  | "stage_changed"
  | "tender_submitted"
  | "document_uploaded";

export type DealAuditEvent = {
  id: string; // unique event id
  type: DealAuditEventType;
  at: Date | any; // Date now, Firestore Timestamp later
  actor?: DealAuditActor;
  meta?: Record<string, unknown>;
};

export type DealDocument = {
  id: string;
  name: string;
  url: string;
  storagePath: string;
  uploadedAt?: Date | any;
};

/**
 * 🔥 NEW: Pricing workflow status
 */
export type PricingStatus =
  | "not_started"
  | "ai_generated"
  | "manager_approved"
  | "contractor_signed_off";

export interface Deal {
  id: string;
  title: string;
  stage: DealStage;
  value: number;
  currency?: "ZAR";

  companyId?: string;
  assignedTo?: string | null;
  clientName?: string;

  createdAt?: Date | any;
  updatedAt?: Date | any;

  // ✅ Tender lock = single source of truth
  isTenderLocked?: boolean;

  // ✅ Submission stamping
  tenderSubmittedAt?: Date | any;
  tenderSubmittedBy?: DealAuditActor;

  // ✅ Docs attached to deal
  documents?: DealDocument[];

  // ✅ Audit trail
  auditTrail?: DealAuditEvent[];

  /**
   * 🔥 NEW: Pricing workflow fields
   */
  pricingStatus?: PricingStatus;
  pricingApprovedBy?: string;
  pricingApprovedAt?: Date | any;
  contractorSignedOffBy?: string;
  contractorSignedOffAt?: Date | any;
}