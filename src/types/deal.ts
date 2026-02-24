// src/types/deal.ts
// Canonical Deal Domain Model
// PURE TYPE FILE — no imports

/* ---------------------------------- */
/* Deal Stage Workflow                */
/* ---------------------------------- */

export type DealStage =
  | "lead"
  | "pricing"
  | "manager_review"
  | "submitted"
  | "won"
  | "lost"
  | "closed";

/* ---------------------------------- */
/* Audit System Types                 */
/* ---------------------------------- */

export interface DealAuditActor {
  uid: string;
  name?: string;
  role?: string;
}

export type DealAuditEventType =
  | "created"
  | "updated"
  | "stage_changed"
  | "pricing_approved"
  | "tender_submitted"
  | "closed"
  | "lost";

export interface DealAuditEvent {
  id: string;
  type: DealAuditEventType;
  timestamp: Date;
  actor?: DealAuditActor;
  meta?: Record<string, unknown>;
}

/* ---------------------------------- */
/* Deal Documents                     */
/* ---------------------------------- */

export interface DealDocument {
  id: string;
  name: string;
  storagePath?: string;
  url?: string;
  uploadedAt?: Date;
  uploadedBy?: string;
}

/* ---------------------------------- */
/* Core Deal Model                    */
/* ---------------------------------- */

export interface Deal {
  id: string;

  // Core Identity
  title: string;
  companyId: string;
  contractorId?: string;
  contractorName?: string;
  status?: "draft" | "submitted" | "awarded";

  // Workflow
  stage: DealStage;
  pricingStatus?: string;
  assignedTo?: string | null;

  // Financial
  value?: number;
  currency?: string;

  // Tender System
  isTenderLocked?: boolean;
  tenderSubmittedAt?: Date;
  tenderSubmittedBy?: string;

  // Approval
  pricingApprovedAt?: Date;

  // Close Tracking
  closedAt?: Date;

  // Metadata
  createdAt?: Date | number;
  updatedAt?: Date;

  // Audit
  auditTrail?: DealAuditEvent[];

  // Documents
  documents?: DealDocument[];
}

