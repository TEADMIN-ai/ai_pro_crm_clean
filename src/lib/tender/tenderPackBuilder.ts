export type TenderPackDocument = {
  key: string;
  label: string;
  category: string;
  status: "required" | "generated" | "missing";
  note?: string;
};

export type TenderPackGeneratedPdf = {
  key: string;
  name: string;
  pages: number;
  size: string;
  status: "ready" | "preview" | "queued";
};

export type TenderPackSubmissionProfile = {
  key: string;
  label: string;
  audience: string;
  summary: string;
  packageType: string;
  compliance: string;
};

export type TenderPackBuilderState = {
  title: string;
  reference: string;
  progress: number;
  profile: TenderPackSubmissionProfile;
  requiredDocuments: TenderPackDocument[];
  generatedPdfs: TenderPackGeneratedPdf[];
  missingDocuments: TenderPackDocument[];
};

export function createEmptyTenderPackBuilderState(): TenderPackBuilderState {
  return {
    title: "Tender Pack Builder",
    reference: "",
    progress: 0,
    profile: {
      key: "unconfigured",
      label: "Production data not connected",
      audience: "Unassigned",
      summary: "No live tender pack source is connected.",
      packageType: "Unconfigured",
      compliance: "Unavailable",
    },
    requiredDocuments: [],
    generatedPdfs: [],
    missingDocuments: [],
  };
}

export function getTenderPackProgress(state: TenderPackBuilderState): number {
  return state.progress;
}
export type TenderPackPipelineStatus = "complete" | "inProgress" | "waiting" | "error";

export type TenderPackPipelineStage = {
  key: string;
  label: string;
  detail: string;
  status: TenderPackPipelineStatus;
  note?: string;
};

export const tenderPackPipelineStages: TenderPackPipelineStage[] = [];
