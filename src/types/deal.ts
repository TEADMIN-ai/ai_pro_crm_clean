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
  email?: string | null;
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

export interface TenderAnalysisSnapshot {
  issuingAuthority?: string | null;
  tenderNumber?: string | null;
  deadline?: string | null;
  scope?: string | null;
  requiredCertificates?: string[];
  estimatedValue?: number | null;
  location?: string | null;
  aiAnalyzedAt?: string | null;
}

/* ---------------------------------- */
/* Core Deal Model                    */
/* ---------------------------------- */

export interface Deal {
  id: string;
  type?: string;
  templateOverride?: string[] | null;

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
  readinessScore?: number;
  docsMissing?: number;
  tenderLockStatus?: "READY" | "RISK" | "BLOCKED";
  readinessUpdatedAt?: string;
  tenderSubmittedAt?: Date;
  tenderSubmittedBy?: string;
  complianceMatch?: boolean;
  missingRequirements?: string[];
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  estimatedDealValue?: number;
  tenderAnalysis?: TenderAnalysisSnapshot;

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

