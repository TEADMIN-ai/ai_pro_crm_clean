export type ContractorOpportunitySectionKey =
  | "messages"
  | "timeline"
  | "aiRecommendations"
  | "staffNotes"
  | "contractorNotes"
  | "fileUploads"
  | "activityHistory"
  | "submissionChecklist";

export type ContractorOpportunityPriority = "low" | "medium" | "high" | "critical";

export type ContractorOpportunityStatus = "draft" | "active" | "submitted" | "awarded" | "closed" | "unknown";

export type ContractorOpportunityAudience = "staff" | "contractor" | "shared";

export interface ContractorOpportunityMessage {
  id: string;
  authorName: string;
  audience: ContractorOpportunityAudience;
  body: string;
  createdAt?: string | number | null;
}

export interface ContractorOpportunityTimelineItem {
  id: string;
  label: string;
  description?: string | null;
  timestamp?: string | number | null;
  source?: string | null;
}

export interface ContractorOpportunityRecommendation {
  id: string;
  title: string;
  detail: string;
  priority: ContractorOpportunityPriority;
  source?: "ai" | "system" | "staff";
}

export interface ContractorOpportunityNote {
  id: string;
  authorName?: string | null;
  title?: string | null;
  body: string;
  audience: ContractorOpportunityAudience;
  createdAt?: string | number | null;
}

export interface ContractorOpportunityFile {
  id: string;
  name: string;
  status?: string | null;
  uploadedAt?: string | number | null;
  uploadedBy?: string | null;
  url?: string | null;
}

export interface ContractorOpportunityActivity {
  id: string;
  label: string;
  actorName?: string | null;
  timestamp?: string | number | null;
  metadata?: Record<string, unknown>;
}

export interface ContractorOpportunityChecklistItem {
  id: string;
  label: string;
  status: "complete" | "inReview" | "outstanding" | "blocked";
  detail?: string | null;
}

export interface ContractorOpportunityWorkspace {
  id: string;
  contractorId: string;
  title: string;
  status: ContractorOpportunityStatus;
  stage?: string | null;
  readinessScore?: number | null;
  riskLevel?: string | null;
  href?: string | null;
  messages: ContractorOpportunityMessage[];
  timeline: ContractorOpportunityTimelineItem[];
  aiRecommendations: ContractorOpportunityRecommendation[];
  staffNotes: ContractorOpportunityNote[];
  contractorNotes: ContractorOpportunityNote[];
  fileUploads: ContractorOpportunityFile[];
  activityHistory: ContractorOpportunityActivity[];
  submissionChecklist: ContractorOpportunityChecklistItem[];
}
