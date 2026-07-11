import type { ContractorOpportunitySectionKey } from "@/lib/contractor-opportunities/types";

export interface ContractorOpportunitySectionDefinition {
  key: ContractorOpportunitySectionKey;
  title: string;
  emptyLabel: string;
}

export const CONTRACTOR_OPPORTUNITY_SECTIONS: ContractorOpportunitySectionDefinition[] = [
  {
    key: "messages",
    title: "Messages",
    emptyLabel: "No opportunity messages recorded.",
  },
  {
    key: "timeline",
    title: "Timeline",
    emptyLabel: "No opportunity timeline events recorded.",
  },
  {
    key: "aiRecommendations",
    title: "AI Recommendations",
    emptyLabel: "No recommendations generated for this opportunity.",
  },
  {
    key: "staffNotes",
    title: "Staff Notes",
    emptyLabel: "No staff notes recorded.",
  },
  {
    key: "contractorNotes",
    title: "Contractor Notes",
    emptyLabel: "No contractor notes recorded.",
  },
  {
    key: "fileUploads",
    title: "File Uploads",
    emptyLabel: "No opportunity files uploaded.",
  },
  {
    key: "activityHistory",
    title: "Activity History",
    emptyLabel: "No activity history recorded.",
  },
  {
    key: "submissionChecklist",
    title: "Submission Checklist",
    emptyLabel: "No submission checklist items recorded.",
  },
];
