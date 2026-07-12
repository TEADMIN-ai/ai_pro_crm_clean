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

export const opportunityRegisterRecords: OpportunityRegisterRecord[] = [
  {
    id: "rfq-2026-014",
    rfqNumber: "RFQ-2026-014",
    client: "City of Johannesburg",
    municipality: "City of Johannesburg",
    department: "Public Works",
    closingDate: "2026-07-15",
    assignedContractors: 7,
    submissionReadiness: 86,
    submissionProgress: 74,
    estimatedValue: 18400000,
    status: "ready",
    summary: "Municipal facilities maintenance pack with final compliance review and pricing lock pending.",
    coordinator: "Nomsa Dlamini",
    riskNote: "Low operational risk. Final pack sign-off required before submission release.",
    contractors: ["Mabaso Civils", "Mosaic Facilities", "UrbanCore Services", "Delta Hygiene"],
    timeline: [
      { label: "Scope confirmed", detail: "Client brief aligned to the current tender pack", date: "2026-07-10", tone: "success" },
      { label: "Compliance review", detail: "SBD forms and declarations validated", date: "2026-07-12", tone: "info" },
      { label: "Pricing lock", detail: "Final commercial review in progress", date: "2026-07-14", tone: "warning" },
      { label: "Closing", detail: "Submission window closes at 11:00", date: "2026-07-15", tone: "success" },
    ],
    municipalityBreakdown: [
      { label: "Johannesburg South", value: "38%", tone: "success" },
      { label: "Johannesburg North", value: "27%", tone: "info" },
      { label: "Inner City", value: "21%", tone: "warning" },
      { label: "Regional depots", value: "14%", tone: "neutral" },
    ],
    departmentBreakdown: [
      { label: "Buildings", value: "41%", tone: "success" },
      { label: "Facilities", value: "29%", tone: "info" },
      { label: "Transport support", value: "18%", tone: "warning" },
      { label: "Emergency works", value: "12%", tone: "neutral" },
    ],
    readinessChecklist: [
      { label: "Pricing approved", detail: "Commercial lines checked against current unit rates", status: "complete" },
      { label: "SBD forms complete", detail: "Mandatory declarations are attached and signed", status: "complete" },
      { label: "Contractor coverage", detail: "Seven contractors mapped to the opportunity scope", status: "inReview" },
      { label: "Submission pack lock", detail: "Awaiting final executive approval", status: "pending" },
    ],
  },
  {
    id: "rfq-2026-021",
    rfqNumber: "RFQ-2026-021",
    client: "Ekurhuleni Metropolitan Municipality",
    municipality: "Ekurhuleni",
    department: "Health",
    closingDate: "2026-07-18",
    assignedContractors: 5,
    submissionReadiness: 72,
    submissionProgress: 61,
    estimatedValue: 12900000,
    status: "closingSoon",
    summary: "Health facility support package moving into final documentation and submission sequencing.",
    coordinator: "Lerato Nkosi",
    riskNote: "Medium risk. One compliance attachment still requires verification.",
    contractors: ["Nexus Health", "Kopano Services", "MetroCare", "Apex Compliance"],
    timeline: [
      { label: "RFQ logged", detail: "Register entry created from the incoming pack", date: "2026-07-09", tone: "info" },
      { label: "Scope review", detail: "Facility and service lines confirmed", date: "2026-07-11", tone: "success" },
      { label: "Document gap", detail: "One attachment still awaiting sign-off", date: "2026-07-13", tone: "warning" },
      { label: "Closing", detail: "Closing before end of business", date: "2026-07-18", tone: "warning" },
    ],
    municipalityBreakdown: [
      { label: "Germiston", value: "33%", tone: "success" },
      { label: "Kempton Park", value: "31%", tone: "info" },
      { label: "Tembisa", value: "20%", tone: "warning" },
      { label: "Springs", value: "16%", tone: "neutral" },
    ],
    departmentBreakdown: [
      { label: "Primary care", value: "46%", tone: "success" },
      { label: "Emergency services", value: "24%", tone: "info" },
      { label: "Administration", value: "18%", tone: "warning" },
      { label: "Logistics", value: "12%", tone: "neutral" },
    ],
    readinessChecklist: [
      { label: "Compliance pack", detail: "Awaiting final file verification", status: "inReview" },
      { label: "Pricing finalised", detail: "Commercial review completed", status: "complete" },
      { label: "Submission slots", detail: "Upload and closing sequence reserved", status: "pending" },
      { label: "Executive decision", detail: "No escalation required at this stage", status: "complete" },
    ],
  },
  {
    id: "rfq-2026-033",
    rfqNumber: "RFQ-2026-033",
    client: "City of Tshwane",
    municipality: "Tshwane",
    department: "Transport",
    closingDate: "2026-07-19",
    assignedContractors: 4,
    submissionReadiness: 55,
    submissionProgress: 48,
    estimatedValue: 9700000,
    status: "atRisk",
    summary: "Transport support pack with pricing pressure and incomplete contractor evidence.",
    coordinator: "Sibusiso Mthembu",
    riskNote: "High risk. Evidence gaps and margin compression need immediate review.",
    contractors: ["RoadPro Alliance", "CityFleet Works", "Northline Civils"],
    timeline: [
      { label: "Initial intake", detail: "Opportunity logged from tender monitoring", date: "2026-07-08", tone: "info" },
      { label: "Margin review", detail: "Commercial threshold moved below target", date: "2026-07-11", tone: "danger" },
      { label: "Evidence collection", detail: "Two supporting documents still pending", date: "2026-07-13", tone: "warning" },
      { label: "Closing", detail: "Weekend submission cut-off approaching", date: "2026-07-19", tone: "danger" },
    ],
    municipalityBreakdown: [
      { label: "Region 1", value: "42%", tone: "warning" },
      { label: "Region 2", value: "28%", tone: "info" },
      { label: "Region 3", value: "17%", tone: "neutral" },
      { label: "Region 4", value: "13%", tone: "danger" },
    ],
    departmentBreakdown: [
      { label: "Road maintenance", value: "39%", tone: "warning" },
      { label: "Fleet support", value: "33%", tone: "info" },
      { label: "Traffic services", value: "17%", tone: "neutral" },
      { label: "Incident response", value: "11%", tone: "danger" },
    ],
    readinessChecklist: [
      { label: "Contractor evidence", detail: "Two documents still missing", status: "blocked" },
      { label: "Pricing review", detail: "Margin threshold under pressure", status: "inReview" },
      { label: "Compliance forms", detail: "Core forms already attached", status: "complete" },
      { label: "Submission release", detail: "Hold until evidence is resolved", status: "pending" },
    ],
  },
  {
    id: "rfq-2026-041",
    rfqNumber: "RFQ-2026-041",
    client: "Buffalo City Metro",
    municipality: "Buffalo City",
    department: "Environmental Services",
    closingDate: "2026-07-22",
    assignedContractors: 6,
    submissionReadiness: 91,
    submissionProgress: 83,
    estimatedValue: 6800000,
    status: "ready",
    summary: "Environmental services pack is complete and ready for submission approval.",
    coordinator: "Thandi Maseko",
    riskNote: "Low risk. Submission can move to executive approval on completion of final review.",
    contractors: ["EcoServe SA", "GreenLine Municipal", "BlueRiver Maintenance"],
    timeline: [
      { label: "Pack assembled", detail: "All supporting documentation combined", date: "2026-07-12", tone: "success" },
      { label: "Quality check", detail: "No outstanding compliance exceptions", date: "2026-07-13", tone: "info" },
      { label: "Executive review", detail: "Ready for approval and sign-off", date: "2026-07-21", tone: "warning" },
      { label: "Closing", detail: "Submission window remains open through midweek", date: "2026-07-22", tone: "success" },
    ],
    municipalityBreakdown: [
      { label: "East London", value: "44%", tone: "success" },
      { label: "Mdantsane", value: "25%", tone: "info" },
      { label: "Beacon Bay", value: "18%", tone: "warning" },
      { label: "Rural zones", value: "13%", tone: "neutral" },
    ],
    departmentBreakdown: [
      { label: "Waste management", value: "48%", tone: "success" },
      { label: "Parks", value: "24%", tone: "info" },
      { label: "Environmental control", value: "17%", tone: "warning" },
      { label: "Recycling", value: "11%", tone: "neutral" },
    ],
    readinessChecklist: [
      { label: "Pack complete", detail: "All mandatory documentation captured", status: "complete" },
      { label: "Commercial review", detail: "Pricing approved by the finance lead", status: "complete" },
      { label: "Submission sequence", detail: "Awaiting executive release", status: "pending" },
      { label: "Risk checks", detail: "No blocker recorded", status: "complete" },
    ],
  },
  {
    id: "rfq-2026-052",
    rfqNumber: "RFQ-2026-052",
    client: "Nelson Mandela Bay Municipality",
    municipality: "Nelson Mandela Bay",
    department: "Finance",
    closingDate: "2026-07-24",
    assignedContractors: 3,
    submissionReadiness: 64,
    submissionProgress: 58,
    estimatedValue: 4200000,
    status: "submitted",
    summary: "Finance support opportunity is submitted and awaiting confirmation of receipt.",
    coordinator: "Zanele Khumalo",
    riskNote: "Submission complete. Monitor for confirmation and clarification requests.",
    contractors: ["Bay Advisory", "LedgerWorks", "SouthPort Business Services"],
    timeline: [
      { label: "Submission sent", detail: "Pack uploaded through the register workflow", date: "2026-07-16", tone: "success" },
      { label: "Receipt pending", detail: "Client acknowledgement not yet returned", date: "2026-07-17", tone: "warning" },
      { label: "Clarification watch", detail: "Monitor mailbox for follow-up requirements", date: "2026-07-21", tone: "info" },
      { label: "Closing", detail: "Register remains open for record tracking", date: "2026-07-24", tone: "success" },
    ],
    municipalityBreakdown: [
      { label: "Port Elizabeth", value: "39%", tone: "info" },
      { label: "Uitenhage", value: "31%", tone: "success" },
      { label: "Despatch", value: "18%", tone: "warning" },
      { label: "Coastal wards", value: "12%", tone: "neutral" },
    ],
    departmentBreakdown: [
      { label: "Budget control", value: "45%", tone: "success" },
      { label: "Procurement", value: "26%", tone: "info" },
      { label: "Treasury support", value: "17%", tone: "warning" },
      { label: "Reporting", value: "12%", tone: "neutral" },
    ],
    readinessChecklist: [
      { label: "Submission sent", detail: "Confirmation of receipt still pending", status: "complete" },
      { label: "Reference number", detail: "Client reference captured in the register", status: "complete" },
      { label: "Clarification plan", detail: "Response template prepared", status: "inReview" },
      { label: "Archive record", detail: "Ready for audit trail retention", status: "complete" },
    ],
  },
  {
    id: "rfq-2026-063",
    rfqNumber: "RFQ-2026-063",
    client: "Msunduzi Local Municipality",
    municipality: "Msunduzi",
    department: "Roads and Stormwater",
    closingDate: "2026-07-26",
    assignedContractors: 8,
    submissionReadiness: 78,
    submissionProgress: 69,
    estimatedValue: 22100000,
    status: "ready",
    summary: "Roads and stormwater framework with strong contractor coverage and pricing headroom.",
    coordinator: "Ayanda Cele",
    riskNote: "Moderate risk only. Coordination across large contractor pool needs discipline.",
    contractors: ["Ascent Infrastructure", "Zulu Earthworks", "HarborLine Contractors", "CivicRoad Alliance"],
    timeline: [
      { label: "Scope mapped", detail: "Primary works packages aligned to the bid scope", date: "2026-07-14", tone: "success" },
      { label: "Contractor matching", detail: "Eight contractors mapped into workstreams", date: "2026-07-16", tone: "info" },
      { label: "Commercial check", detail: "Margin support remains healthy", date: "2026-07-22", tone: "warning" },
      { label: "Closing", detail: "Submission window closes late in the week", date: "2026-07-26", tone: "success" },
    ],
    municipalityBreakdown: [
      { label: "Pietermaritzburg", value: "36%", tone: "success" },
      { label: "Northdale", value: "24%", tone: "info" },
      { label: "Linxn", value: "21%", tone: "warning" },
      { label: "Regional works", value: "19%", tone: "neutral" },
    ],
    departmentBreakdown: [
      { label: "Roads", value: "47%", tone: "success" },
      { label: "Stormwater", value: "28%", tone: "info" },
      { label: "Bridges", value: "15%", tone: "warning" },
      { label: "Drainage", value: "10%", tone: "neutral" },
    ],
    readinessChecklist: [
      { label: "Contractor matrix", detail: "All eight contractors have active profiles", status: "complete" },
      { label: "BOQ alignment", detail: "Scope cross-check completed", status: "complete" },
      { label: "Submission narrative", detail: "Executive summary under review", status: "inReview" },
      { label: "Final pack release", detail: "Pending final sign-off", status: "pending" },
    ],
  },
  {
    id: "rfq-2026-074",
    rfqNumber: "RFQ-2026-074",
    client: "City of Cape Town",
    municipality: "Cape Town",
    department: "Utilities",
    closingDate: "2026-07-29",
    assignedContractors: 2,
    submissionReadiness: 44,
    submissionProgress: 31,
    estimatedValue: 11500000,
    status: "atRisk",
    summary: "Utilities opportunity has limited contractor capacity and requires immediate resolution.",
    coordinator: "Mpho Letsoalo",
    riskNote: "High risk. Two contractor slots are covered, but scope gaps remain open.",
    contractors: ["Western Utility Works", "Harbour Maintenance"],
    timeline: [
      { label: "Register entry", detail: "Opportunity captured from the incoming tender feed", date: "2026-07-11", tone: "info" },
      { label: "Capacity review", detail: "Only two contractors are ready against the full scope", date: "2026-07-14", tone: "danger" },
      { label: "Gap closure", detail: "Additional capability still needed", date: "2026-07-25", tone: "warning" },
      { label: "Closing", detail: "Late-month deadline with unresolved risk", date: "2026-07-29", tone: "danger" },
    ],
    municipalityBreakdown: [
      { label: "Metro north", value: "34%", tone: "warning" },
      { label: "Metro south", value: "29%", tone: "info" },
      { label: "Atlantic corridor", value: "22%", tone: "danger" },
      { label: "Outer ring", value: "15%", tone: "neutral" },
    ],
    departmentBreakdown: [
      { label: "Water", value: "40%", tone: "warning" },
      { label: "Energy", value: "31%", tone: "info" },
      { label: "Waste", value: "18%", tone: "danger" },
      { label: "Networks", value: "11%", tone: "neutral" },
    ],
    readinessChecklist: [
      { label: "Contractor coverage", detail: "Only two capability matches secured", status: "blocked" },
      { label: "Scope closure", detail: "Open items still need resolution", status: "inReview" },
      { label: "Commercial buffer", detail: "Margin protection remains under review", status: "pending" },
      { label: "Escalation", detail: "Executive review required", status: "blocked" },
    ],
  },
  {
    id: "rfq-2026-081",
    rfqNumber: "RFQ-2026-081",
    client: "Mogale City",
    municipality: "Mogale City",
    department: "Housing",
    closingDate: "2026-08-01",
    assignedContractors: 5,
    submissionReadiness: 88,
    submissionProgress: 92,
    estimatedValue: 14300000,
    status: "submitted",
    summary: "Housing submission is complete, traceable, and prepared for award monitoring.",
    coordinator: "Rhandzu Moyo",
    riskNote: "Very low risk. Awaiting confirmation and award movement.",
    contractors: ["HomeBuild Partners", "Metro Housing Group", "BlueBrick Solutions"],
    timeline: [
      { label: "Pack lodged", detail: "Submission marked complete in the register", date: "2026-07-18", tone: "success" },
      { label: "Receipt confirmed", detail: "Client acknowledgement received", date: "2026-07-19", tone: "info" },
      { label: "Award watch", detail: "Await award window and clarification requests", date: "2026-07-27", tone: "warning" },
      { label: "Closing", detail: "Record remains active for tracking", date: "2026-08-01", tone: "success" },
    ],
    municipalityBreakdown: [
      { label: "Krugersdorp", value: "41%", tone: "success" },
      { label: "Randfontein", value: "28%", tone: "info" },
      { label: "Kagiso", value: "19%", tone: "warning" },
      { label: "Carletonville", value: "12%", tone: "neutral" },
    ],
    departmentBreakdown: [
      { label: "Affordable housing", value: "49%", tone: "success" },
      { label: "Site services", value: "25%", tone: "info" },
      { label: "Community works", value: "16%", tone: "warning" },
      { label: "Support services", value: "10%", tone: "neutral" },
    ],
    readinessChecklist: [
      { label: "Submission sent", detail: "Reference captured and tracked", status: "complete" },
      { label: "Pack archive", detail: "Final pack stored for audit", status: "complete" },
      { label: "Award monitoring", detail: "Awaiting award movement", status: "inReview" },
      { label: "Clarification window", detail: "No follow-up issued yet", status: "complete" },
    ],
  },
];

export function getOpportunityRegisterRecordById(id: string) {
  return opportunityRegisterRecords.find((record) => record.id === id);
}

export const opportunityRegisterMunicipalities = Array.from(
  new Set(opportunityRegisterRecords.map((record) => record.municipality))
).sort();

export const opportunityRegisterDepartments = Array.from(
  new Set(opportunityRegisterRecords.map((record) => record.department))
).sort();

export const opportunityRegisterStatuses: OpportunityRegisterStatus[] = ["ready", "closingSoon", "submitted", "atRisk", "awarded"];

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

