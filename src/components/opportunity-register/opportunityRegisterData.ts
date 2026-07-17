import type { EnterpriseTone } from "@/components/ui/EnterpriseUI";
import type { Deal } from "@/types/deal";

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


function formatDateOnly(value: unknown): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

export function mapDealToOpportunityRegisterRecord(deal: Deal): OpportunityRegisterRecord {
  const source = deal as Deal & Record<string, unknown>;
  const tenderAnalysis = deal.tenderAnalysis;
  const client = typeof source.clientName === "string" && source.clientName.trim() ? source.clientName.trim() : tenderAnalysis?.issuingAuthority ?? deal.contractorName ?? "Unknown client";
  const municipality = typeof source.municipalityName === "string" && source.municipalityName.trim() ? source.municipalityName.trim() : tenderAnalysis?.location ?? "Unknown municipality";
  const department = typeof source.department === "string" && source.department.trim() ? source.department.trim() : "Unassigned department";
  const rfqNumber = typeof source.rfqNumber === "string" && source.rfqNumber.trim() ? source.rfqNumber.trim() : tenderAnalysis?.tenderNumber ?? deal.id;
  const closingDate = formatDateOnly(source.closingDate ?? source.deadline ?? tenderAnalysis?.deadline);
  const estimatedValue = deal.value ?? deal.estimatedDealValue ?? tenderAnalysis?.estimatedValue ?? 0;
  const readiness = typeof deal.readinessScore === "number" ? deal.readinessScore : 0;
  const contractorAssignment = source.contractorAssignment && typeof source.contractorAssignment === "object" ? source.contractorAssignment as Record<string, unknown> : {};
  const assignmentComplete = Boolean(typeof contractorAssignment.contractorId === "string" && contractorAssignment.contractorId.trim() && typeof contractorAssignment.assignedAt === "string" && typeof contractorAssignment.executionWorkspaceId === "string" && contractorAssignment.assignmentStatus === "assigned");
  const assignedContractorName = assignmentComplete && typeof contractorAssignment.contractorName === "string" ? contractorAssignment.contractorName : null;
  const status: OpportunityRegisterStatus = deal.status === "submitted" ? "submitted" : deal.status === "awarded" || deal.stage === "awarded" || deal.stage === "won" ? "awarded" : readiness < 50 ? "atRisk" : "ready";
  return {
    id: deal.id,
    rfqNumber,
    client,
    municipality,
    department,
    closingDate,
    assignedContractors: assignmentComplete ? 1 : 0,
    submissionReadiness: readiness,
    submissionProgress: deal.stage === "submitted" ? 100 : deal.stage === "draft" || deal.stage === "lead" ? 20 : 50,
    estimatedValue,
    status,
    summary: typeof source.description === "string" && source.description.trim() ? source.description.trim() : deal.title,
    coordinator: typeof source.createdByEmail === "string" ? source.createdByEmail : "Torque Empire operations",
    riskNote: deal.riskLevel ? "Risk level: " + deal.riskLevel : "Initial opportunity intake created.",
    contractors: assignedContractorName ? [assignedContractorName] : [],
    timeline: [{ label: "Opportunity created", detail: "Record created in the canonical deals collection.", date: formatDateOnly(deal.createdAt), tone: "success" }],
    municipalityBreakdown: [{ label: municipality, value: "Primary", tone: "info" }],
    departmentBreakdown: [{ label: department, value: "Primary", tone: "info" }],
    readinessChecklist: [
      { label: "Primary RFQ/RFP document", detail: "Source document retained on the opportunity record.", status: "complete" },
      { label: "Metadata review", detail: "Staff reviewed or corrected extracted fields before creation.", status: "complete" },
      { label: "Contractor allocation", detail: assignmentComplete ? "Canonical contractor assignment and execution workspace connected." : "No canonical contractor assignment is connected.", status: assignmentComplete ? "complete" : "pending" },
    ],
  };
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
