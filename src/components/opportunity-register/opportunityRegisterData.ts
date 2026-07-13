import type { EnterpriseTone } from "@/components/ui/EnterpriseUI";

export type OpportunityRegisterStatus = "ready" | "closingSoon" | "submitted" | "atRisk" | "awarded";

export type OpportunityRegisterTimelineItem = {
  label: string;
  detail: string;
  date: string;
  tone: EnterpriseTone;
};

export type OpportunityRegisterChecklistItem = {
  label: string;
  detail: string;
  status: "complete" | "inReview" | "pending" | "blocked";
};

export type OpportunityRegisterBreakdownItem = {
  label: string;
  value: string;
  tone: EnterpriseTone;
};

export type OpportunityRegisterRecord = {
  id: string;
  rfqNumber: string;
  client: string;
  municipality: string;
  department: string;
  closingDate: string;
  assignedContractors: number;
  submissionReadiness: number;
  submissionProgress: number;
  estimatedValue: number;
  status: OpportunityRegisterStatus;
  summary: string;
  coordinator: string;
  riskNote: string;
  contractors: string[];
  timeline: OpportunityRegisterTimelineItem[];
  municipalityBreakdown: OpportunityRegisterBreakdownItem[];
  departmentBreakdown: OpportunityRegisterBreakdownItem[];
  readinessChecklist: OpportunityRegisterChecklistItem[];
};

export const opportunityRegisterRecords: OpportunityRegisterRecord[] = [];
export const opportunityRegisterMunicipalities: string[] = [];
export const opportunityRegisterDepartments: string[] = [];
export const opportunityRegisterStatuses: OpportunityRegisterStatus[] = ["ready", "closingSoon", "submitted", "atRisk", "awarded"];

export function getOpportunityRegisterRecordById(id: string) {
  return opportunityRegisterRecords.find((record) => record.id === id);
}

export function formatOpportunityStatus(status: OpportunityRegisterStatus): string {
  if (status === "closingSoon") return "Closing Soon";
  if (status === "atRisk") return "At Risk";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function opportunityStatusTone(status: OpportunityRegisterStatus): EnterpriseTone {
  if (status === "ready") return "success";
  if (status === "closingSoon") return "warning";
  if (status === "submitted") return "info";
  if (status === "awarded") return "completed";
  return "danger";
}

export function readinessTone(value: number): EnterpriseTone {
  if (value >= 80) return "success";
  if (value >= 60) return "warning";
  return "danger";
}

export function progressTone(value: number): EnterpriseTone {
  if (value >= 80) return "completed";
  if (value >= 60) return "success";
  if (value >= 40) return "warning";
  return "danger";
}
