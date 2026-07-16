export const ETENDERS_SOURCE_SYSTEM = "ETENDERS_SA" as const;

export type EtendersWorkflowState =
  | "DISCOVERED"
  | "UNDER_REVIEW"
  | "REJECTED_AS_IRRELEVANT"
  | "IMPORTED"
  | "MATCHING_REQUIRED"
  | "CONTRACTOR_ASSIGNED"
  | "COMPLIANCE_REVIEW"
  | "DOCUMENT_PREPARATION"
  | "BOQ_REQUIRED"
  | "INTERNAL_REVIEW"
  | "READY_FOR_SUBMISSION"
  | "SUBMITTED"
  | "AWARDED"
  | "UNSUCCESSFUL"
  | "CANCELLED"
  | "CLOSED";

export type EtendersSourceStatus = "PUBLISHED" | "AWARDED" | "CANCELLED" | "CLOSED" | "UNKNOWN";

export type EtendersDocumentKind =
  | "RFQ_RFP_NOTICE"
  | "BOQ"
  | "PRICING_SCHEDULE"
  | "ANNEXURE"
  | "BRIEFING_DOCUMENT"
  | "RETURNABLE_SCHEDULE"
  | "AMENDMENT"
  | "SUPPORTING";

export interface EtendersDocumentLink {
  id: string;
  sourceDocumentId: string;
  fileName: string;
  extension?: string | null;
  url: string;
  kind: EtendersDocumentKind;
  active: boolean;
  dateModified?: string | null;
  hash?: string | null;
}

export interface EtendersSourceRecord {
  sourceSystem: typeof ETENDERS_SOURCE_SYSTEM;
  sourceOpportunityId: string;
  sourceUrl: string;
  tenderNumber: string | null;
  tenderType: string | null;
  title: string;
  description: string | null;
  category: string | null;
  organOfState: string | null;
  department: string | null;
  municipality: string | null;
  province: string | null;
  advertisedAt: string | null;
  closingAt: string | null;
  briefingDate: string | null;
  briefingRequired: boolean;
  briefingCompulsory: boolean;
  submissionMethod: string | null;
  eSubmissionAccepted: boolean;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  estimatedValue: number | null;
  cidbRequirements: string[];
  compulsoryRequirements: string[];
  documentLinks: EtendersDocumentLink[];
  amendmentLinks: EtendersDocumentLink[];
  sourceStatus: EtendersSourceStatus;
  workflowState: EtendersWorkflowState;
  lastSourceCheckedAt: string;
  sourceFingerprint: string;
  rawSourceMetadata: Record<string, unknown>;
}

export interface EtendersSearchFilters {
  keywords?: string;
  tenderNumber?: string;
  category?: string;
  province?: string;
  organOfState?: string;
  tenderType?: string;
  eSubmissionAccepted?: boolean;
  advertisedFrom?: string;
  advertisedTo?: string;
  closingFrom?: string;
  closingTo?: string;
  preset?: EtendersSectorPresetId;
}

export type EtendersSectorPresetId =
  | "hygiene-sanitary-waste"
  | "waste-collection-disposal"
  | "cleaning-facilities"
  | "procurement-general-supplies"
  | "construction-maintenance"
  | "civil-works"
  | "telecommunications-fibre"
  | "transport-logistics"
  | "water-sanitation";

export interface EtendersImportReviewInput {
  sourceRecord: EtendersSourceRecord;
  correctedFields?: Partial<Pick<EtendersSourceRecord, "title" | "description" | "category" | "department" | "municipality" | "province" | "closingAt" | "briefingDate" | "estimatedValue">>;
  selectedSectorIds: EtendersSectorPresetId[];
  classification: string;
  reviewedByUid: string;
  workspaceId?: string | null;
  rejectedAsIrrelevant?: boolean;
}

export interface EtendersDuplicateCheckResult {
  duplicate: boolean;
  reason: "source_id" | "tender_issuer" | "source_url" | "fingerprint" | null;
  existingId?: string;
}

export interface EtendersExecutionStage {
  key: string;
  label: string;
  status: "pending" | "in_progress" | "blocked" | "complete";
  owner: string | null;
  blockingItems: string[];
  nextAction: string;
  dueDate: string | null;
  auditHistory: Array<{ at: string; actor?: string | null; action: string }>;
}

export interface EtendersExecutionWorkspace {
  opportunityId: string;
  dealId: string;
  contractorId: string;
  workspaceId: string;
  sourceTenderId: string;
  route: string;
  stages: EtendersExecutionStage[];
  submissionReady: boolean;
}

