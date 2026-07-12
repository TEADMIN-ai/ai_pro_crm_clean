import type {
  ContractorOpportunityActivity,
  ContractorOpportunityChecklistItem,
  ContractorOpportunityFile,
  ContractorOpportunityNote,
  ContractorOpportunityRecommendation,
  ContractorOpportunityStatus,
  ContractorOpportunityTimelineItem,
  ContractorOpportunityWorkspace,
} from "@/lib/contractor-opportunities/types";

type SourceDeal = {
  id: string;
  title?: string | null;
  stage?: string | null;
  status?: string | null;
  tenderLockStatus?: string | null;
  readinessScore?: number | null;
  riskLevel?: string | null;
  updatedAt?: string | number | null;
  contractorTenderSummary?: {
    requiredDocuments?: string[];
    contractorActionChecklist?: string[];
    mainRiskNotes?: string[];
    eligibilityRequirements?: string[];
  } | null;
  tenderAnalysis?: {
    requiredCertificates?: string[];
    scope?: string | null;
    deadline?: string | null;
  } | null;
};

type SourceDocument = {
  id: string;
  documentName?: string | null;
  documentType?: string | null;
  docType?: string | null;
  fileName?: string | null;
  fileUrl?: string | null;
  status?: string | null;
  verificationStatus?: string | null;
  validationStatus?: string | null;
  uploadedAt?: string | number | null;
  updatedAt?: string | number | null;
  uploadedBy?: string | null;
};

type SourceCommandNote = {
  id: string;
  title?: string | null;
  message: string;
  authorName?: string | null;
  createdAt?: string | number | null;
};

type SourceContractorNote = {
  id: string;
  note: string;
  contractorVisible?: boolean | null;
  createdAt?: string | number | null;
};

type SourceTimelineItem = {
  id: string;
  label: string;
  timestamp?: string | number | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

export interface BuildContractorOpportunityWorkspaceInput {
  contractorId: string;
  deals: SourceDeal[];
  documents?: SourceDocument[];
  staffNotes?: SourceCommandNote[];
  contractorNotes?: SourceContractorNote[];
  timeline?: SourceTimelineItem[];
}

function resolveStatus(status?: string | null): ContractorOpportunityStatus {
  if (status === "submitted" || status === "awarded") return status;
  if (status === "draft") return "draft";
  if (status === "closed" || status === "lost" || status === "rejected") return "closed";
  if (status) return "active";
  return "unknown";
}


function mapDocuments(documents: SourceDocument[] = []): ContractorOpportunityFile[] {
  return documents.map((document) => ({
    id: document.id,
    name:
      document.documentName?.trim() ||
      document.fileName?.trim() ||
      document.documentType?.trim() ||
      document.docType?.trim() ||
      "Document",
    status: document.verificationStatus ?? document.validationStatus ?? document.status ?? null,
    uploadedAt: document.uploadedAt ?? document.updatedAt ?? null,
    uploadedBy: document.uploadedBy ?? null,
    url: document.fileUrl ?? null,
  }));
}

function mapStaffNotes(notes: SourceCommandNote[] = []): ContractorOpportunityNote[] {
  return notes.map((note) => ({
    id: note.id,
    title: note.title ?? null,
    body: note.message,
    authorName: note.authorName ?? "Staff",
    audience: "staff",
    createdAt: note.createdAt ?? null,
  }));
}

function mapContractorNotes(notes: SourceContractorNote[] = []): ContractorOpportunityNote[] {
  return notes.map((note) => ({
    id: note.id,
    body: note.note,
    audience: note.contractorVisible === false ? "staff" : "contractor",
    createdAt: note.createdAt ?? null,
  }));
}

function mapTimeline(timeline: SourceTimelineItem[] = []): ContractorOpportunityTimelineItem[] {
  return timeline.map((item) => ({
    id: item.id,
    label: item.label,
    description: String(item.metadata?.documentType ?? item.metadata?.title ?? item.targetId ?? "Opportunity"),
    timestamp: item.timestamp ?? null,
    source: item.targetId ?? null,
  }));
}

function mapActivity(timeline: SourceTimelineItem[] = []): ContractorOpportunityActivity[] {
  return timeline.map((item) => ({
    id: item.id,
    label: item.label,
    timestamp: item.timestamp ?? null,
    metadata: item.metadata,
  }));
}

function buildRecommendations(deal: SourceDeal): ContractorOpportunityRecommendation[] {
  const riskNotes = deal.contractorTenderSummary?.mainRiskNotes ?? [];
  const eligibilityRequirements = deal.contractorTenderSummary?.eligibilityRequirements ?? [];

  return [
    ...riskNotes.map((note, index) => ({
      id: `${deal.id}-risk-${index}`,
      title: "Risk Review",
      detail: note,
      priority: "high" as const,
      source: "ai" as const,
    })),
    ...eligibilityRequirements.map((requirement, index) => ({
      id: `${deal.id}-eligibility-${index}`,
      title: "Eligibility Requirement",
      detail: requirement,
      priority: "medium" as const,
      source: "ai" as const,
    })),
  ];
}

function buildChecklist(deal: SourceDeal): ContractorOpportunityChecklistItem[] {
  const actionItems = deal.contractorTenderSummary?.contractorActionChecklist ?? [];
  const requiredDocuments =
    deal.contractorTenderSummary?.requiredDocuments ??
    deal.tenderAnalysis?.requiredCertificates ??
    [];

  return [
    ...actionItems.map((item, index) => ({
      id: `${deal.id}-action-${index}`,
      label: item,
      status: "outstanding" as const,
    })),
    ...requiredDocuments.map((item, index) => ({
      id: `${deal.id}-document-${index}`,
      label: item,
      status: "inReview" as const,
      detail: "Required submission document",
    })),
  ];
}

export function buildContractorOpportunityWorkspaces({
  contractorId,
  deals,
  documents = [],
  staffNotes = [],
  contractorNotes = [],
  timeline = [],
}: BuildContractorOpportunityWorkspaceInput): ContractorOpportunityWorkspace[] {
  return deals.map((deal) => ({
    id: deal.id,
    contractorId,
    title: deal.title?.trim() || deal.id,
    status: resolveStatus(deal.status ?? deal.stage ?? null),
    stage: deal.stage ?? null,
    readinessScore: deal.readinessScore ?? null,
    riskLevel: deal.riskLevel ?? null,
    href: `/dashboard/deals/${encodeURIComponent(deal.id)}`,
    messages: [],
    timeline: mapTimeline(timeline),
    aiRecommendations: buildRecommendations(deal),
    staffNotes: mapStaffNotes(staffNotes),
    contractorNotes: mapContractorNotes(contractorNotes),
    fileUploads: mapDocuments(documents),
    activityHistory: mapActivity(timeline),
    submissionChecklist: buildChecklist(deal),
  }));
}
