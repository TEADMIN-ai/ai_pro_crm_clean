export type OpportunityCollaborationSectionKey =
  | "overview"
  | "teamChat"
  | "documents"
  | "sbdForms"
  | "boq"
  | "tasks"
  | "timeline"
  | "approvals"
  | "submission"
  | "auditTrail"
  | "activityFeed";

export type OpportunityCollaborationStatus = "complete" | "in_progress" | "pending" | "blocked";

export interface OpportunityCollaborationItem {
  id: string;
  label: string;
  detail: string;
  status: OpportunityCollaborationStatus;
  owner?: string;
  timestamp?: string;
}

export interface OpportunityCollaborationSection {
  key: OpportunityCollaborationSectionKey;
  title: string;
  summary: string;
  items: OpportunityCollaborationItem[];
}

export interface OpportunityCollaborationWorkspace {
  id: string;
  title: string;
  subtitle: string;
  sections: OpportunityCollaborationSection[];
}

export interface BuildOpportunityCollaborationWorkspaceInput {
  opportunityId: string;
  title?: string | null;
  contractorName?: string | null;
  status?: string | null;
  readinessScore?: number | null;
  riskLevel?: string | null;
  missingRequirements?: string[];
}

export function buildOpportunityCollaborationWorkspace({
  opportunityId,
  title,
}: BuildOpportunityCollaborationWorkspaceInput): OpportunityCollaborationWorkspace {
  return {
    id: `opportunity-workspace-${opportunityId}`,
    title: title?.trim() || "Untitled opportunity",
    subtitle: "Live opportunity data is not connected.",
    sections: [
      {
        key: "overview",
        title: "Overview",
        summary: "Connect production opportunity data to populate this workspace.",
        items: [],
      },
    ],
  };
}
