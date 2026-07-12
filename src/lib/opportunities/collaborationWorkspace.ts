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

const MOCK_TIMESTAMP = "2026-07-12T08:00:00.000+02:00";

function statusFromReadiness(readinessScore?: number | null): OpportunityCollaborationStatus {
  if (typeof readinessScore !== "number") return "pending";
  if (readinessScore >= 85) return "complete";
  if (readinessScore >= 55) return "in_progress";
  return "blocked";
}

export function buildMockOpportunityCollaborationWorkspace({
  opportunityId,
  title,
  contractorName,
  status,
  readinessScore,
  riskLevel,
  missingRequirements = [],
}: BuildOpportunityCollaborationWorkspaceInput): OpportunityCollaborationWorkspace {
  const opportunityTitle = title?.trim() || "Untitled Opportunity";
  const readinessStatus = statusFromReadiness(readinessScore);
  const blockerItems = missingRequirements.length ? missingRequirements : ["Final submission checklist review"];

  return {
    id: `opportunity-workspace-${opportunityId}`,
    title: opportunityTitle,
    subtitle: `Workspace for opportunity ${opportunityId}`,
    sections: [
      {
        key: "overview",
        title: "Overview",
        summary: "Opportunity identity, ownership, status, readiness, and risk snapshot.",
        items: [
          { id: "overview-status", label: "Current status", detail: status || "Pending", status: readinessStatus },
          { id: "overview-contractor", label: "Assigned contractor", detail: contractorName || "Unassigned", status: contractorName ? "complete" : "pending" },
          { id: "overview-risk", label: "Risk posture", detail: riskLevel || "Pending review", status: riskLevel === "CRITICAL" ? "blocked" : "in_progress" },
        ],
      },
      {
        key: "teamChat",
        title: "Team Chat",
        summary: "Presentation-only collaboration thread. No chat backend is connected.",
        items: [
          { id: "chat-1", label: "Procurement Lead", detail: "Please keep SBD and BOQ changes in the submission pack notes.", status: "complete", timestamp: MOCK_TIMESTAMP },
          { id: "chat-2", label: "Compliance Reviewer", detail: "Awaiting final review of mandatory returnables.", status: "pending", timestamp: MOCK_TIMESTAMP },
        ],
      },
      {
        key: "documents",
        title: "Documents",
        summary: "Tender source documents and supporting contractor evidence.",
        items: [
          { id: "documents-rfq", label: "RFQ source pack", detail: "Mock source PDF registered for review.", status: "in_progress" },
          { id: "documents-evidence", label: "Supporting evidence", detail: "Contractor evidence bundle placeholder.", status: "pending" },
        ],
      },
      {
        key: "sbdForms",
        title: "SBD Forms",
        summary: "SBD form preparation and validation status.",
        items: [
          { id: "sbd-1", label: "SBD 1", detail: "Supplier details mapped for review.", status: "in_progress" },
          { id: "sbd-4", label: "SBD 4", detail: "Disclosure form placeholder pending final sign-off.", status: "pending" },
        ],
      },
      {
        key: "boq",
        title: "BOQ",
        summary: "Bill of quantities import, pricing, and commercial review.",
        items: [
          { id: "boq-import", label: "BOQ import", detail: "Mock BOQ worksheet ready for QS review.", status: "in_progress", owner: "QS" },
          { id: "boq-pricing", label: "Pricing review", detail: "Commercial assumptions pending.", status: "pending", owner: "Commercial" },
        ],
      },
      {
        key: "tasks",
        title: "Tasks",
        summary: "Operational tasks needed to move this opportunity to submission.",
        items: blockerItems.map((item, index) => ({
          id: `task-${index}`,
          label: item,
          detail: "Mock task generated from current opportunity readiness context.",
          status: index === 0 ? readinessStatus : "pending",
          owner: index % 2 === 0 ? "Operations" : "Compliance",
        })),
      },
      {
        key: "timeline",
        title: "Timeline",
        summary: "Milestone view for opportunity preparation.",
        items: [
          { id: "timeline-created", label: "Workspace created", detail: "Opportunity collaboration workspace initialized.", status: "complete", timestamp: MOCK_TIMESTAMP },
          { id: "timeline-review", label: "Review window", detail: "Documents, BOQ, and SBD forms under review.", status: "in_progress", timestamp: MOCK_TIMESTAMP },
        ],
      },
      {
        key: "approvals",
        title: "Approvals",
        summary: "Internal review gates before submission.",
        items: [
          { id: "approval-compliance", label: "Compliance approval", detail: "Pending compliance sign-off.", status: "pending", owner: "Compliance" },
          { id: "approval-commercial", label: "Commercial approval", detail: "Pending pricing confirmation.", status: "pending", owner: "Commercial" },
        ],
      },
      {
        key: "submission",
        title: "Submission",
        summary: "Final pack readiness and delivery controls.",
        items: [
          { id: "submission-pack", label: "Submission pack", detail: "Pack assembly placeholder.", status: readinessStatus },
          { id: "submission-channel", label: "Submission channel", detail: "Portal or email channel pending confirmation.", status: "pending" },
        ],
      },
      {
        key: "auditTrail",
        title: "Audit Trail",
        summary: "Immutable operational trace placeholders for the opportunity workspace.",
        items: [
          { id: "audit-created", label: "Workspace initialized", detail: "Mock audit event for presentation architecture.", status: "complete", timestamp: MOCK_TIMESTAMP },
          { id: "audit-readiness", label: "Readiness viewed", detail: "Mock audit marker for readiness review.", status: "complete", timestamp: MOCK_TIMESTAMP },
        ],
      },
      {
        key: "activityFeed",
        title: "Activity Feed",
        summary: "Recent collaboration and workspace activity.",
        items: [
          { id: "activity-docs", label: "Documents panel reviewed", detail: "Document register prepared for staff review.", status: "complete", timestamp: MOCK_TIMESTAMP },
          { id: "activity-tasks", label: "Tasks refreshed", detail: "Mock tasks aligned to missing requirements.", status: "in_progress", timestamp: MOCK_TIMESTAMP },
        ],
      },
    ],
  };
}
