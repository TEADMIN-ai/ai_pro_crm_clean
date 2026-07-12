export type OpportunityIntelligencePipelineStageStatus =
  | "complete"
  | "active"
  | "pending";

export type OpportunityIntelligencePipelineStageKey =
  | "opportunity-created"
  | "documents-uploaded"
  | "pdf-intelligence"
  | "compliance-check"
  | "contractor-matching"
  | "boq-review"
  | "submission-planning"
  | "ready-for-assignment";

export type OpportunityIntelligencePipelineStage = {
  key: OpportunityIntelligencePipelineStageKey;
  label: string;
  status: OpportunityIntelligencePipelineStageStatus;
  detail: string;
};

export const mockOpportunityIntelligencePipeline: OpportunityIntelligencePipelineStage[] = [
  {
    key: "opportunity-created",
    label: "Opportunity Created",
    status: "complete",
    detail: "Opportunity shell exists in the presentation workspace.",
  },
  {
    key: "documents-uploaded",
    label: "Documents Uploaded",
    status: "complete",
    detail: "Tender documents are represented as mock uploaded records.",
  },
  {
    key: "pdf-intelligence",
    label: "PDF Intelligence",
    status: "active",
    detail: "Presentation stage only. No OCR or AI service is invoked.",
  },
  {
    key: "compliance-check",
    label: "Compliance Check",
    status: "pending",
    detail: "Compliance review state is mocked for workflow visibility.",
  },
  {
    key: "contractor-matching",
    label: "Contractor Matching",
    status: "pending",
    detail: "Contractor recommendations are displayed from mock data.",
  },
  {
    key: "boq-review",
    label: "BOQ Review",
    status: "pending",
    detail: "BOQ readiness is represented without pricing automation.",
  },
  {
    key: "submission-planning",
    label: "Submission Planning",
    status: "pending",
    detail: "Submission planning is a presentation-only planning stage.",
  },
  {
    key: "ready-for-assignment",
    label: "Ready For Assignment",
    status: "pending",
    detail: "Final handoff state for assignment readiness.",
  },
];
