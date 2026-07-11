import type {
  OpportunityAiAnalysis,
  OpportunityBoqRequirement,
  OpportunityBriefing,
  OpportunityComplianceSnapshot,
  OpportunityLifecycleStatus,
  OpportunityReadinessStatus,
  OpportunitySubmissionReadiness,
} from "@/types/opportunity";

export const OPPORTUNITY_SCHEMA_VERSION = "2026-01" as const;

export const OPPORTUNITY_COLLECTIONS = {
  opportunities: "opportunities",
  messages: "messages",
  activityTimeline: "activityTimeline",
  documents: "documents",
  analytics: "analytics",
} as const;

export const OPPORTUNITY_SOURCE_TYPES = ["RFQ", "Tender", "RFP", "RFI", "Quotation"] as const;

export const OPPORTUNITY_LIFECYCLE_STATUSES: readonly OpportunityLifecycleStatus[] = [
  "draft",
  "identified",
  "qualified",
  "in_analysis",
  "in_preparation",
  "ready_for_submission",
  "submitted",
  "awarded",
  "lost",
  "cancelled",
  "closed",
] as const;

export const OPPORTUNITY_READINESS_STATUSES: readonly OpportunityReadinessStatus[] = [
  "NOT_READY",
  "AT_RISK",
  "READY",
] as const;

export const DEFAULT_OPPORTUNITY_BRIEFING: OpportunityBriefing = {
  compulsory: false,
  requiredStatus: "unknown",
  briefingAt: null,
  mode: "unknown",
  locationOrPlatform: null,
  notes: null,
};

export const DEFAULT_OPPORTUNITY_BOQ: OpportunityBoqRequirement = {
  required: false,
  status: "not_applicable",
  documentId: null,
  notes: null,
};

export const DEFAULT_OPPORTUNITY_COMPLIANCE: OpportunityComplianceSnapshot = {
  status: "UNKNOWN",
  matched: false,
  score: null,
  missingRequirements: [],
  blockers: [],
  riskLevel: null,
  evaluatedAt: null,
  evaluatedBy: null,
};

export const DEFAULT_OPPORTUNITY_AI_ANALYSIS: OpportunityAiAnalysis = {
  status: "not_requested",
  summary: null,
  scopeOfWork: null,
  eligibilityRequirements: [],
  requiredDocuments: [],
  risks: [],
  recommendations: [],
  confidence: null,
  model: null,
  analyzedAt: null,
  sourceDocumentIds: [],
};

export const DEFAULT_OPPORTUNITY_SUBMISSION_READINESS: OpportunitySubmissionReadiness = {
  status: "NOT_READY",
  score: 0,
  requiredActions: [],
  missingDocuments: [],
  reviewedByUid: null,
  reviewedAt: null,
};
