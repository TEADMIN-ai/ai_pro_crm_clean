export type OpportunityProjectTabKey =
  | "overview"
  | "contractors"
  | "documents"
  | "forms"
  | "boq"
  | "tasks"
  | "messages"
  | "timeline"
  | "submission"
  | "audit";

export type OpportunityProjectStatus = "ready" | "review" | "blocked" | "submitted" | "won";

export type OpportunityProjectContractor = {
  id: string;
  name: string;
  status: "recommended" | "assigned" | "removed" | "watchlist";
  readiness: number;
  aiMatch: number;
  compliance: "green" | "amber" | "red";
  note: string;
};

export type OpportunityProjectMessage = {
  id: string;
  author: string;
  role: string;
  body: string;
  createdAt: string;
};

export type OpportunityProjectTimelineItem = {
  id: string;
  label: string;
  detail: string;
  timestamp: string;
};

export type OpportunityProjectDocument = {
  id: string;
  name: string;
  type: string;
  status: "uploaded" | "review" | "verified" | "missing";
};

export type OpportunityProjectForm = {
  id: string;
  name: string;
  status: "complete" | "in_progress" | "pending";
};

export type OpportunityProjectTask = {
  id: string;
  title: string;
  owner: string;
  status: "complete" | "in_progress" | "pending" | "blocked";
};

export type OpportunityProjectAuditItem = {
  id: string;
  action: string;
  actor: string;
  at: string;
};

export type OpportunityProjectWorkspace = {
  id: string;
  title: string;
  ref: string;
  contractor: string;
  status: OpportunityProjectStatus;
  value: string;
  readiness: number;
  risk: string;
  nextStep: string;
  contractors: OpportunityProjectContractor[];
  documents: OpportunityProjectDocument[];
  forms: OpportunityProjectForm[];
  boq: OpportunityProjectForm[];
  tasks: OpportunityProjectTask[];
  messages: OpportunityProjectMessage[];
  timeline: OpportunityProjectTimelineItem[];
  submission: {
    title: string;
    status: "draft" | "ready" | "submitted";
    items: string[];
  };
  audit: OpportunityProjectAuditItem[];
};

export function createEmptyOpportunityProjects(): OpportunityProjectWorkspace[] {
  return [];
}
