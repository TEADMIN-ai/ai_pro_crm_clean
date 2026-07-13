export type OpportunityIntelligencePipelineStageStatus = "complete" | "active" | "pending";

export type OpportunityIntelligencePipelineStageKey =
  | "created"
  | "documents"
  | "compliance"
  | "contractors"
  | "readiness"
  | "submission";

export type OpportunityIntelligencePipelineStage = {
  key: OpportunityIntelligencePipelineStageKey;
  label: string;
  detail: string;
  status: OpportunityIntelligencePipelineStageStatus;
};

export function createEmptyOpportunityIntelligencePipeline(): OpportunityIntelligencePipelineStage[] {
  return [];
}
