import type { Deal } from "@/types/deal";
import { hasResolvedContractorBusinessIdentity } from "@/lib/contractors/contractorBusinessIdentity";
import {
  buildOpportunityRequirementDetails,
  calculateProfileCompleteness,
  calculateSubmissionReadiness,
  createComplianceRemediationRequests,
  requirementStatusToComplianceStatus,
  type ComplianceRemediationRequest,
  type OpportunityRequirementDetail,
  type OpportunityRequirementInput,
} from "@/lib/opportunities/opportunityComplianceRemediation";

export type OpportunityExecutionPhase = "INTAKE_COMPLETE" | "REQUIREMENTS_REVIEW" | "MATCHING_REQUIRED" | "CONTRACTOR_ASSIGNED" | "COMPLIANCE_REVIEW" | "BOQ_PRICING" | "DOCUMENT_PREPARATION" | "INTERNAL_REVIEW" | "CONTRACTOR_APPROVAL" | "PACK_GENERATION" | "READY_FOR_SUBMISSION" | "SUBMITTED" | "AWARDED" | "UNSUCCESSFUL" | "CANCELLED";
export type OpportunityComplianceStatus = "VALID" | "MISSING" | "EXPIRED" | "UNVERIFIED" | "UNCLASSIFIED" | "INVALID" | "WRONG_CONTRACTOR" | "DUPLICATE" | "NOT_APPLICABLE" | "REQUIRES_REVIEW" | "REQUIRES_MANUAL_REVIEW";
export type OpportunityTaskStatus = "not_started" | "in_progress" | "complete" | "blocked" | "not_applicable";
export type OpportunityStageStatus = "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE" | "NOT_APPLICABLE";
export type OpportunityActionKey = "review_requirements" | "find_matching_contractors" | "assign_contractor" | "open_contractor" | "open_execution_workspace" | "change_assignment" | "remove_assignment" | "start_compliance_review" | "open_missing_documents" | "open_supplier_quotes" | "open_tender_intelligence" | "open_boq_pricing" | "open_submission_review" | "prepare_documents" | "start_internal_review" | "contractor_approval" | "generate_tender_pack" | "mark_ready_for_submission" | "record_submission";
export type OpportunityStageKey = "requirements" | "assignment" | "compliance" | "supplierQuotes" | "tenderIntelligence" | "boq" | "documents" | "internalReview" | "contractorApproval" | "tenderPack" | "submission";
export type ProcurementNextActionKey = "ASSIGN_CONTRACTOR" | "REMEDIATE_COMPLIANCE" | "UPLOAD_OR_APPROVE_SUPPLIER_QUOTE" | "REVIEW_TENDER_ANALYSIS" | "MAP_QUOTES_TO_TENDER_LINES" | "COMPLETE_PRICING" | "APPROVE_PRICING" | "GENERATE_PRICED_DOCUMENT" | "COMPLETE_DOCUMENTS" | "COMPLETE_SUBMISSION_REVIEW" | "GENERATE_TENDER_PACK" | "READY_FOR_SUBMISSION" | "RECORD_SUBMISSION" | "REQUEST_TCS_PIN" | "VERIFY_TCS_WITH_SARS" | "RESOLVE_TAX_IDENTITY_MISMATCH" | "REQUEST_TAX_REMEDIATION" | "REVERIFY_TCS" | "TAX_VERIFICATION_COMPLETE";
type AnyRecord = Record<string, unknown>;

export type OpportunityRequirementReview = {
  rfqNumber: string | null;
  clientIssuer: string | null;
  municipalityOrOrganOfState: string | null;
  department: string | null;
  closingDateTime: string | null;
  compulsoryBriefing: boolean | null;
  submissionMethod: string | null;
  serviceCategory: string | null;
  location: string | null;
  cidbRequirement: string | null;
  csdRequirement: boolean;
  taxRequirement: boolean;
  sarsVerificationRequired: boolean;
  bbbeeRequirement: boolean;
  coidaRequirement: boolean;
  bankingRequirement: boolean;
  compulsoryReturnables: string[];
  boqPricingSchedulePresent: boolean;
  formsRequiringCompletion: string[];
  annexuresAndAmendments: string[];
  signatureRequired: boolean;
  reviewed: boolean;
  reviewedAt?: string | null;
  reviewedByUid?: string | null;
};

export type OpportunityAction = { key: OpportunityActionKey; label: string; enabled: boolean; reason: string | null; href?: string };
export type OpportunityAssignmentState = {
  contractorId: string | null;
  contractorName: string | null;
  assignedAt: string | null;
  assignedBy: string | null;
  assignedByEmail: string | null;
  assignmentStatus: "unassigned" | "assigned" | "invalid" | "blocked";
  assignmentReason: string | null;
  opportunityId: string;
  dealId: string;
  workspaceId: string | null;
  executionWorkspaceId: string | null;
  complete: boolean;
  canRemove: boolean;
};
export type OpportunityComplianceCheck = {
  key: "tax" | "csd" | "bbbee" | "coida" | "cidb" | "banking" | "tenderSpecific";
  label: string;
  required: boolean;
  status: OpportunityStageStatus;
  blocker: string | null;
};
export type OpportunityDocumentChecklistItem = {
  key: string;
  label: string;
  required: boolean;
  status: OpportunityStageStatus;
  source: string | null;
};
export type OpportunityExecutionStage = {
  key: OpportunityStageKey;
  title: string;
  status: OpportunityStageStatus;
  owner: string;
  summary: string;
  blockers: string[];
  actionKey?: OpportunityActionKey;
};
export type OpportunityNextAction = {
  label: string;
  owner: string;
  dueBefore: string | null;
  blocker: string | null;
  actionKey: OpportunityActionKey | null;
};
export type OpportunityExecutionState = {
  currentPhase: OpportunityExecutionPhase;
  nextAction: string;
  nextActionDetail: OpportunityNextAction;
  blockers: string[];
  assignedOwner: string;
  dueDate: string | null;
  daysRemaining: number | null;
  readiness: number;
  profileCompleteness: number;
  generalCompliance: number;
  opportunityMatch: number;
  submissionReadiness: number;
  contractorId: string | null;
  contractorName: string | null;
  dealId: string;
  executionWorkspaceId: string;
  boqRequired: boolean;
  pricingRequired: boolean;
  complianceStatus: OpportunityComplianceStatus;
  documentStatus: OpportunityTaskStatus;
  reviewStatus: OpportunityTaskStatus;
  submissionStatus: OpportunityTaskStatus;
  requirements: OpportunityRequirementReview;
  assignment: OpportunityAssignmentState;
  submissionReviewConnected: boolean;
  complianceChecks: OpportunityComplianceCheck[];
  complianceRequirements: OpportunityRequirementDetail[];
  remediationRequests: ComplianceRemediationRequest[];
  documentChecklist: OpportunityDocumentChecklistItem[];
  stages: OpportunityExecutionStage[];
  actions: OpportunityAction[];
};

export type ContractorMatchResult = {
  contractorId: string;
  contractorName: string;
  matchScore: number;
  readiness: number;
  profileCompleteness: number;
  generalCompliance: number;
  opportunityMatch: number;
  submissionReadiness: number;
  missingDocuments: string[];
  validRequirementsCount: number;
  missingCount: number;
  expiredCount: number;
  reviewRequiredCount: number;
  complianceDetails: OpportunityRequirementDetail[];
  disqualifyingRequirements: string[];
  recommendationReason: string;
  complianceStatus: OpportunityComplianceStatus;
  eligible: boolean;
  assignmentAllowed: boolean;
  blockingReasons: string[];
  readinessDecisionStatus?: "READY" | "BLOCKED" | "UNRESOLVED" | "STALE" | "UNKNOWN";
  decisionLogicVersion?: string | null;
  authorityStatus?: "ALLOWED" | "BLOCKED";
};

export const OPPORTUNITY_PHASES: OpportunityExecutionPhase[] = [
  "INTAKE_COMPLETE", "REQUIREMENTS_REVIEW", "MATCHING_REQUIRED", "CONTRACTOR_ASSIGNED", "COMPLIANCE_REVIEW",
  "BOQ_PRICING", "DOCUMENT_PREPARATION", "INTERNAL_REVIEW", "CONTRACTOR_APPROVAL", "PACK_GENERATION",
  "READY_FOR_SUBMISSION", "SUBMITTED", "AWARDED", "UNSUCCESSFUL", "CANCELLED",
];

function rec(value: unknown): AnyRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : {}; }
function str(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function bool(value: unknown): boolean { return value === true; }
function arr(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : [];
}
function pct(value: unknown): number { return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0; }
function textHas(text: string, token: string): boolean { return Boolean(token.trim()) && text.toLowerCase().includes(token.toLowerCase()); }
function normalize(value: unknown): string { return str(value)?.toLowerCase() ?? ""; }
export function normalizeCidbRequirement(value: unknown): string | null {
  const raw = str(value);
  if (!raw) return null;
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (["notrequired", "na", "none", "notapplicable"].includes(normalized)) return null;
  return raw;
}
function docName(doc: AnyRecord): string { return [doc.documentType, doc.name, doc.fileName, doc.title, doc.category].map(str).filter(Boolean).join(" "); }
function allDocs(source: AnyRecord): AnyRecord[] {
  const intake = rec(source.opportunityIntake);
  return [...(Array.isArray(source.documents) ? source.documents.map(rec) : []), ...(Array.isArray(intake.uploadedDocuments) ? intake.uploadedDocuments.map(rec) : [])];
}
function hasDocument(docs: AnyRecord[], tokens: string[]): AnyRecord | null {
  return docs.find((doc) => tokens.some((token) => textHas(docName(doc), token))) ?? null;
}
function phaseIndex(phase: OpportunityExecutionPhase): number { return OPPORTUNITY_PHASES.indexOf(phase); }
function isAtLeast(phase: OpportunityExecutionPhase, target: OpportunityExecutionPhase): boolean { return phaseIndex(phase) >= phaseIndex(target); }

function requiresLiveSarsVerification(existing: AnyRecord): boolean {
  if (typeof existing.sarsVerificationRequired === 'boolean') return existing.sarsVerificationRequired;
  if (typeof existing.requiresCurrentSarsVerification === 'boolean') return existing.requiresCurrentSarsVerification;
  return Array.isArray(existing.requiredVerificationSources)
    ? existing.requiredVerificationSources.some((item) => String(item).toUpperCase() === 'SARS_TCS')
    : false;
}

export function normalizeOpportunityPhase(value: unknown): OpportunityExecutionPhase | null {
  return OPPORTUNITY_PHASES.includes(value as OpportunityExecutionPhase) ? value as OpportunityExecutionPhase : null;
}

function assignedContractorId(source: AnyRecord): string | null {
  const assignment = rec(source.contractorAssignment);
  const execution = rec(source.opportunityExecution);
  const value = str(assignment.contractorId) ?? str(execution.contractorId) ?? str(source.contractorId) ?? str(source.assignedContractorId) ?? str(source.linkedContractorId) ?? str(source.contractorUid) ?? str(source.companyId);
  return value && value !== "unassigned" ? value : null;
}

export function extractOpportunityRequirements(deal: Deal | AnyRecord): OpportunityRequirementReview {
  const source = rec(deal);
  const execution = rec(source.opportunityExecution);
  const existing = rec(execution.requirements ?? source.requirementsReview);
  const analysis = rec(source.tenderAnalysis);
  const intake = rec(source.opportunityIntake);
  const draft = rec(intake.draft);
  const docs = allDocs(source);
  const required = arr(analysis.requiredCertificates);
  const blob = [source.title, source.description, source.category, analysis.scope, ...required, JSON.stringify(docs)].filter(Boolean).join(" ");
  const hasDoc = (token: string) => Boolean(hasDocument(docs, [token]));
  const hasBoq = hasDoc("boq") || hasDoc("pricing schedule") || textHas(blob, "boq") || textHas(blob, "pricing schedule") || textHas(blob, "bill of quantities");
  const forms = arr(existing.formsRequiringCompletion);
  const annexures = arr(existing.annexuresAndAmendments);
  return {
    rfqNumber: str(existing.rfqNumber) ?? str(source.rfqNumber) ?? str(source.tenderNumber) ?? str(analysis.tenderNumber),
    clientIssuer: str(existing.clientIssuer) ?? str(source.clientName) ?? str(source.issuingAuthority) ?? str(analysis.issuingAuthority),
    municipalityOrOrganOfState: str(existing.municipalityOrOrganOfState) ?? str(source.municipalityName) ?? str(source.organOfState) ?? str(analysis.location),
    department: str(existing.department) ?? str(source.department) ?? str(draft.department),
    closingDateTime: str(existing.closingDateTime) ?? str(source.closingDate) ?? str(source.deadline) ?? str(analysis.deadline),
    compulsoryBriefing: typeof existing.compulsoryBriefing === "boolean" ? existing.compulsoryBriefing : textHas(blob, "compulsory briefing") || textHas(blob, "compulsory site"),
    submissionMethod: str(existing.submissionMethod) ?? str(source.submissionMethod) ?? (textHas(blob, "portal") ? "portal" : textHas(blob, "email") ? "email" : null),
    serviceCategory: str(existing.serviceCategory) ?? str(source.category) ?? str(draft.category),
    location: str(existing.location) ?? str(analysis.location) ?? str(source.province) ?? str(source.municipalityName),
    cidbRequirement: normalizeCidbRequirement(str(existing.cidbRequirement) ?? required.find((item) => /cidb/i.test(item))),
    csdRequirement: typeof existing.csdRequirement === "boolean" ? existing.csdRequirement : textHas(blob, "csd"),
    taxRequirement: typeof existing.taxRequirement === "boolean" ? existing.taxRequirement : textHas(blob, "tax") || textHas(blob, "sars"),
    sarsVerificationRequired: requiresLiveSarsVerification(existing),
    bbbeeRequirement: typeof existing.bbbeeRequirement === "boolean" ? existing.bbbeeRequirement : /b[-\s]?bbbee/i.test(blob),
    coidaRequirement: typeof existing.coidaRequirement === "boolean" ? existing.coidaRequirement : textHas(blob, "coida") || textHas(blob, "compensation fund"),
    bankingRequirement: typeof existing.bankingRequirement === "boolean" ? existing.bankingRequirement : textHas(blob, "bank") || textHas(blob, "banking"),
    compulsoryReturnables: arr(existing.compulsoryReturnables).length ? arr(existing.compulsoryReturnables) : required,
    boqPricingSchedulePresent: typeof existing.boqPricingSchedulePresent === "boolean" ? existing.boqPricingSchedulePresent : hasBoq,
    formsRequiringCompletion: forms.length ? forms : ["SBD forms", "Declarations"],
    annexuresAndAmendments: annexures.length ? annexures : docs.filter((doc) => /annex|amend/i.test(docName(doc))).map((doc) => str(doc.name) ?? str(doc.fileName) ?? "Annexure/amendment"),
    signatureRequired: typeof existing.signatureRequired === "boolean" ? existing.signatureRequired : true,
    reviewed: bool(existing.reviewed) || bool(source.requirementsReviewed),
    reviewedAt: str(existing.reviewedAt),
    reviewedByUid: str(existing.reviewedByUid),
  };
}

function contractorFieldValid(contractor: AnyRecord, keys: string[]): boolean {
  return keys.some((key) => contractor[key] === true || ["valid", "verified", "active", "compliant", "yes"].includes(normalize(contractor[key])));
}

function opportunityRequirementInputs(requirements: OpportunityRequirementReview): OpportunityRequirementInput[] {
  const tenderSpecificRequired = requirements.compulsoryReturnables.some((item) => !/tax|bbbee|b-bbee|coida|csd|cidb|bank/i.test(item));
  return [
    { key: "tax", name: "Tax Compliance", required: requirements.taxRequirement, validKeys: ["taxValid", "taxVerified", "taxCompliant", "taxClearanceValid", "taxClearanceStatus"], tokens: ["tax", "tax compliance", "tax clearance", "sars", "tcs"] },
    { key: "csd", name: "CSD", required: requirements.csdRequirement, validKeys: ["csdValid", "csdVerified", "hasCsd", "csdNumber", "csdStatus"], tokens: ["csd", "central supplier database"] },
    { key: "bbbee", name: "B-BBEE", required: requirements.bbbeeRequirement, validKeys: ["bbbeeValid", "bbbeeVerified", "hasBbbee", "bbbeeStatus"], tokens: ["bbbee", "b-bbee", "bee"] },
    { key: "coida", name: "COIDA", required: requirements.coidaRequirement, validKeys: ["coidaValid", "coidaVerified", "hasCoida", "coidaStatus"], tokens: ["coida", "compensation fund"] },
    { key: "cidb", name: "CIDB", required: normalizeCidbRequirement(requirements.cidbRequirement) !== null, validKeys: ["cidbValid", "cidbVerified", "hasCidb", "cidbStatus"], tokens: ["cidb"] },
    { key: "banking", name: "Banking", required: requirements.bankingRequirement, validKeys: ["bankingValid", "bankVerified", "bankConfirmationValid", "bankStatus"], tokens: ["bank", "banking", "bank confirmation"] },
    { key: "tenderSpecific", name: "Tender-specific documents", required: tenderSpecificRequired, validKeys: requirements.compulsoryReturnables.map((item) => item.replace(/\s+/g, "")), tokens: requirements.compulsoryReturnables.filter((item) => !/tax|bbbee|b-bbee|coida|csd|cidb|bank/i.test(item)) },
  ];
}

function buildRequirementDetails(requirements: OpportunityRequirementReview, contractor: AnyRecord | null, dueDate: string | null, workspaceId: string | null): OpportunityRequirementDetail[] {
  return buildOpportunityRequirementDetails({
    requirements: opportunityRequirementInputs(requirements),
    contractor,
    contractorId: contractor ? str(contractor.contractorId) ?? str(contractor.id) : null,
    workspaceId,
    dueDate,
  });
}

function complianceStageStatus(status: OpportunityRequirementDetail["status"]): OpportunityStageStatus {
  if (status === "VALID") return "COMPLETE";
  if (status === "NOT_APPLICABLE") return "NOT_APPLICABLE";
  return "BLOCKED";
}

export function buildComplianceChecks(requirements: OpportunityRequirementReview, contractor: AnyRecord | null): OpportunityComplianceCheck[] {
  const missingDocs = new Set(arr(contractor?.missingCriticalDocuments ?? contractor?.missingDocuments).map((item) => item.toLowerCase()));
  const expiredDocs = new Set(arr(contractor?.expiredDocuments).map((item) => item.toLowerCase()));
  const check = (key: OpportunityComplianceCheck["key"], label: string, required: boolean, validKeys: string[], tokens: string[]): OpportunityComplianceCheck => {
    if (!required) return { key, label, required, status: "NOT_APPLICABLE", blocker: null };
    if (!contractor) return { key, label, required, status: "BLOCKED", blocker: label + " cannot be checked until a contractor is assigned" };
    const tokenMissing = tokens.some((token) => missingDocs.has(token.toLowerCase()));
    const tokenExpired = tokens.some((token) => expiredDocs.has(token.toLowerCase()));
    if (tokenExpired) return { key, label, required, status: "BLOCKED", blocker: label + " document is expired" };
    if (contractorFieldValid(contractor, validKeys) && !tokenMissing) return { key, label, required, status: "COMPLETE", blocker: null };
    return { key, label, required, status: "BLOCKED", blocker: "Upload contractor " + label };
  };
  const tenderSpecificRequired = requirements.compulsoryReturnables.some((item) => !/tax|bbbee|b-bbee|coida|csd|cidb|bank/i.test(item));
  const tenderSpecificMissing = requirements.compulsoryReturnables.filter((item) => tenderSpecificRequired && contractor && !contractorFieldValid(contractor, [item, item.replace(/\s+/g, "")]));
  const checks = [
    check("tax", "Tax", requirements.taxRequirement, ["taxValid", "taxVerified", "taxCompliant", "taxClearanceValid", "taxClearanceStatus"], ["tax", "tax compliance"]),
    check("csd", "CSD", requirements.csdRequirement, ["csdValid", "csdVerified", "hasCsd", "csdNumber", "csdStatus"], ["csd"]),
    check("bbbee", "B-BBEE", requirements.bbbeeRequirement, ["bbbeeValid", "bbbeeVerified", "hasBbbee", "bbbeeStatus"], ["bbbee", "b-bbee"]),
    check("coida", "COIDA", requirements.coidaRequirement, ["coidaValid", "coidaVerified", "hasCoida", "coidaStatus"], ["coida"]),
    check("cidb", "CIDB", normalizeCidbRequirement(requirements.cidbRequirement) !== null, ["cidbValid", "cidbVerified", "hasCidb", "cidbStatus"], ["cidb"]),
    check("banking", "Banking", requirements.bankingRequirement, ["bankingValid", "bankVerified", "bankConfirmationValid", "bankStatus"], ["bank", "banking"]),
  ];
  checks.push({
    key: "tenderSpecific",
    label: "Tender-specific documents",
    required: tenderSpecificRequired,
    status: !tenderSpecificRequired ? "NOT_APPLICABLE" : tenderSpecificMissing.length ? "BLOCKED" : contractor ? "COMPLETE" : "BLOCKED",
    blocker: !tenderSpecificRequired ? null : tenderSpecificMissing.length ? "Upload " + tenderSpecificMissing[0] : contractor ? null : "Contractor assignment required",
  });
  return checks;
}

export function evaluateOpportunityCompliance(requirements: OpportunityRequirementReview, contractor: AnyRecord | null, workspaceId: string | null = null): { status: OpportunityComplianceStatus; missing: string[]; expired: string[]; details: OpportunityRequirementDetail[] } {
  const details = buildRequirementDetails(requirements, contractor, requirements.closingDateTime, workspaceId ?? str(contractor?.workspaceId));
  if (!contractor) return { status: "MISSING", missing: ["Contractor assignment required"], expired: [], details };
  const unresolved = details.filter((detail) => detail.required && detail.status !== "VALID" && detail.status !== "NOT_APPLICABLE");
  const missing = unresolved.filter((detail) => detail.status !== "EXPIRED").map((detail) => detail.reason);
  const expired = unresolved.filter((detail) => detail.status === "EXPIRED").map((detail) => detail.requirementName);
  return { status: requirementStatusToComplianceStatus(details), missing, expired, details };
}

function executionFlags(deal: Deal | AnyRecord) {
  const source = rec(deal);
  const execution = rec(source.opportunityExecution);
  return {
    requirementsReviewed: bool(execution.requirementsReviewed) || bool(source.requirementsReviewed),
    matchingCompleted: bool(execution.matchingCompleted) || bool(source.matchingCompleted),
    complianceStarted: bool(execution.complianceStarted) || bool(execution.complianceReviewed),
    complianceReviewed: bool(execution.complianceReviewed),
    boqTaskCreated: bool(execution.boqTaskCreated),
    pricingComplete: bool(execution.pricingComplete) || ["manager_approved", "complete"].includes(normalize(source.pricingStatus)),
    documentsPrepared: bool(execution.documentsPrepared),
    internalReviewStarted: bool(execution.internalReviewStarted) || bool(execution.internalReviewApproved),
    internalReviewApproved: bool(execution.internalReviewApproved),
    contractorApprovalRequested: bool(execution.contractorApprovalRequested) || bool(execution.contractorApprovalComplete),
    contractorApprovalComplete: bool(execution.contractorApprovalComplete),
    tenderPackGenerated: bool(execution.tenderPackGenerated),
    tenderPackValidated: bool(execution.tenderPackValidated),
    readyForSubmission: bool(execution.readyForSubmission),
    submitted: bool(execution.submitted) || normalize(source.status) === "submitted" || normalize(source.stage) === "submitted",
  };
}

export function deriveOpportunityPhase(input: { deal: Deal | AnyRecord; contractor?: AnyRecord | null }): OpportunityExecutionPhase {
  const source = rec(input.deal);
  const forced = normalizeOpportunityPhase(rec(source.opportunityExecution).currentPhase ?? source.workflowStatus);
  if (forced && ["AWARDED", "UNSUCCESSFUL", "CANCELLED"].includes(forced)) return forced;
  if (["awarded", "won"].includes(normalize(source.status)) || ["awarded", "won"].includes(normalize(source.stage))) return "AWARDED";
  if (["lost", "rejected"].includes(normalize(source.stage))) return "UNSUCCESSFUL";
  if (normalize(source.stage) === "closed") return "CANCELLED";
  const f = executionFlags(input.deal);
  const req = extractOpportunityRequirements(input.deal);
  const compliance = evaluateOpportunityCompliance(req, input.contractor ?? null, str(source.workspaceId));
  const assigned = buildAssignmentState(source, input.contractor ?? null).complete;
  if (f.submitted) return "SUBMITTED";
  if (f.readyForSubmission) return "READY_FOR_SUBMISSION";
  if (f.tenderPackGenerated && f.tenderPackValidated && f.contractorApprovalComplete && f.internalReviewApproved) return "READY_FOR_SUBMISSION";
  if (f.contractorApprovalComplete) return "PACK_GENERATION";
  if (f.internalReviewApproved) return "CONTRACTOR_APPROVAL";
  if (f.documentsPrepared) return "INTERNAL_REVIEW";
  if ((req.boqPricingSchedulePresent && f.pricingComplete) || (!req.boqPricingSchedulePresent && f.complianceReviewed && compliance.status === "VALID")) return "DOCUMENT_PREPARATION";
  if (f.complianceReviewed && compliance.status === "VALID") return req.boqPricingSchedulePresent ? "BOQ_PRICING" : "DOCUMENT_PREPARATION";
  if (assigned) return "COMPLIANCE_REVIEW";
  if (f.matchingCompleted || f.requirementsReviewed || req.reviewed) return "MATCHING_REQUIRED";
  return "REQUIREMENTS_REVIEW";
}

function addAction(actions: OpportunityAction[], key: OpportunityActionKey, label: string, enabled: boolean, reason: string | null, href?: string) {
  actions.push({ key, label, enabled, reason: enabled ? null : reason ?? "Action is not valid for the current phase", href });
}

function contractorName(contractor: AnyRecord | null): string | null {
  if (!contractor) return null;
  return str(contractor.companyName) ?? str(contractor.businessName) ?? str(contractor.company) ?? str(contractor.name) ?? str(contractor.tradingName);
}
function canonicalContractorId(contractor: AnyRecord): string | null {
  return str(contractor.contractorId) ?? str(contractor.id) ?? str(contractor.uid) ?? str(contractor.authUid) ?? str(contractor.userId);
}

function isContractorIdentityResolved(contractor: AnyRecord): boolean {
  return hasResolvedContractorBusinessIdentity(contractor);
}

function contractorWorkspaceId(contractor: AnyRecord): string | null {
  const workspace = rec(contractor.workspace);
  return str(contractor.workspaceId) ?? str(workspace.id);
}

function contractorDecisionBlockers(contractor: AnyRecord, dealWorkspaceId: string | null, compliance: ReturnType<typeof evaluateOpportunityCompliance>): string[] {
  const blockers: string[] = [];
  if (!canonicalContractorId(contractor) || !isContractorIdentityResolved(contractor)) blockers.push("Contractor identity is unresolved");
  const contractorWorkspace = contractorWorkspaceId(contractor);
  if (!dealWorkspaceId) blockers.push("Opportunity workspace is unresolved");
  if (!contractorWorkspace) blockers.push("Contractor workspace is unresolved");
  if (dealWorkspaceId && contractorWorkspace && dealWorkspaceId !== contractorWorkspace) blockers.push("Contractor belongs to a different workspace");
  if (isArchivedContractor(contractor)) blockers.push("Contractor is archived");
  if (compliance.status !== "VALID") blockers.push(...compliance.missing, ...compliance.expired.map((item) => item + " expired"));
  return Array.from(new Set(blockers));
}

function isArchivedContractor(contractor: AnyRecord | null): boolean {
  if (!contractor) return false;
  return contractor.archived === true || normalize(contractor.status) === "archived";
}
function buildAssignmentState(source: AnyRecord, contractor: AnyRecord | null): OpportunityAssignmentState {
  const execution = rec(source.opportunityExecution);
  const assignment = rec(source.contractorAssignment ?? execution.assignment);
  const rawContractorId = assignedContractorId(source);
  const executionWorkspaceId = str(assignment.executionWorkspaceId) ?? str(execution.executionWorkspaceId);
  const assignedAt = str(assignment.assignedAt) ?? str(execution.assignmentCreatedAt);
  const assignedBy = str(assignment.assignedBy) ?? str(assignment.assignedByUid);
  const assignedByEmail = str(assignment.assignedByEmail);
  const status = str(assignment.assignmentStatus ?? assignment.status);
  const hasMetadata = Boolean(assignedAt && (assignedBy || assignedByEmail) && status === "assigned");
  const hasDependentWorkflow = bool(execution.complianceStarted) || bool(execution.complianceReviewed) || bool(execution.pricingComplete) || bool(execution.documentsPrepared) || bool(execution.internalReviewApproved) || bool(execution.contractorApprovalComplete) || bool(execution.tenderPackGenerated) || bool(execution.readyForSubmission) || bool(execution.submitted);
  const invalidReason = !rawContractorId ? null : !contractor ? "Contractor reference does not resolve to one live contractor" : isArchivedContractor(contractor) ? "Assigned contractor is archived" : !hasMetadata ? "Assignment metadata is incomplete" : !executionWorkspaceId ? "Execution workspace is not connected" : null;
  const complete = Boolean(rawContractorId && contractor && !isArchivedContractor(contractor) && hasMetadata && executionWorkspaceId);
  return {
    contractorId: complete ? rawContractorId : null,
    contractorName: complete ? contractorName(contractor) ?? rawContractorId : null,
    assignedAt: complete ? assignedAt : null,
    assignedBy: complete ? assignedBy : null,
    assignedByEmail: complete ? assignedByEmail : null,
    assignmentStatus: complete ? "assigned" : rawContractorId ? "invalid" : "unassigned",
    assignmentReason: invalidReason,
    opportunityId: String(source.opportunityId ?? source.id ?? ""),
    dealId: String(source.id ?? ""),
    workspaceId: str(source.workspaceId),
    executionWorkspaceId: complete ? executionWorkspaceId : null,
    complete,
    canRemove: complete && !hasDependentWorkflow,
  };
}

function buildDocumentChecklist(deal: AnyRecord, requirements: OpportunityRequirementReview, contractor: AnyRecord | null, f: ReturnType<typeof executionFlags>): OpportunityDocumentChecklistItem[] {
  const docs = allDocs(deal);
  const item = (key: string, label: string, required: boolean, tokens: string[], completeOverride?: boolean): OpportunityDocumentChecklistItem => {
    if (!required) return { key, label, required, status: "NOT_APPLICABLE", source: null };
    const found = hasDocument(docs, tokens);
    const complete = completeOverride === true || Boolean(found) || f.documentsPrepared;
    return { key, label, required, status: complete ? "COMPLETE" : "BLOCKED", source: found ? docName(found) : null };
  };
  const complianceComplete = contractor ? evaluateOpportunityCompliance(requirements, contractor, str(deal.workspaceId)).status === "VALID" : false;
  return [
    item("source", "RFQ/RFP source document", true, ["rfq", "rfp", "request for quotation", "tender"]),
    item("pricing", "Pricing schedules", requirements.boqPricingSchedulePresent, ["boq", "pricing schedule", "bill of quantities"], f.pricingComplete),
    item("sbd", "SBD forms", true, ["sbd"], f.documentsPrepared),
    item("declarations", "Declarations", true, ["declaration"], f.documentsPrepared),
    item("annexures", "Annexures and amendments", requirements.annexuresAndAmendments.length > 0, ["annex", "amend"], f.documentsPrepared),
    item("compliance", "Contractor compliance documents", true, ["tax", "bbbee", "b-bbee", "coida", "csd", "cidb"], complianceComplete),
    item("signatures", "Signatures", requirements.signatureRequired, ["signature", "signed"], f.contractorApprovalComplete),
    item("amendments", "Amendments", requirements.annexuresAndAmendments.length > 0, ["amend"], f.documentsPrepared),
  ];
}

function stageStatus(args: { complete: boolean; inProgress: boolean; blocked?: boolean; applicable?: boolean }): OpportunityStageStatus {
  if (args.applicable === false) return "NOT_APPLICABLE";
  if (args.complete) return "COMPLETE";
  if (args.blocked) return "BLOCKED";
  if (args.inProgress) return "IN_PROGRESS";
  return "NOT_STARTED";
}

function taskStatus(status: OpportunityStageStatus): OpportunityTaskStatus {
  if (status === "COMPLETE") return "complete";
  if (status === "BLOCKED") return "blocked";
  if (status === "IN_PROGRESS") return "in_progress";
  if (status === "NOT_APPLICABLE") return "not_applicable";
  return "not_started";
}

function buildStages(input: {
  phase: OpportunityExecutionPhase;
  requirements: OpportunityRequirementReview;
  assignment: OpportunityAssignmentState;
  compliance: ReturnType<typeof evaluateOpportunityCompliance>;
  documents: OpportunityDocumentChecklistItem[];
  flags: ReturnType<typeof executionFlags>;
  blockers: string[];
}): OpportunityExecutionStage[] {
  const { phase, requirements, assignment, compliance, documents, flags, blockers } = input;
  const documentBlockers = documents.filter((doc) => doc.status === "BLOCKED").map((doc) => doc.label + " is missing");
  return [
    { key: "requirements", title: "Requirements Review", status: stageStatus({ complete: requirements.reviewed || isAtLeast(phase, "MATCHING_REQUIRED"), inProgress: phase === "REQUIREMENTS_REVIEW" }), owner: "staff", summary: "RFQ/RFP requirements, dates, returnables and compulsory documents.", blockers: requirements.reviewed ? [] : ["Review extracted tender requirements"], actionKey: "review_requirements" },
    { key: "assignment", title: "Contractor Assignment", status: stageStatus({ complete: assignment.complete, inProgress: phase === "MATCHING_REQUIRED", blocked: Boolean(assignment.assignmentReason) }), owner: "staff", summary: assignment.contractorName ?? "Select a live canonical contractor.", blockers: assignment.assignmentReason ? [assignment.assignmentReason] : assignment.complete ? [] : ["Assign a contractor"], actionKey: "assign_contractor" },
    { key: "compliance", title: "Compliance Review", status: stageStatus({ complete: compliance.status === "VALID" && flags.complianceReviewed, inProgress: phase === "COMPLIANCE_REVIEW" || flags.complianceStarted, blocked: assignment.complete && compliance.status !== "VALID" }), owner: "compliance", summary: "Tax, CSD, B-BBEE, COIDA, CIDB, banking and tender-specific checks.", blockers: compliance.status === "VALID" ? [] : [...compliance.missing, ...compliance.expired.map((item) => item + " expired")], actionKey: "start_compliance_review" },
    { key: "boq", title: "BOQ/Pricing", status: stageStatus({ complete: requirements.boqPricingSchedulePresent && flags.pricingComplete, inProgress: phase === "BOQ_PRICING" || flags.boqTaskCreated, blocked: requirements.boqPricingSchedulePresent && phase === "BOQ_PRICING" && !flags.pricingComplete, applicable: requirements.boqPricingSchedulePresent }), owner: "qs", summary: requirements.boqPricingSchedulePresent ? "BOQ or pricing schedule detected." : "No BOQ/pricing schedule detected.", blockers: requirements.boqPricingSchedulePresent && !flags.pricingComplete ? ["Required BOQ/pricing is incomplete"] : [], actionKey: "open_boq_pricing" },
    { key: "documents", title: "Document Preparation", status: stageStatus({ complete: flags.documentsPrepared, inProgress: phase === "DOCUMENT_PREPARATION", blocked: phase === "DOCUMENT_PREPARATION" && documentBlockers.length > 0 }), owner: "staff", summary: "Returnables, forms, declarations, annexures, amendments and compliance pack.", blockers: flags.documentsPrepared ? [] : documentBlockers, actionKey: "prepare_documents" },
    { key: "internalReview", title: "Internal Review", status: stageStatus({ complete: flags.internalReviewApproved, inProgress: phase === "INTERNAL_REVIEW" || flags.internalReviewStarted }), owner: "manager", summary: "Internal readiness approval before contractor sign-off.", blockers: flags.documentsPrepared || flags.internalReviewApproved ? [] : ["Prepare mandatory documents first"], actionKey: "start_internal_review" },
    { key: "contractorApproval", title: "Contractor Approval", status: stageStatus({ complete: flags.contractorApprovalComplete, inProgress: phase === "CONTRACTOR_APPROVAL" || flags.contractorApprovalRequested }), owner: "contractor", summary: "Contractor approval and required signatures.", blockers: flags.internalReviewApproved || flags.contractorApprovalComplete ? [] : ["Internal review must be approved first"], actionKey: "contractor_approval" },
    { key: "tenderPack", title: "Tender Pack", status: stageStatus({ complete: flags.tenderPackGenerated && flags.tenderPackValidated, inProgress: phase === "PACK_GENERATION", blocked: phase === "PACK_GENERATION" && blockers.length > 0 }), owner: "operations", summary: "Generate and validate the final tender pack.", blockers: blockers.filter((blocker) => !/BOQ\/pricing/.test(blocker)), actionKey: "generate_tender_pack" },
    { key: "submission", title: "Submission", status: stageStatus({ complete: flags.submitted, inProgress: phase === "READY_FOR_SUBMISSION", blocked: phase === "READY_FOR_SUBMISSION" && blockers.length > 0 }), owner: "manager", summary: "Record final portal/email/manual submission evidence.", blockers: flags.submitted ? [] : blockers, actionKey: "record_submission" },
  ];
}

function chooseNextAction(stages: OpportunityExecutionStage[], actions: OpportunityAction[], dueDate: string | null): OpportunityNextAction {
  const activeStage = stages.find((stage) => stage.status === "BLOCKED" || stage.status === "IN_PROGRESS" || stage.status === "NOT_STARTED");
  const action = activeStage?.actionKey ? actions.find((candidate) => candidate.key === activeStage.actionKey) : null;
  const blocker = activeStage?.blockers[0] ?? action?.reason ?? null;
  const label = blocker ?? action?.label ?? activeStage?.summary ?? "Track tender outcome";
  return { label, owner: activeStage?.owner ?? "operations", dueBefore: dueDate, blocker, actionKey: action?.key ?? activeStage?.actionKey ?? null };
}

function daysRemaining(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const end = new Date(dueDate).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.ceil((end - Date.now()) / 86400000);
}

export function buildOpportunityExecutionState(input: { deal: Deal | AnyRecord; contractor?: AnyRecord | null }): OpportunityExecutionState {
  const source = rec(input.deal);
  const requirements = extractOpportunityRequirements(input.deal);
  const assignment = buildAssignmentState(source, input.contractor ?? null);
  const contractorId = assignment.contractorId;
  const compliance = evaluateOpportunityCompliance(requirements, contractorId ? input.contractor ?? null : null, str(source.workspaceId));
  const phase = deriveOpportunityPhase({ deal: input.deal, contractor: input.contractor ?? null });
  const f = executionFlags(input.deal);
  const complianceRequirements = compliance.details;
  const complianceChecks = complianceRequirements.map((detail) => ({
    key: detail.key,
    label: detail.requirementName,
    required: detail.required,
    status: complianceStageStatus(detail.status),
    blocker: detail.blockerSeverity === "none" ? null : detail.reason,
  } satisfies OpportunityComplianceCheck));
  const documents = buildDocumentChecklist(source, requirements, contractorId ? input.contractor ?? null : null, f);
  const blockers: string[] = [];
  if (!assignment.complete && assignment.assignmentReason) blockers.push(assignment.assignmentReason);
  if (contractorId && compliance.status !== "VALID") blockers.push(...compliance.missing, ...compliance.expired.map((item) => item + " expired"));
  if (requirements.boqPricingSchedulePresent && !f.pricingComplete && isAtLeast(phase, "BOQ_PRICING")) blockers.push("Required BOQ/pricing is incomplete");
  if (isAtLeast(phase, "PACK_GENERATION")) {
    if (!f.documentsPrepared) blockers.push("Mandatory returnable documents are incomplete");
    if (!f.internalReviewApproved) blockers.push("Internal review is not approved");
    if (requirements.signatureRequired && !f.contractorApprovalComplete) blockers.push("Required contractor signatures are incomplete");
  }
  const complianceBlockers = complianceRequirements
    .filter((detail) => detail.blockerSeverity !== "none")
    .map((detail) => detail.reason);
  const uniqueBlockers = Array.from(new Set([...blockers, ...complianceBlockers]));
  const actions: OpportunityAction[] = [];
  const documentsBlocked = documents.some((doc) => doc.status === "BLOCKED");
  addAction(actions, "review_requirements", "Complete Requirements Review", phase === "REQUIREMENTS_REVIEW", "Requirements review is already complete or not the current phase");
  addAction(actions, "find_matching_contractors", "Find Matching Contractors", phase === "MATCHING_REQUIRED", "Complete requirements review first");
  addAction(actions, "assign_contractor", "Assign Contractor", phase === "MATCHING_REQUIRED", "Complete matching first");
  addAction(actions, "open_contractor", "Open Contractor", Boolean(contractorId), "No contractor is assigned", contractorId ? "/dashboard/contractors/" + contractorId : undefined);
  addAction(actions, "open_execution_workspace", "Open Execution Workspace", Boolean(assignment.executionWorkspaceId), "No execution workspace is connected", assignment.executionWorkspaceId ? "/dashboard/deals/" + encodeURIComponent(String(source.id ?? "")) + "/execution" : undefined);
  addAction(actions, "change_assignment", "Change Assignment", phase === "MATCHING_REQUIRED" || assignment.complete, "Complete requirements review before changing assignment");
  addAction(actions, "remove_assignment", "Remove Assignment", assignment.canRemove, assignment.complete ? "Dependent workflow data exists; remove or reset downstream workflow first" : "No contractor assignment is connected");
  addAction(actions, "start_compliance_review", "Start Compliance Review", phase === "COMPLIANCE_REVIEW" && assignment.complete, assignment.complete ? "Compliance review is not the current phase" : "Assign a contractor first");
  addAction(actions, "open_missing_documents", "Open Missing Documents", compliance.status !== "VALID" || documentsBlocked, "No missing documents are blocking execution", contractorId ? "/dashboard/contractors/" + contractorId : undefined);
  addAction(actions, "open_boq_pricing", "Open BOQ/Pricing", requirements.boqPricingSchedulePresent && (phase === "BOQ_PRICING" || f.complianceReviewed), requirements.boqPricingSchedulePresent ? "Complete compliance review first" : "No BOQ or pricing schedule is required", "/dashboard/qs/boq?dealId=" + encodeURIComponent(String(source.id ?? "")));
  addAction(actions, "prepare_documents", "Prepare Returnables", phase === "DOCUMENT_PREPARATION", phase === "DOCUMENT_PREPARATION" ? null : "Resolve compulsory compliance and pricing blockers first");
  addAction(actions, "start_internal_review", "Start Internal Review", phase === "INTERNAL_REVIEW", "Prepare required documents first");
  addAction(actions, "contractor_approval", "Request Contractor Approval", phase === "CONTRACTOR_APPROVAL", "Internal review must be approved first");
  addAction(actions, "generate_tender_pack", "Generate Tender Pack", phase === "PACK_GENERATION" && uniqueBlockers.length === 0, uniqueBlockers.join("; ") || "Opportunity is not in pack generation");
  addAction(actions, "mark_ready_for_submission", "Mark Ready for Submission", phase === "PACK_GENERATION" && uniqueBlockers.length === 0, uniqueBlockers.join("; ") || "Generate and validate the tender pack first");
  addAction(actions, "record_submission", "Record Submission", phase === "READY_FOR_SUBMISSION", "Opportunity is not ready for submission");
  const stages = buildStages({ phase, requirements, assignment, compliance, documents, flags: f, blockers: uniqueBlockers });
  const readinessBase = stages.filter((stage) => stage.status === "COMPLETE" || stage.status === "NOT_APPLICABLE").length / stages.length;
  const readiness = phase === "SUBMITTED" || phase === "AWARDED" ? 100 : Math.max(0, Math.min(99, Math.round(readinessBase * 100) - uniqueBlockers.length * 4));
  const dueDate = requirements.closingDateTime;
  const profileCompleteness = calculateProfileCompleteness(input.contractor ?? null);
  const generalCompliance = pct(input.contractor?.readinessScore ?? input.contractor?.complianceStatusScore);
  const submissionReadiness = calculateSubmissionReadiness(complianceRequirements);
  const opportunityMatch = submissionReadiness;
  const remediationRequests = createComplianceRemediationRequests({
    opportunityId: String(source.opportunityId ?? source.id ?? ""),
    dealId: String(source.id ?? ""),
    contractorId,
    requirements: complianceRequirements,
    existingRequests: Array.isArray(rec(source.opportunityExecution).complianceRequests) ? rec(source.opportunityExecution).complianceRequests as ComplianceRemediationRequest[] : [],
    assignedStaffMember: str(rec(source.contractorAssignment).assignedBy) ?? str(rec(source.opportunityExecution).assignedStaffMember),
  });
  const nextActionDetail = chooseNextAction(stages, actions, dueDate);
  return {
    currentPhase: phase,
    nextAction: nextActionDetail.label,
    nextActionDetail,
    blockers: uniqueBlockers,
    assignedOwner: nextActionDetail.owner,
    dueDate,
    daysRemaining: daysRemaining(dueDate),
    readiness,
    profileCompleteness,
    generalCompliance,
    opportunityMatch,
    submissionReadiness,
    contractorId,
    contractorName: assignment.contractorName,
    dealId: String(source.id ?? ""),
    executionWorkspaceId: assignment.executionWorkspaceId ?? str(rec(source.opportunityExecution).executionWorkspaceId) ?? "exec-" + String(source.id ?? "opportunity"),
    boqRequired: requirements.boqPricingSchedulePresent,
    pricingRequired: requirements.boqPricingSchedulePresent,
    complianceStatus: contractorId ? compliance.status : "MISSING",
    documentStatus: taskStatus(stages.find((stage) => stage.key === "documents")?.status ?? "NOT_STARTED"),
    reviewStatus: taskStatus(stages.find((stage) => stage.key === "internalReview")?.status ?? "NOT_STARTED"),
    submissionStatus: taskStatus(stages.find((stage) => stage.key === "submission")?.status ?? "NOT_STARTED"),
    requirements,
    assignment,
    submissionReviewConnected: Boolean(str(rec(source.submissionReview).id) ?? str(rec(source.opportunityExecution).submissionReviewId)),
    complianceChecks,
    complianceRequirements,
    remediationRequests,
    documentChecklist: documents,
    stages,
    actions,
  };
}

function isMockContractor(contractor: AnyRecord): boolean {
  return contractor.demoContractor === true || contractor.mockContractor === true || contractor.benchmarkContractor === true || contractor.regressionValidationContractor === true || contractor.operationalReplayContractor === true || contractor.canonicalProfile === true;
}

export function matchContractorsForOpportunity(input: { deal: Deal | AnyRecord; contractors: Array<AnyRecord & { id: string }> }): ContractorMatchResult[] {
  const requirements = extractOpportunityRequirements(input.deal);
  const dealWorkspaceId = str(rec(input.deal).workspaceId);
  const normalizedCidbRequirement = normalizeCidbRequirement(requirements.cidbRequirement);
  const sourceText = [requirements.serviceCategory, requirements.location, normalizedCidbRequirement].filter(Boolean).join(" ");
  return input.contractors.filter((contractor) => !isMockContractor(contractor)).map((contractor) => {
    const capabilities = arr(contractor.capabilities ?? contractor.serviceCategories ?? contractor.services ?? contractor.categories);
    const regions = arr(contractor.provinces ?? contractor.serviceAreas ?? contractor.regions);
    const compliance = evaluateOpportunityCompliance(requirements, contractor, dealWorkspaceId);
    const readiness = pct(contractor.readinessScore);
    const profileCompleteness = calculateProfileCompleteness(contractor);
    const generalCompliance = compliance.status === "VALID" ? pct(contractor.complianceStatusScore ?? contractor.readinessScore) : 0;
    const submissionReadiness = calculateSubmissionReadiness(compliance.details);
    const missingDocuments = compliance.details.filter((detail) => detail.blockerSeverity !== "none").map((detail) => detail.reason);
    const blockingReasons = contractorDecisionBlockers(contractor, dealWorkspaceId, compliance);
    const eligible = blockingReasons.length === 0;
    const capabilityScore = capabilities.length === 0 ? 8 : capabilities.some((item) => textHas(sourceText, item) || textHas(item, requirements.serviceCategory ?? "")) ? 30 : 0;
    const regionScore = !requirements.location || regions.length === 0 ? 10 : regions.some((item) => textHas(requirements.location ?? "", item) || textHas(item, requirements.location ?? "")) ? 20 : 0;
    const cidbScore = !normalizedCidbRequirement ? 10 : arr(contractor.cidbGradings ?? contractor.cidbRequirements).some((item) => textHas(item, normalizedCidbRequirement)) ? 20 : -10;
    const complianceScore = compliance.status === "VALID" ? 20 : ["UNVERIFIED", "UNCLASSIFIED", "DUPLICATE", "REQUIRES_MANUAL_REVIEW"].includes(compliance.status) ? 8 : -15;
    const matchScore = eligible ? Math.max(0, Math.min(100, capabilityScore + regionScore + cidbScore + complianceScore + Math.round(generalCompliance * 0.2))) : 0;
    const validRequirementsCount = compliance.details.filter((detail) => detail.status === "VALID").length;
    const missingCount = compliance.details.filter((detail) => detail.status === "MISSING").length;
    const expiredCount = compliance.details.filter((detail) => detail.status === "EXPIRED").length;
    const reviewRequiredCount = compliance.details.filter((detail) => ["UNVERIFIED", "UNCLASSIFIED", "DUPLICATE", "REQUIRES_MANUAL_REVIEW"].includes(detail.status)).length;
    const recommendationReason = blockingReasons.length
      ? blockingReasons.join("; ")
      : "Matched against category, geography, compliance, profile completeness and opportunity requirements.";
    return {
      contractorId: canonicalContractorId(contractor) ?? contractor.id,
      contractorName: contractorName(contractor) ?? contractor.id,
      matchScore,
      readiness,
      profileCompleteness,
      generalCompliance,
      opportunityMatch: matchScore,
      submissionReadiness,
      missingDocuments,
      validRequirementsCount,
      missingCount,
      expiredCount,
      reviewRequiredCount,
      complianceDetails: compliance.details,
      disqualifyingRequirements: compliance.status === "VALID" ? [] : missingDocuments,
      recommendationReason,
      complianceStatus: compliance.status,
      eligible,
      assignmentAllowed: eligible,
      blockingReasons,
    };
  }).sort((left, right) => right.matchScore - left.matchScore);
}

const TRANSITIONS: Partial<Record<OpportunityExecutionPhase, OpportunityExecutionPhase[]>> = {
  REQUIREMENTS_REVIEW: ["MATCHING_REQUIRED"],
  MATCHING_REQUIRED: ["CONTRACTOR_ASSIGNED", "COMPLIANCE_REVIEW"],
  CONTRACTOR_ASSIGNED: ["COMPLIANCE_REVIEW"],
  COMPLIANCE_REVIEW: ["BOQ_PRICING", "DOCUMENT_PREPARATION"],
  BOQ_PRICING: ["DOCUMENT_PREPARATION"],
  DOCUMENT_PREPARATION: ["INTERNAL_REVIEW"],
  INTERNAL_REVIEW: ["CONTRACTOR_APPROVAL"],
  CONTRACTOR_APPROVAL: ["PACK_GENERATION"],
  PACK_GENERATION: ["READY_FOR_SUBMISSION"],
  READY_FOR_SUBMISSION: ["SUBMITTED"],
};

export function validateOpportunityTransition(current: OpportunityExecutionPhase, next: OpportunityExecutionPhase): { ok: true } | { ok: false; status: 409; message: string } {
  if (current === next || TRANSITIONS[current]?.includes(next)) return { ok: true };
  return { ok: false, status: 409, message: "Invalid opportunity phase transition from " + current + " to " + next };
}

export function buildSubmissionReadiness(input: { state: OpportunityExecutionState; pricingComplete?: boolean; documentsComplete?: boolean; internalReviewApproved?: boolean; signaturesComplete?: boolean; packGenerated?: boolean; packValidated?: boolean }) {
  const blockers: string[] = [];
  if (!input.state.contractorId) blockers.push("Contractor must be assigned");
  if (input.state.complianceStatus !== "VALID") blockers.push("Compulsory compliance must be valid");
  if (input.state.pricingRequired && !input.pricingComplete) blockers.push("Required pricing must be complete");
  if (!input.documentsComplete) blockers.push("Mandatory documents must be complete");
  if (!input.internalReviewApproved) blockers.push("Internal review must be approved");
  if (input.state.requirements.signatureRequired && !input.signaturesComplete) blockers.push("Required signatures must be complete");
  if (!input.packGenerated || !input.packValidated) blockers.push("Final pack must be generated and validated");
  return { ready: blockers.length === 0, blockers };
}
