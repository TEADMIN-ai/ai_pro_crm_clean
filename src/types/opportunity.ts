// src/types/opportunity.ts
// Canonical Opportunity Management architecture.

export type OpportunitySchemaVersion = "2026-01";

export type OpportunitySourceType = "RFQ" | "Tender" | "RFP" | "RFI" | "Quotation";

export type OpportunityLifecycleStatus =
  | "draft"
  | "identified"
  | "qualified"
  | "in_analysis"
  | "in_preparation"
  | "ready_for_submission"
  | "submitted"
  | "awarded"
  | "lost"
  | "cancelled"
  | "closed";

export type OpportunityPriority = "low" | "medium" | "high" | "critical";
export type OpportunityRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type OpportunityComplianceStatus = "UNKNOWN" | "PASS" | "WARNING" | "FAIL";
export type OpportunityReadinessStatus = "NOT_READY" | "AT_RISK" | "READY";
export type OpportunityBriefingMode = "physical" | "online" | "hybrid" | "unknown";
export type OpportunityAssignmentRole = "lead" | "reviewer" | "qs" | "compliance" | "support";
export type OpportunityMessageVisibility = "internal" | "contractor" | "all";

export interface OpportunityMoney {
  amount: number;
  currency: string;
}

export interface OpportunityMunicipality {
  id?: string | null;
  name: string;
  province?: string | null;
  district?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
}

export interface OpportunityMetadata {
  sourceType: OpportunitySourceType;
  sourceReference?: string | null;
  issuerReference?: string | null;
  title: string;
  description?: string | null;
  category?: string | null;
  tags: string[];
  priority: OpportunityPriority;
  workspaceId?: string | null;
  ownerUid?: string | null;
  value?: OpportunityMoney | null;
  estimatedValue?: OpportunityMoney | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface OpportunityBriefing {
  compulsory: boolean;
  requiredStatus: "yes" | "no" | "unknown";
  briefingAt?: string | null;
  mode: OpportunityBriefingMode;
  locationOrPlatform?: string | null;
  notes?: string | null;
}

export interface OpportunityBoqRequirement {
  required: boolean;
  status: "missing" | "uploaded" | "reviewed" | "not_applicable";
  documentId?: string | null;
  notes?: string | null;
}

export interface OpportunityContractorAssignment {
  id: string;
  contractorId: string;
  contractorName?: string | null;
  role: OpportunityAssignmentRole;
  assignedByUid?: string | null;
  assignedAt: string;
  status: "assigned" | "accepted" | "declined" | "removed";
  removedAt?: string | null;
  notes?: string | null;
}

export interface OpportunityComplianceSnapshot {
  status: OpportunityComplianceStatus;
  matched: boolean;
  score?: number | null;
  missingRequirements: string[];
  blockers: string[];
  riskLevel?: OpportunityRiskLevel | null;
  evaluatedAt?: string | null;
  evaluatedBy?: string | null;
}

export interface OpportunityAiAnalysis {
  status: "not_requested" | "pending" | "completed" | "failed";
  summary?: string | null;
  scopeOfWork?: string | null;
  eligibilityRequirements: string[];
  requiredDocuments: string[];
  risks: string[];
  recommendations: string[];
  confidence?: number | null;
  model?: string | null;
  analyzedAt?: string | null;
  sourceDocumentIds: string[];
}

export interface OpportunitySubmissionReadiness {
  status: OpportunityReadinessStatus;
  score: number;
  requiredActions: string[];
  missingDocuments: string[];
  reviewedByUid?: string | null;
  reviewedAt?: string | null;
}

export interface OpportunityMessage {
  id: string;
  authorUid?: string | null;
  authorName?: string | null;
  body: string;
  visibility: OpportunityMessageVisibility;
  createdAt: string;
  editedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface OpportunityActivityActor {
  uid?: string | null;
  name?: string | null;
  role?: string | null;
  email?: string | null;
}

export interface OpportunityActivityEvent {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  actor?: OpportunityActivityActor | null;
  metadata?: Record<string, unknown>;
}

export interface Opportunity {
  schemaVersion: OpportunitySchemaVersion;
  id: string;
  legacyDealId?: string | null;
  tenderId?: string | null;
  status: OpportunityLifecycleStatus;
  metadata: OpportunityMetadata;
  municipality: OpportunityMunicipality;
  closingDate: string | null;
  compulsoryBriefing: OpportunityBriefing;
  boqRequired: OpportunityBoqRequirement;
  contractorAssignments: OpportunityContractorAssignment[];
  compliance: OpportunityComplianceSnapshot;
  aiAnalysis: OpportunityAiAnalysis;
  submissionReadiness: OpportunitySubmissionReadiness;
  messages: OpportunityMessage[];
  activityTimeline: OpportunityActivityEvent[];
}

export interface OpportunityCreateInput {
  sourceType: OpportunitySourceType;
  title: string;
  municipalityName: string;
  closingDate?: string | null;
  sourceReference?: string | null;
  issuerReference?: string | null;
  workspaceId?: string | null;
}
