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

function makeIso(index: number): string {
  const base = new Date("2026-07-12T08:00:00.000+02:00").getTime();
  return new Date(base + index * 86_400_000).toISOString();
}

export function buildMockOpportunityProjects(): OpportunityProjectWorkspace[] {
  return [
    {
      id: "opportunity-jozi-waste",
      title: "City Waste Removal Framework",
      ref: "RFQ-JHB-2026-018",
      contractor: "Mandla Clean Works",
      status: "review",
      value: "R 12.8m",
      readiness: 82,
      risk: "MEDIUM",
      nextStep: "Complete final compliance review and assign the lead contractor.",
      contractors: [
        { id: "c-1", name: "Mandla Clean Works", status: "recommended", readiness: 94, aiMatch: 97, compliance: "green", note: "Highest match across waste operations and municipal coverage." },
        { id: "c-2", name: "Apex Facilities SA", status: "assigned", readiness: 88, aiMatch: 91, compliance: "green", note: "Assigned to document pack and commercial review." },
        { id: "c-3", name: "BlueRoute Services", status: "watchlist", readiness: 61, aiMatch: 66, compliance: "amber", note: "Suitable backup contractor if scope expands." },
      ],
      documents: [
        { id: "d-1", name: "RFQ Source Pack", type: "Source", status: "verified" },
        { id: "d-2", name: "Company Registration", type: "Evidence", status: "uploaded" },
        { id: "d-3", name: "Tax Clearance", type: "Evidence", status: "review" },
      ],
      forms: [
        { id: "f-1", name: "SBD 1", status: "complete" },
        { id: "f-2", name: "SBD 4", status: "in_progress" },
      ],
      boq: [
        { id: "b-1", name: "BOQ Master", status: "in_progress" },
        { id: "b-2", name: "Pricing Confirmation", status: "pending" },
      ],
      tasks: [
        { id: "t-1", title: "Assign lead contractor", owner: "Ops", status: "in_progress" },
        { id: "t-2", title: "Confirm submission checklist", owner: "Compliance", status: "pending" },
        { id: "t-3", title: "Review BOQ assumptions", owner: "QS", status: "blocked" },
      ],
      messages: [
        { id: "m-1", author: "Priya", role: "Procurement", body: "Keep the compliance pack aligned to the final contractor assignment.", createdAt: makeIso(0) },
        { id: "m-2", author: "Lerato", role: "Compliance", body: "Need one more pass on the tax and B-BBEE evidence.", createdAt: makeIso(1) },
      ],
      timeline: [
        { id: "tl-1", label: "Workspace opened", detail: "Project workspace created for the RFQ.", timestamp: makeIso(0) },
        { id: "tl-2", label: "Documents reviewed", detail: "Source pack and evidence set linked for review.", timestamp: makeIso(1) },
      ],
      submission: {
        title: "Submission readiness",
        status: "ready",
        items: ["SBD 1 complete", "SBD 4 in progress", "BOQ review pending"],
      },
      audit: [
        { id: "a-1", action: "Project initialized", actor: "System", at: makeIso(0) },
        { id: "a-2", action: "Contractor ranked", actor: "AI", at: makeIso(1) },
      ],
    },
    {
      id: "opportunity-provincial-hygiene",
      title: "Provincial Facilities Hygiene Tender",
      ref: "TDR-PROV-2026-044",
      contractor: "GreenLine Hygiene",
      status: "blocked",
      value: "R 8.4m",
      readiness: 61,
      risk: "HIGH",
      nextStep: "Clear the missing mandatory documents before assignment.",
      contractors: [
        { id: "c-4", name: "GreenLine Hygiene", status: "recommended", readiness: 91, aiMatch: 88, compliance: "green", note: "Best compliance posture and sector fit." },
        { id: "c-5", name: "NorthStar Cleaning", status: "removed", readiness: 69, aiMatch: 64, compliance: "red", note: "Removed after compliance gap review." },
      ],
      documents: [
        { id: "d-4", name: "Tender Brief", type: "Source", status: "verified" },
        { id: "d-5", name: "COIDA", type: "Evidence", status: "missing" },
      ],
      forms: [
        { id: "f-3", name: "SBD 8", status: "pending" },
        { id: "f-4", name: "SBD 9", status: "pending" },
      ],
      boq: [
        { id: "b-3", name: "BOQ Hygiene Pack", status: "pending" },
      ],
      tasks: [
        { id: "t-4", title: "Recover COIDA certificate", owner: "Contractors", status: "blocked" },
        { id: "t-5", title: "Validate SBD forms", owner: "Compliance", status: "pending" },
      ],
      messages: [
        { id: "m-3", author: "Aisha", role: "QS", body: "BOQ cannot be finalised until the certificates are current.", createdAt: makeIso(2) },
      ],
      timeline: [
        { id: "tl-3", label: "Tender imported", detail: "Workspace created from the tender source record.", timestamp: makeIso(2) },
      ],
      submission: {
        title: "Submission readiness",
        status: "draft",
        items: ["Missing COIDA", "Forms pending", "BOQ pending"],
      },
      audit: [
        { id: "a-3", action: "Risk flagged", actor: "AI", at: makeIso(2) },
      ],
    },
    {
      id: "opportunity-roadworks-materials",
      title: "Roadworks Material Supply",
      ref: "RFQ-ROADS-2026-011",
      contractor: "Bitumen Supply Co",
      status: "submitted",
      value: "R 6.1m",
      readiness: 94,
      risk: "LOW",
      nextStep: "Await award feedback and keep the audit trail complete.",
      contractors: [
        { id: "c-6", name: "Bitumen Supply Co", status: "assigned", readiness: 96, aiMatch: 95, compliance: "green", note: "Assigned supply partner with current documentation." },
        { id: "c-7", name: "Metro Materials", status: "recommended", readiness: 89, aiMatch: 84, compliance: "green", note: "Strong alternate contractor for fallback coverage." },
      ],
      documents: [
        { id: "d-6", name: "Commercial Pack", type: "Source", status: "verified" },
        { id: "d-7", name: "Supplier Credentials", type: "Evidence", status: "verified" },
      ],
      forms: [
        { id: "f-5", name: "SBD 1", status: "complete" },
        { id: "f-6", name: "SBD 4", status: "complete" },
      ],
      boq: [
        { id: "b-4", name: "BOQ Final", status: "complete" },
      ],
      tasks: [
        { id: "t-6", title: "Archive submission pack", owner: "Ops", status: "complete" },
        { id: "t-7", title: "Monitor award status", owner: "Executive", status: "in_progress" },
      ],
      messages: [
        { id: "m-4", author: "Mpho", role: "Commercial", body: "Submission has been sent and the pack is locked.", createdAt: makeIso(3) },
      ],
      timeline: [
        { id: "tl-4", label: "Submission sent", detail: "Tender uploaded through the approved channel.", timestamp: makeIso(3) },
      ],
      submission: {
        title: "Submission readiness",
        status: "submitted",
        items: ["Pack archived", "Submission recorded", "Awaiting award"],
      },
      audit: [
        { id: "a-4", action: "Submission logged", actor: "System", at: makeIso(3) },
      ],
    },
  ];
}
